import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, before, test } from 'node:test';
import { finishViteRequest, publicArchiveRanges } from '../dev-http.mjs';

let directory;
let server;
let origin;
const bytes = Buffer.from(Array.from({ length: 128 * 1024 }, (_, i) => i % 251));

before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'molen-dev-http-'));
  await mkdir(join(directory, 'packs'));
  await writeFile(join(directory, 'packs', 'test pack.zip'), bytes);
  await writeFile(join(directory, 'packs', 'tiles.pmtiles'), bytes);
  await writeFile(join(directory, 'packs', 'empty.zip'), '');
  const ranges = publicArchiveRanges(directory, '/world-explorer/');
  server = createServer((request, response) => {
    if (request.url === '/partial') {
      response.writeHead(206, { 'content-length': '100' });
      response.flushHeaders();
      setImmediate(() => finishViteRequest(response, new Error('read failed')));
    } else if (request.url === '/ended') {
      response.end('complete');
      setImmediate(() => finishViteRequest(response));
    } else if (request.url === '/error') {
      finishViteRequest(response, new Error('middleware failed'));
    } else {
      ranges(request, response, (error) => {
        // Stand in for Vite's ordinary full-file response for ignored Range headers.
        if (!request.headers.range && request.url === '/world-explorer/packs/test%20pack.zip') {
          response.writeHead(200, { 'content-length': bytes.length });
          response.end(bytes);
        } else {
          finishViteRequest(response, error);
        }
      });
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  origin = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    const closed = once(server, 'close');
    server.close();
    server.closeAllConnections();
    await closed;
  }
  if (directory) {
    assert.ok(resolve(directory).startsWith(`${resolve(tmpdir())}${sep}molen-dev-http-`));
    await rm(directory, { recursive: true, force: true });
  }
});

test('archive ranges return the exact suffix, prefix, open end, and clamped bytes', async () => {
  for (const file of ['test%20pack.zip', 'tiles.pmtiles']) {
    for (const [range, start, end] of [
      ['bytes=-65536', 65536, bytes.length - 1],
      ['bytes=65536-131071', 65536, bytes.length - 1],
      ['bytes=0-0', 0, 0],
      ['bytes=7-16', 7, 16],
      ['bytes=131065-', 131065, bytes.length - 1],
      ['bytes=131065-999999', 131065, bytes.length - 1],
      ['bytes=-999999', 0, bytes.length - 1],
    ]) {
      const response = await fetch(`${origin}/world-explorer/packs/${file}?v=1`, {
        headers: { range },
      });
      assert.equal(response.status, 206, range);
      assert.equal(response.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
      assert.equal(response.headers.get('content-length'), String(end - start + 1));
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes.subarray(start, end + 1));
    }
  }
});

test('invalid ranges return 416 and the next request still succeeds', async () => {
  for (const range of [
    'bytes=65537-65536',
    'bytes=51618176-65536',
    'bytes=131072-',
    'bytes=-0',
    'bytes=-',
    'bytes=1-2,5-6',
    'bytes=0-9007199254740992',
    'invalid',
  ]) {
    const response = await fetch(`${origin}/world-explorer/packs/test%20pack.zip`, {
      headers: { range },
    });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get('content-range'), `bytes */${bytes.length}`);
    await response.arrayBuffer();
  }
  const empty = await fetch(`${origin}/world-explorer/packs/empty.zip`, {
    headers: { range: 'bytes=0-0' },
  });
  assert.equal(empty.status, 416);
  assert.equal(empty.headers.get('content-range'), 'bytes */0');
  assert.equal(await (await fetch(`${origin}/ended`)).text(), 'complete');
});

test('HEAD and If-Range fall through for a full response', async () => {
  const url = `${origin}/world-explorer/packs/test%20pack.zip`;
  const head = await fetch(url, { method: 'HEAD', headers: { range: 'bytes=7-16' } });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('content-length'), String(bytes.length));
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  const stale = await fetch(url, { headers: { range: 'bytes=7-16', 'if-range': '"old"' } });
  assert.equal(stale.status, 200);
  assert.deepEqual(Buffer.from(await stale.arrayBuffer()), bytes);
});

test('missing assets and paths outside the public mount fall through', async () => {
  for (const path of [
    '/world-explorer/packs/missing.zip',
    '/another-example/packs/test%20pack.zip',
    '/world-explorer/..%2fpacks/test%20pack.zip',
  ]) {
    const response = await fetch(`${origin}${path}`, { headers: { range: 'bytes=0-1' } });
    assert.equal(response.status, 404, path);
    await response.text();
  }
});

test('middleware failures end only their request without writing headers twice', async () => {
  await assert.rejects(async () => {
    const response = await fetch(`${origin}/partial`);
    await response.arrayBuffer();
  });
  assert.equal(await (await fetch(`${origin}/ended`)).text(), 'complete');
  const failed = await fetch(`${origin}/error`);
  assert.equal(failed.status, 500);
  assert.equal(await failed.text(), 'Example request failed.');
  const missing = await fetch(`${origin}/missing`);
  assert.equal(missing.status, 404);
  assert.equal(await missing.text(), 'Example not found.');
});

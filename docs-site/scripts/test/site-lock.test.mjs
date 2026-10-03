import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { withSiteLock } from '../site-lock.mjs';

const roots = [];
const children = [];
afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await child.finished;
  }
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'molen-site-lock-'));
  roots.push(root);
  const siteDir = join(root, 'docs-site');
  await mkdir(siteDir);
  await writeFile(join(siteDir, 'client.md'), 'original');
  return siteDir;
}

function worker(siteDir, mode) {
  const script = fileURLToPath(new URL('./fixtures/site-lock-worker.mjs', import.meta.url));
  const child = spawn(process.execPath, [script, siteDir, mode], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  });
  children.push(child);
  let errors = '';
  child.stderr.on('data', (data) => {
    errors += data;
  });
  const messages = [];
  const waiting = new Map();
  child.on('message', (message) => {
    const resolve = waiting.get(message);
    if (resolve) {
      waiting.delete(message);
      resolve();
    } else messages.push(message);
  });
  child.next = (message) => {
    const at = messages.indexOf(message);
    if (at !== -1) {
      messages.splice(at, 1);
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`No ${message} from ${mode}: ${errors}`)),
        5000,
      );
      waiting.set(message, () => {
        clearTimeout(timer);
        resolve();
      });
    });
  };
  child.finished = new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve({ code, signal, errors }));
  });
  return child;
}

test('regeneration in another process waits until the build finishes reading pages', async () => {
  const siteDir = await fixture();
  const build = worker(siteDir, 'build');
  await build.next('acquired');
  const generate = worker(siteDir, 'generate');
  await generate.next('waiting');
  assert.equal(await readFile(join(siteDir, 'client.md'), 'utf8'), 'original');
  build.send('continue');
  assert.deepEqual(await build.finished, { code: 0, signal: null, errors: '' });
  await generate.next('acquired');
  assert.equal(await readFile(join(siteDir, 'client.md'), 'utf8'), 'regenerated');
  generate.send('continue');
  assert.deepEqual(await generate.finished, { code: 0, signal: null, errors: '' });
});

test('a failed command releases its lock for the next command', async () => {
  const siteDir = await fixture();
  await assert.rejects(
    withSiteLock(siteDir, () => {
      throw new Error('build failed');
    }),
    /build failed/,
  );
  assert.equal(await withSiteLock(siteDir, () => 'next command'), 'next command');
});

test('concurrent waiters recover an interrupted owner without removing a new live lock', async () => {
  const siteDir = await fixture();
  const owner = worker(siteDir, 'build');
  await owner.next('acquired');
  const first = worker(siteDir, 'build');
  const second = worker(siteDir, 'build');
  await Promise.all([first.next('waiting'), second.next('waiting')]);
  owner.kill('SIGKILL');
  await owner.finished;
  const firstReady = first.next('acquired');
  const secondReady = second.next('acquired');
  const winner = await Promise.race([firstReady.then(() => first), secondReady.then(() => second)]);
  const directory = join(siteDir, '..', '.artifacts', 'docs-site.lock');
  assert.ok((await readdir(directory))[0].startsWith(`${winner.pid}-`));
  winner.send('continue');
  assert.equal((await winner.finished).code, 0);
  const loser = winner === first ? second : first;
  await (loser === first ? firstReady : secondReady);
  loser.send('continue');
  assert.equal((await loser.finished).code, 0);
});

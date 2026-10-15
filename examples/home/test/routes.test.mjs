import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';

test('every gallery link serves its example instead of the gallery fallback', {
  timeout: 60_000,
}, async () => {
  const server = spawn(process.execPath, ['dev-server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stderr.on('data', (chunk) => {
    output += chunk;
  });
  try {
    const url = await new Promise((resolve, reject) => {
      server.on('error', reject);
      server.on('exit', (code) => reject(new Error(`Server exited ${code}: ${output}`)));
      server.stdout.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+\//);
        if (match) resolve(match[0]);
      });
    });
    const home = await (await fetch(url)).text();
    const links = [...home.matchAll(/class="example" href="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(links.length >= 10);
    for (const link of links) {
      const response = await fetch(new URL(link, url));
      assert.equal(response.status, 200, link);
      const html = await response.text();
      assert.match(html, /<canvas\b/, `${link} should contain its experience canvas`);
      assert.doesNotMatch(html, /<title>Molen examples<\/title>/, link);
    }
    const redirect = await fetch(new URL('earth-view?mode=walk', url), { redirect: 'manual' });
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.get('location'), '/earth-view/?mode=walk');
  } finally {
    const closed = once(server, 'close');
    server.kill('SIGTERM');
    await closed;
  }
});

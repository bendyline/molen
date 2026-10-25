import assert from 'node:assert/strict';
import { mkdtemp, open, readdir, readFile, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { writeNavigation } from '../navigation-file.mjs';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'molen-site-navigation-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, path: join(directory, 'generated-nav.json') };
}

test('first generation publishes the navigation without leaving temporary files', async (t) => {
  const { directory, path } = await fixture(t);
  await writeNavigation(path, '{"sidebar":{}}\n');
  assert.equal(await readFile(path, 'utf8'), '{"sidebar":{}}\n');
  assert.deepEqual(await readdir(directory), ['generated-nav.json']);
});

test('identical navigation is not rewritten by generation or checking', async (t) => {
  const { path } = await fixture(t);
  const navigation = '{"sidebar":{}}\n';
  await writeNavigation(path, navigation);
  await utimes(path, new Date(1000), new Date(1000));
  const before = await stat(path);
  await writeNavigation(path, navigation);
  await writeNavigation(path, navigation, { check: true });
  const after = await stat(path);
  assert.equal(after.mtimeMs, before.mtimeMs);
  assert.equal(after.ino, before.ino);
});

test('replacement preserves an existing reader and waits for Windows to release it', async (t) => {
  const { directory, path } = await fixture(t);
  await writeNavigation(path, 'previous navigation');
  const reader = await open(path, 'r');
  const results = await Promise.allSettled([
    writeNavigation(path, 'new navigation'),
    (async () => {
      try {
        await setTimeout(100);
        assert.equal(await reader.readFile('utf8'), 'previous navigation');
      } finally {
        await reader.close();
      }
    })(),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') throw result.reason;
  }
  assert.equal(await readFile(path, 'utf8'), 'new navigation');
  assert.deepEqual(await readdir(directory), ['generated-nav.json']);
});

test('checking rejects missing or stale navigation without changing it', async (t) => {
  const { directory, path } = await fixture(t);
  await assert.rejects(writeNavigation(path, 'next', { check: true }), /navigation is stale/);
  assert.deepEqual(await readdir(directory), []);
  await writeNavigation(path, 'previous');
  await assert.rejects(writeNavigation(path, 'next', { check: true }), /navigation is stale/);
  assert.equal(await readFile(path, 'utf8'), 'previous');
  assert.deepEqual(await readdir(directory), ['generated-nav.json']);
});

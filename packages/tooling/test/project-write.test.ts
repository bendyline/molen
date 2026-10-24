import { mkdtemp, readdir, readFile, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { updateProjectFile } from '../src/project';

let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'molen-project-write-'));
});
afterAll(async () => {
  if (dirname(root) !== resolve(tmpdir())) throw new Error('Unexpected temporary directory');
  await rm(root, { recursive: true, force: true });
});

it('preserves bytes and timestamps when asset registration is unchanged', async () => {
  const path = join(root, 'unchanged.json');
  const original =
    '{"format":"molen/project@1","name":"test","assets":{"crate":"assets/crate/asset.json"}}\r\n';
  await writeFile(path, original);
  await utimes(path, 1_000_000_000, 1_000_000_000);
  const before = await stat(path);
  const result = await updateProjectFile(path, (manifest) => {
    manifest.assets.crate = 'assets/crate/asset.json';
  });
  expect(result.assets.crate).toBe('assets/crate/asset.json');
  expect(await readFile(path, 'utf8')).toBe(original);
  expect((await stat(path)).mtimeMs).toBe(before.mtimeMs);
});

it('retains all concurrent registrations and releases locks after an invalid update', async () => {
  const path = join(root, 'concurrent.json');
  await writeFile(path, '{"format":"molen/project@1","name":"test"}');
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      updateProjectFile(path, (manifest) => {
        manifest.assets[`asset${i}`] = `assets/${i}/asset.json`;
      }),
    ),
  );
  const before = await readFile(path, 'utf8');
  const project = JSON.parse(before);
  expect(Object.keys(project.assets)).toHaveLength(20);
  for (let i = 0; i < 20; i++) expect(project.assets[`asset${i}`]).toBe(`assets/${i}/asset.json`);
  await expect(
    updateProjectFile(path, (manifest) => {
      manifest.name = '';
    }),
  ).rejects.toThrow('invalid manifest');
  expect(await readFile(path, 'utf8')).toBe(before);
  expect((await readdir(root)).filter((name) => /\.(lock|tmp)$/.test(name))).toEqual([]);
});

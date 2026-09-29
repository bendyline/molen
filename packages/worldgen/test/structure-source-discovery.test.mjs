import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { checkSourceRegistry } from '../scripts/structure-model-files.mjs';

let dir;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'molen-source-discovery-'));
});
afterEach(async () => {
  if (!resolve(dir).startsWith(`${resolve(tmpdir())}${sep}`))
    throw new Error('Unexpected fixture directory');
  await rm(dir, { recursive: true, force: true });
});

it('finds newly authored nested geographic bundles and names the registry repair', async () => {
  const sourcePath = 'source/places/c2/c23/new_landmark';
  const bundle = join(dir, sourcePath);
  await mkdir(bundle, { recursive: true });
  await writeFile(join(bundle, 'source.json'), '{}');
  const options = { entries: [], repositoryRoot: dir, directories: [join(dir, 'source/places')] };
  await expect(checkSourceRegistry(options)).rejects.toThrow(
    /new_landmark.*index-structure-sources\.mjs/,
  );
  await expect(
    checkSourceRegistry({ ...options, entries: [{ sourcePath }] }),
  ).resolves.toBeUndefined();
});

it('rejects missing registered bundles while retaining research-only registered directories', async () => {
  const sourcePath = 'source/places/u2/u2f/research';
  const options = {
    entries: [{ sourcePath }],
    repositoryRoot: dir,
    directories: [join(dir, 'source/places')],
  };
  await expect(checkSourceRegistry(options)).rejects.toThrow(/registry is stale/);
  await mkdir(join(dir, sourcePath), { recursive: true });
  await writeFile(join(dir, sourcePath, 'map-frame.json'), '{}');
  await expect(checkSourceRegistry(options)).resolves.toBeUndefined();
});

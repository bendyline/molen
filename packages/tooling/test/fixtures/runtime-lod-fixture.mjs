import { constants } from 'node:fs';
import { cp, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterAll } from 'vitest';

const directories = [];
afterAll(async () => {
  await Promise.all(directories.map((path) => rm(path, { recursive: true, force: true })));
});

/** Copy an installed asset directory (or its sidecar) before testing destructive LOD rebuilds. */
export async function runtimeLodFixture(path) {
  const sidecar = basename(path) === 'asset.json';
  const directory = await mkdtemp(join(tmpdir(), 'molen-runtime-lod-'));
  try {
    // Copy-on-write where supported; never hardlink outputs a generator will overwrite.
    await cp(sidecar ? dirname(path) : path, directory, {
      recursive: true,
      mode: constants.COPYFILE_FICLONE,
    });
    directories.push(directory);
    return sidecar ? join(directory, 'asset.json') : directory;
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

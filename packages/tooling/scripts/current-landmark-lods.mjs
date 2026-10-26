/** Reuse verified derivatives before paying for a separate model-builder process. */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const names = ['skyline', 'district', 'street', 'closeup'];

export async function currentLandmarkLods(sidecarPath, expectedRecipeHash, previousBuild) {
  const directory = dirname(sidecarPath);
  let sidecar;
  try {
    sidecar = JSON.parse(await readFile(sidecarPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
  for (const lods of [sidecar.runtimeLods, previousBuild]) {
    if (
      !lods ||
      lods.recipeHash !== expectedRecipeHash ||
      lods.masterHash !== sidecar.hash ||
      !Array.isArray(lods.levels) ||
      lods.levels.length !== names.length ||
      names.some((name) => lods.levels.filter((level) => level.name === name).length !== 1)
    )
      continue;
    // Read/hash one file at a time to bound memory on large stadium masters. Metadata alone
    // never proves a hit: a missing or changed master/derivative must reach the normal builder.
    let valid = true;
    for (const entry of [{ file: sidecar.files?.main, hash: sidecar.hash }, ...lods.levels]) {
      if (typeof entry.file !== 'string') {
        valid = false;
        break;
      }
      const path = resolve(directory, entry.file),
        local = relative(directory, path);
      if (local.startsWith('..') || isAbsolute(local)) {
        valid = false;
        break;
      }
      try {
        if (hash(await readFile(path)) !== entry.hash) {
          valid = false;
          break;
        }
      } catch (error) {
        if (error.code === 'ENOENT') {
          valid = false;
          break;
        }
        throw error;
      }
    }
    if (valid) return lods;
  }
  return undefined;
}

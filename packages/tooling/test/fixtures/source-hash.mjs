import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isReferenceMaterial } from '../../../../scripts/reference-material.mjs';

const ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
let pins;

/**
 * `sha256:<hex>` of a source file a model was derived from. Raw terrain rasters and other
 * reference material live outside Git (content/ASSET-PACKS.md, "Reference material"): a checkout
 * that has not run `pnpm references:fetch` (CI among them) reads the hash reference-lock.json pins
 * for those bytes instead. The lock is what fetching verifies against, so either way the recorded
 * hash is bound to the exact bytes.
 */
export async function sourceHash(path) {
  try {
    return `sha256:${createHash('sha256')
      .update(await readFile(path))
      .digest('hex')}`;
  } catch (error) {
    const key = relative(ROOT, path).split(sep).join('/');
    if (error?.code !== 'ENOENT' || !isReferenceMaterial(key)) throw error;
    pins ??= new Map(
      JSON.parse(await readFile(resolve(ROOT, 'reference-lock.json'), 'utf8')).files.map((file) => [
        file.path,
        file.sha256,
      ]),
    );
    const pinned = pins.get(key);
    if (!pinned) throw new Error(`${key} is neither on disk nor pinned in reference-lock.json`);
    return `sha256:${pinned}`;
  }
}

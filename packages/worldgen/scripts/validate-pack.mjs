// Validate every document of a style pack directory and cross-check the bundle. Exits non-zero on
// any blocking issue; notices are printed. Run after `tsdown` (imports the built kernel).
//
//   node scripts/validate-pack.mjs [pack directory, default content/worldgen]

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveStylePackDocuments } from '../dist/kernel.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packDir = resolve(root, process.argv[2] ?? '../../content/worldgen');

async function readJson(path) {
  return JSON.parse(await readFile(resolve(packDir, path), 'utf8'));
}

try {
  const pack = await resolveStylePackDocuments(await readJson('stylepack.json'), readJson);
  for (const warning of pack.warnings) console.warn(`notice: ${warning}`);
  console.log(
    `Validated style pack ${pack.id}@${pack.version}: ${Object.keys(pack.archstyles).length} styles, ${Object.keys(pack.scatters).length} scatter sets, ${Object.keys(pack.materials).length} materials, ${Object.keys(pack.assets).length} assets (${pack.hash.slice(0, 19)}).`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// Build the content packs the explorer loads (entities, the default style pack, the earth atlas
// and business catalog, the star catalog) from the repository's content/ sources into
// public/packs, with an index.json. public/packs is gitignored; content/ is the source of truth.

import { rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPack } from '@bendyline/molen-pack/node';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const content = resolve(root, '../../content');
const outDir = resolve(root, 'public/packs');

await rm(outDir, { recursive: true, force: true });
for (const name of ['entities', 'worldgen', 'earth', 'sky']) {
  const built = await buildPack(resolve(content, name), { outDir });
  console.log(`${built.manifest.id}: ${built.file} (${Math.round(built.size / 1024)} KB)`);
}

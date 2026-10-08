// Build the content packs the explorer loads (entities, the default style pack, the earth atlas
// and business catalog, the star catalog, the sound bank) from the repository's content/ sources into
// public/packs, with an index.json. public/packs is gitignored; content/ is the source of truth.

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPack } from '@bendyline/molen-pack/node';
import { buildRegionalPacks } from './build-regional-packs.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const content = resolve(root, '../../content');
const outDir = resolve(root, 'public/packs');
// MOLEN_PACK_COMPRESSION=store writes the packs uncompressed. Deflating about 2 GB of models in
// JavaScript is 90% of this build (13 minutes on a CI runner); a test run only reads them locally.
const compression = process.env.MOLEN_PACK_COMPRESSION === 'store' ? 'store' : undefined;

for (const name of ['entities', 'earth', 'ecology', 'wildlife', 'sky', 'sounds']) {
  const built = await buildPack(resolve(content, name), { outDir, compression });
  console.log(`${built.manifest.id}: ${built.file} (${Math.round(built.size / 1024)} KB)`);
}
const earthSource = JSON.parse(
  await readFile(resolve(content, 'earth/molen-pack.source.json'), 'utf8'),
);
const placements = [];
for (const path of earthSource.provides.structures) {
  const doc = JSON.parse(await readFile(resolve(content, 'earth', path), 'utf8'));
  placements.push(...doc.entries);
}
await buildRegionalPacks(resolve(content, 'worldgen'), {
  outDir,
  placements,
  compression,
  onBuilt: (id, entry) => console.log(`${id}: ${entry.file} (${Math.round(entry.size / 1024)} KB)`),
});

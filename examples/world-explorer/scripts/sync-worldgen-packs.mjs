// Copy the shipped style pack, region atlas, and entity assets into public/ so the dev server and
// the built app serve them. Targets are gitignored; the packages are the source of truth.

import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Directory of an exported file of a workspace package. */
function exportedDir(specifier) {
  return dirname(fileURLToPath(import.meta.resolve(specifier)));
}

const copies = [
  [
    exportedDir('@bendyline/molen-worldgen/packs/default/stylepack.json'),
    'public/worldgen/default',
  ],
  [
    exportedDir('@bendyline/molen-worldgen-earth/packs/default/world.atlas.json'),
    'public/worldgen-earth/default',
  ],
  [resolve(exportedDir('@bendyline/molen-entities/project'), 'assets'), 'public/entities/assets'],
];

for (const [from, to] of copies) {
  const destination = resolve(root, to);
  await rm(destination, { recursive: true, force: true });
  await mkdir(dirname(destination), { recursive: true });
  await cp(from, destination, { recursive: true });
}
console.log(`Synced ${copies.length} worldgen content directories into public/.`);

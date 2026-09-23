// Validate the shipped region atlas and check that every style and scatter id it binds exists in
// the default style pack. Run after `tsdown` (imports the built kernels).
//
//   node scripts/validate-atlas.mjs [packs/default/world.atlas.json]

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateByKind } from '@bendyline/molen-schema';
import { resolveStylePackDocuments } from '@bendyline/molen-worldgen/kernel';
import '../dist/kernel.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const atlasPath = resolve(root, process.argv[2] ?? 'packs/default/world.atlas.json');
const packDir = resolve(root, '../worldgen/packs/default');

const parsed = validateByKind('region-atlas', JSON.parse(await readFile(atlasPath, 'utf8')));
if (!parsed.ok) {
  console.error(parsed.formatted);
  process.exit(1);
}
for (const notice of parsed.notices ?? [])
  console.warn(`notice: ${notice.path}: ${notice.message}`);
const atlas = parsed.value;
const pack = await resolveStylePackDocuments(
  JSON.parse(await readFile(resolve(packDir, 'stylepack.json'), 'utf8')),
  async (path) => JSON.parse(await readFile(resolve(packDir, path), 'utf8')),
);
const problems = [];
const checkStyle = (id, where) => {
  if (pack.archstyles[id] === undefined) problems.push(`${where}: unknown style ${id}`);
};
const checkScatter = (id, where) => {
  if (id !== undefined && pack.scatters[id] === undefined)
    problems.push(`${where}: unknown scatter ${id}`);
};
for (const region of atlas.regions) {
  region.bindings.buildings.forEach((rule, index) => {
    checkStyle(rule.style, `region ${region.id} rule ${index}`);
    for (const variant of rule.variants ?? [])
      checkStyle(variant.style, `region ${region.id} rule ${index} variant`);
  });
  if (region.bindings.default !== undefined)
    checkStyle(region.bindings.default, `region ${region.id} default`);
  checkScatter(region.bindings.scatter, `region ${region.id} scatter`);
}
atlas.default.buildings.forEach((rule, index) => {
  checkStyle(rule.style, `default rule ${index}`);
  for (const variant of rule.variants ?? [])
    checkStyle(variant.style, `default rule ${index} variant`);
});
if (atlas.default.style !== undefined) checkStyle(atlas.default.style, 'default style');
checkScatter(atlas.default.scatter, 'default scatter');
if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}
console.log(
  `Validated atlas ${atlas.id} (${atlas.regions.length} regions) against pack ${pack.id}@${pack.version}.`,
);

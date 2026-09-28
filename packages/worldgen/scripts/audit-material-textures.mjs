/** Read-only canonical graph bake audit. Prints JSON unless --out=<path> is explicitly supplied. */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bakeMatGraph, registerMaterialSchemas } from '@bendyline/molen-materials';
import { validateByKind } from '@bendyline/molen-schema';
import { formatJson } from './format-json.mjs';
import { auditBakedMaterialTextures } from './material-texture-audit.mjs';
import { MATERIAL_REPEAT_METERS } from './standard-materials.mjs';
import { writeIndex } from './structure-model-files.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const catalog = JSON.parse(
  await readFile(resolve(root, 'content/worldgen/source/material-library/catalog.json'), 'utf8'),
);
const files = (await readdir(resolve(root, 'content/worldgen/materials')))
  .filter((file) => file.endsWith('.matgraph.json'))
  .map((file) => `materials/${file}`)
  .sort();
if (JSON.stringify(files) !== JSON.stringify(catalog.entries.map((entry) => entry.path).sort()))
  throw new Error('Canonical material catalog does not exactly cover the graph files');
registerMaterialSchemas();
const materials = [];
for (const entry of catalog.entries) {
  if (JSON.stringify(entry.repeatMeters) !== JSON.stringify(MATERIAL_REPEAT_METERS[entry.key]))
    throw new Error(`Catalog repeat differs from authoring repeat: ${entry.key}`);
  const bytes = await readFile(resolve(root, 'content/worldgen', entry.path));
  const parsed = validateByKind('matgraph', JSON.parse(bytes));
  if (!parsed.ok) throw new Error(`${entry.key}: ${parsed.formatted}`);
  materials.push({
    id: entry.id,
    graphHash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    repeatMeters: entry.repeatMeters,
    uvMode: entry.uvMode,
    baked: bakeMatGraph(parsed.value),
  });
}
const report = auditBakedMaterialTextures(materials);
const serialized = `${formatJson(report)}\n`;
const destination = process.argv.find((arg) => arg.startsWith('--out='))?.slice(6);
if (destination === undefined) process.stdout.write(serialized);
else {
  if (!destination) throw new Error('--out requires a destination');
  const path = resolve(root, destination);
  await mkdir(dirname(path), { recursive: true });
  await writeIndex(path, serialized);
  console.log(JSON.stringify(report.summary));
}

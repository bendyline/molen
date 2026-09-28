/** Preserve the primary research and map evidence separately from the authored exterior. */

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { featureLines, fitMapFrame } from '../../worldgen-earth/scripts/structure-map-geometry.mjs';
import { biomeJson } from './format-json.mjs';
import { skopjeResearch } from './stone-bridge-skopje-model.mjs';
import { structureSourceDirectory } from './structure-source-paths.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check'))
  throw new Error(
    'Usage: node packages/worldgen/scripts/generate-stone-bridge-skopje.mjs [--check]',
  );
const readJson = async (path) => JSON.parse(await readFile(resolve(root, path), 'utf8'));
const catalog = await readJson('content/worldgen/source/next-1000/candidates.json');
const candidate = catalog.candidates.find((entry) => entry.id === skopjeResearch.id);
if (candidate?.wikidataId !== skopjeResearch.wikidataId)
  throw new Error('N0004 identity changed; the Skopje research must be reviewed before reuse.');
const osm = await readJson('content/earth/structures/evidence/osm-features.json');
const feature = osm.elements.find(
  (entry) => entry.type === 'way' && entry.id === 734159692 && entry.tags?.wikidata === 'Q1780883',
);
if (!feature)
  throw new Error('N0004 exact-identity OSM outline is absent from the evidence cache.');
const coordinates = featureLines(feature)[0]?.coordinates;
const frame = fitMapFrame(coordinates, [
  candidate.referenceCoordinate.longitude,
  candidate.referenceCoordinate.latitude,
]);
if (!frame) throw new Error('N0004 OSM outline cannot be fitted.');
const rounded = (number, decimals = 6) => Number(number.toFixed(decimals));
const evidence = {
  ...skopjeResearch,
  assetId: `molen.worldgen.structure.n0004_${skopjeResearch.key}`,
  mapEvidence: {
    source: 'https://www.openstreetmap.org/way/734159692',
    capturedAt: osm.capturedAt,
    attribution: osm.attribution,
    license: osm.license,
    sourceFeatureHash: `sha256:${createHash('sha256').update(JSON.stringify(feature)).digest('hex')}`,
    status: 'horizontal-map-evidence-only',
    anchor: frame.anchor.map((number) => rounded(number, 9)),
    headingRadians: frame.heading,
    headingConvention: 'Molen rotation about +Y; local +X points northeast, local +Z southeast.',
    outlineLengthMeters: rounded(frame.length),
    outlineWidthIncludingProjectionsMeters: rounded(frame.width),
    localOutlineXZ: coordinates
      .map(frame.toLocal)
      .map((point) => point.map((number) => rounded(number, 3))),
    wgs84Outline: coordinates,
    limitations: [
      'The outline is mapped evidence, not a measured elevation or survey certificate.',
      'The width includes cutwaters; it must never be used as the pedestrian deck width.',
      'The current mapped endpoints span218.9m; historical213.85m dimensions describe a different extent. The model uses current mapped endpoints.',
    ],
  },
};
const dir = structureSourceDirectory('n0004_stone_bridge_in_skopje');
for (const [name, body] of [
  ['research.json', biomeJson(evidence, resolve(dir, 'research.json'))],
]) {
  const path = resolve(dir, name);
  if (check) {
    if ((await readFile(path, 'utf8')).replaceAll('\r\n', '\n') !== body)
      throw new Error(`${path}: stale research; regenerate after review.`);
  } else {
    await mkdir(dir, { recursive: true });
    await writeFile(path, body);
  }
}
console.log(
  `N0004: primary research and map evidence ${check ? 'verified' : 'written'}; source geometry is maintained by generate-researched-bridges.mjs.`,
);

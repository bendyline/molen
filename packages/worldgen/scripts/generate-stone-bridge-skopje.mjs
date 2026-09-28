/** Prepare N0004's reproducible measured brief; no mesh is emitted without structural evidence. */
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { featureLines, fitMapFrame } from '../../worldgen-earth/scripts/structure-map-geometry.mjs';
import { biomeJson } from './format-json.mjs';
import { skopjeResearch } from './stone-bridge-skopje-model.mjs';

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
      'The historical length and current mapped endpoints require reconciliation before geometry fitting.',
    ],
  },
};
const dir = resolve(root, 'content/worldgen/source/next-1000/models/n0004_stone_bridge_in_skopje');
// This research-only generator must never replace a later artist or generator master.
try {
  await access(resolve(dir, 'models/source.glb'));
  throw new Error(
    'N0004 has a model master; migrate this research generator with a source-hash guard before writing.',
  );
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const readme = `# Stone Bridge in Skopje — N0004

Status: **research blocked; no 3D model produced**. Target: maximum fidelity.

[research.json](research.json) records the published dimensions, dated photo observations, source URLs, conflicts, mapped outline and review requirements. The original catalog identity Q1780883 is retained. No model, preview, runtime registration or placement is claimed.

## Established evidence

The national tourism publication gives a historical length of 213.85 m and deck width of 6.33 m. Field studies describe unequal openings and altered or buried ends. The 2023 paper documents a level central deck, descending approaches and asymmetric restored piers; its 2016 photographs were visually inspected. These sources do not provide a complete current measured elevation.

The exact-identity OSM outline has a fitted length of ${frame.length.toFixed(2)} m and total projected width of ${frame.width.toFixed(2)} m. **That width includes cutwaters and is not the deck width.** Local +X points northeast and +Z southeast. No vertical datum is established. OSM-derived coordinates are © OpenStreetMap contributors, ODbL 1.0.

## Required before modeling

${skopjeResearch.blockers.map((blocker) => `- **${blocker.id}:** ${blocker.required}`).join('\n')}

Do not construct thirteen equally spaced semicircles or apply the footprint width to the deck. The historical and current counts describe different extents and must be reconciled. Proposed QA camera coordinates in the JSON are authoring suggestions, not surveyed levels or completed captures.

## Sources and reproducibility

${skopjeResearch.sources.map((source) => `- [${source.id}](${source.url}) — ${source.observed}`).join('\n')}

Source publications and photographs are consulted, not redistributed. The editable research contract is \`packages/worldgen/scripts/stone-bridge-skopje-model.mjs\`; rebuild this brief with \`node packages/worldgen/scripts/generate-stone-bridge-skopje.mjs\`, or verify with \`--check\`. The generator uses the cached OSM feature and pins its SHA-256. It refuses to write if a model master already exists.

A future mesh generator must protect artist-edited source bytes, reuse Molen's mesh/GLB pipeline, record its dimensions and limitations, and pass source/runtime hash-bound visual, maximum-fidelity and geographic reviews before runtime activation.
`;
for (const [name, body] of [
  ['research.json', biomeJson(evidence, resolve(dir, 'research.json'))],
  ['README.md', readme],
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
  `N0004: measured research brief ${check ? 'verified' : 'written'}; ${skopjeResearch.blockers.length} structural evidence blockers, no mesh emitted.`,
);

/** Preserve independently sampled Polish ground and surface heights in their explicit datum. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { structureSourcePath } from '../../../packages/worldgen/scripts/structure-source-paths.mjs';
import { parseArcGrid, sampleArcGrid } from './arc-grid.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cache = resolve(root, '.artifacts/bridge-terrain/poland');
const output = resolve(root, 'content/earth/structures/evidence/bridge-terrain/gugik');
const folder = 'n0029_poniatowski_bridge';
const specBytes = await readFile(structureSourcePath(folder, 'spec.json'));
const spec = JSON.parse(specBytes);
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const { anchor, heading } = spec.geographicProposal;
const radius = 6378137,
  factor = Math.cos((anchor[1] * Math.PI) / 180);
const center = [
  ((anchor[0] * Math.PI) / 180) * radius * factor,
  -radius * Math.asinh(Math.tan((anchor[1] * Math.PI) / 180)) * factor,
];
const grids = {},
  sources = [];
for (const kind of ['dtm', 'dsm', 'dsm-fine']) {
  const bytes = await readFile(resolve(cache, `poniatowski-${kind}.asc`));
  grids[kind] = parseArcGrid(bytes.toString('utf8'));
  sources.push({
    kind,
    path: `.artifacts/bridge-terrain/poland/poniatowski-${kind}.asc`,
    hash: hash(bytes),
    url: (await readFile(resolve(cache, `${kind}-request-url.txt`), 'utf8')).trim(),
    verticalDatum: 'PL-EVRF2007-NH',
    nativeSourceResolutionMeters: 1,
    returnedGroundSpacingMeters: [grids[kind].dx * factor, grids[kind].dy * factor],
  });
}
const size = 1020,
  resolution = 511,
  origin = center.map((value) => value - size / 2);
const heights = [];
for (let row = 0; row < resolution; row++)
  for (let col = 0; col < resolution; col++)
    heights.push(
      sampleArcGrid(grids.dtm, (origin[0] + col * 2) / factor, -(origin[1] + row * 2) / factor),
    );
const valid = heights.filter((value) => value !== null);
const document = {
  format: 'molen/bridge-terrain-evidence@1',
  candidateId: 'N0029',
  title: spec.title,
  modelFolder: folder,
  specHash: hash(specBytes),
  anchor,
  heading,
  factor,
  worldCenter: center,
  worldOrigin: origin,
  size,
  resolution,
  heightRange: valid.reduce(
    ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
    [Infinity, -Infinity],
  ),
  anchorElevation: sampleArcGrid(grids.dtm, center[0] / factor, -center[1] / factor),
  renderOriginElevation: 77,
  heights,
  noDataCount: heights.length - valid.length,
  sources,
  reviewHalfLength: 251.87,
  reviewDeckHeight: 20,
  reviewCameraRange: 610,
  reviewCameraFov: 55,
  reviewAdditionalCameras: [
    { name: 'west-approach', position: [-300, 45, 65], lookAt: [-252, 17, 0] },
    { name: 'east-approach', position: [300, 45, -65], lookAt: [252, 17, 0] },
  ],
  reviewProbePoints: [-251.37, -216.58, -152.59, -78.51, 0, 81.47, 147.19, 211.61, 251.37].map(
    (x) => [x, 6],
  ),
  reviewProbeBasis:
    'Road-lane rays at native Z 6 m, avoiding tram tracks. The bridge ends are elevated over lower riverbank roads; ground clearance at these ends is not a deck disconnection measurement. Independent NMPT road-lane profiles constrain deck height.',
  sourceLabel: 'GUGiK 1 m NMT ground, PL-EVRF2007-NH (2 m review grid)',
  verticalDatum: 'PL-EVRF2007-NH',
  attribution: 'Główny Urząd Geodezji i Kartografii (GUGiK), national NMT/NMPT WCS',
  attributionUrl: 'https://www.geoportal.gov.pl/pl/dane/numeryczny-model-terenu-nmt/',
  method:
    'Original official DTM grid reprojected by the WCS to EPSG:3857, then bilinearly sampled at returned cell centers. No bridge fitting, channel carving, datum conversion or terrain flattening. Independent surface-model samples are preserved separately; the DSM is not rendered as duplicate bridge terrain.',
  references: [
    'https://www.geoportal.gov.pl/pl/usluga/uslugi-pobierania-wcs/',
    'https://www.geoportal.gov.pl/pl/dane/numeryczny-model-terenu-nmt/',
    'https://www.geoportal.gov.pl/pl/dane/numeryczny-model-pokrycia-terenu-nmpt/',
  ],
  limitations: [
    'The WCS responses do not state survey epoch or point-level accuracy; centimetre encoding is not centimetre accuracy.',
    'DTM water surfaces are modeled elevations, not bathymetry. No historical Vistula gauge zero is converted.',
    'DSM includes the road deck, vegetation and vehicles. Thin pier tips and concealed bearings cannot be isolated reliably from its 1 m cells.',
  ],
};
await mkdir(output, { recursive: true });
await writeFile(resolve(output, 'N0029.json'), `${JSON.stringify(document, null, 2)}\n`);
const frameBytes = await readFile(structureSourcePath(folder, 'map-frame.json'));
const frame = JSON.parse(frameBytes);
if (
  JSON.stringify(frame.anchor) !== JSON.stringify(anchor) ||
  Math.abs(frame.heading - heading) > 1e-9
)
  throw new Error('Source frame and current proposal disagree');
const sample = (kind, x, z) => {
  const east = center[0] + Math.cos(heading) * x + Math.sin(heading) * z;
  const south = center[1] - Math.sin(heading) * x + Math.cos(heading) * z;
  const height = sampleArcGrid(grids[kind], east / factor, -south / factor);
  return height === null ? null : Number(height.toFixed(4));
};
const station = (x) => {
  const samples = [-14, -12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12, 14].map((z) => ({
    z,
    dtm: sample('dtm', x, z),
    dsm: sample('dsm', x, z),
  }));
  const lanes = samples.filter((p) => [4, 6, 8].includes(Math.abs(p.z))).map((p) => p.dsm);
  const sorted = lanes.filter((h) => h !== null).sort((a, b) => a - b);
  return {
    x,
    roadLaneMedian: sorted.length === 6 ? (sorted[2] + sorted[3]) / 2 : null,
    roadLaneRange: sorted.length ? [sorted[0], sorted.at(-1)] : null,
    centerlineSurface: sample('dsm', x, 0),
    samples,
  };
};
const profile = {
  format: 'molen/bridge-surface-evidence@1',
  candidateId: 'N0029',
  anchor,
  heading,
  mapFrameHash: hash(frameBytes),
  verticalDatum: 'PL-EVRF2007-NH',
  sources,
  method:
    'Independent official DTM and DSM in the same explicit height datum. Every raw lane sample is retained. Median of six road-lane points at native Z ±4/±6/±8 m is a robust diagnostic, not a surveyed design grade. No model-source height is used in these samples.',
  stations: [...new Set([-251.87, 251.87, ...Array.from({ length: 121 }, (_, i) => -300 + i * 5)])]
    .sort((a, b) => a - b)
    .map(station),
  piers: frame.geometry.piers.map((pier, i) => ({
    number: i + 1,
    osmWay: pier.osmWay,
    center: pier.center,
    road: station(pier.center[0]),
    tips: [-1, 1].map((side) => {
      const tip = pier.points.reduce((a, b) => (a[1] * side > b[1] * side ? a : b));
      return {
        side,
        tip,
        samples: [-1, 0, 1].flatMap((dx) =>
          [-0.5, 0, 0.5].map((dz) => {
            const x = pier.center[0] + dx,
              z = tip[1] + dz;
            return {
              x,
              z,
              dtm: sample('dtm', x, z),
              dsm: sample('dsm', x, z),
              dsmFine: sample('dsm-fine', x, z),
            };
          }),
        ),
      };
    }),
  })),
  waterSamples: [-180, -140, -100, -60, -20, 20, 60].flatMap((x) =>
    [-60, -40, 40, 60].map((z) => ({
      x,
      z,
      dtm: sample('dtm', x, z),
      dsm: sample('dsm', x, z),
    })),
  ),
  bankStructures: frame.geometry.bankStructures.map((shape) => {
    const points = shape.points.slice(0, -1);
    const lo = [0, 1].map((k) => Math.min(...points.map((p) => p[k])));
    const hi = [0, 1].map((k) => Math.max(...points.map((p) => p[k])));
    return {
      osmWay: shape.osmWay,
      bounds: [lo, hi],
      samples: [lo[0], (lo[0] + hi[0]) / 2, hi[0]].flatMap((x) =>
        [lo[1], (lo[1] + hi[1]) / 2, hi[1]].map((z) => ({
          x,
          z,
          ground: sample('dtm', x, z),
          surface: sample('dsm-fine', x, z),
        })),
      ),
    };
  }),
  limitations: document.limitations,
};
await writeFile(
  resolve(output, 'N0029-deck-profile.json'),
  `${JSON.stringify(profile, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      candidateId: 'N0029',
      valid: valid.length,
      noData: document.noDataCount,
      anchorElevation: document.anchorElevation,
      sourceHashes: sources.map((source) => source.hash),
    },
    null,
    2,
  ),
);

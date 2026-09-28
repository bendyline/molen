/** Preserve current GSI PNG elevations, including river no-data, for Sanjō Ōhashi. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { structureSourcePath } from '../../../packages/worldgen/scripts/structure-source-paths.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = resolve(root, 'content/earth/structures/evidence/bridge-terrain/gsi');
const folder = 'n0021_sanjo_ohashi_bridge';
const specBytes = await readFile(structureSourcePath(folder, 'spec.json'));
const spec = JSON.parse(specBytes);
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const { anchor, heading } = spec.geographicProposal;
const factor = Math.cos((anchor[1] * Math.PI) / 180),
  radius = 6378137;
const center = [
  ((anchor[0] * Math.PI) / 180) * radius * factor,
  -radius * Math.asinh(Math.tan((anchor[1] * Math.PI) / 180)) * factor,
];
const size = 192,
  resolution = 193,
  origin = center.map((v) => v - size / 2);
const tiles = new Map(),
  sources = [];
await mkdir(output, { recursive: true });
for (const x of [114968, 114969])
  for (const y of [51912, 51913]) {
    const path = `.artifacts/bridge-terrain/gsi/dem1a-17-${x}-${y}.png`;
    const bytes = await readFile(resolve(root, path));
    const png = PNG.sync.read(bytes);
    if (png.width !== 256 || png.height !== 256) throw new Error(`Invalid GSI tile ${path}`);
    const heights = [];
    for (let i = 0; i < 256 * 256; i++) {
      const v = png.data[i * 4] * 65536 + png.data[i * 4 + 1] * 256 + png.data[i * 4 + 2];
      heights.push(v === 8388608 ? null : (v > 8388608 ? v - 16777216 : v) * 0.01);
    }
    tiles.set(`${x}/${y}`, heights);
    sources.push({
      path,
      hash: hash(bytes),
      url: `https://cyberjapandata.gsi.go.jp/xyz/dem1a_png/17/${x}/${y}.png`,
    });
  }
const coordinate = (x, z) => [
  ((x / factor / radius) * 180) / Math.PI,
  (Math.atan(Math.sinh(-z / factor / radius)) * 180) / Math.PI,
];
const nativeCoordinate = (x, z) =>
  coordinate(
    center[0] + Math.cos(heading) * x + Math.sin(heading) * z,
    center[1] - Math.sin(heading) * x + Math.cos(heading) * z,
  );
function sample(lon, lat) {
  const n = 2 ** 17 * 256;
  // GSI pixels encode elevations at their centers, not their upper-left corners.
  const px = ((lon + 180) / 360) * n - 0.5;
  const py = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n - 0.5;
  const ix = Math.floor(px),
    iy = Math.floor(py),
    fx = px - ix,
    fy = py - iy;
  let value = 0;
  for (const [dx, dy, weight] of [
    [0, 0, (1 - fx) * (1 - fy)],
    [1, 0, fx * (1 - fy)],
    [0, 1, (1 - fx) * fy],
    [1, 1, fx * fy],
  ]) {
    if (weight <= 1e-12) continue;
    const x = ix + dx,
      y = iy + dy,
      tx = Math.floor(x / 256),
      ty = Math.floor(y / 256);
    const tile = tiles.get(`${tx}/${ty}`);
    if (!tile) throw new Error(`Uncached GSI tile ${tx}/${ty}`);
    const height = tile[(y - ty * 256) * 256 + x - tx * 256];
    if (height === null) return null;
    value += height * weight;
  }
  return value;
}
const heights = [];
for (let row = 0; row < resolution; row++)
  for (let col = 0; col < resolution; col++)
    heights.push(sample(...coordinate(origin[0] + col, origin[1] + row)));
const valid = heights.filter((h) => h !== null);
const stations = [];
for (let x = -50; x <= 50; x += 1)
  for (const z of [-6, -3, 0, 3, 6])
    stations.push({
      x,
      z,
      coordinate: nativeCoordinate(x, z),
      elevation: sample(...nativeCoordinate(x, z)),
    });
const bankReference = {
  nativeStation: [-40, 0],
  anchor: nativeCoordinate(-40, 0),
  modelHeight: 4.55,
  elevation: sample(...nativeCoordinate(-40, 0)),
  basis:
    'GSI DEM1A ground on the west road plateau, 3.35 m beyond the published 73.3 m bridge endpoint. Native endpoint road height is 4.55 m. Fine DEM river no-data is not a zero or a surface estimate.',
};
const document = {
  format: 'molen/bridge-terrain-evidence@1',
  candidateId: 'N0021',
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
  heightRange: [Math.min(...valid), Math.max(...valid)],
  anchorElevation: sample(...anchor),
  // Rebase rendering only. This is not a riverbed measurement or a placement height.
  renderOriginElevation: 37,
  heights,
  sources,
  noDataCount: heights.length - valid.length,
  reviewHalfLength: 36.65,
  reviewDeckHeight: 5.07,
  reviewCameraRange: 105,
  reviewProbePoints: [-36.15, -28, -18, 0, 18, 28, 36.15].map((x) => [x, 2]),
  reviewProbeBasis:
    'Road-lane probes avoid center markings; unknown river cells remain null and do not count as bank fit.',
  sourceLabel: 'GSI DEM1A laser terrain; pale gaps are missing river data',
  verticalDatum:
    'Japanese national elevations relative to Tokyo Bay mean sea level; PNG service current at retrieval. Source survey epoch is not exposed by these tiles.',
  attribution: 'Geospatial Information Authority of Japan, GSI Maps elevation tiles',
  attributionUrl: 'https://maps.gsi.go.jp/development/ichiran.html',
  method:
    'Current DEM1A PNG signed-centimetre pixels decoded with explicit 128,0,0 no-data. Bilinear interpolation at pixel centers across tile boundaries; any contributing no-data pixel preserves null. No coarser filling, channel carving, flattening or bridge fitting. Terrain review omits triangles touching null vertices and its host sampler rejects null samples.',
  references: [
    'https://maps.gsi.go.jp/development/demtile.html',
    'https://maps.gsi.go.jp/development/hyokochi.html',
    'https://maps.gsi.go.jp/development/ichiran.html',
    'https://www.gsi.go.jp/sokuchikijun/datum-main',
  ],
};
const profile = {
  format: 'molen/bridge-bank-evidence@1',
  candidateId: 'N0021',
  specHash: hash(specBytes),
  sources,
  bankReference,
  proposedOrigin: bankReference.elevation - bankReference.modelHeight,
  stations,
  limitations: [
    'GSI laser terrain excludes the bridge and cannot measure submerged riverbed. River no-data remains unknown.',
    'Pixel values are centimetres, but published DEM1A accuracy is about 0.3 m with ground returns and may be 2 m without them.',
    'This reference places the road relative to an independent nearby ground surface; it does not establish surveyed footing depth.',
    'Legacy TXT elevations stopped updating in October 2024 and are retained only as diagnostic evidence, not authoritative current samples.',
  ],
};
await writeFile(resolve(output, 'N0021.json'), `${JSON.stringify(document, null, 2)}\n`);
await writeFile(
  resolve(output, 'N0021-bank-profile.json'),
  `${JSON.stringify(profile, null, 2)}\n`,
);
console.log(
  JSON.stringify(
    {
      valid: valid.length,
      noData: document.noDataCount,
      anchorElevation: document.anchorElevation,
      bankReference,
      proposedOrigin: profile.proposedOrigin,
    },
    null,
    2,
  ),
);

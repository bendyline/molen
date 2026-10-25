/** Preserve the viewer's public Terrarium terrain for selected local Qualla structures.
 * Acquires evidence only when explicitly run; ordinary model builds remain offline.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng16, encodePng16 } from '@bendyline/molen-terrain/kernel';
import pngjs from 'pngjs';
import {
  structureCatalogEntries,
  structureCatalogMatches,
} from '../../../content/worldgen/source/qualla-structures/work-ownership.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const json = async (p) => JSON.parse(await readFile(resolve(root, p), 'utf8'));
const batchName = process.argv.find((a) => a.startsWith('--batch='))?.slice(8) ?? 'qualla-001';
if (!/^qualla-\d{3}$/.test(batchName)) throw Error('Invalid batch name');
const batch = await json(`content/worldgen/source/qualla-structures/batches/${batchName}.json`);
const structures = (
  await readFile(
    resolve(root, 'content/worldgen/source/qualla-structures/structures.jsonl'),
    'utf8',
  )
)
  .trim()
  .split('\n')
  .map(JSON.parse);
const reserved = structureCatalogEntries(
  await json('content/worldgen/source/structure-catalog/candidates.json'),
  await json('content/worldgen/source/structure-catalog/collections.json'),
);
const ids = process.argv
  .find((a) => a.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (!ids?.length)
  throw Error('Specify --ids=QS-...; this is a targeted acquisition, not a model build.');
const offline = process.argv.includes('--offline');
const hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
const cache = resolve(root, '.artifacts/qualla-terrain');
await mkdir(cache, { recursive: true });
for (const id of ids) {
  const entry = batch.entries.find((e) => e.structureId === id);
  if (!entry?.sourcePath) throw Error(`No local source bundle: ${id}`);
  const target = structures.find((s) => s.id === id);
  if (!target || structureCatalogMatches(target, reserved, entry.modelIdentity).length)
    throw Error(`Not available for local authoring: ${id}`);
  const dir = resolve(root, entry.sourcePath),
    frame = JSON.parse(await readFile(resolve(dir, 'map-frame.json'))),
    spec = JSON.parse(await readFile(resolve(dir, 'spec.json')));
  const [lon, lat] = frame.anchor,
    rad = Math.PI / 180,
    radius = 6378137,
    zoom = 15,
    pixels = 256 * 2 ** zoom,
    circumference = 2 * Math.PI * radius,
    factor = Math.cos(lat * rad);
  const worldCenter = [
    lon * rad * radius * factor,
    -radius * Math.asinh(Math.tan(lat * rad)) * factor,
  ];
  const extent = Math.max(128, Math.ceil((Math.max(spec.size[0], spec.size[2]) * 1.6) / 64) * 64),
    resolution = 65,
    step = extent / (resolution - 1),
    origin = [-extent / 2, -extent / 2];
  const localToWorld = (x, z) => [
    worldCenter[0] + Math.cos(frame.heading) * x + Math.sin(frame.heading) * z,
    worldCenter[1] - Math.sin(frame.heading) * x + Math.cos(frame.heading) * z,
  ];
  const pixelAt = (x, z) => [
    (x / factor / circumference + 0.5) * pixels - 0.5,
    (z / factor / circumference + 0.5) * pixels - 0.5,
  ];
  const corners = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ].map(([x, z]) => pixelAt(...localToWorld((x * extent) / 2, (z * extent) / 2)));
  const bounds = [0, 1].map((k) => [
    Math.floor(Math.min(...corners.map((p) => p[k])) / 256),
    Math.floor((Math.max(...corners.map((p) => p[k])) + 1) / 256),
  ]);
  const tiles = new Map(),
    sources = [];
  for (let x = bounds[0][0]; x <= bounds[0][1]; x++)
    for (let y = bounds[1][0]; y <= bounds[1][1]; y++) {
      const file = resolve(cache, `${zoom}-${x}-${y}.png`),
        url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
      let bytes = await readFile(file).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
      if (!bytes) {
        if (offline) throw Error(`Missing cached tile ${url}`);
        const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (!response.ok) throw Error(`${response.status} ${url}`);
        bytes = Buffer.from(await response.arrayBuffer());
        await writeFile(file, bytes);
      }
      const img = pngjs.PNG.sync.read(bytes);
      if (img.width !== 256 || img.height !== 256) throw Error('Unexpected tile size');
      tiles.set(`${x}/${y}`, img);
      sources.push({ url, sha256: hash(bytes), zoom, x, y });
    }
  const height = (x, y) => {
    const img = tiles.get(`${Math.floor(x / 256)}/${Math.floor(y / 256)}`);
    if (!img) throw Error('Uncovered sample');
    const p = ((y % 256) * 256 + (x % 256)) * 4;
    return img.data[p] * 256 + img.data[p + 1] + img.data[p + 2] / 256 - 32768;
  };
  const sample = (x, z) => {
    const [px, py] = pixelAt(...localToWorld(x, z)),
      ix = Math.floor(px),
      iy = Math.floor(py),
      u = px - ix,
      v = py - iy;
    return (
      height(ix, iy) * (1 - u) * (1 - v) +
      height(ix + 1, iy) * u * (1 - v) +
      height(ix, iy + 1) * (1 - u) * v +
      height(ix + 1, iy + 1) * u * v
    );
  };
  const contact = frame.terrainContact ?? { local: [0, 0], modelY: 0 },
    datum = Number((sample(...contact.local) - contact.modelY).toFixed(4));
  const heights = Array.from({ length: resolution }, (_, row) =>
    Array.from({ length: resolution }, (_, col) =>
      Number(sample(origin[0] + col * step, origin[1] + row * step).toFixed(4)),
    ),
  );
  const flat = heights.flat(),
    min = Math.floor(Math.min(...flat) - datum - 0.5),
    max = Math.ceil(Math.max(...flat) - datum + 0.5);
  const grid = {
    format: 'molen/structure-relief-grid@1',
    candidateId: id,
    anchor: frame.anchor,
    heading: frame.heading,
    origin,
    stepMeters: step,
    size: [resolution, resolution],
    modelDatumElevationMeters: datum,
    contact,
    verticalDatum:
      'Terrarium source mean-sea-level composite; host-relative visualization, not a surveyed datum',
    sourcePixelGroundSpacing: (circumference * factor) / pixels,
    heightsMeters: heights,
    sources,
    attribution: 'Mapzen terrain tiles; NASA/USGS and other open elevation sources',
    attributionUrl: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    method:
      'Unmodified Terrarium pixels bilinearly sampled at pixel centers in the signed local model frame. Heights are not flattened or fitted to the building.',
    limitations: [
      'Pixel spacing is not native DEM resolution or vertical accuracy. Building/vegetation returns and urban interpolation may be present.',
      'Terrain-contact runtime placement samples the host at the declared reference point. Compatibility with other terrain datasets remains host-dependent.',
    ],
  };
  const descriptor = {
    format: 'molen/terrain@2',
    name: `${entry.name} source terrain review`,
    origin,
    chunkSize: extent,
    tileResolution: resolution,
    gridSize: [1, 1],
    height: { min, max },
    tiles: { heightUrl: 'terrain-review.height.png' },
    layers: [{ name: 'review-ground', color: '#aaa59a', tiling: 1 }],
    lod: { levels: 1, distanceBands: [], skirts: false },
    streaming: { loadRadius: 1, unloadRadius: 2, maxConcurrentLoads: 1, maxResidentTiles: 1 },
    collision: { enabled: true },
  };
  const png = encodePng16({
    width: resolution,
    height: resolution,
    data: Float32Array.from(flat, (h) => (h - datum - min) / (max - min)),
  });
  const decoded = decodePng16(png);
  for (let i = 0; i < flat.length; i++) {
    const error = Math.abs(min + decoded.data[i] * (max - min) + datum - flat[i]);
    if (error > (max - min) / 65535 + 0.00001)
      throw Error(`Terrain PNG round-trip error: ${error}m`);
  }
  grid.reviewHeightfieldHash = hash(png);
  for (const [name, value] of [
    ['terrain-grid.json', `${JSON.stringify(grid, null, 2)}\n`],
    ['terrain-review.terrain.json', `${JSON.stringify(descriptor, null, 2)}\n`],
    ['terrain-review.height.png', png],
  ])
    await writeFile(resolve(dir, name), value);
  const contacts = frame.features
    .flatMap((f) => f.rings.flat())
    .map(([x, z]) => sample(x, z) - datum);
  console.log(
    JSON.stringify({
      id,
      datum,
      footprintRelativeRange: [Math.min(...contacts), Math.max(...contacts)],
      sources: sources.length,
    }),
  );
}

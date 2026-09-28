/** Preserve real, unmodified elevation samples for bridge placement review. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pngjs from 'pngjs';
import {
  knownSourceEntries,
  structureSourcePath,
} from '../../../packages/worldgen/scripts/structure-source-paths.mjs';

const { PNG } = pngjs;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const content = resolve(root, 'content');
const cache = resolve(root, '.artifacts/bridge-terrain');
const output = resolve(content, 'earth/structures/evidence/bridge-terrain');
const ids = (
  process.argv.find((arg) => arg.startsWith('--ids='))?.slice(6) ?? 'N0011,N0012,N0014'
).split(',');
const offline = process.argv.includes('--offline');
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const radius = 6378137;
const zoom = 15;
const pixels = 256 * 2 ** zoom;
const circumference = 2 * Math.PI * radius;
await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });

for (const id of ids) {
  if (!/^N\d{4}$/.test(id)) throw new Error(`Invalid candidate id ${id}`);
  const folder = knownSourceEntries().find((entry) => entry.candidateId === id)?.key;
  if (!folder) throw new Error(`No authored source for ${id}`);
  const specBytes = await readFile(structureSourcePath(folder, 'spec.json'));
  const spec = JSON.parse(specBytes);
  const { anchor, heading } = spec.geographicProposal;
  const factor = Math.cos((anchor[1] * Math.PI) / 180);
  const center = [
    ((anchor[0] * Math.PI * radius) / 180) * factor,
    -radius * Math.asinh(Math.tan((anchor[1] * Math.PI) / 180)) * factor,
  ];
  const size = id === 'N0012' ? 128 : 512;
  const resolution = 129;
  const origin = center.map((value) => value - size / 2);
  const pixelAt = (x, z) => [
    (x / factor / circumference + 0.5) * pixels - 0.5,
    (z / factor / circumference + 0.5) * pixels - 0.5,
  ];
  const first = pixelAt(...origin);
  const last = pixelAt(origin[0] + size, origin[1] + size);
  const tiles = new Map();
  const sources = [];
  for (let x = Math.floor(first[0] / 256); x <= Math.floor((last[0] + 1) / 256); x++) {
    for (let y = Math.floor(first[1] / 256); y <= Math.floor((last[1] + 1) / 256); y++) {
      const file = `${zoom}-${x}-${y}.png`;
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
      let bytes = await readFile(resolve(cache, file)).catch(() => undefined);
      if (!bytes) {
        if (offline) throw new Error(`Missing cached tile ${file}`);
        const response = await fetch(url, { signal: AbortSignal.timeout(45000) });
        if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
        bytes = Buffer.from(await response.arrayBuffer());
        await writeFile(resolve(cache, file), bytes);
      }
      const image = PNG.sync.read(bytes);
      if (image.width !== 256 || image.height !== 256)
        throw new Error(`Unexpected tile size ${file}`);
      tiles.set(`${x}/${y}`, image);
      sources.push({ url, sha256: hash(bytes), zoom, x, y });
    }
  }
  function pixelHeight(x, y) {
    const image = tiles.get(`${Math.floor(x / 256)}/${Math.floor(y / 256)}`);
    if (!image) throw new Error(`Uncovered pixel ${x}/${y}`);
    const offset = ((y % 256) * 256 + (x % 256)) * 4;
    return image.data[offset] * 256 + image.data[offset + 1] + image.data[offset + 2] / 256 - 32768;
  }
  function sample(x, z) {
    const [px, py] = pixelAt(x, z);
    const ix = Math.floor(px),
      iy = Math.floor(py),
      u = px - ix,
      v = py - iy;
    return (
      pixelHeight(ix, iy) * (1 - u) * (1 - v) +
      pixelHeight(ix + 1, iy) * u * (1 - v) +
      pixelHeight(ix, iy + 1) * (1 - u) * v +
      pixelHeight(ix + 1, iy + 1) * u * v
    );
  }
  const heights = [];
  for (let row = 0; row < resolution; row++) {
    for (let col = 0; col < resolution; col++) {
      heights.push(
        Number(
          sample(
            origin[0] + (col * size) / (resolution - 1),
            origin[1] + (row * size) / (resolution - 1),
          ).toFixed(4),
        ),
      );
    }
  }
  const document = {
    format: 'molen/bridge-terrain-evidence@1',
    candidateId: id,
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
    sourcePixelGroundSpacing: (circumference * factor) / pixels,
    heightRange: [Math.min(...heights), Math.max(...heights)],
    anchorElevation: sample(...center),
    heights,
    sources,
    attribution:
      'Mapzen; source terrain includes NASA/USGS SRTM and other open elevation datasets.',
    attributionUrl: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md',
    encodingReference: 'https://github.com/tilezen/joerd/blob/master/docs/formats.md',
    method:
      'Original Terrarium RGB decoded to metres, bilinearly sampled at pixel centers into a metric world grid. No flattening, bridge removal, valley carving or model-based height correction.',
    limitations: [
      'Tile pixel spacing and review mesh spacing are not native DEM source resolution or vertical accuracy.',
      'Coarse source terrain can smooth narrow valleys or include bridge/building/vegetation returns. These are observed host-terrain samples, not surveyed riverbed or abutment elevations.',
      'A visual mismatch must remain a failed terrain-fit review until supported placement or source-terrain corrections resolve it.',
    ],
  };
  await writeFile(resolve(output, `${id}.json`), `${JSON.stringify(document, null, 2)}\n`);
  console.log(
    `${id}: ${resolution}×${resolution}, ${size} m, anchor ${document.anchorElevation.toFixed(3)} m, ${sources.length} source tiles`,
  );
}

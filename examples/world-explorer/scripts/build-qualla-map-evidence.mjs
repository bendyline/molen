/** Acquire local map research for explicitly selected Qualla targets. Curated source frames remain a separate review. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  structureCatalogEntries,
  structureCatalogMatches,
} from '../../../content/worldgen/source/qualla-structures/work-ownership.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const json = (p) => JSON.parse(fs.readFileSync(path.resolve(root, p)));
const ids = process.argv
  .find((x) => x.startsWith('--ids='))
  ?.slice(6)
  .split(',');
if (!ids?.length)
  throw Error('Explicit --ids=QS-... required; this is targeted evidence acquisition.');
const batch = json('content/worldgen/source/qualla-structures/batches/qualla-001.json');
const targets = fs
  .readFileSync(
    path.join(root, 'content/worldgen/source/qualla-structures/structures.jsonl'),
    'utf8',
  )
  .trim()
  .split('\n')
  .map(JSON.parse);
const reserved = structureCatalogEntries(
  json('content/worldgen/source/structure-catalog/candidates.json'),
  json('content/worldgen/source/structure-catalog/collections.json'),
);
const qualla = path.resolve(
  root,
  process.argv.find((x) => x.startsWith('--qualla='))?.slice(9) ?? '../qualla-internal',
);
const source = process.argv.find((x) => x.startsWith('--source='))?.slice(9);
if (!source)
  throw Error(
    'Supply --source=<available PMTiles URL> from https://maps.protomaps.com/builds/. Daily archives expire; curated map frames remain offline source inputs.',
  );
const center = process.argv
  .find((x) => x.startsWith('--center='))
  ?.slice(9)
  .split(',')
  .map(Number);
if (center && (ids.length !== 1 || center.length !== 2 || !center.every(Number.isFinite)))
  throw Error('--center=longitude,latitude requires one target and finite coordinates.');
const req = createRequire(new URL('../../../packages/terrain/package.json', import.meta.url));
const { PMTiles } = req('pmtiles'),
  { VectorTile } = req('@mapbox/vector-tile'),
  Pbf = req('pbf').default ?? req('pbf'),
  clipping = req('polygon-clipping');
const archive = new PMTiles(source),
  header = await archive.getHeader();
const out = path.join(root, '.artifacts/qualla-batch');
fs.mkdirSync(out, { recursive: true });
for (const id of ids) {
  const e = batch.entries.find((e) => e.structureId === id),
    target = targets.find((t) => t.id === id);
  if (!e || !target || structureCatalogMatches(target, reserved, e.modelIdentity).length)
    throw Error(`Not available for local authoring: ${id}`);
  const refs = json(`content/worldgen/source/qualla-structures/references/${id}.json`);
  const article = JSON.parse(fs.readFileSync(path.resolve(qualla, refs.stories[0].sourcePath)));
  const { lat, lng } = article.location.coordinates,
    [lon, latitude] = center ?? [lng, lat];
  const z = header.maxZoom,
    n = 2 ** z,
    tx = Math.floor(((lon + 180) / 360) * n),
    ty = Math.floor(((1 - Math.asinh(Math.tan((latitude * Math.PI) / 180)) / Math.PI) / 2) * n),
    features = new Map();
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const data = await archive.getZxy(z, tx + dx, ty + dy);
      if (!data) continue;
      const tile = new VectorTile(new Pbf(new Uint8Array(data.data)));
      for (const layerName of ['buildings', 'pois']) {
        const layer = tile.layers[layerName];
        if (!layer) continue;
        for (let i = 0; i < layer.length; i++) {
          const f = layer.feature(i),
            geo = f.toGeoJSON(tx + dx, ty + dy, z);
          if (!['Point', 'Polygon', 'MultiPolygon'].includes(geo.geometry.type)) continue;
          const points =
            geo.geometry.type === 'Point'
              ? [geo.geometry.coordinates]
              : geo.geometry.coordinates.flat(geo.geometry.type === 'MultiPolygon' ? 2 : 1);
          const distance = Math.min(
            ...points.map((p) =>
              Math.hypot(
                (p[0] - lon) * 111320 * Math.cos((latitude * Math.PI) / 180),
                (p[1] - latitude) * 111320,
              ),
            ),
          );
          if (distance > 350) continue;
          const key = layerName + '/' + f.id,
            previous = features.get(key);
          if (
            previous &&
            ['Polygon', 'MultiPolygon'].includes(geo.geometry.type) &&
            ['Polygon', 'MultiPolygon'].includes(previous.geometry.type)
          ) {
            const union = clipping.union(previous.geometry.coordinates, geo.geometry.coordinates);
            previous.geometry =
              union.length === 1
                ? { type: 'Polygon', coordinates: union[0] }
                : { type: 'MultiPolygon', coordinates: union };
            previous.distance = Math.min(previous.distance, distance);
          } else if (!previous)
            features.set(key, {
              id: key,
              properties: f.properties,
              geometry: geo.geometry,
              distance,
            });
        }
      }
    }
  const result = {
    format: 'molen/qualla-map-extract@1',
    source,
    zoom: z,
    articleCoordinate: [lng, lat],
    researchCenter: [lon, latitude],
    title: e.name,
    license: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors; Protomaps basemap',
    features: [...features.values()].sort((a, b) => a.distance - b.distance),
  };
  fs.writeFileSync(path.join(out, `${id}-map.json`), JSON.stringify(result, null, 2) + '\n');
  console.log(
    JSON.stringify({
      id,
      title: e.name,
      features: features.size,
      path: path.relative(root, path.join(out, `${id}-map.json`)),
    }),
  );
}

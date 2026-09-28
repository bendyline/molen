/** Independent surrounding bank and road measurements, kept separate from the model. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = resolve(root, 'content/earth/structures/evidence/bridge-terrain/ign');
const bytes = await readFile(resolve(dir, 'N0019.json')),
  field = JSON.parse(bytes);
const raw = await readFile(resolve(root, '.artifacts/bridge-terrain/ign/N0019-roads.geojson'));
const roads = JSON.parse(raw),
  hash = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;
const c = Math.cos(field.heading),
  s = Math.sin(field.heading),
  radius = 6378137;
const local = ([lon, lat, absoluteElevation]) => {
  const dx = ((lon * Math.PI) / 180) * radius * field.factor - field.worldCenter[0];
  const dz =
    -radius * Math.asinh(Math.tan((lat * Math.PI) / 180)) * field.factor - field.worldCenter[1];
  return { x: c * dx - s * dz, z: s * dx + c * dz, absoluteElevation };
};
const sample = (x, z) => {
  const u =
    ((field.worldCenter[0] + c * x + s * z - field.worldOrigin[0]) / field.size) *
    (field.resolution - 1);
  const v =
    ((field.worldCenter[1] - s * x + c * z - field.worldOrigin[1]) / field.size) *
    (field.resolution - 1);
  const ix = Math.floor(u),
    iy = Math.floor(v),
    fx = u - ix,
    fy = v - iy;
  return [
    [0, 0, (1 - fx) * (1 - fy)],
    [1, 0, fx * (1 - fy)],
    [0, 1, (1 - fx) * fy],
    [1, 1, fx * fy],
  ].reduce(
    (sum, [dx, dy, weight]) => sum + field.heights[(iy + dy) * field.resolution + ix + dx] * weight,
    0,
  );
};
const stations = Array.from({ length: 101 }, (_, i) => i - 50).flatMap((x) =>
  [-4, 0, 4].map((z) => ({ x, z, elevation: sample(x, z) })),
);
await writeFile(
  resolve(dir, 'N0019-bank-profile.json'),
  `${JSON.stringify(
    {
      format: 'molen/bridge-bank-evidence@1',
      candidateId: 'N0019',
      anchor: field.anchor,
      heading: field.heading,
      terrainEvidenceHash: hash(bytes),
      verticalDatum: 'NGF-IGN69',
      sources: field.sources,
      stations,
      notes: [
        'Original RGE ALTI values sampled at explicit native stations. The northern quay face is not its upper road plateau; no source terrain has been fitted to the bridge.',
      ],
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  resolve(dir, 'N0019-road-profile.json'),
  `${JSON.stringify(
    {
      format: 'molen/bridge-road-evidence@1',
      candidateId: 'N0019',
      anchor: field.anchor,
      heading: field.heading,
      source: 'https://data.geopf.fr/wfs',
      sourceFile: '.artifacts/bridge-terrain/ign/N0019-roads.geojson',
      sourceHash: hash(raw),
      responseTimestamp: roads.timeStamp,
      verticalDatum: 'NGF-IGN69',
      attribution: 'IGN BD TOPO v3, Licence Ouverte Etalab 2.0',
      reference: 'https://geoservices.ign.fr/sites/default/files/2021-11/DC_BDTOPO_3-0_1.pdf',
      notes: [
        'The retained source response contains 45 features; the original request URL was not cached. Feature identifiers, geometry, precision and response timestamp are retained without inventing a query.',
      ],
      features: roads.features
        .filter((f) => f.geometry.type === 'LineString')
        .map((f) => ({
          featureId: f.id,
          properties: f.properties,
          localPoints: f.geometry.coordinates.map(local),
        })),
    },
    null,
    2,
  )}\n`,
);
console.log(
  `N0019: ${stations.length} independent bank samples and ${roads.features.length} original road features`,
);

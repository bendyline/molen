/** Independent geographic assets assembled only for authoring review; no aggregate GLB or placement. */
import '../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const check = process.argv.includes('--check');
const dir = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(dir, '../../../../../../..'),
  read = (p) => JSON.parse(fs.readFileSync(p)),
  write = (n, j) => {
    const target = path.join(dir, n),
      bytes = JSON.stringify(j, null, 2) + '\n';
    if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === bytes) return;
    if (check) throw Error('Stale collection output ' + n);
    fs.writeFileSync(target, bytes);
  },
  collection = read(path.join(dir, 'collection.json')).collections[0],
  f = read(path.join(dir, 'collection-frame.json')),
  g = read(path.join(dir, 'terrain-grid.json')),
  D = (6378137 * Math.PI) / 180,
  co = Math.cos((f.anchor[1] * Math.PI) / 180),
  assembly = [];
for (const m of collection.members) {
  const d = path.join(root, m.sourcePath),
    mf = read(path.join(d, 'map-frame.json')),
    mg = read(path.join(d, 'terrain-grid.json'));
  assembly.push({
    id: m.id,
    assetId: m.assetId,
    sourcePath: m.sourcePath,
    anchor: mf.anchor,
    heading: mf.heading,
    datumElevationMeters: mg.modelDatumElevationMeters,
    sourceHash: m.sourceHash,
    pos: [
      (mf.anchor[0] - f.anchor[0]) * D * co,
      mg.modelDatumElevationMeters - g.modelDatumElevationMeters,
      -(mf.anchor[1] - f.anchor[1]) * D,
    ],
    rot: [0, Math.sin(mf.heading / 2), 0, Math.cos(mf.heading / 2)],
  });
}
write('collection-assembly.json', {
  date: '2026-11-01',
  parentCompleted: collection.membershipEvidence.inventoryStatus === 'complete',
  scope:
    'Whole owned bazaar route and eleven independent native market members in original geographic positions; explicit architectural estimates retained, external reserved mosque excluded.',
  frame: 'collection-frame.json',
  terrain: 'terrain-grid.json',
  sourceFieldsOrMemberGeometryChanged: false,
  members: assembly,
});
write('scene.json', {
  format: 'molen/scene@3',
  name: collection.title + ' independent collection review',
  seed: collection.id,
  tickRate: 30,
  entities: [
    ...assembly.map((m) => ({
      id: m.id,
      components: {
        transform: { pos: m.pos, rot: m.rot },
        renderable: { kind: 'gltf', ref: m.assetId, shadows: { cast: true, receive: true } },
      },
    })),
    {
      id: 'environment',
      components: {
        environment: {
          ambient: { sky: '#c4dcec', ground: '#7a7258', intensity: 2 },
          sun: { direction: [-8, 14, 9], color: '#fff1d8', intensity: 3.5, castShadow: true },
          background: '#c4dcec',
          toneMapping: 'neutral',
          exposure: 1,
          shadows: 'high',
        },
      },
    },
  ],
  camera: { mode: 'fixed', position: [1100, 1300, 1600], lookAt: [0, 3, 0], fov: 43 },
  terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  physics: { engine: 'none' },
});
console.log({
  collection: collection.id,
  independentAssets: assembly.length,
  memberGeometryChanged: false,
  parentCompleted: collection.membershipEvidence.inventoryStatus === 'complete',
});

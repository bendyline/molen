/** Approximate site assembly from unchanged independent assets; no aggregate mesh. */
import '../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(dir, '../../../../../../..'),
  read = (file) => JSON.parse(fs.readFileSync(file)),
  collection = read(path.join(dir, 'collection.json')).collections[0],
  frame = read(path.join(dir, 'collection-frame.json')),
  grid = read(path.join(dir, 'terrain-grid.json')),
  degrees = (6378137 * Math.PI) / 180,
  cosine = Math.cos((frame.anchor[1] * Math.PI) / 180),
  check = process.argv.includes('--check');

function write(name, value) {
  const file = path.join(dir, name),
    bytes = `${JSON.stringify(value, null, 2)}\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === bytes) return;
  if (check) throw Error(`Stale collection output ${name}`);
  fs.writeFileSync(file, bytes);
}

const members = collection.members.map((member) => {
  const source = path.join(root, member.sourcePath),
    original = read(path.join(source, 'map-frame.json')),
    terrain = read(path.join(source, 'terrain-grid.json'));
  return {
    id: member.id,
    assetId: member.assetId,
    sourcePath: member.sourcePath,
    sourceHash: member.sourceHash,
    anchor: original.anchor,
    heading: original.heading,
    datumElevationMeters: terrain.modelDatumElevationMeters,
    representedDate: member.representedDate,
    pos: [
      (original.anchor[0] - frame.anchor[0]) * degrees * cosine,
      terrain.modelDatumElevationMeters - grid.modelDatumElevationMeters,
      -(original.anchor[1] - frame.anchor[1]) * degrees,
    ],
    rot: [0, Math.sin(original.heading / 2), 0, Math.cos(original.heading / 2)],
  };
});

write('collection-assembly.json', {
  date: '2026-11-02',
  parentCompleted: collection.membershipEvidence.inventoryStatus === 'complete',
  scope: collection.membershipEvidence.notes,
  frame: 'collection-frame.json',
  terrain: 'terrain-grid.json',
  sourceFieldsOrMemberGeometryChanged: false,
  memberQaChanged: false,
  outstanding: collection.membershipEvidence.outstanding,
  members,
});

write('scene.json', {
  format: 'molen/scene@3',
  name: 'Litoral Penitentiary — approximate 2023 ensemble',
  seed: 'litoral-independent-site-assembly-2023',
  tickRate: 30,
  entities: [
    ...members.map((member) => ({
      id: member.id,
      components: {
        transform: { pos: member.pos, rot: member.rot },
        renderable: {
          kind: 'gltf',
          ref: member.assetId,
          shadows: { cast: true, receive: true },
        },
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
  camera: { mode: 'fixed', position: [650, 660, 680], lookAt: [20, 0, -100], fov: 43 },
  terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  physics: { engine: 'none' },
});

console.log({ collection: collection.id, members: members.length, parentCompleted: collection.membershipEvidence.inventoryStatus === 'complete' });

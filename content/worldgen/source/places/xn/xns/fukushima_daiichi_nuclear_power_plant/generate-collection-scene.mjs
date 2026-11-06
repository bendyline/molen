/** Phase-aware independent assets; no aggregate geometry or duplicate placement. */
import '../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const check = process.argv.includes('--check'),
  dir = path.dirname(fileURLToPath(import.meta.url)),
  root = path.resolve(dir, '../../../../../../..'),
  read = (p) => JSON.parse(fs.readFileSync(p)),
  collection = read(path.join(dir, 'collection.json')).collections[0],
  scope = read(path.join(dir, 'native-map/power-block-scope-reconciliation.json')),
  f = read(path.join(dir, 'collection-frame.json')),
  g = read(path.join(dir, 'terrain-grid.json')),
  D = (6378137 * Math.PI) / 180,
  co = Math.cos((f.anchor[1] * Math.PI) / 180),
  write = (n, j) => {
    const p = path.join(dir, n),
      b = JSON.stringify(j, null, 2) + '\n';
    if (fs.existsSync(p) && fs.readFileSync(p, 'utf8') === b) return;
    if (check) throw Error('Stale collection output ' + n);
    fs.writeFileSync(p, b);
  };
const members = collection.members.map((m) => {
  const d = path.join(root, m.sourcePath),
    mf = read(path.join(d, 'map-frame.json')),
    mg = read(path.join(d, 'terrain-grid.json'));
  return {
    id: m.id,
    assetId: m.assetId,
    sourcePath: m.sourcePath,
    anchor: mf.anchor,
    heading: mf.heading,
    datumElevationMeters: mg.modelDatumElevationMeters,
    sourceHash: m.sourceHash,
    representedDate: m.representedDate,
    selectedInLaterPreview: scope.selectedLaterMembers.includes(m.id),
    pos: [
      (mf.anchor[0] - f.anchor[0]) * D * co,
      mg.modelDatumElevationMeters - g.modelDatumElevationMeters,
      -(mf.anchor[1] - f.anchor[1]) * D,
    ],
    rot: [0, Math.sin(mf.heading / 2), 0, Math.cos(mf.heading / 2)],
  };
});
write('collection-assembly.json', {
  date: '2026-11-02',
  parentCompleted: collection.membershipEvidence.inventoryStatus === 'complete',
  scope: scope.scope,
  frame: 'collection-frame.json',
  terrain: 'terrain-grid.json',
  sourceFieldsOrMemberGeometryChanged: false,
  phaseSets: scope.phaseSets,
  selectedPreview: 'approximate-2021-six-unit-power-block',
  phaseContinuityVerified: false,
  verticalPolicy: scope.verticalPolicy,
  positionNotes: scope.positionNotes,
  members,
});
write('scene.json', {
  format: 'molen/scene@3',
  name: 'Fukushima Daiichi six-unit power-block ensemble — approximate2021',
  seed: 'daiichi-six-unit-collection-2021',
  tickRate: 30,
  entities: [
    ...members
      .filter((m) => m.selectedInLaterPreview)
      .map((m) => ({
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
  camera: { mode: 'fixed', position: [1100, 1050, 1350], lookAt: [0, -12, 0], fov: 43 },
  terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  physics: { engine: 'none' },
});
console.log({
  collection: collection.id,
  libraryMembers: members.length,
  selectedLaterMembers: members.filter((m) => m.selectedInLaterPreview).length,
  memberModelsAndQaChanged: false,
});

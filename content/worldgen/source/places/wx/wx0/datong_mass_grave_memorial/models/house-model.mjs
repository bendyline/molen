/** Written archaeological court/niche controls; explicit estimated historical exterior. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95, metallic: 0 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
  window: { slot: 'window', graph: 'window_punched', roughness: 0.25, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.52, metallic: 0.2 },
};
const colors = {
  wall: rgb('d7d8d2'),
  concrete: rgb('a7aaa5'),
  window: rgb('51636a'),
  metal: rgb('454d52'),
};
export const componentEvidence = [];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], colors[k]);
}
function cap(o, k, r, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      r,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid sanctuary cap');
  const m = b.finalize();
  for (let i = 0; i < m.indices.length; i += 3)
    face(
      o,
      k,
      Array.from(m.indices.slice(i, i + 3)).map((j) =>
        Array.from(m.positions.slice(j * 3, j * 3 + 3)),
      ),
      [0, up, 0],
    );
}
function prism(o, k, r, y0, y1) {
  r = [...r];
  if (
    r.reduce(
      (s, p, i) => s + p[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * p[1],
      0,
    ) < 0
  )
    r.reverse();
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

const q = P.nativeRing,
  unit = (a, b) => {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
  },
  u = unit(q[0], q[1]),
  v = unit(q[0], q[3]),
  width = Math.hypot(q[1][0] - q[0][0], q[1][1] - q[0][1]),
  length = Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]);
const point = (x, z) => [q[0][0] + x * u[0] + z * v[0], q[0][1] + x * u[1] + z * v[1]];
function block(o, k, x0, z0, x1, z1, y0, y1) {
  prism(
    o,
    k,
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ].map((p) => point(...p)),
    y0,
    y1,
  );
}
function panel(o, side, at, wide, y0, y1, lod) {
  const zSide = side === 'west' || side === 'east',
    a =
      side === 'west'
        ? [-0.045, at - wide / 2, 0.01, at + wide / 2]
        : side === 'east'
          ? [width - 0.01, at - wide / 2, width + 0.045, at + wide / 2]
          : side === 'south'
            ? [at - wide / 2, -0.045, at + wide / 2, 0.01]
            : [at - wide / 2, length - 0.01, at + wide / 2, length + 0.045];
  block(o, 'window', ...a, y0, y1);
  if (lod > 0) {
    const t = 0.07;
    for (const [yA, yB] of [
      [y0 - t, y0],
      [y1, y1 + t],
    ])
      block(o, 'metal', ...a, yA, yB);
    if (zSide) {
      block(o, 'metal', a[0] - 0.01, at - t / 2, a[2] + 0.01, at + t / 2, y0, y1);
    } else block(o, 'metal', at - t / 2, a[1] - 0.01, at + t / 2, a[3] + 0.01, y0, y1);
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  prism(o, 'concrete', q, P.foundationBottom, P.floor);
  prism(o, 'wall', q, P.floor, P.wallTop);
  prism(o, 'concrete', q, P.wallTop, P.roofTop);
  for (const a of [
    [0, 0, width, 0.18],
    [0, length - 0.18, width, length],
    [0, 0.18, 0.18, length - 0.18],
    [width - 0.18, 0.18, width, length - 0.18],
  ])
    block(o, 'wall', ...a, P.roofTop, P.parapetTop);
  panel(o, 'south', width / 2, 2.25, P.floor, P.floor + 2.5, lod);
  for (const side of ['west', 'east'])
    for (let i = 0; i < 6; i++) panel(o, side, 1.8 + i * 3.1, 1.45, 1.5, 3.35, lod);
  for (const at of [2, width - 2]) panel(o, 'north', at, 1.5, 1.5, 3.35, lod);
  block(o, 'concrete', width / 2 - 1.8, -1.8, width / 2 + 1.8, 0.15, P.floor + 2.8, P.floor + 3.02);
  for (const x of [width / 2 - 1.5, width / 2 + 1.5])
    block(o, 'metal', x - 0.07, -1.55, x + 0.07, -1.41, P.floor, P.floor + 2.8);
  if (lod >= 2) {
    for (const side of ['west', 'east'])
      for (let i = 0; i < 6; i++) {
        const z = 1.8 + i * 3.1,
          x = side === 'west' ? -0.06 : width - 0.02;
        block(o, 'concrete', x, z - 0.82, x + 0.08, z + 0.82, 1.4, 1.5);
      }
    block(o, 'concrete', width / 2 - 2.1, -2.15, width / 2 + 2.1, -0.1, P.floor - 0.12, P.floor);
  }
  if (lod >= 3) {
    for (let z = 2; z < length; z += 3.8) {
      block(o, 'wall', -0.035, z - 0.07, 0.035, z + 0.07, P.floor, P.wallTop);
      block(o, 'wall', width - 0.035, z - 0.07, width + 0.035, z + 0.07, P.floor, P.wallTop);
    }
    for (const a of [
      [0, -0.03, width, 0.03],
      [0, length - 0.03, width, length + 0.03],
    ])
      block(o, 'concrete', ...a, P.parapetTop, P.parapetTop + 0.06);
  }
  componentEvidence.push({
    lod,
    wholeOriginalOutline: true,
    originalCorners: 4,
    roofAndBackingClosed: true,
    estimatedStoreys: 1,
    estimatedEntranceCanopy: true,
    facadeWindows: 14,
    memorialIdentityVerified: false,
    physicalAssociationEstimated: true,
    heightMeasured: false,
    imageryUsed: false,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/wx/wx0/datong_mass_grave_memorial',
  camera = [21, 16, 27],
  look = [0, 2, 0];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: P.cell,
  title: P.title,
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief: P.limitations.join(' '),
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: 0,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'concrete_plain', 'window_punched', 'metal_painted'],
  qaCameras: [
    { name: 'whole-original-roof-and-estimated-south-canopy', position: camera, lookAt: look },
    { name: 'opposite-windowed-long-wall-and-flat-roof', position: [-21, 14, -24], lookAt: look },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-exhibition-hall-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.2,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.12, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.04, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic estimated architecture under repository license, using original numeric roof outline and saved factual museum context. All appearance imagery unused. Physical exhibition-hall correspondence remains probable and unverified; no exact survey, whole-campus coverage or present-day activation claimed.',
};

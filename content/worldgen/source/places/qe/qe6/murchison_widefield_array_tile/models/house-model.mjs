/** Complete Phase-I MWA antenna tile and intrinsic beamformer; written facts only. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
export const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
export const surfaces = {
  screen: { slot: 'roof', graph: 'metal_painted', roughness: 0.84, metallic: 0.35 },
  antenna: { slot: 'wall', graph: 'metal_painted', roughness: 0.68, metallic: 0.4 },
  hub: { slot: 'window', graph: 'metal_painted', roughness: 0.9, metallic: 0.02 },
  feet: { slot: 'foundation', graph: 'metal_painted', roughness: 0.92, metallic: 0 },
  box: { slot: 'door', graph: 'metal_painted', roughness: 0.78, metallic: 0.25 },
  cable: { slot: 'trim', graph: 'metal_painted', roughness: 0.97, metallic: 0 },
};
const colors = {
  screen: rgb('888f88'),
  antenna: rgb('ced2c9'),
  hub: rgb('455e57'),
  feet: rgb('aaa992'),
  box: rgb('e2e5d9'),
  cable: rgb('353b35'),
};
export const componentEvidence = [];
function face(o, k, p, n, tint = colors[k]) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [...p].reverse();
    normal = normalFor(...p);
  }
  o.addConvexPolygon(k, 'palette:#ffffff', p, normal, (q) => [q[0], q[1]], tint);
}
function cap(o, k, ring, y, up) {
  const b = new MeshBufferBuilder();
  if (
    !b.addCap(
      k,
      'palette:#ffffff',
      ring,
      [],
      () => y,
      [0, up, 0],
      (p) => p,
      colors[k],
    )
  )
    throw Error('Invalid whole house cap');
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
function polygon(o, k, r, y0, y1) {
  const sign = Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
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
      [(b[1] - a[1]) * sign, 0, -(b[0] - a[0]) * sign],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, k, r, y1, 1);
}
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

const strut = (o, k, a, b, w, d = w) => beam(o, k, a, b, w, d, colors[k]);
function box(o, k, x, z, w, d, y0, y1) {
  polygon(o, k, rect(x - w / 2, x + w / 2, z - d / 2, z + d / 2), y0, y1);
}
function wing(o, axis, x, z, side, lod) {
  const bottom = P.screenY + P.elementBottomAboveScreen,
    mid = bottom + P.dipoleHeight / 2,
    half = P.dipoleSpan / 2,
    point = (u, y, offset) => (axis === 0 ? [x + u, y, z + offset] : [x + offset, y, z + u]),
    a = point(side * 0.045, mid, 0),
    b = point(side * half, bottom, 0),
    c = point(side * half, bottom + P.dipoleHeight, 0),
    normal = axis === 0 ? [0, 0, 1] : [1, 0, 0];
  if (lod === 0) {
    face(o, 'antenna', [a, b, c], normal);
    face(
      o,
      'antenna',
      [a, b, c],
      normal.map((v) => -v),
    );
    return;
  }
  const rings = [-0.004, 0.004].map((offset) =>
    [a, b, c].map((q) => q.map((v, k) => v + normal[k] * offset)),
  );
  face(
    o,
    'antenna',
    rings[0],
    normal.map((v) => -v),
  );
  face(o, 'antenna', rings[1], normal);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    face(o, 'antenna', [rings[0][i], rings[0][j], rings[1][j], rings[1][i]]);
  }
}
export function buildHouse(o, _f, lod = 3) {
  componentEvidence.length = 0;
  const n = Math.round(P.screenSize / P.wireSpacing[lod]),
    w = P.wireWidths[lod];
  // Open wire screen remains open at every LOD; no opaque tile slab.
  for (let i = 0; i <= n; i++) {
    const p = (i * P.screenSize) / n;
    strut(o, 'screen', [0, P.screenY, -p], [5, P.screenY, -p], w);
    strut(o, 'screen', [p, P.screenY, 0], [p, P.screenY, -5], w);
  }
  const bottom = P.screenY + P.elementBottomAboveScreen,
    mid = bottom + P.dipoleHeight / 2;
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      const x = 0.85 + i * P.dipoleSpacing,
        z = -0.85 - j * P.dipoleSpacing;
      for (const axis of [0, 1]) for (const side of [-1, 1]) wing(o, axis, x, z, side, lod);
      box(o, 'hub', x, z, 0.12, 0.12, mid - 0.05, mid + 0.05);
      if (lod === 0) box(o, 'feet', x, z, 0.11, 0.11, P.screenY, bottom);
      else
        for (const axis of [0, 1])
          for (const s of [-1, 1])
            box(
              o,
              'feet',
              x + (axis === 0 ? s * 0.3 : 0),
              z + (axis === 1 ? s * 0.3 : 0),
              0.06,
              0.06,
              P.screenY,
              bottom + 0.02,
            );
      if (lod > 0 || j === 1)
        strut(
          o,
          'cable',
          [x, P.screenY + 0.02, z],
          [5.18, P.screenY + 0.02, -2.5],
          lod === 0 ? 0.025 : 0.013,
        );
    }
  box(o, 'box', 5.45, -2.5, 0.55, 0.4, 0.06, 0.42);
  if (lod > 0) {
    box(o, 'box', 5.45, -2.5, 0.58, 0.43, 0.42, 0.455);
    for (let i = 0; i < [0, 2, 4, 8][lod]; i++)
      box(
        o,
        'cable',
        5.165,
        -2.65 + (i * 0.3) / Math.max(1, [0, 2, 4, 8][lod] - 1),
        0.04,
        0.026,
        0.16,
        0.2,
      );
  }
  componentEvidence.push({
    lod,
    whole5mOpenScreen: true,
    wireSpacing: P.wireSpacing[lod],
    screenPanels: 3,
    elements: 16,
    crossedVerticalBowties: 32,
    feetAndHubs: true,
    intrinsicBeamformer: true,
    representativeCables: true,
    originalSouthwestCorner: true,
    instances: 128,
    notWholeObservatoryProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/qe/qe6/murchison_widefield_array_tile',
  camera = [9, 4.8, 7],
  look = [2.5, 0.25, -2.5];
export const houseModel = {
  id: P.model,
  key: P.model,
  cell: 'qe/qe6',
  title: 'Murchison Widefield Array Phase-I antenna tile',
  recipe: 'house-model.mjs',
  surfaces,
  build: buildHouse,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-002.PROGRESS.md',
  brief:
    'Whole5x5m open mesh ground screen, all16 crossed vertical bowtie antennas with feet/LNA hubs, adjacent intrinsic beamformer and exposed cable bundle. Primary written mechanical facts and original operator southwest-corner points only. Reusable equipment with128 individual original Phase-I placements; parent observatory remains unfinished.',
  appearance: {
    kind: 'historical',
    representedDate: P.representedDate,
    validFrom: P.validFrom,
    validUntil: P.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt: look,
  portableGroundY: -0.24,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['metal_painted'],
  qaCameras: [
    {
      name: 'whole-openmesh-all16-crossed-dipoles-and-beamformer',
      position: [9, 5, 4],
      lookAt: look,
    },
    {
      name: 'crossed-bowtie-hub-feet-and-mesh-detail',
      position: [1.8, 1.3, 0.8],
      lookAt: [0.85, 0.33, -0.85],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-tile-${reviewLod}`,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `${root}/models/house-model.mjs`,
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 0.15,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.1, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.05, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.001, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic procedural geometry under repository license. Operator numerical coordinate facts and written primary system/technology facts only; no photographs, maps, schematics or figures adopted. Small supports, finish, wire LOD visibility and cable routing estimates explicit.',
};

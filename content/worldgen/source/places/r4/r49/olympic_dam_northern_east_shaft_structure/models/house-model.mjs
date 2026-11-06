/** Anonymous shaft surface form. Dimensions and structural topology are explicitly estimated. */
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
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97, metallic: 0 },
  pale: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.2 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84, metallic: 0.2 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.25 },
  panel: { slot: 'trim', graph: 'metal_painted', roughness: 0.94, metallic: 0.05 },
};
const colors = {
  foundation: rgb('979b90'),
  pale: rgb('bec7bb'),
  roof: rgb('b5bfb5'),
  steel: rgb('5f746e'),
  panel: rgb('354b46'),
};
export const componentEvidence = [];
export const rectangle = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function face(o, k, p, n) {
  let normal = normalFor(...p);
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
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
    throw Error('Invalid shaft enclosure cap');
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
function prism(o, k, r, y0, y1, top = k) {
  const sg = Math.sign(
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - a[1] * b[0];
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
      [(b[1] - a[1]) * sg, 0, -(b[0] - a[0]) * sg],
    );
  }
  cap(o, k, r, y0, -1);
  cap(o, top, r, y1, 1);
}
export const padCenters = [
  [-9, -6],
  [9, -6],
  [9, 6],
  [-9, 6],
  [-7, 24],
  [7, 24],
];
const legAt = (sx, sz, y) => {
  const t = (y - P.floor) / (P.frameTop - P.floor);
  return [sx * (9 - 4 * t), y, sz * (6 - 2 * t)];
};
function deck(o, y, lod) {
  const r = rectangle(-6.2, -5.3, 6.2, 5.3);
  prism(o, 'steel', r, y - 0.18, y);
  if (lod < 2) return;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.ceil(L / 3);
    for (const h of [y + 0.55, y + 1.05])
      beam(o, 'steel', [a[0], h, a[1]], [b[0], h, b[1]], 0.06, 0.06, colors.steel);
    for (let j = 0; j <= n; j++) {
      const t = j / n,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      beam(o, 'steel', [x, y, z], [x, y + 1.05, z], 0.06, 0.06, colors.steel);
    }
  }
}
export function buildHouse(o, _frame, lod = 3) {
  componentEvidence.length = 0;
  for (const [x, z] of padCenters)
    prism(
      o,
      'foundation',
      rectangle(x - 1.6, z - 1.6, x + 1.6, z + 1.6),
      P.foundationBottom,
      P.floor,
    );
  // Collar footing and lower enclosure are attached to this shaft, not a free-standing plant hall.
  prism(o, 'foundation', rectangle(-4.5, -3.5, 4.5, 3.5), P.foundationBottom, P.floor);
  prism(o, 'pale', rectangle(-4, -3, 4, 3), P.floor, P.lowerTop, 'roof');
  prism(o, 'pale', rectangle(-5, -4, 5, 4), P.upperBottom, P.upperTop, 'roof');
  let mainLegs = 0,
    backstays = 0,
    guideColumns = 0,
    braces = 0,
    platforms = 0,
    stairs = 0;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      beam(o, 'steel', legAt(sx, sz, P.floor), legAt(sx, sz, P.frameTop), 0.7, 0.7, colors.steel);
      mainLegs++;
    }
  for (const sx of [-1, 1]) {
    beam(o, 'steel', [sx * 7, P.floor, 24], [sx * 5, P.frameTop, 0], 0.9, 0.9, colors.steel);
    backstays++;
  }
  const levels = lod === 0 ? [P.frameLevels[1], P.frameTop] : P.frameLevels;
  for (const y of levels) {
    const r = [legAt(-1, -1, y), legAt(1, -1, y), legAt(1, 1, y), legAt(-1, 1, y)];
    for (let i = 0; i < 4; i++) beam(o, 'steel', r[i], r[(i + 1) % 4], 0.42, 0.55, colors.steel);
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      beam(
        o,
        'steel',
        [sx * 2, P.lowerTop, sz * 1.8],
        [sx * 2, P.guideTop, sz * 1.8],
        0.3,
        0.3,
        colors.steel,
      );
      guideColumns++;
    }
  for (const y of lod === 0 ? [P.guideTop] : [10.25, 15.25, 20.25, 25.25, 30.25, P.guideTop]) {
    for (const z of [-1.8, 1.8]) beam(o, 'steel', [-2, y, z], [2, y, z], 0.22, 0.3, colors.steel);
    for (const x of [-2, 2]) beam(o, 'steel', [x, y, -1.8], [x, y, 1.8], 0.22, 0.3, colors.steel);
  }
  if (lod > 0) {
    const ys = [P.floor, ...P.frameLevels];
    for (let i = 1; i < ys.length; i++) {
      for (const sz of [-1, 1]) {
        beam(o, 'steel', legAt(-1, sz, ys[i - 1]), legAt(1, sz, ys[i]), 0.2, 0.2, colors.steel);
        braces++;
      }
      for (const sx of [-1, 1]) {
        beam(o, 'steel', legAt(sx, -1, ys[i - 1]), legAt(sx, 1, ys[i]), 0.2, 0.2, colors.steel);
        braces++;
      }
    }
  }
  for (const y of lod === 0 ? [P.upperBottom - 0.3] : [20.25, P.upperBottom - 0.3]) {
    deck(o, y, lod);
    platforms++;
  }
  if (lod > 1) {
    // Estimated service stair and ladder access, with closed dark service panels rather than transparent holes.
    for (const x of [-2.7, 2.7]) {
      prism(o, 'panel', rectangle(x - 0.9, -3.045, x + 0.9, -3.015), P.floor + 0.2, P.floor + 3.2);
    }
    for (const z of [-4.03, 4.03])
      for (const x of [-2.8, 0, 2.8]) {
        prism(
          o,
          'panel',
          rectangle(x - 0.75, z - 0.015, x + 0.75, z + 0.015),
          P.upperBottom + 2,
          P.upperBottom + 3.4,
        );
      }
    const n = lod === 2 ? 18 : 24;
    for (let j = 1; j <= n; j++) {
      const t = j / n;
      beam(
        o,
        'steel',
        [6.5, P.floor + 6 * t, 10 - 8 * t],
        [9, P.floor + 6 * t, 10 - 8 * t],
        0.35,
        0.15,
        colors.steel,
      );
      stairs++;
    }
    prism(o, 'steel', rectangle(4, 1, 9, 3), P.lowerTop - 0.18, P.lowerTop);
    for (const z of [1, 3]) {
      beam(o, 'steel', [4, P.lowerTop - 2, z], [9, P.lowerTop - 0.18, z], 0.16, 0.2, colors.steel);
      beam(
        o,
        'steel',
        [4, P.lowerTop + 1.05, z],
        [9, P.lowerTop + 1.05, z],
        0.06,
        0.06,
        colors.steel,
      );
      for (const x of [4, 6, 9])
        beam(o, 'steel', [x, P.lowerTop, z], [x, P.lowerTop + 1.05, z], 0.06, 0.06, colors.steel);
    }
    for (const x of [6.5, 9]) {
      beam(o, 'steel', [x, P.floor + 0.1, 10], [x, P.floor + 6.1, 2], 0.15, 0.2, colors.steel);
      beam(o, 'steel', [x, P.floor + 1.1, 10], [x, P.floor + 7.1, 2], 0.07, 0.07, colors.steel);
    }
    for (const x of [5.55, 6.35])
      beam(o, 'steel', [x, P.lowerTop, 3], [x, P.upperBottom - 0.3, 3], 0.07, 0.07, colors.steel);
    const count = lod === 2 ? 36 : 48;
    for (let j = 0; j <= count; j++) {
      const y = P.lowerTop + ((P.upperBottom - 0.3 - P.lowerTop) * j) / count;
      beam(o, 'steel', [5.55, y, 3], [6.35, y, 3], 0.045, 0.045, colors.steel);
    }
  }
  if (lod === 3) {
    for (const x of [-5.025, 5.025])
      for (const z of [-2, 0, 2])
        beam(
          o,
          'steel',
          [x, P.upperBottom + 0.1, z],
          [x, P.upperTop - 0.1, z],
          0.055,
          0.055,
          colors.steel,
        );
    for (const z of [-4.025, 4.025])
      for (const x of [-3.3, 0, 3.3])
        beam(
          o,
          'steel',
          [x, P.upperBottom + 0.1, z],
          [x, P.upperTop - 0.1, z],
          0.055,
          0.055,
          colors.steel,
        );
  }
  componentEvidence.push({
    lod,
    wholeIndependentShaftSurfaceStructure: true,
    originalAnonymousPointRetained: true,
    estimatedFootprint: true,
    heightMeasured: false,
    topologyVerified: false,
    mainLegs,
    backstays,
    guideColumns,
    independentSupportPads: 6,
    lowerEnclosure: true,
    upperEnclosure: true,
    braces,
    platforms,
    stairs,
    openSpaceBetweenSupports: true,
    notWholeMineProxy: true,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/r4/r49/olympic_dam_northern_east_shaft_structure',
  camera = [73, 53, 83],
  look = [0, 21, 4];
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
  portableGroundY: -1.35,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'metal_corrugated',
    'metal_standing_seam',
    'metal_painted',
    'concrete_plain',
  ],
  qaCameras: [
    {
      name: 'whole-shaft-structure-inclined-supports-and-upper-enclosure',
      position: camera,
      lookAt: look,
    },
    {
      name: 'opposite-whole-shaft-guide-and-open-supports',
      position: [-78, 49, -76],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-shaft-surface-structure-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. Original anonymous shaft point © OpenStreetMap contributors, ODbL-1.0. Already-published public-domain NASA JSC ISS038-E-29810 and ISS038-E-29809 supply broad surface-form context only. No photograph texture. Footprint, height, exact structural topology, equipment identity, facing, condition, date continuity and vertical tie remain explicit estimates.',
};

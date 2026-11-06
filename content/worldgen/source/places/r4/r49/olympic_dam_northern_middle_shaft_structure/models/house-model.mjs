/** Compact anonymous shaft surface tower. Dimensions, topology and function remain estimated. */
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
  [-5, -4],
  [5, -4],
  [5, 4],
  [-5, 4],
];
function rail(o, r, y, lod) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      n = Math.ceil(L / (lod === 2 ? 4 : 2.5));
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
  let columns = 0,
    braces = 0,
    stairs = 0,
    ladderRungs = 0,
    panels = 0;
  prism(o, 'foundation', rectangle(-3, -3, 3, 3), P.foundationBottom, P.floor);
  prism(o, 'pale', rectangle(-2, -2, 2, 2), P.floor, P.coreTop, 'roof');
  prism(o, 'foundation', rectangle(-6, 3, 6, 14), P.foundationBottom, P.floor);
  prism(o, 'pale', rectangle(-6, 3, 6, 14), P.floor, P.lowerTop, 'roof');
  prism(o, 'pale', rectangle(-2, 2, 2, 4), P.floor, P.connectorTop, 'roof');
  prism(o, 'pale', rectangle(-6, -5, 6, 5), P.upperBottom, P.upperTop, 'roof');
  for (const [x, z] of padCenters) {
    prism(
      o,
      'foundation',
      rectangle(x - 1.1, z - 1.1, x + 1.1, z + 1.1),
      P.foundationBottom,
      P.floor,
    );
    beam(o, 'steel', [x, P.floor, z], [x, P.frameTop, z], 0.65, 0.65, colors.steel);
    columns++;
  }
  const levels = lod === 0 ? [P.midDeck, P.frameTop] : [8.25, P.midDeck, 23.25, P.frameTop];
  for (const y of levels) {
    const r = rectangle(-5, -4, 5, 4);
    for (let i = 0; i < 4; i++) {
      const a = r[i],
        b = r[(i + 1) % 4];
      beam(o, 'steel', [a[0], y, a[1]], [b[0], y, b[1]], 0.4, 0.5, colors.steel);
    }
  }
  if (lod > 0) {
    const ys = [P.floor, 8.25, P.midDeck, 23.25, P.frameTop];
    for (let i = 1; i < ys.length; i++)
      for (const z of [-4, 4]) {
        beam(o, 'steel', [-5, ys[i - 1], z], [5, ys[i], z], 0.18, 0.18, colors.steel);
        braces++;
      }
    if (lod > 1)
      for (let i = 1; i < ys.length; i++)
        for (const x of [-5, 5]) {
          beam(o, 'steel', [x, ys[i - 1], -4], [x, ys[i], 4], 0.18, 0.18, colors.steel);
          braces++;
        }
  }
  for (const [y, r] of [
    [P.midDeck, rectangle(-6, -5, 6, 5)],
    [P.upperBottom, rectangle(-7.5, -6.5, 7.5, 6.5)],
  ]) {
    prism(o, 'steel', r, y - 0.2, y);
    if (lod > 1) rail(o, r, y, lod);
  }
  if (lod > 1) {
    const n = lod === 2 ? 18 : 24;
    for (let j = 1; j <= n; j++) {
      const t = j / n,
        y = P.floor + (P.lowerTop - P.floor) * t,
        z = 23 + (14 - 23) * t;
      beam(o, 'steel', [3, y, z], [5, y, z], 0.35, 0.14, colors.steel);
      stairs++;
    }
    for (const x of [3, 5]) {
      beam(o, 'steel', [x, P.floor + 0.1, 23], [x, P.lowerTop + 0.1, 14], 0.17, 0.2, colors.steel);
      beam(
        o,
        'steel',
        [x, P.floor + 1.05, 23],
        [x, P.lowerTop + 1.05, 14],
        0.06,
        0.06,
        colors.steel,
      );
    }
    prism(o, 'steel', rectangle(5.4, 3, 6.8, 5), P.lowerTop - 0.18, P.lowerTop);
    for (const z of [3.5, 4.5])
      beam(
        o,
        'steel',
        [5, P.lowerTop - 2, z],
        [6.8, P.lowerTop - 0.18, z],
        0.15,
        0.18,
        colors.steel,
      );
    for (const x of [5.8, 6.4])
      beam(o, 'steel', [x, P.lowerTop, 4], [x, P.upperBottom, 4], 0.065, 0.065, colors.steel);
    const count = lod === 2 ? 30 : 42;
    for (let j = 0; j <= count; j++) {
      const y = P.lowerTop + ((P.upperBottom - P.lowerTop) * j) / count;
      beam(o, 'steel', [5.8, y, 4], [6.4, y, 4], 0.045, 0.045, colors.steel);
      ladderRungs++;
    }
    prism(o, 'panel', rectangle(-1.1, 14.025, 1.1, 14.055), P.floor + 0.2, P.floor + 3.2);
    panels++;
    for (const z of [-5.04, 5.04])
      for (const x of [-3.5, 0, 3.5]) {
        prism(
          o,
          'panel',
          rectangle(x - 0.8, z - 0.015, x + 0.8, z + 0.015),
          P.upperBottom + 2,
          P.upperBottom + 3.5,
        );
        panels++;
      }
  }
  if (lod === 3) {
    for (const x of [-6.03, 6.03])
      for (const z of [-3, 0, 3])
        beam(
          o,
          'steel',
          [x, P.upperBottom + 0.1, z],
          [x, P.upperTop - 0.1, z],
          0.05,
          0.05,
          colors.steel,
        );
    for (const z of [-5.03, 5.03])
      for (const x of [-4, -2, 0, 2, 4])
        beam(
          o,
          'steel',
          [x, P.upperBottom + 0.1, z],
          [x, P.upperTop - 0.1, z],
          0.05,
          0.05,
          colors.steel,
        );
  }
  componentEvidence.push({
    lod,
    wholeIndependentCompactShaftSurfaceTower: true,
    originalAnonymousPointRetained: true,
    estimatedFootprint: true,
    heightMeasured: false,
    topologyVerified: false,
    componentCensusMeasured: false,
    enclosedVerticalCore: true,
    upperEnclosure: true,
    attachedLowHousing: true,
    lowerConnector: true,
    straightExternalColumns: columns,
    separateColumnPads: 4,
    coreAndAttachedHousingFoundations: 2,
    serviceDecks: 2,
    noInclinedBackstayClone: true,
    noExposedFunctionalMachineryClaim: true,
    notWholeMineProxy: true,
    braces,
    stairs,
    ladderRungs,
    closedServicePanels: panels,
  });
}
export const houseSkyline = (o, f) => buildHouse(o, f, 0),
  houseDistrict = (o, f) => buildHouse(o, f, 1),
  houseStreet = (o, f) => buildHouse(o, f, 2),
  houseCloseup = (o, f) => buildHouse(o, f, 3);
const root = 'content/worldgen/source/places/r4/r49/olympic_dam_northern_middle_shaft_structure',
  camera = [65, 48, 73],
  look = [0, 18, 3];
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
      name: 'whole-compact-shaft-surface-tower-core-and-upper-housing',
      position: camera,
      lookAt: look,
    },
    {
      name: 'opposite-whole-surface-tower-straight-supports-and-low-housing',
      position: [-69, 44, -71],
      lookAt: look,
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-compact-shaft-surface-tower-' + reviewLod,
    position: camera,
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/house-model.mjs',
    level: 'skyline',
    export: 'houseSkyline',
    errorMeters: 1,
    surfaces,
    authoredLevels: {
      district: { export: 'houseDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'houseStreet', errorMeters: 0.08, surfaces },
      closeup: { export: 'houseCloseup', errorMeters: 0.02, surfaces },
    },
  },
  limitations: P.limitations,
  sourceLicense:
    'Original deterministic geometry under repository license. Original anonymous shaft coordinate © OpenStreetMap contributors, ODbL-1.0. Two already-published public-domain NASA JSC ISS038-E-29810/29809 originals supply broad compact surface-form context only. No photograph texture. Exact type, topology, function, shaft name, footprint, heights, facing, materials, access, date continuity and vertical tie remain explicit estimates.',
};

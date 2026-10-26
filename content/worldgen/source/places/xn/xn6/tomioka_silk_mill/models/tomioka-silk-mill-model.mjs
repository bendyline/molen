/** Complete physical reeling hall; local geographic recipe, no detached campus buildings. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const A = p.parameters.architecturalSections;
const P = p.outline.slice(0, -1);
const sub = (a, b) => a.map((x, i) => x - b[i]);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const L = Math.hypot(...sub(P[1], P[0]));
const W = Math.hypot(...sub(P[3], P[0]));
const point = (u, y, v) => [
  P[0][0] +
    ((P[1][0] - P[0][0]) * u) / L +
    ((P[3][0] - P[0][0]) * v) / W +
    ((P[2][0] - P[1][0] - P[3][0] + P[0][0]) * u * v) / (L * W),
  p.parameters.floorY + y,
  P[0][1] +
    ((P[1][1] - P[0][1]) * u) / L +
    ((P[3][1] - P[0][1]) * v) / W +
    ((P[2][1] - P[1][1] - P[3][1] + P[0][1]) * u * v) / (L * W),
];
const direction = (u, y, v) => [
  ((P[1][0] - P[0][0]) * u) / L + ((P[3][0] - P[0][0]) * v) / W,
  y,
  ((P[1][1] - P[0][1]) * u) / L + ((P[3][1] - P[0][1]) * v) / W,
];
const C = {
  brick: rgb('b0795c'),
  wood: rgb('8b8980'),
  stone: rgb('a89e87'),
  roof: rgb('626761'),
  glass: rgb('455457'),
  metal: rgb('874b47'),
};
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.96, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43, metallic: 0.08 },
  metal: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.75, metallic: 0.12 },
};
function triangle(o, k, q, n) {
  q = q.map((v) => point(...v).map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, direction(...n)) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    C[k],
  );
}
function quad(o, k, q, n) {
  triangle(o, k, q.slice(0, 3), n);
  triangle(o, k, [q[0], q[2], q[3]], n);
}
function box(o, k, x0, x1, y0, y1, z0, z1) {
  quad(
    o,
    k,
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z0],
      [x0, y1, z0],
    ],
    [0, 0, -1],
  );
  quad(
    o,
    k,
    [
      [x1, y0, z1],
      [x0, y0, z1],
      [x0, y1, z1],
      [x1, y1, z1],
    ],
    [0, 0, 1],
  );
  quad(
    o,
    k,
    [
      [x0, y0, z1],
      [x0, y0, z0],
      [x0, y1, z0],
      [x0, y1, z1],
    ],
    [-1, 0, 0],
  );
  quad(
    o,
    k,
    [
      [x1, y0, z0],
      [x1, y0, z1],
      [x1, y1, z1],
      [x1, y1, z0],
    ],
    [1, 0, 0],
  );
  quad(
    o,
    k,
    [
      [x0, y1, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 1, 0],
  );
  quad(
    o,
    k,
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y0, z0],
      [x0, y0, z0],
    ],
    [0, -1, 0],
  );
}
function sideRect(o, k, side, x0, x1, y0, y1, depth = 0) {
  const v = side ? W + depth : -depth;
  quad(
    o,
    k,
    [
      [x0, y0, v],
      [x1, y0, v],
      [x1, y1, v],
      [x0, y1, v],
    ],
    [0, 0, side ? 1 : -1],
  );
}
function opening(o, side, x0, x1, y0, y1, detail) {
  if (!detail) {
    sideRect(o, 'glass', side, x0, x1, y0, y1, 0.018);
    return;
  }
  const front = side ? W : 0,
    back = front + (side ? -1 : 1) * A.windowRecess;
  quad(
    o,
    'glass',
    [
      [x0, y0, back],
      [x1, y0, back],
      [x1, y1, back],
      [x0, y1, back],
    ],
    [0, 0, side ? 1 : -1],
  );
  quad(
    o,
    'wood',
    [
      [x0, y0, front],
      [x0, y1, front],
      [x0, y1, back],
      [x0, y0, back],
    ],
    [1, 0, 0],
  );
  quad(
    o,
    'wood',
    [
      [x1, y0, back],
      [x1, y1, back],
      [x1, y1, front],
      [x1, y0, front],
    ],
    [-1, 0, 0],
  );
  quad(
    o,
    'wood',
    [
      [x0, y0, back],
      [x1, y0, back],
      [x1, y0, front],
      [x0, y0, front],
    ],
    [0, 1, 0],
  );
  quad(
    o,
    'wood',
    [
      [x0, y1, front],
      [x1, y1, front],
      [x1, y1, back],
      [x0, y1, back],
    ],
    [0, -1, 0],
  );
  const z = front + (side ? -1 : 1) * 0.08,
    zz = z + (side ? 1 : -1) * 0.06,
    z0 = Math.min(z, zz),
    z1 = Math.max(z, zz);
  const frame = (a, b, c, d) =>
    detail === 3
      ? box(o, 'wood', a, b, c, d, z0, z1)
      : sideRect(o, 'wood', side, a, b, c, d, -0.045);
  for (const x of [x0, x1]) frame(x - 0.06, x + 0.06, y0, y1);
  for (const y of [y0, y1]) frame(x0, x1, y - 0.06, y + 0.06);
  if (detail > 1) {
    for (const t of [1 / 3, 2 / 3]) {
      const x = x0 + (x1 - x0) * t;
      frame(x - 0.025, x + 0.025, y0, y1);
      const y = y0 + (y1 - y0) * t;
      frame(x0, x1, y - 0.025, y + 0.025);
    }
  }
}
function longSide(o, side, detail) {
  const pitch = L / A.longBays;
  if (!detail) sideRect(o, 'brick', side, 0, L, A.plinth, A.eave);
  else {
    for (const [a, b] of [
      [A.plinth, A.windowRanks[0][0]],
      [A.windowRanks[0][1], A.windowRanks[1][0]],
      [A.windowRanks[1][1], A.eave],
    ])
      sideRect(o, 'brick', side, 0, L, a, b);
    for (let i = 0; i <= A.longBays; i++) {
      const x = i * pitch,
        half = (pitch * (1 - A.mainWindowFraction)) / 2;
      sideRect(
        o,
        'brick',
        side,
        Math.max(0, x - half),
        Math.min(L, x + half),
        A.windowRanks[0][0],
        A.windowRanks[0][1],
      );
      sideRect(
        o,
        'brick',
        side,
        Math.max(0, x - half),
        Math.min(L, x + half),
        A.windowRanks[1][0],
        A.windowRanks[1][1],
      );
    }
  }
  for (let i = 0; i < A.longBays; i++) {
    const x = (i + 0.5) * pitch,
      x0 = x - (pitch * A.mainWindowFraction) / 2,
      x1 = x + (pitch * A.mainWindowFraction) / 2;
    for (const [y0, y1] of A.windowRanks) opening(o, side, x0, x1, y0, y1, detail);
  }
  const v = side ? W : 0;
  for (let i = 0; i <= A.longBays; i++) {
    const x = i * pitch;
    if (detail > 1)
      box(
        o,
        'wood',
        Math.max(0, x - 0.11),
        Math.min(L, x + 0.11),
        A.plinth,
        A.eave,
        v - 0.11,
        v + 0.11,
      );
    else
      sideRect(
        o,
        'wood',
        side,
        Math.max(0, x - 0.11),
        Math.min(L, x + 0.11),
        A.plinth,
        A.eave,
        0.025,
      );
  }
  for (const y of [A.plinth, 3.93, 7.25]) {
    if (detail > 1) box(o, 'wood', 0, L, y - 0.095, y + 0.095, v - 0.11, v + 0.11);
    else sideRect(o, 'wood', side, 0, L, y - 0.095, y + 0.095, 0.028);
  }
  box(
    o,
    'metal',
    -0.5,
    L + 0.5,
    A.eave - 0.15,
    A.eave + 0.06,
    side ? W + 0.46 : -0.63,
    side ? W + 0.63 : -0.46,
  );
  if (detail > 1)
    for (let i = 1; i < A.longBays; i += 5) {
      const x = i * pitch;
      box(
        o,
        'metal',
        x - 0.07,
        x + 0.07,
        0.25,
        A.eave,
        side ? W + 0.28 : -0.42,
        side ? W + 0.42 : -0.28,
      );
    }
}
function gable(o, x, eave, ridge, lo, hi, k = 'brick') {
  const n = [x < L / 2 ? -1 : 1, 0, 0];
  quad(
    o,
    k,
    [
      [x, A.plinth, lo],
      [x, A.plinth, hi],
      [x, eave, hi],
      [x, eave, lo],
    ],
    n,
  );
  triangle(
    o,
    k,
    [
      [x, eave, lo],
      [x, eave, hi],
      [x, ridge, (lo + hi) / 2],
    ],
    n,
  );
}
function roof(o, x0, x1, lo, hi, eave, ridge) {
  const mid = (lo + hi) / 2;
  quad(
    o,
    'roof',
    [
      [x0, eave, lo],
      [x1, eave, lo],
      [x1, ridge, mid],
      [x0, ridge, mid],
    ],
    [0, 1, -1],
  );
  quad(
    o,
    'roof',
    [
      [x0, ridge, mid],
      [x1, ridge, mid],
      [x1, eave, hi],
      [x0, eave, hi],
    ],
    [0, 1, 1],
  );
  box(o, 'roof', x0 - 0.05, x1 + 0.05, ridge - 0.04, ridge + 0.16, mid - 0.13, mid + 0.13);
}
function endGlazing(o, x, detail) {
  const outward = x < L / 2 ? -1 : 1,
    front = x + outward * 0.025,
    back = front - outward * 0.22;
  for (const center of [W * 0.25, W * 0.5, W * 0.75]) {
    const a = center - 1.45,
      b = center + 1.45,
      y0 = 4.15,
      y1 = 6.9;
    // An opaque inset covers the unseen backing; side-window recesses remain physical holes.
    quad(
      o,
      'glass',
      [
        [front, y0, a],
        [front, y0, b],
        [front, y1, b],
        [front, y1, a],
      ],
      [outward, 0, 0],
    );
    if (detail === 3) {
      for (const v of [a, (a + b) / 2, b])
        box(
          o,
          'wood',
          Math.min(front, back) - 0.03,
          Math.max(front, back) + 0.03,
          y0,
          y1,
          v - 0.055,
          v + 0.055,
        );
      for (const y of [y0, (y0 + y1) / 2, y1])
        box(
          o,
          'wood',
          Math.min(front, back) - 0.03,
          Math.max(front, back) + 0.03,
          y - 0.055,
          y + 0.055,
          a,
          b,
        );
    }
  }
}
export function buildTomiokaHall(o, _frame, detail = 3) {
  box(o, 'stone', 0, L, -0.2, A.plinth, 0, W);
  longSide(o, 0, detail);
  longSide(o, 1, detail);
  gable(o, 0, A.eave, A.ridge, 0, W);
  gable(o, L, A.eave, A.ridge, 0, W);
  roof(o, -0.75, L + 0.75, -0.65, W + 0.65, A.eave, A.ridge);
  const m0 = 2.5,
    m1 = L - 2.5,
    lo = W / 2 - A.monitorHalfWidth,
    hi = W / 2 + A.monitorHalfWidth;
  for (const v of [lo, hi]) {
    quad(
      o,
      'wood',
      [
        [m0, A.monitorBase, v],
        [m1, A.monitorBase, v],
        [m1, A.monitorEave, v],
        [m0, A.monitorEave, v],
      ],
      [0, 0, v < W / 2 ? -1 : 1],
    );
    if (detail > 1)
      for (let i = 0; i < A.longBays; i++) {
        const x = m0 + ((m1 - m0) * (i + 0.5)) / A.longBays;
        box(o, 'wood', x - 0.05, x + 0.05, A.monitorBase, A.monitorEave, v - 0.065, v + 0.065);
      }
  }
  for (const x of [m0, m1]) {
    const n = [x < L / 2 ? -1 : 1, 0, 0];
    quad(
      o,
      'wood',
      [
        [x, A.monitorBase, lo],
        [x, A.monitorBase, hi],
        [x, A.monitorEave, hi],
        [x, A.monitorEave, lo],
      ],
      n,
    );
    triangle(
      o,
      'brick',
      [
        [x, A.monitorEave, lo],
        [x, A.monitorEave, hi],
        [x, A.monitorRidge, W / 2],
      ],
      n,
    );
  }
  roof(o, m0 - 0.5, m1 + 0.5, lo - 0.35, hi + 0.35, A.monitorEave, A.monitorRidge);
  for (const x of [0, L]) {
    endGlazing(o, x, detail);
    box(o, 'wood', x - 0.12, x + 0.12, A.plinth, A.ridge, W / 2 - 0.13, W / 2 + 0.13);
    box(o, 'wood', x - 0.12, x + 0.12, A.eave - 0.12, A.eave + 0.12, 0, W);
  }
  // Small intrinsic east-end enclosure seen below the historic gable, within the native hall.
  box(o, 'wood', L - A.endAnnexLength, L, 0.6, 3.65, 0.25, W - 0.25);
  roof(o, L - A.endAnnexLength, L + 0.6, -0.3, W + 0.3, 3.5, 4.4);
  if (detail > 1) {
    for (let i = 0; i <= Math.floor(L / 0.9); i++) {
      const x = (L * i) / Math.floor(L / 0.9);
      for (const [v0, v1, top0, top1] of [
        [-0.65, lo - 0.1, A.eave + 0.035, A.ridge - 0.6],
        [hi + 0.1, W + 0.65, A.ridge - 0.6, A.eave + 0.035],
      ]) {
        quad(
          o,
          'roof',
          [
            [x - 0.027, top0, v0],
            [x + 0.027, top0, v0],
            [x + 0.027, top1, v1],
            [x - 0.027, top1, v1],
          ],
          [0, 1, 0],
        );
      }
    }
    for (const x of [L * 0.24, L * 0.64]) {
      box(
        o,
        'wood',
        x - 0.45,
        x + 0.45,
        A.monitorRidge,
        A.monitorRidge + 0.9,
        W / 2 - 0.5,
        W / 2 + 0.5,
      );
      roof(
        o,
        x - 0.65,
        x + 0.65,
        W / 2 - 0.7,
        W / 2 + 0.7,
        A.monitorRidge + 0.9,
        A.monitorRidge + 1.15,
      );
    }
  }
}
export const tomiokaSkyline = (o) => buildTomiokaHall(o, null, 0);
export const tomiokaDistrict = (o) => buildTomiokaHall(o, null, 1);
export const tomiokaStreet = (o) => buildTomiokaHall(o, null, 2);
export const tomiokaCloseup = (o) => buildTomiokaHall(o, null, 3);
export const tomiokaModel = {
  id: 'tomioka_silk_mill',
  key: 'tomioka_silk_mill',
  cell: 'xn/xn6',
  title: 'Tomioka Silk Mill — Silk-reeling Plant',
  recipe: 'tomioka-silk-mill-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  category: 'industrial',
  brief:
    'Complete physical timber-framed brick reeling hall, native four-control envelope, long two-tier glazed elevations, gray tiled gable/raised ventilation monitor, stone base, exposed timber and red rainwater fittings. Separate mill warehouses/residences are independent structures and excluded.',
  surfaces,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/tomioka-runtime-overlay.mjs',
    level: 'skyline',
    export: 'tomiokaSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'tomiokaDistrict', errorMeters: 1.5, surfaces },
      street: { export: 'tomiokaStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'tomiokaCloseup', errorMeters: 0, surfaces },
    },
  },
  build: buildTomiokaHall,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  camera: [180, 100, 155],
  lookAt: [0, 4, 0],
  portableGroundY: -0.25,
  mediumFiContext: { scale: '2.2', groundY: -0.25 },
  qaCameras: [
    {
      name: 'whole-reeling-hall-long-glazed-elevation-monitor-and-native-envelope',
      position: [15, 58, 145],
      lookAt: [0, 4, 0],
    },
    {
      name: 'opposite-long-elevation-and-roof-monitor',
      position: [-20, 55, -150],
      lookAt: [0, 5, 0],
    },
    { name: 'end-gable-and-intrinsic-low-enclosure', position: [115, 21, 45], lookAt: [60, 5, 5] },
    {
      name: 'physical-window-recesses-gray-timber-brick-stone-and-gutters',
      position: [15, 9, 29],
      lookAt: [0, 4, 4],
    },
    {
      name: 'whole-native-roof-outline-monitor-and-end-closures',
      position: [35, 140, 75],
      lookAt: [0, 4, 0],
    },
  ],
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Physical Silk-reeling Plant Q107020325 only; broader site Q7818931/east and west cocoon warehouses/residences/chimney remain separate uncompleted structures. Exact two published creator-PD/CC0 exterior originals only, no copied photos or generated bitmap textures. Native151m envelope differs from operator about140m length and is not survey geometry. Sections/monitor stations/hidden elevations/opening census/low end enclosure are original bounded estimates. Side windows have physical .22m recesses; end glazing is a closed opaque exterior inset without an interior claim. Fine tile relief/roof ornaments/aging/individual brick layout simplified.',
    'Independent400m129x129 source field,16641 values/two rawtiles frozen before floor0/sections; fixed166.0464m provider datum retained. Exact threshold/footing/grade contact unresolved; geographic preview/replaceFootprint=false. No fitting, flattening, reacquisition, landscaping or surrounding ground plate.',
  ],
};

/** Kobe's32 straight outer pipes, open central cage and2024 structural terraces. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad, tube } from './structure-mesh.mjs';

const red = rgb('be302b'),
  white = rgb('e0ded2'),
  glass = rgb('697e80'),
  guard = rgb('c4dce0'),
  grey = rgb('aaa9a1'),
  dark = rgb('414e50');
const tau = Math.PI * 2,
  H = 99.1,
  twist = Math.PI * 0.75,
  phase = Math.PI / 16;
const outerPoint = (a, t, sign = 1) => [
  (1 - t) * 12.5 * Math.sin(a) + t * 7.5 * Math.sin(a + sign * twist),
  0.3 + (H - 0.3) * t,
  (1 - t) * 12.5 * Math.cos(a) + t * 7.5 * Math.cos(a + sign * twist),
];
const radius = (y) => {
  const p = outerPoint(0, (y - 0.3) / (H - 0.3));
  return Math.hypot(p[0], p[2]);
};
function facing(o, a) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]];
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(v), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(v), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(v),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function round(o, slot, levels, n, c, cap = true) {
  loft(
    o,
    slot,
    levels.map(([y, r]) => radialRing(y, r, r, n)),
    c,
    { cap },
  );
}
function band(o, slot, y, r, h, n, c) {
  round(
    o,
    slot,
    [
      [y, r],
      [y + h, r],
    ],
    n,
    c,
    false,
  );
}
function rail(o, y, r, d, c = red, slot = 'red') {
  if (d < 2 || (d === 2 && r < 2)) band(o, slot, y - 0.1, r, 0.2, d === 0 ? 8 : 16, c);
  else torus(o, slot, [0, y, 0], r, 0.11, c, d === 2 ? 24 : 64, d === 2 ? 4 : 6);
}
function frame(o, d) {
  for (let i = 0; i < 16; i++) {
    const a = phase + (i / 16) * tau;
    for (const sign of [-1, 1]) {
      const p = outerPoint(a, 0, sign),
        q = outerPoint(a, 1, sign);
      if (d < 2) beam(o, 'red', p, q, 0.44, 0.44, red);
      else tube(o, 'red', p, q, 0.22, red, d === 2 ? 8 : 12);
    }
  }
  const levels =
    d === 0
      ? [0.3, 12, 29, 47, 65, 75, H]
      : [0.3, 5, 12, 20, 29, 38, 47, 56, 65, 74, 79.5, 84.3, 89.2, 94.1, H];
  for (const y of levels) rail(o, y, radius(y), d);
  if (d > 1) {
    for (let i = 0; i < 16; i++) {
      const a = phase + (i / 16) * tau,
        p = outerPoint(a, 0);
      B(o, 'concrete', p[0], -0.65, p[2], 0.8, 0.93, 0.8, grey);
      if (d > 2) {
        for (const x of [-0.24, 0.24])
          for (const z of [-0.24, 0.24])
            B(o, 'white', p[0] + x, 0.28, p[2] + z, 0.065, 0.06, 0.065, white);
      }
    }
    for (const y of [12, 29, 47, 65, 75])
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * tau;
        beam(
          o,
          'white',
          [Math.sin(a) * 1.9, y, Math.cos(a) * 1.9],
          [Math.sin(a) * (radius(y) - 0.2), y, Math.cos(a) * (radius(y) - 0.2)],
          0.1,
          0.12,
          white,
        );
      }
  }
}
function cage(o, d) {
  const n = d === 0 ? 4 : 8,
    step = d === 3 ? 3.5 : d === 2 ? 7 : 8;
  B(o, 'glass', -0.4, 10.4, 0, 1.05, 65, 1.3, dark);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * tau,
      p = (y) => [Math.sin(a) * 1.85, y, Math.cos(a) * 1.85];
    beam(o, 'white', p(10.5), p(75.2), d === 0 ? 0.22 : 0.13, d === 0 ? 0.22 : 0.13, white);
  }
  if (d > 0)
    for (let y = 11; y < 75; y += step) {
      rail(o, y, 1.85, d, white, 'white');
      for (let i = 0; i < n; i++) {
        const a = (i / n) * tau,
          b = ((i + 1) / n) * tau,
          lo = (t) => [Math.sin(t) * 1.85, y, Math.cos(t) * 1.85],
          hi = (t) => [Math.sin(t) * 1.85, Math.min(75, y + step), Math.cos(t) * 1.85];
        if (d > 1) beam(o, 'white', lo(a), hi(b), 0.055, 0.055, white);
        if (d > 1) beam(o, 'white', lo(b), hi(a), 0.055, 0.055, white);
      }
    }
}
/** Closed glazing behind separate exterior panels and small real reveals. */
function storey(o, y0, y1, r0, r1, d, { upper = false } = {}) {
  const n = d === 0 ? 8 : 16,
    half = Math.PI / n,
    r = (y) => r0 + ((r1 - r0) * (y - y0)) / (y1 - y0),
    p = (u, y, z = 0) => [Math.sin(half) * r(y) * u, y, Math.cos(half) * r(y) - z],
    patch = (q, slot, u0, u1, lo, hi, z, c) => {
      const pp = [p(u0, lo, z), p(u1, lo, z), p(u1, hi, z), p(u0, hi, z)];
      quad(q, slot, pp, normalFor(...pp), c);
    };
  if (d === 0) {
    round(
      o,
      upper ? 'glass' : 'white',
      [
        [y0, r0],
        [y1, r1],
      ],
      n,
      upper ? glass : white,
      false,
    );
    return;
  }
  // The middle low floor is a broad white panel band, not another glazed storey.
  if (!upper && y0 > 3.5 && y0 < 4) {
    round(
      o,
      'white',
      [
        [y0, r0],
        [y1, r1],
      ],
      n,
      white,
      false,
    );
    if (d > 1)
      for (let i = 0; i < n; i++) {
        const q = facing(o, (i / n) * tau);
        for (const u of [-0.92, 0.92])
          beam(q, 'white', p(u, y0 + 0.04), p(u, y1 - 0.04), 0.025, 0.035, grey);
      }
    return;
  }
  for (let i = 0; i < n; i++) {
    const q = facing(o, (i / n) * tau),
      isDoor = !upper && y0 < 1 && i === 0,
      a = upper ? 0.86 : y0 < 1 ? 0.56 : 0.67,
      lo = isDoor ? 0.32 : y0 + (upper ? 0.38 : 1.05),
      hi = y1 - (upper ? 0.23 : 0.42),
      depth = isDoor ? 0.28 : d === 1 ? 0 : 0.12;
    patch(q, 'white', -1, -a, y0, y1, 0, white);
    patch(q, 'white', a, 1, y0, y1, 0, white);
    if (lo > y0) patch(q, 'white', -a, a, y0, lo, 0, white);
    patch(q, 'white', -a, a, hi, y1, 0, white);
    patch(q, 'glass', -a, a, lo, hi, depth, isDoor ? dark : glass);
    if (depth > 0) {
      for (const [u0, u1, yy0, yy1] of [
        [-a, -a, lo, hi],
        [a, a, hi, lo],
      ]) {
        const pp = [p(u0, yy0), p(u1, yy1), p(u1, yy1, depth), p(u0, yy0, depth)];
        quad(q, 'white', pp, normalFor(...pp), white);
      }
      for (const yy of [lo, hi]) {
        const pp = [p(-a, yy), p(a, yy), p(a, yy, depth), p(-a, yy, depth)];
        if (yy === hi) pp.reverse();
        quad(q, 'white', pp, normalFor(...pp), white);
      }
    }
    if (d > 1) {
      const parts = upper && d === 3 ? 3 : 2;
      for (let j = 1; j < parts; j++) {
        const u = -a + (j / parts) * 2 * a;
        beam(q, 'white', p(u, lo, depth - 0.03), p(u, hi, depth - 0.03), 0.055, 0.06, white);
      }
      const y = upper ? lo + (hi - lo) * 0.72 : lo + (hi - lo) * 0.65;
      beam(q, 'white', p(-a, y, depth - 0.03), p(a, y, depth - 0.03), 0.055, 0.06, white);
      if (!upper) {
        for (const u of [-0.92, 0.92])
          beam(q, 'white', p(u, y0 + 0.04), p(u, y1 - 0.04), 0.035, 0.05, grey);
      }
    }
  }
}
const glyphs = {
  P: [
    [
      [0, 0],
      [0, 1],
      [0.62, 1],
      [0.72, 0.84],
      [0.62, 0.56],
      [0, 0.56],
    ],
  ],
  O: [
    [
      [0.12, 0],
      [0, 0.18],
      [0, 0.82],
      [0.12, 1],
      [0.58, 1],
      [0.72, 0.82],
      [0.72, 0.18],
      [0.58, 0],
      [0.12, 0],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.62, 1],
      [0.72, 0.84],
      [0.62, 0.56],
      [0, 0.56],
    ],
    [
      [0.35, 0.56],
      [0.76, 0],
    ],
  ],
  T: [
    [
      [0, 1],
      [0.8, 1],
    ],
    [
      [0.4, 1],
      [0.4, 0],
    ],
  ],
  F: [
    [
      [0, 0],
      [0, 1],
      [0.75, 1],
    ],
    [
      [0, 0.57],
      [0.6, 0.57],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0.75, 1],
      [0, 0.46],
      [0.75, 0],
    ],
  ],
  B: [
    [
      [0, 0],
      [0, 1],
      [0.6, 1],
      [0.72, 0.8],
      [0.6, 0.53],
      [0, 0.53],
    ],
    [
      [0.6, 0.53],
      [0.76, 0.3],
      [0.6, 0],
      [0, 0],
    ],
  ],
  E: [
    [
      [0.75, 0],
      [0, 0],
      [0, 1],
      [0.75, 1],
    ],
    [
      [0, 0.52],
      [0.6, 0.52],
    ],
  ],
};
function sign(o, d) {
  if (d < 2) return;
  const text = 'PORTOFKOBE';
  for (let k = 0; k < 2; k++)
    for (let i = 0; i < text.length; i++) {
      const a = k * Math.PI + (i - 4.5) * 0.28,
        q = facing(o, a);
      for (const path of glyphs[text[i]])
        for (let j = 1; j < path.length; j++) {
          const p = (v) => [(v[0] - 0.38) * 1.65, 99.6 + v[1] * 1.8, 7.68];
          const a = p(path[j - 1]),
            b = p(path[j]);
          if (d === 3) beam(q, 'white', a, b, 0.085, 0.1, white);
          else {
            const dx = b[0] - a[0],
              dy = b[1] - a[1],
              l = Math.hypot(dx, dy),
              v = [(-dy / l) * 0.0425, (dx / l) * 0.0425, 0];
            quad(
              q,
              'white',
              [
                a.map((x, i) => x - v[i]),
                b.map((x, i) => x - v[i]),
                b.map((x, i) => x + v[i]),
                a.map((x, i) => x + v[i]),
              ],
              [0, 0, 1],
              white,
            );
          }
        }
    }
}
function terraces(o, d) {
  const n = d === 0 ? 8 : d === 1 ? 16 : d === 2 ? 32 : 64;
  round(
    o,
    'concrete',
    [
      [-0.65, 12.95],
      [0.2, 12.95],
    ],
    n,
    grey,
  );
  storey(o, 0.2, 3.75, 12.0, 11.1, d);
  storey(o, 3.75, 7.3, 11.1, 10.1, d);
  storey(o, 7.3, 10.6, 10.1, 9.15, d);
  for (const [y, r] of [
    [0.2, 12.05],
    [3.75, 11.2],
    [7.3, 10.2],
    [10.6, 9.3],
  ])
    band(o, 'white', y, r, 0.17, d === 0 ? 8 : 32, white);
  // The fourth low level is an open structural terrace, not a fourth enclosed cylinder.
  round(
    o,
    'white',
    [
      [10.65, 9.1],
      [10.85, 9.1],
    ],
    n,
    white,
  );
  band(o, 'guard', 10.85, 9.0, 1.2, n, guard);
  if (d > 0)
    for (let i = 0; i < (d === 1 ? 8 : 16); i++) {
      const a = (i / (d === 1 ? 8 : 16)) * tau;
      beam(
        o,
        'white',
        [Math.sin(a) * 9, 10.85, Math.cos(a) * 9],
        [Math.sin(a) * 9, 12.1, Math.cos(a) * 9],
        0.06,
        0.06,
        white,
      );
    }
  rail(o, 12.1, 9, d, white, 'white');
  for (let j = 0; j < 5; j++) {
    const y = 75.2 + (j * (H - 75.2)) / 5,
      hi = 75.2 + ((j + 1) * (H - 75.2)) / 5;
    storey(o, y, hi, radius(y) - 0.38, radius(hi) - 0.38, d, { upper: true });
    band(o, 'white', y, radius(y) - 0.32, 0.22, d === 0 ? 8 : 32, white);
  }
  round(
    o,
    'white',
    [
      [99.1, 7.45],
      [99.32, 7.45],
    ],
    n,
    white,
  );
  band(o, 'guard', 99.32, 7.25, 2.1, n, guard);
  if (d > 0)
    for (let i = 0; i < (d === 1 ? 16 : 32); i++) {
      const a = (i / (d === 1 ? 16 : 32)) * tau;
      beam(
        o,
        'white',
        [Math.sin(a) * 7.25, 99.32, Math.cos(a) * 7.25],
        [Math.sin(a) * 7.25, 101.47, Math.cos(a) * 7.25],
        0.06,
        0.06,
        white,
      );
    }
  rail(o, 101.47, 7.25, d, white, 'white');
  B(o, 'white', 0, 99.32, -1.8, 2.0, 2.1, 2.1, white);
  if (d > 0) B(o, 'glass', 0, 99.5, -0.742, 1.1, 1.55, 0.03, glass);
  tube(o, 'white', [0, 101.42, 0], [0, 108, 0], 0.055, white, d < 2 ? 4 : 8);
  sign(o, d);
  if (d > 0) {
    B(o, 'red', 0, 2.85, 12.15, 3.2, 0.15, 1.1, red);
    B(o, 'white', 0, 0.2, 12.25, 3.2, 0.12, 1.1, white);
  }
}
export function kobePortTower(o, _frame, d = 3) {
  frame(o, d);
  cage(o, d);
  terraces(o, d);
}
export const kobePortTowerSkyline = (o) => kobePortTower(o, undefined, 0);
export const kobePortTowerDistrict = (o) => kobePortTower(o, undefined, 1);
export const kobePortTowerStreet = (o) => kobePortTower(o, undefined, 2);
const surfaces = {
  red: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.15 },
  white: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.15 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.25, metallic: 0.1 },
  guard: {
    slot: 'window',
    localRef: 'palette:#d7eef0',
    roughness: 0.2,
    metallic: 0,
    baseColorFactor: [1, 1, 1, 0.27],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
};
export const kobePortTowerModel = {
  id: 'kobe_port_tower',
  key: 'kobe_port_tower',
  recipe: 'structure-kobe-port-tower.mjs',
  cell: 'xn/xn0',
  title: 'Kobe Port Tower',
  brief:
    'Red32-straight-member hourglass lattice tower, open white central circulation cage, five flaring upper glazed floors, low white three-storey circular entrance base and2024 structural roof/low glass terraces. PORT OF KOBE lettering and lightning tip. Separate Kiss FM building, museum, waterfront fixtures and renovation wrap excluded.',
  camera: [-66, 63, 100],
  lookAt: [0, 48, 0],
  qaCameras: [
    { name: 'front', position: [0, 54, 220], lookAt: [0, 51, 0] },
    { name: 'front-detail', position: [-16, 103, 25], lookAt: [0, 94, 0] },
    { name: 'back', position: [130, 68, -185], lookAt: [0, 49, 0] },
    { name: 'base-detail', position: [-22, 12, 35], lookAt: [0, 7, 0] },
    { name: 'waist-detail', position: [-13, 52, 20], lookAt: [0, 54, 0] },
  ],
  mediumFiContext: { scale: 1.2 },
  build: kobePortTower,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Dry south approach[0,14.5] establishes independent GSI5A datum1.7483m. All16641 samples are valid original5A interpolation with two retained source tiles;1A unavailable. Native footprint spans-.160..+.078m. Own footing-.65m to cap+.2m and threshold+.32m meet the unchanged grade. Mapped circular anchor and global axes reviewed; precise entry azimuth remains an authored approximation. Bounded preview, footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-kobe-port-tower.mjs',
    level: 'skyline',
    export: 'kobePortTowerSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'kobePortTowerDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'kobePortTowerStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    'Primary25m/15m frame diameters,99.1m eaves,108m lightning tip and32 straight pipes guide scale/geometry. Cleared Qualla2019 CC0 original first, then three verified creator-CC0 waterfront2019/renovated2024/2025 originals control exterior comparison. Earlier CC/operator/aerial imagery is excluded. Temporary lighting/event artwork is not modeled.',
    'Tube gauges, intermediate rings, cage bracing, window divisions, sign spacing, rooftop service return and entrance azimuth remain authored estimates; no construction survey. Interiors excluded apart from visible structural circulation cage. Transparent guard material is a bounded glass approximation.',
    'Separate Kiss FM building, museum, pedestrian bridge, waterfront pavement/fixtures, tables/chairs/parasols and branding excluded. No photographic pixels redistributed. Independent native GSI5A ground preserved unchanged; own footing contact reviewed as a bounded preview. Other host terrain remains unverified; footprint replacement disabled.',
  ],
};

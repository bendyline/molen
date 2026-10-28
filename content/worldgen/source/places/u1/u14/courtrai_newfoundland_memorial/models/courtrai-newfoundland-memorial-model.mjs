/** Original continuous caribou sculpture and artificial granite pedestal, in the native memorial frame. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  f = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  u = A.headDirection,
  v = [-u[1], u[0]],
  R = f.geometry.outline
    .slice(0, -1)
    .map((q) => [q[0] * u[0] + q[1] * u[1], q[0] * v[0] + q[1] * v[1]]),
  TAU = 2 * Math.PI;
const C = {
  bronze: rgb('9b9388'),
  stone: rgb('e1e0d6'),
  dark: rgb('252b28'),
  patina: rgb('5f6258'),
};
export const surfaces = {
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.68, metallic: 0.64 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
  dark: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.78, metallic: 0.2 },
};
const sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / (Math.hypot(...a) || 1)),
  area = (r) =>
    r.reduce((s, a, i) => {
      const b = r[(i + 1) % r.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0),
  G = ([x, y, z]) => [u[0] * x + v[0] * z, F + y, u[1] * x + v[1] * z],
  GN = ([x, y, z]) => [u[0] * x + v[0] * z, y, u[1] * x + v[1] * z];
export const partEvidence = [],
  hoofEvidence = [],
  antlerEvidence = [],
  nativeEvidence = [],
  mouthEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map(G).map((q) => q.map(Math.fround));
  const raw = cross(sub(q[1], q[0]), sub(q[2], q[0])),
    N = n && GN(n);
  if (Math.hypot(...raw) < 1e-8) throw Error('Collapsed authored sculpture triangle');
  if (N && dot(raw, N) < 0) [q[1], q[2]] = [q[2], q[1]];
  const normal = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normal,
    q.map((q) => (Math.abs(normal[1]) > 0.8 ? [q[0], q[2]] : [q[0] + q[2], q[1]])),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function triangulate(r) {
  const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ids = r.map((_, i) => i),
    out = [];
  if (area(r) < 0) ids.reverse();
  while (ids.length > 3) {
    let found = false;
    for (let j = 0; j < ids.length; j++) {
      const a = ids[(j + ids.length - 1) % ids.length],
        b = ids[j],
        c = ids[(j + 1) % ids.length];
      if (cr(r[a], r[b], r[c]) < 1e-9) continue;
      if (
        ids.some(
          (k) =>
            k !== a &&
            k !== b &&
            k !== c &&
            cr(r[a], r[b], r[k]) >= -1e-9 &&
            cr(r[b], r[c], r[k]) >= -1e-9 &&
            cr(r[c], r[a], r[k]) >= -1e-9,
        )
      )
        continue;
      out.push([a, b, c]);
      ids.splice(j, 1);
      found = true;
      break;
    }
    if (!found) throw Error('Invalid source ring');
  }
  out.push(ids);
  return out;
}
function cap(o, k, r, y, up = true, col) {
  for (const ids of triangulate(r))
    T(
      o,
      k,
      ids.map((i) => [r[i][0], typeof y === 'function' ? y(r[i]) : y, r[i][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function catmull(points, subdivisions) {
  const out = [];
  for (let j = 0; j < points.length - 1; j++)
    for (let i = 0; i < subdivisions; i++) {
      const t = i / subdivisions,
        t2 = t * t,
        t3 = t2 * t,
        a = points[Math.max(0, j - 1)],
        b = points[j],
        c = points[j + 1],
        d = points[Math.min(points.length - 1, j + 2)];
      out.push(
        b.map(
          (v, k) =>
            0.5 *
            (2 * v +
              (-a[k] + c[k]) * t +
              (2 * a[k] - 5 * v + 4 * c[k] - d[k]) * t2 +
              (-a[k] + 3 * v - 3 * c[k] + d[k]) * t3),
        ),
      );
    }
  out.push(points.at(-1).slice());
  return out;
}
/** Continuous elliptical path skins, tapered at joints and caps; no stacked primitive body masses. */
function skin(o, name, controls, lod, scale = 1, col = C.bronze) {
  const seg = Math.max(4, Math.round([6, 10, 18, 30][lod] * scale)),
    steps = [1, 2, 4, 7][lod],
    ps = catmull(controls, steps),
    rings = [],
    centers = [];
  for (let j = 0; j < ps.length; j++) {
    const p = ps[j],
      c = p.slice(0, 3),
      t = unit(
        sub(ps[Math.min(j + 1, ps.length - 1)].slice(0, 3), ps[Math.max(0, j - 1)].slice(0, 3)),
      ),
      ref = Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0],
      u = unit(
        sub(
          ref,
          t.map((x) => x * dot(ref, t)),
        ),
      ),
      v = cross(t, u),
      r1 = Math.max(0.008, p[3]),
      r2 = Math.max(0.008, p[4]);
    centers.push(c);
    rings.push(
      Array.from({ length: seg }, (_, i) => {
        const a = (TAU * i) / seg;
        return c.map((x, k) => x + u[k] * r1 * Math.cos(a) + v[k] * r2 * Math.sin(a));
      }),
    );
  }
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < seg; i++) {
      const k = (i + 1) % seg,
        q = [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]],
        mid = q[0].map(
          (x, k) => (x + q[1][k] + q[2][k] + q[3][k]) / 4 - (centers[j][k] + centers[j + 1][k]) / 2,
        );
      Q(o, 'bronze', q, mid, col);
    }
  for (const [j, sign] of [
    [0, -1],
    [rings.length - 1, 1],
  ]) {
    const c = centers[j],
      n = unit(sub(centers[Math.min(j + 1, centers.length - 1)], centers[Math.max(0, j - 1)])).map(
        (x) => x * sign,
      );
    for (let i = 0; i < seg; i++) T(o, 'bronze', [c, rings[j][i], rings[j][(i + 1) % seg]], n, col);
  }
  partEvidence.push({
    name,
    controlCount: controls.length,
    segments: seg,
    samples: ps.length,
    closed: true,
  });
}
function pebble(o, k, c, r, lod, col = C[k]) {
  const seg = [4, 6, 10, 16][lod],
    lat = [2, 3, 5, 8][lod],
    rings = [];
  for (let j = 1; j < lat; j++) {
    const t = -Math.PI / 2 + (Math.PI * j) / lat;
    rings.push(
      Array.from({ length: seg }, (_, i) => [
        c[0] + r[0] * Math.cos(t) * Math.cos((TAU * i) / seg),
        c[1] + r[1] * Math.sin(t),
        c[2] + r[2] * Math.cos(t) * Math.sin((TAU * i) / seg),
      ]),
    );
  }
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < seg; i++) {
      const q = [
        rings[j][i],
        rings[j][(i + 1) % seg],
        rings[j + 1][(i + 1) % seg],
        rings[j + 1][i],
      ];
      Q(o, k, q, sub(q[0], c), col);
    }
  for (const [j, y, sign] of [
    [0, c[1] - r[1], -1],
    [rings.length - 1, c[1] + r[1], 1],
  ])
    for (let i = 0; i < seg; i++)
      T(o, k, [[c[0], y, c[2]], rings[j][i], rings[j][(i + 1) % seg]], [0, sign, 0], col);
}
export const stoneTop = (x, z) =>
  A.pedestalRidgeDatum + A.pedestalRidgeRisePerMeter * x + 0.015 * z;
function insideRing(q) {
  let yes = false;
  for (let i = 0, j = R.length - 1; i < R.length; j = i++) {
    const a = R[i],
      b = R[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function rockLedges(o, lod) {
  const stones = [
    [-1.9, 0.5, -0.9, 1.5, 0.9, 1.1],
    [0.3, 0.6, -1.1, 1.9, 0.9, 1.0],
    [1.7, 0.8, -0.6, 1.4, 0.9, 1.2],
    [-1.5, 0.9, 0.8, 1.6, 1.0, 1.0],
    [0.4, 0.7, 1.0, 1.8, 0.8, 1.1],
    [1.9, 0.8, 0.5, 1.1, 1.0, 1.0],
    [-1.1, 1.7, -0.7, 1.8, 0.75, 0.9],
    [0.6, 1.8, -0.65, 1.5, 0.9, 0.85],
    [1.2, 2.45, -0.1, 1.2, 0.6, 0.9],
    [-1.7, 2.1, 0.15, 1.3, 0.9, 0.9],
    [-0.3, 2.3, 0.4, 1.6, 0.7, 0.8],
    [0.9, 1.7, 0.8, 1.3, 0.8, 0.8],
    [-2.15, 1.2, 0, 1, 0.7, 1.2],
    [1.65, 1.55, -0.3, 1.2, 0.6, 1.1],
  ];
  const selected =
      lod === 0
        ? [stones[0], stones[2], stones[6], stones[9]]
        : stones.slice(0, lod === 1 ? 9 : stones.length),
    N = lod === 0 ? 4 : 6;
  for (let j = 0; j < selected.length; j++) {
    const [x, y, z, w, h, d] = selected[j],
      plans = Array.from({ length: N }, (_, i) => {
        const a = (TAU * (i + 0.12 * (j % 2))) / N;
        let q = [x + w * 0.6 * Math.cos(a), z + d * 0.6 * Math.sin(a)];
        while (!insideRing(q)) q = q.map((v) => v * 0.96);
        return q;
      }),
      lo = plans.map(([x, z], i) => [x, y - h * 0.5 + 0.07 * Math.sin(i + j), z]),
      hi = plans.map(([xx, zz], i) => [
        x + (xx - x) * (0.83 + 0.06 * Math.sin(i * 3 + j)),
        Math.min(2.79, y + h * 0.5 + 0.1 * Math.sin(i * 2.2 + j)),
        z + (zz - z) * (0.87 + 0.07 * Math.cos(i + j)),
      ]),
      col = C.stone.map((c) => c * (0.92 + 0.065 * Math.sin(j * 2.1)));
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N;
      Q(
        o,
        'stone',
        [lo[i], lo[k], hi[k], hi[i]],
        [lo[i][0] + lo[k][0] - 2 * x, 0.1, lo[i][2] + lo[k][2] - 2 * z],
        col,
      );
    }
    const lowPlan = lo.map((q) => [q[0], q[2]]),
      highPlan = hi.map((q) => [q[0], q[2]]);
    for (const ids of triangulate(lowPlan))
      T(
        o,
        'stone',
        ids.map((i) => lo[i]),
        [0, -1, 0],
        col,
      );
    for (const ids of triangulate(highPlan))
      T(
        o,
        'stone',
        ids.map((i) => hi[i]),
        [0, 1, 0],
        col,
      );
  }
}
function pedestal(o, lod) {
  const N = R.length,
    angles = R.map((q) => Math.atan2(q[1], q[0])),
    levels =
      lod === 0
        ? [
            { y: 0, scale: 1 },
            { y: 1.15, scale: 0.76 },
            { y: 2.15, scale: 0.61 },
          ]
        : [
            { y: 0, scale: 1 },
            { y: 0.55, scale: 0.88 },
            { y: 1.35, scale: 0.7 },
            { y: 2.15, scale: 0.6 },
          ],
    rings = levels.map(({ y, scale }, j) =>
      R.map((q, i) => [
        q[0] * scale + 0.06 * j,
        y + (j ? Math.sin(i * 2.13 + j) * 0.2 : 0),
        q[1] * scale,
      ]),
    );
  rings.push(
    angles.map((a) => {
      const x = -0.25 + 2.25 * Math.cos(a),
        z = 0.67 * Math.sin(a);
      return [x, stoneTop(x, z), z];
    }),
  );
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N,
        q = [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]],
        n = [q[0][0] + q[1][0], 0.15, q[0][2] + q[1][2]],
        col = C.stone.map((c) => c * (0.91 + 0.07 * Math.sin(i * 2.9 + j)));
      Q(o, 'stone', q, n, col);
    }
  cap(o, 'stone', R, 0, false);
  const top = rings.at(-1).map((q) => [q[0], q[2]]);
  cap(o, 'stone', top, (q) => stoneTop(q[0], q[1]));
  for (const q of f.geometry.outline.slice(0, -1)) nativeEvidence.push(q.slice());
  rockLedges(o, lod);
  // Plain bronze plaque carrier only; no copied inscription or lettering.
  const n = unit([-0.65, 0.76]),
    a = [n[0] * 2.14, 0.6, n[1] * 2.14],
    t = [-n[1], n[0]],
    q = [
      [-0.47, 0],
      [0.47, 0],
      [0.47, 0.23],
      [-0.47, 0.23],
    ].map(([x, y]) => [a[0] + t[0] * x, a[1] + y, a[2] + t[1] * x]);
  Q(
    o,
    'bronze',
    q,
    [n[0], 0, n[1]],
    C.bronze.map((x) => x * 0.65),
  );
}
function hoof(o, name, x, z, lod) {
  const y = stoneTop(x, z),
    pieces = lod === 0 ? [0] : [-1, 1];
  for (const side of pieces) {
    const w = lod === 0 ? 0.115 : 0.047,
      zz = z + side * 0.064,
      ring = Array.from({ length: lod === 0 ? 4 : 8 }, (_, i) => [
        x + 0.15 * Math.cos((TAU * i) / (lod === 0 ? 4 : 8)),
        zz + w * Math.sin((TAU * i) / (lod === 0 ? 4 : 8)),
      ]);
    const color = C.bronze.map((x) => x * 0.74),
      sign = Math.sign(area(ring));
    cap(o, 'bronze', ring, (q) => stoneTop(q[0], q[1]) + 0.005, false, color);
    cap(o, 'bronze', ring, (q) => stoneTop(q[0], q[1]) + 0.13, true, color);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        ya = stoneTop(...a),
        yb = stoneTop(...b);
      Q(
        o,
        'bronze',
        [
          [a[0], ya + 0.005, a[1]],
          [b[0], yb + 0.005, b[1]],
          [b[0], yb + 0.13, b[1]],
          [a[0], ya + 0.13, a[1]],
        ],
        [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
        color,
      );
    }
  }
  hoofEvidence.push({ name, point: [x, y, z], split: lod > 0 });
  return y + 0.13;
}
function body(o, lod) {
  skin(
    o,
    'continuous-torso',
    [
      [-1.43, 4.61, 0, 0.035, 0.04],
      [-1.19, 4.62, 0, 0.34, 0.43],
      [-0.76, 4.66, 0, 0.46, 0.52],
      [-0.2, 4.65, 0, 0.48, 0.53],
      [0.39, 4.68, 0, 0.44, 0.56],
      [0.78, 4.73, 0, 0.4, 0.61],
      [1.02, 4.77, 0, 0.19, 0.32],
    ],
    lod,
  );
  skin(
    o,
    'shoulder-neck-and-raised-throat',
    [
      [0.67, 4.58, 0, 0.31, 0.46],
      [0.83, 4.96, 0, 0.37, 0.49],
      [1.03, 5.32, 0, 0.32, 0.43],
      [1.25, 5.63, 0, 0.25, 0.35],
      [1.43, 5.82, 0, 0.17, 0.18],
    ],
    lod,
    0.92,
  );
  skin(
    o,
    'sculpted-skull',
    [
      [1.13, 5.72, 0, 0.13, 0.19],
      [1.36, 5.79, 0, 0.23, 0.27],
      [1.58, 5.9, 0, 0.18, 0.19],
      [1.74, 5.98, 0, 0.14, 0.13],
    ],
    lod,
    0.8,
  );
  skin(
    o,
    'upper-muzzle-and-raised-nose',
    [
      [1.55, 5.92, 0, 0.15, 0.15],
      [1.78, 6.02, 0, 0.18, 0.125],
      [1.98, 6.075, 0, 0.17, 0.09],
      [2.1, 6.07, 0, 0.06, 0.06],
    ],
    lod,
    0.7,
  );
  skin(
    o,
    'lower-jaw-open-mouth',
    [
      [1.36, 5.63, 0, 0.13, 0.15],
      [1.62, 5.72, 0, 0.15, 0.09],
      [1.85, 5.84, 0, 0.135, 0.055],
      [2.035, 5.88, 0, 0.075, 0.035],
    ],
    lod,
    0.6,
  );
  mouthEvidence.push({ center: [2.07, 5.94, 0], back: [1.68, 5.89, 0] });
  skin(
    o,
    'heavy-brisket-and-dewlap',
    [
      [0.85, 5.35, 0, 0.24, 0.17],
      [1.0, 5.17, 0, 0.26, 0.26],
      [1.03, 4.91, 0, 0.22, 0.22],
      [0.93, 4.72, 0, 0.1, 0.11],
    ],
    lod,
    0.65,
  );
  const legs = [
    {
      name: 'front-near',
      x: 0.84,
      z: -0.29,
      controls: [
        [0.68, 4.59, -0.3, 0.17, 0.2],
        [0.86, 4.24, -0.31, 0.12, 0.15],
        [0.82, 3.9, -0.3, 0.09, 0.1],
        [0.87, 3.47, -0.29, 0.07, 0.07],
      ],
    },
    {
      name: 'front-far',
      x: 0.62,
      z: 0.3,
      controls: [
        [0.61, 4.55, 0.27, 0.15, 0.18],
        [0.66, 4.17, 0.29, 0.1, 0.12],
        [0.6, 3.85, 0.3, 0.075, 0.08],
        [0.62, 3.43, 0.3, 0.065, 0.07],
      ],
    },
    {
      name: 'hind-near-bent',
      x: -0.57,
      z: -0.3,
      controls: [
        [-1.05, 4.65, -0.28, 0.2, 0.29],
        [-0.75, 4.25, -0.34, 0.18, 0.22],
        [-0.53, 4.04, -0.35, 0.11, 0.13],
        [-0.92, 3.56, -0.32, 0.075, 0.08],
        [-0.74, 3.22, -0.3, 0.06, 0.07],
      ],
    },
    {
      name: 'hind-far-extended',
      x: -1.92,
      z: 0.27,
      controls: [
        [-1.13, 4.6, 0.27, 0.18, 0.25],
        [-1.3, 4.16, 0.3, 0.13, 0.16],
        [-1.55, 3.73, 0.3, 0.08, 0.1],
        [-1.78, 3.27, 0.28, 0.065, 0.07],
      ],
    },
  ];
  for (const l of legs) {
    const y = hoof(o, l.name, l.x, l.z, lod);
    skin(o, l.name, [...l.controls, [l.x, y + 0.045, l.z, 0.065, 0.07]], lod, 0.62);
  }
  skin(
    o,
    'short-tail',
    [
      [-1.27, 4.83, 0, 0.11, 0.13],
      [-1.5, 4.68, 0, 0.09, 0.1],
      [-1.57, 4.59, 0, 0.025, 0.04],
    ],
    lod,
    0.5,
  );
  for (const side of [-1, 1]) {
    skin(
      o,
      `pointed-ear-${side}`,
      [
        [1.24, 5.89, side * 0.17, 0.045, 0.045],
        [1.04, 5.99, side * 0.4, 0.11, 0.07],
        [0.79, 6.01, side * 0.59, 0.075, 0.05],
        [0.69, 6.0, side * 0.62, 0.01, 0.014],
      ],
      lod,
      0.5,
    );
    if (lod >= 1) {
      pebble(
        o,
        'bronze',
        [1.49, 5.86, side * 0.2],
        [0.075, 0.045, 0.026],
        Math.min(lod, 2),
        C.bronze.map((x) => x * 0.85),
      );
      if (lod >= 2) {
        pebble(o, 'dark', [1.5, 5.87, side * 0.222], [0.033, 0.022, 0.009], Math.min(lod, 2));
        skin(
          o,
          `brow-${side}`,
          [
            [1.38, 5.93, side * 0.18, 0.02, 0.02],
            [1.48, 5.945, side * 0.22, 0.025, 0.025],
            [1.58, 5.93, side * 0.18, 0.012, 0.012],
          ],
          lod,
          0.35,
        );
        pebble(o, 'dark', [2.0, 6.11, side * 0.13], [0.04, 0.025, 0.017], Math.min(lod, 2));
      }
    }
  }
  if (lod >= 2)
    for (const side of [-1, 1])
      for (let i = 0; i < (lod === 2 ? 5 : 12); i++) {
        const t = i / (lod === 2 ? 4 : 11),
          x = 0.93 + 0.22 * t,
          y = 4.85 + 0.47 * t,
          z = side * (0.19 + 0.03 * Math.sin(t * 5));
        skin(
          o,
          `original-fur-lock-${side}-${i}`,
          [
            [x - 0.07, y + 0.09, z, 0.025, 0.03],
            [x, y, z + side * 0.018, 0.03, 0.04],
            [x + 0.025, y - 0.08, z, 0.008, 0.012],
          ],
          Math.min(lod, 2),
          0.27,
          C.bronze.map((c) => c * (0.9 + 0.05 * Math.sin(i))),
        );
      }
}
function plate(o, r, side, lod) {
  const sign = Math.sign(area(r)),
    Z = ([x, y]) => side * (0.34 + 0.4 * (1 - x) + 0.11 * (y - 6.2)),
    thick = lod === 0 ? 0.045 : 0.035,
    P = (q, d) => [q[0], q[1], Z(q) + d];
  const center = r.reduce((s, q) => [s[0] + q[0] / r.length, s[1] + q[1] / r.length], [0, 0]),
    inner = lod >= 2 ? r.map((q) => q.map((v, i) => center[i] + (v - center[i]) * 0.97)) : r;
  for (const d of [-thick, thick])
    for (const ids of triangulate(inner))
      T(
        o,
        'bronze',
        ids.map((i) => P(inner[i], d)),
        d > 0 ? [0.4 * side, -0.11 * side, 1] : [-0.4 * side, 0.11 * side, -1],
      );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      n = [sign * (b[1] - a[1]), sign * (a[0] - b[0]), 0];
    if (lod >= 2) {
      for (const d of [-thick, thick])
        Q(o, 'bronze', [P(a, 0), P(b, 0), P(inner[(i + 1) % r.length], d), P(inner[i], d)], n);
    } else Q(o, 'bronze', [P(a, -thick), P(b, -thick), P(b, thick), P(a, thick)], n);
  }
}
function antlers(o, lod) {
  for (const side of [-1, 1]) {
    const dy = side === 1 ? -0.12 : 0;
    const beam = [
      [1.26, 5.99, side * 0.16, 0.065, 0.07],
      [1.05, 6.2, side * 0.35, 0.075, 0.07],
      [0.72, 6.36, side * 0.5, 0.07, 0.065],
      [0.36, 6.48, side * 0.68, 0.055, 0.06],
      [0.16, 6.76 + dy, side * 0.86, 0.025, 0.03],
    ];
    skin(o, `antler-main-beam-${side}`, beam, lod, 0.42);
    antlerEvidence.push({ side, root: beam[0].slice(0, 3), tip: beam.at(-1).slice(0, 3) });
    const r =
      lod === 0
        ? [
            [0.91, 6.24],
            [0.57, 6.36],
            [0.22, 6.55],
            [0.03, 7.11],
            [0.16, 6.91],
            [0.37, 7.23],
            [0.4, 6.88],
            [0.75, 7.08],
            [0.65, 6.76],
            [1.04, 6.95],
            [0.86, 6.54],
            [1.12, 6.65],
          ]
        : [
            [0.91, 6.24],
            [0.63, 6.35],
            [0.4, 6.43],
            [0.25, 6.56],
            [0.05, 6.87],
            [0, 7.13],
            [0.08, 7.08],
            [0.16, 6.91],
            [0.23, 6.96],
            [0.34, 7.2],
            [0.42, 7.23],
            [0.39, 6.98],
            [0.48, 6.92],
            [0.69, 7.1],
            [0.76, 7.08],
            [0.64, 6.86],
            [0.7, 6.79],
            [0.98, 6.96],
            [1.06, 6.92],
            [0.87, 6.68],
            [0.91, 6.56],
            [1.12, 6.68],
            [1.17, 6.62],
            [1.02, 6.4],
          ];
    plate(
      o,
      r.map(([x, y]) => [x + (side === 1 ? 0.08 : 0), y + dy]),
      side,
      lod,
    );
    const branches = [
      [
        [1.04, 6.21, side * 0.35, 0.055, 0.055],
        [1.31, 6.29, side * 0.46, 0.05, 0.045],
        [1.56, 6.49 + dy, side * 0.51, 0.008, 0.012],
      ],
      [
        [0.74, 6.36, side * 0.5, 0.045, 0.045],
        [0.84, 6.54, side * 0.74, 0.04, 0.035],
        [0.86, 6.7 + dy, side * 0.98, 0.008, 0.01],
      ],
      [
        [0.42, 6.45, side * 0.64, 0.04, 0.04],
        [0.16, 6.51, side * 1.02, 0.035, 0.03],
        [-0.09, 6.7 + dy, side * 1.14, 0.008, 0.01],
      ],
    ];
    for (let i = 0; i < (lod === 0 ? 1 : branches.length); i++)
      skin(o, `open-antler-fork-${side}-${i}`, branches[i], lod, 0.34);
    if (lod >= 2)
      for (let i = 0; i < 2; i++)
        skin(
          o,
          `fine-antler-tine-${side}-${i}`,
          [
            [1.36 - i * 0.5, 6.34 + i * 0.13, side * (0.46 + i * 0.4), 0.025, 0.025],
            [1.46 - i * 0.57, 6.43 + i * 0.2, side * (0.5 + i * 0.45), 0.02, 0.02],
            [1.49 - i * 0.6, 6.57 + i * 0.2 + dy, side * (0.52 + i * 0.47), 0.008, 0.01],
          ],
          lod,
          0.28,
        );
  }
}
export function buildCourtraiNewfoundland(o, _frame, lod = 3) {
  partEvidence.length = 0;
  hoofEvidence.length = 0;
  antlerEvidence.length = 0;
  nativeEvidence.length = 0;
  mouthEvidence.length = 0;
  pedestal(o, lod);
  body(o, lod);
  antlers(o, lod);
}
export const courtraiSkyline = (o) => buildCourtraiNewfoundland(o, null, 0),
  courtraiDistrict = (o) => buildCourtraiNewfoundland(o, null, 1),
  courtraiStreet = (o) => buildCourtraiNewfoundland(o, null, 2),
  courtraiCloseup = (o) => buildCourtraiNewfoundland(o, null, 3);
const camera = (q) => G(q);
export const courtraiNewfoundlandModel = {
  id: 'courtrai_newfoundland_memorial',
  key: 'courtrai_newfoundland_memorial',
  cell: 'u1/u14',
  title: 'Courtrai Newfoundland Memorial',
  wikidataId: 'Q5178692',
  category: p.category,
  recipe: 'courtrai-newfoundland-memorial-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  embeddedCanonicalGraphs: ['metal_bronze_cast', 'stone_granite'],
  build: buildCourtraiNewfoundland,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'native-map-frame',
  groundContactBasis: p.sectionBasis,
  brief:
    'Whole specific Courtrai/Kortrijk Newfoundland Memorial: original continuous bronze caribou with raised head/tapered muzzle/open mouth/eyes/brows/pointed ears/dewlap/shaggy chest, full torso/haunches/four distinct straight or bent legs/cloven hooves/short tail, two branching palmate antlers with open forks/airspace, and complete irregular artificial pale laid-rock pedestal/plain plaque carrier within native19control memorial envelope. Seven exact published2017Karmakolleown/selfCC0 originals; no source pixels/inscriptions/park/planting/paths/trees/neighbors copied. Fine anatomy/fur/antler/rock census/hidden profiles and exact bearing bounded original estimates.',
  sunDirection: GN([10, 14, 12]),
  camera: camera([12, 8, 15]),
  lookAt: camera([0, 3.6, 0]),
  portableGroundY: F - 0.18,
  mediumFiContext: { scale: '1.1', groundY: F - 0.1 },
  qaCameras: [
    {
      name: 'whole-opposite-side-and-complete-rock-base',
      position: camera([-0.3, 6.4, -16]),
      lookAt: camera([0, 3.5, 0]),
    },
    {
      name: 'raised-head-open-mouth-eyes-and-ears',
      position: camera([5.5, 6.7, 4.5]),
      lookAt: camera([1.46, 5.86, 0]),
    },
    {
      name: 'two-palmate-branched-antlers-and-open-airspaces',
      position: camera([0.6, 8.3, 6]),
      lookAt: camera([0.6, 6.55, 0]),
    },
    {
      name: 'four-legged-pose-split-hooves-and-pedestal-contacts',
      position: camera([4.2, 4.6, 5]),
      lookAt: camera([-0.15, 3.7, 0]),
    },
    {
      name: 'whole-artificial-laid-rock-pedestal-and-plain-plaque',
      position: camera([6.5, 3.9, 8.5]),
      lookAt: camera([0, 1.5, 0]),
    },
    {
      name: 'native-whole-memorial-plan',
      position: camera([0, 18, 0.1]),
      lookAt: camera([0, 2, 0]),
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/courtrai-newfoundland-runtime-overlay.mjs',
    level: 'skyline',
    export: 'courtraiSkyline',
    errorMeters: 1.1,
    surfaces,
    authoredLevels: {
      district: { export: 'courtraiDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'courtraiStreet', errorMeters: 0.08, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Seven exact cleared published2017Karmakolleown/selfCC0 originals individually inspected/nativeSHA1 matched; no supplemental imagery, copied pixels/photo textures/source metadata repair/reclassification. Sculptural anatomy/antlers/fur/stone census/hidden rear/currentfinish and exact figure bearing are original medium-fi approximations, not photogrammetry. Whole native19control memorial extent is conservative physical scope, not individual rock survey; separate park/planting/paths/trees/neighbors excluded. Plain plaque carrier omits inscription/text.',
    'Independent200m129x12916641sample originalfield/two rawtiles/fixedSW14.3392m provider-relative datum frozen before all floors/sections/figureorientation/geometry. No fitting/flattening/reacquisition or later modelraising. Intrinsic hoof-to-artificial-pedestal contacts set during original geometry authoring; external sourcegrade unresolved/preview/replaceFootprint=false. Flat isolated ground/synthetic neighbors are review fixtures.',
  ],
};

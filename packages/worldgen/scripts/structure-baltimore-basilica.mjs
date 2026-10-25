/** Baltimore Basilica: full native church and dome with Ionic portico and twin open belfries. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/dq/dqc/baltimore_basilica/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  A = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    stone: rgb('aaa99e'),
    trim: rgb('d5d3bf'),
    roof: rgb('737c77'),
    copper: rgb('786650'),
    gold: rgb('b6a05d'),
    glass: rgb('4b6363'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.97, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
    roof: { slot: 'roof', graph: 'slate', roughness: 0.93, metallic: 0 },
    copper: { slot: 'roof', graph: 'metal_painted', roughness: 0.67, metallic: 0.55 },
    gold: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.75 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.39, metallic: 0.05 },
  };
export function baltimoreBasilicaGround(x, z) {
  const u = Math.max(0, Math.min(127.9999, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(127.9999, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  return (
    (g.heightsMeters[j][i] * (1 - a) + g.heightsMeters[j][i + 1] * a) * (1 - b) +
    (g.heightsMeters[j + 1][i] * (1 - a) + g.heightsMeters[j + 1][i + 1] * a) * b -
    g.modelDatumElevationMeters
  );
}
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function axial(o, s, a, b, r, n = 6, r1 = r, col = C[s]) {
  const v = b.map((v, k) => v - a[k]),
    l = Math.hypot(...v),
    axis = v.map((v) => v / l),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((v) => v / Math.hypot(...u0)),
    vv = cross(axis, u),
    R = (c, r) =>
      Array.from({ length: n }, (_, i) => {
        const t = (i * 2 * Math.PI) / n;
        return c.map((v, k) => v + r * (Math.cos(t) * u[k] + Math.sin(t) * vv[k]));
      }),
    B = R(a, r),
    D = R(b, r1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(
      o,
      s,
      [B[i], B[j], D[j], D[i]],
      B[i].map((v, k) => v - a[k]),
      col,
    );
    T(
      o,
      s,
      [a, B[j], B[i]],
      axis.map((v) => -v),
      col,
    );
    T(o, s, [b, D[i], D[j]], axis, col);
  }
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const A = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    B = A.map((v) => [v[0], y + h, v[2]]);
  Q(o, s, [...A].reverse(), [0, -1, 0], col);
  Q(o, s, B, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [A[i], A[j], B[j], B[i]], [A[j][2] - A[i][2], 0, A[i][0] - A[j][0]], col);
  }
}
const area = (P) =>
    P.reduce((s, a, i) => {
      const b = P[(i + 1) % P.length];
      return s + a[0] * b[1] - b[0] * a[1];
    }, 0) / 2,
  ccw = (P) => (area(P) > 0 ? P : [...P].reverse());
function triangles(P) {
  const ix = P.map((_, i) => i),
    out = [],
    side = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    inside = (q, a, b, c) =>
      side(a, b, q) >= -1e-8 && side(b, c, q) >= -1e-8 && side(c, a, q) >= -1e-8;
  let attempts = 0;
  while (ix.length > 3 && attempts++ < P.length * P.length) {
    let cut = false;
    for (let k = 0; k < ix.length; k++) {
      const a = ix[(k + ix.length - 1) % ix.length],
        b = ix[k],
        c = ix[(k + 1) % ix.length];
      if (side(P[a], P[b], P[c]) < 1e-8) continue;
      if (ix.some((i) => i !== a && i !== b && i !== c && inside(P[i], P[a], P[b], P[c]))) continue;
      out.push([P[a], P[b], P[c]]);
      ix.splice(k, 1);
      cut = true;
      break;
    }
    if (!cut) {
      const k = ix.findIndex(
        (b, k) =>
          Math.abs(side(P[ix[(k + ix.length - 1) % ix.length]], P[b], P[ix[(k + 1) % ix.length]])) <
          1e-6,
      );
      if (k < 0) throw Error('Native polygon cannot triangulate');
      ix.splice(k, 1);
    }
  }
  if (ix.length === 3) out.push(ix.map((i) => P[i]));
  return out;
}
function face(o, s, P, Y, n, col = C[s]) {
  for (const q of triangles(ccw(P)))
    T(
      o,
      s,
      q.map((v) => [v[0], typeof Y === 'function' ? Y(v) : Y, v[1]]),
      n,
      col,
    );
}
const Y = (y) => A.floorY + y;
function clip(P, key, value, sign) {
  const R = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length],
      da = (a[key] - value) * sign,
      db = (b[key] - value) * sign;
    if (da >= -1e-8) R.push(a);
    if (da * db < 0) {
      const f = da / (da - db);
      R.push(a.map((v, k) => v + (b[k] - v) * f));
    }
  }
  return R;
}
function simplify(P, eps) {
  P = [...P];
  let changed = true;
  while (changed && P.length > 6) {
    changed = false;
    for (let i = 0; i < P.length; i++) {
      const a = P[(i + P.length - 1) % P.length],
        b = P[i],
        c = P[(i + 1) % P.length],
        L = Math.hypot(c[0] - a[0], c[1] - a[1]),
        d = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / L;
      if (d < eps) {
        P.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return P;
}
function lathe(o, s, x, z, profile, n, flute = 0) {
  for (let k = 0; k < n; k++) {
    const a = (k * Math.PI * 2) / n,
      b = ((k + 1) * Math.PI * 2) / n,
      P = (q, t) => [
        x + Math.cos(t) * (q[1] - flute * (0.5 + 0.5 * Math.cos(t * 20))),
        Y(q[0]),
        z + Math.sin(t) * (q[1] - flute * (0.5 + 0.5 * Math.cos(t * 20))),
      ];
    for (let j = 1; j < profile.length; j++)
      Q(
        o,
        s,
        [P(profile[j - 1], a), P(profile[j - 1], b), P(profile[j], b), P(profile[j], a)],
        [Math.cos(a), 0, Math.sin(a)],
      );
    const lo = profile[0],
      hi = profile.at(-1);
    T(o, s, [[x, Y(lo[0]), z], P(lo, b), P(lo, a)], [0, -1, 0]);
    T(o, s, [[x, Y(hi[0]), z], P(hi, a), P(hi, b)], [0, 1, 0]);
  }
}
let detail = 3;
function frameCell(o, F, x0, x1, y0, y1, s = 'stone', back = 'stone') {
  if (x1 - x0 < 1e-6 || y1 - y0 < 1e-6) return;
  const { a, u, n } = F,
    t = 0.42,
    V = (x, y, dep) => [a[0] + u[0] * x - n[0] * dep, Y(y), a[1] + u[1] * x - n[1] * dep];
  Q(o, s, [V(x0, y0, 0), V(x1, y0, 0), V(x1, y1, 0), V(x0, y1, 0)], [n[0], 0, n[1]]);
  if (detail <= 1) return;
  Q(o, back, [V(x1, y0, t), V(x0, y0, t), V(x0, y1, t), V(x1, y1, t)], [-n[0], 0, -n[1]]);
  for (const [y, sign] of [
    [y0, -1],
    [y1, 1],
  ])
    Q(o, s, [V(x0, y, 0), V(x1, y, 0), V(x1, y, t), V(x0, y, t)], [0, sign, 0]);
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ])
    Q(o, s, [V(x, y0, 0), V(x, y0, t), V(x, y1, t), V(x, y1, 0)], [u[0] * sign, 0, u[1] * sign]);
}
function archOpening(o, F, c, w, sill, spring, top, d, glass = true, s = 'stone') {
  const r = w / 2,
    N = [2, 3, 7, 12][d],
    V = (x, y, dep = 0.0) => [
      F.a[0] + F.u[0] * x - F.n[0] * dep,
      Y(y),
      F.a[1] + F.u[1] * x - F.n[1] * dep,
    ],
    n = [F.n[0], 0, F.n[1]];
  if (glass) frameCell(o, F, c - r, c + r, 0, sill, s);
  for (let k = 0; k < N; k++) {
    const a = Math.PI - (k * Math.PI) / N,
      b = Math.PI - ((k + 1) * Math.PI) / N,
      x0 = c + Math.cos(a) * r,
      x1 = c + Math.cos(b) * r,
      y0 = spring + Math.sin(a) * r,
      y1 = spring + Math.sin(b) * r;
    Q(o, s, [V(x0, y0), V(x1, y1), V(x1, top), V(x0, top)], n);
    Q(
      o,
      s,
      [V(x0, y0, 0.42), V(x1, y1, 0.42), V(x1, top, 0.42), V(x0, top, 0.42)],
      n.map((v) => -v),
    );
    Q(o, 'trim', [V(x0, y0), V(x1, y1), V(x1, y1, 0.42), V(x0, y0, 0.42)], [0, -1, 0]);
    if (glass) T(o, 'glass', [V(c, sill, 0.3), V(x0, y0, 0.3), V(x1, y1, 0.3)], n);
  }
  if (glass) {
    Q(
      o,
      'glass',
      [V(c - r, sill, 0.3), V(c + r, sill, 0.3), V(c + r, spring, 0.3), V(c - r, spring, 0.3)],
      n,
    );
    if (d > 1) {
      for (const x of [c - r, c, c + r])
        axial(o, 'trim', V(x, sill, 0.26), V(x, spring, 0.26), 0.035, d === 2 ? 2 : 4);
      for (let j = 0; j < 5; j++) {
        const y = sill + ((spring - sill) * j) / 4;
        axial(o, 'trim', V(c - r, y, 0.26), V(c + r, y, 0.26), 0.03, d === 2 ? 2 : 4);
      }
      for (let k = 0; k < N; k++) {
        const a = Math.PI - (k * Math.PI) / N,
          b = Math.PI - ((k + 1) * Math.PI) / N;
        axial(
          o,
          'trim',
          V(c + Math.cos(a) * r, spring + Math.sin(a) * r, -0.06),
          V(c + Math.cos(b) * r, spring + Math.sin(b) * r, -0.06),
          0.075,
          d === 2 ? 2 : 4,
        );
      }
    }
  }
}
function mass(o, P, h, d, windows = true) {
  P = ccw(P);
  face(o, 'roof', P, Y(h), [0, 1, 0]);
  for (let k = 0; k < P.length; k++) {
    const a = P[k],
      b = P[(k + 1) % P.length],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.03) continue;
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [u[1], -u[0]],
      F = { a, u, n },
      loA = baltimoreBasilicaGround(...a) - 0.12,
      loB = baltimoreBasilicaGround(...b) - 0.12;
    Q(
      o,
      'stone',
      [
        [a[0], loA, a[1]],
        [b[0], loB, b[1]],
        [b[0], Y(0), b[1]],
        [a[0], Y(0), a[1]],
      ],
      [n[0], 0, n[1]],
    );
    if (d === 0) {
      Q(
        o,
        'stone',
        [
          [a[0], Y(0), a[1]],
          [b[0], Y(0), b[1]],
          [b[0], Y(h), b[1]],
          [a[0], Y(h), a[1]],
        ],
        [n[0], 0, n[1]],
      );
      continue;
    }
    if (!windows || L < 4) {
      frameCell(o, F, 0, L, 0, h);
      continue;
    }
    const count = Math.max(1, Math.floor(L / 6)),
      w = Math.min(2.1, (L / count) * 0.48);
    let last = 0;
    for (let j = 0; j < count; j++) {
      const c = (L * (j + 0.5)) / count;
      frameCell(o, F, last, c - w / 2, 0, h);
      archOpening(o, F, c, w, 2.9, 8.4, h, d, true);
      last = c + w / 2;
    }
    frameCell(o, F, last, L, 0, h);
    if (d > 1) {
      const D = (x, y, t) => [a[0] + u[0] * x + n[0] * t, Y(y), a[1] + u[1] * x + n[1] * t];
      Q(
        o,
        'trim',
        [D(0, h - 0.8, 0.12), D(L, h - 0.8, 0.12), D(L, h - 0.45, 0.12), D(0, h - 0.45, 0.12)],
        [n[0], 0, n[1]],
      );
    }
  }
}
function house(o, d) {
  const P = simplify(p.outline, [0.35, 0.15, 0.03, 0][d]),
    main = clip(clip(P, 1, -23, 1), 1, 34, -1),
    back = clip(P, 1, -23, -1);
  mass(o, main, A.wallHeight, d);
  mass(o, back, 6.3, d, false);
  // Native north chapel projection remains a lower connected mass, not a block-wide base.
  const n = [
    [-26.24, -5.9],
    [-14, -5.9],
    [-14, -15.1],
    [-26.24, -15.1],
  ];
  if (d > 0) face(o, 'roof', n, Y(9.5), [0, 1, 0]);
  // Shallow gabled nave roof; the native circular dome occupies the central crossing.
  for (const [lo, hi] of [
    [9, 34],
    [-23, -9],
  ]) {
    const a = [
        [-10.9, Y(14.0), lo],
        [10.9, Y(14.0), lo],
        [0, Y(17.1), lo],
      ],
      b = a.map((q) => [q[0], q[1], hi]);
    Q(o, 'roof', [a[0], b[0], b[2], a[2]], [0, 1, 0]);
    Q(o, 'roof', [a[2], b[2], b[1], a[1]], [0, 1, 0]);
    T(o, 'trim', a, [0, 0, -1]);
    T(o, 'trim', b, [0, 0, 1]);
  }
}
function spiral(o, x, y, z, sign, d) {
  let prev = null;
  const N = d === 3 ? 18 : 9;
  for (let k = 0; k <= N; k++) {
    const t = (k / N) * Math.PI * 3.4,
      r = 0.28 * (1 - k / N) + 0.055,
      q = [x + sign * Math.cos(t) * r, Y(y) + Math.sin(t) * r, z];
    if (prev) axial(o, 'trim', prev, q, d === 3 ? 0.05 : 0.04, d === 3 ? 6 : 4);
    prev = q;
  }
}
export const baltimoreBasilicaColumns = Array.from({ length: 6 }, (_, i) => ({
  x: -9 + i * 3.6,
  z: 42,
}));
function portico(o, d) {
  box(o, 'trim', 0, Y(-0.14), 38.6, 23, 0.22, 10.8);
  const steps = d === 0 ? 3 : 11;
  for (let k = 0; k < steps; k++) {
    const h = (A.floorY * (k + 1)) / steps;
    box(o, 'trim', 0, 0, 47.9 - k * 0.43, 23.0, h, 0.46);
  }
  for (const q of baltimoreBasilicaColumns) {
    const profile =
      d === 0
        ? [
            [0, 0.65],
            [11.8, 0.52],
          ]
        : d === 1
          ? [
              [0, 0.7],
              [0.55, 0.7],
              [0.65, 0.52],
              [11.2, 0.45],
              [11.8, 0.63],
            ]
          : [
              [0, 0.78],
              [0.15, 0.78],
              [0.25, 0.66],
              [0.42, 0.7],
              [0.55, 0.6],
              [0.75, 0.55],
              [10.95, 0.46],
              [11.1, 0.59],
              [11.35, 0.68],
              [11.7, 0.7],
              [11.8, 0.73],
            ];
    lathe(o, 'trim', q.x, q.z, profile, [4, 8, 16, 60][d], d === 3 ? 0.027 : 0);
    if (d > 1) for (const sign of [-1, 1]) spiral(o, q.x + sign * 0.42, 11.46, q.z + 0.48, sign, d);
  }
  box(o, 'trim', 0, Y(11.8), 38.4, 23, 1.35, 10.0);
  const P = [
      [-11.5, Y(13.15), 43.4],
      [11.5, Y(13.15), 43.4],
      [0, Y(16.5), 43.4],
    ],
    B = P.map((q) => [q[0], q[1], 33.4]);
  T(o, 'trim', P, [0, 0, 1]);
  T(o, 'trim', B, [0, 0, -1]);
  Q(o, 'roof', [P[0], B[0], B[2], P[2]], [0, 1, 0]);
  Q(o, 'roof', [P[2], B[2], B[1], P[1]], [0, 1, 0]);
  if (d > 0) {
    for (const x of [-6, 0, 6]) {
      box(o, 'glass', x, Y(0.1), 34.02, 2.4, 5.4, 0.12);
      for (const dx of [-1.35, 1.35]) box(o, 'trim', x + dx, Y(0.05), 34.15, 0.22, 5.75, 0.26);
      box(o, 'trim', x, Y(5.65), 34.15, 3.1, 0.3, 0.26);
    }
    if (d > 1)
      for (let k = 0; k <= 6; k++) {
        const x = -10.7 + k * 3.5;
        axial(o, 'gold', [x, 1.0, 47.8], [x, Y(0.8), 43.1], 0.025, 4);
      }
  }
}
function belfry(o, x, z, d) {
  box(o, 'trim', x, Y(0), z, 8.3, 15.6, 8.3);
  lathe(
    o,
    'trim',
    x,
    z,
    d === 0
      ? [
          [15.6, 4.55],
          [18.2, 3.8],
        ]
      : [
          [15.6, 4.55],
          [16.1, 4.55],
          [16.3, 4.2],
          [17.0, 4.2],
          [17.2, 3.8],
          [18.2, 3.8],
        ],
    [4, 12, 24, 40][d],
  );
  const bays = d === 0 ? 4 : 8,
    N = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 6 : 10,
    R = 3.65,
    w = d === 0 ? 2.6 : 1.85;
  for (let k = 0; k < bays; k++) {
    const t = (k * Math.PI * 2) / bays,
      n = [Math.sin(t), Math.cos(t)],
      u = [Math.cos(t), -Math.sin(t)],
      F = { a: [x + n[0] * R - (u[0] * w) / 2, z + n[1] * R - (u[1] * w) / 2], u, n };
    archOpening(o, F, w / 2, w, 18.2, 24.2, 26.5, d, false, 'trim');
    const angle0 = t + Math.asin(w / 2 / R),
      angle1 = t + (Math.PI * 2) / bays - Math.asin(w / 2 / R);
    for (let j = 0; j < N; j++) {
      const a = angle0 + ((angle1 - angle0) * j) / N,
        b = angle0 + ((angle1 - angle0) * (j + 1)) / N;
      Q(
        o,
        'trim',
        [
          [x + Math.sin(a) * R, Y(18.2), z + Math.cos(a) * R],
          [x + Math.sin(b) * R, Y(18.2), z + Math.cos(b) * R],
          [x + Math.sin(b) * R, Y(26.5), z + Math.cos(b) * R],
          [x + Math.sin(a) * R, Y(26.5), z + Math.cos(a) * R],
        ],
        [Math.sin((a + b) / 2), 0, Math.cos((a + b) / 2)],
      );
      if (d > 1) {
        const P = (t, y, r) => [x + Math.sin(t) * r, Y(y), z + Math.cos(t) * r],
          ri = R - 0.42;
        Q(
          o,
          'trim',
          [P(a, 18.2, ri), P(b, 18.2, ri), P(b, 26.5, ri), P(a, 26.5, ri)],
          [-Math.sin((a + b) / 2), 0, -Math.cos((a + b) / 2)],
        );
        for (const [y, sign] of [
          [18.2, -1],
          [26.5, 1],
        ])
          Q(o, 'trim', [P(a, y, R), P(b, y, R), P(b, y, ri), P(a, y, ri)], [0, sign, 0]);
      }
    }
  }
  lathe(
    o,
    'trim',
    x,
    z,
    d === 0
      ? [
          [26.5, 3.65],
          [29.4, 3.95],
        ]
      : [
          [26.5, 3.65],
          [28.9, 3.65],
          [29.1, 3.95],
          [29.4, 3.95],
        ],
    [4, 12, 24, 40][d],
  );
  lathe(
    o,
    'copper',
    x,
    z,
    d === 0
      ? [
          [29.4, 3.9],
          [31.0, 4.65],
          [34, 1.8],
          [36, 0.25],
          [44.5, 0.045],
        ]
      : [
          [29.4, 3.9],
          [29.7, 4.3],
          [30.6, 4.65],
          [31.6, 4.4],
          [32.8, 3.3],
          [34.0, 1.8],
          [35.3, 0.5],
          [36.0, 0.25],
          [36.4, 0.5],
          [36.9, 0.35],
          [44.5, 0.045],
        ],
    [4, 12, 20, 40][d],
  );
  box(o, 'gold', x, Y(43.9), z, 0.1, 2.1, 0.1);
  box(o, 'gold', x, Y(45.1), z, 1.5, 0.1, 0.1);
  if (d > 1)
    for (let k = 0; k < 4; k++) {
      const t = (k * Math.PI) / 2,
        n = [Math.sin(t), Math.cos(t)],
        P = (a, y) => [x + n[0] * 3.68 + Math.cos(t) * a, Y(y), z + n[1] * 3.68 - Math.sin(t) * a];
      for (const [a, b, c, e] of [
        [-0.65, 0.65, 27.3, 27.45],
        [-0.65, 0.65, 28.2, 28.35],
        [-0.65, -0.5, 27.3, 28.35],
        [0.5, 0.65, 27.3, 28.35],
      ])
        Q(o, 'stone', [P(a, c), P(b, c), P(b, e), P(a, e)], [n[0], 0, n[1]]);
    }
}
function dome(o, d) {
  const n = [8, 16, 32, 48][d],
    steps = [3, 5, 9, 14][d],
    R = A.domeRadius;
  lathe(
    o,
    'copper',
    0,
    0,
    d === 0
      ? [
          [14.2, 11.8],
          [20.8, 10.2],
        ]
      : [
          [14.2, 11.8],
          [15.0, 11.8],
          [15.2, 11.3],
          [16.2, 11.3],
          [16.4, 10.8],
          [17.6, 10.8],
          [17.8, 10.2],
          [20.8, 10.2],
        ],
    n,
  );
  const profile = Array.from({ length: steps + 1 }, (_, k) => {
    const t = ((k / steps) * Math.PI) / 2;
    return [20.8 + Math.sin(t) * 7.5, Math.cos(t) * R];
  });
  lathe(o, 'roof', 0, 0, profile, n);
  if (d > 0) {
    for (let k = 0; k < 24; k++) {
      const t = (k * Math.PI) / 12,
        u = [Math.cos(t), Math.sin(t)],
        v = [-u[1], u[0]],
        P = (r, y, w) => [u[0] * r + v[0] * w, Y(y), u[1] * r + v[1] * w];
      Q(
        o,
        'glass',
        [P(4.65, 27.4, -0.23), P(4.65, 27.4, 0.23), P(2.4, 28.08, 0.16), P(2.4, 28.08, -0.16)],
        [u[0], 1, u[1]],
      );
      if (d > 1)
        for (const s of [-1, 1])
          axial(o, 'copper', P(4.65, 27.46, s * 0.26), P(2.4, 28.14, s * 0.18), 0.055, 4);
    }
  }
  lathe(
    o,
    'copper',
    0,
    0,
    [
      [28.3, 0.85],
      [28.6, 0.85],
      [28.9, 0.45],
    ],
    [4, 8, 12, 20][d],
  );
  box(o, 'gold', 0, Y(28.8), 0, 0.14, 3.1, 0.14);
  box(o, 'gold', 0, Y(30.7), 0, 1.5, 0.14, 0.14);
}
function build(o, _f, d = 3) {
  detail = d;
  house(o, d);
  portico(o, d);
  for (const x of [-A.towerX, A.towerX]) belfry(o, x, A.towerZ, d);
  dome(o, d);
}
export const baltimoreBasilicaSkyline = (o, f) => build(o, f, 0),
  baltimoreBasilicaDistrict = (o, f) => build(o, f, 1),
  baltimoreBasilicaStreet = (o, f) => build(o, f, 2),
  baltimoreBasilicaCloseup = (o, f) => build(o, f, 3);
export const baltimoreBasilicaModel = {
  id: 'baltimore_basilica',
  key: 'baltimore_basilica',
  cell: 'dq/dqc',
  recipe: 'structure-baltimore-basilica.mjs',
  title: 'Baltimore Basilica',
  category: 'religious-building',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [94, 67, 115],
  lookAt: [0, 15, 0],
  mediumFiContext: { scale: 1.6 },
  qaCameras: [
    {
      name: 'whole-native-church-portico-twin-spires-central-dome-and-rear-wings',
      position: [94, 67, 115],
      lookAt: [0, 15, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'six-ionic-columns-open-portico-pediment-volutes-and-entry-stair',
      position: [15, 12, 60],
      lookAt: [0, 7, 39],
    },
    {
      name: 'open-round-arched-belfry-copper-onion-cupola-needle-and-cross',
      position: [29, 35, 47],
      lookAt: [9.6, 29, 28.8],
    },
    {
      name: 'stepped-central-dome-drum-radial-crown-skylights-and-arched-nave',
      position: [29, 35, -19],
      lookAt: [0, 22, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-baltimore-basilica.mjs',
    level: 'skyline',
    export: 'baltimoreBasilicaSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'baltimoreBasilicaDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'baltimoreBasilicaStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'baltimoreBasilicaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole named surviving basilica and connected native rear wings/apse are included, with actual central dome part and six-column open west portico/twin open arched cylindrical belfries/onion cupolas/needle spires/crosses. Precise wall/dome/spire heights/column orders/fine moldings/flute sections/clockfaces/rooflight hardware/hidden rear annex roofs are bounded photographic estimates; interiors and independent artworks/statues omitted.',
    'Qualla-first15families/one unrelated hero conflict: two Smallbones2012Own/selfCC0 interiors individually inspected/native hashes bound, ancillary only. Clear supplemental Ext-Current explicit named photographerDeadwildcatOctober2006/directPD-user-en/exactnativeSHA1/revision/original upload row/dimensions/bytes bound and individually inspected; direct creator declaration parsed without editing source metadata or inventing Own. PublishedBasilicaExterior uploader-only attribution/modernCC/LOC403-timeout sources unused. No photographictextures/generatedbitmaps/downloadedmesh.',
    'Independent256m129square2m16641-sample field/one original Terrarium tile frozen before geometry; values/heightPNG/tilebytes preserved. Provider34.5072m fixed west approach datum is not surveyed churchfloor. Floor1.6m/intrinsic stair/plinth estimate fixed before geometry; foundation toes sample original field, not wholeblock platform. Source ground never flattened/fitted/reacquired; actual host footing contact unverified, ordinary geographic preview/replacement disabled.',
    'Four LODs retain whole church/native dome/open portico and paired belfry voids/onion/needle profiles. Native fine returns, window mullions, Ionic volutes/flutes and copper seams reduced with distance; named structure geometry never replaced with neighboring housing, office, grounds, sculpture or interior.',
  ],
};

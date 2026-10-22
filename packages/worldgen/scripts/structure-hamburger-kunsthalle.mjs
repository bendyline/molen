/** Three-building Kunsthalle: native parts, seven-bay historic front and contemporary cube. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u1/u1x/hamburger_kunsthalle/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    brick: rgb('b79c79'),
    terra: rgb('9c786c'),
    stone: rgb('c9c7b9'),
    copper: rgb('7f9e8e'),
    roof: rgb('73796f'),
    glass: rgb('4e6262'),
  },
  surfaces = {
    brick: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
    terra: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.95, metallic: 0 },
    stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
    copper: { slot: 'roof', graph: 'metal_painted', roughness: 0.76, metallic: 0.4 },
    roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.86, metallic: 0.2 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.36, metallic: 0.06 },
  };
const vary = (c, t) => c.map((v) => Math.min(1, v * t)),
  part = (id) => p.parts.find((q) => q.id === id),
  bounds = (r) =>
    [0, 1].map((k) => [Math.min(...r.map((v) => v[k])), Math.max(...r.map((v) => v[k]))]);
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
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const r = [
    [x - w / 2, z - l / 2],
    [x + w / 2, z - l / 2],
    [x + w / 2, z + l / 2],
    [x - w / 2, z + l / 2],
  ];
  cap(o, s, r, y, false, col);
  cap(o, s, r, y + h, true, col);
  for (let i = 0; i < 4; i++) {
    const a = r[i],
      b = r[(i + 1) % 4];
    Q(
      o,
      s,
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], y + h, b[1]],
        [a[0], y + h, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
      col,
    );
  }
}
function rod(o, s, a, b, w, d = 1, col = C[s]) {
  const v = b.map((x, k) => x - a[k]),
    len = Math.hypot(...v),
    axis = v.map((x) => x / len),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((x) => x / Math.hypot(...u0)),
    v2 = cross(axis, u);
  if (d === 0) {
    for (const n of [u, v2])
      Q(
        o,
        s,
        [
          a.map((x, k) => x - (n[k] * w) / 2),
          a.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x - (n[k] * w) / 2),
        ],
        cross(n, axis),
        col,
      );
    return;
  }
  const ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((x, k) => x + ((u[k] * i + v2[k] * j) * w) / 2)),
    A = ring(a),
    B = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      s,
      [A[i], A[j], B[j], B[i]],
      A[i].map((x, k) => x - a[k]),
      col,
    );
  }
  Q(
    o,
    s,
    [...A].reverse(),
    axis.map((x) => -x),
    col,
  );
  Q(o, s, B, axis, col);
}
function face(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    sg = Math.sign(
      r.reduce(
        (s, v, k) => s + v[0] * r[(k + 1) % r.length][1] - r[(k + 1) % r.length][0] * v[1],
        0,
      ),
    ),
    n = [sg * u[1], 0, -sg * u[0]];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
function rect(o, s, f, x0, y0, x1, y1, z = 0, col = C[s]) {
  if (x1 - x0 > 1e-5 && y1 - y0 > 1e-5)
    Q(o, s, [f.P(x0, y0, z), f.P(x1, y0, z), f.P(x1, y1, z), f.P(x0, y1, z)], f.n, col);
}
function flat(o, s, f, r, depth = 0, col = C[s], holes = []) {
  const coords = r.flat(),
    starts = [];
  for (const h of holes) {
    starts.push(coords.length / 2);
    coords.push(...h.flat());
  }
  const ix = earcut(coords, starts);
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => f.P(coords[k * 2], coords[k * 2 + 1], depth)),
      f.n,
      col,
    );
}
const rectangle = (x0, y0, x1, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
  arch = (x, y0, spring, r, n) => [
    [x - r, y0],
    [x + r, y0],
    ...Array.from({ length: n + 1 }, (_, i) => {
      const a = (i * Math.PI) / n;
      return [x + Math.cos(a) * r, spring + Math.sin(a) * r];
    }),
  ];
function reveal(o, s, f, r, depth, col = C[s]) {
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      u = -(b[1] - a[1]),
      v = b[0] - a[0],
      A = f.P(0, 0),
      B = f.P(u, v);
    Q(
      o,
      s,
      [f.P(...a), f.P(...b), f.P(...b, -depth), f.P(...a, -depth)],
      [B[0] - A[0], v, B[2] - A[2]],
      col,
    );
  }
}
function profile(o, s, center, pr, n = 12, col = C[s]) {
  const rings = pr.map(([y, rx, rz = rx]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [center[0] + Math.cos(a) * rx, y, center[1] + Math.sin(a) * rz];
    }),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      Q(
        o,
        s,
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        [Math.cos(a), 0, Math.sin(a)],
        col,
      );
    }
  for (const [r, y, up] of [
    [rings[0], pr[0][0], false],
    [rings.at(-1), pr.at(-1)[0], true],
  ])
    cap(
      o,
      s,
      r.map((v) => [v[0], v[2]]),
      y,
      up,
      col,
    );
}
function statue(o, f, x, y, h, d, pose = 0) {
  const c = f.P(x, y, -0.09),
    n = [4, 5, 7, 12][d],
    col = vary(C.stone, 0.8),
    P = (dx, yy, z = 0) => f.P(x + dx, y + yy, -0.07 + z);
  if (d === 0) {
    T(o, 'stone', [P(-h * 0.16, 0), P(h * 0.16, 0), P(0, h * 0.74)], f.n, col);
    box(o, 'stone', c[0], y + h * 0.72, c[2], h * 0.18, h * 0.22, h * 0.18, col);
    return;
  }
  profile(
    o,
    'stone',
    [c[0], c[2]],
    [
      [y, 0.16 * h, 0.11 * h],
      [y + 0.16 * h, 0.19 * h, 0.12 * h],
      [y + 0.54 * h, 0.12 * h, 0.105 * h],
      [y + 0.7 * h, 0.19 * h, 0.11 * h],
      [y + 0.77 * h, 0.1 * h, 0.08 * h],
    ],
    n,
    col,
  );
  profile(
    o,
    'stone',
    [c[0], c[2]],
    [
      [y + 0.76 * h, 0.055 * h],
      [y + 0.81 * h, 0.11 * h],
      [y + 0.91 * h, 0.115 * h],
      [y + 0.98 * h, 0.065 * h],
      [y + h, 0.02 * h],
    ],
    n,
    col,
  );
  for (const sign of [-1, 1])
    rod(
      o,
      'stone',
      P(sign * h * 0.15, h * 0.69),
      P(sign * h * (pose % 2 ? 0.25 : 0.17), h * (sign > 0 && pose % 3 === 0 ? 0.5 : 0.36), 0.03),
      h * 0.075,
      d > 1 ? 1 : 0,
      col,
    );
  if (d > 2)
    for (const sign of [-1, 1])
      rod(o, 'stone', P(sign * h * 0.065, 0.03), P(sign * h * 0.07, 0.47), h * 0.065, 1, col);
}
function rosette(o, f, x, y, r, d, portrait = false) {
  if (!d) {
    flat(o, 'terra', f, rectangle(x - r, y - r, x + r, y + r), 0.025, vary(C.terra, 1.08));
    return;
  }
  const steps = [4, 6, 10, 16][d],
    P = (rr, a, yy) => f.P(x + Math.cos(a) * rr, y + Math.sin(a) * rr, yy);
  for (let i = 0; i < steps; i++) {
    const a = (i * Math.PI * 2) / steps,
      b = ((i + 1) * Math.PI * 2) / steps;
    Q(o, 'terra', [P(r, a, 0.045), P(r, b, 0.045), P(r * 0.72, b, 0.1), P(r * 0.72, a, 0.1)], f.n);
    T(
      o,
      'terra',
      [f.P(x, y, 0.11), P(r * 0.72, a, 0.1), P(r * 0.72, b, 0.1)],
      f.n,
      vary(C.terra, 0.9),
    );
  }
  if (d > 1) {
    if (portrait) {
      const q = f.P(x, y, 0.16);
      profile(
        o,
        'terra',
        [q[0], q[2]],
        [
          [y - r * 0.36, r * 0.23, r * 0.13],
          [y + r * 0.25, r * 0.21, r * 0.16],
          [y + r * 0.46, r * 0.05, r * 0.03],
        ],
        6,
        vary(C.terra, 1.07),
      );
    } else
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2,
          rr = r * 0.32,
          q = f.P(x + Math.cos(a) * r * 0.43, y + Math.sin(a) * r * 0.43, 0.12);
        T(
          o,
          'terra',
          [
            f.P(x, y, 0.16),
            [q[0] - 0.12, y + Math.sin(a) * r * 0.43, q[2]],
            [q[0] + 0.12, y + Math.sin(a) * r * 0.43 + rr, q[2]],
          ],
          f.n,
          vary(C.terra, 1.1),
        );
      }
  }
}
function niche(o, f, x, y, h, w, d) {
  const shape = arch(x, y, y + h - w / 2, w / 2, [3, 5, 9, 16][d]),
    ff = { ...f, P: (a, b, z = 0) => f.P(a, b, z + 0.2) };
  flat(o, 'terra', ff, shape, -0.4, vary(C.terra, 0.74));
  if (d) reveal(o, 'terra', ff, shape, 0.4);
  statue(o, f, x, y + 0.06, h * 0.88, d, Math.round(x * 3));
  if (d > 1)
    for (const xx of [x - w / 2 - 0.12, x + w / 2 + 0.12])
      rect(o, 'terra', f, xx - 0.065, y, xx + 0.065, y + h, 0.03);
}
function front(o, d) {
  const r = [
      [-15, 23.487],
      [15, 23.487],
      [15, 23.37],
      [-15, 23.37],
    ],
    f = face(r, 0),
    n = [4, 6, 12, 20][d],
    holes = [];
  for (let i = 0; i < 7; i++) holes.push(arch(4.2 + i * 3.6, 5, 9.3, 1.65, n));
  const cornerHoles = [0.8, 29.2].flatMap((x) =>
    [
      [10.1, 2.2],
      [15.05, 2.25],
    ].map(([y, h]) => arch(x, y, y + h - 0.56, 0.56, [3, 5, 9, 16][d])),
  );
  flat(o, 'brick', f, rectangle(0, 0, 30, 18.2), 0, C.brick, [...holes, ...cornerHoles]);
  for (let i = 0; i < 7; i++) {
    const x = 4.2 + i * 3.6,
      hole = holes[i],
      win = rectangle(x - 1.1, 5, x + 1.1, 8.5);
    reveal(o, 'terra', f, hole, 0.68);
    flat(o, 'terra', f, hole, -0.68, C.terra, d ? [win] : []);
    flat(o, 'glass', f, win, d ? -0.9 : -0.69);
    if (d > 0) {
      reveal(o, 'terra', f, win, 0.9);
      rect(o, 'glass', f, x - 0.035, 5, x + 0.035, 8.5, -0.86, vary(C.glass, 0.42));
      rect(o, 'glass', f, x - 1.1, 7.4, x + 1.1, 7.47, -0.86, vary(C.glass, 0.42));
      rosette(o, { ...f, P: (a, b, z = 0) => f.P(a, b, z - 0.68) }, x, 9.85, 0.43, d, true);
    }
    if (d > 1) {
      for (const yy of [8.65, 11.25, 12.2])
        rect(o, 'terra', f, x - 1.72, yy, x + 1.72, yy + 0.14, 0.12);
      for (const xx of [x - 1.68, x + 1.68])
        rect(o, 'terra', f, xx - 0.055, 12.65, xx + 0.055, 17.55, 0.13);
      rosette(o, f, x, 15.15, 0.5, d);
    }
  }
  for (let i = 0; i <= 7; i++) {
    const x = 2.4 + i * 3.6,
      q = f.P(x, 0, 0.18),
      base = 5,
      top = 9.3;
    if (d === 0) rod(o, 'terra', [q[0], base, q[2]], [q[0], top, q[2]], 0.36, 0);
    else {
      profile(
        o,
        'terra',
        [q[0], q[2]],
        [
          [base, 0.36],
          [base + 0.14, 0.36],
          [base + 0.24, 0.25],
          [top - 0.3, 0.23],
          [top - 0.16, 0.4],
          [top, 0.4],
        ],
        [4, 6, 10, 16][d],
      );
      if (d > 2)
        for (let j = 0; j < 8; j++) {
          const a = (j * Math.PI) / 4,
            aa = [q[0] + Math.cos(a) * 0.24, base + 0.3, q[2] + Math.sin(a) * 0.24],
            bb = [aa[0], top - 0.33, aa[2]];
          rod(o, 'terra', aa, bb, 0.022, 0, vary(C.terra, 0.74));
        }
    }
  }
  for (const x of [0.8, 29.2]) {
    flat(
      o,
      'terra',
      f,
      rectangle(x - 0.65, 4.9, x + 0.65, 17.6),
      0.2,
      C.terra,
      [
        [10.1, 2.2],
        [15.05, 2.25],
      ].map(([y, h]) => arch(x, y, y + h - 0.56, 0.56, [3, 5, 9, 16][d])),
    );
    niche(o, f, x, 10.1, 2.2, 1.12, d);
    niche(o, f, x, 15.05, 2.25, 1.12, d);
    if (d > 0) for (const y of [6, 8.45]) rosette(o, f, x, y, 0.39, d, true);
    if (d > 1) for (const y of [6.8, 7.35, 7.9]) rosette(o, f, x, y, 0.27, d);
  }
  for (const [y, h, depth] of [
    [4.75, 0.22, 0.32],
    [11.7, 0.3, 0.33],
    [12.25, 0.2, 0.2],
    [17.65, 0.22, 0.36],
    [18.05, 0.18, 0.55],
  ]) {
    rect(o, 'terra', f, 0, y, 30, y + h, depth);
    if (d > 0)
      Q(
        o,
        'terra',
        [f.P(0, y + h), f.P(30, y + h), f.P(30, y + h, depth), f.P(0, y + h, depth)],
        [0, 1, 0],
      );
  }
  if (d > 0)
    for (let i = 0; i < 8; i++) {
      const x = 2.4 + i * 3.6;
      rect(o, 'terra', f, x - 0.1, 18.23, x + 0.1, 18.75, 0.12);
    }
  for (const x of [0.8, 29.2])
    if (d > 0) {
      statue(o, f, x, 18.25, 1.6, d, 2);
      if (d > 1) for (const off of [-0.55, 0.55]) statue(o, f, x + off, 18.25, 1.05, d, 1);
    }
}
function plainFacade(o, s, r, i, top, d, old = false, lo = 0, hi = null) {
  const f = face(r, i),
    end = hi ?? f.len,
    holes = [];
  if (d && end - lo > 3) {
    const count = Math.max(1, Math.floor((end - lo) / (old ? 5 : 6.2)));
    for (let j = 0; j < count; j++) {
      const x = lo + ((end - lo) * (j + 0.5)) / count;
      for (const y of old ? [0.8, 5.1] : [2.4, 8.8])
        if (y + 2.4 < top - 0.5)
          holes.push({ r: rectangle(x - 0.9, y, x + 0.9, y + (y < 2 ? 1.3 : 2.4)), x, y });
    }
  }
  flat(o, s, f, rectangle(lo, 0, end, top), 0, C[s], d > 1 ? holes.map((h) => h.r) : []);
  for (const h of holes) {
    flat(o, 'glass', f, h.r, d > 1 ? -0.2 : 0.008);
    if (d > 1) {
      reveal(o, s, f, h.r, 0.2);
      rect(o, 'terra', f, h.x - 0.025, h.y, h.x + 0.025, h.y + 2.4, -0.16, vary(C.terra, 0.7));
    }
  }
  if (d) {
    rect(o, 'terra', f, lo, top - 0.22, end, top, 0.1);
    if (old && d > 1) rect(o, 'terra', f, lo, 3.6, end, 3.78, 0.08);
  }
}
function roof(o, s, r, y, rise, axis, d) {
  const B = bounds(r),
    cx = (B[0][0] + B[0][1]) / 2,
    cz = (B[1][0] + B[1][1]) / 2,
    corners = [
      [B[0][0], y, B[1][0]],
      [B[0][1], y, B[1][0]],
      [B[0][1], y, B[1][1]],
      [B[0][0], y, B[1][1]],
    ],
    A = axis === 'z' ? [cx, y + rise, B[1][0] + (s === 'glass' ? 0 : 7)] : [B[0][0], y + rise, cz],
    D = axis === 'z' ? [cx, y + rise, B[1][1] - (s === 'glass' ? 0 : 7)] : [B[0][1], y + rise, cz];
  if (axis === 'z') {
    T(o, s, [corners[0], corners[1], A], [0, 1, 0]);
    Q(o, s, [corners[1], corners[2], D, A], [0, 1, 0]);
    T(o, s, [corners[2], corners[3], D], [0, 1, 0]);
    Q(o, s, [corners[3], corners[0], A, D], [0, 1, 0]);
  } else {
    Q(o, s, [corners[0], corners[1], D, A], [0, 1, 0]);
    Q(o, s, [corners[2], corners[3], A, D], [0, 1, 0]);
    T(o, s, [corners[0], corners[3], A], [-1, 0, 0]);
    T(o, s, [corners[1], corners[2], D], [1, 0, 0]);
  }
  if (d > 1) {
    rod(o, 'roof', A, D, 0.08, 0);
    if (s === 'glass')
      for (let j = 1; j <= 8; j++) {
        const t = j / 9;
        if (axis === 'z') {
          const z = B[1][0] + (B[1][1] - B[1][0]) * t;
          for (const x of [B[0][0], B[0][1]])
            rod(o, 'roof', [x, y + 0.01, z], [cx, y + rise + 0.01, z], 0.035, 0);
        } else {
          const x = B[0][0] + (B[0][1] - B[0][0]) * t;
          for (const z of [B[1][0], B[1][1]])
            rod(o, 'roof', [x, y + 0.01, z], [x, y + rise + 0.01, cz], 0.035, 0);
        }
      }
  }
}
function urn(o, x, z, y, d) {
  const sides = [4, 6, 10, 16][d];
  profile(
    o,
    'copper',
    [x, z],
    [
      [y, 0.32],
      [y + 0.12, 0.45],
      [y + 0.32, 0.43],
    ],
    sides,
  );
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3,
      dx = Math.cos(a) * 0.43,
      dz = Math.sin(a) * 0.43;
    rod(
      o,
      'copper',
      [x + dx, y + 0.3, z + dz],
      [x + dx * 0.8, y + 1.1, z + dz * 0.8],
      0.055,
      d > 1 ? 1 : 0,
    );
  }
  profile(
    o,
    'copper',
    [x, z],
    [
      [y + 1.07, 0.59],
      [y + 1.18, 0.59],
    ],
    sides,
  );
}
function oldMuseum(o, d) {
  const r = part(316353725).outline;
  cap(o, 'brick', r, 0, false);
  for (let i = 0; i < r.length; i++) {
    const f = face(r, i);
    if (i === 5) {
      const f = face(r, i);
      for (const [lo, hi, cx, mx] of [
        [0, 11.6, 0.94, 6.64],
        [f.len - 11.6, f.len, f.len - 0.94, f.len - 6.64],
      ]) {
        const nh = [
          arch(cx, 10.3, 12.15, 0.65, [3, 5, 9, 16][d]),
          arch(mx, 5.15, 7.625, 0.825, [3, 5, 9, 16][d]),
        ];
        flat(o, 'brick', f, rectangle(lo, 0, hi, 13.75), 0, C.brick, nh);
        niche(o, f, mx, 5.15, 3.3, 1.65, d);
        T(
          o,
          'terra',
          [f.P(mx - 1.2, 8.6, 0.15), f.P(mx + 1.2, 8.6, 0.15), f.P(mx, 9.2, 0.15)],
          f.n,
        );
      }
      continue;
    }
    if (i === 11) {
      plainFacade(o, 'brick', r, i, 13.75, d, true, 0, 11.6);
      plainFacade(o, 'brick', r, i, 13.75, d, true, f.len - 11.6);
    } else plainFacade(o, 'brick', r, i, 13.75, d, true);
  }
  cap(o, 'roof', r, 13.75);
  const upper = part(808529078).outline;
  for (let i = 2; i < upper.length; i++) plainFacade(o, 'brick', upper, i, 18, d, true);
  front(o, d);
  roof(o, 'roof', upper, 18, 2, 'z', d);
  for (const x of [-20.4, 20.4]) {
    const sk = [
      [x - 2.7, -14],
      [x + 2.7, -14],
      [x + 2.7, 13.5],
      [x - 2.7, 13.5],
    ];
    roof(o, 'glass', sk, 13.8, 0.65, 'z', d);
  }
  for (const x of [-25.7, 25.7]) {
    const f = face(
        [
          [-26.64, 23.512],
          [26.64, 23.512],
          [26.64, 23.4],
        ],
        0,
      ),
      xx = x + 26.64;
    flat(o, 'terra', f, rectangle(xx - 0.75, 3.7, xx + 0.75, 13.8), 0.2, C.terra, [
      arch(xx, 10.3, 12.15, 0.65, [3, 5, 9, 16][d]),
    ]);
    niche(o, f, xx, 10.3, 2.5, 1.3, d);
    if (d > 0) for (const y of [5.1, 8]) rosette(o, f, xx, y, 0.4, d, true);
    urn(o, x, 22.7, 14, d);
    if (d > 1) urn(o, x, -22.5, 14, d);
  }
  // Actual photographed approach steps connect the native intrinsic upper terrace to the portico.
  const count = d ? 7 : 2;
  for (let i = 0; i < count; i++)
    box(o, 'terra', 0, 4 + i / count, 24.3 - i * 0.11, 25.1, 1 / count + 0.01, 1.65 - i * 0.12);
  if (d > 0) {
    box(o, 'glass', -7.5, 4, 24.4, 1.2, 4.3, 1.7, vary(C.glass, 1.25));
    for (const dx of [-0.6, 0.6])
      for (const dz of [-0.85, 0.85])
        rod(o, 'roof', [-7.5 + dx, 4, 24.4 + dz], [-7.5 + dx, 8.3, 24.4 + dz], 0.06, 1);
    for (const x of [-11, 0, 11]) rod(o, 'roof', [x, 4.9, 25.2], [x, 5.9, 23.9], 0.035, 0);
  }
}
function dome(o, d) {
  const r = part(316353726).outline,
    c = [0, 1].map((k) => r.reduce((a, q) => a + q[k], 0) / r.length),
    n = [8, 12, 20, 34][d],
    ring = Array.from({ length: n }, (_, i) => r[Math.floor((i * r.length) / n)]);
  cap(o, 'stone', ring, 0, false);
  for (let i = 0; i < n; i++) plainFacade(o, 'stone', ring, i, 20, d, false);
  const pr =
    d === 0
      ? [
          [20, 1],
          [26, 0.72],
          [30, 0.04],
        ]
      : [
          [20, 1],
          [22, 0.98],
          [25, 0.82],
          [27.5, 0.59],
          [29.3, 0.28],
          [30, 0.035],
        ];
  for (let j = 1; j < pr.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        P = (index, h, s) => [
          c[0] + (ring[index][0] - c[0]) * s,
          h,
          c[1] + (ring[index][1] - c[1]) * s,
        ],
        a = ring[i],
        b = ring[k];
      Q(
        o,
        'copper',
        [P(i, ...pr[j - 1]), P(k, ...pr[j - 1]), P(k, ...pr[j]), P(i, ...pr[j])],
        [a[0] + b[0] - 2 * c[0], 0.3, a[1] + b[1] - 2 * c[1]],
      );
    }
  const [apexY, apexScale] = pr.at(-1);
  cap(
    o,
    'copper',
    ring.map((q) => [c[0] + (q[0] - c[0]) * apexScale, c[1] + (q[1] - c[1]) * apexScale]),
    apexY,
  );
  if (d > 2)
    for (let i = 0; i < n; i += 2) {
      for (let j = 1; j < pr.length; j++) {
        const P = ([h, s]) => [
          c[0] + (ring[i][0] - c[0]) * s,
          h + 0.025,
          c[1] + (ring[i][1] - c[1]) * s,
        ];
        rod(o, 'copper', P(pr[j - 1]), P(pr[j]), 0.028, 0, vary(C.copper, 0.76));
      }
    }
}
function extension(o, d) {
  for (const b of p.parts.filter((b) =>
    [
      808529067, 808529068, 808529069, 808529070, 808529071, 808529072, 808529075, 808529076,
      808529077,
    ].includes(b.id),
  )) {
    const r = b.outline,
      top = Number(b.tags.height),
      roofH = Number(b.tags['roof:height'] ?? 0),
      eave = top - roofH,
      glass = b.id === 808529069;
    if (glass) {
      for (let i = 0; i < r.length; i++) {
        const f = face(r, i);
        rect(o, 'glass', f, 0, 9, f.len, 12);
      }
      roof(o, 'glass', r, 12, 4, 'z', d);
    } else {
      for (let i = 0; i < r.length; i++)
        plainFacade(o, b.id >= 808529075 ? 'brick' : 'stone', r, i, eave, d, false);
      if (roofH) roof(o, 'roof', r, eave, roofH, 'x', d);
      else cap(o, 'roof', r, eave);
    }
  }
  dome(o, d);
}
function slope(o, b, heights, d) {
  const r = b.outline,
    ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      'terra',
      ix.slice(i, i + 3).map((k) => [r[k][0], heights[k], r[k][1]]),
      [0, 1, 0],
      vary(C.terra, 0.88),
    );
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    Q(
      o,
      'terra',
      [
        [r[i][0], 0, r[i][1]],
        [r[j][0], 0, r[j][1]],
        [r[j][0], heights[j], r[j][1]],
        [r[i][0], heights[i], r[i][1]],
      ],
      [r[j][1] - r[i][1], 0, r[i][0] - r[j][0]],
    );
  }
  if (d > 2)
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      if (heights[i] === 4 && heights[j] === 4)
        rod(
          o,
          'terra',
          [r[i][0], 4.02, r[i][1]],
          [r[j][0], 4.02, r[j][1]],
          0.025,
          0,
          vary(C.terra, 0.72),
        );
    }
}
function gallery(o, d) {
  const b = part(142944327),
    r = b.outline;
  cap(o, 'stone', r, 4, false);
  for (let i = 0; i < r.length; i++) {
    const f = face(r, i);
    rect(o, 'stone', f, 0, 4, f.len, 25, 0, rgb('deded3'));
    if (d > 1) {
      const cols = Math.ceil(f.len / 2.5),
        rows = 8;
      for (let j = 1; j < cols; j++) {
        const x = (f.len * j) / cols;
        rect(o, 'stone', f, x - 0.008, 4, x + 0.008, 25, 0.006, rgb('bfc1b7'));
      }
      for (let k = 1; k < rows; k++) {
        const y = 4 + (21 * k) / rows;
        rect(o, 'stone', f, 0, y - 0.008, f.len, y + 0.008, 0.006, rgb('bfc1b7'));
      }
    }
  }
  cap(o, 'roof', r, 25);
  const terrace = part(808529083).outline;
  cap(o, 'terra', terrace, 4, true, vary(C.terra, 0.87));
  for (const [id, yy] of [
    [808529080, [0, 4, 4, 4, 4, 0, 0, 0]],
    [808529081, [0, 0, 0, 4, 4, 4, 4]],
    [808529082, [0, 4, 4, 0, 0]],
  ])
    slope(o, part(id), yy, d);
  for (const id of [808861422, 808861423, 808861424, 808861425, 808861426]) {
    const b = part(id),
      top = Number(b.tags.height),
      rise = Number(b.tags['roof:height']);
    const B = bounds(b.outline);
    roof(
      o,
      'glass',
      b.outline,
      top - rise,
      rise,
      B[0][1] - B[0][0] > B[1][1] - B[1][0] ? 'x' : 'z',
      d,
    );
  }
  if (d > 0) {
    const f = face(r, 0);
    rect(o, 'glass', f, f.len * 0.4, 4.02, f.len * 0.6, 6.6, 0.01);
  }
}
function build(o, _f, d = 3) {
  oldMuseum(o, d);
  extension(o, d);
  gallery(o, d);
}
export const hamburgerKunsthalleSkyline = (o, f) => build(o, f, 0),
  hamburgerKunsthalleDistrict = (o, f) => build(o, f, 1),
  hamburgerKunsthalleStreet = (o, f) => build(o, f, 2),
  hamburgerKunsthalleCloseup = (o, f) => build(o, f, 3);
export const hamburgerKunsthalleModel = {
  id: 'hamburger_kunsthalle',
  key: 'hamburger_kunsthalle',
  cell: 'u1/u1x',
  recipe: 'structure-hamburger-kunsthalle.mjs',
  title: 'Hamburger Kunsthalle',
  category: 'museum-library',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [210, 180, 320],
  lookAt: [0, 9, 0],
  portableGroundY: -0.15,
  mediumFiContext: { scale: 1.4, groundY: -0.15 },
  qaCameras: [
    {
      name: 'whole-three-building-museum-altbau-dome-and-gallery',
      position: [170, 170, 250],
      lookAt: [0, 9, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'seven-recessed-arcades-columns-statue-niches-and-buff-brick-front',
      position: [49, 25, 65],
      lookAt: [0, 11, 23],
    },
    {
      name: 'mapped-muschelkalk-extension-curved-apse-copper-dome-and-rooflights',
      position: [74, 59, -144],
      lookAt: [3, 17, -94],
    },
    {
      name: 'white-cube-native-glazed-rooflights-and-sloping-granite-base',
      position: [69, 43, 145],
      lookAt: [0, 14, 95],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent512m129²4mfield frozenbeforegeometryatfixedeastapproach; intrinsic4mplinth/entryfloorlevels arearchitectureestimates, notterrainfit; hostcontactunverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-hamburger-kunsthalle.mjs',
    level: 'skyline',
    export: 'hamburgerKunsthalleSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'hamburgerKunsthalleDistrict', errorMeters: 0.35, surfaces },
      street: { export: 'hamburgerKunsthalleStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'hamburgerKunsthalleCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Wholethree-buildingmuseum/all22nativeparts/157originalpartcontrolvertices,notold-front-onlycrop. Originalhistorical47pointoutlineandGalerie8pointoutline arecontrolenvelopesnotextrudedboxes; overlappinghistoricbody/raisedcentralroof/9mcentralatrium/upperglassroof resolved aspartlayers. Sevenphotographedfrontarcades/columns/tympanummedaillons,raisedbrickpavilion/sidewings/niches/robedfigures/reliefpiers/cornices/coppertripodurns/steps/lowlift retained. Portraitlikeness/leafornament/textinscriptions/actualdooropenstates stylized oromitted; no photo textures.',
    'NativeheighttagsandprimaryarchitecturetextcontrolpaleMuschelkalkdomedextension/30mcopperroofand1997whitecube4–25m/redintrinsicplinth/5mappedglazedrooflightsupto29m. Galleryplinth/threeedge-slopeparts/connectingterrace areactualmappedbuildingbase,notgenericpropertylandscapeslab. Gallery/domefinefenestration/claddingstone/domepatina/hiddenrear currentdetailsarebounded estimateswithoutcurrentclearwholephotos; all48Galeriecategorysourcesneedattributionandunused. Cubeplainunobservedfaceskeptrestrained, rooflightshapesfromnativemaps, notclaimedphotogrammetric.',
    'Qualla-first53families/0reservedaliasesQIDs. FiveexactpublishedOursana2014PD-userphotos/nativeoriginalSHA1matched andindividuallyinspected; nativefirstrevisionparent0/authoreditemgrantandoriginaluploadwithin1second/allsubsequentversionssamecreatorbindnamedsource, no localcategories/media/articlebodyedits. ThreeadditionalselfCC0originals:Membeth2018wholefront,Oursana2021corner,GerdaArendt2024entrance,allinspected/nativeSHA1bound.69focusedprovenancetests passed,wrongcreator/version/missingowndeclaration/changedgrant/competinglicenses/restrictions rejected. No restrictedpixels/generatedbitmaps/downloadedmesh.',
    'Hiddenbasements/interiors/railway/neighborbuildings/trees/water/street/temporaryarttextandadvertising/people excluded. Extrinsicpublicplazaoutsideactualnativebuildingbase notmodeled. Intrinsicporticofloor5m/terrace4m/7approachsteps/currentvisitorlift heights approximate, notsurveyedthresholds. Flatportable/shared/contextreviewfixtures separatefrom actualsitegrade; ordinarypreview/replaceFootprint=false.',
    'Independent512m129²4mfield/all16641samples/4originalTerrariumtiles/PNG frozenbeforegeometryunchanged; fixedeastapproachproviderdatum10.8171m/absolute1.1719–22.929m, likelymixedurban/terraincomposite notfoundationdatum. Source2.83795moutputpixelspacing isnot surveyaccuracy; no flatten/fit/reacquisition, hostcontactunverified.',
  ],
};

/** Whitehall hall: seven bays, superimposed orders, open balustrade and inset north stair annex. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gcp/banqueting_house/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('c6c7c1'),
    trim: rgb('d6d7d0'),
    roof: rgb('6e777b'),
    metal: rgb('454b4c'),
    wood: rgb('645f55'),
    glass: rgb('485d64'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.97, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.96, metallic: 0 },
    roof: { slot: 'roof', graph: 'slate', roughness: 0.9, metallic: 0.02 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.8, metallic: 0.3 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.93, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.04 },
  };
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

const R = p.outline,
  vary = (c, t) => c.map((v) => Math.min(1, v * t));
const northX = R[4][0],
  E = [northX, R[7][1] + ((R[0][1] - R[7][1]) * (northX - R[7][0])) / (R[0][0] - R[7][0])],
  MAIN = [R[0], R[1], R[2], R[3], R[4], E],
  ANNEX = [E, R[4], R[5], R[6], R[7]];
function front(a, b, n) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  return {
    len,
    n,
    P: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[1] * x + n[2] * z],
  };
}
const F = front(R[4], R[2], [0, 0, 1]),
  B = front(R[0], E, [0, 0, -1]);
function block(o, s, f, x0, y0, x1, y1, z0, z1, d = 3, col = C[s]) {
  if (d < 2) {
    rect(o, s, f, x0, y0, x1, y1, z1, col);
    return;
  }
  const q = [
      f.P(x0, y0, z0),
      f.P(x1, y0, z0),
      f.P(x1, y1, z0),
      f.P(x0, y1, z0),
      f.P(x0, y0, z1),
      f.P(x1, y0, z1),
      f.P(x1, y1, z1),
      f.P(x0, y1, z1),
    ],
    mid = [0, 1, 2].map((k) => q.reduce((a, v) => a + v[k] / 8, 0));
  for (const ids of [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [3, 7, 6, 2],
    [0, 4, 7, 3],
    [1, 2, 6, 5],
  ]) {
    const points = ids.map((i) => q[i]),
      n = [0, 1, 2].map((k) => points.reduce((a, v) => a + v[k] / 4, 0) - mid[k]);
    Q(o, s, points, n, col);
  }
}
function frameWindow(o, f, x, y, w, h, d, offset = 0, arched = false, material = 'glass') {
  const sh = arched
      ? arch(x, y, y + h - w / 2, w / 2, d > 1 ? 12 : 5)
      : rectangle(x - w / 2, y, x + w / 2, y + h),
    g = { ...f, P: (a, b, c = 0) => f.P(a, b, c + offset) };
  if (d) reveal(o, 'trim', g, sh, 0.25);
  flat(o, material, g, sh, d ? -0.25 : 0.015);
  if (d) {
    const zw = offset + 0.06;
    for (const [a, b, c, e] of [
      [x - w / 2 - 0.09, y - 0.1, x + w / 2 + 0.09, y + 0.02],
      [x - w / 2 - 0.09, y - 0.1, x - w / 2 + 0.025, y + h + 0.09],
      [x + w / 2 - 0.025, y - 0.1, x + w / 2 + 0.09, y + h + 0.09],
      ...(arched ? [] : [[x - w / 2 - 0.09, y + h - 0.01, x + w / 2 + 0.09, y + h + 0.1]]),
    ])
      block(o, 'trim', f, a, b, c, e, offset - 0.02, zw, d);
    if (material === 'glass') {
      for (const xx of d > 1 ? [x - w / 4, x, x + w / 4] : [x])
        rect(
          o,
          'wood',
          f,
          xx - 0.024,
          y + 0.04,
          xx + 0.024,
          y + h - (arched ? w / 2 : 0.03),
          offset - 0.225,
        );
      for (let k = 1; k < (d > 1 ? 5 : 3); k++) {
        const yy = y + (h * k) / (d > 1 ? 5 : 3);
        rect(
          o,
          'wood',
          f,
          x - w / 2 + 0.03,
          yy - 0.024,
          x + w / 2 - 0.03,
          yy + 0.024,
          offset - 0.224,
        );
      }
    }
  }
  return sh;
}
function capital(o, f, x, y, width, d, upper, z) {
  block(o, 'trim', f, x - width * 0.62, y - 0.14, x + width * 0.62, y + 0.1, z - 0.13, z + 0.36, d);
  if (d > 1) {
    for (const sign of [-1, 1]) {
      const cx = x + sign * width * 0.43;
      for (let k = 0, count = d === 2 ? 4 : 5; k < count; k++) {
        const a = (k * 5 * Math.PI) / (4 * count),
          b = ((k + 1) * 5 * Math.PI) / (4 * count),
          ra = upper ? 0.13 : 0.19;
        rod(
          o,
          'trim',
          f.P(cx + Math.cos(a) * ra, y - 0.04 + Math.sin(a) * ra, z + 0.4),
          f.P(cx + Math.cos(b) * ra, y - 0.04 + Math.sin(b) * ra, z + 0.4),
          0.055,
          d,
        );
      }
    }
    if (upper)
      for (const sign of [-1, 1])
        T(
          o,
          'trim',
          [
            f.P(x + sign * width * 0.44, y - 0.25, z + 0.32),
            f.P(x + sign * width * 0.17, y + 0.05, z + 0.48),
            f.P(x, y - 0.26, z + 0.39),
          ],
          f.n,
        );
  }
}
function order(o, f, x, bottom, top, d, column, upper = false, depth = 0) {
  const w = column ? 0.67 : 0.68,
    z = depth + 0.12;
  if (d && column) {
    const n = d > 1 ? 8 : 4;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / n,
        b = -Math.PI / 2 + ((k + 1) * Math.PI) / n;
      Q(
        o,
        'trim',
        [
          f.P(x + (Math.sin(a) * w) / 2, bottom + 0.35, z + (Math.cos(a) * w) / 2),
          f.P(x + (Math.sin(b) * w) / 2, bottom + 0.35, z + (Math.cos(b) * w) / 2),
          f.P(x + Math.sin(b) * w * 0.44, top - 0.3, z + Math.cos(b) * w * 0.44),
          f.P(x + Math.sin(a) * w * 0.44, top - 0.3, z + Math.cos(a) * w * 0.44),
        ],
        f.n,
      );
    }
  } else block(o, 'trim', f, x - w / 2, bottom + 0.3, x + w / 2, top - 0.25, z - 0.05, z + 0.18, d);
  block(o, 'trim', f, x - w * 0.62, bottom, x + w * 0.62, bottom + 0.3, depth, depth + 0.46, d);
  capital(o, f, x, top - 0.15, w, d, upper, depth + 0.15);
}
function pediment(o, f, x, y, w, d, segment, depth) {
  const z = depth + 0.3,
    r = w / 2;
  if (!segment) {
    flat(
      o,
      'trim',
      f,
      [
        [x - r, y],
        [x + r, y],
        [x, y + 0.68],
      ],
      z,
    );
    if (d) {
      for (const a of [
        [x - r, y],
        [x + r, y],
      ])
        rod(o, 'trim', f.P(...a, z + 0.07), f.P(x, y + 0.68, z + 0.07), 0.16, d);
    }
  } else {
    const n = d > 1 ? 12 : d ? 5 : 2,
      pts = Array.from({ length: n + 1 }, (_, i) => {
        const t = -1 + (2 * i) / n;
        return [x + r * t, y + 0.58 * (1 - t * t)];
      });
    flat(o, 'trim', f, [[x - r, y], ...pts.slice(1), [x + r, y - 0.08]], z);
    if (d)
      for (let i = 0; i < n; i++)
        rod(o, 'trim', f.P(...pts[i], z + 0.07), f.P(...pts[i + 1], z + 0.07), 0.16, d);
  }
  block(o, 'trim', f, x - r - 0.1, y - 0.18, x + r + 0.1, y - 0.02, depth + 0.03, z + 0.13, d);
}
function longFacade(o, f, d) {
  const bay = f.len / 7;
  for (let j = 0; j < 7; j++) {
    const x = (j + 0.5) * bay,
      z = j >= 2 && j <= 4 ? 0.26 : 0,
      win = [];
    for (const [y, h, w] of [
      [0.65, 1.42, 1.32],
      [4.3, 5.1, 2.22],
      [13.0, 5.35, 2.22],
    ])
      win.push(frameWindow(o, f, x, y, w, h, d, y > 3 ? z : 0));
    const levels = [
      [0, 3.2],
      [3.2, 11.6],
      [11.6, 21.8],
    ];
    for (let k = 0; k < levels.length; k++)
      flat(
        o,
        'wall',
        { ...f, P: (a, b, c = 0) => f.P(a, b, c + (k ? z : 0)) },
        rectangle(j * bay, levels[k][0], (j + 1) * bay, levels[k][1]),
        0,
        C.wall,
        d ? [win[k]] : [],
      );
    pediment(o, f, x, 9.8, 2.9, d, j % 2 === 0, z);
    block(o, 'trim', f, x - 1.5, 18.6, x + 1.5, 18.84, z + 0.05, z + 0.48, d);
    block(o, 'trim', f, x - 1.3, 3.93, x + 1.3, 4.16, z, z + 0.37, d);
    if (d > 1) {
      for (const xx of [x - 1.13, x + 1.13])
        block(o, 'trim', f, xx - 0.095, 9.47, xx + 0.095, 9.8, z + 0.06, z + 0.32, d);
      for (let k = 0, count = d === 2 ? 4 : 6; k <= count; k++) {
        const xx = x - 1.26 + (k * 2.52) / count,
          yy = 20.65 - 0.32 * Math.sin((k * Math.PI) / count);
        if (k < count) {
          const next = x - 1.26 + ((k + 1) * 2.52) / count,
            y2 = 20.65 - 0.32 * Math.sin(((k + 1) * Math.PI) / count);
          rod(o, 'trim', f.P(xx, yy, z + 0.16), f.P(next, y2, z + 0.16), 0.13, d);
        }
      }
      const m = f.P(x, 20.76, z + 0.22);
      box(o, 'trim', m[0], m[1] - 0.16, m[2], 0.28, 0.31, 0.22);
    }
  }
  for (let j = 0; j <= 7; j++) {
    const x = j * bay,
      z = j >= 2 && j <= 5 ? 0.26 : 0;
    for (const [lo, hi, up] of [
      [3.45, 11.1, false],
      [11.9, 20.1, true],
    ])
      order(o, f, x, lo, hi, d, j >= 2 && j <= 5, up, z);
    if (d > 1 && (j === 0 || j === 7))
      for (const [lo, hi, up] of [
        [3.45, 11.1, false],
        [11.9, 20.1, true],
      ])
        order(o, f, x + (j === 0 ? 0.57 : -0.57), lo, hi, d, false, up, 0);
  }
  for (const [y, h, z] of [
    [0.05, 0.23, 0.15],
    [3.13, 0.28, 0.28],
    [11.1, 0.22, 0.38],
    [11.38, 0.3, 0.5],
    [20.1, 0.24, 0.28],
    [21.25, 0.22, 0.4],
    [21.53, 0.27, 0.64],
  ])
    block(o, 'trim', f, -0.27, y, f.len + 0.27, y + h, 0, z, d);
  if (d > 1)
    for (let j = 0; j < 7; j++) {
      const x = (j + 0.5) * bay;
      for (let row = 0; row < 5; row++)
        for (let col = 0; col < 4; col++) {
          const xx = j * bay + (col * bay) / 4 + (row % 2 ? bay / 8 : 0);
          if (xx > f.len - 0.05) continue;
          const yy = 0.42 + row * 0.55;
          if (Math.abs(xx - x) < 0.8 && yy < 2.2) continue;
          rect(
            o,
            'wall',
            f,
            xx,
            yy,
            Math.min(xx + bay / 4 - 0.07, f.len - 0.03),
            yy + 0.018,
            0.015,
            vary(C.wall, 0.72),
          );
        }
    }
}
function parapet(o, r, y, d) {
  for (let i = 0; i < r.length; i++) {
    const f = face(r, i),
      n = Math.max(1, Math.round(f.len / 1.2));
    block(o, 'trim', f, 0, y, f.len, y + 0.18, -0.14, 0.28, d);
    block(o, 'trim', f, 0, y + 1.0, f.len, y + 1.2, -0.14, 0.32, d);
    if (d === 0) {
      rect(o, 'wall', f, 0, y + 0.18, f.len, y + 1, 0.02);
      continue;
    }
    for (let j = 0; j <= n; j++) {
      const x = (f.len * j) / n;
      rod(
        o,
        'trim',
        f.P(x, y + 0.18, 0.02),
        f.P(x, y + 1, 0.02),
        d > 1 ? 0.16 : 0.13,
        d > 1 ? 1 : 0,
      );
    }
    for (let j = 0; j <= Math.round(f.len / 5.2); j++) {
      const x = (f.len * j) / Math.max(1, Math.round(f.len / 5.2));
      block(o, 'trim', f, x - 0.3, y, x + 0.3, y + 1.12, -0.14, 0.32, d);
    }
  }
}
function mainHall(o, d) {
  cap(o, 'wall', R, 0, false);
  longFacade(o, F, d);
  longFacade(o, B, d);
  const south = front(R[2], R[0], [1, 0, 0]),
    sh = frameWindow(o, south, south.len / 2, 13.25, 2.2, 4.45, d, 0, true);
  flat(o, 'wall', south, rectangle(0, 0, south.len, 21.8), 0, C.wall, d ? [sh] : []);
  const north = front(E, R[4], [-1, 0, 0]);
  flat(o, 'wall', north, rectangle(0, 0, north.len, 21.8));
  for (const f of [south, north])
    for (const [y, h, z] of [
      [3.13, 0.28, 0.28],
      [11.38, 0.3, 0.5],
      [20.1, 0.24, 0.28],
      [21.53, 0.27, 0.64],
    ])
      block(o, 'trim', f, 0, y, f.len, y + h, 0, z, d);
  cap(o, 'roof', MAIN, 21.72);
  const x0 = E[0] + 1.1,
    x1 = R[0][0] - 1.1,
    z0 = E[1] + 1,
    z1 = R[4][1] - 1,
    rr = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    c = [(x0 + x1) / 2, (z0 + z1) / 2];
  for (let i = 0; i < 4; i++)
    T(
      o,
      'roof',
      [
        [...rr[i].slice(0, 1), 21.75, rr[i][1]],
        [rr[(i + 1) % 4][0], 21.75, rr[(i + 1) % 4][1]],
        [c[0], 22.35, c[1]],
      ],
      [0, 1, 0],
    );
  parapet(o, MAIN, 22, d);
  if (d > 0) {
    const base = [4.5, 22.35, 1.5];
    rod(o, 'metal', base, [4.5, 26.3, 1.5], 0.075, d);
    rod(o, 'metal', [3.0, 25.65, 1.5], [6.0, 25.65, 1.5], 0.08, d);
    T(
      o,
      'metal',
      [
        [6.0, 25.65, 1.5],
        [5.45, 25.9, 1.5],
        [5.45, 25.4, 1.5],
      ],
      [0, 0, 1],
    );
    T(
      o,
      'metal',
      [
        [3.1, 25.65, 1.5],
        [3.8, 26.02, 1.5],
        [3.8, 25.28, 1.5],
      ],
      [0, 0, 1],
    );
    rod(o, 'metal', [4.5, 24.4, 0.4], [4.5, 24.4, 2.6], 0.06, d);
  }
}
function annex(o, d) {
  for (let i = 1; i < ANNEX.length; i++) {
    const f = face(ANNEX, i),
      holes = [];
    if (i === 2) {
      const sh = frameWindow(o, f, f.len / 2, 0.25, 1.9, 3.1, d, 0, true, 'wood');
      if (d) holes.push(sh);
      for (const y of [6.4, 12]) {
        const h = frameWindow(o, f, f.len / 2, y, 1.55, 3.25, d);
        if (d) holes.push(h);
      }
      const n = d > 1 ? 16 : 6,
        loop = Array.from({ length: n }, (_, k) => [
          f.len / 2 + Math.cos((k * Math.PI * 2) / n) * 0.46,
          4.8 + Math.sin((k * Math.PI * 2) / n) * 0.46,
        ]);
      if (d) holes.push(loop);
      if (d) reveal(o, 'trim', f, loop, 0.18);
      flat(o, 'metal', f, loop, -0.16);
      if (d > 1) {
        const c = f.P(f.len / 2, 4.8, -0.1);
        box(o, 'metal', c[0], c[1] - 0.19, c[2], 0.24, 0.39, 0.2);
      }
    } else if (i === 3) {
      for (const y of [4.5, 11.8])
        for (const t of [0.27, 0.72]) {
          const sh = frameWindow(o, f, f.len * t, y, 1.5, 3.25, d);
          if (d) holes.push(sh);
        }
    }
    flat(o, 'wall', f, rectangle(0, 0, f.len, 18.2), 0, vary(C.wall, 1.035), holes);
    for (const [y, h] of [
      [3.14, 0.25],
      [10.9, 0.24],
      [17.85, 0.35],
    ])
      block(o, 'trim', f, 0, y, f.len, y + h, -0.05, 0.28, d);
    block(o, 'trim', f, 0, 18.2, f.len, 19.2, -0.1, 0.15, d);
  }
  cap(o, 'roof', ANNEX, 18.35);
}
function build(o, _f, d = 3) {
  mainHall(o, d);
  annex(o, d);
}
export const banquetingHouseSkyline = (o, f) => build(o, f, 0),
  banquetingHouseDistrict = (o, f) => build(o, f, 1),
  banquetingHouseStreet = (o, f) => build(o, f, 2),
  banquetingHouseCloseup = (o, f) => build(o, f, 3);
export const banquetingHouseModel = {
  id: 'banqueting_house',
  key: 'banqueting_house',
  cell: 'gc/gcp',
  recipe: 'structure-banqueting-house.mjs',
  title: 'Banqueting House',
  category: 'residence',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [47, 37, 58],
  lookAt: [2, 12, 0],
  portableGroundY: -0.08,
  mediumFiContext: { scale: 1.1, groundY: -0.08 },
  qaCameras: [
    {
      name: 'whole-seven-bay-hall-and-setback-north-stair-annex',
      position: [-43, 33, 51],
      lookAt: [-1, 11, 1],
      reviewLod: 'skyline',
    },
    {
      name: 'ionic-and-composite-orders-alternating-pediments-and-sashes',
      position: [3, 14, 34],
      lookAt: [3, 12.5, 12],
    },
    {
      name: 'whole-east-face-and-concealed-roof-balustrade',
      position: [40, 36, -43],
      lookAt: [2, 12, -2],
    },
    {
      name: 'north-wyatt-annex-entry-roundel-and-weather-vane',
      position: [-34, 24, 29],
      lookAt: [-12, 13, 2],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent256m129-square2m field frozen before geometry; street datum and architectural floors are estimates, host contact unverified.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-banqueting-house.mjs',
    level: 'skyline',
    export: 'banquetingHouseSkyline',
    errorMeters: 0.5,
    surfaces,
    authoredLevels: {
      district: { export: 'banquetingHouseDistrict', errorMeters: 0.25, surfaces },
      street: { export: 'banquetingHouseStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'banquetingHouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Surviving exterior after Soane refacing/northernWyattannex:7bay facades/2orders/center3bay emphasis/alternating lower pediments/uppercornices/garlandfrieze/openbalustrade/concealedroof/weathervane. Fine Ionic/Composite capital/frieze masks stylized, exact facade relief/window census of hidden annex/heights estimated. No interiors/execution scaffold or lostWhitehallPalace.',
    'One accepted published1831ThomasHosmerShepherd engraving individually inspected/exactnativeSHA1; PD-Art(PD-old-100) namedcreator. Current primaryoperator/listing text supports conservedexterior/Portlandcolor/annex; no protected currentphoto/plan used. Campbell/Britannica screening images not adopted due incomplete publishedattribution/basis, no metadata/policy edits.',
    'Independent256m129-square2m all16641samples/one originalTerrariumtile/PNG frozen before geometry unchanged. Provider datum4.1413m/sourcepixel2.9736478786520997m/absolute.346..6.0841m notsurveyaccuracy. No fitting/flattening/reacquisition; ordinarygeographicpreview/replacementdisabled; host contactunverified.',
  ],
};

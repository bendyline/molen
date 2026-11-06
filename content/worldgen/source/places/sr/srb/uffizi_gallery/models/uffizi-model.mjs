/** Original complete Uffizi exterior. +X NNE, +Z ESE; controls retain actual map geometry. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const controlsBytes = readFileSync(new URL('../layout.json', import.meta.url));
if (
  createHash('sha256').update(controlsBytes).digest('hex') !==
  '80a87ee1d70ec8863ae5a3de0ab1c1db40beb511111108e77b120272b16cfaca'
)
  throw Error('Uffizi controls changed: update the explicit geometry input pin');
export const uffiziControls = JSON.parse(controlsBytes);
const a = uffiziControls,
  cs = Math.cos(a.theta),
  sn = Math.sin(a.theta),
  xz = ([u, v]) => [cs * u - sn * v, sn * u + cs * v],
  uv = ([x, z]) => [cs * x + sn * z, -sn * x + cs * z],
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('e5dfcc'),
    stone: lin('9fa29b'),
    base: lin('aaa79c'),
    roof: lin('b58368'),
    glass: lin('526574'),
    wood: lin('605e4e'),
    metal: lin('8b9b8b'),
    paving: lin('bcb6a7'),
  };
export const uffiziSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.8, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.25 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0.05 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const cfg = {
  skyline: { far: true, n: 4, arch: 2, step: 32 },
  district: { n: 4, arch: 2, step: 20, flat: true },
  street: { n: 6, arch: 4, step: 7.8 },
  closeup: { n: 6, arch: 8, step: 4.1, detail: true },
  master: { n: 20, arch: 20, step: 3.9, detail: true, fine: true },
};
const clean = (r) => {
    const p = r.slice();
    if (Math.hypot(p[0][0] - p.at(-1)[0], p[0][1] - p.at(-1)[1]) < 1e-5) p.pop();
    return p;
  },
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (raw) => {
    const r = clean(raw);
    return area(r) > 0 ? r.reverse() : r;
  },
  sub = (p, q) => p.map((v, i) => v - q[i]),
  S = (c, s) => (c.far ? 'far' : s);
function T(o, c, p, s = 'wall', color = C.wall, N) {
  p = p.map((q) => q.map(Math.fround));
  const A = sub(p[1], p[0]),
    B = sub(p[2], p[0]);
  if (
    Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
    1e-9
  )
    return;
  if (N && normalFor(...p).reduce((v, n, i) => v + n * N[i], 0) < 0) p.reverse();
  o.addTriangle(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0.5, 1],
    ],
    color,
  );
}
function Q(o, c, p, s = 'wall', color = C.wall, N) {
  T(o, c, p.slice(0, 3), s, color, N);
  T(o, c, [p[0], p[2], p[3]], s, color, N);
}
function cap(o, c, rs, y, s = 'wall', color = C.wall, up = true) {
  const rings = rs.map(clean),
    ps = rings.flat(),
    holes = [];
  let n = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ids = earcut(ps.flat(), holes, 2);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [ps[j][0], typeof y === 'function' ? y(ps[j]) : y, ps[j][1]]),
      s,
      color,
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, c, rs, lo, hi, s = 'wall', col = C.wall, caps = true) {
  for (const [ri, raw] of rs.entries()) {
    const r = ri ? cw(raw).reverse() : cw(raw);
    for (let j = 0; j < r.length; j++) {
      const A = r[j],
        B = r[(j + 1) % r.length];
      Q(
        o,
        c,
        [
          [A[0], lo, A[1]],
          [B[0], lo, B[1]],
          [B[0], hi, B[1]],
          [A[0], hi, A[1]],
        ],
        s,
        col,
        [-(B[1] - A[1]), 0, B[0] - A[0]],
      );
    }
  }
  if (caps && (!c.far || s === 'base')) {
    cap(o, c, rs, hi, s, col);
    if (!c.far) cap(o, c, rs, lo, s, col, false);
  }
}
const rect = (u, v, U, V) =>
    [
      [u, v],
      [U, v],
      [U, V],
      [u, V],
    ].map(xz),
  P = (u, y, v) => {
    const [x, z] = xz([u, v]);
    return [x, y, z];
  },
  R = (o, c, A, B, s = 'stone', col = C.stone) =>
    prism(o, c, [rect(A[0], A[2], B[0], B[2])], A[1], B[1], s, col),
  span = (o, c, A, B, w = 0.12, d = 0.12, s = 'stone', col = C.stone) =>
    beam(o, S(c, s), A, B, w, d, col),
  face = (F) => sub(F(0, 0, 1), F(0, 0, 0));
function column(o, c, u, v, lo, hi, r = 0.36) {
  const [x, z] = xz([u, v]);
  if (c.flat || c.far) {
    loft(
      o,
      S(c, 'stone'),
      [radialRing(lo, r, r, c.n, [x, z]), radialRing(hi, r, r, c.n, [x, z])],
      C.stone,
    );
    return;
  }
  const rings = c.fine
    ? [
        [lo, r * 1.45],
        [lo + 0.18, r * 1.45],
        [lo + 0.32, r],
        [hi - 0.5, r * 0.86],
        [hi - 0.25, r * 1.25],
        [hi, r * 1.4],
      ]
    : [
        [lo, r * 1.35],
        [lo + 0.25, r],
        [hi - 0.25, r * 0.9],
        [hi, r * 1.3],
      ];
  loft(
    o,
    S(c, 'stone'),
    rings.map(([y, R]) => radialRing(y, R, R, c.n, [x, z])),
    C.stone,
  );
}
function window(o, c, F, w, lo, hi, pediment = false, index = 0) {
  const n = face(F),
    q = [
      [-w / 2, lo],
      [w / 2, lo],
      [w / 2, hi],
      [-w / 2, hi],
    ];
  Q(
    o,
    c,
    q.map((p) => F(...p, 0.075)),
    'glass',
    C.glass,
    n,
  );
  if (c.flat || c.far) return;
  const outer = [
    [-w / 2 - 0.13, lo - 0.12],
    [w / 2 + 0.13, lo - 0.12],
    [w / 2 + 0.13, hi + 0.12],
    [-w / 2 - 0.13, hi + 0.12],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (c.fine) span(o, c, F(...q[i], 0.15), F(...q[j], 0.15), 0.15, 0.18);
    else
      Q(
        o,
        c,
        [F(...q[i], 0.15), F(...q[j], 0.15), F(...outer[j], 0.15), F(...outer[i], 0.15)],
        'stone',
        C.stone,
        n,
      );
  }
  if (c.detail) {
    for (const x of [-w * 0.17, w * 0.17])
      span(o, c, F(x, lo, 0.12), F(x, hi, 0.12), 0.055, 0.06, 'wood', C.wood);
    for (const t of [0.33, 0.66])
      span(
        o,
        c,
        F(-w / 2, lo + (hi - lo) * t, 0.12),
        F(w / 2, lo + (hi - lo) * t, 0.12),
        0.055,
        0.06,
        'wood',
        C.wood,
      );
  }
  if (!pediment) return;
  const roof = hi + 0.5,
    left = -w * 0.7,
    right = w * 0.7;
  if (index % 2 === 0) {
    for (const [x, X] of [
      [left, 0],
      [0, right],
    ])
      span(
        o,
        c,
        F(x, roof + (x === 0 ? 0.7 : 0), 0.22),
        F(X, roof + (X === 0 ? 0.7 : 0), 0.22),
        0.14,
        0.22,
      );
  } else {
    for (let i = 0; i < c.arch; i++) {
      const t = Math.PI - (i / c.arch) * Math.PI,
        T = Math.PI - ((i + 1) / c.arch) * Math.PI;
      span(
        o,
        c,
        F(Math.cos(t) * right, roof + Math.sin(t) * 0.65, 0.22),
        F(Math.cos(T) * right, roof + Math.sin(T) * 0.65, 0.22),
        0.14,
        0.22,
      );
    }
  }
  span(o, c, F(left, roof, 0.2), F(right, roof, 0.2), 0.18, 0.24);
  if (c.detail) {
    span(o, c, F(left, lo - 0.5, 0.2), F(right, lo - 0.5, 0.2), 0.15, 0.3);
    for (let j = 0; j < 5; j++)
      span(
        o,
        c,
        F(left + ((j + 0.5) * (right - left)) / 5, lo - 0.45, 0.2),
        F(left + ((j + 0.5) * (right - left)) / 5, lo - 0.05, 0.2),
        0.1,
        0.1,
      );
  }
}
function roof(o, c, rs, data, lo, hi) {
  const [x, z, X, Z] = data.bounds,
    ht = (p) => {
      const [u, v] = uv(p);
      return (
        lo +
        (hi - lo) *
          Math.max(
            0,
            Math.min(
              1,
              (u - x) / data.inset,
              (X - u) / data.inset,
              (v - z) / data.inset,
              (Z - v) / data.inset,
            ),
          )
      );
    };
  for (const cell of data.cells) for (const p of cell.polygons) cap(o, c, p, ht, 'roof', C.roof);
  for (const p of data.top) cap(o, c, p, hi, 'roof', C.roof);
  const r = cw(rs[0]);
  for (let i = 0; i < r.length; i++) {
    const A = r[i],
      B = r[(i + 1) % r.length];
    Q(
      o,
      c,
      [
        [A[0], lo, A[1]],
        [B[0], lo, B[1]],
        [B[0], ht(B), B[1]],
        [A[0], ht(A), A[1]],
      ],
      'roof',
      C.roof,
      [-(B[1] - A[1]), 0, B[0] - A[0]],
    );
  }
}
function porticos(o, c) {
  for (const p of a.porticos) {
    const [u, v, U, V] = p.bounds,
      front = p.front ?? (p.side < 0 ? V - 0.25 : v + 0.25),
      back = p.side < 0 ? v + 0.05 : V - 0.05,
      N = p.side < 0 ? 1 : -1,
      F = (x, y, d = 0) => P(x, y, back + N * d),
      n = c.far ? 5 : 36;
    R(o, c, [u, 3.2, Math.min(front, back)], [U, 3.65, Math.max(front, back)]);
    if (c.far)
      cap(
        o,
        c,
        [rect(u, Math.min(front, back), U, Math.max(front, back))],
        3.2,
        'stone',
        C.stone,
        false,
      );
    for (let j = 0; j <= n; j++) {
      const x = u + ((U - u) * j) / n,
        pier = j % 3 === 0 || j === n;
      if (pier) R(o, c, [x - 0.55, a.floorY, front - 0.55], [x + 0.55, 3.25, front + 0.55]);
      else column(o, c, x, front, a.floorY + 0.15, 3.25, c.detail ? 0.38 : 0.34);
      if (!c.far && j < n) {
        const mid = x + (U - u) / n / 2;
        if (insideNative(xz([mid, back - N * 0.2])))
          window(o, c, (dx, y, d = 0) => F(mid + dx, y, d), 1.5, a.floorY + 0.45, 1.9);
      }
    }
    if (c.detail)
      for (let j = 0; j <= n; j += 3) {
        const x = u + (j * (U - u)) / n;
        R(o, c, [x - 0.64, a.floorY, front - 0.65], [x + 0.64, a.floorY + 0.25, front + 0.65]);
        const f = (dx, y, d = 0) => P(x + dx, y, front + N * (0.56 + d));
        Q(
          o,
          c,
          [f(-0.3, a.floorY + 1.1), f(0.3, a.floorY + 1.1), f(0.3, 2.6), f(-0.3, 2.6)],
          'stone',
          C.base,
          face(f),
        );
      }
    if (!c.far) {
      for (const y of [3.65, 7.8, 14.5, 19.25])
        R(o, c, [u, y, front - 0.15], [U, y + 0.17, front + 0.22]);
      if (c.detail)
        for (let j = 0; j < Math.floor((U - u) / 1.2); j++) {
          const x = u + ((j + 0.5) * (U - u)) / Math.floor((U - u) / 1.2);
          R(o, c, [x - 0.16, 19.35, front - 0.4], [x + 0.16, 19.6, front + 0.4]);
        }
    }
  }
}
const riverPlan = a.whole[0][0].map(uv);
function riverFront(v) {
  let best = Infinity;
  for (let i = 0; i < riverPlan.length; i++) {
    const A = riverPlan[i],
      B = riverPlan[(i + 1) % riverPlan.length];
    if ((A[1] <= v && B[1] >= v) || (B[1] <= v && A[1] >= v)) {
      if (Math.abs(B[1] - A[1]) < 1e-9) continue;
      best = Math.min(best, A[0] + ((B[0] - A[0]) * (v - A[1])) / (B[1] - A[1]));
    }
  }
  if (!Number.isFinite(best)) throw Error('Missing actual Arno facade');
  return best;
}
function riverWindow(o, c, F) {
  const r = 1.6,
    lo = 8.6,
    spring = 12.2,
    peak = 14.0,
    p = [
      [-r, lo],
      ...Array.from({ length: c.arch + 1 }, (_, i) => {
        const t = Math.PI - (i / c.arch) * Math.PI;
        return [Math.cos(t) * r, spring + Math.sin(t) * (peak - spring)];
      }),
      [r, lo],
    ],
    ids = earcut(p.flat(), [], 2),
    N = face(F);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => F(...p[j], 0.08)),
      'glass',
      C.glass,
      N,
    );
  if (c.flat) return;
  const cy = (lo + peak) / 2,
    outer = p.map(([x, y]) => [x * 1.11, cy + (y - cy) * 1.045]);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    Q(
      o,
      c,
      [F(...p[i], 0.15), F(...p[j], 0.15), F(...outer[j], 0.15), F(...outer[i], 0.15)],
      'stone',
      C.stone,
      N,
    );
  }
  if (c.detail) {
    span(o, c, F(0, lo, 0.12), F(0, peak - 0.15, 0.12), 0.08, 0.08, 'wood', C.wood);
    for (const y of [10.2, 11.8])
      span(o, c, F(-r, y, 0.12), F(r, y, 0.12), 0.08, 0.08, 'wood', C.wood);
  }
}
function riverArches(o, c) {
  const q = a.river,
    [u, v, U, V] = q.bounds,
    back = U - 0.1,
    lo = a.floorY;
  for (const center of q.centers) {
    const front = riverFront(center),
      F = (x, y, d = 0) => P(riverFront(center + x) - d, y, center + x),
      r = q.width / 2,
      points = Array.from({ length: c.arch + 1 }, (_, i) => {
        const t = Math.PI - (i / c.arch) * Math.PI;
        return [Math.cos(t) * r, q.spring + Math.sin(t) * (q.peak - q.spring)];
      });
    for (let i = 0; i < c.arch; i++) {
      const A = points[i],
        B = points[i + 1];
      for (const [depth, N] of [
        [0, [-cs, 0, -sn]],
        [-(back - front), [cs, 0, sn]],
      ])
        Q(
          o,
          c,
          [F(...A, depth), F(...B, depth), F(B[0], q.top, depth), F(A[0], q.top, depth)],
          'stone',
          C.stone,
          N,
        );
      Q(
        o,
        c,
        [F(...A, 0), F(...A, -(back - front)), F(...B, -(back - front)), F(...B, 0)],
        'stone',
        C.stone,
        [sn * (B[1] - A[1]), -(B[0] - A[0]), -cs * (B[1] - A[1])],
      );
    }
    for (const x of [center - r - 0.65, center + r + 0.65]) {
      const f = riverFront(x);
      R(o, c, [f, lo, x - 0.55], [back, q.spring, x + 0.55]);
      if (!c.far) {
        R(o, c, [f - 0.65, -24, x - 0.6], [f + 0.3, lo + 0.18, x + 0.6], 'base', C.base);
        column(o, c, f - 0.23, x, lo + 0.18, q.spring, 0.38);
      }
    }
    if (!c.far) {
      const f = (x, y, d = 0) => P(riverFront(center + x) - 0.02 - d, y, center + x);
      riverWindow(o, c, f);
      window(o, c, f, 6.3, 16, 19.1);
    }
  }
  for (const [loV, hiV] of [
    [v, -14.15],
    [-5.85, -4.15],
    [4.15, 5.85],
    [14.15, V],
  ])
    if (hiV > loV)
      R(o, c, [Math.min(riverFront(loV), riverFront(hiV)), lo, loV], [back, q.top, hiV]);
  if (!c.far)
    for (const y of [7.6, 14.7, 19.35])
      for (let j = 0; j < 3; j++) {
        const A = -15 + j * 10,
          B = A + 10;
        span(o, c, P(riverFront(A) - 0.08, y, A), P(riverFront(B) - 0.08, y, B), 0.22, 0.35);
      }
}
function insideRing(r, p) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const A = r[i],
      B = r[j];
    if (
      A[1] > p[1] !== B[1] > p[1] &&
      p[0] < ((B[0] - A[0]) * (p[1] - A[1])) / (B[1] - A[1]) + A[0]
    )
      yes = !yes;
  }
  return yes;
}
function insideNative(p) {
  return a.whole.some((rs) => insideRing(rs[0], p) && !rs.slice(1).some((r) => insideRing(r, p)));
}
function insideOpening(p) {
  const [u, v] = uv([p[0], p[2]]);
  return a.porticos.some(
    (p) => u >= p.bounds[0] && u <= p.bounds[2] && v >= p.bounds[1] && v <= p.bounds[3],
  );
}
function facades(o, c) {
  if (c.far) return;
  for (const rs of a.whole)
    for (const [ri, raw] of rs.entries()) {
      const r = ri ? cw(raw).reverse() : cw(raw);
      for (let j = 0; j < r.length; j++) {
        const A = r[j],
          B = r[(j + 1) % r.length],
          len = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (len < 2.3) continue;
        const tx = (B[0] - A[0]) / len,
          tz = (B[1] - A[1]) / len,
          N = [-tz, tx],
          F = (u, y, d = 0) => [A[0] + tx * u + N[0] * d, y, A[1] + tz * u + N[1] * d],
          mid = uv([(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]),
          court =
            mid[0] > -66 &&
            mid[0] < 79 &&
            ((mid[1] > -6.7 && mid[1] < -5.5) || (mid[1] > 6.5 && mid[1] < 8)),
          river = mid[0] < -65 && mid[1] > -16 && mid[1] < 17,
          count = Math.max(1, Math.round(len / c.step));
        if (river) continue;
        for (let k = 0; k < count; k++) {
          const x = ((k + 0.5) * len) / count,
            f = (u, y, d = 0) => F(x + u, y, d),
            w = Math.min(1.9, (len / count) * 0.6);
          if (!court && !insideOpening(f(0, 0))) window(o, c, f, w, a.floorY + 0.7, 2.5);
          window(o, c, f, w, 4.8, 7.0);
          window(o, c, f, w, 8.9, 13.6, court, k);
          window(o, c, f, court ? Math.min(2.8, (len / count) * 0.9) : w, 15.6, 19.0);
        }
        if (!c.flat)
          for (const y of [3.7, 7.9, 14.5, 19.35]) {
            Q(
              o,
              c,
              [F(0, y, 0.16), F(len, y, 0.16), F(len, y + 0.18, 0.16), F(0, y + 0.18, 0.16)],
              'stone',
              C.stone,
              [N[0], 0, N[1]],
            );
            if (c.fine) span(o, c, F(0, y + 0.2, 0.22), F(len, y + 0.2, 0.22), 0.13, 0.27);
          }
        if (c.detail)
          for (let k = 0; k <= count; k++) {
            const x = (k * len) / count;
            Q(
              o,
              c,
              [
                F(x - 0.11, 8.1, 0.12),
                F(x + 0.11, 8.1, 0.12),
                F(x + 0.11, 19.3, 0.12),
                F(x - 0.11, 19.3, 0.12),
              ],
              'stone',
              C.stone,
              [N[0], 0, N[1]],
            );
          }
      }
    }
}
function tribune(o, c) {
  const t = a.tribune,
    [x, z] = t.center,
    ring = radialRing(25.3, 1.75, 1.75, 8, [x, z]);
  loft(o, S(c, 'metal'), [ring, radialRing(27.6, 1.75, 1.75, 8, [x, z])], C.metal);
  cap(o, c, [ring.map((p) => [p[0], p[2]])], 27.6, 'metal', C.metal);
  loft(
    o,
    S(c, 'metal'),
    [radialRing(27.6, 2.1, 2.1, 8, [x, z]), radialRing(28.35, 0.2, 0.2, 8, [x, z])],
    C.metal,
  );
  if (c.far) return;
  for (let j = 0; j < 8; j++) {
    const h = (j * Math.PI) / 4,
      n = [Math.cos(h), Math.sin(h)],
      F = (u, y, d = 0) => [x + n[0] * (1.77 + d) - n[1] * u, y, z + n[1] * (1.77 + d) + n[0] * u];
    window(o, c, F, 0.7, 25.6, 27.2);
  }
}
function contact(o, c) {
  const n = a.northApproach,
    [u, v, U, V] = n.bounds,
    [L, Ry] = n.outerY,
    p0 = P(u, n.innerY, v),
    p1 = P(u, n.innerY, V),
    p2 = P(U, Ry, V),
    p3 = P(U, L, v);
  Q(o, c, [p0, p1, p2, p3], 'base', C.paving, [0, 1, 0]);
  for (const [A, B, N] of [
    [p3, p2, [cs, 0, sn]],
    [p0, p3, [sn, 0, -cs]],
    [p2, p1, [-sn, 0, cs]],
  ])
    Q(o, c, [[A[0], -24, A[2]], [B[0], -24, B[2]], B, A], 'base', C.base, N);
}
function skylights(o, c) {
  if (c.far || c.flat) return;
  for (const b of a.bodies) {
    if (b.kind === 'tribune') continue;
    for (const [i, data] of b.roofs.entries()) {
      const [u, v, U, V] = data.bounds;
      if (U - u < 30 || V - v < 8) continue;
      const n = c.detail ? Math.max(1, Math.floor((U - u) / 28)) : 1;
      for (let j = 0; j < n; j++) {
        const x = u + ((j + 0.5) * (U - u)) / n,
          vs = v + (V - v) * 0.28,
          corners = [
            [-2, -1],
            [2, -1],
            [2, 1],
            [-2, 1],
          ],
          rs = b.polygons[i],
          factors = (u0, v0) => [
            (u0 - u) / data.inset,
            (U - u0) / data.inset,
            (v0 - v) / data.inset,
            (V - v0) / data.inset,
          ];
        if (
          !corners.every(([du, dv]) => {
            const p = xz([x + du, vs + dv]);
            return insideRing(rs[0], p) && !rs.slice(1).some((r) => insideRing(r, p));
          })
        )
          continue;
        const sides = corners.map(([du, dv]) => {
          const f = factors(x + du, vs + dv);
          return f.indexOf(Math.min(...f));
        });
        if (!sides.every((s) => s === sides[0])) continue;
        const F = (du, dv) =>
          P(
            x + du,
            b.eave +
              (b.roofY - b.eave) * Math.max(0, Math.min(1, ...factors(x + du, vs + dv))) +
              0.08,
            vs + dv,
          );
        Q(o, c, [F(-2, -1), F(2, -1), F(2, 1), F(-2, 1)], 'glass', C.glass, [0, 1, 0]);
        if (c.detail)
          for (const z of [-1, 0, 1]) span(o, c, F(-2, z), F(2, z), 0.09, 0.09, 'metal', C.metal);
      }
    }
  }
}
export function buildUffiziLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Uffizi tier ' + level);
  for (const rs of a.whole) prism(o, c, rs, -24, a.floorY, 'base', C.base);
  for (const rs of a.lower) prism(o, c, rs, a.floorY, 3.6);
  for (const b of a.bodies) {
    if (b.name === 'arno-return') {
      for (const rs of b.polygons) prism(o, c, rs, a.river.top, b.eave);
    } else for (const rs of b.polygons) prism(o, c, rs, 3.6, b.eave);
    for (const [i, rs] of b.polygons.entries()) roof(o, c, rs, b.roofs[i], b.eave, b.roofY);
  }
  for (const rs of a.riverUpperSides) prism(o, c, rs, 3.6, a.river.top);
  porticos(o, c);
  riverArches(o, c);
  facades(o, c);
  tribune(o, c);
  contact(o, c);
  skylights(o, c);
  for (const rs of a.court) cap(o, c, rs, a.floorY, 'base', C.paving);
}
export const buildUffiziSkyline = (o) => buildUffiziLevel(o, 'skyline'),
  buildUffiziDistrict = (o) => buildUffiziLevel(o, 'district'),
  buildUffiziStreet = (o) => buildUffiziLevel(o, 'street'),
  buildUffiziCloseup = (o) => buildUffiziLevel(o, 'closeup');

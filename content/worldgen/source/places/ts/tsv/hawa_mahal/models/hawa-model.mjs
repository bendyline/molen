/** Original complete Hawa Mahal exterior; signed map controls preserve both courtyards. */
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
  '855f7cde53fd0643faa7d58c42b7c99a5faae730c777169f8d2b0e3d9e402ba9'
)
  throw Error('Hawa Mahal controls changed: update explicit geometry input pin');
export const hawaControls = JSON.parse(controlsBytes);
const a = hawaControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('e8d39b'),
    pink: lin('d09880'),
    stone: lin('e3d9bd'),
    base: lin('b7ad97'),
    metal: lin('bda26b'),
    wood: lin('477d6c'),
    glass: lin('4d6178'),
  };
export const hawaSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.25 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 6, arch: 2, step: 20 },
  district: { flat: true, n: 6, arch: 2, step: 10 },
  street: { n: 8, arch: 4, step: 4.6 },
  closeup: { detail: true, n: 12, arch: 10, step: 3.1 },
  master: { detail: true, fine: true, n: 28, arch: 24, step: 2.8 },
};
const sub = (p, q) => p.map((v, i) => v - q[i]),
  S = (c, s) => (c.far ? 'far' : s);
function T(o, c, p, s = 'wall', color = C.wall, N) {
  p = p.map((q) => q.map(Math.fround));
  const A = sub(p[1], p[0]),
    B = sub(p[2], p[0]);
  if (
    Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
    1e-8
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
function Q(o, c, p, s = 'wall', col = C.wall, N) {
  T(o, c, p.slice(0, 3), s, col, N);
  T(o, c, [p[0], p[2], p[3]], s, col, N);
}
const clean = (r, tolerance = 0.008) => {
    const ps = r.slice();
    if (Math.hypot(...sub(ps[0], ps.at(-1))) < 1e-5) ps.pop();
    let change = true;
    while (change && ps.length > 3) {
      change = false;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[(i + ps.length - 1) % ps.length],
          q = ps[i],
          r = ps[(i + 1) % ps.length],
          L = Math.hypot(...sub(r, p));
        if (
          L &&
          Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / L < tolerance
        ) {
          ps.splice(i, 1);
          change = true;
          break;
        }
      }
    }
    return ps;
  },
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r, tolerance = 0.008) => {
    r = clean(r, tolerance);
    return area(r) > 0 ? r.reverse() : r;
  };
function cap(o, c, rs, y, s = 'wall', col = C.wall, up = true) {
  const rings = rs.map((r) => clean(r, c.far ? 0.4 : c.flat ? 0.15 : 0.008)),
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
      col,
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, c, rs, lo, hi, s = 'stone', col = C.stone, caps = true) {
  for (const [ri, raw] of rs.entries()) {
    const r = ri
      ? cw(raw, c.far ? 0.4 : c.flat ? 0.15 : 0.008).reverse()
      : cw(raw, c.far ? 0.4 : c.flat ? 0.15 : 0.008);
    for (let i = 0; i < r.length; i++) {
      const A = r[i],
        B = r[(i + 1) % r.length];
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
  if (caps) {
    cap(o, c, rs, hi, s, col);
    if (!c.far) cap(o, c, rs, lo, s, col, false);
  }
}
const span = (o, c, A, B, w = 0.14, d = 0.18, s = 'stone', col = C.stone) =>
    beam(o, S(c, s), A, B, w, d, col),
  inside = (r, [x, z]) => {
    let v = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++)
      if (
        r[i][1] > z !== r[j][1] > z &&
        x < ((r[j][0] - r[i][0]) * (z - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]
      )
        v = !v;
    return v;
  },
  inPs = (ps, p) => ps.some((rs) => inside(rs[0], p) && !rs.slice(1).some((r) => inside(r, p)));
function face(A, B) {
  const L = Math.hypot(...sub(B, A)),
    U = sub(B, A).map((v) => v / L),
    N = [-U[1], U[0]];
  return {
    L,
    U,
    N,
    F: (u, y, d = 0) => [A[0] + U[0] * u + N[0] * d, y, A[1] + U[1] * u + N[1] * d],
  };
}
const panel = (o, c, F, u, U, lo, hi, d = 0, s = 'wall', color = C.wall) =>
  Q(
    o,
    c,
    [F(u, lo, d), F(U, lo, d), F(U, hi, d), F(u, hi, d)],
    s,
    color,
    sub(F(0, 0, 1), F(0, 0, 0)),
  );

const rect = (x, z, X, Z) => [
    [
      [x, z],
      [X, z],
      [X, Z],
      [x, Z],
    ],
  ],
  box = (o, c, x, z, X, Z, lo, hi, s = 'wall', col = C.wall, caps = true) =>
    prism(o, c, rect(x, z, X, Z), lo, hi, s, col, caps);
function safe(output) {
  return {
    addQuad(s, ref, p, N, uv, color) {
      this.addTriangle(s, ref, p.slice(0, 3), N, uv.slice(0, 3), color);
      this.addTriangle(s, ref, [p[0], p[2], p[3]], N, [uv[0], uv[2], uv[3]], color);
    },
    addTriangle(...args) {
      const ps = args[2].map((p) => p.map(Math.fround)),
        A = sub(ps[1], ps[0]),
        B = sub(ps[2], ps[0]);
      if (
        Math.hypot(
          A[1] * B[2] - A[2] * B[1],
          A[2] * B[0] - A[0] * B[2],
          A[0] * B[1] - A[1] * B[0],
        ) < 1e-9
      )
        return;
      args[2] = ps;
      args[3] = normalFor(...ps);
      output.addTriangle(...args);
    },
    addConvexPolygon(s, ref, p, N, uv, color) {
      for (let i = 1; i < p.length - 1; i++) {
        const ps = [p[0], p[i], p[i + 1]];
        this.addTriangle(s, ref, ps, N, ps.map(uv), color);
      }
    },
  };
}
function arch(o, c, F, w, lo, hi, ceiling, depth, col = C.wall, cusps = true) {
  const r = w / 2,
    spring = hi - r * 0.58,
    points = Array.from({ length: c.arch + 1 }, (_, j) => {
      const t = (j * Math.PI) / c.arch;
      return [
        r * Math.cos(t),
        spring +
          (hi - spring) *
            Math.min(1, Math.sin(t) * (cusps ? (1 + 0.09 * Math.cos(t * 6)) / 0.91 : 1)),
      ];
    }),
    N = sub(F(0, 0, 1), F(0, 0, 0));
  for (let j = 1; j < points.length; j++) {
    const A = points[j - 1],
      B = points[j];
    Q(o, c, [F(...A, 0), F(...B, 0), F(B[0], ceiling, 0), F(A[0], ceiling, 0)], 'wall', col, N);
    Q(
      o,
      c,
      [F(...A, -depth), F(...B, -depth), F(B[0], ceiling, -depth), F(A[0], ceiling, -depth)],
      'wall',
      col,
      N.map((v) => -v),
    );
    const t = ((j - 0.5) * Math.PI) / c.arch,
      U = sub(F(1, 0, 0), F(0, 0, 0));
    Q(o, c, [F(...A, 0), F(...A, -depth), F(...B, -depth), F(...B, 0)], 'stone', C.stone, [
      -Math.cos(t) * U[0],
      -Math.sin(t),
      -Math.cos(t) * U[2],
    ]);
    if (c.detail) span(o, c, F(...A, 0.06), F(...B, 0.06), 0.1, 0.12);
  }
  for (const sign of [-1, 1])
    Q(
      o,
      c,
      [
        F(sign * r, lo, 0),
        F(sign * r, spring, 0),
        F(sign * r, spring, -depth),
        F(sign * r, lo, -depth),
      ],
      'stone',
      C.stone,
    );
}
function arcade(o, c, A, B, lo, ceil, depth, count, col = C.wall) {
  const { L, F } = face(A, B),
    n = Math.max(1, count),
    step = L / n,
    pier = c.flat ? 0.34 : 0.26;
  for (let j = 0; j <= n; j++) {
    const u = Math.max(0, j * step - pier / 2),
      U = Math.min(L, j * step + pier / 2),
      ps = [F(u, 0, 0), F(U, 0, 0), F(U, 0, -depth), F(u, 0, -depth)].map((p) => [p[0], p[2]]);
    prism(o, c, [ps], lo, ceil, 'wall', col, !c.flat);
    if (c.detail)
      for (const [y, h] of [
        [lo, 0.12],
        [ceil - 0.14, 0.14],
      ])
        prism(
          o,
          c,
          [
            [
              F(u - 0.08, 0, 0.06),
              F(U + 0.08, 0, 0.06),
              F(U + 0.08, 0, -depth),
              F(u - 0.08, 0, -depth),
            ].map((p) => [p[0], p[2]]),
          ],
          y,
          y + h,
          'stone',
          C.stone,
        );
  }
  for (let j = 0; j < n; j++) {
    const u = step * (j + 0.5),
      w = step - pier,
      local = (v, y, d) => F(v + u, y, d);
    arch(o, c, local, w, lo, ceil - 0.16, ceil, depth, col);
  }
}
function ringPrism(o, c, points, lo, hi, s = 'wall', col = C.wall) {
  prism(o, c, [points], lo, hi, s, col);
}
function lattice(o, c, F, w, lo, hi, glass = false) {
  const d = 0.24,
    r = w / 2,
    rise = w * 0.27,
    spring = hi - rise,
    top = (u) => spring + rise * Math.sqrt(Math.max(0, 1 - (u * u) / (r * r)));
  panel(
    o,
    c,
    F,
    -w / 2,
    w / 2,
    lo,
    hi,
    -d - 0.22,
    glass ? 'glass' : 'wall',
    glass ? C.glass : C.pink,
  );
  const nx = c.fine ? 8 : c.detail ? 5 : 2,
    ny = c.fine ? 12 : c.detail ? 7 : 3,
    t = c.fine ? 0.035 : c.detail ? 0.06 : 0.1;
  for (let j = 0; j <= nx; j++) {
    const u = -w / 2 + (j * w) / nx,
      h = Math.min(top(u - t / 2), top(u + t / 2));
    if (h <= lo) continue;
    panel(o, c, F, u - t / 2, u + t / 2, lo, h, -d, 'stone', C.stone);
    if (c.fine)
      for (const sign of [-1, 1])
        Q(
          o,
          c,
          [
            F(u + (sign * t) / 2, lo, -d),
            F(u + (sign * t) / 2, h, -d),
            F(u + (sign * t) / 2, h, -d - 0.035),
            F(u + (sign * t) / 2, lo, -d - 0.035),
          ],
          'stone',
          C.stone,
        );
  }
  for (let j = 0; j < ny; j++) {
    const y = lo + (j * (hi - lo)) / ny,
      v = (y - spring) / rise,
      half = y < spring ? r : r * Math.sqrt(Math.max(0, 1 - v * v));
    if (half < t) continue;
    panel(o, c, F, -half, half, y - t / 2, y + t / 2, -d - 0.005, 'stone', C.stone);
    if (c.fine)
      Q(
        o,
        c,
        [
          F(-half, y - t / 2, -d),
          F(half, y - t / 2, -d),
          F(half, y - t / 2, -d - 0.035),
          F(-half, y - t / 2, -d - 0.035),
        ],
        'stone',
        C.stone,
      );
  }
  // Small actual green shutter/casement occupies the lower portion of the pale perforated screen.
  panel(o, c, F, -w * 0.18, w * 0.18, lo + 0.04, lo + (hi - lo) * 0.23, -d - 0.17, 'wood', C.wood);
}
function orielFace(o, c, A, B, lo, hi, glass = false) {
  const { L, F, N } = face(A, B),
    width = L * 0.58,
    u = (L - width) / 2,
    U = (L + width) / 2,
    low = lo + 0.45,
    high = hi - 0.1,
    center = L / 2,
    r = width / 2,
    rise = width * 0.27,
    spring = high - rise,
    n = c.fine ? 20 : c.detail ? 8 : 3,
    points = Array.from({ length: n + 1 }, (_, j) => {
      const t = (j * Math.PI) / n;
      return [center + r * Math.cos(t), spring + rise * Math.sin(t)];
    });
  panel(o, c, F, 0, L, lo, low, 0, 'wall', C.pink);
  panel(o, c, F, 0, u, low, hi, 0, 'wall', C.pink);
  panel(o, c, F, U, L, low, hi, 0, 'wall', C.pink);
  for (let j = 1; j < points.length; j++) {
    const A = points[j - 1],
      B = points[j];
    Q(o, c, [F(...A, 0), F(...B, 0), F(B[0], hi, 0), F(A[0], hi, 0)], 'wall', C.pink, [
      N[0],
      0,
      N[1],
    ]);
    Q(o, c, [F(...A, 0), F(...A, -0.24), F(...B, -0.24), F(...B, 0)], 'stone', C.stone);
    const ta = ((j - 1) * Math.PI) / n,
      tb = (j * Math.PI) / n;
    Q(
      o,
      c,
      [
        F(...A, 0.025),
        F(...B, 0.025),
        F(center + (r + 0.08) * Math.cos(tb), spring + (rise + 0.08) * Math.sin(tb), 0.025),
        F(center + (r + 0.08) * Math.cos(ta), spring + (rise + 0.08) * Math.sin(ta), 0.025),
      ],
      'stone',
      C.stone,
      [N[0], 0, N[1]],
    );
  }
  for (const v of [u, U]) {
    Q(
      o,
      c,
      [F(v, low, 0), F(v, spring, 0), F(v, spring, -0.24), F(v, low, -0.24)],
      'stone',
      C.stone,
    );
    panel(o, c, F, v - 0.055, v + 0.055, low, spring, 0.025, 'stone', C.stone);
  }
  Q(
    o,
    c,
    [F(u, low, 0), F(U, low, 0), F(U, low, -0.24), F(u, low, -0.24)],
    'stone',
    C.stone,
    [0, 1, 0],
  );
  const M = (v, y, d) => F(v + center, y, d);
  lattice(o, c, M, width, low, high, glass);
}
function bay(o, c, b, row) {
  const lo = a.floorY + row.y,
    w = b.width,
    x = b.x,
    z = row.frontZ,
    d = b.major ? 0.88 : 0.64,
    plan = [
      [-w / 2, 0],
      [-w * 0.32, d],
      [w * 0.32, d],
      [w / 2, 0],
    ],
    ps = plan.map(([u, v]) => [x + u, z + v]);
  if (c.far) ringPrism(o, c, ps, lo + 0.15, lo + 2.55, 'wall', C.pink);
  else if (c.flat) {
    ringPrism(o, c, ps, lo + 0.15, lo + 2.55, 'wall', C.pink);
    const { L, F } = face(ps[1], ps[2]);
    panel(o, c, F, L * 0.25, L * 0.75, lo + 0.6, lo + 2.35, 0.025, 'stone', C.stone);
    panel(
      o,
      c,
      F,
      L * 0.43,
      L * 0.57,
      lo + 0.64,
      lo + 0.95,
      0.045,
      row.index === 0 && b.index === 6 ? 'glass' : 'wood',
      row.index === 0 && b.index === 6 ? C.glass : C.wood,
    );
  } else {
    ringPrism(o, c, ps, lo - 0.14, lo + 0.38, 'wall', C.pink);
    for (let j = 1; j < ps.length; j++) {
      if (c.detail || j === 2)
        orielFace(o, c, ps[j - 1], ps[j], lo + 0.12, lo + 2.55, row.index === 0 && b.index === 6);
      else {
        const { L, F } = face(ps[j - 1], ps[j]);
        panel(o, c, F, 0, L, lo + 0.12, lo + 2.55, 0, 'wall', C.pink);
        panel(o, c, F, L * 0.38, L * 0.62, lo + 0.6, lo + 1.15, 0.025, 'wood', C.wood);
      }
    }
    if (c.detail) {
      const R = (scale, h) => ps.map(([u, v]) => [x + (u - x) * scale, h, z + (v - z) * scale]);
      loft(
        o,
        S(c, 'wall'),
        [R(0.7, lo - 0.28), R(0.92, lo - 0.1), R(1.07, lo + 0.1), R(1.07, lo + 0.2)],
        C.pink,
      );
    }
  }
  const n = c.far ? 2 : c.flat ? 3 : c.fine ? 24 : c.detail ? 12 : 4,
    profile = c.far
      ? [
          [2.55, 1.07],
          [3.34, 0.08],
        ]
      : c.flat
        ? [
            [2.55, 1.07],
            [3.34, 0.08],
          ]
        : [
            [2.55, 1.07],
            [2.66, 1.13],
            [2.86, 1.08],
            [3.1, 0.82],
            [3.34, 0.35],
            [3.42, 0.07],
          ],
    rings = profile.map(([h, scale]) =>
      Array.from({ length: n + 1 }, (_, j) => {
        const theta = Math.PI - (j * Math.PI) / n;
        return [x + Math.cos(theta) * w * 0.5 * scale, lo + h, z + Math.sin(theta) * d * scale];
      }),
    );
  loft(o, S(c, 'wall'), rings, C.pink);
  if (c.detail) {
    for (const ri of [0, 2]) {
      const R = rings[ri];
      for (let i = 1; i < R.length; i++) {
        if (c.fine)
          span(
            o,
            c,
            R[i - 1].map((v, k) => (k === 1 ? v + 0.025 : v)),
            R[i].map((v, k) => (k === 1 ? v + 0.025 : v)),
            0.055,
            0.07,
          );
        else
          Q(
            o,
            c,
            [
              R[i - 1].map((v, k) => (k === 1 ? v + 0.02 : v)),
              R[i].map((v, k) => (k === 1 ? v + 0.02 : v)),
              R[i].map((v, k) => (k === 1 ? v + 0.11 : v)),
              R[i - 1].map((v, k) => (k === 1 ? v + 0.11 : v)),
            ],
            'stone',
            C.stone,
          );
      }
    }
    if (b.major || row.index === 4) {
      const top = lo + 3.42,
        zc = z + d * 0.07 * 0.5;
      loft(
        o,
        S(c, 'metal'),
        [
          [top, 0.09],
          [top + 0.18, 0.15],
          [top + 0.42, 0.05],
        ].map(([y, r]) => radialRing(y, r, r, c.n, [x, zc])),
        C.metal,
      );
    }
  }
}
function facade(o, c) {
  for (const row of a.rows) {
    const lo = a.floorY + row.y;
    box(
      o,
      c,
      row.loX,
      row.backZ + (row.index >= 3 ? 1.35 : 0),
      row.hiX,
      row.frontZ,
      lo,
      lo + 2.65,
      'wall',
      C.pink,
    );
    const bs = c.far ? (row.index % 2 === 0 ? row.bays.filter((b) => b.major) : []) : row.bays;
    for (const b of bs) bay(o, c, b, row);
    if (!c.far && !c.flat)
      for (const y of [lo + 0.1, lo + 2.56])
        box(
          o,
          c,
          row.loX - 0.12,
          row.backZ - 0.04,
          row.hiX + 0.12,
          row.frontZ + 0.13,
          y,
          y + 0.1,
          'stone',
          C.stone,
        );
  }
}
function rear(o, c) {
  const r = a.rearGallery,
    lo = a.floorY + r.lo,
    hi = a.floorY + r.hi,
    A = [r.x1, r.z],
    B = [r.x0, r.z];
  arcade(o, c, A, B, lo, hi, r.backZ - r.z, c.far ? 3 : c.flat ? 4 : 9, C.wall);
  box(o, c, r.x0, r.z, r.x1, r.backZ, hi, hi + 0.22, 'stone', C.stone);
  if (c.detail) {
    const F = (u, y, d) => [u, y, r.z - d];
    balustrade(o, c, [r.x0, r.z], [r.x1, r.z], hi + 0.22, 1.0);
    void F;
  }
  box(o, c, r.x0, r.backZ, r.x1, r.backZ + 0.15, lo, hi, 'wall', C.wall);
  // Two upper rear pink galleries retreat with the street crown.
  for (const row of a.rows.slice(3)) {
    const y = a.floorY + row.y,
      z = row.backZ;
    arcade(o, c, [row.hiX, z], [row.loX, z], y, y + 2.5, 1.25, c.far ? 2 : c.flat ? 3 : 5, C.pink);
    box(o, c, row.loX, z, row.hiX, z + 1.35, y + 2.5, y + 2.65, 'stone', C.stone);
    box(o, c, row.loX, z, row.hiX, z + 1.35, y - 0.16, y, 'base', C.base);
  }
}
function balustrade(o, c, A, B, lo, h = 0.9) {
  if (c.far || c.flat) return;
  const { L, F } = face(A, B);
  span(o, c, F(0, lo + h, 0), F(L, lo + h, 0), 0.14, 0.22);
  span(o, c, F(0, lo + 0.1, 0), F(L, lo + 0.1, 0), 0.14, 0.2);
  const n = Math.ceil(L / (c.fine ? 0.5 : 0.8));
  for (let j = 0; j <= n; j++) {
    const u = (L * j) / n;
    span(o, c, F(u, lo, 0), F(u, lo + h, 0), 0.1, 0.12);
    if (c.fine) span(o, c, F(u - 0.14, lo + 0.5, 0), F(u + 0.14, lo + 0.5, 0), 0.08, 0.12);
  }
}
function pavilion(o, c, bounds, lo, hi, mini = false) {
  const [x, z, X, Z] = bounds;
  if (c.far) {
    for (const [u, v] of [
      [x, z],
      [X, z],
      [X, Z],
      [x, Z],
    ])
      box(o, c, u - 0.19, v - 0.19, u + 0.19, v + 0.19, lo, hi);
    box(o, c, x - 0.2, z - 0.2, X + 0.2, Z + 0.2, hi, hi + 0.15, 'stone', C.stone);
    if (mini) {
      const center = [(x + X) / 2, (z + Z) / 2],
        rx = (X - x) / 2 + 0.25,
        rz = (Z - z) / 2 + 0.25;
      loft(
        o,
        'far',
        [
          [hi + 0.15, 1],
          [hi + 1.4, 0.08],
        ].map(([y, s]) => radialRing(y, rx * s, rz * s, 6, center)),
        C.pink,
      );
    }
    return;
  }
  for (const [A, B] of [
    [
      [x, z],
      [X, z],
    ],
    [
      [X, z],
      [X, Z],
    ],
    [
      [X, Z],
      [x, Z],
    ],
    [
      [x, Z],
      [x, z],
    ],
  ])
    arcade(o, c, A, B, lo, hi, 0.32, c.far ? 1 : mini ? 1 : 3, C.wall);
  box(o, c, x - 0.2, z - 0.2, X + 0.2, Z + 0.2, hi, hi + 0.15, 'stone', C.stone);
  if (!mini) {
    if (c.detail)
      for (const [A, B] of [
        [
          [x, z],
          [X, z],
        ],
        [
          [X, z],
          [X, Z],
        ],
        [
          [X, Z],
          [x, Z],
        ],
        [
          [x, Z],
          [x, z],
        ],
      ])
        balustrade(o, c, A, B, hi + 0.15, 0.7);
    return;
  }
  const center = [(x + X) / 2, (z + Z) / 2],
    rx = (X - x) / 2 + 0.25,
    rz = (Z - z) / 2 + 0.25,
    n = c.far ? 6 : c.n;
  loft(
    o,
    S(c, 'wall'),
    [
      [hi + 0.15, 1],
      [hi + 0.4, 1.04],
      [hi + 1.1, 0.65],
      [hi + 1.4, 0.08],
    ].map(([y, s]) => radialRing(y, rx * s, rz * s, n, center)),
    C.pink,
  );
  if (!c.far)
    span(
      o,
      c,
      [center[0], hi + 1.4, center[1]],
      [center[0], hi + 1.9, center[1]],
      0.1,
      0.1,
      'metal',
      C.metal,
    );
}
function towers(o, c) {
  const t = a.northTower,
    [x, z, X, Z] = t.bounds;
  box(o, c, x, z, X, Z, a.floorY, a.floorY + t.wall);
  pavilion(o, c, t.bounds, a.floorY + t.openLo, a.floorY + t.openHi);
  const cx = (x + X) / 2,
    cz = (z + Z) / 2;
  pavilion(
    o,
    c,
    [cx - 1.7, cz - 1.7, cx + 1.7, cz + 1.7],
    a.floorY + t.pavilionLo,
    a.floorY + t.pavilionHi,
    true,
  );
  if (!c.far) {
    for (const side of [-1, 1])
      for (const y of [2.1, 5.3, 8.5]) {
        const F = (u, h, d) => [cx + u, a.floorY + h, side > 0 ? Z + d : z - d];
        panel(o, c, F, -0.3, 0.3, y, y + 0.8, 0.045, 'wood', C.wood);
      }
  }
  const r = a.ramp,
    y0 = a.floorY + r.low,
    y1 = a.floorY + r.high,
    rs = rect(r.x0, r.z0, r.x1, r.z1);
  for (const raw of rs) {
    const R = cw(raw);
    for (let i = 0; i < R.length; i++) {
      const A = R[i],
        B = R[(i + 1) % R.length],
        H = (p) => y0 + ((y1 - y0) * (p[1] - r.z0)) / (r.z1 - r.z0);
      Q(
        o,
        c,
        [
          [A[0], a.floorY, A[1]],
          [B[0], a.floorY, B[1]],
          [B[0], H(B), B[1]],
          [A[0], H(A), A[1]],
        ],
        'wall',
        C.wall,
        [-(B[1] - A[1]), 0, B[0] - A[0]],
      );
    }
    cap(o, c, [raw], (p) => y0 + ((y1 - y0) * (p[1] - r.z0)) / (r.z1 - r.z0), 'base', C.base);
  }
  for (const x of [r.x0, r.x1]) {
    const A = [x, y0 + 0.35, r.z0],
      B = [x, y1 + 0.35, r.z1];
    if (!c.far) span(o, c, A, B, 0.18, 0.18);
  }
  pavilion(o, c, [r.x0 - 0.15, r.z1 - 3.5, r.x1 + 0.15, r.z1 + 0.2], y1, y1 + 1.65, true);
}
function courts(o, c) {
  for (const [ci, court] of a.courts.entries()) {
    for (const rs of court.paving) {
      prism(o, c, rs, a.floorY - 1.0, a.floorY, 'base', C.base, true);
    }
    if (c.detail) {
      for (let i = 0; i < court.outline.length; i++)
        balustrade(
          o,
          c,
          court.outline[i],
          court.outline[(i + 1) % court.outline.length],
          a.floorY + a.lowEave,
          0.85,
        );
    }
  }
  const b = a.basin,
    [x, z] = b.center,
    [w, d] = b.size,
    lo = a.floorY - b.depth;
  box(o, c, x - w / 2, z - d / 2, x + w / 2, z + d / 2, lo - 0.12, lo, 'base', C.base);
  for (const [x0, z0, X, Z] of [
    [x - w / 2 - 0.2, z - d / 2 - 0.2, x + w / 2 + 0.2, z - d / 2],
    [x - w / 2 - 0.2, z + d / 2, x + w / 2 + 0.2, z + d / 2 + 0.2],
    [x - w / 2 - 0.2, z - d / 2, x - w / 2, z + d / 2],
    [x + w / 2, z - d / 2, x + w / 2 + 0.2, z + d / 2],
  ])
    box(o, c, x0, z0, X, Z, lo, a.floorY + 0.08, 'stone', C.stone);
  if (c.detail)
    for (const sign of [-1, 1])
      box(
        o,
        c,
        x - w / 2 + 0.25,
        z + sign * (d / 2 - 0.45) - 0.15,
        x + w / 2 - 0.25,
        z + sign * (d / 2 - 0.45) + 0.15,
        lo,
        lo + 0.18,
        'stone',
        C.stone,
      );
}
function courtDoors(o, c) {
  if (c.far || c.flat) return;
  for (const p of a.arcades) {
    const n =
      p.court === 1 && p.N[1] > 0.9
        ? Math.floor(p.length / 3) | 1
        : Math.max(1, Math.floor(p.length / 3));
    for (let j = 0; j < n; j++) {
      const u = (p.length * (j + 0.5)) / n,
        x = p.A[0] + p.U[0] * u,
        z = p.A[1] + p.U[1] * u;
      if (p.court === 1 && p.N[1] > 0.9 && Math.abs(x - a.entry.centerX) < a.entry.width / 2)
        continue;
      const F = (v, y, d) => [
          p.A[0] + p.U[0] * (u + v) + p.N[0] * d,
          y,
          p.A[1] + p.U[1] * (u + v) + p.N[1] * d,
        ],
        d = -p.depth + 0.035;
      panel(o, c, F, -0.43, 0.43, a.floorY + 0.08, a.floorY + 2.0, d, 'wood', C.stone);
      for (const v of [-0.49, 0.49])
        panel(
          o,
          c,
          F,
          v - 0.045,
          v + 0.045,
          a.floorY + 0.02,
          a.floorY + 2.1,
          d + 0.04,
          'stone',
          C.stone,
        );
      panel(o, c, F, -0.53, 0.53, a.floorY + 2.02, a.floorY + 2.11, d + 0.04, 'stone', C.stone);
      void z;
    }
  }
}
function exterior(o, c) {
  if (c.far) return;
  const ps = a.nativePolygons[0][0],
    r = cw(ps);
  for (let i = 0; i < r.length; i++) {
    const { L, F, N } = face(r[i], r[(i + 1) % r.length]),
      n = Math.max(1, Math.floor(L / (c.flat ? 12 : 4.8)));
    for (let j = 0; j < n; j++) {
      const u = (L * (j + 0.5)) / n,
        P = F(u, 0, 0.05);
      if (P[2] > 12.8 && P[0] > a.rows[0].loX - 0.2 && P[0] < a.rows[0].hiX + 0.2) continue;
      if (
        Math.abs(P[2] - a.entry.z) < 0.5 &&
        Math.abs(P[0] - a.entry.centerX) < a.entry.width / 2 + 0.7
      )
        continue;
      panel(o, c, F, u - 0.35, u + 0.35, a.floorY + 1.5, a.floorY + 2.4, 0.04, 'wood', C.wood);
      if (!c.flat)
        panel(o, c, F, u - 0.43, u + 0.43, a.floorY + 2.4, a.floorY + 2.53, 0.06, 'stone', C.stone);
      void N;
    }
  }
}
function entry(o, c) {
  const e = a.entry,
    w = e.width / 2,
    F = (u, y, d) => [e.centerX + u, y, e.z - d];
  arch(o, c, F, e.width, a.floorY, a.floorY + 2.9, a.floorY + a.arcadeCeiling, e.depth, C.wall);
  const width = e.approachWidth,
    D = e.approach.distance,
    Y = e.approach.outerY;
  Q(
    o,
    c,
    [F(-width, a.floorY, 0), F(width, a.floorY, 0), F(width, Y[1], D), F(-width, Y[0], D)],
    'base',
    C.base,
    [0, 1, 0],
  );
  for (const sign of [-1, 1])
    Q(
      o,
      c,
      [
        F(sign * width, a.foundationY, 0),
        F(sign * width, a.foundationY, D),
        F(sign * width, Y[sign > 0 ? 1 : 0], D),
        F(sign * width, a.floorY, 0),
      ],
      'base',
      C.base,
    );
  if (c.detail) {
    for (const u of [-w - 0.2, w + 0.2])
      span(o, c, F(u, a.floorY + 0.1, 0.1), F(u, a.floorY + 4.8, 0.1), 0.2, 0.28);
    span(o, c, F(-w - 0.4, a.floorY + 4.9, 0.08), F(0, a.floorY + 6.3, 0.08), 0.24, 0.3);
    span(o, c, F(0, a.floorY + 6.3, 0.08), F(w + 0.4, a.floorY + 4.9, 0.08), 0.24, 0.3);
  }
}
export function buildHawaLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Hawa Mahal tier ' + level);
  const o = safe(output);
  for (const rs of a.nativePolygons)
    prism(o, c, rs, a.foundationY, a.floorY, 'base', C.base, !c.far);
  for (const rs of c.far ? a.farGroundBody : a.lowGroundBody)
    prism(o, c, rs, a.floorY, a.floorY + a.arcadeCeiling, 'wall', C.wall, !c.far);
  for (const rs of a.lowRoofBody)
    prism(o, c, rs, a.floorY + a.arcadeCeiling, a.floorY + a.lowEave, 'wall', C.wall);
  if (!c.far) {
    for (const p of a.arcades)
      arcade(
        o,
        c,
        p.A,
        p.B,
        a.floorY,
        a.floorY + a.arcadeCeiling,
        p.depth,
        p.court === 1 && p.N[1] > 0.9
          ? Math.floor(p.length / (c.flat ? 9 : 3.0)) | 1
          : Math.max(1, Math.floor(p.length / (c.flat ? 9 : 3.0))),
      );
  }
  facade(o, c);
  rear(o, c);
  towers(o, c);
  courts(o, c);
  courtDoors(o, c);
  exterior(o, c);
  entry(o, c);
}
export const buildHawaSkyline = (o) => buildHawaLevel(o, 'skyline'),
  buildHawaDistrict = (o) => buildHawaLevel(o, 'district'),
  buildHawaStreet = (o) => buildHawaLevel(o, 'street'),
  buildHawaCloseup = (o) => buildHawaLevel(o, 'closeup');

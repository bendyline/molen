/** Original complete principal Catherine Palace exterior; signed standard map inputs. */
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
  '4f866b4c1700701cc1a78e2c0ef68fbc497fa5b7556e0b3d1c6b20aa0ff47456'
)
  throw Error('Catherine Palace controls changed: update explicit geometry input pin');
export const catherineControls = JSON.parse(controlsBytes);
const a = catherineControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('83bad5'),
    stone: lin('e8e5d9'),
    base: lin('aaa89d'),
    roof: lin('aeb9c4'),
    gold: lin('d7af59'),
    glass: lin('4c6572'),
    wood: lin('e4e1d3'),
  };
export const catherineSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.66, metallic: 0.25 },
  gold: { slot: 'trim', graph: 'metal_painted', roughness: 0.38, metallic: 0.75 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 4, arch: 2, step: 50 },
  district: { flat: true, n: 6, arch: 2, step: 18 },
  street: { n: 8, arch: 3, step: 10.5 },
  closeup: { detail: true, n: 10, arch: 4, step: 4.7 },
  master: { detail: true, fine: true, n: 24, arch: 16, step: 3.9 },
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
function ribbon(o, c, F, x, y, w, h, s = 'gold', col = C.gold) {
  const n = c.fine ? 12 : c.detail ? 5 : 2;
  for (let i = 0; i < n; i++) {
    const p = (j, k) => {
      const t = j / n;
      return F(x + (t - 0.5) * w, y + Math.sin(t * Math.PI) * h + k, 0.12);
    };
    Q(o, c, [p(i, 0), p(i + 1, 0), p(i + 1, 0.13), p(i, 0.13)], s, col);
  }
}
function window(o, c, F, u, y, w, h, { arch = true, door = false } = {}) {
  const N = sub(F(0, 0, 1), F(0, 0, 0)),
    r = w / 2,
    spring = arch ? y + h - r : y + h,
    points = [
      [-r, y],
      [r, y],
      [r, spring],
    ];
  if (arch)
    for (let i = 1; i <= c.arch; i++) {
      const t = (i / c.arch) * Math.PI;
      points.push([r * Math.cos(t), spring + r * Math.sin(t)]);
    }
  else points.push([-r, y + h]);
  const depth = 0.32,
    point = (p, d = 0) => F(p[0] + u, p[1], d);
  for (let i = 1; i < points.length - 1; i++)
    T(
      o,
      c,
      [point(points[0], -depth), point(points[i], -depth), point(points[i + 1], -depth)],
      door ? 'wood' : 'glass',
      door ? C.wood : C.glass,
      N,
    );
  for (let i = 0; i < points.length; i++) {
    const A = points[i],
      B = points[(i + 1) % points.length];
    Q(o, c, [point(A), point(B), point(B, -depth), point(A, -depth)], 'stone', C.stone);
    if (!c.flat) {
      const dx = B[0] - A[0],
        dy = B[1] - A[1],
        L = Math.hypot(dx, dy),
        nx = (dy / L) * 0.13,
        ny = (-dx / L) * 0.13;
      Q(
        o,
        c,
        [
          point(A, 0.06),
          point(B, 0.06),
          F(B[0] + u + nx, B[1] + ny, 0.06),
          F(A[0] + u + nx, A[1] + ny, 0.06),
        ],
        'stone',
        C.stone,
        N,
      );
    }
  }
  if (c.detail) {
    if (c.fine) {
      span(
        o,
        c,
        F(u, y, -depth + 0.025),
        F(u, spring, -depth + 0.025),
        0.055,
        0.055,
        'wood',
        C.wood,
      );
      for (const v of [0.35, 0.7])
        span(
          o,
          c,
          F(u - r, y + (spring - y) * v, -depth + 0.025),
          F(u + r, y + (spring - y) * v, -depth + 0.025),
          0.055,
          0.055,
          'wood',
          C.wood,
        );
    } else {
      panel(o, c, F, u - 0.028, u + 0.028, y, spring, -depth + 0.025, 'wood', C.wood);
      for (const v of [0.35, 0.7])
        panel(
          o,
          c,
          F,
          u - r,
          u + r,
          y + (spring - y) * v - 0.028,
          y + (spring - y) * v + 0.028,
          -depth + 0.025,
          'wood',
          C.wood,
        );
    }
    if (arch || c.fine) {
      ribbon(o, c, F, u, y + h + 0.2, w + 1, 0.38);
      ribbon(o, c, F, u, y - 0.32, w + 0.65, -0.23);
    }
  }
  return { u: u - r, U: u + r, lo: y, hi: y + h, arch };
}
function facadeBand(o, c, F, L, lo, hi, holes) {
  let x = 0;
  for (const h of holes) {
    panel(o, c, F, x, h.u, lo, hi);
    panel(o, c, F, h.u, h.U, lo, h.lo);
    if (h.arch) {
      const r = (h.U - h.u) / 2,
        m = (h.U + h.u) / 2,
        spring = h.hi - r;
      for (let i = 0; i < c.arch; i++) {
        const p = (t) => [m + r * Math.cos(t), spring + r * Math.sin(t)],
          A = p((i / c.arch) * Math.PI),
          B = p(((i + 1) / c.arch) * Math.PI);
        Q(
          o,
          c,
          [F(...A), F(...B), F(B[0], hi), F(A[0], hi)],
          'wall',
          C.wall,
          sub(F(0, 0, 1), F(0, 0, 0)),
        );
      }
    } else panel(o, c, F, h.u, h.U, h.hi, hi);
    x = h.U;
  }
  panel(o, c, F, x, L, lo, hi);
}
function facades(o, c) {
  for (const rs of a.body) {
    const r = cw(rs[0], c.flat ? 0.15 : 0.015);
    for (let i = 0; i < r.length; i++) {
      const A = r[i],
        B = r[(i + 1) % r.length],
        { L, F, N } = face(A, B);
      if (L < 0.002) continue;
      const lo = a.floorY,
        hi = lo + a.eave;
      if (c.far) {
        panel(o, c, F, 0, L, lo, hi);
        if (L > 6) {
          panel(o, c, F, 0, L, hi - 0.45, hi, 0.025, 'stone', C.stone);
          panel(o, c, F, 0, L, lo + 5.8, lo + 6.15, 0.025, 'stone', C.stone);
        }
        continue;
      }
      const count = Math.floor(L / c.step),
        step = L / Math.max(1, count),
        bands = c.flat
          ? [
              [lo, lo + 6, 1.7, 3.3, false],
              [lo + 6, hi, 7.3, 6, true],
            ]
          : [
              [lo, lo + 1.65, 0.35, 0.95, false],
              [lo + 1.65, lo + 6.1, 2.15, 3.5, true],
              [lo + 6.1, lo + 13, 7.15, 5.1, true],
              [lo + 13, hi, 13.65, 1.55, false],
            ];
      const mid = F(L / 2, 0),
        entryFace =
          N[1] < -0.9 &&
          Math.abs(mid[2] - a.entry.center[1]) < 0.7 &&
          Math.abs(mid[0] - a.entry.center[0]) < 5.5;
      if (c.flat && !entryFace) {
        panel(o, c, F, 0, L, lo, hi);
        const k = L >= 3.8 ? Math.max(1, Math.floor(L / 4.7)) : 0;
        for (let j = 0; j < k; j++) {
          const u = (L * (j + 0.5)) / k,
            w = Math.min(2, (L / k) * 0.5),
            r = w / 2;
          for (const [y, h, arched] of [
            [2.15, 3.5, true],
            [7.15, 5.1, true],
          ]) {
            const y0 = lo + y,
              y1 = y0 + h,
              spring = arched ? y1 - r : y1,
              ps = arched
                ? [
                    F(u - r, y0, 0.04),
                    F(u + r, y0, 0.04),
                    F(u + r, spring, 0.04),
                    F(u, y1, 0.04),
                    F(u - r, spring, 0.04),
                  ]
                : [F(u - r, y0, 0.04), F(u + r, y0, 0.04), F(u + r, y1, 0.04), F(u - r, y1, 0.04)];
            for (let v = 1; v < ps.length - 1; v++)
              T(o, c, [ps[0], ps[v], ps[v + 1]], 'glass', C.glass, [N[0], 0, N[1]]);
          }
          if (j % 2 === 0)
            panel(
              o,
              c,
              F,
              u - L / k / 2 + 0.08,
              u - L / k / 2 + 0.27,
              lo + 6.3,
              hi - 0.4,
              0.06,
              'stone',
              C.stone,
            );
        }
        for (const [y, h] of [
          [lo + 0.12, 0.24],
          [lo + 6, 0.24],
          [hi - 0.35, 0.35],
        ])
          panel(o, c, F, 0, L, y, y + h, 0.1, 'stone', C.stone);
        continue;
      }
      for (const [blo, bhi, y, h, arch] of bands) {
        const holes = [];
        for (let j = 0; j < count; j++) {
          const u = (j + 0.5) * step,
            w = Math.min(c.flat ? 2.4 : 2.0, step * 0.52),
            door = entryFace && j === Math.floor(count / 2) && blo < lo + 2 && bhi > lo + 4;
          if (entryFace && blo < lo + 2 && bhi > lo + 4 && Math.abs(u - L / 2) < 3.4) continue;
          holes.push(window(o, c, F, u, lo + y, w, h, { arch }));
        }
        if (entryFace && blo < lo + 2 && bhi > lo + 4) {
          const u = L / 2,
            w = 3.9;
          holes.push(window(o, c, F, u, a.entry.thresholdY, w, 3.8, { arch: true, door: true }));
          holes.sort((a, b) => a.u - b.u);
        }
        facadeBand(o, c, F, L, blo, bhi, holes);
      }
      for (const [y, h] of [
        [lo + 0.12, 0.24],
        [lo + 6, 0.24],
        [hi - 0.35, 0.35],
      ]) {
        const p = [F(0, 0, 0.1), F(L, 0, 0.1), F(L, 0, -0.1), F(0, 0, -0.1)].map((p) => [
          p[0],
          p[2],
        ]);
        if (c.flat) panel(o, c, F, 0, L, y, y + h, 0.1, 'stone', C.stone);
        else prism(o, c, [p], y, y + h, 'stone', C.stone, false);
      }
      if (!c.flat) {
        for (let j = 0; j <= count; j++) {
          const u = Math.max(0.22, Math.min(L - 0.22, j * step));
          if (L < 3) continue;
          const p = F(u, 0, 0.19),
            radius = c.detail ? 0.19 : 0.17;
          if (c.detail) {
            loft(
              o,
              S(c, 'stone'),
              [
                radialRing(lo + 6.3, radius, radius, c.fine ? c.n : 6, [p[0], p[2]]),
                radialRing(hi - 0.8, radius, radius, c.fine ? c.n : 6, [p[0], p[2]]),
              ],
              C.stone,
            );
            for (const y of [lo + 6.2, hi - 0.8])
              box(
                o,
                c,
                p[0] - 0.31,
                p[2] - 0.28,
                p[0] + 0.31,
                p[2] + 0.28,
                y,
                y + 0.2,
                'gold',
                C.gold,
              );
          } else span(o, c, F(u, lo + 6.3, 0.13), F(u, hi - 0.6, 0.13), 0.28, 0.2);
          if (c.fine) {
            for (let j = 1; j < 8; j++)
              panel(
                o,
                c,
                F,
                u - 0.38,
                u + 0.38,
                lo + j * 0.7,
                lo + j * 0.7 + 0.055,
                0.12,
                'stone',
                C.stone,
              );
          }
        }
      }
      if (c.detail && L > 4) {
        span(o, c, F(0, hi + 0.55, 0.03), F(L, hi + 0.55, 0.03), 0.15, 0.16);
        span(o, c, F(0, hi + 0.1, 0.03), F(L, hi + 0.1, 0.03), 0.15, 0.16);
        const n = Math.floor(L / (c.fine ? 1 : 2.2));
        for (let j = 0; j <= n; j++) {
          const u = (L * j) / Math.max(n, 1);
          span(o, c, F(u, hi + 0.1, 0.03), F(u, hi + 0.55, 0.03), 0.12, 0.12);
        }
      }
    }
  }
}
function hip(o, c, r) {
  let [x, z, X, Z] = r.b;
  const y = a.floorY + r.eave,
    h = r.rise,
    axis = r.axis ?? 'x';
  x -= 0.06;
  X += 0.06;
  z -= 0.06;
  Z += 0.06;
  const A = [x, y, z],
    B = [X, y, z],
    D = [x, y, Z],
    C0 = [X, y, Z];
  let E, G;
  if (axis === 'x') {
    const t = Math.min((Z - z) * 0.45, (X - x) * 0.2);
    E = [x + t, y + h, (z + Z) / 2];
    G = [X - t, y + h, (z + Z) / 2];
  } else {
    const t = Math.min((X - x) * 0.45, (Z - z) * 0.2);
    E = [(x + X) / 2, y + h, z + t];
    G = [(x + X) / 2, y + h, Z - t];
  }
  if (axis === 'x') {
    Q(o, c, [A, B, G, E], 'roof', C.roof, [0, 1, -1]);
    Q(o, c, [D, E, G, C0], 'roof', C.roof, [0, 1, 1]);
    T(o, c, [A, E, D], 'roof', C.roof, [-1, 1, 0]);
    T(o, c, [B, C0, G], 'roof', C.roof, [1, 1, 0]);
  } else {
    Q(o, c, [A, E, G, D], 'roof', C.roof, [-1, 1, 0]);
    Q(o, c, [B, C0, G, E], 'roof', C.roof, [1, 1, 0]);
    T(o, c, [A, B, E], 'roof', C.roof, [0, 1, -1]);
    T(o, c, [D, G, C0], 'roof', C.roof, [0, 1, 1]);
  }
  if (c.detail) {
    const n = Math.floor((axis === 'x' ? X - x : Z - z) / (c.fine ? 2.8 : 7));
    for (let i = 1; i < n; i++) {
      const u = i / n;
      if (axis === 'x') {
        const xx = x + (X - x) * u,
          yy = Math.min(y + h, y + (h * (xx - x)) / (E[0] - x), y + (h * (X - xx)) / (X - G[0]));
        span(o, c, [xx, y + 0.02, z], [xx, yy + 0.03, (z + Z) / 2], 0.045, 0.045, 'roof', C.roof);
        span(o, c, [xx, yy + 0.03, (z + Z) / 2], [xx, y + 0.02, Z], 0.045, 0.045, 'roof', C.roof);
      } else {
        const zz = z + (Z - z) * u,
          yy = Math.min(y + h, y + (h * (zz - z)) / (E[2] - z), y + (h * (Z - zz)) / (Z - G[2]));
        span(o, c, [x, y + 0.02, zz], [(x + X) / 2, yy + 0.03, zz], 0.045, 0.045, 'roof', C.roof);
        span(o, c, [(x + X) / 2, yy + 0.03, zz], [X, y + 0.02, zz], 0.045, 0.045, 'roof', C.roof);
      }
    }
  }
  if (!c.far && r.name.includes('range')) {
    const n = c.flat ? 1 : c.detail ? Math.floor((X - x) / 8) : 2;
    for (let i = 0; i < n; i++) {
      const xx = x + ((X - x) * (i + 0.5)) / n;
      for (const zz of [z + 2, Z - 2]) {
        box(o, c, xx - 0.55, zz - 0.5, xx + 0.55, zz + 0.5, y + 0.4, y + 2, 'wall', C.wall);
        box(o, c, xx - 0.68, zz - 0.6, xx + 0.68, zz + 0.6, y + 1.8, y + 2.1, 'stone', C.stone);
      }
    }
  }
}
function domes(o, c) {
  for (const d of a.domes) {
    const center = d.center,
      n = c.n,
      r = d.radius,
      lo = a.floorY + d.drumLo,
      hi = a.floorY + d.drumHi;
    loft(
      o,
      S(c, 'wall'),
      [
        radialRing(lo, r * 0.67, r * 0.67, n, center),
        radialRing(hi, r * 0.67, r * 0.67, n, center),
      ],
      C.wall,
    );
    if (!c.far) {
      for (const y of [lo, hi])
        loft(
          o,
          'gold',
          [
            radialRing(y - 0.1, r * 0.8, r * 0.8, n, center),
            radialRing(y + 0.12, r * 0.8, r * 0.8, n, center),
          ],
          C.gold,
        );
      for (let i = 0; i < n; i++) {
        const t = (-i / n) * Math.PI * 2,
          F = (u, y, depth = 0) => [
            center[0] + Math.cos(t) * (r * 0.68 + depth) - Math.sin(t) * u,
            y,
            center[1] + Math.sin(t) * (r * 0.68 + depth) + Math.cos(t) * u,
          ];
        panel(o, c, F, -r * 0.18, r * 0.18, lo + 0.45, hi - 0.35, 0.015, 'glass', C.glass);
        if (c.detail)
          span(
            o,
            c,
            F(-r * 0.3, lo + 0.2, 0.07),
            F(-r * 0.3, hi - 0.15, 0.07),
            0.12,
            0.12,
            'gold',
            C.gold,
          );
      }
    }
    const height = a.floorY + d.crownHi - hi,
      profile = c.far
        ? [
            [0, 0.63],
            [0.45, 1],
            [1, 0.05],
          ]
        : c.flat
          ? [
              [0, 0.63],
              [0.28, 1],
              [0.56, 0.85],
              [1, 0.025],
            ]
          : Array.from({ length: c.fine ? 18 : 9 }, (_, i) => {
              const t = i / (c.fine ? 17 : 8);
              return [
                t,
                Math.max(0.01, 0.62 + 0.48 * Math.sin(t * Math.PI) - 0.6 * Math.pow(t, 2)),
              ];
            });
    loft(
      o,
      S(c, 'gold'),
      profile.map(([t, k]) => radialRing(hi + height * t, r * k, r * k, n, center)),
      C.gold,
    );
    const top = a.floorY + d.finialHi;
    span(
      o,
      c,
      [center[0], a.floorY + d.crownHi - 0.1, center[1]],
      [center[0], top, center[1]],
      c.far ? 0.1 : 0.07,
      0.08,
      'gold',
      C.gold,
    );
    if (!c.far) {
      span(
        o,
        c,
        [center[0] - 0.45, top - 0.65, center[1]],
        [center[0] + 0.45, top - 0.65, center[1]],
        0.065,
        0.07,
        'gold',
        C.gold,
      );
      if (c.detail)
        span(
          o,
          c,
          [center[0] - 0.25, top - 0.35, center[1]],
          [center[0] + 0.25, top - 0.35, center[1]],
          0.045,
          0.05,
          'gold',
          C.gold,
        );
    }
    if (c.detail) {
      for (let i = 0; i < n; i++) {
        const t = (-i / n) * Math.PI * 2;
        let last = null;
        for (const [v, k] of profile) {
          const p = [
            center[0] + Math.cos(t) * (r * k + 0.018),
            hi + height * v,
            center[1] + Math.sin(t) * (r * k + 0.018),
          ];
          if (last) span(o, c, last, p, 0.035, 0.035, 'gold', C.gold);
          last = p;
        }
      }
    }
  }
}
function crowns(o, c) {
  if (c.far) return;
  for (const r of a.roofs.filter((r) => r.name.startsWith('projecting-crown'))) {
    const [x, z, X, Z] = r.b,
      cx = (x + X) / 2;
    for (const zz of [z - 0.06, Z + 0.06]) {
      const front = zz < 10,
        F = (u, y, d = 0) => [cx + u, y, zz + (front ? -d : d)],
        width = (X - x) * 0.78,
        lo = a.floorY + a.eave + 0.35,
        hi = lo + (r.name.endsWith('2') ? 2.45 : 1.7),
        n = c.arch * 2;
      for (let i = 0; i < n; i++) {
        const U = -width / 2 + (width * i) / n,
          V = -width / 2 + (width * (i + 1)) / n,
          Y = (u) => lo + (hi - lo) * Math.sqrt(Math.max(0, 1 - Math.pow(u / (width / 2), 2)));
        Q(o, c, [F(U, lo), F(V, lo), F(V, Y(V)), F(U, Y(U))], 'wall', C.wall);
        span(o, c, F(U, Y(U), 0.1), F(V, Y(V), 0.1), 0.16, 0.18);
      }
      if (c.detail) {
        ribbon(o, c, F, 0, lo + 0.4, width * 0.45, 0.7);
        span(o, c, F(-0.45, lo + 0.75, 0.16), F(0.45, lo + 0.75, 0.16), 0.2, 0.16, 'gold', C.gold);
      }
    }
  }
}
function entrance(o, c) {
  const e = a.entry,
    cx = e.center[0],
    z = e.center[1],
    w = e.width / 2;
  box(o, c, cx - w - 1, z - 3.8, cx + w + 1, z + 0.1, a.foundationY, e.thresholdY, 'base', C.base);
  const n = c.far ? 1 : c.flat ? 3 : c.detail ? 8 : 5,
    outer = e.outerZ,
    inner = e.landingZ,
    W = e.approachWidth / 2;
  for (let j = 0; j < n; j++) {
    const Z = inner + ((outer - inner) * j) / n,
      ZZ = inner + ((outer - inner) * (j + 1)) / n,
      lo = e.thresholdY - ((e.thresholdY - a.floorY) * (j + 1)) / n,
      hi = e.thresholdY - ((e.thresholdY - a.floorY) * j) / n;
    box(o, c, cx - W, Z, cx + W, ZZ, lo, hi, 'base', C.base);
  }
  const D = 2.2,
    z0 = outer,
    z1 = outer - D,
    H = e.outerY;
  Q(
    o,
    c,
    [
      [cx - W, a.floorY, z0],
      [cx + W, a.floorY, z0],
      [cx + W, H[1], z1],
      [cx - W, H[0], z1],
    ],
    'base',
    C.base,
    [0, 1, 0],
  );
  for (const sign of [-1, 1])
    Q(
      o,
      c,
      [
        [cx + sign * W, a.foundationY, z0],
        [cx + sign * W, a.foundationY, z1],
        [cx + sign * W, H[sign > 0 ? 1 : 0], z1],
        [cx + sign * W, a.floorY, z0],
      ],
      'base',
      C.base,
    );
}
export function buildCatherineLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Catherine Palace tier ' + level);
  const o = safe(output);
  for (const rs of a.nativePolygons)
    prism(o, c, rs, a.foundationY, a.floorY, 'base', C.base, !c.far);
  for (const rs of a.body) {
    cap(o, c, rs, a.floorY + a.eave, 'roof', C.roof);
    if (!c.far) cap(o, c, rs, a.floorY, 'wall', C.wall, false);
  }
  facades(o, c);
  for (const r of a.roofs) hip(o, c, r);
  // The chapel's raised hipped base supports the five independently modeled drums.
  hip(o, c, { name: 'chapel-base', b: [137.2, 7.46, 151.9, 19.85], eave: 16.8, rise: 6.1 });
  domes(o, c);
  crowns(o, c);
  entrance(o, c);
}
export const buildCatherineSkyline = (o) => buildCatherineLevel(o, 'skyline'),
  buildCatherineDistrict = (o) => buildCatherineLevel(o, 'district'),
  buildCatherineStreet = (o) => buildCatherineLevel(o, 'street'),
  buildCatherineCloseup = (o) => buildCatherineLevel(o, 'closeup');

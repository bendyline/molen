/** 'luxembourg_palace': complete principal palace, three courts, eight roof pavilions and two clock cupolas. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const luxembourgControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = luxembourgControls,
  grid = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  wall: lin('c8bea6'),
  trim: lin('e1d5bb'),
  base: lin('a7a399'),
  roof: lin('555f6b'),
  metal: lin('75818a'),
  glass: lin('526771'),
  frame: lin('deddd2'),
  door: lin('59645f'),
  clock: lin('d9d6ca'),
  hand: lin('3e4c50'),
  paving: lin('b9b0a1'),
};
export const luxembourgSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.88, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.8, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.78, metallic: 0.05 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.25 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.38, metallic: 0.05 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const cfg = {
  skyline: { far: true, n: 4, arch: 2, roofSteps: 1, step: 99 },
  district: { flat: true, n: 6, arch: 2, roofSteps: 1, step: 20 },
  street: { flatFrames: true, n: 6, arch: 4, roofSteps: 2, step: 11, dormers: 1 },
  closeup: { flatFrames: true, n: 8, arch: 6, roofSteps: 4, step: 5.8, dormers: 2, detail: true },
  master: {
    frames: true,
    n: 32,
    arch: 24,
    roofSteps: 16,
    step: 4.8,
    dormers: 3,
    detail: true,
    fine: true,
  },
};
const P = ([u, y, v]) => [-v, y, u],
  clean = (r) => {
    const p = r.slice();
    if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 1e-5) p.pop();
    return p;
  },
  area = (r) =>
    r.reduce((n, p, i) => {
      const q = r[(i + 1) % r.length];
      return n + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => {
    const p = clean(r);
    return area(p) > 0 ? p.reverse() : p;
  };
const S = (c, s) => (c.far ? 'far' : s);
function Q(o, c, p, s = 'wall', color = C.wall, N) {
  if (N && normalFor(...p).reduce((n, v, i) => n + v * N[i], 0) < 0) p.reverse();
  o.addQuad(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function T(o, c, p, s = 'wall', color = C.wall, N) {
  p = p.map((q) => q.map(Math.fround));
  if (N && normalFor(...p).reduce((n, v, i) => n + v * N[i], 0) < 0) p.reverse();
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
const B = (o, c, lo, hi, s = 'trim', color = C.trim) => box(o, S(c, s), lo, hi, color),
  L = (o, c, r, s = 'trim', color = C.trim, cap = true) => loft(o, S(c, s), r, color, { cap }),
  span = (o, c, A, Z, w = 0.1, d = 0.1, s = 'trim', color = C.trim) =>
    beam(o, S(c, s), A, Z, w, d, color);
function cap(o, c, rings, y, s = 'wall', color = C.wall, up = true) {
  const rs = rings.map(clean),
    points = rs.flat(),
    holes = [];
  let n = rs[0].length;
  for (const r of rs.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ids = earcut(points.flat(), holes, 2);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [points[j][0], y, points[j][1]]),
      s,
      color,
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, c, rings, lo, hi, s = 'wall', color = C.wall) {
  const rs = rings.map((r, i) => (i ? cw(r).reverse() : cw(r)));
  for (const r of rs)
    for (let i = 0; i < r.length; i++) {
      const A = r[i],
        Z = r[(i + 1) % r.length];
      Q(
        o,
        c,
        [
          [A[0], lo, A[1]],
          [Z[0], lo, Z[1]],
          [Z[0], hi, Z[1]],
          [A[0], hi, A[1]],
        ],
        s,
        color,
      );
    }
  cap(o, c, rs, hi, s, color);
  cap(o, c, rs, lo, s, color, false);
}
const inside = (p, r) => {
    let b = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const A = r[i],
        Z = r[j];
      if (
        A[1] > p[1] !== Z[1] > p[1] &&
        p[0] < ((Z[0] - A[0]) * (p[1] - A[1])) / (Z[1] - A[1]) + A[0]
      )
        b = !b;
    }
    return b;
  },
  occupied = (p, h) =>
    a.body.some(
      (b) => b.top >= h && inside(p, b.rings[0]) && !b.rings.slice(1).some((r) => inside(p, r)),
    );
export function luxembourgGroundY(u, v) {
  const x = -v,
    z = u,
    U = (x - grid.origin[0]) / grid.stepMeters,
    V = (z - grid.origin[1]) / grid.stepMeters,
    n = grid.size[0],
    i = Math.max(0, Math.min(n - 2, Math.floor(U))),
    j = Math.max(0, Math.min(n - 2, Math.floor(V))),
    p = Math.max(0, Math.min(1, U - i)),
    q = Math.max(0, Math.min(1, V - j)),
    g = grid.elevationsMeters;
  return (
    (1 - p) * (1 - q) * g[j * n + i] +
    p * (1 - q) * g[j * n + i + 1] +
    (1 - p) * q * g[(j + 1) * n + i] +
    p * q * g[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
function wallPoint(A, Z, N) {
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    len = Math.hypot(dx, dz);
  return {
    len,
    P: (u, y, d = 0) => [A[0] + (dx * u) / len + N[0] * d, y, A[1] + (dz * u) / len + N[1] * d],
  };
}
function window(o, c, P, y, w, h, arched = false) {
  const n = c.arch,
    top = y + h,
    shape = arched
      ? [
          [-w / 2, y],
          [w / 2, y],
          ...Array.from({ length: n + 1 }, (_, i) => {
            const t = (i * Math.PI) / n;
            return [(Math.cos(t) * w) / 2, top - w / 2 + (Math.sin(t) * w) / 2];
          }),
        ]
      : [
          [-w / 2, y],
          [w / 2, y],
          [w / 2, top],
          [-w / 2, top],
        ],
    center = [0, y + h / 2];
  for (let i = 0; i < shape.length; i++)
    T(
      o,
      c,
      [P(...center, 0.045), P(...shape[i], 0.045), P(...shape[(i + 1) % shape.length], 0.045)],
      'glass',
      C.glass,
    );
  if (c.flat) return;
  for (let i = 0; i < shape.length; i++) {
    const A = shape[i],
      Z = shape[(i + 1) % shape.length];
    if (c.frames) span(o, c, P(...A, 0.12), P(...Z, 0.12), 0.14, 0.12, 'wood', C.frame);
    else {
      const dx = Z[0] - A[0],
        dy = Z[1] - A[1],
        d = Math.hypot(dx, dy),
        t = 0.07;
      Q(
        o,
        c,
        [
          P(A[0] - (dy / d) * t, A[1] + (dx / d) * t, 0.1),
          P(Z[0] - (dy / d) * t, Z[1] + (dx / d) * t, 0.1),
          P(Z[0] + (dy / d) * t, Z[1] - (dx / d) * t, 0.1),
          P(A[0] + (dy / d) * t, A[1] - (dx / d) * t, 0.1),
        ],
        'wood',
        C.frame,
      );
    }
  }
  span(o, c, P(0, y, 0.13), P(0, top - 0.12, 0.13), 0.085, 0.08, 'wood', C.frame);
  if (c.detail)
    for (const t of [0.35, 0.68])
      span(
        o,
        c,
        P(-w / 2, y + h * t, 0.13),
        P(w / 2, y + h * t, 0.13),
        0.08,
        0.08,
        'wood',
        C.frame,
      );
}
function facade(o, c, rings, top, groundLevel = false) {
  if (c.far) return;
  for (const [ri, rr] of rings.entries()) {
    const r = ri ? cw(rr).reverse() : cw(rr);
    for (let i = 0; i < r.length; i++) {
      const A = r[i],
        Z = r[(i + 1) % r.length],
        dx = Z[0] - A[0],
        dz = Z[1] - A[1],
        len = Math.hypot(dx, dz);
      if (len < 2.8) continue;
      const N = [-dz / len, dx / len],
        { P } = wallPoint(A, Z, N),
        n = Math.max(1, Math.round(len / c.step));
      for (const [y, h] of top > 17 && top < 21
        ? [
            [1.6, 5],
            [7.8, 3.7],
            [13.1, 3.8],
          ]
        : [
            [1.6, 5],
            [9.3, 4.3],
            [16.3, 4.1],
          ]) {
        if (y < 3 && !groundLevel) continue;
        if (y + h > top - 0.35) continue;
        for (let j = 0; j < n; j++) {
          const u = ((j + 0.5) * len) / n,
            p = P(u, y + h / 2, 0.3);
          if (occupied([p[0], p[2]], y + h / 2)) continue;
          if (y < 3 && Math.abs(p[0] - 14.6) < 4 && p[2] > -73 && p[2] < -56) continue;
          const W = (x, Y, d) => P(u + x, Y, d);
          window(o, c, W, y, Math.min(2.05, (len / n) * 0.54), h, y < 3);
          if (c.detail) {
            const w = Math.min(2.05, (len / n) * 0.54);
            span(o, c, W(-w * 0.65, y + h + 0.25, 0.1), W(w * 0.65, y + h + 0.25, 0.1), 0.2, 0.18);
          }
        }
      }
      if (c.flat) continue;
      if (c.detail) {
        for (let y = 1.2; y < 8; y += 1) {
          const m = P(len / 2, y, 0.025);
          if (occupied([m[0], m[2]], y)) continue;
          Q(
            o,
            c,
            [
              P(0, y - 0.025, 0.025),
              P(len, y - 0.025, 0.025),
              P(len, y + 0.025, 0.025),
              P(0, y + 0.025, 0.025),
            ],
            'trim',
            C.base,
          );
        }
      }
      for (const y of [0.95, 8.1, 14.2, top - 0.25]) {
        if (y > top) continue;
        const m = P(len / 2, y, 0.2);
        if (occupied([m[0], m[2]], y)) continue;
        if (c.flatFrames)
          Q(
            o,
            c,
            [
              P(0, y - 0.15, 0.1),
              P(len, y - 0.15, 0.1),
              P(len, y + 0.15, 0.1),
              P(0, y + 0.15, 0.1),
            ],
            'trim',
            C.trim,
          );
        else span(o, c, P(0, y, 0.1), P(len, y, 0.1), 0.3, 0.2);
      }
      if (c.detail) {
        for (let j = 0; j <= Math.round(len / 5); j++) {
          const u = (len * j) / Math.max(1, Math.round(len / 5)),
            p = P(u, 11, 0.25);
          if (occupied([p[0], p[2]], 11)) continue;
          span(o, c, P(u, 8.6, 0.15), P(u, Math.min(top - 0.5, 22.6), 0.15), 0.55, 0.28);
        }
      }
    }
  }
}
function roof(o, c, def) {
  const native = cw(def.rings[0]),
    xs = native.map((p) => p[0]),
    zs = native.map((p) => p[1]),
    r = c.far
      ? cw([
          [Math.min(...xs), Math.min(...zs)],
          [Math.max(...xs), Math.min(...zs)],
          [Math.max(...xs), Math.max(...zs)],
          [Math.min(...xs), Math.max(...zs)],
        ])
      : native,
    center = [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2],
    e = def.eave,
    t = def.top,
    profile =
      def.style === 'pavilion' && !c.far
        ? [
            [e, 1],
            [e + 0.5, 1.015],
            [t - 0.35, 0.28],
            [t, 0.26],
          ]
        : [
            [e, 1],
            [t, 0.25],
          ],
    rings = [];
  for (let k = 1; k < profile.length; k++) {
    const [y0, s0] = profile[k - 1],
      [y1, s1] = profile[k],
      n = def.style === 'pavilion' ? c.roofSteps : 1;
    for (let j = 0; j < n; j++) {
      const w = j / n;
      rings.push(
        r.map((p) => [
          center[0] + (p[0] - center[0]) * (s0 + (s1 - s0) * w),
          y0 + (y1 - y0) * w,
          center[1] + (p[1] - center[1]) * (s0 + (s1 - s0) * w),
        ]),
      );
    }
  }
  const [y, s] = profile.at(-1);
  rings.push(
    r.map((p) => [center[0] + (p[0] - center[0]) * s, y, center[1] + (p[1] - center[1]) * s]),
  );
  L(o, c, rings, 'roof', C.roof);
  if (c.far || c.flat) return;
  if (def.style === 'pavilion') {
    const xs = r.map((p) => p[0]),
      zs = r.map((p) => p[1]),
      x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      z0 = Math.min(...zs),
      z1 = Math.max(...zs);
    // Substantial pale chimneys and seated dormers are characteristic roof geometry.
    for (const [dx, dz] of [
      [-1, -1],
      [1, 1],
      ...(c.detail
        ? [
            [-1, 1],
            [1, -1],
          ]
        : []),
    ]) {
      const x = center[0] + dx * (x1 - x0) * 0.28,
        z = center[1] + dz * (z1 - z0) * 0.28,
        y = e + (t - e) * 0.44;
      B(o, c, [x - 0.62, y, z - 0.62], [x + 0.62, t + 1.35, z + 0.62]);
      B(o, c, [x - 0.82, t + 1.1, z - 0.82], [x + 0.82, t + 1.55, z + 0.82]);
      if (c.detail)
        for (const k of [-0.38, 0.38])
          B(
            o,
            c,
            [x + k - 0.13, t + 1.55, z - 0.16],
            [x + k + 0.13, t + 1.95, z + 0.16],
            'base',
            C.base,
          );
    }
    if (c.dormers && (c.detail || [288, 290, 292, 280].includes(def.id)))
      for (let side = 0; side < 4; side++) {
        const A = r[side % r.length],
          Z = r[(side + 1) % r.length];
        if (!Z) continue;
        const dx = Z[0] - A[0],
          dz = Z[1] - A[1],
          len = Math.hypot(dx, dz),
          N = [-dz / len, dx / len];
        for (let j = 0; j < c.dormers; j++) {
          const f = (j + 1) / (c.dormers + 1),
            x = A[0] + dx * f - N[0] * 0.8,
            z = A[1] + dz * f - N[1] * 0.8,
            y = e + 0.8;
          B(o, c, [x - 0.6, y, z - 0.6], [x + 0.6, y + 1.9, z + 0.6]);
          const W = (u, Y, d) => [x + (dx / len) * u + N[0] * d, Y, z + (dz / len) * u + N[1] * d];
          window(o, c, W, y + 0.25, 0.7, 1.25);
          B(o, c, [x - 0.72, y + 1.9, z - 0.72], [x + 0.72, y + 2.12, z + 0.72], 'roof', C.roof);
        }
      }
  }
}
function dome(o, c, center, radius, lo, hi) {
  const steps = c.far ? 2 : c.roofSteps * 2,
    rr = Array.from({ length: steps + 1 }, (_, j) => {
      const t = ((j / steps) * Math.PI) / 2,
        r = Math.max(0.15, radius * Math.cos(t));
      return radialRing(lo + (hi - lo) * Math.sin(t), r, r, c.n, center);
    });
  L(o, c, rr, 'roof', C.roof);
  if (!c.far && c.detail)
    for (let k = 0; k < 8; k++) {
      const theta = (-k / 8) * Math.PI * 2,
        ps = rr.map((r) => {
          const p = r[Math.round((k * c.n) / 8) % c.n];
          return p;
        });
      for (let j = 1; j < ps.length; j++)
        span(o, c, ps[j - 1], ps[j], 0.12, 0.12, 'metal', C.metal);
    }
}
function clock(o, c, center, N, radius) {
  if (c.far) return;
  const dx = N[1],
    dz = -N[0],
    P = (u, y, d = 0) => [
      center[0] + u * dx + N[0] * d,
      center[1] + y,
      center[2] + u * dz + N[1] * d,
    ];
  for (let i = 0; i < c.n; i++) {
    const p = (t) => P(Math.cos(t) * radius, Math.sin(t) * radius, 0.04);
    T(
      o,
      c,
      [P(0, 0, 0.04), p((i / c.n) * Math.PI * 2), p(((i + 1) / c.n) * Math.PI * 2)],
      'trim',
      C.clock,
      [N[0], 0, N[1]],
    );
  }
  span(o, c, P(0, 0, 0.08), P(-radius * 0.45, radius * 0.38, 0.08), 0.1, 0.08, 'metal', C.hand);
  span(o, c, P(0, 0, 0.09), P(radius * 0.17, radius * 0.65, 0.09), 0.1, 0.08, 'metal', C.hand);
}
function gate(o, c) {
  const [x, z] = a.gate.center,
    lo = 8.6;
  B(o, c, [x - 6.2, lo, z - 5.7], [x + 6.2, 15.8, z + 5.7]);
  L(
    o,
    c,
    [15.8, 20.5].map((y) => radialRing(y, 4.4, 4.4, c.n, [x, z])),
  );
  dome(o, c, [x, z], 4.5, 20.5, 25.7);
  L(
    o,
    c,
    [25.7, 27.8].map((y) => radialRing(y, 0.95, 0.95, c.n, [x, z])),
  );
  dome(o, c, [x, z], 1.1, 27.8, 28.8);
  B(o, c, [x - 0.07, 28.8, z - 0.07], [x + 0.07, 32, z + 0.07], 'metal', C.metal);
  if (!c.far) {
    for (const n of [-1, 1]) {
      clock(o, c, [x, 18.1, z + n * 4.43], [0, n], 0.95);
      window(o, c, (u, y, d) => [x + u, y, z + n * (5.74 + d)], 9.4, 2.45, 4.6, true);
      for (const k of [-4.7, -3.5, 3.5, 4.7]) {
        const y0 = 8.7,
          y1 = 15.65,
          p = [x + k, z + n * 5.84];
        L(
          o,
          c,
          [y0, y0 + 0.3, y1 - 0.4, y1].map((y, i) =>
            radialRing(
              y,
              i === 0 || i === 3 ? 0.43 : 0.29,
              i === 0 || i === 3 ? 0.43 : 0.29,
              c.n,
              p,
            ),
          ),
        );
      }
    }
  }
  // Real full-depth arch passage through the low north crossrange.
  const [x0, z0, x1, z1] = a.portal,
    r = (x1 - x0) / 2,
    m = (x0 + x1) / 2,
    spring = 3.5,
    top = 6.32,
    n = c.arch;
  for (let j = 0; j < n; j++) {
    const t = (j / n) * Math.PI,
      Tt = ((j + 1) / n) * Math.PI,
      p = [m + Math.cos(t) * r, spring + Math.sin(t) * r],
      q = [m + Math.cos(Tt) * r, spring + Math.sin(Tt) * r];
    for (const [z, N] of [
      [z0, [0, 0, -1]],
      [z1, [0, 0, 1]],
    ])
      Q(
        o,
        c,
        [
          [p[0], p[1], z],
          [q[0], q[1], z],
          [q[0], top, z],
          [p[0], top, z],
        ],
        'trim',
        C.trim,
        N,
      );
    Q(
      o,
      c,
      [
        [p[0], p[1], z0],
        [p[0], p[1], z1],
        [q[0], q[1], z1],
        [q[0], q[1], z0],
      ],
      'trim',
      C.trim,
      [-Math.cos((t + Tt) / 2), -Math.sin((t + Tt) / 2), 0],
    );
  }
}
function gardenClock(o, c) {
  const [x, z] = a.gardenClock.center;
  B(o, c, [x - 5.2, 14.5, z - 4], [x + 5.2, 20.3, z + 4]);
  L(
    o,
    c,
    [20.3, 23].map((y) => radialRing(y, 3.75, 3.75, c.n, [x, z])),
  );
  dome(o, c, [x, z], 3.85, 23, 27.1);
  L(
    o,
    c,
    [27.1, 28.2].map((y) => radialRing(y, 0.6, 0.6, c.n, [x, z])),
  );
  B(o, c, [x - 0.05, 28.2, z - 0.05], [x + 0.05, 30, z + 0.05], 'metal', C.metal);
  clock(o, c, [x, 21.7, z + 3.77], [0, 1], 1.05);
  if (!c.far) {
    window(o, c, (u, y, d) => [x + u, y, z + 4.04 + d], 1.6, 2.7, 5.1, true);
    for (const k of [-3.5, 3.5])
      span(o, c, [x + k, 1, z + 4.12], [x + k, 20.1, z + 4.12], 0.6, 0.25);
  }
}
export function buildLuxembourgLevel(output, level) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Luxembourg LOD ' + level);
  const o = {
    addQuad: (s, r, p, n, uv, C) => output.addQuad(s, r, p.map(P), P(n), uv, C),
    addTriangle: (s, r, p, n, uv, C) => output.addTriangle(s, r, p.map(P), P(n), uv, C),
    addConvexPolygon: (s, r, p, n, uv, C) =>
      output.addConvexPolygon(s, r, p.map(P), P(n), (q) => uv([q[2], q[1], -q[0]]), C),
  };
  if (c.far || c.flat) {
    for (const rs of a.farBase) prism(o, c, rs, c.far ? -2 : 0.8, 8.6);
    B(o, c, [11.8, 6.3, -72], [17.4, 8.6, -56], 'wall', C.wall);
    for (const b of a.body.slice(1)) {
      const p = b.rings[0],
        xs = p.map((q) => q[0]),
        zs = p.map((q) => q[1]);
      B(
        o,
        c,
        [Math.min(...xs), 8.6, Math.min(...zs)],
        [Math.max(...xs), b.top, Math.max(...zs)],
        'wall',
        C.wall,
      );
    }
  } else for (const b of a.bands) for (const rs of b.polygons) prism(o, c, rs, b.lo, b.hi);
  for (const rings of c.flat ? a.farBase : a.bands[0].polygons) facade(o, c, rings, 8.6, true);
  for (const body of a.body.slice(1)) facade(o, c, body.rings, body.top);
  for (const rr of a.roofs) roof(o, c, rr);
  gate(o, c);
  gardenClock(o, c);
  // Native-ground foundations stay separate from the three open court voids.
  if (!c.far)
    for (const [ri, rr] of a.full.entries()) {
      const r = ri ? cw(rr).reverse() : cw(rr);
      for (let i = 0; i < r.length; i++) {
        const A = r[i],
          Z = r[(i + 1) % r.length],
          low = (p) => Math.min(0.5, luxembourgGroundY(...p) - 0.3);
        Q(
          o,
          c,
          [
            [A[0], low(A), A[1]],
            [Z[0], low(Z), Z[1]],
            [Z[0], 0.8, Z[1]],
            [A[0], 0.8, A[1]],
          ],
          'base',
          C.base,
        );
      }
    }
  cap(o, c, [a.courts[0]], 0.8, 'base', C.paving);
  cap(
    o,
    c,
    [
      [
        [11.8, -72],
        [17.4, -72],
        [17.4, -56],
        [11.8, -56],
      ],
    ],
    0.8,
    'base',
    C.paving,
  );
  if (c.detail) {
    const x = 14.5,
      z = -7.8;
    for (let j = 0; j < 9; j++) {
      const u = -9 + j * 5.8;
      B(o, c, [u, 0.8, z - 0.22], [u + 3.3, 0.84, z + 0.22], 'base', C.base);
    }
    for (const s of [-1, 1]) {
      const u = x + s * 24;
      span(o, c, [u, 0.9, -55], [u, 0.9, 9], 0.15, 0.05, 'base', C.base);
    }
  }
}
export const buildLuxembourgSkyline = (o) => buildLuxembourgLevel(o, 'skyline');
export const buildLuxembourgDistrict = (o) => buildLuxembourgLevel(o, 'district');
export const buildLuxembourgStreet = (o) => buildLuxembourgLevel(o, 'street');
export const buildLuxembourgCloseup = (o) => buildLuxembourgLevel(o, 'closeup');

/** Original complete twin-wing Chaillot Palace exterior. Detailed source; current acceptance is recorded in qa.json. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const controlsBytes = readFileSync(new URL('../layout.json', import.meta.url));
if (
  createHash('sha256').update(controlsBytes).digest('hex') !==
  'dc0c9f2fe3166b8bd22370aaa59cd256cc67f72cd78053425b894dbff07f8f9b'
)
  throw Error('Chaillot Palace controls changed: update explicit geometry input pin');
export const chaillotControls = JSON.parse(controlsBytes);
const a = chaillotControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('d9ceb8'),
    lower: lin('cbc0aa'),
    stone: lin('e0d4bd'),
    base: lin('b7ad9b'),
    roof: lin('aba69b'),
    brown: lin('a69771'),
    glass: lin('536975'),
    wood: lin('99876c'),
    door: lin('887354'),
  };
export const chaillotSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.87 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'gravel', roughness: 0.9 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.55, metallic: 0.25 },
  wood: { slot: 'door', graph: 'metal_painted', roughness: 0.6, metallic: 0.2 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4 },
};
const configs = {
  skyline: { far: true, n: 4, arch: 2, step: 28 },
  district: { flat: true, n: 6, arch: 2, step: 12 },
  street: { n: 8, arch: 3, step: 6 },
  closeup: { detail: true, n: 12, arch: 4, step: 4.8 },
  master: { detail: true, fine: true, n: 16, arch: 6, step: 4.4 },
};
const grade = (p) =>
    a.floorY +
    (a.terminalFloorY - a.floorY) * Math.max(0, Math.min(1, (Math.abs(p[0]) - 75) / 115)),
  floor = (b, p) =>
    b.kind === 'central'
      ? a.floorY
      : ['terminal', 'low-annex'].includes(b.kind)
        ? a.terminalFloorY
        : grade(p),
  top = (b, p) =>
    b.kind === 'central'
      ? 33.0
      : b.kind === 'terminal'
        ? 25.3
        : b.kind === 'low-annex'
          ? a.terminalFloorY + 5
          : grade(p) + 25.6;
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
  const rings = rs.map((r) => clean(r, c.far ? 1.1 : c.flat ? 0.15 : 0.008)),
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
      ? cw(raw, c.far ? 1.1 : c.flat ? 0.15 : 0.008).reverse()
      : cw(raw, c.far ? 1.1 : c.flat ? 0.15 : 0.008);
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
function profile(h, c) {
  const u = h.u,
    w = h.width,
    lo = h.lo,
    hi = h.hi,
    r = w / 2;
  if (h.shape === 'circle')
    return Array.from({ length: c.fine ? 28 : c.detail ? 16 : 8 }, (_, i) => {
      const t = (i / (c.fine ? 28 : c.detail ? 16 : 8)) * Math.PI * 2;
      return [u + Math.cos(t) * r, (lo + hi) / 2 + (Math.sin(t) * (hi - lo)) / 2];
    });
  if (h.shape === 'rect')
    return [
      [u - r, lo],
      [u + r, lo],
      [u + r, hi],
      [u - r, hi],
    ];
  const spring = hi - r;
  return [
    [u - r, lo],
    [u + r, lo],
    ...Array.from({ length: c.arch + 1 }, (_, i) => {
      const t = (i / c.arch) * Math.PI;
      return [u + r * Math.cos(t), spring + r * Math.sin(t)];
    }),
  ];
}
function ribbon(o, c, F, u, y, w, h) {
  const n = c.fine ? 16 : c.detail ? 7 : 3;
  for (let i = 0; i < n; i++) {
    const p = (j, k) => {
      const t = j / n;
      return F(u + (t - 0.5) * w, y + Math.sin(t * Math.PI) * h + k, 0.12);
    };
    Q(o, c, [p(i, 0), p(i + 1, 0), p(i + 1, 0.13), p(i, 0.13)], 'stone', C.lower);
  }
}
function opening(o, c, F, h) {
  if (h.through) return;
  const ps = profile(h, c),
    N = sub(F(0, 0, 1), F(0, 0, 0)),
    depth = h.depth ?? 0.32,
    point = (p, d) => F(p[0], p[1], d);
  for (let i = 1; i < ps.length - 1; i++)
    T(
      o,
      c,
      [
        point(ps[0], c.flat ? 0.03 : -depth),
        point(ps[i], c.flat ? 0.03 : -depth),
        point(ps[i + 1], c.flat ? 0.03 : -depth),
      ],
      h.arcade ? 'wall' : h.door ? 'wood' : 'glass',
      h.arcade ? C.wall : h.door ? C.door : C.glass,
      N,
    );
  if (c.flat) return;
  for (let i = 0; i < ps.length; i++) {
    const A = ps[i],
      B = ps[(i + 1) % ps.length],
      dx = B[0] - A[0],
      dy = B[1] - A[1],
      L = Math.hypot(dx, dy);
    if (L < 1e-8) continue;
    Q(o, c, [point(A, 0), point(B, 0), point(B, -depth), point(A, -depth)], 'stone', C.stone);
    const nx = (dy / L) * 0.14,
      ny = (-dx / L) * 0.14;
    if (c.fine) span(o, c, point(A, 0.08), point(B, 0.08), 0.14, 0.18);
    else
      Q(
        o,
        c,
        [
          point(A, 0.07),
          point(B, 0.07),
          F(B[0] + nx, B[1] + ny, 0.07),
          F(A[0] + nx, A[1] + ny, 0.07),
        ],
        'stone',
        C.stone,
        N,
      );
  }
  if (c.detail && h.shape !== 'circle') {
    const r = h.width / 2,
      spring = h.hi - (h.shape === 'arch' ? r : 0);
    for (const v of [0.33, 0.66])
      panel(
        o,
        c,
        F,
        h.u - r,
        h.u + r,
        h.lo + (spring - h.lo) * v - 0.025,
        h.lo + (spring - h.lo) * v + 0.025,
        -depth + 0.025,
        'wood',
        C.wood,
      );
    panel(o, c, F, h.u - 0.028, h.u + 0.028, h.lo, spring, -depth + 0.025, 'wood', C.wood);
    if (c.fine && h.width > 2)
      for (const v of [-0.25, 0.25])
        span(
          o,
          c,
          F(h.u + h.width * v, h.lo, -depth + 0.03),
          F(h.u + h.width * v, spring, -depth + 0.03),
          0.05,
          0.06,
          'wood',
          C.wood,
        );
    if (!h.door && h.shape === 'arch') {
      ribbon(o, c, F, h.u, h.hi + 0.2, h.width + 0.8, 0.32);
      ribbon(o, c, F, h.u, h.lo - 0.28, h.width + 0.6, -0.22);
    }
  }
}
function faceBand(o, c, F, L, lo, hi, holes, col) {
  if (c.flat && holes.some((h) => h.through))
    return faceBand(o, { ...c, flat: false }, F, L, lo, hi, holes, col);
  holes = holes.filter(
    (h) =>
      h.lo >= lo - 1e-7 &&
      h.hi <= hi + 1e-7 &&
      h.u - h.width / 2 > 0.1 &&
      h.u + h.width / 2 < L - 0.1,
  );
  if (c.flat) {
    panel(o, c, F, 0, L, lo, hi, 0, 'wall', col);
    for (const h of holes) opening(o, c, F, h);
    return;
  }
  const rs = [
      [
        [0, lo],
        [L, lo],
        [L, hi],
        [0, hi],
      ],
      ...holes.map((h) => profile(h, c)),
    ],
    ps = rs.flat(),
    indices = [],
    offsets = [];
  let n = rs[0].length;
  for (const r of rs.slice(1)) {
    offsets.push(n);
    n += r.length;
  }
  indices.push(...earcut(ps.flat(), offsets, 2));
  for (let i = 0; i < indices.length; i += 3)
    T(
      o,
      c,
      indices.slice(i, i + 3).map((j) => F(...ps[j])),
      'wall',
      col,
      sub(F(0, 0, 1), F(0, 0, 0)),
    );
  for (const h of holes) opening(o, c, F, h);
}
function oriented(p, u, d) {
  return [p.center[0] + p.U[0] * u + p.N[0] * d, p.center[1] + p.U[1] * u + p.N[1] * d];
}
function porticoRing(p, u, U, d, D) {
  return [[oriented(p, u, d), oriented(p, U, d), oriented(p, U, D), oriented(p, u, D)]];
}
function bodies(o, c) {
  for (const b of a.bodies) {
    for (const rs of b.polygons) {
      for (const [ri, raw] of rs.entries()) {
        const r = ri ? cw(raw, c.far ? 1.8 : 0.02).reverse() : cw(raw, c.far ? 1.8 : 0.02);
        for (let i = 0; i < r.length; i++) {
          const A = r[i],
            B = r[(i + 1) % r.length],
            v = face(A, B);
          if (v.L < 0.02) continue;
          const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2],
            outside = [mid[0] + v.N[0] * 0.02, mid[1] + v.N[1] * 0.02],
            neighbors = a.bodies.filter((q) => q !== b && inPs(q.polygons, outside)),
            other = neighbors.length ? Math.max(...neighbors.map((q) => top(q, mid))) : -Infinity,
            base = Math.max(floor(b, A), floor(b, B)),
            hi = Math.min(top(b, A), top(b, B)),
            lo = Math.max(base, other);
          if (other >= hi - 0.01) continue;
          if (!neighbors.length) {
            Q(
              o,
              c,
              [
                [A[0], a.foundationY, A[1]],
                [B[0], a.foundationY, B[1]],
                [B[0], floor(b, B), B[1]],
                [A[0], floor(b, A), A[1]],
              ],
              'base',
              C.base,
            );
            if (Math.min(floor(b, A), floor(b, B)) < base - 0.001)
              Q(
                o,
                c,
                [
                  [A[0], floor(b, A), A[1]],
                  [B[0], floor(b, B), B[1]],
                  v.F(v.L, base),
                  v.F(0, base),
                ],
                'wall',
                C.wall,
              );
          }
          if (c.far) {
            panel(o, c, v.F, 0, v.L, lo, hi, 0, 'wall', C.wall);
          } else {
            const p = a.porticos.find((p) => {
                const relative = [mid[0] - p.center[0], mid[1] - p.center[1]],
                  d = relative[0] * p.N[0] + relative[1] * p.N[1];
                return (
                  Math.abs(d + p.depth) < 0.05 &&
                  Math.abs(relative[0] * p.U[0] + relative[1] * p.U[1]) <= p.width / 2 + 1 &&
                  v.N[0] * p.N[0] + v.N[1] * p.N[1] > 0.95
                );
              }),
              n =
                v.L > (c.flat ? 9 : 3)
                  ? p
                    ? p.columns - 1
                    : Math.max(1, Math.floor(v.L / c.step))
                  : 0,
              step = v.L / Math.max(1, n),
              holes = [];
            for (let j = 0; j < n; j++) {
              const gap = p
                  ? ((j + 0.5) / (p.columns - 1) - 0.5) *
                    (p.width - (p.name.includes('inner') ? 2.1 : 2.35))
                  : null,
                point = p ? oriented(p, gap, -p.depth) : null,
                u = p ? (point[0] - A[0]) * v.U[0] + (point[1] - A[1]) * v.U[1] : (j + 0.5) * step,
                w = Math.min(p ? 3.7 : b.kind === 'curved-wing' ? 2.2 : 2.8, step * 0.66),
                bottom = lo + (p ? 1.3 : 2.4),
                high = hi - (p ? 1.5 : 2.3);
              if (high > bottom + 2)
                holes.push({
                  u,
                  width: w,
                  lo: bottom,
                  hi: high,
                  shape: 'rect',
                  depth: p ? 0.38 : 0.28,
                });
            }
            faceBand(o, c, v.F, v.L, lo, hi, holes, C.wall);
            if (c.detail) {
              for (const y of [base + 0.4, hi - 0.7])
                span(o, c, v.F(0, y, 0.1), v.F(v.L, y, 0.1), 0.4, 0.38, 'stone', C.stone);
              if (c.fine && b.kind === 'curved-wing')
                for (let y = base + 3; y < hi - 2; y += 5.5)
                  panel(o, c, v.F, 0, v.L, y, y + 0.16, 0.04, 'stone', C.lower);
            }
          }
          if (Math.max(top(b, A), top(b, B)) > hi + 0.001)
            Q(
              o,
              c,
              [v.F(0, hi), v.F(v.L, hi), [B[0], top(b, B), B[1]], [A[0], top(b, A), A[1]]],
              'wall',
              C.wall,
            );
        }
      }
      const wells = c.far || c.flat ? [] : a.roofWells.filter((w) => w.owner === b.name),
        rings = [...rs, ...wells.map((w) => w.ring)];
      cap(o, c, rings, (p) => top(b, p), 'roof', C.roof);
      for (const w of wells) {
        const ring = cw(w.ring).reverse();
        for (let i = 0; i < ring.length; i++) {
          const A = ring[i],
            B = ring[(i + 1) % ring.length];
          Q(
            o,
            c,
            [
              [A[0], w.lo, A[1]],
              [B[0], w.lo, B[1]],
              [B[0], top(b, B) + 0.7, B[1]],
              [A[0], top(b, A) + 0.7, A[1]],
            ],
            'stone',
            C.stone,
          );
        }
        cap(o, c, [w.ring], w.lo, 'glass', C.glass);
        if (c.detail)
          for (let z = -47; z <= -30; z += c.fine ? 4 : 8)
            if (b.kind === 'central')
              span(
                o,
                c,
                [b.sign * 40, w.lo + 0.08, z],
                [b.sign * 60, w.lo + 0.08, z],
                0.22,
                0.2,
                'wood',
                C.wood,
              );
      }
      if (!c.far) {
        const ring = cw(rs[0], c.flat ? 1 : 0.12);
        for (let i = 0; i < ring.length; i++) {
          const A = ring[i],
            B = ring[(i + 1) % ring.length];
          span(
            o,
            c,
            [A[0], top(b, A) + 0.35, A[1]],
            [B[0], top(b, B) + 0.35, B[1]],
            c.flat ? 0.4 : 0.7,
            0.75,
            'stone',
            C.stone,
          );
        }
        if (['central', 'terminal'].includes(b.kind)) {
          const xs = rs[0].map((p) => p[0]),
            zs = rs[0].map((p) => p[1]),
            x = (Math.min(...xs) + Math.max(...xs)) / 2,
            z = (Math.min(...zs) + Math.max(...zs)) / 2,
            w = b.kind === 'central' ? 27 : 19,
            D = b.kind === 'central' ? 41 : 15,
            Y = top(b, [x, z]);
          const inner = rect(x - w / 2, z - D / 2, x + w / 2, z + D / 2)[0];
          for (let j = 0; j < 4; j++)
            span(
              o,
              c,
              [inner[j][0], Y + 1.25, inner[j][1]],
              [inner[(j + 1) % 4][0], Y + 1.25, inner[(j + 1) % 4][1]],
              0.65,
              0.8,
              'stone',
              C.stone,
            );
        }
      }
    }
  }
}
function colonnades(o, c) {
  for (const p of a.porticos) {
    const n = c.far ? 4 : p.columns,
      w = p.name.includes('inner') ? 2.1 : 2.35,
      col = (u) => oriented(p, u, 0);
    prism(
      o,
      c,
      porticoRing(p, -p.width / 2 - 1.2, p.width / 2 + 1.2, 1, -p.depth),
      a.foundationY,
      p.floorY,
      'stone',
      C.stone,
    );
    for (let j = 0; j < n; j++) {
      const u = (j / (n - 1) - 0.5) * (p.width - w),
        P = col(u),
        D = 0.8;
      prism(
        o,
        c,
        porticoRing(p, u - w / 2, u + w / 2, D, -D),
        p.floorY,
        p.entablatureY,
        'stone',
        C.stone,
      );
      if (c.detail) {
        for (const [y, h, scale] of [
          [p.floorY, 0.6, 1.2],
          [p.entablatureY - 0.7, 0.7, 1.15],
        ])
          prism(
            o,
            c,
            porticoRing(p, u - (w * scale) / 2, u + (w * scale) / 2, D * scale, -D * scale),
            y,
            y + h,
            'stone',
            C.lower,
          );
        if (c.fine)
          for (const q of [-0.32, 0.32]) {
            const [X, Z] = oriented(p, u + q, D + 0.02);
            span(
              o,
              c,
              [X, p.floorY + 1.2, Z],
              [X, p.entablatureY - 1.4, Z],
              0.12,
              0.08,
              'stone',
              C.stone,
            );
          }
      }
    }
    prism(
      o,
      c,
      porticoRing(p, -p.width / 2 - 1.4, p.width / 2 + 1.4, 1.2, -p.depth),
      p.entablatureY,
      p.topY,
      'stone',
      C.stone,
    );
    if (!c.far) {
      for (const [y, front] of [
        [p.entablatureY, 0.9],
        [p.topY - 0.25, 1.65],
      ]) {
        const A = oriented(p, -p.width / 2 - 1.6, front),
          B = oriented(p, p.width / 2 + 1.6, front);
        span(o, c, [A[0], y, A[1]], [B[0], y, B[1]], 0.5, 0.6, 'stone', C.lower);
      }
      if (c.detail)
        for (let j = 0; j < p.columns - 1; j++) {
          const u = ((j + 0.5) / (p.columns - 1) - 0.5) * (p.width - w),
            A = oriented(p, u, 0.65),
            B = oriented(p, u, -p.depth + 0.15);
          span(
            o,
            c,
            [A[0], p.entablatureY - 0.12, A[1]],
            [B[0], p.entablatureY - 0.12, B[1]],
            0.4,
            0.35,
            'stone',
            C.lower,
          );
        }
    }
  }
}
function theater(o, c) {
  const p = a.theater,
    ring = cw(p.ring),
    front = ring.map((A, i) => [A, ring[(i + 1) % ring.length]]);
  for (const [A, B] of front) {
    const v = face(A, B);
    if (v.L < 0.01) continue;
    const n = c.far ? 0 : Math.max(1, Math.floor(v.L / (c.flat ? 12 : 5))),
      s = v.L / Math.max(1, n),
      holes = [];
    for (let j = 0; j < n; j++)
      holes.push({
        u: (j + 0.5) * s,
        width: Math.min(2.6, s * 0.6),
        lo: -8,
        hi: -0.7,
        shape: 'rect',
        depth: 0.45,
      });
    faceBand(o, c, v.F, v.L, p.baseY, p.deckY, holes, C.wall);
    if (!c.far)
      span(
        o,
        c,
        v.F(0, p.deckY + 0.15, 0.1),
        v.F(v.L, p.deckY + 0.15, 0.1),
        0.4,
        0.6,
        'stone',
        C.stone,
      );
  }
  cap(o, c, [ring], p.deckY, 'stone', C.stone);
  if (c.detail)
    for (let x = -32; x <= 32; x += c.fine ? 4 : 8)
      span(o, c, [x, p.deckY + 0.04, 12], [x, p.deckY + 0.04, 45], 0.13, 0.05, 'base', C.base);
}
function entries(o, c) {
  for (const e of a.entries) {
    const F = (u, y, d = 0) => [
        e.center[0] + e.U[0] * u + e.N[0] * d,
        y,
        e.center[1] + e.U[1] * u + e.N[1] * d,
      ],
      profile = e.outerProfile.filter((_, i) => i % (c.fine ? 1 : c.far || c.flat ? 4 : 2) === 0),
      n = profile.length - 1,
      D = e.approachDistance;
    for (let j = 0; j < n; j++) {
      const u = e.width * (j / n - 0.5),
        U = e.width * ((j + 1) / n - 0.5),
        h = profile[j],
        H = profile[j + 1];
      Q(
        o,
        c,
        [F(u, e.thresholdY), F(U, e.thresholdY), F(U, H, D), F(u, h, D)],
        'base',
        C.base,
        [0, 1, 0],
      );
      Q(o, c, [F(u, h - 0.2, D), F(U, H - 0.2, D), F(U, H, D), F(u, h, D)], 'base', C.base);
      if (!j || j === n - 1) {
        const q = j ? U : u,
          Y = j ? H : h;
        Q(
          o,
          c,
          [F(q, a.foundationY), F(q, a.foundationY, D), F(q, Y, D), F(q, e.thresholdY)],
          'base',
          C.base,
        );
      }
    }
  }
}
export function buildChaillotLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Chaillot tier ' + level);
  const o = safe(output);
  bodies(o, c);
  colonnades(o, c);
  theater(o, c);
  entries(o, c);
}
export const buildChaillotSkyline = (o) => buildChaillotLevel(o, 'skyline'),
  buildChaillotDistrict = (o) => buildChaillotLevel(o, 'district'),
  buildChaillotStreet = (o) => buildChaillotLevel(o, 'street'),
  buildChaillotCloseup = (o) => buildChaillotLevel(o, 'closeup');

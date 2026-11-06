/** Original complete Mariinskyi Palace exterior; native U plan and service court. */
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
  'c3bffa6c25680e6c77b68104f6ca1bd4f61338f0867243778b7c1f5c22ffc574'
)
  throw Error('Mariinskyi Palace controls changed: update explicit geometry input pin');
export const mariinskyiControls = JSON.parse(controlsBytes);
const a = mariinskyiControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('aed2c8'),
    lower: lin('e5d6b3'),
    stone: lin('ece7d8'),
    base: lin('b5b2a3'),
    roof: lin('6f8299'),
    glass: lin('516b74'),
    wood: lin('78634d'),
  };
export const mariinskyiSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.7, metallic: 0.2 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 6, arch: 2, step: 24 },
  district: { flat: true, n: 6, arch: 3, step: 5.2 },
  street: { n: 8, arch: 4, step: 4.5 },
  closeup: { detail: true, n: 12, arch: 8, step: 3.8 },
  master: { detail: true, fine: true, n: 28, arch: 20, step: 3.2 },
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
      h.door ? 'wood' : 'glass',
      h.door ? C.wood : C.glass,
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
    if (!h.door) {
      ribbon(o, c, F, h.u, h.hi + 0.2, h.width + 0.8, 0.32);
      ribbon(o, c, F, h.u, h.lo - 0.28, h.width + 0.6, -0.22);
    }
  }
}
function faceBand(o, c, F, L, lo, hi, holes, col) {
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
function visibleFaces(b, c) {
  const faces = [];
  for (const rs of b.polygons)
    for (const [ri, raw] of rs.entries()) {
      const r = ri
        ? cw(raw, c.far ? 0.5 : c.flat ? 0.12 : 0.004).reverse()
        : cw(raw, c.far ? 0.5 : c.flat ? 0.12 : 0.004);
      for (let i = 0; i < r.length; i++) {
        const A = r[i],
          B = r[(i + 1) % r.length],
          v = face(A, B);
        if (v.L < 0.001) continue;
        const p = [(A[0] + B[0]) / 2 + v.N[0] * 0.025, (A[1] + B[1]) / 2 + v.N[1] * 0.025],
          other = Math.max(
            0,
            ...a.bodies.filter((q) => q !== b && inPs(q.polygons, p)).map((q) => q.eave),
          );
        if (other >= b.eave - 0.001) continue;
        faces.push({ ...v, A, B, lo: a.floorY + other, hi: a.floorY + b.eave });
      }
    }
  return faces;
}
function facades(o, c) {
  for (const b of a.bodies)
    for (const v of visibleFaces(b, c)) {
      const { F, L, lo, hi, N } = v,
        isLow = b.name === 'attached-low-ranges',
        split = a.floorY + (isLow ? 0.65 : 3.5),
        entry = a.entries.find(
          (e) =>
            e.owner === b.name &&
            Math.hypot((v.A[0] + v.B[0]) / 2 - e.center[0], (v.A[1] + v.B[1]) / 2 - e.center[1]) <
              0.1,
        ),
        bands =
          split > lo + 0.01 && split < hi - 0.01
            ? [
                [lo, split, C.lower],
                [split, hi, C.wall],
              ]
            : [[lo, hi, lo < split ? C.lower : C.wall]];
      if (c.far) {
        for (const [y, Y, col] of bands) panel(o, c, F, 0, L, y, Y, 0, 'wall', col);
        if (L > 8) panel(o, c, F, 0, L, hi - 0.3, hi, 0.03, 'stone', C.stone);
        continue;
      }
      const count = entry
          ? 1
          : L >= (c.detail ? 1.1 : 3.6)
            ? Math.max(1, Math.floor(L / c.step))
            : 0,
        step = L / Math.max(1, count);
      for (const [y, Y, col] of bands) {
        const holes = [];
        for (let j = 0; j < count; j++) {
          const u = entry ? L / 2 : (j + 0.5) * step,
            w = Math.min(entry ? 2.9 : isLow ? 1.7 : 1.65, step * 0.56),
            add = (width, l, h, shape = 'arch', door = false) => {
              if (l >= y + 0.1 && h <= Y - 0.15)
                holes.push({ u, width, lo: l, hi: h, shape, door });
            };
          if (entry) {
            if (y < split) add(entry.width, entry.thresholdY, entry.thresholdY + 2.5, 'rect', true);
            else {
              add(w, a.floorY + 4.0, a.floorY + 9.7);
              if (b.eave > 11.5) add(1.55, a.floorY + 10.35, a.floorY + 11.7, 'circle');
            }
          } else if (isLow) add(w, a.floorY + 1.15, a.floorY + 4.55);
          else if (y < split) add(Math.min(1.25, w), a.floorY + 0.75, a.floorY + 2.25, 'rect');
          else add(w, a.floorY + 4.2, a.floorY + 9.2);
        }
        faceBand(o, c, F, L, y, Y, holes, col);
      }
      for (const [y, h] of [
        [a.floorY + 0.08, 0.15],
        [split - 0.12, 0.24],
        [hi - 0.25, 0.25],
      ])
        if (y >= lo - 0.01 && y <= hi + 0.01) {
          if (c.detail) span(o, c, F(0, y, 0.1), F(L, y, 0.1), h, 0.24);
          else panel(o, c, F, 0, L, y, y + h, 0.06, 'stone', C.stone);
        }
      if (c.detail) {
        const n = Math.max(1, Math.floor(L / (c.fine ? 1.1 : 2.1)));
        span(o, c, F(0, hi + 0.13, 0.03), F(L, hi + 0.13, 0.03), 0.14, 0.17);
        span(o, c, F(0, hi + 0.72, 0.03), F(L, hi + 0.72, 0.03), 0.17, 0.2);
        for (let j = 0; j <= n; j++) {
          const u = (L * j) / n;
          span(o, c, F(u, hi + 0.14, 0.03), F(u, hi + 0.68, 0.03), 0.12, 0.12);
        }
        if (entry) {
          for (const t of [-0.39, -0.27, 0.27, 0.39]) {
            const u = L * (0.5 + t),
              p = F(u, 0, 0.23),
              radius = c.fine ? 0.22 : 0.19;
            loft(
              o,
              'stone',
              [
                radialRing(a.floorY + 3.55, radius, radius, c.n, [p[0], p[2]]),
                radialRing(hi - 0.65, radius, radius, c.n, [p[0], p[2]]),
              ],
              C.stone,
            );
            for (const y of [a.floorY + 3.4, hi - 0.6])
              span(o, c, F(u - 0.35, y, 0.23), F(u + 0.35, y, 0.23), 0.22, 0.42);
          }
        }
        if (c.fine && !isLow && L > 5) {
          for (let j = 1; j < 6; j++)
            panel(
              o,
              c,
              F,
              0,
              L,
              a.floorY + j * 0.55,
              a.floorY + j * 0.55 + 0.035,
              0.035,
              'stone',
              C.lower,
            );
        }
      }
    }
}
function roofDistance(r, p) {
  let best = Infinity;
  for (const rs of r.polygons)
    for (const ring of rs)
      for (let i = 0; i < ring.length; i++) {
        const A = ring[i],
          B = ring[(i + 1) % ring.length],
          dx = B[0] - A[0],
          dz = B[1] - A[1],
          t = Math.max(
            0,
            Math.min(1, ((p[0] - A[0]) * dx + (p[1] - A[1]) * dz) / (dx * dx + dz * dz)),
          );
        best = Math.min(best, Math.hypot(p[0] - A[0] - dx * t, p[1] - A[1] - dz * t));
      }
  return best;
}
function roofs(o, c) {
  for (const r of a.roofs) {
    const y = (p) =>
      a.floorY + r.eave + r.rise * Math.max(0, Math.min(1, roofDistance(r, p) / r.hipWidth));
    for (const cell of r.cells) for (const rs of cell.polygons) cap(o, c, rs, y, 'roof', C.roof);
    if (!c.far) {
      const [x, z, X, Z] = r.bounds,
        long = X - x > Z - z,
        n = c.flat ? 1 : Math.max(1, Math.floor((long ? X - x : Z - z) / (c.fine ? 6 : 12)));
      for (let i = 0; i < n; i++) {
        const p = long
          ? [x + ((X - x) * (i + 0.5)) / n, (z + Z) / 2]
          : [(x + X) / 2, z + ((Z - z) * (i + 0.5)) / n];
        if (!inPs(r.polygons, p)) continue;
        const h = y(p);
        box(
          o,
          c,
          p[0] - 0.38,
          p[1] - 0.34,
          p[0] + 0.38,
          p[1] + 0.34,
          h - 0.3,
          h + 1,
          'wall',
          C.lower,
        );
        box(
          o,
          c,
          p[0] - 0.5,
          p[1] - 0.45,
          p[0] + 0.5,
          p[1] + 0.45,
          h + 0.85,
          h + 1.1,
          'stone',
          C.stone,
        );
      }
    }
  }
}
function crown(o, c, e) {
  const b = a.bodies.find((b) => b.name === e.owner),
    { L, F } = face(e.A, e.B),
    middle = L / 2,
    W = L * 0.7,
    lo = a.floorY + b.eave + 0.45,
    h = e.owner === 'central-risalit' ? 2.2 : 1.45,
    n = c.far ? 3 : c.flat ? 4 : c.arch * 2;
  const N = sub(F(0, 0, 1), F(0, 0, 0)),
    back = (p) => p.map((v, i) => v - N[i] * 0.42),
    plinth = [
      F(middle - W / 2, 0, 0.02),
      F(middle + W / 2, 0, 0.02),
      F(middle + W / 2, 0, -0.44),
      F(middle - W / 2, 0, -0.44),
    ].map((p) => [p[0], p[2]]);
  prism(o, c, [plinth], a.floorY + b.eave - 0.03, lo, 'stone', C.stone);
  for (let i = 0; i < n; i++) {
    const point = (j, d = 0) => {
        const u = W * (j / n - 0.5),
          t = j / n,
          Y = lo + h * Math.sin(t * Math.PI) * (1 + 0.12 * Math.cos(t * Math.PI * 4));
        return F(middle + u, Y, d);
      },
      A = point(i),
      B = point(i + 1);
    Q(
      o,
      c,
      [F(middle + W * (i / n - 0.5), lo), F(middle + W * ((i + 1) / n - 0.5), lo), B, A],
      'wall',
      C.wall,
    );
    Q(
      o,
      c,
      [
        back(A),
        back(B),
        back(F(middle + W * ((i + 1) / n - 0.5), lo)),
        back(F(middle + W * (i / n - 0.5), lo)),
      ],
      'wall',
      C.wall,
      N.map((v) => -v),
    );
    Q(o, c, [A, B, back(B), back(A)], 'wall', C.wall, [0, 1, 0]);
    if (!c.far) {
      span(
        o,
        c,
        A.map((v, j) => v + (j === 1 ? 0.08 : 0)),
        B.map((v, j) => v + (j === 1 ? 0.08 : 0)),
        0.2,
        0.25,
      );
    }
  }
  if (c.far) return;
  const y = lo + 0.6;
  panel(o, c, F, middle - 0.5, middle + 0.5, y - 0.27, y + 0.27, 0.15, 'stone', C.lower);
  if (c.detail) {
    ribbon(o, c, F, middle, lo + 0.3, W * 0.65, 0.8);
    for (const t of [-0.44, 0.44]) {
      const p = F(middle + W * t, lo + 0.2, 0.08);
      urn(o, c, p, 0.24);
    }
    const p = F(middle, lo + h + 0.3, 0.05);
    urn(o, c, p, 0.28);
  }
}
function urn(o, c, p, r) {
  const n = c.n,
    levels = [
      [0, 0.7],
      [0.12, 1],
      [0.35, 0.8],
      [0.55, 0.5],
      [0.65, 0.75],
    ].map(([y, k]) => radialRing(p[1] + y, r * k, r * k, n, [p[0], p[2]]));
  loft(o, 'stone', levels, C.stone);
}
function entries(o, c) {
  for (const e of a.entries) {
    const { F } = face(e.A, e.B),
      L = Math.hypot(...sub(e.B, e.A)),
      f = (u, y, d = 0) => F(u + L / 2, y, d),
      w = e.approachWidth / 2,
      D = e.approachDistance,
      split = D * 0.32,
      n = c.far ? 1 : c.flat ? 2 : c.detail ? 5 : 3;
    for (let j = 0; j < n; j++) {
      const d0 = (split * j) / n,
        d1 = (split * (j + 1)) / n,
        hi = e.thresholdY - ((e.thresholdY - a.floorY) * j) / n,
        p = [f(-w, 0, d0), f(w, 0, d0), f(w, 0, d1), f(-w, 0, d1)].map((p) => [p[0], p[2]]);
      prism(o, c, [p], a.foundationY, hi, 'base', C.base);
    }
    Q(
      o,
      c,
      [f(-w, a.floorY, split), f(w, a.floorY, split), f(w, e.outerY[1], D), f(-w, e.outerY[0], D)],
      'base',
      C.base,
      [0, 1, 0],
    );
    for (const sign of [-1, 1])
      Q(
        o,
        c,
        [
          f(sign * w, a.foundationY, split),
          f(sign * w, a.foundationY, D),
          f(sign * w, e.outerY[sign > 0 ? 1 : 0], D),
          f(sign * w, a.floorY, split),
        ],
        'base',
        C.base,
      );
  }
}
export function buildMariinskyiLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Mariinskyi tier ' + level);
  const o = safe(output);
  for (const rs of a.nativePolygons)
    prism(o, c, rs, a.foundationY, a.floorY, 'base', C.base, !c.far);
  for (const r of a.serviceCourts) prism(o, c, [r], a.floorY - 0.1, a.floorY, 'base', C.base);
  facades(o, c);
  roofs(o, c);
  for (const e of a.entries) crown(o, c, e);
  entries(o, c);
}
export const buildMariinskyiSkyline = (o) => buildMariinskyiLevel(o, 'skyline'),
  buildMariinskyiDistrict = (o) => buildMariinskyiLevel(o, 'district'),
  buildMariinskyiStreet = (o) => buildMariinskyiLevel(o, 'street'),
  buildMariinskyiCloseup = (o) => buildMariinskyiLevel(o, 'closeup');

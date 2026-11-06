/** Original individual Palazzo Chigi exterior and open court arcades. */
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
  '660d71bb47f0cf1d3cd144324c65ce1b7c288982a5ce2ea9985259a8db725746'
)
  throw Error('Palazzo Chigi controls changed: update explicit geometry input pin');
export const chigiControls = JSON.parse(controlsBytes);
const a = chigiControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('d8d0b7'),
    stone: lin('e8e0cb'),
    base: lin('9e9b8e'),
    roof: lin('a9836c'),
    lead: lin('969a94'),
    glass: lin('4c686f'),
    wood: lin('c9c7b8'),
    door: lin('5c5145'),
    metal: lin('5b6561'),
  };
export const chigiSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  clay: { slot: 'roof', graph: 'clay_fired', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.65, metallic: 0.2 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.42, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 4, arch: 2, step: 32 },
  district: { flat: true, n: 6, arch: 3, step: 10 },
  street: { n: 8, arch: 3, step: 5.3 },
  closeup: { detail: true, n: 12, arch: 7, step: 4.7 },
  master: { detail: true, fine: true, n: 24, arch: 16, step: 4.7 },
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
  const rings = rs.map((r) =>
      clean(r, c.precise ? (c.far ? 0.15 : 0.008) : c.far ? 0.02 : c.flat ? 0.15 : 0.008),
    ),
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
      ? cw(raw, c.far ? 0.02 : c.flat ? 0.15 : 0.008).reverse()
      : cw(raw, c.far ? 0.02 : c.flat ? 0.15 : 0.008);
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
  if (h.shape === 'pointed') {
    const spring = hi - r * 0.8,
      arc = [];
    for (let i = 0; i <= c.arch; i++) {
      const t = i / c.arch,
        q = 1 - t;
      arc.push([
        u + r * q * q + 2 * q * t * r * 0.9,
        spring * q * q + 2 * q * t * (hi - r * 0.3) + hi * t * t,
      ]);
    }
    return [
      [u - r, lo],
      [u + r, lo],
      ...arc,
      ...arc
        .slice(0, -1)
        .reverse()
        .map(([x, y]) => [2 * u - x, y]),
    ];
  }
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
function opening(o, c, F, h) {
  if (h.through) return;
  const ps = profile(c.flat && !h.door ? { ...h, shape: 'rect' } : h, c),
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
      spring = h.hi - (h.shape === 'arch' ? r : h.shape === 'pointed' ? r * 0.8 : 0);
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
  }
}
function faceBand(o, c, F, L, lo, hi, holes, col, surface = 'wall') {
  if (c.flat && holes.some((h) => h.through))
    return faceBand(o, { ...c, flat: false }, F, L, lo, hi, holes, col, surface);
  holes = holes.filter(
    (h) =>
      h.lo >= lo - 1e-7 &&
      h.hi <= hi + 1e-7 &&
      h.u - h.width / 2 > (h.through ? 0.001 : 0.1) &&
      h.u + h.width / 2 < L - (h.through ? 0.001 : 0.1),
  );
  if (c.flat) {
    panel(o, c, F, 0, L, lo, hi, 0, surface, col);
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
      surface,
      col,
      sub(F(0, 0, 1), F(0, 0, 0)),
    );
  for (const h of holes) opening(o, c, F, h);
}
// Split at every mass boundary before deciding whether an exterior wall is visible.
// A higher coincident exterior owns its complete wall; an adjacent solid hides only its height.
function visibleFaces(b, c) {
  const faces = [],
    tol = c.far ? 0.02 : c.flat ? 0.06 : 0.006;
  for (const rs of b.polygons)
    for (const [ri, raw] of rs.entries()) {
      const r = ri ? cw(raw, tol).reverse() : cw(raw, tol);
      for (let i = 0; i < r.length; i++) {
        const A = r[i],
          B = r[(i + 1) % r.length],
          v = face(A, B),
          ts = [0, 1];
        if (v.L < 0.005) continue;
        for (const q of a.bodies)
          if (q !== b)
            for (const rr of q.polygons)
              for (const ring of rr)
                for (let j = 0; j < ring.length; j++) {
                  const p = ring[j],
                    P = ring[(j + 1) % ring.length],
                    dx = P[0] - p[0],
                    dz = P[1] - p[1],
                    den = v.U[0] * dz - v.U[1] * dx;
                  if (Math.abs(den) > 1e-8) {
                    const t = ((p[0] - A[0]) * dz - (p[1] - A[1]) * dx) / den / v.L,
                      s = ((p[0] - A[0]) * v.U[1] - (p[1] - A[1]) * v.U[0]) / den;
                    if (t > 1e-5 && t < 1 - 1e-5 && s >= -1e-6 && s <= 1 + 1e-6) ts.push(t);
                  } else if (Math.abs((p[0] - A[0]) * v.N[0] + (p[1] - A[1]) * v.N[1]) < 0.015) {
                    const t = ((p[0] - A[0]) * v.U[0] + (p[1] - A[1]) * v.U[1]) / v.L;
                    if (t > 1e-5 && t < 1 - 1e-5) ts.push(t);
                  }
                }
        ts.sort((x, y) => x - y);
        for (let k = 0; k < ts.length - 1; k++) {
          if ((ts[k + 1] - ts[k]) * v.L < 0.025) continue;
          const p = ts
              .slice(k, k + 2)
              .map((t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]),
            f = face(...p),
            mid = [(p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2],
            out = mid.map((v, i) => v + f.N[i] * 0.022),
            inn = mid.map((v, i) => v - f.N[i] * 0.022);
          let low = b.bottom,
            skip = false;
          for (const q of a.bodies)
            if (q !== b && q.bottom < b.eave - 0.001) {
              const greater =
                q.eave > b.eave + 0.001 ||
                (Math.abs(q.eave - b.eave) < 0.001 && a.bodies.indexOf(q) < a.bodies.indexOf(b));
              if (inPs(q.polygons, out)) low = Math.max(low, q.eave);
              else if (greater && q.bottom <= b.bottom && inPs(q.polygons, inn)) skip = true;
            }
          if (!skip && low < b.eave - 0.01)
            faces.push({
              ...f,
              A: p[0],
              B: p[1],
              lo: a.floorY + low,
              hi: a.floorY + b.eave,
              free: low === b.bottom,
            });
        }
      }
    }
  return faces;
}
function entries(o, c) {
  for (const e of a.entries) {
    const F = (u, y, d) => [
        e.center[0] + e.U[0] * u + e.N[0] * d,
        y,
        e.center[1] + e.U[1] * u + e.N[1] * d,
      ],
      p = e.outerProfile.filter((_, i) => i % (c.fine ? 1 : c.far ? 8 : c.flat ? 4 : 2) === 0),
      n = p.length - 1,
      w = e.width / 2,
      D = e.approachDistance,
      steps =
        c.far || c.flat
          ? 1
          : Math.max(
              3,
              Math.ceil(Math.max(...e.outerProfile.map((y) => Math.abs(y - e.thresholdY))) / 0.27),
            );
    for (let j = 0; j < n; j++) {
      const u = -w + (2 * w * j) / n,
        U = -w + (2 * w * (j + 1)) / n;
      for (let k = 0; k < steps; k++) {
        const d = (k / steps) * D,
          dd = ((k + 1) / steps) * D,
          y = e.thresholdY + ((p[j] - e.thresholdY) * k) / steps,
          Y = e.thresholdY + ((p[j + 1] - e.thresholdY) * k) / steps,
          ny = e.thresholdY + ((p[j] - e.thresholdY) * (k + 1)) / steps,
          nY = e.thresholdY + ((p[j + 1] - e.thresholdY) * (k + 1)) / steps;
        Q(
          o,
          c,
          [
            F(u, y, d),
            F(U, Y, d),
            F(U, steps === 1 || k === steps - 1 ? p[j + 1] : Y, dd),
            F(u, steps === 1 || k === steps - 1 ? p[j] : y, dd),
          ],
          'base',
          C.base,
          [0, 1, 0],
        );
        if (steps > 1 && k < steps - 1)
          Q(o, c, [F(u, y, dd), F(U, Y, dd), F(U, nY, dd), F(u, ny, dd)], 'base', C.base, [
            e.N[0],
            0,
            e.N[1],
          ]);
        if (j === 0 || j === n - 1) {
          const v = j === 0 ? u : U,
            h = j === 0 ? y : Y,
            H = j === 0 ? ny : nY;
          Q(
            o,
            c,
            [
              F(v, a.foundationY, d),
              F(v, a.foundationY, dd),
              F(v, steps === 1 || k === steps - 1 ? H : h, dd),
              F(v, h, d),
            ],
            'base',
            C.base,
            [e.U[0] * (j === 0 ? -1 : 1), 0, e.U[1] * (j === 0 ? -1 : 1)],
          );
        }
      }
      Q(
        o,
        c,
        [F(u, a.foundationY, D), F(U, a.foundationY, D), F(U, p[j + 1], D), F(u, p[j], D)],
        'base',
        C.base,
        [e.N[0], 0, e.N[1]],
      );
    }
  }
}

const roofY = (r, p) =>
  a.floorY +
  r.eave +
  r.rise *
    Math.max(
      0,
      Math.min(1, ...r.planes.map(([A, B, C]) => (A * p[0] + B * p[1] + C) / r.hipWidth)),
    );
function roofs(o, c) {
  for (const r of a.roofs) {
    const col = r.kind === 'red' ? C.red : r.shape === 'flat' ? C.lead : C.roof;
    for (const cell of r.cells)
      for (const rs of cell.polygons)
        cap(o, { ...c, precise: true }, rs, (p) => roofY(r, p), 'clay', col);
    for (const rs of r.polygons)
      for (const [ri, raw] of rs.entries()) {
        const ring = ri ? cw(raw, c.far ? 0.02 : 0.008).reverse() : cw(raw, c.far ? 0.02 : 0.008);
        for (let i = 0; i < ring.length; i++) {
          const A = ring[i],
            B = ring[(i + 1) % ring.length],
            v = face(A, B),
            y = a.floorY + r.eave,
            cuts = [0, 1];
          for (let j = 0; j < r.planes.length; j++)
            for (let k = j + 1; k < r.planes.length; k++) {
              const P = r.planes[j],
                Q = r.planes[k],
                at = (p) => (P[0] - Q[0]) * p[0] + (P[1] - Q[1]) * p[1] + P[2] - Q[2],
                d = at(A),
                D = at(B);
              if (Math.abs(d - D) > 1e-9) {
                const t = d / (d - D);
                if (t > 1e-6 && t < 1 - 1e-6) {
                  const p = A.map((v, i) => v + (B[i] - v) * t),
                    vals = r.planes.map(([a, b, c]) => a * p[0] + b * p[1] + c),
                    z = Math.min(...vals);
                  if (Math.abs(vals[j] - z) < 1e-5 && Math.abs(vals[k] - z) < 1e-5) cuts.push(t);
                }
              }
            }
          cuts.sort((a, b) => a - b);
          for (let j = 0; j < cuts.length - 1; j++) {
            const [p, q] = cuts.slice(j, j + 2).map((t) => A.map((x, i) => x + (B[i] - x) * t)),
              h = roofY(r, p),
              H = roofY(r, q);
            if (Math.max(h, H) > y + 0.01)
              Q(
                o,
                c,
                [
                  [p[0], y, p[1]],
                  [q[0], y, q[1]],
                  [q[0], H, q[1]],
                  [p[0], h, p[1]],
                ],
                'wall',
                r.kind === 'red' ? C.red : C.wall,
                [v.N[0], 0, v.N[1]],
              );
          }
          if (c.fine && v.L > 3)
            span(
              o,
              c,
              [A[0], roofY(r, A) + 0.015, A[1]],
              [B[0], roofY(r, B) + 0.015, B[1]],
              0.035,
              0.045,
              'clay',
              col,
            );
        }
      }
    if (c.detail && r.rise > 1) {
      const [x, z, X, Z] = r.bounds,
        u = [Math.cos(r.angle), Math.sin(r.angle)],
        n = [-u[1], u[0]],
        D = c.fine ? 2.2 : 4.4;
      for (let v = x + D; v < X; v += D) {
        const line = [],
          emitLine = (ps) => {
            const t = [];
            for (const p of ps) {
              while (t.length > 1) {
                const a = sub(t.at(-1), t.at(-2)),
                  b = sub(p, t.at(-1)),
                  L = Math.hypot(...a),
                  N = Math.hypot(
                    a[1] * b[2] - a[2] * b[1],
                    a[2] * b[0] - a[0] * b[2],
                    a[0] * b[1] - a[1] * b[0],
                  );
                if (N / Math.max(0.000001, L) > 0.00001) break;
                t.pop();
              }
              t.push(p);
            }
            for (let j = 1; j < t.length; j++)
              span(o, c, t[j - 1], t[j], 0.025, 0.035, 'clay', col);
          };
        for (let w = z + 0.2; w <= Z - 0.2; w += 0.8) {
          const p = [u[0] * v + n[0] * w, u[1] * v + n[1] * w];
          if (inPs(r.polygons, p)) line.push([p[0], roofY(r, p) + 0.025, p[1]]);
          else if (line.length) {
            emitLine(line);
            line.length = 0;
          }
        }
        emitLine(line);
      }
    }
  }
}

function foundation(o, c) {
  for (const rs of a.foundationPolygons) prism(o, c, rs, a.foundationY, a.floorY, 'base', C.base);
}
function featureAt(v, d) {
  if (v.N[0] * d.N[0] + v.N[1] * d.N[1] < 0.98) return null;
  const p = d.center.map((x, i) => x - v.A[i]),
    u = p[0] * v.U[0] + p[1] * v.U[1],
    off = Math.abs(p[0] * v.N[0] + p[1] * v.N[1]);
  return off < 0.08 && u > 1.8 && u < v.L - 1.8 ? u : null;
}
function pediment(o, c, F, h, curved) {
  const lo = h.hi + 0.3,
    w = h.width * 0.7;
  if (curved) {
    const pts = Array.from({ length: c.fine ? 17 : 9 }, (_, i) => {
      const t = (i / (c.fine ? 16 : 8)) * Math.PI;
      return F(h.u + Math.cos(t) * w, lo + Math.sin(t) * 0.75, 0.15);
    });
    T(o, c, [F(h.u - w, lo, 0.15), F(h.u + w, lo, 0.15), F(h.u, lo + 0.7, 0.15)], 'stone', C.stone);
    for (let i = 1; i < pts.length; i++) span(o, c, pts[i - 1], pts[i], 0.14, 0.2);
  } else {
    T(o, c, [F(h.u - w, lo, 0.15), F(h.u + w, lo, 0.15), F(h.u, lo + 0.9, 0.15)], 'stone', C.stone);
    span(o, c, F(h.u - w, lo, 0.2), F(h.u, lo + 0.9, 0.2), 0.15, 0.2);
    span(o, c, F(h.u, lo + 0.9, 0.2), F(h.u + w, lo, 0.2), 0.15, 0.2);
  }
}
function facades(o, c) {
  for (const b of a.bodies) {
    for (const v of visibleFaces(b, c)) {
      const { F, L, lo, hi } = v;
      if (c.far) {
        panel(o, c, F, 0, L, lo, hi, 0, 'wall', C.wall);
        continue;
      }
      const n =
          L > 2
            ? b.kind === 'loggia'
              ? L < 13
                ? 1
                : 3
              : Math.max(1, Math.round(L / c.step))
            : 0,
        step = L / Math.max(1, n),
        holes = [],
        mainDoor = b.kind === 'lower' ? featureAt(v, a.door) : null,
        stair = b.kind === 'main' ? featureAt(v, a.stairWindow) : null;
      if (mainDoor !== null)
        holes.push({
          u: mainDoor,
          width: a.door.width,
          lo: a.floorY,
          hi: a.door.hi,
          shape: 'arch',
          depth: 0.4,
          door: true,
        });
      if (stair !== null)
        holes.push({
          u: stair,
          width: a.stairWindow.width,
          lo: a.stairWindow.lo,
          hi: a.stairWindow.hi,
          shape: 'arch',
          depth: 0.3,
        });
      const rows =
        b.kind === 'lower'
          ? [[0.65, 4.15, 'rect']]
          : b.kind === 'loggia'
            ? [
                [6.3, 9.4, 'rect'],
                [11, 13.4, 'rect'],
                [16.7, 22.2, 'arch'],
              ]
            : [
                [5.7, 8.9, 'rect'],
                [10.05, 11.35, 'rect'],
                [12.4, 14.05, 'rect'],
                [15.0, 16.3, 'rect'],
              ];
      for (let j = 0; j < n; j++) {
        const u = (j + 0.5) * step,
          w = Math.min(b.kind === 'loggia' ? 3.3 : c.flat ? 2.2 : 1.7, step * 0.48);
        if (mainDoor !== null && Math.abs(u - mainDoor) < 3) continue;
        for (const [y, Y, shape] of rows)
          if (
            a.floorY + y > lo + 0.1 &&
            a.floorY + Y < hi - 0.15 &&
            !(
              stair !== null &&
              y < 12.2 &&
              Math.abs(u - stair) < (w + a.stairWindow.width) * 0.5 + 0.2
            )
          )
            holes.push({
              u,
              width: w,
              lo: a.floorY + y,
              hi: a.floorY + Y,
              shape: c.flat ? 'rect' : shape,
              depth: 0.27,
            });
      }
      faceBand(o, c, F, L, lo, hi, holes, C.wall);
      if (c.flat) continue;
      for (const y of [5.15, 9.5, 11.8, 14.6, b.eave - 0.27])
        if (a.floorY + y > lo && a.floorY + y < hi) {
          const pieces =
            stair !== null && y > 5.8 && y < 11.65
              ? [
                  [0, stair - 1.95],
                  [stair + 1.95, L],
                ]
              : [[0, L]];
          for (const [u, U] of pieces)
            if (U > u)
              panel(
                o,
                c,
                F,
                u,
                U,
                a.floorY + y,
                Math.min(hi, a.floorY + y + 0.18),
                0.12,
                'stone',
                C.stone,
              );
          if (c.detail && [5.15, 14.6, b.eave - 0.27].includes(y))
            span(o, c, F(0, a.floorY + y + 0.15, 0.2), F(L, a.floorY + y + 0.15, 0.2), 0.14, 0.3);
        }
      if (c.detail && b.kind === 'main') {
        const mid = F(L * 0.5, 0, 0.12);
        if (inside(a.actualCourt, [mid[0], mid[2]]))
          for (let j = 1; j < n; j++) {
            const u = j * step,
              w = 0.6,
              y = a.floorY + 13.25,
              h = 0.8,
              ps = [
                [-w + 0.15, -h],
                [-w, -h + 0.15],
                [-w, h - 0.15],
                [-w + 0.15, h],
                [w - 0.15, h],
                [w, h - 0.15],
                [w, -h + 0.15],
                [w - 0.15, -h],
              ].map(([x, Y]) => F(u + x, y + Y, 0.12));
            for (let k = 0; k < ps.length; k++)
              span(o, c, ps[k], ps[(k + 1) % ps.length], 0.1, 0.13);
          }
      }
      if (c.detail)
        for (const h of holes) {
          if (h.door) continue;
          if (Math.abs(h.lo - a.floorY - 5.7) < 0.1)
            pediment(o, c, F, h, Math.round(h.u / step) % 2 === 0);
          if (b.kind === 'lower') {
            for (let u = h.u - h.width * 0.45; u < h.u + h.width * 0.5; u += c.fine ? 0.18 : 0.35)
              span(o, c, F(u, h.lo, -0.18), F(u, h.hi, -0.18), 0.035, 0.04, 'metal', C.metal);
          }
        }
      if (c.detail)
        for (const u of [0.18, L - 0.18])
          if (L > 1) {
            if (b.kind === 'lower' || b.kind === 'main')
              for (let y = lo + 0.1; y < hi - 0.15; y += 0.5)
                panel(
                  o,
                  c,
                  F,
                  u - 0.16,
                  u + 0.16,
                  y,
                  Math.min(hi, y + 0.34),
                  0.15,
                  'stone',
                  C.stone,
                );
          }
    }
    for (const rs of b.polygons) {
      cap(o, c, rs, a.floorY + b.eave, 'wall', C.wall);
      if (b.bottom > 0) cap(o, c, rs, a.floorY + b.bottom, 'stone', C.stone, false);
    }
  }
}
function arcades(o, c) {
  const ring = cw(a.actualCourt, 0.005).reverse();
  for (let k = 0; k < ring.length; k++) {
    const v = face(ring[k], ring[(k + 1) % ring.length]),
      { F, L } = v,
      n = L > 26 ? 6 : 4,
      step = L / n,
      selected =
        c.far || c.flat ? (n === 6 ? [1, 4] : [1, 2]) : Array.from({ length: n }, (_, i) => i),
      holes = selected.map((i) => ({
        u: (i + 0.5) * step,
        width: Math.min(3.9, step * 0.72),
        lo: a.floorY,
        hi: a.floorY + 5,
        shape: c.far ? 'rect' : 'arch',
        through: true,
      }));
    faceBand(o, c, F, L, a.floorY, a.floorY + 5.5, holes, C.stone, 'stone');
    const B = (u, y, d = 0) => F(u, y, -0.42 - d);
    faceBand(o, c, B, L, a.floorY, a.floorY + 5.5, holes, C.stone, 'stone');
    for (const h of holes) {
      const ps = profile(h, c);
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i],
          q = ps[(i + 1) % ps.length];
        Q(o, c, [F(...p), F(...q), F(...q, -0.42), F(...p, -0.42)], 'stone', C.stone);
      }
    }
    // Square piers carry the deep arcade roof; the space behind each arch stays open.
    const ends = [0, ...holes.flatMap((h) => [h.u - h.width / 2, h.u + h.width / 2]), L];
    for (let i = 0; i < ends.length - 1; i += 2) {
      const u = ends[i],
        U = ends[i + 1];
      if (U - u < 0.02) continue;
      const p = [
        F(u, a.floorY, 0),
        F(U, a.floorY, 0),
        F(U, a.floorY, -2.65),
        F(u, a.floorY, -2.65),
      ].map((p) => [p[0], p[2]]);
      prism(o, c, [p], a.floorY, a.floorY + 3.05, 'stone', C.stone);
    }
    if (!c.far)
      for (const y of [5.25]) {
        span(o, c, F(0, a.floorY + y, 0.1), F(L, a.floorY + y, 0.1), 0.16, 0.24);
      }
  }
}
function balcony(o, c) {
  const d = a.door,
    F = (u, y, z = 0) => [
      d.center[0] + d.U[0] * u + d.N[0] * z,
      y,
      d.center[1] + d.U[1] * u + d.N[1] * z,
    ],
    p = [
      F(-2.1, a.floorY + 5.0, 0.05),
      F(2.1, a.floorY + 5.0, 0.05),
      F(2.1, a.floorY + 5, 1.25),
      F(-2.1, a.floorY + 5, 1.25),
    ].map((p) => [p[0], p[2]]);
  prism(o, c, [p], a.floorY + 4.85, a.floorY + 5.12, 'stone', C.stone);
  if (c.far) return;
  const n = c.detail ? 14 : 7;
  for (let i = 0; i <= n; i++)
    span(
      o,
      c,
      F(-2.05 + (4.1 * i) / n, a.floorY + 5.12, 1.2),
      F(-2.05 + (4.1 * i) / n, a.floorY + 6.17, 1.2),
      0.045,
      0.05,
      'metal',
      C.metal,
    );
  span(
    o,
    c,
    F(-2.1, a.floorY + 6.2, 1.2),
    F(2.1, a.floorY + 6.2, 1.2),
    0.065,
    0.075,
    'metal',
    C.metal,
  );
  for (const u of [-2.05, 2.05])
    span(
      o,
      c,
      F(u, a.floorY + 6.2, 0.1),
      F(u, a.floorY + 6.2, 1.2),
      0.065,
      0.075,
      'metal',
      C.metal,
    );
}
function chimneys(o, c) {
  if (c.far) return;
  for (const q of a.chimneys) {
    const [x, z] = q.center;
    box(
      o,
      c,
      x - 0.25,
      z - 0.3,
      x + 0.25,
      z + 0.3,
      a.floorY + q.base,
      a.floorY + q.top,
      'wall',
      C.wall,
    );
    box(
      o,
      c,
      x - 0.36,
      z - 0.42,
      x + 0.36,
      z + 0.42,
      a.floorY + q.top - 0.15,
      a.floorY + q.top + 0.05,
      'stone',
      C.stone,
    );
    if (c.detail)
      box(
        o,
        c,
        x - 0.18,
        z - 0.2,
        x + 0.18,
        z + 0.2,
        a.floorY + q.top + 0.05,
        a.floorY + q.top + 0.55,
        'wall',
        C.wall,
      );
  }
}
export function buildChigiLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Chigi tier ' + level);
  const o = safe(output);
  foundation(o, c);
  facades(o, c);
  roofs(o, c);
  arcades(o, c);
  balcony(o, c);
  chimneys(o, c);
  entries(o, c);
}
export const buildChigiSkyline = (o) => buildChigiLevel(o, 'skyline'),
  buildChigiDistrict = (o) => buildChigiLevel(o, 'district'),
  buildChigiStreet = (o) => buildChigiLevel(o, 'street'),
  buildChigiCloseup = (o) => buildChigiLevel(o, 'closeup');

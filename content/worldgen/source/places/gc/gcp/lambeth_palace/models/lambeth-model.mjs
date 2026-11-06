/** Original individual historic Lambeth Palace exterior. */
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
  'c690ca463b6f88e31b83415a87d302ae44d6de9b2fd274005c2e20b8738c68c3'
)
  throw Error('Lambeth Palace controls changed: update explicit geometry input pin');
export const lambethControls = JSON.parse(controlsBytes);
const a = lambethControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('e2cc9e'),
    brick: lin('b16d58'),
    stone: lin('dfd3b6'),
    base: lin('aca493'),
    roof: lin('657278'),
    lead: lin('999f9d'),
    glass: lin('536d78'),
    wood: lin('52615a'),
    gold: lin('b7a26b'),
  };
export const lambethSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.86, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.8, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.2 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.42, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 4, arch: 2, step: 24 },
  district: { flat: true, n: 6, arch: 3, step: 12 },
  street: { n: 8, arch: 2, step: 8 },
  closeup: { detail: true, n: 12, arch: 7, step: 4 },
  master: { detail: true, fine: true, n: 24, arch: 16, step: 2.7 },
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
  const rings = rs.map((r) => clean(r, c.far ? 1.6 : c.flat ? 0.15 : 0.008)),
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
      ? cw(raw, c.far ? 1.6 : c.flat ? 0.15 : 0.008).reverse()
      : cw(raw, c.far ? 1.6 : c.flat ? 0.15 : 0.008);
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
      h.arcade ? C.wall : h.door ? C.wood : C.glass,
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
    tol = c.far ? 0.9 : c.flat ? 0.06 : 0.006;
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
const isBrick = (b) => ['brick', 'brick-tower', 'gate', 'gate-tower', 'hall'].includes(b.kind),
  surface = (b) => (isBrick(b) ? 'brick' : 'wall'),
  tint = (b) => (isBrick(b) ? C.brick : C.wall);
function foundation(o, c) {
  for (const rs of a.foundationPolygons)
    prism(o, c, rs, a.foundationY, a.floorY, 'base', C.base, !c.far);
}
function special(v, door) {
  const q = [door.center[0] - v.A[0], door.center[1] - v.A[1]],
    u = q[0] * v.U[0] + q[1] * v.U[1],
    d = q[0] * v.N[0] + q[1] * v.N[1];
  return Math.abs(d) < 0.22 && u > door.width / 2 + 0.12 && u < v.L - door.width / 2 - 0.12
    ? u
    : null;
}
function facades(o, c) {
  for (const b of a.bodies)
    for (const v of visibleFaces(b, c)) {
      const { F, L } = v,
        lo = v.lo,
        hi = v.hi,
        s = surface(b),
        col = tint(b);
      if (c.far) {
        panel(o, c, F, 0, L, lo, hi, 0, s, col);
        continue;
      }
      const hallU =
        b.kind === 'hall' && v.N[0] * a.hallEntry.N[0] + v.N[1] * a.hallEntry.N[1] > 0.95
          ? special(v, a.hallEntry)
          : null;
      const gateU =
          b.kind === 'gate' && v.N[0] * a.gate.N[0] + v.N[1] * a.gate.N[1] > 0.98
            ? special(v, a.gate.door)
            : null,
        bloreU =
          b.kind === 'blore' && v.N[0] * a.bloreEntry.N[0] + v.N[1] * a.bloreEntry.N[1] > 0.95
            ? special(v, a.bloreEntry)
            : null;
      const bands =
        bloreU !== null
          ? [[lo, hi]]
          : b.kind === 'hall' || b.kind === 'chapel'
            ? [[lo, hi]]
            : b.kind === 'gate'
              ? [
                  [lo, a.floorY + 4.8],
                  [Math.max(lo, a.floorY + 4.8), hi],
                ].filter(([y, Y]) => Y > y + 0.1)
              : c.flat
                ? [[lo, hi]]
                : [
                    lo,
                    ...[3.6, 7.8, 12.1]
                      .map((y) => y + a.floorY)
                      .filter((y) => y > lo + 0.15 && y < hi - 0.15),
                    hi,
                  ]
                    .slice(0, -1)
                    .map((y, i, ps) => [y, i + 1 < ps.length ? ps[i + 1] : hi]);
      for (const [y, Y] of bands) {
        const holes = [],
          n =
            L > (c.flat ? 4 : 2)
              ? Math.max(
                  1,
                  Math.floor(
                    L /
                      (b.kind === 'hall'
                        ? c.fine
                          ? 3.0
                          : c.detail
                            ? 4.2
                            : c.flat
                              ? 10
                              : 6
                        : c.step),
                  ),
                )
              : 0,
          step = L / Math.max(1, n),
          door = (u, q, width = q.width) => {
            if (q.lo >= y - 0.001 && q.hi <= Y + 0.001)
              holes.push({
                u,
                width,
                lo: q.lo,
                hi: q.hi,
                shape: 'pointed',
                door: true,
                depth: 0.35,
              });
          };
        if (hallU !== null) door(hallU, a.hallEntry);
        if (gateU !== null) {
          door(gateU, a.gate.door);
          if (gateU + 2.95 < L - 0.12)
            door(gateU + 2.5, { lo: a.floorY, hi: a.floorY + 2.9, width: 0.9 });
          if (y > a.floorY + 4.4 && Y > a.floorY + 10.8)
            holes.push({
              u: gateU,
              width: 3.4,
              lo: a.floorY + 6.5,
              hi: a.floorY + 10.5,
              shape: 'pointed',
              depth: 0.3,
            });
        }
        if (bloreU !== null) {
          door(bloreU, a.bloreEntry);
          if (y <= a.floorY + 4.3 && Y >= a.floorY + 10.8)
            holes.push({
              u: bloreU,
              width: 2.8,
              lo: a.floorY + 4.3,
              hi: a.floorY + 10.8,
              shape: 'rect',
              depth: 0.35,
            });
        }
        for (let j = 0; j < n; j++) {
          const u = (j + 0.5) * step,
            w = Math.min(
              b.kind === 'hall' ? 2.3 : b.kind.includes('tower') ? 1.1 : 1.9,
              step * 0.5,
            );
          if (
            (hallU !== null && Math.abs(u - hallU) < 2.3) ||
            (gateU !== null && Math.abs(u - gateU) < 3.6) ||
            (bloreU !== null && Math.abs(u - bloreU) < 2.8)
          )
            continue;
          const add = (l, h, shape = 'rect') => {
            if (l >= y + 0.12 && h <= Y - 0.22 && h > l + 0.4)
              holes.push({
                u,
                width: w,
                lo: l,
                hi: h,
                shape: c.flat ? 'rect' : shape,
                depth: 0.25,
              });
          };
          if (b.kind === 'hall') add(Math.max(lo + 0.3, a.floorY + 1.2), hi - 0.65, 'pointed');
          else if (b.kind === 'chapel')
            add(Math.max(lo + 0.3, a.floorY + 1.1), hi - 0.7, 'pointed');
          else if (c.flat) {
            for (const h of [1.2, 5.2, 9, 13.3])
              add(a.floorY + h, Math.min(hi - 0.5, a.floorY + h + 2.2));
          } else
            add(y + 0.65, Y - 0.55, b.kind === 'low' || y < a.floorY + 3.7 ? 'pointed' : 'rect');
        }
        faceBand(o, c, F, L, y, Y, holes, col, s);
      }
      if (c.flat) continue;
      for (const y of [a.floorY + 0.2, a.floorY + 4.0, a.floorY + 8, hi - 0.28])
        if (y > lo && y < hi)
          panel(o, c, F, 0, L, y, Math.min(hi, y + 0.18), 0.07, 'stone', C.stone);
      if (c.detail) {
        for (const u of [0.18, L - 0.18])
          if (u > 0.1 && u < L - 0.1) {
            if (c.fine && isBrick(b))
              for (let y = lo + 0.2; y < hi - 0.2; y += 0.65)
                panel(
                  o,
                  c,
                  F,
                  u - 0.15,
                  u + 0.15,
                  y,
                  Math.min(hi, y + 0.38),
                  0.08,
                  'stone',
                  C.stone,
                );
            else panel(o, c, F, u - 0.11, u + 0.11, lo, hi, 0.08, 'stone', C.stone);
          }
        if (b.kind === 'hall') {
          const n = Math.max(1, Math.round(L / (c.fine ? 3.2 : 5)));
          for (let i = 0; i <= n; i++) {
            const u = (i * L) / n;
            span(o, c, F(u, lo), F(u, hi + 0.3), 0.3, 0.45, 'stone', C.stone);
          }
        }
      }
    }
}
const roofY = (r, p) =>
  a.floorY +
  r.eave +
  r.rise *
    Math.max(
      0,
      Math.min(1, Math.min(...r.planes.map(([x, z, c]) => x * p[0] + z * p[1] + c)) / r.hipWidth),
    );
function roofs(o, c) {
  for (const r of a.roofs) {
    const col = r.shape === 'flat' ? C.lead : C.roof,
      s = r.shape === 'flat' ? 'metal' : 'slate';
    for (const cell of r.cells)
      for (const rs of cell.polygons) cap(o, c, rs, (p) => roofY(r, p), s, col);
    for (const rs of r.polygons)
      for (const [ri, raw] of rs.entries()) {
        const ring = ri ? cw(raw, c.far ? 1.6 : 0.008).reverse() : cw(raw, c.far ? 1.6 : 0.008);
        for (let i = 0; i < ring.length; i++) {
          const A = ring[i],
            B = ring[(i + 1) % ring.length],
            v = face(A, B),
            y = a.floorY + r.eave,
            Y = roofY(r, A),
            H = roofY(r, B);
          // A gable ridge can lie between two low endpoints. Split the wall at
          // each roof-plane crossing so its triangular peak is actually closed.
          const cuts = [0, 1];
          for (let i = 0; i < r.planes.length; i++)
            for (let j = i + 1; j < r.planes.length; j++) {
              const P = r.planes[i],
                Q = r.planes[j],
                at = (p) => (P[0] - Q[0]) * p[0] + (P[1] - Q[1]) * p[1] + P[2] - Q[2],
                d = at(A),
                D = at(B);
              if (Math.abs(d - D) > 1e-9) {
                const t = d / (d - D);
                if (t > 1e-6 && t < 1 - 1e-6) cuts.push(t);
              }
            }
          cuts.sort((a, b) => a - b);
          for (let k = 0; k < cuts.length - 1; k++) {
            const [p, q] = cuts
                .slice(k, k + 2)
                .map((t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]),
              h = roofY(r, p),
              H = roofY(r, q);
            if (Math.max(h, H) > y + 0.02)
              Q(
                o,
                c,
                [
                  [p[0], y, p[1]],
                  [q[0], y, q[1]],
                  [q[0], H, q[1]],
                  [p[0], h, p[1]],
                ],
                r.kind === 'hall' ? 'brick' : 'wall',
                r.kind === 'hall' ? C.brick : C.wall,
                [v.N[0], 0, v.N[1]],
              );
          }
          const middle = roofY(r, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]);
          if (c.far || r.kind !== 'hall' || v.L < 12 || Math.max(Y, H, middle) > y + 1) continue;
          const n = c.flat ? 1 : c.fine ? 6 : c.detail ? 4 : 2,
            D = 2.1;
          for (let j = 0; j < n; j++) {
            const u = ((j + 0.5) * v.L) / n,
              p = v.F(u, 0, -D),
              q = [p[0], p[2]];
            if (!inPs(r.polygons, q)) continue;
            const h = roofY(r, q),
              f = (u, y, d = 0) => v.F(u, y, -D + d),
              w = c.flat ? 0.6 : 0.85,
              lo = h - 0.15,
              top = h + 1.3;
            panel(o, c, f, u - w, u + w, lo, top, 0, 'stone', C.stone);
            const ps = profile(
              { u, width: w * 1.2, lo: lo + 0.2, hi: top - 0.12, shape: 'circle' },
              c,
            );
            for (let k = 1; k < ps.length - 1; k++)
              T(
                o,
                c,
                [f(...ps[0], 0.025), f(...ps[k], 0.025), f(...ps[k + 1], 0.025)],
                'glass',
                C.glass,
                [v.N[0], 0, v.N[1]],
              );
            T(
              o,
              c,
              [f(u - w - 0.12, top), f(u + w + 0.12, top), f(u, top + 0.7)],
              'stone',
              C.stone,
            );
            for (const sign of [-1, 1]) {
              Q(
                o,
                c,
                [
                  f(u + sign * (w + 0.12), top),
                  f(u, top + 0.7),
                  f(u, top + 0.7, -1.5),
                  f(u + sign * (w + 0.12), top, -1.5),
                ],
                'slate',
                C.roof,
                [0, 1, 0],
              );
              Q(
                o,
                c,
                [
                  f(u + sign * w, lo),
                  f(u + sign * w, top),
                  f(u + sign * w, top, -1.5),
                  f(u + sign * w, lo, -1.5),
                ],
                'stone',
                C.stone,
                [v.U[0] * sign, 0, v.U[1] * sign],
              );
            }
            const back = (x, y, d = 0) => f(2 * u - x, y, -1.5 - d);
            panel(o, c, back, u - w, u + w, lo, top, 0, 'stone', C.stone);
            T(
              o,
              c,
              [f(u - w, top, -1.5), f(u, top + 0.7, -1.5), f(u + w, top, -1.5)],
              'stone',
              C.stone,
              [-v.N[0], 0, -v.N[1]],
            );
            Q(
              o,
              c,
              [f(u - w, lo), f(u + w, lo), f(u + w, lo, -1.5), f(u - w, lo, -1.5)],
              'stone',
              C.stone,
              [0, -1, 0],
            );
          }
        }
      }
  }
}
function battlements(o, c) {
  if (c.far) return;
  for (const b of a.bodies.filter(
    (b) => b.kind === 'blore' || b.kind.includes('tower') || b.kind === 'gate',
  ))
    for (const v of visibleFaces(b, c)) {
      const { F, L } = v,
        y = a.floorY + b.eave;
      if (L < 0.35) continue;
      const s = surface(b),
        col = tint(b),
        n = Math.max(1, Math.round(L / (c.flat ? 3 : c.fine ? 1.6 : c.detail ? 2.1 : 3.4))),
        step = L / n,
        w = step * 0.52;
      if (c.flat) {
        for (let j = 0; j < n; j++) {
          const u = (j + 0.5) * step;
          panel(o, c, F, u - w / 2, u + w / 2, y - 0.05, y + 0.9, 0, s, col);
        }
        continue;
      }
      panel(o, c, F, 0, L, y - 0.1, y + 0.38, 0, s, col);
      panel(o, c, (u, y, d = 0) => F(L - u, y, -0.36 - d), 0, L, y - 0.1, y + 0.38, 0, s, col);
      Q(
        o,
        c,
        [F(0, y + 0.38), F(L, y + 0.38), F(L, y + 0.38, -0.36), F(0, y + 0.38, -0.36)],
        'stone',
        C.stone,
        [0, 1, 0],
      );
      for (let j = 0; j < n; j++) {
        const u = (j + 0.5) * step,
          rs = [
            [
              F(u - w / 2, 0, 0.025),
              F(u + w / 2, 0, 0.025),
              F(u + w / 2, 0, -0.38),
              F(u - w / 2, 0, -0.38),
            ].map((p) => [p[0], p[2]]),
          ];
        prism(o, c, rs, y + 0.25, y + 0.98, s, col);
        if (c.detail)
          for (const z of [y + 0.27, y + 0.89])
            span(
              o,
              c,
              F(u - w / 2 - 0.04, z, 0.06),
              F(u + w / 2 + 0.04, z, 0.06),
              0.1,
              0.16,
              'stone',
              C.stone,
            );
      }
    }
}
function ringLoft(o, c, center, ps, n = c.n, s = 'metal', col = C.lead) {
  loft(
    o,
    S(c, s),
    ps.map(([y, r]) => radialRing(a.floorY + y, r, r, n, center, Math.PI / 4)),
    col,
  );
}
function cupola(o, c) {
  const t = a.cupola,
    [x, z] = t.center,
    r = a.roofs.find((r) => r.name === 'great-hall'),
    y = r ? roofY(r, t.center) - a.floorY : t.base;
  ringLoft(
    o,
    c,
    t.center,
    [
      [y - 0.1, 1.3],
      [t.lanternBase, 1.3],
    ],
    c.far ? 4 : c.n,
  );
  const n = c.far ? 4 : c.flat ? 6 : 8,
    ring = radialRing(a.floorY + t.lanternBase, t.radius, t.radius, n, t.center),
    top = radialRing(a.floorY + t.lanternTop, t.radius, t.radius, n, t.center);
  for (let i = 0; i < n; i++) {
    Q(o, c, [ring[i], ring[(i + 1) % n], top[(i + 1) % n], top[i]], 'glass', C.glass);
    if (c.detail) span(o, c, ring[i], top[i], 0.11, 0.13, 'metal', C.lead);
  }
  ringLoft(
    o,
    c,
    t.center,
    [
      [t.lanternTop, 1.25],
      [t.lanternTop + 0.45, 1.15],
      [t.lanternTop + 0.95, 0.65],
      [t.top - 0.25, 0.15],
      [t.top, 0.025],
    ],
    c.far ? 4 : c.n,
  );
}
function chimneys(o, c) {
  if (c.far) return;
  for (const [qidx, q] of a.chimneys.entries()) {
    if (c.flat && qidx % 2) continue;
    const b = a.bodies.find((b) => b.name === q.owner);
    if (!inPs(b.polygons, q.center)) continue;
    const r = a.roofs.find((r) => inPs(r.polygons, q.center)),
      y = r ? roofY(r, q.center) : a.floorY + b.eave,
      hi = a.floorY + q.height,
      [x, z] = q.center,
      w = q.width / 2,
      d = q.depth / 2;
    if (hi < y + 0.3) continue;
    box(o, c, x - w, z - d, x + w, z + d, y - 0.1, hi, 'brick', C.brick);
    if (c.detail) {
      box(
        o,
        c,
        x - w - 0.14,
        z - d - 0.14,
        x + w + 0.14,
        z + d + 0.14,
        hi - 0.25,
        hi,
        'stone',
        C.stone,
      );
      for (const dx of [-0.15, 0.15])
        box(o, c, x + dx - 0.08, z - 0.1, x + dx + 0.08, z + 0.1, hi, hi + 0.4, 'brick', C.brick);
    }
  }
  for (const [u, n] of [
    [-47, 60.8],
    [-32, 63],
  ]) {
    const p = [a.gate.U[0] * u + a.gate.N[0] * n, a.gate.U[1] * u + a.gate.N[1] * n],
      r = 0.38;
    box(
      o,
      c,
      p[0] - r,
      p[1] - r,
      p[0] + r,
      p[1] + r,
      a.floorY + 16.7,
      a.floorY + 20.3,
      'brick',
      C.brick,
    );
    if (c.detail)
      box(
        o,
        c,
        p[0] - r - 0.1,
        p[1] - r - 0.1,
        p[0] + r + 0.1,
        p[1] + r + 0.1,
        a.floorY + 20,
        a.floorY + 20.4,
        'stone',
        C.stone,
      );
  }
}
function entries(o, c) {
  for (const e of a.entries) {
    const F = (u, y, d) => [
        e.center[0] + e.U[0] * u + e.N[0] * d,
        y,
        e.center[1] + e.U[1] * u + e.N[1] * d,
      ],
      p = e.outerProfile.filter((_, i) => i % (c.fine ? 1 : c.far || c.flat ? 4 : 2) === 0),
      n = p.length - 1,
      w = e.width / 2,
      D = e.approachDistance,
      steps = c.far || c.flat ? 1 : 3;
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

export function buildLambethLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Lambeth tier ' + level);
  const o = safe(output);
  foundation(o, c);
  facades(o, c);
  roofs(o, c);
  battlements(o, c);
  cupola(o, c);
  chimneys(o, c);
  entries(o, c);
}
export const buildLambethSkyline = (o) => buildLambethLevel(o, 'skyline'),
  buildLambethDistrict = (o) => buildLambethLevel(o, 'district'),
  buildLambethStreet = (o) => buildLambethLevel(o, 'street'),
  buildLambethCloseup = (o) => buildLambethLevel(o, 'closeup');

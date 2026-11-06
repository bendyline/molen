/** Original complete Peles Castle exterior from current map and three ordinary pictures. */
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
  'b40a25ee5514e80d904a2fb7ad55be42dfe876123ba979050f161cdeb7530f02'
)
  throw Error('Peleș Castle controls changed: update explicit geometry input pin');
export const pelesControls = JSON.parse(controlsBytes);
const a = pelesControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('e5d9bd'),
    stone: lin('d7cbb4'),
    base: lin('aaa28d'),
    roof: lin('62696b'),
    copper: lin('7c9792'),
    veranda: lin('815340'),
    gold: lin('baa66b'),
    glass: lin('5b746c'),
    wood: lin('80503c'),
    dial: lin('58615e'),
  };
export const pelesSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.87, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.8, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.65, metallic: 0.25 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.42, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 4, arch: 2, step: 20 },
  district: { flat: true, n: 6, arch: 3, step: 13 },
  street: { n: 8, arch: 4, step: 5 },
  closeup: { detail: true, n: 12, arch: 8, step: 3.4 },
  master: { detail: true, fine: true, n: 24, arch: 18, step: 2.6 },
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
  }
}
function faceBand(o, c, F, L, lo, hi, holes, col) {
  if (c.flat && holes.some((h) => h.through))
    return faceBand(o, { ...c, flat: false }, F, L, lo, hi, holes, col);
  holes = holes.filter(
    (h) =>
      h.lo >= lo - 1e-7 &&
      h.hi <= hi + 1e-7 &&
      h.u - h.width / 2 > (h.through ? 0.001 : 0.1) &&
      h.u + h.width / 2 < L - (h.through ? 0.001 : 0.1),
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
function foundation(o, c) {
  for (const rs of a.foundationPolygons)
    prism(o, c, rs, a.foundationY, a.floorY, 'base', C.base, !c.far);
}
function timber(o, c, v, lo, hi) {
  const { F, L } = v;
  if (c.far || c.flat || hi <= lo + 0.1) return;
  const cc = c.detail,
    step = c.flat ? 5 : c.fine ? 1.35 : cc ? 1.9 : 3,
    n = Math.max(1, Math.round(L / step)),
    w = c.flat ? 0.12 : cc ? 0.18 : 0.15;
  for (const y of [lo + 0.12, hi - 0.18]) panel(o, c, F, 0, L, y, y + w, 0.07, 'wood', C.wood);
  for (let i = 0; i <= n; i++) {
    const u = (i * L) / n;
    panel(o, c, F, Math.max(0, u - w / 2), Math.min(L, u + w / 2), lo, hi, 0.075, 'wood', C.wood);
  }
  if (cc)
    for (let i = 0; i < n; i += c.fine ? 1 : 2) {
      const u = (i * L) / n,
        U = ((i + 1) * L) / n;
      span(
        o,
        c,
        F(u, lo + 0.3, 0.1),
        F(U, Math.min(hi - 0.25, lo + 1.5), 0.1),
        0.11,
        0.11,
        'wood',
        C.wood,
      );
    }
}
function facades(o, c) {
  for (const b of a.bodies)
    for (const v of visibleFaces(b, c)) {
      const { F, L, A, B, U, N } = v,
        lo = v.lo,
        hi = v.hi,
        mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2],
        portal =
          Math.abs(N[1]) > 0.85 &&
          mid[1] >= a.portal.from &&
          mid[1] <= a.portal.to &&
          Math.min(A[0], B[0]) < a.portal.x - a.portal.width / 2 - 0.001 &&
          Math.max(A[0], B[0]) > a.portal.x + a.portal.width / 2 + 0.001,
        hole = portal
          ? {
              u: (a.portal.x - A[0]) / U[0],
              width: a.portal.width,
              lo: a.floorY,
              hi: a.portal.hi,
              shape: 'arch',
              through: true,
            }
          : null;
      if (c.far) {
        faceBand(o, c, F, L, lo, hi, hole ? [{ ...hole, lo }] : [], C.wall);
        continue;
      }
      if (c.flat) {
        faceBand(o, c, F, L, lo, hi, hole ? [hole] : [], C.wall);
        const n = L > 3 ? Math.max(1, Math.floor(L / 8)) : 0;
        for (let j = 0; j < n; j++)
          for (const y of [a.floorY + 1.2, a.floorY + 5.4, a.floorY + 10, a.floorY + 14])
            if (
              y > lo + 0.1 &&
              y + 1.8 < hi - 0.2 &&
              (!hole || y > hole.hi || Math.abs(((j + 0.5) * L) / n - hole.u) > hole.width / 2 + 1)
            )
              opening(o, c, F, {
                u: ((j + 0.5) * L) / n,
                width: Math.min(1.25, (L / n) * 0.4),
                lo: y,
                hi: y + 1.8,
                shape: 'rect',
              });
        if (b.kind === 'timber' || b.kind === 'timber-tower')
          for (const y of [a.floorY + 8.25, hi - 0.3])
            if (y > lo && y < hi) panel(o, c, F, 0, L, y, y + 0.16, 0.06, 'wood', C.wood);
        if ((b.kind === 'timber' || b.kind === 'timber-tower') && L > 6 && hi > a.floorY + 8.5)
          for (const u of [0.15, L - 0.15])
            panel(
              o,
              c,
              F,
              u - 0.07,
              u + 0.07,
              Math.max(lo, a.floorY + 8.2),
              hi,
              0.06,
              'wood',
              C.wood,
            );
        continue;
      }
      const cut = [
        lo,
        ...[4.2, 8.2, 12.2, 16.2, 20.2, 24.2]
          .map((y) => y + a.floorY)
          .filter((y) => y > lo + 0.1 && y < hi - 0.1),
        hi,
      ];
      for (let k = 0; k < cut.length - 1; k++) {
        const y = cut[k],
          Y = cut[k + 1],
          holes = [],
          count =
            L > (c.flat ? 3.7 : 2)
              ? Math.max(1, Math.floor(L / (b.kind === 'white-tower' ? 5 : c.step)))
              : 0,
          step = L / Math.max(1, count),
          width = Math.min(b.kind === 'white-tower' ? 0.65 : 1.25, step * 0.43);
        if (hole && hole.lo >= y - 0.01 && hole.hi <= Y + 0.01) holes.push(hole);
        for (let j = 0; j < count; j++) {
          const u = (j + 0.5) * step;
          if (hole && y < hole.hi && Math.abs(u - hole.u) < hole.width / 2 + width / 2 + 0.2)
            continue;
          if (Y - y > 1.5)
            holes.push({
              u,
              width,
              lo: y + 0.65,
              hi: Math.min(Y - 0.55, y + 2.9),
              shape: k === 0 && b.kind === 'clock' ? 'arch' : 'rect',
              depth: 0.22,
            });
        }
        faceBand(o, c, F, L, y, Y, holes, C.wall);
        const isTimber = b.kind === 'timber' || b.kind === 'timber-tower';
        if (isTimber && y >= a.floorY + 8.1) timber(o, c, v, y, Y);
      }
      for (const y of [a.floorY + 0.15, a.floorY + 4.05, a.floorY + 8.05, hi - 0.25])
        if (y >= v.lo && y < hi)
          panel(o, c, F, 0, L, y, Math.min(y + 0.17, hi), 0.09, 'stone', C.stone);
      if (c.detail && (b.kind === 'clock' || b.kind === 'white-tower'))
        for (const u of [0.18, L - 0.18])
          if (u > 0.1 && u < L - 0.1) {
            for (let y = lo + 0.2; y < hi - 0.4; y += c.fine ? 0.6 : 1.2)
              panel(o, c, F, u - 0.15, u + 0.15, y, Math.min(y + 0.32, hi), 0.1, 'stone', C.stone);
          }
    }
}
const roofY = (r, p) => {
  const [x, z, X, Z] = r.bounds,
    dist =
      r.shape === 'gable-x'
        ? Math.min(p[1] - z, Z - p[1])
        : r.shape === 'gable-z'
          ? Math.min(p[0] - x, X - p[0])
          : Math.min(p[0] - x, X - p[0], p[1] - z, Z - p[1]);
  return a.floorY + r.eave + r.rise * Math.max(0, Math.min(1, dist / r.hipWidth));
};
function roofs(o, c) {
  for (const r of a.roofs) {
    const [x, z, X, Z] = r.bounds;
    const planes =
      r.shape === 'gable-x'
        ? [
            [0, 1, -z],
            [0, -1, Z],
          ]
        : r.shape === 'gable-z'
          ? [
              [1, 0, -x],
              [-1, 0, X],
            ]
          : [
              [1, 0, -x],
              [-1, 0, X],
              [0, 1, -z],
              [0, -1, Z],
            ];
    for (const cell of r.cells)
      for (const rs of cell.polygons) cap(o, c, rs, (p) => roofY(r, p), 'slate', C.roof);
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
          const middle = roofY(r, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]);
          if (Math.max(Y, H, middle) > y + 0.02) {
            // Preserve the peak between low gable endpoints by splitting at
            // every roof-plane crossing before filling the vertical boundary.
            const cuts = [0, 1];
            for (let i = 0; i < planes.length; i++)
              for (let j = i + 1; j < planes.length; j++) {
                const P = planes[i],
                  Q = planes[j],
                  at = (p) => (P[0] - Q[0]) * p[0] + (P[1] - Q[1]) * p[1] + P[2] - Q[2],
                  d = at(A),
                  D = at(B);
                if (Math.abs(d - D) > 1e-9) {
                  const t = d / (d - D);
                  if (t > 1e-6 && t < 1 - 1e-6) {
                    const p = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t],
                      min = Math.min(...planes.map((q) => q[0] * p[0] + q[1] * p[1] + q[2]));
                    if (P[0] * p[0] + P[1] * p[1] + P[2] <= min + 1e-7) cuts.push(t);
                  }
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
                  'wall',
                  C.wall,
                  [v.N[0], 0, v.N[1]],
                );
            }
            if (!c.far && v.L > 1) {
              panel(o, c, v.F, 0, v.L, y, y + 0.15, 0.04, 'wood', C.wood);
              const n = Math.max(1, Math.floor(v.L / (c.fine ? 1.5 : c.detail ? 2 : 4)));
              for (let j = 0; j <= n; j++) {
                const u = (j * v.L) / n,
                  h = roofY(r, [A[0] + v.U[0] * u, A[1] + v.U[1] * u]);
                if (h > y + 0.2)
                  panel(
                    o,
                    c,
                    v.F,
                    Math.max(0, u - 0.07),
                    Math.min(v.L, u + 0.07),
                    y,
                    h,
                    0.05,
                    'wood',
                    C.wood,
                  );
              }
            }
          }
          if (
            !c.far &&
            v.L > 7 &&
            r.name !== 'remaining-low-caps' &&
            Math.max(Y, H, middle) < y + 1
          ) {
            const n = Math.max(1, Math.floor(v.L / (c.fine ? 5 : c.detail ? 8 : c.flat ? 18 : 12))),
              D = Math.min(2.2, r.hipWidth * 0.35);
            for (let j = 0; j < n; j++) {
              const u = ((j + 0.5) * v.L) / n,
                p = v.F(u, 0, -D),
                q = [p[0], p[2]],
                h = roofY(r, q);
              if (!inPs(r.polygons, q) || h < y + 0.7) continue;
              const w = c.flat ? 0.55 : 0.8,
                f = (x, Y, d = 0) => v.F(x, Y, -D + d),
                lo = h - 0.1,
                top = h + 1.6,
                W = w + 0.18;
              panel(o, c, f, u - w, u + w, lo, top, 0, 'wall', C.wall);
              panel(
                o,
                c,
                f,
                u - w * 0.64,
                u + w * 0.64,
                lo + 0.3,
                top - 0.3,
                0.03,
                'glass',
                C.glass,
              );
              T(o, c, [f(u - W, top), f(u + W, top), f(u, top + 0.8)], 'wall', C.wall, [
                v.N[0],
                0,
                v.N[1],
              ]);
              Q(
                o,
                c,
                [f(u - W, top), f(u, top + 0.8), f(u, top + 0.8, -1.5), f(u - W, top, -1.5)],
                'slate',
                C.roof,
                [0, 1, 0],
              );
              Q(
                o,
                c,
                [f(u, top + 0.8), f(u + W, top), f(u + W, top, -1.5), f(u, top + 0.8, -1.5)],
                'slate',
                C.roof,
                [0, 1, 0],
              );
              for (const s of [-1, 1])
                Q(
                  o,
                  c,
                  [
                    f(u + s * w, lo),
                    f(u + s * w, top),
                    f(u + s * w, top, -1.5),
                    f(u + s * w, lo, -1.5),
                  ],
                  'wall',
                  C.wall,
                  [v.U[0] * s, 0, v.U[1] * s],
                );
              const back = (x, y, d = 0) => f(2 * u - x, y, -1.5 - d);
              panel(o, c, back, u - w, u + w, lo, top, 0, 'wall', C.wall);
              T(
                o,
                c,
                [f(u - W, top, -1.5), f(u, top + 0.8, -1.5), f(u + W, top, -1.5)],
                'wall',
                C.wall,
                [-v.N[0], 0, -v.N[1]],
              );
              Q(
                o,
                c,
                [f(u - w, lo), f(u + w, lo), f(u + w, lo, -1.5), f(u - w, lo, -1.5)],
                'wall',
                C.wall,
                [0, -1, 0],
              );
              if (c.detail) {
                span(o, c, f(u - w, lo, 0.06), f(u - w, top, 0.06), 0.11, 0.12, 'wood', C.wood);
                span(o, c, f(u + w, lo, 0.06), f(u + w, top, 0.06), 0.11, 0.12, 'wood', C.wood);
                span(o, c, f(u - W, top, 0.06), f(u, top + 0.8, 0.06), 0.12, 0.12, 'wood', C.wood);
                span(o, c, f(u, top + 0.8, 0.06), f(u + W, top, 0.06), 0.12, 0.12, 'wood', C.wood);
              }
            }
          }
        }
      }
  }
  if (!c.far)
    for (const [qidx, q] of a.chimneys.entries()) {
      if (c.flat && qidx % 2) continue;
      const [x, z] = q.center,
        r = a.roofs.find((r) => inPs(r.polygons, q.center));
      if (!r) continue;
      const y = roofY(r, q.center),
        w = q.width / 2,
        d = q.depth / 2;
      box(o, c, x - w, z - d, x + w, z + d, y - 0.2, y + q.aboveRoof, 'wall', C.wall);
      if (c.detail) {
        box(
          o,
          c,
          x - w - 0.15,
          z - d - 0.15,
          x + w + 0.15,
          z + d + 0.15,
          y + q.aboveRoof - 0.5,
          y + q.aboveRoof - 0.2,
          'stone',
          C.stone,
        );
        for (const dx of [-0.2, 0.2])
          box(
            o,
            c,
            x + dx - 0.1,
            z - 0.16,
            x + dx + 0.1,
            z + 0.16,
            y + q.aboveRoof - 0.2,
            y + q.aboveRoof + 0.35,
            'copper',
            C.veranda,
          );
      }
    }
}
function ringLoft(o, c, center, ps, n = c.n, s = 'slate', col = C.roof) {
  if (c.far && ps.length >= 4 && ps.at(-2)[1] < 0.1 && ps.at(-1)[1] < 0.1)
    ps = [...ps.slice(0, -2), ps.at(-1)];
  if (
    c.far &&
    ps.length === 4 &&
    ps.at(-1)[0] - ps[0][0] > 5 &&
    ps[0][1] > 2 &&
    ps.at(-2)[1] >= 1 &&
    ps.at(-1)[1] >= 1 &&
    ps.at(-1)[0] - ps.at(-2)[0] < 0.8 &&
    ps[1][0] - ps[0][0] < 0.8
  )
    ps = [ps[0], ps.at(-1)];
  loft(
    o,
    S(c, s),
    ps.map(([y, rx, rz = rx]) => radialRing(a.floorY + y, rx, rz, n, center, Math.PI / 4)),
    col,
    { cap: !c.far },
  );
  if (c.far) {
    const [y, rx, rz = rx] = ps.at(-1);
    const ring = radialRing(a.floorY + y, rx, rz, n, center, Math.PI / 4);
    for (let i = 1; i < ring.length - 1; i++)
      T(o, c, [ring[0], ring[i], ring[i + 1]], s, col, [0, 1, 0]);
  }
}
function lantern(o, c, center, lo, hi, r, s = 'wood', col = C.wood) {
  const n = c.far ? 4 : c.flat ? 6 : 8,
    w = c.far ? 0.18 : 0.13;
  ringLoft(
    o,
    c,
    center,
    [
      [lo, r + 0.2],
      [lo + 0.18, r + 0.2],
    ],
    n,
    s,
    col,
  );
  for (let i = 0; i < n; i++) {
    const t = Math.PI / 4 - (i / n) * Math.PI * 2,
      p = [center[0] + Math.cos(t) * r, center[1] + Math.sin(t) * r];
    if (c.far || c.flat)
      Q(
        o,
        c,
        [
          [p[0] - Math.sin(t) * w, a.floorY + lo, p[1] + Math.cos(t) * w],
          [p[0] + Math.sin(t) * w, a.floorY + lo, p[1] - Math.cos(t) * w],
          [p[0] + Math.sin(t) * w, a.floorY + hi, p[1] - Math.cos(t) * w],
          [p[0] - Math.sin(t) * w, a.floorY + hi, p[1] + Math.cos(t) * w],
        ],
        s,
        col,
        [Math.cos(t), 0, Math.sin(t)],
      );
    else span(o, c, [p[0], a.floorY + lo, p[1]], [p[0], a.floorY + hi, p[1]], w, w, s, col);
  }
  ringLoft(
    o,
    c,
    center,
    [
      [hi - 0.1, r + 0.18],
      [hi + 0.15, r + 0.18],
    ],
    n,
    s,
    col,
  );
}
function openClockGallery(o, c) {
  const t = a.clock,
    [x, z] = t.center,
    w = t.width / 2,
    d = t.depth / 2,
    lo = a.floorY + t.base,
    hi = a.floorY + t.galleryTop,
    ring = [
      [x - w, z - d],
      [x - w, z + d],
      [x + w, z + d],
      [x + w, z - d],
    ],
    cc = c.flat ? { ...c, flat: false } : c;
  for (let i = 0; i < 4; i++) {
    const v = face(ring[i], ring[(i + 1) % 4]),
      side = i % 2 === 0,
      h = {
        u: v.L / 2,
        width: v.L * 0.6,
        lo: lo + 0.6,
        hi: hi - 1.1,
        shape: 'arch',
        through: true,
      };
    if (side) {
      faceBand(o, cc, v.F, v.L, lo, hi, [h], C.wood);
      const F = (u, y, d = 0) => v.F(v.L - u, y, -0.45 - d);
      faceBand(o, cc, F, v.L, lo, hi, [h], C.wood);
      const ps = profile(h, c);
      for (let j = 0; j < ps.length; j++) {
        const A = ps[j],
          B = ps[(j + 1) % ps.length];
        Q(
          o,
          c,
          [v.F(...A), v.F(...B), v.F(B[0], B[1], -0.45), v.F(A[0], A[1], -0.45)],
          'stone',
          C.stone,
        );
      }
    } else {
      panel(o, c, v.F, 0, v.L, lo, hi, 0, 'wall', C.wall);
      if (!c.far) {
        const F = v.F,
          y = (lo + hi) / 2,
          r = Math.min(v.L * 0.24, 2.2),
          n = c.fine ? 48 : c.detail ? 24 : 12;
        for (let j = 0; j < n; j++) {
          const point = (k) =>
            F(
              v.L / 2 + Math.cos((k / n) * Math.PI * 2) * r,
              y + Math.sin((k / n) * Math.PI * 2) * r,
              0.035,
            );
          T(o, c, [F(v.L / 2, y, 0.035), point(j), point(j + 1)], 'copper', C.dial, [
            v.N[0],
            0,
            v.N[1],
          ]);
        }
        for (let j = 0; j < 12; j++) {
          const t = (j / 12) * Math.PI * 2;
          if (c.flat) {
            const u = v.L / 2 + Math.sin(t) * r * 0.9,
              Y = y + Math.cos(t) * r * 0.9;
            panel(o, c, F, u - 0.035, u + 0.035, Y - 0.06, Y + 0.06, 0.07, 'stone', C.stone);
          } else
            span(
              o,
              c,
              F(v.L / 2 + Math.sin(t) * r * 0.83, y + Math.cos(t) * r * 0.83, 0.07),
              F(v.L / 2 + Math.sin(t) * r * 0.96, y + Math.cos(t) * r * 0.96, 0.07),
              0.075,
              0.07,
              'stone',
              C.stone,
            );
        }
        span(
          o,
          c,
          F(v.L / 2, y, 0.11),
          F(v.L / 2 + r * 0.3, y + r * 0.45, 0.11),
          0.1,
          0.09,
          'stone',
          C.stone,
        );
        span(
          o,
          c,
          F(v.L / 2, y, 0.12),
          F(v.L / 2 - r * 0.65, y + r * 0.15, 0.12),
          0.08,
          0.08,
          'stone',
          C.stone,
        );
      }
    }
    if (!c.far)
      for (const y of [lo + 0.1, hi - 0.35])
        panel(o, c, v.F, 0, v.L, y, y + 0.2, 0.12, 'stone', C.stone);
  }
  cap(o, c, [ring], lo, 'wood', C.wood);
  cap(o, c, [ring], hi, 'wood', C.wood, false);
  ringLoft(
    o,
    c,
    t.center,
    [
      [27, t.width * 0.58, t.depth * 0.58],
      [27.5, t.width * 0.56, t.depth * 0.56],
      [38.8, 1.05],
      [39.3, 1.1],
    ],
    4,
  );
  lantern(o, c, t.center, 39.1, 42.2, 0.9);
  ringLoft(
    o,
    c,
    t.center,
    [
      [42.1, 1.25],
      [42.7, 1.1],
      [48.5, 0.05],
      [49, 0.02],
    ],
    c.far ? 4 : 8,
  );
  if (!c.far)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const p = [x + sx * w * 0.88, z + sz * d * 0.88];
        ringLoft(
          o,
          c,
          p,
          [
            [26.6, 0.65],
            [29.7, 0.6],
            [30.7, 0.1],
          ],
          4,
          'stone',
          C.stone,
        );
        if (c.detail)
          ringLoft(
            o,
            c,
            p,
            [
              [27.2, 0.8],
              [27.5, 0.8],
            ],
            4,
            'stone',
            C.stone,
          );
      }
}
function turrets(o, c) {
  const p = a.polyTower;
  ringLoft(
    o,
    c,
    p.center,
    [
      [24, p.radius * 1.22],
      [24.5, p.radius * 1.1],
      [30.8, 1],
      [31.1, 1.05],
    ],
    c.far ? 4 : 8,
  );
  lantern(o, c, p.center, 31, 34, 0.8);
  ringLoft(
    o,
    c,
    p.center,
    [
      [33.9, 1.1],
      [34.7, 0.75],
      [39.7, 0.035],
      [40, 0.015],
    ],
    c.far ? 4 : 8,
  );
  for (const t of a.whiteTurrets) {
    lantern(o, c, t.center, t.baseTop, t.lanternTop, t.radius * 0.8, 'stone', C.stone);
    ringLoft(
      o,
      c,
      t.center,
      t.onion
        ? [
            [t.lanternTop, t.radius],
            [t.lanternTop + 0.7, t.radius * 0.95],
            [t.lanternTop + 1.2, t.radius * 0.65],
            [t.roofTop, 0.2],
            [t.top, 0.02],
          ]
        : [
            [t.lanternTop, t.radius * 1.3],
            [t.lanternTop + 0.7, t.radius],
            [t.roofTop, 0.1],
            [t.top, 0.02],
          ],
      c.far ? 4 : c.n,
      'copper',
      C.copper,
    );
  }
}
function skylight(o, c) {
  const t = a.skylight,
    [x, z] = t.center,
    w = t.width / 2,
    d = t.depth / 2;
  box(o, c, x - w, z - d, x + w, z + d, t.baseY, t.eaveY, 'glass', C.glass, false);
  const base = [
    [x - w, z - d],
    [x - w, z + d],
    [x + w, z + d],
    [x + w, z - d],
  ];
  const curbBottom = (p) => {
    const r = a.roofs.find((r) => inPs(r.polygons, p));
    return Math.min(t.baseY - 0.02, r ? roofY(r, p) - 0.05 : a.floorY + 16);
  };
  for (let i = 0; i < 4; i++) {
    const A = base[i],
      B = base[(i + 1) % 4],
      v = face(A, B);
    Q(
      o,
      c,
      [
        [A[0], curbBottom(A), A[1]],
        [B[0], curbBottom(B), B[1]],
        [B[0], t.baseY + 0.03, B[1]],
        [A[0], t.baseY + 0.03, A[1]],
      ],
      'slate',
      C.roof,
      [v.N[0], 0, v.N[1]],
    );
  }
  const ring = [
      [x - w, t.eaveY, z - d],
      [x - w, t.eaveY, z + d],
      [x + w, t.eaveY, z + d],
      [x + w, t.eaveY, z - d],
    ],
    top = [
      [x - w * 0.55, t.topY, z - d * 0.5],
      [x - w * 0.55, t.topY, z + d * 0.5],
      [x + w * 0.55, t.topY, z + d * 0.5],
      [x + w * 0.55, t.topY, z - d * 0.5],
    ];
  for (let i = 0; i < 4; i++)
    Q(o, c, [ring[i], ring[(i + 1) % 4], top[(i + 1) % 4], top[i]], 'glass', C.glass, [0, 1, 0]);
  Q(o, c, top, 'glass', C.glass, [0, 1, 0]);
  if (c.far || c.flat) return;
  for (let i = 0; i < 4; i++) {
    span(o, c, ring[i], ring[(i + 1) % 4], 0.12, 0.14, 'copper', C.copper);
    span(o, c, ring[i], top[i], 0.12, 0.14, 'copper', C.copper);
    span(o, c, top[i], top[(i + 1) % 4], 0.12, 0.14, 'copper', C.copper);
  }
  if (c.detail) {
    const n = c.fine ? 12 : 6;
    for (let i = 0; i <= n; i++) {
      const u = x - w + (2 * w * i) / n;
      span(
        o,
        c,
        [u, t.eaveY, z - d],
        [x + (u - x) * 0.55, t.topY, z - d * 0.5],
        0.06,
        0.08,
        'copper',
        C.copper,
      );
      span(
        o,
        c,
        [x + (u - x) * 0.55, t.topY, z - d * 0.5],
        [x + (u - x) * 0.55, t.topY, z + d * 0.5],
        0.06,
        0.08,
        'copper',
        C.copper,
      );
      span(
        o,
        c,
        [x + (u - x) * 0.55, t.topY, z + d * 0.5],
        [u, t.eaveY, z + d],
        0.06,
        0.08,
        'copper',
        C.copper,
      );
    }
  }
}
function veranda(o, c) {
  const v = a.veranda;
  box(o, c, v.x, v.z, v.X, v.Z, a.foundationY, v.floorY, 'base', C.base);
  box(o, c, v.x, v.z, v.X, v.Z, v.roofY - 0.25, v.roofY, 'stone', C.stone);
  const n = c.far ? 3 : v.columns;
  for (let j = 0; j < n; j++) {
    const x = v.x + 0.35 + ((v.X - v.x - 0.7) * j) / (n - 1),
      z = v.Z - 0.4,
      r = c.far ? 0.18 : 0.22;
    if (c.far) {
      Q(
        o,
        c,
        [
          [x - r, v.floorY, z],
          [x + r, v.floorY, z],
          [x + r, v.roofY, z],
          [x - r, v.roofY, z],
        ],
        'stone',
        C.stone,
        [0, 0, 1],
      );
      continue;
    }
    ringLoft(
      o,
      c,
      [x, z],
      [
        [v.floorY - a.floorY, r * 1.4],
        [v.floorY - a.floorY + 0.2, r],
        [v.roofY - a.floorY - 0.3, r],
        [v.roofY - a.floorY, r * 1.4],
      ],
      c.far ? 4 : c.n,
      'stone',
      C.stone,
    );
  }
  Q(
    o,
    c,
    [
      [v.x - 0.25, v.roofY, v.Z + 0.2],
      [v.X + 0.25, v.roofY, v.Z + 0.2],
      [v.X + 0.25, v.topY, v.z - 0.1],
      [v.x - 0.25, v.topY, v.z - 0.1],
    ],
    'copper',
    C.veranda,
    [0, 1, 0],
  );
  for (const x of [v.x - 0.25, v.X + 0.25])
    T(
      o,
      c,
      [
        [x, v.roofY, v.z - 0.1],
        [x, v.topY, v.z - 0.1],
        [x, v.roofY, v.Z + 0.2],
      ],
      'copper',
      C.veranda,
    );
  if (c.detail) {
    const y = v.roofY + 0.35;
    for (const z of [v.z + 0.25, v.Z - 0.1])
      span(o, c, [v.x, y, z], [v.X, y, z], 0.14, 0.14, 'stone', C.stone);
    for (let j = 0; j <= 24; j++) {
      const x = v.x + ((v.X - v.x) * j) / 24;
      span(o, c, [x, v.roofY, zOrFront(v)], [x, y, zOrFront(v)], 0.09, 0.09, 'stone', C.stone);
    }
  }
}
const zOrFront = (v) => v.Z - 0.1;
function portalVault(o, c) {
  const { x, width, hi, from, to } = a.portal,
    r = width / 2,
    spring = hi - r,
    n = c.far ? 2 : c.arch * 2;
  for (let i = 0; i < n; i++) {
    const point = (j, z) => [
      x + r * Math.cos((j / n) * Math.PI),
      spring + r * Math.sin((j / n) * Math.PI),
      z,
    ];
    Q(
      o,
      c,
      [point(i, from), point(i + 1, from), point(i + 1, to), point(i, to)],
      'stone',
      C.stone,
      [0, -1, 0],
    );
  }
  for (const s of [-1, 1])
    Q(
      o,
      c,
      [
        [x + s * r, a.floorY, from],
        [x + s * r, a.floorY, to],
        [x + s * r, spring, to],
        [x + s * r, spring, from],
      ],
      'stone',
      C.stone,
      [-s, 0, 0],
    );
}
function entries(o, c) {
  for (const e of a.entries) {
    const F = (u, y, d) => [
        e.center[0] + e.U[0] * u + e.N[0] * d,
        y,
        e.center[1] + e.U[1] * u + e.N[1] * d,
      ],
      p = e.outerProfile.filter((_, i) => i % (c.fine ? 1 : c.far ? 16 : c.flat ? 4 : 2) === 0),
      n = p.length - 1,
      w = e.width / 2,
      D = e.approachDistance,
      steps = c.far || c.flat ? 1 : c.fine ? 24 : 12;
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
export function buildPelesLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Peles tier ' + level);
  const o = safe(output);
  foundation(o, c);
  facades(o, c);
  roofs(o, c);
  portalVault(o, c);
  openClockGallery(o, c);
  turrets(o, c);
  skylight(o, c);
  veranda(o, c);
  entries(o, c);
}
export const buildPelesSkyline = (o) => buildPelesLevel(o, 'skyline'),
  buildPelesDistrict = (o) => buildPelesLevel(o, 'district'),
  buildPelesStreet = (o) => buildPelesLevel(o, 'street'),
  buildPelesCloseup = (o) => buildPelesLevel(o, 'closeup');

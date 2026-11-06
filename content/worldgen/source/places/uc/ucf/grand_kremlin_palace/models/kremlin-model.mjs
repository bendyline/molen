/** Original individual Grand Kremlin Palace exterior; shared materials and authored browser tiers. */
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
  '2422e4ff66176afdf104bbede27f8261534dcaa17b6d8ec4190a5c83701b366c'
)
  throw Error('Grand Kremlin Palace controls changed: update explicit geometry input pin');
export const kremlinControls = JSON.parse(controlsBytes);
const a = kremlinControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('e8bf72'),
    pale: lin('eee0bf'),
    historic: lin('d7d0aa'),
    red: lin('bd6651'),
    stone: lin('f2e8cb'),
    base: lin('9d9c90'),
    roof: lin('799d80'),
    lead: lin('82928c'),
    gold: lin('d0ac57'),
    glass: lin('53707a'),
    wood: lin('dfdbc4'),
  };
export const kremlinSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.7, metallic: 0.18 },
  gold: { slot: 'trim', graph: 'metal_copper', roughness: 0.5, metallic: 0.6 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.42, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 4, arch: 2, step: 40 },
  district: { flat: true, n: 6, arch: 3, step: 13 },
  street: { n: 8, arch: 2, step: 7.4 },
  closeup: { detail: true, n: 12, arch: 6, step: 4.8 },
  master: { detail: true, fine: true, n: 24, arch: 14, step: 4.2 },
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
      clean(r, c.precise ? (c.far ? 0.15 : 0.008) : c.far ? 1.6 : c.flat ? 0.15 : 0.008),
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

const tint = (b) =>
  b.kind === 'historic'
    ? C.historic
    : b.kind === 'terem'
      ? C.red
      : b.kind === 'pale'
        ? C.pale
        : C.wall;
function foundation(o, c) {
  for (const rs of a.foundationPolygons)
    prism(o, c, rs, a.foundationY, a.floorY, 'base', C.base, !c.far);
}
function facades(o, c) {
  for (const b of a.bodies) {
    // The foundation already closes the base; keep lower small shapes in every tier.
    for (const v of visibleFaces(b, c)) {
      const { F, L, lo, hi } = v,
        col = b.kind === 'base' ? C.base : tint(b),
        surface = b.kind === 'base' ? 'base' : 'wall';
      if (c.far || b.kind === 'base') {
        panel(o, c, F, 0, L, lo, hi, 0, surface, col);
        continue;
      }
      const n = L > (c.flat ? 5 : 2) ? Math.max(1, Math.floor(L / c.step)) : 0,
        step = L / Math.max(1, n),
        holes = [],
        details = [];
      const rows =
        b.kind === 'crown'
          ? [[a.floorY + 24, a.floorY + 28.8, 'pointed']]
          : b.kind === 'arcade'
            ? [[a.floorY + 1.2, a.floorY + 5.8, 'arch']]
            : b.kind === 'terem'
              ? [[a.floorY + 24, a.floorY + 29.5, 'pointed']]
              : b.eave >= 20
                ? [
                    [a.floorY + 1.2, a.floorY + 5.7, 'arch'],
                    [a.floorY + 8.1, a.floorY + 13.2, 'rect'],
                    [a.floorY + 14.4, a.floorY + 20.6, 'rect'],
                  ]
                : [
                    [a.floorY + 1.2, a.floorY + 4.9, 'arch'],
                    [a.floorY + 6.8, a.floorY + 10.2, 'rect'],
                    [a.floorY + 11.3, a.floorY + 14.5, 'rect'],
                  ];
      for (let j = 0; j < n; j++) {
        const u = (j + 0.5) * step,
          w = Math.min(step * 0.53, c.flat ? 3.2 : 2.4);
        for (const [y, Y, shape] of rows) {
          if (y < lo + 0.1 || Y > hi - 0.4) continue;
          if (b.kind === 'crown') {
            if (c.detail) {
              const p = profile(
                { u, width: Math.min(3, w + 1), lo: y, hi: Y, shape: 'pointed' },
                c,
              );
              for (let k = 0; k < p.length; k++)
                span(
                  o,
                  c,
                  F(p[k][0], p[k][1], 0.12),
                  F(p[(k + 1) % p.length][0], p[(k + 1) % p.length][1], 0.12),
                  0.17,
                  0.22,
                );
              const r = 0.7,
                ps = Array.from({ length: c.fine ? 20 : 10 }, (_, i) =>
                  F(
                    u + Math.cos((i * Math.PI * 2) / (c.fine ? 20 : 10)) * r,
                    y + 1.9 + Math.sin((i * Math.PI * 2) / (c.fine ? 20 : 10)) * r,
                    0.16,
                  ),
                );
              for (let k = 1; k < ps.length - 1; k++)
                T(o, c, [ps[0], ps[k], ps[k + 1]], 'gold', C.gold, [v.N[0], 0, v.N[1]]);
            }
            continue;
          }
          const paired = !c.flat && b.kind === 'palace' && y > a.floorY + 7 && L > 6;
          if (paired) {
            for (const sign of [-1, 1])
              holes.push({
                u: u + sign * 0.52,
                width: 0.82,
                lo: y,
                hi: Y,
                shape: 'arch',
                depth: 0.32,
              });
          } else
            holes.push({ u, width: w, lo: y, hi: Y, shape: c.flat ? 'rect' : shape, depth: 0.3 });
          details.push({ u, w: paired ? 2.2 : w, y, Y, pediment: y > a.floorY + 7 });
        }
      }
      faceBand(o, c, F, L, lo, hi, holes, col, surface);
      if (c.flat) continue;
      for (const y of [7, 14, 21.7, b.eave - 0.35].map((y) => a.floorY + y))
        if (y > lo + 0.1 && y < hi - 0.05) {
          panel(o, c, F, 0, L, y, Math.min(hi, y + 0.25), 0.12, 'stone', C.stone);
          if (c.detail) span(o, c, F(0, y + 0.3, 0.2), F(L, y + 0.3, 0.2), 0.18, 0.3);
        }
      if (c.detail)
        for (const h of details) {
          if (h.pediment) {
            const y = h.Y + 0.25,
              r = h.w * 0.6;
            T(
              o,
              c,
              [F(h.u - r, y, 0.11), F(h.u + r, y, 0.11), F(h.u, y + 1, 0.11)],
              'stone',
              C.stone,
              [v.N[0], 0, v.N[1]],
            );
            if (c.fine) {
              span(o, c, F(h.u - r, y, 0.18), F(h.u, y + 1, 0.18), 0.13, 0.18);
              span(o, c, F(h.u, y + 1, 0.18), F(h.u + r, y, 0.18), 0.13, 0.18);
            }
          }
          for (const sign of [-1, 1]) {
            const u = h.u + sign * Math.min(step * 0.46, h.w * 0.5 + 0.35);
            panel(
              o,
              c,
              F,
              u - 0.13,
              u + 0.13,
              Math.max(lo, h.y - 0.2),
              Math.min(hi, h.Y + 1),
              0.11,
              'stone',
              C.stone,
            );
            if (c.fine) span(o, c, F(u, h.y - 0.1, 0.18), F(u, h.Y + 0.1, 0.18), 0.14, 0.2);
          }
        }
    }
    if (!c.far)
      for (const rs of b.polygons)
        cap(o, c, rs, a.floorY + b.eave, b.kind === 'base' ? 'base' : 'wall', tint(b));
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
        cap(o, { ...c, precise: true }, rs, (p) => roofY(r, p), 'metal', col);
    for (const rs of r.polygons)
      for (const [ri, raw] of rs.entries()) {
        const ring = ri ? cw(raw, c.far ? 1.6 : 0.008).reverse() : cw(raw, c.far ? 1.6 : 0.008);
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
              'metal',
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
              span(o, c, t[j - 1], t[j], 0.025, 0.035, 'metal', col);
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
function ringLoft(o, c, center, profile, n = c.n, s = 'gold', col = C.gold) {
  loft(
    o,
    S(c, s),
    profile.map(([y, r]) => radialRing(a.floorY + y, r, r, n, center, Math.PI / 4)),
    col,
  );
}
function crown(o, c) {
  const t = a.crown,
    [x, z] = t.center,
    n = c.far ? 6 : c.flat ? 8 : c.detail ? 16 : 12,
    profiles = c.far
      ? [
          [t.eave, 1],
          [t.eave + 4, 0.77],
          [t.roofTop, 0.24],
        ]
      : [
          [t.eave, 1],
          [t.eave + 1.6, 0.95],
          [t.eave + 3.9, 0.74],
          [t.eave + 5.8, 0.46],
          [t.roofTop, 0.24],
        ];
  const rings = profiles.map(([y, s]) =>
    Array.from({ length: n }, (_, i) => {
      const q = (-i * Math.PI * 2) / n,
        X = Math.cos(q),
        Z = Math.sin(q),
        p = 2.8;
      return [
        x + Math.sign(X) * Math.pow(Math.abs(X), 2 / p) * t.width * 0.5 * s,
        a.floorY + y,
        z + Math.sign(Z) * Math.pow(Math.abs(Z), 2 / p) * t.depth * 0.5 * s,
      ];
    }),
  );
  loft(o, S(c, 'metal'), rings, C.roof);
  ringLoft(
    o,
    c,
    t.center,
    [
      [t.lanternBottom, 3.3],
      [t.lanternTop, 3.3],
    ],
    c.far ? 4 : c.n,
  );
  ringLoft(
    o,
    c,
    t.center,
    c.far
      ? [
          [t.lanternTop, 3.5],
          [t.lanternTop + 2.3, 0.8],
          [t.finialTop, 0.055],
        ]
      : [
          [t.lanternTop, 3.5],
          [t.lanternTop + 1, 2.5],
          [t.lanternTop + 1.7, 0.6],
          [t.lanternTop + 2.1, 0.9],
          [t.lanternTop + 2.8, 0.6],
          [t.finialTop, 0.055],
        ],
    c.far ? 4 : c.n,
  );
  if (!c.far) {
    for (let i = 0; i < 8; i++) {
      const q = (i * Math.PI) / 4,
        px = x + Math.cos(q) * 3.36,
        pz = z + Math.sin(q) * 3.36;
      box(
        o,
        c,
        px - 0.14,
        pz - 0.14,
        px + 0.14,
        pz + 0.14,
        a.floorY + t.lanternBottom,
        a.floorY + t.lanternTop,
        'gold',
        C.gold,
      );
    }
    const front = face([-20.1, 68.33], [8.1, 68.33]);
    for (const u of [5.5, 14.1, 22.7]) {
      const F = (u, y, d = 0) => front.F(u, y, -d),
        ps = profile({ u, width: 2.1, lo: a.floorY + 30, hi: a.floorY + 33, shape: 'circle' }, c);
      for (let k = 1; k < ps.length - 1; k++)
        T(
          o,
          c,
          [F(...ps[0], 0.2), F(...ps[k], 0.2), F(...ps[k + 1], 0.2)],
          'gold',
          C.gold,
          [0, 0, 1],
        );
    }
  }
}
function domes(o, c) {
  for (const d of c.far ? a.domes.filter((_, i) => i < 5 || i === 10) : a.domes) {
    const r = d.radius,
      h = d.top - d.base,
      n = c.far ? 3 : c.flat ? 6 : c.n;
    const p = c.far
      ? [
          [d.base, r * 0.5],
          [d.top - 2, r],
          [d.top, 0.035],
        ]
      : [
          [d.base, r * 0.46],
          [d.base + h * 0.24, r * 0.5],
          [d.base + h * 0.35, r * 0.9],
          [d.base + h * 0.5, r],
          [d.base + h * 0.7, r * 0.68],
          [d.base + h * 0.86, r * 0.16],
          [d.top, 0.035],
        ];
    ringLoft(o, c, d.center, p, n);
    if (c.detail) {
      const [x, z] = d.center,
        y = d.top - 0.35;
      span(o, c, [x, a.floorY + y, z], [x, a.floorY + y + 1.1, z], 0.08, 0.09, 'gold', C.gold);
      span(
        o,
        c,
        [x - 0.32, a.floorY + y + 0.65, z],
        [x + 0.32, a.floorY + y + 0.65, z],
        0.08,
        0.09,
        'gold',
        C.gold,
      );
    }
  }
}
export function buildKremlinLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Kremlin tier ' + level);
  const o = safe(output);
  foundation(o, c);
  facades(o, c);
  roofs(o, c);
  crown(o, c);
  domes(o, c);
  entries(o, c);
}
export const buildKremlinSkyline = (o) => buildKremlinLevel(o, 'skyline'),
  buildKremlinDistrict = (o) => buildKremlinLevel(o, 'district'),
  buildKremlinStreet = (o) => buildKremlinLevel(o, 'street'),
  buildKremlinCloseup = (o) => buildKremlinLevel(o, 'closeup');

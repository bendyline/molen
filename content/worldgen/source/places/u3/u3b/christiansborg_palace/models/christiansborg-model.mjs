/** Original complete Christiansborg Palace and connected riding complex. */
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
  'fdb27c66f823c5d5b231a6f943108485d273d73854dc997ca7db16f1da11efa3'
)
  throw Error('Christiansborg Palace controls changed: update explicit geometry input pin');
export const christiansborgControls = JSON.parse(controlsBytes);
const a = christiansborgControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('aaa89c'),
    lower: lin('aaa596'),
    stone: lin('d5cdbb'),
    base: lin('aaa696'),
    roof: lin('748a80'),
    brown: lin('857572'),
    gold: lin('baa66b'),
    glass: lin('536975'),
    wood: lin('e6e5db'),
    door: lin('6b776e'),
  };
export const christiansborgSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_granite', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.65, metallic: 0.3 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 4, arch: 2, step: 30 },
  district: { flat: true, n: 6, arch: 3, step: 22 },
  street: { n: 8, arch: 3, step: 13 },
  closeup: { detail: true, n: 12, arch: 6, step: 7 },
  master: { detail: true, fine: true, n: 32, arch: 18, step: 3.8 },
};
const lowKind = (b) => ['low', 'arcade', 'hall'].includes(b.kind),
  baseY = (b, p) =>
    lowKind(b)
      ? a.lowFloorY + (a.floorY - a.lowFloorY) * Math.max(0, Math.min(1, (25 - p[1]) / 85))
      : a.floorY;
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
    if (!h.door) {
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
function visibleFaces(b, c) {
  const faces = [];
  for (const rs of b.polygons)
    for (const [ri, raw] of rs.entries()) {
      const r = ri ? cw(raw, c.far ? 1.1 : 0.006).reverse() : cw(raw, c.far ? 1.1 : 0.006);
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
        const baseA = baseY(b, A),
          baseB = baseY(b, B),
          lo = other ? a.floorY + other : Math.max(baseA, baseB);
        faces.push({ ...v, A, B, lo, hi: a.floorY + b.eave, baseA, baseB, free: !other });
      }
    }
  return faces;
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
function foundation(o, c) {
  if (c.far) return;
  for (const rs of a.foundationPolygons) {
    for (const [ri, raw] of rs.entries()) {
      const r = ri ? cw(raw).reverse() : cw(raw);
      for (let i = 0; i < r.length; i++) {
        const A = r[i],
          B = r[(i + 1) % r.length],
          b = (p) =>
            p[1] < -40
              ? a.floorY
              : a.lowFloorY + (a.floorY - a.lowFloorY) * Math.max(0, Math.min(1, (25 - p[1]) / 85));
        Q(
          o,
          c,
          [
            [A[0], a.foundationY, A[1]],
            [B[0], a.foundationY, B[1]],
            [B[0], b(B), B[1]],
            [A[0], b(A), A[1]],
          ],
          'base',
          C.base,
        );
      }
    }
    cap(
      o,
      c,
      rs,
      (p) =>
        p[1] < -40
          ? a.floorY
          : a.lowFloorY + (a.floorY - a.lowFloorY) * Math.max(0, Math.min(1, (25 - p[1]) / 85)),
      'base',
      C.base,
    );
  }
}
function facades(o, c) {
  for (const b of a.bodies)
    for (const v of visibleFaces(b, c)) {
      const { F, L, N } = v,
        base = v.lo,
        lo = c.far && v.free ? a.foundationY : base,
        low = lowKind(b),
        tower = b.kind === 'tower',
        hi = v.hi + (c.far && low ? b.rise : 0),
        mid = [(v.A[0] + v.B[0]) / 2, (v.A[1] + v.B[1]) / 2],
        isPortal =
          Math.abs(v.N[1]) > 0.8 &&
          mid[1] > a.portal.from - 1 &&
          mid[1] < a.portal.to + 1 &&
          Math.min(v.A[0], v.B[0]) < a.portal.x - a.portal.width / 2 &&
          Math.max(v.A[0], v.B[0]) > a.portal.x + a.portal.width / 2,
        portalU = (a.portal.x - v.A[0]) / v.U[0],
        portalHole = isPortal
          ? {
              u: portalU,
              width: a.portal.width,
              lo: c.far ? lo : a.floorY,
              hi: a.portal.hi,
              shape: 'arch',
              through: true,
            }
          : null;
      if (c.far) {
        faceBand(o, c, F, L, lo, hi, portalHole ? [portalHole] : [], C.wall);
        continue;
      }
      if (v.free && base > Math.min(v.baseA, v.baseB) + 1e-6)
        Q(
          o,
          c,
          [[v.A[0], v.baseA, v.A[1]], [v.B[0], v.baseB, v.B[1]], F(L, base), F(0, base)],
          'wall',
          C.wall,
        );
      const lowFloor = Math.max(v.baseA, v.baseB),
        bands = low
          ? [[lo, hi]]
          : [
              [lo, Math.min(12, hi)],
              [Math.max(lo, 12), Math.min(20.5, hi)],
              [Math.max(lo, 20.5), hi],
            ].filter(([y, Y]) => Y > y + 0.01),
        count = L > (c.flat ? 8 : 3) ? (tower ? 1 : Math.max(1, Math.floor(L / c.step))) : 0,
        step = L / Math.max(1, count),
        innerArcade =
          b.kind === 'arcade' &&
          Math.hypot(mid[0] + v.N[0] * 5, mid[1] - 45 + v.N[1] * 5) <
            Math.hypot(mid[0], mid[1] - 45) - 1;
      for (const [y, Y] of bands) {
        const holes = [];
        if (portalHole && portalHole.lo >= y - 1e-7 && portalHole.hi <= Y) holes.push(portalHole);
        for (let j = 0; j < count; j++) {
          const u = (j + 0.5) * step,
            w = Math.min(low ? 2.8 : 2, step * 0.54);
          if (
            portalHole &&
            portalHole.lo >= y - 1e-7 &&
            portalHole.hi <= Y &&
            Math.abs(u - portalU) < a.portal.width / 2 + w / 2 + 0.35
          )
            continue;
          const add = (l, h, shape = 'rect', arcade = false) => {
            if (l >= y + 0.1 && h <= Y - 0.2)
              holes.push({ u, width: w, lo: l, hi: h, shape, arcade, depth: arcade ? 2.4 : 0.3 });
          };
          if (low) {
            if (b.kind === 'hall') {
              add(lowFloor + 2, lowFloor + 6.1, 'arch');
              add(lowFloor + 8.1, hi - 1.2);
            } else add(lowFloor + 0.45, Math.min(hi - 0.7, lowFloor + 5.7), 'arch', innerArcade);
          } else if (tower) {
            if (y < 12) add(a.floorY + 1.2, a.floorY + 3.3);
            else if (y < 20.5) add(13.1, 17.7);
            else {
              add(22.1, 26.7);
              add(33.5, 37.5, 'arch');
              add(44, 49, 'arch');
            }
          } else if (y < 12) {
            add(a.floorY + 1.1, a.floorY + 3.1);
            add(a.floorY + 5.4, 11.1);
          } else if (y < 20.5) add(13, 17.6);
          else add(22.1, Math.min(26.7, hi - 0.8));
        }
        faceBand(o, c, F, L, y, Y, holes, C.wall);
      }
      for (const [y, h] of [
        [lowFloor + 0.15, 0.2],
        [low ? hi - 0.4 : 11.5, 0.28],
        [low ? hi - 0.05 : 20, 0.25],
        [hi - 0.45, 0.35],
      ])
        if (y >= lo && y < hi && (!c.flat || y === hi - 0.45)) {
          if (c.detail) span(o, c, F(0, y, 0.12), F(L, y, 0.12), h, 0.35);
          else panel(o, c, F, 0, L, y, y + h, 0.05, 'stone', C.stone);
        }
      if (tower && c.detail)
        for (const y of [49.7, 50.7, 51.6])
          span(o, c, F(0, y, 0.35), F(L, y, 0.35), 0.4, 0.8, 'stone', C.lower);
      if (c.detail) {
        const n = Math.max(1, Math.floor(L / (low ? (c.fine ? 3.5 : 7) : c.fine ? 5 : 9)));
        for (let j = 0; j <= n; j++) {
          const u = (j * L) / n;
          if (innerArcade || !low) {
            panel(
              o,
              c,
              F,
              u - 0.17,
              u + 0.17,
              Math.max(lo, lowFloor + 0.2),
              hi - 0.5,
              0.08,
              'stone',
              C.lower,
            );
            if (c.fine)
              for (const d of [-0.12, 0.12])
                span(
                  o,
                  c,
                  F(u + d, Math.max(lo, lowFloor + 0.5), 0.13),
                  F(u + d, hi - 0.7, 0.13),
                  0.055,
                  0.07,
                  'stone',
                  C.stone,
                );
          }
        }
        if (c.fine && !low)
          for (let y = lowFloor + 0.6; y < Math.min(11, hi); y += 0.7)
            if (y > lo) panel(o, c, F, 0, L, y, y + 0.035, 0.02, 'stone', C.lower);
      }
    }
}
function roofs(o, c) {
  for (const r of a.roofs) {
    const y = (p) =>
      a.floorY + r.eave + r.rise * Math.max(0, Math.min(1, roofDistance(r, p) / r.hipWidth));
    if (c.far && ['arcade', 'low'].includes(r.kind)) {
      for (const rs of r.polygons) cap(o, c, rs, a.floorY + r.eave + r.rise, 'copper', C.roof);
      continue;
    }
    for (const cell of r.cells) for (const rs of cell.polygons) cap(o, c, rs, y, 'copper', C.roof);
    if (c.far) continue;
    if (r.kind === 'main' || r.kind === 'hall')
      for (const rs of r.polygons)
        for (const raw of rs) {
          const ring = cw(raw);
          for (let i = 0; i < ring.length; i++) {
            const { F, L } = face(ring[i], ring[(i + 1) % ring.length]);
            if (L < 8) continue;
            const n = Math.max(1, Math.floor(L / (c.fine ? 6 : c.detail ? 8 : c.flat ? 25 : 13))),
              D = Math.min(2.1, r.hipWidth * 0.2);
            for (let j = 0; j < n; j++) {
              const u = ((j + 0.5) * L) / n,
                p = F(u, 0, -D),
                Y = y([p[0], p[2]]),
                f = (u, h, d = 0) => F(u, h, -D + d);
              if (Y < a.floorY + r.eave + 0.6) continue;
              const w = c.flat ? 0.65 : 0.85;
              panel(o, c, f, u - w, u + w, Y - 0.1, Y + 1.4, 0.1, 'copper', C.brown);
              panel(o, c, f, u - w * 0.7, u + w * 0.7, Y + 0.15, Y + 1.15, 0.13, 'glass', C.glass);
              const curveN = c.fine ? 14 : c.detail ? 6 : 2;
              for (let k = 0; k < curveN; k++) {
                const point = (j) => {
                  const t = (j / curveN) * Math.PI;
                  return f(u + Math.cos(t) * (w + 0.15), Y + 1.2 + Math.sin(t) * 0.55, 0.16);
                };
                T(o, c, [f(u, Y + 1.2, 0.16), point(k), point(k + 1)], 'copper', C.brown);
                if (c.detail) {
                  const A = point(k),
                    B = point(k + 1);
                  const P0 = f(
                      u + Math.cos((k / curveN) * Math.PI) * (w + 0.15),
                      Y + 1.2 + Math.sin((k / curveN) * Math.PI) * 0.55,
                      -1.2,
                    ),
                    P1 = f(
                      u + Math.cos(((k + 1) / curveN) * Math.PI) * (w + 0.15),
                      Y + 1.2 + Math.sin(((k + 1) / curveN) * Math.PI) * 0.55,
                      -1.2,
                    );
                  Q(o, c, [A, B, P1, P0], 'copper', C.brown);
                }
              }
              if (c.detail) {
                span(o, c, f(u - w, Y), f(u - w, Y + 1.2), 0.11, 0.14, 'wood', C.wood);
                span(o, c, f(u + w, Y), f(u + w, Y + 1.2), 0.11, 0.14, 'wood', C.wood);
                span(o, c, f(u, Y + 0.15, 0.15), f(u, Y + 1.15, 0.15), 0.06, 0.09, 'wood', C.wood);
              }
            }
          }
        }
  }
  if (!c.far)
    for (const [qi, q] of a.chimneys.entries()) {
      if (c.flat && qi % 2) continue;
      const [x, z] = q.center,
        r = a.roofs.find((r) => inPs(r.polygons, q.center));
      if (!r) continue;
      const h =
          a.floorY +
          r.eave +
          r.rise * Math.max(0, Math.min(1, roofDistance(r, q.center) / r.hipWidth)),
        w = q.width / 2,
        d = q.depth / 2;
      box(o, c, x - w, z - d, x + w, z + d, h - 0.1, 39.45, 'wall', C.wall);
      if (!c.flat)
        box(
          o,
          c,
          x - w - 0.12,
          z - d - 0.12,
          x + w + 0.12,
          z + d + 0.12,
          39.3,
          39.6,
          'stone',
          C.lower,
        );
    }
}
function portalVault(o, c) {
  const { x, width, hi, from, to } = a.portal,
    r = width / 2,
    spring = hi - r,
    n = c.far ? 2 : c.flat ? 3 : c.arch * 2;
  for (let j = 0; j < n; j++) {
    const A = (j / n) * Math.PI,
      B = ((j + 1) / n) * Math.PI,
      p = (t, z) => [x + r * Math.cos(t), spring + r * Math.sin(t), z];
    Q(o, c, [p(A, from), p(B, from), p(B, to), p(A, to)], 'stone', C.stone, [
      -Math.cos((A + B) / 2),
      -Math.sin((A + B) / 2),
      0,
    ]);
  }
  for (const sign of [-1, 1])
    Q(
      o,
      c,
      [
        [x + sign * r, a.foundationY, from],
        [x + sign * r, a.foundationY, to],
        [x + sign * r, spring, to],
        [x + sign * r, spring, from],
      ],
      'stone',
      C.stone,
      [-sign, 0, 0],
    );
}
function hollowStage(o, c, lo, hi, w, archLo, archHi) {
  const [x, z] = a.tower.center,
    ring = [
      [x - w / 2, z - w / 2],
      [x - w / 2, z + w / 2],
      [x + w / 2, z + w / 2],
      [x + w / 2, z - w / 2],
    ],
    thick = c.far ? 0.6 : 0.75;
  for (let i = 0; i < 4; i++) {
    const v = face(ring[i], ring[(i + 1) % 4]),
      h = { u: v.L / 2, width: w * 0.48, lo: archLo, hi: archHi, shape: 'arch', through: true },
      cc = c.flat ? { ...c, flat: false } : c;
    faceBand(o, cc, v.F, v.L, lo, hi, [h], C.brown);
    const back = (u, y, d = 0) => v.F(v.L - u, y, -thick - d);
    faceBand(o, cc, back, v.L, lo, hi, [{ ...h, u: v.L / 2 }], C.brown);
    const ps = profile(h, cc);
    for (let j = 0; j < ps.length; j++) {
      const A = ps[j],
        B = ps[(j + 1) % ps.length],
        dx = B[0] - A[0],
        dy = B[1] - A[1];
      Q(
        o,
        c,
        [v.F(...A), v.F(...B), v.F(B[0], B[1], -thick), v.F(A[0], A[1], -thick)],
        'copper',
        C.brown,
        [...sub(v.F(A[0] + dy, A[1] - dx), v.F(...A))],
      );
    }
    if (!c.far) {
      for (const y of [lo + 0.1, hi - 0.5])
        span(
          o,
          c,
          v.F(0, y, 0.12),
          v.F(v.L, y, 0.12),
          c.flat ? 0.2 : 0.45,
          0.45,
          'copper',
          C.brown,
        );
      if (c.detail)
        for (const u of [0.65, v.L - 0.65])
          span(o, c, v.F(u, lo + 0.5, 0.15), v.F(u, hi - 0.7, 0.15), 0.28, 0.35, 'copper', C.brown);
      const n = c.fine ? 9 : c.detail ? 5 : 2;
      span(
        o,
        c,
        v.F(v.L / 2 - w * 0.24, archLo + 0.15),
        v.F(v.L / 2 + w * 0.24, archLo + 0.15),
        0.13,
        0.15,
        'copper',
        C.brown,
      );
      for (let j = 0; j <= n; j++) {
        const u = v.L / 2 + w * 0.48 * (j / n - 0.5);
        span(o, c, v.F(u, archLo - 0.7), v.F(u, archLo + 0.1), 0.09, 0.1, 'copper', C.brown);
      }
    }
  }
  const rs = [ring];
  cap(o, c, rs, lo, 'copper', C.brown);
  cap(o, c, rs, hi, 'copper', C.brown, false);
}
function ringLoft(o, c, profile, n = c.n, color = C.brown) {
  loft(
    o,
    S(c, 'copper'),
    profile.map(([y, rx, rz = rx]) => radialRing(y, rx, rz, n, a.tower.center, Math.PI / 4)),
    color,
  );
}
function upperTower(o, c) {
  const [x, z] = a.tower.center;
  hollowStage(o, c, 51.2, 72.5, 15.65, 55.6, 68.8);
  ringLoft(
    o,
    c,
    [
      [72.3, 9.2],
      [73, 9.2],
      [74, 8.8],
      [75.5, 7.1],
      [77, 6.1],
      [78.4, 6],
      [79.5, 6.2],
      [81, 6.2],
      [82.5, 5.7],
      [83.4, 4.9],
      [84.9, 4.1],
    ],
    c.far ? 4 : 8,
  );
  const R = 3.4,
    n = c.far ? 4 : 8;
  for (let i = 0; i < n; i++) {
    const t = (i / n + 0.125) * Math.PI * 2,
      p = [x + Math.cos(t) * R, z + Math.sin(t) * R],
      r = c.far ? 0.35 : 0.32;
    loft(
      o,
      S(c, 'copper'),
      [
        radialRing(84.8, r, r, c.far ? 4 : c.flat ? 4 : c.n, p),
        radialRing(91.9, r * 0.85, r * 0.85, c.far ? 4 : c.flat ? 4 : c.n, p),
      ],
      C.brown,
      { cap: false },
    );
  }
  ringLoft(
    o,
    c,
    [
      [84.6, 4],
      [85, 4],
      [85.2, 3.5],
    ],
    c.far ? 4 : 8,
  );
  ringLoft(
    o,
    c,
    [
      [91.8, 3.7],
      [92.1, 4],
      [92.9, 3.2],
      [93.4, 2.6],
    ],
    c.far ? 4 : c.n,
  );
  if (!c.far)
    for (let i = 0; i < 3; i++) {
      const t = (i / 3) * Math.PI * 2,
        p = [x + Math.cos(t) * 2.1, z + Math.sin(t) * 2.1];
      loft(
        o,
        'copper',
        [
          [92.8, 0.35],
          [93.25, 0.65],
          [93.8, 0.65],
          [94.2, 0.25],
        ].map(([y, r]) => radialRing(y, r, r, c.n, p)),
        C.gold,
      );
    }
  ringLoft(
    o,
    c,
    [
      [93.1, 0.55],
      [96.5, 0.38],
      [100.5, 0.25],
      [105.3, 0.06],
    ],
    c.far ? 4 : c.n,
    C.roof,
  );
  for (const [y, r] of [
    [95.4, 1.65],
    [98.8, 1.2],
    [101.8, 0.85],
  ]) {
    if (c.far || c.flat) {
      ringLoft(
        o,
        c,
        [
          [y, r * 0.45],
          [y + 0.55, r],
          [y + 1, r * 0.4],
        ],
        c.far ? 4 : 6,
        C.roof,
      );
      continue;
    }
    const n = c.fine ? 18 : 9;
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2,
        T = ((i + 1) / n) * Math.PI * 2,
        p = (angle, h, R) => [x + Math.cos(angle) * R, h, z + Math.sin(angle) * R];
      span(o, c, p(t, y, r * 0.45), p((t + T) / 2, y + 0.85, r), 0.09, 0.13, 'copper', C.roof);
      span(o, c, p((t + T) / 2, y + 0.85, r), p(T, y, r * 0.45), 0.09, 0.13, 'copper', C.roof);
    }
    ringLoft(
      o,
      c,
      [
        [y - 0.1, r * 0.5],
        [y + 0.1, r * 0.5],
      ],
      c.n,
      C.roof,
    );
  }
  if (!c.far) {
    Q(
      o,
      c,
      [
        [x, 103.6, z],
        [x + 1.9, 104.4, z],
        [x + 0.3, 104.9, z],
        [x, 104.7, z],
      ],
      'copper',
      C.roof,
      [0, 0, 1],
    );
    if (c.detail) {
      span(o, c, [x, 104.7, z - 0.05], [x, 105.3, z - 0.05], 0.09, 0.1, 'copper', C.roof);
      for (const s of [-1, 1])
        span(
          o,
          c,
          [x + s * 0.5, 104.75, z],
          [x + s * 0.5, 105.15, z],
          0.06,
          0.08,
          'copper',
          C.roof,
        );
    }
  }
}
function entries(o, c) {
  for (const e of a.entries) {
    const F = (u, y, d = 0) => [e.center[0] + u, y, e.center[1] + e.N[1] * d],
      profile = e.outerProfile.filter((_, i) => i % (c.fine ? 1 : c.far || c.flat ? 4 : 2) === 0),
      n = profile.length - 1,
      w = e.width / 2,
      D = e.approachDistance;
    for (let j = 0; j < n; j++) {
      const u = -w + (e.width * j) / n,
        U = -w + (e.width * (j + 1)) / n,
        h = profile[j],
        H = profile[j + 1];
      Q(
        o,
        c,
        [F(u, e.thresholdY, 0), F(U, e.thresholdY, 0), F(U, H, D), F(u, h, D)],
        'base',
        C.base,
        [0, 1, 0],
      );
      if (j === 0 || j === n - 1) {
        const q = j === 0 ? u : U,
          Y = j === 0 ? h : H;
        Q(
          o,
          c,
          [F(q, a.foundationY, 0), F(q, a.foundationY, D), F(q, Y, D), F(q, e.thresholdY, 0)],
          'base',
          C.base,
        );
      }
      Q(o, c, [F(u, h - 0.2, D), F(U, H - 0.2, D), F(U, H, D), F(u, h, D)], 'base', C.base);
    }
  }
}
export function buildChristiansborgLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Christiansborg tier ' + level);
  const o = safe(output);
  foundation(o, c);
  facades(o, c);
  roofs(o, c);
  portalVault(o, c);
  upperTower(o, c);
  entries(o, c);
}
export const buildChristiansborgSkyline = (o) => buildChristiansborgLevel(o, 'skyline'),
  buildChristiansborgDistrict = (o) => buildChristiansborgLevel(o, 'district'),
  buildChristiansborgStreet = (o) => buildChristiansborgLevel(o, 'street'),
  buildChristiansborgCloseup = (o) => buildChristiansborgLevel(o, 'closeup');

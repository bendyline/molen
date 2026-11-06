/** Original complete Palais Bourbon exterior, including all three native courts. */
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
  '9044d49db06a143c2f77019e8afd7148db069715b4a890edfc6c2d6bfa698a1c'
)
  throw Error('Palais Bourbon controls changed: update explicit geometry input pin');
export const bourbonControls = JSON.parse(controlsBytes);
const a = bourbonControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('dfd6c4'),
    lower: lin('d8ceb8'),
    stone: lin('eee6d4'),
    base: lin('b6af9e'),
    roof: lin('759381'),
    slate: lin('5b646b'),
    glass: lin('516873'),
    wood: lin('6d7872'),
  };
export const bourbonSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.85, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.65, metallic: 0.3 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 4, arch: 2, step: 30 },
  district: { flat: true, n: 6, arch: 3, step: 8 },
  street: { n: 6, arch: 4, step: 6 },
  closeup: { detail: true, n: 10, arch: 6, step: 5 },
  master: { detail: true, fine: true, n: 32, arch: 18, step: 4 },
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
function facades(o, c) {
  for (const b of a.bodies)
    for (const v of visibleFaces(b, c)) {
      const { F, L, lo, hi, N } = v,
        north = b.name === 'north-pediment-back-range',
        low = hi < 12,
        main = b.name === 'court-entry-main-hall',
        count = L > 3 ? Math.max(1, Math.floor(L / c.step)) : 0,
        step = L / Math.max(1, count),
        split = low ? hi : Math.min(hi - 1, a.floorY + 5.6),
        bands =
          split < hi - 0.2
            ? [
                [lo, split],
                [split, hi],
              ]
            : [[lo, hi]];
      if (north && N[1] > 0.8) {
        const holes = [];
        for (let j = 0; j < 5; j++)
          holes.push({
            u: (L * (j + 0.5)) / 5,
            width: 1.9,
            lo: 4.6,
            hi: 8.3,
            shape: 'rect',
            door: true,
            depth: 0.42,
          });
        faceBand(o, c, F, L, lo, hi, holes, C.wall);
        if (c.detail) {
          for (let j = 0; j < 5; j++) {
            const u = (L * (j + 0.5)) / 5;
            panel(o, c, F, u - 1.5, u + 1.5, 13.3, 14.6, 0.04, 'stone', C.lower);
          }
        }
        continue;
      }
      for (const [y, Y] of bands) {
        const holes = [];
        for (let j = 0; j < count; j++) {
          const u = (j + 0.5) * step,
            w = Math.min(main || low ? 2.2 : 1.55, step * 0.5),
            lower = y < split + 0.001,
            l = low ? Math.max(lo + 0.6, a.floorY + 1.4) : lower ? a.floorY + 2.2 : split + 0.65,
            h = low ? hi - 0.8 : lower ? Math.min(split - 0.45, l + 2.7) : hi - 0.85;
          if (h - l > 1 && l >= y + 0.05)
            holes.push({
              u,
              width: w,
              lo: l,
              hi: h,
              shape: low || main ? 'arch' : 'rect',
              depth: 0.32,
            });
        }
        faceBand(o, c, F, L, y, Y, holes, C.wall);
      }
      for (const [y, h] of [
        [a.floorY + 0.15, 0.2],
        [split - 0.15, 0.26],
        [hi - 0.45, 0.27],
      ])
        if (y >= lo && y <= hi) {
          if (c.detail) span(o, c, F(0, y, 0.1), F(L, y, 0.1), h, 0.35);
          else panel(o, c, F, 0, L, y, y + h, 0.04, 'stone', C.stone);
        }
      if (c.detail && L > 4) {
        const n = Math.max(1, Math.floor(L / (c.fine ? 3 : 6)));
        for (let j = 0; j <= n; j++) {
          const u = (L * j) / n;
          if (low || main) {
            span(
              o,
              c,
              F(u, Math.max(lo + 0.2, a.floorY + 0.3), 0.18),
              F(u, hi - 0.7, 0.18),
              0.3,
              0.33,
            );
            span(o, c, F(u - 0.27, hi - 0.65, 0.18), F(u + 0.27, hi - 0.65, 0.18), 0.2, 0.5);
          } else {
            panel(
              o,
              c,
              F,
              u - 0.15,
              u + 0.15,
              Math.max(lo, a.floorY + 0.4),
              hi - 0.4,
              0.06,
              'stone',
              C.stone,
            );
          }
        }
        if (low || main) {
          span(o, c, F(0, hi + 0.18, 0.04), F(L, hi + 0.18, 0.04), 0.17, 0.2);
          span(o, c, F(0, hi + 0.85, 0.04), F(L, hi + 0.85, 0.04), 0.2, 0.24);
          const k = Math.max(1, Math.floor(L / (c.fine ? 0.9 : 2.2)));
          for (let j = 0; j <= k; j++)
            span(o, c, F((j * L) / k, hi + 0.2, 0.04), F((j * L) / k, hi + 0.8, 0.04), 0.1, 0.12);
        }
      }
    }
}
function roofs(o, c) {
  for (const r of a.roofs) {
    const y = (p) => {
      const t = Math.max(0, Math.min(1, roofDistance(r, p) / r.hipWidth)),
        f = r.kind === 'mansard' ? (t < 0.3 ? t * 2.4 : 0.72 + (t - 0.3) * 0.4) : t;
      return a.floorY + r.eave + r.rise * f;
    };
    for (const cell of r.cells)
      for (const rs of cell.polygons) {
        cap(o, c, rs, y, 'copper', C.roof);
      }
    if (!c.far) {
      for (const rs of r.polygons)
        for (const raw of rs) {
          const q = cw(raw);
          for (let i = 0; i < q.length; i++) {
            const v = face(q[i], q[(i + 1) % q.length]),
              { F, L } = v;
            if (L < 5) continue;
            if (r.kind === 'mansard') {
              const D = Math.min(1.8, r.hipWidth * 0.22),
                n = Math.max(1, Math.floor(L / (c.fine ? 4.5 : c.detail ? 6 : 14)));
              for (let j = 0; j < n; j++) {
                const u = ((j + 0.5) * L) / n,
                  p = F(u, 0, -D),
                  h = y([p[0], p[2]]);
                if (h < a.floorY + r.eave + 0.5) continue;
                const f = (u, y, d = 0) => F(u, y, -D + d),
                  w = c.flat ? 0.55 : 0.7,
                  Y = h + 0.65;
                panel(o, c, f, u - w, u + w, h - 0.15, Y, 0.04, 'wall', C.wall);
                panel(o, c, f, u - w * 0.7, u + w * 0.7, h, Y - 0.1, 0.06, 'glass', C.glass);
                T(o, c, [f(u - w - 0.1, Y), f(u + w + 0.1, Y), f(u, Y + 0.5)], 'roof', C.slate);
                if (c.detail) {
                  span(o, c, f(u - w, Y), f(u + w, Y), 0.1, 0.16);
                  for (const sign of [-1, 1])
                    span(o, c, f(u + sign * w, h - 0.12), f(u + sign * w, Y), 0.1, 0.16);
                }
              }
            }
            if (c.detail && r.kind === 'mansard')
              span(
                o,
                c,
                F(0, a.floorY + r.eave + 0.14, -0.12),
                F(L, a.floorY + r.eave + 0.14, -0.12),
                0.32,
                0.3,
                'roof',
                C.slate,
              );
          }
        }
    }
  }
  // The curved chamber carries a low polygonal roof whose boundary follows the native drum.
  const b = a.bodies.find((b) => b.name === 'chamber-rounded-drum');
  for (const rs of b.polygons) {
    const ring = cw(rs[0]),
      center = [-9.4, 57.5],
      lo = a.floorY + b.eave,
      top = lo + b.rise;
    for (let i = 0; i < ring.length; i++)
      T(
        o,
        c,
        [
          [ring[i][0], lo, ring[i][1]],
          [ring[(i + 1) % ring.length][0], lo, ring[(i + 1) % ring.length][1]],
          [center[0], top, center[1]],
        ],
        'copper',
        C.roof,
        [0, 1, 0],
      );
    if (!c.far) {
      const R = 2.6,
        n = c.fine ? 32 : c.detail ? 12 : 6;
      loft(
        o,
        'copper',
        [
          radialRing(top - 0.3, R, R, n, center),
          radialRing(top + 0.6, R * 0.7, R * 0.7, n, center),
        ],
        C.roof,
      );
      if (c.detail)
        for (let i = 0; i < ring.length; i++)
          span(
            o,
            c,
            [ring[i][0], lo + 0.03, ring[i][1]],
            [center[0], top + 0.03, center[1]],
            0.05,
            0.07,
            'copper',
            C.roof,
          );
    }
  }
}
function porticoFrame(p) {
  const { L, U, N, center } = p.frame;
  return {
    L,
    U,
    N,
    center,
    F: (u, y, d = 0) => [center[0] + U[0] * u + N[0] * d, y, center[1] + U[1] * u + N[1] * d],
  };
}
function column(o, c, p, control) {
  const [x, z] = control.center,
    r = control.radius,
    n = c.n,
    lo = p.deckY,
    hi = p.entablatureY - 0.9,
    profile = c.far
      ? [
          [lo, r],
          [hi, r],
        ]
      : c.flat
        ? [
            [lo, r],
            [hi, r * 0.84],
          ]
        : [
            [lo, r * 1.2],
            [lo + 0.2, r * 1.3],
            [lo + 0.45, r],
            [hi - 1, r * 0.82],
            [hi - 0.75, r * 0.9],
            [hi - 0.25, r * 1.35],
            [hi, r * 1.4],
          ];
  loft(
    o,
    S(c, 'stone'),
    profile.map(([y, R]) => radialRing(y, R, R, n, [x, z])),
    C.stone,
    { cap: false },
  );
  if (c.detail) {
    for (const y of [lo + 0.1, hi - 0.2])
      box(
        o,
        c,
        x - r * 1.4,
        z - r * 1.4,
        x + r * 1.4,
        z + r * 1.4,
        y - 0.1,
        y + 0.12,
        'stone',
        C.stone,
      );
    if (c.fine) {
      for (let i = 0; i < 16; i++) {
        const t = (i / 16) * Math.PI * 2,
          R = r * 0.985;
        span(
          o,
          c,
          [x + Math.cos(t) * R, lo + 0.7, z + Math.sin(t) * R],
          [x + Math.cos(t) * R * 0.84, hi - 1.1, z + Math.sin(t) * R * 0.84],
          0.035,
          0.04,
          'stone',
          C.lower,
        );
      }
      for (let i = 0; i < 8; i++) {
        const t = (i / 8) * Math.PI * 2;
        loft(
          o,
          'stone',
          [
            [hi - 0.7, 0.75],
            [hi - 0.4, 1.35],
            [hi - 0.2, 1.05],
          ].map(([y, k]) =>
            radialRing(y, r * 0.25 * k, r * 0.25 * k, 8, [
              x + Math.cos(t) * r,
              z + Math.sin(t) * r,
            ]),
          ),
          C.stone,
        );
      }
    }
  }
}
function porticos(o, c) {
  for (const p of a.porticos) {
    const { F, L } = porticoFrame(p),
      W = p.name === 'seine-twelve-column-portico' ? 41.3 : L + 3.5,
      D = p.name === 'seine-twelve-column-portico' ? 14.1 : p.pediment ? 6.3 : 4.6,
      front = p.name === 'seine-twelve-column-portico' ? 1.3 : 1.1,
      ring = [
        [F(-W / 2, 0, front), F(W / 2, 0, front), F(W / 2, 0, -D), F(-W / 2, 0, -D)].map((q) => [
          q[0],
          q[2],
        ]),
      ];
    for (const rs of p.platformPolygons ?? p.polygons)
      prism(o, c, rs, a.floorY, p.deckY, 'base', C.base);
    for (const q of p.columnControls) column(o, c, p, q);
    for (const rs of p.pediment ? ring.map((r) => [r]) : p.polygons)
      prism(o, c, rs, p.entablatureY - 0.9, p.entablatureY, 'stone', C.stone);
    if (p.pediment) {
      const lo = p.entablatureY,
        top = p.topY,
        frontPts = [F(-W / 2, lo, front), F(W / 2, lo, front), F(0, top, front)],
        backPts = [F(-W / 2, lo, -D), F(W / 2, lo, -D), F(0, top, -D)];
      T(o, c, frontPts, 'stone', C.stone, sub(F(0, 0, 1), F(0, 0, 0)));
      T(o, c, backPts, 'stone', C.stone, sub(F(0, 0, 0), F(0, 0, 1)));
      for (let i = 0; i < 3; i++)
        Q(
          o,
          c,
          [frontPts[i], frontPts[(i + 1) % 3], backPts[(i + 1) % 3], backPts[i]],
          i === 2 ? 'stone' : 'copper',
          i === 2 ? C.stone : C.roof,
        );
      if (!c.far) {
        for (let i = 0; i < 2; i++) span(o, c, frontPts[i], frontPts[2], 0.25, 0.35);
        span(o, c, frontPts[0], frontPts[1], 0.3, 0.4);
        if (c.detail) {
          const n = c.fine ? Math.round(W / 0.6) : Math.round(W / 1.8);
          for (let j = 0; j <= n; j++) {
            const u = W * (j / n - 0.5);
            span(o, c, F(u, lo - 0.5, front + 0.08), F(u, lo - 0.2, front + 0.08), 0.16, 0.25);
          }
          for (const sign of [-1, 1]) {
            const n = c.fine ? 24 : 8;
            for (let j = 1; j < n; j++) {
              const t = j / n,
                y = lo + (top - lo) * t,
                u = ((sign * W) / 2) * (1 - t);
              span(o, c, F(u, y, front + 0.09), F(u, y + 0.12, front + 0.09), 0.15, 0.24);
            }
          }
        }
      }
    }
    if (!c.far && p.name !== 'seine-twelve-column-portico') {
      const f = (u, y, d = 0) => F(u - w / 2, y, -D + 0.15 + d),
        w = Math.min(W - 1, 13);
      faceBand(
        o,
        c,
        f,
        w,
        p.deckY,
        p.entablatureY - 0.95,
        [
          {
            u: w / 2,
            width: 2.6,
            lo: p.deckY + 0.06,
            hi: Math.min(p.entablatureY - 1.3, p.deckY + 6.9),
            shape: 'rect',
            door: true,
            depth: 0.35,
          },
        ],
        C.wall,
      );
    }
  }
}
function entries(o, c) {
  for (const e of a.entries) {
    const F = (u, y, d = 0) => [
        e.center[0] + e.U[0] * u + e.N[0] * d,
        y,
        e.center[1] + e.U[1] * u + e.N[1] * d,
      ],
      n = c.far
        ? 1
        : c.flat
          ? 5
          : c.detail
            ? Math.max(3, Math.round((e.thresholdY - Math.min(...e.outerProfile)) / 0.22))
            : 10,
      w = e.width / 2,
      D = e.approachDistance,
      stride = c.far || c.flat ? 4 : c.fine ? 1 : 2,
      profile = e.outerProfile.filter((_, i) => i % stride === 0),
      segments = profile.length - 1;
    for (let k = 0; k < segments; k++) {
      const u0 = -w + (e.width * k) / segments,
        u1 = -w + (e.width * (k + 1)) / segments,
        h0 = profile[k],
        h1 = profile[k + 1];
      for (let j = 0; j < n; j++) {
        const d0 = (D * j) / n,
          d1 = (D * (j + 1)) / n,
          t = (j + 1) / n,
          y0 = e.thresholdY + (h0 - e.thresholdY) * t,
          y1 = e.thresholdY + (h1 - e.thresholdY) * t;
        if (c.far)
          Q(
            o,
            c,
            [F(u0, e.thresholdY, 0), F(u1, e.thresholdY, 0), F(u1, h1, D), F(u0, h0, D)],
            'base',
            C.base,
            [0, 1, 0],
          );
        else {
          Q(
            o,
            c,
            [F(u0, y0, d0), F(u1, y1, d0), F(u1, y1, d1), F(u0, y0, d1)],
            'base',
            C.base,
            [0, 1, 0],
          );
          const previous0 = e.thresholdY + ((h0 - e.thresholdY) * j) / n,
            previous1 = e.thresholdY + ((h1 - e.thresholdY) * j) / n;
          Q(
            o,
            c,
            [F(u0, y0, d0), F(u1, y1, d0), F(u1, previous1, d0), F(u0, previous0, d0)],
            'base',
            C.base,
          );
        }
        if (k === 0)
          Q(
            o,
            c,
            [
              F(u0, a.foundationY, d0),
              F(u0, a.foundationY, d1),
              F(u0, c.far ? h0 : y0, d1),
              F(u0, c.far ? e.thresholdY : y0, d0),
            ],
            'base',
            C.base,
          );
        if (k === segments - 1)
          Q(
            o,
            c,
            [
              F(u1, a.foundationY, d0),
              F(u1, a.foundationY, d1),
              F(u1, c.far ? h1 : y1, d1),
              F(u1, c.far ? e.thresholdY : y1, d0),
            ],
            'base',
            C.base,
          );
      }
      Q(
        o,
        c,
        [F(u0, h0 - 0.25, D), F(u1, h1 - 0.25, D), F(u1, h1, D), F(u0, h0, D)],
        'base',
        C.base,
      );
    }
  }
}
function simpleRanges(o, c) {
  for (const rs of a.skylinePolygons) {
    if (c.far) prism(o, c, rs, a.foundationY, 14.8, 'wall', C.wall);
    else {
      for (const [ri, raw] of rs.entries()) {
        const r = ri ? cw(raw, 0.2).reverse() : cw(raw, 0.2);
        for (let i = 0; i < r.length; i++) {
          const { F, L } = face(r[i], r[(i + 1) % r.length]);
          panel(o, c, F, 0, L, a.floorY, 11.6, 0, 'wall', C.wall);
          const n = L > 3 ? Math.max(1, Math.floor(L / 8)) : 0,
            step = L / Math.max(n, 1);
          for (let j = 0; j < n; j++)
            for (const [y, Y] of [
              [4.9, 7.6],
              [9.1, 10.7],
            ])
              panel(
                o,
                c,
                F,
                (j + 0.5) * step - 0.75,
                (j + 0.5) * step + 0.75,
                y,
                Y,
                0.03,
                'glass',
                C.glass,
              );
          panel(o, c, F, 0, L, 11.3, 11.6, 0.03, 'stone', C.stone);
          panel(o, c, F, 0, L, 11.6, 14.8, 0, 'roof', C.slate);
        }
      }
      cap(o, c, rs, 14.8, 'copper', C.roof);
    }
  }
  for (const name of ['chamber-rounded-drum', ...(c.flat ? ['corner-pavilions'] : [])]) {
    const b = a.bodies.find((b) => b.name === name),
      hi = a.floorY + b.eave;
    for (const rs of b.polygons) {
      prism(o, c, rs, 14.8, hi, 'wall', C.wall);
      const ring = cw(rs[0]),
        center =
          name === 'chamber-rounded-drum'
            ? [-9.4, 57.5]
            : [
                ring.reduce((s, p) => s + p[0], 0) / ring.length,
                ring.reduce((s, p) => s + p[1], 0) / ring.length,
              ];
      for (let i = 0; i < ring.length; i++)
        T(
          o,
          c,
          [
            [ring[i][0], hi, ring[i][1]],
            [ring[(i + 1) % ring.length][0], hi, ring[(i + 1) % ring.length][1]],
            [center[0], hi + b.rise, center[1]],
          ],
          'copper',
          C.roof,
          [0, 1, 0],
        );
    }
  }
}
export function buildBourbonLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Palais Bourbon tier ' + level);
  const o = safe(output);
  if (!c.far)
    for (const rs of a.foundationPolygons)
      prism(o, c, rs, a.foundationY, a.floorY, 'base', C.base, true);
  if (c.far || c.flat) simpleRanges(o, c);
  else {
    facades(o, c);
    roofs(o, c);
  }
  porticos(o, c);
  entries(o, c);
}
export const buildBourbonSkyline = (o) => buildBourbonLevel(o, 'skyline'),
  buildBourbonDistrict = (o) => buildBourbonLevel(o, 'district'),
  buildBourbonStreet = (o) => buildBourbonLevel(o, 'street'),
  buildBourbonCloseup = (o) => buildBourbonLevel(o, 'closeup');

/** Original complete Dolmabahçe Palace exterior; signed connected waterfront/native return. */
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
  '292ff702fe6ede112788d22450786239912a7cd4c364859eee8fb98c30aa586a'
)
  throw Error('Dolmabahçe Palace controls changed: update explicit geometry input pin');
export const dolmabahceControls = JSON.parse(controlsBytes);
const a = dolmabahceControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('d9d3c4'),
    lower: lin('d0c8b6'),
    stone: lin('ede7d9'),
    base: lin('aaa493'),
    roof: lin('8b969a'),
    glass: lin('465c63'),
    wood: lin('675f52'),
  };
export const dolmabahceSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.84, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.72, metallic: 0.2 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0 },
};
const configs = {
  skyline: { far: true, n: 4, arch: 2, step: 30 },
  district: { flat: true, n: 6, arch: 3, step: 7 },
  street: { n: 6, arch: 4, step: 5.3 },
  closeup: { detail: true, n: 8, arch: 6, step: 4.8 },
  master: { detail: true, fine: true, n: 24, arch: 18, step: 3.6 },
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
function facades(o, c) {
  for (const b of a.bodies)
    for (const v of visibleFaces(b, c)) {
      const { F, L, lo, hi, N } = v,
        hall = b.name === 'ceremonial-hall',
        split = a.floorY + (hall ? 12.7 : 7.4),
        bands =
          split > lo + 0.01 && split < hi - 0.01
            ? [
                [lo, split, C.lower],
                [split, hi, C.wall],
              ]
            : [[lo, hi, C.wall]],
        entry = a.entries.find(
          (e) =>
            e.owner === b.name &&
            Math.hypot((v.A[0] + v.B[0]) / 2 - e.center[0], (v.A[1] + v.B[1]) / 2 - e.center[1]) <
              0.1,
        ),
        hallFront = hall && N[1] > 0.8 && L > 16;
      if (c.far) {
        panel(o, c, F, 0, L, lo, hi, 0, 'wall', C.wall);
        continue;
      }
      const rawCount =
          L > (c.detail ? 1.8 : 3.5)
            ? Math.max(1, Math.floor(L / (hall ? c.step * 1.15 : c.step)))
            : 0,
        count = entry ? Math.max(1, 2 * Math.floor(rawCount / 2) + 1) : rawCount,
        step = L / Math.max(1, count);
      for (const [y, Y, col] of bands) {
        const holes = [];
        for (let j = 0; j < count; j++) {
          const u = (j + 0.5) * step,
            w = Math.min(hall ? 2.65 : 1.9, step * 0.53),
            door =
              (entry && j === Math.floor(count / 2)) || (hallFront && j === Math.floor(count / 2)),
            lower = y < split,
            threshold = entry?.thresholdY ?? a.floorY + 0.15,
            low = lower
              ? door
                ? threshold
                : a.floorY + (hall ? 2.2 : 1.6)
              : a.floorY + (hall ? 15 : 9.1),
            high = lower ? (hall ? 10.4 : 6.1) : a.floorY + (hall ? 24.3 : 13.75);
          if (low >= y + 0.08 && high <= Y - 0.25)
            holes.push({
              u: entry && door ? L / 2 : u,
              width: door ? Math.min(entry?.width ?? 3.2, step * 0.7) : w,
              lo: low,
              hi: high,
              shape: hall || (!lower && j % 3 === 1) ? 'arch' : 'rect',
              door: lower && door,
              depth: hall ? 0.48 : 0.34,
            });
        }
        faceBand(o, c, F, L, y, Y, holes, col);
        if (c.detail) {
          for (const h of holes.filter((h) => h.lo > split)) {
            const W = h.width + 1.1,
              y = h.hi + 0.48,
              n = c.fine ? 8 : 2;
            for (let k = 0; k < n; k++) {
              const u0 = h.u + W * (k / n - 0.5),
                u1 = h.u + W * ((k + 1) / n - 0.5),
                f = (t) => y + Math.max(0, 1 - Math.abs(t - 0.5) * 2) * (hall ? 0.85 : 0.45);
              Q(
                o,
                c,
                [F(u0, y, 0.1), F(u1, y, 0.1), F(u1, f((k + 1) / n), 0.1), F(u0, f(k / n), 0.1)],
                'stone',
                C.stone,
              );
            }
            if (c.fine)
              for (const t of [-0.6, 0.6])
                ribbon(o, c, F, h.u + h.width * t, h.lo + 1, h.width * 0.3, 0.3);
          }
        }
      }
      for (const [y, h] of [
        [a.floorY + 0.2, 0.28],
        [split - 0.15, 0.3],
        [hi - 0.65, 0.26],
        [hi - 0.22, 0.32],
      ])
        if (y >= lo - 0.01) {
          if (c.detail) span(o, c, F(0, y, 0.14), F(L, y, 0.14), h, hall ? 0.55 : 0.38);
          else panel(o, c, F, 0, L, y, y + h, 0.08, 'stone', C.stone);
        }
      if (c.detail && L > 4) {
        const n = Math.max(1, Math.round(L / (hall ? step : step * 2)));
        for (let j = 0; j <= n; j++) {
          const u = (j * L) / n,
            w = hall ? 0.48 : 0.36,
            d = hall ? 0.36 : 0.2;
          for (const [y, Y] of [
            [Math.max(lo, a.floorY + 0.7), Math.min(hi, split - 0.35)],
            [Math.max(lo, split + 0.3), hi - 0.8],
          ])
            if (Y > y) {
              span(o, c, F(u, y, d), F(u, Y, d), w, d * 2);
              span(o, c, F(u - 0.25, y, 0.24), F(u + 0.25, y, 0.24), 0.2, 0.6);
              span(o, c, F(u - 0.34, Y, 0.24), F(u + 0.34, Y, 0.24), 0.25, 0.7);
              if (c.fine) {
                for (const t of [-0.15, 0.15])
                  span(o, c, F(u + t, y + 0.2, d + 0.03), F(u + t, Y - 0.2, d + 0.03), 0.055, 0.06);
                ribbon(o, c, F, u, Y - 0.2, 0.85, 0.35);
              }
            }
        }
        // Open upper balustrade: visible bars rather than an opaque block.
        span(o, c, F(0, hi + 0.2, 0.04), F(L, hi + 0.2, 0.04), 0.18, 0.25);
        span(o, c, F(0, hi + 1, 0.04), F(L, hi + 1, 0.04), 0.2, 0.28);
        const k = Math.max(1, Math.round(L / (c.fine ? 1.1 : 2.5)));
        for (let j = 0; j <= k; j++) {
          const u = (j * L) / k;
          span(o, c, F(u, hi + 0.2, 0.04), F(u, hi + 0.95, 0.04), 0.12, 0.14);
          if (hall && j % 3 === 0) finial(o, c, F(u, hi + 1.05, 0.04), 0.25);
        }
        if (c.fine)
          for (let y = a.floorY + 1; y < Math.min(split, hi); y += 0.6)
            if (y > lo) panel(o, c, F, 0, L, y, y + 0.035, 0.025, 'stone', C.lower);
      }
    }
}
function finial(o, c, p, r) {
  loft(
    o,
    S(c, 'stone'),
    [
      [0, 0.85],
      [0.18, 1],
      [0.48, 0.6],
      [0.8, 0.25],
      [1, 0.08],
    ].map(([y, k]) => radialRing(p[1] + y, r * k, r * k, c.n, [p[0], p[2]])),
    C.stone,
  );
}
function lantern(o, c, l) {
  const [x, z] = l.center,
    w = l.width / 2,
    d = l.depth / 2,
    lo = a.floorY + l.eave,
    hi = lo + l.rise,
    ring = [
      [
        [x - w, z - d],
        [x + w, z - d],
        [x + w, z + d],
        [x - w, z + d],
      ],
    ];
  prism(o, c, ring, lo - 0.9, lo, 'stone', C.stone);
  const ps = [
      [x - w, lo, z - d],
      [x + w, lo, z - d],
      [x + w, lo, z + d],
      [x - w, lo, z + d],
    ],
    ridge = [x, hi, z];
  for (let i = 0; i < 4; i++)
    T(
      o,
      c,
      [ps[i], ps[(i + 1) % 4], ridge],
      c.far ? 'roof' : 'glass',
      c.far ? C.roof : C.glass,
      [0, 1, 0],
    );
  if (!c.far) {
    for (let i = 0; i < 4; i++) span(o, c, ps[i], ps[(i + 1) % 4], 0.12, 0.14, 'roof', C.roof);
    for (let i = 0; i < 4; i++) {
      span(o, c, ps[i], ridge, 0.12, 0.14, 'roof', C.roof);
      if (c.detail) {
        const A = ps[i],
          B = ps[(i + 1) % 4],
          n = Math.round(Math.hypot(...sub(A, B)) / (c.fine ? 1 : 2.5));
        for (let j = 1; j < n; j++) {
          const t = j / n,
            P = A.map((v, k) => v + (B[k] - v) * t);
          span(o, c, P, ridge, 0.07, 0.1, 'roof', C.roof);
        }
      }
    }
  }
}
function frontStairs(o, c) {
  for (const rs of a.frontStair) {
    prism(o, c, rs, a.foundationY, a.floorY + 0.12, 'base', C.base);
    if (!c.far) {
      const r = cw(rs[0]);
      for (let i = 0; i < r.length; i++) {
        const v = face(r[i], r[(i + 1) % r.length]);
        if (v.L < 0.3) continue;
        for (let j = 0; j < (c.detail ? 4 : 2); j++)
          panel(
            o,
            c,
            v.F,
            0,
            v.L,
            a.floorY - 0.1 - j * 0.23,
            a.floorY + 0.03 - j * 0.23,
            -j * 0.25,
            'stone',
            C.stone,
          );
      }
    }
  }
}
function entries(o, c) {
  for (const e of a.entries) {
    const { F } = face(e.A, e.B),
      f = (u, y, d = 0) => F(u + e.L / 2, y, d),
      w = e.approachWidth / 2,
      D = e.approachDistance,
      inner = Math.min(a.floorY, e.thresholdY),
      n = c.far ? 1 : c.detail ? 5 : 2;
    for (let j = 0; j < n; j++) {
      const d0 = (D * 0.35 * j) / n,
        d1 = (D * 0.35 * (j + 1)) / n,
        hi = e.thresholdY - ((e.thresholdY - inner) * j) / n,
        ps = [f(-w, 0, d0), f(w, 0, d0), f(w, 0, d1), f(-w, 0, d1)].map((p) => [p[0], p[2]]);
      prism(o, c, [ps], a.foundationY, hi, 'base', C.base);
    }
    Q(
      o,
      c,
      [f(-w, inner, D * 0.35), f(w, inner, D * 0.35), f(w, e.outerY[1], D), f(-w, e.outerY[0], D)],
      'base',
      C.base,
      [0, 1, 0],
    );
    for (const sign of [-1, 1])
      Q(
        o,
        c,
        [
          f(sign * w, a.foundationY, D * 0.35),
          f(sign * w, a.foundationY, D),
          f(sign * w, e.outerY[sign > 0 ? 1 : 0], D),
          f(sign * w, inner, D * 0.35),
        ],
        'base',
        C.base,
      );
  }
}
export function buildDolmabahceLevel(output, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Dolmabahçe tier ' + level);
  const o = safe(output);
  for (const rs of a.nativePolygons)
    prism(o, c, rs, a.foundationY, a.floorY, 'base', C.base, !c.far);
  facades(o, c);
  roofs(o, c);
  for (const l of a.roofLanterns) lantern(o, c, l);
  frontStairs(o, c);
  entries(o, c);
}
export const buildDolmabahceSkyline = (o) => buildDolmabahceLevel(o, 'skyline'),
  buildDolmabahceDistrict = (o) => buildDolmabahceLevel(o, 'district'),
  buildDolmabahceStreet = (o) => buildDolmabahceLevel(o, 'street'),
  buildDolmabahceCloseup = (o) => buildDolmabahceLevel(o, 'closeup');

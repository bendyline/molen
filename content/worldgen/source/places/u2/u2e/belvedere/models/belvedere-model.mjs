/** Original complete Upper and Lower Belvedere exteriors; actual mapped footprints. */
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
  '7a03252a553234167aaccb4e37038a2f5ecf2cb7f5f1ed49d985c245b97fa45e'
)
  throw Error('Belvedere controls changed: update explicit geometry input pin');
export const belvedereControls = JSON.parse(controlsBytes);
const a = belvedereControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('e8e1ce'),
    stone: lin('d9d6c8'),
    base: lin('aca99d'),
    metal: lin('78a798'),
    roof: lin('b77a5b'),
    glass: lin('435968'),
    wood: lin('4a6659'),
  };
export const belvedereSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.88, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.68, metallic: 0.22 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.85, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.38, metallic: 0.05 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const configs = {
    skyline: { far: true, n: 6, arch: 2, step: 40 },
    district: { flat: true, n: 6, arch: 2, step: 18 },
    street: { n: 10, arch: 4, step: 8.5 },
    closeup: { detail: true, n: 12, arch: 6, step: 3.9 },
    master: { detail: true, fine: true, n: 28, arch: 16, step: 3.75 },
  },
  sub = (p, q) => p.map((v, i) => v - q[i]),
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
function aperture(o, c, F, h) {
  const { u, U, lo, hi } = h,
    r = (U - u) / 2,
    spring = h.arch ? hi - r : hi,
    x = (u + U) / 2,
    points = [
      [u, lo],
      [U, lo],
      [U, spring],
    ];
  if (h.arch) {
    for (let i = 1; i <= c.arch; i++) {
      const t = (Math.PI * i) / c.arch;
      points.push([x + r * Math.cos(t), spring + r * Math.sin(t)]);
    }
  } else points.push([U, hi], [u, hi]);
  const d = h.depth ?? 0.22,
    N = sub(F(0, 0, 1), F(0, 0, 0));
  // The closed back is recessed, with real jamb, sill and soffit geometry.
  for (let i = 1; i < points.length - 1; i++)
    T(
      o,
      c,
      [F(...points[0], -d), F(...points[i], -d), F(...points[i + 1], -d)],
      h.door ? 'wood' : 'glass',
      h.door ? C.wood : C.glass,
      N,
    );
  for (let i = 0; i < points.length; i++) {
    const A = points[i],
      B = points[(i + 1) % points.length];
    Q(o, c, [F(...A, 0), F(...B, 0), F(...B, -d), F(...A, -d)], 'stone', C.stone);
    if (!c.flat && !c.far) {
      if (c.fine) span(o, c, F(...A, 0.08), F(...B, 0.08), 0.16, 0.18);
      else {
        const dx = B[0] - A[0],
          dy = B[1] - A[1],
          L = Math.hypot(dx, dy),
          nx = (-dy / L) * 0.14,
          ny = (dx / L) * 0.14;
        Q(
          o,
          c,
          [
            F(...A, 0.08),
            F(...B, 0.08),
            F(B[0] + nx, B[1] + ny, 0.08),
            F(A[0] + nx, A[1] + ny, 0.08),
          ],
          'stone',
          C.stone,
          N,
        );
      }
    }
  }
  if (c.detail) {
    for (const t of h.door ? [0.5] : [0.33, 0.66])
      span(
        o,
        c,
        F(u + (U - u) * t, lo, -d + 0.035),
        F(u + (U - u) * t, hi - (h.arch ? r * 0.65 : 0), -d + 0.035),
        0.07,
        0.08,
        'wood',
        C.wood,
      );
    for (const v of [0.35, 0.7])
      span(
        o,
        c,
        F(u, lo + (spring - lo) * v, -d + 0.035),
        F(U, lo + (spring - lo) * v, -d + 0.035),
        0.07,
        0.08,
        'wood',
        C.wood,
      );
    if (!h.door) {
      const v = hi + 0.35;
      span(o, c, F(u - 0.25, v, 0.12), F(x, v + 0.65, 0.12), 0.16, 0.24);
      span(o, c, F(x, v + 0.65, 0.12), F(U + 0.25, v, 0.12), 0.16, 0.24);
    }
  }
}
function wall(o, c, F, L, lo, hi, holes) {
  holes = holes
    .filter((h) => h.lo >= lo - 1e-5 && h.hi <= hi + 1e-5 && h.u >= 0 && h.U <= L)
    .sort((a, b) => a.u - b.u);
  let x = 0;
  for (const h of holes) {
    panel(o, c, F, x, h.u, lo, hi);
    panel(o, c, F, h.u, h.U, lo, h.lo);
    if (h.arch) {
      const r = (h.U - h.u) / 2,
        m = (h.U + h.u) / 2,
        spring = h.hi - r;
      for (let i = 0; i < c.arch; i++) {
        const t0 = (Math.PI * i) / c.arch,
          t1 = (Math.PI * (i + 1)) / c.arch,
          p0 = [m + r * Math.cos(t0), spring + r * Math.sin(t0)],
          p1 = [m + r * Math.cos(t1), spring + r * Math.sin(t1)];
        Q(
          o,
          c,
          [F(...p0), F(...p1), F(p1[0], hi), F(p0[0], hi)],
          'wall',
          C.wall,
          sub(F(0, 0, 1), F(0, 0, 0)),
        );
      }
    } else panel(o, c, F, h.u, h.U, h.hi, hi);
    aperture(o, c, F, h);
    x = h.U;
  }
  panel(o, c, F, x, L, lo, hi);
}
function wallFaces(o, c, p, b) {
  for (const [ri, raw] of b.polygons.flatMap((rs) => rs.map((r, i) => [i, r]))) {
    const r = ri ? cw(raw).reverse() : cw(raw);
    for (let i = 0; i < r.length; i++) {
      const A = r[i],
        B = r[(i + 1) % r.length],
        { L, N, F } = face(A, B);
      if (L < 0.02) continue;
      const mid = [(A[0] + B[0]) / 2 + N[0] * 0.06, (A[1] + B[1]) / 2 + N[1] * 0.06],
        other = Math.max(
          0,
          ...p.bodies.filter((q) => q !== b && inPs(q.polygons, mid)).map((q) => q.eave),
        );
      if (other >= b.eave - 0.05) continue;
      const lo = p.floorY + other,
        hi = p.floorY + b.eave,
        holes = [];
      const add = (u, w, l, h, arch = false, door = false) => {
        if (u - w / 2 > 0.3 && u + w / 2 < L - 0.3 && l >= lo + 0.1 && h < hi - 0.7)
          holes.push({ u: u - w / 2, U: u + w / 2, lo: l, hi: h, arch, door });
      };
      const entry = a.entries.find(
        (e) =>
          e.owner === p.name &&
          Math.hypot(...sub(e.center, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2])) < L / 2 &&
          Math.abs((e.center[0] - A[0]) * N[0] + (e.center[1] - A[1]) * N[1]) < 0.1,
      );
      if (entry && other === 0) {
        const center =
            ((entry.center[0] - A[0]) * (B[0] - A[0])) / L +
            ((entry.center[1] - A[1]) * (B[1] - A[1])) / L,
          spacing = entry.width / entry.arches,
          w = entry.arches > 1 ? spacing * 0.74 : entry.width;
        for (let j = 0; j < entry.arches; j++)
          holes.push({
            u: center + (j - (entry.arches - 1) / 2) * spacing - w / 2,
            U: center + (j - (entry.arches - 1) / 2) * spacing + w / 2,
            lo: entry.lo,
            hi: entry.hi,
            arch: true,
            door: true,
            depth: entry.depth,
          });
      }
      if (!c.far && L > 3) {
        const n = Math.max(1, Math.floor(L / c.step)),
          levels =
            p.name === 'lower'
              ? b.kind === 'hall'
                ? [
                    [1.2, 4.8],
                    [7.8, 10.4],
                  ]
                : [[1.2, 5.6]]
              : b.eave > 16
                ? [
                    [3.2, 9.8],
                    [12.3, 16.4],
                  ]
                : b.eave > 10
                  ? [[3.2, 9.8]]
                  : [[1.2, 4.8]];
        for (let j = 0; j < n; j++) {
          const u = (L * (j + 0.5)) / n;
          for (const [l, h] of levels) {
            const w = p.name === 'lower' ? 1.7 : 1.8,
              low = p.floorY + l,
              high = p.floorY + h;
            if (
              holes.some(
                (q) =>
                  u + w / 2 > q.u - 0.5 &&
                  u - w / 2 < q.U + 0.5 &&
                  low < q.hi + 0.1 &&
                  high > q.lo - 0.1,
              )
            )
              continue;
            add(u, w, low, high, b.kind === 'hall');
          }
        }
      }
      // Split vertically so two window stories never cause overlapping wall patches.
      const ys = [lo, hi, ...holes.flatMap((h) => [h.lo, h.hi])]
        .sort((a, b) => a - b)
        .filter((v, i, ps) => !i || v - ps[i - 1] > 1e-5);
      for (let j = 1; j < ys.length; j++) {
        const l = ys[j - 1],
          h = ys[j],
          active = holes
            .filter((q) => q.lo < h - 1e-5 && q.hi > l + 1e-5)
            .sort((a, b) => a.u - b.u);
        let x = 0;
        for (const q of active) {
          panel(o, c, F, x, q.u, l, h);
          x = q.U;
        }
        panel(o, c, F, x, L, l, h);
      }
      for (const h of holes) {
        if (h.arch) {
          const R = (h.U - h.u) / 2,
            m = (h.U + h.u) / 2,
            spring = h.hi - R;
          for (let j = 0; j < c.arch; j++) {
            const t0 = (Math.PI * j) / c.arch,
              t1 = (Math.PI * (j + 1)) / c.arch,
              P = [m + R * Math.cos(t0), spring + R * Math.sin(t0)],
              Qp = [m + R * Math.cos(t1), spring + R * Math.sin(t1)];
            Q(
              o,
              c,
              [F(...P), F(...Qp), F(Qp[0], h.hi), F(P[0], h.hi)],
              'wall',
              C.wall,
              sub(F(0, 0, 1), F(0, 0, 0)),
            );
          }
        }
        aperture(o, c, F, h);
      }
      if (!c.far && !c.flat) {
        span(o, c, F(0, hi - 0.3, 0.1), F(L, hi - 0.3, 0.1), 0.3, 0.42);
        if (other === 0) {
          span(o, c, F(0, p.floorY + 2.5, 0.08), F(L, p.floorY + 2.5, 0.08), 0.2, 0.25);
          if (c.detail) {
            const n = Math.max(1, Math.round(L / 4));
            for (let j = 0; j <= n; j++) {
              const u = (j * L) / n;
              if (holes.some((h) => u > h.u - 0.2 && u < h.U + 0.2)) continue;
              span(o, c, F(u, p.floorY + 2.7, 0.1), F(u, hi - 0.6, 0.1), 0.3, 0.28);
              if (c.fine) {
                span(o, c, F(u - 0.25, hi - 0.7, 0.12), F(u + 0.25, hi - 0.7, 0.12), 0.28, 0.35);
              }
            }
          }
        }
      }
    }
  }
}
function roof(o, c, p, b) {
  if (b.kind === 'dome') return;
  const r = b.roof,
    [x, z, X, Z] = b.bounds,
    lo = p.floorY + b.eave,
    top = p.floorY + b.top,
    slot = p.name === 'upper' ? 'metal' : 'roof',
    col = C[slot],
    height = ([u, v]) => {
      const t = Math.max(
        0,
        Math.min(1, (u - x) / r.inset, (X - u) / r.inset, (v - z) / r.inset, (Z - v) / r.inset),
      );
      return (
        lo +
        (top - lo) *
          (c.far || c.flat ? t : t < 0.38 ? (t / 0.38) * 0.78 : 0.78 + ((t - 0.38) / 0.62) * 0.22)
      );
    };
  for (const cell of c.far || c.flat ? r.simpleCells : r.cells)
    for (const rs of cell.polygons) cap(o, c, rs, height, slot, col);
  for (const rs of r.top) cap(o, c, rs, top, slot, col);
  for (const rs of b.polygons) {
    const R = cw(rs[0], c.far ? 0.4 : c.flat ? 0.15 : 0.008);
    for (let i = 0; i < R.length; i++) {
      const start = R[i],
        end = R[(i + 1) % R.length],
        distances = ([u, v]) => [u - x, X - u, v - z, Z - v],
        ds = distances(start),
        de = distances(end),
        ts = [0, 1];
      for (let j = 0; j < 4; j++) {
        for (const h of [r.mid ?? r.inset * 0.38, r.inset]) {
          const t = (h - ds[j]) / (de[j] - ds[j]);
          if (t > 0 && t < 1) ts.push(t);
        }
        for (let k = j + 1; k < 4; k++) {
          const t = (ds[k] - ds[j]) / (de[j] - ds[j] - (de[k] - ds[k]));
          if (t > 0 && t < 1) ts.push(t);
        }
      }
      const points = ts
        .sort((a, b) => a - b)
        .filter((t, i, q) => !i || t - q[i - 1] > 1e-6)
        .map((t) => start.map((v, j) => v + (end[j] - v) * t));
      for (let j = 1; j < points.length - 1; ) {
        const A = points[j - 1],
          B = points[j],
          D = points[j + 1],
          t = Math.hypot(...sub(B, A)) / Math.hypot(...sub(D, A));
        if (Math.abs(height(B) - (height(A) + (height(D) - height(A)) * t)) < 1e-5)
          points.splice(j, 1);
        else j++;
      }
      for (let j = 1; j < points.length; j++) {
        const A = points[j - 1],
          B = points[j];
        Q(
          o,
          c,
          [
            [A[0], lo, A[1]],
            [B[0], lo, B[1]],
            [B[0], height(B), B[1]],
            [A[0], height(A), A[1]],
          ],
          slot,
          col,
          [-(B[1] - A[1]), 0, B[0] - A[0]],
        );
      }
    }
  }
  if (
    !c.flat &&
    !c.far &&
    (b.kind === 'mansard' || (p.name === 'lower' && b.bounds[2] - b.bounds[0] > 20))
  ) {
    const n = Math.max(1, Math.round((X - x) / 7)),
      y = lo + (top - lo) * 0.53;
    for (const sign of [-1, 1])
      for (let i = 0; i < n; i++) {
        const u = x + ((X - x) * (i + 0.5)) / n,
          v = sign < 0 ? z + r.mid * 0.67 : Z - r.mid * 0.67,
          F = (q, h, d) => [u + q, h, v + sign * d];
        if (!inPs(b.polygons, [u, v])) continue;
        const w = 0.68;
        Q(
          o,
          c,
          [F(-w, y - 0.5, 0), F(w, y - 0.5, 0), F(w, y + 0.7, 0), F(-w, y + 0.7, 0)],
          'glass',
          C.glass,
          [0, 0, sign],
        );
        for (const q of [-w, w]) span(o, c, F(q, y - 0.5, 0.05), F(q, y + 0.7, 0.05), 0.18, 0.3);
        span(o, c, F(-w - 0.2, y + 0.8, 0.05), F(0, y + 1.25, 0.05), 0.18, 0.35);
        span(o, c, F(0, y + 1.25, 0.05), F(w + 0.2, y + 0.8, 0.05), 0.18, 0.35);
      }
  }
  if (c.detail && b.kind === 'mansard') {
    for (const u of [x + (X - x) * 0.25, x + (X - x) * 0.75]) {
      const v = (z + Z) / 2,
        ht = height([u, v]);
      prism(
        o,
        c,
        [
          [
            [u - 0.6, v - 0.5],
            [u + 0.6, v - 0.5],
            [u + 0.6, v + 0.5],
            [u - 0.6, v + 0.5],
          ],
        ],
        ht - 0.2,
        ht + 1.2,
      );
    }
  }
}
function dome(o, c, p, d) {
  const [x, z] = d.center,
    r = d.radius,
    lo = p.floorY + d.wall,
    drum = lo + 2.3,
    n = c.far || c.flat ? 6 : 8;
  if (c.far) {
    const ring = (h, R) => radialRing(h, R, R, 6, [x, z]);
    loft(o, 'far', [ring(lo, r), ring(drum, r)], C.wall, { cap: false });
    loft(
      o,
      'far',
      [ring(drum, r * 1.04), ring(drum + 3, r * 0.7), ring(p.floorY + d.top, r * 0.07)],
      C.metal,
    );
    return;
  }
  // Octagonal upper pavilion: supported arched/recessed bays, solid lower palace below.
  for (let i = 0; i < n; i++) {
    const t = (-i * Math.PI * 2) / n,
      u = (-(i + 1) * Math.PI * 2) / n,
      A = [x + Math.cos(t) * r, z + Math.sin(t) * r],
      B = [x + Math.cos(u) * r, z + Math.sin(u) * r],
      { F, L } = face(A, B);
    wall(o, c, F, L, lo, drum, [
      { u: L * 0.25, U: L * 0.75, lo: lo + 0.1, hi: drum - 0.2, arch: true, depth: 0.25 },
    ]);
  }
  const ring = (h, R) => radialRing(h, R, R, c.n, [x, z]),
    profiles = c.flat
      ? [
          [drum, r * 1.04],
          [drum + 2, r * 0.95],
          [drum + 4, r * 0.42],
          [p.floorY + d.top, r * 0.09],
        ]
      : c.far
        ? [
            [drum, r * 1.03],
            [drum + 2, r * 0.95],
            [drum + 4, r * 0.42],
            [p.floorY + d.top, r * 0.09],
          ]
        : [
            [drum, r * 1.04],
            [drum + 0.35, r * 1.08],
            [drum + 1.5, r * 1.02],
            [drum + 3, r * 0.76],
            [drum + 4.25, r * 0.32],
            [p.floorY + d.top, r * 0.09],
          ];
  loft(
    o,
    S(c, 'metal'),
    profiles.map(([h, R]) => ring(h, R)),
    C.metal,
  );
  span(
    o,
    c,
    [x, p.floorY + d.top, z],
    [x, p.floorY + d.top + 1.2, z],
    0.12,
    0.12,
    'metal',
    C.metal,
  );
  if (c.detail)
    for (let i = 0; i < 8; i++) {
      const t = (i * Math.PI) / 4;
      for (let j = 1; j < profiles.length; j++)
        span(
          o,
          c,
          [
            x + Math.cos(t) * profiles[j - 1][1],
            profiles[j - 1][0],
            z + Math.sin(t) * profiles[j - 1][1],
          ],
          [x + Math.cos(t) * profiles[j][1], profiles[j][0], z + Math.sin(t) * profiles[j][1]],
          0.06,
          0.06,
          'metal',
          C.metal,
        );
    }
}
function thresholds(o, c) {
  for (const e of a.entries) {
    const F = (u, y, d) => [
        e.center[0] + e.tangent[0] * u + e.normal[0] * d,
        y,
        e.center[1] + e.tangent[1] * u + e.normal[1] * d,
      ],
      w = e.width / 2 + 0.7,
      D = e.approach.distance,
      Y = e.approach.outerY,
      n = c.far ? 1 : c.flat ? 2 : 6,
      outer = (u) => Y[0] + ((Y[1] - Y[0]) * (u + w)) / (2 * w);
    for (let j = 0; j < n; j++) {
      const d0 = (D * j) / n,
        d1 = (D * (j + 1)) / n,
        y0 = e.lo + ((Y[0] - e.lo) * j) / n,
        y1 = e.lo + ((Y[1] - e.lo) * j) / n;
      Q(
        o,
        c,
        [
          F(-w, y0, d0),
          F(w, y1, d0),
          F(w, e.lo + ((outer(w) - e.lo) * (j + 1)) / n, d1),
          F(-w, e.lo + ((outer(-w) - e.lo) * (j + 1)) / n, d1),
        ],
        'base',
        C.base,
        [0, 1, 0],
      );
    }
    for (const side of [-1, 1])
      Q(
        o,
        c,
        [
          F(w * side, a.foundationY, 0),
          F(w * side, a.foundationY, D),
          F(w * side, outer(w * side), D),
          F(w * side, e.lo, 0),
        ],
        'base',
        C.base,
      );
  }
}
function ornaments(o, c, p) {
  if (!c.detail) return;
  for (const b of p.bodies) {
    if (b.kind !== 'mansard' && b.kind !== 'hall') continue;
    const [x, z, X, Z] = b.bounds,
      y = p.floorY + b.eave;
    for (const side of [-1, 1]) {
      const v = side < 0 ? z : Z,
        n = Math.max(1, Math.floor((X - x) / 4));
      for (let j = 0; j <= n; j++) {
        const u = x + ((X - x) * j) / n;
        if (!inPs(p.polygons, [u, v + side * 0.05]) && !inPs(b.polygons, [u, v - side * 0.2]))
          continue;
        loft(
          o,
          S(c, 'stone'),
          [
            [y, 0.23],
            [y + 0.22, 0.4],
            [y + 0.8, 0.2],
            [y + 1.1, 0.33],
          ].map(([h, R]) => radialRing(h, R, R, c.fine ? 12 : 6, [u, v])),
          C.stone,
        );
      }
    }
  }
}
function crowns(o, c) {
  const p = a.palaces[0],
    entry = p.bodies.find((b) => b.kind === 'entry'),
    [x, z, X, Z] = entry.bounds,
    center = (x + X) / 2,
    y = p.floorY + entry.eave,
    v = Z + 0.02,
    pts = [
      [-1, 0],
      [-0.8, 0.3],
      [-0.5, 1.2],
      [-0.27, 3.5],
      [0, 5.4],
      [0.27, 3.5],
      [0.5, 1.2],
      [0.8, 0.3],
      [1, 0],
    ],
    ring = pts.map(([u, h]) => [center + (u * (X - x)) / 2, h + y]);
  for (const sign of [-1, 1])
    for (let j = 1; j < ring.length - 1; j++)
      T(
        o,
        c,
        [ring[0], ring[j], ring[j + 1]].map(([u, h]) => [u, h, v + sign * 0.25]),
        'wall',
        C.wall,
        [0, 0, sign],
      );
  for (let j = 1; j < ring.length; j++) {
    const A = ring[j - 1],
      B = ring[j];
    Q(
      o,
      c,
      [
        [A[0], A[1], v - 0.25],
        [B[0], B[1], v - 0.25],
        [B[0], B[1], v + 0.25],
        [A[0], A[1], v + 0.25],
      ],
      'stone',
      C.stone,
    );
    if (c.detail) span(o, c, [A[0], A[1] + 0.1, v + 0.3], [B[0], B[1] + 0.1, v + 0.3], 0.22, 0.3);
  }
  if (c.detail) {
    const lower = a.palaces[1],
      hall = lower.bodies.find((b) => b.kind === 'hall'),
      [x, z, X, Z] = hall.bounds,
      y = lower.floorY + 6.8;
    for (const side of [-1, 1]) {
      const start = side < 0 ? x - 10 : X,
        end = side < 0 ? x : X + 10;
      span(o, c, [start, y + 1.05, Z + 0.05], [end, y + 1.05, Z + 0.05], 0.18, 0.3);
      for (let u = start; u <= end; u += 0.85)
        span(o, c, [u, y, Z + 0.05], [u, y + 1.05, Z + 0.05], 0.13, 0.17);
    }
  }
}
export function buildBelvedereLevel(output, level = 'master') {
  const o = {
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
        ) > 1e-9
      ) {
        args[2] = ps;
        args[3] = normalFor(...ps);
        output.addTriangle(...args);
      }
    },
    addConvexPolygon(s, ref, ps, N, uv, color) {
      for (let i = 1; i < ps.length - 1; i++) {
        const p = [ps[0], ps[i], ps[i + 1]];
        this.addTriangle(s, ref, p, N, p.map(uv), color);
      }
    },
  };
  const c = configs[level];
  if (!c) throw Error('Unknown Belvedere tier ' + level);
  for (const p of a.palaces) {
    if (c.far) {
      for (const rs of p.polygons)
        prism(
          o,
          c,
          rs,
          a.foundationY,
          p.floorY + (p.name === 'upper' ? 11 : 6.8),
          'wall',
          C.wall,
          false,
        );
      for (const b of p.farBodies) {
        if (b.raised)
          for (const rs of b.polygons)
            prism(
              o,
              c,
              rs,
              p.floorY + (p.name === 'upper' ? 11 : 6.8),
              p.floorY + b.eave,
              'wall',
              C.wall,
              false,
            );
        roof(o, c, p, b);
      }
      for (const d of p.domes) dome(o, c, p, d);
      continue;
    }
    for (const rs of p.polygons) prism(o, c, rs, a.foundationY, p.floorY, 'base', C.base, !c.far);
    for (const b of p.bodies) {
      wallFaces(o, c, p, b);
      roof(o, c, p, b);
    }
    for (const d of p.domes) dome(o, c, p, d);
    ornaments(o, c, p);
  }
  thresholds(o, c);
  crowns(o, c);
}
export const buildBelvedereSkyline = (o) => buildBelvedereLevel(o, 'skyline'),
  buildBelvedereDistrict = (o) => buildBelvedereLevel(o, 'district'),
  buildBelvedereStreet = (o) => buildBelvedereLevel(o, 'street'),
  buildBelvedereCloseup = (o) => buildBelvedereLevel(o, 'closeup');

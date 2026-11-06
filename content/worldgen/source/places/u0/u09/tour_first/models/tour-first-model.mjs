/** Complete current Tour First exterior;original geometry from retained map plans andordinary photos. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    glass: lin('7fa2b6'),
    pale: lin('dce0de'),
    silver: lin('b8c4ca'),
    dark: lin('59646a'),
    ground: lin('aaa69c'),
    roof: lin('c7ced0'),
  };
export const tourFirstSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.75, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.25, metallic: 0.17 },
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.54, metallic: 0.3 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.87, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93, metallic: 0 },
};
export const tourFirstControls = a;
export function tourFirstGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(u),
    j = Math.floor(v),
    p = u - i,
    q = v - j,
    n = g.size[0],
    h = g.elevationsMeters;
  return (
    (1 - p) * (1 - q) * h[j * n + i] +
    p * (1 - q) * h[j * n + i + 1] +
    (1 - p) * q * h[(j + 1) * n + i] +
    p * q * h[(j + 1) * n + i + 1] -
    a.originElevation
  );
}
export function tourFirstRoof(w, x, z) {
  const dx = w.inner[0] - w.outer[0],
    dz = w.inner[1] - w.outer[1],
    dots = w.outline.map((p) => p[0] * dx + p[1] * dz),
    min = Math.min(...dots),
    max = Math.max(...dots),
    t = Math.max(0, Math.min(1, (x * dx + z * dz - min) / (max - min)));
  return w.outerRoof + (w.innerRoof - w.outerRoof) * t;
}
const cfg = {
  skyline: { far: true, pitch: 80, rows: 1, crownPitch: 80 },
  district: { pitch: 18, rows: 3, crownPitch: 35, fins: true },
  street: { pitch: 4, rows: 24, crownPitch: 7, fins: true, entry: true, seams: 5 },
  closeup: {
    pitch: 2,
    rows: 52,
    crownPitch: 2.4,
    fins: true,
    entry: true,
    seams: 2,
    folds: true,
    plant: true,
  },
  master: {
    pitch: 1.35,
    rows: 52,
    crownPitch: 1.45,
    fins: true,
    entry: true,
    seams: 1,
    folds: true,
    plant: true,
    reveals: true,
  },
};
const S = (c, s) => (c.far ? 'far' : s),
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  clockwise = (r) => (area(r) < 0 ? r : r.toReversed());
function tri(o, s, ps, color, n) {
  let p = ps.map((p) => p.map(Math.fround));
  const A = p[1].map((v, i) => v - p[0][i]),
    B = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
    1e-7
  )
    return;
  if (n && normalFor(...p).reduce((v, k, i) => v + k * n[i], 0) < 0) p = p.toReversed();
  o.addTriangle(
    s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((p) => [p[0] + p[2], p[1]]),
    color,
  );
}
function patch(o, s, p, color, n) {
  tri(o, s, p.slice(0, 3), color, n);
  tri(o, s, [p[0], p[2], p[3]], color, n);
}
function cap(o, c, r, y, s, color) {
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      S(c, s),
      ids.slice(i, i + 3).map((k) => [r[k][0], typeof y === 'function' ? y(...r[k]) : y, r[k][1]]),
      color,
      [0, 1, 0],
    );
}
const face = (p, q) => {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
      t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    return { p, q, L, t, n: [-t[1], t[0]] };
  },
  P = (f, u, y, d = 0) => [f.p[0] + f.t[0] * u + f.n[0] * d, y, f.p[1] + f.t[1] * u + f.n[1] * d];
export const tourFirstEntryPoint = (u, y, d = 0) => P(face(a.entrance.p, a.entrance.q), u, y, d);
function B(o, c, p, q, w, color = C.silver, d = w) {
  if (Math.hypot(...p.map((v, i) => v - q[i])) > 0.001) beam(o, S(c, 'metal'), p, q, w, d, color);
}
function panel(o, c, f, u0, u1, y0, y1, d, s, color) {
  if (u1 <= u0 || y1 <= y0) return;
  patch(o, S(c, s), [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)], color, [
    f.n[0],
    0,
    f.n[1],
  ]);
}
function clipRoofSeam(p, q, r) {
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0],
    d = q.map((v, i) => v - p[i]),
    ts = [0, 1];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      e = b.map((v, i) => v - a[i]),
      den = cross(d, e);
    if (Math.abs(den) < 1e-9) continue;
    const v = a.map((v, i) => v - p[i]),
      t = cross(v, e) / den,
      u = cross(v, d) / den;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  const at = (t) => p.map((v, i) => v + d[i] * t),
    inside = ([x, z]) => {
      let hit = false;
      for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
        const p = r[i],
          q = r[j];
        if (p[1] > z !== q[1] > z && x < ((q[0] - p[0]) * (z - p[1])) / (q[1] - p[1]) + p[0])
          hit = !hit;
      }
      return hit;
    };
  return ts
    .slice(1)
    .flatMap((t, i) =>
      t - ts[i] > 1e-6 && inside(at((t + ts[i]) / 2)) ? [[at(ts[i]), at(t)]] : [],
    );
}
function podium(o, c) {
  const r = clockwise(a.outline),
    e = a.entrance;
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      low = Math.min(
        -1,
        ...Array.from({ length: Math.ceil(f.L / 3) + 1 }, (_, j) => {
          const p = P(f, (j * f.L) / Math.ceil(f.L / 3), 0);
          return tourFirstGroundY(p[0], p[2]) - 0.6;
        }),
      ),
      entry = f.n[0] > 0.99 && f.L > 30 && f.p[0] > 27;
    panel(o, c, f, 0, f.L, low, e.landingY, 0, 'ground', C.ground);
    if (entry && c.entry) {
      panel(o, c, f, 0, e.centerU - e.openingHalfWidth, e.landingY, e.doorTop, 0, 'glass', C.glass);
      panel(
        o,
        c,
        f,
        e.centerU + e.openingHalfWidth,
        f.L,
        e.landingY,
        e.doorTop,
        0,
        'glass',
        C.glass,
      );
      panel(o, c, f, 0, f.L, e.doorTop, 12, 0, 'glass', C.glass);
    } else panel(o, c, f, 0, f.L, e.landingY, 12, 0, 'glass', C.glass);
    if (!c.far) {
      for (const y of [7.7, 11.6]) {
        if (entry && c.entry && y < e.doorTop) {
          panel(o, c, f, 0, e.centerU - e.openingHalfWidth, y, y + 0.3, 0.05, 'metal', C.pale);
          panel(o, c, f, e.centerU + e.openingHalfWidth, f.L, y, y + 0.3, 0.05, 'metal', C.pale);
        } else panel(o, c, f, 0, f.L, y, y + 0.3, 0.05, 'metal', C.pale);
      }
      if (c.entry)
        for (let u = 1; u < f.L; u += 3) {
          if (entry && Math.abs(u - e.centerU) < e.openingHalfWidth) continue;
          B(o, c, P(f, u, e.landingY, 0.08), P(f, u, 12, 0.08), 0.14, C.silver);
        }
    }
  }
  cap(o, c, r, 12, 'roof', C.roof);
}
function wing(o, c, w) {
  const r = clockwise(w.outline),
    H = (x, z) => tourFirstRoof(w, x, z);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      cols = Math.max(1, Math.ceil(f.L / c.pitch)),
      rows = c.rows,
      topA = H(...f.p),
      topB = H(...f.q),
      maximum = Math.max(topA, topB),
      rowH = (maximum - 12) / rows;
    for (let j = 0; j < rows; j++)
      for (let k = 0; k < cols; k++) {
        const u = (k * f.L) / cols,
          v = ((k + 1) * f.L) / cols,
          p = P(f, u, 0),
          q = P(f, v, 0),
          top0 = H(p[0], p[2]),
          top1 = H(q[0], q[2]),
          y0 = 12 + j * rowH,
          y1 = 12 + (j + 1) * rowH;
        if (y0 >= Math.max(top0, top1)) continue;
        const A = P(f, u, Math.min(y0, top0)),
          B = P(f, v, Math.min(y0, top1)),
          C0 = P(f, v, Math.min(y1, top1)),
          D = P(f, u, Math.min(y1, top0)),
          n = [f.n[0], 0, f.n[1]],
          ps = [A, B, C0, D];
        if (c.reveals) {
          const inset = ps.map((p) => p.map((v, i) => v - n[i] * 0.055));
          patch(o, 'glass', inset, C.glass, n);
          for (let t = 0; t < 4; t++)
            patch(o, 'metal', [ps[t], ps[(t + 1) % 4], inset[(t + 1) % 4], inset[t]], C.silver);
        } else patch(o, S(c, 'glass'), ps, C.glass, n);
      }
    if (!c.far) {
      for (let j = 1; j < rows; j++) {
        const y = 12 + j * rowH,
          min = Math.min(topA, topB),
          max = Math.max(topA, topB);
        if (y >= max) continue;
        let u = 0,
          v = f.L;
        if (y > min) {
          const q = ((y - topA) / (topB - topA)) * f.L;
          if (topA < topB) u = q;
          else v = q;
        }
        panel(o, c, f, u, v, y, Math.min(y + 0.45, max), 0.08, 'metal', C.pale);
      }
      if (c.fins)
        for (let k = 0; k <= cols; k++) {
          const u = (k * f.L) / cols,
            p = P(f, u, 0),
            top = H(p[0], p[2]);
          B(o, c, P(f, u, 12, 0.1), P(f, u, top, 0.1), k === 0 ? 0.2 : 0.09, C.silver, 0.16);
        }
    }
  }
  cap(o, c, r, H, 'roof', C.roof);
  crown(o, c, w, r, H);
  if (c.seams) {
    const dx = w.inner[0] - w.outer[0],
      dz = w.inner[1] - w.outer[1],
      L = Math.hypot(dx, dz),
      across = [-dz / L, dx / L];
    for (let d = -7; d <= 7; d += c.seams) {
      const p = [w.outer[0] + across[0] * d, w.outer[1] + across[1] * d],
        q = [w.inner[0] + across[0] * d, w.inner[1] + across[1] * d];
      for (const [s, t] of clipRoofSeam(p, q, r))
        B(o, c, [s[0], H(...s) + 0.05, s[1]], [t[0], H(...t) + 0.05, t[1]], 0.08, C.silver, 0.1);
    }
  }
}
function crown(o, c, w, r, H) {
  for (let j = 0; j < r.length; j++) {
    const f = face(r[j], r[(j + 1) % r.length]);
    if (f.L < 6) continue;
    const N = Math.max(1, Math.ceil(f.L / c.crownPitch)),
      rise = w.crownHeight;
    for (let k = 0; k < N; k++) {
      const u = (k * f.L) / N,
        v = ((k + 1) * f.L) / N,
        p = P(f, u, 0),
        q = P(f, v, 0),
        y = H(p[0], p[2]),
        Y = H(q[0], q[2]),
        A = P(f, u, y),
        D = P(f, v, Y),
        B0 = P(f, u, y + rise * 0.65),
        C0 = P(f, v, Y + rise * 0.65),
        T = P(f, (u + v) / 2, (y + Y) / 2 + rise);
      if (c.far) {
        B(o, c, A, T, 0.16, C.pale);
        B(o, c, T, D, 0.16, C.pale);
      }
      if (!c.far) {
        B(o, c, A, B0, 0.14, C.pale);
        B(o, c, B0, C0, 0.12, C.pale);
        B(o, c, B0, T, 0.12, C.pale);
        B(o, c, C0, T, 0.12, C.pale);
        B(o, c, A, C0, 0.1, C.silver);
        B(o, c, B0, D, 0.1, C.silver);
        if (c.folds) {
          const M = P(f, (u + v) / 2, (y + Y) / 2 + rise * 0.52, 0.55);
          tri(o, 'metal', [A, M, B0], C.pale, [f.n[0], 0, f.n[1]]);
          tri(o, 'glass', [B0, M, C0], C.glass, [f.n[0], 0, f.n[1]]);
          for (let h = 0.5; h < rise * 0.45; h += c.reveals ? 0.25 : 0.6)
            B(o, c, P(f, u, y + h, -0.18), P(f, v, Y + h, -0.18), 0.04, C.silver, 0.08);
        }
      }
    }
    const q = r[(j + 1) % r.length];
    B(o, c, [q[0], H(...q), q[1]], [q[0], H(...q) + w.crownHeight * 0.65, q[1]], 0.18, C.pale);
  }
}
function entrance(o, c) {
  const e = a.entrance,
    f = face(e.p, e.q),
    left = e.centerU - e.openingHalfWidth,
    right = e.centerU + e.openingHalfWidth,
    top = [
      P(f, left - 2, e.landingY),
      P(f, right + 2, e.landingY),
      P(f, right + 2, e.landingY, e.landingDepth),
      P(f, left - 2, e.landingY, e.landingDepth),
    ],
    bottom = top.map((p) => [p[0], Math.min(-1, tourFirstGroundY(p[0], p[2]) - 0.5), p[2]]);
  loft(o, S(c, 'ground'), [bottom.toReversed(), top.toReversed()], C.ground);
  if (c.entry) {
    for (let i = 0; i < 6; i++) {
      const d0 = e.landingDepth + (i * e.stairRun) / 6,
        d1 = e.landingDepth + ((i + 1) * e.stairRun) / 6,
        Y = (u) => {
          const p = P(f, u, 0, e.landingDepth + e.stairRun);
          return e.landingY + ((tourFirstGroundY(p[0], p[2]) - e.landingY) * (i + 1)) / 6;
        },
        t = [
          P(f, left - 2, Y(left - 2), d0),
          P(f, right + 2, Y(right + 2), d0),
          P(f, right + 2, Y(right + 2), d1),
          P(f, left - 2, Y(left - 2), d1),
        ],
        b = t.map((p) => [p[0], Math.min(-1, tourFirstGroundY(p[0], p[2]) - 0.5), p[2]]);
      loft(o, 'ground', [b.toReversed(), t.toReversed()], C.ground);
    }
    panel(o, c, f, left, right, e.landingY, e.doorTop, -e.recess, 'metal', C.dark);
    for (const u of [left, right])
      patch(
        o,
        'metal',
        [
          P(f, u, e.landingY),
          P(f, u, e.landingY, -e.recess),
          P(f, u, e.doorTop, -e.recess),
          P(f, u, e.doorTop),
        ],
        C.silver,
        u === left ? [f.t[0], 0, f.t[1]] : [-f.t[0], 0, -f.t[1]],
      );
    patch(
      o,
      'metal',
      [
        P(f, left, e.doorTop),
        P(f, right, e.doorTop),
        P(f, right, e.doorTop, -e.recess),
        P(f, left, e.doorTop, -e.recess),
      ],
      C.dark,
      [0, -1, 0],
    );
    for (const du of [-3.5, 0, 3.5]) {
      panel(
        o,
        c,
        f,
        e.centerU + du - 1.3,
        e.centerU + du + 1.3,
        e.landingY + 0.1,
        8.3,
        -e.recess + 0.06,
        'glass',
        C.glass,
      );
      for (const u of [e.centerU + du - 1.3, e.centerU + du, e.centerU + du + 1.3])
        B(
          o,
          c,
          P(f, u, e.landingY + 0.1, -e.recess + 0.09),
          P(f, u, 8.3, -e.recess + 0.09),
          0.07,
          C.silver,
        );
    }
  }
  const R = (u, d) =>
      P(f, u, e.canopyBackY + ((e.canopyFrontY - e.canopyBackY) * d) / e.canopyDepth, d),
    N = c.far ? 1 : c.entry ? 8 : 2;
  for (let i = 0; i < N; i++) {
    const u = e.canopyMinU + (i * (e.canopyMaxU - e.canopyMinU)) / N,
      v = e.canopyMinU + ((i + 1) * (e.canopyMaxU - e.canopyMinU)) / N;
    patch(
      o,
      S(c, 'roof'),
      [R(u, 0), R(v, 0), R(v, e.canopyDepth), R(u, e.canopyDepth)],
      C.roof,
      [0, 1, 0],
    );
    if (!c.far) {
      B(o, c, R(u, 0), R(u, e.canopyDepth), 0.18, C.silver);
      if (c.entry) B(o, c, R(u, 0), R(v, e.canopyDepth), 0.1, C.silver);
    }
  }
  for (const d of [0, e.canopyDepth]) B(o, c, R(e.canopyMinU, d), R(e.canopyMaxU, d), 0.35, C.pale);
  if (!c.far)
    for (const u of [e.canopyMinU + 0.5, e.canopyMaxU - 0.5]) {
      const p = R(u, e.canopyDepth - 0.2);
      B(o, c, [p[0], tourFirstGroundY(p[0], p[2]) - 0.4, p[2]], p, 0.25, C.silver);
    }
}
function plant(o, c) {
  if (!c.plant) return;
  for (const [x, z, w, d, h] of [
    [-24, 3, 5, 4, 1.8],
    [14, 25, 4, 3, 1.4],
  ]) {
    box(o, 'roof', [x - w / 2, 12, z - d / 2], [x + w / 2, 12 + h, z + d / 2], C.roof);
    if (c.reveals)
      for (let j = 0; j < 9; j++)
        box(
          o,
          'metal',
          [x - w / 2, 12 + h, z - d / 2 + (j * d) / 9],
          [x + w / 2, 12 + h + 0.06, z - d / 2 + (j * d) / 9 + 0.05],
          C.dark,
        );
  }
}
function apron(o, c) {
  const p = a.apron,
    r = clockwise(p.outline);
  cap(o, c, r, p.topY, 'ground', C.ground);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]);
    panel(o, c, f, 0, f.L, p.topY - p.thickness, p.topY, 0, 'ground', C.ground);
    if (!c.far && f.L > 15 && f.p[0] > 30 && f.q[0] > 30) {
      const e = a.entrance,
        gaps = [e.centerU - e.openingHalfWidth - 2.3, e.centerU + e.openingHalfWidth + 2.3]
          .map((u) => tourFirstEntryPoint(u, 0, e.landingDepth))
          .map((v) => (v[0] - f.p[0]) * f.t[0] + (v[2] - f.p[1]) * f.t[1])
          .sort((a, b) => a - b);
      for (const [lo, hi] of [
        [0, Math.max(0, gaps[0])],
        [Math.min(f.L, gaps[1]), f.L],
      ]) {
        if (hi <= lo) continue;
        B(o, c, P(f, lo, p.topY + 1.05), P(f, hi, p.topY + 1.05), 0.08, C.silver);
        const n = Math.ceil((hi - lo) / (c.entry ? 3 : 12));
        for (let j = 0; j <= n; j++) {
          const u = lo + ((hi - lo) * j) / n;
          B(o, c, P(f, u, p.topY), P(f, u, p.topY + 1.05), 0.08, C.silver);
        }
      }
    }
  }
  for (const [x, z] of p.supports) {
    const low = tourFirstGroundY(x, z) - 0.4;
    box(
      o,
      S(c, 'ground'),
      [x - 0.2, low, z - 0.2],
      [x + 0.2, p.topY - p.thickness, z + 0.2],
      C.ground,
    );
  }
}
export function buildTourFirstLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Tour First level:' + level);
  podium(o, c);
  apron(o, c);
  for (const w of a.wings) wing(o, c, w);
  entrance(o, c);
  plant(o, c);
}
export const buildTourFirstSkyline = (o) => buildTourFirstLevel(o, 'skyline'),
  buildTourFirstDistrict = (o) => buildTourFirstLevel(o, 'district'),
  buildTourFirstStreet = (o) => buildTourFirstLevel(o, 'street'),
  buildTourFirstCloseup = (o) => buildTourFirstLevel(o, 'closeup');

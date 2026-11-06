/** 'doges_palace': original complete mapped palace and attached range. Model +X SSE,+Z WSW. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const dogesControls = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const a = dogesControls,
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('dfc2b5'),
    brick: lin('a56d56'),
    stone: lin('efe5d5'),
    base: lin('aaa99d'),
    roof: lin('9ca9ae'),
    glass: lin('455c60'),
    wood: lin('52625e'),
    metal: lin('52615f'),
    dark: lin('45524e'),
    paving: lin('b8ac98'),
  };
export const dogesSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.88, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.84, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.35 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.4, metallic: 0.05 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const cfg = {
  skyline: { far: true, n: 4, arch: 2, step: 30, stairs: 3 },
  district: { n: 4, arch: 2, step: 24, stairs: 5, coarse: true },
  street: { n: 4, arch: 4, step: 8, stairs: 10, pattern: 4, pinnacles: 12 },
  closeup: { n: 8, arch: 8, step: 4.5, stairs: 20, pattern: 1.4, pinnacles: 3.2, details: true },
  master: {
    n: 20,
    arch: 20,
    step: 4.5,
    stairs: 32,
    pattern: 0.7,
    pinnacles: 1.55,
    details: true,
    fine: true,
  },
};
const clean = (r) => {
    const p = r.slice();
    if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 1e-5) p.pop();
    return p;
  },
  area = (r) =>
    r.reduce((n, p, i) => {
      const q = r[(i + 1) % r.length];
      return n + p[0] * q[1] - q[0] * p[1];
    }, 0),
  cw = (r) => {
    const p = clean(r);
    return area(p) > 0 ? p.reverse() : p;
  },
  S = (c, s) => (c.far ? 'far' : s),
  P = (p) => p;
function Q(o, c, p, s = 'wall', color = C.wall, N) {
  p = p.map((q) => q.map(Math.fround));
  if (N && normalFor(...p).reduce((v, n, i) => v + n * N[i], 0) < 0) p.reverse();
  o.addQuad(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    color,
  );
}
function T(o, c, p, s = 'wall', color = C.wall, N) {
  p = p.map((q) => q.map(Math.fround));
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
const B = (o, c, lo, hi, s = 'stone', color = C.stone) => box(o, S(c, s), lo, hi, color),
  L = (o, c, r, s = 'stone', color = C.stone) => loft(o, S(c, s), r, color),
  span = (o, c, A, Z, w = 0.1, d = 0.1, s = 'stone', color = C.stone) =>
    beam(o, S(c, s), A, Z, w, d, color);
function cap(o, c, rs, y, s = 'wall', color = C.wall, up = true) {
  const rings = rs.map(clean),
    p = rings.flat(),
    holes = [];
  let n = rings[0].length;
  for (const r of rings.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ids = earcut(p.flat(), holes, 2);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [p[j][0], y, p[j][1]]),
      s,
      color,
      [0, up ? 1 : -1, 0],
    );
}
function prism(o, c, rs, lo, hi, s = 'wall', color = C.wall) {
  for (const [ri, raw] of rs.entries()) {
    const r = ri ? cw(raw).reverse() : cw(raw);
    for (let j = 0; j < r.length; j++) {
      const A = r[j],
        Z = r[(j + 1) % r.length];
      Q(
        o,
        c,
        [
          [A[0], lo, A[1]],
          [Z[0], lo, Z[1]],
          [Z[0], hi, Z[1]],
          [A[0], hi, A[1]],
        ],
        s,
        color,
      );
    }
  }
  cap(o, c, rs, lo, s, color, false);
  cap(o, c, rs, hi, s, color);
}

const mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
function hip(o, c, rs, lo, hi) {
  const bottom = cw(rs[0]),
    center = [0, 1].map((i) => bottom.reduce((s, p) => s + p[i] / bottom.length, 0)),
    top = bottom.map((p) => mix(center, p, 0.22));
  for (let i = 0; i < bottom.length; i++) {
    const j = (i + 1) % bottom.length;
    Q(
      o,
      c,
      [
        [...bottom[i].slice(0, 1), lo, bottom[i][1]],
        [bottom[j][0], lo, bottom[j][1]],
        [top[j][0], hi, top[j][1]],
        [top[i][0], hi, top[i][1]],
      ],
      'roof',
      C.roof,
    );
  }
  cap(o, c, [top], hi, 'roof', C.roof);
  if (c.fine)
    for (let i = 0; i < bottom.length; i++) {
      const j = (i + 1) % bottom.length,
        len = Math.hypot(...sub2(bottom[j], bottom[i]));
      for (let k = 1; k < Math.floor(len / 0.8); k++) {
        const t = k / Math.floor(len / 0.8),
          b = mix(bottom[i], bottom[j], t),
          p = mix(top[i], top[j], t);
        span(o, c, [b[0], lo + 0.02, b[1]], [p[0], hi + 0.02, p[1]], 0.025, 0.025, 'roof', C.roof);
      }
    }
}
const sub2 = (p, q) => p.map((v, i) => v - q[i]);
function facadePlane(A, Z, N) {
  const len = Math.hypot(...sub2(Z, A)),
    d = sub2(Z, A).map((v) => v / len);
  return { len, F: (x, y, z = 0) => [A[0] + d[0] * x + N[0] * z, y, A[1] + d[1] * x + N[1] * z] };
}
const facing = (F) => sub2(F(0, 0, 1), F(0, 0, 0));
function profile(width, spring, rise, n, pointed = true) {
  const r = width / 2,
    p = [];
  if (pointed) {
    for (let i = 0; i <= n; i++) {
      const x = -r + (width * i) / n,
        y =
          spring +
          (rise * Math.sqrt(Math.max(0, 4 * r * r - Math.pow(Math.abs(x) + r, 2)))) /
            (Math.sqrt(3) * r);
      p.push([x, y]);
    }
  } else
    for (let i = 0; i <= n; i++) {
      const t = Math.PI - (Math.PI * i) / n;
      p.push([Math.cos(t) * r, spring + Math.sin(t) * rise]);
    }
  return p;
}
function arch(
  o,
  c,
  F,
  width,
  floor,
  spring,
  peak,
  top,
  depth = 0.5,
  pointed = true,
  rightSupport = true,
  supportOffset = 0,
) {
  const p = profile(width, spring, peak - spring, c.arch, pointed);
  for (let i = 0; i < p.length - 1; i++) {
    const A = p[i],
      Z = p[i + 1];
    Q(
      o,
      c,
      [F(A[0], A[1], 0), F(Z[0], Z[1], 0), F(Z[0], top, 0), F(A[0], top, 0)],
      'stone',
      C.stone,
      facing(F),
    );
    Q(
      o,
      c,
      [F(A[0], A[1], -depth), F(A[0], top, -depth), F(Z[0], top, -depth), F(Z[0], Z[1], -depth)],
      'stone',
      C.stone,
      facing(F).map((v) => -v),
    );
    const tangent = sub2(F(1, 0, 0), F(0, 0, 0)),
      dx = Z[0] - A[0],
      dy = Z[1] - A[1];
    Q(
      o,
      c,
      [F(A[0], A[1], 0), F(A[0], A[1], -depth), F(Z[0], Z[1], -depth), F(Z[0], Z[1], 0)],
      'stone',
      C.stone,
      [dy * tangent[0], -dx, dy * tangent[2]],
    );
    if (c.fine) span(o, c, F(A[0], A[1], 0.06), F(Z[0], Z[1], 0.06), 0.12, 0.12);
  }
  // The opening is bounded by real curved soffits, not a dark decal.
  for (const x of [
    -width / 2 - supportOffset,
    ...(rightSupport ? [width / 2 + supportOffset] : []),
  ]) {
    const p = F(x, floor, -depth / 2);
    const rings = c.fine
      ? [
          [floor, 0.48],
          [floor + 0.25, 0.48],
          [floor + 0.38, 0.3],
          [spring - 0.35, 0.3],
          [spring - 0.2, 0.48],
          [spring, 0.48],
        ]
      : [
          [floor, 0.34],
          [spring, 0.34],
        ];
    if (c.coarse) B(o, c, [p[0] - 0.34, floor, p[2] - 0.34], [p[0] + 0.34, spring, p[2] + 0.34]);
    else
      L(
        o,
        c,
        rings.map(([y, r]) => radialRing(y, r, r, c.n, [p[0], p[2]])),
      );
  }
}
function closedWindow(o, c, F, width, lo, spring, peak, door = false) {
  const p = [[-width / 2, lo], ...profile(width, spring, peak - spring, c.arch), [width / 2, lo]],
    ids = earcut(p.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => F(p[j][0], p[j][1], 0.09)),
      door ? 'wood' : 'glass',
      door ? C.wood : C.glass,
      facing(F),
    );
  if (c.coarse) return;
  const cy = (lo + peak) / 2,
    outer = p.map(([x, y]) => [x * 1.11, cy + (y - cy) * 1.045]);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    if (c.fine) span(o, c, F(...p[i], 0.13), F(...p[j], 0.13), 0.14, 0.1);
    else
      Q(
        o,
        c,
        [F(...p[i], 0.13), F(...outer[i], 0.13), F(...outer[j], 0.13), F(...p[j], 0.13)],
        'stone',
        C.stone,
        facing(F),
      );
  }
  if (c.fine) {
    span(o, c, F(0, lo, 0.15), F(0, peak - 0.2, 0.15), 0.1, 0.1, 'wood', C.wood);
    span(
      o,
      c,
      F(-width / 2, lo + (spring - lo) * 0.55, 0.15),
      F(width / 2, lo + (spring - lo) * 0.55, 0.15),
      0.1,
      0.1,
      'wood',
      C.wood,
    );
  }
}
function roundInset(o, c, F, r, y) {
  for (let j = 0; j < c.n; j++) {
    const point = (i, R) =>
      F(Math.cos((i / c.n) * Math.PI * 2) * R, y + Math.sin((i / c.n) * Math.PI * 2) * R, 0.09);
    T(o, c, [F(0, y, 0.08), point(j, r), point(j + 1, r)], 'glass', C.glass, facing(F));
    if (!c.coarse)
      Q(
        o,
        c,
        [point(j, r), point(j, r + 0.12), point(j + 1, r + 0.12), point(j + 1, r)],
        'stone',
        C.stone,
        facing(F),
      );
  }
}
function frieze(o, c, F, bay) {
  const lo = 11.55,
    hi = 13.1,
    center = 12.25,
    r = 0.48;
  // A circular/lobed opening through a thin frieze. The hole and its reveal
  // survive in the near tiers; the coarse tier uses a simple solid band.
  if (!c.details) {
    Q(
      o,
      c,
      [F(-bay / 2, lo), F(bay / 2, lo), F(bay / 2, hi), F(-bay / 2, hi)],
      'stone',
      C.stone,
      facing(F),
    );
    return;
  }
  const hole = Array.from({ length: c.n * 2 }, (_, i) => {
      const t = (i / (c.n * 2)) * Math.PI * 2,
        R = r * (1 + 0.17 * Math.cos(t * 4));
      return [Math.cos(t) * R, center + Math.sin(t) * R];
    }),
    outer = [
      [-bay / 2, lo],
      [bay / 2, lo],
      [bay / 2, hi],
      [-bay / 2, hi],
    ],
    p = [...outer, ...hole],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    for (const d of [0, -0.45])
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => F(p[j][0], p[j][1], d)),
        'stone',
        C.stone,
        facing(F).map((v) => (d === 0 ? v : -v)),
      );
  for (let i = 0; i < hole.length; i++) {
    const j = (i + 1) % hole.length;
    Q(
      o,
      c,
      [F(...hole[i], 0), F(...hole[i], -0.45), F(...hole[j], -0.45), F(...hole[j], 0)],
      'stone',
      C.stone,
    );
  }
}
function marblePattern(o, c, F, len, top) {
  if (!c.pattern) return;
  const s = c.pattern;
  for (let j = 0; j < Math.floor((top - 13.2) / (s * 0.55)); j++)
    for (let i = 0; i < Math.floor(len / s); i++) {
      if ((i + j) % 2) continue;
      const x = (i + 0.5) * s,
        y = 13.2 + (j + 0.5) * s * 0.55,
        rx = s * 0.45,
        ry = s * 0.245;
      if (y + ry > top - 0.15) continue;
      Q(
        o,
        c,
        [F(x - rx, y, 0.025), F(x, y - ry, 0.025), F(x + rx, y, 0.025), F(x, y + ry, 0.025)],
        'stone',
        C.stone,
        facing(F),
      );
    }
}
function balcony(o, c, F, y) {
  const w = 4.2;
  // Small central projecting balcony and its original Gothic canopy.
  const A = F(-w / 2, y, 0),
    Z = F(w / 2, y + 0.28, 1.55);
  B(
    o,
    c,
    A.map((v, i) => Math.min(v, Z[i])),
    A.map((v, i) => Math.max(v, Z[i])),
  );
  for (const d of [0.3, 1.45]) span(o, c, F(-w / 2, y + 1.1, d), F(w / 2, y + 1.1, d), 0.14, 0.14);
  if (!c.coarse)
    for (let k = 0; k < 14; k++)
      span(
        o,
        c,
        F(-w / 2 + (k * w) / 13, y + 0.25, 1.45),
        F(-w / 2 + (k * w) / 13, y + 1.1, 1.45),
        0.08,
        0.08,
      );
  for (const x of [-2.45, 2.45]) span(o, c, F(x, y, 0), F(x, y + 8, 0.12), 0.26, 0.26);
  const t = [F(-2.5, y + 7.3, 0.16), F(2.5, y + 7.3, 0.16), F(0, y + 10.4, 0.16)];
  T(o, c, t, 'stone', C.stone, facing(F));
  if (c.details)
    for (const x of [-2.45, 0, 2.45]) {
      const p = F(x, y + 8.5, 0.1);
      L(o, c, [
        radialRing(p[1], 0.32, 0.32, c.n, [p[0], p[2]]),
        radialRing(p[1] + 1.3, 0.03, 0.03, c.n, [p[0], p[2]]),
      ]);
    }
}
function arcadeFront(o, c, a) {
  const { len, F } = facadePlane(a.A, a.B, a.normal),
    count = c.coarse ? Math.ceil(a.bays / 5) : a.bays,
    bay = len / count,
    upperCount = c.coarse ? count : count * 2,
    upperBay = len / upperCount,
    top = a.name === 'south-lagoon' ? 25.5 : 23.5;
  if (c.far) return;
  for (let i = 0; i < count; i++) {
    const center = (i + 0.5) * bay;
    arch(
      o,
      c,
      (x, y, z = 0) => F(center + x, y, z),
      bay - 0.5,
      0.8,
      4.55,
      6.25,
      7.1,
      0.6,
      true,
      i === count - 1,
      0.25,
    );
  }
  // Horizontal floor slabs cover the real walkable colonnade depth.
  for (const y of [0.8, 7.1, 13.05])
    Q(
      o,
      c,
      [F(0, y, 0), F(len, y, 0), F(len, y, -4.2), F(0, y, -4.2)],
      'stone',
      C.stone,
      [0, 1, 0],
    );
  for (let i = 0; i < upperCount; i++) {
    const center = (i + 0.5) * upperBay,
      f = (x, y, z = 0) => F(center + x, y, z);
    arch(o, c, f, upperBay - 0.32, 7.2, 9.9, 11.5, 11.55, 0.45, true, i === upperCount - 1, 0.16);
    frieze(o, c, f, upperBay);
    if (!c.coarse)
      for (const x of [-0.32, 0, 0.32]) span(o, c, f(x, 7.3, 0.08), f(x, 8.05, 0.08), 0.07, 0.07);
    span(o, c, f(-upperBay / 2, 8.05, 0.08), f(upperBay / 2, 8.05, 0.08), 0.09, 0.09);
  }
  for (const y of [7.1, 13.05, top - 0.1]) span(o, c, F(0, y, 0.06), F(len, y, 0.06), 0.2, 0.26);
  marblePattern(o, c, F, len, top);
  const windows = a.name === 'south-lagoon' ? 7 : 8;
  for (let i = 0; i < windows; i++) {
    const center = ((i + 0.5) * len) / windows,
      f = (x, y, z = 0) => F(center + x, y, z);
    closedWindow(o, c, f, 2.7, 14.1, 17.45, 19.2);
    if (!c.coarse) roundInset(o, c, f, 0.43, 21.6);
  }
  balcony(o, c, (x, y, z = 0) => F(len / 2 + x, y, z), 14.1);
  if (c.pinnacles)
    for (let i = 0; i <= Math.floor(len / c.pinnacles); i++) {
      const x = (i * len) / Math.floor(len / c.pinnacles),
        p = F(x, top + 0.1, 0.06);
      L(o, c, [
        radialRing(p[1], 0.19, 0.19, c.n, [p[0], p[2]]),
        radialRing(p[1] + 0.65, 0.24, 0.24, c.n, [p[0], p[2]]),
        radialRing(p[1] + 1.5, 0.02, 0.02, c.n, [p[0], p[2]]),
      ]);
      if (c.details && i % 2 === 0)
        roundInset(o, c, (u, y, z = 0) => F(x + u, y, z), 0.16, top + 0.7);
    }
}
function plainFacades(o, c) {
  if (c.far) return;
  for (const rs of a.whole)
    for (const raw of rs) {
      const r = cw(raw);
      for (let j = 0; j < r.length; j++) {
        const A = r[j],
          Z = r[(j + 1) % r.length],
          len = Math.hypot(...sub2(Z, A));
        if (len < 5) continue;
        const N = [-(Z[1] - A[1]) / len, (Z[0] - A[0]) / len],
          { F } = facadePlane(A, Z, N),
          mid = mix(A, Z, 0.5);
        // South and west exteriors have their own full two-storey Gothic loggias.
        if (mid[0] > 68 || (mid[1] > 33.5 && mid[0] > -6)) continue;
        if (mid[0] > -17 && mid[0] < -5 && mid[1] > -15 && mid[1] < 0) continue;
        const height = mid[0] < -5 && mid[1] > 0 ? 12 : 23.5,
          count = Math.max(1, Math.round(len / c.step));
        for (let k = 0; k < count; k++) {
          const x = ((k + 0.5) * len) / count,
            f = (u, y, z = 0) => F(x + u, y, z);
          for (const y of [1.4, 8.3, 15.2])
            if (
              y + 4 < height &&
              !(y < 13 && mid[0] > -5 && mid[0] < 46 && mid[1] > -18.5 && mid[1] < 24)
            )
              closedWindow(o, c, f, Math.min(2.1, (len / count) * 0.55), y, y + 2.8, y + 3.9);
          if (c.details)
            span(
              o,
              c,
              F(x, mid[0] > -5 && mid[0] < 46 && mid[1] > -18.5 && mid[1] < 24 ? 13.1 : 1, 0.08),
              F(x, height, 0.08),
              0.22,
              0.14,
            );
        }
        for (const y of [7.4, 14.2, height])
          if (
            y <= height &&
            !(y < 13 && mid[0] > -5 && mid[0] < 46 && mid[1] > -18.5 && mid[1] < 24)
          )
            span(o, c, F(0, y, 0.05), F(len, y, 0.05), 0.2, 0.18);
      }
    }
}
function courtyardStair(o, c) {
  const s = a.stair,
    D = sub2(s.to, s.from),
    length = Math.hypot(...D),
    T = D.map((v) => v / length),
    N = [-T[1], T[0]],
    point = (x, y, t) => [s.from[0] + T[0] * t + N[0] * x, y, s.from[1] + T[1] * t + N[1] * x];
  for (let j = 0; j < c.stairs; j++) {
    const t = (j / c.stairs) * length,
      y = s.bottom + ((s.top - s.bottom) * (j + 1)) / c.stairs;
    prism(
      o,
      c,
      [
        [
          [-s.width / 2, t],
          [s.width / 2, t],
          [s.width / 2, length],
          [-s.width / 2, length],
        ].map(([x, t]) => {
          const p = point(x, 0, t);
          return [p[0], p[2]];
        }),
      ],
      s.bottom - 0.1,
      y,
      'stone',
      C.stone,
    );
  }
  for (const x of [-s.width / 2 - 0.18, s.width / 2 + 0.18]) {
    span(o, c, point(x, s.bottom + 0.8, 0), point(x, s.top + 0.8, length), 0.28, 0.7);
    for (const t of [0, length]) {
      const y = t ? s.top : s.bottom,
        p = point(x, y, t);
      B(o, c, [p[0] - 0.35, y, p[2] - 0.35], [p[0] + 0.35, y + 1.35, p[2] + 0.35]);
    }
    if (!c.coarse && !c.far) {
      const p = point(x, s.top + 1.35, length);
      L(
        o,
        c,
        [
          [p[1], 0.32],
          [p[1] + 0.65, 0.22],
          [p[1] + 1.5, 0.3],
          [p[1] + 2, 0.15],
        ].map(([y, r]) => radialRing(y, r, r, c.n, [p[0], p[2]])),
      );
      sphere(
        o,
        S(c, 'stone'),
        [p[0], p[1] + 2.25, p[2]],
        [0.18, 0.23, 0.18],
        C.stone,
        c.n,
        Math.max(3, c.n / 2),
      );
    }
  }
  for (const rs of a.landing.polygons) prism(o, c, rs, -2, a.landing.height, 'stone', C.stone);
  if (c.far) return;
  // Three genuine open upper gallery bays behind the stair, bounded by
  // the existing low native gallery and a closed return wall.
  const { F } = facadePlane([-16.1, -10.9], [-5.6, -11.3], [0, 1]);
  for (let i = 0; i < 3; i++) {
    const center = (i + 0.5) * 3.5;
    arch(
      o,
      c,
      (x, y, z = 0) => F(center + x, y, z),
      3.0,
      6.3,
      9.2,
      10.5,
      12.0,
      0.55,
      false,
      i === 2,
      0.25,
    );
  }
  B(o, c, [-16.5, 12, -14.1], [-5.3, 12.3, -10.3]);
}
function courtyardArcade(o, c, a) {
  if (c.far) return;
  const { len, F } = facadePlane(a.A, a.B, a.normal),
    count = c.coarse ? Math.ceil(a.bays / 4) : a.bays,
    bay = len / count;
  for (let i = 0; i < count; i++) {
    const f = (x, y, z = 0) => F((i + 0.5) * bay + x, y, z);
    arch(o, c, f, bay - 0.55, 0.8, 3.9, 5.5, 6.3, 0.55, false, i === count - 1, 0.275);
    arch(o, c, f, bay - 0.55, 6.3, 9.3, 10.8, 13.1, 0.55, true, i === count - 1, 0.275);
  }
  for (const y of [0.8, 6.3, 13.05])
    Q(o, c, [F(0, y), F(len, y), F(len, y, -2.7), F(0, y, -2.7)], 'stone', C.stone, [0, 1, 0]);
}
export function buildDogesLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Doge tier ' + level);
  if (!c.far) for (const rs of a.whole) prism(o, c, rs, -2, 0.8, 'base', C.base);
  for (const b of a.bodies) {
    if (c.far) {
      for (const rs of b.polygons) prism(o, c, rs, -2, b.eave);
    } else {
      for (const rs of b.lower)
        prism(
          o,
          c,
          rs,
          0.8,
          Math.min(13.1, b.eave),
          b.name === 'mapped-163' || b.name === 'mapped-464' ? 'brick' : 'wall',
          b.name === 'mapped-163' || b.name === 'mapped-464' ? C.brick : C.wall,
        );
      for (const rs of b.polygons)
        if (b.eave > 13.1)
          prism(
            o,
            c,
            rs,
            13.1,
            b.eave,
            b.name === 'mapped-163' || b.name === 'mapped-464' ? 'brick' : 'wall',
            b.name === 'mapped-163' || b.name === 'mapped-464' ? C.brick : C.wall,
          );
    }
    for (const rs of b.polygons) hip(o, c, rs, b.eave, b.height);
  }
  for (const f of a.arcades) arcadeFront(o, c, f);
  for (const f of a.courtyardArcades) courtyardArcade(o, c, f);
  plainFacades(o, c);
  courtyardStair(o, c);
  if (!c.far) {
    // Closed doors sit on the actual clipped rear walls of the colonnades.
    for (const z of [-10, 12])
      closedWindow(o, c, (u, y, d = 0) => [68.15 + d, y, z + u], 1.6, 0.9, 3, 3.8, true);
    closedWindow(o, c, (u, y, d = 0) => [30 - u, y, 33.85 + d], 1.6, 0.9, 3, 3.8, true);
    closedWindow(o, c, (u, y, d = 0) => [-10.5 - u, y, -13.5 + d], 2.1, 6.4, 8.8, 9.8, true);
  }
  cap(o, c, [a.court.outline], a.court.floorY, 'base', C.paving);
}
export const buildDogesSkyline = (o) => buildDogesLevel(o, 'skyline');
export const buildDogesDistrict = (o) => buildDogesLevel(o, 'district');
export const buildDogesStreet = (o) => buildDogesLevel(o, 'street');
export const buildDogesCloseup = (o) => buildDogesLevel(o, 'closeup');

/** Original complete City Hall exterior. Meters,+Y up; +X northward, +Z eastward. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box as boundsBox } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    wall: lin('ddd9cd'),
    trim: lin('eeeae1'),
    roof: lin('575d60'),
    glass: lin('4d6178'),
    bronze: lin('4c4940'),
    dial: lin('b8cdcb'),
    dark: lin('353e3d'),
    foundation: lin('bcb8ae'),
  };
export const philadelphiaControls = a;
export const philadelphiaSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_marble', roughness: 0.85, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.87, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.28, metallic: 0.12 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.5, metallic: 0.3 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.66, metallic: 0.7 },
};
const configs = {
  skyline: { far: true, simplify: 7, bay: 25, sides: 4, arch: 3, roofRows: 1 },
  district: { simplify: 4.5, bay: 24, sides: 6, arch: 3, roofRows: 1, windows: true, bands: true },
  street: {
    simplify: 0.6,
    bay: 8.5,
    sides: 8,
    arch: 5,
    roofRows: 2,
    windows: true,
    bands: true,
    entry: true,
    frames: true,
  },
  closeup: {
    simplify: 0.15,
    bay: 5.8,
    sides: 16,
    arch: 8,
    roofRows: 5,
    windows: true,
    bands: true,
    entry: true,
    frames: true,
    columns: true,
  },
  master: {
    simplify: 0,
    bay: 5.5,
    sides: 24,
    arch: 12,
    roofRows: 8,
    windows: true,
    bands: true,
    entry: true,
    frames: true,
    columns: true,
    returns: true,
    ornament: true,
  },
};
export function philadelphiaGroundY(x, z) {
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
const S = (c, s) => (c.far ? 'far' : s),
  area = (r) =>
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  open = (r) => (r[0].every((v, i) => v === r.at(-1)[i]) ? r.slice(0, -1) : r),
  cw = (r) => (area(r) < 0 ? r : r.toReversed());
function simple(r, e) {
  r = open(r).map((p) => p.slice());
  if (!e) return r;
  let changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const p = r[(i + r.length - 1) % r.length],
        v = r[i],
        q = r[(i + 1) % r.length],
        dx = q[0] - p[0],
        dz = q[1] - p[1],
        L = Math.hypot(dx, dz);
      if (L < 1e-5) continue;
      const t = ((v[0] - p[0]) * dx + (v[1] - p[1]) * dz) / (L * L),
        d = Math.abs(dx * (v[1] - p[1]) - dz * (v[0] - p[0])) / L;
      if (t > 0 && t < 1 && d < e) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
}
function tri(o, c, s, ps, color, n) {
  let p = ps.map((p) => p.map(Math.fround)),
    A = p[1].map((v, i) => v - p[0][i]),
    B = p[2].map((v, i) => v - p[0][i]);
  if (
    Math.hypot(A[1] * B[2] - A[2] * B[1], A[2] * B[0] - A[0] * B[2], A[0] * B[1] - A[1] * B[0]) <
    1e-7
  )
    return;
  if (n && normalFor(...p).reduce((s, v, i) => s + v * n[i], 0) < 0) p = p.toReversed();
  o.addTriangle(
    S(c, s),
    'palette:#ffffff',
    p,
    normalFor(...p),
    p.map((p) => [p[0], p[2]]),
    color,
  );
}
function quad(o, c, s, p, color, n) {
  tri(o, c, s, p.slice(0, 3), color, n);
  tri(o, c, s, [p[0], p[2], p[3]], color, n);
}
function cap(o, c, rings, y, s = 'wall', color = C.wall, up = 1) {
  let count = rings[0].length;
  const holes = [];
  for (const r of rings.slice(1)) {
    holes.push(count);
    count += r.length;
  }
  const ps = rings.flat(),
    ids = earcut(ps.flat(), holes);
  for (let i = 0; i < ids.length; i += 3)
    tri(
      o,
      c,
      s,
      ids
        .slice(i, i + 3)
        .map((i) => [ps[i][0], typeof y === 'function' ? y(...ps[i]) : y, ps[i][1]]),
      color,
      [0, up, 0],
    );
}
const face = (p, q) => {
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]),
      t = [(q[0] - p[0]) / L, (q[1] - p[1]) / L];
    return { p, q, L, t, n: [-t[1], t[0]] };
  },
  P = (f, u, y, d = 0) => [f.p[0] + f.t[0] * u + f.n[0] * d, y, f.p[1] + f.t[1] * u + f.n[1] * d];
function panel(o, c, f, u0, u1, y0, y1, d = 0, s = 'wall', color = C.wall) {
  if (u1 - u0 < 1e-5 || y1 - y0 < 1e-5) return;
  quad(o, c, s, [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)], color, [
    f.n[0],
    0,
    f.n[1],
  ]);
}
const B = (o, c, p, q, w, color = C.trim, s = 'wall') => beam(o, S(c, s), p, q, w, w, color);
function box(o, c, s, center, size, color) {
  boundsBox(
    o,
    S(c, s),
    center.map((v, i) => v - size[i] / 2),
    center.map((v, i) => v + size[i] / 2),
    color,
  );
}
function column(o, c, center, y0, y1, r = 0.4, s = 'wall', color = C.trim) {
  loft(
    o,
    S(c, s),
    [
      radialRing(y0, r * 1.12, r * 1.12, c.sides, center),
      radialRing(y0 + 0.3, r, r, c.sides, center),
      radialRing(y1 - 0.3, r, r, c.sides, center),
      radialRing(y1, r * 1.15, r * 1.15, c.sides, center),
    ],
    color,
  );
}
function shell(o, c, r, y0, y1, s = 'wall', color = C.wall, top = true) {
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]);
    panel(o, c, f, 0, f.L, y0, y1, 0, s, color);
  }
  if (top) cap(o, c, [r], y1, s, color);
}
function glass(o, c, f, u0, u1, y0, y1, d = -0.16, cols = 1, rows = 1) {
  if (c.far) return;
  const points = [P(f, u0, y0, d), P(f, u1, y0, d), P(f, u1, y1, d), P(f, u0, y1, d)];
  o.addQuad(
    'glass',
    'metric:uv',
    points,
    [f.n[0], 0, f.n[1]],
    [
      [0, 0],
      [cols, 0],
      [cols, rows],
      [0, rows],
    ],
    C.glass,
  );
}
function window(o, c, f, u0, u1, y0, y1, { arched = false, decorated = false } = {}) {
  glass(o, c, f, u0, u1, y0, y1, -0.18, 1, c.frames ? 2 : 1);
  if (c.frames) {
    for (const u of [u0, u1]) {
      panel(o, c, f, u - 0.12, u + 0.12, y0 - 0.15, y1 + 0.15, 0.1, 'wall', C.trim);
      if (c.returns)
        quad(
          o,
          c,
          'wall',
          [P(f, u, y0, 0), P(f, u, y0, -0.18), P(f, u, y1, -0.18), P(f, u, y1, 0)],
          C.wall,
        );
    }
    panel(o, c, f, u0 - 0.2, u1 + 0.2, y0 - 0.17, y0 + 0.05, 0.14, 'wall', C.trim);
    panel(o, c, f, u0 - 0.15, u1 + 0.15, y1, y1 + 0.18, 0.1, 'wall', C.trim);
    if (c.returns) {
      B(
        o,
        c,
        P(f, (u0 + u1) / 2, y0, -0.13),
        P(f, (u0 + u1) / 2, y1, -0.13),
        0.05,
        C.dark,
        'metal',
      );
      B(
        o,
        c,
        P(f, u0, (y0 + y1) / 2, -0.12),
        P(f, u1, (y0 + y1) / 2, -0.12),
        0.06,
        C.dark,
        'metal',
      );
    }
  }
  if (decorated && c.columns) {
    const x = (u0 + u1) / 2,
      cy = y1 + 0.2,
      r = (u1 - u0) / 2 + 0.25,
      N = arched ? c.arch : 2,
      ps = Array.from({ length: N + 1 }, (_, j) => {
        const t = Math.PI - (j * Math.PI) / N;
        return [x + r * Math.cos(t), cy + (arched ? r * 0.6 : r * 0.55) * Math.sin(t)];
      });
    for (let j = 0; j < N; j++)
      B(o, c, P(f, ...ps[j], 0.18), P(f, ...ps[j + 1], 0.18), 0.16, C.trim);
  }
}
function facade(o, c, f, y0, y1, inner = false) {
  if (!c.windows || f.L < 2.5) {
    panel(o, c, f, 0, f.L, y0, y1);
    return;
  }
  const N = Math.max(1, Math.floor(f.L / (inner ? c.bay * 1.2 : c.bay))),
    bay = f.L / N,
    w = Math.min(inner ? 1.8 : 2.4, bay * 0.5),
    levels = [
      [1, 4.7],
      [8.8, 14.6],
      [19, 25.5],
    ].filter(([b, t]) => b >= y0 && t < y1);
  for (let j = 0; j < N; j++) {
    const l = j * bay,
      r = (j + 1) * bay,
      u0 = (l + r - w) / 2,
      u1 = u0 + w;
    panel(o, c, f, l, u0, y0, y1);
    panel(o, c, f, u1, r, y0, y1);
    let last = y0;
    for (const [b, t] of levels) {
      panel(o, c, f, u0, u1, last, b);
      window(o, c, f, u0, u1, b, t, { decorated: !inner && b > 8, arched: b > 18 });
      last = t;
    }
    panel(o, c, f, u0, u1, last, y1);
  }
  if (c.bands)
    for (const y of [6.7, 17.2, 28.3, 29.5])
      if (y >= y0 && y + 0.4 <= y1) {
        panel(o, c, f, 0, f.L, y, y + 0.4, 0.18, 'wall', C.trim);
        if (c.returns) B(o, c, P(f, 0, y + 0.38, 0.23), P(f, f.L, y + 0.38, 0.23), 0.18);
      }
  if (c.ornament && !inner)
    for (let u = bay / 2; u < f.L; u += bay) {
      for (const y of [7.5, 18])
        for (const du of [-1, 1])
          column(
            o,
            c,
            [P(f, u + du, y, 0.4)[0], P(f, u + du, y, 0.4)[2]],
            y,
            y + (y < 10 ? 7.5 : 8.5),
            0.18,
          );
      for (let u = 0; u < f.L; u += 1.2)
        panel(o, c, f, u, u + 0.24, 28.7, 29.2, 0.32, 'wall', C.trim);
    }
}
export const philadelphiaPassages = [
  { name: 'north', start: [17.2, -0.1], end: [71.4, -0.1], radius: 4.5, spring: 3.5 },
  { name: 'south', start: [-71.5, -0.1], end: [-35.7, -0.1], radius: 4.5, spring: 3.5 },
  { name: 'east', start: [-2.3, 34.4], end: [-2.3, 68], radius: 4.5, spring: 3.5 },
  { name: 'west', start: [-2.3, -68], end: [-2.3, -34.4], radius: 4.5, spring: 3.5 },
];
function portalMasks() {
  return philadelphiaPassages
    .map((k) => ({
      x0: Math.min(k.start[0], k.end[0]) - (k.start[0] === k.end[0] ? k.radius : 0),
      x1: Math.max(k.start[0], k.end[0]) + (k.start[0] === k.end[0] ? k.radius : 0),
      z0: Math.min(k.start[1], k.end[1]) - (k.start[1] === k.end[1] ? k.radius : 0),
      z1: Math.max(k.start[1], k.end[1]) + (k.start[1] === k.end[1] ? k.radius : 0),
    }))
    .map((r, i) =>
      i === 0
        ? { ...r, x0: 0 }
        : i === 1
          ? { ...r, x1: 0 }
          : i === 2
            ? { ...r, z0: 0 }
            : { ...r, z1: 0 },
    );
}
function intervals(f) {
  const ranges = [];
  for (const r of portalMasks()) {
    let lo = 0,
      hi = f.L,
      valid = true;
    for (const [p, t, a, b] of [
      [f.p[0], f.t[0], r.x0, r.x1],
      [f.p[1], f.t[1], r.z0, r.z1],
    ]) {
      if (Math.abs(t) < 1e-8) {
        if (p < a || p > b) valid = false;
      } else {
        const u = (a - p) / t,
          v = (b - p) / t;
        lo = Math.max(lo, Math.min(u, v));
        hi = Math.min(hi, Math.max(u, v));
      }
    }
    if (valid && hi - lo > 1e-4) ranges.push([lo, hi]);
  }
  const cuts = [0, f.L, ...ranges.flat()]
    .sort((a, b) => a - b)
    .filter((v, i, r) => !i || v - r[i - 1] > 1e-5);
  return cuts.slice(0, -1).map((l, i) => ({
    l,
    r: cuts[i + 1],
    open: ranges.some(([a, b]) => (l + cuts[i + 1]) / 2 >= a && (l + cuts[i + 1]) / 2 <= b),
  }));
}
function lowBuilding(o, c) {
  const outer = cw(simple(a.outline, c.simplify)),
    holes = a.holes.map((r) => cw(simple(r, c.simplify)).toReversed());
  for (const [ri, r] of [outer, ...holes].entries())
    for (let i = 0; i < r.length; i++) {
      const f = face(r[i], r[(i + 1) % r.length]),
        foundation = Math.min(
          -1.4,
          philadelphiaGroundY(...f.p) - 0.35,
          philadelphiaGroundY(...f.q) - 0.35,
        );
      for (const k of intervals(f)) {
        const sub = face([P(f, k.l, 0)[0], P(f, k.l, 0)[2]], [P(f, k.r, 0)[0], P(f, k.r, 0)[2]]);
        if (k.open) facade(o, c, sub, 8.5, 30, ri > 0);
        else {
          facade(o, c, sub, 0, 30, ri > 0);
          panel(o, c, sub, 0, sub.L, foundation, 0, 0, 'ground', C.foundation);
        }
      }
    }
  cap(o, c, [outer, ...holes], 30, 'roof', C.roof);
  if (c.entry) cap(o, c, [outer, ...holes], 29.7, 'wall', C.trim, -1);
}
function passages(o, c) {
  for (const k of philadelphiaPassages) {
    const f = face(k.start, k.end),
      N = c.arch;
    for (let j = 0; j < N; j++) {
      const t0 = (j * Math.PI) / N,
        t1 = ((j + 1) * Math.PI) / N,
        u0 = -Math.cos(t0) * k.radius,
        u1 = -Math.cos(t1) * k.radius,
        y0 = k.spring + Math.sin(t0) * k.radius,
        y1 = k.spring + Math.sin(t1) * k.radius;
      // Tunnel vault and spandrels are real geometry; no black rectangle closes the portal.
      if (c.entry)
        quad(
          o,
          c,
          'wall',
          [P(f, 0, y0, u0), P(f, f.L, y0, u0), P(f, f.L, y1, u1), P(f, 0, y1, u1)],
          C.wall,
        );
      for (const u of [0, f.L]) {
        quad(
          o,
          c,
          'wall',
          [P(f, u, y0, u0), P(f, u, y1, u1), P(f, u, 8.5, u1), P(f, u, 8.5, u0)],
          C.wall,
          [(u === 0 ? -1 : 1) * f.t[0], 0, (u === 0 ? -1 : 1) * f.t[1]],
        );
        if (c.frames) B(o, c, P(f, u, y0 + 0.22, u0), P(f, u, y1 + 0.22, u1), 0.38);
      }
    }
    if (c.entry)
      for (const v of [-k.radius, k.radius])
        panel(
          o,
          c,
          {
            p: [P(f, 0, 0, v)[0], P(f, 0, 0, v)[2]],
            q: [P(f, f.L, 0, v)[0], P(f, f.L, 0, v)[2]],
            L: f.L,
            t: f.t,
            n: f.n.map((n) => n * (v < 0 ? 1 : -1)),
          },
          0,
          f.L,
          -0.3,
          k.spring,
          0,
          'wall',
          C.wall,
        );
  }
}
const rect = (x0, z0, x1, z1) =>
  cw([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
function mansard(o, c, r, y0, y1, inset = 2) {
  r = cw(r);
  const center = r.reduce((p, q) => [p[0] + q[0] / r.length, p[1] + q[1] / r.length], [0, 0]),
    rx = Math.max(...r.map((p) => Math.abs(p[0] - center[0]))),
    rz = Math.max(...r.map((p) => Math.abs(p[1] - center[1]))),
    rings = [];
  for (let j = 0; j <= c.roofRows; j++) {
    const t = j / c.roofRows,
      h = y0 + t * (y1 - y0),
      d = inset * (0.35 * t + 0.65 * t * t);
    rings.push(
      r.map(([x, z]) => [
        center[0] + (x - center[0]) * Math.max(0.2, 1 - d / rx),
        h,
        center[1] + (z - center[1]) * Math.max(0.2, 1 - d / rz),
      ]),
    );
  }
  loft(o, S(c, 'roof'), rings, C.roof);
  if (c.columns)
    for (const rr of [rings[0], rings.at(-1)])
      for (let i = 0; i < rr.length; i++) B(o, c, rr[i], rr[(i + 1) % rr.length], 0.28, C.trim);
  return rings.at(-1).map((p) => [p[0], p[2]]);
}
const roofParts = [
  { name: 'southwest-corner', bounds: [-65, -63, -53, -51.8], top: 51 },
  { name: 'southeast-corner', bounds: [-65, 51.8, -53, 63], top: 51 },
  { name: 'northwest-corner', bounds: [49.8, -63, 62, -51.8], top: 51 },
  { name: 'northeast-corner', bounds: [49.8, 52, 62, 63], top: 51 },
  { name: 'south-portal', bounds: [-69, -12, -48, 12], top: 49 },
  { name: 'north-portal', bounds: [48, -11.5, 69.5, 11.5], top: 48 },
  { name: 'west-portal', bounds: [-13, -66, 9.2, -46], top: 47 },
  { name: 'east-portal', bounds: [-13, 46, 9.2, 66.5], top: 47 },
];
export const philadelphiaRoofParts = roofParts;
function pediment(o, c, f, u0, u1, y, rise = 1.5) {
  const u = (u0 + u1) / 2;
  tri(o, c, 'wall', [P(f, u0, y, 0.15), P(f, u1, y, 0.15), P(f, u, y + rise, 0.15)], C.trim, [
    f.n[0],
    0,
    f.n[1],
  ]);
  if (c.frames) {
    B(o, c, P(f, u0, y, 0.28), P(f, u, y + rise, 0.28), 0.23);
    B(o, c, P(f, u, y + rise, 0.28), P(f, u1, y, 0.28), 0.23);
  }
}
function dormers(o, c, r, y, facing = 0) {
  if (!c.windows) return;
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]);
    if (f.L < 4) continue;
    if (facing) {
      const longest = Math.max(
        ...r.map((p, j) =>
          Math.hypot(p[0] - r[(j + 1) % r.length][0], p[1] - r[(j + 1) % r.length][1]),
        ),
      );
      const mid = [(f.p[0] + f.q[0]) / 2, (f.p[1] + f.q[1]) / 2];
      if (f.L < longest * 0.6 || facing * (mid[0] * f.n[0] + mid[1] * f.n[1]) < 0) continue;
    }
    const N = Math.max(1, Math.floor(f.L / (c.columns ? 6.2 : c.frames ? 10 : 25)));
    for (let j = 0; j < N; j++) {
      const u = ((j + 0.5) * f.L) / N,
        w = Math.min(2.1, (f.L / N) * 0.38);
      panel(o, c, f, u - w / 2 - 0.35, u + w / 2 + 0.35, y, y + 4, 0.15, 'wall', C.trim);
      glass(o, c, f, u - w / 2, u + w / 2, y + 0.3, y + 3, 0.19, 1, 1);
      pediment(o, c, f, u - w / 2 - 0.6, u + w / 2 + 0.6, y + 3.4, 1);
      if (c.ornament)
        for (const side of [-1, 1])
          column(
            o,
            c,
            [
              P(f, u + side * (w / 2 + 0.25), 0, 0.45)[0],
              P(f, u + side * (w / 2 + 0.25), 0, 0.45)[2],
            ],
            y,
            y + 3.4,
            0.14,
          );
    }
  }
}
function roofs(o, c) {
  for (const b of [
    [-53, -62.4, 48, -51.8],
    [-53, 51.6, 48.7, 62.7],
    [-62.6, -51.8, -52.5, -12],
    [-62.6, 12, -52.5, 51.8],
    [50, -51.8, 60.8, -12],
    [50, 12, 60.8, 52],
    [-24, -46.7, 38.5, -34.5],
    [-24, 34.8, 38.5, 47],
  ]) {
    const r = rect(...b);
    mansard(o, c, r, 30, 37, 1.8);
    dormers(o, c, r, 31.1, Math.abs(b[1]) < 50 && Math.abs(b[3]) < 50 ? -1 : 1);
  }
  for (const k of roofParts) {
    const r = rect(...k.bounds),
      top = mansard(o, c, r, 30, k.top, 2.4);
    shell(o, c, top, k.top, k.top + 0.7, 'wall', C.trim);
    if (!c.far) {
      const inner = top.map((p) => [p[0], p[1]]);
      mansard(o, c, inner, k.top + 0.7, k.top + 2, 1.1);
      if (!c.entry) dormers(o, c, r, 33);
    }
    if (c.entry) {
      for (let i = 0; i < r.length; i++) {
        const edge = face(r[i], r[(i + 1) % r.length]),
          f = face(
            [P(edge, 0, 0, 0.8)[0], P(edge, 0, 0, 0.8)[2]],
            [P(edge, edge.L, 0, 0.8)[0], P(edge, edge.L, 0, 0.8)[2]],
          ),
          u = f.L / 2;
        panel(o, c, f, u - 2.1, u - 1, 31, 41, 0, 'wall', C.trim);
        panel(o, c, f, u + 1, u + 2.1, 31, 41, 0, 'wall', C.trim);
        panel(o, c, f, u - 1, u + 1, 31, 32, 0, 'wall', C.trim);
        panel(o, c, f, u - 1, u + 1, 38, 41, 0, 'wall', C.trim);
        window(o, c, f, u - 1, u + 1, 32, 38);
        pediment(o, c, f, u - 2.5, u + 2.5, 39, 2.7);
      }
    }
  }
  // Separate low roofs around the two small service courts; the holes stay unroofed.
  if (!c.far)
    for (const b of [
      [-51, -48, -31, -46.5],
      [-51, 46.5, -31, 49],
      [-50, -24, -37, -12],
      [-50, 12, -37, 24],
    ])
      mansard(o, c, rect(...b), 30, 35, 1);
}
function courtTurrets(o, c) {
  for (const z of [-9.2, 9.2]) {
    const ctr = [-21, z],
      r = radialRing(0, 2.7, 2.7, c.sides, ctr).map((p) => [p[0], p[2]]);
    for (let i = 0; i < r.length; i++) {
      const f = face(r[i], r[(i + 1) % r.length]);
      if (!c.windows || i % 2) {
        panel(o, c, f, 0, f.L, -1.4, 32);
        continue;
      }
      const l = f.L * 0.25,
        h = f.L * 0.75;
      panel(o, c, f, 0, l, -1.4, 32);
      panel(o, c, f, h, f.L, -1.4, 32);
      let last = -1.4;
      for (const y of [3, 12, 22, 28]) {
        panel(o, c, f, l, h, last, y);
        window(o, c, f, l, h, y, y + 2.3);
        last = y + 2.3;
      }
      panel(o, c, f, l, h, last, 32);
    }
    cap(o, c, [r], 32);
    loft(
      o,
      S(c, 'roof'),
      [radialRing(32, 3, 3, c.sides, ctr), radialRing(39, 0.15, 0.15, c.sides, ctr)],
      C.roof,
    );
    if (c.bands)
      for (const y of c.entry ? [7, 18, 27.8, 31.8] : [7, 27.8])
        loft(
          o,
          S(c, 'wall'),
          [radialRing(y, 2.85, 2.85, c.sides, ctr), radialRing(y + 0.3, 2.85, 2.85, c.sides, ctr)],
          C.trim,
        );
    column(o, c, ctr, 39, 40, 0.14);
  }
}
function towerWindows(o, c, r, y0, y1) {
  r = cw(r);
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      u = f.L / 2;
    if (!c.windows) {
      panel(o, c, f, 0, f.L, y0, y1);
      continue;
    }
    panel(o, c, f, 0, u - 1.4, y0, y1);
    panel(o, c, f, u + 1.4, f.L, y0, y1);
    panel(o, c, f, u - 1.4, u + 1.4, y0, y0 + 1.5);
    archedTowerWindow(o, c, f, u, y0 + 1.5, y1 - 1.2, y1);
  }
  cap(o, c, [r], y1);
}
function archedTowerWindow(o, c, f, u, bottom, top, wallTop) {
  const R = 1.4,
    spring = top - R,
    N = c.arch;
  for (let j = 0; j < N; j++) {
    const p = u - R + (2 * R * j) / N,
      q = u - R + (2 * R * (j + 1)) / N,
      yp = spring + Math.sqrt(Math.max(0, R * R - (p - u) ** 2)),
      yq = spring + Math.sqrt(Math.max(0, R * R - (q - u) ** 2)),
      points = [
        P(f, p, bottom, -0.18),
        P(f, q, bottom, -0.18),
        P(f, q, yq, -0.18),
        P(f, p, yp, -0.18),
      ];
    o.addQuad(
      'glass',
      'metric:uv',
      points,
      [f.n[0], 0, f.n[1]],
      [
        [j / N, 0],
        [(j + 1) / N, 0],
        [(j + 1) / N, ((yq - bottom) / (top - bottom)) * 2],
        [j / N, ((yp - bottom) / (top - bottom)) * 2],
      ],
      C.glass,
    );
    quad(o, c, 'wall', [P(f, p, yp), P(f, q, yq), P(f, q, wallTop), P(f, p, wallTop)], C.wall, [
      f.n[0],
      0,
      f.n[1],
    ]);
    if (c.columns) B(o, c, P(f, p, yp, 0.12), P(f, q, yq, 0.12), 0.17);
  }
  if (c.frames)
    for (const side of [-1, 1])
      panel(o, c, f, u + side * R - 0.1, u + side * R + 0.1, bottom, spring, 0.1, 'wall', C.trim);
}
function tower(o, c) {
  const [x, z] = a.tower.center,
    r = (w) => rect(x - w / 2, z - w / 2, x + w / 2, z + w / 2);
  shell(o, c, r(23.8), 30, 47);
  towerWindows(o, c, r(20.5), 47, 61);
  towerWindows(o, c, r(20.2), 61, 74);
  for (const [y, w, h] of [
    [46, 24, 1],
    [60, 22, 1],
    [73, 24.5, 1.5],
    [95, 22, 1.5],
    [97, 22, 1.3],
    [117.5, 22, 1.5],
  ])
    shell(o, c, r(w), y, y + h, 'wall', C.trim);
  // Recessed core and outer columns preserve a genuine open colonnade rather than a solid shaft.
  towerWindows(o, c, r(c.far ? 19 : 14.8), 74.5, 95);
  if (c.entry)
    for (const X of [-10, 10])
      for (const Z of [-10, -7, 7, 10]) column(o, c, [x + X, z + Z], 74.5, 95, 0.5);
  if (c.entry)
    for (const Z of [-10, 10]) for (const X of [-7, 7]) column(o, c, [x + X, z + Z], 74.5, 95, 0.5);
  shell(o, c, r(18.2), 98.3, 117.5);
  const clockR = c.far ? 3.8 : 4.3;
  for (let i = 0; i < 4; i++) {
    const rr = cw(r(18.2)),
      f = face(rr[i], rr[(i + 1) % 4]),
      u = f.L / 2;
    dial(o, c, f, u, 108, clockR);
    if (c.frames) {
      for (const du of [-7.3, 7.3])
        column(o, c, [P(f, u + du, 0, 0.5)[0], P(f, u + du, 0, 0.5)[2]], 99, 117.3, 0.48);
      pediment(o, c, f, 1, f.L - 1, 117.3, 3.3);
    }
  }
  const rings = [
    [119, 9.3],
    [124, 8.6],
    [136, 5.8],
    [145, 4.2],
    [147, 4.2],
  ].map(([y, w]) => radialRing(y, w, w, 8, [x, z], Math.PI / 8));
  loft(o, S(c, 'metal'), rings, C.trim);
  if (c.frames) {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < rings.length - 1; j++)
        B(o, c, rings[j][i], rings[j + 1][i], 0.28, C.trim, 'metal');
    }
    for (let y = 123; y < 140; y += c.returns ? 1.2 : 2.6) {
      const lo = y < 124 ? [119, 9.3] : [124, 8.6],
        hi = y < 124 ? [124, 8.6] : [136, 5.8],
        t = Math.max(0, Math.min(1, (y - lo[0]) / (hi[0] - lo[0]))),
        w = lo[1] + (hi[1] - lo[1]) * t,
        ring = radialRing(y, w, w, 8, [x, z], Math.PI / 8).map((p) => [p[0], p[2]]);
      for (let i = 0; i < 8; i += 2) {
        const f = face(ring[i], ring[(i + 1) % 8]);
        B(o, c, P(f, f.L * 0.2, y, 0.025), P(f, f.L * 0.8, y, 0.025), 0.09, C.wall, 'metal');
      }
    }
    const ring = radialRing(141, 4.9, 4.9, 8, [x, z], Math.PI / 8).map((p) => [p[0], p[2]]);
    for (let i = 0; i < 8; i += 2) {
      const f = face(ring[i], ring[(i + 1) % 8]),
        u = f.L / 2;
      for (let j = 0; j < 8; j++) {
        const t = (j * Math.PI) / 4,
          q = ((j + 1) * Math.PI) / 4,
          pt = (t, r) => P(f, u + Math.cos(t) * r, 141 + Math.sin(t) * r, 0.1);
        tri(o, c, 'metal', [P(f, u, 141, 0.1), pt(t, 0.5), pt(q, 0.5)], C.dark, [
          f.n[0],
          0,
          f.n[1],
        ]);
        quad(o, c, 'metal', [pt(t, 0.5), pt(q, 0.5), pt(q, 0.7), pt(t, 0.7)], C.trim, [
          f.n[0],
          0,
          f.n[1],
        ]);
      }
    }
    if (c.columns)
      for (const X of [-8.8, 8.8])
        for (const Z of [-8.8, 8.8]) {
          const y = 119.5;
          column(o, c, [x + X, z + Z], y, y + 1.8, 0.3, 'bronze', C.bronze);
          sphere(o, S(c, 'bronze'), [x + X, y + 2.15, z + Z], [0.4, 0.45, 0.4], C.bronze, 8, 4);
          B(
            o,
            c,
            [x + X - 0.55, y + 1.55, z + Z],
            [x + X + 0.55, y + 1.55, z + Z],
            0.22,
            C.bronze,
            'bronze',
          );
        }
  }
  // Circular viewing deck, open rail, fluted pedestal and separate Penn silhouette.
  const disk = (y, R, h) =>
    loft(
      o,
      S(c, 'metal'),
      [radialRing(y, R, R, c.sides, [x, z]), radialRing(y + h, R, R, c.sides, [x, z])],
      C.trim,
    );
  disk(147, 4.8, 0.6);
  disk(149, 4.4, 0.35);
  if (c.entry)
    for (let j = 0; j < c.sides; j++) {
      const t = (j * 2 * Math.PI) / c.sides,
        X = x + 4.4 * Math.cos(t),
        Z = z + 4.4 * Math.sin(t);
      B(o, c, [X, 147.6, Z], [X, 149.3, Z], 0.1, C.trim, 'metal');
      const t1 = ((j + 1) * 2 * Math.PI) / c.sides;
      B(
        o,
        c,
        [X, 149.3, Z],
        [x + 4.4 * Math.cos(t1), 149.3, z + 4.4 * Math.sin(t1)],
        0.12,
        C.trim,
        'metal',
      );
    }
  loft(
    o,
    S(c, 'metal'),
    [
      radialRing(147.6, 3.6, 3.6, c.sides, [x, z]),
      radialRing(153, 2, 2, c.sides, [x, z]),
      radialRing(155.8, 1.5, 1.5, c.sides, [x, z]),
    ],
    C.trim,
  );
  penn(o, c, [x, 155.8, z], 1);
}
function dial(o, c, f, u, y, R) {
  const N = c.far ? 6 : Math.max(16, c.sides * 2),
    point = (t, r, d) => P(f, u + Math.cos(t) * r, y + Math.sin(t) * r, d);
  for (let j = 0; j < N; j++) {
    const t = (j * 2 * Math.PI) / N,
      q = ((j + 1) * 2 * Math.PI) / N;
    tri(o, c, 'metal', [P(f, u, y, 0.08), point(t, R, 0.08), point(q, R, 0.08)], C.dial, [
      f.n[0],
      0,
      f.n[1],
    ]);
    if (!c.far)
      quad(
        o,
        c,
        'metal',
        [point(t, R, 0.12), point(q, R, 0.12), point(q, R + 0.23, 0.12), point(t, R + 0.23, 0.12)],
        C.dark,
        [f.n[0], 0, f.n[1]],
      );
  }
  if (c.far) return;
  for (let j = 0; j < (c.entry ? 12 : 4); j++) {
    const t = (j * 2 * Math.PI) / (c.entry ? 12 : 4);
    B(
      o,
      c,
      point(t, R * 0.79, 0.15),
      point(t, R * 0.94, 0.15),
      c.frames ? 0.12 : 0.18,
      C.dark,
      'metal',
    );
    if (c.columns)
      for (const side of [-1, 1])
        B(
          o,
          c,
          point(t + side * 0.025, R * 0.78, 0.16),
          point(t + side * 0.025, R * 0.93, 0.16),
          0.055,
          C.dark,
          'metal',
        );
  }
  for (const [t, r] of [
    [Math.PI * 0.66, R * 0.68],
    [Math.PI * 1.35, R * 0.48],
  ])
    B(o, c, P(f, u, y, 0.2), point(t, r, 0.2), 0.15, C.dark, 'metal');
  if (c.columns)
    for (const r of [R * 0.68, R * 0.39])
      for (let j = 0; j < N; j++)
        B(
          o,
          c,
          point((j * 2 * Math.PI) / N, r, 0.16),
          point(((j + 1) * 2 * Math.PI) / N, r, 0.16),
          0.045,
          C.dark,
          'metal',
        );
}
function penn(o, c, base, scale = 1) {
  const yaw = Math.PI / 4,
    pt = ([u, y, v]) => [
      base[0] + scale * (u * Math.cos(yaw) + v * Math.sin(yaw)),
      base[1] + scale * y,
      base[2] + scale * (-u * Math.sin(yaw) + v * Math.cos(yaw)),
    ],
    body = (y, rx, rz) => radialRing(y, rx, rz, c.far ? 6 : c.entry ? 12 : 8).map(pt),
    s = S(c, 'bronze');
  // Original colonial figure: two boots/legs, long flared coat, head/hair, broad brim and outward right hand.
  for (const u of [-0.55, 0.55]) {
    loft(
      o,
      s,
      [
        [
          [u - 0.32, 0, -0.5],
          [u + 0.32, 0, -0.5],
          [u + 0.32, 0, 0.55],
          [u - 0.32, 0, 0.55],
        ]
          .map(pt)
          .toReversed(),
        [
          [u - 0.25, 3.4, -0.25],
          [u + 0.25, 3.4, -0.25],
          [u + 0.25, 3.4, 0.3],
          [u - 0.25, 3.4, 0.3],
        ]
          .map(pt)
          .toReversed(),
      ],
      C.bronze,
    );
  }
  loft(
    o,
    s,
    [body(2.9, 1.25, 0.72), body(5.2, 0.95, 0.65), body(7.8, 1.1, 0.6), body(8.3, 0.65, 0.5)],
    C.bronze,
  );
  sphere(
    o,
    s,
    pt([0, 9, 0.1]),
    [0.62 * scale, 0.85 * scale, 0.58 * scale],
    C.bronze,
    c.far ? 6 : c.sides,
    c.far ? 3 : 6,
  );
  loft(
    o,
    s,
    [body(9.7, 1.45, 0.95), body(9.85, 1.45, 0.95), body(10.2, 0.65, 0.55), body(11.2, 0.57, 0.5)],
    C.bronze,
  );
  for (const [arm, hand] of [
    [
      [-0.95, 7.6, 0],
      [-1.25, 4.3, 0.3],
    ],
    [
      [0.95, 7.6, 0],
      [2, 6.1, 0.9],
    ],
  ]) {
    B(o, c, pt(arm), pt(hand), 0.55 * scale, C.bronze, 'bronze');
    if (c.entry) sphere(o, s, pt(hand), [0.28 * scale, 0.36 * scale, 0.28 * scale], C.bronze, 8, 4);
  }
  if (c.frames) {
    for (let y = 4.2; y < 8; y += 0.7)
      sphere(o, s, pt([0.05, y, 0.67]), [0.08 * scale, 0.08 * scale, 0.08 * scale], C.bronze, 6, 3);
    B(o, c, pt([-1.2, 4.5, 0.2]), pt([-1.2, 3.3, 0.2]), 0.32 * scale, C.bronze, 'bronze');
  }
}
function portalColumns(o, c) {
  if (!c.columns) return;
  for (const k of philadelphiaPassages) {
    const f = face(k.start, k.end);
    for (const u of [0, f.L])
      for (const v of [-7, -5.6, 5.6, 7]) {
        const p = P(f, u, 0, v),
          h = philadelphiaGroundY(p[0], p[2]);
        loft(
          o,
          S(c, 'ground'),
          [
            radialRing(h - 0.35, 0.6, 0.6, c.sides, [p[0], p[2]]),
            radialRing(0.4, 0.6, 0.6, c.sides, [p[0], p[2]]),
          ],
          C.foundation,
        );
        column(o, c, [p[0], p[2]], h - 0.25, 14.5, 0.43);
        column(o, c, [p[0], p[2]], 18.3, 27, 0.37);
      }
  }
  if (c.ornament) {
    for (const k of roofParts) {
      const [x0, z0, x1, z1] = k.bounds;
      for (const p of [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ]) {
        column(o, c, p, 29, 31, 0.4);
        const base = [p[0], 31, p[1]];
        sphere(o, S(c, 'wall'), [base[0], base[1] + 1.2, base[2]], [0.45, 0.9, 0.4], C.trim, 8, 5);
      }
    }
  }
}
export function buildPhiladelphiaLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown level ' + level);
  lowBuilding(o, c);
  passages(o, c);
  roofs(o, c);
  courtTurrets(o, c);
  tower(o, c);
  portalColumns(o, c);
}
export const buildPhiladelphiaSkyline = (o) => buildPhiladelphiaLevel(o, 'skyline');
export const buildPhiladelphiaDistrict = (o) => buildPhiladelphiaLevel(o, 'district');
export const buildPhiladelphiaStreet = (o) => buildPhiladelphiaLevel(o, 'street');
export const buildPhiladelphiaCloseup = (o) => buildPhiladelphiaLevel(o, 'closeup');

/** Original Livadia principal palace;meters,+Y up,+X ESE,+Z SSW. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const livadiaControls = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const a = livadiaControls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  H = a.controls;
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  wall: lin('eee9dd'),
  stone: lin('ece6d5'),
  trim: lin('f2eddf'),
  roof: lin('9dacae'),
  glass: lin('658399'),
  wood: lin('b2a07d'),
  metal: lin('5c6d70'),
  water: lin('5b9398'),
};
export const livadiaSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.84, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.83, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.67, metallic: 0.15 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.35, metallic: 0.07 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
  water: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.25, metallic: 0.08 },
};
const cfg = {
  skyline: { far: true, n: 4, arch: 1, bays: [2, 2], loggiaBays: 4, windowStep: 99 },
  district: { flat: true, n: 4, arch: 2, bays: [3, 4], loggiaBays: 6, windowStep: 8 },
  street: { flatFrames: true, n: 8, arch: 7, bays: [4, 5], loggiaBays: 8, windowStep: 5.2 },
  closeup: {
    frames: true,
    detail: true,
    n: 16,
    arch: 14,
    bays: [4, 5],
    loggiaBays: 8,
    windowStep: 5.2,
  },
  master: {
    frames: true,
    detail: true,
    fine: true,
    n: 32,
    arch: 30,
    bays: [4, 5],
    loggiaBays: 8,
    windowStep: 5.2,
  },
};
export function livadiaGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    i = Math.max(0, Math.min(127, Math.floor(u))),
    j = Math.max(0, Math.min(127, Math.floor(v))),
    p = Math.max(0, Math.min(1, u - i)),
    q = Math.max(0, Math.min(1, v - j)),
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
const S = (c, s) => (c.far ? 'far' : s);
const clean = (r) => {
  const p = r.slice();
  if (Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.001) p.pop();
  return p;
};
const area = (r) =>
  r.reduce((v, p, i) => {
    const q = r[(i + 1) % r.length];
    return v + p[0] * q[1] - q[0] * p[1];
  }, 0);
const cw = (r) => {
  const p = clean(r);
  return area(p) > 0 ? p.reverse() : p;
};
function Q(o, c, p, s = 'wall', color = C.wall, N) {
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
const B = (o, c, lo, hi, s = 'stone', color = C.trim) => box(o, S(c, s), lo, hi, color);
const L = (o, c, r, s = 'stone', color = C.stone, cap = true) =>
  loft(o, S(c, s), r, color, { cap });
const span = (o, c, A, Z, w = 0.1, d = 0.1, s = 'stone', color = C.trim) =>
  beam(o, S(c, s), A, Z, w, d, color);
function cap(o, c, rings, y, s = 'wall', color = C.wall, up = true) {
  const rs = rings.map(clean),
    ps = rs.flat(),
    holes = [];
  let n = rs[0].length;
  for (const r of rs.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ids = earcut(ps.flat(), holes, 2);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [ps[j][0], y, ps[j][1]]),
      s,
      color,
      [0, up ? 1 : -1, 0],
    );
}
function wall(o, c, A, Z, top, low, gate = false, s = 'wall', color = C.wall) {
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    P = (t, y) => [A[0] + dx * t, y, A[1] + dz * t],
    ts = [0, 1];
  if (gate && Math.abs(dx) > 1)
    for (let j = 0; j <= c.arch * 2; j++) {
      const x = H.gateX - H.gateRadius * Math.cos((j * Math.PI) / (c.arch * 2)),
        t = (x - A[0]) / dx;
      if (t > 0 && t < 1) ts.push(t);
    }
  ts.sort((a, b) => a - b);
  for (let j = 1; j < ts.length; j++) {
    const u = ts[j - 1],
      v = ts[j],
      x = A[0] + (dx * (u + v)) / 2,
      inside = gate && Math.abs(x - H.gateX) < H.gateRadius - 0.0001,
      Y = (t) =>
        inside
          ? H.gateSpring +
            Math.sqrt(Math.max(0, H.gateRadius ** 2 - (A[0] + dx * t - H.gateX) ** 2))
          : (low ?? livadiaGroundY(A[0] + dx * t, A[1] + dz * t) - 0.35);
    Q(o, c, [P(u, Y(u)), P(v, Y(v)), P(v, top), P(u, top)], s, color);
  }
}
const project = (A, Z, N) => {
  const len = Math.hypot(Z[0] - A[0], Z[1] - A[1]);
  return {
    len,
    P: (u, y, d = 0) => [
      A[0] + ((Z[0] - A[0]) * u) / len + N[0] * d,
      y,
      A[1] + ((Z[1] - A[1]) * u) / len + N[1] * d,
    ],
  };
};
function window(o, c, P, y, w, h, arched = false, door = false) {
  const radius = arched ? w / 2 : 0,
    spring = y + h - radius,
    outline = [
      [-w / 2, y],
      [w / 2, y],
      [w / 2, spring],
    ];
  if (arched)
    for (let j = 1; j <= c.arch * 2; j++) {
      const t = (j * Math.PI) / (c.arch * 2);
      outline.push([(Math.cos(t) * w) / 2, spring + (Math.sin(t) * w) / 2]);
    }
  else outline.push([-w / 2, y + h]);
  const q = outline.map(([u, v]) => P(u, v, 0.055)),
    ids = earcut(outline.flat(), [], 2),
    p0 = P(0, 0, 0),
    p1 = P(0, 0, 1),
    N = [p1[0] - p0[0], 0, p1[2] - p0[2]];
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => q[j]),
      door ? 'wood' : 'glass',
      door ? C.wood : C.glass,
      N,
    );
  if (c.flatFrames)
    for (const u of [-w / 2, w / 2])
      Q(
        o,
        c,
        [
          P(u - 0.06, y, 0.1),
          P(u + 0.06, y, 0.1),
          P(u + 0.06, spring, 0.1),
          P(u - 0.06, spring, 0.1),
        ],
        'stone',
        C.trim,
        N,
      );
  if (c.frames) {
    for (let j = 0; j < outline.length; j++) {
      const k = (j + 1) % outline.length;
      if (c.fine || !arched)
        span(o, c, P(...outline[j], 0.13), P(...outline[k], 0.13), 0.13, 0.13, 'wood', C.wood);
      else {
        const A = outline[j],
          Z = outline[k],
          dx = Z[0] - A[0],
          dy = Z[1] - A[1],
          n = Math.hypot(dx, dy);
        if (n > 0.00001) {
          const u = (-dy / n) * 0.065,
            v = (dx / n) * 0.065;
          Q(
            o,
            c,
            [
              P(A[0] - u, A[1] - v, 0.13),
              P(Z[0] - u, Z[1] - v, 0.13),
              P(Z[0] + u, Z[1] + v, 0.13),
              P(A[0] + u, A[1] + v, 0.13),
            ],
            'wood',
            C.wood,
            N,
          );
        }
      }
    }
    if (c.detail) {
      const count = c.fine ? 5 : 3;
      for (let j = 1; j < count; j++) {
        const Y = y + ((h - radius) * j) / count;
        span(o, c, P(-w / 2, Y, 0.11), P(w / 2, Y, 0.11), 0.04, 0.04, 'wood', C.wood);
      }
      span(o, c, P(0, y, 0.11), P(0, y + h, 0.11), 0.065, 0.065, 'wood', C.wood);
    }
    span(o, c, P(-w / 2 - 0.22, y - 0.12, 0.18), P(w / 2 + 0.22, y - 0.12, 0.18), 0.24, 0.2);
    if (!arched)
      span(
        o,
        c,
        P(-w / 2 - 0.22, y + h + 0.22, 0.18),
        P(w / 2 + 0.22, y + h + 0.22, 0.18),
        0.28,
        0.18,
      );
  }
}
function facade(
  o,
  c,
  A,
  Z,
  { eave = H.eave, upperOnly = false, lowerOnly = false, court = false } = {},
) {
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    len = Math.hypot(dx, dz),
    N = [-dz / len, dx / len],
    { P } = project(A, Z, N),
    bays = Math.max(1, Math.round(len / c.windowStep));
  if (c.far) return;
  for (let j = 0; j < bays; j++) {
    const u = ((j + 0.5) * len) / bays,
      p = P(u, 0),
      gate = Math.abs(p[0] - H.gateX) < 2.8 && p[2] < -6 && p[2] > -30,
      frontPavilion = p[0] > -18.8 && p[0] < -4.9 && p[2] < -24;
    const bottom = court ? Math.max(1.6, livadiaGroundY(p[0], p[2]) + 0.7) : 1.8,
      height = court ? Math.max(1.8, 6.2 - bottom) : 3.6;
    if (!upperOnly && !gate)
      window(
        o,
        c,
        (x, y, d) => P(u + x, y, d),
        bottom,
        Math.min(2.0, (len / bays) * 0.6),
        height,
        true,
        j === 0 && court,
      );
    if (!lowerOnly && !frontPavilion)
      window(o, c, (x, y, d) => P(u + x, y, d), 8.4, Math.min(1.9, (len / bays) * 0.6), 2.8, false);
    if (c.detail && j < bays - 1)
      span(
        o,
        c,
        P(((j + 1) * len) / bays, 1, 0.18),
        P(((j + 1) * len) / bays, eave - 0.3, 0.18),
        0.24,
        0.24,
      );
  }
  for (const y of c.flat ? [6.75, eave - 0.2] : [0.85, 6.75, 7.2, eave - 0.2]) {
    let segments = [[0, len]];
    if (y < 5 && Math.abs(dz) < 0.15 && A[1] < -6 && A[1] > -30 && Math.abs(dx) > 1) {
      const cuts = [H.gateX - H.gateRadius, H.gateX + H.gateRadius]
        .map((x) => ((x - A[0]) * len) / dx)
        .sort((a, b) => a - b);
      if (cuts[0] < len && cuts[1] > 0)
        segments = [
          [0, Math.max(0, cuts[0])],
          [Math.min(len, cuts[1]), len],
        ];
    }
    for (const [u, v] of segments)
      if (v - u > 0.001) span(o, c, P(u, y, 0.1), P(v, y, 0.1), 0.2, 0.16);
  }
}
function deck(o, c, r, y) {
  cap(o, c, [r], y, 'stone', C.stone);
  cap(o, c, [r], y - 0.22, 'stone', C.stone, false);
  const p = cw(r);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    Q(
      o,
      c,
      [
        [p[i][0], y - 0.22, p[i][1]],
        [p[j][0], y - 0.22, p[j][1]],
        [p[j][0], y, p[j][1]],
        [p[i][0], y, p[i][1]],
      ],
      'stone',
      C.stone,
    );
  }
}
function balustrade(o, c, A, Z, y, spacing = 1.15) {
  const len = Math.hypot(Z[0] - A[0], Z[1] - A[1]);
  if (c.far) {
    span(o, c, [A[0], y + 0.35, A[1]], [Z[0], y + 0.35, Z[1]], 0.28, 0.7);
    return;
  }
  span(o, c, [A[0], y + 0.08, A[1]], [Z[0], y + 0.08, Z[1]], 0.27, 0.16);
  span(o, c, [A[0], y + 1.08, A[1]], [Z[0], y + 1.08, Z[1]], 0.3, 0.16);
  if (c.flat) return;
  const count = Math.max(1, Math.round(len / spacing));
  for (let j = 0; j <= count; j++) {
    const x = A[0] + ((Z[0] - A[0]) * j) / count,
      z = A[1] + ((Z[1] - A[1]) * j) / count;
    if (c.detail)
      L(
        o,
        c,
        [
          [y + 0.16, 0.13],
          [y + 0.27, 0.13],
          [y + 0.47, 0.18],
          [y + 0.7, 0.12],
          [y + 0.94, 0.1],
          [y + 1, 0.13],
        ].map(([v, r]) => radialRing(v, r, r, c.fine ? 12 : 6, [x, z])),
        'stone',
        C.trim,
      );
    else span(o, c, [x, y + 0.16, z], [x, y + 1, z], 0.14, 0.14);
  }
}
function column(o, c, x, z, base, top) {
  if (c.far) {
    span(o, c, [x, base, z], [x, top, z], 0.5, 0.5);
    return;
  }
  const ring = (y, r) => radialRing(y, r, r, c.n, [x, z]),
    profile = c.detail
      ? [
          [base, 0.31],
          [base + 0.12, 0.31],
          [base + 0.25, 0.24],
          [top - 0.36, 0.2],
          [top - 0.2, 0.28],
          [top, 0.33],
        ]
      : [
          [base, 0.28],
          [top - 0.2, 0.23],
          [top, 0.33],
        ];
  L(
    o,
    c,
    profile.map(([y, r]) => ring(y, r)),
    'stone',
    C.trim,
  );
  B(o, c, [x - 0.36, top, z - 0.36], [x + 0.36, top + 0.16, z + 0.36]);
}
export const livadiaCourtEdges = () => {
  const [x0, z0, x1, z1] = H.court;
  return [
    { id: 'west', A: [x0, z1], Z: [x0, z0], N: [-1, 0], long: true },
    { id: 'north', A: [x0, z0], Z: [x1, z0], N: [0, -1] },
    { id: 'east', A: [x1, z0], Z: [x1, z1], N: [1, 0], long: true },
    { id: 'south', A: [x1, z1], Z: [x0, z1], N: [0, 1] },
  ];
};
function arcade(o, c, e, { garden = false } = {}) {
  const { len, P } = project(e.A, e.Z, e.N),
    count = garden ? c.loggiaBays : c.bays[e.long ? 1 : 0],
    bay = len / count,
    spring = garden ? 3.4 : 4.5,
    top = H.galleryTop,
    depth = garden ? H.loggia.depth : H.galleryDepth,
    out = [-e.N[0], 0, -e.N[1]],
    base = (u, d = 0) => {
      const p = P(u, 0, d);
      return garden ? H.terraceY : livadiaGroundY(p[0], p[2]) + 0.12;
    };
  for (let j = 0; j <= count; j++) {
    if (!garden && j === count) continue;
    const p = P(j * bay, 0, 0.22);
    column(o, c, p[0], p[2], base(j * bay, 0.22), spring);
  }
  for (let j = 0; j < count; j++) {
    const mid = (j + 0.5) * bay,
      r = c.far ? 0 : Math.min(1.6, (bay - 0.56) / 2),
      left = mid - r,
      right = mid + r;
    if (c.far) {
      Q(
        o,
        c,
        [P(j * bay, 6, 0), P((j + 1) * bay, 6, 0), P((j + 1) * bay, top, 0), P(j * bay, top, 0)],
        'stone',
        C.stone,
        out,
      );
    } else {
      for (const [u, v] of [
        [j * bay, left],
        [right, (j + 1) * bay],
      ])
        for (const d of [0, 0.44])
          Q(
            o,
            c,
            [P(u, spring, d), P(v, spring, d), P(v, top, d), P(u, top, d)],
            'stone',
            C.stone,
            d === 0 ? out : out.map((v) => -v),
          );
      for (let k = 0; k < c.arch; k++) {
        const t = (k * Math.PI) / c.arch,
          Tt = ((k + 1) * Math.PI) / c.arch,
          u = mid - r * Math.cos(t),
          v = mid - r * Math.cos(Tt),
          y = spring + r * Math.sin(t),
          Y = spring + r * Math.sin(Tt);
        for (const d of [0, 0.44])
          Q(
            o,
            c,
            [P(u, y, d), P(v, Y, d), P(v, top, d), P(u, top, d)],
            'stone',
            C.stone,
            d === 0 ? out : out.map((v) => -v),
          );
        Q(
          o,
          c,
          [P(u, y, 0), P(u, y, 0.44), P(v, Y, 0.44), P(v, Y, 0)],
          'stone',
          C.stone,
          [0, -1, 0],
        );
      }
    }
    const corners = [
      P(j * bay, 0, 0),
      P((j + 1) * bay, 0, 0),
      P((j + 1) * bay, 0, depth),
      P(j * bay, 0, depth),
    ];
    Q(
      o,
      c,
      corners.map(([x, , z]) => [x, garden ? H.terraceY : livadiaGroundY(x, z) + 0.12, z]),
      'stone',
      C.stone,
      [0, 1, 0],
    );
  }
  Q(
    o,
    c,
    [P(0, top, 0), P(len, top, 0), P(len, top, depth), P(0, top, depth)],
    'stone',
    C.stone,
    [0, -1, 0],
  );
  Q(
    o,
    c,
    [P(0, top + 0.2, 0), P(len, top + 0.2, 0), P(len, top + 0.2, depth), P(0, top + 0.2, depth)],
    'stone',
    C.stone,
    [0, 1, 0],
  );
  balustrade(o, c, e.A, e.Z, top + 0.2, c.detail ? 0.85 : 2);
  Q(
    o,
    c,
    [P(0, top, 0), P(len, top, 0), P(len, top + 0.2, 0), P(0, top + 0.2, 0)],
    'stone',
    C.stone,
    out,
  );
  if (!c.far && !garden) {
    const A = P(0, 0, depth),
      Z = P(len, 0, depth);
    facade(o, c, [A[0], A[2]], [Z[0], Z[2]], { court: true });
  }
}
function gate(o, c) {
  const x = H.gateX,
    r = H.gateRadius,
    spring = H.gateSpring,
    z0 = -29,
    z1 = -6.35,
    P = (u, y, z) => [x + u, y, z],
    n = c.arch * 2;
  for (let j = 0; j < n; j++) {
    const t = (j * Math.PI) / n,
      v = ((j + 1) * Math.PI) / n,
      u = -r * Math.cos(t),
      U = -r * Math.cos(v),
      y = spring + r * Math.sin(t),
      Y = spring + r * Math.sin(v);
    Q(o, c, [P(u, y, z0), P(U, Y, z0), P(U, Y, z1), P(u, y, z1)], 'stone', C.stone, [0, -1, 0]);
    if (!c.far)
      for (const z of [z0, z1])
        Q(
          o,
          c,
          [
            P(u, y, z),
            P(U, Y, z),
            P(-(r + 0.3) * Math.cos(v), spring + (r + 0.3) * Math.sin(v), z),
            P(-(r + 0.3) * Math.cos(t), spring + (r + 0.3) * Math.sin(t), z),
          ],
          'stone',
          C.trim,
          [0, 0, z === z0 ? -1 : 1],
        );
  }
  const floor = (z) =>
    H.terraceY + ((livadiaGroundY(x, z1) + 0.12 - H.terraceY) * (z - z0)) / (z1 - z0);
  for (const u of [-r, r])
    Q(
      o,
      c,
      [P(u, floor(z0), z0), P(u, spring, z0), P(u, spring, z1), P(u, floor(z1), z1)],
      'stone',
      C.stone,
      [u < 0 ? 1 : -1, 0, 0],
    );
  for (let j = 0; j < 6; j++) {
    const z = z0 + ((z1 - z0) * j) / 6,
      Z = z0 + ((z1 - z0) * (j + 1)) / 6;
    Q(
      o,
      c,
      [P(-r, floor(z), z), P(r, floor(z), z), P(r, floor(Z), Z), P(-r, floor(Z), Z)],
      'stone',
      C.stone,
      [0, 1, 0],
    );
  }
}
function tower(o, c) {
  const r = H.tower,
    ring = [
      [r[0], r[1]],
      [r[2], r[1]],
      [r[2], r[3]],
      [r[0], r[3]],
    ],
    p = cw(ring);
  for (let i = 0; i < 4; i++) wall(o, c, p[i], p[(i + 1) % 4], H.towerEave, H.eave);
  cap(o, c, [p], H.towerEave);
  deck(
    o,
    c,
    [
      [r[0] - 0.5, r[1] - 0.5],
      [r[2] + 0.5, r[1] - 0.5],
      [r[2] + 0.5, r[3] + 0.5],
      [r[0] - 0.5, r[3] + 0.5],
    ],
    H.towerEave + 0.35,
  );
  if (!c.far)
    for (let i = 0; i < 4; i++) {
      const A = p[i],
        Z = p[(i + 1) % 4],
        dx = Z[0] - A[0],
        dz = Z[1] - A[1],
        len = Math.hypot(dx, dz),
        N = [-dz / len, dx / len],
        { P } = project(A, Z, N);
      for (let j = 0; j < 3; j++)
        window(o, c, (u, y, d) => P(len / 2 + (j - 1) * 1.8 + u, y, d), 15.3, 1.2, 3.8, true);
      span(o, c, P(0.3, 20.4, 0.15), P(len - 0.3, 20.4, 0.15), 0.4, 0.3);
      span(o, c, P(0.2, 14.3, 0.12), P(len - 0.2, 14.3, 0.12), 0.3, 0.2);
      if (c.detail)
        for (const u of [0.5, len - 0.5])
          span(o, c, P(u, H.eave, 0.12), P(u, 20.2, 0.12), 0.3, 0.3);
    }
  const top = [
    [r[0] + 0.5, r[1] + 0.5],
    [r[2] - 0.5, r[1] + 0.5],
    [r[2] - 0.5, r[3] - 0.5],
    [r[0] + 0.5, r[3] - 0.5],
  ];
  for (let i = 0; i < 4; i++)
    wall(o, c, cw(top)[i], cw(top)[(i + 1) % 4], H.towerEave + 1.35, H.towerEave + 0.35);
  cap(o, c, [top], H.towerEave + 1.35, 'roof', C.roof);
}
function terrace(o, c) {
  const [x0, z0, x1, z1] = H.terrace,
    r = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
  for (let i = 0; i < 4; i++)
    wall(o, c, cw(r)[i], cw(r)[(i + 1) % 4], H.terraceY, undefined, false, 'stone', C.stone);
  cap(o, c, [r], H.terraceY, 'stone', C.stone);
  // Three original broad stepped flights meet the unmodified approximate field.
  for (const x of [-28, 0, 25]) {
    const bottom = livadiaGroundY(x, z0 - 5) + 0.12,
      n = c.far ? 1 : c.flat ? 3 : 9;
    for (let j = 0; j < n; j++) {
      const z = z0 - 5 + (j * 5) / n,
        y = bottom + ((H.terraceY - bottom) * (j + 1)) / n;
      B(
        o,
        c,
        [x - 2, bottom - 0.2, z],
        [x + 2, Math.max(bottom + 0.02, y), z + 5 / n + 0.02],
        'stone',
        C.stone,
      );
    }
  }
}
function fountain(o, c) {
  const x = (H.court[0] + H.court[2]) / 2,
    z = (H.court[1] + H.court[3]) / 2,
    y = livadiaGroundY(x, z) + 0.12,
    n = c.n,
    ring = (v, r) => radialRing(y + v, r, r, n, [x, z]);
  L(
    o,
    c,
    [
      ring(0, 2.25),
      ring(0.18, 2.25),
      ring(0.18, 1.95),
      ring(0.48, 1.9),
      ring(0.62, 2.04),
      ring(0.72, 2.04),
      ring(0.72, 1.83),
      ring(0.55, 1.83),
    ],
    'stone',
    C.stone,
    false,
  );
  cap(
    o,
    c,
    [radialRing(0, 1.82, 1.82, n, [x, z]).map((p) => [p[0], p[2]])],
    y + 0.56,
    'water',
    C.water,
  );
  L(
    o,
    c,
    [
      [0.55, 0.36],
      [0.8, 0.3],
      [2.3, 0.25],
      [2.5, 0.65],
      [2.7, 0.85],
      [2.9, 0.85],
      [2.9, 0.62],
      [2.76, 0.62],
    ].map(([v, r]) => ring(v, r)),
    'stone',
    C.stone,
    false,
  );
  cap(
    o,
    c,
    [radialRing(0, 0.61, 0.61, n, [x, z]).map((p) => [p[0], p[2]])],
    y + 2.77,
    'water',
    C.water,
  );
}
export function buildLivadiaLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Livadia tier ' + level);
  const outer = cw(c.far ? a.farOutline : a.outline),
    holes = [a.galleryHole, ...a.holes.slice(1)],
    rings = [outer, ...holes.map((h) => cw(h).reverse())];
  for (const r of rings)
    for (let i = 0; i < r.length; i++) {
      const A = r[i],
        Z = r[(i + 1) % r.length];
      wall(o, c, A, Z, H.eave, undefined, Math.abs(A[1] - Z[1]) < 0.15 && A[1] < -6 && A[1] > -30);
    }
  cap(o, c, rings, H.eave, 'roof', C.roof);
  // All four court/lightwell voids stay open through the opaque roof.
  for (let i = 0; i < outer.length; i++) {
    const A = outer[i],
      Z = outer[(i + 1) % outer.length],
      len = Math.hypot(Z[0] - A[0], Z[1] - A[1]);
    if ((len > 5 || (len > 0.8 && A[0] > 37 && Z[0] > 37 && i % 3 === 0)) && !c.far)
      facade(o, c, A, Z);
    if (len > 3 && !c.far) balustrade(o, c, A, Z, H.eave, c.fine ? 0.95 : 1.05);
  }
  for (const e of livadiaCourtEdges()) arcade(o, c, e);
  const [x0, z0, x1, z1] = H.court,
    d = H.galleryDepth;
  for (const [x, z, sx, sz] of [
    [x0, z0, -1, -1],
    [x1, z0, 1, -1],
    [x1, z1, 1, 1],
    [x0, z1, -1, 1],
  ]) {
    const r = [
      [x, z],
      [x + sx * d, z],
      [x + sx * d, z + sz * d],
      [x, z + sz * d],
    ];
    Q(
      o,
      c,
      r.map(([x, z]) => [x, livadiaGroundY(x, z) + 0.12, z]),
      'stone',
      C.stone,
      [0, 1, 0],
    );
    deck(o, c, r, H.galleryTop + 0.2);
  }
  arcade(
    o,
    c,
    { A: [H.loggia.x0, H.loggia.z], Z: [H.loggia.x1, H.loggia.z], N: [0, 1] },
    { garden: true },
  );
  // Side returns join the garden loggia to its flanking mapped projections.
  for (const x of [H.loggia.x0, H.loggia.x1])
    Q(
      o,
      c,
      [
        [x, H.terraceY, H.loggia.z],
        [x, H.galleryTop, H.loggia.z],
        [x, H.galleryTop, H.loggia.z + H.loggia.depth],
        [x, H.terraceY, H.loggia.z + H.loggia.depth],
      ],
      'wall',
      C.wall,
      [x === H.loggia.x0 ? 1 : -1, 0, 0],
    );
  terrace(o, c);
  tower(o, c);
  gate(o, c);
  fountain(o, c);
  const p = H.pavilion,
    r = [
      [p[0], p[1]],
      [p[2], p[1]],
      [p[2], p[3]],
      [p[0], p[3]],
    ],
    rr = cw(r);
  for (let i = 0; i < 4; i++) wall(o, c, rr[i], rr[(i + 1) % 4], H.pavilionEave, H.eave);
  cap(o, c, [r], H.pavilionEave, 'roof', C.roof);
  if (!c.far) {
    const A = [p[2], p[1]],
      Z = [p[0], p[1]],
      { len, P } = project(A, Z, [0, -1]);
    for (let j = 0; j < 3; j++)
      window(o, c, (u, y, d) => P(((j + 0.5) * len) / 3 + u, y, d), 7.7, 2.8, 4.8, true);
    balustrade(o, c, A, Z, H.pavilionEave, 0.85);
    if (c.detail) {
      for (let j = 0; j < 3; j++) {
        const u = ((j + 0.5) * len) / 3;
        span(o, c, P(u - 0.7, 13.4, 0.25), P(u + 0.7, 13.4, 0.25), 0.8, 0.35);
      }
    }
    // Low roof lanterns lie outside the four retained open lightwells.
    for (const [x, z] of [
      [8, -1],
      [31, -9],
      [-30, 19],
    ]) {
      B(o, c, [x - 1.6, H.eave, z - 1.1], [x + 1.6, H.eave + 0.8, z + 1.1], 'wall', C.wall);
      B(o, c, [x - 1.7, H.eave + 0.8, z - 1.2], [x + 1.7, H.eave + 1, z + 1.2], 'roof', C.roof);
    }
  }
}
export const buildLivadiaSkyline = (o) => buildLivadiaLevel(o, 'skyline');
export const buildLivadiaDistrict = (o) => buildLivadiaLevel(o, 'district');
export const buildLivadiaStreet = (o) => buildLivadiaLevel(o, 'street');
export const buildLivadiaCloseup = (o) => buildLivadiaLevel(o, 'closeup');

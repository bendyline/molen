/** Original Stockholm Palace:main quadrangle,projecting wings andcurved guard galleries. Meters,+Y up,+X ENE,+Z SSE. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const stockholmControls = JSON.parse(
  readFileSync(new URL('../layout.json', import.meta.url)),
);
const a = stockholmControls,
  H = a.controls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  wall: lin('bea28c'),
  stone: lin('d6ccb6'),
  trim: lin('e0d7c0'),
  base: lin('aaa89b'),
  roof: lin('74a898'),
  darkRoof: lin('59615d'),
  glass: lin('5d7481'),
  wood: lin('d0c7ae'),
  darkDoor: lin('627172'),
  metal: lin('62736b'),
  gold: lin('c8ac64'),
  paving: lin('b4a79d'),
  pavingDark: lin('998f87'),
};
export const stockholmSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.86, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.84, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.88, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.7, metallic: 0.15 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.36, metallic: 0.06 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.81, metallic: 0 },
};
const cfg = {
  skyline: { far: true, n: 4, arch: 1, guardBays: 3, roofSteps: 6, windowStep: 99, dormers: 0 },
  district: { flat: true, n: 4, arch: 2, guardBays: 6, roofSteps: 6, windowStep: 15, dormers: 1 },
  street: {
    flatFrames: true,
    n: 6,
    arch: 5,
    guardBays: 14,
    roofSteps: 12,
    windowStep: 7.7,
    dormers: 2,
  },
  closeup: {
    frames: true,
    detail: true,
    n: 8,
    arch: 10,
    guardBays: 18,
    roofSteps: 20,
    windowStep: 5.8,
    dormers: 3,
  },
  master: {
    frames: true,
    detail: true,
    fine: true,
    n: 32,
    arch: 30,
    guardBays: 22,
    roofSteps: 52,
    windowStep: 5.8,
    dormers: 4,
  },
};
export function stockholmGroundY(x, z) {
  const u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters,
    n = g.size[0],
    i = Math.max(0, Math.min(n - 2, Math.floor(u))),
    j = Math.max(0, Math.min(g.size[1] - 2, Math.floor(v))),
    p = Math.max(0, Math.min(1, u - i)),
    q = Math.max(0, Math.min(1, v - j)),
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
      door ? C.darkDoor : C.glass,
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
      if (c.fine)
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
    if (c.fine) {
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
const rect = ([x0, z0, x1, z1]) =>
  cw([
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]);
function wall(o, c, A, Z, lo, hi, s = 'wall', color = C.wall, N) {
  if (hi - lo < 0.00001) return;
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
    N,
  );
}
function foundation(o, c, A, Z, top = H.floor) {
  const lo = (p) => Math.min(top - 0.04, stockholmGroundY(...p) - 0.3);
  Q(
    o,
    c,
    [
      [A[0], lo(A), A[1]],
      [Z[0], lo(Z), Z[1]],
      [Z[0], top, Z[1]],
      [A[0], top, A[1]],
    ],
    'base',
    C.base,
  );
}
function surfaceStrip(o, c, P, y, width = 0.35, depth = 0.12) {
  if (c.flat || c.flatFrames) {
    const A = P(0, y - width / 2, depth),
      Z = P(1, y - width / 2, depth),
      R = P(1, y + width / 2, depth),
      T = P(0, y + width / 2, depth);
    Q(o, c, [A, Z, R, T], 'stone', C.trim);
  } else span(o, c, P(0, y, depth), P(1, y, depth), width, 0.22);
}
function pillaster(o, c, P, y0, y1, round = false) {
  if (c.flat || c.flatFrames) {
    Q(
      o,
      c,
      [P(-0.35, y0, 0.15), P(0.35, y0, 0.15), P(0.35, y1, 0.15), P(-0.35, y1, 0.15)],
      'stone',
      C.trim,
    );
    return;
  }
  const p = P(0, 0, 0.2);
  if (round) {
    const r = (y, v) => radialRing(y, v, v, c.n, [p[0], p[2]]);
    L(
      o,
      c,
      [
        [y0, 0.48],
        [y0 + 0.3, 0.48],
        [y0 + 0.6, 0.32],
        [y1 - 0.6, 0.28],
        [y1 - 0.3, 0.48],
        [y1, 0.5],
      ].map(([y, v]) => r(y, v)),
      'stone',
      C.trim,
    );
  } else span(o, c, P(0, y0, 0.16), P(0, y1, 0.16), 0.75, 0.35);
  for (const y of [y0 + 0.25, y1 - 0.25]) span(o, c, P(-0.6, y, 0.18), P(0.6, y, 0.18), 0.4, 0.3);
}
function facade(o, c, A, Z, top, { court = false, low = false, portal = false } = {}) {
  if (c.far) return;
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    len = Math.hypot(dx, dz),
    N = [-dz / len, dx / len],
    { P } = project(A, Z, N),
    n = Math.max(1, Math.round(len / c.windowStep));
  for (let j = 0; j < n; j++) {
    const u = ((j + 0.5) * len) / n,
      w = Math.min(2.45, (len / n) * 0.5),
      W = (x, y, d) => P(u + x, y, d),
      mid = P(u, 0, 0),
      gap = portal && Math.abs(Math.abs(dx) < Math.abs(dz) ? mid[2] - H.gateCenterZ : mid[0]) < 7;
    if (!gap) window(o, c, W, H.floor + 1.25, w, 5.6, true, j % 6 === 1);
    window(o, c, W, low ? H.floor + 9.1 : H.floor + 11.2, w, 5.2);
    if (!low) window(o, c, W, H.floor + 20.4, w, 4.4);
    if (c.frames && !low) {
      const yy = H.floor + 17.0;
      if (c.fine) {
        span(o, c, W(-w / 2 - 0.2, yy, 0.23), W(w / 2 + 0.2, yy, 0.23), 0.3, 0.25);
      } else
        Q(
          o,
          c,
          [
            W(-w / 2 - 0.25, yy - 0.12, 0.15),
            W(w / 2 + 0.25, yy - 0.12, 0.15),
            W(w / 2 + 0.25, yy + 0.12, 0.15),
            W(-w / 2 - 0.25, yy + 0.12, 0.15),
          ],
          'stone',
          C.trim,
        );
      if (j % 2 === 0) {
        T(
          o,
          c,
          [W(-w * 0.7, yy + 0.5, 0.16), W(w * 0.7, yy + 0.5, 0.16), W(0, yy + 1.6, 0.16)],
          'stone',
          C.trim,
          [N[0], 0, N[1]],
        );
      }
    }
    if (j < n - 1) {
      const k = ((j + 1) * len) / n;
      if (!court || j % 2 === 0)
        pillaster(
          o,
          c,
          (x, y, d) => P(k + x, y, d),
          H.floor + 9.2,
          top - 0.7,
          c.detail && !court && j % 4 === 1,
        );
    }
  }
  for (const y of [H.floor + 0.6, H.baseTop, top - 0.35])
    surfaceStrip(o, c, (u, Y, d) => P(u * len, Y, d), y, c.flat ? 0.2 : 0.4);
  if (!c.flat && !low) surfaceStrip(o, c, (u, Y, d) => P(u * len, Y, d), H.mainMiddle, 0.32);
  if (!c.flat && !c.flatFrames)
    balustrade(o, { ...c, detail: c.fine }, A, Z, top, c.fine ? 1.0 : 2.0);
}
function arch(
  o,
  c,
  P,
  { center = 0, width = 4.2, spring = H.gateSpring, top = H.gateTop, depth = 1.0 } = {},
) {
  const r = width / 2,
    ry = Math.min(r, top - spring - 0.25),
    p0 = P(0, 0, 0),
    p1 = P(0, 0, 1),
    out = [p1[0] - p0[0], 0, p1[2] - p0[2]];
  for (let j = 0; j < c.arch; j++) {
    const t = (j * Math.PI) / c.arch,
      v = ((j + 1) * Math.PI) / c.arch,
      u = center - r * Math.cos(t),
      U = center - r * Math.cos(v),
      y = spring + ry * Math.sin(t),
      Y = spring + ry * Math.sin(v);
    for (const d of [0, -depth])
      Q(
        o,
        c,
        [P(u, y, d), P(U, Y, d), P(U, top, d), P(u, top, d)],
        'stone',
        C.stone,
        d === 0 ? out : out.map((v) => -v),
      );
    Q(
      o,
      c,
      [P(u, y, 0), P(u, y, -depth), P(U, Y, -depth), P(U, Y, 0)],
      'stone',
      C.stone,
      [0, -1, 0],
    );
  }
}
export function stockholmMainEdges() {
  const [x0, z0, x1, z1] = a.main;
  return [
    { id: 'west', A: [x0, z0], Z: [x0, z1], N: [-1, 0], center: H.gateCenterZ },
    { id: 'north', A: [x1, z0], Z: [x0, z0], N: [0, -1], center: 0 },
    { id: 'east', A: [x1, z1], Z: [x1, z0], N: [1, 0], center: H.gateCenterZ },
    { id: 'south', A: [x0, z1], Z: [x1, z1], N: [0, 1], center: 0 },
  ];
}
function rangeWall(o, c, e, top, { court = false } = {}) {
  const { len, P } = project(e.A, e.Z, e.N),
    vertical = Math.abs(e.Z[0] - e.A[0]) < 0.1,
    u = vertical
      ? (e.center - e.A[1]) * Math.sign(e.Z[1] - e.A[1])
      : (e.center - e.A[0]) * Math.sign(e.Z[0] - e.A[0]),
    w = !court && e.id === 'west' ? 20 : H.portalWidth;
  const point = (t) => {
    const p = P(t, 0, 0);
    return [p[0], p[2]];
  };
  foundation(o, c, e.A, e.Z);
  for (const [t0, t1] of [
    [0, u - w / 2],
    [u + w / 2, len],
  ])
    wall(o, c, point(t0), point(t1), H.floor, H.baseTop, 'base', C.base);
  wall(o, c, e.A, e.Z, H.baseTop, top, 'wall', C.wall, [e.N[0], 0, e.N[1]]);
  const n = !court && e.id === 'west' ? 3 : 1,
    bay = w / n;
  for (let j = 0; j < n; j++)
    arch(o, c, P, {
      center: u - w / 2 + (j + 0.5) * bay,
      width: bay - (n > 1 ? 1 : 0),
      depth: 1.1,
    });
  if (n > 1)
    for (let j = 1; j < n; j++) {
      const p = P(u - w / 2 + j * bay, 0, -0.1);
      B(o, c, [p[0] - 0.5, H.floor, p[2] - 0.5], [p[0] + 0.5, H.gateTop, p[2] + 0.5]);
    }
  facade(o, c, e.A, e.Z, top, { court, portal: true });
}
export function stockholmCourtEdges() {
  const [x0, z0, x1, z1] = a.court;
  return [
    { id: 'west', A: [x0, z1], Z: [x0, z0], N: [1, 0], center: H.gateCenterZ },
    { id: 'north', A: [x0, z0], Z: [x1, z0], N: [0, 1], center: 0 },
    { id: 'east', A: [x1, z0], Z: [x1, z1], N: [-1, 0], center: H.gateCenterZ },
    { id: 'south', A: [x1, z1], Z: [x0, z1], N: [0, -1], center: 0 },
  ];
}
function passage(o, c, outer, inner) {
  const v = Math.abs(outer.A[0] - outer.Z[0]) < 0.1,
    x = v ? outer.A[0] : 0,
    z = v ? H.gateCenterZ : outer.A[1],
    X = v ? inner.A[0] : 0,
    Z = v ? H.gateCenterZ : inner.A[1],
    w = H.portalWidth / 2;
  const P = (u, y, t) => [x + (X - x) * t + (v ? 0 : u), y, z + (Z - z) * t + (v ? u : 0)];
  Q(
    o,
    c,
    [P(-w, H.floor, 0), P(w, H.floor, 0), P(w, H.floor, 1), P(-w, H.floor, 1)],
    'base',
    C.paving,
    [0, 1, 0],
  );
  for (const side of [-1, 1])
    Q(
      o,
      c,
      [
        P(side * w, H.floor, 0),
        P(side * w, H.floor, 1),
        P(side * w, H.gateTop, 1),
        P(side * w, H.gateTop, 0),
      ],
      'stone',
      C.stone,
      v ? [0, 0, -side] : [-side, 0, 0],
    );
  Q(
    o,
    c,
    [P(-w, H.gateTop, 0), P(w, H.gateTop, 0), P(w, H.gateTop, 1), P(-w, H.gateTop, 1)],
    'stone',
    C.stone,
    [0, -1, 0],
  );
}
function hipped(o, c, box, eave, top, inset = 3, color = C.roof) {
  const p = rect(box),
    [x0, z0, x1, z1] = box,
    dx = Math.min(inset, (x1 - x0) * 0.3),
    dz = Math.min(inset, (z1 - z0) * 0.3),
    q = rect([x0 + dx, z0 + dz, x1 - dx, z1 - dz]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      c,
      [
        [...p[i].slice(0, 1), eave, p[i][1]],
        [p[j][0], eave, p[j][1]],
        [q[j][0], top, q[j][1]],
        [q[i][0], top, q[i][1]],
      ],
      'roof',
      color,
      [0, 1, 0],
    );
  }
  cap(o, c, [q], top, 'roof', color);
}
const mainRoofBoxes = () => {
  const [x0, z0, x1, z1] = a.main,
    [cx0, cz0, cx1, cz1] = a.court;
  return [
    [x0, z0, x1, cz0],
    [x0, cz1, x1, z1],
    [x0, cz0, cx0, cz1],
    [cx1, cz0, x1, cz1],
  ];
};
export function stockholmRoofY(x, z) {
  let y = -Infinity;
  for (const [x0, z0, x1, z1] of mainRoofBoxes())
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) {
      const dx = Math.min(H.mainRoofInset, (x1 - x0) * 0.3),
        dz = Math.min(H.mainRoofInset, (z1 - z0) * 0.3),
        t = Math.max(0, Math.min(1, (x - x0) / dx, (x1 - x) / dx, (z - z0) / dz, (z1 - z) / dz));
      y = Math.max(y, H.mainEave + (H.mainRoof - H.mainEave) * t);
    }
  return y;
}
function westEntrance(o, c) {
  const P = (u, y, d = 0) => [a.main[0] - d, y, H.gateCenterZ + u];
  const back = a.main[0] + 6,
    half = H.portalWidth / 2;
  for (const [z0, z1] of [
    [H.gateCenterZ - 10, H.gateCenterZ - half],
    [H.gateCenterZ + half, H.gateCenterZ + 10],
  ]) {
    wall(o, c, [back, z0], [back, z1], H.floor, H.gateTop, 'stone', C.stone, [-1, 0, 0]);
    Q(
      o,
      c,
      [
        [a.main[0], H.gateTop, z0],
        [back, H.gateTop, z0],
        [back, H.gateTop, z1],
        [a.main[0], H.gateTop, z1],
      ],
      'stone',
      C.stone,
      [0, -1, 0],
    );
  }
  if (c.far) return;
  for (const side of [-1, 1])
    window(
      o,
      c,
      (u, y, d) => [back - d, y, H.gateCenterZ + (side * 20) / 3 + u],
      H.floor + 0.4,
      3.6,
      6.7,
      true,
      true,
    );
  Q(
    o,
    c,
    [
      P(-22, H.baseTop, 0.025),
      P(22, H.baseTop, 0.025),
      P(22, H.mainEave - 0.25, 0.025),
      P(-22, H.mainEave - 0.25, 0.025),
    ],
    'stone',
    C.stone,
    [-1, 0, 0],
  );
  for (let j = -3; j <= 3; j++) {
    const z = j * 5.8,
      Y = H.mainEave - 2.2,
      r = 0.65,
      n = c.fine ? 32 : c.detail ? 8 : 4;
    for (let k = 0; k < n; k++) {
      const t = (k * 2 * Math.PI) / n,
        v = ((k + 1) * 2 * Math.PI) / n;
      T(
        o,
        c,
        [
          P(z, Y, 0.12),
          P(z + r * Math.cos(t), Y + r * Math.sin(t), 0.12),
          P(z + r * Math.cos(v), Y + r * Math.sin(v), 0.12),
        ],
        'stone',
        C.trim,
        [-1, 0, 0],
      );
    }
    if (j < 3)
      pillaster(
        o,
        c,
        (u, y, d) => P(z + 2.9 + u, y, d + 0.12),
        H.baseTop + 0.15,
        H.mainEave - 0.5,
        c.detail,
      );
  }
  if (c.detail)
    for (const z of [-10, -10 / 3, 10 / 3, 10])
      column(o, c, a.main[0] - 0.42, H.gateCenterZ + z, H.floor, H.gateSpring);
}
function mainRoof(o, c) {
  const [x0, z0, x1, z1] = a.main,
    [cx0, cz0, cx1, cz1] = a.court,
    I = H.mainRoofInset;
  for (const r of mainRoofBoxes()) hipped(o, c, r, H.mainEave, H.mainRoof, I);
  const e = stockholmMainEdges();
  if (!c.far)
    for (const edge of e) {
      const { len, P } = project(edge.A, edge.Z, edge.N),
        n = c.dormers * 2;
      for (let j = 0; j < n; j++) {
        const u = ((j + 1) * len) / (n + 1),
          q = P(u, H.mainEave + 3, -2.6),
          w = 1.25,
          Y = stockholmRoofY(q[0], q[2]);
        B(o, c, [q[0] - 1, Y - 0.7, q[2] - 1], [q[0] + 1, Y + 1.6, q[2] + 1], 'roof', C.roof);
        window(o, c, (x, y, d) => P(u + x, y, -1.52 + d), Y - 0.3, w, 1.7);
        if (c.detail) {
          const p = P(u, 0, -4.8),
            seat = stockholmRoofY(p[0], p[2]);
          B(
            o,
            c,
            [p[0] - 0.55, seat - 0.15, p[2] - 0.55],
            [p[0] + 0.55, seat + 1.2, p[2] + 0.55],
            'roof',
            C.roof,
          );
        }
      }
    }
  if (c.far) return;
  const [x, z] = [-50, 8.6];
  span(o, c, [x, H.mainRoof, z], [x, H.mainRoof + 7, z], 0.1, 0.1, 'roof', C.metal);
  Q(
    o,
    c,
    [
      [x, H.mainRoof + 6.8, z],
      [x + 3, H.mainRoof + 6.8, z + 0.15],
      [x + 3, H.mainRoof + 5.2, z + 0.15],
      [x, H.mainRoof + 5.2, z],
    ],
    'roof',
    lin('799db4'),
    [0, 0, 1],
  );
}
function sampleChain(chain, t) {
  const lens = chain.slice(1).map((p, i) => Math.hypot(p[0] - chain[i][0], p[1] - chain[i][1])),
    total = lens.reduce((n, v) => n + v, 0);
  let at = t * total;
  for (let i = 0; i < lens.length; i++) {
    if (at <= lens[i] || i === lens.length - 1) {
      const u = Math.max(0, Math.min(1, at / lens[i]));
      return [
        chain[i][0] + (chain[i + 1][0] - chain[i][0]) * u,
        chain[i][1] + (chain[i + 1][1] - chain[i][1]) * u,
      ];
    }
    at -= lens[i];
  }
  return chain.at(-1);
}
export function stockholmGuardProbe(index, t) {
  const a = stockholmControls.guards.find((g) => g.index === index),
    A = sampleChain(a.inner, Math.max(0, t - 0.0001)),
    Z = sampleChain(a.inner, Math.min(1, t + 0.0001)),
    p = sampleChain(a.inner, t),
    len = Math.hypot(Z[0] - A[0], Z[1] - A[1]),
    N = [-(Z[1] - A[1]) / len, (Z[0] - A[0]) / len];
  if (N[0] * (p[0] + 82) + N[1] * (p[1] - 10) < 0)
    N.forEach((v, i) => {
      N[i] = -v;
    });
  return { p, N };
}
function guard(o, c, g) {
  const n = c.roofSteps,
    inner = Array.from({ length: n + 1 }, (_, j) => sampleChain(g.inner, j / n)),
    outer = Array.from({ length: n + 1 }, (_, j) => sampleChain(g.outer, j / n));
  for (let j = 0; j < n; j++) {
    const A = inner[j],
      Z = inner[j + 1],
      R = outer[j + 1],
      P = outer[j],
      M = A.map((v, i) => (v + P[i]) / 2),
      T = Z.map((v, i) => (v + R[i]) / 2),
      { N } = stockholmGuardProbe(g.index, (j + 0.5) / n);
    Q(
      o,
      c,
      [
        [A[0], H.guardEave, A[1]],
        [Z[0], H.guardEave, Z[1]],
        [T[0], H.guardRoof, T[1]],
        [M[0], H.guardRoof, M[1]],
      ],
      'roof',
      C.darkRoof,
      [0, 1, 0],
    );
    Q(
      o,
      c,
      [
        [M[0], H.guardRoof, M[1]],
        [T[0], H.guardRoof, T[1]],
        [R[0], H.guardEave, R[1]],
        [P[0], H.guardEave, P[1]],
      ],
      'roof',
      C.darkRoof,
      [0, 1, 0],
    );
    wall(o, c, P, R, H.floor, H.guardEave, 'wall', C.wall, [N[0], 0, N[1]]);
    wall(o, c, A, Z, H.guardCeiling, H.guardEave, 'stone', C.stone, [-N[0], 0, -N[1]]);
    foundation(o, c, P, R);
    const back = (p, t) => {
        const { N } = stockholmGuardProbe(g.index, t);
        return [p[0] + N[0] * H.guardGalleryDepth, p[1] + N[1] * H.guardGalleryDepth];
      },
      B = back(A, j / n),
      D = back(Z, (j + 1) / n);
    wall(o, c, B, D, H.floor, H.guardCeiling, 'stone', C.stone, [-N[0], 0, -N[1]]);
    Q(
      o,
      c,
      [
        [A[0], H.guardCeiling, A[1]],
        [Z[0], H.guardCeiling, Z[1]],
        [D[0], H.guardCeiling, D[1]],
        [B[0], H.guardCeiling, B[1]],
      ],
      'stone',
      C.stone,
      [0, -1, 0],
    );
    if (c.detail && j % 3 === 0) {
      const q = M.map((v, i) => (v + T[i]) / 2);
      BGuardVent(o, c, q);
    }
  }
  for (const j of [0, n]) {
    const k = j === 0 ? 1 : n - 1,
      N = [inner[j][0] - inner[k][0], 0, inner[j][1] - inner[k][1]];
    wall(o, c, inner[j], outer[j], H.floor, H.guardEave, 'stone', C.stone, N);
    T(
      o,
      c,
      [
        [inner[j][0], H.guardEave, inner[j][1]],
        [outer[j][0], H.guardEave, outer[j][1]],
        [0.5 * (inner[j][0] + outer[j][0]), H.guardRoof, 0.5 * (inner[j][1] + outer[j][1])],
      ],
      'roof',
      C.darkRoof,
      N,
    );
  }
  for (let j = 0; j <= c.guardBays; j++) {
    const { p, N } = stockholmGuardProbe(g.index, j / c.guardBays),
      x = p[0] + N[0] * 0.25,
      z = p[1] + N[1] * 0.25;
    column(o, c, x, z, H.floor, H.guardCeiling - 0.2);
    if (!c.far && j < c.guardBays) {
      const t = (j + 0.5) / c.guardBays,
        { p, N } = stockholmGuardProbe(g.index, t),
        U = [N[1], -N[0]],
        W = (u, y, d) => [
          p[0] + N[0] * (H.guardGalleryDepth - d) + U[0] * u,
          y,
          p[1] + N[1] * (H.guardGalleryDepth - d) + U[1] * u,
        ];
      window(o, c, W, H.floor + 1, 2, 4.6, false, j % 3 === 1);
    }
  }
  if (!c.far)
    for (let j = 0; j < n; j++)
      span(
        o,
        c,
        [inner[j][0], H.guardEave + 0.12, inner[j][1]],
        [inner[j + 1][0], H.guardEave + 0.12, inner[j + 1][1]],
        0.18,
        0.2,
        'roof',
        C.roof,
      );
  cap(o, c, [g.outline], H.floor, 'base', C.paving);
}
function BGuardVent(o, c, [x, z]) {
  B(
    o,
    c,
    [x - 0.4, H.guardRoof - 0.1, z - 0.4],
    [x + 0.4, H.guardRoof + 0.65, z + 0.4],
    'roof',
    C.roof,
  );
}
function guardOuterWindows(o, c, g) {
  if (c.far) return;
  const n = c.guardBays;
  for (let j = 0; j < n; j++) {
    const t = (j + 0.5) / n,
      p = sampleChain(g.outer, t),
      A = sampleChain(g.outer, Math.max(0, t - 0.0001)),
      Z = sampleChain(g.outer, Math.min(1, t + 0.0001)),
      L = Math.hypot(Z[0] - A[0], Z[1] - A[1]),
      U = [(Z[0] - A[0]) / L, (Z[1] - A[1]) / L],
      N = [-U[1], U[0]];
    if (N[0] * (p[0] + 82) + N[1] * (p[1] - 10) < 0) {
      N[0] = -N[0];
      N[1] = -N[1];
    }
    const P = (u, y, d) => [p[0] + U[0] * u + N[0] * d, y, p[1] + U[1] * u + N[1] * d];
    window(o, c, P, H.floor + 1.2, 1.65, 4.5, false, j % 6 === 2);
  }
}
function wing(o, c, w) {
  const r = rect(w.box);
  for (let i = 0; i < 4; i++) {
    const A = r[i],
      Z = r[(i + 1) % 4];
    foundation(o, c, A, Z);
    wall(o, c, A, Z, H.floor, H.wingEave);
    facade(o, c, A, Z, H.wingEave, { low: true });
  }
  hipped(o, c, w.box, H.wingEave, H.wingRoof, 2.4);
}
function northTerrace(o, c) {
  const r = rect([-105.96, -69.4, 105.8, -50.5]),
    y = H.floor - 4.0;
  cap(o, c, [r], y, 'base', C.base);
  for (let i = 0; i < 4; i++) foundation(o, c, r[i], r[(i + 1) % 4], y);
  if (c.far) return;
  const stairs = (x, z, w, run, rise, axis = 0) => {
    const n = c.flat ? 3 : 8;
    for (let j = 0; j < n; j++) {
      const y0 =
          stockholmGroundY(x, z) + 0.1 + ((H.floor - stockholmGroundY(x, z) - 0.1) * (j + 1)) / n,
        zz = z + (run * j) / n;
      B(
        o,
        c,
        [x - w / 2, Math.min(stockholmGroundY(x, zz) - 0.15, y0 - 0.1), zz],
        [x + w / 2, y0, zz + run / n],
        'base',
        C.base,
      );
    }
  };
  stairs(-27, -68, 9, 16, 4);
  stairs(27, -68, 9, 16, 4);
}
function paving(o, c) {
  cap(o, c, [rect(a.main)], H.floor, 'base', C.paving);
  cap(o, c, [a.guardCourt], H.floor, 'base', C.paving);
  const court = rect(a.court);
  if (c.detail) {
    for (const r of [court, rect([-113, -18, -60, 39])]) {
      const xs = r.map((p) => p[0]),
        zs = r.map((p) => p[1]),
        x0 = Math.min(...xs),
        x1 = Math.max(...xs),
        z0 = Math.min(...zs),
        z1 = Math.max(...zs);
      for (let x = x0 + 3; x < x1 - 3; x += 12)
        span(
          o,
          c,
          [x, H.floor + 0.008, z0 + 2],
          [x, H.floor + 0.008, z1 - 2],
          0.22,
          0.016,
          'base',
          C.pavingDark,
        );
    }
  }
}
function approach(o, c) {
  const r = cw(a.approach),
    top = ([x, z]) => (x < -128 ? Math.min(H.floor - 0.1, stockholmGroundY(x, z) + 0.1) : H.floor);
  Q(
    o,
    c,
    r.map(([x, z]) => [x, top([x, z]), z]),
    'base',
    C.paving,
    [0, 1, 0],
  );
  for (let i = 0; i < r.length; i++) {
    const A = r[i],
      Z = r[(i + 1) % r.length],
      lo = (p) => Math.min(top(p) - 0.08, stockholmGroundY(...p) - 0.2);
    Q(
      o,
      c,
      [
        [A[0], lo(A), A[1]],
        [Z[0], lo(Z), Z[1]],
        [Z[0], top(Z), Z[1]],
        [A[0], top(A), A[1]],
      ],
      'base',
      C.base,
    );
  }
}
export function buildStockholmLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Stockholm tier ' + level);
  const outer = stockholmMainEdges(),
    inner = stockholmCourtEdges();
  for (let i = 0; i < 4; i++) {
    rangeWall(o, c, outer[i], H.mainEave);
    rangeWall(o, c, inner[i], H.mainEave, { court: true });
    passage(o, c, outer[i], inner[i]);
  }
  mainRoof(o, c);
  for (const w of a.wings) wing(o, c, w);
  northTerrace(o, c);
  for (const g of a.guards) guard(o, c, g);
  for (const g of a.guards) guardOuterWindows(o, c, g);
  westEntrance(o, c);
  paving(o, c);
  approach(o, c);
}
export const buildStockholmSkyline = (o) => buildStockholmLevel(o, 'skyline');
export const buildStockholmDistrict = (o) => buildStockholmLevel(o, 'district');
export const buildStockholmStreet = (o) => buildStockholmLevel(o, 'street');
export const buildStockholmCloseup = (o) => buildStockholmLevel(o, 'closeup');

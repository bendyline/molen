/** Original complete Royal Palace of Madrid andArmeria. Meters,+Y up,+X NNE,+Z ESE. */
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
export const madridControls = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const a = madridControls,
  H = a.controls,
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  wall: lin('d8d3c5'),
  stone: lin('ddd6c7'),
  trim: lin('e2ddd0'),
  base: lin('b0b3ad'),
  roof: lin('8798a1'),
  glass: lin('627d8c'),
  wood: lin('d4d5ca'),
  metal: lin('59676d'),
  gold: lin('bea463'),
  paving: lin('b3afa1'),
  pavingDark: lin('93958c'),
};
export const madridSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.85, metallic: 0 },
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.84, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.82, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.86, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.65, metallic: 0.2 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.35, metallic: 0.07 },
  wood: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.8, metallic: 0 },
};
const cfg = {
  skyline: { far: true, n: 4, arch: 1, courtBays: 2, foreBays: 3, windowStep: 99 },
  district: { flat: true, n: 4, arch: 2, courtBays: 4, foreBays: 8, windowStep: 13 },
  street: { flatFrames: true, n: 6, arch: 4, courtBays: 9, foreBays: 24, windowStep: 9 },
  closeup: {
    frames: true,
    detail: true,
    n: 8,
    arch: 8,
    courtBays: 9,
    foreBays: 24,
    windowStep: 7.5,
  },
  master: {
    frames: true,
    detail: true,
    fine: true,
    n: 32,
    arch: 28,
    courtBays: 9,
    foreBays: 24,
    windowStep: 6.5,
  },
};
export function madridGroundY(x, z) {
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
function clipX(input, split = 0, greater = true) {
  const r = clean(input),
    out = [];
  for (let i = 0; i < r.length; i++) {
    const P = r[i],
      Z = r[(i + 1) % r.length],
      inside = greater ? P[0] >= split : P[0] <= split,
      next = greater ? Z[0] >= split : Z[0] <= split;
    if (inside) out.push(P);
    if (inside !== next) {
      const t = (split - P[0]) / (Z[0] - P[0]);
      out.push([split, P[1] + (Z[1] - P[1]) * t]);
    }
  }
  return out.filter(
    (p, i) => !i || Math.hypot(p[0] - out[i - 1][0], p[1] - out[i - 1][1]) > 0.00001,
  );
}
function planeCap(o, c, rings, y, greater, s = 'roof', color = C.roof) {
  const rs = rings.map(clean),
    ps = rs.flat(),
    holes = [];
  let n = rs[0].length;
  for (const r of rs.slice(1)) {
    holes.push(n);
    n += r.length;
  }
  const ids = earcut(ps.flat(), holes, 2);
  for (let i = 0; i < ids.length; i += 3) {
    const r = clipX(
      ids.slice(i, i + 3).map((j) => ps[j]),
      H.mainSplitX,
      greater,
    );
    if (r.length < 3) continue;
    for (let j = 1; j < r.length - 1; j++) {
      const tri = [r[0], r[j], r[j + 1]];
      if (Math.abs(area(tri)) > 0.000001)
        T(
          o,
          c,
          tri.map(([x, z]) => [x, y, z]),
          s,
          color,
          [0, 1, 0],
        );
    }
  }
}
function wall(o, c, A, Z, lo, hi, s = 'wall', color = C.wall) {
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
  );
}
function foundation(o, c, A, Z) {
  const lo = (p) => Math.min(H.floor - 0.02, madridGroundY(...p) - 0.35);
  Q(
    o,
    c,
    [
      [A[0], lo(A), A[1]],
      [Z[0], lo(Z), Z[1]],
      [Z[0], H.floor, Z[1]],
      [A[0], H.floor, A[1]],
    ],
    'base',
    C.base,
  );
}
function innerForecourt(A, Z) {
  const x = (A[0] + Z[0]) / 2,
    z = (A[1] + Z[1]) / 2;
  return (
    x < 4.5 &&
    x > -138 &&
    Math.abs(Z[1] - A[1]) < 1 &&
    [H.westInnerZ, H.eastInnerZ].some((v) => Math.abs(z - v) < 0.75)
  );
}
function splitEdge(A, Z) {
  if (A[0] * Z[0] >= 0 || Math.abs(A[0] - Z[0]) < 0.00001) return [[A, Z]];
  const t = -A[0] / (Z[0] - A[0]),
    M = [0, A[1] + (Z[1] - A[1]) * t];
  return [
    [A, M],
    [M, Z],
  ];
}
function outerWalls(o, c, outline) {
  for (let i = 0; i < outline.length; i++) {
    const A = outline[i],
      Z = outline[(i + 1) % outline.length];
    for (const [P, R] of splitEdge(A, Z)) {
      foundation(o, c, P, R);
      const main = (P[0] + R[0]) / 2 >= 0,
        top = main ? H.mainEave : H.lowEave,
        inner = innerForecourt(P, R);
      if (inner) {
        wall(o, c, P, R, H.forecourtGalleryTop, top, 'stone', C.stone);
        continue;
      }
      wall(o, c, P, R, H.floor, Math.min(top, H.baseTop), 'base', C.base);
      if (top > H.baseTop) wall(o, c, P, R, H.baseTop, top);
    }
  }
}
function rails(o, c, A, Z, y, spacing = 1.6) {
  if (c.far || c.flat) return;
  balustrade(
    o,
    c.fine ? c : { ...c, detail: false, flat: c.flatFrames },
    A,
    Z,
    y,
    c.fine ? 0.95 : spacing,
  );
}
function order(o, c, P, y0, y1, { round = false } = {}) {
  const p = P(0, 0, 0.2);
  if (c.flat || c.flatFrames) {
    Q(
      o,
      c,
      [P(-0.3, y0, 0.12), P(0.3, y0, 0.12), P(0.3, y1, 0.12), P(-0.3, y1, 0.12)],
      'stone',
      C.trim,
    );
    return;
  }
  if (round && c.detail) {
    const ring = (y, r) => radialRing(y, r, r, c.fine ? c.n : 6, [p[0], p[2]]);
    L(
      o,
      c,
      [
        [y0, 0.52],
        [y0 + 0.24, 0.52],
        [y0 + 0.45, 0.36],
        [y1 - 0.6, 0.31],
        [y1 - 0.28, 0.52],
        [y1, 0.56],
      ].map(([y, r]) => ring(y, r)),
      'stone',
      C.trim,
    );
  } else span(o, c, P(0, y0, 0.12), P(0, y1, 0.12), c.flat ? 0.45 : 0.62, c.flat ? 0.16 : 0.35);
  if (!c.flat) {
    span(o, c, P(-0.6, y0 + 0.2, 0.18), P(0.6, y0 + 0.2, 0.18), 0.4, 0.32);
    span(o, c, P(-0.6, y1 - 0.2, 0.18), P(0.6, y1 - 0.2, 0.18), 0.45, 0.32);
  }
}
function pediment(o, c, P, y, w, curved = false) {
  if (!c.frames) return;
  if (curved) {
    const r = w / 2;
    for (let j = 0; j < c.arch; j++) {
      const t = (j * Math.PI) / c.arch,
        v = ((j + 1) * Math.PI) / c.arch;
      span(
        o,
        c,
        P(-r * Math.cos(t), y + r * 0.42 * Math.sin(t), 0.24),
        P(-r * Math.cos(v), y + r * 0.42 * Math.sin(v), 0.24),
        0.2,
        0.16,
      );
    }
  } else {
    span(o, c, P(-w / 2, y, 0.24), P(0, y + w * 0.3, 0.24), 0.2, 0.16);
    span(o, c, P(0, y + w * 0.3, 0.24), P(w / 2, y, 0.24), 0.2, 0.16);
  }
}
function exteriorFacade(o, c, A, Z, { pavilion = false, junction = false } = {}) {
  if (c.far) return;
  const dx = Z[0] - A[0],
    dz = Z[1] - A[1],
    len = Math.hypot(dx, dz);
  if (len < 5) return;
  const N = [-dz / len, dx / len],
    { P } = project(A, Z, N),
    main = (A[0] + Z[0]) / 2 >= 0 || pavilion,
    top = pavilion ? H.pavilionEave : main ? H.mainEave : H.lowEave,
    count = Math.max(1, Math.round(len / c.windowStep));
  for (let j = 0; j < count; j++) {
    const u = ((j + 0.5) * len) / count,
      w = Math.min(2.6, (len / count) * 0.5),
      W = (v, y, d) => P(u + v, y, d);
    if (!pavilion && !junction)
      window(o, c, W, H.floor + 1.8, w, main ? 4.1 : 4.8, false, j % 7 === 0 && !main);
    if (main) {
      window(o, c, W, H.floor + 10, w, 5.4);
      if (!c.flat) window(o, c, W, H.floor + 17.6, w, 1.5);
      if (!pavilion) window(o, c, W, H.floor + 20.6, w, 3.2);
      if (!pavilion) pediment(o, c, W, H.floor + 15.8, w + 1, j % 2 === 0);
    }
    if (j < count - 1) {
      const k = ((j + 1) * len) / count;
      if (main)
        order(o, c, (v, y, d) => P(k + v, y, d), H.baseTop + 0.5, top - 0.7, { round: true });
    }
  }
  for (const y of main ? [H.baseTop - 0.3, H.baseTop, top - 0.45] : [H.floor + 0.9, top - 0.35]) {
    if (junction && y < H.lowEave) continue;
    if (c.flat)
      Q(
        o,
        c,
        [P(0, y - 0.12, 0.1), P(len, y - 0.12, 0.1), P(len, y + 0.12, 0.1), P(0, y + 0.12, 0.1)],
        'stone',
        C.trim,
      );
    else span(o, c, P(0, y, 0.1), P(len, y, 0.1), 0.35, 0.22);
  }
  if (!c.flat && !junction) {
    for (const y of [H.floor + 0.6, H.floor + 7.4])
      if (y < top) span(o, c, P(0, y, 0.08), P(len, y, 0.08), 0.18, 0.18);
  }
  rails(o, c, A, Z, top, 2.4);
}
export const madridCourtEdges = () => {
  const [x0, z0, x1, z1] = H.court;
  return [
    { id: 'north', A: [x1, z0], Z: [x1, z1], N: [1, 0] },
    { id: 'east', A: [x1, z1], Z: [x0, z1], N: [0, 1] },
    { id: 'south', A: [x0, z1], Z: [x0, z0], N: [-1, 0] },
    { id: 'west', A: [x0, z0], Z: [x1, z0], N: [0, -1] },
  ];
};
function archFront(o, c, e, count, spring, top, pierWidth) {
  const { len, P } = project(e.A, e.Z, e.N),
    bay = len / count,
    out = [-e.N[0], 0, -e.N[1]];
  for (let j = 0; j <= count; j++) {
    const u = j * bay;
    if (c.far) {
      span(o, c, P(u, H.floor, 0.25), P(u, top, 0.25), pierWidth, 0.5);
      continue;
    }
    const corners = [
      P(u - pierWidth / 2, 0, 0),
      P(u + pierWidth / 2, 0, 0),
      P(u + pierWidth / 2, 0, 0.85),
      P(u - pierWidth / 2, 0, 0.85),
    ].map((p) => [p[0], p[2]]);
    for (let i = 0; i < 4; i++)
      wall(o, c, cw(corners)[i], cw(corners)[(i + 1) % 4], H.floor, top, 'stone', C.stone);
    if (c.detail && e.id) {
      const p = P(u, 0, -0.3);
      column(o, c, p[0], p[2], H.floor, spring);
    }
  }
  if (c.far) {
    const Y = Math.min(top - 0.8, spring + 2);
    Q(o, c, [P(0, Y, 0), P(len, Y, 0), P(len, top, 0), P(0, top, 0)], 'stone', C.stone, out);
    return;
  }
  for (let j = 0; j < count; j++) {
    const mid = (j + 0.5) * bay,
      r = (bay - pierWidth) / 2,
      ry = Math.min(r, top - spring - 0.25);
    for (let k = 0; k < c.arch; k++) {
      const t = (k * Math.PI) / c.arch,
        Tt = ((k + 1) * Math.PI) / c.arch,
        u = mid - r * Math.cos(t),
        v = mid - r * Math.cos(Tt),
        y = spring + ry * Math.sin(t),
        Y = spring + ry * Math.sin(Tt);
      for (const d of [0, 0.85])
        Q(
          o,
          c,
          [P(u, y, d), P(v, Y, d), P(v, top, d), P(u, top, d)],
          'stone',
          C.stone,
          d === 0 ? out : out.map((v) => -v),
        );
      Q(o, c, [P(u, y, 0), P(u, y, 0.85), P(v, Y, 0.85), P(v, Y, 0)], 'stone', C.stone, [0, -1, 0]);
    }
  }
}
function courtGallery(o, c, e) {
  const { len, P } = project(e.A, e.Z, e.N),
    n = c.courtBays,
    depth = H.galleryDepth;
  archFront(o, c, e, n, H.arcadeSpring, H.arcadeTop, c.far ? 1.2 : 1.4);
  Q(
    o,
    c,
    [
      P(0, H.arcadeTop, 0),
      P(len, H.arcadeTop, 0),
      P(len, H.arcadeTop, depth),
      P(0, H.arcadeTop, depth),
    ],
    'stone',
    C.stone,
    [0, -1, 0],
  );
  Q(
    o,
    c,
    [
      P(0, H.arcadeTop + 0.2, 0),
      P(len, H.arcadeTop + 0.2, 0),
      P(len, H.arcadeTop + 0.2, depth),
      P(0, H.arcadeTop + 0.2, depth),
    ],
    'stone',
    C.stone,
    [0, 1, 0],
  );
  const A = P(0, 0, 0),
    Z = P(len, 0, 0);
  wall(o, c, [A[0], A[2]], [Z[0], Z[2]], H.arcadeTop, H.upperTerrace, 'wall', C.wall);
  if (!c.far)
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * len) / n,
        W = (x, y, d) => P(u + x, y, -d);
      window(o, c, W, H.floor + 10.0, Math.min(3.6, (len / n) * 0.65), 8.4, true);
      window(
        o,
        c,
        (x, y, d) => P(u + x, y, depth - d),
        H.floor + 1.0,
        Math.min(2.8, (len / n) * 0.55),
        6.0,
        true,
        j % 3 === 1,
      );
      window(
        o,
        c,
        (x, y, d) => P(u + x, y, depth - d),
        H.floor + 22.3,
        Math.min(2.6, (len / n) * 0.55),
        3.2,
      );
      if (j < n - 1)
        order(
          o,
          c,
          (x, y, d) => P(((j + 1) * len) / n + x, y, -d),
          H.arcadeTop + 0.2,
          H.upperTerrace - 0.2,
        );
    }
  rails(o, c, e.A, e.Z, H.upperTerrace, 1.6);
  if (!c.far)
    for (const y of [H.arcadeTop, H.upperTerrace - 0.2])
      span(o, c, P(0, y, -0.1), P(len, y, -0.1), 0.35, 0.3);
}
function forecourtGallery(o, c, e) {
  const { len, P } = project(e.A, e.Z, e.N),
    n = c.foreBays,
    depth = H.forecourtGalleryDepth;
  archFront(o, c, e, n, H.forecourtSpring, H.forecourtGalleryTop, c.far ? 1.2 : 1.4);
  for (const [up, Y] of [
    [false, H.forecourtGalleryTop],
    [true, H.forecourtGalleryTop + 0.2],
  ])
    Q(o, c, [P(0, Y, 0), P(len, Y, 0), P(len, Y, depth), P(0, Y, depth)], 'stone', C.stone, [
      0,
      up ? 1 : -1,
      0,
    ]);
  const A = P(0, 0, depth),
    Z = P(len, 0, depth);
  wall(o, c, [Z[0], Z[2]], [A[0], A[2]], H.floor, H.forecourtGalleryTop, 'wall', C.wall);
  if (!c.far)
    for (let j = 0; j < n; j++) {
      const u = ((j + 0.5) * len) / n;
      window(
        o,
        c,
        (x, y, d) => P(u + x, y, depth - d),
        H.floor + 0.8,
        Math.min(2.6, (len / n) * 0.5),
        5.8,
        true,
        j % 3 === 1,
      );
    }
}
function hip(o, c, r, eave, top, insetMeters = 2.4) {
  const p = cw(r),
    xs = p.map((p) => p[0]),
    zs = p.map((p) => p[1]),
    cx = (Math.min(...xs) + Math.max(...xs)) / 2,
    cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const q = p.map(([x, z]) => [
    x + Math.sign(cx - x) * Math.min(insetMeters, Math.abs(cx - x) * 0.8),
    z + Math.sign(cz - z) * Math.min(insetMeters, Math.abs(cz - z) * 0.8),
  ]);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    Q(
      o,
      c,
      [
        [p[i][0], eave, p[i][1]],
        [p[j][0], eave, p[j][1]],
        [q[j][0], top, q[j][1]],
        [q[i][0], top, q[i][1]],
      ],
      'roof',
      C.roof,
    );
  }
  cap(o, c, [q], top, 'roof', C.roof);
}
function clippedPavilion(o, c) {
  const r = cw(clipX(a.northeastPavilion, 0, false));
  for (let i = 0; i < r.length; i++) {
    wall(o, c, r[i], r[(i + 1) % r.length], H.lowEave, H.pavilionEave);
    if (
      !c.far &&
      Math.hypot(r[i][0] - r[(i + 1) % r.length][0], r[i][1] - r[(i + 1) % r.length][1]) > 5
    )
      exteriorFacade(o, c, r[i], r[(i + 1) % r.length], { pavilion: true });
  }
  cap(o, c, [r], H.pavilionEave, 'roof', C.roof);
}
function crown(o, c, r, height) {
  const p = cw(r);
  for (let i = 0; i < p.length; i++)
    wall(o, c, p[i], p[(i + 1) % p.length], H.mainEave, height, 'stone', C.stone);
  cap(o, c, [r], height, 'roof', C.roof);
  if (!c.far)
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      span(o, c, [p[i][0], height - 0.25, p[i][1]], [p[j][0], height - 0.25, p[j][1]], 0.45, 0.4);
    }
}
function urn(o, c, x, z, y) {
  const n = c.fine ? 16 : c.n,
    ring = (v, r) => radialRing(y + v, r, r, n, [x, z]);
  L(
    o,
    c,
    [
      [0, 0.4],
      [0.35, 0.4],
      [0.35, 0.22],
      [0.65, 0.22],
      [1, 0.5],
      [1.45, 0.38],
      [1.65, 0.2],
      [1.9, 0.05],
    ].map(([v, r]) => ring(v, r)),
    'stone',
    C.trim,
  );
}
function dome(o, c) {
  const [x, z] = H.domeCenter,
    n = c.n,
    ring = (y, r) => radialRing(y, r, r, n, [x, z]),
    base = H.domeBase;
  L(o, c, [ring(H.mainEave, 8.6), ring(base, 8.6), ring(base + 0.5, 8.9)], 'stone', C.stone);
  const p = [
    [base + 0.5, 8.1],
    [H.domeShoulder, 7.6],
    [H.domeShoulder + 3, 6.6],
    [H.domeTop - 2, 4.2],
    [H.domeTop, 1.3],
  ];
  L(
    o,
    c,
    p.map(([y, r]) => ring(y, r)),
    'roof',
    C.roof,
  );
  if (!c.far)
    for (let j = 0; j < (c.detail ? 12 : 6); j++) {
      const t = (j * 2 * Math.PI) / (c.detail ? 12 : 6);
      for (let k = 1; k < p.length; k++) {
        const [y, r] = p[k - 1],
          [Y, R] = p[k];
        span(
          o,
          c,
          [x + Math.sin(t) * (r + 0.06), y, z + Math.cos(t) * (r + 0.06)],
          [x + Math.sin(t) * (R + 0.06), Y, z + Math.cos(t) * (R + 0.06)],
          0.15,
          0.15,
          'stone',
          C.trim,
        );
      }
    }
  L(o, c, [ring(H.domeTop, 0.8), ring(H.domeTop + 1.2, 0.65)], 'roof', C.roof);
  if (c.far) L(o, c, [ring(H.domeTop + 1.2, 0.5), ring(H.finialTop, 0.06)], 'roof', C.gold);
  else {
    sphere(
      o,
      S(c, 'roof'),
      [x, H.domeTop + 1.7, z],
      [0.65, 0.65, 0.65],
      C.gold,
      c.n,
      Math.max(3, c.n / 2),
    );
    span(o, c, [x, H.domeTop + 2.3, z], [x, H.finialTop, z], 0.16, 0.16, 'roof', C.metal);
    span(
      o,
      c,
      [x - 0.9, H.finialTop - 0.9, z],
      [x + 0.9, H.finialTop - 0.9, z],
      0.16,
      0.16,
      'roof',
      C.metal,
    );
  }
}
function circlePanel(o, c, x, z, N, y, r) {
  const U = [N[1], -N[0]],
    P = (u, v, d = 0) => [x + U[0] * u + N[0] * d, v, z + U[1] * u + N[1] * d],
    n = c.fine ? 48 : c.n * 2;
  for (let j = 0; j < n; j++) {
    const t = (j * 2 * Math.PI) / n,
      v = ((j + 1) * 2 * Math.PI) / n;
    T(
      o,
      c,
      [
        P(0, y, 0.08),
        P(r * Math.cos(t), y + r * Math.sin(t), 0.08),
        P(r * Math.cos(v), y + r * Math.sin(v), 0.08),
      ],
      'stone',
      C.stone,
      [N[0], 0, N[1]],
    );
    if (!c.far)
      span(
        o,
        c,
        P(r * Math.cos(t), y + r * Math.sin(t), 0.15),
        P(r * Math.cos(v), y + r * Math.sin(v), 0.15),
        0.22,
        0.18,
      );
  }
}
function frontCrowns(o, c) {
  for (const [x, N] of [
    [137.8, [1, 0]],
    [4.3, [-1, 0]],
  ]) {
    const P = (u, y, d = 0) => [x + N[0] * d, y, N[0] * u],
      lo = H.mainEave,
      w = 8;
    Q(o, c, [P(-w, lo), P(w, lo), P(w, lo + 1.8), P(0, lo + 5.5)], 'stone', C.stone, [N[0], 0, 0]);
    T(o, c, [P(-w, lo), P(0, lo + 5.5), P(-w, lo + 1.8)], 'stone', C.stone, [N[0], 0, 0]);
    circlePanel(o, c, x, 0, N, lo + 2.5, 1.8);
    if (!c.far) {
      span(o, c, P(-w, lo + 1.8, 0.2), P(0, lo + 5.5, 0.2), 0.35, 0.3);
      span(o, c, P(0, lo + 5.5, 0.2), P(w, lo + 1.8, 0.2), 0.35, 0.3);
    }
  }
}
function gate(o, c) {
  for (const [x, z] of H.gatePiers) {
    B(o, c, [x - 1.6, H.floor, z - 1.6], [x + 1.6, H.floor + 5.4, z + 1.6], 'base', C.base);
    B(o, c, [x - 1.85, H.floor + 5.4, z - 1.85], [x + 1.85, H.floor + 5.9, z + 1.85]);
    if (!c.far) urn(o, c, x, z, H.floor + 5.9);
  }
  if (c.far) return;
  for (const [z0, z1] of [
    [-54.2, -6.5],
    [5.3, 54.79],
  ]) {
    for (const y of [H.floor + 0.6, H.floor + 3.8])
      span(o, c, [-137.6, y, z0], [-137.6, y, z1], 0.16, 0.16, 'roof', C.metal);
    const n = Math.ceil((z1 - z0) / (c.flat ? 6 : c.fine ? 0.65 : 1.6));
    for (let j = 0; j <= n; j++) {
      const z = z0 + ((z1 - z0) * j) / n;
      span(
        o,
        c,
        [-137.6, H.floor + 0.3, z],
        [-137.6, H.floor + 4.2, z],
        0.08,
        0.08,
        'roof',
        C.metal,
      );
    }
  }
}
function paving(o, c, outline) {
  cap(o, c, [outline], H.floor, 'base', C.paving);
  const [x0, z0, x1, z1] = H.forecourt,
    rect = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
  cap(o, c, [rect], H.floor, 'base', C.paving);
  for (let i = 0; i < 4; i++) foundation(o, c, cw(rect)[i], cw(rect)[(i + 1) % 4]);
  if (c.detail)
    for (const box of [H.forecourt, H.court]) {
      const [x0, z0, x1, z1] = box,
        step = c.fine ? 8 : 12;
      for (let x = x0 + 3; x < x1 - 3; x += step)
        for (let z = z0 + 3; z < z1 - 3; z += step) {
          const X = Math.min(x + step * 0.45, x1 - 3),
            Z = Math.min(z + step * 0.45, z1 - 3);
          Q(
            o,
            c,
            [
              [x, H.floor + 0.008, z],
              [X, H.floor + 0.008, z],
              [X, H.floor + 0.008, Z],
              [x, H.floor + 0.008, Z],
            ],
            'base',
            C.pavingDark,
            [0, 1, 0],
          );
        }
    }
}
export function buildMadridLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Madrid tier ' + level);
  const outer = cw(c.far || c.flat ? a.farOutline : a.outline),
    holes = (c.far || c.flat ? a.farHoles : a.holes).map((r) => cw(r).reverse()),
    rings = [outer, ...holes];
  outerWalls(o, c, outer);
  for (const r of holes)
    for (let i = 0; i < r.length; i++) wall(o, c, r[i], r[(i + 1) % r.length], H.floor, H.mainEave);
  planeCap(o, c, rings, H.mainEave, true);
  planeCap(o, c, rings, H.lowEave, false);
  for (const [z0, z1] of [
    [-82.17, -54.2],
    [54.79, 82.34],
  ]) {
    wall(o, c, [0, z0], [0, z1], H.lowEave, H.mainEave);
    exteriorFacade(o, c.flatFrames ? { ...c, windowStep: 14 } : c, [0, z0], [0, z1], {
      junction: true,
    });
  }
  paving(o, c, outer);
  for (const e of madridCourtEdges()) courtGallery(o, c, e);
  const [x0, z0, x1, z1] = H.court,
    D = H.galleryDepth;
  for (const [x, z, sx, sz] of [
    [x0, z0, -1, -1],
    [x1, z0, 1, -1],
    [x1, z1, 1, 1],
    [x0, z1, -1, 1],
  ])
    deck(
      o,
      c,
      [
        [x, z],
        [x + sx * D, z],
        [x + sx * D, z + sz * D],
        [x, z + sz * D],
      ],
      H.arcadeTop + 0.2,
    );
  forecourtGallery(o, c, {
    A: [H.forecourtX1, H.westInnerZ],
    Z: [H.forecourtX0, H.westInnerZ],
    N: [0, -1],
  });
  forecourtGallery(o, c, {
    A: [H.forecourtX0, H.eastInnerZ],
    Z: [H.forecourtX1, H.eastInnerZ],
    N: [0, 1],
  });
  for (const r of [
    [-137.8, -81.7, -92.65, -62.8],
    [-53, -82.17, 0, -60.18],
    [-116.8, -62.8, -8.7, -54.2],
    [-137.4, 54.79, -43.2, 81.8],
  ]) {
    const [x0, z0, x1, z1] = r;
    hip(
      o,
      c,
      [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ],
      H.lowEave,
      H.lowEave + 2.2,
      c.far ? 1 : 2.3,
    );
  }
  clippedPavilion(o, c);
  for (const r of H.cornerCrowns) {
    const [x0, z0, x1, z1] = r;
    crown(
      o,
      c,
      [
        [x0, z0],
        [x1, z0],
        [x1, z1],
        [x0, z1],
      ],
      H.mainEave + 2.0,
    );
  }
  dome(o, c);
  frontCrowns(o, c);
  gate(o, c);
  if (!c.far) {
    for (let i = 0; i < outer.length; i++) {
      const A = outer[i],
        Z = outer[(i + 1) % outer.length];
      if (innerForecourt(A, Z)) continue;
      for (const [P, R] of splitEdge(A, Z)) exteriorFacade(o, c, P, R);
    }
    const crowns = H.cornerCrowns.flatMap(([x0, z0, x1, z1]) => [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ]);
    if (!c.flat && !c.flatFrames) for (const [x, z] of crowns) urn(o, c, x, z, H.mainEave + 2.1);
    if (c.detail)
      for (const [x, z] of [
        [23, -50],
        [54, -49],
        [83, -50],
        [115, -49],
        [25, 45],
        [55, 48],
        [85, 48],
        [112, 45],
      ])
        urn(o, c, x, z, H.mainEave + 0.2);
  }
}
export const buildMadridSkyline = (o) => buildMadridLevel(o, 'skyline');
export const buildMadridDistrict = (o) => buildMadridLevel(o, 'district');
export const buildMadridStreet = (o) => buildMadridLevel(o, 'street');
export const buildMadridCloseup = (o) => buildMadridLevel(o, 'closeup');

/** Original Hyatt Paris Etoile exterior. Meters,+X ESE,+Z SSW;shared architectural surfaces. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const a = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url))),
  g = JSON.parse(readFileSync(new URL('../terrain-grid.json', import.meta.url))),
  lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    glass: lin('7b96aa'),
    pier: lin('deded7'),
    brown: lin('a38c7c'),
    silver: lin('b8c4c9'),
    dark: lin('565e64'),
    roof: lin('afb5b6'),
    ground: lin('aaa69c'),
  };
export const hyattSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.76, metallic: 0 },
  glass: { slot: 'window', graph: 'window_grid', roughness: 0.26, metallic: 0.17 },
  metal: { slot: 'wall', graph: 'metal_painted', roughness: 0.57, metallic: 0.24 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.88, metallic: 0 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94, metallic: 0 },
};
export const hyattControls = a;
export function hyattGroundY(x, z) {
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
const cfg = {
  skyline: { far: true, bay: 12, rows: 1, podiumRows: 1, mastPanels: 2, sides: 4 },
  district: {
    bay: 7,
    rows: 32,
    simpleFloors: true,
    podiumRows: 2,
    mastPanels: 3,
    sides: 6,
    piers: true,
  },
  street: { bay: 3.4, rows: 16, podiumRows: 4, mastPanels: 8, sides: 8, piers: true, entry: true },
  closeup: {
    bay: 2.8,
    rows: 32,
    podiumRows: 5,
    mastPanels: 14,
    sides: 12,
    piers: true,
    entry: true,
    frames: true,
    plant: true,
  },
  master: {
    bay: 2.6,
    rows: 32,
    podiumRows: 5,
    mastPanels: 20,
    sides: 20,
    piers: true,
    entry: true,
    frames: true,
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
      ids.slice(i, i + 3).map((k) => [r[k][0], y, r[k][1]]),
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
export const hyattEntryPoint = (u, y, d = 0) => P(face(a.entrance.p, a.entrance.q), u, y, d);
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
function pier(o, c, f, u, w) {
  const low = 8,
    top = 137,
    p = [
      P(f, u - w / 2, low, 0.02),
      P(f, u + w / 2, low, 0.02),
      P(f, u + w / 2, low, 0.65),
      P(f, u - w / 2, low, 0.65),
    ];
  loft(o, S(c, 'metal'), [p.toReversed(), p.map((p) => [p[0], top, p[2]]).toReversed()], C.pier);
}
function tower(o, c) {
  const r = clockwise(a.towerOutline),
    H = a.windowTop - a.bodyBase;
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      solid = Math.abs(f.n[0]) > 0.8 && f.L < 6,
      N = Math.max(1, Math.ceil(f.L / c.bay));
    if (solid) {
      panel(o, c, f, 0, f.L, 8, 137, 0, 'metal', C.brown);
      if (c.frames)
        for (let y = 12; y < 137; y += 4)
          panel(o, c, f, 0, f.L, y, y + 0.035, 0.015, 'metal', C.silver);
      continue;
    }
    if (c.simpleFloors) {
      panel(o, c, f, 0, f.L, 8, a.windowTop, -0.04, 'glass', C.glass);
      for (let j = 0; j < c.rows; j++) {
        const y = 8 + (j * H) / c.rows;
        panel(o, c, f, 0, f.L, y, y + (0.38 * H) / c.rows, 0, 'metal', C.brown);
      }
    }
    if (!c.simpleFloors)
      for (let j = 0; j < c.rows; j++) {
        const y0 = 8 + (j * H) / c.rows,
          y1 = 8 + ((j + 1) * H) / c.rows,
          windowBottom = y0 + (c.far ? 0 : 0.38 * (y1 - y0)),
          windowTop = y1 - (c.far ? 0 : 0.12 * (y1 - y0));
        for (let k = 0; k < N; k++) {
          const u0 = (k * f.L) / N,
            u1 = ((k + 1) * f.L) / N,
            inset = c.far ? 0 : Math.min(0.45, (u1 - u0) * 0.16);
          if (!c.far) {
            panel(o, c, f, u0, u1, y0, windowBottom, 0, 'metal', C.brown);
            panel(o, c, f, u0, u1, windowTop, y1, 0, 'metal', C.brown);
            panel(o, c, f, u0, u0 + inset, windowBottom, windowTop, 0, 'metal', C.brown);
            panel(o, c, f, u1 - inset, u1, windowBottom, windowTop, 0, 'metal', C.brown);
          }
          const start = u0 + inset,
            end = u1 - inset,
            D = c.reveals ? -0.12 : -0.04;
          panel(o, c, f, start, end, windowBottom, windowTop, D, 'glass', C.glass);
          if (c.reveals) {
            for (const [u, n] of [
              [start, [f.t[0], 0, f.t[1]]],
              [end, [-f.t[0], 0, -f.t[1]]],
            ])
              patch(
                o,
                'metal',
                [
                  P(f, u, windowBottom),
                  P(f, u, windowBottom, D),
                  P(f, u, windowTop, D),
                  P(f, u, windowTop),
                ],
                C.brown,
                n,
              );
            for (const [y, n] of [
              [windowBottom, [0, 1, 0]],
              [windowTop, [0, -1, 0]],
            ])
              patch(
                o,
                'metal',
                [P(f, start, y), P(f, end, y), P(f, end, y, D), P(f, start, y, D)],
                C.brown,
                n,
              );
          }
          if (c.frames) {
            B(
              o,
              c,
              P(f, (start + end) / 2, windowBottom, D + 0.025),
              P(f, (start + end) / 2, windowTop, D + 0.025),
              0.065,
              C.silver,
              0.055,
            );
            if (c.reveals)
              for (const y of [windowBottom, windowTop])
                B(o, c, P(f, start, y, 0.01), P(f, end, y, 0.01), 0.06, C.silver, 0.07);
            if (c.reveals)
              B(
                o,
                c,
                P(f, start + 0.12, windowBottom + 0.12, -0.03),
                P(f, start + 0.12, windowTop - 0.12, -0.03),
                0.035,
                C.silver,
              );
          }
        }
      }
    panel(o, c, f, 0, f.L, a.windowTop, 137, 0, 'metal', C.dark);
    if (c.piers)
      for (let k = 0; k <= N; k++)
        pier(o, c, f, (k * f.L) / N, Math.min(c.rows < 10 ? 0.55 : 0.8, (f.L / N) * 0.3));
    else if (c.far)
      for (let k = 0; k <= N; k++)
        panel(
          o,
          c,
          f,
          Math.max(0, (k * f.L) / N - 0.23),
          Math.min(f.L, (k * f.L) / N + 0.23),
          8,
          137,
          0.02,
          'metal',
          C.pier,
        );
  }
  cap(o, c, r, 137, 'roof', C.roof);
}
function podium(o, c) {
  const r = clockwise(a.podiumOutline),
    e = a.entrance;
  for (let i = 0; i < r.length; i++) {
    const f = face(r[i], r[(i + 1) % r.length]),
      entry = f.n[1] < -0.98 && f.L > 40 && f.p[1] < -33,
      low = Math.min(
        -1,
        ...Array.from({ length: Math.ceil(f.L / 3) + 1 }, (_, j) => {
          const p = P(f, (j * f.L) / Math.ceil(f.L / 3), 0);
          return hyattGroundY(p[0], p[2]) - 0.6;
        }),
      );
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
      panel(o, c, f, 0, f.L, e.doorTop, 21, 0, 'glass', C.glass);
    } else panel(o, c, f, 0, f.L, e.landingY, 21, 0, 'glass', C.glass);
    if (!c.far) {
      for (let j = 0; j < c.podiumRows; j++) {
        const y = e.landingY + ((21 - e.landingY) * j) / c.podiumRows;
        if (entry && c.entry && y < e.doorTop) {
          panel(o, c, f, 0, e.centerU - e.openingHalfWidth, y, y + 0.65, 0.04, 'metal', C.brown);
          panel(o, c, f, e.centerU + e.openingHalfWidth, f.L, y, y + 0.65, 0.04, 'metal', C.brown);
        } else panel(o, c, f, 0, f.L, y, y + 0.65, 0.04, 'metal', C.brown);
      }
      if (c.entry)
        for (let u = 1; u < f.L; u += 3.1) {
          if (entry && Math.abs(u - e.centerU) < e.openingHalfWidth) continue;
          B(o, c, P(f, u, e.landingY, 0.09), P(f, u, 20.9, 0.09), 0.12, C.silver);
        }
    }
  }
  cap(o, c, r, 21, 'roof', C.roof);
}
function dish(o, c, center, radius, direction) {
  const N = c.sides,
    back = center.map((v, i) => v - direction[i] * 0.18),
    basis =
      Math.abs(direction[0]) > 0.5
        ? [
            [0, 1, 0],
            [0, 0, 1],
          ]
        : [
            [1, 0, 0],
            [0, 1, 0],
          ],
    ring = Array.from({ length: N }, (_, i) => {
      const t = (-i * Math.PI * 2) / N;
      return center.map(
        (v, k) => v + radius * (Math.cos(t) * basis[0][k] + Math.sin(t) * basis[1][k]),
      );
    });
  for (let i = 0; i < N; i++) {
    tri(o, 'metal', [center, ring[i], ring[(i + 1) % N]], C.pier, direction);
    tri(
      o,
      'metal',
      [back, ring[(i + 1) % N], ring[i]],
      C.silver,
      direction.map((v) => -v),
    );
  }
}
function mast(o, c) {
  const m = a.mast,
    [x, z] = m.center,
    N = c.mastPanels,
    legs = [
      [x - m.halfWidth, z - 0.8],
      [x + m.halfWidth, z - 0.8],
      [x, z + 1.25],
    ],
    R = (y) => {
      const t = (y - m.baseY) / (m.latticeTop - m.baseY),
        s = 1 - 0.75 * t;
      return legs.map((p) => [x + (p[0] - x) * s, y, z + (p[1] - z) * s]);
    };
  for (let i = 0; i < 3; i++)
    B(o, c, R(m.baseY)[i], R(m.latticeTop)[i], c.far ? 0.12 : 0.1, C.silver);
  for (let j = 0; j < N; j++) {
    const y = m.baseY + (j * (m.latticeTop - m.baseY)) / N,
      Y = m.baseY + ((j + 1) * (m.latticeTop - m.baseY)) / N,
      A = R(y),
      D = R(Y);
    for (let i = 0; i < 3; i++) {
      B(o, c, A[i], D[(i + 1) % 3], c.far ? 0.08 : 0.055, C.silver);
      if (!c.far) {
        B(o, c, A[(i + 1) % 3], D[i], 0.055, C.silver);
        B(o, c, A[i], A[(i + 1) % 3], 0.06, C.silver);
      }
    }
  }
  loft(
    o,
    S(c, 'metal'),
    [
      radialRing(m.latticeTop, 0.16, 0.16, c.sides, [x, z]),
      radialRing(m.top, 0.035, 0.035, c.sides, [x, z]),
    ],
    C.silver,
  );
  if (!c.far) {
    for (const p of [
      [-5, 16],
      [5, 16],
      [0, 22],
    ])
      B(o, c, [p[0], 137, p[1]], [x, 158, z], 0.035, C.silver);
    for (const [X, Z, top] of m.secondary) {
      B(o, c, [X, 136.8, Z], [X, top, Z], 0.15, C.silver);
      for (let j = 0; j < (c.frames ? 5 : 2); j++) {
        const y = 139 + (j * (top - 140)) / (c.frames ? 4 : 2);
        B(o, c, [X - 1.1, y, Z], [X + 1.1, y, Z], 0.08, C.silver);
        if (c.frames) {
          dish(o, c, [X + 1.3, y, Z], 0.5, [1, 0, 0]);
          B(o, c, [X - 1.1, y - 0.5, Z], [X + 1.1, y + 1, Z], 0.05, C.silver);
        }
      }
    }
    if (c.frames)
      for (let j = 0; j < 8; j++)
        dish(o, c, [x + (j % 2 ? -0.7 : 0.7), 143 + j * 2, z], 0.45 + (j % 3) * 0.14, [
          j % 2 ? -1 : 1,
          0,
          0,
        ]);
  }
}
function entry(o, c) {
  const e = a.entrance,
    f = face(e.p, e.q),
    left = e.centerU - e.openingHalfWidth,
    right = e.centerU + e.openingHalfWidth,
    top = [
      P(f, e.landingMinU, e.landingY),
      P(f, e.landingMaxU, e.landingY),
      P(f, e.landingMaxU, e.landingY, e.landingDepth),
      P(f, e.landingMinU, e.landingY, e.landingDepth),
    ],
    bottom = top.map((p) => [p[0], Math.min(-1, hyattGroundY(p[0], p[2]) - 0.5), p[2]]);
  loft(o, S(c, 'ground'), [bottom.toReversed(), top.toReversed()], C.ground);
  if (c.entry) {
    for (let i = 0; i < 6; i++) {
      const d0 = e.landingDepth + (i * e.stairRun) / 6,
        d1 = e.landingDepth + ((i + 1) * e.stairRun) / 6,
        Y = (u) => {
          const p = P(f, u, 0, e.landingDepth + e.stairRun);
          return e.landingY + ((hyattGroundY(p[0], p[2]) - e.landingY) * (i + 1)) / 6;
        },
        t = [
          P(f, e.landingMinU, Y(e.landingMinU), d0),
          P(f, e.landingMaxU, Y(e.landingMaxU), d0),
          P(f, e.landingMaxU, Y(e.landingMaxU), d1),
          P(f, e.landingMinU, Y(e.landingMinU), d1),
        ],
        b = t.map((p) => [p[0], Math.min(-1, hyattGroundY(p[0], p[2]) - 0.5), p[2]]);
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
        C.brown,
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
    for (const du of [-4, 0, 4]) {
      panel(
        o,
        c,
        f,
        e.centerU + du - 1.4,
        e.centerU + du + 1.4,
        e.landingY + 0.1,
        6.7,
        -e.recess + 0.06,
        'glass',
        C.glass,
      );
      for (const u of [e.centerU + du - 1.4, e.centerU + du, e.centerU + du + 1.4])
        B(
          o,
          c,
          P(f, u, e.landingY + 0.1, -e.recess + 0.1),
          P(f, u, 6.7, -e.recess + 0.1),
          0.065,
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
    if (!c.far) B(o, c, R(u, 0), R(u, e.canopyDepth), 0.16, C.silver);
  }
  for (const d of [0, e.canopyDepth]) B(o, c, R(e.canopyMinU, d), R(e.canopyMaxU, d), 0.3, C.pier);
  if (!c.far)
    for (const u of [e.canopyMinU + 0.5, e.canopyMaxU - 0.5]) {
      const p = R(u, e.canopyDepth - 0.2);
      B(o, c, [p[0], hyattGroundY(p[0], p[2]) - 0.4, p[2]], p, 0.22, C.silver);
    }
}
function plant(o, c) {
  if (!c.plant) return;
  for (const [x, z, w, d, h, y] of [
    [-13, -11, 8, 5, 1.7, 21],
    [13, -11, 8, 5, 1.7, 21],
    [-6, 14, 4, 3, 1.4, 137],
    [7, 17, 3, 4, 1.8, 137],
  ]) {
    box(o, 'roof', [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], C.roof);
    if (c.reveals)
      for (let j = 0; j < 9; j++)
        box(
          o,
          'metal',
          [x - w / 2, y + h, z - d / 2 + (j * d) / 9],
          [x + w / 2, y + h + 0.05, z - d / 2 + (j * d) / 9 + 0.06],
          C.dark,
        );
  }
}
export function buildHyattLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Hyatt level:' + level);
  podium(o, c);
  tower(o, c);
  mast(o, c);
  entry(o, c);
  plant(o, c);
}
export const buildHyattSkyline = (o) => buildHyattLevel(o, 'skyline'),
  buildHyattDistrict = (o) => buildHyattLevel(o, 'district'),
  buildHyattStreet = (o) => buildHyattLevel(o, 'street'),
  buildHyattCloseup = (o) => buildHyattLevel(o, 'closeup');

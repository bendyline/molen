/** Original Padrão dos Descobrimentos source;shared metric materials. */
import {
  beam,
  beamPath,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  stone: lin('d2caba'),
  edge: lin('e1d8c6'),
  base: lin('bdb5a6'),
  shadow: lin('716b60'),
  metal: lin('434b47'),
  wood: lin('4f4940'),
};
export const monumentSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.25 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.85 },
};
const cfg = {
  skyline: { curve: 3, round: 4, body: 3 },
  district: { curve: 8, round: 6, body: 5, detail: true },
  street: { curve: 18, round: 10, body: 8, detail: true, fine: true },
  closeup: { curve: 44, round: 16, body: 16, detail: true, fine: true },
  master: { curve: 96, round: 32, body: 32, detail: true, fine: true, master: true },
};
export const monumentOutline = [
  [-10.058809, -20.155685],
  [-2.425216, -20.110113],
  [-2.419506, -22.258655],
  [2.610822, -22.321113],
  [2.605113, -20.172571],
  [10.011347, -20.178158],
  [9.93723, -1.801857],
  [6.486869, 12.470598],
  [2.36585, 22.292496],
  [-1.703885, 22.332235],
  [-6.756814, 11.8793],
  [-10.132928, -1.779374],
];
const sub = (a, b) => a.map((v, i) => v - b[i]),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
function T(o, c, p, s, col, N) {
  p = p.map((a) => a.map(Math.fround));
  if (Math.hypot(...cross(sub(p[1], p[0]), sub(p[2], p[0]))) < 1e-8) return;
  let n = normalFor(...p);
  if (N && n.reduce((s, v, i) => s + v * N[i], 0) < 0) {
    p.reverse();
    n = normalFor(...p);
  }
  o.addTriangle(
    c === cfg.skyline ? 'far' : s,
    'palette:#ffffff',
    p,
    n,
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    col,
  );
}
function Q(o, c, p, s, col, N) {
  T(o, c, p.slice(0, 3), s, col, N);
  T(o, c, [p[0], p[2], p[3]], s, col, N);
}
const adapter = (o, c) => ({
  addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
  addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
  addConvexPolygon: (s, r, p, n, uv, col) => {
    for (let i = 1; i < p.length - 1; i++) T(o, c, [p[0], p[i], p[i + 1]], s, col, n);
  },
});
function box(o, c, x0, x1, y0, y1, z0, z1, s = 'wall', col = C.wall) {
  const a = [x0, y0, z0],
    b = [x1, y0, z0],
    d = [x0, y0, z1],
    e = [x1, y0, z1],
    A = [x0, y1, z0],
    B = [x1, y1, z0],
    D = [x0, y1, z1],
    E = [x1, y1, z1];
  for (const [p, N] of [
    [
      [a, d, e, b],
      [0, -1, 0],
    ],
    [
      [A, B, E, D],
      [0, 1, 0],
    ],
    [
      [d, D, E, e],
      [0, 0, 1],
    ],
    [
      [b, B, A, a],
      [0, 0, -1],
    ],
    [
      [a, A, D, d],
      [-1, 0, 0],
    ],
    [
      [e, E, B, b],
      [1, 0, 0],
    ],
  ])
    Q(o, c, p, s, col, N);
}
function prism(o, c, r, y0, y1, s = 'wall', col = C.wall) {
  const ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    for (const [y, N] of [
      [y0, [0, -1, 0]],
      [y1, [0, 1, 0]],
    ])
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => [r[j][0], y, r[j][1]]),
        s,
        col,
        N,
      );
  let A = 0;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    A += a[0] * b[1] - a[1] * b[0];
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      c,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      s,
      col,
      A > 0 ? [b[1] - a[1], 0, a[0] - b[0]] : [a[1] - b[1], 0, b[0] - a[0]],
    );
  }
}
function transform(o, point) {
  const n = (v) => {
    const a = point([0, 0, 0]),
      b = point(v);
    return b.map((x, i) => x - a[i]);
  };
  return {
    addQuad: (s, r, p, N, uv, col) => o.addQuad(s, r, p.map(point), n(N), uv, col),
    addTriangle: (s, r, p, N, uv, col) => o.addTriangle(s, r, p.map(point), n(N), uv, col),
    addConvexPolygon: (s, r, p, N, uv, col) =>
      o.addConvexPolygon(s, r, p.map(point), n(N), uv, col),
  };
}
// Appended to the local draft's explicit, original mesh helpers.
function profilePrism(o, c, r, a, b, s = 'stone', col = C.stone) {
  const t = transform(o, ([u, y, v]) => [v, y, u]),
    ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    for (const [v, N] of [
      [a, [0, 0, -1]],
      [b, [0, 0, 1]],
    ])
      T(
        t,
        c,
        ids.slice(i, i + 3).map((j) => [r[j][0], r[j][1], v]),
        s,
        col,
        N,
      );
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      A = r[i],
      B = r[j];
    Q(
      t,
      c,
      [
        [A[0], A[1], a],
        [B[0], B[1], a],
        [B[0], B[1], b],
        [A[0], A[1], b],
      ],
      s,
      col,
      [B[1] - A[1], A[0] - B[0], 0],
    );
  }
}
function curvedCheek(o, c, sign) {
  const shift = sign > 0 ? 2.2 : 0,
    top = sign > 0 ? 31.5 : 34,
    r = [
      [-19, 1.8],
      [17, 13.4],
    ];
  for (let i = 0; i <= c.curve; i++) {
    const t = i / c.curve;
    r.push([
      17 - 29 * t + shift * Math.sin(t * Math.PI),
      13.4 + (top - 13.4) * (1 - Math.pow(1 - t, 2)),
    ]);
  }
  r.push([-12, top], [-12, 21], [-15, 7]);
  profilePrism(o, c, r, sign > 0 ? 2.15 : -3.65, sign > 0 ? 3.65 : -2.15);
}
function hullTop(z) {
  return 1.6 + 12 * Math.max(0, Math.min(1, (z + 18) / 40));
}
function hull(o, c) {
  const ring = monumentOutline.map(([x, z]) => [x * 0.88, z]);
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3)
    for (const top of [false, true])
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => [ring[j][0], top ? hullTop(ring[j][1]) : 0.2, ring[j][1]]),
        'stone',
        C.stone,
        top ? [0, 1, 0] : [0, -1, 0],
      );
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length,
      a = ring[i],
      b = ring[j];
    Q(
      o,
      c,
      [
        [a[0], 0.2, a[1]],
        [b[0], 0.2, b[1]],
        [b[0], hullTop(b[1]), b[1]],
        [a[0], hullTop(a[1]), a[1]],
      ],
      'stone',
      C.stone,
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
}

function ovalRows(o, c, rows, n, s = 'stone', col = C.stone) {
  const rs = rows.map(([y, x, z, rx, rz]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [x + Math.cos(a) * rx, y, z + Math.sin(a) * rz];
    }),
  );
  for (let j = 1; j < rs.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(o, c, [rs[j - 1][i], rs[j - 1][k], rs[j][k], rs[j][i]], s, col, [
        Math.cos(((i + 0.5) * 2 * Math.PI) / n),
        0,
        Math.sin(((i + 0.5) * 2 * Math.PI) / n),
      ]);
    }
  for (const [r, N] of [
    [rs[0], [0, -1, 0]],
    [rs.at(-1), [0, 1, 0]],
  ])
    for (let i = 1; i < n - 1; i++) T(o, c, [r[0], r[i], r[i + 1]], s, col, N);
}
function ellipsoid(o, c, center, radii, n = c.round) {
  sphere(adapter(o, c), 'stone', center, radii, C.edge, n, Math.max(3, Math.floor(n / 2)));
}
function figure(o, c, { x, z, h = 7, pose = 0, lead = false }) {
  const y = hullTop(z),
    n = c.body,
    lean = ((pose % 3) - 1) * 0.2,
    robe = (Y) => [Y, x + (lean * (Y - y)) / h, z + Math.max(0, (Y - y) / h - 0.5) * 0.3];
  const row = (f, rx, rz) => [y + f * h, ...robe(y + f * h).slice(1), rx, rz];
  ovalRows(
    o,
    c,
    [
      row(0, h * 0.145, h * 0.105),
      row(0.26, h * 0.11, h * 0.085),
      row(0.51, h * 0.095, h * 0.07),
      row(0.73, h * 0.13, h * 0.075),
      row(0.84, h * 0.06, h * 0.055),
    ],
    n,
  );
  const head = [x + lean * 0.95, y + h * 0.9, z + 0.15];
  ellipsoid(o, c, head, [h * 0.063, h * 0.082, h * 0.067]);
  if (c.detail) {
    for (const sign of [-1, 1]) {
      const A = [x + sign * h * 0.12, y + h * 0.71, z],
        B = [
          x + sign * h * (pose % 2 ? 0.17 : 0.11),
          y + h * (pose % 2 ? 0.56 : 0.63),
          z + h * 0.06,
        ],
        D = [x + sign * h * 0.065, y + h * (pose % 2 ? 0.54 : 0.66), z + h * 0.15];
      if (c === cfg.district) beam(adapter(o, c), 'stone', A, D, h * 0.062, h * 0.07, C.stone);
      else {
        beam(adapter(o, c), 'stone', A, B, h * 0.062, h * 0.07, C.stone);
        beam(adapter(o, c), 'stone', B, D, h * 0.055, h * 0.06, C.edge);
      }
      if (c.fine) ellipsoid(o, c, D, [h * 0.035, h * 0.04, h * 0.035], Math.max(6, c.round / 2));
    }
    if (pose % 4 === 0 || lead) {
      const t = transform(o, ([u, Y, v]) => [x + u, y + Y, z + 0.12 + v]);
      ovalRows(
        t,
        c,
        [
          [h * 0.96, 0, 0, h * 0.085, h * 0.075],
          [h * 0.99, 0, 0.02, h * 0.105, h * 0.09],
          [h * 1.02, 0, 0.05, h * 0.065, h * 0.07],
        ],
        n,
        'stone',
        C.stone,
      );
    }
    if (pose % 4 === 1 && !lead)
      box(
        o,
        c,
        x - h * 0.13,
        x + h * 0.13,
        y + h * 0.57,
        y + h * 0.69,
        z + h * 0.105,
        z + h * 0.2,
        'stone',
        C.edge,
      );
    if (lead) {
      const ship = transform(o, ([X, Y, Z]) => [x + X, y + Y, z + Z]),
        plan = [
          [-1.4, 1.35],
          [-0.8, 1.05],
          [1.1, 1.05],
          [1.55, 1.4],
          [0.9, 1.8],
          [-1, 1.8],
        ];
      prism(ship, c, plan, h * 0.57, h * 0.625, 'stone', C.edge);
      box(ship, c, -0.05, 0.05, h * 0.625, h * 0.84, 1.4, 1.5, 'stone', C.stone);
      for (const N of [
        [0, 0, 1],
        [0, 0, -1],
      ])
        Q(
          ship,
          c,
          [
            [-0.9, h * 0.66, 1.5],
            [0.85, h * 0.66, 1.5],
            [0.7, h * 0.81, 1.5],
            [-0.75, h * 0.81, 1.5],
          ],
          'stone',
          C.edge,
          N,
        );
    }
    if (c.fine) {
      const f = [head[0], head[1], head[2] + h * 0.066];
      T(
        o,
        c,
        [
          [f[0] - 0.06, f[1] + 0.08, f[2]],
          [f[0] + 0.06, f[1] + 0.08, f[2]],
          [f[0], f[1] - 0.09, f[2] + 0.1],
        ],
        'stone',
        C.stone,
        [0, 0, 1],
      );
      for (const sign of [-1, 1])
        box(
          o,
          c,
          x + sign * h * 0.09 - h * 0.055,
          x + sign * h * 0.09 + h * 0.055,
          y,
          y + h * 0.12,
          z - 0.13,
          z + h * 0.16,
          'stone',
          C.stone,
        );
      for (let i = 0; i < (c.master ? 8 : 4); i++) {
        const a = ((i + 0.5) * 2 * Math.PI) / (c.master ? 8 : 4),
          X = x + Math.cos(a) * h * 0.128,
          Z = z + Math.sin(a) * h * 0.095;
        beam(
          adapter(o, c),
          'stone',
          [X, y + h * 0.05, Z],
          [x + (X - x) * 0.8, y + h * 0.39, z + (Z - z) * 0.72],
          h * 0.016,
          h * 0.016,
          C.edge,
        );
      }
    }
  }
}
function figures(o, c) {
  if (c === cfg.skyline) {
    for (const sign of [-1, 1])
      for (let i = 0; i < 6; i++)
        figure(o, c, { x: sign * (6.3 - i * 0.55), z: -14 + i * 5.4, h: 6.5, pose: i });
    figure(o, c, { x: 0, z: 20, h: 9, pose: 4, lead: true });
    return;
  }
  for (const sign of [-1, 1])
    for (let i = 0; i < 16; i++) {
      const row = Math.floor(i / 2),
        z = -15.1 + row * 4.35 + (i % 2) * 1.25,
        x = sign * (6.3 - row * 0.45 + (i % 2) * 0.75),
        h = i === 0 ? 5.3 : i % 5 === 2 ? 6.2 : 7;
      figure(o, c, { x, z, h, pose: i });
    }
  figure(o, c, { x: 0, z: 20, h: 9, pose: 4, lead: true });
}
function northEntry(o, c) {
  const point = ([u, y, v]) => [-u, y, -20 - v],
    t = transform(o, point),
    width = 5.1,
    bottom = 1.65,
    top = 6.5,
    w = 1.7,
    spring = 4.15,
    r = w / 2,
    arch = [
      [-r, bottom],
      [r, bottom],
      ...Array.from({ length: c.curve + 1 }, (_, i) => {
        const a = (i * Math.PI) / c.curve;
        return [r * Math.cos(a), spring + r * Math.sin(a)];
      }),
    ],
    outer = [
      [-width / 2, bottom],
      [width / 2, bottom],
      [width / 2, top],
      [-width / 2, top],
    ],
    flat = [...outer, ...arch],
    ids = earcut(flat.flat(), [4]);
  for (let i = 0; i < ids.length; i += 3)
    T(
      t,
      c,
      ids.slice(i, i + 3).map((j) => [...flat[j], 0]),
      'stone',
      C.stone,
      [0, 0, 1],
    );
  for (let i = 0; i < arch.length; i++) {
    const j = (i + 1) % arch.length,
      a = arch[i],
      b = arch[j];
    Q(
      t,
      c,
      [
        [...a, 0],
        [...b, 0],
        [...b, -1.3],
        [...a, -1.3],
      ],
      'stone',
      C.edge,
      [a[1] - b[1], b[0] - a[0], 0],
    );
  }
  const doorids = earcut(arch.flat());
  for (let i = 0; i < doorids.length; i += 3)
    T(
      t,
      c,
      doorids.slice(i, i + 3).map((j) => [...arch[j], -1.28]),
      'wood',
      C.wood,
      [0, 0, 1],
    );
  box(o, c, -2.55, 2.55, 1.65, 6.5, -18.65, -12, 'stone', C.stone);
  for (let i = 0; i < (c === cfg.skyline ? 3 : 9); i++) {
    const n = c === cfg.skyline ? 3 : 9,
      z = -22.32 + (i / n) * 2.32,
      y = 0.2 + ((i + 1) / n) * 1.45;
    box(o, c, -2.4, 2.4, 0.2, y, z, -20, 'stone', C.edge);
  }
}
function mast(o, c) {
  box(o, c, -1.89, 2.15, 2, 52, -11.3, 8.39, 'stone', C.stone);
  box(o, c, -1.89, -0.65, 6.5, 35.6, -11.9, -11.3, 'stone', C.stone);
  box(o, c, 0.65, 2.15, 6.5, 35.6, -11.9, -11.3, 'stone', C.stone);
  box(o, c, -0.65, 0.65, 6.5, 35.6, -11.34, -11.3, 'stone', C.shadow);
  box(o, c, -1.89, 2.15, 35.6, 52, -11.9, -11.3, 'stone', C.stone);
  box(o, c, -3.7, 3.7, 35.6, 37, -12.1, -10.8, 'stone', C.edge);
  // Closed flare/buttresses follow the narrow north sword face andstair mass.
  const r = [
    [-20, 1.65],
    [-18, 4],
    [-15, 13],
    [-12.1, 35.6],
    [-10.8, 35.6],
    [-10.8, 1.65],
  ];
  for (const sign of [-1, 1]) profilePrism(o, c, r, sign > 0 ? 2.15 : -3.8, sign > 0 ? 3.8 : -1.89);
  if (c.fine) {
    for (let y = 3; y < 51.8; y += c.master ? 0.65 : 1.3)
      for (const sign of [-1, 1]) {
        const x = sign > 0 ? 2.155 : -1.895;
        Q(
          o,
          c,
          [
            [x, y, -11.25],
            [x, y, 8.3],
            [x, y + 0.025, 8.3],
            [x, y + 0.025, -11.25],
          ],
          'stone',
          C.shadow,
          [sign, 0, 0],
        );
      }
    for (const sign of [-1, 1]) {
      const x = sign > 0 ? 2.17 : -1.91;
      for (const [z, y] of [
        [-2.4, 33],
        [2.1, 37],
      ]) {
        box(
          o,
          c,
          x - (sign < 0 ? 0.12 : 0),
          x + (sign > 0 ? 0.12 : 0),
          y,
          y + 5,
          z - 2.3,
          z + 2.3,
          'stone',
          C.edge,
        );
        for (const yy of [0.5, 4.5])
          for (const zz of [-1.7, 0, 1.7])
            box(
              o,
              c,
              x - (sign < 0 ? 0.2 : 0),
              x + (sign > 0 ? 0.2 : 0),
              y + yy - 0.17,
              y + yy + 0.17,
              z + zz - 0.17,
              z + zz + 0.17,
              'stone',
              C.stone,
            );
      }
    }
  }
}
export function buildMonumentLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown monument tier ' + level);
  prism(o, c, monumentOutline, c === cfg.skyline ? 0 : -6, 0.2, 'base', C.base);
  hull(o, c);
  mast(o, c);
  curvedCheek(o, c, -1);
  curvedCheek(o, c, 1);
  northEntry(o, c);
  figures(o, c);
}
export const buildMonumentSkyline = (o) => buildMonumentLevel(o, 'skyline');
export const buildMonumentDistrict = (o) => buildMonumentLevel(o, 'district');
export const buildMonumentStreet = (o) => buildMonumentLevel(o, 'street');
export const buildMonumentCloseup = (o) => buildMonumentLevel(o, 'closeup');

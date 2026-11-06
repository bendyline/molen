import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [44.671849458, 48.825970788],
  heading: -0.419222746019,
  datum: 7.956383,
  crest: 7.293617,
  tailwater: -16.356383,
  foundation: -36.706383,
  spillway: {
    a: 399.5385799999999,
    b: 1124.53858,
    count: 27,
    crestZ: -1.6,
    apronZ: 55,
  },
  plant: {
    a: -329.9,
    b: 387.7,
    upstream: -67.5,
    downstream: -17.6,
    sections: 11,
  },
  approaches: [
    [
      [-900, -2, 12.643617000000003, 70],
      [-650, -1, 9.643617000000003, 55],
      [-329.9, 0, 7.293617, 34],
    ],
    [
      [1124.53858, 0, 7.293617, 32],
      [1245, -1, 10.843617000000002, 47],
      [1460, 15, 8.543617000000001, 43],
      [1760, 30, 7.143617, 31],
    ],
  ],
  locks: [
    {
      number: 30,
      from: [1948, -262],
      to: [2032, 76],
      width: 30,
      top: 5.7,
      stage: -7.2,
      length: 348.28149534536,
      axis: [0.24118421771648998, 0.9704793522401621],
      side: [0.9704793522401621, -0.24118421771648998],
      bottom: -23.856383,
    },
    {
      number: 31,
      from: [2032, -292],
      to: [2117, 46],
      width: 30,
      top: 5.7,
      stage: -9.3,
      length: 348.5240307353282,
      axis: [0.24388562194883384, 0.9698040025730098],
      side: [0.9698040025730098, -0.24388562194883384],
      bottom: -23.856383,
    },
  ],
};
const C = {
  wall: [0.49, 0.47, 0.42],
  trim: [0.68, 0.64, 0.54],
  road: [0.42, 0.42, 0.38],
  stone: [0.43, 0.42, 0.32],
  earth: [0.34, 0.39, 0.25],
  dark: [0.21, 0.23, 0.2],
  gate: [0.28, 0.35, 0.34],
  glass: [0.19, 0.29, 0.33],
  roof: [0.34, 0.37, 0.35],
  paint: [0.81, 0.52, 0.12],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  trim: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  road: { slot: 'foundation', graph: 'concrete_plain' },
  stone: { slot: 'foundation', graph: 'gravel' },
  earth: { slot: 'foundation', graph: 'gravel' },
  gate: { slot: 'door', graph: 'metal_painted' },
  paint: { slot: 'door', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
};
const cfg = {
  skyline: {},
  district: { detail: true },
  street: { detail: true, near: true },
  closeup: { detail: true, near: true, fine: true },
  master: { detail: true, near: true, fine: true, master: true },
};
const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  sub = (a, b) => a.map((v, i) => v - b[i]);
function T(o, c, p, s, col, N) {
  p = p.map((p) => p.map(Math.fround));
  let n = cross(sub(p[1], p[0]), sub(p[2], p[0])),
    d = Math.hypot(...n);
  if (d < 1e-8) return;
  if (N && n.reduce((s, v, i) => s + v * N[i], 0) < 0) {
    p.reverse();
    n = n.map((v) => -v);
  }
  n = n.map((v) => v / d);
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
  addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
  addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
  addConvexPolygon: (s, r, p, n, uv, col) => {
    for (let i = 1; i < p.length - 1; i++) T(o, c, [p[0], p[i], p[i + 1]], s, col, n);
  },
});
const q = (o, c, p, s, n) => Q(o, c, p, s, C[s], n);
const rod = (o, c, a, b, w, h, s = 'gate') => beam(adapter(o, c), s, a, b, w, h, C[s]);
const lerp = (a, b, f) => a + (b - a) * f;
const point = (x, z, y) => [x, y, z];
function prism(o, c, P, a, b, z, w, y, h, s) {
  const A = P(a, z, h),
    B = P(b, z, h),
    D = P(a, w, h),
    E = P(b, w, h),
    p = P(a, z, y),
    r = P(b, z, y),
    u = P(a, w, y),
    v = P(b, w, y);
  const U = [B[0] - A[0], 0, B[2] - A[2]],
    V = [D[0] - A[0], 0, D[2] - A[2]],
    neg = (n) => n.map((x) => -x);
  for (const [ps, n] of [
    [
      [A, B, E, D],
      [0, 1, 0],
    ],
    [[p, r, B, A], neg(V)],
    [[u, v, E, D], V],
    [[p, u, D, A], neg(U)],
    [[r, v, E, B], U],
  ])
    q(o, c, ps, s, n);
  if (c.near) q(o, c, [p, u, v, r], s, [0, -1, 0]);
}
const box = (o, c, a, b, z, w, y, h, s) => prism(o, c, point, a, b, z, w, y, h, s);
const { crest, tailwater, foundation, spillway, plant, approaches, locks } = controls;

function approachesAndDeck(o, c) {
  for (const stations of approaches)
    for (let i = 1; i < stations.length; i++) {
      const [a, z, y, w] = stations[i - 1],
        [b, v, h, u] = stations[i];
      q(
        o,
        c,
        [
          [a, y, z - 17],
          [b, h, v - 17],
          [b, h, v + 11],
          [a, y, z + 11],
        ],
        'road',
        [0, 1, 0],
      );
      for (const sign of [-1, 1]) {
        const side = sign < 0 ? 'stone' : 'earth';
        q(
          o,
          c,
          [
            [a, y, z + (sign < 0 ? -17 : 11)],
            [b, h, v + (sign < 0 ? -17 : 11)],
            [b, h - 15, v + sign * u],
            [a, y - 15, z + sign * w],
          ],
          side,
          [0, 1, sign],
        );
        q(
          o,
          c,
          [
            [a, y - 15, z + sign * w],
            [b, h - 15, v + sign * u],
            [b, foundation, v + sign * u],
            [a, foundation, z + sign * w],
          ],
          side,
          [0, 0, sign],
        );
      }
    }
  box(o, c, plant.a, spillway.b, -17, 10, crest - 1.2, crest, 'road');
  box(o, c, plant.a, spillway.b, -17, -7.2, crest, crest + 0.19, 'trim');
  box(o, c, plant.a, spillway.b, 9.1, 10, crest, crest + 0.66, 'trim');
  if (c.detail)
    for (const [start, end] of [
      [-14.87, -13.95],
      [-13.43, -12.51],
      [-10.99, -9.7],
      [-9.55, -8.26],
    ]) {
      rod(
        o,
        c,
        [plant.a, crest + 0.28, start],
        [spillway.b, crest + 0.28, end],
        0.13,
        0.13,
        'gate',
      );
    }
  if (c.near)
    for (let x = plant.a + 13; x < spillway.b - 6; x += 26) {
      box(o, c, x - 0.12, x + 0.12, -16.3, -16.0, crest, crest + 5.8, 'gate');
      rod(o, c, [x, crest + 5.45, -16.15], [x, crest + 5.45, -8.1], 0.12, 0.12, 'gate');
    }
  if (c.fine)
    for (const z of [-13.7, -9.7])
      rod(o, c, [plant.a, crest + 4.9, z], [spillway.b, crest + 4.9, z], 0.055, 0.055);
}

function spillwayCranes(o, c) {
  for (const x of [spillway.a + 44, spillway.b - 49]) {
    for (const dx of [-7.4, 7.4])
      for (const z of [-18.3, -2.5]) {
        box(
          o,
          c,
          x + dx - 0.65,
          x + dx + 0.65,
          z - 0.73,
          z + 0.73,
          crest + 0.25,
          crest + 9.15,
          'paint',
        );
        if (c.near)
          rod(o, c, [x + dx, crest + 3, z], [x + dx * 0.72, crest + 8.7, z], 0.48, 0.52, 'paint');
      }
    box(o, c, x - 9.3, x + 9.3, -20.2, -0.7, crest + 8.8, crest + 11.2, 'paint');
    if (c.detail) {
      box(o, c, x - 6.9, x - 3.5, -0.8, 0.66, crest + 8.55, crest + 10.9, 'glass');
      rod(o, c, [x, crest + 8.8, -12], [x, crest + 5.1, -12], 0.18, 0.18);
    }
  }
}

function gatedSpillway(o, c) {
  const { a, b, count, crestZ: z, apronZ: w } = spillway,
    step = (b - a) / count;
  box(o, c, a, b, -23.4, -15, foundation, crest - 0.2, 'wall');
  box(o, c, a, b, w - 3, w + 7, foundation, tailwater + 1.1, 'wall');
  if (c.detail) box(o, c, a, b, -23.53, -22.9, crest - 3.9, crest - 3.35, 'trim');
  box(o, c, a - 8, a, z - 13, w + 3, foundation, crest - 0.35, 'wall');
  box(o, c, b, b + 8, z - 13, w + 3, foundation, crest - 0.35, 'wall');
  const profile = [
    [z + 7, crest - 8.2],
    [z + 18, crest - 13.6],
    [z + 36, tailwater + 4.6],
    [w, tailwater + 1.1],
  ];
  for (let i = 0; i <= count; i++) {
    const x = a + i * step;
    if (c.detail) box(o, c, x - 1.73, x + 1.73, z - 16, z + 15, foundation, crest + 0.25, 'wall');
    else
      q(
        o,
        c,
        [
          [x - 1.73, foundation, z + 15],
          [x + 1.73, foundation, z + 15],
          [x + 1.73, crest + 0.25, z + 15],
          [x - 1.73, crest + 0.25, z + 15],
        ],
        'wall',
        [0, 0, 1],
      );
    q(
      o,
      c,
      [
        [x - 1.73, crest - 2.6, z + 15],
        [x + 1.73, crest - 2.6, z + 15],
        [x + 1.25, tailwater + 1.1, w - 1],
        [x - 1.25, tailwater + 1.1, w - 1],
      ],
      'trim',
      [0, 1, 1],
    );
    if (i === count) break;
    const u = x + 1.74,
      v = x + step - 1.74;
    for (let j = 1; j < profile.length; j++) {
      const [p, y] = profile[j - 1],
        [r, h] = profile[j];
      q(
        o,
        c,
        [
          [x, y, p],
          [x + step, y, p],
          [x + step, h, r],
          [x, h, r],
        ],
        'wall',
        [0, 1, 1],
      );
    }
    q(
      o,
      c,
      [
        [u, crest - 1.6, z + 3],
        [v, crest - 1.6, z + 3],
        [v, crest - 7.4, z + 6],
        [u, crest - 7.4, z + 6],
      ],
      'gate',
      [0, 0, 1],
    );
    if (c.detail) {
      rod(o, c, [u, crest - 7.15, z + 6.1], [v, crest - 7.15, z + 6.1], 0.25, 0.27);
      for (const x of [u, v])
        rod(o, c, [x, crest - 2.1, z + 3.3], [x, crest - 9.4, z + 9.5], 0.32, 0.35);
    }
    if (c.fine)
      for (let k = 1; k < 7; k++) {
        const x = lerp(u, v, k / 7);
        rod(o, c, [x, crest - 2, z + 3.25], [x, crest - 7.3, z + 6.15], 0.12, 0.13);
        if (c.master) rod(o, c, [x, crest - 6.7, z + 5.9], [x, crest - 8.8, z + 10], 0.12, 0.13);
      }
  }
  spillwayCranes(o, c);
}

function generatingHall(o, c) {
  const { a, b, upstream: z, downstream: w, sections } = plant,
    step = (b - a) / sections;
  const ledge = tailwater + 3.7,
    sill = crest + 1.7,
    top = crest + 13.1;
  box(o, c, a, b, z + 4, w - 9, foundation, sill, 'wall');
  box(o, c, a, b, z, w, sill, top, 'wall');
  box(o, c, a, b, z - 0.3, w + 0.44, top, top + 0.64, 'roof');
  box(o, c, a, b, w - 0.6, 11, sill - 0.8, sill, 'trim');
  box(o, c, a, b, w - 2, 13, ledge - 0.95, ledge, 'wall');
  box(o, c, 363.9, 381.4, -89.6, -66.4, foundation, crest + 7.5, 'trim');
  box(o, c, 376.3, spillway.a, -36, 11, foundation, crest - 0.6, 'wall');
  for (let i = 0; i < sections; i++) {
    const x = a + i * step;
    if (c.detail)
      for (const side of [0, 0.5]) {
        const q = x + side * step;
        box(o, c, q - 0.95, q + 0.95, w - 4, 12.8, foundation, sill - 0.75, 'wall');
        box(o, c, q + 0.96, q + step * 0.5 - 1, w - 4.2, w - 3.9, foundation, ledge, 'dark');
      }
    if (c.detail) {
      box(o, c, x + 0.3, x + 1.8, w - 0.12, w + 0.54, sill, top, 'trim');
      box(o, c, x + 3, x + step - 1.6, w - 0.08, w + 0.07, sill + 1.8, top - 1.9, 'glass');
    } else {
      q(
        o,
        c,
        [
          [x + 3, sill + 1.8, w + 0.07],
          [x + step - 1.6, sill + 1.8, w + 0.07],
          [x + step - 1.6, top - 1.9, w + 0.07],
          [x + 3, top - 1.9, w + 0.07],
        ],
        'glass',
        [0, 0, 1],
      );
      q(
        o,
        c,
        [
          [x, foundation, 12.8],
          [x + 1.8, foundation, 12.8],
          [x + 1.8, sill - 0.75, 12.8],
          [x, sill - 0.75, 12.8],
        ],
        'wall',
        [0, 0, 1],
      );
    }
    if (c.near)
      for (let j = 1; j < 9; j++) {
        const f = x + 3 + ((step - 4.6) * j) / 9;
        rod(o, c, [f, sill + 1.8, w + 0.12], [f, top - 1.9, w + 0.12], 0.16, 0.15, 'trim');
      }
    if (c.fine) box(o, c, x + 9, x + 13.5, z + 4, z + 14, top + 0.6, top + 1.36, 'gate');
  }
  box(o, c, a, a + 10, z - 1, w + 0.35, crest, top + 1.1, 'trim');
  if (c.detail) box(o, c, b - 0.12, b + 0.15, z + 4, w - 4, sill + 2, top - 1.6, 'glass');
}

function navigation(o, c, l) {
  const { from, axis, side, length, width, bottom, top, stage, number } = l,
    w = width / 2;
  const P = (x, z, y) => [
    from[0] + side[0] * x + axis[0] * z,
    y,
    from[1] + side[1] * x + axis[1] * z,
  ];
  prism(o, c, P, -w - 5, w + 5, -5, length + 5, bottom - 1, bottom, 'wall');
  for (const k of [-1, 1]) {
    const [a, b] = [k * w, k * (w + 5)].sort((x, y) => x - y);
    prism(o, c, P, a, b, -15, length + 15, bottom, top, 'wall');
    if (c.detail)
      rod(
        o,
        c,
        P(k * (w + 1.5), -12, top + 0.78),
        P(k * (w + 1.5), length + 12, top + 0.78),
        0.16,
        0.16,
        'gate',
      );
    if (c.fine)
      for (let z = -10; z < length + 14; z += 9) {
        rod(o, c, P(k * (w + 1.5), z, top), P(k * (w + 1.5), z, top + 0.78), 0.11, 0.11);
      }
  }
  for (const [z, y] of [
    [0, 0],
    [length, tailwater],
  ]) {
    for (const k of [-1, 1]) {
      const p = P(k * w, z, bottom),
        r = P(0, z + 4.15, bottom),
        s = P(0, z + 4.15, Math.max(y, stage) + 1.8),
        t = P(k * w, z, Math.max(y, stage) + 1.8);
      q(o, c, [p, r, s, t], 'gate', [axis[0], 0, axis[1]]);
      if (c.detail)
        for (let h = bottom + 2; h < Math.max(y, stage) + 1; h += 2.1)
          rod(o, c, P(k * w, z, h), P(0, z + 4.15, h), 0.19, 0.19);
    }
    const a = number === 30 ? -w - 7 : w + 0.1,
      b = number === 30 ? -w - 0.1 : w + 7;
    prism(o, c, P, a, b, z - 6.2, z + 7, top, top + 10.2, 'trim');
    prism(o, c, P, a - 0.21, b + 0.21, z - 6.4, z + 7.2, top + 10.2, top + 10.58, 'roof');
    prism(o, c, P, a + 0.3, b - 0.3, z + 6.95, z + 7.09, top + 6.7, top + 8.7, 'glass');
    if (c.near)
      for (const x of [a + 0.9, b - 1.2])
        prism(o, c, P, x, x + 0.32, z + 7, z + 7.18, top + 6.4, top + 9, 'trim');
  }
}
export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Volga tier ' + level);
  approachesAndDeck(o, c);
  generatingHall(o, c);
  gatedSpillway(o, c);
  for (const lock of locks) navigation(o, c, lock);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

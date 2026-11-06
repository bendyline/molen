import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [111.344695197, 34.829672083],
  heading: 0.097144258939,
  datum: 330.279887,
  crest: 22.720113000000026,
  foundation: -83.27988699999997,
  tailwater: -48.70988699999998,
  reviewPool: -13.319886999999994,
  wall: {
    span: [-356.6, 356.6],
    stations: [
      [-356.6, 17],
      [-292, 8],
      [-242.10401, 0.00007],
      [-153.36081, -11.0521],
      [-38.80166, -16.63341],
      [26.77487, -17.38424],
      [145.47583, -14.92806],
      [176.93744, -14.32462],
      [195.86319, -13.9578],
      [250.64874, -0.00006],
      [299, 10],
      [356.6, 25],
    ],
  },
  plant: {
    footprint: [
      [-131.98693, 70.32472],
      [88.63604, 65.47535],
      [89.2285, 97.30001],
      [-131.12678, 101.9293],
      [-131.98693, 70.32472],
    ],
    nativePartId: 35184828388444,
    terrace: -41.30988699999998,
    roof: -30.20988699999998,
    outlets: 12,
  },
  spill: {
    west: {
      span: [-231, 83],
      count: 12,
      low: -17.70988699999998,
      high: -9.70988699999998,
    },
    east: {
      span: [103, 255],
      count: 12,
      low: -41.10988699999998,
      high: -26.40988699999998,
    },
  },
  divider: [
    [98.256, 60.25646],
    [108.40549, 110.25033],
    [109.74, 126.87954],
    [106.02936, 144.74093],
    [110.27571, 184.55592],
    [115.82869, 258.97472],
    [116.46134, 277.75214],
    [118.39121, 298.37984],
    [120.70657, 307.47087],
    [119.3164, 326.79005],
    [124.55279, 333.70315],
  ],
  gantries: [143, 210],
  scope:
    'Sanmenxia’s 713.2 m main gravity dam, two rows of outlet works, the mapped generating hall, downstream divider, red crest gantries and immediate bank ties.',
};
const C = {
  wall: [0.23, 0.222, 0.196],
  trim: [0.48, 0.44, 0.37],
  pale: [0.65, 0.64, 0.55],
  dark: [0.14, 0.15, 0.14],
  road: [0.43, 0.41, 0.38],
  stone: [0.44, 0.36, 0.26],
  red: [0.63, 0.1, 0.066],
  frame: [0.3, 0.31, 0.29],
  glass: [0.2, 0.31, 0.35],
  roof: [0.46, 0.45, 0.4],
  letter: [0.72, 0.3, 0.3],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  trim: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  pale: { slot: 'wall', graph: 'concrete_boardformed' },
  road: { slot: 'foundation', graph: 'concrete_plain' },
  stone: { slot: 'foundation', graph: 'gravel' },
  red: { slot: 'door', graph: 'metal_painted' },
  frame: { slot: 'door', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
  letter: { slot: 'wall', graph: 'concrete_plain' },
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
const { crest, foundation, tailwater, wall, plant, spill, divider, gantries } = controls;

function crestZ(x) {
  const i = wall.stations.findIndex((p) => p[0] >= x);
  if (i < 1) return wall.stations[i === 0 ? 0 : wall.stations.length - 1][1];
  const [a, z] = wall.stations[i - 1],
    [b, w] = wall.stations[i];
  return lerp(z, w, (x - a) / (b - a));
}
const profile = [
  [foundation, 61],
  [tailwater + 1, 67],
  [tailwater + 20, 44],
  [tailwater + 42, 23],
  [crest - 13, 7.5],
  [crest, 5.6],
];
function faceZ(x, y) {
  const i = profile.findIndex((p) => p[0] >= y);
  if (i < 1) return crestZ(x) + profile[i === 0 ? 0 : profile.length - 1][1];
  const [a, z] = profile[i - 1],
    [b, w] = profile[i];
  return crestZ(x) + lerp(z, w, (y - a) / (b - a));
}

function face(o, c, a, b, lo, hi, mat = 'wall', depth = 0) {
  if (a >= b || lo >= hi) return;
  const xs = [a, ...wall.stations.map((p) => p[0]).filter((x) => x > a && x < b), b];
  const ys = [lo, ...profile.map((p) => p[0]).filter((y) => y > lo && y < hi), hi];
  const P = (x, y) => [x, y, faceZ(x, y) + depth];
  for (let i = 1; i < xs.length; i++)
    for (let j = 1; j < ys.length; j++) {
      const u = xs[i - 1],
        v = xs[i],
        y = ys[j - 1],
        h = ys[j];
      q(o, c, [P(u, y), P(v, y), P(v, h), P(u, h)], mat, [0, 0, 1]);
    }
}

function deck(o, c) {
  const row = wall.stations;
  for (let i = 1; i < row.length; i++) {
    const [a, z] = row[i - 1],
      [b, w] = row[i];
    q(
      o,
      c,
      [
        [a, crest, z - 5.5],
        [b, crest, w - 5.5],
        [b, crest, w + 5.6],
        [a, crest, z + 5.6],
      ],
      'road',
      [0, 1, 0],
    );
    q(
      o,
      c,
      [
        [a, foundation, z - 5.5],
        [b, foundation, w - 5.5],
        [b, crest, w - 5.5],
        [a, crest, z - 5.5],
      ],
      'wall',
      [0, 0, -1],
    );
    if (c.detail)
      for (const d of [-5.35, 5.38])
        rod(o, c, [a, crest + 0.4, z + d], [b, crest + 0.4, w + d], 0.24, 0.24, 'trim');
  }
  for (const [x, side] of [
    [row[0][0], -1],
    [row.at(-1)[0], 1],
  ]) {
    const points = [
      [crestZ(x) - 5.5, crest],
      ...profile.toReversed().map(([y]) => [faceZ(x, y), y]),
    ];
    for (let i = 1; i < points.length; i++) {
      const [z, y] = points[i - 1],
        [w, h] = points[i];
      q(
        o,
        c,
        [
          [x, y, z],
          [x, h, w],
          [x, foundation, w],
          [x, foundation, z],
        ],
        'wall',
        [side, 0, 0],
      );
    }
  }
}

function recessed(o, c, group, deep) {
  const {
      span: [a, b],
      count,
      low,
      high,
    } = group,
    step = (b - a) / count;
  face(o, c, a, b, high, crest);
  face(o, c, a, b, foundation, low);
  const depth = deep ? 8.7 : 12.8;
  for (let i = 0; i < count; i++) {
    const p = a + i * step,
      q0 = p + step,
      lo = p + step * 0.17,
      hi = q0 - step * 0.17;
    face(o, c, p, lo, low, high);
    face(o, c, hi, q0, low, high);
    face(o, c, lo, hi, low, high, 'dark', -depth);
    if (c.detail) {
      const P = (x, y, d = 0) => [x, y, faceZ(x, y) + d];
      for (const [x, n] of [
        [lo, 1],
        [hi, -1],
      ]) {
        q(o, c, [P(x, low), P(x, low, -depth), P(x, high, -depth), P(x, high)], 'trim', [n, 0, 0]);
      }
      q(o, c, [P(lo, low), P(hi, low), P(hi, low, -depth), P(lo, low, -depth)], 'wall', [0, 1, 0]);
      q(
        o,
        c,
        [P(lo, high), P(hi, high), P(hi, high, -depth), P(lo, high, -depth)],
        'trim',
        [0, -1, 0],
      );
      if (deep) {
        const z = faceZ((lo + hi) / 2, high);
        box(o, c, lo - 0.35, hi + 0.35, z - 3, z + 2.1, high - 0.13, high + 0.66, 'trim');
      } else if (c.near) {
        const z = faceZ((lo + hi) / 2, low);
        q(
          o,
          c,
          [
            [lo, low, z],
            [hi, low, z],
            [hi, tailwater + 0.22, z + 15],
            [lo, tailwater + 0.22, z + 15],
          ],
          'trim',
          [0, 1, 1],
        );
        for (const x of [lo, hi])
          rod(o, c, [x, low, z], [x, tailwater + 0.31, z + 15], 0.22, 0.2, 'trim');
      }
    }
  }
}

function gravity(o, c) {
  const [a, b] = wall.span,
    [l, r] = spill.west.span,
    [u, v] = spill.east.span;
  for (const [p, q0] of [
    [a, l],
    [r, u],
    [v, b],
  ])
    face(o, c, p, q0, foundation, crest);
  recessed(o, c, spill.west, true);
  recessed(o, c, spill.east, false);
  if (c.fine)
    for (let x = a + 15; x < b - 2; x += 14.8) {
      face(o, c, x - 0.075, x + 0.075, tailwater + 44, crest - 1.1, 'trim', 0.11);
    }
}

function plantApproach(o, c) {
  const a = -138,
    b = 95,
    z = 42,
    w = 72,
    y = tailwater + 19.5,
    h = plant.terrace - 0.27;
  q(
    o,
    c,
    [
      [a, y, z],
      [b, y, z],
      [b, h, w],
      [a, h, w],
    ],
    'road',
    [0, 1, 0],
  );
  for (const [x, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    q(
      o,
      c,
      [
        [x, y, z],
        [x, h, w],
        [x, foundation, w],
        [x, foundation, z],
      ],
      'wall',
      [sign, 0, 0],
    );
  }
  box(o, c, a, b, z - 0.8, z + 1.5, foundation, y, 'wall');
  box(o, c, a, b, w - 1, w + 1.2, foundation, h, 'wall');
  const x = 96,
    near = faceZ(x, tailwater + 24);
  box(o, c, x - 5, x + 5, near - 3, 66, foundation, tailwater + 20.5, 'wall');
  box(o, c, x - 4.8, x + 5.1, near + 6, 65, tailwater + 20.48, tailwater + 27.5, 'pale');
  box(o, c, x - 5.2, x + 5.5, near + 5.6, 65.35, tailwater + 27.5, tailwater + 27.96, 'roof');
  if (c.detail) {
    box(o, c, x - 3.7, x + 4.05, 65, 65.13, tailwater + 22.2, tailwater + 24.7, 'glass');
    rod(
      o,
      c,
      [x - 3.8, tailwater + 16, 65.4],
      [x - 3.8, tailwater + 20.5, 62.1],
      0.17,
      0.17,
      'frame',
    );
  }
}

function generatingHall(o, c) {
  const [a, b, d, e] = plant.footprint,
    { terrace, roof, outlets } = plant;
  const length = Math.hypot(d[0] - e[0], d[1] - e[1]),
    width = Math.hypot(b[0] - d[0], b[1] - d[1]),
    step = length / outlets;
  const P = (x, z, y) => {
    const u = x / length,
      v = z / width;
    return [
      lerp(lerp(a[0], b[0], u), lerp(e[0], d[0], u), v),
      y,
      lerp(lerp(a[1], b[1], u), lerp(e[1], d[1], u), v),
    ];
  };
  prism(o, c, P, 0, length, 0, width, terrace, roof, 'pale');
  prism(o, c, P, -0.35, length + 0.35, -0.35, width + 0.43, roof, roof + 0.5, 'roof');
  prism(o, c, P, 0, length, width - 1, width + 5.3, terrace - 0.53, terrace + 0.17, 'trim');
  for (let i = 0; i <= outlets; i++) {
    const x = i * step;
    prism(o, c, P, x - 0.79, x + 0.79, width - 7.4, width + 4.75, foundation, terrace, 'trim');
    if (i === outlets) break;
    prism(o, c, P, x + 0.8, x + step - 0.8, width - 10.2, width - 9.9, foundation, terrace, 'dark');
    if (c.detail)
      for (let j = 0; j < 2; j++) {
        const u = x + ((j + 0.17) * step) / 2,
          v = x + ((j + 0.9) * step) / 2;
        prism(o, c, P, u, v, width + 0.012, width + 0.095, terrace + 1.47, terrace + 4.71, 'glass');
        if (c.fine)
          for (let k = 1; k < 3; k++) {
            const m = lerp(u, v, k / 3);
            rod(
              o,
              c,
              P(m, width + 0.103, terrace + 1.5),
              P(m, width + 0.103, terrace + 4.73),
              0.075,
              0.075,
              'pale',
            );
          }
      }
  }
  if (c.detail)
    rod(
      o,
      c,
      P(0, width + 4.85, terrace + 0.98),
      P(length, width + 4.85, terrace + 0.98),
      0.11,
      0.12,
      'frame',
    );
  if (c.near)
    for (const x of [17, length - 13]) {
      prism(
        o,
        c,
        P,
        x - 2.9,
        x + 2.9,
        width + 1.1,
        width + 4.2,
        terrace + 0.15,
        terrace + 3.4,
        'red',
      );
      prism(
        o,
        c,
        P,
        x - 3.7,
        x + 3.7,
        width + 0.52,
        width + 4.8,
        terrace + 3.4,
        terrace + 4.16,
        'red',
      );
    }
  if (c.master)
    for (let x = 14; x < length - 6; x += 12) {
      prism(o, c, P, x, x + 2.2, width + 0.11, width + 0.25, terrace + 5.14, terrace + 5.87, 'red');
    }
}

function separator(o, c) {
  const head = divider[0][1];
  const top = (z) => tailwater + 2.3 + 13.1 * Math.max(0, 1 - (z - head) / 69);
  const P = ([x, z], side, y) => [x + side * 1.88, y, z];
  for (let i = 1; i < divider.length; i++) {
    const a = divider[i - 1],
      b = divider[i];
    const y = top(a[1]),
      h = top(b[1]);
    q(o, c, [P(a, -1, y), P(b, -1, h), P(b, 1, h), P(a, 1, y)], 'trim', [0, 1, 0]);
    for (const s of [-1, 1])
      q(o, c, [P(a, s, foundation), P(b, s, foundation), P(b, s, h), P(a, s, y)], 'wall', [
        s,
        0,
        0,
      ]);
    if (c.near) rod(o, c, P(a, -0.88, y + 0.69), P(b, -0.88, h + 0.69), 0.095, 0.095, 'frame');
  }
  for (const [p, n] of [
    [divider[0], -1],
    [divider.at(-1), 1],
  ]) {
    q(
      o,
      c,
      [P(p, -1, foundation), P(p, 1, foundation), P(p, 1, top(p[1])), P(p, -1, top(p[1]))],
      'trim',
      [0, 0, n],
    );
  }
  if (c.detail) {
    const [x, z] = divider.at(-1);
    box(o, c, x - 3.5, x + 3.5, z - 1, z + 3, tailwater - 1, tailwater + 3.3, 'stone');
  }
}

function machines(o, c) {
  for (const x of gantries) {
    const z = crestZ(x);
    for (const dx of [-2.1, 2.1])
      for (const dz of [-3.7, 3.7]) {
        rod(
          o,
          c,
          [x + dx, crest, z + dz],
          [x + dx * 0.83, crest + 10.4, z + dz * 0.86],
          0.52,
          0.54,
          'red',
        );
        if (c.near)
          rod(
            o,
            c,
            [x + dx, crest + 2.1, z + dz],
            [x - dx * 0.8, crest + 8.25, z + dz * 0.9],
            0.26,
            0.28,
            'red',
          );
      }
    box(o, c, x - 3.15, x + 3.15, z - 4.38, z + 4.36, crest + 9.3, crest + 12.8, 'red');
    box(o, c, x - 3.46, x + 3.46, z - 4.72, z + 4.67, crest + 12.79, crest + 13.15, 'red');
    if (c.detail)
      for (let k = 0; k < 3; k++) {
        const a = x - 2.32 + k * 1.61;
        box(o, c, a, a + 1.07, z + 4.33, z + 4.46, crest + 10.4, crest + 11.89, 'glass');
      }
  }
  if (c.detail)
    for (const x of [-109, 28]) {
      const z = crestZ(x);
      box(o, c, x - 1.5, x + 1.5, z - 2.1, z + 1.7, crest, crest + 2.2, 'red');
      rod(o, c, [x, crest + 2.13, z - 0.65], [x + 3.35, crest + 5.25, z + 0.3], 0.46, 0.48, 'red');
    }
  for (const x of [-213, 89]) {
    const z = crestZ(x);
    box(o, c, x - 3.9, x + 3.9, z - 3.18, z + 4.21, crest - 0.1, crest + 4.4, 'pale');
    if (c.detail)
      box(o, c, x - 3.14, x + 3.2, z + 4.19, z + 4.33, crest + 1.64, crest + 3.57, 'glass');
  }
}

// Original line glyphs interpret the wording on the two concrete faces.
const glyphs = {
  黄: [
    [
      [0.23, 0.83],
      [0.8, 0.83],
    ],
    [
      [0.34, 0.94],
      [0.34, 0.67],
    ],
    [
      [0.66, 0.94],
      [0.66, 0.67],
    ],
    [
      [0.14, 0.67],
      [0.88, 0.67],
    ],
    [
      [0.25, 0.54],
      [0.76, 0.54],
      [0.76, 0.21],
      [0.25, 0.21],
      [0.25, 0.54],
    ],
    [
      [0.51, 0.65],
      [0.51, 0.21],
    ],
    [
      [0.25, 0.37],
      [0.76, 0.37],
    ],
    [
      [0.38, 0.14],
      [0.21, 0.04],
    ],
    [
      [0.62, 0.14],
      [0.79, 0.04],
    ],
  ],
  河: [
    [
      [0.09, 0.85],
      [0.21, 0.78],
    ],
    [
      [0.07, 0.57],
      [0.18, 0.51],
    ],
    [
      [0.11, 0.19],
      [0.23, 0.38],
    ],
    [
      [0.3, 0.82],
      [0.92, 0.82],
    ],
    [
      [0.79, 0.82],
      [0.79, 0.14],
      [0.65, 0.09],
    ],
    [
      [0.36, 0.65],
      [0.64, 0.65],
      [0.64, 0.33],
      [0.36, 0.33],
      [0.36, 0.65],
    ],
  ],
  安: [
    [
      [0.5, 0.96],
      [0.55, 0.85],
    ],
    [
      [0.2, 0.79],
      [0.8, 0.79],
      [0.76, 0.65],
    ],
    [
      [0.2, 0.79],
      [0.15, 0.66],
    ],
    [
      [0.11, 0.51],
      [0.9, 0.51],
    ],
    [
      [0.48, 0.68],
      [0.33, 0.38],
      [0.72, 0.1],
    ],
    [
      [0.68, 0.54],
      [0.58, 0.31],
      [0.42, 0.19],
      [0.2, 0.1],
    ],
  ],
  澜: [
    [
      [0.05, 0.84],
      [0.16, 0.77],
    ],
    [
      [0.05, 0.57],
      [0.17, 0.49],
    ],
    [
      [0.07, 0.16],
      [0.19, 0.38],
    ],
    [
      [0.3, 0.67],
      [0.3, 0.08],
    ],
    [
      [0.38, 0.92],
      [0.48, 0.85],
    ],
    [
      [0.5, 0.79],
      [0.88, 0.79],
      [0.88, 0.11],
      [0.77, 0.08],
    ],
    [
      [0.4, 0.63],
      [0.77, 0.63],
    ],
    [
      [0.59, 0.73],
      [0.59, 0.16],
    ],
    [
      [0.43, 0.54],
      [0.75, 0.54],
      [0.75, 0.35],
      [0.43, 0.35],
      [0.43, 0.54],
    ],
    [
      [0.45, 0.46],
      [0.72, 0.46],
    ],
    [
      [0.56, 0.34],
      [0.4, 0.17],
    ],
    [
      [0.62, 0.34],
      [0.78, 0.18],
    ],
  ],
  国: [
    [
      [0.17, 0.87],
      [0.84, 0.87],
      [0.84, 0.09],
      [0.17, 0.09],
      [0.17, 0.87],
    ],
    [
      [0.29, 0.73],
      [0.72, 0.73],
    ],
    [
      [0.32, 0.52],
      [0.67, 0.52],
    ],
    [
      [0.5, 0.73],
      [0.5, 0.29],
    ],
    [
      [0.28, 0.29],
      [0.72, 0.29],
    ],
    [
      [0.61, 0.48],
      [0.69, 0.39],
    ],
  ],
  泰: [
    [
      [0.22, 0.86],
      [0.79, 0.86],
    ],
    [
      [0.26, 0.73],
      [0.73, 0.73],
    ],
    [
      [0.14, 0.59],
      [0.86, 0.59],
    ],
    [
      [0.53, 0.95],
      [0.44, 0.65],
      [0.28, 0.48],
      [0.13, 0.39],
    ],
    [
      [0.56, 0.59],
      [0.71, 0.44],
      [0.87, 0.37],
    ],
    [
      [0.5, 0.48],
      [0.5, 0.12],
      [0.42, 0.09],
    ],
    [
      [0.31, 0.38],
      [0.41, 0.28],
    ],
    [
      [0.21, 0.16],
      [0.41, 0.24],
    ],
    [
      [0.65, 0.36],
      [0.56, 0.27],
    ],
    [
      [0.58, 0.25],
      [0.79, 0.14],
    ],
  ],
  民: [
    [
      [0.19, 0.88],
      [0.76, 0.88],
      [0.76, 0.66],
      [0.2, 0.66],
    ],
    [
      [0.21, 0.88],
      [0.21, 0.14],
      [0.43, 0.24],
    ],
    [
      [0.21, 0.49],
      [0.87, 0.49],
    ],
    [
      [0.51, 0.66],
      [0.59, 0.35],
      [0.72, 0.16],
      [0.84, 0.1],
      [0.9, 0.22],
    ],
  ],
};
function signage(o, c) {
  if (!c.near) return;
  const bands = [
    ['黄河安澜', -93, 35],
    ['国泰民安', 123, 27],
  ];
  for (const [text, a, spacing] of bands)
    for (let i = 0; i < text.length; i++) {
      const x = a + i * spacing;
      for (const line of glyphs[text[i]])
        for (let j = 1; j < line.length; j++) {
          const [u, v] = line[j - 1],
            [r, h] = line[j],
            dx = (r - u) * 8,
            dy = (h - v) * 10,
            length = Math.hypot(dx, dy),
            sx = (-dy * 0.2) / length,
            sy = (dx * 0.2) / length;
          const P = (u, v, s) => {
            const a = x + u * 8 + sx * s,
              y = crest - 17 + v * 10 + sy * s;
            return [a, y, faceZ(a, y) + 0.16];
          };
          q(o, c, [P(u, v, -1), P(r, h, -1), P(r, h, 1), P(u, v, 1)], 'letter', [0, 0, 1]);
        }
    }
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error(`Unknown Sanmenxia tier ${level}`);
  deck(o, c);
  gravity(o, c);
  if (c.detail) plantApproach(o, c);
  generatingHall(o, c);
  separator(o, c);
  machines(o, c);
  signage(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

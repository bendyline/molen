import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [-10.42949016, 13.197351992],
  heading: -1.528484012338,
  datum: 204.42665966666667,
  crest: 8.073340333333334,
  foundation: -56.926659666666666,
  tailwater: -42.20665966666667,
  wingStations: [
    [
      {
        x: -740.93,
        z: -35,
        y: 17.34415488826383,
        upZ: -46,
        downZ: 44,
        up: 16.64415488826383,
        down: 6.478006840833274,
      },
      {
        x: -716,
        z: -34,
        y: 7.973748650073369,
        upZ: -48,
        downZ: 44,
        up: 7.273748650073369,
        down: -1.3702237777777952,
      },
      {
        x: -650,
        z: -34,
        y: 8.073340333333334,
        upZ: -50,
        downZ: 45,
        up: 4.03746955555556,
        down: -15.955159416666646,
      },
      {
        x: -520,
        z: -33,
        y: 8.073340333333334,
        upZ: -51,
        downZ: 45,
        up: 1.7243332500000008,
        down: -23.552462750000018,
      },
      {
        x: -345,
        z: -32,
        y: 8.073340333333334,
        upZ: -50,
        downZ: 47,
        up: 4.030151333333322,
        down: -20.37634322916665,
      },
      {
        x: -210,
        z: -31,
        y: 8.073340333333334,
        upZ: -49,
        downZ: 48,
        up: 3.0202311666667185,
        down: -21.181034666666676,
      },
      {
        x: -75,
        z: -28.5,
        y: 8.073340333333334,
        upZ: -43,
        downZ: 47,
        up: 4.263013479166631,
        down: -23.880973520833322,
      },
    ],
    [
      {
        x: 418,
        z: -28.5,
        y: 8.073340333333334,
        upZ: -47,
        downZ: 47,
        up: 4.723843708333362,
        down: -28.560858444444392,
      },
      {
        x: 485,
        z: -31,
        y: 8.073340333333334,
        upZ: -51,
        downZ: 47,
        up: 5.746338500000007,
        down: -24.523879840277772,
      },
      {
        x: 560,
        z: -33,
        y: 8.073340333333334,
        upZ: -51,
        downZ: 48,
        up: 5.776203416666675,
        down: -25.416754999999995,
      },
      {
        x: 640,
        z: -33,
        y: 8.073340333333334,
        upZ: -51,
        downZ: 48,
        up: 3.614888250000007,
        down: -18.928309333333317,
      },
      {
        x: 688,
        z: -33,
        y: 8.065552299748422,
        upZ: -49,
        downZ: 27,
        up: 3.279485444444447,
        down: -1.3553004166666085,
      },
      {
        x: 717,
        z: -33,
        y: 8.113120502932388,
        upZ: -46,
        downZ: 8,
        up: 7.4131205029323874,
        down: 7.4131205029323874,
      },
      {
        x: 740.93,
        z: -35,
        y: 19.87678785687484,
        upZ: -44,
        downZ: -5,
        up: 19.176787856874842,
        down: 19.176787856874842,
      },
    ],
  ],
  wall: {
    span: [-75, 418],
    centerZ: -27.1,
    upstreamFaceZ: -33,
    downstreamToeZ: 54,
  },
  spill: {
    span: [179, 300],
    clearWidth: 9,
    count: 8,
    crestZ: -27.1,
    apronZ: 89,
  },
  plant: {
    span: [36, 178],
    upstreamZ: 19,
    downstreamZ: 64,
    tailraceOutletCount: 5,
    roofY: -20.906659666666666,
  },
  scope:
    'Manantali’s central concrete dam with its eight gated spillways, ochre generating hall and five tailrace outlets, the crest control tower and gantries, and both rockfill wings.',
};
const C = {
  wall: [0.49, 0.41, 0.31],
  trim: [0.62, 0.53, 0.4],
  ochre: [0.64, 0.43, 0.25],
  dark: [0.24, 0.2, 0.16],
  road: [0.44, 0.42, 0.38],
  stone: [0.44, 0.34, 0.23],
  silt: [0.49, 0.36, 0.25],
  gate: [0.31, 0.34, 0.32],
  paint: [0.77, 0.59, 0.25],
  red: [0.58, 0.22, 0.14],
  glass: [0.23, 0.32, 0.36],
  roof: [0.44, 0.39, 0.3],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  trim: { slot: 'wall', graph: 'concrete_boardformed' },
  ochre: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  road: { slot: 'foundation', graph: 'concrete_plain' },
  stone: { slot: 'foundation', graph: 'gravel' },
  silt: { slot: 'foundation', graph: 'gravel' },
  gate: { slot: 'door', graph: 'metal_painted' },
  paint: { slot: 'door', graph: 'metal_painted' },
  red: { slot: 'door', graph: 'metal_painted' },
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
const { crest, foundation, tailwater, wall, spill, plant, wingStations } = controls;
const ramp = [
  [-18, crest - 1.4],
  [-17, crest - 18],
  [5, tailwater + 11],
  [wall.downstreamToeZ, tailwater + 1.9],
];
const chute = [
  [-13, crest - 11],
  [-3, crest - 19],
  [13, tailwater + 14],
  [43, tailwater + 5],
  [spill.apronZ, tailwater + 0.45],
];

function flank(o, c, stations) {
  const section = (p) => [
    [p.upZ, p.up],
    [(p.upZ + p.z - 4) / 2, (p.up + p.y) / 2 - 0.35],
    [p.z - 4, p.y],
    [p.z + 5, p.y],
    [p.z + (p.downZ - p.z) * 0.42, lerp(p.y, p.down, 0.57)],
    [p.downZ, p.down],
  ];
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      A = section(a),
      B = section(b);
    const P = (r, v) => [r.x, v[1], v[0]];
    for (let j = 1; j < A.length; j++) {
      const mat = j === 3 ? 'road' : j === 4 ? 'silt' : 'stone';
      q(o, c, [P(a, A[j - 1]), P(b, B[j - 1]), P(b, B[j]), P(a, A[j])], mat, [0, 1, 0]);
    }
    for (const [j, sign] of [
      [0, -1],
      [5, 1],
    ]) {
      q(
        o,
        c,
        [P(a, A[j]), P(b, B[j]), [b.x, foundation, B[j][0]], [a.x, foundation, A[j][0]]],
        'stone',
        [0, 0, sign],
      );
    }
    if (c.detail)
      for (const z of [-3.65, 4.65])
        rod(o, c, [a.x, a.y + 0.4, a.z + z], [b.x, b.y + 0.4, b.z + z], 0.16, 0.19, 'trim');
    if (c.near)
      for (let k = 1; k <= Math.floor((b.x - a.x) / 24); k++) {
        const f = (k * 24) / (b.x - a.x),
          x = lerp(a.x, b.x, f),
          y = lerp(a.y, b.y, f),
          z = lerp(a.z, b.z, f) + 4.6;
        rod(o, c, [x, y, z], [x, y + 0.46, z], 0.11, 0.13, 'trim');
      }
  }
  for (const [p, sign] of [
    [stations[0], -1],
    [stations.at(-1), 1],
  ]) {
    const A = section(p);
    for (let j = 1; j < A.length; j++) {
      const [z, y] = A[j - 1],
        [w, h] = A[j];
      q(
        o,
        c,
        [
          [p.x, y, z],
          [p.x, h, w],
          [p.x, foundation, w],
          [p.x, foundation, z],
        ],
        'stone',
        [sign, 0, 0],
      );
    }
  }
}

function sloped(o, c, a, b, profile, material) {
  for (let j = 1; j < profile.length; j++) {
    const [z, y] = profile[j - 1],
      [w, h] = profile[j];
    q(
      o,
      c,
      [
        [a, y, z],
        [b, y, z],
        [b, h, w],
        [a, h, w],
      ],
      material,
      [0, 1, 1],
    );
  }
}

function buttress(o, c, x, width, profile) {
  if (c.detail)
    for (const [s, sign] of [
      [x - width / 2, -1],
      [x + width / 2, 1],
    ]) {
      for (let i = 1; i < profile.length; i++) {
        const [a, y] = profile[i - 1],
          [b, h] = profile[i];
        q(
          o,
          c,
          [
            [s, y, a],
            [s, h, b],
            [s, foundation, b],
            [s, foundation, a],
          ],
          'wall',
          [sign, 0, 0],
        );
      }
    }
  sloped(o, c, x - width / 2, x + width / 2, profile, 'trim');
}

function concrete(o, c) {
  const [a, b] = wall.span,
    [p, r] = spill.span;
  box(o, c, a, b, -33, -29.5, foundation, crest - 0.45, 'wall');
  box(o, c, a, b, -33, -18, crest - 0.48, crest, 'road');
  box(o, c, a, b, -33.2, -32.55, crest, crest + 0.46, 'trim');
  box(o, c, a, b, -18.5, -17.75, crest, crest + 0.43, 'trim');
  for (const [u, v] of [
    [a, p],
    [r, b],
  ]) {
    box(o, c, u, v, -19.05, -17.99, crest - 1.65, crest - 0.43, 'wall');
    sloped(o, c, u, v, ramp, 'wall');
    const toe = ramp.at(-1);
    box(o, c, u, v, toe[0] - 1.7, toe[0] + 1.4, foundation, toe[1], 'wall');
    const n = Math.ceil((v - u) / 18.6);
    for (let j = 1; j < n; j++) {
      const x = lerp(u, v, j / n);
      if (c.detail)
        buttress(o, c, x, 1.25, [
          [-16.95, crest - 15],
          [-3.4, tailwater + 20],
          [16, tailwater + 8.7],
          [53, tailwater + 2.35],
        ]);
      if (c.fine)
        q(
          o,
          c,
          [
            [x - 0.18, crest - 2, -17.94],
            [x + 0.18, crest - 2, -17.94],
            [x + 0.18, crest - 17.9, -16.94],
            [x - 0.18, crest - 17.9, -16.94],
          ],
          'trim',
          [0, 0, 1],
        );
    }
  }
  for (const x of [a, b])
    buttress(o, c, x, 3.4, [
      [-33, crest],
      [-18, crest],
      [4, tailwater + 18],
      [54, tailwater + 2],
    ]);
  if (c.detail)
    for (let x = a + 8; x < b - 5; x += 19.6) {
      rod(o, c, [x, crest - 0.03, -18.12], [x, crest + 0.46, -18.12], 0.13, 0.16, 'gate');
      if (c.fine) rod(o, c, [x, crest + 0.43, -18.12], [x, crest + 3.1, -18.12], 0.1, 0.1, 'gate');
    }
}

function spillway(o, c) {
  const {
      span: [a, b],
      count,
      clearWidth,
      apronZ,
    } = spill,
    step = (b - a) / count;
  box(o, c, a, b, apronZ - 5, apronZ + 5, foundation, tailwater + 0.44, 'wall');
  for (let i = 0; i <= count; i++) {
    const x = a + i * step;
    const w = (step - clearWidth) / 2;
    box(o, c, x - w, x + w, -22, -8, tailwater + 16, crest + 0.13, 'trim');
    buttress(o, c, x, w * 1.12, [
      [-9, crest - 2],
      [8, tailwater + 18],
      [35, tailwater + 7],
      [84, tailwater + 0.59],
    ]);
    if (i === count) break;
    const lo = x + w,
      hi = x + step - w;
    sloped(o, c, x, x + step, chute, 'wall');
    const folds = c.near
      ? [
          [-13.4, crest - 3.8],
          [-9.8, crest - 7.9],
          [-11.2, crest - 11.5],
          [-14.2, crest - 13.9],
        ]
      : [
          [-13.4, crest - 3.8],
          [-14.2, crest - 13.9],
        ];
    for (let j = 1; j < folds.length; j++) {
      const [z, y] = folds[j - 1],
        [v, h] = folds[j];
      q(
        o,
        c,
        [
          [lo, y, z],
          [hi, y, z],
          [hi, h, v],
          [lo, h, v],
        ],
        'gate',
        [0, 0, 1],
      );
    }
    if (c.detail) {
      for (const [p, r] of [
        [lo + 0.32, hi - 0.32],
        [hi - 0.32, lo + 0.32],
      ])
        rod(o, c, [p, crest - 5.1, -10.6], [r, crest - 11.5, -8.8], 0.2, 0.2, 'gate');
      rod(o, c, [lo, crest - 12.6, -10.1], [hi, crest - 12.6, -10.1], 0.19, 0.19, 'gate');
    }
    if (c.fine)
      for (let j = 1; j < 6; j++) {
        const u = lerp(lo, hi, j / 6);
        rod(o, c, [u, crest - 4.1, -12.9], [u, crest - 11.5, -11], 0.15, 0.17, 'gate');
      }
    box(
      o,
      c,
      lo + 0.5,
      hi - 0.5,
      apronZ - 3.1,
      apronZ + 1.2,
      tailwater + 0.4,
      tailwater + 0.94,
      'trim',
    );
    if (c.master) {
      const u = (lo + hi) / 2;
      box(o, c, u - 1.4, u + 1.4, -29.1, -26.6, crest, crest + 0.55, 'gate');
      for (const v of [lo + 0.57, hi - 0.57])
        rod(o, c, [v, crest - 1.58, -12.1], [v, crest - 10.6, -10.9], 0.11, 0.13, 'gate');
    }
  }
  for (const x of [a - 3, b + 3])
    buttress(o, c, x, 4.3, [
      [-20, crest],
      [-6, crest - 5],
      [19, tailwater + 20],
      [89, tailwater + 1.2],
    ]);
}

function powerhouse(o, c) {
  const {
    span: [a, b],
    upstreamZ: z,
    downstreamZ: w,
    roofY: y,
    tailraceOutletCount: count,
  } = plant;
  const slab = tailwater + 8.7,
    step = (b - a) / count;
  box(o, c, a, b, z, w, slab, y, 'ochre');
  box(o, c, a - 0.28, b + 0.32, z - 0.26, w + 0.24, y, y + 0.65, 'roof');
  box(o, c, a, b, w - 3, w + 4, slab - 0.55, slab + 0.16, 'trim');
  for (let i = 0; i <= count; i++) {
    const x = a + i * step;
    box(o, c, x - 1.15, x + 1.15, w - 8, w + 4, foundation, slab, 'trim');
    if (i === count) break;
    box(o, c, x + 1.15, x + step - 1.15, w - 10.8, w - 10.37, foundation, slab, 'dark');
    if (c.detail)
      box(o, c, x + 1.1, x + step - 1.1, w - 10.8, w + 4, foundation, foundation + 0.52, 'wall');
    if (c.near) {
      const u = x + step / 2;
      box(o, c, u - 0.66, u + 0.66, w - 7.7, w + 3.7, foundation, slab, 'wall');
    }
    if (c.detail)
      for (let j = 0; j < 3; j++) {
        const u = x + (j * step) / 3 + 0.74,
          v = x + ((j + 1) * step) / 3 - 0.43;
        box(o, c, u, v, w + 0.025, w + 0.105, y - 7.3, y - 3.1, 'glass');
        box(o, c, u, v, w + 0.023, w + 0.091, slab + 1.14, slab + 3.6, 'glass');
        if (c.fine)
          for (let k = 1; k <= 3; k++) {
            const u0 = lerp(u, v, k / 4);
            rod(o, c, [u0, y - 7.27, w + 0.122], [u0, y - 3.08, w + 0.122], 0.11, 0.12, 'trim');
            rod(
              o,
              c,
              [u0, slab + 1.13, w + 0.112],
              [u0, slab + 3.62, w + 0.112],
              0.095,
              0.1,
              'trim',
            );
          }
      }
  }
  if (c.detail) {
    box(o, c, a - 0.12, b + 0.14, w - 0.28, w + 0.36, y - 2.65, y - 2.29, 'trim');
    box(o, c, a - 0.12, b + 0.14, w - 0.31, w + 0.28, slab + 4.33, slab + 4.64, 'trim');
    rod(o, c, [a, slab + 0.95, w + 3.7], [b, slab + 0.95, w + 3.7], 0.12, 0.12, 'paint');
  }
  if (c.master)
    for (let i = 0; i < count; i++) {
      const u = a + (i + 0.5) * step;
      box(o, c, u - 1.2, u + 1.2, w + 0.11, w + 0.29, slab + 0.11, slab + 2.65, 'gate');
      rod(
        o,
        c,
        [u - 1.4, slab + 0.15, w + 3.1],
        [u + 1.4, slab + 2.75, w + 3.1],
        0.15,
        0.15,
        'paint',
      );
    }
  if (c.fine)
    for (let x = a + 0.7; x < b; x += 3.8)
      rod(o, c, [x, slab + 0.16, w + 3.7], [x, slab + 0.95, w + 3.7], 0.075, 0.08, 'paint');
  for (const x of [a, b]) {
    box(o, c, x - 2.35, x + 2.35, z - 2, w + 12, foundation, slab - 0.08, 'wall');
  }
}

function crestBuildings(o, c) {
  const x = 238.7,
    z = -24.2;
  box(o, c, x - 3.7, x + 3.7, z - 4, z + 4, crest, crest + 5.7, 'trim');
  box(o, c, x - 4.95, x + 4.95, z - 4.65, z + 4.6, crest + 5.65, crest + 7.9, 'ochre');
  box(o, c, x - 5.25, x + 5.25, z - 4.95, z + 4.95, crest + 7.85, crest + 8.27, 'roof');
  if (c.detail) {
    box(o, c, x - 4.15, x + 4.15, z + 4.61, z + 4.73, crest + 6.14, crest + 7.47, 'glass');
    box(o, c, x - 4.15, x + 4.15, z - 4.76, z - 4.63, crest + 6.14, crest + 7.47, 'glass');
  }
  for (const [u, mat] of [
    [54, 'red'],
    [263, 'paint'],
  ]) {
    for (const dx of [-3.1, 3.1])
      for (const v of [-29.8, -19.6]) {
        rod(o, c, [u + dx, crest, v], [u + dx * 0.86, crest + 5.9, v], 0.43, 0.48, 'paint');
        if (c.near)
          rod(o, c, [u + dx, crest + 1.1, v], [u + dx * 0.68, crest + 5.3, v], 0.19, 0.23, 'paint');
      }
    box(o, c, u - 4.1, u + 4.1, -31, -18.4, crest + 5.84, crest + 7.6, mat);
    if (c.detail) rod(o, c, [u, crest + 5.82, -22.4], [u, crest + 2.2, -22.4], 0.16, 0.16, 'gate');
  }
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error(`Unknown Manantali tier ${level}`);
  for (const stations of wingStations) flank(o, c, stations);
  concrete(o, c);
  spillway(o, c);
  powerhouse(o, c);
  crestBuildings(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

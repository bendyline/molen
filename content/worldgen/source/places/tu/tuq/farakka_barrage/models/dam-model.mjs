import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  datum: 22.996094,
  crest: 6.803906000000001,
  tailwater: -5.003906000000001,
  foundation: -12.596093999999999,
  main: {
    west: -1130.05189,
    east: 1114.94811,
    bays: 109,
    fishBay: 25,
    clearWidth: 18.3,
  },
  head: {
    from: [-1171.8, -52],
    length: 182.66734793060309,
    axis: [-0.08540114134643655, -0.996346649041751],
    side: [-0.996346649041751, 0.08540114134643655],
    bays: 11,
    crest: 4.503906000000001,
  },
  lock: {
    from: [-2313.43, -2034.95],
    length: 181.72042620465106,
    axis: [-0.24504675082508953, 0.969511263426097],
    side: [0.969511263426097, 0.24504675082508953],
    width: 25.145,
    crest: 4.903905999999999,
    floor: -11.496094,
    stage: -3.1960939999999987,
  },
  banks: [
    [
      [-1267.05189, 5, 10.003906, 43, 9.34724589105086, 10.061884089531873],
      [-1233.05189, 4, 10.603906000000002, 40, 10.156065002259844, 10.828222755920159],
      [-1189.05189, 1.7, 11.553905999999998, 35, 10.788984930517877, 10.848427668376367],
      [-1157.05189, 0, 9.753906, 32, 8.821712529321871, 8.451513844334997],
      [-1130.05189, 0, 6.803906000000001, 29, 6.4620915735263225, 3.591830686453509],
    ],
    [
      [1114.94811, 0, 6.803906000000001, 29, 6.338967996471876, 0.6806944183435242],
      [1176.94811, 3, 5.003906000000001, 34, 9.699193177016056, 5.3285994445470415],
      [1246.94811, 17, 4.203906, 46, 6.726255801491128, 1.9260443698524483],
    ],
  ],
};
const C = {
  wall: [0.47, 0.41, 0.32],
  trim: [0.59, 0.54, 0.43],
  road: [0.31, 0.32, 0.3],
  stone: [0.43, 0.37, 0.29],
  earth: [0.33, 0.39, 0.24],
  dark: [0.18, 0.23, 0.23],
  gate: [0.32, 0.38, 0.4],
  steel: [0.43, 0.52, 0.57],
  paint: [0.64, 0.29, 0.12],
  line: [0.74, 0.71, 0.61],
  glass: [0.19, 0.31, 0.36],
  roof: [0.39, 0.42, 0.39],
  brick: [0.54, 0.32, 0.26],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  trim: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  road: { slot: 'foundation', graph: 'concrete_plain' },
  line: { slot: 'foundation', graph: 'concrete_plain' },
  stone: { slot: 'foundation', graph: 'gravel' },
  earth: { slot: 'foundation', graph: 'gravel' },
  gate: { slot: 'door', graph: 'metal_painted' },
  steel: { slot: 'door', graph: 'metal_painted' },
  paint: { slot: 'door', graph: 'metal_painted' },
  glass: { slot: 'window', graph: 'window_grid' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
  brick: { slot: 'wall', graph: 'brick' },
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
const { crest, tailwater, foundation, main, head, lock, banks } = controls;
const H = crest + 6.5;
const frameOf = (l) => (u, v, y) => [
  l.from[0] + l.axis[0] * u + l.side[0] * v,
  y,
  l.from[1] + l.axis[1] * u + l.side[1] * v,
];

function approach(o, c) {
  for (const row of banks) {
    const stations = c.detail ? row : [row[0], row.at(-2), row.at(-1)];
    for (let i = 1; i < stations.length; i++) {
      const [a, z, y, w, ...left] = stations[i - 1],
        [b, v, h, u, ...right] = stations[i];
      q(
        o,
        c,
        [
          [a, y, z - 21],
          [b, h, v - 21],
          [b, h, v + 6.4],
          [a, y, z + 6.4],
        ],
        'road',
        [0, 1, 0],
      );
      for (const sign of [-1, 1]) {
        const edge = sign < 0 ? -21 : 6.4,
          material = sign < 0 ? 'stone' : 'earth';
        const bank = sign < 0 ? 0 : 1,
          az = z + sign * w,
          bz = v + sign * u,
          ay = left[bank] - 0.08,
          by = right[bank] - 0.08;
        q(
          o,
          c,
          [
            [a, y, z + edge],
            [b, h, v + edge],
            [b, by, bz],
            [a, ay, az],
          ],
          material,
          [0, 1, sign],
        );
        if (c.detail)
          q(
            o,
            c,
            [
              [a, ay, az],
              [b, by, bz],
              [b, foundation, bz],
              [a, foundation, az],
            ],
            material,
            [0, 0, sign],
          );
      }
      if (c.detail)
        for (const [z0, z1] of [
          [-18.2, -18.2],
          [-9.1, -9.1],
        ])
          for (const offset of [-0.8, 0.8]) {
            rod(o, c, [a, y + 0.31, z0 + offset], [b, h + 0.31, z1 + offset], 0.075, 0.095, 'gate');
          }
    }
    if (c.detail)
      for (const [[x, z, y, w, left, right], sign] of [
        [stations[0], -1],
        [stations.at(-1), 1],
      ]) {
        const section = [
          [-w, left],
          [-21, y],
          [6.4, y],
          [w, right],
        ];
        for (let i = 1; i < section.length; i++) {
          const [a, h] = section[i - 1],
            [b, k] = section[i];
          const base = foundation;
          q(
            o,
            c,
            [
              [x, h, z + a],
              [x, k, z + b],
              [x, base, z + b],
              [x, base, z + a],
            ],
            'stone',
            [sign, 0, 0],
          );
        }
      }
  }
}

function crestDeck(o, c) {
  const { west: a, east: b } = main;
  box(o, c, a, b, -22.1, 6.4, crest - 1.4, crest, 'road');
  box(o, c, a, b, -22.1, -6.1, crest, crest + 0.24, 'stone');
  box(o, c, a, b, 5.1, 6.45, crest, crest + 0.28, 'trim');
  box(o, c, a, b, -6.15, -4.9, crest, crest + 0.31, 'trim');
  box(o, c, a, b, -32.3, -22.2, H - 0.53, H, 'steel');
  if (!c.detail) return;
  box(o, c, a, b, -32.45, -31.75, H - 1.54, H - 0.52, 'steel');
  box(o, c, a, b, -22.8, -22.08, H - 1.54, H - 0.52, 'steel');
  rod(o, c, [a, H + 0.92, -32.08], [b, H + 0.92, -32.08], 0.14, 0.16, 'steel');
  rod(o, c, [a, crest + 0.98, 6.25], [b, crest + 0.98, 6.25], 0.19, 0.18, 'paint');
  for (const [from, to] of [
    [-17.4, -18.2],
    [-8.3, -11.2],
  ])
    for (const offset of [-0.8, 0.8]) {
      rod(
        o,
        c,
        [a, crest + 0.31, from + offset],
        [b, crest + 0.31, to + offset],
        0.075,
        0.095,
        'gate',
      );
    }
  if (!c.near) return;
  for (let x = a + 9; x < b - 5; x += c.fine ? 17 : 34) {
    box(o, c, x, x + 3.2, -0.08, 0.08, crest + 0.012, crest + 0.038, 'line');
    box(o, c, x - 0.095, x + 0.095, 6.12, 6.35, crest + 0.22, crest + 1.05, 'paint');
    box(o, c, x - 0.11, x + 0.11, -32.19, -31.98, H, H + 0.94, 'steel');
  }
  for (let x = a + 15; x < b - 5; x += 28) {
    rod(o, c, [x, crest, -21.2], [x, crest + 5.4, -21.2], 0.13, 0.13);
    rod(o, c, [x, crest + 5.24, -21.2], [x, crest + 5.1, -7.45], 0.13, 0.13);
  }
  if (c.fine)
    for (let x = a + 1; x < b - 1; x += c.master ? 1.3 : 3.2) {
      const t = (x - a) / (b - a);
      for (const z of [-17.4 - 0.8 * t, -8.3 - 2.9 * t])
        box(o, c, x - 0.16, x + 0.16, z - 1.12, z + 1.12, crest + 0.22, crest + 0.286, 'stone');
    }
}

function pier(o, c, x) {
  const half = 1.12,
    base = foundation + 0.55;
  const z = -23.4,
    w = 7.3;
  if (!c.detail) {
    q(
      o,
      c,
      [
        [x - half, tailwater + 1.1, -34],
        [x + half, tailwater + 1.1, -34],
        [x + half, crest - 0.37, w],
        [x - half, crest - 0.37, w],
      ],
      'wall',
      [0, 1, 0],
    );
    return;
  }
  box(o, c, x - half, x + half, z, w, base, crest - 0.37, 'wall');
  if (!c.near) {
    for (const [a, b] of [
      [-34.1, z],
      [w, 13.5],
    ])
      q(
        o,
        c,
        [
          [x - half, tailwater + 1.1, a],
          [x + half, tailwater + 1.1, a],
          [x + half, tailwater + 1.1, b],
          [x - half, tailwater + 1.1, b],
        ],
        'trim',
        [0, 1, 0],
      );
    return;
  }
  const profile = c.fine
    ? [
        [-34.1, 0.25],
        [-32.9, 0.91],
        [-30.9, 1.14],
        [9.8, 1.14],
        [12.1, 0.87],
        [13.5, 0.3],
      ]
    : [
        [-34.1, 0.36],
        [-30.9, 1.14],
        [13.5, 0.4],
      ];
  for (let j = 1; j < profile.length; j++) {
    const [z0, h0] = profile[j - 1],
      [z1, h1] = profile[j];
    for (const s of [-1, 1]) {
      q(
        o,
        c,
        [
          [x + s * h0, base, z0],
          [x + s * h1, base, z1],
          [x + s * h1, tailwater + 1.1, z1],
          [x + s * h0, tailwater + 1.1, z0],
        ],
        'wall',
        [s, 0, j === 1 ? -1 : 1],
      );
    }
    q(
      o,
      c,
      [
        [x - h0, tailwater + 1.1, z0],
        [x + h0, tailwater + 1.1, z0],
        [x + h1, tailwater + 1.1, z1],
        [x - h1, tailwater + 1.1, z1],
      ],
      'trim',
      [0, 1, 0],
    );
  }
  if (c.near)
    for (const [z1, dir, width] of [
      [-34.1, -1, 0.25],
      [13.5, 1, 0.3],
    ]) {
      q(
        o,
        c,
        [
          [x - width, base, z1],
          [x + width, base, z1],
          [x + width, tailwater + 1.1, z1],
          [x - width, tailwater + 1.1, z1],
        ],
        'wall',
        [0, 0, dir],
      );
    }
}

function trestle(o, c, x) {
  if (!c.detail) return;
  if (!c.near) {
    q(
      o,
      c,
      [
        [x - 0.52, crest - 2, -28.3],
        [x + 0.52, crest - 2, -28.3],
        [x + 0.52, H, -28.3],
        [x - 0.52, H, -28.3],
      ],
      'steel',
      [0, 0, -1],
    );
    q(
      o,
      c,
      [
        [x - 0.52, crest - 2, -26.4],
        [x + 0.52, crest - 2, -26.4],
        [x + 0.52, H, -26.4],
        [x - 0.52, H, -26.4],
      ],
      'steel',
      [0, 0, 1],
    );
    return;
  }
  if (!c.fine) {
    for (const z of [-30.1, -24.25]) {
      rod(o, c, [x, crest - 2, z], [x, H - 0.52, z], 0.25, 0.21, 'steel');
      q(
        o,
        c,
        [
          [x - 0.42, crest - 1.9, z + 0.1],
          [x - 0.29, crest - 1.9, z + 0.1],
          [x + 0.42, H - 0.54, z + 0.1],
          [x + 0.29, H - 0.54, z + 0.1],
        ],
        'steel',
        [0, 0, 1],
      );
    }
    return;
  }
  for (const z of [-30.1, -24.25]) {
    box(o, c, x - 0.44, x - 0.28, z - 0.14, z + 0.14, crest - 2, H - 0.52, 'steel');
    box(o, c, x + 0.28, x + 0.44, z - 0.14, z + 0.14, crest - 2, H - 0.52, 'steel');
    const bands = c.fine ? 3 : 2;
    for (let j = 0; j < bands; j++) {
      const a = lerp(crest - 2, H - 0.58, j / bands),
        b = lerp(crest - 2, H - 0.58, (j + 1) / bands);
      rod(o, c, [x - 0.35, a, z], [x + 0.35, b, z], 0.11, 0.105, 'gate');
      if (c.fine) rod(o, c, [x + 0.35, a, z], [x - 0.35, b, z], 0.11, 0.105, 'gate');
    }
  }
  rod(o, c, [x, crest - 0.9, -30.1], [x, H - 0.64, -24.25], 0.18, 0.21, 'steel');
  if (c.fine) rod(o, c, [x, crest - 0.9, -24.25], [x, H - 0.64, -30.1], 0.18, 0.21, 'steel');
}

function gatePanel(o, c, a, b, base, top, z) {
  q(
    o,
    c,
    [
      [a, base, z],
      [b, base, z],
      [b, top, z],
      [a, top, z],
    ],
    'gate',
    [0, 0, -1],
  );
  q(
    o,
    c,
    [
      [a, base, z + 0.26],
      [b, base, z + 0.26],
      [b, top, z + 0.26],
      [a, top, z + 0.26],
    ],
    'gate',
    [0, 0, 1],
  );
  if (c.near)
    for (let j = 1; j < (c.fine ? 5 : 3); j++) {
      const h = lerp(base, top, j / (c.fine ? 5 : 3));
      if (c.fine) rod(o, c, [a, h, z + 0.33], [b, h, z + 0.33], 0.23, 0.19, 'steel');
      else
        q(
          o,
          c,
          [
            [a, h - 0.07, z + 0.28],
            [b, h - 0.07, z + 0.28],
            [b, h + 0.07, z + 0.28],
            [a, h + 0.07, z + 0.28],
          ],
          'steel',
          [0, 0, 1],
        );
    }
  if (c.master)
    for (let j = 1; j <= 4; j++) {
      const x = lerp(a, b, j / 5);
      rod(o, c, [x, base + 0.03, z + 0.36], [x, top - 0.04, z + 0.36], 0.14, 0.19, 'gate');
    }
}

function mainBarrage(o, c) {
  const { west, east, bays, fishBay, clearWidth } = main;
  const step = (east - west) / bays,
    offset = (step - clearWidth) / 2;
  box(o, c, west, east, -36, 14, foundation, foundation + 0.55, 'wall');
  for (let i = 0; i <= bays; i++) {
    const x = west + i * step;
    pier(o, c, x);
    trestle(o, c, x);
    if (i === bays) break;
    const a = x + offset,
      b = x + step - offset,
      bay = i + 1;
    if (bay === fishBay) {
      const m = (a + b) / 2;
      box(o, c, m - 0.24, m + 0.24, -29.75, -24.2, foundation, crest + 0.65, 'trim');
      for (const [u, v] of [
        [a, m - 0.28],
        [m + 0.28, b],
      ]) {
        gatePanel(o, c, u, v, tailwater - 0.48, tailwater + 2.0, -27.3);
        gatePanel(o, c, u, v, tailwater + 2.08, crest - 1.24, -27.3);
      }
      continue;
    }
    const sill = bay <= 24 ? tailwater - 1.55 : tailwater - 0.85,
      opening = [1.8, 2.6, 0.6, 1.2, 2.0, 1.5, 1.1][i % 7];
    gatePanel(o, c, a, b, sill + opening, crest - 1.37, -27.4);
    if (c.near && i % 3 === 0) {
      const m = (a + b) / 2;
      rod(o, c, [m, crest - 1.37, -27.37], [m, H - 0.52, -27.37], 0.14, 0.15, 'gate');
    }
  }
  for (const x of [west, east]) {
    box(o, c, x - 3.7, x + 3.7, -33.7, 9, foundation, crest + 0.25, 'wall');
  }
}

function regulator(o, c) {
  const P = frameOf(head),
    step = head.length / head.bays,
    y = head.crest;
  prism(o, c, P, -20, head.length + 10, -8, 8, y - 0.89, y, 'road');
  if (c.detail)
    for (const [a, b] of [
      [-20, -0.2],
      [head.length + 0.2, head.length + 10],
    ]) {
      prism(o, c, P, a, b, -13, 13, foundation, y - 0.9, 'wall');
    }
  prism(o, c, P, -3, head.length + 2, 5.2, 9.15, y, y + 0.24, 'trim');
  prism(o, c, P, 0, head.length, -16, 20, foundation, foundation + 0.4, 'wall');
  for (let i = 0; i <= head.bays; i++) {
    const u = i * step;
    if (c.detail) prism(o, c, P, u - 0.8, u + 0.8, -10, 18, foundation, y - 0.58, 'wall');
    else
      q(
        o,
        c,
        [
          P(u - 0.8, 8, foundation),
          P(u + 0.8, 8, foundation),
          P(u + 0.8, 8, y - 0.58),
          P(u - 0.8, 8, y - 0.58),
        ],
        'wall',
        [head.side[0], 0, head.side[1]],
      );
    if (i === head.bays) break;
    const a = u + 1,
      b = u + step - 1,
      m = (a + b) / 2;
    const tiers = c.detail ? 3 : 1;
    for (let tier = 0; tier < tiers; tier++) {
      const base = tailwater + 0.15 + tier * 2.28;
      q(
        o,
        c,
        [P(a, 8, base), P(b, 8, base), P(b, 8, base + 6.73 / tiers), P(a, 8, base + 6.73 / tiers)],
        'gate',
        [head.side[0], 0, head.side[1]],
      );
    }
    if (c.detail) {
      const cap = [
        [m - 2.2, y],
        [m - 2.2, y + 0.85],
        [m - 1.4, y + 1.74],
        [m - 0.68, y + 2.12],
        [m + 0.68, y + 2.12],
        [m + 1.4, y + 1.74],
        [m + 2.2, y + 0.85],
        [m + 2.2, y],
      ];
      for (let j = 1; j < cap.length; j++) {
        const [p, h] = cap[j - 1],
          [q0, k] = cap[j];
        q(o, c, [P(p, 5.8, h), P(q0, 5.8, k), P(q0, 8.3, k), P(p, 8.3, h)], 'trim', [0, 1, 0]);
      }
      for (const z of [5.8, 8.3])
        for (let j = 2; j < cap.length; j++) {
          const [p, h] = cap[j - 1],
            [r, k] = cap[j];
          T(o, c, [P(cap[0][0], z, cap[0][1]), P(p, z, h), P(r, z, k)], 'trim', C.trim, [
            head.side[0] * (z === 8.3 ? 1 : -1),
            0,
            head.side[1] * (z === 8.3 ? 1 : -1),
          ]);
        }
    }
  }
  if (c.detail)
    for (const v of [-7.6, 8.85])
      rod(o, c, P(-2, v, y + 1), P(head.length + 1, v, y + 1), 0.14, 0.13, 'paint');
}

function controlHouse(o, c) {
  const a = -1184.5,
    b = -1161.0,
    z = -43.2,
    w = -22.7,
    y = crest;
  box(o, c, a, b, z, w, foundation, y, 'wall');
  box(o, c, a, b, z, w, y, y + 11.8, 'brick');
  box(o, c, a - 0.38, b + 0.38, z - 0.35, w + 0.35, y + 11.8, y + 12.23, 'roof');
  box(o, c, a + 4, b - 6, z + 3, w - 6, y + 12.23, y + 14.15, 'trim');
  if (c.detail && !c.near)
    for (const level of [2.3, 5.7, 9.0]) {
      q(
        o,
        c,
        [
          [a + 1, y + level, w + 0.04],
          [b - 1, y + level, w + 0.04],
          [b - 1, y + level + 1.91, w + 0.04],
          [a + 1, y + level + 1.91, w + 0.04],
        ],
        'glass',
        [0, 0, 1],
      );
      q(
        o,
        c,
        [
          [a + 1, y + level, z - 0.04],
          [b - 1, y + level, z - 0.04],
          [b - 1, y + level + 1.91, z - 0.04],
          [a + 1, y + level + 1.91, z - 0.04],
        ],
        'glass',
        [0, 0, -1],
      );
    }
  if (c.near)
    for (const level of [2.3, 5.7, 9.0]) {
      box(o, c, a - 0.09, b + 0.09, z - 0.1, w + 0.1, y + level - 0.7, y + level - 0.45, 'trim');
      for (let i = 0; i < 7; i++) {
        const x = a + 2 + i * 2.87;
        box(o, c, x, x + 1.8, w - 0.045, w + 0.04, y + level, y + level + 1.91, 'glass');
        box(o, c, x, x + 1.8, z - 0.04, z + 0.045, y + level, y + level + 1.91, 'glass');
      }
      for (const x of [a, b])
        for (let i = 0; i < 4; i++) {
          const j = z + 2 + i * 4.1;
          box(o, c, x - 0.045, x + 0.045, j, j + 2.2, y + level, y + level + 1.91, 'glass');
        }
    }
}

function navigation(o, c) {
  const P = frameOf(lock),
    w = lock.width / 2,
    y = lock.crest,
    base = lock.floor,
    L = lock.length;
  prism(o, c, P, -12, L + 12, -w - 4, w + 4, base - 0.75, base, 'wall');
  for (const sign of [-1, 1]) {
    const [a, b] = [sign * w, sign * (w + 4)].sort((x, y) => x - y);
    prism(o, c, P, -13, L + 13, a, b, base, y, 'wall');
    if (c.detail)
      rod(
        o,
        c,
        P(-10, sign * (w + 1.8), y + 0.86),
        P(L + 10, sign * (w + 1.8), y + 0.86),
        0.16,
        0.17,
        'steel',
      );
    for (const u of [0, L]) {
      prism(o, c, P, u - 3.4, u + 4, a - 0.4, b + 0.4, y, y + 5.5, 'trim');
      if (c.near)
        prism(o, c, P, u + 3.93, u + 4.14, a + 0.25, b - 0.25, y + 2.6, y + 4.25, 'glass');
      const k = u === 0 ? 1 : -1;
      q(
        o,
        c,
        [
          P(u, sign * w, base),
          P(u + 3.15 * k, 0, base),
          P(u + 3.15 * k, 0, y - 0.55),
          P(u, sign * w, y - 0.55),
        ],
        'gate',
        [lock.axis[0], 0, lock.axis[1]],
      );
      if (c.near)
        for (let h = base + 1.3; h < y - 0.55; h += 1.36)
          rod(o, c, P(u, sign * w, h), P(u + 3.15 * k, 0, h), 0.17, 0.19, 'steel');
      if (c.fine) {
        rod(o, c, P(u, sign * (w + 2.8), y + 0.7), P(u + 2, sign * w, y - 1), 0.28, 0.28, 'steel');
        prism(
          o,
          c,
          P,
          u - 1.7,
          u + 1.1,
          sign < 0 ? a + 0.1 : a + 0.3,
          sign < 0 ? b - 0.1 : b - 0.3,
          y,
          y + 1.1,
          'gate',
        );
      }
    }
  }
}

export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Farakka tier ' + level);
  approach(o, c);
  crestDeck(o, c);
  mainBarrage(o, c);
  regulator(o, c);
  controlHouse(o, c);
  navigation(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

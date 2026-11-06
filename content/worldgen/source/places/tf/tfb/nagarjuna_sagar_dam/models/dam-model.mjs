import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [79.31149984, 16.575274434],
  heading: 1.268828532914,
  datum: 160.121958,
  tailwater: -89.48600553125,
  foundation: -107.48600553125,
  crestY: 12.6,
  span: [-676.339, 676.339],
  gate: {
    min: -204,
    max: 266.9,
    count: 26,
    crestZ: 6.5,
    apronZ: 135,
  },
  facility: {
    outline: [
      [293.746, 140.40247],
      [483.54701, 140.62858],
      [483.47146, 167.3287],
      [293.67039, 167.10261],
      [293.746, 140.40247],
    ],
    min: 293.67039,
    max: 483.54701,
    near: 140.45,
    far: 167.27,
    grade: -73.30612152268111,
  },
  wings: [
    [
      {
        x: -676.339,
        z: 9,
        y: 17.57704829478513,
        w: 68,
        toe: -1.8613942537539172,
      },
      {
        x: -605,
        z: 5,
        y: 7.686195031148564,
        w: 82.98119000000001,
        toe: -7.137101501226016,
      },
      {
        x: -535,
        z: 5,
        y: 12.6,
        w: 97.68119000000002,
        toe: -16.937524779533636,
      },
      {
        x: -460,
        z: 7,
        y: 12.6,
        w: 113.43119000000002,
        toe: -49.857124559987994,
      },
      {
        x: -375,
        z: 7,
        y: 12.6,
        w: 119,
        toe: -72.29103421875001,
      },
      {
        x: -284,
        z: 8,
        y: 12.6,
        w: 119,
        toe: -70.989335671875,
      },
      {
        x: -220,
        z: 7,
        y: 12.6,
        w: 119,
        toe: -57.59829168750001,
      },
      {
        x: -204,
        z: 6.5,
        y: 12.6,
        w: 119,
        toe: -49.15950806250001,
      },
    ],
    [
      {
        x: 266.9,
        z: 6.5,
        y: 12.6,
        w: 139,
        toe: -77.54847048671876,
      },
      {
        x: 289,
        z: 4.1,
        y: 12.6,
        w: 139,
        toe: -75.10955795273435,
      },
      {
        x: 360,
        z: 3.7,
        y: 12.6,
        w: 139,
        toe: -75.10038780937494,
      },
      {
        x: 455,
        z: 3.2,
        y: 12.6,
        w: 123.26780000000002,
        toe: -70.85318825187967,
      },
      {
        x: 545,
        z: 2.8,
        y: 12.6,
        w: 105.26780000000001,
        toe: -52.95350604741323,
      },
      {
        x: 623,
        z: 2.5,
        y: 4.782538101898122,
        w: 89.66780000000001,
        toe: -16.749292532542984,
      },
      {
        x: 676.339,
        z: 2.4,
        y: 9.01030541411248,
        w: 79,
        toe: -4.4351842886820405,
      },
    ],
  ],
  scope:
    'Nagarjuna Sagar’s mapped masonry dam, 26 radial crest gates, flanking stair towers, high abutments and north-bank generating hall.',
};
const C = {
  wall: [0.31, 0.3, 0.29],
  stone: [0.29, 0.28, 0.26],
  trim: [0.6, 0.57, 0.49],
  dark: [0.19, 0.2, 0.2],
  gate: [0.24, 0.3, 0.33],
  road: [0.42, 0.41, 0.38],
  roof: [0.26, 0.25, 0.23],
  glass: [0.2, 0.29, 0.31],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  trim: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  road: { slot: 'foundation', graph: 'concrete_plain' },
  stone: { slot: 'foundation', graph: 'gravel' },
  gate: { slot: 'door', graph: 'metal_painted' },
  roof: { slot: 'roof', graph: 'metal_standing_seam' },
  glass: { slot: 'window', graph: 'window_grid' },
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
const { crestY, tailwater, foundation, gate, facility } = controls;
const q = (o, c, p, s, n) => Q(o, c, p, s, C[s], n);
const rod = (o, c, a, b, w, h, s = 'gate') => beam(adapter(o, c), s, a, b, w, h, C[s]);
const lerp = (a, b, f) => a + (b - a) * f;
function box(o, c, a, b, z, w, y, h, s) {
  const A = [a, h, z],
    B = [b, h, z],
    D = [a, h, w],
    E = [b, h, w],
    p = [a, y, z],
    r = [b, y, z],
    u = [a, y, w],
    v = [b, y, w];
  for (const [ps, n] of [
    [
      [A, B, E, D],
      [0, 1, 0],
    ],
    [
      [p, r, B, A],
      [0, 0, -1],
    ],
    [
      [u, v, E, D],
      [0, 0, 1],
    ],
    [
      [p, u, D, A],
      [-1, 0, 0],
    ],
    [
      [r, v, E, B],
      [1, 0, 0],
    ],
  ])
    q(o, c, ps, s, n);
  if (c.near) q(o, c, [p, u, v, r], s, [0, -1, 0]);
}
function wing(o, c, stations) {
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1],
      b = stations[i],
      P = (p, z, y) => [p.x, p.y + y, p.z + z];
    q(o, c, [P(a, -15, -32), P(b, -15, -32), P(b, -6, 0), P(a, -6, 0)], 'wall', [0, 1, -1]);
    q(o, c, [P(a, -6, 0), P(b, -6, 0), P(b, 7, 0), P(a, 7, 0)], 'road', [0, 1, 0]);
    const a1 = P(a, 13, -19),
      b1 = P(b, 13, -19),
      a2 = P(a, 37, -48),
      b2 = P(b, 37, -48);
    q(o, c, [P(a, 7, 0), P(b, 7, 0), b1, a1], 'wall', [0, 1, 1]);
    q(o, c, [a1, b1, b2, a2], 'stone', [0, 1, 1]);
    q(o, c, [a2, b2, [b.x, b.toe, b.z + b.w], [a.x, a.toe, a.z + a.w]], 'wall', [0, 1, 1]);
    q(
      o,
      c,
      [
        [a.x, a.toe, a.z + a.w],
        [b.x, b.toe, b.z + b.w],
        [b.x, foundation, b.z + b.w],
        [a.x, foundation, a.z + a.w],
      ],
      'stone',
      [0, 0, 1],
    );
    if (c.detail)
      for (const z of [-5.7, 6.6]) {
        rod(o, c, P(a, z, 0.6), P(b, z, 0.6), 0.17, 0.17, 'trim');
      }
    if (c.fine)
      for (let j = 1; j < 5; j++) {
        const f = j / 5,
          x = lerp(a.x, b.x, f),
          z = lerp(a.z, b.z, f) + 6.2,
          y = lerp(a.y, b.y, f);
        rod(o, c, [x, y, z], [x, y + 4.5, z], 0.16, 0.16, 'gate');
      }
  }
  for (const [p, side] of [
    [stations[0], -1],
    [stations.at(-1), 1],
  ]) {
    const profile = [
      [p.z - 15, p.y - 32],
      [p.z - 6, p.y],
      [p.z + 7, p.y],
      [p.z + 13, p.y - 19],
      [p.z + 37, p.y - 48],
      [p.z + p.w, p.toe],
    ];
    for (let i = 1; i < profile.length; i++) {
      const [a, y] = profile[i - 1],
        [b, h] = profile[i];
      q(
        o,
        c,
        [
          [p.x, y, a],
          [p.x, h, b],
          [p.x, foundation, b],
          [p.x, foundation, a],
        ],
        'wall',
        [side, 0, 0],
      );
    }
  }
}
function spillway(o, c) {
  const { min, max, count, crestZ: z, apronZ } = gate,
    step = (max - min) / count;
  box(o, c, min, max, z - 8, z + 7, crestY - 0.9, crestY, 'road');
  box(o, c, min, max, z - 16, z - 8, foundation, crestY - 1.1, 'wall');
  box(o, c, min, max, apronZ - 8, apronZ + 12, foundation, tailwater + 1.2, 'wall');
  const profile = c.detail
    ? [
        [z + 13, crestY - 20],
        [z + 33, crestY - 49],
        [z + 63, tailwater + 18],
        [apronZ - 30, tailwater + 4.2],
        [apronZ, tailwater + 1.2],
      ]
    : [
        [z + 13, crestY - 20],
        [z + 62, tailwater + 18],
        [apronZ, tailwater + 1.2],
      ];
  for (let i = 1; i < profile.length; i++) {
    const [a, y] = profile[i - 1],
      [b, h] = profile[i];
    for (const [x, side] of [
      [min, -1],
      [max, 1],
    ]) {
      const outer = x + side * 12.5;
      q(
        o,
        c,
        [
          [x, y, a],
          [x, h, b],
          [outer, h + 2, b],
          [outer, y + 2, a],
        ],
        'wall',
        [0, 1, 1],
      );
      q(
        o,
        c,
        [
          [outer, y + 2, a],
          [outer, h + 2, b],
          [outer, foundation, b],
          [outer, foundation, a],
        ],
        'stone',
        [side, 0, 0],
      );
    }
  }
  for (let i = 0; i <= count; i++) {
    const x = min + i * step;
    if (c.detail) box(o, c, x - 1.03, x + 1.03, z + 3, z + 17, crestY - 24, crestY + 0.45, 'trim');
    else
      q(
        o,
        c,
        [
          [x - 1, crestY - 24, z + 14],
          [x + 1, crestY - 24, z + 14],
          [x + 1, crestY + 0.35, z + 14],
          [x - 1, crestY + 0.35, z + 14],
        ],
        'trim',
        [0, 0, 1],
      );
    if (i === count) break;
    const a = x + 1.05,
      b = x + step - 1.05;
    for (let j = 1; j < profile.length; j++) {
      const [d, y] = profile[j - 1],
        [e, h] = profile[j];
      q(
        o,
        c,
        [
          [x, y, d],
          [x + step, y, d],
          [x + step, h, e],
          [x, h, e],
        ],
        'wall',
        [0, 1, 1],
      );
      if (c.fine)
        for (const f of [0.14, 0.57, 0.83]) {
          const u = lerp(a, b, f);
          q(
            o,
            c,
            [
              [u, y + 0.034, d],
              [u + 0.24, y + 0.034, d],
              [u + 0.22, h + 0.034, e],
              [u, h + 0.034, e],
            ],
            'stone',
            [0, 1, 1],
          );
        }
    }
    const edge = c.near
      ? [
          [z + 9, crestY - 0.75],
          [z + 11, crestY - 7],
          [z + 10, crestY - 14],
          [z + 7, crestY - 20],
        ]
      : [
          [z + 9, crestY - 1],
          [z + 8, crestY - 20],
        ];
    for (let j = 1; j < edge.length; j++) {
      const [d, y] = edge[j - 1],
        [e, h] = edge[j];
      q(
        o,
        c,
        [
          [a, y, d],
          [b, y, d],
          [b, h, e],
          [a, h, e],
        ],
        'gate',
        [0, 0, 1],
      );
    }
    if (c.detail) box(o, c, a, b, z + 3, z + 15, crestY - 3.2, crestY - 1.45, 'trim');
    if (c.fine)
      for (const f of [0.31, 0.69]) {
        const u = lerp(a, b, f);
        rod(o, c, [u, crestY - 16, z + 10], [u, crestY - 2, z + 12], 0.19, 0.19);
        if (c.master)
          box(o, c, u - 0.7, u + 0.7, z + 7, z + 12, crestY - 3.4, crestY - 1.3, 'gate');
      }
  }
  for (const x of [min - 13, max + 13]) {
    box(o, c, x - 2.5, x + 2.5, z + 10, z + 18, crestY - 37, crestY + 9.4, 'trim');
    if (c.detail)
      box(o, c, x - 0.72, x + 0.72, z + 17.9, z + 18.1, crestY - 25, crestY + 6.2, 'glass');
  }
  const side = max + 12.5,
    bank = facility.min + 2;
  const y = tailwater + 2;
  q(
    o,
    c,
    [
      [side, tailwater + 17, 69],
      [bank, tailwater + 23, 69],
      [bank, y + 1.8, 161],
      [side, y, 147],
    ],
    'stone',
    [0, 1, 1],
  );
  q(
    o,
    c,
    [
      [side, y, 147],
      [bank, y + 1.8, 161],
      [bank, foundation, 161],
      [side, foundation, 147],
    ],
    'wall',
    [0, 0, 1],
  );
}
function powerhouse(o, c) {
  const { min: a, max: b, near: z, far: w, grade: y } = facility,
    top = y + 15.2;
  box(o, c, a, b, z, w, y, top, 'trim');
  box(o, c, a - 2, b + 2, z - 2, w + 8, foundation, y, 'wall');
  if (c.detail) box(o, c, a - 0.42, b + 0.42, z - 0.42, w + 0.42, top, top + 0.58, 'roof');
  if (c.detail)
    for (let x = a + 4; x < b - 6; x += c.near ? 8.4 : 13) {
      box(o, c, x, x + 2.8, w - 0.05, w + 0.14, y + 5.4, y + 12, 'glass');
      if (c.fine) box(o, c, x - 1.6, x - 1.1, w - 0.12, w + 0.27, y + 3.5, top - 0.6, 'wall');
      if (c.master) rod(o, c, [x, top + 0.6, z + 1], [x, top + 0.6, w - 1], 0.13, 0.13);
    }
  const n = 12,
    step = (b - a) / n;
  for (let i = 0; i < n; i++) {
    const x = a + i * step;
    q(
      o,
      c,
      [
        [x + 0.85, tailwater + 1, w + 8.02],
        [x + step - 0.85, tailwater + 1, w + 8.02],
        [x + step - 0.85, y - 1.5, w + 8.02],
        [x + 0.85, y - 1.5, w + 8.02],
      ],
      'dark',
      [0, 0, 1],
    );
  }
}
export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Nagarjuna Sagar tier ' + level);
  for (const part of controls.wings) wing(o, c, part);
  spillway(o, c);
  powerhouse(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [48.46404478, 32.60523128],
  heading: -0.063561753723,
  arc: [
    [-102.95654, 0.00004],
    [-86.04028, -11.41008],
    [-61.59347, -23.29949],
    [-35.41686, -31.7705],
    [-6.14354, -35.14588],
    [22.30606, -31.6639],
    [50.9953, -24.41664],
    [76.84807, -14.21646],
    [102.95646, 0.00004],
  ],
  arch: [
    [0, 1, 0, 0, 4.5],
    [-14, 0.93, -1.2, 2.7, 5.1],
    [-34, 0.83, -3.4, 6.2, 6.2],
    [-62, 0.71, -6.4, 11.3, 7.7],
    [-91, 0.56, -10, 16.2, 10.3],
    [-123, 0.41, -12, 21.7, 13.7],
    [-153, 0.3, -11.5, 25.6, 17.4],
    [-180, 0.23, -10, 28.5, 19.7],
    [-203.5, 0.18, -8.5, 30.5, 21],
  ],
  crestDatum: 354,
  fullHeight: 203.5,
  terrainOffset: 23.241881999999976,
  referenceLocal: [0, -240],
  tunnel: {
    origin: [82, -82],
    tangent: [-0.38, -0.925],
    outward: [-0.925, 0.38],
    centers: [-4, 19],
    floor: -15.1,
    top: -3.6,
    width: 11.3,
    depth: 14.5,
  },
  canyon: [
    {
      z: -170,
      mid: -22,
      left: -151,
      right: 109,
      bottomWidth: 31,
      floor: -44,
      leftTop: 23.853480187500008,
      rightTop: 110.35644371874999,
    },
    {
      z: -116,
      mid: -16,
      left: -146,
      right: 129,
      bottomWidth: 28,
      floor: -48,
      leftTop: 35.93939024999999,
      rightTop: 122.78338318749998,
    },
    {
      z: -65,
      mid: -10,
      left: -141,
      right: 136,
      bottomWidth: 22,
      floor: -59,
      leftTop: 72.83758417187501,
      rightTop: 127.34203674999999,
    },
    {
      z: -35,
      mid: -7,
      left: -139,
      right: 138,
      bottomWidth: 16,
      floor: -155,
      leftTop: 73.70759742187495,
      rightTop: 125.1177356875,
    },
    {
      z: 2,
      mid: -6,
      left: -136,
      right: 139,
      bottomWidth: 14,
      floor: -177,
      leftTop: 70.81472974999998,
      rightTop: 124.35943765625002,
    },
    {
      z: 41,
      mid: -10,
      left: -130,
      right: 136,
      bottomWidth: 15,
      floor: -171,
      leftTop: 57.52367515624998,
      rightTop: 127.98176787500002,
    },
    {
      z: 82,
      mid: -19,
      left: -136,
      right: 134,
      bottomWidth: 16,
      floor: -165,
      leftTop: 53.48555075000003,
      rightTop: 130.67244362499997,
    },
    {
      z: 117,
      mid: -30,
      left: -143,
      right: 142,
      bottomWidth: 18,
      floor: -152,
      leftTop: 38.66048359374999,
      rightTop: 154.24250321874996,
    },
    {
      z: 155,
      mid: -39,
      left: -153,
      right: 151,
      bottomWidth: 22,
      floor: -109,
      leftTop: 22.21087499999994,
      rightTop: 159.62180229687505,
    },
    {
      z: 190,
      mid: -47,
      left: -161,
      right: 146,
      bottomWidth: 25,
      floor: -52,
      leftTop: 18.566729343750023,
      rightTop: 144.54115974999996,
    },
    {
      z: 229,
      mid: -57,
      left: -169,
      right: 141,
      bottomWidth: 28,
      floor: -29,
      leftTop: 19.610127109375025,
      rightTop: 141.59774784374997,
    },
  ],
  placementReferenceLocal: [-182, -44],
  placementContact: 133.02837949999997,
  reservoirFixtureY: -37,
  scope:
    'Dez Dam’s thin double-curvature concrete arch, two east-bank spillway tunnel mouths and ledge, west-bank intake gallery, irrigation outlet mouths and occupied canyon contacts.',
};
const C = {
  wall: [0.58, 0.54, 0.47],
  face: [0.51, 0.49, 0.44],
  joint: [0.36, 0.35, 0.32],
  road: [0.38, 0.36, 0.33],
  stone: [0.5, 0.45, 0.36],
  rockLight: [0.63, 0.57, 0.47],
  rockDark: [0.41, 0.37, 0.3],
  trim: [0.66, 0.6, 0.51],
  dark: [0.2, 0.19, 0.17],
  steel: [0.3, 0.34, 0.31],
  crane: [0.63, 0.44, 0.12],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  face: { slot: 'wall', graph: 'concrete_boardformed' },
  joint: { slot: 'wall', graph: 'concrete_boardformed' },
  road: { slot: 'foundation', graph: 'concrete_plain' },
  stone: { slot: 'foundation', graph: 'gravel' },
  rockLight: { slot: 'foundation', graph: 'gravel' },
  rockDark: { slot: 'foundation', graph: 'gravel' },
  trim: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  steel: { slot: 'door', graph: 'metal_painted' },
  crane: { slot: 'door', graph: 'metal_painted' },
};
const cfg = {
  skyline: { around: 8, vertical: 1 },
  district: { around: 28, vertical: 1, detail: true },
  street: { around: 42, vertical: 1, detail: true, near: true },
  closeup: { around: 64, vertical: 2, detail: true, near: true, fine: true },
  master: { around: 86, vertical: 3, detail: true, near: true, fine: true, master: true },
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
const { arc, arch, tunnel, canyon, fullHeight } = controls;
const q = (o, c, p, s, n) => Q(o, c, p, s, C[s], n);
const t = (o, c, p, s, n) => T(o, c, p, s, C[s], n);
const rod = (o, c, a, b, w, h, s = 'steel') => beam(adapter(o, c), s, a, b, w, h, C[s]);
const lerp = (a, b, f) => a + (b - a) * f;
const arcSlope = (i) => {
  const a = arc[Math.max(0, i - 1)],
    b = arc[Math.min(arc.length - 1, i + 1)];
  return (b[1] - a[1]) / (b[0] - a[0]);
};
function arcZ(x) {
  const k = arc.findIndex(([u]) => u > x),
    j = k > 0 ? k : arc.length - 1,
    a = arc[j - 1],
    b = arc[j],
    w = b[0] - a[0];
  const f = Math.max(0, Math.min(1, (x - a[0]) / w)),
    g = f * f,
    h = g * f;
  return (
    (2 * h - 3 * g + 1) * a[1] +
    (h - 2 * g + f) * w * arcSlope(j - 1) +
    (-2 * h + 3 * g) * b[1] +
    (h - g) * w * arcSlope(j)
  );
}
function section(y) {
  const k = arch.findIndex(([h]) => h < y),
    j = k > 0 ? k : arch.length - 1,
    a = arch[j - 1],
    b = arch[j],
    f = (y - a[0]) / (b[0] - a[0]);
  return a.slice(1).map((v, i) => lerp(v, b[i + 1], f));
}
function wall(x, y, down) {
  const [width, shift, bend, thickness] = section(y);
  const crestZ = arcZ(x),
    z = crestZ * (0.38 + 0.62 * width) + bend;
  return [x * width + shift, y, z + (down ? thickness : 0)];
}
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
function arcMesh(o, c) {
  const lo = arc[0][0],
    hi = arc.at(-1)[0];
  const points = [
    ...new Set([
      ...arc.map((p) => p[0]),
      ...Array.from({ length: c.around + 1 }, (_, i) => lerp(lo, hi, i / c.around)),
    ]),
  ].sort((a, b) => a - b);
  const levels = [
    0,
    ...arch
      .slice(1)
      .flatMap((p, i) =>
        Array.from({ length: c.vertical }, (_, j) => lerp(arch[i][0], p[0], (j + 1) / c.vertical)),
      ),
  ];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    for (let j = 1; j < levels.length; j++) {
      const y = levels[j - 1],
        h = levels[j];
      for (const down of [false, true]) {
        q(
          o,
          c,
          [wall(a, y, down), wall(b, y, down), wall(b, h, down), wall(a, h, down)],
          down ? 'face' : 'wall',
          [0, 0, down ? 1 : -1],
        );
      }
    }
    q(
      o,
      c,
      [wall(a, 0, false), wall(b, 0, false), wall(b, 0, true), wall(a, 0, true)],
      'road',
      [0, 1, 0],
    );
    if (c.detail)
      for (const down of [false, true]) {
        const p = wall(a, 0, down),
          r = wall(b, 0, down);
        const at = (v, h) => [v[0], h, v[2] + (down ? -0.13 : 0.13)];
        q(o, c, [at(p, 0), at(r, 0), at(r, 0.78), at(p, 0.78)], 'trim', [0, 0, down ? 1 : -1]);
      }
    if (c.near)
      for (const y of [-11.6, -32.5, -60.4, -87.4, -114.5, -145.2]) {
        const at = (x, h) => {
          const p = wall(x, h, true);
          p[2] += 0.085;
          return p;
        };
        q(
          o,
          c,
          [at(a, y + 0.23), at(b, y + 0.23), at(b, y - 0.23), at(a, y - 0.23)],
          'joint',
          [0, 0, 1],
        );
      }
    if (c.master && i % 4 === 0) {
      const x = lerp(a, b, 0.5);
      for (let j = 1; j < levels.length; j++) {
        const y = levels[j - 1],
          h = levels[j],
          at = (u, v) => {
            const p = wall(u, v, true);
            p[2] += 0.06;
            return p;
          };
        q(
          o,
          c,
          [at(x - 0.055, y), at(x + 0.055, y), at(x + 0.055, h), at(x - 0.055, h)],
          'joint',
          [0, 0, 1],
        );
      }
    }
  }
  for (const [x, side] of [
    [lo, -1],
    [hi, 1],
  ])
    for (let i = 1; i < levels.length; i++) {
      const y = levels[i - 1],
        h = levels[i];
      q(o, c, [wall(x, y, false), wall(x, y, true), wall(x, h, true), wall(x, h, false)], 'wall', [
        side,
        0,
        0,
      ]);
    }
  for (const [x, dx] of [
    [lo, -11],
    [hi, 11],
  ]) {
    const [a, b] = [x, x + dx].sort((u, v) => u - v);
    box(o, c, a, b, -2.6, 6.9, -7.8, 0, 'wall');
  }
  if (c.near)
    for (let x = lo + 12; x < hi; x += 18) {
      const p = wall(x, 0, true);
      const [a, , z] = p;
      rod(o, c, [a, 0, z - 0.42], [a, 4.1, z - 0.42], 0.13, 0.13);
      rod(o, c, [a, 4.1, z - 0.42], [a, 4.38, z - 1.55], 0.1, 0.1);
    }
}
function easternPortals(o, c) {
  const { origin, tangent, outward, centers, floor, top, width, depth } = tunnel;
  const P = (u, v, y) => [
    origin[0] + u * tangent[0] + v * outward[0],
    y,
    origin[1] + u * tangent[1] + v * outward[1],
  ];
  const n = [outward[0], 0, outward[1]],
    D = [tangent[0], 0, tangent[1]];
  const head = (a, b, y, h, s = 'trim') =>
    q(o, c, [P(a, 0, y), P(b, 0, y), P(b, 0, h), P(a, 0, h)], s, n);
  const deck = (a, b, u, v, y, s) =>
    q(o, c, [P(a, u, y), P(b, u, y), P(b, v, y), P(a, v, y)], s, [0, 1, 0]);
  const left = centers[0] - width / 2 - 5,
    right = centers.at(-1) + width / 2 + 5;
  deck(left, right, -1, 5.5, floor - 0.05, 'road');
  q(
    o,
    c,
    [
      P(left, 5.5, floor - 7.6),
      P(right, 5.5, floor - 7.6),
      P(right, 5.5, floor - 0.05),
      P(left, 5.5, floor - 0.05),
    ],
    'wall',
    n,
  );
  head(left, right, top, top + 3.2);
  deck(left, right, -depth, 0, top + 3.2, 'stone');
  let end = left;
  for (const u of centers) {
    const a = u - width / 2,
      b = u + width / 2;
    head(end, a, floor, top);
    for (const [x, side] of [
      [a, 1],
      [b, -1],
    ]) {
      q(
        o,
        c,
        [P(x, 0, floor), P(x, -depth, floor), P(x, -depth, top), P(x, 0, top)],
        'wall',
        D.map((v) => v * side),
      );
    }
    q(o, c, [P(a, 0, top), P(b, 0, top), P(b, -depth, top), P(a, -depth, top)], 'dark', [0, -1, 0]);
    q(
      o,
      c,
      [P(a, -depth, floor), P(b, -depth, floor), P(b, -depth, top), P(a, -depth, top)],
      'dark',
      n,
    );
    deck(a, b, -depth, 0, floor, 'wall');
    if (c.detail) {
      head(a + 0.28, b - 0.28, top - 1.4, top - 0.65, 'steel');
      rod(o, c, P(a, 2.8, floor + 2.2), P(b, 2.8, floor + 2.2), 0.17, 0.18);
    }
    if (c.near)
      for (const x of [a - 0.8, b + 0.8]) {
        rod(o, c, P(x, 1.4, floor), P(x, 1.4, top + 1.8), 0.45, 0.48);
        rod(o, c, P(x, 1.4, top + 1.8), P(x, 4.8, top + 1.8), 0.32, 0.38, 'crane');
      }
    if (c.master)
      for (const x of [a + 1.5, u, b - 1.5]) {
        rod(o, c, P(x, -1.2, floor + 0.75), P(x, -1.2, top - 1.25), 0.16, 0.18);
      }
    end = b;
  }
  head(end, right, floor, top);
  for (const [x, side] of [
    [left, -1],
    [right, 1],
  ]) {
    q(
      o,
      c,
      [P(x, -depth, floor), P(x, 0, floor), P(x, 0, top + 3.2), P(x, -depth, top + 3.2)],
      'stone',
      D.map((v) => v * side),
    );
  }
  if (c.fine) {
    rod(o, c, P(left, 4.95, floor + 0.92), P(right, 4.95, floor + 0.92), 0.12, 0.12);
    for (let x = left + 0.5; x < right; x += 2.8)
      rod(o, c, P(x, 4.95, floor), P(x, 4.95, floor + 0.94), 0.12, 0.12);
  }
  box(o, c, 93, 109, -44, 3, floor - 0.7, -1.2, 'wall');
}
function intake(o, c) {
  const stations = [
    [-111, -12, -0.35],
    [-106, -37, -3.9],
    [-91, -64, -8.7],
    [-75, -99, -12.5],
  ];
  for (let i = 1; i < stations.length; i++) {
    const [x, z, y] = stations[i - 1],
      [a, b, h] = stations[i];
    q(
      o,
      c,
      [
        [x - 3, y, z],
        [x + 3, y, z],
        [a + 3, h, b],
        [a - 3, h, b],
      ],
      'road',
      [0, 1, 0],
    );
    q(
      o,
      c,
      [
        [x + 3, y, z],
        [a + 3, h, b],
        [a + 3, h - 1.1, b],
        [x + 3, y - 1.1, z],
      ],
      'wall',
      [1, 0, 0],
    );
    if (c.detail) rod(o, c, [x + 2.8, y + 0.65, z], [a + 2.8, h + 0.65, b], 0.15, 0.16);
  }
  for (const [x, z, y] of stations.slice(1)) {
    box(o, c, x - 2.8, x + 2.6, z - 2.3, z + 2.3, y - 24, y - 0.8, 'wall');
    if (c.near)
      for (let a = z - 1.65; a <= z + 1.65; a += 0.55) {
        rod(o, c, [x + 2.7, y - 24, a], [x + 2.7, y - 3, a], 0.16, 0.17);
      }
  }
}
function irrigation(o, c) {
  if (!c.detail) return;
  for (const x of [-15, 0, 15]) {
    const p = wall(x, -131.3, true),
      n = c.fine ? 14 : 8,
      point = (i, r, z) => [
        p[0] + r * Math.cos((i * 2 * Math.PI) / n),
        p[1] + r * Math.sin((i * 2 * Math.PI) / n),
        p[2] + z,
      ];
    for (let i = 0; i < n; i++) {
      q(
        o,
        c,
        [
          point(i, 1.98, 0.08),
          point(i + 1, 1.98, 0.08),
          point(i + 1, 1.98, 2.15),
          point(i, 1.98, 2.15),
        ],
        'trim',
        [Math.cos((i * 2 * Math.PI) / n), Math.sin((i * 2 * Math.PI) / n), 0],
      );
      q(
        o,
        c,
        [
          point(i, 1.98, 2.15),
          point(i + 1, 1.98, 2.15),
          point(i + 1, 1.37, 2.15),
          point(i, 1.37, 2.15),
        ],
        'steel',
        [0, 0, 1],
      );
      q(
        o,
        c,
        [
          point(i, 1.37, 2.15),
          point(i + 1, 1.37, 2.15),
          point(i + 1, 1.37, 0.38),
          point(i, 1.37, 0.38),
        ],
        'wall',
        [-Math.cos((i * 2 * Math.PI) / n), -Math.sin((i * 2 * Math.PI) / n), 0],
      );
      t(
        o,
        c,
        [point(i, 1.37, 0.38), point(i + 1, 1.37, 0.38), [p[0], p[1], p[2] + 0.38]],
        'dark',
        [0, 0, 1],
      );
    }
  }
}
function canyonContact(o, c) {
  const profile = (p, side) => {
    const outside = side < 0 ? p.left : p.right,
      inner = p.mid + side * p.bottomWidth;
    const top = side < 0 ? p.leftTop : p.rightTop;
    if (side === 1 && p.z >= -116 && p.z <= -65) {
      return [
        [inner, p.floor],
        [lerp(inner, outside, 0.37), p.floor + 12],
        [91, -16.4],
        [99, 9],
        [113, top * 0.76],
        [outside + side * 2.8, top - 0.55],
      ];
    }
    if (side === -1 && p.z >= -116 && p.z <= -35) {
      const ledge = lerp(-79, -112, (p.z + 116) / 81);
      return [
        [inner, p.floor],
        [lerp(inner, outside, 0.38), p.floor + 15],
        [ledge - 1.1, -13.9],
        [ledge - 7.1, 10],
        [outside + 12, top * 0.83],
        [outside + side * 2.8, top - 0.55],
      ];
    }
    return [
      [inner, p.floor],
      [lerp(inner, outside, 0.17), p.floor + 22],
      [lerp(inner, outside, 0.36), p.floor + 62],
      [lerp(inner, outside, 0.61), lerp(p.floor, top, 0.68)],
      [lerp(inner, outside, 0.82), lerp(p.floor, top, 0.88)],
      [outside + side * 2.8, top - 0.55],
    ];
  };
  const blend = (a, b, f) => a.map((v, i) => lerp(v, b[i], f));
  const strata = ['stone', 'rockDark', 'stone', 'rockLight', 'rockDark'];
  const levels = (p, side) => {
    const v = profile(p, side);
    if (!c.fine) return v;
    return [
      v[0],
      ...v.slice(1).flatMap((b, i) => {
        const a = v[i],
          x = lerp(a[0], b[0], 0.47),
          y = lerp(a[1], b[1], 0.47);
        const seam = 1.5 + 1.05 * Math.sin(p.z * 0.068 + (i + 1) * 1.7);
        return [[x - side * seam, y - 0.4], [x + side * seam * 0.5, y + 1.25], b];
      }),
    ];
  };
  for (let i = 1; i < canyon.length; i++) {
    const a = canyon[i - 1],
      b = canyon[i];
    q(
      o,
      c,
      [
        [a.mid - a.bottomWidth, a.floor, a.z],
        [b.mid - b.bottomWidth, b.floor, b.z],
        [b.mid + b.bottomWidth, b.floor, b.z],
        [a.mid + a.bottomWidth, a.floor, a.z],
      ],
      'rockDark',
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      const v = levels(a, side),
        w = levels(b, side),
        segments = c.fine ? 3 : c.near ? 2 : 1;
      for (let j = 1; j < v.length; j++)
        for (let k = 0; k < segments; k++) {
          const f = k / segments,
            g = (k + 1) / segments;
          const P = (index, t) => {
            const [x, y] = blend(v[index], w[index], t),
              z = lerp(a.z, b.z, t);
            const shift =
              c.fine && index > 0 && index < v.length - 1
                ? Math.sin(t * Math.PI) * Math.sin(z * 0.087 + index * 3.1) * 1.35
                : 0;
            return [x + shift, y + shift * 0.23, z];
          };
          const material = c.fine
            ? j % 3 === 2
              ? 'rockDark'
              : strata[Math.floor((j - 1) / 3)]
            : strata[j - 1];
          q(o, c, [P(j - 1, f), P(j - 1, g), P(j, g), P(j, f)], material, [-side, 1, 0]);
        }
      const [ax, ay] = v.at(-1),
        [bx, by] = w.at(-1);
      q(
        o,
        c,
        [
          [ax, ay, a.z],
          [bx, by, b.z],
          [bx, -fullHeight, b.z],
          [ax, -fullHeight, a.z],
        ],
        'rockDark',
        [-side, 0, 0],
      );
    }
  }
  for (const [p, side] of [
    [canyon[0], -1],
    [canyon.at(-1), 1],
  ]) {
    const f = p.floor,
      lo = p.mid - p.bottomWidth,
      hi = p.mid + p.bottomWidth,
      z = p.z;
    q(
      o,
      c,
      [
        [lo, -fullHeight, z],
        [hi, -fullHeight, z],
        [hi, f, z],
        [lo, f, z],
      ],
      'rockDark',
      [0, 0, -side],
    );
    for (const bank of [-1, 1]) {
      const section = levels(p, bank);
      for (let i = 1; i < section.length; i++) {
        const [a, y] = section[i - 1],
          [b, h] = section[i];
        q(
          o,
          c,
          [
            [a, y, z],
            [b, h, z],
            [b, -fullHeight, z],
            [a, -fullHeight, z],
          ],
          'rockDark',
          [0, 0, -side],
        );
      }
    }
  }
}
export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Dez tier ' + level);
  canyonContact(o, c);
  arcMesh(o, c);
  easternPortals(o, c);
  intake(o, c);
  irrigation(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

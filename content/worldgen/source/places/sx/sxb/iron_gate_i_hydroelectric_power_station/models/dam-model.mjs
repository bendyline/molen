import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [22.529033389, 44.671508243],
  heading: 0.866739086239,
  datum: 58,
  tailwater: -18,
  foundation: -27,
  crestY: 10.6,
  span: [-519, 508],
  spillway: {
    bounds: [-238, 198],
    bays: 14,
  },
  powerhouses: [
    [-418, -238],
    [198, 416],
  ],
  locks: [
    {
      name: 'Serbian',
      center: -471,
      width: 34,
      upstream: -325,
      division: 10,
      downstream: 345,
    },
    {
      name: 'Romanian',
      center: 441,
      width: 34,
      upstream: -334,
      division: 13,
      downstream: 358,
    },
  ],
  road: [
    [-518.69268, 23.62932, 4.6886802599390665],
    [-481, 24.1, 10.6],
    [-414.19906, 24.31107, 10.6],
    [-18.33517, 15.45077, 10.6],
    [480.41501, 17.55166, 10.6],
    [507.82086, 17.67765, 10.6],
    [508.47503, 0.40756, 10.6],
    [508.2247, -20.55159, 8.846890403419447],
  ],
  guides: [
    {
      upper: true,
      width: 7.6,
      line: [
        [-455, -325],
        [-435, -366],
        [-409, -399],
        [-392, -455],
        [-390, -515],
        [-390, -895],
        [-384, -927],
      ],
    },
    {
      upper: false,
      width: 5.2,
      line: [
        [-452, 345],
        [-452, 388],
        [-449.7, 756],
        [-449, 888],
        [-446, 945],
      ],
    },
    {
      upper: true,
      width: 6.1,
      line: [
        [424, -334],
        [421, -356],
        [414, -354],
        [413, -286],
      ],
    },
    {
      upper: false,
      width: 4.7,
      line: [
        [425, 358],
        [420, 362],
        [424, 499],
        [424, 719],
        [426, 950],
        [424, 958],
      ],
    },
  ],
  scope:
    'Iron Gate I international crossing, central spillway, Serbian and Romanian turbine halls, observation tower, both two-stage navigation locks and their approach walls.',
  note: 'The PMTiles geometry and ordinary photos define the signed plan. Machinery, internal lock stages and engineering grades are visually interpreted.',
};
const C = {
  wall: [0.45, 0.43, 0.39],
  edge: [0.56, 0.54, 0.47],
  dark: [0.29, 0.29, 0.27],
  road: [0.28, 0.29, 0.29],
  metal: [0.24, 0.29, 0.28],
  yellow: [0.77, 0.54, 0.15],
  roof: [0.51, 0.51, 0.47],
  glass: [0.15, 0.23, 0.26],
};
export const damSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff' },
  wall: { slot: 'wall', graph: 'concrete_boardformed' },
  edge: { slot: 'wall', graph: 'concrete_boardformed' },
  dark: { slot: 'wall', graph: 'concrete_boardformed' },
  road: { slot: 'foundation', graph: 'concrete_plain' },
  metal: { slot: 'door', graph: 'metal_painted' },
  yellow: { slot: 'door', graph: 'metal_painted' },
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
const { crestY, tailwater, foundation } = controls;
const lerp = (a, b, t) => a + (b - a) * t;
const quad = (o, c, p, s, n) => Q(o, c, p, s, C[s], n);
const tri = (o, c, p, s, n) => T(o, c, p, s, C[s], n);
const rod = (o, c, a, b, w, h, s = 'metal') => beam(adapter(o, c), s, a, b, w, h, C[s]);
function box(o, c, x, u, y, v, z, w, s) {
  const A = [x, y, z],
    B = [u, y, z],
    C = [u, y, w],
    D = [x, y, w],
    a = [x, v, z],
    b = [u, v, z],
    d = [u, v, w],
    e = [x, v, w];
  for (const [p, n] of [
    [
      [a, b, d, e],
      [0, 1, 0],
    ],
    [
      [A, B, b, a],
      [0, 0, -1],
    ],
    [
      [D, C, d, e],
      [0, 0, 1],
    ],
    [
      [A, D, e, a],
      [-1, 0, 0],
    ],
    [
      [B, C, d, b],
      [1, 0, 0],
    ],
  ])
    quad(o, c, p, s, n);
  if (c.near) quad(o, c, [A, B, C, D], s, [0, -1, 0]);
}

function barrage(o, c) {
  const [start, end] = controls.spillway.bounds,
    n = controls.spillway.bays,
    spacing = (end - start) / n;
  const profile = c.detail
    ? [
        [-4, 22],
        [-6, 32],
        [-10, 46],
        [-15.9, 67],
        [-18, 79],
        [foundation, 87],
      ]
    : [
        [-4, 22],
        [-18, 79],
        [foundation, 87],
      ];
  const pier = (x) => {
    if (c.detail) {
      box(o, c, x - 1.6, x + 1.6, foundation, crestY + 0.3, -3, 37, 'edge');
      return;
    }
    for (const [u, n] of [
      [x - 1.6, -1],
      [x + 1.6, 1],
    ]) {
      quad(
        o,
        c,
        [
          [u, foundation, -3],
          [u, foundation, 37],
          [u, crestY + 0.3, 37],
          [u, crestY + 0.3, -3],
        ],
        'edge',
        [n, 0, 0],
      );
    }
    quad(
      o,
      c,
      [
        [x - 1.6, crestY + 0.3, -3],
        [x + 1.6, crestY + 0.3, -3],
        [x + 1.6, crestY + 0.3, 37],
        [x - 1.6, crestY + 0.3, 37],
      ],
      'edge',
      [0, 1, 0],
    );
  };
  box(o, c, start, end, foundation, -5, -2, 23, 'wall');
  for (let i = 0; i < n; i++) {
    const a = start + i * spacing,
      b = a + spacing;
    for (let j = 1; j < profile.length; j++) {
      const [y, z] = profile[j - 1],
        [h, w] = profile[j];
      quad(
        o,
        c,
        [
          [a, y, z],
          [b, y, z],
          [b, h, w],
          [a, h, w],
        ],
        'wall',
        [0, w - z, y - h],
      );
    }
    const e = a + 2.1,
      f = b - 2.1;
    quad(
      o,
      c,
      [
        [e, -4, 17.4],
        [f, -4, 17.4],
        [f, 2.3, 13.2],
        [e, 2.3, 13.2],
      ],
      'metal',
      [0, 0, 1],
    );
    quad(
      o,
      c,
      [
        [e, 2.3, 13.2],
        [f, 2.3, 13.2],
        [f, 7.4, 14.5],
        [e, 7.4, 14.5],
      ],
      'metal',
      [0, 0, 1],
    );
    pier(a);
    if (c.detail)
      for (const y of [-2.7, 0.8, 4.7]) {
        const z = y < 2.3 ? lerp(17.4, 13.2, (y + 4) / 6.3) : lerp(13.2, 14.5, (y - 2.3) / 5.1);
        rod(o, c, [e, y, z + 0.16], [f, y, z + 0.16], 0.28, 0.18);
      }
    if (c.near) rod(o, c, [a, crestY + 1.7, 3], [a, crestY + 1.7, 25], 0.27, 0.21);
  }
  pier(end);
}

function roadDeck(o, c) {
  const points = controls.road;
  const normals = points.slice(1).map(([x, z], i) => {
    const [a, b] = points[i],
      d = Math.hypot(x - a, z - b);
    return [-(z - b) / d, (x - a) / d];
  });
  const joints = points.map((_, i) => {
    const a = normals[Math.max(0, i - 1)],
      b = normals[Math.min(normals.length - 1, i)];
    const scale = 1 + a[0] * b[0] + a[1] * b[1];
    return [(a[0] + b[0]) / scale, (a[1] + b[1]) / scale];
  });
  const at = (i, offset, dy = 0) => {
    const [x, z, y] = points[i],
      [u, v] = joints[i];
    return [x + u * offset, y + dy, z + v * offset];
  };
  for (let i = 1; i < points.length; i++) {
    const [x, z, y] = points[i - 1],
      [u, v, h] = points[i];
    quad(o, c, [at(i - 1, -5.5), at(i, -5.5), at(i, 5.5), at(i - 1, 5.5)], 'road', [0, 1, 0]);
    for (const [w, sign] of [
      [-5.5, -1],
      [5.5, 1],
    ]) {
      const [nx, nz] = normals[i - 1];
      quad(o, c, [at(i - 1, w), at(i, w), at(i, w, -2.1), at(i - 1, w, -2.1)], 'edge', [
        nx * sign,
        0,
        nz * sign,
      ]);
      if (c.detail) rod(o, c, at(i - 1, w, 0.95), at(i, w, 0.95), 0.16, 0.14);
    }
    if (c.detail) {
      const n = Math.max(1, Math.ceil(Math.hypot(u - x, v - z) / (c.fine ? 16 : 35)));
      for (let j = 0; j < n; j++) {
        const t = (j + 0.15) / n,
          a = lerp(x, u, t),
          b = lerp(y, h, t),
          d = lerp(z, v, t);
        for (const w of [-5.5, 5.5]) {
          const p = at(i - 1, w),
            q = at(i, w),
            s = p.map((v, k) => lerp(v, q[k], t));
          rod(o, c, s, [s[0], s[1] + 1, s[2]], 0.12, 0.12);
        }
        if (c.fine && j % 2 === 0)
          rod(o, c, [a, b + 0.021, d], [lerp(x, u, t + 0.11 / n), b + 0.021, d], 0.1, 0.04, 'edge');
      }
    }
  }
}

function hall(o, c, index) {
  const [x, u] = controls.powerhouses[index],
    end = index === 0 ? 106 : 104,
    roof = index === 0 ? 15.1 : 13.6;
  box(o, c, x, u, foundation, 9.3, -5, end - 0.2, 'wall');
  box(o, c, x + 1, u - 1, 5, roof, 23, end, 'wall');
  box(o, c, x, u, roof, roof + 0.55, 22.5, end + 1, 'roof');
  box(o, c, x, u, tailwater - 1, tailwater + 4.2, end, end + 4.8, 'edge');
  if (!c.detail) return;
  for (let a = x + 4; a < u - 3; a += c.near ? 5.1 : 10.2) {
    box(o, c, a, a + 1.12, tailwater + 2, roof + 0.2, end - 0.24, end + 1.23, 'edge');
    if (c.near && a + 3.9 < u - 1)
      quad(
        o,
        c,
        [
          [a + 1.26, roof - 5, end + 0.08],
          [a + 3.9, roof - 5, end + 0.08],
          [a + 3.9, roof - 1.7, end + 0.08],
          [a + 1.26, roof - 1.7, end + 0.08],
        ],
        'glass',
        [0, 0, 1],
      );
  }
  for (let a = x + 15; a < u - 12; a += 34)
    box(o, c, a - 4.1, a + 4.1, tailwater + 2.5, tailwater + 6, end + 3.5, end + 6.5, 'dark');
  if (c.master)
    for (let a = x + 14; a < u - 10; a += 18) {
      box(o, c, a - 2.9, a + 2.9, roof + 0.55, roof + 1.6, end - 12, end - 7.7, 'metal');
      for (const h of [0.78, 1.02, 1.24])
        rod(
          o,
          c,
          [a - 2.75, roof + h, end - 7.65],
          [a + 2.75, roof + h, end - 7.65],
          0.055,
          0.07,
          'edge',
        );
    }
}

function landings(o, c) {
  box(o, c, -450.15, -417.8, foundation, 7.5, -5, 70, 'wall');
  box(o, c, -450.15, -417.8, foundation, 5.8, 70, 106, 'edge');
  box(o, c, 415.8, 420, foundation, 7.3, -5, 104, 'wall');
  box(o, c, -519, -492.2, foundation, 4.5, 17, 30, 'wall');
  box(o, c, 462.2, 508, foundation, 7.7, 12, 24, 'wall');
  if (c.detail)
    for (const [a, b, z, y] of [
      [-449, -419, 101, 5.8],
      [416, 420, 100, 7.3],
    ]) {
      rod(o, c, [a, y + 1.05, z], [b, y + 1.05, z], 0.11, 0.1);
      for (let x = a + 1; x < b; x += c.fine ? 3.8 : 7.4)
        rod(o, c, [x, y, z], [x, y + 1.08, z], 0.12, 0.12);
    }
}

function miter(o, c, x, z, width, top) {
  const a = x - width / 2,
    b = x + width / 2,
    tip = z + 4.6,
    low = foundation + 0.8;
  for (const [l, p, r, q] of [
    [a, z, x, tip],
    [x, tip, b, z],
  ]) {
    quad(
      o,
      c,
      [
        [l, low, p],
        [r, low, q],
        [r, top, q],
        [l, top, p],
      ],
      'metal',
      [0, 0, 1],
    );
    if (c.detail)
      quad(
        o,
        c,
        [
          [r, low, q - 0.55],
          [l, low, p - 0.55],
          [l, top, p - 0.55],
          [r, top, q - 0.55],
        ],
        'metal',
        [0, 0, -1],
      );
    quad(
      o,
      c,
      [
        [l, top, p],
        [r, top, q],
        [r, top, q - 0.55],
        [l, top, p - 0.55],
      ],
      'metal',
      [0, 1, 0],
    );
    if (c.near)
      for (const y of [top - 1, top - 4.5, top - 8])
        rod(o, c, [l, y, p + 0.16], [r, y, q + 0.16], 0.17, 0.22);
  }
}
function lock(o, c, lock) {
  const { center: x, width, upstream: z, division: d, downstream: w } = lock,
    l = x - width / 2,
    r = x + width / 2;
  for (const [a, b, h] of [
    [z, d, 7.9],
    [d, w, 4.1],
  ]) {
    box(o, c, l - 4.2, l, foundation, h, a, b, 'wall');
    box(o, c, r, r + 4.2, foundation, h, a, b, 'wall');
    quad(
      o,
      c,
      [
        [l, foundation + 0.1, a],
        [r, foundation + 0.1, a],
        [r, foundation + 0.1, b],
        [l, foundation + 0.1, b],
      ],
      'dark',
      [0, 1, 0],
    );
    if (c.detail)
      for (const u of [l - 3.25, r + 3.25])
        rod(o, c, [u, h + 1.03, a], [u, h + 1.03, b], 0.14, 0.14);
    if (c.near)
      for (let p = a + 12; p < b - 7; p += c.fine ? 21 : 41) {
        for (const u of [l - 3.25, r + 3.25]) rod(o, c, [u, h, p], [u, h + 1.05, p], 0.1, 0.11);
        if (c.fine)
          for (const [u, n] of [
            [l, 1],
            [r, -1],
          ]) {
            quad(
              o,
              c,
              [
                [u + 0.11 * n, h - 1.2, p],
                [u + 0.11 * n, h - 1.2, p + 0.38],
                [u + 0.11 * n, tailwater - 1, p + 0.38],
                [u + 0.11 * n, tailwater - 1, p],
              ],
              'dark',
              [n, 0, 0],
            );
          }
      }
  }
  for (const [a, top] of [
    [z + 8, 7.4],
    [d, 7.4],
    [w - 7, 3.7],
  ]) {
    miter(o, c, x, a, width, top);
    for (const u of [l - 4.5, r + 0.35])
      box(o, c, u, u + 4.15, top - 1.8, top + 1.6, a - 2.3, a + 2.45, 'edge');
  }
}

function guideWalls(o, c) {
  for (const { upper, width, line } of controls.guides) {
    const y = upper ? 1.8 : tailwater + 2.9,
      low = upper ? -10 : foundation,
      half = width / 2;
    const route = c.detail ? line : line.filter((_, i) => i % 2 === 0 || i === line.length - 1);
    for (let i = 1; i < route.length; i++) {
      const [x, z] = route[i - 1],
        [u, v] = route[i],
        f = i === route.length - 1 ? 0.72 : 1;
      quad(
        o,
        c,
        [
          [x - half, y, z],
          [u - half * f, y, v],
          [u + half * f, y, v],
          [x + half, y, z],
        ],
        'edge',
        [0, 1, 0],
      );
      for (const s of [-1, 1]) {
        quad(
          o,
          c,
          [
            [x + s * half, low, z],
            [u + s * half * f, low, v],
            [u + s * half * f, y, v],
            [x + s * half, y, z],
          ],
          'wall',
          [s, 0, 0],
        );
      }
      if (i === route.length - 1)
        quad(
          o,
          c,
          [
            [u - half * f, low, v],
            [u + half * f, low, v],
            [u + half * f, y, v],
            [u - half * f, y, v],
          ],
          'wall',
          [0, 0, upper ? -1 : 1],
        );
    }
  }
}

function towers(o, c) {
  box(o, c, -420, -409, 2, 38, -6, 5, 'edge');
  box(o, c, -424, -405, 36.8, 43.3, -10, 10, 'edge');
  if (c.detail) {
    box(o, c, -425, -404, 38.4, 41.7, -10.17, -10.02, 'glass');
    box(o, c, -425, -404, 38.4, 41.7, 10.02, 10.17, 'glass');
  }
  for (const [x, z, h] of [
    [-387, 30, 13],
    [-205, 9, 9],
    [173, 10, 10],
    [371, 27, 14],
  ]) {
    for (const u of [x - 6.7, x + 6.7])
      for (const v of [z - 4, z + 4]) {
        rod(o, c, [u, crestY, v], [lerp(u, x, 0.1), crestY + h, v], 1.16, 1.18, 'yellow');
      }
    box(o, c, x - 8, x + 8, crestY + h - 0.6, crestY + h + 1.8, z - 5.3, z + 5.3, 'yellow');
    if (c.fine) box(o, c, x - 2, x + 2, crestY + h + 1.8, crestY + h + 3.1, z - 2, z + 2, 'yellow');
  }
}
export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Iron Gate I tier ' + level);
  barrage(o, c);
  roadDeck(o, c);
  hall(o, c, 0);
  hall(o, c, 1);
  landings(o, c);
  for (const l of controls.locks) lock(o, c, l);
  guideWalls(o, c);
  towers(o, c);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

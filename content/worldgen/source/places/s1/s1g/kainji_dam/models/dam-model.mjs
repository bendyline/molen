import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
export const controls = {
  anchor: [4.606956596, 9.859472954],
  heading: 0.584587905952,
  datum: 139,
  crestY: 5.6,
  tailwater: -30.57777546875002,
  tailwaterReferenceLocal: [830, 485],
  foundation: -42.57777546875002,
  earth: [
    [
      {
        x: -1718.85,
        z: -183.99,
        w: 27,
        y: 6.057849908701172,
        up: 4.964184992880826,
        down: 5.057849908701172,
      },
      {
        x: -1530,
        z: -80,
        w: 34,
        y: 5.6,
        up: 3.3361481875000094,
        down: 1.9811793281250174,
      },
      {
        x: -1320,
        z: 22,
        w: 41,
        y: 5.6,
        up: 2.0343549999999992,
        down: 1.552864312499986,
      },
      {
        x: -1120,
        z: 110,
        w: 38,
        y: 5.6,
        up: 0.6819693750000169,
        down: 1.0635152500000173,
      },
      {
        x: -915,
        z: 153,
        w: 40,
        y: 5.6,
        up: -0.11295171875000287,
        down: -1.492213421874999,
      },
      {
        x: -735,
        z: 129,
        w: 36,
        y: 5.6,
        up: 0.8418896210937645,
        down: 0.41669598437499067,
      },
      {
        x: -529,
        z: 77,
        w: 43,
        y: 5.6,
        up: -3.1588288554687325,
        down: -4.2087968749999956,
      },
      {
        x: -255,
        z: -3,
        w: 50,
        y: 5.6,
        up: -2.5617575156249814,
        down: -10.941957730468749,
      },
      {
        x: 21,
        z: -86,
        w: 54,
        y: 5.6,
        up: -6.285901281249982,
        down: -12.323364750000001,
      },
      {
        x: 154,
        z: -115,
        w: 53,
        y: 5.6,
        up: -5.03095390625001,
        down: -15.76498131249999,
      },
      {
        x: 321,
        z: -132,
        w: 67,
        y: 5.6,
        up: -3.914253531249989,
        down: -17.51084731640625,
      },
      {
        x: 548.664,
        z: -142,
        w: 58,
        y: 5.6,
        up: -8.631565904624983,
        down: -18.960213129999993,
      },
    ],
    [
      {
        x: 1126,
        z: -151,
        w: 66,
        y: 5.6,
        up: -11.249148507812498,
        down: -24.899794828125003,
      },
      {
        x: 1240,
        z: -154,
        w: 61,
        y: 5.6,
        up: -6.211634250000008,
        down: -15.40835593750001,
      },
      {
        x: 1385,
        z: -159,
        w: 58,
        y: 5.6,
        up: -1.8374894257812344,
        down: -14.329901066406242,
      },
      {
        x: 1512,
        z: -162,
        w: 45,
        y: 5.6,
        up: -5.519708124999999,
        down: -6.505575687500004,
      },
      {
        x: 1619,
        z: -168,
        w: 39,
        y: 4.260737278993052,
        up: -1.5303998281249904,
        down: -6.117948996093764,
      },
      {
        x: 1718.85,
        z: -180,
        w: 28,
        y: 1.9978177031250084,
        up: 0.9978177031250084,
        down: -0.9682533015625041,
      },
    ],
  ],
  wall: {
    span: [548.664, 1126.173],
    z: -151.5,
  },
  spillway: {
    span: [953.4, 1024.9],
    count: 4,
    crestZ: -152.3,
    apronZ: -49.6,
  },
  plant: {
    min: 617.32869,
    max: 851.96155,
    near: -105.9,
    far: -67.25,
    outline: [
      [617.32869, -101.25715],
      [851.96155, -106.13632],
      [851.9226, -69.82938],
      [831.04168, -68.12644],
      [757.36306, -69.26231],
      [711.60033, -66.74025],
      [618.10138, -66.17671],
      [617.32869, -101.25715],
    ],
    grade: -26.18841102734376,
  },
  locks: [
    {
      name: 'Upper navigation lock',
      from: [1734.6, -166],
      to: [1698.6, -58],
      width: 11.9,
      upper: 0,
      lower: -15.2,
      top: 4.2,
      length: 113.84199576606166,
      axis: [-0.31622776601683794, 0.9486832980505138],
      side: [0.9486832980505138, 0.31622776601683794],
      bottom: -22.7,
    },
    {
      name: 'Lower navigation lock',
      from: [1028, 847],
      to: [947, 923],
      width: 11.9,
      upper: -15.2,
      lower: -30.57777546875002,
      top: -9.1,
      length: 111.07204868912791,
      axis: [-0.7292563786835827, 0.6842405528389172],
      side: [0.6842405528389172, 0.7292563786835827],
      bottom: -38.07777546875002,
    },
  ],
  scope:
    'Kainji Dam’s mapped rock-fill embankments, four radial spillway bays, generating hall and tailrace, and the two navigation locks on the bypass canal.',
};
const C = {
  wall: [0.53, 0.49, 0.4],
  trim: [0.68, 0.64, 0.54],
  road: [0.42, 0.42, 0.38],
  stone: [0.43, 0.42, 0.32],
  earth: [0.34, 0.39, 0.25],
  dark: [0.21, 0.23, 0.2],
  gate: [0.28, 0.35, 0.34],
  glass: [0.19, 0.31, 0.34],
  roof: [0.34, 0.37, 0.35],
  paint: [0.61, 0.47, 0.17],
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
const { crestY, tailwater, foundation, earth, wall, spillway, plant, locks } = controls;
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
function earthwork(o, c, rows) {
  const at = (p, z, y) => [p.x, p[y], p.z + z];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i];
    q(
      o,
      c,
      [at(a, -22, 'up'), at(b, -22, 'up'), at(b, -5, 'y'), at(a, -5, 'y')],
      'stone',
      [0, 1, -1],
    );
    q(o, c, [at(a, -5, 'y'), at(b, -5, 'y'), at(b, 5, 'y'), at(a, 5, 'y')], 'road', [0, 1, 0]);
    q(
      o,
      c,
      [at(a, 5, 'y'), at(b, 5, 'y'), [b.x, b.down, b.z + b.w], [a.x, a.down, a.z + a.w]],
      'earth',
      [0, 1, 1],
    );
    q(
      o,
      c,
      [
        [a.x, a.down, a.z + a.w],
        [b.x, b.down, b.z + b.w],
        [b.x, foundation, b.z + b.w],
        [a.x, foundation, a.z + a.w],
      ],
      'earth',
      [0, 0, 1],
    );
    if (c.detail)
      for (const z of [-4.7, 4.7])
        rod(o, c, [a.x, a.y + 0.43, a.z + z], [b.x, b.y + 0.43, b.z + z], 0.14, 0.15, 'trim');
    if (c.fine) {
      const segments = Math.max(1, Math.ceil((b.x - a.x) / 31));
      for (let j = 0; j < segments; j++) {
        const t = j / segments,
          x = lerp(a.x, b.x, t),
          y = lerp(a.y, b.y, t),
          z = lerp(a.z, b.z, t) + 4.65;
        rod(o, c, [x, y, z], [x, y + 4, z], 0.14, 0.14);
        rod(o, c, [x, y + 4, z], [x, y + 4.3, z - 1.3], 0.12, 0.12);
      }
    }
  }
  for (const [p, side] of [
    [rows[0], -1],
    [rows.at(-1), 1],
  ]) {
    q(
      o,
      c,
      [
        [p.x, p.y, p.z + 5],
        [p.x, p.down, p.z + p.w],
        [p.x, foundation, p.z + p.w],
        [p.x, foundation, p.z + 5],
      ],
      'wall',
      [side, 0, 0],
    );
  }
}
function concrete(o, c) {
  const {
    span: [min, max],
    z,
  } = wall;
  box(o, c, min, max, z - 6, z + 6, crestY - 0.8, crestY, 'road');
  box(o, c, min, max, z - 14, z - 6, foundation, crestY - 0.8, 'wall');
  for (const [a, b, edge] of [
    [min, plant.min, -79],
    [plant.min, plant.max, -108],
    [plant.max, spillway.span[0], -74],
    [spillway.span[1], max, -83],
  ]) {
    q(
      o,
      c,
      [
        [a, crestY - 0.6, z + 6],
        [b, crestY - 0.6, z + 6],
        [b, tailwater + 1.1, edge],
        [a, tailwater + 1.1, edge],
      ],
      'wall',
      [0, 1, 1],
    );
    box(o, c, a, b, edge - 2.1, edge + 1.2, foundation, tailwater + 1.1, 'wall');
    if (c.fine) {
      const n = Math.ceil((b - a) / 17);
      for (let i = 1; i < n; i++) {
        const x = a + ((b - a) * i) / n;
        q(
          o,
          c,
          [
            [x, crestY - 0.6, z + 6.03],
            [x + 0.18, crestY - 0.6, z + 6.03],
            [x + 0.18, tailwater + 1.14, edge + 0.04],
            [x, tailwater + 1.14, edge + 0.04],
          ],
          'trim',
          [0, 1, 1],
        );
      }
    }
  }
  if (c.detail)
    for (const d of [-5.65, 5.75])
      rod(o, c, [min, crestY + 0.72, z + d], [max, crestY + 0.72, z + d], 0.15, 0.18, 'trim');
}
function gatedSpillway(o, c) {
  const {
      span: [a, b],
      count,
      crestZ: z,
      apronZ: w,
    } = spillway,
    step = (b - a) / count;
  const profile = [
    [z + 10, crestY - 8.5],
    [z + 22, crestY - 17],
    [z + 40, tailwater + 5],
    [w, tailwater + 0.65],
  ];
  box(o, c, a, b, w - 8, w + 4, foundation, tailwater + 0.65, 'wall');
  for (let i = 0; i <= count; i++) {
    const x = a + i * step;
    box(o, c, x - 1.24, x + 1.24, z + 6, z + 29, tailwater + 1.5, crestY + 0.38, 'trim');
    q(
      o,
      c,
      [
        [x - 1.24, crestY - 10.5, z + 29],
        [x + 1.24, crestY - 10.5, z + 29],
        [x + 1.24, tailwater + 0.7, w],
        [x - 1.24, tailwater + 0.7, w],
      ],
      'trim',
      [0, 1, 1],
    );
    if (i === count) break;
    const u = x + 1.28,
      v = x + step - 1.28;
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
    const folds = c.near
      ? [
          [z + 9, crestY - 1.3],
          [z + 13, crestY - 5.8],
          [z + 11, crestY - 10.9],
          [z + 8, crestY - 15.1],
        ]
      : [
          [z + 9, crestY - 1.3],
          [z + 8, crestY - 15.1],
        ];
    for (let j = 1; j < folds.length; j++) {
      const [p, y] = folds[j - 1],
        [r, h] = folds[j];
      q(
        o,
        c,
        [
          [u, y, p],
          [v, y, p],
          [v, h, r],
          [u, h, r],
        ],
        'gate',
        [0, 0, 1],
      );
    }
    if (c.detail) {
      const f = crestY - 5.8,
        low = crestY - 13.6;
      for (const [x, y] of [
        [u, v],
        [v, u],
      ]) {
        rod(o, c, [x, f, z + 12.8], [y, low, z + 15.1], 0.26, 0.28);
      }
      rod(o, c, [u, low, z + 15.1], [v, low, z + 15.1], 0.24, 0.25);
    }
    if (c.fine)
      for (let j = 1; j < 7; j++) {
        const x = lerp(u, v, j / 7);
        rod(o, c, [x, crestY - 2, z + 9.7], [x, crestY - 14.6, z + 9.8], 0.11, 0.12);
        if (c.master) rod(o, c, [x, crestY - 6, z + 13], [x, crestY - 12.8, z + 15], 0.1, 0.1);
      }
  }
  for (const [x, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    const y = x + sign * 8;
    q(
      o,
      c,
      [
        [x, crestY - 3, z + 23],
        [y, crestY - 3, z + 23],
        [y, tailwater + 5, w + 25],
        [x, tailwater + 5, w + 25],
      ],
      'trim',
      [0, 1, 1],
    );
    q(
      o,
      c,
      [
        [x, crestY - 3, z + 23],
        [x, tailwater + 5, w + 25],
        [x, foundation, w + 25],
        [x, foundation, z + 23],
      ],
      'wall',
      [-sign, 0, 0],
    );
  }
  for (let i = 0; i < count; i++) {
    const x = a + i * step;
    box(
      o,
      c,
      x + 2.7,
      x + step - 2.7,
      w - 3.25,
      w + 0.85,
      tailwater + 0.63,
      tailwater + 1.26,
      'wall',
    );
  }
}
function generatingHall(o, c) {
  const { min: a, max: b, near: z, far: w, grade: y } = plant,
    top = y + 20.2,
    apronY = tailwater + 4.3;
  box(o, c, a, b, z, w, y, top, 'wall');
  box(o, c, a, b, w - 2, w + 7, apronY, apronY + 1.05, 'trim');
  if (c.detail) box(o, c, a - 0.45, b + 0.45, z - 0.45, w + 0.45, top, top + 0.55, 'roof');
  const count = 10,
    step = (b - a) / count;
  for (let i = 0; i <= count; i++) {
    const x = a + i * step;
    box(o, c, x - 1.16, x + 1.16, z + 4, w + 7, foundation, apronY, 'wall');
    if (i === count) break;
    box(o, c, x + 1.16, x + step - 1.16, w - 9, w - 7, foundation, apronY, 'dark');
    if (c.detail) box(o, c, x + 1.8, x + step - 2.1, w - 0.1, w + 0.13, y + 6.6, y + 16.4, 'glass');
    if (c.near) box(o, c, x - 0.47, x + 0.47, w - 0.3, w + 0.25, y, top, 'trim');
    if (c.master)
      rod(o, c, [x + 1.1, top + 0.64, z + 0.5], [x + 1.1, top + 0.64, w - 0.7], 0.13, 0.13);
  }
  if (c.detail) box(o, c, b - 0.08, b + 0.14, z + 1, w - 1, y + 3.4, top - 0.35, 'glass');
  if (c.fine) {
    for (let z0 = z + 3; z0 < w - 1; z0 += 3.3)
      rod(o, c, [b + 0.13, y + 3.4, z0], [b + 0.13, top - 0.35, z0], 0.16, 0.16);
    rod(o, c, [a, apronY + 1.95, w + 6.1], [b, apronY + 1.95, w + 6.1], 0.15, 0.15);
  }
  box(o, c, b, b + 4, w - 1, w + 96, foundation, apronY + 0.1, 'wall');
}
function navigation(o, c, l) {
  const { from, axis, side, length, width, bottom, top, upper, lower } = l,
    w = width / 2;
  const P = (x, z, y) => [
    from[0] + side[0] * x + axis[0] * z,
    y,
    from[1] + side[1] * x + axis[1] * z,
  ];
  prism(o, c, P, -w - 2.4, w + 2.4, 0, length, bottom - 0.75, bottom, 'wall');
  for (const sign of [-1, 1]) {
    const [a, b] = [sign * w, sign * (w + 2.45)].sort((x, y) => x - y);
    prism(o, c, P, a, b, -2.5, length + 2.8, bottom, top, 'wall');
    if (c.detail)
      rod(
        o,
        c,
        P(sign * (w + 1.72), 0, top + 0.72),
        P(sign * (w + 1.72), length, top + 0.72),
        0.14,
        0.15,
      );
    if (c.near)
      for (let z = 7; z < length - 3; z += 8) {
        rod(o, c, P(sign * (w + 1.72), z, top), P(sign * (w + 1.72), z, top + 0.72), 0.11, 0.11);
      }
  }
  for (const [s, y] of [
    [7, upper],
    [length - 6, lower],
  ]) {
    for (const k of [-1, 1]) {
      q(
        o,
        c,
        [
          P(k * w, s, bottom),
          P(0, s + 1.65, bottom),
          P(0, s + 1.65, y + 1.05),
          P(k * w, s, y + 1.05),
        ],
        'gate',
        [axis[0], 0, axis[1]],
      );
      if (c.detail)
        for (let h = bottom + 1.25; h < y; h += 2.6)
          rod(o, c, P(k * w, s, h), P(0, s + 1.65, h), 0.18, 0.19);
      if (c.fine) rod(o, c, P(k * w, s, y + 0.55), P(0, s + 1.65, bottom + 0.55), 0.18, 0.19);
    }
    prism(o, c, P, -w - 2.45, -w - 0.15, s - 2.15, s + 2.15, top, top + 3.4, 'trim');
    if (c.near)
      prism(o, c, P, -w - 2.2, -w - 0.12, s + 2.1, s + 2.25, top + 0.86, top + 2.4, 'glass');
    if (c.fine) {
      prism(o, c, P, w + 0.28, w + 1.9, s - 1.18, s + 1.18, top, top + 0.65, 'trim');
      rod(o, c, P(w + 1.2, s, top + 0.65), P(w + 1.2, s, top + 2.18), 0.19, 0.19, 'paint');
      rod(o, c, P(w + 1.2, s, top + 2.18), P(w - 0.48, s + 1.15, top + 1.48), 0.18, 0.19);
    }
  }
  for (const [s, shift, y] of [
    [0, -7, upper],
    [length, 8, lower],
  ])
    for (const sign of [-1, 1]) {
      const x = sign * w,
        z = x + sign * 2.65;
      q(
        o,
        c,
        [P(x, s, y + 0.65), P(z, s + shift, y + 0.42), P(z, s + shift, bottom), P(x, s, bottom)],
        'wall',
        [side[0] * -sign, 0, side[1] * -sign],
      );
    }
}
export function buildDamLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Kainji tier ' + level);
  for (const rows of earth) earthwork(o, c, rows);
  concrete(o, c);
  gatedSpillway(o, c);
  generatingHall(o, c);
  for (const lock of locks) navigation(o, c, lock);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

/** Original complete principal Albert Memorial;source andfour shared-material browser tiers. */
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
  stone: lin('d9d1c0'),
  white: lin('e0dcd3'),
  paving: lin('c9c1b7'),
  granite: lin('a9867b'),
  dark: lin('5b6061'),
  gold: lin('d7ae57'),
  blue: lin('597385'),
  red: lin('a96e5c'),
  cream: lin('dfd0a7'),
};
C.wall = C.stone;
export const memorialSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.9 },
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.85 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.65 },
  gold: { slot: 'door', graph: 'metal_bronze_cast', roughness: 0.48, metallic: 0.7 },
  dark: { slot: 'door', graph: 'metal_painted', roughness: 0.8, metallic: 0.1 },
  tile: { slot: 'roof', graph: 'tile_glazed', roughness: 0.65 },
};
const cfg = {
  skyline: { arch: 2, round: 4, figure: 3, steps: 3 },
  district: { arch: 4, round: 6, figure: 3, steps: 6, detail: true },
  street: { arch: 10, round: 8, figure: 6, steps: 12, detail: true, fine: true },
  closeup: { arch: 24, round: 16, figure: 16, steps: 12, detail: true, fine: true, near: true },
  master: {
    arch: 48,
    round: 32,
    figure: 32,
    steps: 12,
    detail: true,
    fine: true,
    near: true,
    master: true,
  },
};
export const canopyCenter = [-0.1763015, -3.5732855];
export const cornerGroups = [
  {
    index: 1,
    center: [-18.525954499999997, -21.778465],
    outline: [
      [-20.578348, -24.026017],
      [-16.473561, -23.933642],
      [-16.586919, -19.644198],
      [-20.52802, -19.530913],
    ],
  },
  {
    index: 2,
    center: [18.297199499999998, 14.478737500000001],
    outline: [
      [16.234312, 12.518641],
      [20.360087, 12.426339],
      [20.267712, 16.531136],
      [16.347598, 16.459751],
    ],
  },
  {
    index: 3,
    center: [18.049853, -22.107594499999998],
    outline: [
      [16.121311, -24.344651],
      [20.041425, -24.273263],
      [20.11274, -19.962836],
      [15.986966, -19.870538],
    ],
  },
  {
    index: 4,
    center: [-18.2534835, 14.772207000000002],
    outline: [
      [-20.280677, 12.858294],
      [-16.339576, 12.745005],
      [-16.22629, 16.686119],
      [-20.167391, 16.799409],
    ],
  },
];
export const centralStepOutline = [
  [-15, -15],
  [15, -15],
  [15, 15],
  [-15, 15],
].map(([x, z]) => [x + canopyCenter[0], z + canopyCenter[1]]);
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
function tapered(o, c, x, z, y0, y1, r0, r1, s = 'stone', col = C.stone, n = c.round) {
  const ring = (r, y) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n + Math.PI / 4;
        return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
      }),
    a = ring(r0, y0),
    b = ring(r1, y1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(o, c, [a[i], a[j], b[j], b[i]], s, col, [
      Math.cos(((i + 0.5) * 2 * Math.PI) / n + Math.PI / 4),
      0,
      Math.sin(((i + 0.5) * 2 * Math.PI) / n + Math.PI / 4),
    ]);
  }
  for (const [r, N] of [
    [a, [0, -1, 0]],
    [b, [0, 1, 0]],
  ])
    for (let i = 1; i < n - 1; i++) T(o, c, [r[0], r[i], r[i + 1]], s, col, N);
}
function oval(o, c, rows, n, s = 'marble', col = C.white) {
  const rings = rows.map(([y, x, z, rx, rz]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [x + rx * Math.cos(a), y, z + rz * Math.sin(a)];
    }),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(o, c, [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]], s, col, [
        Math.cos(((i + 0.5) * 2 * Math.PI) / n),
        0,
        Math.sin(((i + 0.5) * 2 * Math.PI) / n),
      ]);
    }
  for (const [r, N] of [
    [rings[0], [0, -1, 0]],
    [rings.at(-1), [0, 1, 0]],
  ])
    for (let i = 1; i < n - 1; i++) T(o, c, [r[0], r[i], r[i + 1]], s, col, N);
}
function ellipsoid(o, c, p, r, s = 'marble', col = C.white, n = c === cfg.district ? 4 : c.round) {
  sphere(adapter(o, c), s, p, r, col, n, Math.max(3, Math.floor(n / 2)));
}
function facePrism(o, c, r, point, depth = 0.6, s = 'stone', col = C.stone) {
  const t = transform(o, point),
    ids = earcut(r.flat());
  for (let i = 0; i < ids.length; i += 3)
    for (const [v, N] of [
      [0, [0, 0, 1]],
      [-depth, [0, 0, -1]],
    ])
      T(
        t,
        c,
        ids.slice(i, i + 3).map((j) => [...r[j], v]),
        s,
        col,
        N,
      );
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      a = r[i],
      b = r[j];
    Q(
      t,
      c,
      [
        [...a, 0],
        [...b, 0],
        [...b, -depth],
        [...a, -depth],
      ],
      s,
      col,
      [b[1] - a[1], a[0] - b[0], 0],
    );
  }
}
function arch(w, spring, crown, n) {
  const r = w / 2,
    a = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      k = 1 - t;
    a.push([
      -r * k * k * k - 3 * r * k * k * t - 3 * 0.42 * r * k * t * t,
      spring * k * k * k +
        3 * (spring + (crown - spring) * 0.47) * k * k * t +
        3 * (crown - 0.6) * k * t * t +
        crown * t * t * t,
    ]);
  }
  return [
    ...a,
    ...a
      .slice(0, -1)
      .reverse()
      .map(([x, y]) => [-x, y]),
  ];
}
const facePoint =
  (face, r) =>
  ([u, y, v]) => {
    const n = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ][face],
      a = [n[1], -n[0]];
    return [a[0] * u + n[0] * (r + v), y, a[1] * u + n[1] * (r + v)];
  };
function rib(o, c, r, point, w, s = 'gold', col = C.gold) {
  beamPath(
    adapter(o, c),
    s,
    r.map(([u, y]) => point([u, y, 0.05])),
    w,
    w,
    col,
    false,
  );
}
function person(
  o,
  c,
  { x = 0, z = 0, y = 0, h = 2.5, pose = 0, s = 'marble', col = C.white, seated = false },
) {
  const lean = ((pose % 3) - 1) * h * 0.025,
    body = seated
      ? [
          [y + h * 0.05, x, z + 0.15, h * 0.23, h * 0.18],
          [y + h * 0.4, x, z, h * 0.2, h * 0.18],
          [y + h * 0.65, x + lean, z, h * 0.22, h * 0.12],
          [y + h * 0.8, x + lean, z, h * 0.085, h * 0.08],
        ]
      : [
          [y, x, z, h * 0.17, h * 0.13],
          [y + h * 0.4, x + lean * 0.5, z, h * 0.12, h * 0.1],
          [y + h * 0.7, x + lean, z, h * 0.18, h * 0.09],
          [y + h * 0.81, x + lean, z, h * 0.075, h * 0.07],
        ];
  oval(o, c, body, c.figure, s, col);
  ellipsoid(o, c, [x + lean, y + h * 0.89, z + 0.035], [h * 0.083, h * 0.11, h * 0.087], s, col);
  if (c.detail) {
    for (const sign of [-1, 1]) {
      const A = [x + sign * h * 0.17, y + h * 0.66, z],
        B = [x + sign * h * (pose % 2 ? 0.23 : 0.18), y + h * 0.49, z + h * 0.12],
        D = [x + sign * h * 0.14, y + h * (pose % 2 ? 0.55 : 0.38), z + h * 0.2];
      beam(adapter(o, c), s, A, B, h * 0.08, h * 0.09, col);
      if (c.fine) beam(adapter(o, c), s, B, D, h * 0.07, h * 0.08, col);
    }
    if (c.near) {
      const f = [x + lean, y + h * 0.9, z + h * 0.087];
      T(
        o,
        c,
        [
          [f[0] - 0.035, f[1] + 0.03, f[2]],
          [f[0] + 0.035, f[1] + 0.03, f[2]],
          [f[0], f[1] - 0.04, f[2] + h * 0.035],
        ],
        s,
        col,
        [0, 0, 1],
      );
      for (const sign of [-1, 1])
        box(
          o,
          c,
          x + sign * h * 0.12 - h * 0.07,
          x + sign * h * 0.12 + h * 0.07,
          y,
          y + h * 0.1,
          z - 0.08,
          z + h * 0.21,
          s,
          col,
        );
      for (let i = 0; i < (c.master ? 8 : 4); i++) {
        const a = (i * 2 * Math.PI) / (c.master ? 8 : 4);
        beam(
          adapter(o, c),
          s,
          [x + h * 0.15 * Math.cos(a), y + h * 0.04, z + h * 0.115 * Math.sin(a)],
          [x + lean * 0.4 + h * 0.12 * Math.cos(a), y + h * 0.41, z + h * 0.1 * Math.sin(a)],
          h * 0.014,
          h * 0.014,
          col,
        );
      }
    }
  }
}
function seatedAlbert(o, c) {
  box(o, c, -2, 2, 5.2, 5.6, -1.6, 1.6, 'granite', C.granite);
  box(o, c, -1.8, 1.8, 5.6, 7.7, -1.4, 1.4, 'granite', C.granite);
  box(o, c, -2, 2, 7.7, 8.15, -1.55, 1.55, 'marble', C.white);
  box(o, c, -1.25, 1.25, 8.15, 8.6, -0.95, 0.8, 'gold', C.gold);
  box(o, c, -1.15, 1.15, 8.6, 11.7, -1.1, -0.75, 'gold', C.gold);
  person(o, c, { x: 0, z: 0, y: 8.15, h: 5.1, pose: 2, s: 'gold', col: C.gold, seated: true });
  if (c.detail) {
    for (const sign of [-1, 1]) {
      beam(
        adapter(o, c),
        'gold',
        [sign * 0.65, 9.4, 0.4],
        [sign * 0.72, 9.1, 1.1],
        0.75,
        0.9,
        C.gold,
      );
      beam(
        adapter(o, c),
        'gold',
        [sign * 0.72, 9.1, 1.1],
        [sign * 0.72, 8.3, 1.8],
        0.65,
        0.65,
        C.gold,
      );
      box(o, c, sign * 0.72 - 0.4, sign * 0.72 + 0.4, 8.15, 8.5, 1.2, 2.0, 'gold', C.gold);
      beam(
        adapter(o, c),
        'gold',
        [sign * 0.8, 11.35, 0.2],
        [sign * 1.1, 10.2, 0.55],
        0.4,
        0.45,
        C.gold,
      );
      beam(
        adapter(o, c),
        'gold',
        [sign * 1.1, 10.2, 0.55],
        [sign * 0.45, 10.1, 1.1],
        0.35,
        0.4,
        C.gold,
      );
    }
    box(o, c, -0.65, 0.65, 9.8, 10.15, 0.65, 1.35, 'gold', C.gold);
    if (c.fine)
      for (const sign of [-1, 1])
        for (const x of [-1.1, 0, 1.1]) {
          box(
            o,
            c,
            x - 0.28,
            x + 0.28,
            6.1,
            7.15,
            sign * 1.43 - 0.035,
            sign * 1.43 + 0.035,
            'marble',
            C.white,
          );
          box(
            o,
            c,
            x - 0.18,
            x + 0.18,
            6.23,
            7.02,
            sign * 1.48 - 0.025,
            sign * 1.48 + 0.025,
            'gold',
            C.gold,
          );
        }
  }
}
function podium(o, c) {
  for (let i = 0; i < c.steps; i++) {
    const half = 15 - (i * 6) / c.steps,
      top = 0.2 + ((i + 1) * 2.8) / c.steps;
    box(o, c, -half, half, c === cfg.skyline ? 0 : -6, top, -half, half, 'granite', C.paving);
  }
  box(o, c, -7.3, 7.3, 3, 3.2, -7.3, 7.3, 'granite', C.granite);
  box(o, c, -7.1, 7.1, 3.2, 4.8, -7.1, 7.1, 'marble', C.white);
  box(o, c, -7.5, 7.5, 4.8, 5.2, -7.5, 7.5, 'granite', C.granite);
  if (c.fine) {
    for (let face = 0; face < 4; face++) {
      const t = transform(o, facePoint(face, 7.13));
      if (c.near) {
        for (let i = 0; i < (c.master ? 24 : 12); i++)
          person(t, c, {
            x: -6.6 + ((i + 0.5) * 13.2) / (c.master ? 24 : 12),
            z: 0.035,
            y: 3.28,
            h: 1.38,
            pose: i,
          });
      } else
        for (let i = 0; i < 4; i++) {
          const x = -5.2 + i * 3.45;
          oval(
            t,
            c,
            [
              [3.3, x, 0.04, 0.22, 0.04],
              [4.1, x, 0.04, 0.14, 0.035],
              [4.4, x, 0.04, 0.07, 0.03],
            ],
            4,
          );
          ellipsoid(t, c, [x, 4.5, 0.04], [0.11, 0.13, 0.035], 'marble', C.white, 4);
        }
    }
  }
}
function columns(o, c) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * 4.8,
        z = sz * 4.8;
      box(o, c, x - 0.95, x + 0.95, 5.2, 5.85, z - 0.95, z + 0.95, 'dark', C.dark);
      if (c === cfg.skyline) tapered(o, c, x, z, 5.85, 19.2, 0.7, 0.62, 'granite', C.granite, 4);
      else
        for (const [dx, dz] of [
          [0, 0],
          [-0.42, -0.42],
          [0.42, -0.42],
          [0.42, 0.42],
          [-0.42, 0.42],
        ]) {
          tapered(
            o,
            c,
            x + dx,
            z + dz,
            5.85,
            19.2,
            dx === 0 ? 0.39 : 0.27,
            dx === 0 ? 0.35 : 0.24,
            'granite',
            C.granite,
          );
          if (c.near)
            for (const y of [9.6, 14.1])
              tapered(
                o,
                c,
                x + dx,
                z + dz,
                y,
                y + 0.11,
                dx === 0 ? 0.42 : 0.3,
                dx === 0 ? 0.42 : 0.3,
                'gold',
                C.gold,
              );
        }
      if (c.fine && !c.near)
        for (const y of [9.6, 14.1])
          tapered(o, c, x, z, y, y + 0.12, 0.94, 0.94, 'gold', C.gold, 8);
      tapered(o, c, x, z, 19.2, 20.2, 0.75, 0.96, 'stone', C.stone, c === cfg.skyline ? 4 : 8);
      box(o, c, x - 1, x + 1, 20.2, 20.4, z - 1, z + 1, 'stone', C.stone);
      if (c.fine)
        box(
          o,
          c,
          x + sx * 0.6 - 0.7,
          x + sx * 0.6 + 0.7,
          15.5,
          15.7,
          z + sz * 0.6 - 0.65,
          z + sz * 0.6 + 0.65,
          'dark',
          C.dark,
        );
      if (c.fine)
        person(o, c, {
          x: x + sx * 0.6,
          z: z + sz * 0.6,
          y: 15.7,
          h: 3.3,
          pose: sx + sz,
          s: 'dark',
          col: C.dark,
        });
    }
}
function arches(o, c) {
  for (let face = 0; face < 4; face++) {
    const point = facePoint(face, 5.8),
      curve = arch(8.0, 20.4, 27, c.arch),
      r = [[-5.8, 20.4], ...curve, [5.8, 20.4], [5.8, 28.2], [-5.8, 28.2]];
    facePrism(o, c, r, point, 0.8);
    if (c.detail) {
      rib(o, c, curve, point, 0.18, 'gold', C.gold);
      if (c.fine) rib(o, c, arch(8.5, 20.4, 27.55, c.arch), point, 0.16, 'marble', C.white);
    }
    if (c.fine) {
      if (c.near) rib(o, c, arch(9.2, 20.4, 28.0, c.arch), point, 0.18, 'gold', C.gold);
      const t = transform(o, point);
      for (let i = 0; i < (c.master ? 18 : 8); i++) {
        const u = -4.9 + (i * 9.8) / ((c.master ? 18 : 8) - 1),
          y = 27.8;
        ellipsoid(
          t,
          c,
          [u, y, 0.12],
          [0.13, 0.13, 0.06],
          'tile',
          i % 2 ? C.red : C.blue,
          Math.max(4, c.round / 2),
        );
      }
    }
  }
}
function gableRoof(o, c) {
  const R = 6.2,
    eave = 28.2,
    ridge = 34.5,
    center = [0, ridge, 0],
    corners = [
      [-R, eave, R],
      [R, eave, R],
      [R, eave, -R],
      [-R, eave, -R],
    ],
    peaks = [
      [0, ridge, R],
      [R, ridge, 0],
      [0, ridge, -R],
      [-R, ridge, 0],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    T(o, c, [corners[i], peaks[i], center], 'dark', C.dark, [0, 1, 0]);
    T(o, c, [corners[j], center, peaks[i]], 'dark', C.dark, [0, 1, 0]);
    const point = facePoint(i, R);
    facePrism(
      o,
      c,
      [
        [-R, eave],
        [R, eave],
        [0, ridge],
      ],
      point,
      0.22,
    );
    if (c.detail) {
      const t = transform(o, point);
      for (const [p, col] of [
        [
          [
            [-4.8, 29.1],
            [4.8, 29.1],
            [0, 33.65],
          ],
          C.cream,
        ],
        [
          [
            [-2.5, 29.7],
            [0, 32.7],
            [2.5, 29.7],
          ],
          C.blue,
        ],
      ])
        T(
          t,
          c,
          p.map(([x, y]) => [x, y, 0.03]),
          'tile',
          col,
          [0, 0, 1],
        );
      beamPath(
        adapter(o, c),
        'gold',
        [point([-R, eave, 0.13]), point([0, ridge + 0.12, 0.13]), point([R, eave, 0.13])],
        0.16,
        0.16,
        C.gold,
      );
      beam(adapter(o, c), 'gold', peaks[i], center, 0.18, 0.18, C.gold);
    }
  }
  Q(
    o,
    c,
    [
      [-R, eave, -R],
      [R, eave, -R],
      [R, eave, R],
      [-R, eave, R],
    ],
    'tile',
    C.blue,
    [0, -1, 0],
  );
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * 5.45,
        z = sz * 5.45;
      box(o, c, x - 0.45, x + 0.45, 28, 30, z - 0.45, z + 0.45, 'stone', C.stone);
      tapered(o, c, x, z, 30, 36, 0.58, 0.06, 'stone', C.stone, c === cfg.skyline ? 4 : 8);
      tapered(o, c, x, z, 36, 36.8, 0.17, 0.04, 'gold', C.gold, c === cfg.skyline ? 4 : 8);
      if (c.fine)
        for (let y = 30.5; y < 35.6; y += c.master ? 0.55 : 1.1)
          for (const sign of [-1, 1])
            beam(
              adapter(o, c),
              'gold',
              [x + sign * 0.08, y, z],
              [x + (sign * 0.38 * (36 - y)) / 6, y + 0.25, z],
              0.09,
              0.09,
              C.gold,
            );
    }
}
function smallTower(o, c, y0, y1, R, s = 'dark', col = C.dark) {
  for (let face = 0; face < 4; face++) {
    const p = facePoint(face, R);
    if (c === cfg.skyline) {
      box(o, c, -R, R, y0, y1, -R, R, s, col);
      break;
    }
    const top = y1,
      sp = y0 + 0.42 * (y1 - y0),
      curve = arch(R * 1.05, sp, top - 0.2, c.arch),
      r = [[-R, y0], [-R * 0.525, y0], ...curve, [R * 0.525, y0], [R, y0], [R, top], [-R, top]];
    facePrism(o, c, r, p, 0.35, s, col);
    if (c.fine) rib(o, c, curve, p, 0.1, 'gold', C.gold);
  }
  box(o, c, -R - 0.15, R + 0.15, y0 - 0.18, y0, -R - 0.15, R + 0.15, 'gold', C.gold);
  box(o, c, -R - 0.15, R + 0.15, y1, y1 + 0.16, -R - 0.15, R + 0.15, 'gold', C.gold);
}
function spire(o, c) {
  smallTower(o, c, 34.5, 39.1, 1.85);
  box(o, c, -1.2, 1.2, 39.1, 39.5, -1.2, 1.2, 'gold', C.gold);
  smallTower(o, c, 39.5, 44.2, 1.3);
  tapered(o, c, 0, 0, 44.35, 48.2, 1.05, 0.44, 'gold', C.gold, c === cfg.skyline ? 4 : 8);
  tapered(o, c, 0, 0, 48.2, 50.2, 0.48, 0.12, 'gold', C.gold, c === cfg.skyline ? 4 : 8);
  box(o, c, -0.1, 0.1, 50.2, 54, -0.1, 0.1, 'gold', C.gold);
  box(o, c, -0.95, 0.95, 52.5, 52.7, -0.1, 0.1, 'gold', C.gold);
  if (c.detail) {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        person(o, c, {
          x: sx * 1.45,
          z: sz * 1.45,
          y: 35.0,
          h: 3.7,
          s: 'gold',
          col: C.gold,
          pose: sx + sz,
        });
        if (c.near)
          person(o, c, {
            x: sx * 0.92,
            z: sz * 0.92,
            y: 40.0,
            h: 3.3,
            s: 'gold',
            col: C.gold,
            pose: sx - sz,
          });
      }
    for (const [y, R] of [
      [39.25, 1.9],
      [44.35, 1.35],
    ])
      for (let face = 0; face < 4; face++) {
        const p = facePoint(face, R);
        facePrism(
          o,
          c,
          [
            [-R, y],
            [0, y + 1.1],
            [R, y],
            [R, y - 0.15],
            [-R, y - 0.15],
          ],
          p,
          0.18,
          'gold',
          C.gold,
        );
      }
  }
}
function animal(o, c, type) {
  const n = c.round,
    r =
      type === 'elephant'
        ? [1.25, 0.95, 0.62]
        : type === 'camel'
          ? [1.05, 0.65, 0.55]
          : [1.1, 0.65, 0.6],
    cy = type === 'elephant' ? 1.6 : 1.25;
  ellipsoid(o, c, [0, cy, 0], r);
  for (const x of [-0.7, 0.7])
    for (const z of [-0.38, 0.38])
      tapered(
        o,
        c,
        x,
        z,
        0.2,
        cy,
        0.16,
        0.18,
        'marble',
        C.white,
        c === cfg.skyline ? 3 : Math.min(n, 12),
      );
  const head =
    type === 'elephant' ? [1.25, 1.65, 0] : type === 'camel' ? [1.0, 2.15, 0] : [1.25, 1.45, 0];
  if (type === 'camel') {
    ellipsoid(o, c, [0.0, 1.75, 0], [0.5, 0.45, 0.5]);
    beam(adapter(o, c), 'marble', [0.7, 1.2, 0], [1.0, 2.1, 0], 0.35, 0.35, C.white);
  }
  ellipsoid(o, c, head, type === 'elephant' ? [0.5, 0.65, 0.5] : [0.42, 0.43, 0.38]);
  if (type === 'elephant') {
    for (const sign of [-1, 1]) ellipsoid(o, c, [1, 1.7, sign * 0.48], [0.3, 0.55, 0.12]);
    beam(adapter(o, c), 'marble', [1.5, 1.5, 0], [1.8, 0.5, 0.1], 0.27, 0.25, C.white);
  } else if (c.fine)
    for (const sign of [-1, 1])
      beam(
        adapter(o, c),
        'marble',
        [1.2, 1.75, sign * 0.25],
        [1.1, 2, sign * 0.5],
        0.1,
        0.1,
        C.white,
      );
  if (c.fine) beam(adapter(o, c), 'marble', [-1, 1.3, 0], [-1.45, 0.65, 0.1], 0.08, 0.08, C.white);
}
function outerGroup(o, c, index) {
  const g = cornerGroups[index],
    R = g.outline,
    center = g.center,
    t = transform(o, ([x, y, z]) => [x + center[0], y, z + center[1]]);
  prism(o, c, R, c === cfg.skyline ? 0 : -6, 1.25, 'granite', C.paving);
  const bounds = [
    Math.min(...R.map((p) => p[0])) + 0.12,
    Math.max(...R.map((p) => p[0])) - 0.12,
    Math.min(...R.map((p) => p[1])) + 0.12,
    Math.max(...R.map((p) => p[1])) - 0.12,
  ];
  box(o, c, bounds[0], bounds[1], 1.25, 1.5, bounds[2], bounds[3], 'marble', C.white);
  const sculpture = transform(t, ([x, y, z]) => [x, y + 1.5, z]);
  if (c === cfg.skyline) {
    oval(
      sculpture,
      c,
      [
        [0.1, 0, 0, 1.6, 1.4],
        [1.5, 0, 0, 1.2, 0.9],
        [3.4, -0.3, -0.2, 0.3, 0.3],
      ],
      3,
    );
    return;
  }
  animal(sculpture, c, ['camel', 'buffalo', 'elephant', 'bull'][index]);
  person(sculpture, c, { x: -0.45, z: -0.1, y: 1.65, h: 2.25, pose: index });
  if (c.near) {
    person(sculpture, c, { x: -1.1, z: 0.7, y: 0.1, h: 1.85, pose: index + 1, seated: true });
    person(sculpture, c, { x: 0.7, z: -0.6, y: 0.1, h: 1.6, pose: index + 2, seated: true });
  }
}
function innerGroups(o, c) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const t = transform(o, ([x, y, z]) => [sx * 6.2 + x, y, sz * 6.2 + z]);
      if (c === cfg.skyline) {
        oval(
          t,
          c,
          [
            [5.2, 0, 0, 0.9, 0.8],
            [7.3, 0, 0, 0.25, 0.25],
          ],
          3,
        );
        continue;
      }
      person(t, c, { x: 0, z: 0, y: 5.2, h: 2.5, pose: sx + sz });
      if (c.near) {
        person(t, c, { x: 0.65, z: 0.4, y: 5.2, h: 1.7, pose: 1, seated: true });
        person(t, c, { x: -0.6, z: -0.3, y: 5.2, h: 1.6, pose: 2, seated: true });
      }
    }
}
export function buildMemorialLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown Albert Memorial tier ' + level);
  const local = transform(o, ([x, y, z]) => [x + canopyCenter[0], y, z + canopyCenter[1]]);
  podium(local, c);
  columns(local, c);
  arches(local, c);
  gableRoof(local, c);
  spire(local, c);
  seatedAlbert(local, c);
  innerGroups(local, c);
  for (let i = 0; i < 4; i++) outerGroup(o, c, i);
}
export const buildMemorialSkyline = (o) => buildMemorialLevel(o, 'skyline');
export const buildMemorialDistrict = (o) => buildMemorialLevel(o, 'district');
export const buildMemorialStreet = (o) => buildMemorialLevel(o, 'street');
export const buildMemorialCloseup = (o) => buildMemorialLevel(o, 'closeup');

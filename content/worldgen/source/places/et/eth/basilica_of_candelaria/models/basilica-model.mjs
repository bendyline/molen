/** Original complete principal Basilica of Candelaria;metric shared surfaces andexplicit browser tiers. */
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  wall: lin('e2dfd5'),
  edge: lin('eee7d6'),
  stone: lin('d4c5aa'),
  base: lin('8b8b80'),
  roof: lin('b37a57'),
  roofEdge: lin('bd8d65'),
  wood: lin('654c35'),
  woodEdge: lin('806147'),
  metal: lin('505658'),
  glass: lin('526572'),
};
export const basilicaSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.88 },
  base: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.8 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.86 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.82, metallic: 0.2 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.4 },
};
const cfg = {
  skyline: { arch: 1, round: 6, post: 3 },
  district: { arch: 6, round: 12, post: 2.0, detail: true },
  street: { arch: 10, round: 16, post: 1.2, detail: true, fine: true },
  closeup: { arch: 24, round: 48, post: 0.65, detail: true, fine: true },
  master: { arch: 48, round: 96, post: 0.4, detail: true, fine: true, master: true },
};
export const basilicaOutline = [
  [-18.009587, 26.888386],
  [-18.035277, -26.706007],
  [18.398597, -26.774997],
  [14.381576, -21.41363],
  [7.424627, -21.358762],
  [7.582805, -13.886541],
  [13.663517, -14.30172],
  [13.56277, -9.457561],
  [18.097637, -9.562801],
  [18.100845, -2.863502],
  [11.453193, -2.60265],
  [11.666236, 11.826512],
  [15.94346, 11.772929],
  [15.638012, 19.606105],
  [13.886183, 20.225341],
  [12.907917, 22.029468],
  [11.621638, 26.30733],
  [7.086776, 26.412569],
  [7.190089, 26.927851],
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
function archProfile(u, y, w, h, n) {
  const r = w / 2,
    spring = y + h - r,
    a = [
      [u - r, y],
      [u + r, y],
    ];
  for (let i = 0; i <= n; i++) {
    const t = (i * Math.PI) / n;
    a.push([u + r * Math.cos(t), spring + r * Math.sin(t)]);
  }
  return a;
}
function circleProfile(u, y, r, n, clover = false) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i * 2 * Math.PI) / n,
      R = r * (clover ? 1 + 0.16 * Math.cos(4 * t) : 1);
    return [u + R * Math.cos(t), y + R * Math.sin(t)];
  });
}
function holeWall(
  o,
  c,
  {
    left,
    right,
    bottom,
    top,
    depth = 0.55,
    point,
    holes = [],
    s = 'wall',
    col = C.wall,
    backing = 'glass',
  },
) {
  const t = transform(o, point),
    outer = [
      [left, bottom],
      [right, bottom],
      [right, top],
      [left, top],
    ],
    flat = [...outer, ...holes.flat()],
    starts = holes.map((h, i) => 4 + holes.slice(0, i).reduce((a, h) => a + h.length, 0)),
    ids = earcut(flat.flat(), starts);
  for (let i = 0; i < ids.length; i += 3)
    for (const [v, N] of [
      [0, [0, 0, 1]],
      [-depth, [0, 0, -1]],
    ])
      T(
        t,
        c,
        ids.slice(i, i + 3).map((j) => [flat[j][0], flat[j][1], v]),
        s,
        col,
        N,
      );
  for (const [r, hole] of [
    ...(c === cfg.skyline && backing === false ? [] : [[outer, false]]),
    ...holes.map((h) => [h, true]),
  ])
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        N = hole ? [a[1] - b[1], b[0] - a[0], 0] : [b[1] - a[1], a[0] - b[0], 0];
      Q(
        t,
        c,
        [
          [a[0], a[1], 0],
          [b[0], b[1], 0],
          [b[0], b[1], -depth],
          [a[0], a[1], -depth],
        ],
        s,
        col,
        N,
      );
    }
  if (backing)
    for (const r of holes) {
      const ids = earcut(r.flat()),
        surface = r.backing ?? backing,
        col =
          surface === 'wood'
            ? C.wood
            : surface === 'stone'
              ? C.stone
              : surface === 'wall'
                ? C.wall
                : C.glass;
      for (let i = 0; i < ids.length; i += 3)
        T(
          t,
          c,
          ids.slice(i, i + 3).map((j) => [r[j][0], r[j][1], -depth + 0.015]),
          surface,
          col,
          [0, 0, 1],
        );
    }
}
function frame(o, c, r, point, width = 0.18, s = 'stone', col = C.stone) {
  if (c === cfg.skyline) return;
  if (c === cfg.district) {
    const t = transform(o, point),
      center = r.reduce((a, p) => [a[0] + p[0] / r.length, a[1] + p[1] / r.length], [0, 0]),
      outer = r.map((p) => {
        const d = Math.hypot(p[0] - center[0], p[1] - center[1]) || 1;
        return [p[0] + (width * (p[0] - center[0])) / d, p[1] + (width * (p[1] - center[1])) / d];
      });
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      Q(
        t,
        c,
        [
          [...r[i], 0.035],
          [...r[j], 0.035],
          [...outer[j], 0.035],
          [...outer[i], 0.035],
        ],
        s,
        col,
        [0, 0, 1],
      );
    }
    return;
  }
  const ps = r.map(([u, y]) => point([u, y, 0.035]));
  beamPath(adapter(o, c), s, ps, width, width, col, true);
}
function hip(o, c, x0, x1, z0, z1, eave, ridge, axis = 'z', s = 'roof') {
  const a = [x0, eave, z0],
    b = [x1, eave, z0],
    d = [x0, eave, z1],
    e = [x1, eave, z1],
    r = Math.min((x1 - x0) / 2, (z1 - z0) / 2),
    P = axis === 'z' ? [(x0 + x1) / 2, ridge, z0 + r] : [x0 + r, ridge, (z0 + z1) / 2],
    R = axis === 'z' ? [(x0 + x1) / 2, ridge, z1 - r] : [x1 - r, ridge, (z0 + z1) / 2];
  const surfaces =
    axis === 'z'
      ? [
          [a, b, P],
          [b, e, R, P],
          [e, d, R],
          [d, a, P, R],
        ]
      : [
          [a, b, R, P],
          [b, e, R],
          [e, d, P, R],
          [d, a, P],
        ];
  for (const p of surfaces) {
    if (p.length === 3) T(o, c, p, s, C.roof, [0, 1, 0]);
    else Q(o, c, p, s, C.roof, [0, 1, 0]);
  }
  Q(o, c, [a, d, e, b], s, C.roof, [0, -1, 0]);
  if (c.detail) beam(adapter(o, c), 'roof', P, R, 0.14, 0.14, C.roofEdge);
}
function gable(o, c, x0, x1, z0, z1, eave, ridge) {
  const A = [x0, eave, z0],
    B = [x1, eave, z0],
    C0 = [x0, eave, z1],
    D = [x1, eave, z1],
    P = [(x0 + x1) / 2, ridge, z0],
    R = [(x0 + x1) / 2, ridge, z1];
  Q(o, c, [A, C0, R, P], 'roof', C.roof, [-1, 1, 0]);
  Q(o, c, [P, R, D, B], 'roof', C.roof, [1, 1, 0]);
  T(o, c, [A, P, B], 'wall', C.wall, [0, 0, -1]);
  T(o, c, [C0, D, R], 'wall', C.wall, [0, 0, 1]);
  Q(o, c, [A, B, D, C0], 'roof', C.roof, [0, -1, 0]);
  if (c.detail) beam(adapter(o, c), 'roof', P, R, 0.16, 0.16, C.roofEdge);
}
function crossMark(o, c, x, y, z, h = 1) {
  if (c === cfg.skyline) {
    box(o, c, x - 0.06, x + 0.06, y, y + h, z - 0.06, z + 0.06, 'metal', C.metal);
    for (const N of [
      [0, 0, 1],
      [0, 0, -1],
    ])
      Q(
        o,
        c,
        [
          [x - h * 0.3, y + h * 0.62, z],
          [x + h * 0.3, y + h * 0.62, z],
          [x + h * 0.3, y + h * 0.72, z],
          [x - h * 0.3, y + h * 0.72, z],
        ],
        'metal',
        C.metal,
        N,
      );
    return;
  }
  box(o, c, x - 0.06, x + 0.06, y, y + h, z - 0.06, z + 0.06, 'metal', C.metal);
  box(
    o,
    c,
    x - h * 0.3,
    x + h * 0.3,
    y + h * 0.62,
    y + h * 0.72,
    z - 0.06,
    z + 0.06,
    'metal',
    C.metal,
  );
}
function disk(o, c, point, u, y, r, s, col, n = c.round) {
  const t = transform(o, point);
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    T(
      t,
      c,
      [
        [u, y, 0.025],
        [u + r * Math.cos(a), y + r * Math.sin(a), 0.025],
        [u + r * Math.cos(b), y + r * Math.sin(b), 0.025],
      ],
      s,
      col,
      [0, 0, 1],
    );
  }
}
function clock(o, c, point, y, r = 0.58) {
  disk(o, c, point, 0, y, r, 'stone', C.edge);
  if (c.fine) {
    const t = transform(o, point);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(
        adapter(t, c),
        'metal',
        [r * 0.79 * Math.sin(a), y + r * 0.79 * Math.cos(a), 0.04],
        [r * 0.91 * Math.sin(a), y + r * 0.91 * Math.cos(a), 0.04],
        0.035,
        0.03,
        C.metal,
      );
    }
    beam(adapter(t, c), 'metal', [0, y, 0.07], [0.02, y + r * 0.66, 0.07], 0.045, 0.04, C.metal);
    beam(
      adapter(t, c),
      'metal',
      [0, y, 0.08],
      [-r * 0.5, y - r * 0.12, 0.08],
      0.055,
      0.04,
      C.metal,
    );
  }
}
const sidePoint =
    (x, z, sign) =>
    ([u, y, v]) => [x + sign * v, y, z - sign * u],
  frontPoint =
    (x, z) =>
    ([u, y, v]) => [x + u, y, z + v];
function railing(o, c, a, b, y, s = 'wood') {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (c === cfg.skyline) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      N = [dz, 0, -dx],
      p = [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], y + 1, b[1]],
        [a[0], y + 1, a[1]],
      ];
    Q(o, c, p, s, C.wood, N);
    Q(
      o,
      c,
      p,
      s,
      C.wood,
      N.map((v) => -v),
    );
    return;
  }
  const n = Math.ceil(L / c.post);
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t;
    box(
      o,
      c,
      x - 0.06,
      x + 0.06,
      y,
      y + 1.1,
      z - 0.06,
      z + 0.06,
      s,
      s === 'metal' ? C.metal : C.wood,
    );
  }
  for (const h of [0.12, 1.05])
    beam(
      adapter(o, c),
      s,
      [a[0], y + h, a[1]],
      [b[0], y + h, b[1]],
      0.12,
      0.12,
      s === 'metal' ? C.metal : C.wood,
    );
}
function tower(o, c, x, z, tall = false) {
  const w = tall ? 5.6 : 4.8,
    bodyTop = tall ? 35 : 20.4,
    Y = tall ? 36.8 : 20.4,
    top = tall ? 43.1 : 26.5;
  if (c === cfg.skyline) box(o, c, x - w / 2, x + w / 2, 0.3, bodyTop, z - w / 2, z + w / 2);
  for (let face = 0; face < 4; face++) {
    const n = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ][face],
      u = [n[1], -n[0]],
      point = ([U, y, V]) => [
        x + u[0] * U + n[0] * (w / 2 + V),
        y,
        z + u[1] * U + n[1] * (w / 2 + V),
      ],
      slots = [];
    if (c.fine)
      for (const y of tall ? [7, 12, 17, 22, 27] : [13.2, 16.4])
        for (const U of [-0.5, 0.5]) slots.push(archProfile(U, y, 0.28, 1.3, c.arch));
    if (c !== cfg.skyline)
      holeWall(o, c, {
        left: -w / 2,
        right: w / 2,
        bottom: 0.3,
        top: bodyTop,
        point,
        holes: slots,
      });
    const holes =
      c === cfg.skyline && (face === 1 || face === 2)
        ? []
        : tall && c !== cfg.skyline
          ? [-0.93, 0.93].map((U) => archProfile(U, 37.6, 1.2, 3.5, c.arch))
          : [archProfile(0, Y + 0.45, tall ? 2.8 : 2.1, tall ? 4.1 : 4.6, c.arch)];
    holeWall(o, c, { left: -w / 2, right: w / 2, bottom: Y, top, point, holes, backing: false });
    for (const r of holes) frame(o, c, r, point, 0.15);
    if (tall && c !== cfg.skyline) clock(o, c, point, 42.35, 0.53);
    else if (c.fine) {
      disk(o, c, point, 0, 18.9, 0.55, 'stone', C.stone, 16);
      crossMark(transform(o, point), c, 0, 18.45, 0.05, 0.9);
    }
  }
  if (c !== cfg.skyline)
    box(o, c, x - w / 2, x + w / 2, 0.3, 0.5, z - w / 2, z + w / 2, 'base', C.base);
  box(o, c, x - w / 2, x + w / 2, Y - 0.18, Y, z - w / 2, z + w / 2, 'stone', C.stone);
  box(
    o,
    c,
    x - w / 2 - 0.18,
    x + w / 2 + 0.18,
    top,
    top + 0.25,
    z - w / 2 - 0.18,
    z + w / 2 + 0.18,
    'stone',
    C.edge,
  );
  if (tall) {
    box(o, c, x - w / 2, x + w / 2, 35, 36.8, z - w / 2, z + w / 2);
    const r = 3.9;
    box(o, c, x - r, x + r, 35, 35.25, z - r, z + r, 'wood', C.wood);
    for (const [a, b] of [
      [
        [-r, -r],
        [r, -r],
      ],
      [
        [r, -r],
        [r, r],
      ],
      [
        [r, r],
        [-r, r],
      ],
      [
        [-r, r],
        [-r, -r],
      ],
    ])
      railing(o, c, [x + a[0], z + a[1]], [x + b[0], z + b[1]], 35.25);
    hip(o, c, x - 3.2, x + 3.2, z - 3.2, z + 3.2, 43.35, 44.15);
    crossMark(o, c, x, 44.15, z, 0.85);
    if (c.fine)
      for (const sign of [-1, 1])
        for (let i = -2; i <= 2; i++)
          beam(
            adapter(o, c),
            'stone',
            [x + i * 0.9, 33.9, z + sign * 2.4],
            [x + i * 0.9, 34.95, z + sign * 3.7],
            0.22,
            0.22,
            C.stone,
          );
  } else {
    hip(o, c, x - 2.75, x + 2.75, z - 2.75, z + 2.75, 26.75, 27.55);
    crossMark(o, c, x, 27.55, z, 1);
  }
}
function portal(o, c, point, width = 9.8, top = 20.2, niche = false) {
  const opening = archProfile(0, 0.4, 3.7, 7.2, c.arch),
    holes = [opening];
  if (niche && c !== cfg.skyline) {
    const r = archProfile(0, 16.3, 2, 3.6, c.arch);
    r.backing = 'stone';
    holes.push(r);
  }
  holeWall(o, c, {
    left: -width / 2,
    right: width / 2,
    bottom: 0.3,
    top,
    depth: 0.85,
    point,
    holes,
    backing: 'wood',
  });
  frame(o, c, archProfile(0, 0.4, 4.5, 8.3, c.round), point, 0.38);
  frame(o, c, archProfile(0, 0.4, 5.4, 9.6, c.round), point, 0.28);
  if (c.detail) {
    const r = circleProfile(0, 11.5, 1.3, c.round);
    frame(o, c, r, point, 0.25);
    crossMark(transform(o, point), c, 0, 10.7, 0.2, 1.6);
    for (const y of [14.3, 14.7]) {
      const t = transform(o, point);
      box(t, c, -width / 2, width / 2, y, y + 0.18, 0, 0.28, 'stone', C.stone);
    }
  }
  if (c.fine) {
    const t = transform(o, point);
    for (const x of [-1.5, -0.5, 0.5, 1.5])
      for (const y of [1.1, 2.2, 3.3, 4.4, 5.5])
        box(t, c, x - 0.36, x + 0.36, y - 0.34, y + 0.34, -0.82, -0.76, 'wood', C.woodEdge);
  }
}
function front(o, c) {
  const point = frontPoint(-5.25, 26.92);
  portal(o, c, point, 12.2, 20.2, true);
  const t = transform(o, point);
  T(
    t,
    c,
    [
      [-6.1, 20.2, 0],
      [0, 24.2, 0],
      [6.1, 20.2, 0],
    ],
    'stone',
    C.stone,
    [0, 0, 1],
  );
  Q(
    t,
    c,
    [
      [-6.1, 20.2, -0.8],
      [6.1, 20.2, -0.8],
      [6.1, 20.2, 0],
      [-6.1, 20.2, 0],
    ],
    'stone',
    C.stone,
    [0, -1, 0],
  );
  if (c !== cfg.skyline) {
    beam(adapter(t, c), 'stone', [-6.7, 20.3, 0.2], [0, 24.65, 0.2], 0.28, 0.3, C.stone);
    beam(adapter(t, c), 'stone', [0, 24.65, 0.2], [6.7, 20.3, 0.2], 0.28, 0.3, C.stone);
    const niche = archProfile(0, 16.3, 2.0, 3.6, c.arch);
    holeWall(o, c, {
      left: -1.7,
      right: 1.7,
      bottom: 15.9,
      top: 20.5,
      depth: 0.25,
      point: ([u, y, v]) => point([u, y, 0.12 + v]),
      holes: [niche],
      s: 'stone',
      col: C.stone,
      backing: 'wall',
    });
    frame(o, c, circleProfile(0, 18.2, 2.8, c.round), point, 0.18);
  }
  crossMark(o, c, -5.25, 24.2, 26.92, 1.2);
}
export function buildBasilicaLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown basilica tier ' + level);
  if (c === cfg.skyline) {
    const ids = earcut(basilicaOutline.flat());
    for (let i = 0; i < ids.length; i += 3)
      for (const N of [
        [0, 1, 0],
        [0, -1, 0],
      ])
        T(
          o,
          c,
          ids.slice(i, i + 3).map((j) => [basilicaOutline[j][0], 0.3, basilicaOutline[j][1]]),
          'base',
          C.base,
          N,
        );
  } else prism(o, c, basilicaOutline, -8, 0.3, 'base', C.base);
  if (c === cfg.skyline) {
    const ids = earcut(basilicaOutline.flat());
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => [basilicaOutline[j][0], 10.9, basilicaOutline[j][1]]),
        'roof',
        C.roof,
        [0, 1, 0],
      );
  } else prism(o, c, basilicaOutline, 10.65, 10.9, 'roof', C.roof);
  // Complete native perimeter; the pictured front and plaza side are separately pierced below.
  for (let i = 0; i < basilicaOutline.length; i++) {
    const a = basilicaOutline[i],
      b = basilicaOutline[(i + 1) % basilicaOutline.length];
    if ((a[0] < -17.8 && b[0] < -17.8) || (a[1] > 26.3 && b[1] > 26.3)) continue;
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (d < 0.15) continue;
    beam(adapter(o, c), 'wall', [a[0], 5.6, a[1]], [b[0], 5.6, b[1]], 0.55, 10.6, C.wall);
  }
  const plaza = sidePoint(-18, 0, -1);
  holeWall(o, c, { left: -26.8, right: -10, bottom: 0.3, top: 11.2, point: plaza });
  portal(o, c, ([u, y, v]) => plaza([u - 4.5, y, v]), 11, 17.3);
  for (const z of [5, 13, 21]) {
    const p = ([u, y, v]) => plaza([u + z, y, v]),
      hole = circleProfile(0, 7.1, 0.82, c.round, true);
    holeWall(o, c, {
      left: -4,
      right: 4,
      bottom: 0.3,
      top: 11.2,
      point: p,
      holes: c.detail ? [hole] : [],
    });
    frame(o, c, hole, p, 0.2);
    if (c.detail) {
      const t = transform(o, p);
      T(
        t,
        c,
        [
          [-4, 11.2, 0],
          [0, 12.7, 0],
          [4, 11.2, 0],
        ],
        'wall',
        C.wall,
        [0, 0, 1],
      );
    }
  }
  holeWall(o, c, { left: 25, right: 26.92, bottom: 0.3, top: 11.2, point: plaza });
  for (const [point, sign] of [
    [sidePoint(-11.1, 0, -1), -1],
    [sidePoint(0.4, 0, 1), 1],
  ]) {
    const holes = c.detail
      ? [5, 14].map((z) => archProfile(sign < 0 ? z : -z, 14.1, 1.25, 3.3, c.arch))
      : [];
    holeWall(o, c, { left: -24.5, right: 24.5, bottom: 0.3, top: 18.3, point, holes });
  }
  box(o, c, -11.1, 0.4, 0.3, 18.3, -25.0, -24.5);
  box(o, c, -11.1, 0.4, 0.3, 18.3, 24.5, 25.0);
  gable(o, c, -11.6, 0.9, -25.5, 25.3, 18.3, 21.25);
  hip(o, c, -18.3, -10.6, -25.8, 25.8, 11.25, 13.35);
  hip(o, c, -0.1, 7.5, -25.3, 23.0, 11.25, 13.35);
  // Side portal gable breaks the aisle roof, as in the whole plaza-side picture.
  const side = transform(o, ([u, y, v]) => plaza([u - 4.5, y, v]));
  gable(side, c, -5.5, 5.5, -12.7, 0, 17.3, 20.2);
  T(
    side,
    c,
    [
      [-5.5, 17.3, 0],
      [0, 20.2, 0],
      [5.5, 17.3, 0],
    ],
    'stone',
    C.stone,
    [0, 0, 1],
  );
  if (c.detail) {
    beam(adapter(side, c), 'stone', [-6, 17.5, 0.15], [0, 20.7, 0.15], 0.28, 0.28, C.stone);
    beam(adapter(side, c), 'stone', [0, 20.7, 0.15], [6, 17.5, 0.15], 0.28, 0.28, C.stone);
  }
  gable(o, c, -11.35, 0.85, 24.5, 26.92, 20.2, 24.2);
  front(o, c);
  tower(o, c, -13.6, 23.0);
  tower(o, c, 3.0, 23.0);
  tower(o, c, -14.1, -21.5, true);
  box(o, c, -12.0, 1.3, 18.3, 24.2, -19, -5.6);
  hip(o, c, -12.5, 1.8, -19.5, -5.1, 24.2, 26.2);
  const R = 4.4,
    center = [-5.35, -12.3],
    ring = Array.from({ length: 8 }, (_, i) => [
      center[0] + R * Math.cos(Math.PI / 8 + (i * Math.PI) / 4),
      center[1] + R * Math.sin(Math.PI / 8 + (i * Math.PI) / 4),
    ]);
  for (const [y, N] of [
    [26.2, [0, -1, 0]],
    [29.4, [0, 1, 0]],
  ])
    for (let i = 1; i < 7; i++)
      T(
        o,
        c,
        [ring[0], ring[i], ring[i + 1]].map((p) => [p[0], y, p[1]]),
        'wall',
        C.wall,
        N,
      );
  for (let f = 0; f < 8; f++) {
    const a = ring[f],
      b = ring[(f + 1) % 8],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      n = [u[1], -u[0]],
      point = ([U, y, V]) => [
        (a[0] + b[0]) / 2 + u[0] * U + n[0] * V,
        y,
        (a[1] + b[1]) / 2 + u[1] * U + n[1] * V,
      ],
      holes = c.detail
        ? c === cfg.district
          ? [archProfile(0, 26.65, 1.5, 1.9, c.arch)]
          : [-0.9, 0, 0.9].map((U) => archProfile(U, 26.65, 0.5, 1.9, c.arch))
        : [];
    holeWall(o, c, {
      left: -L / 2,
      right: L / 2,
      bottom: 26.2,
      top: 29.4,
      point,
      holes,
      depth: 0.3,
    });
  }
  for (let i = 0; i < 8; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 8];
    T(
      o,
      c,
      [
        [a[0], 29.4, a[1]],
        [b[0], 29.4, b[1]],
        [center[0], 30.8, center[1]],
      ],
      'roof',
      C.roof,
      [0, 1, 0],
    );
  }
  if (c === cfg.skyline)
    Q(
      o,
      c,
      [
        [center[0] - 0.06, 30.8, center[1]],
        [center[0] + 0.06, 30.8, center[1]],
        [center[0] + 0.06, 31.9, center[1]],
        [center[0] - 0.06, 31.9, center[1]],
      ],
      'metal',
      C.metal,
      [0, 0, 1],
    );
  else crossMark(o, c, center[0], 30.8, center[1], 1.1);
  if (c.fine) {
    for (const z of [2, 9, 17, 25])
      box(o, c, -18.26, -17.93, 0.3, 11.4, z - 0.14, z + 0.14, 'stone', C.stone);
    for (const y of [2.8, 10.6, 11.1])
      beam(adapter(o, c), 'stone', [-18.18, y, -25.9], [-18.18, y, 26.3], 0.12, 0.12, C.stone);
  }
}
export const buildBasilicaSkyline = (o) => buildBasilicaLevel(o, 'skyline');
export const buildBasilicaDistrict = (o) => buildBasilicaLevel(o, 'district');
export const buildBasilicaStreet = (o) => buildBasilicaLevel(o, 'street');
export const buildBasilicaCloseup = (o) => buildBasilicaLevel(o, 'closeup');

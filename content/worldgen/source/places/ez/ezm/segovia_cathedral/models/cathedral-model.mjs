/** Original complete principal Segovia Cathedral;shared textures andexplicit source/browser tiers. */
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
  wall: lin('d7c7a7'),
  stone: lin('e0d2b6'),
  edge: lin('e4d6bd'),
  base: lin('b9ae98'),
  roof: lin('a76f54'),
  roofEdge: lin('b47f5e'),
  slate: lin('65717b'),
  wood: lin('705641'),
  metal: lin('535959'),
  glass: lin('657486'),
};
export const cathedralSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.92 },
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.9 },
  base: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.83 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.82 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.87 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.85, metallic: 0.1 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.45 },
};
const cfg = {
  skyline: { arch: 2, round: 6, dome: 2 },
  district: { arch: 4, round: 8, dome: 4, detail: true },
  street: { arch: 4, round: 12, dome: 6, detail: true, fine: true },
  closeup: { arch: 20, round: 32, dome: 16, detail: true, fine: true, near: true },
  master: { arch: 48, round: 64, dome: 32, detail: true, fine: true, near: true, master: true },
};
export const cathedralPlan = [
  [
    [45.131663, 56.563606],
    [43.699114, 55.12584],
    [37.958489, 55.115404],
    [37.955013, 57.028945],
    [35.084702, 57.023726],
    [35.24735, 55.269937],
    [30.303746, 55.420409],
    [30.30085, 57.015026],
    [27.43054, 57.009806],
    [27.273684, 55.574361],
    [24.403374, 55.56914],
    [0.323807, 56.003715],
    [-0.79387, 56.798991],
    [-1.909811, 56.637498],
    [-2.546499, 55.998491],
    [-10.360398, 56.143729],
    [-11.318324, 56.779832],
    [-13.071531, 56.298255],
    [-25.350343, 56.435357],
    [-26.62719, 57.070878],
    [-27.901723, 56.43071],
    [-33.164233, 56.580586],
    [-36.513208, 56.733946],
    [-37.151631, 57.051707],
    [-38.26757, 56.890212],
    [-39.064008, 56.410376],
    [-39.220868, 54.974934],
    [-46.876738, 55.917755],
    [-47.034176, 54.801236],
    [-48.148958, 54.001896],
    [-48.944241, 52.884216],
    [-48.941351, 51.289604],
    [-47.662771, 49.697317],
    [-45.588909, 49.222711],
    [-45.770095, -26.681531],
    [-48.161732, -26.845342],
    [-47.993291, -31.788367],
    [-44.963806, -31.623397],
    [-43.681158, -35.448161],
    [-40.798674, -42.140343],
    [-28.82134, -51.845797],
    [-22.122192, -52.790407],
    [-21.642935, -53.267925],
    [-17.975015, -53.420727],
    [-15.26967, -50.386024],
    [-14.472649, -50.225114],
    [-10.642655, -51.812788],
    [-6.182935, -48.934362],
    [-4.269968, -48.611964],
    [18.22961, -57.022672],
    [28.544443, -29.41687],
    [39.54822, -29.875295],
    [39.391951, -31.629671],
    [40.031543, -32.585289],
    [41.308404, -33.220824],
    [42.105426, -33.059916],
    [43.060459, -32.101406],
    [43.054651, -28.912156],
    [44.490104, -29.069015],
    [44.621407, -13.600872],
    [11.452103, -13.023236],
    [11.449783, -11.747539],
    [8.738638, -11.593001],
    [8.875777, 0.685864],
    [10.151472, 0.688182],
    [10.308326, 2.12363],
    [48.8999, 1.236937],
    [49.201997, 10.486326],
    [48.245223, 10.484589],
    [48.986568, 41.262219],
    [47.551701, 41.10015],
    [46.271368, 43.649223],
    [46.09307, 54.013956],
    [46.729179, 54.971886],
  ],
  [
    [13.59415, 36.732939],
    [37.354252, 36.61667],
    [37.237984, 12.856541],
    [13.637028, 13.132589],
  ],
];
export const towerPlan = [
  [9.732327, 55.861375],
  [9.921029, 39.756041],
  [27.620993, 39.947689],
  [27.273684, 55.574361],
];
export const towerCenter = [18.67666, 47.808708],
  domeCenter = [-19, -13],
  cloisterCenter = [25.5, 25];
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
  const vector = (v) => {
    const a = point([0, 0, 0]),
      b = point(v);
    return b.map((x, i) => x - a[i]);
  };
  return {
    addTriangle: (slot, ref, points, normal, uv, color) => {
      const p = points.map((p) => point(p).map(Math.fround)),
        expected = vector(normal),
        N = cross(sub(p[1], p[0]), sub(p[2], p[0]));
      // Rotate first,thencheck the actual exported Float32 representation. Skinny curved-window
      // triangles can change winding during world-coordinate rounding.
      if (Math.hypot(...N) < 1e-8) return;
      if (N.reduce((s, v, i) => s + v * expected[i], 0) < 0) {
        p.reverse();
        uv = [...uv].reverse();
      }
      o.addTriangle(slot, ref, p, expected, uv, color);
    },
  };
}
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
  if (!c.master) {
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
  if (c !== cfg.skyline) Q(o, c, [a, d, e, b], s, C.roof, [0, -1, 0]);
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
    for (const N of [
      [0, 0, 1],
      [0, 0, -1],
    ])
      Q(
        o,
        c,
        [
          [x - 0.06, y, z],
          [x + 0.06, y, z],
          [x + 0.06, y + h, z],
          [x - 0.06, y + h, z],
        ],
        'metal',
        C.metal,
        N,
      );
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
const frontPoint =
  (x, z) =>
  ([u, y, v]) => [x + u, y, z + v];
function area(r) {
  return r.reduce((s, a, i) => {
    const b = r[(i + 1) % r.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
}
function simplify(r, tol) {
  const a = r.slice();
  let changed = true;
  while (changed && a.length > 4) {
    changed = false;
    for (let i = 0; i < a.length; i++) {
      const p = a[(i + a.length - 1) % a.length],
        q = a[i],
        r = a[(i + 1) % a.length],
        dx = r[0] - p[0],
        dz = r[1] - p[1],
        t = Math.max(
          0,
          Math.min(1, ((q[0] - p[0]) * dx + (q[1] - p[1]) * dz) / (dx * dx + dz * dz || 1)),
        ),
        dist = Math.hypot(q[0] - p[0] - t * dx, q[1] - p[1] - t * dz);
      if (dist < tol) {
        a.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return a;
}
function planSlab(o, c, rings, y0, y1, s = 'base', col = C.base, shell = false) {
  const flat = rings.flat(),
    starts = rings.slice(1).map((_, i) => rings.slice(0, i + 1).reduce((n, r) => n + r.length, 0)),
    ids = earcut(flat.flat(), starts);
  for (let i = 0; i < ids.length; i += 3)
    for (const [y, N] of shell && s === 'roof'
      ? [[y1, [0, 1, 0]]]
      : [
          [y1, [0, 1, 0]],
          [shell ? y1 : y0, [0, -1, 0]],
        ])
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => [flat[j][0], y, flat[j][1]]),
        s,
        col,
        N,
      );
  if (shell) return;
  for (let k = 0; k < rings.length; k++) {
    const r = rings[k],
      A = area(r) * (k ? -1 : 1);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length],
        N = A > 0 ? [b[1] - a[1], 0, a[0] - b[0]] : [a[1] - b[1], 0, b[0] - a[0]];
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
        N,
      );
    }
  }
}
function pointFace(x, z, n) {
  const u = [n[1], -n[0]];
  return ([U, y, V]) => [x + u[0] * U + n[0] * V, y, z + u[1] * U + n[1] * V];
}
function pointed(u, bottom, w, h, n) {
  const R = w / 2,
    spring = bottom + h * 0.48,
    a = [
      [u - R, bottom],
      [u + R, bottom],
    ];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    a.push([u + R * (1 - t) * (1 - t), spring + (bottom + h - spring) * t]);
  }
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    a.push([u - R * t * t, bottom + h - (bottom + h - spring) * t]);
  }
  return a;
}
function faceRect(
  o,
  c,
  { point, left, right, bottom = 0.3, top, holes = [], backing = 'glass', depth = 0.65 },
) {
  if ((c === cfg.skyline || c === cfg.district) && backing !== false) {
    const t = transform(o, point);
    if (c === cfg.skyline || c === cfg.district) {
      const ps = [
        [left, bottom, 0],
        [right, bottom, 0],
        [right, top, 0],
        [left, top, 0],
      ];
      for (const N of [
        [0, 0, 1],
        [0, 0, -1],
      ])
        Q(t, c, ps, 'wall', C.wall, N);
    } else box(t, c, left, right, bottom, top, -depth, 0, 'wall', C.wall);
    for (const r of holes) {
      const surface = r.backing ?? backing,
        col =
          surface === 'wood'
            ? C.wood
            : surface === 'wall'
              ? C.wall
              : surface === 'stone'
                ? C.stone
                : C.glass,
        ids = earcut(r.flat());
      for (let i = 0; i < ids.length; i += 3)
        T(
          t,
          c,
          ids.slice(i, i + 3).map((j) => [...r[j], 0.015]),
          surface,
          col,
          [0, 0, 1],
        );
    }
    return;
  }
  holeWall(o, c, { left, right, bottom, top, point, holes, backing, depth });
  if (c.detail) for (const r of holes) frame(o, c, r, point, 0.13, 'stone', C.stone);
}
function taper(o, c, x, z, y0, y1, r0, r1, s = 'stone', col = C.stone, n = c.round) {
  const ring = (r, y) =>
      Array.from({ length: n }, (_, i) => {
        const a = ((i + 0.5) * 2 * Math.PI) / n;
        return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
      }),
    a = ring(r0, y0),
    b = ring(r1, y1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    Q(o, c, [a[i], a[j], b[j], b[i]], s, col, [
      Math.cos(((i + 1) * 2 * Math.PI) / n),
      0,
      Math.sin(((i + 1) * 2 * Math.PI) / n),
    ]);
  }
  for (const [r, N] of [
    [a, [0, -1, 0]],
    [b, [0, 1, 0]],
  ])
    for (let i = 1; i < n - 1; i++) T(o, c, [r[0], r[i], r[i + 1]], s, col, N);
}
function pinnacle(o, c, x, z, y, h = 5, r = 0.65) {
  if (c === cfg.skyline || c === cfg.district) {
    taper(o, c, x, z, y, y + h, r, 0.04, 'stone', C.stone, 3);
    return;
  }
  taper(o, c, x, z, y, y + h * 0.38, r, r * 0.75, 'stone', C.stone, 4);
  taper(o, c, x, z, y + h * 0.38, y + h, r * 0.95, 0.03, 'stone', C.stone, 4);
  if (c.near)
    for (let Y = y + h * 0.4; Y < y + h * 0.9; Y += c.master ? 0.5 : 1)
      for (const sign of [-1, 1])
        beam(
          adapter(o, c),
          'stone',
          [x, Y, z],
          [x + (sign * r * 0.8 * (y + h - Y)) / h, Y + 0.2, z],
          0.11,
          0.11,
          C.stone,
        );
}
function dome(o, c, x, z, y, R, H, s = 'stone') {
  const n = c === cfg.skyline ? 8 : c.round,
    rows = c.dome;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const p = (J, I) => {
        const t = ((J / rows) * Math.PI) / 2,
          a = (I / n) * 2 * Math.PI;
        return [
          x + R * Math.cos(t) * Math.cos(a),
          y + H * Math.sin(t),
          z + R * Math.cos(t) * Math.sin(a),
        ];
      };
      Q(
        o,
        c,
        [p(j, i), p(j, i + 1), p(j + 1, i + 1), p(j + 1, i)],
        s,
        s === 'slate' ? C.slate : C.stone,
        [Math.cos(((i + 0.5) * 2 * Math.PI) / n), 0.5, Math.sin(((i + 0.5) * 2 * Math.PI) / n)],
      );
    }
  const ring = Array.from({ length: n }, (_, i) => [
    x + R * Math.cos((i * 2 * Math.PI) / n),
    y,
    z + R * Math.sin((i * 2 * Math.PI) / n),
  ]);
  for (let i = 1; i < n - 1; i++)
    T(o, c, [ring[0], ring[i], ring[i + 1]], s, s === 'slate' ? C.slate : C.stone, [0, -1, 0]);
  if (c.fine) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        ps = Array.from({ length: rows + 1 }, (_, j) => {
          const t = ((j / rows) * Math.PI) / 2;
          return [
            x + (R + 0.035) * Math.cos(t) * Math.cos(a),
            y + (H + 0.035) * Math.sin(t),
            z + (R + 0.035) * Math.cos(t) * Math.sin(a),
          ];
        });
      beamPath(adapter(o, c), 'stone', ps, 0.12, 0.12, C.stone);
    }
  }
}
function drum(o, c, x, z, R, y0, y1, { open = false, glazed = true } = {}) {
  if (c === cfg.skyline) {
    taper(o, c, x, z, y0, y1, R, R, 'stone', C.stone, R < 2 ? 4 : 8);
    return;
  }
  const n = 8,
    ring = Array.from({ length: n }, (_, i) => [
      x + R * Math.cos(Math.PI / 8 + (i * Math.PI) / 4),
      z + R * Math.sin(Math.PI / 8 + (i * Math.PI) / 4),
    ]);
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      N = [u[1], -u[0]],
      point = ([U, y, V]) => [
        (a[0] + b[0]) / 2 + u[0] * U + N[0] * V,
        y,
        (a[1] + b[1]) / 2 + u[1] * U + N[1] * V,
      ],
      holes =
        c === cfg.skyline
          ? []
          : [
              archProfile(
                0,
                Math.max(y0 + 0.3, y1 - 6.3),
                L * 0.48,
                Math.min(6, y1 - y0 - 0.6),
                c.arch,
              ),
            ];
    faceRect(o, c, {
      point,
      left: -L / 2,
      right: L / 2,
      bottom: y0,
      top: y1,
      holes,
      backing: open ? false : glazed ? 'glass' : 'wall',
      depth: 0.4,
    });
  }
  for (const [y, N] of [
    [y0, [0, -1, 0]],
    [y1, [0, 1, 0]],
  ])
    for (let i = 1; i < 7; i++)
      T(
        o,
        c,
        [ring[0], ring[i], ring[i + 1]].map((p) => [p[0], y, p[1]]),
        'stone',
        C.stone,
        N,
      );
}
function lowReturns(o, c) {
  const ring = simplify(
    cathedralPlan[0],
    c === cfg.skyline ? 1.2 : c === cfg.district ? 0.5 : 0.12,
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      x = (a[0] + b[0]) / 2,
      z = (a[1] + b[1]) / 2,
      L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (
      (x > -46.4 && x < 9.2 && z > -32 && z < 57.3) ||
      (x > 9 && x < 29 && z > 39) ||
      (Math.hypot(x + 19, z + 24) < 27.5 && z < -24)
    )
      continue;
    const N =
        area(ring) > 0
          ? [(b[1] - a[1]) / L, 0, (a[0] - b[0]) / L]
          : [(a[1] - b[1]) / L, 0, (b[0] - a[0]) / L],
      point = pointFace(x, z, [N[0], N[2]]),
      holes =
        c.near && L > 9
          ? Array.from({ length: Math.floor(L / 6) }, (_, j) =>
              archProfile(-L / 2 + ((j + 0.5) * L) / Math.floor(L / 6), 5.5, 1.6, 4.5, c.arch),
            )
          : [];
    faceRect(o, c, { point, left: -L / 2, right: L / 2, top: 14.3, holes });
  }
}
function nave(o, c) {
  for (const [x, sign] of [
    [-31, -1],
    [-7, 1],
  ]) {
    const p = pointFace(x, 0, [sign, 0]),
      holes = c.detail
        ? [-8, 8, 24, 40].map((z) => pointed(sign < 0 ? z : -z, 24.5, 3.2, 6.8, c.arch))
        : [];
    faceRect(o, c, {
      point: p,
      left: sign < 0 ? -24 : -55.8,
      right: sign < 0 ? 55.8 : 24,
      top: 33.5,
      holes,
    });
  }
  for (const [x0, x1, xx, sign] of [
    [-45.8, -30.6, -45.8, -1],
    [-7.4, 8.9, 8.9, 1],
  ]) {
    const p = pointFace(xx, 0, [sign, 0]),
      A = sign < 0 ? -26 : -55.8,
      B = sign < 0 ? 55.8 : 26,
      holes = c.detail
        ? [-18, -2, 14, 30, 46].map((z) => pointed(sign < 0 ? z : -z, 9, 3.8, 8, c.arch))
        : [];
    faceRect(o, c, { point: p, left: A, right: B, top: 20.6, holes });
    hip(o, c, x0, x1, -26, 55.8, 20.6, 24.0);
  }
  gable(o, c, -31.5, -6.5, -25.8, 56.0, 33.5, 38.6);
  for (const [x0, x1, h, door] of [
    [-45.8, -31, 20.6, -38.4],
    [-31, -7, 33.5, -19],
    [-7, 8.9, 20.6, 0.95],
  ]) {
    const point = frontPoint(0, 55.8),
      d = archProfile(door, 0.3, h > 30 ? 4.8 : 3.4, h > 30 ? 8.5 : 6, c.arch);
    d.backing = 'wood';
    const holes = [d];
    if (c.detail)
      holes.push(
        archProfile(
          (x0 + x1) / 2,
          h > 30 ? 24.0 : 10.8,
          h > 30 ? 5.5 : 3.4,
          h > 30 ? 7.3 : 6,
          c.arch,
        ),
      );
    faceRect(o, c, { point, left: x0, right: x1, top: h, holes, backing: 'glass', depth: 0.9 });
  }
  if (c.fine)
    for (const x of [-31, -7]) {
      box(o, c, x - 0.5, x + 0.5, 20.6, 35.4, 55.7, 56.8, 'stone', C.stone);
      pinnacle(o, c, x, 56.1, 35.4, 5.5, 0.7);
    }
}
function flyingButtresses(o, c) {
  const zs = c === cfg.skyline ? [0, 52] : [-20, -4, 12, 28, 52];
  for (const sign of [-1, 1])
    for (const z of zs) {
      const outer = sign < 0 ? -45.8 : 8.9,
        inner = sign < 0 ? -31 : -7;
      box(o, c, outer - 1, outer + 1, 0.3, 23.5, z - 0.8, z + 0.8, 'stone', C.stone);
      pinnacle(o, c, outer, z, 23.5, 6.5, 0.65);
      if (c === cfg.district)
        beam(adapter(o, c), 'stone', [outer, 23.3, z], [inner, 31.6, z], 0.9, 0.9, C.stone);
      else if (c.detail)
        beamPath(
          adapter(o, c),
          'stone',
          [
            [outer, 23.3, z],
            [outer + (inner - outer) * 0.32, 26.9, z],
            [inner + (outer - inner) * 0.18, 30.3, z],
            [inner, 31.6, z],
          ],
          0.9,
          0.9,
          C.stone,
        );
      if (c.near) {
        box(o, c, outer - 1.3, outer + 1.3, 0.3, 12, z - 1.1, z + 1.1, 'stone', C.stone);
        pinnacle(o, c, inner, z, 34.1, 4.2, 0.5);
      }
    }
}
function apse(o, c) {
  const center = [-19, -24],
    n = c === cfg.skyline ? 6 : c === cfg.district ? 8 : 12;
  for (const [R, top, ridge] of c === cfg.skyline
    ? [
        [26, 17.5, 20.5],
        [12, 33.5, 36.0],
      ]
    : [
        [26, 17.5, 20.5],
        [18, 27.5, 30.5],
        [12, 33.5, 36.0],
      ]) {
    const ring = Array.from({ length: n + 1 }, (_, i) => [
      center[0] + R * Math.cos((i * Math.PI) / n),
      center[1] - R * Math.sin((i * Math.PI) / n),
    ]);
    for (let i = 0; i < n; i++) {
      const a = ring[i],
        b = ring[i + 1],
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        u = [(a[0] - b[0]) / L, (a[1] - b[1]) / L],
        N = [u[1], -u[0]],
        p = ([U, y, V]) => [
          (a[0] + b[0]) / 2 + u[0] * U + N[0] * V,
          y,
          (a[1] + b[1]) / 2 + u[1] * U + N[1] * V,
        ],
        holes = c.detail ? [pointed(0, top - 9, Math.min(2.8, L * 0.42), 6.5, c.arch)] : [];
      faceRect(o, c, { point: p, left: -L / 2, right: L / 2, top, holes });
      T(
        o,
        c,
        [
          [a[0], top, a[1]],
          [b[0], top, b[1]],
          [center[0], ridge, center[1]],
        ],
        'roof',
        C.roof,
        [0, 1, 0],
      );
    }
    Q(
      o,
      c,
      [
        [center[0] - R, 0.3, center[1]],
        [center[0] - R, top, center[1]],
        [center[0] + R, top, center[1]],
        [center[0] + R, 0.3, center[1]],
      ],
      'wall',
      C.wall,
      [0, 0, 1],
    );
    for (let i = 1; i < n; i++)
      T(
        o,
        c,
        [
          [ring[0][0], top, ring[0][1]],
          [ring[i][0], top, ring[i][1]],
          [ring[i + 1][0], top, ring[i + 1][1]],
        ],
        'roof',
        C.roof,
        [0, -1, 0],
      );
  }
  if (c.detail)
    for (let i = 0; i <= 6; i++) {
      const a = (i * Math.PI) / 6,
        x = center[0] + 26 * Math.cos(a),
        z = center[1] - 26 * Math.sin(a);
      box(o, c, x - 0.7, x + 0.7, 0.3, 25, z - 0.7, z + 0.7, 'stone', C.stone);
      pinnacle(o, c, x, z, 25, 7, 0.75);
    }
}
function crossing(o, c) {
  const [x, z] = domeCenter;
  box(o, c, x - 10.5, x + 10.5, 33.5, 42.5, z - 10.5, z + 10.5);
  if (c.detail)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) pinnacle(o, c, x + sx * 10, z + sz * 10, 42.5, 5.5, 0.75);
  drum(o, c, x, z, 9.5, 42.5, 47.5);
  dome(o, c, x, z, 47.5, 9.5, 9.5);
  drum(o, c, x, z, 1.4, 57, 60, { open: c.fine });
  taper(o, c, x, z, 60, 61.0, 1.7, 0.05, 'stone', C.stone, c === cfg.skyline ? 4 : 8);
  crossMark(o, c, x, 61, z, 1.0);
}
function greatTower(o, c) {
  const [x, z] = towerCenter,
    x0 = 9.73,
    x1 = 27.62,
    z0 = 39.75,
    z1 = 55.86,
    W = x1 - x0,
    D = z1 - z0;
  for (let face = 0; face < 4; face++) {
    const N = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ][face],
      w = face % 2 ? D : W,
      p = pointFace(x + N[0] * (W / 2), z + N[1] * (D / 2), N),
      holes = c.near
        ? [18, 35, 51].flatMap((y) =>
            [-w * 0.24, w * 0.24].map((u) => archProfile(u, y, 2.1, 8.5, c.arch)),
          )
        : [];
    for (const r of holes) r.backing = 'wall';
    if (c.fine && !c.near)
      for (const y of [18, 35, 51])
        for (const u of [-w * 0.24, w * 0.24])
          frame(o, c, archProfile(u, y, 2.1, 8.5, c.arch), p, 0.13, 'stone', C.stone);
    faceRect(o, c, { point: p, left: -w / 2, right: w / 2, top: 64, holes, backing: 'wall' });
    const opening = archProfile(0, 65.0, 7.1, 11.2, c.arch);
    faceRect(o, c, {
      point: p,
      left: -w / 2,
      right: w / 2,
      bottom: 64,
      top: 78,
      holes: [opening],
      backing: false,
      depth: 1,
    });
    if (c.near)
      for (const y of [15.5, 32.5, 49, 63.8, 77.8]) {
        const t = transform(o, p);
        box(t, c, -w / 2, w / 2, y, y + 0.24, 0, 0.25, 'stone', C.stone);
      }
  }
  box(o, c, x0 - 0.2, x1 + 0.2, 63.6, 64, z0 - 0.2, z1 + 0.2, 'stone', C.stone);
  box(o, c, x0 - 0.5, x1 + 0.5, 78, 78.5, z0 - 0.5, z1 + 0.5, 'stone', C.stone);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      if (c.detail) pinnacle(o, c, x + sx * (W / 2 - 0.6), z + sz * (D / 2 - 0.6), 64, 17, 0.5);
    }
  drum(o, c, x, z, 7.8, 78.5, 82, { open: c.fine });
  dome(o, c, x, z, 82, 7.8, 5.5);
  taper(o, c, x, z, 87.5, 89.2, 1.25, 0.05, 'stone', C.stone, c === cfg.skyline ? 4 : 8);
  crossMark(o, c, x, 89.2, z, 0.8);
}
function portalTurret(o, c) {
  const x = -43.7,
    z = -29.2;
  if (c === cfg.skyline) {
    taper(o, c, x, z, 0.3, 28, 4.3, 4.3, 'stone', C.stone, 6);
    taper(o, c, x, z, 28, 32.5, 4.7, 1.5, 'slate', C.slate, 6);
    taper(o, c, x, z, 32.5, 44, 1.5, 0.04, 'slate', C.slate, 4);
    return;
  }
  drum(o, c, x, z, 4.3, 0.3, 28.0, { glazed: true });
  taper(o, c, x, z, 28, 32.5, 4.7, 1.5, 'slate', C.slate, c === cfg.skyline ? 6 : 8);
  drum(o, c, x, z, 1.5, 32.5, 38.0, { open: c.fine });
  taper(o, c, x, z, 38, 43, 1.8, 0.05, 'slate', C.slate, c === cfg.skyline ? 4 : 8);
  crossMark(o, c, x, 43, z, 1);
}
function cloister(o, c) {
  const x0 = 13.594,
    x1 = 37.354,
    z0 = 12.856,
    z1 = 36.733,
    holes = (L) =>
      c.detail
        ? Array.from({ length: c === cfg.district ? 2 : 5 }, (_, i) => {
            const n = c === cfg.district ? 2 : 5;
            return pointed(
              -L / 2 + ((i + 0.5) * L) / n,
              4.1,
              c === cfg.district ? 7.5 : 3.0,
              7.7,
              c.arch,
            );
          })
        : [];
  for (const [p, L] of [
    [pointFace(x0, (z0 + z1) / 2, [1, 0]), z1 - z0],
    [pointFace(x1, (z0 + z1) / 2, [-1, 0]), z1 - z0],
    [pointFace((x0 + x1) / 2, z0, [0, 1]), x1 - x0],
    [pointFace((x0 + x1) / 2, z1, [0, -1]), x1 - x0],
  ])
    faceRect(o, c, {
      point: p,
      left: -L / 2,
      right: L / 2,
      top: 14.3,
      holes: holes(L),
      backing: false,
    });
  // Approximate stepped cloister passage grade from the unchanged standard field.
  // These four occupied floors leave the native courtyard completely open.
  if (c.detail) {
    box(o, c, 8.9, x0, 0.3, 4.1, z0, z1, 'base', C.base);
    box(o, c, x1, 49.05, 0.3, 4.1, z0, z1, 'base', C.base);
    box(o, c, 8.9, 49.05, 0.3, 4.1, z1, 55.2, 'base', C.base);
    box(o, c, 8.9, 44.5, 0.3, 4.1, 1.2, z0, 'base', C.base);
  }
  hip(o, c, 8.9, x0, z0, z1, 14.3, 16.4);
  hip(o, c, x1, 49.05, 1.2, 55.2, 14.3, 18.0);
  hip(o, c, 8.9, 49.05, z1, 55.2, 14.3, 18.5, 'x');
  hip(o, c, 8.9, 44.5, 1.2, z0, 14.3, 17.0, 'x');
}
export function buildCathedralLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown cathedral tier ' + level);
  planSlab(o, c, cathedralPlan, -8, 0.3, 'base', C.base, c === cfg.skyline);
  if (c === cfg.skyline) {
    const r = cathedralPlan.map((p) => simplify(p, 0.3));
    planSlab(o, c, r, 14, 14.2, 'roof', C.roof, true);
  } else planSlab(o, c, cathedralPlan, 14, 14.25, 'roof', C.roof);
  lowReturns(o, c);
  nave(o, c);
  apse(o, c);
  flyingButtresses(o, c);
  crossing(o, c);
  greatTower(o, c);
  portalTurret(o, c);
  cloister(o, c);
  if (c.detail) pinnacle(o, c, -47.1, 52.2, 0.3, 36, 1.7);
}
export const buildCathedralSkyline = (o) => buildCathedralLevel(o, 'skyline');
export const buildCathedralDistrict = (o) => buildCathedralLevel(o, 'district');
export const buildCathedralStreet = (o) => buildCathedralLevel(o, 'street');
export const buildCathedralCloseup = (o) => buildCathedralLevel(o, 'closeup');

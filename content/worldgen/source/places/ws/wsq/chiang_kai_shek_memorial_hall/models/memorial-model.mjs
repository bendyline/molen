/** Original medium-fi Chiang Kai-shek Memorial Hall: complete principal exterior. */
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
  wall: lin('e5e1d4'),
  edge: lin('ede8d9'),
  base: lin('d2d0c4'),
  step: lin('babdb5'),
  joint: lin('acaea4'),
  inside: lin('6b6e66'),
  roof: lin('405f89'),
  ridge: lin('4d6c96'),
  beam: lin('b8c3b7'),
  finial: lin('b77b4c'),
};
export const memorialSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.9 },
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.88 },
  base: { slot: 'foundation', graph: 'stone_marble', roughness: 0.86 },
  roof: { slot: 'roof', graph: 'tile_glazed', roughness: 0.5 },
  beam: { slot: 'trim', graph: 'wood_plain', roughness: 0.85 },
  finial: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.7, metallic: 0.4 },
};
const cfg = {
  skyline: { arch: 4, steps: 4, edge: 1, radial: 2, finial: 6 },
  district: {
    arch: 8,
    steps: 15,
    edge: 2,
    radial: 4,
    finial: 12,
    posts: 12,
    brackets: 1,
    ridge: 2,
  },
  street: {
    arch: 16,
    steps: 45,
    edge: 4,
    radial: 8,
    finial: 24,
    posts: 5,
    brackets: 4,
    ridge: 5,
    joints: true,
  },
  closeup: {
    arch: 32,
    steps: 89,
    edge: 8,
    radial: 12,
    finial: 48,
    posts: 2.5,
    brackets: 7,
    ridge: 10,
    joints: true,
    fine: true,
  },
  master: {
    arch: 64,
    steps: 89,
    edge: 16,
    radial: 24,
    finial: 96,
    posts: 1.7,
    brackets: 12,
    ridge: 20,
    joints: true,
    fine: true,
    master: true,
  },
};
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
function archWall(o, c, { left, right, bottom, floor, top, spring, r, depth, point, s = 'wall' }) {
  const t = transform(o, point),
    col = s === 'base' ? C.base : C.wall;
  box(t, c, left, -r, bottom, top, -depth, 0, s, col);
  box(t, c, r, right, bottom, top, -depth, 0, s, col);
  if (bottom < floor) box(t, c, -r, r, bottom, floor, -depth, 0, s, col);
  box(t, c, -r, r, floor, top, -depth - 0.16, -depth + 0.02, s, C.inside);
  const ps = Array.from({ length: c.arch + 1 }, (_, i) => {
    const a = Math.PI - (i * Math.PI) / c.arch;
    return [r * Math.cos(a), spring + r * Math.sin(a)];
  });
  for (let i = 0; i < c.arch; i++) {
    const a = ps[i],
      b = ps[i + 1],
      ring = [
        [a[0], a[1]],
        [b[0], b[1]],
        [b[0], top],
        [a[0], top],
      ];
    for (const [z, N] of [
      [0, [0, 0, 1]],
      [-depth, [0, 0, -1]],
    ])
      Q(
        t,
        c,
        ring.map(([x, y]) => [x, y, z]),
        s,
        col,
        N,
      );
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
      [-(a[0] + b[0]) / 2, -((a[1] + b[1]) / 2 - spring), 0],
    );
    Q(
      t,
      c,
      [
        [a[0], top, 0],
        [a[0], top, -depth],
        [b[0], top, -depth],
        [b[0], top, 0],
      ],
      s,
      col,
      [0, 1, 0],
    );
  }
  if (c !== cfg.skyline) {
    const outer = r + 0.55;
    for (let i = 0; i < c.arch; i++) {
      const a = Math.PI - (i * Math.PI) / c.arch,
        b = Math.PI - ((i + 1) * Math.PI) / c.arch,
        P = (r, a) => [r * Math.cos(a), spring + r * Math.sin(a), 0.08];
      Q(t, c, [P(r, a), P(r, b), P(outer, b), P(outer, a)], s, C.edge, [0, 0, 1]);
    }
    for (const sign of [-1, 1])
      box(t, c, sign < 0 ? -outer : r, sign < 0 ? -r : outer, floor, spring, 0, 0.08, s, C.edge);
  }
}
export const memorialPodiumPlan = [
  [-62.28, -73.45],
  [62.34, -73.45],
  [62.34, 50.02],
  [20, 50.02],
  [20, 20],
  [-20, 20],
  [-20, 50.02],
  [-62.28, 50.02],
];
const corePlan = [
  [-14, 12.5],
  [14, 12.5],
  [24.5, 2],
  [24.5, -26],
  [14, -36.5],
  [-14, -36.5],
  [-24.5, -26],
  [-24.5, 2],
];
function clipBack(r, z) {
  const a = [];
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length],
      P = p[1] <= z,
      Q = q[1] <= z;
    if (P) a.push(p);
    if (P !== Q) {
      const t = (z - p[1]) / (q[1] - p[1]);
      a.push([p[0] + t * (q[0] - p[0]), z]);
    }
  }
  return a;
}
function batteredBox(o, c, x, z) {
  const lo = [
      [-6.2, -6.2],
      [6.2, -6.2],
      [6.2, 6.2],
      [-6.2, 6.2],
    ],
    hi = lo.map(([a, b]) => [a * 0.77, b * 0.77]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      c,
      [
        [x + lo[i][0], 14.5, z + lo[i][1]],
        [x + lo[j][0], 14.5, z + lo[j][1]],
        [x + hi[j][0], 34.1, z + hi[j][1]],
        [x + hi[i][0], 34.1, z + hi[i][1]],
      ],
      'wall',
      C.wall,
      [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i],
    );
  }
  Q(
    o,
    c,
    hi.map((p) => [x + p[0], 34.1, z + p[1]]),
    'wall',
    C.wall,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    lo.map((p) => [x + p[0], 14.5, z + p[1]]),
    'wall',
    C.wall,
    [0, -1, 0],
  );
  box(o, c, x - 5.15, x + 5.15, 34.1, 35, z - 5.15, z + 5.15, 'wall', C.edge);
}
const vertices = (R) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    return [R * Math.cos(a), R * Math.sin(a)];
  });
function roofPoint(upper, t, u, face) {
  const R = upper ? 26.5 : 29.4,
    inner = upper ? 0.7 : 9,
    r = inner + (R - inner) * t,
    v = vertices(1),
    a = v[face],
    b = v[(face + 1) % 8],
    X = (a[0] + (b[0] - a[0]) * u) * r,
    Z = (a[1] + (b[1] - a[1]) * u) * r,
    y =
      (upper ? 51 : 39) +
      (upper ? 19 : 8.3) * Math.pow(1 - t, 2) +
      (upper ? 2 : 1.6) * Math.pow(t, 8) * (1 + 0.5 * Math.pow(Math.abs(2 * u - 1), 4));
  return [X - 0.2, y, Z - 12];
}
function curvedRoof(o, c, upper) {
  for (let f = 0; f < 8; f++)
    for (let j = 0; j < c.radial; j++)
      for (let i = 0; i < c.edge; i++) {
        const t = j / c.radial,
          T = (j + 1) / c.radial,
          u = i / c.edge,
          U = (i + 1) / c.edge,
          p = [
            roofPoint(upper, t, u, f),
            roofPoint(upper, T, u, f),
            roofPoint(upper, T, U, f),
            roofPoint(upper, t, U, f),
          ],
          q = p.map((p) => [p[0], p[1] - 0.45, p[2]]);
        Q(o, c, p, 'roof', C.roof, [0, 1, 0]);
        Q(o, c, q, 'beam', C.beam, [0, -1, 0]);
        if (j === c.radial - 1) Q(o, c, [p[1], q[1], q[2], p[2]], 'roof', C.ridge);
        if (j === 0) Q(o, c, [p[0], p[3], q[3], q[0]], 'roof', C.roof);
      }
  if (upper) {
    const r = Array.from({ length: 8 }, (_, i) => roofPoint(true, 0, 0, i));
    for (let i = 1; i < 7; i++) {
      T(o, c, [r[0], r[i], r[i + 1]], 'roof', C.roof, [0, 1, 0]);
      T(
        o,
        c,
        [r[0], r[i], r[i + 1]].map((p) => [p[0], p[1] - 0.45, p[2]]),
        'beam',
        C.beam,
        [0, -1, 0],
      );
    }
  }
  if (c.ridge)
    for (let f = 0; f < 8; f++) {
      const p = Array.from({ length: c.ridge + 1 }, (_, i) => {
        const p = roofPoint(upper, i / c.ridge, 0, f);
        return [p[0], p[1] + 0.12, p[2]];
      });
      beamPath(adapter(o, c), 'roof', p, 0.24, 0.22, C.ridge);
    }
  if (c.brackets)
    for (let f = 0; f < 8; f++)
      for (let i = 0; i < c.brackets; i++) {
        const u = (i + 0.5) / c.brackets,
          tip = roofPoint(upper, 0.95, u, f),
          R = upper ? 18 : 23,
          a = vertices(1)[f],
          b = vertices(1)[(f + 1) % 8],
          dir = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u],
          low = upper ? 46.8 : 35.7;
        for (let k = 0; k < (c.fine ? 3 : 2); k++) {
          const q = [dir[0] * (R - k * 0.7) - 0.2, low + k * 0.85, dir[1] * (R - k * 0.7) - 12],
            end = [tip[0], tip[1] - 0.6 - k * 0.23, tip[2]];
          beam(adapter(o, c), 'beam', q, end, 0.35, 0.32, C.beam);
        }
      }
}
function finial(o, c) {
  const p = [
      [70, 0.9],
      [70.6, 1.5],
      [71.0, 1.1],
      [71.7, 1.6],
      [72.5, 2.1],
      [74.6, 1.85],
      [75.5, 1.1],
      [76, 0.15],
    ],
    n = c.finial;
  for (let j = 1; j < p.length; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n,
        P = (j, a) => [-0.2 + p[j][1] * Math.cos(a), p[j][0], -12 + p[j][1] * Math.sin(a)];
      Q(o, c, [P(j - 1, a), P(j - 1, b), P(j, b), P(j, a)], 'finial', C.finial, [
        Math.cos((a + b) / 2),
        0,
        Math.sin((a + b) / 2),
      ]);
    }
  for (const [j, N] of [
    [0, [0, -1, 0]],
    [p.length - 1, [0, 1, 0]],
  ])
    for (let i = 1; i < n - 1; i++)
      T(
        o,
        c,
        [0, i, i + 1].map((k) => [
          -0.2 + p[j][1] * Math.cos((k * 2 * Math.PI) / n),
          p[j][0],
          -12 + p[j][1] * Math.sin((k * 2 * Math.PI) / n),
        ]),
        'finial',
        C.finial,
        N,
      );
}
function railing(o, c, a, b, y) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (c === cfg.skyline) return;
  const n = Math.max(1, Math.ceil(L / c.posts));
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      x = a[0] + t * (b[0] - a[0]),
      z = a[1] + t * (b[1] - a[1]);
    box(o, c, x - 0.16, x + 0.16, y, y + 1.35, z - 0.16, z + 0.16, 'base', C.edge);
  }
  for (const h of [0.3, 1.05, 1.3])
    beam(adapter(o, c), 'base', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.18, 0.2, C.edge);
}
export function buildMemorialLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown memorial tier ' + level);
  // Closed podium with actual recessed side arches; central stair notch is not ground-masked.
  prism(o, c, memorialPodiumPlan, -10, 0, 'base', C.base);
  prism(o, c, memorialPodiumPlan, 10.6, 14.5, 'base', C.base);
  box(o, c, -58.28, 58.34, -10, 10.6, -69.45, 20, 'base', C.base);
  for (const sign of [-1, 1])
    box(o, c, sign < 0 ? -58.28 : 20, sign < 0 ? -20 : 58.34, -10, 10.6, 20, 46.02, 'base', C.base);
  box(o, c, -62.28, 62.34, -10, 10.6, -73.45, -69.45, 'base', C.base);
  for (const sign of [-1, 1])
    box(
      o,
      c,
      sign < 0 ? -62.28 : 20,
      sign < 0 ? -20 : 62.34,
      -10,
      10.6,
      46.02,
      50.02,
      'base',
      C.base,
    );
  for (const sign of [-1, 1])
    archWall(o, c, {
      left: sign > 0 ? -58.02 : -57.45,
      right: sign > 0 ? 57.45 : 58.02,
      bottom: 0,
      floor: 1.4,
      top: 10.6,
      spring: 7.2,
      r: 2.7,
      depth: 4,
      point: ([u, y, v]) => [sign * (sign < 0 ? 62.28 : 62.34) + sign * v, y, -12 - sign * u],
      s: 'base',
    });
  // Two complete flights and a closed central relief ramp; no copied relief imagery.
  for (let i = 0; i < c.steps; i++) {
    const z = 73.38 - (i * 53.38) / c.steps,
      y = ((i + 1) * 14.5) / c.steps;
    for (const [x0, x1] of [
      [-20, -7],
      [7, 20],
    ])
      box(o, c, x0, x1, -10, y, z - 53.38 / c.steps, z, 'base', C.step);
  }
  Q(
    o,
    c,
    [
      [-7, 0, 73.38],
      [7, 0, 73.38],
      [7, 14.5, 20],
      [-7, 14.5, 20],
    ],
    'base',
    C.edge,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [-7, -10, 73.38],
      [-7, 0, 73.38],
      [-7, 14.5, 20],
      [-7, -10, 20],
    ],
    'base',
    C.base,
    [-1, 0, 0],
  );
  Q(
    o,
    c,
    [
      [7, -10, 20],
      [7, 14.5, 20],
      [7, 0, 73.38],
      [7, -10, 73.38],
    ],
    'base',
    C.base,
    [1, 0, 0],
  );
  box(o, c, -7, 7, -10, -9.9, 20, 73.38, 'base', C.base);
  Q(
    o,
    c,
    [
      [-7, -10, 73.38],
      [7, -10, 73.38],
      [7, 0, 73.38],
      [-7, 0, 73.38],
    ],
    'base',
    C.base,
    [0, 0, 1],
  );
  Q(
    o,
    c,
    [
      [-7, -10, 20],
      [-7, 14.5, 20],
      [7, 14.5, 20],
      [7, -10, 20],
    ],
    'base',
    C.base,
    [0, 0, -1],
  );
  for (const x of [-20.4, 20.4]) {
    beam(adapter(o, c), 'base', [x, 0.9, 73.38], [x, 15.4, 20], 0.28, 0.35, C.edge);
    if (c.posts)
      for (let z = 21; z < 73; z += c.posts) {
        const y = ((73.38 - z) / 53.38) * 14.5;
        box(o, c, x - 0.18, x + 0.18, y, y + 1.3, z - 0.18, z + 0.18, 'base', C.edge);
      }
  }
  for (let i = 0; i < memorialPodiumPlan.length; i++)
    if (i !== 4)
      // Keep the entire stair landing open; rail only the side returns.
      railing(
        o,
        c,
        memorialPodiumPlan[i],
        memorialPodiumPlan[(i + 1) % memorialPodiumPlan.length],
        14.5,
      );
  // Whole upper octagonal mass; only the pictured front has the great arch.
  prism(o, c, clipBack(corePlan, 4.5), 14.5, 38.5);
  archWall(o, c, {
    left: -14,
    right: 14,
    bottom: 14.5,
    floor: 14.5,
    top: 38.5,
    spring: 25,
    r: 7.5,
    depth: 8,
    point: ([u, y, v]) => [u, y, 12.5 + v],
  });
  prism(
    o,
    c,
    [
      [-24.5, 2],
      [-22, 4.5],
      [-14, 12.5],
      [-14, 4.5],
    ],
    14.5,
    38.5,
  );
  prism(
    o,
    c,
    [
      [24.5, 2],
      [22, 4.5],
      [14, 12.5],
      [14, 4.5],
    ],
    14.5,
    38.5,
  );
  for (const x of [-18.4, 18.1]) for (const z of [-30.3, 6.3]) batteredBox(o, c, x, z);
  box(o, c, -2.8, 2.8, 33.6, 38.0, 12.51, 12.75, 'wall', C.edge);
  box(o, c, -2.2, 2.2, 34.1, 37.5, 12.751, 12.78, 'beam', C.finial);
  prism(
    o,
    c,
    vertices(15.4).map(([x, z]) => [x - 0.2, z - 12]),
    38.5,
    52,
    'beam',
    C.beam,
  );
  curvedRoof(o, c, false);
  curvedRoof(o, c, true);
  finial(o, c);
  if (c.joints) {
    for (let y = 15.5; y < 37.9; y += c.master ? 0.8 : 1.6)
      for (const sign of [-1, 1]) {
        const x0 = sign < 0 ? -13.95 : 7.55,
          x1 = sign < 0 ? -7.55 : 13.95;
        Q(
          o,
          c,
          [
            [x0, y - 0.014, 12.508],
            [x1, y - 0.014, 12.508],
            [x1, y + 0.014, 12.508],
            [x0, y + 0.014, 12.508],
          ],
          'wall',
          C.joint,
          [0, 0, 1],
        );
        Q(
          o,
          c,
          [
            [sign * 24.508, y - 0.014, -25.95],
            [sign * 24.508, y - 0.014, 1.95],
            [sign * 24.508, y + 0.014, 1.95],
            [sign * 24.508, y + 0.014, -25.95],
          ],
          'wall',
          C.joint,
          [sign, 0, 0],
        );
      }
  }
}
export const buildMemorialSkyline = (o) => buildMemorialLevel(o, 'skyline');
export const buildMemorialDistrict = (o) => buildMemorialLevel(o, 'district');
export const buildMemorialStreet = (o) => buildMemorialLevel(o, 'street');
export const buildMemorialCloseup = (o) => buildMemorialLevel(o, 'closeup');

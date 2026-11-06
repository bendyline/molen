/** Original Antwerp-Central historic headhouse and connected barrel-vaulted train shed. */

import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  stone: lin('d4cbb8'),
  brick: lin('a76e59'),
  base: lin('a4a89f'),
  roof: lin('63707b'),
  metal: lin('a56850'),
  gold: lin('d8b05e'),
  glass: lin('6d8790'),
  clock: lin('e1d8bf'),
  frame: lin('c6c6b9'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.89 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.86 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.7, metallic: 0.15 },
  gold: { slot: 'door', graph: 'metal_painted', roughness: 0.7, metallic: 0.15 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.5 },
  clock: { slot: 'wall', graph: 'stone_limestone', roughness: 0.89 },
  frame: { slot: 'wall', graph: 'stone_limestone', roughness: 0.89 },
};
const cfg = {
  skyline: { arch: 2, round: 4, dome: 2, roof: 4 },
  district: { arch: 3, round: 8, dome: 3, roof: 8, detail: true },
  street: { arch: 6, round: 12, dome: 8, roof: 14, detail: true, recess: true, fine: true },
  closeup: {
    arch: 10,
    round: 24,
    dome: 14,
    roof: 24,
    detail: true,
    recess: true,
    fine: true,
    near: true,
  },
  master: {
    arch: 28,
    round: 64,
    dome: 40,
    roof: 64,
    detail: true,
    recess: true,
    fine: true,
    near: true,
    master: true,
  },
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
function box(o, c, x0, x1, y0, y1, z0, z1, s = 'stone', col = C[s]) {
  for (const [p, N] of [
    [
      [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
      [0, 0, 1],
    ],
    [
      [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x0, y0, z0],
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [x1, y0, z1],
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
        [x0, y1, z0],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
        [x0, y0, z1],
      ],
      [0, -1, 0],
    ],
  ])
    Q(o, c, p, s, col, N);
}
const adapter = (o, c) => ({
  addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
  addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
  addConvexPolygon: (s, r, p, n, uv, col) => {
    for (let i = 1; i < p.length - 1; i++) T(o, c, [p[0], p[i], p[i + 1]], s, col, n);
  },
});
export const stationPlan = [
  [-38.77842, 60.49269],
  [-39.215278, 47.968281],
  [-36.796259, 47.66048],
  [-35.926571, -126.534469],
  [24.977102, -125.636901],
  [24.949176, -126.197298],
  [35.615076, -126.354275],
  [34.939596, 59.253502],
  [35.145007, 59.617778],
  [37.573334, 59.496769],
  [37.787424, 63.792988],
  [37.600629, 63.802297],
  [37.675095, 65.296633],
  [37.301506, 65.31525],
  [37.261752, 79.548655],
  [37.822136, 79.52073],
  [37.840752, 79.894313],
  [39.148313, 79.829154],
  [39.156991, 83.761082],
  [37.84943, 83.82624],
  [37.800365, 97.872803],
  [39.107926, 97.807645],
  [39.125911, 101.926349],
  [37.809042, 101.804717],
  [37.827658, 102.178298],
  [37.08048, 102.215532],
  [37.09657, 117.569575],
  [20.798913, 117.445451],
  [20.826838, 118.005821],
  [21.200427, 117.987204],
  [21.199795, 121.732313],
  [20.826206, 121.75093],
  [20.844822, 122.12451],
  [17.080377, 125.495413],
  [16.949431, 126.625461],
  [12.830645, 126.643454],
  [12.784105, 125.709505],
  [9.441053, 122.505529],
  [-10.6018, 122.380782],
  [-11.535773, 122.427324],
  [-14.935937, 125.592821],
  [-15.076191, 126.536079],
  [-19.194977, 126.554073],
  [-19.241517, 125.620123],
  [-22.976774, 122.061182],
  [-22.817904, 121.491504],
  [-23.378287, 121.519429],
  [-23.377655, 117.774318],
  [-22.817272, 117.746393],
  [-22.835888, 117.372813],
  [-39.133545, 117.248687],
  [-38.77842, 60.49269],
];
const face = (axis, side) =>
  axis === 'z' ? ([u, y, v]) => [u, y, side + v] : ([u, y, v]) => [side + v, y, -u];
const rect = (u, y, w, h) => [
  [u - w / 2, y],
  [u + w / 2, y],
  [u + w / 2, y + h],
  [u - w / 2, y + h],
];
const circle = (u, y, r, n) =>
  Array.from({ length: n }, (_, i) => [
    u + r * Math.cos((i / n) * Math.PI * 2),
    y + r * Math.sin((i / n) * Math.PI * 2),
  ]);
function arch(u, y, w, h, n) {
  const r = w / 2,
    spring = y + h - r,
    a = [
      [u - r, y],
      [u + r, y],
      [u + r, spring],
    ];
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * Math.PI;
    a.push([u + r * Math.cos(t), spring + r * Math.sin(t)]);
  }
  return a;
}
function wall(o, c, p, outer, holes = [], surface = 'stone', normal) {
  const N = normal ?? sub(p([0, 0, 1]), p([0, 0, 0])),
    active = holes.filter((h) => c.recess || h.kind === 'open'),
    flat = [...outer, ...active.flatMap((h) => h.ring)],
    starts = active.map(
      (h, i) => outer.length + active.slice(0, i).reduce((s, h) => s + h.ring.length, 0),
    );
  const ids = earcut(flat.flat(), starts);
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => p([...flat[j], 0])),
      surface,
      C[surface],
      N,
    );
  for (const h of holes) {
    const depth = h.kind === 'open' ? 0.8 : c.fine ? 0.28 : 0.12;
    if (c.recess || (c.detail && h.kind === 'open'))
      for (let i = 0; i < h.ring.length; i++) {
        const a = h.ring[i],
          b = h.ring[(i + 1) % h.ring.length];
        Q(
          o,
          c,
          [p([...a, 0]), p([...b, 0]), p([...b, -depth]), p([...a, -depth])],
          surface,
          C[surface],
        );
      }
    if (h.kind !== 'open') {
      const ix = earcut(h.ring.flat());
      for (let i = 0; i < ix.length; i += 3)
        T(
          o,
          c,
          ix.slice(i, i + 3).map((j) => p([...h.ring[j], c.recess ? -depth : 0.02])),
          h.kind,
          C[h.kind],
          N,
        );
    }
    if (c.near)
      beamPath(
        adapter(o, c),
        'stone',
        h.ring.map(([u, y]) => p([u, y, 0.06])),
        h.kind === 'open' ? 0.27 : 0.18,
        0.17,
        C.stone,
        true,
      );
    else if (c.fine) {
      const center = h.ring.reduce((a, b) => a.map((v, i) => v + b[i] / h.ring.length), [0, 0]);
      for (let i = 0; i < h.ring.length; i++) {
        const a = h.ring[i],
          b = h.ring[(i + 1) % h.ring.length],
          grow = (q) => {
            const d = Math.hypot(q[0] - center[0], q[1] - center[1]) || 1;
            return q.map((v, i) => v + (0.15 * (v - center[i])) / d);
          };
        Q(
          o,
          c,
          [p([...a, 0.035]), p([...b, 0.035]), p([...grow(b), 0.035]), p([...grow(a), 0.035])],
          'stone',
          C.stone,
          N,
        );
      }
    }
    if (c.near && h.kind === 'glass') {
      const xs = h.ring.map((p) => p[0]),
        ys = h.ring.map((p) => p[1]),
        x = (Math.min(...xs) + Math.max(...xs)) / 2,
        lo = Math.min(...ys),
        hi = Math.max(...ys);
      beam(
        adapter(o, c),
        'metal',
        p([x, lo, -depth + 0.05]),
        p([x, hi, -depth + 0.05]),
        0.08,
        0.08,
        C.frame,
      );
      beam(
        adapter(o, c),
        'metal',
        p([Math.min(...xs), lo + (hi - lo) * 0.56, -depth + 0.05]),
        p([Math.max(...xs), lo + (hi - lo) * 0.56, -depth + 0.05]),
        0.08,
        0.08,
        C.frame,
      );
    }
  }
}
function slab(o, c, ring, y0, y1, s = 'base') {
  const ix = earcut(ring.flat());
  for (let i = 0; i < ix.length; i += 3) {
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [ring[j][0], y1, ring[j][1]]),
      s,
      C[s],
      [0, 1, 0],
    );
    T(
      o,
      c,
      ix.slice(i, i + 3).map((j) => [ring[j][0], y0, ring[j][1]]),
      s,
      C[s],
      [0, -1, 0],
    );
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
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
      C[s],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
}
function mansard(o, c, x0, x1, z0, z1, eave, top) {
  const rings = [
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    [
      [x0 + 2.3, z0 + 2.3],
      [x1 - 2.3, z0 + 2.3],
      [x1 - 2.3, z1 - 2.3],
      [x0 + 2.3, z1 - 2.3],
    ],
  ];
  for (let i = 0; i < 4; i++)
    Q(
      o,
      c,
      [
        [rings[0][i][0], eave, rings[0][i][1]],
        [rings[0][(i + 1) % 4][0], eave, rings[0][(i + 1) % 4][1]],
        [rings[1][(i + 1) % 4][0], top, rings[1][(i + 1) % 4][1]],
        [rings[1][i][0], top, rings[1][i][1]],
      ],
      'roof',
      C.roof,
      [0, 1, 0],
    );
  Q(
    o,
    c,
    rings[1].map(([x, z]) => [x, top, z]),
    'roof',
    C.roof,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    rings[0].map(([x, z]) => [x, eave, z]),
    'roof',
    C.roof,
    [0, -1, 0],
  );
}
function lathe(o, c, x, z, profile, s = 'roof', elliptic = 1, n = c.round) {
  for (let k = 0; k < profile.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2,
        p = ([y, r], t) => [x + r * Math.cos(t), y, z + r * elliptic * Math.sin(t)];
      Q(
        o,
        c,
        [p(profile[k], a), p(profile[k], b), p(profile[k + 1], b), p(profile[k + 1], a)],
        s,
        C[s],
        [Math.cos((a + b) / 2), 0.01, Math.sin((a + b) / 2)],
      );
    }
  for (const [ring, N] of [
    [profile[0], [0, -1, 0]],
    [profile.at(-1), [0, 1, 0]],
  ])
    for (let i = 0; i < n; i++)
      T(
        o,
        c,
        [
          [x, ring[0], z],
          [
            x + ring[1] * Math.cos((i / n) * Math.PI * 2),
            ring[0],
            z + ring[1] * elliptic * Math.sin((i / n) * Math.PI * 2),
          ],
          [
            x + ring[1] * Math.cos(((i + 1) / n) * Math.PI * 2),
            ring[0],
            z + ring[1] * elliptic * Math.sin(((i + 1) / n) * Math.PI * 2),
          ],
        ],
        s,
        C[s],
        N,
      );
}
const interp = (controls, n) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * (controls.length - 1),
      j = Math.min(controls.length - 2, Math.floor(t)),
      u = t - j;
    return controls[j].map((v, k) => v * (1 - u) + controls[j + 1][k] * u);
  });
function lantern(o, c, x, z, y, r, top, glazed = false) {
  const n = c.fine ? 8 : 4;
  lathe(
    o,
    c,
    x,
    z,
    [
      [y - 0.25, r + 0.35],
      [y + 0.2, r + 0.35],
    ],
    'stone',
    1,
    n,
  );
  if (glazed)
    lathe(
      o,
      c,
      x,
      z,
      [
        [y + 0.2, r],
        [top - 1.5, r],
      ],
      'glass',
      1,
      n,
    );
  for (let i = 0; i < n; i++) {
    const t = ((i + 0.5) / n) * Math.PI * 2,
      px = x + r * Math.cos(t),
      pz = z + r * Math.sin(t);
    if (c.detail)
      box(o, c, px - 0.18, px + 0.18, y + 0.15, top - 1.4, pz - 0.18, pz + 0.18, 'stone');
    else {
      const dx = 0.18 * Math.sin(t),
        dz = -0.18 * Math.cos(t),
        P = [
          [px - dx, y + 0.15, pz - dz],
          [px + dx, y + 0.15, pz + dz],
          [px + dx, top - 1.4, pz + dz],
          [px - dx, top - 1.4, pz - dz],
        ];
      Q(o, c, P, 'stone', C.stone, [Math.cos(t), 0, Math.sin(t)]);
      Q(o, c, P, 'stone', C.stone, [-Math.cos(t), 0, -Math.sin(t)]);
    }
  }
  lathe(
    o,
    c,
    x,
    z,
    [
      [top - 1.5, r + 0.38],
      [top - 1.1, r + 0.38],
      [top, r * 0.45],
    ],
    'roof',
    1,
    c.round,
  );
  lathe(
    o,
    c,
    x,
    z,
    [
      [top, r * 0.45],
      [top + 0.6, 0.13],
      [top + 1.1, 0],
    ],
    'gold',
    1,
    c.fine ? 8 : 4,
  );
}
function pavilion(o, c, x, z) {
  const n = c.detail ? 8 : 4,
    R = c.detail ? 5.06 : 6.612,
    ring = Array.from({ length: n }, (_, i) => [
      x + R * Math.cos(((i + 0.5) / n) * Math.PI * 2),
      z + R * Math.sin(((i + 0.5) / n) * Math.PI * 2),
    ]);
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n],
      L = Math.hypot(b[0] - a[0], b[1] - a[1]),
      u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L],
      N = [u[1], 0, -u[0]],
      p = ([v, y, d]) => [a[0] + u[0] * v + N[0] * d, y, a[1] + u[1] * v + N[2] * d];
    // Each lower pavilion is a genuine pierced arcade, rather than a solid column.
    wall(
      o,
      c,
      p,
      rect(L / 2, 0.35, L, 11.65),
      [{ ring: arch(L / 2, 0.35, Math.min(3.15, L - 0.5), 10.5, c.arch), kind: 'open' }],
      'stone',
      N,
    );
    const holes = [
      { ring: circle(L / 2, 17.1, 1.23, c.round), kind: 'glass' },
      ...(c.detail
        ? [{ ring: rect(L / 2, 23, Math.min(2.55, L - 0.45), 5.3), kind: 'glass' }]
        : []),
    ];
    wall(o, c, p, rect(L / 2, 12, L, 23), holes, 'stone', N);
    if (c.detail)
      for (const y of [12, 21.8, 29.3, 34.5]) {
        if (c.fine)
          beam(adapter(o, c), 'stone', p([0, y, 0.12]), p([L, y, 0.12]), 0.35, 0.4, C.stone);
        else
          Q(
            o,
            c,
            [
              p([0, y - 0.18, 0.12]),
              p([L, y - 0.18, 0.12]),
              p([L, y + 0.18, 0.12]),
              p([0, y + 0.18, 0.12]),
            ],
            'stone',
            C.stone,
            N,
          );
      }
    if (c.fine)
      beam(adapter(o, c), 'stone', p([0.2, 12, 0.18]), p([0.2, 34.8, 0.18]), 0.32, 0.4, C.stone);
  }
  lathe(
    o,
    c,
    x,
    z,
    interp(
      [
        [35, 5.65],
        [37, 5.15],
        [40, 3.65],
        [43, 1.6],
      ],
      c.dome,
    ),
    'roof',
  );
  if (c.fine)
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      beamPath(
        adapter(o, c),
        'stone',
        [
          [35, 5.68],
          [37, 5.18],
          [40, 3.68],
          [43, 1.64],
        ].map(([y, r]) => [x + r * Math.cos(t), y, z + r * Math.sin(t)]),
        0.15,
        0.16,
        C.frame,
      );
    }
  lantern(o, c, x, z, 43.7, 1.4, 50.9);
  if (c.near)
    for (let i = 0; i < 4; i++) {
      const t = (i * Math.PI) / 2,
        n = [Math.sin(t), 0, Math.cos(t)],
        p = ([u, y, v]) => [
          x + u * Math.cos(t) + n[0] * (4.6 + v),
          y,
          z - u * Math.sin(t) + n[2] * (4.6 + v),
        ];
      wall(o, c, p, rect(0, 34.6, 2.5, 3.8), [
        { ring: arch(0, 35, 1.6, 2.9, c.arch), kind: 'glass' },
      ]);
    }
}
function sideWing(o, c, x0, x1) {
  const z0 = 60,
    z1 = 118,
    levels = [13.5, 21.3];
  box(o, c, x0, x1, 0.35, 12, z0, 112.15, 'base');
  for (const front of [true, false]) {
    const z = front ? z1 : z0,
      p = ([u, y, v]) => [front ? u : -u, y, z + (front ? 1 : -1) * v],
      holes = [];
    for (const y of levels)
      for (let i = 0; i < (c.detail ? 3 : 1); i++) {
        const count = c.detail ? 3 : 1,
          x = x0 + ((i + 0.5) * (x1 - x0)) / count;
        holes.push({
          ring: rect(front ? x : -x, y, c.detail ? 3.2 : x1 - x0 - 4, 5.4),
          kind: 'glass',
        });
      }
    wall(o, c, p, rect(front ? (x0 + x1) / 2 : -(x0 + x1) / 2, 12, x1 - x0, 15.6), holes, 'brick');
  }
  for (const side of [-1, 1]) {
    const x = side < 0 ? x0 : x1,
      p = ([u, y, v]) => [x + side * v, y, side < 0 ? u : -u],
      holes = [];
    for (const y of levels)
      for (let i = 0; i < (c.detail ? 8 : 1); i++) {
        const count = c.detail ? 8 : 1,
          z = z0 + ((i + 0.5) * (z1 - z0)) / count;
        holes.push({ ring: rect(side < 0 ? z : -z, y, c.detail ? 3.0 : 42, 5.4), kind: 'glass' });
      }
    wall(
      o,
      c,
      p,
      rect(side < 0 ? (z0 + z1) / 2 : -(z0 + z1) / 2, 12, z1 - z0, 15.6),
      holes,
      'brick',
    );
  }
  box(o, c, x0 - 0.22, x1 + 0.22, 27.5, 28.25, z0 - 0.22, z1 + 0.22, 'stone');
  mansard(o, c, x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, 28.25, 35);
  if (c.detail) {
    for (const y of [12.1, 20.4, 26.3]) {
      box(o, c, x0 - 0.16, x1 + 0.16, y, y + 0.3, z0 - 0.16, z0 + 0.15, 'stone');
      box(o, c, x0 - 0.16, x1 + 0.16, y, y + 0.3, z1 - 0.15, z1 + 0.16, 'stone');
      for (const x of [x0, x1]) box(o, c, x - 0.15, x + 0.15, y, y + 0.3, z0, z1, 'stone');
    }
    for (let i = 0; i < 3; i++) {
      const x = x0 + ((i + 0.5) * (x1 - x0)) / 3;
      box(o, c, x - 1.45, x + 1.45, 28.6, 32.6, 116.25, 117.98, 'stone');
      wall(o, c, face('z', 118.31), rect(x, 28.8, 2.5, 3.45), [
        { ring: rect(x, 29.2, 1.75, 2.65), kind: 'glass' },
      ]);
      mansard(o, c, x - 1.65, x + 1.65, 115.8, 118.6, 32.5, 33.8);
    }
  }
  if (c.fine)
    for (const x of [x0, x1])
      for (let i = 0; i <= 8; i++) {
        const z = z0 + (i * (z1 - z0)) / 8;
        box(o, c, x - 0.25, x + 0.25, 12, 27.5, z - 0.27, z + 0.27, 'stone');
      }
}
const SX = -1.8,
  S0 = -126.5,
  S1 = 60.5,
  HW = 37.2,
  SPRING = 21,
  RISE = 28;
const shedP = (t, z, under = false) => [
  SX + HW * Math.cos(t),
  SPRING + RISE * Math.sin(t) - (under ? 0.18 : 0),
  z,
];
function shed(o, c) {
  box(o, c, SX - HW, SX + HW, 11.7, 12, S0, S1, 'base');
  for (const side of [-1, 1]) {
    const x = SX + side * HW,
      p = ([u, y, v]) => [x + side * v, y, side < 0 ? u : -u],
      holes = [];
    if (c.detail)
      for (let z = S0 + 5; z < S1 - 3; z += 7.5)
        holes.push({ ring: arch(side < 0 ? z : -z, 13.2, 5.2, 6.8, c.arch), kind: 'glass' });
    wall(
      o,
      c,
      p,
      rect(side < 0 ? (S0 + S1) / 2 : -(S0 + S1) / 2, 0.35, S1 - S0, 20.65),
      holes,
      'brick',
    );
    box(o, c, x - 0.25, x + 0.25, 20.5, 21.2, S0, S1, 'stone');
  }
  for (let i = 0; i < c.roof; i++) {
    const a = (i / c.roof) * Math.PI,
      b = ((i + 1) / c.roof) * Math.PI;
    Q(o, c, [shedP(a, S0), shedP(b, S0), shedP(b, S1), shedP(a, S1)], 'glass', C.glass, [
      Math.cos((a + b) / 2),
      1,
      0,
    ]);
    Q(
      o,
      c,
      [shedP(a, S0, true), shedP(a, S1, true), shedP(b, S1, true), shedP(b, S0, true)],
      'glass',
      C.glass,
      [-Math.cos((a + b) / 2), -1, 0],
    );
    for (const z of [S0, S1])
      Q(o, c, [shedP(a, z), shedP(a, z, true), shedP(b, z, true), shedP(b, z)], 'metal', C.metal, [
        0,
        0,
        z === S0 ? -1 : 1,
      ]);
  }
  const endRing = [
    [SX - HW, SPRING],
    [SX + HW, SPRING],
    ...Array.from({ length: c.roof }, (_, i) => {
      const t = ((i + 1) / c.roof) * Math.PI;
      return [SX + HW * Math.cos(t), SPRING + RISE * Math.sin(t)];
    }),
  ];
  wall(o, c, ([u, y, v]) => [u, y, S0 - v], endRing, [], 'glass', [0, 0, -1]);
  wall(o, c, ([u, y, v]) => [u, y, S1 + v], endRing, [], 'glass', [0, 0, 1]);
  // South train exits remain open below the high arched screen.
  if (c.detail) {
    const ribs = c.master ? 44 : c.near ? 28 : c.fine ? 12 : 2;
    for (let j = 0; j <= ribs; j++) {
      const z = S0 + ((S1 - S0) * j) / ribs,
        pts = Array.from({ length: c.roof + 1 }, (_, i) => shedP((i / c.roof) * Math.PI, z));
      beamPath(adapter(o, c), 'metal', pts, 0.28, 0.3, C.metal);
    }
    for (let i = 0; i <= 8; i++) {
      const x = SX - HW + (i * HW) / 4,
        t = Math.acos(Math.max(-1, Math.min(1, (x - SX) / HW))),
        top = SPRING + RISE * Math.sin(t);
      beam(adapter(o, c), 'metal', [x, 12, S0 - 0.08], [x, top, S0 - 0.08], 0.3, 0.32, C.metal);
    }
    beam(
      adapter(o, c),
      'metal',
      [SX - HW, SPRING, S0 - 0.1],
      [SX + HW, SPRING, S0 - 0.1],
      0.4,
      0.4,
      C.metal,
    );
  }
  if (c.fine) {
    for (let i = 1; i < (c.near ? 15 : 7); i++) {
      const t = (i / (c.near ? 15 : 7)) * Math.PI,
        p = shedP(t, S0);
      beam(adapter(o, c), 'metal', p, shedP(t, S1), 0.1, 0.12, C.frame);
    }
    if (c.near)
      for (let z = S0 + 1; z < S1; z += c.master ? 2.2 : 4.4)
        beamPath(
          adapter(o, c),
          'metal',
          Array.from({ length: c.roof + 1 }, (_, i) => {
            const p = shedP((i / c.roof) * Math.PI, z);
            p[1] += 0.045;
            return p;
          }),
          0.04,
          0.04,
          C.frame,
        );
  }
}
function frontArcade(o, c) {
  const holes = [-34.5, -28.4, -22.5, -17.1, -9.5, -3.5, 2.5, 8.5, 14.8, 22.3, 28.3, 34.3].map(
    (x) => ({ ring: arch(x, 0.35, 5.0, 10.65, c.arch), kind: 'open' }),
  );
  wall(o, c, face('z', 123), rect(0, 0.35, 78, 11.8), holes);
  wall(
    o,
    c,
    ([u, y, v]) => [-u, y, 122.2 - v],
    rect(0, 0.35, 78, 11.8),
    holes.map((h) => ({ ring: h.ring.map(([u, y]) => [-u, y]), kind: 'open' })),
  );
  box(o, c, -39, 39, 11.8, 12.2, 112.5, 123, 'stone');
  const entrances = [-34.5, -28.4, -22.5, -9.5, -3.5, 2.5, 8.5, 22.3, 28.3, 34.3].map((x) => ({
    ring: arch(x, 0.35, 4.2, 9.7, c.arch),
    kind: 'glass',
  }));
  wall(o, c, face('z', 112.5), rect(0, 0.35, 78, 11.45), entrances, 'stone');
  if (c.near)
    for (let y = 0.8; y < 11.9; y += 0.65) {
      for (const x of [
        -38, -31.4, -25.45, -19.6, -14.5, -6.5, -0.5, 5.5, 11.5, 18, 25.3, 31.3, 37.8,
      ])
        box(o, c, x - 0.36, x + 0.36, y, y + 0.055, 122.9, 123.08, 'base');
    }
}
const domePoint = (t, v, under = false) => [
  -1.85 + 15.85 * Math.cos(t),
  45.85 + 15.85 * Math.sin(t) + 3.3 * Math.sin(v * Math.PI) - (under ? 0.2 : 0),
  82.35 + 25.65 * v,
];
function mainDomeRoof(o, c) {
  const nz = Math.max(2, Math.floor(c.dome / 2)),
    nt = c.round;
  for (let i = 0; i < nt; i++)
    for (let j = 0; j < nz; j++) {
      const a = (i / nt) * Math.PI,
        b = ((i + 1) / nt) * Math.PI,
        v = j / nz,
        w = (j + 1) / nz;
      Q(
        o,
        c,
        [domePoint(a, v), domePoint(b, v), domePoint(b, w), domePoint(a, w)],
        'roof',
        C.roof,
        [0, 1, 0],
      );
      Q(
        o,
        c,
        [
          domePoint(a, v, true),
          domePoint(a, w, true),
          domePoint(b, w, true),
          domePoint(b, v, true),
        ],
        'roof',
        C.roof,
        [0, -1, 0],
      );
    }
  for (const t of [0, Math.PI])
    for (let j = 0; j < nz; j++) {
      const a = domePoint(t, j / nz),
        b = domePoint(t, (j + 1) / nz),
        normal = [Math.cos(t), 0, 0];
      Q(o, c, [[a[0], 35, a[2]], [b[0], 35, b[2]], b, a], 'roof', C.roof, normal);
    }
  for (const v of [0, 1])
    for (let i = 0; i < nt; i++) {
      const a = (i / nt) * Math.PI,
        b = ((i + 1) / nt) * Math.PI;
      Q(
        o,
        c,
        [domePoint(a, v), domePoint(a, v, true), domePoint(b, v, true), domePoint(b, v)],
        'roof',
        C.roof,
        [0, 0, v ? 1 : -1],
      );
    }
  if (c.fine)
    for (let i = 0; i <= 8; i++)
      beamPath(
        adapter(o, c),
        'metal',
        Array.from({ length: nz + 1 }, (_, j) => {
          const p = domePoint((i / 8) * Math.PI, j / nz);
          p[1] += 0.04;
          return p;
        }),
        0.1,
        0.12,
        C.frame,
      );
}
function headhouse(o, c, onStage) {
  sideWing(o, c, -39, -22);
  sideWing(o, c, 20, 39);
  onStage?.('wings');
  box(o, c, -22, 20, 0.35, 12, 60, 112.15, 'stone');
  box(o, c, -22, 20, 12, 35, 60, 113, 'stone');
  frontArcade(o, c);
  onStage?.('arcade');
  for (const [x, z] of [
    [-17.1, 120.2],
    [14.8, 120.4],
  ])
    pavilion(o, c, x, z);
  onStage?.('pavilions');
  // Full closed tall glazed north entrance screen and its low domed slate cap.
  box(o, c, -12.2, 10, 12.2, 31.8, 122.45, 122.65, 'glass');
  if (c.detail) {
    for (const x of [-12.2, -6.65, -1.1, 4.45, 10])
      box(o, c, x - 0.2, x + 0.2, 12.2, 31.8, 122.65, 123, 'stone');
    for (const y of [12.3, 19.1, 31.4]) box(o, c, -12.4, 10.2, y, y + 0.35, 122.65, 123.1, 'stone');
  }
  mansard(o, c, -12.5, 10.3, 112.9, 123.1, 31.8, 38.5);
  // Central passenger hall, with its unmistakable arched fanlight and tall dome.
  box(o, c, -16.35, 12.65, 35, 38, 82.45, 107.9, 'stone');
  mainDomeRoof(o, c);
  const outer = arch(-1.85, 35, 31.7, 26.7, c.arch * 2),
    hole = arch(-1.85, 35.6, 26.4, 22.8, c.arch * 2);
  wall(o, c, face('z', 108), outer, [{ ring: hole, kind: 'glass' }]);
  wall(
    o,
    c,
    ([u, y, v]) => [-u, y, 82.35 - v],
    outer.map(([u, y]) => [-u, y]),
    [{ ring: hole.map(([u, y]) => [-u, y]), kind: 'glass' }],
  );
  if (c.detail) {
    const spring = 45.2,
      rr = 13.1,
      pts = Array.from({ length: c.arch * 2 + 1 }, (_, i) => [
        -1.85 + rr * Math.cos((i / (c.arch * 2)) * Math.PI),
        spring + rr * Math.sin((i / (c.arch * 2)) * Math.PI),
        108.08,
      ]);
    beamPath(adapter(o, c), 'stone', pts, 0.35, 0.4, C.frame);
    for (let i = 1; i < 8; i++) {
      const t = (i / 8) * Math.PI;
      beam(
        adapter(o, c),
        'stone',
        [-1.85, 35.8, 108.1],
        [-1.85 + rr * Math.cos(t), spring + rr * Math.sin(t), 108.1],
        0.15,
        0.18,
        C.frame,
      );
    }
    for (const radius of [4.5, 8.5])
      beamPath(
        adapter(o, c),
        'stone',
        Array.from({ length: c.arch * 2 + 1 }, (_, i) => [
          -1.85 + radius * Math.cos((i / (c.arch * 2)) * Math.PI),
          45.2 + radius * Math.sin((i / (c.arch * 2)) * Math.PI),
          108.12,
        ]),
        0.15,
        0.18,
        C.frame,
      );
  }
  lantern(o, c, -1.85, 95.17, 65, 2.5, 73.9, true);
  // Clock is original geometry: no copied crest, lettering or logo.
  const clock = circle(-1.1, 34.4, 2.05, c.round);
  wall(o, c, face('z', 123.5), clock, [], 'clock');
  if (c.detail) {
    beamPath(
      adapter(o, c),
      'gold',
      clock.map(([x, y]) => [x, y, 123.55]),
      0.13,
      0.16,
      C.gold,
      true,
    );
    for (let i = 0; i < 12; i++) {
      const t = (i / 12) * Math.PI * 2;
      beam(
        adapter(o, c),
        'metal',
        [-1.1 + 1.55 * Math.cos(t), 34.4 + 1.55 * Math.sin(t), 123.59],
        [-1.1 + 1.8 * Math.cos(t), 34.4 + 1.8 * Math.sin(t), 123.59],
        0.055,
        0.06,
        C.metal,
      );
    }
    beam(adapter(o, c), 'metal', [-1.1, 34.4, 123.65], [-1.1, 35.7, 123.65], 0.1, 0.12, C.metal);
    beam(adapter(o, c), 'metal', [-1.1, 34.4, 123.66], [0.1, 34.7, 123.66], 0.1, 0.12, C.metal);
  }
  if (c.near) {
    for (const x of [-38, -22, 20, 38])
      for (let y = 12.4; y < 27; y += 1.1)
        box(o, c, x - 0.3, x + 0.3, y, y + 0.12, 117.6, 118.4, 'stone');
    for (let x = -38; x < 39; x += 1.1) {
      box(o, c, x, x + 0.35, 27.2, 27.65, 118.1, 118.65, 'stone');
    }
  }
}
export function buildStationLevel(o, level = 'master', onStage) {
  const c = cfg[level];
  if (!c) throw Error('Unknown Antwerp level ' + level);
  // Parent floor is supplied by the exact checked-in map-derived ring.
  const floor = c.fine ? stationPlan : simplePlan(stationPlan);
  slab(o, c, floor, -3, 0.35);
  onStage?.('floor');
  shed(o, c);
  onStage?.('shed');
  headhouse(o, c, onStage);
  onStage?.('dome-and-front');
}
function simplePlan(input) {
  const ring = input.slice(0, -1).map((p) => [...p]);
  let changed = true;
  while (changed && ring.length > 8) {
    changed = false;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[(i + ring.length - 1) % ring.length],
        p = ring[i],
        b = ring[(i + 1) % ring.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = dx * dx + dz * dz,
        t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l)) : 0;
      if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < 0.5) {
        ring.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return ring;
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

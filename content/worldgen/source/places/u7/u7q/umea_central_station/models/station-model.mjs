/** Original complete historic Umeå station; shared metric materials and explicit browser tiers. */

import {
  beam,
  beamPath,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const lin = (h) =>
  h.match(/\w\w/g).map((v) => {
    const s = parseInt(v, 16) / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
const C = {
  brick: lin('bc7153'),
  band: lin('d2b17c'),
  stone: lin('d6c49d'),
  base: lin('9b9c91'),
  roof: lin('90ae84'),
  wood: lin('685040'),
  metal: lin('55675e'),
  glass: lin('758a8c'),
  clock: lin('e5debe'),
};
export const stationSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.91 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9 },
  band: { slot: 'wall', graph: 'brick', roughness: 0.9 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.85, metallic: 0.14 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.86 },
  metal: { slot: 'door', graph: 'metal_painted', roughness: 0.82, metallic: 0.12 },
  glass: { slot: 'window', graph: 'window_punched', roughness: 0.48 },
};
const cfg = {
  skyline: { arch: 3, round: 4 },
  district: { arch: 4, round: 6, detail: true },
  street: { arch: 6, round: 10, detail: true, fine: true },
  closeup: { arch: 12, round: 24, detail: true, fine: true, near: true },
  master: { arch: 24, round: 48, detail: true, fine: true, near: true, master: true },
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
// The lower native wings and central projection remain independent authored masses.
export const stationPlan = [
  [-18.506601, -7.329164],
  [18.501155, -7.330529],
  [18.501155, 5.681501],
  [9.651776, 5.681501],
  [9.651776, 7.331086],
  [-9.944196, 7.331086],
  [-9.944196, 5.682806],
  [-18.506601, 5.682806],
];
const face = (axis, side) =>
  axis === 'z'
    ? ([u, y, v]) => [side > 0 ? u : -u, y, side + Math.sign(side) * v]
    : ([u, y, v]) => [side + Math.sign(side) * v, y, side > 0 ? -u : u];
const rectangle = (u, y, w, h) => [
  [u - w / 2, y],
  [u + w / 2, y],
  [u + w / 2, y + h],
  [u - w / 2, y + h],
];
function arch(u, y, w, h, n, ratio = 1) {
  const R = w / 2,
    ry = R * ratio,
    spring = y + h - ry,
    a = [
      [u - R, y],
      [u + R, y],
      [u + R, spring],
    ];
  for (let i = 1; i <= n; i++) {
    const t = (i / n) * Math.PI;
    a.push([u + R * Math.cos(t), spring + ry * Math.sin(t)]);
  }
  return a;
}
const opening = (ring, kind = 'glass') => ({ ring, kind });
function polygonWall(o, c, p, outer, holes = [], surface = 'brick', color = C[surface]) {
  const N = sub(p([0, 0, 1]), p([0, 0, 0])),
    flat = [...outer, ...holes.flatMap((h) => h.ring)],
    starts = holes.map(
      (h, i) => outer.length + holes.slice(0, i).reduce((s, h) => s + h.ring.length, 0),
    );
  if (!c.detail) {
    const ids = earcut(outer.flat());
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => p([...outer[j], 0])),
        surface,
        color,
        N,
      );
    for (const h of holes) {
      const ids = earcut(h.ring.flat());
      for (let i = 0; i < ids.length; i += 3)
        T(
          o,
          c,
          ids.slice(i, i + 3).map((j) => p([...h.ring[j], 0.015])),
          h.kind,
          C[h.kind],
          N,
        );
    }
    return;
  }
  const ids = earcut(flat.flat(), starts),
    depth = c.fine ? 0.28 : 0.12;
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => p([...flat[j], 0])),
      surface,
      color,
      N,
    );
  for (const h of holes) {
    const r = h.ring;
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      Q(o, c, [p([...a, 0]), p([...b, 0]), p([...b, -depth]), p([...a, -depth])], 'brick', C.band);
    }
    const ids = earcut(r.flat());
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        c,
        ids.slice(i, i + 3).map((j) => p([...r[j], -depth])),
        h.kind,
        C[h.kind],
        N,
      );
    const center = r.reduce((a, b) => a.map((v, i) => v + b[i] / r.length), [0, 0]);
    if (c.fine)
      beamPath(
        adapter(o, c),
        'band',
        r.map(([u, y]) => p([u, y, 0.035])),
        0.16,
        0.15,
        C.band,
        true,
      );
    else
      for (let i = 0; i < r.length; i++) {
        const a = r[i],
          b = r[(i + 1) % r.length],
          out = (q) => {
            const d = Math.hypot(q[0] - center[0], q[1] - center[1]) || 1;
            return [q[0] + (0.12 * (q[0] - center[0])) / d, q[1] + (0.12 * (q[1] - center[1])) / d];
          };
        Q(
          o,
          c,
          [p([...a, 0.02]), p([...b, 0.02]), p([...out(b), 0.02]), p([...out(a), 0.02])],
          'band',
          C.band,
          N,
        );
      }
    if (c.near && h.kind === 'glass') {
      const xs = r.map((p) => p[0]),
        ys = r.map((p) => p[1]),
        x = (Math.min(...xs) + Math.max(...xs)) / 2,
        lo = Math.min(...ys),
        hi = Math.max(...ys),
        left = Math.min(...xs),
        right = Math.max(...xs);
      beam(
        adapter(o, c),
        'wood',
        p([x, lo, -depth + 0.04]),
        p([x, hi, -depth + 0.04]),
        0.07,
        0.08,
        C.wood,
      );
      beam(
        adapter(o, c),
        'wood',
        p([left, lo + (hi - lo) * 0.6, -depth + 0.04]),
        p([right, lo + (hi - lo) * 0.6, -depth + 0.04]),
        0.07,
        0.08,
        C.wood,
      );
    }
  }
}
function slab(o, c, ring, y0, y1) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [ring[j][0], y1, ring[j][1]]),
      'base',
      C.base,
      [0, 1, 0],
    );
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [ring[j][0], y0, ring[j][1]]),
      'base',
      C.base,
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
      'base',
      C.base,
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
}
function gableRoof(o, c, x0, x1, z0, z1, eave, ridge) {
  const z = (z0 + z1) / 2;
  Q(
    o,
    c,
    [
      [x0, eave, z1],
      [x1, eave, z1],
      [x1, ridge, z],
      [x0, ridge, z],
    ],
    'roof',
    C.roof,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [x1, eave, z0],
      [x0, eave, z0],
      [x0, ridge, z],
      [x1, ridge, z],
    ],
    'roof',
    C.roof,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [x0, eave, z0],
      [x1, eave, z0],
      [x1, eave, z1],
      [x0, eave, z1],
    ],
    'roof',
    C.roof,
    [0, -1, 0],
  );
  if (c.fine) {
    for (let x = x0 + 0.45; x < x1; x += c.near ? 0.85 : 2.4)
      for (const end of [z0, z1])
        beam(
          adapter(o, c),
          'roof',
          [x, eave + 0.035, end],
          [x, ridge + 0.035, z],
          0.035,
          0.035,
          C.roof,
        );
  }
}
function crossRoof(o, c, x, half, front, back, eave, ridge) {
  Q(
    o,
    c,
    [
      [x - half, eave, front],
      [x, ridge, front],
      [x, ridge, back],
      [x - half, eave, back],
    ],
    'roof',
    C.roof,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [x + half, eave, back],
      [x, ridge, back],
      [x, ridge, front],
      [x + half, eave, front],
    ],
    'roof',
    C.roof,
    [0, 1, 0],
  );
  Q(
    o,
    c,
    [
      [x - half, eave, back],
      [x + half, eave, back],
      [x + half, eave, front],
      [x - half, eave, front],
    ],
    'roof',
    C.roof,
    [0, -1, 0],
  );
  T(
    o,
    c,
    [
      [x - half, eave, back],
      [x, ridge, back],
      [x + half, eave, back],
    ],
    'roof',
    C.roof,
    [0, 0, -1],
  );
  if (c.detail) {
    for (const [a, b] of [
      [
        [x - half, eave, front + 0.08],
        [x, ridge, front + 0.08],
      ],
      [
        [x, ridge, front + 0.08],
        [x + half, eave, front + 0.08],
      ],
    ])
      beam(adapter(o, c), 'roof', a, b, 0.13, 0.17, C.roof);
  }
}
function course(o, c, x0, x1, z0, z1, y, h = 0.14, s = 'band') {
  for (const [a, b] of [
    [
      [x0, y, z1],
      [x1, y, z1],
    ],
    [
      [x1, y, z0],
      [x0, y, z0],
    ],
    [
      [x0, y, z0],
      [x0, y, z1],
    ],
    [
      [x1, y, z1],
      [x1, y, z0],
    ],
  ])
    beam(adapter(o, c), s, a, b, h, 0.14, C[s]);
}
function wing(o, c, x0, x1) {
  const L = x1 - x0,
    x = (x0 + x1) / 2,
    z0 = -7.33,
    z1 = 5.68,
    z = (z0 + z1) / 2;
  for (const [front, sgn] of [
    [z1, 1],
    [z0, -1],
  ]) {
    const p = face('z', front),
      holes = [x0 + 2.3, x1 - 2.3].map((u) => opening(arch(sgn * u, 0.9, 2.05, 3.45, c.arch)));
    if (sgn < 0) holes[0].kind = 'wood';
    const [left, right] = sgn > 0 ? [x0, x1] : [-x1, -x0];
    polygonWall(
      o,
      c,
      p,
      [
        [left, 0.35],
        [right, 0.35],
        [right, 5.2],
        [left, 5.2],
      ],
      holes,
    );
  }
  const end = x0 < 0 ? x0 : x1,
    sgn = Math.sign(end),
    p = face('x', end),
    holes = [-3, 2].map((u) => opening(arch(u, 0.9, 1.8, 3.35, c.arch)));
  holes.push(opening(arch(0, 6.1, 1.1, 1.55, c.arch)));
  const left = sgn > 0 ? -z1 : z0,
    right = sgn > 0 ? -z0 : z1,
    ridgeU = sgn > 0 ? -z : z;
  polygonWall(
    o,
    c,
    p,
    [
      [left, 0.35],
      [right, 0.35],
      [right, 5.2],
      [ridgeU, 9.3],
      [left, 5.2],
    ],
    holes,
  );
  gableRoof(o, c, x0 - 0.23, x1 + 0.23, z0 - 0.23, z1 + 0.23, 5.2, 9.3);
  course(o, c, x0 - 0.08, x1 + 0.08, z0 - 0.08, z1 + 0.08, 4.9, 0.13);
  course(o, c, x0 - 0.12, x1 + 0.12, z0 - 0.12, z1 + 0.12, 5.15, 0.15);
  if (c.fine)
    for (let u = x0 + 0.25; u < x1; u += 0.45)
      box(o, c, u, u + 0.15, 4.7, 4.88, z1 + 0.02, z1 + 0.16, 'band', C.band);
  // End roof finial is original geometric brickwork, not a copied ornament.
  box(o, c, end - 0.24, end + 0.24, 9.1, 9.6, z - 0.28, z + 0.28, 'brick', C.brick);
  if (c.detail) {
    const r = [
      [end - 0.34, 9.6, z - 0.34],
      [end + 0.34, 9.6, z - 0.34],
      [end + 0.34, 9.6, z + 0.34],
      [end - 0.34, 9.6, z + 0.34],
    ];
    for (let i = 0; i < 4; i++) T(o, c, [r[i], r[(i + 1) % 4], [end, 10.05, z]], 'band', C.band);
    Q(o, c, r, 'band', C.band, [0, -1, 0]);
  }
}
function central(o, c) {
  const x0 = -9.944,
    x1 = 9.652,
    z0 = -7.33,
    z1 = 7.331;
  const ground = [-3.7, 0, 3.7, 7.55].map((x, i) =>
    opening(arch(x, 0.85, i === 1 ? 1.85 : 2.15, 3.85, c.arch), i === 1 ? 'wood' : 'glass'),
  );
  const second = [-4.9, -2.1, 2.1, 4.9, 7.4].map((x) =>
    opening(arch(x, 7.0, Math.abs(x) === 4.9 ? 0.65 : 1.8, 2.55, c.arch, 0.4)),
  );
  const third = [
    opening(rectangle(0, 12.2, 2.0, 2.35)),
    opening(rectangle(-7.45, 11.4, 1.35, 2.15)),
    opening(rectangle(7.3, 11.4, 1.35, 2.15)),
  ];
  const top = [
    [x1, 0.35],
    [x1, 11.4],
    [7.3, 15.8],
    [4.9, 11.4],
    [0, 18.2],
    [-4.9, 11.4],
    [-7.45, 15.8],
    [x0, 11.4],
    [x0, 0.35],
  ];
  polygonWall(o, c, face('z', z1), top, [...ground, ...second, ...third]);
  const rear = [];
  for (const x of [-7.3, -3.7, 0, 3.7, 7.3]) {
    rear.push(opening(arch(-x, 0.85, 1.9, 3.85, c.arch), x === 0 ? 'wood' : 'glass'));
    rear.push(opening(arch(-x, 7, 1.55, 2.5, c.arch, 0.4)));
  }
  polygonWall(
    o,
    c,
    face('z', z0),
    [
      [-x1, 0.35],
      [-x0, 0.35],
      [-x0, 11.4],
      [-x1, 11.4],
    ],
    rear,
  );
  for (const end of [x0, x1]) {
    const p = face('x', end),
      sgn = Math.sign(end),
      left = sgn > 0 ? -z1 : z0,
      right = sgn > 0 ? -z0 : z1;
    polygonWall(
      o,
      c,
      p,
      [
        [left, 0.35],
        [right, 0.35],
        [right, 11.4],
        [0, 17.5],
        [left, 11.4],
      ],
      [
        ...[-3.5, 3.5].map((u) => opening(arch(u, 7.0, 1.6, 2.5, c.arch, 0.4))),
        opening(arch(0, 12.4, 1.45, 2.1, c.arch)),
      ],
    );
  }
  gableRoof(o, c, x0 - 0.17, x1 + 0.17, z0 - 0.2, z1 + 0.2, 11.4, 17.5);
  for (const [x, h, w] of [
    [-7.45, 15.8, 2.49],
    [0, 18.2, 4.9],
    [7.3, 15.8, 2.35],
  ]) {
    crossRoof(o, c, x, w, z1 + 0.04, -0.4, 11.4, h);
    box(o, c, x - 0.32, x + 0.32, h - 0.12, h + 0.65, z1 - 0.22, z1 + 0.32, 'brick', C.brick);
    box(o, c, x - 0.44, x + 0.44, h + 0.65, h + 0.85, z1 - 0.34, z1 + 0.44, 'roof', C.roof);
  }
  for (const [y, h] of c === cfg.skyline
    ? [
        [5.45, 0.18],
        [10.9, 0.16],
      ]
    : [
        [5.45, 0.18],
        [10.55, 0.16],
        [10.9, 0.16],
      ])
    course(o, c, x0 - 0.08, x1 + 0.08, z0 - 0.08, z1 + 0.08, y, h);
  if (c.fine) {
    for (let x = x0 + 0.2; x < x1; x += 0.4)
      box(o, c, x, x + 0.13, 5.1, 5.35, z1 + 0.03, z1 + 0.2, 'band', C.band);
  }
  for (const x of [-7.4, 0, 7.4])
    for (const z of [-3.2, 1.2]) {
      box(o, c, x - 0.36, x + 0.36, 14.5, 18.7, z - 0.42, z + 0.42, 'brick', C.brick);
      box(o, c, x - 0.5, x + 0.5, 18.7, 18.93, z - 0.56, z + 0.56, 'roof', C.roof);
    }
}
function bay(o, c) {
  const X = -7.5,
    Z = 7.331,
    R = 1.55,
    n = c.detail ? 5 : 3,
    ring = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    ring.push([X + R * Math.cos(a), Z + R * Math.sin(a)]);
  }
  slab(o, c, ring, -3, 0.35);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI,
      b = ((i + 1) / n) * Math.PI,
      A = [X + R * Math.cos(a), Z + R * Math.sin(a)],
      B = [X + R * Math.cos(b), Z + R * Math.sin(b)],
      L = Math.hypot(B[0] - A[0], B[1] - A[1]),
      t = [(B[0] - A[0]) / L, (B[1] - A[1]) / L],
      N = [t[1], -t[0]],
      p = ([u, y, v]) => [
        (A[0] + B[0]) / 2 + t[0] * u + N[0] * v,
        y,
        (A[1] + B[1]) / 2 + t[1] * u + N[1] * v,
      ],
      holes = [opening(arch(0, 6.5, L * 0.7, 1.3, c.arch, 0.45))];
    if (i === Math.floor(n / 2)) holes.push(opening(rectangle(0, 1.4, L * 0.92, 1.7)));
    polygonWall(
      o,
      c,
      p,
      [
        [-L / 2, 0.35],
        [L / 2, 0.35],
        [L / 2, 8.6],
        [-L / 2, 8.6],
      ],
      holes,
    );
  }
  const profile = [
      [8.55, 1.75],
      [8.75, 1.7],
      [9.55, 1.45],
      [10.2, 0.95],
      [10.35, 0.3],
    ],
    N = c.round * 2,
    point = (r, i) => [
      X + r[1] * Math.cos((i / N) * Math.PI),
      r[0],
      Z + r[1] * Math.sin((i / N) * Math.PI),
    ];
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < N; i++)
      Q(
        o,
        c,
        [
          point(profile[j - 1], i),
          point(profile[j], i),
          point(profile[j], i + 1),
          point(profile[j - 1], i + 1),
        ],
        'roof',
        C.roof,
      );
  for (const [r, normal] of [
    [profile[0], [0, -1, 0]],
    [profile.at(-1), [0, 1, 0]],
  ])
    for (let i = 0; i < N; i++)
      T(o, c, [[X, r[0], Z], point(r, i), point(r, i + 1)], 'roof', C.roof, normal);
  const edge = [
    ...profile.map((r) => point(r, 0)),
    ...profile.toReversed().map((r) => point(r, N)),
  ];
  for (let i = 1; i < edge.length - 1; i++)
    T(o, c, [edge[0], edge[i], edge[i + 1]], 'roof', C.roof, [0, 0, -1]);
}
function clock(o, c) {
  const x = 0,
    y = 16.0,
    z = 7.49,
    R = 0.95,
    n = c.round * 2;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2,
      b = ((i + 1) / n) * Math.PI * 2;
    T(
      o,
      c,
      [
        [x, y, z],
        [x + R * Math.cos(a), y + R * Math.sin(a), z],
        [x + R * Math.cos(b), y + R * Math.sin(b), z],
      ],
      'stone',
      C.clock,
      [0, 0, 1],
    );
  }
  if (c.detail)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2;
      Q(
        o,
        c,
        [
          [R * Math.cos(a), y + R * Math.sin(a), z + 0.02],
          [R * Math.cos(b), y + R * Math.sin(b), z + 0.02],
          [(R + 0.1) * Math.cos(b), y + (R + 0.1) * Math.sin(b), z + 0.02],
          [(R + 0.1) * Math.cos(a), y + (R + 0.1) * Math.sin(a), z + 0.02],
        ],
        'band',
        C.band,
        [0, 0, 1],
      );
    }
  if (c.fine)
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      beam(
        adapter(o, c),
        'metal',
        [0.72 * Math.cos(a), y + 0.72 * Math.sin(a), z + 0.055],
        [0.84 * Math.cos(a), y + 0.84 * Math.sin(a), z + 0.055],
        0.035,
        0.035,
        C.metal,
      );
    }
  // Original static clock hands; no real-time clock or copied numerals are claimed.
  beam(adapter(o, c), 'metal', [0, y, z + 0.08], [-0.35, y + 0.4, z + 0.08], 0.065, 0.06, C.metal);
  beam(adapter(o, c), 'metal', [0, y, z + 0.08], [0.35, y + 0.6, z + 0.08], 0.055, 0.05, C.metal);
}
function entrance(o, c) {
  const depth = c.fine ? 0.28 : c.detail ? 0.12 : -0.01;
  const z = 7.331 - depth + 0.015;
  const transom = arch(0, 2.9, 1.5, 1.55, c.arch);
  const ids = earcut(transom.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      c,
      ids.slice(i, i + 3).map((j) => [...transom[j], z]),
      'glass',
      C.glass,
      [0, 0, 1],
    );
  if (c.fine) {
    beamPath(
      adapter(o, c),
      'wood',
      transom.map(([u, y]) => [u, y, z + 0.035]),
      0.07,
      0.07,
      C.wood,
      true,
    );
    beam(adapter(o, c), 'wood', [0, 0.85, z + 0.03], [0, 2.9, z + 0.03], 0.065, 0.06, C.wood);
    for (const x of [-0.46, 0.46])
      beamPath(
        adapter(o, c),
        'wood',
        [
          [x - 0.32, 1.15, z + 0.035],
          [x + 0.32, 1.15, z + 0.035],
          [x + 0.32, 2.55, z + 0.035],
          [x - 0.32, 2.55, z + 0.035],
        ],
        0.045,
        0.04,
        C.wood,
        true,
      );
  }
}
function lamps(o, c) {
  if (!c.fine) return;
  for (const x of [-17, -12, -4.9, 4.9, 9.2, 17]) {
    const z = Math.abs(x) > 10 ? 5.9 : 7.55;
    beam(adapter(o, c), 'metal', [x, 2.8, z], [x, 3.25, z + 0.4], 0.065, 0.065, C.metal);
    sphere(
      adapter(o, c),
      'stone',
      [x, 3.38, z + 0.4],
      [0.14, 0.2, 0.14],
      C.clock,
      c.near ? 12 : 6,
      c.master ? 12 : 6,
    );
  }
}
export function buildStationLevel(o, level = 'master') {
  const c = cfg[level];
  if (!c) throw Error('Unknown station tier ' + level);
  slab(o, c, stationPlan, -3, 0.35);
  wing(o, c, -18.5, -9.944);
  wing(o, c, 9.652, 18.5);
  central(o, c);
  bay(o, c);
  clock(o, c);
  entrance(o, c);
  lamps(o, c);
}
export const buildStationSkyline = (o) => buildStationLevel(o, 'skyline');
export const buildStationDistrict = (o) => buildStationLevel(o, 'district');
export const buildStationStreet = (o) => buildStationLevel(o, 'street');
export const buildStationCloseup = (o) => buildStationLevel(o, 'closeup');

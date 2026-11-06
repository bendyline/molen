/** Original medium-fi Tsar Cannon, complete display carriage and four-ball display. */
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
  bronze: lin('88aa97'),
  bronzeEdge: lin('97b29d'),
  inside: lin('34483e'),
  iron: lin('55585a'),
  ironEdge: lin('737779'),
  ball: lin('4d5152'),
  stone: lin('c4bba8'),
  joint: lin('a49b89'),
  bed: lin('c6c6ba'),
};
export const cannonSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.8 },
  bronze: { slot: 'wall', graph: 'metal_bronze_cast', roughness: 0.73, metallic: 0.5 },
  iron: { slot: 'door', graph: 'metal_painted', roughness: 0.78, metallic: 0.55 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.9 },
};
const configs = {
  skyline: { n: 10, wheel: 10, hub: 6, spokes: 4, curve: 1, ball: 6, lat: 3 },
  district: { n: 24, wheel: 24, hub: 12, spokes: 8, curve: 1, ball: 12, lat: 6, detail: true },
  street: {
    n: 48,
    wheel: 48,
    hub: 24,
    spokes: 8,
    curve: 4,
    ball: 24,
    lat: 12,
    detail: true,
    ornament: true,
  },
  closeup: {
    n: 96,
    wheel: 96,
    hub: 48,
    spokes: 8,
    curve: 8,
    ball: 48,
    lat: 24,
    detail: true,
    ornament: true,
    fine: true,
  },
  master: {
    n: 192,
    wheel: 192,
    hub: 96,
    spokes: 8,
    curve: 16,
    ball: 96,
    lat: 48,
    detail: true,
    ornament: true,
    fine: true,
    master: true,
  },
};
const sub = (a, b) => a.map((v, i) => v - b[i]),
  cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ],
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function T(o, c, p, s = 'bronze', col = C.bronze, N) {
  p = p.map((p) => p.map(Math.fround));
  if (Math.hypot(...cross(sub(p[1], p[0]), sub(p[2], p[0]))) < 1e-8) return;
  if (N && dot(normalFor(...p), N) < 0) p.reverse();
  o.addTriangle(
    c === configs.skyline ? 'far' : s,
    'palette:#ffffff',
    p,
    normalFor(...p),
    [
      [0, 0],
      [1, 0],
      [0, 1],
    ],
    col,
  );
}
function Q(o, c, p, s = 'bronze', col = C.bronze, N) {
  T(o, c, p.slice(0, 3), s, col, N);
  T(o, c, [p[0], p[2], p[3]], s, col, N);
}
function adapter(o, c) {
  return {
    addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
    addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
    addConvexPolygon: (s, r, p, n, uv, col) => {
      for (let i = 1; i < p.length - 1; i++) T(o, c, [p[0], p[i], p[i + 1]], s, col, n);
    },
  };
}
function box(o, c, min, max, s = 'iron', col = C.iron) {
  for (let axis = 0; axis < 3; axis++)
    for (const end of [0, 1]) {
      const a = (axis + 1) % 3,
        b = (axis + 2) % 3,
        p = [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 1],
        ].map(([u, v]) => {
          const q = [0, 0, 0];
          q[axis] = (end ? max : min)[axis];
          q[a] = (u ? max : min)[a];
          q[b] = (v ? max : min)[b];
          return q;
        }),
        N = [0, 0, 0];
      N[axis] = end ? 1 : -1;
      Q(o, c, p, s, col, N);
    }
}
function prismX(o, c, P, lo, hi, s = 'iron', col = C.iron) {
  const area = P.reduce((sum, p, i) => {
      const q = P[(i + 1) % P.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0),
    sign = Math.sign(area),
    indices = earcut(P.flat());
  for (let i = 0; i < P.length; i++) {
    const p = P[i],
      q = P[(i + 1) % P.length];
    Q(
      o,
      c,
      [
        [lo, p[1], p[0]],
        [hi, p[1], p[0]],
        [hi, q[1], q[0]],
        [lo, q[1], q[0]],
      ],
      s,
      col,
      [0, -sign * (q[0] - p[0]), sign * (q[1] - p[1])],
    );
  }
  for (const [x, n] of [
    [lo, -1],
    [hi, 1],
  ])
    for (let i = 0; i < indices.length; i += 3)
      T(
        o,
        c,
        indices.slice(i, i + 3).map((j) => [x, P[j][1], P[j][0]]),
        s,
        col,
        [n, 0, 0],
      );
}
const barrelY = (z) => 2.57 + 0.035 * z;
const profile = [
  [-2.7, 0.65],
  [-2.64, 0.67],
  [-2.52, 0.67],
  [-2.46, 0.61],
  [-1.95, 0.61],
  [-1.91, 0.65],
  [-1.83, 0.65],
  [-1.79, 0.61],
  [-0.65, 0.62],
  [-0.62, 0.67],
  [-0.54, 0.67],
  [-0.5, 0.62],
  [0.65, 0.64],
  [0.68, 0.69],
  [0.76, 0.69],
  [0.8, 0.64],
  [2.32, 0.66],
  [2.36, 0.76],
  [2.48, 0.77],
  [2.6, 0.76],
  [2.64, 0.73],
];
function radius(z) {
  let i = 1;
  while (i < profile.length - 1 && z > profile[i][0]) i++;
  const a = profile[i - 1],
    b = profile[i],
    t = (z - a[0]) / (b[0] - a[0]);
  return a[1] + (b[1] - a[1]) * Math.max(0, Math.min(1, t));
}
function barrel(o, c) {
  const rs =
      c === configs.skyline
        ? [
            [-2.7, 0.65],
            [-2.46, 0.61],
            [-0.6, 0.63],
            [0.72, 0.65],
            [2.32, 0.66],
            [2.36, 0.76],
            [2.64, 0.73],
          ]
        : profile,
    inside =
      c === configs.skyline
        ? [
            [-2.15, 0.32],
            [2.3, 0.445],
            [2.64, 0.445],
          ]
        : [
            [-2.15, 0.32],
            [-1.95, 0.37],
            [-1.55, 0.445],
            [2.3, 0.445],
            [2.64, 0.445],
          ],
    point = ([z, r], i) => {
      const t = (2 * Math.PI * i) / c.n;
      return [r * Math.sin(t), barrelY(z) + r * Math.cos(t), z];
    };
  for (const [rows, inner] of [
    [rs, false],
    [inside, true],
  ])
    for (let j = 1; j < rows.length; j++)
      for (let i = 0; i < c.n; i++) {
        const p = [
            point(rows[j - 1], i),
            point(rows[j - 1], i + 1),
            point(rows[j], i + 1),
            point(rows[j], i),
          ],
          m = p.reduce((a, p) => a.map((v, i) => v + p[i] / 4), [0, 0, 0]),
          N = [m[0], m[1] - barrelY(m[2]), -0.035 * (m[1] - barrelY(m[2]))].map((v) =>
            inner ? -v : v,
          );
        Q(o, c, p, 'bronze', inner ? C.inside : C.bronze, N);
      }
  for (let i = 0; i < c.n; i++) {
    Q(
      o,
      c,
      [
        point(rs.at(-1), i),
        point(rs.at(-1), i + 1),
        point(inside.at(-1), i + 1),
        point(inside.at(-1), i),
      ],
      'bronze',
      C.bronzeEdge,
      [0, 0, 1],
    );
    T(
      o,
      c,
      [[0, barrelY(-2.7), -2.7], point(rs[0], i), point(rs[0], i + 1)],
      'bronze',
      C.bronze,
      [0, 0, -1],
    );
    T(
      o,
      c,
      [[0, barrelY(-2.15), -2.15], point(inside[0], i), point(inside[0], i + 1)],
      'bronze',
      C.inside,
      [0, 0, 1],
    );
  }
  const out = adapter(o, c),
    zs = c === configs.skyline ? [-1.5, 1.4] : [-1.6, -0.55, 0.55, 1.6];
  for (const z of zs)
    for (const sign of [-1, 1]) {
      const y = barrelY(z) - 0.02;
      box(
        o,
        c,
        [sign < 0 ? -0.93 : 0.58, y - 0.07, z - 0.16],
        [sign < 0 ? -0.58 : 0.93, y + 0.07, z + 0.16],
        'bronze',
        C.bronzeEdge,
      );
    }
  for (const sign of [-1, 1])
    cylinderX(
      o,
      c,
      sign < 0 ? -1.0 : 0.6,
      sign < 0 ? -0.6 : 1.0,
      barrelY(0.15),
      0.15,
      0.18,
      c.hub,
      'bronze',
      C.bronzeEdge,
    );
  if (c.ornament) {
    const segments = c.master ? 48 : c.fine ? 32 : 16;
    for (const z of [-2.56, -1.87, -0.58, 0.72, 2.45])
      for (let k = 0; k < (c.fine ? 24 : 16); k++) {
        const a = (k * 2 * Math.PI) / (c.fine ? 24 : 16),
          p = Array.from({ length: segments / 4 }, (_, i) => {
            const t = (i * 2 * Math.PI) / (segments / 4),
              Z = z + 0.055 * Math.sin(t),
              r = radius(Z) + 0.007;
            return [
              r * Math.sin(a + 0.035 * Math.cos(t)),
              barrelY(Z) + r * Math.cos(a + 0.035 * Math.cos(t)),
              Z,
            ];
          });
        beamPath(out, 'bronze', p, 0.018, 0.018, C.bronzeEdge, true);
      }
  }
}
function cylinderX(o, c, lo, hi, Y, Z, R, n, s = 'iron', col = C.iron) {
  const point = (x, i) => {
    const t = (2 * Math.PI * i) / n;
    return [x, Y + R * Math.cos(t), Z + R * Math.sin(t)];
  };
  for (let i = 0; i < n; i++) {
    const p = [point(lo, i), point(hi, i), point(hi, i + 1), point(lo, i + 1)];
    Q(o, c, p, s, col, [
      0,
      p.reduce((s, p) => s + p[1] - Y, 0),
      p.reduce((s, p) => s + p[2] - Z, 0),
    ]);
    for (const [x, N] of [
      [lo, -1],
      [hi, 1],
    ])
      T(o, c, [[x, Y, Z], point(x, i), point(x, i + 1)], s, col, [N, 0, 0]);
  }
}
function wheelRing(o, c, X, Y, Z, outer, inner, depth, n, col = C.iron) {
  const p = (x, r, i) => {
    const t = (2 * Math.PI * i) / n;
    return [x, Y + r * Math.cos(t), Z + r * Math.sin(t)];
  };
  for (let i = 0; i < n; i++) {
    const a = i,
      b = i + 1,
      lo = X - depth / 2,
      hi = X + depth / 2;
    for (const [x, N] of [
      [lo, -1],
      [hi, 1],
    ])
      Q(o, c, [p(x, outer, a), p(x, outer, b), p(x, inner, b), p(x, inner, a)], 'iron', col, [
        N,
        0,
        0,
      ]);
    Q(o, c, [p(lo, outer, a), p(hi, outer, a), p(hi, outer, b), p(lo, outer, b)], 'iron', col, [
      0,
      Math.cos(((a + 0.5) * 2 * Math.PI) / n),
      Math.sin(((a + 0.5) * 2 * Math.PI) / n),
    ]);
    Q(o, c, [p(lo, inner, a), p(lo, inner, b), p(hi, inner, b), p(hi, inner, a)], 'iron', col, [
      0,
      -Math.cos(((a + 0.5) * 2 * Math.PI) / n),
      -Math.sin(((a + 0.5) * 2 * Math.PI) / n),
    ]);
  }
}
function spokes(o, c, X, Y, Z) {
  for (let k = 0; k < c.spokes; k++) {
    const a = (k * 2 * Math.PI) / c.spokes,
      rs = Array.from({ length: c.curve + 1 }, (_, i) => {
        const u = i / c.curve,
          t = a + (c.ornament ? 0.2 * Math.sin(Math.PI * u) : 0),
          r = 0.17 + 0.67 * u,
          w = 0.13 + 0.055 * Math.sin(Math.PI * u),
          d = 0.15;
        return { center: [X, Y + r * Math.cos(t), Z + r * Math.sin(t)], t, w, d };
      });
    for (let j = 1; j < rs.length; j++) {
      const A = rs[j - 1],
        B = rs[j],
        dy = B.center[1] - A.center[1],
        dz = B.center[2] - A.center[2],
        L = Math.hypot(dy, dz),
        side = [0, -dz / L, dy / L],
        ring = (q) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([u, v]) =>
            q.center.map((p, i) => p + (i === 0 ? (u * q.d) / 2 : (side[i] * v * q.w) / 2)),
          ),
        p = ring(A),
        q = ring(B);
      for (let i = 0; i < 4; i++) {
        const n = (i + 1) % 4;
        Q(o, c, [p[i], p[n], q[n], q[i]], 'iron', C.ironEdge, [
          p[i][0] + p[n][0] - 2 * X,
          p[i][1] + p[n][1] - 2 * A.center[1],
          p[i][2] + p[n][2] - 2 * A.center[2],
        ]);
      }
      if (j === 1) Q(o, c, p, 'iron', C.ironEdge, [0, -dy, -dz]);
      if (j === rs.length - 1) Q(o, c, q, 'iron', C.ironEdge, [0, dy, dz]);
    }
  }
}
function carriage(o, c) {
  const Y = 1.36,
    Z = 0.25,
    out = adapter(o, c);
  for (const sign of [-1, 1]) {
    const X = sign * 1.03;
    wheelRing(o, c, X, Y, Z, 1, 0.8, 0.2, c.wheel);
    spokes(o, c, X, Y, Z);
    cylinderX(o, c, X - 0.2, X + 0.2, Y, Z, 0.2, c.hub);
    cylinderX(o, c, X - 0.24, X + 0.24, Y, Z, 0.12, c.hub, 'iron', C.ironEdge);
    if (c.detail) {
      wheelRing(o, c, X + sign * 0.105, Y, Z, 0.98, 0.92, 0.035, c.wheel, C.ironEdge);
      if (c.fine) wheelRing(o, c, X + sign * 0.11, Y, Z, 0.85, 0.81, 0.025, c.wheel, C.ironEdge);
    }
  }
  const P =
    c === configs.skyline
      ? [
          [-2.8, 0.56],
          [-2.8, 1.1],
          [-1.65, 1.56],
          [-0.82, 2.4],
          [0.8, 2.4],
          [1.45, 1.55],
          [1.45, 0.82],
          [-2.2, 0.56],
        ]
      : [
          [-2.8, 0.56],
          [-2.8, 1.1],
          [-2.0, 1.13],
          [-1.65, 1.56],
          [-0.85, 1.72],
          [-0.82, 2.4],
          [0.8, 2.4],
          [1.12, 1.63],
          [1.45, 1.55],
          [1.45, 0.82],
          [0.8, 0.72],
          [0.25, 0.85],
          [-1.2, 0.74],
          [-2.2, 0.56],
        ];
  for (const sign of [-1, 1]) prismX(o, c, P, sign < 0 ? -0.77 : 0.57, sign < 0 ? -0.57 : 0.77);
  for (const z of [-1.85, 0, 1.0]) box(o, c, [-0.67, 1.03, z - 0.14], [0.67, 1.25, z + 0.14]);
  cylinderX(o, c, -0.35, 0.35, 0.68, -2.35, 0.32, c.hub);
  cylinderX(o, c, -1.15, 1.15, Y, Z, 0.095, c.hub);
  // An original faceted front casting substitutes for the pictured figurative lion.
  box(o, c, [-0.55, 1.14, 1.4], [0.55, 1.66, 1.7]);
  prismX(
    o,
    c,
    [
      [1.7, 1.14],
      [1.87, 1.25],
      [1.92, 1.48],
      [1.7, 1.66],
    ],
    -0.38,
    0.38,
    'iron',
    C.ironEdge,
  );
  if (!c.detail) return;
  for (const sign of [-1, 1]) {
    const x = sign * 0.782;
    beamPath(
      out,
      'iron',
      P.slice(0, 8).map(([z, y]) => [x, y - 0.035, z]),
      0.028,
      0.032,
      C.ironEdge,
    );
    if (c.ornament) {
      const n = c.master ? 72 : c.fine ? 48 : 24,
        scroll = Array.from({ length: n }, (_, i) => {
          const u = i / (n - 1),
            z = -2.6 + 1.7 * u,
            y = 0.96 + 0.54 * u + 0.12 * Math.sin(u * 4 * Math.PI);
          return [x, y, z];
        });
      beamPath(out, 'iron', scroll, 0.034, 0.04, C.ironEdge);
      for (const z of [-0.55, -0.1, 0.35]) {
        const ring = Array.from({ length: c.fine ? 24 : 12 }, (_, i) => {
          const t = (i * 2 * Math.PI) / (c.fine ? 24 : 12);
          return [x, 2.19 + 0.1 * Math.sin(t), z + 0.14 * Math.cos(t)];
        });
        beamPath(out, 'iron', ring, 0.03, 0.035, C.ironEdge, true);
      }
      const oval = Array.from({ length: c.fine ? 32 : 16 }, (_, i) => {
        const t = (i * 2 * Math.PI) / (c.fine ? 32 : 16);
        return [x, 1.35 + 0.17 * Math.sin(t), -1.55 + 0.28 * Math.cos(t)];
      });
      beamPath(out, 'iron', oval, 0.04, 0.04, C.ironEdge, true);
    }
  }
}
export const cannonBallCenters = [
  [-0.48, 0.62, 3.8],
  [0.48, 0.62, 3.8],
  [0, 0.62, 4.631384387633061],
  [0, 1.403836717690617, 4.077128129211021],
];
function platform(o, c) {
  box(o, c, [-1.6, -2, -3.02], [1.6, 0.36, 2.12], 'stone', C.stone);
  box(o, c, [-1.09, -0.4, 3.22], [1.09, 0.14, 5.2], 'stone', C.bed);
  if (c.detail) {
    box(o, c, [-1.602, 0.17, -3.022], [1.602, 0.185, 2.122], 'stone', C.joint);
    for (const sign of [-1, 1])
      for (const z of [-2.25, -1.2, -0.15, 0.9])
        box(
          o,
          c,
          [sign * 1.604 - 0.006, 0.19, z - 0.008],
          [sign * 1.604 + 0.006, 0.35, z + 0.008],
          'stone',
          C.joint,
        );
  }
}
export function buildCannonLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Tsar Cannon tier ' + level);
  platform(o, c);
  carriage(o, c);
  barrel(o, c);
  const out = adapter(o, c);
  for (const p of cannonBallCenters)
    sphere(out, 'iron', p, [0.48, 0.48, 0.48], C.ball, c.ball, c.lat);
}
export const buildCannonSkyline = (o) => buildCannonLevel(o, 'skyline');
export const buildCannonDistrict = (o) => buildCannonLevel(o, 'district');
export const buildCannonStreet = (o) => buildCannonLevel(o, 'street');
export const buildCannonCloseup = (o) => buildCannonLevel(o, 'closeup');

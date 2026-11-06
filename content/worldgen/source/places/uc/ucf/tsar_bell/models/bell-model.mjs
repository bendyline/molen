/** Original medium-fi interpretation of the actual broken Tsar Bell exterior. */
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const F = 1.05;
const lin = (h) =>
    h.match(/\w\w/g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  C = {
    bronze: lin('829285'),
    inside: lin('555f52'),
    edge: lin('9b9e88'),
    stone: lin('c8bca5'),
    joints: lin('b1a48c'),
    screen: lin('30352e'),
    gold: lin('cdb86a'),
  };
export const bellSurfaces = {
  far: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.8 },
  bronze: { slot: 'wall', graph: 'metal_bronze_cast', roughness: 0.76, metallic: 0.55 },
  relief: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.72, metallic: 0.55 },
  base: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.9 },
  screen: { slot: 'door', graph: 'metal_painted', roughness: 0.9, metallic: 0.2 },
};
const configs = {
  skyline: { n: 10, div: 1, fragment: 4, cap: 8, handle: 2 },
  district: { n: 18, div: 1, fragment: 8, cap: 12, handle: 3, detail: true },
  street: { n: 48, div: 1, fragment: 16, cap: 24, handle: 5, detail: true, ornament: true },
  closeup: {
    n: 96,
    div: 2,
    fragment: 32,
    cap: 48,
    handle: 8,
    detail: true,
    ornament: true,
    fine: true,
  },
  master: {
    n: 192,
    div: 5,
    fragment: 72,
    cap: 96,
    handle: 16,
    detail: true,
    ornament: true,
    fine: true,
    master: true,
  },
};
const profile = [
    [0, 3.3],
    [0.18, 3.3],
    [0.35, 3.19],
    [0.55, 3.1],
    [0.8, 2.95],
    [1.1, 2.78],
    [1.4, 2.65],
    [1.65, 2.55],
    [1.82, 2.5],
    [1.96, 2.46],
    [2.05, 2.44],
    [2.3, 2.41],
    [3.1, 2.3],
    [3.33, 2.27],
    [3.48, 2.25],
    [3.65, 2.24],
    [3.78, 2.2],
    [4.0, 2.08],
    [4.2, 1.85],
    [4.35, 1.5],
    [4.4, 1.15],
  ],
  fracture = [
    [0, 0.44],
    [0.4, 0.42],
    [0.75, 0.415],
    [1.1, 0.3],
    [1.4, 0.25],
    [1.65, 0.2],
    [1.82, 0.18],
    [1.96, 0.07],
    [2.05, 0],
  ];
function at(rows, y) {
  let i = 1;
  while (i < rows.length - 1 && y > rows[i][0]) i++;
  const a = rows[i - 1],
    b = rows[i],
    t = Math.max(0, Math.min(1, (y - a[0]) / (b[0] - a[0])));
  return a[1] + t * (b[1] - a[1]);
}
const radius = (y) => at(profile, y),
  wedge = (y) => (y >= 2.05 ? 0 : at(fracture, y)),
  center = (y) => (y < 2.05 ? 0.025 * Math.sin(y * 4) : 0);
function rows(c) {
  const knots =
      c === configs.skyline
        ? [0, 0.35, 0.8, 1.4, 2.05, 2.3, 3.1, 3.65, 4.2, 4.4]
        : [...new Set([...profile.map((p) => p[0]), ...fracture.map((p) => p[0])])].sort(
            (a, b) => a - b,
          ),
    ys = [];
  for (let i = 1; i < knots.length; i++)
    for (let j = 0; j < c.div; j++) ys.push(knots[i - 1] + ((knots[i] - knots[i - 1]) * j) / c.div);
  return ys.concat(knots.at(-1));
}
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
function outFor(o, c) {
  return {
    addQuad: (s, r, p, n, uv, col) => Q(o, c, p, s, col, n),
    addTriangle: (s, r, p, n, uv, col) => T(o, c, p, s, col, n),
    addConvexPolygon: (s, r, p, n, uv, col) => {
      for (let j = 1; j < p.length - 1; j++) T(o, c, [p[0], p[j], p[j + 1]], s, col, n);
    },
  };
}
function shellPoint(y, t, inner = false) {
  const r = radius(y) - (inner ? 0.27 + 0.28 * Math.max(0, 1 - y / 1.1) : 0),
    Y = F + y - (inner ? 0.18 * Math.max(0, (y - 3.8) / 0.6) : 0);
  return [r * Math.sin(t), Y, r * Math.cos(t)];
}
function shell(o, c) {
  const ys = rows(c),
    point = (y, i, inner = false) =>
      shellPoint(y, wedge(y) + center(y) + ((2 * Math.PI - 2 * wedge(y)) * i) / c.n, inner);
  for (let j = 1; j < ys.length; j++)
    for (let i = 0; i < c.n; i++)
      for (const inner of [false, true]) {
        const p = [
            point(ys[j - 1], i, inner),
            point(ys[j - 1], i + 1, inner),
            point(ys[j], i + 1, inner),
            point(ys[j], i, inner),
          ],
          N = [p.reduce((s, p) => s + p[0], 0), 0, p.reduce((s, p) => s + p[2], 0)].map((v) =>
            inner ? -v : v,
          );
        Q(o, c, p, 'bronze', inner ? C.inside : C.bronze, N);
      }
  for (let j = 1; j < ys.length; j++)
    if (wedge(ys[j - 1]) > 0)
      for (const i of [0, c.n]) {
        const p = [
            point(ys[j - 1], i),
            point(ys[j], i),
            point(ys[j], i, true),
            point(ys[j - 1], i, true),
          ],
          a = wedge((ys[j - 1] + ys[j]) / 2),
          sgn = i === 0 ? -1 : 1;
        Q(o, c, p, 'bronze', C.edge, [sgn * Math.cos(a), -0.25, Math.sin(a)]);
      }
  for (let i = 0; i < c.n; i++)
    Q(
      o,
      c,
      [point(0, i), point(0, i, true), point(0, i + 1, true), point(0, i + 1)],
      'bronze',
      C.edge,
      [0, -1, 0],
    );
  for (const inner of [false, true])
    for (let i = 0; i < c.n; i++) {
      const p = point(4.4, i, inner),
        q = point(4.4, i + 1, inner);
      T(o, c, [[0, p[1], 0], p, q], 'bronze', inner ? C.inside : C.bronze, [0, inner ? -1 : 1, 0]);
    }
}
const fragmentTransform = (p) => {
  const y = p[1] - F,
    z = p[2] - 3,
    t = 0.28,
    roll = 0.28,
    Y = 0.12 + y * Math.cos(t) - z * Math.sin(t);
  return [
    p[0] * Math.cos(roll) - Y * Math.sin(roll) + 0.5,
    p[0] * Math.sin(roll) + Y * Math.cos(roll) - 0.2,
    4.35 + z * Math.cos(t) + y * Math.sin(t),
  ];
};
function fragment(o, c) {
  const ys = c === configs.skyline ? [0, 0.75, 1.4, 1.82, 2.05] : fracture.map((p) => p[0]),
    n = c.fragment,
    point = (y, i, inner = false) =>
      fragmentTransform(shellPoint(y, center(y) - wedge(y) + (2 * wedge(y) * i) / n, inner));
  for (let j = 1; j < ys.length; j++)
    for (let i = 0; i < n; i++)
      for (const inner of [false, true]) {
        const p = [
          point(ys[j - 1], i, inner),
          point(ys[j - 1], i + 1, inner),
          point(ys[j], i + 1, inner),
          point(ys[j], i, inner),
        ];
        Q(o, c, p, 'bronze', inner ? C.inside : C.bronze, [
          0,
          inner ? 0.28 : -0.28,
          inner ? -1 : 1,
        ]);
      }
  for (let j = 1; j < ys.length; j++)
    for (const i of [0, n])
      Q(
        o,
        c,
        [point(ys[j - 1], i), point(ys[j], i), point(ys[j], i, true), point(ys[j - 1], i, true)],
        'bronze',
        C.edge,
        [i === 0 ? -1 : 1, 0.2, 0],
      );
  for (let i = 0; i < n; i++)
    Q(
      o,
      c,
      [point(0, i), point(0, i + 1), point(0, i + 1, true), point(0, i, true)],
      'bronze',
      C.edge,
      [0, -1, 0],
    );
}
function solidLathe(o, c, rs, n, s = 'base', col = C.stone) {
  const p = ([y, r], i) => [
    r * Math.sin((2 * Math.PI * i) / n),
    y,
    r * Math.cos((2 * Math.PI * i) / n),
  ];
  for (let j = 1; j < rs.length; j++)
    for (let i = 0; i < n; i++) {
      const q = [p(rs[j - 1], i), p(rs[j - 1], i + 1), p(rs[j], i + 1), p(rs[j], i)];
      Q(o, c, q, s, col, [q.reduce((s, p) => s + p[0], 0), 0, q.reduce((s, p) => s + p[2], 0)]);
    }
  for (const [j, sign] of [
    [0, -1],
    [rs.length - 1, 1],
  ])
    for (let i = 0; i < n; i++)
      T(o, c, [[0, rs[j][0], 0], p(rs[j], i), p(rs[j], i + 1)], s, col, [0, sign, 0]);
}
function base(o, c) {
  solidLathe(
    o,
    c,
    [
      [-3, 3.48],
      [0.08, 3.48],
      [1.01, 3.48],
      [1.05, 3.54],
    ],
    c.n,
  );
  if (c.detail) {
    for (const y of [0.12, 0.51, 0.96])
      solidLathe(
        o,
        c,
        [
          [y, 3.487],
          [y + 0.018, 3.487],
        ],
        c.n,
        'base',
        C.joints,
      );
    const out = outFor(o, c);
    for (let i = 0; i < 12; i++) {
      const t = (i * 2 * Math.PI) / 12;
      for (const y of [0.15, 0.55])
        beam(
          out,
          'base',
          [3.49 * Math.sin(t + (y > 0.3 ? 0.2 : 0)), y, 3.49 * Math.cos(t + (y > 0.3 ? 0.2 : 0))],
          [
            3.49 * Math.sin(t + (y > 0.3 ? 0.2 : 0)),
            y + 0.35,
            3.49 * Math.cos(t + (y > 0.3 ? 0.2 : 0)),
          ],
          0.013,
          0.014,
          C.joints,
        );
    }
  }
}
function crown(o, c) {
  const out = outFor(o, c),
    number = c === configs.skyline ? 4 : 6;
  for (let k = 0; k < number; k++) {
    const a = (2 * Math.PI * k) / number,
      rs = Array.from({ length: c.handle + 1 }, (_, i) => {
        const u = i / c.handle;
        return [0.25 + 0.6 * u, 5.44 + 0.62 * Math.sin(u * Math.PI), u];
      }),
      path = rs.map(([r, y]) => [r * Math.sin(a), y, r * Math.cos(a)]);
    for (let i = 1; i < path.length; i++)
      beam(out, 'relief', path[i - 1], path[i], c === configs.skyline ? 0.17 : 0.12, 0.17, C.edge);
  }
  solidLathe(
    o,
    c,
    [
      [6.0, 0.3],
      [6.07, 0.5],
      [6.2, 0.55],
      [6.33, 0.57],
      [6.45, 0.54],
      [6.57, 0.43],
      [6.72, 0.2],
      [6.82, 0.1],
    ],
    c.cap,
    'bronze',
    C.bronze,
  );
  beam(out, 'relief', [0, 6.75, 0], [0, 7.29, 0], 0.13, 0.13, C.gold);
  beam(out, 'relief', [-0.32, 7.05, 0], [0.32, 7.05, 0], 0.13, 0.13, C.gold);
}
function atSurface(a, y, d = 0.025) {
  const r = radius(y) + d;
  return [r * Math.sin(a), F + y, r * Math.cos(a)];
}
function relief(o, c) {
  if (!c.detail) return;
  const out = outFor(o, c),
    n = c.ornament ? c.n : 16;
  // Raised cast rings terminate on the real fracture instead of bridging the missing metal.
  for (const y of c.ornament ? [0.2, 0.37, 0.9, 3.25, 3.48, 3.77] : [0.2, 0.9, 3.48]) {
    const w = wedge(y) + 0.008,
      a = w + center(y),
      b = 2 * Math.PI - w + center(y);
    for (let i = 0; i < n; i++)
      beam(
        out,
        'relief',
        atSurface(a + ((b - a) * i) / n, y, 0.035),
        atSurface(a + ((b - a) * (i + 1)) / n, y, 0.035),
        0.045,
        0.045,
        C.edge,
      );
  }
  if (!c.ornament) return;
  const segments = c.master ? 40 : c.fine ? 24 : 12;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4,
      cy = k % 2 ? 3.8 : 2.65,
      rx = k % 2 ? 0.17 : 0.23,
      ry = k % 2 ? 0.23 : 0.5,
      pts = Array.from({ length: segments }, (_, i) => {
        const t = (i * 2 * Math.PI) / segments;
        return atSurface(a + rx * Math.cos(t), cy + ry * Math.sin(t), 0.045);
      });
    beamPath(out, 'relief', pts, 0.045, 0.045, C.edge, true);
    if (c.fine) {
      const inner = pts.map((_, i) => {
        const t = (i * 2 * Math.PI) / segments;
        return atSurface(a + rx * 0.8 * Math.cos(t), cy + ry * 0.8 * Math.sin(t), 0.05);
      });
      beamPath(out, 'relief', inner, 0.018, 0.024, C.edge, true);
      for (let s = 0; s < 6; s++) {
        const t = (s * Math.PI) / 3;
        beam(
          out,
          'relief',
          atSurface(a, cy, 0.05),
          atSurface(a + rx * 0.55 * Math.cos(t), cy + ry * 0.55 * Math.sin(t), 0.065),
          0.025,
          0.035,
          C.edge,
        );
      }
    }
  }
  for (let k = 0; k < (c.fine ? 36 : 24); k++) {
    const a = (k * 2 * Math.PI) / (c.fine ? 36 : 24);
    if (a < 0.49 || a > 2 * Math.PI - 0.49) continue;
    const pts = Array.from({ length: c.fine ? 12 : 8 }, (_, i) => {
      const t = (i * 2 * Math.PI) / (c.fine ? 12 : 8);
      return atSurface(a + 0.045 * Math.cos(t), 0.67 + 0.105 * Math.sin(t), 0.045);
    });
    beamPath(out, 'relief', pts, 0.025, 0.025, C.edge, true);
  }
}
function fragmentRelief(o, c) {
  const out = outFor(o, c),
    n = c.fragment;
  for (const y of c === configs.skyline ? [0.2, 0.9] : [0.2, 0.37, 0.9]) {
    const w = wedge(y) - 0.008;
    for (let i = 0; i < n; i++)
      beam(
        out,
        'relief',
        fragmentTransform(atSurface(center(y) - w + (2 * w * i) / n, y, 0.035)),
        fragmentTransform(atSurface(center(y) - w + (2 * w * (i + 1)) / n, y, 0.035)),
        0.045,
        0.045,
        C.edge,
      );
  }
  if (!c.ornament) return;
  for (let k = 0; k < 6; k++) {
    const a = -0.3 + (0.6 * (k + 0.5)) / 6,
      points = Array.from({ length: c.fine ? 16 : 8 }, (_, i) => {
        const t = (i * 2 * Math.PI) / (c.fine ? 16 : 8);
        return fragmentTransform(
          atSurface(a + 0.035 * Math.cos(t), 0.67 + 0.1 * Math.sin(t), 0.04),
        );
      });
    beamPath(out, 'relief', points, 0.025, 0.025, C.edge, true);
  }
}
function grille(o, c) {
  const out = outFor(o, c),
    z = 2.07;
  if (!c.ornament) {
    Q(
      o,
      c,
      [
        [-1.3, F, z],
        [1.3, F, z],
        [1.3, F + 2.05, z],
        [-1.3, F + 2.05, z],
      ],
      'screen',
      C.screen,
      [0, 0, 1],
    );
    return;
  }
  // Sparse actual lattice backed by the closed interior. It reads as the pictured safety grille.
  const count = c.master ? 48 : c.fine ? 28 : 16;
  for (let i = 0; i <= count; i++) {
    const x = -1.3 + (2.6 * i) / count;
    beam(out, 'screen', [x, F, z], [x, F + 2.08, z], 0.014, 0.014, C.screen);
  }
  for (let i = 0; i <= Math.ceil(count * 0.8); i++) {
    const y = F + (2.08 * i) / Math.ceil(count * 0.8);
    beam(out, 'screen', [-1.3, y, z], [1.3, y, z], 0.014, 0.014, C.screen);
  }
}
export function buildBellLevel(o, level = 'master') {
  const c = configs[level];
  if (!c) throw Error('Unknown Tsar Bell tier ' + level);
  base(o, c);
  shell(o, c);
  fragment(o, c);
  crown(o, c);
  relief(o, c);
  fragmentRelief(o, c);
  grille(o, c);
}
export const buildBellSkyline = (o) => buildBellLevel(o, 'skyline');
export const buildBellDistrict = (o) => buildBellLevel(o, 'district');
export const buildBellStreet = (o) => buildBellLevel(o, 'street');
export const buildBellCloseup = (o) => buildBellLevel(o, 'closeup');

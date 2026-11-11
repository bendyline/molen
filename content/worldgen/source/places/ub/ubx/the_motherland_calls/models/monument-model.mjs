/** Original model of The Motherland Calls and the low summit plinth. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  cross,
  normalFor,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { tubePath } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
const palette = {
  concrete: 'c7c1b3',
  pale: 'd0c7b7',
  fold: 'bdb5a6',
  hair: 'c3b9a7',
  cavity: '7b746a',
  edge: 'c1beb1',
  plinth: 'b6b4a9',
  apron: '878d72',
  steel: 'bcb7ab',
  bladeEdge: 'a8a6a0',
  steelDark: '888985',
};
const rgb = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((pair) => {
      const value = parseInt(pair, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
    }),
  ]),
);
export const surfaces = {
  body: { slot: 'wall', graph: 'concrete_plain', roughness: 0.87 },
  base: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.93 },
  sword: { slot: 'trim', graph: 'metal_stainless_beadblasted', roughness: 0.57, metallic: 0.31 },
  apron: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.98 },
};
const tier = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const TAU = 2 * Math.PI,
  UP = [0, 1, 0],
  DOWN = [0, -1, 0],
  FRONT = [0, 0, 1];
const add = (a, b) => a.map((v, i) => v + b[i]),
  sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, s) => a.map((v) => v * s),
  dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
const mix = (a, b, t) => a + (b - a) * t,
  lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const average = (ps) => ps[0].map((_, i) => ps.reduce((n, p) => n + p[i], 0) / ps.length);
const figurePoint = ([x, y, z]) => [x, y + layout.baseY, z];
const sides = [5, 8, 13, 19, 26];

function tri(out, slot, tint, points, direction) {
  let normal = normalFor(...points);
  if (Math.hypot(...normal) < 0.99) return;
  if (direction && dot(normal, direction) < 0) {
    points = points.toReversed();
    normal = scale(normal, -1);
  }
  out.addTriangle(slot, '', points, normal, undefined, rgb[tint]);
}
function quad(out, slot, tint, [a, b, c, d], direction) {
  tri(out, slot, tint, [a, b, c], direction);
  tri(out, slot, tint, [a, c, d], direction);
}
function cap(out, slot, tint, ring, height, wanted) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3)
    tri(
      out,
      slot,
      tint,
      indices.slice(i, i + 3).map((k) => [ring[k][0], height, ring[k][1]]),
      wanted,
    );
}
function prism(out, slot, tint, ring, low, high) {
  const signed = ring.reduce((n, p, i) => {
    const q = ring[(i + 1) % ring.length];
    return n + p[0] * q[1] - p[1] * q[0];
  }, 0);
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length],
      n = scale([b[1] - a[1], 0, a[0] - b[0]], Math.sign(signed));
    quad(
      out,
      slot,
      tint,
      [
        [a[0], low, a[1]],
        [b[0], low, b[1]],
        [b[0], high, b[1]],
        [a[0], high, a[1]],
      ],
      n,
    );
  }
  cap(out, slot, tint, ring, high, UP);
  cap(out, slot, tint, ring, low, DOWN);
}
const rect = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function box(out, slot, tint, x0, y0, z0, x1, y1, z1) {
  prism(out, slot, tint, rect(x0, z0, x1, z1), y0, y1);
}

function ribbonSkin(out, slot, tint, rings, capRings = true) {
  const N = rings[0].length;
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N,
        a = rings[j - 1][i],
        b = rings[j - 1][k],
        c = rings[j][k],
        e = rings[j][i];
      quad(out, slot, tint, [a, b, c, e]);
    }
  if (!capRings) return;
  for (const [r, reversed] of [
    [rings[0], true],
    [rings.at(-1), false],
  ]) {
    const c = average(r);
    for (let i = 0; i < N; i++) {
      const next = (i + 1) % N;
      tri(out, slot, tint, reversed ? [c, r[next], r[i]] : [c, r[i], r[next]]);
    }
  }
}
function subset(rows, d) {
  if (d >= 2) return rows;
  const n = rows.length;
  if (d === 1) return rows.filter((_, i) => i === n - 1 || i % 2 === 0);
  return rows.filter((_, i) => i === 0 || i === n - 1 || i === Math.floor(n * 0.55));
}
function sculptLimb(out, rows, d, tint = 'concrete', transform = figurePoint, fold = 0.04) {
  const rs = subset(rows, d),
    N = sides[d],
    centers = rs.map(([x, y, z]) => transform([x, y, z]));
  let previous;
  const rings = centers.map((center, i) => {
    const next = centers[Math.min(i + 1, centers.length - 1)],
      before = centers[Math.max(0, i - 1)];
    const axis = normalize(sub(next, before));
    let u;
    if (previous) {
      const projected = sub(previous, scale(axis, dot(previous, axis)));
      if (Math.hypot(...projected) > 0.1) u = normalize(projected);
    }
    u ??= normalize(cross(axis, Math.abs(axis[1]) > 0.91 ? [1, 0, 0] : UP));
    previous = u;
    const v = cross(axis, u),
      width = rs[i][3],
      depth = rs[i][4] ?? width;
    return Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        k = 1 + fold * (0.75 * Math.sin(a * 3 + 0.79 * i) + 0.25 * Math.cos(a * 7 - 0.53 * i));
      return add(center, add(scale(u, width * k * Math.cos(a)), scale(v, depth * k * Math.sin(a))));
    });
  });
  ribbonSkin(out, 'body', tint, rings);
}

function foundation(out, d) {
  const { plinth, baseY, apron } = layout;
  const grow = (n) => plinth.map(([x, z]) => [x + Math.sign(x) * n, z + Math.sign(z) * n]);
  prism(out, 'base', 'plinth', grow(0.095), -4.6, baseY - 1.92);
  prism(out, 'base', 'edge', grow(0.23), baseY - 2.21, baseY - 1.86);
  prism(out, 'base', 'concrete', plinth, baseY - 1.865, baseY - 0.119);
  prism(out, 'base', 'pale', grow(0.04), baseY - 0.12, baseY);
  const rows =
    d === 0 ? [apron[0], apron.at(-1)] : d === 1 ? apron.filter((_, i) => i % 2 === 0) : apron;
  const step = d === 0 ? 5 : d === 1 ? 2 : 1;
  for (let k = 1; k < rows.length; k++)
    for (let j = 0; j < rows[k].length; j += step) {
      const next = (j + step) % rows[k].length;
      quad(
        out,
        'apron',
        'apron',
        [rows[k - 1][j], rows[k - 1][next], rows[k][next], rows[k][j]],
        UP,
      );
    }
  if (d >= 2)
    for (const x of [-8.6, -4.3, 0, 4.3, 8.6])
      for (const side of [-1, 1]) {
        const z = side * 9.558;
        box(
          out,
          'base',
          'edge',
          x - 0.021,
          baseY - 1.83,
          z - 0.021,
          x + 0.021,
          baseY - 0.12,
          z + 0.021,
        );
      }
}
function torso(out, d) {
  const rows = [
    [26.2, 0.52, -0.72, 4.03, 3.38],
    [27.96, 0.57, -0.35, 4.12, 3.16],
    [29.46, 0.57, -0.03, 3.92, 3.03],
    [31.25, 0.62, 0.26, 3.47, 2.6],
    [33.38, 0.55, 0.72, 3.25, 2.5],
    [35.55, 0.34, 0.91, 3.42, 2.69],
    [37.5, 0.19, 1.14, 3.81, 2.78],
    [39.65, 0.04, 1.29, 4.31, 2.94],
    [41.05, -0.06, 1.46, 4.66, 2.81],
    [42.18, -0.12, 1.58, 4.78, 2.63],
    [43.27, -0.13, 1.61, 4.01, 2.29],
    [44.38, -0.18, 1.76, 3.08, 1.92],
    [45.57, -0.13, 2.01, 1.81, 1.51],
    [46.35, -0.02, 2.13, 1.49, 1.34],
  ];
  const N = sides[d],
    sample = d === 0 ? rows.filter((_, i) => [0, 3, 6, 9, 11, 13].includes(i)) : subset(rows, d);
  const rings = sample.map(([y, x, z, w, depth], i) =>
    Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        cos = Math.cos(a),
        sin = Math.sin(a);
      const ribs = 0.072 * Math.sin(4 * a + y * 0.126) + 0.043 * Math.cos(8 * a - y * 0.24);
      const breast =
        y > 36 && y < 43
          ? 0.34 * Math.sin((Math.PI * (y - 36)) / 7) * Math.max(0, cos) * Math.abs(Math.sin(a * 2))
          : 0;
      return figurePoint([
        x + w * sin * (1 + ribs),
        y + 0.37 * sin * cos + 0.13 * Math.sin(a * 2 + i),
        z + depth * cos * (1 + ribs) + breast,
      ]);
    }),
  );
  ribbonSkin(out, 'body', 'concrete', rings);
}
const legs = [
  [
    [1.91, 24.62, 1.66, 2.2, 1.87],
    [2.18, 21.27, 2.54, 2.17, 1.85],
    [2.48, 18.2, 3.6, 1.97, 1.69],
    [2.65, 15.33, 4.41, 1.67, 1.44],
    [2.68, 12.65, 4.69, 1.65, 1.41],
    [2.62, 10.32, 4.61, 1.42, 1.28],
    [2.48, 7.33, 4.89, 1.16, 1.11],
    [2.32, 4.25, 5.51, 1.01, 0.96],
    [2.24, 1.47, 6.18, 0.92, 0.95],
    [2.25, 0.49, 6.65, 0.97, 0.91],
  ],
  [
    [-1.88, 25.01, -1.2, 2.09, 1.88],
    [-2.02, 21.38, -2.31, 1.96, 1.68],
    [-2.2, 18.39, -2.99, 1.76, 1.63],
    [-2.39, 14.59, -3.48, 1.63, 1.38],
    [-2.49, 11.27, -3.78, 1.49, 1.42],
    [-2.6, 7.86, -4.33, 1.33, 1.14],
    [-2.76, 4.31, -5.2, 1.13, 0.93],
    [-2.93, 1.22, -6.12, 0.99, 0.88],
    [-2.95, 0.43, -6.35, 0.98, 0.85],
  ],
];
const hem = [
  [0.07, -0.87, -2.36, 4.02, 4.97, 0.26],
  [0.83, -0.88, -2.23, 4.38, 5.07, 0.34],
  [2.21, -0.96, -2.0, 4.61, 5.22, 0.58],
  [3.77, -0.99, -2.14, 4.85, 5.25, 0.34],
  [5.49, -0.94, -2.49, 5.35, 5.23, 0.73],
  [6.99, -0.77, -2.74, 5.68, 5.07, 0.38],
  [8.89, -0.6, -2.72, 5.54, 4.98, 0.7],
  [10.66, -0.43, -2.39, 5.21, 4.87, 0.41],
  [12.25, -0.31, -2.2, 5.02, 4.78, 0.65],
  [14.08, -0.13, -1.99, 4.98, 4.68, 0.45],
  [16.38, 0.07, -1.86, 5.04, 4.53, 0.63],
  [18.17, 0.24, -1.65, 4.9, 4.48, 0.43],
  [20.32, 0.34, -1.36, 4.78, 4.46, 0.67],
  [22.32, 0.46, -1.03, 4.7, 4.2, 0.55],
  [24.13, 0.53, -0.7, 4.54, 4.03, 0.48],
  [25.92, 0.6, -0.42, 4.51, 3.71, 0.49],
  [27.52, 0.6, -0.13, 4.33, 3.53, 0.44],
  [29.15, 0.57, 0.09, 3.97, 3.22, 0.38],
  [31.02, 0.51, 0.36, 3.52, 2.78, 0.31],
  [32.78, 0.48, 0.54, 3.24, 2.6, 0.29],
];
function drapedSkirt(out, d) {
  const N = [10, 16, 25, 38, 51][d];
  const rows = d >= 3 ? hem : hem.filter((_, i) => i === hem.length - 1 || i % [4, 3, 2][d] === 0);
  const rings = rows.map(([y, x, z, w, depth, ridge], k) =>
    Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        cos = Math.cos(a),
        sin = Math.sin(a);
      const pleat =
        ridge *
        (0.64 * Math.sin(5 * a - y * 0.083) +
          0.39 * Math.cos(9 * a + y * 0.144) +
          0.21 * Math.sin(13 * a - y * 0.06));
      const cutFront = Math.max(0, cos) * (0.5 + 0.33 * Math.max(0, sin));
      const wind = Math.max(0, -sin) * Math.sin(Math.PI * Math.min(1, y / 27));
      return figurePoint([
        x + (w + pleat) * sin - 0.44 * wind,
        y +
          Math.min(y, 1.65) * (0.31 * Math.sin(a * 2) + 0.2 * cos) +
          0.12 * Math.sin(a * 4 + k * 0.32),
        z + (depth + pleat * 0.95) * cos - cutFront * (y < 22 ? 1.9 : 1.3) - 0.29 * wind,
      ]);
    }),
  );
  ribbonSkin(out, 'body', 'concrete', rings);
}
function feet(out, d) {
  for (const [i, leg] of legs.entries()) {
    const [x, , z] = leg.at(-1),
      front = i === 0;
    sculptLimb(
      out,
      [
        [x, 0.6, z - 0.48, 1.0, 0.56],
        [x + 0.04, 0.42, z + 0.29, 1.07, 0.4],
        [x + 0.09, 0.3, z + 0.76, 0.99, 0.3],
        [x + 0.06, 0.25, z + 1.08, 0.83, 0.22],
      ],
      d,
      'concrete',
      figurePoint,
      0.03,
    );
    if (d >= 2)
      for (let j = 0; j < 5; j++) {
        const p = x + (j - 2) * 0.355,
          reach = (4 - j) * 0.086;
        sculptLimb(
          out,
          [
            [p, 0.27, z + 0.8, 0.219, 0.22],
            [p + 0.018, 0.22, z + 1.07 + reach, 0.203, 0.184],
            [p + 0.052, 0.215, z + 1.26 + reach, 0.133, 0.144],
          ],
          1,
          front ? 'pale' : 'concrete',
        );
      }
  }
}
const rightArm = [
  [-3.57, 42.31, 1.38, 2.16, 1.88],
  [-4.79, 44.06, 1.46, 2.02, 1.78],
  [-6.42, 46.33, 1.62, 1.88, 1.71],
  [-7.98, 48.79, 1.72, 1.72, 1.52],
  [-9.43, 51.08, 1.84, 1.44, 1.36],
  [-10.26, 53.11, 2.02, 1.35, 1.25],
  [-11.27, 55.34, 2.4, 1.35, 1.22],
  [-12.16, 57.16, 2.83, 1.12, 1.04],
  [-12.63, 59.17, 3.11, 0.87, 0.86],
  [-12.95, 60.18, 3.41, 0.89, 0.83],
  [-13.05, 61.17, 3.59, 1.11, 0.94],
];
const leftArm = [
  [3.38, 41.97, 1.56, 2.02, 1.72],
  [4.66, 41.7, 1.72, 1.92, 1.64],
  [6.22, 40.84, 1.75, 1.73, 1.47],
  [7.66, 40.18, 1.8, 1.5, 1.34],
  [8.92, 39.69, 1.84, 1.28, 1.21],
  [10.15, 39.33, 1.87, 1.24, 1.09],
  [11.43, 39.23, 1.88, 1.1, 0.95],
  [12.48, 39.19, 1.91, 0.84, 0.75],
  [13.2, 39.16, 1.95, 0.68, 0.6],
  [13.9, 39.12, 1.96, 0.87, 0.63],
];
function arms(out, d) {
  sculptLimb(out, rightArm, d, 'concrete', figurePoint, 0.047);
  sculptLimb(out, leftArm, d, 'concrete', figurePoint, 0.041);
  if (d >= 1) {
    const sleeveRows = [
      [
        [-3.48, 41.72, 1.43, 2.29, 1.99],
        [-4.86, 43.84, 1.47, 2.28, 2.01],
        [-5.68, 45.03, 1.53, 2.08, 1.9],
      ],
      [
        [3.14, 42.08, 1.54, 2.16, 1.91],
        [4.54, 41.62, 1.7, 2.14, 1.82],
        [5.35, 41.3, 1.72, 1.97, 1.63],
        [6.02, 41.01, 1.73, 1.81, 1.49],
      ],
    ];
    for (const row of sleeveRows) sculptLimb(out, row, d, 'fold', figurePoint, 0.087);
  }
  const [x, y, z] = layout.openPalm;
  if (d === 0)
    sculptLimb(
      out,
      [
        [x - 0.1, y, z, 0.79, 0.52],
        [x + 0.93, y - 0.2, z + 0.1, 0.72, 0.41],
        [x + 2.34, y - 0.25, z + 0.18, 0.24, 0.26],
      ],
      0,
      'concrete',
    );
  else {
    sculptLimb(
      out,
      [
        [x - 0.12, y, z, 0.75, 0.51],
        [x + 0.74, y - 0.13, z + 0.12, 0.74, 0.42],
        [x + 1.07, y - 0.25, z + 0.15, 0.62, 0.34],
      ],
      d,
      'concrete',
    );
    const reach = [2.33, 2.51, 2.41, 1.94];
    for (let i = 0; i < 4; i++) {
      const w = (i - 1.5) * 0.3;
      sculptLimb(
        out,
        [
          [x + 0.6, y - 0.09 + w, z + w * 0.38, 0.23],
          [x + reach[i] * 0.65, y - 0.3 + w, z + 0.12 + w * 0.52, 0.19],
          [x + reach[i], y - 0.44 + w * 1.4, z + 0.22 + w * 0.77, 0.12],
        ],
        Math.min(d, 2),
        'concrete',
      );
    }
    sculptLimb(
      out,
      [
        [x - 0.07, y + 0.26, z + 0.26, 0.35],
        [x + 0.32, y + 0.78, z + 0.43, 0.32],
        [x + 0.97, y + 0.83, z + 0.63, 0.2],
      ],
      Math.min(d, 2),
      'pale',
    );
  }
  const [sx, sy, sz] = layout.swordHand;
  sculptLimb(
    out,
    [
      [sx - 0.1, sy - 1.14, sz - 0.05, 0.84, 0.7],
      [sx + 0.01, sy - 0.33, sz, 0.99, 0.87],
      [sx + 0.19, sy + 0.54, sz - 0.12, 1.05, 0.77],
      [sx + 0.3, sy + 1.01, sz - 0.28, 0.8, 0.69],
    ],
    d,
    'concrete',
  );
  if (d >= 1) {
    for (let i = 0; i < 4; i++) {
      const b = sy - 1.01 + i * 0.53;
      sculptLimb(
        out,
        [
          [sx - 0.64, b, sz + 0.22, 0.32],
          [sx - 0.44, b + 0.13, sz + 0.81, 0.32],
          [sx + 0.12, b + 0.11, sz + 1.02, 0.27],
          [sx + 0.67, b - 0.13, sz + 0.77, 0.25],
          [sx + 0.75, b - 0.25, sz + 0.28, 0.205],
        ],
        Math.min(d, 2),
        'pale',
      );
    }
    sculptLimb(
      out,
      [
        [sx + 0.66, sy - 0.8, sz + 0.11, 0.38],
        [sx + 1.03, sy - 0.12, sz + 0.31, 0.37],
        [sx + 0.84, sy + 0.54, sz + 0.5, 0.28],
        [sx + 0.35, sy + 0.87, sz + 0.66, 0.23],
      ],
      Math.min(d, 2),
      'concrete',
    );
  }
}
function cloth(out, rows, d, tint) {
  const N = [5, 7, 11, 16, 22][d],
    rs = d === 0 ? rows.filter((_, i) => i === rows.length - 1 || i % 3 === 0) : subset(rows, d);
  const rings = rs.map(([at, edge, thickness], i) => {
    const direction = normalize(
      sub(rs[Math.min(i + 1, rs.length - 1)][0], rs[Math.max(0, i - 1)][0]),
    );
    const across = sub(edge, scale(direction, dot(edge, direction)));
    const normal = normalize(cross(direction, across));
    return Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N,
        u = Math.cos(a),
        v = Math.sin(a);
      const depth =
        thickness * (v + 0.28 * Math.sin(u * 8 + i * 0.91) + 0.16 * Math.cos(u * 14 - i * 0.29));
      return figurePoint(add(at, add(scale(across, u), scale(normal, depth))));
    });
  });
  ribbonSkin(out, 'body', tint, rings);
}
function windblownCloth(out, d) {
  const cape = [
    [[-2.99, 42.26, -0.61], [1.26, 2.1, 0.83], 0.45],
    [[-3.94, 40.91, -1.75], [1.24, 2.25, 1.23], 0.53],
    [[-5.15, 39.02, -3.44], [1.19, 2.47, 1.33], 0.59],
    [[-6.32, 37.68, -4.64], [1.47, 2.58, 1.2], 0.67],
    [[-7.85, 36.78, -5.92], [1.5, 2.65, 1.33], 0.72],
    [[-9.32, 35.75, -6.7], [1.46, 2.69, 1.62], 0.63],
    [[-10.73, 35.02, -7.22], [1.43, 2.72, 1.41], 0.61],
    [[-12.28, 34.4, -7.67], [1.33, 2.59, 1.47], 0.49],
    [[-13.16, 34.91, -8.08], [1.2, 1.95, 1.48], 0.4],
    [[-13.37, 35.25, -8.37], [0.88, 1.31, 1.23], 0.31],
    [[-12.95, 35.69, -8.52], [0.46, 0.65, 0.61], 0.18],
  ];
  const sash = [
    [[3.17, 37.95, 2.56], [0.72, 1.07, 0.36], 0.25],
    [[2.42, 36.16, 3.72], [0.78, 1.48, 0.42], 0.38],
    [[1.18, 34.45, 4.06], [0.72, 1.67, 0.26], 0.51],
    [[-0.61, 33.09, 3.93], [0.63, 1.94, 0.26], 0.51],
    [[-2.24, 31.86, 3.29], [0.44, 2.12, 0.64], 0.54],
    [[-3.54, 30.39, 2.33], [0.25, 2.01, 0.78], 0.47],
    [[-4.57, 28.92, 0.94], [0.1, 1.86, 0.93], 0.45],
    [[-4.96, 27.49, -0.68], [0.16, 1.49, 1.12], 0.43],
    [[-4.88, 26.01, -2.09], [0.51, 1.26, 1.0], 0.35],
    [[-4.43, 25.64, -3.17], [0.73, 0.72, 0.87], 0.21],
  ];
  cloth(out, cape, d, 'concrete');
  cloth(out, sash, d, 'pale');
  if (d < 2) return;
  const folds = [
    [
      [[2.74, 31.96, 2.42], [0.28, 1.13, 0.18], 0.28],
      [[3.98, 27.43, 1.58], [0.57, 1.28, 0.19], 0.42],
      [[4.59, 21.41, 0.85], [0.55, 0.92, 0.32], 0.49],
      [[4.61, 16.04, -0.17], [0.57, 1.25, 0.34], 0.59],
      [[4.77, 11.05, -0.72], [0.65, 1.28, 0.44], 0.48],
      [[4.48, 6.85, -1.05], [0.66, 0.82, 0.49], 0.37],
      [[3.72, 3.62, -1.47], [0.61, 0.55, 0.53], 0.27],
      [[2.79, 1.12, -1.68], [0.47, 0.31, 0.34], 0.21],
    ],
    [
      [[-2.53, 28.64, 2.16], [0.78, 0.88, 0.48], 0.38],
      [[-3.42, 24.94, 1.52], [0.74, 0.78, 0.6], 0.43],
      [[-4.04, 19.48, 1.07], [0.61, 0.93, 0.54], 0.46],
      [[-4.54, 14.22, 0.62], [0.69, 0.88, 0.47], 0.57],
      [[-5.13, 9.42, 0.39], [0.81, 1.11, 0.48], 0.53],
      [[-5.02, 7.47, -0.18], [0.71, 1.02, 0.37], 0.42],
      [[-4.18, 5.69, -0.63], [0.39, 0.59, 0.31], 0.31],
      [[-3.56, 3.64, -1.08], [0.27, 0.46, 0.26], 0.25],
    ],
  ];
  for (const fold of folds) cloth(out, fold, d, 'fold');
}
function face(out, d) {
  const [x, y, z] = layout.head,
    c = Math.cos(1.01),
    s = Math.sin(1.01);
  const P = ([a, b, w]) => figurePoint([x + c * a + s * w, y + b + 0.16 * a, z - s * a + c * w]);
  const rows = [
    [-2.35, -0.14, 0.02, 0.75, 0.84],
    [-1.97, -0.11, 0.25, 1.03, 1.02],
    [-1.48, -0.1, 0.42, 1.16, 1.02],
    [-0.96, -0.05, 0.31, 1.34, 1.18],
    [-0.53, -0.01, 0.2, 1.44, 1.3],
    [0.02, 0.03, 0.02, 1.48, 1.39],
    [0.51, 0.01, -0.12, 1.52, 1.42],
    [1.06, -0.05, -0.24, 1.51, 1.36],
    [1.58, -0.12, -0.29, 1.42, 1.25],
    [2.11, -0.19, -0.35, 1.2, 1.08],
    [2.55, -0.19, -0.4, 0.79, 0.78],
    [2.74, -0.2, -0.48, 0.47, 0.44],
  ];
  const N = sides[d],
    rs = d === 0 ? rows.filter((_, i) => [0, 3, 6, 9, 11].includes(i)) : subset(rows, d);
  const rings = rs.map(([h, w, z, a, b]) =>
    Array.from({ length: N }, (_, i) => {
      const phi = (i * TAU) / N,
        sin = Math.sin(phi),
        cos = Math.cos(phi);
      const mouth = h > -1.64 && h < -0.43 ? Math.max(0, cos - 0.86) * 1.42 : 0;
      return P([w + a * sin, h, z + b * cos - mouth]);
    }),
  );
  ribbonSkin(out, 'body', 'concrete', rings);
  sculptLimb(
    out,
    [
      [-0.02, -3.42, -0.07, 1.34, 1.37],
      [-0.03, -2.2, -0.03, 1.21, 1.29],
      [-0.03, -1.58, -0.01, 1.06, 1.16],
    ],
    d,
    'concrete',
    P,
  );
  const hair = [
    [[0.18, 2.54, -0.46], [1.31, -0.11, 0.27], 0.35],
    [[0.16, 2.4, -1.2], [1.44, 0.11, 0.42], 0.44],
    [[0.1, 2.07, -2.04], [1.51, 0.28, 0.45], 0.53],
    [[-0.1, 1.66, -2.75], [1.56, 0.49, 0.55], 0.58],
    [[-0.31, 1.22, -3.22], [1.39, 0.67, 0.71], 0.56],
    [[-0.52, 0.73, -3.48], [1.18, 0.73, 0.78], 0.52],
    [[-0.56, 0.29, -3.51], [0.82, 0.57, 0.56], 0.44],
    [[-0.53, -0.2, -3.2], [0.62, 0.56, 0.37], 0.37],
    [[-0.41, -0.58, -2.62], [0.55, 0.43, 0.24], 0.26],
  ];
  const hN = [5, 7, 10, 15, 19][d];
  const hairRings = subset(hair, d).map(([p, edge, r], i) =>
    Array.from({ length: hN }, (_, j) => {
      const a = (j * TAU) / hN;
      return P(
        add(
          p,
          add(scale(edge, Math.cos(a)), [
            0,
            Math.sin(a) * r + 0.09 * Math.cos(4 * a + i * 0.71),
            0,
          ]),
        ),
      );
    }),
  );
  // Hair follows the negative-Z sweep, so reverse the ring winding before closing the solid.
  ribbonSkin(
    out,
    'body',
    'hair',
    hairRings.map((r) => r.toReversed()),
  );
  const tip = P([0.03, -0.43, 1.99]),
    root = P([0.01, 0.61, 1.31]),
    left = P([-0.34, -0.62, 1.37]),
    right = P([0.36, -0.62, 1.37]),
    under = P([0, -0.79, 1.52]);
  const forward = [s, 0, c];
  for (const ps of [
    [left, root, tip],
    [root, right, tip],
    [right, under, tip],
    [under, left, tip],
  ])
    tri(out, 'body', 'pale', ps, forward);
  if (d === 0) return;
  sphere(
    out,
    'body',
    P([0.038, -1.3, 1.23]),
    [0.38, 0.375, 0.22],
    rgb.cavity,
    d > 2 ? 12 : 8,
    d > 2 ? 8 : 5,
  );
  const lipPoints = [
    [
      [-0.39, -1.26, 1.35],
      [-0.19, -0.98, 1.48],
      [0.1, -0.94, 1.49],
      [0.39, -1.11, 1.38],
    ],
    [
      [-0.39, -1.26, 1.35],
      [-0.22, -1.57, 1.39],
      [0.09, -1.63, 1.43],
      [0.39, -1.11, 1.38],
    ],
  ];
  for (const path of lipPoints) tubePath(out, 'body', path.map(P), 0.139, rgb.pale, d >= 3 ? 7 : 5);
  if (d < 2) return;
  for (const sign of [-1, 1]) {
    sculptLimb(
      out,
      [
        [sign * 0.22, 0.54, 1.31, 0.159],
        [sign * 0.6, 0.62, 1.33, 0.19],
        [sign * 1.01, 0.47, 1.06, 0.135],
      ],
      2,
      'fold',
      P,
    );
    sculptLimb(
      out,
      [
        [sign * 0.24, 0.31, 1.38, 0.103],
        [sign * 0.58, 0.37, 1.41, 0.105],
        [sign * 0.94, 0.22, 1.13, 0.069],
      ],
      2,
      'cavity',
      P,
    );
    sculptLimb(
      out,
      [
        [sign * 1.35, 0.14, -0.08, 0.24, 0.28],
        [sign * 1.44, 0.09, -0.02, 0.31, 0.28],
        [sign * 1.36, -0.54, 0.04, 0.32, 0.32],
        [sign * 1.31, -0.8, -0.04, 0.16, 0.21],
      ],
      d,
      'hair',
      P,
    );
  }
  const n = d === 2 ? 9 : d === 3 ? 16 : 23;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.38) / n) * Math.PI * 1.63 - 0.34;
    const x = 1.34 * Math.sin(a),
      curve = [
        [x, 1.21 + 0.89 * Math.max(0, Math.cos(a)), 0.85 * Math.cos(a) + 0.1],
        [x * 0.94, 2.22 + 0.14 * Math.cos(a), -0.63],
        [x * 0.88 - 0.13, 1.77 + 0.29 * Math.cos(a), -1.9],
        [x * 0.72 - 0.31, 1.26 + 0.51 * Math.cos(a), -2.97],
        [x * 0.47 - 0.55, 0.53 + 0.47 * Math.cos(a), -3.45 - 0.12 * Math.sin(a * 3)],
      ];
    tubePath(
      out,
      'body',
      curve.map(P),
      0.097 + 0.032 * Math.abs(Math.sin(a * 2)),
      rgb[i % 4 === 0 ? 'fold' : 'hair'],
      d >= 3 ? 7 : 5,
    );
  }
}
function sword(out, d) {
  const { guard, tip, gripEnd } = layout.sword;
  const bladeDirection = normalize(sub(tip, guard));
  const perpendicular = normalize(cross(bladeDirection, [0.16, 0, 0.987]));
  const normal = normalize(cross(perpendicular, bladeDirection));
  const length = Math.hypot(...sub(tip, guard));
  const P = ([u, v], w = 0) =>
    figurePoint(
      add(guard, add(scale(perpendicular, u), add(scale(bladeDirection, v), scale(normal, w)))),
    );
  const width = (v) => mix(1.01, 0.65, v / length);
  const outline = [
    [-width(0), 0],
    [width(0), 0],
    [width(length - 1.04), length - 1.04],
    [0.46, length - 0.26],
    [0, length],
    [-0.46, length - 0.26],
    [-width(length - 1.04), length - 1.04],
  ];
  const holes = [];
  if (d >= 2)
    for (let i = 0; i < 8; i++)
      for (const sign of [-1, 1]) {
        const y = length - 9.92 + i * 1.07,
          x = sign * 0.28,
          w = i < 5 ? 0.123 : 0.098;
        holes.push([
          [x - w, y - 0.235],
          [x + w, y - 0.235],
          [x + w, y + 0.235],
          [x - w, y + 0.235],
        ]);
      }
  const points = [...outline, ...holes.flat()],
    offsets = holes.map((_, i) => outline.length + i * 4);
  const indices = earcut(points.flat(), offsets);
  for (const sign of [-1, 1]) {
    const w = sign * 0.24,
      n = scale(normal, sign);
    for (let i = 0; i < indices.length; i += 3)
      tri(
        out,
        'sword',
        'steel',
        indices.slice(i, i + 3).map((j) => P(points[j], j === 4 ? 0 : w)),
        n,
      );
  }
  for (const ring of [outline, ...holes])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const outward = add(scale(perpendicular, b[1] - a[1]), scale(bladeDirection, a[0] - b[0]));
      const endA = a[1] === length ? 0 : 0.24,
        endB = b[1] === length ? 0 : 0.24;
      quad(
        out,
        'sword',
        ring === outline ? 'bladeEdge' : 'steelDark',
        [P(a, -endA), P(b, -endB), P(b, endB), P(a, endA)],
        scale(outward, ring === outline ? 1 : -1),
      );
    }
  const at = (u, v) => P([u, v]);
  beam(out, 'sword', at(-2.94, -0.22), at(2.94, -0.22), 1.09, 1.18, rgb.bladeEdge);
  beam(out, 'sword', at(-2.75, -0.27), at(2.75, -0.27), 1.29, 0.69, rgb.steel);
  beam(out, 'sword', figurePoint(gripEnd), at(0, -0.18), 1.11, 1.02, rgb.steelDark);
  beam(
    out,
    'sword',
    figurePoint(lerp(gripEnd, guard, -0.055)),
    figurePoint(lerp(gripEnd, guard, 0.102)),
    1.43,
    1.29,
    rgb.bladeEdge,
  );
  if (d >= 3)
    for (let i = 1; i <= 8; i++) {
      const center = -0.58 * i;
      const a = P([-0.55, center], 0.53),
        b = P([0.55, center + 0.13], 0.53);
      beam(out, 'sword', a, b, 0.067, 0.067, rgb.bladeEdge);
    }
}
export function buildMonument(out, level = 'master') {
  const d = tier[level];
  if (d === undefined) throw Error('Unknown The Motherland Calls LOD ' + level);
  foundation(out, d);
  torso(out, d);
  for (const leg of legs) sculptLimb(out, leg, d, 'concrete', figurePoint, 0.062);
  drapedSkirt(out, d);
  feet(out, d);
  windblownCloth(out, d);
  arms(out, d);
  face(out, d);
  sword(out, d);
}
export const buildMonumentSkyline = (out) => buildMonument(out, 'skyline');
export const buildMonumentDistrict = (out) => buildMonument(out, 'district');
export const buildMonumentStreet = (out) => buildMonument(out, 'street');
export const buildMonumentCloseup = (out) => buildMonument(out, 'closeup');

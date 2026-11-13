/** Mother Albania at Tirana's Martyrs Cemetery, from the mapped terrace and photographs. */
import { readFileSync } from 'node:fs';
import {
  beam,
  cross,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { tubePath } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));

const tier = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  TAU = 2 * Math.PI;
const Y = layout.statueBase,
  up = [0, 1, 0],
  front = [0, 0, 1];
const identity = (p) => p;
const add = (a, b) => a.map((v, i) => v + b[i]),
  sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0),
  mix = (a, b, t) => a + (b - a) * t;
const average = (ps) => ps[0].map((_, i) => ps.reduce((n, p) => n + p[i], 0) / ps.length);
const onFigure = ([x, y, z]) => [x, y + Y, z];
const colors = {
  figure: 'd6cabb',
  highlighted: 'e0d4bd',
  fold: 'c6baa9',
  hair: 'c8b7a3',
  ashlar: 'd3c9b7',
  ivory: 'dbcfb9',
  buff: 'cbbca9',
  limestone: 'cfc2af',
  mortar: 'a99f90',
  pink: 'b69085',
  pinkLight: 'c4a196',
  steps: 'b6b2a9',
  deck: 'c5beb0',
  turf: '7f836a',
  inscription: 'a88a60',
};
const rgb = Object.fromEntries(
  Object.entries(colors).map(([key, hex]) => [
    key,
    hex.match(/../g).map((pair) => {
      const srgb = parseInt(pair, 16) / 255;
      return srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
    }),
  ]),
);

export const surfaces = {
  sculpture: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.89 },
  masonry: { slot: 'foundation', graph: 'stone_granite', roughness: 0.82 },
  lettering: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.64, metallic: 0.32 },
  planting: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.94 },
};

function tri(out, slot, tint, ps, direction) {
  let n = normalFor(...ps);
  if (Math.hypot(...n) < 0.99) return;
  if (dot(n, direction) < 0) {
    ps = ps.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', ps, n, undefined, rgb[tint]);
}
function quad(out, slot, tint, [a, b, c, d], direction) {
  tri(out, slot, tint, [a, b, c], direction);
  tri(out, slot, tint, [a, c, d], direction);
}
function skin(out, slot, tint, rings) {
  const N = rings[0].length,
    centers = rings.map(average);
  for (let j = 0; j + 1 < rings.length; j++)
    for (let k = 0; k < N; k++) {
      const i = (k + 1) % N;
      const ps = [rings[j][k], rings[j][i], rings[j + 1][i], rings[j + 1][k]];
      quad(out, slot, tint, ps, sub(average(ps), average([centers[j], centers[j + 1]])));
    }
  for (const [j, k] of [
    [0, 1],
    [rings.length - 1, rings.length - 2],
  ]) {
    const n = sub(centers[j], centers[k]);
    for (let i = 0; i < N; i++)
      tri(out, slot, tint, [centers[j], rings[j][i], rings[j][(i + 1) % N]], n);
  }
}
const sideCount = [4, 6, 8, 12, 16];
function sections(out, P, rows, d, tint = 'sculpture', folds = 0) {
  const N = sideCount[d];
  skin(
    out,
    'sculpture',
    tint,
    rows.map(([y, x, z, rx, rz], j) =>
      Array.from({ length: N }, (_, i) => {
        const a = (i * TAU) / N;
        const r = 1 + folds * (Math.sin(3 * a + 0.48 * j) + 0.42 * Math.cos(5 * a - j * 0.75));
        return P([x + rx * r * Math.cos(a), y, z - rz * r * Math.sin(a)]);
      }),
    ),
  );
}
function limb(out, ps, d, tint = 'sculpture', P = identity) {
  const N = sideCount[d],
    centers = ps.map(([x, y, z]) => P([x, y, z]));
  let u;
  const rings = centers.map((center, i) => {
    const axis = normalize(
      sub(centers[Math.min(i + 1, centers.length - 1)], centers[Math.max(i - 1, 0)]),
    );
    if (u) {
      const offset = dot(u, axis);
      const projection = u.map((v, k) => v - offset * axis[k]);
      u = Math.hypot(...projection) > 0.05 ? normalize(projection) : undefined;
    }
    u ??= normalize(cross(axis, Math.abs(axis[1]) > 0.92 ? [1, 0, 0] : up));
    const v = normalize(cross(axis, u)),
      r = ps[i][3],
      s = ps[i][4] ?? r;
    return Array.from({ length: N }, (_, j) => {
      const a = (j * TAU) / N;
      return center.map((c, k) => c + u[k] * r * Math.cos(a) + v[k] * s * Math.sin(a));
    });
  });
  skin(out, 'sculpture', tint, rings);
}
function local(origin, yaw) {
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return ([x, y, z]) => [origin[0] + x * c + z * s, origin[1] + y, origin[2] - x * s + z * c];
}
function rectangle(out, slot, tint, x, z, rows) {
  skin(
    out,
    slot,
    tint,
    rows.map(([y, a, b]) => [
      [x - a, y, z - b],
      [x + a, y, z - b],
      [x + a, y, z + b],
      [x - a, y, z + b],
    ]),
  );
}
function block(out, slot, tint, x, z, halfWidth, halfDepth, bottom, top) {
  rectangle(out, slot, tint, x, z, [
    [bottom, halfWidth, halfDepth],
    [top, halfWidth, halfDepth],
  ]);
}
function site(out, d) {
  const { deck, stairs } = layout;
  block(out, 'masonry', 'deck', 0, -1.3, stairs.halfWidth, stairs.topZ + 1.3, -1.1, deck);
  // Each successive slab exposes one tread and keeps the lower steps embedded in the graded plaza.
  const grouping = d === 0 ? 2 : 1;
  for (let k = 0; k < stairs.count; k += grouping) {
    const a = stairs.topZ + k * stairs.run - 0.008,
      b = a + grouping * stairs.run + 0.008;
    const top = deck - stairs.rise * (k + grouping);
    block(out, 'masonry', 'steps', 0, (a + b) / 2, stairs.halfWidth, (b - a) / 2, -1.8, top);
    if (d >= 2)
      block(
        out,
        'masonry',
        'deck',
        0,
        b - 0.026,
        stairs.halfWidth + 0.008,
        0.032,
        top - 0.038,
        top + 0.011,
      );
  }
  const end = stairs.topZ + stairs.count * stairs.run;
  block(out, 'masonry', 'deck', 0, end + 0.44, stairs.halfWidth, 0.46, -1.76, stairs.lowest);
  for (const side of [-1, 1]) {
    block(out, 'masonry', 'ivory', side * 17.66, 8.32, 0.75, 3.33, -1.58, 0.21);
    block(out, 'masonry', 'ivory', side * 17.66, 8.32, 0.81, 3.38, 0.21, 0.29);
    block(out, 'sculpture', 'turf', side * 17.66, 8.32, 0.66, 3.21, 0.29, 0.345);
  }
}

const shaftBottom = layout.deck + 1.11,
  shaftTop = Y - 0.12;
const halfAt = (y) => [
  mix(2.45, 1.97, (y - shaftBottom) / (shaftTop - shaftBottom)),
  mix(3.66, 3.24, (y - shaftBottom) / (shaftTop - shaftBottom)),
];
function wallPoint(face, y, t, offset = 0) {
  const [x, z] = halfAt(y);
  return [
    [t * x, y, z + offset],
    [x + offset, y, -t * z],
    [-t * x, y, -z - offset],
    [-x - offset, y, t * z],
  ][face];
}
const normals = [front, [1, 0, 0], [0, 0, -1], [-1, 0, 0]];
function pedestal(out, d) {
  const deck = layout.deck;
  rectangle(out, 'masonry', 'pink', 0, 0, [
    [deck - 0.15, 3.72, 4.96],
    [deck + 0.14, 3.72, 4.96],
    [deck + 0.18, 3.83, 5.08],
    [deck + 0.91, 3.83, 5.08],
    [deck + 0.96, 3.78, 5.03],
  ]);
  block(out, 'masonry', 'pinkLight', 0, 0, 2.52, 3.73, deck + 0.96, shaftBottom);
  rectangle(out, 'masonry', d === 0 ? 'ashlar' : 'mortar', 0, 0, [
    [shaftBottom, ...halfAt(shaftBottom)],
    [shaftTop, ...halfAt(shaftTop)],
  ]);
  rectangle(out, 'masonry', 'ashlar', 0, 0, [
    [shaftTop, 2.0, 3.27],
    [Y - 0.043, 2.0, 3.27],
    [Y, 1.92, 3.21],
  ]);
  if (d === 0) return;
  const rows = d === 1 ? 12 : 18;
  const tones = ['ivory', 'ashlar', 'buff', 'limestone', 'ashlar', 'limestone', 'ashlar'];
  for (let row = 0; row < rows; row++) {
    const low = mix(shaftBottom, shaftTop, row / rows) + 0.012,
      high = mix(shaftBottom, shaftTop, (row + 1) / rows) - 0.01;
    for (let f = 0; f < 4; f++) {
      const columns = f % 2 ? 8 : 5;
      const limits = [
        -1,
        ...Array.from(
          { length: columns - 1 },
          (_, c) =>
            -1 +
            ((c + 1 + (row % 2 ? 0.29 : -0.1) + 0.11 * Math.sin(c * 8.13 + row * 2.7 + f)) /
              columns) *
              2,
        ),
        1,
      ];
      for (let c = 0; c + 1 < limits.length; c++) {
        const t = limits[c] + 0.0035,
          u = limits[c + 1] - 0.0035;
        const protrusion = 0.014 + 0.011 * Math.abs(Math.sin(c * 7.32 + row * 2.8 + f * 0.73));
        const tint = tones[(row * 3 + c * 11 + f * 2 + ((c * row) % 5)) % tones.length];
        const ps = [
          wallPoint(f, low, t, protrusion),
          wallPoint(f, low, u, protrusion),
          wallPoint(f, high, u, protrusion),
          wallPoint(f, high, t, protrusion),
        ];
        quad(out, 'masonry', tint, ps, normals[f]);
        if (d >= 3)
          for (let edge = 0; edge < 4; edge++) {
            const next = (edge + 1) % 4;
            const a = ps[edge],
              b = ps[next];
            const inward = normals[f].map((x) => -x * protrusion);
            const p = [a, b, add(b, inward), add(a, inward)];
            quad(out, 'masonry', 'mortar', p, sub(average(p), average(ps)));
          }
      }
    }
  }
  if (d >= 2)
    for (const face of [0, 1, 2, 3]) {
      const [nx, , nz] = normals[face];
      for (const t of [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75]) {
        const x = nx * 3.834 + nz * t * 3.8,
          z = nz * 5.084 + nx * t * 5.02;
        block(
          out,
          'masonry',
          'pinkLight',
          x,
          z,
          nx ? 0.008 : 0.012,
          nz ? 0.008 : 0.012,
          deck + 0.181,
          deck + 0.904,
        );
      }
    }
}

// Raised block lettering observed on the north-facing stone face.
const glyphs = {
  A: [
    [
      [0, 0],
      [0.48, 1],
      [1, 0],
    ],
    [
      [0.22, 0.39],
      [0.8, 0.39],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
      [0.56, 1],
      [1, 0.72],
      [1, 0.29],
      [0.55, 0],
      [0, 0],
    ],
  ],
  E: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0.5],
      [0.78, 0.5],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0.51],
      [1, 0.51],
    ],
  ],
  I: [
    [
      [0.49, 0],
      [0.49, 1],
    ],
  ],
  J: [
    [
      [0, 0.22],
      [0.18, 0],
      [0.7, 0],
      [1, 0.24],
      [1, 1],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  M: [
    [
      [0, 0],
      [0, 1],
      [0.5, 0.47],
      [1, 1],
      [1, 0],
    ],
  ],
  O: [
    [
      [0.23, 0],
      [0, 0.25],
      [0, 0.74],
      [0.24, 1],
      [0.77, 1],
      [1, 0.74],
      [1, 0.25],
      [0.77, 0],
      [0.23, 0],
    ],
  ],
  P: [
    [
      [0, 0],
      [0, 1],
      [0.76, 1],
      [1, 0.83],
      [1, 0.63],
      [0.76, 0.46],
      [0, 0.46],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.76, 1],
      [1, 0.83],
      [1, 0.63],
      [0.76, 0.46],
      [0, 0.46],
    ],
    [
      [0.5, 0.46],
      [1, 0],
    ],
  ],
  S: [
    [
      [0.99, 0.9],
      [0.73, 1],
      [0.22, 0.97],
      [0, 0.77],
      [0.1, 0.61],
      [0.84, 0.43],
      [1, 0.25],
      [0.83, 0.05],
      [0.27, 0],
      [0, 0.12],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  U: [
    [
      [0, 1],
      [0, 0.24],
      [0.2, 0.02],
      [0.78, 0.02],
      [1, 0.24],
      [1, 1],
    ],
  ],
  V: [
    [
      [0, 1],
      [0.5, 0],
      [1, 1],
    ],
  ],
};
function inscription(out) {
  const width = 0.165,
    spacing = 0.222,
    height = 0.311;
  const lines = ['LAVDI', 'E PËRJETSHME', 'DËSHMORËVE', 'TË ATDHEUT'];
  for (const [row, line] of lines.entries())
    for (const [column, char] of [...line].entries()) {
      if (char === ' ') continue;
      const x = (column - (line.length - 1) / 2) * spacing - width / 2;
      const y = 6.76 - row * 0.49;
      const at = ([u, v]) => [x + u * width, y + v * height, halfAt(y + v * height)[1] + 0.052];
      const paths = glyphs[char === 'Ë' ? 'E' : char];
      for (const path of paths)
        for (let i = 1; i < path.length; i++) {
          beam(out, 'lettering', at(path[i - 1]), at(path[i]), 0.031, 0.031, rgb.inscription);
        }
      if (char === 'Ë')
        for (const u of [0.29, 0.76]) {
          beam(
            out,
            'lettering',
            at([u - 0.065, 1.18]),
            at([u + 0.065, 1.18]),
            0.032,
            0.025,
            rgb.inscription,
          );
        }
    }
}

// The bottom of the robe, waist and shoulder carry the cape in one solid sculpture.
// Each row gives height, center, breadth, leading and trailing edges, and the lateral fold.
const robeRows = [
  [0, 0.06, 1.37, 1.33, -2.68, 0.05],
  [0.29, 0.05, 1.47, 1.24, -3.02, 0.12],
  [0.55, 0.04, 1.53, 1.16, -3.26, 0.24],
  [0.77, 0.07, 1.37, 1.1, -3.09, -0.11],
  [0.98, 0.07, 1.51, 1.11, -3.25, 0.27],
  [1.23, 0.1, 1.36, 1.15, -3.08, -0.12],
  [1.48, 0.12, 1.49, 1.21, -3.29, 0.24],
  [1.73, 0.13, 1.4, 1.28, -3.17, -0.08],
  [2.0, 0.14, 1.52, 1.35, -3.23, 0.24],
  [2.29, 0.18, 1.4, 1.43, -3.06, -0.08],
  [2.55, 0.2, 1.58, 1.55, -3.08, 0.26],
  [2.86, 0.25, 1.57, 1.68, -2.85, -0.08],
  [3.09, 0.28, 1.68, 1.76, -2.69, 0.33],
  [3.43, 0.26, 1.59, 1.86, -2.61, -0.14],
  [3.72, 0.2, 1.61, 1.91, -2.51, 0.15],
  [4.09, 0.18, 1.66, 1.99, -2.36, 0.26],
  [4.43, 0.17, 1.51, 2.0, -2.7, -0.03],
  [4.7, 0.12, 1.48, 1.93, -2.82, 0.16],
  [4.91, 0.09, 1.4, 1.82, -2.7, -0.1],
  [5.18, 0.05, 1.41, 1.72, -3.08, 0.19],
  [5.41, 0.02, 1.32, 1.66, -3.36, -0.12],
  [5.66, 0.0, 1.55, 1.64, -3.83, 0.32],
  [5.99, -0.03, 1.56, 1.64, -3.98, -0.01],
  [6.2, -0.06, 1.62, 1.71, -4.1, 0.28],
  [6.53, -0.07, 1.53, 1.75, -4.12, -0.12],
  [6.77, -0.08, 1.62, 1.76, -4.09, 0.24],
  [7.09, -0.12, 1.52, 1.69, -3.96, -0.1],
  [7.33, -0.12, 1.6, 1.64, -3.81, 0.31],
  [7.62, -0.16, 1.55, 1.6, -3.47, 0.08],
  [7.89, -0.16, 1.5, 1.53, -2.27, -0.09],
  [8.12, -0.18, 1.37, 1.48, -1.51, 0.13],
  [8.31, -0.2, 1.13, 1.38, -0.81, 0.11],
  [8.47, -0.26, 0.68, 1.28, -0.25, 0.03],
];
function robe(out, d) {
  const rows = robeRows.filter(
    (_, i) =>
      d >= 3 || i === 0 || i === robeRows.length - 1 || i % (d === 2 ? 2 : d === 1 ? 3 : 5) === 0,
  );
  const N = [10, 14, 22, 34, 46][d];
  const rings = rows.map(([y, x, width, leading, trailing, fold], j) =>
    Array.from({ length: N }, (_, i) => {
      const a = (i * TAU) / N;
      const f = (1 + Math.cos(a)) / 2;
      const fore = mix(trailing, leading, f);
      const flutter = Math.sin(a) * (0.72 + 0.31 * Math.sin(a * 2 + 0.53));
      const fluting =
        (0.064 * Math.cos(7 * a + 0.17 * y) + 0.036 * Math.sin(11 * a - y * 0.25)) *
        Math.min(1, y / 2 + 0.3);
      const bend = Math.min(0.92, 1.1 * y) * Math.sin(a / 2) ** 2 * Math.sin(a + 0.3);
      return onFigure([
        x + (width + 0.76 * fold * Math.sin(a / 2) + fluting) * flutter - 0.29 * (1 - f),
        y + bend + 0.09 * Math.sin(a * 2 + y * 0.38) * Math.sin(a / 2) ** 2,
        fore + Math.sin(a) * (0.23 * (1 - f) + 0.075 * Math.cos(j * 0.53)),
      ]);
    }),
  );
  // The sidewall is a continuous oriented strip. The deep folds turn inward locally.
  for (let j = 1; j < rings.length; j++)
    for (let k = 0; k < N; k++) {
      const i = (k + 1) % N;
      const a = rings[j - 1][k],
        b = rings[j - 1][i],
        c = rings[j][i],
        e = rings[j][k];
      for (const points of [
        [a, b, c],
        [a, c, e],
      ]) {
        out.addTriangle('sculpture', '', points, normalFor(...points), undefined, rgb.figure);
      }
    }
  for (const [ring, normal] of [
    [rings[0], [0, -1, 0]],
    [rings.at(-1), up],
  ]) {
    const center = average(ring);
    for (let k = 0; k < N; k++)
      tri(out, 'sculpture', 'figure', [center, ring[k], ring[(k + 1) % N]], normal);
  }
  // The right shoe and draped hem meet the top course.
  limb(
    out,
    [
      [0.32, 0.2, 0.6, 0.33],
      [0.38, 0.145, 1.16, 0.34, 0.16],
      [0.42, 0.135, 1.53, 0.26, 0.11],
    ],
    Math.min(d, 2),
    'highlighted',
    onFigure,
  );
}

function face(out, d) {
  const P = local([-0.38, Y + 8.82, 0.96], 0.26);
  const rows = [
    [-0.64, -0.04, -0.02, 0.33, 0.34],
    [-0.49, -0.01, 0.07, 0.42, 0.37],
    [-0.32, 0, 0.03, 0.52, 0.44],
    [-0.11, 0, -0.01, 0.56, 0.51],
    [0.09, 0, -0.053, 0.55, 0.51],
    [0.3, -0.025, -0.11, 0.51, 0.46],
    [0.47, -0.03, -0.15, 0.4, 0.37],
    [0.55, -0.08, -0.18, 0.24, 0.25],
  ];
  sections(out, P, d < 2 ? rows.filter((_, i) => [0, 2, 4, 6, 7].includes(i)) : rows, d, 'figure');
  sections(
    out,
    P,
    [
      [-0.44, -0.04, -0.31, 0.53, 0.29],
      [-0.18, -0.01, -0.27, 0.56, 0.36],
      [0.19, -0.02, -0.27, 0.57, 0.4],
      [0.43, -0.05, -0.27, 0.49, 0.39],
      [0.56, -0.08, -0.22, 0.29, 0.29],
    ],
    d,
    'hair',
    0.034,
  );
  if (d === 0) return;
  const lip = P([-0.006, -0.39, 0.46]),
    tip = P([0.026, -0.2, 0.66]),
    root = P([0.01, 0.095, 0.466]);
  const a = P([-0.113, -0.236, 0.454]),
    b = P([0.123, -0.234, 0.459]);
  for (const points of [
    [a, tip, root],
    [tip, b, root],
    [b, tip, lip],
    [tip, a, lip],
  ])
    tri(out, 'sculpture', 'highlighted', points, front);
  limb(
    out,
    [
      [0.024, -0.46, 0.39, 0.108],
      [0.025, -0.403, 0.475, 0.078],
      [0.025, -0.369, 0.46, 0.066],
    ],
    1,
    'figure',
    P,
  );
  if (d < 2) return;
  for (const sign of [-1, 1]) {
    limb(
      out,
      [
        [sign * 0.088, -0.013, 0.487, 0.044],
        [sign * 0.223, 0.019, 0.456, 0.064],
        [sign * 0.395, -0.036, 0.369, 0.039],
      ],
      2,
      'fold',
      P,
    );
    limb(
      out,
      [
        [sign * 0.112, -0.127, 0.472, 0.023],
        [sign * 0.211, -0.119, 0.468, 0.031],
        [sign * 0.317, -0.136, 0.415, 0.018],
      ],
      2,
      'hair',
      P,
    );
    limb(
      out,
      [
        [sign * 0.13, -0.37, 0.414, 0.04],
        [sign * 0.044, -0.38, 0.488, 0.044],
        [0, -0.381, 0.497, 0.044],
      ],
      1,
      'fold',
      P,
    );
  }
  const strands = d === 2 ? 8 : d === 3 ? 15 : 22;
  for (let i = 0; i < strands; i++) {
    const a = (i / (strands - 1)) * 2.96 + 0.16;
    const p = [
      [0.51 * Math.cos(a), 0.263 + 0.16 * Math.sin(a), 0.27 * Math.sin(a)],
      [0.56 * Math.cos(a + 0.22), 0.36 - 0.18 * Math.cos(a), -0.27],
      [0.51 * Math.cos(a + 0.37), 0.1 - 0.34 * Math.cos(a), -0.55],
      [0.36 * Math.cos(a + 0.47), -0.37 - 0.18 * Math.cos(a), -0.63],
    ].map(P);
    tubePath(out, 'sculpture', p, 0.039, rgb[i % 3 === 0 ? 'fold' : 'hair'], d === 2 ? 4 : 5);
  }
}

function foldedBand(out, path, widths, d) {
  const profiles = path.map(([x, y, z], i) => {
    const w = widths[i];
    return [
      [x - w * 0.62, y + w * 0.33, z - w * 0.39],
      [x - w * 0.19, y + w * 0.04, z + w * 0.25],
      [x + w * 0.26, y - w * 0.43, z + w * 0.3],
      [x + w * 0.47, y - w * 0.58, z - w * 0.14],
      [x + w * 0.28, y - w * 0.15, z - w * 0.31],
    ];
  });
  skin(
    out,
    'sculpture',
    'highlighted',
    profiles.map((r) => r.map(onFigure)),
  );
  if (d >= 3)
    tubePath(
      out,
      'sculpture',
      profiles.map((r) => onFigure(r[2])),
      0.032,
      rgb.fold,
      5,
    );
}
function arms(out, d) {
  const arm = [
    [-1.07, 7.94, 0.65, 0.58, 0.5],
    [-1.3, 8.37, 0.78, 0.47, 0.42],
    [-1.39, 8.91, 0.92, 0.33, 0.36],
    [-1.52, 9.44, 1.0, 0.275, 0.28],
    [-1.54, 9.98, 1.07, 0.25, 0.26],
    [-1.61, 10.55, 1.18, 0.194, 0.223],
    [-1.6, 10.91, 1.23, 0.208, 0.181],
  ];
  limb(out, d === 0 ? arm.filter((_, i) => i % 2 === 0) : arm, d, 'figure', onFigure);
  limb(
    out,
    [
      [-1.59, 10.73, 1.19, 0.203],
      [-1.55, 10.96, 1.33, 0.31, 0.25],
      [-1.48, 11.15, 1.42, 0.29, 0.21],
    ],
    Math.min(d, 3),
    'figure',
    onFigure,
  );
  if (d > 0) {
    const rearArm = [
      [0.61, 7.93, 0.89, 0.5, 0.47],
      [1.07, 7.79, 0.28, 0.48, 0.39],
      [1.32, 7.69, -0.65, 0.4, 0.34],
      [1.41, 7.56, -1.55, 0.33, 0.3],
      [1.35, 7.49, -2.36, 0.27, 0.24],
      [1.25, 7.44, -3.19, 0.28, 0.2],
    ];
    limb(out, rearArm, d, 'figure', onFigure);
    if (d >= 2)
      for (let i = 0; i < 4; i++) {
        limb(
          out,
          [
            [1.04 + i * 0.12, 7.43, -3.04, 0.078],
            [1.04 + i * 0.12, 7.41, -3.37, 0.062],
            [1.05 + i * 0.11, 7.37, -3.48 + i * 0.025, 0.046],
          ],
          2,
          'highlighted',
          onFigure,
        );
      }
  }
  foldedBand(
    out,
    [
      [-1.25, 8.14, 0.72],
      [-0.8, 8.28, 1.34],
      [-0.14, 8.14, 1.58],
      [0.44, 7.93, 1.56],
      [0.98, 7.63, 1.29],
      [1.36, 7.31, 0.9],
    ],
    [0.42, 0.4, 0.39, 0.42, 0.55, 0.56],
    d,
  );
  if (d === 0) return;
  foldedBand(
    out,
    [
      [1.33, 7.52, 1.26],
      [1.65, 6.99, 0.71],
      [1.78, 6.46, -0.05],
      [1.84, 6.26, -0.89],
      [1.75, 6.12, -1.8],
      [1.32, 6.11, -2.64],
    ],
    [0.28, 0.47, 0.56, 0.54, 0.38, 0.24],
    d,
  );
  foldedBand(
    out,
    [
      [1.14, 4.63, 1.78],
      [1.57, 4.22, 1.22],
      [1.87, 3.77, 0.41],
      [1.93, 3.5, -0.65],
      [1.89, 3.44, -1.56],
      [1.57, 3.24, -2.35],
    ],
    [0.28, 0.38, 0.46, 0.39, 0.32, 0.18],
    d,
  );
  foldedBand(
    out,
    [
      [-1.29, 6.65, 1.04],
      [-1.65, 6.31, 0.38],
      [-1.85, 5.8, -0.51],
      [-1.92, 5.68, -1.46],
      [-1.78, 5.81, -2.59],
      [-1.28, 5.72, -3.64],
    ],
    [0.22, 0.34, 0.45, 0.45, 0.31, 0.25],
    d,
  );
  if (d >= 2) {
    sections(
      out,
      onFigure,
      [
        [4.95, 0.08, 0.11, 1.42, 1.61],
        [5.19, 0.02, 0.11, 1.41, 1.64],
      ],
      d,
      'highlighted',
    );
    for (const side of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const x = side * (0.45 + i * 0.2);
        tubePath(
          out,
          'sculpture',
          [
            [x, 0.3, 1.15 - i * 0.08],
            [x * 0.96, 1.55, 1.17 - i * 0.09],
            [x * 0.96, 2.53, 1.4 - i * 0.12],
            [x * 1.09, 3.47, 1.62 - i * 0.15],
            [x * 0.9, 4.65, 1.77 - i * 0.15],
          ].map(onFigure),
          0.05 + i * 0.014,
          rgb[i === 1 ? 'fold' : 'highlighted'],
          d === 2 ? 4 : 6,
        );
      }
  }
}
function crest(out, d) {
  const [x, y, z] = layout.crown;
  const pos = (u, v, w = 0) => onFigure([x + u, y + v, z + w + u * 0.22]);
  const rings = [-0.15, 0.16].map((w) =>
    Array.from({ length: 10 }, (_, i) => {
      const a = Math.PI / 2 + (i * TAU) / 10,
        r = i % 2 ? 0.31 : 0.68;
      return pos(Math.cos(a) * r, Math.sin(a) * r, w);
    }),
  );
  skin(out, 'sculpture', 'highlighted', rings);
  for (const sign of [-1, 1]) {
    const path = [
      [0, -0.29],
      [sign * 0.43, -0.27],
      [sign * 0.69, -0.11],
      [sign * 0.84, 0.2],
      [sign * 0.86, 0.44],
    ];
    tubePath(
      out,
      'sculpture',
      path.map(([u, v]) => pos(u, v)),
      0.14,
      rgb.figure,
      d === 0 ? 4 : 7,
    );
    for (const [i, [u, v]] of path.entries()) {
      if (i === 0) continue;
      for (const side of d === 0 ? [1] : [-1, 1]) {
        const tip = pos(u + sign * 0.15 * side, v + 0.17, 0.12);
        const a = pos(u - sign * 0.145, v - 0.11, 0.06),
          b = pos(u + sign * 0.114, v - 0.09, 0.14);
        const ridge = pos(u + 0.035 * sign, v + 0.043, 0.26);
        for (const points of [
          [a, b, ridge],
          [a, ridge, tip],
          [ridge, b, tip],
        ])
          tri(out, 'sculpture', 'highlighted', points, front);
        tri(out, 'sculpture', 'figure', [tip, b, a], [0, 0, -1]);
      }
    }
  }
}

export function buildMonument(out, level = 'master') {
  const detail = tier[level];
  if (detail === undefined) throw Error(`Unknown Mother Albania tier ${level}`);
  site(out, detail);
  pedestal(out, detail);
  robe(out, detail);
  arms(out, detail);
  face(out, detail);
  crest(out, detail);
  if (detail >= 2) inscription(out);
}
export const buildMonumentSkyline = (out) => buildMonument(out, 'skyline');
export const buildMonumentDistrict = (out) => buildMonument(out, 'district');
export const buildMonumentStreet = (out) => buildMonument(out, 'street');
export const buildMonumentCloseup = (out) => buildMonument(out, 'closeup');

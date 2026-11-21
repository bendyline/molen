import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  buildSteleStone,
  surfaces as currentSurfaces,
} from '../../summer_palace/models/summer-palace-farming-stele-model.mjs';

// The exposed setting and its round feet are visible in the dated southwest photograph.
export const surfaces = {
  paving: currentSurfaces.paving,
  stone: currentSurfaces.stone,
  tablet: currentSurfaces.tablet,
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.18 },
};
const bronze = [0.34, 0.291, 0.194];
const collar = [0.39, 0.327, 0.231];
const signBrown = [0.111, 0.086, 0.064];
const signInk = [0.76, 0.74, 0.66];
const pavement = [0.42, 0.408, 0.376];
const enclosure = [
  [-1.65, -0.98],
  [1.65, -0.98],
  [1.65, 0.98],
  [-1.65, 0.98],
];

function posts(out, detail) {
  const sides = [5, 7, 9, 12, 16][detail];
  for (const [x, z] of enclosure) {
    const cylinder = (rows, tint) =>
      loft(
        out,
        'iron',
        rows.map(([y, radius]) => radialRing(y, radius, radius, sides, [x, z])),
        tint,
      );
    cylinder(
      [
        [0, 0.106],
        [0.022, 0.109],
        [0.039, 0.075],
      ],
      collar,
    );
    cylinder(
      [
        [0.027, 0.049],
        [1.045, 0.049],
        [1.062, 0.04],
      ],
      bronze,
    );
    if (detail >= 2) {
      for (const y of [0.086, 0.849, 1.009])
        cylinder(
          [
            [y - 0.017, 0.052],
            [y + 0.017, 0.052],
          ],
          collar,
        );
    }
  }
}

function guardRails(out, detail) {
  posts(out, detail);
  for (const [i, [x, z]] of enclosure.entries()) {
    const [u, v] = enclosure[(i + 1) % enclosure.length];
    for (const [y, width] of [
      [1.005, 0.048],
      [0.845, 0.042],
      [0.103, 0.036],
    ])
      beam(out, 'iron', [x, y, z], [u, y, v], width, width, bronze);
    const count = Math.round(Math.hypot(u - x, v - z) / (detail === 0 ? 0.35 : 0.179));
    for (let j = 1; j < count; j++) {
      const t = j / count;
      const bx = x + (u - x) * t;
      const bz = z + (v - z) * t;
      box(out, 'iron', [bx - 0.0115, 0.11, bz - 0.0115], [bx + 0.0115, 0.837, bz + 0.0115], bronze);
    }
  }
}

function apron(out, detail) {
  box(out, 'paving', [-2.46, -0.21, -1.93], [2.46, -0.021, 1.93], pavement);
  if (detail < 2) {
    box(out, 'stone', [-2.46, -0.023, -1.93], [2.46, 0, 1.93], pavement);
    return;
  }
  const rowDepth = 3.86 / 7;
  for (let row = 0; row < 7; row++) {
    const z = row * rowDepth - 1.93;
    const edges = [-2.46];
    const shift = row % 2 === 0 ? 0.41 : 0;
    for (let col = 1; col < 7; col++) {
      edges.push(-2.46 + 0.71 * col - shift + 0.09 * Math.sin(col * 1.8 + row * 2.1));
    }
    edges.push(2.46);
    for (let col = 1; col < edges.length; col++) {
      const shade = 0.95 + 0.1 * Math.cos(row * 2.1 + col * 3.87);
      box(
        out,
        'stone',
        [edges[col - 1] + 0.005, -0.024, z + 0.006],
        [edges[col] - 0.005, 0, z + rowDepth - 0.006],
        pavement.map((value) => value * shade),
      );
    }
  }
}

// The photograph resolves the five characters of the heading. The two smaller
// paragraphs below are represented by their line spacing and visible lengths.
const signTitle = [
  // 耕
  [
    [
      [1, 8],
      [4, 8],
    ],
    [
      [0.7, 6.2],
      [4.2, 6.2],
    ],
    [
      [0.5, 4.5],
      [4.4, 4.5],
    ],
    [
      [2.6, 9.1],
      [2.6, 0.7],
    ],
    [
      [2.4, 4.4],
      [0.5, 1.4],
    ],
    [
      [2.7, 4],
      [4.1, 2.8],
    ],
    [
      [5.2, 7.9],
      [9.6, 7.9],
    ],
    [
      [4.8, 5.1],
      [9.9, 5.1],
    ],
    [
      [6.4, 9.2],
      [6.4, 3.4],
      [5.3, 0.9],
    ],
    [
      [8.6, 9.1],
      [8.6, 0.6],
    ],
  ],
  // 织
  [
    [
      [3.1, 9.1],
      [0.7, 5.6],
      [3.1, 5.7],
    ],
    [
      [4, 7.2],
      [1, 3.7],
      [4.1, 4],
    ],
    [
      [0.7, 1.6],
      [4.2, 2.5],
    ],
    [
      [5.2, 8.3],
      [9.3, 8.3],
      [9.3, 4.4],
      [5.2, 4.4],
      [5.2, 8.3],
    ],
    [
      [6.5, 3.1],
      [5, 1],
    ],
    [
      [8.2, 3.1],
      [9.8, 1],
    ],
  ],
  // 图
  [
    [
      [1, 8.9],
      [9, 8.9],
      [9, 0.8],
      [1, 0.8],
      [1, 8.9],
    ],
    [
      [4.9, 7.9],
      [3.1, 5.7],
    ],
    [
      [4.2, 6.9],
      [7.2, 6.9],
      [5.9, 5.3],
      [3, 3.9],
    ],
    [
      [4.5, 6.4],
      [5.7, 5.2],
      [7.7, 4],
    ],
    [
      [4.7, 4],
      [5.7, 3.5],
    ],
    [
      [4.2, 2.9],
      [6.4, 2],
    ],
  ],
  // 石
  [
    [
      [0.8, 8.6],
      [9.4, 8.6],
    ],
    [
      [4.4, 8.5],
      [3.6, 6.3],
      [0.6, 3.8],
    ],
    [
      [3.3, 5],
      [8.5, 5],
      [8.5, 1.3],
      [3.3, 1.3],
      [3.3, 5],
    ],
  ],
  // 碑
  [
    [
      [0.5, 8.5],
      [4.2, 8.5],
    ],
    [
      [2.2, 8.4],
      [1.7, 6.4],
      [0.4, 4.8],
    ],
    [
      [1.3, 5.8],
      [3.7, 5.8],
      [3.7, 2.8],
      [1.3, 2.8],
      [1.3, 5.8],
    ],
    [
      [7.5, 9.4],
      [6.6, 8.25],
    ],
    [
      [4.7, 8.15],
      [9.2, 8.15],
      [9.2, 4.45],
      [4.7, 4.45],
      [4.7, 8.15],
    ],
    [
      [4.8, 6.3],
      [9.2, 6.3],
    ],
    [
      [7, 8.15],
      [7, 5.15],
      [5.8, 3.3],
    ],
    [
      [4.4, 2.8],
      [9.85, 2.8],
    ],
    [
      [7.3, 4.1],
      [7.3, 0.6],
    ],
  ],
];

// Visible ink in the rectified 86 × 81 pixel photo panel. Each row stores pairs of x coordinates.
const panelInkRuns = [
  [
    20, 17, 23, 24, 26, 27, 29, 30, 32, 33, 34, 35, 39, 41, 43, 46, 47, 50, 52, 53, 55, 56, 57, 59,
    63, 65, 66, 69, 70, 72, 73, 75, 76,
  ],
  [
    21, 17, 26, 27, 29, 30, 32, 33, 34, 37, 40, 41, 43, 44, 48, 50, 52, 53, 55, 56, 58, 59, 67, 69,
    77,
  ],
  [
    22, 17, 23, 27, 28, 30, 32, 33, 34, 37, 40, 41, 43, 44, 45, 46, 48, 50, 55, 56, 58, 59, 67, 69,
    70, 71, 77,
  ],
  [23, 56, 57, 62, 63, 65, 66, 67, 68, 72, 73, 75, 76],
  [25, 13, 14, 16, 18, 19, 21, 22, 24, 25, 27, 29, 30, 33, 35, 39, 41, 45, 47, 48, 50, 60, 62],
  [26, 12, 15, 16, 18, 19, 24, 25, 27, 28, 31, 33, 35, 37, 38, 39, 50, 51, 53, 54, 77],
  [27, 12, 15, 16, 18, 19, 21, 22, 24, 25, 31, 32, 35, 37, 38, 39, 53, 54, 56, 57, 65, 67, 75],
  [
    28, 16, 17, 19, 21, 23, 24, 29, 30, 36, 38, 45, 50, 51, 53, 55, 56, 57, 59, 60, 65, 67, 68, 70,
    75,
  ],
  [30, 53, 54],
  [31, 13, 14, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 66, 68, 70, 71, 76],
  [32, 12, 14, 16, 17, 19, 21, 22, 24, 25, 27, 28, 30, 31, 66, 68, 76],
  [
    33, 12, 14, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 35, 36, 37, 39, 41, 42, 43, 49, 50, 54, 55,
    60, 61, 63, 64, 66, 67, 73, 74, 76,
  ],
  [36, 12, 20, 22, 24, 25, 27, 28, 30, 31, 32, 34, 36],
  [37, 12, 30, 31, 32, 34, 36],
  [38, 12, 33, 34, 36],
  [44, 22, 23, 35, 36],
  [45, 13, 20, 21, 28, 30, 32, 34, 43, 46, 47, 48, 57, 59, 63, 64, 74],
  [46, 13, 20, 22, 28, 30, 32, 35, 44, 45, 47, 49, 58, 59, 63, 64, 74],
  [47, 56, 57],
  [49, 32, 34, 42, 43, 55, 56, 66, 68, 69, 72, 74, 75],
  [50, 17, 25, 27, 28, 31, 35, 39, 44, 46, 50, 52, 54, 55, 64, 66, 76],
  [51, 17, 25, 27, 28, 46, 49, 58, 59, 72, 74],
  [52, 58, 59, 64, 69, 72, 73, 74, 75],
  [
    53, 12, 17, 19, 22, 24, 29, 31, 32, 33, 35, 36, 39, 41, 45, 46, 48, 49, 56, 57, 62, 64, 70, 71,
    73, 74, 76,
  ],
  [54, 12, 18, 20, 22, 25, 29, 31, 32, 34, 35, 38, 39, 69, 70],
  [55, 31, 33, 47, 48, 56, 57, 62, 65, 67, 71, 73, 75],
  [56, 12, 17, 18, 28, 29, 33, 34, 37, 39, 45, 46, 48, 49, 53, 54, 60, 63, 65, 67, 71, 73, 75],
  [57, 12, 17, 19, 20, 21, 28, 30, 32, 43, 44, 47, 48, 74, 75],
  [58, 21, 22, 29, 30, 34, 36, 44, 45, 47, 48, 49, 54, 56, 59, 61, 69, 72, 75],
  [59, 12, 22, 24, 31, 32, 33, 34, 42, 44, 45, 47, 55, 56, 59, 61, 69, 72, 73, 74, 75],
  [60, 12, 18, 19, 22, 24, 25, 38, 39, 68, 69],
  [61, 16, 17, 32, 34, 38, 40, 43, 44, 45, 48, 50, 54, 56, 62, 63, 65, 66, 69, 70, 75],
  [62, 11, 14, 16, 19, 21, 27, 29, 37, 38, 41, 42, 48, 50, 54, 55, 61, 63, 64, 67, 68, 71, 72],
  [63, 12, 14, 17, 19, 21, 24, 29, 30, 32, 34, 35, 36, 56, 57],
  [
    64, 17, 18, 20, 21, 23, 24, 28, 29, 33, 34, 35, 40, 42, 43, 45, 48, 49, 54, 56, 60, 61, 66, 67,
    72, 74, 75,
  ],
  [65, 11, 15, 16, 18, 19, 21, 22, 31, 32, 41, 42, 43, 44, 48, 50, 54, 58, 59, 61, 66, 68, 69],
  [66, 11, 14, 16, 18, 25, 27, 40, 41],
  [67, 16, 17, 22, 23, 26, 28, 29, 32, 35, 41, 42, 44, 45, 48, 49, 53],
  [68, 11, 21, 22, 25, 26, 40, 42, 43, 45, 48, 49, 53],
  [69, 12, 20],
];

function panelLettering(out, x, z) {
  const face = z + 0.025;
  const mark = (points, tint) =>
    out.addQuad(
      'iron',
      'palette:#ffffff',
      points.map(([u, v]) => [x + u, v, face]),
      [0, 0, 1],
      [],
      tint,
    );
  for (const [index, glyph] of signTitle.entries()) {
    const left = (index - 2.5) * 0.065 + 0.008;
    for (const stroke of glyph) {
      for (let i = 1; i < stroke.length; i++) {
        const [a, b] = [stroke[i - 1], stroke[i]].map(([u, y]) => [
          left + u * 0.0049,
          1.147 + y * 0.0055,
        ]);
        const dx = b[0] - a[0],
          dy = b[1] - a[1];
        const scale = 0.0018 / Math.hypot(dx, dy);
        const edge = ([u, v], side) => [u - dy * scale * side, v + dx * scale * side];
        mark([edge(a, 1), edge(a, -1), edge(b, -1), edge(b, 1)], signInk);
      }
    }
  }
  for (const [row, ...spans] of panelInkRuns) {
    const top = 1.29 - row * (0.67 / 81);
    const bottom = top - 0.67 / 81;
    for (let i = 0; i < spans.length; i += 2) {
      const left = (spans[i] / 86 - 0.5) * 0.766;
      const right = (spans[i + 1] / 86 - 0.5) * 0.766;
      mark(
        [
          [left, bottom],
          [right, bottom],
          [right, top],
          [left, top],
        ],
        [0.54, 0.52, 0.47],
      );
    }
  }
}

function interpretationPanel(out, detail) {
  const [x, z] = [-1.86, -1.62];
  for (const side of [-1, 1]) {
    const post = x + 0.36 * side;
    box(out, 'iron', [post - 0.019, 0, z - 0.02], [post + 0.019, 1.24, z + 0.02], signBrown);
  }
  box(out, 'iron', [x - 0.383, 0.62, z - 0.024], [x + 0.383, 1.29, z + 0.024], signBrown);
  box(out, 'iron', [x - 0.35, 1.283, z - 0.023], [x + 0.35, 1.34, z + 0.023], signBrown);
  if (detail >= 3) panelLettering(out, x, z);
}

function buildOpenApron(out, detail) {
  apron(out, detail);
  buildSteleStone(out, detail);
  guardRails(out, detail);
  if (detail >= 2) interpretationPanel(out, detail);
}

export const buildMaster = (out) => buildOpenApron(out, 4);
export const buildSkyline = (out) => buildOpenApron(out, 0);
export const buildDistrict = (out) => buildOpenApron(out, 1);
export const buildStreet = (out) => buildOpenApron(out, 2);
export const buildCloseup = (out) => buildOpenApron(out, 3);

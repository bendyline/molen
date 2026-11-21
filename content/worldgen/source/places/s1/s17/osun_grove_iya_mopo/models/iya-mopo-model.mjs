import { ShapeUtils, Vector2 } from 'three';
import {
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const surfaces = {
  cement: { slot: 'wall', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
  mosaic: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
  pots: { slot: 'trim', graph: 'clay_fired', roughness: 0.95, metallic: 0 },
};

const ochre = [0.55, 0.32, 0.24];
const rose = [0.63, 0.37, 0.29];
const fold = [0.49, 0.39, 0.3];
const moss = [0.34, 0.34, 0.23];
const stone = [0.48, 0.42, 0.35];
const hollow = [0.19, 0.145, 0.095];
const palette = 'palette:#ffffff';
const fullTurn = Math.PI * 2;

// Local +X follows the extended wrapper and legs and +Z faces the photographed clearing.
// Sections contain [x, y, z, width radius, depth radius] in meters.
const trunk = [
  [-0.45, 0.04, -0.35, 3.4, 2.95],
  [-0.56, 1.05, -0.33, 3.25, 2.67],
  [-0.35, 2.48, -0.35, 2.94, 2.58],
  [0.12, 3.7, -0.31, 2.46, 2.2],
  [0.02, 5.0, -0.51, 2.29, 1.93],
  [-0.22, 6.02, -0.53, 2.08, 1.67],
  [-0.11, 6.96, -0.69, 1.7, 1.55],
  [-0.22, 8.45, -0.69, 1.61, 1.45],
  [-0.05, 9.88, -0.83, 1.48, 1.24],
  [0.09, 10.71, -0.78, 0.9, 0.79],
];

// Three pairs fan toward the clearing, as seen in the Trust's overhead photograph.
const arms = [
  [
    [-0.99, 8.72, 0.45, 0.83, 0.74],
    [-1.43, 9.3, 2.85, 0.65, 0.88],
    [-2.08, 9.68, 6.65, 0.37, 0.52],
    [-2.78, 10.58, 12.3, 0.16, 0.25],
    [-3.02, 11.64, 15.94, 0.048, 0.072],
  ],
  [
    [-0.54, 8.89, 0.72, 0.73, 0.59],
    [-0.71, 9.37, 3.11, 0.56, 0.79],
    [-0.9, 9.97, 7.01, 0.35, 0.49],
    [-1.07, 10.94, 12.73, 0.16, 0.23],
    [-0.95, 11.93, 16.34, 0.056, 0.088],
  ],
  [
    [-0.03, 9.01, 0.67, 0.75, 0.55],
    [0.86, 9.63, 3.22, 0.63, 0.74],
    [2.38, 10.32, 6.8, 0.41, 0.48],
    [3.94, 11.25, 11.03, 0.2, 0.26],
    [4.87, 12.02, 14.57, 0.06, 0.08],
  ],
  [
    [0.37, 9.11, 0.47, 0.68, 0.51],
    [1.66, 9.73, 2.75, 0.58, 0.66],
    [3.09, 10.51, 6.19, 0.34, 0.45],
    [4.51, 11.43, 10.29, 0.19, 0.25],
    [5.66, 12.24, 13.57, 0.06, 0.085],
  ],
  [
    [0.79, 9.19, 0.39, 0.76, 0.56],
    [3.36, 9.92, 2.26, 0.69, 0.74],
    [6.73, 10.3, 5.27, 0.41, 0.45],
    [10.47, 10.65, 8.29, 0.16, 0.22],
    [13.36, 11.37, 10.15, 0.053, 0.065],
  ],
  [
    [1.08, 9.28, -0.09, 0.67, 0.47],
    [3.38, 10.02, 1.69, 0.55, 0.66],
    [6.14, 10.58, 3.97, 0.35, 0.42],
    [9.54, 11.03, 6.96, 0.15, 0.2],
    [12.1, 11.68, 9.08, 0.057, 0.066],
  ],
];

const neck = [
  [-0.26, 9.6, -0.7, 0.67, 0.6],
  [-0.35, 10.76, -0.57, 0.53, 0.51],
  [-0.47, 12.1, -0.5, 0.37, 0.37],
  [-0.56, 13.22, -0.31, 0.37, 0.4],
  [-0.59, 13.62, -0.13, 0.49, 0.56],
  [-0.8, 13.88, -0.31, 0.3, 0.36],
];
const crown = [
  [-1.42, 13.76, 0.94, 0.14, 0.27],
  [-1.05, 14.06, 0.4, 0.38, 0.59],
  [-0.62, 14.0, -0.36, 0.66, 0.69],
  [-0.45, 13.85, -1.04, 0.52, 0.5],
  [-0.16, 13.49, -1.61, 0.16, 0.2],
  [0.13, 13.37, -1.98, 0.052, 0.102],
];

const loops = [
  [
    [-3.1, 0.2, -0.45, 0.7, 0.51],
    [-3.85, 3.18, -0.42, 0.79, 0.52],
    [-4.57, 6.28, -0.32, 0.66, 0.43],
    [-5.19, 8.22, -0.77, 0.49, 0.39],
    [-6.01, 8.38, -1.32, 0.45, 0.38],
    [-7.48, 6.83, -1.46, 0.41, 0.34],
    [-8.21, 3.82, -1.45, 0.41, 0.3],
    [-8.9, 0.24, -1.97, 0.54, 0.42],
  ],
  [
    [-1.9, 0.17, 1.26, 0.7, 0.54],
    [-1.91, 2.97, 1.72, 0.73, 0.43],
    [-2.48, 5.66, 2.13, 0.62, 0.36],
    [-3.43, 7.75, 2.53, 0.55, 0.38],
    [-4.41, 7.48, 3.22, 0.43, 0.34],
    [-5.3, 4.18, 4.15, 0.37, 0.29],
    [-6.37, 0.2, 4.91, 0.56, 0.34],
  ],
  [
    [1.37, 0.35, 2.21, 0.73, 0.46],
    [2.33, 2.48, 2.8, 0.69, 0.42],
    [3.37, 3.8, 2.56, 0.62, 0.36],
    [4.63, 4.08, 1.82, 0.51, 0.47],
    [5.79, 3.61, 0.96, 0.6, 0.4],
    [7.0, 2.07, 0.96, 0.45, 0.37],
    [7.88, 0.38, 1.75, 0.66, 0.47],
  ],
  [
    [5.24, 0.33, 4.08, 0.62, 0.4],
    [6.32, 1.17, 3.59, 0.64, 0.37],
    [8.64, 2.43, 3.06, 0.57, 0.34],
    [10.41, 3.96, 2.14, 0.53, 0.44],
    [11.53, 3.49, 1.36, 0.47, 0.35],
    [12.85, 1.89, 1.22, 0.47, 0.32],
    [13.86, 0.32, 2.27, 0.64, 0.42],
  ],
  [
    [11.8, 0.22, 3.37, 0.5, 0.46],
    [13.5, 1.12, 3.8, 0.42, 0.39],
    [15.44, 2.77, 3.39, 0.5, 0.36],
    [17.54, 3.39, 2.44, 0.56, 0.4],
    [18.7, 2.61, 1.97, 0.49, 0.34],
    [19.62, 0.29, 2.16, 0.56, 0.43],
  ],
  [
    [17.5, 0.22, 3.48, 0.49, 0.32],
    [19.43, 1.24, 3.67, 0.48, 0.35],
    [21.14, 2.44, 3.03, 0.47, 0.34],
    [22.06, 2.18, 2.53, 0.45, 0.35],
    [23.82, 0.24, 2.02, 0.52, 0.39],
  ],
];

// Relative heights sampled at the approximate southwest-facing placement.
// Keep the low hems in contact with the native terrain beyond the paved apron.
const outstretched = [
  [
    [1.35, 1.86, -0.51, 1.38, 1.73],
    [5.05, 0.8, -0.15, 1.15, 1.48],
    [10.2, 0.2, -0.35, 0.62, 1.35],
    [18.8, -0.04, -0.91, 0.4, 1.01],
    [27.45, -0.04, -0.88, 0.3, 0.83],
    [33.33, -0.01, -1.72, 0.35, 0.56],
    [38.3, 0.27, -8.1, 0.49, 0.63],
    [41.92, 0.47, -14.62, 0.24, 0.42],
  ],
  [
    [1.55, 1.5, 1.29, 1.07, 1.46],
    [5.44, 0.54, 2.21, 0.94, 1.28],
    [10.82, 0.17, 1.72, 0.63, 1.19],
    [18.44, -0.1, 1.06, 0.37, 0.82],
    [29.44, -0.08, 0.76, 0.28, 0.62],
    [35.47, -0.15, -0.22, 0.32, 0.52],
    [40.23, 0.03, -6.45, 0.39, 0.58],
    [44.25, 0.23, -12.94, 0.16, 0.34],
  ],
  [
    [-2.8, 0.46, -1.09, 0.49, 1.35],
    [-7.73, 0.03, -3, 0.39, 1.26],
    [-13.18, -0.17, -5.46, 0.31, 0.91],
    [-18.81, -0.31, -8.8, 0.27, 0.63],
    [-21.62, -0.04, -14.7, 0.42, 0.48],
  ],
  [
    [-2.84, 0.37, 0.53, 0.37, 1.44],
    [-7.9, -0.11, -0.43, 0.31, 1.05],
    [-15.61, -0.43, -2.54, 0.24, 0.72],
    [-21.1, -0.53, -5.15, 0.29, 0.55],
    [-23.03, -0.52, -7.1, 0.29, 0.48],
  ],
];

// The overhead film shows weathered paving around the torso and open ground between the long forms.
const pavement = [
  [-5.05, 1.56],
  [-4.6, -1.8],
  [-3.6, -3.2],
  [-0.4, -3.7],
  [2.5, -3.1],
  [4.25, -1.2],
  [4.6, 1.25],
  [3.1, 2.65],
  [1.4, 3.65],
  [-0.55, 4.45],
  [-2.72, 4.55],
  [-4.35, 3.42],
];

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (v) => v.map((n) => n / Math.hypot(...v));
const lerp = (a, b, t) => a.map((value, i) => value + t * (b[i] - value));
const scaleColor = (color, amount) => color.map((n) => n * amount);

function smooth(sections, passes) {
  let rows = sections;
  for (let pass = 0; pass < passes; pass++) {
    const next = [rows[0]];
    for (let i = 1; i < rows.length; i++) {
      next.push(lerp(rows[i - 1], rows[i], 0.25), lerp(rows[i - 1], rows[i], 0.75));
    }
    next.push(rows.at(-1));
    rows = next;
  }
  return rows;
}

function sweep(out, section, sides, passes, color, reference = [1, 0, 0]) {
  const rows = smooth(section, passes);
  const rings = rows.map(([x, y, z, u, v], row) => {
    const before = rows[Math.max(0, row - 1)],
      after = rows[Math.min(row + 1, rows.length - 1)];
    const tangent = unit(after.slice(0, 3).map((d, i) => d - before[i]));
    const side = unit(cross(tangent, reference));
    const up = cross(tangent, side);
    return Array.from({ length: sides }, (_, i) => {
      const a = (fullTurn * i) / sides;
      const station = (row / (rows.length - 1)) * 5;
      const fluting =
        1 + 0.075 * Math.cos(a * 3 + 0.4 * station) + 0.058 * Math.sin(a * 5 - 0.36 * station);
      return [x, y, z].map(
        (d, axis) => d + fluting * (side[axis] * u * Math.cos(a) + up[axis] * v * Math.sin(a)),
      );
    });
  });
  for (let row = 1; row < rings.length; row++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      patch(
        out,
        'cement',
        [rings[row - 1][i], rings[row - 1][next], rings[row][next], rings[row][i]],
        color,
      );
    }
  }
  // End rings are planar. Close each with a fan to retain the taper geometry.
  for (const [index, reverse] of [
    [0, true],
    [rings.length - 1, false],
  ]) {
    const center = rows[index].slice(0, 3);
    const ring = rings[index];
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides;
      const points = reverse ? [center, ring[next], ring[i]] : [center, ring[i], ring[next]];
      face(out, 'cement', points, color);
    }
  }
}

function face(out, surface, points, color, normal = normalFor(...points)) {
  out.addTriangle(
    surface,
    palette,
    points,
    normal,
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    color,
  );
}

function patch(out, surface, [a, b, c, d], color) {
  face(out, surface, [a, b, c], color);
  face(out, surface, [a, c, d], color);
}

// Wide, folded lips beneath the raised wrapper edges. The undersides remain visible
// through the gaps between the independently curved forms.
function wrapperWebs(out) {
  const webs = [
    [
      [
        [-3.2, 2.61, 1.38],
        [-2.24, 1.06, 1.72],
      ],
      [
        [-3.59, 5.94, 1.58],
        [-2.45, 4.32, 2.15],
      ],
      [
        [-4.66, 7.65, 1.93],
        [-4.17, 5.03, 2.67],
      ],
      [
        [-5.42, 6.08, 2.92],
        [-5.2, 5.34, 4.01],
      ],
      [
        [-6.1, 2.1, 4.24],
        [-5.76, 2.1, 4.78],
      ],
    ],
    [
      [
        [1.43, 1.39, 2.27],
        [1.79, 0.59, 1.9],
      ],
      [
        [2.34, 3.09, 2.93],
        [2.51, 1.82, 3.43],
      ],
      [
        [4.08, 4.05, 2.31],
        [4.03, 2.04, 2.96],
      ],
      [
        [5.73, 3.66, 1.58],
        [5.79, 2.47, 2.23],
      ],
      [
        [7.41, 1.03, 1.56],
        [7.77, 0.58, 2.33],
      ],
    ],
    [
      [
        [7.61, 1.3, 3.77],
        [7.41, 0.45, 2.75],
      ],
      [
        [9.3, 2.95, 2.94],
        [9.11, 1.29, 2.61],
      ],
      [
        [10.42, 4.01, 2.49],
        [10.76, 2.18, 1.98],
      ],
      [
        [11.93, 3.12, 1.58],
        [12.18, 1.99, 2.29],
      ],
      [
        [13.54, 1.06, 1.96],
        [13.55, 0.48, 2.45],
      ],
    ],
  ];
  for (const web of webs) {
    for (let i = 1; i < web.length; i++) {
      const [a, b] = web[i - 1],
        [c, d] = web[i];
      const back = ([x, y, z]) => [x, y - 0.07, z - 0.19];
      patch(out, 'cement', [a, b, d, c], fold);
      patch(out, 'cement', [back(c), back(d), back(b), back(a)], ochre);
      patch(out, 'cement', [back(a), back(b), b, a], ochre);
      patch(out, 'cement', [b, back(b), back(d), d], fold);
      patch(out, 'cement', [a, c, back(c), back(a)], fold);
      if (i === web.length - 1) patch(out, 'cement', [d, back(d), back(c), c], ochre);
    }
  }
}

function body(out, sides, detailed) {
  const rings = trunk.map(([x, y, z, width, depth], row) =>
    Array.from({ length: sides }, (_, i) => {
      const a = Math.PI / 2 + Math.PI / sides - (fullTurn * i) / sides;
      const rib = 1 + 0.12 * Math.cos(3 * a - 0.24 * row) + 0.065 * Math.sin(5 * a + 0.71 * row);
      return [x + width * rib * Math.cos(a), y, z + depth * rib * Math.sin(a)];
    }),
  );
  for (let row = 0; row < rings.length - 1; row++) {
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const corners = [rings[row][i], rings[row][j], rings[row + 1][j], rings[row + 1][i]];
      const a = (fullTurn * (i + 0.5)) / sides;
      const front = Math.cos(a) > 0.35;
      const color = scaleColor(front ? rose : ochre, 0.91 + 0.07 * Math.sin(a * 2.2 + 0.7 * row));
      const slit = detailed && ((i === 0 && row === 4) || (i === sides - 2 && row === 2));
      if (!slit) {
        patch(out, 'cement', corners, color);
        continue;
      }
      const center = [0, 1, 2].map((axis) => corners.reduce((sum, p) => sum + p[axis] / 4, 0));
      const lip = corners.map((p) => [
        center[0] + 0.34 * (p[0] - center[0]),
        center[1] + 0.72 * (p[1] - center[1]),
        center[2] + 0.58 * (p[2] - center[2]),
      ]);
      const recess = lip.map(([x, y, z]) => [x * 0.74, y, z * 0.68]);
      for (let edge = 0; edge < 4; edge++) {
        const next = (edge + 1) % 4;
        patch(out, 'cement', [corners[edge], corners[next], lip[next], lip[edge]], color);
        patch(out, 'cement', [lip[edge], lip[next], recess[next], recess[edge]], ochre);
      }
      patch(out, 'cement', recess, hollow);
    }
  }
  for (const [ring, normal] of [
    [rings[0], [0, -1, 0]],
    [rings.at(-1), [0, 1, 0]],
  ]) {
    const center = [0, 1, 2].map((axis) => ring.reduce((sum, p) => sum + p[axis] / sides, 0));
    for (let i = 0; i < sides; i++)
      face(out, 'cement', [center, ring[i], ring[(i + 1) % sides]], ochre, normal);
  }
}

function court(out, detailed) {
  const paving = [0.52, 0.37, 0.29];
  const vertices = pavement.map(([x, z]) => [x, 0.013, z]);
  const base = pavement.map(([x, z]) => [x, -0.48, z]);
  for (const indices of ShapeUtils.triangulateShape(
    pavement.map((p) => new Vector2(...p)),
    [],
  )) {
    const color = scaleColor(paving, 0.91 + 0.09 * Math.sin(indices[1] * 1.47));
    face(
      out,
      'mosaic',
      indices.map((i) => vertices[i]),
      color,
      [0, 1, 0],
    );
    face(
      out,
      'mosaic',
      indices.map((i) => base[i]),
      paving,
      [0, -1, 0],
    );
  }
  for (let i = 0; i < vertices.length; i++) {
    const next = (i + 1) % vertices.length;
    patch(out, 'mosaic', [base[next], base[i], vertices[i], vertices[next]], paving);
  }
  if (!detailed) return;
  for (const [index, [x, z]] of [
    [-3.22, 2.92],
    [-1.42, 4.05],
    [0.1, 3.58],
    [1.75, 2.23],
    [-3.2, -2.64],
  ].entries()) {
    const scale = 0.51 + 0.12 * Math.sin(index + 0.5);
    const rows = Array.from({ length: 3 }, (_, row) => [
      [x - 1.28 * scale, 0.025, z + row * 0.26],
      [x - 0.3 * scale, 0.025, z + row * 0.26 + 0.14],
      [x + 1.09 * scale, 0.025, z + row * 0.26 + 0.03],
    ]);
    for (let i = 0; i < 2; i++) {
      patch(
        out,
        'mosaic',
        [rows[i][0], rows[i + 1][0], rows[i + 1][1], rows[i][1]],
        i ? stone : moss,
      );
      patch(
        out,
        'mosaic',
        [rows[i][1], rows[i + 1][1], rows[i + 1][2], rows[i][2]],
        i ? stone : moss,
      );
    }
  }
}

function birds(out, segments, passes) {
  // The hornbill figures cling to the front and hang head down from the rear.
  for (const [sign, y] of [
    [1, 7.5],
    [-1, 7.92],
  ]) {
    const offset = sign > 0 ? 0.88 : -0.63;
    const z = sign > 0 ? 1.04 : -2.02;
    const signY = sign;
    const bird = [
      [offset - 0.46, y - signY * 1.21, z - sign * 0.16, 0.074, 0.14],
      [offset - 0.13, y - signY * 0.42, z + sign * 0.17, 0.36, 0.31],
      [offset + 0.04, y + signY * 0.07, z + sign * 0.29, 0.43, 0.36],
      [offset + 0.21, y + signY * 0.43, z + sign * 0.38, 0.23, 0.22],
      [offset + 0.48, y + signY * 0.57, z + sign * 0.53, 0.23, 0.2],
      [offset + 0.9, y + signY * 0.44, z + sign * 0.7, 0.11, 0.1],
      [offset + 1.27, y + signY * 0.31, z + sign * 0.73, 0.027, 0.034],
    ];
    sweep(out, bird, segments, passes, fold, [0, 0, 1]);
  }
}

function pots(out, sides, count) {
  const vessels = [
    [-2.26, 3.4, 0.39, 0.63],
    [-1.41, 4.03, 0.33, 0.47],
    [-0.67, 3.83, 0.27, 0.37],
  ];
  for (const [x, z, radius, height] of vessels.slice(0, count)) {
    const shape = [
      [0, 0.57],
      [0.23, 0.9],
      [0.61, 1],
      [0.88, 0.73],
      [1, 0.81],
      [1, 0.66],
      [0.82, 0.56],
      [0.21, 0.39],
    ];
    const rings = shape.map(([y, r]) =>
      Array.from({ length: sides }, (_, i) => {
        const angle = (-fullTurn * i) / sides;
        return [
          x + Math.cos(angle) * radius * r,
          0.021 + height * y,
          z + Math.sin(angle) * radius * r,
        ];
      }),
    );
    loft(out, 'pots', rings, ochre);
  }
}

function build(out, settings) {
  const { bodySides, limbSides, passes, detail } = settings;
  court(out, detail > 1);
  body(out, bodySides, detail > 0);
  sweep(out, neck, limbSides, passes, fold, [0, 0, 1]);
  sweep(out, crown, limbSides, passes, stone);
  for (const [i, arm] of arms.entries())
    sweep(out, arm, limbSides, passes, scaleColor(fold, 1 - 0.07 * (i % 3)), [0, 1, 0]);
  for (const [i, ribbon] of loops.entries()) {
    if (detail === 0 && i >= 3) break;
    sweep(out, ribbon, limbSides, passes, i % 2 ? fold : ochre, [0, 0, 1]);
  }
  for (const [i, side] of outstretched.entries())
    sweep(out, side, limbSides, passes, i % 2 ? fold : moss, [0, 0, 1]);
  if (detail > 0) birds(out, limbSides, passes);
  if (detail > 0) wrapperWebs(out);
  pots(out, limbSides, detail === 0 ? 1 : 3);
  if (detail > 1) {
    sphere(out, 'cement', [-2.6, 1.24, 1.52], [0.79, 1.02, 0.44], ochre, 8, 5);
    sphere(out, 'cement', [1.29, 5.18, 1.13], [0.52, 0.77, 0.31], fold, 8, 5);
  }
}

export const buildSkyline = (out) =>
  build(out, { bodySides: 8, limbSides: 4, passes: 0, detail: 0 });
export const buildDistrict = (out) =>
  build(out, { bodySides: 12, limbSides: 6, passes: 0, detail: 1 });
export const buildStreet = (out) =>
  build(out, { bodySides: 20, limbSides: 8, passes: 1, detail: 2 });
export const buildCloseup = (out) =>
  build(out, { bodySides: 28, limbSides: 12, passes: 2, detail: 2 });
export const buildMaster = (out) =>
  build(out, { bodySides: 40, limbSides: 20, passes: 3, detail: 3 });

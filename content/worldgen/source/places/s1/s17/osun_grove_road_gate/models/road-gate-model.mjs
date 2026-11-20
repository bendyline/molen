import {
  beam,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  box,
  quad,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  render: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0 },
};

const clay = [0.68, 0.36, 0.235];
const relief = [0.74, 0.42, 0.29];
const castIron = [0.115, 0.107, 0.108];
const oxidized = [0.224, 0.185, 0.168];
const white = [0.84, 0.83, 0.77];
const blue = [0.158, 0.227, 0.44];
const ref = 'palette:#ffffff';
// +Z faces the town. The outline steps around all three openings.
const upperWallProfile = [
  [5.68, 2.86],
  [4.43, 3.39],
  [3.72, 3.58],
  [3.68, 4.23],
  [-3.66, 4.18],
  [-3.68, 3.77],
  [-4.19, 3.57],
  [-4.77, 2.85],
  [-5.87, 1.68],
  [-5.87, 1.58],
  [-4.62, 1.58],
  [-4.62, 2.1],
  [-3.7, 2.1],
  [-3.7, 1.58],
  [-3.23, 1.58],
  [-3.21, 3.23],
  [-3.12, 3.37],
  [-2.84, 3.48],
  [2.98, 3.48],
  [3.21, 3.36],
  [3.23, 1.58],
  [3.96, 1.58],
  [3.96, 2.14],
  [4.1, 2.3],
  [4.7, 2.3],
  [4.85, 2.16],
  [4.85, 1.58],
  [6.09, 1.58],
  [6.09, 2.86],
];
function triangle(out, slot, a, b, c, color) {
  out.addTriangle(slot, ref, [a, b, c], normalFor(a, b, c), null, color);
}

function plate(out, slot, outline, low, high, color, pose = (p) => p) {
  const indices = earcut(outline.flat());
  const p = ([x, y], z) => pose([x, y, z]);
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => outline[index]);
    triangle(out, slot, p(a, high), p(b, high), p(c, high), color);
    triangle(out, slot, p(c, low), p(b, low), p(a, low), color);
  }
  const signedArea = outline.reduce((sum, [x, y], i) => {
    const [nx, ny] = outline[(i + 1) % outline.length];
    return sum + x * ny - nx * y;
  }, 0);
  const path = signedArea > 0 ? outline : [...outline].reverse();
  for (let i = 0; i < path.length; i++) {
    const a = path[i],
      b = path[(i + 1) % path.length];
    const q = [p(a, low), p(b, low), p(b, high), p(a, high)];
    quad(out, slot, q, normalFor(...q), color);
  }
}
function wall(out) {
  // Splitting the silhouette into continuous profiles keeps the three openings clear at ground.
  plate(out, 'render', upperWallProfile, -0.3, 0.3, clay);
  for (const [a, b] of [
    [-5.87, -4.62],
    [-3.7, -3.23],
    [3.23, 3.96],
    [4.85, 6.09],
  ])
    box(out, 'render', [a, -0.6, -0.3], [b, 1.58, 0.3], clay);
}

// The figure is an open-mouthed silhouette with a forked tail and two lower fins.
const crestProfile = [
  [-2.11, 4.79],
  [-1.79, 4.9],
  [-1.43, 4.934],
  [-1.02, 5.015],
  [-0.55, 5.068],
  [-0.36, 5.18],
  [-0.13, 5.064],
  [0.29, 5.06],
  [0.78, 4.966],
  [1.39, 5.01],
  [2.05, 5.17],
  [1.79, 4.982],
  [1.38, 4.877],
  [1.96, 4.834],
  [2.06, 4.706],
  [1.52, 4.756],
  [1.04, 4.703],
  [0.75, 4.65],
  [0.82, 4.586],
  [0.39, 4.557],
  [0.06, 4.656],
  [-0.37, 4.631],
  [-0.75, 4.528],
  [-0.99, 4.534],
  [-1.06, 4.611],
  [-1.58, 4.606],
  [-1.93, 4.62],
  [-2.14, 4.712],
  [-1.79, 4.694],
  [-1.67, 4.742],
  [-1.78, 4.799],
];

function raisedLine(out, path, radius, color, detail, z = 0.31) {
  tubePath(
    out,
    'render',
    path.map(([x, y, d]) => [x, y, d ?? z]),
    radius,
    color,
    detail >= 3 ? 8 : 5,
  );
}

function crest(out, detail) {
  for (const x of [-1.32, -0.47, 0.55])
    box(out, 'iron', [x - 0.034, 4.2, -0.043], [x + 0.034, 4.63, 0.042], castIron);
  const crestMetal = [0.19, 0.235, 0.263];
  const seam = [0.138, 0.171, 0.19];
  plate(out, 'iron', crestProfile, -0.071, 0.09, crestMetal);
  if (detail < 1) return;
  sphere(out, 'iron', [-1.43, 4.833, 0.095], [0.085, 0.057, 0.035], seam, 9, 4);
  sphere(out, 'iron', [-1.43, 4.837, 0.125], [0.059, 0.047, 0.016], crestMetal, 8, 3);
  if (detail < 2) return;
  const trim = (path, r = 0.014) =>
    tubePath(
      out,
      'iron',
      path.map(([x, y]) => [x, y, 0.095]),
      r,
      seam,
      5,
    );
  trim(
    [
      [-1.24, 4.9],
      [-1.12, 4.87],
      [-1.06, 4.82],
      [-1.07, 4.76],
      [-1.16, 4.687],
    ],
    0.021,
  );
  trim([
    [1.02, 4.8],
    [1.37, 4.893],
    [1.69, 4.954],
  ]);
  trim([
    [0.92, 4.738],
    [1.35, 4.807],
    [1.82, 4.774],
  ]);
  const rows = detail >= 3 ? [4.759, 4.882, 4.933] : [4.785, 4.908];
  for (const [row, y] of rows.entries()) {
    for (let i = 0; i < 6; i++) {
      const x = -0.99 + i * 0.26 + 0.12 * (row % 2);
      const lift = 0.012 * Math.cos(i * 1.73 + row);
      trim(
        [
          [x, y + 0.053 + lift],
          [x + 0.092, y + 0.037 + lift],
          [x + 0.121, y - 0.013 + lift],
          [x + 0.07, y - 0.062 + lift],
        ],
        0.013,
      );
    }
  }
}

function wallReliefs(out, detail) {
  if (detail === 0) return;
  // The left figure follows the sloped wing; one reach runs along the lintel.
  for (const [radius, path] of [
    [
      0.155,
      [
        [-5.33, 1.57],
        [-4.81, 1.83],
        [-4.41, 2.12],
        [-4.48, 2.46],
        [-4.12, 2.86],
        [-3.83, 3.31],
        [-3.5, 3.57],
        [-2.96, 3.61],
        [-2.55, 3.64],
        [-2.15, 3.59],
        [-1.68, 3.64],
      ],
    ],
    [
      0.067,
      [
        [-5.33, 1.57],
        [-5.17, 1.4],
        [-5.1, 1.22],
      ],
    ],
    [
      0.084,
      [
        [-4.41, 2.16],
        [-3.99, 1.94],
        [-3.82, 1.56],
        [-3.7, 1.16],
      ],
    ],
    [
      0.079,
      [
        [-1.82, 3.79],
        [-2.18, 3.89],
        [-2.45, 4.0],
        [-2.96, 4.01],
        [-3.11, 4.1],
      ],
    ],
    [
      0.1,
      [
        [-1.52, 3.67],
        [-1.23, 3.57],
        [-0.93, 3.71],
        [-0.7, 4.01],
      ],
    ],
    [
      0.155,
      [
        [0.305, 3.71],
        [0.71, 3.74],
        [1.16, 3.85],
        [1.72, 3.96],
        [2.25, 3.97],
        [2.79, 4.04],
        [3.45, 4.04],
      ],
    ],
    [
      0.079,
      [
        [1.09, 3.68],
        [1.71, 3.61],
        [2.26, 3.66],
        [2.7, 3.57],
        [3.49, 3.6],
      ],
    ],
    [
      0.066,
      [
        [3.52, 4.07],
        [3.57, 3.94],
        [3.58, 3.73],
        [3.58, 3.54],
      ],
    ],
    [
      0.084,
      [
        [3.64, 3.55],
        [3.87, 3.06],
        [4.12, 3.02],
        [4.45, 3.18],
        [4.7, 3.35],
      ],
    ],
    [
      0.076,
      [
        [3.62, 3.48],
        [3.69, 2.92],
        [3.88, 2.65],
        [4.27, 2.72],
        [4.54, 2.93],
      ],
    ],
  ])
    raisedLine(out, path, radius, relief, detail);
  const sides = detail >= 3 ? 14 : 9;
  sphere(out, 'render', [-4.13, 2.6, 0.333], [0.245, 0.288, 0.18], relief, sides, 5);
  sphere(out, 'render', [-1.44, 3.845, 0.358], [0.25, 0.237, 0.18], relief, sides, 7);
  sphere(out, 'render', [0.125, 3.813, 0.36], [0.234, 0.254, 0.18], relief, sides, 7);
  if (detail < 2) return;
  for (const [x, y] of [
    [-1.44, 3.84],
    [0.125, 3.81],
  ]) {
    for (const offset of [-0.097, 0.089]) {
      sphere(out, 'render', [x + offset, y + 0.055, 0.506], [0.068, 0.052, 0.039], relief, 9, 4);
      sphere(out, 'render', [x + offset, y + 0.057, 0.539], [0.021, 0.023, 0.012], clay, 7, 3);
    }
    raisedLine(
      out,
      [
        [x - 0.015, y + 0.07, 0.498],
        [x + 0.018, y - 0.009, 0.551],
        [x - 0.035, y - 0.033, 0.528],
      ],
      0.038,
      relief,
      detail,
    );
    raisedLine(
      out,
      [
        [x - 0.12, y - 0.095, 0.472],
        [x - 0.047, y - 0.119, 0.512],
        [x + 0.033, y - 0.117, 0.513],
        [x + 0.095, y - 0.092, 0.481],
      ],
      0.024,
      relief,
      detail,
    );
    if (detail >= 3) {
      for (let k = 0; k < 9; k++) {
        const phi = (k / 8) * Math.PI;
        const hw = Math.cos(phi),
          hh = Math.sin(phi);
        raisedLine(
          out,
          [
            [x + 0.201 * hw, y + 0.178 * hh, 0.46],
            [x + 0.236 * hw, y + 0.209 * hh, 0.414],
          ],
          0.014,
          clay,
          detail,
        );
      }
    }
  }
}

const leafReliefs = {
  left: [
    {
      u: 0.53,
      head: [0.03, 2.23, 0.102],
      body: [
        [-0.15, 2.09],
        [0.14, 2.1],
        [0.17, 1.83],
        [0.08, 1.62],
        [-0.11, 1.59],
        [-0.195, 1.77],
      ],
      outline: [
        [-0.13, 1.91],
        [-0.25, 1.63],
        [-0.15, 1.49],
        [0.11, 1.57],
        [0.18, 1.82],
      ],
      stance: [
        [-0.05, 1.62],
        [-0.15, 1.32],
        [-0.07, 1.21],
      ],
    },
    {
      u: 1.36,
      head: [0.04, 2.4, 0.105],
      body: [
        [-0.12, 2.28],
        [0.11, 2.28],
        [0.195, 1.9],
        [0.17, 1.38],
        [-0.19, 1.4],
        [-0.16, 1.81],
      ],
      outline: [
        [-0.18, 1.73],
        [-0.28, 1.78],
        [-0.21, 2.04],
        [-0.06, 2.25],
        [0.12, 2.27],
      ],
      stance: [
        [-0.07, 1.38],
        [0.02, 1.19],
        [0.19, 1.18],
      ],
    },
    {
      u: 2.17,
      head: [-0.05, 2.02, 0.101],
      body: [
        [-0.16, 1.99],
        [0.02, 2.0],
        [0.19, 1.75],
        [0.17, 1.42],
        [-0.12, 1.4],
        [-0.18, 1.64],
      ],
      outline: [
        [-0.23, 1.95],
        [-0.13, 2.1],
        [0.035, 2.13],
        [0.11, 2.02],
      ],
      stance: [
        [0.08, 1.51],
        [0.2, 1.3],
        [0.22, 1.18],
        [0.09, 1.17],
      ],
    },
  ],
  right: [
    {
      u: 0.49,
      head: [0.015, 2.15, 0.101],
      body: [
        [-0.11, 2],
        [0.16, 2.03],
        [0.22, 1.85],
        [0.18, 1.58],
        [-0.08, 1.6],
        [-0.18, 1.79],
      ],
      outline: [
        [-0.19, 2.17],
        [-0.06, 2.26],
        [0.05, 2.27],
        [0.17, 2.17],
      ],
      stance: [
        [0.08, 1.59],
        [0.06, 1.36],
        [0.17, 1.24],
        [0.27, 1.23],
      ],
    },
    {
      u: 1.27,
      head: [-0.09, 2.12, 0.087],
      body: [
        [-0.21, 2.0],
        [-0.065, 2.02],
        [0.105, 1.8],
        [0.04, 1.55],
        [-0.16, 1.61],
        [-0.25, 1.84],
      ],
      outline: [
        [-0.2, 1.86],
        [-0.04, 1.95],
        [0.16, 2.12],
        [0.35, 2.38],
        [0.45, 2.49],
      ],
      stance: [
        [-0.12, 1.62],
        [-0.05, 1.45],
        [0.12, 1.33],
        [0.23, 1.17],
      ],
    },
    {
      u: 2.16,
      head: [0.04, 2.04, 0.12],
      body: [
        [-0.13, 1.93],
        [0.13, 1.94],
        [0.25, 1.79],
        [0.23, 1.55],
        [0.09, 1.26],
        [-0.19, 1.28],
        [-0.16, 1.58],
      ],
      outline: [
        [-0.225, 2.12],
        [-0.1, 2.12],
        [-0.048, 2.25],
        [0.05, 2.28],
        [0.14, 2.16],
        [0.24, 2.13],
      ],
      stance: [
        [0.075, 1.85],
        [-0.075, 1.64],
        [0.09, 1.39],
        [0.2, 1.29],
      ],
    },
  ],
};

function ironReliefs(out, pose, side, detail) {
  const face = -side;
  const material = [0.163, 0.156, 0.147];
  const rim = [0.202, 0.191, 0.18];
  for (const mark of leafReliefs[side < 0 ? 'left' : 'right']) {
    const point = ([u, y, z]) => pose([u + mark.u, y, z]);
    const place = ([u, y]) => point([u, y, face * 0.062]);
    plate(
      out,
      'iron',
      mark.body,
      Math.min(face * 0.04, face * 0.07),
      Math.max(face * 0.04, face * 0.07),
      material,
      point,
    );
    const [u, y, radius] = mark.head;
    sphere(
      out,
      'iron',
      point([u, y, face * 0.069]),
      [0.032, radius * 1.08, radius],
      material,
      9,
      5,
    );
    for (const feature of [mark.outline, mark.stance]) {
      tubePath(out, 'iron', feature.map(place), 0.022, rim, detail >= 3 ? 7 : 5);
    }
    if (detail >= 3) {
      const [left, right] = [mark.body[0], mark.body[1]];
      const bottom = mark.body.at(-2);
      for (const t of [0.25, 0.52, 0.78]) {
        const top = [left[0] + t * (right[0] - left[0]), (left[1] + right[1]) * 0.5 - 0.042];
        const fold = [t * 0.19 - 0.1, bottom[1] + 0.165];
        const middle = [top[0] * 0.55 + fold[0] * 0.45, (top[1] + fold[1]) * 0.53];
        tubePath(out, 'iron', [top, middle, fold].map(place), 0.012, rim, 5);
      }
    }
  }
}

function leaf(out, side, detail) {
  // Leaves are shown latched back. The open roadway stays centered between them.
  const pose = ([u, y, v]) => [
    side * (3.2 - 0.15 * u) + v * 0.989,
    y,
    -0.989 * u - side * 0.15 * v,
  ];
  const shape = [
    [0, 0.86],
    [2.65, 0.86],
    [2.65, 2.6],
    [2.43, 2.6],
    [2.31, 2.7],
    [2.15, 2.73],
    [1.91, 2.59],
    [1.6, 2.59],
    [1.4, 2.79],
    [1.21, 2.76],
    [1.08, 2.61],
    [0.73, 2.59],
    [0.56, 2.72],
    [0.38, 2.74],
    [0.2, 2.6],
    [0, 2.6],
  ];
  plate(out, 'iron', shape, -0.038, 0.038, castIron, pose);
  const count = [6, 10, 14, 17, 20][detail];
  for (let i = 0; i < count; i++) {
    const u = 0.048 + (2.545 * i) / (count - 1);
    beam(out, 'iron', pose([u, 0.045, 0]), pose([u, 0.94, 0]), 0.038, 0.053, castIron);
  }
  beam(out, 'iron', pose([0, 0.105, 0]), pose([2.65, 0.105, 0]), 0.057, 0.06, castIron);
  if (detail >= 2) ironReliefs(out, pose, side, detail);
}

function sidePortal(out, detail) {
  for (let i = 0; i < (detail < 2 ? 4 : 7); i++) {
    const x = 4.05 + i * (detail < 2 ? 0.23 : 0.117);
    beam(out, 'iron', [x, 0.06, 0.07], [x, 2.14, 0.07], 0.036, 0.043, castIron);
  }
  for (const span of [
    [0.16, 1.99],
    [1.99, 0.16],
  ]) {
    beam(out, 'iron', [4.021, span[0], 0.075], [4.809, span[1], 0.075], 0.037, 0.052, castIron);
  }
  const roof = [
    [4.58, 2.88, 0.96],
    [6.28, 2.59, 0.96],
    [6.28, 2.59, -1.36],
    [4.58, 2.88, -1.36],
  ];
  for (const face of [roof, [...roof].reverse().map(([x, y, z]) => [x, y - 0.047, z])])
    quad(out, 'iron', face, normalFor(...face), [0.275, 0.233, 0.231]);
  if (detail >= 2)
    for (let k = 0; k < 16; k++) {
      const z = -1.35 + k * 0.151;
      beam(out, 'iron', [4.58, 2.9, z], [6.28, 2.61, z], 0.041, 0.044, oxidized);
    }
}

function signs(out, detail) {
  if (detail === 0) return;
  const ring = (x, y, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return [x + r * Math.cos(a), y + r * Math.sin(a)];
    });
  const sides = detail >= 3 ? 24 : 14;
  plate(out, 'iron', ring(5.54, 1.43, 0.37, sides), 0.309, 0.332, white);
  plate(out, 'iron', ring(5.54, 1.43, 0.329, sides), 0.333, 0.346, blue);
  plate(out, 'iron', ring(5.54, 1.43, 0.258, sides), 0.347, 0.356, white);
  plate(
    out,
    'iron',
    [
      [5.54, 1.664],
      [5.768, 1.438],
      [5.54, 1.198],
      [5.309, 1.438],
    ],
    0.357,
    0.368,
    blue,
  );
  plate(
    out,
    'iron',
    [
      [5.54, 1.608],
      [5.715, 1.438],
      [5.54, 1.27],
      [5.37, 1.438],
    ],
    0.369,
    0.377,
    white,
  );
  const temple = [
    [-5.65, 0.405],
    [-4.87, 0.405],
    [-4.87, 0.92],
    [-5.259, 1.092],
    [-5.65, 0.92],
  ];
  plate(out, 'iron', temple, 0.306, 0.34, blue);
  beam(out, 'iron', [-5.594, 0.5, 0.344], [-4.929, 0.5, 0.344], 0.024, 0.023, white);
  beam(out, 'iron', [-5.586, 0.898, 0.344], [-5.26, 1.04, 0.344], 0.029, 0.022, white);
  beam(out, 'iron', [-5.26, 1.04, 0.344], [-4.938, 0.899, 0.344], 0.029, 0.022, white);
  if (detail < 2) return;
  for (let i = 0; i < 6; i++) {
    const x = -5.548 + 0.114 * i;
    beam(out, 'iron', [x, 0.53, 0.349], [x, 0.83, 0.349], 0.022, 0.027, white);
  }
}

function build(out, detail) {
  wall(out);
  crest(out, detail);
  wallReliefs(out, detail);
  for (const side of [-1, 1]) leaf(out, side, detail);
  sidePortal(out, detail);
  signs(out, detail);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);

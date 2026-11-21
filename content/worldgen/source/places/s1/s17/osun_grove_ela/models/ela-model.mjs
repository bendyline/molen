import {
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92 },
  footing: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98 },
};

const wornCement = [0.54, 0.447, 0.318];
const litCement = [0.636, 0.526, 0.365];
const darkCement = [0.376, 0.326, 0.245];

// Each section carries a center, the visible half width, and the estimated half depth.
const torso = [
  [-0.115, 3.21, -0.055, 0.224, 0.157],
  [-0.105, 3.48, -0.067, 0.188, 0.131],
  [-0.048, 3.94, -0.08, 0.132, 0.142],
  [0.027, 4.47, -0.059, 0.121, 0.117],
  [0.056, 4.94, -0.025, 0.142, 0.127],
  [0.043, 5.27, 0.026, 0.216, 0.157],
  [0.038, 5.57, 0.006, 0.27, 0.15],
  [0.024, 5.72, -0.034, 0.167, 0.133],
  [0.016, 5.81, -0.049, 0.113, 0.098],
];

const arms = [
  [
    [-0.135, 5.39, 0.04, 0.157, 0.154],
    [-0.294, 5.68, 0.012, 0.156, 0.132],
    [-0.493, 5.99, -0.008, 0.119, 0.112],
    [-0.683, 6.35, 0.035, 0.081, 0.091],
    [-0.727, 6.6, 0.092, 0.084, 0.082],
    [-0.554, 6.99, 0.093, 0.056, 0.076],
    [-0.392, 7.39, 0.136, 0.044, 0.059],
    [-0.251, 7.81, 0.151, 0.026, 0.042],
    [-0.163, 8.08, 0.175, 0.024, 0.029],
    [-0.207, 8.25, 0.173, 0.017, 0.017],
    [-0.235, 8.39, 0.168, 0.008, 0.009],
  ],
  [
    [0.211, 5.42, 0.015, 0.141, 0.153],
    [0.348, 5.65, -0.028, 0.151, 0.134],
    [0.542, 5.91, -0.061, 0.108, 0.118],
    [0.689, 6.29, -0.068, 0.083, 0.09],
    [0.748, 6.45, -0.041, 0.094, 0.093],
    [0.68, 6.69, -0.004, 0.072, 0.081],
    [0.561, 7.14, 0.015, 0.05, 0.061],
    [0.48, 7.54, 0.048, 0.034, 0.044],
    [0.438, 7.86, 0.071, 0.022, 0.031],
    [0.463, 7.98, 0.075, 0.015, 0.023],
    [0.447, 8.114, 0.086, 0.008, 0.01],
  ],
];

const neck = [
  [0.027, 5.55, -0.066, 0.136, 0.123],
  [0.019, 5.91, -0.082, 0.112, 0.095],
  [0.021, 6.26, -0.065, 0.102, 0.094],
  [0.019, 6.61, -0.037, 0.103, 0.104],
  [0.035, 6.82, -0.023, 0.136, 0.129],
];

const base = [
  [-0.216, 0.11, -0.125, 0.302, 0.237],
  [-0.196, 0.41, -0.11, 0.324, 0.228],
  [-0.167, 0.88, -0.098, 0.282, 0.184],
  [-0.136, 1.28, -0.085, 0.241, 0.165],
  [-0.139, 1.72, -0.045, 0.216, 0.173],
  [-0.126, 2.024, -0.033, 0.183, 0.154],
];

function sweep(out, sides, sections, tint, square = false) {
  const rings = sections.map(([x, y, z, width, depth], i) => {
    const next = sections[Math.min(i + 1, sections.length - 1)];
    const previous = sections[Math.max(i - 1, 0)];
    const tangent = normalize(next.slice(0, 3).map((value, axis) => value - previous[axis]));
    const across = normalize(cross(tangent, [0, 0, 1]));
    const back = cross(tangent, across);
    return Array.from({ length: sides }, (_, k) => {
      const angle = (2 * Math.PI * k) / sides;
      const uneven = 1 + 0.09 * Math.cos(3 * angle + i * 0.48) + 0.045 * Math.sin(5 * angle - i);
      const u = Math.cos(angle) * width * uneven;
      const v = Math.sin(angle) * depth * (square ? 0.9 + 0.12 * Math.cos(4 * angle) : 1) * uneven;
      return [x, y, z].map((value, axis) => value + across[axis] * u + back[axis] * v);
    });
  });
  // Sharp bends twist the sections. Compute each triangle normal independently.
  const triangle = (a, b, c) =>
    out.addTriangle('concrete', 'palette:#ffffff', [a, b, c], normalFor(a, b, c), null, tint);
  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    triangle(sections[0].slice(0, 3), rings[0][next], rings[0][i]);
    triangle(sections.at(-1).slice(0, 3), rings.at(-1)[i], rings.at(-1)[next]);
    for (let j = 1; j < rings.length; j++) {
      const a = rings[j - 1][i];
      const b = rings[j - 1][next];
      const c = rings[j][next];
      const d = rings[j][i];
      triangle(a, b, c);
      triangle(a, c, d);
    }
  }
}

function legs(out, sides) {
  sweep(out, sides, base, wornCement, true);
  for (const sign of [-1, 1]) {
    const x = -0.126 + 0.118 * sign;
    sweep(
      out,
      sides,
      [
        [x - 0.038, 1.87, -0.047, 0.112, 0.133],
        [x - 0.046, 2.13, -0.016, 0.104, 0.143],
        [x - 0.025, 2.57, -0.06, 0.075, 0.117],
        [x + 0.01, 3.035, -0.065, 0.074, 0.11],
        [x + 0.018, 3.27, -0.061, 0.111, 0.145],
      ],
      wornCement,
      true,
    );
    // The two low feet cant forward and end separately above the paving.
    const heel = -0.2 + 0.173 * sign;
    sweep(
      out,
      sides,
      [
        [heel - 0.033, 0.389, -0.117, 0.139, 0.12],
        [heel + 0.046, 0.291, 0.017, 0.114, 0.105],
        [heel + 0.149, 0.136, 0.234, 0.112, 0.068],
        [heel + 0.188, 0.102 + (sign > 0 ? 0.018 : 0), 0.393, 0.103, 0.045],
        [heel + 0.196, 0.114, 0.442 + (sign < 0 ? 0.044 : 0), 0.058, 0.033],
      ],
      darkCement,
      true,
    );
  }
}

function head(out, sides) {
  sweep(out, sides, neck, wornCement);
  // The drooping left shoulder of the hood and its raised right lip read in profile.
  sweep(
    out,
    sides,
    [
      [-0.291, 6.41, 0.029, 0.053, 0.089],
      [-0.292, 6.53, 0.035, 0.163, 0.191],
      [-0.229, 6.68, 0.017, 0.214, 0.223],
      [-0.116, 6.85, -0.002, 0.319, 0.215],
      [-0.019, 6.965, -0.01, 0.324, 0.201],
      [0.019, 7.023, -0.009, 0.269, 0.176],
    ],
    darkCement,
    true,
  );
  sweep(
    out,
    sides,
    [
      [-0.129, 6.955, -0.046, 0.302, 0.188],
      [0.138, 7.034, -0.003, 0.13, 0.184],
      [0.295, 7.055, 0.033, 0.048, 0.102],
      [0.389, 7.009, 0.071, 0.033, 0.042],
    ],
    wornCement,
  );
  sweep(
    out,
    sides,
    [
      [-0.165, 6.994, -0.081, 0.188, 0.152],
      [-0.172, 7.101, -0.071, 0.154, 0.153],
      [-0.175, 7.219, -0.067, 0.096, 0.109],
      [-0.204, 7.249, -0.069, 0.028, 0.037],
    ],
    darkCement,
  );
}

function carvedChest(out, sides, detail) {
  for (const [x, y, radius] of [
    [-0.13, 5.555, 0.094],
    [0.167, 5.57, 0.1],
  ]) {
    const rim = Array.from({ length: 13 }, (_, i) => {
      const angle = (2 * Math.PI * i) / 12;
      return [
        x + radius * Math.cos(angle),
        y + radius * Math.sin(angle),
        0.153 + 0.017 * Math.sin(angle),
        0.016,
        0.014,
      ];
    });
    sweep(out, sides, rim.slice(0, -1), darkCement);
    sweep(
      out,
      sides,
      [
        [x - radius * 0.25, y - radius * 0.29, 0.154, 0.044, 0.025],
        [x - 0.005, y + radius * 0.23, 0.19, 0.04, 0.03],
        [x + radius * 0.18, y + radius * 0.54, 0.163, 0.012, 0.018],
      ],
      litCement,
    );
  }
  const folds = [
    [
      [-0.153, 5.239, 0.103],
      [-0.075, 5.35, 0.189],
      [0.061, 5.408, 0.199],
      [0.18, 5.351, 0.116],
    ],
    [
      [-0.098, 4.55, 0.012],
      [-0.019, 4.714, 0.086],
      [0.115, 4.831, 0.095],
    ],
    [
      [-0.08, 4.878, 0.062],
      [-0.042, 5.017, 0.101],
      [0.081, 5.117, 0.134],
    ],
  ];
  for (const fold of folds)
    sweep(
      out,
      sides,
      fold.map((p, i) => [...p, i === 0 ? 0.013 : 0.024, 0.021]),
      litCement,
    );
  if (detail < 3) return;
  for (const [x, y] of [
    [-0.064, 3.79],
    [0.037, 4.32],
    [0.095, 4.66],
  ]) {
    sweep(
      out,
      sides,
      [
        [x - 0.025, y - 0.095, 0.034, 0.008, 0.006],
        [x, y, 0.065, 0.014, 0.011],
        [x + 0.026, y + 0.071, 0.082, 0.009, 0.008],
      ],
      darkCement,
    );
  }
}

function build(out, detail) {
  const sides = [5, 8, 11, 15, 20][detail];
  legs(out, sides);
  sweep(out, sides, torso, wornCement, true);
  head(out, sides);
  for (const arm of arms) sweep(out, sides, arm, wornCement, true);
  sweep(
    out,
    sides,
    [
      [-0.159, 8.084, 0.174, 0.021, 0.025],
      [-0.094, 8.112, 0.186, 0.015, 0.016],
      [-0.085, 8.136, 0.191, 0.009, 0.009],
    ],
    darkCement,
  );
  sweep(
    out,
    sides,
    [
      [0.438, 7.854, 0.07, 0.022, 0.026],
      [0.386, 7.973, 0.079, 0.012, 0.014],
      [0.397, 8.03, 0.086, 0.008, 0.009],
    ],
    wornCement,
  );
  if (detail >= 1) carvedChest(out, Math.min(sides, 9), detail);
  const rock = [
    [-0.62, -0.25],
    [-0.38, -0.55],
    [0.12, -0.56],
    [0.46, -0.31],
    [0.48, 0.12],
    [0.18, 0.31],
    [-0.43, 0.28],
  ];
  const bed = [-0.14, 0.053, 0.12].map((height, i) =>
    rock
      .map(([x, z], j) => [
        x * (1 - i * 0.11),
        height + (i === 0 ? 0 : (j % 3) * 0.013),
        z * (1 - i * 0.12),
      ])
      .reverse(),
  );
  loft(out, 'footing', bed, [0.446, 0.386, 0.281]);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);

import {
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

const rose = rgb('aa7060');
const red = rgb('935d50');
const dark = rgb('574b43');
const moss = rgb('74665a');
const hair = rgb('605852');
const angle = (site.planAngleDegrees * Math.PI) / 180;
const c = Math.cos(angle),
  s = Math.sin(angle);
const world = ([x, y, z]) => [c * x - s * z, y, s * x + c * z];
const foot = site.statueFootHeight;
const segmentCount = [8, 12, 20, 32];

function shape(out, profiles, detail, tint = rose) {
  const step = detail === 0 ? 2 : 1;
  const rings = profiles
    .filter((_, i) => i % step === 0 || i === profiles.length - 1)
    .map(([y, x, z, width, depth]) =>
      radialRing(foot + y, depth, width, segmentCount[detail], [x, z]).map(world),
    );
  loft(out, 'statue', rings, tint);
}

function carvedLine(out, points, width, tint, depth = 0.085) {
  beamPath(
    out,
    'statue',
    points.map(([x, y, z]) => world([x, foot + y, z])),
    width,
    depth,
    tint,
  );
}

function robe(out, detail) {
  shape(
    out,
    [
      [0.03, -11.25, 0, 10.15, 6.72],
      [9, -9.4, 0, 12.4, 7.85],
      [20, -8.0, 0, 12.6, 10.9],
      [28, -6.3, 0, 14.7, 13.4],
      [35, -4.2, 0, 14.2, 12.8],
      [42, -2.8, 0, 13.8, 12.2],
      [48, -1.7, 0, 13.4, 11.2],
      [53, -0.7, 0, 11.2, 9.6],
      [55.4, -0.3, 0, 6.0, 7.0],
    ],
    detail,
    moss,
  );
  // The front folds run down toward the seat and merge into the carved knees.
  if (detail < 2) return;
  for (const side of [-1, 1]) {
    carvedLine(
      out,
      [
        [-10.5, 51.1, side * 5.0],
        [-12.3, 45.6, side * 4.9],
        [-13.49, 41, side * 5.2],
        [-15.07, 36.8, side * 6.1],
        [-17.35, 32.4, side * 7.0],
        [-19.0, 29.0, side * 7.3],
      ],
      0.19,
      red,
      0.27,
    );
    carvedLine(
      out,
      [
        [-9.17, 50.4, side * 8.2],
        [-10.23, 46.6, side * 9.15],
        [-12.28, 41, side * 9.45],
        [-13.4, 36.5, side * 9.4],
        [-16.51, 30.7, side * 9.58],
      ],
      0.2,
      dark,
      0.21,
    );
  }
}

function lowerBody(out, detail) {
  for (const side of [-1, 1]) {
    const z = side * 9.18;
    // The feet sit on shallow carved pads that meet the visitor terrace.
    shape(
      out,
      [
        [site.platformElevation - foot, -24.91, z, 5.71, 6.97],
        [0.09, -24.91, z, 5.55, 6.8],
      ],
      detail,
      red,
    );
    shape(
      out,
      [
        [0.0, -24.9, z, 5.5, 6.71],
        [0.9, -25.03, z, 5.65, 6.8],
        [2.9, -24.89, z, 5.4, 6.44],
        [5.3, -24.08, z, 4.83, 5.58],
        [7.5, -21.87, z, 4.05, 4.31],
        [8.6, -20.2, z, 3.83, 3.95],
      ],
      detail,
    );
    shape(
      out,
      [
        [4, -19.35, z, 4.85, 5.42],
        [9.5, -20.1, z, 4.3, 4.36],
        [16.6, -20.15, z, 4.22, 4.55],
        [23.4, -19.9, z, 4.63, 5.61],
        [29.0, -19.05, z, 5.12, 6.26],
        [34.4, -18.47, z, 5.48, 6.58],
        [37.6, -16.86, z, 4.98, 6.18],
        [38.6, -15.16, z, 3.63, 4.34],
      ],
      detail,
      red,
    );
    // The thighs turn back from the knee to the seat in the cliff.
    shape(
      out,
      [
        [25.4, -14.23, z, 4.4, 7.78],
        [28.8, -12.9, z, 5.4, 11.2],
        [32.75, -11.2, z, 5.62, 13.16],
        [35.74, -10.7, z, 4.96, 12.45],
        [38.34, -9.2, z, 3.78, 10.3],
      ],
      detail,
      moss,
    );
    shape(
      out,
      [
        [31.9, -23.4, side * 10.05, 3.72, 2.56],
        [34.45, -23.21, side * 10.0, 4.13, 3.3],
        [38.9, -20.74, side * 10.41, 4.57, 3.86],
        [44.2, -15.76, side * 10.94, 4.34, 4.68],
        [50.05, -10.15, side * 11.1, 3.85, 4.89],
        [53.3, -6.34, side * 10.12, 3.71, 5.97],
        [54.8, -3.61, side * 8.72, 3.16, 5.98],
      ],
      detail,
      moss,
    );
    if (detail < 2) continue;
    for (let i = 0; i < 5; i++) {
      const size = 1.24 - i * 0.112,
        q = z + side * (i - 2) * 1.55;
      sphere(
        out,
        'statue',
        world([-30.0 + i * 0.37, foot + 2.25 - i * 0.07, q]),
        [size, 1.08 - i * 0.07, size * 0.68],
        rose,
        detail === 2 ? 8 : 12,
        5,
      );
      const y = 33.84 - i * 0.47;
      shape(
        out,
        [
          [y - 3.1, -25.26, side * 10.05 + (i - 2) * 1.39, 0.3, 0.4],
          [y - 2.48, -25.4, side * 10.05 + (i - 2) * 1.39, 0.66, 0.52],
          [y, -25.7, side * 10.05 + (i - 2) * 1.39, 0.75, 0.6],
          [y + 2.31, -24.12, side * 10.05 + (i - 2) * 1.39, 0.73, 0.89],
        ],
        1,
        rose,
      );
    }
  }
}

function head(out, detail) {
  shape(
    out,
    [
      [53.7, -0.26, 0, 4.72, 5.14],
      [56.7, -0.49, 0, 4.24, 4.7],
      [58.5, -0.91, 0, 4.33, 4.78],
      [60.2, -1.2, 0, 4.66, 4.94],
      [63.31, -1.58, 0, 5.18, 5.1],
      [66.43, -1.34, 0, 5.21, 5.09],
      [68.18, -1.14, 0, 4.96, 4.88],
    ],
    detail,
  );
  shape(
    out,
    [
      [67.12, -1.14, 0, 5.12, 4.73],
      [68.04, -1.11, 0, 4.97, 4.73],
      [69.71, -0.76, 0, 3.94, 3.82],
      [70.64, -0.48, 0, 2.1, 2.5],
      [71.0, -0.42, 0, 0.11, 0.11],
    ],
    detail,
    hair,
  );
  for (const side of [-1, 1])
    shape(
      out,
      [
        [58.35, -0.45, side * 5.1, 0.21, 0.61],
        [59.4, -0.84, side * 5.13, 0.74, 1.21],
        [62.28, -0.72, side * 5.34, 0.81, 1.45],
        [65.42, -0.43, side * 5.31, 0.74, 1.51],
        [66.64, -0.42, side * 4.93, 0.25, 0.89],
      ],
      detail,
      rose,
    );
  const nose = [
    [-6.3, 65.18, -0.38],
    [-6.3, 65.18, 0.38],
    [-6.1, 62.2, 0.94],
    [-8.17, 62.74, 0],
    [-6.1, 62.2, -0.94],
  ].map(([x, y, z]) => world([x, foot + y, z]));
  for (const indices of [
    [0, 3, 4],
    [1, 2, 3],
    [0, 1, 3],
    [2, 4, 3],
  ]) {
    const [a, b, c] = indices.map((i) => nose[i]);
    out.addTriangle(
      'statue',
      '',
      [a, b, c],
      normalFor(a, b, c),
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      rose,
    );
  }
  if (detail === 0) return;
  for (const side of [-1, 1]) {
    carvedLine(
      out,
      [
        [-6.34, 64.61, side * 0.92],
        [-6.24, 64.87, side * 1.7],
        [-5.94, 64.83, side * 2.61],
        [-5.37, 64.51, side * 3.68],
      ],
      detail === 1 ? 0.22 : 0.15,
      dark,
      0.12,
    );
    carvedLine(
      out,
      [
        [-6.27, 65.63, side * 0.92],
        [-6.12, 65.98, side * 1.83],
        [-5.79, 65.94, side * 2.81],
        [-5.22, 65.52, side * 3.78],
      ],
      0.2,
      red,
      0.14,
    );
  }
  carvedLine(
    out,
    [
      [-5.97, 60.47, -1.76],
      [-6.21, 60.35, -0.79],
      [-6.25, 60.42, 0],
      [-6.21, 60.35, 0.79],
      [-5.97, 60.47, 1.76],
    ],
    0.17,
    dark,
    0.11,
  );
  if (detail < 2) return;
  const rows = detail === 3 ? 4 : 3;
  for (let j = 0; j < rows; j++) {
    const y = 67.48 + j * 0.61,
      r = 5.03 - j * 0.49,
      n = detail === 3 ? 27 : 16;
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5 * (j % 2)) * Math.PI * 2) / n;
      const size = 0.3 - j * 0.026;
      sphere(
        out,
        'statue',
        world([-1.02 + r * 0.953 * Math.cos(a), foot + y, r * Math.sin(a)]),
        [size, size * 0.71, size],
        hair,
        6,
        4,
      );
    }
  }
}

export function buildStatue(out, detail) {
  robe(out, detail);
  lowerBody(out, detail);
  head(out, detail);
}

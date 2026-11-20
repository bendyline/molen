import {
  beam,
  beamPath,
  loft,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain' },
  floor: { slot: 'foundation', graph: 'stone_sandstone_raw' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  roof: { slot: 'roof', graph: 'metal_corrugated' },
};

const concrete = [0.49, 0.286, 0.226];
const exposed = [0.57, 0.394, 0.316];
const coping = [0.46, 0.299, 0.246];
const rampPaving = [0.47, 0.424, 0.353];
const roof = [0.203, 0.172, 0.155];
const timber = [0.251, 0.177, 0.133];
const clay = [0.47, 0.252, 0.194];
const clayLight = [0.55, 0.342, 0.272];
const earthStain = [0.397, 0.287, 0.229];
const stageHeight = 0.72;

function ring(x0, x1, z0, z1, back, front) {
  return [
    [x0, back, z0],
    [x0, front, z1],
    [x1, front, z1],
    [x1, back, z0],
  ];
}

function stage(out, detail) {
  box(out, 'concrete', [-6.77, -0.29, -2.98], [6.74, stageHeight - 0.08, 3.2], concrete);
  box(out, 'floor', [-6.8, stageHeight - 0.08, -3.01], [6.77, stageHeight, 3.23], exposed);
  loft(
    out,
    'concrete',
    [
      ring(1.08, 3.19, 3.23, 7.49, -0.18, -0.18),
      ring(1.08, 3.19, 3.23, 7.49, stageHeight - 0.026, 0.019),
    ],
    concrete,
  );
  loft(
    out,
    'floor',
    [
      ring(1.077, 3.193, 3.23, 7.49, stageHeight - 0.026, 0.019),
      ring(1.077, 3.193, 3.23, 7.49, stageHeight, 0.045),
    ],
    rampPaving,
  );
  if (detail < 2) return;
  for (const [i, x] of [-5.5, -4.86, -2.55, 0.28, 3.71, 4.53, 5.67].entries()) {
    const y = 0.07 + 0.083 * (i % 4);
    box(out, 'concrete', [x - 0.17, y, 3.2], [x + 0.33, y + 0.035, 3.218], earthStain);
  }
}

function seating(out, detail) {
  const rows = detail === 0 ? 3 : 6;
  // Leave the passage beneath the rear bank open at both ends.
  for (const [x0, x1] of [
    [-7.12, 0.58],
    [1.92, 7.12],
  ]) {
    for (let i = 0; i < rows; i++) {
      const z = -3.41 - (4.37 * i) / rows;
      const rise = stageHeight + (1.14 * (i + 1)) / rows;
      const tint = i % 3 === 1 ? exposed : concrete;
      box(out, 'concrete', [x0, -0.25, z - 4.37 / rows], [x1, rise, z], tint);
      if (detail >= 2)
        box(out, 'floor', [x0, rise - 0.055, z - 0.07], [x1, rise + 0.004, z + 0.024], coping);
    }
    box(out, 'concrete', [x0, 1.85, -7.81], [x1, 2.17, -7.59], concrete);
  }
  for (const [x0, x1] of [
    [0.43, 0.58],
    [1.92, 2.07],
  ])
    box(out, 'concrete', [x0, -0.18, -7.78], [x1, 2.65, -3.41], concrete);
  box(out, 'concrete', [0.58, 2.51, -7.78], [1.92, 2.69, -3.41], concrete);
  const sideRows = detail === 0 ? 2 : 4;
  for (const [sign, z0, z1, orient] of [
    [-1, -5.46, 2.62, 0.75],
    [1, -6.77, 3.49, 1],
  ]) {
    for (let i = 0; i < sideRows; i++) {
      const x = 7.12 + (2.68 * i) / sideRows;
      const width = 2.68 / sideRows;
      const rise = stageHeight + (0.94 * orient * (i + 1)) / sideRows;
      const [x0, x1] = sign < 0 ? [-x - width, -x] : [x, x + width];
      const tint = i % 2 ? exposed : concrete;
      if (sign > 0 && i < sideRows / 2) {
        box(out, 'concrete', [x0, -0.22, z0], [x1, rise, 2.63], tint);
        box(out, 'concrete', [x0, 0.51, 2.63], [x1, rise, z1], tint);
        box(out, 'concrete', [x0, -0.22, 2.63], [x0 + 0.095, 0.51, z1], tint);
      } else {
        box(out, 'concrete', [x0, -0.22, z0], [x1, rise, z1], tint);
      }
      if (detail >= 2) {
        const edge = sign < 0 ? x1 : x0;
        box(out, 'floor', [edge - 0.04, rise - 0.047, z0], [edge + 0.04, rise + 0.004, z1], coping);
      }
    }
  }
  for (const [x, z] of [
    [-5.62, -3.4],
    [3.17, -3.4],
    [-6.69, 1.74],
    [6.41, 2.16],
  ])
    for (let i = 0; i < 3; i++) {
      const tread = stageHeight - 0.115 * (i + 1);
      box(
        out,
        'floor',
        [x - 0.51, -0.17, z + i * 0.26],
        [x + 0.51, tread, z + (i + 1) * 0.26],
        coping,
      );
    }
}

function canopy(out, detail) {
  // The west roof steps down. The taller east run extends along the stage.
  for (const [x0, x1, z0, z1, back, front] of [
    [-7.54, 7.48, -8.21, -2.98, 3.48, 3.4],
    [-10.21, -7.54, -7.18, 3.12, 3.32, 3.23],
    [7.48, 10.34, -8.21, 3.95, 3.49, 3.79],
  ]) {
    const bottom = ring(x0, x1, z0, z1, back - 0.185, front - 0.185);
    loft(out, 'roof', [bottom, ring(x0, x1, z0, z1, back, front)], roof);
    beam(out, 'timber', [x0, front - 0.144, z1], [x1, front - 0.144, z1], 0.14, 0.23, timber);
    for (const x of [x0 + 0.045, x1 - 0.045])
      beam(out, 'timber', [x, back - 0.135, z0], [x, front - 0.135, z1], 0.135, 0.2, timber);
  }
  for (const [x, z, top] of [
    [-6.85, -3.31, 3.27],
    [-3.53, -3.31, 3.27],
    [0.28, -3.31, 3.27],
    [2.15, -3.31, 3.27],
    [5.45, -3.31, 3.27],
    [-7.87, 2.54, 3.12],
    [-9.78, 2.54, 3.12],
    [-9.73, -4.2, 3.19],
    [-7.92, -4.2, 3.19],
    [7.89, 3.5, 3.64],
    [10.03, 3.52, 3.64],
    [7.94, -1.8, 3.51],
    [10.05, -1.78, 3.51],
    [-6.87, -7.76, 3.34],
    [6.86, -7.76, 3.34],
    [9.91, -7.72, 3.34],
  ]) {
    const base = z < -6.87 ? 1.72 : stageHeight;
    const w = Math.abs(x) > 7.5 ? 0.155 : 0.11;
    box(out, 'concrete', [x - w, base - 0.08, z - w], [x + w, top, z + w], concrete);
    if (detail > 0) {
      box(
        out,
        'floor',
        [x - w - 0.055, base - 0.07, z - w - 0.055],
        [x + w + 0.055, base + 0.11, z + w + 0.055],
        coping,
      );
      box(
        out,
        'timber',
        [x - w - 0.045, top - 0.13, z - w - 0.038],
        [x + w + 0.045, top, z + w + 0.038],
        timber,
      );
    }
  }
  for (const [x, z, y] of [
    [-3.31, -3.01, 3.37],
    [1.33, -3.01, 3.37],
    [-8.07, 2.61, 3.22],
    [7.45, -1.35, 3.58],
  ]) {
    loft(
      out,
      'timber',
      [
        ring(x - 0.14, x + 0.14, z - 0.14, z + 0.14, y - 0.18, y - 0.18),
        ring(x - 0.42, x + 0.42, z - 0.25, z + 0.25, y + 0.08, y + 0.08),
        ring(x - 0.026, x + 0.026, z - 0.054, z + 0.015, y + 0.37, y + 0.37),
      ],
      timber,
    );
  }
}

function raisedClayBand(out, points, z, sides) {
  const rings = points.map(([x, y, width], index) => {
    const [ax, ay] = points[Math.max(index - 1, 0)];
    const [bx, by] = points[Math.min(index + 1, points.length - 1)];
    const length = Math.hypot(bx - ax, by - ay);
    return Array.from({ length: sides }, (_, side) => {
      const angle = (2 * Math.PI * side) / sides;
      const span = Math.cos(angle) * width;
      return [
        x - ((by - ay) / length) * span,
        y + ((bx - ax) / length) * span,
        z + 0.025 + Math.sin(angle) * (0.025 + width * 0.4),
      ];
    });
  });
  loft(out, 'concrete', rings, clayLight);
}

function westRelief(out, detail) {
  // The 2022 portrait shows this taller panel almost touching the stage corner.
  const z = 3.04;
  box(out, 'concrete', [-9.25, -0.16, z - 0.22], [-7.3, 0.54, z], clay);
  loft(
    out,
    'concrete',
    [ring(-9.25, -7.3, z - 0.22, z, 0.54, 0.54), ring(-9.23, -7.31, z - 0.2, z, 1.31, 1.38)],
    clay,
  );
  if (detail === 0) return;
  const sides = detail === 1 ? 6 : detail === 2 ? 10 : 14;
  for (const [x, y, width, height] of [
    [-8.97, 1.13, 0.19, 0.29],
    [-8.5, 0.93, 0.23, 0.25],
    [-7.93, 0.91, 0.17, 0.27],
    [-7.58, 1.09, 0.19, 0.33],
  ]) {
    sphere(out, 'concrete', [x, y, z + 0.01], [width, height, 0.078], clayLight, sides, 6);
    sphere(
      out,
      'concrete',
      [x + width * 0.15, y + height * 0.7, z + 0.058],
      [0.091, 0.107, 0.052],
      clayLight,
      sides,
      6,
    );
  }
  if (detail < 2) return;
  for (const points of [
    [
      [-9.18, 0.72, 0.027],
      [-8.97, 0.63, 0.054],
      [-8.78, 0.64, 0.06],
      [-8.53, 0.73, 0.054],
      [-8.35, 0.87, 0.032],
    ],
    [
      [-8.97, 1.1, 0.044],
      [-8.69, 1.21, 0.055],
      [-8.45, 1.2, 0.06],
      [-8.23, 1.1, 0.049],
      [-8.07, 0.97, 0.029],
    ],
    [
      [-8.36, 0.62, 0.034],
      [-8.16, 0.68, 0.065],
      [-7.99, 0.81, 0.07],
      [-7.72, 0.84, 0.06],
      [-7.49, 0.77, 0.03],
    ],
    [
      [-7.91, 1.04, 0.035],
      [-7.77, 1.18, 0.065],
      [-7.55, 1.22, 0.061],
      [-7.42, 1.12, 0.048],
      [-7.38, 0.95, 0.029],
    ],
  ])
    raisedClayBand(out, points, z, sides);
}

function eastRelief(out, detail) {
  // The 2023 photo shows the relief rising toward the outer column. Its low return
  // leaves the dark opening under the right seating bank visible from the ramp.
  const z = 3.5;
  const crest = [
    [8.44, 0.72, -0.14],
    [8.76, 0.85, -0.02],
    [9.01, 1.28, 0.03],
    [9.37, 1.47, 0.08],
    [9.56, 1.41, 0.08],
    [9.91, 1.68, 0.03],
    [10.36, 1.75, -0.04],
  ];
  loft(
    out,
    'concrete',
    crest.map(([x, high, push]) => [
      [x, -0.16, z - 0.15],
      [x, high, z - 0.15],
      [x, high, z + push],
      [x, -0.16, z + 0.09],
    ]),
    clay,
  );
  if (detail === 0) return;
  for (const [x, y, width] of [
    [8.7, 0.43, 0.182],
    [9.08, 0.63, 0.245],
    [9.43, 1.03, 0.248],
    [9.8, 0.79, 0.26],
    [10.16, 1.23, 0.218],
  ]) {
    sphere(
      out,
      'concrete',
      [x, y, z + 0.065],
      [width, 0.266, 0.105],
      clayLight,
      detail < 2 ? 6 : 10,
      4,
    );
    sphere(
      out,
      'concrete',
      [x + 0.04, y + 0.235, z + 0.101],
      [0.101, 0.116, 0.085],
      clay,
      detail < 2 ? 6 : 9,
      4,
    );
    if (detail === 3) {
      sphere(
        out,
        'concrete',
        [x + 0.055, y + 0.238, z + 0.176],
        [0.031, 0.041, 0.031],
        clayLight,
        7,
        4,
      );
      for (const brow of [-1, 1])
        beam(
          out,
          'concrete',
          [x + 0.039 + 0.019 * brow, y + 0.276, z + 0.17],
          [x + 0.039 + 0.073 * brow, y + 0.263, z + 0.162],
          0.021,
          0.024,
          clay,
        );
    }
    if (detail >= 2)
      beamPath(
        out,
        'concrete',
        [
          [x - 0.2, y - 0.31, z + 0.095],
          [x - 0.28, y - 0.11, z + 0.134],
          [x - 0.18, y + 0.08, z + 0.151],
          [x - 0.037, y + 0.065, z + 0.102],
        ],
        0.062,
        0.049,
        clayLight,
      );
  }
  if (detail >= 2) {
    const sides = detail === 2 ? 8 : 12;
    raisedClayBand(
      out,
      [
        [8.95, 0.23, 0.04],
        [9.35, 0.38, 0.079],
        [9.53, 0.57, 0.055],
        [9.91, 0.51, 0.035],
      ],
      z + 0.052,
      sides,
    );
    raisedClayBand(
      out,
      [
        [9.48, 0.87, 0.034],
        [9.64, 1.15, 0.074],
        [9.98, 1.12, 0.052],
        [10.26, 1.41, 0.029],
      ],
      z + 0.041,
      sides,
    );
  }
}

function build(out, detail) {
  stage(out, detail);
  seating(out, detail);
  canopy(out, detail);
  westRelief(out, detail);
  eastRelief(out, detail);
}

export const buildMaster = (out) => build(out, 3);
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);

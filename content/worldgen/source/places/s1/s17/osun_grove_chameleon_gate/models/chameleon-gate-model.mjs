import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const surfaces = {
  clay: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  steps: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
};

const terracotta = [0.43, 0.161, 0.093];
const sand = [0.56, 0.352, 0.211];
const moss = [0.245, 0.301, 0.095];
const recess = [0.277, 0.129, 0.086];
const mix = (a, b, amount) => a.map((v, i) => v + amount * (b[i] - v));
const clamp = (value) => Math.min(1, Math.max(0, value));

function pigment(points, shade = terracotta) {
  const [x, y, z] = points[0];
  const veins =
    0.52 +
    0.29 * Math.sin(2.4 * x - y * 0.91 + z * 1.4) +
    0.12 * Math.sin(5.9 * x + y * 2.7 - z * 4.1);
  const growth = clamp(0.65 - y * 0.38 + 0.29 * Math.sin(2.1 * x - z * 3.2));
  return mix(mix(shade, sand, veins * 0.38), moss, growth * 0.67);
}

function smoothPath(points, subdivisions) {
  return Array.from({ length: (points.length - 1) * subdivisions + 1 }, (_, index) => {
    const step = Math.min(points.length - 2, Math.floor(index / subdivisions));
    const f = index / subdivisions - step;
    const a = points[Math.max(0, step - 1)],
      b = points[step];
    const c = points[step + 1],
      d = points[Math.min(points.length - 1, step + 2)];
    return b.map((v, axis) => {
      const left = (c[axis] - a[axis]) * 0.5;
      const right = (d[axis] - v) * 0.5;
      const distance = c[axis] - v;
      return (
        v + f * (left + f * (3 * distance - 2 * left - right + f * (left + right - 2 * distance)))
      );
    });
  });
}

function clayShell(out, rings, shadeAt) {
  const sides = rings[0].length;
  const triangle = (points, shade) => {
    out.addTriangle(
      'clay',
      'palette:#ffffff',
      points,
      normalFor(...points),
      [],
      pigment(points, shade),
    );
  };
  for (let j = 1; j < rings.length; j++) {
    for (let i = 0; i < sides; i++) {
      const k = (i + 1) % sides;
      const [a, b, c, d] = [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]];
      triangle([a, b, c], shadeAt(j));
      triangle([a, c, d], shadeAt(j));
    }
  }
  for (const [ring, shade] of [
    [rings[0].slice().reverse(), shadeAt(0)],
    [rings.at(-1), shadeAt(rings.length - 1)],
  ]) {
    // The profiles are star-shaped. A center fan preserves the irregular shell at both ends.
    const center = [0, 1, 2].map((axis) => ring.reduce((sum, p) => sum + p[axis], 0) / sides);
    for (let i = 0; i < sides; i++) triangle([center, ring[i], ring[(i + 1) % sides]], shade);
  }
}

// Each handle describes a sculpted cross-section as x, y, z and its two radii.
function sweep(out, detail, controls, seed, shade = terracotta, footingY, depthProfile) {
  const sections = smoothPath(controls, detail.subdivisions);
  const rings = sections.map(([x, y, z, ru, rv], j) => {
    const previous = sections[Math.max(0, j - 1)];
    const next = sections[Math.min(j + 1, sections.length - 1)];
    const tangent = normalize([
      next[0] - previous[0],
      next[1] - previous[1],
      next[2] - previous[2],
    ]);
    const u = normalize(cross([0, 0, 1], tangent));
    const v = cross(tangent, u);
    return Array.from({ length: detail.sides }, (_, i) => {
      const angle = (i * 2 * Math.PI) / detail.sides;
      const irregularity =
        1 + 0.085 * Math.cos(3 * angle + seed + y * 0.95) + 0.055 * Math.sin(5 * angle + x * 1.2);
      const depth = depthProfile ? rv * depthProfile(x, y, angle, detail) : rv;
      return [x, y, z].map(
        (w, k) =>
          w +
          irregularity *
            (u[k] * Math.cos(angle) * Math.max(0.014, ru) +
              v[k] * Math.sin(angle) * Math.max(0.014, depth)),
      );
    });
  });
  if (footingY !== undefined) {
    const extend = (ring) => ring.map(([x, , z]) => [x, footingY, z]);
    rings.unshift(extend(rings[0]));
    rings.push(extend(rings.at(-1)));
  }
  clayShell(out, rings, () => shade);
}

// The cross-section travels out around the clay lip and returns into its concave interior.
function cup(out, detail, [x, y, z], [width, height, depth], seed, tilt = 0) {
  const profile = [
    [0.24, -0.62],
    [0.57, -0.48],
    [0.86, -0.24],
    [1, 0.24],
    [0.91, 0.28],
    [0.75, 0.04],
    [0.47, -0.18],
    [0.125, -0.32],
  ];
  const sides = detail.sides < 5 ? 6 : detail.sides * 2;
  const sections = detail.sides < 5 ? [profile[0], profile[3], profile[5], profile[7]] : profile;
  const rings = sections.map(([scale, dz]) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (i * 2 * Math.PI) / sides;
      const r = scale * (1 + 0.14 * Math.cos(3 * a + seed) + 0.1 * Math.sin(5 * a + seed * 0.6));
      const dx = Math.cos(a) * width * r;
      const dy = Math.sin(a) * height * r;
      return [
        x + dx,
        y + dy + tilt * dx,
        z + depth * (dz + (0.21 * dy) / height + 0.12 * Math.sin(2 * a + seed) * scale),
      ];
    }),
  );
  clayShell(out, rings, (j) => (j < 5 ? terracotta : mix(terracotta, recess, (j - 4) * 0.2)));
}

// The lower arch carries hollows beneath projecting clay lips on both faces.
function pierDepth(x, y, angle, detail) {
  const left = x < 0;
  const front = Math.sin(angle);
  const atHeight = (center, halfHeight) => clamp(1 - Math.abs(y - center) / halfHeight);
  const flare = 0.34 * atHeight(0.08, 0.63) * Math.abs(front);
  if (detail.sides < 7) return 1 + flare;

  const frontBand = clamp((front - 0.31) / 0.69);
  const rearBand = clamp((-front - 0.24) / 0.76);
  const frontHollow = atHeight(left ? 0.97 : 1.27, left ? 0.55 : 0.48);
  const frontLip = atHeight(left ? 1.54 : 1.78, 0.36);
  const rearHollow = atHeight(left ? 0.62 : 1.23, left ? 0.47 : 0.55);
  const rearLip = atHeight(left ? 1.16 : 1.81, 0.41);
  return (
    1 +
    flare +
    frontBand * (frontLip * 0.46 - frontHollow * 0.69) +
    rearBand * (rearLip * 0.43 - rearHollow * 0.64)
  );
}

function gate(out, detail) {
  sweep(
    out,
    detail,
    [
      [-1.24, -0.25, 0.17, 0.61, 0.93],
      [-1.28, 0.18, 0.15, 0.64, 0.87],
      [-1.11, 0.54, 0.1, 0.48, 0.72],
      [-1.04, 0.98, 0.08, 0.42, 0.66],
      [-0.98, 1.52, 0.07, 0.42, 0.68],
      [-0.86, 1.96, -0.08, 0.38, 0.57],
      [-0.62, 2.57, -0.06, 0.46, 0.51],
      [-0.08, 2.82, -0.02, 0.43, 0.59],
      [0.55, 2.61, -0.04, 0.44, 0.52],
      [0.81, 2.1, 0.04, 0.46, 0.54],
      [0.94, 1.79, 0.04, 0.38, 0.64],
      [1.08, 1.26, 0.02, 0.35, 0.66],
      [1.13, 0.74, -0.13, 0.4, 0.71],
      [1.21, 0.19, 0, 0.55, 0.86],
      [1.22, -0.25, 0.03, 0.6, 0.93],
    ],
    1.23,
    terracotta,
    -0.63,
    pierDepth,
  );
  sweep(
    out,
    detail,
    [
      [-0.12, 2.65, 0.17, 0.36, 0.37],
      [-0.19, 3.1, 0.34, 0.29, 0.29],
      [-0.36, 3.72, 0.42, 0.22, 0.21],
      [-0.63, 4.45, 0.56, 0.15, 0.16],
      [-0.97, 5.16, 0.52, 0.115, 0.12],
      [-1.42, 5.88, 0.41, 0.066, 0.068],
      [-1.91, 6.47, 0.32, 0.021, 0.027],
    ],
    2.3,
    [0.46, 0.24, 0.159],
  );
  sweep(
    out,
    detail,
    [
      [-0.32, 2.67, -0.08, 0.43, 0.42],
      [-0.34, 2.98, -0.47, 0.27, 0.28],
      [-0.3, 3.42, -0.71, 0.16, 0.18],
      [-0.49, 3.72, -0.75, 0.022, 0.051],
    ],
    2.1,
  );
  sweep(
    out,
    detail,
    [
      [-0.6, 2.68, -0.05, 0.29, 0.4],
      [-1.26, 2.69, -0.07, 0.23, 0.33],
      [-1.88, 2.49, 0.05, 0.16, 0.22],
      [-2.49, 2.27, 0.22, 0.04, 0.102],
    ],
    3,
  );
  sweep(
    out,
    detail,
    [
      [0.46, 2.69, -0.11, 0.29, 0.44],
      [1.11, 2.63, -0.17, 0.23, 0.37],
      [1.77, 2.35, -0.32, 0.18, 0.26],
      [2.33, 2.21, -0.44, 0.057, 0.12],
    ],
    1.1,
  );
  if (detail.sides > 4) {
    cup(out, detail, [-0.48, 2.52, 0.46], [0.24, 0.35, 0.27], 1.5, 0.38);
    cup(out, detail, [0.24, 2.46, 0.53], [0.23, 0.34, 0.28], 2.4, -0.44);
  }
}

function flowerWalls(out, detail) {
  sweep(
    out,
    detail,
    [
      [2.1, -0.04, 0.13, 0.24, 0.52],
      [2.85, 0.05, -0.02, 0.36, 0.46],
      [3.55, 0.04, -0.22, 0.37, 0.56],
      [4.45, 0.1, -0.4, 0.42, 0.64],
      [5.54, 0.08, -0.12, 0.41, 0.62],
      [6.47, 0.05, 0.17, 0.36, 0.51],
      [7.24, 0.02, 0.14, 0.3, 0.37],
    ],
    1.1,
  );
  sweep(
    out,
    detail,
    [
      [4.61, 0.02, -0.25, 1.03, 0.61],
      [4.56, 0.64, -0.32, 0.93, 0.62],
      [4.48, 1.4, -0.48, 0.77, 0.48],
      [4.42, 2.15, -0.61, 0.66, 0.39],
      [4.45, 2.85, -0.75, 0.42, 0.27],
      [4.3, 3.28, -0.81, 0.21, 0.15],
      [4.27, 3.39, -0.81, 0.06, 0.05],
    ],
    2.1,
  );
  cup(out, detail, [4.5, 0.96, 0.3], [1.12, 0.52, 0.82], 2.34, 0.15);
  cup(out, detail, [4.34, 1.48, 0.35], [0.93, 0.43, 0.83], 0.54, -0.33);
  cup(out, detail, [4.23, 1.96, 0.11], [0.89, 0.55, 0.73], 1.32, -0.29);
  sweep(
    out,
    detail,
    [
      [5.43, 0, -0.45, 0.52, 0.55],
      [5.63, 0.82, -0.29, 0.25, 0.45],
      [5.81, 1.53, -0.26, 0.22, 0.37],
      [5.72, 2.32, -0.38, 0.17, 0.29],
      [5.93, 2.85, -0.37, 0.18, 0.28],
      [6.63, 2.91, -0.24, 0.21, 0.26],
      [7.26, 2.65, -0.22, 0.19, 0.26],
      [7.61, 2.11, -0.29, 0.13, 0.2],
      [7.59, 1.4, -0.2, 0.16, 0.21],
      [7.27, 0.29, 0.03, 0.42, 0.45],
    ],
    2.3,
  );
  cup(out, detail, [6.61, 1.16, 0.1], [0.8, 0.37, 0.52], 1.84, 0.33);

  sweep(
    out,
    detail,
    [
      [-2.05, -0.07, 0.11, 0.26, 0.53],
      [-2.88, 0.01, 0.16, 0.41, 0.62],
      [-3.8, 0.14, -0.27, 0.5, 0.58],
      [-4.95, 0.1, -0.47, 0.47, 0.62],
      [-6.1, 0.04, -0.55, 0.35, 0.43],
    ],
    0.36,
  );
  // The continuous clay footing extends below the low part of the flower wall.
  // It can meet a sloping approach without lowering the gate's shared stair threshold.
  loft(
    out,
    'clay',
    [
      [
        [-4.68, -0.74, -0.55],
        [-4.58, -0.74, 0.035],
        [-3.07, -0.74, 0.15],
        [-3.17, -0.74, -0.54],
      ],
      [
        [-4.72, -0.285, -0.48],
        [-4.61, -0.285, -0.04],
        [-3.03, -0.285, 0.045],
        [-3.1, -0.285, -0.46],
      ],
    ],
    terracotta,
  );
  for (const [x, y, bend, width] of [
    [-5.7, 1.85, -0.25, 0.4],
    [-4.91, 2.17, 0.31, 0.47],
    [-4.18, 1.72, 0.18, 0.45],
    [-3.53, 1.34, 0.43, 0.34],
  ]) {
    sweep(
      out,
      detail,
      [
        [x, -0.03, -0.31, width, 0.42],
        [x - 0.07, y * 0.4, -0.36, width * 0.93, 0.32],
        [x + bend * 0.31, y * 0.72, -0.46, width * 0.58, 0.21],
        [x + bend, y, -0.48, 0.033, 0.038],
      ],
      y * 1.23,
    );
  }
  cup(out, detail, [-3.88, 0.76, 0.04], [0.83, 0.36, 0.57], 2.9, -0.22);
}

function approach(out, detail) {
  const path = [
    [-0.86, 0.85, -0.95, 0.022],
    [-0.84, 0.91, 0.77, 0.025],
    [-1.13, 1.01, 1.47, 0.014],
    [-1.14, 1.0, 1.49, -0.067],
    [-1.16, 0.94, 1.92, -0.076],
    [-1.17, 0.94, 1.94, -0.14],
    [-1.29, 0.91, 2.24, -0.146],
    [-1.29, 0.91, 2.27, -0.205],
    [-1.26, 0.89, 2.57, -0.21],
  ];
  const rings = path.map(([left, right, z, top]) => [
    [left, -0.48, z],
    [right, -0.48, z],
    [right, top, z],
    [0.06, top + 0.016 / detail.sides, z],
    [left, top, z],
  ]);
  loft(out, 'steps', rings, [0.55, 0.417, 0.27]);
}

function build(out, sides, subdivisions) {
  const detail = { sides, subdivisions };
  approach(out, detail);
  gate(out, detail);
  flowerWalls(out, detail);
}

export const buildSkyline = (out) => build(out, 4, 1);
export const buildDistrict = (out) => build(out, 7, 1);
export const buildStreet = (out) => build(out, 10, 2);
export const buildCloseup = (out) => build(out, 14, 3);
export const buildMaster = (out) => build(out, 20, 4);

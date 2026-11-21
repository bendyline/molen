import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  cross,
  loft,
  normalFor,
  normalize,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const surfaces = {
  cement: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96, metallic: 0 },
  footing: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.97, metallic: 0 },
};

const clay = [0.51, 0.267, 0.153];
const paleCement = [0.6, 0.423, 0.277];
const lichen = [0.274, 0.311, 0.115];
const shadow = [0.367, 0.184, 0.108];
const foundationY = -0.84;
const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
const clamp = (f) => Math.max(0, Math.min(1, f));

function cementColor([x, y, z], base = clay) {
  const warmed = mix(base, paleCement, 0.29 + 0.13 * Math.sin(1.9 * x - 1.4 * y + 2.5 * z));
  const damp = clamp(0.69 - 0.4 * y + 0.23 * Math.sin(2.3 * x + 3.2 * z));
  return mix(warmed, lichen, 0.66 * damp);
}

// Each section gives the center and two section radii. The visitor sees the fork on the left.
const arch = {
  pedestal: [
    [-2.26, -0.19, 0.18, 0.91, 0.94],
    [-2.22, 0.32, 0.17, 0.67, 0.72],
    [-2.02, 1.41, 0.09, 0.43, 0.47],
    [-1.78, 2.68, 0.02, 0.37, 0.37],
    [-1.63, 3.69, 0.01, 0.43, 0.42],
    [-1.58, 4.66, 0, 0.45, 0.43],
    [-1.79, 5.56, -0.03, 0.3, 0.3],
    [-2.17, 6.16, -0.11, 0.24, 0.29],
    [-2.64, 6.57, -0.12, 0.16, 0.25],
  ],
  sweptWing: [
    [5.73, -0.19, 0.06, 1.03, 1.05],
    [5.63, 0.56, 0.06, 0.78, 0.83],
    [5.32, 1.65, 0.055, 0.72, 0.64],
    [4.73, 2.72, 0.01, 0.77, 0.53],
    [3.99, 3.67, -0.02, 0.71, 0.45],
    [2.91, 4.57, -0.071, 0.6, 0.37],
    [1.63, 5.27, -0.13, 0.5, 0.28],
    [0.34, 5.72, -0.18, 0.31, 0.21],
    [-0.17, 6.04, -0.16, 0.045, 0.059],
  ],
  shoulder: [
    [-1.92, 5.23, -0.02, 0.34, 0.48],
    [-1.18, 5.32, 0.02, 0.31, 0.46],
    [-0.51, 5.27, -0.07, 0.27, 0.46],
    [0.07, 5.39, -0.08, 0.29, 0.4],
    [0.78, 5.46, -0.11, 0.31, 0.3],
  ],
  fork: [
    [-4.89, -0.2, -0.08, 0.91, 0.82],
    [-4.65, 0.69, -0.035, 0.64, 0.66],
    [-4.12, 1.72, 0.08, 0.49, 0.55],
    [-3.43, 2.77, 0.13, 0.45, 0.48],
    [-2.76, 3.61, 0.16, 0.32, 0.44],
    [-2.2, 4.26, 0.15, 0.32, 0.35],
    [-1.59, 4.62, 0.12, 0.24, 0.32],
  ],
  thinFork: [
    [-3.85, -0.18, -0.43, 0.57, 0.59],
    [-3.78, 0.89, -0.45, 0.38, 0.38],
    [-3.37, 1.88, -0.51, 0.31, 0.36],
    [-2.67, 2.53, -0.45, 0.22, 0.28],
    [-1.76, 2.86, -0.29, 0.21, 0.29],
  ],
  crest: [
    [-3.67, 6.56, -0.1, 0.029, 0.052],
    [-3.24, 6.54, -0.1, 0.104, 0.13],
    [-2.75, 6.65, -0.12, 0.135, 0.29],
    [-2.29, 6.76, -0.11, 0.091, 0.23],
    [-1.97, 6.86, -0.08, 0.03, 0.08],
  ],
  raisedRidge: [
    [-1.95, 5.06, 0.29, 0.24, 0.19],
    [-1.69, 5.47, 0.17, 0.19, 0.16],
    [-1.31, 5.59, 0.1, 0.15, 0.11],
    [-1.02, 5.75, 0.03, 0.044, 0.05],
  ],
};

function sections(controls, steps) {
  return Array.from({ length: (controls.length - 1) * steps + 1 }, (_, i) => {
    const j = Math.min(controls.length - 2, Math.floor(i / steps));
    const t = i / steps - j;
    const a = controls[Math.max(0, j - 1)];
    const b = controls[j];
    const c = controls[j + 1];
    const d = controls[Math.min(j + 2, controls.length - 1)];
    return b.map((v, axis) => {
      const slope0 = (c[axis] - a[axis]) * 0.5;
      const slope1 = (d[axis] - v) * 0.5;
      const change = c[axis] - v;
      return (
        v +
        t * (slope0 + t * (3 * change - 2 * slope0 - slope1 + t * (slope0 + slope1 - 2 * change)))
      );
    });
  });
}

// Dimple centers along the broad front face of the wing, traced from the restored entrance.
const dimples = [
  [0.36, 1.33, 0.042, 0.37],
  [0.445, 1.87, 0.047, 0.26],
  [0.56, 1.63, 0.054, 0.31],
  [0.671, 1.99, 0.036, 0.33],
  [0.751, 1.37, 0.048, 0.29],
  [0.805, 1.9, 0.033, 0.27],
];

function sweep(out, controls, detail, { seed = 0, wing = false, grounded = false } = {}) {
  const path = sections(controls, detail.steps);
  const rings = path.map(([x, y, z, ru, rv], j) => {
    const next = path[Math.min(j + 1, path.length - 1)];
    const previous = path[Math.max(0, j - 1)];
    const tangent = normalize(next.slice(0, 3).map((v, i) => v - previous[i]));
    const u = normalize(cross([0, 0, 1], tangent));
    const v = cross(tangent, u);
    const t = j / (path.length - 1);
    return Array.from({ length: detail.sides }, (_, i) => {
      const angle = (2 * Math.PI * i) / detail.sides;
      const irregular =
        1 + 0.096 * Math.cos(3 * angle + seed + 0.64 * y) + 0.048 * Math.sin(5 * angle + 1.43 * x);
      const dent =
        wing && detail.dents
          ? dimples.reduce((amount, [s, a, width, depth]) => {
              const f = clamp(1 - ((s - t) / width) ** 2 - ((a - angle) / depth) ** 2);
              return Math.max(amount, f * f);
            }, 0)
          : 0;
      const across = Math.max(0.02, ru) * irregular * Math.cos(angle);
      const thickness = Math.max(0.018, rv) * irregular * Math.sin(angle) * (1 - 0.55 * dent);
      return [
        [
          x + u[0] * across + v[0] * thickness,
          y + u[1] * across + v[1] * thickness,
          z + u[2] * across + v[2] * thickness,
        ],
        dent,
      ];
    });
  });
  const triangle = (a, b, c) => {
    const points = [a[0], b[0], c[0]];
    const color = mix(cementColor(points[0]), shadow, Math.max(a[1], b[1], c[1]) * 0.53);
    out.addTriangle('cement', 'palette:#ffffff', points, normalFor(...points), [], color);
  };
  // Carry the same exposed foot profile below grade. This lets the viewer keep the local
  // ground slope and leaves the arch openings and upper silhouette undistorted.
  const lowerCenter = path[0].slice(0, 3);
  if (grounded) {
    lowerCenter[1] = foundationY;
    rings.unshift(rings[0].map(([[x, , z], dent]) => [[x, foundationY, z], dent]));
  }
  for (let j = 1; j < rings.length; j++) {
    for (let i = 0; i < detail.sides; i++) {
      const k = (i + 1) % detail.sides;
      const [a, b, c, d] = [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]];
      triangle(a, b, c);
      triangle(a, c, d);
    }
  }
  for (const [ring, center] of [
    [rings[0].toReversed(), lowerCenter],
    [rings.at(-1), path.at(-1)],
  ]) {
    for (let i = 0; i < ring.length; i++)
      triangle([center.slice(0, 3), 0], ring[i], ring[(i + 1) % ring.length]);
  }
}

// Only the two short stretches visible beside the rebuilt gate are included.
const leftWall = [
  [-8.34, foundationY],
  [-4.91, foundationY],
  [-4.92, 0.47],
  [-5.2, 0.83],
  [-5.39, 1.13],
  [-5.56, 1.23],
  [-5.76, 0.97],
  [-6.04, 0.79],
  [-6.33, 0.92],
  [-6.57, 1.28],
  [-6.77, 1.36],
  [-6.9, 1.1],
  [-7.25, 0.96],
  [-7.58, 1.04],
  [-7.95, 1.19],
  [-8.29, 1.04],
];
const rightWall = [
  [5.97, foundationY],
  [8.87, foundationY],
  [8.88, 0.69],
  [8.48, 0.68],
  [8.25, 0.79],
  [8.08, 1.04],
  [7.98, 1.39],
  [7.84, 1.42],
  [7.69, 1.19],
  [7.48, 1.16],
  [7.31, 1.29],
  [7.18, 1.48],
  [6.99, 1.53],
  [6.83, 1.41],
  [6.59, 1.21],
  [6.42, 1.22],
  [6.36, 1.34],
  [6.21, 1.31],
  [6.07, 0.98],
];
const wallCement = [0.51, 0.279, 0.198];

function wallFace(out, outline, cutout, project, faceSign) {
  const points = [...outline, ...cutout];
  const indices = earcut(points.flat(), cutout.length ? [outline.length] : []);
  for (let i = 0; i < indices.length; i += 3) {
    const face = indices.slice(i, i + 3).map((index) => project(points[index]));
    if (normalFor(...face)[2] * faceSign < 0) face.reverse();
    const color = cementColor(
      face.map((_, axis) => (face[0][axis] + face[1][axis] + face[2][axis]) / 3),
      wallCement,
    );
    out.addTriangle('cement', 'palette:#ffffff', face, normalFor(...face), [], color);
  }
}

function adjoiningWalls(out, detail) {
  const center = [6.95, 0.84];
  const co = Math.cos(0.6);
  const si = Math.sin(0.6);
  const aperture = (width, height) =>
    Array.from({ length: detail.sides }, (_, i) => {
      const angle = (i * 2 * Math.PI) / detail.sides;
      const fold = 1 + 0.12 * Math.sin(3 * angle + 0.6);
      const u = width * Math.cos(angle) * fold;
      const v = height * Math.sin(angle) * fold;
      return [center[0] + co * u - si * v, center[1] + si * u + co * v];
    });
  const hole = aperture(0.45, 0.155);
  const lip = aperture(0.53, 0.22);
  const shoulder = aperture(0.61, 0.3);
  for (const [outline, inset, rise, crossesWall] of [
    [leftWall, 0.4, -0.17, false],
    [rightWall, 0.24, 0.21, true],
  ]) {
    const point =
      (side) =>
      ([x, y]) => {
        const foot = clamp((0.63 - y) / 0.87);
        const thickness = 0.17 + 0.52 * foot * foot;
        return [x, y, inset + rise * Math.sin(1.28 * x) + side * thickness];
      };
    const front = point(1),
      back = point(-1);
    wallFace(out, outline, crossesWall ? shoulder : [], front, 1);
    wallFace(out, outline, crossesWall ? hole : [], back, -1);
    loft(out, 'cement', [outline.map(back), outline.map(front)], wallCement, { cap: false });
    if (!crossesWall) continue;
    const raised = lip.map((p) => {
      const [x, y, z] = front(p);
      return [x, y, z + 0.11];
    });
    const throat = hole.map(front);
    loft(out, 'cement', [shoulder.map(front), raised, throat], wallCement, { cap: false });
    loft(out, 'cement', [throat, hole.map(back)], mix(wallCement, shadow, 0.52), { cap: false });
  }
}

const roots = [
  [
    [-3.27, -0.15, 0.51, 0.33, 0.47],
    [-2.75, 0.2, 0.48, 0.27, 0.36],
    [-2.26, 1.42, 0.31, 0.12, 0.18],
    [-1.82, 3.42, 0.28, 0.12, 0.16],
  ],
  [
    [-1.04, -0.16, 0.58, 0.28, 0.34],
    [-1.51, 0.32, 0.32, 0.26, 0.29],
    [-1.77, 1.27, 0.31, 0.14, 0.14],
    [-1.55, 2.49, 0.27, 0.12, 0.14],
  ],
  [
    [5.97, -0.18, 0.92, 0.48, 0.45],
    [5.74, 0.45, 0.53, 0.36, 0.34],
    [5.43, 0.95, 0.43, 0.21, 0.27],
    [5.42, 1.68, 0.34, 0.12, 0.21],
  ],
];

function build(out, detail) {
  for (const [index, [key, profile]] of Object.entries(arch).entries())
    sweep(out, profile, detail, {
      seed: index * 2.4,
      wing: key === 'sweptWing',
      grounded: profile[0][1] < 0,
    });
  adjoiningWalls(out, detail);
  if (detail.steps >= 3) {
    for (const [i, profile] of roots.entries())
      sweep(out, profile, detail, { seed: 6.1 * i, grounded: true });
    for (const offset of [-6.1, 5.65]) {
      const slab = [
        [-0.8, -0.4],
        [-0.66, 0.76],
        [0.55, 0.92],
        [0.85, 0.1],
        [0.64, -0.56],
      ];
      const ring = (y, scale) => slab.map(([x, z]) => [offset + x * scale, y, z * scale]);
      loft(
        out,
        'footing',
        [ring(foundationY, 1), ring(-0.24, 1), ring(0.11, 0.86)],
        mix(paleCement, lichen, 0.41),
      );
    }
  } else {
    // At distance the immediate footings still bind the same stone graph as the nearer tiers.
    const foot = (y, r) =>
      [
        [-6.6, -0.42],
        [-6.6, 0.61],
        [-5.62, 0.61],
        [-5.62, -0.42],
      ].map(([x, z]) => [-6.1 + (x + 6.1) * r, y, z * r]);
    loft(
      out,
      'footing',
      [foot(foundationY, 1), foot(-0.25, 1), foot(0.04, 0.88)],
      mix(paleCement, lichen, 0.41),
    );
  }
}

export const buildSkyline = (out) => build(out, { sides: 6, steps: 1 });
export const buildDistrict = (out) => build(out, { sides: 9, steps: 2 });
export const buildStreet = (out) => build(out, { sides: 14, steps: 3 });
export const buildCloseup = (out) => build(out, { sides: 22, steps: 6, dents: true });
export const buildMaster = (out) => build(out, { sides: 30, steps: 8, dents: true });

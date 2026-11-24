import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  rock: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.93 },
  face: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93 },
  masonry: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.94 },
  floor: { slot: 'roof', graph: 'stone_limestone_raw', roughness: 0.96 },
  stela: { slot: 'trim', graph: 'stone_granite', roughness: 0.91 },
};
const stone = [0.68, 0.564, 0.38];
const ashlar = [0.697, 0.587, 0.416];
const tint = (color, scale) => color.map((component) => component * scale);
const lerp = (a, b, t) => a + (b - a) * t;

function face(out, material, points, color, forceUp = false) {
  if (forceUp && normalFor(...points)[1] < 0) points.reverse();
  const first = points.slice(0, 3);
  out.addTriangle(material, '', first, normalFor(...first), [], color);
  if (points.length === 4) {
    const second = [points[0], points[2], points[3]];
    out.addTriangle(material, '', second, normalFor(...second), [], color);
  }
}

function shell(out, rings, surfaceAt) {
  for (let i = 1; i < rings.length; i++) {
    for (let j = 0; j < rings[i].length; j++) {
      const k = (j + 1) % rings[i].length;
      const { surface, color } = surfaceAt(i, j);
      face(out, surface, [rings[i - 1][j], rings[i - 1][k], rings[i][k], rings[i][j]], color);
    }
  }
  for (const [i, cap] of [rings[0].slice().reverse(), rings.at(-1)].entries()) {
    const { surface, color } = surfaceAt(i === 0 ? 0 : rings.length - 1, 0);
    const center = cap[0].map(
      (_, axis) => cap.reduce((sum, point) => sum + point[axis], 0) / cap.length,
    );
    for (let j = 0; j < cap.length; j++)
      face(out, surface, [center, cap[j], cap[(j + 1) % cap.length]], color);
  }
}

// Cross sections along the south elevation, constrained in plan by OSM way 540058405.
// Each station contains east distance, negative and positive Z limits, and the visible crown.
const bodySections = [
  [-37.54, -0.23, 1.7, 0.76],
  [-36.85, -2.55, 3.37, 1.7],
  [-35.35, -4.71, 5.68, 2.56],
  [-32.92, -7.25, 8.12, 4.4],
  [-30.35, -8.71, 9.15, 6.5],
  [-28.85, -9.5, 9.45, 8.1],
  [-25.45, -9.45, 9.41, 10.12],
  [-22.32, -9.42, 9.37, 11.55],
  [-18.75, -9.39, 9.34, 12.16],
  [-14.2, -9.38, 9.31, 12.21],
  [-11.02, -8.83, 8.65, 12.18],
  [-10.02, -7.43, 7.04, 12.16],
  [-6.35, -5.87, 5.18, 12.04],
  [-1.02, -5.82, 5.23, 11.9],
  [3.76, -5.78, 5.28, 12.04],
  [7.58, -5.92, 5.57, 12.34],
  [9.04, -6.98, 6.49, 12.81],
  [10.91, -8.45, 8.22, 12.88],
  [13.21, -8.49, 8.63, 11.63],
  [15.38, -8.15, 8.5, 9.84],
  [17.34, -7.67, 8.42, 7.42],
  [18.88, -6.46, 7.21, 5.42],
  [19.85, -3.48, 3.75, 3.83],
  [21.53, -1.4, 1.5, 1.31],
];
const bodyLayers = [
  [0, 1],
  [0.14, 0.999],
  [0.29, 0.96],
  [0.38, 0.9],
  [0.46, 0.83],
  [0.51, 0.89],
  [0.58, 0.8],
  [0.63, 0.74],
  [0.67, 0.82],
  [0.71, 0.71],
  [0.77, 0.71],
  [0.8, 0.63],
  [0.84, 0.7],
  [0.88, 0.58],
  [0.91, 0.57],
  [0.96, 0.46],
  [1, 0.26],
];

function sectionRing(x, near, far, crown, levels, floor = 0) {
  const mid = (near + far) / 2;
  const width = (far - near) / 2;
  return [-1, 1].flatMap((side) => {
    const sequence = side === -1 ? levels : levels.slice().reverse();
    return sequence.map(([height, radius]) => [
      x,
      lerp(floor, crown, height),
      mid + side * width * radius,
    ]);
  });
}

function body(out, level) {
  const sections =
    level > 1 ? bodySections : bodySections.filter((_, index) => index % 2 === 0 || index === 23);
  const layers =
    level === 0
      ? bodyLayers.filter((_, index) => [0, 3, 8, 13, 16].includes(index))
      : level === 1
        ? bodyLayers.filter((_, index) => index % 2 === 0)
        : bodyLayers;
  const rings = sections.map(([x, near, far, crown]) =>
    sectionRing(x, near, far, crown, layers, -0.09),
  );
  shell(out, rings, (slice, side) => {
    const course = Math.min(side, layers.length * 2 - side - 2);
    const faced = course < 2;
    const variation = 1 + (level > 1 ? 0.024 * Math.cos(slice * 1.6 + course * 0.43) : 0);
    return { surface: faced ? 'masonry' : 'rock', color: tint(faced ? ashlar : stone, variation) };
  });
}

const forelegs = [
  [
    [12.1, -8.6, -1],
    [18.9, -7.6, -1.4],
    [21.66, -7.45, -1.55],
    [22.43, -7.2, -2.54],
    [33.5, -6.95, -2.54],
    [35.94, -6.79, -2.5],
    [36.89, -6.32, -3.1],
    [37.52, -5.18, -4.05],
  ],
  [
    [12.1, 0.95, 8.78],
    [18.79, 1.6, 8.34],
    [21.65, 1.45, 8.27],
    [22.39, 2.75, 8.19],
    [33.6, 2.97, 8.08],
    [36.05, 3.16, 7.94],
    [37.05, 3.93, 7.24],
    [37.51, 5.04, 6.48],
  ],
];
function paws(out, level) {
  const layers =
    level < 2
      ? [
          [0, 1],
          [0.82, 0.96],
          [1, 0.64],
        ]
      : [
          [0, 1],
          [0.27, 0.997],
          [0.56, 0.992],
          [0.82, 0.94],
          [0.96, 0.8],
          [1, 0.53],
        ];
  for (const leg of forelegs) {
    const rings = leg.map(([x, near, far], i) =>
      sectionRing(x, near, far, i === 0 ? 4.3 : 3.12 - i * 0.075, layers, -0.09),
    );
    shell(out, rings, (i, j) => ({
      surface: 'masonry',
      color: tint(ashlar, 1 + 0.016 * Math.cos(i + j)),
    }));
  }
}

// Height, west silhouette, east silhouette, and half-width of the carved head and nemes.
const headSections = [
  [9.81, 5.82, 14.12, 3.17],
  [12.05, 6.6, 14.15, 3.36],
  [13.04, 6.9, 14.0, 3.05],
  [13.92, 6.65, 14.39, 3.46],
  [14.53, 6.35, 15.34, 4.14],
  [15.12, 6.24, 15.98, 4.72],
  [15.76, 6.05, 15.79, 5.12],
  [16.44, 6.12, 15.52, 4.92],
  [17.13, 6.35, 15.6, 4.47],
  [17.82, 6.86, 15.38, 3.91],
  [18.45, 7.45, 15.51, 3.23],
  [19.12, 8.12, 15.02, 2.81],
  [19.7, 9.07, 14.76, 2.22],
  [20.03, 10.04, 14.08, 1.63],
  [20.11, 10.88, 13.41, 1.01],
];
const smooth = (n) => Math.max(0, 1 - n * n);
const ease = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
const relief = (z, y, center, height, w, h) => smooth((z - center) / w) * smooth((y - height) / h);
function features(y, z, level) {
  if (level === 0) return 0;
  const side = Math.abs(z);
  let rise = 0.27 * relief(side, y, 1.15, 17.35, 1.06, 0.32);
  rise -= 0.39 * relief(side, y, 1.16, 16.97, 0.78, 0.42);
  rise += 0.22 * relief(side, y, 1.38, 16.17, 1.02, 0.58);
  rise -= 0.41 * relief(z, y, 0.045, 16.41, 0.59, 1.02);
  rise += 0.19 * relief(z, y, -0.03, 15.62, 1.18, 0.27);
  rise -= 0.135 * relief(z, y, -0.02, 15.46, 1.17, 0.135);
  rise += 0.12 * relief(z, y, -0.01, 15.27, 0.98, 0.22);
  rise += 0.24 * relief(side, y, 2.76, 16.48, 0.55, 0.8);
  if (level > 1) {
    rise += 0.048 * relief(side, y, 1.16, 16.94, 0.7, 0.16);
    rise -= 0.11 * relief(side, y, 2.87, 16.38, 0.24, 0.45);
  }
  return rise;
}

function head(out, level) {
  const subdivisions = [1, 1, 3, 5][level];
  const sides = [16, 32, 56, 88][level];
  const profile = level === 0 ? headSections.filter((_, i) => i % 2 === 0) : headSections;
  const sections = profile
    .slice(1)
    .flatMap((b, i) =>
      Array.from({ length: subdivisions }, (_, j) =>
        b.map((value, axis) => lerp(profile[i][axis], value, j / subdivisions)),
      ),
    );
  sections.push(profile.at(-1));
  const rings = sections.map(([y, west, east, width]) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-2 * Math.PI * i) / sides;
      const u = Math.cos(a);
      const z = 0.16 + width * Math.sin(a);
      const front = Math.sign(u) * Math.pow(Math.abs(u), 0.68);
      const x = lerp(west, east, (front + 1) / 2);
      const plane = u > 0 ? 1 : 0;
      const across = Math.abs(z - 0.16);
      // The face projects in front of the two broad lappets, which reach the shoulders.
      const lappet = ease((across - lerp(1.36, 2.04, ease((y - 13.2) / 4))) / 1.5);
      const recess = 2.28 * lappet * ease((19.45 - y) / 1.6) * ease(u * 4);
      const pleat =
        level > 1 && plane ? 0.044 * Math.cos(y * 11.4 + across * 0.8) * lappet * ease(u * 5) : 0;
      return [x - recess + plane * features(y, z, level) + pleat, y, z];
    }),
  );
  shell(out, rings, (slice, section) => {
    const angle = Math.cos((2 * Math.PI * (section + 0.5)) / sides);
    const across = Math.abs(
      (rings[slice][section][2] + rings[slice][(section + 1) % sides][2]) / 2 - 0.16,
    );
    const faceLight =
      ease(angle * 2) * ease((2.7 - across) / 0.7) * ease((sections[slice][0] - 13.8) / 1.7);
    const texture = level > 1 ? 0.007 * Math.cos(slice * 2.1 + section * 5.2) : 0;
    return { surface: 'face', color: tint(stone, 0.96 + 0.08 * faceLight + texture) };
  });
}

function tail(out, level) {
  if (level === 0) return;
  const points = [
    [-36.7, 1.15, 2.35],
    [-35.6, 1.06, 4.23],
    [-33.48, 0.97, 6.85],
    [-30.65, 1.04, 8.63],
    [-27, 1.18, 8.6],
    [-23.4, 1.75, 8.42],
    [-19.4, 2.3, 7.79],
    [-17.4, 2.45, 7.35],
  ];
  const sides = level === 1 ? 7 : 11;
  const rings = points.map(([x, y, z], i) =>
    Array.from({ length: sides }, (_, j) => {
      const angle = (2 * Math.PI * j) / sides;
      const radius = 0.62 - 0.03 * i;
      return [x, y + Math.cos(angle) * radius, z + Math.sin(angle) * radius];
    }),
  );
  loft(out, 'masonry', rings, tint(ashlar, 0.92));
}

function stele(out, level) {
  const [x, z] = site.stela;
  box(out, 'masonry', [x - 0.53, -0.03, z - 1.32], [x + 0.46, 0.5, z + 1.32], ashlar);
  const contour = [
    [0.44, -1.12],
    [2.96, -1.04],
    [3.37, -0.82],
    [3.57, -0.44],
    [3.6, 0.26],
    [3.41, 0.8],
    [3.11, 1.1],
    [0.44, 1.1],
  ];
  const profile = level > 1 ? contour : contour.filter((_, i) => ![3, 5].includes(i));
  const edges = profile.map(([y, delta]) => [y, z + delta]);
  loft(
    out,
    'stela',
    [x - 0.21, x + 0.19].map((east) => edges.map(([y, z]) => [east, y, z])),
    [0.491, 0.319, 0.234],
  );
}

function enclosure(out) {
  const floor = [0.64, 0.535, 0.361];
  const outer = site.enclosureRim.map(([x, z, height]) => [x, height, z]);
  const inner = site.enclosureRim.map(([x, z]) => [x * 0.973, -0.035, z * 0.955]);
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    face(out, 'floor', [[0, -0.035, 0], inner[i], inner[j]], floor, true);
    const halfway = [i, j].map((k) =>
      inner[k].map((v, axis) => lerp(v, outer[k][axis], axis === 1 ? 0.56 : 0.37)),
    );
    face(out, 'rock', [inner[i], inner[j], halfway[1], halfway[0]], tint(floor, 1.04), true);
    face(out, 'rock', [halfway[0], halfway[1], outer[j], outer[i]], tint(floor, 0.98), true);
  }
}

function build(out, level) {
  enclosure(out);
  body(out, level);
  paws(out, level);
  tail(out, level);
  head(out, level);
  if (level > 0) stele(out, level);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;

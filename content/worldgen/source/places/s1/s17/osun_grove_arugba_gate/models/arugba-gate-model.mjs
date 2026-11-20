import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { buildArugbaRoadside } from './arugba-roadside-model.mjs';

export const surfaces = {
  earth: { slot: 'wall', graph: 'plaster_lime', roughness: 0.98, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98, metallic: 0 },
  paving: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.87, metallic: 0.14 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.83, metallic: 0.25 },
};

const white = 'palette:#ffffff';
const clay = [0.48, 0.31, 0.255];
const shadowClay = [0.32, 0.196, 0.155];
const dampBase = [0.17, 0.16, 0.137];
const moss = [0.25, 0.32, 0.11];
const wood = [0.28, 0.205, 0.132];
const roofing = [0.4, 0.38, 0.345];
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const shade = (color, factor) => color.map((value) => value * factor);
const clamp = (v) => Math.max(0, Math.min(1, v));

// Matched silhouettes start at the lower center and run counterclockwise
// as seen from the entrance. Units are metres based on the photo proportions.
const opening = [
  [-0.3, 0.29],
  [0.32, 0.31],
  [0.67, 0.65],
  [0.75, 1.15],
  [0.88, 1.71],
  [1.04, 2.18],
  [0.98, 2.64],
  [0.76, 2.95],
  [0.35, 3.08],
  [-0.13, 3.04],
  [-0.66, 2.98],
  [-1.05, 2.84],
  [-1.28, 2.54],
  [-1.4, 2.14],
  [-1.36, 1.79],
  [-1.15, 1.5],
  [-1.25, 1.23],
  [-1.17, 0.86],
  [-0.95, 0.51],
  [-0.68, 0.36],
];
const exterior = [
  [-0.3, -0.09],
  [1.28, -0.11],
  [4.42, -0.15],
  [4.32, 0.55],
  [3.88, 0.99],
  [3.08, 1.55],
  [3.03, 2.25],
  [2.74, 2.73],
  [1.67, 3.58],
  [0.25, 4.38],
  [-0.89, 4.03],
  [-1.78, 3.58],
  [-2.58, 2.94],
  [-3.18, 2.47],
  [-3.35, 1.94],
  [-3.28, 1.45],
  [-3.21, 0.98],
  [-3.75, 0.36],
  [-3.92, -0.15],
  [-1.73, -0.1],
];

function curve(controls, t) {
  const i = Math.floor(t);
  const f = t - i;
  const sample = (offset) => controls[(i + offset + controls.length) % controls.length];
  const [a, b, c, d] = [-1, 0, 1, 2].map(sample);
  return b.map((v, j) => {
    const m = (c[j] - a[j]) * 0.5;
    const n = (d[j] - v) * 0.5;
    return v + f * (m + f * (3 * (c[j] - v) - 2 * m - n + f * (2 * (v - c[j]) + m + n)));
  });
}

const archCenter = [-0.23, 1.59];
const archAngles = [
  -1.56, -1.22, -0.8, -0.42, -0.07, 0.21, 0.49, 0.77, 1.04, 1.31, 1.57, 1.89, 2.17, 2.42, 2.61,
  2.88, 3.16, 3.44, 3.82, 4.21,
];
const cross2D = ([x, y], [u, v]) => x * v - y * u;
const contour = (profile) =>
  Array.from({ length: profile.length * 8 }, (_, i) => curve(profile, i / 8));

// Pair both contours along the same rays. Connecting unmatched control indexes
// folded the clay surface back on itself around the flared ankles and deep bowls.
function archSection(direction, boundaries) {
  return boundaries.map((points) => {
    for (const [i, a] of points.entries()) {
      const b = points[(i + 1) % points.length];
      const span = [b[0] - a[0], b[1] - a[1]];
      const fromCenter = [a[0] - archCenter[0], a[1] - archCenter[1]];
      const denominator = cross2D(direction, span);
      if (Math.abs(denominator) < 1e-10) continue;
      const along = cross2D(fromCenter, direction) / denominator;
      const radius = cross2D(fromCenter, span) / denominator;
      if (along >= 0 && along < 1 && radius > 0) {
        return [archCenter[0] + radius * direction[0], archCenter[1] + radius * direction[1]];
      }
    }
    throw new Error('Clay portal contour does not enclose its center');
  });
}

const relief = (x, y, cx, cy, rx, ry, tilt) => {
  const u = (x - cx) / rx;
  const v = (y - cy - tilt * (x - cx)) / ry;
  const radiusSquared = u * u + v * v;
  // A rolled lip casts a sharper shadow than a single smooth depression.
  return 0.17 * Math.exp(-5.8 * (radiusSquared - 1) ** 2) - Math.exp(-1.8 * radiusSquared);
};

function face([[ix, iy], [ox, oy]], width, front) {
  const x = ix + (ox - ix) * width;
  const y = iy + (oy - iy) * width;
  if (!front) {
    return [
      x * (0.77 + 0.1 * width) + 0.13,
      y * (0.84 + 0.1 * width),
      -1.78 + 0.19 * Math.cos(1.32 * x + 0.7 * y),
    ];
  }
  const leftBowl = relief(x, y, -2.28, 2.14, 0.94, 0.64, 0.51);
  const rightBowl = relief(x, y, 2.04, 2.07, 1.16, 0.59, -0.36);
  const lowerBowl = relief(x, y, 2.32, 1.04, 0.71, 0.36, -0.18);
  const crown = relief(x, y, -0.33, 3.52, 0.35, 0.48, -0.1);
  const leftTaper = relief(x, y, -2.74, 0.88, 0.71, 0.34, 0.55);
  const underLip = relief(x, y, 1.77, 1.37, 0.65, 0.18, -0.38);
  const weathering = 0.02 * Math.sin(x * 3.9 + y * 4.4) + 0.025 * Math.cos(x * 2.8 - y * 1.9);
  const baseFlare = (0.7 + 0.2 * Math.cos(1.7 * x)) * Math.exp(-2.2 * Math.max(0, y));
  const shoulder = Math.exp(-((x - 3.55) ** 2 + (y - 0.48) ** 2) / 0.31);
  const innerPier = Math.exp(-((x + 1.23) ** 2 / 0.09 + (y - 1.05) ** 2 / 0.82));
  return [
    x,
    y,
    0.63 +
      baseFlare +
      0.18 * Math.sin(1.22 * x - y) +
      weathering +
      0.54 * crown +
      0.47 * shoulder +
      0.33 * innerPier +
      0.91 * leftBowl +
      0.9 * rightBowl +
      0.51 * lowerBowl +
      0.2 * leftTaper +
      0.115 * underLip,
  ];
}

function jamb(section, t, depth, outer) {
  const front = face(section, outer ? 1 : 0, true);
  const back = face(section, outer ? 1 : 0, false);
  const point = mix(front, back, depth);
  const middle = Math.sin(Math.PI * depth);
  if (outer) return [point[0] * (1 + 0.06 * middle), point[1], point[2]];
  // The sculpted chamber narrows in staggered lobes, with a clear center.
  const rib = middle * (0.095 + 0.13 * Math.cos(depth * 10.7 + 0.56 * t) ** 2);
  const turn = middle * (0.09 + 0.1 * Math.sin(depth * 6.2 + 0.28 * t));
  return [point[0] * (1 - rib) + turn, point[1] + (1.18 - point[1]) * rib, point[2]];
}

function shellColor([x, y, z], inside) {
  const variation =
    0.5 + 0.28 * Math.sin(x * 2.6 + 0.77 * y) + 0.14 * Math.sin(x * 7.3 - 4 * y + z);
  const waterline = 0.95 + 0.25 * Math.sin(x * 3.2 - z) + 0.19 * Math.cos(x * 1.7 + z);
  const low = clamp((waterline - y) / 0.68);
  const growth = clamp(
    0.12 + 0.66 * Math.cos(x * 1.64 + 1.7 * z) + 0.22 * Math.sin(8.7 * x + 5.3 * y),
  );
  const body = mix(inside ? shade(shadowClay, 0.78) : clay, shadowClay, variation * 0.52);
  return mix(body, mix(dampBase, moss, growth), low);
}

function skin(out, sample, rows, around, reversed, inside) {
  let previous = Array.from({ length: around }, (_, i) => sample(i, 0));
  for (let row = 1; row <= rows; row++) {
    const current = Array.from({ length: around }, (_, i) => sample(i, row / rows));
    for (let i = 0; i < around; i++) {
      const k = (i + 1) % around;
      const a = previous[i];
      const b = reversed ? previous[k] : current[i];
      const c = current[k];
      const d = reversed ? current[i] : previous[k];
      const first = normalFor(a, b, c);
      const second = normalFor(a, c, d);
      const center = a.map((value, axis) => (value + b[axis] + c[axis] + d[axis]) / 4);
      const slot = center[1] < -0.04 ? 'base' : 'earth';
      const color = shellColor(center, inside);
      // Use a shared normal for gently curved cells. Keep separate normals where
      // the clay lip folds sharply so neither triangle faces away from its normal.
      const agreement = first.reduce((sum, value, axis) => sum + value * second[axis], 0);
      if (agreement > 0.15) {
        const diagonal = a.map((value, axis) => value + d[axis] - b[axis]);
        out.addQuad(slot, white, [a, b, c, d], normalFor(a, c, diagonal), [], color);
      } else {
        out.addTriangle(slot, white, [a, b, c], first, [], color);
        out.addTriangle(slot, white, [a, c, d], second, [], color);
      }
    }
    previous = current;
  }
}

function clayPortal(out, stride, rows) {
  const around = archAngles.length * stride;
  const boundaries = [contour(opening), contour(exterior)];
  const sections = Array.from({ length: around }, (_, i) => {
    const station = Math.floor(i / stride);
    const a = archAngles[station];
    const b = archAngles[station + 1] ?? archAngles[0] + 2 * Math.PI;
    const angle = a + ((b - a) * (i % stride)) / stride;
    return archSection([Math.cos(angle), Math.sin(angle)], boundaries);
  });
  skin(out, (i, r) => face(sections[i], r, true), rows, around, false, false);
  skin(out, (i, r) => face(sections[i], r, false), rows, around, true, false);
  skin(out, (i, r) => jamb(sections[i], i / stride, r, true), rows, around, false, false);
  skin(out, (i, r) => jamb(sections[i], i / stride, r, false), rows, around, true, true);
}

// The low clay return grows out of the left jamb and stops short of the path
// around its rounded end. Each station gives X, crest Z, height, and foot widths.
const lipStations = [
  [-1.68, 0.89, 0.71, 0.31, 0.36],
  [-1.16, 1.29, 1.42, 0.52, 0.26],
  [-0.94, 1.46, 1.19, 0.6, 0.24],
  [-0.62, 1.62, 0.7, 0.63, 0.23],
  [-0.24, 1.72, 0.59, 0.61, 0.21],
  [0.31, 1.79, 0.57, 0.59, 0.23],
  [0.86, 1.8, 0.55, 0.57, 0.24],
  [1.32, 1.76, 0.47, 0.43, 0.21],
  [1.61, 1.7, 0.33, 0.26, 0.15],
  [1.73, 1.65, 0.16, 0.09, 0.08],
];
const lipProfile = [
  [0, -1],
  [0.42, -0.5],
  [0.91, -0.19],
  [1, 0],
  [0.96, 0.13],
  [0.7, 0.39],
  [0.35, 0.73],
  [0, 1],
];

function forecourtLip(out, detail) {
  const controls = [lipStations[0], ...lipStations, lipStations.at(-1)];
  const steps = [6, 9, 17, 26, 35][detail];
  const profile =
    detail === 0 ? [lipProfile[0], lipProfile[3], lipProfile[6], lipProfile[7]] : lipProfile;
  const ring = (section) => {
    const [x, z, height, outer, inner] = curve(
      controls,
      1 + (section * (lipStations.length - 1)) / steps,
    );
    return profile.map(([rise, side]) => [
      x,
      -0.16 + (height + 0.16) * rise,
      z + side * (side < 0 ? inner : outer),
    ]);
  };
  const paint = ([x, y, z]) => {
    const weathering = shellColor([x + 1.25, y + 0.08, z], false);
    const mottling =
      0.72 + 0.15 * Math.sin(8.1 * x + 7.2 * z) + 0.09 * Math.cos(16.5 * x - 5.4 * y);
    const streaks = mix(dampBase, [0.34, 0.38, 0.21], clamp(mottling));
    return mix(weathering, streaks, clamp((0.58 - y) * 1.1));
  };
  let previous = ring(0);
  for (let section = 1; section <= steps; section++) {
    const current = ring(section);
    for (let i = 0; i < profile.length; i++) {
      const j = (i + 1) % profile.length;
      const points = [previous[i], previous[j], current[j], current[i]];
      out.addQuad(
        'earth',
        white,
        points,
        normalFor(...points),
        [],
        paint(mix(points[0], points[2], 0.5)),
      );
    }
    previous = current;
  }
  for (const [section, reverse] of [
    [0, true],
    [steps, false],
  ]) {
    const points = ring(section);
    if (reverse) points.reverse();
    out.addConvexPolygon('earth', white, points, normalFor(...points), [], paint(points[3]));
  }
}

// The roadside view shows the ridge falling between the two raised gable tips.
// Each station joins a point on the ridge to the corresponding point on each eave.
const roofStations = [
  [
    [-0.06, 5.5, -3.05],
    [-3.8, 2.67, -2.42],
    [3.8, 2.65, -2.56],
  ],
  [
    [-0.04, 5.13, -2.38],
    [-3.83, 2.63, -2],
    [3.83, 2.62, -2.12],
  ],
  [
    [-0.02, 4.81, -1.48],
    [-3.85, 2.59, -1.33],
    [3.84, 2.57, -1.44],
  ],
  [
    [0, 4.63, -0.45],
    [-3.85, 2.57, -0.51],
    [3.84, 2.56, -0.57],
  ],
  [
    [0.04, 4.76, 0.58],
    [-3.87, 2.61, 0.37],
    [3.87, 2.6, 0.34],
  ],
  [
    [0.08, 5.07, 1.46],
    [-3.9, 2.68, 1.04],
    [3.89, 2.68, 0.98],
  ],
  [
    [0.13, 5.48, 2.23],
    [-3.92, 2.76, 1.58],
    [3.93, 2.79, 1.47],
  ],
  [
    [0.18, 5.91, 2.92],
    [-3.94, 2.84, 1.98],
    [3.95, 2.91, 1.88],
  ],
];

function roofFace(out, slot, points, color) {
  for (const indices of [
    [0, 1, 2],
    [0, 2, 3],
  ]) {
    const tri = indices.map((index) => points[index]);
    out.addTriangle(slot, white, tri, normalFor(...tri), [], color);
  }
}

const lowered = ([x, y, z], depth) => [x, y - depth, z];
const reverseWinding = ([a, b, c, d]) => [a, d, c, b];

function soffitReeds(out, [ridgeA, ridgeB, eaveB, eaveA], depth, detail) {
  const count = [0, 0, 2, 12, 17][detail];
  // Reed courses change direction at the panel diagonal, as under the photographed gable.
  for (const [pivot, left, right] of [
    [eaveB, ridgeB, ridgeA],
    [ridgeA, eaveA, eaveB],
  ]) {
    for (let i = 1; i <= count; i++) {
      const t = (i - 0.28) / count;
      const a = lowered(mix(pivot, left, t), depth + 0.022);
      const b = lowered(mix(pivot, right, t), depth + 0.022);
      const color = shade(wood, 0.91 + 0.19 * Math.cos(i * 1.79));
      if (detail >= 3) {
        beam(out, 'timber', a, b, 0.035, 0.03, color);
      } else {
        const strip = [
          a,
          b,
          lowered(mix(pivot, right, t + 0.043), depth + 0.022),
          lowered(mix(pivot, left, t + 0.043), depth + 0.022),
        ];
        roofFace(out, 'timber', normalFor(...strip)[1] > 0 ? reverseWinding(strip) : strip, color);
      }
    }
  }
}

function shelter(out, rafters, detail) {
  const depth = 0.054;
  for (const sign of [-1, 1]) {
    const edge = sign === -1 ? 1 : 2;
    const ordered = (points) => (sign > 0 ? points : reverseWinding(points));
    for (let i = 1; i < roofStations.length; i++) {
      const [ridgeA, eaveA] = [roofStations[i - 1][0], roofStations[i - 1][edge]];
      const [ridgeB, eaveB] = [roofStations[i][0], roofStations[i][edge]];
      const top = ordered([ridgeA, ridgeB, eaveB, eaveA]);
      const bottom = reverseWinding(top.map((point) => lowered(point, depth)));
      // Keep flute direction and spacing coherent across the folded sheets.
      const uv = ordered([
        [ridgeA[2], 0],
        [ridgeB[2], 0],
        [ridgeB[2], 4.6],
        [ridgeA[2], 4.6],
      ]);
      out.addQuad(
        'roof',
        'metric:uv',
        top,
        normalFor(...top),
        uv,
        shade(roofing, 0.91 + 0.1 * Math.cos(i * 1.71 + sign)),
      );
      roofFace(out, 'timber', bottom, shade(wood, 0.86));
      if (detail >= 2) soffitReeds(out, [ridgeA, ridgeB, eaveB, eaveA], depth, detail);
      if (detail >= 3)
        beam(
          out,
          'timber',
          lowered(ridgeA, depth + 0.032),
          lowered(eaveB, depth + 0.032),
          0.075,
          0.067,
          shade(wood, 0.82),
        );
      roofFace(
        out,
        'timber',
        ordered([eaveA, eaveB, lowered(eaveB, depth), lowered(eaveA, depth)]),
        wood,
      );
    }
    const first = roofStations[0];
    const last = roofStations.at(-1);
    for (const [a, b] of [
      [first[0], first[edge]],
      [last[edge], last[0]],
    ]) {
      roofFace(out, 'timber', ordered([a, b, lowered(b, depth), lowered(a, depth)]), wood);
      beam(out, 'timber', lowered(a, depth + 0.035), lowered(b, depth + 0.035), 0.1, 0.105, wood);
    }
    for (let i = 1; i < rafters; i++) {
      const station = (i * (roofStations.length - 1)) / rafters;
      const index = Math.floor(station);
      const alpha = station - index;
      const ridge = mix(roofStations[index][0], roofStations[index + 1][0], alpha);
      const eave = mix(roofStations[index][edge], roofStations[index + 1][edge], alpha);
      const fold = mix(roofStations[index][0], roofStations[index + 1][edge], alpha);
      // The rafters follow the two sheet triangles so they stay beneath the skin.
      beamPath(
        out,
        'timber',
        [ridge, fold, eave].map((point) => lowered(point, depth + 0.045)),
        0.082,
        0.094,
        shade(wood, 0.7 + 0.18 * Math.sin(i * 1.6)),
      );
    }
    beamPath(
      out,
      'timber',
      roofStations.map((station) => lowered(station[edge], 0.085)),
      0.12,
      0.12,
      shade(wood, 0.73),
    );
  }
  beamPath(
    out,
    'timber',
    roofStations.map(([ridge]) => lowered(ridge, 0.1)),
    0.15,
    0.16,
    shade(wood, 0.78),
  );
}

function build(out, stride, rows, rafters, detail) {
  clayPortal(out, stride, rows);
  forecourtLip(out, detail);
  shelter(out, rafters, detail);
  buildArugbaRoadside(out, detail);
}

export const buildArugbaGate = (out) => build(out, 7, 32, 42, 4);
export const buildCloseup = (out) => build(out, 6, 27, 34, 3);
export const buildStreet = (out) => build(out, 3, 15, 16, 2);
export const buildDistrict = (out) => build(out, 2, 5, 8, 1);
export const buildSkyline = (out) => build(out, 1, 2, 1, 0);

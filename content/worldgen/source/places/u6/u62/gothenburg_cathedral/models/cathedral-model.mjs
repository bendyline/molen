/** Exterior of Gustavi Domkyrka in December 2025. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B,
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const mapFrame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const {
  foundationBottom,
  plinthTop,
  wallEaves,
  naveRidge,
  westBaseTop,
  squareTowerTop,
  clockStageTop,
  towerTop,
} = plan.section;
const centerX = 0.79;
const towerZ = 21.5;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.87, metallic: 0 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.89, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.11 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.03 },
};
const tone = Object.fromEntries(
  Object.entries({
    stone: 'cfc5ae',
    trim: 'e1d7c1',
    shade: 'b6aa91',
    base: '99948a',
    roof: '585b56',
    metal: '414844',
    copper: '557d70',
    surround: 'aeaa94',
    glazing: '475f65',
    louver: '343b39',
    door: '5b4e3b',
    gold: 'b49852',
    clock: '333a38',
  }).map(([name, color]) => [name, rgb(color)]),
);

function face(out, slot, points, outward, color = tone[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, component, i) => dot + component * outward[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
}

function volume(out, slot, ring, low, high, color) {
  const triangulation = new MeshBufferBuilder();
  poly(triangulation, slot, ring, low, high, color);
  const { indices, positions, normals } = triangulation.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const points = Array.from(indices.slice(i, i + 3), (index) =>
      Array.from(positions.slice(index * 3, index * 3 + 3)),
    );
    const normal = Array.from(normals.slice(indices[i] * 3, indices[i] * 3 + 3));
    face(out, slot, points, normal, color);
  }
}

const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const point = ([x, z], y) => [x, y, z];
function edge([x, z], [endX, endZ], orientation = 1) {
  const length = Math.hypot(endX - x, endZ - z);
  const u = (endX - x) / length,
    v = (endZ - z) / length;
  const nx = -v * orientation,
    nz = u * orientation;
  return {
    length,
    normal: [nx, 0, nz],
    at: (s, y, d = 0) => [x + s * u + d * nx, y, z + s * v + d * nz],
  };
}
function edges(ring) {
  const area = ring.reduce((sum, [x, z], i) => {
    const [nx, nz] = ring[(i + 1) % ring.length];
    return sum + x * nz - z * nx;
  }, 0);
  return ring.map((p, i) => edge(p, ring[(i + 1) % ring.length], area > 0 ? -1 : 1));
}
function panel(out, slot, side, left, right, low, high, depth, color = tone[slot]) {
  const { at, normal } = side;
  face(
    out,
    slot,
    [at(left, low, depth), at(right, low, depth), at(right, high, depth), at(left, high, depth)],
    normal,
    color,
  );
}
function course(out, side, y, height, depth, color = tone.trim) {
  panel(out, 'trim', side, 0, side.length, y, y + height, depth, color);
}

function disk(out, side, x, y, radius, depth, slot, color, count) {
  const { at, normal } = side;
  const middle = at(x, y, depth);
  for (let i = 0; i < count; i++) {
    const p = (j) => {
      const a = (j * Math.PI * 2) / count;
      return at(x + radius * Math.cos(a), y + radius * Math.sin(a), depth);
    };
    face(out, slot, [middle, p(i), p(i + 1)], normal, color);
  }
}

function arch(out, side, x, low, width, spring, rise, depth, slot, color, count) {
  const { at, normal } = side;
  const radius = width / 2;
  panel(out, slot, side, x - radius, x + radius, low, spring, depth, color);
  const p = (i) => {
    const a = (i * Math.PI) / count;
    return at(x + radius * Math.cos(a), spring + rise * Math.sin(a), depth);
  };
  for (let i = 0; i < count; i++)
    face(out, slot, [at(x, spring, depth), p(i), p(i + 1)], normal, color);
}

function tallBay(out, side, x, width, lod) {
  if (lod === 0) {
    panel(out, 'glazing', side, x - width * 0.39, x + width * 0.39, 2.95, 8.12, 0.077);
    disk(out, side, x, 12.23, 0.62, 0.052, 'glazing', tone.glazing, 6);
    return;
  }
  const segments = lod >= 3 ? 10 : 6;
  arch(out, side, x, 2.25, width + 0.28, 9.0, 1.32, 0.046, 'trim', tone.trim, segments);
  arch(out, side, x, 2.43, width, 8.96, 1.17, 0.059, 'stone', tone.surround, segments);
  panel(out, 'glazing', side, x - width * 0.39, x + width * 0.39, 2.95, 8.12, 0.077);
  disk(out, side, x, 12.23, 0.79, 0.035, 'trim', tone.trim, segments + 2);
  disk(out, side, x, 12.23, 0.62, 0.052, 'glazing', tone.glazing, segments + 2);
  if (lod >= 2) {
    panel(out, 'trim', side, x - 0.044, x + 0.044, 2.95, 8.12, 0.091, tone.shade);
    for (const y of [4.58, 6.22, 7.33])
      panel(out, 'trim', side, x - width * 0.39, x + width * 0.39, y, y + 0.055, 0.094, tone.shade);
  }
}
function squareBay(out, side, x, y, width, height) {
  panel(
    out,
    'trim',
    side,
    x - width / 2 - 0.12,
    x + width / 2 + 0.12,
    y - 0.12,
    y + height + 0.15,
    0.055,
  );
  panel(out, 'glazing', side, x - width / 2, x + width / 2, y, y + height, 0.076);
  panel(out, 'trim', side, x - width / 2 - 0.2, x + width / 2 + 0.2, y - 0.19, y - 0.05, 0.105);
}

function roof(out, corners, ridgeA, ridgeB, y, ridgeHeight, color = tone.roof) {
  const a = point(ridgeA, ridgeHeight),
    b = point(ridgeB, ridgeHeight);
  face(out, 'roof', [point(corners[0], y), point(corners[1], y), b, a], [0, 1, 0], color);
  face(out, 'roof', [point(corners[1], y), point(corners[2], y), b], [0, 1, 0], color);
  face(out, 'roof', [point(corners[2], y), point(corners[3], y), a, b], [0, 1, 0], color);
  face(out, 'roof', [point(corners[3], y), point(corners[0], y), a], [0, 1, 0], color);
}

function nave(out, footprint, lod) {
  const front = [footprint[7], [6.34, 26.2], [-5.36, 26.2], footprint[9]];
  const annex = [...footprint.slice(16, 19), [-11.74, -6.69]];
  const walls = [
    ...footprint.slice(0, 7),
    ...front,
    ...footprint.slice(10, 16),
    [footprint[18][0], footprint[15][1]],
    ...footprint.slice(18),
  ];
  volume(out, 'stone', footprint, foundationBottom, plinthTop, tone.base);
  volume(out, 'stone', walls, plinthTop, wallEaves, tone.stone);

  for (const side of edges(walls)) {
    if (lod) course(out, side, wallEaves - 0.62, 0.41, 0.095);
    course(out, side, wallEaves - 0.22, 0.23, 0.21);
    if (lod) course(out, side, plinthTop + 0.08, 0.23, 0.065, tone.shade);
  }
  const bayCounts = new Map([
    [0, 2],
    [1, 1],
    [2, 2],
    [3, 1],
    [4, 1],
    [5, 2],
    [11, 2],
    [12, 1],
    [13, 1],
    [14, 1],
    [15, 1],
    [16, 1],
    [18, 1],
    [20, 1],
    [22, 1],
    [24, 1],
    [26, 1],
  ]);
  for (const [i, side] of edges(walls).entries()) {
    const bays = bayCounts.get(i) ?? 0;
    if (!bays || side.length < 2.9) continue;
    const spacing = side.length / bays;
    for (let j = 0; j < bays; j++)
      tallBay(out, side, spacing * (j + 0.5), Math.min(2.65, spacing * 0.69), lod);
  }
  for (const [a, b] of [
    [footprint[6], footprint[7]],
    [footprint[9], footprint[10]],
  ]) {
    const side = edge(a, b, -1);
    const x = side.length / 2;
    squareBay(out, side, x, 2.8, 1.56, 3.4);
    squareBay(out, side, x, 8.2, 1.58, 3.3);
  }

  roof(
    out,
    rect(-12.04, 13.09, -19.15, 28.3),
    [centerX, -15.1],
    [centerX, 22.1],
    wallEaves,
    naveRidge,
  );
  roof(
    out,
    [
      [-20.73, -7.1],
      [20.92, -7.1],
      [20.92, 7.89],
      [-20.73, 7.89],
    ],
    [-15.68, 0.27],
    [15.94, 0.27],
    wallEaves,
    20.63,
  );
  const apse = [...footprint.slice(19), footprint[0]];
  const crown = [centerX, 18.0, -18.55];
  for (let i = 0; i + 1 < apse.length; i++)
    face(out, 'roof', [point(apse[i], wallEaves), point(apse[i + 1], wallEaves), crown], [0, 1, 0]);

  volume(out, 'stone', annex, plinthTop, 4.52, tone.stone);
  for (const side of edges(annex)) course(out, side, 4.23, 0.32, 0.13);
  const annexTop = [-14.08, 5.91, -8.53];
  for (let i = 0; i < annex.length; i++)
    face(
      out,
      'metal',
      [point(annex[i], 4.56), point(annex[(i + 1) % annex.length], 4.56), annexTop],
      [0, 1, 0],
      tone.copper,
    );
  const annexFront = edges(annex)[0];
  squareBay(out, annexFront, annexFront.length / 2, 1.3, 0.92, 2.22);
}

function profile(out, slot, x, z, sections, count, color, phase = 0) {
  const radial = (i, y, radius) => {
    const a = phase + (i * Math.PI * 2) / count;
    return [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
  };
  for (let level = 0; level < sections.length - 1; level++) {
    const [low, r0] = sections[level],
      [high, r1] = sections[level + 1];
    for (let i = 0; i < count; i++) {
      const first = radial(i, low, r0),
        second = radial(i + 1, low, r0);
      const third = radial(i + 1, high, r1);
      const outside = [(first[0] + second[0]) / 2 - x, 0, (first[2] + second[2]) / 2 - z];
      const vertices =
        r1 === 0 ? [first, second, third] : [first, second, third, radial(i, high, r1)];
      face(out, slot, vertices, outside, color);
    }
  }
}

function portico(out, lod) {
  for (let i = 0; i < 3; i++)
    B(
      out,
      'trim',
      centerX,
      -0.54,
      30.03 - i * 0.28,
      13.25 - i * 0.3,
      0.72 + i * 0.24,
      3.13 - i * 0.24,
      tone.base,
    );
  B(out, 'trim', centerX, 12.46, 28.0, 13.56, 0.98, 4.14, tone.trim);
  B(out, 'trim', centerX, 13.32, 28.0, 14.22, 0.34, 4.43, tone.trim);
  const left = centerX - 7.14,
    right = centerX + 7.14,
    front = 30.21,
    rear = 25.91;
  const lo = 13.65,
    hi = 17.15;
  face(
    out,
    'stone',
    [
      [left, lo, front],
      [right, lo, front],
      [centerX, hi, front],
    ],
    [0, 0, 1],
    tone.shade,
  );
  for (const x of [left, right]) {
    face(
      out,
      'roof',
      [
        [x, lo, front],
        [x, lo, rear],
        [centerX, hi, rear],
        [centerX, hi, front],
      ],
      [0, 1, 0],
    );
    beam(out, 'trim', [x, lo, front + 0.1], [centerX, hi, front + 0.1], 0.32, 0.29, tone.trim);
  }

  for (const x of [-5.08, -1.7, 1.7, 5.08].map((n) => n + centerX)) {
    if (lod === 0) {
      profile(
        out,
        'trim',
        x,
        29.15,
        [
          [0.67, 0.68],
          [12.2, 0.56],
        ],
        6,
        tone.trim,
      );
      B(out, 'trim', x, 12.18, 29.15, 1.42, 0.31, 1.37, tone.trim);
      continue;
    }
    B(out, 'trim', x, 0.67, 29.15, 1.57, 0.39, 1.57, tone.base);
    profile(
      out,
      'trim',
      x,
      29.15,
      [
        [1.06, 0.68],
        [1.31, 0.73],
        [1.58, 0.59],
        [11.8, 0.49],
        [12.29, 0.64],
      ],
      lod >= 2 ? 14 : 8,
      tone.trim,
    );
    B(out, 'trim', x, 12.18, 29.15, 1.42, 0.31, 1.37, tone.trim);
  }
  const door = edge([-5.36, 26.2], [6.34, 26.2]);
  const x = door.length * 0.526;
  arch(out, door, x, 0.73, 3.66, 6.6, 1.64, 0.055, 'trim', tone.trim, 10);
  arch(out, door, x, 0.73, 2.74, 6.35, 1.36, 0.078, 'glazing', tone.door, 10);
  squareBay(out, door, x, 9.19, 2.13, 1.58);
}

function clock(out, side, x, y, lod) {
  if (lod === 0) {
    disk(out, side, x, y, 1.22, 0.115, 'metal', tone.gold, 8);
    return;
  }
  const segments = lod >= 2 ? 20 : 12;
  disk(out, side, x, y, 1.26, 0.115, 'metal', tone.gold, segments);
  disk(out, side, x, y, 1.11, 0.133, 'glazing', tone.clock, segments);
  for (const [dx, dy] of [
    [-0.44, 0.48],
    [0.34, 0.75],
  ])
    beam(
      out,
      'metal',
      side.at(x, y, 0.155),
      side.at(x + dx, y + dy, 0.155),
      0.069,
      0.062,
      tone.gold,
    );
  if (lod >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        dx = Math.cos(a),
        dy = Math.sin(a);
      beam(
        out,
        'metal',
        side.at(x + 0.85 * dx, y + 0.85 * dy, 0.155),
        side.at(x + 1.01 * dx, y + 1.01 * dy, 0.155),
        0.051,
        0.046,
        tone.gold,
      );
    }
}

function tower(out, lod) {
  const base = rect(-7.7, 9.27, 13.17, 28.54);
  const square = rect(-4.97, 6.55, 15.78, 27.23);
  volume(out, 'stone', base, wallEaves - 0.46, westBaseTop, tone.stone);
  for (const side of edges(base)) {
    course(out, side, westBaseTop - 0.34, 0.33, 0.23);
    course(out, side, westBaseTop - 0.83, 0.33, 0.12);
    if (lod) squareBay(out, side, side.length * 0.52, 17.52, 1.55, 1.74);
  }
  B(out, 'metal', centerX, westBaseTop - 0.015, towerZ, 17.38, 0.21, 15.58, tone.roof);
  volume(out, 'stone', square, westBaseTop, squareTowerTop, tone.stone);
  for (const side of edges(square)) {
    course(out, side, squareTowerTop - 0.55, 0.55, 0.38);
    course(out, side, squareTowerTop - 0.98, 0.24, 0.17, tone.shade);
    for (const offset of [0.27, 0.5, 0.73]) {
      const x = side.length * offset;
      if (lod === 0) {
        panel(out, 'glazing', side, x - 0.62, x + 0.62, 27.31, 31.59, 0.066, tone.louver);
        continue;
      }
      arch(out, side, x, 27.12, 1.59, 30.98, 0.87, 0.051, 'trim', tone.shade, 8);
      arch(out, side, x, 27.31, 1.24, 30.94, 0.65, 0.066, 'glazing', tone.louver, 8);
      if (lod >= 2)
        for (const y of [28.32, 29.14, 29.96, 30.78])
          panel(out, 'metal', side, x - 0.62, x + 0.62, y, y + 0.065, 0.077, tone.metal);
    }
    if (lod) squareBay(out, side, side.length / 2, 22.65, 1.09, 2.66);
  }

  const chamfer = [
    [-3.44, 5.08],
    [3.44, 5.08],
    [5.08, 3.44],
    [5.08, -3.44],
    [3.44, -5.08],
    [-3.44, -5.08],
    [-5.08, -3.44],
    [-5.08, 3.44],
  ];
  const upper = chamfer.map(([x, z]) => [centerX + x, towerZ + z]);
  volume(out, 'metal', upper, squareTowerTop - 0.045, clockStageTop, tone.metal);
  for (const side of edges(upper)) {
    panel(
      out,
      'metal',
      side,
      0,
      side.length,
      clockStageTop - 0.32,
      clockStageTop + 0.065,
      0.12,
      tone.copper,
    );
    if (side.length < 4) continue;
    const x = side.length / 2;
    if (lod) arch(out, side, x, 36.28, 2.57, 39.48, 0.74, 0.055, 'glazing', tone.louver, 8);
    clock(out, side, x, 42.24, lod);
    if (lod)
      for (const s of [0.28, side.length - 0.41])
        panel(out, 'metal', side, s, s + 0.14, 36.03, 43.9, 0.065, tone.copper);
  }

  profile(
    out,
    'metal',
    centerX,
    towerZ,
    lod === 0
      ? [
          [44.39, 6.24],
          [45.3, 5.41],
          [47.3, 3.94],
          [48.14, 2.15],
        ]
      : [
          [44.39, 6.24],
          [44.84, 6.19],
          [45.3, 5.41],
          [46.12, 4.99],
          [47.3, 3.94],
          [47.86, 3.16],
          [48.14, 2.15],
        ],
    8,
    tone.metal,
    Math.PI / 8,
  );
  profile(
    out,
    'metal',
    centerX,
    towerZ,
    lod === 0
      ? [
          [48.1, 1.96],
          [49.62, 1.19],
          [50.17, 1.44],
          [51.79, 0.34],
        ]
      : [
          [48.1, 1.96],
          [48.54, 1.58],
          [49.62, 1.19],
          [49.88, 1.37],
          [50.17, 1.44],
          [50.7, 1.29],
          [51.17, 0.74],
          [51.79, 0.34],
        ],
    8,
    tone.copper,
    Math.PI / 8,
  );
  profile(
    out,
    'metal',
    centerX,
    towerZ,
    lod === 0
      ? [
          [51.72, 0.31],
          [52.11, 0.38],
          [towerTop, 0],
        ]
      : [
          [51.72, 0.31],
          [52.11, 0.38],
          [52.47, 0.22],
          [towerTop, 0],
        ],
    8,
    tone.gold,
  );
}

function build(out, frame = mapFrame, lod = 3) {
  nave(out, frame.geometry.polygons[0], lod);
  portico(out, lod);
  tower(out, lod);
}
export const cathedralSkyline = (out, frame) => build(out, frame, 0);
export const cathedralDistrict = (out, frame) => build(out, frame, 1);
export const cathedralStreet = (out, frame) => build(out, frame, 2);
export const cathedralCloseup = (out, frame) => build(out, frame, 3);

const recipe = 'cathedral-model.mjs';
const camera = [-76, 51, 92],
  lookAt = [1, 21, 1];
export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The classical pale stone cathedral, recessed west entrance and portico, dark 52.85-meter clock tower, transepts and rounded east apse.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: mapFrame.geometry.polygons[0],
    minimumCoverage: 0.96,
    basis: 'The named mapped cathedral outline identifies the dated structure.',
  },
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'stone_sandstone', 'slate', 'metal_painted'],
  qaCameras: [
    { name: 'west-portico-and-tower', position: [-30, 17, 72], lookAt: [0, 23, 19] },
    { name: 'clock-and-cupola', position: [38, 36, 63], lookAt: [1, 42, 22] },
    { name: 'apse-and-oculi', position: [-45, 14, -64], lookAt: [0, 10, -16] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-gothenburg-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 0.25,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'cathedralDistrict', 0.12],
        ['street', 'cathedralStreet', 0.05],
        ['closeup', 'cathedralCloseup', 0.017],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. DKjellby dedicated the west view under CC0 and D.O.G.A. dedicated the east views to the public domain. OpenStreetMap contributors supply the footprint under ODbL.',
};

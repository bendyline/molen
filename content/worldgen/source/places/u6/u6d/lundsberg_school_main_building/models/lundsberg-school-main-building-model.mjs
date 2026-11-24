import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const colors = {
  plaster: rgb('d4ae74'),
  secondary: rgb('c39e68'),
  braces: rgb('695b49'),
  stone: rgb('56504a'),
  trim: rgb('76624b'),
  wood: rgb('655242'),
  glass: rgb('566470'),
  glassLight: rgb('647078'),
  tile: rgb('573e3b'),
  tileEdge: rgb('6d5148'),
  copper: rgb('777568'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_granite', roughness: 0.92 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.88 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.81 },
  flashing: { slot: 'trim', graph: 'metal_painted', roughness: 0.72 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43 },
};
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const blocks = [
  {
    left: -26.98,
    right: 28.45,
    back: -6.44,
    front: 6.56,
    y: 0.9,
    eaves: 9.5,
    ridge: 14.2,
    axis: 'x',
  },
  {
    left: -26.98,
    right: -14.71,
    back: -10.08,
    front: 9.45,
    y: 3.76,
    eaves: 10.35,
    ridge: 15.8,
    axis: 'z',
  },
  {
    left: 27.05,
    right: 37.83,
    back: -14.76,
    front: 18.7,
    y: -2.2,
    eaves: 10.64,
    ridge: 16.7,
    axis: 'z',
  },
  {
    left: -38.12,
    right: -26.98,
    back: -4.21,
    front: 1.49,
    y: 4.7,
    eaves: 8.4,
    ridge: 10.65,
    axis: 'x',
  },
  {
    left: -35.39,
    right: -26.98,
    back: -11.31,
    front: -4.21,
    y: 4.96,
    eaves: 8.88,
    ridge: 11.7,
    axis: 'z',
  },
  {
    left: -49.28,
    right: -29.25,
    back: -24.23,
    front: -11.3,
    y: 5.46,
    eaves: 10.8,
    ridge: 14.5,
    axis: 'x',
  },
];

function gable(out, a, b, width, eave, ridge, level, color = colors.tile) {
  gableRoof(out, 'roof', a, b, width, eave, ridge, color, {
    overhang: 0.26,
    endSlot: 'wall',
    endColor: colors.plaster,
  });
  const f = wallFace(a, b);
  beam(
    out,
    'roof',
    f.P(-0.29, ridge, 0),
    f.P(f.length + 0.29, ridge, 0),
    0.14,
    0.15,
    colors.tileEdge,
  );
  for (const direction of [-1, 1]) {
    const end = direction * (width / 2 + 0.25);
    const y = eave - (0.25 * (ridge - eave)) / (width / 2);
    beam(
      out,
      'flashing',
      f.P(-0.25, y, end),
      f.P(f.length + 0.25, y, end),
      0.085,
      0.1,
      colors.copper,
    );
    for (const u of [-0.24, f.length + 0.24]) {
      beam(out, 'trim', f.P(u, y - 0.055, end), f.P(u, ridge - 0.055, 0), 0.12, 0.16, colors.wood);
    }
    const rows = [0, 0, 5, 12][level];
    for (let i = 1; i < rows; i++) {
      const t = i / rows;
      const h = y + (ridge - y) * t + 0.021,
        offset = end * (1 - t);
      beam(
        out,
        'roof',
        f.P(-0.22, h, offset),
        f.P(f.length + 0.22, h, offset),
        0.042,
        0.045,
        colors.tileEdge,
      );
    }
  }
}

function volume(out, block, level) {
  const { left, right, back, front, y, eaves, ridge, axis } = block;
  const outline = rect(left, right, back, front);
  const footingTop = y + 0.62;
  extrude(out, 'stone', outline, y - 2.7, footingTop, colors.stone, { top: false });
  extrude(out, 'wall', outline, footingTop, eaves, colors.plaster, { top: false });
  const centerX = (left + right) / 2,
    centerZ = (front + back) / 2;
  const ends =
    axis === 'x'
      ? [[left, centerZ], [right, centerZ], front - back]
      : [[centerX, back], [centerX, front], right - left];
  gable(out, ...ends, eaves, ridge, level);
}

function window(out, f, u, base, width, height, level, light = false) {
  const glass = light ? colors.glassLight : colors.glass;
  if (level === 0) {
    const pad = width / 2;
    quad4(
      out,
      'glass',
      f.P(u - pad, base, 0.035),
      f.P(u + pad, base, 0.035),
      f.P(u + pad, base + height, 0.035),
      f.P(u - pad, base + height, 0.035),
      glass,
    );
    return;
  }
  opening(out, f, u, base, width, height, {
    glass,
    frame: colors.trim,
    mullionColor: colors.braces,
    frameWidth: 0.105,
    frameDepth: 0.12,
    sill: level > 1,
    mullions: level < 2 ? 0 : width > 2 ? 2 : 1,
    transoms: level === 3 ? (height > 1.8 ? 3 : 1) : 0,
  });
}

function row(out, f, positions, base, width, height, level) {
  for (const [i, u] of positions.entries()) {
    if (level === 0 && i % 2 === 1 && positions.length > 5) continue;
    window(out, f, u, base, width, height, level, i % 4 === 2);
  }
}

function teachingWing(out, level) {
  const front = facade([0, 6.56], [1, 0]);
  row(out, front, [-11.3, -8, -4.8, -1.5, 2, 5.4, 8.8, 12.2, 15.6, 23.8], 4.42, 1.45, 2.02, level);
  row(
    out,
    front,
    [-11.2, -7.8, -4.4, -1, 2.4, 5.8, 9.2, 12.6, 16, 20.2, 24],
    7.0,
    1.58,
    1.78,
    level,
  );
  row(out, front, [0, 3.4, 6.8, 10.2, 13.6, 16.6, 24], 1.72, 1.23, 1.63, level);
  const rear = facade([0, -6.44], [-1, 0]);
  row(out, rear, [-24, -20, -16, -12, -8, -4, 0, 4, 8, 12], 4.27, 1.37, 1.95, level);
  row(out, rear, [-24, -20, -16, -12, -8, -4, 0, 4, 8, 12], 7.2, 1.5, 1.86, level);

  const x = 20.2;
  window(out, front, x, 0.38, 1.47, 2.3, level);
  abox(out, 'trim', [x - 0.55, 0.33, 6.585], [x + 0.55, 2.68, 6.69], colors.wood);
  const shade = [
    [x - 1.17, 3.13, 6.54],
    [x - 1.17, 2.86, 7.54],
    [x + 1.17, 2.86, 7.54],
    [x + 1.17, 3.13, 6.54],
  ];
  quad4(out, 'roof', ...shade, colors.tileEdge);
  if (level >= 1) {
    for (let step = 0; step < 3; step++) {
      abox(
        out,
        'stone',
        [x - 0.94, -0.28, 6.52],
        [x + 0.94, (step + 1) * 0.13, 7.76 - step * 0.27],
        colors.stone,
      );
    }
    for (const side of [-1, 1]) {
      const u = x + side * 1.08;
      beam(out, 'trim', [u, 2.3, 6.58], [u, 2.86, 7.47], 0.105, 0.105, colors.wood);
    }
  }
}

function schoolWing(out, level) {
  const right = facade([37.83, 0], [0, -1]);
  const court = facade([0, 18.7], [1, 0]);
  const west = facade([27.05, 0], [0, 1]);
  const rear = facade([0, -14.76], [-1, 0]);
  const eastWing = rect(27.05, 37.83, -14.76, 18.7);
  extrude(
    out,
    'stone',
    eastWing.map(([x, z]) => [x + (x < 32 ? -0.025 : 0.025), z + (z < 0 ? -0.025 : 0.025)]),
    3.0,
    3.38,
    colors.stone,
    { top: false },
  );
  for (const [f, centers] of [
    [court, [29.4, 32.45, 35.42]],
    [right, [-14.5, -10.1, -5.78, 1.0, 6.1, 11.2]],
    [rear, [-35.6, -32.6, -29.52]],
    [west, [-11.6, 9.0, 12.8, 16.53]],
  ]) {
    row(out, f, centers, 0.12, 1.17, 2.32, level);
    row(out, f, centers, 4.12, 1.47, 2.13, level);
    row(out, f, centers, 7.77, 1.58, 2.04, level);
  }
  window(out, court, 32.5, 9.71, 2.95, 2.65, level, true);
  if (level > 0) {
    window(out, court, 32.5, 13.28, 0.8, 1.23, level);
    window(out, rear, -32.4, 11.7, 1.3, 1.57, level);
    fbox(out, 'trim', court, 30.87, 34.13, 9.49, 9.64, 0.01, 0.24, colors.wood);
  }
  // The flank gable carries the tall faceted timber oriel in the original court view.
  const f = wallFace([35.98, -0.92], [38.05, -0.92]);
  gable(out, [34.35, -0.92], [37.84, -0.92], 5.32, 10.62, 15.1, level);
  const outline = outwardRing([
    [37.81, -3.1],
    [37.81, 1.27],
    [38.75, 1.11],
    [39.26, 0.27],
    [39.26, -1.84],
    [38.73, -2.94],
  ]);
  extrude(out, 'trim', outline, 2.78, 10.62, colors.braces, { top: false });
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    if ((a[0] + b[0]) / 2 > 38.1) {
      const pane = wallFace(a, b);
      for (const h of [3.16, 5.66, 8.03])
        window(out, pane, pane.length / 2, h, pane.length * 0.78, 2.14, level);
    }
    tri(out, 'roof', [a[0], 10.62, a[1]], [b[0], 10.62, b[1]], f.P(0.8, 12.16, 0), colors.tile);
  }
}

function westWing(out, level) {
  const f = facade([0, 9.45], [1, 0]);
  row(out, f, [-24.55, -21, -17.36], 4.66, 1.25, 1.58, level);
  row(out, f, [-24.55, -21, -17.36], 7.53, 1.48, 1.85, level);
  window(out, f, -21, 11.5, 1.63, 1.57, level);
  const west = facade([-26.98, 0], [0, 1]);
  row(out, west, [3.64, 7.3], 6.22, 1.26, 1.93, level);
  const lower = facade([0, -11.3], [1, 0]);
  row(out, lower, [-46, -42.3, -38.6, -35], 6.45, 1.55, 2.38, level);
  const back = facade([0, -24.23], [-1, 0]);
  row(out, back, [32.1, 36.1, 40.1, 44.1, 47.5], 7.0, 1.43, 2.12, level);
  if (level >= 1) {
    for (const x of [-42.2, -20.8, 10.5, 30.1]) {
      const z = x < -29 ? -17.5 : x > 25 ? -8 : 0.3;
      const base = x < -29 ? 13 : x > 25 ? 15 : 13.3;
      abox(
        out,
        'wall',
        [x - 0.32, base, z - 0.35],
        [x + 0.32, base + 1.76, z + 0.35],
        colors.secondary,
      );
      abox(
        out,
        'stone',
        [x - 0.4, base + 1.67, z - 0.43],
        [x + 0.4, base + 1.83, z + 0.43],
        colors.stone,
      );
    }
  }
}

function build(out, level) {
  for (const block of blocks) volume(out, block, level);
  teachingWing(out, level);
  schoolWing(out, level);
  westWing(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'lundsberg-school-main-building-model.mjs';
const camera = [70, 26, 79],
  lookAt = [-4, 7.4, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  category: 'school',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Lundsberg’s National Romantic schoolhouse, with plaster walls, a granite footing and steep tiled gables.',
  camera,
  lookAt,
  sunDirection: [-26, 39, 56],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.83,
    basis:
      'Native perimeter of the main school building, with the adjoining church left outside the cutout.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_granite',
    'tile_flat',
    'wood_plain',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'schoolhouse-and-original-hillside', position: [74, 22, 80], lookAt: [-6, 7.1, 0] },
    { name: 'court-elevation-and-entry-canopy', position: [16, 9, 48], lookAt: [14, 7.3, 8] },
    { name: 'steep-gables-timber-oriel', position: [57, 14.5, 25], lookAt: [33.5, 8.2, 9.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'lundsberg-school-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.84,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.37, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, OpenStreetMap geometry under ODbL and Mapzen elevations under source attribution terms.',
};

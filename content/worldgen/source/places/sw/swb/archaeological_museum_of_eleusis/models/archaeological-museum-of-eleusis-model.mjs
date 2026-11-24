import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const colors = {
  plaster: rgb('ddd4bc'),
  east: rgb('e1d9c8'),
  stone: rgb('c5b295'),
  roof: rgb('a66d53'),
  roofShadow: rgb('925940'),
  cornice: rgb('c9c0a8'),
  frame: rgb('434a41'),
  glazing: rgb('64716a'),
  bar: rgb('3e4844'),
  stoneCap: rgb('d4cdbc'),
  canopy: rgb('9fa9a2'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.88 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.88 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.86 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.77 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45 },
};
const west = -21.87;
const east = 22.26;
const rear = -5.868;
const gableStart = 14.368;
const westRange = [
  [west, rear],
  [west, 5.438],
  [-0.957, 5.504],
  [0, 5.211],
  [0, rear],
];
const mainRange = [
  [0, rear],
  [0, 5.211],
  [1.221, 4.832],
  [4.711, 4.74],
  [6.93, 5.406],
  [13.579, 5.526],
  [gableStart, 4.462],
  [gableStart, rear],
];
const eastRange = [
  [gableStart, rear],
  [gableStart, 4.462],
  [east, 4.462],
  [east, rear],
];
const masses = [
  {
    ring: westRange,
    ends: [west, -0.01],
    back: rear,
    front: 5.47,
    eaves: 4.26,
    ridge: 5.39,
    tint: colors.plaster,
  },
  {
    ring: mainRange,
    ends: [0, gableStart],
    back: rear,
    front: 5.34,
    eaves: 4.78,
    ridge: 5.92,
    tint: colors.plaster,
  },
  {
    ring: eastRange,
    ends: [gableStart, east],
    back: rear,
    front: 4.462,
    eaves: 4.96,
    ridge: 6.1,
    tint: colors.east,
  },
];

function roof(out, mass, level) {
  const [left, right] = mass.ends;
  const depth = mass.front - mass.back,
    z = (mass.back + mass.front) / 2;
  gableRoof(out, 'roof', [left, z], [right, z], depth, mass.eaves, mass.ridge, colors.roof, {
    overhang: 0.21,
    endSlot: 'wall',
    endColor: mass.tint,
  });
  beam(
    out,
    'roof',
    [left - 0.21, mass.ridge + 0.015, z],
    [right + 0.21, mass.ridge + 0.015, z],
    0.14,
    0.11,
    colors.roofShadow,
  );
  for (const edge of [mass.back, mass.front]) {
    const sign = Math.sign(edge - z);
    beam(
      out,
      'roof',
      [left - 0.21, mass.eaves - 0.045, edge + sign * 0.2],
      [right + 0.21, mass.eaves - 0.045, edge + sign * 0.2],
      0.12,
      0.12,
      colors.roofShadow,
    );
    if (level < 2) continue;
    const rows = level === 3 ? 10 : 5;
    for (let i = 1; i < rows; i++) {
      const t = i / rows,
        u = edge + (z - edge) * t;
      const y = mass.eaves + (mass.ridge - mass.eaves) * t + 0.012;
      beam(out, 'roof', [left - 0.16, y, u], [right + 0.16, y, u], 0.033, 0.035, colors.roof);
    }
  }
}

function gallery(out, mass, level) {
  extrude(out, 'stone', mass.ring, -1.47, 0.16, colors.stone, { top: false });
  extrude(out, 'wall', mass.ring, 0.16, mass.eaves, mass.tint, { top: false });
  roof(out, mass, level);
}

function window(out, f, u, base, width, height, level) {
  if (level === 0) {
    const a = u - width / 2,
      b = u + width / 2;
    quad4(
      out,
      'glass',
      f.P(a, base, 0.035),
      f.P(b, base, 0.035),
      f.P(b, base + height, 0.035),
      f.P(a, base + height, 0.035),
      colors.glazing,
    );
    return;
  }
  opening(out, f, u, base, width, height, {
    glass: colors.glazing,
    frame: colors.frame,
    frameSlot: 'metal',
    frameWidth: 0.085,
    frameDepth: 0.12,
    sill: true,
    mullions: level === 3 ? 4 : level === 2 ? 2 : 1,
    transoms: level === 3 ? 4 : level === 2 ? 1 : 0,
    mullionColor: colors.bar,
  });
}

function museumWindows(out, level) {
  const eastEnd = facade([east, 0], [0, -1]);
  window(out, eastEnd, 0.15, 1.68, 1.37, 1.65, level);
  const smallEastWall = facade([0, 4.462], [1, 0]);
  window(out, smallEastWall, 17.9, 1.65, 1.4, 1.62, level);
  const front = wallFace([6.93, 5.406], [13.579, 5.526]);
  for (const offset of [1.68, 4.91]) window(out, front, offset, 1.86, 1.51, 1.85, level);
  const westFront = wallFace([west, 5.438], [-0.957, 5.504]);
  for (const offset of [2.95, 6.28, 9.43, 13.16, 17.0, 19.53])
    window(out, westFront, offset, 1.25, 1.27, 1.91, level);
  const north = facade([0, rear], [-1, 0]);
  for (const x of [-19.1, -15.3, -10.9, -6.72, -2.34, 2.34, 6.6, 11.03, 15.35, 19.5])
    window(out, north, x, 1.55, 1.15, 1.62, level);
  const end = facade([west, 0], [0, 1]);
  for (const z of [-2.78, 2.42]) window(out, end, z, 1.51, 1.2, 1.65, level);
}

function approach(out, level) {
  const entrance = wallFace([1.221, 4.832], [4.711, 4.74]);
  const stairX = 3.25;
  fbox(out, 'metal', entrance, 0.73, 2.47, 0.12, 2.43, 0.011, 0.095, colors.frame);
  fbox(out, 'glass', entrance, 0.93, 2.27, 0.37, 2.25, 0.1, 0.124, colors.glazing);
  fbox(out, 'trim', entrance, 0.43, 2.77, 2.44, 2.58, 0.02, 0.24, colors.stoneCap);
  abox(out, 'stone', [-20.9, -1.95, 5.37], [7.02, -0.015, 9.63], colors.stone);
  abox(out, 'trim', [-20.97, -0.14, 9.52], [-0.9, 0.17, 9.73], colors.stoneCap);
  abox(out, 'trim', [-20.98, -0.22, 5.5], [6.88, 0.071, 9.61], colors.stoneCap);
  abox(out, 'stone', [6.98, -1.1, 5.47], [11.4, -0.02, 8.5], colors.stone);
  if (level > 0) {
    for (let i = 0; i < 4; i++)
      abox(
        out,
        'stone',
        [stairX - 1.45, -0.81, 8.7],
        [stairX + 1.45, -0.42 + i * 0.13, 10.57 - i * 0.335],
        colors.stoneCap,
      );
    for (const x of [-19.4, -15.15, -10.29]) {
      const lower = facade([0, 9.63], [1, 0]);
      window(out, lower, x, -1.2, 0.82, 0.97, level);
    }
  }
  abox(out, 'metal', [0.37, 2.58, 4.83], [5.54, 2.7, 7.68], colors.canopy);
  for (const x of [0.57, 5.34]) {
    abox(out, 'metal', [x - 0.055, 0.055, 7.33], [x + 0.055, 2.59, 7.44], colors.frame);
    if (level > 1) beam(out, 'metal', [x, 2.62, 5.02], [x, 2.62, 7.49], 0.11, 0.105, colors.canopy);
  }
  if (level > 1) {
    for (const [a, b, height] of [
      [-20.7, -0.9, 1.04],
      [7.33, 11.3, 0.8],
    ]) {
      for (const y of [height, height - 0.29])
        beam(out, 'metal', [a, y, 9.55], [b, y, 9.55], 0.037, 0.037, colors.canopy);
      const count = Math.round((b - a) / 1.75);
      for (let j = 0; j <= count; j++) {
        const x = a + (j * (b - a)) / count;
        beam(out, 'metal', [x, 0.05, 9.55], [x, height, 9.55], 0.041, 0.041, colors.canopy);
      }
    }
  }
}

function build(out, level) {
  for (const mass of masses) gallery(out, mass, level);
  museumWindows(out, level);
  approach(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'archaeological-museum-of-eleusis-model.mjs';
const camera = [36, 13, 43],
  lookAt = [1, 2.45, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Long, pale stone museum above the sanctuary, with clay roofs and a stepped south terrace.',
  camera,
  lookAt,
  sunDirection: [38, 52, 37],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Native exterior outline used to keep the hillside ground from entering the gallery.',
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'plaster_lime', 'tile_flat', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'museum-from-southeast-terrace', position: [39, 8.5, 39], lookAt: [0, 2.2, 4] },
    {
      name: 'glazing-stairs-and-arrival-canopy',
      position: [7.6, 4.5, 22],
      lookAt: [1.8, 2.3, 6.3],
    },
    { name: 'east-gable-and-clay-roof', position: [34, 10, 10], lookAt: [16.8, 3.8, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'eleusis-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.66,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.29, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work, OpenStreetMap perimeter under ODbL, and sourced Mapzen elevation.',
};

import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const cream = rgb('e5dfca');
const green = rgb('38564b');
const greenLight = rgb('4f675a');
const brick = rgb('986c59');
const darkerBrick = rgb('79594c');
const slate = rgb('585c54');
const coping = rgb('c7bfa8');
const glass = rgb('404c49');
const steps = rgb('8e8780');
const surface = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  base: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.92 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.86 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
  paint: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.92 },
};
const front = 8.67;
const center = 0.88;
const face = facade([0, front], [1, 0]);
const glyphs = {
  A: ['01110', '11011', '10001', '11111', '11011', '11011', '11011'],
  B: ['11110', '11011', '11011', '11110', '11011', '11011', '11110'],
  D: ['11110', '11011', '11001', '11001', '11001', '11011', '11110'],
  E: ['11111', '11001', '11000', '11110', '11000', '11001', '11111'],
  G: ['01111', '11000', '11000', '11011', '11001', '11011', '01110'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  L: ['11000', '11000', '11000', '11000', '11000', '11001', '11111'],
  N: ['11001', '11101', '11101', '11011', '11011', '11001', '11001'],
  O: ['01110', '11011', '11011', '11011', '11011', '11011', '01110'],
  P: ['11110', '11011', '11011', '11110', '11000', '11000', '11000'],
  R: ['11110', '11011', '11011', '11110', '11100', '11010', '11011'],
  S: ['01111', '11000', '11000', '01110', '00011', '00011', '11110'],
  T: ['11111', '10101', '00100', '00100', '00100', '00100', '01110'],
  W: ['11001', '11001', '11001', '10101', '10101', '11111', '01010'],
  '&': ['01100', '10010', '10100', '01100', '10101', '10010', '01101'],
};

function letterRow(out, text, midpoint, bottom, size, spacing) {
  const widths = [...text].map((c) => glyphs[c]?.[0].length ?? 3);
  const total = widths.reduce((sum, width) => sum + width + spacing, -spacing) * size;
  let x = midpoint - total / 2;
  for (const [i, c] of [...text].entries()) {
    for (const [row, pixels] of (glyphs[c] ?? []).entries()) {
      for (const match of pixels.matchAll(/1+/g)) {
        const a = x + match.index * size;
        const b = a + match[0].length * size;
        const y = bottom + (6 - row) * size;
        quad4(
          out,
          'paint',
          face.P(a, y, 0.026),
          face.P(b, y, 0.026),
          face.P(b, y + size, 0.026),
          face.P(a, y + size, 0.026),
          green,
        );
      }
    }
    x += (widths[i] + spacing) * size;
  }
}

function roof(out, x0, x1, z0, z1, y, top, along) {
  const nx = [x0, y, z0],
    ne = [x1, y, z0],
    se = [x1, y, z1],
    sx = [x0, y, z1];
  const ridgeA =
    along === 'front' ? [x0 + 0.02, top, (z0 + z1) / 2] : [(x0 + x1) / 2, top, z1 - 0.02];
  const ridgeB =
    along === 'front' ? [x1 - 0.02, top, (z0 + z1) / 2] : [(x0 + x1) / 2, top, z0 + 0.02];
  if (along === 'front') {
    quad4(out, 'tile', sx, se, ridgeB, ridgeA, slate);
    quad4(out, 'tile', ne, nx, ridgeA, ridgeB, slate);
    tri(out, 'brick', nx, sx, ridgeA, brick);
    tri(out, 'brick', se, ne, ridgeB, brick);
  } else {
    quad4(out, 'tile', nx, sx, ridgeA, ridgeB, slate);
    quad4(out, 'tile', se, ne, ridgeB, ridgeA, slate);
    tri(out, 'brick', sx, se, ridgeA, brick);
    tri(out, 'brick', ne, nx, ridgeB, brick);
  }
}

function primaryMass(out) {
  const ring = frame.geometry.outline;
  extrude(out, 'base', ring, -1.15, 0.19, steps, { top: false });
  abox(out, 'brick', [-3.91, 0.19, 2.99], [5.747, 5.58, 8.56], brick);
  abox(out, 'brick', [-3.91, -0.27, -7.91], [2.07, 5.27, 3.02], brick);
  abox(out, 'brick', [-3.91, -0.55, -9.228], [-0.527, 2.83, -7.89], darkerBrick);
  roof(out, -4.03, 5.86, 2.88, 8.68, 5.56, plan.dimensions.mainRoofRidgeM, 'front');
  roof(out, -4.01, 2.18, -8.07, 3.05, 5.25, 6.45, 'side');
  roof(out, -4.02, -0.43, -9.37, -7.83, 2.81, 3.4, 'front');
  for (const [x, z, top] of [
    [-3.53, 4.74, 7.31],
    [5.5, 6.0, 8.0],
    [-3.34, -7.06, 7.11],
  ]) {
    abox(out, 'brick', [x - 0.34, 4.85, z - 0.44], [x + 0.34, top, z + 0.44], darkerBrick);
    abox(out, 'brick', [x - 0.42, top - 0.16, z - 0.49], [x + 0.42, top - 0.04, z + 0.49], brick);
    for (const dz of [-0.205, 0.205]) {
      abox(
        out,
        'brick',
        [x - 0.13, top, z + dz - 0.13],
        [x + 0.13, top + 0.19, z + dz + 0.13],
        darkerBrick,
      );
    }
  }
}

function sash(out, f, x, y, width, height, level, big = false, depth = 0.034) {
  if (level === 0) {
    const w = width / 2;
    const P = (a, b) => f.P(x + a, y + b, depth);
    quad4(out, 'glass', P(-w, 0), P(w, 0), P(w, height), P(-w, height), glass);
    return;
  }
  opening(out, f, x, y, width, height, {
    glass,
    frameSlot: 'trim',
    frame: green,
    frameWidth: big ? 0.095 : 0.07,
    frameDepth: 0.14,
    d: depth,
    mullions: level === 1 ? 1 : 2,
    transoms: level === 3 ? 4 : 2,
    mullionColor: greenLight,
  });
}

function pubFront(out, level) {
  fbox(out, 'plaster', face, -3.9, 5.673, 0.15, plan.dimensions.parapetM, -0.182, 0, cream);
  fbox(out, 'plaster', face, -3.97, 5.77, 6.33, 6.49, -0.24, 0.13, coping);
  fbox(out, 'plaster', face, -3.88, 5.67, 0.16, 1.04, -0.01, 0.012, green);
  fbox(out, 'plaster', face, -3.87, 5.66, 0.07, 0.18, -0.01, 0.036, steps);
  for (const x of [-1.67, 3.39]) {
    sash(out, face, x, 3.43, 1.16, 1.61, level);
    fbox(out, 'plaster', face, x - 0.74, x + 0.74, 5.03, 5.14, 0.005, 0.091, coping);
    fbox(out, 'plaster', face, x - 0.69, x + 0.69, 3.36, 3.46, 0.005, 0.119, coping);
    const ext = facade([0, front + 0.49], [1, 0]);
    fbox(out, 'trim', ext, x - 0.75, x + 0.75, 0.19, 2.49, -0.48, 0.015, green);
    fbox(out, 'trim', ext, x - 0.84, x + 0.84, 2.43, 2.62, -0.51, 0.116, greenLight);
    fbox(out, 'trim', ext, x - 0.78, x + 0.78, 0.18, 0.91, 0.016, 0.046, green);
    sash(out, ext, x, 0.97, 1.34, 1.34, level, true, 0.034);
    if (level > 0) {
      for (const side of [-1, 1]) {
        const returnFace = facade([x + side * 0.755, front + 0.26], [0, -side]);
        sash(out, returnFace, 0, 0.96, 0.31, 1.36, level);
      }
    }
  }
  fbox(out, 'trim', face, center - 0.53, center + 0.53, 0.12, 2.25, 0.002, 0.105, green);
  const a = face.P(center - 0.69, 2.19, 0.228);
  const b = face.P(center + 0.69, 2.19, 0.228);
  const apex = face.P(center, 2.72, 0.228);
  tri(out, 'trim', a, b, apex, green);
  quad4(
    out,
    'tile',
    face.P(center - 0.69, 2.19, 0.28),
    face.P(center, 2.73, 0.28),
    face.P(center, 2.73, -0.08),
    face.P(center - 0.69, 2.19, -0.08),
    slate,
  );
  quad4(
    out,
    'tile',
    face.P(center, 2.73, 0.28),
    face.P(center + 0.69, 2.19, 0.28),
    face.P(center + 0.69, 2.19, -0.08),
    face.P(center, 2.73, -0.08),
    slate,
  );
  for (const [z, y] of [
    [0.51, 0.11],
    [0.31, 0.21],
  ]) {
    fbox(out, 'base', face, center - 0.61, center + 0.61, -0.11, y, 0, z, steps);
  }
  if (level > 0) {
    fbox(out, 'paint', face, center - 0.34, center + 0.34, 2.87, 3.31, 0.011, 0.044, slate);
    letterRow(out, 'BOTTLE & GLASS INN', center, 5.63, 0.055, 1.39);
  }
  if (level > 1) {
    letterRow(out, 'NOTED', center, 4.04, 0.049, 1.8);
    letterRow(out, 'ALES', center, 3.58, 0.046, 1.8);
    letterRow(out, 'WINES', -3.06, 3.71, 0.029, 0.8);
    letterRow(out, 'SPIRITS', 4.81, 3.71, 0.029, 0.61);
  }
}

function sideBays(out, level) {
  const left = facade([-3.91, 0], [0, 1]);
  const right = facade([2.07, 0], [0, -1]);
  const rear = facade([0, -7.91], [-1, 0]);
  for (const x of [-5.86, -2.0, 2.24, 5.8]) {
    sash(out, left, x, 3.01, 0.86, 1.5, level);
    sash(out, left, x, 0.87, 0.87, 1.4, level);
  }
  for (const x of [0.1, 3.8, 6.2]) {
    sash(out, right, x, 3.02, 0.79, 1.43, level);
    sash(out, right, x, 0.86, 0.79, 1.38, level);
  }
  for (const x of [-0.86, 1.86]) sash(out, rear, x, 2.98, 0.86, 1.42, level);
  if (level === 0) return;
  fbox(out, 'trim', left, -0.57, 0.59, -0.06, 2.16, 0, 0.065, green);
  const rightWing = facade([5.75, 0], [0, -1]);
  for (const x of [-6.7, -4.64]) {
    sash(out, rightWing, x, 3.12, 0.78, 1.39, level);
    sash(out, rightWing, x, 1.05, 0.74, 1.27, level);
  }
}

function build(out, level) {
  primaryMass(out);
  pubFront(out, level);
  sideBays(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'bottle-and-glass-inn-dudley-model.mjs';
const camera = [18, 11, 31];
const lookAt = [0, 2.8, 1.4];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'inn',
  surfaces: surface,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The canalside village inn with its cream and green painted pub frontage and brick rear ranges.',
  camera,
  lookAt,
  sunDirection: [20, 58, 40],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Named native outlines of the inn and attached rear wings.',
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'plaster_lime',
    'stone_limestone',
    'tile_flat',
    'wood_plain',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'coppice-street-front', position: [-4, 4, 25], lookAt: [0.7, 3.45, 7.9] },
    { name: 'painted-letters-and-pub-bays', position: [3.5, 4.2, 20.5], lookAt: [0.9, 3.3, 8.7] },
    { name: 'brick-canal-side-ranges', position: [-22, 12, -12], lookAt: [0, 3.2, -1.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'bottle-and-glass-inn-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.35,
    surfaces: surface,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.16, surfaces: surface },
      street: { export: 'street', errorMeters: 0.075, surfaces: surface },
      closeup: { export: 'closeup', errorMeters: 0.027, surfaces: surface },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work, OpenStreetMap footprint under ODbL, and Mapzen terrain under source attribution.',
};

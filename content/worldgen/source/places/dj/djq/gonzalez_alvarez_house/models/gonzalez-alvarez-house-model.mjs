import fs from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  roundArch,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const plaster = rgb('e0d9c7');
const board = rgb('b1b0a0');
const boardEdge = rgb('9b9a8d');
const porchPaint = rgb('c2c0aa');
const shutters = rgb('52674c');
const shutterSlat = rgb('617258');
const roof = rgb('524f48');
const roofEdge = rgb('695f53');
const stone = rgb('a39880');
const dark = rgb('41443b');
const panes = rgb('465153');
const surfaces = {
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.95 },
  siding: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.96 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.98 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.72 },
};
const front = facade([0, 4.65], [1, 0]);
const east = facade([6.12, 0], [0, -1]);
const back = facade([0, -3.51], [-1, 0]);

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function gate(out, x, half, spring, level) {
  const cap = 3.19;
  const arch = roundArch(half, level === 0 ? 4 : level === 1 ? 6 : 10);
  for (const side of [-1, 1]) {
    const edge = x + side * half;
    fbox(out, 'plaster', front, edge - 0.22, edge + 0.22, -0.21, cap, -0.42, 0.021, plaster);
  }
  for (let i = 1; i < arch.length; i++) {
    const [a, ay] = arch[i - 1];
    const [b, by] = arch[i];
    const P = (u, y, d) => front.P(x + u, y, d);
    quad4(
      out,
      'plaster',
      P(a, spring + ay, 0.025),
      P(b, spring + by, 0.025),
      P(b, cap, 0.025),
      P(a, cap, 0.025),
      plaster,
    );
    quad4(
      out,
      'plaster',
      P(b, spring + by, -0.42),
      P(a, spring + ay, -0.42),
      P(a, cap, -0.42),
      P(b, cap, -0.42),
      plaster,
    );
    quad4(
      out,
      'plaster',
      P(a, spring + ay, -0.42),
      P(b, spring + by, -0.42),
      P(b, spring + by, 0.025),
      P(a, spring + ay, 0.025),
      porchPaint,
    );
  }
  fbox(
    out,
    'plaster',
    front,
    x - half - 0.24,
    x + half + 0.24,
    cap - 0.03,
    cap + 0.07,
    -0.44,
    0.05,
    plaster,
  );
}

function sash(out, F, u, y, width, height, level, green = true) {
  if (level === 0) {
    fbox(out, 'glass', F, u - width / 2, u + width / 2, y, y + height, 0.025, 0.039, panes);
  } else {
    opening(out, F, u, y, width, height, {
      frameSlot: 'siding',
      glassSlot: 'glass',
      frame: porchPaint,
      glass: panes,
      frameWidth: 0.07,
      frameDepth: 0.09,
      d: 0.07,
      sill: true,
      mullions: level > 1 ? 2 : 0,
      transoms: level > 1 ? 3 : 1,
      mullionColor: porchPaint,
    });
  }
  if (!green) return;
  for (const side of [-1, 1]) {
    const c = u + side * (width / 2 + 0.24);
    fbox(
      out,
      'siding',
      F,
      c - 0.168,
      c + 0.168,
      y - 0.03,
      y + height + 0.034,
      0.043,
      0.118,
      shutters,
    );
    if (level > 1)
      for (let i = 1; i <= 6; i++) {
        const h = y + (i * height) / 7;
        fbox(out, 'siding', F, c - 0.153, c + 0.153, h, h + 0.022, 0.118, 0.131, shutterSlat);
      }
  }
}

function door(out, F, u, bottom, width, height, level, depth = 0.075) {
  fbox(
    out,
    'siding',
    F,
    u - width / 2,
    u + width / 2,
    bottom,
    bottom + height,
    depth - 0.027,
    depth,
    shutters,
  );
  if (level > 0) {
    fbox(
      out,
      'siding',
      F,
      u - width / 2 - 0.09,
      u + width / 2 + 0.09,
      bottom + height - 0.01,
      bottom + height + 0.1,
      depth - 0.051,
      depth + 0.056,
      porchPaint,
    );
    fbox(
      out,
      'stone',
      F,
      u - width / 2 - 0.04,
      u + width / 2 + 0.04,
      bottom - 0.075,
      bottom,
      depth - 0.12,
      depth + 0.21,
      stone,
    );
    for (const sign of [-1, 1])
      fbox(
        out,
        'siding',
        F,
        u + (sign * width) / 2 - 0.045,
        u + (sign * width) / 2 + 0.045,
        bottom,
        bottom + height,
        depth - 0.051,
        depth + 0.056,
        porchPaint,
      );
  }
  if (level > 1)
    for (const h of [0.2, 0.51, 0.88])
      fbox(
        out,
        'siding',
        F,
        u - width / 2 + 0.08,
        u + width / 2 - 0.08,
        bottom + h * height,
        bottom + h * height + 0.027,
        depth,
        depth + 0.018,
        shutterSlat,
      );
}

function siding(out, F, from, to, y0, y1, level) {
  fbox(out, 'siding', F, from, to, y0, y1, -0.043, 0.024, board);
  if (level < 2) return;
  const rows = level === 3 ? 13 : 9;
  for (let i = 1; i < rows; i++) {
    const y = y0 + (i * (y1 - y0)) / rows;
    fbox(out, 'siding', F, from, to, y, y + 0.023, 0.024, 0.033, boardEdge);
  }
}

function groundFloor(out, level) {
  box(out, 'stone', -9.46, 3.37, -3.53, 4.62, -0.44, 0.14, stone);
  box(out, 'stone', 3.37, 6.04, -0.96, 4.62, -0.44, 0.14, stone);
  box(out, 'plaster', -6.31, 4.34, -1.19, 4.645, 0.06, 3.2, plaster);
  box(out, 'plaster', -9.46, 3.37, -2.24, -0.96, 0.06, 3.2, plaster);
  box(out, 'plaster', -9.45, -9.1, -1.03, 4.67, -0.21, 3.18, plaster);
  gate(out, -7.98, 1.1, 1.95, level);
  gate(out, 5.19, 0.65, 2.39, level);
  fbox(out, 'plaster', front, -9.46, -9.18, 0.06, 3.18, -0.43, 0.015, plaster);
  fbox(out, 'plaster', front, -6.9, -6.17, 0.06, 3.18, -0.43, 0.015, plaster);
  fbox(out, 'plaster', front, 4.28, 4.56, 0.05, 3.18, -0.44, 0.015, plaster);
  fbox(out, 'plaster', front, 5.81, 6.11, 0.04, 3.18, -0.44, 0.015, plaster);
  door(out, front, -2.67, 0.17, 0.92, 2.16, level);
  for (const x of [-5.2, -0.1, 2.63]) sash(out, front, x, 0.77, 0.73, 1.34, level);
  door(out, east, -2.13, 0.19, 0.84, 2.01, level, -1.715);

  const loggia = facade([0, -3.53], [1, 0]);
  box(out, 'siding', -9.45, 3.37, -3.53, -2.21, 3.0, 3.2, porchPaint);
  fbox(out, 'siding', loggia, -8.93, 3.34, 2.94, 3.11, -0.05, 0.13, porchPaint);
  for (const x of [-8.92, -5.85, -2.77, 0.31, 3.22])
    fbox(out, 'siding', loggia, x - 0.074, x + 0.074, 0.12, 3.03, -0.19, 0.0, porchPaint);
}

function upperFloor(out, level) {
  box(out, 'siding', -9.38, 4.45, -3.49, 4.57, 3.16, 5.66, board);
  siding(out, front, -9.37, 4.44, 3.18, 5.66, level);
  siding(out, back, -3.36, 9.35, 3.22, 5.63, level);
  const west = facade([-9.39, 0], [0, 1]);
  siding(out, west, -3.49, 4.55, 3.18, 5.66, level);
  const eastWall = facade([4.46, 0], [0, -1]);
  siding(out, eastWall, -4.57, 0.93, 3.18, 5.66, level);
  for (const x of [-5.03, -0.61, 2.49]) sash(out, front, x, 3.87, 0.84, 1.38, level);
  for (const x of [0.5, 4.7, 7.4]) sash(out, back, x, 3.82, 0.76, 1.3, level);
  sash(out, west, -0.31, 3.87, 0.75, 1.35, level, false);
  door(out, eastWall, -1.58, 3.2, 0.79, 1.9, level);

  box(out, 'siding', 4.37, 6.08, -0.97, 4.58, 3.06, 3.27, porchPaint);
  for (const d of [0, -0.08]) {
    fbox(out, 'siding', east, -4.53, 0.83, 3.27, 3.36, d - 0.06, d, porchPaint);
    fbox(out, 'siding', east, -4.53, 0.83, 4.06, 4.15, d - 0.06, d, porchPaint);
  }
  for (const u of [-4.5, -1.85, 0.81])
    fbox(out, 'siding', east, u - 0.087, u + 0.087, 3.2, 5.63, -0.15, -0.01, porchPaint);
  if (level > 0)
    for (let i = 1; i < (level === 1 ? 8 : 17); i++) {
      const u = -4.51 + (i * 5.33) / (level === 1 ? 8 : 17);
      fbox(out, 'siding', east, u - 0.028, u + 0.028, 3.36, 4.08, -0.1, -0.032, porchPaint);
    }
}

function roofAndChimneys(out, level) {
  const sw = [-9.68, 5.6, 4.94],
    nw = [-9.68, 5.52, -3.79];
  const se = [6.24, 5.6, 4.94],
    ne = [6.24, 5.52, -3.79];
  const w = [-5.88, 8.17, 0.53],
    e = [6.24, 8.17, 0.53];
  quad4(out, 'roof', sw, se, e, w, roof);
  quad4(out, 'roof', ne, nw, w, e, roof);
  tri(out, 'roof', nw, sw, w, roof);
  tri(out, 'siding', [6.08, 5.55, 4.92], [6.08, 5.55, -3.77], [6.08, 8.17, 0.53], board);
  quad4(out, 'siding', se, sw, [-9.41, 5.54, 4.45], [6.07, 5.54, 4.45], roofEdge);
  quad4(out, 'siding', nw, ne, [6.07, 5.48, -3.49], [-9.41, 5.48, -3.49], roofEdge);
  if (level > 0) {
    beamPath(out, 'siding', [sw, se, e, ne, nw, sw], 0.086, 0.096, roofEdge);
    beamPath(out, 'roof', [sw, w, e], 0.1, 0.1, roof);
    beamPath(out, 'roof', [nw, w], 0.1, 0.1, roof);
  }
  for (const [x, z, y] of [
    [-4.55, -1.44, 8.24],
    [3.4, -1.52, 8.61],
  ]) {
    box(out, 'plaster', x - 0.24, x + 0.24, z - 0.23, z + 0.23, 5.82, y, plaster);
    box(out, 'stone', x - 0.28, x + 0.28, z - 0.27, z + 0.27, y - 0.1, y + 0.055, stone);
    if (level > 1)
      box(out, 'glass', x - 0.11, x + 0.1, z - 0.086, z + 0.086, y + 0.055, y + 0.061, dark);
  }
}

function build(out, level) {
  groundFloor(out, level);
  upperFloor(out, level);
  roofAndChimneys(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'gonzalez-alvarez-house-model.mjs';
const camera = [-22, 9.0, 24];
const lookAt = [-1.2, 3.5, 0.35];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'González–Álvarez House',
  wikidataId: plan.wikidataId,
  category: 'residence',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The restored Spanish Colonial coquina house with white plaster, green shutters, a shingled west hip and street-side arched gates.',
  camera,
  lookAt,
  sunDirection: [-40, 49, 35],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Mapped main house footprint and its attached exterior bays.',
  },
  embeddedCanonicalGraphs: ['stucco', 'wood_plain', 'shingle_cedar', 'stone_limestone_raw'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'saint-francis-street-gates', position: [-16.6, 2.97, 21.5], lookAt: [-1.9, 3.3, 3.0] },
    {
      name: 'east-porch-and-street-elevation',
      position: [17.1, 5.1, 12.8],
      lookAt: [1.45, 3.6, 1.78],
    },
    { name: 'rear-loggia-and-roof', position: [-14, 8.45, -20], lookAt: [-2.6, 3.79, 0.4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'gonzalez-alvarez-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.76,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.37, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

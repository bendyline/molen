import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const field = read('terrain-grid');
const roofY = plan.dimensions.surveyRoofHKPD - field.modelDatumElevationMeters;
const tint = {
  plaster: rgb('b5b3a6'),
  masonry: rgb('8e8a7d'),
  fascia: rgb('c1c5bf'),
  soffit: rgb('746d60'),
  metal: rgb('b8b9ac'),
  railing: rgb('645854'),
  window: rgb('444948'),
  dark: rgb('434046'),
  slat: rgb('82634f'),
  tile: rgb('816964'),
};
const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.91 },
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93 },
  fascia: { slot: 'trim', graph: 'plaster_lime', roughness: 0.92 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.75 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.85 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86 },
};
const frontZ = -4.17;
const entryLeft = -3.43;
const entryRight = 13.13;
const stairsLeft = [entryLeft + 0.43, entryLeft + 2.62];
const stairsRight = [entryRight - 2.76, entryRight - 0.48];

function panel(out, slot, face, left, right, bottom, top, depth, color) {
  quad4(
    out,
    slot,
    face.P(left, bottom, depth),
    face.P(right, bottom, depth),
    face.P(right, top, depth),
    face.P(left, top, depth),
    color,
  );
}

const glyph = {
  A: [14, 17, 17, 31, 17, 17, 17],
  D: [30, 17, 17, 17, 17, 17, 30],
  E: [31, 16, 16, 30, 16, 16, 31],
  F: [31, 16, 16, 30, 16, 16, 16],
  G: [15, 16, 16, 19, 17, 17, 14],
  H: [17, 17, 17, 31, 17, 17, 17],
  I: [31, 4, 4, 4, 4, 4, 31],
  K: [17, 18, 20, 24, 20, 18, 17],
  M: [17, 27, 21, 21, 17, 17, 17],
  N: [17, 25, 21, 19, 17, 17, 17],
  O: [14, 17, 17, 17, 17, 17, 14],
  S: [15, 16, 16, 14, 1, 1, 30],
  T: [31, 4, 4, 4, 4, 4, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
};
function letterRow(out, face, text, x, bottom, pixel) {
  for (let i = 0; i < text.length; i++) {
    const rows = glyph[text[i]];
    if (!rows) continue;
    for (let j = 0; j < 7; j++) {
      for (let k = 0; k < 5; k++) {
        if (!(rows[j] & (1 << (4 - k)))) continue;
        const u = x + (i * 6 + k) * pixel,
          y = bottom + (6 - j) * pixel;
        panel(out, 'detail', face, u, u + pixel * 0.99, y, y + pixel * 0.99, 0.025, tint.dark);
      }
    }
  }
}

function stoneShell(out, level) {
  extrude(out, 'concrete', frame.geometry.outline, -1.57, 1.055, tint.masonry, { top: false });
  abox(out, 'concrete', [-13.13, 1.05, -1.46], [-4.97, roofY, 7.65], tint.masonry);
  abox(out, 'wall', [-4.97, 1.05, -3.94], [-3.44, roofY, 7.65], tint.plaster);
  abox(out, 'wall', [-3.44, 1.05, 0.69], [13.21, roofY, 7.59], tint.masonry);
  abox(out, 'concrete', [entryLeft, 2.01, -0.25], [entryRight, 2.66, 0.74], tint.plaster);
  const canopyBottom = roofY - 1.15;
  abox(
    out,
    'fascia',
    [entryLeft - 0.1, canopyBottom, frontZ - 0.152],
    [entryRight + 0.02, roofY, 1.07],
    tint.fascia,
  );
  quad4(
    out,
    'wall',
    [entryLeft - 0.09, canopyBottom - 0.012, 1.02],
    [entryLeft - 0.09, canopyBottom - 0.012, frontZ - 0.14],
    [entryRight, canopyBottom - 0.012, frontZ - 0.14],
    [entryRight, canopyBottom - 0.012, 1.02],
    tint.soffit,
  );
  const entrance = wallFace([entryRight, 0.678], [entryLeft, 0.678]);
  const glassX0 = entrance.length * 0.3,
    glassX1 = entrance.length * 0.7;
  fbox(out, 'steel', entrance, glassX0 - 0.085, glassX1 + 0.085, 2.6, 5.36, 0, 0.096, tint.metal);
  panel(out, 'detail', entrance, glassX0, glassX1, 2.69, 5.28, 0.105, tint.window);
  for (const h of [3.47, 4.48]) {
    panel(out, 'steel', entrance, glassX0, glassX1, h, h + 0.048, 0.121, tint.metal);
  }
  for (let i = 1; i < 4; i++) {
    const u = glassX0 + ((glassX1 - glassX0) * i) / 4;
    panel(out, 'steel', entrance, u - 0.022, u + 0.022, 2.65, 5.3, 0.121, tint.metal);
  }
  if (level > 0) {
    for (const x of [entryLeft + 1.75, entryRight - 1.23]) {
      abox(out, 'wall', [x - 0.105, 1.8, 0.32], [x + 0.106, 5.45, 0.51], tint.tile);
    }
    panel(out, 'detail', entrance, 0.55, 2.55, 3.12, 4.75, 0.04, tint.window);
    panel(
      out,
      'detail',
      entrance,
      entrance.length - 2.6,
      entrance.length - 0.75,
      3.12,
      4.75,
      0.04,
      tint.window,
    );
  }
  const roofFront = wallFace([entryRight, frontZ - 0.153], [entryLeft - 0.1, frontZ - 0.153]);
  if (level > 1) {
    letterRow(out, roofFront, 'TAO HEUNG', 1.1, roofY - 0.31, 0.037);
    letterRow(out, roofFront, 'FOODS OF MANKIND', 1.1, roofY - 0.6, 0.022);
    letterRow(out, roofFront, 'MUSEUM', 1.1, roofY - 0.96, 0.046);
  }
  if (level > 2) {
    for (const x of [entryLeft + 2.22, entryRight - 2.3]) {
      const foot = [x, roofY, -3.84],
        top = [x, roofY + 0.54, -4.42];
      beam(out, 'steel', foot, top, 0.038, 0.038, tint.railing);
      abox(
        out,
        'detail',
        [x - 0.09, top[1] - 0.045, top[2] - 0.085],
        [x + 0.09, top[1], top[2] + 0.057],
        tint.dark,
      );
    }
  }
}

function stairs(out, level) {
  const steps = [4, 7, 11, 12][level];
  const start = frontZ - 0.02,
    end = 0.52;
  for (const [left, right] of [stairsLeft, stairsRight]) {
    for (let i = 0; i < steps; i++) {
      const lower = i / steps,
        upper = (i + 1) / steps;
      abox(
        out,
        'concrete',
        [left, 1.02, start + (end - start) * lower],
        [right, 1.055 + 1.605 * upper, start + (end - start) * upper],
        tint.plaster,
        { bottom: false },
      );
    }
    for (const x of [left + 0.07, right - 0.07]) {
      beam(out, 'steel', [x, 1.82, start], [x, 3.49, end], 0.05, 0.05, tint.railing);
      if (level > 1)
        beam(out, 'steel', [x, 1.57, start], [x, 3.21, end], 0.031, 0.031, tint.railing);
      const count = level === 0 ? 2 : level === 1 ? 4 : 8;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1),
          y = 1.055 + t * 1.605,
          z = start + (end - start) * t;
        beam(out, 'steel', [x, y, z], [x, y + 0.76, z], 0.045, 0.048, tint.railing);
      }
    }
  }
}

function court(out, level) {
  const face = wallFace([entryRight + 0.08, frontZ - 0.52], [entryLeft - 0.02, frontZ - 0.52]);
  const mid = 7.86,
    gate = 1.92;
  fbox(out, 'concrete', face, 0, mid - gate, -0.38, 1.77, -0.57, 0, tint.masonry);
  fbox(out, 'concrete', face, mid + gate, face.length, -0.38, 1.77, -0.57, 0, tint.masonry);
  for (const [a, b] of [
    [0.44, mid - gate - 0.6],
    [mid + gate + 0.75, face.length - 0.77],
  ]) {
    panel(out, 'detail', face, a, b, 0.17, 0.89, 0.012, tint.dark);
  }
  for (const y of [0.08, 1.95, 2.39]) {
    const rail = y < 2 ? mid - gate : 0;
    fbox(
      out,
      'steel',
      face,
      rail,
      y < 2 ? mid + gate : face.length,
      y,
      y + 0.045,
      -0.014,
      0.041,
      tint.metal,
    );
  }
  const bars = [7, 15, 29, 42][level];
  for (let i = 0; i <= bars; i++) {
    const u = (face.length * i) / bars,
      opening = u > mid - gate && u < mid + gate;
    const ground = opening ? 0.09 : 1.78;
    fbox(out, 'steel', face, u - 0.016, u + 0.016, ground, 2.45, -0.012, 0.03, tint.metal);
    if (level > 1 && opening)
      panel(out, 'wood', face, u - 0.073, u + 0.075, 0.29, 1.44, 0.04, tint.slat);
  }
}

function build(out, level) {
  stoneShell(out, level);
  stairs(out, level);
  court(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'tao-heung-fanling-museum-model.mjs';
const camera = [-18, 13, -28],
  lookAt = [0.3, 2.7, 0];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Tao Heung Food Museum, Fanling (2006)',
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '2006-10-08',
    validFrom: '2006-10-08',
    validUntil: '2006-10-09',
  },
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The original Fanling museum with its cantilever, recessed glass entry, paired front stairs and gated concrete court in October 2006.',
  camera,
  lookAt,
  sunDirection: [-64, 81, -35],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['concrete_plain', 'plaster_lime', 'metal_painted', 'wood_plain'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'lok-tin-street-gate-and-canopy', position: [1.5, 4.55, -24], lookAt: [4, 3.7, -1.4] },
    { name: 'concrete-court-and-stairs', position: [16, 5, -18], lookAt: [4.2, 3.1, -3] },
    { name: 'surveyed-museum-envelope', position: [26, 14, -20], lookAt: [0.8, 2.4, -0.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fanling-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.41,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.18, surfaces },
      street: { export: 'street', errorMeters: 0.075, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.031, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Footprint and ground elevations from Hong Kong Lands Department open data.',
};

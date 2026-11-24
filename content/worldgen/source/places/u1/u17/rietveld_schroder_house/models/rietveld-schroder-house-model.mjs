import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const survey = read('native-map/rietveld-surface-controls');
const roof = survey.mainRoofHeightMeters;
const floor = plan.dimensions.principalFloorY;
const e = facade([0, 3.21], [1, 0]);
const s = facade([-4.79, 0], [0, 1]);
const n = facade([4.98, 0], [0, -1]);

const ivory = rgb('e4e1d5');
const warmWhite = rgb('d7d5cc');
const cement = rgb('969997');
const midGray = rgb('a0a3a0');
const deepGray = rgb('626b6b');
const slate = rgb('3d525a');
const black = rgb('292d2c');
const soot = rgb('4c5350');
const red = rgb('b92422');
const yellow = rgb('d5ae26');
const blue = rgb('3d596d');
const glass = rgb('4a5451');
const opaqueGlass = rgb('414b49');

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.87 },
  slab: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.93 },
  painted: { slot: 'trim', graph: 'metal_painted', roughness: 0.53 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.34 },
};

function panel(out, f, left, right, bottom, top, offset, tint, thickness = 0.095) {
  fbox(out, 'plaster', f, left, right, bottom, top, offset - thickness, offset, tint, {
    bottom: true,
  });
}

function member(out, f, left, right, bottom, top, offset, tint = black, depth = 0.065) {
  fbox(out, 'painted', f, left, right, bottom, top, offset - depth, offset, tint, {
    bottom: true,
  });
}

function window(out, f, x0, x1, y0, y1, d, level, mullions = [], transoms = [], tone = glass) {
  fbox(out, 'glass', f, x0, x1, y0, y1, d - 0.028, d, tone);
  if (level === 0) return;
  const w = level > 1 ? 0.091 : 0.117;
  member(out, f, x0 - w / 2, x1 + w / 2, y0 - w, y0, d + 0.049);
  member(out, f, x0 - w / 2, x1 + w / 2, y1, y1 + w, d + 0.049);
  for (const x of [x0, x1, ...mullions]) {
    member(out, f, x - w / 2, x + w / 2, y0, y1, d + 0.049);
    if (level === 3 && x !== x0 && x !== x1) {
      member(
        out,
        f,
        x + w / 2 + 0.018,
        x + w / 2 + 0.038,
        y0 + 0.08,
        y1 - 0.08,
        d + 0.031,
        soot,
        0.021,
      );
    }
  }
  if (level > 1) {
    for (const y of transoms) member(out, f, x0, x1, y - 0.03, y + 0.03, d + 0.043);
  }
}

function balconyRail(out, f, x0, x1, offset, level) {
  for (const y of [floor + 0.37, floor + 0.82]) {
    member(out, f, x0, x1, y, y + 0.047, offset, black, 0.046);
  }
  for (const x of level === 3 ? [x0 + 0.03, (x0 + x1) / 2, x1 - 0.04] : [x0 + 0.03, x1 - 0.04]) {
    member(out, f, x - 0.029, x + 0.029, floor - 0.035, floor + 0.87, offset, black, 0.082);
  }
}

function roundVent(out, f, center, y, d, level) {
  const sides = level === 3 ? 20 : 12;
  for (let i = 0; i < sides; i++) {
    const a = (i * Math.PI * 2) / sides;
    const b = ((i + 1) * Math.PI * 2) / sides;
    const point = (angle, radius) =>
      f.P(center + Math.cos(angle) * radius, y + Math.sin(angle) * radius, d);
    tri(out, 'painted', f.P(center, y, d), point(a, 0.129), point(b, 0.129), black);
  }
}

function eastElevation(out, level) {
  panel(out, e, -4.78, -0.78, floor - 0.06, roof + 0.035, 0.066, deepGray);
  panel(out, e, -0.84, 1.31, -0.055, roof + 0.44, 0.354, ivory, 0.27);
  panel(out, e, 1.25, 5.14, 2.24, 3.99, 0.842, midGray, 0.18);
  panel(out, e, 1.27, 5.18, -0.045, 1.13, 0.955, slate, 0.2);
  panel(out, e, 1.22, 5.28, 1.9, 2.045, 0.93, ivory, 0.16);
  panel(out, e, 4.87, 5.06, 1.98, 4.03, 0.937, warmWhite, 0.22);

  window(out, e, -4.43, -2.29, 0.255, 2.443, 0.093, level, [-3.74], [], opaqueGlass);
  window(out, e, -2.17, -0.78, 0.18, 2.74, 0.091, level, [-1.85], [2.13], opaqueGlass);
  window(out, e, -3.57, -0.82, floor + 0.09, 5.01, 0.112, level, [-2.61, -1.91], [], glass);
  window(out, e, 1.29, 4.79, 1.05, 2.235, 0.73, level, [2.07, 3.57], [1.96], opaqueGlass);
  window(out, e, 1.37, 4.77, 3.88, 6.01, 0.73, level, [2.94], [4.98], glass);

  fbox(out, 'slab', e, -4.84, -0.57, floor - 0.15, floor + 0.025, 0, 1.05, ivory, {
    bottom: true,
  });
  panel(out, e, -4.77, -2.05, 1.93, 3.92, 1.09, ivory, 0.145);
  fbox(out, 'slab', e, -3.85, -2.51, 0.34, 0.455, 0.08, 0.48, warmWhite, {
    bottom: true,
  });
  fbox(out, 'slab', e, -2.21, -0.74, -0.08, 0.16, 0.04, 0.92, cement);
  fbox(out, 'slab', e, 1.18, 5.59, 6.04, roof, -1.29, 1.205, ivory, {
    bottom: true,
  });

  member(out, e, -2.35, -2.02, -0.02, floor - 0.13, 0.404, deepGray, 0.26);
  member(out, e, -0.69, -0.535, -0.027, floor + 0.87, 1.08, black, 0.14);
  member(out, e, 1.36, 4.82, 4.88, 5.025, 0.84, red);
  member(out, e, 2.07, 2.208, 1.02, 2.43, 1.03, red, 0.084);
  if (level > 0) {
    balconyRail(out, e, -2.6, -0.58, 1.095, level);
    balconyRail(out, facade([-4.77, 0], [0, 1]), 3.26, 4.23, 0.028, level);
  }
  if (level > 1) {
    roundVent(out, e, -1.2, 5.58, 0.078, level);
    member(out, e, -0.36, -0.28, 2.23, 2.65, 0.37, black, 0.041);
    member(out, e, 0.96, 1.012, 0.04, 6.08, 0.377, warmWhite, 0.05);
    member(out, e, 1.8, 2.23, 1.8, 1.838, 1.05, warmWhite, 0.057);
    member(out, e, -1.24, -1.185, 0.83, 1.02, 0.158, soot, 0.043);
  }
}

function streetElevation(out, level) {
  window(out, s, -2.95, 1.63, 3.0, 5.87, 0.044, level, [-1.58, -0.05, 0.64], [4.72]);
  window(out, s, -2.76, 1.64, 0.38, 2.46, 0.058, level, [-1.69, -0.11, 0.71], [1.92], opaqueGlass);
  panel(out, s, -2.87, -0.3, 0.02, 1.0, 0.291, slate, 0.14);
  panel(out, s, 0.91, 3.31, 0.08, roof, 0.104, deepGray, 0.15);
  fbox(out, 'slab', s, -3.42, 1.59, 5.99, roof, -0.48, 0.92, warmWhite, { bottom: true });
  fbox(out, 'slab', s, -3.01, 1.67, floor - 0.16, floor + 0.02, -0.06, 0.87, ivory, {
    bottom: true,
  });
  member(out, s, -0.94, -0.805, -0.05, 6.45, 0.95, yellow, 0.112);
  member(out, s, -2.67, -0.84, 2.0, 2.103, 0.113, red);
  member(out, s, 0.46, 0.566, 2.95, 5.94, 0.081, yellow);
  if (level > 0) balconyRail(out, s, -2.85, 1.64, 0.9, level);
  if (level > 1) member(out, s, 2.17, 2.231, 0.13, 6.09, 0.162, warmWhite, 0.05);
}

function gardenElevation(out, level) {
  panel(out, n, -3.79, -1.48, -0.046, 3.95, 0.132, midGray, 0.13);
  panel(out, n, -3.86, -0.25, 0.01, 1.03, 0.2, slate, 0.142);
  panel(out, n, -1.06, 0.48, 0.025, roof + 0.03, 0.395, warmWhite, 0.24);
  fbox(out, 'slab', n, -4.41, -0.41, 6.03, roof, -0.1, 0.58, ivory, { bottom: true });
  window(out, n, -3.83, -1.09, 3.91, 6.02, 0.086, level, [-2.29], [4.94]);
  window(out, n, -3.79, -1.05, 1.07, 2.15, 0.047, level, [-2.44], [], opaqueGlass);
  window(out, n, 0.58, 2.89, 3.23, 5.73, 0.049, level, [1.82], [4.51]);
  window(out, n, 0.6, 2.78, 0.55, 2.33, 0.046, level, [1.59], [], opaqueGlass);
  member(out, n, -3.87, -1.07, 4.88, 5.025, 0.151, red);
  if (level > 1) member(out, n, 1.79, 1.915, 3.16, 5.83, 0.102, blue);
}

function rooftop(out, level) {
  abox(out, 'roof', [-4.79, roof - 0.173, -3.58], [4.98, roof - 0.008, 3.235], soot);
  abox(out, 'painted', [1.11, roof - 0.02, -1.05], [2.25, roof + 0.48, 0.28], warmWhite);
  abox(out, 'plaster', [1.22, roof + 0.48, -0.96], [2.11, roof + 1.3, 0.16], deepGray);
  if (level > 0) {
    const lantern = facade([0, 0.28], [1, 0]);
    window(out, lantern, 1.26, 2.09, roof + 0.06, roof + 0.397, 0.011, level, [1.78], []);
    abox(out, 'roof', [1.18, roof + 0.41, -1.0], [2.16, roof + 0.49, 0.31], soot);
  }
}

function build(out, level) {
  abox(out, 'slab', [-4.78, -0.21, -3.54], [5.01, 0.12, 3.214], cement);
  abox(out, 'plaster', [-4.79, 0.115, -3.58], [4.98, roof - 0.135, 3.21], warmWhite);
  rooftop(out, level);
  eastElevation(out, level);
  streetElevation(out, level);
  gardenElevation(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'rietveld-schroder-house-model.mjs';
const camera = [-14, 7.8, 21];
const lookAt = [0.1, 3.35, 0.6];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
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
    'The restored end-of-terrace house with the De Stijl wall planes, projecting balconies, wraparound glazing and slender primary-colour steel profiles.',
  camera,
  lookAt,
  sunDirection: [-32, 52, 40],
  mediumFiContext: {
    scale: 0.7,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'Mapped BAG footprint of the protected house, excluding the adjoining row.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'street-and-east-facades', position: camera, lookAt },
    { name: 'east-balcony-and-glazed-corner', position: [-1, 5.6, 18], lookAt: [0, 3.5, 1.5] },
    { name: 'garden-return-and-roof', position: [15, 13, 11], lookAt: [0, 3.8, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'rietveld-schroder-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.51,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.23, surfaces },
      street: { export: 'street', errorMeters: 0.095, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.028, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from the Dutch National Archives CC0 exterior photographs, Luctor’s public-domain colour photograph, native AHN elevation data and BAG-derived OpenStreetMap footprint.',
};

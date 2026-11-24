import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  fbox,
  gableRoof,
  outwardRing,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const nativeParts = read('native-map/potsdam-memorial-mapped-parts');
const plaster = rgb('c8bba5');
const patched = rgb('b7a385');
const limePatch = rgb('cec3b2');
const repair = rgb('a99c8b');
const skirt = rgb('9e9e97');
const asphalt = rgb('807f75');
const coping = rgb('a9a79b');
const graphite = rgb('5c6267');
const zinc = rgb('787f83');
const wornWood = rgb('6c5b50');
const dark = rgb('383c3d');
const windowGlass = rgb('677883');
const sash = rgb('b0b7b6');

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.96 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86, metallic: 0.13 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.86 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.61 },
};

const wall = outwardRing(frame.geometry.outline);
const eave = plan.dimensions.mainEaveEstimateM;
const baseBand = plan.dimensions.baseBandM;

function panel(out, slot, F, start, end, bottom, top, tone, depth = 0) {
  if (end - start < 0.015 || top - bottom < 0.015) return;
  quad4(
    out,
    slot,
    F.P(start, bottom, depth),
    F.P(end, bottom, depth),
    F.P(end, top, depth),
    F.P(start, top, depth),
    tone,
  );
}

function weathering(out, F, courseCount, y0, y1) {
  const colors = [patched, limePatch, repair, patched];
  for (let i = 0; i < courseCount; i++) {
    const spacing = F.length / courseCount;
    const start = i * spacing + spacing * 0.09;
    const end = start + spacing * (0.53 + 0.08 * (i % 4));
    const low = y0 + 0.1 + 0.4 * ((i + 1) % 3);
    const high = y1 - 0.2 - 0.48 * (i % 3);
    const tone = colors[i % colors.length];
    quad4(
      out,
      'plaster',
      F.P(start + 0.09, low, 0.009),
      F.P(end - 0.12, low + 0.14, 0.009),
      F.P(end, high, 0.009),
      F.P(start, high - 0.16, 0.009),
      tone,
    );
  }
}

function rectangularWindow(out, F, u, bottom, width, height, barred, level) {
  const left = u - width / 2;
  const right = u + width / 2;
  const top = bottom + height;
  panel(out, 'trim', F, left - 0.09, right + 0.09, bottom - 0.065, top + 0.08, repair, 0.022);
  panel(out, 'glass', F, left, right, bottom, top, barred ? dark : windowGlass, 0.04);
  if (level < 2) return;
  const mullion = barred ? zinc : sash;
  const along = barred ? [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92] : [0.11, 0.49, 0.89];
  const across = barred ? [0.14, 0.5, 0.86] : [0.09, 0.48, 0.91];
  for (const t of along) {
    const x = left + width * t;
    panel(out, 'trim', F, x - 0.021, x + 0.021, bottom - 0.03, top + 0.04, mullion, 0.076);
  }
  for (const t of across) {
    const y = bottom + height * t;
    panel(out, 'trim', F, left - 0.035, right + 0.035, y - 0.022, y + 0.022, mullion, 0.08);
  }
  if (level === 3) {
    fbox(
      out,
      'base',
      F,
      left - 0.15,
      right + 0.15,
      bottom - 0.115,
      bottom - 0.056,
      0.01,
      0.13,
      coping,
    );
  }
}

function wallFaceDetail(out, F, isProtectedYard, level) {
  if (F.length < 1.62) return;
  const count = Math.max(1, Math.floor(F.length / (isProtectedYard ? 2.65 : 2.99)));
  if (isProtectedYard && level >= 2) {
    weathering(out, F, count + 1, baseBand + 0.43, eave - 0.44);
  }
  if (!level) return;
  for (let i = 0; i < count; i++) {
    const u = ((i + 0.5) * F.length) / count;
    const small = isProtectedYard && i % 3 === 2;
    rectangularWindow(
      out,
      F,
      u,
      small ? 5.8 : 5.03,
      small ? 0.99 : 0.88,
      small ? 0.55 : 1.38,
      small,
      level,
    );
    rectangularWindow(
      out,
      F,
      u,
      isProtectedYard ? 3.02 : 2.01,
      isProtectedYard ? 1.19 : 0.92,
      isProtectedYard ? 0.45 : 1.37,
      isProtectedYard,
      level,
    );
    if (level >= 2) {
      panel(out, 'glass', F, u - 0.29, u + 0.29, 0.22, 0.53, dark, 0.06);
      panel(out, 'trim', F, u - 0.35, u + 0.35, 0.59, 0.64, coping, 0.07);
    }
  }
}

function roofVolumes(out, level) {
  const gables = [
    { a: [-13.68, -3.76], b: [9.24, -3.76], width: 13.14, heel: eave, height: 2.25 },
    { a: [2.04, 2.55], b: [2.04, 11.07], width: 13.86, heel: eave, height: 1.84 },
    { a: [1.71, 10.78], b: [1.71, 15.16], width: 6.39, heel: eave, height: 1.23 },
  ];
  for (const { a, b, width, heel, height } of gables) {
    gableRoof(out, 'roof', a, b, width, heel, heel + height, graphite, {
      overhang: 0.18,
      endSlot: 'plaster',
      endColor: plaster,
    });
  }
  if (level) {
    for (const [x, z, h] of [
      [-8.31, -3.04, 9.59],
      [6.69, -4.22, 9.46],
      [1.28, 7.19, 8.92],
    ]) {
      abox(out, 'plaster', [x - 0.23, h - 0.75, z - 0.24], [x + 0.23, h + 0.53, z + 0.24], plaster);
      abox(out, 'trim', [x - 0.27, h + 0.5, z - 0.28], [x + 0.27, h + 0.62, z + 0.28], graphite);
    }
  }
}

function build(out, level) {
  extrude(out, 'base', frame.geometry.outline, -0.48, baseBand, skirt, { top: false });
  extrude(out, 'plaster', frame.geometry.outline, baseBand, eave, plaster, { top: false });
  for (let i = 0; i < wall.length; i++) {
    const a = wall[i];
    const b = wall[(i + 1) % wall.length];
    const F = wallFace(a, b);
    const sheltered = a[0] < -0.7 && b[0] < -0.7 && a[1] > 2.75 && b[1] > 2.75;
    panel(out, 'base', F, 0, F.length, -0.12, 0.2, asphalt, 0.062);
    panel(out, 'trim', F, 0, F.length, 0.78, 0.87, coping, 0.08);
    if (level >= 1) {
      beam(
        out,
        'trim',
        F.P(0, eave - 0.03, 0.14),
        F.P(F.length, eave - 0.03, 0.14),
        0.093,
        0.112,
        graphite,
      );
    }
    if (sheltered && level >= 2 && F.length > 3.3) {
      const pipe = F.length - 0.27;
      beam(out, 'trim', F.P(pipe, 0.03, 0.115), F.P(pipe, eave - 0.046, 0.115), 0.077, 0.077, zinc);
    }
    wallFaceDetail(out, F, sheltered, level);
  }
  roofVolumes(out, level);
  const entry = wallFace([-1.486, 15.16], [4.904, 15.167]);
  panel(out, 'trim', entry, 2.56, 3.85, 0.3, 2.72, wornWood, 0.045);
  fbox(out, 'base', entry, 2.28, 4.19, -0.17, 0.31, 0.01, 0.63, skirt);
  const path = nativeParts.features[1].points;
  for (let i = 0; i + 1 < path.length; i++) {
    const F = wallFace(path[i], path[i + 1]);
    fbox(out, 'plaster', F, 0, F.length, -0.38, 1.76, -0.17, 0.17, patched);
    if (level >= 1) fbox(out, 'base', F, -0.04, F.length + 0.04, 1.74, 1.85, -0.23, 0.23, coping);
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kgb-prison-potsdam-model.mjs';
const camera = [-34, 19, 41];
const lookAt = [-2, 3.5, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'KGB Prison, Potsdam',
  wikidataId: plan.wikidataId,
  category: 'historic_house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The historic rectory at Leistikowstraße 1, now the Potsdam memorial, with its grey roofs, weathered courtyard plaster and original window openings.',
  camera,
  lookAt,
  sunDirection: [-29, 25, 44],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Mapped extent of the listed historic house at Leistikowstraße 1.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'concrete_plain', 'metal_standing_seam'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'leistikowstrasse-courtyard-return',
      position: [-13, 3.2, 14],
      lookAt: [-6.6, 3.88, 4.1],
    },
    { name: 'listed-house-street-and-roof', position: [18, 11, -25], lookAt: [-0.2, 4.8, -2] },
    { name: 'footprint-and-memorial-wall', position: [31, 46, 25], lookAt: [-2, 3.2, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kgb-prison-potsdam-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.27,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.138, surfaces },
      street: { export: 'street', errorMeters: 0.062, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.023, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

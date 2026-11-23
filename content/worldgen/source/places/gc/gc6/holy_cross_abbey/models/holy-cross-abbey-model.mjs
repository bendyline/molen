import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const terrain = read('terrain-grid.json');
const { towerApproximateTopM, churchEaveEstimateM, naveRidgeEstimateM, cloisterEaveEstimateM } =
  plan.dimensions;
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.97 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94 },
  weathered: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96 },
  slate: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.72 },
};
const wall = rgb('9b9788');
const stone = rgb('b2ab96');
const age = rgb('807e72');
const slate = rgb('5e5a5a');
const dark = rgb('444d4b');
const wood = rgb('6a5346');
const base = -1.83;

function box(out, slot, lo, hi, tint) {
  abox(out, slot, lo, hi, tint, { bottom: false });
}

function slope(out, a, b, left, right, backY, frontY) {
  quad4(
    out,
    'slate',
    [a, frontY, right],
    [b, frontY, right],
    [b, backY, left],
    [a, backY, left],
    slate,
  );
}

function roof(out, first, last, width, eave, ridge, ends = [true, true]) {
  gableRoof(out, 'slate', first, last, width, eave, ridge, slate, {
    overhang: 0.19,
    endSlot: 'wall',
    endColor: wall,
    ends,
  });
}

function window(out, f, u, y, w, h, level, mode = 'pointed') {
  if (level === 0) {
    const left = u - w / 2;
    const right = u + w / 2;
    const top = y + h * 0.84;
    quad4(
      out,
      'dark',
      f.P(left, y, 0.057),
      f.P(right, y, 0.057),
      f.P(right, top, 0.057),
      f.P(left, top, 0.057),
      dark,
    );
    return;
  }
  opening(out, f, u, y, w, h, {
    head: mode,
    glassSlot: 'dark',
    frameSlot: 'trim',
    glass: mode === 'flat' ? wood : dark,
    frame: stone,
    frameWidth: 0.16,
    frameDepth: 0.105,
    d: 0.041,
    mullions: level > 1 && w > 1.08 ? 1 : 0,
    transoms: level > 2 && h > 3.4 ? 1 : 0,
    mullionColor: stone,
  });
}

function buttress(out, f, u, y, level) {
  if (level === 0) {
    fbox(out, 'wall', f, u - 0.56, u + 0.56, base, y, -0.12, 0.74, wall);
    return;
  }
  for (const [from, to, depth, width] of [
    [base, y * 0.46, 0.94, 0.68],
    [y * 0.46, y * 0.72, 0.69, 0.61],
    [y * 0.72, y, 0.42, 0.49],
  ]) {
    fbox(out, 'wall', f, u - width, u + width, from, to, -0.12, depth, wall);
    if (level > 1)
      fbox(
        out,
        'trim',
        f,
        u - width - 0.045,
        u + width + 0.045,
        to - 0.12,
        to + 0.023,
        -0.115,
        depth + 0.062,
        stone,
      );
  }
}

function church(out, level) {
  const x0 = -25.1,
    x1 = 10.93;
  const south = 7.11,
    north = -8.48,
    upperNorth = -3.96;
  const eave = churchEaveEstimateM;
  box(out, 'wall', [x0, base, north], [x1, 5.29, south], wall);
  box(out, 'wall', [x0, 5.19, upperNorth], [x1, eave, south], wall);
  roof(out, [x0, 1.575], [x1, 1.575], south - upperNorth, eave, naveRidgeEstimateM, [true, false]);
  slope(out, x0 - 0.15, x1 + 0.05, north - 0.16, upperNorth + 0.12, 5.31, 8.03);
  const lower = facade([0, north], [-1, 0]);
  const upper = facade([0, upperNorth], [-1, 0]);
  const west = facade([x0, 0.03], [0, 1]);
  const court = facade([0, south], [1, 0]);
  for (const u of [21.7, 16.48, 11.1, 5.89, 0.63]) {
    window(out, lower, u, 1.93, 1.22, 2.6, level > 1 ? level : 0);
    if (level > 0) window(out, upper, u, 6.13, 0.77, 1.55, 0, 'flat');
  }
  for (const u of [23.91, 18.97, 13.6, 8.48, 3.26]) {
    buttress(out, lower, u, 4.48, level);
  }
  window(out, west, -1.3, 4.86, 2.6, 4.94, level);
  window(out, west, 0.36, 0.24, 1.89, 3.06, level, 'round');
  window(out, court, -5.93, 4.81, 1.87, 3.37, level);
  window(out, court, -11.44, 5.03, 1.35, 3.08, level);
  window(out, court, 0.09, 4.72, 1.35, 3.18, level);
  for (const u of [-19.82, 4.72]) buttress(out, court, u, 5.56, level);

  const east = 24.171,
    b = -9.918,
    f = 3.92;
  box(out, 'wall', [10.9, base, b], [east, 8.91, f], wall);
  roof(out, [10.88, -3], [east, -3], f - b, 8.93, 13.69, [false, true]);
  const eastFace = facade([east, -3.02], [0, -1]);
  window(out, eastFace, 0.17, 3.9, 3.31, 6.34, level);
  window(out, eastFace, -4.62, 3.72, 0.91, 2.61, 0);
  for (const u of [-5.83, 5.7]) buttress(out, eastFace, u, 8.17, level);
  const eastSide = facade([17.2, b], [-1, 0]);
  for (const u of [-5.29, -1.14, 2.07]) window(out, eastSide, u, 3.33, 1.71, 3.68, level);
  box(out, 'weathered', [18.44, base, 3.85], [22.13, 9.39, 6.78], age);
  const chapel = facade([0, 6.78], [1, 0]);
  window(out, chapel, 20.17, 2.88, 1.51, 3.44, level);

  const tx = 11.53,
    z = -16.12;
  box(out, 'wall', [5.01, base, z], [18.04, 9.06, -7.43], age);
  roof(out, [tx, z], [tx, -7.35], 13.02, 9.1, 13.63, [true, false]);
  const northGable = facade([tx, z], [-1, 0]);
  window(out, northGable, 0.1, 2.4, 3.03, 6.63, level);
  for (const u of [-5.38, 5.28]) buttress(out, northGable, u, 7.4, level);
  window(out, facade([5.013, -11.92], [0, 1]), 0, 3.6, 1.53, 3.76, level);
  window(out, facade([18.07, -12.17], [0, -1]), 0, 3.2, 1.59, 3.66, level);
}

function battlement(out, f, length, top, level) {
  const cap = top - 1.3;
  fbox(out, 'weathered', f, -0.24, length + 0.225, cap - 0.51, cap - 0.18, -0.18, 0.38, age);
  fbox(out, 'wall', f, -0.11, length + 0.11, cap - 0.2, cap + 0.25, -0.3, 0.12, wall);
  const n = Math.max(3, Math.round(length / 1.29));
  const gap = length / n;
  for (let i = 0; i <= n; i++) {
    const u = i * gap;
    const towerMerlon = level > 0 ? top - 0.29 : top;
    const a = u - gap * 0.27;
    const b = u + gap * 0.27;
    if (level === 0) {
      quad4(
        out,
        'wall',
        f.P(a, cap + 0.15, 0.083),
        f.P(b, cap + 0.15, 0.083),
        f.P(b, towerMerlon, 0.083),
        f.P(a, towerMerlon, 0.083),
        wall,
      );
      quad4(
        out,
        'wall',
        f.P(b, cap + 0.15, -0.3),
        f.P(a, cap + 0.15, -0.3),
        f.P(a, towerMerlon, -0.3),
        f.P(b, towerMerlon, -0.3),
        wall,
      );
    } else fbox(out, 'wall', f, a, b, cap + 0.15, towerMerlon, -0.32, 0.085, wall);
    if (level > 0) {
      const l = f.P(u - gap * 0.29, towerMerlon, 0.075);
      const r = f.P(u + gap * 0.29, towerMerlon, 0.075);
      const t = f.P(u, top, 0.075);
      tri(out, 'weathered', l, r, t, stone);
    }
  }
}

function tower(out, level) {
  const l = 5.12,
    r = 14.72,
    b = -7.21,
    f = 2.53;
  const top = towerApproximateTopM;
  box(out, 'wall', [l, base, b], [r, top - 1.36, f], age);
  for (const [face, length] of [
    [facade([l, f], [1, 0]), r - l],
    [facade([r, f], [0, -1]), f - b],
    [facade([r, b], [-1, 0]), r - l],
    [facade([l, b], [0, 1]), f - b],
  ]) {
    battlement(out, face, length, top, level);
    window(out, face, length * 0.5, top - 5.18, 1.13, 2.45, level > 1 ? 1 : 0);
    if (level > 1) {
      for (let i = 0.48; i < length; i += 0.91)
        fbox(out, 'trim', face, i - 0.12, i + 0.12, top - 2.15, top - 1.65, 0, 0.22, stone);
    }
  }
  box(out, 'wall', [18.06, 8.58, -9.9], [24.2, 13.95, -1.84], age);
  battlement(out, facade([24.2, -1.84], [0, -1]), 8.06, 15.51, level);
  battlement(out, facade([24.18, -9.9], [-1, 0]), 6.12, 15.51, level);
  window(out, facade([24.205, -1.845], [0, -1]), 3.88, 9.65, 1.48, 3.52, level, 'flat');
}

function range(out, x0, x1, z0, z1, eave, rise, level) {
  box(out, 'wall', [x0, base, z0], [x1, eave, z1], wall);
  const x = (x0 + x1) / 2;
  roof(out, [x, z0], [x, z1], x1 - x0, eave, eave + rise);
  const a = facade([x1, z1], [0, -1]),
    b = facade([x0, z0], [0, 1]);
  const span = z1 - z0;
  const n = Math.floor(span / 4.9);
  for (const f of [a, b]) {
    for (let i = 0; i < n; i++) {
      const u = ((i + 0.5) * span) / n;
      window(out, f, u, 0.58, 0.88, 1.95, level > 1 ? 1 : 0, 'round');
      if (level > 0) window(out, f, u, 3.62, 0.55, 0.93, 0, 'flat');
    }
  }
  window(out, facade([x, z1], [1, 0]), 0, 2.4, 0.94, 2.37, level);
}

function cloister(out, level) {
  range(out, -23.17, -14.09, 7.02, 40.14, 6.19, 4.03, level);
  range(out, 6.37, 15.18, 12.42, 45.12, 6.96, 3.82, level);
  range(out, 7.31, 11.96, 44.56, 48.11, 3.11, 1.67, level);
  box(out, 'weathered', [2.02, base, 6.95], [18.47, 4.63, 12.42], age);
  roof(out, [2.02, 9.68], [18.47, 9.68], 5.45, 4.67, 6.9);
  const x0 = -14.04,
    x1 = 5.91,
    fz = 13.18;
  const eaves = cloisterEaveEstimateM;
  slope(out, x0, x1, 7.05, fz + 0.23, 6.47, eaves);
  const inner = facade([x0, fz], [1, 0]);
  const n = 11;
  const pitch = (x1 - x0) / n,
    half = pitch * 0.37;
  const spring = 1.89;
  const peak = eaves - 0.17;
  for (let i = 0; i <= n; i++) {
    const u = i * pitch;
    fbox(out, 'wall', inner, u - 0.246, u + 0.246, base, peak + 0.13, -0.43, 0.05, wall);
    if (level > 0) {
      fbox(out, 'trim', inner, u - 0.235, u + 0.235, 1.51, 1.66, -0.45, 0.09, stone);
      fbox(out, 'trim', inner, u - 0.23, u + 0.23, 0.03, 0.15, -0.44, 0.09, stone);
    }
  }
  const steps = level === 0 ? 2 : level === 1 ? 5 : level === 2 ? 8 : 10;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * pitch;
    const cut = (j) => {
      const t = (j / steps) * Math.PI;
      return [u - half * Math.cos(t), spring + half * 0.92 * Math.sin(t)];
    };
    for (let j = 0; j < steps; j++) {
      const [a, ya] = cut(j),
        [b, yb] = cut(j + 1);
      quad4(
        out,
        'wall',
        inner.P(a, ya, 0.05),
        inner.P(b, yb, 0.05),
        inner.P(b, peak, 0.05),
        inner.P(a, peak, 0.05),
        wall,
      );
      quad4(
        out,
        'wall',
        inner.P(b, yb, -0.43),
        inner.P(a, ya, -0.43),
        inner.P(a, peak, -0.43),
        inner.P(b, peak, -0.43),
        wall,
      );
      if (level > 0)
        quad4(
          out,
          'trim',
          inner.P(a, ya, -0.43),
          inner.P(b, yb, -0.43),
          inner.P(b, yb, 0.05),
          inner.P(a, ya, 0.05),
          stone,
        );
    }
  }
  const row = Math.round((30.97 - terrain.origin[1]) / terrain.stepMeters);
  const column = Math.round((-4.5 - terrain.origin[0]) / terrain.stepMeters);
  const floor = terrain.heightsMeters[row][column] - terrain.modelDatumElevationMeters;
  fbox(
    out,
    'weathered',
    facade([-4.5, 30.97], [1, 0]),
    -7.5,
    7.2,
    floor - 0.14,
    floor + 0.49,
    -0.16,
    0.29,
    age,
  );
}

function build(out, level) {
  church(out, level);
  tower(out, level);
  cloister(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'holy-cross-abbey-model.mjs';
const camera = [81, 36, 97];
const lookAt = [-3, 8.1, 12];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Holycross Abbey',
  wikidataId: plan.wikidataId,
  category: 'abbey',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The lime-gray Cistercian abbey with crenellated tower, steep slate roofs and an open cloister.',
  camera,
  lookAt,
  sunDirection: [45, 54, -35],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Mapped restored abbey and its attached ranges.',
  },
  embeddedCanonicalGraphs: [
    'stone_limestone',
    'stone_limestone_raw',
    'stone_limestone_weathered',
    'tile_flat',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'church-and-crossing-tower', position: [62, 15.25, -62], lookAt: [2.2, 8.8, -3.2] },
    { name: 'nave-and-graveyard-side', position: [-37, 11.65, -52], lookAt: [-1.8, 8.0, -5.85] },
    { name: 'cloister-arcade-and-ranges', position: [-7.2, 8.12, 34.9], lookAt: [-4.9, 7.23, 7.1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'holycross-abbey-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.0,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.066, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

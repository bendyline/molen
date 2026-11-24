import fs from 'node:fs';
import {
  abox,
  facade,
  fbox,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const oldTop = plan.dimensions.historicMainCorniceM;
const wingTop = plan.dimensions.historicWingCorniceM;
const colors = Object.fromEntries(
  Object.entries({
    stone: 'c7c1b1',
    stoneBand: 'bcb6a7',
    brightStone: 'd4cebe',
    deepStone: '9e9686',
    blind: 'bcb7a8',
    joints: 'b2ad9f',
    window: '596263',
    iron: '646861',
    dark: '414644',
    door: '3a3d39',
    roof: '8d8e86',
    glass: 'a4b5b7',
    glassLight: 'c0cbca',
    glassDark: '7a9296',
    inside: '687677',
    neutralBox: 'adb9b7',
    paleBox: 'c7cbbe',
    mullion: '858d8a',
    roofBox: 'a5aeac',
  }).map(([key, value]) => [key, rgb(value)]),
);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.88 },
  foot: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'concrete_panel', roughness: 0.92 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.13 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51 },
  glass: {
    slot: 'window',
    localRef: 'palette:#e2eaeb',
    roughness: 0.4,
    metallic: 0.04,
    alphaMode: 'BLEND',
    baseColorFactor: [1, 1, 1, 0.64],
    doubleSided: true,
  },
  inside: { slot: 'wall', graph: 'concrete_panel', roughness: 0.84 },
};

function box(out, slot, lo, hi, color, bottom = false) {
  abox(out, slot, lo, hi, color, { bottom });
}
function panel(out, slot, f, left, right, low, high, d, color) {
  quad4(
    out,
    slot,
    f.P(left, low, d),
    f.P(right, low, d),
    f.P(right, high, d),
    f.P(left, high, d),
    color,
  );
}

function stoneWindow(out, f, u, y, w, h, level, { blind = false, transom = true } = {}) {
  const x0 = u - w / 2,
    x1 = u + w / 2,
    z = 0.031;
  panel(out, 'dark', f, x0, x1, y, y + h, z, blind ? colors.blind : colors.window);
  if (level === 0) return;
  fbox(out, 'trim', f, x0 - 0.12, x1 + 0.12, y - 0.12, y + 0.012, -0.005, 0.14, colors.brightStone);
  panel(out, 'trim', f, x0 - 0.11, x1 + 0.11, y + h, y + h + 0.102, z, colors.deepStone);
  if (level < 2) return;
  for (const x of [x0, x1]) {
    fbox(
      out,
      'trim',
      f,
      x - 0.061,
      x + 0.043,
      y,
      y + h,
      0.014,
      0.091,
      blind ? colors.joints : colors.deepStone,
    );
  }
  if (transom) {
    fbox(out, 'metal', f, x0, x1, y + h * 0.59, y + h * 0.59 + 0.071, z, 0.086, colors.iron);
  }
}
function sillAndCornice(out, f, left, right, y, level) {
  fbox(
    out,
    'trim',
    f,
    left - 0.05,
    right + 0.05,
    y - 0.82,
    y - 0.35,
    -0.08,
    0.254,
    colors.stoneBand,
  );
  fbox(
    out,
    'trim',
    f,
    left - 0.13,
    right + 0.13,
    y - 0.35,
    y - 0.115,
    -0.07,
    0.37,
    colors.brightStone,
  );
  fbox(
    out,
    'trim',
    f,
    left - 0.19,
    right + 0.19,
    y - 0.125,
    y + 0.052,
    -0.05,
    0.53,
    colors.stoneBand,
  );
  if (level > 1) {
    fbox(out, 'trim', f, left, right, y - 0.77, y - 0.704, 0.24, 0.3, colors.deepStone);
  }
}
function plinth(out, f, left, right, top) {
  fbox(out, 'foot', f, left, right, -1.72, top, -1.15, 0.06, colors.deepStone);
  fbox(
    out,
    'trim',
    f,
    left - 0.025,
    right + 0.025,
    top - 0.13,
    top + 0.045,
    -0.13,
    0.137,
    colors.stoneBand,
  );
}

function middle(out, level) {
  const x0 = -15.72,
    x1 = 15.6,
    z0 = -17.75,
    z1 = 14.07;
  const f = facade([0, z1], [1, 0]);
  box(out, 'stone', [x0, -1.64, z0], [x1, oldTop, 13.07], colors.stone);
  box(out, 'roof', [x0, oldTop - 0.07, z0], [x1, oldTop, 14.0], colors.roof);
  for (const [a, b] of [
    [x0, -3.27],
    [3.27, x1],
  ]) {
    fbox(out, 'stone', f, a, b, 0.96, oldTop, -1.09, 0, colors.stone);
    plinth(out, f, a, b, 1.28);
  }
  fbox(out, 'stone', f, -3.29, 3.29, 8.26, oldTop, -1.1, 0, colors.stone);
  fbox(out, 'trim', f, -3.4, -3.12, 1.8, 8.39, -0.36, 0.2, colors.brightStone);
  fbox(out, 'trim', f, 3.12, 3.4, 1.8, 8.39, -0.36, 0.2, colors.brightStone);
  fbox(out, 'trim', f, -3.39, 3.39, 8.16, 8.47, -0.27, 0.2, colors.brightStone);
  panel(out, 'dark', f, -3.08, 3.08, 2.02, 8.16, -0.946, colors.dark);
  for (const u of [-2.08, -1.04, 0, 1.04, 2.08]) {
    panel(out, 'metal', f, u - 0.051, u + 0.051, 2.05, 6.77, -0.91, colors.iron);
  }
  if (level > 1) {
    for (const h of [2.12, 3.25, 4.5, 5.75, 6.78]) {
      fbox(out, 'metal', f, -2.92, 2.92, h - 0.042, h + 0.04, -0.949, -0.88, colors.iron);
    }
    panel(out, 'metal', f, -2.94, 2.94, 6.85, 7.82, -0.9, colors.door);
  }
  const stairCount = level === 0 ? 4 : 8;
  for (let j = 0; j < stairCount; j++) {
    const t = (j + 1) / stairCount;
    fbox(
      out,
      'foot',
      f,
      -5.19 + 0.45 * t,
      5.19 - 0.45 * t,
      -0.37,
      0.18 + 1.85 * t,
      -0.14,
      3.17 - 2.73 * t,
      j % 2 === 0 ? colors.stoneBand : colors.deepStone,
    );
  }
  fbox(out, 'foot', f, -6.61, -5.03, -0.63, 0.58, -0.6, 3.07, colors.stoneBand);
  fbox(out, 'foot', f, 5.03, 6.61, -0.63, 0.58, -0.6, 3.07, colors.stoneBand);
  for (const y of [9.62, 11.95]) {
    fbox(out, 'trim', f, x0, x1, y - 0.055, y + 0.105, -0.06, 0.138, colors.brightStone);
  }
  for (const u of [-12.37, -8.99, -5.63, 5.63, 8.99, 12.37]) {
    stoneWindow(out, f, u, 2.49, 1.66, 3.22, level, { blind: u > 0, transom: false });
    if (level > 0) stoneWindow(out, f, u, 6.37, 1.74, 1.88, level, { blind: true, transom: false });
    if (level > 0) stoneWindow(out, f, u, 0.12, 1.05, 0.73, level, { transom: false });
  }
  for (const u of [-13.65, -10.24, -6.83, -3.42, 0.0, 3.42, 6.83, 10.24, 13.65]) {
    stoneWindow(out, f, u, 10.22, 2.84, 3.1, level);
  }
  sillAndCornice(out, f, x0, x1, oldTop, level);
}

function wing(out, sign, level) {
  const left = sign < 0 ? -27.21 : 15.6,
    right = sign < 0 ? -15.71 : 27.17;
  const z1 = sign < 0 ? 17.85 : 17.79,
    z0 = -17.73;
  const center = (left + right) / 2;
  box(out, 'stone', [left, -1.59, z0], [right, wingTop, z1], colors.stone);
  box(out, 'roof', [left, wingTop - 0.09, z0], [right, wingTop + 0.01, z1], colors.roof);
  const f = facade([center, z1], [1, 0]),
    w = (right - left) / 2;
  const outer = facade([sign < 0 ? left : right, 0], [0, -sign]);
  plinth(out, f, -w, w, 1.32);
  plinth(out, outer, sign < 0 ? z0 : -z1, sign < 0 ? z1 : -z0, 1.32);
  for (const [u0, u1] of [
    [-w, -w + 0.39],
    [w - 0.39, w],
  ]) {
    fbox(out, 'trim', f, u0, u1, 1.34, wingTop - 0.35, -0.04, 0.14, colors.brightStone);
  }
  for (const y of [2.04, 5.67, 9.16]) {
    for (const u of [-2.63, 2.63]) stoneWindow(out, f, u, y, 2.06, 2.04, level);
    const centers = level === 0 ? [-11.7, -1.2, 8.2] : [-13.2, -8.81, -4.4, 0, 4.4, 8.81, 13.2];
    for (const u of centers) stoneWindow(out, outer, u, y, 1.9, 1.97, level);
  }
  sillAndCornice(out, f, -w, w, wingTop, level);
  sillAndCornice(out, outer, sign < 0 ? z0 : -z1, sign < 0 ? z1 : -z0, wingTop, level);
  if (level > 1) {
    for (let i = 0; i < 6; i++) {
      const y = 2.1 + i * 1.73;
      panel(out, 'trim', f, -w, w, y, y + 0.052, 0.014, colors.joints);
      panel(
        out,
        'trim',
        outer,
        sign < 0 ? z0 : -z1,
        sign < 0 ? z1 : -z0,
        y,
        y + 0.053,
        0.016,
        colors.joints,
      );
    }
  }
}

function rear(out, level) {
  const f = facade([0, -17.75], [-1, 0]);
  const ranges = [
    [-27.17, -15.6, wingTop],
    [-15.6, 15.72, oldTop],
    [15.72, 27.21, wingTop],
  ];
  for (const [l, r, h] of ranges) {
    sillAndCornice(out, f, l, r, h, level);
    fbox(out, 'trim', f, l, r, 4.49, 4.67, -0.12, 0.12, colors.stoneBand);
    const n = level === 0 ? 3 : Math.round((r - l) / 3.7);
    for (let i = 0; i < n; i++) {
      const u = l + ((r - l) * (i + 0.5)) / n;
      for (const y of [2.02, 5.55, 9.04]) stoneWindow(out, f, u, y, 1.78, 2.06, level);
    }
  }
}
function glassAddition(out, level) {
  const half = plan.dimensions.glassWidthM / 2,
    front = 10.83,
    back = front - plan.dimensions.glassDepthM;
  const base = oldTop + 0.044,
    top = plan.dimensions.glassTopM;
  box(
    out,
    'inside',
    [-half + 0.39, base - 0.045, back + 0.41],
    [half - 0.39, base + 0.49, front - 0.4],
    colors.inside,
  );
  box(
    out,
    'inside',
    [-half + 1.08, base + 0.45, back + 0.72],
    [half - 1.15, 22.19, 1.45],
    colors.neutralBox,
  );
  box(
    out,
    'inside',
    [-half + 0.76, 19.26, 1.28],
    [-6.15, 24.46, front - 0.86],
    colors.paleBox,
    true,
  );
  box(out, 'inside', [0.47, base + 0.46, 1.38], [half - 1.2, 21.21, front - 0.93], colors.roofBox);
  box(out, 'inside', [-5.43, 21.49, back + 1.08], [12.9, 24.37, -1.43], colors.roofBox, true);
  box(
    out,
    'roof',
    [-half + 0.9, top - 0.37, back + 0.8],
    [half - 0.9, top - 0.14, front - 0.87],
    colors.roofBox,
  );
  const fs = [
    [facade([0, front], [1, 0]), half * 2, 0],
    [facade([0, back], [-1, 0]), half * 2, 0],
    [facade([half, 0], [0, -1]), front - back, -(front + back) / 2],
    [facade([-half, 0], [0, 1]), front - back, (front + back) / 2],
  ];
  for (const [f, width, offset] of fs) {
    const l = offset - width / 2,
      r = offset + width / 2;
    const n = Math.round(width / [4.15, 2.31, 1.67, 1.19][level]);
    for (let i = 0; i < n; i++) {
      const x = l + (width * i) / n,
        next = l + (width * (i + 1)) / n;
      const tints = [colors.glass, colors.glassLight, colors.glass, colors.glassDark, colors.glass];
      panel(out, 'glass', f, x + 0.006, next - 0.006, base + 0.08, top, 0, tints[i % 5]);
      if (i && level > 0) {
        fbox(
          out,
          'metal',
          f,
          x - 0.023,
          x + 0.023,
          base,
          top + 0.01,
          -0.022,
          0.044,
          colors.mullion,
        );
      }
    }
    for (const h of level === 0
      ? [base + 0.09, top - 0.09]
      : [base + 0.09, 18.09, 21.52, top - 0.09]) {
      fbox(out, 'metal', f, l, r, h, h + 0.066, -0.039, 0.048, colors.mullion);
    }
  }
}
function build(out, level) {
  middle(out, level);
  wing(out, -1, level);
  wing(out, 1, level);
  rear(out, level);
  glassAddition(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'house-of-european-history-model.mjs';
const camera = [43, 26, 67],
  lookAt = [0, 10.15, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'House of European History',
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
    'Pale limestone Eastman Building with symmetrical wings, sunken entrance and the museum’s translucent glass addition.',
  camera,
  lookAt,
  sunDirection: [-31, 57, 63],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.87,
    basis:
      'Native Eastman Building perimeter, including the shallow central park frontage setback.',
  },
  embeddedCanonicalGraphs: ['stone_limestone', 'stone_ashlar', 'concrete_panel', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'leopold-park-front-and-glass-museum',
      position: [-0.5, 6.2, 59],
      lookAt: [0, 11.4, 11.7],
    },
    { name: 'stone-steps-and-park-entrance', position: [-23, 7.2, 38], lookAt: [-0.9, 8.7, 14.8] },
    {
      name: 'three-level-glass-box-and-roof-detail',
      position: [37, 28, -43],
      lookAt: [0, 14.5, -3],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'house-of-european-history-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.74,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.32, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.052, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, OpenStreetMap geometry under ODbL and Mapzen elevations under source attribution terms.',
};

import fs from 'node:fs';
import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { squareBaseWidthM, squareBaseHeightM, overallHeightM, lanternDiameterM } = plan.dimensions;
const z0 = -4.135;
const z1 = 4.135;
const floor = -0.48;
const baseTop = floor + squareBaseHeightM;
const front = facade([0, z1], [1, 0]);
const rear = facade([0, z0], [-1, 0]);
const lanternRadius = lanternDiameterM / 2;
const lightFloor = floor + plan.dimensions.roundTowerFloorOfLanternM;
const tip = floor + overallHeightM;

const painted = rgb('dad9cf');
const drum = rgb('d2d1c8');
const fascia = rgb('c8c6b9');
const stone = rgb('b2aa98');
const blueStone = rgb('9a9b93');
const lead = rgb('787d7d');
const roofSeam = rgb('8b8e89');
const metal = rgb('676f6b');
const glass = rgb('99aeae');
const lanternCore = rgb('bbad80');
const recess = rgb('50605d');
const trim = rgb('e2dfd3');

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_basalt_raw', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.85 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.78 },
  glass: {
    slot: 'window',
    localRef: 'palette:#ecefed',
    roughness: 0.42,
    baseColorFactor: [1, 1, 1, 0.61],
    alphaMode: 'BLEND',
  },
};

const round = (profile) => profile.map(([y, r]) => [y, r, r]);
const angle = (i, n) => (i * 2 * Math.PI) / n;
const circle = (i, n, r, y, x = 0, z = 0) => [
  x + r * Math.cos(angle(i, n)),
  y,
  z + r * Math.sin(angle(i, n)),
];

function box(out, slot, x0, x1, low, high, color, near = z0, far = z1) {
  abox(out, slot, [x0, low, near], [x1, high, far], color, { bottom: false });
}

function windowBand(out, F, u, y, width, height, level, isDoor = false) {
  if (level === 0) {
    fbox(out, 'detail', F, u - width / 2, u + width / 2, y, y + height, 0.025, 0.052, recess);
    return;
  }
  opening(out, F, u, y, width, height, {
    head: 'flat',
    frameSlot: 'trim',
    glassSlot: 'detail',
    frame: fascia,
    glass: recess,
    frameWidth: 0.11,
    frameDepth: 0.14,
    d: 0.055,
    sill: !isDoor,
    mullions: isDoor || level > 1 ? 1 : 0,
    transoms: level > 1 ? 1 : 0,
    mullionColor: trim,
  });
  fbox(
    out,
    'trim',
    F,
    u - width * 0.65,
    u + width * 0.65,
    y + height + 0.13,
    y + height + 0.31,
    0.012,
    0.179,
    trim,
  );
  if (isDoor)
    fbox(out, 'base', F, u - 0.76, u + 0.76, floor - 0.15, y - 0.06, -0.035, 0.55, blueStone);
}

function base(out, level) {
  box(out, 'base', -11.62, 11.62, -1.68, floor + 0.24, blueStone);
  box(out, 'wall', -11.62, 11.62, floor, floor + 4.46, painted);
  box(out, 'trim', -11.73, 11.73, floor + 0.05, floor + 0.27, stone, z0 - 0.11, z1 + 0.11);
  box(out, 'trim', -11.74, 11.74, floor + 4.29, floor + 4.61, trim, z0 - 0.12, z1 + 0.12);
  box(out, 'trim', -11.67, 11.67, floor + 4.6, floor + 4.84, fascia, z0 - 0.066, z1 + 0.066);
  box(out, 'roof', -11.53, 11.53, floor + 4.83, floor + 4.98, lead, z0 + 0.09, z1 - 0.09);
  const half = squareBaseWidthM / 2;
  box(out, 'wall', -half, half, floor + 3.87, baseTop + 0.19, painted, -half, half);
  box(
    out,
    'trim',
    -half - 0.13,
    half + 0.13,
    baseTop - 0.21,
    baseTop + 0.05,
    trim,
    -half - 0.13,
    half + 0.13,
  );

  for (const u of [-5.28, 0, 5.28]) {
    windowBand(out, front, u, floor + 0.53, 1.24, 2.8, level, true);
    if (level > 0)
      for (let i = 0; i < 5; i++) {
        const x = u + (i - 2) * 0.23;
        beam(
          out,
          'trim',
          front.P(x, floor + 3.57, 0.066),
          front.P(u + (x - u) * 1.3, floor + 3.86 - 0.06 * Math.abs(i - 2), 0.074),
          0.09,
          0.07,
          fascia,
        );
      }
  }
  for (const u of [-8.95, 8.95]) {
    windowBand(out, front, u, floor + 1.16, 0.96, 1.91, level);
    if (level > 0) windowBand(out, rear, u, floor + 1.16, 0.96, 1.91, level);
  }
  for (const side of [-1, 1]) {
    const F = side < 0 ? wallFace([-11.62, z0], [-11.62, z1]) : wallFace([11.62, z1], [11.62, z0]);
    windowBand(out, F, F.length * 0.5, floor + 1.12, 1.02, 1.92, level);
  }
  if (level > 0) {
    windowBand(out, rear, 0, floor + 1.34, 0.95, 1.56, level);
    const gable = [
      [-2.17, baseTop - 0.66],
      [2.17, baseTop - 0.66],
      [0, baseTop - 0.11],
    ];
    fan(
      out,
      'trim',
      gable.map(([x, y]) => front.P(x, y, 0.06)),
      trim,
    );
    beam(
      out,
      'trim',
      front.P(-2.3, baseTop - 0.63, 0.073),
      front.P(2.3, baseTop - 0.63, 0.073),
      0.075,
      0.08,
      fascia,
    );
  }
}

function dome(out, x, baseY, radius, height, sides, level, color) {
  const levels = level < 2 ? 4 : 6;
  const profile = [
    [baseY - 0.075, radius],
    [baseY, radius],
  ];
  for (let i = 1; i <= levels; i++) {
    const t = (i * Math.PI) / (2 * levels);
    profile.push([baseY + height * Math.sin(t), radius * Math.cos(t)]);
  }
  lathe(out, 'roof', [x, 0], round(profile), sides, color);
  if (level > 1) {
    for (let i = 0; i < sides; i += level === 3 ? 2 : 3) {
      const line = profile.slice(1).map(([y, r]) => circle(i, sides, r + 0.013, y + 0.022, x));
      beamPath(out, 'roof', line, 0.053, 0.036, roofSeam);
    }
  }
}

function sideDomes(out, level) {
  const sides = [8, 16, 24, 28][level];
  for (const x of [-8.74, 8.74]) {
    const y = floor + 5.87;
    const profile = [
      [floor + 4.82, 2.5],
      [floor + 5.6, 2.48],
      [floor + 5.72, 2.57],
      [y, 2.49],
    ];
    lathe(out, 'wall', [x, 0], round(profile), sides, painted, { capTop: false });
    dome(out, x, y, 2.47, 1.97, sides, level, lead);
    const vent = [
      [y + 1.82, 0.36],
      [y + 2.14, 0.37],
      [y + 2.24, 0.31],
      [y + 2.31, 0.35],
      [y + 2.47, 0.17],
      [y + 2.56, 0.09],
    ];
    const cap = level === 0 ? [vent[0], vent[4]] : vent;
    lathe(out, 'roof', [x, 0], round(cap), level < 2 ? 8 : 12, metal);
  }
}

function shaft(out, level) {
  const y0 = baseTop;
  const y1 = lightFloor;
  const profile = [
    [y0 - 0.035, 3.3],
    [y0 + 0.32, 3.3],
    [y0 + 0.62, 3.12],
    [y0 + 1.04, 3.02],
    [y0 + 1.3, 2.94],
    [y1 - 3.28, 2.63],
    [y1 - 3.04, 2.76],
    [y1 - 2.88, 2.81],
    [y1 - 2.6, 2.64],
    [y1 - 1.36, 2.59],
    [y1 - 1.12, 2.75],
    [y1 - 0.9, 2.9],
    [y1 - 0.69, 3.25],
    [y1 - 0.47, 3.3],
  ];
  const reduced = level === 0 ? profile.filter((_, i) => [0, 4, 5, 7, 9, 13].includes(i)) : profile;
  lathe(out, 'wall', [0, 0], round(reduced), [12, 18, 26, 32][level], painted, { capTop: false });
  const ledge = [
    [y1 - 0.54, 3.18],
    [y1 - 0.3, 3.38],
    [y1 + 0.22, 3.53],
    [y1 + 0.3, 3.51],
  ];
  lathe(out, 'base', [0, 0], round(ledge), [12, 18, 26, 32][level], blueStone);
  if (level === 0) return;
  for (const sign of [-1, 1]) {
    const F = facade([0, sign * 2.68], [sign, 0]);
    const shaftFace = facade([0, sign * 2.83], [sign, 0]);
    opening(out, shaftFace, 0, y0 + 4.91, 0.39, 0.8, {
      head: 'round',
      frameSlot: 'trim',
      glassSlot: 'detail',
      frame: fascia,
      glass: recess,
      frameWidth: 0.08,
      frameDepth: 0.085,
      d: 0.105,
      sill: false,
    });
    fbox(out, 'trim', F, -1.12, 1.12, y1 - 2.6, y1 - 1.42, -0.22, -0.08, fascia);
    fbox(out, 'wall', F, -1.03, 1.03, y1 - 2.51, y1 - 1.52, -0.08, -0.046, painted);
  }
}

function galleryRail(out, level) {
  const n = [12, 18, 26, 32][level];
  const y = lightFloor + 1.28;
  const top = Array.from({ length: n }, (_, i) => circle(i, n, 3.53, y));
  beamPath(out, 'roof', top, 0.091, 0.075, metal, true);
  if (level === 0) return;
  const low = Array.from({ length: n }, (_, i) => circle(i, n, 3.47, y - 0.76));
  beamPath(out, 'roof', low, 0.065, 0.063, metal, true);
  const posts = [12, 24, 38, 52][level];
  for (let j = 0; j < posts; j++)
    beam(
      out,
      'roof',
      circle(j, posts, 3.44, y - 0.96),
      circle(j, posts, 3.53, y),
      0.051,
      0.058,
      metal,
    );
}

function lantern(out, level) {
  const n = [8, 12, 14, 16][level];
  const sill = lightFloor + 0.51;
  const eave = floor + 23.3;
  const mullion = [0.071, 0.077, 0.063, 0.056][level];
  lathe(
    out,
    'trim',
    [0, 0],
    round([
      [lightFloor + 0.285, 2.03],
      [sill, 1.95],
      [sill + 0.32, 1.92],
    ]),
    n,
    fascia,
    { capTop: false },
  );
  lathe(
    out,
    'glass',
    [0, 0],
    round([
      [sill + 0.3, lanternRadius],
      [eave, lanternRadius],
    ]),
    n,
    glass,
    { capTop: false },
  );
  if (level > 0) {
    const low = sill + 0.34;
    const mid = (low + eave) / 2;
    for (let i = 0; i < n; i++) {
      const r = lanternRadius + 0.06;
      const a = circle(i, n, r, low);
      const b = circle(i, n, r, eave);
      beam(out, 'roof', a, b, mullion * 0.95, mullion * 0.7, metal);
      if (level < 2) continue;
      const m1 = circle(i - 0.48, n, r, mid);
      const m2 = circle(i + 0.48, n, r, mid);
      for (const m of [m1, m2]) {
        beam(out, 'roof', a, m, mullion, mullion * 0.7, metal);
        beam(out, 'roof', m, b, mullion, mullion * 0.7, metal);
      }
    }
    const optic = [
      [sill + 0.22, 0.59],
      [sill + 1.28, 0.66],
      [sill + 1.45, 1.07],
      [sill + 2.84, 1.07],
      [sill + 3.08, 0.71],
    ];
    lathe(out, 'trim', [0, 0], round(optic), n, lanternCore);
  }
  dome(out, 0, eave, 1.99, 1.52, n, level, lead);
  const top = [
    [eave + 1.37, 0.29],
    [eave + 1.54, 0.25],
    [eave + 1.64, 0.22],
    [eave + 1.71, 0.33],
    [eave + 1.87, 0.34],
    [eave + 1.99, 0.23],
    [eave + 2.1, 0.092],
  ];
  lathe(out, 'roof', [0, 0], round(top), n, metal);
  beam(out, 'roof', [0, eave + 2.07, 0], [0, tip, 0], 0.069, 0.069, metal);
  if (level > 0)
    beam(out, 'roof', [-0.46, tip - 0.46, 0], [0.59, tip - 0.46, 0], 0.07, 0.061, metal);
}

function build(out, level) {
  base(out, level);
  sideDomes(out, level);
  shaft(out, level);
  galleryRail(out, level);
  lantern(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'macquarie-lighthouse-model.mjs';
const camera = [-35, 19, 45];
const lookAt = [0, 11.8, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Macquarie Lighthouse',
  wikidataId: plan.wikidataId,
  category: 'lighthouse',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Sydney’s 1883 Macquarie Lighthouse with white tapered stone tower, twin leaded domes and diamond-glazed Chance lantern.',
  camera,
  lookAt,
  sunDirection: [-34, 55, 42],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Named mapped rectangle for Barnet’s standing lighthouse and attached bays.',
  },
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'stone_sandstone_raw',
    'stone_basalt_raw',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'barnet-landward-elevation', position: [-1.4, 5.3, 42.5], lookAt: [0, 12.07, 0] },
    {
      name: 'diagonal-glazing-and-bluestone-gallery',
      position: [11, 23.4, 19.5],
      lookAt: [0, 21.3, 0],
    },
    {
      name: 'ocean-side-tower-and-domed-rooms',
      position: [31, 13.4, -35],
      lookAt: [0, 10.7, -0.7],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'macquarie-lighthouse-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

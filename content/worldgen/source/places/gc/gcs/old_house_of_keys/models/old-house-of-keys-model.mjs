import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fan,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = frame.geometry.outline;
const ring = outwardRing(outline);
const [left, frontZ] = outline[0];
const right = outline[1][0];
const mid = (left + right) / 2;
const backZ = outline[2][1];
const front = facade([mid, frontZ], [1, 0]);
const eave = plan.dimensions.primaryEaveHeightEstimateM;
const ridgeY = plan.dimensions.primaryRidgeHeightEstimateM;

const plaster = rgb('c7c5ba');
const masonry = rgb('c2c0b7');
const shadow = rgb('b6b3a8');
const dress = rgb('d0cbb8');
const porch = rgb('b3ac97');
const base = rgb('9d8f80');
const joint = rgb('a4a094');
const slate = rgb('77766e');
const backSlate = rgb('696d68');
const lead = rgb('837260');
const pot = rgb('a98160');
const sash = rgb('d3d1c7');
const glaze = rgb('575c5a');
const door = rgb('353534');
const red = rgb('9f382f');
const badge = rgb('45566a');
const roundProfile = (profile) => profile.map(([height, radius]) => [height, radius, radius]);

const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.92 },
  foundation: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.98 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.73 },
};

function shells(out, level) {
  extrude(out, 'foundation', ring, -1.0, 0.34, base, { top: false });
  extrude(out, 'wall', ring, 0.32, 4.07, masonry, { top: false });
  extrude(out, 'wall', ring, 4.07, eave + 0.025, plaster, { top: false });
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    if (F.length < 4) continue;
    fbox(out, 'trim', F, 0, F.length, 4.01, 4.15, -0.01, 0.115, dress);
    fbox(out, 'trim', F, 0, F.length, eave - 0.13, eave - 0.025, -0.01, 0.145, shadow);
    if (level > 1)
      for (let j = 1; j < Math.floor(F.length / 0.58); j++) {
        const u = j * 0.58;
        fbox(out, 'trim', F, u - 0.045, u + 0.045, eave - 0.22, eave - 0.1, 0.09, 0.185, dress);
      }
  }
}

function makeSash(out, F, u, y, width, height, level) {
  if (level === 0) {
    fbox(out, 'detail', F, u - width / 2, u + width / 2, y, y + height, 0.041, 0.061, glaze);
    return;
  }
  opening(out, F, u, y, width, height, {
    frameSlot: 'detail',
    glassSlot: 'detail',
    frame: sash,
    glass: glaze,
    frameWidth: 0.062,
    frameDepth: 0.065,
    d: 0.08,
    sill: true,
    mullions: level >= 2 ? 2 : 1,
    transoms: level >= 2 ? 2 : 1,
  });
  fbox(
    out,
    'trim',
    F,
    u - width / 2 - 0.11,
    u + width / 2 + 0.11,
    y - 0.124,
    y - 0.054,
    0.032,
    0.179,
    dress,
  );
}

function registerPanel(out, u, level) {
  const half = 0.97;
  const spring = 3.43;
  const count = level < 2 ? 4 : 10;
  const border = [
    [u - half, 0.39],
    [u + half, 0.39],
  ];
  for (let i = 0; i <= count; i++) {
    const t = (i * Math.PI) / count;
    border.push([u + half * Math.cos(t), spring + 0.36 * Math.sin(t)]);
  }
  fan(
    out,
    'wall',
    border.map(([x, y]) => front.P(x, y, 0.043)),
    shadow,
  );
  if (level > 1)
    for (let i = 2; i < border.length - 1; i++) {
      const [x, y] = border[i],
        [nx, ny] = border[i + 1];
      const p = ([u, y], lift) => front.P(u, y + lift, 0.052);
      quad4(out, 'trim', p([nx, ny], 0), p([x, y], 0), p([x, y], 0.028), p([nx, ny], 0.028), joint);
    }
}

function parliamentElevation(out, level) {
  const corner = (right - left) / 2;
  if (level > 0) {
    const courses = 10;
    for (let i = 1; i < courses; i++) {
      const y = 0.35 + (i * 3.66) / courses;
      fbox(out, 'wall', front, -corner + 0.01, corner - 0.01, y, y + 0.019, 0.006, 0.023, joint);
      if (level < 2) continue;
      for (let x = -corner + 0.44 + 0.39 * (i % 2); x < corner; x += 0.89)
        fbox(out, 'wall', front, x - 0.008, x + 0.008, y - 0.345, y, 0.005, 0.021, joint);
    }
  }
  for (const u of [-3.23, 3.23]) {
    registerPanel(out, u, level);
    makeSash(out, front, u, 1.12, 1.05, 1.93, level);
  }
  for (const u of [-3.26, 0, 3.21]) makeSash(out, front, u, 4.52, 1.08, 1.49, level);

  const L = frontZ - backZ;
  for (const side of [-1, 1]) {
    const F = side < 0 ? wallFace(outline[5], outline[0]) : wallFace(outline[1], outline[2]);
    for (const t of [0.21, 0.46, 0.72, 0.87]) {
      makeSash(out, F, t * L, 4.54, 0.74, 1.41, level);
      if (side < 0 || level > 0) makeSash(out, F, t * L, 1.0, 0.76, 1.55, level);
    }
  }
  const rear = facade([mid, backZ], [-1, 0]);
  for (const u of [-3.5, -0.7, 2.35]) makeSash(out, rear, u, 4.5, 0.81, 1.33, level);
  if (level > 0) makeSash(out, rear, 2.46, 1.1, 0.8, 1.62, level);
  fbox(out, 'detail', rear, -1.75, -0.76, 0.11, 2.26, 0.025, 0.065, door);
}

function entrance(out, level) {
  const steps = level === 0 ? 5 : level === 1 ? 8 : 12;
  const radius = (w, d) =>
    outwardRing(
      Array.from({ length: steps + 1 }, (_, i) => {
        const t = (i * Math.PI) / steps;
        return [mid + w * Math.cos(t), frontZ + d * Math.sin(t) - 0.045];
      }),
    );
  const canopy = [
    [2.66, 1.24, 0.91],
    [2.83, 1.43, 1.03],
    [2.93, 1.52, 1.09],
    [3.055, 1.45, 1.025],
    [3.12, 1.25, 0.86],
    [3.21, 1.14, 0.78],
  ];
  loft(
    out,
    'trim',
    canopy.map(([y, w, d]) => radius(w, d).map(([x, z]) => [x, y, z])),
    porch,
  );
  const step = radius(1.49, 1.12);
  extrude(out, 'trim', step, -0.33, 0.09, base, { top: false });
  fan(
    out,
    'trim',
    step.map(([x, z]) => [x, 0.09, z]),
    porch,
  );
  fbox(out, 'trim', front, -0.78, 0.78, 0.075, 0.19, 0.0, 0.41, dress);
  fbox(out, 'detail', front, -0.5, 0.5, 0.17, 2.4, 0.03, 0.064, door);
  if (level > 0) {
    fbox(out, 'trim', front, -0.6, 0.6, 2.37, 2.47, 0.04, 0.135, dress);
    for (const u of [-0.554, 0.554])
      fbox(out, 'trim', front, u - 0.05, u + 0.05, 0.16, 2.43, 0.04, 0.126, dress);
    for (const y of [0.59, 1.46, 1.94])
      fbox(out, 'detail', front, -0.39, 0.39, y, y + 0.041, 0.065, 0.086, glaze);
  }
  const profile = [
    [0.09, 0.188],
    [0.18, 0.195],
    [0.26, 0.146],
    [2.43, 0.124],
    [2.52, 0.15],
    [2.6, 0.178],
    [2.72, 0.177],
  ];
  for (const u of [-0.98, 0.98])
    lathe(
      out,
      'trim',
      [mid + u, frontZ + 0.61],
      roundProfile(profile),
      [6, 8, 12, 16][level],
      porch,
    );

  if (level === 0) return;
  fbox(out, 'detail', front, -0.31, 0.31, 3.17, 3.66, 0.5, 0.574, badge);
  beam(out, 'detail', front.P(0, 3.18, 0.62), front.P(0, 9.15, 0.62), 0.046, 0.046, sash);
  const a = front.P(0, 8.35, 0.65),
    b = front.P(0, 8.87, 0.65);
  const c = front.P(-0.68, 8.72, 0.75),
    d = front.P(-1.21, 8.7, 0.5);
  const e = front.P(-1.21, 8.25, 0.46),
    g = front.P(-0.68, 8.25, 0.73);
  for (const poly of [
    [a, g, c, b],
    [g, e, d, c],
  ]) {
    quad4(out, 'detail', ...poly, red);
    quad4(out, 'detail', ...poly.slice().reverse(), red);
  }
}

function roofs(out, level) {
  const x0 = left - 0.19,
    x1 = right + 0.19;
  const frontEave = frontZ + 0.22,
    rearEave = backZ - 0.2;
  const first = [x0 + 2.28, ridgeY, 3.58],
    last = [x1 - 2.28, ridgeY, 3.58];
  const sw = [x0, eave, frontEave],
    se = [x1, eave, frontEave];
  const vw = [x0, eave, 1.17],
    ve = [x1, eave, 1.17];
  const br = [x0 + 2.13, eave + 1.94, -0.95],
    er = [x1 - 2.13, eave + 1.94, -0.95];
  const nw = [x0, eave, rearEave],
    ne = [x1, eave, rearEave];

  quad4(out, 'roof', sw, se, last, first, slate);
  quad4(out, 'roof', ve, vw, first, last, backSlate);
  tri(out, 'roof', vw, sw, first, slate);
  tri(out, 'roof', se, ve, last, slate);

  quad4(out, 'roof', vw, ve, er, br, backSlate);
  quad4(out, 'roof', ne, nw, br, er, slate);
  tri(out, 'roof', nw, vw, br, backSlate);
  tri(out, 'roof', ve, ne, er, slate);
  if (level > 0) {
    const paths = [
      [sw, first],
      [se, last],
      [first, last],
      [vw, first],
      [ve, last],
      [nw, br],
      [ne, er],
      [er, br],
      [sw, se],
      [nw, ne],
    ];
    for (const [a, b] of paths) beam(out, 'trim', a, b, 0.071, 0.067, lead);
  }
  for (const x of [mid - 2.96, mid + 2.96]) {
    const chimney = facade([x, 0.98], [1, 0]);
    fbox(out, 'wall', chimney, -0.66, 0.66, 7.02, 10.16, -0.48, 0.42, plaster);
    fbox(out, 'trim', chimney, -0.72, 0.72, 10.13, 10.24, -0.55, 0.49, porch);
    for (const u of [-0.37, 0, 0.37]) {
      const cap =
        level === 0
          ? [
              [10.2, 0.109],
              [10.72, 0.095],
            ]
          : [
              [10.2, 0.128],
              [10.46, 0.102],
              [10.65, 0.097],
              [10.73, 0.127],
            ];
      lathe(out, 'trim', [x + u, 0.97], roundProfile(cap), [6, 6, 8, 10][level], pot);
    }
  }
}

function build(out, level) {
  shells(out, level);
  parliamentElevation(out, level);
  entrance(out, level);
  roofs(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'old-house-of-keys-model.mjs';
const camera = [-18, 14, 31];
const lookAt = [0.5, 4.6, 2.5];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Old House of Keys',
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
    'Castletown’s Georgian Old House of Keys with a curved columned porch, three-bay sash frontage and twin slate roof ridges.',
  camera,
  lookAt,
  sunDirection: [-41, 57, 36],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Named registered Old House of Keys building polygon.',
  },
  embeddedCanonicalGraphs: ['stucco', 'stone_limestone_raw', 'slate'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'parliament-square-and-columned-entrance',
      position: [-8.9, 3.35, 27.3],
      lookAt: [0.3, 4.7, 6.1],
    },
    { name: 'castle-rushen-quarter-view', position: [-14, 13.7, 23], lookAt: [0.3, 5.5, 2.9] },
    { name: 'chimneys-and-rear-roof', position: [16, 12.1, -15], lookAt: [0.25, 4.9, 1.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'old-house-of-keys-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.58,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.27, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.049, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaces = {
  siding: { slot: 'wall', graph: 'wood_plain', roughness: 0.92 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.83 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.73 },
};
const cream = rgb('d2c6ad');
const boards = rgb('c2b9a6');
const boardsDark = rgb('9b9688');
const carved = rgb('bdb096');
const white = rgb('d2d8cf');
const paleBlue = rgb('9eb2b2');
const deepRed = rgb('8d4845');
const gray = rgb('626a71');
const shadowRoof = rgb('575f64');
const glass = rgb('454a47');
const iron = rgb('717271');
const frameX = 1.3;
const front = 7.27;
const postZ = 10.1;
const postR = 0.184;
const story = 4.86;
const wallRing = outwardRing([
  [-8.64, front],
  [8.19, front],
  [8.68, 6.61],
  [8.68, -9.47],
  [-3.62, -9.47],
  [-3.62, -6.58],
  [-6.53, -6.58],
  [-6.53, -4.65],
  [-8.64, -4.65],
]);

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function hip(out, x0, x1, z0, z1, eave, ridge) {
  const a = [x0, eave, z1],
    b = [x1, eave, z1],
    c = [x1, eave, z0],
    d = [x0, eave, z0];
  const m = (z0 + z1) / 2;
  const u = [x0 + (x1 - x0) * 0.23, ridge, m],
    v = [x1 - (x1 - x0) * 0.23, ridge, m];
  quad4(out, 'roof', a, b, v, u, gray);
  quad4(out, 'roof', c, d, u, v, shadowRoof);
  tri(out, 'roof', b, c, v, gray);
  tri(out, 'roof', d, a, u, shadowRoof);
  abox(out, 'roof', [x0, eave - 0.16, z0], [x1, eave - 0.015, z1], shadowRoof, { bottom: true });
}

function window(out, F, x, y, w, h, level, barred = false) {
  const span = [0, 2, 4, 5][level];
  opening(out, F, x, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass,
    frame: cream,
    frameWidth: level >= 2 ? 0.1 : 0.06,
    frameDepth: 0.08,
    sill: level > 0,
    d: 0.055,
    mullions: span,
    transoms: barred ? (level > 1 ? 1 : 0) : span,
    mullionColor: cream,
  });
  if (barred && level >= 2) {
    for (let i = 1; i <= 8; i++) {
      const u = x + (i / 9 - 0.5) * w;
      fbox(out, 'iron', F, u - 0.013, u + 0.013, y + 0.07, y + h - 0.07, 0.12, 0.145, iron);
    }
  }
}

function siding(out, level) {
  extrude(out, 'plaster', wallRing, -0.43, 0.98, deepRed, { top: false });
  extrude(out, 'siding', wallRing, 0.96, 8.13, boards, { top: false });
  if (level >= 1) {
    for (let i = 0; i < wallRing.length; i++) {
      const F = wallFace(wallRing[i], wallRing[(i + 1) % wallRing.length]);
      fbox(out, 'trim', F, 0, F.length, 4.38, 4.69, -0.03, 0.073, cream);
      fbox(out, 'trim', F, 0, F.length, 7.96, 8.13, -0.03, 0.093, cream);
      if (level >= 2) {
        const spacing = level === 3 ? 0.185 : 0.33;
        for (let y = 1.13; y < 7.97; y += spacing) {
          quad4(
            out,
            'siding',
            F.P(0.02, y, 0.024),
            F.P(F.length - 0.02, y, 0.024),
            F.P(F.length - 0.02, y + 0.023, 0.018),
            F.P(0.02, y + 0.023, 0.018),
            boardsDark,
          );
        }
      }
    }
  }
  const F = facade([0, front], [1, 0]);
  for (const x of [-5.71, 6.47]) {
    window(out, F, x, 1.63, 2.23, 2.09, level, true);
    window(out, F, x, 5.63, 2.18, 1.96, level);
    if (level >= 2) fbox(out, 'trim', F, x - 1.05, x + 1.05, 4.92, 5.44, 0.018, 0.06, carved);
  }
  window(out, F, frameX, 1.39, 2.67, 2.72, level, true);
  window(out, F, frameX, 5.14, 2.88, 2.61, level);
  if (level >= 1) {
    const left = facade([-8.64, 0], [0, 1]);
    for (const z of [-2.57, 0.44, 3.62]) {
      window(out, left, z, 1.82, 1.44, 1.85, level, true);
      window(out, left, z, 5.68, 1.44, 1.82, level);
    }
    const right = facade([8.68, 0], [0, -1]);
    for (const u of [-3.97, 0.42, 4.55, 7.22]) {
      window(out, right, u, 1.88, 1.53, 1.68, level, true);
      window(out, right, u, 5.54, 1.5, 1.85, level);
    }
    const back = facade([0, -9.47], [-1, 0]);
    for (const u of [-5.81, -1.96, 1.26]) {
      window(out, back, u, 1.78, 1.45, 1.83, level);
      window(out, back, u, 5.42, 1.44, 1.95, level);
    }
  }
}

function squarePost(out, x, z, base, top, level, color, radius = postR) {
  if (level < 2) {
    box(out, 'trim', x - radius, x + radius, z - radius, z + radius, base, top, color);
    return;
  }
  const layers = [
    [base, radius * 1.42, radius * 1.42],
    [base + 0.19, radius * 1.42, radius * 1.42],
    [base + 0.3, radius, radius],
    [top - 0.29, radius * 0.95, radius * 0.95],
    [top - 0.16, radius * 1.36, radius * 1.36],
    [top, radius * 1.39, radius * 1.39],
  ];
  lathe(out, 'trim', [x, z], layers, level === 3 ? 8 : 4, color, { rotation: Math.PI / 4 });
}

function balustrade(out, F, a, b, y, level) {
  fbox(out, 'trim', F, a, b, y + 0.67, y + 0.79, -0.12, 0.12, white);
  fbox(out, 'trim', F, a, b, y, y + 0.112, -0.13, 0.13, white);
  const count = Math.ceil((b - a) / (level < 2 ? 0.62 : 0.27));
  for (let i = 1; i < count; i++) {
    const [x, , z] = F.P(a + (i / count) * (b - a), 0);
    if (level === 0) continue;
    const layers = [
      [y + 0.1, 0.086, 0.086],
      [y + 0.22, 0.061, 0.061],
      [y + 0.33, 0.098, 0.098],
      [y + 0.51, 0.053, 0.053],
      [y + 0.68, 0.069, 0.069],
    ];
    if (level >= 2)
      lathe(out, 'trim', [x, z], layers, 4, white, { capTop: false, rotation: Math.PI / 4 });
    else box(out, 'trim', x - 0.063, x + 0.063, z - 0.063, z + 0.063, y + 0.1, y + 0.68, white);
  }
}

function ironRail(out, F, a, b, y, level) {
  fbox(out, 'iron', F, a, b, y + 0.9, y + 0.965, -0.045, 0.045, iron);
  fbox(out, 'iron', F, a, b, y + 0.12, y + 0.165, -0.036, 0.036, iron);
  const panels = Math.ceil((b - a) / (level < 2 ? 0.85 : 0.32));
  for (let i = 1; i < panels; i++) {
    const x = a + (i / panels) * (b - a);
    fbox(out, 'iron', F, x - 0.018, x + 0.018, y + 0.16, y + 0.9, -0.025, 0.025, iron);
    if (level === 3 && i % 3 === 0) {
      const x0 = x - 0.25,
        x1 = x + 0.25;
      quad4(
        out,
        'iron',
        F.P(x0, y + 0.34, 0.031),
        F.P(x1, y + 0.77, 0.031),
        F.P(x1, y + 0.81, 0.031),
        F.P(x0, y + 0.38, 0.031),
        white,
      );
      quad4(
        out,
        'iron',
        F.P(x0, y + 0.78, 0.032),
        F.P(x0, y + 0.74, 0.032),
        F.P(x1, y + 0.32, 0.032),
        F.P(x1, y + 0.36, 0.032),
        white,
      );
    }
  }
}

function frontPorch(out, level) {
  const x0 = -2.07,
    x1 = 4.98,
    z0 = 7.15,
    z1 = 10.5;
  box(out, 'plaster', x0, x1, z0, z1, -0.42, 1.24, carved);
  box(out, 'trim', x0 - 0.08, x1 + 0.08, z0, z1 + 0.04, 1.17, 1.39, white);
  box(out, 'siding', x0 - 0.08, x1 + 0.08, z0, z1 + 0.1, 4.52, story, carved);
  box(out, 'trim', x0 - 0.16, x1 + 0.16, z0, z1 + 0.16, 4.49, 4.62, white);
  box(out, 'trim', x0 - 0.17, x1 + 0.17, z0, z1 + 0.17, 4.84, 4.99, cream);
  for (const x of [x0 + 0.28, x1 - 0.24]) {
    squarePost(out, x, postZ, 1.35, 4.51, level, paleBlue);
    squarePost(out, x, postZ, 4.95, 8.55, level, white, 0.155);
  }

  const F = facade([0, z1 - 0.13], [1, 0]);
  balustrade(out, F, -1.53, 4.63, 1.35, level);
  if (level >= 1) {
    ironRail(out, F, x0 + 0.19, x1 - 0.19, 4.93, level);
    ironRail(out, facade([x0, 0], [0, 1]), z0 + 0.2, z1 - 0.32, 4.93, level);
    ironRail(out, facade([x1, 0], [0, -1]), -z1 + 0.32, -z0 - 0.2, 4.93, level);
  }
  const bays = level === 0 ? 4 : 8;
  for (let i = 0; i < bays; i++) {
    const base = (i * 1.4) / bays;
    const top = ((i + 1) * 1.4) / bays;
    const tread = 13.18 - (i * 2.79) / bays;
    box(out, 'plaster', -3.97, -1.79, 10.37, tread, base, top, deepRed);
    if (level > 0) {
      for (const x of [-4.04, -1.73]) {
        box(out, 'plaster', x - 0.088, x + 0.088, 10.36, tread + 0.04, base, top + 0.08, white);
      }
    }
  }
  box(out, 'plaster', -4.08, -1.65, 8.95, 10.54, -0.09, 1.37, deepRed);
  box(out, 'siding', x0 - 0.09, x1 + 0.09, z0, z1, 8.36, 9.1, carved);
  box(out, 'trim', x0 - 0.12, x1 + 0.12, z0, z1 + 0.08, 8.32, 8.48, cream);
  const soffitHalfWidth = 4.53;
  abox(
    out,
    'roof',
    [frameX - soffitHalfWidth, 8.88, 4.41],
    [frameX + soffitHalfWidth, 9.01, 11.18],
    shadowRoof,
    { bottom: true },
  );
  box(out, 'siding', frameX - 3.99, frameX + 3.99, 10.5, 10.66, 9.0, 9.27, boards);
  window(out, facade([0, 10.68], [1, 0]), frameX, 9.21, 1.34, 0.76, level);

  gableRoof(out, 'roof', [frameX, 4.92], [frameX, 10.65], 8.0, 9.26, 11.3, gray, {
    overhang: 0.55,
    endSlot: 'siding',
    endColor: boards,
    ends: [false, true],
  });
  if (level > 0) {
    const edge = facade([frameX, 11.23], [1, 0]);
    for (const pair of [
      [-4.58, -3.58],
      [3.58, 4.58],
    ])
      fbox(out, 'trim', edge, pair[0], pair[1], 8.76, 9.03, -0.78, 0, white);
  }
}

function carriageTerrace(out, level) {
  const l = -15.28,
    r = -8.47,
    b = 3.44,
    f = 7.83;
  box(out, 'plaster', l, r, b, f, 4.03, 4.45, carved);
  for (const x of [l + 0.22, r - 0.19]) {
    for (const z of [b + 0.22, f - 0.22]) squarePost(out, x, z, 0, 4.07, level, cream, 0.19);
  }
  const F = facade([0, f], [1, 0]);
  const profiles = [
    [l, 3.03],
    [l + 1.36, 3.44],
    [l + 3.28, 3.93],
    [r - 1.08, 3.5],
    [r, 3.08],
  ];
  for (let j = 1; j < profiles.length; j++) {
    const [a, ay] = profiles[j - 1],
      [bb, by] = profiles[j];
    quad4(out, 'plaster', F.P(a, ay), F.P(bb, by), F.P(bb, 4.4), F.P(a, 4.4), carved);
  }
  if (level >= 1) {
    box(out, 'trim', l - 0.07, r + 0.07, b - 0.05, f + 0.05, 4.37, 4.52, cream);
    balustrade(out, F, l + 0.02, r - 0.06, 4.5, level);
    balustrade(out, facade([l, 0], [0, 1]), b + 0.06, f - 0.075, 4.5, level);
  }
}

function build(out, level) {
  siding(out, level);
  hip(out, -10.01, 10.26, -10.8, 8.64, 8.05, 9.93);
  frontPorch(out, level);
  carriageTerrace(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'hofilena-ancestral-house-model.mjs';
const camera = [-27, 19, 33],
  lookAt = [-1.5, 4.4, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Hofileña Ancestral House in Silay, with its two-storey porch, weatherboard exterior, broad eaves and carriage terrace.',
  camera,
  lookAt,
  sunDirection: [-36, 51, 55],
  mediumFiContext: {
    scale: 1.23,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.82,
    basis:
      'Named mapped house footprint with the facade and carriage terrace facing Cinco de Noviembre Street.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'cinco-de-noviembre-street', position: camera, lookAt },
    {
      name: 'weatherboards-and-stacked-porch',
      position: [-7.2, 5.1, 21.5],
      lookAt: [1.2, 4.8, 8.55],
    },
    { name: 'open-carriage-terrace', position: [-25, 10.9, 13.6], lookAt: [-10, 3.8, 5.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hofilena-ancestral-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.46,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.21, surfaces },
      street: { export: 'street', errorMeters: 0.066, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.02, surfaces },
    },
  },
};

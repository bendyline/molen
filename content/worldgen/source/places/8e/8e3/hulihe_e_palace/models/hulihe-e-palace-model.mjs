import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const surfaces = {
  stucco: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84 },
  painted: { slot: 'trim', graph: 'wood_vertical', roughness: 0.88 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.92 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.85 },
};

const cream = rgb('c0b095');
const light = rgb('d3c8ad');
const lava = rgb('767368');
const roofGreen = rgb('658f7d');
const roofDark = rgb('567668');
const paint = rgb('aeb7a4');
const paintLight = rgb('c5c8ae');
const shutter = rgb('5e7465');
const dark = rgb('4d524b');
const wood = rgb('796251');
const front = -6.78;
const rear = front + plan.dimensions.wallDepthM;
const end = plan.dimensions.wallLengthM / 2;
const bay = rear + plan.dimensions.lanaiDepthM;
const ground = 0.88;
const deck = 4.19;
const fascia = 7.51;

function box(out, slot, [x0, z0], [x1, z1], y0, y1, tone) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], tone, { bottom: false });
}

function panel(out, slot, F, at, base, width, height, depth, tone) {
  const a = at - width / 2;
  const b = at + width / 2;
  quad4(
    out,
    slot,
    F.P(a, base, depth),
    F.P(b, base, depth),
    F.P(b, base + height, depth),
    F.P(a, base + height, depth),
    tone,
  );
}

function sash(out, F, at, y, w, h, level, shutters = true) {
  panel(out, 'trim', F, at, y - 0.11, w + 0.23, h + 0.23, 0.031, light);
  panel(out, 'dark', F, at, y, w, h, 0.049, dark);
  if (level > 0) {
    panel(out, 'trim', F, at, y, 0.059, h, 0.068, paintLight);
    panel(out, 'trim', F, at, y + h * 0.51, w, 0.053, 0.072, paintLight);
  }
  if (shutters) {
    for (const s of [-1, 1]) {
      const u = at + s * (w / 2 + 0.25);
      panel(out, 'painted', F, u, y, 0.47, h, 0.074, shutter);
      if (level > 1)
        for (let t = 0.1; t < h - 0.08; t += level === 3 ? 0.1 : 0.22)
          panel(out, 'trim', F, u, y + t, 0.4, 0.022, 0.08, roofDark);
    }
  }
  if (level > 1) {
    fbox(
      out,
      'stucco',
      F,
      at - w * 0.66 - 0.08,
      at + w * 0.66 + 0.08,
      y - 0.15,
      y - 0.018,
      0.0,
      0.19,
      light,
    );
    if (level === 3) panel(out, 'stucco', F, at, y + h + 0.11, w + 0.35, 0.2, 0.068, light);
  }
}

function portal(out, F, u, floor, height, level) {
  panel(out, 'stucco', F, u, floor, 1.49, height + 0.19, 0.046, light);
  panel(out, 'dark', F, u, floor + 0.08, 1.16, height - 0.06, 0.067, wood);
  if (level > 0)
    for (const offset of [-0.26, 0.26]) {
      panel(out, 'trim', F, u + offset, floor + 0.27, 0.4, height * 0.35, 0.077, wood);
      panel(out, 'dark', F, u + offset, floor + height * 0.57, 0.39, height * 0.35, 0.081, dark);
    }
}

function mainBlock(out, level) {
  box(out, 'stone', [-end, front], [end, rear], -1.46, ground, lava);
  box(out, 'stucco', [-end, front], [end, rear], ground, fascia + 0.64, cream);
  const eaveY = fascia + 0.69;
  const ridge = [10.18, (front + rear - 0.43) / 2];
  const left = -end - 1.02;
  const right = end + 1.04;
  const ends = [
    [front - 0.52, -1],
    [rear + 0.09, 1],
  ];
  for (const [edge, facing] of ends) {
    const points = [
      [left, eaveY, edge],
      [right, eaveY, edge],
      [right, ridge[0], ridge[1]],
      [left, ridge[0], ridge[1]],
    ];
    if (facing < 0) points.reverse();
    quad4(out, 'roof', ...points, roofGreen);
    const underside = points.map(([x, y, z]) => [x, y - 0.08, z]).reverse();
    quad4(out, 'roof', ...underside, roofDark);
  }
  for (const side of [-1, 1]) {
    const x = side * end;
    const points = [
      [x, fascia + 0.6, front],
      [x, ridge[0] - 0.08, ridge[1]],
      [x, fascia + 0.6, rear],
    ];
    if (side < 0) points.reverse();
    tri(out, 'stucco', ...points, cream);
  }
  const roads = facade([0, front], [-1, 0]);
  const sea = facade([0, rear], [1, 0]);
  for (const F of [roads, sea]) {
    portal(out, F, 0.18, ground, 2.52, level);
    for (const x of [-7.09, -4.29, 3.91, 7.11]) {
      sash(out, F, x, ground + 0.47, 0.94, 1.77, level);
      sash(out, F, x, deck + 0.51, 0.93, 1.78, level);
    }
    if (F === sea) portal(out, sea, -2.38, deck, 2.61, level);
    else sash(out, roads, 0.1, deck + 0.43, 1.06, 1.83, level);
  }
  for (const s of [-1, 1]) {
    const F = facade([s * end, 0], [0, -s]);
    for (const at of [-4.09, -0.35, 2.25]) {
      sash(out, F, at, ground + 0.51, 0.83, 1.69, level);
      sash(out, F, at, deck + 0.45, 0.83, 1.74, level);
    }
    if (level > 0) {
      const center = ((rear + front) / 2) * -s;
      for (const u of [-0.97, 0.97]) sash(out, F, center + u, 8.55, 0.61, 0.8, level, false);
    }
  }
}

function post(out, x, z, base, top, level) {
  box(out, 'painted', [x - 0.13, z - 0.14], [x + 0.13, z + 0.14], base, top, paint);
  if (level > 0)
    for (const h of [base + 0.11, top - 0.18])
      box(out, 'painted', [x - 0.19, z - 0.19], [x + 0.19, z + 0.19], h, h + 0.11, paintLight);
  if (level > 1) {
    const F = facade([x, z], [1, 0]);
    for (const s of [-1, 1]) {
      const path = [
        F.P(s * 0.12, top - 0.41, 0.131),
        F.P(s * 0.35, top - 0.23, 0.117),
        F.P(s * 0.68, top - 0.17, 0.109),
      ];
      beamPath(out, 'trim', path, 0.064, 0.087, paintLight);
      if (level === 3)
        beam(
          out,
          'trim',
          F.P(s * 0.35, top - 0.24, 0.117),
          F.P(s * 0.45, top - 0.41, 0.124),
          0.051,
          0.061,
          paintLight,
        );
    }
  }
}

function rail(out, F, from, to, floor, level) {
  for (const y of [floor + 0.14, floor + 0.86])
    fbox(out, 'painted', F, from, to, y, y + 0.092, -0.051, 0.09, paintLight);
  if (level > 0)
    for (let u = from + 0.13; u < to - 0.1; u += [0.57, 0.44, 0.23, 0.148][level]) {
      panel(out, 'trim', F, u, floor + 0.21, level > 1 ? 0.059 : 0.081, 0.67, 0.055, paint);
      if (level === 3) panel(out, 'trim', F, u, floor + 0.47, 0.1, 0.1, 0.06, paintLight);
    }
}

function stairs(out, level) {
  const count = [5, 10, 14, 18][level];
  const x0 = 3.17;
  const x1 = 9.05;
  const z0 = bay - 1.03;
  const z1 = bay - 0.07;
  for (let i = 0; i < count; i++) {
    const t = i / count;
    const h = ground + ((deck - ground) * (i + 1)) / count;
    const start = x0 + (x1 - x0) * t;
    box(
      out,
      'painted',
      [start, z0],
      [start + (x1 - x0) / count + 0.03, z1],
      h - 0.16,
      h,
      paintLight,
    );
  }
  for (const z of [z0, z1]) {
    beam(out, 'painted', [x0, ground + 0.1, z], [x1, deck + 0.11, z], 0.14, 0.26, paint);
    beam(out, 'painted', [x0, ground + 0.99, z], [x1, deck + 0.98, z], 0.105, 0.096, paintLight);
    if (level > 0)
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const x = x0 + (x1 - x0) * t;
        const y = ground + (deck - ground) * t;
        if (level > 1)
          beam(out, 'trim', [x, y + 0.14, z], [x, y + 0.94, z], 0.057, 0.065, paintLight);
        else panel(out, 'trim', facade([0, z], [1, 0]), x, y + 0.14, 0.07, 0.8, 0.01, paintLight);
      }
  }
}

function lanai(out, level) {
  box(out, 'painted', [-end - 0.09, rear], [end + 0.1, bay], ground - 0.205, ground, paintLight);
  box(out, 'painted', [-end - 0.09, rear], [end + 0.1, bay - 1.06], deck - 0.205, deck, paintLight);
  for (const [left, right] of [
    [-end - 0.09, 6.17],
    [9.08, end + 0.1],
  ])
    box(out, 'painted', [left, bay - 1.06], [right, bay], deck - 0.205, deck, paintLight);
  const frontPosts = [-9.4, -5.58, -1.87, 1.88, 5.59, 9.38];
  for (const x of frontPosts) {
    post(out, x, bay - 0.18, ground, deck - 0.2, level);
    post(out, x, bay - 0.18, deck, fascia - 0.17, level);
  }
  const y = fascia - 0.14;
  const a = [-end - 1.02, y, bay + 0.54];
  const b = [end + 1.04, y, bay + 0.54];
  const c = [end + 1.04, fascia + 0.69, rear + 0.09];
  const d = [-end - 1.02, fascia + 0.69, rear + 0.09];
  quad4(out, 'roof', a, b, c, d, roofGreen);
  quad4(
    out,
    'painted',
    [d[0], d[1] - 0.13, d[2]],
    [c[0], c[1] - 0.13, c[2]],
    [b[0], b[1] - 0.13, b[2]],
    [a[0], a[1] - 0.13, a[2]],
    paint,
  );
  beam(
    out,
    'painted',
    a.map((v, i) => (i === 1 ? v - 0.09 : v)),
    b.map((v, i) => (i === 1 ? v - 0.09 : v)),
    0.21,
    0.25,
    paint,
  );
  if (level > 1)
    for (let x = a[0] + 0.14; x < b[0]; x += level === 3 ? 0.31 : 0.63)
      beam(
        out,
        'roof',
        [x, y + 0.027, bay + 0.53],
        [x, fascia + 0.701, rear + 0.098],
        0.032,
        0.028,
        roofDark,
      );
  const face = facade([0, bay - 0.13], [1, 0]);
  for (const [left, right] of [
    [-end, -1.46],
    [1.46, 3.26],
  ])
    rail(out, face, left, right, ground, level);
  rail(out, face, -end, 6.17, deck, level);
  for (const x of [-end, end]) {
    const F = facade([x, 0], [0, x < 0 ? 1 : -1]);
    const [left, right] = x < 0 ? [rear, bay - 0.13] : [-bay + 0.13, -rear];
    for (const base of [ground, deck]) rail(out, F, left, right, base, level);
  }
  stairs(out, level);
  for (let k = 0; k < 4; k++)
    box(
      out,
      'stucco',
      [-1.45, bay + k * 0.27],
      [1.45, bay + 0.32 + k * 0.27],
      -0.11,
      ground - (k + 1) * 0.167,
      light,
    );
}

function accessory(out, level) {
  const porch = facade([0, front], [-1, 0]);
  for (const x of [-1.62, 1.62]) post(out, x, front - 1.54, ground, 3.82, level);
  gableRoof(out, 'roof', [0, front - 1.95], [0, front + 0.17], 3.66, 3.81, 4.78, roofGreen, {
    endSlot: 'stucco',
    endColor: cream,
  });
  fbox(out, 'stone', porch, -1.85, 1.85, -0.12, ground - 0.04, -0.18, 1.95, lava);
  const endPorch = facade([end, -1.41], [0, -1]);
  fbox(out, 'stone', endPorch, -1.26, 1.21, -0.41, ground - 0.02, 0, 0.79, lava);
  box(out, 'stucco', [-18.89, -1.74], [-end + 0.02, 2.58], -0.26, 3.01, cream);
  gableRoof(out, 'roof', [-18.99, 0.39], [-end + 0.18, 0.39], 4.46, 3.03, 4.18, roofGreen, {
    endSlot: 'stucco',
    endColor: cream,
  });
  if (level > 0) {
    const F = facade([-14.1, 2.59], [1, 0]);
    panel(out, 'painted', F, 0, 0.79, 6.76, 1.54, 0.026, paint);
    if (level > 1)
      for (let u = -3.2; u < 3.32; u += 0.23)
        panel(out, 'trim', F, u, 0.82, 0.07, 1.43, 0.043, roofDark);
  }
}

function build(out, level) {
  mainBlock(out, level);
  lanai(out, level);
  accessory(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'hulihe-e-palace-model.mjs';
const camera = [30, 14, 37];
const lookAt = [-2.6, 4.15, 1.2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The restored Huliheʻe Palace in Kailua-Kona, with its green roof and two-storey waterfront lanai.',
  camera,
  lookAt,
  sunDirection: [-22, 42, 53],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Named native palace footprint and attached service range.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_basalt', 'metal_standing_seam', 'wood_vertical'],
  recipeDependencies: ['authored-structure-mesh.mjs', 'place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'waterfront-lanai-and-stairs', position: [13, 5.6, 30], lookAt: [-0.2, 4.65, 4.9] },
    { name: 'ali-i-drive-front-porch', position: [-15, 7.3, -26], lookAt: [-1.2, 4.51, -4.4] },
    {
      name: 'gable-shutters-and-service-range',
      position: [-24, 8.2, 15],
      lookAt: [-7.1, 4.31, 0.8],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hulihee-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.89,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.36, surfaces },
      street: { export: 'street', errorMeters: 0.12, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

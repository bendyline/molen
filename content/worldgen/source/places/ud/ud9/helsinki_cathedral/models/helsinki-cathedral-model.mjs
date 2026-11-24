import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const map = read('native-map/helsinki-mapped-cathedral-parts');
const white = rgb('e2dfd8');
const ivory = rgb('d6d3ca');
const stucco = rgb('b8b7b1');
const paleShade = rgb('aaa9a3');
const highlight = rgb('e9e4d9');
const granite = rgb('a79f95');
const redGranite = rgb('987e70');
const oxidized = rgb('547067');
const roofBase = rgb('667a70');
const brass = rgb('bfa25c');
const door = rgb('765c4b');
const glass = rgb('61717a');
const clock = rgb('4c6663');
const base = 9.49;

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.92 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  copper: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.87, metallic: 0.14 },
  ornament: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.93 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.62 },
};

function meanCenter(ring) {
  return [0, 1].map((i) => ring.reduce((sum, p) => sum + p[i], 0) / ring.length);
}

const centers = map.parts
  .filter((p) => p.tags['building:part'] === 'column')
  .map((p) => ({ center: meanCenter(p.points), height: Number(p.tags.height) }));
const smallerDomes = map.parts
  .filter((p) => p.tags['roof:shape'] === 'dome' && p.tags.height === '34')
  .map((p) => meanCenter(p.points));
const towerCenter = meanCenter(map.parts.find((p) => p.id === '1542850746').points);
const porticoes = [
  { axis: [0, 1], depth: 29.16, back: 16.27 },
  { axis: [1, 0], depth: 29.64, back: 16.4 },
  { axis: [0, -1], depth: 29.83, back: 16.12 },
  { axis: [-1, 0], depth: 28.93, back: 16.32 },
];

function panel(out, slot, F, l, r, bottom, top, color, depth = 0) {
  quad4(
    out,
    slot,
    F.P(l, bottom, depth),
    F.P(r, bottom, depth),
    F.P(r, top, depth),
    F.P(l, top, depth),
    color,
  );
}

function steps(out, level) {
  const stairs = [5, 14, 28, plan.dimensions.stairRisers][level];
  const width = plan.dimensions.stairWidthM;
  const bottomZ = map.steps.points[0][1] + 0.32;
  const topZ = map.steps.points.at(-1)[1] - 0.64;
  const rise = base - 0.3;
  const run = (bottomZ - topZ) / stairs;
  for (let i = 0; i < stairs; i++) {
    const t = bottomZ - i * run;
    const y = 0.3 + (rise * (i + 1)) / stairs;
    const underside = i === 0 ? -0.3 : 0.15 + (rise * i) / stairs;
    abox(out, 'granite', [-width / 2, underside, t - run], [width / 2, y, t], granite);
  }
  abox(out, 'granite', [-width / 2, base - 0.45, 26.42], [width / 2, base, topZ + 0.02], granite);
  if (!level) return;
  for (const s of [-1, 1]) {
    const [left, right] = [s * 30.04, s * 31.83].sort((a, b) => a - b);
    for (let i = 0; i < 5; i++) {
      abox(
        out,
        'granite',
        [left, -0.2, bottomZ - ((i + 1) * (bottomZ - 29)) / 5],
        [right, 0.45 + (i + 1) * 1.88, bottomZ - (i * (bottomZ - 29)) / 5],
        redGranite,
      );
    }
    abox(
      out,
      'granite',
      [s < 0 ? -54.5 : 31.73, 0.05, 47.8],
      [s < 0 ? -31.78 : 54.5, base - 1.16, 51.1],
      redGranite,
    );
    for (const z of [31.0, 46.7, 52.9]) {
      abox(
        out,
        'ornament',
        [left - 0.18, base - 0.27, z - 0.43],
        [right + 0.18, base - 0.01, z + 0.43],
        granite,
      );
    }
  }
}

function column(out, center, bottom, height, radius, level) {
  const shaft = [
    [bottom, radius, radius],
    [bottom + height, radius * 0.89, radius * 0.89],
  ];
  const capitals = [
    [bottom, radius * 1.2, radius * 1.2],
    [bottom + 0.39, radius * 1.2, radius * 1.2],
    [bottom + 0.65, radius, radius],
    [bottom + height - 0.93, radius * 0.84, radius * 0.84],
    [bottom + height - 0.48, radius * 1.22, radius * 1.22],
    [bottom + height, radius * 1.27, radius * 1.27],
  ];
  const profile = level < 2 ? shaft : capitals;
  lathe(out, 'ornament', center, profile, [4, 8, 12, 16][level], white, { capTop: false });
  if (level < 2) return;
  for (const [x, z] of [
    [-1, -1],
    [-1, 1],
    [1, 1],
    [1, -1],
  ]) {
    const [a, b] = center;
    const u = a + x * radius * 0.65,
      v = b + z * radius * 0.65;
    abox(
      out,
      'ornament',
      [u - 0.12, bottom + height - 0.52, v - 0.12],
      [u + 0.12, bottom + height - 0.13, v + 0.12],
      highlight,
    );
  }
}

function glazedPanel(out, F, u, y, w, h, level, style = 'flat') {
  opening(out, F, u, y, w, h, {
    head: style,
    glassSlot: 'glass',
    glass,
    frameSlot: 'ornament',
    frame: ivory,
    d: 0.045,
    frameWidth: level >= 2 ? 0.11 : 0,
    frameDepth: 0.14,
    sill: false,
  });
  if (level < 2) return;
  for (let j = 1; j <= 3; j++) {
    const n = y + (j * (h - (style === 'round' ? w / 2 : 0))) / 4;
    panel(out, 'ornament', F, u - w / 2, u + w / 2, n - 0.029, n + 0.029, highlight, 0.091);
  }
  panel(out, 'ornament', F, u - 0.035, u + 0.035, y, y + h - 0.17, highlight, 0.097);
}

function portico(out, item, level) {
  const [dx, dz] = item.axis;
  const dir = [dz, -dx];
  const front = facade([dx * item.depth, dz * item.depth], dir);
  const wall = facade([dx * (item.depth - 5.4), dz * (item.depth - 5.4)], dir);
  const ridgeA = [dx * item.back, dz * item.back];
  const ridgeB = [dx * (item.depth + 0.03), dz * (item.depth + 0.03)];
  const toe = base + 0.1;
  const cap = base + 16.05;
  const width = 24.71;
  fbox(out, 'plaster', wall, -12.02, 12.02, toe, cap + 0.02, -10.55, -0.13, stucco);
  fbox(out, 'granite', front, -12.88, 12.88, base - 0.31, toe, -6.4, 1.19, granite);
  fbox(out, 'ornament', front, -12.55, 12.55, cap - 1.57, cap, -6.15, 0.15, white, {
    bottom: true,
  });
  fbox(out, 'ornament', front, -12.86, 12.86, cap - 0.35, cap + 0.02, -6.45, 0.42, highlight);
  gableRoof(out, 'copper', ridgeA, ridgeB, width, cap, base + 20.65, roofBase, {
    overhang: 0.18,
    endSlot: 'ornament',
    endColor: ivory,
  });
  if (!level) return;
  const moldFront = 0.09;
  const p0 = front.P(-12.45, cap + 0.16, moldFront);
  const p1 = front.P(0, base + 20.62, moldFront);
  const p2 = front.P(12.45, cap + 0.16, moldFront);
  for (const [a, b] of [
    [p0, p1],
    [p1, p2],
    [p0, p2],
  ])
    beam(out, 'ornament', a, b, 0.32, 0.32, highlight);
  panel(out, 'ornament', wall, -12.0, 12.0, base + 1.04, base + 1.26, paleShade, 0.04);
  fbox(out, 'ornament', wall, -2.36, 2.36, base + 0.13, base + 7.18, -0.1, 0.11, white);
  fbox(out, 'ornament', wall, -1.82, 1.82, base + 0.18, base + 4.22, 0.1, 0.14, door);
  for (const u of [-8.6, 0, 8.6]) {
    glazedPanel(out, wall, u, base + (u === 0 ? 4.45 : 6.85), 2.4, 3.05, level);
  }
  if (level >= 2) {
    for (let i = -11; i <= 11; i++) {
      fbox(out, 'ornament', front, i - 0.11, i + 0.11, cap - 0.58, cap - 0.35, 0.13, 0.31, white);
    }
  }
}

function dome(out, center, footing, radius, rise, level, main) {
  const span = [8, 14, 24, 36][level];
  const low = [footing, radius, radius];
  const rim = [footing + rise * 0.12, radius * 0.986, radius * 0.986];
  const shoulder = [footing + rise * 0.53, radius * 0.85, radius * 0.85];
  const upper = [footing + rise * 0.85, radius * 0.53, radius * 0.53];
  const peak = [footing + rise, 0.06, 0.06];
  const shape = level === 0 ? [low, shoulder, peak] : [low, rim, shoulder, upper, peak];
  lathe(out, 'copper', center, shape, span, oxidized);
  const [x, z] = center;
  const finialY = footing + rise;
  const height = main ? 5.65 : 3.56;
  beam(
    out,
    'ornament',
    [x, finialY - 0.05, z],
    [x, finialY + height, z],
    main ? 0.24 : 0.125,
    main ? 0.24 : 0.125,
    brass,
  );
  if (level >= 1) {
    const q = main ? 0.54 : 0.28;
    lathe(
      out,
      'ornament',
      center,
      [
        [finialY + height * 0.39, 0, 0],
        [finialY + height * 0.51, q, q],
        [finialY + height * 0.63, 0, 0],
      ],
      level >= 2 ? 12 : 7,
      brass,
    );
    beam(
      out,
      'ornament',
      [x - q * 1.44, finialY + height * 0.87, z],
      [x + q * 1.44, finialY + height * 0.87, z],
      main ? 0.16 : 0.098,
      main ? 0.16 : 0.098,
      brass,
    );
  }
  if (!main && level >= 2) {
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI * 0.2;
      const x0 = x + Math.cos(a) * radius * 0.847;
      const z0 = z + Math.sin(a) * radius * 0.847;
      abox(
        out,
        'ornament',
        [x0 - 0.064, footing + rise * 0.525, z0 - 0.064],
        [x0 + 0.064, footing + rise * 0.57, z0 + 0.064],
        brass,
      );
    }
  }
}

function finialDrum(out, center, level) {
  const [x, z] = center;
  const towerBottom = base + 15.82;
  abox(
    out,
    'plaster',
    [x - 3.31, towerBottom, z - 3.31],
    [x + 3.31, base + 29.99, z + 3.31],
    stucco,
  );
  for (const y of level ? [base + 20.3, base + 26.65, base + 29.75] : [base + 29.75]) {
    abox(out, 'ornament', [x - 3.55, y, z - 3.55], [x + 3.55, y + 0.53, z + 3.55], white);
  }
  dome(out, center, base + 30.25, 3.21, 3.56, level, false);
  if (!level) return;
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const F = facade([x + dx * 3.31, z + dz * 3.31], [dz, -dx]);
    glazedPanel(out, F, 0, base + 22.1, 2.58, 4.3, level, 'round');
  }
}

function centralTower(out, level) {
  const [x, z] = towerCenter;
  const drum = [base + 26.1, base + 32.0, base + 41.05, base + 43.2, base + 45.5];
  const radii = [9.88, 7.16, 7.16, 7.58, 6.92];
  const sides = [8, 16, 24, 36][level];
  lathe(
    out,
    'plaster',
    towerCenter,
    drum.map((y, i) => [y, radii[i], radii[i]]),
    sides,
    stucco,
  );
  for (const [y, r] of level
    ? [
        [base + 31.55, 7.48],
        [base + 41.0, 7.54],
        [base + 43.5, 7.65],
      ]
    : [[base + 43.5, 7.65]]) {
    lathe(
      out,
      'ornament',
      towerCenter,
      [
        [y, r, r],
        [y + 0.59, r, r],
      ],
      sides,
      ivory,
    );
  }
  if (level) {
    for (let j = 0; j < 12; j++) {
      const a = (Math.PI * 2 * j) / 12;
      const normal = [Math.cos(a), Math.sin(a)];
      const center = [x + normal[0] * 7.215, z + normal[1] * 7.215];
      const F = facade(center, [normal[1], -normal[0]]);
      glazedPanel(out, F, 0, base + 33.1, 1.64, 4.25, level);
      if (j % 3 === 0) {
        const y = base + 38.92;
        const radius = 0.81;
        const corners = 12;
        for (let sample = 0; sample < corners; sample++) {
          const a = (sample * 2 * Math.PI) / corners;
          const b = ((sample + 1) * 2 * Math.PI) / corners;
          tri(
            out,
            'ornament',
            F.P(0, y, 0.24),
            F.P(radius * Math.cos(a), y + radius * Math.sin(a), 0.24),
            F.P(radius * Math.cos(b), y + radius * Math.sin(b), 0.24),
            clock,
          );
        }
        if (level >= 2)
          beam(out, 'ornament', F.P(0, y, 0.265), F.P(0.26, y + 0.44, 0.265), 0.034, 0.034, brass);
      } else glazedPanel(out, F, 0, base + 38.8, 1.48, 1.24, 1);
    }
    for (const item of centers.filter((p) => p.height === 41)) {
      column(out, item.center, base + 31.99, 9.0, 0.41, Math.min(level, 2));
    }
  }
  dome(out, towerCenter, base + 45.48, 6.91, 7.66, level, true);
}

function statue(out, x, z, y, level) {
  const sides = level >= 2 ? 7 : 5;
  lathe(
    out,
    'ornament',
    [x, z],
    [
      [y, 0.38, 0.3],
      [y + 0.64, 0.42, 0.32],
      [y + 1.52, 0.23, 0.2],
      [y + 1.75, 0.17, 0.16],
      [y + 2.12, 0.15, 0.15],
      [y + 2.27, 0, 0],
    ],
    sides,
    ivory,
  );
  if (level >= 2) {
    beam(
      out,
      'ornament',
      [x + 0.15, y + 1.46, z],
      [x + 0.38, y + 1.02, z + 0.05],
      0.17,
      0.17,
      ivory,
    );
    beam(
      out,
      'ornament',
      [x - 0.13, y + 1.52, z],
      [x - 0.4, y + 1.77, z + 0.02],
      0.15,
      0.15,
      ivory,
    );
  }
}

function build(out, level) {
  steps(out, level);
  abox(out, 'plaster', [-12.0, base - 0.45, -23.32], [12.0, base + 16.0, 23.31], stucco);
  abox(out, 'plaster', [-23.3, base - 0.45, -12.0], [23.43, base + 16.0, 12.0], stucco);
  abox(out, 'plaster', [-13.4, base + 15.7, -13.35], [13.4, base + 26.48, 13.35], stucco);
  for (const item of porticoes) portico(out, item, level);
  for (const p of centers.filter((f) => f.height === 16))
    column(out, p.center, base + 0.18, 14.25, 0.69, level);
  for (const center of smallerDomes) finialDrum(out, center, level);
  centralTower(out, level);
  if (level >= 1) {
    for (const [dx, dz] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ]) {
      const u = [dz, -dx];
      for (const offset of [-11.9, 0, 11.9]) {
        const radius = offset === 0 ? 23.6 : 22.0;
        const x = radius * dx + offset * u[0],
          z = radius * dz + offset * u[1];
        const y = base + (offset === 0 ? 21.0 : 16.0);
        statue(out, x, z, y, level);
      }
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'helsinki-cathedral-model.mjs';
const camera = [69, 49, 120];
const lookAt = [0, 28, 12];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Helsinki Cathedral',
  wikidataId: plan.wikidataId,
  category: 'cathedral',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The white Empire cathedral above Helsinki Senate Square, with four porticoes, five green domes and its monumental granite stair.',
  camera,
  lookAt,
  sunDirection: [-34, 71, 64],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Native cathedral outline including porticoes.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_granite', 'metal_standing_seam'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'senate-square-stairs', position: [-16, 6.55, 113], lookAt: [0, 30.5, 8] },
    { name: 'east-portico-and-roofs', position: [82, 40, 33], lookAt: [0, 32, 0] },
    { name: 'four-domes-and-central-tower', position: [51, 80, -71], lookAt: [0, 36, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'helsinki-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.71,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.041, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under repository license. City of Helsinki City Survey Services. © OpenStreetMap contributors.',
};

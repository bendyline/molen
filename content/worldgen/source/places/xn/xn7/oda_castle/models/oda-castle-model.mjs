import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  cap,
  face,
  floorSampler,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const surfaceAt = floorSampler(read('terrain-grid'));
const crest = rgb('77824c');
const grass = rgb('929c61');
const yard = rgb('a5aa73');
const darkGrass = rgb('81885e');
const water = rgb('7b9a91');
const shadowWater = rgb('6e897e');
const gravel = rgb('c0ae88');
const rail = rgb('575950');
const wood = rgb('8f785e');
const highWood = rgb('a28968');
const sectionStone = rgb('a6a18e');
const markStone = rgb('c2b89f');

const surfaces = {
  grass: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.99 },
  water: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.66, metallic: 0.04 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.98 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.95 },
  rail: { slot: 'trim', graph: 'metal_painted', roughness: 0.84, metallic: 0.15 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.94 },
};
const earthworks = [
  {
    path: [
      [-92, -6],
      [-85, -29],
      [-77, -61],
      [-68, -92],
      [-63, -111],
    ],
    width: 7.65,
  },
  {
    path: [
      [-63, -111],
      [-35, -110],
      [-13, -104],
      [9, -99],
      [29, -93],
      [52, -84],
      [72, -77],
    ],
    width: 7.7,
  },
  {
    path: [
      [72, -77],
      [58, -55],
      [46, -39],
      [34, -17],
      [28, 2],
      [20, 19],
    ],
    width: 7.4,
  },
  {
    path: [
      [-91, 1],
      [-70, 10],
      [-50, 12],
      [-28, 24],
      [-14, 33],
      [0, 37],
      [16, 34],
      [32, 27],
    ],
    width: 8.4,
  },
  {
    path: [
      [-71, 68],
      [-53, 68],
      [-40, 73],
      [-33, 86],
      [-19, 83],
      [0, 85],
      [22, 75],
    ],
    width: 4.2,
  },
];
const pool = [
  [79, -76],
  [70, -59],
  [60, -48],
  [51, -34],
  [43, -20],
  [36, -4],
  [36, 12],
  [43, 23],
  [50, 35],
  [53, 43],
  [64, 44],
  [72, 36],
  [63, 28],
  [59, 17],
  [60, 4],
  [63, -12],
  [66, -27],
  [75, -44],
  [84, -58],
  [89, -68],
];
const waterOpening = [
  [81, -78],
  [69, -61],
  [59, -50],
  [48, -35],
  [40, -20],
  [33, -6],
  [33, 12],
  [40, 24],
  [47, 36],
  [51, 46],
  [66, 47],
  [76, 36],
  [66, 26],
  [62, 16],
  [63, 4],
  [66, -12],
  [69, -27],
  [78, -43],
  [87, -56],
  [92, -69],
];
const deckPaths = [
  { a: [-55.3, 17.9], b: [-58.1, 27.3], width: 2.45, rails: true },
  { a: [-50.9, 39.8], b: [-53.55, 49.5], width: 2.25, rails: true },
  { a: [46.1, -56.05], b: [54.93, -55.2], width: 2.55, rails: false },
];

function groundRibbon(out, path, width, lod, material, colors, lift) {
  const sectionCount = [2, 3, 5, 6][lod];
  const profile = [];
  for (let i = 0; i < path.length - 1; i++) {
    const [a, b] = [path[i], path[i + 1]];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const count = Math.max(1, Math.ceil(length / [12, 8, 4.3, 3.05][lod]));
    for (let j = 0; j < count; j++) {
      const t = j / count;
      profile.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  profile.push(path.at(-1));
  function row([x, z], i) {
    const a = profile[Math.max(0, i - 1)];
    const b = profile[Math.min(profile.length - 1, i + 1)];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      span = Math.hypot(dx, dz);
    return Array.from({ length: sectionCount + 1 }, (_, j) => {
      const t = (2 * j) / sectionCount - 1;
      const x1 = x - (dz / span) * width * t,
        z1 = z + (dx / span) * width * t;
      return [x1, surfaceAt([x1, z1]) + lift, z1];
    });
  }
  const rows = profile.map(row);
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i],
      b = rows[i + 1];
    for (let j = 0; j < sectionCount; j++) {
      const color = colors[j % sectionCount === 0 || j === sectionCount - 1 ? 0 : 1];
      face(out, material, [a[j], a[j + 1], b[j + 1]], [0, 1, 0], color);
      face(out, material, [a[j], b[j + 1], b[j]], [0, 1, 0], color);
    }
  }
}

function mainEnclosure(out, lod) {
  const steps = [5, 9, 18, 24][lod];
  const north = [
    [-60, -102],
    [63, -74],
  ];
  const south = [
    [-85, -5],
    [22, 23],
  ];
  const between = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const point = (i, j) => {
    const x = i / steps;
    const [east, southward] = between(between(...north, x), between(...south, x), j / steps);
    return [east, surfaceAt([east, southward]) + 0.07, southward];
  };
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const a = point(i, j),
        b = point(i + 1, j);
      const c = point(i + 1, j + 1),
        d = point(i, j + 1);
      face(out, 'grass', [a, b, c], [0, 1, 0], yard);
      face(out, 'grass', [a, c, d], [0, 1, 0], yard);
    }
  }
}

function bridge(out, path, lod) {
  const { a, b, width, rails } = path;
  const f = facade(a, [b[0] - a[0], b[1] - a[1]]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const groundStart = surfaceAt(a) + 0.045,
    groundEnd = surfaceAt(b) + 0.045;
  const y = (t) => groundStart + (groundEnd - groundStart) * t + 0.13 * Math.sin(Math.PI * t);
  const strips = lod === 3 ? Math.ceil(length / 0.33) : lod === 2 ? 9 : lod === 1 ? 4 : 1;
  for (let i = 0; i < strips; i++) {
    const left = i / strips,
      right = (i + 1) / strips,
      gap = lod === 3 ? 0.009 : 0;
    const low = f.P(left * length + gap, y(left), -width / 2),
      high = f.P(left * length + gap, y(left), width / 2);
    const next = f.P(right * length - gap, y(right), -width / 2),
      end = f.P(right * length - gap, y(right), width / 2);
    face(out, 'wood', [low, next, end, high], [0, 1, 0], i % 6 === 2 ? highWood : wood);
  }
  for (const side of [-1, 1]) {
    const d = side * (width / 2 - 0.065);
    beam(out, 'wood', f.P(0, y(0) - 0.13, d), f.P(length, y(1) - 0.13, d), 0.21, 0.23, wood);
    if (!rails) continue;
    const posts = lod === 3 ? 7 : lod === 2 ? 6 : lod === 1 ? 4 : 2;
    for (let j = 0; j < posts; j++) {
      const t = j / (posts - 1);
      beam(
        out,
        'rail',
        f.P(t * length, y(t) - 0.1, d),
        f.P(t * length, y(t) + 0.95, d),
        0.072,
        0.072,
        rail,
      );
    }
    for (const h of lod === 0 ? [0.95] : [0.39, 0.67, 0.95])
      beam(out, 'rail', f.P(0, y(0) + h, d), f.P(length, y(1) + h, d), 0.065, 0.068, rail);
  }
  if (lod < 2) return;
  for (const t of [0.16, 0.48, 0.83]) {
    for (const d of [-width * 0.36, width * 0.36]) {
      const q = f.P(t * length, 0, d);
      const bottom = surfaceAt([q[0], q[2]]) - 0.23;
      if (y(t) - 0.12 > bottom)
        beam(
          out,
          'wood',
          f.P(t * length, bottom, d),
          f.P(t * length, y(t) - 0.12, d),
          0.17,
          0.2,
          wood,
        );
    }
  }
}

function marker(out, lod) {
  const [x, z] = [-12.5, -33.36];
  const y = surfaceAt([x, z]);
  const f = facade([x, z], [0.99, 0.12]);
  fbox(out, 'stone', f, -0.5, 0.5, y - 0.12, y + 0.28, -0.38, 0.38, sectionStone);
  fbox(out, 'stone', f, -0.275, 0.275, y + 0.18, y + 2.63, -0.21, 0.22, markStone);
  if (lod >= 2) {
    for (let i = 0; i < 7; i++) {
      const k = y + 2.36 - 0.215 * i;
      fbox(out, 'stone', f, -0.075, 0.075, k, k + 0.046, 0.22, 0.234, sectionStone);
    }
  }
}

function build(out, lod) {
  mainEnclosure(out, lod);
  for (const { path, width } of earthworks)
    groundRibbon(out, path, width, lod, 'grass', [grass, crest], 0.107);
  const grassBorder = [
    [-71, 3],
    [-62, 7],
    [-50, 9],
    [-39, 13],
    [-28, 19],
    [-17, 25],
    [-8, 29],
    [0, 28],
    [12, 23],
    [22, 16],
  ];
  if (lod >= 1) {
    groundRibbon(out, grassBorder, 1.16, lod, 'gravel', [gravel, gravel], 0.126);
    for (const approach of [
      [
        [-66, 60],
        [-59, 56],
        [-53.55, 49.52],
      ],
      [
        [-50.9, 39.78],
        [-51.7, 34],
        [-58.1, 27.34],
      ],
      [
        [-55.3, 17.9],
        [-56, 14.5],
        [-53, 8.9],
      ],
    ])
      groundRibbon(out, approach, 1.12, lod, 'gravel', [gravel, gravel], 0.13);
  }
  cap(out, 'water', pool, -0.43, water);
  if (lod >= 2) {
    // Broad quiet color changes stay within the photographed water channel.
    cap(
      out,
      'water',
      [
        [52, -20],
        [54, -26],
        [62, -43],
        [74, -58],
        [69, -46],
        [61, -27],
        [58, -20],
      ],
      -0.426,
      shadowWater,
    );
  }
  for (const path of deckPaths) bridge(out, path, lod);
  marker(out, lod);
  if (lod >= 2) {
    const bank = [
      [-9, -32],
      [-5, -32],
      [-5, -24],
      [-9, -24],
    ];
    for (const [i, [x, z]] of bank.entries()) {
      const x1 = x + 0.4,
        z1 = z + 0.4,
        y = surfaceAt([x, z]);
      abox(
        out,
        'stone',
        [x - 0.4, y - 0.12, z - 0.4],
        [x1, y + 0.15, z1],
        i % 2 ? markStone : sectionStone,
      );
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'oda-castle-model.mjs';
const camera = [129, 108, 150],
  lookAt = [-15, 0, -29];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'archaeological',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The existing Oda Castle inner enclosure, grassed earth ramparts, east moat and visitor bridges.',
  camera,
  lookAt,
  sunDirection: [-45, 56, 61],
  mediumFiContext: {
    scale: 2.35,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: waterOpening,
    minHeight: -0.91,
    basis: 'Limited to the present east moat water channel inside its surveyed banks.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'honmaru-earthworks-and-surrounding-moat', position: camera, lookAt },
    {
      name: 'southwest-preserved-rampart-and-footbridges',
      position: [-88, 13, 66],
      lookAt: [-54, 1, 24],
    },
    { name: 'east-moat-and-shallow-banks', position: [51, 12, 32], lookAt: [57, -0.02, -27] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'oda-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.82,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.2, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from Abasaa’s firsthand public-domain photographs, native OSM park geometry under ODbL and the GSI open elevation grid.',
};

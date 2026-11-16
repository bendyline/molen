/** The Museum of Old and New Art on Berriedale's Derwent peninsula. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  poly,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const [originalMuseum, entrance, pharos, roundHouse] = frame.geometry.polygons;
const [pierEnd, stairTop] = frame.features.find((f) => f.id === 'way/393280240').points;
const [pierStart, outerPier] = frame.features.find((f) => f.id === 'way/148015924').points;
const d = plan.dimensions;

const surfaces = {
  rust: { slot: 'wall', graph: 'metal_standing_seam', roughness: 0.91, metallic: 0.15 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.96, metallic: 0 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', localRef: 'palette:#ffffff', roughness: 0.92, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.35, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.64, metallic: 0.12 },
};
const c = Object.fromEntries(
  Object.entries({
    rust: '845035',
    darkRust: '6f4230',
    warmRust: '8d5136',
    concrete: '95978e',
    shadow: '545750',
    nearGround: '998974',
    roof: '817d64',
    green: '889367',
    cream: 'e5dfd0',
    stone: 'b0a18b',
    glass: '465e65',
    iron: 'cbc9bd',
    gray: '9da5a3',
    black: '413c35',
  }).map(([key, hex]) => [key, rgb(hex)]),
);
const mix = (a, b, t) => a + (b - a) * t;
const atY = ([x, z], y) => [x, y, z];

function face(out, surface, points, color) {
  quad(out, surface, points, normalFor(...points), color);
}
function mass(out, surface, outline, lower, upper, color) {
  const base = new MeshBufferBuilder();
  poly(base, surface, outline, lower, upper, color);
  const mesh = base.finalize();
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const points = Array.from(mesh.indices.slice(i, i + 3), (j) =>
      Array.from(mesh.positions.slice(j * 3, j * 3 + 3)),
    );
    out.addTriangle(
      surface,
      'palette:#ffffff',
      points,
      normalFor(...points),
      points.map(([x, , z]) => [x, z]),
      color,
    );
  }
}
function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz);
  return {
    length,
    at: (u, y, v = 0) => [a[0] + (dx * u + dz * v) / length, y, a[1] + (dz * u - dx * v) / length],
  };
}
function foundation(out, surface, f, lo, hi, y0, y1, lowRelief, highRelief, color) {
  const q = [
    f.at(lo, y0, lowRelief),
    f.at(hi, y0, lowRelief),
    f.at(hi, y0, highRelief),
    f.at(lo, y0, highRelief),
  ];
  const p = q.map(([x, , z]) => [x, y1, z]);
  face(out, surface, [...q].reverse(), color);
  face(out, surface, p, color);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, surface, [q[i], q[j], p[j], p[i]], color);
  }
}
function panel(out, surface, f, lo, hi, y0, y1, v, color) {
  face(out, surface, [f.at(hi, y0, v), f.at(lo, y0, v), f.at(lo, y1, v), f.at(hi, y1, v)], color);
}

const terrace = [
  ...originalMuseum.slice(2, 12),
  [86.6, -5.9],
  [stairTop[0] - 1, -7.65],
  [stairTop[0] - 1, -14.55],
  [82.9, -13.88],
  originalMuseum[0],
  originalMuseum[1],
];
const mainGlazingEdges = [
  { index: 8, left: 0.055, right: 0.852, top: 0.76, inset: 1.4 },
  { index: 9, left: 0.052, right: 0.95, top: 0.88, inset: 1.3 },
  { index: 10, left: 0.119, right: 0.888, top: 0.8, inset: 1.3 },
];

function concreteGrille(out, walls, data, level) {
  const index = data.index;
  // Traverse from east to west, with relief facing toward the water.
  const f = edge(walls[index + 1], walls[index]);
  const lo = f.length * data.left,
    hi = f.length * data.right;
  const lower = d.mainWallToeY + 0.47,
    upper = d.mainTerraceY * data.top;
  const narrow = data.inset;
  const p = (u, row, offset = 0) =>
    f.at(
      mix(lo + narrow * (1 - row), hi - narrow * (1 - row), u),
      mix(lower, upper, row),
      offset + 0.065,
    );
  const field = (surface, a, b, from, to, offset, color) => {
    face(
      out,
      surface,
      [p(b, from, offset), p(a, from, offset), p(a, to, offset), p(b, to, offset)],
      color,
    );
  };
  field('concrete', 0, 1, 0, 1, 0, level < 2 ? c.concrete : c.shadow);
  if (level === 0) return;
  const rows = [0, 5, 9, 11][level],
    columns = Math.round((hi - lo) / [1, 2.75, 1.45, 0.93][level]);
  const band = 0.14 / rows;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    field('concrete', 0, 1, Math.max(0, t - band), Math.min(1, t + band), 0.105, c.concrete);
  }
  const stile = 0.11 / columns;
  for (let j = 0; j <= columns; j++) {
    const t = j / columns;
    field('concrete', Math.max(0, t - stile), Math.min(1, t + stile), 0, 1, 0.14, c.concrete);
  }
  for (const t of [0, 1]) {
    const pos = t ? 1 - 0.45 / columns : 0;
    field('concrete', pos, pos + 0.45 / columns, 0, 1, 0.17, c.concrete);
  }
}

function steelWedges(out, level) {
  for (const [index, patch] of [
    [8, [0.64, 0.94]],
    [9, [0.0, 0.13]],
    [10, [0.33, 0.5]],
    [11, [0.07, 0.93]],
  ]) {
    const f = edge(originalMuseum[index + 1], originalMuseum[index]);
    const low = f.length * patch[0],
      high = f.length * patch[1];
    const height = d.mainTerraceY - (index === 11 ? 2.07 : 0.41);
    const flare = Math.min(3.4, (high - low) * 0.31);
    const toe = d.mainWallToeY;
    face(
      out,
      'rust',
      [
        f.at(high + flare, toe, 0.61),
        f.at(low - flare, toe, 0.68),
        f.at(low, height, 0.4),
        f.at(high, height, 0.42),
      ],
      index % 2 ? c.warmRust : c.rust,
    );
    if (level < 2) continue;
    for (let j = 1; j < 4; j++) {
      const t = j / 4;
      const base = mix(low - flare, high + flare, t),
        top = mix(low, high, t);
      face(
        out,
        'rust',
        [
          f.at(base + 0.044, toe, 0.74),
          f.at(base - 0.048, toe, 0.74),
          f.at(top - 0.044, height, 0.465),
          f.at(top + 0.044, height, 0.465),
        ],
        c.darkRust,
      );
    }
  }
}

function excavatedMuseum(out, level) {
  mass(out, 'rust', terrace, d.underwaterFoundationY, d.mainTerraceY, c.rust);
  mass(out, 'roof', terrace, d.mainTerraceY - 0.06, d.mainTerraceY + 0.08, c.roof);
  mass(
    out,
    'roof',
    [
      [-45, -38],
      [19, -38],
      [36, -31],
      [42, -18],
      [25, -8],
      [-24, -11],
      [-44, -19],
    ],
    d.mainTerraceY + 0.08,
    d.mainTerraceY + 0.19,
    c.green,
  );
  mass(
    out,
    'roof',
    [
      [-22, 1],
      [1, -4],
      [29, -3],
      [49, 6],
      [69, 7],
      [73, 12],
      [41, 20],
      [6, 13],
      [-25, 12],
    ],
    d.mainTerraceY + 0.08,
    d.mainTerraceY + 0.21,
    c.green,
  );
  for (const data of mainGlazingEdges) concreteGrille(out, originalMuseum, data, level);
  steelWedges(out, level);
  const f = edge(originalMuseum[9], originalMuseum[8]);
  foundation(out, 'rust', f, 31, 53, -1.03, 4.5, 0.03, 4.1, c.warmRust);
  foundation(out, 'concrete', f, 31, 53, 4.49, 4.73, 0.03, 4.18, c.concrete);

  const southBank = [
    originalMuseum[11],
    originalMuseum[12],
    [106.2, -2.8],
    [106.0, -6.3],
    [92.4, -6.1],
    [86.4, -5.2],
  ];
  const northBank = [
    [90, -19.0],
    [114.4, -18.55],
    [116.9, -12.4],
    [109.1, -12.2],
    [98.4, -12.66],
    [89.8, -13.82],
  ];
  mass(out, 'stone', southBank, d.underwaterFoundationY, d.eastShoulderCapY - 2.8, c.nearGround);
  mass(out, 'stone', northBank, d.underwaterFoundationY, d.eastShoulderCapY - 3.1, c.nearGround);
  box(out, 'concrete', [108.7, -2.1, -7.85], [115.0, 2.35, -3.25], c.gray);
  box(out, 'roof', [108.54, 2.31, -8.02], [115.18, 2.56, -3.08], c.gray);
}

function reception(out, level) {
  mass(out, 'plaster', entrance, d.mainTerraceY, d.entryWallY, c.cream);
  mass(out, 'roof', entrance, d.entryWallY - 0.04, d.entryRoofY, c.stone);
  const corners = [entrance[0], entrance[1], entrance[2], entrance[3], ...entrance.slice(4)];
  for (const i of [0, 1, 4, 5, 6, 7, 8]) {
    const f = edge(corners[i], corners[(i + 1) % corners.length]);
    if (f.length < 3.0) continue;
    const gutter = 0.31;
    panel(
      out,
      'glass',
      f,
      gutter,
      f.length - gutter,
      d.mainTerraceY + 0.65,
      d.entryWallY - 0.4,
      0.031,
      c.glass,
    );
    if (level === 0) continue;
    const count = Math.ceil(f.length / (level === 1 ? 4.2 : 2.58));
    for (let j = 1; j < count; j++) {
      const t = (f.length * j) / count;
      panel(
        out,
        'iron',
        f,
        t - 0.053,
        t + 0.053,
        d.mainTerraceY + 0.65,
        d.entryWallY - 0.41,
        0.045,
        c.black,
      );
    }
  }
  box(
    out,
    'concrete',
    [47.2, d.mainTerraceY + 0.1, -10],
    [50.8, d.mainTerraceY + 5.8, -6.5],
    c.stone,
  );
  if (level > 0)
    box(
      out,
      'iron',
      [47.03, d.mainTerraceY + 5.7, -10.16],
      [50.94, d.mainTerraceY + 5.99, -6.36],
      c.black,
    );
}

function secondaryVolumes(out, level) {
  mass(out, 'rust', pharos, d.pharosFootY, d.pharosRoofY, c.darkRust);
  mass(out, 'roof', pharos, d.pharosRoofY - 0.05, d.pharosRoofY + 0.23, c.black);
  const front = edge(pharos[6], pharos[7]);
  foundation(
    out,
    'concrete',
    front,
    -0.12,
    front.length + 0.12,
    d.pharosFootY - 0.5,
    d.pharosFootY + 0.46,
    -0.42,
    0.42,
    c.concrete,
  );
  for (const i of [2, 6, 8]) {
    const f = edge(pharos[i], pharos[i + 1]);
    if (f.length < 2.9) continue;
    panel(out, 'glass', f, 0.31, f.length - 0.34, 7.12, 12.71, 0.037, c.glass);
    if (level === 0) continue;
    const count = Math.ceil(f.length / 2.3);
    for (let j = 1; j < count; j++) {
      const t = (f.length * j) / count;
      panel(out, 'iron', f, t - 0.065, t + 0.065, 7.12, 12.71, 0.063, c.black);
    }
  }
  const supports = [
    [-91, -2],
    [-84, 3],
    [-86, 10],
  ];
  for (const [x, z] of supports)
    box(
      out,
      'stone',
      [x - 1.3, -1.04, z - 1.25],
      [x + 1.3, d.pharosFootY + 0.21, z + 1.25],
      c.nearGround,
    );
  mass(out, 'stone', roundHouse, d.roundHouseFootY - 0.72, d.roundHouseRoofY, c.stone);
  mass(out, 'roof', roundHouse, d.roundHouseRoofY - 0.06, d.roundHouseRoofY + 0.16, c.roof);
  for (const i of [0, 1, 2, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]) {
    const f = edge(roundHouse[i], roundHouse[(i + 1) % roundHouse.length]);
    panel(
      out,
      'glass',
      f,
      0.09,
      f.length - 0.09,
      d.roundHouseFootY + 1.41,
      d.roundHouseRoofY - 0.41,
      0.039,
      c.glass,
    );
  }
}

const stepSlope = [
  [0, -1.7],
  [0.22, 2.55],
  [0.41, 4.52],
  [0.64, 10.15],
  [0.81, 13.88],
  [1, 14.95],
];
function stairY(t) {
  const j = Math.max(
    1,
    stepSlope.findIndex(([end]) => end >= t),
  );
  const [low, base] = stepSlope[j - 1],
    [high, top] = stepSlope[j];
  return mix(base, top, (t - low) / (high - low));
}
function ferryApproach(out, level) {
  const stairs = edge(pierEnd, stairTop);
  const half = d.stairsWidth * 0.5;
  const n = [5, 24, 60, 90][level],
    tread = stairs.length / n;
  for (let j = 0; j < n; j++) {
    const lo = tread * j,
      hi = tread * (j + 1),
      y0 = stairY(j / n),
      y1 = stairY((j + 1) / n);
    foundation(
      out,
      'concrete',
      stairs,
      lo,
      hi - 0.004,
      y0 - 0.35,
      y1,
      -half,
      half,
      j % 7 === 0 ? c.stone : c.concrete,
    );
  }
  const pier = edge(pierStart, outerPier);
  const landing = d.bottomStairY + 0.045;
  foundation(out, 'concrete', pier, 0, pier.length, landing - 0.37, landing, -half, half, c.gray);
  for (const j of [0.19, 0.61, 0.89]) {
    const u = pier.length * j;
    foundation(
      out,
      'concrete',
      pier,
      u - 0.37,
      u + 0.37,
      d.waterLevelY - 1.15,
      landing,
      -half + 0.15,
      half - 0.15,
      c.gray,
    );
  }
  if (level === 0) return;
  for (const side of [-1, 1]) {
    for (let j = 0; j + 1 < stepSlope.length; j++) {
      const a = stepSlope[j],
        b = stepSlope[j + 1];
      beam(
        out,
        'iron',
        stairs.at(a[0] * stairs.length, a[1] + 1.06, side * half),
        stairs.at(b[0] * stairs.length, b[1] + 1.06, side * half),
        0.096,
        0.096,
        c.iron,
      );
    }
    beam(
      out,
      'iron',
      pier.at(0, landing + 1.07, side * half),
      pier.at(pier.length, landing + 1.07, side * half),
      0.12,
      0.12,
      c.iron,
    );
    const dividers = level === 1 ? 8 : 17;
    for (let j = 0; j <= dividers; j++) {
      const q = j / dividers,
        u = q * pier.length,
        y = stairY(q);
      const post = (u * stairs.length) / pier.length;
      beam(
        out,
        'iron',
        stairs.at(post, y - 0.12, side * half),
        stairs.at(post, y + 1.08, side * half),
        0.089,
        0.089,
        c.iron,
      );
      beam(
        out,
        'iron',
        pier.at(u, landing, side * half),
        pier.at(u, landing + 1.09, side * half),
        0.096,
        0.096,
        c.iron,
      );
      if (level < 2 || j === dividers) continue;
      beam(
        out,
        'iron',
        pier.at(u, landing, side * half),
        pier.at(u + pier.length / dividers, landing + 1.04, side * half),
        0.067,
        0.067,
        c.iron,
      );
    }
  }
}

function draw(out, level) {
  excavatedMuseum(out, level);
  reception(out, level);
  secondaryVolumes(out, level);
  ferryApproach(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [81, 35, 239];
const lookAt = [0, 7, -4];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The standing Museum of Old and New Art under the Berriedale clifftop, with rusted steel walls, concrete grille bays, green roof, the white Courtyard House entrance and the ferry stair.',
  camera,
  lookAt,
  sunDirection: [86, 136, 99],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: [
    'metal_standing_seam',
    'concrete_plain',
    'stone_sandstone_raw',
    'plaster_lime',
    'metal_painted',
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.09,
    groundY: d.waterLevelY,
    far: 3000,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'derwent-steel-facade', position: [57, 22, 170], lookAt },
    { name: 'courtyard-house-and-ferry-stair', position: [159, 28, 54], lookAt: [83, 8, -10] },
    { name: 'round-house-and-pharos', position: [-139, 27, 111], lookAt: [-94, 7, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.55,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.38, surfaces },
      street: { export: 'street', errorMeters: 0.45, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.14, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original standing-exterior reconstruction from the exact CC0 riverfront Qualla photographs, mapped built outlines, official terrain elevations and architect and heritage written sources.',
};

import fs from 'node:fs';
import {
  abox,
  gableRoof,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outer, rear } = JSON.parse(
  fs.readFileSync(new URL('../native-map/iwatsuki-gate-rings.json', import.meta.url)),
);
const { foundation, floor, blackGateEave, blackGatePeak, rearGateEave, rearGrade } =
  plan.dimensions;
const dark = rgb('4d463e');
const edge = rgb('5e5142');
const rearWood = rgb('725e4b');
const door = rgb('51463b');
const tile = rgb('666866');
const ridge = rgb('77766f');
const gray = rgb('777772');
const plaster = rgb('d2c6aa');
const iron = rgb('42443a');
const surfaces = {
  timber: { slot: 'wall', graph: 'wood_plain', roughness: 0.94 },
  board: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
  rendered: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  edge: { slot: 'trim', graph: 'wood_plain', roughness: 0.93 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.9 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.96 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.77 },
};

function box(out, slot, x, y, z, w, h, d, tint, bottom = false) {
  abox(out, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], tint, { bottom });
}
function limits(ring) {
  const xs = ring.map((p) => p[0]),
    zs = ring.map((p) => p[1]);
  const left = Math.min(...xs),
    right = Math.max(...xs),
    front = Math.min(...zs),
    back = Math.max(...zs);
  return { x: (left + right) / 2, z: (front + back) / 2, width: right - left, depth: back - front };
}
function panel(out, x, z, y, w, d, h, shade, lod, hasPlaster) {
  const trimHeight = hasPlaster ? 0.69 * h : h;
  box(out, 'timber', x, y, z, w, trimHeight, d, shade);
  if (hasPlaster) box(out, 'rendered', x, y + trimHeight, z, w, h - trimHeight, d - 0.065, plaster);
  if (lod === 0) return;
  const count = Math.max(3, Math.round(w / (lod > 2 ? 0.19 : 0.42)));
  for (const side of [-1, 1]) {
    const face = z + side * (d / 2 + 0.012);
    const rows = lod > 2 ? 4 : 3;
    for (let i = 1; i < rows; i++)
      box(out, 'edge', x, y + (trimHeight * i) / rows, face, w, 0.044, 0.042, edge);
    if (lod < 2) continue;
    for (let i = 1; i < count; i++) {
      const at = x + w * (i / count - 0.5);
      box(out, 'edge', at, y + 0.13, face, 0.026, trimHeight - 0.16, 0.026, edge);
    }
  }
}
function doorway(out, x, z, y, w, h, shade, lod) {
  for (const side of [-1, 1]) {
    const at = x + (side * w) / 4;
    box(out, 'board', at, y, z, w / 2 - 0.024, h, 0.14, shade);
    if (lod < 2) continue;
    for (const face of [-1, 1]) {
      const faceZ = z + face * 0.081;
      const count = Math.max(5, Math.round(w / 0.44));
      for (let j = 1; j < count; j++)
        box(
          out,
          'edge',
          at + (j / count - 0.5) * (w / 2 - 0.06),
          y + 0.08,
          faceZ,
          0.018,
          h - 0.14,
          0.024,
          edge,
        );
      for (const height of [0.29, h * 0.49, h - 0.34])
        box(out, 'iron', at + side * w * 0.15, y + height, faceZ, 0.43, 0.073, 0.049, iron);
    }
  }
}
function cornerRoof(out, x, z, width, depth, eave, peak, lod) {
  const rect = (y, w, d) => [
    [x - w / 2, y, z - d / 2],
    [x - w / 2, y, z + d / 2],
    [x + w / 2, y, z + d / 2],
    [x + w / 2, y, z - d / 2],
  ];
  const step = peak - eave;
  const sections = [
    rect(eave, width, depth),
    rect(eave + 0.25 * step, width - 0.24, depth * 0.69),
    rect(peak - 0.13, width - 1.72, 0.16),
  ];
  loft(out, 'tile', sections, tile, { cap: false });
  box(out, 'edge', x, eave - 0.091, z, width - 0.06, 0.1, depth - 0.05, dark, true);
  box(out, 'tile', x, peak - 0.18, z, width - 1.48, 0.22, 0.26, ridge);
  if (lod < 2) return;
  const count = Math.max(8, Math.floor((width - 2.25) / (lod === 3 ? 0.32 : 0.57)));
  for (let i = 0; i <= count; i++) {
    const u = x + (i / count - 0.5) * (width - 2.28);
    for (const side of [-1, 1]) {
      const start = [u, eave + 0.037, z + side * depth * 0.498];
      const middle = [u, eave + 0.25 * step + 0.025, z + side * depth * 0.344];
      const end = [u, peak - 0.105, z + side * 0.085];
      beam(out, 'tile', start, middle, 0.029, 0.032, ridge);
      beam(out, 'tile', middle, end, 0.029, 0.032, ridge);
    }
  }
}
function blackGate(out, lod) {
  const { x, z, width, depth } = limits(outer);
  const eave = blackGateEave;
  const h = eave - floor - 0.25;
  const thickness = Math.min(0.22, depth * 0.06);
  const bay = width * 0.36;
  const wingWidth = (width - bay) / 2 - 0.65;
  const wingX = bay / 2 + wingWidth / 2;
  for (const side of [-1, 1]) {
    const wing = x + side * wingX;
    box(
      out,
      'stone',
      wing,
      foundation,
      z,
      wingWidth + 0.32,
      floor - foundation,
      depth - 0.47,
      gray,
    );
    panel(out, wing, z - depth * 0.262, floor, wingWidth, thickness, h, dark, lod, true);
    panel(out, wing, z + depth * 0.262, floor, wingWidth, thickness, h, dark, lod, true);
    for (const d of [-1, 1]) {
      const wall = z + d * depth * 0.32;
      box(out, 'timber', x + (side * bay) / 2, floor, wall, 0.33, eave - floor, 0.4, edge);
      box(
        out,
        'timber',
        x + side * (width / 2 - 0.42),
        floor,
        wall,
        0.28,
        eave - floor,
        0.34,
        edge,
      );
      if (lod > 0)
        box(
          out,
          'edge',
          wing,
          floor + h * 0.69 - 0.018,
          wall + 0.018,
          wingWidth - 0.08,
          0.095,
          0.27,
          edge,
        );
    }
    box(out, 'timber', x + side * (width / 2 - 0.5), floor, z, 0.16, h, depth * 0.67, dark);
    if (lod > 1)
      box(out, 'stone', wing, -0.64, z - depth * 0.67, wingWidth + 0.22, 0.89, 0.66, gray);
  }
  doorway(out, x, z + 0.03, floor, bay - 0.29, h - 0.42, dark, lod);
  for (const d of [-1, 1])
    box(out, 'edge', x, eave - 0.43, z + d * depth * 0.34, width - 0.64, 0.26, 0.28, edge);
  if (lod > 0) {
    for (let i = -12; i <= 12; i++) {
      const u = x + (i * (width - 0.8)) / 24;
      box(out, 'edge', u, eave - 0.21, z, 0.076, 0.15, depth - 0.02, edge, true);
    }
  }
  cornerRoof(out, x, z, width + 0.21, depth + 0.26, eave, blackGatePeak, lod);
}
function rearGate(out, lod) {
  const { x, z, width, depth } = limits(rear);
  const y = rearGrade - 0.09,
    eave = y + rearGateEave;
  const posts = width * 0.43;
  for (const side of [-1, 1]) {
    const at = x + side * posts;
    box(out, 'stone', at, y - 1.32, z, 0.43, 1.49, 0.57, gray);
    box(out, 'timber', at, y + 0.13, z, 0.27, eave - y - 0.14, 0.31, rearWood);
    box(out, 'edge', at, y + 0.05, z - depth * 0.31, 0.25, 1.51, 0.33, edge);
    panel(out, at + side * 0.71, z + 0.06, y + 0.02, 1.44, 0.13, 1.72, rearWood, lod, false);
    box(out, 'tile', at + side * 0.71, y + 1.69, z + 0.06, 1.61, 0.11, 0.44, tile);
  }
  doorway(out, x, z - 0.025, y, posts * 2 - 0.22, eave - y - 0.46, door, lod);
  box(out, 'edge', x, eave - 0.42, z, width + 0.05, 0.26, 0.52, rearWood);
  gableRoof(
    out,
    'tile',
    [x - width * 0.56, z],
    [x + width * 0.56, z],
    depth,
    eave,
    eave + 1,
    tile,
    {
      overhang: 0.115,
      endSlot: 'timber',
      endColor: rearWood,
    },
  );
  box(out, 'tile', x, eave + 0.98, z, width * 1.15, 0.16, 0.23, ridge);
  if (lod < 2) return;
  const count = lod === 2 ? 11 : 21;
  for (let i = 0; i < count; i++) {
    const u = x + (i / (count - 1) - 0.5) * width * 1.08;
    for (const side of [-1, 1])
      beam(
        out,
        'tile',
        [u, eave + 0.023, z + (side * depth) / 2],
        [u, eave + 0.99, z + side * 0.1],
        0.033,
        0.046,
        ridge,
      );
  }
}
function build(out, lod) {
  blackGate(out, lod);
  rearGate(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'iwatsuki-castle-model.mjs';
const camera = [83, 53, -78];
const lookAt = [1, 1.8, -2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'heritage',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The standing Kuromon and Uramon timber gates at Iwatsuki Castle Park, each on its own mapped footprint.',
  camera,
  lookAt,
  sunDirection: [-28, 41, -58],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outer,
    outlines: [outer, rear],
    minimumCoverage: 0.94,
    basis: 'Each individually mapped Iwatsuki gate outline.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'two-gates-in-their-mapped-positions', position: camera, lookAt },
    {
      name: 'kuromon-tiled-roof-and-plaster-panels',
      position: [10, 6, -46],
      lookAt: [2.57, 2.5, -29.3],
    },
    {
      name: 'uramons-smaller-weathered-gate',
      position: [2.9, 5.1, 39.48],
      lookAt: [-2.59, 2.75, 29.3],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'iwatsuki-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.35, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  facade,
  fbox,
  lathe,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const map = read('native-map/fort-fisher-mapped-earthworks');
const form = map.localPoints;
const grass = rgb('909375');
const berm = rgb('929576');
const sandy = rgb('aaa086');
const coping = rgb('b5b1a5');
const stone = rgb('d4d0c8');
const brick = rgb('986956');
const brickEdge = rgb('ad806b');
const bronze = rgb('647d71');
const darkBronze = rgb('5d6158');
const grain = rgb('806544');
const darkWood = rgb('474236');

const surfaces = {
  grass: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.98 },
  masonry: { slot: 'foundation', graph: 'brick', roughness: 0.92 },
  granite: { slot: 'trim', graph: 'stone_granite', roughness: 0.9 },
  timber: { slot: 'wall', graph: 'wood_plain', roughness: 0.96 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.86, metallic: 0.12 },
};

function elevation(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const h = terrain.heightsMeters;
  return (
    (1 - b) * ((1 - a) * h[j][i] + a * h[j][i + 1]) +
    b * ((1 - a) * h[j + 1][i] + a * h[j + 1][i + 1]) -
    terrain.modelDatumElevationMeters
  );
}

function inFootprint(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = ring[i];
    const [c, d] = ring[j];
    if (b > z !== d > z && x < a + ((c - a) * (z - b)) / (d - b)) inside = !inside;
  }
  return inside;
}

function earthSurface(out, spacing, lift) {
  const rings = [form.survivingWest, form.survivingEast, form.restoredLandFace];
  const points = rings.flat();
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  const origin = terrain.origin;
  const gridStart = (axis, min) =>
    origin[axis] + Math.floor((min - origin[axis]) / spacing) * spacing;
  const x0 = gridStart(0, Math.min(...xs));
  const z0 = gridStart(1, Math.min(...zs));
  const columns = Math.ceil((Math.max(...xs) - x0) / spacing);
  const rows = Math.ceil((Math.max(...zs) - z0) / spacing);
  for (let row = 0; row < rows; row++) {
    const z = z0 + row * spacing;
    for (let column = 0; column < columns; column++) {
      const x = x0 + column * spacing;
      const center = [x + spacing / 2, z + spacing / 2];
      if (!rings.some((ring) => inFootprint(...center, ring))) continue;
      const corners = [
        [x, z + spacing],
        [x + spacing, z + spacing],
        [x + spacing, z],
        [x, z],
      ];
      const p = corners.map(([u, v]) => [u, restoredHeight(u, v) + lift, v]);
      const linearSlope =
        (Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1]))) / spacing;
      const amount = Math.max(0, Math.min(0.62, (linearSlope - 0.19) * 1.1));
      const base = inFootprint(...center, form.restoredLandFace) ? berm : grass;
      const tone = base.map((value, i) => value + (sandy[i] - value) * amount);
      tri(out, 'grass', p[0], p[1], p[2], tone);
      tri(out, 'grass', p[0], p[2], p[3], tone);
    }
  }
}

const start = form.restorationCrests[0];
const end = form.restorationCrests.at(-1);
const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
const direction = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
const normal = [-direction[1], direction[0]];

function roundSlope(value) {
  const r = 1 - Math.max(0, Math.min(1, value));
  return r * r * (3 - 2 * r);
}

function restoredHeight(x, z) {
  const base = elevation(x, z);
  const dx = x - start[0];
  const dz = z - start[1];
  const along = dx * direction[0] + dz * direction[1];
  const across = dx * normal[0] + dz * normal[1];
  const remainder = Math.max(-along, along - length, 0);
  const trough = roundSlope(Math.hypot(remainder * 1.25, across) / 14.4) * 3.28;
  let crest = base + trough;
  for (const [i, p] of form.restorationCrests.entries()) {
    const u = (x - p[0]) * direction[0] + (z - p[1]) * direction[1];
    const v = (x - p[0]) * normal[0] + (z - p[1]) * normal[1];
    const bump = roundSlope(Math.hypot(u / 12.3, v / 17.6));
    const peak = [5.95, 5.43, 5.15][i];
    crest = Math.max(crest, base + Math.max(0, peak - base) * bump);
  }
  return crest;
}

function timberEntrance(out, level) {
  const [a, b] = form.timberPassage;
  const F = wallFace(a, b);
  const base = Math.min(elevation(...a), elevation(...b)) + 0.13;
  const w = F.length;
  fbox(out, 'timber', F, 0, w, base + 2.3, base + 2.87, -0.7, 0.18, grain, { bottom: true });
  for (const [u, v] of [
    [0, 0.78],
    [w - 0.81, w],
  ]) {
    fbox(out, 'timber', F, u, v, base, base + 2.38, -0.68, 0.19, grain);
  }
  fbox(out, 'timber', F, 0.8, w - 0.83, base + 0.06, base + 2.31, -0.81, -0.68, darkWood);
  if (level >= 2) {
    for (let u = 1.08; u < w - 1.0; u += 0.37) {
      fbox(out, 'timber', F, u - 0.018, u + 0.018, base + 0.09, base + 2.24, -0.69, -0.66, grain);
    }
  }
}

function eagle(out, F, x, y, d, level) {
  const p = (u, h, v) => F.P(x + u, y + h, d + v);
  const [cx, , cz] = p(0, 0, 0);
  lathe(
    out,
    'bronze',
    [cx, cz],
    [
      [y, 0.11, 0.11],
      [y + 0.16, 0.21, 0.18],
      [y + 0.33, 0.18, 0.16],
      [y + 0.47, 0.095, 0.09],
    ],
    level >= 2 ? 10 : 6,
    bronze,
  );
  beam(out, 'bronze', p(0, 0.37, 0), p(0.015, 0.6, 0.06), 0.12, 0.12, bronze);
  beam(out, 'bronze', p(0.015, 0.59, 0.07), p(0.066, 0.58, 0.13), 0.07, 0.06, darkBronze);
  for (const s of [-1, 1]) {
    const inner = p(0.1 * s, 0.37, 0.015);
    const leading = p(0.41 * s, 0.61, -0.021);
    const tip = p(0.62 * s, 0.73, -0.058);
    const trailing = p(0.42 * s, 0.29, -0.054);
    const molding = p(0.14 * s, 0.25, -0.092);
    for (const [a, b] of [
      [inner, leading],
      [leading, tip],
      [tip, trailing],
      [trailing, molding],
    ]) {
      tri(out, 'bronze', a, b, p(0.27 * s, 0.42, 0.059), bronze);
      tri(out, 'bronze', b, a, p(0.27 * s, 0.41, -0.084), darkBronze);
    }
    if (level === 3) {
      for (const u of [0.32, 0.4, 0.49]) {
        beam(
          out,
          'bronze',
          p(u * s, 0.57, 0.007),
          p((u - 0.055) * s, 0.37, 0.009),
          0.029,
          0.018,
          bronze,
        );
      }
    }
  }
}

function monument(out, level) {
  const [x, z] = map.monument.position;
  const pad = form.monumentPad;
  const F = facade([x, z], [pad[1][0] - pad[2][0], pad[1][1] - pad[2][1]]);
  const y = elevation(x, z) + 0.15;
  fbox(out, 'masonry', F, -6.15, 6.15, y - 0.25, y + 0.52, -5.88, 4.98, brick);
  for (const [u, v] of [
    [-6.15, -4.84],
    [4.84, 6.15],
  ]) {
    fbox(out, 'masonry', F, u, v, y + 0.46, y + 0.71, -5.86, 5.53, brickEdge);
  }
  for (let step = 0; step < 3; step++) {
    fbox(
      out,
      'masonry',
      F,
      -4.85,
      4.85,
      y - 0.19,
      y + (3 - step) * 0.16,
      4.96 + step * 0.225,
      5.23 + step * 0.225,
      brick,
    );
  }
  const tiers = [
    [0.54, 0.72, 1.3, coping],
    [0.7, 0.91, 1.12, stone],
    [0.9, 1.11, 0.88, stone],
    [1.09, 2.24, 0.65, stone],
    [2.21, 2.42, 0.54, coping],
    [6.23, 6.43, 0.42, stone],
    [6.42, 6.57, 0.49, stone],
  ];
  for (const [base, top, r, tone] of tiers) {
    fbox(out, 'granite', F, -r, r, y + base, y + top, -r, r, tone);
  }
  fbox(out, 'bronze', F, -0.51, 0.51, y + 1.2, y + 2.02, 0.647, 0.681, darkBronze);
  if (level >= 2) {
    for (const u of [-0.472, 0.472]) {
      for (const h of [1.26, 1.96]) {
        fbox(
          out,
          'bronze',
          F,
          u - 0.025,
          u + 0.025,
          y + h - 0.025,
          y + h + 0.025,
          0.68,
          0.693,
          bronze,
        );
      }
    }
  }
  lathe(
    out,
    'granite',
    [x, z],
    [
      [y + 2.39, 0.52, 0.52],
      [y + 2.54, 0.51, 0.51],
      [y + 2.64, 0.425, 0.425],
      [y + 6.1, 0.345, 0.345],
      [y + 6.22, 0.416, 0.416],
      [y + 6.26, 0.432, 0.432],
    ],
    [8, 16, 24, 32][level],
    stone,
  );
  eagle(out, F, 0, y + 6.56, 0, level);
}

function build(out, level) {
  const spacing = terrain.stepMeters * [7, 4, 2, 1][level];
  earthSurface(out, spacing, [0.72, 0.52, 0.38, 0.3][level]);
  timberEntrance(out, level);
  monument(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-fisher-model.mjs';
const camera = [296, 176, 240];
const lookAt = [60, 0, -13];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Fort Fisher',
  wikidataId: plan.wikidataId,
  category: 'historic_site',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The surviving and restored land-face earthworks of Fort Fisher, with the ocean-side fragment and the Battle Acre Monument.',
  camera,
  lookAt,
  sunDirection: [104, 53, -88],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick', 'stone_granite', 'wood_plain', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'surviving-land-face', position: [-60, 26, -195], lookAt: [5, 0, -98] },
    { name: 'reconstructed-land-face', position: [205, 35, 25], lookAt: [86, 3, -71] },
    { name: 'battle-acre-column', position: [132.8, 5.2, 193.0], lookAt: [111.8, 3.57, 180.6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-fisher-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.25,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.7, surfaces },
      street: { export: 'street', errorMeters: 0.36, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.14, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. Public-domain data by USGS 3DEP and USDA NAIP. © OpenStreetMap contributors.',
};

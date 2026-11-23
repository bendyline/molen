import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  abox,
  extrude,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url)));
const plan = read('../plan-controls.json');
const frame = read('../map-frame.json');
const controls = read('../native-map/mountaineer-plant-site-controls.json');
const terrain = read('../terrain-grid.json');
const surfaces = {
  tower: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.96 },
  stack: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96 },
  liner: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.97 },
  wall: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.91 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.91 },
  metal: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.83 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.75 },
};
const concrete = rgb('aaa298');
const concreteShade = rgb('a59e94');
const rim = rgb('8a8077');
const lining = rgb('625852');
const slab = rgb('928d81');
const panels = rgb('c3ba9b');
const palePanels = rgb('c5c1ad');
const roof = rgb('9b9d94');
const metal = rgb('7a7e76');
const glass = rgb('515e60');
const tau = 2 * Math.PI;

function ground([x, z]) {
  const [ox, oz] = terrain.origin;
  const u = (x - ox) / terrain.stepMeters;
  const v = (z - oz) / terrain.stepMeters;
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

function building(out, outline, groundY, top, tone) {
  extrude(out, 'wall', outline, groundY, top, tone, { top: false });
  const faces = earcut(outline.flat());
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, c] = faces.slice(i, i + 3).map((index) => {
      const [x, z] = outline[index];
      return [x, top, z];
    });
    tri(out, 'roof', a, c, b, roof);
  }
}

const tallBoiler = [
  [-8.1, -170],
  [0.5, -210],
  [76.9, -203],
  [91.2, -168],
  [96.9, -145],
  [86.1, -117],
  [17.7, -94],
];
const turbineHall = [
  [-204, -119],
  [-127, -158],
  [-102, -123],
  [-180, -70],
];
const boilerAnnex = [
  [-105, -153],
  [-80, -164],
  [-25, -158],
  [-13, -133],
  [-39, -126],
  [-81, -106],
];
const plantParts = Object.fromEntries(
  controls.polygonParts.map(({ role, local }) => [role, local]),
);

function walls(out, outline, eave, lod) {
  const boundary = outwardRing(outline);
  for (let i = 0; i < boundary.length; i++) {
    const F = wallFace(boundary[i], boundary[(i + 1) % boundary.length]);
    if (F.length < 11) continue;
    fbox(out, 'metal', F, 0, F.length, eave - 1.55, eave - 0.45, -0.19, 0.28, metal);
    if (lod === 1) {
      fbox(out, 'glass', F, 2.25, F.length - 2.25, eave - 8.5, eave - 5.7, -0.11, 0.13, glass);
      continue;
    }
    for (let u = 4.8; u < F.length - 3.8; u += 8.3) {
      fbox(out, 'glass', F, u - 2.5, u + 2.5, eave - 8.8, eave - 5.9, -0.08, 0.17, glass);
      if (lod === 3) {
        fbox(out, 'metal', F, u - 0.11, u + 0.11, eave - 8.8, eave - 5.9, 0.155, 0.28, metal);
        fbox(out, 'metal', F, u + 3.42, u + 3.68, eave - 15.9, eave - 1.5, -0.035, 0.31, metal);
      }
    }
  }
}

function plant(out, lod) {
  const main = plantParts['generating hall'];
  extrude(out, 'foundation', main, -4.0, 2.35, slab, { top: false });
  building(out, main, 2.35, 17.5, panels);
  const high = plan.dimensions.mainBoilerHeightEstimate;
  for (const [outline, top, color] of [
    [tallBoiler, high, palePanels],
    [turbineHall, 38, panels],
    [boilerAnnex, 31, panels],
  ]) {
    building(out, outline, 17.07, top, color);
    if (lod > 0) walls(out, outline, top, lod);
  }
  for (const [name, height] of [
    ['plant annex', 20],
    ['low annex', 8.5],
    ['riverside service building', 13],
    ['shop', 14],
    ['secondary hall', 22],
    ['east service building', 9],
    ['north secondary hall', 16],
  ]) {
    const outline = plantParts[name];
    building(out, outline, -3, height, panels);
    if (lod > 1) walls(out, outline, height, lod);
  }
  if (lod === 0) return;
  for (const [x, z, y, w, d] of [
    [36, -163, high, 17, 19],
    [58, -152, high, 9, 9],
    [-154, -118, 38, 7, 9],
    [-118, -134, 38, 9, 9],
    [-61, -145, 31, 6, 6],
  ]) {
    abox(out, 'metal', [x - w / 2, y - 0.15, z - d / 2], [x + w / 2, y + 3.4, z + d / 2], metal, {
      bottom: false,
    });
  }
}

const ring = (center, y, r, sides) => radialRing(y, r, r, sides, center);
function band(out, slot, center, lower, upper, sides, tone, inside = false) {
  const low = ring(center, lower[0], lower[1], sides);
  const high = ring(center, upper[0], upper[1], sides);
  if (inside) {
    low.reverse();
    high.reverse();
  }
  loft(out, slot, [low, high], tone, { cap: false });
}

function lip(out, slot, center, y, outer, inner, sides, tone) {
  const a = ring(center, y, outer, sides);
  const b = ring(center, y, inner, sides);
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides;
    quad4(out, slot, a[i], a[j], b[j], b[i], tone);
  }
}

const activeBands = ['b6aa92', 'bbae94', 'c1b296', 'c1b296', 'c4bfb5', 'a59482'].map(rgb);
const originalBands = ['b8a782', 'b4a17c', 'b19b75', 'ac946f', 'a98a66', '9b7f63'].map(rgb);
function stack(out, center, active, lod) {
  const sides = [10, 18, 26, 38][lod];
  const base = ground(center);
  const height = active ? plan.dimensions.activeStackHeight : plan.dimensions.oldStackHeight;
  const top = base + height;
  const lower = active ? 12.4 : 13.6;
  const upper = active ? 8.0 : 7.85;
  const sections = lod < 2 ? [0, 0.58, 0.83, 0.982, 1] : [0, 0.27, 0.58, 0.79, 0.83, 0.982, 1];
  const colors = active ? activeBands : originalBands;
  const radius = (f) => lower + (upper - lower) * f;
  for (let i = 1; i < sections.length; i++) {
    const first = sections[i - 1];
    const second = sections[i];
    const color = lod < 2 ? [0, 2, 4, 5][i - 1] : i - 1;
    band(
      out,
      'stack',
      center,
      [base + height * first, radius(first)],
      [base + height * second, radius(second)],
      sides,
      colors[color],
    );
  }
  band(out, 'stack', center, [base - 4.0, lower], [base, lower], sides, colors[0]);
  band(out, 'liner', center, [top - 8.2, upper - 0.95], [top, upper - 0.91], sides, lining, true);
  lip(out, 'stack', center, top, upper, upper - 0.91, sides, rim);
  if (lod < 2) return;
  const y = base + height * (active ? 0.72 : 0.39);
  const edge = radius((y - base) / height);
  lip(out, 'metal', center, y, edge + 1.03, edge - 0.11, sides, metal);
  band(out, 'metal', center, [y - 0.35, edge + 1.03], [y, edge + 1.03], sides, metal);
}

const cooling = plantParts['natural-draft cooling tower'];
const coolingCenter = cooling.reduce(
  ([x, z], [a, b]) => [x + a / cooling.length, z + b / cooling.length],
  [0, 0],
);
const coolingRadius =
  cooling.reduce(
    (total, [x, z]) => total + Math.hypot(x - coolingCenter[0], z - coolingCenter[1]),
    0,
  ) / cooling.length;
const coolingBase = Array.from({ length: 8 }, (_, index) => {
  const angle = (index * tau) / 8;
  return ground([coolingCenter[0] + 87 * Math.cos(angle), coolingCenter[1] + 87 * Math.sin(angle)]);
}).sort((a, b) => a - b)[4];

function coolingTower(out, lod) {
  const sides = [12, 24, 34, 48][lod];
  const h = plan.dimensions.coolingHeight;
  const wall = coolingRadius;
  const footing = coolingBase;
  const shellBottom = footing + 10.5;
  const fractions = lod === 0 ? [0, 0.28, 0.62, 1] : [0, 0.15, 0.33, 0.55, 0.69, 0.81, 1];
  const profile = fractions.map((t) => {
    const radius = wall * Math.sqrt(0.5 + 1.01 * Math.pow(t - 0.7, 2));
    return [shellBottom + t * (h - 10.5), radius];
  });
  for (let i = 1; i < profile.length; i++)
    band(
      out,
      'tower',
      coolingCenter,
      profile[i - 1],
      profile[i],
      sides,
      i % 2 === 0 ? concrete : concreteShade,
    );
  const [top, radius] = profile.at(-1);
  const beneath = profile.at(-2);
  band(
    out,
    'liner',
    coolingCenter,
    [beneath[0], beneath[1] - 0.75],
    [top, radius - 0.78],
    sides,
    lining,
    true,
  );
  lip(out, 'tower', coolingCenter, top, radius + 0.18, radius - 0.78, sides, rim);
  band(
    out,
    'foundation',
    coolingCenter,
    [footing - 4.4, wall - 3.1],
    [footing + 1.0, wall - 3.1],
    sides,
    slab,
  );
  const braces = [6, 16, 25, 36][lod];
  const at = (a, y, r) => [
    coolingCenter[0] + r * Math.cos(a),
    y,
    coolingCenter[1] + r * Math.sin(a),
  ];
  for (let i = 0; i < braces; i++) {
    const a = (i * tau) / braces;
    const upper = at(a, shellBottom + 0.42, wall - 0.3);
    const delta = ((lod === 0 ? 0.23 : 0.37) * tau) / braces;
    for (const sign of [-1, 1]) {
      const lower = at(a + sign * delta, footing - 0.4, wall - 2.6);
      beam(out, 'tower', lower, upper, 1.36, 1.56, concrete);
    }
  }
}

function build(out, lod) {
  plant(out, lod);
  for (const [index, { local }] of controls.stackCenters.entries())
    stack(out, local, index === 0, lod);
  coolingTower(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'mountaineer-power-plant-model.mjs';
const camera = [615, 215, 590];
const lookAt = [-24, 115, -42];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'industrial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Mountaineer Power Plant’s two tapered concrete chimneys, single hyperbolic cooling tower and generating hall along the Ohio River.',
  camera,
  lookAt,
  sunDirection: [110, 170, 145],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Native footprint of the main Mountaineer generating hall.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'paired-stack-profiles', position: [588, 74, 118], lookAt: [35, 144, -83] },
    { name: 'open-rim-cooling-tower', position: [-254, 217, 332], lookAt: [-36, 83, 44] },
    { name: 'generating-hall-and-plant-roofs', position: [300, 252, -432], lookAt: [-56, 50, -93] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'mountaineer-power-plant-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.2,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.55, surfaces },
      street: { export: 'street', errorMeters: 0.56, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.2, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

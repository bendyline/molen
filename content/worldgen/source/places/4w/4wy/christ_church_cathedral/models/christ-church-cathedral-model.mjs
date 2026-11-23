import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { totalSpireHeightM, towerRoofEaveM, naveRidgeM, naveEaveM } = plan.dimensions;

const granite = rgb('a59c90');
const plinth = rgb('898072');
const brick = rgb('a76956');
const brickShade = rgb('8b5146');
const roof = rgb('a9534f');
const seams = rgb('b35d56');
const glass = rgb('37474b');
const lead = rgb('777b73');
const slate = rgb('514c48');
const clock = rgb('393536');
const clockMark = rgb('d9c9a7');
const wood = rgb('553b34');
const floor = 0.44;
const foundation = -1.65;

const surfaces = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.97 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.95 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_painted', roughness: 0.81 },
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87 },
};

const north = (z) => facade([0, z], [-1, 0]);
const south = (z) => facade([0, z], [1, 0]);
const east = (x) => facade([x, 0], [0, -1]);
const west = (x) => facade([x, 0], [0, 1]);

function box(out, slot, x0, x1, z0, z1, low, high, color) {
  abox(out, slot, [x0, low, z0], [x1, high, z1], color, { bottom: false });
}

function lancet(out, face, u, y, width, height, level, kind = 'window') {
  const dark = kind === 'door' ? wood : kind === 'louver' ? slate : glass;
  const frameColor = kind === 'louver' ? brickShade : brick;
  if (level === 0) {
    fbox(out, 'opening', face, u - width / 2, u + width / 2, y, y + height, 0.016, 0.034, dark);
    return;
  }
  opening(out, face, u, y, width, height, {
    head: 'pointed',
    frameSlot: 'brick',
    glassSlot: 'opening',
    frame: frameColor,
    glass: dark,
    frameWidth: kind === 'door' ? 0.23 : 0.16,
    frameDepth: 0.14,
    rise: width * 0.67,
    d: 0.045,
    sill: kind !== 'door',
    mullions: kind === 'window' && level > 1 && width > 1.1 ? 1 : 0,
    transoms: kind === 'window' && level === 3 ? 1 : 0,
    mullionColor: lead,
  });
  if (kind === 'louver' && level > 1) {
    for (let dy = 0.26; dy < height - width * 0.72; dy += 0.34)
      fbox(
        out,
        'opening',
        face,
        u - width * 0.44,
        u + width * 0.44,
        y + dy,
        y + dy + 0.095,
        0.055,
        0.122,
        lead,
      );
  }
}

function buttress(out, face, u, height, level, strength = 1) {
  const width = 0.45 * strength;
  const depth = 0.48 * strength;
  fbox(out, 'brick', face, u - width, u + width, floor, height, -0.035, depth, brick);
  if (level > 1) {
    const ledge = 0.52 * strength;
    fbox(
      out,
      'base',
      face,
      u - width - 0.05,
      u + width + 0.05,
      height - 0.14,
      height,
      0.02,
      ledge,
      plinth,
    );
  }
}

function metalGable(out, x0, x1, z0, z1, eave, ridge, level) {
  const mid = (z0 + z1) / 2;
  const width = z1 - z0;
  gableRoof(out, 'roof', [x0, mid], [x1, mid], width, eave, ridge, roof, {
    overhang: 0.26,
    endSlot: 'stone',
    endColor: granite,
  });
  if (level < 2) return;
  const step = level === 3 ? 0.68 : 1.65;
  for (let x = x0 + 0.18; x < x1; x += step) {
    const peak = [x, ridge + 0.024, mid];
    beam(out, 'roof', [x, eave + 0.024, z0], peak, 0.035, 0.031, seams);
    beam(out, 'roof', peak, [x, eave + 0.024, z1], 0.035, 0.031, seams);
  }
  beam(
    out,
    'roof',
    [x0 - 0.23, ridge + 0.022, mid],
    [x1 + 0.23, ridge + 0.022, mid],
    0.1,
    0.078,
    brickShade,
  );
}

function nave(out, level) {
  const x0 = -16.7;
  const x1 = 5.825;
  const z0 = -5.754;
  const z1 = 4.123;
  extrude(out, 'base', frame.geometry.outline, foundation, floor + 0.08, plinth, { top: false });
  box(out, 'stone', x0, x1, z0, z1, floor, naveEaveM, granite);
  metalGable(out, x0, x1, z0, z1, naveEaveM, naveRidgeM, level);

  for (const [face, sign, bays] of [
    [north(z0), -1, [-7.1, -3.55, 0, 3.6]],
    [south(z1), 1, [-14.1, -9.65, -5.15, -0.58, 3.65]],
  ]) {
    for (const x of bays) lancet(out, face, x * sign, 4.0, level === 0 ? 1.17 : 1.3, 3.7, level);
  }
  if (level > 0) {
    for (const x of [-8.9, -5.4, -1.8, 1.9, 5.3]) buttress(out, north(z0), -x, 8.9, level);
    for (const x of [-16.1, -11.9, -7.5, -2.95, 1.55, 5.4]) buttress(out, south(z1), x, 8.9, level);
  }
  // The large west window stands alongside the northwest tower.
  lancet(out, west(x0), 0.98, 4.45, 2.6, 6.94, level);
  box(out, 'brick', 4.55, 5.5, -1.46, -0.37, naveRidgeM - 0.77, naveRidgeM + 1.07, brickShade);
  if (level > 1)
    box(out, 'brick', 4.49, 5.56, -1.52, -0.31, naveRidgeM + 0.86, naveRidgeM + 1.1, brick);
}

function smallGabledRoom(out, bounds, eave, ridge, level) {
  const [x0, x1, z0, z1] = bounds;
  box(out, 'stone', x0, x1, z0, z1, floor, eave, granite);
  const x = (x0 + x1) / 2;
  gableRoof(out, 'roof', [x, z0], [x, z1], x1 - x0, eave, ridge, roof, {
    overhang: 0.2,
    endSlot: 'stone',
    endColor: granite,
  });
  lancet(out, south(z1), x, 1.49, 1.12, 2.37, level);
}

function chancel(out, level) {
  const x0 = 5.825;
  const x1 = 16.708;
  const z0 = -10.838;
  const z1 = 4.115;
  const eave = 6.85;
  const ridge = 13.22;
  box(out, 'stone', x0, x1, z0, -0.766, floor, eave, granite);
  box(out, 'stone', x0, 15.826, -0.79, z1, floor, eave - 0.015, granite);
  metalGable(out, x0, x1, z0, z1, eave, ridge, level);
  for (const x of [7.1, 10.75, 14.5]) lancet(out, north(z0), -x, 2.88, 1.2, 2.85, level);
  lancet(out, east(x1), 3.3, 4.04, 2.65, 5.93, level);
  if (level > 0) {
    buttress(out, east(x1), 7.9, 7.4, level);
    buttress(out, east(15.826), -2.1, 6.55, level);
    lancet(out, east(15.826), -1.9, 2.0, 1.02, 2.42, level);
    for (const x of [8.95, 12.75]) buttress(out, north(z0), -x, 6.4, level);
  }
  smallGabledRoom(out, [-14.9, -11.047, 4.05, 8.648], 3.8, 5.8, level);
  smallGabledRoom(out, [7.475, 13.137, 4.04, 8.116], 4.8, 7.65, level);
}

function clockFace(out, face, u, y, level) {
  const point = (i, n, radius, depth) => {
    const a = (i * 2 * Math.PI) / n;
    return face.P(u - radius * Math.sin(a), y + radius * Math.cos(a), depth);
  };
  const segments = [8, 12, 16, 24][level];
  fan(
    out,
    'brick',
    Array.from({ length: segments }, (_, i) => point(i, segments, 0.93, 0.062)),
    brick,
  );
  fan(
    out,
    'opening',
    Array.from({ length: segments }, (_, i) => point(i, segments, 0.7, 0.089)),
    clock,
  );
  if (level > 1) {
    for (let i = 0; i < 12; i++)
      beam(
        out,
        'opening',
        point(i, 12, 0.5, 0.105),
        point(i, 12, 0.6, 0.105),
        0.037,
        0.029,
        clockMark,
      );
    const hub = face.P(u, y, 0.121);
    beam(out, 'opening', hub, face.P(u + 0.09, y + 0.4, 0.121), 0.063, 0.036, clockMark);
    beam(out, 'opening', hub, face.P(u - 0.28, y + 0.02, 0.121), 0.071, 0.042, clockMark);
  }
}

function spire(out, x0, x1, z0, z1, level) {
  const x = (x0 + x1) / 2;
  const z = (z0 + z1) / 2;
  const y = towerRoofEaveM;
  const tip = [x, totalSpireHeightM - 0.92, z];
  const corners = [
    [x0, y, z1],
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
  ];
  const chamfer = 0.58;
  const shoulders = [
    [x0 + chamfer, y + 2.0, z1 - chamfer],
    [x0 + chamfer, y + 2.0, z0 + chamfer],
    [x1 - chamfer, y + 2.0, z0 + chamfer],
    [x1 - chamfer, y + 2.0, z1 - chamfer],
  ];
  for (let i = 0; i < 4; i++) {
    const next = (i + 1) % 4;
    quad4(out, 'roof', corners[next], corners[i], shoulders[i], shoulders[next], roof);
    tri(out, 'roof', shoulders[next], shoulders[i], tip, roof);
    if (level > 0) beam(out, 'roof', corners[i], shoulders[i], 0.11, 0.078, seams);
    if (level > 1) beam(out, 'roof', shoulders[i], tip, 0.09, 0.06, seams);
  }
  const top = totalSpireHeightM + floor;
  beam(out, 'opening', tip, [x, top, z], 0.092, 0.086, slate);
  if (level > 0)
    beam(out, 'opening', [x - 0.37, top - 0.35, z], [x + 0.37, top - 0.35, z], 0.084, 0.07, slate);
}

function tower(out, level) {
  const x0 = -16.7;
  const x1 = x0 + plan.dimensions.northwestTowerWidthM;
  const z0 = -8.085;
  const z1 = -0.735;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  box(out, 'stone', x0, x1, z0, z1, floor, towerRoofEaveM + 0.02, granite);
  for (const y of [7.73, 11.23, 18.29, 20.71])
    box(out, 'brick', x0 - 0.17, x1 + 0.17, z0 - 0.17, z1 + 0.17, y, y + 0.27, brick);
  for (const [F, u] of [
    [north(z0), -cx],
    [west(x0), cz],
    [south(z1), cx],
    [east(x1), -cz],
  ]) {
    for (const delta of [-1.03, 1.03]) lancet(out, F, u + delta, 12.2, 1.35, 5.16, level, 'louver');
    clockFace(out, F, u, 19.37, level);
    if (level > 0) {
      buttress(out, F, u - 2.99, 20.68, level, 0.94);
      buttress(out, F, u + 2.99, 20.68, level, 0.94);
    }
  }
  lancet(out, north(z0), -cx, floor + 0.08, 2.55, 4.45, level, 'door');
  lancet(out, west(x0), cz - 0.35, 3.39, 0.83, 3.13, level);
  for (const [westEdge, eastEdge, lower, upper] of [
    [cx - 1.64, cx + 1.64, z0 - 1.21, floor - 0.1],
    [cx - 1.56, cx + 1.56, z0 - 0.86, floor + 0.1],
    [cx - 1.49, cx + 1.49, z0 - 0.46, floor + 0.28],
  ])
    box(out, 'base', westEdge, eastEdge, lower, z0 + 0.05, -0.63, upper, plinth);
  spire(out, x0 - 0.33, x1 + 0.33, z0 - 0.33, z1 + 0.33, level);
}

function build(out, level) {
  nave(out, level);
  chancel(out, level);
  tower(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'christ-church-cathedral-model.mjs';
const camera = [42, 18, -49];
const lookAt = [-2, 12, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Christ Church Cathedral',
  wikidataId: plan.wikidataId,
  category: 'church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Stanley’s Anglican cathedral in grey local granite and red brick, with a corrugated red roof and northwest clock tower.',
  camera,
  lookAt,
  sunDirection: [31, 46, -49],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Named cathedral footprint, including the northwest tower and connected rooms.',
  },
  embeddedCanonicalGraphs: ['stone_granite', 'brick', 'metal_painted'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'harbour-roofline-and-clock', position: [41, 8.1, -64], lookAt: [-1, 11.3, -2] },
    {
      name: 'tower-brick-lancets-and-broached-spire',
      position: [-32, 18, -26],
      lookAt: [-13, 17.1, -4.5],
    },
    { name: 'south-and-chancel', position: [38, 16.3, 34], lookAt: [-1, 8.5, 0.9] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'christ-church-cathedral-' + reviewLod,
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
      district: { export: 'district', errorMeters: 0.34, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const eave = plan.dimensions.eavesM,
  ridge = plan.dimensions.ridgeM;
const front = 4.66,
  back = -4.67,
  half = 3.34;
const entrance = facade([0, front], [1, 0]);
const colors = {
  wall: rgb('dfc054'),
  reveal: rgb('b49a4a'),
  roof: rgb('a86348'),
  tile: rgb('b57051'),
  trim: rgb('e2ddd0'),
  mineral: rgb('9d9077'),
  mortar: rgb('b5ab95'),
  porch: rgb('c4b89b'),
  door: rgb('65453d'),
  dark: rgb('343732'),
  glass: rgb('434945'),
  metal: rgb('55554d'),
  tower: rgb('c8aa73'),
};
const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.88 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.84 },
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  concrete: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.92 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.11 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87 },
};
function box(out, slot, lo, hi, color, bottom = false) {
  abox(out, slot, lo, hi, color, { bottom });
}
function panel(out, slot, f, left, right, bottom, top, d, color) {
  quad4(
    out,
    slot,
    f.P(left, bottom, d),
    f.P(right, bottom, d),
    f.P(right, top, d),
    f.P(left, top, d),
    color,
  );
}

function westFront(out, level) {
  const aperture = plan.dimensions.doorArchSpanM / 2;
  const spring = 1.93;
  const threshold = 0.38;
  const f = entrance;
  for (const [l, r] of [
    [-half, -aperture],
    [aperture, half],
  ]) {
    fbox(out, 'plaster', f, l, r, 0.65, eave, -0.72, 0, colors.wall);
    fbox(out, 'foundation', f, l, r, -0.77, 0.68, -0.76, 0.025, colors.mineral);
  }
  const arch = pointedArch(aperture, 1.26, [3, 6, 10, 14][level]);
  for (let i = 1; i < arch.length; i++) {
    const a = arch[i - 1],
      b = arch[i];
    const from = f.P(a[0], a[1] + spring),
      to = f.P(b[0], b[1] + spring);
    quad4(out, 'plaster', from, to, f.P(b[0], eave), f.P(a[0], eave), colors.wall);
    quad4(
      out,
      'plaster',
      to,
      from,
      f.P(a[0], a[1] + spring, -0.72),
      f.P(b[0], b[1] + spring, -0.72),
      colors.reveal,
    );
  }
  panel(out, 'dark', f, -1.4, 1.4, threshold + 0.025, spring + 1.34, -1.57, colors.dark);
  fbox(out, 'trim', f, -aperture, aperture, 2.04, 2.15, -0.02, 0.028, colors.door);
  for (const side of [-1, 1]) {
    const x = aperture * side;
    fbox(out, 'trim', f, x - 0.067, x + 0.067, threshold, 2.1, -0.032, 0.06, colors.door);
    if (level > 0) {
      beam(
        out,
        'trim',
        f.P(x * 0.68, 2.11, 0.032),
        f.P(x * 0.11, 2.91, 0.032),
        0.056,
        0.061,
        colors.door,
      );
    }
    const fold = facade([x, front + 0.08], [side < 0 ? 0.85 : 0.87, side < 0 ? -0.52 : 0.48]);
    const leafMiddle = side * 0.58,
      low = leafMiddle - 0.55,
      high = leafMiddle + 0.55;
    fbox(out, 'trim', fold, low, high, threshold, 2.02, -0.08, 0.052, colors.door, true);
    tri(
      out,
      'trim',
      fold.P(low, 2.02, 0.051),
      fold.P(high, 2.02, 0.051),
      fold.P(leafMiddle + side * 0.43, 3.02, 0.051),
      colors.door,
    );
    if (level > 1) {
      fbox(
        out,
        'bronze',
        fold,
        leafMiddle - 0.08,
        leafMiddle + 0.55,
        1.39,
        1.45,
        0.055,
        0.077,
        colors.metal,
      );
      fbox(
        out,
        'bronze',
        fold,
        leafMiddle - 0.46,
        leafMiddle + 0.04,
        0.84,
        0.89,
        0.055,
        0.077,
        colors.metal,
      );
    }
  }
  box(out, 'concrete', [-2.37, -0.51, 4.55], [2.37, 0.16, 6.19], colors.porch);
  box(out, 'concrete', [-2.21, -0.4, 4.55], [2.21, 0.28, 5.84], colors.porch);
  box(out, 'concrete', [-2.06, -0.28, 4.55], [2.06, threshold, 5.52], colors.trim);
}

function nave(out, level) {
  const sides = facade([-half, 0], [0, 1]),
    opposite = facade([half, 0], [0, -1]);
  for (const f of [sides, opposite]) {
    fbox(out, 'foundation', f, back, front, -0.81, 0.69, -0.27, 0.025, colors.mineral);
    fbox(out, 'plaster', f, back, front, 0.64, eave, -0.27, 0, colors.wall);
    for (let j = 0; j < plan.dimensions.sideBayCount; j++) {
      opening(out, f, -2.94 + 2.85 * j, 1.11, 0.88, 1.88, {
        head: 'pointed',
        rise: 0.65,
        glassSlot: 'dark',
        frameSlot: 'trim',
        glass: colors.glass,
        frame: colors.door,
        frameWidth: 0.063,
        frameDepth: 0.062,
        sill: level > 0,
        mullions: level > 1 ? 1 : 0,
        transoms: level > 1 ? 2 : 0,
      });
    }
  }
  box(out, 'foundation', [-half, -0.78, back - 0.029], [half, 0.68, back + 0.31], colors.mineral);
  box(out, 'plaster', [-half, 0.65, back - 0.031], [half, eave, back + 0.23], colors.wall);
  westFront(out, level);
  gableRoof(out, 'roof', [0, back], [0, front], half * 2, eave, ridge, colors.roof, {
    overhang: 0.34,
    endSlot: 'plaster',
    endColor: colors.wall,
  });
  for (const z of [back - 0.36, front + 0.36]) {
    for (const x of [-half - 0.34, half + 0.34]) {
      beam(out, 'trim', [x, eave - 0.19, z], [0, ridge + 0.024, z], 0.12, 0.2, colors.trim);
    }
  }
  if (level > 1) {
    const strips = level === 3 ? 11 : 6;
    for (let j = 1; j < strips; j++) {
      const t = j / strips;
      for (const side of [-1, 1]) {
        const x = side * (half + 0.29) * t,
          y = ridge - ((ridge - eave) * Math.abs(x)) / half + 0.025;
        beam(out, 'roof', [x, y, back - 0.3], [x, y, front + 0.3], 0.025, 0.028, colors.tile);
      }
    }
  }
}

function steeple(out, level) {
  const z = 0.64;
  const square = (y, r) =>
    outwardRing([
      [-r, z - r],
      [-r, z + r],
      [r, z + r],
      [r, z - r],
    ]).map(([x, v]) => [x, y, v]);
  box(out, 'plaster', [-0.52, 5.43, z - 0.52], [0.52, 5.82, z + 0.52], colors.tower);
  const base = [5.81, 0.66],
    neck = [6.22, 0.38],
    mid = [7.13, 0.205],
    tip = [8.08, 0.026];
  loft(
    out,
    'roof',
    (level < 2 ? [base, neck, tip] : [base, neck, mid, tip]).map(([y, r]) => square(y, r)),
    colors.tower,
    { cap: false },
  );
  if (level > 0) {
    const rim = square(5.828, 0.62);
    for (let i = 0; i < rim.length; i++) {
      beam(out, 'trim', rim[i], rim[(i + 1) % rim.length], 0.046, 0.049, colors.trim);
    }
  }
  box(
    out,
    'bronze',
    [-0.027, 8.028, z - 0.029],
    [0.027, plan.dimensions.spireCrossTopM, z + 0.029],
    colors.metal,
    true,
  );
  box(out, 'bronze', [-0.163, 8.36, z - 0.029], [0.163, 8.421, z + 0.029], colors.metal, true);
}

function build(out, level) {
  nave(out, level);
  steeple(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'alto-vista-chapel-model.mjs';
const camera = [-15, 10, 21],
  lookAt = [0, 3.1, 0.29];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Alto Vista Chapel',
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
    'Yellow coastal chapel in Noord with open pointed doors, orange roofing and a narrow tan bell spire.',
  camera,
  lookAt,
  sunDirection: [-36, 58, 52],
  mediumFiContext: {
    scale: 1,
    terrain: {
      descriptor: 'terrain-review.terrain.json',
      heightmap: 'terrain-review.height.png',
    },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Mapped Alto Vista Chapel footprint and the small west entrance stoop.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'tile_ceramic',
    'wood_plain',
    'stone_ashlar',
    'concrete_panel',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'yellow-front-and-open-pointed-doors', position: [-5, 3.4, 16], lookAt: [0, 3.85, 1] },
    { name: 'red-roof-and-three-side-windows', position: [-14, 4.5, 5.5], lookAt: [0, 3.1, 0] },
    { name: 'bell-spire-and-stone-stoop', position: [10, 8.0, 14], lookAt: [0, 4.1, 1.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'alto-vista-chapel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.36,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.14, surfaces },
      street: { export: 'street', errorMeters: 0.064, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.029, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, OpenStreetMap geometry under ODbL and Mapzen elevation under source attribution terms.',
};

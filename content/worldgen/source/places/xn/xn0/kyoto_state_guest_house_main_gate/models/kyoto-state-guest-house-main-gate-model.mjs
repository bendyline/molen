import fs from 'node:fs';
import {
  beam,
  loft,
  radialRing,
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

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const x = 0.765;
const gateEave = plan.dimensions.gateEaveHeightM;
const gateRidge = plan.dimensions.gateRidgeHeightM;
const gateHalf = plan.dimensions.openingClearWidthM / 2;
const colors = {
  timber: rgb('46352b'),
  oldTimber: rgb('514036'),
  darkTimber: rgb('382b25'),
  endWood: rgb('cdc4a9'),
  tile: rgb('52545a'),
  tileRib: rgb('687077'),
  tileEdge: rgb('555a60'),
  stone: rgb('b6ae9a'),
  apron: rgb('c6c1b4'),
  plaster: rgb('bcab7a'),
  bronze: rgb('646050'),
};
const surfaces = {
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.88 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.83 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.87 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.92 },
  bronze: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.18 },
};

function box(out, slot, lo, hi, color, bottom = false) {
  abox(out, slot, lo, hi, color, { bottom });
}

function mainRoof(out, level) {
  const left = -4.58,
    right = 6.11,
    ridgeZ = 0.4;
  const profile = [
    [0, gateRidge],
    [0.3, 4.74],
    [0.67, 4.14],
    [1, gateEave],
  ];
  for (const side of [-1, 1]) {
    const z = (t) => ridgeZ + side * 3.49 * t;
    const roofY = (i, u) => profile[i][1] + (0.047 * profile[i][0] * Math.abs(u - x)) / 5.35;
    const points = (i) => [
      [left, roofY(i, left), z(profile[i][0])],
      [right, roofY(i, right), z(profile[i][0])],
    ];
    for (let i = 1; i < profile.length; i++) {
      const [a, b] = points(i - 1),
        [c, d] = points(i);
      const surface = side === 1 ? [c, d, b, a] : [d, c, a, b];
      quad4(out, 'tile', ...surface, colors.tile);
      quad4(
        out,
        'wood',
        ...surface.reverse().map(([u, y, v]) => [u, y - 0.115, v]),
        colors.darkTimber,
      );
      for (const u of [left, right]) {
        beam(
          out,
          'tile',
          [u, roofY(i - 1, u), z(profile[i - 1][0])],
          [u, roofY(i, u), z(profile[i][0])],
          0.13,
          0.16,
          colors.tileEdge,
        );
      }
    }
    const eave = z(1);
    beam(
      out,
      'tile',
      [left, gateEave + 0.028, eave],
      [right, gateEave + 0.028, eave],
      0.112,
      0.17,
      colors.tileEdge,
    );
    const rafterCount = [3, 16, 23, 30][level];
    for (let i = 0; i < rafterCount; i++) {
      const u = left + 0.2 + ((right - left - 0.4) * i) / (rafterCount - 1);
      beam(
        out,
        'wood',
        [u, gateEave - 0.19, eave - side * 1.27],
        [u, gateEave - 0.147, eave - side * 0.08],
        0.105,
        0.115,
        colors.oldTimber,
      );
      if (level > 0) {
        box(
          out,
          'trim',
          [u - 0.045, gateEave - 0.207, eave - side * 0.072 - 0.036],
          [u + 0.045, gateEave - 0.123, eave - side * 0.072 + 0.036],
          colors.endWood,
          true,
        );
      }
    }
    if (level < 2) continue;
    const count = level === 3 ? 43 : 21;
    for (let j = 1; j < count; j++) {
      const u = left + ((right - left) * j) / count;
      for (let i = 1; i < profile.length; i++) {
        const [t0, t1] = [profile[i - 1][0], profile[i][0]];
        beam(
          out,
          'tile',
          [u, roofY(i - 1, u) + 0.033, z(t0)],
          [u, roofY(i, u) + 0.031, z(t1)],
          0.087,
          0.06,
          j % 3 === 0 ? colors.tileRib : colors.tileEdge,
        );
      }
    }
  }
  for (const side of [-1, 1]) {
    const u = x + side * 5.34;
    for (let j = 1; j < profile.length; j++) {
      const [t0, y0] = profile[j - 1],
        [t1, y1] = profile[j];
      const p = [u, y0 - 0.08, ridgeZ + side * 3.49 * t0];
      const q = [u, y1 - 0.08, ridgeZ + side * 3.49 * t1];
      // Gable ends remain enclosed under the tiled roof.
      const hi = [u, y0 - 0.08, ridgeZ - side * 3.49 * t0];
      const lo = [u, y1 - 0.08, ridgeZ - side * 3.49 * t1];
      if (j === 1) tri(out, 'wood', p, side > 0 ? q : lo, side > 0 ? lo : q, colors.darkTimber);
      else quad4(out, 'wood', ...(side > 0 ? [p, q, lo, hi] : [hi, lo, q, p]), colors.darkTimber);
    }
  }
  beam(
    out,
    'tile',
    [left - 0.02, gateRidge + 0.047, ridgeZ],
    [right + 0.02, gateRidge + 0.047, ridgeZ],
    0.23,
    0.18,
    colors.tileEdge,
  );
}

function leaf(out, direction, level) {
  const low = 0.26,
    split = 2.09,
    top = 3.43,
    middle = x + direction * 1.6;
  box(out, 'wood', [middle - 1.54, low, 0.71], [middle + 1.54, split, 0.9], colors.darkTimber);
  for (const u of [middle - 1.46, middle + 1.46]) {
    box(out, 'wood', [u - 0.11, low, 0.69], [u + 0.11, top, 0.94], colors.timber);
  }
  for (const y of [split, top - 0.13]) {
    box(
      out,
      'wood',
      [middle - 1.55, y - 0.06, 0.67],
      [middle + 1.55, y + 0.072, 0.93],
      colors.timber,
    );
  }
  const divisions = [6, 14, 27, 33][level];
  for (let j = 1; j < divisions; j++) {
    const u = middle - 1.36 + (2.72 * j) / divisions;
    box(out, 'wood', [u - 0.021, split, 0.793], [u + 0.021, top - 0.12, 0.875], colors.oldTimber);
  }
  if (level < 2) return;
  for (const offset of [-0.51, 0.51]) {
    box(
      out,
      'trim',
      [middle + offset - 0.014, low, 0.897],
      [middle + offset + 0.014, split - 0.03, 0.925],
      colors.oldTimber,
    );
  }
  const u = x + direction * 1.0;
  const rings = [
    radialRing(1.19, 0.069, 0.062, 8, [u, 0.96]),
    radialRing(1.34, 0.088, 0.081, 8, [u, 0.96]),
  ];
  loft(out, 'bronze', rings, colors.bronze, { cap: false });
}

function gateFrame(out, level) {
  for (const side of [-1, 1]) {
    const u = x + side * (gateHalf + 0.2);
    box(out, 'stone', [u - 0.34, 0.07, 0.4], [u + 0.34, 0.38, 1.13], colors.stone);
    box(out, 'wood', [u - 0.23, 0.33, 0.43], [u + 0.23, 3.79, 1.02], colors.timber);
    box(out, 'wood', [u - 0.19, 0.27, -1.57], [u + 0.19, 3.64, -1.09], colors.timber);
    box(out, 'trim', [u - 0.2, 3.47, -2.5], [u + 0.2, 3.66, 3.52], colors.oldTimber, true);
    box(out, 'trim', [u - 0.19, 3.49, 3.39], [u + 0.19, 3.73, 3.58], colors.endWood, true);
    leaf(out, side, level);
  }
  for (const [z, y] of [
    [0.77, 3.46],
    [-1.33, 3.44],
    [2.63, 3.56],
  ]) {
    box(
      out,
      'wood',
      [x - 4.14, y, z - 0.19],
      [x + 4.14, y + 0.24, z + 0.19],
      colors.darkTimber,
      true,
    );
  }
  box(out, 'stone', [x - 3.27, 0.0, 0.5], [x + 3.27, 0.26, 1.32], colors.stone);
  box(out, 'stone', [x - 5.58, -0.18, 1.1], [x + 5.58, 0.16, 4.51], colors.apron);
  if (level > 1) {
    for (const z of [1.55, 2.53, 3.52, 4.48]) {
      beam(out, 'stone', [x - 5.57, 0.163, z], [x + 5.57, 0.163, z], 0.012, 0.012, colors.stone);
    }
  }
}

function wingWall(out, a, b, y, level) {
  const f = facade(a, [b[0] - a[0], b[1] - a[1]]);
  const size = Math.hypot(b[0] - a[0], b[1] - a[1]);
  fbox(out, 'stone', f, 0, size, -0.27, 0.38, -0.18, 0.25, colors.stone);
  fbox(out, 'plaster', f, 0, size, 0.34, y, -0.12, 0.18, colors.plaster);
  fbox(out, 'wood', f, -0.06, size + 0.06, y - 0.09, y + 0.048, -0.17, 0.22, colors.timber);
  gableRoof(out, 'tile', a, b, 0.72, y, y + 0.26, colors.tile, {
    overhang: 0.13,
    endSlot: 'wood',
    endColor: colors.timber,
  });
  if (level === 0) return;
  const intervals = Math.ceil(size / 2.2);
  for (let i = 0; i <= intervals; i++) {
    const u = (i * size) / intervals;
    fbox(out, 'wood', f, u - 0.045, u + 0.045, 0.36, y, -0.138, 0.202, colors.timber);
  }
}

function build(out, level) {
  gateFrame(out, level);
  mainRoof(out, level);
  const wallY = plan.dimensions.shortWallHeightM;
  const north = [-6.29, 0.585],
    south = [8.2, 0.585];
  wingWall(out, north, [-2.84, 0.585], wallY, level);
  wingWall(out, [4.38, 0.585], south, wallY, level);
  wingWall(out, [-6.29, 7.41], north, wallY + 0.51, level);
  wingWall(out, south, [8.2, 7.41], wallY + 0.51, level);
  wingWall(out, [-11.8, 7.41], [-6.29, 7.41], wallY + 0.51, level);
  wingWall(out, [8.2, 7.41], [13.5, 7.41], wallY + 0.51, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kyoto-state-guest-house-main-gate-model.mjs';
const camera = [19, 13, 27],
  lookAt = [0.71, 2.24, 2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Kyoto State Guest House Main Gate',
  wikidataId: plan.wikidataId,
  category: 'ceremonial-gate',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Kyoto’s formal west-facing guesthouse gate with slate-gray tile, timber lattice doors and short plaster wings.',
  camera,
  lookAt,
  sunDirection: [-24, 51, 59],
  mediumFiContext: {
    scale: 1,
    terrain: {
      descriptor: 'terrain-review.terrain.json',
      heightmap: 'terrain-review.height.png',
    },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.86,
    basis:
      'Native gate roof. The landscaping, plaster returns and apron extend to the mapped approach.',
  },
  embeddedCanonicalGraphs: [
    'stone_ashlar',
    'wood_plain',
    'tile_ceramic',
    'plaster_lime',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'formal-front-and-tiled-eaves',
      position: [-0.1, 2.1, 18.6],
      lookAt: [0.69, 2.55, 0.8],
    },
    {
      name: 'lattice-doors-and-rafter-ends',
      position: [10.0, 2.1, 12.5],
      lookAt: [1.1, 2.62, 0.5],
    },
    { name: 'apron-and-plaster-wall-returns', position: [-18, 8, 16], lookAt: [1.3, 2.2, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kyoto-state-guest-house-main-gate-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.43,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.18, surfaces },
      street: { export: 'street', errorMeters: 0.08, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.033, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license, native OpenStreetMap geometry under ODbL and GSI elevations under source attribution terms.',
};

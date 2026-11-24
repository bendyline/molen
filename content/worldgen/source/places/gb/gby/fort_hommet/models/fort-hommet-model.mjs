import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import triangulate from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [tower, wall, block] = frame.features;

const color = {
  granite: rgb('817e73'),
  slate: rgb('6e736e'),
  coping: rgb('969384'),
  concrete: rgb('9b9b91'),
  ashlar: rgb('a29b8d'),
  darker: rgb('383b35'),
  metal: rgb('4d524a'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_drywall', roughness: 0.95 },
  masonry: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  concrete: { slot: 'foundation', graph: 'concrete_boardformed', roughness: 0.94 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.79, metallic: 0.09 },
  dark: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.94 },
};

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const lower = terrain.heightsMeters[j];
  const upper = terrain.heightsMeters[j + 1];
  return (
    (lower[i] * (1 - a) + lower[i + 1] * a) * (1 - b) +
    (upper[i] * (1 - a) + upper[i + 1] * a) * b -
    terrain.modelDatumElevationMeters
  );
}

function cap(out, slot, path, y, tint) {
  const ids = triangulate(path.flat());
  const pos = (i) => [path[i][0], y, path[i][1]];
  for (let i = 0; i < ids.length; i += 3) {
    tri(out, slot, pos(ids[i]), pos(ids[i + 2]), pos(ids[i + 1]), tint);
  }
}

function towerCore(out, level) {
  const outline = outwardRing(tower.points);
  const path = level === 0 ? outline.filter((_, i) => i % 2 === 0) : outline;
  const top = plan.dimensions.towerVisibleHeightM;
  const ring = (s, y) => path.map(([x, z]) => [s * x, y, z * s]);
  loft(out, 'stone', [ring(1.04, -0.48), ring(1.01, 0.65), ring(0.91, top)], color.granite, {
    cap: false,
  });
  loft(out, 'masonry', [ring(0.987, top - 0.16), ring(0.973, top + 0.08)], color.coping, {
    cap: false,
  });
  const deck = path.map(([x, z]) => [x * 0.925, z * 0.925]);
  cap(out, 'stone', deck, top - 0.28, color.slate);

  const slot = facade([-0.26, 2.93], [1, 0]);
  fbox(out, 'masonry', slot, -0.54, 0.54, 2.92, 4.06, -0.05, 0.105, color.ashlar);
  quad4(
    out,
    'dark',
    slot.P(-0.29, 3.13, 0.122),
    slot.P(0.3, 3.13, 0.122),
    slot.P(0.3, 3.86, 0.122),
    slot.P(-0.29, 3.86, 0.122),
    color.darker,
  );
  if (level > 0) {
    for (const x of [-0.18, -0.06, 0.06, 0.18]) {
      fbox(out, 'metal', slot, x - 0.016, x + 0.016, 3.13, 3.87, 0.125, 0.175, color.metal);
    }
  }
  if (level > 1) {
    loft(out, 'stone', [ring(0.957, 2.3), ring(0.951, 2.41)], color.slate, { cap: false });
    abox(out, 'masonry', [-0.69, top - 0.28, -2.09], [0.48, top + 0.21, -0.87], color.coping, {
      bottom: false,
    });
  }
}

function wallStrip(out, rows, slot, halfWidth, bottom, top, tint) {
  const point = (item, side, y) => [
    item.position[0] + item.offset[0] * halfWidth * side,
    y(item),
    item.position[1] + item.offset[1] * halfWidth * side,
  ];
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1];
    const b = rows[i];
    const al = point(a, -1, bottom);
    const ar = point(a, 1, bottom);
    const bl = point(b, -1, bottom);
    const br = point(b, 1, bottom);
    const at = point(a, -1, top);
    const au = point(a, 1, top);
    const bt = point(b, -1, top);
    const bu = point(b, 1, top);
    quad4(out, slot, ar, br, bu, au, tint);
    quad4(out, slot, bl, al, at, bt, tint);
    quad4(out, slot, au, bu, bt, at, tint);
    if (i === 1) quad4(out, slot, al, ar, au, at, tint);
    if (i === rows.length - 1) quad4(out, slot, br, bl, bt, bu, tint);
  }
}

function stoneEnclosure(out, level) {
  const path = wall.points;
  const normals = path.slice(1).map(([x, z], i) => {
    const dx = x - path[i][0];
    const dz = z - path[i][1];
    const length = Math.hypot(dx, dz);
    return [-dz / length, dx / length];
  });
  const rows = path.map((position, i) => {
    const a = normals[Math.max(0, i - 1)];
    const b = normals[Math.min(i, normals.length - 1)];
    const denominator = 1 + a[0] * b[0] + a[1] * b[1];
    const gx = ground(...position);
    return {
      position,
      offset: [(a[0] + b[0]) / denominator, (a[1] + b[1]) / denominator],
      ground: gx,
      top: plan.dimensions.stoneWallTypicalTopM + Math.min(0.18, gx * 0.39) + (i < 3 ? 0.22 : 0),
    };
  });
  wallStrip(
    out,
    rows,
    'stone',
    0.64,
    (p) => p.ground - 0.77,
    (p) => p.top,
    color.granite,
  );
  if (level > 0)
    wallStrip(
      out,
      rows,
      'masonry',
      0.71,
      (p) => p.top - 0.06,
      (p) => p.top + 0.12,
      color.coping,
    );
  if (level > 1)
    wallStrip(
      out,
      rows,
      'stone',
      0.651,
      (p) => p.ground + 0.84,
      (p) => p.ground + 1.05,
      color.slate,
    );
  if (level > 2) {
    for (const i of [2, 7]) {
      const [a, b] = path.slice(i, i + 2);
      const f = facade(a, [b[0] - a[0], b[1] - a[1]]);
      const u = Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.38;
      fbox(
        out,
        'dark',
        f,
        u - 0.095,
        u + 0.095,
        rows[i].ground + 1.55,
        rows[i].ground + 1.91,
        0.644,
        0.67,
        color.darker,
      );
    }
  }
  const z = -6.3;
  const landing = [
    [-9.63, z - 0.2],
    [-5.1, z - 0.2],
    [-5.1, z + 3.25],
    [-9.62, z + 3.25],
  ];
  abox(out, 'stone', [-9.57, -0.45, z - 0.19], [-5.11, 1.43, z + 3.23], color.slate, {
    bottom: false,
  });
  cap(out, 'masonry', landing, 1.47, color.coping);
  if (level > 0) {
    for (let i = 0; i < 4; i++) {
      const x = -4.72 + 0.43 * i;
      abox(
        out,
        'masonry',
        [x, -0.25, z + 0.31],
        [x + 0.48, 0.31 + 0.23 * i, z + 2.39],
        color.ashlar,
        { bottom: false },
      );
    }
  }
  if (level > 1) {
    beam(out, 'metal', [-9.45, 2.19, z + 3.19], [-5.5, 2.19, z + 3.19], 0.053, 0.053, color.metal);
    for (const x of [-9.41, -8.1, -6.79, -5.53]) {
      beam(out, 'metal', [x, 1.48, z + 3.19], [x, 2.19, z + 3.19], 0.045, 0.047, color.metal);
    }
  }
}

function adjoiningBlock(out, level) {
  const path = outwardRing(block.points);
  const x = path.reduce((n, p) => n + p[0], 0) / path.length;
  const z = path.reduce((n, p) => n + p[1], 0) / path.length;
  const g = ground(x, z);
  const top = g + plan.dimensions.concreteBlockHeightM;
  const ring = (s, y) => path.map(([a, b]) => [x + (a - x) * s, y, z + (b - z) * s]);
  loft(
    out,
    'concrete',
    [ring(1, g - 1.4), ring(1, top - 0.63), ring(0.94, top - 0.22), ring(0.83, top)],
    color.concrete,
    { cap: false },
  );
  cap(
    out,
    'concrete',
    ring(0.83, top).map(([a, , b]) => [a, b]),
    top,
    color.concrete,
  );
  const south = (a, b) => (a[1] + b[1]) / 2;
  const edge = path
    .map((a, i) => [a, path[(i + 1) % path.length]])
    .sort(([a, b], [c, d]) => south(c, d) - south(a, b))[0];
  const f = facade(edge[0], [edge[1][0] - edge[0][0], edge[1][1] - edge[0][1]]);
  const w = Math.hypot(edge[1][0] - edge[0][0], edge[1][1] - edge[0][1]);
  fbox(out, 'dark', f, w * 0.2, w * 0.39, g + 1.64, g + 2.09, 0.012, 0.045, color.darker);
  if (level > 0) {
    fbox(out, 'dark', f, w * 0.64, w * 0.73, g + 0.89, g + 2.28, 0.014, 0.038, color.darker);
    if (level > 1) {
      fbox(out, 'concrete', f, w * 0.18, w * 0.76, g + 2.51, g + 2.58, 0.003, 0.028, color.slate);
    }
  }
}

function build(out, level) {
  towerCore(out, level);
  stoneEnclosure(out, level);
  adjoiningBlock(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-hommet-model.mjs';
const camera = [-32, 15, 36];
const lookAt = [1.5, 1.94, 0.9];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Fort Hommet',
  wikidataId: plan.wikidataId,
  category: 'historic-fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Stone Martello tower, curving enclosure and the weathered concrete exterior on Guernsey’s Vazon Bay headland.',
  camera,
  lookAt,
  sunDirection: [-36, 65, 43],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_drywall',
    'stone_ashlar',
    'concrete_boardformed',
    'metal_painted',
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'upper-tower-and-enclosure', position: [-14, 5.8, 28], lookAt: [0, 2.48, 1.5] },
    { name: 'stonework-and-concrete-profile', position: [26, 9, 23], lookAt: [4, 2.35, -0.2] },
    { name: 'landward-footings', position: [-19, 10, -20], lookAt: [0, 1.65, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-hommet-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.54,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.23, surfaces },
      street: { export: 'street', errorMeters: 0.087, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.037, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Native footprints under ODbL and Mapzen open elevation tiles under their published attribution.',
};

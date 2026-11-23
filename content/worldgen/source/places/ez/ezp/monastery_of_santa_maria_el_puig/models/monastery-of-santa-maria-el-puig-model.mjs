import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor, cornice, cornerTower, belfryPeak } = plan.dimensions;
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_drywall', roughness: 0.95 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.95 },
  stone: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.79 },
};
const masonry = rgb('b6916e');
const cladding = rgb('ac8b75');
const dressing = rgb('c3ad90');
const rock = rgb('88715c');
const glass = rgb('53493d');
const tile = rgb('876257');
const mortar = rgb('aa8d76');
const [court] = frame.geometry.holes;
const perimeter = outwardRing(frame.geometry.outline);
const inwardCourt = outwardRing(court).reverse();

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function band(out, F, u0, u1, y, h, depth = 0.24) {
  fbox(out, 'trim', F, u0, u1, y - h, y, 0, depth, dressing);
}
function openingAt(out, F, u, y, w, h, lod, { head = 'flat', dark = glass, wide = false } = {}) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    frame: dressing,
    glass: dark,
    head,
    d: 0.045,
    frameWidth: lod > 1 ? (wide ? 0.29 : 0.082) : 0,
    frameDepth: wide ? 0.22 : 0.12,
    sill: lod > 1 && head === 'flat',
    mullions: lod === 3 && w > 0.95 && !wide ? 1 : 0,
  });
}

function rows(out, F, lod) {
  const count = Math.max(2, Math.round(F.length / 4.35));
  for (let i = 0; i < count; i++) {
    const u = (F.length * (i + 0.5)) / count;
    if (lod === 0 && i % 2) continue;
    openingAt(out, F, u, 17.44, 0.69, 0.8, lod);
    if (i % 2 === 0 || lod > 1) {
      openingAt(out, F, u, 12.3, 0.95, 1.59, lod);
      openingAt(out, F, u, 8.16, i % 2 === 0 ? 1.03 : 0.68, i % 2 === 0 ? 1.79 : 0.89, lod);
      if (lod > 0) openingAt(out, F, u, 4.11, 0.82, 1.19, lod);
    }
  }
}

function wallRange(out, lod) {
  extrude(out, 'stone', perimeter, foundation, floor, rock, { holes: [inwardCourt], top: false });
  extrude(out, 'wall', perimeter, floor, cornice, masonry, { holes: [inwardCourt], top: false });
  for (let i = 0; i < perimeter.length; i++) {
    const F = wallFace(perimeter[i], perimeter[(i + 1) % perimeter.length]);
    if (lod > 0 || F.length > 8) band(out, F, -0.12, F.length + 0.12, cornice + 0.24, 0.38, 0.34);
    if (lod > 0) band(out, F, 0, F.length, 4.6, 0.15);
    if (F.length > 20) rows(out, F, lod);
  }
}

function hip(out, x0, x1, z0, z1, eave, ridge, slot = 'roof') {
  const [a, b, c, d] = [
    [x0, eave, z1],
    [x1, eave, z1],
    [x1, eave, z0],
    [x0, eave, z0],
  ];
  const zMid = (z0 + z1) / 2,
    xMid = (x0 + x1) / 2;
  const xHalf = (x1 - x0) / 2,
    zHalf = (z1 - z0) / 2;
  if (xHalf > zHalf) {
    const [p, q] = [
      [x0 + zHalf, ridge, zMid],
      [x1 - zHalf, ridge, zMid],
    ];
    quad4(out, slot, a, b, q, p, tile);
    quad4(out, slot, c, d, p, q, tile);
    tri(out, slot, b, c, q, tile);
    tri(out, slot, d, a, p, tile);
  } else {
    const [p, q] = [
      [xMid, ridge, z1 - xHalf],
      [xMid, ridge, z0 + xHalf],
    ];
    tri(out, slot, a, b, p, tile);
    quad4(out, slot, b, c, q, p, tile);
    tri(out, slot, c, d, q, tile);
    quad4(out, slot, d, a, p, q, tile);
  }
}

function roofRanges(out, lod) {
  const corners = [
    [-32.13, -29.22],
    [34.06, -29.98],
    [34.14, 48.15],
    [-31.87, 48.15],
  ];
  for (let i = 0; i < corners.length; i++) {
    const j = (i + 1) % corners.length;
    const a = corners[i],
      b = corners[j],
      c = court[j],
      d = court[i];
    const avg = (p, q, y) => [(p[0] + q[0]) * 0.5, y, (p[1] + q[1]) * 0.5];
    const edge = (p) => [p[0], cornice + 0.14, p[1]];
    const A = edge(a),
      B = edge(b),
      C = edge(c),
      D = edge(d);
    const P = avg(a, d, 22.18),
      Q = avg(b, c, 22.18);
    quad4(out, 'roof', B, A, P, Q, tile);
    quad4(out, 'roof', D, C, Q, P, tile);
  }
  for (let i = 0; i < inwardCourt.length; i++) {
    const F = wallFace(inwardCourt[i], inwardCourt[(i + 1) % inwardCourt.length]);
    band(out, F, 0, F.length, 20.57, 0.28);
    if (lod === 0) continue;
    band(out, F, 0, F.length, 8.84, 0.23);
    const n = Math.round(F.length / 3.4);
    for (let k = 0; k < n; k++) {
      const u = (F.length * (k + 0.5)) / n;
      openingAt(out, F, u, 2.02, 1.92, 4.14, lod, { head: 'round' });
      openingAt(out, F, u, 10.29, 1.7, 3.64, lod, { head: 'tudor' });
    }
  }
}

const towerBoxes = [
  [-34.19, -23.42, -38.24, -27.14],
  [24.75, 35.55, -39.13, -28.01],
  [23.01, 35.56, 38.43, 49.88],
  [-33.19, -22.01, 38.58, 49.9],
];

function bastion(out, [x0, x1, z0, z1], lod) {
  block(out, 'wall', x0, x1, z0, z1, floor, cornerTower, masonry);
  block(
    out,
    'trim',
    x0 - 0.27,
    x1 + 0.27,
    z0 - 0.28,
    z1 + 0.28,
    cornerTower - 1.05,
    cornerTower - 0.7,
    dressing,
  );
  block(
    out,
    'trim',
    x0 - 0.33,
    x1 + 0.33,
    z0 - 0.34,
    z1 + 0.34,
    cornerTower - 0.135,
    cornerTower + 0.08,
    dressing,
  );
  const fs = [
    [facade([x0, z1], [1, 0]), x1 - x0],
    [facade([x1, z1], [0, -1]), z1 - z0],
    [facade([x1, z0], [-1, 0]), x1 - x0],
    [facade([x0, z0], [0, 1]), z1 - z0],
  ];
  for (const [F, width] of fs) {
    if (lod > 0) {
      for (const u of [0.45, width - 0.45])
        fbox(out, 'trim', F, u - 0.28, u + 0.28, floor, cornerTower - 0.9, 0, 0.13, dressing);
      for (const u of [width * 0.3, width * 0.68]) openingAt(out, F, u, 21.67, 0.55, 0.62, lod);
      openingAt(out, F, width * 0.5, 9.05, 0.92, 2.1, lod);
    }
  }
  for (const [x, z] of [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ]) {
    block(
      out,
      'trim',
      x - 0.18,
      x + 0.18,
      z - 0.18,
      z + 0.18,
      cornerTower + 0.05,
      cornerTower + 1.06,
      dressing,
    );
    const p = [x, cornerTower + 2.22, z],
      y = cornerTower + 1.04;
    for (const [a, b] of [
      [
        [x - 0.18, y, z + 0.18],
        [x + 0.18, y, z + 0.18],
      ],
      [
        [x + 0.18, y, z + 0.18],
        [x + 0.18, y, z - 0.18],
      ],
      [
        [x + 0.18, y, z - 0.18],
        [x - 0.18, y, z - 0.18],
      ],
      [
        [x - 0.18, y, z - 0.18],
        [x - 0.18, y, z + 0.18],
      ],
    ])
      tri(out, 'trim', a, b, p, dressing);
  }
}

function sanctuary(out, lod) {
  const x0 = -8.21,
    x1 = -0.11,
    z0 = -32.51,
    z1 = -24.4,
    top = belfryPeak - 3.3;
  block(out, 'brick', x0, x1, z0, z1, cornice - 0.06, top, cladding);
  hip(out, x0 - 0.25, x1 + 0.25, z0 - 0.27, z1 + 0.27, top, belfryPeak);
  const fs = [
    facade([(x0 + x1) / 2, z0], [-1, 0]),
    facade([x1, (z0 + z1) / 2], [0, -1]),
    facade([(x0 + x1) / 2, z1], [1, 0]),
    facade([x0, (z0 + z1) / 2], [0, 1]),
  ];
  for (const F of fs) {
    band(out, F, -4.05, 4.05, top - 0.29, 0.22);
    band(out, F, -4.05, 4.05, 25.77, 0.23);
    openingAt(out, F, 0, 26.29, 1.75, 3.92, lod, { head: 'round' });
    if (lod > 1)
      for (const u of [-2.95, 2.95])
        fbox(out, 'trim', F, u - 0.14, u + 0.14, 25.75, top - 0.36, 0, 0.12, dressing);
  }
  const portal = facade([12.05, -30.78], [-1, 0]);
  openingAt(out, portal, 0, 1.12, 3.21, 6.17, lod, { head: 'round', wide: true });
  if (lod > 0) {
    band(out, portal, -2.1, 2.1, 7.76, 0.31);
    openingAt(out, portal, 0, 9.33, 1.12, 1.71, lod, { head: 'round' });
  }
  gableRoof(out, 'roof', [-24.8, -18.0], [24.88, -18.0], 19.7, 21.4, 25.08, tile, {
    overhang: 0.15,
    endSlot: 'wall',
    endColor: masonry,
  });
  const entry = facade([34.14, 27.59], [0, -1]);
  openingAt(out, entry, 0, 1.26, 3.3, 5.69, lod, { head: 'round', wide: true });
  if (lod > 0) {
    for (const u of [-1.95, 1.95])
      fbox(out, 'trim', entry, u - 0.19, u + 0.19, 1.2, 6.97, 0, 0.2, dressing);
    band(out, entry, -2.19, 2.19, 7.33, 0.26);
    for (let i = 0; i < 4; i++) {
      fbox(out, 'stone', entry, -2.47, 2.47, -0.41, 0.22 + i * 0.29, 0, 1.52 - i * 0.34, rock);
    }
  }
}

function build(out, lod) {
  wallRange(out, lod);
  roofRanges(out, lod);
  for (const tower of towerBoxes) bastion(out, tower, lod);
  sanctuary(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'monastery-of-santa-maria-el-puig-model.mjs';
const camera = [116, 38, 129];
const lookAt = [0, 11, 6];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The royal convent at El Puig with four defensively styled stone towers, a roofless cloister and the northern sanctuary and belfry.',
  camera,
  lookAt,
  sunDirection: [44, 54, 33],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The monastery’s mapped outer perimeter.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'fortified-east-and-south-ranges', position: camera, lookAt },
    { name: 'east-entrance-and-corner-towers', position: [94, 23, 39], lookAt: [18, 11.8, 12] },
    { name: 'north-belfry-and-open-cloister', position: [-106, 58, -92], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'el-puig-monastery-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

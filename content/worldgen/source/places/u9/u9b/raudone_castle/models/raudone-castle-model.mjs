import fs from 'node:fs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const style = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  coping: { slot: 'trim', graph: 'brick_flemish', roughness: 0.93 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  joinery: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.79 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.72 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.88 },
};
const brick = rgb('9a5846');
const southBrick = rgb('985a4a');
const coping = rgb('844c3d');
const toastedBrick = rgb('a96350');
const darkBrick = rgb('794e42');
const base = rgb('807268');
const roof = rgb('ae6955');
const shadow = rgb('544237');
const sash = rgb('d8d7ca');
const glass = rgb('586367');
const timber = rgb('59372b');
const tau = Math.PI * 2;

// The west ends, connecting range and eastern exterior all come from the mapped outline.
const north = [
  [-19.987, -40.344],
  [19.915, -40.344],
  [26.417, -31.9],
  [26.19, -28.27],
  [-19.834, -27.733],
];
const east = [
  [12.14, -28.112],
  [26.417, -31.9],
  [23.62, 23.3],
  [8.73, 23.3],
];
const south = [
  [-23.949, 19.059],
  [23.82, 19.55],
  [23.187, 32.583],
  [0.067, 33.987],
  [-23.949, 33.69],
];
const courtBay = [
  [10.361, 1.432],
  [6.525, 1.319],
  [2.122, -2.183],
  [2.273, -9.232],
  [6.623, -12.186],
  [11.061, -12.314],
  [12.8, -5.5],
];
const mainEave = plan.dimensions.mainEavesApprox;
const southEave = mainEave + 0.85;
const southTowerBase = 1.895;
const greatTower = {
  center: [-4.236, 35.906],
  radius: 4.712,
  height: plan.dimensions.greatTowerHeight + southTowerBase,
  seats: 16,
  large: true,
  windowAzimuths: [-0.24, 0.89, 2.06, 2.96],
};
const turrets = [
  {
    center: [-20.21, -36.651],
    radius: 2.68,
    height: 12.35,
    seats: 8,
    windowAzimuths: [2.55, 3.58],
  },
  {
    center: [21.237, -35.404],
    radius: 3.29,
    height: 13.85,
    seats: 9,
    windowAzimuths: [-1.6, -0.45],
  },
  {
    center: [23.289, -7.597],
    radius: 3.54,
    height: 13.75,
    seats: 9,
    windowAzimuths: [-0.57, 0.52],
  },
  { center: [16.153, 33.867], radius: 2.94, height: 15.25, seats: 9, windowAzimuths: [0.8, 1.92] },
  { center: [-23.76, 33.534], radius: 2.79, height: 15.05, seats: 8, windowAzimuths: [1.59, 2.63] },
];

function cappedWall(out, slot, footprint, bottom, top, tint, topTint) {
  extrude(out, slot, footprint, bottom, top, tint, { top: false });
  const faces = earcut(footprint.flat());
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, c] = faces.slice(i, i + 3).map((index) => {
      const [x, z] = footprint[index];
      return [x, top, z];
    });
    tri(out, slot, a, c, b, topTint);
  }
}

function hip(out, ends, ridge, eave, height) {
  const [a, b, c, d] = ends.map(([x, z]) => [x, eave, z]);
  const [p, q] = ridge.map(([x, z]) => [x, height, z]);
  for (const triangle of [
    [b, a, p],
    [b, p, q],
    [c, b, q],
    [d, c, q],
    [d, q, p],
    [a, d, p],
  ]) {
    tri(out, 'roof', ...triangle, roof);
  }
}

function flatPanel(out, slot, F, u, y, w, h, d, tint) {
  quad4(
    out,
    slot,
    F.P(u - w / 2, y, d),
    F.P(u + w / 2, y, d),
    F.P(u + w / 2, y + h, d),
    F.P(u - w / 2, y + h, d),
    tint,
  );
}

function window(out, F, u, y, w, h, lod, arched = false) {
  if (lod < 2 || !arched) {
    flatPanel(out, 'joinery', F, u, y, w + 0.15, h + 0.15, 0.036, sash);
    flatPanel(out, 'glass', F, u, y + 0.072, w - 0.025, h - 0.135, 0.048, glass);
    flatPanel(out, 'joinery', F, u, y + 0.075, 0.062, h - 0.145, 0.058, sash);
    if (lod > 1) {
      flatPanel(out, 'joinery', F, u, y + h * 0.49, w, 0.062, 0.058, sash);
      flatPanel(out, 'coping', F, u, y + h + 0.2, w + 0.48, 0.14, 0.041, toastedBrick);
      flatPanel(out, 'coping', F, u, y - 0.115, w + 0.3, 0.13, 0.043, coping);
    }
    return;
  }
  opening(out, F, u, y, w, h, {
    head: 'round',
    glassSlot: 'glass',
    frameSlot: 'coping',
    glass,
    frame: darkBrick,
    mullionColor: sash,
    frameWidth: 0.12,
    frameDepth: 0.11,
    mullions: 1,
    transoms: lod === 3 ? 1 : 0,
    d: 0.045,
  });
}

const elevations = [
  { a: [-19.98, -40.344], b: [19.88, -40.344], bays: 10, grade: -0.55, eave: mainEave },
  { a: [11.97, -28.106], b: [-19.83, -27.733], bays: 9, grade: -0.2, eave: mainEave },
  { a: [-19.83, -27.733], b: [-19.98, -40.32], bays: 3, grade: -0.25, eave: mainEave, end: true },
  { a: [26.417, -31.9], b: [23.187, 32.583], bays: 15, grade: 0.28, eave: mainEave },
  { a: [10.99, -12.36], b: [12.14, -28.112], bays: 4, grade: 0, eave: mainEave },
  { a: [9.001, 19.382], b: [10.13, 1.47], bays: 4, grade: 0.3, eave: mainEave },
  { a: [-23.949, 19.059], b: [8.8, 19.396], bays: 8, grade: 0.7, eave: southEave },
  { a: [23.187, 32.583], b: [0.067, 33.987], bays: 6, grade: 0.85, eave: southEave },
  { a: [0.067, 33.987], b: [-23.949, 33.69], bays: 6, grade: 0.85, eave: southEave },
  { a: [-23.949, 33.69], b: [-23.949, 19.059], bays: 3, grade: 0.45, eave: southEave, end: true },
];

function elevation(out, row, lod) {
  const { a, b, bays, grade, eave, end } = row;
  // These edges follow the exterior or courtyard side of their mapped masonry run.
  const F = wallFace(b, a);
  const span = F.length;
  if (lod > 1) {
    fbox(out, 'coping', F, 0, span, eave - 0.3, eave - 0.07, -0.07, 0.23, coping);
    fbox(out, 'coping', F, 0, span, grade + 0.74, grade + 0.88, -0.065, 0.09, darkBrick);
  }
  for (let i = 0; i < bays; i++) {
    const u = ((i + 0.5) * span) / bays;
    if (end && i === 1) {
      flatPanel(out, 'door', F, u, grade + 0.19, 1.88, 2.95, 0.038, timber);
    } else {
      window(out, F, u, grade + 1.85, 1.08, 2.0, lod);
    }
    window(out, F, u, eave - 3.31, end && i === 1 ? 1.55 : 1.16, 2.14, lod, end && i === 1);
    if (lod === 3) {
      fbox(out, 'coping', F, u - 0.13, u + 0.13, eave - 0.68, eave - 0.29, -0.025, 0.26, coping);
      if (!end) flatPanel(out, 'glass', F, u, grade + 0.2, 0.69, 0.35, 0.035, shadow);
    }
  }
}

function bay(out, lod) {
  const battlement = mainEave + 2.15;
  cappedWall(out, 'brick', courtBay, -2.4, battlement - 0.46, toastedBrick, shadow);
  for (let side = 0; side < 5; side++) {
    const F = wallFace(courtBay[side + 1], courtBay[side]);
    const center = F.length * 0.5;
    const count = lod === 0 ? 1 : side === 2 ? 5 : 2;
    for (let i = 0; i < count; i++) {
      const u = (F.length * (i + 0.5)) / count;
      fbox(out, 'coping', F, u - 0.34, u + 0.34, battlement - 0.51, battlement, -0.31, 0.1, coping);
    }
    if (lod === 0) continue;
    fbox(out, 'coping', F, 0, F.length, battlement - 0.79, battlement - 0.48, -0.045, 0.1, coping);
    if (side !== 2) {
      window(out, F, center, 1.54, 1.24, 1.8, lod);
      window(out, F, center, 5.16, 1.28, 2.03, lod);
      window(out, F, center, 8.81, 1.24, 1.72, lod);
    } else {
      flatPanel(out, 'door', F, center, 0.58, 1.95, 2.65, 0.037, timber);
      window(out, F, center - 1.64, 5.16, 1.03, 2.03, lod);
      window(out, F, center + 1.64, 5.16, 1.03, 2.03, lod);
      window(out, F, center, 8.81, 1.48, 1.72, lod);
      fbox(out, 'roof', F, center - 1.3, center + 1.3, 3.35, 3.55, -0.02, 0.88, shadow);
      for (let i = 0; i < 3; i++)
        fbox(
          out,
          'footing',
          F,
          center - 1.21,
          center + 1.21,
          0.02,
          0.21 + 0.18 * i,
          -0.04,
          0.86 - 0.27 * i,
          base,
        );
    }
  }
}

function wings(out, lod) {
  for (const [ring, eave, tint] of [
    [north, mainEave, brick],
    [east, mainEave - 0.025, brick],
    [south, southEave, southBrick],
  ]) {
    extrude(out, 'footing', ring, -3.05, 0.46, base, { top: false });
    cappedWall(out, 'brick', ring, 0.46, eave, tint, darkBrick);
  }
  const ridge = plan.dimensions.mainRidgeApprox;
  hip(
    out,
    [
      [-20.25, -40.65],
      [21.15, -40.67],
      [26.5, -28.39],
      [-20.14, -27.47],
    ],
    [
      [-15.2, -34.21],
      [19.38, -34.21],
    ],
    mainEave,
    ridge - 0.32,
  );
  hip(
    out,
    [
      [26.58, -33.83],
      [23.5, 31.8],
      [8.65, 30.66],
      [12, -32.17],
    ],
    [
      [19.5, -27.21],
      [16.63, 25.3],
    ],
    mainEave - 0.025,
    ridge + 0.19,
  );
  hip(
    out,
    [
      [-24.27, 18.81],
      [24.18, 19.34],
      [23.4, 32.98],
      [-24.24, 34.0],
    ],
    [
      [-18.69, 26.01],
      [17.88, 26.01],
    ],
    southEave,
    ridge + 1.18,
  );
  bay(out, lod);
  if (lod > 0) {
    for (const row of elevations) elevation(out, row, lod);
    for (const [x, y, z] of [
      [-13, ridge - 0.72, -34],
      [8, ridge - 0.62, -34],
      [17.41, ridge + 0.11, -17.35],
      [17.23, ridge + 0.14, 12.37],
      [-14, ridge + 1.1, 26],
      [12, ridge + 0.98, 26],
    ]) {
      abox(out, 'brick', [x - 0.32, y - 0.45, z - 0.36], [x + 0.32, y + 0.83, z + 0.36], brick, {
        bottom: false,
      });
      if (lod > 1)
        abox(out, 'coping', [x - 0.4, y + 0.83, z - 0.43], [x + 0.4, y + 1.02, z + 0.43], coping, {
          bottom: false,
        });
    }
  }
  const west = wallFace([-23.949, 19.059], [-23.949, 33.69]);
  const eave = southEave;
  fbox(out, 'brick', west, 3.3, 12.8, eave - 0.3, eave + 1.46, -0.48, 0.04, brick);
  for (let i = 0; i < 7; i++) {
    const u = 3.74 + i * 1.41;
    fbox(out, 'coping', west, u - 0.4, u + 0.4, eave + 1.44, eave + 2.04, -0.52, 0.12, coping);
  }
  for (const u of [3.3, 12.82]) {
    fbox(
      out,
      'brick',
      west,
      u - 0.48,
      u + 0.48,
      eave - 0.52,
      eave + 2.72,
      -0.85,
      0.24,
      toastedBrick,
    );
    fbox(out, 'coping', west, u - 0.61, u + 0.61, eave + 2.72, eave + 2.91, -0.93, 0.3, coping);
  }
}

function turret(out, item, lod) {
  const { center, radius, height, large, windowAzimuths } = item;
  const seats = lod === 0 ? (large ? 8 : 5) : item.seats;
  const sides = [8, 14, 22, 34][lod];
  const crestBase = height - (large ? 1.48 : 0.97);
  const crown = radius * (large ? 1.13 : 1.11);
  const shaft = radius * 0.95;
  const ring = (y, r) => radialRing(y, r, r, sides, center);
  const shell = (slot, rings, tint, cap = false) =>
    loft(
      out,
      slot,
      rings.map(([y, r]) => ring(y, r)),
      tint,
      { cap },
    );
  shell(
    'brick',
    [
      [-3.05, radius],
      [height - 3.75, shaft],
      [crestBase, crown],
    ],
    large ? southBrick : brick,
  );
  if (lod > 0) {
    for (const [y, r, h] of large
      ? [
          [6.95, radius + 0.18, 0.37],
          [13.3, radius + 0.04, 0.47],
          [26.72, radius - 0.07, 0.37],
        ]
      : [
          [5.17, radius + 0.15, 0.26],
          [9.02, radius + 0.04, 0.24],
        ]) {
      shell(
        'coping',
        [
          [y - h / 2, r - 0.29],
          [y, r],
          [y + h / 2, r - 0.12],
        ],
        coping,
      );
    }
  }
  shell(
    'coping',
    lod === 0
      ? [
          [crestBase - 0.68, crown - 0.32],
          [crestBase, crown + 0.06],
        ]
      : [
          [crestBase - 0.65, crown - 0.31],
          [crestBase - 0.28, crown + 0.13],
          [crestBase, crown + 0.06],
        ],
    coping,
    true,
  );
  for (let i = 0; i < seats; i++) {
    const angle = (tau * i) / seats;
    const offset = angle - (0.28 * tau) / seats;
    const end = angle + (0.28 * tau) / seats;
    const points = [
      [
        center[0] + (crown - 0.51) * Math.cos(offset),
        center[1] + (crown - 0.51) * Math.sin(offset),
      ],
      [center[0] + crown * Math.cos(offset), center[1] + crown * Math.sin(offset)],
      [center[0] + crown * Math.cos(end), center[1] + crown * Math.sin(end)],
      [center[0] + (crown - 0.51) * Math.cos(end), center[1] + (crown - 0.51) * Math.sin(end)],
    ];
    cappedWall(out, 'brick', points, crestBase - 0.045, height, toastedBrick, coping);
    if (lod > 1) {
      const F = facade(
        [center[0] + crown * Math.cos(angle), center[1] + crown * Math.sin(angle)],
        [Math.sin(angle), -Math.cos(angle)],
      );
      fbox(
        out,
        'coping',
        F,
        -radius * 0.085,
        radius * 0.085,
        crestBase - 1.04,
        crestBase - 0.46,
        -0.43,
        -0.06,
        darkBrick,
      );
    }
  }
  if (lod === 0) return;
  for (const angle of windowAzimuths) {
    const sn = Math.sin(angle);
    const cs = Math.cos(angle);
    for (const [y, w, h] of large
      ? [
          [4.15, 1.01, 2.05],
          [9.0, 0.91, 1.72],
          [14.65, 1, 2.31],
          [20.6, 0.97, 2.15],
          [27.9, 0.74, 0.92],
        ]
      : [
          [2.87, 0.91, 1.9],
          [7.18, 0.95, 2.03],
        ]) {
      const r = radius + ((shaft - radius) * (y + 3.05)) / (height - 0.7);
      const F = facade([center[0] + (r + 0.025) * cs, center[1] + (r + 0.025) * sn], [sn, -cs]);
      window(out, F, 0, y, w, h, lod, large);
    }
  }
}

function build(out, lod) {
  wings(out, lod);
  turret(out, greatTower, lod);
  for (const item of turrets) turret(out, item, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'raudone-castle-model.mjs';
const camera = [-95, 38, 92];
const lookAt = [0, 11, 6];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'castle',
  surfaces: style,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Raudonė Castle’s three connected brick ranges, west-open court and six round towers, including the tall south observation tower.',
  camera,
  lookAt,
  sunDirection: [-27, 48, 57],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Native building footprint leaves the west-facing courtyard open.',
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(style).flatMap(({ graph }) => graph ?? []))],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-tower-and-crenellations', position: [3, 12, 91], lookAt: [1, 14.8, 31] },
    { name: 'west-courtyard-and-entrance', position: [-66, 13, 3], lookAt: [4, 8.6, -1] },
    { name: 'six-round-towers-and-three-wings', position: [67, 66, -91], lookAt },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'raudone-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.22,
    surfaces: style,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.55, surfaces: style },
      street: { export: 'street', errorMeters: 0.2, surfaces: style },
      closeup: { export: 'closeup', errorMeters: 0.085, surfaces: style },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

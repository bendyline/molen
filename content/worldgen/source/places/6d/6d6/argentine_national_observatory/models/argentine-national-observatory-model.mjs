import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const geometry = read('native-map/cordoba-original-observatory-geometry');
const [halfX, halfZ] = geometry.centralBlockHalfSize;
const { centralHeightM } = plan.dimensions;
const eave = centralHeightM + 0.65;

const plaster = rgb('c3bca5');
const plasterShade = rgb('b7b09b');
const sill = rgb('b1ab95');
const foundation = rgb('8f8776');
const darkGreen = rgb('4e5141');
const glazing = rgb('424848');
const drumSheet = rgb('626867');
const roofSheet = rgb('777b76');
const band = rgb('a39e8b');
const iron = rgb('383e39');

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.91 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.83 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84, metallic: 0.18 },
  fittings: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.37 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.45 },
};

const directions = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function hip(out, x, z, low, high, rx, rz) {
  const ridgeLeft = [-rx, high, 0];
  const ridgeRight = [rx, high, 0];
  const ridgeRear = [0, high, -rz];
  const ridgeFront = [0, high, rz];
  const frontWest = [-x, low, z];
  const frontEast = [x, low, z];
  const rearWest = [-x, low, -z];
  const rearEast = [x, low, -z];
  if (rx > 0) {
    quad4(out, 'roof', frontWest, frontEast, ridgeRight, ridgeLeft, roofSheet);
    quad4(out, 'roof', rearEast, rearWest, ridgeLeft, ridgeRight, roofSheet);
    tri(out, 'roof', rearWest, frontWest, ridgeLeft, drumSheet);
    tri(out, 'roof', frontEast, rearEast, ridgeRight, drumSheet);
  } else {
    quad4(out, 'roof', rearWest, frontWest, ridgeFront, ridgeRear, drumSheet);
    quad4(out, 'roof', frontEast, rearEast, ridgeRear, ridgeFront, drumSheet);
    tri(out, 'roof', frontWest, frontEast, ridgeFront, roofSheet);
    tri(out, 'roof', rearEast, rearWest, ridgeRear, roofSheet);
  }
}

function narrowWindow(out, f, offset, low, level, d = 0) {
  opening(out, f, offset, low, 0.76, 1.49, {
    d: d + 0.014,
    frameWidth: level > 0 ? 0.09 : 0,
    frameDepth: d + 0.079,
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: glazing,
    frame: sill,
    sill: level > 0,
    mullions: level > 1 ? 1 : 0,
    transoms: level > 2 ? 1 : 0,
    mullionColor: darkGreen,
  });
  if (level < 2) return;
  for (const side of [-1, 1]) {
    const at = offset + side * 0.56;
    fbox(
      out,
      'wood',
      f,
      at - 0.135,
      at + 0.135,
      low + 0.045,
      low + 1.45,
      d + 0.009,
      d + 0.07,
      darkGreen,
    );
    if (level === 3)
      for (const rise of [0.18, 0.43, 0.72, 0.99, 1.23])
        fbox(
          out,
          'wood',
          f,
          at - 0.095,
          at + 0.095,
          low + rise,
          low + rise + 0.022,
          d + 0.071,
          d + 0.092,
          iron,
        );
  }
}

function doorway(out, f, base, width, height, level) {
  fbox(out, 'wood', f, -width / 2, width / 2, base, base + height, -0.028, 0.06, darkGreen);
  if (level === 0) return;
  for (const x of [-width / 2, width / 2])
    fbox(
      out,
      'trim',
      f,
      x - 0.07,
      x + 0.07,
      base - 0.025,
      base + height + 0.14,
      -0.037,
      0.09,
      sill,
    );
  fbox(
    out,
    'trim',
    f,
    -width / 2 - 0.07,
    width / 2 + 0.07,
    base + height + 0.02,
    base + height + 0.14,
    0,
    0.106,
    sill,
  );
  if (level > 1) {
    fbox(out, 'wood', f, -0.038, 0.038, base + 0.045, base + height - 0.025, 0.061, 0.11, iron);
    if (level === 3)
      for (const x of [-width * 0.2, width * 0.2])
        fbox(out, 'fittings', f, x - 0.033, x + 0.033, base + 1.0, base + 1.1, 0.064, 0.13, band);
  }
}

function mainBlock(out, level) {
  abox(
    out,
    'footing',
    [-halfX - 0.04, -0.95, -halfZ - 0.04],
    [halfX + 0.04, 0.96, halfZ + 0.04],
    foundation,
  );
  abox(out, 'plaster', [-halfX, 0.73, -halfZ], [halfX, eave, halfZ], plaster);
  abox(
    out,
    'trim',
    [-halfX - 0.18, eave - 0.14, -halfZ - 0.18],
    [halfX + 0.18, eave + 0.01, halfZ + 0.18],
    plasterShade,
  );
  hip(out, halfX + 0.24, halfZ + 0.24, eave, 5.66, 0.66, 0);
  for (const [index, [dx, dz]] of directions.entries()) {
    const at = index % 2 ? halfZ : halfX;
    const wall = facade([dx * at, dz * at], [dz, -dx]);
    for (const x of [-5.17, -3.02, 3.02, 5.17]) narrowWindow(out, wall, x, 1.88, level);
    if (level > 1) fbox(out, 'trim', wall, -at, at, 1.03, 1.13, 0, 0.11, sill);
  }
  lathe(
    out,
    'trim',
    [0, 0],
    [
      [5.55, 0.73, 0.73],
      [5.98, 0.73, 0.73],
    ],
    6,
    plasterShade,
  );
  lathe(
    out,
    'glass',
    [0, 0],
    [
      [5.93, 0.66, 0.66],
      [6.36, 0.09, 0.09],
    ],
    6,
    glazing,
  );
  if (level > 0) {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const f = facade([Math.cos(a) * 0.64, Math.sin(a) * 0.64], [Math.sin(a), -Math.cos(a)]);
      fbox(out, 'fittings', f, -0.036, 0.036, 5.95, 6.14, -0.25, 0.065, roofSheet);
    }
  }
}

function connector(out, spec, dx, dz, level) {
  const far = spec.center - spec.radius + 0.86;
  const near = dx !== 0 ? halfX - 0.05 : halfZ - 0.05;
  const at = [dx * near, dz * near];
  const end = [dx * far, dz * far];
  const low = [
    dx ? Math.min(at[0], end[0]) : -spec.neckHalfWidth,
    -0.84,
    dz ? Math.min(at[1], end[1]) : -spec.neckHalfWidth,
  ];
  const high = [
    dx ? Math.max(at[0], end[0]) : spec.neckHalfWidth,
    spec.radius > 2 ? 3.61 : 3.81,
    dz ? Math.max(at[1], end[1]) : spec.neckHalfWidth,
  ];
  abox(out, 'plaster', low, high, plasterShade);
  gableRoof(
    out,
    'roof',
    at,
    end,
    2 * spec.neckHalfWidth,
    high[1] + 0.012,
    high[1] + 0.51,
    roofSheet,
    { overhang: 0.13, endSlot: 'plaster', endColor: plasterShade },
  );
  if (level > 0 && spec.radius > 2) {
    for (const sign of [-1, 1]) {
      const center = (at[0] + end[0]) / 2;
      const wall = facade([center, sign * spec.neckHalfWidth], [sign, 0]);
      narrowWindow(out, wall, -1.25, 1.65, level);
      if (level > 2) narrowWindow(out, wall, 1.2, 1.65, level);
    }
    const center = (at[0] + end[0]) / 2;
    abox(
      out,
      'fittings',
      [center - 0.04, high[1] + 0.466, -0.42],
      [center + 0.04, high[1] + 0.537, 0.42],
      iron,
    );
  }
}

function cupola(out, spec, dx, dz, level) {
  const r = spec.radius;
  const pos = [dx * spec.center, dz * spec.center];
  const top = spec.height + 0.65;
  const lower = top - (r > 2 ? 2.96 : 2.56);
  const shoulder = top - (r > 2 ? 0.76 : 0.61);
  const sides = [9, 18, 24, 36][level];
  const rotation = Math.PI / sides;
  lathe(
    out,
    'plaster',
    pos,
    [
      [-0.83, r, r],
      [lower, r, r],
    ],
    sides,
    plaster,
    { rotation, capTop: false },
  );
  lathe(
    out,
    'footing',
    pos,
    [
      [-0.8, r + 0.015, r + 0.015],
      [0.86, r + 0.015, r + 0.015],
    ],
    sides,
    foundation,
    { rotation, capTop: false },
  );
  const lip = r + 0.105;
  lathe(
    out,
    'trim',
    pos,
    [
      [lower - 0.1, lip, lip],
      [lower + 0.18, lip, lip],
    ],
    sides,
    plasterShade,
    { rotation },
  );
  lathe(
    out,
    'roof',
    pos,
    [
      [lower + 0.16, r - 0.12, r - 0.12],
      [shoulder, r - 0.12, r - 0.12],
    ],
    sides,
    drumSheet,
    { rotation, capTop: false },
  );
  lathe(
    out,
    'roof',
    pos,
    [
      [shoulder - 0.035, lip, lip],
      [shoulder + 0.035, lip, lip],
      [top - 0.07, 0.18, 0.18],
      [top, 0.12, 0.12],
    ],
    sides,
    roofSheet,
    { rotation },
  );
  const [tx, tz] = [dz, -dx];
  const f = facade([pos[0] + dx * r, pos[1] + dz * r], [tx, tz]);
  const base = spec.direction === 'east' ? 1.45 : spec.direction === 'south' ? 1.27 : 0.77;
  doorway(out, f, base, r > 2 ? 1.03 : 1.08, r > 2 && dx < 0 ? 1.61 : 1.94, level);
  const treads = r > 2 && level > 1 ? 5 : r > 2 ? 2 : 1;
  const run = spec.stepsM;
  for (let i = 0; i < treads; i++)
    fbox(
      out,
      'footing',
      f,
      -0.66,
      0.66,
      -0.1,
      base - 0.12 - (i * base * 0.79) / treads,
      -0.31,
      (run * (i + 1)) / treads,
      sill,
    );
  if (level > 0) {
    const cupolaF = facade([pos[0] + dx * (r - 0.1), pos[1] + dz * (r - 0.1)], [tx, tz]);
    for (const sign of [-1, 1])
      fbox(
        out,
        'fittings',
        cupolaF,
        sign * 0.35 - 0.023,
        sign * 0.35 + 0.023,
        lower + 0.24,
        shoulder - 0.03,
        -0.067,
        0.031,
        iron,
      );
    fbox(out, 'fittings', cupolaF, -0.36, 0.36, lower + 0.23, lower + 0.287, -0.042, 0.021, iron);
    abox(
      out,
      'fittings',
      [pos[0] - 0.025, top - 0.06, pos[1] - 0.025],
      [pos[0] + 0.025, top + 0.26, pos[1] + 0.025],
      iron,
    );
  }
  if (level > 1) {
    for (let i = 0; i < sides; i += level === 3 ? 3 : 6) {
      const a = rotation + (2 * Math.PI * i) / sides;
      const f = facade(
        [pos[0] + Math.cos(a) * (r - 0.114), pos[1] + Math.sin(a) * (r - 0.114)],
        [Math.sin(a), -Math.cos(a)],
      );
      fbox(out, 'roof', f, -0.018, 0.018, lower + 0.2, shoulder - 0.02, -0.02, 0.021, band);
    }
  }
}

function northBalcony(out, level) {
  const z = geometry.arms[1].center + geometry.arms[1].radius - 0.16;
  abox(out, 'trim', [-1.1, 3.01, z - 0.43], [1.1, 3.18, z + 0.65], plasterShade);
  for (const x of [-0.87, 0.87])
    lathe(
      out,
      'trim',
      [x, z + 0.47],
      [
        [0.64, 0.17, 0.17],
        [0.84, 0.17, 0.17],
        [2.93, 0.115, 0.115],
        [3.04, 0.17, 0.17],
      ],
      level > 1 ? 10 : 6,
      plasterShade,
    );
  if (level === 0) return;
  const f = facade([0, z + 0.63], [1, 0]);
  fbox(out, 'fittings', f, -1.03, 1.03, 3.79, 3.845, -0.08, 0.025, iron);
  for (const x of level > 1
    ? [-0.97, -0.72, -0.48, -0.24, 0, 0.24, 0.48, 0.72, 0.97]
    : [-0.97, 0, 0.97])
    fbox(out, 'fittings', f, x - 0.022, x + 0.022, 3.17, 3.8, -0.073, -0.018, iron);
  if (level > 1) {
    for (const x of [-1.035, 1.035])
      abox(out, 'fittings', [x - 0.027, 3.79, z + 0.03], [x + 0.027, 3.844, z + 0.64], iron);
  }
}

function build(out, level) {
  mainBlock(out, level);
  for (const [i, [dx, dz]] of directions.entries()) {
    connector(out, geometry.arms[i], dx, dz, level);
    cupola(out, geometry.arms[i], dx, dz, level);
  }
  northBalcony(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'argentine-national-observatory-model.mjs';
const camera = [-34, 16, 38];
const lookAt = [0, 2.4, 0];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'observatory',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    representedDate: '1898-12-31',
    validFrom: '1873-01-01',
    validUntil: '1902-10-01',
  },
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The early four-tower Córdoba observatory, with twin long observing wings, dark metal cupolas and a narrow entrance balcony.',
  camera,
  lookAt,
  sunDirection: [-42, 60, 62],
  mediumFiContext: {
    scale: 0.75,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: geometry.replacementBuildingOutline,
    minimumCoverage: 0.94,
    basis: 'Suppress the mapped 1930 successor while this earlier appearance is active.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'north-front-east-elevation', position: camera, lookAt },
    { name: 'entrance-balcony-and-cupolas', position: [-12, 6, 29], lookAt: [0, 2.75, 8] },
    { name: 'cross-plan-and-roof-mechanisms', position: [36, 34, -29], lookAt: [0, 2.7, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'argentine-national-observatory-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.85,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.39, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.052, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model informed by the public-domain 1898 Caras y Caretas photograph, published historical measurements, native site mapping and open elevation data.',
};

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  pointedArch,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const { default: earcut } = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut');
const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const mapped = frame.geometry.outline;
const nave = outwardRing(mapped.slice(0, 16));
const annex = outwardRing(mapped.slice(16));
const naveLength = (mapped[0][0] + mapped[15][0]) / 2;
const naveCenter = (mapped[0][1] + mapped[15][1]) / 2;
const halfWidth = (mapped[0][1] - mapped[15][1]) / 2;
const westX = (mapped[1][0] + mapped[14][0]) / 2;
const {
  naveEavesM: eaves,
  naveRoofRiseM: roofRise,
  westLancetHeightM,
  towerCrownM,
  towerPinnacleM,
} = plan.dimensions;

const wall = rgb('d6c5a6');
const towerWall = rgb('ccbd9d');
const base = rgb('b7a68b');
const molding = rgb('dfd2ba');
const shadowMolding = rgb('ac9c83');
const roof = rgb('9d5549');
const metal = rgb('524e46');
const glass = rgb('374b54');
const nearBlack = rgb('283336');
const wood = rgb('554137');
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.95 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  base: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.9 },
  panel: { slot: 'door', graph: 'wood_plain', roughness: 0.88 },
  opening: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.85 },
};

function wallBand(out, f, y, height, depth, color = molding) {
  fbox(out, 'stone', f, 0, f.length, y, y + height, -0.04, depth, color);
}

function lancet(out, f, u, y, width, height, level, detail = {}) {
  const pointed = !detail.door;
  const rise = detail.rise ?? width * (pointed ? 0.7 : 0.29);
  const tone = detail.tone ?? glass;
  opening(out, f, u, y, width, height, {
    head: pointed ? 'pointed' : 'tudor',
    rise,
    frameSlot: 'stone',
    glassSlot: detail.door ? 'panel' : 'opening',
    frame: shadowMolding,
    glass: tone,
    d: 0.028,
    frameWidth: level ? 0.12 : 0,
    frameDepth: 0.17,
    sill: level > 0 && !detail.door,
    mullions: level > 1 && !detail.door ? 1 : 0,
    transoms: level > 1 && !detail.door ? 1 : 0,
    mullionColor: molding,
  });
  if (level > 1) {
    const half = width / 2 + 0.23;
    const spring = y + height - rise;
    const path = pointedArch(half, rise + 0.15, 5);
    for (let i = 1; i < path.length; i++) {
      const [a, b] = path[i - 1];
      const [c, d] = path[i];
      beam(
        out,
        'stone',
        f.P(u + a, spring + b, 0.18),
        f.P(u + c, spring + d, 0.18),
        0.14,
        0.14,
        molding,
      );
    }
    if (detail.crockets && level === 3)
      for (const [du, dy] of path.filter((_, index) => index % 2 === 0)) {
        const v = u + du;
        fbox(
          out,
          'stone',
          f,
          v - 0.095,
          v + 0.095,
          spring + dy + 0.11,
          spring + dy + 0.29,
          0.1,
          0.25,
          molding,
        );
      }
  }
  if (detail.door && level > 0) {
    fbox(out, 'panel', f, u - 0.024, u + 0.024, y + 0.03, y + height - 0.19, 0.029, 0.067, metal);
    for (const v of [-0.28, 0.28])
      fbox(out, 'panel', f, u + v - 0.04, u + v + 0.04, y + 0.81, y + 1.02, 0.035, 0.1, metal);
  }
  if (!detail.door && level === 3 && height > 4) {
    const spring = y + height - rise;
    const half = width * 0.24;
    for (const center of [u - half, u + half]) {
      const trace = pointedArch(half, rise * 0.55, 4);
      for (let i = 1; i < trace.length; i++) {
        const [a, b] = trace[i - 1];
        const [c, d] = trace[i];
        beam(
          out,
          'stone',
          f.P(center + a, spring + b, 0.13),
          f.P(center + c, spring + d, 0.13),
          0.055,
          0.065,
          molding,
        );
      }
    }
  }
}

function buttress(out, f, u, width, length, height, level) {
  const a = u - width / 2;
  const b = u + width / 2;
  fbox(out, 'wall', f, a, b, -0.14, height, -0.09, length * 0.38, wall);
  for (const [lo, hi, depth] of [
    [0, height * 0.31, 1],
    [height * 0.31, height * 0.69, 0.73],
  ]) {
    fbox(out, 'wall', f, a + 0.06, b - 0.06, lo, hi, -0.08, length * depth, wall);
    if (level > 1)
      fbox(
        out,
        'stone',
        f,
        a + 0.015,
        b - 0.015,
        hi - 0.15,
        hi + 0.025,
        -0.08,
        length * depth + 0.065,
        molding,
      );
  }
}

function annexeRoof(out, polygon, eave) {
  const cap = earcut(polygon.flat());
  for (let i = 0; i < cap.length; i += 3) {
    const points = cap.slice(i, i + 3).map((index) => {
      const [x, z] = polygon[index];
      return [x, eave, z];
    });
    const [a, b, c] = points;
    const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    tri(out, 'roof', a, ...(up > 0 ? [b, c] : [c, b]), roof);
  }
}

function body(out, level) {
  extrude(out, 'wall', nave, 0.17, eaves, wall, { top: false });
  extrude(out, 'base', nave, -0.48, 0.17, base, { top: false });
  extrude(out, 'wall', annex, -0.44, 5.65, wall, { top: false });
  annexeRoof(out, annex, 5.65);
  gableRoof(
    out,
    'roof',
    [westX, naveCenter],
    [naveLength, naveCenter],
    halfWidth * 2,
    eaves,
    eaves + roofRise,
    roof,
    { overhang: 0.39, endSlot: 'wall', endColor: wall },
  );
  // The east side of the roof follows the slightly skewed survey end line.
  const end = facade([naveLength + 0.23, naveCenter + halfWidth], [0, -1]);
  fbox(out, 'stone', end, 0, halfWidth * 2, eaves - 0.38, eaves - 0.19, 0, 0.086, molding);
  for (let i = 0; i < nave.length; i++) {
    const f = wallFace(nave[i], nave[(i + 1) % nave.length]);
    if (f.length > 21 && Math.abs(f.normal[1]) > 0.99) {
      wallBand(out, f, eaves - 0.34, 0.2, 0.07);
      for (let bay = 0; bay < 5; bay++) {
        const u = 2.22 + bay * 4.67;
        lancet(out, f, u, 1.7, 1.92, 7.0, level);
        if (bay < 4 && level > 0) buttress(out, f, u + 2.3, 0.51, 0.61, 8.81, level);
      }
    } else if (f.normal[0] < -0.88 && f.length >= 3.5) {
      lancet(out, f, f.length * 0.5, 0.91, 1.68, westLancetHeightM, level, { crockets: true });
    }
  }
  if (level > 1)
    for (let i = 0; i < annex.length; i++) {
      const f = wallFace(annex[i], annex[(i + 1) % annex.length]);
      if (f.length < 3.5 || f.normal[0] < -0.9) continue;
      for (const u of [0.28, 0.73])
        opening(out, f, f.length * u, 1.85, 0.79, 1.75, {
          frameSlot: 'stone',
          glassSlot: 'opening',
          frame: molding,
          glass,
          frameWidth: 0.11,
          frameDepth: 0.095,
          mullions: level > 1 ? 1 : 0,
        });
    }
}

function square(x, z, halfX, halfZ) {
  return [
    [x - halfX, z - halfZ],
    [x - halfX, z + halfZ],
    [x + halfX, z + halfZ],
    [x + halfX, z - halfZ],
  ];
}

function mouldedStage(out, ring, y0, y1, level) {
  extrude(out, 'wall', ring, y0, y1, towerWall, { top: false });
  const faces = ring.map((p, i) => wallFace(p, ring[(i + 1) % ring.length]));
  for (const f of faces) {
    wallBand(out, f, y1 - 0.35, 0.34, 0.16);
    if (level > 1) wallBand(out, f, y1 - 0.52, 0.11, 0.073, shadowMolding);
  }
  return faces;
}

function pinnacle(out, x, z, level) {
  const h = towerCrownM + 0.58;
  abox(out, 'stone', [x - 0.35, h - 0.62, z - 0.35], [x + 0.35, h + 0.36, z + 0.35], molding);
  abox(
    out,
    'stone',
    [x - 0.22, h + 0.36, z - 0.22],
    [x + 0.22, towerPinnacleM - 0.37, z + 0.22],
    towerWall,
  );
  const ring = square(x, z, 0.225, 0.225);
  for (let i = 0; i < ring.length; i++)
    tri(
      out,
      'stone',
      [ring[i][0], towerPinnacleM - 0.37, ring[i][1]],
      [ring[(i + 1) % ring.length][0], towerPinnacleM - 0.37, ring[(i + 1) % ring.length][1]],
      [x, towerPinnacleM, z],
      molding,
    );
  if (level === 3)
    abox(
      out,
      'stone',
      [x - 0.075, towerPinnacleM - 0.07, z - 0.075],
      [x + 0.075, towerPinnacleM + 0.17, z + 0.075],
      molding,
    );
}

function tower(out, level) {
  const z = -0.83;
  const x = -8.09;
  const lower = mouldedStage(out, square(x, z, 3.7, 3.63), -0.45, 13.7, level);
  const mid = mouldedStage(out, square(x + 0.09, z, 3.32, 3.34), 13.67, 17.51, level);
  const upperRing = square(x + 0.13, z, 2.99, 3.06);
  const upper = mouldedStage(out, upperRing, 17.49, towerCrownM, level);
  const front = lower[0];
  const u = front.length / 2;
  const stairs = facade([front.origin[0], z], [0, 1]);
  for (const [depth, wide, h] of [
    [1.8, 1.65, 0.14],
    [1.35, 1.53, 0.29],
    [0.89, 1.41, 0.43],
  ])
    fbox(out, 'base', stairs, -wide, wide, -0.31, h, -0.03, depth, base);
  lancet(out, front, u, 0.43, 1.87, 3.23, level, { door: true, tone: wood });
  lancet(out, front, u, 4.37, 2.51, 7.95, level, { crockets: true });
  wallBand(out, front, 3.7, 0.16, 0.13);
  wallBand(out, front, 6.6, 0.19, 0.15);

  for (const f of level ? lower : [front]) {
    for (const end of [0.44, f.length - 0.44]) buttress(out, f, end, 0.86, 0.78, 13.55, level);
  }
  for (const f of level ? mid : [mid[0]]) {
    for (const fraction of [0.36, 0.64])
      lancet(out, f, f.length * fraction, 14.56, 0.97, 1.7, level, { rise: 0.35, tone: glass });
  }
  for (const f of upper) {
    const m = f.length / 2;
    lancet(out, f, m, 18.2, 2.42, 5.23, level, { crockets: true, tone: nearBlack });
    if (level > 1) {
      for (let j = 0; j < 11; j++) {
        const y = 18.47 + j * 0.29;
        fbox(out, 'opening', f, m - 1.06, m + 1.06, y, y + 0.063, 0.046, 0.075, metal);
      }
    }
    wallBand(out, f, towerCrownM - 0.78, 0.21, 0.18, shadowMolding);
    wallBand(out, f, towerCrownM - 0.21, 0.44, 0.15);
    for (const fraction of [0.23, 0.41, 0.59, 0.77]) {
      const pos = f.length * fraction;
      fbox(
        out,
        'stone',
        f,
        pos - 0.31,
        pos + 0.31,
        towerCrownM + 0.19,
        towerCrownM + 0.65,
        -0.27,
        0.12,
        molding,
      );
    }
  }
  abox(
    out,
    'roof',
    [x - 2.77, towerCrownM - 0.28, z - 2.88],
    [x + 3.03, towerCrownM - 0.064, z + 2.88],
    roof,
  );
  for (const [px, pz] of upperRing) pinnacle(out, px, pz, level);
}

function build(out, level) {
  body(out, level);
  tower(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'unitarian-church-in-charleston-model.mjs';
const camera = [-37, 17, 32];
const lookAt = [-2, 10, -0.7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Unitarian Church in Charleston',
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
    'Charleston’s Unitarian Church, with a crenellated four-storey Gothic Revival tower, tall hooded lancets, a Tudor entrance, cream masonry and red nave roof.',
  camera,
  lookAt,
  sunDirection: [-51, 47, 38],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Mapped Archdale Street church, tower and attached east range.',
  },
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone',
    'stone_sandstone',
    'tile_ceramic',
    'wood_plain',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'archdale-street-tudor-entrance',
      position: [-41, 7.4, 1.2],
      lookAt: [-10, 11.8, -0.83],
    },
    { name: 'nave-lancets-and-step-buttresses', position: [-21, 9, -38], lookAt: [-1, 8, -1] },
    { name: 'tower-pinnacles-and-east-ranges', position: [32, 26, 30], lookAt: [1, 11, -0.3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'charleston-unitarian-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.64,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.29, surfaces },
      street: { export: 'street', errorMeters: 0.11, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

import { readFileSync } from 'node:fs';
import {
  abox,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/cascade-brewery-shape-controls');
const [left, z] = shape.eastFront[0];
const [right] = shape.eastFront[1];
const back = shape.mainBrewery[1][1];
const [northEnd] = shape.malthouse[3];
const {
  oldStoneShoulderM: shoulder,
  middleCrownM: middle,
  upperCorniceM: cornice,
  upperPedimentM: peak,
} = shape.assumedHeights;
const front = wallFace([left, z], [right, z]);
const surfaces = {
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.89 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.92 },
  metal: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.85 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.75 },
  paint: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.84 },
};
const sandstone = rgb('a89a79');
const pale = rgb('bbad8b');
const burnt = rgb('8b806b');
const render = rgb('a79b7e');
const roof = rgb('696d64');
const iron = rgb('5c655e');
const dark = rgb('444841');
const cream = rgb('dfd7be');
const soot = rgb('716658');

function block(out, slot, x0, x1, y0, y1, z0, z1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color);
}
function band(out, f, y, h, depth, color = pale, start = 0, end = f.length) {
  fbox(out, 'trim', f, start, end, y, y + h, -0.1, depth, color);
}
function fenestration(
  out,
  f,
  u,
  y,
  w,
  h,
  level,
  { arch = true, depth = 0.026, pair = false } = {},
) {
  if (level === 1) {
    quad4(
      out,
      'shade',
      f.P(u - w / 2, y, depth),
      f.P(u + w / 2, y, depth),
      f.P(u + w / 2, y + h, depth),
      f.P(u - w / 2, y + h, depth),
      dark,
    );
    return;
  }
  opening(out, f, u, y, w, h, {
    head: arch ? 'round' : 'flat',
    glassSlot: 'shade',
    frameSlot: 'trim',
    glass: dark,
    frame: pale,
    frameWidth: arch ? 0.15 : 0.127,
    frameDepth: 0.118,
    d: depth,
    mullions: pair ? 1 : 0,
    transoms: level === 3 ? 1 : 0,
    sill: true,
  });
  if (level === 3 && arch) {
    fbox(
      out,
      'trim',
      f,
      u - 0.13,
      u + 0.13,
      y + h - 0.075,
      y + h + 0.19,
      depth - 0.04,
      depth + 0.215,
      pale,
    );
  }
}
function wallDetails(out, f, y0, y1, level, frontWall = false) {
  if (f.length < 3.4) return;
  band(out, f, y1 - 0.4, 0.29, 0.255);
  if (y0 < 0) {
    band(out, f, 0.52, 0.18, 0.16, burnt);
    band(out, f, 3.82, 0.19, 0.2);
    band(out, f, 7.5, 0.19, 0.215);
  }
  if (level === 0) return;
  const levels = y0 < 0 ? [1.17, 4.65, 8.28] : y0 < 14 ? [13.82, 16.8] : [23.52];
  const n = Math.min(frontWall ? 6 : 5, Math.max(1, Math.round(f.length / 4.65)));
  for (let i = 0; i < n; i++) {
    const u = ((i + 0.5) * f.length) / n;
    for (const y of levels.filter((y) => y + (y < 12 ? 1.97 : 1.64) < y1 - 0.15))
      fenestration(out, f, u, y, Math.min(1.16, f.length * 0.26), y < 12 ? 1.97 : 1.64, level, {
        arch: y < 15,
      });
  }
  if (level >= 2) {
    for (let y = Math.max(y0 + 0.6, 1.5), i = 0; y < y1 - 0.5; y += 0.63, i++) {
      if (level === 2 && i % 2 === 1) continue;
      for (const u of [0.26, f.length - 0.26])
        band(
          out,
          f,
          y,
          0.25,
          i % 2 === 0 ? 0.245 : 0.178,
          i % 5 === 0 ? burnt : pale,
          u - (i % 2 === 0 ? 0.36 : 0.28),
          u + (i % 2 === 0 ? 0.36 : 0.28),
        );
    }
  }
}

const glyphs = {
  A: ['010', '101', '111', '101', '101'],
  B: ['110', '101', '110', '101', '110'],
  C: ['111', '100', '100', '100', '111'],
  D: ['110', '101', '101', '101', '110'],
  E: ['111', '100', '110', '100', '111'],
  R: ['110', '101', '110', '101', '101'],
  S: ['111', '100', '111', '001', '111'],
  W: ['101', '101', '111', '111', '101'],
  Y: ['101', '101', '010', '010', '010'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  4: ['101', '101', '111', '001', '001'],
  7: ['111', '001', '010', '010', '100'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};
function inscription(out, f, text, mid, y, cell) {
  const width = (text.length * 4 - 1) * cell;
  for (const [i, char] of [...text].entries()) {
    for (const [j, row] of (glyphs[char] ?? []).entries()) {
      for (let k = 0; k < row.length; k++) {
        if (row[k] !== '1') continue;
        const u = mid - width * 0.5 + (i * 4 + k) * cell,
          v = y + (4 - j) * cell;
        quad4(
          out,
          'paint',
          f.P(u, v, 0.046),
          f.P(u + cell, v, 0.046),
          f.P(u + cell, v + cell, 0.046),
          f.P(u, v + cell, 0.046),
          cream,
        );
      }
    }
  }
}
function upper(out, level) {
  const a = left + 2.85,
    b = right - 1.34,
    depth = z - 0.85;
  const f = wallFace([a, depth], [b, depth]);
  block(out, 'plaster', a, b, shoulder - 0.21, middle, back + 1.45, depth, render);
  band(out, f, middle - 1.28, 0.29, 0.32);
  band(out, f, middle - 0.24, 0.21, 0.37);
  for (const u of [0.34, f.length - 0.34])
    fbox(out, 'trim', f, u - 0.54, u + 0.54, middle - 1.46, middle + 0.43, -0.23, 0.33, pale);
  const towerA = left + 9.38,
    towerB = right - 1.91,
    towerFront = z - 2.24;
  const tower = wallFace([towerA, towerFront], [towerB, towerFront]);
  const towerBack = back + 2.38;
  block(out, 'plaster', towerA, towerB, middle - 0.13, cornice, towerBack, towerFront, render);
  block(
    out,
    'metal',
    towerA + 0.14,
    towerB - 0.14,
    cornice - 0.15,
    cornice + 0.06,
    towerBack + 0.11,
    towerFront - 0.08,
    roof,
  );
  tri(
    out,
    'plaster',
    tower.P(0, cornice - 0.09, 0.055),
    tower.P(tower.length, cornice - 0.09, 0.055),
    tower.P(tower.length * 0.51, peak, 0.055),
    render,
  );
  for (const [u0, u1] of [
    [0, tower.length * 0.51],
    [tower.length * 0.51, tower.length],
  ]) {
    const h0 = u0 === 0 ? cornice : peak,
      h1 = u1 === tower.length ? cornice : peak;
    quad4(
      out,
      'trim',
      tower.P(u0, h0 - 0.1, 0.21),
      tower.P(u1, h1 - 0.1, 0.21),
      tower.P(u1, h1 + 0.14, 0.21),
      tower.P(u0, h0 + 0.14, 0.21),
      pale,
    );
    quad4(
      out,
      'trim',
      tower.P(u0, h0 + 0.14, 0.21),
      tower.P(u1, h1 + 0.14, 0.21),
      tower.P(u1, h1 + 0.14, -0.36),
      tower.P(u0, h0 + 0.14, -0.36),
      pale,
    );
  }
  band(out, tower, cornice - 0.27, 0.26, 0.33);
  for (const u of [0.28, tower.length - 0.28]) {
    fbox(
      out,
      'plaster',
      tower,
      u - 0.46,
      u + 0.46,
      cornice - 1.1,
      cornice + 1.27,
      -0.44,
      0.35,
      render,
    );
    fbox(out, 'trim', tower, u - 0.62, u + 0.62, cornice + 1.08, cornice + 1.36, -0.57, 0.48, pale);
  }
  block(
    out,
    'plaster',
    towerA - 4.93,
    towerA + 0.03,
    middle - 0.16,
    cornice - 0.31,
    towerBack,
    towerFront - 3.9,
    soot,
  );
  block(
    out,
    'metal',
    towerA - 5.1,
    towerA + 0.09,
    cornice - 0.47,
    cornice - 0.27,
    towerBack - 0.16,
    towerFront - 3.73,
    iron,
  );
  if (level === 0) return;
  for (let i = 0; i < 4; i++)
    fenestration(out, f, ((i + 0.5) * f.length) / 4, 14.06, 1.47, 2.04, level, { arch: true });
  for (let i = 0; i < 3; i++) {
    const u = ((i + 0.5) * tower.length) / 3;
    fenestration(out, tower, u, 23.52, 2.62, 2.31, level, { arch: false, pair: true });
    if (level >= 2) band(out, tower, 25.98, 0.13, 0.24, pale, u - 1.47, u + 1.47);
  }
  if (level >= 2) {
    inscription(out, tower, 'CASCADE BREWERY', tower.length * 0.5, 21.32, 0.244);
    inscription(out, f, '1824  1927', f.length * 0.52, 12.61, 0.167);
    opening(out, tower, tower.length * 0.51, cornice + 0.39, 1.0, 0.94, {
      head: 'round',
      glassSlot: 'shade',
      frameSlot: 'trim',
      glass: dark,
      frame: pale,
      sill: false,
      d: 0.112,
      frameDepth: 0.07,
      frameWidth: 0.11,
    });
  }
}

function olderRanges(out, level) {
  const a = right,
    b = shape.malthouse[0][0],
    far = z - 0.25,
    rear = shape.malthouse[1][1];
  block(out, 'ashlar', a, b, -2.8, 6.76, rear, far, sandstone);
  quad4(
    out,
    'metal',
    [a - 0.2, 6.72, far + 0.24],
    [b + 0.2, 6.72, far + 0.24],
    [b + 0.2, 8.04, rear - 0.24],
    [a - 0.2, 8.04, rear - 0.24],
    iron,
  );
  block(out, 'ashlar', b, northEnd, -2.55, 9.35, rear, far, sandstone);
  const middleX = (b + northEnd) * 0.5;
  gableRoof(out, 'metal', [middleX, far], [middleX, rear], northEnd - b, 9.35, 12.9, roof, {
    overhang: 0.29,
    endSlot: 'ashlar',
    endColor: sandstone,
  });
  wallDetails(out, wallFace([b, far], [northEnd, far]), -2.55, 9.35, level);
  wallDetails(out, wallFace([northEnd, rear], [b, rear]), -2.55, 9.35, level);
  const connector = wallFace([a, far], [b, far]);
  band(out, connector, 6.43, 0.21, 0.24);
  if (level >= 1) {
    for (const u of [connector.length * 0.28, connector.length * 0.72])
      fenestration(out, connector, u, 2.22, 1.36, 1.87, level);
  }
}

function build(out, level) {
  block(out, 'ashlar', left, right, -3.0, shoulder, back, z, sandstone);
  block(
    out,
    'metal',
    left + 0.09,
    right - 0.09,
    shoulder - 0.13,
    shoulder - 0.045,
    back + 0.09,
    z - 0.09,
    roof,
  );
  wallDetails(out, front, -3, shoulder, level, true);
  wallDetails(out, wallFace([right, z], [right, back]), -3, shoulder, level);
  wallDetails(out, wallFace([left, back], [left, z]), -3, shoulder, level);
  wallDetails(out, wallFace([right, back], [left, back]), -3, shoulder, level);
  upper(out, level);
  olderRanges(out, level);
  block(
    out,
    'brick',
    left + 1.52,
    left + 3.63,
    shoulder - 0.22,
    18.24,
    back + 4.2,
    back + 6.31,
    soot,
  );
  block(out, 'trim', left + 1.31, left + 3.84, 17.99, 18.36, back + 3.99, back + 6.52, pale);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'cascade-brewery-model.mjs';
const camera = [47, 37, 87],
  lookAt = [8, 11, 1];
const outlines = [shape.mainBrewery, shape.refrigerationConnector, shape.malthouse];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-industrial',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The historic South Hobart brewery with original sandstone lower walls, 1927 stepped upper floors, the painted façade lettering, and attached malthouse.',
  camera,
  lookAt,
  sunDirection: [-22, 42, 62],
  mediumFiContext: {
    scale: 1.06,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outlines[0],
    outlines,
    minimumCoverage: 0.77,
    basis: 'Reserve the modeled historic east ranges at Cascade Road.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'cascade-road-stepped-facade', position: [-12, 13, 48], lookAt: [3, 13, 10] },
    { name: 'brewing-tower-lettering-and-pediment', position: [15, 25, 38], lookAt: [6, 23, 10] },
    { name: 'malthouse-and-refrigeration-range', position: [49, 18, 36], lookAt: [26, 6, 5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'cascade-brewery-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.62,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.55, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
};

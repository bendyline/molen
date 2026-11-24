import fs from 'node:fs';
import {
  abox,
  extrude,
  fbox,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const outline = frame.geometry.outline;
const measure = plan.dimensions;
const colors = {
  ochre: rgb('c99440'),
  lime: rgb('d0a052'),
  roof: rgb('754136'),
  flashing: rgb('655747'),
  stone: rgb('5e5649'),
  sash: rgb('b3a284'),
  sage: rgb('809080'),
  glass: rgb('454637'),
  door: rgb('414d40'),
  sign: rgb('e2c88c'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  plinth: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.87 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.85 },
};

function panel(out, slot, face, left, right, bottom, top, depth, color) {
  quad4(
    out,
    slot,
    face.P(left, bottom, depth),
    face.P(right, bottom, depth),
    face.P(right, top, depth),
    face.P(left, top, depth),
    color,
  );
}

function sash(out, face, u, level, broad = false) {
  const w = broad ? 0.65 : 0.52;
  const left = u - w;
  const right = u + w;
  const bottom = 1.02;
  const top = 2.14;
  fbox(
    out,
    'trim',
    face,
    left - 0.066,
    right + 0.066,
    bottom - 0.056,
    top + 0.057,
    0.006,
    0.087,
    colors.sash,
  );
  panel(out, 'detail', face, left, right, bottom, top, 0.092, colors.glass);
  const bar = (a, b, y, h, tone) => panel(out, 'trim', face, a, b, y, h, 0.107, tone);
  bar(u - 0.031, u + 0.031, bottom, top, colors.sage);
  if (level > 0) {
    for (const x of [u - w / 2, u + w / 2]) {
      bar(x - 0.014, x + 0.014, bottom, top, colors.sash);
    }
    for (const y of [1.25, 1.474, 1.698, 1.922]) {
      bar(left, right, y - 0.014, y + 0.014, colors.sash);
    }
  }
  if (level > 1) {
    fbox(
      out,
      'plinth',
      face,
      left - 0.075,
      right + 0.075,
      bottom - 0.061,
      bottom - 0.022,
      0.02,
      0.116,
      colors.stone,
    );
  }
}

function door(out, face, u, level) {
  fbox(out, 'trim', face, u - 0.415, u + 0.415, 0.08, 2.15, 0.004, 0.061, colors.sash);
  panel(out, 'trim', face, u - 0.37, u + 0.37, 0.096, 2.105, 0.067, colors.door);
  if (level > 0) {
    for (const y of [0.31, 0.9, 1.48]) {
      panel(out, 'detail', face, u - 0.277, u + 0.277, y, y + 0.035, 0.08, colors.sage);
    }
    panel(out, 'detail', face, u - 0.247, u - 0.176, 0.95, 0.995, 0.081, colors.sign);
  }
}

function roof(out, level) {
  const eave = measure.roofLightWingEaveM;
  const edge = outline.map(([x, z]) => [x * 1.034, eave + 0.028, z * 1.028]);
  const left = [-5.57, 3.73, -1.76];
  const join = [-0.53, 4.08, -2.02];
  const side = [2.94, 4.23, 5.96];
  const peak = [1.45, measure.mainRidgeM, -2.39];
  const crest = [left, left, left, join, side, side, side, peak, peak, join];
  for (let i = 0; i < edge.length; i++) {
    const j = (i + 1) % edge.length;
    const [a, b] = [edge[i], edge[j]];
    tri(out, 'roof', a, b, crest[j], colors.roof);
    if (crest[j] !== crest[i]) tri(out, 'roof', a, crest[j], crest[i], colors.roof);
    if (level > 0) {
      quad4(
        out,
        'detail',
        [a[0], eave - 0.106, a[2]],
        [b[0], eave - 0.106, b[2]],
        b,
        a,
        colors.flashing,
      );
    }
  }
  tri(out, 'roof', join, side, peak, colors.roof);

  const chimney = frame.features[2].points;
  const x = chimney.map((p) => p[0]);
  const z = chimney.map((p) => p[1]);
  const low = [Math.min(...x), 3.62, Math.min(...z)];
  const high = [Math.max(...x), measure.chimneyTopM - 0.26, Math.max(...z)];
  abox(out, 'wall', low, high, colors.ochre);
  abox(
    out,
    'wall',
    [low[0] - 0.095, high[1], low[2] - 0.095],
    [high[0] + 0.095, measure.chimneyTopM, high[2] + 0.095],
    colors.lime,
  );
  if (level > 2) {
    abox(
      out,
      'detail',
      [low[0] + 0.12, measure.chimneyTopM + 0.001, low[2] + 0.12],
      [high[0] - 0.12, measure.chimneyTopM + 0.017, high[2] - 0.12],
      colors.stone,
    );
  }
}

function build(out, level) {
  const eave = measure.roofLightWingEaveM;
  extrude(out, 'wall', outline, -0.33, eave, colors.ochre, { top: false });
  for (const [a, b] of outline.map((p, i) => [p, outline[(i + 1) % outline.length]])) {
    const face = wallFace(a, b);
    panel(out, 'plinth', face, 0, face.length, -0.32, 0.14, 0.025, colors.stone);
  }
  const longStreet = wallFace(outline[6], outline[7]);
  const corner = wallFace(outline[7], outline[8]);
  const secondStreet = wallFace(outline[8], outline[0]);
  door(out, longStreet, 0.91, level);
  for (const u of [2.58, 4.72, 6.87]) sash(out, longStreet, u, level, true);
  sash(out, corner, 2.15, level, true);
  sash(out, secondStreet, 1.01, level);
  door(out, secondStreet, 2.45, level);
  sash(out, secondStreet, 4.08, level);
  if (level > 0) sash(out, secondStreet, 6.18, level);
  if (level > 1) {
    const short = wallFace(outline[4], outline[6]);
    sash(out, short, 2.26, level);
    const signU = secondStreet.P(3.08, 1.87, 0.049);
    fbox(out, 'detail', secondStreet, 2.99, 3.17, 1.74, 2.03, 0.023, 0.049, colors.sign);
    abox(
      out,
      'detail',
      signU,
      [signU[0] + 0.053, signU[1] + 0.045, signU[2] + 0.031],
      colors.stone,
    );
  }
  if (level > 2) {
    const pipe = (face, u) =>
      fbox(out, 'detail', face, u - 0.038, u + 0.038, 0.07, eave, 0.024, 0.111, colors.flashing, {
        bottom: true,
      });
    pipe(corner, 0.24);
    pipe(secondStreet, 6.85);
  }
  roof(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'hans-christian-andersen-birthplace-model.mjs';
const camera = [20, 10, -20];
const lookAt = [0.26, 2.46, 0.22];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Hans Christian Andersen’s Birthplace',
  wikidataId: plan.wikidataId,
  category: 'historic-house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The small yellow Odense birthplace with its irregular tiled roofs, multi-light sash and chamfered corner.',
  camera,
  lookAt,
  sunDirection: [64, 72, -51],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Mapped outline of the historic birthplace at Hans Jensens Stræde.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'tile_ceramic', 'stone_basalt', 'wood_plain'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'birthplace-street-corner', position: [17.5, 4.05, -14], lookAt: [0.2, 2.27, -1] },
    { name: 'yellow-walls-and-sashes', position: [6, 4.25, -19], lookAt: [0, 2.35, -1.1] },
    { name: 'historic-tiled-roof', position: [10, 15, -11.5], lookAt: [0, 3.2, -0.2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'andersen-birthplace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.29,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.13, surfaces },
      street: { export: 'street', errorMeters: 0.054, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.023, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original 3D work under the repository license. Native building extent under ODbL. Elevation from Mapzen Terrarium under its open source-data terms.',
};

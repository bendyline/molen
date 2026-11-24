import fs from 'node:fs';
import {
  beam,
  beamPath,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = frame.geometry.outline;
const { foundation, sideBathFloor, upperFloor, upperEave, mainRidge, wingEave, wingRidge } =
  plan.dimensions;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.93 },
  timber: { slot: 'wall', graph: 'wood_plain', roughness: 0.92 },
  rail: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
  plaster: { slot: 'wall', graph: 'stucco', roughness: 0.95 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.87 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.6 },
};
const brick = rgb('a76753');
const masonry = rgb('948576');
const board = rgb('825c42');
const dark = rgb('584e3e');
const frameColor = rgb('75614b');
const plaster = rgb('c5c2ac');
const tile = rgb('656b63');
const shadowTile = rgb('555b55');
const glass = rgb('566668');

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function roofHip(out, bounds, y, h, ridgeInset, paint, lod) {
  const [x0, x1, z0, z1] = bounds;
  const southWest = [x0, y, z1],
    southEast = [x1, y, z1];
  const northWest = [x0, y, z0],
    northEast = [x1, y, z0];
  const rz = (z0 + z1) / 2;
  const west = [x0 + ridgeInset, h, rz],
    east = [x1 - ridgeInset, h, rz];
  quad4(out, 'tile', southWest, southEast, east, west, paint);
  quad4(out, 'tile', northEast, northWest, west, east, paint);
  tri(out, 'tile', northWest, southWest, west, paint);
  tri(out, 'tile', southEast, northEast, east, paint);
  if (lod > 0) {
    beamPath(
      out,
      'tile',
      [southWest, southEast, northEast, northWest],
      0.133,
      0.128,
      shadowTile,
      true,
    );
    beam(out, 'tile', west, east, 0.23, 0.17, shadowTile);
  }
  if (lod >= 2) {
    for (const [a, b] of [
      [southWest, west],
      [northWest, west],
      [southEast, east],
      [northEast, east],
    ])
      beam(out, 'tile', a, b, 0.17, 0.14, shadowTile);
  }
}
function crossGable(out, a, b, width, y, top, lod) {
  gableRoof(out, 'tile', a, b, width, y, top, tile, {
    overhang: 0.37,
    endSlot: 'timber',
    endColor: board,
  });
  if (lod > 0)
    beam(out, 'tile', [a[0], top + 0.03, a[1]], [b[0], top + 0.03, b[1]], 0.21, 0.15, shadowTile);
}

function massing(out, lod) {
  extrude(out, 'granite', outline, foundation, sideBathFloor - 0.28, masonry, { top: false });
  extrude(out, 'brick', outline, sideBathFloor - 0.28, upperFloor, brick, { top: false });
  extrude(out, 'timber', outline, upperFloor, wingEave - 0.17, board, { top: false });
  const eaveDeck = outline.map(([x, z]) => [x, wingEave - 0.17, z]);
  const triangulation = earcut(outline.flat(), [], 2);
  for (let i = 0; i < triangulation.length; i += 3) {
    const [a, b, c] = triangulation.slice(i, i + 3);
    tri(out, 'tile', eaveDeck[a], eaveDeck[c], eaveDeck[b], shadowTile);
  }
  box(out, 'timber', -19.27, 6.98, -15.19, -1.31, wingEave - 0.23, upperEave, board);
  roofHip(out, [-20.02, 7.46, -15.67, 0.58], upperEave, mainRidge, 5.34, tile, lod);
  roofHip(out, [-14.41, 15.64, 6.59, 16.61], wingEave - 0.17, wingRidge, 4.75, tile, lod);
  roofHip(out, [4.74, 19.21, -6.68, 4.88], wingEave - 0.12, wingRidge - 0.32, 3.87, tile, lod);
  roofHip(out, [0.95, 9.06, 3.08, 8.44], wingEave - 0.13, 4.44, 2.65, tile, lod);
  crossGable(out, [-4.95, -15.13], [-4.63, 7.74], 12.86, upperEave - 0.09, mainRidge - 0.33, lod);
  crossGable(out, [-13.46, 13.95], [-13.63, 6.98], 5.1, 2.87, 4.89, lod);
  roofHip(out, [-8.63, -2.51, -17.39, -13.27], 2.69, 4.07, 1.07, tile, lod);
  roofHip(out, [-1.76, 9.26, -11.55, -5.12], 2.82, 4.51, 2.75, tile, lod);
  box(out, 'brick', 2.98, 4.04, -10.16, -8.88, 3.21, 7.62, rgb('9e6352'));
  box(out, 'brick', -13.58, -12.73, -3.74, -2.88, 4.38, 7.76, rgb('a46857'));
  for (const [x0, x1, z0, z1, h] of [
    [2.82, 4.19, -10.3, -8.75, 7.62],
    [-13.78, -12.56, -3.94, -2.69, 7.76],
  ])
    box(out, 'granite', x0, x1, z0, z1, h, h + 0.26, masonry);
}

function casement(out, f, u, y, width, height, lod, options = {}) {
  const { head = 'flat', tint = glass, frame: rim = frameColor, sill = lod > 1 } = options;
  opening(out, f, u, y, width, height, {
    head,
    glass: tint,
    frame: rim,
    frameWidth: 0.075,
    frameDepth: 0.078,
    d: 0.035,
    mullions: lod > 1 ? 2 : 0,
    transoms: lod > 1 ? 2 : 0,
    mullionColor: dark,
    sill,
  });
}
function entrance(out, lod) {
  const north = facade([0, -16.99], [-1, 0]);
  // Set the entry just beyond the wall of the upper floor. The lower bath is entered downhill.
  fbox(out, 'plaster', north, 2.9, 8.23, upperFloor - 0.19, 2.82, -0.2, 0.15, plaster);
  box(out, 'granite', -9.65, -1.17, -20.31, -16.81, -1.35, upperFloor - 0.014, rgb('a29c89'));
  if (lod === 0) return;
  const doorPlane = facade([0, -17.15], [-1, 0]);
  casement(out, doorPlane, 5.42, upperFloor, 2.12, 2.49, lod, {
    head: 'round',
    tint: rgb('514940'),
    frame: dark,
    sill: false,
  });
  for (const u of [3.31, 7.79])
    fbox(out, 'rail', north, u - 0.089, u + 0.089, upperFloor, 2.75, 0.12, 0.19, dark);
  const gable = facade([0, -15.18], [-1, 0]);
  casement(out, gable, 4.93, 4.02, 1.93, 1.66, lod, {
    head: 'round',
    tint: rgb('4b5a57'),
    frame: rgb('8b6b52'),
    sill: false,
  });
  const leftHall = facade([0, -15.32], [-1, 0]);
  for (const u of [10.8, 13.28, 16.08, 17.71])
    casement(out, leftHall, u, 0.75, 1.15, 1.72, lod, { tint: rgb('72664e') });
  const eastShelter = facade([0, -11.47], [-1, 0]);
  for (const u of [-6.26, -3.35, -0.55])
    casement(out, eastShelter, u, 0.61, 1.64, 1.86, lod, { frame: dark });
  if (lod >= 2) {
    for (const [x0, x1] of [
      [-9.49, -8.13],
      [-2.6, -1.31],
    ]) {
      for (const y of [upperFloor + 0.31, upperFloor + 0.87])
        beam(out, 'rail', [x0, y, -19.62], [x1, y, -19.62], 0.073, 0.07, dark);
      for (const x of [x0, (x0 + x1) / 2, x1])
        beam(
          out,
          'rail',
          [x, upperFloor, -19.62],
          [x, upperFloor + 0.94, -19.62],
          0.079,
          0.079,
          dark,
        );
    }
  }
}

function lowerWingFacade(out, lod) {
  for (const [first, last, count, bottom] of [
    [9, 10, 5, -3.49],
    [7, 8, 3, -4.24],
    [5, 6, 2, -4.8],
    [10, 11, 3, -2.94],
    [3, 4, 1, -4.06],
    [4, 5, 2, -4.64],
  ]) {
    const f = wallFace(outline[first], outline[last]);
    const bay = f.length / count;
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) * bay;
      casement(out, f, u, bottom, Math.min(bay * 0.58, 1.49), -0.66 - bottom, lod, {
        head: 'round',
        tint: rgb('596664'),
        frame: rgb('a69479'),
      });
      casement(out, f, u, upperFloor + 0.51, Math.min(bay * 0.75, 1.77), 1.64, lod);
    }
    if (lod >= 2)
      fbox(
        out,
        'granite',
        f,
        -0.055,
        f.length + 0.042,
        upperFloor - 0.24,
        upperFloor + 0.02,
        0.01,
        0.131,
        masonry,
      );
  }
  const east = wallFace(outline[14], outline[15]);
  for (const u of [1.24, 3.87, 6.43, 9.31]) casement(out, east, u, 1.0, 1.34, 1.59, lod);
  const west = wallFace(outline[0], outline[1]);
  for (const u of [1.31, 3.65, 6.27, 8.35]) {
    casement(out, west, u, 0.91, 1.05, 1.57, lod);
    if (lod >= 2) casement(out, west, u, -3.32, 1.08, 2.43, lod, { head: 'round', frame: masonry });
  }
}
function timberDetail(out, lod) {
  if (lod < 2) return;
  // Rafter ends cast a repeating shadow line across the historic back of the eaves.
  for (let i = 0; i < 24; i++) {
    const value = -18.58 + i * 1.05;
    box(out, 'rail', value - 0.055, value + 0.055, -15.71, -14.96, 3.43, 3.62, dark);
  }
  if (lod === 3) {
    for (const [a, b] of [
      [14, 15],
      [9, 10],
      [5, 6],
      [0, 1],
    ]) {
      const f = wallFace(outline[a], outline[b]);
      for (const y of [0.42, 0.62, 2.78]) {
        fbox(out, 'trim', f, 0.03, f.length - 0.03, y, y + 0.031, 0.035, 0.065, dark);
      }
    }
  }
}
function build(out, lod) {
  massing(out, lod);
  entrance(out, lod);
  if (lod >= 1) lowerWingFacade(out, lod);
  timberDetail(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'beitou-hot-spring-museum-model.mjs';
const camera = [23, 22, -48];
const lookAt = [-2, 1.85, -4.8];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'heritage',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Taipei’s historic hillside bathhouse with intersecting Japanese tiled roofs, uphill timber entrance and downhill red-brick arcades.',
  camera,
  lookAt,
  sunDirection: [22, 49, -42],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Mapped bathhouse with the restored uphill genkan and downhill brick bath hall.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'zhongshan-road-roofs-and-entrance', position: camera, lookAt },
    { name: 'uphill-genkan-timber-and-tile', position: [-5, 5.9, -35], lookAt: [-5, 2.55, -13.08] },
    { name: 'downhill-brick-bath-wing', position: [-35, 12.8, 38], lookAt: [2, -0.57, 9.8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'beitou-hot-spring-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.71,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.265, surfaces },
      street: { export: 'street', errorMeters: 0.098, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.041, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

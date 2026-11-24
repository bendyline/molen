import fs from 'node:fs';
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

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor, southFront: main, northService: north } = plan.dimensions;
const surfaces = {
  walls: { slot: 'wall', graph: 'stucco', roughness: 0.96 },
  sash: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  chimney: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66 },
};
const plaster = rgb('e0ded3');
const pale = rgb('d5d2c5');
const trim = rgb('e8e5d7');
const slate = rgb('6b6870');
const caps = rgb('9f9a90');
const glass = rgb('353e3d');
const wood = rgb('4b524e');

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function hip(out, [sw, se, ne, nw], [r0, r1], low, high) {
  const [a, b, c, d] = [sw, se, ne, nw].map(([x, z]) => [x, low, z]);
  const [p, q] = [r0, r1].map(([x, z]) => [x, high, z]);
  quad4(out, 'roof', a, b, q, p, slate);
  tri(out, 'roof', b, c, q, slate);
  quad4(out, 'roof', c, d, p, q, slate);
  tri(out, 'roof', d, a, p, slate);
}

function hippedRange(out, x0, x1, z0, z1, y0, eave, ridge, color = plaster) {
  block(out, 'walls', x0, x1, z0, z1, y0, eave, color);
  const e = 0.23;
  block(out, 'walls', x0 - e, x1 + e, z0 - e, z1 + e, eave - 0.29, eave, trim);
  const half = Math.min((z1 - z0) / 2, (x1 - x0) * 0.35);
  hip(
    out,
    [
      [x0 - e, z1 + e],
      [x1 + e, z1 + e],
      [x1 + e, z0 - e],
      [x0 - e, z0 - e],
    ],
    [
      [x0 + half, (z0 + z1) / 2],
      [x1 - half, (z0 + z1) / 2],
    ],
    eave,
    ridge,
  );
}

function sash(out, F, u, bottom, w, h, lod, door = false) {
  opening(out, F, u, bottom, w, h, {
    glassSlot: 'glass',
    frameSlot: 'sash',
    glass: door ? wood : glass,
    frame: trim,
    d: 0.045,
    frameWidth: lod > 1 ? 0.075 : 0,
    sill: lod > 1 && !door,
    frameDepth: 0.1,
    mullions: lod === 3 ? (w > 1.19 ? 2 : 1) : 0,
    transoms: lod === 3 ? (h > 1.85 ? 2 : 1) : lod === 2 && h > 1.6 ? 1 : 0,
  });
}

function windows(out, F, first, spacing, count, levels, lod) {
  for (let i = 0; i < count; i++) {
    if (lod === 0 && i % 2 !== 0) continue;
    for (const [y, w, h] of levels) sash(out, F, first + i * spacing, y, w, h, lod);
  }
}

function cantedBay(out, F, u, lod) {
  const footprint = [
    [u - 3.4, -0.05],
    [u - 2.28, 1.36],
    [u + 2.28, 1.36],
    [u + 3.4, -0.05],
  ].map(([x, d]) => {
    const p = F.P(x, 0, d);
    return [p[0], p[2]];
  });
  extrude(out, 'walls', footprint, floor, 4.35, plaster, { top: false });
  const [a, b, c, d] = footprint.map(([x, z]) => [x, 4.35, z]);
  quad4(out, 'roof', a, b, c, d, slate);
  for (let i = 0; i < 3; i++) {
    const plane = wallFace(footprint[i], footprint[i + 1]);
    if (i === 1) windows(out, plane, 0.88, 1.4, 3, [[0.97, 0.95, 2.57]], lod);
    else sash(out, plane, plane.length / 2, 0.97, 0.75, 2.57, lod);
    if (lod > 0) fbox(out, 'walls', plane, -0.1, plane.length + 0.1, 4.17, 4.44, 0, 0.15, trim);
  }
}

function gardenFront(out, east, length, lod) {
  windows(
    out,
    east,
    1.9,
    (length - 3.8) / 7,
    8,
    [
      [5.05, 1.22, 2.35],
      [8.51, 1.18, 1.65],
    ],
    lod,
  );
  cantedBay(out, east, 5.22, lod);
  cantedBay(out, east, length - 5.52, lod);
  const u = length * 0.461;
  sash(out, east, u, 0.61, 1.38, 2.85, lod, true);
  if (lod > 1)
    for (const offset of [-1.72, 1.72]) sash(out, east, u + offset, 0.82, 0.92, 2.51, lod);
  fbox(out, 'stone', east, u - 3.42, u + 3.42, 0.18, 0.5, 0, 2.3, caps);
  fbox(out, 'walls', east, u - 3.23, u + 3.23, 3.92, 4.4, 0, 2.13, trim);
  fbox(out, 'roof', east, u - 3.29, u + 3.29, 4.39, 4.48, 0, 2.2, slate);
  for (const dx of [-2.59, -0.91, 0.91, 2.59]) {
    fbox(out, 'walls', east, u + dx - 0.135, u + dx + 0.135, 0.48, 3.95, 1.77, 2.04, trim);
    if (lod > 0) {
      fbox(out, 'walls', east, u + dx - 0.19, u + dx + 0.19, 0.48, 0.64, 1.7, 2.11, trim);
      fbox(out, 'walls', east, u + dx - 0.2, u + dx + 0.2, 3.75, 3.98, 1.69, 2.12, trim);
    }
  }
}

function stack(out, x, z, base, top, w, d, rear, lod) {
  const slot = rear ? 'chimney' : 'walls';
  const color = rear ? rgb('ad957a') : pale;
  block(out, slot, x - w / 2, x + w / 2, z - d / 2, z + d / 2, base, top, color);
  block(
    out,
    'stone',
    x - w / 2 - 0.1,
    x + w / 2 + 0.1,
    z - d / 2 - 0.1,
    z + d / 2 + 0.1,
    top - 0.19,
    top,
    caps,
  );
  if (lod > 1)
    for (const dx of [-w / 4, w / 4])
      block(out, slot, x + dx - 0.11, x + dx + 0.11, z - 0.12, z + 0.12, top, top + 0.31, color);
}

function principal(out, lod) {
  const outline = [
    [-1.26, -1.07],
    [33.96, -1.9],
    [33.617, main.z],
    [main.west, main.z],
  ];
  extrude(out, 'walls', outline, floor, main.eave, plaster, { top: false });
  hip(
    out,
    [
      [main.west - 0.25, main.z + 0.26],
      [33.89, main.z + 0.26],
      [34.22, -2.17],
      [-1.52, -1.32],
    ],
    [
      [6.95, 9.08],
      [24.01, 9.17],
    ],
    main.eave,
    main.ridge,
  );
  const faces = [
    wallFace(outline[0], outline[3]),
    wallFace(outline[3], outline[2]),
    wallFace(outline[2], outline[1]),
    wallFace(outline[1], outline[0]),
  ];
  for (const F of faces) {
    fbox(out, 'walls', F, -0.13, F.length + 0.13, main.eave - 0.39, main.eave, 0, 0.26, trim);
    if (lod > 0) {
      fbox(out, 'walls', F, 0, F.length, 4.23, 4.4, 0, 0.125, trim);
      for (const u of [0.12, F.length - 0.48])
        fbox(out, 'walls', F, u, u + 0.37, floor, main.eave - 0.27, 0, 0.12, trim);
    }
  }
  gardenFront(out, faces[2], faces[2].length, lod);
  windows(
    out,
    faces[1],
    2.6,
    4.29,
    8,
    [
      [0.89, 1.3, 2.72],
      [5.09, 1.22, 2.27],
      [8.49, 1.14, 1.65],
    ],
    lod,
  );
  if (lod > 0) {
    windows(
      out,
      faces[0],
      2.3,
      4.75,
      5,
      [
        [5.09, 1.22, 2.16],
        [8.48, 1.1, 1.61],
      ],
      lod,
    );
    windows(
      out,
      faces[3],
      10.3,
      4.08,
      5,
      [
        [4.97, 1.18, 2.07],
        [8.53, 1.08, 1.66],
      ],
      lod,
    );
  }
  stack(out, 27.22, 9.33, 12.2, 15.1, 1.14, 0.83, false, lod);
  stack(out, 15.25, 7.47, 12.1, 14.67, 1.24, 1.37, false, lod);
  stack(out, 6.8, 9.68, 12.1, 14.92, 1.58, 0.91, true, lod);
}

function serviceRanges(out, lod) {
  hippedRange(out, -23.78, -1.38, 7.25, 13.86, floor, 3.45, 5.03);
  windows(out, facade([0, 13.86], [1, 0]), -20.8, 3.38, 6, [[0.78, 1.06, 1.68]], lod);
  hippedRange(out, -19.72, -4.82, 2.26, 8.44, floor, 3.71, 4.32, pale);
  hippedRange(out, -4.88, -1.25, 4.92, 13.2, floor, 5.64, 6.65);
  if (lod > 0) {
    const arcade = facade([0, 2.26], [-1, 0]);
    for (const x of [6.25, 8.52, 10.79, 13.06, 15.33, 17.6])
      opening(out, arcade, x, floor + 0.08, 1.34, 2.59, {
        glassSlot: 'glass',
        frameSlot: 'walls',
        glass: wood,
        frame: trim,
        d: 0.04,
        head: 'round',
        steps: 5,
        frameWidth: lod > 1 ? 0.16 : 0.08,
        frameDepth: 0.16,
      });
  }
  hippedRange(out, -21.2, -9.7, -19.65, -1.35, floor, 7.68, 9.51, pale);
  hippedRange(out, -9.9, 1.5, -15.5, -1.15, floor, 6.27, 7.85);
  hippedRange(out, -20.21, -8.14, -23.7, -15.41, floor, 4.82, 6.37);
  hippedRange(out, 1.44, 10.85, -15.99, -1.15, floor, 7.51, 9.32);
  hippedRange(out, 10.72, 16.96, -11.65, -1.1, floor, 6.43, 8.14, pale);
  hippedRange(out, 23.52, 34.02, -7.31, -1.55, floor, 7.24, 8.85);
  const gable = facade([0, north.front], [-1, 0]);
  block(out, 'walls', -8.2, north.east, north.front, -11.0, floor, north.eave, plaster);
  gableRoof(
    out,
    'roof',
    [-2.39, north.front - 0.22],
    [-2.39, -10.86],
    11.61,
    north.eave,
    north.ridge,
    slate,
    { endSlot: 'walls', endColor: plaster, overhang: 0.23 },
  );
  windows(
    out,
    gable,
    -0.74,
    5.4,
    2,
    [
      [0.96, 1.28, 2.19],
      [4.63, 1.15, 1.72],
    ],
    lod,
  );
  windows(out, facade([0, -23.7], [-1, 0]), 10.25, 3.1, 3, [[1.05, 1.23, 2.53]], lod);
  if (lod > 0) {
    windows(
      out,
      facade([0, -15.99], [-1, 0]),
      -9.42,
      3.19,
      3,
      [
        [1.48, 0.96, 1.93],
        [4.51, 0.91, 1.65],
      ],
      lod,
    );
    windows(
      out,
      facade([0, -1.35], [1, 0]),
      -18.9,
      3.0,
      3,
      [
        [1.35, 0.96, 1.94],
        [4.99, 0.89, 1.66],
      ],
      lod,
    );
  }
  stack(out, -2.6, -19.22, 8.43, 10.54, 1.21, 0.93, true, lod);
  stack(out, 7.45, -8.24, 7.62, 10.61, 1.37, 1.07, true, lod);
}

function build(out, lod) {
  extrude(out, 'stone', frame.geometry.outline, foundation, floor + 0.02, caps, { top: false });
  serviceRanges(out, lod);
  principal(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'moreton-house-bideford-model.mjs';
const camera = [70, 23, 48];
const lookAt = [6, 5.5, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'residence',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The rendered Georgian house at Bideford with its east portico and canted bays, south lawn front, and stepped northern service ranges.',
  camera,
  lookAt,
  sunDirection: [30, 42, 18],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Individually listed house and attached ranges within the mapped outline.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'principal-house-and-south-lawn', position: camera, lookAt },
    { name: 'east-portico-and-canted-bays', position: [57, 8, 9], lookAt: [27, 5.6, 9] },
    { name: 'north-drive-and-stepped-service-ranges', position: [-21, 14, -56], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'moreton-house-' + reviewLod,
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

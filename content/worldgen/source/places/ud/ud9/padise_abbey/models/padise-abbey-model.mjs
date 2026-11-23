import fs from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outline, holes } = frame.geometry;
const { foundation, courtFloor, churchEave, churchRidge, northTurret } = plan.dimensions;

const limestone = rgb('aaa69a');
const lightStone = rgb('c2b9a6');
const weathered = rgb('9c9686');
const paving = rgb('aaa08e');
const roof = rgb('a1afb1');
const lead = rgb('8b969a');
const timber = rgb('8d7760');
const glass = rgb('596161');
const recess = rgb('5c584f');
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  paving: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.86 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.6 },
};

function cap(out, ring, inside, y, slot, color) {
  const vertices = [ring, ...inside].flat();
  const starts = inside.map((_, i) =>
    inside.slice(0, i).reduce((n, h) => n + h.length, ring.length),
  );
  const faces = earcut(vertices.flat(), starts, 2);
  const p = (i) => [vertices[i][0], y, vertices[i][1]];
  for (let i = 0; i < faces.length; i += 3)
    tri(out, slot, p(faces[i]), p(faces[i + 2]), p(faces[i + 1]), color);
}

function wallSpan(out, f, u0, u1, y0, y1, depth = 1.18, tint = limestone) {
  if (u1 - u0 < 0.075 || y1 - y0 < 0.06) return;
  fbox(out, 'wall', f, u0, u1, y0, y1, -depth, 0.014, tint);
}

function select(ring, indices) {
  return indices.map((i) => ring[i]);
}

const wideOutline = select(
  outline,
  [0, 1, 2, 8, 10, 14, 17, 19, 21, 22, 24, 26, 35, 36, 40, 43, 48, 52, 53, 54],
);
const wideHoles = [
  select(holes[0], [0, 3, 12, 14]),
  select(holes[1], [0, 1, 7, 8, 9, 11, 16, 17, 18]),
  select(holes[2], [0, 3, 5, 8, 10, 11]),
];

function window(out, f, center, sill, width, height, lod, gothic = false) {
  if (lod === 0) {
    const left = center - width / 2;
    const right = center + width / 2;
    const spring = sill + height - Math.min(width * 0.48, height * 0.3);
    const a = f.P(left, spring, 0.025);
    const b = f.P(right, spring, 0.025);
    quad4(out, 'glass', f.P(left, sill, 0.025), f.P(right, sill, 0.025), b, a, recess);
    tri(out, 'glass', a, b, f.P(center, sill + height, 0.025), recess);
    return;
  }
  opening(out, f, center, sill, width, height, {
    head: gothic ? 'pointed' : 'round',
    rise: width * (gothic ? 0.59 : 0.4),
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: gothic ? glass : recess,
    frame: lightStone,
    frameWidth: lod > 0 ? 0.18 : 0.08,
    frameDepth: 0.18,
    sill: true,
    mullions: gothic && lod > 1 ? 1 : 0,
    transoms: gothic && lod > 2 ? 1 : 0,
  });
  if (gothic && lod > 1) {
    const top = sill + height - 0.49;
    for (const direction of [-1, 1]) {
      beamPath(
        out,
        'trim',
        [
          f.P(center, top, 0.096),
          f.P(center + direction * width * 0.28, top - 0.48, 0.096),
          f.P(center + direction * width * 0.28, top - 0.79, 0.096),
        ],
        0.12,
        0.12,
        lightStone,
      );
    }
  }
}

function ruinTop(out, f, u0, u1, base, average, lod, key, tint = limestone) {
  if (u1 - u0 < 2.1) {
    wallSpan(out, f, u0, u1, base, average, 0.97, tint);
    return;
  }
  const step = lod === 0 ? 4.5 : lod === 1 ? 3.86 : 2.05;
  const count = Math.ceil((u1 - u0) / step);
  for (let i = 0; i < count; i++) {
    const phase = ((key * 7 + i * 11) % 17) / 16;
    const a = u0 + ((u1 - u0) * i) / count;
    const b = u0 + ((u1 - u0) * (i + 1)) / count;
    wallSpan(
      out,
      f,
      a,
      b,
      base,
      average + (phase - 0.5) * 0.85,
      lod < 2 ? 1.02 : 0.94 + phase * 0.16,
      tint,
    );
  }
}

function northAndGatehouse(out, lod) {
  const north = wallFace(outline[0], outline[1]);
  wallSpan(out, north, 0, north.length, courtFloor, churchEave, 1.45);
  const end = wallFace(outline[57], outline[0]);
  wallSpan(out, end, 0, end.length, courtFloor, churchEave, 1.43);
  const churchEast = facade([26.42, -18.58], [0, -1]);
  wallSpan(out, churchEast, -7.2, 7.24, courtFloor, churchEave, 1.47);
  const churchIn = facade([10.16, -11.19], [1, 0]);
  wallSpan(out, churchIn, -16.26, 16.24, courtFloor, churchEave, 1.21, weathered);
  gableRoof(out, 'roof', [-5.91, -18.47], [26.08, -18.62], 14.33, churchEave, churchRidge, roof, {
    overhang: 0.23,
    endSlot: 'wall',
    endColor: limestone,
  });

  for (const [start, stop, height] of [
    [1, 2, 11.36],
    [2, 3, 11.39],
    [3, 4, 11.32],
    [4, 5, 11.3],
    [5, 6, 11.13],
    [6, 7, 10.94],
    [7, 8, 10.91],
  ]) {
    const f = wallFace(outline[start], outline[stop]);
    wallSpan(out, f, 0, f.length, courtFloor, height, 1.21);
  }
  const west = facade([-21.79, -30.28], [0, 1]);
  // The gate portal is set into the lower part of the west projection.
  wallSpan(out, west, -7.36, -1.48, courtFloor, 11.32, 1.52);
  wallSpan(out, west, 1.48, 7.56, courtFloor, 11.32, 1.52);
  wallSpan(out, west, -1.48, 1.48, 4.38, 11.32, 1.52);
  const portalBack = facade([-20.96, -30.28], [0, 1]);
  window(out, portalBack, 0, courtFloor - 0.12, 2.86, 4.48, lod, true);
  const gateRear = facade([-14.03, -22.68], [1, 0]);
  wallSpan(out, gateRear, -7.25, 7.52, courtFloor, 11.32, 1.45);
  gableRoof(out, 'roof', [-14.04, -36.04], [-14.01, -22.58], 14.76, 11.27, 15.53, lead, {
    overhang: 0.36,
    endSlot: 'wall',
    endColor: limestone,
  });

  const bartizan = [25.13, -24.32];
  const sides = [10, 14, 20, 28][lod];
  const turret = [
    [10.33, 0.36, 0.36],
    [10.59, 0.78, 0.78],
    [11.47, 1.28, 1.28],
    [11.89, 1.6, 1.6],
    [12.14, 1.74, 1.74],
    [18.35, 1.74, 1.74],
    [18.57, 1.78, 1.78],
    [northTurret, 1.69, 1.69],
  ];
  lathe(out, 'wall', bartizan, turret, sides, limestone);
  if (lod > 0) {
    const eastTurret = facade([bartizan[0] + 1.73, bartizan[1]], [0, -1]);
    window(out, eastTurret, 0, 16.23, 0.38, 0.96, lod);
  }

  for (const [u, y, w, h] of [
    [4.96, 3.95, 2.11, 6.03],
    [13.77, 4.72, 1.62, 5.17],
    [22.16, 4.58, 1.69, 5.21],
  ]) {
    window(out, north, u, y, w, h, lod, true);
  }
  window(out, churchEast, -1.31, 3.69, 2.21, 5.95, lod, true);
  for (const u of [-4.35, 2.66, 8.04]) {
    window(out, churchIn, u, 4.09, 1.59, 4.81, lod, true);
  }
  if (lod === 0) return;
  window(out, north, 9.25, 2.18, 0.48, 0.62, lod);
  window(out, north, 27.54, 2.79, 0.71, 1.33, lod);
  window(out, west, -4.71, 6.14, 0.76, 1.51, lod);
  window(out, west, 4.51, 6.2, 0.81, 1.59, lod);
}

function exteriorRuin(out, lod) {
  const west = wallFace(outline[8], outline[9]);
  const westBands = [
    [15.0, 23.8, 9.42],
    [23.8, 34.1, 7.63],
    [34.1, 43.3, 6.28],
    [43.3, west.length, 8.3],
  ];
  for (const [i, [a, b, height]] of westBands.entries())
    ruinTop(out, west, a, b, courtFloor, height, lod, i + 3);
  if (lod > 0) {
    for (const [u, y] of [
      [21.8, 3.35],
      [26.5, 2.69],
      [35.9, 2.57],
      [45.7, 2.48],
    ])
      window(out, west, u, y, 0.71, 1.27, lod);
  }
  // The mapped round southwestern ruin has a hollow centre.
  const towerLimit = 3.95;
  const edges =
    lod === 0
      ? [9, 10, 14, 17, 20, 22, 54, 56, 57]
      : lod === 1
        ? [9, 10, 12, 14, 16, 19, 22, 24, 26, 35, 36, 39, 44, 48, 52, 53, 54, 56, 57]
        : Array.from({ length: 49 }, (_, i) => i + 9);
  for (let k = 0; k < edges.length - 1; k++) {
    const i = edges[k];
    const f = wallFace(outline[i], outline[edges[k + 1]]);
    const tower = i >= 10 && i <= 20;
    const indent = i >= 22 && i < 51;
    const east = i >= 54;
    const height = tower
      ? towerLimit + (i % 4) * 0.18
      : indent
        ? 2.35 + (i % 5) * 0.21
        : east
          ? i === 56
            ? 8.45
            : 5.82
          : 5.05;
    if (lod === 0) wallSpan(out, f, 0, f.length, courtFloor, height, 1.02, weathered);
    else ruinTop(out, f, 0, f.length, courtFloor, height, lod, i, weathered);
    if (lod > 0 && f.length > 8.2 && (i >= 52 || i === 21)) {
      window(out, f, f.length * 0.32, 1.65, 0.93, 1.58, lod);
      if (f.length > 13) window(out, f, f.length * 0.72, 1.69, 1.05, 1.51, lod);
    }
  }
  if (lod === 0) return;
  const towerVoid = outwardRing(lod === 1 ? wideHoles[2] : holes[2]).reverse();
  for (const [i, p] of towerVoid.entries()) {
    const f = wallFace(p, towerVoid[(i + 1) % towerVoid.length]);
    wallSpan(out, f, 0, f.length, courtFloor, towerLimit - 0.15 + (i % 4) * 0.16, 0.51, weathered);
  }
}

function courts(out, lod) {
  const courtOutlines = lod < 2 ? wideHoles : holes;
  const westCourt = outwardRing(courtOutlines[0]).reverse();
  const innerCourt = outwardRing(courtOutlines[1]).reverse();
  for (const [ring, baseline] of [
    [westCourt, 4.15],
    [innerCourt, 4.65],
  ]) {
    for (const [i, a] of ring.entries()) {
      const b = ring[(i + 1) % ring.length];
      const f = wallFace(a, b);
      if (a[1] < -10.8 && b[1] < -10.8 && (a[0] > -4 || b[0] > -4)) continue;
      const y = baseline + (i % 5) * 0.43;
      if (lod === 0) {
        if (f.length > 6.8) wallSpan(out, f, 0, f.length, courtFloor, y, 1.01, weathered);
        continue;
      }
      ruinTop(out, f, 0, f.length, courtFloor, y, lod, i + 20, weathered);
      if (lod > 1 && f.length > 5.7) window(out, f, f.length * 0.47, 1.18, 0.98, 1.6, lod);
    }
  }
  const lowWalls = [
    [[4.7, 8.56], [4.9, 16.29], 2.02],
    [[10.63, 7.94], [10.86, 17.37], 2.64],
    [[-2.93, 7.8], [-8.69, 8.33], 2.07],
    [[-14.32, 3.75], [-14.02, 13.47], 2.52],
    [[-13.11, -19.81], [-6.39, -20.18], 3.08],
  ];
  for (const [i, [a, b, height]] of (lod === 0 ? [] : lowWalls).entries()) {
    const f = wallFace(a, b);
    ruinTop(out, f, 0, f.length, courtFloor, height, lod, i + 11, weathered);
  }
  const gallery = facade([18.11, -2.1], [0, -1]);
  fbox(out, 'wood', gallery, -8.84, 8.92, 2.36, 2.65, -1.11, 1.56, timber);
  gableRoof(out, 'roof', [20.02, -10.92], [20.02, 6.82], 6.48, 8.52, 10.38, roof, {
    overhang: 0.32,
  });
  const posts = lod === 0 ? [-8.4, 0, 8.4] : [-8.4, -5.61, -2.82, 0, 2.82, 5.61, 8.4];
  for (const u of posts) {
    fbox(out, 'wood', gallery, u - 0.14, u + 0.14, courtFloor, 8.53, -1.47, -1.24, timber);
    if (lod > 0) {
      fbox(out, 'wood', gallery, u - 0.084, u + 0.084, 2.64, 3.6, 1.37, 1.48, timber);
    }
  }
  if (lod > 1) fbox(out, 'wood', gallery, -8.46, 8.55, 3.51, 3.65, 1.31, 1.51, timber);
  const southCanopy = facade([7.76, 15.73], [1, 0]);
  const sheet = [
    southCanopy.P(-6.2, 4.87, -3.27),
    southCanopy.P(-6.2, 4.19, 3.15),
    southCanopy.P(6.2, 4.19, 3.15),
    southCanopy.P(6.2, 4.87, -3.27),
  ];
  quad4(out, 'roof', ...sheet, lead);
  quad4(out, 'wood', ...sheet.toReversed(), timber);
  for (const u of [-5.8, 0, 5.8]) {
    fbox(out, 'wood', southCanopy, u - 0.12, u + 0.12, courtFloor, 4.36, 2.76, 2.96, timber);
    if (lod < 2) continue;
    const brace = [southCanopy.P(u, 3.15, 2.86), southCanopy.P(u + 0.89, 4.28, 2.86)];
    beamPath(out, 'wood', brace, 0.14, 0.15, timber);
  }
}

function build(out, lod) {
  const groundOutline = lod === 0 ? wideOutline : outline;
  const groundHoles = lod < 2 ? wideHoles : holes;
  extrude(out, 'paving', groundOutline, foundation, courtFloor, paving, {
    holes: groundHoles,
    top: false,
  });
  cap(out, groundOutline, groundHoles, courtFloor, 'paving', paving);
  northAndGatehouse(out, lod);
  exteriorRuin(out, lod);
  courts(out, lod);
  if (lod < 3) return;
  // Modern approach steps and salvaged bases visible in the courtyard.
  const f = facade([-1.18, -9.93], [1, 0]);
  for (let i = 0; i < 9; i++) {
    const y = courtFloor + (i + 1) * 0.21;
    fbox(out, 'paving', f, 0, 2.17, courtFloor, y, -0.32, 3.32 - i * 0.33, paving);
  }
  for (const [x, z] of [
    [5.79, 7.08],
    [7.64, 6.88],
    [7.46, 5.49],
  ])
    abox(out, 'trim', [x - 0.39, courtFloor, z - 0.33], [x + 0.38, 0.93, z + 0.34], lightStone);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'padise-abbey-model.mjs';
const camera = [58, 28, -73];
const lookAt = [0, 7.5, -2];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Padise’s conserved limestone abbey with its northern church, surviving corner turret and open walled courtyards.',
  camera,
  lookAt,
  sunDirection: [48, 61, -55],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Named abbey relation 16395411 and mapped open courtyards.',
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
    { name: 'north-church-and-corner-turret', position: camera, lookAt },
    { name: 'inner-court-and-protective-roofs', position: [45, 43, 45], lookAt: [3.8, 3.3, -0.5] },
    { name: 'western-gatehouse-and-ruins', position: [-59, 16, 22], lookAt: [-15.2, 6.35, -6.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'padise-abbey-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.91,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.39, surfaces },
      street: { export: 'street', errorMeters: 0.136, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.052, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  abox,
  extrude,
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

const read = (key) => JSON.parse(readFileSync(new URL(`../${key}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/hycroft-manor-shape-controls');
const ring = shape.mappedRing;
const eave = 10.23;
const walls = outwardRing(
  [2, 3, 4, 5, 6, 7, 12, 13, 14, 15, 16, 17, 18, 19, 1].map((i) => ring[i]),
);
const frontPorch = shape.southPorteCochereEdges.map((i) => ring[i]);
const gardenPorch = shape.northRoomProjectionEdges.map((i) => ring[i]);
const center = (frontPorch[1][0] + frontPorch[2][0]) / 2;

const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.94 },
  trim: { slot: 'trim', localRef: 'palette:#c4c0b3', roughness: 0.92 },
  window: { slot: 'window', localRef: 'palette:#455459', roughness: 0.43 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.9 },
};
const colors = {
  wall: rgb('bab7ae'),
  base: rgb('8f9088'),
  light: rgb('d8d2c0'),
  lip: rgb('b0aa97'),
  roof: rgb('556353'),
  roofLight: rgb('5d6a54'),
  glass: rgb('48524d'),
  darkGlass: rgb('394645'),
  door: rgb('57483d'),
};

function hip(out, [x0, x1, z0, z1], lower, higher, hipRun) {
  const z = (z0 + z1) / 2;
  const a = [x0, lower, z0],
    b = [x1, lower, z0],
    c = [x1, lower, z1],
    d = [x0, lower, z1];
  const left = [x0 + hipRun, higher, z],
    right = [x1 - hipRun, higher, z];
  quad4(out, 'roof', b, a, left, right, colors.roof);
  quad4(out, 'roof', d, c, right, left, colors.roofLight);
  tri(out, 'roof', a, d, left, colors.roof);
  tri(out, 'roof', c, b, right, colors.roof);
  quad4(
    out,
    'trim',
    [x0, lower - 0.02, z0],
    [x1, lower - 0.02, z0],
    [x1, lower - 0.02, z1],
    [x0, lower - 0.02, z1],
    colors.lip,
  );
}

function sash(out, face, x, bottom, width, height, lod, { arched = false, door = false } = {}) {
  if (lod === 0) {
    const point = (u, y) => face.P(x + u * width, bottom + y * height, 0.022);
    quad4(
      out,
      door ? 'door' : 'window',
      point(-0.5, 0),
      point(0.5, 0),
      point(0.5, 1),
      point(-0.5, 1),
      door ? colors.door : colors.glass,
    );
    return;
  }
  opening(out, face, x, bottom, width, height, {
    head: arched ? 'round' : 'flat',
    glassSlot: door ? 'door' : 'window',
    glass: door ? colors.door : arched ? colors.darkGlass : colors.glass,
    frame: colors.light,
    frameWidth: arched && lod === 1 ? 0 : 0.095,
    frameDepth: 0.115,
    mullions: lod >= 2 ? 1 : 0,
    transoms: lod === 3 ? 2 : 0,
    sill: !door,
    d: 0.03,
  });
}

function balcony(out, face, x, y, lod) {
  fbox(out, 'trim', face, x - 0.91, x + 0.91, y - 0.12, y + 0.045, -0.06, 0.46, colors.lip);
  fbox(out, 'trim', face, x - 0.88, x + 0.88, y + 0.53, y + 0.635, 0.31, 0.46, colors.light);
  const count = lod === 3 ? 7 : 3;
  for (let i = 0; i < count; i++) {
    const at = x - 0.75 + (1.5 * i) / (count - 1);
    fbox(out, 'trim', face, at - 0.055, at + 0.055, y + 0.015, y + 0.54, 0.33, 0.435, colors.light);
  }
}

function mansion(out, lod) {
  extrude(out, 'stone', walls, -3.05, 0.96, colors.base, { top: false });
  extrude(out, 'wall', walls, 0.95, eave - 0.09, colors.wall, { top: false });
  for (const [index, a] of walls.entries()) {
    const face = wallFace(a, walls[(index + 1) % walls.length]);
    fbox(out, 'trim', face, 0, face.length, eave - 0.45, eave, -0.09, 0.31, colors.lip);
    if (lod > 1) {
      fbox(
        out,
        'trim',
        face,
        0.01,
        face.length - 0.01,
        eave - 0.64,
        eave - 0.5,
        -0.035,
        0.13,
        colors.light,
      );
      const brackets = Math.floor(face.length / (lod === 3 ? 0.92 : 1.7));
      for (let i = 0; i < brackets; i++) {
        const at = (face.length * (i + 0.5)) / brackets;
        fbox(
          out,
          'trim',
          face,
          at - 0.08,
          at + 0.08,
          eave - 0.68,
          eave - 0.41,
          0.04,
          0.25,
          colors.lip,
        );
      }
    }
    if (face.length < 2.65) continue;
    const count = Math.max(1, Math.round(face.length / 3.8));
    for (let bay = 0; bay < count; bay++) {
      const x = (face.length * (bay + 0.5)) / count;
      const inFront = face.normal[1] > 0.95;
      const central = inFront && Math.abs(face.P(x, 0, 0)[0] - center) < 1.6;
      const arched = inFront || face.normal[1] < -0.95;
      if (!central) sash(out, face, x, 1.62, 1.42, 2.98, lod, { arched });
      else sash(out, face, x, 0.92, 2.08, 3.24, lod, { arched, door: true });
      sash(out, face, x, 6.14, central ? 1.93 : 1.44, 2.21, lod);
      if (lod >= 2 && arched && !central) balcony(out, face, x, 6.03, lod);
    }
  }
}

function roof(out, lod) {
  hip(out, [-20.26, 16.35, -9.45, 9.17], eave + 0.02, 13.43, 7.45);
  hip(out, [-23.12, -13.9, -8.91, 9.06], eave, 11.76, 3.4);
  hip(out, [12.45, 22.52, -6.2, 8.66], eave, 11.75, 3.4);
  for (const x of [center - 4.18, center, center + 4.18]) {
    const dormerFront = 6.92;
    abox(out, 'wall', [x - 1.16, 10.39, 3.4], [x + 1.16, 11.84, dormerFront], colors.wall);
    gableRoof(out, 'roof', [x, 3.37], [x, dormerFront], 2.36, 11.84, 13.08, colors.roofLight, {
      overhang: 0.13,
      endSlot: 'trim',
      endColor: colors.light,
      ends: [false, true],
    });
    if (lod) {
      const face = wallFace([x - 1.15, dormerFront], [x + 1.15, dormerFront]);
      sash(out, face, 1.15, 10.94, 1.42, 0.9, lod);
    }
  }
  for (const [x, z, y] of [
    [-17.45, 0.94, 14.28],
    [-8.65, 3.0, 14.46],
    [12.32, 5.05, 14.1],
  ]) {
    abox(out, 'wall', [x - 0.44, 10.27, z - 0.49], [x + 0.44, y, z + 0.49], colors.light);
    abox(out, 'trim', [x - 0.53, y - 0.09, z - 0.57], [x + 0.53, y + 0.13, z + 0.57], colors.lip);
    if (lod >= 2)
      abox(
        out,
        'door',
        [x - 0.28, y + 0.13, z - 0.25],
        [x + 0.28, y + 0.16, z + 0.25],
        colors.door,
      );
  }
}

function column(out, point, foot, top, lod) {
  if (lod === 0) {
    lathe(
      out,
      'trim',
      point,
      [
        [foot, 0.37, 0.37],
        [top, 0.295, 0.295],
      ],
      5,
      colors.light,
      {
        capTop: false,
      },
    );
    return;
  }
  const height = top - foot;
  const sides = [5, 8, 12, 16][lod];
  const size = 0.45;
  const [x, z] = point;
  abox(out, 'trim', [x - 0.54, foot, z - 0.54], [x + 0.54, foot + 0.17, z + 0.54], colors.lip);
  const shaft =
    lod >= 2
      ? [
          [foot + 0.15, size],
          [foot + 0.25, size],
          [foot + 0.32, 0.38],
          [foot + 0.47, 0.325],
          [foot + 0.55 * height, 0.31],
          [top - 0.32, 0.266],
          [top - 0.24, 0.34],
          [top - 0.12, 0.44],
        ]
      : [
          [foot + 0.16, 0.355],
          [top - 0.18, 0.275],
          [top - 0.11, 0.43],
        ];
  lathe(
    out,
    'trim',
    point,
    shaft.map(([y, r]) => [y, r, r]),
    sides,
    colors.light,
    { capTop: false },
  );
  abox(
    out,
    'trim',
    [x - 0.48, top - 0.15, z - 0.41],
    [x + 0.48, top + 0.006, z + 0.41],
    colors.light,
  );
}

function porchRail(out, a, b, y, lod) {
  const face = wallFace(a, b);
  if (lod === 0) {
    fbox(out, 'trim', face, -0.1, face.length + 0.1, y, y + 0.77, -0.21, 0.08, colors.light);
    return;
  }
  fbox(out, 'trim', face, -0.12, face.length + 0.12, y, y + 0.11, -0.25, 0.09, colors.lip);
  fbox(out, 'trim', face, -0.1, face.length + 0.1, y + 0.72, y + 0.85, -0.21, 0.08, colors.light);
  const posts = Math.max(2, Math.round(face.length / [2.6, 0.92, 0.59, 0.44][lod]));
  for (let i = 0; i <= posts; i++) {
    const at = (face.length * i) / posts;
    const width = i === 0 || i === posts ? 0.23 : 0.07;
    fbox(out, 'trim', face, at - width, at + width, y + 0.1, y + 0.735, -0.19, 0.05, colors.light);
  }
}

function portico(out, outline, garden, lod) {
  const [innerLeft, outerLeft, outerRight, innerRight] = outline;
  const foot = garden ? -0.08 : 0.3;
  const bottom = garden ? 8.53 : 9.62;
  const top = bottom + 0.59;
  const onBeam = (t, offset) => [
    outerLeft[0] + (outerRight[0] - outerLeft[0]) * t,
    outerLeft[1] + (outerRight[1] - outerLeft[1]) * t + offset,
  ];
  const endOffset = garden ? 0.56 : -0.56;
  const along = garden ? [0.055, 0.28, 0.5, 0.72, 0.945] : [0.055, 0.35, 0.65, 0.945];
  for (const t of along) column(out, onBeam(t, endOffset), foot, bottom, lod);
  for (const [a, b] of [
    [outerLeft, innerLeft],
    [outerRight, innerRight],
  ]) {
    for (const t of garden ? [0.41, 0.75] : [0.63]) {
      column(out, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], foot, bottom, lod);
    }
  }
  extrude(out, 'stone', outline, -2.65, foot, colors.base, {
    topSlot: 'stone',
    topColor: colors.lip,
  });
  extrude(out, 'trim', outline, bottom - 0.04, top, colors.light, { bottom: true });
  const expanded = outline.map(([x, z]) => [
    x + (x < center ? -0.17 : 0.17),
    z + (garden ? -0.17 : 0.17),
  ]);
  extrude(out, 'trim', expanded, top - 0.1, top + 0.035, colors.lip);
  const railing = outwardRing(outline);
  for (let i = 0; i < railing.length; i++) {
    const a = railing[i],
      b = railing[(i + 1) % railing.length];
    if (Math.abs(a[1] - b[1]) < 0.7 && Math.abs(a[1]) < 11) continue;
    porchRail(out, a, b, top + 0.035, lod);
  }
  if (!garden) {
    abox(out, 'stone', [center - 1.8, -0.18, 8.07], [center + 1.8, 0.67, 10.9], colors.lip);
    abox(out, 'stone', [center - 1.64, 0.35, 8.07], [center + 1.64, 0.94, 10.53], colors.light);
  }
}

function build(sink, lod) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  mansion(out, lod);
  roof(out, lod);
  portico(out, frontPorch, false, lod);
  portico(out, gardenPorch, true, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'hycroft-manor-model.mjs';
const camera = [-34, 20, 56];
const lookAt = [0, 6.2, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'heritage-residence',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'Hycroft Manor with a green tiled hip roof, three front dormers, Ionic columns, concrete balustrades, and an open north terrace colonnade.',
  camera,
  lookAt,
  sunDirection: [-34, 54, 55],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    minimumCoverage: 0.89,
    basis:
      'OpenStreetMap names the full building outline, including both covered porticos and the solarium projections.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-footprint-caps.mjs', 'place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-porte-cochere', position: [-3, 7.4, 50], lookAt: [-2.0, 6.8, 9.0] },
    { name: 'columns-and-solarium', position: [-30.7, 5.7, 35], lookAt: [-6, 5.7, 8.4] },
    { name: 'green-hip-roof-and-dormers', position: [26, 22, 40], lookAt: [-1.6, 10.8, 1.65] },
    { name: 'north-garden-colonnade', position: [21, 8, -40], lookAt: [-2.2, 5.2, -11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hycroft-manor-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.53,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.24, surfaces },
      street: { export: 'street', errorMeters: 0.085, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.027, surfaces },
    },
  },
};

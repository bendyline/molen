/** The standing 1988 Kabutocho market building and office tower. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const terrain = read('terrain-grid');
const survey = read('native-map/plateau-exchange-geometry');
const scaleY =
  plan.dimensions.maxDesignHeight / (survey.localBounds[1][1] - survey.localBounds[1][0]);
const vertices = survey.vertices.map(([x, y, z]) => [
  x,
  (y - survey.localBounds[1][0]) * scaleY,
  z,
]);
const rings = frame.geometry.polygons.slice(1);
const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.91 },
  concrete: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.94 },
  flashing: { slot: 'trim', graph: 'metal_painted', roughness: 0.75 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.41, metalness: 0.16 },
  roof: { slot: 'roof', graph: 'concrete_panel', roughness: 0.92 },
};
const c = Object.fromEntries(
  Object.entries({
    stone: 'bebbb0',
    bright: 'cec9bc',
    shade: 'aaa99d',
    grayStone: 'afac9e',
    lightEdge: 'c7c0b2',
    roof: 'a29f94',
    glass: '536166',
    glassGreen: '52716c',
    highGlass: '607275',
    shadow: '4b4b45',
    frame: '86847a',
    bronze: '77665d',
    foundation: 'a5a399',
    pavement: 'b1ada0',
    metal: '66645f',
  }).map(([k, v]) => [k, rgb(v)]),
);
const blend = (a, b, t) => a.map((p, i) => p + (b[i] - p) * t);
const at = ([x, z], y) => [x, y, z];

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = terrain.heightsMeters;
  return (
    (h[j][i] * (1 - a) + h[j][i + 1] * a) * (1 - b) +
    (h[j + 1][i] * (1 - a) + h[j + 1][i + 1] * a) * b -
    terrain.modelDatumElevationMeters
  );
}

function cap(out, ring, y, tint) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((k) => at(ring[k], y));
    triangle(out, 'roof', [a, c, b], tint);
  }
}

function ringArea(ring) {
  return (
    ring.reduce((sum, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return sum + x * b - z * a;
    }, 0) * 0.5
  );
}

function mass(out, outline, height) {
  const ring = ringArea(outline) > 0 ? outline : [...outline].reverse();
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    const low = Math.min(ground(...a), ground(...b), 0) - 0.85;
    face(
      out,
      'granite',
      [at(b, low), at(a, low), at(a, height), at(b, height)],
      i % 2 === 0 ? c.stone : c.bright,
    );
  }
  cap(out, ring, height, c.roof);
}

const officeOutline = [
  [-25.58, -44.2],
  [27.4, -44.04],
  [27.28, -5.17],
  [-25.7, -5.32],
];
const yLow = 19.4 * scaleY,
  yCrown = 76.97 * scaleY;

function officeWall(out, start, end, lod) {
  const width = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const count = width > 45 ? 13 : 10;
  const ax = (end[0] - start[0]) / width,
    az = (end[1] - start[1]) / width;
  const yaw = Math.atan2(-az, ax);
  // The footprint winds clockwise in the world view. Local positive Z points outwards.
  const facade = transform(out, yaw, [start[0], 0, start[1]]);
  const body = (x0, y0, z0, x1, y1, z1, slot, tint) => {
    box(facade, slot, [x0, y0, z0], [x1, y1, z1], tint);
  };
  const h = 3.62;
  const base = 23.5;
  if (lod === 0) {
    body(0, yLow, -0.55, width, yCrown, -0.08, 'granite', c.stone);
    for (let j = 0; j < 7; j++) {
      const y = base + 2 * h * j + 0.45;
      face(
        facade,
        'glass',
        [
          [width - 1.9, y, 0.025],
          [1.9, y, 0.025],
          [1.9, y + 1.65, 0.025],
          [width - 1.9, y + 1.65, 0.025],
        ].reverse(),
        c.glass,
      );
    }
    return;
  }
  body(0, yLow, -2.2, 2.4, yCrown, 0.055, 'granite', c.bright);
  body(width - 2.4, yLow, -2.2, width, yCrown, 0.055, 'granite', c.stone);
  body(2.4, yLow, -1.9, width - 2.4, base, 0.018, 'granite', c.stone);
  body(2.4, base + 14 * h - 0.18, -1.9, width - 2.4, yCrown, 0.045, 'granite', c.bright);
  const space = (width - 4.8) / count;
  for (let row = 0; row < 14; row++) {
    const y = base + row * h;
    body(
      2.4,
      y - 0.09,
      -1.9,
      width - 2.4,
      y + 0.94,
      lod > 1 ? 0.29 : 0.12,
      'granite',
      row % 5 === 0 ? c.bright : c.stone,
    );
    body(2.4, y + 2.92, -1.85, width - 2.4, y + h + 0.055, 0.03, 'granite', c.stone);
    const glazing = row % 5 === 4 ? c.highGlass : c.glass;
    if (lod === 1) {
      face(
        facade,
        'glass',
        [
          [2.4, y + 0.92, -0.91],
          [width - 2.4, y + 0.92, -0.91],
          [width - 2.4, y + 2.94, -0.91],
          [2.4, y + 2.94, -0.91],
        ],
        glazing,
      );
      continue;
    }
    body(2.4, y + 0.92, -1.89, width - 2.4, y + 2.94, -0.91, 'glass', glazing);
    for (let bay = 1; bay < count; bay++) {
      const x = 2.4 + space * bay;
      body(x - 0.41, y + 0.94, -1.58, x + 0.41, y + 2.94, -0.16, 'granite', c.bright);
      if (lod === 3)
        body(
          x + space * 0.48 - 0.075,
          y + 0.94,
          -0.94,
          x + space * 0.48 + 0.075,
          y + 2.94,
          -0.82,
          'flashing',
          c.frame,
        );
    }
  }
}

function surveyedShell(out, lod) {
  for (const indices of survey.triangles) {
    const p = indices.map((i) => vertices[i]);
    const low = Math.min(...p.map((v) => v[1])),
      high = Math.max(...p.map((v) => v[1]));
    if (low < yLow + 0.28 && high > yCrown - 0.28 && Math.abs(high - low) > 45) continue;
    if (lod === 1 && high - low < 0.12 && high < 0.7) continue;
    if (high < 0.1) continue;
    if (low > 69.5 && p.some(([x, , z]) => z > -3.4 || x > 28.2 || x < -26.2)) continue;
    const [a, b, d] = p,
      u = b.map((n, i) => n - a[i]),
      v = d.map((n, i) => n - a[i]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const length = Math.hypot(...n);
    if (length < 0.000012 || (lod === 1 && length < 0.3)) continue;
    const top = n[1] > length * 0.68;
    const tint = top ? c.roof : high > yCrown ? c.stone : low < 2.4 ? c.grayStone : c.stone;
    triangle(out, top ? 'roof' : 'granite', p, tint);
  }
}

function foundation(out) {
  for (const r of rings) {
    const ring = ringArea(r) > 0 ? r : [...r].reverse();
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      const gap = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (gap < 0.3) continue;
      const lowA = Math.min(ground(...a), 0) - 1.34,
        lowB = Math.min(ground(...b), 0) - 1.34;
      face(out, 'concrete', [at(b, lowB), at(a, lowA), at(a, 0.18), at(b, 0.18)], c.foundation);
    }
  }
}

function entrance(out, lod) {
  const entry = transform(out, -0.315, [-20.55, 0, 67.94]);
  const groundY = ground(-22, 67);
  const base = Math.max(groundY + 0.15, 0.05);
  if (lod === 0) {
    box(entry, 'glass', [-4.6, base, 0.03], [4.6, 17.3, 0.18], c.glassGreen);
    box(entry, 'granite', [-6.9, 17.3, -0.16], [6.9, 20.6, 2.17], c.bright);
    return;
  }
  const b = (slot, x, y, z, w, h, d, tint) =>
    box(entry, slot, [x, y, z], [x + w, y + h, z + d], tint);
  b('glass', -5.2, base, 0.12, 10.4, 17.82 - base, 0.18, c.glassGreen);
  for (const x of [-7.1, 5.2])
    b('granite', x, base - 0.11, -2.15, 1.9, 19.86 - base, 3.31, c.lightEdge);
  b('granite', -7.13, 17.86, -0.18, 14.28, 1.19, 2.81, c.grayStone);
  b('granite', -7.38, 19.05, -0.88, 14.76, 1.28, 3.83, c.bright);
  b('granite', -7.58, 20.29, -0.98, 15.16, 1.56, 4.18, c.stone);
  b('granite', -7.38, 22.33, -0.83, 14.76, 2.83, 2.57, c.bright);
  b('flashing', -7.38, 25.16, -0.83, 14.76, 0.19, 2.61, c.bronze);
  b('flashing', -5.02, base + 4.4, 0.25, 10.04, 0.48, 3.25, c.metal);
  b('flashing', -4.99, base + 4.87, 0.25, 9.98, 0.16, 3.2, c.frame);
  if (lod >= 2) {
    for (const x of [-7.08, 5.23]) {
      for (let y = base + 0.94; y < 17.8; y += 0.76) {
        face(
          entry,
          'granite',
          [
            [x, y, 1.172],
            [x + 1.85, y, 1.172],
            [x + 1.85, y + 0.038, 1.172],
            [x, y + 0.038, 1.172],
          ],
          c.grayStone,
        );
      }
    }
    for (const x of [-5.09, -2.48, 0, 2.48, 5.02])
      b('flashing', x - 0.072, base, 0.34, 0.14, 17.83 - base, 0.14, c.shadow);
    for (const y of [4.4, 8.6, 13.5])
      b('flashing', -5.2, base + y, 0.33, 10.4, 0.17, 0.13, c.frame);
    for (const x of [-2.32, -1.18, -0.04, 1.1, 2.24])
      b('flashing', x, base, 0.45, 0.11, 3.45, 0.09, c.frame);
    for (const y of [1.16, 3.42]) b('flashing', -2.39, base + y, 0.45, 4.82, 0.13, 0.08, c.frame);
    for (const x of [-5.4, -2, 1.4, 4.8]) {
      const cyl = [
        radialRing(21.78, 0.31, 0.31, 10, [x, 0.42]),
        radialRing(22.49, 0.31, 0.31, 10, [x, 0.42]),
      ];
      loft(entry, 'granite', cyl, c.bright);
    }
    for (let stair = 0; stair < 4; stair++)
      b(
        'concrete',
        -6.37 - stair * 0.21,
        base - 0.18 - stair * 0.157,
        0.15 + stair * 0.57,
        12.74 + stair * 0.42,
        0.17,
        0.63,
        c.pavement,
      );
  }
}

function marketSide(out, lod) {
  const outerX = -27.79;
  const lowerZ = -37.8,
    upperZ = 55.9;
  const zStep = 9.2;
  const sideBand = (lo, hi, slot, tint) =>
    box(out, slot, [outerX - 0.055, lo, lowerZ], [outerX + 0.134, hi, upperZ], tint);
  sideBand(17.35, 18.61, 'glass', c.shadow);
  sideBand(16.86, 17.34, 'granite', c.grayStone);
  sideBand(19.03, 19.57, 'granite', c.bright);
  if (lod >= 2) {
    for (let z = lowerZ + 0.35; z < upperZ; z += zStep) {
      box(out, 'granite', [outerX - 0.18, 3.32, z], [outerX + 0.37, 17.21, z + 0.46], c.grayStone);
    }
    for (let y = 1.05; y < 17.0; y += 0.86) {
      face(
        out,
        'granite',
        [
          [outerX - 0.042, y, lowerZ],
          [outerX - 0.042, y, upperZ],
          [outerX - 0.042, y + 0.025, upperZ],
          [outerX - 0.042, y + 0.025, lowerZ],
        ],
        c.grayStone,
      );
    }
    const notch = [-2.3, 2.3];
    if (lod === 3)
      for (const z of [33.9, 43.5]) {
        for (const h of notch) {
          const low = ground(outerX, z + h);
          beam(
            out,
            'flashing',
            [outerX - 0.1, low + 0.18, z + h],
            [outerX - 0.1, low + 2.46, z + h],
            0.085,
            0.08,
            c.frame,
          );
        }
      }
  }
}

function build(out, lod) {
  if (lod < 2) {
    mass(out, rings[0], 24.9);
    mass(out, rings[1], 21.8);
    cap(out, officeOutline, yCrown, c.roof);
    box(out, 'roof', [-19.1, 75.25, -40.9], [23.15, 78.8, -8.5], c.roof);
  } else {
    surveyedShell(out, lod);
  }
  for (let i = officeOutline.length - 1; i >= 0; i--)
    officeWall(
      out,
      officeOutline[i],
      officeOutline[(i + officeOutline.length - 1) % officeOutline.length],
      lod,
    );
  foundation(out);
  entrance(out, lod);
  if (lod >= 1) marketSide(out, lod);
}
export const tokyoSkyline = (out) => build(out, 0);
export const tokyoDistrict = (out) => build(out, 1);
export const tokyoStreet = (out) => build(out, 2);
export const tokyoCloseup = (out) => build(out, 3);
const recipe = 'tokyo-stock-exchange-model.mjs';
const camera = [-165, 99, 155],
  lookAt = [0, 32, 8];
export const tokyoExchangeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  category: 'landmark',
  build: tokyoCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: plan.geometryBasis,
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.79,
    basis: 'Named OSM envelope of the joint market and office buildings.',
  },
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Tokyo Stock Exchange’s modern monumental market building in Kabutocho, with a granite entrance, set-back glazing, ribbon windows and the office tower behind.',
  camera,
  lookAt,
  sunDirection: [-42, 75, 46],
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => (graph ? [graph] : [])),
  mediumFiContext: {
    scale: 0.55,
    cameraYaw: -0.35,
    focus: { center: [0, 18, 9] },
    groundY: 0,
    far: 1400,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'kabutocho-market-entrance', position: [-61, 14, 102], lookAt: [-17, 18, 62] },
    { name: 'market-and-office-facades', position: [-109, 25, 132], lookAt: [-2, 33, 17] },
    { name: 'office-ribbon-windows', position: [-82, 51, -79], lookAt: [-26, 49, -19] },
    { name: 'roof-and-market-building', position: [91, 149, 102], lookAt: [2, 34, 8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'exchange-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'tokyoSkyline',
    errorMeters: 3.8,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'tokyoDistrict', 1.95],
        ['street', 'tokyoStreet', 0.69],
        ['closeup', 'tokyoCloseup', 0.13],
      ].map(([key, name, errorMeters]) => [key, { export: name, errorMeters, surfaces }]),
    ),
  },
  sourceLicense:
    'Original mesh, with derived open geometric controls from Project PLATEAU, MLIT Japan, and OpenStreetMap contributors under ODbL 1.0. Exterior appearance uses original public-domain and CC0 photographs.',
  limitations: plan.limitations,
};

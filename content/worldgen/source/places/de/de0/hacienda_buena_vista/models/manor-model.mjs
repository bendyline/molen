/** The manor house at Hacienda Buena Vista in November 2023. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const mappedEnvelope = read('map-frame').geometry.polygons[0];
const {
  foundationBottom,
  westThreshold,
  livingFloor,
  mainEaves,
  verandaEaves,
  mainRidge,
  eastEaves,
  eastRidge,
} = plan.section;
const surfaces = {
  masonry: { slot: 'foundation', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  siding: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.85, metallic: 0.08 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  glazing: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47, metallic: 0.02 },
};
const tone = Object.fromEntries(
  Object.entries({
    plaster: 'c4c4ad',
    east: 'c8b8a7',
    base: '9b9a86',
    siding: 'a6b1a5',
    wood: 'd8d9c4',
    deck: 'a79a7c',
    roof: 'a34d41',
    edge: '873f37',
    door: '646b52',
    glazing: '4a5853',
    dark: '46493d',
    stone: '938c78',
  }).map(([name, value]) => [name, rgb(value)]),
);

function face(out, slot, vertices, outward, color = tone[slot]) {
  let normal = normalFor(...vertices);
  if (normal.reduce((sum, n, i) => sum + n * outward[i], 0) < 0) {
    vertices = [...vertices].reverse();
    normal = normalFor(...vertices);
  }
  if (vertices.length === 4) quad(out, slot, vertices, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      vertices,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      color,
    );
}
function slab(out, slot, x0, x1, z0, z1, low, high, color) {
  B(out, slot, (x0 + x1) / 2, low, (z0 + z1) / 2, x1 - x0, high - low, z1 - z0, color);
}
function elevation(axis, coordinate, sign) {
  return axis === 'z'
    ? { at: (u, y, d) => [u, y, coordinate + sign * d], normal: [0, 0, sign] }
    : { at: (u, y, d) => [coordinate + sign * d, y, u], normal: [sign, 0, 0] };
}
function panel(out, slot, side, u0, u1, y0, y1, depth, color) {
  const { at, normal } = side;
  face(
    out,
    slot,
    [at(u0, y0, depth), at(u1, y0, depth), at(u1, y1, depth), at(u0, y1, depth)],
    normal,
    color,
  );
}
function opening(out, side, u, base, w, height, lod, door = false) {
  const a = u - w / 2,
    b = u + w / 2;
  panel(
    out,
    'wood',
    side,
    a - 0.105,
    b + 0.105,
    base - 0.07,
    base + height + 0.12,
    0.042,
    tone.wood,
  );
  panel(out, 'glazing', side, a, b, base, base + height, 0.061, door ? tone.door : tone.glazing);
  if (lod >= 1) {
    if (!door || lod === 1)
      panel(out, 'wood', side, u - 0.027, u + 0.027, base, base + height, 0.086, tone.wood);
    if (!door)
      panel(
        out,
        'wood',
        side,
        a,
        b,
        base + height * 0.53,
        base + height * 0.53 + 0.036,
        0.087,
        tone.wood,
      );
  }
  if (lod >= 2 && door) {
    panel(
      out,
      'glazing',
      side,
      a + 0.1,
      b - 0.1,
      base + height * 0.42,
      base + height - 0.12,
      0.081,
      tone.glazing,
    );
    panel(
      out,
      'wood',
      side,
      u - 0.023,
      u + 0.023,
      base + height * 0.42,
      base + height - 0.12,
      0.089,
      tone.wood,
    );
  }
}
function roof(out, corners, firstRidge, lastRidge, eaves, high) {
  const at = ([x, z], y) => [x, y, z];
  const p = at(firstRidge, high),
    q = at(lastRidge, high);
  face(out, 'roof', [at(corners[0], eaves), at(corners[1], eaves), q, p], [0, 1, 0]);
  face(out, 'roof', [at(corners[2], eaves), at(corners[3], eaves), p, q], [0, 1, 0]);
  for (const [a, b, ridge, normal] of [
    [0, 3, p, [0, 0, -1]],
    [1, 2, q, [0, 0, 1]],
  ]) {
    const vertices = [at(corners[a], eaves), at(corners[b], eaves), ridge];
    face(out, 'roof', vertices, normal, tone.roof);
  }
}
function hippedStrip(out, x0, x1, z0, z1, eave, ridge) {
  const x = (x0 + x1) / 2;
  const offset = Math.min((z1 - z0) * 0.28, (x1 - x0) * 0.56);
  roof(
    out,
    [
      [x0, z0],
      [x0, z1],
      [x1, z1],
      [x1, z0],
    ],
    [x, z0 + offset],
    [x, z1 - offset],
    eave,
    ridge,
  );
}
function westernRoof(out) {
  const x0 = -7.19,
    x1 = 7.19,
    z0 = 0.14,
    z1 = 8.63,
    zMid = (z0 + z1) / 2;
  for (const z of [z0, z1]) {
    face(
      out,
      'roof',
      [
        [x0, mainEaves, z],
        [x1, mainEaves, z],
        [x1, mainRidge, zMid],
        [x0, mainRidge, zMid],
      ],
      [0, 1, 0],
    );
    beam(
      out,
      'roof',
      [x0, mainEaves - 0.055, z],
      [x1, mainEaves - 0.055, z],
      0.17,
      0.13,
      tone.edge,
    );
  }
  for (const [x, sign] of [
    [x0, -1],
    [x1, 1],
  ]) {
    face(
      out,
      'siding',
      [
        [x, mainEaves, z0],
        [x, mainEaves, z1],
        [x, mainRidge, zMid],
      ],
      [sign, 0, 0],
    );
  }
  face(
    out,
    'roof',
    [
      [-8.11, verandaEaves, 10.57],
      [8.11, verandaEaves, 10.57],
      [7.19, mainEaves - 0.065, z1],
      [-7.19, mainEaves - 0.065, z1],
    ],
    [0, 1, 0],
  );
  for (const [xInner, xOuter] of [
    [x0, -8.11],
    [x1, 8.11],
  ]) {
    face(
      out,
      'roof',
      [
        [xOuter, verandaEaves, 1.01],
        [xOuter, verandaEaves, 10.57],
        [xInner, mainEaves - 0.065, z1],
        [xInner, mainEaves - 0.065, 1.01],
      ],
      [0, 1, 0],
    );
  }
  beam(
    out,
    'roof',
    [-8.11, verandaEaves - 0.036, 10.57],
    [8.11, verandaEaves - 0.036, 10.57],
    0.13,
    0.14,
    tone.edge,
  );
}

function warehouse(out, lod) {
  const x0 = -6.75,
    x1 = 6.75,
    zFront = 8.86;
  slab(out, 'masonry', x0, x1, 0.82, 8.26, foundationBottom, livingFloor, tone.plaster);
  slab(out, 'masonry', x0, x1, 8.26, zFront, foundationBottom, westThreshold, tone.base);
  slab(out, 'masonry', x0, x1, 8.26, zFront, westThreshold + 2.0, livingFloor, tone.plaster);
  const west = elevation('z', zFront, 1);
  const portals = [
    [-5.48, 0.48],
    [-0.06, 1.29],
    [5.35, 0.48],
  ];
  let left = x0;
  for (const [x, radius] of portals) {
    slab(
      out,
      'masonry',
      left,
      x - radius,
      8.26,
      zFront,
      westThreshold,
      westThreshold + 2.0,
      tone.plaster,
    );
    const backing = elevation('z', 8.27, 1);
    opening(out, backing, x, westThreshold, radius * 1.89, 1.96, lod, true);
    left = x + radius;
  }
  slab(out, 'masonry', left, x1, 8.26, zFront, westThreshold, westThreshold + 2.0, tone.plaster);
  panel(out, 'masonry', west, x0, x1, livingFloor - 0.19, livingFloor - 0.06, 0.032, tone.base);
  for (const sign of [-1, 1]) {
    const side = elevation('x', sign * x1, sign);
    for (const z of [3.05, 6.72]) opening(out, side, z, 0.81, 0.83, 1.09, lod);
  }
  slab(out, 'masonry', -6.18, 6.18, 9.06, 9.63, -0.65, 0.21, tone.stone);
}

function railing(out, side, start, end, y, bays, lod) {
  const at = (u, h) => side.at(u, h, 0);
  beam(out, 'wood', at(start, y + 0.83), at(end, y + 0.83), 0.095, 0.085, tone.wood);
  beam(out, 'wood', at(start, y + 0.12), at(end, y + 0.12), 0.075, 0.065, tone.wood);
  for (let i = 1; i < bays; i++) {
    const u = start + ((end - start) * i) / bays;
    if (lod === 0) panel(out, 'wood', side, u - 0.04, u + 0.04, y + 0.13, y + 0.8, 0, tone.wood);
    else beam(out, 'wood', at(u, y + 0.11), at(u, y + 0.82), 0.047, 0.048, tone.wood);
  }
}
function upperWest(out, lod) {
  slab(out, 'siding', -6.78, 6.78, 0.82, 8.31, livingFloor, mainEaves, tone.siding);
  slab(out, 'wood', -7.9, 7.9, 0.94, 10.25, livingFloor - 0.2, livingFloor, tone.deck);
  const westWall = elevation('z', 8.31, 1);
  for (const x of [-5.08, -2.47, 0.01, 2.47, 5.08])
    opening(out, westWall, x, livingFloor, 1.14, 2.18, lod, true);
  for (const sign of [-1, 1]) {
    const side = elevation('x', sign * 6.78, sign);
    for (const z of [2.23, 5.12, 7.31]) opening(out, side, z, livingFloor, 0.91, 2.06, lod, true);
  }

  const xPosts = [-7.69, -5.12, -2.55, 0, 2.55, 5.12, 7.69];
  const zPosts = [1.14, 3.96, 6.78, 10.02];
  const railSpacing = [3, 6, 8, 10][lod];
  const post = (x, z) => {
    B(
      out,
      'wood',
      x,
      livingFloor - 0.025,
      z,
      0.14,
      verandaEaves - livingFloor + 0.11,
      0.14,
      tone.wood,
    );
    if (lod >= 2) B(out, 'wood', x, verandaEaves - 0.2, z, 0.22, 0.18, 0.21, tone.wood);
  };
  const west = elevation('z', zPosts.at(-1), 1);
  for (const x of xPosts) post(x, zPosts.at(-1));
  for (let i = 0; i + 1 < xPosts.length; i++)
    railing(out, west, xPosts[i], xPosts[i + 1], livingFloor, railSpacing, lod);
  for (const sign of [-1, 1]) {
    const side = elevation('x', sign * xPosts.at(-1), sign);
    for (const z of zPosts.slice(0, -1)) post(sign * xPosts.at(-1), z);
    for (let i = 0; i + 1 < zPosts.length; i++)
      railing(out, side, zPosts[i], zPosts[i + 1], livingFloor, railSpacing, lod);
  }
  westernRoof(out);
}

function gardenWing(out, lod) {
  slab(out, 'masonry', -7.5, 7.66, -9.65, 1.03, foundationBottom, livingFloor, tone.east);
  slab(out, 'masonry', -7.5, -3.82, -9.65, 0.55, livingFloor, eastEaves, tone.east);
  slab(out, 'masonry', 4.71, 7.66, -9.65, 1.03, livingFloor, eastEaves, tone.east);
  const courtyardX = [-3.82, 4.71];
  const zEast = -9.65;
  const entrance = [-1.12, 1.25];
  for (const [left, right] of [
    [courtyardX[0], entrance[0]],
    [entrance[1], courtyardX[1]],
  ])
    slab(out, 'masonry', left, right, zEast, zEast + 0.58, livingFloor, eastEaves, tone.east);
  slab(
    out,
    'masonry',
    entrance[0],
    entrance[1],
    zEast,
    zEast + 0.58,
    livingFloor + 2.09,
    eastEaves,
    tone.east,
  );
  const gate = elevation('z', zEast + 0.45, -1);
  opening(out, gate, 0.065, livingFloor, 2.03, 2.02, lod, true);
  for (let i = 0; i < 4; i++)
    slab(
      out,
      'masonry',
      -1.56,
      1.66,
      zEast - 1.4 + i * 0.33,
      zEast + 0.035,
      1.35,
      livingFloor - 0.56 + i * 0.14,
      tone.stone,
    );
  const courtyardFloor = livingFloor + 0.019;
  slab(
    out,
    'masonry',
    courtyardX[0],
    courtyardX[1],
    zEast + 0.55,
    0.81,
    livingFloor,
    courtyardFloor,
    tone.stone,
  );
  const south = elevation('x', 4.71, -1);
  const north = elevation('x', -3.82, 1);
  for (const z of [-7.75, -5.17, -2.08]) {
    opening(out, south, z, livingFloor, 0.87, 1.93, lod, true);
    opening(out, north, z, livingFloor + 0.54, 0.88, 1.23, lod);
  }
  const outerNorth = elevation('x', -7.5, -1),
    outerSouth = elevation('x', 7.66, 1);
  for (const z of [-8.01, -5.34, -2.31]) {
    opening(out, outerSouth, z, livingFloor + 0.56, 0.93, 1.24, lod);
    opening(out, outerNorth, z, livingFloor + 0.56, 0.82, 1.19, lod);
  }
  const east = elevation('z', zEast, -1);
  for (const x of [-5.5, 2.93, 6.1]) opening(out, east, x, livingFloor + 0.52, 0.81, 1.25, lod);
  hippedStrip(out, -7.75, -3.28, -9.86, 0.92, eastEaves, eastRidge);
  hippedStrip(out, 4.15, 7.94, -9.86, 1.17, eastEaves, eastRidge - 0.12);
  face(
    out,
    'roof',
    [
      [-4.3, eastEaves, -9.9],
      [5.05, eastEaves, -9.9],
      [5.05, eastEaves + 0.79, -8.15],
      [-4.3, eastEaves + 0.79, -8.15],
    ],
    [0, 1, 0],
  );
  B(out, 'masonry', -5.1, eastRidge - 0.56, -6.75, 0.62, 2.08, 0.61, tone.east);
  B(out, 'masonry', -5.1, eastRidge + 1.29, -6.75, 0.76, 0.19, 0.73, tone.base);
}

function build(out, _frame, lod = 3) {
  warehouse(out, lod);
  upperWest(out, lod);
  gardenWing(out, lod);
}
export const manorSkyline = (out) => build(out, undefined, 0);
export const manorDistrict = (out) => build(out, undefined, 1);
export const manorStreet = (out) => build(out, undefined, 2);
export const manorCloseup = (out) => build(out, undefined, 3);

const recipe = 'manor-model.mjs',
  camera = [-32, 16, 34],
  lookAt = [0, 3.6, 0];
export const manorModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The raised veranda, red zinc roof, masonry warehouse base and open upper courtyard of the Hacienda Buena Vista manor house.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline: mappedEnvelope,
    minimumCoverage: 0.96,
    basis:
      'The native manor outline is identified by the HAER site plan and adjacent mapped service row.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'wood_weatherboard', 'metal_corrugated', 'wood_plain'],
  qaCameras: [
    { name: 'west-veranda-and-storage', position: [-16, 6.8, 24], lookAt: [0, 3.5, 5.5] },
    { name: 'east-garden-entrance', position: [18, 9, -25], lookAt: [0, 3.8, -7.0] },
    { name: 'upper-open-courtyard', position: [-7, 17, -22], lookAt: [0, 4.4, -3.6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-hacienda-buena-vista-manor-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'manorSkyline',
    errorMeters: 0.23,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'manorDistrict', 0.11],
        ['street', 'manorStreet', 0.042],
        ['closeup', 'manorCloseup', 0.013],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Ligocsicnarf89 dedicated the exact November 2023 reference photograph under CC0. OpenStreetMap contributors supply the mapped envelope under ODbL.',
};

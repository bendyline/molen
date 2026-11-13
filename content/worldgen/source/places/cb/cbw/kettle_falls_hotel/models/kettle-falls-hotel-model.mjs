/** Kettle Falls Hotel's timber frame, veranda and roof, in Voyageurs National Park. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const { main: m, wing: w, porch: v } = plan;
const surfaces = {
  siding: { slot: 'wall', graph: 'wood_painted_lap', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_asphalt', roughness: 0.95, metallic: 0 },
  footing: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.91, metallic: 0 },
  pane: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52, metallic: 0.08 },
};
const c = Object.fromEntries(
  Object.entries({
    white: 'd5d1bf',
    shade: 'c4c4b3',
    cream: 'd8d5c6',
    roof: '9c5b4e',
    darkRoof: '885044',
    edge: '67493d',
    sash: 'a46153',
    pane: '52605c',
    glass: '667672',
    base: '938675',
    deck: '9d8c74',
    door: '887061',
  }).map(([name, color]) => [name, rgb(color)]),
);
const lerp = (a, b, t) => a + (b - a) * t;
const screen = { low: 1.73, high: 2.99 };

function grade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v);
  const a = lerp(terrain.heightsMeters[j][i], terrain.heightsMeters[j][i + 1], u - i);
  const b = lerp(terrain.heightsMeters[j + 1][i], terrain.heightsMeters[j + 1][i + 1], u - i);
  return lerp(a, b, v - j) - terrain.modelDatumElevationMeters;
}

function roofTop(out, points, height, tint) {
  const ids = earcut(points.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const p = ids.slice(i, i + 3).map((k) => [points[k][0], height(...points[k]), points[k][1]]);
    if (normalFor(...p)[1] < 0) p.reverse();
    triangle(out, 'roof', p, tint);
  }
}

function band(out, a, b, drop, tint = c.edge) {
  face(out, 'trim', [a, b, [b[0], b[1] - drop, b[2]], [a[0], a[1] - drop, a[2]]], tint);
}

function gableEnd(out, x, eave, ridge, near, far, mid, outward) {
  const p = [
    [x, eave, near],
    [x, ridge, mid],
    [x, eave, far],
  ];
  triangle(out, 'siding', outward < 0 ? p : p.toReversed(), c.white);
}

function roof(out, lod) {
  const left = m.left - 0.29,
    right = m.right + 0.31;
  const front = m.front + 0.29,
    rear = m.back - 0.3,
    mid = 0.07;
  const northEnd = w.back - 0.3;
  const wingLeft = w.left - 0.27,
    wingRight = w.right + 0.26,
    wingMid = (wingLeft + wingRight) / 2;
  const valley = lerp(rear, mid, (w.ridge - m.eave) / (m.ridge - m.eave));
  const backHeight = (_x, z) => lerp(m.eave, m.ridge, (z - rear) / (mid - rear));
  const frontHeight = (_x, z) => lerp(m.ridge, m.eave, (z - mid) / (front - mid));
  roofTop(
    out,
    [
      [left, mid],
      [right, mid],
      [right, front],
      [left, front],
    ],
    frontHeight,
    c.roof,
  );
  roofTop(
    out,
    [
      [left, mid],
      [left, rear],
      [wingMid, valley],
      [wingRight, rear],
      [right, rear],
      [right, mid],
    ],
    backHeight,
    c.darkRoof,
  );
  roofTop(
    out,
    [
      [wingLeft, northEnd],
      [wingLeft, rear],
      [wingMid, valley],
      [wingMid, northEnd],
    ],
    (x) => lerp(m.eave, w.ridge, (x - wingLeft) / (wingMid - wingLeft)),
    c.roof,
  );
  roofTop(
    out,
    [
      [wingMid, northEnd],
      [wingMid, valley],
      [wingRight, rear],
      [wingRight, northEnd],
    ],
    (x) => lerp(w.ridge, m.eave, (x - wingMid) / (wingRight - wingMid)),
    c.darkRoof,
  );
  gableEnd(out, m.right, m.eave, m.ridge, m.front, m.back, mid, 1);
  gableEnd(out, m.left, m.eave, m.ridge, m.front, m.back, mid, -1);
  triangle(
    out,
    'siding',
    [
      [w.left, w.eave, w.back],
      [(w.left + w.right) / 2, w.ridge, w.back],
      [w.right, w.eave, w.back],
    ],
    c.shade,
  );
  band(out, [right, m.eave, front], [left, m.eave, front], 0.16);
  band(out, [wingRight, m.eave, rear], [right, m.eave, rear], 0.16);
  band(out, [wingLeft, m.eave, rear], [wingLeft, m.eave, northEnd], 0.16);
  band(out, [wingRight, m.eave, northEnd], [wingRight, m.eave, rear], 0.16);
  if (lod > 0) {
    for (const x of [left, right]) {
      band(out, [x, m.eave, x === left ? front : rear], [x, m.ridge, mid], 0.14);
      band(out, [x, m.ridge, mid], [x, m.eave, x === left ? rear : front], 0.14);
    }
    band(out, [wingLeft, m.eave, northEnd], [wingMid, w.ridge, northEnd], 0.15);
    band(out, [wingMid, w.ridge, northEnd], [wingRight, m.eave, northEnd], 0.15);
    for (const [x, z, y] of [
      [-8.15, -1.12, 8.1],
      [11.42, 0.81, 8.45],
    ]) {
      box(out, 'footing', [x - 0.26, y, z - 0.24], [x + 0.26, y + 1.29, z + 0.24], c.base);
      box(out, 'footing', [x - 0.33, y + 1.23, z - 0.31], [x + 0.33, y + 1.38, z + 0.31], c.edge);
    }
  }
}

function facadeAt(from, to) {
  const dx = to[0] - from[0],
    dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  const ax = dx / length,
    az = dz / length;
  return (x, y, d) => [from[0] + ax * x + az * d, y, from[1] + az * x - ax * d];
}

function trimPane(out, project, x, y, width, height, lod) {
  const x0 = x - width / 2,
    x1 = x + width / 2;
  const rect = (slot, a, b, c0, d, depth, tint) => {
    face(
      out,
      slot,
      [project(c0, b, depth), project(a, b, depth), project(a, d, depth), project(c0, d, depth)],
      tint,
    );
  };
  rect('trim', x0 - 0.08, y - 0.065, x1 + 0.08, y + height + 0.065, 0.034, c.sash);
  rect('pane', x0 + 0.035, y + 0.04, x1 - 0.035, y + height - 0.045, 0.054, c.pane);
  if (lod < 2) return;
  rect(
    'trim',
    x0 + 0.023,
    y + height * 0.47,
    x1 - 0.023,
    y + height * 0.47 + 0.052,
    0.069,
    c.cream,
  );
  rect('trim', x - 0.025, y + 0.04, x + 0.025, y + height - 0.045, 0.066, c.cream);
  if (lod === 3)
    rect('pane', x + 0.06, y + height * 0.54, x1 - 0.07, y + height - 0.073, 0.058, c.glass);
}

function windows(out, lod) {
  if (lod === 0) return;
  const south = facadeAt([m.right, m.front], [m.left, m.front]);
  const north = facadeAt([w.right, m.back], [m.right, m.back]);
  const east = facadeAt([m.right, m.back], [m.right, m.front]);
  const west = facadeAt([m.left, m.front], [m.left, w.back]);
  const wingBack = facadeAt([m.left, w.back], [w.right, w.back]);
  const wingEast = facadeAt([w.right, w.back], [w.right, m.back]);
  for (let i = 0; i < 9; i++) {
    const x = 2.32 + i * 3.33;
    trimPane(out, south, x, 4.19, 0.88, 1.37, lod);
    if (i !== 4) trimPane(out, south, x, 1.83, 1.02, 1.36, lod);
  }
  for (let i = 0; i < 6; i++) trimPane(out, north, 1.8 + i * 3.73, 4.24, 0.82, 1.25, lod);
  for (const x of [1.63, 4.2]) trimPane(out, east, x, 4.2, 0.84, 1.29, lod);
  for (let i = 0; i < 5; i++) trimPane(out, west, 1.6 + i * 3.15, 4.2, 0.86, 1.29, lod);
  for (const x of [2.25, 6.66]) trimPane(out, wingBack, x, 4.45, 0.89, 1.36, lod);
  for (const x of [1.6, 4.75, 7.6]) trimPane(out, wingEast, x, 4.34, 0.82, 1.3, lod);
  box(
    out,
    'trim',
    [v.stepsCenter - 0.65, m.low, m.front],
    [v.stepsCenter + 0.63, 3.5, m.front + 0.085],
    c.sash,
  );
  box(
    out,
    'trim',
    [v.stepsCenter - 0.51, m.low + 0.12, m.front + 0.08],
    [v.stepsCenter + 0.49, 3.39, m.front + 0.14],
    c.door,
  );
  box(
    out,
    'pane',
    [v.stepsCenter - 0.38, 2.29, m.front + 0.139],
    [v.stepsCenter + 0.36, 3.18, m.front + 0.17],
    c.pane,
  );
}

function leanTo(out, lod) {
  const x0 = m.right - 0.03,
    x1 = m.right + 1.83,
    z0 = -2.34,
    z1 = 1.48;
  box(out, 'siding', [x0, 0.12, z0], [x1, 3.42, z1], c.shade);
  triangle(
    out,
    'siding',
    [
      [x1, 3.42, z0],
      [x0, 3.42, z0],
      [x0, 4.37, z0],
    ],
    c.shade,
  );
  triangle(
    out,
    'siding',
    [
      [x0, 3.42, z1],
      [x1, 3.42, z1],
      [x0, 4.37, z1],
    ],
    c.shade,
  );
  roofTop(
    out,
    [
      [x0 - 0.13, z0 - 0.16],
      [x0 - 0.13, z1 + 0.16],
      [x1 + 0.19, z1 + 0.16],
      [x1 + 0.19, z0 - 0.16],
    ],
    (x) => lerp(4.37, 3.42, (x - x0) / (x1 - x0)),
    c.darkRoof,
  );
  if (lod > 0) box(out, 'trim', [x1 - 0.02, 1.21, -1.05], [x1 + 0.062, 2.75, 0.31], c.sash);
}

function veranda(out, lod) {
  const x0 = m.left - 0.08,
    x1 = m.right + 0.08;
  const edge = v.face + 0.14;
  box(out, 'trim', [x0, m.low - 0.18, m.front - 0.05], [x1, m.low, v.face], c.deck);
  roofTop(
    out,
    [
      [x0 - 0.21, v.roofBack],
      [x0 - 0.21, edge],
      [x1 + 0.21, edge],
      [x1 + 0.21, v.roofBack],
    ],
    (_x, z) => lerp(v.high, v.low, (z - v.roofBack) / (edge - v.roofBack)),
    c.roof,
  );
  band(out, [x1 + 0.2, v.low, edge], [x0 - 0.2, v.low, edge], 0.18, c.sash);
  const count = lod === 0 ? 5 : 10;
  for (let i = 0; i <= count; i++) {
    const x = lerp(x0 + 0.14, x1 - 0.14, i / count);
    const ground = grade(x, v.face);
    box(
      out,
      'footing',
      [x - 0.14, Math.min(ground - 0.2, m.low - 0.38), v.face - 0.3],
      [x + 0.14, m.low - 0.15, v.face - 0.02],
      c.base,
    );
    box(
      out,
      'trim',
      [x - 0.054, m.low, v.face - 0.21],
      [x + 0.054, v.low + 0.03, v.face - 0.095],
      c.cream,
    );
    if (i === count || lod === 0) continue;
    const end = lerp(x0 + 0.14, x1 - 0.14, (i + 1) / count);
    const entry = x < v.stepsCenter && end > v.stepsCenter;
    if (entry) continue;
    box(
      out,
      'trim',
      [x, screen.low - 0.037, v.face - 0.19],
      [end, screen.low + 0.047, v.face - 0.11],
      c.cream,
    );
    if (lod > 1) {
      const middle = (x + end) / 2;
      box(
        out,
        'trim',
        [middle - 0.029, screen.low, v.face - 0.186],
        [middle + 0.029, screen.high, v.face - 0.119],
        c.cream,
      );
      box(out, 'trim', [x, 2.42, v.face - 0.185], [end, 2.455, v.face - 0.118], c.shade);
    }
  }
  const stepGround = grade(v.stepsCenter, v.face + 0.9);
  for (let step = 0; step < 4; step++) {
    const high = lerp(m.low, stepGround + 0.14, step / 4);
    box(
      out,
      'trim',
      [v.stepsCenter - 0.79, high - 0.26, v.face - 0.16 + step * 0.24],
      [v.stepsCenter + 0.79, high, v.face + 0.16 + step * 0.24],
      c.deck,
    );
  }
}

function build(out, lod) {
  box(out, 'footing', [m.left, -0.75, m.back], [m.right, m.low, m.front], c.base);
  box(out, 'siding', [m.left, m.low, m.back], [m.right, m.eave, m.front], c.white);
  box(out, 'siding', [w.left, 0.45, w.back], [w.right, w.eave, m.back - 0.008], c.shade);
  roof(out, lod);
  veranda(out, lod);
  leanTo(out, lod);
  windows(out, lod);
}
export const hotelSkyline = (out) => build(out, 0);
export const hotelDistrict = (out) => build(out, 1);
export const hotelStreet = (out) => build(out, 2);
export const hotelCloseup = (out) => build(out, 3);
const recipe = 'kettle-falls-hotel-model.mjs';
const camera = [-38, 18, 47],
  lookAt = [0, 3.65, -1.85];
export const hotelModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: hotelCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The two-storey white timber Kettle Falls Hotel with a long south veranda, red roof, rear wing and east lean-to.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-25, 36, 27],
  mediumFiContext: {
    scale: 0.87,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Named hotel footprint from OpenStreetMap way 585478820.',
  },
  embeddedCanonicalGraphs: [
    'wood_painted_lap',
    'shingle_asphalt',
    'stone_sandstone_raw',
    'wood_plain',
  ],
  qaCameras: [
    { name: 'south-veranda-and-red-roof', position: [-2.7, 6.9, 35], lookAt: [0.8, 3.8, 3.45] },
    { name: 'rear-wing-and-slope', position: [-34, 14, -34], lookAt: [-3, 4.3, -3.6] },
    { name: 'east-lean-to-and-porch-steps', position: [31, 11, 29], lookAt: [5.3, 3.6, 2.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-hotel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'hotelSkyline',
    errorMeters: 0.9,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'hotelDistrict', 0.41],
        ['street', 'hotelStreet', 0.14],
        ['closeup', 'hotelCloseup', 0.057],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Mapped outline is ODbL. The exact National Park Service aerial is public domain.',
};

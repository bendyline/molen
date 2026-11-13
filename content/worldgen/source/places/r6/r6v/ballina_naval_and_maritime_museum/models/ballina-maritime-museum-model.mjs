/** Ballina Naval and Maritime Museum in the July 2017 Qualla exterior. */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  cleanRing,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const require = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = require('earcut');
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  terrain = read('terrain-grid'),
  [outline] = read('map-frame').geometry.polygons;
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.89, metallic: 0 },
  panel: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.84, metallic: 0.1 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.8, metallic: 0.17 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.16 },
  glass: { slot: 'window', localRef: white, roughness: 0.44, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    tan: 'b8a181',
    lightBrick: 'c2ac88',
    foundation: '9b8c76',
    brickShadow: '9a8268',
    steel: '879a9a',
    darkSteel: '647c80',
    hall: '829596',
    grayRoof: '87999e',
    silver: 'b3c1c0',
    fascia: 'c3c7bd',
    glass: '50686a',
    dark: '3d5357',
    frame: '82918b',
    sign: '6a8271',
    door: '5b6965',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const lerp = (a, b, t) => a + (b - a) * t;

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters,
    v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = [terrain.heightsMeters[j], terrain.heightsMeters[j + 1]];
  return (
    lerp(lerp(a[i], a[i + 1], dx), lerp(b[i], b[i + 1], dx), dz) - terrain.modelDatumElevationMeters
  );
}
function face(out, slot, vertices, expected, tint) {
  let normal = normalFor(...vertices);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    vertices = [...vertices].reverse();
    normal = normalFor(...vertices);
  }
  if (vertices.length === 4) quad(out, slot, vertices, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      vertices,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tint,
    );
}
function edge(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  return {
    length,
    normal: [uz, 0, -ux],
    at: (u, y, d = 0) => [a[0] + ux * u + uz * d, y, a[1] + uz * u - ux * d],
  };
}
function panel(out, wall, slot, a, b, low, high, color, d = 0) {
  face(
    out,
    slot,
    [wall.at(a, low, d), wall.at(b, low, d), wall.at(b, high, d), wall.at(a, high, d)],
    wall.normal,
    color,
  );
}
function glass(out, wall, u, bottom, width, height, lod) {
  const a = u - width / 2,
    b = u + width / 2;
  panel(
    out,
    wall,
    'trim',
    a - 0.08,
    b + 0.08,
    bottom - 0.06,
    bottom + height + 0.07,
    c.fascia,
    0.043,
  );
  panel(out, wall, 'glass', a, b, bottom, bottom + height, c.glass, 0.066);
  if (lod > 0) {
    panel(out, wall, 'trim', u - 0.023, u + 0.023, bottom, bottom + height, c.frame, 0.082);
    panel(
      out,
      wall,
      'trim',
      a,
      b,
      bottom + height * 0.59,
      bottom + height * 0.59 + 0.045,
      c.frame,
      0.084,
    );
  }
  if (lod > 1)
    for (let x = a + 0.15; x < b - 0.1; x += lod === 3 ? 0.17 : 0.33)
      panel(out, wall, 'trim', x, x + 0.018, bottom, bottom + height, c.darkSteel, 0.099);
}

const perimeter = cleanRing(outline);
const area = perimeter.reduce((sum, [x, z], i) => {
  const [a, b] = perimeter[(i + 1) % perimeter.length];
  return sum + x * b - z * a;
}, 0);
if (area < 0) perimeter.reverse();
function shell(out, lod) {
  const cap = earcut(perimeter.flat());
  for (let i = 0; i < cap.length; i += 3)
    face(
      out,
      'roof',
      cap.slice(i, i + 3).map((j) => [perimeter[j][0], 3.12, perimeter[j][1]]),
      up,
      c.grayRoof,
    );
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i],
      b = perimeter[(i + 1) % perimeter.length],
      wall = edge(a, b),
      w = wall.length;
    const low = Math.min(-0.75, ground(...a) - 0.45, ground(...b) - 0.45);
    panel(out, wall, 'brick', 0, w, low, 3.12, i % 4 ? c.tan : c.lightBrick);
    panel(out, wall, 'brick', 0, w, low, 0.32, c.foundation, 0.025);
    if (lod > 0 && w > 2.5) {
      const z = (a[1] + b[1]) / 2;
      if (z > 18) continue;
      if (w > 8.0) {
        for (const u of [w * 0.24, w * 0.5, w * 0.76]) glass(out, wall, u, 1.06, 1.3, 1.38, lod);
      } else glass(out, wall, w / 2, 1.17, 0.91, 1.22, lod);
    }
  }
}
function gable(out, part, lod, tall = false) {
  const [a, b] = part.x,
    [far, near] = part.z,
    x = (a + b) / 2;
  const { eave, ridge } = part,
    slot = tall ? 'panel' : 'brick',
    color = tall ? c.hall : c.tan;
  const points = [
    [a, far],
    [b, far],
    [b, near],
    [a, near],
  ];
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length,
      wall = edge(points[i], points[j]);
    const end = i % 2 === 0;
    const low = tall
      ? Math.min(2.95, ground(...points[i]) - 0.5, ground(...points[j]) - 0.5)
      : 3.02;
    panel(out, wall, slot, 0, wall.length, low, eave, color);
    if (end) {
      const z = i === 0 ? far : near;
      face(
        out,
        slot,
        [
          [a, eave, z],
          [b, eave, z],
          [x, ridge, z],
        ],
        wall.normal,
        color,
      );
      beamPath(
        out,
        'trim',
        [
          [a - 0.31, eave, z],
          [x, ridge, z],
          [b + 0.31, eave, z],
        ],
        0.14,
        0.17,
        c.fascia,
      );
      if (!tall && lod > 1 && near > 22 && z === near)
        panel(
          out,
          wall,
          'trim',
          wall.length / 2 - 0.7,
          wall.length / 2 + 0.7,
          eave + 0.31,
          eave + 0.64,
          c.fascia,
          0.058,
        );
    }
    if (tall && lod > 1) {
      for (let u = 0.58; u < wall.length - 0.25; u += lod === 3 ? 0.61 : 1.18)
        panel(out, wall, 'trim', u, u + 0.023, 3.24, eave - 0.22, c.darkSteel, 0.021);
    }
  }
  for (const edgeX of [a - 0.35, b + 0.35]) {
    face(
      out,
      'roof',
      [
        [edgeX, eave, far - 0.31],
        [edgeX, eave, near + 0.35],
        [x, ridge, near + 0.35],
        [x, ridge, far - 0.31],
      ],
      up,
      c.grayRoof,
    );
    if (lod > 0)
      beam(
        out,
        'trim',
        [edgeX, eave, far - 0.31],
        [edgeX, eave, near + 0.35],
        0.16,
        0.18,
        c.silver,
      );
    if (lod > 1)
      for (let z = far + 0.6; z < near; z += lod === 3 ? 1.23 : 2.35)
        beam(out, 'roof', [edgeX, eave + 0.034, z], [x, ridge + 0.037, z], 0.034, 0.029, c.silver);
  }
}
function entry(out, lod) {
  const wall = edge([14.8, 22.6], [-12.9, 22.6]);
  for (const [x, w, h] of [
    [-9.9, 1.35, 1.48],
    [-4.25, 1.62, 1.68],
    [1.9, 2.27, 2.27],
    [5.7, 2.22, 1.81],
  ]) {
    glass(out, wall, 14.8 - x, h > 2 ? 0.13 : 0.77, w, h, lod);
  }
  box(out, 'trim', -7.05, 2.12, 22.64, 1.48, 0.26, 0.058, c.sign);
  for (const x of [0.28, 3.62, 7.0])
    box(out, 'brick', x, -0.27, 22.92, 0.35, 3.36, 0.45, c.lightBrick);
  box(
    out,
    'brick',
    2.62,
    Math.min(-0.45, ground(2.62, 23.62) - 0.25),
    23.21,
    9.78,
    0.51,
    1.55,
    c.foundation,
  );
}
function awning(out, lod) {
  const {
    x: [a, b],
    z: [far, near],
    eave,
    rise,
  } = plan.section.canopy;
  const n = [6, 9, 14, 18][lod];
  const section = Array.from({ length: n + 1 }, (_, i) => [
    lerp(a, b, i / n),
    eave + rise * Math.sin((Math.PI * i) / n),
  ]);
  for (let i = 0; i < n; i++) {
    const [x, y] = section[i],
      [w, h] = section[i + 1];
    face(
      out,
      'roof',
      [
        [x, y, far],
        [w, h, far],
        [w, h, near],
        [x, y, near],
      ],
      up,
      c.steel,
    );
  }
  for (const z of [far, near]) {
    beamPath(
      out,
      'trim',
      section.map(([x, y]) => [x, y - 0.09, z]),
      0.095,
      0.12,
      c.silver,
    );
    for (const x of [a + 0.18, b - 0.18]) {
      const bottom = ground(x, z) - 0.24;
      box(out, 'trim', x, bottom, z, 0.12, eave - bottom + 0.12, 0.13, c.steel);
    }
    if (lod > 1)
      for (let i = 2; i < n - 1; i += 2) {
        const [x, y] = section[i],
          [w, h] = section[i - 1];
        beam(out, 'trim', [x, y - 0.1, z], [w, h - 0.25, z], 0.045, 0.043, c.silver);
      }
  }
  box(out, 'trim', (a + b) / 2, eave - 0.27, near - 0.07, b - a, 0.12, 0.19, c.silver);
  if (lod > 0) box(out, 'trim', (a + b) / 2, eave - 0.66, near - 0.09, 3.54, 0.3, 0.12, c.sign);
}
function build(out, lod) {
  shell(out, lod);
  gable(out, plan.section.hall, lod, true);
  gable(out, plan.section.entrance, lod);
  gable(out, plan.section.link, lod);
  entry(out, lod);
  awning(out, lod);
  if (lod > 0)
    for (const [x, z] of [
      [-2.3, -11.8],
      [2.05, -5.8],
      [-4.9, 13.2],
    ]) {
      const low = z > 0 ? 5.2 : 8.9;
      box(out, 'trim', x, low, z, 0.27, 0.48, 0.27, c.silver);
      box(out, 'trim', x, low + 0.43, z, 0.36, 0.11, 0.36, c.fascia);
    }
}
export const museumSkyline = (out) => build(out, 0);
export const museumDistrict = (out) => build(out, 1);
export const museumStreet = (out) => build(out, 2);
export const museumCloseup = (out) => build(out, 3);

const recipe = 'ballina-maritime-museum-model.mjs',
  camera = [-49, 22, 61],
  lookAt = [0, 4.1, 2];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'museumDistrict', 0.35],
    ['street', 'museumStreet', 0.12],
    ['closeup', 'museumCloseup', 0.038],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const museumModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces,
  build: museumCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Buff brick entrance gables, gray metal roofing, a curved entrance canopy and the taller corrugated raft hall at the Ballina Naval and Maritime Museum.',
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
    outline,
    minimumCoverage: 0.9,
    basis: 'Named museum footprint from OpenStreetMap, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 2.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick', 'metal_corrugated', 'metal_standing_seam', 'metal_painted'],
  qaCameras: [
    { name: 'regatta-entry-gables-and-canopy', position: [-29, 5.5, 62], lookAt: [1.6, 4.3, 14.0] },
    {
      name: 'side-link-and-corrugated-raft-hall',
      position: [49, 13.9, 28],
      lookAt: [2.4, 4.8, 2.0],
    },
    { name: 'rear-roof-and-service-elevation', position: [-39, 18, -51], lookAt: [0, 4, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-ballina-maritime-museum-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'museumSkyline',
    errorMeters: 0.77,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint © OpenStreetMap contributors, ODbL 1.0. Exact first-party CC0 Qualla exterior photograph.',
};

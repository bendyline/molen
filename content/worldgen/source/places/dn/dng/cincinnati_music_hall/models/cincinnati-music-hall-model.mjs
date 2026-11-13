/** The post-restoration red-brick exterior of Cincinnati Music Hall on Elm Street. */
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
const { bodyTop, roofs, towerCenters, towerSize, towerTop, towerPeak, roseCenter, roseRadius } =
  plan.section;
const white = 'palette:#ffffff',
  up = [0, 1, 0];
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.91, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.87, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.84, metallic: 0 },
  trim: { slot: 'trim', graph: 'metal_painted', roughness: 0.71, metallic: 0.18 },
  glass: { slot: 'window', localRef: white, roughness: 0.48, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    red: 'bd705e',
    bay: 'b76451',
    oldBrick: 'ad6454',
    brickShade: '915745',
    brickBand: '735b58',
    buff: 'd3be9b',
    base: 'afa492',
    slate: '626d6a',
    stripe: '84665b',
    trim: '727974',
    glass: '50616b',
    blue: '647783',
    dark: '3e4a51',
    roof: '777971',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const lerp = (a, b, t) => a + (b - a) * t;

function ground(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const [a, b] = [terrain.heightsMeters[j], terrain.heightsMeters[j + 1]];
  return (
    lerp(lerp(a[i], a[i + 1], dx), lerp(b[i], b[i + 1], dx), dz) - terrain.modelDatumElevationMeters
  );
}

function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
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
    at: (u, y, offset = 0) => [a[0] + ux * u + uz * offset, y, a[1] + uz * u - ux * offset],
  };
}

function rect(out, wall, slot, a, b, low, high, color, depth = 0) {
  const { at, normal } = wall;
  face(
    out,
    slot,
    [at(a, low, depth), at(b, low, depth), at(b, high, depth), at(a, high, depth)],
    normal,
    color,
  );
}
const frontEdge = (x0, x1, z) => edge([x1, z], [x0, z]);

function arch(out, wall, u, y, width, height, lod, { pointed = false, detail = true } = {}) {
  const r = width / 2,
    rise = pointed ? width * 0.77 : r,
    shoulder = y + height - rise;
  const samples = lod < 2 ? 4 : 8,
    points = [];
  for (let i = 0; i <= samples; i++) {
    const a = (Math.PI * i) / samples;
    points.push([u + r * Math.cos(a), shoulder + rise * Math.sin(a)]);
  }
  rect(out, wall, 'glass', u - r, u + r, y, shoulder, c.dark, 0.025);
  for (let i = 1; i < points.length - 1; i++) {
    face(
      out,
      'glass',
      [points[0], points[i], points[i + 1]].map((p) => wall.at(...p, 0.025)),
      wall.normal,
      c.glass,
    );
  }
  if (lod > 0 && detail) {
    if (lod > 1) {
      beamPath(
        out,
        'stone',
        points.map((p) => wall.at(...p, 0.1)),
        0.13,
        0.15,
        c.buff,
      );
      rect(out, wall, 'stone', u - r - 0.18, u + r + 0.18, y - 0.15, y, c.buff, 0.12);
      rect(out, wall, 'trim', u - 0.038, u + 0.038, y, shoulder + rise * 0.8, c.trim, 0.07);
    } else {
      rect(out, wall, 'stone', u - r - 0.1, u + r + 0.1, y - 0.12, y, c.buff, 0.06);
    }
  }
}

const footprint = cleanRing(outline);
if (
  footprint.reduce((sum, [x, z], i) => {
    const [xx, zz] = footprint[(i + 1) % footprint.length];
    return sum + x * zz - z * xx;
  }, 0) < 0
)
  footprint.reverse();

function body(out, lod) {
  const floor = -2.42;
  const cap = earcut(footprint.flat());
  for (let i = 0; i < cap.length; i += 3) {
    const ring = cap.slice(i, i + 3).map((index) => footprint[index]);
    face(
      out,
      'slate',
      ring.map(([x, z]) => [x, bodyTop, z]),
      up,
      c.roof,
    );
  }
  for (let j = 0; j < footprint.length; j++) {
    const a = footprint[j],
      b = footprint[(j + 1) % footprint.length],
      wall = edge(a, b),
      length = wall.length;
    rect(out, wall, 'brick', 0, length, floor, bodyTop, j % 5 === 1 ? c.oldBrick : c.red);
    if (length < 0.45) continue;
    const central =
      Math.min(a[0], b[0]) > -19 && Math.max(a[0], b[0]) < 19 && Math.min(a[1], b[1]) > 10;
    if (central) continue;
    rect(out, wall, 'stone', 0, length, floor, 0.75, c.base, 0.045);
    rect(out, wall, 'brick', 0, length, 17.5, bodyTop + 0.24, c.brickShade, 0.09);
    if (lod === 0 && length < 9) continue;
    for (const y of lod === 0 ? [7.0, 12.4] : [4.82, 7.0, 11.17, 13.58, 16.38]) {
      rect(out, wall, 'stone', 0, length, y, y + 0.13, c.buff, 0.055);
    }
    if (length < 3.6) continue;
    const mainStreet = Math.min(a[1], b[1]) > 12 && wall.normal[2] > 0.5;
    const count = Math.max(1, Math.round(length / (lod === 0 ? 8.4 : mainStreet ? 3.1 : 4.7)));
    for (let i = 0; i < count; i++) {
      const x = (length * (i + 0.5)) / count,
        width = Math.min(1.45, (length * 0.56) / count);
      if (lod === 0) {
        rect(out, wall, 'glass', x - width / 2, x + width / 2, 9.2, 14.2, c.glass, 0.023);
      } else {
        arch(out, wall, x, 12.76, width, 3.08, lod, { detail: mainStreet });
        if (lod > 1 || mainStreet)
          arch(out, wall, x, 7.47, width, 3.02, lod, { detail: mainStreet });
        if (lod > 1) arch(out, wall, x, 2.1, width * 0.92, 2.55, lod, { detail: mainStreet });
      }
    }
  }
}

function gabledRoof(out, roof, lod) {
  const alongX = roof.axis === 'x';
  const [a, b] = alongX ? roof.x : roof.z;
  const [left, right] = alongX ? roof.z : roof.x;
  const mid = (left + right) / 2,
    eave = roof.eave,
    ridge = roof.ridge;
  const point = (u, y, t) => (alongX ? [t, y, u] : [u, y, t]);
  const lower = Math.min(bodyTop, eave);
  for (const outside of [left, right]) {
    const sign = outside === left ? -1 : 1;
    if (eave > lower) {
      face(
        out,
        'brick',
        [
          point(outside, lower, a),
          point(outside, lower, b),
          point(outside, eave, b),
          point(outside, eave, a),
        ],
        alongX ? [0, 0, sign] : [sign, 0, 0],
        c.red,
      );
    }
    const steps = lod === 0 ? [0, 1] : [0, 0.34, 0.39, 0.67, 0.72, 1];
    for (let i = 1; i < steps.length; i++) {
      const u = steps[i - 1],
        v = steps[i],
        p = (s, t) => point(lerp(outside, mid, s), lerp(eave, ridge, s), t);
      face(
        out,
        'slate',
        [p(u, a), p(u, b), p(v, b), p(v, a)],
        up,
        i === 2 || i === 4 ? c.stripe : c.slate,
      );
    }
  }
  for (const t of [a, b]) {
    const expected = alongX ? [t === a ? -1 : 1, 0, 0] : [0, 0, t === a ? -1 : 1];
    if (eave > lower) {
      face(
        out,
        'brick',
        [
          point(left, lower, t),
          point(right, lower, t),
          point(right, eave, t),
          point(left, eave, t),
        ],
        expected,
        c.red,
      );
    }
    const gable = [point(left, eave, t), point(mid, ridge, t), point(right, eave, t)];
    face(out, 'brick', gable, expected, c.bay);
    if (lod > 0) beamPath(out, 'stone', gable, 0.18, 0.24, c.base);
  }
  if (lod > 0)
    beam(
      out,
      'slate',
      point(mid, ridge + 0.05, a),
      point(mid, ridge + 0.05, b),
      0.15,
      0.19,
      c.slate,
    );
}

function frontTower(out, x, lod) {
  const z = 14.55,
    size = towerSize,
    half = size / 2;
  box(out, 'brick', x, -1.28, z, size, towerTop + 1.28, size, c.bay);
  for (const [y, width, thick] of [
    [0.26, size + 0.12, 0.6],
    [7.02, size + 0.22, 0.14],
    [12.1, size + 0.26, 0.16],
    [20.13, size + 0.25, 0.2],
    [towerTop - 0.41, size + 0.54, 0.45],
  ]) {
    box(
      out,
      y > 25 ? 'brick' : 'stone',
      x,
      y,
      z,
      width,
      thick,
      width,
      y > 25 ? c.brickShade : c.buff,
    );
  }
  const front = frontEdge(x - half, x + half, z + half);
  for (const u of lod === 0 ? [half] : [half - 1.63, half, half + 1.63]) {
    arch(out, front, u, 21.48, 1.16, 4.26, lod);
  }
  if (lod > 0) arch(out, front, half, 14.15, 1.31, 3.77, lod);
  const corners = [
    [x - half - 0.29, z - half - 0.29],
    [x - half - 0.29, z + half + 0.29],
    [x + half + 0.29, z + half + 0.29],
    [x + half + 0.29, z - half - 0.29],
  ];
  const apex = [x, towerPeak, z];
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i],
      q = corners[(i + 1) % corners.length];
    const a = [p[0], towerTop, p[1]],
      b = [q[0], towerTop, q[1]];
    const breaks = lod ? [0, 0.43, 0.49, 0.74, 0.8, 1] : [0, 1];
    const point = (v, t) => v.map((n, axis) => lerp(n, apex[axis], t));
    for (let j = 1; j < breaks.length; j++) {
      const l = breaks[j - 1],
        h = breaks[j],
        pts = [point(a, l), point(b, l), point(b, h)];
      if (h < 1) pts.push(point(a, h));
      face(out, 'slate', pts, up, j === 2 || j === 4 ? c.stripe : c.slate);
    }
  }
}

function rose(out, center, radius, lod, semicircle = false) {
  const [x, y, z] = center,
    span = semicircle ? Math.PI : 2 * Math.PI;
  const count = lod === 0 ? 12 : lod === 1 ? 20 : 32;
  const ring = (r, offset = 0) =>
    Array.from({ length: count + 1 }, (_, i) => {
      const a = (span * i) / count;
      return [x + r * Math.cos(a), y + r * Math.sin(a), z + offset];
    });
  const pane = ring(radius);
  for (let i = 1; i < pane.length; i++)
    face(out, 'glass', [center, pane[i - 1], pane[i]], [0, 0, 1], i % 6 < 3 ? c.dark : c.glass);
  const inner = ring(radius, 0.04),
    outer = ring(radius + 0.24, 0.06);
  for (let i = 1; i < inner.length; i++) {
    face(out, 'stone', [inner[i - 1], inner[i], outer[i], outer[i - 1]], [0, 0, 1], c.buff);
  }
  if (lod < 1) return;
  const petals = semicircle ? 5 : 8;
  for (let i = 0; i < petals; i++) {
    const a = (span * (i + 0.5)) / petals;
    const point = (r, da = 0) => [x + r * Math.cos(a + da), y + r * Math.sin(a + da), z + 0.055];
    const path =
      lod < 2
        ? [point(radius * 0.12), point(radius * 0.88)]
        : [
            point(radius * 0.18),
            point(radius * 0.54, -0.2),
            point(radius * 0.82),
            point(radius * 0.54, 0.2),
            point(radius * 0.18),
          ];
    if (lod < 2) beam(out, 'trim', path[0], path[1], 0.095, 0.07, c.trim);
    else beamPath(out, 'trim', path, 0.11, 0.09, c.trim);
  }
}

function corbels(out, left, right, y, z, lod) {
  if (lod < 1) return;
  const step = lod === 1 ? 1.13 : 0.66;
  for (let x = left; x <= right; x += step) {
    box(out, 'brick', x, y, z, 0.28, 0.48, 0.29, c.brickShade);
  }
}

function elmStreet(out, lod) {
  const w = frontEdge(-12.0, 12.0, 17.49);
  const portal = frontEdge(-12, 12, 17.57);
  for (const y of [4.99, 7.1, 10.94, 15.51])
    rect(out, w, 'stone', 0, w.length, y, y + 0.18, c.buff, 0.07);
  rose(out, roseCenter, roseRadius, lod);
  const crown = [
    [-5.26, 22.08, 15.49],
    [-5.68, 27.25, 15.49],
    [-4.3, 30.5, 15.49],
    [-0.12, 34.65, 15.49],
    [4.14, 30.5, 15.49],
    [5.49, 27.25, 15.49],
    [5.1, 22.08, 15.49],
  ];
  if (lod > 0) beamPath(out, 'stone', crown, 0.2, 0.13, c.buff);
  for (const u of [2.8, 7.4, 12, 16.6, 21.2]) {
    if (lod === 0) rect(out, portal, 'glass', u - 0.95, u + 0.95, 0.69, 4.5, c.dark, 0.035);
    else arch(out, portal, u, 0.72, 2.63, 4.51, lod);
    if (lod > 0) {
      arch(out, w, u, 7.1, 1.39, 3.14, lod);
      arch(out, w, u, 11.9, 1.66, 4.33, lod, { pointed: true });
    }
  }
  box(out, 'brick', 0, -1.2, 16.48, 24.03, 6.58, 2.05, c.bay);
  box(out, 'stone', 0, 5.43, 16.98, 24.33, 0.66, 2.41, c.buff);
  box(out, 'stone', 0, 6.09, 17.65, 24.33, 0.22, 0.35, c.buff);
  if (lod > 1) {
    for (const x of [-11.27, -6.9, -2.3, 2.3, 6.9, 11.27]) {
      box(out, 'brick', x, 0.4, 17.57, 0.72, 4.37, 0.51, c.bay);
      box(out, 'stone', x, 4.65, 17.7, 0.83, 0.32, 0.58, c.buff);
    }
  }
  const street = ground(0, 19);
  for (let i = 0; i < 3; i++)
    box(
      out,
      'stone',
      0,
      street - 0.03 + 0.19 * i,
      18.02 - 0.24 * i,
      24.55 - i * 0.19,
      0.19,
      2.4 - 0.31 * i,
      c.base,
    );
  if (lod > 1) {
    for (let x = -11.6; x <= 11.6; x += lod === 3 ? 0.49 : 0.88) {
      box(out, 'stone', x, 6.28, 17.65, 0.19, 0.69, 0.21, c.buff);
    }
    box(out, 'stone', 0, 6.92, 17.65, 24.33, 0.2, 0.33, c.buff);
  }
  corbels(out, -11.8, 11.8, 5.1, 17.64, lod);
  for (const [center, faceZ] of [
    [-47.35, 18.14],
    [45.4, 18.67],
  ]) {
    rose(out, [center, 23.49, faceZ], 2.27, lod, true);
    if (lod > 0) {
      const wing = frontEdge(center - 5.2, center + 5.2, faceZ - 0.11);
      for (const u of [2.0, 5.2, 8.4])
        arch(out, wing, u, 18.15, 1.55, 3.91, lod, { pointed: true });
    }
    corbels(out, center - 7.88, center + 7.88, 18.48, faceZ - 0.09, lod);
  }
}

function build(out, lod) {
  body(out, lod);
  for (const roof of roofs) gabledRoof(out, roof, lod);
  for (const x of towerCenters) frontTower(out, x, lod);
  elmStreet(out, lod);
  if (lod > 0) {
    for (const [x, z, y] of [
      [-20, -43, 18.6],
      [20.5, -42, 18.8],
      [-46, -40, 24.0],
      [47.2, -44, 24.7],
    ]) {
      box(out, 'brick', x, y - 0.64, z, 1.6, 3.12, 1.75, c.oldBrick);
      box(out, 'stone', x, y + 2.45, z, 1.83, 0.21, 2.0, c.base);
    }
  }
}
export const hallSkyline = (out) => build(out, 0);
export const hallDistrict = (out) => build(out, 1);
export const hallStreet = (out) => build(out, 2);
export const hallCloseup = (out) => build(out, 3);
const recipe = 'cincinnati-music-hall-model.mjs';
const camera = [-171, 88, 181],
  lookAt = [0, 18.4, -19.0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'hallDistrict', 0.43],
    ['street', 'hallStreet', 0.16],
    ['closeup', 'hallCloseup', 0.046],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const musicHallModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: hallCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Cincinnati Music Hall’s red-brick Elm Street front, sandstone bands, great rose window, paired pointed towers and lower exhibition wings.',
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
    minimumCoverage: 0.92,
    basis: 'Named OpenStreetMap Music Hall footprint, ODbL 1.0.',
  },
  mediumFiContext: {
    scale: 2.7,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['brick', 'stone_sandstone_raw', 'slate', 'metal_painted'],
  qaCameras: [
    { name: 'elm-street-rose-and-twin-towers', position: [-22, 18, 100], lookAt: [0, 18, 13] },
    { name: 'south-wing-brick-and-slate', position: [-87, 21, 74], lookAt: [-31, 15.5, 11] },
    { name: 'rear-exhibition-roofs', position: [98, 56, -123], lookAt: [0, 13, -28] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-cincinnati-music-hall-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'hallSkyline',
    errorMeters: 0.96,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Footprint and parts © OpenStreetMap contributors, ODbL 1.0. Two exact CC0 Qualla photographs and one exact public-domain detail.',
};

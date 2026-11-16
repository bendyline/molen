/** The Queen Anne Executive Mansion on North Blount Street, Raleigh. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (file) => JSON.parse(readFileSync(new URL(`../${file}.json`, import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outline] = read('map-frame').geometry.polygons;
const q = plan.section;
const up = [0, 1, 0];
const west = [-1, 0, 0];
const east = [1, 0, 0];
const north = [0, 0, -1];
const south = [0, 0, 1];
const mix = (a, b, t) => a + (b - a) * t;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.96, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.89, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.89, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.42, metallic: 0.09 },
};
const color = Object.fromEntries(
  Object.entries({
    red: '996e58',
    redLight: 'ac7e68',
    redDark: '8d6252',
    redWarm: 'a8775d',
    gray: '565b64',
    grayDark: '474c56',
    grayBlue: '626b78',
    redSlate: '845b52',
    slateLight: '787886',
    tan: 'a89981',
    marble: 'beb8a8',
    sand: 'a08a70',
    ivory: 'c5b89f',
    paintShade: '8b7a65',
    tanLight: 'd2c5af',
    door: '544638',
    glass: '53646e',
    glassDark: '444e54',
  }).map(([name, hex]) => [name, rgb(hex)]),
);

function panel(out, slot, points, normal, tint) {
  const facing = normalFor(...points).reduce((sum, x, i) => sum + x * normal[i], 0);
  const ordered = facing > 0 ? points : points.toReversed();
  if (ordered.length === 4) face(out, slot, ordered, tint);
  else triangle(out, slot, ordered, tint);
}

function wallFace(out, point, slot, x0, x1, y0, y1, d, normal, tint) {
  panel(
    out,
    slot,
    [point(x0, y0, d), point(x1, y0, d), point(x1, y1, d), point(x0, y1, d)],
    normal,
    tint,
  );
}

function localGrade(x, z) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = terrain.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    terrain.modelDatumElevationMeters
  );
}

function plinth(out) {
  const low = 1.11;
  const winding = Math.sign(
    outline.reduce((sum, [x, z], i) => {
      const k = outline[(i + 1) % outline.length];
      return sum + x * k[1] - z * k[0];
    }, 0),
  );
  const point = ([x, z], y) => [x, y, z];
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    panel(
      out,
      'stone',
      [
        point(a, localGrade(...a) - 0.43),
        point(b, localGrade(...b) - 0.43),
        point(b, low),
        point(a, low),
      ],
      [(b[1] - a[1]) * winding, 0, (a[0] - b[0]) * winding],
      i % 4 === 0 ? color.sand : color.tan,
    );
  }
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3) {
    panel(
      out,
      'stone',
      indices.slice(i, i + 3).map((j) => point(outline[j], low)),
      up,
      color.tan,
    );
  }
}

function hip(out, x0, x1, z0, z1, y, ridge, insetX, insetZ, lod, banded = true) {
  const edge = [
    [x0, y, z0],
    [x1, y, z0],
    [x1, y, z1],
    [x0, y, z1],
  ];
  const peak = [
    [x0 + insetX, ridge, z0 + insetZ],
    [x1 - insetX, ridge, z0 + insetZ],
    [x1 - insetX, ridge, z1 - insetZ],
    [x0 + insetX, ridge, z1 - insetZ],
  ];
  const p = (i, t) => edge[i].map((v, k) => mix(v, peak[i][k], t));
  for (let i = 0; i < edge.length; i++) {
    const j = (i + 1) % edge.length;
    panel(
      out,
      'slate',
      [edge[i], edge[j], peak[j], peak[i]],
      up,
      i % 2 ? color.grayBlue : color.gray,
    );
    if (!banded || lod === 0) continue;
    for (const [t, tint] of [
      [0.22, color.redSlate],
      [0.46, color.slateLight],
      [0.71, color.redSlate],
    ]) {
      const shift = (i, t) => {
        const a = p(i, t);
        a[1] += 0.022;
        return a;
      };
      panel(
        out,
        'slate',
        [shift(i, t), shift(j, t), shift(j, t + 0.028), shift(i, t + 0.028)],
        up,
        tint,
      );
    }
  }
  panel(out, 'slate', peak, up, color.grayDark);
}

function gable(out, x0, x1, z, w, eave, ridge, lod) {
  const low = z - w / 2,
    high = z + w / 2;
  for (const side of [low, high]) {
    panel(
      out,
      'slate',
      [
        [x0 - 0.33, eave, side],
        [x1, eave, side],
        [x1, ridge, z],
        [x0 - 0.33, ridge, z],
      ],
      up,
      color.gray,
    );
    if (lod === 0) continue;
    for (const [f, tint] of [
      [0.23, color.redSlate],
      [0.44, color.slateLight],
    ]) {
      const p = (x, t) => [x, mix(eave, ridge, t) + 0.028, mix(side, z, t)];
      panel(
        out,
        'slate',
        [p(x0 - 0.3, f), p(x1, f), p(x1, f + 0.035), p(x0 - 0.3, f + 0.035)],
        up,
        tint,
      );
    }
  }
  for (const [x, normal] of [
    [x0, west],
    [x1, east],
  ]) {
    panel(
      out,
      'brick',
      [
        [x, eave, low],
        [x, eave, high],
        [x, ridge - 0.06, z],
      ],
      normal,
      color.redLight,
    );
  }
  const f = x0 - 0.34;
  for (const end of [low, high]) {
    panel(
      out,
      'timber',
      [
        [f, eave - 0.16, end],
        [f, ridge - 0.13, z],
        [f, ridge + 0.03, z],
        [f, eave + 0.04, end],
      ],
      west,
      color.paintShade,
    );
  }
}

function pane(out, point, axis, y, w, h, normal, lod, attic = false) {
  const left = axis - w / 2,
    right = axis + w / 2;
  const wall = (slot, a, b, bottom, top, d, tint) =>
    wallFace(out, point, slot, a, b, bottom, top, d, normal, tint);
  if (lod === 0) {
    wall('glass', left, right, y, y + h, 0.033, color.glass);
    return;
  }
  wall('timber', left - 0.11, right + 0.11, y - 0.08, y + h + 0.11, 0.016, color.paintShade);
  wall('glass', left, right, y, y + h, 0.033, color.glass);
  wall('stone', left - 0.16, right + 0.16, y - 0.14, y + 0.025, 0.053, color.tan);
  const bars = attic ? [axis] : [left + 0.08, axis, right - 0.08];
  for (const a of bars)
    wall('timber', a - 0.036, a + 0.036, y + 0.02, y + h - 0.04, 0.056, color.ivory);
  if (lod >= 1)
    for (const f of [0.48, 0.72])
      wall('timber', left, right, y + h * f - 0.029, y + h * f + 0.029, 0.057, color.tanLight);
}

function volume(out, x0, x1, z0, z1, y, top, tint) {
  box(out, 'brick', [x0, y, z0], [x1, top, z1], tint);
}

const westFace = (x) => (z, y, d) => [x - d, y, z];
const eastFace = (x) => (z, y, d) => [x + d, y, z];
const sideFace = (z, sign) => (x, y, d) => [x, y, z + sign * d];

function mainHouse(out, lod) {
  const [floor, , eave] = q.levelHeights;
  volume(out, q.westWall, 12.8, -17.95, 12.05, floor, eave, color.red);
  hip(out, -15.15, 13.43, -18.54, 12.61, eave, 16.77, 6.85, 8.75, lod);
  volume(out, -9.32, 6.0, 11.7, 22.91, floor, 9.1, color.redWarm);
  hip(out, -9.81, 6.45, 11.57, 23.37, 9.1, 12.95, 3.65, 3.65, lod);
  volume(out, -5.15, 4.53, -23.37, -17.75, floor, 9.4, color.redWarm);
  hip(out, -5.65, 4.96, -23.92, -17.42, 9.4, 12.72, 3.1, 2.5, lod);
  volume(out, 12.45, 19.96, -0.32, 7.6, floor, 9.25, color.redDark);
  hip(out, 12.2, 20.45, -0.84, 8.17, 9.25, 12.04, 3.02, 2.9, lod);
  for (const [x, z] of [
    [-6.5, -14.5],
    [3.5, -10.7],
    [7.9, 7.9],
  ]) {
    volume(out, x - 0.61, x + 0.62, z - 0.62, z + 0.61, 12.7, 18.18, color.redWarm);
    box(out, 'brick', [x - 0.7, 18.1, z - 0.74], [x + 0.7, 18.42, z + 0.73], color.redDark);
  }
  const bays = [
    [-15.4, 1.77],
    [-6.5, 1.68],
    [2.7, 1.75],
    [9.5, 1.68],
  ];
  for (const [z, w] of bays) {
    pane(out, eastFace(12.801), z, 2.45, w, 2.67, east, lod);
    pane(out, eastFace(12.801), z, 7.08, w, 2.63, east, lod);
  }
  for (const [z, normal, sign] of [
    [-17.951, north, -1],
    [12.052, south, 1],
  ]) {
    for (const x of [-11.6, -7.0, 7.5, 10.5]) {
      if (normal === south && x > -9.3 && x < 6.05) continue;
      pane(out, sideFace(z, sign), x, 2.65, 1.14, 2.65, normal, lod);
      pane(out, sideFace(z, sign), x, 7.08, 1.15, 2.72, normal, lod);
    }
  }
  for (const x of [-6.82, 2.96]) pane(out, sideFace(22.912, 1), x, 6.14, 1.55, 2.35, south, lod);
  for (const x of [-2.8, 2.0]) pane(out, sideFace(-23.371, -1), x, 5.0, 1.52, 2.65, north, lod);
  for (const off of [0.93, 3.18, 5.66])
    pane(out, eastFace(19.962), off, 4.67, 1.36, 2.75, east, lod);
  for (const z of [-15.94, 13.02]) pane(out, westFace(q.westWall), z, 7.11, 1.5, 2.58, west, lod);
  for (const z of [-15.48, -5.15, 4.77, 12.8]) {
    const xf = z > 12 ? -9.325 : q.westWall;
    pane(out, westFace(xf), z, 2.32, 1.36, 2.76, west, lod);
  }
  volume(out, -13.55, -8.9, 12.0, 17.6, floor, 8.8, color.redWarm);
  hip(out, -14.05, -8.64, 11.95, 17.95, 8.8, 11.7, 1.76, 2.08, lod);
  pane(out, westFace(-13.56), 15.41, 5.15, 1.4, 2.65, west, lod);
}

function lattice(out, x, z, floor, top, w, lod) {
  const g = (s, y, d) => [x - d, y, z + s];
  const ribs = lod === 0 ? 3 : lod === 1 ? 6 : 9;
  for (let i = 0; i <= ribs; i++) {
    const p = (i / ribs - 0.5) * w;
    wallFace(out, g, 'timber', p - 0.035, p + 0.035, floor, top, 0, west, color.ivory);
  }
  for (const y of [floor, top])
    wallFace(out, g, 'timber', -w / 2, w / 2, y - 0.055, y + 0.055, 0.021, west, color.ivory);
}

function smallArch(out, x, z, y, radius, lod) {
  const n = lod === 0 ? 2 : lod === 1 ? 5 : lod === 2 ? 8 : 11;
  const r = radius + 0.13;
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n,
      b = (Math.PI * (i + 1)) / n;
    const p = (v, d) => [x, y + Math.sin(v) * d, z + Math.cos(v) * d];
    panel(out, 'timber', [p(a, radius), p(b, radius), p(b, r), p(a, r)], west, color.tanLight);
  }
}

function balcony(out, x, z, y, width, lod) {
  box(
    out,
    'timber',
    [x - 0.16, y - 0.28, z - width / 2],
    [x + 1.04, y, z + width / 2],
    color.paintShade,
  );
  lattice(out, x - 0.14, z, y + 0.08, y + 0.93, width - 0.1, lod);
  for (const f of [-0.48, -0.18, 0.18, 0.48]) {
    const s = z + f * width;
    if (lod === 0)
      wallFace(
        out,
        westFace(x - 0.092),
        'timber',
        s - 0.066,
        s + 0.066,
        y,
        y + 2.63,
        0,
        west,
        color.ivory,
      );
    else box(out, 'timber', [x - 0.09, y, s - 0.066], [x + 0.07, y + 2.63, s + 0.066], color.ivory);
  }
  for (const f of [-0.33, 0, 0.33])
    smallArch(out, x - 0.092, z + f * width, y + 1.73, width * 0.141, lod);
  hip(
    out,
    x - 0.28,
    x + 1.21,
    z - width / 2 - 0.05,
    z + width / 2 + 0.05,
    y + 2.65,
    y + 3.07,
    0.53,
    0.65,
    lod,
    false,
  );
}

function frontBays(out, lod) {
  const [, upper] = q.levelHeights;
  for (const [i, z] of q.frontGableStations.entries()) {
    const center = i === 1;
    const x = center ? -17.14 : -16.01;
    const w = center ? 8.0 : 6.55;
    const top = center ? 13.19 : 12.76;
    volume(out, x, -7.7, z - w / 2, z + w / 2, 1.09, top, i % 2 ? color.red : color.redLight);
    if (center && lod > 0) {
      for (const d of [-2.25, 2.25])
        pane(out, westFace(x - 0.007), z + d, 1.7, 1.02, 2.56, west, lod);
    }
    gable(
      out,
      x,
      -5.0,
      z,
      w + 0.53,
      top,
      center ? q.levelHeights[3] + 0.73 : q.levelHeights[3] - 0.36,
      lod,
    );
    const face = westFace(x - 0.013);
    for (const d of [-1.13, 1.13]) {
      pane(out, face, z + d, center ? 7.3 : 2.19, 1.65, center ? 2.98 : 3.05, west, lod);
      if (!center) pane(out, face, z + d, upper + 0.17, 1.46, 2.42, west, lod);
    }
    if (center) pane(out, face, z, 13.4, 2.15, 2.54, west, lod, true);
    else {
      for (const d of [-1.22, 1.22]) pane(out, face, z + d, 6.66, 1.51, 2.51, west, lod);
      for (const d of [-0.79, 0.79]) pane(out, face, z + d, 12.94, 1.16, 1.56, west, lod, true);
      balcony(out, x - 0.76, z, 6.7, 5.6, lod);
    }
  }
  if (lod === 0) return;
  for (const z of [-17.25, -5.23, 5.2]) {
    const x = -13.92;
    const top = 14.78;
    volume(out, x, -10.52, z - 0.98, z + 0.98, 10.96, top, color.red);
    gable(out, x, -10.35, z, 2.21, top, top + 1.2, lod);
    pane(out, westFace(x - 0.008), z, 13.03, 0.93, 1.55, west, lod, true);
  }
}

function veranda(out, x, z, width, depth, central, lod) {
  const steps = central ? [2, 6, 8, 8][lod] : 0;
  const floor = 1.15,
    eave = central ? 5.35 : 5.08;
  box(out, 'stone', [x, floor - 0.27, z - width / 2], [x + depth, floor, z + width / 2], color.tan);
  hip(
    out,
    x - 0.35,
    x + depth + 0.14,
    z - width / 2 - 0.39,
    z + width / 2 + 0.39,
    eave,
    eave + 1.18,
    1.17,
    1.2,
    lod,
  );
  const posts = central ? [-2.62, 2.62] : [-0.45, -0.16, 0.15, 0.45].map((f) => width * f);
  for (const a of posts) {
    const s = z + a;
    tube(
      out,
      'timber',
      [x + 0.12, floor, s],
      [x + 0.12, eave, s],
      0.112,
      color.ivory,
      lod === 0 ? 5 : 8,
    );
    if (lod >= 1) {
      box(
        out,
        'timber',
        [x - 0.053, eave - 0.58, s - 0.23],
        [x + 0.27, eave - 0.36, s + 0.23],
        color.tanLight,
      );
      box(
        out,
        'timber',
        [x + 0.042, eave - 0.87, s - 0.15],
        [x + 0.24, eave - 0.37, s + 0.15],
        color.ivory,
      );
    }
  }
  if (!central) {
    lattice(out, x + 0.095, z, floor + 0.18, floor + 1.05, width - 0.31, lod);
    return;
  }
  const door = westFace(x + depth - 0.31);
  wallFace(out, door, 'timber', z - 1.15, z + 1.15, floor, 4.15, 0, west, color.door);
  for (const s of [z - 1.28, z, z + 1.28])
    wallFace(out, door, 'timber', s - 0.062, s + 0.062, 1.22, 4.19, 0.028, west, color.ivory);
  wallFace(out, door, 'glass', z - 1.08, z + 1.08, 3.64, 4.13, 0.041, west, color.glassDark);
  for (let i = 0; i < steps; i++) {
    const xo = x - (steps - i) * 0.31;
    const top = localGrade(xo, z) + ((floor - localGrade(xo, z)) * (i + 1)) / steps;
    box(out, 'stone', [xo, top - 0.25, z - 2.76], [xo + 0.65, top, z + 2.76], color.marble);
  }
}

function turret(out, lod) {
  const x = 8.03,
    z = -14.49,
    radius = 4.1,
    height = 12.75;
  const n = lod === 0 ? 6 : 10;
  const point = (i, r, y) => [
    x + r * Math.cos((i * 2 * Math.PI) / n + 0.29),
    y,
    z + r * Math.sin((i * 2 * Math.PI) / n + 0.29),
  ];
  for (let i = 0; i < n; i++) {
    const a = point(i, radius, 1.12),
      b = point(i + 1, radius, 1.12);
    const normal = [a[0] + b[0] - 2 * x, 0, a[2] + b[2] - 2 * z];
    panel(
      out,
      'brick',
      [a, b, point(i + 1, radius, height), point(i, radius, height)],
      normal,
      i % 3 ? color.red : color.redLight,
    );
    panel(
      out,
      'slate',
      [
        point(i, radius + 0.25, height - 0.08),
        point(i + 1, radius + 0.25, height - 0.08),
        [x, 18.45, z],
      ],
      up,
      color.gray,
    );
  }
}

function build(out, lod) {
  plinth(out);
  mainHouse(out, lod);
  frontBays(out, lod);
  veranda(out, q.frontPorchEdge, -0.54, 7.2, 3.3, true, lod);
  veranda(out, -19.89, -3.3, 4.95, 5.6, false, lod);
  veranda(out, -19.28, 4.05, 5.14, 5.04, false, lod);
  veranda(out, -14.92, 13.65, 7.28, 4.4, false, lod);
  turret(out, lod);
}
export const mansionSkyline = (out) => build(out, 0);
export const mansionDistrict = (out) => build(out, 1);
export const mansionStreet = (out) => build(out, 2);
export const mansionCloseup = (out) => build(out, 3);
const recipe = 'north-carolina-executive-mansion-model.mjs';
const camera = [-66, 26, 31];
const lookAt = [-2, 7, 1];
export const mansionModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: mansionCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Queen Anne Executive Mansion in Raleigh, with three brick front gables, multicolored slate, open timber galleries, a round turret, and marble entry stair.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  portableGroundY: -0.64,
  sunDirection: [-32, 38, -18],
  mediumFiContext: {
    scale: 1.22,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'Named WakeGIS-derived Executive Mansion polygon.',
  },
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_sandstone_raw', 'slate', 'wood_plain'],
  qaCameras: [
    {
      name: 'blount-street-gables-and-marble-stair',
      position: [-61, 9.0, -1.1],
      lookAt: [-13, 8.22, -0.23],
    },
    { name: 'slate-bands-eastern-turret-and-wing', position: [38, 24, -30], lookAt: [0, 8, -4.9] },
    { name: 'timber-loggias-and-porch', position: [-44, 11.8, 12.4], lookAt: [-13, 7.2, -1.4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `blount-street-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'mansionSkyline',
    errorMeters: 0.68,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'mansionDistrict', 0.32],
        ['street', 'mansionStreet', 0.12],
        ['closeup', 'mansionCloseup', 0.045],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model geometry under the repository license. The mapped outline is ODbL. The two selected photos are CC0 by Willthacheerleader18.',
};

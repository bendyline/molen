/** Tchaikovsky House as recorded by the March 2008 exterior photographs. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section;
const [outline] = read('map-frame').geometry.polygons;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.96, metallic: 0 },
  trim: { slot: 'trim', graph: 'plaster_lime', roughness: 0.86, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.74, metallic: 0.2 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.16 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.47, metallic: 0.05 },
};
const c = Object.fromEntries(
  Object.entries({
    brick: 'ae6a52',
    darkBrick: '935c49',
    brickTrim: 'b68a70',
    foundation: '9a8780',
    plaster: 'd2c9b9',
    porcelain: 'e2d7c0',
    roof: '666568',
    glass: '535d62',
    doorway: '4d3b37',
    iron: '4d4e4b',
    sill: 'bbafa2',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const up = [0, 1, 0],
  down = [0, -1, 0],
  white = 'palette:#ffffff';

function face(out, slot, points, expected, color) {
  let normal = normalFor(...points);
  if (normal.reduce((dot, n, i) => dot + n * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}

const facade = (axis, line, sign) =>
  axis === 'z'
    ? { at: (u, y, d = 0) => [u, y, line + sign * d], n: [0, 0, sign], tangent: [1, 0, 0] }
    : { at: (u, y, d = 0) => [line + sign * d, y, u], n: [sign, 0, 0], tangent: [0, 0, 1] };
function panel(out, slot, f, a, b, base, top, tint, d = 0) {
  face(
    out,
    slot,
    [f.at(a, base, d), f.at(b, base, d), f.at(b, top, d), f.at(a, top, d)],
    f.n,
    tint,
  );
}
function relief(out, slot, f, a, b, y, h, depth, tint) {
  beam(out, slot, f.at(a, y, depth * 0.23), f.at(b, y, depth * 0.23), depth, h, tint);
}
function opening(out, f, left, right, bottom, top, lod, door) {
  const depth = lod ? -0.13 : 0.009;
  panel(out, 'glass', f, left, right, bottom, top, door ? c.doorway : c.glass, depth);
  if (!lod) return;
  for (const [u, sign] of [
    [left, 1],
    [right, -1],
  ]) {
    face(
      out,
      'brick',
      [f.at(u, bottom), f.at(u, top), f.at(u, top, depth), f.at(u, bottom, depth)],
      f.tangent.map((n) => n * sign),
      c.darkBrick,
    );
    if (lod >= 2) {
      beam(
        out,
        'trim',
        f.at(u + sign * 0.04, bottom, 0.011),
        f.at(u + sign * 0.04, top, 0.011),
        0.081,
        0.065,
        c.plaster,
      );
    }
  }
  for (const [y, n] of [
    [bottom, up],
    [top, down],
  ]) {
    face(
      out,
      'brick',
      [f.at(left, y), f.at(right, y), f.at(right, y, depth), f.at(left, y, depth)],
      n,
      c.brickTrim,
    );
  }
  relief(out, 'brick', f, left - 0.13, right + 0.13, top + 0.085, 0.17, 0.13, c.brickTrim);
  relief(out, 'trim', f, left - 0.12, right + 0.12, bottom - 0.046, 0.09, 0.15, c.sill);
  if (lod < 2 || door) return;
  const middle = (left + right) / 2,
    transom = bottom + (top - bottom) * 0.61;
  beam(
    out,
    'trim',
    f.at(middle, bottom + 0.024, depth + 0.018),
    f.at(middle, top - 0.024, depth + 0.018),
    0.047,
    0.055,
    c.porcelain,
  );
  beam(
    out,
    'trim',
    f.at(left, transom, depth + 0.022),
    f.at(right, transom, depth + 0.022),
    0.048,
    0.06,
    c.plaster,
  );
}
function windowCourse(out, f, a, b, base, top, centers, row, lod) {
  if (!lod) {
    panel(out, 'brick', f, a, b, base, top, c.brick);
    for (const center of centers)
      opening(
        out,
        f,
        center - row.width / 2,
        center + row.width / 2,
        row.sill,
        row.head,
        lod,
        row.door,
      );
    return;
  }
  let u = a;
  for (const center of centers) {
    const left = center - row.width / 2,
      right = center + row.width / 2;
    panel(out, 'brick', f, u, left, base, top, c.brick);
    if (row.sill > base) panel(out, 'brick', f, left, right, base, row.sill, c.brick);
    panel(out, 'brick', f, left, right, row.head, top, c.brick);
    opening(out, f, left, right, row.sill, row.head, lod, row.door);
    u = right;
  }
  panel(out, 'brick', f, u, b, base, top, c.brick);
}
function wall(out, f, a, b, top, lower, lod, upper) {
  const base = -0.06;
  panel(out, 'stone', f, a, b, s.foundation, base, c.foundation);
  const pivot = upper ? 3.97 : top;
  const row = {
    width: lower.width ?? 1.04,
    sill: lower.sill ?? 1.08,
    head: lower.head ?? 3.25,
    door: lower.door,
  };
  windowCourse(out, f, a, b, base, pivot, lower.centers, row, lod);
  if (upper) {
    windowCourse(
      out,
      f,
      a,
      b,
      pivot,
      top,
      upper.centers,
      { width: upper.width ?? 1.07, sill: 4.34, head: 6.53 },
      lod,
    );
    relief(out, 'brick', f, a, b, 3.95, 0.11, 0.125, c.brickTrim);
  }
  if (lod) {
    relief(out, 'brick', f, a, b, top - 0.15, 0.26, 0.22, c.darkBrick);
    relief(out, 'brick', f, a, b, top - 0.05, 0.11, 0.32, c.brickTrim);
    relief(out, 'stone', f, a, b, 0.021, 0.13, 0.14, c.sill);
  }
}

function gabled(out, bounds, eave, ridge, axis, lod, rearSetback) {
  const [left, right, backZ, frontZ] = bounds;
  const [a, b, c0, c1] = axis === 'x' ? [left, right, backZ, frontZ] : [backZ, frontZ, left, right];
  const mid = (c0 + c1) / 2,
    at = axis === 'x' ? (u, y, v) => [u, y, v] : (u, y, v) => [v, y, u];
  const frontSlope = [a - 0.13, b + 0.13, c1 + 0.12, eave + 0.01];
  const rear = rearSetback
    ? [
        [
          a - 0.13,
          rearSetback.x,
          rearSetback.z - 0.12,
          eave + ((ridge - eave) * (rearSetback.z - c0)) / (mid - c0),
        ],
        [rearSetback.x, b + 0.13, c0 - 0.12, eave + 0.01],
      ]
    : [[a - 0.13, b + 0.13, c0 - 0.12, eave + 0.01]];
  for (const [u, v, side, low] of [frontSlope, ...rear]) {
    face(
      out,
      'roof',
      [at(u, low, side), at(v, low, side), at(v, ridge, mid), at(u, ridge, mid)],
      up,
      c.roof,
    );
  }
  if (rearSetback) {
    const { x, z } = rearSetback;
    face(
      out,
      'brick',
      [at(x, eave - 0.06, c0), at(x, eave - 0.06, z), at(x, rear[0][3], z)],
      [-1, 0, 0],
      c.brick,
    );
    face(
      out,
      'brick',
      [at(a, eave - 0.06, z), at(x, eave - 0.06, z), at(x, rear[0][3], z), at(a, rear[0][3], z)],
      [0, 0, -1],
      c.brick,
    );
  }
  for (const [u, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    const n = axis === 'x' ? [sign, 0, 0] : [0, 0, sign];
    const top = ridge - 0.02;
    const endRear = u === a && rearSetback ? rearSetback.z : c0;
    face(
      out,
      'brick',
      [at(u, eave - 0.02, endRear), at(u, eave - 0.02, c1), at(u, top, mid)],
      n,
      c.brick,
    );
    if (u === a && rearSetback) {
      face(
        out,
        'brick',
        [at(u, eave - 0.02, endRear), at(u, top, mid), at(u, rear[0][3], endRear)],
        n,
        c.brick,
      );
    }
    if (lod) {
      beam(
        out,
        'brick',
        at(u + 0.035 * sign, u === a && rearSetback ? rear[0][3] : eave + 0.055, endRear),
        at(u + 0.035 * sign, top, mid),
        0.13,
        0.13,
        c.brickTrim,
      );
      beam(
        out,
        'brick',
        at(u + 0.035 * sign, eave + 0.055, c1),
        at(u + 0.035 * sign, top, mid),
        0.13,
        0.13,
        c.brickTrim,
      );
    }
  }
}

function building(out, lod) {
  const lx = -15.94,
    bx = -3.365,
    cx = 2.585,
    rx = 13.79;
  const lf = 8.95,
    lb = -5.54,
    cf = 10.77,
    rf = 4.15,
    rb = -6.11;
  const left = [lx, bx, lb, lf],
    core = [bx, cx, lb, cf],
    right = [cx, rx, rb, rf];
  wall(
    out,
    facade('z', lf, 1),
    lx,
    bx,
    s.leftEave,
    { centers: [-14.26, -11.92, -9.6, -7.26, -4.95] },
    lod,
  );
  wall(out, facade('x', lx, -1), lb, lf, s.leftEave, { centers: [-3.04, -0.22, 2.61, 5.38] }, lod);
  wall(
    out,
    facade('z', lb, -1),
    lx,
    bx,
    s.leftEave,
    { centers: [-13.4, -10.75, -8.09, -5.39] },
    lod,
  );
  wall(
    out,
    facade('z', cf, 1),
    bx,
    cx,
    s.centralEave,
    { centers: [-0.43], width: 1.61, sill: s.porchThreshold, head: 3.19, door: true },
    lod,
    { centers: [-0.43], width: 1.61 },
  );
  wall(out, facade('x', bx, -1), lb, cf, s.centralEave, { centers: [] }, lod, {
    centers: [-3.7, 2.22, 6.81],
  });
  wall(out, facade('x', cx, 1), lb, cf, s.centralEave, { centers: [6.22, 8.74] }, lod, {
    centers: [-3.2, 0.62, 4.58, 8.74],
  });
  wall(out, facade('z', lb, -1), bx, cx, s.centralEave, { centers: [-1.7, 0.92] }, lod, {
    centers: [-1.7, 0.92],
  });
  wall(out, facade('z', rf, 1), cx, rx, s.rightEave, { centers: [4.25, 6.82, 9.36, 11.94] }, lod);
  wall(
    out,
    facade('x', rx, 1),
    -10.2,
    rf,
    s.rightEave,
    { centers: [-8.34, -5.2, -2.06, 1.12] },
    lod,
  );
  wall(out, facade('z', rb, -1), cx, 7.21, s.rightEave, { centers: [4.18, 6.1] }, lod);
  box(
    out,
    'brick',
    10.48,
    s.foundation,
    -8.15,
    6.55,
    s.rightEave - s.foundation - 0.015,
    4.04,
    c.brick,
  );
  box(
    out,
    'brick',
    3.48,
    s.foundation,
    -8.36,
    5.67,
    s.leftEave - s.foundation - 0.015,
    5.33,
    c.brick,
  );
  gabled(out, left, s.leftEave, s.leftEave + 0.63, 'x', lod);
  gabled(out, core, s.centralEave, s.centralPediment, 'z', lod);
  gabled(out, [cx, rx, -10.2, rf], s.rightEave, s.rightGable, 'x', lod, { x: 7.21, z: rb });
  box(out, 'roof', 3.47, s.leftEave - 0.025, -8.4, 5.75, 0.11, 5.46, c.roof);
  for (const [x, y, z] of [
    [-14.9, s.leftEave, 5.3],
    [-7.2, s.leftEave + 0.25, -2.55],
    [4.88, s.rightEave + 0.45, -6.23],
  ]) {
    box(out, 'brick', x, y, z, 0.47, 0.87, 0.55, c.darkBrick);
    if (lod) box(out, 'brick', x, y + 0.86, z, 0.58, 0.11, 0.63, c.brickTrim);
  }
  if (lod) {
    const f = facade('z', cf + 0.012, 1);
    relief(out, 'trim', f, -1.73, 0.86, 6.85, 0.17, 0.24, c.sill);
    relief(out, 'brick', f, -2.9, 2.05, 7.28, 0.23, 0.23, c.brickTrim);
  }
}

function porch(out, lod) {
  const x = -0.43,
    z = 11.72,
    width = 4.18,
    depth = 2.08;
  for (const [j, w, d] of [
    [0, 3.35, 1.04],
    [1, 3.05, 0.78],
    [2, 2.78, 0.56],
  ]) {
    box(out, 'stone', x, -0.13 + j * 0.12, 12.91 - j * 0.12, w, 0.17, d, c.sill);
  }
  box(out, 'stone', x, 0.065, z, width + 0.24, 0.18, depth + 0.05, c.sill);
  box(out, 'trim', x, s.balconyFloor - 0.23, z, width + 0.13, 0.23, depth + 0.1, c.plaster);
  for (const px of [-2.29, -1.84, 0.98, 1.43]) {
    box(out, 'trim', px, 0.23, 12.57, 0.1, s.balconyFloor - 0.46, 0.115, c.porcelain);
    if (lod) {
      box(out, 'trim', px, 0.24, 12.57, 0.19, 0.13, 0.18, c.sill);
      box(out, 'trim', px, 3.01, 12.57, 0.17, 0.145, 0.17, c.plaster);
    }
  }
  if (lod) {
    const lx = x - width / 2,
      rx = x + width / 2,
      near = z + depth / 2,
      back = z - depth / 2;
    for (const y of [s.balconyFloor + 0.1, s.balustradeTop]) {
      beam(out, 'iron', [lx, y, back], [lx, y, near], 0.05, 0.05, c.iron);
      beam(out, 'iron', [rx, y, back], [rx, y, near], 0.05, 0.05, c.iron);
      beam(out, 'iron', [lx, y, near], [rx, y, near], 0.052, 0.054, c.iron);
    }
    const count = [0, 7, 15, 23][lod];
    for (let i = 0; i <= count; i++) {
      const px = lx + (width * i) / count;
      beam(
        out,
        'iron',
        [px, s.balconyFloor + 0.1, near],
        [px, s.balustradeTop, near],
        0.028,
        0.029,
        c.iron,
      );
    }
    if (lod >= 2) {
      for (const px of [lx, rx]) {
        for (let i = 1; i < Math.floor(count / 2); i++) {
          const pz = back + (depth * i) / Math.floor(count / 2);
          beam(
            out,
            'iron',
            [px, s.balconyFloor + 0.1, pz],
            [px, s.balustradeTop, pz],
            0.027,
            0.026,
            c.iron,
          );
        }
      }
    }
  }
}

function belvedere(out, lod) {
  const [x, z] = s.towerCenter,
    w = s.towerWidth,
    top = s.towerHeight;
  const half = w / 2;
  box(out, 'brick', x, 5.05, z, w, top - 5.54, w, c.brick);
  for (const [axis, normalSign] of [
    ['x', 1],
    ['x', -1],
    ['z', 1],
    ['z', -1],
  ]) {
    const at = axis === 'x' ? x : z,
      u = axis === 'x' ? z : x;
    const f = facade(axis, at + normalSign * half, normalSign);
    for (const off of [-0.57, 0.57]) {
      const p = u + off;
      panel(out, 'glass', f, p - 0.157, p + 0.157, 8.75, 9.68, c.doorway, 0.008);
      if (lod) relief(out, 'brick', f, p - 0.23, p + 0.23, 9.74, 0.15, 0.12, c.brickTrim);
    }
    if (lod) {
      for (let i = 0; i < 8; i++) {
        const p = u - half + 0.21 + ((w - 0.42) * i) / 7;
        beam(
          out,
          'brick',
          f.at(p, top - 1.0, 0.045),
          f.at(p, top - 0.49, 0.12),
          0.17,
          0.22,
          c.darkBrick,
        );
      }
    }
  }
  box(out, 'brick', x, top - 0.56, z, w + 0.31, 0.24, w + 0.31, c.brickTrim);
  box(out, 'brick', x, top - 0.34, z, w + 0.45, 0.15, w + 0.45, c.brick);
  box(out, 'roof', x, top - 0.18, z, w + 0.18, 0.1, w + 0.18, c.roof);
  for (const sign of [-1, 1]) {
    for (const off of [-1.41, -0.47, 0.47, 1.41]) {
      box(
        out,
        'brick',
        x + off,
        top - 0.18,
        z + sign * (half + 0.03),
        0.39,
        0.38,
        0.43,
        c.brickTrim,
      );
    }
    for (const off of [-0.55, 0.55]) {
      box(
        out,
        'brick',
        x + sign * (half + 0.03),
        top - 0.18,
        z + off,
        0.42,
        0.38,
        0.4,
        c.brickTrim,
      );
    }
  }
  beam(out, 'iron', [x, top - 0.09, z], [x, s.spireTip, z], 0.055, 0.06, c.iron);
  if (lod >= 2)
    beam(
      out,
      'iron',
      [x - 0.27, s.spireTip - 0.18, z],
      [x + 0.31, s.spireTip - 0.18, z],
      0.045,
      0.053,
      c.iron,
    );
}

function build(out, lod) {
  building(out, lod);
  porch(out, lod);
  belvedere(out, lod);
}

export const taganrogSkyline = (out) => build(out, 0);
export const taganrogDistrict = (out) => build(out, 1);
export const taganrogStreet = (out) => build(out, 2);
export const taganrogCloseup = (out) => build(out, 3);

const recipe = 'taganrog-house-model.mjs';
const camera = [27, 17, 35],
  lookAt = [0, 3.1, 2.2];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'taganrogDistrict', 0.17],
    ['street', 'taganrogStreet', 0.07],
    ['closeup', 'taganrogCloseup', 0.024],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const taganrogModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: taganrogCloseup,
  category: 'mansion',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Red-brick house with staggered wings, a pedimented central entry, white porch posts and a square crenellated belvedere.',
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
    minimumCoverage: 0.89,
    basis: 'Named mansion perimeter, OpenStreetMap way 335719684.',
  },
  mediumFiContext: {
    scale: 0.83,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'brick_flemish',
    'stone_sandstone',
    'plaster_lime',
    'metal_standing_seam',
    'metal_painted',
  ],
  qaCameras: [
    { name: 'grecheskaya-street-porch', position: [-7.2, 5.6, 39], lookAt: [-1.0, 3.75, 4.8] },
    {
      name: 'brick-right-gable-and-belvedere',
      position: [30, 8.1, 17.1],
      lookAt: [2.0, 3.85, 2.8],
    },
    { name: 'rear-roofs-and-square-tower', position: [28, 16, -24], lookAt: [1.5, 4.2, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-taganrog-house-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'taganrogSkyline',
    errorMeters: 0.4,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and three exact first-party public-domain Qualla photographs.',
};

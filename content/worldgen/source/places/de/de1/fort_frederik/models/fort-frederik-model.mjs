import fs from 'node:fs';
import { createRequire } from 'node:module';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  opening,
  outwardRing,
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const requireGeometry = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
);
const { default: earcut } = requireGeometry('earcut');
const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const map = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const red = rgb('a44b3e');
const redShade = rgb('924538');
const redDark = rgb('723f37');
const white = rgb('e6deca');
const mortar = rgb('b4a499');
const paving = rgb('a28270');
const deck = rgb('9c7e6e');
const stone = rgb('857665');
const dark = rgb('403a33');
const shutter = rgb('d0cdc0');
const { courtLowWallTopM: wallTop, quartersRoofTopM: quartersTop } = plan.dimensions;
const datum = 0.1;
const floor = 0.075;
const outer = map.geometry.outline;
const court = [
  [-6.69, -13.58],
  [16.88, -13.58],
  [16.88, 14.05],
  [-6.69, 14.05],
];
const corners = [
  [outer[14], outer[13], outer[12], outer[11], outer[10], [-11.9, -12.9], court[0]],
  [court[3], [-12.0, 13.2], outer[9], outer[8], outer[7], outer[6], outer[5]],
];
const northWall = [outer[14], outer[0], [23.714, -13.58], court[0]];
const eastWall = [
  outer[0],
  outer[1],
  outer[2],
  outer[3],
  outer[4],
  [16.88, 20.849],
  court[2],
  court[1],
];
const southWall = [court[3], [16.88, 14.05], [16.88, 20.849], outer[5]];
const xWest = -13.381;
const xCourtyard = court[0][0];
const westFace = facade([xWest, 0], [0, 1]);
const quartersFace = facade([xCourtyard, 0], [0, -1]);
const halfGate = 1.48;

const surfaces = {
  stucco: { slot: 'wall', graph: 'stucco', roughness: 0.96 },
  trim: { slot: 'trim', graph: 'stucco', roughness: 0.91 },
  paving: { slot: 'foundation', graph: 'brick', roughness: 0.98 },
  roof: { slot: 'roof', graph: 'brick', roughness: 0.95 },
  detail: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87 },
};

function box(out, slot, x0, x1, z0, z1, lo, hi, color) {
  abox(out, slot, [x0, lo, z0], [x1, hi, z1], color, { bottom: false });
}

function band(out, face, u0, u1, low, high, depth, color) {
  fbox(out, 'trim', face, u0, u1, low, high, -0.025, depth, color);
}

function cap(out, slot, ring, y, color) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3).map((index) => {
      const [x, z] = ring[index];
      return [x, y, z];
    });
    const upward = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    if (upward > 0) tri(out, slot, a, b, c, color);
    else tri(out, slot, a, c, b, color);
  }
}

function wallBlock(out, ring, color = red) {
  extrude(out, 'stucco', ring, -0.55, wallTop, color, { top: false });
  cap(out, 'roof', ring, wallTop, deck);
}

function parapet(out, a, b, level, top = wallTop) {
  const f = wallFace(a, b);
  fbox(out, 'stucco', f, 0, f.length, top - 0.04, top + 0.62, -0.48, 0, redShade);
  if (level > 0) band(out, f, 0, f.length, top + 0.53, top + 0.65, 0.035, white);
}

function portal(out, startX, endX, centerZ, half, spring, top, level, turn = false) {
  const pts = roundArch(half, level > 1 ? 12 : level > 0 ? 8 : 4);
  const place = (axis, u, y) => (turn ? [centerZ + u, y, axis] : [axis, y, centerZ + u]);
  for (let i = 1; i < pts.length; i++) {
    const [u0, h0] = pts[i - 1];
    const [u1, h1] = pts[i];
    const a = place(startX, u0, spring + h0);
    const b = place(startX, u1, spring + h1);
    const c = place(endX, u1, spring + h1);
    const d = place(endX, u0, spring + h0);
    const startA = place(startX, u0, top);
    const startB = place(startX, u1, top);
    const endA = place(endX, u0, top);
    const endB = place(endX, u1, top);
    if (turn) {
      quad4(out, 'stucco', startA, startB, b, a, red);
      quad4(out, 'stucco', endB, endA, d, c, red);
      quad4(out, 'stucco', b, c, d, a, redDark);
      quad4(out, 'roof', endA, endB, startB, startA, deck);
    } else {
      quad4(out, 'stucco', startB, startA, a, b, red);
      quad4(out, 'stucco', endA, endB, c, d, red);
      quad4(out, 'stucco', a, d, c, b, redDark);
      quad4(out, 'roof', endB, endA, startA, startB, deck);
    }
  }
}

function courtRoomWindow(out, face, u, low, width, height, level, kind = 'window') {
  const arch = kind === 'arch';
  if (level === 0) {
    const left = u - width / 2;
    const right = u + width / 2;
    quad4(
      out,
      'detail',
      face.P(left, low, 0.041),
      face.P(right, low, 0.041),
      face.P(right, low + height, 0.041),
      face.P(left, low + height, 0.041),
      dark,
    );
    return;
  }
  opening(out, face, u, low, width, height, {
    head: arch ? 'round' : 'flat',
    frameSlot: 'trim',
    glassSlot: 'detail',
    frame: white,
    glass: dark,
    frameWidth: arch ? 0.16 : 0.11,
    frameDepth: 0.14,
    d: 0.077,
    sill: kind === 'window',
    mullions: kind === 'window' && level > 1 ? 1 : 0,
    transoms: kind === 'window' && level === 3 ? 1 : 0,
    mullionColor: mortar,
  });
  if (kind === 'window' && level > 1) {
    for (const side of [-1, 1]) {
      const c = u + side * width * 0.73;
      fbox(
        out,
        'detail',
        face,
        c - width * 0.19,
        c + width * 0.19,
        low,
        low + height,
        0.066,
        0.14,
        shutter,
      );
    }
  }
}

function lowerWings(out, level) {
  wallBlock(out, northWall);
  wallBlock(out, eastWall, redShade);
  for (const ring of corners) wallBlock(out, ring);
  const x0 = 8.3;
  const x1 = 10.4;
  const z0 = 14.05;
  const z1 = 20.849;
  wallBlock(out, [southWall[0], [x0, z0], [x0, z1], southWall[3]]);
  wallBlock(out, [[x1, z0], southWall[1], southWall[2], [x1, z1]]);
  portal(out, z0, z1, (x0 + x1) / 2, (x1 - x0) / 2, 1.9, wallTop, level, true);

  const outline = outwardRing(outer);
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    if (Math.abs(a[0] - xWest) < 0.02 && Math.abs(b[0] - xWest) < 0.02) continue;
    parapet(out, a, b, level);
  }
  const N = facade([0, court[0][1]], [1, 0]);
  const S = facade([0, court[3][1]], [-1, 0]);
  const E = facade([court[1][0], 0], [0, 1]);
  for (const x of [-1.6, 2.65, 6.85, 11.44, 14.65]) {
    courtRoomWindow(
      out,
      N,
      x,
      x < 0 ? floor : 1.18,
      1.02,
      x < 0 ? 2.48 : 1.67,
      level,
      x < 0 ? 'door' : 'window',
    );
  }
  for (const x of [-2.7, 1.65, 6.15, 13.88])
    courtRoomWindow(out, S, -x, floor, 1.2, 2.43, level, x > 12 ? 'arch' : 'door');
  for (const z of [-10.8, -7.4, -3.95, -0.5, 3.15, 6.62, 10.5])
    courtRoomWindow(
      out,
      E,
      z,
      z < 0 ? 1.15 : floor,
      1.16,
      z < 0 ? 1.6 : 2.45,
      level,
      z < 0 ? 'window' : 'door',
    );
}

function windowPediment(out, F, u, y, curved) {
  const half = 0.79;
  if (curved) {
    const crown = roundArch(half, 6).map(([x, h]) => F.P(u + x, y + h * 0.52, 0.18));
    fan(out, 'trim', [...crown].reverse(), white);
    const detail = roundArch(half * 0.76, 6).map(([x, h]) => F.P(u + x, y + 0.06 + h * 0.43, 0.19));
    fan(out, 'stucco', [...detail].reverse(), redShade);
    return;
  }
  tri(out, 'trim', F.P(u - half, y, 0.18), F.P(u + half, y, 0.18), F.P(u, y + 0.42, 0.18), white);
  tri(
    out,
    'stucco',
    F.P(u - 0.58, y + 0.065, 0.188),
    F.P(u + 0.58, y + 0.065, 0.188),
    F.P(u, y + 0.32, 0.188),
    redShade,
  );
}

function quarters(out, level) {
  const z0 = -13.58;
  const z1 = 14.05;
  box(out, 'stucco', xWest, xCourtyard, z0, -halfGate, -0.54, wallTop, red);
  box(out, 'stucco', xWest, xCourtyard, halfGate, z1, -0.54, wallTop, red);
  portal(out, xWest, xCourtyard, 0, halfGate, 1.98, wallTop, level);
  box(out, 'stucco', xWest, xCourtyard, z0, z1, wallTop - 0.015, quartersTop, red);
  box(
    out,
    'roof',
    xWest - 0.12,
    xCourtyard + 0.12,
    z0 - 0.13,
    z1 + 0.13,
    quartersTop - 0.14,
    quartersTop + 0.02,
    deck,
  );
  for (const face of [westFace, quartersFace]) {
    band(out, face, z0, z1, wallTop - 0.39, wallTop - 0.16, 0.24, white);
    band(out, face, z0, z1, quartersTop - 0.51, quartersTop - 0.27, 0.2, white);
    for (const [i, u] of [-11.05, -8.13, -5.26, -2.66, 0, 2.66, 5.26, 8.13, 11.05].entries()) {
      if (i !== 4 || face === westFace)
        courtRoomWindow(out, face, u, wallTop + 0.72, 1.22, 1.65, level);
      if (level > 0 && face === quartersFace && i >= 2 && i <= 6)
        windowPediment(out, face, u, 7.47, i % 2 === 0);
    }
    for (const z of [-8.7, -5.0, 5.0, 8.7])
      courtRoomWindow(
        out,
        face,
        z,
        1.2,
        face === westFace ? 0.82 : 1.19,
        1.81,
        level,
        face === westFace ? 'window' : 'arch',
      );
  }
  for (const [face, sign] of [
    [quartersFace, -1],
    [westFace, 1],
  ]) {
    const direct = face === westFace ? 0.23 : 0.16;
    for (const side of [-1, 1])
      band(out, face, side * halfGate - 0.14, side * halfGate + 0.14, floor, 2.03, direct, white);
    const arch = roundArch(halfGate, level > 1 ? 12 : 6);
    for (let i = 1; i < arch.length; i++) {
      const [x, y] = arch[i - 1];
      const [nx, ny] = arch[i];
      beam(
        out,
        'trim',
        face.P(x * sign, 1.98 + y, 0.075),
        face.P(nx * sign, 1.98 + ny, 0.075),
        0.18,
        0.14,
        white,
      );
    }
  }
  if (level > 0) {
    for (const z of [-11.65, -8.87, -6.09, -3.32, -1.55, 1.55, 3.32, 6.09, 8.87, 11.65])
      band(out, quartersFace, z - 0.11, z + 0.11, wallTop - 0.8, wallTop - 0.5, 0.19, white);
  }
}

function staircase(out, z, level) {
  const start = 1.0;
  const end = -6.6;
  const steps = level === 0 ? 4 : level === 1 ? 8 : 15;
  const width = 2.38;
  const high = wallTop + 0.05;
  for (let i = 0; i < steps; i++) {
    const front = start + (end - start) * (i / steps);
    const back = start + (end - start) * ((i + 1) / steps);
    box(
      out,
      'paving',
      back,
      front,
      z - width / 2,
      z + width / 2,
      floor,
      high * ((i + 1) / steps),
      paving,
    );
  }
  for (const side of [-1, 1]) {
    const center = z + side * width * 0.53;
    for (const span of [center - 0.23, center + 0.23]) {
      if (span === center + 0.23)
        quad4(
          out,
          'stucco',
          [end, floor, span],
          [start, floor, span],
          [start, 0.58, span],
          [end, high + 0.62, span],
          red,
        );
      else
        quad4(
          out,
          'stucco',
          [start, floor, span],
          [end, floor, span],
          [end, high + 0.62, span],
          [start, 0.58, span],
          red,
        );
    }
    beam(out, 'trim', [start, 0.58, center], [end, high + 0.62, center], 0.47, 0.14, white);
  }
}

function build(out, level) {
  cap(out, 'paving', court, datum, paving);
  box(out, 'paving', xWest, xCourtyard, -halfGate, halfGate, -0.28, datum, paving);
  box(out, 'paving', 8.3, 10.4, 14.05, 20.849, -0.28, datum, paving);
  lowerWings(out, level);
  quarters(out, level);
  staircase(out, -10.52, level);
  staircase(out, 11.19, level);
  box(out, 'stucco', 9.3, 14.82, 7.1, 12.78, floor, 2.98, redShade);
  box(out, 'trim', 9.23, 14.89, 7.03, 12.85, 2.84, 2.99, white);
  box(out, 'roof', 9.38, 14.74, 7.18, 12.7, 2.98, 3.025, stone);
  box(out, 'paving', 11.05, 12.89, 8.94, 10.55, 3.015, 3.22, paving);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'fort-frederik-model.mjs';
const camera = [52, 34, -54];
const lookAt = [3, 3.6, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Fort Frederik',
  wikidataId: plan.wikidataId,
  category: 'fort',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'Frederiksted’s Danish fort with red walls, white trim, paved courtyard, two-storey commandant’s quarters and masonry stairs.',
  camera,
  lookAt,
  sunDirection: [34, 46, -37],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: map.geometry.outline,
    minimumCoverage: 0.86,
    basis: 'Named fort building, including the projecting bastions and the enclosing walls.',
  },
  embeddedCanonicalGraphs: ['stucco', 'brick'],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'court-and-commandants-quarters',
      position: [14.4, 7.6, -11.7],
      lookAt: [-7, 3.6, 1.1],
    },
    { name: 'sea-gate-and-bastions', position: [-51, 13.3, -20], lookAt: [-9, 3.05, 2] },
    { name: 'ramparts-salient-and-cistern', position: [32, 20.3, 26], lookAt: [5, 2.35, 1.6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'fort-frederik-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.7,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.33, surfaces },
      street: { export: 'street', errorMeters: 0.13, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.046, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

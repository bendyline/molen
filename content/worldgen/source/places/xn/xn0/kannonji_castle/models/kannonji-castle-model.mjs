import { readFileSync } from 'node:fs';
import {
  facade,
  fbox,
  quad4,
  rgb,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const remains = read('native-map/kannonji-surviving-stonework');
const field = read('terrain-grid');
const surfaces = {
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  earth: { slot: 'foundation', graph: 'earth_rammed', roughness: 0.97 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.94 },
};
const tones = ['8b8774', '8d8d7d', 'a39f8c', '777861', '949388', '828676', '888374', '929480'].map(
  rgb,
);
const mass = rgb('797866');
const path = rgb('998b71');
const timber = rgb('554432');
const sign = rgb('a28765');

function ground(x, z) {
  const column = (x - field.origin[0]) / field.stepMeters;
  const row = (z - field.origin[1]) / field.stepMeters;
  const i = Math.floor(column);
  const j = Math.floor(row);
  const t = column - i;
  const u = row - j;
  const a = field.heightsMeters[j];
  const b = field.heightsMeters[j + 1];
  return (
    (1 - u) * ((1 - t) * a[i] + t * a[i + 1]) +
    u * ((1 - t) * b[i] + t * b[i + 1]) -
    field.modelDatumElevationMeters
  );
}

function variation(i) {
  return ((((i * 131 + 19) % 113) + 113) % 113) / 113;
}

function dryStone(out, F, x0, x1, bottom, top, recess, face, seed, bevel = false) {
  const color = tones[Math.floor(variation(seed + 31) * tones.length)];
  if (!bevel) {
    fbox(out, 'granite', F, x0, x1, bottom, top, recess, face, color);
    return;
  }
  const chamfer = Math.min(0.14, (x1 - x0) * 0.19, (top - bottom) * 0.18);
  const bearing = face - chamfer * (0.6 + variation(seed) * 0.7);
  const p = [
    F.P(x0, bottom, bearing),
    F.P(x1, bottom, bearing),
    F.P(x1, top, bearing),
    F.P(x0, top, bearing),
  ];
  const q = [
    F.P(x0 + chamfer, bottom + chamfer, face),
    F.P(x1 - chamfer, bottom + chamfer, face),
    F.P(x1 - chamfer, top - chamfer, face),
    F.P(x0 + chamfer, top - chamfer, face),
  ];
  const r = [F.P(x0, top, recess), F.P(x1, top, recess)];
  quad4(out, 'granite', ...q, color);
  quad4(out, 'granite', p[0], p[1], q[1], q[0], color);
  quad4(out, 'granite', p[1], p[2], q[2], q[1], color);
  quad4(out, 'granite', p[2], p[3], q[3], q[2], color);
  quad4(out, 'granite', p[3], p[0], q[0], q[3], color);
  quad4(out, 'granite', p[3], p[2], r[1], r[0], color);
  quad4(out, 'granite', p[0], p[3], r[0], F.P(x0, bottom, recess), color);
  quad4(out, 'granite', p[2], p[1], F.P(x1, bottom, recess), r[1], color);
}

function wall(out, part, level, phase) {
  const stride = [5, 3, 2, 1][level];
  const records = part.samples;
  const outward = part.outwardSide;
  const baseOf = (p) => Math.min(p[2], outward === 1 ? p[3] : p[4]) - 0.34;
  const topOf = (p) => Math.max(p[2] + 0.23, Math.min(p[2] + 1.24, outward === 1 ? p[4] : p[3]));
  for (let i = 0; i < records.length - 1; i += stride) {
    const a = records[i];
    const b = records[Math.min(i + stride, records.length - 1)];
    const first = outward === 1 ? a : b;
    const last = outward === 1 ? b : a;
    const F = wallFace(first, last);
    const length = F.length;
    const p = F.P;
    const y0 = baseOf(first);
    const y1 = baseOf(last);
    const h0 = topOf(first);
    const h1 = topOf(last);
    const depth = 0.13;
    quad4(
      out,
      'granite',
      p(0, y0, depth),
      p(length, y1, depth),
      p(length, h1, -0.05),
      p(0, h0, -0.05),
      mass,
    );
    quad4(
      out,
      'granite',
      p(0, h0, -0.05),
      p(length, h1, -0.05),
      p(length, h1 - 0.14, -0.83),
      p(0, h0 - 0.14, -0.83),
      mass,
    );
    if (level === 0 || length < 0.46) continue;
    const averageBase = (y0 + y1) * 0.5 + 0.12;
    const averageTop = (h0 + h1) * 0.5 + 0.02;
    const rise = averageTop - averageBase;
    const rows = Math.max(1, Math.round(rise / (level === 1 ? 1.09 : level === 2 ? 0.74 : 0.57)));
    for (let row = 0; row < rows; row++) {
      const seed = phase + i * 5 + row * 13;
      const rowRise = rise / rows;
      const y = averageBase + rowRise * row;
      const stones = Math.max(
        1,
        Math.round(length / (level === 1 ? 1.65 : level === 2 ? 1.15 : 0.82)),
      );
      const width = length / stones;
      for (let j = 0; j < stones; j++) {
        const bevel = level >= 2;
        const u = j * width;
        const widthAdjust = (variation(seed + j) - 0.5) * 0.06;
        const setback = 0.28 - (row / rows) * 0.17;
        dryStone(
          out,
          F,
          u + 0.035,
          u + width - 0.03 + widthAdjust,
          y + 0.014,
          y + rowRise - 0.018,
          -0.31,
          setback + variation(seed + j * 11) * 0.2,
          seed + j * 7,
          bevel,
        );
      }
    }
  }
}

function staircase(out, stair, level, short) {
  const F = wallFace(stair.start, stair.end);
  const half = stair.width * 0.5;
  const length = F.length;
  const stride = short ? [1.5, 0.86, 0.75, 0.69][level] : [2.9, 1.51, 1.03, 0.8][level];
  const count = Math.max(3, Math.round(length / stride));
  const run = length / count;
  const pathHeight = (u) => {
    const at = (u / length) * (stair.grades.length - 1);
    const lower = Math.min(Math.floor(at), stair.grades.length - 2);
    return (
      stair.grades[lower][2] + (stair.grades[lower + 1][2] - stair.grades[lower][2]) * (at - lower)
    );
  };
  for (let i = 0; i < count; i++) {
    const u0 = i * run;
    const u1 = (i + 1) * run;
    const mid = (u0 + u1) * 0.5;
    const p = F.P(mid, 0);
    const cross = facade([p[0], p[2]], F.normal);
    const surveyedCenter = pathHeight(mid);
    // The elevation grid blends the edge of the carved stair with the
    // surrounding slope. Make the width readable from edge to edge while
    // retaining the measured cross slope and keeping the masonry seated.
    const sideSamples = [-half + 0.29, half - 0.29].map((d) => {
      const [x, , z] = F.P(mid, 0, d);
      return ground(x, z);
    });
    const y = Math.max(surveyedCenter, ...sideSamples) + 0.12;
    const side = level >= 2 ? 0.13 * (variation(i) - 0.51) : 0;
    const heel = -0.52 * run;
    const toe = 0.52 * run;
    const tread = F.P(u0, 0);
    const groundLeft = F.P(u0, 0, -half);
    const groundRight = F.P(u0, 0, half);
    const bottom =
      Math.min(
        ground(groundLeft[0], groundLeft[2]),
        ground(tread[0], tread[2]),
        ground(groundRight[0], groundRight[2]),
        y,
      ) - 0.17;
    const treadBase = Math.max(bottom + 0.055, y - 0.38);
    if (level === 0) fbox(out, 'earth', cross, -half, half, bottom, y, heel, toe, path);
    else {
      fbox(out, 'earth', cross, -half + 0.13, half - 0.13, bottom, treadBase, heel, toe, mass);
      const stones = level === 1 ? 2 : level === 2 ? 3 : 4;
      const width = stair.width / stones;
      for (let j = 0; j < stones; j++) {
        const k = short ? 412 + i * 17 + j : 99 + i * 17 + j;
        const u = -half + width * j + side * (j === 0 ? 0 : 1);
        const next = -half + width * (j + 1) + side * (j + 1 === stones ? 0 : 1);
        const stepTop = y + (variation(k) - 0.5) * 0.12;
        const treadFace = toe + (variation(k + 16) - 0.5) * 0.15;
        dryStone(
          out,
          cross,
          u + 0.009,
          next - 0.009,
          Math.min(treadBase, stepTop - 0.13),
          stepTop,
          heel,
          treadFace,
          k,
          level >= 2,
        );
      }
    }
  }
  if (!short) return;
  const rise = pathHeight(length) - pathHeight(0);
  for (const side of [-1, 1]) {
    const p = F.P(length * 0.45, 0, side * (half + 0.42));
    const wallFace = facade([p[0], p[2]], F.along);
    const y = ground(p[0], p[2]) - 0.18;
    const thick = 0.64;
    const rows = level === 0 ? 1 : 3;
    for (let i = 0; i < rows; i++)
      dryStone(
        out,
        wallFace,
        -0.95 + i * 0.08,
        0.91 - i * 0.07,
        y + (i * (rise + 0.36)) / rows,
        y + ((i + 1) * (rise + 0.36)) / rows,
        -thick,
        thick,
        600 + i * 17 + side,
        level >= 2,
      );
  }
}

function marker(out, point, letter, level) {
  const [x, z, y] = point;
  if (level === 0) return;
  const F = facade([x, z], [1, 0]);
  for (const u of [-0.61, 0.61])
    fbox(out, 'timber', F, u - 0.075, u + 0.075, y - 0.2, y + 1.46, -0.11, 0.02, timber);
  fbox(out, 'timber', F, -0.77, 0.77, y + 0.69, y + 1.48, -0.12, 0.13, sign);
  if (level >= 2) {
    for (let i = 0; i < 3; i++)
      fbox(
        out,
        'timber',
        F,
        -0.62,
        0.38 + variation(letter + i) * 0.19,
        y + 0.87 + i * 0.15,
        y + 0.893 + i * 0.15,
        0.132,
        0.14,
        timber,
      );
  }
}

function build(out, level) {
  Object.values(remains.walls).forEach((section, index) => {
    wall(out, section, level, 109 + index * 19);
  });
  staircase(out, remains.stairs.mainStair, level, false);
  staircase(out, remains.stairs.hiraiStair, level, true);
  marker(out, remains.markers.castle, 3, level);
  marker(out, remains.markers.honmaru, 7, level);
  marker(out, remains.markers.hirai, 13, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kannonji-castle-model.mjs';
const camera = [118, 99, 167];
const lookAt = [-15, -0.7, -10];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'castle-ruins',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The weathered stairs, retaining walls and entrance masonry of the central Kannonji Castle ruins on their original hillside.',
  camera,
  lookAt,
  sunDirection: [47, 68, 19],
  mediumFiContext: {
    scale: 1.08,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map(({ graph }) => graph),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'rough-stone-stair', position: [72, 4, -19], lookAt: [26, -2.0, -37] },
    { name: 'hirai-maru-gate-and-wall', position: [-29, -3.45, 103], lookAt: [-40.5, -9.6, 86.4] },
    { name: 'western-retaining-walls', position: [-114, 23, -22], lookAt: [-20, 2, -34] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kannonji-castle-' + reviewLod,
    position: [82, 24, -9],
    lookAt: [25, -1, -35],
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.98,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.065, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry informed by exact public-domain Qualla photographs by ブレイズマン, OpenStreetMap route and masonry lines, and GSI numerical elevations.',
};

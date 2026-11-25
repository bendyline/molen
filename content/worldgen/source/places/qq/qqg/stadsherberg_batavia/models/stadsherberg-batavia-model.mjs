import { readFileSync } from 'node:fs';
import {
  abox,
  fbox,
  lathe,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/stadsherberg-batavia-shape-controls');
const ring = site.mappedRing;
const floor = 0.83;
const front = 8.06;
const back = -8.1;
const frontWall = 4.04;
const west = wallFace([-10.94, front], [10.94, front]);
const verandaWall = wallFace([-10.95, frontWall], [10.95, frontWall]);

const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  cut: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9 },
  plinth: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  awning: { slot: 'roof', localRef: 'palette:#c5b9a1', roughness: 0.86 },
  dark: { slot: 'window', localRef: 'palette:#4c493b', roughness: 0.78 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.94 },
};

const tint = {
  wall: rgb('e2d6ba'),
  rough: rgb('bda982'),
  cut: rgb('e4d6b8'),
  roof: rgb('765746'),
  rearRoof: rgb('705343'),
  roofEdge: rgb('9a775f'),
  cloth: rgb('c6bca1'),
  fold: rgb('afa78d'),
  wood: rgb('645448'),
  glass: rgb('464842'),
  plinth: rgb('8e816e'),
  sign: rgb('5b4c3a'),
};

function tileRoof(out, lod, size, tintRoof) {
  const { x0, x1, z0, z1, left, right, center, wallTop, ridge } = size;
  const a = [x0, wallTop, z1],
    b = [x1, wallTop, z1];
  const c = [x1, wallTop, z0],
    d = [x0, wallTop, z0];
  const p = [left, ridge, center],
    q = [right, ridge, center];
  quad4(out, 'tiles', a, b, q, p, tintRoof);
  quad4(out, 'tiles', c, d, p, q, tintRoof);
  tri(out, 'tiles', b, c, q, tintRoof);
  tri(out, 'tiles', d, a, p, tintRoof);
  abox(
    out,
    'tiles',
    [left - 0.12, ridge - 0.012, center - 0.11],
    [right + 0.12, ridge + 0.13, center + 0.11],
    tint.roofEdge,
  );
  if (lod < 2) return;
  // Short bands run along the tile courses and taper at the hips.
  const count = lod === 3 ? 17 : 8;
  for (const edge of [z0, z1]) {
    for (let i = 1; i < count; i++) {
      const t = i / count;
      const xL = x0 + t * (left - x0),
        xR = x1 + t * (right - x1);
      const z = edge + t * (center - edge),
        y = wallTop + t * (ridge - wallTop);
      const t2 = t + 0.011;
      const z2 = edge + t2 * (center - edge);
      const y2 = wallTop + t2 * (ridge - wallTop);
      const points = [
        [xL + 0.075, y + 0.018, z],
        [xR - 0.075, y + 0.018, z],
        [x1 + t2 * (right - x1) - 0.075, y2 + 0.018, z2],
        [x0 + t2 * (left - x0) + 0.075, y2 + 0.018, z2],
      ];
      if (edge === z0) points.reverse();
      quad4(out, 'tiles', ...points, i % 3 === 0 ? tint.roofEdge : tintRoof);
    }
  }
}

function shutter(out, face, center, y, width, height, lod, doorway) {
  const x0 = center - width / 2,
    x1 = center + width / 2;
  fbox(out, 'dark', face, x0, x1, y, y + height, -0.008, 0.042, tint.glass);
  if (!lod) return;
  for (const x of [x0, x1]) {
    fbox(out, 'wood', face, x - 0.056, x + 0.056, y, y + height, -0.02, 0.09, tint.wood);
  }
  fbox(
    out,
    'cut',
    face,
    x0 - 0.15,
    x1 + 0.15,
    y + height,
    y + height + 0.11,
    -0.012,
    0.107,
    tint.cut,
  );
  if (!doorway)
    fbox(out, 'cut', face, x0 - 0.13, x1 + 0.13, y - 0.1, y + 0.02, -0.016, 0.16, tint.cut);
  if (lod < 2) return;
  fbox(
    out,
    'wood',
    face,
    center - 0.036,
    center + 0.036,
    y,
    y + height * 0.83,
    0.036,
    0.093,
    tint.wood,
  );
  const bars = lod === 3 ? 9 : 4;
  for (let i = 1; i <= bars; i++) {
    const h = y + (i * height * 0.78) / (bars + 1);
    fbox(out, 'wood', face, x0 + 0.045, x1 - 0.045, h, h + 0.036, 0.039, 0.074, tint.wood);
  }
}

function shell(out, lod) {
  abox(
    out,
    'plinth',
    [ring[0][0], -1.15, ring[2][1]],
    [ring[1][0], floor, ring[0][1]],
    tint.plinth,
    { bottom: false },
  );
  abox(out, 'plaster', [-10.95, floor - 0.015, back], [10.95, 5.34, frontWall], tint.wall);
  const main = {
    x0: -11.23,
    x1: 11.22,
    z0: -3.92,
    z1: 4.89,
    left: -6.82,
    right: 6.87,
    center: 0.54,
    wallTop: 5.38,
    ridge: 8.69,
  };
  const rear = {
    x0: -10.62,
    x1: 11.39,
    z0: -8.49,
    z1: -0.12,
    left: -6.1,
    right: 7.62,
    center: -4.45,
    wallTop: 5.3,
    ridge: 8.49,
  };
  tileRoof(out, lod, rear, tint.rearRoof);
  tileRoof(out, lod, main, tint.roof);
  const sideR = wallFace([10.95, frontWall], [10.95, back]);
  const sideL = wallFace([-10.95, back], [-10.95, frontWall]);
  const east = wallFace([10.95, back], [-10.95, back]);
  for (const face of [sideR, sideL, east]) {
    const fractions = face === east ? [0.12, 0.29, 0.5, 0.71, 0.88] : [0.19, 0.53, 0.82];
    if (lod === 0) continue;
    for (const [i, t] of fractions.entries()) {
      const doorway = (i === 1 && face === sideR) || (i === 2 && face === east);
      shutter(
        out,
        face,
        face.length * t,
        doorway ? floor + 0.04 : 1.88,
        doorway ? 1.36 : 1.16,
        doorway ? 3.03 : 2.07,
        lod,
        doorway,
      );
    }
    fbox(
      out,
      'plinth',
      face,
      0.015,
      face.length - 0.015,
      floor - 0.12,
      floor + 0.41,
      -0.035,
      0.035,
      tint.rough,
    );
  }
  for (let i = 0; i < 7; i++) {
    shutter(
      out,
      verandaWall,
      1.81 + i * 3.04,
      i % 2 ? 1.39 : floor + 0.08,
      1.58,
      i % 2 ? 2.29 : 2.96,
      lod,
      i % 2 === 0,
    );
  }
}

function rowOfBalusters(out, lod, face, starts, ends) {
  const y = 6.07;
  fbox(out, 'cut', face, starts, ends, y, y + 0.14, -0.27, 0.06, tint.cut);
  fbox(out, 'cut', face, starts, ends, y + 0.78, y + 0.94, -0.28, 0.075, tint.cut);
  const sections = Math.max(2, Math.round((ends - starts) / 2.7));
  for (let i = 0; i <= sections; i++) {
    const u = starts + (i * (ends - starts)) / sections;
    fbox(out, 'cut', face, u - 0.14, u + 0.14, y + 0.11, y + 0.85, -0.26, 0.05, tint.cut);
  }
  if (lod === 0) return;
  const stride = lod === 3 ? 0.31 : lod === 2 ? 0.47 : 0.61;
  for (let u = starts + 0.29; u < ends - 0.19; u += stride) {
    const shape = face.P(u, 0, -0.1);
    if (lod < 3) {
      fbox(out, 'cut', face, u - 0.048, u + 0.048, y + 0.14, y + 0.8, -0.16, -0.025, tint.cut);
    } else {
      lathe(
        out,
        'cut',
        [shape[0], shape[2]],
        [
          [y + 0.12, 0.071, 0.071],
          [y + 0.26, 0.054, 0.054],
          [y + 0.42, 0.073, 0.073],
          [y + 0.58, 0.042, 0.042],
          [y + 0.81, 0.047, 0.047],
        ],
        5,
        tint.cut,
      );
    }
  }
}

function valance(out, lod) {
  const lower = 4.62,
    upper = 5.47;
  const outer = 9.38,
    inner = 8.0;
  const a = [-11.35, lower, outer],
    b = [11.4, lower, outer];
  const c = [10.9, upper, inner],
    d = [-10.92, upper, inner];
  quad4(out, 'awning', a, b, c, d, tint.cloth);
  quad4(out, 'awning', d, c, b, a, tint.fold);
  const south = [[11.4, lower, outer], [11.4, lower, 5.06], [10.88, upper, 5.06], c];
  const north = [[-11.35, lower, 5.03], [-11.35, lower, outer], d, [-10.92, upper, 5.03]];
  for (const corners of [south, north]) {
    quad4(out, 'awning', ...corners, tint.cloth);
    quad4(out, 'awning', ...corners.slice().reverse(), tint.fold);
  }
  const face = wallFace([a[0], a[2]], [b[0], b[2]]);
  fbox(out, 'awning', face, 0, face.length, lower - 0.12, lower + 0.005, -0.035, 0.03, tint.cloth);
  if (lod < 2) return;
  const strips = lod === 3 ? 145 : 58;
  const stride = face.length / strips;
  for (let i = 1; i < strips; i++) {
    const x = a[0] + i * stride;
    const ridgeX = d[0] + (i * (c[0] - d[0])) / strips;
    quad4(
      out,
      'awning',
      [x - 0.012, lower + 0.013, outer - 0.02],
      [x + 0.017, lower + 0.013, outer - 0.02],
      [ridgeX + 0.017, upper + 0.013, inner],
      [ridgeX - 0.012, upper + 0.013, inner],
      tint.fold,
    );
    fbox(
      out,
      'awning',
      face,
      i * stride - 0.04,
      i * stride + 0.04,
      lower - 0.25,
      lower - 0.107,
      -0.018,
      0.019,
      tint.cloth,
    );
  }
}

const alphabet = {
  A: ['01110', '10001', '11111', '10001', '10001'],
  B: ['11110', '10001', '11110', '10001', '11110'],
  D: ['11110', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '11110', '10000', '11111'],
  G: ['01111', '10000', '10111', '10001', '01110'],
  H: ['10001', '10001', '11111', '10001', '10001'],
  R: ['11110', '10001', '11110', '10100', '10011'],
  S: ['01111', '10000', '01110', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  '-': ['00000', '00000', '01110', '00000', '00000'],
};

function lettering(out) {
  const text = 'STADS-HERBERG';
  const pixel = 0.076;
  const offset = (west.length - text.length * 6 * pixel) / 2;
  for (const [i, char] of [...text].entries()) {
    for (const [j, row] of alphabet[char].entries()) {
      for (const [k, p] of [...row].entries()) {
        if (p !== '1') continue;
        const x = offset + (i * 6 + k) * pixel;
        const y = 5.96 - (j + 1) * pixel;
        quad4(
          out,
          'wood',
          west.P(x, y, 0.066),
          west.P(x + pixel, y, 0.066),
          west.P(x + pixel, y + pixel, 0.066),
          west.P(x, y + pixel, 0.066),
          tint.sign,
        );
      }
    }
  }
}

function veranda(out, lod) {
  const columnY = 5.33;
  for (let i = 0; i < 8; i++) {
    const x = -10.47 + (20.94 * i) / 7;
    const corner = i === 0 || i === 7;
    if (corner) {
      abox(out, 'cut', [x - 0.38, floor, 7.25], [x + 0.38, columnY, 8.03], tint.cut);
    } else {
      const detail = [6, 10, 14, 20][lod];
      lathe(
        out,
        'cut',
        [x, 7.64],
        [
          [floor, 0.31, 0.31],
          [1.03, 0.3, 0.3],
          [1.14, 0.24, 0.24],
          [columnY - 0.21, 0.19, 0.19],
          [columnY, 0.32, 0.32],
        ],
        detail,
        tint.cut,
      );
    }
    if (lod > 0) {
      const radius = corner ? 0.43 : 0.36;
      abox(
        out,
        'cut',
        [x - radius, columnY - 0.06, 7.64 - radius],
        [x + radius, columnY + 0.125, 7.64 + radius],
        tint.cut,
      );
    }
  }
  for (const x of [-10.47, 10.47]) {
    abox(out, 'cut', [x - 0.37, floor, 4.3], [x + 0.37, columnY, 5.02], tint.cut);
  }
  abox(out, 'plaster', [-11, 5.24, 4.0], [11, 6.08, front + 0.047], tint.wall);
  const north = wallFace([-10.94, 4.0], [-10.94, front]);
  const south = wallFace([10.94, front], [10.94, 4.0]);
  for (const face of [west, north, south]) {
    fbox(out, 'cut', face, -0.1, face.length + 0.1, 5.24, 5.42, -0.025, 0.18, tint.cut);
    fbox(out, 'cut', face, -0.17, face.length + 0.17, 5.997, 6.16, -0.012, 0.229, tint.cut);
    rowOfBalusters(out, lod, face, 0.07, face.length - 0.08);
  }
  for (const [i, y, z] of [
    [0, 0.31, 9.22],
    [1, 0.55, 8.87],
    [2, floor, 8.5],
  ]) {
    const w = 2.87 - i * 0.18;
    abox(out, 'plinth', [-w, -0.21, z - 0.45], [w, y, z], tint.rough, { bottom: false });
  }
  valance(out, lod);
  if (lod > 1) lettering(out);
}

function build(out, lod) {
  shell(out, lod);
  veranda(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'stadsherberg-batavia-model.mjs';
const camera = [20, 13, 35];
const lookAt = [0, 3.8, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historic-inn',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The 1860s Stadsherberg inn on the east quay of old Batavia, with eight columns, a balustraded veranda, a fabric awning and tiled hip roofs.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: site.validFrom,
    validUntil: site.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [21, 30, 42],
  mediumFiContext: {
    scale: 0.9,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    minimumCoverage: 0.91,
    basis: 'Photo-derived former inn envelope registered to the nineteenth-century east quay site.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'canal-veranda-and-awning', position: [0, 6.65, 26], lookAt: [0, 4.09, 5.8] },
    { name: 'quay-side-entrance-lettering', position: [16.2, 7.12, 20], lookAt: [1.1, 5.11, 7.96] },
    { name: 'hipped-tile-roofs', position: [25, 20, -14.4], lookAt: [0, 5.0, 1.2] },
    { name: 'rear-service-elevation', position: [-23, 9.7, -28.1], lookAt: [0, 3.8, -4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'stadsherberg-batavia-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.45,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.2, surfaces },
      street: { export: 'street', errorMeters: 0.075, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.021, surfaces },
    },
  },
};

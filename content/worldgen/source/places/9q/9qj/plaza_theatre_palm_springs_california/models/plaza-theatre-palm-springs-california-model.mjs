import fs from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  opening,
  quad4,
  rgb,
  roundArch,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor, frontEave, auditoriumEave } = plan.dimensions;
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.9 },
  stone: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.93 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66 },
  sign: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
};
const paint = rgb('ddd4be');
const limestone = rgb('e8dfc3');
const soffit = rgb('a89b82');
const tile = rgb('aa6e55');
const wood = rgb('825f4d');
const glass = rgb('464941');
const stone = rgb('a48471');
const letters = rgb('4c5248');
const front = -25.6;
const F = facade([front, -0.13], [0, 1]);
const south = facade([0, 10.89], [1, 0]);
const frontBays = [-4.28, 0, 4.28];

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function hip(out, x0, x1, z0, z1, eave, ridge) {
  const [a, b, c, d] = [
    [x0, eave, z1],
    [x1, eave, z1],
    [x1, eave, z0],
    [x0, eave, z0],
  ];
  const h = Math.min((z1 - z0) / 2, (x1 - x0) * 0.37);
  const p = [x0 + h, ridge, (z0 + z1) / 2],
    q = [x1 - h, ridge, (z0 + z1) / 2];
  quad4(out, 'roof', a, b, q, p, tile);
  tri(out, 'roof', b, c, q, tile);
  quad4(out, 'roof', c, d, p, q, tile);
  tri(out, 'roof', d, a, p, tile);
  block(out, 'trim', x0, x1, z0, z1, eave - 0.15, eave, wood);
}

function westArcade(out, lod) {
  const width = 3.58,
    half = width / 2,
    spring = 2.39,
    depth = 0.39;
  const span = 11.32;
  const level = 4.44;
  let start = -span;
  for (const u of frontBays) {
    fbox(out, 'wall', F, start, u - half, floor, level, -depth, 0, paint);
    const points = roundArch(half, lod === 0 ? 6 : lod === 1 ? 8 : 12);
    const band = F.P(u, spring, 0);
    for (let i = 0; i < points.length - 1; i++) {
      const [a, ya] = points[i],
        [b, yb] = points[i + 1];
      const A = F.P(u + a, spring + ya, 0),
        B = F.P(u + b, spring + yb, 0);
      quad4(out, 'wall', A, B, F.P(u + b, level, 0), F.P(u + a, level, 0), paint);
      quad4(
        out,
        'wall',
        B,
        A,
        F.P(u + a, spring + ya, -depth),
        F.P(u + b, spring + yb, -depth),
        soffit,
      );
      if (lod > 1) {
        const offset = ([x, y]) => F.P(u + x * 1.07, spring + y * 1.07, 0.057);
        quad4(
          out,
          'trim',
          [A[0] - 0.06, A[1], A[2]],
          offset(points[i]),
          offset(points[i + 1]),
          [B[0] - 0.06, B[1], B[2]],
          wood,
        );
      }
    }
    const glazing = facade([band[0] + 0.42, -0.13], [0, 1]);
    opening(out, glazing, u, floor + 0.04, width - 0.09, 3.77, {
      glassSlot: 'glass',
      frameSlot: 'sign',
      glass,
      frame: letters,
      head: 'round',
      d: 0,
      frameWidth: 0,
      sill: false,
      mullions: lod > 0 ? 3 : 0,
      transoms: lod > 1 ? 3 : 0,
      frameDepth: 0.038,
    });
    start = u + half;
  }
  fbox(out, 'wall', F, start, span, floor, level, -depth, 0, paint);
  fbox(out, 'stone', F, -6.72, 6.72, -0.39, floor, -0.59, 0.62, stone);
  fbox(out, 'wall', F, -span, span, level, 5.06, -depth, 0, paint);
  fbox(out, 'wall', F, -span, span, 7.68, frontEave, -depth, 0, paint);
}

function upperBalcony(out, lod) {
  let start = -11.32;
  const s = 5.06,
    e = 7.68;
  for (const u of frontBays) {
    const left = u - 1.74,
      right = u + 1.74,
      corner = 0.24;
    fbox(out, 'wall', F, start, left, s, e, -0.42, 0, paint);
    tri(out, 'wall', F.P(left, e - corner), F.P(left + corner, e), F.P(left, e), paint);
    tri(out, 'wall', F.P(right, e - corner), F.P(right, e), F.P(right - corner, e), paint);
    if (lod > 0) {
      for (const x of [left, right])
        fbox(out, 'trim', F, x - 0.055, x + 0.055, s, e - corner, -0.04, 0.073, wood);
      for (const [x, dx] of [
        [left, corner],
        [right, -corner],
      ])
        beam(out, 'trim', F.P(x, e - corner, 0.038), F.P(x + dx, e, 0.038), 0.105, 0.106, wood);
      fbox(out, 'trim', F, left + corner, right - corner, e - 0.061, e + 0.03, -0.04, 0.08, wood);
      fbox(out, 'trim', F, left, right, s, s + 0.32, -0.08, 0.057, wood);
      opening(out, facade([front + 1.15, -0.13], [0, 1]), u, 5.22, 0.94, 1.99, {
        frameSlot: 'trim',
        glassSlot: 'glass',
        glass: wood,
        frame: wood,
        frameWidth: 0.055,
        head: 'flat',
        sill: false,
        transoms: lod === 3 ? 1 : 0,
        frameDepth: 0.05,
      });
    }
    start = right;
  }
  fbox(out, 'wall', F, start, 11.32, s, e, -0.42, 0, paint);
  fbox(out, 'wall', F, -11.32, 11.32, s, e, -1.28, -1.22, soffit);
  if (lod > 1)
    for (let i = -7; i < 8; i++)
      fbox(out, 'trim', F, i * 1.2 - 0.07, i * 1.2 + 0.07, 7.64, 7.77, -1.24, 0.04, wood);
}

const strokes = {
  P: [
    [
      [0, 0],
      [0, 1],
      [0.88, 1],
      [1, 0.77],
      [0.88, 0.56],
      [0, 0.56],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  A: [
    [
      [0, 0],
      [0.46, 1],
      [0.56, 1],
      [1, 0],
    ],
    [
      [0.22, 0.43],
      [0.8, 0.43],
    ],
  ],
  Z: [
    [
      [0, 1],
      [1, 1],
      [0, 0],
      [1, 0],
    ],
  ],
  T: [
    [
      [0, 1],
      [1, 1],
    ],
    [
      [0.5, 1],
      [0.5, 0],
    ],
  ],
  H: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0.53],
      [1, 0.53],
    ],
  ],
  E: [
    [
      [1, 1],
      [0, 1],
      [0, 0],
      [1, 0],
    ],
    [
      [0, 0.54],
      [0.81, 0.54],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.83, 1],
      [1, 0.79],
      [0.84, 0.55],
      [0, 0.55],
    ],
    [
      [0.45, 0.55],
      [1, 0],
    ],
  ],
};

function roofSign(out, lod) {
  for (const sign of [-1, 1]) {
    const trim = facade([-23.26, sign * 2.22], [sign * 0.22, 1]);
    fbox(out, 'wall', trim, -2.14, 2.14, 8.93, 11.1, -0.12, 0.1, limestone);
    const y = 11.1,
      d = 0.101;
    quad4(
      out,
      'wall',
      trim.P(-2.14, y, d),
      trim.P(2.14, y, d),
      trim.P(1.56, y + 0.21, d),
      trim.P(-1.64, y + 0.21, d),
      limestone,
    );
    tri(
      out,
      'wall',
      trim.P(-1.64, y + 0.21, d),
      trim.P(1.56, y + 0.21, d),
      trim.P(-0.12, y + 0.51, d),
      limestone,
    );
    fbox(out, 'roof', trim, -2.2, 2.2, 9.36, 9.51, -0.21, 0.23, tile);
    if (lod > 1) {
      for (const [word, line] of [
        ['PLAZA', 10.51],
        ['THEATRE', 9.86],
      ]) {
        const spacing = word.length === 5 ? 0.66 : 0.54,
          width = spacing * 0.79;
        for (const [i, c] of [...word].entries()) {
          const u = (i - (word.length - 1) / 2) * spacing - width / 2;
          const p = ([x, y]) => trim.P(u + x * width, line + y * 0.39, 0.128);
          for (const path of strokes[c])
            for (let j = 0; j < path.length - 1; j++)
              beam(out, 'sign', p(path[j]), p(path[j + 1]), 0.052, 0.05, letters);
        }
      }
    }
  }
}

function auditorium(out, lod) {
  block(out, 'wall', front + 5.1, 23.95, -11.49, 10.8, floor, auditoriumEave, paint);
  block(out, 'wall', front + 0.01, front + 5.14, -11.46, -10.91, floor, frontEave, paint);
  block(out, 'wall', front + 0.01, front + 5.14, 10.84, 11.05, floor, frontEave, paint);
  block(out, 'wall', 23.75, 25.51, -10.05, -4.72, floor, 6.82, soffit);
  hip(out, -26.12, -13.1, -11.81, 11.6, frontEave, 10.6);
  hip(out, -20.71, 24.35, -11.82, 11.22, auditoriumEave, 13.36);
  for (const x of [-16.38, -7.47, 2.06]) {
    block(out, 'wall', x - 0.63, x + 0.63, 10.32, 11.06, 7.38, 11.93, paint);
    block(out, 'trim', x - 0.76, x + 0.76, 10.24, 11.19, 11.78, 12.01, soffit);
  }
  const openings = [-19.1, -15.45, -11.8, -8.15, -4.5];
  for (const u of openings) {
    opening(out, south, u, 0.82, 2.66, 4.48, {
      glassSlot: 'glass',
      frameSlot: 'trim',
      glass,
      frame: wood,
      head: 'round',
      d: 0.035,
      frameWidth: lod > 1 ? 0.12 : 0,
      sill: false,
      frameDepth: 0.105,
      mullions: lod > 1 ? 2 : 0,
      transoms: lod > 2 ? 1 : 0,
    });
    if (lod > 1 && openings.indexOf(u) % 2 === 0)
      for (const [dx, dy] of [
        [-0.14, 0],
        [0.14, 0],
        [0, 0.14],
        [0, -0.14],
      ])
        fbox(
          out,
          'trim',
          south,
          u + dx - 0.092,
          u + dx + 0.092,
          7.25 + dy,
          7.45 + dy,
          0,
          0.065,
          soffit,
        );
  }
  if (lod > 0) {
    const back = facade([25.51, -7.37], [0, -1]);
    opening(out, back, 0, 0.56, 2.16, 2.5, {
      glassSlot: 'glass',
      frameSlot: 'trim',
      glass: wood,
      head: 'flat',
      frameWidth: 0,
      sill: false,
      d: 0.044,
    });
  }
}

function build(out, lod) {
  extrude(out, 'stone', frame.geometry.outline, foundation, floor, stone, { top: false });
  auditorium(out, lod);
  westArcade(out, lod);
  upperBalcony(out, lod);
  roofSign(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'plaza-theatre-palm-springs-california-model.mjs';
const camera = [-57, 15, 29];
const lookAt = [-6, 5.0, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'theatre',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Spanish Colonial Revival Plaza Theatre in Palm Springs, with its triple entry arcade, inset balcony, clay hip roofs and two-faced theatre sign.',
  camera,
  lookAt,
  sunDirection: [-30, 47, 23],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The county parcel containing the historic theatre.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-entrance-and-theatre-roofs', position: camera, lookAt },
    { name: 'arcade-balcony-and-sign', position: [-45, 6.8, -1], lookAt: [-24, 5.6, 0] },
    { name: 'southern-arches-and-clay-roofs', position: [33, 20, 30], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'plaza-theatre-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

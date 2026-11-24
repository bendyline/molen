import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  facade,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const map = read('map-frame');
const geometry = read('native-map/irving-house-shape-controls');
const [left, right, back, front] = geometry.mainWing;
const [rearLeft, rearRight, rearBack, rearFront] = geometry.rearWing;
const center = geometry.wallCenter;
const color = Object.fromEntries(
  Object.entries({
    clapboard: 'd3cabb',
    flank: 'c4bbab',
    cream: 'e1d7c8',
    trimShade: 'b3a691',
    brick: '9f7160',
    brickDark: '825547',
    shingles: '67625c',
    shinglesDark: '56544f',
    wood: '8e7c66',
    glass: '586364',
    dark: '494a49',
    shutter: '6a7165',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const surfaces = {
  siding: { slot: 'wall', graph: 'siding_lap', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.96 },
  brick: { slot: 'foundation', graph: 'brick', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'wood_painted_lap', roughness: 0.92 },
  boards: { slot: 'door', graph: 'wood_plain', roughness: 0.92 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.81 },
};
const floor = 0.86;
const eaves = 5.38;
const ridge = 10.52;
const porchRoof = 4.72;
const porchFront = geometry.porchFrontZ - 0.17;
const frontFace = facade([0, front], [1, 0]);
const backFace = facade([0, rearBack], [-1, 0]);
const leftFace = facade([left, 0], [0, 1]);
const rightFace = facade([right, 0], [0, -1]);

function sash(out, face, u, y, width, height, level, shutters = false, head = 'flat') {
  opening(out, face, u, y, width, height, {
    head,
    glassSlot: 'glass',
    glass: color.glass,
    frameSlot: 'trim',
    frame: color.cream,
    frameWidth: level >= 2 ? 0.094 : 0,
    frameDepth: 0.102,
    d: 0.035,
    sill: level >= 2,
    mullions: level >= 2 ? 1 : 0,
    transoms: level >= 2 ? 1 : 0,
  });
  if (!shutters) return;
  for (const direction of [-1, 1]) {
    const x = u + direction * (width * 0.72 + 0.14);
    fbox(
      out,
      'boards',
      face,
      x - width * 0.205,
      x + width * 0.205,
      y + 0.02,
      y + height - 0.04,
      0.015,
      0.095,
      color.shutter,
    );
    if (level === 3)
      for (let strip = 1; strip <= 8; strip++) {
        const y1 = y + (strip * height) / 9;
        fbox(
          out,
          'boards',
          face,
          x - width * 0.175,
          x + width * 0.175,
          y1,
          y1 + 0.022,
          0.095,
          0.12,
          color.dark,
        );
      }
  }
}

function door(out, face, u, y, width, height, level) {
  fbox(
    out,
    'boards',
    face,
    u - width * 0.5,
    u + width * 0.5,
    y,
    y + height,
    0.009,
    0.08,
    color.shutter,
  );
  sash(out, face, u, y + height * 0.38, width * 0.72, height * 0.5, level);
  if (level >= 2) {
    const side = width * 0.5 + 0.19;
    for (const x of [u - side, u + side]) sash(out, face, x, y + 0.58, 0.28, height - 0.72, level);
    sash(out, face, u, y + height + 0.035, width * 1.14, 0.29, level);
  }
}

function chimneys(out, level) {
  for (const [x, z, top] of [
    [-5.28, 0.92, 11.68],
    [3.04, 0.54, 11.94],
  ]) {
    abox(out, 'brick', [x - 0.39, 8.42, z - 0.31], [x + 0.39, top - 0.3, z + 0.31], color.brick);
    abox(
      out,
      'brick',
      [x - 0.49, top - 0.32, z - 0.4],
      [x + 0.49, top - 0.135, z + 0.4],
      color.brickDark,
    );
    abox(out, 'brick', [x - 0.44, top - 0.14, z - 0.35], [x + 0.44, top, z + 0.35], color.brick);
    if (level >= 2)
      abox(
        out,
        'trim',
        [x - 0.21, top - 0.02, z - 0.15],
        [x + 0.21, top + 0.035, z + 0.15],
        color.dark,
        { bottom: false },
      );
  }
}

function finial(out, x, z, y, level) {
  const profile =
    level >= 2
      ? [
          [y - 0.24, 0.08],
          [y + 0.14, 0.08],
          [y + 0.17, 0.145],
          [y + 0.35, 0.09],
          [y + 0.51, 0.098],
          [y + 0.75, 0.005],
        ]
      : [
          [y - 0.15, 0.11],
          [y + 0.38, 0.09],
          [y + 0.72, 0.005],
        ];
  lathe(
    out,
    'trim',
    [x, z],
    profile.map(([yy, radius]) => [yy, radius, radius]),
    level >= 2 ? 8 : 4,
    color.cream,
    { capTop: false },
  );
}

function gableTrim(out, face, u, y0, y1, half, level) {
  const d = 0.091;
  for (const direction of [-1, 1]) {
    const p = (pct, off = 0) => face.P(u + direction * half * pct, y1 + (y0 - y1) * pct + off, d);
    beam(out, 'trim', p(0), p(1), 0.184, 0.143, color.cream);
    if (level >= 2) {
      beam(out, 'trim', p(0.04, -0.325), p(1, -0.325), 0.114, 0.106, color.cream);
      const bays = level === 3 ? 11 : 7;
      for (let i = 0; i < bays; i++) {
        const x = (i + 0.23) / bays;
        const tip = (i + 0.73) / bays;
        beam(out, 'trim', p(x, -0.325), p(tip, -0.042), 0.085, 0.09, color.cream);
        beam(out, 'trim', p(x, -0.04), p(tip, -0.325), 0.065, 0.073, color.cream);
      }
    }
  }
}

function trefoil(out, face, u, y, level) {
  const segments = level >= 2 ? 9 : 6;
  for (const [du, dy] of [
    [-0.18, 0],
    [0.18, 0],
    [0, 0.23],
  ]) {
    const p = (radius, i, d) => {
      const angle = (i * 2 * Math.PI) / segments;
      return face.P(u + du + radius * Math.cos(angle), y + dy + radius * Math.sin(angle), d);
    };
    if (level >= 2)
      for (let i = 0; i < segments; i++)
        quad4(
          out,
          'trim',
          p(0.216, i, 0.082),
          p(0.282, i, 0.082),
          p(0.282, i + 1, 0.082),
          p(0.216, i + 1, 0.082),
          color.cream,
        );
    fan(
      out,
      'glass',
      Array.from({ length: segments }, (_, i) => p(0.225, i, 0.092 + dy * 0.015)),
      color.dark,
    );
  }
}

function body(out, level) {
  abox(
    out,
    'brick',
    [left - 0.053, -2.2, back],
    [right + 0.053, floor + 0.06, front],
    color.brickDark,
  );
  abox(
    out,
    'brick',
    [rearLeft - 0.083, -2.73, rearBack],
    [rearRight + 0.083, floor + 0.04, rearFront],
    color.brickDark,
  );
  abox(out, 'siding', [left, floor, back], [right, eaves, front], color.clapboard);
  abox(out, 'siding', [rearLeft, floor, rearBack], [rearRight, 4.2, rearFront + 0.13], color.flank);
  const middle = (back + front) / 2;
  const width = front - back;
  gableRoof(out, 'roof', [left, middle], [right, middle], width, eaves, ridge, color.shingles, {
    endSlot: 'siding',
    endColor: color.clapboard,
    overhang: 0.36,
  });
  gableRoof(
    out,
    'roof',
    [center, front + 0.16],
    [center, middle + 0.58],
    6.74,
    eaves - 0.03,
    9.96,
    color.shinglesDark,
    {
      endSlot: 'siding',
      endColor: color.clapboard,
      overhang: 0.29,
      ends: [true, false],
    },
  );
  const rearCenter = (rearLeft + rearRight) / 2;
  gableRoof(
    out,
    'roof',
    [rearCenter, rearBack],
    [rearCenter, rearFront + 0.11],
    rearRight - rearLeft,
    4.2,
    6.37,
    color.shingles,
    {
      endSlot: 'siding',
      endColor: color.flank,
      overhang: 0.29,
      ends: [true, false],
    },
  );
  chimneys(out, level);
  finial(out, center, front + 0.456, 9.96, level);
  finial(out, left - 0.36, middle, ridge, level);
  finial(out, right + 0.36, middle, ridge, level);
  const gableFace = facade([0, front + 0.44], [1, 0]);
  gableTrim(out, gableFace, center, 5.24, 9.98, 3.65, level);
  if (level) {
    const sideLeft = facade([left - 0.365, 0], [0, 1]);
    const sideRight = facade([right + 0.365, 0], [0, -1]);
    gableTrim(out, sideLeft, middle, eaves - 0.09, ridge, width * 0.5 + 0.37, level);
    gableTrim(out, sideRight, -middle, eaves - 0.09, ridge, width * 0.5 + 0.37, level);
    trefoil(out, leftFace, middle, 8.11, level);
    trefoil(out, rightFace, -middle, 8.11, level);
  }
  const upper = facade([0, front + 0.175], [1, 0]);
  sash(out, upper, center, 5.43, 1.35, 2.52, level, false, 'round');
  for (const side of [-1, 1]) sash(out, upper, center + side * 0.96, 5.48, 0.59, 1.86, level);
  door(out, frontFace, center, floor + 0.018, 1.24, 2.68, level);
  for (const x of [center - 3.82, center + 3.81])
    sash(out, frontFace, x, 0.93, 1.68, 2.52, level, true);
  for (const [face, us] of [
    [leftFace, [-2.37, 3.3]],
    [rightFace, [-4.78, 1.11]],
  ])
    for (const u of us) {
      sash(out, face, u, 1.63, 1.22, 1.96, level, true);
      sash(out, face, u, 6.06, 0.95, 1.59, level, true);
    }
  if (level) {
    door(out, rightFace, -0.71, floor, 1.07, 2.25, level);
    sash(out, backFace, -1.66, 1.55, 1.31, 1.55, level, true);
    sash(out, backFace, 4.21, 1.56, 1.27, 1.55, level, true);
    sash(out, backFace, 1.42, -0.91, 0.9, 0.72, level);
    sash(out, backFace, 4.06, -0.89, 0.93, 0.71, level);
    door(out, backFace, 1.01, -1.16, 0.98, 1.82, level);
  }
}

function rail(out, face, lo, hi, y, d, spacing, level) {
  const p = face.P;
  const top = y + 0.94;
  const count = Math.max(1, Math.round((hi - lo) / spacing));
  fbox(out, 'trim', face, lo, hi, top - 0.058, top + 0.021, d - 0.074, d + 0.065, color.cream);
  fbox(out, 'trim', face, lo, hi, y + 0.12, y + 0.207, d - 0.053, d + 0.055, color.cream);
  if (level === 0) return;
  for (let i = 0; i < count; i++) {
    const u = lo + ((hi - lo) * (i + 0.5)) / count;
    if (level >= 2) {
      const w = ((hi - lo) / count) * 0.42;
      for (const sign of [-1, 1])
        beam(
          out,
          'trim',
          p(u - w, y + 0.21 + (sign > 0 ? 0 : 0.62), d),
          p(u + w, y + 0.21 + (sign > 0 ? 0.62 : 0), d),
          0.069,
          0.065,
          color.cream,
        );
    } else {
      fbox(
        out,
        'trim',
        face,
        u - 0.036,
        u + 0.036,
        y + 0.19,
        top,
        d - 0.045,
        d + 0.045,
        color.cream,
      );
    }
  }
}

function verandahRoof(out, face, outerA, outerB, innerA, innerB, depth) {
  const p = face.P;
  quad4(
    out,
    'roof',
    p(outerA, porchRoof, depth),
    p(outerB, porchRoof, depth),
    p(innerB, porchRoof + 0.46, 0),
    p(innerA, porchRoof + 0.46, 0),
    color.shingles,
  );
  quad4(
    out,
    'trim',
    p(outerA, porchRoof - 0.18, depth),
    p(outerB, porchRoof - 0.18, depth),
    p(outerB, porchRoof + 0.034, depth),
    p(outerA, porchRoof + 0.034, depth),
    color.cream,
  );
}

function verandah(out, level) {
  const porchLeft = geometry.frontage[0] + 0.21;
  const porchRight = geometry.frontage[1] - 0.16;
  const leftDepth = left - porchLeft;
  const rightDepth = porchRight - right;
  const frontDepth = porchFront - front;
  const leftEnd = back + 0.38;
  const rightEnd = back + 1.78;
  const boards = (lo, z0, hi, z1) =>
    abox(out, 'boards', [lo, floor - 0.18, z0], [hi, floor + 0.012, z1], color.wood);
  boards(porchLeft, front - 0.015, porchRight, porchFront);
  boards(porchLeft, leftEnd, left, front);
  boards(right, rightEnd, porchRight, front);
  verandahRoof(out, frontFace, porchLeft, porchRight, left, right, frontDepth);
  verandahRoof(out, leftFace, leftEnd, porchFront, leftEnd, front, leftDepth);
  verandahRoof(out, rightFace, -porchFront, -rightEnd, -front, -rightEnd, rightDepth);
  for (const [face, i, j, depth] of [
    [frontFace, porchLeft, porchRight, frontDepth],
    [leftFace, leftEnd, porchFront, leftDepth],
    [rightFace, -porchFront, -rightEnd, rightDepth],
  ]) {
    const n = face === frontFace || level ? 5 : 3;
    for (let c = 0; c <= n; c++) {
      const u = i + 0.17 + ((j - i - 0.34) * c) / n;
      const d = depth - 0.16;
      fbox(
        out,
        'trim',
        face,
        u - 0.111,
        u + 0.111,
        floor,
        porchRoof - 0.145,
        d - 0.114,
        d + 0.114,
        color.cream,
      );
      if (level >= 2) {
        for (const h of [floor + 0.015, porchRoof - 0.45])
          fbox(
            out,
            'trim',
            face,
            u - 0.158,
            u + 0.158,
            h,
            h + 0.227,
            d - 0.155,
            d + 0.155,
            color.trimShade,
          );
        for (const sign of [-1, 1])
          beam(
            out,
            'trim',
            face.P(u, porchRoof - 0.66, d),
            face.P(u + sign * 0.43, porchRoof - 0.195, d),
            0.107,
            0.092,
            color.cream,
          );
      }
    }
    if (face === frontFace) {
      rail(out, face, i + 0.19, center - 0.92, floor, depth - 0.158, 0.83, level);
      rail(out, face, center + 0.92, j - 0.18, floor, depth - 0.158, 0.83, level);
    } else {
      rail(out, face, i + 0.18, j - 0.19, floor, depth - 0.158, 0.9, level);
    }
  }
  const landing = porchFront + 0.008;
  const steps = level >= 2 ? 6 : 3;
  for (let i = 0; i < steps; i++) {
    const z = landing + (i * 1.6) / steps;
    abox(
      out,
      'boards',
      [center - 0.96, -0.27, z],
      [center + 0.96, floor * (1 - i / steps), z + 1.62 / steps],
      color.wood,
      { bottom: false },
    );
  }
  const balconyFace = facade([0, front + 0.485], [1, 0]);
  const balconyDepth = 0.83;
  abox(
    out,
    'trim',
    [center - 2.27, 5.15, front + 0.09],
    [center + 2.27, 5.39, front + 1.34],
    color.cream,
  );
  rail(out, balconyFace, center - 2.25, center + 2.25, 5.36, balconyDepth, 0.72, level);
  for (const side of [-1, 1]) {
    const at = center + side * 2.22;
    fbox(
      out,
      'trim',
      balconyFace,
      at - 0.073,
      at + 0.073,
      5.2,
      6.39,
      balconyDepth - 0.11,
      balconyDepth + 0.1,
      color.cream,
    );
    const sideFace = facade([at, front + 0.08], [0, -side]);
    rail(out, sideFace, Math.min(0, -side * 1.23), Math.max(0, -side * 1.23), 5.36, 0, 0.66, level);
  }
  if (level === 3)
    for (const [edge, z0, z1] of [
      [porchLeft + 0.04, leftEnd, front - 0.5],
      [porchRight - 0.04, rightEnd, front - 0.5],
    ]) {
      const hi = floor - 0.2;
      const base = -0.38;
      const d = z1 - z0;
      for (let i = 0; i < 24; i++) {
        const z = z0 + (d * i) / 24;
        for (const side of [-1, 1])
          beam(
            out,
            'trim',
            [edge, base, z],
            [edge, hi, z + 0.53 * side],
            0.052,
            0.035,
            color.trimShade,
          );
      }
    }
}

function build(out, level) {
  body(out, level);
  verandah(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'irving-house-model.mjs';
const camera = [-25, 16, 36];
const lookAt = [center, 4.73, 0.45];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'historical-house',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: map.terrainContact.basis,
  brief:
    'Irving House on Royal Avenue, with steep shingled gables, carved bargeboards, a Palladian balcony and a wraparound timber verandah.',
  camera,
  lookAt,
  sunDirection: [-31, 52, 55],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: outwardRing(geometry.outline),
    minimumCoverage: 0.93,
    basis:
      'The native Irving House footprint includes its attached verandah, roof and downhill wing.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'royal-avenue-gable-and-balcony', position: [0, 8.5, 27], lookAt: [center, 5.7, 8.8] },
    { name: 'wraparound-verandah-and-shutters', position: [-21, 7.9, 16], lookAt: [-2, 3.9, 2.7] },
    { name: 'brick-basement-on-downhill-side', position: [20, 5.8, -22], lookAt: [0, 3.8, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'irving-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.59,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.27, surfaces },
      street: { export: 'street', errorMeters: 0.097, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.027, surfaces },
    },
  },
};

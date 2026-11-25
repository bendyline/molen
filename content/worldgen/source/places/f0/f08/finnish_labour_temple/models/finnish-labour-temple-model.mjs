import { readFileSync } from 'node:fs';
import { withFootprintCaps } from '../../../../../../../../packages/worldgen/scripts/place-footprint-caps.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tower,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (key) => JSON.parse(readFileSync(new URL(`../${key}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const shape = read('native-map/finnish-labour-temple-shape-controls');
const ring = shape.mappedRing;
const hall = outwardRing([...ring.slice(0, 8), ...ring.slice(14)]);
const [left, right] = shape.facadeLimitsX;
const center = (left + right) / 2;
const front = shape.frontPlaneZ;
const eave = 9.76;
const façade = facade([center, front], [1, 0]);

const surfaces = {
  wall: { slot: 'wall', graph: 'brick_flemish', roughness: 0.96 },
  roof: { slot: 'roof', graph: 'slate', roughness: 0.92 },
  base: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.91 },
  window: { slot: 'window', localRef: 'palette:#5b5e5d', roughness: 0.46 },
  door: { slot: 'door', graph: 'wood_painted_lap', roughness: 0.9 },
};
const color = {
  brick: rgb('aa784f'),
  side: rgb('9d704f'),
  bay: rgb('9c6844'),
  stone: rgb('cbc1a8'),
  footing: rgb('a69b85'),
  chalk: rgb('dcd2b9'),
  eave: rgb('725e48'),
  slate: rgb('5d5e5b'),
  slateSide: rgb('656764'),
  glass: rgb('414143'),
  wood: rgb('503a2a'),
};
const rotated = -Math.PI / 8;
const towerCenter = [center, front + 0.49];

function sash(out, F, u, y, width, height, lod, offset = 0, head = 'flat') {
  if (lod === 0) {
    const p = (x, h) => F.P(u + x * width, y + h * height, offset + 0.027);
    quad4(out, 'window', p(-0.5, 0), p(0.5, 0), p(0.5, 1), p(-0.5, 1), color.glass);
    return;
  }
  opening(out, F, u, y, width, height, {
    head,
    glassSlot: 'window',
    frameSlot: 'trim',
    frame: color.chalk,
    glass: color.glass,
    frameWidth: lod > 1 ? 0.095 : 0.13,
    frameDepth: 0.07,
    d: offset + 0.025,
    mullions: lod === 3 ? 2 : 0,
    transoms: lod >= 2 ? 1 : 0,
  });
  if (lod && head === 'flat') {
    fbox(
      out,
      'base',
      F,
      u - width / 2 - 0.18,
      u + width / 2 + 0.18,
      y + height + 0.05,
      y + height + 0.21,
      offset,
      offset + 0.12,
      color.stone,
    );
  }
}

function hip(out, [x0, z0, x1, z1], y, top, halfRidge) {
  const x = (x0 + x1) / 2;
  const a = [x0, y, z0],
    b = [x1, y, z0],
    c = [x1, y, z1],
    d = [x0, y, z1];
  const r0 = [x, top, z0 + halfRidge],
    r1 = [x, top, z1 - halfRidge];
  tri(out, 'roof', b, a, r0, color.slate);
  quad4(out, 'roof', c, b, r0, r1, color.slateSide);
  tri(out, 'roof', d, c, r1, color.slate);
  quad4(out, 'roof', a, d, r1, r0, color.slateSide);
}

function roof(out, lod) {
  const mid = center + 0.22;
  hip(out, [left - 0.76, -24.94, mid + 0.44, front + 0.28], eave, 13.68, 5.65);
  hip(out, [mid - 0.44, -24.94, right + 0.55, front + 0.28], eave, 13.78, 5.65);
  gableRoof(out, 'roof', [mid, -10.5], [mid, front - 4.7], 10.9, 10.0, 14.15, color.slate, {
    overhang: 0.19,
    endSlot: 'wall',
    endColor: color.brick,
  });
  if (lod) {
    const ends = [left + 1.66, right - 1.38];
    for (const x of ends) {
      abox(out, 'wall', [x - 0.31, 12.4, 3.75], [x + 0.26, 14.35, 4.32], color.bay);
      abox(out, 'base', [x - 0.37, 14.25, 3.69], [x + 0.32, 14.41, 4.38], color.stone);
    }
  }
}

function hallWalls(out, lod) {
  extrude(out, 'base', hall, -3.1, 1.22, color.footing, { top: false });
  extrude(out, 'wall', hall, 1.19, eave + 0.017, color.brick, { top: false });
  if (!lod) return;
  for (const [i, a] of hall.entries()) {
    const F = wallFace(a, hall[(i + 1) % hall.length]);
    if (F.length < 2.8) continue;
    const d = F.normal[1] > 0.97 ? 0.21 : 0.32;
    fbox(out, 'trim', F, -0.045, F.length + 0.045, eave - 0.22, eave + 0.035, -0.1, d, color.eave);
    if (F.normal[1] > 0.97 || lod < 2) continue;
    const bays = Math.floor((F.length + 0.2) / 3.1);
    for (let bay = 0; bay < bays; bay++) {
      const u = ((bay + 0.5) * F.length) / bays;
      sash(out, F, u, 6.3, 0.96, 2.43, lod);
      if (lod === 3) sash(out, F, u, 2.9, 0.88, 2.12, lod);
    }
  }
}

function frontBays(out, lod) {
  for (const sign of [-1, 1]) {
    const u = sign * 8.51;
    const A = u - 1.52,
      B = u + 1.52;
    fbox(out, 'wall', façade, A, B, 1.16, 11.48, -2.17, 0.48, color.bay);
    for (const side of [A, B - 0.37]) {
      fbox(out, 'wall', façade, side, side + 0.37, 11.42, 11.99, -0.21, 0.48, color.bay);
      fbox(out, 'base', façade, side - 0.045, side + 0.42, 11.9, 12.045, -0.28, 0.57, color.stone);
    }
    fbox(out, 'base', façade, A + 0.36, B - 0.36, 11.46, 11.64, -0.19, 0.56, color.stone);
    const boxFront = facade([center + u, front + 0.84], [1, 0]);
    fbox(out, 'trim', boxFront, -1.0, 1.0, 2.17, 5.28, -0.62, 0.28, color.eave);
    const p = (x, y, d) => boxFront.P(x, y, d);
    tri(out, 'base', p(-1.09, 5.27, 0.42), p(1.09, 5.27, 0.42), p(0, 6.31, -0.35), color.stone);
    tri(out, 'base', p(-1.09, 5.27, 0.42), p(0, 6.31, -0.35), p(-1.09, 5.27, -0.43), color.stone);
    tri(out, 'base', p(1.09, 5.27, 0.42), p(1.09, 5.27, -0.43), p(0, 6.31, -0.35), color.stone);
    tri(out, 'base', p(1.0, 2.18, 0.31), p(-1.0, 2.18, 0.31), p(0, 1.36, -0.27), color.footing);
    sash(out, boxFront, 0, 2.44, 1.5, 2.53, lod, 0.29);
    sash(out, façade, u, 9.97, 1.76, 1.09, lod, 0.51);
    for (const dx of [-0.63, 0.63]) {
      sash(out, façade, u + dx, 6.55, 0.86, 2.34, lod, 0.51);
      sash(out, façade, sign * (4.84 + dx), 6.55, 0.86, 2.34, lod);
    }
    sash(out, façade, sign * 4.9, 2.8, 1.2, 2.19, lod);
    if (lod >= 2) sash(out, façade, sign * 6.63, 2.63, 0.56, 2.28, lod);
  }
}

function mainTower(out, lod) {
  const faces = outwardRing(
    tower(out, 'wall', towerCenter, 2.92, 8, 5.34, 12.8, color.brick, { rotation: rotated }),
  );
  lathe(
    out,
    'roof',
    towerCenter,
    [
      [12.73, 3.12, 3.12],
      [13.0, 3.15, 3.15],
      [13.64, 2.6, 2.6],
      [14.33, 2.15, 2.15],
      [16.61, 1.04, 1.04],
    ],
    8,
    color.slate,
    { rotation: rotated },
  );
  const lantern = outwardRing(
    tower(out, 'trim', towerCenter, 1.08, 8, 16.55, 17.88, color.chalk, {
      rotation: rotated,
      top: false,
    }),
  );
  lathe(
    out,
    'roof',
    towerCenter,
    [
      [17.78, 1.12, 1.12],
      [18.04, 1.09, 1.09],
      [18.72, 0.26, 0.26],
      [18.9, 0.05, 0.05],
    ],
    8,
    color.slate,
    { rotation: rotated },
  );
  if (lod) {
    tower(out, 'base', towerCenter, 1.17, 8, 16.53, 16.75, color.stone, { rotation: rotated });
    lathe(
      out,
      'trim',
      towerCenter,
      [
        [18.64, 0.085, 0.085],
        [19.19, 0.064, 0.064],
      ],
      6,
      color.eave,
    );
  }
  for (const [i, p] of faces.entries()) {
    const F = wallFace(p, faces[(i + 1) % faces.length]);
    if (F.normal[1] < 0.18) continue;
    sash(out, F, F.length / 2, 10.04, 1.12, 1.94, lod);
    if (lod) sash(out, F, F.length / 2, 6.65, 0.96, 1.73, lod);
    if (lod >= 2 && F.normal[1] > 0.94) {
      fbox(
        out,
        'base',
        F,
        F.length / 2 - 0.95,
        F.length / 2 + 0.95,
        8.85,
        9.17,
        0.008,
        0.082,
        color.stone,
      );
    }
  }
  if (!lod) return;
  for (const [i, p] of lantern.entries()) {
    const F = wallFace(p, lantern[(i + 1) % lantern.length]);
    sash(out, F, F.length / 2, 16.87, 0.42, 0.8, Math.min(lod, 2), 0, 'round');
  }
}

function balustrade(out, a, b, y0, y1, lod) {
  const F = wallFace(a, b);
  const P = F.P;
  const end = F.length;
  const rail = (h) => {
    quad4(
      out,
      'trim',
      P(0, y0 + h, 0.055),
      P(end, y1 + h, 0.055),
      P(end, y1 + h + 0.08, 0.055),
      P(0, y0 + h + 0.08, 0.055),
      color.chalk,
    );
    quad4(
      out,
      'trim',
      P(0, y0 + h + 0.08, 0.055),
      P(end, y1 + h + 0.08, 0.055),
      P(end, y1 + h + 0.08, -0.055),
      P(0, y0 + h + 0.08, -0.055),
      color.chalk,
    );
    quad4(
      out,
      'trim',
      P(end, y1 + h, -0.055),
      P(0, y0 + h, -0.055),
      P(0, y0 + h + 0.08, -0.055),
      P(end, y1 + h + 0.08, -0.055),
      color.chalk,
    );
  };
  rail(0.86);
  if (lod) rail(0.18);
  const count = Math.max(2, Math.ceil(end / [1.45, 0.68, 0.35, 0.22][lod]));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const u = t * end;
    const y = y0 + (y1 - y0) * t;
    const w = i === 0 || i === count ? 0.065 : 0.028;
    fbox(out, 'trim', F, u - w, u + w, y + 0.04, y + 0.9, -w, w, color.chalk);
  }
}

function porch(out, lod) {
  const z = front + 3.42;
  const landing = 1.59;
  const top = 5.35;
  const A = [center - 3.37, z],
    B = [center + 3.37, z];
  const C = [center + 4.28, z - 0.77],
    D = [center - 4.28, z - 0.77];
  const outline = [A, B, C, [C[0], front - 0.09], [D[0], front - 0.09], D];
  extrude(out, 'base', outline, -0.6, landing, color.footing, { top: true, topColor: color.stone });
  extrude(out, 'trim', outline, top - 0.27, top + 0.06, color.chalk, { top: true });
  for (const [i, point] of [D, [center - 1.6, z - 0.08], [center + 1.58, z - 0.08], C].entries()) {
    const sides = [6, 8, 10, 14][lod];
    tower(
      out,
      'base',
      point,
      i === 0 || i === 3 ? 0.15 : 0.17,
      sides,
      landing + 0.03,
      top - 0.3,
      color.chalk,
      { top: false },
    );
    if (lod) tower(out, 'trim', point, 0.265, 8, top - 0.49, top - 0.31, color.chalk);
  }
  const stepCount = lod === 0 ? 5 : 10;
  const depth = 3.58 / stepCount;
  for (let i = 0; i < stepCount; i++) {
    const za = z + 3.58 - i * depth;
    const y = 0.09 + ((landing - 0.09) * (i + 1)) / stepCount;
    const half = 5.25 - 1.92 * (i / stepCount);
    abox(
      out,
      'base',
      [center - half, -0.64, za - depth - 0.01],
      [center + half, y, za + 0.018],
      i % 2 ? color.stone : color.footing,
      { bottom: false },
    );
  }
  for (const point of [A, B]) {
    const side = point === A ? -1 : 1;
    balustrade(out, [center + side * 5.13, z + 3.46], point, 0.22, landing, lod);
  }
  if (lod) {
    balustrade(out, D, A, top, top, lod);
    balustrade(out, A, B, top, top, lod);
    balustrade(out, B, C, top, top, lod);
  }
  fbox(out, 'door', façade, -1.07, 1.07, landing, 4.56, 0.022, 0.105, color.wood);
  if (!lod) return;
  for (const x of [-0.49, 0.49]) sash(out, façade, x, 2.9, 0.59, 1.21, lod, 0.116);
  fbox(out, 'trim', façade, -1.18, 1.18, 4.48, 4.68, 0.01, 0.16, color.chalk);
}

function build(sink, lod) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  hallWalls(out, lod);
  roof(out, lod);
  frontBays(out, lod);
  porch(out, lod);
  mainTower(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'finnish-labour-temple-model.mjs';
const camera = [33, 18, 52];
const lookAt = [-1.1, 8.5, -1.0];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'heritage-labour-hall',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The early Finnish Labour Temple with the original octagonal lantern, twin hipped roofs, symmetrical brick bays and wide Bay Street steps below a balustraded porch.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: shape.validFrom,
    validUntil: shape.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-31, 44, 53],
  mediumFiContext: {
    scale: 1.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: ring,
    minimumCoverage: 0.88,
    basis:
      'The original hall and main entrance projection are mapped by prefire building way 88723774.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-footprint-caps.mjs', 'place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'bay-street-frontage', position: [0, 5.4, 42], lookAt: [-1.3, 8.4, 13.5] },
    { name: 'portico-and-steps', position: [-6.4, 3.3, 28.5], lookAt: [-1.5, 3.4, 17.0] },
    { name: 'tower-lantern-and-corner-bays', position: [24, 18.8, 32], lookAt: [-1.1, 12.4, 12.8] },
    { name: 'reconstructed-roof-and-rear', position: [-35, 29, -43], lookAt: [-1.0, 9.1, -4.7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'finnish-labour-temple-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.52,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.25, surfaces },
      street: { export: 'street', errorMeters: 0.095, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.031, surfaces },
    },
  },
};

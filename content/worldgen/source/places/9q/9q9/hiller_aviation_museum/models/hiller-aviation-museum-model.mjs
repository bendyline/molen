import fs from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  fbox,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = frame.geometry.outline;
const frontA = outline[17];
const frontB = outline[0];
const front = wallFace(frontA, frontB);
const main = [...outline.slice(0, 11), frontA];
const lobby = outline.slice(10);
const roofY = plan.dimensions.facadeTopEstimateM;
const base = -0.86;

const blue = rgb('2a4b73');
const wallBlue = rgb('3d6082');
const sideBlue = rgb('4a6277');
const pale = rgb('c5ced0');
const roofGray = rgb('77818b');
const darkRoof = rgb('686f76');
const blueJoint = rgb('273e5b');
const shadowBlue = rgb('314a64');
const under = rgb('b5b2a7');
const glass = rgb('57707c');
const displayWhite = rgb('dfdfd6');
const windowDark = rgb('465057');
const darkMetal = rgb('60686b');

const surfaces = {
  panel: { slot: 'wall', graph: 'metal_painted', roughness: 0.82 },
  detail: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.75 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.94 },
  foundation: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.52 },
};

function cap(out, slot, ring, y, color) {
  const indices = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < indices.length; i += 3)
    tri(out, slot, p(indices[i]), p(indices[i + 2]), p(indices[i + 1]), color);
}

function roofCap(out, ring, y, color) {
  extrude(out, 'roof', ring, y - 0.22, y, color, { top: false });
  cap(out, 'roof', ring, y, color);
}

function gallery(out, level) {
  const ring = outwardRing(main);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    if (a === frontA && b === frontB) continue;
    const F = wallFace(a, b);
    const len = F.length;
    if (len < 0.2) continue;
    const rear = i === 5 || i === 6;
    fbox(out, 'panel', F, 0, len, base, roofY - 0.24, -0.16, 0, rear ? pale : sideBlue);
    fbox(out, 'foundation', F, 0, len, base - 0.1, 0.14, -0.17, 0.028, under);
    if (level === 0) continue;
    fbox(out, 'panel', F, 0, len, roofY - 0.57, roofY - 0.17, 0, 0.065, roofGray);
    const bayCount = Math.floor(len / 6.7);
    for (let j = 1; j <= bayCount; j++) {
      const u = (len * j) / (bayCount + 1);
      fbox(out, 'detail', F, u - 0.029, u + 0.029, 0.25, roofY - 0.56, -0.01, 0.025, shadowBlue);
      if (level > 1 && len > 16 && !rear)
        fbox(out, 'panel', F, u - 1.11, u + 1.11, 6.14, 7.09, 0.009, 0.036, wallBlue);
    }
    if (rear && len > 12) {
      for (const u of [len * 0.3, len * 0.73]) {
        fbox(out, 'panel', F, u - 1.78, u + 1.78, 0.13, 3.61, 0.015, 0.071, roofGray);
        if (level > 1)
          for (const y of [0.78, 1.42, 2.06, 2.7, 3.34])
            fbox(out, 'detail', F, u - 1.77, u + 1.77, y, y + 0.036, 0.07, 0.082, shadowBlue);
      }
    }
  }
  roofCap(out, main, roofY - 0.12, roofGray);
  if (level > 0) {
    const mechanical = [
      [20.8, -7.1],
      [11.5, -7.1],
      [11.5, -3.5],
      [20.8, -3.5],
    ];
    extrude(out, 'roof', mechanical, roofY - 0.16, roofY + 0.66, darkRoof, { top: false });
    cap(out, 'roof', mechanical, roofY + 0.66, darkRoof);
    const taller = [
      [2.0, -30.5],
      [-2.65, -26.3],
      [-0.28, -23.54],
      [4.35, -27.9],
    ];
    extrude(out, 'roof', taller, roofY - 0.16, roofY + 0.51, darkRoof, { top: false });
    cap(out, 'roof', taller, roofY + 0.51, darkRoof);
  }
}

const glyphs = {
  A: ['00 24 40', '11 31'],
  E: ['44 04 00 40', '02 32'],
  H: ['00 04', '02 42', '40 44'],
  I: ['24 20'],
  L: ['04 00 40'],
  M: ['00 04 22 44 40'],
  N: ['00 04 40 44'],
  O: ['10 30 41 43 34 14 03 01 10'],
  R: ['00 04 34 43 32 02', '22 40'],
  S: ['43 34 14 03 02 32 41 30 10 01'],
  T: ['04 44', '24 20'],
  U: ['04 01 10 30 41 44'],
  V: ['04 20 44'],
};

function buildingName(out, text, center, baseline, height, pitch) {
  const start = center - (text.length * pitch) / 2;
  for (let i = 0; i < text.length; i++)
    for (const path of glyphs[text[i]] ?? []) {
      const points = path
        .split(' ')
        .map(([x, y]) =>
          front.P(
            start + i * pitch + Number(x) * pitch * 0.18,
            baseline + (Number(y) * height) / 4,
            0.118,
          ),
        );
      for (let j = 1; j < points.length; j++)
        beam(out, 'detail', points[j - 1], points[j], 0.068, 0.051, displayWhite);
    }
}

function entranceFront(out, level) {
  const L = front.length;
  const recess = 2.78;
  fbox(out, 'panel', front, 0, L, 3.52, roofY, -0.42, 0.092, blue);
  fbox(out, 'panel', front, 0, L, 2.72, 3.56, -0.43, 0.36, blue);
  fbox(out, 'panel', front, 0, L, base, recess + 0.036, -0.72, -0.38, wallBlue);
  fbox(out, 'panel', front, 0, L, roofY - 0.12, roofY + 0.045, -0.49, 0.14, roofGray);
  fbox(out, 'foundation', front, 0, L, base, 0.075, -0.74, 0.07, under);
  for (const u of [0.03, L / 4, L / 2, (3 * L) / 4, L - 0.4])
    fbox(out, 'panel', front, u, u + 0.38, 0.025, recess + 0.1, -0.4, 0.082, blue);
  if (level === 0) return;
  fbox(out, 'detail', front, 0, L, 3.49, 3.525, 0.356, 0.378, blueJoint);
  for (let i = 1; i < (level === 1 ? 8 : 16); i++) {
    const u = (L * i) / (level === 1 ? 8 : 16);
    fbox(out, 'detail', front, u - 0.012, u + 0.012, 3.6, roofY - 0.17, 0.084, 0.102, blueJoint);
    if (level === 3)
      fbox(out, 'detail', front, u - 0.011, u + 0.011, 0.15, 2.72, -0.386, -0.364, shadowBlue);
  }
  buildingName(out, 'HILLER', L * 0.5, 7.25, 0.95, 1.04);
  buildingName(out, 'AVIATION MUSEUM', L * 0.5, 5.6, 0.9, 1.02);
}

function visitorWing(out, level) {
  const ring = outwardRing(lobby);
  const wingTop = 6.2;
  extrude(out, 'panel', ring, base, wingTop, sideBlue, { top: false });
  roofCap(out, ring, wingTop + 0.04, darkRoof);
  const entry = wallFace(outline[13], outline[14]);
  const span = entry.length;
  fbox(out, 'foundation', entry, 0, span, base, 0.15, -0.08, 1.15, under);
  fbox(out, 'glass', entry, 0.38, span - 0.35, 0.14, 4.05, 0.028, 0.064, glass);
  fbox(out, 'panel', entry, 0.05, span - 0.12, 3.27, 3.54, 0.006, 1.34, blue);
  if (level === 0) return;
  for (let i = 1; i < 6; i++) {
    const u = (span * i) / 6;
    fbox(out, 'detail', entry, u - 0.039, u + 0.039, 0.17, 4.1, 0.061, 0.094, darkMetal);
    if (level > 1 && i >= 2 && i <= 4)
      fbox(out, 'detail', entry, u - 0.375, u - 0.21, 1.04, 1.09, 0.08, 0.143, pale);
  }
  for (const h of [2.16, 3.14])
    fbox(out, 'detail', entry, 0.36, span - 0.33, h, h + 0.069, 0.062, 0.09, darkMetal);
}

function exhibit(out, level) {
  const center = front.length * 0.55;
  const bodyY = roofY + 1.23;
  const turn = 0.17;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const map = (u, y, v) => front.P(center + c * u + s * v, bodyY + y, -4.03 - s * u + c * v);
  const sections = [
    [-2.53, 0.045, 0.058, -0.065],
    [-2.2, 0.19, 0.225, -0.045],
    [-1.4, 0.345, 0.3, 0],
    [-0.48, 0.4, 0.38, 0.012],
    [0.76, 0.41, 0.38, 0.025],
    [1.61, 0.29, 0.272, 0.085],
    [2.17, 0.13, 0.155, 0.07],
    [2.37, 0.041, 0.065, 0.06],
  ];
  const sides = level === 0 ? 6 : level === 1 ? 8 : 12;
  const rings = (stations) =>
    stations.map(([u, width, height, cy]) =>
      Array.from({ length: sides }, (_, i) => {
        const a = (i * Math.PI * 2) / sides;
        return map(u, cy + Math.cos(a) * height, Math.sin(a) * width);
      }),
    );
  const fuselage = level === 0 ? sections.filter((_, i) => [0, 2, 4, 6, 7].includes(i)) : sections;
  loft(out, 'detail', rings(fuselage), displayWhite);
  if (level > 0) {
    const canopy = [
      [-1.68, 0.1, 0.037, 0.275],
      [-0.88, 0.33, 0.22, 0.3],
      [0.2, 0.35, 0.27, 0.33],
      [1.06, 0.11, 0.055, 0.31],
    ];
    loft(out, 'glass', rings(canopy), windowDark);
  }

  function skin(polygon, thickness) {
    const ring = outwardRing(polygon.map(([u, , v]) => [u, v]));
    const ordered = ring.map(([u, v]) => polygon.find(([x, , z]) => x === u && z === v));
    const low = ordered.map(([u, y, v]) => map(u, y - thickness, v));
    const high = ordered.map(([u, y, v]) => map(u, y, v));
    loft(out, 'detail', [low, high], displayWhite);
  }
  for (const sign of [-1, 1]) {
    skin(
      [
        [-0.15, 0.01, sign * 0.24],
        [1.67, -0.11, sign * 0.25],
        [2.22, 0.045, sign * 3.77],
        [1.61, 0.055, sign * 3.7],
      ],
      0.096,
    );
    skin(
      [
        [-2.1, 0.05, sign * 0.12],
        [-1.47, 0.05, sign * 0.18],
        [-1.45, 0.12, sign * 1.55],
        [-1.8, 0.115, sign * 1.56],
      ],
      0.065,
    );
    const foot = sign * 3.72;
    const top = sign * 3.86;
    const fin = [
      [1.59, 0.02, foot],
      [2.23, 0.023, foot],
      [2.32, 1.58, top],
      [2.02, 1.54, top],
    ];
    const a = fin.map(([x, y, z]) => map(x, y, z - 0.046));
    const b = fin.map(([x, y, z]) => map(x, y, z + 0.046));
    quad4(out, 'detail', ...a.slice().reverse(), displayWhite);
    quad4(out, 'detail', ...b, displayWhite);
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      quad4(out, 'detail', a[i], a[j], b[j], b[i], pale);
    }
  }
  for (const [x, z] of [
    [-1.82, 0],
    [0.61, -0.62],
    [0.61, 0.62],
  ]) {
    beam(out, 'detail', map(x, -0.23, z * 0.61), map(x - 0.32, -1.36, z), 0.091, 0.083, darkMetal);
    if (level > 1) {
      const lo = map(x - 0.4, -0.98, z - 0.06);
      const hi = map(x - 0.4, -0.98, z + 0.06);
      beam(out, 'detail', lo, hi, 0.27, 0.27, windowDark);
    }
  }
  if (level > 1)
    beam(out, 'detail', map(2.29, -0.35, -0.51), map(2.4, 0.51, 0.52), 0.065, 0.058, darkMetal);
}

function build(out, level) {
  gallery(out, level);
  entranceFront(out, level);
  visitorWing(out, level);
  exhibit(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'hiller-aviation-museum-model.mjs';
const camera = [-88, 48, 111];
const lookAt = [8.2, 4.6, -1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Hiller Aviation Museum',
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The San Carlos airport museum with a stepped exhibition hall, blue panel frontage and a white Long-EZ display above its roofline.',
  camera,
  lookAt,
  sunDirection: [-51, 54, 32],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'Named mapped Hiller Aviation Museum exterior footprint.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'metal_standing_seam', 'concrete_plain'],
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    {
      name: 'parking-front-name-and-rooftop-exhibit',
      position: [-25, 5, 60],
      lookAt: [5, 6.5, 29.4],
    },
    { name: 'entry-wing-and-stepped-gallery', position: [-63, 20, 40], lookAt: [1, 5, 0] },
    { name: 'gallery-and-airfield-side', position: [74, 32, -91], lookAt: [15, 4, -5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'hiller-aviation-museum-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.54, surfaces },
      street: { export: 'street', errorMeters: 0.2, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.085, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

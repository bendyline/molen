import { readFileSync } from 'node:fs';
import {
  arch,
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  opening,
  palette,
  panel,
  pairs,
  plane,
  rect,
  shell,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const f = d.floor;
const nave = d.nave;

const tone = palette({
  concrete: 'c7c6bb',
  pale: 'd1cfc1',
  inset: 'a6a59b',
  shadow: 'a5a69d',
  slate: '4b5053',
  slateLight: '5e6566',
  metal: '7a847f',
  glass: '4a5861',
  door: '5d5040',
  tint: '746357',
  frame: '8c8d84',
  green: '868972',
});
const surfaces = {
  wall: surface('wall', 'concrete_plain', 0.93),
  ground: surface('foundation', 'stone_ashlar', 0.96),
  roof: surface('roof', 'tile_flat', 0.9),
  frame: surface('trim', 'metal_painted', 0.89, 0.1),
  window: surface('window', 'window_grid', 0.57),
  wood: surface('trim', 'wood_plain', 0.88),
};

const foundation = (out, outline, top) =>
  shell(out, outline, (p) => Math.min(grade(p) - 0.35, top - 0.14), top, {
    wall: 'ground',
    color: tone.inset,
  });
const height = {
  low: f + 7.31,
  wing: f + 9.25,
  nave: f + 17.41,
  naveRidge: f + 25.14,
  frontRidge: f + 26.15,
};

function gabledRange(out, left, right, rear, front, y, h, swapped = false) {
  const xy = (u, v, w) => (swapped ? [w, v, u] : [u, v, w]);
  const mx = (left + right) * 0.5;
  const a = xy(left, y, rear),
    b = xy(right, y, rear),
    c = xy(right, y, front),
    e = xy(left, y, front);
  const p = xy(mx, y + h, rear),
    q = xy(mx, y + h, front);
  face(out, 'roof', [a, p, q, e], up, tone.slate);
  face(out, 'roof', [b, c, q, p], up, tone.slateLight);
  face(out, 'wall', [a, b, p], swapped ? [-1, 0, 0] : [0, 0, -1], tone.concrete);
  face(out, 'wall', [e, q, c], swapped ? [1, 0, 0] : [0, 0, 1], tone.concrete);
}

function naveAndNorthRooms(out, lod) {
  const outline = d.rooms[0].points;
  foundation(out, outline, f);
  shell(out, outline, () => f - 0.025, height.low, { wall: 'wall', color: tone.concrete });
  cap(out, 'wall', outline, height.low, tone.shadow);

  const hall = rect(nave.left + 1.74, nave.rear, nave.right - 1.99, nave.front);
  shell(out, hall, () => height.low - 0.07, height.nave, { wall: 'wall', color: tone.concrete });
  gabledRange(
    out,
    nave.left + 1.63,
    nave.right - 1.83,
    nave.rear - 0.39,
    nave.front + 0.16,
    height.nave,
    height.naveRidge - height.nave,
  );
  const facade = rect(nave.facadeLeft, nave.front - 0.4, nave.facadeRight, nave.westFront);
  shell(out, facade, () => f, height.nave, { wall: 'wall', color: tone.pale });
  gabledRange(
    out,
    nave.facadeLeft - 0.04,
    nave.facadeRight + 0.045,
    nave.front - 1.35,
    nave.westFront + 0.03,
    height.nave,
    height.frontRidge - height.nave,
  );

  for (const [left, right, rear, front, y, rise] of [
    [-37.38, -20.11, 0.09, 7.4, height.low, 1.7],
    [-32.88, -20.08, -32.75, 0.09, height.low, 2.1],
    [-22.25, 6.0, -19.97, -3.17, height.low, 2.31],
    [9.42, 23.03, -30.32, -3.3, height.low, 2.61],
    [18.75, 30.55, -16.08, -3.08, height.low, 2.15],
  ])
    gabledRange(out, left, right, rear, front, y, rise);
  for (const side of [-1, 1]) {
    const x = side < 0 ? nave.left + 1.699 : nave.right - 1.948;
    const w = { normal: [side, 0, 0], p: (u, y, v = 0) => [x + side * v, y, u] };
    for (const z of [1.6, 7.2, 12.9, 18.4, 24.0, 29.7, 35.28]) {
      const lower = height.low - 0.1,
        top = height.nave - 0.95;
      opening(
        out,
        w,
        z - 0.51,
        z + 0.51,
        lower,
        top,
        'frame',
        tone.glass,
        'window',
        tone.frame,
        lod,
        0.055,
      );
      if (lod > 0)
        trimBlock(out, 'wall', w, z + 2.15, z + 2.54, lower, top + 0.17, 0.01, 0.43, tone.pale);
      if (lod > 1)
        panel(out, 'frame', w, z - 0.5, z + 0.5, lower + 4.35, lower + 4.41, 0.088, tone.frame);
    }
  }
}

function abbeyFront(out, lod) {
  const center = (nave.facadeLeft + nave.facadeRight) * 0.5;
  const w = plane(nave.westFront + 0.018, 1);
  const left = nave.facadeLeft,
    right = nave.facadeRight;
  const sillY = f + 12.56;
  for (const i of [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5]) {
    const x = center + i * 1.76;
    const top = sillY + 4.05;
    opening(
      out,
      w,
      x - 0.39,
      x + 0.39,
      sillY,
      top,
      'frame',
      tone.glass,
      'window',
      tone.frame,
      lod,
      0.029,
    );
    if (lod > 0)
      panel(out, 'wall', w, x - 0.73, x - 0.49, sillY - 0.18, top + 0.19, 0.014, tone.inset);
  }
  const doorway = f + 0.44;
  arch(
    out,
    w,
    center,
    doorway,
    doorway + 5.05,
    1.81,
    1.92,
    0.036,
    lod,
    { width: 0.64, trim: tone.inset, inner: tone.inset },
    { inner: 'wall', trim: 'wall' },
  );
  arch(
    out,
    w,
    center,
    doorway + 0.03,
    doorway + 3.35,
    1.17,
    1.08,
    0.073,
    lod,
    { width: 0.24, trim: tone.shadow, inner: tone.door },
    { inner: 'wood', trim: 'wood' },
  );
  for (const s of [-1, 1]) {
    const x = center + s * 5.08;
    opening(
      out,
      w,
      x - 0.29,
      x + 0.29,
      f + 2.34,
      f + 5.31,
      'frame',
      tone.glass,
      'window',
      tone.frame,
      lod,
      0.049,
    );
    trimBlock(
      out,
      'wall',
      w,
      s < 0 ? left - 0.13 : right - 0.33,
      s < 0 ? left + 0.31 : right + 0.12,
      f + 0.12,
      height.nave,
      0.011,
      0.19,
      tone.pale,
    );
  }
  stairs(
    out,
    grade,
    'ground',
    center - 3.02,
    center + 3.02,
    nave.westFront + 3.67,
    nave.westFront + 0.02,
    f + 0.43,
    lod === 0 ? 3 : 5,
    tone.pale,
  );
  block(
    out,
    'frame',
    center - 0.043,
    height.frontRidge - 0.1,
    nave.westFront - 0.18,
    0.086,
    1.73,
    0.086,
    tone.metal,
  );
  block(
    out,
    'frame',
    center - 0.49,
    height.frontRidge + 0.96,
    nave.westFront - 0.185,
    0.98,
    0.086,
    0.091,
    tone.metal,
  );
  if (lod > 0) {
    panel(
      out,
      'wood',
      w,
      center - 0.042,
      center + 0.042,
      doorway + 0.05,
      doorway + 4.39,
      0.096,
      tone.tint,
    );
    panel(
      out,
      'wall',
      w,
      left + 0.22,
      right - 0.22,
      sillY - 0.41,
      sillY - 0.31,
      0.046,
      tone.shadow,
    );
  }
}

function dormer(out, x, y, z, size, lod) {
  const left = x - size / 2,
    right = x + size / 2;
  const g = plane(z + 0.015, 1),
    back = z - 2.27;
  panel(out, 'wall', g, left, right, y, y + 1.52, 0.015, tone.pale);
  gabledRange(out, left - 0.065, right + 0.065, back, z + 0.092, y + 1.48, 0.53);
  opening(
    out,
    g,
    x - size * 0.32,
    x + size * 0.32,
    y + 0.28,
    y + 1.37,
    'frame',
    tone.glass,
    'window',
    tone.frame,
    lod,
    0.045,
  );
}

function monasticCourt(out, lod) {
  const outline = d.rooms[1].points;
  foundation(out, outline, f);
  shell(out, outline, () => f - 0.02, height.wing, { wall: 'wall', color: tone.concrete });
  cap(out, 'wall', outline, height.wing - 0.015, tone.shadow);
  for (const [x0, x1, z0, z1] of [
    [25.4, 83.54, 36.43, 48.64],
    [32.46, 73.05, -16.01, -3.02],
  ])
    gabledRange(out, z0, z1, x0, x1, height.wing, 4.58, true);
  gabledRange(out, 71.74, 81.88, -56.36, 39.52, height.wing, 3.4);
  const walls = pairs(closed(outline)),
    sign = areaSign(outline);
  for (const [i, [a, b]] of walls.entries()) {
    const w = edge(a, b, sign);
    if (w.length < 7 || [13, 14, 15, 16, 19, 20, 21].includes(i)) continue;
    const n = Math.round(w.length / (lod > 1 ? 3.67 : 5.14));
    const pitch = w.length / n;
    for (let k = 0; k < n; k++) {
      const u = (k + 0.5) * pitch;
      for (const y of lod === 0 ? [5.63] : [2.43, 5.63]) {
        const y0 = f + y;
        const lowerWidth = lod === 0 ? 0.56 : 0.49;
        opening(
          out,
          w,
          u - lowerWidth,
          u + lowerWidth,
          y0,
          y0 + 1.86,
          'frame',
          tone.glass,
          'window',
          tone.frame,
          lod,
          0.027,
        );
        if (lod > 1)
          panel(out, 'wall', w, u - 0.59, u + 0.59, y0 - 0.12, y0 + 0.016, 0.09, tone.pale);
      }
    }
    panel(out, 'wall', w, 0, w.length, height.wing - 0.39, height.wing - 0.15, 0.035, tone.pale);
  }
  const columns = lod === 0 ? [39, 58, 77] : [35.2, 44.9, 54.5, 64.1, 75.2, 80.1];
  for (const x of columns) dormer(out, x, height.wing + 1.43, 46.84, 2.28, lod);
  if (lod > 1) {
    const courtyardPath = rect(30.99, 34.77, 66.91, 36.5);
    const y = f - 0.005;
    foundation(out, courtyardPath, y);
    cap(out, 'ground', courtyardPath, y, tone.pale);
  }
}

function bell(out, lod) {
  const left = 7.0,
    right = 11.7,
    rear = 15.2,
    front = 19.97;
  const base = height.nave - 0.8;
  shell(out, rect(left, rear, right, front), () => base, base + 6.38, {
    wall: 'wall',
    color: tone.concrete,
  });
  cap(
    out,
    'roof',
    rect(left - 0.095, rear - 0.095, right + 0.095, front + 0.095),
    base + 6.4,
    tone.slate,
  );
  const w = plane(front + 0.009, 1);
  for (const x of [8.43, 9.47, 10.52]) {
    opening(
      out,
      w,
      x - 0.28,
      x + 0.28,
      base + 4.08,
      base + 5.38,
      'frame',
      tone.glass,
      'window',
      tone.frame,
      lod,
      0.026,
    );
  }
  if (lod > 0) block(out, 'frame', 9.3, base + 6.42, 17.52, 0.076, 2.48, 0.075, tone.metal);
}

function build(out, lod) {
  naveAndNorthRooms(out, lod);
  abbeyFront(out, lod);
  monasticCourt(out, lod);
  bell(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'monastery-of-the-holy-spirit-model.mjs';
const camera = [-16, 39, 142],
  lookAt = [23, 8, 0];
export const conyersAbbeyModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The western public steps set the independent field datum. The development is aligned with the two mapped adjoining footprints.',
  brief:
    'The poured-concrete Conyers Abbey Church with its tall plain gable, recessed arched door and the adjoining dormered monastery wings.',
  camera,
  lookAt,
  sunDirection: [-39, 56, 54],
  mediumFiContext: {
    scale: 1,
    groundY: -0.3,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: d.polygons,
    minimumCoverage: 0.92,
    basis:
      'The named abbey church and attached monastery building are each replaced within their mapped footprints.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'abbey-gable-and-monastery-front', position: [-6, 13, 105], lookAt: [30, 10, 30] },
    { name: 'concrete-window-and-entry-details', position: [11, 9, 70], lookAt: [18, 12, 42] },
    { name: 'abbey-nave-and-open-cloister', position: [97, 67, -6], lookAt: [33, 10, 11] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'conyers-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.91,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.48, surfaces },
      street: { export: 'street', errorMeters: 0.23, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.064, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. NancyHeise’s photograph releases are public domain. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};

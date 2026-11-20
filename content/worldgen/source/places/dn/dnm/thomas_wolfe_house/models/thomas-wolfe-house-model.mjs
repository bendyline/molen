import { readFileSync } from 'node:fs';
import {
  areaSign,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  opening,
  palette,
  panel,
  pairs,
  plane,
  shell,
  stairs,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const recipe = 'thomas-wolfe-house-model.mjs';
const camera = [-33, 15, 39];
const lookAt = [0.3, 4.1, 0.1];
const grade = floorSampler(read('terrain-grid.json'));
const floor = d.principalFloor;
const upper = d.upperFloor;
const eave = d.mainEave;
const colors = palette({
  siding: 'dacf9f',
  posts: 'e0dbc7',
  accents: 'e9e5d6',
  underEave: 'bfb89e',
  gray: '536064',
  roof: '626a70',
  roofDark: '525960',
  terrace: '7b7768',
  granite: 'a39b91',
  darkerStone: '847a6a',
  brick: '98675a',
  deepBrick: '724c41',
  glass: '3a474a',
  wood: '45423a',
  amber: 'a78756',
  violet: '79657d',
  teal: '64847c',
});
const surfaces = {
  wood: surface('wall', 'wood_painted_lap', 0.92),
  trim: surface('trim', 'wood_plain', 0.9),
  roof: surface('roof', 'slate', 0.94),
  stone: surface('foundation', 'stone_granite', 0.96),
  brick: surface('trim', 'brick', 0.93),
  window: surface('window', 'window_grid', 0.68),
};
const side = (x, facing) => ({
  normal: [facing, 0, 0],
  p: (z, y, o = 0) => [x + facing * o, y, z],
});
const front = plane(6.7, 1);
const left = side(-8.64, -1);
const westWall = side(-10.27, -1);
const farWall = side(11.46, 1);

function wallBox(out, x0, x1, z0, z1, top) {
  block(out, 'wood', x0, floor - 0.015, z0, x1 - x0, top - floor + 0.015, z1 - z0, colors.siding);
}

function cornice(out, w, u0, u1, y, lod) {
  panel(out, 'trim', w, u0, u1, y - 0.15, y + 0.045, 0.038, colors.accents);
  if (lod < 2) return;
  const count = Math.ceil((u1 - u0) / 0.38);
  for (let i = 0; i < count; i++) {
    const x = mix(u0, u1, (i + 0.5) / count);
    panel(out, 'trim', w, x - 0.044, x + 0.044, y - 0.26, y - 0.14, 0.078, colors.underEave);
  }
}

function vent(out, w, center, y, lod) {
  for (const x of [center - 0.34, center + 0.34]) {
    opening(
      out,
      w,
      x - 0.25,
      x + 0.25,
      y,
      y + 0.79,
      'trim',
      colors.wood,
      'window',
      colors.accents,
      lod,
      0.061,
    );
    if (lod < 2) continue;
    for (let i = 1; i <= 5; i++)
      panel(
        out,
        'trim',
        w,
        x - 0.21,
        x + 0.21,
        y + i * 0.125,
        y + i * 0.125 + 0.022,
        0.099,
        colors.posts,
      );
  }
}

function roofGable(out, { x0, x1, z0, z1, base, peak, axis }, lod) {
  const longX = axis === 'x';
  const orient = longX ? (l, y, t) => [l, y, t] : (l, y, t) => [t, y, l];
  const [a, b, c, e] = longX ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
  const mid = (c + e) / 2;
  for (const [end, color] of [
    [c, colors.roofDark],
    [e, colors.roof],
  ]) {
    face(
      out,
      'roof',
      [orient(a, base, end), orient(b, base, end), orient(b, peak, mid), orient(a, peak, mid)],
      up,
      color,
    );
  }
  for (const [end, sign] of [
    [a, -1],
    [b, 1],
  ]) {
    const w = longX ? side(end, sign) : plane(end, sign);
    face(out, 'wood', [w.p(c, base), w.p(e, base), w.p(mid, peak)], w.normal, colors.siding);
    if (lod === 0) continue;
    for (const t of [c, e])
      face(
        out,
        'trim',
        [
          w.p(t, base - 0.055, 0.025),
          w.p(mid, peak + 0.087, 0.025),
          w.p(mid, peak - 0.081, 0.025),
          w.p(t, base - 0.24, 0.025),
        ],
        w.normal,
        colors.accents,
      );
    cornice(out, w, c, e, base - 0.12, lod);
    vent(out, w, mid, base + 0.38, lod);
  }
}

function roofHips(out, x0, x1, z0, z1, low, high, lod) {
  const a = [x0, low, z0],
    b = [x1, low, z0],
    c = [x1, low, z1],
    d = [x0, low, z1];
  const m = (z0 + z1) / 2,
    v = (z1 - z0) * 0.41;
  const r = [x0 + v, high, m],
    q = [x1 - v, high, m];
  for (const [poly, color] of [
    [[a, b, q, r], colors.roofDark],
    [[b, c, q], colors.roof],
    [[c, d, r, q], colors.roof],
    [[d, a, r], colors.roofDark],
  ])
    face(out, 'roof', poly, up, color);
  if (lod > 1) {
    for (const [lo, hi] of [
      [c, q],
      [d, r],
      [b, q],
      [a, r],
    ]) {
      const n = (value, dx) => [value[0] + dx, value[1] + 0.022, value[2]];
      face(
        out,
        'roof',
        [n(lo, -0.027), n(lo, 0.027), n(hi, 0.027), n(hi, -0.027)],
        up,
        colors.gray,
      );
    }
  }
}

function sash(out, w, center, y, width, height, lod, leaded = false) {
  const l = center - width / 2,
    r = center + width / 2;
  opening(
    out,
    w,
    l,
    r,
    y,
    y + height,
    'trim',
    colors.glass,
    'window',
    colors.underEave,
    lod,
    0.036,
  );
  if (lod < 2) return;
  const divided = y + height * 0.48;
  panel(out, 'trim', w, l, r, divided - 0.035, divided + 0.035, 0.072, colors.posts);
  panel(out, 'trim', w, l - 0.08, r + 0.08, y - 0.095, y - 0.041, 0.089, colors.accents);
  if (!leaded) return;
  const high = y + height * 0.86;
  for (const [k, tone] of [colors.violet, colors.amber, colors.teal, colors.amber].entries()) {
    const x = mix(l, r, (k + 0.17) / 4);
    panel(out, 'window', w, x, x + width * 0.17, high, high + height * 0.085, 0.078, tone);
  }
}

function railing(out, w, from, to, y, lod) {
  if (to - from < 0.3) return;
  panel(out, 'trim', w, from, to, y + 0.91, y + 1.015, 0.014, colors.posts);
  panel(out, 'trim', w, from, to, y + 0.075, y + 0.155, 0.014, colors.posts);
  if (lod === 1) panel(out, 'trim', w, from, to, y + 0.19, y + 0.89, -0.002, colors.underEave);
  if (lod < 2) return;
  const n = Math.round((to - from) / (lod === 2 ? 0.2 : 0.145));
  for (let i = 0; i < n; i++) {
    const x = mix(from, to, (i + 0.5) / n);
    panel(out, 'trim', w, x - 0.024, x + 0.024, y + 0.128, y + 0.952, 0.015, colors.accents);
  }
}

function veranda(out, lod) {
  const porch = [
    [-8.71, 2.216],
    [-4.95, 2.216],
    [-4.95, 6.7],
    [4.97, 6.7],
    [4.98, 9.9],
    [-8.71, 9.9],
  ];
  cap(out, 'trim', porch, floor + 0.012, colors.terrace);
  const pt = plane(9.9, 1),
    pSide = side(-8.708, -1);
  const h = d.porchRoof;
  face(
    out,
    'roof',
    [
      [-9.02, h, 10.15],
      [5.09, h, 10.15],
      [5.09, h + 0.35, 6.68],
      [-7.12, h + 0.35, 6.68],
    ],
    up,
    colors.roofDark,
  );
  face(
    out,
    'roof',
    [
      [-9.02, h, 10.15],
      [-7.12, h + 0.35, 6.68],
      [-7.12, h + 0.35, 2.18],
      [-9.02, h, 2.18],
    ],
    up,
    colors.roof,
  );
  cornice(out, pt, -8.91, 5.09, h - 0.04, lod);
  cornice(out, pSide, 2.19, 9.9, h - 0.04, lod);
  for (const x of [-8.55, -5.85, -2.4, 1.28, 4.72])
    block(out, 'trim', x - 0.12, floor, 9.63, 0.24, h - floor, 0.22, colors.posts);
  for (const z of [2.47, 5.05, 7.27])
    block(out, 'trim', -8.67, floor, z - 0.12, 0.22, h - floor, 0.24, colors.posts);
  stairs(out, grade, 'stone', -2.14, 0.54, 11.38, 9.88, floor, lod === 0 ? 2 : 4, colors.granite);
  if (lod === 0) return;
  for (const [a, b] of [
    [-8.52, -2.42],
    [0.65, 4.72],
  ])
    railing(out, pt, a, b, floor, lod);
  railing(out, pSide, 2.5, 9.63, floor, lod);
  if (lod >= 2) {
    for (const [x, sgn] of [
      [-2.42, -1],
      [0.65, 1],
    ]) {
      const post = plane(10.98, 1);
      panel(out, 'trim', post, x - 0.018, x + 0.018, 0.43, 1.27, 0.04, colors.gray);
      face(
        out,
        'trim',
        [
          [x, 1.231 + sgn * 0.02, 11.08],
          [x, 1.925, 9.69],
          [x, 1.975, 9.69],
          [x, 1.281 + sgn * 0.02, 11.08],
        ],
        [1, 0, 0],
        colors.gray,
      );
    }
  }
  const bal = plane(8.87, 1);
  block(out, 'trim', 0.4, upper - 0.16, 6.72, 4.52, 0.2, 2.18, colors.terrace);
  roofHips(out, 0.19, 5.18, 5, 9.22, 6.77, 8.92, lod);
  for (const x of [0.57, 2.73, 4.75])
    block(out, 'trim', x - 0.095, upper, 8.68, 0.19, 2.83, 0.18, colors.accents);
  railing(out, bal, 0.61, 4.71, upper, lod);
  cornice(out, bal, 0.38, 4.97, 6.71, lod);
}

function house(out, lod) {
  const outline = d.outline;
  const heavy = lod === 0 ? outline.filter((_, i) => i !== 6 && i !== 7) : outline;
  shell(out, heavy, (p) => Math.min(floor - 0.36, grade(p) - 0.48), floor - 0.034, {
    wall: 'stone',
    color: colors.darkerStone,
    roofColor: colors.granite,
  });
  wallBox(out, -7.56, 11.46, -12.015, 3.995, eave);
  wallBox(out, -7.55, 0.38, -13.823, -11.98, eave - 0.29);
  wallBox(out, -4.95, 4.973, 3.98, 6.699, eave);
  wallBox(out, -10.27, -7.548, -2.86, 2.213, eave - 0.37);
  wallBox(out, -8.64, -4.95, 2.181, 5.93, 6.7);
  const bay = [
    [4.965, 3.97],
    [7.717, 3.97],
    [7.717, 7.95],
    [7.14, 8.652],
    [5.17, 8.651],
    [4.965, 8.18],
  ];
  shell(out, bay, () => floor, eave, { wall: 'wood', color: colors.siding });
  roofGable(
    out,
    {
      x0: -7.89,
      x1: 11.77,
      z0: -12.34,
      z1: 4.28,
      base: eave + 0.018,
      peak: d.mainRidge,
      axis: 'z',
    },
    lod,
  );
  roofGable(
    out,
    { x0: -8.02, x1: 2.7, z0: -3.72, z1: 6.94, base: eave + 0.035, peak: 10.36, axis: 'x' },
    lod,
  );
  roofGable(
    out,
    { x0: 4.74, x1: 7.99, z0: 4.04, z1: 8.99, base: eave + 0.04, peak: 8.88, axis: 'z' },
    lod,
  );
  roofGable(
    out,
    { x0: -10.53, x1: -5.97, z0: -3.18, z1: 2.45, base: eave - 0.36, peak: 8.84, axis: 'x' },
    lod,
  );
  roofGable(
    out,
    { x0: -7.83, x1: 0.57, z0: -14.08, z1: -9.48, base: eave - 0.285, peak: 8.47, axis: 'z' },
    lod,
  );
  roofHips(out, -8.91, -4.8, 2.06, 6.15, 6.68, 7.19, lod);
  for (const [x, z, y, h] of [
    [-1.4, -5.3, 9.22, 2.54],
    [5.65, -0.25, 8.2, 2.1],
    [-5.7, 3.39, 8.45, 2.21],
  ]) {
    block(out, 'brick', x, y, z, 0.71, h, 0.76, colors.brick);
    block(out, 'brick', x - 0.071, y + h - 0.13, z - 0.068, 0.855, 0.16, 0.9, colors.deepBrick);
    if (lod > 1)
      block(out, 'trim', x + 0.12, y + h + 0.028, z + 0.12, 0.47, 0.023, 0.52, colors.wood);
  }
  veranda(out, lod);
  if (lod === 0) return;
  opening(
    out,
    front,
    1.5,
    2.67,
    floor,
    floor + 2.32,
    'trim',
    colors.wood,
    'window',
    colors.accents,
    lod,
    0.055,
  );
  for (const [u, y, w, h, glass] of [
    [-3.25, 1.38, 1.16, 1.8, false],
    [-0.59, 1.38, 1.19, 1.8, false],
    [-3.23, 4.61, 1.13, 1.92, false],
    [-0.49, 4.61, 1.1, 1.92, false],
    [2.08, 4.48, 1.03, 2.03, true],
  ])
    sash(out, front, u, y, w, h, lod, glass);
  for (const [[a, b], i] of pairs(closed(bay)).map((p, i) => [p, i])) {
    if (i < 1 || i > 4) continue;
    const f = edge(a, b, areaSign(bay));
    const width = Math.min(f.length * 0.74, 1.04);
    sash(out, f, f.length / 2, 1.32, width, 1.86, lod, true);
    sash(out, f, f.length / 2, 4.8, width, 1.76, lod, true);
    for (const h of [4, 4.28, 6.89]) cornice(out, f, 0, f.length, h, lod);
  }
  for (const [z, y] of [
    [3.14, 1.22],
    [4.83, 1.22],
    [3.14, 4.62],
    [4.83, 4.62],
  ])
    sash(out, left, z, y, 1.52, 1.56, lod);
  for (const [x, y] of [
    [-7.73, 1.26],
    [-6.17, 1.26],
    [-7.73, 4.79],
    [-6.17, 4.79],
  ])
    sash(out, plane(5.93, 1), x, y, 1.43, 1.53, lod);
  for (const f of [westWall, farWall]) {
    const l = f === westWall ? -2.45 : -11.65,
      r = f === westWall ? 1.95 : 3.66;
    cornice(out, f, l, r, f === westWall ? eave - 0.42 : eave - 0.19, lod);
    for (let i = 0, n = f === westWall ? 2 : 5; i < n; i++) {
      const z = mix(l, r, (i + 0.5) / n);
      sash(out, f, z, 1.37, 1.07, 1.79, lod);
      sash(out, f, z, 4.66, 1.07, 1.63, lod, i === 1);
    }
  }
  const rear = plane(-12.022, -1);
  for (const x of [2.62, 5.84, 8.92])
    for (const y of [1.51, 4.67]) sash(out, rear, x, y, 1.13, 1.75, lod);
  for (const x of [-6.24, -3.98, -1.69])
    for (const y of [1.51, 4.67]) sash(out, plane(-13.826, -1), x, y, 1.05, 1.68, lod);
}

export const skyline = (out) => house(out, 0);
export const district = (out) => house(out, 1);
export const street = (out) => house(out, 2);
export const closeup = (out) => house(out, 3);

export const wolfeHouseModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'residence',
  recipe,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The North Spruce Street frontage fixes orientation. The stone plinth meets the independent terrain.',
  brief:
    'Restored yellow clapboard boarding house on North Spruce Street with a wraparound veranda, upper balcony, window bay and brick chimneys.',
  camera,
  lookAt,
  sunDirection: [-29, 50, 58],
  limitations: plan.limitations,
  surfaces,
  build: closeup,
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.93,
    basis: 'The named native house outline defines the replacement footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'north-spruce-veranda', position: [-20, 7, 29], lookAt: [-1, 3.8, 5] },
    { name: 'projecting-bay-and-balcony', position: [18, 9, 27], lookAt: [3.5, 4.6, 5.5] },
    { name: 'gable-roof-and-rear', position: [24, 17, -28], lookAt: [0, 4.1, -0.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'wolfe-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.82,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
};

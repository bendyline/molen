import { readFileSync } from 'node:fs';
import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94 },
  stone: { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.84 },
};
const pink = rgb('cb8d8e'),
  lightPink = rgb('d39a96'),
  white = rgb('e2ddce'),
  masonry = rgb('beb3a6'),
  red = rgb('9c5349'),
  redLight = rgb('aa604f'),
  roofBack = rgb('884c44'),
  shade = rgb('49564e'),
  sash = rgb('c9cbb9'),
  sashDark = rgb('638074'),
  iron = rgb('5e675a');
const rect = (l, r, b, f) => [
  [l, f],
  [r, f],
  [r, b],
  [l, b],
];
const v3 = ([x, z], h) => [x, h, z];
const midpoint = (a, b, t = 0.5) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
function box(out, slot, l, r, b, f, base, top, color) {
  abox(out, slot, [l, base, b], [r, top, f], color, { bottom: false });
}
function faceBox(out, F, slot, l, r, b, t, d0, d1, color) {
  fbox(out, slot, F, l, r, b, t, d0, d1, color);
}
function apron(out, footprint, height) {
  extrude(out, 'wall', footprint, -2.5, height, pink, { top: false });
  const cap = new MeshBufferBuilder();
  if (
    !cap.addCap(
      'roof',
      'palette:#ffffff',
      footprint,
      [],
      () => height,
      [0, 1, 0],
      (p) => p,
      roofBack,
    )
  )
    throw new Error('Could not seal the mapped exterior');
  const m = cap.finalize();
  const at = (i) => [...m.positions.subarray(i * 3, i * 3 + 3)];
  for (let i = 0; i < m.indices.length; i += 3)
    tri(out, 'roof', at(m.indices[i]), at(m.indices[i + 1]), at(m.indices[i + 2]), roofBack);
}
function shell(out, ring, y0, y1, color) {
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    quad4(out, 'wall', F.P(0, y0), F.P(F.length, y0), F.P(F.length, y1), F.P(0, y1), color);
  }
}
function hipRoof(out, [a, b, c, d], eave, ridge, endInset = 0.15) {
  const left = midpoint(a, d),
    right = midpoint(b, c);
  const u = v3(midpoint(left, right, endInset), ridge),
    v = v3(midpoint(right, left, endInset), ridge);
  quad4(out, 'roof', v3(a, eave), v3(b, eave), v, u, red);
  quad4(out, 'roof', v3(c, eave), v3(d, eave), u, v, roofBack);
  tri(out, 'roof', v3(b, eave), v3(c, eave), v, redLight);
  tri(out, 'roof', v3(d, eave), v3(a, eave), u, redLight);
}
function trimPlane(out, F, y, w) {
  quad4(
    out,
    'stone',
    F.P(0, y - 0.25, 0.15),
    F.P(w, y - 0.25, 0.15),
    F.P(w, y + 0.12, 0.15),
    F.P(0, y + 0.12, 0.15),
    white,
  );
}
function window(out, F, u, y, w, h, level, shutters = true) {
  if (level <= 1) {
    quad4(
      out,
      'glass',
      F.P(u - w / 2, y, 0.04),
      F.P(u + w / 2, y, 0.04),
      F.P(u + w / 2, y + h, 0.04),
      F.P(u - w / 2, y + h, 0.04),
      shade,
    );
    return;
  }
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'wood',
    glass: shade,
    frame: sash,
    frameWidth: 0.095,
    frameDepth: 0.09,
    d: 0.045,
    sill: true,
    mullions: 1,
    transoms: level === 3 ? 1 : 0,
  });
  if (shutters)
    for (const direction of [-1, 1]) {
      const mid = u + direction * (w * 0.5 + 0.31);
      faceBox(
        out,
        F,
        'wood',
        mid - 0.241,
        mid + 0.241,
        y + 0.04,
        y + h - 0.04,
        0.025,
        0.112,
        sashDark,
      );
      if (level === 3)
        for (let n = 0; n < 6; n++) {
          const at = y + 0.12 + ((h - 0.22) * n) / 6;
          faceBox(out, F, 'wood', mid - 0.2, mid + 0.2, at, at + 0.032, 0.109, 0.137, sash);
        }
    }
}
function column(out, x, z, base, top, sz, level, ornate = false) {
  const n = [5, 6, 9, 12][level];
  const root = base + 0.25;
  const profile =
    level === 0
      ? [
          [root, sz, sz],
          [top, sz * 0.84, sz * 0.84],
        ]
      : [
          [root, sz * 1.17, sz * 1.17],
          [root + 0.13, sz, sz],
          [top - 0.38, sz * 0.86, sz * 0.86],
          [top - 0.18, sz * 0.99, sz * 0.99],
          [top, sz * 1.21, sz * 1.21],
        ];
  lathe(out, 'stone', [x, z], profile, n, white, { capTop: false });
  if (level >= 1) {
    box(
      out,
      'stone',
      x - sz * 1.24,
      x + sz * 1.24,
      z - sz * 1.24,
      z + sz * 1.24,
      base,
      root,
      white,
    );
    box(
      out,
      'stone',
      x - sz * 1.28,
      x + sz * 1.28,
      z - sz * 1.24,
      z + sz * 1.24,
      top - 0.004,
      top + 0.14,
      white,
    );
  }
  if (ornate && level >= 2)
    for (const sign of [-1, 1]) {
      const rx = x + sign * sz * 0.92;
      lathe(
        out,
        'stone',
        [rx, z],
        [
          [top - 0.25, sz * 0.32, sz * 0.32],
          [top + 0.03, sz * 0.32, sz * 0.32],
        ],
        n,
        white,
      );
    }
}
function portico(out, level) {
  const l = 0.26,
    r = 9.47,
    b = 21.67,
    f = 27.12;
  box(out, 'stone', l - 0.21, r + 0.21, b, f + 0.16, 0.1, 0.66, masonry);
  box(out, 'stone', l - 0.11, r + 0.11, b, f + 0.14, 9.12, 9.42, white);
  box(out, 'stone', l - 0.34, r + 0.34, b, f + 0.27, 9.42, 9.7, white);
  for (const x of [0.92, 3.54, 6.18, 8.8]) column(out, x, 26.42, 0.66, 9.1, 0.34, level, true);
  const a = [l - 0.24, 9.7, f + 0.18],
    e = [r + 0.24, 9.7, f + 0.18],
    apex = [4.86, 11.97, f + 0.18];
  tri(out, 'stone', a, e, apex, white);
  tri(
    out,
    'wall',
    [l + 0.97, 9.95, f + 0.196],
    [r - 0.97, 9.95, f + 0.196],
    [4.86, 11.57, f + 0.196],
    lightPink,
  );
  quad4(out, 'roof', a, apex, [4.86, 11.97, b], [l - 0.24, 9.7, b], red);
  quad4(out, 'roof', apex, e, [r + 0.24, 9.7, b], [4.86, 11.97, b], red);
  const F = facade([4.86, 22.31], [1, 0]);
  if (level >= 1) {
    window(out, F, 0, 0.68, 2.13, 3.18, level, false);
    window(out, F, 0, 5.45, 1.81, 2.51, level, false);
    box(out, 'stone', 1.83, 7.88, 22.23, 26.27, 4.53, 4.78, white);
    if (level >= 2)
      for (let i = 0; i < 12; i++) {
        const x = 1.95 + i * 0.53;
        box(out, 'wood', x, x + 0.062, 26.25, 26.36, 4.78, 5.53, white);
      }
    box(out, 'wood', 1.81, 7.94, 26.22, 26.42, 5.52, 5.64, white);
    for (let n = 0; n < 3; n++)
      box(
        out,
        'stone',
        0.28 - n * 0.21,
        9.46 + n * 0.21,
        27.05,
        27.43 + n * 0.29,
        0.07 - n * 0.13,
        0.26 - n * 0.13,
        masonry,
      );
  }
}
function cupola(out, level) {
  const x = 4.71,
    z = 9.02,
    n = [6, 8, 10, 14][level];
  box(out, 'stone', x - 1.24, x + 1.24, z - 1.09, z + 1.09, 13.62, 14.1, white);
  lathe(
    out,
    'wall',
    [x, z],
    [
      [14.04, 1.06, 1.06],
      [15.53, 1.06, 1.06],
      [15.64, 1.24, 1.24],
    ],
    n,
    lightPink,
  );
  lathe(
    out,
    'roof',
    [x, z],
    [
      [15.6, 1.24, 1.24],
      [16.02, 1.14, 1.14],
      [16.62, 0.64, 0.64],
      [16.83, 0.078, 0.078],
    ],
    n,
    red,
  );
  box(out, 'metal', x - 0.059, x + 0.059, z - 0.059, z + 0.059, 16.8, 17.33, iron);
  if (level >= 1)
    for (const [x0, z0, dx, dz] of [
      [0, 1, 1, 0],
      [-1, 0, 0, 1],
      [0, -1, -1, 0],
      [1, 0, 0, -1],
    ])
      window(
        out,
        facade([x + x0 * 1.067, z + z0 * 1.067], [dx, dz]),
        0,
        14.32,
        0.54,
        1.02,
        level,
        false,
      );
}
function ballroom(out, level) {
  const north = wallFace([-45.79, -5.18], [-15.45, 5.54]);
  const w = north.length;
  faceBox(out, north, 'stone', 0, w, 0.006, 0.33, -3.3, 0.15, white);
  faceBox(out, north, 'stone', 0, w, 3.75, 4.03, -3.3, 0.19, white);
  faceBox(out, north, 'stone', 0, w, 7.45, 7.72, -3.3, 0.24, white);
  for (let i = 0; i <= 8; i++) {
    const u = 0.25 + (i * (w - 0.5)) / 8;
    const [x, , z] = north.P(u, 0, 0.04);
    column(out, x, z, 0.29, 3.73, 0.156, level);
    if (level >= 1) column(out, x, z, 4.02, 7.42, 0.142, level);
    if (level >= 2 && i < 8) {
      const w2 = (w - 0.5) / 8;
      const glassWall = facade(
        [
          x + 1.02 * north.along[0] - 2.91 * north.normal[0],
          z + 1.02 * north.along[1] - 2.91 * north.normal[1],
        ],
        north.along,
      );
      window(out, glassWall, 0.62, 4.75, 1.04, 1.84, level);
      if (level === 3)
        for (let j = 1; j < 8; j++) {
          const l = u + (j * w2) / 8;
          faceBox(out, north, 'wood', l - 0.031, l + 0.031, 4.14, 4.73, -0.027, 0.052, white);
        }
    }
  }
  if (level >= 1) faceBox(out, north, 'wood', 0, w, 4.7, 4.81, -0.03, 0.09, white);
}
function build(out, level) {
  const outline = outwardRing(frame.geometry.outline).map(([x, z]) =>
    x > -0.1 && x < 9.75 && z > 22.7 ? [x, 22.7] : [x, z],
  );
  apron(out, outline, 4.78);
  const main = rect(-11.51, 21.08, -5.41, 22.27),
    east = [
      [-46.64, -4.68],
      [-15.83, 6.15],
      [-10.26, -12.64],
      [-40.45, -22.15],
    ],
    west = rect(20.9, 44.83, -5.67, 7.71),
    link = rect(20.01, 28.06, 4.37, 15.76);
  shell(out, main, 4.71, 9.04, lightPink);
  shell(
    out,
    [
      [-45.75, -6.61],
      [-15.54, 3.92],
      [-10.36, -12.63],
      [-40.43, -22.15],
    ],
    4.73,
    7.63,
    pink,
  );
  shell(out, west, 4.74, 6.77, pink);
  shell(out, link, 4.72, 5.85, pink);
  hipRoof(out, rect(-11.82, 21.33, -5.68, 22.52), 9.05, 14.19, 0.17);
  hipRoof(out, east, 7.63, 11.76, 0.19);
  hipRoof(out, rect(20.63, 45.17, -5.92, 8.03), 6.77, 10.08, 0.18);
  hipRoof(out, rect(19.79, 28.28, 4.14, 15.99), 5.82, 7.73, 0.29);
  portico(out, level);
  cupola(out, level);
  ballroom(out, level);
  if (level === 0) return;
  const front = facade([-11.45, 22.37], [1, 0]);
  trimPlane(out, front, 8.86, 32.39);
  trimPlane(out, front, 4.41, 32.39);
  for (const x of [2.63, 6.73, 10.41, 22.23, 26.4, 30.45])
    for (const y of [1.37, 5.41]) window(out, front, x, y, 1.18, 2.32, level);
  const back = facade([21.08, -5.43], [-1, 0]);
  trimPlane(out, back, 8.87, 32.5);
  for (const x of [3.5, 8.5, 13.48, 19, 24.23, 29.32])
    for (const y of [1.73, 5.33]) window(out, back, x, y, 1.18, 2.12, level);
  const right = facade([20.98, 7.73], [1, 0]);
  trimPlane(out, right, 6.65, 23.9);
  for (const x of [2.4, 5.99, 9.68, 13.34, 16.96, 20.51])
    window(out, right, x, 3.43, 1.09, 2.18, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'government-house-nassau-model.mjs';
const camera = [-49, 28, 82],
  lookAt = [0, 6, 6];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic-residence',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Nassau Government House on Mount Fitzwilliam, with pink walls, white portico and verandas, red hip roofs and a centered cupola.',
  camera,
  lookAt,
  sunDirection: [-28, 56, 54],
  mediumFiContext: {
    scale: 1.13,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.85,
    basis: 'The named map footprint locates the standing Georgian exterior.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'mount-fitzwilliam-front', position: camera, lookAt },
    { name: 'ionic-portico-and-cupola', position: [7, 15, 49], lookAt: [4, 8, 23] },
    { name: 'ballroom-veranda-and-linked-wings', position: [-69, 22, 36], lookAt: [-15, 6, 7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'government-house-nassau-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.23, surfaces },
      street: { export: 'street', errorMeters: 0.08, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.027, surfaces },
    },
  },
};

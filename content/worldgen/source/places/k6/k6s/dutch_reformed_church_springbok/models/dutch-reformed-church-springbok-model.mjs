import { readFileSync } from 'node:fs';
import {
  arch,
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  pairs,
  plane,
  rect,
  ring,
  shell,
  stairs,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const floor = d.principalFloor;
const grade = floorSampler(read('terrain-grid.json'));
const eave = d.mainEave;

const tone = palette({
  granite: 'a9a69d',
  trim: 'c4bcaa',
  rubble: '8c8a81',
  shadow: '837f73',
  roof: 'c7c9c7',
  roofShade: 'b5b9b8',
  roofSeam: 'a4aaa9',
  glass: '485853',
  blueGlass: '3d4d58',
  green: '4d6659',
  clock: '34434a',
  roman: 'dfd9c0',
  bronze: '6d5844',
  louver: '513d2e',
});
const surfaces = {
  granite: surface('wall', 'stone_ashlar', 0.94),
  trim: surface('trim', 'stone_limestone', 0.92),
  footing: surface('foundation', 'stone_granite', 0.95),
  roof: surface('roof', 'metal_standing_seam', 0.81, 0.18),
  window: surface('window', 'window_grid', 0.62),
  detail: surface('trim', 'metal_painted', 0.81, 0.13),
};
const sidePlane = (x, direction) => ({
  normal: [direction, 0, 0],
  p: (u, y, offset = 0) => [x + direction * offset, y, u],
});
const front = plane(15.58, 1);
const rear = plane(-10.78, -1);
const west = sidePlane(11.836, 1);

function roofPanels(out, w, atLeft, center, atRight, start, end, h, peak, lod) {
  for (const [outer, color] of [
    [atLeft, tone.roof],
    [atRight, tone.roofShade],
  ]) {
    face(
      out,
      'roof',
      [w(outer, h, start), w(center, peak, start), w(center, peak, end), w(outer, h, end)],
      up,
      color,
    );
    if (lod < 2) continue;
    const seams = Math.round((end - start) / 1.75);
    for (let i = 1; i < seams; i++) {
      const u = mix(start, end, i / seams);
      face(
        out,
        'roof',
        [
          w(outer, h + 0.029, u - 0.024),
          w(center, peak + 0.029, u - 0.024),
          w(center, peak + 0.032, u + 0.024),
          w(outer, h + 0.032, u + 0.024),
        ],
        up,
        tone.roofSeam,
      );
    }
  }
}

function stoneGable(out, w, a, mid, b, bottom, top, lod) {
  face(
    out,
    'granite',
    [
      [a, bottom],
      [b, bottom],
      [mid, top],
    ].map(([x, y]) => w.p(x, y)),
    w.normal,
    tone.granite,
  );
  if (lod === 0) return;
  for (const end of [a, b]) {
    face(
      out,
      'trim',
      [
        [end, bottom + 0.04],
        [mid, top + 0.15],
        [mid, top - 0.09],
        [end, bottom - 0.23],
      ].map(([x, y]) => w.p(x, y, 0.044)),
      w.normal,
      tone.trim,
    );
  }
}

function mainBuilding(out, lod) {
  const outline = d.outline;
  shell(out, outline, (p) => Math.min(floor - 0.33, grade(p) - 0.38), floor, {
    wall: 'footing',
    color: tone.rubble,
  });
  shell(out, outline, () => floor - 0.02, eave, { wall: 'granite', color: tone.granite });
  cap(out, 'granite', outline, eave - 0.01, tone.granite);
  roofPanels(
    out,
    (x, y, z) => [x, y, z],
    -8.41,
    -0.62,
    6.97,
    -10.99,
    15.83,
    eave,
    d.naveRidge,
    lod,
  );
  roofPanels(
    out,
    (z, y, x) => [x, y, z],
    -8.39,
    -0.14,
    8.11,
    -10.63,
    12.06,
    eave - 0.02,
    13.49,
    lod,
  );
  stoneGable(out, front, -8.2, -0.62, 6.75, eave, d.naveRidge, lod);
  stoneGable(out, rear, -5.83, -0.12, 5.91, eave, 12.07, lod);
  stoneGable(out, west, -8.45, -0.14, 8.1, eave, 13.49, lod);
  stoneGable(out, sidePlane(-10.455, -1), -8.61, -3.92, 0.01, eave, 10.75, lod);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, areaSign(outline));
    panel(out, 'trim', w, 0, w.length, eave - 0.3, eave - 0.06, 0.055, tone.trim);
    if (lod > 0) {
      panel(out, 'footing', w, 0, w.length, floor + 0.12, floor + 0.6, 0.073, tone.rubble);
      panel(out, 'trim', w, 0, w.length, floor + 0.53, floor + 0.68, 0.1, tone.trim);
    }
  }
}

function circle(out, w, cx, cy, r, segments, offset, slot, color) {
  const p = Array.from({ length: segments }, (_, i) => {
    const a = (2 * Math.PI * i) / segments;
    return w.p(cx + r * Math.cos(a), cy + r * Math.sin(a), offset);
  });
  face(out, slot, p, w.normal, color);
}
function circleBand(out, w, x, y, r, width, n, z, slot, color) {
  for (let i = 0; i < n; i++) {
    const p = (j, t) => {
      const a = (2 * Math.PI * j) / n;
      return w.p(x + t * Math.cos(a), y + t * Math.sin(a), z);
    };
    face(out, slot, [p(i, r), p(i + 1, r), p(i + 1, r - width), p(i, r - width)], w.normal, color);
  }
}

function rose(out, w, x, y, r, lod) {
  const n = [10, 14, 18, 24][lod];
  circle(out, w, x, y, r + 0.13, n, 0.1, 'trim', tone.trim);
  circle(out, w, x, y, r - 0.13, n, 0.125, 'window', tone.blueGlass);
  if (lod === 0) return;
  const lobes = lod === 1 ? 6 : 8;
  for (let i = 0; i < lobes; i++) {
    const a = (2 * Math.PI * i) / lobes;
    const px = x + Math.cos(a) * r * 0.52,
      py = y + Math.sin(a) * r * 0.52;
    circleBand(out, w, px, py, r * 0.3, r * 0.079, lod === 3 ? 10 : 6, 0.155, 'trim', tone.trim);
  }
  circleBand(out, w, x, y, r * 0.24, r * 0.075, lod > 1 ? 10 : 6, 0.164, 'trim', tone.trim);
  if (lod === 3) circleBand(out, w, x, y, r - 0.14, 0.06, n, 0.17, 'trim', tone.trim);
}

function pointedLight(out, w, x, y, spring, width, rise, fill, lod) {
  arch(
    out,
    w,
    x,
    y,
    spring,
    width,
    rise,
    0.075,
    lod,
    { width: 0.2, inner: fill, trim: tone.trim },
    { inner: 'window', trim: 'trim' },
  );
  if (lod < 2) return;
  for (const v of [-0.3, 0.3]) {
    const u = x + v * width;
    panel(out, 'trim', w, u - 0.032, u + 0.032, y, spring + rise * 0.88, 0.124, tone.shadow);
  }
  panel(out, 'trim', w, x - width, x + width, y + 1.1, y + 1.16, 0.125, tone.trim);
}

function buttress(out, w, x, lod) {
  trimBlock(out, 'granite', w, x - 0.3, x + 0.3, floor + 0.38, eave + 2.1, 0.04, 0.4, tone.granite);
  if (lod > 0) {
    trimBlock(out, 'trim', w, x - 0.47, x + 0.47, eave + 1.08, eave + 1.41, 0.04, 0.56, tone.trim);
    trimBlock(out, 'trim', w, x - 0.42, x + 0.42, eave - 0.36, eave - 0.02, 0.03, 0.5, tone.trim);
  }
  const [a, , z] = w.p(x, eave + 1.39, 0.24);
  ring(
    out,
    'trim',
    [a, z],
    [
      [eave + 1.39, 0.4],
      [eave + 1.94, 0.37],
      [eave + 2.62, 0.045],
    ],
    lod === 3 ? 10 : 6,
    tone.trim,
  );
}

function parishFronts(out, lod) {
  rose(out, front, -0.68, 9.25, 1.72, lod);
  rose(out, west, -0.18, 9.55, 1.82, lod);
  for (const [w, places] of [
    [front, [-6.99, 5.14]],
    [west, [-7.38, 7.34]],
  ]) {
    for (const x of places) buttress(out, w, x, lod);
  }
  pointedLight(out, front, -0.62, floor + 0.14, 4.26, 1.21, 1.29, tone.louver, lod);
  for (const x of [-5.33, 4.2])
    pointedLight(out, front, x, 2.32, 4.37, 0.64, 0.77, tone.green, lod);
  for (const x of [-5.2, 0.03, 5.04])
    pointedLight(out, west, x, 2.55, 4.83, 0.64, 0.76, tone.green, lod);
  for (const x of [-3.46, 3.5]) pointedLight(out, rear, x, 2.27, 4.7, 0.64, 0.78, tone.glass, lod);
  stairs(out, grade, 'footing', -2.15, 0.91, 17.5, 15.64, floor + 0.37, lod > 0 ? 4 : 2, tone.trim);
  if (lod === 0) return;
  for (const z of [-5.5, 3.8, 9.8])
    pointedLight(out, sidePlane(-8.23, -1), z, 2.28, 4.65, 0.61, 0.77, tone.glass, lod);
}

function bellTower(out, lod) {
  const x0 = 6.74,
    x1 = 11.81,
    z0 = 8.67,
    z1 = 13.94,
    midX = (x0 + x1) / 2,
    midZ = (z0 + z1) / 2;
  const tower = rect(x0, z0, x1, z1);
  shell(out, tower, (p) => Math.min(floor, grade(p) - 0.31), d.towerBodyTop, {
    wall: 'granite',
    color: tone.granite,
  });
  const walls = [
    [plane(z1, 1), midX],
    [plane(z0, -1), midX],
    [sidePlane(x1, 1), midZ],
    [sidePlane(x0, -1), midZ],
  ];
  for (const [w, center] of walls) {
    for (const [a, b] of [
      [19.0, 19.37],
      [23.36, 23.66],
    ]) {
      trimBlock(out, 'trim', w, center - 2.66, center + 2.66, a, b, 0, 0.19, tone.trim);
    }
    arch(
      out,
      w,
      center,
      19.62,
      21.64,
      1.09,
      1.04,
      0.064,
      lod,
      { width: 0.3, trim: tone.trim, inner: tone.louver },
      { inner: 'window', trim: 'trim' },
    );
    if (lod > 0) {
      for (let j = -4; j <= 4; j++) {
        const u = center + j * 0.214;
        panel(out, 'detail', w, u - 0.04, u + 0.05, 19.63, 21.67, 0.106, tone.bronze);
      }
    }
    panel(out, 'trim', w, center - 1.07, center + 1.07, 15.23, 17.43, 0.095, tone.trim);
    panel(out, 'detail', w, center - 0.94, center + 0.94, 15.36, 17.29, 0.121, tone.clock);
    if (lod === 0) continue;
    circleBand(out, w, center, 16.315, 0.82, 0.067, 14, 0.141, 'detail', tone.roman);
    for (let j = 0; j < 12; j++) {
      const angle = (2 * Math.PI * j) / 12;
      circle(
        out,
        w,
        center + 0.65 * Math.cos(angle),
        16.315 + 0.65 * Math.sin(angle),
        0.059,
        5,
        0.154,
        'detail',
        tone.roman,
      );
    }
    panel(out, 'detail', w, center - 0.04, center + 0.04, 16.31, 16.93, 0.17, tone.roman);
    face(
      out,
      'detail',
      [
        [center, 16.37],
        [center - 0.4, 16.1],
        [center - 0.43, 16.17],
        [center, 16.28],
      ].map(([u, v]) => w.p(u, v, 0.18)),
      w.normal,
      tone.roman,
    );
    pointedLight(out, w, center, 8.62, 11.84, 0.58, 0.62, tone.green, lod);
  }
  const top = [
    [x0 - 0.43, z0 - 0.41],
    [x1 + 0.43, z0 - 0.41],
    [x1 + 0.43, z1 + 0.41],
    [x0 - 0.43, z1 + 0.41],
  ];
  const ridges = [
    [midX - 0.64, d.towerRidge, midZ],
    [midX + 0.64, d.towerRidge, midZ],
  ];
  const [a, b, c, f] = top.map((point) => at(point, d.towerBodyTop));
  const [p, q] = ridges;
  face(out, 'roof', [a, b, q, p], up, tone.roofShade);
  face(out, 'roof', [f, p, q, c], up, tone.roof);
  face(out, 'roof', [a, p, f], up, tone.roofShade);
  face(out, 'roof', [b, c, q], up, tone.roof);
  block(
    out,
    'detail',
    midX - 0.032,
    d.towerRidge - 0.04,
    midZ - 0.032,
    0.064,
    2.17,
    0.064,
    tone.bronze,
  );
}

function sideTurret(out, lod) {
  const center = [10.1, 6.28],
    base = [4.55, 5.95, 7.09];
  ring(
    out,
    'granite',
    center,
    [
      [floor, 1.38],
      [base[0], 1.38],
      [base[0] + 0.04, 1.56],
    ],
    8,
    tone.granite,
  );
  ring(
    out,
    'roof',
    center,
    [
      [base[0], 1.72],
      [base[1], 0.34],
      [base[2] - 0.65, 0.06],
    ],
    8,
    tone.roofShade,
  );
  if (lod > 0) circle(out, sidePlane(11.49, 1), 6.27, 2.61, 0.17, 8, 0.03, 'window', tone.glass);
}

function build(out, lod) {
  mainBuilding(out, lod);
  parishFronts(out, lod);
  bellTower(out, lod);
  sideTurret(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'dutch-reformed-church-springbok-model.mjs';
const camera = [32, 17, 39],
  lookAt = [1.8, 9.9, 0.4];
export const klipkerkModel = {
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
    'The named Pieter Malan Street front fixes orientation. Plinths contact independently sampled terrain.',
  brief:
    'Springbok’s granite Klipkerk with its paired rose-window gables, silver standing-seam roofs, square clock tower and low stair turret.',
  camera,
  lookAt,
  sunDirection: [29, 50, 58],
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.93,
    basis: 'The named native church outline defines the replacement footprint.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'stone-church-and-clock-tower', position: [35, 9, 35], lookAt: [1.3, 10.3, 4.3] },
    { name: 'tracery-and-west-gable', position: [32, 11, 7], lookAt: [9, 8, 0] },
    { name: 'pale-roofs-and-tower', position: [-32, 22, 26], lookAt: [0, 10, 1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'klipkerk-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.84,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.47, surfaces },
      street: { export: 'street', errorMeters: 0.21, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Morné van Rooyen released his reference photograph to the public domain. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};

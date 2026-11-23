import { readFileSync } from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  rgb,
  roundArch,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  cap,
  face,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const frame = read('map-frame');
const plan = read('plan-controls');
const outline = frame.geometry.outline;
const limestone = rgb('c6b798');
const quarry = rgb('a79a81');
const trim = rgb('d8c9ab');
const reveal = rgb('b6a385');
const roof = rgb('80978b');
const patina = rgb('8ba195');
const seam = rgb('6e887d');
const glass = rgb('636a65');
const door = rgb('735f50');

const surfaces = {
  stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.94 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97 },
  roof: { slot: 'roof', graph: 'metal_copper', roughness: 0.86, metallic: 0.15 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.65 },
};

const rectangle = (x0, x1, z0, z1) => [
  [x0, z0],
  [x0, z1],
  [x1, z1],
  [x1, z0],
];
const on = (ring, from, to) => ring.slice(from, to + 1);
const front = [
  [-11.8, 10.35],
  [-13.22, 14.18],
  [-13.59, 16.62],
  [-12.38, 22.58],
  [-10.26, 25.74],
  [-6.45, 26.61],
  [3.1, 26.46],
  [6.91, 25.53],
  [9.29, 21.51],
  [10.17, 16.25],
  [8.99, 10.03],
];
const gallery = [
  ...on(outline, 55, 62).reverse(),
  [-15.05, -16.02],
  [-11.7, -18.2],
  [8.4, -19.1],
  ...on(outline, 24, 32).reverse(),
];
const rear = [
  [-11.0, -16.4],
  [-11.1, -28.28],
  [-5.15, -28.41],
  [-3.6, -29.95],
  [-1.6, -30.06],
  [0.2, -28.56],
  [3.0, -28.63],
  [2.27, -24.68],
  [9.17, -23.18],
  [9.4, -16.55],
];
const towers = [
  [-15.05, -9.34, 4.12, 10.45],
  [5.76, 11.28, 3.8, 9.71],
  [-18.25, -12.88, -21.73, -16.02],
  [7.6, 12.75, -22.43, -16.65],
];
const domeCenter = [-2.3, -5.7];

function block(out, slot, range, low, high, tint) {
  const [x0, x1, z0, z1] = range;
  abox(out, slot, [x0, low, z0], [x1, high, z1], tint, { bottom: false });
}

function eachWall(ring, fn) {
  const boundary = outwardRing(ring);
  boundary.forEach((point, i) => fn(wallFace(point, boundary[(i + 1) % boundary.length])));
}

function course(out, ring, low, high, depth, tint = trim) {
  eachWall(ring, (wall) => {
    fbox(out, 'trim', wall, -0.045, wall.length + 0.045, low, high, -0.015, depth, tint);
  });
}

function window(out, wall, u, bottom, width, height, lod, style = {}) {
  const { head = 'flat', fill = glass, frameWidth = 0.15, mullions = 1 } = style;
  if (lod === 0 && head === 'flat') return;
  if (lod < 2) {
    const half = width / 2;
    const top = bottom + height;
    const crown =
      head === 'round'
        ? roundArch(half, lod === 0 ? 4 : 8)
            .reverse()
            .map(([x, y]) => [x, top - half + y])
        : [
            [half, top],
            [-half, top],
          ];
    fan(
      out,
      'glass',
      [[-half, bottom], [half, bottom], ...crown].map(([x, y]) => wall.P(u + x, y, 0.04)),
      fill,
    );
    return;
  }
  opening(out, wall, u, bottom, width, height, {
    head,
    glass: fill,
    frame: trim,
    frameWidth,
    frameDepth: 0.12,
    mullions: lod >= 2 ? mullions : 0,
    transoms: lod >= 2 && height > 2.5 ? 1 : 0,
    d: 0.035,
    sill: lod >= 1,
  });
}

function rose(out, wall, u, y, radius, lod) {
  const sides = [10, 12, 18, 24][lod];
  const ring = (r, depth) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (Math.PI * 2 * i) / sides;
      return wall.P(u + r * Math.cos(a), y + r * Math.sin(a), depth);
    });
  const outer = ring(radius + 0.25, 0.072);
  const inner = ring(radius, 0.091);
  fan(out, 'glass', inner, glass);
  for (let i = 0; i < sides; i++) {
    const k = (i + 1) % sides;
    face(
      out,
      'trim',
      [inner[i], outer[i], outer[k], inner[k]],
      [...wall.normal.slice(0, 1), 0, wall.normal[1]],
      trim,
    );
  }
  if (lod < 2) return;
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * i) / 4,
      b = a + 0.11;
    const at = (r, t) => wall.P(u + Math.cos(t) * r, y + Math.sin(t) * r, 0.114);
    face(
      out,
      'trim',
      [at(radius * 0.22, a), at(radius, a), at(radius, b), at(radius * 0.22, b)],
      [wall.normal[0], 0, wall.normal[1]],
      reveal,
    );
  }
}

function oval(x, z, rx, rz, sides, square = 1) {
  const shape = (v) => Math.sign(v) * Math.pow(Math.abs(v), square);
  return Array.from({ length: sides }, (_, i) => {
    const a = (Math.PI * 2 * i) / sides;
    return [x + rx * shape(Math.cos(a)), z + rz * shape(Math.sin(a))];
  });
}

function curvedRoof(out, base, center, spring, peak, lod, start = 0) {
  const profile =
    lod === 0
      ? [
          [1, 0],
          [0.76, 0.7],
          [0, 1],
        ]
      : lod === 1
        ? [
            [1, 0],
            [0.88, 0.46],
            [0.63, 0.83],
            [0, 1],
          ]
        : [
            [1, 0],
            [0.95, 0.27],
            [0.85, 0.53],
            [0.67, 0.77],
            [0.43, 0.93],
            [0, 1],
          ];
  const radii = profile.map(([r, h]) =>
    base.map(([x, z]) => [
      center[0] + (x - center[0]) * r,
      spring + (peak - spring) * h,
      center[1] + (z - center[1]) * r,
    ]),
  );
  for (let tier = 0; tier < radii.length - 1; tier++) {
    for (let i = 0; i < base.length; i++) {
      const k = (i + 1) % base.length;
      const low = radii[tier],
        high = radii[tier + 1];
      const points =
        tier === radii.length - 2 ? [low[i], low[k], high[i]] : [low[i], low[k], high[k], high[i]];
      const color = (i + start) % (lod >= 2 ? 7 : 4) === 0 ? patina : roof;
      face(out, 'roof', points, [0, 1, 0], color);
      if (lod === 3 && tier < radii.length - 2) {
        const peakward = (p, q) =>
          p.map((v, a) => v * 0.989 + q[a] * 0.011 + (a === 1 ? 0.035 : 0));
        const lift = (p) => [p[0], p[1] + 0.035, p[2]];
        face(
          out,
          'roof',
          [lift(low[i]), peakward(low[i], low[k]), peakward(high[i], high[k]), lift(high[i])],
          [0, 1, 0],
          seam,
        );
      }
    }
  }
}

function entrance(out, lod) {
  const towerRings = [on(outline, 3, 12), on(outline, 74, 83)];
  for (const ring of towerRings) {
    const mid = ring.reduce(([x, z], [a, b]) => [x + a / ring.length, z + b / ring.length], [0, 0]);
    extrude(out, 'stone', ring, 2.95, 6.4, limestone, { top: false });
    curvedRoof(out, ring, mid, 6.36, 7.9, lod);
  }
  extrude(out, 'stone', front, 2.9, 10.8, limestone, { top: false });
  // Keep the vestibule’s copper shoulders below the principal rose window.
  const upper = front.map(([x, z]) => [-1.85 + (x + 1.85) * 0.68, 12.52, 17.8 + (z - 17.8) * 0.68]);
  for (let i = 0; i < front.length; i++) {
    const k = (i + 1) % front.length;
    const at = ([x, z]) => [x, 10.76, z];
    face(
      out,
      'roof',
      [at(front[i]), at(front[k]), upper[k], upper[i]],
      [0, 1, 0],
      i % 5 ? roof : patina,
    );
  }
  cap(
    out,
    'roof',
    upper.map(([x, , z]) => [x, z]),
    12.52,
    roof,
  );
  const portal = wallFace(outline[0], outline[2]);
  // The measured facade is only slightly skewed. A continuous stone face keeps the arched reveal intact.
  const f = facade([-1.55, 26.6], [portal.along[0], portal.along[1]]);
  const base = 1.85;
  block(out, 'stone', [-5.5, 2.7, 25.73, 26.62], 2.6, 8.14, limestone);
  window(out, facade([-1.55, 26.66], [1, 0]), 0, base, 6.5, 5.35, lod, {
    head: 'round',
    fill: door,
    frameWidth: 0.43,
    mullions: 3,
  });
  if (lod >= 1) {
    const steps = [2, 4, 6, 9][lod];
    for (let i = 0; i < steps; i++) {
      const z = 26.68 + (i * 2.65) / steps;
      const height = base * (1 - i / steps);
      block(
        out,
        'trim',
        [-5.21 - i * 0.035, 2.04 + i * 0.035, z, z + 2.66 / steps],
        -0.45,
        height,
        quarry,
      );
    }
    for (const u of [-3.08, -1.85, -0.61, 0.61, 1.85, 3.08])
      fbox(out, 'trim', f, u - 0.3, u + 0.3, 8.88, 9.63, 0.06, 0.16, reveal);
  }
  const gableFace = facade([-2, 10.6], [1, 0]);
  const gableBody = rectangle(-10.55, 6.55, 3.45, 10.6);
  extrude(out, 'stone', gableBody, 7.7, 13.1, limestone, { top: false });
  gableRoof(out, 'roof', [-2, 3.45], [-2, 10.6], 17.12, 13.1, 22.02, roof, {
    overhang: 0.18,
    endSlot: 'stone',
    endColor: limestone,
  });
  rose(out, gableFace, 0, 16.2, 1.46, lod);
  if (lod >= 2) {
    for (const u of [-3.3, 3.3])
      fbox(out, 'trim', gableFace, u - 0.16, u + 0.16, 14.36, 19.05, 0, 0.22, trim);
  }
}

function flank(out, indices, lod) {
  for (const [[a, b], i] of indices.map((pair, i) => [pair, i])) {
    const oriented = outwardRing(gallery);
    const start = oriented.findIndex((p) => p === outline[a]);
    const next = oriented[(start + 1) % oriented.length];
    const wall =
      next === outline[b] ? wallFace(outline[a], outline[b]) : wallFace(outline[b], outline[a]);
    const mid = wall.length / 2;
    const full = i % 2 === 1;
    if (full)
      window(out, wall, mid, 7.45, Math.min(3.35, wall.length * 0.84), 7.12, lod, {
        head: 'round',
        frameWidth: 0.28,
        mullions: 3,
      });
    if (lod >= 1)
      window(out, wall, mid, 3.72, Math.min(2.24, wall.length * 0.77), 2.36, lod, { mullions: 2 });
  }
}

function mainHall(out, lod) {
  extrude(out, 'stone', gallery, 2.9, 17.0, limestone, { top: false });
  curvedRoof(out, gallery, domeCenter, 16.95, 24.0, lod, 2);
  if (lod >= 1) {
    course(out, gallery, 6.75, 7.14, 0.19);
    course(out, gallery, 16.59, 16.98, 0.29);
  }
  flank(
    out,
    [
      [24, 25],
      [25, 26],
      [26, 27],
      [28, 29],
      [29, 30],
      [30, 31],
    ],
    lod,
  );
  flank(
    out,
    [
      [55, 56],
      [56, 57],
      [57, 58],
      [59, 60],
      [60, 61],
      [61, 62],
    ],
    lod,
  );
  const [x, z] = domeCenter;
  const drum = rectangle(x - 8.12, x + 8.12, z - 8.58, z + 8.58);
  extrude(out, 'stone', drum, 19.0, 26.02, limestone, { top: false });
  if (lod > 0) course(out, drum, 25.65, 26.08, 0.38);
  const upper = rectangle(x - 7.22, x + 7.22, z - 7.62, z + 7.62);
  const foot = oval(x, z, 7.3, 7.7, [12, 20, 28, 36][lod], 0.78);
  extrude(out, 'stone', upper, 26.01, 28.0, limestone, { top: false });
  cap(out, 'stone', upper, 28, limestone);
  if (lod > 0) course(out, upper, 27.78, 28.03, 0.25);
  eachWall(upper, (f) => {
    for (const gap of [-4.36, -2.62, -0.87, 0.87, 2.62, 4.36])
      window(out, f, f.length / 2 + gap, 26.48, 0.78, 1.22, lod, {
        head: 'round',
        frameWidth: 0.095,
      });
  });
  if (lod >= 2)
    eachWall(drum, (f) => {
      for (const gap of [-5.25, -3.15, -1.05, 1.05, 3.15, 5.25])
        fbox(
          out,
          'trim',
          f,
          f.length / 2 + gap - 0.09,
          f.length / 2 + gap + 0.09,
          21.9,
          25.47,
          0,
          0.17,
          reveal,
        );
    });
  curvedRoof(out, foot, domeCenter, 28.0, 34.0, lod);
}

function corners(out, lod) {
  for (const [x0, x1, z0, z1] of towers) {
    const ring = rectangle(x0, x1, z0, z1);
    extrude(out, 'stone', ring, 2.95, 20.85, limestone, { top: false });
    cap(out, 'stone', ring, 20.85, limestone);
    if (lod > 0) course(out, ring, 20.65, 20.92, 0.27);
    const x = (x0 + x1) / 2,
      z = (z0 + z1) / 2;
    const footprint = oval(
      x,
      z,
      (x1 - x0) / 2 + 0.06,
      (z1 - z0) / 2 + 0.06,
      [8, 12, 16, 24][lod],
      0.78,
    );
    curvedRoof(out, footprint, [x, z], 20.87, 23.05, lod);
    if (lod === 0) continue;
    eachWall(ring, (f) => {
      window(out, f, f.length / 2, 17.75, 2.02, 2.02, lod, { frameWidth: 0.22, mullions: 3 });
      if (lod >= 2) window(out, f, f.length / 2, 8.2, 1.75, 2.35, lod, { mullions: 2 });
    });
  }
}

function rearRange(out, lod) {
  extrude(out, 'stone', rear, 2.96, 12.58, limestone, { top: false });
  cap(out, 'stone', rear, 12.58, limestone);
  gableRoof(out, 'roof', [-2.5, -16.8], [-2.5, -27.96], 17.1, 12.6, 19.58, roof, {
    overhang: 0.34,
    endSlot: 'stone',
    endColor: limestone,
  });
  const f = facade([-2.5, -28.32], [-1, 0]);
  rose(out, f, -0.18, 10.55, 1.22, lod);
  for (const u of [-6.1, -4.65, 3.95, 5.36])
    window(out, f, u, 5.6, 0.95, 3.5, lod, { head: 'round' });
}

function build(out, lod) {
  const base = lod === 0 ? outline.filter((_, i) => i % 2 === 0) : outline;
  extrude(out, 'base', base, -2.75, 3.02, quarry, { top: false });
  cap(out, 'stone', base, 3.02, limestone);
  if (lod >= 2) course(out, outline, 2.71, 3.02, 0.14, reveal);
  mainHall(out, lod);
  rearRange(out, lod);
  entrance(out, lod);
  corners(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [68, 42, 83];
const lookAt = [-1.6, 15.0, 0];
const recipe = 'old-synagogue-essen-model.mjs';
export const model = {
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
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Edmund Körner’s domed shell-limestone synagogue, with the Steeler Tor entry and four small copper domes.',
  camera,
  lookAt,
  sunDirection: [56, 66, 52],
  mediumFiContext: {
    scale: 1.35,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.9,
    basis: 'The surviving mapped Old Synagogue shell and its current entry stair projections.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'stone_limestone', 'metal_copper'],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'steeler-tor-entrance-and-copper-dome', position: camera, lookAt },
    {
      name: 'arched-gallery-windows-and-corner-towers',
      position: [70, 28, -33],
      lookAt: [-2, 13.5, -4],
    },
    {
      name: 'alfredistrasse-gallery-and-rear-elevation',
      position: [-76, 37, -63],
      lookAt: [-2, 12.5, -7],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'old-synagogue-essen-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' +
      plan.cell +
      '/' +
      plan.model +
      '/models/old-synagogue-essen-model.mjs',
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.68,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.35, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.061, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from public-domain 1914 architectural drawings, OpenStreetMap ODbL geometry and Geobasis NRW open terrain.',
};

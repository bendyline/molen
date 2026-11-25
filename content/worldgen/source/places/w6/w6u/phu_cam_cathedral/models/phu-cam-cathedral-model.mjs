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
  quad4,
  rgb,
  roundArch,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (key) => JSON.parse(readFileSync(new URL(`../${key}.json`, import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const site = read('native-map/phu-cam-historic-site');
const platform = 3.2;
const surfaces = {
  wall: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89 },
  coping: { slot: 'trim', graph: 'stucco', roughness: 0.92 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.94 },
  window: { slot: 'window', localRef: 'palette:#515053', roughness: 0.46 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.91 },
};
const color = {
  brick: rgb('9c7462'),
  trim: rgb('cabca0'),
  light: rgb('d2c5a9'),
  shade: rgb('b7a88c'),
  footing: rgb('988976'),
  tile: rgb('81655b'),
  dome: rgb('7e8175'),
  glass: rgb('4a4541'),
  wood: rgb('5a4941'),
};

function moulding(out, face, lo, hi, y, height = 0.23, depth = 0.21) {
  fbox(out, 'coping', face, lo, hi, y, y + height, -0.035, depth, color.trim);
}

function window(out, face, x, y, width, height, lod, { arched = true, door = false } = {}) {
  if (!lod) {
    const point = (dx, dy) => face.P(x + dx * width, y + dy * height, 0.024);
    quad4(
      out,
      door ? 'door' : 'window',
      point(-0.5, 0),
      point(0.5, 0),
      point(0.5, 1),
      point(-0.5, 1),
      color.glass,
    );
    return;
  }
  opening(out, face, x, y, width, height, {
    head: arched ? 'round' : 'flat',
    glassSlot: door ? 'door' : 'window',
    frameSlot: 'coping',
    glass: door ? color.wood : color.glass,
    frame: color.light,
    frameWidth: lod >= 2 ? 0.145 : 0,
    frameDepth: 0.125,
    mullions: lod === 3 ? 1 : 0,
    sill: !door,
  });
}

function oculus(out, face, x, y, radius, lod) {
  const sides = [8, 12, 16, 24][lod];
  const p = (angle, r, depth) => face.P(x + Math.cos(angle) * r, y + Math.sin(angle) * r, depth);
  for (let i = 0; i < sides; i++) {
    const a = (2 * Math.PI * i) / sides,
      b = (2 * Math.PI * (i + 1)) / sides;
    tri(out, 'window', face.P(x, y, 0.026), p(a, radius, 0.026), p(b, radius, 0.026), color.glass);
    if (lod)
      quad4(
        out,
        'coping',
        p(a, radius, 0.16),
        p(a, radius + 0.22, 0.16),
        p(b, radius + 0.22, 0.16),
        p(b, radius, 0.16),
        color.light,
      );
    if (lod >= 2 && i % (lod === 3 ? 3 : 4) === 0) {
      tri(
        out,
        'coping',
        face.P(x, y, 0.044),
        p(a - 0.028, radius, 0.048),
        p(a + 0.028, radius, 0.048),
        color.shade,
      );
    }
  }
}

function cross(out, x, y, z, size) {
  abox(
    out,
    'coping',
    [x - size * 0.08, y, z - 0.08],
    [x + size * 0.08, y + size, z + 0.08],
    color.shade,
  );
  abox(
    out,
    'coping',
    [x - size * 0.31, y + size * 0.63, z - 0.085],
    [x + size * 0.31, y + size * 0.76, z + 0.085],
    color.shade,
  );
}

function pinnacles(out, [x, z], height, lod) {
  const sides = lod < 2 ? 4 : 8;
  lathe(
    out,
    'coping',
    [x, z],
    [
      [height, 0.3, 0.3],
      [height + 0.62, 0.2, 0.2],
      [height + 0.82, 0.26, 0.26],
      [height + 1.13, 0.02, 0.02],
    ],
    sides,
    color.light,
  );
}

function turret(out, x, lod) {
  const half = 2.39,
    z = 26.48;
  const lo = x - half,
    hi = x + half;
  const towerRing = [
    [lo, z - half],
    [lo, z + half],
    [hi, z + half],
    [hi, z - half],
  ];
  extrude(out, 'wall', towerRing, platform, 22.85, color.brick);
  for (let i = 0; i < towerRing.length; i++) {
    const face = wallFace(towerRing[i], towerRing[(i + 1) % 4]);
    for (const y of lod ? [7.9, 11.6, 15.35, 18.75, 21.68, 22.42] : [10.9, 18.75, 22.35])
      moulding(out, face, -0.12, face.length + 0.12, y);
    if (i === 1 || lod >= 2) {
      const middle = face.length / 2;
      window(out, face, middle, platform + 0.07, 1.8, 4.4, lod, { door: true });
      window(out, face, middle, 8.2, 1.22, 2.7, lod);
      oculus(out, face, middle, 16.85, 0.93, lod);
      window(out, face, middle, 19.33, 0.86, 1.7, lod);
    }
    if (lod)
      for (const edge of [0.1, face.length - 0.43]) {
        fbox(out, 'coping', face, edge, edge + 0.34, platform, 22.56, -0.045, 0.185, color.light);
      }
  }
  const radial = [8, 12, 16, 24][lod];
  const roofRings = [
    [22.42, 2.07],
    [23.14, 2.07],
    [23.88, 1.72],
    [24.42, 1.12],
    [24.71, 0.51],
  ];
  lathe(
    out,
    'roof',
    [x, z],
    roofRings.map(([y, r]) => [y, r, r]),
    radial,
    color.dome,
  );
  lathe(
    out,
    'coping',
    [x, z],
    [
      [24.63, 0.54, 0.54],
      [25.45, 0.43, 0.43],
      [25.66, 0.48, 0.48],
    ],
    radial,
    color.light,
  );
  cross(out, x, 25.65, z, 1.09);
  if (lod)
    for (const dx of [-1.99, 1.99]) {
      for (const dz of [-1.99, 1.99]) pinnacles(out, [x + dx, z + dz], 22.55, lod);
    }
}

function arch(out, face, x, half, sill, rise, top, depth, lod) {
  const spring = sill + rise;
  const points = roundArch(half, [4, 6, 8, 12][lod]);
  const p = (u, y, d) => face.P(x + u, y, d);
  for (let i = 1; i < points.length; i++) {
    const [u0, a] = points[i - 1],
      [u1, b] = points[i];
    const y0 = spring + a,
      y1 = spring + b;
    quad4(out, 'wall', p(u0, y0, 0), p(u1, y1, 0), p(u1, top, 0), p(u0, top, 0), color.brick);
    if (lod)
      quad4(
        out,
        'wall',
        p(u1, y1, -depth),
        p(u0, y0, -depth),
        p(u0, top, -depth),
        p(u1, top, -depth),
        color.brick,
      );
    quad4(
      out,
      'coping',
      p(u1, y1, 0),
      p(u0, y0, 0),
      p(u0, y0, -depth),
      p(u1, y1, -depth),
      color.shade,
    );
    if (lod) {
      const scale = 1 + (lod === 1 ? 0.19 : 0.26) / half;
      quad4(
        out,
        'coping',
        p(u0, y0, 0.037),
        p(u1, y1, 0.037),
        p(u1 * scale, spring + b * scale, 0.037),
        p(u0 * scale, spring + a * scale, 0.037),
        color.light,
      );
    }
  }
}

function arcade(out, face, floor, span, count, top, lod) {
  const pitch = span / count;
  const start = (face.length - span) / 2;
  const depth = 0.71;
  for (let j = 0; j < count; j++) {
    const center = start + pitch * (j + 0.5);
    arch(
      out,
      face,
      center,
      pitch * 0.353,
      floor,
      top - floor - pitch * 0.353 - 0.65,
      top,
      depth,
      lod,
    );
  }
  for (let j = 0; j <= count; j++) {
    const x = start + pitch * j;
    const half = pitch * 0.147;
    fbox(out, 'coping', face, x - half, x + half, floor, top, -depth, 0.075, color.trim);
    if (lod >= 2) {
      moulding(out, face, x - half - 0.11, x + half + 0.11, floor, 0.29, 0.19);
      moulding(out, face, x - half - 0.12, x + half + 0.12, top - pitch * 0.353 - 0.68, 0.21, 0.18);
    }
  }
  moulding(out, face, start - 0.34, start + span + 0.34, top - 0.02, 0.23, 0.29);
}

function nave(out, lod) {
  const apsidal = site.historicalOutline.slice(5, 12);
  const hall = [[-6.85, 25.05], [6.85, 25.05], ...apsidal];
  extrude(out, 'wall', hall, platform, 12.88, color.brick, { top: false });
  gableRoof(out, 'roof', [0, -27.0], [0, 25.3], 14.06, 12.85, 17.9, color.tile, {
    overhang: 0.5,
    endSlot: 'wall',
    endColor: color.brick,
  });
  extrude(out, 'stone', site.historicalOutline, -2.1, platform, color.footing);
  for (const sign of [-1, 1]) {
    const edge = sign * 8.58;
    const pathFace =
      sign > 0 ? wallFace([edge, 22.15], [edge, -17.6]) : wallFace([edge, -17.6], [edge, 22.15]);
    const upper =
      sign > 0 ? wallFace([6.85, 23.8], [6.85, -22.0]) : wallFace([-6.85, -22.0], [-6.85, 23.8]);
    // The low outer galleries read as continuous roofs at landscape distance.
    const eave = 8.6,
      inner = sign * 6.74,
      outer = sign * 8.91;
    const a = [outer, eave, -18.0],
      b = [outer, eave, 23.0];
    const c = [inner, 10.35, 23.0],
      d = [inner, 10.35, -18.0];
    quad4(out, 'roof', ...(sign > 0 ? [d, c, b, a] : [a, b, c, d]), color.tile);
    if (lod) arcade(out, pathFace, platform, pathFace.length - 0.65, 8, eave - 0.22, lod);
    else
      fbox(
        out,
        'wall',
        pathFace,
        0,
        pathFace.length,
        platform,
        eave - 0.045,
        -0.33,
        0,
        color.brick,
      );
    for (let i = 0; i < 8; i++) {
      const x = ((i + 0.5) * upper.length) / 8;
      window(out, upper, x, 10.47, 0.93, 1.7, lod);
      if (lod === 3) moulding(out, upper, x - 0.78, x + 0.78, 10.28, 0.145, 0.15);
    }
  }
  for (let i = 1; i < apsidal.length - 1; i++) {
    const a = apsidal[i],
      b = apsidal[i + 1];
    const face = wallFace(a, b);
    if (lod) window(out, face, face.length / 2, 8.8, 0.87, 2.15, lod);
    const tip = [0, 16.42, -23];
    tri(out, 'roof', [a[0], 12.95, a[1]], [b[0], 12.95, b[1]], tip, color.tile);
  }
}

function entry(out, lod) {
  const wall = facade([0, 25.29], [1, 0]);
  const porch = wallFace([-5.985, 29.75], [5.985, 29.75]);
  abox(out, 'wall', [-5.97, platform, 24.98], [5.97, 14.11, 25.22], color.brick);
  tri(
    out,
    'wall',
    wall.P(-5.97, 14.11, -0.065),
    wall.P(5.97, 14.11, -0.065),
    wall.P(0, 18.32, -0.065),
    color.brick,
  );
  gableRoof(out, 'roof', [0, 23.6], [0, 25.35], 10.99, 14.26, 18.43, color.tile, {
    overhang: 0.22,
  });
  window(out, wall, 0, platform, 2.45, 4.82, lod, { door: true });
  oculus(out, wall, 0, 13.3, 1.28, lod);
  for (const x of [-3.99, 3.99]) window(out, wall, x, 9.8, 1.11, 2.57, lod);
  for (const x of [-5.24, -2.52, 2.52, 5.24]) {
    fbox(
      out,
      'coping',
      wall,
      x - 0.165,
      x + 0.165,
      7.55,
      18.5 - Math.abs(x) * 0.72,
      0.015,
      0.21,
      color.light,
    );
    if (lod >= 2) pinnacles(out, [x, 25.38], 18.5 - Math.abs(x) * 0.72, lod);
  }
  cross(out, 0, 18.48, 25.38, 0.96);
  arcade(out, porch, platform, 11.97, 3, 8.91, lod);
  abox(out, 'stone', [-6.5, 8.88, 25.08], [6.5, 9.13, 29.98], color.shade, { bottom: true });
  if (lod) {
    const center = wallFace([-2.77, 29.77], [2.77, 29.77]);
    const points = roundArch(1.81, [4, 6, 8, 12][lod]);
    for (let i = 1; i < points.length; i++) {
      const p = ([u, y], s) => center.P(2.77 + u * s, 6.88 + y * s, 0.056);
      quad4(
        out,
        'coping',
        p(points[i - 1], 0.9),
        p(points[i], 0.9),
        p(points[i], 1),
        p(points[i - 1], 1),
        color.light,
      );
    }
  }
  const steps = lod ? 13 : 5;
  for (let i = 0; i < steps; i++) {
    const start = 30.0 + (6.7 * i) / steps;
    const end = 30.0 + (6.7 * (i + 1)) / steps;
    abox(
      out,
      'stone',
      [-8.94, -0.83, start - 0.015],
      [8.94, platform * (1 - i / steps) - 0.045, end],
      i % 2 ? color.footing : color.shade,
      { bottom: false },
    );
  }
}

function build(sink, lod) {
  const out = {
    ...withFootprintCaps(sink),
    addQuad: sink.addQuad.bind(sink),
    addTriangle: sink.addTriangle.bind(sink),
    addConvexPolygon: sink.addConvexPolygon.bind(sink),
  };
  nave(out, lod);
  entry(out, lod);
  for (const x of [-8.08, 8.08]) turret(out, x, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'phu-cam-cathedral-model.mjs';
const camera = [-42, 27, 78];
const lookAt = [0, 11.55, 4];
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'heritage-cathedral',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  limitations: plan.limitations,
  brief:
    'The 1902 Phủ Cam cathedral in 1908, with paired domed bell towers, a round central window, a long tile-roofed nave and open outer galleries.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: site.validFrom,
    validUntil: site.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-39, 48, 76],
  mediumFiContext: {
    scale: 1.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: site.historicalOutline,
    minimumCoverage: 0.91,
    basis:
      'The historical 60 m envelope follows the published length, approximate old site and southbound nave axis.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'place-footprint-caps.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'historic-north-entrance', position: [0, 7.7, 59], lookAt: [0, 13, 29] },
    { name: 'paired-domed-bell-towers', position: [22, 23, 50], lookAt: [0, 22.5, 25.5] },
    { name: 'western-aisle-arcade', position: [31, 8, 20], lookAt: [5.5, 7.9, 8] },
    { name: 'nave-and-reconstructed-apse', position: [-33, 26, -52], lookAt: [0, 10.4, -13] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'phu-cam-cathedral-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.54,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.27, surfaces },
      street: { export: 'street', errorMeters: 0.092, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.03, surfaces },
    },
  },
};

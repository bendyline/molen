import fs from 'node:fs';
import {
  abox,
  fan,
  fbox,
  gableRoof,
  lathe,
  opening,
  outwardRing,
  pointedArch,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const outer = outwardRing(frame.geometry.outline);
const court = outwardRing(frame.geometry.holes[0]).reverse();
const stone = rgb('aaa18f');
const lightStone = rgb('c2b9a5');
const base = rgb('8b8478');
const slateClay = rgb('655a54');
const clayRidge = rgb('795f52');
const brick = rgb('9c6a54');
const capBrick = rgb('a6775f');
const well = rgb('413d36');
const window = rgb('535b55');
const wood = rgb('635140');

const surfaces = {
  wall: { slot: 'wall', graph: 'stone_granite', roughness: 0.95 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  stone: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89 },
  ridge: { slot: 'trim', graph: 'tile_ceramic', roughness: 0.9 },
  brick: { slot: 'trim', graph: 'brick', roughness: 0.94 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.68 },
  timber: { slot: 'trim', graph: 'wood_vertical', roughness: 0.92 },
};

function panel(out, slot, F, u0, u1, y0, y1, color, d = 0) {
  quad4(out, slot, F.P(u0, y0, d), F.P(u1, y0, d), F.P(u1, y1, d), F.P(u0, y1, d), color);
}

function glass(out, F, u, y, w, h, level, kind = 'flat', color = window) {
  if (level === 1) {
    panel(out, 'glass', F, u - w / 2, u + w / 2, y, y + h, color, 0.065);
    return;
  }
  opening(out, F, u, y, w, h, {
    head: kind,
    glassSlot: 'glass',
    frameSlot: 'stone',
    glass: color,
    frame: lightStone,
    d: 0.059,
    frameWidth: 0.15,
    frameDepth: 0.14,
    sill: kind === 'flat',
    mullions: kind === 'flat' && w > 1.0 ? 1 : 0,
    transoms: level === 3 && kind === 'flat' && h > 1.6 ? 1 : 0,
  });
}

function roofHip(out, outline, eave, ridge, level) {
  const r = outwardRing(outline);
  const center = [0, 1].map((axis) => r.reduce((total, p) => total + p[axis], 0) / r.length);
  const along =
    Math.hypot(r[1][0] - r[0][0], r[1][1] - r[0][1]) >
    Math.hypot(r[2][0] - r[1][0], r[2][1] - r[1][1]);
  const sides = along
    ? [
        [0, 3],
        [1, 2],
      ]
    : [
        [0, 1],
        [2, 3],
      ];
  const roofEnds = sides.map(([i, j]) =>
    [0, 1].map((axis) => (r[i][axis] + r[j][axis]) * 0.3 + center[axis] * 0.4),
  );
  const a = r.map(([x, z]) => [x, eave, z]);
  const top = r.map((_, i) => {
    const [x, z] = roofEnds[sides[0].includes(i) ? 0 : 1];
    return [x, ridge, z];
  });
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    if (top[i][0] === top[j][0] && top[i][2] === top[j][2]) {
      tri(out, 'roof', a[i], a[j], top[i], slateClay);
    } else quad4(out, 'roof', a[i], a[j], top[j], top[i], slateClay);
    if (level > 0) {
      const face = wallFace(r[i], r[j]);
      fbox(out, 'ridge', face, 0, face.length, eave - 0.19, eave - 0.04, -0.16, 0.09, clayRidge);
    }
  }
}

const rect = (l, r, b, f) => [
  [l, f],
  [r, f],
  [r, b],
  [l, b],
];
function battlements(out, ring, y, level) {
  for (let i = 0; i < ring.length; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
    fbox(out, 'stone', F, 0, F.length, y - 0.29, y + 0.16, -0.52, 0.08, base);
    const n = Math.max(1, Math.round(F.length / 3.45));
    const w = F.length / n;
    for (let j = 0; j < n; j++) {
      fbox(out, 'wall', F, (j + 0.22) * w, (j + 0.68) * w, y + 0.13, y + 0.81, -0.51, 0.06, stone);
      if (level > 1) {
        fbox(
          out,
          'stone',
          F,
          (j + 0.2) * w,
          (j + 0.7) * w,
          y + 0.78,
          y + 0.91,
          -0.56,
          0.11,
          lightStone,
        );
      }
    }
  }
}

function exterior(out, level) {
  for (let i = 0; i < outer.length; i++) {
    const F = wallFace(outer[i], outer[(i + 1) % outer.length]);
    panel(out, 'base', F, 0, F.length, -3.05, 0.58, base);
    panel(out, 'wall', F, 0, F.length, 0.57, 15.66, stone);
    if (level === 0) continue;
    fbox(out, 'stone', F, 0, F.length, 14.83, 15.19, -0.09, 0.19, lightStone);
    const n = Math.max(1, Math.round(F.length / (F.length > 35 ? 7.2 : 4.1)));
    const midpoint = F.P(F.length / 2, 0);
    const isChapel = midpoint[0] > 31.5 && Math.abs(midpoint[2]) < 6;
    const isEntry = midpoint[2] > 27 && F.length > 50;
    for (let j = 0; j < n; j++) {
      const u = (F.length * (j + 0.5)) / n;
      if (isChapel) continue;
      if (isEntry && j === Math.floor(n / 2)) {
        glass(out, F, F.length / 2, 0.66, 2.95, 4.6, level, 'pointed', wood);
        if (level > 1) glass(out, F, F.length / 2, 9.1, 1.55, 2.8, level, 'pointed');
        continue;
      }
      glass(out, F, u, 9.35, F.length > 6 ? 1.34 : 0.78, 2.48, level);
      if (F.length > 7.5) glass(out, F, u, 4.58, 0.91, 1.68, level);
      if (level > 1 && F.length > 8.0 && j % 2 === 1) glass(out, F, u, 1.41, 0.54, 1.08, level);
    }
    if (isChapel) {
      glass(out, F, F.length / 2, 7.88, 2.45, 6.18, level, 'pointed');
    }
  }
}

function tower(out, ring, y, level) {
  fan(
    out,
    'roof',
    ring.map(([x, z]) => [x, y - 0.04, z]),
    slateClay,
  );
  for (let j = 0; j < ring.length; j++) {
    const F = wallFace(ring[j], ring[(j + 1) % ring.length]);
    panel(out, 'wall', F, 0, F.length, 14.98, y, stone);
    if (level > 0) glass(out, F, F.length / 2, 15.47, 0.72, 1.4, level);
  }
  if (level > 0) battlements(out, ring, y, level);
}

function galleryArch(out, F, u, span, level) {
  const half = span * 0.408,
    wallHeight = 4.66,
    spring = 1.86;
  const profile = pointedArch(half, 2.05, [1, 2, 4, 6][level]);
  const x0 = u - span / 2,
    x1 = u + span / 2;
  panel(out, 'wall', F, x0, u - half, 0.04, wallHeight, stone);
  panel(out, 'wall', F, u + half, x1, 0.04, wallHeight, stone);
  for (let i = 1; i < profile.length; i++) {
    const [x, y] = profile[i - 1],
      [a, b] = profile[i];
    quad4(
      out,
      'wall',
      F.P(u + x, spring + y),
      F.P(u + a, spring + b),
      F.P(u + a, wallHeight),
      F.P(u + x, wallHeight),
      stone,
    );
    if (level === 0) continue;
    quad4(
      out,
      'stone',
      F.P(u + x, spring + y, 0.03),
      F.P(u + a, spring + b, 0.03),
      F.P(u + a * 1.08, spring + b + 0.21, 0.08),
      F.P(u + x * 1.08, spring + y + 0.21, 0.08),
      lightStone,
    );
    quad4(
      out,
      'stone',
      F.P(u + a, spring + b, -0.39),
      F.P(u + x, spring + y, -0.39),
      F.P(u + x, spring + y, 0.02),
      F.P(u + a, spring + b, 0.02),
      base,
    );
  }
  if (level > 0) {
    fbox(out, 'stone', F, u - half - 0.12, u - half, 0.06, spring + 0.15, -0.4, 0.07, lightStone);
    fbox(out, 'stone', F, u + half, u + half + 0.12, 0.06, spring + 0.15, -0.4, 0.07, lightStone);
  }
}

function courtyard(out, level) {
  const floor = 0.98;
  fan(
    out,
    'base',
    court
      .slice()
      .reverse()
      .map(([x, z]) => [x, floor, z]),
    base,
  );
  for (let i = 0; i < court.length; i++) {
    const raw = wallFace(court[i], court[(i + 1) % court.length]);
    const F = { ...raw, P: (u, y, d = 0) => raw.P(u, y + floor, d) };
    const w = F.length;
    const n = w > 22 ? 6 : 4;
    const topCount = level === 0 ? Math.ceil(n * 1.25) : n * 2;
    const wallDepth = -2.55;
    const P = (u, y, d = 0) => F.P(u, y, d + wallDepth);
    const backing = { ...F, P };
    panel(out, 'base', F, 0, w, -1.24, 0.07, base);
    panel(out, 'wall', backing, -2.56, w + 2.56, -0.95, 8.55, stone);
    panel(out, 'wall', F, 0, w, 4.64, 5.62, stone);
    panel(out, 'wall', backing, -2.56, w + 2.56, 8.53, 14.9, stone);
    quad4(
      out,
      'base',
      F.P(0, 0.05, 0.06),
      F.P(w, 0.05, 0.06),
      F.P(w + 2.56, 0.05, wallDepth),
      F.P(-2.56, 0.05, wallDepth),
      base,
    );
    quad4(
      out,
      'base',
      F.P(0, 5.58, -0.08),
      F.P(w, 5.58, -0.08),
      F.P(w + 2.56, 5.58, wallDepth),
      F.P(-2.56, 5.58, wallDepth),
      base,
    );
    for (let j = 0; j < n; j++) galleryArch(out, F, (w * (j + 0.5)) / n, w / n, level);
    for (let j = 0; j <= topCount; j++) {
      const u = Math.min(w - 0.1, Math.max(0.1, (w * j) / topCount));
      if (level < 2) {
        panel(out, 'stone', F, u - 0.16, u + 0.16, 5.57, 8.12, lightStone, -0.12);
      } else {
        const p = F.P(u, 0, -0.18);
        const layers = [
          [5.58, 0.2, 0.2],
          [5.7, 0.17, 0.17],
          [7.91, 0.14, 0.14],
          [8.12, 0.22, 0.22],
        ].map(([y, x, z]) => [y + floor, x, z]);
        lathe(out, 'stone', [p[0], p[2]], layers, level === 2 ? 6 : 8, lightStone);
      }
    }
    quad4(
      out,
      'roof',
      F.P(-0.04, 8.22, 0.13),
      F.P(w + 0.04, 8.22, 0.13),
      F.P(w + 2.62, 11.83, wallDepth - 0.08),
      F.P(-2.62, 11.83, wallDepth - 0.08),
      slateClay,
    );
    if (level > 0) {
      fbox(out, 'timber', F, 0, w, 8.03, 8.24, -0.24, 0.13, wood);
      fbox(out, 'stone', F, 0, w, 5.43, 5.63, -0.37, 0.13, lightStone);
      fbox(out, 'stone', backing, -2.54, w + 2.54, 12.05, 12.34, -0.06, 0.34, lightStone);
      for (let j = 1; j < n; j++) {
        glass(out, backing, (w * j) / n, 6.05, 1.16, 1.95, level, 'flat', well);
      }
    }
  }
}

const wings = [
  {
    key: 'south',
    ring: [outerPoint(-28.36, 28.6), outerPoint(32.18, 30.45), [24.8, 11.76], [-23.56, 11.75]],
    eave: 15.22,
    ridge: 23.27,
  },
  {
    key: 'north',
    ring: [
      [-23.65, -14.56],
      [24.55, -14.56],
      outerPoint(33.21, -30.91),
      outerPoint(-29.36, -32.82),
    ],
    eave: 15.33,
    ridge: 24.25,
  },
  {
    key: 'west',
    ring: [
      [-23.08, 14.2],
      [-9.68, 11.82],
      [-9.67, -14.53],
      [-22.45, -20.56],
    ],
    eave: 15.54,
    ridge: 22.55,
  },
  {
    key: 'east',
    ring: [
      [9.97, 11.82],
      [23.7, 16.07],
      [24.58, -20.45],
      [9.98, -14.52],
    ],
    eave: 15.65,
    ridge: 24.27,
  },
];

function outerPoint(x, z) {
  return outer.reduce((best, p) =>
    Math.hypot(p[0] - x, p[1] - z) < Math.hypot(best[0] - x, best[1] - z) ? p : best,
  );
}

const chimneys = [
  { count: 9, from: [-21, 22.7], to: [22, 23.7], alternation: [-2.1, 2.2] },
  { count: 11, from: [-24, -24.2], to: [26, -23.0], alternation: [-2.4, 2.1] },
  { count: 9, from: [-17.0, -18.4], to: [-17.6, 17.2], alternation: [-3.0, 2.1] },
  { count: 10, from: [18.0, -18.6], to: [18.1, 17.9], alternation: [-3.6, 2.6] },
];

function chimneyStack(out, level) {
  for (const run of chimneys) {
    const [x0, z0] = run.from,
      [x1, z1] = run.to;
    const horizontal = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (let i = 0; i < run.count; i++) {
      const t = i / (run.count - 1),
        jitter = run.alternation[i % 2];
      const center = [
        x0 + (x1 - x0) * t + (horizontal ? 0 : jitter),
        z0 + (z1 - z0) * t + (horizontal ? jitter : 0),
      ];
      const start = 14.68,
        end = 24.68 + (i % 4) * 1.14 + (horizontal ? 0.77 : 0);
      const r = 0.45 + (i % 3) * 0.025;
      const layers =
        level < 2
          ? [
              [start, r, r],
              [end, r * 0.85, r * 0.85],
            ]
          : [
              [start, r, r],
              [end - 0.35, r * 0.87, r * 0.87],
              [end - 0.23, r * 1.04, r * 1.04],
              [end, r * 0.95, r * 0.95],
            ];
      lathe(out, 'brick', center, layers, [4, 6, 8, 10][level], brick);
      if (level === 3) {
        lathe(
          out,
          'brick',
          center,
          [
            [end + 0.003, r * 0.54, r * 0.54],
            [end + 0.052, r * 0.55, r * 0.55],
          ],
          8,
          capBrick,
          { capTop: false },
        );
      }
    }
  }
}

function build(out, level) {
  exterior(out, level);
  courtyard(out, level);
  for (const wing of wings) {
    roofHip(out, wing.ring, wing.eave, wing.ridge, level);
    const j = { south: 2, north: 0, west: 1, east: 3 }[wing.key];
    const face = wallFace(wing.ring[j], wing.ring[(j + 1) % 4]);
    const sideParapet = wing.key === 'west' || wing.key === 'east';
    panel(
      out,
      'wall',
      face,
      0,
      face.length,
      12.15,
      wing.eave + (sideParapet ? 0.44 : 0.035),
      stone,
    );
    if (level > 0 && sideParapet) {
      const bays = Math.round(face.length / 2.65);
      const width = face.length / bays;
      for (let i = 0; i < bays; i++) {
        fbox(
          out,
          'stone',
          face,
          (i + 0.22) * width,
          (i + 0.7) * width,
          wing.eave + 0.41,
          wing.eave + 0.97,
          -0.35,
          0.025,
          stone,
        );
      }
    }
  }
  gableRoof(out, 'roof', [23.33, -3.3], [32.34, -3.3], 13.53, 15.16, 21.77, slateClay, {
    overhang: 0.11,
    endSlot: 'wall',
    endColor: stone,
  });
  for (const [l, r, b, f, y] of [
    [-28.28, -17.7, 14.18, 28.58, 18.2],
    [23.49, 32.35, 16.45, 30.25, 18.67],
    [-29.48, -18.94, -32.44, -20.25, 18.39],
    [24.48, 33.06, -30.84, -19.43, 18.7],
  ])
    tower(out, rect(l, r, b, f), y, level);
  chimneyStack(out, level);
  if (level > 1) {
    for (let i = 0; i < 6; i++) {
      abox(
        out,
        'base',
        [-2.12, -1.62, 31.4 - i * 0.29],
        [4.1, -0.82 + i * 0.24, 31.69 - i * 0.29],
        base,
        { bottom: false },
      );
    }
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'palace-of-the-dukes-of-braganza-model.mjs';
const camera = [90, 64, 107],
  lookAt = [0, 10, 0];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: 'Palace of the Dukes of Braganza',
  wikidataId: plan.wikidataId,
  category: 'palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The rebuilt granite ducal palace at Guimarães, with four wings, a two-storey courtyard cloister, steep roofs and 39 red brick chimney shafts.',
  camera,
  lookAt,
  sunDirection: [-31, 63, 44],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'Named palace and courtyard multipolygon from OpenStreetMap.',
  },
  embeddedCanonicalGraphs: [
    'stone_granite',
    'stone_ashlar',
    'tile_ceramic',
    'brick',
    'wood_vertical',
  ],
  recipeDependencies: ['place-recipe-kit.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-entrance-and-roofline', position: [29, 13, 71], lookAt: [2, 13, 7] },
    { name: 'two-storey-courtyard', position: [-4, 8.5, -10], lookAt: [1, 10.8, 11] },
    { name: 'chapel-and-chimneys', position: [84, 52, -37], lookAt: [9, 14, -3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'palace-of-the-dukes-of-braganza-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.72,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.045, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model under repository license. Building footprint © OpenStreetMap contributors. Mapzen open elevation.',
};

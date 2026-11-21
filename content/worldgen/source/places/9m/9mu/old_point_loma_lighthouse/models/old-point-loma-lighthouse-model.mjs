import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  shell,
  surface,
  trimBlock,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const { dimensions: d } = plan;
const grade = floorSampler(read('terrain-grid.json'));
const c = palette({
  white: 'ece4cd',
  lime: 'e6ddc8',
  edge: 'ebd9b6',
  beam: 'e1d8c3',
  stone: 'bcb39c',
  black: '313338',
  roof: '6c6351',
  oldWood: 'e6dec8',
  green: '3f514b',
  sash: '34413c',
  blueGlass: '6a7c7b',
  pane: '748787',
  copper: '619580',
  lightCopper: '83ae93',
  glass: '6c9294',
  lens: 'cfbb83',
  pole: 'c5bda6',
});
const surfaces = {
  masonry: surface('wall', 'stone_sandstone_raw', 0.95),
  wood: surface('wall', 'wood_painted_lap', 0.86),
  foundation: surface('foundation', 'stone_ashlar', 0.93),
  shingle: surface('roof', 'shingle_cedar', 0.88),
  copper: surface('roof', 'metal_copper', 0.63, 0.32),
  trim: { slot: 'trim', localRef: 'palette:#fffffe', roughness: 0.68, metallic: 0.13 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.35, metallic: 0.06 },
  lantern: {
    slot: 'window',
    localRef: 'palette:#f9fffe',
    roughness: 0.2,
    metallic: 0.02,
    baseColorFactor: [1, 1, 1, 0.44],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
};
const ground = (p) => Math.min(grade(p) - 0.29, -0.15);
const [rearRight, frontRight, frontLeft, rearLeft] = d.mainOutline;
const front = edge(frontRight, frontLeft);
const rear = edge(rearLeft, rearRight);
const gableSouth = edge(frontLeft, rearLeft);
const gableNorth = edge(rearRight, frontRight);
const outlineEdges = (p) => pairs(closed(p)).map(([a, b]) => edge(a, b, areaSign(p)));

function sash(out, w, u, y, width, height, level, depth = 0.04) {
  const h = width * 0.5;
  panel(
    out,
    'trim',
    w,
    u - h - 0.063,
    u + h + 0.063,
    y - 0.055,
    y + height + 0.058,
    depth,
    c.green,
  );
  panel(
    out,
    'glass',
    w,
    u - h + 0.012,
    u + h - 0.012,
    y + 0.01,
    y + height - 0.01,
    depth + 0.018,
    c.blueGlass,
  );
  if (level === 0) return;
  const bar = level === 3 ? 0.027 : 0.041;
  for (const v of [y, y + height * 0.51, y + height])
    panel(out, 'trim', w, u - h, u + h, v - bar, v + bar, depth + 0.036, c.sash);
  for (const x of [u - h, u, u + h])
    panel(out, 'trim', w, x - bar, x + bar, y, y + height, depth + 0.036, c.sash);
  if (level >= 2) {
    for (const t of [0.167, 0.33, 0.673, 0.843]) {
      const v = y + height * t;
      panel(out, 'trim', w, u - h, u + h, v - 0.016, v + 0.016, depth + 0.044, c.green);
    }
    trimBlock(
      out,
      'trim',
      w,
      u - h - 0.11,
      u + h + 0.11,
      y - 0.08,
      y + 0.018,
      0.017,
      depth + 0.115,
      c.edge,
    );
  }
}
function gable(out, a, b, c1, d1, eaves, ridge, level, wallColor, slot) {
  const frontA = at(a, eaves),
    frontB = at(b, eaves),
    rearA = at(c1, eaves),
    rearB = at(d1, eaves);
  const ridgeA = frontA.map((p, i) => (i === 1 ? ridge : (p + rearA[i]) * 0.5));
  const ridgeB = frontB.map((p, i) => (i === 1 ? ridge : (p + rearB[i]) * 0.5));
  face(out, 'shingle', [frontA, frontB, ridgeB, ridgeA], up, c.roof);
  face(out, 'shingle', [rearA, ridgeA, ridgeB, rearB], up, c.roof);
  face(out, slot, [frontA, ridgeA, rearA], [1, 0, 0], wallColor);
  face(out, slot, [frontB, rearB, ridgeB], [-1, 0, 0], wallColor);
  for (const [p, q] of [
    [frontA, frontB],
    [rearA, rearB],
    [frontA, ridgeA],
    [rearA, ridgeA],
    [frontB, ridgeB],
    [rearB, ridgeB],
  ]) {
    beam(out, 'trim', p, q, 0.09, 0.105, c.beam);
  }
  if (level >= 1) beam(out, 'shingle', ridgeA, ridgeB, 0.095, 0.16, c.roof);
}

function lighthouseHome(out, level) {
  shell(out, d.mainOutline, ground, d.eaves, {
    wall: 'masonry',
    roof: 'masonry',
    color: c.lime,
    roofColor: c.white,
  });
  for (const w of outlineEdges(d.mainOutline)) {
    trimBlock(out, 'foundation', w, 0.015, w.length - 0.015, -0.26, 0.19, 0.006, 0.026, c.black);
  }
  gable(
    out,
    [6.1, 3.53],
    [-6.1, 3.53],
    [6.11, -3.54],
    [-6.1, -3.62],
    d.eaves,
    d.ridge,
    level,
    c.white,
    'masonry',
  );
  for (const x of [-5.05, 5.09]) {
    block(out, 'masonry', x - 0.31, d.ridge - 0.8, -0.35, 0.62, 1.55, 0.69, c.white);
    block(out, 'trim', x - 0.37, d.ridge + 0.72, -0.418, 0.74, 0.118, 0.827, c.beam);
  }
  for (const w of [front, rear]) {
    for (const t of [0.19, 0.81]) {
      sash(out, w, w.length * t, 2.63, 0.87, 1.56, level);
    }
    if (level >= 1) {
      for (const t of [0.18, 0.82]) sash(out, w, w.length * t, 0.15, 0.63, 0.81, level);
    }
  }
  for (const w of [gableSouth, gableNorth]) {
    sash(out, w, w.length * 0.51, 3.97, 0.91, 1.55, level);
  }
  const mid = front.length / 2;
  panel(
    out,
    'trim',
    front,
    mid - 0.63,
    mid + 0.63,
    d.entryFloor - 0.04,
    d.entryFloor + 2.18,
    0.045,
    c.edge,
  );
  panel(
    out,
    'trim',
    front,
    mid - 0.5,
    mid + 0.5,
    d.entryFloor + 0.02,
    d.entryFloor + 2.05,
    0.063,
    c.green,
  );
  if (level >= 1) {
    for (const u of [mid - 0.239, mid + 0.237])
      for (const y of [d.entryFloor + 0.27, d.entryFloor + 1.22]) {
        panel(out, 'trim', front, u - 0.143, u + 0.143, y, y + 0.59, 0.082, c.sash);
      }
  }
  const [a, b, c1, d1] = d.leanToOutline;
  const roofH = (p) => mix(3.08, 4.18, (p[1] + 6.4) / 3.14);
  for (const [[p, q], index] of pairs(closed([a, b, c1, d1])).map((pair, i) => [pair, i])) {
    const w = outlineEdges([a, b, c1, d1])[index];
    face(
      out,
      'wood',
      [at(p, ground(p)), at(q, ground(q)), at(q, roofH(q)), at(p, roofH(p))],
      w.normal,
      c.lime,
    );
    if (index !== 0) {
      beam(out, 'trim', at(p, roofH(p)), at(q, roofH(q)), 0.085, 0.09, c.beam);
    }
  }
  face(
    out,
    'shingle',
    [a, b, c1, d1].map((p) => at(p, roofH(p))),
    up,
    c.roof,
  );
  const kitchen = edge(c1, d1);
  sash(out, kitchen, kitchen.length * 0.55, 1.54, 0.9, 1.24, level);
}
function staircase(out, level) {
  const u = front.length * 0.5;
  const count = [5, 7, 9, 9][level];
  const z0 = front.p(u, 0)[2];
  const step = d.stairRun / count;
  const width = 1.51;
  const groundY = Math.min(-0.08, grade([0, z0 + d.stairRun]) - 0.1);
  for (let i = 0; i < count; i++) {
    const offset = d.stairRun - (i + 1) * step;
    const y = mix(groundY, d.entryFloor, (i + 1) / count);
    block(
      out,
      'foundation',
      -width / 2,
      groundY,
      z0 + offset,
      width,
      y - groundY,
      step + 0.015,
      c.stone,
    );
  }
  for (const sign of [-1, 1]) {
    const x = sign * (width * 0.5 + 0.035);
    const a = [x, groundY + 0.93, z0 + d.stairRun - 0.12];
    const b = [x, d.entryFloor + 0.91, z0 + 0.16];
    beam(out, 'trim', a, b, 0.057, 0.065, c.green);
    if (level > 0)
      for (const i of [0, 0.34, 0.67, 1]) {
        const top = a.map((v, j) => mix(v, b[j], i));
        const bot = [top[0], top[1] - 0.91, top[2]];
        beam(out, 'trim', bot, top, 0.048, 0.052, c.green);
      }
  }
}

function lanternTower(out, level) {
  const p = d.towerCenter;
  const n = [8, 20, 28, 40][level];
  const round = (y, r, sides = n) => radialRing(y, r, r, sides, p, Math.PI / sides);
  const base = d.galleryHeight;
  loft(
    out,
    'masonry',
    [
      round(d.eaves + 0.22, d.towerRadius),
      round(base - 1.15, d.towerRadius),
      round(base - 0.62, 1.61),
      round(base - 0.37, 1.75),
      round(base - 0.17, 1.83),
    ],
    c.white,
  );
  loft(
    out,
    'trim',
    [
      round(base - 0.24, 1.84),
      round(base - 0.16, d.galleryRadius),
      round(base + 0.03, d.galleryRadius),
    ],
    c.black,
  );
  loft(
    out,
    'trim',
    [round(base + 0.02, d.lanternRadius), round(base + 0.93, d.lanternRadius)],
    c.black,
  );
  const panes = 10;
  const y0 = base + 0.92,
    y1 = d.lanternTop;
  const glass0 = round(y0, d.lanternRadius, panes),
    glass1 = round(y1, d.lanternRadius, panes);
  for (let j = 0; j < panes; j++) {
    const a = glass0[j],
      b = glass0[(j + 1) % panes],
      A = glass1[j],
      B = glass1[(j + 1) % panes];
    const normal = [(a[0] + b[0]) / 2 - p[0], 0, (a[2] + b[2]) / 2 - p[1]];
    face(
      out,
      level === 0 ? 'glass' : 'lantern',
      [a, b, B, A],
      normal,
      level === 0 ? c.glass : c.pane,
    );
    if (level >= 1) {
      beam(out, 'trim', a, A, 0.056, 0.047, c.green);
      const y = mix(y0, y1, 0.49);
      beam(out, 'trim', [a[0], y, a[2]], [b[0], y, b[2]], 0.048, 0.046, c.green);
    }
  }
  const roof = [
    [y1 - 0.025, 1.38],
    [y1 + 0.17, 1.43],
    [y1 + 0.38, 1.29],
    [y1 + 0.71, 1.03],
    [y1 + 0.95, 0.65],
    [d.cupolaTop, 0.31],
    [d.cupolaTop + 0.06, 0.18],
  ];
  loft(
    out,
    'copper',
    roof.map(([y, r]) => round(y, r, level === 0 ? 10 : n)),
    c.copper,
  );
  sphere(
    out,
    'copper',
    [p[0], d.cupolaTop + 0.26, p[1]],
    [0.175, 0.205, 0.175],
    c.lightCopper,
    [8, 10, 12, 16][level],
    5,
  );
  beam(
    out,
    'trim',
    [p[0], d.finialTop - 0.24, p[1]],
    [p[0], d.finialTop, p[1]],
    0.035,
    0.037,
    c.green,
  );
  const posts = [8, 24, 36, 52][level],
    rail = round(base + 0.96, d.galleryRadius - 0.06, posts);
  for (const [a, b] of pairs(closed(rail))) beam(out, 'trim', a, b, 0.043, 0.049, c.black);
  if (level >= 1) {
    for (const a of rail) beam(out, 'trim', [a[0], base + 0.02, a[2]], a, 0.032, 0.034, c.black);
    const lensRadius = 0.42;
    loft(
      out,
      'glass',
      [
        round(11.4, lensRadius, 10),
        round(11.54, 0.57, 10),
        round(d.lanternFocalHeight, 0.6, 10),
        round(12.3, 0.44, 10),
      ],
      c.lens,
    );
  }
  if (level >= 2) {
    for (let j = 0; j < 10; j++) {
      for (const [[y, r], [yy, rr]] of pairs(roof.slice(1))) {
        const angle = (2 * Math.PI * (j + 0.5)) / 10;
        const pt = (h, r) => [
          p[0] + Math.cos(angle) * (r + 0.019),
          h,
          p[1] + Math.sin(angle) * (r + 0.019),
        ];
        beam(out, 'copper', pt(y, r), pt(yy, rr), 0.021, 0.026, c.lightCopper);
      }
    }
  }
}

function assistantHouse(out, level) {
  const poly = d.cottageOutline;
  const y = 0.02,
    eaves = 3.23,
    ridge = 4.83;
  shell(out, poly, ground, y, {
    wall: 'foundation',
    roof: 'foundation',
    color: c.stone,
    roofColor: c.stone,
  });
  shell(out, poly, () => y, eaves, {
    wall: 'wood',
    roof: 'wood',
    color: c.oldWood,
    roofColor: c.oldWood,
  });
  gable(
    out,
    [-9.25, 12.18],
    [-21.1, 12.26],
    [-9.25, 2.43],
    [-21.1, 2.53],
    eaves,
    ridge,
    level,
    c.oldWood,
    'wood',
  );
  const main = edge(poly[3], poly[1], -1);
  const u = main.length * 0.48;
  panel(out, 'trim', main, u - 0.51, u + 0.51, y, 2.25, 0.052, c.green);
  panel(out, 'glass', main, u - 0.35, u + 0.35, 1.03, 2.03, 0.081, c.blueGlass);
  for (const t of [0.21, 0.78]) sash(out, main, main.length * t, 0.94, 0.79, 1.21, level);
  const broad = edge(poly[1], poly[0], -1);
  for (const f of [0.19, 0.49, 0.77]) sash(out, broad, broad.length * f, 1.02, 0.76, 1.13, level);
  const back = edge(poly[4], poly[3], -1);
  for (const f of [0.22, 0.54, 0.78]) sash(out, back, back.length * f, 0.93, 0.82, 1.24, level);
  if (level >= 2) {
    beam(out, 'trim', [-15.55, 4.52, 7.31], [-15.55, 5.31, 7.31], 0.18, 0.17, c.black);
  }
}
function build(out, level) {
  lighthouseHome(out, level);
  staircase(out, level);
  lanternTower(out, level);
  assistantHouse(out, level);
  const [x, z] = d.pole;
  const y = grade(d.pole);
  beam(out, 'trim', [x, y - 0.19, z], [x, y + 10.91, z], 0.076, 0.074, c.pole);
  if (level >= 2) sphere(out, 'trim', [x, y + 10.94, z], [0.079, 0.083, 0.08], c.black, 8, 5);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'old-point-loma-lighthouse-model.mjs';
const camera = [26.8, 19.2, 40],
  lookAt = [-5.8, 4.85, 2.2];
const errors = { district: 0.27, street: 0.11, closeup: 0.042 };
export const pointLomaAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'lighthouse',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original USGS coastal relief at the base of the lighthouse approach steps.',
  brief:
    'The whitewashed Old Point Loma Lighthouse with dark gabled roofs, circular gallery and oxidized copper lantern, and its assistant keeper’s cottage.',
  camera,
  lookAt,
  sunDirection: [40, 75, 66],
  mediumFiContext: {
    scale: 1,
    groundY: -0.2,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    outlines: [d.outline, d.cottageOutline],
    minimumCoverage: 0.92,
    basis: 'Separate mapped lighthouse and assistant keeper footprints.',
  },
  embeddedCanonicalGraphs: [
    'stone_sandstone_raw',
    'stone_ashlar',
    'wood_painted_lap',
    'shingle_cedar',
    'metal_copper',
  ],
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    {
      name: 'cape-cod-residence-and-copper-lantern',
      position: [-14, 8, -22],
      lookAt: [-2, 6.3, -1.5],
    },
    { name: 'bay-side-stairs-and-cottage', position: [-14, 9, 24], lookAt: [-7, 4.8, 4.2] },
    { name: 'fresnel-lantern-and-gallery', position: [10, 13, 12.8], lookAt: [0, 11.4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'old-point-loma-lighthouse-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.71,
    surfaces,
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. USGS elevation and National Park Service survey data are public domain.',
};

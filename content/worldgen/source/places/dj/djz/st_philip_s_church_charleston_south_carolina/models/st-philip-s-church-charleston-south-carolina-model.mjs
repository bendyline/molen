import fs from 'node:fs';
import {
  abox,
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const parts = JSON.parse(
  fs.readFileSync(new URL('../native-map/st-philip-church-building-parts.json', import.meta.url)),
).features;
const { foundation, floor, nave, steeple } = plan.dimensions;
const octagon = outwardRing(parts.find((p) => p.way.id === '1434394841').localRing);
const apseOutline = outwardRing(parts.find((p) => p.way.id === '1434394845').localRing);
const center = octagon.reduce(
  ([x, z], [p, q]) => [x + p / octagon.length, z + q / octagon.length],
  [0, 0],
);
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.95 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.61 },
  stone: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.81 },
};
const ochre = rgb('c5ae8b');
const pale = rgb('dac2a0');
const shade = rgb('b09b81');
const stone = rgb('a3917a');
const roof = rgb('766866');
const dark = rgb('514e45');
const dial = rgb('555c52');
const lettering = rgb('e7d1ad');
const gold = rgb('b89552');
const west = (x, z) => facade([x, z], [0, 1]);
const south = (x, z) => facade([x, z], [1, 0]);
const north = (x, z) => facade([x, z], [-1, 0]);

function block(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}
function moulding(out, F, len, y, h, d = 0.24) {
  fbox(out, 'trim', F, -len / 2, len / 2, y - h, y, -0.02, d, pale);
}
function window(out, F, u, y, w, h, lod, { louvres = false, color = dark, head = 'round' } = {}) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass: color,
    frame: pale,
    head,
    d: 0.059,
    frameWidth: lod === 3 || (lod === 2 && head === 'flat') ? 0.123 : 0,
    sill: lod > 1,
    frameDepth: 0.18,
    mullions: lod > 1 && !louvres ? 1 : 0,
    transoms: lod > 2 && !louvres ? 2 : 0,
  });
  if (louvres && lod > 1)
    for (let i = 0; i < 5; i++) {
      const bot = y + 0.29 + i * h * 0.107;
      fbox(out, 'trim', F, u - w * 0.47, u + w * 0.47, bot, bot + 0.105, 0.057, 0.108, shade);
    }
}

function column(out, x, z, y0, y1, r, lod) {
  const n = lod === 0 ? 6 : lod === 1 ? 8 : 14;
  const ring = (y, s) => radialRing(y, r * s, r * s, n, [x, z]);
  if (lod === 0) {
    loft(out, 'trim', [ring(y0, 1.03), ring(y1, 0.9)], pale, { cap: false });
    return;
  }
  loft(
    out,
    'trim',
    [ring(y0, 1.18), ring(y0 + 0.25, 1.05), ring(y1 - 0.44, 0.86), ring(y1 - 0.13, 0.97)],
    pale,
  );
  const cap = r * 1.18;
  block(out, 'trim', x - cap, x + cap, z - cap, z + cap, y1 - 0.17, y1 + 0.02, pale);
  if (lod > 1) block(out, 'stone', x - cap, x + cap, z - cap, z + cap, y0 - 0.07, y0 + 0.2, stone);
}
function portico(out, F, width, depth, lod) {
  const y = 10.5,
    wall = 11.17,
    peak = 13.25,
    w = width / 2;
  for (const u of [-w * 0.82, -w * 0.28, w * 0.28, w * 0.82]) {
    const p = F.P(u, 0, -0.37);
    column(out, p[0], p[2], floor, y - 0.36, 0.54, lod);
  }
  for (let i = 0; i < 3; i++)
    fbox(out, 'stone', F, -w - 0.3, w + 0.3, -0.29, 0.2 + i * 0.3, -depth, 0.52 - i * 0.175, stone);
  fbox(out, 'trim', F, -w - 0.14, w + 0.14, y - 0.38, y + 0.32, -depth, 0.14, pale);
  moulding(out, F, width + 0.56, wall, 0.31, 0.28);
  const mid = F.P(0, peak, 0.11),
    a = F.P(-w, wall, 0.12),
    b = F.P(w, wall, 0.12);
  tri(out, 'wall', a, b, mid, ochre);
  quad4(out, 'roof', a, mid, F.P(0, peak, -depth), F.P(-w, wall, -depth), roof);
  quad4(out, 'roof', mid, b, F.P(w, wall, -depth), F.P(0, peak, -depth), roof);
  if (lod > 0) {
    beam(out, 'trim', a, mid, 0.19, 0.17, pale);
    beam(out, 'trim', mid, b, 0.19, 0.17, pale);
  }
}

function churchBody(out, lod) {
  extrude(out, 'stone', frame.geometry.outline, foundation, floor + 0.025, stone, { top: false });
  block(out, 'wall', -30.58, 10.36, -9.85, 10.94, floor, nave - 4, ochre);
  gableRoof(out, 'roof', [-30.51, 0.53], [10.42, 0.53], 20.8, nave - 4, nave, roof, {
    overhang: 0.34,
    endSlot: 'wall',
    endColor: ochre,
  });
  for (const F of [north(-4.35, -9.85), south(-4.35, 10.94)]) {
    moulding(out, F, 36.1, 11.93, 0.29, 0.26);
    for (const u of [-10.45, -5.87, -1.28, 3.3, 7.88, 12.46]) {
      window(out, F, u, 2.69, 1.93, 6.6, lod, { head: lod === 0 ? 'flat' : 'round' });
      if (lod > 0 && u < 11.0)
        fbox(out, 'trim', F, u + 1.95, u + 2.22, 1.92, 11.71, 0.02, 0.23, pale);
    }
  }
  portico(out, west(-34.79, 0.49), 12.1, 4.31, lod);
  portico(out, south(-24.87, 13.93), 10.58, 3.1, lod);
  portico(out, north(-24.92, -12.97), 10.54, 3.26, lod);
  if (lod > 0) window(out, west(-30.59, 0.49), 0, floor + 0.12, 2.9, 5.96, lod);
  const roofPoint = ([x, z]) => [x, 14.06 - (x - 10.25) * 0.46, z];
  const apseRoof = apseOutline.map(roofPoint);
  for (let i = 0; i < apseRoof.length; i++) {
    const a = apseRoof[i],
      b = apseRoof[(i + 1) % apseRoof.length];
    quad4(out, 'wall', [a[0], floor, a[2]], [b[0], floor, b[2]], b, a, ochre);
    if (i > 0 && i < apseRoof.length - 1) tri(out, 'roof', apseRoof[0], a, b, roof);
  }
  if (lod > 1) {
    for (const n of [2, 8, 15]) {
      const a = apseOutline[n],
        b = apseOutline[(n + 3) % apseOutline.length],
        F = wallFace(a, b);
      const u = F.length / 2;
      window(out, F, u, 3.36, 0.91, 5.81, lod);
    }
  }
}

function timepiece(out, F, u, y, r, lod) {
  const count = lod === 0 ? 8 : lod === 1 ? 12 : 20;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count,
      b = ((i + 1) * 2 * Math.PI) / count;
    const p = (t, d) => F.P(u + d * Math.cos(t), y + d * Math.sin(t), 0.105);
    tri(out, 'glass', F.P(u, y, 0.105), p(a, r), p(b, r), dial);
    if (lod > 0) quad4(out, 'trim', p(a, r), p(a, r + 0.12), p(b, r + 0.12), p(b, r), pale);
    if (lod > 1 && i % 4 === 0)
      beam(out, 'iron', p(a, r * 0.81), p(a, r * 0.94), 0.032, 0.031, lettering);
  }
  if (lod > 1) {
    beam(
      out,
      'iron',
      F.P(u, y, 0.128),
      F.P(u - r * 0.29, y + r * 0.37, 0.128),
      0.063,
      0.058,
      lettering,
    );
    beam(
      out,
      'iron',
      F.P(u, y, 0.128),
      F.P(u + r * 0.58, y + r * 0.42, 0.128),
      0.057,
      0.051,
      lettering,
    );
  }
}

function steepleGeometry(out, lod) {
  const [x, z] = center;
  const r = 4.75;
  block(out, 'wall', x - r, x + r, z - r, z + r, 10.92, 22.0, ochre);
  const faces = [west(x - r, z), south(x, z + r), facade([x + r, z], [0, -1]), north(x, z - r)];
  for (const F of faces) {
    moulding(out, F, r * 2 + 0.28, 22.15, 0.42, 0.31);
    if (lod > 0) moulding(out, F, r * 2 + 0.12, 16.04, 0.24, 0.15);
    timepiece(out, F, 0, 18.63, 1.14, lod);
  }
  const stageRing = (y, s) => octagon.map(([a, b]) => [x + (a - x) * s, y, z + (b - z) * s]);
  const profile = [
    { bottom: 22.0, top: 24.52, base: 1, cap: 0.84 },
    { bottom: 24.52, top: 33.34, base: 0.84, cap: 0.83, openings: [26.38, 4.42] },
    { bottom: 33.34, top: 39.0, base: 0.77, cap: 0.65, clock: 35.97 },
    { bottom: 39.0, top: 44.92, base: 0.59, cap: 0.55, openings: [39.97, 3.4] },
  ];
  for (const level of profile) {
    const { bottom, top, base, cap, openings, clock } = level;
    loft(out, 'wall', [stageRing(bottom, base), stageRing(top, cap)], ochre, { cap: false });
    loft(
      out,
      'trim',
      [
        stageRing(top - 0.4, cap),
        stageRing(top - 0.17, cap + 0.052),
        stageRing(top + 0.06, cap + 0.052),
      ],
      pale,
      { cap: false },
    );
    if (!openings && !clock) continue;
    const rng = stageRing(bottom, base).map(([x, , z]) => [x, z]);
    for (let i = 0; i < rng.length; i++) {
      if (lod === 0 && i % 2 !== 0) continue;
      const F = wallFace(rng[i], rng[(i + 1) % rng.length]);
      const mid = F.length / 2;
      if (openings)
        window(out, F, mid, openings[0], top > 40 ? 1.19 : 1.45, openings[1], lod, {
          louvres: true,
        });
      else if (lod > 0 && i % 2 === 0) timepiece(out, F, mid, clock, 0.61, lod);
      if (lod > 1 && openings)
        fbox(out, 'trim', F, 0.03, 0.23, bottom + 0.8, top - 0.62, 0.02, 0.17, pale);
    }
  }
  loft(
    out,
    'roof',
    [
      stageRing(44.86, 0.55),
      stageRing(46.32, 0.42),
      stageRing(47.0, 0.29),
      stageRing(50.74, 0.19),
      stageRing(steeple - 0.88, 0.045),
    ],
    roof,
    { cap: false },
  );
  loft(
    out,
    'iron',
    [stageRing(steeple - 0.97, 0.049), stageRing(steeple - 0.48, 0.064), stageRing(steeple, 0.016)],
    gold,
    { cap: false },
  );
  if (lod > 1)
    beam(
      out,
      'iron',
      [x - 0.24, steeple - 0.52, z],
      [x + 0.24, steeple - 0.52, z],
      0.092,
      0.091,
      gold,
    );
}

function build(out, lod) {
  churchBody(out, lod);
  steepleGeometry(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'st-philip-s-church-charleston-south-carolina-model.mjs';
const camera = [-104, 45, 64];
const lookAt = [-10, 23, 0];
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
    'St. Philip’s Church in Charleston with three classical porticoes, the curved sanctuary and the tapering Church Street steeple.',
  camera,
  lookAt,
  sunDirection: [-31, 48, 27],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The mapped church building and projecting porticoes.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'church-street-porticoes-and-steeple', position: camera, lookAt },
    { name: 'west-portico-and-clock', position: [-74, 14.3, 19], lookAt: [-27, 20, 0] },
    { name: 'east-apse-and-nave', position: [68, 28, -50], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'st-philips-charleston-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

import fs from 'node:fs';
import {
  extrude,
  facade,
  fbox,
  gableRoof,
  opening,
  outwardRing,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outline } = frame.geometry;
const { foundation, floor, eave, domePeak } = plan.dimensions;
const granite = rgb('b4ad9f');
const base = rgb('a39a89');
const dressed = rgb('c3baac');
const copper = rgb('97806b');
const seams = rgb('816f60');
const bronze = rgb('99754a');
const glass = rgb('5b6263');
const dark = rgb('5d5448');
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_granite', roughness: 0.93 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  ground: { slot: 'foundation', graph: 'stone_granite', roughness: 0.96 },
  copper: { slot: 'roof', graph: 'metal_copper', roughness: 0.87 },
  gold: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.74 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66 },
  door: { slot: 'door', graph: 'wood_plain', roughness: 0.86 },
};
const body = outline.map(([x, z]) => [Math.max(-16.63, Math.min(x, 16.57)), z]);
const north = (x, z) => facade([x, z], [-1, 0]);
const south = (x, z) => facade([x, z], [1, 0]);
const east = (x, z) => facade([x, z], [0, -1]);
const west = (x, z) => facade([x, z], [0, 1]);

function cap(out, ring, y) {
  const triangles = earcut(ring.flat(), [], 2);
  const p = (i) => [ring[i][0], y, ring[i][1]];
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3);
    tri(out, 'copper', p(a), p(c), p(b), copper);
  }
}
function sash(out, F, u, y, width, height, lod) {
  opening(out, F, u, y, width, height, {
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass,
    frame: dressed,
    frameWidth: lod === 3 ? 0.096 : 0,
    frameDepth: 0.123,
    d: 0.075,
    sill: lod === 3,
    mullions: lod >= 2 ? 1 : 0,
    transoms: lod === 3 ? 2 : 0,
  });
  if (lod >= 2 && height > 2.1)
    fbox(
      out,
      'trim',
      F,
      u - width * 0.56,
      u + width * 0.56,
      y + height + 0.07,
      y + height + 0.17,
      0.005,
      0.16,
      dressed,
    );
}
function wingWalls(out, lod) {
  if (lod > 0) extrude(out, 'ground', body, foundation, floor + 0.89, base, { top: false });
  extrude(out, 'wall', body, lod === 0 ? foundation : floor + 0.89, eave, granite, { top: false });
  cap(out, body, eave);
  const rim = outwardRing(body);
  for (let i = 0; i < rim.length; i++) {
    const F = wallFace(rim[i], rim[(i + 1) % rim.length]);
    fbox(out, 'trim', F, 0.025, F.length - 0.025, eave - 0.7, eave + 0.19, -0.055, 0.44, dressed);
    if (lod === 0) continue;
    fbox(out, 'trim', F, 0.025, F.length - 0.025, 15.88, 16.21, -0.045, 0.24, dressed);
    fbox(out, 'trim', F, 0.025, F.length - 0.025, 4.1, 4.44, -0.045, 0.17, dressed);
    if (F.length < 6 || (Math.abs(F.origin[0]) > 16.3 && Math.abs(F.normal[0]) > 0.92)) continue;
    const count = F.length > 17 ? 5 : F.length > 10 ? 3 : 1;
    const span = F.length * 0.89;
    for (let i = 0; i < count; i++) {
      const u = F.length * 0.5 + span * ((i + 0.5) / count - 0.5);
      sash(out, F, u, 1.53, 1.39, 2.39, lod);
      sash(out, F, u, 6.27, 1.53, 3.11, lod);
      sash(out, F, u, 11.83, 1.34, 2.19, lod);
    }
    if (lod < 2 || Math.abs(F.normal[1]) < 0.85) continue;
    const pillars = F.length > 18 ? 6 : 4;
    for (let j = 0; j < pillars; j++) {
      const u = 0.65 + (j * (F.length - 1.3)) / (pillars - 1);
      fbox(out, 'trim', F, u - 0.3, u + 0.3, 4.41, 15.8, -0.045, 0.31, granite);
      fbox(out, 'trim', F, u - 0.46, u + 0.46, 15.42, 15.82, -0.03, 0.47, dressed);
    }
    if (lod === 3 && F.length > 18) {
      const count = Math.floor(F.length / 0.74);
      for (let j = 1; j < count; j++) {
        const u = (j * F.length) / count;
        fbox(out, 'trim', F, u - 0.11, u + 0.11, 16.26, 16.86, 0.03, 0.35, dressed);
      }
    }
  }
}
function column(out, F, u, low, high, lod) {
  const [x, , z] = F.P(u, 0, -0.38);
  const n = [6, 8, 12, 16][lod];
  const r = 0.72;
  const section = (y, k) => radialRing(y, r * k, r * k, n, [x, z]);
  loft(out, 'trim', [section(low, 1), section(high - 0.18, 0.79), section(high, 0.86)], dressed, {
    cap: false,
  });
  fbox(out, 'trim', F, u - 0.82, u + 0.82, high, high + 0.34, -1.22, 0.49, dressed);
  if (lod < 2) return;
  const count = lod === 3 ? 12 : 8;
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count;
    const dx = Math.cos(a) * r,
      dz = Math.sin(a) * r;
    beam(
      out,
      'trim',
      [x + dx * 0.989, low + 0.3, z + dz * 0.989],
      [x + dx * 0.8, high - 0.29, z + dz * 0.8],
      0.063,
      0.04,
      granite,
    );
  }
}
function doricPortico(out, F, lod) {
  const w = 13.97,
    half = w / 2,
    depth = 5.26,
    baseTop = 5.31,
    lintel = 17.66;
  for (const side of [-1, 0, 1]) {
    const u = side * 4.58;
    fbox(out, 'ground', F, u - 1.07, u + 1.07, foundation, baseTop, -depth, 0.05, base);
    if (lod > 1)
      for (let j = 0; j < 9; j++) {
        const y = 0.43 + j * 0.538;
        fbox(out, 'trim', F, u - 1.12, u + 1.12, y, y + 0.102, -depth + 0.22, 0.13, granite);
      }
  }
  fbox(out, 'ground', F, -half, half, baseTop - 0.27, baseTop + 0.21, -depth, 0.31, granite, {
    bottom: true,
  });
  for (const u of [-5.43, -1.82, 1.82, 5.43]) column(out, F, u, baseTop + 0.16, lintel - 0.36, lod);
  fbox(out, 'trim', F, -half, half, lintel, lintel + 1.33, -depth, 0.48, dressed, { bottom: true });
  fbox(
    out,
    'trim',
    F,
    -half - 0.22,
    half + 0.22,
    lintel + 1.25,
    lintel + 1.72,
    -depth,
    0.655,
    dressed,
  );
  const a = F.P(0, 0, 0.611),
    b = F.P(0, 0, -depth - 0.13);
  gableRoof(out, 'copper', [a[0], a[2]], [b[0], b[2]], w + 0.4, lintel + 1.69, 21.72, copper, {
    overhang: 0.08,
    endSlot: 'trim',
    endColor: granite,
  });
  if (lod === 0) return;
  const [x, , z] = F.P(0, 0, -depth + 0.018);
  const back = facade([x, z], F.along);
  for (const u of [-3.62, 0, 3.62]) {
    sash(out, back, u, 7.2, 1.37, 3.24, lod);
    sash(out, back, u, 12.51, 1.25, 2.23, lod);
  }
  opening(out, back, 0, floor + 0.24, 1.76, 3.45, {
    glassSlot: 'door',
    frameSlot: 'trim',
    glass: dark,
    frame: dressed,
    frameWidth: lod === 3 ? 0.1 : 0,
    sill: false,
  });
  if (lod === 3)
    for (let i = -9; i <= 9; i++) {
      const u = i * 0.69;
      fbox(out, 'trim', F, u - 0.115, u + 0.115, lintel + 0.22, lintel + 1.23, 0.41, 0.53, granite);
    }
}
function rotunda(out, lod) {
  const center = [-0.23, 0.11];
  const sides = [12, 20, 28, 44][lod];
  const circle = (y, r, n = sides) => radialRing(y, r, r, n, center, Math.PI / 8);
  const plinth = [
    [17.99, 8.74],
    [19.05, 8.74],
    [19.67, 8.34],
    [20.07, 8.27],
  ];
  loft(
    out,
    'wall',
    plinth.map(([y, r]) => circle(y, r, 8)),
    granite,
    { cap: false },
  );
  loft(
    out,
    'trim',
    [
      [19.91, 8.03],
      [20.84, 8.03],
      [21.25, 7.99],
    ].map(([y, r]) => circle(y, r)),
    dressed,
    { cap: false },
  );
  const arc = [
    [21.21, 7.99],
    [22.54, 7.79],
    [23.79, 7.21],
    [25.12, 6.35],
    [26.08, 5.32],
    [26.96, 4.01],
    [27.5, 2.51],
  ];
  const shell = lod === 0 ? arc.filter((_p, i) => i % 2 === 0) : arc;
  loft(
    out,
    'copper',
    shell.map(([y, r]) => circle(y, r)),
    copper,
    { cap: false },
  );
  loft(
    out,
    'trim',
    [
      [27.44, 2.47],
      [28.19, 2.47],
      [28.35, 2.39],
    ].map(([y, r]) => circle(y, r)),
    dressed,
    { cap: true },
  );
  if (lod < 2) return;
  const span = lod === 3 ? 24 : 12;
  for (let i = 0; i < span; i++) {
    const a = (i * Math.PI * 2) / span;
    const [x, z] = center;
    const point = ([h, r]) => [x + (r + 0.023) * Math.cos(a), h, z + (r + 0.023) * Math.sin(a)];
    for (let j = 1; j < arc.length; j++)
      beam(out, 'copper', point(arc[j - 1]), point(arc[j]), 0.034, 0.023, seams);
    if (lod === 2 && i % 2 === 1) continue;
    const leaf = facade(
      [x + 2.38 * Math.cos(a), z + 2.38 * Math.sin(a)],
      [Math.sin(a), -Math.cos(a)],
    );
    fbox(out, 'gold', leaf, -0.035, 0.035, 28.26, 28.76, -0.042, 0.048, bronze);
    const top = domePeak - 0.03;
    for (const d of [-1, 1]) {
      const [a, b, c] = [
        leaf.P(0, top - 0.24, 0.061),
        leaf.P(d * 0.15, top - 0.13, 0.056),
        leaf.P(0, top, 0.059),
      ];
      tri(out, 'gold', a, d < 0 ? c : b, d < 0 ? b : c, bronze);
      tri(out, 'gold', a, d < 0 ? b : c, d < 0 ? c : b, bronze);
    }
  }
}
function build(out, lod) {
  wingWalls(out, lod);
  doricPortico(out, east(21.858, 0.22), lod);
  doricPortico(out, west(-21.84, 0.12), lod);
  rotunda(out, lod);
  if (lod > 1) {
    for (const F of [south(-0.18, 24.172), north(-0.22, -24.16)])
      opening(out, F, 0, floor + 0.19, 1.85, 3.69, {
        glassSlot: 'door',
        frameSlot: 'trim',
        glass: dark,
        frame: dressed,
        d: 0.12,
        frameWidth: 0.12,
        sill: false,
      });
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'north-carolina-state-capitol-model.mjs';
const camera = [81, 39, 62];
const lookAt = [0, 11, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The 1840 North Carolina State Capitol in Raleigh, with gneiss wings, paired Doric porticoes and a shallow copper dome.',
  camera,
  lookAt,
  sunDirection: [55, 62, 41],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.93,
    basis: 'The identified cross-shaped Capitol footprint and projecting porticoes.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'union-square-exterior-and-dome', position: camera, lookAt },
    { name: 'east-doric-portico-and-stone-piers', position: [49, 9, 13], lookAt: [9, 11, 0] },
    { name: 'copper-dome-and-anthemions', position: [20, 32, 34], lookAt: [0, 23.4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'north-carolina-state-capitol-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.06,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.43, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.058, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

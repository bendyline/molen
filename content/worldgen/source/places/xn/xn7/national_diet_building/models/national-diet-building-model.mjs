import fs from 'node:fs';
import {
  beamPath,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fbox,
  lathe,
  opening,
  outwardRing,
  rgb,
  ribbon,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const settings = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, mainRoofY, centralRoofY, towerTopY } = settings.dimensions;
const outline = frame.geometry.outline;
const holes = frame.geometry.holes;
const materials = {
  wall: { slot: 'wall', graph: 'stone_granite', roughness: 0.94 },
  trim: { slot: 'trim', graph: 'stone_granite', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'stone_ashlar', roughness: 0.96 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.98 },
  recess: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.96 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.72, metallic: 0.05 },
  iron: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.73, metallic: 0.18 },
};
const pale = rgb('b9b7ae');
const capstone = rgb('cdcabd');
const midStone = rgb('aaa89f');
const shade = rgb('96958b');
const roofTone = rgb('a29d90');
const graniteBase = rgb('95958a');
const recess = rgb('757973');
const glazing = rgb('495968');
const shadedGlass = rgb('4e5455');
const mullions = rgb('4f5554');

const coreZ = -0.94;
const yardFloor = 1.03;
const mass = outline
  .map(([x, z]) => [x > 39.5 ? Math.min(x, 40.08) : x, z])
  .filter((point, i, list) =>
    i === 0 ? true : Math.hypot(point[0] - list[i - 1][0], point[1] - list[i - 1][1]) > 0.11,
  );

const rect = (x0, x1, z0, z1) => [
  [x0, z1],
  [x1, z1],
  [x1, z0],
  [x0, z0],
];
const planeEast = (x, z) => facade([x, z], [0, -1]);
const planeWest = (x, z) => facade([x, z], [0, 1]);

function prism(out, slot, box, low, top, color) {
  const [x0, x1, z0, z1] = box;
  abox(out, slot, [x0, low, z0], [x1, top, z1], color, { bottom: false });
}

function cap(out, slot, outline, courts, y, color) {
  const points = outline.concat(...courts);
  const start = [];
  let offset = outline.length;
  for (const court of courts) {
    start.push(offset);
    offset += court.length;
  }
  const tri = earcut(points.flat(), start, 2);
  if (tri.length === 0) throw Error('Empty Diet Building cap');
  for (let i = 0; i < tri.length; i += 3) {
    const indices = [tri[i], tri[i + 2], tri[i + 1]];
    const corners = indices.map((index) => [points[index][0], y, points[index][1]]);
    out.addTriangle(
      slot,
      'palette:#ffffff',
      corners,
      [0, 1, 0],
      indices.map((index) => points[index]),
      color,
    );
  }
}

function raisedOutline(out, ring, y, width, height, slot, color) {
  beamPath(
    out,
    slot,
    ring.map(([x, z]) => [x, y, z]),
    width,
    height,
    color,
    true,
  );
}

function darkWindow(out, f, u, y, width, height, lod, options = {}) {
  const { tall = false, stone = false, inset = 0.055 } = options;
  opening(out, f, u, y, width, height, {
    glass: stone ? shadedGlass : glazing,
    frame: stone ? midStone : shade,
    frameSlot: 'trim',
    mullionColor: mullions,
    frameWidth: lod >= 3 && !tall ? 0.075 : 0,
    sill: false,
    frameDepth: 0.13,
    d: inset,
    mullions: lod >= 2 && !tall ? 1 : 0,
    transoms: lod >= 3 ? 1 : 0,
  });
}

function bodyBays(out, ring, lod, courtyard = false) {
  if (lod === 0) return;
  const edges = courtyard ? outwardRing(ring).reverse() : outwardRing(ring);
  const courtOffset = courtyard ? 0.4 : 0;
  for (let i = 0; i < edges.length; i++) {
    const a = edges[i];
    const b = edges[(i + 1) % edges.length];
    const edge = wallFace(a, b);
    if (edge.length < (courtyard ? 4.2 : 6.3)) continue;
    const bays = Math.max(1, Math.round(edge.length / (courtyard ? 4.84 : 4.08)));
    const pitch = edge.length / bays;
    const porticoBehind = !courtyard && Math.min(a[0], b[0]) > 38.6;
    for (let j = 0; j < bays; j++) {
      if (porticoBehind && a[1] > -18.0 && a[1] < 16.5) continue;
      const u = (j + 0.5) * pitch;
      if (lod >= 2 && !courtyard) {
        fbox(out, 'trim', edge, u - 0.97, u + 0.97, 3.06, 16.94, 0.017, 0.14, midStone);
      }
      for (const [y, height] of [
        [3.62, 2.95],
        [8.46, 3.18],
        [13.32, 3.34],
      ]) {
        darkWindow(out, edge, u, y + courtOffset, courtyard ? 1.42 : 1.43, height, lod, {
          inset: courtyard || lod === 1 ? 0.073 : 0.165,
        });
      }
      if (lod >= 2 && !courtyard && (j + 1) % 4 === 0) {
        fbox(out, 'trim', edge, j * pitch - 0.16, j * pitch + 0.16, 2.91, 19.39, 0.015, 0.23, pale);
      }
    }
  }
}

function wings(out, lod) {
  if (lod === 0) {
    extrude(out, 'wall', mass, foundation, mainRoofY, pale, { top: false, holes });
    cap(out, 'roof', mass, holes, mainRoofY, roofTone);
    return;
  }
  extrude(out, 'base', outline, foundation, yardFloor, graniteBase, { top: false, holes });
  cap(out, 'base', outline, holes, yardFloor, midStone);
  extrude(out, 'wall', mass, yardFloor - 0.075, mainRoofY - 0.31, pale, { top: false, holes });
  cap(out, 'roof', mass, holes, mainRoofY - 0.3, roofTone);
  if (lod === 1) {
    for (const y of [2.25, mainRoofY - 1.68, mainRoofY - 0.58]) {
      ribbon(out, 'trim', mass, y, y + 0.23, capstone, { inset: 0.02, minLength: 0.45 });
    }
  } else {
    raisedOutline(out, mass, mainRoofY - 0.16, 0.37, 0.32, 'trim', capstone);
    raisedOutline(out, mass, mainRoofY - 1.66, 0.34, 0.26, 'trim', capstone);
    for (const court of holes)
      raisedOutline(out, court, mainRoofY - 0.28, 0.25, 0.3, 'trim', capstone);
    raisedOutline(out, mass, 2.35, 0.27, 0.28, 'base', shade);
  }
  bodyBays(out, mass, lod);
  if (lod >= 2) for (const court of holes) bodyBays(out, court, lod, true);
}

function facadePanel(out, f, u, y, width, height, lod) {
  fbox(out, 'trim', f, u - width / 2, u + width / 2, y, y + height, 0.012, 0.18, midStone);
  if (lod === 3) {
    for (let i = 0; i < 4; i++) {
      const p = u - width / 2 + ((i + 0.5) * width) / 4;
      fbox(out, 'trim', f, p - 0.1, p + 0.1, y + 0.15, y + height - 0.15, 0.16, 0.26, capstone);
    }
  }
}

function column(out, x, z, w, low, top, lod) {
  prism(out, 'wall', [x - w / 2, x + w / 2, z - w / 2, z + w / 2], low, top, pale);
  if (lod >= 1) {
    const r = w / 2 + 0.14;
    const block = [x - r, x + r, z - r, z + r];
    prism(out, 'trim', block, low, low + 0.36, capstone);
    prism(out, 'trim', block, top - 0.48, top, capstone);
  }
  if (lod === 3) {
    const f = planeEast(x + w / 2, z);
    for (const u of [-w / 4, 0, w / 4])
      fbox(out, 'trim', f, u - 0.019, u + 0.019, top - 4.0, top - 0.55, 0.008, 0.035, midStone);
  }
}

function stairs(out, front, back, z0, z1, rise, lod) {
  const count = lod === 0 ? 4 : 9;
  for (let i = 0; i < count; i++) {
    const x1 = front - (front - back) * (i / count);
    const x0 = front - (front - back) * ((i + 1) / count);
    prism(out, 'base', [x0, x1, z0, z1], -0.19, rise * ((i + 1) / count), graniteBase);
  }
}

function sidePortico(out, z, x, lod) {
  if (lod === 0) {
    prism(out, 'trim', [37.9, x + 1.24, z - 10.35, z + 10.35], 16.25, mainRoofY, capstone);
    prism(out, 'base', [39.7, x + 3.35, z - 8.78, z + 8.78], -0.19, 1.64, graniteBase);
    for (const dz of [-8.2, -2.74, 2.74, 8.2]) column(out, x - 0.6, z + dz, 1.35, 1.64, 16.3, lod);
    return;
  }
  prism(out, 'recess', [36.3, x - 2.2, z - 9.6, z + 9.6], yardFloor, 16.32, shade);
  const rear = planeEast(x - 2.2, z);
  for (const u of [-5.3, 0, 5.3]) {
    fbox(out, 'glass', rear, u - 1.58, u + 1.58, 1.46, 6.32, 0.018, 0.1, shadedGlass);
    if (lod >= 1) darkWindow(out, rear, u, 8.76, 2.47, 3.82, lod, { tall: true });
  }
  stairs(out, x + 3.35, x - 0.96, z - 8.78, z + 8.78, 1.64, lod);
  for (const zz of [-8.2, -2.74, 2.74, 8.2]) column(out, x - 0.6, z + zz, 1.35, 1.65, 16.25, lod);
  prism(out, 'wall', [38.0, x + 1.0, z - 10.08, z + 10.08], 16.25, 19.56, pale);
  prism(out, 'trim', [37.9, x + 1.24, z - 10.35, z + 10.35], 19.22, mainRoofY, capstone);
}

function mainPortico(out, lod) {
  const box = [39.34, 49.08, coreZ - 13.1, coreZ + 13.1];
  if (lod === 0) {
    prism(out, 'wall', [31.7, 41.79, coreZ - 21.45, coreZ + 21.45], 0.66, centralRoofY, pale);
    prism(out, 'wall', box, 20.35, 25.64, pale);
    prism(out, 'base', [40.0, 55.4, coreZ - 12.43, coreZ + 12.43], -0.19, 2.26, graniteBase);
    for (const z of [-12.01, -7.2, -2.41, 2.41, 7.2, 12.01])
      column(out, 48.1, coreZ + z, 1.91, 2.23, 20.45, lod);
    return;
  }
  prism(out, 'wall', [31.7, 41.79, coreZ - 21.45, coreZ + 21.45], 0.66, centralRoofY, pale);
  prism(out, 'recess', [40.15, 43.33, coreZ - 11.08, coreZ + 11.08], 1.43, 20.2, recess);
  stairs(out, 55.4, 48.8, coreZ - 12.43, coreZ + 12.43, 2.26, lod);
  prism(out, 'base', [43.03, 48.85, coreZ - 12.73, coreZ + 12.73], 0.83, 2.26, capstone);
  for (const z of [-12.01, -7.2, -2.41, 2.41, 7.2, 12.01])
    column(out, 48.1, coreZ + z, 1.91, 2.23, 20.57, lod);
  prism(out, 'trim', [39.22, 50.02, coreZ - 13.43, coreZ + 13.43], 20.36, 21.3, capstone);
  prism(out, 'wall', box, 21.1, 25.26, pale);
  prism(out, 'trim', [39.17, 49.63, coreZ - 13.31, coreZ + 13.31], 25.19, 25.64, capstone);
  const front = planeEast(49.08, coreZ);
  if (lod >= 1) facadePanel(out, front, 0, 22.5, 15.65, 2.01, lod);
  const back = planeEast(43.33, coreZ);
  for (const u of [-9.62, -4.81, 0, 4.81, 9.62]) {
    fbox(out, 'glass', back, u - 1.34, u + 1.34, 2.29, 7.78, 0.02, 0.08, shadedGlass);
    if (lod >= 1) {
      facadePanel(out, back, u, 8.56, 2.67, 3.21, lod);
      darkWindow(out, back, u, 13.22, 2.15, 4.13, lod, { tall: true });
    }
  }
}

function towerLayer(out, center, span, low, high, color, slot = 'wall') {
  prism(
    out,
    slot,
    [center[0] - span / 2, center[0] + span / 2, center[1] - span / 2, center[1] + span / 2],
    low,
    high,
    color,
  );
}

function towerWalls(out, center, lod) {
  const x = center[0];
  const z = center[1];
  towerLayer(out, center, 33.1, mainRoofY - 0.35, centralRoofY, pale);
  towerLayer(out, center, 29.3, centralRoofY - 0.02, 34.44, midStone);
  towerLayer(out, center, 26.3, 28.2, 48.89, pale);
  towerLayer(out, center, 26.85, 47.88, 49.47, capstone, 'trim');
  towerLayer(out, center, 24.35, 49.38, 53.37, midStone);
  towerLayer(out, center, 24.61, 52.83, 53.51, pale, 'trim');
  const frames = [
    planeEast(x + 13.15, z),
    planeWest(x - 13.15, z),
    facade([x, z + 13.15], [1, 0]),
    facade([x, z - 13.15], [-1, 0]),
  ];
  for (const f of frames) {
    if (lod === 0) {
      for (const u of [-8, -4, 0, 4, 8])
        darkWindow(out, f, u, 34.6, 2.34, 9.98, lod, { tall: true });
      continue;
    }
    const frontX = f.origin[0] + f.normal[0] * 0.78;
    const frontZ = f.origin[1] + f.normal[1] * 0.78;
    const beamFrame = facade([frontX, frontZ], f.along);
    fbox(out, 'recess', f, -10.1, 10.1, 34.2, 45.23, 0.02, 0.09, recess);
    fbox(out, 'trim', f, -10.53, 10.53, 32.92, 34.3, 0.02, 0.82, pale);
    fbox(out, 'trim', f, -10.54, 10.54, 45.27, 46.83, 0.02, 0.83, capstone);
    for (const u of [-8.0, -4.0, 0, 4.0, 8.0]) {
      darkWindow(out, f, u, 34.6, 2.34, 9.98, lod, { tall: true, inset: 0.14 });
      if (lod >= 2) {
        for (const y of [36.6, 38.6, 40.6, 42.6])
          fbox(out, 'iron', f, u - 1.03, u + 1.03, y, y + 0.057, 0.15, 0.19, mullions);
      }
    }
    if (lod >= 1) {
      for (const u of [-10, -6, -2, 2, 6, 10])
        fbox(out, 'trim', beamFrame, u - 0.32, u + 0.32, 34.21, 45.38, -0.82, -0.02, pale);
      const upper = facade(
        [f.origin[0] - f.normal[0] * 0.975, f.origin[1] - f.normal[1] * 0.975],
        f.along,
      );
      for (const u of [-7.66, -3.83, 0, 3.83, 7.66])
        darkWindow(out, upper, u, 49.66, 0.97, 2.13, lod, { tall: true });
    }
    if (lod >= 2) {
      facadePanel(out, beamFrame, 0, 45.47, 8.42, 1.04, lod);
      for (const u of [-10.64, -7.98, -5.32, -2.66, 0, 2.66, 5.32, 7.98, 10.64]) {
        const y = 47.03;
        const sides = lod === 3 ? 10 : 6;
        const ring = (r, d) =>
          Array.from({ length: sides }, (_, i) => {
            const a = (i * Math.PI * 2) / sides;
            return f.P(u + Math.cos(a) * r, y + Math.sin(a) * r, d);
          });
        const [back, front] = [ring(0.85, 0.12), ring(0.75, 0.3)];
        loft(out, 'trim', [back, front], midStone, { cap: false });
      }
    }
  }
  if (lod >= 2) {
    for (const dx of [-12.7, 12.7]) {
      for (const dz of [-14.2, 14.2]) {
        const point = [x + dx, z + dz];
        const profile = [
          [26.15, 1.75],
          [29.31, 1.74],
          [29.47, 1.4],
          [30.62, 1.37],
          [30.86, 0.62],
        ];
        lathe(
          out,
          'trim',
          point,
          profile.map(([y, r]) => [y, r, r]),
          lod === 3 ? 12 : 8,
          pale,
          { capTop: true },
        );
      }
    }
  }
}

function pyramid(out, center, lod) {
  const levels = [9, 13, 19, 22][lod];
  const low = 53.44;
  const top = 61.75;
  for (let i = 0; i < levels; i++) {
    const span = 23.36 - (17.45 * i) / (levels - 1);
    const floor = low + ((top - low) * i) / levels;
    const next = low + ((top - low) * (i + 1)) / levels;
    towerLayer(out, center, span, floor, next, i % 5 === 0 ? midStone : pale, 'roof');
  }
  towerLayer(out, center, 5.71, top - 0.04, towerTopY - 1.14, pale, 'roof');
  towerLayer(out, center, 4.72, towerTopY - 1.14, towerTopY - 0.36, midStone, 'roof');
  towerLayer(out, center, 3.9, towerTopY - 0.36, towerTopY, pale, 'roof');
  if (lod >= 1) {
    for (const f of [
      planeEast(center[0] + 2.86, center[1]),
      planeWest(center[0] - 2.86, center[1]),
      facade([center[0], center[1] + 2.86], [1, 0]),
      facade([center[0], center[1] - 2.86], [-1, 0]),
    ])
      for (const u of [-1.49, 0, 1.49])
        darkWindow(out, f, u, 62.07, 0.46, 1.69, lod, { tall: true });
  }
}

function build(out, lod) {
  wings(out, lod);
  mainPortico(out, lod);
  sidePortico(out, 74.5, 46.0, lod);
  sidePortico(out, -76.8, 44.94, lod);
  const center = [24.25, coreZ];
  towerWalls(out, center, lod);
  pyramid(out, center, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'national-diet-building-model.mjs';
const camera = [213, 90, 209];
const lookAt = [2, 21.7, 0];
export const model = {
  id: settings.model,
  key: settings.model,
  cell: settings.cell,
  recipe,
  title: settings.title,
  wikidataId: settings.wikidataId,
  category: 'civic',
  surfaces: materials,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Japan’s National Diet Building with symmetrical granite wings, open courtyards, and the stepped central tower.',
  camera,
  lookAt,
  sunDirection: [60, 62, 32],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'The complete named National Diet Building relation.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(materials).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: settings.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'symmetric-wings-and-central-tower', position: [225, 39, -18], lookAt: [4, 20, 0] },
    { name: 'east-portico-and-stepped-pyramid', position: [137, 19, -6], lookAt: [39, 26, 0] },
    { name: 'four-courtyards-and-west-front', position: [-148, 114, 122], lookAt: [-12, 14, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'national-diet-building-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' +
      settings.cell +
      '/' +
      settings.model +
      '/models/' +
      recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.04,
    surfaces: materials,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.49, surfaces: materials },
      street: { export: 'street', errorMeters: 0.16, surfaces: materials },
      closeup: { export: 'closeup', errorMeters: 0.06, surfaces: materials },
    },
  },
  limitations: settings.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Elevation data from the Geospatial Information Authority of Japan.',
};

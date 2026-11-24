import fs from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  opening,
  outwardRing,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outline } = frame.geometry;
const { foundation, floor, cornice, upperAttic, tower: towerHeight } = plan.dimensions;
const surfaces = {
  limestone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.92 },
  ashlar: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.91 },
  base: { slot: 'foundation', graph: 'stone_granite', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.95 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.69 },
  bronze: { slot: 'door', graph: 'metal_bronze_cast', roughness: 0.82 },
};
const stone = rgb('c4bdad');
const dressed = rgb('cec7b7');
const relief = rgb('b9b1a1');
const base = rgb('a7a197');
const glass = rgb('515753');
const bronze = rgb('5d5545');
const roof = rgb('877f70');
const center = [5.15, 5];
const diagonal = wallFace(outline[0], outline[1]);
const mid = diagonal.P(diagonal.length / 2, 0);
const portico = facade([mid[0], mid[2]], diagonal.along);
const p = (u, d) => {
  const [x, , z] = portico.P(u, 0, d);
  return [x, z];
};

function slab(out, ring, high, slot = 'roof', color = roof) {
  const triangles = earcut(ring.flat(), [], 2);
  const at = (i) => [ring[i][0], high, ring[i][1]];
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles.slice(i, i + 3);
    tri(out, slot, at(a), at(c), at(b), color);
  }
}
function shell(out, ring, bottom, top, insetSlot = 'limestone') {
  extrude(out, insetSlot, ring, bottom, top, insetSlot === 'base' ? base : stone, { top: false });
}
function insetRing(amount) {
  return outline.map(([x, z]) => [x + (center[0] - x) * amount, z + (center[1] - z) * amount]);
}
function band(out, F, left, right, y, size, depth) {
  fbox(out, 'ashlar', F, left, right, y - size, y, -0.03, depth, dressed);
}

function sash(out, F, u, y, w, h, lod, depth = 0.023) {
  opening(out, F, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'ashlar',
    glass,
    frame: relief,
    frameWidth: lod === 3 ? 0.12 : 0,
    frameDepth: depth + 0.095,
    sill: lod === 3,
    d: depth,
    mullions: lod === 3 && w >= 1.38 ? 1 : 0,
    transoms: lod === 3 && h > 2.3 ? 1 : 0,
  });
}

function mainRanges(out, lod) {
  const vestibule = [
    outline[0],
    p(-3.94, 0),
    p(-3.94, -2.97),
    p(3.94, -2.97),
    p(3.94, 0),
    ...outline.slice(1),
  ];
  shell(out, outline, foundation, floor, 'base');
  shell(out, vestibule, floor, cornice);
  slab(out, outline, cornice);
  const first = insetRing(0.09);
  const second = insetRing(0.17);
  shell(out, first, cornice, 22.18);
  slab(out, first, 22.18);
  shell(out, second, 22.18, upperAttic);
  slab(out, second, upperAttic);
  const baseRing = outwardRing(outline);
  for (let i = 0; i < baseRing.length; i++) {
    const F = wallFace(baseRing[i], baseRing[(i + 1) % baseRing.length]);
    if (F.length < 18) continue;
    band(out, F, 0.04, F.length - 0.04, cornice + 0.12, 0.92, 0.52);
    if (lod === 0) continue;
    band(out, F, 0.04, F.length - 0.04, 6.64, 0.61, 0.37);
    if (lod > 1) band(out, F, 0.12, F.length - 0.12, 1.06, 0.16, 0.16);
    const divisions = Math.round(F.length / 4.14);
    const firstBay = 1.96;
    const bay = (F.length - firstBay * 2) / divisions;
    for (let j = 0; j < divisions; j++) {
      const u = firstBay + (j + 0.5) * bay;
      if (i === 5 && u < 6.75) continue;
      const narrow = 1.34;
      sash(out, F, u, 2.18, narrow, 3.25, lod);
      sash(out, F, u, 7.66, 1.7, 3.35, lod);
      sash(out, F, u, 12.3, 1.49, 2.34, lod);
      if (lod > 1) sash(out, F, u, 15.63, narrow, 1.75, lod);
    }
  }
  if (lod < 2) return;
  for (const [ring, y] of [
    [first, 19.62],
    [second, 22.96],
  ]) {
    for (let i = 0; i < ring.length; i++) {
      const F = wallFace(ring[i], ring[(i + 1) % ring.length]);
      if (F.length < 17) continue;
      const divisions = Math.round(F.length / 5.9);
      for (let j = 1; j <= divisions; j++) {
        sash(out, F, (F.length * j) / (divisions + 1), y, 1.19, 1.32, lod);
      }
    }
  }
}

function column(out, F, u, d, low, high, size, lod) {
  const [x, , z] = F.P(u, 0, d);
  const sides = [6, 8, 12, 16][lod];
  const ring = (y, r) => radialRing(y, r, r, sides, [x, z]);
  loft(out, 'ashlar', [ring(low, size), ring(high, size * 0.83)], dressed, { cap: false });
  if (lod > 0) {
    fbox(
      out,
      'ashlar',
      F,
      u - size * 1.2,
      u + size * 1.2,
      low - 0.22,
      low + 0.12,
      d - size * 1.2,
      d + size * 1.2,
      relief,
    );
    fbox(
      out,
      'ashlar',
      F,
      u - size * 1.19,
      u + size * 1.19,
      high - 0.08,
      high + 0.19,
      d - size * 1.22,
      d + size * 1.22,
      dressed,
    );
  }
}
function entrance(out, lod) {
  const F = portico;
  fbox(out, 'ashlar', F, -5.86, 5.86, 11.91, 17.99, -3.7, 0.22, stone, { bottom: true });
  band(out, F, -6.02, 6.02, 17.54, 0.51, 0.59);
  band(out, F, -6.11, 6.11, 14.07, 0.62, 0.66);
  for (const u of [-2.94, 2.94]) column(out, F, u, -0.39, 1.65, 12.19, 0.57, lod);
  for (let step = 0; step < (lod === 0 ? 1 : 4); step++) {
    fbox(
      out,
      'base',
      F,
      -4.18 + step * 0.16,
      4.18 - step * 0.16,
      floor,
      0.44 + step * 0.23,
      -3.15,
      0.75 - step * 0.25,
      base,
    );
  }
  const back = facade(p(0, -2.99), F.along);
  opening(out, back, 0, 1.17, 3.4, 4.62, {
    glassSlot: 'bronze',
    frameSlot: 'ashlar',
    glass: bronze,
    frame: dressed,
    d: 0.045,
    frameWidth: lod > 1 ? 0.28 : 0,
    frameDepth: 0.3,
    sill: false,
    mullions: lod > 1 ? 1 : 0,
  });
  sash(out, back, 0, 6.72, 3.48, 3.33, lod);
  if (lod < 2) return;
  for (let i = 0; i < 7; i++) {
    const u = (i - 3) * 0.81;
    fbox(out, 'ashlar', F, u - 0.12, u + 0.12, 15.07, 15.49 + 0.11 * (i % 2), 0.22, 0.31, relief);
  }
}
function lantern(out, lod) {
  const outline = [
    [18.36, 24.1, 7.88, 0.49, 12.98],
    [24.1, 26.21, 6.74, -0.08, 12.12],
    [26.21, 28.39, 5.64, -0.82, 11.34],
    [28.39, 30.16, 4.59, -1.37, 10.53],
  ];
  const F = portico;
  for (const [lo, hi, half, face, back] of outline) {
    fbox(out, 'limestone', F, -half, half, lo, hi, -back, face, stone);
    band(out, F, -half - 0.14, half + 0.14, hi + 0.11, 0.25, face + 0.29);
  }
  const lo = 30.13;
  const hi = 39.66;
  const half = 4.04;
  const front = -1.83;
  const back = -10.31;
  const pier = 1.32;
  for (const u of [-half, half - pier]) {
    for (const d of [back, front - pier]) {
      fbox(out, 'limestone', F, u, u + pier, lo, hi, d, d + pier, stone);
    }
  }
  for (const u of [-1.59, 1.59]) column(out, F, u, front - 0.27, lo + 0.12, hi - 0.44, 0.46, lod);
  if (lod > 0) {
    for (const u of [-1.61, 1.61]) column(out, F, u, back + 0.63, lo + 0.12, hi - 0.44, 0.41, lod);
    fbox(out, 'ashlar', F, -1.05, 1.05, lo, lo + 3.78, front - 1.15, front - 0.04, dressed);
    sash(out, facade(p(0, front - 0.041), F.along), 0, lo + 0.68, 0.76, 1.85, lod);
  }
  fbox(out, 'ashlar', F, -4.43, 4.43, hi - 0.43, hi + 0.44, back - 0.35, front + 0.41, dressed, {
    bottom: true,
  });
  fbox(out, 'limestone', F, -3.88, 3.88, hi + 0.44, hi + 2.11, back + 0.14, front - 0.14, stone);
  const shell = (y, size, d0, d1) => [
    F.P(-size, y, d0),
    F.P(size, y, d0),
    F.P(size, y, d1),
    F.P(-size, y, d1),
  ];
  loft(
    out,
    'ashlar',
    [
      shell(hi + 2.07, 3.68, front - 0.21, back + 0.31),
      shell(towerHeight - 0.92, 2.65, front - 0.96, back + 0.95),
      shell(towerHeight, 2.49, front - 1.05, back + 1.09),
    ],
    dressed,
  );
  if (lod > 1) {
    opening(out, facade(p(0, front - 0.135), F.along), 0, hi + 0.82, 1.66, 1.12, {
      glassSlot: 'glass',
      frameSlot: 'ashlar',
      glass,
      frame: relief,
      head: 'round',
      frameWidth: lod > 2 ? 0.1 : 0,
      sill: false,
    });
  }
}
function build(out, lod) {
  mainRanges(out, lod);
  entrance(out, lod);
  lantern(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'freemasons-hall-london-model.mjs';
const camera = [-97, 52, 124];
const lookAt = [-2, 19, 7];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'cultural',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Freemasons’ Hall on Great Queen Street with its Portland stone street walls, recessed classical entrance, stepped attics and open corner tower.',
  camera,
  lookAt,
  sunDirection: [-65, 49, 57],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'The identified polygonal Freemasons’ Hall perimeter.',
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
    { name: 'long-acre-corner-tower', position: camera, lookAt },
    {
      name: 'portland-stone-entrance-and-open-lantern',
      position: [-55, 10, 78],
      lookAt: [-21, 19, 43],
    },
    { name: 'great-queen-street-frontage', position: [-99, 34, -54], lookAt: [-18, 17, 7] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'freemasons-hall-london-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.35,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.54, surfaces },
      street: { export: 'street', errorMeters: 0.17, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.062, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

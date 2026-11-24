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
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outline, holes } = frame.geometry;
const [courtyard] = holes;
const { foundation, floor, galleryEave, entryTop, greenhouseBase, greenhouseTop } = plan.dimensions;
const brick = rgb('ad785e');
const pale = rgb('c7c5b8');
const frameStone = rgb('bcbdb3');
const stone = rgb('a8a89c');
const roof = rgb('888980');
const metal = rgb('adb7b7');
const glass = rgb('688077');
const door = rgb('53605b');
const rail = rgb('818782');
const surfaces = {
  brick: { slot: 'wall', graph: 'brick', roughness: 0.96 },
  base: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96 },
  stone: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.92 },
  metal: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.84 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.78 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43 },
};

const conservatory = outline.slice(15, 24);
const gallery = outline.filter((_, i) => i <= 15 || i >= 23);
const lowGallery = gallery.filter((_, i) => ![1, 2, 10, 11, 20, 24, 25, 26].includes(i));
const greenhouseFront = wallFace(outline[21], outline[20]);
const entry = facade([17.993, -10.65], [0, -1]);

function volume(out, slot, ring, inner, bottom, top, bodyTint, roofSlot, roofTint) {
  extrude(out, slot, ring, bottom, top, bodyTint, { holes: inner, top: false });
  const vertices = [ring, ...inner].flat();
  const indices = earcut(vertices.flat(), inner.length ? [ring.length] : [], 2);
  const point = (i) => [vertices[i][0], top, vertices[i][1]];
  for (let i = 0; i < indices.length; i += 3)
    tri(out, roofSlot, point(indices[i]), point(indices[i + 2]), point(indices[i + 1]), roofTint);
}

function windowBand(out, f, u0, u1, y0, y1, depth, count, lod, tinted = glass) {
  quad4(
    out,
    'glass',
    f.P(u0, y0, depth),
    f.P(u1, y0, depth),
    f.P(u1, y1, depth),
    f.P(u0, y1, depth),
    tinted,
  );
  if (lod === 0) return;
  for (let i = 0; i <= count; i++) {
    const x = u0 + ((u1 - u0) * i) / count;
    fbox(
      out,
      'steel',
      f,
      x - 0.048,
      x + 0.047,
      y0 - 0.021,
      y1 + 0.02,
      depth - 0.035,
      depth + 0.06,
      pale,
    );
  }
  for (const y of lod > 1 ? [y0, (y1 + y0) * 0.5, y1] : [y0, y1]) {
    fbox(out, 'steel', f, u0, u1, y - 0.034, y + 0.044, depth - 0.04, depth + 0.051, pale);
  }
}

function galleryRanges(out, lod) {
  const ring = lod === 0 ? lowGallery : gallery;
  extrude(out, 'base', ring, foundation, floor, stone, { holes, top: false });
  volume(out, 'brick', ring, holes, floor - 0.015, galleryEave, brick, 'roof', roof);
  const wing = [
    [16.16, 13.58],
    [40.72, 13.58],
    [40.72, 17.39],
    [38.86, 17.39],
    [38.86, 28.02],
    [16.16, 28.02],
  ];
  volume(out, 'brick', wing, [], galleryEave - 0.08, 6.67, brick, 'roof', roof);
  if (lod === 0) return;
  const outer = outwardRing(ring);
  for (const [i, p] of outer.entries()) {
    const f = wallFace(p, outer[(i + 1) % outer.length]);
    if (f.length < 2.3) continue;
    const highWing = f.origin[0] > 32 && f.origin[1] > 13;
    const y = highWing ? 6.66 : galleryEave;
    fbox(out, 'metal', f, 0, f.length, y - 0.115, y + 0.09, -0.13, 0.08, metal);
    if (lod < 2 || f.length < 9.0 || (f.normal[0] > 0.7 && f.origin[1] < 15)) continue;
    const w = Math.min(6.95, f.length - 2.3);
    windowBand(out, f, (f.length - w) / 2, (f.length + w) / 2, 2.55, 3.96, 0.028, 4, lod, door);
  }
  const inner = outwardRing(courtyard).reverse();
  for (const [i, p] of inner.entries()) {
    const f = wallFace(p, inner[(i + 1) % inner.length]);
    if (f.length < 7.0) continue;
    fbox(
      out,
      'stone',
      f,
      0.04,
      f.length - 0.04,
      galleryEave - 0.74,
      galleryEave + 0.055,
      -0.09,
      0.125,
      frameStone,
    );
    for (const u of [f.length * 0.32, f.length * 0.69]) {
      const half = Math.min(f.length * 0.22, 2.83);
      windowBand(out, f, u - half, u + half, floor + 0.14, galleryEave - 0.83, 0.036, 2, lod, door);
    }
  }
  if (lod < 2) return;
  for (const [x, z, w, d] of [
    [-17.2, -14.0, 6.3, 3.2],
    [33.3, 22.1, 4.8, 3.7],
    [-13.2, 34.6, 6.7, 3.3],
  ]) {
    abox(
      out,
      'metal',
      [x - w / 2, galleryEave - 0.02, z - d / 2],
      [x + w / 2, galleryEave + 0.37, z + d / 2],
      metal,
    );
  }
}

function portal(out, lod) {
  fbox(out, 'glass', entry, -3.02, 3.02, floor - 0.018, entryTop - 0.19, 0.032, 0.12, door);
  fbox(out, 'stone', entry, -3.49, 3.49, entryTop - 0.78, entryTop, -0.26, 1.18, frameStone);
  fbox(out, 'stone', entry, -3.51, 3.51, entryTop - 0.07, entryTop + 0.05, -0.29, 1.21, pale);
  for (const [u, width] of [
    [-3.2, 0.66],
    [-0.91, 0.46],
    [0.91, 0.46],
    [3.2, 0.66],
  ]) {
    fbox(
      out,
      'stone',
      entry,
      u - width * 0.5,
      u + width * 0.5,
      floor,
      entryTop - 0.71,
      -0.19,
      1.17,
      frameStone,
    );
  }
  const tread = lod === 0 ? [0.2, floor] : [0.179, 0.366, 0.552, floor];
  for (const [i, top] of tread.entries())
    fbox(
      out,
      'base',
      entry,
      -4.98,
      5.15,
      -0.08,
      top,
      -0.19,
      2.79 - i * (lod === 0 ? 0.87 : 0.47),
      stone,
    );
  if (lod === 0) return;
  for (const x of [-4.51, 4.64]) {
    const line = [entry.P(x, 0.9, 2.53), entry.P(x, 1.69, 0.98), entry.P(x, 1.69, 0.31)];
    beamPath(out, 'steel', line, 0.056, 0.052, rail);
    for (const [y, d] of [
      [0.925, 2.48],
      [1.36, 1.62],
      [1.68, 0.35],
    ])
      fbox(
        out,
        'steel',
        entry,
        x - 0.035,
        x + 0.035,
        Math.max(0.15, y - 0.91),
        y,
        d - 0.034,
        d + 0.034,
        rail,
      );
  }
  if (lod < 2) return;
  for (const [x, f] of [
    [-2, 0.6],
    [0, 0.78],
    [2, 0.56],
  ]) {
    windowBand(out, entry, x - f, x + f, floor + 0.085, 4.81, 0.19, 2, lod, door);
  }
}

function glassHouse(out, lod) {
  const rim = lod === 0 ? conservatory.filter((_, i) => i !== 2) : conservatory;
  extrude(out, 'base', rim, foundation, floor, stone, { top: false });
  volume(out, 'glass', rim, [], floor - 0.01, greenhouseBase, glass, 'metal', metal);
  const upper = [
    [20.37, -39.4],
    [36.76, -39.4],
    [36.76, -35.99],
    [25.52, -24.13],
    [20.37, -24.13],
  ];
  volume(out, 'glass', upper, [], greenhouseBase - 0.01, greenhouseTop, glass, 'metal', metal);
  const dist = greenhouseFront.length;
  const parts = lod === 0 ? [dist * 0.27, dist * 0.7] : [dist * 0.175, dist * 0.475, dist * 0.788];
  for (const [i, center] of parts.entries()) {
    const front = greenhouseFront;
    const w = lod === 0 ? 6.38 : 4.7;
    const low = greenhouseBase - 0.03;
    const high = greenhouseBase + (i === parts.length - 1 ? 1.74 : 1.48);
    const profile = (y, half, a, b) => [
      front.P(center - half, y, b),
      front.P(center - half, y, a),
      front.P(center + half, y, a),
      front.P(center + half, y, b),
    ];
    loft(
      out,
      'metal',
      [
        profile(low - 0.115, w / 2, 0.29, -1.63),
        profile(low, w / 2, 0.3, -1.65),
        profile(high, w * 0.37, -2.96, -3.75),
      ],
      metal,
    );
    windowBand(
      out,
      front,
      center - w * 0.48,
      center + w * 0.48,
      floor + 0.13,
      greenhouseBase - 0.16,
      0.12,
      lod < 2 ? 2 : 3,
      lod,
    );
  }
  if (lod === 0) return;
  for (const [ring, lo, hi] of [
    [rim, floor, greenhouseBase - 0.14],
    [upper, greenhouseBase + 0.09, greenhouseTop - 0.43],
  ]) {
    const r = outwardRing(ring);
    for (const [i, p] of r.entries()) {
      const f = wallFace(p, r[(i + 1) % r.length]);
      if (f.length < 1.9) continue;
      fbox(out, 'metal', f, 0, f.length, hi - 0.002, hi + 0.33, -0.16, 0.086, metal);
      if (ring === rim && f.normal[0] > 0.47 && f.normal[1] > 0.57) continue;
      if (f.length < 3.2 && lod < 2) continue;
      const count = Math.max(1, Math.round(f.length / (lod < 2 ? 3.8 : 2.15)));
      windowBand(out, f, 0.11, f.length - 0.09, lo + 0.065, hi - 0.012, 0.021, count, lod);
    }
  }
}

function build(out, lod) {
  galleryRanges(out, lod);
  glassHouse(out, lod);
  portal(out, lod);
  if (lod < 3) return;
  const landing = facade([17.99, -13.95], [0, -1]);
  for (const u of [-1.1, 1.28, 3.82])
    fbox(out, 'stone', landing, u - 0.019, u + 0.019, 0.744, 0.758, 0.14, 1.26, frameStone);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'huntington-museum-of-art-model.mjs';
const camera = [106, 29, 36];
const lookAt = [0, 4.8, -4];

export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Huntington Museum of Art with low brick galleries, the stone entry portal and the glazed C. Fred Edwards Conservatory.',
  camera,
  lookAt,
  sunDirection: [61, 66, 25],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Native relation 8490490 covers the connected museum ranges and greenhouse.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'museum-entry-and-conservatory', position: camera, lookAt },
    {
      name: 'stone-portal-and-entry-steps',
      position: [41, 4.7, -4.3],
      lookAt: [17.6, 3.54, -10.7],
    },
    {
      name: 'conservatory-glazing-and-roof-bays',
      position: [63, 10.2, -7.65],
      lookAt: [26.3, 3.75, -30.4],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'huntington-museum-of-art-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.91,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.37, surfaces },
      street: { export: 'street', errorMeters: 0.135, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.05, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

import fs from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
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
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const d = plan.dimensions;
const {
  outline,
  holes: [courtyard],
} = frame.geometry;
const brick = rgb('80513b');
const capBrick = rgb('8a5a42');
const stone = rgb('c6b795');
const frost = rgb('ddd2b8');
const slate = rgb('435052');
const gutter = rgb('524c3f');
const glass = rgb('525653');
const shadow = rgb('2d2520');
const metal = rgb('a78941');
const surfaces = {
  masonry: { slot: 'wall', graph: 'brick_flemish', roughness: 0.95 },
  slate: { slot: 'roof', graph: 'tile_flat', roughness: 0.88 },
  footing: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.89 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.66 },
  gate: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.89 },
};
const block = (out, slot, x0, x1, z0, z1, y0, y1, color) =>
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
function coverCourtyardRanges(out, y) {
  const points = [...outline, ...courtyard];
  const triangles = earcut(points.flat(), [outline.length]);
  for (let i = 0; i < triangles.length; i += 3) {
    const [a, b, c] = triangles
      .slice(i, i + 3)
      .map((index) => [points[index][0], y, points[index][1]]);
    tri(out, 'slate', a, c, b, slate);
  }
}
function hipRoof(out, base, ridge, eave, top) {
  const [a, b, c, f] = base.map(([x, z]) => [x, eave, z]);
  const [p, q] = ridge.map(([x, z]) => [x, top, z]);
  for (const face of [
    [b, a, p],
    [b, p, q],
    [c, b, q],
    [f, c, q],
    [f, q, p],
    [a, f, p],
  ])
    tri(out, 'slate', ...face, slate);
}
const roofs = [
  {
    base: [
      [-16.65, -19.45],
      [9.55, -20.45],
      [9.55, -10.63],
      [-16.8, -10.58],
    ],
    ridge: [
      [-12, -15.44],
      [7.25, -15.56],
    ],
    eave: 12.25,
    rise: 4.25,
  },
  {
    base: [
      [-16.72, -19.33],
      [-3.04, -19.52],
      [-2.32, 6.68],
      [-10.33, 11.4],
    ],
    ridge: [
      [-10.24, -16.71],
      [-5.58, 6.73],
    ],
    eave: 12.22,
    rise: 4.54,
  },
  {
    base: [
      [9.1, -24.46],
      [21.8, -25.18],
      [22.9, 0.62],
      [11.87, 7.27],
    ],
    ridge: [
      [15.49, -21.45],
      [16.57, 3.45],
    ],
    eave: 12.25,
    rise: 4.71,
  },
  {
    base: [
      [-8, 9.67],
      [22.9, 9.5],
      [22.91, 15.88],
      [-8.02, 15.85],
    ],
    ridge: [
      [-3.19, 12.7],
      [18.98, 12.44],
    ],
    eave: 12.3,
    rise: 4.46,
  },
  {
    base: [
      [-7.53, 10.05],
      [0.66, 9.99],
      [0.78, 20.37],
      [-8.35, 20.1],
    ],
    ridge: [
      [-3.36, 12.37],
      [-3.71, 17.55],
    ],
    eave: 12.65,
    rise: 4.7,
  },
  {
    base: [
      [19.53, 0.75],
      [33.68, -0.28],
      [33.99, 15.84],
      [19.34, 15.88],
    ],
    ridge: [
      [23.41, 7.72],
      [30.15, 7.73],
    ],
    eave: 12.36,
    rise: 5.04,
  },
  {
    base: [
      [0.12, -24.24],
      [7.1, -24.49],
      [7.49, -18.35],
      [0.34, -18.22],
    ],
    ridge: [
      [3.56, -22.62],
      [3.62, -19.6],
    ],
    eave: 12.51,
    rise: 3.03,
  },
];
function roofsAndChimneys(out, lod) {
  for (const roof of roofs) hipRoof(out, roof.base, roof.ridge, roof.eave, roof.eave + roof.rise);
  if (lod > 0) {
    for (const [x, z, y, w] of [
      [-10.2, -15.2, 15.7, 1.16],
      [4.04, -16.4, 15.35, 0.85],
      [19.22, -19.31, 15.35, 0.89],
      [25.55, 8.01, 16.76, 1.12],
      [12.73, 10.78, 15.63, 0.9],
      [19.21, 2.82, 15.15, 0.86],
    ]) {
      block(out, 'masonry', x - w / 2, x + w / 2, z - 0.44, z + 0.44, y - 0.67, y + 1.63, capBrick);
      block(out, 'trim', x - w * 0.6, x + w * 0.6, z - 0.54, z + 0.54, y + 1.6, y + 1.82, gutter);
      if (lod === 3) {
        for (const u of [-0.21, 0.21])
          block(
            out,
            'masonry',
            x + u - 0.12,
            x + u + 0.12,
            z - 0.14,
            z + 0.14,
            y + 1.78,
            y + 2.24,
            capBrick,
          );
      }
    }
  }
}
function sash(out, F, u, y, w, h, lod) {
  opening(out, F, u, y, w, h, {
    head: 'flat',
    glassSlot: 'glass',
    frameSlot: 'trim',
    glass,
    frame: stone,
    mullionColor: frost,
    d: 0.036,
    frameWidth: lod > 1 ? 0.13 : 0,
    sill: lod > 1,
    mullions: lod >= 2 ? 1 : 0,
    transoms: lod >= 2 ? 2 : 0,
  });
}
function rangeWindows(out, ring, inside, lod) {
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const F = wallFace(ring[i], ring[(i + 1) % n]);
    if (F.length < 2.55) continue;
    if (!inside && F.length > 25 && F.normal[1] > 0.65) continue;
    const count = Math.max(1, Math.round(F.length / (inside ? 3.65 : 4.4)));
    const spacing = F.length / count;
    if (F.length > 4 && lod > 1)
      fbox(out, 'trim', F, 0, F.length, 11.94, 12.22, -0.055, 0.15, stone);
    for (let bay = 0; bay < count; bay++) {
      const u = (bay + 0.5) * spacing;
      sash(out, F, u, 8.7, 1.06, 1.83, lod);
      if (lod > 0) {
        sash(out, F, u, 5.0, 1.14, 2.12, lod);
        if (inside || lod > 1) sash(out, F, u, 1.6, 0.94, 1.58, lod);
      }
    }
  }
}
function dormer(out, x, z, y, sign, lod) {
  const outer = z + sign * 0.28;
  const inner = z - sign * 1.07;
  block(
    out,
    'trim',
    x - 0.62,
    x + 0.62,
    Math.min(outer, inner),
    Math.max(outer, inner),
    y,
    y + 1.13,
    stone,
  );
  gableRoof(out, 'slate', [x, inner], [x, outer], 1.3, y + 1.1, y + 1.62, slate, {
    overhang: 0.09,
    endSlot: 'trim',
    endColor: stone,
  });
  sash(out, facade([x, outer], [sign, 0]), 0, y + 0.1, 0.62, 0.86, lod);
}
function entrance(out, lod) {
  const entranceZ = 15.67;
  const F = facade([3.61, entranceZ], [1, 0]);
  opening(out, F, 0, d.base - 0.16, 2.65, 3.77, {
    head: 'round',
    glassSlot: 'gate',
    frameSlot: 'trim',
    glass: shadow,
    frame: stone,
    d: 0.14,
    frameWidth: lod > 0 ? 0.24 : 0,
    frameDepth: 0.21,
    sill: false,
  });
  for (const side of [-1, 1]) {
    const x = side * 1.86;
    fbox(out, 'trim', F, x - 0.26, x + 0.26, d.base, 4.92, -0.05, 0.31, stone);
    if (lod > 1) fbox(out, 'trim', F, x - 0.39, x + 0.39, d.base, d.base + 0.36, 0.0, 0.43, stone);
  }
  fbox(out, 'trim', F, -2.08, 2.08, 4.75, 5.11, 0.04, 0.49, stone);
  fbox(out, 'trim', F, -1.25, 1.25, 5.08, 7.54, 0.01, 0.24, stone);
  tri(out, 'trim', F.P(-1.46, 7.48, 0.27), F.P(1.46, 7.48, 0.27), F.P(0, 8.15, 0.27), stone);
  if (lod > 1) {
    fbox(out, 'trim', F, -0.93, 0.93, 5.43, 7.24, 0.21, 0.33, gutter);
    tri(out, 'trim', F.P(-0.56, 6.52, 0.38), F.P(0, 5.58, 0.38), F.P(0.56, 6.52, 0.38), frost);
    fbox(out, 'trim', F, -0.56, 0.56, 6.52, 6.94, 0.3, 0.385, frost);
  }
  for (const x of [8.0, 11.67, 15.33, 19, 22.8, 27.0, 31.3]) {
    sash(out, F, x - 3.61, 8.62, 1.15, 1.91, lod);
    if (lod > 0) sash(out, F, x - 3.61, 4.21, 1.14, 2.17, lod);
    if (lod > 1 && x > 10) sash(out, F, x - 3.61, 1.51, 0.84, 1.22, lod);
  }
  for (const x of [-6.17, -1.33]) {
    const plane = facade([x, 20.14], [1, 0]);
    for (const y of [2.04, 5.38, 8.64])
      if (lod > 0 || y > 8) sash(out, plane, 0, y, 1.1, 1.99, lod);
  }
  if (lod > 0) {
    dormer(out, -3.38, 18.7, 13.45, 1, lod);
    for (const x of [13.25, 17.66, 23.94, 28.34, 31.5]) dormer(out, x, 13.66, 13.09, 1, lod);
    if (lod > 1)
      for (const x of [-12, -6, 12.4, 17.8]) dormer(out, x, x < 0 ? -18.1 : -21.1, 13.28, -1, lod);
  }
}
function keep(out, lod) {
  const k = d.keep;
  const n = [18, 24, 32, 40][lod];
  const c = [k.x, k.z];
  const ring = (y, r, s = n) => radialRing(y, r, r, s, c);
  loft(
    out,
    'masonry',
    [
      ring(10.92, k.radius),
      ring(k.shaftTop - 0.48, k.radius),
      ring(k.shaftTop - 0.35, k.radius + 0.14),
      ring(k.shaftTop + 0.04, k.radius + 0.14),
    ],
    capBrick,
    { cap: false },
  );
  loft(
    out,
    'slate',
    [
      ring(k.shaftTop - 0.01, 5.73),
      ring(k.shaftTop + 0.24, 5.72),
      ring(20.38, 4.76),
      ring(21.75, 3.13),
      ring(23.37, 1.92),
      ring(k.lanternBase, 1.15),
    ],
    slate,
    { cap: false },
  );
  loft(
    out,
    'slate',
    [
      ring(k.lanternBase - 0.14, 1.26, 8),
      ring(k.lanternTop - 0.4, 1.26, 8),
      ring(k.lanternTop - 0.23, 1.43, 8),
      ring(k.lanternTop, 1.45, 8),
      ring(29.04, 0.89, 8),
      ring(k.finial - 0.72, 0.16, 8),
    ],
    slate,
    { cap: false },
  );
  loft(
    out,
    'trim',
    [
      ring(k.finial - 0.73, 0.12, 8),
      ring(k.finial - 0.48, 0.22, 8),
      ring(k.finial - 0.29, 0.12, 8),
      ring(k.finial, 0.035, 8),
    ],
    metal,
    { cap: false },
  );
  if (lod > 0) {
    for (let i = 0; i < 8; i++) {
      const a = (2 * Math.PI * i) / 8;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const tower = facade([k.x + 5.48 * ca, k.z + 5.48 * sa], [sa, -ca]);
      opening(out, tower, 0, 17.73, 0.39, 0.86, {
        glassSlot: 'glass',
        glass: shadow,
        frameWidth: 0,
        sill: false,
        d: 0.07,
      });
      if (lod > 1) {
        const lantern = facade([k.x + 1.166 * ca, k.z + 1.166 * sa], [sa, -ca]);
        sash(out, lantern, 0, 26.16, 0.38, 1.1, lod);
      }
    }
  }
  if (lod === 3) {
    for (let i = 0; i < 36; i++) {
      const a = (2 * Math.PI * i) / 36;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const F = facade([k.x + 5.51 * ca, k.z + 5.51 * sa], [sa, -ca]);
      fbox(out, 'masonry', F, -0.12, 0.12, 18.95, 19.13, 0, 0.1, brick);
    }
  }
}
function build(out, lod) {
  extrude(out, 'footing', outline, d.wallFoot, d.base, brick, { holes: [courtyard], top: false });
  extrude(out, 'masonry', outline, d.base - 0.02, d.mainEave, brick, {
    holes: [courtyard],
    top: false,
  });
  coverCourtyardRanges(out, d.mainEave - 0.012);
  roofsAndChimneys(out, lod);
  keep(out, lod);
  entrance(out, lod);
  if (lod > 0) {
    rangeWindows(out, outwardRing(outline), false, lod);
    rangeWindows(out, outwardRing(courtyard).reverse(), true, lod);
  }
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'anholt-castle-model.mjs';
const camera = [-33, 36, 75];
const lookAt = [5, 9.8, -1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'castle',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Hauptburg of Wasserburg Anholt, with four brick ranges wrapping an open courtyard, slate roofs and the circular medieval Dicke Turm.',
  camera,
  lookAt,
  sunDirection: [-22, 35, 26],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.91,
    basis:
      'Outer ring of the current Hauptburg footprint. The model retains its mapped inner courtyard.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'polygon-triangulation.mjs',
    'authored-structure-mesh.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'dicke-turm-and-entrance-ranges', position: camera, lookAt },
    { name: 'courtyard-and-four-ranges', position: [29, 70, 38], lookAt: [4, 6, 0] },
    { name: 'slate-roof-and-domed-keep', position: [-42, 27, -65], lookAt: [3, 13, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'anholt-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.48,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.62, surfaces },
      street: { export: 'street', errorMeters: 0.22, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

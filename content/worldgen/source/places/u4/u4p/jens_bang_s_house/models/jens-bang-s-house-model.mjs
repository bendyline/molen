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
  opening,
  outwardRing,
  quad4,
  rgb,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const outline = outwardRing(frame.geometry.outline);
const { foundation, plinth, eave, ridge, centralGable, outerGable } = plan.dimensions;
const brick = rgb('a27b61');
const shadeBrick = rgb('8d6855');
const ornament = rgb('c0ad90');
const lightSand = rgb('cbbfa5');
const base = rgb('9d927b');
const clay = rgb('8f5140');
const white = rgb('d1cbb9');
const glass = rgb('606861');
const shadow = rgb('474740');
const lead = rgb('58574e');
const surfaces = {
  wall: { slot: 'wall', graph: 'brick', roughness: 0.96 },
  base: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.94 },
  surround: { slot: 'trim', graph: 'stone_sandstone', roughness: 0.93 },
  roof: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.94 },
  lead: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.89 },
  sash: { slot: 'trim', graph: 'wood_plain', roughness: 0.88 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.49 },
};
const main = facade([6.991, -0.72], [0, -1]);
const frontage = 12.14;

function pane(out, f, u, y, w, h, lod, opts = {}) {
  opening(out, f, u, y, w, h, {
    glassSlot: 'glass',
    frameSlot: 'sash',
    glass: opts.tint ?? glass,
    frame: white,
    d: opts.depth ?? 0.038,
    head: opts.arc ? 'round' : 'flat',
    frameWidth: lod === 3 ? 0.073 : 0,
    frameDepth: 0.13,
    mullions: lod > 1 ? (opts.mullions ?? 1) : 0,
    transoms: lod > 1 ? (opts.transoms ?? 2) : 0,
    sill: lod === 3,
  });
}
function run(out, f, u0, u1, y, h, depth, color = lightSand) {
  fbox(out, 'surround', f, u0, u1, y, y + h, -0.022, depth, color);
}
function roof(out) {
  const west = [-6.45, eave - 0.13],
    east = [7.24, eave - 0.15],
    crest = [0.21, ridge];
  const frontZ = -12.91,
    backZ = 11.68;
  const p = ([x, y], z) => [x, y, z];
  quad4(out, 'roof', p(west, frontZ), p(west, backZ), p(crest, backZ), p(crest, frontZ), clay);
  quad4(out, 'roof', p(crest, frontZ), p(crest, backZ), p(east, backZ), p(east, frontZ), clay);
  tri(out, 'wall', p(east, frontZ), p(west, frontZ), p(crest, frontZ), shadeBrick);
  tri(out, 'wall', p(west, backZ), p(east, backZ), p(crest, backZ), brick);
  abox(out, 'wall', [-3.89, eave - 0.22, 2.56], [-2.65, ridge - 0.21, 3.66], brick, {
    bottom: false,
  });
  abox(out, 'wall', [-0.22, ridge - 1.02, -7.86], [0.81, ridge + 0.27, -6.73], brick, {
    bottom: false,
  });
}

const silhouette = [
  [0, 1],
  [0.15, 1],
  [0.18, 0.93],
  [0.23, 0.84],
  [0.31, 0.81],
  [0.34, 0.73],
  [0.41, 0.75],
  [0.46, 0.63],
  [0.52, 0.52],
  [0.56, 0.57],
  [0.62, 0.5],
  [0.69, 0.38],
  [0.74, 0.34],
  [0.79, 0.25],
  [0.86, 0.28],
  [0.91, 0.17],
  [0.96, 0.11],
  [1, 0.052],
];

function scrollGable(out, f, u, y, height, half, depth, lod, doorWindow = true) {
  const rows =
    lod === 0
      ? silhouette.filter((_, i) => i % 3 === 0 || i === silhouette.length - 1)
      : silhouette;
  const v = ([t, w], side, d) => f.P(u + side * w * half, y + t * height, d);
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1],
      b = rows[i];
    quad4(out, 'wall', v(a, -1, 0.095), v(a, 1, 0.095), v(b, 1, 0.095), v(b, -1, 0.095), brick);
    for (const sign of [-1, 1]) {
      const corners = [v(a, sign, 0.095), v(b, sign, 0.095), v(b, sign, -0.36), v(a, sign, -0.36)];
      if (sign > 0) corners.reverse();
      quad4(out, 'wall', ...corners, shadeBrick);
    }
  }
  for (const sign of [-1, 1]) {
    const edge = rows.map((row) => v(row, sign, 0.163));
    beamPath(out, 'surround', edge, lod === 0 ? 0.115 : 0.092, lod === 0 ? 0.105 : 0.128, false);
  }
  if (doorWindow) {
    const nearRidge = f.P(u, y + height * 0.91, -0.35);
    const farRidge = f.P(u, ridge - 0.13, -depth);
    for (const sign of [-1, 1]) {
      const side = [
        f.P(u + sign * half * 0.82, y + height * 0.19, -0.35),
        f.P(u + sign * half * 0.54, ridge - 1.37, -depth),
        farRidge,
        nearRidge,
      ];
      if (sign < 0) side.reverse();
      quad4(out, 'roof', ...side, clay);
    }
  }
  if (lod === 0) return;
  for (const t of [0.17, 0.41, 0.65, 0.84]) {
    const width = half * (1.04 - t);
    fbox(
      out,
      'surround',
      f,
      u - width,
      u + width,
      y + t * height,
      y + t * height + 0.068,
      0.105,
      0.215,
      ornament,
    );
  }
  if (doorWindow) {
    for (const sign of [-1, 1])
      pane(out, f, u + sign * half * 0.39, y + 0.08, half * 0.39, height * 0.285, lod, {
        arc: true,
        depth: 0.12,
        tint: shadow,
        mullions: 0,
      });
  }
  if (lod < 2) return;
  for (const sign of [-1, 1]) {
    for (const [up, w] of [
      [0.32, 0.59],
      [0.55, 0.33],
      [0.72, 0.21],
    ]) {
      const path = Array.from({ length: lod === 3 ? 9 : 6 }, (_, i) => {
        const p = i / (lod === 3 ? 8 : 5);
        const a = (p * 1.48 + 0.11) * Math.PI;
        const r = (1 - p * 0.63) * w * half * 0.6;
        return f.P(
          u + sign * (half * w * 0.68 + r * Math.cos(a)),
          y + up * height + r * 0.37 * Math.sin(a),
          0.168,
        );
      });
      beamPath(out, 'surround', path, 0.065, 0.078, false);
    }
  }
}

function masonry(out, lod) {
  extrude(out, 'base', outline, foundation, plinth, base, { top: false });
  extrude(out, 'wall', outline, plinth - 0.018, eave, brick, { top: false });
  const deck = earcut(outline.flat(), [], 2);
  const p = (i) => [outline[i][0], eave - 0.013, outline[i][1]];
  for (let i = 0; i < deck.length; i += 3)
    tri(out, 'roof', p(deck[i]), p(deck[i + 2]), p(deck[i + 1]), clay);
  roof(out);
  for (const [u, rise, half] of [
    [-8.16, outerGable, 2.69],
    [0.01, centralGable, 3.48],
    [8.04, outerGable, 2.79],
  ]) {
    scrollGable(out, main, u, eave - 0.64, rise - eave + 0.64, half, 5.62, lod);
  }
  for (const [i, a] of outline.entries()) {
    const wall = wallFace(a, outline[(i + 1) % outline.length]);
    if (wall.length < 9.0 || Math.abs(wall.normal[1]) < 0.86) continue;
    const mid = wall.P(wall.length / 2, 0);
    const side = facade([mid[0], mid[2]], wall.along);
    scrollGable(
      out,
      side,
      0,
      eave - 0.16,
      ridge - eave + 0.7,
      wall.length * 0.48,
      0.36,
      lod,
      false,
    );
    if (lod > 0) {
      for (const u of [-3.56, 0, 3.36]) {
        pane(out, side, u, 4.41, 0.95, 2.36, lod);
        pane(out, side, u, 8.41, 0.87, 2.1, lod);
        pane(out, side, u, 11.02, 0.79, 1.73, lod, { arc: true, mullions: 0 });
      }
    }
  }
}

function streetFront(out, lod) {
  run(out, main, -frontage, frontage, eave - 0.26, 0.32, 0.179, ornament);
  run(out, main, -frontage, frontage, plinth - 0.18, 0.18, 0.125, base);
  if (lod === 0) return;
  for (const y of [3.95, 7.66, 10.77, 12.87])
    run(out, main, -frontage, frontage, y, 0.136, 0.115, ornament);
  const groups = [-9.02, -5.84, -2.55, 1.59, 5.11, 8.29, 10.71];
  for (let i = 0; i < groups.length; i++) {
    const u = groups[i];
    for (const [y, h, w] of [
      [4.3, 2.55, 0.74],
      [8.29, 1.72, 0.69],
      [11.19, 1.25, 0.54],
    ]) {
      for (const side of [-1, 1]) {
        const x = u + side * (w / 2 + 0.115);
        pane(out, main, x, y, w, h, lod, { arc: y > 10.8, mullions: 1, transoms: 2 });
      }
      if (lod > 1) {
        const lip = w + 0.31;
        run(out, main, u - lip, u + lip, y + h + 0.13, 0.14, 0.174, ornament);
        const at = (x, z) => main.P(u + x, y + h + z, 0.162);
        tri(out, 'surround', at(-0.48, 0.27), at(0.48, 0.27), at(0, 0.62), ornament);
      }
    }
    if (i < 2 || i > 3) pane(out, main, u, 0.79, 1.34, 2.53, lod, { tint: shadow, transoms: 3 });
  }
  const entrance = -1.56;
  pane(out, main, entrance, 0.29, 1.54, 3.29, lod, { arc: true, tint: shadow, mullions: 0 });
  for (const s of [-1, 1]) {
    const u = entrance + s * 1.02;
    fbox(out, 'surround', main, u - 0.19, u + 0.19, 0.29, 3.62, 0.02, 0.276, ornament);
  }
  run(out, main, entrance - 1.22, entrance + 1.22, 3.63, 0.27, 0.22, ornament);
  if (lod < 2) return;
  for (let i = 0; i < 11; i++) {
    const u = -11.28 + i * 2.21;
    for (const y of [7.16, 10.32, 12.54]) {
      const p = (x, z) => main.P(u + x, y + z, 0.123);
      quad4(out, 'surround', p(-0.17, 0), p(0, -0.145), p(0.17, 0), p(0, 0.151), base);
    }
  }
}

function bay(out, lod) {
  const centerU = 0.86;
  const centerDepth = 0.79;
  const ring = (y, r) =>
    Array.from({ length: 8 }, (_, i) => {
      const a = (-Math.PI * 2 * i) / 8;
      return main.P(centerU + Math.cos(a) * r, y, centerDepth + Math.sin(a) * r);
    });
  loft(out, 'surround', [ring(0.21, 1.36), ring(0.99, 1.52), ring(3.88, 1.52)], white, {
    cap: false,
  });
  loft(
    out,
    'lead',
    [
      [3.85, 1.63],
      [4.2, 1.55],
      [4.48, 1.22],
      [4.95, 0.74],
      [5.44, 0.63],
      [5.74, 0.37],
      [5.93, 0.14],
    ].map(([y, r]) => ring(y, r)),
    lead,
    { cap: true },
  );
  if (lod < 1) return;
  const windows = ring(2, 1.52);
  for (let i = 0; i < windows.length; i++) {
    const a = windows[i],
      b = windows[(i + 1) % windows.length];
    const f = wallFace([a[0], a[2]], [b[0], b[2]]);
    if (f.normal[0] < -0.1) continue;
    pane(out, f, f.length / 2, 1.68, f.length * 0.75, 1.71, lod, {
      mullions: 1,
      transoms: 2,
      tint: shadow,
    });
    run(out, f, 0.025, f.length - 0.025, 3.58, 0.15, 0.095, white);
  }
}

function build(out, lod) {
  masonry(out, lod);
  streetFront(out, lod);
  bay(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'jens-bang-s-house-model.mjs';
const camera = [38, 12, 33];
const lookAt = [1, 9, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'historic',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The four-storey Jens Bangs Stenhus in Aalborg with ornate brick gables, pale sandstone and a projecting window bay.',
  camera,
  lookAt,
  sunDirection: [51, 61, -22],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.92,
    basis: 'The native frontage and named outline of Jens Bangs Stenhus.',
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
    { name: 'osteragade-street-frontage', position: camera, lookAt },
    { name: 'three-shaped-dormer-gables', position: [29, 17, -4], lookAt: [7, 14, 0] },
    { name: 'projecting-bay-and-stone-portal', position: [20, 5, 12], lookAt: [7.1, 4.2, -1.1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'jens-bang-s-house-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.96,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.15, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.057, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

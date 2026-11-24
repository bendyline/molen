import fs from 'node:fs';
import {
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  opening,
  quad4,
  rgb,
  ribbon,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const d = plan.dimensions;
const p = d.portico;
const c = {
  limestone: rgb('c8ba9b'),
  light: rgb('ded1b5'),
  cornice: rgb('d0c3aa'),
  base: rgb('b0a28b'),
  roof: rgb('777b76'),
  roofEdge: rgb('87908a'),
  recess: rgb('3f4140'),
  bronze: rgb('656153'),
};
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91 },
  trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.85 },
  base: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.94 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.78 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.8 },
};
const box = (o, slot, x0, x1, y0, y1, z0, z1, color) =>
  abox(o, slot, [x0, y0, z0], [x1, y1, z1], color);

function closedRoof(out, ring, y) {
  const faces = earcut(ring.flat());
  for (let i = 0; i < faces.length; i += 3) {
    const [a, b, d] = faces.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]);
    tri(out, 'roof', a, d, b, c.roof);
  }
}
function wallMass(out, points, low, top) {
  extrude(out, 'wall', points, low, top, c.limestone, { top: false });
  closedRoof(out, points, top - 0.015);
  ribbon(out, 'trim', points, top - 0.54, top + 0.02, c.cornice, {
    offset: 0.15,
    inset: 0.015,
    minLength: 0.35,
  });
}
function clipAtFront(points, limit) {
  const ring = points.map(([x, z]) => [x, Math.min(z, limit)]);
  return ring.filter(
    ([x, z], i) => Math.hypot(x - ring.at(i - 1)[0], z - ring.at(i - 1)[1]) > 0.02,
  );
}

function wings(out, lod) {
  const outline = frame.geometry.outline;
  const main = clipAtFront(outline, p.front - p.depth);
  wallMass(out, main, d.basement, d.galleryTop);
  if (lod > 0)
    ribbon(out, 'base', main, 1.7, 2.06, c.base, { offset: 0.08, inset: 0.018, minLength: 0.45 });
  // The central limestone block is taller than the long roofs of the later wings.
  const historic = [
    [-26.7, -7.3],
    [32.25, -7.3],
    [32.25, 28.5],
    [19.4, 28.5],
    [19.4, 30.82],
    [-12.9, 30.82],
    [-12.9, 28.5],
    [-26.7, 28.5],
  ];
  wallMass(out, historic, 11.95, d.historicTop);
  const roofRooms = [
    [-45, -16, -39, -13],
    [-11, 26, -42, -14],
    [28, 58, -40, -15],
    [65, 78, -27, -6],
  ];
  for (const [x0, x1, z0, z1] of roofRooms) {
    box(out, 'roof', x0, x1, 12.04, 12.65, z0, z1, c.roofEdge);
    if (lod > 1) {
      const mx = (x0 + x1) / 2,
        mz = (z0 + z1) / 2;
      box(out, 'roof', mx - 3.8, mx + 3.8, 12.64, d.backTop - 0.41, mz - 2.1, mz + 2.1, c.roof);
    }
  }

  if (lod === 0) return;
  const lowerFront = facade([0, 28.84], [1, 0]);
  for (const x of [-15.8, 21.1, 25.7, 30.1]) {
    opening(out, lowerFront, x, 0.54, 1.37, 1.38, {
      head: 'round',
      glassSlot: 'dark',
      glass: c.recess,
      frameSlot: 'trim',
      frame: c.base,
      frameWidth: lod > 1 ? 0.09 : 0,
      frameDepth: 0.08,
      d: 0.05,
      sill: false,
    });
  }
  // Recesses, cornices and vertical joints read from the street without turning
  // blank gallery walls into speculative rows of windows.
  for (const [x0, x1, z] of [
    [-19.8, -13.08, 28.84],
    [19.69, 32.51, 28.82],
  ]) {
    const F = facade([0, z], [1, 0]);
    fbox(out, 'trim', F, x0, x1, 10.51, 10.83, 0.006, 0.15, c.cornice);
    if (lod >= 2) {
      for (const x of [x0 + 0.17, x1 - 0.36])
        fbox(out, 'trim', F, x, x + 0.21, 2.09, 11.89, 0.01, 0.12, c.light);
    }
  }
  if (lod === 3) {
    for (const [x0, x1, z0, z1] of roofRooms) {
      for (let x = x0 + 2.0; x < x1 - 1.0; x += 2) {
        box(out, 'roof', x, x + 0.045, 12.65, 12.7, z0, z1, c.roof);
      }
    }
  }
}

function columns(out, lod) {
  const F = facade([p.centerX, p.front], [1, 0]);
  const left = -p.width / 2,
    right = p.width / 2,
    back = -p.depth;
  fbox(out, 'base', F, left, right, -1.0, p.floor - 0.18, back, 0.63, c.base);
  fbox(
    out,
    'trim',
    F,
    left - 0.23,
    right + 0.23,
    p.floor - 0.19,
    p.floor + 0.12,
    back + 0.06,
    0.57,
    c.light,
  );
  const intervals = [
    { start: 0.35, end: 4.9, bottom: 3.36, top: p.floor - 0.08, count: 6 },
    { start: 5.45, end: 9.65, bottom: 1.82, top: 3.36, count: 8 },
    { start: 10.6, end: 15.1, bottom: 0.11, top: 1.82, count: 8 },
  ];
  const width = lod === 0 ? p.width + 2.2 : p.width + 3.65;
  for (const { start, end, bottom, top, count } of intervals) {
    const n = lod === 0 ? 2 : lod === 1 ? 4 : count;
    for (let i = 0; i < n; i++) {
      const inner = start + ((end - start) * i) / n;
      const outer = start + ((end - start) * (i + 1)) / n;
      const term = top - ((top - bottom) * i) / n;
      fbox(
        out,
        'base',
        F,
        -width / 2,
        right + (width - p.width) / 2,
        -1.2,
        term,
        inner,
        outer,
        c.base,
      );
    }
  }
  for (const [inner, outer, y] of [
    [4.9, 5.45, 3.36],
    [9.65, 10.6, 1.82],
  ]) {
    fbox(out, 'base', F, -width / 2, width / 2, -1.2, y, inner, outer, c.base);
  }
  const stoneSides = [6, 12, 16, 24][lod];
  for (let i = 0; i < 6; i++) {
    const local = -6.72 + i * (13.44 / 5),
      x = p.centerX + local,
      z = p.front - 0.96;
    const shaft = p.floor + p.columnHeight;
    const levels = [
      [p.floor + 0.05, 0.54],
      [p.floor + 0.24, 0.52],
      [p.floor + 0.47, 0.39],
      [p.floor + 1.05, 0.43],
      [shaft - 0.65, 0.355],
      [shaft - 0.34, 0.43],
      [shaft - 0.16, 0.49],
    ];
    loft(
      out,
      'trim',
      (lod === 0 ? [levels[0], levels.at(-1)] : levels).map(([y, r]) =>
        radialRing(y, r, r, stoneSides, [x, z]),
      ),
      c.light,
      { cap: false },
    );
    fbox(
      out,
      'trim',
      F,
      local - 0.57,
      local + 0.57,
      shaft - 0.16,
      shaft + 0.08,
      -1.45,
      -0.48,
      c.light,
    );
    if (lod > 1) {
      for (const sign of [-1, 1])
        sphere(
          out,
          'trim',
          [x + sign * 0.41, shaft - 0.16, z + 0.35],
          [0.19, 0.19, 0.13],
          c.cornice,
          8,
          4,
        );
    }
  }
  fbox(
    out,
    'wall',
    F,
    left - 0.08,
    right + 0.08,
    p.floor - 0.02,
    p.cornice,
    back - 0.75,
    back - 0.04,
    c.limestone,
  );
  const entrance = facade([p.centerX, p.front + back], [1, 0]);
  for (const u of [-5.75, 0, 5.75]) {
    opening(out, entrance, u, p.floor + 0.16, u === 0 ? 2.8 : 1.4, u === 0 ? 4.98 : 3.47, {
      glassSlot: 'dark',
      glass: c.recess,
      frameSlot: 'trim',
      frame: c.light,
      frameWidth: lod > 1 ? 0.19 : 0,
      frameDepth: 0.11,
      head: 'round',
      sill: false,
      mullions: lod > 1 && u === 0 ? 1 : 0,
      d: 0.022,
    });
  }
  for (const [low, high, extra] of [
    [p.floor + p.columnHeight, p.cornice - 0.31, 0.14],
    [p.cornice - 0.31, p.cornice, 0.32],
  ]) {
    fbox(out, 'trim', F, left - extra, right + extra, low, high, back - 0.2, extra, c.cornice);
  }
  const peak = p.roofPeak,
    edge = p.cornice,
    a = left - 0.27,
    b = right + 0.27;
  fan(out, 'wall', [F.P(a, edge, 0.27), F.P(b, edge, 0.27), F.P(0, peak, 0.27)], c.limestone);
  const ridgeBack = F.P(0, peak, back - 0.33),
    ridgeFront = F.P(0, peak, 0.37);
  quad4(out, 'roof', F.P(a, edge, 0.37), ridgeFront, ridgeBack, F.P(a, edge, back - 0.33), c.roof);
  quad4(out, 'roof', ridgeFront, F.P(b, edge, 0.37), F.P(b, edge, back - 0.33), ridgeBack, c.roof);
  if (lod > 1) {
    for (const [u, side] of [
      [a, 1],
      [b, -1],
    ]) {
      const n = [
        F.P(u, edge + 0.02, 0.42),
        F.P(0, peak + 0.15, 0.42),
        F.P(0, peak - 0.11, 0.42),
        F.P(u + side * 0.21, edge - 0.14, 0.42),
      ];
      fan(out, 'trim', side === 1 ? n.slice().reverse() : n, c.light);
    }
    sphere(
      out,
      'trim',
      [p.centerX, p.cornice + 1.1, p.front + 0.35],
      [1.18, 0.47, 0.1],
      c.light,
      12,
      5,
    );
  }
}

function build(out, lod) {
  wings(out, lod);
  columns(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [112, 65, 126],
  lookAt = [-11, 7, -3],
  recipe = 'baltimore-museum-of-art-model.mjs';
const levels = { district: 0.8, street: 0.22, closeup: 0.085 };
export const model = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  category: 'museum',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'John Russell Pope’s six-column limestone museum entrance above the terraced stairs, with the mapped galleries and later wings.',
  camera,
  lookAt,
  sunDirection: [43, 65, 80],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'Suppress only the mapped contiguous museum building.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'historic-portico-and-terrace', position: [40, 17, 97], lookAt: [2.9, 7.7, 30.5] },
    { name: 'western-wing-and-historic-front', position: [-98, 26, 115], lookAt: [-18, 7.2, 5] },
    { name: 'northern-and-eastern-wings', position: [98, 44, -109], lookAt: [8, 8, -16] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'baltimore-museum-' + reviewLod,
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
    authoredLevels: Object.fromEntries(
      Object.entries(levels).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

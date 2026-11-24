import fs from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  abox,
  extrude,
  facade,
  fan,
  fbox,
  gableRoof,
  opening,
  quad4,
  rgb,
  ribbon,
  tri,
  wallFace,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const d = plan.dimensions;
const c = {
  stone: rgb('8a7e68'),
  band: rgb('b9a37d'),
  base: rgb('8a8275'),
  dress: rgb('cbb487'),
  slate: rgb('674e43'),
  void: rgb('373d38'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone_raw', roughness: 0.93 },
  dress: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.9 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.83 },
};
const block = (out, slot, x0, x1, y0, y1, z0, z1, color) =>
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color);
const xzRoof = (out, a, b, width, low, high) =>
  gableRoof(out, 'tile', a, b, width, low, high, c.slate, {
    endSlot: 'dress',
    endColor: c.band,
    overhang: 0.22,
  });
function body(out, ring, low, high) {
  extrude(out, 'stone', ring, low, high, c.stone, { top: false });
  const stoneColor = c.stone;
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices
      .slice(i, i + 3)
      .map((index) => [ring[index][0], high, ring[index][1]]);
    tri(out, 'stone', a, c, b, stoneColor);
  }
}
function gothic(out, F, u, bottom, width, height, lod, mullions = 1) {
  opening(out, F, u, bottom, width, height, {
    head: 'pointed',
    glassSlot: 'dark',
    frameSlot: 'dress',
    glass: c.void,
    frame: c.dress,
    frameWidth: lod > 1 ? 0.14 : 0,
    frameDepth: 0.12,
    sill: lod > 1,
    mullions: lod > 1 ? mullions : 0,
    d: 0.045,
  });
}
function crossAt(out, x, y, z, size) {
  block(out, 'dress', x - 0.09, x + 0.09, y, y + size, z - 0.09, z + 0.09, c.dress);
  block(
    out,
    'dress',
    x - 0.07,
    x + 0.07,
    y + size * 0.54,
    y + size * 0.7,
    z - size * 0.25,
    z + size * 0.25,
    c.dress,
  );
}

function roofAisles(out, sign, zOuter, west, east) {
  const inner = sign * d.nave.halfWidth;
  const a = [west, d.aisle.eave, zOuter + sign * 0.17];
  const b = [east, d.aisle.eave, zOuter + sign * 0.17];
  const p = [west, 10.45, inner];
  const q = [east, 10.45, inner];
  if (sign > 0) {
    quad4(out, 'tile', a, b, q, p, c.slate);
    tri(out, 'stone', [west, d.aisle.eave, inner], a, p, c.stone);
    tri(out, 'stone', b, [east, d.aisle.eave, inner], q, c.stone);
  } else {
    quad4(out, 'tile', b, a, p, q, c.slate);
    tri(out, 'stone', a, [west, d.aisle.eave, inner], p, c.stone);
    tri(out, 'stone', [east, d.aisle.eave, inner], b, q, c.stone);
  }
}

function naveAndTransepts(out, lod) {
  const { nave, aisle, transepts } = d;
  const ring = frame.geometry.outline;
  body(out, ring, aisle.plinth, aisle.eave);
  ribbon(out, 'dress', ring, -0.31, 0.03, c.base, { offset: 0.055, minLength: 0.5, inset: 0 });
  block(
    out,
    'stone',
    nave.west,
    nave.east,
    aisle.eave - 0.08,
    nave.eave,
    -nave.halfWidth,
    nave.halfWidth,
    c.stone,
  );
  xzRoof(out, [nave.west, 0], [nave.east, 0], 2 * nave.halfWidth, nave.eave, nave.ridge);
  for (const [sign, outer] of [
    [-1, aisle.north],
    [1, aisle.south],
  ]) {
    roofAisles(out, sign, outer, nave.west, 10.18);
    const side = facade([0, outer], [sign, 0]);
    const high = facade([0, sign * nave.halfWidth], [sign, 0]);
    fbox(
      out,
      'dress',
      high,
      Math.min(sign * nave.west, sign * nave.east),
      Math.max(sign * nave.west, sign * nave.east),
      13.62,
      13.96,
      0.01,
      0.18,
      c.band,
    );
    if (lod > 0) {
      for (const x of [-10, -4.2, 1.1, 6.4]) gothic(out, high, x * sign, 11.05, 1.7, 2.27, lod);
      for (const x of [-6.25, -0.45, 5.85]) gothic(out, side, x * sign, 2.43, 2.25, 3.7, lod, 2);
    }
    const end = sign > 0 ? transepts.south : transepts.north;
    const transeptX = (transepts.west + transepts.east) / 2;
    block(
      out,
      'stone',
      transepts.west,
      transepts.east,
      aisle.eave - 0.15,
      transepts.eave,
      Math.min(end, 0),
      Math.max(end, 0),
      c.stone,
    );
    xzRoof(
      out,
      [transeptX, sign * 3.4],
      [transeptX, end],
      transepts.east - transepts.west,
      transepts.eave,
      transepts.ridge,
    );
    if (lod > 0) {
      const gable = facade([transeptX, end], [sign, 0]);
      gothic(out, gable, 0, 6.05, 3.5, 5.5, lod, 0);
      const petals = lod > 1 ? 12 : 8;
      const circle = Array.from({ length: petals }, (_, i) => {
        const a = (Math.PI * 2 * i) / petals;
        return gable.P(1.36 * Math.cos(a), 8.71 + 1.36 * Math.sin(a), 0.13);
      });
      fan(out, 'dress', circle, c.dress);
      const glazing = circle.map((p) => [
        transeptX + (p[0] - transeptX) * 0.82,
        8.71 + (p[1] - 8.71) * 0.82,
        p[2] + sign * 0.011,
      ]);
      fan(out, 'dark', glazing, c.void);
      if (lod === 3) {
        for (let i = 0; i < 8; i++) {
          const a = (Math.PI * i) / 4;
          beam(
            out,
            'dress',
            gable.P(0, 8.71, 0.155),
            gable.P(1.04 * Math.cos(a), 8.71 + 1.04 * Math.sin(a), 0.155),
            0.05,
            0.035,
            c.dress,
          );
        }
      }
      if (lod >= 2) crossAt(out, transeptX, transepts.ridge, end - 0.16 * sign, 0.73);
    }

    const porch = sign > 0 ? 12.88 : -13.48;
    const west = sign > 0 ? -14.73 : -14.48;
    const east = sign > 0 ? -10.34 : -10.08;
    const px = (west + east) / 2;
    xzRoof(out, [px, outer + 0.3 * sign], [px, porch], east - west, aisle.eave, 10.25);
    gothic(out, facade([px, porch], [sign, 0]), 0, -0.4, 1.6, 3.1, lod);
  }
  xzRoof(out, [-20.8, -7.4], [-15.7, -7.4], 4.46, aisle.eave, 10.45);
  if (lod > 0) gothic(out, facade([-20.84, -7.35], [0, 1]), 0, 2.1, 2.08, 4.3, lod, 2);
}

function apsidalEnd(out, lod) {
  const { chancel } = d;
  const apse = [
    [chancel.west, chancel.north],
    [16.2, chancel.north],
    [19.17, -4.77],
    [chancel.east, -1.72],
    [chancel.east, 0.86],
    [19.11, 3.75],
    [16.13, chancel.south],
    [chancel.west, chancel.south],
  ];
  body(out, apse, 6.7, chancel.eave);
  const z = (chancel.north + chancel.south) / 2;
  xzRoof(
    out,
    [chancel.west, z],
    [17.3, z],
    chancel.south - chancel.north,
    chancel.eave,
    chancel.ridge,
  );
  const top = [17.25, chancel.ridge, z];
  for (let i = 1; i < 6; i++) {
    const a = apse[i],
      b = apse[i + 1];
    tri(
      out,
      'tile',
      [b[0], chancel.eave + 0.05, b[1]],
      [a[0], chancel.eave + 0.05, a[1]],
      top,
      c.slate,
    );
    if (lod > 0) {
      const edge = wallFace(b, a);
      gothic(out, edge, edge.length / 2, 7.03, Math.min(1.42, edge.length * 0.6), 4.37, lod, 1);
    }
  }
  if (lod >= 2) crossAt(out, 17.25, chancel.ridge, z, 0.62);
}

function steeple(out, lod) {
  const { steeple: t, turret: s } = d;
  const mx = (t.west + t.east) / 2;
  const mz = (t.north + t.south) / 2;
  const w = t.east - t.west;
  const span = t.south - t.north;
  block(out, 'stone', t.west, t.east, -1.32, t.bellTop, t.north, t.south, c.stone);
  for (const y of [7.52, 12.6, 17.8, 23.86]) {
    block(
      out,
      'dress',
      t.west - 0.14,
      t.east + 0.14,
      y,
      y + 0.37,
      t.north - 0.14,
      t.south + 0.14,
      c.band,
    );
  }
  const faces = [
    { plane: facade([mx, t.north], [-1, 0]), half: w / 2 },
    { plane: facade([mx, t.south], [1, 0]), half: w / 2 },
    { plane: facade([t.east, mz], [0, -1]), half: span / 2 },
    { plane: facade([t.west, mz], [0, 1]), half: span / 2 },
  ];
  for (const { plane, half } of faces) {
    for (const u of [-1.38, 0, 1.38]) gothic(out, plane, u, 18.68, 1.1, 4.53, lod, 0);
    if (lod > 0) {
      for (const u of [-0.73, 0.73]) gothic(out, plane, u, 13.58, 0.56, 2.72, lod, 0);
      for (const u of [-half + 0.53, half - 0.53])
        fbox(out, 'dress', plane, u - 0.45, u + 0.45, -0.85, 17.85, 0.03, 0.29, c.band);
    }
    if (lod > 1) {
      for (const y of [19.36, 19.86, 20.36, 20.86])
        fbox(out, 'dark', plane, -1.89, 1.89, y, y + 0.065, 0.05, 0.12, c.void);
    }
  }
  gothic(out, facade([t.west, mz], [0, 1]), 0, 4.1, 2.61, 7.6, lod, 2);
  loft(
    out,
    'dress',
    [
      chamferedRectangle(mx, t.bellTop, mz, w + 0.1, span + 0.1, 0.16),
      chamferedRectangle(mx, 29.55, mz, 5.86, 5.87, 1.55),
      chamferedRectangle(mx, t.tip - 0.68, mz, 0.22, 0.23, 0.078),
    ],
    c.band,
    { cap: false },
  );
  loft(
    out,
    'dress',
    [
      radialRing(s.eave, s.radius, s.radius, 10, [s.x, s.z]),
      radialRing(s.tip, 0.085, 0.085, 10, [s.x, s.z]),
    ],
    c.band,
    { cap: false },
  );
  body(
    out,
    radialRing(0, s.radius, s.radius, 10, [s.x, s.z]).map(([x, , z]) => [x, z]),
    -1.45,
    s.eave + 0.021,
  );
  const points = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (const [y, reach, height] of [
    [29.6, 3.0, 3.35],
    [37.1, 2.06, 1.8],
  ]) {
    for (const [x, z] of points) {
      const F = facade([mx + x * reach, mz + z * reach], [z, -x]);
      const l = height * 0.3;
      fbox(out, 'dress', F, -l, l, y, y + height * 0.65, -0.46, 0.12, c.dress);
      tri(
        out,
        'dress',
        F.P(-l, y + height * 0.65, 0.13),
        F.P(l, y + height * 0.65, 0.13),
        F.P(0, y + height, 0.13),
        c.dress,
      );
      if (lod > 0) {
        const face = facade([mx + x * (reach + 0.135), mz + z * (reach + 0.135)], [z, -x]);
        gothic(out, face, 0, y + 0.12, l * 1.02, height * 0.52, lod, 0);
      }
    }
  }
  crossAt(out, mx, t.tip - 0.69, mz, 0.69);
}

function build(out, lod) {
  naveAndTransepts(out, lod);
  apsidalEnd(out, lod);
  steeple(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const camera = [-85, 46, 82],
  lookAt = [-2, 17.8, 0];
const recipe = 'all-saints-church-nottingham-model.mjs';
const levels = { district: 0.58, street: 0.2, closeup: 0.08 };
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'church',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Raleigh Street’s polychrome Gothic Revival church, with an octagonal broach spire, clerestoried nave and apsidal chancel.',
  camera,
  lookAt,
  sunDirection: [-16, 23, 12],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.92,
    basis: 'Only the named Grade II church footprint on the Raleigh Street site.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'west-tower-and-south-aisle', position: [-77, 25, 70], lookAt: [-8.5, 19.5, 0] },
    { name: 'east-apse-and-transepts', position: [68, 24, 52], lookAt: [4.0, 12.0, 0] },
    { name: 'north-aisle-and-steeple', position: [-43, 17, -76], lookAt: [-8.0, 20.0, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'all-saints-nottingham-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.24,
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

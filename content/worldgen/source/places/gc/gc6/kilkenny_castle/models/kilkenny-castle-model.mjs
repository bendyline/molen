import fs from 'node:fs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
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
  roundArch,
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
const { parts } = JSON.parse(
  fs.readFileSync(new URL('../native-map/kilkenny-castle-native-parts.json', import.meta.url)),
);
const { footing, floor, gate, foundationOutline } = plan.dimensions;
const stone = rgb('9a968a');
const granite = rgb('beb4a1');
const baseStone = rgb('8e887c');
const slate = rgb('565d58');
const glass = rgb('656d66');
const door = rgb('40382d');
const surfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95 },
  base: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.97 },
  dress: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.92 },
  slate: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.64 },
  door: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.9 },
};
function wallRoof(out, ring, y) {
  const tt = earcut(ring.flat());
  for (let i = 0; i < tt.length; i += 3) {
    const [a, b, c] = tt.slice(i, i + 3).map((index) => [ring[index][0], y, ring[index][1]]);
    tri(out, 'slate', a, c, b, slate);
  }
}
function shell(out, key, { low = floor, high, cap = true } = {}) {
  const { localOutline: ring, tags } = parts[key];
  const y = high ?? Number(tags.height);
  extrude(out, 'masonry', ring, low, y, stone, { top: false });
  if (cap) wallRoof(out, ring, y);
}
const roof = (out, a, b, w, foot, ridge) =>
  gableRoof(out, 'slate', a, b, w, foot, ridge, slate, {
    overhang: 0.12,
    endSlot: 'masonry',
    endColor: stone,
  });
function glazing(out, F, u, y, w, h, lod, { tudor = false, portal = false, mullions = 1 } = {}) {
  opening(out, F, u, y, w, h, {
    head: tudor ? 'tudor' : 'flat',
    glassSlot: portal ? 'door' : 'window',
    frameSlot: 'dress',
    glass: portal ? door : glass,
    frame: granite,
    d: 0.05,
    frameWidth: lod === 3 || (lod === 2 && !tudor) ? 0.12 : 0,
    frameDepth: 0.14,
    sill: !portal && lod > 1,
    mullions: lod > 1 ? mullions : 0,
    transoms: lod === 3 && !portal ? 1 : 0,
  });
}
function crenels(out, F, from, to, y, lod) {
  const n = Math.max(1, Math.round((to - from) / (lod < 2 ? 4.1 : 2.6)));
  const w = (to - from) / n;
  fbox(out, 'dress', F, from, to, y - 0.22, y + 0.12, -0.56, 0.17, granite);
  for (let i = 0; i < n; i++) {
    const u = from + i * w;
    fbox(out, 'masonry', F, u + w * 0.18, u + w * 0.73, y, y + 0.73, -0.61, 0.15, stone);
  }
  if (lod > 1) {
    for (let i = 0; i < 2 * n; i++) {
      const u = from + ((i + 0.5) * w) / 2;
      fbox(out, 'dress', F, u - 0.12, u + 0.12, y - 0.55, y - 0.16, -0.05, 0.2, baseStone);
    }
  }
}
function ornamentedFacade(
  out,
  a,
  b,
  eave,
  lod,
  { crenellated = true, tudor = true, tiers = [1.9, 5.1, 8.3] } = {},
) {
  const F = wallFace(a, b);
  if (crenellated) crenels(out, F, 0.18, F.length - 0.18, eave, lod);
  const n = Math.max(1, Math.round(F.length / (lod < 2 ? 6.8 : 4.65)));
  const bay = F.length / n;
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) * bay;
    for (const [j, y] of tiers.entries()) {
      if (lod < 2 && j > 1) continue;
      const w = j === 0 ? 1.64 : 1.52;
      glazing(out, F, u, y, w, j === 2 ? 1.24 : 2.22, lod, {
        tudor: tudor && j < 2,
        mullions: j === 0 ? 2 : 1,
      });
      if (lod > 1 && j === 0 && i % 3 === 1)
        fbox(out, 'dress', F, u - 1.01, u + 1.01, y - 0.11, y + 0.04, 0.01, 0.29, granite);
    }
  }
}
function gateHouse(out, lod) {
  const F = facade(gate.outer, gate.along);
  const spread = 3.13,
    depth = 7.54,
    half = gate.width / 2;
  fbox(out, 'masonry', F, -spread, -half, -0.3, 9.12, -depth, 0.14, stone);
  fbox(out, 'masonry', F, half, spread, -0.3, 9.12, -depth, 0.14, stone);
  const arch = roundArch(half, lod > 1 ? 12 : 6);
  for (let i = 0; i < arch.length - 1; i++) {
    const [x, y] = arch[i],
      [u, v] = arch[i + 1];
    const bottomA = gate.soffit - half + y,
      bottomB = gate.soffit - half + v;
    const corners = [
      [x, bottomA],
      [u, bottomB],
      [u, 9.11],
      [x, 9.11],
    ];
    quad4(out, 'dress', ...corners.map(([x, y]) => F.P(x, y, 0.15)), granite);
    quad4(
      out,
      'masonry',
      ...corners
        .slice()
        .reverse()
        .map(([x, y]) => F.P(x, y, -depth)),
      stone,
    );
    quad4(
      out,
      'dress',
      F.P(u, bottomB, 0.14),
      F.P(x, bottomA, 0.14),
      F.P(x, bottomA, -depth),
      F.P(u, bottomB, -depth),
      baseStone,
    );
    if (lod > 0)
      quad4(
        out,
        'dress',
        F.P(x, bottomA, 0.29),
        F.P(u, bottomB, 0.29),
        F.P(u, bottomB + 0.32, 0.29),
        F.P(x, bottomA + 0.32, 0.29),
        baseStone,
      );
  }
  for (const u of [-spread + 0.46, spread - 0.46]) {
    fbox(out, 'dress', F, u - 0.16, u + 0.16, 0.17, 9.18, 0.14, 0.44, granite);
    if (lod > 0)
      glazing(out, F, u - (u > 0 ? 0.62 : -0.62), 2.39, 0.62, 3.08, lod, {
        tudor: true,
        mullions: 0,
      });
  }
  for (const h of [7.44, 8.85, 9.22])
    fbox(out, 'dress', F, -3.34, 3.34, h, h + 0.26, -0.65, 0.44, granite);
  roof(out, [gate.outer[0] - 0.07, gate.outer[1] + 0.15], [-8.35, 26.37], 6.73, 9.46, gate.top);
  fbox(out, 'masonry', F, -4.83, -2.74, 0.01, 9.02, -7.3, 0.05, stone);
  fbox(out, 'masonry', F, 2.75, 4.31, 0.01, 9.02, -7.3, 0.05, stone);
  tri(out, 'dress', F.P(-3.16, 9.39, 0.42), F.P(3.16, 9.39, 0.42), F.P(0, 11.5, 0.42), granite);
  if (lod > 1) {
    for (const u of [-1, 1])
      beam(out, 'dress', F.P(u * 3.2, 9.49, 0.48), F.P(0, 11.57, 0.48), 0.12, 0.14, baseStone);
  }

  if (lod > 1) {
    fbox(out, 'dress', F, -0.68, 0.68, 5.65, 6.75, 0.17, 0.32, baseStone);
    for (const k of [-1, 1])
      beam(out, 'dress', F.P(0, 6.6, 0.37), F.P(k * 0.54, 6.05, 0.37), 0.09, 0.11, granite);
  }
}
function roundCastleTower(out, x, z, r, y, spire, lod, { full = true } = {}) {
  const n = lod === 0 ? 9 : lod === 1 ? 14 : lod === 2 ? 20 : 28;
  const center = [x, z];
  const ring = (h, rr) => radialRing(h, rr, rr, n, center);
  loft(out, 'base', [ring(footing, r + 0.2), ring(floor, r)], baseStone, { cap: false });
  loft(out, 'masonry', [ring(floor, r), ring(y - 0.63, r), ring(y - 0.35, r + 0.21)], stone, {
    cap: false,
  });
  const inner = ring(y - 0.27, r - 0.38);
  loft(out, 'dress', [ring(y - 0.36, r + 0.22), ring(y + 0.03, r + 0.26), inner], granite, {
    cap: false,
  });
  wallRoof(
    out,
    inner.map(([a, , b]) => [a, b]),
    y - 0.3,
  );
  const outer = ring(y + 0.01, r + 0.21)
    .map(([a, , b]) => [a, b])
    .reverse();
  for (let i = 0; i < n; i++) {
    const F = wallFace(outer[i], outer[(i + 1) % n]);
    if (lod === 0 && i % 2 === 0) continue;
    fbox(
      out,
      'masonry',
      F,
      F.length * 0.17,
      F.length * 0.79,
      y - 0.03,
      y + 0.78,
      -0.52,
      0.04,
      stone,
    );
    if (lod > 1 && i % 2 === 0)
      fbox(
        out,
        'dress',
        F,
        F.length * 0.27,
        F.length * 0.69,
        y - 0.8,
        y - 0.3,
        -0.3,
        -0.02,
        baseStone,
      );
  }
  if (full)
    loft(out, 'slate', [ring(y - 0.29, r * 0.74), ring(spire - 0.12, 0.19)], slate, { cap: false });
  if (lod > 0) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + Math.PI / 8;
      const C = Math.cos(a),
        S = Math.sin(a);
      const F = facade([x + C * r, z + S * r], [S, -C]);
      glazing(out, F, 0, y - 5.35, 1.19, 1.98, lod);
      if (full && lod > 1) glazing(out, F, 0, y - 9.02, 1.48, 2.23, lod, { mullions: 2 });
    }
  }
}
function turret(out, key, lod) {
  const { localOutline: ring, tags } = parts[key];
  const h = Number(tags.height);
  shell(out, key, { high: h });
  for (let i = 0; i < ring.length; i++) {
    const r = outwardRing(ring);
    const F = wallFace(r[i], r[(i + 1) % r.length]);
    if (F.length > 0.89)
      fbox(
        out,
        'masonry',
        F,
        F.length * 0.12,
        F.length * 0.66,
        h - 0.08,
        h + 0.71,
        -0.36,
        0.12,
        stone,
      );
    if (lod > 1 && F.length > 1.4)
      glazing(out, F, F.length / 2, h - 3.05, 0.43, 1.13, lod, { mullions: 0 });
  }
}
function towers(out, lod) {
  for (const [x, z, r, y, tip] of [
    [-25.12, -23.91, 6.73, 15.1, 19.5],
    [-33.26, 19.93, 5.73, 15.03, 19.4],
    [14.47, 43.92, 8.42, 12.19, 16.75],
  ])
    roundCastleTower(out, x, z, r, y, tip, lod);
  for (const key of [
    'north-small-turret',
    'parade-small-turret',
    'east-north-low-turret',
    'east-south-low-turret',
  ])
    if (lod > 0 || key === 'parade-small-turret') turret(out, key, lod);
}
function ranges(out, lod) {
  for (const key of ['north-range', 'west-range', 'parade-west', 'parade-east']) shell(out, key);
  shell(out, 'gate-body', { low: gate.soffit + 0.16, high: 9.0 });
  roof(out, [-25.4, -13.7], [-31.45, 13.77], 8.43, 11.91, 16.02);
  roof(out, [-15.38, -20], [33.82, -19.91], 8.55, 10.95, 14.61);
  roof(out, [-24.82, 19.33], [-15.42, 24.27], 7.46, 8.91, 12.72);
  roof(out, [-8.28, 27.9], [9.27, 36.43], 7.02, 8.91, 12.9);
  ornamentedFacade(out, [-29.0, -17.9], [-37.65, 16.03], 12.1, lod, { tiers: [0.78, 4.56, 8.62] });
  ornamentedFacade(out, [-21.68, 15.91], [-13.64, -14.13], 11.94, lod, {
    tiers: [0.78, 4.79, 8.62],
  });
  ornamentedFacade(out, [-13.27, -14.145], [34.36, -13.92], 10.98, lod, {
    tiers: [1.04, 4.37, 7.62],
  });
  ornamentedFacade(out, [23.9, -25.18], [-7.83, -25.06], 10.87, lod, { tiers: [0.85, 4.42, 7.67] });
  ornamentedFacade(out, [-28.18, 22.58], [-13.18, 29.91], 9.0, lod, {
    tiers: [2.75, 6.65],
    tudor: false,
  });
  ornamentedFacade(out, [-8.1, 32.36], [6.4, 39.41], 8.99, lod, {
    tiers: [2.75, 6.55],
    tudor: false,
  });
  ornamentedFacade(out, [8.7, 33.08], [-20.92, 16.43], 8.98, lod, { tiers: [0.95, 4.42] });
  gateHouse(out, lod);
  if (lod > 1) {
    for (const [x, z, y] of [
      [-27.09, -2.8, 15.5],
      [-34.18, 12.8, 13.86],
      [18.55, -22.1, 13.3],
      [-0.12, -22.45, 13.45],
      [26.85, -20.65, 14.32],
      [2.91, 33.24, 12.35],
    ]) {
      abox(out, 'masonry', [x - 0.34, y - 0.59, z - 0.43], [x + 0.34, y + 1.84, z + 0.43], stone);
      if (lod === 3)
        abox(out, 'dress', [x - 0.41, y + 1.75, z - 0.52], [x + 0.41, y + 1.98, z + 0.52], granite);
    }
  }
}
function build(out, lod) {
  extrude(out, 'base', foundationOutline, footing, 0.025, baseStone, { top: false });
  ranges(out, lod);
  towers(out, lod);
}
export function skyline(out) {
  const blocks = [
    {
      p: [
        [-27, -25],
        [-12, -24],
        [-22, 17],
        [-37, 19],
      ],
      h: 12.0,
      a: [-22, -21],
      b: [-30, 16],
      w: 11.6,
      t: 16,
    },
    {
      p: [
        [-25, -25],
        [39, -25],
        [39, -14],
        [-14, -14],
      ],
      h: 11,
      a: [-20, -20],
      b: [34, -20],
      w: 8.5,
      t: 14.3,
    },
    {
      p: [
        [-34, 18],
        [-12, 28],
        [-15, 33],
        [-35, 24],
      ],
      h: 9,
      a: [-30, 21],
      b: [-14, 28.6],
      w: 5.8,
      t: 12.1,
    },
    {
      p: [
        [-8, 28],
        [17, 38],
        [13, 46],
        [-10, 35],
      ],
      h: 9,
      a: [-9, 31],
      b: [11, 40],
      w: 7.5,
      t: 12.3,
    },
  ];
  for (const { p, h, a, b, w, t } of blocks) {
    extrude(out, 'masonry', p, footing, h, stone, { top: false });
    roof(out, a, b, w, h, t);
  }
  gateHouse(out, 0);
  for (const [x, z, r, y, h] of [
    [-25.12, -23.91, 6.73, 15.1, 19.5],
    [-33.26, 19.93, 5.73, 15.03, 19.4],
    [14.47, 43.92, 8.42, 12.19, 16.75],
  ]) {
    const ring = (level, rad) => radialRing(level, rad, rad, 8, [x, z]);
    loft(out, 'masonry', [ring(footing, r), ring(y, r)], stone, { cap: false });
    loft(out, 'slate', [ring(y, r), ring(h, 0.14)], slate, { cap: false });
    const rr = ring(0, r)
      .map(([x, , z]) => [x, z])
      .reverse();
    for (let i = 0; i < rr.length; i++) {
      const F = wallFace(rr[i], rr[(i + 1) % rr.length]);
      fbox(out, 'masonry', F, 0.1, F.length * 0.58, y - 0.14, y + 0.74, -0.26, 0.1, stone);
    }
  }
}
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'kilkenny-castle-model.mjs';
const camera = [63, 41, 103];
const lookAt = [-3, 7, 10];
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
    'Kilkenny Castle’s restored three-wing limestone exterior, circular towers, slate roofs, castellated parapets and Parade arch.',
  camera,
  lookAt,
  sunDirection: [-23, 47, 24],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.91,
    basis: 'The mapped standing three-wing castle. The courtyard opening remains open.',
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
    { name: 'the-parade-and-three-wing-plan', position: camera, lookAt },
    { name: 'moulded-parade-gateway', position: [-24, 11, 69], lookAt: [-9.8, 5.05, 29] },
    { name: 'riverside-range-and-round-towers', position: [-89, 32, -60], lookAt: [-17, 8, 1] },
    { name: 'open-courtyard-from-above', position: [66, 92, 48], lookAt: [-1, 2, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kilkenny-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.57,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.64, surfaces },
      street: { export: 'street', errorMeters: 0.25, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.075, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

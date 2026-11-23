import fs from 'node:fs';
import {
  abox,
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
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { outline } = frame.geometry;
const { foundation, stoneTop, towerHeight } = plan.dimensions;
const white = rgb('ddd9cd');
const trim = rgb('c8c6b7');
const tile = rgb('626a68');
const ridgeTile = rgb('737a76');
const timber = rgb('5b554a');
const recess = rgb('4a4b43');
const stone = rgb('807b70');
const surfaces = {
  wall: { slot: 'wall', graph: 'stucco', roughness: 0.92 },
  trim: { slot: 'trim', graph: 'wood_plain', roughness: 0.89 },
  window: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.79 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.91 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.94 },
  stone: { slot: 'foundation', graph: 'stone_drywall', roughness: 0.95 },
};
const cx = -0.44,
  cz = -2.87;
function box(out, slot, x, y, z, w, h, d, color, bottom = false) {
  abox(out, slot, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color, { bottom });
}
function podium(out, lod) {
  const ring = outwardRing(outline);
  const section = (y, s) => ring.map(([x, z]) => [(x - cx) * s + cx, y, (z - cz) * s + cz]);
  loft(
    out,
    'stone',
    [
      section(foundation, 1.145),
      section(stoneTop - 4.23, 1.11),
      section(stoneTop - 1.58, 1.035),
      section(stoneTop, 0.982),
    ],
    stone,
    { cap: false },
  );
  const data = earcut(ring.flat(), [], 2);
  const at = (id) => [cx + (ring[id][0] - cx) * 0.982, stoneTop, cz + (ring[id][1] - cz) * 0.982];
  for (let i = 0; i < data.length; i += 3)
    tri(out, 'stone', at(data[i]), at(data[i + 2]), at(data[i + 1]), stone);
  if (lod < 2) return;
  for (let i = 0; i < ring.length; i++) {
    const face = wallFace(ring[i], ring[(i + 1) % ring.length]);
    const count = Math.floor(face.length / 1.75);
    for (let j = 1; j < count; j++) {
      const u = (j * face.length) / count;
      fbox(
        out,
        'stone',
        face,
        u - 0.36,
        u + 0.39,
        stoneTop - 0.21,
        stoneTop - 0.054,
        -0.19,
        0.014,
        stone,
      );
    }
  }
}

function roofRing(x, z, y, w, d, lift) {
  const l = x - w / 2,
    r = x + w / 2,
    n = z - d / 2,
    s = z + d / 2;
  return [
    [l, y + lift, n],
    [l, y, z],
    [l, y + lift, s],
    [x, y, s],
    [r, y + lift, s],
    [r, y, z],
    [r, y + lift, n],
    [x, y, n],
  ];
}
function castleRoof(out, x, z, eave, w, d, rise, lod) {
  const shoulder = eave + rise * 0.54;
  const top = eave + rise;
  const upperW = w * 0.77,
    upperD = d * 0.5;
  const rim = roofRing(x, z, eave, w, d, 0.23);
  loft(
    out,
    'tile',
    [
      rim,
      roofRing(x, z, eave + rise * 0.2, w * 0.89, d * 0.77, 0.16),
      roofRing(x, z, shoulder, upperW, upperD, 0.063),
    ],
    tile,
    { cap: false },
  );
  gableRoof(
    out,
    'tile',
    [x - upperW / 2, z],
    [x + upperW / 2, z],
    upperD,
    shoulder + 0.025,
    top,
    tile,
    {
      overhang: 0.08,
      endSlot: 'wall',
      endColor: white,
    },
  );
  box(out, 'tile', x, top - 0.077, z, upperW + 0.3, 0.144, 0.22, ridgeTile);
  if (lod === 0) return;
  loft(
    out,
    'trim',
    [
      roofRing(x, z, eave - 0.12, w - 0.13, d - 0.13, 0.224),
      roofRing(x, z, eave, w - 0.1, d - 0.1, 0.23),
    ],
    trim,
    { cap: false },
  );
  if (lod < 2) return;
  const rafters = Math.floor(w / (lod === 3 ? 0.46 : 0.76));
  for (let j = 1; j < rafters; j++) {
    const u = x + (j / rafters - 0.5) * w * 0.96;
    for (const side of [-1, 1]) {
      box(out, 'trim', u, eave - 0.16, z + side * (d * 0.5 - 0.095), 0.09, 0.15, 0.18, trim);
      if (lod === 3 && Math.abs(u - x) < w * 0.41)
        beam(
          out,
          'tile',
          [u, eave + 0.036, z + side * d * 0.498],
          [x + (u - x) * 0.82, shoulder + 0.044, z + side * upperD * 0.49],
          0.052,
          0.043,
          ridgeTile,
        );
    }
  }
}
function plane(x, z, w, d) {
  return [
    [facade([x, z + d / 2], [1, 0]), w],
    [facade([x, z - d / 2], [-1, 0]), w],
    [facade([x + w / 2, z], [0, -1]), d],
    [facade([x - w / 2, z], [0, 1]), d],
  ];
}
function windows(out, x, z, bottom, w, d, level, lod) {
  if (lod === 0) return;
  for (const [F, span] of plane(x, z, w, d)) {
    const count = span > 11 ? 3 : span > 7 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) / count - 0.5) * span * 0.79;
      const width = Math.min(1.34, span / (count * 2.7));
      const y = bottom + (level === 3 ? 0.61 : 1.47);
      opening(out, F, u, y, width, level === 3 ? 1.19 : 1.03, {
        head: level === 3 ? 'round' : 'flat',
        glassSlot: 'window',
        frameSlot: 'timber',
        glass: recess,
        frame: timber,
        d: 0.028,
        frameWidth: lod === 3 ? 0.09 : 0,
        frameDepth: 0.12,
        sill: false,
      });
      if (lod > 1) {
        for (const q of [-0.23, 0, 0.23]) {
          fbox(
            out,
            'timber',
            F,
            u + q * width - 0.019,
            u + q * width + 0.019,
            y + 0.04,
            y + 0.87,
            0.038,
            0.065,
            timber,
          );
        }
      }
    }
    if (lod < 2 || level === 3) continue;
    for (const u of [-span * 0.37, span * 0.37]) {
      opening(out, F, u, bottom + 0.55, 0.18, 0.22, {
        glassSlot: 'window',
        glass: recess,
        frameWidth: 0,
        d: 0.018,
        sill: false,
      });
    }
  }
}
function balcony(out, x, z, y, w, d, lod) {
  box(out, 'trim', x, y - 0.12, z, w + 0.79, 0.23, d + 0.79, trim);
  if (lod === 0) return;
  for (const [F, span] of plane(x, z, w + 0.72, d + 0.72)) {
    const posts = Math.max(2, Math.round(span / (lod === 3 ? 0.54 : 0.9)));
    for (let i = 0; i <= posts; i++) {
      const u = (i / posts - 0.5) * span;
      fbox(out, 'timber', F, u - 0.038, u + 0.038, y + 0.08, y + 0.93, -0.027, 0.055, timber);
    }
    for (const at of [0.35, 0.61, 0.91])
      fbox(out, 'timber', F, -span / 2, span / 2, y + at - 0.06, y + at, 0.027, 0.072, timber);
  }
}
function mainTower(out, lod) {
  const tierOne = stoneTop + 4.01,
    tierTwo = stoneTop + 8.91,
    tierThree = stoneTop + 12.55;
  box(out, 'wall', cx, stoneTop - 0.05, cz, 16.23, 4.42, 11.47, white);
  windows(out, cx, cz, stoneTop, 16.23, 11.47, 1, lod);
  castleRoof(out, cx, cz, tierOne, 18.52, 13.62, 2.53, lod);
  box(out, 'wall', cx, tierOne + 0.82, cz, 12.27, 4.39, 8.65, white);
  windows(out, cx, cz, tierOne + 0.79, 12.27, 8.65, 2, lod);
  castleRoof(out, cx, cz, tierTwo, 14.38, 10.24, 2.16, lod);
  const gallery = tierTwo + 1.33;
  box(out, 'wall', cx, gallery - 0.34, cz, 8.72, 2.91, 5.78, white);
  windows(out, cx, cz, gallery, 8.72, 5.78, 3, lod);
  balcony(out, cx, cz, gallery, 8.72, 5.78, lod);
  castleRoof(out, cx, cz, tierThree, 10.85, 7.71, stoneTop + towerHeight - tierThree, lod);
  if (lod > 1) {
    for (const x of [cx - 4.33, cx + 4.33]) {
      const y = stoneTop + towerHeight - 0.03;
      beam(
        out,
        'tile',
        [x, y - 0.22, cz],
        [x + (x < cx ? -0.19 : 0.19), y + 0.22, cz],
        0.21,
        0.17,
        ridgeTile,
      );
    }
  }
}
function projection(out, lod) {
  const x = 5.26,
    z = 5.81;
  box(out, 'wall', x, stoneTop - 0.04, z, 5.55, 3.55, 8.5, white);
  windows(out, x, z, stoneTop, 5.55, 8.5, 1, lod);
  castleRoof(out, x, z, stoneTop + 3.29, 6.7, 9.39, 2.31, lod);
}
function build(out, lod) {
  podium(out, lod);
  mainTower(out, lod);
  projection(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'shiroishi-castle-model.mjs';
const camera = [51, 27, 49];
const lookAt = [0, 9, -1];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'heritage',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The timber keep of Shiroishi Castle with white plaster, tiered gray tile roofs, gallery and battered stone foundation.',
  camera,
  lookAt,
  sunDirection: [49, 62, 38],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.94,
    basis: 'Individually mapped Shiroishi Castle keep and attached projection.',
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
    { name: 'stone-batter-and-three-roofs', position: camera, lookAt },
    { name: 'white-facade-gray-eaves-and-gallery', position: [21, 11, 30], lookAt: [0, 11, 0] },
    { name: 'north-side-and-stacked-gables', position: [-39, 24, -33], lookAt: [0, 10, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'shiroishi-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.88,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.4, surfaces },
      street: { export: 'street', errorMeters: 0.14, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.057, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

/** The central gilded stupa and five gabled porches of Kaba Aye Pagoda. */
import { readFileSync } from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  transform,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const surface = {
  gold: { slot: 'roof', graph: 'metal_painted', roughness: 0.49, metallic: 0.47 },
  cream: { slot: 'wall', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  base: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.95, metallic: 0 },
  green: { slot: 'wall', graph: 'tile_glazed', roughness: 0.78, metallic: 0.04 },
  shade: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
};
const color = Object.fromEntries(
  Object.entries({
    gold: 'c6a049',
    bright: 'dec16a',
    dark: 'aa8034',
    cream: 'e1d8b9',
    maroon: '8b483f',
    leaf: '97a285',
    jade: '769682',
    stone: 'ada497',
    darkness: '514b38',
    roof: '5d7e72',
  }).map(([key, value]) => [key, rgb(value)]),
);
const { radius, height } = plan.section;
const add = (out, slot, x0, x1, y0, y1, z0, z1, tint) =>
  box(out, slot, [x0, y0, z0], [x1, y1, z1], tint);

function tower(out, lod) {
  const n = [13, 25, 40, 60][lod];
  const ring = (h, r) => radialRing(h, r, r, n);
  const band = (slot, rows, tint, cap = false) =>
    loft(
      out,
      slot,
      rows.map(([h, r]) => ring(h, r)),
      tint,
      { cap },
    );
  band(
    'base',
    [
      [-1.25, radius + 0.72],
      [0.37, radius + 0.72],
      [0.75, radius + 0.37],
      [1.05, radius + 0.22],
    ],
    color.stone,
    true,
  );
  band(
    'cream',
    [
      [1, radius],
      [8.48, radius],
      [9.42, radius - 0.45],
      [10.34, radius - 0.68],
    ],
    color.cream,
    true,
  );
  band(
    'gold',
    [
      [8.74, 16.55],
      [9.13, 16.77],
      [9.59, 16.77],
      [9.86, 16.37],
    ],
    color.dark,
  );
  band(
    'gold',
    [
      [9.65, 10.74],
      [11.32, 10.95],
      [12.4, 10.72],
      [14.4, 10.14],
      [16.47, 9.2],
      [18.11, 8.04],
      [20.2, 6.38],
      [22.21, 4.61],
      [24.05, 3.15],
      [25.29, 2.26],
      [27.11, 1.83],
      [29.13, 1.42],
      [30.34, 1.57],
      [31.18, 1.29],
      [32.0, 0.88],
      [33.08, 0.53],
      [height, 0.035],
    ].filter((_, i) => lod !== 0 || i % 2 === 0),
    color.gold,
    true,
  );
  const collars = [
    [11.66, 10.93],
    [14.18, 10.23],
    [16.81, 9],
    [19.89, 6.66],
    [21.61, 5.16],
    [22.82, 4.15],
    [23.89, 3.31],
    [25.21, 2.32],
    [26.36, 2],
    [28.11, 1.66],
    [30.29, 1.64],
    [31.1, 1.42],
    [31.63, 1.09],
  ];
  for (let i = 0; i < collars.length; i++) {
    if (lod === 0 && i !== 2) continue;
    if (lod === 1 && i % 2 === 0) continue;
    const [y, r] = collars[i];
    band(
      'gold',
      [
        [y - 0.13, r - 0.075],
        [y + 0.035, r + 0.115],
        [y + 0.15, r - 0.018],
      ],
      color.bright,
    );
  }
}

function arches(out, lod) {
  const groups = [5, 25, 30, 45][lod];
  const r = radius + 0.03;
  for (let i = 0; i < groups; i++) {
    const a = (Math.PI * 2 * i) / groups;
    const m = transform(out, a),
      wid = (((2 * Math.PI * radius) / groups) * 0.81) / 2;
    const points = [
      [-wid, 1.11],
      [-wid, 4.15],
      [-wid * 0.83, 4.92],
      [-wid * 0.53, 5.59],
      [0, 6.44],
      [wid * 0.53, 5.59],
      [wid * 0.83, 4.92],
      [wid, 4.15],
      [wid, 1.11],
    ];
    for (let j = 1; j < points.length - 1; j++)
      triangle(
        m,
        'shade',
        [
          [0, 1.115, r + 0.043],
          ...points.slice(j, j + 2).map(([x, y]) => [x, y, r + 0.043]),
        ].toReversed(),
        color.darkness,
      );
    const border = (slot, inner, outer, tint, depth) => {
      const p = ([x, y], scale) => [x * scale, 1.12 + (y - 1.12) * scale, r + depth];
      for (let j = 1; j < points.length; j++) {
        const a = points[j - 1],
          b = points[j];
        face(m, slot, [p(b, outer), p(a, outer), p(a, inner), p(b, inner)], tint);
      }
    };
    if (lod > 0) border('gold', 0.89, 1.045, color.dark, 0.16);
    if (lod > 0) border('green', 1.055, 1.14, color.leaf, 0.23);
    if (lod === 0) continue;
    const spike = (x, high) => {
      face(
        m,
        'gold',
        [
          [x - 0.135, 9.38, r - 0.04],
          [x + 0.135, 9.38, r - 0.04],
          [x + 0.11, high - 0.26, r - 0.04],
          [x - 0.11, high - 0.26, r - 0.04],
        ],
        color.dark,
      );
      triangle(
        m,
        'gold',
        [
          [x - 0.11, high - 0.26, r - 0.04],
          [x + 0.11, high - 0.26, r - 0.04],
          [x, high, r - 0.04],
        ],
        color.bright,
      );
    };
    for (const x of [-wid * 0.65, 0, wid * 0.65]) spike(x, x === 0 ? 10.85 : 10.53);
  }
}

function porch(out, lod) {
  const width = 3.74,
    low = 6.3,
    peak = 11.3,
    near = 16,
    front = 22.4;
  for (const side of [-1, 1]) {
    const x = side * 3.35;
    add(out, 'green', x - 0.41, x + 0.41, 0.73, low, front - 0.69, front + 0.12, color.jade);
    add(
      out,
      'gold',
      x - 0.52,
      x + 0.52,
      low - 0.66,
      low - 0.43,
      front - 0.8,
      front + 0.23,
      color.bright,
    );
  }
  add(out, 'base', -4.08, 4.08, -0.97, 0.79, 15.4, 22.6, color.stone);
  const n = lod === 0 ? 1 : 6;
  for (let i = 0; i < n; i++) {
    const z = 22.54 + i * 0.43;
    add(out, 'base', -3.63, 3.63, -0.84, 0.77 - (0.65 * (i + 1)) / n, z, z + 0.43, color.stone);
  }
  for (const side of [-1, 1]) {
    const x = side * (width + 0.4);
    const facePoints = [
      [0, peak, front + 0.36],
      [x, low, front + 0.36],
      [x, low, near],
      [0, peak, near],
    ];
    face(out, 'green', side > 0 ? facePoints : facePoints.toReversed(), color.roof);
  }
  const gable = (scale, depth, slot, tint) => {
    const y = low + (peak - low) * scale,
      x = width * scale,
      z = front + depth;
    triangle(
      out,
      slot,
      [
        [-x, low, z],
        [x, low, z],
        [0, y, z],
      ],
      tint,
    );
  };
  gable(1.13, 0.45, 'gold', color.gold);
  gable(0.96, 0.49, 'cream', color.maroon);
  gable(0.62, 0.54, 'gold', color.bright);
  gable(0.49, 0.58, 'cream', color.maroon);
  if (lod > 1) {
    for (const sign of [-1, 1])
      for (let i = 1; i < 9; i++) {
        const t = i / 9,
          x = sign * width * t,
          y = low + (peak - low) * (1 - t) + 0.27,
          z = front + 0.58;
        triangle(
          out,
          'gold',
          [
            [x - 0.11, y, z],
            [x + 0.11, y, z],
            [x, y + 0.53, z],
          ],
          color.bright,
        );
      }
  }
}
function build(out, lod) {
  tower(out, lod);
  arches(out, lod);
  for (let i = 0; i < 5; i++) porch(transform(out, 0.14 + (i * 2 * Math.PI) / 5), lod);
}
export const pagodaSkyline = (out) => build(out, 0);
export const pagodaDistrict = (out) => build(out, 1);
export const pagodaStreet = (out) => build(out, 2);
export const pagodaCloseup = (out) => build(out, 3);
const camera = [49, 39, 70],
  lookAt = [0, 12, 0],
  recipe = 'kaba-aye-pagoda-model.mjs';
export const pagodaModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'structure-mesh.mjs'],
  surfaces: surface,
  category: 'landmark',
  build: pagodaCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Kaba Aye’s gilded bell and spire rise over a circular prayer hall and five red-and-gold gabled porches.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: [-34, 53, 54],
  portableGroundY: -0.27,
  mediumFiContext: {
    scale: 1,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.86,
    basis: 'Reconstructed round hall within the mapped pagoda grounds.',
  },
  embeddedCanonicalGraphs: ['metal_painted', 'plaster_lime', 'stone_limestone', 'tile_glazed'],
  qaCameras: [
    { name: 'gilded-stupa-and-red-entrance', position: [-36, 13, 59], lookAt: [0, 14, 0] },
    { name: 'scalloped-arches-and-mosaic-columns', position: [22, 8, 45], lookAt: [7, 6.4, 17] },
    { name: 'porches-and-round-prayer-hall', position: [-39, 56, -40], lookAt: [0, 12, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `yangon-pagoda-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'pagodaSkyline',
    errorMeters: 0.69,
    surfaces: surface,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'pagodaDistrict', 0.32],
        ['street', 'pagodaStreet', 0.11],
        ['closeup', 'pagodaCloseup', 0.05],
      ].map(([level, name, errorMeters]) => [
        level,
        { export: name, errorMeters, surfaces: surface },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap map data is ODbL. C1815 released the exact Qualla exterior photo as CC0 own work.',
};

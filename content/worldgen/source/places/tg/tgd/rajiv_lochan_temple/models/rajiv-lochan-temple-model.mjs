/** The Rajiv Lochan Temple sanctuary and raised pillared hall, as photographed in 2005. */
import { readFileSync } from 'node:fs';
import {
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { transform } from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const [outline] = read('map-frame').geometry.polygons;
const axis = outline[1].map((v, i) => v - outline[2][i]);
const angle = Math.atan2(axis[1], axis[0]);
const c = Math.cos(angle),
  s = Math.sin(angle);
const at = (x, y, z) => [c * x - s * z, y, s * x + c * z];
const surfaces = {
  wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_limestone', roughness: 0.92, metallic: 0 },
  foundation: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96, metallic: 0 },
  grille: { slot: 'trim', graph: 'metal_painted', roughness: 0.7, metallic: 0.15 },
  recess: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.87, metallic: 0 },
};
const tone = {
  stone: rgb('c9bfaa'),
  plinth: rgb('aca28e'),
  skirt: rgb('9e927c'),
  lime: rgb('d9d2bf'),
  shade: rgb('bcb39e'),
  roof: rgb('b3aa97'),
  trim: rgb('e3dcca'),
  black: rgb('4f493f'),
  metal: rgb('b1af9c'),
  shrine: rgb('d0c8b6'),
  finial: rgb('8b8372'),
};
const p = plan.section;
const y = p.platformHeight;
const solid = (out, slot, [x0, x1, z0, z1], low, high, color) =>
  box(out, slot, [x0, low, z0], [x1, high, z1], color);
const rect = (x, z, rx, rz) => [x - rx, x + rx, z - rz, z + rz];
const ring = (x, z, r, y) => [
  [x - r, y, z - r],
  [x - r, y, z + r],
  [x + r, y, z + r],
  [x + r, y, z - r],
];
const profile = (out, slot, x, z, table, color) =>
  loft(
    out,
    slot,
    table.map(([h, r]) => ring(x, z, r, h)),
    color,
    { cap: false },
  );

function platform(out, lod) {
  const a = p.platformLength / 2,
    b = p.platformWidth / 2;
  solid(out, 'foundation', [-a, a, -b, b], -3.2, y - 0.22, tone.plinth);
  solid(out, 'foundation', [-a - 0.11, a + 0.11, -b - 0.11, b + 0.11], y - 0.26, y, tone.stone);
  if (lod) solid(out, 'wall', [-a - 0.05, a + 0.05, -b - 0.05, b + 0.05], 0.16, 0.45, tone.shade);
  for (const side of [-1, 1]) {
    const n = lod ? 9 : 5;
    for (let i = 0; i < n; i++) {
      const z = b + 0.22 + ((i + 0.5) * 3.05) / n;
      const r = rect(-6.9, side * z, 1.48, 3.09 / (n * 2));
      solid(out, 'foundation', r, -1.0, y - ((i + 1) * y) / n, tone.stone);
    }
  }
}

function tower(out, lod) {
  const x = 5.6,
    z = 0.6,
    r = p.sanctuaryWidth / 2,
    body = 6.35;
  solid(out, 'wall', rect(x, z, r, r), y, body, tone.lime);
  solid(out, 'roof', rect(x, z, r + 0.17, r + 0.17), y + 0.15, y + 0.52, tone.stone);
  profile(
    out,
    'wall',
    x,
    z,
    [
      [body - 0.51, r],
      [body - 0.24, r + 0.25],
      [body, r + 0.09],
    ],
    tone.trim,
  );
  let height = body;
  const curve = [r + 0.09, 2.87, 2.54, 2.15, 1.72];
  for (let k = 0; k < 4; k++) {
    const a = curve[k],
      b = curve[k + 1],
      top = height + 1.77 - k * 0.14;
    profile(
      out,
      'wall',
      x,
      z,
      [
        [height, a],
        [height + 0.31, a],
        [top - 0.18, b],
        [top, b + 0.09],
      ],
      k % 2 ? tone.shrine : tone.lime,
    );
    if (lod) {
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const w = 0.53 - k * 0.058;
          const px = x + sx * (b - w * 0.27),
            pz = z + sz * (b - w * 0.27);
          profile(
            out,
            'wall',
            px,
            pz,
            [
              [height + 0.03, w],
              [height + 0.29, w + 0.05],
              [top - 0.13, w * 0.63],
              [top + 0.09, w * 0.41],
            ],
            tone.trim,
          );
        }
    }
    if (lod > 1) {
      for (const side of [-1, 1]) {
        const skin = b + (a - b) * 0.48;
        for (const u of [-0.83, 0, 0.83]) {
          solid(
            out,
            'wall',
            rect(x + u, z + side * skin, 0.34, 0.09),
            height + 0.33,
            top - 0.22,
            tone.shade,
          );
          solid(
            out,
            'wall',
            rect(x + side * skin, z + u, 0.09, 0.34),
            height + 0.33,
            top - 0.22,
            tone.shade,
          );
        }
      }
    }
    height = top;
  }
  const n = [8, 16, 22, 30][lod];
  const dome = [
    [height - 0.03, 1.73],
    [height + 0.23, 1.84],
    [height + 0.46, 1.81],
    [height + 0.86, 1.65],
    [height + 1.26, 1.32],
    [height + 1.72, 0.8],
    [height + 2.05, 0.37],
  ];
  loft(
    out,
    'roof',
    dome.map(([h, r]) => radialRing(h, r, r, n, [x, z])),
    tone.lime,
  );
  loft(
    out,
    'roof',
    [
      [height + 1.99, 0.32],
      [height + 2.39, 0.28],
      [height + 2.58, 0.19],
      [p.mainTowerHeight, 0.037],
    ].map(([h, r]) => radialRing(h, r, r, n, [x, z])),
    tone.finial,
  );
}
function pier(out, x, z, bottom, top, lod) {
  const stone = (h, r) => ring(x, z, r, h);
  const row = [
    [bottom, 0.47],
    [bottom + 0.45, 0.45],
    [bottom + 0.62, 0.32],
    [top - 0.82, 0.33],
    [top - 0.57, 0.43],
    [top - 0.21, 0.48],
    [top, 0.48],
  ];
  loft(
    out,
    'wall',
    row.map(([h, r]) => stone(h, r)),
    tone.trim,
    { cap: false },
  );
  if (lod > 1)
    for (const h of [bottom + 1.0, bottom + 1.62, top - 1.06])
      solid(out, 'wall', rect(x, z, 0.372, 0.372), h, h + 0.11, tone.stone);
}
function hall(out, lod) {
  const roof = 7.06;
  solid(out, 'wall', [-7.94, 3.27, -3.37, 3.59], y, roof - 0.24, tone.lime);
  solid(out, 'recess', [-8.02, -7.93, -2.73, 2.78], y + 0.71, roof - 0.66, tone.black);
  solid(out, 'recess', [-7.51, -3.02, 3.59, 3.66], y + 0.58, roof - 0.71, tone.black);
  solid(out, 'wall', [-8.36, 3.54, -3.7, 3.89], roof - 0.39, roof, tone.trim);
  solid(out, 'roof', [-8.49, 3.64, -3.82, 4.01], roof, roof + 0.29, tone.roof);
  solid(out, 'wall', [-8.29, 3.43, -3.67, 3.83], roof + 0.27, roof + 0.63, tone.lime);
  for (const z of [-3.25, 3.31]) {
    pier(out, -7.88, z, y, roof - 0.32, lod);
    for (const x of [-7.88, -2.41, 2.88]) {
      profile(
        out,
        'wall',
        x,
        z,
        [
          [roof + 0.63, 0.55],
          [roof + 0.91, 0.52],
          [roof + 1.15, 0.38],
          [roof + 1.5, 0.28],
          [roof + 1.72, 0.068],
        ],
        tone.trim,
      );
    }
  }
  if (lod) {
    const n = lod === 1 ? 9 : lod === 2 ? 17 : 25;
    for (let i = 0; i <= n; i++) {
      const z = -2.72 + (5.48 * i) / n;
      solid(
        out,
        'grille',
        [-8.09, -8.045, z - 0.019, z + 0.019],
        y + 0.72,
        roof - 0.68,
        tone.metal,
      );
    }
    for (const h of [y + 1.39, y + 2.04, y + 2.67, roof - 0.9])
      solid(out, 'grille', [-8.1, -8.041, -2.74, 2.79], h, h + 0.032, tone.metal);
    for (const z of [-2.42, -1.49, -0.55, 0.4, 1.36, 2.31]) {
      solid(out, 'wall', [-8.42, -8.17, z - 0.13, z + 0.13], roof - 0.57, roof - 0.27, tone.shade);
    }
  }
}
function adjacentShrine(out, lod) {
  const x = -5.84,
    z = -5.46;
  solid(out, 'wall', rect(x, z, 2.45, 1.87), -0.78, 5.92, tone.shrine);
  solid(out, 'recess', [-8.33, -8.27, -6.06, -4.87], 0.26, 2.81, tone.black);
  for (const h of [2.8, 4.69, 5.53])
    solid(out, 'wall', rect(x, z, 2.54, 1.95), h, h + 0.18, tone.trim);
  const n = [8, 12, 16, 24][lod];
  const dome = (h, r) => radialRing(h, r * 2.36, r * 1.78, n, [x, z]);
  loft(
    out,
    'roof',
    [
      [5.76, 1],
      [6.13, 0.95],
      [6.58, 0.82],
      [6.94, 0.6],
      [7.23, 0.32],
      [7.34, 0.05],
    ].map(([h, r]) => dome(h, r)),
    tone.roof,
  );
}

function build(out, lod) {
  const m = transform(out, -angle);
  platform(m, lod);
  hall(m, lod);
  tower(m, lod);
  adjacentShrine(m, lod);
}
export const templeSkyline = (out) => build(out, 0);
export const templeDistrict = (out) => build(out, 1);
export const templeStreet = (out) => build(out, 2);
export const templeCloseup = (out) => build(out, 3);
const camera = at(-33, 24, 27),
  lookAt = at(0, 6.6, -0.72),
  recipe = 'rajiv-lochan-temple-model.mjs';
export const templeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'structure-mesh.mjs'],
  surfaces,
  category: 'landmark',
  build: templeCloseup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The pale Rajiv Lochan shrine, four-tiered tower and domed finial above a raised hall and paired side stairs.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: at(-24, 32, 20),
  portableGroundY: -0.18,
  mediumFiContext: {
    scale: 0.95,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.86,
    basis: 'Approximate mapped central Rajiv Lochan Temple roof.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'metal_painted'],
  qaCameras: [
    { name: 'raised-west-hall-and-grille', position: at(-25, 8.6, -16), lookAt: at(-4, 5.4, -0.8) },
    {
      name: 'tiered-sanctuary-tower-and-crown',
      position: at(18, 17, 14),
      lookAt: at(3.9, 10, 0.5),
    },
    { name: 'south-stair-and-platform', position: at(-16, 6.8, 20), lookAt: at(-6, 3.1, 2.9) },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `rajim-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'templeSkyline',
    errorMeters: 0.49,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'templeDistrict', 0.28],
        ['street', 'templeStreet', 0.09],
        ['closeup', 'templeCloseup', 0.04],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. Overture map controls follow their source terms. Paalappoo released the exact Qualla photo into the public domain.',
};

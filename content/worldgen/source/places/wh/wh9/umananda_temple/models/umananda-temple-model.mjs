/** The island sanctuary and entrance ensemble at Umananda Temple, July 2024. */
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

const read = (name) => JSON.parse(readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  S = plan.section,
  field = read('terrain-grid'),
  [outline] = read('map-frame').geometry.polygons;
const [pa, pb] = S.axis.map((i) => outline[i]),
  d = pb.map((n, i) => n - pa[i]),
  [c, s] = d.map((n) => n / Math.hypot(...d));
const at = (x, y, z) => [c * x - s * z, y, s * x + c * z];
const local = ([x, z]) => [c * x + s * z, -s * x + c * z];
const points = outline.map(local);
const up = [0, 1, 0];
const surfaces = {
  lime: { slot: 'wall', graph: 'plaster_lime', roughness: 0.93, metallic: 0 },
  masonry: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.96, metallic: 0 },
  slab: { slot: 'roof', graph: 'concrete_plain', roughness: 0.91, metallic: 0 },
  metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.85, metallic: 0.08 },
  inset: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.77, metallic: 0 },
};
const tone = Object.fromEntries(
  Object.entries({
    white: 'e0d8c3',
    shadowWhite: 'cfc6b1',
    plaster: 'bdad91',
    sand: 'b49576',
    stone: 'a39a82',
    roof: '99988e',
    trim: 'eee2c8',
    red: 'a95143',
    darkRed: '853f34',
    ochre: 'a5814d',
    dark: '584d41',
    warm: 'a4745b',
  }).map(([key, v]) => [key, rgb(v)]),
);
const mix = (a, b, t) => a + (b - a) * t;
function ground([x, z]) {
  const [a, , b] = at(x, 0, z),
    u = (a - field.origin[0]) / field.stepMeters,
    v = (b - field.origin[1]) / field.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    h = field.heightsMeters;
  return (
    mix(mix(h[j][i], h[j][i + 1], u - i), mix(h[j + 1][i], h[j + 1][i + 1], u - i), v - j) -
    field.modelDatumElevationMeters
  );
}
function mesh(out, slot, p, normal, color) {
  const n = normalFor(...p);
  const q = n.reduce((sum, v, i) => sum + v * normal[i], 0) > 0 ? p : p.toReversed();
  (p.length === 3 ? triangle : face)(out, slot, q, color);
}
function plane(out, slot, shape, y, color) {
  const idx = earcut(shape.flat());
  for (let i = 0; i < idx.length; i += 3)
    mesh(
      out,
      slot,
      idx.slice(i, i + 3).map((j) => at(shape[j][0], y, shape[j][1])),
      up,
      color,
    );
}
const rect = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function wall(out, slot, a, b, ya, yb, high, color, reverse = false) {
  const n = at((b[1] - a[1]) * (reverse ? -1 : 1), 0, (a[0] - b[0]) * (reverse ? -1 : 1));
  mesh(
    out,
    slot,
    [at(a[0], ya, a[1]), at(b[0], yb, b[1]), at(b[0], high, b[1]), at(a[0], high, a[1])],
    n,
    color,
  );
}
function box(out, slot, r, y, h, color) {
  const p = rect(...r);
  for (let i = 0; i < 4; i++) wall(out, slot, p[i], p[(i + 1) % 4], y, y, h, color);
  plane(out, slot, p, h, color);
}
function tower(out, center, base, top, radius, lod, red) {
  const n = [10, 16, 24, 32][lod];
  const [x, , z] = at(center[0], 0, center[1]);
  const ring = (y, rad, fluted) =>
    radialRing(y, rad, rad, n, [x, z]).map((p, i) => {
      const k = fluted && i % 2 === 1 ? 0.956 : 1;
      return [mix(x, p[0], k), y, mix(z, p[2], k)];
    });
  const color = red ? tone.red : tone.white;
  const p = (t, d) => ring(mix(base, top - 0.43, t), radius * d, lod >= 1);
  const bands = [
    [0, 1],
    [0.115, 1.01],
    [0.21, 1],
    [0.4, 0.91],
    [0.59, 0.73],
    [0.77, 0.52],
    [0.89, 0.34],
    [1, 0.16],
  ];
  const profile = lod === 0 ? bands.filter((r, i) => i % 2 === 0 || i === bands.length - 1) : bands;
  loft(
    out,
    red ? 'metal' : 'lime',
    profile.map(([t, d]) => p(t, d)),
    color,
    { cap: false },
  );
  loft(
    out,
    'metal',
    [
      ring(base - 0.32, radius * 1.014),
      ring(base - 0.06, radius * 1.075),
      ring(base + 0.13, radius * 1.04),
    ],
    red ? tone.darkRed : tone.red,
  );
  loft(
    out,
    'metal',
    [
      [top - 0.54, radius * 0.17],
      [top - 0.4, radius * 0.2],
      [top - 0.26, radius * 0.13],
      [top, 0.032],
    ].map(([y, r]) => ring(y, r)),
    tone.darkRed,
  );
  if (lod >= 2) loft(out, 'metal', [ring(top - 0.025, 0.035), ring(top + 0.37, 0.018)], tone.ochre);
}
function hall(out, lod) {
  const y = S.terraceY,
    top = 6.05;
  const connector = [-9.86, 2.4, -3.67, 3.67];
  for (const side of [-1, 1]) {
    wall(
      out,
      'lime',
      side < 0 ? [connector[0], connector[2]] : [connector[1], connector[3]],
      side < 0 ? [connector[1], connector[2]] : [connector[0], connector[3]],
      y,
      y,
      top,
      tone.white,
    );
    if (lod)
      for (let j = 0; j < 3; j++) {
        const x = -8.1 + j * 3.45,
          z = side * 3.68;
        const desired = at(0, 0, side);
        mesh(
          out,
          'inset',
          [
            at(x - 0.5, y + 1, z),
            at(x + 0.5, y + 1, z),
            at(x + 0.5, y + 2.17, z),
            at(x - 0.5, y + 2.17, z),
          ],
          desired,
          tone.dark,
        );
      }
  }
  box(out, 'slab', [-10.12, 2.92, -3.89, 3.89], top - 0.25, top + 0.13, tone.roof);
  box(out, 'lime', [-10.12, -9.98, -3.89, 3.89], top + 0.13, top + 0.41, tone.white);
  box(out, 'lime', [-10.12, 2.92, -3.89, -3.74], top + 0.13, top + 0.41, tone.white);
  box(out, 'lime', [-10.12, 2.92, 3.74, 3.89], top + 0.13, top + 0.41, tone.white);
  wall(out, 'lime', [-6.81, 3.69], [-6.81, -3.69], y, y, top, tone.shadowWhite);
  mesh(
    out,
    'inset',
    [
      at(-6.84, y + 0.09, -1.0),
      at(-6.84, y + 0.09, 1.0),
      at(-6.84, y + 2.59, 1.0),
      at(-6.84, y + 2.59, -1.0),
    ],
    at(-1, 0, 0),
    tone.dark,
  );
  for (const z of [-3.24, 0, 3.24]) {
    const [x, , w] = at(-9.55, 0, z);
    const n = lod < 2 ? 5 : 8;
    loft(
      out,
      'lime',
      [
        [y, 0.22],
        [y + 0.26, 0.24],
        [y + 0.4, 0.16],
        [top - 0.37, 0.16],
        [top - 0.28, 0.22],
      ].map(([h, r]) => radialRing(h, r, r, n, [x, w])),
      tone.trim,
    );
  }
  if (lod >= 1) {
    box(out, 'masonry', [-10.72, -9.55, -3.59, 3.59], y - 0.44, y + 0.04, tone.stone);
    box(out, 'masonry', [-11.02, -10.65, -3.69, 3.69], y - 0.55, y - 0.12, tone.stone);
  }
}
function grounds(out, lod) {
  const p = [
    [-21, -9.2],
    [-12.9, -10.95],
    [2.9, -9.7],
    [10.2, -5.45],
    [10, 4.16],
    [-16.9, 4.16],
    [-20.2, 2.7],
  ];
  const y = S.terraceY;
  plane(out, 'masonry', p, y - 0.11, tone.sand);
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    wall(
      out,
      'masonry',
      a,
      b,
      Math.min(ground(a) - 0.35, y - 0.74),
      Math.min(ground(b) - 0.35, y - 0.74),
      y - 0.09,
      tone.stone,
    );
    if (lod >= 1) wall(out, 'lime', a, b, y - 0.13, y - 0.13, y + 0.21, tone.plaster);
  }
  // A continuous stair run meets the terrace wall and the grade below the west edge.
  const steps = lod === 0 ? 4 : lod === 1 ? 8 : 12;
  const start = -20.6,
    end = -25.4;
  const down = Math.min(ground([end, 0]) + 0.06, y - 0.42);
  const toe = down - 0.34;
  for (let i = 0; i < steps; i++) {
    const near = mix(start, end, i / steps),
      far = mix(start, end, (i + 1) / steps);
    box(
      out,
      'masonry',
      [far, near + 0.035, -1.51, 1.45],
      toe,
      mix(y - 0.11, down, i / steps),
      tone.stone,
    );
  }
}
function build(out, lod) {
  grounds(out, lod);
  const y = S.terraceY;
  box(out, 'lime', [2.52, 9.78, -3.67, 3.65], y, S.mainBase, tone.shadowWhite);
  const [rx, rz] = S.redCenter;
  box(out, 'lime', [rx - 2.75, rx + 2.7, rz - 2.34, rz + 2.2], y, S.redBase, tone.warm);
  hall(out, lod);
  tower(out, S.mainCenter, S.mainBase, S.mainCrown, 3.14, lod, false);
  tower(out, S.redCenter, S.redBase, S.redCrown, 2.16, lod, true);
}
export const templeSkyline = (out) => build(out, 0);
export const templeDistrict = (out) => build(out, 1);
export const templeStreet = (out) => build(out, 2);
export const templeCloseup = (out) => build(out, 3);
const camera = at(-41, 30, -35),
  lookAt = at(-2, 5, -2),
  recipe = 'umananda-temple-model.mjs';
export const templeModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  recipeDependencies: ['heritage-tower-detail-mesh.mjs', 'polygon-triangulation.mjs'],
  surfaces,
  build: templeCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The Umananda island temple with a ribbed white sanctuary, entrance hall, adjoining red shrine and hilltop terrace.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  sunDirection: at(-22, 30, -15),
  portableGroundY: -2.1,
  mediumFiContext: {
    scale: 0.95,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline,
    minimumCoverage: 0.86,
    basis: 'The principal mapped island temple outline.',
  },
  embeddedCanonicalGraphs: ['plaster_lime', 'stone_limestone', 'concrete_plain', 'metal_painted'],
  qaCameras: [
    {
      name: 'island-entry-forecourt-and-sanctuary',
      position: at(-30, 11, -20),
      lookAt: at(-5, 5, -3),
    },
    { name: 'white-dome-and-red-shrine', position: at(20, 18, -21), lookAt: at(4, 7, -2.7) },
    { name: 'roofline-from-ropeway', position: at(-20, 34, -23), lookAt: at(-2, 4.2, -3) },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `umananda-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'templeSkyline',
    errorMeters: 0.64,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'templeDistrict', 0.3],
        ['street', 'templeStreet', 0.11],
        ['closeup', 'templeCloseup', 0.049],
      ].map(([level, name, errorMeters]) => [level, { export: name, errorMeters, surfaces }]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. OpenStreetMap outlines are ODbL. Both Qualla photographs are CC0 own work by Newhunterr.',
};

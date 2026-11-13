/** The exposed remains of the Ghazni palace and its later shrine in June 2010. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  triangle,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const ground = read('terrain-grid');
const surfaces = {
  earth: { slot: 'wall', graph: 'stucco', roughness: 0.98, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick_longformat', roughness: 0.96, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.99, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    earth: '938572',
    crest: 'a69a84',
    brick: '795e50',
    brickCap: '95806a',
    stone: 'a2947e',
    lightStone: 'aca089',
    shadeStone: '857462',
    shrine: '8b7964',
    dome: 'ab9b80',
    doorway: '483f36',
  }).map(([name, tint]) => [name, rgb(tint)]),
);

function grade(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters;
  const v = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j;
  const [row, next] = ground.heightsMeters.slice(j, j + 2);
  return (
    (1 - b) * ((1 - a) * row[i] + a * row[i + 1]) +
    b * ((1 - a) * next[i] + a * next[i + 1]) -
    ground.modelDatumElevationMeters
  );
}

function directed(out, material, points, normal, tint) {
  const winding = normalFor(...points).reduce((sum, value, i) => sum + value * normal[i], 0);
  const ordered = winding >= 0 ? points : points.toReversed();
  if (ordered.length === 3) triangle(out, material, ordered, tint);
  else face(out, material, ordered, tint);
}

function wallFragment(out, item, lod) {
  const { start, end, width, heights, material } = item;
  const dx = end[0] - start[0],
    dz = end[1] - start[1],
    length = Math.hypot(dx, dz);
  const normal = [-dz / length, 0, dx / length];
  const fractions =
    lod >= 2 ? [0, 0.12, 0.23, 0.31, 0.49, 0.58, 0.67, 0.8, 0.91, 1] : [0, 0.27, 0.53, 0.79, 1];
  const section = (t, i) => {
    const x = start[0] + dx * t,
      z = start[1] + dz * t;
    const local = grade(x, z);
    const phase = Math.abs(Math.round(start[0] + start[1])) % 4;
    const tooth = lod >= 2 ? [0, -0.12, 0.06, -0.2][(i + phase) % 4] : 0;
    const crest = Math.max(0.13, heights[Math.round(t * 4)] + tooth);
    const half = width * [0.49, 0.42, 0.51, 0.45][(i + phase) % 4];
    return [1, -1].map((sign) => {
      const a = x + sign * normal[0] * half,
        b = z + sign * normal[2] * half;
      const topInset = sign * width * (i % 2 ? 0.23 : 0.16);
      return {
        top: [
          a - normal[0] * topInset,
          local + crest - (sign === 1 && i % 2 ? 0.09 : 0),
          b - normal[2] * topInset,
        ],
        bottom: [a, Math.min(grade(a, b) - 0.27, local + crest - 0.19), b],
      };
    });
  };
  const sections = fractions.map(section);
  const sideColor = colors[material];
  for (let i = 1; i < sections.length; i++) {
    const [[a, b], [c, d]] = sections.slice(i - 1, i + 1);
    directed(out, material, [a.bottom, c.bottom, c.top, a.top], normal, sideColor);
    directed(
      out,
      material,
      [b.bottom, d.bottom, d.top, b.top],
      normal.map((v) => -v),
      sideColor,
    );
    directed(
      out,
      material,
      [a.top, c.top, d.top],
      [0, 1, 0],
      colors[material === 'brick' ? 'brickCap' : 'crest'],
    );
    directed(
      out,
      material,
      [a.top, d.top, b.top],
      [0, 1, 0],
      colors[material === 'brick' ? 'brickCap' : 'crest'],
    );
  }
  for (const [endIndex, sign] of [
    [0, -1],
    [sections.length - 1, 1],
  ]) {
    const [a, b] = sections[endIndex];
    directed(
      out,
      material,
      [a.bottom, b.bottom, b.top, a.top],
      [dx * sign, 0, dz * sign],
      sideColor,
    );
  }
}

const court = plan.court;
const left = court.center[0] - court.openWidth / 2;
const right = court.center[0] + court.openWidth / 2;
const north = court.center[1] - court.openLength / 2;
const south = court.center[1] + court.openLength / 2;

const walls = [
  [[left, north], [left, -9], 1.37, [0.31, 0.64, 0.52, 0.75, 0.26], 'earth', 0],
  [[left, 1], [left, 12], 1.4, [0.66, 1.38, 2.44, 1.57, 0.36], 'earth', 0],
  [[left, 16], [left, south], 1.29, [0.27, 0.45, 0.66, 0.48, 0.24], 'brick', 1],
  [[right, north], [right, -4], 1.22, [0.4, 0.51, 0.89, 0.68, 0.32], 'earth', 0],
  [[right, 7], [right, 17], 1.44, [0.24, 0.71, 1.18, 0.63, 0.28], 'brick', 1],
  [[right, 20], [right, south], 1.2, [0.21, 0.44, 0.58, 0.41, 0.24], 'earth', 2],
  [[left + 1.5, north], [-5, north], 1.23, [0.32, 0.75, 0.51, 0.42, 0.18], 'brick', 1],
  [[4, north], [right - 1.5, north], 1.23, [0.21, 0.32, 0.78, 0.43, 0.37], 'earth', 1],
  [[left + 1.5, south], [-4, south], 1.26, [0.27, 0.44, 0.67, 0.47, 0.21], 'brick', 1],
  [[4, south], [right - 1.5, south], 1.3, [0.24, 0.44, 0.69, 0.53, 0.29], 'earth', 1],
  [[-23.5, 3], [-12, 3], 1.64, [0.37, 0.79, 1.22, 0.71, 0.49], 'earth', 0],
  [[-22, 10], [-12, 10], 1.28, [0.26, 0.66, 1.54, 1.08, 0.32], 'brick', 1],
  [[-23, 13], [-25, 25], 1.63, [0.28, 0.65, 0.81, 0.62, 0.23], 'earth', 1],
  [[-20.7, 28], [-10, 28], 1.53, [0.29, 0.67, 0.79, 0.62, 0.35], 'earth', 2],
  [[-4, 26], [-4, 34], 1.55, [0.52, 0.86, 1.36, 0.84, 0.33], 'earth', 0],
  [[4, 26], [4, 39], 1.41, [0.53, 0.82, 1.12, 0.48, 0.21], 'brick', 1],
  [[-6, 39], [8, 39], 1.41, [0.17, 0.29, 0.53, 0.35, 0.18], 'earth', 2],
  [[-16, -30], [-5, -29.4], 1.67, [0.28, 0.43, 0.61, 0.37, 0.24], 'earth', 0],
  [[-3.5, -29], [-3.5, -21], 1.14, [0.25, 0.44, 0.79, 0.44, 0.22], 'brick', 1],
  [[5.1, -31], [5.1, -20], 1.35, [0.21, 0.46, 0.53, 0.38, 0.19], 'earth', 1],
  [[-29, 39], [-19, 47], 1.36, [0.2, 0.37, 0.49, 0.42, 0.23], 'earth', 1],
  [[13, 34], [15, 46], 1.33, [0.21, 0.31, 0.53, 0.47, 0.23], 'earth', 1],
];

function shrine(out, lod) {
  const {
    center: [x, z],
    width,
    depth,
    bodyHeight,
    domeHeight,
  } = plan.shrine;
  const x0 = x - width / 2,
    x1 = x + width / 2,
    z0 = z - depth / 2,
    z1 = z + depth / 2;
  const sampled = grade(x, z);
  const base =
    Math.min(
      ...[
        [x0, z0],
        [x0, z1],
        [x1, z0],
        [x1, z1],
      ].map(([a, b]) => grade(a, b)),
    ) - 0.3;
  const spring = sampled + bodyHeight;
  const doorwayLow = sampled + 0.1,
    doorwayTop = doorwayLow + 1.79;
  box(out, 'earth', [x0 + 0.61, base, z0], [x1, spring, z1], colors.shrine);
  const opening = lod === 0 ? 0 : 0.52;
  for (const [low, high] of [
    [z0, z - opening],
    [z + opening, z1],
  ]) {
    box(out, 'earth', [x0, base, low], [x0 + 0.61, spring, high], colors.shrine);
  }
  if (lod) {
    box(
      out,
      'brick',
      [x0, base, z - opening],
      [x0 + 0.61, doorwayLow, z + opening],
      colors.shadeStone,
    );
    box(
      out,
      'earth',
      [x0, doorwayTop, z - opening],
      [x0 + 0.61, spring, z + opening],
      colors.shrine,
    );
    box(
      out,
      'earth',
      [x0 + 0.56, doorwayLow, z - opening],
      [x0 + 0.59, doorwayTop, z + opening],
      colors.doorway,
    );
    box(
      out,
      'stone',
      [x0 - 0.42, base, z - 0.7],
      [x0 + 0.014, doorwayLow + 0.05, z + 0.7],
      colors.stone,
    );
  }
  const rings = [
    [2.7, 0.0],
    [2.53, 0.33],
    [2.23, 0.6],
    [1.75, 0.81],
    [1.15, 0.94],
    [0.55, 1.0],
  ];
  const sides = [8, 12, 16, 20][lod];
  const points = rings.map(([radius, fraction]) =>
    Array.from({ length: sides }, (_, i) => {
      const angle = ((i + 0.5) * 2 * Math.PI) / sides;
      return [
        x + radius * Math.cos(angle),
        spring + domeHeight * fraction,
        z + radius * Math.sin(angle),
      ];
    }),
  );
  for (let k = 1; k < points.length; k++) {
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides,
        a = points[k - 1][i],
        b = points[k - 1][next];
      directed(
        out,
        'earth',
        [a, b, points[k][next], points[k][i]],
        [a[0] + b[0] - 2 * x, 0.8, a[2] + b[2] - 2 * z],
        colors.dome,
      );
    }
  }
  for (let i = 0; i < sides; i++) {
    directed(
      out,
      'earth',
      [points.at(-1)[i], points.at(-1)[(i + 1) % sides], [x, spring + domeHeight + 0.03, z]],
      [0, 1, 0],
      colors.dome,
    );
  }
}

function rubble(out, lod) {
  const patches = [
    [-18.5, -4.8],
    [-21.8, 8.2],
    [-21.1, 16.8],
    [-7.1, 23.5],
    [4.1, 30.1],
    [-4.5, 33.7],
    [11.3, 13.5],
    [-11.4, -16.3],
    [-13.5, -27.0],
    [-24.9, 37.3],
    [10.9, 39.6],
  ];
  const count = lod >= 3 ? 7 : 4;
  for (const [p, [x, z]] of patches.entries()) {
    for (let j = 0; j < count; j++) {
      const a = x + ((((p + 2) * (j + 3)) % 11) - 5) * 0.56,
        b = z + ((((p + 3) * (j + 1)) % 13) - 6) * 0.39;
      const r = 0.25 + ((j * 3 + p * 5) % 7) * 0.052;
      const bottom = grade(a, b) - 0.12,
        h = 0.18 + ((p + 2 * j) % 5) * 0.061;
      const corners = [
        [a - r, b - r * 0.46],
        [a + r * 0.82, b - r * 0.67],
        [a + r * 0.99, b + r * 0.36],
        [a - r * 0.6, b + r * 0.77],
      ];
      const crest = corners.map(([u, v], i) => [
        a + (u - a) * 0.54 + r * 0.09,
        bottom + h - (i % 2) * 0.075,
        b + (v - b) * 0.53,
      ]);
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4,
          u = corners[i],
          v = corners[next];
        directed(
          out,
          'stone',
          [[u[0], bottom, u[1]], [v[0], bottom, v[1]], crest[next], crest[i]],
          [u[0] + v[0] - 2 * a, 1, u[1] + v[1] - 2 * b],
          colors[i === 0 ? 'lightStone' : i === 3 ? 'shadeStone' : 'stone'],
        );
      }
      directed(out, 'stone', crest.slice(0, 3), [0, 1, 0], colors.stone);
      directed(out, 'stone', [crest[0], crest[2], crest[3]], [0, 1, 0], colors.lightStone);
    }
  }
}

function build(out, lod) {
  shrine(out, lod);
  for (const [start, end, width, heights, material, minimumLod] of walls) {
    if (lod >= minimumLod) wallFragment(out, { start, end, width, heights, material }, lod);
  }
  if (lod >= 2) rubble(out, lod);
}

export const ruinsSkyline = (out) => build(out, 0);
export const ruinsDistrict = (out) => build(out, 1);
export const ruinsStreet = (out) => build(out, 2);
export const ruinsCloseup = (out) => build(out, 3);

const recipe = 'masud-palace-model.mjs',
  camera = [-69, 23, -58],
  lookAt = [-5, 0, 7];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'ruinsDistrict', 0.38],
    ['street', 'ruinsStreet', 0.14],
    ['closeup', 'ruinsCloseup', 0.04],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);
export const ruinsModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: ruinsCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Earth-colored, discontinuous Ghaznavid wall remnants around an open court and the damaged later domed shrine in the 2010 view.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  mediumFiContext: {
    scale: 1.8,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: ['stucco', 'brick_longformat', 'stone_sandstone_raw'],
  qaCameras: [
    { name: 'ziyara-and-west-wall', position: [-37, 9, -26], lookAt: [-12, 1.6, -6] },
    { name: 'open-court-and-wall-remnants', position: [41, 28, 49], lookAt: [-2, 0, 5] },
    { name: 'south-foundation-and-excavation', position: [-34, 12, 65], lookAt: [-6, -0.8, 24] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-masud-palace-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'ruinsSkyline',
    errorMeters: 0.87,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license. The OSM mapped extent is ODbL. Both exact story reference files are from the same public-domain United States Air Force photograph.',
};

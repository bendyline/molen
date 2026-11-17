/** The life-size cast and elegy pedestal of Yah Leh at Sanam Chandra Palace. */
import { readFileSync } from 'node:fs';
import {
  chamferedRectangle,
  cross,
  loft,
  normalize,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { deck, plaque, pedestal } = plan.dimensions;
const materials = {
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.92, metallic: 0 },
  bronze: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.67, metallic: 0.46 },
  tablet: { slot: 'trim', localRef: 'palette:#968273', roughness: 0.73, metallic: 0.29 },
};
const stone = rgb('c3bbaa');
const molding = rgb('b3a893');
const bronze = rgb('524940');
const wornBronze = rgb('5a5047');
const engraved = rgb('998775');
const darkBronze = rgb('352e29');

function slab(out, sections, tint) {
  loft(
    out,
    'stone',
    sections.map(([height, width, depth, bevel]) =>
      chamferedRectangle(0, height, 0, width, depth, bevel),
    ),
    tint,
  );
}

function buildPedestal(out, detail) {
  const { width, depth } = pedestal;
  slab(
    out,
    [
      [-0.25, width, depth, 0.065],
      [0.15, width, depth, 0.065],
      [0.22, 1.54, 1.3, 0.055],
      [0.31, 1.38, 1.18, 0.044],
      [0.39, 1.38, 1.18, 0.044],
    ],
    molding,
  );
  slab(
    out,
    [
      [0.39, 1.29, 1.12, 0.035],
      [0.45, 1.27, 1.087, 0.035],
      [1.14, 1.27, 1.087, 0.035],
      [1.21, 1.31, 1.13, 0.04],
    ],
    stone,
  );
  slab(
    out,
    [
      [1.21, 1.34, 1.17, 0.05],
      [1.29, 1.49, 1.29, 0.052],
      [1.39, 1.49, 1.29, 0.052],
      [deck, 1.43, 1.23, 0.05],
    ],
    stone,
  );
  const face = 1.087 / 2;
  const left = -plaque.width / 2;
  const top = plaque.y + plaque.height;
  const outer = face + plaque.thickness;
  box(out, 'tablet', [left, plaque.y, face], [-left, top, outer], rgb('9d8c77'));
  if (detail >= 1) {
    // Render the registry's sixteen lines as incised bands, without inventing letterforms.
    const lengths = [
      0.28, 0.6, 0.73, 0.77, 0.67, 0.72, 0.68, 0.76, 0.7, 0.74, 0.65, 0.74, 0.71, 0.64, 0.56, 0.27,
    ];
    for (const [i, length] of lengths.entries()) {
      const y = top - 0.078 - i * 0.034;
      box(
        out,
        'bronze',
        [-length / 2, y, outer],
        [length / 2, y + 0.004, outer + 0.0007],
        engraved,
      );
    }
  }
}

function bodyRing([z, y, width, height], sides, coat = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = (i * 2 * Math.PI) / sides;
    const contour = 1 + coat * Math.sin(5 * angle + z * 19) * Math.abs(Math.sin(angle));
    return [Math.cos(angle) * width * contour, deck + y + Math.sin(angle) * height * contour, z];
  });
}

/** An elliptical section moving through each centerline in order. X favors face width. */
function castSweep(out, sections, sides, tint = bronze) {
  const rings = sections.map(([x, y, z, width, depth], i) => {
    const before = sections[Math.max(0, i - 1)];
    const after = sections[Math.min(sections.length - 1, i + 1)];
    const axis = normalize(after.slice(0, 3).map((value, j) => value - before[j]));
    const across = normalize(cross(Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1], axis));
    const along = cross(axis, across);
    return Array.from({ length: sides }, (_, j) => {
      const angle = (j * 2 * Math.PI) / sides;
      return [x, deck + y, z].map(
        (value, k) =>
          value + across[k] * Math.cos(angle) * depth + along[k] * Math.sin(angle) * width,
      );
    });
  });
  loft(out, 'bronze', rings, tint);
}

function buildDog(out, detail) {
  const sides = [6, 10, 14, 18][detail];
  const coat = detail >= 2 ? 0.036 : 0;
  const body = [
    [-0.442, 0.438, 0.035, 0.047],
    [-0.403, 0.42, 0.102, 0.092],
    [-0.335, 0.399, 0.123, 0.121],
    [-0.224, 0.396, 0.113, 0.117],
    [-0.08, 0.389, 0.111, 0.136],
    [0.051, 0.389, 0.122, 0.152],
    [0.163, 0.407, 0.12, 0.142],
    [0.222, 0.451, 0.098, 0.106],
    [0.245, 0.466, 0.058, 0.056],
  ];
  loft(
    out,
    'bronze',
    body.map((section) => bodyRing(section, sides, coat)),
    bronze,
  );

  for (const side of [-1, 1]) {
    const front = [
      [0.003, 0.111, 0.146, 0.039, 0.058],
      [0.044, 0.113, 0.14, 0.033, 0.047],
      [0.131, 0.111, 0.113, 0.027, 0.033],
      [0.229, 0.112, 0.099, 0.036, 0.045],
      [0.316, 0.104, 0.105, 0.058, 0.06],
      [0.413, 0.091, 0.081, 0.063, 0.068],
    ];
    const stagger = side * 0.035;
    const hind = [
      [0.003, 0.113, -0.318 + stagger, 0.036, 0.058],
      [0.042, 0.117, -0.329 + stagger, 0.033, 0.047],
      [0.139, 0.119, -0.39 + stagger, 0.029, 0.032],
      [0.228, 0.111, -0.298 + stagger, 0.048, 0.048],
      [0.303, 0.101, -0.313 + stagger, 0.067, 0.077],
      [0.414, 0.077, -0.354, 0.068, 0.068],
    ];
    for (const leg of [front, hind]) {
      loft(
        out,
        'bronze',
        leg.map(([y, x, z, rx, rz]) => radialRing(deck + y, rx, rz, sides, [side * x, z])),
        wornBronze,
      );
    }
  }
  castSweep(
    out,
    [
      [0, 0.382, 0.143, 0.09, 0.085],
      [0, 0.459, 0.136, 0.127, 0.12],
      [0, 0.543, 0.169, 0.107, 0.1],
      [0, 0.617, 0.205, 0.086, 0.074],
      [0, 0.693, 0.224, 0.069, 0.057],
    ],
    sides,
  );
  const head = [
    [0.153, 0.69, 0.021, 0.027],
    [0.182, 0.703, 0.061, 0.058],
    [0.23, 0.702, 0.081, 0.078],
    [0.286, 0.694, 0.074, 0.068],
    [0.324, 0.674, 0.051, 0.042],
    [0.368, 0.671, 0.037, 0.032],
    [0.403, 0.671, 0.032, 0.027],
    [0.418, 0.674, 0.027, 0.019],
  ];
  loft(
    out,
    'bronze',
    head.map((section) => bodyRing(section, sides)),
    wornBronze,
  );
  castSweep(
    out,
    [
      [0, 0.447, -0.363, 0.049, 0.053],
      [0.008, 0.478, -0.455, 0.048, 0.053],
      [0.017, 0.55, -0.515, 0.061, 0.066],
      [0.036, 0.628, -0.533, 0.052, 0.064],
      [0.059, 0.686, -0.517, 0.044, 0.048],
      [0.082, 0.718, -0.465, 0.026, 0.034],
      [0.104, 0.719, -0.413, 0.008, 0.01],
    ],
    sides,
    wornBronze,
  );

  for (const side of [-1, 1]) {
    castSweep(
      out,
      [
        [side * 0.056, 0.735, 0.216, 0.019, 0.033],
        [side * 0.081, 0.709, 0.208, 0.025, 0.042],
        [side * 0.092, 0.669, 0.202, 0.018, 0.037],
        [side * 0.087, 0.629, 0.218, 0.013, 0.027],
        [side * 0.076, 0.607, 0.234, 0.006, 0.011],
      ],
      sides,
    );
    if (detail >= 1) {
      sphere(
        out,
        'bronze',
        [side * 0.058, deck + 0.717, 0.298],
        [0.012, 0.009, 0.013],
        darkBronze,
        8,
        4,
      );
    }
    if (detail >= 2) {
      // A few low relief masses give the ruff and hindquarters their long-haired contour.
      castSweep(
        out,
        [
          [side * 0.076, 0.567, 0.217, 0.012, 0.019],
          [side * 0.102, 0.512, 0.211, 0.021, 0.029],
          [side * 0.101, 0.449, 0.191, 0.019, 0.031],
          [side * 0.079, 0.374, 0.166, 0.009, 0.017],
        ],
        9,
        wornBronze,
      );
      castSweep(
        out,
        [
          [side * 0.089, 0.412, -0.354, 0.03, 0.039],
          [side * 0.104, 0.364, -0.37, 0.025, 0.031],
          [side * 0.112, 0.297, -0.366, 0.012, 0.025],
        ],
        9,
      );
    }
  }
  if (detail >= 1) {
    sphere(out, 'bronze', [0, deck + 0.68, 0.416], [0.028, 0.017, 0.014], darkBronze, 9, 5);
  }
}

function build(out, detail) {
  buildPedestal(out, detail);
  buildDog(out, detail);
}
export const yahLehSkyline = (out) => build(out, 0);
export const yahLehDistrict = (out) => build(out, 1);
export const yahLehStreet = (out) => build(out, 2);
export const yahLehCloseup = (out) => build(out, 3);

const recipe = 'yah-leh-monument-model.mjs';
const position = [3.05, 2.8, 4.25];
const lookAt = [0, 1.13, 0];
export const yahLehMonumentModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  recipe,
  surfaces: materials,
  build: yahLehCloseup,
  category: 'monument',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: 'Named memorial point and unchanged independent lawn elevations.',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The life-size bronze cast of Yah Leh and its inscribed garden pedestal at Sanam Chandra Palace.',
  camera: position,
  lookAt,
  sunDirection: [-56, 108, 93],
  embeddedCanonicalGraphs: ['stone_limestone_raw'],
  mediumFiContext: {
    scale: 0.53,
    cameraYaw: 0.65,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'elegy-plaque', position: [0.14, 1.34, 2.9], lookAt: [0, 0.95, 0] },
    { name: 'standing-cast-profile', position: [2, 2.2, 0.6], lookAt: [0, 1.87, -0.04] },
    { name: 'cast-reverse-and-tail', position: [-1.7, 2.45, -1.8], lookAt: [0, 1.79, -0.11] },
    { name: 'garden-and-pedestal', position: [-3.3, 2.9, 4.5], lookAt: lookAt },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'yah-leh-monument-' + reviewLod,
    position,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'yahLehSkyline',
    errorMeters: 0.09,
    surfaces: materials,
    authoredLevels: {
      district: { export: 'yahLehDistrict', errorMeters: 0.04, surfaces: materials },
      street: { export: 'yahLehStreet', errorMeters: 0.017, surfaces: materials },
      closeup: { export: 'yahLehCloseup', errorMeters: 0.006, surfaces: materials },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry from primary written records, a named OpenStreetMap point and Terrarium elevations.',
};

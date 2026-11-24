import { readFileSync } from 'node:fs';
import {
  abox,
  facade,
  fbox,
  lathe,
  opening,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const layout = read('native-map/dharmarajika-stupa-shape-controls');
const surfaces = {
  core: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.97 },
  ashlar: { slot: 'trim', graph: 'stone_limestone_weathered', roughness: 0.93 },
  paving: { slot: 'wall', graph: 'stone_limestone', roughness: 0.97 },
  shadow: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.94 },
};
const rubbles = ['938a76', '978e7b', '9d947e', '928972', 'a1977f', '9b917a'].map(rgb);
const block = rgb('a59c85');
const chalk = rgb('b2a794');
const weathered = rgb('928a76');
const shade = rgb('7d725e');
const pathTone = rgb('ab9f83');
const twoPi = 2 * Math.PI;

function box(out, slot, x0, x1, z0, z1, y0, y1, color) {
  abox(out, slot, [x0, y0, z0], [x1, y1, z1], color, { bottom: false });
}

function ring(out, slot, r0, r1, y0, y1, sides, color) {
  lathe(
    out,
    slot,
    [0, 0],
    [
      [y0, r0, r0],
      [y1, r1, r1],
    ],
    sides,
    color,
    { capTop: false },
  );
}

function terrace(out, level) {
  const n = [16, 24, 48, 64][level];
  ring(out, 'core', 24.58, 24.58, -1.33, 0.88, n, weathered);
  ring(out, 'ashlar', 24.62, 24.62, 0.82, 1.22, n, block);
  ring(out, 'paving', 24.61, 19.65, 1.21, 1.24, n, pathTone);
  ring(out, 'ashlar', 20.02, 20.02, 1.22, 2.68, n, weathered);
  ring(out, 'ashlar', 20.16, 20.05, 2.62, 2.89, n, block);
  if (level >= 2) {
    for (let side = 0; side < n; side++) {
      const a = (side * twoPi) / n;
      const sector = (side * 4) % n;
      if (sector < 3 || sector > n - 3 || (side * 13) % 11 > 9) continue;
      const x = Math.cos(a),
        z = Math.sin(a),
        p = 24.63;
      const edge = facade([p * x, p * z], [z, -x]);
      fbox(
        out,
        'ashlar',
        edge,
        -0.17,
        0.19,
        0.13,
        0.69,
        -0.03,
        0.096,
        rubbles[(side * 3 + 1) % rubbles.length],
      );
    }
  }
}

const profile = [
  [19.96, 2.7],
  [19.54, 4.44],
  [18.19, 6.88],
  [16.15, 9.45],
  [13.51, 11.69],
  [10.78, 12.74],
  [8.33, 13.37],
  [6.92, 13.38],
  [6.18, 12.31],
  [4.5, 11.07],
  [2.51, 10.47],
  [0.0, 10.23],
];
function mound(out, level) {
  const steps = [16, 32, 60, 96][level];
  const heights =
    level === 0
      ? profile.filter((_, index) => index % 2 === 0 || index === profile.length - 1)
      : profile;
  function point(row, side) {
    const index = side % steps;
    const angularOffset = level < 2 ? 0 : 0.24 * Math.sin(row * 2.71 + index * 3.17);
    const theta = ((index + angularOffset) * twoPi) / steps;
    const [r, y] = heights[row];
    const edge = r / 20;
    const waviness =
      (0.27 * Math.sin(7 * theta + 0.67 * row) + 0.18 * Math.cos(17 * theta - 0.34 * row)) * edge;
    const cleft = Math.max(0, Math.cos(theta - 0.23));
    const notch = cleft * cleft * cleft * cleft * cleft * cleft * cleft * cleft;
    const depth = (r > 6 ? 1.35 * Math.sin(((20 - r) / 15) * Math.PI * 0.72) : 0.55 * edge) * notch;
    const radius = r + waviness;
    const breakup =
      (0.28 * Math.cos(9 * theta + 0.55 * row) + 0.17 * Math.sin(15 * theta - 0.83 * row)) * edge;
    return [radius * Math.cos(theta), y + breakup - depth, radius * Math.sin(theta)];
  }
  for (let row = 0; row < heights.length - 1; row++) {
    for (let side = 0; side < steps; side++) {
      const a = point(row, side),
        b = point(row, side + 1),
        c = point(row + 1, side + 1),
        d = point(row + 1, side);
      const colorIndex = (row * 7 + side * 19 + Math.floor(side / 9)) % rubbles.length;
      const color = rubbles[colorIndex];
      if (row + 1 === heights.length - 1) tri(out, 'core', a, d, b, color);
      else {
        tri(out, 'core', a, d, c, color);
        tri(out, 'core', a, c, b, color);
      }
    }
  }
}

function stairs(out, level) {
  const steps = level === 0 ? 3 : 7;
  for (let quadrant = 0; quadrant < 4; quadrant++) {
    const a = (quadrant * Math.PI) / 2;
    const cos = Math.cos(a),
      sin = Math.sin(a);
    const F = facade([cos * 24.18, sin * 24.18], [sin, -cos]);
    for (let i = 0; i < steps; i++) {
      const outer = 2.36 - (i * 2.82) / steps;
      const y = (1.25 * (i + 1)) / steps;
      fbox(out, 'ashlar', F, -1.62, 1.62, -0.81, y, -0.58, outer, block);
    }
    if (level >= 1) {
      for (const u of [-1.85, 1.85]) {
        fbox(out, 'ashlar', F, u - 0.24, u + 0.24, -0.81, 1.39, -0.88, 0.94, weathered);
        fbox(out, 'ashlar', F, u - 0.22, u + 0.22, -0.23, 0.7, 0.91, 2.22, block);
      }
    }
  }
}

function chapterMasonry(out, center, width, depth, height, level) {
  const [x, z] = center;
  const direction = Math.atan2(-z, -x);
  const dx = Math.cos(direction),
    dz = Math.sin(direction);
  const F = facade(center, [dz, -dx]);
  const openingWidth = level === 0 ? width * 0.34 : width * 0.23;
  const thickness = level === 0 ? 0.55 : 0.72;
  const low = -1.1;
  const halfWidth = width / 2,
    halfDepth = depth / 2;
  fbox(
    out,
    'core',
    F,
    -halfWidth,
    halfWidth,
    low,
    height * 0.93,
    -halfDepth,
    -halfDepth + thickness,
    weathered,
  );
  fbox(
    out,
    'core',
    F,
    -halfWidth,
    -halfWidth + thickness,
    low,
    height,
    -halfDepth + thickness,
    halfDepth,
    block,
  );
  fbox(
    out,
    'core',
    F,
    halfWidth - thickness,
    halfWidth,
    low,
    height * 0.92,
    -halfDepth + thickness,
    halfDepth,
    weathered,
  );
  if (level >= 1) {
    fbox(
      out,
      'core',
      F,
      -halfWidth + thickness,
      -openingWidth,
      low,
      height * 0.69,
      halfDepth - thickness,
      halfDepth,
      block,
    );
    fbox(
      out,
      'core',
      F,
      openingWidth,
      halfWidth - thickness,
      low,
      height * 0.73,
      halfDepth - thickness,
      halfDepth,
      block,
    );
  }
  if (level >= 2) {
    const positions = [-0.42, -0.2, 0.14, 0.37];
    for (const fraction of positions) {
      const u = width * fraction;
      fbox(
        out,
        'ashlar',
        F,
        u - 0.19,
        u + 0.24,
        height * 0.93,
        height * 0.93 + 0.13,
        -halfDepth + 0.12,
        -halfDepth + Math.min(0.61, thickness),
        chalk,
      );
    }
  }
}

function satellites(out, level) {
  if (level === 0) return;
  for (const {
    center: [x, z],
    width,
    heightEstimate,
  } of layout.satellites) {
    const widthHalf = width / 2;
    box(
      out,
      'core',
      x - widthHalf,
      x + widthHalf,
      z - widthHalf,
      z + widthHalf,
      -0.92,
      heightEstimate * 0.32,
      weathered,
    );
    const r = width * 0.36;
    lathe(
      out,
      'core',
      [x, z],
      [
        [heightEstimate * 0.31, r, r],
        [heightEstimate * 0.48, r * 0.96, r * 0.96],
        [heightEstimate, r * 0.71, r * 0.68],
      ],
      level === 1 ? 8 : 12,
      block,
    );
  }
}

function facingRemains(out, level) {
  if (level < 2) return;
  const segments = level === 2 ? 11 : 20;
  for (let i = 0; i < segments; i++) {
    const a = -0.91 + (i / (segments - 1)) * 1.47;
    const x = Math.cos(a),
      z = Math.sin(a);
    const r = 19.9;
    const F = facade([x * r, z * r], [z, -x]);
    const h = 0.62 + ((i * 7) % 13) / 26;
    fbox(out, 'ashlar', F, -0.27, 0.23, 2.83, 2.83 + h, -0.66, 0.2, block);
    if (level === 3) {
      fbox(out, 'ashlar', F, -0.33, 0.29, 2.78, 2.92, -0.54, 0.26, weathered);
      if (i % 3 === 0)
        opening(out, F, 0.64, 2.92, 0.58, 0.66, {
          head: 'round',
          glassSlot: 'shadow',
          frameSlot: 'ashlar',
          glass: shade,
          frame: chalk,
          frameWidth: 0.08,
          frameDepth: 0.08,
          sill: false,
          d: 0.057,
        });
    }
  }
}

function build(out, level) {
  terrace(out, level);
  mound(out, level);
  stairs(out, level);
  facingRemains(out, level);
  const chapters =
    level === 0 ? layout.chapels.filter((_, index) => index % 2 === 0) : layout.chapels;
  for (const { center, width, depth, heightEstimate } of chapters)
    chapterMasonry(out, center, width, depth, heightEstimate, level);
  satellites(out, level);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'dharmarajika-stupa-model.mjs';
const camera = [-52, 40, 69],
  lookAt = [0, 5.0, 3.2];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  recipe,
  wikidataId: plan.wikidataId,
  category: 'archaeological-stupa',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Surviving Dharmarajika Stupa at Taxila with its broken limestone drum, processional terrace, radial stairs and surrounding chapel foundations.',
  camera,
  lookAt,
  sunDirection: [-42, 67, -39],
  mediumFiContext: {
    scale: 1.21,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.82,
    basis:
      'Circular heritage monument terrace from the original excavation plan and named government site.',
  },
  embeddedCanonicalGraphs: [
    ...new Set(Object.values(surfaces).flatMap(({ graph }) => graph ?? [])),
  ],
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'stupa-and-processional-terrace', position: camera, lookAt },
    { name: 'north-stair-and-core', position: [11, 8.1, -42], lookAt: [0, 6, -10] },
    { name: 'excavation-plan-and-broken-crown', position: [17, 67, 30], lookAt: [0, 2, 3] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'dharmarajika-stupa-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.62,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.26, surfaces },
      street: { export: 'street', errorMeters: 0.081, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.028, surfaces },
    },
  },
};

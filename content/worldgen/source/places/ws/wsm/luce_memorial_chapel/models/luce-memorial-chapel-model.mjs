import fs from 'node:fs';
import {
  abox,
  extrude,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const { foundation, floor, altarPeak, navePeak, crestGap } = plan.dimensions;
const [rearSouth, altarSouth, naveSouth, eastSouth, eastNorth, naveNorth, altarNorth, rearNorth] =
  frame.geometry.outline;
const surfaces = {
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.89 },
  coping: { slot: 'trim', graph: 'concrete_boardformed', roughness: 0.94 },
  sill: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.54 },
  frames: { slot: 'trim', graph: 'metal_painted', roughness: 0.83 },
};
const ochre = rgb('c89c56');
const gold = rgb('d2a768');
const cement = rgb('a29b89');
const darkCement = rgb('827a68');
const paving = rgb('a3957f');
const metal = rgb('545b54');
const glass = [rgb('435856'), rgb('536961'), rgb('4b605b'), rgb('60736a')];
const lerp = (a, b, t) => a + (b - a) * t;
const west = {
  peak: altarPeak,
  side: -1,
  south: [rearSouth, altarSouth],
  north: [rearNorth, altarNorth],
};
const east = {
  peak: navePeak,
  side: 1,
  south: [eastSouth, naveSouth],
  north: [eastNorth, naveNorth],
};

function surface(half, side, u, v, depth = 0) {
  const [[endX, endZ], [jointX, jointZ]] = side > 0 ? half.south : half.north;
  const x = lerp(endX, jointX, u) - half.side * v * lerp(0.55, 0.06, u);
  const sweep = (1 - v) * (1 - v);
  const foot = lerp(endZ, jointZ, u);
  const crest = side * (crestGap / 2 + lerp(0.09, 0.04, u));
  const z = lerp(crest, foot, sweep) - side * depth;
  const y = lerp(floor, half.peak - 0.42 * u, v) - depth * 0.36;
  return [x, y, z];
}

function shell(out, half, side, lod) {
  const levels = [7, 11, 17, 24][lod];
  const spans = [3, 5, 8, 12][lod];
  const reversed = side * half.side > 0;
  const face = (slot, a, b, c, d, color) =>
    quad4(out, slot, a, ...(reversed ? [d, c, b] : [b, c, d]), color);
  const sample = (j, k, depth) => surface(half, side, j / spans, k / levels, depth);
  for (let j = 0; j < spans; j++) {
    for (let k = 0; k < levels; k++) {
      const a = sample(j, k, 0),
        b = sample(j + 1, k, 0),
        c = sample(j + 1, k + 1, 0),
        d = sample(j, k + 1, 0);
      const color = (j + k * 2) % 7 === 0 ? gold : ochre;
      face('tiles', a, b, c, d, color);
    }
    face(
      'coping',
      sample(j, levels, 0),
      sample(j + 1, levels, 0),
      sample(j + 1, levels, 0.32),
      sample(j, levels, 0.32),
      cement,
    );
    face(
      'coping',
      sample(j + 1, 0, 0),
      sample(j, 0, 0),
      sample(j, 0, 0.28),
      sample(j + 1, 0, 0.28),
      darkCement,
    );
  }
  for (let k = 0; k < levels; k++) {
    for (const [u, direction] of [
      [0, 1],
      [1, -1],
    ]) {
      const v0 = k / levels,
        v1 = (k + 1) / levels;
      const width = 0.024 + (1 - v0) * 0.018;
      const a = surface(half, side, u, v0),
        b = surface(half, side, u, v1);
      const c = surface(half, side, u + direction * width, v1),
        d = surface(half, side, u + direction * width, v0);
      const lift = (p) => [p[0], p[1] + 0.008, p[2] + side * 0.023];
      if (u === 0) {
        face('coping', lift(a), lift(d), lift(c), lift(b), cement);
        face(
          'coping',
          a,
          b,
          surface(half, side, u, v1, 0.35),
          surface(half, side, u, v0, 0.35),
          darkCement,
        );
      } else {
        face('coping', lift(a), lift(b), lift(c), lift(d), cement);
        face(
          'coping',
          b,
          a,
          surface(half, side, u, v0, 0.35),
          surface(half, side, u, v1, 0.35),
          darkCement,
        );
      }
    }
  }
}

function glassPoint(half, t, v) {
  const a = surface(half, -1, 0, v, 0.22),
    b = surface(half, 1, 0, v, 0.22);
  return [lerp(a[0], b[0], t) - half.side * 0.21, lerp(a[1], b[1], t) + 0.075, lerp(a[2], b[2], t)];
}

function glazedEnd(out, half, lod) {
  const rows = [7, 11, 17, 24][lod],
    cols = lod === 0 ? 1 : lod === 1 ? 3 : 5;
  const P = (i, j) => glassPoint(half, i / cols, j / rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const left = P(i, j),
        right = P(i + 1, j),
        topRight = P(i + 1, j + 1),
        topLeft = P(i, j + 1);
      const pane = glass[(Math.floor(j / 3) + i * 2) % glass.length];
      if (half.side === 1) quad4(out, 'glass', right, left, topLeft, topRight, pane);
      else quad4(out, 'glass', left, right, topRight, topLeft, pane);
      if (lod > 0 && i > 0) beam(out, 'frames', left, topLeft, 0.052, 0.043, metal);
    }
    if (j > 0 && (lod < 2 || j % 2 === 0))
      beam(out, 'frames', P(0, j), P(cols, j), 0.058, 0.052, metal);
  }
  if (half === east) {
    const z = (eastSouth[1] + eastNorth[1]) / 2;
    for (let i = 0; i < 4; i++) {
      const y = 0.11 + i * 0.114;
      abox(
        out,
        'sill',
        [10.86, -0.22, z - 2.68 + i * 0.12],
        [14.32 - i * 0.58, y, z + 2.68 - i * 0.12],
        paving,
        { bottom: false },
      );
    }
    if (lod > 1) {
      for (const offset of [-0.74, 0, 0.74])
        beam(
          out,
          'frames',
          [11.19, 0.49, z + offset],
          [11.19, 2.49, z + offset],
          0.078,
          0.069,
          metal,
        );
      beam(out, 'frames', [11.19, 2.49, z - 0.79], [11.19, 2.49, z + 0.79], 0.085, 0.083, metal);
    }
  }
}

function seam(out, lod) {
  const count = [7, 11, 17, 24][lod];
  for (let j = 0; j < count; j++) {
    const lower = j / count,
      upper = (j + 1) / count;
    for (const s of [-1, 1]) {
      const a = surface(west, s, 1, lower, 0.09),
        b = surface(east, s, 1, lower, 0.09);
      const c = surface(east, s, 1, upper, 0.09),
        d = surface(west, s, 1, upper, 0.09);
      if (s === 1) quad4(out, 'glass', a, b, c, d, glass[0]);
      else quad4(out, 'glass', b, a, d, c, glass[0]);
      if (lod > 1 && j % 3 === 1) beam(out, 'frames', a, b, 0.05, 0.042, metal);
    }
  }
  for (const half of [west, east]) {
    const a = surface(half, -1, 0, 1),
      b = surface(half, -1, 1, 1);
    const c = surface(half, 1, 1, 1),
      d = surface(half, 1, 0, 1);
    if (half === west) {
      tri(out, 'glass', a, d, c, glass[1]);
      tri(out, 'glass', a, c, b, glass[1]);
    } else {
      tri(out, 'glass', d, a, b, glass[1]);
      tri(out, 'glass', d, b, c, glass[1]);
    }
  }
}

function build(out, lod) {
  extrude(out, 'sill', frame.geometry.outline, foundation, floor + 0.014, paving, { top: false });
  for (const half of [west, east]) {
    shell(out, half, -1, lod);
    shell(out, half, 1, lod);
    glazedEnd(out, half, lod);
  }
  seam(out, lod);
  const cross = -4.45;
  beam(out, 'frames', [cross, 18.83, 0], [cross, 20.68, 0], 0.079, 0.081, metal);
  beam(out, 'frames', [cross, 20.13, -0.53], [cross, 20.13, 0.53], 0.072, 0.071, metal);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);
const recipe = 'luce-memorial-chapel-model.mjs';
const camera = [39, 14, 31];
const lookAt = [0, 8.5, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The Luce Memorial Chapel at Tunghai University, with four ochre-tiled curved concrete shells and tall glazed seams.',
  camera,
  lookAt,
  sunDirection: [31, 48, 28],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'The native footprint of the four curved chapel shells.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['place-recipe-kit.mjs', 'authored-structure-mesh.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'east-entrance-and-shell-seam', position: camera, lookAt },
    { name: 'glazed-entrance-and-rising-shells', position: [42, 8, 0], lookAt: [7, 8.3, 0] },
    { name: 'west-altar-and-ochre-tiles', position: [-35, 14, -27], lookAt: [0, 5, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'luce-chapel-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.02,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.45, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open elevation.',
};

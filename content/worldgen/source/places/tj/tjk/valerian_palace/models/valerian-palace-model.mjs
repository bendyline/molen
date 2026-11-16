/** Valerian Palace at Bishapur, with its exposed stone courses and neighboring low foundations. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const terrain = JSON.parse(fs.readFileSync(new URL('../terrain-grid.json', import.meta.url)));
const { ashlar, ruins } = plan.wallLines;
const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  foundation: {
    slot: 'foundation',
    graph: 'stone_limestone_weathered',
    roughness: 0.97,
    metallic: 0,
  },
};
const ashlarTones = ['b8ac90', 'a89b81', 'a2957d', 'bfb49a', 'b2a588', 'a99e86', 'c2b69c'].map(rgb);
const rubbleTones = ['a79b7e', 'b0a085', 'ab9f88', '988a71', 'b8ab91', 'a99c84'].map(rgb);
const backing = rgb('827963');

function atGround(x, z) {
  const row = (z - terrain.origin[1]) / terrain.stepMeters;
  const column = (x - terrain.origin[0]) / terrain.stepMeters;
  const i = Math.floor(column);
  const j = Math.floor(row);
  const u = column - i;
  const v = row - j;
  const lower = terrain.heightsMeters[j];
  const upper = terrain.heightsMeters[j + 1];
  return (
    (1 - v) * (lower[i] * (1 - u) + lower[i + 1] * u) +
    v * (upper[i] * (1 - u) + upper[i + 1] * u) -
    terrain.modelDatumElevationMeters
  );
}

function wallFrame({ from, to }) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const dx = (to[0] - from[0]) / length;
  const dz = (to[1] - from[1]) / length;
  return {
    length,
    at(u, y, d) {
      const x = from[0] + dx * u - dz * d;
      const z = from[1] + dz * u + dx * d;
      return [x, atGround(x, z) + y, z];
    },
  };
}

function face(out, slot, corners, color) {
  quad(out, slot, corners, normalFor(...corners), color);
}

function block(out, wall, slot, lo, hi, y0, y1, d0, d1, color, chip = 0) {
  const { at } = wall;
  const bottom = [at(lo, y0, d0), at(hi, y0, d0), at(hi, y0, d1), at(lo, y0, d1)];
  const top = [
    at(lo + chip, y1 - chip * 0.16, d0 + chip * 0.46),
    at(hi - chip * 0.35, y1, d0 + chip * 0.3),
    at(hi - chip * 0.54, y1 - chip * 0.26, d1 - chip * 0.64),
    at(lo + chip * 0.42, y1 - chip * 0.09, d1 - chip * 0.36),
  ];
  face(out, slot, bottom, color);
  face(out, slot, [...top].reverse(), color);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(out, slot, [bottom[i], top[i], top[j], bottom[j]], color);
  }
}

function brokenCrest(wall, u, length) {
  const i = Math.min(wall.heights.length - 1, Math.floor((u / length) * wall.heights.length));
  return wall.heights[i];
}

function mainWall(out, level) {
  const wall = wallFrame(ashlar);
  const { length } = wall;
  const segments = ashlar.heights.length;
  const halfDepth = ashlar.depth * 0.5;
  for (let i = 0; i < segments; i++) {
    const from = (i / segments) * length;
    const to = ((i + 1) / segments) * length;
    const height = ashlar.heights[i];
    const inset = level > 0 ? 0.105 : 0;
    block(
      out,
      wall,
      'wall',
      from,
      to - 0.014,
      -0.58,
      height - inset,
      -halfDepth + inset,
      halfDepth - inset,
      level > 0 ? backing : ashlarTones[i % ashlarTones.length],
      level > 0 ? 0 : 0.09,
    );
  }
  if (level === 0) return;
  const courseCount = [0, 4, 6, 7][level];
  const courseHeight = 3.02 / courseCount;
  const stoneCount = [0, 21, 30, 35][level];
  const nominalWidth = length / stoneCount;
  for (let course = 0; course < courseCount; course++) {
    const stagger = course % 2 === 0 ? 0 : nominalWidth * 0.47;
    const base = -0.25 + course * courseHeight;
    for (let stone = -1; stone < stoneCount; stone++) {
      const variance = ((stone * 3 + course * 7 + 60) % 7) * 0.023;
      const from = Math.max(0, stone * nominalWidth + stagger + 0.039 + variance);
      const to = Math.min(length, (stone + 1) * nominalWidth + stagger - 0.046);
      const height = Math.min(
        base + courseHeight - 0.052,
        brokenCrest(ashlar, (from + to) * 0.5, length) - 0.018,
      );
      if (to - from < 0.19 || height - base < 0.16) continue;
      const variation = stone + course * 5 + 1;
      const depth = halfDepth + 0.025 * (variation % 5);
      const chip = level === 3 ? 0.064 + 0.012 * (variation % 6) : 0.043;
      const stoneColor = ashlarTones[variation % ashlarTones.length];
      block(out, wall, 'wall', from, to, base, height, depth - 0.28, depth, stoneColor, chip);
      block(
        out,
        wall,
        'wall',
        from + 0.012,
        to,
        base,
        height,
        -depth,
        -depth + 0.23,
        ashlarTones[(variation + 2) % ashlarTones.length],
        chip,
      );
    }
  }
}

function lowWalls(out, level) {
  for (const [wallIndex, trace] of ruins.entries()) {
    const wall = wallFrame(trace);
    const { length } = wall;
    const segments = trace.heights.length;
    for (let i = 0; i < segments; i++) {
      const from = (i / segments) * length;
      const to = ((i + 1) / segments) * length;
      const height = trace.heights[i];
      const depth = trace.depth * 0.5;
      block(
        out,
        wall,
        'foundation',
        from,
        to - 0.016,
        -0.39,
        height * 0.78,
        -depth,
        depth,
        rubbleTones[(i + wallIndex) % rubbleTones.length],
        0.075,
      );
      if (level === 0) continue;
      const count = Math.max(1, Math.round((to - from) / [0, 1.48, 0.98, 0.73][level]));
      const width = (to - from) / count;
      for (let j = 0; j < count; j++) {
        const shift = (wallIndex + i * 3 + j * 5) % 7;
        const exposed = 0.075 + (shift % 3) * 0.056;
        const halfWidth = depth * (0.72 + (shift % 4) * 0.055);
        const offset = (shift - 3) * 0.065;
        block(
          out,
          wall,
          'foundation',
          from + j * width + 0.034,
          from + (j + 1) * width - 0.048,
          height * 0.64,
          height * 0.78 + exposed,
          offset - halfWidth,
          offset + halfWidth,
          rubbleTones[(shift + i) % rubbleTones.length],
          0.068,
        );
      }
    }
  }
}

const detached = [
  [-20.2, -5.1, 1.08, 0.66, 0.72],
  [-19.1, -3.8, 0.77, 0.61, 0.55],
  [-16.3, -2.4, 0.92, 0.76, 0.49],
  [-16.1, -0.25, 0.54, 0.45, 0.32],
  [-14.2, 2.6, 0.92, 0.63, 0.4],
  [-13.3, 3.7, 0.65, 0.49, 0.29],
  [-10.5, -6.9, 1.18, 0.98, 0.66],
  [-7.6, -5.6, 0.93, 0.75, 0.57],
  [-2.2, -7.8, 0.7, 0.58, 0.39],
  [2.7, -5.7, 0.92, 0.58, 0.51],
  [12.3, -5.9, 1.34, 1.1, 0.81],
  [14.8, -4.8, 1.04, 0.89, 0.59],
  [15.9, -3.9, 1.15, 0.87, 0.61],
  [13.8, -1.25, 0.9, 0.75, 0.42],
  [13.9, 7.4, 0.61, 0.74, 0.36],
  [14.8, 8.2, 0.56, 0.57, 0.31],
  [8.2, 16.9, 0.87, 0.73, 0.32],
  [8.8, 16, 0.51, 0.49, 0.26],
];

function looseStone(out, level) {
  const count = [0, 8, 14, detached.length][level];
  for (let i = 0; i < count; i++) {
    const [x, z, width, depth, height] = detached[i];
    const angle = (((i * 7) % 13) - 6) * 0.126;
    const wall = wallFrame({ from: [x, z], to: [x + Math.cos(angle), z + Math.sin(angle)] });
    block(
      out,
      wall,
      'foundation',
      -width * 0.5,
      width * 0.5,
      -0.12,
      height,
      -depth * 0.5,
      depth * 0.5,
      rubbleTones[i % rubbleTones.length],
      Math.min(width, depth) * 0.19,
    );
  }
}

function draw(out, level) {
  mainWall(out, level);
  lowWalls(out, level);
  looseStone(out, level);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [-51, 29, 53];
const lookAt = [-3, 0.35, 1];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  ...(plan.wikidataId && { wikidataId: plan.wikidataId }),
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Valerian Palace in Bishapur, with an exposed wall of squared stone, an open excavated passage, fallen blocks and low stone foundations.',
  camera,
  lookAt,
  sunDirection: [-28, 71, 49],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['stone_limestone_raw', 'stone_limestone_weathered'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.75,
    groundY: -0.2,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'exposed-ruin-and-rubble', position: [-38, 19, 39], lookAt },
    { name: 'staggered-stone-face', position: [-18, 4, 7], lookAt: [-2, 1.6, -5] },
    { name: 'low-foundations-and-open-passage', position: [25, 15, 28], lookAt: [-2, 0.8, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `${slug}-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.85,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.42, surfaces },
      street: { export: 'street', errorMeters: 0.19, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.07, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original reconstruction from exact public-domain Qualla photographs, mapped site extent, published field archaeology and original terrain.',
};

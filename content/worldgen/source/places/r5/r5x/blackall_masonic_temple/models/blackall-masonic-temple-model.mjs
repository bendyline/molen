/** The raised two-storey Masonic hall on Hawthorn Street, Blackall. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url)));
const frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url)));
const d = plan.dimensions;
const centerX = (d.left + d.right) / 2;
const frontZ = (frame.geometry.outline[0][1] + frame.geometry.outline[1][1]) / 2;
const verandaX = (frame.geometry.outline[0][0] + frame.geometry.outline[3][0]) / 2;
const rearZ = (frame.geometry.outline[2][1] + frame.geometry.outline[3][1]) / 2;
const pale = rgb('d6c9ad');
const wood = rgb('9e8770');
const siding = rgb('b6a995');
const zinc = rgb('7b8180');
const sash = rgb('776455');
const glazing = rgb('485956');
const shade = rgb('665b4c');
const palette = 'palette:#ffffff';
const surfaces = {
  wall: { slot: 'wall', graph: 'wood_weatherboard', roughness: 0.92, metallic: 0 },
  metalWall: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.86, metallic: 0.1 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.74, metallic: 0.18 },
  trim: { slot: 'trim', graph: 'wood_weatherboard', roughness: 0.92, metallic: 0 },
  window: { slot: 'window', localRef: palette, roughness: 0.42, metallic: 0 },
};

function face(out, slot, points, normal, color) {
  if (points.length === 4) quad(out, slot, points, normal, color);
  else out.addConvexPolygon(slot, palette, points, normal, ([x, y, z]) => [x + z, y], color);
}

function top(out, slot, points, color) {
  const n = normalFor(...points);
  face(out, slot, points, n[1] < 0 ? n.map((v) => -v) : n, color);
}

function gable(out, x0, x1, z0, z1, low, peak) {
  const x = (x0 + x1) / 2;
  const a = [x, peak, z0];
  const b = [x, peak, z1];
  top(out, 'roof', [[x0, low, z0], [x0, low, z1], b, a], zinc);
  top(out, 'roof', [[x1, low, z1], [x1, low, z0], a, b], zinc);
  for (const [z, apex, s] of [
    [z0, a, -1],
    [z1, b, 1],
  ])
    face(out, 'trim', [[x0, low, z], [x1, low, z], apex], [0, 0, s], siding);
}

function trimRail(out, start, end, width, depth, tint = pale) {
  beam(out, 'trim', start, end, width, depth, tint);
}

function facade(out, level, side, plane, centers) {
  const alongX = Math.abs(side[2]) > 0;
  const start = alongX ? d.left : d.back;
  const end = alongX ? d.right : d.front;
  const sign = alongX ? side[2] : side[0];
  const p = (u, y, s) => (alongX ? [u, y, plane + sign * s] : [plane + sign * s, y, u]);
  const panel = (slot, u0, u1, y0, y1, off, tint) => {
    face(out, slot, [p(u0, y0, off), p(u1, y0, off), p(u1, y1, off), p(u0, y1, off)], side, tint);
  };
  if (level >= 1) {
    panel('trim', start, end, 4.89, 5.09, 0.075, pale);
    panel('trim', start, end, 0.43, 0.66, 0.075, wood);
  }
  if (level >= 2) {
    const step = level === 3 ? 0.46 : 0.92;
    for (let u = start + 0.21; u < end; u += step) {
      if (centers.some((v) => Math.abs(v - u) < 0.59)) {
        panel('trim', u - 0.036, u + 0.036, 0.66, 1.22, 0.11, wood);
        panel('trim', u - 0.036, u + 0.036, 3.42, 4.88, 0.11, wood);
      } else panel('trim', u - 0.036, u + 0.036, 0.66, 4.88, 0.11, wood);
    }
  }
  for (const u of centers) {
    const y = 1.37;
    if (level >= 1) {
      panel('trim', u - 0.58, u + 0.58, y - 0.11, y + 1.97, 0.105, pale);
      panel('window', u - 0.41, u + 0.41, y, y + 1.82, 0.124, glazing);
      panel('trim', u - 0.43, u + 0.43, y + 0.78, y + 0.87, 0.152, sash);
    }
    if (level >= 2) {
      panel('trim', u - 0.038, u + 0.038, y, y + 1.82, 0.15, pale);
      const e = 0.63;
      top(
        out,
        'roof',
        [
          p(u - e, y + 1.99, 0.04),
          p(u + e, y + 1.99, 0.04),
          p(u + e, y + 1.67, 0.68),
          p(u - e, y + 1.67, 0.68),
        ],
        zinc,
      );
    }
    if (level >= 2 && !alongX) {
      panel('trim', u - 0.51, u + 0.51, 6.18, 7.77, 0.13, pale);
      panel('window', u - 0.39, u + 0.39, 6.29, 7.66, 0.15, glazing);
      if (level === 3) {
        panel('trim', u - 0.035, u + 0.035, 6.29, 7.66, 0.172, pale);
        panel('trim', u - 0.39, u + 0.39, 6.96, 7.04, 0.175, pale);
      }
    }
  }
  if (alongX && sign > 0) {
    panel('trim', centerX - 1.1, centerX + 1.1, 0.46, 3.22, 0.127, pale);
    panel('trim', centerX - 0.96, centerX + 0.96, 0.49, 3.05, 0.152, shade);
    if (level >= 1) {
      panel('trim', centerX - 0.04, centerX + 0.04, 0.53, 3.03, 0.175, wood);
      panel('window', centerX - 0.66, centerX - 0.21, 2.06, 2.77, 0.178, glazing);
      panel('window', centerX + 0.21, centerX + 0.66, 2.06, 2.77, 0.178, glazing);
    }
  }
}

function veranda(out, level) {
  const [l, r] = [verandaX, d.right + 0.34];
  const leanY = 3.34;
  const wallY = 4.93;
  const insideZ = d.front + 0.01;
  const end = d.back - 0.12;
  const front = frontZ - 0.03;
  const back = rearZ + 0.08;
  box(out, 'trim', [l, -0.16, end], [d.left, 0.43, front], wood);
  box(out, 'trim', [l, -0.16, insideZ], [r, 0.43, front], wood);
  box(out, 'trim', [l, -0.16, back], [r, 0.43, end], wood);
  top(
    out,
    'roof',
    [
      [l, leanY, front],
      [l, leanY, end],
      [d.left, wallY, end],
      [d.left, wallY, insideZ],
    ],
    zinc,
  );
  top(
    out,
    'roof',
    [
      [l, leanY, front],
      [r, leanY, front],
      [r, wallY, insideZ],
      [d.left, wallY, insideZ],
    ],
    zinc,
  );
  const stairCutX = centerX - 1.46;
  const stairCutZ = d.back - 1.34;
  const stairCutY = leanY + ((wallY - leanY) * (stairCutZ - back)) / (end - back);
  top(
    out,
    'roof',
    [
      [l, leanY, back],
      [l, wallY, end],
      [stairCutX, wallY, end],
      [stairCutX, leanY, back],
    ],
    zinc,
  );
  top(
    out,
    'roof',
    [
      [stairCutX, leanY, back],
      [stairCutX, stairCutY, stairCutZ],
      [r, stairCutY, stairCutZ],
      [r, leanY, back],
    ],
    zinc,
  );
  gable(out, centerX - 1.98, centerX + 1.98, insideZ - 0.36, front + 0.12, 3.42, 5.67);
  for (const [axis, from, to, constant] of [
    [0, l + 0.15, r - 0.1, front - 0.2],
    [1, end + 0.24, front - 0.75, l + 0.17],
    [0, l + 0.22, r - 0.18, back + 0.26],
  ]) {
    const samples = level === 0 ? Math.ceil((to - from) / 4.25) : Math.round((to - from) / 1.8);
    for (let i = 0; i <= samples; i++) {
      const u = from + ((to - from) * i) / samples;
      if (axis === 0 && constant > 0 && Math.abs(u - centerX) < 1.18) continue;
      const [x, z] = axis === 0 ? [u, constant] : [constant, u];
      const w = level === 0 ? 0.15 : 0.09;
      box(out, 'trim', [x - w, 0.4, z - w], [x + w, leanY + 0.21, z + w], pale);
    }
  }
  if (level < 1) return;
  trimRail(out, [l, leanY, front], [r, leanY, front], 0.15, 0.13);
  trimRail(out, [l, leanY, end], [l, leanY, front], 0.15, 0.13);
  trimRail(out, [l, leanY, back], [r, leanY, back], 0.15, 0.13);
  for (const side of [-1, 1]) {
    const x = centerX + side * 1.48;
    box(out, 'trim', [x - 0.11, 0.36, front - 0.22], [x + 0.11, 3.67, front], pale);
    trimRail(
      out,
      [centerX + side * 1.98, 3.42, front + 0.15],
      [centerX, 5.7, front + 0.15],
      0.16,
      0.1,
    );
  }
  box(out, 'trim', [centerX - 1.26, 0.01, front - 0.25], [centerX + 1.26, 0.2, front + 0.5], wood);
  box(
    out,
    'trim',
    [centerX - 1.21, 0.16, front - 0.33],
    [centerX + 1.21, 0.41, front + 0.23],
    pale,
  );
}

function stairs(out, level) {
  if (level === 0) return;
  const z = d.back - 0.71;
  const lo = d.left + 1.5;
  const high = d.right - 1.1;
  const steps = level >= 2 ? 20 : 12;
  trimRail(out, [lo, 0.18, z], [high, 4.93, z], 0.34, 0.7, wood);
  for (let i = 0; i < steps; i++) {
    const x = lo + ((high - lo) * i) / steps;
    const y = 0.16 + ((4.88 - 0.16) * i) / steps;
    box(out, 'trim', [x, y, z - 0.45], [x + (high - lo) / steps + 0.03, y + 0.12, z + 0.45], wood);
  }
  box(out, 'trim', [high - 0.55, 4.76, z - 0.45], [high + 0.63, 4.94, d.back], wood);
  face(
    out,
    'window',
    [
      [high - 0.45, 4.95, d.back - 0.031],
      [high + 0.45, 4.95, d.back - 0.031],
      [high + 0.45, 7.05, d.back - 0.031],
      [high - 0.45, 7.05, d.back - 0.031],
    ],
    [0, 0, -1],
    shade,
  );
  if (level < 2) return;
  for (const side of [-1, 1]) {
    trimRail(out, [lo, 1.16, z + side * 0.46], [high, 5.91, z + side * 0.46], 0.09, 0.09, pale);
    for (let i = 0; i <= 6; i++) {
      const x = lo + ((high - lo) * i) / 6;
      const y = 0.16 + ((4.88 - 0.16) * i) / 6;
      box(
        out,
        'trim',
        [x - 0.055, y, z + side * 0.46 - 0.045],
        [x + 0.055, y + 1.01, z + side * 0.46 + 0.045],
        pale,
      );
    }
  }
}

function draw(out, level) {
  box(out, 'wall', [d.left, d.floorY, d.back], [d.right, d.splitY, d.front], siding);
  box(out, 'metalWall', [d.left, d.splitY - 0.02, d.back], [d.right, d.eavesY, d.front], siding);
  const plinthSupports =
    level > 0
      ? [d.left + 0.38, -2.43, 0.55, 3.47, d.right - 0.35]
      : [d.left + 0.38, d.right - 0.35];
  for (const x of plinthSupports)
    for (const z of [d.back + 0.44, d.front - 0.4])
      box(out, 'trim', [x - 0.22, -0.5, z - 0.22], [x + 0.22, d.floorY + 0.01, z + 0.22], shade);
  gable(out, d.left - 0.32, d.right + 0.32, d.back - 0.25, d.front + 0.28, d.eavesY, d.peakY);
  if (level > 1)
    trimRail(
      out,
      [centerX, d.peakY, d.back - 0.28],
      [centerX, d.peakY, d.front + 0.32],
      0.12,
      0.13,
      zinc,
    );
  facade(out, level, [0, 0, 1], d.front, [d.left + 1.25, centerX - 2.75, d.right - 1.55]);
  facade(out, level, [0, 0, -1], d.back, [d.left + 2.05, d.right - 1.65]);
  facade(out, level, [-1, 0, 0], d.left, [-5.85, -0.75, 4.2]);
  facade(out, level, [1, 0, 0], d.right, [-5.65, -2.05, 1.65, 5.15]);
  veranda(out, level);
  stairs(out, level);
}
export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [22, 14, 35];
const lookAt = [0, 4.9, 0];
const module = `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`;
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: `${slug}-model.mjs`,
  surfaces,
  build: closeup,
  wikidataId: plan.wikidataId,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The standing Blackall Masonic Temple with raised timber walls, a two-storey corrugated gable, and a veranda with a steep Hawthorn Street entrance.',
  camera,
  lookAt,
  sunDirection: [23, 31, 57],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['wood_weatherboard', 'metal_corrugated'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.53,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'hawthorn-street-and-veranda', position: [-14, 7, 28], lookAt: [0, 4.5, 2] },
    { name: 'gable-roof-and-timber-studs', position: [24, 12, 10], lookAt: [1, 5.0, 1] },
    { name: 'rear-stair-and-raised-hall', position: [14, 9, -23], lookAt: [0, 4.2, -4] },
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
    errorMeters: 0.62,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.25, surfaces },
      street: { export: 'street', errorMeters: 0.09, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.03, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Independent reconstruction from the public-domain 1908 Perroux photo published by Qualla, its matching archival TIFF, the mapped footprint and documented materials and layout.',
};

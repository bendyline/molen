import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { engine, boiler, floor, foundationBase } = plan.dimensions;
const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.92 },
  stone: { slot: 'foundation', graph: 'stone_basalt', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.79, metallic: 0.25 },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.87 },
};
const color = {
  brick: rgb('a17b6c'),
  gable: rgb('926858'),
  dark: rgb('585756'),
  roof: rgb('4f5355'),
  stone: rgb('797873'),
  stoneLight: rgb('9a978d'),
  glass: rgb('303c40'),
  sash: rgb('c2baa8'),
  boilerDoor: rgb('4f5351'),
};
const white = 'palette:#ffffff';

function face(out, slot, points, tint) {
  const normal = normalFor(...points);
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else out.addConvexPolygon(slot, white, points, normal, (p) => [p[0], p[2]], tint);
}

function wallPoint(a, b) {
  const width = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const dx = (b[0] - a[0]) / width,
    dz = (b[1] - a[1]) / width;
  return {
    width,
    point: (u, y, offset = 0) => [a[0] + dx * u - dz * offset, y, a[1] + dz * u + dx * offset],
  };
}

function band(out, slot, point, left, right, bottom, top, tint, offset = 0) {
  face(
    out,
    slot,
    [
      point(left, bottom, offset),
      point(right, bottom, offset),
      point(right, top, offset),
      point(left, top, offset),
    ],
    tint,
  );
}

function archead(left, right, bottom, arcHeight, steps) {
  const middle = (left + right) * 0.5;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = Math.PI * (1 - i / steps);
    return [middle + (right - left) * 0.5 * Math.cos(a), bottom + arcHeight * Math.sin(a)];
  });
}

function drawOpening(out, point, hole, wallLow, wallHigh, detail) {
  const { left, right, low, spring, rise, door } = hole;
  const steps = [3, 5, 8, 10][detail];
  const arch = archead(left, right, spring, rise, steps);
  if (low > wallLow) band(out, 'brick', point, left, right, wallLow, low, color.brick);
  const ring = [
    point(left, low, -0.16),
    point(right, low, -0.16),
    ...arch.toReversed().map(([u, y]) => point(u, y, -0.16)),
  ];
  face(out, 'trim', ring, door ? color.boilerDoor : color.glass);
  for (let i = 1; i < arch.length; i++) {
    const [a, b] = arch.slice(i - 1, i + 1);
    face(
      out,
      'brick',
      [point(a[0], a[1]), point(b[0], b[1]), point(b[0], wallHigh), point(a[0], wallHigh)],
      color.brick,
    );
  }
  if (detail === 0) return;
  const lintel = archead(left - 0.14, right + 0.14, spring, rise + 0.14, steps);
  for (let i = 1; i < arch.length; i++) {
    const [a, b] = arch.slice(i - 1, i + 1);
    face(
      out,
      'stone',
      [
        point(a[0], a[1], 0.034),
        point(b[0], b[1], 0.034),
        point(...lintel[i], 0.034),
        point(...lintel[i - 1], 0.034),
      ],
      i % 2 === 0 ? color.stone : color.stoneLight,
    );
    face(
      out,
      'stone',
      [point(a[0], a[1], -0.16), point(b[0], b[1], -0.16), point(b[0], b[1]), point(a[0], a[1])],
      color.stone,
    );
  }
  for (const edge of [left, right]) {
    const jamb = edge === left ? left - 0.14 : right - 0.01;
    band(out, 'stone', point, jamb, jamb + 0.15, low, spring, color.stone, 0.027);
    const reveal = [
      point(edge, low),
      point(edge, spring),
      point(edge, spring, -0.16),
      point(edge, low, -0.16),
    ];
    face(out, 'stone', edge === left ? reveal.reverse() : reveal, color.stone);
  }
  if (door) {
    if (detail > 0) {
      const middle = (left + right) * 0.5;
      band(
        out,
        'trim',
        point,
        middle - 0.026,
        middle + 0.026,
        low + 0.03,
        spring,
        color.dark,
        -0.14,
      );
      band(
        out,
        'trim',
        point,
        left + 0.055,
        right - 0.055,
        spring - 0.07,
        spring + 0.005,
        color.dark,
        -0.14,
      );
    }
    return;
  }
  band(
    out,
    'stone',
    point,
    left - 0.19,
    right + 0.19,
    low - 0.14,
    low + 0.021,
    color.stoneLight,
    0.07,
  );
  const fractions = detail === 1 ? [0.5] : [0.33, 0.67];
  for (const f of fractions) {
    const u = left + (right - left) * f;
    band(out, 'trim', point, u - 0.026, u + 0.026, low, spring + rise * 0.86, color.sash, -0.12);
  }
  for (const f of detail === 1 ? [0.5] : [0.26, 0.51, 0.76, 0.99]) {
    const y = low + (spring - low) * f;
    band(out, 'trim', point, left, right, y - 0.027, y + 0.027, color.sash, -0.12);
  }
  if (detail === 3) {
    const y = spring + rise * 0.45;
    const d = (right - left) * 0.425;
    const u = (left + right) * 0.5;
    band(out, 'trim', point, u - d, u + d, y - 0.021, y + 0.021, color.sash, -0.118);
  }
}

function elevation(out, a, b, low, high, windows, detail) {
  const { width, point } = wallPoint(a, b);
  let previous = 0;
  for (const hole of windows) {
    band(out, 'brick', point, previous, hole.left, low, high, color.brick);
    drawOpening(out, point, hole, low, high, detail);
    previous = hole.right;
  }
  band(out, 'brick', point, previous, width, low, high, color.brick);
}

function opening(center, width, low, spring, rise, door = false) {
  return { left: center - width / 2, right: center + width / 2, low, spring, rise, door };
}

function roof(out, [x0, x1], [z0, z1], eave, rise) {
  const x = (x0 + x1) * 0.5;
  const setback = (x1 - x0) * 0.4;
  const left = [x, eave + rise, z0 + setback],
    right = [x, eave + rise, z1 - setback];
  const corners = [
    [x0, eave, z0],
    [x0, eave, z1],
    [x1, eave, z1],
    [x1, eave, z0],
  ];
  face(out, 'roof', [corners[0], corners[1], right, left], color.roof);
  face(out, 'roof', [corners[1], corners[2], right], color.roof);
  face(out, 'roof', [corners[2], corners[3], left, right], color.roof);
  face(out, 'roof', [corners[3], corners[0], left], color.roof);
}

function styles(length, index, isEngine, upper) {
  if (isEngine) {
    if (!upper && index === 0) return [opening(1.17, 1.08, floor + 1.35, floor + 2.74, 0.46)];
    const centers = (
      index === 0 ? [0.19, 0.51, 0.82] : index === 2 ? [0.17, 0.48, 0.79] : [0.19, 0.5, 0.81]
    ).map((f) => f * length);
    if (upper) return centers.map((u) => opening(u, 1.44, floor + 4.76, floor + 6.84, 0.68));
    return centers.map((u, i) =>
      index === 1 && i === 1
        ? opening(u, 1.74, floor + 0.015, floor + 2.73, 0.81, true)
        : opening(u, 1.42, floor + 1.02, floor + 2.81, 0.65),
    );
  }
  if (index === 2) return [];
  if (index === 1)
    return [0.19, 0.5, 0.81].map((f) =>
      opening(f * length, 2.53, floor + 0.025, floor + 2.48, 1.05, true),
    );
  return [0.24, 0.51, 0.78].map((f) => opening(f * length, 1.76, floor + 0.9, floor + 3.08, 0.73));
}

function volume(out, part, isEngine, detail) {
  const [[x0, x1], [z0, z1]] = part.footprint;
  const eave = floor + part.wallHeight;
  const corners = [
    [x0, z0],
    [x0, z1],
    [x1, z1],
    [x1, z0],
  ];
  box(
    out,
    'stone',
    [x0 - 0.07, foundationBase, z0 - 0.07],
    [x1 + 0.07, floor + 0.015, z1 + 0.07],
    color.stone,
  );
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i],
      b = corners[(i + 1) % corners.length];
    const w = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const split = isEngine ? floor + 4.27 : eave;
    elevation(out, a, b, floor, split, styles(w, i, isEngine, false), detail);
    if (isEngine) elevation(out, a, b, split, eave, styles(w, i, true, true), detail);
  }
  if (isEngine)
    box(
      out,
      'stone',
      [x0 - 0.1, floor + 4.2, z0 - 0.1],
      [x1 + 0.1, floor + 4.33, z1 + 0.1],
      color.stoneLight,
    );
  box(
    out,
    'brick',
    [x0 - 0.16, eave - 0.2, z0 - 0.16],
    [x1 + 0.16, eave + 0.012, z1 + 0.16],
    color.gable,
  );
  box(
    out,
    'trim',
    [x0 - 0.22, eave - 0.013, z0 - 0.22],
    [x1 + 0.22, eave + 0.12, z1 + 0.22],
    color.dark,
  );
  roof(out, [x0 - 0.23, x1 + 0.23], [z0 - 0.23, z1 + 0.23], eave + 0.12, part.roofRise);
  if (detail > 0) {
    const rows = isEngine ? 12 : 7;
    for (const [x, z] of corners)
      for (let i = 0; i < rows; i++) {
        const y = floor + 0.18 + (i * (eave - floor - 0.36)) / rows;
        const radius = i % 2 === 0 ? 0.2 : 0.15;
        box(out, 'stone', [x - radius, y, z - 0.18], [x + radius, y + 0.29, z + 0.18], color.stone);
      }
  } else {
    for (const [x, z] of corners)
      box(
        out,
        'stone',
        [x - 0.14, floor + 0.05, z - 0.14],
        [x + 0.14, eave - 0.18, z + 0.14],
        color.stone,
      );
  }
}

function threshold(out, part, span) {
  const [x0, x1] = part.footprint[0];
  const z = part.footprint[1][1];
  const u = (x0 + x1) * 0.5;
  for (let i = 0; i < 3; i++)
    box(
      out,
      'stone',
      [u - span / 2 - i * 0.08, -0.24, z + 0.06],
      [u + span / 2 + i * 0.08, floor - i * 0.143, z + 0.35 + i * 0.28],
      color.stoneLight,
    );
}

function draw(out, detail) {
  volume(out, engine, true, detail);
  volume(out, boiler, false, detail);
  threshold(out, engine, 2.6);
  threshold(out, boiler, 2.83);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model,
  slug = id.replaceAll('_', '-');
const camera = [-28, 15, 29],
  lookAt = [-1, 4.6, 1.7];
export const model = {
  id,
  key: id,
  title: plan.title,
  wikidataId: plan.wikidataId,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.floorBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: plan.sectionBasis,
  camera,
  lookAt,
  sunDirection: [-53, 87, 60],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['brick_flemish', 'stone_basalt', 'metal_corrugated'],
  mediumFiContext: {
    scale: 0.84,
    cameraYaw: 3.82,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'brick-engine-house', position: [18, 10, 34], lookAt: [4, 4.3, 3] },
    { name: 'boiler-arches-and-basalt', position: [-12, 4.8, 24], lookAt: [-6, 2.8, 8] },
    { name: 'lakeside-and-hipped-roofs', position: [32, 20, -29], lookAt: [1, 4, 0] },
    { name: 'quoins-and-multipane-sash', position: [20, 5.9, -18], lookAt: [9, 5.5, -6] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.29,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.13, surfaces },
      street: { export: 'street', errorMeters: 0.063, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.026, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original reconstruction based on the public-domain 1922 municipal handbook, the heritage records and attributed open map and elevation data.',
};

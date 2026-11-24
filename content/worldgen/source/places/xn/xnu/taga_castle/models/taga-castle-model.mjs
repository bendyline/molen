import { readFileSync } from 'node:fs';
import {
  at,
  cap,
  closed,
  face,
  floorSampler,
  mix,
  pairs,
  planarMid,
  rect,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  extrude,
  lathe,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const survey = floorSampler(read('terrain-grid'));
const mapped = (id) => frame.features.find((feature) => feature.id === 'way/' + id).points;
const ring = (id) => mapped(id).slice(0, -1);
const terrainOutline = [
  [-52, -49],
  [58, -49],
  [58, 75],
  [44, 84],
  [21, 95],
  [13, 120],
  [-9, 120],
  [-13, 96],
  [-35, 84],
  [-51, 74],
];
const floor = -7.2;
const brownStone = rgb('8b826f');
const granite = rgb('998f7d');
const palest = rgb('b4ad9e');
const formerClay = rgb('aa7767');
const oldAsh = rgb('827d72');
const dryGravel = rgb('bec3b4');
const field = rgb('969354');
const grass = rgb('82884e');
const path = rgb('b29466');
const surfaces = {
  field: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.99 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.94 },
  wall: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.94 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.98 },
  clay: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.97 },
};

const boundarySides = pairs(closed(terrainOutline));
const rowBreaks = [...new Set(terrainOutline.map((point) => point[1]))].sort((a, b) => a - b);
function rowExtent(z) {
  const intercepts = [];
  for (const [[ax, az], [bx, bz]] of boundarySides) {
    if (az === z) intercepts.push(ax);
    if (Math.min(az, bz) < z && Math.max(az, bz) > z) {
      intercepts.push(mix(ax, bx, (z - az) / (bz - az)));
    }
  }
  return [Math.min(...intercepts), Math.max(...intercepts)];
}

function terrain(out, detail) {
  const columns = [12, 24, 47, 82][detail];
  const targetStep = [12.8, 7.3, 3.4, 1.75][detail];
  const levels = pairs(rowBreaks).flatMap(([a, b]) => {
    const count = Math.ceil((b - a) / targetStep);
    return Array.from({ length: count }, (_, i) => mix(a, b, i / count));
  });
  levels.push(rowBreaks.at(-1));
  const rows = levels.map((z) => {
    const [left, right] = rowExtent(z);
    return Array.from({ length: columns + 1 }, (_, i) => {
      const x = mix(left, right, i / columns);
      return [x, survey([x, z]), z];
    });
  });
  for (const [top, bottom] of pairs(rows)) {
    for (let i = 0; i < columns; i++) {
      const [x, , z] = top[i];
      const soft =
        0.38 + 0.22 * Math.sin(x * 0.145 + z * 0.197) + 0.15 * Math.sin(x * 0.44 - z * 0.31);
      const shade = field.map((component, axis) => mix(component, grass[axis], soft));
      face(out, 'field', [top[i], bottom[i], bottom[i + 1]], [0, 1, 0], shade);
      face(out, 'field', [top[i], bottom[i + 1], top[i + 1]], [0, 1, 0], shade);
    }
  }
  const border = [
    ...rows[0],
    ...rows.slice(1).map((row) => row.at(-1)),
    ...rows.at(-1).slice(0, -1).toReversed(),
    ...rows
      .slice(1, -1)
      .toReversed()
      .map((row) => row[0]),
  ];
  for (const [a, b] of pairs(closed(border))) {
    face(
      out,
      'field',
      [a, b, [b[0], floor, b[2]], [a[0], floor, a[2]]],
      [b[2] - a[2], 0, a[0] - b[0]],
      grass,
    );
  }
}

function groundStrip(out, points, width, style, color, detail, lift = 0.15) {
  const samples = pairs(points).flatMap(([[x, z], [a, b]]) => {
    const count = Math.ceil(Math.hypot(a - x, b - z) / [10, 5, 2.6, 1.65][detail]);
    return Array.from({ length: count }, (_, i) => [mix(x, a, i / count), mix(z, b, i / count)]);
  });
  samples.push(points.at(-1));
  const sections = samples.map(([x, z], i) => {
    const a = samples[Math.max(0, i - 1)];
    const b = samples[Math.min(samples.length - 1, i + 1)];
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      delta = (width * 0.5) / Math.hypot(dx, dz);
    return [-delta, delta].map((shift) => {
      const n = [x - dz * shift, z + dx * shift];
      return at(n, survey(n) + lift);
    });
  });
  for (const [a, b] of pairs(sections)) {
    face(out, style, [a[0], b[0], b[1]], [0, 1, 0], color);
    face(out, style, [a[0], b[1], a[1]], [0, 1, 0], color);
  }
}

function segmentFoundation(out, outline, tint, color, detail) {
  const center = planarMid(outline);
  for (const [index, [a, b]] of pairs(closed(outline)).entries()) {
    const length = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const divisions = Math.max(1, Math.ceil(length / [12, 5.5, 2.65, 1.7][detail]));
    const inner = (point) => point.map((v, axis) => mix(v, center[axis], 0.13));
    const corner = (i, f) => {
      const uv = [mix(a[0], b[0], i / divisions), mix(a[1], b[1], i / divisions)];
      const p = f ? inner(uv) : uv;
      return at(p, survey(p) + 0.18);
    };
    for (let i = 0; i < divisions; i++) {
      const p = corner(i, false),
        q = corner(i + 1, false),
        r = corner(i + 1, true),
        s = corner(i, true);
      face(out, 'clay', [p, q, r], [0, 1, 0], tint);
      face(out, 'clay', [p, r, s], [0, 1, 0], tint);
      face(out, 'clay', [s, r, at(center, survey(center) + 0.18)], [0, 1, 0], color);
      face(
        out,
        'wall',
        [p, [p[0], p[1] - 0.34, p[2]], [q[0], q[1] - 0.34, q[2]], q],
        [q[2] - p[2], 0, p[0] - q[0]],
        brownStone,
      );
    }
  }
}

function setStone(out, x, z, size, top, index, detail) {
  const shades = [granite, palest, brownStone];
  const y = top + 0.035;
  const base = size * (0.9 + 0.1 * Math.sin(index * 2.579));
  const sides = detail < 2 ? 5 : 7;
  lathe(
    out,
    'stone',
    [x, z],
    [
      [y, base, base * 0.82],
      [y + 0.21, base * 0.8, base * 0.74],
      [y + 0.29, base * 0.62, base * 0.57],
    ],
    sides,
    shades[index % 3],
    { rotation: index * 0.481 },
  );
}
function markers(out, outline, columns, rows, baseSize, detail, top) {
  const xs = outline.map((point) => point[0]),
    zs = outline.map((point) => point[1]);
  const l = Math.min(...xs) + 1.15,
    r = Math.max(...xs) - 1.15;
  const f = Math.min(...zs) + 1.15,
    b = Math.max(...zs) - 1.15;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      if (i > 0 && i + 1 < columns && j > 0 && j + 1 < rows && (i + j) % 3 === 1) continue;
      const x = mix(l, r, i / (columns - 1)),
        z = mix(f, b, j / (rows - 1));
      setStone(out, x, z, baseSize, top ?? survey([x, z]) + 0.2, i + j * columns, detail);
    }
  }
}

function stairs(out, x, z, top, bottom, width, depth, count, sign) {
  for (let i = 0; i < count; i++) {
    const faceZ = z + sign * depth * (i / count);
    const backZ = z + sign * depth * ((i + 1) / count);
    const step = mix(top, bottom, (i + 1) / count);
    abox(
      out,
      'stone',
      [x - width * 0.5, bottom - 0.32, Math.min(faceZ, backZ)],
      [x + width * 0.5, step + 0.12, Math.max(faceZ, backZ)],
      i % 2 ? brownStone : granite,
    );
  }
}

function mainPlinth(out, detail) {
  const base = ring(1083460335);
  const top = 3.24;
  extrude(out, 'wall', base, 2.2, top - 0.15, brownStone, { top: false });
  extrude(out, 'stone', base, top - 0.17, top - 0.036, granite, { top: false });
  cap(out, 'clay', base, top, formerClay);
  cap(out, 'clay', rect(-6.92, -3.44, 17.2, 10.61), top + 0.014, oldAsh);
  for (const id of [1083460322, 1083460323, 1083460324, 1083460331, 1083460332]) {
    const p = planarMid(mapped(id));
    const front = p[1] > 0;
    const z = front ? 11.91 : -4.88;
    stairs(
      out,
      p[0],
      z,
      top,
      survey([p[0], z + (front ? 1 : -1) * 1.78]),
      front ? 2.78 : 1.93,
      front ? 1.62 : 1.2,
      front ? 4 : 3,
      front ? 1 : -1,
    );
  }
  if (detail < 1) return;
  markers(out, base, 7, 4, 0.46, detail, top);
}

function build(out, detail) {
  terrain(out, detail);
  mainPlinth(out, detail);
  const pads = [
    [1083460309, 6, 2, 0.34],
    [1083460327, 3, 5, 0.36],
    [1083460328, 3, 5, 0.38],
    [1083460329, 4, 3, 0.28],
    [1083460330, 4, 3, 0.28],
    [1083460336, 5, 3, 0.36],
    [1083460325, 2, 3, 0.23],
    [1083460326, 2, 3, 0.23],
  ];
  for (const [id, columns, rows, stoneSize] of pads.slice(0, detail === 0 ? 3 : 8)) {
    const outline = ring(id);
    segmentFoundation(out, outline, formerClay, oldAsh, detail);
    if (detail >= 2 && id !== 1083460309) markers(out, outline, columns, rows, stoneSize, detail);
  }
  const approach = [
    [
      [3.04, 118.3],
      [3.4, 95.32],
      [3.4, 90],
      [3.4, 79],
    ],
    3.25,
  ];
  groundStrip(out, ...approach, 'field', path, detail, 0.2);
  const gravelPaths = [
    [1083460310, 2.0],
    [1083460333, 2.3],
    [1083460334, 2.0],
  ];
  for (const [id, width] of gravelPaths)
    groundStrip(out, mapped(id), width, 'gravel', dryGravel, detail, 0.22);
  if (detail >= 1) {
    groundStrip(
      out,
      [
        [4.08, 45.47],
        [4.4, 16.55],
      ],
      3.35,
      'field',
      path,
      detail,
      0.14,
    );
    segmentFoundation(out, ring(1083460344), brownStone, granite, detail);
    stairs(out, 3.4, 91.66, survey([3.4, 91.66]) + 0.1, survey([3.4, 95.3]), 3.15, 3.63, 7, 1);
  }
  if (detail >= 2) {
    stairs(out, 14.93, 92.1, survey([14.93, 92.1]) + 0.1, survey([14.93, 95.94]), 2.2, 3.84, 7, 1);
    const point = [-12.3, 14.85];
    const y = survey(point);
    abox(
      out,
      'stone',
      [point[0] - 0.17, y - 0.2, point[1] - 0.14],
      [point[0] + 0.17, y + 1.24, point[1] + 0.14],
      brownStone,
    );
  }
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'taga-castle-model.mjs';
const camera = [105, 111, 151];
const lookAt = [4, 2, 27];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'archaeological',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'The excavated central government enclosure at Taga Castle, including the main plinth, associated foundation stones and south approach.',
  camera,
  lookAt,
  sunDirection: [-34, 54, 61],
  mediumFiContext: {
    scale: 2.65,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline: terrainOutline,
    minHeight: floor,
    basis:
      'Limited to the central excavated enclosure and immediate approach. The authored surface reproduces the surveyed hilltop.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'central-enclosure-and-south-approach', position: camera, lookAt },
    { name: 'main-hall-plinth-and-three-stairs', position: [29, 10, 32], lookAt: [4.55, 2.9, 3.5] },
    {
      name: 'rear-hall-and-flanking-foundations',
      position: [-34, 28, -55],
      lookAt: [5.1, 3.2, 1.5],
    },
    {
      name: 'inner-south-gate-and-ascending-path',
      position: [7, 7.5, 100],
      lookAt: [3.6, 1.2, 53],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'taga-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 2.16,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 1.13, surfaces },
      street: { export: 'street', errorMeters: 0.42, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.145, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from Saigen Jiro’s original CC0 Qualla photographs, OSM native mapped geometry under ODbL, and Japanese GSI DEM1A elevation data.',
};

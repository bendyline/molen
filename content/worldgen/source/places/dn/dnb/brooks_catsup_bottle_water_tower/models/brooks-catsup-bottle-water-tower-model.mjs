import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  face,
  floorSampler,
  mix,
  pairs,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { abox, rgb } from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name, import.meta.url)));
const plan = read('plan-controls.json');
const frame = read('map-frame.json');
const grade = floorSampler(read('terrain-grid.json'));
const d = plan.dimensions;

const surfaces = {
  foundation: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.19 },
  paint: { slot: 'wall', localRef: 'palette:#ffffff', roughness: 0.87 },
  cap: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.81, metallic: 0.19 },
};
const ground = rgb('969387');
const steel = rgb('60645c');
const angleIron = rgb('777c73');
const red = rgb('a34f49');
const warmRed = rgb('a8534c');
const darkRed = rgb('904943');
const black = rgb('464e4b');
const white = rgb('e5d8bf');
const silver = rgb('c3c5ba');

const height = d.supportHeightM;
const tank = [
  [0, 0.93, steel],
  [0.22, 1.97, steel],
  [0.76, 3.18, darkRed],
  [1.41, d.maximumTankDiameterM / 2, red],
  [2.02, d.maximumTankDiameterM / 2, red],
  [5.95, 3.75, warmRed],
  [8.09, 3.65, warmRed],
  [9.76, 3.24, warmRed],
  [10.38, 3.05, white],
  [10.51, 3.02, black],
  [11.87, 2.73, black],
  [13.53, 2.43, black],
  [13.63, 2.41, white],
  [13.76, 2.39, red],
  [15.08, 2.12, red],
  [16.45, 1.86, red],
  [17.91, 1.57, red],
  [18.24, 1.5, white],
  [18.34, 1.47, red],
  [19.18, 1.22, red],
  [19.56, 1.19, darkRed],
  [19.63, 1.28, darkRed],
  [19.84, 1.29, silver],
  [20.02, d.capDiameterM / 2, silver],
  [d.tankHeightM - 0.16, d.capDiameterM / 2, silver],
  [d.tankHeightM - 0.02, 1.1, silver],
  [d.tankHeightM, 0.81, silver],
];
const corners = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
const topOfSupport = height + 1.1;
const footHalfSpan = 3.83;
const supportTopSpan = 2.51;
const TAU = Math.PI * 2;
const turns = [16, 28, 48, 72];

function position([sx, sz], y) {
  const side = mix(footHalfSpan, supportTopSpan, y / topOfSupport);
  return [sx * side, y, sz * side];
}

function steelSupport(out, lod) {
  for (const key of corners) {
    const [x, , z] = position(key, 0);
    const level = grade([x, z]);
    abox(
      out,
      'foundation',
      [x - 0.58, level - 0.64, z - 0.58],
      [x + 0.58, level + 0.26, z + 0.58],
      ground,
      { bottom: false },
    );
    const base = position(key, level + 0.19);
    const tip = position(key, topOfSupport);
    beam(out, 'steel', base, tip, 0.31, 0.29, steel);
    if (lod > 1)
      for (const offset of [-1, 1]) {
        const k = offset * 0.143;
        beam(
          out,
          'steel',
          [base[0] + k, base[1], base[2]],
          [tip[0] + k, tip[1], tip[2]],
          0.075,
          0.38,
          angleIron,
        );
      }
  }

  const stops = lod === 0 ? [0.42, 10.32, 20.43, 30.65] : [0.42, 7.36, 15.12, 22.92, 30.65];
  for (const [i, corner] of corners.entries()) {
    const other = corners[(i + 1) % corners.length];
    for (const [bottom, top] of pairs(stops)) {
      const a = position(corner, bottom),
        b = position(other, bottom);
      const c = position(corner, top),
        e = position(other, top);
      beam(out, 'steel', c, e, lod === 0 ? 0.16 : 0.11, 0.12, steel);
      beam(out, 'steel', a, e, lod === 0 ? 0.09 : 0.071, 0.083, steel);
      beam(out, 'steel', b, c, lod === 0 ? 0.09 : 0.071, 0.083, steel);
      if (lod > 1) {
        const p = a.map((v, j) => (v + e[j]) / 2);
        beam(
          out,
          'steel',
          [p[0], p[1] - 0.12, p[2]],
          [p[0], p[1] + 0.12, p[2]],
          0.16,
          0.105,
          angleIron,
        );
      }
    }
  }

  const intake = [
    [0.13, 0.39],
    [height + 0.15, 0.34],
  ];
  loft(
    out,
    'steel',
    intake.map(([y, r]) => radialRing(y, r, r, lod > 1 ? 16 : 8)),
    steel,
    { cap: false },
  );

  if (lod > 0) {
    const x = 0.48,
      z = -2.32;
    const y = grade([x, z]);
    for (const s of [-1, 1])
      beam(
        out,
        'steel',
        [x + s * 0.27, y + 0.3, z],
        [x + s * 0.27, height + 1.94, z + 0.13],
        0.061,
        0.062,
        steel,
      );
    const increment = [1, 0.99, 0.61, 0.352][lod];
    for (let rung = y + 0.51; rung < height + 1.92; rung += increment) {
      const plane = z + (0.13 * (rung - y)) / height;
      beam(
        out,
        'steel',
        [x - 0.265, rung, plane],
        [x + 0.265, rung, plane],
        0.044,
        0.047,
        angleIron,
      );
    }
  }
}

const point = (radius, y, angle) => [radius * Math.sin(angle), y, radius * Math.cos(angle)];

function tankShell(out, lod) {
  const sides = turns[lod];
  const use =
    lod === 0
      ? tank.filter((_, i) => [0, 2, 3, 7, 8, 9, 12, 13, 18, 20, 23, 26].includes(i))
      : tank;
  for (const [[ya, ra, color], [yb, rb]] of pairs(use)) {
    const part = ya >= 19.84 ? 'cap' : 'paint';
    for (let j = 0; j < sides; j++) {
      const a = (j * TAU) / sides,
        b = ((j + 1) * TAU) / sides,
        mid = (a + b) / 2;
      face(
        out,
        part,
        [
          point(ra, ya + height, a),
          point(ra, ya + height, b),
          point(rb, yb + height, b),
          point(rb, yb + height, a),
        ],
        [Math.sin(mid), 0, Math.cos(mid)],
        color,
      );
    }
  }
  const last = tank.at(-1);
  const rim = radialRing(height + last[0], last[1], last[1], sides);
  out.addConvexPolygon('cap', 'palette:#ffffff', rim, [0, 1, 0], (p) => [p[0], p[2]], silver);
}

function walk(out, lod) {
  const n = [12, 20, 32, 48][lod];
  const low = height + 1.17;
  const large = d.maximumTankDiameterM / 2 + 0.3;
  const points = radialRing(low, large, large, n);
  loft(out, 'steel', [radialRing(low - 0.14, large - 0.05, large - 0.05, n), points], steel, {
    cap: false,
  });
  // The deck is a ring outside the bottle skin.
  for (const [a, b] of points.map((p, i) => [p, points[(i + 1) % n]])) {
    const inner = ([x, y, z]) => [x * 0.87, y, z * 0.87];
    face(out, 'steel', [a, b, inner(b), inner(a)], [0, 1, 0], steel);
  }
  if (lod > 0) {
    const handrail = points.map(([x, y, z]) => [x, y + 0.84, z]);
    beamPath(out, 'steel', handrail, 0.06, 0.065, angleIron, true);
    for (const [i, p] of points.entries())
      if (i % (lod === 3 ? 1 : 2) === 0) beam(out, 'steel', p, handrail[i], 0.058, 0.058, steel);
  }
}

function skinPoint(y, angle, lod, lift) {
  const pair = pairs(tank).find(([, [hi]]) => y <= hi) ?? pairs(tank).at(-1);
  const [[lo, a], [hi, b]] = pair;
  const radius = mix(a, b, (y - lo) / (hi - lo)) + lift;
  const step = TAU / turns[lod];
  const edge = Math.floor(angle / step) * step;
  const p = point(radius, height + y, edge);
  const q = point(radius, height + y, edge + step);
  return p.map((v, j) => mix(v, q[j], (angle - edge) / step));
}

function paintStroke(out, a, b, weight, lod, color) {
  const len = Math.hypot((b[0] - a[0]) * 2.89, b[1] - a[1]);
  const da = (weight * (b[1] - a[1])) / (len * 2.89);
  const dy = (weight * (a[0] - b[0]) * 2.89) / len;
  const n = Math.max(1, Math.ceil(len / 0.34));
  for (let i = 0; i < n; i++) {
    const start = a.map((value, j) => mix(value, b[j], i / n));
    const end = a.map((value, j) => mix(value, b[j], (i + 1) / n));
    const mid = (start[0] + end[0]) * 0.5;
    face(
      out,
      'paint',
      [
        skinPoint(start[1] + dy, start[0] + da, lod, 0.024),
        skinPoint(end[1] + dy, end[0] + da, lod, 0.024),
        skinPoint(end[1] - dy, end[0] - da, lod, 0.024),
        skinPoint(start[1] - dy, start[0] - da, lod, 0.024),
      ],
      [Math.sin(mid), 0, Math.cos(mid)],
      color,
    );
  }
}

const glyphs = {
  A: [
    [
      [0, 0],
      [0.4, 1],
      [0.8, 0],
    ],
    [
      [0.16, 0.37],
      [0.63, 0.37],
    ],
  ],
  B: [
    [
      [0, 0],
      [0, 1],
      [0.55, 1],
      [0.74, 0.84],
      [0.69, 0.63],
      [0.48, 0.51],
      [0, 0.51],
    ],
    [
      [0.49, 0.51],
      [0.79, 0.35],
      [0.75, 0.12],
      [0.56, 0],
      [0, 0],
    ],
  ],
  C: [
    [
      [0.76, 0.87],
      [0.58, 1],
      [0.24, 1],
      [0, 0.75],
      [0, 0.25],
      [0.24, 0],
      [0.59, 0],
      [0.76, 0.16],
    ],
  ],
  D: [
    [
      [0, 0],
      [0, 1],
      [0.53, 1],
      [0.77, 0.75],
      [0.77, 0.25],
      [0.53, 0],
      [0, 0],
    ],
  ],
  G: [
    [
      [0.77, 0.85],
      [0.56, 1],
      [0.2, 1],
      [0, 0.75],
      [0, 0.25],
      [0.2, 0],
      [0.6, 0],
      [0.77, 0.15],
      [0.77, 0.42],
      [0.4, 0.42],
    ],
  ],
  I: [
    [
      [0.41, 0],
      [0.41, 1],
    ],
    [
      [0.22, 0],
      [0.6, 0],
    ],
    [
      [0.22, 1],
      [0.6, 1],
    ],
  ],
  K: [
    [
      [0, 0],
      [0, 1],
    ],
    [
      [0.78, 1],
      [0.05, 0.44],
      [0.78, 0],
    ],
  ],
  L: [
    [
      [0, 1],
      [0, 0],
      [0.75, 0],
    ],
  ],
  N: [
    [
      [0, 0],
      [0, 1],
      [0.76, 0],
      [0.76, 1],
    ],
  ],
  O: [
    [
      [0.2, 0],
      [0.6, 0],
      [0.8, 0.25],
      [0.8, 0.76],
      [0.6, 1],
      [0.2, 1],
      [0, 0.76],
      [0, 0.25],
      [0.2, 0],
    ],
  ],
  P: [
    [
      [0, 0],
      [0, 1],
      [0.55, 1],
      [0.76, 0.82],
      [0.76, 0.65],
      [0.55, 0.52],
      [0, 0.52],
    ],
  ],
  R: [
    [
      [0, 0],
      [0, 1],
      [0.54, 1],
      [0.74, 0.85],
      [0.73, 0.62],
      [0.53, 0.51],
      [0, 0.51],
    ],
    [
      [0.48, 0.51],
      [0.78, 0],
    ],
  ],
  S: [
    [
      [0.76, 0.84],
      [0.56, 1],
      [0.19, 1],
      [0, 0.81],
      [0.11, 0.6],
      [0.65, 0.46],
      [0.79, 0.26],
      [0.62, 0],
      [0.2, 0],
      [0, 0.14],
    ],
  ],
  T: [
    [
      [0, 1],
      [0.8, 1],
    ],
    [
      [0.4, 1],
      [0.4, 0],
    ],
  ],
  U: [
    [
      [0, 1],
      [0, 0.2],
      [0.21, 0],
      [0.6, 0],
      [0.8, 0.2],
      [0.8, 1],
    ],
  ],
};

function lettering(out, lod, text, fullAngle, across, bottom, h, weight, slant) {
  const advance = across / text.length;
  const start = fullAngle - across / 2;
  for (const [i, letter] of [...text].entries()) {
    const strokes = glyphs[letter] ?? [];
    for (const stroke of strokes)
      for (const [[ax, ay], [bx, by]] of pairs(stroke))
        paintStroke(
          out,
          [start + (i + ax + slant * ay) * advance, bottom + ay * h],
          [start + (i + bx + slant * by) * advance, bottom + by * h],
          weight,
          lod,
          white,
        );
  }
}

function paintedDetails(out, lod) {
  if (lod === 0) return;
  const viewing = 0.0;
  lettering(out, lod, 'BROOKS', viewing, 1.69, 14.24, 1.55, 0.069, 0.12);
  lettering(out, lod, 'CATSUP', viewing, 1.55, 11.21, 1.13, 0.061, 0);
  if (lod > 1) {
    lettering(out, lod, 'OLD ORIGINAL', viewing, 1.69, 12.76, 0.52, 0.03, 0);
    const flutes = lod === 3 ? 42 : 24;
    for (let i = 0; i < flutes; i++) {
      const a = ((i + 0.5) * TAU) / flutes;
      for (const [lo, hi] of [
        [1.43, 2.02],
        [2.02, 5.95],
        [5.95, 8.09],
      ])
        paintStroke(out, [a, lo], [a, hi], 0.024, lod, white);
    }
  }
  if (lod === 3) {
    const step = TAU / 48;
    for (const y of [2.09, 5.95, 8.09, 10.53, 13.63, 16.45, 18.33])
      for (let j = 0; j < 48; j++) {
        const angle = (j + 0.25) * step;
        const at = skinPoint(y, angle, lod, 0.038);
        const adjacent = skinPoint(y + 0.046, angle, lod, 0.058);
        beam(out, 'paint', at, adjacent, 0.074, 0.072, y > 10 ? warmRed : darkRed);
      }
  }
}

function build(out, lod) {
  steelSupport(out, lod);
  tankShell(out, lod);
  walk(out, lod);
  paintedDetails(out, lod);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'brooks-catsup-bottle-water-tower-model.mjs';
const camera = [58, 28, 82];
const lookAt = [0, 24, 0];
export const model = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'water-tower',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: frame.terrainContact.basis,
  brief:
    'Collinsville’s 1949 steel catsup-bottle water tower, with its red painted tank, white cap and steel cross-bracing.',
  camera,
  lookAt,
  sunDirection: [18, 55, 60],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: frame.geometry.outline,
    minimumCoverage: 0.9,
    basis: 'Named mapped watertower outline, limited to the tank footprint.',
  },
  embeddedCanonicalGraphs: ['stone_ashlar', 'metal_painted', 'metal_standing_seam'],
  recipeDependencies: [
    'authored-structure-mesh.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'place-recipe-kit.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'south-morrison-approach', position: [17, 10, 64], lookAt: [0, 25, 0] },
    { name: 'label-and-inspection-platform', position: [11, 36, 25], lookAt: [0, 40.1, 0] },
    { name: 'braces-and-ladder', position: [16, 11, -29], lookAt: [0, 16.4, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'brooks-catsup-tower-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.08,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.44, surfaces },
      street: { export: 'street', errorMeters: 0.16, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.054, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under repository license. © OpenStreetMap contributors. Mapzen open terrain.',
};

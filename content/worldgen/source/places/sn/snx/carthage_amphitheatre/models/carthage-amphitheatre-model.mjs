/** The surviving masonry and excavated passages at Carthage as photographed in 2017. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls'),
  s = plan.section;
const {
  polygons: [, , southwest],
  centerlines: [retaining],
} = read('map-frame').geometry;
const terrain = read('terrain-grid');

const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.95, metallic: 0 },
  stone: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  raw: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.94, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_painted', roughness: 0.77, metallic: 0.16 },
  local: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.95, metallic: 0 },
};
const c = Object.fromEntries(
  Object.entries({
    wall: 'a09a8d',
    rubble: '918b7e',
    face: 'aba497',
    crown: 'b5aea1',
    shadow: '605c50',
    bottom: '9d9782',
    soil: '8c8875',
    moss: '85876a',
    iron: '4b4c44',
    cross: 'bbb8aa',
  }).map(([name, hex]) => [name, rgb(hex)]),
);
const white = 'palette:#ffffff',
  up = [0, 1, 0],
  front = [0, 0, 1];
const p3 = ([x, z], y) => [x, y, z];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const [arenaX, arenaZ] = s.arenaCenter;

function face(out, slot, points, expected, tint) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, value, i) => sum + value * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, tint);
  else
    out.addTriangle(
      slot,
      white,
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      tint,
    );
}

function ground([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    dx = u - i,
    dz = v - j;
  const a = terrain.heightsMeters[j],
    b = terrain.heightsMeters[j + 1];
  return (
    (a[i] * (1 - dx) + a[i + 1] * dx) * (1 - dz) +
    (b[i] * (1 - dx) + b[i + 1] * dx) * dz -
    terrain.modelDatumElevationMeters
  );
}

function wallStrip(out, a, b, low, high, depth, slot, tint, lod, coursed = false) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const normal = [(b[1] - a[1]) / length, 0, (a[0] - b[0]) / length];
  const A = (y, inset = 0) => [a[0] - normal[0] * inset, y, a[1] - normal[2] * inset];
  const B = (y, inset = 0) => [b[0] - normal[0] * inset, y, b[1] - normal[2] * inset];
  face(out, slot, [A(low[0]), B(low[1]), B(high[1]), A(high[0])], normal, tint);
  face(
    out,
    slot,
    [A(low[0], depth), A(high[0], depth), B(high[1], depth), B(low[1], depth)],
    normal.map((v) => -v),
    tint,
  );
  face(out, 'raw', [A(high[0]), B(high[1]), B(high[1], depth), A(high[0], depth)], up, c.crown);
  if (!coursed || lod < 2 || length < 1.3) return;
  const tiers = lod === 3 ? [0.31, 0.57, 0.81] : [0.44, 0.78];
  for (const t of tiers) {
    const y = low[0] + (high[0] - low[0]) * t,
      h = low[1] + (high[1] - low[1]) * t;
    face(
      out,
      'stone',
      [A(y - 0.03, -0.018), B(h - 0.03, -0.018), B(h + 0.065, -0.018), A(y + 0.065, -0.018)],
      normal,
      c.face,
    );
  }
}

function retainingWall(out, lod) {
  const parts =
    lod === 0 ? retaining.filter((_, i) => i % 2 === 0 || i === retaining.length - 1) : retaining;
  const base = (p) => Math.min(s.arenaFloor - 0.23, ground(p) - 0.35);
  const height = (p, i) =>
    Math.max(s.retainingCrown - 0.55, ground(p) + 0.83) + (((i * 11) % 9) - 4) * 0.072;
  for (let i = 1; i < parts.length; i++) {
    const a = parts[i - 1],
      b = parts[i];
    const lo = [base(a), base(b)],
      hi = [height(a, i - 1), height(b, i)];
    wallStrip(out, a, b, lo, hi, 0.79, 'rubble', i % 5 ? c.wall : c.rubble, lod, true);
    if (lod < 2 || i % 3 !== 0) continue;
    const p = mix(a, b, 0.37),
      q = mix(a, b, 0.62),
      y = (hi[0] + hi[1]) / 2;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = ((b[1] - a[1]) * 0.085) / length,
      dz = ((a[0] - b[0]) * 0.085) / length;
    if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 0.27) {
      wallStrip(
        out,
        [p[0] + dx, p[1] + dz],
        [q[0] + dx, q[1] + dz],
        [y - 0.12, y - 0.15],
        [y + 0.17, y + 0.15],
        0.21,
        'stone',
        c.face,
        lod,
      );
    }
  }
}

function arenaFootings(out, lod) {
  const [width, depth] = s.arenaSize;
  const count = [12, 18, 30, 44][lod];
  const ellipse = (theta) => [
    arenaX + (width / 2) * Math.cos(theta),
    arenaZ + (depth / 2) * Math.sin(theta),
  ];
  // Surviving low sectors are separated by breaks and the two principal approaches.
  for (const [start, span, crown] of [
    [0.2, 1.04, 0.02],
    [1.82, 0.88, 0.16],
    [3.06, 0.9, 0.19],
    [4.96, 0.85, -0.01],
  ]) {
    const pieces = Math.ceil((count * span) / (2 * Math.PI));
    for (let i = 0; i < pieces; i++) {
      const a = ellipse(start + (span * i) / pieces),
        b = ellipse(start + (span * (i + 1)) / pieces);
      const foot = (p) => Math.min(s.arenaFloor - 0.42, ground(p) - 0.24);
      const top = (p, i) => Math.max(crown + (((i * 7) % 5) - 2) * 0.056, ground(p) + 0.27);
      wallStrip(
        out,
        a,
        b,
        [foot(a), foot(b)],
        [top(a, i), top(b, i + 1)],
        0.58,
        'rubble',
        i % 2 ? c.rubble : c.wall,
        lod,
      );
    }
  }
  for (let i = 0; i < southwest.length; i++) {
    const a = southwest[i],
      b = southwest[(i + 1) % southwest.length];
    wallStrip(
      out,
      a,
      b,
      [ground(a) - 0.3, ground(b) - 0.3],
      [ground(a) + 0.58, ground(b) + 0.64],
      0.43,
      'rubble',
      c.wall,
      lod,
    );
  }
  if (!lod) return;
  for (const [x, z, w, d, h] of [
    [1.8, 10.2, 2.2, 1.13, 0.35],
    [20.0, 8.1, 2.0, 1.1, 0.29],
    [23.9, -12.6, 2.18, 0.83, 0.52],
    [3.42, -21.1, 1.93, 0.97, 0.49],
    [0.15, 23.4, 1.67, 1.1, 0.43],
  ]) {
    box(out, 'rubble', x, ground([x, z]) - 0.16, z, w, h + 0.16, d, c.rubble);
  }
}

function arch(out, x, z, width, low, spring, crown, depth, lod, blocked = false) {
  const radius = width / 2,
    top = crown + 0.43;
  const count = [5, 8, 11, 15][lod];
  const ring = Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / count;
    return [x - radius * Math.cos(t), spring + (crown - spring) * Math.sin(t)];
  });
  const frontZ = z + depth / 2,
    backZ = z - depth / 2,
    frame = 0.69;
  for (const [left, right] of [
    [x - radius - frame, x - radius],
    [x + radius, x + radius + frame],
  ]) {
    box(out, 'rubble', (left + right) / 2, low, z, right - left, top - low, depth, c.wall);
  }
  for (let i = 1; i < ring.length; i++) {
    const [a, y] = ring[i - 1],
      [b, h] = ring[i];
    face(
      out,
      'stone',
      [
        [a, y, frontZ],
        [b, h, frontZ],
        [b, top, frontZ],
        [a, top, frontZ],
      ],
      front,
      c.face,
    );
    face(
      out,
      'rubble',
      [
        [a, y, backZ],
        [b, h, backZ],
        [b, top, backZ],
        [a, top, backZ],
      ],
      [0, 0, -1],
      c.wall,
    );
    face(
      out,
      'raw',
      [
        [a, y, frontZ],
        [b, h, frontZ],
        [b, h, backZ],
        [a, y, backZ],
      ],
      [h - y, a - b, 0],
      c.shadow,
    );
    if (!blocked) continue;
    face(
      out,
      'local',
      [
        [x, spring - 0.05, backZ - 0.013],
        [a, y, backZ - 0.013],
        [b, h, backZ - 0.013],
      ],
      front,
      c.shadow,
    );
  }
  face(
    out,
    'raw',
    [
      [x - radius, top, frontZ],
      [x + radius, top, frontZ],
      [x + radius, top, backZ],
      [x - radius, top, backZ],
    ],
    up,
    c.crown,
  );
  if (blocked) {
    face(
      out,
      'local',
      [
        [x - radius, low, backZ - 0.013],
        [x + radius, low, backZ - 0.013],
        [x + radius, spring, backZ - 0.013],
        [x - radius, spring, backZ - 0.013],
      ],
      front,
      c.shadow,
    );
  }
  if (lod >= 2) {
    for (let i = 1; i < ring.length; i += 2) {
      const [a, y] = ring[i];
      if (top - y > 0.25)
        beam(
          out,
          'raw',
          [a, y + 0.05, frontZ + 0.021],
          [a, top - 0.03, frontZ + 0.021],
          0.045,
          0.045,
          c.rubble,
        );
    }
  }
}

function railing(out, a, b, low, lod, count) {
  if (!lod) return;
  const samples = lod === 1 ? Math.ceil(count / 2) : count;
  const base = (p) => Math.max(low, ground(p) + 0.045);
  const top = (p) => base(p) + 0.68;
  beam(out, 'iron', p3(a, top(a)), p3(b, top(b)), 0.044, 0.052, c.iron);
  for (let i = 0; i <= samples; i++) {
    const p = mix(a, b, i / samples);
    beam(out, 'iron', p3(p, base(p) - 0.04), p3(p, top(p)), 0.045, 0.044, c.iron);
  }
}

function passage(out, lod) {
  const { axis, lowZ, highZ, floor, wallTop, sidePassages } = s.hypogeum;
  const [, rightCut] = s.groundCutout.outline;
  const left = s.groundCutout.outline[0][0],
    right = rightCut[0];
  const width = right - left,
    center = (right + left) / 2;
  const surface = (p) => Math.max(wallTop, ground(p) + 0.05);
  const pathWall = (a, b) =>
    wallStrip(
      out,
      a,
      b,
      [floor - 0.3, floor - 0.3],
      [surface(a), surface(b)],
      0.42,
      'rubble',
      c.rubble,
      lod,
      true,
    );
  const run = [
    [lowZ, sidePassages[1][0]],
    [sidePassages[1][1], sidePassages[0][0]],
    [sidePassages[0][1], highZ],
  ];
  pathWall([right, lowZ], [right, highZ]);
  for (const [a, b] of run) pathWall([left, b], [left, a]);
  box(
    out,
    'local',
    center,
    floor - 0.23,
    (lowZ + highZ) / 2,
    width + 0.18,
    0.23,
    highZ - lowZ + 0.15,
    c.bottom,
  );
  for (let i = 0; i < sidePassages.length; i++) {
    const [a, b] = sidePassages[i],
      west = s.groundCutout.additionalOutlines[i][0][0];
    for (const z of [a, b]) pathWall([west, z], [left, z]);
    pathWall([west, b], [west, a]);
    box(
      out,
      'local',
      (west + left) / 2,
      floor - 0.23,
      (a + b) / 2,
      left - west + 0.12,
      0.23,
      b - a + 0.12,
      i ? c.bottom : c.moss,
    );
    railing(out, [west - 0.2, a], [west - 0.2, b], wallTop, lod, 2);
  }
  arch(out, axis, 0.65, width - 0.41, floor, -1.95, -0.24, 0.73, lod);
  arch(out, axis, -16.86, width - 0.63, floor, -1.62, 0.02, 1.53, lod, true);
  const crossZ = -17.01;
  box(out, 'stone', axis, 0.33, crossZ, 0.71, 0.24, 0.67, c.face);
  box(out, 'stone', axis, 0.56, crossZ, 0.16, 1.31, 0.15, c.cross);
  box(out, 'stone', axis, 1.48, crossZ, 0.65, 0.13, 0.14, c.cross);
  arch(out, axis + 9.63, -35.95, 2.16, -0.91, 0.55, 1.75, 1.24, lod, true);
  arch(out, axis - 14.6, -33.4, 2.68, -0.66, 0.56, 1.96, 1.31, lod, true);
  for (const [a, b, crown] of [
    [[-10.4, -34.2], [axis - 16.55, -33.66], 1.87],
    [[axis - 12.57, -33.67], [1.73, -34.79], 1.83],
    [[1.73, -34.79], [axis + 7.91, -36.2], 1.65],
    [[axis + 11.37, -36.16], [28.31, -34.04], 1.77],
  ]) {
    wallStrip(
      out,
      a,
      b,
      [ground(a) - 0.37, ground(b) - 0.37],
      [crown, crown - 0.13],
      0.88,
      'rubble',
      c.wall,
      lod,
      true,
    );
  }
  railing(out, [right + 0.17, highZ], [right + 0.17, lowZ], wallTop, lod, 9);
  for (const [a, b] of run) {
    railing(out, [left - 0.17, a], [left - 0.17, b], wallTop, lod, Math.ceil((b - a) / 4.7));
  }
  railing(out, [left - 0.3, highZ + 0.17], [right + 0.32, highZ + 0.17], wallTop, lod, 2);
  if (lod < 2) return;
  for (const [x, z, y, w, d] of [
    [10.31, 12.1, -2.92, 1.05, 1.75],
    [11.05, 5.55, -2.85, 1.25, 1.43],
    [10.54, -8.12, -2.81, 1.45, 2.1],
    [4.29, 0.37, -2.89, 1.27, 1.23],
    [10.98, -21.85, -2.88, 1.27, 2.1],
  ]) {
    box(out, 'local', x, y - 0.12, z, w, 0.13, d, c.moss);
  }
}

function build(out, lod) {
  retainingWall(out, lod);
  arenaFootings(out, lod);
  passage(out, lod);
}

export const amphitheatreSkyline = (out) => build(out, 0);
export const amphitheatreDistrict = (out) => build(out, 1);
export const amphitheatreStreet = (out) => build(out, 2);
export const amphitheatreCloseup = (out) => build(out, 3);

const recipe = 'carthage-amphitheatre-model.mjs';
const camera = [49, 47, 71],
  lookAt = [8.5, -0.2, -9.0];
const authoredLevels = Object.fromEntries(
  [
    ['district', 'amphitheatreDistrict', 0.28],
    ['street', 'amphitheatreStreet', 0.1],
    ['closeup', 'amphitheatreCloseup', 0.038],
  ].map(([level, entry, errorMeters]) => [level, { export: entry, errorMeters, surfaces }]),
);

export const amphitheatreModel = {
  id: plan.model,
  key: plan.model,
  title: plan.title,
  cell: plan.cell,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build: amphitheatreCloseup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'The excavated amphitheatre at Carthage in 2017, with its low arena walls, exposed underground passages, surviving arches and protective railings.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  groundCutout: s.groundCutout,
  mediumFiContext: {
    scale: 0.84,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_limestone_weathered',
    'stone_limestone',
    'stone_limestone_raw',
    'metal_painted',
  ],
  qaCameras: [
    {
      name: 'northeast-approach-and-excavated-passage',
      position: [10.73, 2.95, 26.8],
      lookAt: [10.81, -0.58, -5.7],
    },
    {
      name: 'retaining-wall-and-low-arena-remains',
      position: [43, 20, -39],
      lookAt: [9.6, -0.38, -8.2],
    },
    { name: 'central-openings-from-above', position: [-17, 38, 11.5], lookAt: [9.6, -1.1, -7.5] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-carthage-amphitheatre-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'amphitheatreSkyline',
    errorMeters: 0.73,
    surfaces,
    authoredLevels,
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original geometry under the repository license, OpenStreetMap ODbL 1.0 and one exact first-party CC0 Qualla photo.',
};

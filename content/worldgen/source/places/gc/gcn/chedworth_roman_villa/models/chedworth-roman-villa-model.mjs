import { readFileSync } from 'node:fs';
import { beamPath } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  cap,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { gable } from '../../../../../../../../packages/worldgen/scripts/tytuvenai-ensemble-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const tone = palette({
  stone: 'b5a58a',
  paleStone: 'c3b39a',
  limestone: 'afa087',
  cap: '7c776f',
  deepCap: '686960',
  lime: 'ded7c8',
  beams: '3b3531',
  oak: '897960',
  larch: 'a18d72',
  shutters: '897963',
  roof: '625e55',
  shelterRoof: '9a9589',
  glass: '707f80',
  algae: '6d7455',
  water: '758263',
});
const surfaces = {
  limestone: surface('wall', 'stone_limestone_weathered', 0.94),
  foundation: surface('foundation', 'stone_drywall', 0.95),
  render: surface('wall', 'plaster_lime', 0.89),
  shelter: surface('wall', 'wood_vertical', 0.89),
  slate: surface('roof', 'slate', 0.92),
  shelterRoof: surface('roof', 'metal_standing_seam', 0.82),
  glass: surface('window', 'window_grid', 0.41),
  water: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.28, metallic: 0 },
};
const mean = (p) => p.reduce((s, v) => [s[0] + v[0] / p.length, s[1] + v[1] / p.length], [0, 0]);
const interpolate = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t)];
const firstLevelWalls = new Set([
  993479353, 993479357, 993479370, 993479377, 993479382, 993479383, 993479427, 993479430,
]);

function masonrySegment(out, a, b, lowA, lowB, highA, highB, width, lod, capped) {
  const w = edge(a, b);
  if (w.length < 0.08) return;
  const half = width * 0.5;
  for (const side of [-1, 1]) {
    const u = side * half;
    face(
      out,
      'limestone',
      [
        w.p(-0.03, lowA, u),
        w.p(w.length + 0.03, lowB, u),
        w.p(w.length + 0.03, highB, u),
        w.p(-0.03, highA, u),
      ],
      w.normal.map((n) => n * side),
      tone.stone,
    );
  }
  const corners = [
    w.p(-0.03, highA, -half),
    w.p(w.length + 0.03, highB, -half),
    w.p(w.length + 0.03, highB, half),
    w.p(-0.03, highA, half),
  ];
  face(out, capped ? 'slate' : 'foundation', corners, up, capped ? tone.cap : tone.paleStone);
  if (lod === 0) return;
  for (const [u, lo, hi, normal] of [
    [-0.03, lowA, highA, [-w.normal[2], 0, w.normal[0]]],
    [w.length + 0.03, lowB, highB, [w.normal[2], 0, -w.normal[0]]],
  ]) {
    face(
      out,
      'limestone',
      [w.p(u, lo, -half), w.p(u, lo, half), w.p(u, hi, half), w.p(u, hi, -half)],
      normal,
      tone.stone,
    );
  }
  if (!capped || lod < 2) return;
  const ridge = lod === 2 ? 0.105 : 0.136;
  const eave = half + 0.105;
  for (const sign of [-1, 1]) {
    face(
      out,
      'slate',
      [
        w.p(-0.03, highA + 0.02, sign * eave),
        w.p(w.length + 0.03, highB + 0.02, sign * eave),
        w.p(w.length + 0.03, highB + ridge),
        w.p(-0.03, highA + ridge),
      ],
      up,
      sign === 1 ? tone.cap : tone.deepCap,
    );
  }
}

function ancientWalls(out, lod) {
  for (const item of d.walls) {
    if (lod === 0 && !firstLevelWalls.has(item.id)) continue;
    const retained = item.style === 'terrace';
    const springWall = item.style === 'spring';
    const width = retained ? 0.82 : springWall ? 0.68 : 0.57;
    const height = retained ? 0.98 : springWall ? 1.21 : 0.51 + (item.id % 4) * 0.088;
    for (const [a, b] of pairs(item.path)) {
      const count =
        lod === 3 ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3.7)) : 1;
      for (let i = 0; i < count; i++) {
        const p = interpolate(a, b, i / count),
          q = interpolate(a, b, (i + 1) / count);
        const y0 = grade(p),
          y1 = grade(q);
        masonrySegment(
          out,
          p,
          q,
          y0 - 0.28,
          y1 - 0.28,
          y0 + height,
          y1 + height,
          width,
          lod,
          !springWall,
        );
      }
    }
  }
}

function nymphaeum(out, lod) {
  const middle = mean(d.basin),
    water = Math.max(...d.basin.map(grade)) + 0.04;
  const outer = d.basin.map((p) => interpolate(middle, p, 1.2));
  const inner = d.basin.map((p) => interpolate(middle, p, 0.97));
  const y = water + 0.28;
  cap(out, 'water', inner, water, tone.water);
  for (let i = 0; i < outer.length; i++) {
    const j = (i + 1) % outer.length;
    const e = edge(outer[i], outer[j], areaSign(outer));
    face(
      out,
      'foundation',
      [
        at(outer[i], grade(outer[i]) - 0.26),
        at(outer[j], grade(outer[j]) - 0.26),
        at(outer[j], y),
        at(outer[i], y),
      ],
      e.normal,
      tone.limestone,
    );
    face(
      out,
      'limestone',
      [at(outer[i], y), at(outer[j], y), at(inner[j], y), at(inner[i], y)],
      up,
      tone.stone,
    );
    face(
      out,
      'foundation',
      [at(inner[i], water - 0.05), at(inner[j], water - 0.05), at(inner[j], y), at(inner[i], y)],
      e.normal.map((v) => -v),
      tone.algae,
    );
  }
  if (lod < 2) return;
  const [x, z] = middle;
  beamPath(
    out,
    'limestone',
    [
      [x - 0.17, y + 0.72, z - 1.42],
      [x - 0.17, y + 0.59, z - 0.86],
    ],
    0.17,
    0.15,
    tone.paleStone,
  );
  beamPath(
    out,
    'water',
    [
      [x - 0.17, y + 0.58, z - 0.86],
      [x - 0.17, water, z - 0.76],
    ],
    0.052,
    0.041,
    tone.water,
  );
}

function bays(out, outline, low, top, lod, spacing, material = 'glass') {
  const winding = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, winding);
    const n = Math.min(13, Math.floor(wall.length / spacing));
    for (let i = 0; i < n; i++) {
      const x = (wall.length * (i + 0.5)) / n;
      const w = Math.min(0.54, (wall.length / n) * 0.33);
      panel(
        out,
        'shelter',
        wall,
        x - w - 0.05,
        x + w + 0.05,
        low - 0.068,
        top + 0.068,
        0.019,
        tone.beams,
      );
      panel(out, material, wall, x - w, x + w, low, top, 0.032, tone.glass);
      if (lod > 1) {
        panel(out, 'shelter', wall, x - 0.034, x + 0.034, low, top, 0.05, tone.beams);
        panel(
          out,
          'shelter',
          wall,
          x - w,
          x + w,
          mix(low, top, 0.42) - 0.025,
          mix(low, top, 0.42) + 0.025,
          0.05,
          tone.beams,
        );
      }
    }
  }
}

function timberFrame(out, outline, low, high, lod) {
  const sign = areaSign(outline);
  for (const [a, b] of pairs(closed(outline))) {
    const w = edge(a, b, sign);
    const n = Math.max(1, Math.round(w.length / (lod > 1 ? 0.92 : 1.52)));
    panel(out, 'shelter', w, 0, w.length, low, low + 0.13, 0.031, tone.beams);
    panel(out, 'shelter', w, 0, w.length, high - 0.125, high, 0.031, tone.beams);
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * w.length;
      panel(out, 'shelter', w, x - 0.056, x + 0.056, low, high, 0.026, tone.beams);
    }
  }
}

function endTimbers(out, x, a, b, y, h, lod) {
  const z = (a + b) * 0.5,
    p = (v, height) => [x, height, v];
  const bars = [
    [p(a, y), p(b, y)],
    [p(a, y), p(z, y + h)],
    [p(b, y), p(z, y + h)],
    [p(z, y), p(z, y + h)],
  ];
  if (lod > 1)
    bars.push(
      [p(z - 0.38, y), p(z - 1.61, y + h * 0.46)],
      [p(z + 0.38, y), p(z + 1.61, y + h * 0.46)],
    );
  for (const points of bars) beamPath(out, 'shelter', points, 0.105, 0.1, tone.beams);
  const center = [x - 0.06, y + h * 0.45, z];
  const rim = (radius) =>
    Array.from({ length: 10 }, (_, i) => {
      const angle = (i * Math.PI * 2) / 10;
      return [center[0], center[1] + Math.cos(angle) * radius, z + Math.sin(angle) * radius];
    });
  face(out, 'shelter', rim(0.35), [-1, 0, 0], tone.beams);
  face(
    out,
    'glass',
    rim(0.25).map(([px, py, pz]) => [px - 0.01, py, pz]),
    [-1, 0, 0],
    tone.glass,
  );
}

function lodge(out, lod) {
  const [l, r] = [13.3447, 23.8459];
  const [a, b] = [-7.6421, 9.9166];
  const base = d.floors[0] + 1.61,
    upper = base + 2.44;
  shell(out, d.lodge, (p) => grade(p) - 0.37, base, { wall: 'limestone', color: tone.paleStone });
  shell(out, d.lodge, () => base, upper, { wall: 'render', color: tone.lime });
  gable(
    out,
    [(l + r) / 2, a - 0.25],
    [(l + r) / 2, b + 0.54],
    (r - l) * 0.5 + 0.12,
    upper,
    3.72,
    tone.roof,
    'render',
    tone.lime,
    'slate',
  );
  for (const [z0, z1, x, outside, rise] of [
    [-7.67, -1.3, 14.79, 19.06, 3.24],
    [3.94, 9.96, 13.27, 18.98, 3.58],
  ]) {
    const z = (z0 + z1) * 0.5;
    gable(
      out,
      [x, z],
      [outside, z],
      (z1 - z0) * 0.5,
      upper,
      rise,
      tone.roof,
      'render',
      tone.lime,
      'slate',
    );
    if (lod > 0) endTimbers(out, x - 0.03, z0, z1, upper, rise, lod);
  }
  for (const [x, z, width, height] of [
    [18.12, -4.3, 0.92, 1.55],
    [19.52, 5.95, 0.79, 1.28],
  ]) {
    block(out, 'limestone', x - width / 2, upper + 2.72, z, width, height, 0.6, tone.paleStone);
    if (lod > 0)
      block(
        out,
        'slate',
        x - width / 2 - 0.07,
        upper + 2.73 + height,
        z - 0.06,
        width + 0.14,
        0.16,
        0.73,
        tone.deepCap,
      );
  }
  if (lod === 0) return;
  timberFrame(out, d.lodge, base, upper, lod);
  bays(out, d.lodge, base + 0.47, upper - 0.27, lod, 2.68);
  bays(out, d.lodge, base - 1.22, base - 0.13, lod, 4.42);
}

function northShelters(out, lod) {
  const y = d.floors[1] + 0.82,
    upper = y + 1.79;
  shell(out, d.north, (p) => grade(p) - 0.35, y, { wall: 'limestone', color: tone.limestone });
  shell(out, d.north, () => y, upper, { wall: 'shelter', color: tone.beams });
  gable(
    out,
    [-14.84, -38.11],
    [-14.84, -27.9],
    2.88,
    upper,
    1.5,
    tone.roof,
    'shelter',
    tone.beams,
    'slate',
  );
  gable(
    out,
    [-12.58, -38.64],
    [-3.47, -37.74],
    2.48,
    upper + 0.14,
    1.57,
    tone.roof,
    'limestone',
    tone.paleStone,
    'slate',
  );
  if (lod > 0) {
    const front = edge([-17.7279, -28.4481], [-12.0869, -27.9615], -1);
    for (let i = 0; i < 3; i++) {
      const x = 1.06 + i * 1.61;
      panel(out, 'shelter', front, x - 0.53, x + 0.53, y + 0.01, upper - 0.12, 0.03, tone.beams);
      panel(out, 'glass', front, x - 0.36, x + 0.36, y + 0.35, upper - 0.26, 0.041, tone.glass);
    }
  }
}

function westShelter(out, lod) {
  const y = d.floors[2] + 1.28,
    upper = y + 2.76;
  shell(out, d.west, (p) => grade(p) - 0.37, y, { wall: 'limestone', color: tone.limestone });
  shell(out, d.west, () => y, upper, { wall: 'shelter', color: tone.larch });
  gable(
    out,
    [-20.11, -19.83],
    [-20.11, 19.54],
    5.17,
    upper,
    1.86,
    tone.shelterRoof,
    'shelter',
    tone.larch,
    'shelterRoof',
  );
  gable(
    out,
    [-28.28, -15.33],
    [-24.6, -15.33],
    1.5,
    upper - 0.012,
    0.65,
    tone.shelterRoof,
    'shelter',
    tone.larch,
    'shelterRoof',
  );
  if (lod === 0) return;
  const front = edge([-15.1543, -19.4944], [-15.1543, 19.2088]);
  const count = lod > 1 ? 24 : 12;
  for (let i = 0; i < count; i++) {
    const u = (front.length * (i + 0.5)) / count,
      w = (front.length / count) * 0.32;
    panel(out, 'shelter', front, u - w, u + w, y + 0.21, upper - 0.22, 0.018, tone.shutters);
    if (i === Math.round(count * 0.49) || (lod > 1 && i % 6 === 2)) {
      panel(
        out,
        'glass',
        front,
        u - w + 0.1,
        u + w - 0.1,
        y + 0.41,
        upper - 0.48,
        0.028,
        tone.glass,
      );
    }
  }
}

function columnFragments(out, lod) {
  if (lod === 0) return;
  const edges = lod === 1 ? 6 : 12;
  for (const [i, p] of d.columns.entries()) {
    const y = grade(p),
      h = 0.58 + i * 0.16;
    ring(
      out,
      'limestone',
      p,
      [
        [y - 0.12, 0.4],
        [y + 0.09, 0.38],
        [y + 0.17, 0.28],
        [y + h, 0.23],
      ],
      edges,
      tone.limestone,
    );
    const r = 0.225;
    cap(
      out,
      'limestone',
      Array.from({ length: edges }, (_, j) => [
        p[0] + r * Math.cos((Math.PI * 2 * j) / edges),
        p[1] + r * Math.sin((Math.PI * 2 * j) / edges),
      ]),
      y + h,
      tone.paleStone,
    );
  }
}

function build(out, lod) {
  ancientWalls(out, lod);
  nymphaeum(out, lod);
  northShelters(out, lod);
  westShelter(out, lod);
  lodge(out, lod);
  columnFragments(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'chedworth-roman-villa-model.mjs';
const camera = [96, 66, -96];
const lookAt = [10, 1, -5];
export const chedworthModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'landmark',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'exact-native-frame',
  groundContactBasis:
    'Original independently sampled terrain at the villa courtyard. The registered wall footings follow the site slope and the shelters use estimated site levels.',
  brief:
    'Chedworth Roman Villa’s surviving courtyard walls, bathhouse and West Range shelters, octagonal spring shrine, and Victorian half-timbered lodge and museum.',
  camera,
  lookAt,
  sunDirection: [-24, 48, -27],
  mediumFiContext: {
    scale: 1,
    groundY: -0.15,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [...new Set(Object.values(surfaces).flatMap((s) => s.graph ?? []))],
  recipeDependencies: [
    'montreal-museum-pavilion-geometry.mjs',
    'tytuvenai-ensemble-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  buildingCutout: {
    outline: read('map-frame.json').geometry.outline,
    outlines: [d.lodge, d.north, d.west],
    minimumCoverage: 0.92,
    basis:
      'Three individual surveyed polygons for the lodge, North Bath House and West Range shelter.',
  },
  qaCameras: [
    { name: 'north-range-rooms', position: [51, 14, -26], lookAt: [35, 0, -33] },
    { name: 'museum-and-courtyard', position: [-13, 7, 14], lookAt: [17, 2, 0] },
    { name: 'spring-shrine', position: [-23, 12, -32], lookAt: [-32, 9, -40] },
    { name: 'west-range-larch-shelter', position: [9, 12, 29], lookAt: [-19, 6, 0] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'chedworth-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 1.45,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.68, surfaces },
      street: { export: 'street', errorMeters: 0.25, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.09, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the repository license. Pasicles’s photographs are CC0. Tony Grist released his two original photographs into the public domain. Native map data © OpenStreetMap contributors, ODbL 1.0.',
};

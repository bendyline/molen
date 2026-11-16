/** Nakhal Fort’s standing masonry and exposed rock contact. */
import fs from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  profile,
  quad,
  tube,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) =>
  JSON.parse(fs.readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const terrain = read('terrain-grid');
const [outer] = read('map-frame').geometry.polygons;
const colors = Object.fromEntries(
  Object.entries({
    plaster: 'd6c2a0',
    shade: 'c5ad89',
    coping: 'dfc9a7',
    deck: 'ab9272',
    dark: '5c4b39',
    wood: '73543b',
    stone: 'b29772',
    dirt: 'a48d70',
    rock1: 'ad9877',
    rock2: 'a58d6b',
    rock3: 'b6a17f',
    rock4: '9b8566',
    trim: 'bea17b',
    cloth: '9c4940',
    pole: '726756',
  }).map(([key, tint]) => [key, rgb(tint)]),
);
const surfaces = {
  masonry: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  rock: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.99, metallic: 0 },
  deck: { slot: 'roof', graph: 'stone_sandstone', roughness: 0.97, metallic: 0 },
  trim: { slot: 'trim', graph: 'stone_limestone', roughness: 0.9, metallic: 0 },
  dark: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.95, metallic: 0 },
  fine: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.89, metallic: 0 },
};
const c = colors;
const up = [0, 1, 0];
const tau = Math.PI * 2;
const as3 = ([x, z], y) => [x, y, z];
const blend = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => [blend(a[0], b[0], t), blend(a[1], b[1], t)];

function terrainAt([x, z]) {
  const u = (x - terrain.origin[0]) / terrain.stepMeters;
  const v = (z - terrain.origin[1]) / terrain.stepMeters;
  const i = Math.floor(u);
  const j = Math.floor(v);
  const a = u - i;
  const b = v - j;
  const data = terrain.heightsMeters;
  return (
    blend(blend(data[j][i], data[j][i + 1], a), blend(data[j + 1][i], data[j + 1][i + 1], a), b) -
    terrain.modelDatumElevationMeters
  );
}

function face(out, slot, points, target, tint) {
  let n = normalFor(...points);
  if (n.reduce((dot, value, i) => dot + value * target[i], 0) < 0) {
    points = [...points].reverse();
    n = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, n, tint);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      n,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      tint,
    );
}

function cap(out, slot, ring, y, target, tint) {
  const indices = earcut(ring.flat());
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      slot,
      indices.slice(i, i + 3).map((j) => as3(ring[j], y)),
      target,
      tint,
    );
}

function ringSign(ring) {
  return Math.sign(
    ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - p[1] * q[0];
    }, 0),
  );
}

function edge(a, b, sign) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / l;
  const uz = (b[1] - a[1]) / l;
  const n = [uz * sign, 0, -ux * sign];
  return {
    a,
    b,
    l,
    n,
    p: (u, y, d = 0) => [a[0] + ux * u + d * n[0], y, a[1] + uz * u + d * n[2]],
  };
}

const outerEdges = outer.map((p, i) => edge(p, outer[(i + 1) % outer.length], ringSign(outer)));

function panel(out, slot, f, a, b, bottomA, bottomB, topA, topB, depth, tint, normal = f.n) {
  face(
    out,
    slot,
    [f.p(a, bottomA, depth), f.p(b, bottomB, depth), f.p(b, topB, depth), f.p(a, topA, depth)],
    normal,
    tint,
  );
}

function slit(out, f, u, y, width, height, detail, offset = 0) {
  const left = u - width / 2;
  const right = u + width / 2;
  panel(out, 'dark', f, left, right, y, y, y + height, y + height, offset + 0.016, c.dark);
  if (detail < 2) return;
  panel(
    out,
    'trim',
    f,
    left - 0.082,
    right + 0.082,
    y - 0.1,
    y - 0.1,
    y - 0.016,
    y - 0.016,
    offset + 0.057,
    c.trim,
  );
  panel(
    out,
    'trim',
    f,
    left - 0.08,
    right + 0.08,
    y + height + 0.023,
    y + height + 0.023,
    y + height + 0.115,
    y + height + 0.115,
    offset + 0.043,
    c.coping,
  );
}

function teeth(out, f, y, detail, depth = 0) {
  const pitch = detail === 1 ? 3.45 : 1.65;
  const count = Math.floor(f.l / pitch);
  for (let i = 0; i < count; i++) {
    const u = (f.l * (i + 0.5)) / count;
    const w = detail === 1 ? 0.54 : 0.62;
    const h = detail === 1 ? 0.37 : 0.51;
    const a = f.p(u - w / 2, y + h / 2, depth);
    const b = f.p(u + w / 2, y + h / 2, depth);
    beam(out, 'masonry', a, b, h, 0.48, c.coping);
  }
}

// Whole native outline is carried by the curtain. The round controls are continuous
// with the neighboring wall, while their cylindrical roofs are authored separately.
function crest(i) {
  if (i <= 1 || i === 45) return 20.5;
  if (i >= 2 && i <= 6) return 12.0;
  if (i === 7 || i === 8) return 8.75;
  if (i >= 9 && i <= 20) return 7.25;
  if (i === 21) return 10.6;
  if (i >= 22 && i <= 29) return 16.9;
  if (i === 30 || i === 31) return 12.7;
  if (i >= 32 && i <= 41) return 9.85;
  if (i === 42 || i === 43) return 13.5;
  return 15.8;
}

function gateway(out, f, groundA, groundB, y, depth, detail) {
  const center = f.l / 2;
  const walk = Math.max(groundA, groundB) + 0.65;
  const radius = Math.min(1.03, f.l * 0.22);
  const spring = walk + 1.94;
  const align = (u, y, d) => f.p(u, y, d);
  const shell = [
    [-depth, f.n.map((n) => -n)],
    [0, f.n],
  ];
  for (const [d, n] of shell) {
    for (const [a, b] of [
      [0, center - radius],
      [center + radius, f.l],
    ]) {
      panel(out, 'masonry', f, a, b, groundA, groundB, y, y, d, c.plaster, n);
    }
    const segments = detail === 0 ? 4 : detail === 1 ? 6 : 10;
    for (let i = 0; i < segments; i++) {
      const a = Math.PI * (1 - i / segments);
      const b = Math.PI * (1 - (i + 1) / segments);
      const l = center + radius * Math.cos(a);
      const r = center + radius * Math.cos(b);
      const h1 = spring + radius * 0.78 * Math.sin(a);
      const h2 = spring + radius * 0.78 * Math.sin(b);
      panel(out, 'masonry', f, l, r, h1, h2, y, y, d, c.plaster, n);
      if (d === 0) {
        face(
          out,
          'trim',
          [
            align(l, h1, 0.037),
            align(r, h2, 0.037),
            align(center + (radius + 0.2) * Math.cos(b), h2 + 0.18, 0.037),
            align(center + (radius + 0.2) * Math.cos(a), h1 + 0.18, 0.037),
          ],
          n,
          c.trim,
        );
        face(
          out,
          'trim',
          [align(l, h1, 0), align(r, h2, 0), align(r, h2, -depth), align(l, h1, -depth)],
          [0, -1, 0],
          c.shade,
        );
      }
    }
  }
  if (detail >= 1)
    panel(
      out,
      'fine',
      f,
      center - radius + 0.06,
      center + radius - 0.06,
      walk,
      walk,
      spring + 0.06,
      spring + 0.06,
      -depth + 0.23,
      c.wood,
    );
}

function curtain(out, detail) {
  for (let i = 0; i < outerEdges.length; i++) {
    const f = outerEdges[i];
    const y = crest(i);
    const width = plan.dimensions.wallWidth;
    const baseA = terrainAt(f.a) - 1.15;
    const baseB = terrainAt(f.b) - 1.15;
    if (i === 2) gateway(out, f, baseA, baseB, y, width, detail);
    else {
      panel(out, 'masonry', f, 0, f.l, baseA, baseB, y, y, 0, c.plaster);
      panel(
        out,
        'masonry',
        f,
        0,
        f.l,
        baseA,
        baseB,
        y,
        y,
        -width,
        c.shade,
        f.n.map((n) => -n),
      );
    }
    const corners = [f.p(0, y), f.p(f.l, y), f.p(f.l, y, -width), f.p(0, y, -width)];
    face(out, 'deck', corners, up, c.deck);
    if (detail === 0) continue;
    const vx = f.b[0] - f.a[0];
    const vz = f.b[1] - f.a[1];
    face(
      out,
      'masonry',
      [f.p(0, baseA), f.p(0, baseA, -width), f.p(0, y, -width), f.p(0, y)],
      [-vx, 0, -vz],
      c.shade,
    );
    face(
      out,
      'masonry',
      [f.p(f.l, baseB), f.p(f.l, baseB, -width), f.p(f.l, y, -width), f.p(f.l, y)],
      [vx, 0, vz],
      c.shade,
    );
    if (i < 12 || i === 21 || i === 22 || i === 30 || i >= 42) teeth(out, f, y, detail, -0.21);
    if (i !== 2 && f.l > 4.8) {
      const count = Math.floor(f.l / (detail === 1 ? 7.0 : 4.1));
      for (let j = 0; j < count; j++)
        slit(out, f, (f.l * (j + 0.5)) / count, y - 2.36, 0.22, 0.56, detail);
    }
  }
}

function keep(out, ring, y0, y1, detail, parapet) {
  const sign = ringSign(ring);
  for (let i = 0; i < ring.length; i++) {
    const f = edge(ring[i], ring[(i + 1) % ring.length], sign);
    panel(out, 'masonry', f, 0, f.l, y0, y0, y1, y1, 0, i % 3 === 0 ? c.shade : c.plaster);
    if (detail === 0) continue;
    const row = Math.max(1, Math.floor(f.l / 4.4));
    for (let n = 0; n < row; n++) {
      const u = ((n + 0.5) * f.l) / row;
      slit(out, f, u, y1 - 3.25, n % 4 === 0 ? 0.63 : 0.31, n % 4 === 0 ? 0.86 : 0.57, detail);
      if (detail >= 2 && y1 - y0 > 7.4 && i % 2 === 0)
        slit(out, f, u, y1 - 6.85, 0.44, 0.64, detail);
    }
    if (parapet) teeth(out, f, y1, detail, -0.19);
  }
  cap(out, 'deck', ring, y1, up, c.deck);
  cap(out, 'masonry', ring, y0, [0, -1, 0], c.shade);
}

const terraces = [
  {
    ring: [
      [-45, -12],
      [-19, -13],
      [-7, -9],
      [-9, 4],
      [-34, 9],
      [-48, 2],
    ],
    y: 20.4,
    bottom: 8.2,
  },
  {
    ring: [
      [-37, -13],
      [-18, -12],
      [-11, -8],
      [-12, -0.5],
      [-22, 2],
      [-33, -1],
    ],
    y: 25.05,
    bottom: 18.85,
  },
  {
    ring: [
      [-53, -2],
      [-46, -8],
      [-38, -8],
      [-37, 4],
      [-42, 9],
      [-49, 7],
    ],
    y: 18.6,
    bottom: 8.9,
  },
  {
    ring: [
      [-16, 5],
      [2, 0],
      [16, 2],
      [18, 11],
      [5, 19],
      [-17, 19],
    ],
    y: 14.8,
    bottom: 2.8,
  },
  {
    ring: [
      [23, -6],
      [43, -6],
      [50, -1],
      [48, 7],
      [30, 10],
      [20, 5],
    ],
    y: 8.25,
    bottom: -2.2,
  },
];

function tower(out, center, radius, base, high, detail, main = false) {
  const sides = [8, 13, 19, 27][detail];
  profile(
    out,
    [
      [base, radius * 1.028, radius * 1.028],
      [high - 0.27, radius, radius, 'masonry', c.plaster],
      [high, radius + 0.075, radius + 0.075, 'trim', c.coping],
    ],
    sides,
    center,
  );
  if (detail === 0) return;
  const count = [0, 12, 19, 25][detail];
  for (let i = 0; i < count; i++) {
    const t = (tau * i) / count;
    const p = [
      center[0] + (radius - 0.09) * Math.cos(t),
      center[1] + (radius - 0.09) * Math.sin(t),
    ];
    beam(
      out,
      'masonry',
      as3(p, high - 0.04),
      as3(p, high + 0.44),
      detail === 1 ? 0.46 : 0.38,
      0.38,
      c.coping,
    );
  }
  for (let i = 0; i < sides; i += Math.max(1, Math.ceil(sides / 8))) {
    const a = (tau * i) / sides;
    const b = (tau * (i + 1)) / sides;
    const ra = [center[0] + radius * Math.cos(a), center[1] + radius * Math.sin(a)];
    const rb = [center[0] + radius * Math.cos(b), center[1] + radius * Math.sin(b)];
    const f = edge(ra, rb, 1);
    slit(
      out,
      f,
      f.l / 2,
      high - (main ? 3.36 : 2.11),
      main && i === 0 ? 0.63 : 0.26,
      main && i === 0 ? 0.77 : 0.5,
      detail,
      0.055,
    );
  }
  if (main) {
    const [x, z] = center;
    const peak = high + 5.1;
    tube(out, 'fine', [x, high, z], [x, peak, z], 0.024, c.pole, 6);
    face(
      out,
      'fine',
      [
        [x + 0.007, peak - 0.1, z],
        [x + 1.05, peak - 0.15, z - 0.06],
        [x + 1.03, peak - 0.77, z - 0.15],
        [x + 0.007, peak - 0.82, z],
      ],
      [0, 0, 1],
      c.cloth,
    );
    face(
      out,
      'fine',
      [
        [x + 0.007, peak - 0.82, z - 0.015],
        [x + 1.03, peak - 0.77, z - 0.166],
        [x + 1.05, peak - 0.15, z - 0.077],
        [x + 0.007, peak - 0.1, z - 0.015],
      ],
      [0, 0, -1],
      c.cloth,
    );
  }
}

function rock(out, detail) {
  // The lower profile intersects the sampled terrain. Only exposed rock directly
  // below the upper keeps is authored, with its upper crest inside their foundations.
  const p = [
    [-54, -17],
    [-48, -24],
    [-36, -27],
    [-26, -26],
    [-12, -23],
    [-7, -12],
    [-2, 1],
    [-16, 16],
    [-30, 20],
    [-44, 17],
    [-55, 8],
    [-58, -3],
  ];
  const q = [
    [-47, -10],
    [-43, -15],
    [-35, -18],
    [-26, -16],
    [-18, -13],
    [-14, -9],
    [-11, 0],
    [-22, 8],
    [-31, 11],
    [-41, 8],
    [-48, 4],
    [-51, -3],
  ];
  const highs = [13.2, 15.4, 16.3, 16.0, 14.1, 13.8, 11.1, 11.9, 12.3, 12.8, 12.4, 11.2];
  const granularity = [1, 2, 3, 5][detail];
  const courses = [1, 2, 3, 4][detail];
  const color = [c.rock1, c.rock2, c.rock3, c.rock4, c.rock2];
  const sign = ringSign(p);
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    const side = edge(p[i], p[j], sign);
    const sample = (h, v) => {
      const a = mix(p[i], p[j], h);
      const b = mix(q[i], q[j], h);
      const foot = terrainAt(a) - 0.83;
      const crest = blend(highs[i], highs[j], h);
      const bark =
        Math.sin(v * Math.PI) * Math.sin(h * Math.PI) * Math.cos(h * 13 + i * 6.7 + v * 7.1);
      const [x, z] = mix(a, b, v);
      return [
        x + side.n[0] * bark * 1.58,
        blend(foot, crest, v) + bark * 1.42,
        z + side.n[2] * bark * 1.58,
      ];
    };
    for (let row = 0; row < courses; row++)
      for (let n = 0; n < granularity; n++) {
        const a = sample(n / granularity, row / courses);
        const b = sample((n + 1) / granularity, row / courses);
        const d = sample(n / granularity, (row + 1) / courses);
        const e = sample((n + 1) / granularity, (row + 1) / courses);
        const expected = [side.n[0], 0.38, side.n[2]];
        face(out, 'rock', [a, b, e], expected, color[(i + n + row) % color.length]);
        face(out, 'rock', [a, e, d], expected, color[(i + n + row + 1) % color.length]);
      }
  }
  const indices = earcut(q.flat());
  for (let i = 0; i < indices.length; i += 3)
    face(
      out,
      'rock',
      indices.slice(i, i + 3).map((j) => as3(q[j], highs[j])),
      up,
      c.rock1,
    );
}

function approach(out, detail) {
  const x = -5.85;
  const front = -29.1;
  const level = terrainAt([x, front]) + 0.24;
  const low = terrainAt([x, front - 12.3]);
  const runs = [1, 8, 15, 25][detail];
  for (let i = 0; i < runs; i++) {
    const length = 12.3 / runs;
    const depth = front - (i + 0.5) * length;
    const y = blend(level, low, (i + 1) / runs);
    const ground = Math.min(terrainAt([x, depth]), y) - 0.22;
    box(out, 'deck', x, ground, depth, 3.43, y - ground + 0.23, length + 0.018, c.dirt);
  }
  if (detail === 0) return;
  for (const edgeX of [x - 1.92, x + 1.92])
    beam(
      out,
      'masonry',
      [edgeX, level + 0.7, front + 0.15],
      [edgeX, low + 0.72, front - 12.3],
      0.45,
      0.49,
      c.plaster,
    );
}

function draw(out, detail) {
  rock(out, detail);
  curtain(out, detail);
  for (const [i, s] of terraces.entries()) keep(out, s.ring, s.bottom, s.y, detail, i < 4);
  const d = plan.dimensions;
  tower(out, d.eastRoundTower, 4.25, -3.7, 9.2, detail);
  tower(out, d.southRoundTower, 4.35, 8.2, 18.0, detail);
  tower(out, d.westRoundTower, 4.4, -0.9, 12.8, detail);
  tower(out, d.upperCrest, d.towerRadius, 15.6, d.upperCrestHeight, detail, true);
  approach(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);

const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [104, 67, -122];
const lookAt = [-6, 11, 0];
export const model = {
  id,
  title: plan.title,
  key: id,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  wikidataId: 'Q7917433',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.sectionBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Nakhal Fort’s pale walls and round crenellated towers follow the exposed rock beneath a high fortified keep.',
  camera,
  lookAt,
  sunDirection: [-38, 63, -79],
  recipeDependencies: ['generate-motat-building.mjs', 'polygon-triangulation.mjs'],
  embeddedCanonicalGraphs: [
    'plaster_lime',
    'stone_limestone_weathered',
    'stone_sandstone',
    'stone_limestone',
  ],
  mediumFiContext: {
    scale: 1,
    cameraYaw: -0.75,
    groundY: -3,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'north-approach-and-rock', position: [-0.5, 11.1, -72], lookAt: [-27, 11.7, -10] },
    { name: 'upper-keep-and-terraces', position: [42, 50, -42], lookAt: [-22, 16, 2] },
    { name: 'southern-courtyard-and-bastion', position: [-42, 34, 74], lookAt: [-14, 13, 8] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module:
      'content/worldgen/source/places/' + plan.cell + '/' + id + '/models/' + slug + '-model.mjs',
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.97,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.47, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.079, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original architectural geometry, informed by the verified public-domain Qualla reference, native mapping and original elevation data.',
};

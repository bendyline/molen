import { readFileSync } from 'node:fs';
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
  palette,
  panel,
  pairs,
  plane,
  rect,
  ring,
  shell,
  surface,
  up,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json');
const d = plan.dimensions;
const grade = floorSampler(read('terrain-grid.json'));
const colors = palette({
  rock: '746f60',
  rockShade: '6a6659',
  ashlar: '93907f',
  buff: 'a29b84',
  edge: 'aca58e',
  gray: '878372',
  weathered: '7f7969',
  dark: '464338',
  black: '323128',
  bronze: 'b09865',
});
const surfaces = {
  ashlar: surface('wall', 'stone_ashlar', 0.95),
  rock: surface('foundation', 'stone_granite', 0.97),
  lintel: surface('trim', 'stone_limestone_weathered', 0.95),
  roofing: surface('roof', 'stone_sandstone_raw', 0.95),
  recess: surface('trim', 'stone_basalt_raw', 0.96),
  detail: surface('trim', 'metal_bronze_cast', 0.88, 0.18),
};
const platformBottom = 2.83;
const platformTop = platformBottom + d.stonePlatformHeight;
const bodyHalf = d.shrineAcross / 2;
const inset = (outline, s) => outline.map(([x, z]) => [s * x, s * z]);
const groundFunction = (p) => Math.min(grade(p) - 0.36, platformBottom - 0.25);

function mass(out, outline, low, high, slot, color, roof = slot) {
  shell(out, outline, typeof low === 'function' ? low : () => low, high, {
    wall: slot,
    color,
    roof,
  });
}

function rockBelow(out, lod) {
  const feet = inset(d.outline, 1.07),
    top = inset(d.outline, 0.978);
  const sign = areaSign(feet);
  for (const [i, [a, b]] of pairs(closed(feet)).entries()) {
    const j = (i + 1) % feet.length;
    const q = at(top[i], platformBottom + 0.014),
      r = at(top[j], platformBottom + 0.014);
    const n = edge(a, b, sign).normal;
    const p = at(a, groundFunction(a)),
      k = at(b, groundFunction(b));
    face(out, 'rock', [p, k, r], n, i % 3 === 0 ? colors.rockShade : colors.rock);
    face(out, 'rock', [p, r, q], n, colors.rock);
  }
  cap(out, 'rock', top, platformBottom + 0.014, colors.rock);
  if (lod < 2) return;
  for (const [x, z, r, h] of [
    [-7.58, 6.1, 1.35, 1.04],
    [-8.92, 4.4, 1.37, 0.87],
    [8.25, 3.42, 1.48, 1.0],
    [7.38, -4.81, 1.48, 1.14],
    [-5.68, -7.92, 1.1, 0.79],
  ]) {
    const y = grade([x, z]) - 0.29;
    ring(
      out,
      'rock',
      [x, z],
      [
        [y, r],
        [y + 0.32, r * 1.1],
        [y + h, r * 0.46],
        [y + h + 0.12, r * 0.09],
      ],
      lod === 2 ? 5 : 6,
      colors.rockShade,
    );
  }
}

function platform(out, lod) {
  rockBelow(out, lod);
  const stage = d.outline;
  mass(out, stage, platformBottom, platformTop - 0.62, 'ashlar', colors.ashlar);
  mass(out, inset(stage, 1.008), platformTop - 0.62, platformTop - 0.36, 'lintel', colors.edge);
  mass(out, inset(stage, 0.978), platformTop - 0.36, platformTop - 0.19, 'ashlar', colors.gray);
  mass(out, inset(stage, 1.017), platformTop - 0.19, platformTop, 'lintel', colors.buff);
  if (lod === 0) return;
  const sign = areaSign(stage),
    heights = lod === 1 ? 6 : 13;
  for (const [[a, b], side] of pairs(closed(stage)).map((p, i) => [p, i])) {
    const w = edge(a, b, sign);
    const bands = Array.from({ length: heights + 1 }, (_, i) =>
      mix(platformBottom + 0.14, platformTop - 0.64, i / heights),
    );
    for (const [i, [y, h]] of pairs(bands).entries()) {
      panel(out, 'lintel', w, 0, w.length, y, y + 0.025, 0.027, colors.weathered);
      if (lod < 2) continue;
      const joints = Math.max(1, Math.round(w.length / (lod === 3 ? 0.76 : 1.12)));
      for (let j = 0; j < joints; j++) {
        const u = ((j + 0.26 + ((i + side) % 2) * 0.33) * w.length) / joints;
        panel(out, 'lintel', w, u, u + 0.024, y + 0.034, h - 0.013, 0.028, colors.gray);
      }
    }
  }
}

function pointed(out, w, x, foot, spring, top, width, lod) {
  const n = [4, 5, 7, 10][lod];
  const half = width * 0.5;
  const apex = Array.from({ length: n + 1 }, (_, i) => {
    const u = (2 * i) / n - 1;
    return [x + half * u, spring + (top - spring) * (1 - 0.73 * Math.abs(u) - 0.27 * u * u)];
  });
  face(
    out,
    'recess',
    [[x - half, foot], ...apex, [x + half, foot]].map(([u, y]) => w.p(u, y, 0.037)),
    w.normal,
    colors.black,
  );
  const frame = [[x - half, foot], ...apex, [x + half, foot]];
  for (const [a, b] of pairs(frame)) {
    const e = (p, s) => [x + s * (p[0] - x), foot + s * (p[1] - foot)];
    const outer = lod === 0 ? 1.09 : 1.22;
    face(
      out,
      'lintel',
      [e(a, 1), e(b, 1), e(b, outer), e(a, outer)].map(([u, y]) => w.p(u, y, 0.071)),
      w.normal,
      colors.edge,
    );
    if (lod > 1)
      face(
        out,
        'lintel',
        [e(a, 1.24), e(b, 1.24), e(b, 1.37), e(a, 1.37)].map(([u, y]) => w.p(u, y, 0.042)),
        w.normal,
        colors.weathered,
      );
  }
}

function ascendingFlight(out, x0, x1, zFar, zNear, begin, finish, count) {
  for (let i = 0; i < count; i++) {
    const a = mix(zFar, zNear, i / count),
      b = mix(zFar, zNear, (i + 1) / count),
      y = mix(begin, finish, (i + 1) / count);
    const bottom = Math.min(y - 0.21, grade([(x0 + x1) * 0.5, b]) - 0.34);
    block(
      out,
      'ashlar',
      x0,
      bottom,
      Math.min(a, b),
      x1 - x0,
      y - bottom,
      Math.abs(a - b) + 0.006,
      colors.buff,
    );
  }
}

function sideStairWall(out, x0, x1, z0, z1, y0, y1, capHeight) {
  const left = [x0, x1],
    bottom = left.map((x) => [
      Math.min(grade([x, z0]) - 0.2, y0 - 0.62),
      Math.min(grade([x, z1]) - 0.2, y1 - 0.58),
    ]);
  for (const [i, x] of left.entries())
    face(
      out,
      'ashlar',
      [
        [x, bottom[i][0], z0],
        [x, bottom[i][1], z1],
        [x, y1, z1],
        [x, y0, z0],
      ],
      [i === 0 ? -1 : 1, 0, 0],
      colors.gray,
    );
  face(
    out,
    'lintel',
    [
      [x0, y0, z0],
      [x1, y0, z0],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    up,
    colors.edge,
  );
  face(
    out,
    'ashlar',
    [
      [x0, bottom[0][0], z0],
      [x1, bottom[1][0], z0],
      [x1, y0, z0],
      [x0, y0, z0],
    ],
    [0, 0, 1],
    colors.weathered,
  );
  if (capHeight)
    face(
      out,
      'lintel',
      [
        [x0, y0 + capHeight, z0],
        [x1, y0 + capHeight, z0],
        [x1, y1 + capHeight, z1],
        [x0, y1 + capHeight, z1],
      ],
      up,
      colors.buff,
    );
}

function stairs(out, lod) {
  const far = d.stairEnd;
  ascendingFlight(out, -1.23, 1.23, far, 16.7, 0.11, 2.56, [4, 6, 9, 10][lod]);
  ascendingFlight(out, -1.65, 1.65, 15.37, 8.07, 2.62, platformTop, [6, 11, 15, 18][lod]);
  const landing = rect(-2.27, 16.95, 2.22, 15.31);
  mass(out, landing, (p) => Math.min(grade(p) - 0.26, 1.81), 2.67, 'ashlar', colors.gray);
  for (const [l, r] of [
    [-2.33, -1.65],
    [1.65, 2.33],
  ]) {
    sideStairWall(out, l, r, 16.46, 8.23, 3.42, platformTop + 0.64, lod > 1 ? 0.06 : 0);
    sideStairWall(out, l, r, far - 0.24, 16.38, 0.89, 3.18, lod > 1 ? 0.06 : 0);
  }
  const front = plane(16.32, 1);
  for (const [a, b] of [
    [-2.34, -0.82],
    [0.82, 2.34],
  ])
    block(out, 'ashlar', a, 1.55, 15.82, b - a, 3.8, 0.5, colors.ashlar);
  block(out, 'ashlar', -2.34, 4.75, 15.82, 4.68, 0.59, 0.5, colors.ashlar);
  pointGate(out, front, lod);
}

function pointGate(out, front, lod) {
  pointed(out, front, 0, 2.63, 4.04, 4.92, 1.64, lod);
  if (lod === 0) return;
  panel(out, 'lintel', front, -2.28, 2.28, 4.98, 5.1, 0.056, colors.buff);
  panel(out, 'lintel', front, -2.28, 2.28, 5.17, 5.38, 0.068, colors.edge);
}

function shrine(out, lod) {
  const p = platformTop;
  const s = bodyHalf;
  const contour = [
    [-s + 0.67, s],
    [-s + 0.67, s - 0.55],
    [-s, s - 0.55],
    [-s, -s + 0.62],
    [-s + 0.65, -s + 0.62],
    [-s + 0.65, -s],
    [s - 0.68, -s],
    [s - 0.68, -s + 0.61],
    [s, -s + 0.61],
    [s, s - 0.58],
    [s - 0.66, s - 0.58],
    [s - 0.66, s],
  ];
  mass(out, inset(contour, 1.03), p, p + 0.36, 'ashlar', colors.weathered);
  mass(out, inset(contour, 1.067), p + 0.36, p + 0.65, 'lintel', colors.edge);
  mass(out, inset(contour, 1.024), p + 0.65, p + 0.95, 'ashlar', colors.buff);
  mass(out, contour, p + 0.95, p + 5.67, 'ashlar', colors.ashlar);
  mass(out, inset(contour, 1.033), p + 5.43, p + 5.67, 'lintel', colors.edge);
  const span = s - 0.06;
  const roof = [
    [-span, -span],
    [span, -span],
    [span, span],
    [-span, span],
  ];
  const y = p + 5.64;
  const inner = roof.map(([x, z]) => [x * 0.625, z * 0.625]);
  const top = roof.map(([x, z]) => [x * 0.233, z * 0.233]);
  for (const [i, [a, b]] of pairs(closed(roof)).entries()) {
    const j = (i + 1) % 4;
    face(
      out,
      'roofing',
      [at(a, y), at(b, y), at(inner[j], y + 0.78), at(inner[i], y + 0.78)],
      up,
      i % 2 ? colors.gray : colors.weathered,
    );
    face(
      out,
      'roofing',
      [at(inner[i], y + 0.78), at(inner[j], y + 0.78), at(top[j], y + 1.47), at(top[i], y + 1.47)],
      up,
      colors.gray,
    );
  }
  cap(out, 'roofing', top, y + 1.47, colors.gray);
  ring(
    out,
    'roofing',
    [0, 0],
    [
      [y + 1.43, 0.81],
      [y + 1.7, 0.93],
      [y + 2.1, 0.9],
      [y + 2.42, 0.66],
      [y + 2.69, 0.313],
      [y + 2.76, 0.093],
    ],
    lod === 0 ? 5 : lod === 1 ? 6 : 9,
    colors.gray,
  );
  ring(
    out,
    'detail',
    [0, 0],
    [
      [y + 2.73, 0.092],
      [y + 2.9, 0.15],
      [y + 3.13, 0.07],
      [y + 3.32, 0.095],
      [y + 3.47, 0.018],
    ],
    lod === 0 ? 4 : 7,
    colors.bronze,
  );
  const front = plane(s + 0.082, 1);
  pointed(out, front, 0, p + 0.972, p + 3.14, p + 4.35, 1.55, lod);
  if (lod === 0) return;
  const gables = [
    front,
    plane(-s - 0.065, -1),
    { normal: [1, 0, 0], p: (u, y, o = 0) => [s + 0.04 + o, y, u] },
    { normal: [-1, 0, 0], p: (u, y, o = 0) => [-s - 0.04 - o, y, u] },
  ];
  for (const w of gables) {
    const ped = [
      [-2.3, p + 4.19],
      [0, p + 5.74],
      [2.3, p + 4.19],
      [2.04, p + 4.12],
      [0, p + 5.41],
      [-2.04, p + 4.12],
    ];
    face(
      out,
      'lintel',
      [ped[0], ped[1], ped[4], ped[5]].map(([u, y]) => w.p(u, y, 0.055)),
      w.normal,
      colors.buff,
    );
    face(
      out,
      'lintel',
      [ped[1], ped[2], ped[3], ped[4]].map(([u, y]) => w.p(u, y, 0.055)),
      w.normal,
      colors.edge,
    );
    if (w !== front) {
      pointed(out, w, 0, p + 1.7, p + 2.9, p + 3.75, 1.5, lod);
      panel(out, 'ashlar', w, -0.47, 0.47, p + 1.73, p + 3.33, 0.066, colors.weathered);
    }
    if (lod > 1)
      for (const k of [-3.89, -3.08, 3.08, 3.89]) {
        panel(out, 'lintel', w, k - 0.08, k + 0.08, p + 1.03, p + 4.76, 0.071, colors.gray);
        panel(out, 'lintel', w, k - 0.17, k + 0.17, p + 4.57, p + 4.77, 0.095, colors.edge);
      }
  }
}

function build(out, lod) {
  platform(out, lod);
  stairs(out, lod);
  shrine(out, lod);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'shankaracharya-temple-model.mjs',
  camera = [-26, 14, 46],
  lookAt = [0, 8.9, 3];
export const shankaracharyaModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'religious',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis:
    'The local stone podium and its stair are registered to the independent hilltop grade. The exact footprint width and axial stair follow the measured Cole plan.',
  brief:
    'Kashmiri stone shrine on a tall octagonal terrace above Srinagar, reached by an axial stair and narrow gateway.',
  surfaces,
  build: closeup,
  limitations: plan.limitations,
  camera,
  lookAt,
  sunDirection: [-35, 56, 59],
  mediumFiContext: {
    scale: 1,
    groundY: -0.22,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.9,
    basis:
      'The surveyed historic shrine platform defines replacement without masking the surrounding precinct.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).map((s) => s.graph),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'axial-stair-and-shrine', position: [-5, 9, 43], lookAt: [0, 9.4, 5] },
    { name: 'octagonal-terrace-and-rock', position: [30, 17, 25], lookAt: [0, 7, 3] },
    { name: 'roof-and-stone-terrace-plan', position: [25, 30, -30], lookAt: [0, 9, 2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'shankaracharya-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.86,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.48, surfaces },
      street: { export: 'street', errorMeters: 0.2, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.055, surfaces },
    },
  },
};

/** Original summit radio hut and adjoining weather systems from cleared exterior evidence. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const p = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  A = p.parameters.architecturalSections,
  F = p.parameters.floorY,
  TAU = 2 * Math.PI;
const C = {
  stone: rgb('a39a93'),
  roof: rgb('62615a'),
  metal: rgb('747c77'),
  cable: rgb('303b38'),
  light: rgb('c6cbc4'),
  dark: rgb('4d5852'),
  door: rgb('5c6962'),
};
export const surfaces = {
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.97, metallic: 0 },
  roof: { slot: 'roof', graph: 'metal_corrugated', roughness: 0.87, metallic: 0.12 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.76, metallic: 0.35 },
  cable: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.96, metallic: 0 },
};
const sub = (a, b) => a.map((x, i) => x - b[i]),
  add = (a, b) => a.map((x, i) => x + b[i]),
  scale = (a, s) => a.map((x) => x * s),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => scale(a, 1 / Math.hypot(...a)),
  H = ([x, y, z]) => [x + A.hutCenter[0], F + y, z + A.hutCenter[1]],
  I = (q) => q;
export const openingEvidence = [],
  mastEvidence = [],
  stoneEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((p) => p.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-9) throw Error('Degenerate authored face');
  if (n && dot(c, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    N,
    q.map((p) =>
      Math.abs(N[1]) > 0.7 ? [p[0], p[2]] : [Math.abs(N[0]) > 0.7 ? p[2] : p[0], p[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function box(o, k, lo, hi, M = I, col = C[k]) {
  const [x, y, z] = lo,
    [X, Y, Z] = hi;
  for (const [q, n] of [
    [
      [
        [x, y, z],
        [X, y, z],
        [X, y, Z],
        [x, y, Z],
      ],
      [0, -1, 0],
    ],
    [
      [
        [x, Y, z],
        [X, Y, z],
        [X, Y, Z],
        [x, Y, Z],
      ],
      [0, 1, 0],
    ],
    [
      [
        [x, y, z],
        [x, Y, z],
        [x, Y, Z],
        [x, y, Z],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [X, y, z],
        [X, Y, z],
        [X, Y, Z],
        [X, y, Z],
      ],
      [1, 0, 0],
    ],
    [
      [
        [x, y, z],
        [x, Y, z],
        [X, Y, z],
        [X, y, z],
      ],
      [0, 0, -1],
    ],
    [
      [
        [x, y, Z],
        [x, Y, Z],
        [X, Y, Z],
        [X, y, Z],
      ],
      [0, 0, 1],
    ],
  ])
    Q(o, k, q.map(M), n, col);
}
function tube(o, k, a, b, r, N = 6, col = C[k], R = r) {
  const d = unit(sub(b, a)),
    u = unit(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(d, u),
    rad = (i) => add(scale(u, Math.cos((i * TAU) / N)), scale(v, Math.sin((i * TAU) / N))),
    P = (at, i, s) => add(at, scale(rad(i), s));
  for (let i = 0; i < N; i++) {
    Q(o, k, [P(a, i, r), P(a, i + 1, r), P(b, i + 1, R), P(b, i, R)], rad(i + 0.5), col);
    T(o, k, [a, P(a, i + 1, r), P(a, i, r)], scale(d, -1), col);
    T(o, k, [b, P(b, i, R), P(b, i + 1, R)], d, col);
  }
}
function pathTube(o, k, points, r, N, col) {
  for (let i = 0; i < points.length - 1; i++) tube(o, k, points[i], points[i + 1], r, N, col);
}
const hash = (i) => {
  let z = (i + 137) * 1103515245 + 12345;
  z = Math.imul(z ^ (z >>> 15), 2246822519);
  return ((z ^ (z >>> 13)) >>> 0) / 4294967296;
};
const bottom = [
    [-1.6, -2.85],
    [1.6, -2.85],
    [2.3, -2.15],
    [2.3, 2.15],
    [1.6, 2.85],
    [-1.6, 2.85],
    [-2.3, 2.15],
    [-2.3, -2.15],
  ],
  top = [
    [-1.45, -2.25],
    [1.45, -2.25],
    [1.75, -1.95],
    [1.75, 1.95],
    [1.45, 2.25],
    [-1.45, 2.25],
    [-1.75, 1.95],
    [-1.75, -1.95],
  ],
  lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t),
  zFront = (y) => -2.85 + ((y - A.hutBaseY) / (A.hutStoneTop - A.hutBaseY)) * 0.6;
/** The stone envelope stays closed behind original cladding, with an actual door void. */
function hut(o, lod) {
  const y0 = A.hutBaseY,
    y1 = A.hutStoneTop;
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8,
      a = bottom[i],
      b = bottom[j],
      c = top[j],
      d = top[i];
    T(o, 'stone', [H([0, y0, 0]), H([a[0], y0, a[1]]), H([b[0], y0, b[1]])], [0, -1, 0]);
    T(o, 'stone', [H([0, y1, 0]), H([d[0], y1, d[1]]), H([c[0], y1, c[1]])], [0, 1, 0]);
    if (i)
      Q(
        o,
        'stone',
        [H([a[0], y0, a[1]]), H([b[0], y0, b[1]]), H([c[0], y1, c[1]]), H([d[0], y1, d[1]])],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
  }
  const left = (y) => -1.6 + ((y - y0) / (y1 - y0)) * 0.15,
    right = (y) => -left(y),
    W = A.doorHalfWidth,
    D0 = A.doorBottom,
    D1 = A.doorTop,
    B = A.doorBackLocalZ,
    face = (a, b, c, d) =>
      Q(
        o,
        'stone',
        [
          H([a(c), c, zFront(c)]),
          H([b(c), c, zFront(c)]),
          H([b(d), d, zFront(d)]),
          H([a(d), d, zFront(d)]),
        ],
        [0, 0, -1],
      );
  face(left, () => -W, y0, y1);
  face(() => W, right, y0, y1);
  face(
    () => -W,
    () => W,
    y0,
    D0,
  );
  face(
    () => -W,
    () => W,
    D1,
    y1,
  );
  Q(o, 'metal', [H([-W, D0, B]), H([W, D0, B]), H([W, D1, B]), H([-W, D1, B])], [0, 0, -1], C.door);
  Q(
    o,
    'stone',
    [H([-W, D0, zFront(D0)]), H([-W, D1, zFront(D1)]), H([-W, D1, B]), H([-W, D0, B])],
    [1, 0, 0],
  );
  Q(
    o,
    'stone',
    [H([W, D0, B]), H([W, D1, B]), H([W, D1, zFront(D1)]), H([W, D0, zFront(D0)])],
    [-1, 0, 0],
  );
  Q(
    o,
    'roof',
    [H([-W, D1, zFront(D1)]), H([W, D1, zFront(D1)]), H([W, D1, B]), H([-W, D1, B])],
    [0, -1, 0],
  );
  Q(
    o,
    'stone',
    [H([-W, D0, zFront(D0)]), H([W, D0, zFront(D0)]), H([W, D0, B]), H([-W, D0, B])],
    [0, 1, 0],
  );
  const mid = (D0 + D1) / 2;
  openingEvidence.push({
    center: H([0, mid, zFront(mid)]),
    normal: [0, 0, -1],
    depth: B - zFront(mid),
    closedBackZ: H([0, 0, B])[2],
  });
  const [X, Z] = A.roofHalf;
  box(o, 'roof', [-X, 1.65, -Z], [X, A.roofTop, Z], H);
  if (lod) {
    for (const x of [-W, W])
      box(o, 'metal', [x - 0.035, D0, B - 0.025], [x + 0.035, D1, B + 0.035], H);
    box(o, 'metal', [-W, D1 - 0.035, B - 0.025], [W, D1 + 0.035, B + 0.035], H);
    tube(o, 'metal', H([0.29, 0.77, B - 0.09]), H([0.29, 0.98, B - 0.09]), 0.025, 4);
    if (lod > 1) {
      for (let x = -1.85; x <= 1.86; x += lod === 3 ? 0.13 : 0.26)
        box(o, 'roof', [x - 0.014, 1.85, -Z], [x + 0.014, 1.88, Z], H);
      for (const y of [0.35, 1.2])
        box(o, 'metal', [-W + 0.02, y, B - 0.055], [-W + 0.1, y + 0.1, B - 0.025], H);
    }
  }
}
/** Individual original convex granite blocks, not photo-derived stone profiles or terrain. */
function rock(o, center, u, n, rx, ry, rz, seed, N) {
  const P = (i, band) => {
      const t = (i * TAU) / N,
        r = [0.48, 1, 0.56][band] * (0.88 + 0.2 * hash(seed + i * 13 + band * 7)),
        a = rx * Math.cos(t) * r,
        b = rz * Math.sin(t) * r;
      return add(
        center,
        add(
          scale(u, a),
          add(
            [0, ry * ([-0.68, 0.02, 0.65][band] + 0.14 * (hash(seed + i * 19) - 0.5)), 0],
            scale(n, b),
          ),
        ),
      );
    },
    col = C.stone.map((x, i) => x * (0.88 + 0.16 * hash(seed)) * [1.01, 1, 0.97][i]);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (let band = 0; band < 2; band++) {
      const q = [P(i, band), P(j, band), P(j, band + 1), P(i, band + 1)],
        mid = scale(q.reduce(add, [0, 0, 0]), 0.25);
      Q(o, 'stone', q, sub(mid, center), col);
    }
    T(o, 'stone', [add(center, [0, ry, 0]), P(i, 2), P(j, 2)], [0, 1, 0], col);
    T(o, 'stone', [add(center, [0, -ry, 0]), P(i, 0), P(j, 0)], [0, -1, 0], col);
  }
}
function masonry(o, lod) {
  if (!lod) return;
  const rows = [0, 2, 3, 5][lod],
    step = [0, 1.25, 0.74, 0.44][lod],
    N = [0, 4, 6, 8][lod];
  for (let side = 0; side < 8; side++) {
    const a = bottom[side],
      b = bottom[(side + 1) % 8],
      c = top[side],
      d = top[(side + 1) % 8],
      L = Math.hypot(...sub(b, a)),
      u = [(b[0] - a[0]) / L, 0, (b[1] - a[1]) / L],
      n = [u[2], 0, -u[0]],
      count = Math.max(1, Math.round(L / step));
    for (let row = 0; row < rows; row++) {
      const y = ((row + 0.5) * A.hutStoneTop) / rows,
        t = y / A.hutStoneTop,
        left = lerp(a, c, t),
        right = lerp(b, d, t);
      for (let j = 0; j < count; j++) {
        const seed = side * 1000 + row * 100 + j,
          f = (j + 0.5 + (row % 2 ? 0.35 : -0.15) + 0.16 * (hash(seed + 53) - 0.5)) / count,
          q = lerp(left, right, f),
          w = (L / count) * 0.46 * (0.82 + 0.37 * hash(seed + 19));
        if (side === 0 && Math.abs(q[0]) < A.doorHalfWidth + w + 0.11 && y - 0.17 < A.doorTop)
          continue;
        const center = H([
          q[0] + n[0] * 0.045,
          y + (0.14 * (hash(seed + 71) - 0.5) * A.hutStoneTop) / rows,
          q[1] + n[2] * 0.045,
        ]);
        rock(
          o,
          center,
          u,
          n,
          w,
          (A.hutStoneTop / rows) * (0.36 + 0.17 * hash(seed + 37)),
          0.1 + hash(seed) * 0.09,
          seed,
          N,
        );
        stoneEvidence.push({ center, radius: w, side, row });
      }
    }
  }
}
function gantry(o, lod) {
  const y0 = A.gantryBottom,
    y1 = A.gantryTop,
    N = [3, 4, 6, 8][lod];
  for (const x of [-0.55, 0.55])
    for (const z of [-0.6, 0.6]) tube(o, 'metal', H([x, y0, z]), H([x, y1, z]), 0.035, N);
  for (const z of [-0.6, 0.6]) tube(o, 'metal', H([-0.62, y1, z]), H([0.62, y1, z]), 0.045, N);
  for (const x of [-0.55, 0.55]) tube(o, 'metal', H([x, y1, -0.6]), H([x, y1, 0.6]), 0.04, N);
  if (lod) {
    tube(o, 'metal', H([-0.55, y0, -0.6]), H([0.55, y1, -0.6]), 0.025, 4);
    tube(o, 'metal', H([0.55, y0, 0.6]), H([-0.55, y1, 0.6]), 0.025, 4);
  }
  tube(
    o,
    'metal',
    H([0, A.heatedCylinderBottom, 0]),
    H([0, A.heatedCylinderTop, 0]),
    A.heatedCylinderRadius,
    [6, 10, 16, 24][lod],
    C.dark,
  );
  if (lod) {
    tube(
      o,
      'metal',
      H([0, A.heatedCylinderTop - 0.025, 0]),
      H([0, A.heatedCylinderTop + 0.025, 0]),
      A.heatedCylinderRadius + 0.022,
      N,
      C.metal,
    );
    box(o, 'metal', [-0.19, 1.55, -2.33], [0.19, 1.88, -2.18], H, C.light);
    if (lod > 1)
      pathTube(
        o,
        'cable',
        [
          H([0, 2.39, 0]),
          H([0.06, 2.09, -0.12]),
          H([0.12, 1.93, -0.6]),
          H([0.12, 1.83, -1.4]),
          H([0.08, 1.66, -2.35]),
        ],
        0.019,
        5,
      );
  }
}
function loopAerial(o, at, axis, lod) {
  const height = 0.75,
    width = 0.075,
    N = [3, 4, 5, 6][lod],
    r = 0.011,
    curve = [
      [-width, -height / 2],
      [-width, height / 2],
      [0, height / 2 + 0.07],
      [width, height / 2],
      [width, -height / 2],
      [0, -height / 2 - 0.07],
      [-width, -height / 2],
    ],
    points = curve.map(([x, y]) => add(at, [axis[0] * x, y, axis[2] * x]));
  pathTube(o, 'metal', points, r, N, C.light);
}
function mast(o, lod) {
  const posts = A.mastPosts,
    levels = [3, 5, 8, 10][lod],
    N = [3, 4, 6, 8][lod],
    r = 0.041;
  for (const [x, z] of posts) {
    tube(o, 'metal', [x, F - 0.1, z], [x, F + A.mastTrussTop, z], r, N);
    mastEvidence.push({ kind: 'post', base: [x, F - 0.1, z], top: [x, F + A.mastTrussTop, z] });
  }
  for (let row = 0; row <= levels; row++) {
    const y = 0.1 + (row * (A.mastTrussTop - 0.1)) / levels;
    for (let i = 0; i < 3; i++) {
      const a = posts[i],
        b = posts[(i + 1) % 3];
      tube(o, 'metal', [a[0], F + y, a[1]], [b[0], F + y, b[1]], 0.024, N);
      if (row < levels) {
        const Y = 0.1 + ((row + 1) * (A.mastTrussTop - 0.1)) / levels;
        tube(o, 'metal', [a[0], F + y, a[1]], [b[0], F + Y, b[1]], 0.018, N);
        if (lod > 1) tube(o, 'metal', [b[0], F + y, b[1]], [a[0], F + Y, a[1]], 0.018, N);
      }
    }
  }
  for (const [x, z] of posts)
    tube(o, 'metal', [x, F + A.mastTrussTop, z], [0, F + A.mastApex, 0], 0.03, N);
  tube(o, 'metal', [0, F + A.mastApex, 0], [0, F + 7.06, 0], 0.033, N, C.metal);
  tube(o, 'metal', [0, F + 6.84, 0], [0, F + 7.035, 0], 0.045, N, C.light);
  for (let i = 0; i < (lod ? 3 : 2); i++) {
    const theta = (i * TAU) / 3,
      x = 0.15 * Math.cos(theta),
      z = 0.15 * Math.sin(theta);
    pathTube(
      o,
      'metal',
      [
        [0, F + 7.01, 0],
        [x, F + 7.06, z],
        [x, F + A.windSensorTop, z],
      ],
      0.013,
      N,
      C.light,
    );
  }
  if (lod) {
    for (let y = 0.14; y <= 5.32; y += lod === 1 ? 0.55 : 0.28) {
      tube(o, 'metal', [0.46, F + y, -0.32], [0.46, F + y, 0.48], 0.015, 4);
    }
    tube(o, 'metal', [0.46, F + 0.05, -0.32], [0.46, F + 5.45, -0.32], 0.024, N);
    tube(o, 'metal', [0.46, F + 0.05, 0.48], [0.46, F + 5.45, 0.48], 0.024, N);
  }
  // Integral weather instruments/radio booms from both cleared angles; no inscription copies.
  const booms =
    lod === 0
      ? [
          [5.4, -1.1, 0.1],
          [4.0, -1.2, 0],
        ]
      : [
          [5.4, -1.1, 0.1],
          [4.0, -1.2, 0],
          [5.25, 0.95, 0.25],
          [2.7, -0.72, -0.2],
        ];
  for (const [y, x, z] of booms) {
    tube(o, 'metal', [0, F + y, 0], [x, F + y, z], 0.029, N);
    if (lod) loopAerial(o, [x, F + y, z], [1, 0, 0], lod);
  }
  if (lod) {
    tube(o, 'metal', [0.95, F + 5.25, 0.25], [1.1, F + 4.92, 0.25], 0.068, N, C.light);
    for (let i = 0; i < 3; i++)
      tube(
        o,
        'metal',
        [1.13, F + 5.17 + i * 0.035, 0.25],
        [1.13, F + 5.19 + i * 0.035, 0.25],
        0.13,
        [6, 8, 12, 16][lod],
        C.light,
      );
    box(o, 'metal', [0.26, F + 4.48, 0.25], [0.48, F + 4.76, 0.38], I, C.light);
    if (lod > 1) {
      for (const [x, z] of [
        [0.3, 0.19],
        [-0.23, 0.3],
      ])
        pathTube(
          o,
          'cable',
          [
            [x, F + 0.12, z],
            [x - 0.1, F + 1.1, z + 0.08],
            [x + 0.05, F + 1.75, z + 0.06],
            [x - 0.13, F + 2.6, z],
            [x, F + 3.4, z + 0.02],
            [x + 0.08, F + 4.62, z],
          ],
          0.015,
          5,
        );
      pathTube(
        o,
        'cable',
        [
          [0.1, F + 0.3, 0.3],
          [0.42, F + 0.45, 0.9],
          [0.63, F + 0.6, 1.4],
          [0.68, F + 0.9, 1.8],
        ],
        0.026,
        5,
      );
    }
  }
}
export function buildCairnGormWeather(o, _frame, lod = 3) {
  openingEvidence.length = 0;
  mastEvidence.length = 0;
  stoneEvidence.length = 0;
  hut(o, lod);
  masonry(o, lod);
  gantry(o, lod);
  mast(o, lod);
}
export const cairnGormSkyline = (o) => buildCairnGormWeather(o, null, 0),
  cairnGormDistrict = (o) => buildCairnGormWeather(o, null, 1),
  cairnGormStreet = (o) => buildCairnGormWeather(o, null, 2),
  cairnGormCloseup = (o) => buildCairnGormWeather(o, null, 3);
export const cairnGormWeatherModel = {
  id: 'cairn_gorm_weather_station',
  key: 'cairn_gorm_weather_station',
  cell: 'gf/gfj',
  title: 'Cairn Gorm summit weather station',
  category: 'infrastructure',
  recipe: 'cairn-gorm-weather-station-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCairnGormWeather,
  brief:
    'Whole summit weather-station structure: low battered granite radio hut/revetment with flat ribbed roof and actual recessed closed access door; rooftop heated AWS cylinder/open gantry and adjoining open triangular weather/radio mast, ladder, crossbracing, sensor booms, antenna loops and cable runs. Native named mast point anchors an explicitly estimated hut plan and bearing. Natural mountain/rockfield, separate summit cairn, distant funicular/ski buildings, signs/QR/plaque copies and interiors excluded.',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: p.sectionBasis,
  camera: [10, 6, -13],
  lookAt: [0.9, 3, 1.5],
  portableGroundY: -0.25,
  mediumFiContext: { scale: '0.4', groundY: -0.1 },
  qaCameras: [
    {
      name: 'whole-stone-hut-both-weather-systems-and-mast',
      position: [-10, 6.5, 13],
      lookAt: [0.6, 3, 1.9],
    },
    {
      name: 'north-access-real-closed-door-recess',
      position: [2.4, 1.8, -4.2],
      lookAt: [0.9, 0.82, 0.35],
    },
    {
      name: 'roof-gantry-and-heated-instrument-cylinder',
      position: [4.8, 4.4, 7],
      lookAt: [0.9, 2.5, 2.8],
    },
    { name: 'open-lattice-ladder-and-radio-booms', position: [3.2, 3.8, -4], lookAt: [0, 3, 0] },
    {
      name: 'upper-wind-sensors-and-antenna-loops',
      position: [3.2, 6.25, -4],
      lookAt: [0, 5.6, 0],
    },
    {
      name: 'native-point-and-estimated-whole-structure-plan',
      position: [7, 15, 9],
      lookAt: [0.7, 1.7, 1.8],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/cairn-gorm-weather-runtime-overlay.mjs',
    level: 'skyline',
    export: 'cairnGormSkyline',
    errorMeters: 0.6,
    surfaces,
    authoredLevels: {
      district: { export: 'cairnGormDistrict', errorMeters: 0.2, surfaces },
      street: { export: 'cairnGormStreet', errorMeters: 0.07, surfaces },
      closeup: { export: 'cairnGormCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'One exact published2021 Mx.GrangerCC0/own hero and one independently verified same-creator/same-day CC0/own second exterior establish both adjoining weather systems and shared host hut. No protected Geograph/operator/research photographs or drawings adopted; primary text used only for station/host identity. No copied pixels/generated photographic textures, plaque/sign/QR copies, questionable sources or article/media/rightsmetadata repairs. Stone census and hidden walls/precise plans/member proportions/sensors/currentfinish are bounded original estimates.',
    'Independent400m129x12916641sample original field/one rawtile frozen before floors/sections/geometry. Fixed1234.7204m SW provider-relative datum is distinct from published summit altitude; neither certifies this unsurveyed doorway/foundation. Source ground never fit/flattened/reacquired and model never raised to hide defects. All placement stays preview/replaceFootprint=false; exact grade/contact unresolved. Flat stage and neighborhood are synthetic review fixtures.',
  ],
};

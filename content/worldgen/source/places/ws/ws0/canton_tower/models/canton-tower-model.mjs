/** Original open structural reconstruction; native base and cleared exterior evidence. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import {
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const plan = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  frame = JSON.parse(fs.readFileSync(new URL('../map-frame.json', import.meta.url))),
  A = plan.parameters.architecturalSections,
  F = plan.parameters.floorY,
  native = frame.geometry.outline.slice(0, -1),
  TAU = 2 * Math.PI;
const C = {
  steel: rgb('b9c9c7'),
  concrete: rgb('8e9b9a'),
  stone: rgb('b0b6af'),
  glass: rgb('35555d'),
  white: rgb('d1d5cc'),
  red: rgb('a9554b'),
};
export const surfaces = {
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.62, metallic: 0.65 },
  concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.92, metallic: 0 },
  stone: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.95, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.43, metallic: 0.16 },
};
const sub = (a, b) => a.map((x, i) => x - b[i]),
  dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0),
  unit = (a) => a.map((x) => x / Math.hypot(...a)),
  add = (a, b) => a.map((x, i) => x + b[i]),
  scale = (a, t) => a.map((x) => x * t),
  cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
export const memberEvidence = [],
  openingEvidence = [];
function T(o, k, q, n, col = C[k]) {
  q = q.map((p) => p.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) throw Error('Degenerate authored face');
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function box(o, k, lo, hi, col) {
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
    Q(o, k, q, n, col);
}
/** Closed tapered member, including real end caps; evidence uses its actual axis. */
function tube(o, k, a, b, r, N = 6, col = C[k], endRadius = r) {
  const axis = unit(sub(b, a)),
    u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = cross(axis, u),
    radial = (i) => add(scale(u, Math.cos((i * TAU) / N)), scale(v, Math.sin((i * TAU) / N))),
    point = (at, i, R) => add(at, scale(radial(i), R));
  for (let i = 0; i < N; i++) {
    Q(
      o,
      k,
      [point(a, i, r), point(a, i + 1, r), point(b, i + 1, endRadius), point(b, i, endRadius)],
      radial(i + 0.5),
      col,
    );
    T(o, k, [a, point(a, i + 1, r), point(a, i, r)], scale(axis, -1), col);
    T(o, k, [b, point(b, i, endRadius), point(b, i + 1, endRadius)], axis, col);
  }
}
/** Native base outline is kept as a low intrinsic foundation, never extruded to tower height. */
function foundation(o, lod) {
  const lo = F + A.basePlinthBottom,
    hi = F + A.basePlinthTop;
  for (let i = 0; i < native.length; i++) {
    const a = native[i],
      b = native[(i + 1) % native.length];
    T(
      o,
      'stone',
      [
        [0, hi, 0],
        [a[0], hi, a[1]],
        [b[0], hi, b[1]],
      ],
      [0, 1, 0],
    );
    T(
      o,
      'stone',
      [
        [0, lo, 0],
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
      ],
      [0, -1, 0],
    );
    Q(
      o,
      'stone',
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  if (lod > 1)
    for (let j = 0; j < 3; j++)
      box(
        o,
        'stone',
        [-5, F + 0.05 + j * 0.085, 8 + j * 0.8],
        [5, F + 0.3 + j * 0.085, 10 + j * 0.8],
      );
}
/** Intersect a ray with the actual native base, without substituting a generic ellipse. */
export function basePoint(theta) {
  const d = [Math.cos(theta + A.baseAxisRadians), Math.sin(theta + A.baseAxisRadians)];
  for (let i = 0; i < native.length; i++) {
    const a = native[i],
      e = sub(native[(i + 1) % native.length], a),
      den = cross2(d, e);
    if (Math.abs(den) < 1e-10) continue;
    const t = cross2(a, e) / den,
      u = cross2(a, d) / den;
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) return scale(d, t);
  }
  throw Error('Native ray has no intersection');
}
export function latticePoint(theta, t) {
  const b = basePoint(theta),
    phi = A.baseAxisRadians + A.topRotationRadians,
    x = A.topSemiAxes[0] * Math.cos(theta),
    z = A.topSemiAxes[1] * Math.sin(theta),
    top = [x * Math.cos(phi) - z * Math.sin(phi), x * Math.sin(phi) + z * Math.cos(phi)];
  return [b[0] * (1 - t) + top[0] * t, F + A.bodyHeight * t, b[1] * (1 - t) + top[1] * t];
}
/** A closed ring member swept around the real twisted cross section. */
function ring(o, k, points, r, N = 4, col = C[k]) {
  const n = points.length,
    P = (i, j) => {
      const p = points[(i + n) % n],
        prev = points[(i - 1 + n) % n],
        next = points[(i + 1) % n],
        t = unit(sub(next, prev)),
        rad = [t[2], 0, -t[0]],
        outward = dot(rad, [p[0], 0, p[2]]) > 0 ? rad : scale(rad, -1);
      return add(p, [
        r * outward[0] * Math.cos((j * TAU) / N),
        r * Math.sin((j * TAU) / N),
        r * outward[2] * Math.cos((j * TAU) / N),
      ]);
    };
  for (let i = 0; i < n; i++)
    for (let j = 0; j < N; j++) {
      const q = [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)],
        mid = scale(add(points[i], points[(i + 1) % n]), 0.5),
        avg = scale(q.reduce(add, [0, 0, 0]), 0.25);
      Q(o, k, q, sub(avg, mid), col);
    }
}
const ellipse = (rx, rz, y, N, angle = 0) =>
  Array.from({ length: N }, (_, i) => {
    const x = rx * Math.cos((i * TAU) / N),
      z = rz * Math.sin((i * TAU) / N);
    return [
      x * Math.cos(angle) - z * Math.sin(angle),
      y,
      x * Math.sin(angle) + z * Math.cos(angle),
    ];
  });
function skin(o, k, levels, N, col = C[k], angle = 0) {
  const rings = levels.map(([y, rx, rz]) => ellipse(rx, rz, F + y, N, angle));
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const a = rings[j][i],
        b = rings[j][(i + 1) % N],
        c = rings[j + 1][(i + 1) % N],
        d = rings[j + 1][i];
      Q(o, k, [a, b, c, d], [a[0] + b[0], 0, a[2] + b[2]], col);
    }
  for (const [r, up] of [
    [rings[0], false],
    [rings.at(-1), true],
  ])
    for (let i = 0; i < N; i++)
      T(o, k, [[0, r[0][1], 0], r[i], r[(i + 1) % N]], [0, up ? 1 : -1, 0], col);
}
/** Closed original entrance volume with a physical45cm door recess; no front wall across aperture. */
function entry(o, lod) {
  const [X, Z] = A.entryPlanHalf,
    Y = F + A.entryTop,
    y = F + 0.3;
  if (lod < 2) {
    box(o, 'glass', [-X, y, -Z], [X, Y, Z]);
    return;
  }
  const x0 = -A.entryWidth / 2,
    x1 = A.entryWidth / 2,
    y0 = F + 0.5,
    y1 = y0 + A.entryHeight,
    z = Z - A.entryRecess;
  Q(
    o,
    'concrete',
    [
      [-X, y, -Z],
      [X, y, -Z],
      [X, Y, -Z],
      [-X, Y, -Z],
    ],
    [0, 0, -1],
  );
  Q(
    o,
    'concrete',
    [
      [-X, y, -Z],
      [-X, y, Z],
      [-X, Y, Z],
      [-X, Y, -Z],
    ],
    [-1, 0, 0],
  );
  Q(
    o,
    'concrete',
    [
      [X, y, -Z],
      [X, y, Z],
      [X, Y, Z],
      [X, Y, -Z],
    ],
    [1, 0, 0],
  );
  Q(
    o,
    'steel',
    [
      [-X, Y, -Z],
      [X, Y, -Z],
      [X, Y, Z],
      [-X, Y, Z],
    ],
    [0, 1, 0],
  );
  for (const [x, X2, a, b] of [
    [-X, x0, y, Y],
    [x1, X, y, Y],
    [x0, x1, y, y0],
    [x0, x1, y1, Y],
  ])
    Q(
      o,
      'glass',
      [
        [x, a, Z],
        [X2, a, Z],
        [X2, b, Z],
        [x, b, Z],
      ],
      [0, 0, 1],
    );
  Q(
    o,
    'concrete',
    [
      [x0, y0, Z],
      [x0, y1, Z],
      [x0, y1, z],
      [x0, y0, z],
    ],
    [1, 0, 0],
  );
  Q(
    o,
    'concrete',
    [
      [x1, y0, z],
      [x1, y1, z],
      [x1, y1, Z],
      [x1, y0, Z],
    ],
    [-1, 0, 0],
  );
  Q(
    o,
    'concrete',
    [
      [x0, y1, z],
      [x1, y1, z],
      [x1, y1, Z],
      [x0, y1, Z],
    ],
    [0, -1, 0],
  );
  Q(
    o,
    'stone',
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y0, Z],
      [x0, y0, Z],
    ],
    [0, 1, 0],
  );
  Q(
    o,
    'glass',
    [
      [x0, y0, z],
      [x1, y0, z],
      [x1, y1, z],
      [x0, y1, z],
    ],
    [0, 0, 1],
  );
  box(o, 'steel', [-0.06, y0, z + 0.015], [0.06, y1, z + 0.11]);
  for (let i = 0; i < 5; i++)
    box(o, 'steel', [-X + (i * X) / 2 - 0.045, y, Z], [-X + (i * X) / 2 + 0.045, Y, Z + 0.09]);
  openingEvidence.push({
    name: 'bounded-original-base-entry',
    center: [0, (y0 + y1) / 2, Z],
    outward: [0, 0, 1],
    recess: A.entryRecess,
    closedBackZ: z,
  });
}
function core(o, lod) {
  const N = [8, 12, 20, 32][lod],
    levels =
      lod === 0
        ? [
            [12, 7, 8.5],
            [375, 7, 8.5],
            [445, 16, 13],
          ]
        : [
            [12, 7, 8.5],
            [30, 7, 8.5],
            [110, 7, 8.5],
            [165, 7, 8.5],
            [330, 7, 8.5],
            [375, 9, 9],
            [405, 14, 12],
            [440, 16, 13],
            [446, 15, 12.5],
          ];
  skin(o, 'glass', levels, N);
  if (lod) {
    for (const y of [30, 110, 165, 375, 405, 425, 440])
      skin(
        o,
        'steel',
        [
          [y - 0.35, y < 375 ? 7.25 : 15.9, y < 375 ? 8.75 : 13.2],
          [y + 0.35, y < 375 ? 7.25 : 15.9, y < 375 ? 8.75 : 13.2],
        ],
        N,
      );
    if (lod > 1) {
      for (let i = 0; i < N; i++) {
        const a = ellipse(16.1, 13.1, F + 405, N)[i],
          b = [a[0], F + 440, a[2]];
        tube(o, 'steel', a, b, 0.105, 4);
      }
      for (let y = 402; y <= 440; y += lod === 3 ? 2.4 : 5)
        ring(o, 'steel', ellipse(15.95, 13.15, F + y, N), 0.08, 3);
    }
  }
  entry(o, lod);
}
function antenna(o, lod) {
  const N = [4, 6, 10, 16][lod],
    stages = lod
      ? [
          [450, 3.7],
          [475, 2.9],
          [488, 2.65],
          [515, 2.3],
          [520, 1.7],
          [548, 1.35],
          [555, 0.9],
          [579, 0.62],
          [594, 0.3],
          [600, 0.09],
        ]
      : [
          [450, 3.4],
          [520, 1.7],
          [580, 0.55],
          [600, 0.08],
        ];
  for (let j = 0; j < stages.length - 1; j++) {
    const [a, r] = stages[j],
      [b, R] = stages[j + 1],
      red = a >= 548 && j % 2 === 1;
    tube(o, 'steel', [0, F + a, 0], [0, F + b, 0], r, N, red ? C.red : C.white, R);
  }
  if (lod)
    for (const [y, r] of [
      [450, 4.4],
      [475, 4.7],
      [488, 3.8],
      [515, 3.2],
      [548, 1.8],
      [579, 1.2],
      [594, 0.8],
    ])
      skin(
        o,
        'steel',
        [
          [y - 0.55, r, r],
          [y + 0.55, r, r],
        ],
        N,
      );
  if (lod > 1) {
    for (let i = 0; i < 8; i++) {
      const theta = (i * TAU) / 8;
      tube(
        o,
        'steel',
        [4.5 * Math.cos(theta), F + 451, 4.5 * Math.sin(theta)],
        [1.6 * Math.cos(theta), F + 487, 1.6 * Math.sin(theta)],
        0.16,
        4,
      );
      tube(
        o,
        'steel',
        [2.8 * Math.cos(theta), F + 490, 2.8 * Math.sin(theta)],
        [2.8 * Math.cos(theta), F + 515, 2.8 * Math.sin(theta)],
        0.13,
        4,
      );
    }
    if (lod === 3)
      for (let i = 0; i < 4; i++)
        tube(
          o,
          'steel',
          [0, F + 458, 0],
          [8 * Math.cos((i * TAU) / 4), F + 474, 8 * Math.sin((i * TAU) / 4)],
          0.15,
          5,
        );
  }
}
function roof(o, lod) {
  const N = [8, 12, 24, 48][lod],
    phi = A.baseAxisRadians + A.topRotationRadians;
  skin(
    o,
    'concrete',
    [
      [447.2, 24, 17.5],
      [449, 24, 17.5],
    ],
    N,
    C.concrete,
    phi,
  );
  if (lod) {
    ring(o, 'steel', ellipse(24, 17.5, F + 450.1, N, phi), 0.22, 4);
    if (lod > 1) {
      ring(o, 'steel', ellipse(24, 17.5, F + 451.1, N, phi), 0.11, 4);
      for (const a of ellipse(24, 17.5, F + 449, N, phi))
        tube(o, 'steel', a, [a[0], F + 451.1, a[2]], 0.08, 4);
      // Small closed original service/observation caps suggested by the cleared2011 silhouette.
      if (lod === 3)
        for (const [i, a] of ellipse(25, 18.5, F + 451, 16, phi).entries()) {
          tube(o, 'steel', [a[0], F + 449, a[2]], a, 0.24, 5);
          const r = 1.25;
          box(o, 'glass', [a[0] - r, F + 451, a[2] - 0.95], [a[0] + r, F + 452.9, a[2] + 0.95]);
          box(
            o,
            'steel',
            [a[0] - r - 0.1, F + 452.9, a[2] - 1.05],
            [a[0] + r + 0.1, F + 453.15, a[2] + 1.05],
            i % 4 === 0 ? C.red : C.steel,
          );
        }
    }
  }
}
export function buildCantonTower(o, _frame, lod = 3) {
  memberEvidence.length = 0;
  openingEvidence.length = 0;
  foundation(o, lod);
  core(o, lod);
  roof(o, lod);
  antenna(o, lod);
  const columns = [8, 12, 24, 24][lod],
    levels = [5, 16, 46, 46][lod],
    radial = [3, 4, 8, 12][lod],
    ringSegments = [8, 12, 24, 48][lod],
    ringRadial = [3, 3, 3, 4][lod];
  for (let i = 0; i < columns; i++) {
    const theta = (i * TAU) / columns,
      a = latticePoint(theta, 0),
      b = latticePoint(theta, 1);
    tube(o, 'steel', a, b, A.columnRadius[0], radial, C.steel, A.columnRadius[1]);
    memberEvidence.push({ kind: 'primary-column', a, b, radius: A.columnRadius[0] });
  }
  for (let j = 0; j < levels; j++) {
    const t = j / (levels - 1),
      points = Array.from({ length: ringSegments }, (_, i) =>
        latticePoint((i * TAU) / ringSegments, t),
      );
    ring(o, 'steel', points, A.ringRadius, ringRadial);
    memberEvidence.push({ kind: 'horizontal-ring', height: F + A.bodyHeight * t });
  }
  const diagonalLevels = [3, 10, 15, 45][lod],
    diagonalSides = [3, 3, 3, 4][lod],
    directions = lod === 3 ? [-1, 1] : [1];
  for (let j = 0; j < diagonalLevels; j++)
    for (let i = 0; i < columns; i++)
      for (const dir of directions) {
        const a = latticePoint((i * TAU) / columns, j / diagonalLevels),
          b = latticePoint(((i + dir) * TAU) / columns, (j + 1) / diagonalLevels);
        tube(o, 'steel', a, b, A.diagonalRadius, diagonalSides);
        memberEvidence.push({ kind: 'diagonal', a, b, radius: A.diagonalRadius });
      }
}
export const cantonSkyline = (o) => buildCantonTower(o, null, 0),
  cantonDistrict = (o) => buildCantonTower(o, null, 1),
  cantonStreet = (o) => buildCantonTower(o, null, 2),
  cantonCloseup = (o) => buildCantonTower(o, null, 3);
export const cantonTowerModel = {
  id: 'canton_tower',
  key: 'canton_tower',
  cell: 'ws/ws0',
  title: 'Canton Tower',
  wikidataId: 'Q168400',
  category: 'tower',
  recipe: 'canton-tower-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCantonTower,
  brief:
    'Whole600m Canton Tower: exact native26control intrinsic base, open24-column inclined pale steel lattice with46 horizontal rings/diagonals, twisting narrow waist and flared upper basket, opaque blue-grey inner core/public-level banks, top observation roof/rail and complete150m segmented antenna with pale/red upper aerial. Original recessed base entrance and hidden member/base/roof-service details are bounded photographic estimates. No similarly named stations, plaza/property slab, neighboring buildings, temporary festival installations, people, signs or interiors.',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: plan.sectionBasis,
  camera: [630, 350, 780],
  lookAt: [0, 290, 0],
  portableGroundY: -0.7,
  mediumFiContext: { scale: '1', groundY: -0.7 },
  qaCameras: [
    {
      name: 'whole-twisted-tower-and-complete-antenna',
      position: [630, 350, 780],
      lookAt: [0, 295, 0],
    },
    {
      name: 'opposite-whole-open-lattice-and-core',
      position: [-620, 390, -720],
      lookAt: [0, 300, 0],
    },
    {
      name: 'native-base-open-inclined-columns-and-entry',
      position: [85, 25, 95],
      lookAt: [0, 18, 0],
    },
    {
      name: 'waist-cross-braces-rings-and-opaque-core',
      position: [72, 290, 80],
      lookAt: [0, 270, 0],
    },
    {
      name: 'upper-basket-observation-roof-and-mast-foot',
      position: [95, 478, 105],
      lookAt: [0, 430, 0],
    },
    {
      name: 'segmented-antenna-and-red-white-aerial',
      position: [75, 559, 88],
      lookAt: [0, 545, 0],
    },
    { name: 'native-plan-and-twisted-upper-ellipse', position: [5, 790, 8], lookAt: [0, 0, 0] },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/canton-tower-runtime-overlay.mjs',
    level: 'skyline',
    export: 'cantonSkyline',
    errorMeters: 2.5,
    surfaces,
    authoredLevels: {
      district: { export: 'cantonDistrict', errorMeters: 1.2, surfaces },
      street: { export: 'cantonStreet', errorMeters: 0.4, surfaces },
      closeup: { export: 'cantonCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    plan.geometryBasis,
    plan.sectionBasis,
    'One exact already published2011 Brücke-Osteuropa CC0/own original, personally inspected and nativeSHA1 matched after Qualla-first47family scan. Early construction/model photograph unselected. No supplemental images, questionable sources, copied pixels, generated bitmaps or article/media/rightsmetadata repairs. Historic2011 exterior informs standing architecture; hidden base/current finish/public-level heights/census/member sections/service caps are original bounded estimates, not structural drawings or a current survey.',
    'Independent400m129x12916641sample field/two original tiles frozen before floors/sections/geometry; unchanged SW provider datum-1.1728m. Field includes urban/river artifacts and an extreme negative elevation anomaly; no fit/flatten/reacquire/model raising. Floor0 is unsurveyed; exact foundations/grade unresolved and placement remains preview/replaceFootprint=false. Portable and neighborhood ground are synthetic fixtures, not geographic evidence.',
  ],
};

import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  floorSampler,
  mix,
  pairs,
  palette,
  panel,
  rect,
  shell,
  surface,
  trimBlock,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { roofCap } from '../../../../../../../../packages/worldgen/scripts/tytuvenai-ensemble-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json'),
  d = plan.dimensions,
  terrain = floorSampler(read('terrain-grid.json'));
const [cx, cz] = d.center;
const base = terrain(d.center) - 0.26;
const y = (h) => base + h;
const c = palette({
  stone: 'a99a83',
  tan: 'baab90',
  sharp: 'c0af91',
  band: '937f6c',
  darkStone: '837866',
  copper: '739081',
  copper2: '668577',
  greenDark: '547165',
  shadow: '434e4c',
  window: '4f5b51',
  iron: '526660',
});
const surfaces = {
  wall: surface('wall', 'stone_sandstone', 0.93),
  trim: surface('trim', 'stone_ashlar', 0.92),
  copper: surface('roof', 'metal_copper', 0.78, 0.26),
  dark: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.51 },
  iron: surface('door', 'metal_painted', 0.7, 0.29),
};
const axes = d.outerCorners.map(([x, z]) => {
  const a = x - cx,
    b = z - cz,
    l = Math.hypot(a, b);
  return [a / l, b / l];
});
const shape = (r) => axes.map(([x, z]) => [cx + x * r, cz + z * r]);
const foundation = (p) => Math.min(y(0.4), terrain(p) - 0.52);
const style = (role, color, roof = 'copper', roofColor = c.copper) => ({
  wall: role,
  color,
  roof,
  roofColor,
});
function crownBand(out, profile, slot, color) {
  loft(
    out,
    slot,
    profile.map(([h, r]) => shape(r).map((p) => at(p, y(h)))),
    color,
    { cap: false },
  );
}
const windows = (poly) => pairs(closed(poly)).map(([a, b]) => edge(a, b, areaSign(poly)));

function lancet(out, w, u, low, spring, top, width, level, glass = c.window) {
  // Two curved halves meet at the pointed arch crown.
  const radius = width / 2;
  const n = [2, 4, 6, 8][level];
  const curve = Array.from({ length: 2 * n + 1 }, (_, i) => {
    const f = (i - n) / n;
    return [u + f * radius, mix(top, spring, Math.pow(Math.abs(f), 1.83))];
  });
  panel(out, 'dark', w, u - radius, u + radius, y(low), y(spring), 0.06, glass);
  face(
    out,
    'dark',
    curve.map(([x, h]) => w.p(x, y(h), 0.06)),
    w.normal,
    glass,
  );
  if (level === 0) return;
  const wider = curve.map(([x, h], i) => [
    u + (x - u) * (1 + 0.16 / radius),
    h + 0.13 * (1 - (0.38 * Math.abs(i - n)) / n),
  ]);
  for (const [i, [a, b]] of pairs(curve).entries()) {
    const [p, q] = wider.slice(i, i + 2);
    face(
      out,
      'trim',
      [
        w.p(a[0], y(a[1]), 0.11),
        w.p(b[0], y(b[1]), 0.11),
        w.p(q[0], y(q[1]), 0.14),
        w.p(p[0], y(p[1]), 0.14),
      ],
      w.normal,
      c.sharp,
    );
  }
  for (const dir of [-1, 1]) {
    const lo = u + dir * radius,
      hi = u + dir * (radius + 0.16);
    panel(out, 'trim', w, Math.min(lo, hi), Math.max(lo, hi), y(low), y(spring), 0.11, c.tan);
  }
  panel(
    out,
    'trim',
    w,
    u - radius - 0.17,
    u + radius + 0.17,
    y(low) - 0.19,
    y(low) + 0.008,
    0.125,
    c.sharp,
  );
  if (level > 1) {
    for (const x of width > 1 ? [u - radius * 0.43, u + radius * 0.43] : [u])
      panel(out, 'trim', w, x - 0.038, x + 0.038, y(low) + 0.03, y(spring + 0.2), 0.092, c.tan);
    for (const h of [mix(low, spring, 0.42), spring - 0.03])
      panel(out, 'trim', w, u - radius, u + radius, y(h) - 0.035, y(h) + 0.035, 0.092, c.tan);
  }
}

function rotunda(out, level) {
  const apse = shape(d.wallRadius);
  shell(out, apse, foundation, y(3.56), style('wall', c.darkStone, 'trim', c.stone));
  shell(out, apse, () => y(3.55), y(d.apseWallHeight), style('wall', c.stone));
  shell(
    out,
    shape(d.drumRadius),
    () => y(d.apseWallHeight - 0.06),
    y(d.drumHeight),
    style('wall', c.tan),
  );
  const parapets = [
    [2.8, 16.47],
    [3.55, 16.52],
    [8.31, 16.4],
    [12.7, 16.58],
    [13.2, 16.66],
    [24.55, 13.25],
    [25.0, 13.3],
  ].filter((_, index) => level > 1 || (level === 1 && [0, 3, 5].includes(index)));
  for (const [h, r] of parapets)
    crownBand(
      out,
      [
        [h - 0.15, r - 0.18],
        [h - 0.05, r],
        [h + 0.22, r],
        [h + 0.36, r - 0.14],
      ],
      'trim',
      c.sharp,
    );
  roofCap(
    out,
    'copper',
    d.center,
    [
      [y(13.2), 16.72],
      [y(13.38), 16.75],
      [y(17.65), 12.82],
    ],
    axes,
    c.copper2,
  );
  if (level > 0) {
    for (const [i, w] of windows(apse).entries()) {
      if (i === 15) continue;
      const u = w.length / 2;
      for (const v of [-0.89, 0, 0.89])
        lancet(out, w, u + v, 5.12, 7.64, 8.68, 0.68, level === 1 ? 0 : level);
      if (level > 1) lancet(out, w, u, 0.85, 1.73, 2.24, 0.58, level, c.shadow);
    }
  }
  for (const w of windows(shape(d.drumRadius))) {
    const u = w.length / 2;
    if (level === 0) panel(out, 'dark', w, u - 0.95, u + 0.95, y(18.15), y(23.35), 0.06, c.window);
    else lancet(out, w, u, 18.15, 21.95, 23.64, 2.1, level);
    if (level > 1) {
      panel(out, 'trim', w, u - 0.08, u + 0.08, y(18.18), y(23.41), 0.095, c.sharp);
      for (const v of [-0.6, 0.6]) lancet(out, w, u + v, 18.55, 20.55, 21.36, 0.35, 0, c.shadow);
    }
  }
}

function pier(out, index, level) {
  const [nx, nz] = axes[index],
    ux = -nz,
    uz = nx;
  const p = (r, u, h) => [cx + nx * r + ux * u, y(h), cz + nz * r + uz * u];
  const foot = p(19.4, 0, 0);
  const start = Math.min(-0.32, terrain([foot[0], foot[2]]) - base - 0.32);
  const section = (h, r, w, k) => [
    p(r - k, -w, h),
    p(r - k, w, h),
    p(r + k, w, h),
    p(r + k, -w, h),
  ];
  const profile =
    level > 0
      ? [
          [start, 19.0, 0.88, 1.2],
          [3.03, 18.9, 0.79, 1.02],
          [3.26, 18.81, 0.72, 0.88],
          [8.28, 18.46, 0.58, 0.73],
          [8.65, 18.45, 0.63, 0.8],
          [12.6, 18.45, 0.48, 0.56],
          [14.25, 18.44, 0.36, 0.42],
          [16.18, 18.41, 0.18, 0.23],
          [17.31, 18.41, 0.035, 0.04],
        ]
      : [
          [start, 19.0, 0.9, 1.2],
          [8.0, 18.5, 0.63, 0.84],
          [13.35, 18.43, 0.44, 0.5],
          [17.3, 18.41, 0.035, 0.04],
        ];
  loft(
    out,
    'trim',
    profile
      .filter((_, i) => level > 1 || (level === 1 ? [0, 2, 4, 6, 8].includes(i) : i !== 2))
      .map((params) => section(...params)),
    index % 3 === 0 ? c.tan : c.sharp,
  );
  const n = [1, 3, 6, 8][level],
    width = level === 0 ? 0.44 : 0.35;
  const k = (t, u, bottom) => {
    const r = mix(17.99, 12.83, t);
    const angleRise = bottom ? 2.15 + 8.84 * t + 1.47 * Math.sin(Math.PI * t) : 3.48 + 9.35 * t;
    return p(r, u, 10.5 + angleRise);
  };
  for (let j = 0; j < n; j++) {
    const a = j / n,
      b = (j + 1) / n;
    for (const s of [-1, 1])
      face(
        out,
        'wall',
        [
          k(a, s * width, false),
          k(b, s * width, false),
          k(b, s * width, true),
          k(a, s * width, true),
        ],
        [ux * s, 0, uz * s],
        c.tan,
      );
    face(
      out,
      'trim',
      [k(a, -width, false), k(b, -width, false), k(b, width, false), k(a, width, false)],
      [0, 1, 0],
      c.sharp,
    );
    face(
      out,
      'trim',
      [k(a, width, true), k(b, width, true), k(b, -width, true), k(a, -width, true)],
      [0, -1, 0],
      c.band,
    );
  }
  if (level > 1) {
    const inner = [
      [22.0, 12.89, 0.38, 0.42],
      [25.05, 12.96, 0.42, 0.38],
      [28.1, 12.86, 0.24, 0.27],
      [29.5, 12.7, 0.05, 0.055],
    ];
    loft(
      out,
      'trim',
      inner.map((params) => section(...params)),
      c.sharp,
    );
    if (level > 1) {
      const accent = p(18.39, 0, 16.5);
      beam(out, 'iron', accent, p(18.39, 0, 17.67), 0.045, 0.045, c.iron);
    }
  }
}

function copperRoof(out, level) {
  const roof = [
    [25.05, 13.28],
    [25.26, 13.45],
    [26.4, 13.02],
    [34.25, 7.94],
    [38.6, 5.65],
  ].filter((_, index) => level > 0 || [0, 2, 4].includes(index));
  roofCap(
    out,
    'copper',
    d.center,
    roof.map(([h, r]) => [y(h), r]),
    axes,
    c.copper,
  );
  shell(out, shape(5.61), () => y(d.upperRidge - 0.06), y(d.lanternShoulder), style('wall', c.tan));
  for (const w of windows(shape(5.61))) {
    if (level === 0) continue;
    lancet(
      out,
      w,
      w.length / 2,
      39.3,
      42.16,
      43.52,
      Math.min(0.86, w.length * 0.56),
      level,
      c.shadow,
    );
    if (level > 0) {
      const m = w.length * 0.5;
      face(
        out,
        'trim',
        [w.p(m - 0.89, y(42.84), 0.12), w.p(m + 0.89, y(42.84), 0.12), w.p(m, y(46.14), 0.28)],
        w.normal,
        c.sharp,
      );
    }
  }
  roofCap(
    out,
    'copper',
    d.center,
    [
      [y(44.94), 5.8],
      [y(45.31), 5.75],
      [y(50.78), 2.32],
      [y(d.spireRoofTop), 0.24],
      [y(56.05), 0],
    ],
    axes,
    c.greenDark,
  );
  if (level > 0) {
    for (const a of level === 1 ? axes.filter((_, i) => i % 2 === 0) : axes) {
      for (const [radA, hA, radB, hB] of [
        [13.27, 25.65, 7.94, 34.28],
        [7.94, 34.28, 5.65, 38.61],
        [5.72, 45.22, 0.24, 55.9],
      ]) {
        beam(
          out,
          'copper',
          [cx + a[0] * radA, y(hA), cz + a[1] * radA],
          [cx + a[0] * radB, y(hB), cz + a[1] * radB],
          0.09,
          0.088,
          c.copper2,
        );
      }
    }
  }
  beam(out, 'iron', [cx, y(55.86), cz], [cx, y(d.heightToFinial), cz], 0.11, 0.1, c.iron);
  if (level > 0) {
    const span = 0.76;
    beam(out, 'iron', [cx - span, y(57.22), cz], [cx + span, y(57.22), cz], 0.071, 0.072, c.iron);
    beam(out, 'iron', [cx, y(57.22), cz - span], [cx, y(57.22), cz + span], 0.071, 0.072, c.iron);
  }
}
function connector(out, level) {
  const north = 13.8,
    south = 20.16;
  const rectFoot = rect(-3.75, north, 4.6, south);
  shell(out, rectFoot, foundation, y(10.35), style('wall', c.stone));
  const roof = [
    [
      [-3.89, north],
      [0.42, north],
      [0.42, south + 0.09],
      [-3.89, south + 0.09],
    ],
    [
      [0.42, north],
      [4.74, north],
      [4.74, south + 0.09],
      [0.42, south + 0.09],
    ],
  ];
  for (const [i, r] of roof.entries())
    face(
      out,
      'copper',
      r.map((p, j) => at(p, y((i === 0 ? [1, 2] : [0, 3]).includes(j) ? 14.36 : 10.37))),
      [0, 1, 0],
      c.copper2,
    );
  face(
    out,
    'wall',
    [
      [-3.87, y(10.38), south],
      [4.72, y(10.38), south],
      [0.42, y(14.36), south],
    ],
    [0, 0, 1],
    c.stone,
  );
  if (level > 0) {
    const east = edge([4.6, north], [4.6, south]);
    for (const u of [1.9, 4.35]) lancet(out, east, u, 4.28, 7.3, 8.11, 1.15, level);
    const west = edge([-3.75, south], [-3.75, north]);
    for (const u of [1.83, 4.15]) lancet(out, west, u, 4.13, 7.3, 8.11, 1.15, level);
  }
}
function build(out, level) {
  rotunda(out, level);
  for (let i = 0; i < d.radialButtresses; i++) pier(out, i, level);
  copperRoof(out, level);
  connector(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'library-of-parliament-model.mjs';
const camera = [95, 52, -119],
  lookAt = [0, 23, -1];
const errors = { district: 0.79, street: 0.29, closeup: 0.105 };
export const libraryOfParliamentAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'civic-institutional',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis:
    'Original Natural Resources Canada bare-earth elevation on the Ottawa River bluff and matching Centre Block frame.',
  brief:
    'Ottawa’s Victorian Gothic Library of Parliament, with 16 flying buttresses, pointed sandstone windows, radiating copper roof, ornamented lantern and spire.',
  camera,
  lookAt,
  sunDirection: [28, 81, -57],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'Independently named Library of Parliament footprint with its short connector.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'montreal-museum-pavilion-geometry.mjs',
    'tytuvenai-ensemble-geometry.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'library-from-the-ottawa-river-bluff', position: [45, 24, -72], lookAt: [0, 20, -7] },
    {
      name: 'sandstone-lancets-and-flying-buttresses',
      position: [27, 17, -39],
      lookAt: [0, 15, -11],
    },
    { name: 'copper-roof-and-lantern', position: [-20, 55, -60], lookAt: [0, 40, -1] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'library-of-parliament-' + reviewLod,
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
    authoredLevels: Object.fromEntries(
      Object.entries(errors).map(([name, errorMeters]) => [
        name,
        { export: name, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original mesh under the project license. © OpenStreetMap contributors. Natural Resources Canada terrain. Canadiana archive scan of an 1877 printed engraving.',
};

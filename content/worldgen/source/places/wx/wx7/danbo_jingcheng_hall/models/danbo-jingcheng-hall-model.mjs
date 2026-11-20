import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  at,
  block,
  edge,
  face,
  floorSampler,
  mix,
  palette,
  panel,
  rect,
  shell,
  stairs,
  surface,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';

const read = (file) => JSON.parse(readFileSync(new URL('../' + file, import.meta.url)));
const plan = read('plan-controls.json'),
  d = plan.dimensions,
  grade = floorSampler(read('terrain-grid.json'));
const datum = grade([0, 0]);
const y = (height) => datum + height;
const c = palette({
  stone: 'a6a293',
  masonry: '999a92',
  edge: 'b5b0a1',
  timber: '927762',
  warm: '816754',
  woodLight: 'a3876a',
  woodDark: '624c3d',
  dark: '423b31',
  pane: '544a3c',
  roof: '626868',
  ridge: '6c6f6b',
  slate: '727473',
  gold: 'aa9364',
});
const surfaces = {
  stone: surface('foundation', 'stone_ashlar', 0.91),
  brick: surface('wall', 'brick', 0.94),
  wood: surface('trim', 'wood_plain', 0.88),
  tile: surface('roof', 'tile_flat', 0.89),
  screen: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.8 },
};
const W = d.outerGalleryWidth * 0.5,
  D = d.outerGalleryDepth * 0.5;
const coreWidth = d.structuralCoreWidth * 0.5,
  coreDepth = d.structuralCoreDepth * 0.5;
const left = [-16.15, -11.9, -7.3, -2.55, 2.55, 7.3, 11.9, 16.15];
const side = [-7.05, -2.46, 2.46, 7.05];
const safeBase = (top) => (p) => Math.min(top - 0.15, grade(p) - 0.33);
const masonry = (color) => ({ wall: 'stone', roof: 'stone', color, roofColor: c.masonry });
const rod = (out, a, b, r, s, color = c.woodDark) => beam(out, 'wood', a, b, r, s, color);

function platform(out, level) {
  const floor = y(d.plinthHeight);
  const outer = rect(-W, -D, W, D);
  shell(out, outer, safeBase(floor), floor - 0.17, masonry(c.stone));
  shell(
    out,
    rect(-W - 0.08, -D - 0.08, W + 0.08, D + 0.08),
    () => floor - 0.18,
    floor,
    masonry(c.edge),
  );
  const n = level === 0 ? 3 : 5;
  stairs(out, grade, 'stone', -3.08, 3.08, 11.45, D - 0.08, floor + 0.012, n, c.stone);
  if (level > 0) {
    for (const x of [-3.43, 3.13]) {
      const profile = [
        [x, 9.93],
        [x + 0.29, 9.93],
        [x + 0.29, 8.32],
        [x, 8.32],
      ];
      shell(out, profile, safeBase(floor + 0.09), floor + 0.09, masonry(c.edge));
    }
  }
}
function timberPost(out, x, z, level) {
  const sides = [6, 8, 10, 14][level];
  const height = d.beamHeight - 0.57;
  const profile =
    level === 0
      ? [
          [d.plinthHeight, 0.31],
          [height, 0.27],
        ]
      : [
          [d.plinthHeight, 0.35],
          [d.plinthHeight + 0.17, 0.36],
          [d.plinthHeight + 0.23, 0.3],
          [height - 0.21, 0.265],
          [height, 0.29],
        ];
  const rings = profile.map(([h, r]) =>
    Array.from({ length: sides }, (_, i) => {
      const angle = (2 * Math.PI * i) / sides;
      return [x + r * Math.cos(angle), y(h), z + r * Math.sin(angle)];
    }),
  );
  loft(out, 'wood', rings, c.woodLight);
  if (level > 0)
    block(out, 'stone', x - 0.37, y(d.plinthHeight - 0.04), z - 0.37, 0.74, 0.19, 0.74, c.masonry);
}
function perimeter(out, level) {
  for (const z of [-side[3], side[3]]) for (const x of left) timberPost(out, x, z, level);
  for (const x of [left[0], left[7]])
    for (const z of [side[1], side[2]]) timberPost(out, x, z, level);
  const beams = [
    [
      [-16.52, 0, -side[3]],
      [16.52, 0, -side[3]],
    ],
    [
      [-16.52, 0, side[3]],
      [16.52, 0, side[3]],
    ],
    [
      [left[0], 0, -7.38],
      [left[0], 0, 7.38],
    ],
    [
      [left[7], 0, -7.38],
      [left[7], 0, 7.38],
    ],
  ];
  for (const [a, b] of beams)
    for (const [h, w, t, color] of [
      [6.45, 0.48, 0.42, c.woodDark],
      [6.87, 0.37, 0.61, c.timber],
      [7.14, 0.17, 0.58, c.woodLight],
    ])
      rod(out, [a[0], y(h), a[2]], [b[0], y(h), b[2]], w, t, color);
  if (level === 0) return;
  const stores = level === 1 ? left.filter((_, i) => i % 2 === 0) : left;
  for (const x of stores) {
    for (const sign of [-1, 1]) {
      for (const [h, depth, w] of [
        [6.53, 0.51, 0.4],
        [6.81, 0.77, 0.54],
        [7.03, 1.02, 0.64],
      ])
        block(
          out,
          'wood',
          x - w * 0.5,
          y(h),
          sign * side[3] - depth * 0.5,
          w,
          0.16,
          depth,
          c.timber,
        );
      if (level >= 2)
        for (const b of [-0.19, 0.19])
          rod(
            out,
            [x + b, y(6.66), sign * (side[3] + 0.1)],
            [x + b, y(7.04), sign * (side[3] + 1.02)],
            0.13,
            0.14,
          );
    }
  }
}
function screens(out, level) {
  const bottom = y(d.plinthHeight);
  const p = d.outline;
  shell(out, p, () => bottom, y(6.49), {
    wall: 'brick',
    roof: 'wood',
    color: c.masonry,
    roofColor: c.woodDark,
  });
  for (const sign of [-1, 1]) {
    const wall =
      sign === 1
        ? edge([coreWidth, coreDepth], [-coreWidth, coreDepth])
        : edge([-coreWidth, -coreDepth], [coreWidth, -coreDepth]);
    for (let i = 0; i < d.facadeBayCount; i++) {
      const a = (i * wall.length) / d.facadeBayCount,
        b = ((i + 1) * wall.length) / d.facadeBayCount;
      panel(
        out,
        'wood',
        wall,
        a + 0.095,
        b - 0.095,
        y(1.28),
        y(6.12),
        0.039,
        i === 3 ? c.woodDark : c.warm,
      );
      panel(out, 'screen', wall, a + 0.38, b - 0.38, y(3.21), y(5.62), 0.071, c.pane);
      if (level === 0) continue;
      const N = [1, 3, 5, 7][level],
        S = level === 1 ? 3 : 5;
      for (let j = 0; j <= N; j++) {
        const u = mix(a + 0.29, b - 0.28, j / N);
        panel(out, 'wood', wall, u - 0.034, u + 0.034, y(3.04), y(5.76), 0.098, c.woodLight);
      }
      for (let j = 0; j <= S; j++) {
        const h = mix(3.04, 5.76, j / S);
        panel(out, 'wood', wall, a + 0.3, b - 0.29, y(h) - 0.031, y(h) + 0.031, 0.103, c.woodLight);
      }
      for (const h of [1.6, 2.59, 2.83, 5.85])
        panel(out, 'wood', wall, a + 0.25, b - 0.26, y(h) - 0.037, y(h) + 0.037, 0.119, c.timber);
    }
  }
  if (level > 0) {
    const front = edge([coreWidth, coreDepth], [-coreWidth, coreDepth]);
    const u = front.length / 2;
    panel(out, 'wood', front, u - 2.0, u + 2.0, y(5.72), y(6.15), 0.106, c.dark);
    panel(out, 'wood', front, u - 1.88, u + 1.88, y(5.74), y(5.77), 0.114, c.gold);
    if (level > 1)
      for (const f of [-1.09, -0.35, 0.39, 1.16])
        panel(out, 'wood', front, u + f - 0.11, u + f + 0.11, y(5.85), y(6.0), 0.116, c.gold);
  }
}

const rawRoof = [
  [7.1, 17.85, 8.64, 0.44],
  [7.26, 17.57, 8.06, 0.35],
  [7.72, 16.95, 7.18, 0.26],
  [8.47, 16.11, 5.54, 0.19],
  [9.44, 14.71, 3.89, 0.075],
  [10.22, 12.29, 2.36, 0.0],
  [10.72, 11.87, 0.99, 0.0],
  [d.roofHeight, 11.72, 0.16, 0.0],
];
function perimeterRoofRing([h, w, dep, flare], n) {
  const p = [
    [-w, -dep],
    [w, -dep],
    [w, dep],
    [-w, dep],
  ];
  return p.flatMap((a, i) => {
    const b = p[(i + 1) % 4];
    return Array.from({ length: n }, (_, k) => {
      const t = k / n;
      return [
        mix(a[0], b[0], t),
        y(h + flare * Math.pow(Math.abs(2 * t - 1), 3.2)),
        mix(a[1], b[1], t),
      ];
    });
  });
}
function roof(out, level) {
  const rows = [
    [0, 3, 5, 7],
    [0, 2, 4, 5, 7],
    [0, 1, 2, 3, 4, 5, 6, 7],
    [0, 1, 2, 3, 4, 5, 6, 7],
  ][level];
  const turns = [1, 2, 4, 8][level];
  const rings = rows.map((i) => perimeterRoofRing(rawRoof[i], turns));
  for (const [i, ring] of rings.entries()) {
    if (i === rings.length - 1) break;
    const upper = rings[i + 1];
    for (let k = 0; k < ring.length; k++) {
      const j = (k + 1) % ring.length;
      face(
        out,
        'tile',
        [ring[k], ring[j], upper[j], upper[k]],
        [0, 1, 0],
        i === 0 ? c.slate : c.roof,
      );
    }
  }
  for (const [i, p] of rings[0].entries()) {
    const next = rings[0][(i + 1) % rings[0].length];
    face(out, 'wood', [[0, y(7.1), 0], next, p], [0, -1, 0], c.woodDark);
  }
  if (level > 0) {
    for (const sign of [-1, 1]) {
      const ridgeX = sign * 11.76;
      face(
        out,
        'wood',
        [
          [ridgeX, y(10.2), -2.35],
          [ridgeX, y(10.7), -1.0],
          [ridgeX, y(10.8), 0],
          [ridgeX, y(10.7), 1.0],
          [ridgeX, y(10.2), 2.35],
        ],
        [sign, 0, 0],
        c.woodDark,
      );
    }
  }
  if (level > 1) {
    const offsets = [-17.28, 17.28];
    const count = level === 2 ? 28 : 48;
    for (const side of [-1, 1])
      for (let i = 1; i < count; i++) {
        const t = i / count;
        const points = [rawRoof[0], rawRoof[2], rawRoof[4], rawRoof[6], rawRoof[7]].map(
          ([h, w, dep, flare]) => {
            const u = mix(-w, w, t);
            return [u, y(h + flare * Math.pow(Math.abs(2 * t - 1), 3.2) + 0.04), side * dep];
          },
        );
        for (let k = 0; k < points.length - 1; k++)
          beam(
            out,
            'tile',
            points[k],
            points[k + 1],
            0.049,
            0.044,
            i % 4 === 0 ? c.slate : c.ridge,
          );
      }
    if (level === 3)
      for (const end of offsets)
        block(out, 'tile', end - 0.09, y(7.44), -0.04, 0.18, 0.09, 0.08, c.slate);
  }
}
function build(out, level) {
  platform(out, level);
  screens(out, level);
  perimeter(out, level);
  roof(out, level);
}
export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'danbo-jingcheng-hall-model.mjs';
const camera = [68, 37, 78],
  lookAt = [0, 5, 0];
const errors = { district: 0.39, street: 0.14, closeup: 0.055 };
export const danboJingchengHallAsset = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  recipe,
  title: plan.title,
  wikidataId: plan.wikidataId,
  category: 'palace',
  surfaces,
  build: closeup,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'active-geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: 'Original terrain sampled at the palace’s southern courtyard approach.',
  brief:
    'The Danbo Jingcheng audience hall at Chengde Mountain Resort, with unpainted nanmu columns, seven screened bays, stone terrace and a single gray rolled-ridge roof.',
  camera,
  lookAt,
  sunDirection: [38, 67, 82],
  mediumFiContext: {
    scale: 1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  buildingCutout: {
    outline: d.outline,
    minimumCoverage: 0.92,
    basis: 'The original mapped audience hall core.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: ['montreal-museum-pavilion-geometry.mjs', 'polygon-triangulation.mjs'],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-003.PROGRESS.md',
  qaCameras: [
    { name: 'seven-timber-bays-and-stone-approach', position: [22, 9, 37], lookAt: [0, 4.5, 2] },
    { name: 'rolled-gray-tile-roof-and-side-gallery', position: [28, 15, -23], lookAt: [6, 6, -2] },
    { name: 'north-porch-and-nanmu-framing', position: [-21, 8, -34], lookAt: [-2, 4, -4] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'danbo-jingcheng-hall-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.74,
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
    'Original mesh under the project license. © OpenStreetMap contributors. Mapzen open elevation.',
};

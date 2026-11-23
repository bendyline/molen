import { readFileSync } from 'node:fs';
import {
  abox,
  fan,
  gableRoof,
  lathe,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import {
  closed,
  floorSampler,
  mix,
  pairs,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import { tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (id) => JSON.parse(readFileSync(new URL('../' + id + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const survey = floorSampler(read('terrain-grid'));
const outline = frame.geometry.outline;
const mapped = new Map(frame.features.map((feature) => [feature.id, feature.points]));
const minimumGrade = Math.floor(Math.min(...outline.map((point) => survey(point))) - 7);

const brownGrass = rgb('8c8858');
const openGrass = rgb('8a925b');
const hillside = rgb('758253');
const shadyGrass = rgb('646d44');
const clay = rgb('9c7554');
const pathClay = rgb('ad9473');
const granite = rgb('b4b3a7');
const noisyGranite = rgb('93958b');
const dark = rgb('514b3c');
const timber = rgb('605544');
const oldTimber = rgb('777066');
const coolRoof = rgb('68757a');
const pineLeaf = [rgb('485936'), rgb('5f7043'), rgb('667949')];

const surfaces = {
  ground: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.99 },
  stone: { slot: 'wall', graph: 'stone_granite', roughness: 0.94 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.95 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.88 },
  detail: { slot: 'door', localRef: 'palette:#ffffff', roughness: 0.96 },
};

const sides = pairs(closed(outline));
const elevations = [...new Set(outline.map((point) => point[1]))].sort((a, b) => a - b);
function rowExtent(z) {
  const x = [];
  for (const [[left, a], [right, b]] of sides) {
    if (a === z) x.push(left);
    if (Math.min(a, b) < z && z < Math.max(a, b)) x.push(mix(left, right, (z - a) / (b - a)));
  }
  return [Math.min(...x), Math.max(...x)];
}

function terrain(out, detail) {
  const columns = [15, 25, 46, 78][detail];
  const step = [13.8, 7.4, 4.1, 2.2][detail];
  const rowCoordinates = pairs(elevations).flatMap(([a, b]) => {
    const count = Math.ceil((b - a) / step);
    return Array.from({ length: count }, (_, index) => mix(a, b, index / count));
  });
  rowCoordinates.push(elevations.at(-1));
  const rows = rowCoordinates.map((z) => {
    const [a, b] = rowExtent(z);
    return Array.from({ length: columns + 1 }, (_, i) => {
      const x = mix(a, b, i / columns);
      return [x, survey([x, z]), z];
    });
  });
  for (const [a, b] of pairs(rows))
    for (let i = 0; i < columns; i++) {
      const [x, y, z] = a[i];
      const slope = Math.hypot(b[i][1] - y, a[i + 1][1] - y);
      const atSummit =
        ((x + 2) / 13) * ((x + 2) / 13) + ((z - 4) / 11) * ((z - 4) / 11) < 1 && y > -1.2;
      const base = atSummit ? clay : slope > 4.8 ? shadyGrass : y > -14 ? openGrass : hillside;
      const variation =
        0.3 + Math.sin(x * 0.12 + z * 0.11) * 0.15 + Math.sin(x * 0.39 - z * 0.35) * 0.09;
      const shade = base.map((v, axis) => mix(v, brownGrass[axis], variation));
      tri(out, 'ground', a[i], b[i], b[i + 1], shade);
      tri(out, 'ground', a[i], b[i + 1], a[i + 1], shade);
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
    quad4(out, 'ground', a, b, [b[0], minimumGrade, b[2]], [a[0], minimumGrade, a[2]], hillside);
  }
}

function groundPath(out, points, width, detail) {
  const repeat = [14, 6, 3, 1.45][detail];
  for (const [a, b] of pairs(points)) {
    const x = b[0] - a[0],
      z = b[1] - a[1];
    const length = Math.hypot(x, z);
    if (length < 0.16) continue;
    const count = Math.ceil(length / repeat);
    const segment = (i, side) => {
      const p = [
        a[0] + (i / count) * x - ((z / length) * width * side) / 2,
        a[1] + (i / count) * z + ((x / length) * width * side) / 2,
      ];
      return [p[0], survey(p) + (detail < 2 ? 0.33 : 0.17), p[1]];
    };
    for (let i = 0; i < count; i++) {
      const c = segment(i, -1),
        d = segment(i + 1, -1);
      const e = segment(i + 1, 1),
        f = segment(i, 1);
      tri(out, 'ground', c, e, d, pathClay);
      tri(out, 'ground', c, f, e, pathClay);
    }
  }
}

function uprightStone(out, [x, z], h, width, depth, faceColor = granite) {
  const y = survey([x, z]);
  abox(
    out,
    'stone',
    [x - depth / 2 - 0.1, y - 0.34, z - width / 2 - 0.13],
    [x + depth / 2 + 0.1, y + 0.22, z + width / 2 + 0.13],
    noisyGranite,
  );
  abox(
    out,
    'stone',
    [x - depth / 2, y + 0.2, z - width / 2],
    [x + depth / 2, y + h - 0.06, z + width / 2],
    faceColor,
  );
  const slope = Math.min(0.07, width * 0.17);
  const rim = [
    [x - depth / 2, y + h - 0.06, z - width / 2],
    [x + depth / 2, y + h - 0.06, z - width / 2],
    [x + depth / 2, y + h - 0.06, z + width / 2],
    [x - depth / 2, y + h - 0.06, z + width / 2],
  ];
  const cap = [
    [x - depth / 2 + slope, y + h, z - width / 2 + slope],
    [x + depth / 2 - slope, y + h, z - width / 2 + slope],
    [x + depth / 2 - slope, y + h, z + width / 2 - slope],
    [x - depth / 2 + slope, y + h, z + width / 2 - slope],
  ];
  for (let i = 0; i < 4; i++)
    quad4(out, 'stone', rim[i], cap[i], cap[(i + 1) % 4], rim[(i + 1) % 4], faceColor);
  fan(out, 'stone', cap.toReversed(), faceColor);
}

function noticeBoard(out, [x, z], height, width, roofed, detail) {
  const y = survey([x, z]);
  const bottom = height * 0.43;
  for (const side of [-1, 1]) {
    const leg = z + side * width * 0.36;
    abox(
      out,
      'wood',
      [x - 0.09, y - 0.16, leg - 0.06],
      [x + 0.09, y + height - 0.085, leg + 0.06],
      oldTimber,
    );
  }
  abox(
    out,
    'wood',
    [x - 0.09, y + bottom, z - width / 2],
    [x + 0.1, y + height - 0.17, z + width / 2],
    timber,
  );
  if (roofed) {
    gableRoof(
      out,
      'roof',
      [x, z - width * 0.53],
      [x, z + width * 0.53],
      0.58,
      y + height - 0.1,
      y + height + 0.12,
      coolRoof,
      { overhang: 0.1, endSlot: 'wood', endColor: timber },
    );
  }
  if (detail > 1) {
    for (let row = 0; row < 5; row++) {
      const yy = y + height * 0.63 + row * height * 0.047;
      abox(
        out,
        'detail',
        [x + 0.104, yy, z - width * 0.38],
        [x + 0.11, yy + 0.01, z + width * (row % 2 ? 0.38 : 0.27)],
        oldTimber,
      );
    }
  }
}

function pine(out, [x, z, h, lean], detail) {
  const y = survey([x, z]);
  const trunk = [
    [x, y - 0.26, z],
    [x + lean * 0.28, y + h * 0.52, z + 0.23],
    [x + lean * 0.84, y + h * 0.93, z + 0.46],
  ];
  const n = [0, 6, 6, 8][detail];
  tube(out, 'wood', trunk[0], trunk[1], h * 0.029, dark, n);
  tube(out, 'wood', trunk[1], trunk[2], h * 0.022, timber, n);
  const crowns =
    detail > 1
      ? [
          [0, 0.76, 0],
          [0.19, 0.96, -0.09],
          [-0.28, 0.83, 0.18],
          [-0.22, 0.92, -0.14],
          [0.34, 0.78, 0.12],
        ]
      : [
          [0, 0.89, 0],
          [-0.23, 0.8, 0.11],
        ];
  for (const [i, [u, v, w]] of crowns.entries()) {
    const cx = x + h * u + lean * v,
      cz = z + h * w;
    const cy = y + h * v;
    const r = h * (i === 0 ? 0.28 : 0.19);
    if (detail > 1) tube(out, 'wood', trunk[1], [cx, cy, cz], h * 0.009, timber, 4);
    lathe(
      out,
      'ground',
      [cx, cz],
      [
        [cy - r * 0.41, r * 0.54, r * 0.59],
        [cy, r, r * 0.73],
        [cy + r * 0.52, r * 0.61, r * 0.47],
        [cy + r * 0.78, r * 0.08, r * 0.07],
      ],
      n,
      pineLeaf[i % 3],
    );
  }
}

const node = (id) => mapped.get('node/' + id)[0];
const way = (id) => mapped.get('way/' + id);
const isInside = ([x, z]) => {
  if (z < elevations[0] || z > elevations.at(-1)) return false;
  const [left, right] = rowExtent(z);
  return x > left + 1.5 && x < right - 1.5;
};
const paths = [
  [1051236668, 1.93],
  [1051236669, 1.85],
  [1051236688, 1.62],
  [1051236683, 2.08],
  [1051236682, 1.47],
  [1051236680, 1.6],
  [1051236679, 1.5],
  [190211181, 1.7],
];
function pathSteps(out, id, detail) {
  const width = id === 1051236669 ? 1.76 : 1.35;
  for (const [a, b] of pairs(way(id))) {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    const count = Math.ceil(length / (detail === 3 ? 1.08 : 1.55));
    for (let i = 0; i < count; i++) {
      const pos = [mix(a[0], b[0], i / count), mix(a[1], b[1], i / count)];
      const ends = [-1, 1].map((side) => {
        const [x, z] = [
          pos[0] - (side * dz * width) / length / 2,
          pos[1] + (side * dx * width) / length / 2,
        ];
        return [x, survey([x, z]) + 0.24, z];
      });
      tube(out, 'wood', ends[0], ends[1], 0.066, timber, 4);
    }
  }
}

function well(out, detail) {
  const ring = way(1051236685).slice(0, -1);
  const surface = Math.min(...ring.map((point) => survey(point))) + 0.14;
  const water = ring.map(([x, z]) => [x, surface, z]).reverse();
  // The present opening is the documented well, at surveyed grade below the platform.
  const c = water.reduce((sum, p) => sum.map((n, i) => n + p[i] / water.length), [0, 0, 0]);
  for (const [a, b] of pairs(closed(water))) tri(out, 'ground', c, a, b, rgb('555e4a'));
  if (detail > 1) groundPath(out, closed(ring), 0.36, detail);
}

const pines = [
  [-9.1, 7.4, 5.9, -0.7],
  [-10.6, 1.4, 6.5, 0.5],
  [-10.5, -5.4, 6.85, -0.85],
  [-14.8, -8.4, 6.7, 0.74],
  [-16.8, 1.8, 7.4, -0.75],
  [-14.9, 14.5, 6.65, 0.63],
  [-27.6, 18.45, 7.05, 0.7],
  [-38.8, 22.3, 5.52, -0.68],
  [17.85, -7.8, 6.75, -0.84],
];
function build(out, detail) {
  terrain(out, detail);
  uprightStone(out, node(9660417130), 2.22, 0.44, 0.29);
  noticeBoard(out, node(9660417131), 1.67, 1.43, true, detail);
  uprightStone(out, node(9660417134), 0.88, 0.34, 0.29, noisyGranite);
  if (detail > 0) {
    noticeBoard(out, node(9660417135), 1.18, 0.55, false, detail);
    uprightStone(out, node(9660417132), 0.43, 0.26, 0.21, noisyGranite);
    uprightStone(out, node(9660417133), 0.51, 0.37, 0.3, noisyGranite);
    uprightStone(out, node(7339689276), 1.16, 0.43, 0.33);
    uprightStone(out, node(9660417114), 0.75, 0.28, 0.19, noisyGranite);
    uprightStone(out, node(7339767013), 0.77, 0.28, 0.3, noisyGranite);
    uprightStone(out, node(7339767006), 0.77, 0.28, 0.3, noisyGranite);
    for (const [id, width] of paths) {
      const points = way(id);
      if (points.every(isInside)) groundPath(out, points, width, detail);
      else
        for (const segment of pairs(points))
          if (segment.every(isInside)) groundPath(out, segment, width, detail);
    }
    for (const tree of pines.slice(0, detail === 1 ? 4 : pines.length)) pine(out, tree, detail);
    well(out, detail);
  }
  if (detail > 1)
    for (const id of [1051236669, 1051236688, 1051236682, 1051236680]) pathSteps(out, id, detail);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'kasugayama-castle-model.mjs';
const camera = [151, 124, 128];
const lookAt = [8, -22, 0];
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
    'Kasugayama Castle’s engineered hilltop platforms, approach steps, well terrace and preserved summit markers.',
  camera,
  lookAt,
  sunDirection: [50, 62, 52],
  mediumFiContext: {
    scale: 3.1,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline,
    minHeight: minimumGrade,
    basis:
      'Replaces terrain only inside the central ridge outline with the preserved one-metre GSI landform.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
    'structure-mesh.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'summit-and-east-terraced-spur', position: camera, lookAt },
    { name: 'summit-marker-board-and-pines', position: [12.3, 4.7, 7.2], lookAt: [-5, 1.73, 0] },
    { name: 'well-and-southwest-bank', position: [-72, 15, 55], lookAt: [-31, -8.4, 26] },
    { name: 'upper-earthworks-and-stepped-spur', position: [97, 72, -77], lookAt: [11, -16, 10] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'kasugayama-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 4.12,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 2.2, surfaces },
      street: { export: 'street', errorMeters: 0.84, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.24, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original reconstruction based on Soica2001’s creator-released Qualla photograph, GSI DEM1A, Joetsu City records and public OpenStreetMap geometry.',
};

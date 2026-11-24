import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  closed,
  face,
  floorSampler,
  mix,
  pairs,
} from '../../../../../../../../packages/worldgen/scripts/montreal-museum-pavilion-geometry.mjs';
import {
  abox,
  facade,
  fbox,
  gableRoof,
  lathe,
  rgb,
  spire,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';

const read = (name) => JSON.parse(readFileSync(new URL('../' + name + '.json', import.meta.url)));
const plan = read('plan-controls');
const frame = read('map-frame');
const survey = floorSampler(read('terrain-grid'));
const outline = [
  [-64, -113],
  [45, -113],
  [71, -105],
  [105, -67],
  [114, -16],
  [114, 70],
  [107, 112],
  [83, 136],
  [57, 139],
  [-15, 139],
  [-56, 111],
  [-78, 66],
  [-95, 20],
  [-96, -63],
  [-83, -92],
];
const sides = pairs(closed(outline));
const breaks = [...new Set(outline.map((point) => point[1]))].sort((a, b) => a - b);
const turf = rgb('8a905b');
const darkTurf = rgb('7e8050');
const leafLitter = rgb('888067');
const pavers = rgb('aaa493');
const paverShoulder = rgb('8a8475');
const timber = rgb('665242');
const bark = rgb('6a6050');
const brickRed = rgb('844c3f');
const whiteBoard = rgb('d6d5bc');
const signEarth = rgb('877353');
const stone = rgb('a8a18a');
const groundFloor = -4.6;

const surfaces = {
  meadow: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.98 },
  sett: { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.95 },
  plaque: { slot: 'trim', graph: 'metal_painted', roughness: 0.79 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
};

const mapped = (id) => frame.features.find((feature) => feature.id === id).points;
const ramp = [
  ...mapped('way/616763470').toReversed(),
  ...mapped('way/179021467').toReversed().slice(1),
];
const turnout = mapped('way/179021464');
const interior = [[2.63, -26.67], ...mapped('way/1312840511')];

function extent(z) {
  const x = [];
  for (const [[ax, az], [bx, bz]] of sides) {
    if (az === z) x.push(ax);
    if (Math.min(az, bz) < z && Math.max(az, bz) > z) {
      x.push(mix(ax, bx, (z - az) / (bz - az)));
    }
  }
  return [Math.min(...x), Math.max(...x)];
}

function gradeRows(step, columns) {
  const levels = pairs(breaks).flatMap(([a, b]) => {
    const count = Math.ceil((b - a) / step);
    return Array.from({ length: count }, (_, index) => mix(a, b, index / count));
  });
  levels.push(breaks.at(-1));
  return levels.map((z) => {
    const [left, right] = extent(z);
    return Array.from({ length: columns + 1 }, (_, index) => {
      const x = mix(left, right, index / columns);
      return [x, survey([x, z]), z];
    });
  });
}

function appearance(points) {
  const [x, y, z] = points.reduce(
    (sum, point) => point.map((coordinate, axis) => sum[axis] + coordinate / 3),
    [0, 0, 0],
  );
  const gradient =
    Math.hypot(survey([x + 1, z]) - survey([x - 1, z]), survey([x, z + 1]) - survey([x, z - 1])) /
    2;
  const slope = Math.min(1, Math.max(0, (gradient - 0.16) / 0.42));
  const variation =
    0.5 + 0.24 * Math.sin(x * 0.16 + z * 0.21) + 0.18 * Math.sin(x * 0.37 - z * 0.13);
  const bank = y > 2.75 ? darkTurf : turf;
  return bank.map((channel, axis) =>
    mix(channel * mix(0.96, 1.04, variation), leafLitter[axis], slope),
  );
}

function sculpt(out, rows, columns) {
  for (const [a, b] of pairs(rows)) {
    for (let i = 0; i < columns; i++) {
      const first = [a[i], b[i], b[i + 1]];
      const second = [a[i], b[i + 1], a[i + 1]];
      face(out, 'meadow', first, [0, 1, 0], appearance(first));
      face(out, 'meadow', second, [0, 1, 0], appearance(second));
    }
  }
  const boundary = [
    ...rows[0],
    ...rows.slice(1).map((row) => row.at(-1)),
    ...rows.at(-1).slice(0, -1).toReversed(),
    ...rows
      .slice(1, -1)
      .toReversed()
      .map((row) => row[0]),
  ];
  for (const [a, b] of pairs(closed(boundary))) {
    face(
      out,
      'meadow',
      [a, b, [b[0], groundFloor, b[2]], [a[0], groundFloor, a[2]]],
      [b[2] - a[2], 0, a[0] - b[0]],
      leafLitter,
    );
  }
}

// Cross-section interpolation uses the very same triangle diagonal drawn at this detail level.
function modelGrade(rows, columns, [x, z]) {
  const j = rows.findIndex((row) => row[0][2] > z);
  if (j < 1) return survey([x, z]);
  const [a, b] = [rows[j - 1], rows[j]];
  const t = (z - a[0][2]) / (b[0][2] - a[0][2]);
  const left = mix(a[0][0], b[0][0], t);
  const right = mix(a[columns][0], b[columns][0], t);
  const i = Math.min(columns - 1, Math.max(0, Math.floor((columns * (x - left)) / (right - left))));
  const x0 = mix(a[i][0], b[i][0], t);
  const x1 = mix(a[i + 1][0], b[i + 1][0], t);
  const cross = mix(a[i][0], b[i + 1][0], t);
  const mid = mix(a[i][1], b[i + 1][1], t);
  if (x <= x0) return mix(a[i][1], b[i][1], t);
  if (x >= x1) return mix(a[i + 1][1], b[i + 1][1], t);
  return x < cross
    ? mix(mix(a[i][1], b[i][1], t), mid, (x - x0) / (cross - x0))
    : mix(mid, mix(a[i + 1][1], b[i + 1][1], t), (x - cross) / (x1 - cross));
}

function trail(out, grade, path, width, detail, surface, color, edgeColor) {
  const points = pairs(path).flatMap(([[x, z], [endX, endZ]]) => {
    const segments = Math.ceil(Math.hypot(endX - x, endZ - z) / [17, 5, 2.1, 1.45][detail]);
    return Array.from({ length: segments }, (_, i) => [
      mix(x, endX, i / segments),
      mix(z, endZ, i / segments),
    ]);
  });
  points.push(path.at(-1));
  const rows = points.map(([x, z], i) => {
    const a = points[Math.max(i - 1, 0)];
    const b = points[Math.min(i + 1, points.length - 1)];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    return [-0.5, -0.41, 0.41, 0.5].map((d) => {
      const px = x - (width * d * dz) / length;
      const pz = z + (width * d * dx) / length;
      return [px, grade([px, pz]) + (detail === 3 ? 0.1 : 0.16), pz];
    });
  });
  for (const [a, b] of pairs(rows)) {
    for (let i = 0; i < 3; i++) {
      const tint = i === 1 ? color : edgeColor;
      face(out, surface, [a[i], b[i], b[i + 1]], [0, 1, 0], tint);
      face(out, surface, [a[i], b[i + 1], a[i + 1]], [0, 1, 0], tint);
    }
  }
}

function furnishings(out, grade, detail) {
  const point = [-19.5, -92.6];
  const y = grade(point);
  const front = facade(point, [-0.94, -0.34]);
  for (const post of [-0.71, 0.71]) {
    fbox(
      out,
      'timber',
      front,
      post - 0.053,
      post + 0.053,
      y - 0.18,
      y + 2.02,
      -0.068,
      0.068,
      timber,
    );
  }
  fbox(out, 'timber', front, -0.75, 0.75, y + 0.75, y + 1.95, -0.09, 0.09, timber);
  fbox(out, 'plaque', front, -0.635, 0.635, y + 0.89, y + 1.82, 0.093, 0.107, whiteBoard);
  const a = front.P(-0.8, y, 0);
  const b = front.P(0.8, y, 0);
  gableRoof(out, 'tile', [a[0], a[2]], [b[0], b[2]], 0.49, y + 1.99, y + 2.14, brickRed, {
    overhang: 0.1,
  });
  if (detail >= 2) {
    fbox(out, 'plaque', front, -0.23, 0.24, y + 1.42, y + 1.68, 0.108, 0.112, signEarth);
    for (let i = 0; i < 4; i++) {
      const line = y + 1.02 + 0.082 * i;
      fbox(out, 'plaque', front, -0.465, 0.455 - i * 0.06, line, line + 0.018, 0.108, 0.112, stone);
    }
  }
  const bench = [-15.8, -91.5];
  const seat = facade(bench, [-0.94, -0.34]);
  const bottom = grade(bench);
  for (const leg of [-0.65, 0.65]) {
    fbox(
      out,
      'timber',
      seat,
      leg - 0.055,
      leg + 0.055,
      bottom - 0.15,
      bottom + 0.43,
      -0.22,
      0.22,
      timber,
    );
  }
  fbox(out, 'timber', seat, -0.8, 0.8, bottom + 0.42, bottom + 0.49, -0.25, 0.21, timber);
  for (const h of [0.54, 0.7]) {
    fbox(out, 'timber', seat, -0.8, 0.8, bottom + h, bottom + h + 0.13, -0.25, -0.18, timber);
  }
  const marker = mapped('node/1893719624')[0];
  const height = grade(marker);
  const [x, z] = marker;
  abox(
    out,
    'plaque',
    [x - 0.48, height - 0.2, z - 0.33],
    [x + 0.48, height + 0.4, z + 0.33],
    stone,
  );
}

const grove = [
  [-46, -76, 13],
  [-36, -67, 11],
  [-29, -62, 16],
  [-54, -63, 12],
  [-59, -46, 14],
  [-65, -27, 10],
  [-62, -14, 13],
  [-51, 2, 12],
  [-54, 22, 15],
  [-48, 39, 13],
  [-37, 52, 15],
  [-27, 65, 14],
  [-23, 88, 12],
  [1, 104, 15],
  [23, 114, 12],
  [46, 112, 14],
  [63, 109, 13],
  [77, 97, 12],
  [85, 77, 15],
  [87, 53, 12],
  [83, 31, 14],
  [80, 5, 15],
  [77, -14, 12],
  [70, -36, 15],
  [60, -61, 14],
  [49, -78, 13],
  [30, -82, 15],
  [18, -80, 12],
  [0, -74, 14],
  [-4, -67, 12],
];
function trees(out, grade, detail) {
  const spacing = detail >= 2 ? 1 : 2;
  for (let i = 0; i < grove.length; i += spacing) {
    const [x, z, size] = grove[i];
    const y = grade([x, z]);
    const lean = Math.sin(i * 1.77) * 0.85;
    const trunk = (h) => [x + lean * h, y + h * size, z + 0.24 * h];
    lathe(
      out,
      'timber',
      [x, z],
      [
        [y - 0.23, 0.36, 0.33],
        [y + size * 0.29, 0.23, 0.22],
        [y + size * 0.58, 0.14, 0.13],
      ],
      detail === 1 ? 4 : 6,
      bark,
    );
    beam(out, 'timber', [x, y + size * 0.52, z], trunk(0.86), 0.22, 0.22, bark);
    const branches = detail === 1 ? 3 : detail === 2 ? 5 : 7;
    for (let b = 0; b < branches; b++) {
      const angle = i * 1.72 + b * 2.39;
      const startHeight = 0.44 + b * 0.045;
      const start = trunk(startHeight);
      const radial = size * (0.265 - b * 0.018);
      const end = [
        start[0] + radial * Math.cos(angle),
        start[1] + size * 0.27,
        start[2] + radial * Math.sin(angle),
      ];
      beam(out, 'timber', start, end, 0.11, 0.1, bark);
      if (detail >= 2) {
        const fork = start.map((p, axis) => mix(p, end[axis], 0.7));
        const twig = [
          end[0] + Math.sin(angle) * 0.95,
          end[1] + 0.92,
          end[2] - Math.cos(angle) * 0.95,
        ];
        beam(out, 'timber', fork, twig, 0.061, 0.062, bark);
      }
      if (detail === 3) {
        const tip = [
          end[0] + Math.cos(angle) * 0.36,
          end[1] + 1.15,
          end[2] + Math.sin(angle) * 0.38,
        ];
        beam(out, 'timber', end, tip, 0.048, 0.047, bark);
      }
    }
    if (detail >= 2) {
      const crown = trunk(0.82);
      spire(out, 'timber', [crown[0], crown[2]], 0.096, 5, crown[1], size * 0.135, bark);
    }
  }
}

function build(out, detail) {
  const columns = [14, 25, 51, 99][detail];
  const rows = gradeRows([18.5, 12.5, 5.8, 2.4][detail], columns);
  const grade = (point) => modelGrade(rows, columns, point);
  sculpt(out, rows, columns);
  trail(out, grade, ramp, 3.08, detail, 'sett', pavers, paverShoulder);
  if (detail >= 1) {
    trail(out, grade, turnout, 3.35, detail, 'sett', pavers, paverShoulder);
    trail(out, grade, interior, 1.32, detail, 'meadow', leafLitter, darkTurf);
    furnishings(out, grade, detail);
  }
  if (detail >= 2) {
    trail(out, grade, mapped('way/92226134'), 1.15, detail, 'meadow', leafLitter, darkTurf);
    trail(out, grade, mapped('way/616763471'), 1.15, detail, 'meadow', leafLitter, darkTurf);
    trail(out, grade, mapped('way/92226132'), 1.02, detail, 'meadow', darkTurf, turf);
  }
  if (detail >= 1) trees(out, grade, detail);
}

export const skyline = (out) => build(out, 0);
export const district = (out) => build(out, 1);
export const street = (out) => build(out, 2);
export const closeup = (out) => build(out, 3);

const recipe = 'mecklenburg-castle-model.mjs';
const camera = [-188, 144, -202];
const lookAt = [6, 1.6, 13];
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
  brief: 'The surviving oval Burg Mecklenburg bank and ditch with the present northern entrance.',
  camera,
  lookAt,
  sunDirection: [-39, 56, -55],
  mediumFiContext: {
    scale: 2.75,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  groundCutout: {
    outline,
    minHeight: groundFloor,
    basis:
      'The outline replaces the general terrain only over the surveyed earthwork and its immediate apron.',
  },
  embeddedCanonicalGraphs: Object.values(surfaces).flatMap(({ graph }) => graph ?? []),
  recipeDependencies: [
    'place-recipe-kit.mjs',
    'montreal-museum-pavilion-geometry.mjs',
    'authored-structure-mesh.mjs',
    'polygon-triangulation.mjs',
  ],
  sourceDocuments: plan.requiredSourceDocuments,
  progressLedger: 'qualla-004.PROGRESS.md',
  qaCameras: [
    { name: 'surveyed-oval-bank-and-ditch', position: camera, lookAt },
    { name: 'paved-north-ramp-and-board', position: [-41, 4.5, -119], lookAt: [-12, 4, -69] },
    { name: 'western-scarp-and-interior', position: [-115, 30, 34], lookAt: [2, 4, 21] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'mecklenburg-castle-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: 'content/worldgen/source/places/' + plan.cell + '/' + plan.model + '/models/' + recipe,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 3.5,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 2.25, surfaces },
      street: { export: 'street', errorMeters: 0.88, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.26, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original model from O.Mustafin’s CC0 Qualla photographs, OpenStreetMap controls under ODbL, and bare-earth relief from © GeoBasis-DE/M-V 2026 (CC BY 4.0).',
};

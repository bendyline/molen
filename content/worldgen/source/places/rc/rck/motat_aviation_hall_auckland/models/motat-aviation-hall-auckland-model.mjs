import { readFileSync } from 'node:fs';
import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box, quad } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const plan = JSON.parse(readFileSync(new URL('../plan-controls.json', import.meta.url)));
const { main, entranceWing: wing, hangarOpening } = plan.dimensions;
const surfaces = {
  cladding: { slot: 'wall', graph: 'metal_corrugated', roughness: 0.68, metallic: 0.32 },
  roofing: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.61, metallic: 0.38 },
  plinth: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.95 },
  glazing: {
    slot: 'window',
    localRef: 'palette:#edf7ff',
    roughness: 0.27,
    metallic: 0.12,
    baseColorFactor: [1, 1, 1, 0.74],
    alphaMode: 'BLEND',
    doubleSided: true,
  },
  trim: { slot: 'trim', localRef: 'palette:#ffffff', roughness: 0.7, metallic: 0.12 },
};
const c = {
  silver: rgb('aeb0af'),
  bay: rgb('8b8b86'),
  wall: rgb('777a75'),
  roof: rgb('656d6d'),
  shadow: rgb('414748'),
  rail: rgb('858f90'),
  paleRail: rgb('b3bdba'),
  louver: rgb('4c5357'),
  concrete: rgb('86877f'),
  glazing: rgb('9dacac'),
  door: rgb('39768f'),
  blue: rgb('1387b9'),
  veneer: rgb('857365'),
  timber: rgb('bd9464'),
  lettering: rgb('eeeee8'),
};
const ref = 'palette:#ffffff';
const lerp = (a, b, f) => a + (b - a) * f;

// Coordinates run from the north wall to the south wall in each roof section.
const hallSection = [
  [0, 11.8],
  [0.035, 12.23],
  [0.445, 12.56],
  [0.457, 12.65],
  [0.474, 13.58],
  [0.5, 13.78],
  [0.527, 13.49],
  [0.544, 12.52],
  [0.95, 9.43],
  [0.982, 9.09],
  [1, 8.67],
];
const wingSection = [
  [0, 7.95],
  [0.012, 9.08],
  [0.043, 9.62],
  [0.4, 11.28],
  [0.427, 11.52],
  [0.444, 12.2],
  [0.472, 12.45],
  [0.497, 12.22],
  [0.516, 11.55],
  [0.935, 12.05],
  [0.971, 11.89],
  [0.991, 11.56],
  [1, 10.61],
];

function face(out, slot, p, color) {
  quad(out, slot, p, normalFor(...p), color);
}

function profile(volume, section, detail) {
  const [z0, z1] = volume.footprint[1];
  return section
    .filter(([u]) => detail > 0 || ![0.012, 0.035, 0.427, 0.457, 0.971, 0.982, 0.991].includes(u))
    .map(([u, y]) => [lerp(z0, z1, u), volume.floor + y]);
}

function elevationX(out, slot, x, z0, z1, y0, y1, color, direction = 1) {
  const corners = [
    [x, y0, z0],
    [x, y0, z1],
    [x, y1, z1],
    [x, y1, z0],
  ];
  face(out, slot, direction === 1 ? corners.reverse() : corners, color);
}

function roofShell(out, [x0, x1], points, color) {
  const skirt = 0.31;
  for (let i = 1; i < points.length; i++) {
    const [[z0, y0], [z1, y1]] = points.slice(i - 1, i + 1);
    const top = [
      [x0, y0, z0],
      [x0, y1, z1],
      [x1, y1, z1],
      [x1, y0, z0],
    ];
    const bottom = top.map(([x, y, z]) => [x, y - skirt, z]);
    face(out, 'roofing', top, color);
    face(out, 'trim', bottom.toReversed(), c.shadow);
    face(out, 'trim', [top[0], bottom[0], bottom[1], top[1]], c.shadow);
    face(out, 'trim', [top[3], top[2], bottom[2], bottom[3]], c.shadow);
  }
  for (const [[z, y], sign] of [
    [points[0], -1],
    [points.at(-1), 1],
  ]) {
    const edge = [
      [x0, y - skirt, z],
      [x1, y - skirt, z],
      [x1, y, z],
      [x0, y, z],
    ];
    face(out, 'trim', sign < 0 ? edge.reverse() : edge, c.shadow);
  }
}

function sectionWall(out, x, low, points, direction, tintFor) {
  for (let i = 1; i < points.length; i++) {
    const [[z0, y0], [z1, y1]] = points.slice(i - 1, i + 1);
    const corners = [
      [x, low, z0],
      [x, low, z1],
      [x, y1 - 0.2, z1],
      [x, y0 - 0.2, z0],
    ];
    face(out, 'cladding', direction > 0 ? corners.reverse() : corners, tintFor((z0 + z1) / 2));
  }
}

function northGallery(out, [x0, x1], z, floor, upper, detail) {
  const from = x0 + 0.62,
    to = x1 - 0.62;
  const low = floor + 1.09;
  const high = upper - 0.64;
  box(out, 'trim', [x0, floor, z], [x1, low, z + 0.65], c.rail);
  box(out, 'trim', [x0, high, z], [x1, upper - 0.17, z + 0.7], c.rail);
  box(out, 'trim', [x0, low, z + 2.8], [x1, high, z + 2.95], c.veneer);
  const uprights = [9, 19, 35, 45][detail];
  const spans = detail === 0 ? 3 : 9;
  for (let i = 0; i < spans; i++) {
    const a = lerp(from, to, i / spans),
      b = lerp(from, to, (i + 1) / spans);
    const colors = [c.glazing, rgb('adb9b7'), rgb('acb5b1')];
    face(
      out,
      'glazing',
      [
        [b, low, z],
        [a, low, z],
        [a, high, z],
        [b, high, z],
      ],
      colors[i % colors.length],
    );
    if (detail > 0) {
      const mid = (a + b) / 2;
      const timberFace = z + 1.15;
      beam(
        out,
        'trim',
        [mid, floor + 1.2, timberFace],
        [mid, high, timberFace],
        0.32,
        0.5,
        c.timber,
      );
      beam(
        out,
        'trim',
        [mid - 0.8, floor + 1.35, timberFace],
        [mid + 1.22, high - 0.3, timberFace],
        0.22,
        0.28,
        c.timber,
      );
    }
  }
  const rails = detail >= 2 ? [0, 0.06, 0.22, 0.4, 0.59, 0.78, 0.94, 1] : [0, 0.22, 0.59, 0.94, 1];
  for (const f of rails) {
    const y = lerp(low, high, f);
    box(out, 'trim', [from, y - 0.029, z - 0.07], [to, y + 0.029, z + 0.08], c.paleRail);
  }
  for (let i = 0; i <= uprights; i++) {
    const x = lerp(from, to, i / uprights),
      sw = i % 4 === 0 ? 0.09 : 0.045;
    box(out, 'trim', [x - sw, low, z - 0.08], [x + sw, high, z + 0.08], c.paleRail);
    if (detail > 0 && i < uprights) {
      const vent = lerp(from, to, (i + 0.5) / uprights);
      const gap = ((to - from) / uprights) * 0.35;
      face(
        out,
        'trim',
        [
          [vent + gap, floor + 0.33, z - 0.01],
          [vent - gap, floor + 0.33, z - 0.01],
          [vent - gap, floor + 0.7, z - 0.01],
          [vent + gap, floor + 0.7, z - 0.01],
        ],
        c.louver,
      );
    }
  }
  for (const x of [x0, x1 - 0.56])
    box(out, 'cladding', [x, low, z], [x + 0.56, upper - 0.22, z + 0.6], c.bay);
}

function mainHall(out, detail) {
  const [[x0, x1], [z0, z1]] = main.footprint;
  const roof = profile(main, hallSection, detail);
  const floor = main.floor;
  box(out, 'plinth', [x0, main.base, z0], [x1, floor, z1], c.concrete);
  northGallery(out, [x0, x1], z0 + 0.48, floor, floor + main.northGalleryApproximateHeight, detail);
  box(out, 'cladding', [x0, floor, z1 - 0.46], [x1, roof.at(-1)[1] - 0.19, z1], c.wall);
  sectionWall(out, x0, floor, roof, -1, () => c.wall);
  sectionWall(out, x1, floor, roof, 1, () => c.bay);
  roofShell(out, [x0 - 0.08, x1 + 0.08], roof, c.roof);
  const serviceZ = 0.5 * (z0 + z1),
    doorWidth = hangarOpening.width;
  elevationX(
    out,
    'trim',
    x0 - 0.02,
    serviceZ - doorWidth / 2,
    serviceZ + doorWidth / 2,
    floor + 0.03,
    floor + hangarOpening.height,
    c.louver,
    -1,
  );
  if (detail > 0) {
    const ribs = detail >= 2 ? 10 : 5;
    for (let i = 0; i <= ribs; i++) {
      const z = lerp(serviceZ - doorWidth / 2, serviceZ + doorWidth / 2, i / ribs);
      box(
        out,
        'trim',
        [x0 - 0.1, floor + 0.08, z - 0.045],
        [x0 - 0.02, floor + hangarOpening.height, z + 0.045],
        c.rail,
      );
    }
    for (const f of [0.16, 0.62, 0.93]) {
      const x = lerp(x0, x1, f);
      face(
        out,
        'trim',
        [
          [x - 0.75, floor, z1 + 0.014],
          [x + 0.75, floor, z1 + 0.014],
          [x + 0.75, floor + 2.32, z1 + 0.014],
          [x - 0.75, floor + 2.32, z1 + 0.014],
        ],
        c.shadow,
      );
    }
  }
}

const word = ['M', 'O', 'T', 'A', 'T'];
const patterns = {
  M: ['10001', '11011', '10101', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  T: ['11111', '00100', '00100', '00100', '00100'],
  A: ['01110', '10001', '11111', '10001', '10001'],
};
function sign(out, x, z, y, detail) {
  const colors = ['1689a3', '8e5096', '87a533', 'c95c44', 'c7a842'].map(rgb);
  for (const [i, letter] of word.entries()) {
    const center = z + (2 - i) * 1.14;
    const ring = [
      [0.55, 0],
      [0.28, 0.46],
      [-0.28, 0.46],
      [-0.55, 0],
      [-0.28, -0.46],
      [0.28, -0.46],
    ].map(([ds, dy]) => [x, y + dy, center + ds]);
    out.addConvexPolygon('trim', ref, ring, [1, 0, 0], (p) => [p[1], p[2]], colors[i]);
    if (detail < 2) continue;
    for (const [row, pattern] of patterns[letter].entries()) {
      for (const [column, pixel] of [...pattern].entries()) {
        if (pixel === '0') continue;
        const low = y + (1.5 - row) * 0.118;
        const left = center + (1.5 - column) * 0.119;
        elevationX(out, 'trim', x + 0.014, left, left + 0.119, low, low + 0.118, c.lettering);
      }
    }
  }
}

function entrance(out, detail) {
  const [[x0, x1], [z0, z1]] = wing.footprint;
  const roof = profile(wing, wingSection, detail);
  const floor = wing.floor;
  const signCenter = z0 + 0.58 * (z1 - z0);
  const band0 = signCenter - 3.26,
    band1 = signCenter + 3.26;
  const plinthTop = floor + 3.15;
  box(out, 'plinth', [x0, wing.base, z0], [x1, floor, z1], c.concrete);
  box(out, 'cladding', [x0, floor, z0], [x1, roof[0][1] - 0.19, z0 + 0.32], c.bay);
  box(out, 'cladding', [x0, floor, z1 - 0.32], [x1, roof.at(-1)[1] - 0.19, z1], c.wall);
  sectionWall(out, x0, floor, roof, -1, () => c.bay);
  const split = roof.slice();
  for (const z of [band0, band1]) {
    const i = split.findIndex(([edge]) => edge > z);
    const [[a, ya], [b, yb]] = split.slice(i - 1, i + 1);
    split.splice(i, 0, [z, lerp(ya, yb, (z - a) / (b - a))]);
  }
  sectionWall(out, x1, plinthTop, split, 1, (z) =>
    z >= band0 && z <= band1 ? c.shadow : c.silver,
  );
  roofShell(out, [x0 - 0.05, x1 + 0.16], roof, c.roof);
  for (const [a, b] of [
    [z0, band0],
    [band1, z1],
  ]) {
    box(out, 'trim', [x1 - 0.19, floor, a], [x1 + 0.025, plinthTop, b], c.louver);
    const ribs = detail < 2 ? 4 : 13;
    for (let i = 1; i <= ribs; i++) {
      const y = floor + (i * (plinthTop - floor)) / (ribs + 1);
      face(
        out,
        'trim',
        [
          [x1 + 0.05, y, a],
          [x1 + 0.05, y + 0.045, a],
          [x1 + 0.05, y + 0.045, b],
          [x1 + 0.05, y, b],
        ],
        c.rail,
      );
    }
    if (detail > 0) {
      const side = a === z0 ? 1 : -1;
      const center = side > 0 ? b - 2.94 : a + 2.95;
      elevationX(
        out,
        'trim',
        x1 + 0.061,
        center - 2.3,
        center + 2.3,
        floor + 1.1,
        floor + 2.3,
        c.bay,
      );
      for (const d of [-1.52, 0, 1.52])
        box(
          out,
          'trim',
          [x1 + 0.06, floor + 1.1, center + d - 0.026],
          [x1 + 0.093, floor + 2.32, center + d + 0.026],
          c.louver,
        );
    }
  }
  box(out, 'trim', [x1 - 0.25, floor, band0], [x1 + 0.01, plinthTop, band1], c.door);
  elevationX(
    out,
    'glazing',
    x1 + 0.027,
    band0 + 0.12,
    band1 - 0.12,
    floor + 0.72,
    plinthTop - 0.12,
    c.glazing,
  );
  elevationX(
    out,
    'trim',
    x1 + 0.047,
    band0 + 0.07,
    band1 - 0.07,
    floor + 0.08,
    floor + 0.72,
    c.blue,
  );
  for (const z of [band0, signCenter, band1])
    box(
      out,
      'trim',
      [x1 + 0.022, floor + 0.025, z - 0.027],
      [x1 + 0.074, plinthTop, z + 0.027],
      c.shadow,
    );
  sign(out, x1 + 0.041, signCenter, floor + 5.5, detail);
  box(
    out,
    'plinth',
    [x1 - 0.31, -0.53, band0 - 0.82],
    [x1 + 1.67, floor - 0.035, band1 + 0.82],
    c.concrete,
  );
  if (detail === 3) {
    for (const z of [band0 - 0.51, band0 + 0.15, band1 - 0.15, band1 + 0.51])
      beam(
        out,
        'trim',
        [x1 + 1.0, floor - 0.034, z],
        [x1 + 1.0, floor + 0.78, z],
        0.094,
        0.094,
        c.paleRail,
      );
  }
}

function draw(out, detail) {
  mainHall(out, detail);
  entrance(out, detail);
}

export const skyline = (out) => draw(out, 0);
export const district = (out) => draw(out, 1);
export const street = (out) => draw(out, 2);
export const closeup = (out) => draw(out, 3);
const id = plan.model;
const slug = id.replaceAll('_', '-');
const camera = [146, 52, -104];
const lookAt = [26, 4, 0];
export const model = {
  id,
  key: id,
  title: plan.title,
  cell: plan.cell,
  recipe: slug + '-model.mjs',
  surfaces,
  build: closeup,
  category: 'landmark',
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'geographic-preview',
  orientationPolicy: 'mapped-footprint',
  groundContactBasis: plan.floorBasis,
  progressLedger: 'qualla-003.PROGRESS.md',
  brief: plan.sectionBasis,
  camera,
  lookAt,
  sunDirection: [76, 110, -65],
  recipeDependencies: ['generate-motat-building.mjs'],
  embeddedCanonicalGraphs: ['metal_corrugated', 'metal_standing_seam', 'concrete_plain'],
  mediumFiContext: {
    scale: 1,
    cameraYaw: 0.9,
    groundY: 0,
    focus: { center: lookAt },
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    { name: 'north-gallery-and-roof', position: [-68, 14, -87], lookAt: [3, 4, -21] },
    { name: 'east-entrance-and-fold', position: [132, 11, -10], lookAt: [84, 5, 4] },
    { name: 'service-wall-and-connection', position: [-70, 23, 73], lookAt: [14, 3, 2] },
    { name: 'gallery-panels-and-porch', position: [39, 6, -58], lookAt: [11, 5, -26] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: slug + '-' + reviewLod,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${id}/models/${slug}-model.mjs`,
    level: 'skyline',
    export: 'skyline',
    errorMeters: 0.65,
    surfaces,
    authoredLevels: {
      district: { export: 'district', errorMeters: 0.31, surfaces },
      street: { export: 'street', errorMeters: 0.18, surfaces },
      closeup: { export: 'closeup', errorMeters: 0.075, surfaces },
    },
  },
  limitations: plan.limitations,
  sourceDocuments: plan.requiredSourceDocuments,
  sourceLicense:
    'Original exterior geometry based on two verified CC0 Qualla photographs, open geographic data and the architect’s description.',
};

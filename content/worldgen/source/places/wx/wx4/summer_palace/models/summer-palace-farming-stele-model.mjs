import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { courtRoof, face, frame, levels, rectangle } from './summer-palace-model.mjs';

export const forms = new Set(['farming-stele']);
export const surfaces = {
  paving: { slot: 'foundation', graph: 'stone_ashlar' },
  stone: { slot: 'trim', graph: 'stone_limestone_weathered' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  iron: { slot: 'trim', graph: 'metal_painted' },
};

const slate = [0.203, 0.243, 0.255];
const burgundy = [0.282, 0.083, 0.051];
const green = [0.102, 0.284, 0.258];
const ash = [0.515, 0.495, 0.444];
const light = [0.665, 0.65, 0.599];
const inscription = [0.374, 0.354, 0.297];

// Exterior lettering follows the large calligraphy visible in the south-face photos.
const title = [
  [
    [
      [0.05, 0.67],
      [0.43, 0.73],
    ],
    [
      [0.06, 0.48],
      [0.44, 0.54],
    ],
    [
      [0.02, 0.28],
      [0.45, 0.37],
    ],
    [
      [0.22, 0.91],
      [0.28, 0.78],
      [0.27, 0.19],
      [0.21, 0.09],
    ],
    [
      [0.26, 0.47],
      [0.15, 0.24],
      [0.04, 0.12],
    ],
    [
      [0.29, 0.43],
      [0.4, 0.33],
      [0.43, 0.23],
    ],
    [
      [0.49, 0.67],
      [0.93, 0.78],
    ],
    [
      [0.45, 0.41],
      [0.96, 0.48],
    ],
    [
      [0.57, 0.81],
      [0.65, 0.86],
      [0.62, 0.44],
      [0.55, 0.2],
      [0.45, 0.1],
    ],
    [
      [0.8, 0.96],
      [0.87, 0.9],
      [0.84, 0.12],
    ],
  ],
  [
    [
      [0.26, 0.92],
      [0.17, 0.73],
      [0.08, 0.59],
      [0.26, 0.61],
    ],
    [
      [0.33, 0.76],
      [0.25, 0.56],
      [0.07, 0.34],
      [0.34, 0.43],
    ],
    [
      [0.31, 0.49],
      [0.39, 0.32],
    ],
    [
      [0.13, 0.28],
      [0.05, 0.1],
    ],
    [
      [0.23, 0.32],
      [0.25, 0.12],
    ],
    [
      [0.34, 0.29],
      [0.39, 0.18],
    ],
    [
      [0.54, 0.94],
      [0.61, 0.8],
    ],
    [
      [0.44, 0.72],
      [0.75, 0.77],
    ],
    [
      [0.5, 0.69],
      [0.53, 0.61],
    ],
    [
      [0.66, 0.72],
      [0.61, 0.58],
    ],
    [
      [0.44, 0.52],
      [0.93, 0.58],
    ],
    [
      [0.48, 0.43],
      [0.49, 0.17],
      [0.67, 0.21],
      [0.67, 0.45],
      [0.48, 0.43],
    ],
    [
      [0.5, 0.3],
      [0.66, 0.34],
    ],
    [
      [0.77, 0.94],
      [0.79, 0.59],
      [0.85, 0.27],
      [0.94, 0.11],
      [0.97, 0.27],
    ],
    [
      [0.9, 0.43],
      [0.86, 0.28],
      [0.71, 0.12],
    ],
    [
      [0.86, 0.85],
      [0.93, 0.78],
    ],
  ],
  [
    [
      [0.14, 0.83],
      [0.14, 0.19],
      [0.1, 0.09],
    ],
    [
      [0.14, 0.87],
      [0.75, 0.92],
      [0.88, 0.86],
      [0.85, 0.12],
      [0.8, 0.09],
    ],
    [
      [0.15, 0.12],
      [0.81, 0.15],
    ],
    [
      [0.36, 0.74],
      [0.67, 0.77],
      [0.68, 0.57],
      [0.37, 0.55],
      [0.36, 0.74],
    ],
    [
      [0.28, 0.51],
      [0.71, 0.55],
    ],
    [
      [0.33, 0.44],
      [0.34, 0.24],
      [0.67, 0.25],
      [0.69, 0.45],
      [0.33, 0.44],
    ],
    [
      [0.42, 0.39],
      [0.56, 0.41],
      [0.56, 0.31],
      [0.43, 0.3],
      [0.42, 0.39],
    ],
  ],
];

function lettering(out, y) {
  const height = 0.358;
  const width = 0.303;
  for (const [i, glyph] of title.entries()) {
    const bottom = y + 1.26 - i * 0.512;
    for (const stroke of glyph) {
      const points = stroke.map(([x, y]) => [(x - 0.5) * width, bottom + y * height, 0.351]);
      for (let j = 1; j < points.length; j++) {
        const a = points[j - 1];
        const b = points[j];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const ratio = 0.006 / Math.hypot(dx, dy);
        const offset = [-dy * ratio, dx * ratio];
        const tip = (p, s) => [p[0] + offset[0] * s, p[1] + offset[1] * s, p[2]];
        face(
          out,
          'stone',
          [tip(a, 1), tip(b, 0.66), tip(b, -0.66), tip(a, -1)],
          inscription,
          [0, 0, 1],
        );
      }
    }
  }
}

function monument(out, detail) {
  const seat = 0.9;
  const radius = 0.5;
  const rise = 1.94;
  const crown = rise - radius;
  const steps = [5, 8, 12, 16, 22][detail];
  const depth = 0.7;
  const edges = Array.from({ length: steps + 1 }, (_, i) => {
    const angle = (i * Math.PI) / steps;
    return [radius * Math.cos(angle), seat + crown + radius * Math.sin(angle)];
  });
  box(out, 'stone', [-radius, seat, -depth / 2], [radius, seat + crown, depth / 2], light);
  for (const [i, [x, y]] of edges.entries()) {
    if (!i) continue;
    const [u, v] = edges[i - 1];
    for (const side of [-1, 1]) {
      const z = (side * depth) / 2;
      face(
        out,
        'stone',
        [
          [0, seat + crown, z],
          [u, v, z],
          [x, y, z],
        ],
        light,
        [0, 0, side],
      );
    }
    face(
      out,
      'stone',
      [
        [u, v, -depth / 2],
        [u, v, depth / 2],
        [x, y, depth / 2],
        [x, y, -depth / 2],
      ],
      ash,
      [x + u, 1, 0],
    );
  }
  const bevel = (w, d, h) =>
    rectangle(w, d)
      .toReversed()
      .map(([x, z]) => [x, h, z]);
  loft(
    out,
    'stone',
    [bevel(2.54, 1.08, 0.035), bevel(2.51, 1.1, 0.195), bevel(2.42, 1.05, 0.37)],
    ash,
  );
  if (detail < 2) {
    box(out, 'stone', [-1.19, 0.37, -0.53], [1.19, seat, 0.53], light);
    return;
  }
  // Leave both of the original planting pockets open at street distance.
  const recessFloor = 0.43;
  box(out, 'stone', [-1.2, 0.37, -0.54], [1.2, recessFloor, 0.54], ash);
  box(out, 'stone', [-0.585, recessFloor, -0.54], [0.585, seat, 0.54], light);
  for (const side of [-1, 1]) {
    const [a, b] = side < 0 ? [-1.21, -1.119] : [1.119, 1.21];
    box(out, 'stone', [a, recessFloor, -0.54], [b, seat, 0.54], light);
    const z = side * 0.45;
    box(out, 'stone', [-1.15, recessFloor, z - 0.09], [1.15, seat, z + 0.09], light);
  }
  if (detail < 3) return;
  lettering(out, seat);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 28; i++) {
      const x = -1.18 + (2.36 * i) / 28;
      const wave = (u) => 0.235 + Math.sin(u * 12.6) * 0.071 + Math.cos(u * 4.4) * 0.039;
      const b = x + 2.36 / 28;
      beam(
        out,
        'stone',
        [x, wave(x), side * 0.551],
        [b, wave(b), side * 0.551],
        0.033,
        0.034,
        light,
      );
    }
  }
}

function shelter(out, detail) {
  for (const x of [-1.8, 1.8]) {
    for (const z of [-1.26, 1.26]) {
      box(out, 'timber', [x - 0.1, 0.02, z - 0.1], [x + 0.1, 3.18, z + 0.1], green);
      if (detail > 0)
        box(out, 'paving', [x - 0.141, 0, z - 0.141], [x + 0.141, 0.145, z + 0.141], ash);
    }
  }
  const roof = 3.41;
  const ring = [
    [-1.89, -1.34],
    [1.89, -1.34],
    [1.89, 1.34],
    [-1.89, 1.34],
  ];
  for (const [i, a] of ring.entries()) {
    const b = ring[(i + 1) % ring.length];
    beam(out, 'timber', [a[0], 3.18, a[1]], [b[0], 3.18, b[1]], 0.255, 0.25, burgundy);
    beam(out, 'iron', [a[0], 0.86, a[1]], [b[0], 0.86, b[1]], 0.053, 0.057, green);
    if (detail === 0) continue;
    beam(out, 'iron', [a[0], 0.13, a[1]], [b[0], 0.13, b[1]], 0.05, 0.055, green);
    const count = detail === 1 ? 4 : Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.265);
    for (let j = 1; j < count; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / count;
      const z = a[1] + ((b[1] - a[1]) * j) / count;
      beam(out, 'iron', [x, 0.13, z], [x, 0.85, z], 0.032, 0.032, green);
    }
    if (detail >= 2)
      beam(
        out,
        'timber',
        [a[0], 2.85, a[1]],
        [a[0] * 0.81, 3.14, a[1] * 0.81],
        0.12,
        0.12,
        burgundy,
      );
  }
  courtRoof(out, 4.92, 3.94, roof, 0.98, slate, detail, false, 0.29);
  if (detail >= 2) {
    box(out, 'iron', [-0.35, 0.42, 1.382], [0.35, 0.69, 1.421], [0.425, 0.337, 0.19]);
    for (const x of [-0.29, 0.29])
      beam(out, 'iron', [x, 0.45, 1.421], [x, 0.655, 1.421], 0.026, 0.026, [0.49, 0.391, 0.213]);
  }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  const { floor, toe } = layout.farmingStele;
  const local = frame(out, [0, 0], floor, 0);
  box(local, 'paving', [-2.55, toe - floor, -2.07], [2.55, 0, 2.11], ash);
  monument(local, detail);
  shelter(local, detail);
}

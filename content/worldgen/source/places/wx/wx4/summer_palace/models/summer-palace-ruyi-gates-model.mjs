import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  dark,
  face,
  frame,
  gold,
  levels,
  red,
  roofs,
  turquoise,
  up,
} from './summer-palace-model.mjs';

export const forms = new Set(['north-ruyi', 'south-ruyi']);
export const surfaces = {
  masonry: { slot: 'wall', graph: 'brick_longformat' },
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  rubble: { slot: 'wall', graph: 'stone_drywall' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  metal: { slot: 'trim', graph: 'metal_painted' },
};

const greyBrick = [0.35, 0.355, 0.328];
const buffBrick = [0.477, 0.458, 0.412];
const plinth = [0.535, 0.517, 0.468];
const rubble = [0.497, 0.456, 0.411];
const paint = [0.453, 0.16, 0.12];

function cap(out, width, depth, y, south, detail) {
  const x = width / 2,
    z = depth / 2;
  const across =
    detail === 0 ? [-1, -0.68, 0.68, 1] : [-1, -0.84, -0.66, -0.36, 0, 0.36, 0.66, 0.84, 1];
  const ts = south && detail > 0 ? [0, 0.33, 0.66, 1] : [0, 1];
  const point = (u, t, side) => {
    const edge = Math.pow(Math.max(0, (Math.abs(u) - 0.57) / 0.43), 2);
    const centerHeight = south ? 0.44 * (0.61 * t + 0.39 * t * t) : 0.18 * t;
    const curledEnd = (south ? 0.25 + 0.21 * t : 0.058) * edge;
    return [u * x * (1 - 0.012 * t), y + centerHeight + curledEnd, side * z * (1 - 0.984 * t)];
  };
  const ring = (t) => [
    ...across.map((u) => point(u, t, 1)),
    ...across.toReversed().map((u) => point(u, t, -1)),
  ];
  loft(out, 'tile', ts.map(ring), roofs.grey, { cap: false });
  const rim = ring(0);
  for (const [i, a] of rim.entries()) {
    const b = rim[(i + 1) % rim.length];
    const c = [a[0], a[1] - 0.14, a[2]],
      d = [b[0], b[1] - 0.14, b[2]];
    face(out, 'tile', [a, c, d, b], roofs.grey, [a[0] + b[0], 0, a[2] + b[2]]);
    face(out, 'masonry', [c, d, [0, y - 0.145, 0]], greyBrick, [0, -1, 0]);
  }
  for (let i = 1; i < across.length; i++)
    beam(out, 'tile', point(across[i - 1], 1, 0), point(across[i], 1, 0), 0.114, 0.124, roofs.grey);
  if (detail < 2) return;
  for (const end of [-1, 1]) {
    for (const side of [-1, 1])
      for (let i = 1; i < ts.length; i++)
        beam(
          out,
          'tile',
          point(end, ts[i - 1], side),
          point(end, ts[i], side),
          0.14,
          0.16,
          roofs.grey,
        );
    if (south && detail >= 3)
      for (const t of [0.17, 0.42, 0.69, 1]) {
        const [a, b, c] = point(end, t, 1);
        loft(
          out,
          'tile',
          [
            [b, 0.061],
            [b + 0.132, 0.066],
            [b + 0.22, 0.031],
          ].map(([y, r]) => radialRing(y, r, r, 6, [a, c])),
          roofs.grey,
        );
      }
  }
  const rows = Math.round(width / (detail >= 3 ? 0.19 : 0.32));
  for (const side of [-1, 1]) {
    for (let i = 1; i < rows; i++) {
      const u = (2 * i) / rows - 1;
      const start = point(u, 0, side);
      const end = point(u, south && detail >= 3 ? 0.78 : 0.18, side);
      beam(
        out,
        'tile',
        [start[0], start[1] + 0.044, start[2] + side * 0.022],
        [end[0], end[1] + 0.045, end[2]],
        0.07,
        0.076,
        roofs.grey,
      );
    }
  }
}

function masonry(tint, out, { x, end, y, d, toe }, detail) {
  box(out, 'masonry', [x, toe, -d], [end, y, d], tint);
  if (detail === 0) return;
  box(out, 'stone', [x - 0.02, toe, -d - 0.026], [end + 0.02, 0.31, d + 0.026], plinth);
  if (detail >= 3)
    for (const sign of [-1, 1])
      for (const top of [0.38, y - 0.15])
        box(
          out,
          'stone',
          [x, top - 0.036, sign * d - 0.032],
          [end, top + 0.022, sign * d + 0.032],
          plinth,
        );
}

function openDoors(out, half, clear, depth, detail) {
  if (detail === 0) return;
  for (const side of [-1, 1]) {
    const hinge = side * (half - 0.09),
      inset = depth * 0.62;
    const panel = frame(out, [hinge, inset], 0.06, side * 0.056);
    const run = Math.min(1.39, depth * 1.37);
    box(panel, 'timber', [-0.055, 0, -run], [0.055, clear - 0.23, 0], paint);
    if (detail < 2) continue;
    for (const y of [0.13, clear * 0.51, clear - 0.3])
      beam(panel, 'timber', [side * 0.068, y, -run], [side * 0.068, y, -0.083], 0.073, 0.075, red);
    if (detail >= 3)
      for (const z of [-run * 0.72, -run * 0.37, -run * 0.16])
        beam(
          panel,
          'timber',
          [side * 0.064, 0.17, z],
          [side * 0.064, clear - 0.26, z],
          0.026,
          0.028,
          red,
        );
  }
}

function wallWing(out, { side, start, end, toe, secondary }, detail) {
  const min = (a, b) => Math.min(side * a, side * b),
    max = (a, b) => Math.max(side * a, side * b);
  const top = 2.39,
    capY = top + 0.13,
    d = 0.34;
  const solidStart = secondary ? start + 1.38 : start;
  if (secondary) {
    box(out, 'timber', [min(start, solidStart), 2.03, -d], [max(start, solidStart), 2.2, d], paint);
    box(out, 'rubble', [min(start, solidStart), 2.2, -d], [max(start, solidStart), top, d], rubble);
    for (const x of [start + 0.05, solidStart - 0.05])
      box(out, 'timber', [side * x - 0.045, 0, -d], [side * x + 0.045, 2.03, d], paint);
  }
  box(out, 'rubble', [min(solidStart, end), toe, -d], [max(solidStart, end), top, d], rubble);
  box(
    out,
    'tile',
    [min(start - 0.13, end + 0.12), top, -d - 0.08],
    [max(start - 0.13, end + 0.12), capY, d + 0.08],
    roofs.grey,
  );
  if (detail >= 2)
    for (const z of [-d - 0.012, d + 0.012])
      beam(out, 'stone', [side * solidStart, 0.16, z], [side * end, 0.16, z], 0.08, 0.1, plinth);
}

function ramp(out, { half, near, z, y, railWidth }, detail) {
  const end = Math.sign(z),
    x = half + 0.38;
  face(
    out,
    'stone',
    [
      [-x, 0, near],
      [x, 0, near],
      [x, y, z],
      [-x, y, z],
    ],
    plinth,
    up,
  );
  if (detail === 0 || end < 0) return;
  for (const side of [-1, 1]) {
    const u = railWidth * side;
    beam(out, 'metal', [u, 0.91, near + 0.18], [u, y + 0.91, z - 0.04], 0.065, 0.066, turquoise);
    for (const t of detail >= 2 ? [0, 0.24, 0.48, 0.72, 1] : [0, 1]) {
      const v = near + 0.18 + (z - near - 0.22) * t,
        h = y * t;
      beam(out, 'metal', [u, h, v], [u, h + 0.94, v], 0.058, 0.061, turquoise);
    }
  }
}

function plaque(out, x, z, height, south, detail) {
  if (detail === 0) return;
  const low = height * 0.28,
    high = height * 0.82;
  box(out, 'timber', [x - 0.127, low, z], [x + 0.127, high, z + 0.041], dark);
  if (detail < 2) return;
  const tint = south ? gold : turquoise;
  const signs = south ? 7 : 6;
  for (let i = 0; i < signs; i++) {
    const h = low + ((high - low) * (i + 0.63)) / (signs + 0.28);
    face(
      out,
      'metal',
      [
        [x - 0.068, h, z + 0.043],
        [x, h - 0.055, z + 0.043],
        [x + 0.068, h, z + 0.043],
        [x, h + 0.051, z + 0.043],
      ],
      tint,
      [0, 0, 1],
    );
  }
}

function rosettes(out, half, lintel, z, detail) {
  if (detail < 2) return;
  for (const x of [-0.61, -0.205, 0.205, 0.61].map((v) => v * half)) {
    const y = lintel - 0.27,
      n = detail >= 3 ? 8 : 5,
      radius = 0.091;
    const marks = Array.from({ length: n }, (_, i) => [
      x + radius * Math.cos((2 * Math.PI * i) / n),
      y + radius * Math.sin((2 * Math.PI * i) / n),
      z,
    ]);
    for (const [i, p] of marks.entries())
      beam(out, 'metal', p, marks[(i + 1) % n], 0.023, 0.031, gold);
  }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level],
    south = layout.form === 'south-ruyi';
  const { grade, toe, half, clear, depth, left, right, aprons } = layout.ruyiGate;
  const gate = frame(out, [0, 0], grade, 0);
  const pier = south ? 0.79 : 0.65,
    width = half + pier,
    d = depth / 2;
  const family = south ? buffBrick : greyBrick;
  for (const side of [-1, 1]) {
    masonry(
      family,
      gate,
      {
        x: Math.min(side * half, side * width),
        end: Math.max(side * half, side * width),
        y: clear + 0.43,
        d,
        toe,
      },
      detail,
    );
    const x = side * half;
    box(gate, 'timber', [x - 0.063, 0, -d + 0.04], [x + 0.063, clear + 0.07, d - 0.04], paint);
    if (south && detail >= 2)
      beam(
        gate,
        'metal',
        [x - side * 0.066, 0.18, d - 0.08],
        [x - side * 0.066, clear - 0.35, d - 0.08],
        0.032,
        0.03,
        gold,
      );
  }
  box(gate, 'stone', [-half - 0.08, toe, -d], [half + 0.08, 0, d], plinth);
  box(gate, 'timber', [-half, clear, -d], [half, clear + 0.24, d], paint);
  box(gate, 'masonry', [-width, clear + 0.24, -d], [width, clear + 0.52, d], family);
  box(
    gate,
    'stone',
    [-width - 0.07, clear + 0.51, -d - 0.09],
    [width + 0.07, clear + 0.62, d + 0.09],
    plinth,
  );
  cap(gate, 2 * width + 0.38, depth + 0.34, clear + 0.74, south, detail);
  wallWing(gate, { side: -1, start: width, end: left, toe, secondary: false }, detail);
  if (right > width + 0.35)
    wallWing(gate, { side: 1, start: width, end: right, toe, secondary: !south }, detail);
  for (const apron of aprons)
    ramp(gate, { half, near: Math.sign(apron.z) * d, railWidth: half + 0.57, ...apron }, detail);
  openDoors(gate, half, clear, d, detail);
  plaque(gate, half + pier * 0.55, d + 0.016, clear, south, detail);
  if (south) {
    box(
      gate,
      'timber',
      [-half + 0.061, clear - 0.4, d - 0.118],
      [half - 0.061, clear, d - 0.048],
      paint,
    );
    if (detail >= 2)
      beam(
        gate,
        'metal',
        [-half + 0.061, clear - 0.412, d - 0.046],
        [half - 0.061, clear - 0.412, d - 0.046],
        0.034,
        0.036,
        gold,
      );
    rosettes(gate, half, clear, d - 0.039, detail);
  }
}

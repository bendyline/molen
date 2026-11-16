import {
  beam,
  loft,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  dark,
  face,
  frame,
  indigo,
  levels,
  red,
  solid,
  turquoise,
  up,
} from './summer-palace-model.mjs';

export const forms = new Set(['farming-garden']);
export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  masonry: { slot: 'wall', graph: 'brick_longformat' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  glass: { slot: 'window', graph: 'window_grid' },
};

const ash = [0.435, 0.433, 0.389];
const wall = [0.376, 0.383, 0.348];
const paving = [0.52, 0.517, 0.477];
const tile = [0.283, 0.284, 0.254];
const lattice = [0.118, 0.22, 0.158];
const windowGlass = [0.148, 0.232, 0.223];
const cream = [0.68, 0.667, 0.591];

function rangeRoof(out, { width, depth, height, rise, gable }, detail) {
  const x = width / 2,
    z = depth / 2;
  if (detail === 0) {
    const ridge = gable ? x * 0.96 : x * 0.77;
    for (const sign of [-1, 1]) {
      face(
        out,
        'tile',
        [
          [-x, height, sign * z],
          [x, height, sign * z],
          [ridge, height + rise, 0],
          [-ridge, height + rise, 0],
        ],
        tile,
        up,
      );
      face(
        out,
        'masonry',
        [
          [sign * x, height, -z],
          [sign * x, height, z],
          [sign * ridge, height + rise, 0],
        ],
        wall,
        [sign, 0, 0],
      );
    }
    return;
  }
  const ts = detail === 1 ? [0, 0.54, 1] : [0, 0.32, 0.67, 1];
  const us = detail === 1 ? [-1, -0.78, 0.78, 1] : [-1, -0.86, -0.64, 0, 0.64, 0.86, 1];
  const point = (u, t, sign) => [
    x * u * (1 - t * (gable ? 0.014 : 0.19)),
    height +
      rise * t * (0.73 + 0.27 * t) +
      0.16 * (1 - t) * Math.pow(Math.max(0, (Math.abs(u) - 0.67) / 0.33), 2),
    sign * z * (1 - 0.987 * t),
  ];
  const ring = (t) => [
    ...us.map((u) => point(u, t, 1)),
    ...us.toReversed().map((u) => point(u, t, -1)),
  ];
  const rows = ts.map(ring);
  loft(out, 'tile', rows, tile, { cap: false });
  const rim = rows[0];
  for (const [i, a] of rim.entries()) {
    const b = rim[(i + 1) % rim.length],
      lo = [a[0], a[1] - 0.14, a[2]],
      next = [b[0], b[1] - 0.14, b[2]];
    face(out, 'tile', [a, lo, next, b], tile, [a[0] + b[0], 0, a[2] + b[2]]);
    face(out, 'timber', [lo, next, [0, height - 0.14, 0]], dark, [0, -1, 0]);
  }
  beam(out, 'tile', point(-1, 1, 0), point(1, 1, 0), 0.165, 0.19, tile);
  if (detail < 2) return;
  for (const end of [-1, 1]) {
    for (const sign of [-1, 1]) {
      for (let i = 1; i < ts.length; i++)
        beam(out, 'tile', point(end, ts[i - 1], sign), point(end, ts[i], sign), 0.12, 0.13, tile);
      if (detail >= 3) {
        const p = point(end, 0, sign);
        beam(out, 'tile', p, [p[0] + end * 0.13, p[1] + 0.16, p[2]], 0.105, 0.11, tile);
      }
    }
  }
  if (detail < 3) return;
  const ends = Math.ceil(width / (detail === 3 ? 0.36 : 0.27));
  for (const sign of [-1, 1])
    for (let i = 1; i < ends; i++) {
      const u = (2 * i) / ends - 1;
      beam(out, 'tile', point(u, 0, sign), point(u, 0.039, sign), 0.085, 0.082, tile);
    }
}

function panel(out, x, half, z, height, entrance, detail) {
  const bottom = entrance ? 0.045 : 0.73;
  const top = height - 0.46;
  const divider = bottom + (top - bottom) * 0.47;
  if (detail === 1) {
    face(
      out,
      'timber',
      [
        [x - half, bottom, z],
        [x + half, bottom, z],
        [x + half, top, z],
        [x - half, top, z],
      ],
      entrance ? cream : lattice,
      [0, 0, 1],
    );
    return;
  }
  if (entrance) {
    const door = Math.min(2.23, top - 0.4);
    const left = x - half * 0.04;
    const right = x + half * 0.83;
    box(out, 'timber', [x - half, bottom, z - 0.058], [x + half, top, z + 0.038], dark);
    box(out, 'timber', [left, bottom, z + 0.058], [right, door, z + 0.117], cream);
    box(
      out,
      'glass',
      [left + 0.074, door * 0.51, z + 0.117],
      [right - 0.074, door - 0.285, z + 0.139],
      windowGlass,
    );
    beam(
      out,
      'timber',
      [left + 0.07, door * 0.43, z + 0.134],
      [left + 0.2, door * 0.43, z + 0.134],
      0.035,
      0.033,
      lattice,
    );
    box(
      out,
      'timber',
      [x - half * 0.91, door + 0.04, z + 0.045],
      [x + half * 0.91, top, z + 0.072],
      lattice,
    );
    if (detail >= 3)
      for (let i = 1; i <= 7; i++) {
        const u = x + half * 0.21 * (i - 4);
        beam(
          out,
          'timber',
          [u, door + 0.06, z + 0.083],
          [u, top - 0.03, z + 0.083],
          0.032,
          0.04,
          red,
        );
      }
    return;
  }
  box(out, 'timber', [x - half, bottom, z - 0.06], [x + half, top, z + 0.061], red);
  const width = half * 1.77;
  const center = x;
  box(
    out,
    'glass',
    [center - width / 2, bottom + 0.14, z + 0.061],
    [center + width / 2, top - 0.12, z + 0.092],
    windowGlass,
  );
  beam(
    out,
    'timber',
    [x - half, divider, z + 0.104],
    [x + half, divider, z + 0.104],
    0.09,
    0.1,
    red,
  );
  const columns = detail >= 3 ? 8 : 4;
  for (let i = 1; i < columns; i++) {
    const u = center + width * (i / columns - 0.5);
    beam(out, 'timber', [u, divider, z + 0.105], [u, top - 0.08, z + 0.105], 0.036, 0.048, lattice);
  }
  if (detail >= 3)
    for (let i = 1; i < 6; i++) {
      const y = divider + ((top - divider) * i) / 6;
      beam(
        out,
        'timber',
        [center - width / 2, y, z + 0.105],
        [center + width / 2, y, z + 0.105],
        0.041,
        0.037,
        lattice,
      );
    }
}

function facade(out, w, d, height, bays, open, access, detail) {
  if (detail === 0) {
    box(
      out,
      'masonry',
      [-w * 0.44, 0, -d * 0.44],
      [w * 0.44, height, d * (open ? 0.08 : 0.39)],
      wall,
    );
    if (open)
      for (const x of [-w * 0.43, w * 0.43])
        beam(out, 'timber', [x, 0, d * 0.39], [x, height, d * 0.39], 0.19, 0.19, red);
    return;
  }
  const half = w * 0.44,
    depth = d * 0.43;
  box(out, 'masonry', [-half, 0, -depth], [half, height, -depth + 0.25], wall);
  for (const side of [-1, 1]) {
    const x = side * (half - 0.16);
    box(out, 'masonry', [x - 0.16, 0, -depth], [x + 0.16, height, open ? -0.14 : depth], wall);
  }
  const z = depth * (open ? 0.96 : 0.65);
  beam(out, 'timber', [-half, height - 0.2, z], [half, height - 0.2, z], 0.18, 0.32, red);
  const step = (2 * half) / bays;
  for (let i = 0; i <= bays; i++) {
    const x = -half + step * i;
    beam(out, 'timber', [x, 0, z], [x, height, z], 0.19, 0.24, red);
    if (detail >= 2) {
      box(out, 'stone', [x - 0.13, 0, z - 0.15], [x + 0.13, 0.09, z + 0.15], ash);
      beam(
        out,
        'timber',
        [x, height - 0.26, z - 0.16],
        [x, height - 0.03, z + 0.23],
        0.31,
        0.12,
        turquoise,
      );
      if (detail >= 3)
        beam(
          out,
          'timber',
          [x, height - 0.14, z - 0.21],
          [x, height + 0.03, z + 0.26],
          0.35,
          0.09,
          indigo,
        );
    }
    if (i === bays || open) continue;
    const dx = x + step / 2,
      sill = step * 0.43,
      center = access && i === Math.floor(bays / 2);
    if (!center) box(out, 'masonry', [dx - sill, 0, z - 0.09], [dx + sill, 0.73, z + 0.12], wall);
    panel(out, dx, sill, z - 0.07, height, center, detail);
  }
}

function building(out, room, detail) {
  const { center, width: w, depth: d, angle } = room.frame;
  const { height, bays, open, gable, access } = room.profile;
  solid(out, 'stone', room.outline, room.toe, room.floor, ash);
  const body = frame(out, center, room.floor, angle);
  facade(body, w, d, height, bays, open, access, detail);
  const rise = Math.min(2.15, Math.max(0.83, d * 0.26));
  rangeRoof(
    body,
    { width: w * 1.028, depth: d * 1.073, height: height + 0.055, rise, gable },
    detail,
  );
  if (room.landing) {
    const { bottom, run } = room.landing;
    const toe = bottom - room.floor,
      start = d * 0.5 - 0.045,
      half = Math.min(w * 0.26, 2.07);
    const steps = detail < 2 ? 1 : Math.max(2, Math.ceil(-toe / 0.15));
    for (let i = 0; i < steps; i++)
      box(
        body,
        'stone',
        [-half, toe - 0.21, start + (run * i) / steps],
        [half, (toe * i) / steps, start + (run * (i + 1)) / steps],
        paving,
      );
  }
}

function courtWalk(out, walk) {
  for (let i = 1; i < walk.length; i++) {
    const [a, b] = walk[i - 1],
      [c, d] = walk[i];
    face(out, 'stone', [a, b, d, c], paving, up);
  }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  for (const room of layout.sites) building(out, room, detail);
  for (const walk of layout.farmingGarden.walks) courtWalk(out, walk);
}

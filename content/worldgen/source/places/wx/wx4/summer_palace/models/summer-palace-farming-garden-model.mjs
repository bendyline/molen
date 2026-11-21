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
const villageTile = [0.126, 0.137, 0.139];
const lattice = [0.118, 0.22, 0.158];
const windowGlass = [0.148, 0.232, 0.223];
const cream = [0.68, 0.667, 0.591];
const villageTimber = [0.266, 0.198, 0.132];
const villagePanel = [0.31, 0.231, 0.157];
const villageGlass = [0.156, 0.168, 0.131];
const rearRangeHalfWidth = 0.485;
const porchTimber = [0.135, 0.083, 0.066];
const porchPanel = [0.172, 0.111, 0.084];
const porchGlazing = [0.089, 0.11, 0.083];
const porchStone = [
  [0.52, 0.434, 0.333],
  [0.586, 0.485, 0.322],
  [0.438, 0.401, 0.329],
  [0.635, 0.541, 0.385],
];

function rangeRoof(out, { width, depth, height, rise, gable, roofColor, brickGables }, detail) {
  const x = width / 2,
    z = depth / 2;
  if (detail === 0) {
    const ridge = gable ? x * 0.96 : x * 0.77;
    for (const sign of [-1, 1]) {
      const slope = [
        [-x, height, sign * z],
        [x, height, sign * z],
        [ridge, height + rise, 0],
        [-ridge, height + rise, 0],
      ];
      face(out, 'tile', slope, roofColor, up);
      if (brickGables)
        face(
          out,
          'timber',
          slope.map(([x, y, z]) => [x, y - 0.11, z]),
          dark,
          [0, -1, 0],
        );
      if (!brickGables)
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
  if (brickGables) {
    for (let j = 1; j < rows.length; j++) {
      const lower = rows[j - 1];
      const upper = rows[j];
      for (let i = 0; i < lower.length; i++) {
        if ((i + 1) % us.length === 0) continue;
        const slope = [lower[i], lower[i + 1], upper[i + 1], upper[i]];
        face(out, 'tile', slope, roofColor, up);
        face(
          out,
          'timber',
          slope.map(([x, y, z]) => [x, y - 0.11, z]),
          dark,
          [0, -1, 0],
        );
      }
    }
  } else loft(out, 'tile', rows, roofColor, { cap: false });
  const rim = rows[0];
  for (const [i, a] of rim.entries()) {
    const b = rim[(i + 1) % rim.length],
      lo = [a[0], a[1] - 0.14, a[2]],
      next = [b[0], b[1] - 0.14, b[2]];
    face(out, 'tile', [a, lo, next, b], roofColor, [a[0] + b[0], 0, a[2] + b[2]]);
    face(out, 'timber', [lo, next, [0, height - 0.14, 0]], dark, [0, -1, 0]);
  }
  beam(out, 'tile', point(-1, 1, 0), point(1, 1, 0), 0.165, 0.19, roofColor);
  if (detail < 2) return;
  for (const end of [-1, 1]) {
    for (const sign of [-1, 1]) {
      for (let i = 1; i < ts.length; i++)
        beam(
          out,
          'tile',
          point(end, ts[i - 1], sign),
          point(end, ts[i], sign),
          0.12,
          0.13,
          roofColor,
        );
      if (detail >= 3) {
        const p = point(end, 0, sign);
        beam(out, 'tile', p, [p[0] + end * 0.13, p[1] + 0.16, p[2]], 0.105, 0.11, roofColor);
      }
    }
  }
  if (detail < 3) return;
  const ends = Math.ceil(width / (detail === 3 ? 0.36 : 0.27));
  for (const sign of [-1, 1])
    for (let i = 1; i < ends; i++) {
      const u = (2 * i) / ends - 1;
      beam(out, 'tile', point(u, 0, sign), point(u, 0.039, sign), 0.085, 0.082, roofColor);
    }
}

function brickGableEnds(out, width, depth, height, rise, detail) {
  // The brick ends continue above the eaves, behind the projecting grey tiles.
  const eaveDepth = depth * 1.073 * 0.5;
  const rim = depth * 0.43;
  const segments = detail < 2 ? 2 : 4;
  for (const side of [-1, 1]) {
    const x = side * width * rearRangeHalfWidth;
    const point = (z) => {
      const t = 1 - Math.abs(z) / eaveDepth;
      const roofRise = detail === 0 ? t : t * (0.73 + 0.27 * t);
      return [x, height + 0.065 + rise * roofRise, z];
    };
    for (let i = 0; i < segments; i++) {
      const a = (-1 + (2 * i) / segments) * rim;
      const b = (-1 + (2 * (i + 1)) / segments) * rim;
      face(
        out,
        'masonry',
        [[x, height - 0.05, a], [x, height - 0.05, b], point(b), point(a)],
        wall,
        [side, 0, 0],
      );
    }
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

function villageDoors(out, x, half, z, height, entrance, detail) {
  const bottom = entrance ? 0.045 : 0.28,
    rails = bottom + (height - bottom) * 0.38,
    top = height - 0.24;
  if (detail === 1) {
    face(
      out,
      'timber',
      [
        [x - half, 0, z],
        [x + half, 0, z],
        [x + half, top, z],
        [x - half, top, z],
      ],
      villagePanel,
      [0, 0, 1],
    );
    face(
      out,
      'glass',
      [
        [x - half + 0.11, rails + 0.08, z + 0.015],
        [x + half - 0.11, rails + 0.08, z + 0.015],
        [x + half - 0.11, top - 0.075, z + 0.015],
        [x - half + 0.11, top - 0.075, z + 0.015],
      ],
      villageGlass,
      [0, 0, 1],
    );
    return;
  }
  if (!entrance) box(out, 'stone', [x - half, 0, z - 0.09], [x + half, bottom, z + 0.09], ash);
  box(out, 'timber', [x - half, bottom, z - 0.07], [x + half, top, z + 0.035], villagePanel);
  box(
    out,
    'glass',
    [x - half + 0.1, rails + 0.08, z + 0.035],
    [x + half - 0.1, top - 0.075, z + 0.049],
    villageGlass,
  );
  const leaves = detail < 3 ? 2 : 4;
  for (let i = 0; i <= leaves; i++) {
    const u = x + half * ((2 * i) / leaves - 1);
    beam(out, 'timber', [u, bottom, z + 0.066], [u, top, z + 0.066], 0.065, 0.09, villageTimber);
  }
  beam(
    out,
    'timber',
    [x - half, rails, z + 0.066],
    [x + half, rails, z + 0.066],
    0.067,
    0.09,
    villageTimber,
  );
}

function stoneInfill(out, x, half, z, detail) {
  const bottom = 0.08;
  const top = 0.69;
  const span = half * 2;
  box(out, 'masonry', [x - half, 0, z - 0.17], [x + half, 0.82, z], wall);
  const across = (u, y) => [x - half + span * u, y, z + 0.014];
  if (detail < 2) {
    face(
      out,
      'stone',
      [across(0.1, bottom), across(0.9, bottom), across(0.9, top), across(0.1, top)],
      porchStone[1],
      [0, 0, 1],
    );
    return;
  }
  const knots = [0.08, 0.21, 0.39, 0.58, 0.76, 0.92];
  for (let i = 1; i < knots.length; i++) {
    const a = knots[i - 1];
    const b = knots[i];
    const seam = 0.36 + 0.08 * Math.sin(i * 2.4);
    const lean = Math.sin(i * 1.9) * 0.035;
    face(
      out,
      'stone',
      [
        across(a + 0.006, bottom + 0.04 * (i % 2)),
        across(b - 0.008, bottom + 0.036),
        across(b + lean - 0.008, seam - 0.018),
        across(a + 0.02, seam - 0.038),
      ],
      porchStone[i % porchStone.length],
      [0, 0, 1],
    );
    face(
      out,
      'stone',
      [
        across(a + 0.001, seam + 0.004),
        across(b + lean - 0.012, seam + 0.015),
        across(b - 0.026, top - 0.027 * (i % 2)),
        across(a + 0.017, top - 0.021),
      ],
      porchStone[(i + 2) % porchStone.length],
      [0, 0, 1],
    );
  }
}

function teaHouseBay(out, x, half, z, height, entrance, detail) {
  if (!entrance) stoneInfill(out, x, half, z, detail);
  const sill = entrance ? 0.05 : 0.82;
  const divider = entrance ? 0.79 : 1.36;
  const top = height - 0.49;
  const wallFace = (slot, low, high, depth, color, left = -half, right = half) =>
    face(
      out,
      slot,
      [
        [x + left, low, z + depth],
        [x + right, low, z + depth],
        [x + right, high, z + depth],
        [x + left, high, z + depth],
      ],
      color,
      [0, 0, 1],
    );
  wallFace('timber', sill, divider + 0.055, 0.017, porchPanel);
  wallFace('glass', divider, top, 0.012, porchGlazing);
  wallFace('timber', top, height - 0.23, 0.017, porchTimber);

  const transom = top - 0.36;
  if (entrance) {
    wallFace(
      'glass',
      transom + 0.059,
      top,
      0.028,
      [0.118, 0.132, 0.097],
      -half * 0.61,
      half * 0.61,
    );
    wallFace('timber', transom, transom + 0.059, 0.054, porchTimber);
  } else {
    // The lower sash next to the door is glazed, while the outside half has a closed panel.
    const [left, right] = x < 0 ? [0.045, half - 0.075] : [-half + 0.075, -0.045];
    wallFace('glass', sill + 0.077, divider - 0.052, 0.028, porchGlazing, left, right);
    wallFace('timber', sill, sill + 0.061, 0.056, porchTimber);
  }
  if (detail < 2) return;
  const barZ = z + 0.044;
  const divisions = entrance ? 6 : 8;
  const sashTop = entrance ? transom : top;
  for (let i = 0; i <= divisions; i++) {
    const u = x - half + (2 * half * i) / divisions;
    const jamb = i === 0 || i === divisions || i === divisions / 2;
    const bottom = jamb ? sill : divider;
    beam(
      out,
      'timber',
      [u, bottom, barZ],
      [u, sashTop, barZ],
      jamb ? 0.07 : 0.041,
      0.057,
      porchTimber,
    );
  }
  const rows = detail >= 3 ? 4 : 2;
  for (let i = 0; i <= rows; i++) {
    const y = divider + ((sashTop - divider) * i) / rows;
    beam(out, 'timber', [x - half, y, barZ], [x + half, y, barZ], 0.046, 0.057, porchTimber);
  }
  if (entrance && detail >= 3) {
    for (const t of [-0.61, -0.31, 0, 0.31, 0.61]) {
      const u = x + t * half;
      beam(out, 'timber', [u, transom, barZ], [u, top, barZ], 0.044, 0.058, porchTimber);
    }
    for (const side of [-1, 1]) {
      const x0 = x + side * 0.055;
      box(out, 'timber', [x0 - 0.021, 0.99, barZ], [x0 + 0.021, 1.12, barZ + 0.026], dark);
    }
  }
}

function facade(
  out,
  w,
  d,
  { height, bays, open, access, finish, recessedPorch, brickGables },
  detail,
) {
  const village = finish === 'water-village';
  const post = recessedPorch ? porchTimber : village ? villageTimber : red;
  const half = w * (brickGables ? rearRangeHalfWidth : 0.44);
  if (detail === 0) {
    const rise = Math.min(2.15, Math.max(0.83, d * 0.26));
    const front = recessedPorch ? 0.44 : open ? 0.08 : 0.39;
    const top = recessedPorch ? height + 0.055 + rise * (1 - front / (1.073 / 2)) : height;
    box(out, 'masonry', [-half, 0, -d * 0.44], [half, top, d * front], wall);
    if (open)
      for (const x of [-w * 0.43, w * 0.43])
        beam(out, 'timber', [x, 0, d * 0.39], [x, height, d * 0.39], 0.19, 0.19, post);
    return;
  }
  const depth = d * 0.43;
  box(out, 'masonry', [-half, 0, -depth], [half, height, -depth + 0.25], wall);
  for (const side of [-1, 1]) {
    const x = side * (half - 0.16);
    box(out, 'masonry', [x - 0.16, 0, -depth], [x + 0.16, height, open ? -0.14 : depth], wall);
  }
  const z = depth * (open || recessedPorch ? 0.96 : 0.65);
  const frontWall = recessedPorch ? z - 1.27 : z - 0.07;
  beam(out, 'timber', [-half, height - 0.2, z], [half, height - 0.2, z], 0.18, 0.32, post);
  const step = (2 * half) / bays;
  for (let i = 0; i <= bays; i++) {
    const x = -half + step * i;
    if (recessedPorch && detail >= 2) {
      const facets = detail >= 3 ? 12 : 8;
      const ring = (y, r) => radialRing(y, r, r, facets, [x, z]);
      loft(out, 'timber', [ring(0.07, 0.136), ring(height, 0.113)], post, { cap: false });
    } else {
      beam(out, 'timber', [x, 0, z], [x, height, z], 0.19, 0.24, post);
    }
    if (detail >= 2) {
      box(out, 'stone', [x - 0.13, 0, z - 0.15], [x + 0.13, 0.09, z + 0.15], ash);
      beam(
        out,
        'timber',
        [x, height - 0.26, z - 0.16],
        [x, height - 0.03, z + 0.23],
        0.31,
        0.12,
        village ? post : turquoise,
      );
      if (detail >= 3 && !village)
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
    if (recessedPorch) {
      teaHouseBay(out, dx, step * 0.5, frontWall, height, center, detail);
      continue;
    }
    if (village) {
      villageDoors(out, dx, sill, z - 0.07, height, center, detail);
      continue;
    }
    if (!center) box(out, 'masonry', [dx - sill, 0, z - 0.09], [dx + sill, 0.73, z + 0.12], wall);
    panel(out, dx, sill, z - 0.07, height, center, detail);
  }
}

function building(out, room, detail) {
  const { center, width: w, depth: d, angle } = room.frame;
  const { height, gable, finish, recessedPorch, brickGables } = room.profile;
  solid(out, 'stone', room.outline, room.toe, room.floor, ash);
  const body = frame(out, center, room.floor, angle);
  facade(body, w, d, room.profile, detail);
  const rise = Math.min(2.15, Math.max(0.83, d * 0.26));
  rangeRoof(
    body,
    {
      width: w * 1.028,
      depth: d * 1.073,
      height: height + 0.055,
      rise,
      gable,
      brickGables,
      roofColor: finish === 'water-village' ? villageTile : tile,
    },
    detail,
  );
  if (brickGables) brickGableEnds(body, w, d, height, rise, detail);
  if (room.landing) {
    const { bottom, run } = room.landing;
    const toe = bottom - room.floor,
      start = d * 0.5 - 0.045,
      half = recessedPorch ? 1.15 : Math.min(w * 0.26, 2.07);
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
  for (const walk of layout.farmingGarden.waterVillageWalks ?? []) {
    const below = ([x, y, z]) => [x, y - 0.25, z];
    loft(
      out,
      'stone',
      walk.map(([left, right]) => [right, left, below(left), below(right)]),
      paving,
    );
  }
}

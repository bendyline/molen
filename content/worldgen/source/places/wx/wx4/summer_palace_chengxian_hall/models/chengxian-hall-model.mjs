import { readFileSync } from 'node:fs';
import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { face, up } from '../../summer_palace/models/summer-palace-model.mjs';

export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  masonry: { slot: 'wall', graph: 'brick_longformat' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  glass: { slot: 'window', graph: 'window_grid' },
};

const stone = [0.49, 0.5, 0.47];
const grey = [0.37, 0.39, 0.38];
const tile = [0.3, 0.3, 0.275];
const cream = [0.72, 0.71, 0.62];
const red = [0.51, 0.21, 0.13];
const ochre = [0.74, 0.49, 0.17];
const jade = [0.18, 0.39, 0.37];
const blue = [0.15, 0.27, 0.43];
const dark = [0.14, 0.17, 0.15];
const glazing = [0.18, 0.28, 0.27];

function roof(out, width, depth, eave, detail) {
  const x = width / 2 + 0.27;
  const z = depth / 2 + 0.46;
  const rise = Math.min(2.08, depth * 0.33);
  const courses = detail === 0 ? [0, 1] : [0, 0.25, 0.59, 1];
  const ends = detail < 2 ? [-x, x] : [-x, -x * 0.78, x * 0.78, x];
  const point = (u, t, side) => [
    u * (1 - 0.026 * t),
    eave +
      rise * t * (0.64 + 0.36 * t) +
      0.125 * Math.pow(Math.max(0, (Math.abs(u) / x - 0.78) / 0.22), 2) * (1 - t),
    side * z * (1 - t),
  ];
  for (const side of [-1, 1]) {
    for (let row = 1; row < courses.length; row++) {
      for (let col = 1; col < ends.length; col++) {
        const a = ends[col - 1],
          b = ends[col],
          c = courses[row - 1],
          d = courses[row];
        face(
          out,
          'tile',
          [point(a, c, side), point(b, c, side), point(b, d, side), point(a, d, side)],
          tile,
          up,
        );
      }
      if (detail > 0) {
        for (const end of [-x, x])
          beam(
            out,
            'tile',
            point(end, courses[row - 1], side),
            point(end, courses[row], side),
            0.122,
            0.132,
            tile,
          );
      }
    }
    beam(out, 'timber', [-x, eave - 0.07, side * z], [x, eave - 0.07, side * z], 0.16, 0.18, dark);
    if (detail < 2) continue;
    const n = Math.ceil((2 * x) / (detail >= 3 ? 0.235 : 0.42));
    for (let i = 0; i < n; i++) {
      const x0 = x * ((2 * (i + 0.5)) / n - 1);
      const path = detail >= 3 ? [0, 0.25, 0.59, 1] : [0, 0.06];
      for (let j = 1; j < path.length; j++)
        beam(
          out,
          'tile',
          point(x0, path[j - 1], side),
          point(x0, path[j], side),
          0.091,
          0.072,
          tile,
        );
    }
  }
  beam(out, 'tile', point(-x, 1, 1), point(x, 1, 1), 0.18, 0.23, tile);
  for (const side of [-1, 1]) {
    const end = side * (width / 2 - 0.04);
    for (const slope of [-1, 1]) {
      for (let i = 1; i < courses.length; i++) {
        const [a, b] = [courses[i - 1], courses[i]];
        const tail = slope * z * (1 - a),
          tip = slope * z * (1 - b);
        face(
          out,
          'masonry',
          [
            [end, eave - 0.24, tail],
            [end, eave - 0.24, tip],
            [end, point(end, b, slope)[1] - 0.025, tip],
            [end, point(end, a, slope)[1] - 0.025, tail],
          ],
          grey,
          [side, 0, 0],
        );
      }
    }
  }
}

function lattice(out, x, y, z, width, height, detail) {
  const left = x - width / 2,
    right = x + width / 2,
    lower = y - height / 2,
    upper = y + height / 2;
  box(
    out,
    'timber',
    [left - 0.07, lower - 0.065, z - 0.105],
    [right + 0.07, upper + 0.065, z],
    red,
  );
  box(out, 'glass', [left, lower, z], [right, upper, z + 0.022], glazing);
  if (detail < 2) return;
  const rail = (a, b, c, d) =>
    beam(
      out,
      'timber',
      [x + a * width, y + b * height, z + 0.033],
      [x + c * width, y + d * height, z + 0.033],
      0.031,
      0.04,
      jade,
    );
  for (const a of [-0.47, 0.47]) rail(a, -0.47, a, 0.47);
  for (const b of [-0.47, 0.47]) rail(-0.47, b, 0.47, b);
  for (const a of [-0.32, 0.32]) rail(a, -0.47, a, 0.47);
  for (const b of [-0.32, 0.32]) rail(-0.47, b, 0.47, b);
  for (const side of [-1, 1]) {
    rail(side * 0.14, -0.32, side * 0.14, 0.32);
    rail(-0.32, side * 0.12, 0.32, side * 0.12);
    if (detail >= 3) {
      rail(side * 0.23, -0.32, side * 0.23, 0.32);
      rail(-0.32, side * 0.22, 0.32, side * 0.22);
    }
  }
}

function titlePanel(out, z, y, detail, strokes) {
  box(out, 'timber', [-1.08, y - 0.35, z], [1.08, y + 0.35, z + 0.084], ochre);
  box(out, 'timber', [-1.01, y - 0.29, z + 0.084], [1.01, y + 0.29, z + 0.104], dark);
  if (detail < 2) return;
  for (const [row, start, end] of strokes) {
    const u = -0.86 + (start / 72) * 1.72,
      v = -0.86 + (end / 72) * 1.72;
    const h = y + 0.235 - (row / 20) * 0.47;
    box(out, 'timber', [u, h - 0.024, z + 0.105], [v, h, z + 0.118], ochre);
  }
}

function circularOpening(out, w, y, z, radius, detail) {
  const ringHeight = y + radius;
  const ringFloor = y - radius;
  box(out, 'plaster', [-w / 2, ringHeight, z - 0.2], [w / 2, 3.41, z], cream);
  box(out, 'masonry', [-w / 2, 0.33, z - 0.2], [w / 2, ringFloor, z], grey);
  const steps = detail > 1 ? 24 : 12;
  for (const sign of [-1, 1]) {
    for (let i = 0; i < steps / 2; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / steps;
      const b = -Math.PI / 2 + ((i + 1) * 2 * Math.PI) / steps;
      const p = [sign * radius * Math.cos(a), y + radius * Math.sin(a)];
      const q = [sign * radius * Math.cos(b), y + radius * Math.sin(b)];
      face(
        out,
        'plaster',
        [
          [p[0], p[1], z],
          [q[0], q[1], z],
          [(sign * w) / 2, q[1], z],
          [(sign * w) / 2, p[1], z],
        ],
        cream,
        [0, 0, 1],
      );
      face(
        out,
        'plaster',
        [
          [p[0], p[1], z - 0.2],
          [q[0], q[1], z - 0.2],
          [(sign * w) / 2, q[1], z - 0.2],
          [(sign * w) / 2, p[1], z - 0.2],
        ],
        cream,
        [0, 0, -1],
      );
      face(
        out,
        'timber',
        [
          [p[0], p[1], z - 0.2],
          [q[0], q[1], z - 0.2],
          [q[0], q[1], z],
          [p[0], p[1], z],
        ],
        dark,
        [-(p[0] + q[0]), 2 * y - p[1] - q[1], 0],
      );
      if (detail >= 2)
        beam(out, 'timber', [...p, z + 0.022], [...q, z + 0.022], 0.086, 0.074, dark);
    }
  }
}

function hall(out, layout, detail) {
  const { width, depth, eave, strokes, footingDepth, stepFootingDepth } = layout;
  const x = width / 2,
    z = depth / 2,
    floor = 0.34;
  box(out, 'stone', [-x - 0.16, -footingDepth, -z - 0.12], [x + 0.16, floor, z + 0.32], stone);
  box(out, 'stone', [-1.28, -stepFootingDepth, z + 0.32], [1.28, 0.16, z + 0.7], stone);
  const sideWallTop = eave - 0.21;
  for (const side of [-1, 1]) {
    const a = side < 0 ? -x : x - 0.26;
    box(out, 'masonry', [a, floor, -z], [a + 0.26, sideWallTop, z], grey);
    box(
      out,
      'timber',
      [a - 0.04, sideWallTop - 0.07, -z - 0.05],
      [a + 0.3, eave - 0.12, z + 0.05],
      red,
    );
  }
  box(
    out,
    'plaster',
    [-x + 0.26, sideWallTop - 0.11, -z],
    [x - 0.26, sideWallTop, z - 0.08],
    cream,
  );
  if (detail === 0) {
    box(out, 'masonry', [-x, floor, -z], [x, sideWallTop, -z + 0.22], grey);
    for (const side of [-1, 1])
      box(
        out,
        'timber',
        [side < 0 ? -x : 0.86, floor, z - 0.18],
        [side < 0 ? -0.86 : x, sideWallTop, z],
        red,
      );
    roof(out, width, depth, eave, detail);
    return;
  }

  circularOpening(out, width - 0.52, 1.55, -z + 0.21, 0.99, detail);
  const bay = (width - 0.52) / 3;
  for (const side of [-1, 1]) {
    const near = side * (bay / 2 + 0.13);
    const outer = side * (x - 0.14);
    for (const cx of [near, outer])
      box(out, 'timber', [cx - 0.13, floor, z - 0.05], [cx + 0.13, eave - 0.3, z + 0.23], red);
    const middle = (near + outer) / 2,
      span = Math.abs(near - outer) - 0.22;
    box(
      out,
      'masonry',
      [middle - span / 2, floor, z - 0.17],
      [middle + span / 2, 0.99, z + 0.05],
      grey,
    );
    for (const half of [-1, 1])
      lattice(out, middle + (half * span) / 4, 1.91, z + 0.03, span / 2 - 0.1, 1.73, detail);
    const leafWidth = Math.max(0.34, bay / 2 - 0.9);
    const leafX = side * (0.86 + leafWidth / 2);
    box(
      out,
      'timber',
      [leafX - leafWidth / 2, floor, z - 0.04],
      [leafX + leafWidth / 2, 1.35, z + 0.1],
      red,
    );
    lattice(out, leafX, 2.07, z + 0.03, leafWidth - 0.08, 1.43, detail);
    if (detail >= 2)
      box(out, 'timber', [near - 0.078, 1.14, z + 0.24], [near + 0.078, 3.0, z + 0.277], dark);
  }
  box(out, 'timber', [-x, eave - 0.75, z - 0.075], [x, eave - 0.19, z + 0.13], blue);
  box(out, 'timber', [-x, eave - 0.27, z + 0.11], [x, eave - 0.16, z + 0.17], jade);
  for (const side of [-1, 1]) {
    const cx = side * (x * 0.57);
    const half = x * 0.32;
    face(
      out,
      'timber',
      [
        [cx - half, eave - 0.31, z + 0.139],
        [cx - half * 0.59, eave - 0.66, z + 0.139],
        [cx + half * 0.59, eave - 0.66, z + 0.139],
        [cx + half, eave - 0.31, z + 0.139],
      ],
      jade,
      [0, 0, 1],
    );
    if (detail >= 2)
      beam(
        out,
        'timber',
        [cx - half * 0.58, eave - 0.64, z + 0.148],
        [cx + half * 0.58, eave - 0.64, z + 0.148],
        0.029,
        0.037,
        ochre,
      );
  }
  titlePanel(out, z + 0.13, eave - 0.49, detail, strokes);
  if (detail >= 2) {
    const rafters = Math.ceil(width / 0.22);
    for (let i = 0; i < rafters; i++) {
      const px = width * ((i + 0.5) / rafters - 0.5);
      beam(
        out,
        'timber',
        [px, eave - 0.16, z - 0.19],
        [px, eave - 0.1, z + 0.42],
        0.062,
        0.078,
        i % 2 === 0 ? jade : red,
      );
    }
  }
  roof(out, width, depth, eave, detail);
}

const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const buildSkyline = (out) => hall(out, layout, 0);
export const buildDistrict = (out) => hall(out, layout, 1);
export const buildStreet = (out) => hall(out, layout, 2);
export const buildCloseup = (out) => hall(out, layout, 3);
export const buildMaster = buildCloseup;

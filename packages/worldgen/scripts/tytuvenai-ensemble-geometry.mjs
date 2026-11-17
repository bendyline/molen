/** Shared masonry and roof forms for the independent Tytuvėnai buildings. */
import { beam } from './authored-structure-mesh.mjs';
import {
  areaSign,
  at,
  block,
  closed,
  edge,
  face,
  mix,
  pairs,
  panel,
  pavilion,
  planarMid,
  surface,
} from './montreal-museum-pavilion-geometry.mjs';

const materials = {
  plaster: surface('wall', 'plaster_lime', 0.93),
  brick: surface('wall', 'brick_flemish', 0.95),
  stone: surface('foundation', 'stone_granite', 0.94),
  tile: surface('roof', 'tile_ceramic', 0.9),
  metal: surface('roof', 'metal_painted', 0.83, 0.11),
  glass: surface('window', 'window_punched', 0.62),
  wood: surface('door', 'wood_plain', 0.9),
};

export function churchModel(url, config, draw) {
  const surfaces = Object.fromEntries(config.slots.map((slot) => [slot, materials[slot]]));
  const bundle = pavilion(url, { ...config, surfaces }, draw);
  bundle.model.category = 'religious';
  bundle.model.mediumFiContext.scale = config.scale;
  bundle.model.sourceLicense =
    'Independent reconstruction from public-domain photographer originals, heritage register facts, OpenStreetMap geometry and open terrain tiles.';
  bundle.model.recipeDependencies.push('tytuvenai-ensemble-geometry.mjs');
  return bundle;
}

export function blockBetween(out, slot, [x0, x1, z0, z1], low, high, color) {
  block(out, slot, x0, low, z0, x1 - x0, high - low, z1 - z0, color);
}

export function wallX(x, side) {
  return { normal: [side, 0, 0], p: (z, y, d = 0) => [x + side * d, y, z] };
}

export function plinth(out, outline, floor, grade, color) {
  for (const [a, b] of pairs(closed(outline))) {
    const wall = edge(a, b, areaSign(outline));
    const points = [
      at(a, Math.min(floor - 0.26, grade(a) - 0.36)),
      at(b, Math.min(floor - 0.26, grade(b) - 0.36)),
      wall.p(wall.length, floor + 0.25, 0.06),
      wall.p(0, floor + 0.25, 0.06),
    ];
    face(out, 'stone', points, wall.normal, color);
  }
}

export function gable(out, start, end, width, y, rise, roof, gableSlot, wall, slot = 'tile') {
  const dx = end[0] - start[0],
    dz = end[1] - start[1],
    length = Math.hypot(dx, dz);
  const nx = -dz / length,
    nz = dx / length;
  const offset = (p, sign) => [p[0] + sign * width * nx, p[1] + sign * width * nz];
  const a = at(offset(start, -1), y),
    b = at(offset(end, -1), y),
    c = at(offset(end, 1), y),
    d = at(offset(start, 1), y);
  const ra = at(start, y + rise),
    rb = at(end, y + rise);
  face(out, slot, [a, b, rb, ra], [0, 1, 0], roof);
  face(out, slot, [ra, rb, c, d], [0, 1, 0], roof);
  face(out, gableSlot, [a, d, ra], [-dx, 0, -dz], wall);
  face(out, gableSlot, [c, b, rb], [dx, 0, dz], wall);
}

export function roofCap(out, slot, center, rings, corners, color) {
  const [x, z] = center;
  const points = ([y, r]) => corners.map(([u, v]) => [x + r * u, y, z + r * v]);
  for (const [a, b] of pairs(rings)) {
    const low = points(a),
      high = points(b);
    for (let i = 0; i < low.length; i++) {
      const j = (i + 1) % low.length;
      const normal = [corners[i][0] + corners[j][0], 0.35, corners[i][1] + corners[j][1]];
      face(
        out,
        slot,
        b[1] === 0 ? [low[i], low[j], high[i]] : [low[i], low[j], high[j], high[i]],
        normal,
        color,
      );
    }
  }
}
export const bevelSquare = [
  [-0.7, -1],
  [0.7, -1],
  [1, -0.7],
  [1, 0.7],
  [0.7, 1],
  [-0.7, 1],
  [-1, 0.7],
  [-1, -0.7],
];
export const square = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

export function crossAt(out, [x, y, z], height, span, color) {
  beam(out, 'metal', [x, y, z], [x, y + height, z], height * 0.055, height * 0.055, color);
  const crossY = y + height * 0.67;
  beam(
    out,
    'metal',
    [x, crossY, z - span / 2],
    [x, crossY, z + span / 2],
    height * 0.045,
    height * 0.045,
    color,
  );
}

export function pointed(out, lod, wall, u, base, shoulder, width, rise, colors) {
  const half = width / 2;
  panel(out, 'glass', wall, u - half, u + half, base, shoulder, 0.038, colors.glass);
  const cap = [
    [-1, 0],
    [-0.85, 0.44],
    [-0.52, 0.75],
    [0, 1],
    [0.52, 0.75],
    [0.85, 0.44],
    [1, 0],
  ];
  const p = ([x, y], extra, d) => wall.p(u + x * (half + extra), shoulder + y * (rise + extra), d);
  face(
    out,
    'glass',
    cap.map((q) => p(q, 0, 0.038)),
    wall.normal,
    colors.glass,
  );
  if (lod > 0) {
    for (const [a, b] of pairs(cap))
      face(
        out,
        'plaster',
        [p(a, 0, 0.055), p(b, 0, 0.055), p(b, 0.12, 0.079), p(a, 0.12, 0.079)],
        wall.normal,
        colors.trim,
      );
    for (const side of [-1, 1]) {
      const pos = u + side * (half + 0.055);
      panel(out, 'plaster', wall, pos - 0.055, pos + 0.055, base, shoulder, 0.078, colors.trim);
    }
  }
  if (lod > 1) {
    panel(
      out,
      'plaster',
      wall,
      u - 0.035,
      u + 0.035,
      base,
      shoulder + rise * 0.93,
      0.094,
      colors.trim,
    );
    if (lod > 2)
      for (const y of [base + (shoulder - base) * 0.39, shoulder - 0.05])
        panel(out, 'plaster', wall, u - half, u + half, y - 0.027, y + 0.027, 0.094, colors.trim);
  }
}

export const halfway = ([a, b]) => planarMid([a, b]);
export const between = (a, b, t) => a.map((n, i) => mix(n, b[i], t));

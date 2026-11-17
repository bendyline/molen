import { beam } from './authored-structure-mesh.mjs';
import {
  arch,
  block,
  face,
  mix,
  panel,
  pavilion,
  plane,
  surface,
} from './montreal-museum-pavilion-geometry.mjs';

export const materials = {
  brick: surface('wall', 'brick_flemish', 0.95),
  lime: surface('wall', 'plaster_lime', 0.93),
  trim: surface('trim', 'concrete_plain', 0.9),
  tile: surface('roof', 'tile_ceramic', 0.91),
  ridge: surface('trim', 'tile_flat', 0.91),
  stone: surface('foundation', 'stone_granite', 0.96),
  glazing: surface('window', 'window_punched', 0.58),
  door: surface('door', 'wood_plain', 0.88),
  metal: surface('trim', 'metal_painted', 0.75, 0.14),
};

export function bounds(outline) {
  const xs = outline.map(([x]) => x);
  const zs = outline.map(([, z]) => z);
  return [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
}

export function box(out, slot, [left, right, front, back], bottom, top, color) {
  block(out, slot, left, bottom, front, right - left, top - bottom, back - front, color);
}

export function around([left, right, front, back], margin) {
  return [left - margin, right + margin, front - margin, back + margin];
}

export function foundation(out, area, floor, grade, color) {
  const [left, right, front, back] = area;
  const low =
    Math.min(
      floor - 0.28,
      ...[left, right].flatMap((x) => [front, back].map((z) => grade([x, z]))),
    ) - 0.28;
  box(out, 'stone', around(area, 0.08), low, floor + 0.13, color);
}

export function sideWall(x, normal) {
  return { normal: [normal, 0, 0], p: (z, y, d = 0) => [x + normal * d, y, z] };
}

export function gabledRoof(out, lod, area, eave, rise, color, trimColor) {
  const [left, right, front, back] = area;
  const ridge = (front + back) / 2;
  const apex = eave + rise;
  const west = left - 0.25;
  const east = right + 0.25;
  const offset = 0.31;
  face(
    out,
    'tile',
    [
      [west, eave, front - offset],
      [east, eave, front - offset],
      [east, apex, ridge],
      [west, apex, ridge],
    ],
    [0, 1, -0.24],
    color,
  );
  face(
    out,
    'tile',
    [
      [west, apex, ridge],
      [east, apex, ridge],
      [east, eave, back + offset],
      [west, eave, back + offset],
    ],
    [0, 1, 0.24],
    color,
  );
  for (const x of [west, east]) {
    const facing = x === west ? -1 : 1;
    face(
      out,
      'ridge',
      [
        [x, eave - 0.2, front - offset],
        [x, eave - 0.2, back + offset],
        [x, apex - 0.12, ridge],
      ],
      [facing, 0, 0],
      trimColor,
    );
  }
  if (lod > 0) {
    block(
      out,
      'ridge',
      west - 0.06,
      apex - 0.078,
      ridge - 0.097,
      east - west + 0.12,
      0.16,
      0.194,
      trimColor,
    );
    for (const z of [front - offset, back + offset])
      block(out, 'ridge', west, eave - 0.12, z - 0.048, east - west, 0.12, 0.096, trimColor);
  }
  if (lod > 2)
    for (const x of [west, east])
      for (const z of [front - offset, back + offset]) {
        beam(out, 'ridge', [x, eave, z], [x, apex, ridge], 0.085, 0.11, trimColor);
      }
}

export function hippedRoof(out, lod, area, eave, rise, color, trimColor) {
  const [l, r, f, b] = around(area, 0.33);
  const center = (f + b) / 2;
  const inset = Math.min((r - l) * 0.31, (b - f) * 0.46);
  const a = [l + inset, eave + rise, center],
    c = [r - inset, eave + rise, center];
  const corners = [
    [l, eave, f],
    [r, eave, f],
    [r, eave, b],
    [l, eave, b],
  ];
  for (const points of [
    [corners[0], corners[1], c, a],
    [corners[1], corners[2], c],
    [corners[2], corners[3], a, c],
    [corners[3], corners[0], a],
  ]) {
    face(out, 'tile', points, [0, 1, 0], color);
  }
  if (lod > 0)
    box(
      out,
      'ridge',
      [a[0] - 0.08, c[0] + 0.08, center - 0.092, center + 0.092],
      a[1] - 0.08,
      a[1] + 0.08,
      trimColor,
    );
  if (lod > 2)
    for (const [i, p] of corners.entries())
      beam(out, 'ridge', p, i === 1 || i === 2 ? c : a, 0.07, 0.08, trimColor);
}

export function sash(out, lod, wall, x, low, high, width, colors) {
  const half = width / 2;
  panel(out, 'glazing', wall, x - half, x + half, low, high, 0.034, colors.glass);
  if (lod === 0) return;
  const trim = 0.073;
  for (const y of [low, high])
    panel(
      out,
      'trim',
      wall,
      x - half - trim,
      x + half + trim,
      y - trim,
      y + trim,
      0.052,
      colors.trim,
    );
  for (const u of [x - half, x + half])
    panel(out, 'trim', wall, u - trim, u + trim, low, high, 0.054, colors.trim);
  if (lod > 1) {
    panel(out, 'trim', wall, x - 0.027, x + 0.027, low, high, 0.061, colors.trim);
    panel(
      out,
      'trim',
      wall,
      x - half,
      x + half,
      (low + high) / 2 - 0.025,
      (low + high) / 2 + 0.025,
      0.061,
      colors.trim,
    );
  }
}

export function archedWindow(out, lod, wall, x, sill, spring, width, rise, colors) {
  const radius = width / 2;
  arch(
    out,
    wall,
    x,
    sill,
    spring,
    radius,
    rise,
    0.027,
    lod,
    { inner: colors.glass, trim: colors.trim, width: 0.095 },
    { inner: 'glazing', trim: 'trim' },
  );
  if (lod > 0)
    panel(
      out,
      'trim',
      wall,
      x - radius - 0.15,
      x + radius + 0.15,
      sill - 0.16,
      sill,
      0.085,
      colors.trim,
    );
  if (lod > 1) {
    for (const u of [x - width / 4, x, x + width / 4])
      panel(
        out,
        'metal',
        wall,
        u - 0.023,
        u + 0.023,
        sill,
        spring + rise * 0.74,
        0.05,
        colors.iron ?? colors.trim,
      );
    const rows = lod === 3 ? 4 : 2;
    for (let y = 1; y <= rows; y++) {
      const h = mix(sill, spring, y / (rows + 1));
      panel(
        out,
        'metal',
        wall,
        x - radius,
        x + radius,
        h - 0.023,
        h + 0.023,
        0.053,
        colors.iron ?? colors.trim,
      );
    }
  }
}

export function entryDoor(out, lod, wall, x, floor, width, height, colors) {
  const half = width / 2;
  panel(out, 'door', wall, x - half, x + half, floor + 0.04, floor + height, 0.045, colors.door);
  if (lod > 0) {
    for (const u of [x - half, x + half])
      panel(
        out,
        'trim',
        wall,
        u - 0.09,
        u + 0.09,
        floor,
        floor + height + 0.08,
        0.071,
        colors.trim,
      );
    panel(
      out,
      'trim',
      wall,
      x - half - 0.09,
      x + half + 0.09,
      floor + height,
      floor + height + 0.13,
      0.073,
      colors.trim,
    );
  }
}

export function rail(out, lod, [left, right], z, y, color) {
  block(out, 'metal', left, y + 0.86, z, right - left, 0.065, 0.06, color);
  if (lod > 0) block(out, 'metal', left, y + 0.43, z, right - left, 0.037, 0.046, color);
  const count = Math.ceil((right - left) / (lod > 1 ? 0.72 : 1.62));
  for (let i = 0; i <= count; i++) {
    const x = mix(left, right - 0.05, i / count);
    block(out, 'metal', x, y, z, 0.044, 0.89, 0.046, color);
  }
}

export function stair(out, lod, [left, right, front, back], lower, upper, palette) {
  const count = [4, 8, 12, 15][lod];
  const ascending = upper >= lower;
  const base = Math.min(lower, upper) - 0.2;
  for (let i = 0; i < count; i++) {
    const a = mix(front, back, i / count);
    const b = mix(front, back, (i + 1) / count);
    const height = mix(lower, upper, (i + (ascending ? 1 : 0)) / count);
    box(out, 'trim', [left, right, a, b], base, height, palette.trim);
  }
  if (lod > 0)
    for (const x of [left + 0.06, right - 0.06]) {
      beam(
        out,
        'metal',
        [x, lower + 0.88, front],
        [x, upper + 0.88, back],
        0.045,
        0.055,
        palette.iron,
      );
      for (const t of [0, 0.33, 0.68, 1])
        block(
          out,
          'metal',
          x - 0.025,
          mix(lower, upper, t),
          mix(front, back, t),
          0.05,
          0.89,
          0.045,
          palette.iron,
        );
    }
}

export function compoundModel(url, config, draw) {
  const surfaces = Object.fromEntries(config.slots.map((slot) => [slot, materials[slot]]));
  const bundle = pavilion(url, { ...config, surfaces }, draw);
  bundle.model.category = config.category;
  bundle.model.mediumFiContext.scale = config.scale;
  bundle.model.recipeDependencies.push('tai-tam-pumping-compound-geometry.mjs');
  bundle.model.sourceLicense =
    'Independent reconstruction from geospatial footprints, original Hong Kong survey ground and published factual heritage records.';
  return bundle;
}

export { block, face, mix, panel, plane };

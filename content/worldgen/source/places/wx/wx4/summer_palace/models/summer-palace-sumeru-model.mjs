import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  courtBay,
  courtRoof,
  face,
  frame,
  gold,
  indigo,
  levels,
  marble,
  red,
  roofs,
  solid,
  turquoise,
  up,
} from './summer-palace-model.mjs';

export const forms = new Set(['sumeru-entrance']);
export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  marble: { slot: 'trim', graph: 'stone_marble' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  enamel: { slot: 'trim', graph: 'metal_painted' },
};
const worn = [0.54, 0.52, 0.47];
const grey = [0.41, 0.39, 0.355];
const lacquer = [0.48, 0.122, 0.088];
const cobalt = [0.085, 0.216, 0.41];
const capGreen = [0.18, 0.334, 0.185];

function hippedRoof(out, w, d, y, h, detail) {
  if (detail > 0) {
    courtRoof(
      out,
      w,
      d,
      y,
      h,
      roofs.gold,
      detail === 2 ? 1 : detail,
      true,
      Math.min(h * 0.178, 0.37),
    );
  } else {
    const x = w / 2,
      z = d / 2;
    for (const sign of [-1, 1]) {
      face(
        out,
        'tile',
        [
          [-x, y, sign * z],
          [x, y, sign * z],
          [x * 0.82, y + h, 0],
          [-x * 0.82, y + h, 0],
        ],
        roofs.gold,
        up,
      );
      face(
        out,
        'tile',
        [
          [sign * x, y, -z],
          [sign * x, y, z],
          [sign * x * 0.82, y + h, 0],
        ],
        roofs.gold,
        [sign, 0.3, 0],
      );
    }
  }
  if (detail >= 1)
    for (const sign of [-1, 1])
      beam(
        out,
        'tile',
        [-w * 0.47, y - 0.04, sign * d * 0.505],
        [w * 0.47, y - 0.04, sign * d * 0.505],
        0.11,
        0.11,
        capGreen,
      );
}

function pedestal(out, x, z, y, width, detail) {
  const w = width / 2;
  box(out, 'stone', [x - w, y - 0.22, z - w], [x + w, y + 0.23, z + w], grey);
  const profiles =
    detail === 0
      ? [
          [0.23, 1],
          [0.78, 0.76],
        ]
      : [
          [0.23, 0.94],
          [0.47, 0.91],
          [0.53, 1],
          [0.65, 0.94],
          [0.71, 0.75],
          [0.78, 0.86],
        ];
  loft(
    out,
    'marble',
    profiles.map(([dy, s]) =>
      radialRing(y + dy, s * w, s * w, detail >= 2 ? 8 : 4, [x, z], Math.PI / 4),
    ),
    marble,
  );
}

function paintedBand(out, x, y, z, w, h, detail) {
  for (const side of [-1, 1]) {
    const edge = side * z;
    box(out, 'timber', [x - w / 2, y, edge - 0.07], [x + w / 2, y + h, edge + 0.07], cobalt);
    if (detail === 0) continue;
    const n = detail >= 2 ? Math.max(2, Math.round(w / 1.14)) : 2;
    const hx = w / n;
    for (let i = 0; i < n; i++) {
      const u = x - w / 2 + hx * (i + 0.5),
        v = y + h * 0.55;
      const a = [u - hx * 0.34, v, edge + side * 0.086],
        b = [u, v - h * 0.34, edge + side * 0.086],
        c = [u + hx * 0.34, v, edge + side * 0.086],
        d = [u, v + h * 0.34, edge + side * 0.086];
      face(out, 'timber', [a, b, c, d], turquoise, [0, 0, side]);
      if (detail < 3) continue;
      for (const [k, p] of [a, b, c, d].entries())
        beam(out, 'enamel', p, [a, b, c, d][(k + 1) % 4], 0.019, 0.024, gold);
    }
  }
}

function brackets(out, x, y, z, detail) {
  const count = detail >= 2 ? 4 : 1;
  for (let i = 0; i < count; i++) {
    const width = 0.36 + 0.11 * i,
      depth = 0.36 + 0.19 * i,
      v = y + 0.13 * i;
    box(
      out,
      'timber',
      [x - width / 2, v, z - depth / 2],
      [x + width / 2, v + 0.11, z + depth / 2],
      i % 2 ? turquoise : indigo,
    );
  }
}

function archway(out, gate, detail) {
  const { center, floor, toe, width } = gate;
  const local = frame(out, center, floor, 0);
  box(local, 'stone', [-width * 0.567, toe - floor, -1.5], [width * 0.567, 0, 1.5], worn);
  const posts = [-0.5, -0.173, 0.173, 0.5].map((t) => t * width);
  for (const [i, x] of posts.entries()) {
    pedestal(local, x, 0, 0, 0.91, detail);
    box(local, 'stone', [x - 0.47, toe - floor, -0.51], [x + 0.47, 0, 0.51], worn);
    beam(local, 'timber', [x, 0.76, 0], [x, i % 3 === 0 ? 6.22 : 7.52, 0], 0.36, 0.46, lacquer);
    if (detail >= 1) brackets(local, x, i % 3 === 0 ? 5.52 : 6.87, 0, detail);
  }
  for (const [x, w, y] of [
    [0, width * 1.06, 5.03],
    [0, width * 0.512, 6.14],
    [-width * 0.348, width * 0.26, 5.72],
    [width * 0.348, width * 0.26, 5.72],
  ]) {
    box(local, 'timber', [x - w / 2, y, -0.33], [x + w / 2, y + 0.32, 0.33], turquoise);
    if (detail > 0) paintedBand(local, x, y + 0.035, 0.34, w, 0.25, detail);
  }
  for (const [x, w, y, r, d] of [
    [0, 4.75, 8.13, 1.4, 2.04],
    [-width * 0.34, 3.62, 7.86, 0.98, 1.83],
    [width * 0.34, 3.62, 7.86, 0.98, 1.83],
    [-width * 0.54, 1.91, 6.68, 0.66, 1.33],
    [-width * 0.18, 1.87, 6.91, 0.63, 1.42],
    [width * 0.18, 1.87, 6.91, 0.63, 1.42],
    [width * 0.54, 1.91, 6.68, 0.66, 1.33],
  ]) {
    const body = frame(local, [x, 0], 0, 0);
    const base = w > 4 ? 6.43 : w > 2 ? 5.91 : 5.31;
    box(body, 'timber', [-w * 0.39, base, -d * 0.19], [w * 0.39, y + 0.06, d * 0.19], indigo);
    if (detail > 0)
      paintedBand(body, 0, base + 0.13, d * 0.2, w * 0.82, Math.min(0.47, y - base - 0.2), detail);
    if (detail > 0)
      for (const off of [-w * 0.32, 0, w * 0.32]) brackets(body, off, y - 0.39, 0, detail);
    hippedRoof(body, w, d, y, r, detail < 2 ? 0 : detail);
  }
  for (const say of [-1, 1]) {
    const z = say * 0.495;
    box(local, 'timber', [-1.06, 6.65, z - 0.08], [1.06, 7.31, z + 0.08], lacquer);
    box(local, 'marble', [-0.96, 6.72, z - 0.089], [0.96, 7.24, z + 0.089], marble);
    if (detail >= 2) {
      for (const x of [-0.45, 0.45]) {
        const pts = [
          [-0.16, 0.11],
          [0.14, 0.11],
          [0.14, -0.095],
          [-0.13, -0.095],
          [-0.13, 0.025],
          [0.102, 0.025],
        ];
        for (let i = 1; i < pts.length; i++) {
          const p = ([u, v]) => [x + u, 6.965 + v, z + say * 0.096];
          beam(local, 'timber', p(pts[i - 1]), p(pts[i]), 0.035, 0.026, lacquer);
        }
      }
    }
  }
}

function relief(out, room, detail) {
  const {
    frame: { center, angle, width: w, depth: d },
    floor,
    toe,
    outline,
  } = room;
  const body = frame(out, center, floor, angle);
  solid(out, 'stone', outline, toe, floor, worn);
  const bay = 5;
  for (const [level, scale, h] of [
    [0, 1, 3.32],
    [3.48, 0.85, 2.65],
  ]) {
    const width = w * scale,
      depth = d * scale;
    if (detail === 0)
      box(
        body,
        'plaster',
        [-width * 0.418, level, -depth * 0.38],
        [width * 0.418, level + h, depth * 0.38],
        red,
      );
    else
      courtBay(body, width, depth, level, h, bay, detail === 2 ? 1 : detail, {
        frontScreen: true,
        wall: true,
      });
    if (level > 0 && detail > 0) {
      const z = depth * 0.54;
      beam(
        body,
        'timber',
        [-width * 0.48, level + 0.77, z],
        [width * 0.48, level + 0.77, z],
        0.083,
        0.108,
        lacquer,
      );
      for (let i = 0; i <= bay * 2; i++) {
        const x = width * 0.48 * ((2 * i) / (bay * 2) - 1);
        beam(
          body,
          'timber',
          [x, level, z],
          [x, level + 0.78, z],
          0.075,
          0.073,
          i % 2 ? turquoise : lacquer,
        );
      }
      box(
        body,
        'timber',
        [-width * 0.54, level - 0.27, -depth * 0.52],
        [width * 0.54, level, depth * 0.54],
        cobalt,
      );
    }
    if (detail >= 2)
      paintedBand(body, 0, level + h - 0.16, depth * 0.42, width * 0.86, 0.22, detail);
    if (level > 0) hippedRoof(body, width * 1.09, depth * 1.27, level + h + 0.12, 1.56, detail);
  }
}

function pads(out, { center, width, depth, height, bottom }, detail) {
  const local = frame(out, center, height, 0);
  const w = width / 2,
    d = depth / 2;
  box(local, 'stone', [-w, bottom - height, -d], [w, 0, d], worn);
  if (detail > 0)
    box(local, 'marble', [-w - 0.11, -0.139, -d - 0.115], [w + 0.11, 0.015, d + 0.115], marble);
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 9; col++) {
      const x = w * 0.81 * (col / 4 - 1),
        z = d * 0.78 * ((2 * row) / 5 - 1),
        size = col === 4 && row % 3 === 0 ? 0.54 : 0.37;
      const top = detail < 2 ? 0.2 : 0.24;
      if (detail < 2)
        face(
          local,
          'stone',
          [
            [x - size, top, z - size],
            [x + size, top, z - size],
            [x + size, top, z + size],
            [x - size, top, z + size],
          ],
          grey,
          up,
        );
      else box(local, 'stone', [x - size, 0.016, z - size], [x + size, top, z + size], grey);
      if (detail >= 2)
        loft(
          local,
          'marble',
          [
            radialRing(top, size * 0.65, size * 0.65, detail >= 3 ? 10 : 6, [x, z]),
            radialRing(top + 0.31, size * 0.54, size * 0.54, detail >= 3 ? 10 : 6, [x, z]),
          ],
          marble,
        );
    }
}

function stair(out, { from, to, width, toe }, detail) {
  const [x, a, z] = from,
    [u, b, v] = to;
  const run = Math.hypot(u - x, v - z),
    rise = b - a,
    half = width / 2;
  const local = frame(out, [x, z], a, Math.atan2(x - u, v - z));
  const bottom = Math.min(toe - a, rise - 0.21, -0.21);
  if (detail === 0) {
    face(
      local,
      'stone',
      [
        [-half, 0, 0],
        [half, 0, 0],
        [half, rise, run],
        [-half, rise, run],
      ],
      worn,
      up,
    );
    for (const side of [-1, 1]) {
      const x = side * half;
      face(
        local,
        'stone',
        [
          [x, 0, 0],
          [x, rise, run],
          [x, bottom, run],
          [x, bottom, 0],
        ],
        worn,
        [side, 0, 0],
      );
    }
    return;
  }
  const n = Math.max(2, Math.ceil(Math.abs(rise) / (detail === 1 ? 0.29 : 0.16)));
  for (let i = 0; i < n; i++) {
    const high = (rise * (rise < 0 ? i : i + 1)) / n;
    box(local, 'stone', [-half, bottom, (run * i) / n], [half, high, (run * (i + 1)) / n], worn);
  }
  if (detail > 0)
    for (const side of [-1, 1]) {
      const u = side * (half - 0.16);
      beam(local, 'marble', [u, 0.055, 0], [u, rise + 0.055, run], 0.26, 0.15, marble);
    }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level],
    { arch, platform, stairs } = layout.sumeru;
  archway(out, arch, detail);
  for (const room of layout.sites.filter((s) => s.role.endsWith('-tower')))
    relief(out, room, detail);
  pads(out, platform, detail);
  for (const step of stairs) stair(out, step, detail);
}

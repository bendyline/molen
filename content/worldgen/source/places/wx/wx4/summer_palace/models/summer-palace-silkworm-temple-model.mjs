import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import { courtRoof, dark, face, frame, levels, red, up } from './summer-palace-model.mjs';

export const forms = new Set(['silkworm-temple']);
export const surfaces = {
  stone: { slot: 'foundation', graph: 'stone_ashlar' },
  limestone: { slot: 'foundation', graph: 'stone_limestone_weathered' },
  brick: { slot: 'wall', graph: 'brick_longformat' },
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  timber: { slot: 'trim', graph: 'wood_plain' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
};
const mortar = [0.47, 0.462, 0.42];
const slate = [0.264, 0.266, 0.246];
const cinnabar = [0.5, 0.163, 0.106];
const shadowRed = [0.25, 0.075, 0.051];
const sill = [0.635, 0.617, 0.548];

function enclosure(out, wall, detail) {
  const {
    from: [x, z],
    to: [u, v],
    grade,
    toe,
    height,
  } = wall;
  const length = Math.hypot(u - x, v - z);
  const local = frame(out, [(x + u) / 2, (z + v) / 2], grade, Math.atan2(v - z, u - x));
  const half = length / 2;
  box(local, 'stone', [-half, toe - grade, -0.31], [half, 0.33, 0.31], mortar);
  box(local, 'plaster', [-half, 0.33, -0.255], [half, height - 0.13, 0.255], cinnabar);
  box(
    local,
    'tile',
    [-half - 0.12, height - 0.14, -0.36],
    [half + 0.12, height + 0.058, 0.36],
    slate,
  );
  if (detail < 1) return;
  for (const side of [-1, 1]) {
    face(
      local,
      'tile',
      [
        [-half - 0.1, height + 0.14, 0],
        [half + 0.1, height + 0.14, 0],
        [half + 0.14, height - 0.02, side * 0.36],
        [-half - 0.14, height - 0.02, side * 0.36],
      ],
      slate,
      up,
    );
    if (detail >= 2) {
      const count = Math.ceil(length / (detail >= 3 ? 0.27 : 0.65));
      for (let i = 0; i <= count; i++) {
        const pos = length * (i / count - 0.5);
        beam(
          local,
          'tile',
          [pos, height + 0.14, 0],
          [pos, height - 0.02, side * 0.37],
          0.062,
          0.065,
          slate,
        );
      }
    }
  }
}

function gateway(out, gate, detail) {
  const local = frame(out, [0, 0], gate.floor, 0);
  const half = 2.04;
  const depth = 0.88;
  const radius = 0.79;
  const spring = 1.63;
  const top = 3.31;
  const foot = gate.toe - gate.floor;
  box(local, 'stone', [-half - 0.18, foot, -depth - 0.1], [half + 0.18, 0, depth + 0.31], sill);
  for (const side of [-1, 1]) {
    const x1 = side < 0 ? -half : radius;
    const x2 = side < 0 ? -radius : half;
    box(local, 'plaster', [x1, 0, -depth], [x2, spring, depth], cinnabar);
    const edge = radius * side;
    const outside = edge + side * 0.13;
    box(
      local,
      'brick',
      [Math.min(edge, outside), 0, depth - 0.02],
      [Math.max(edge, outside), spring, depth + 0.035],
      mortar,
    );
    if (detail >= 2) box(local, 'brick', [x1, 0.018, depth], [x2, 0.26, depth + 0.027], mortar);
  }
  const n = [5, 10, 14, 22, 28][detail];
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * i) / n;
    const b = (Math.PI * (i + 1)) / n;
    const [ax, ay] = [radius * Math.cos(a), spring + radius * Math.sin(a)];
    const [bx, by] = [radius * Math.cos(b), spring + radius * Math.sin(b)];
    for (const side of [-1, 1]) {
      const z = side * depth;
      const [outerA, outerB] = [a, b].map((t) => [
        (radius + 0.14) * Math.cos(t),
        spring + (radius + 0.14) * Math.sin(t),
        z + side * 0.025,
      ]);
      face(local, 'plaster', [outerA, outerB, [outerB[0], top, z], [outerA[0], top, z]], cinnabar, [
        0,
        0,
        side,
      ]);
      face(
        local,
        'brick',
        [[ax, ay, z + side * 0.025], [bx, by, z + side * 0.025], outerB, outerA],
        i % 3 === 0 ? sill : mortar,
        [0, 0, side],
      );
    }
    face(
      local,
      'brick',
      [
        [ax, ay, -depth],
        [bx, by, -depth],
        [bx, by, depth],
        [ax, ay, depth],
      ],
      mortar,
      [-Math.cos((a + b) / 2), -1, 0],
    );
    face(
      local,
      'timber',
      [
        [ax, ay, -0.56],
        [bx, by, -0.56],
        [bx, 0, -0.56],
        [ax, 0, -0.56],
      ],
      bx > 0 ? red : shadowRed,
      [0, 0, 1],
    );
  }
  for (const [x0, x1] of [
    [-half, -radius - 0.14],
    [radius + 0.14, half],
  ])
    box(local, 'plaster', [x0, spring, -depth], [x1, top, depth], cinnabar);
  for (const end of [-1, 1])
    box(
      local,
      'plaster',
      [Math.min(end * radius, end * (radius + 0.14)), spring, -0.86],
      [Math.max(end * radius, end * (radius + 0.14)), top, -0.82],
      cinnabar,
    );
  courtRoof(local, half * 2 + 0.6, depth * 2 + 0.64, top + 0.08, 0.86, slate, detail, true, 0.095);
  box(local, 'brick', [-0.5, 2.69, depth + 0.028], [0.5, 2.975, depth + 0.058], mortar);
  if (detail >= 2)
    for (const x of [-0.16, 0.16])
      beam(local, 'timber', [x, 1.07, -0.51], [x, 1.24, -0.51], 0.058, 0.027, dark);
}

function shrine(out, hall, detail) {
  const { center, width, depth, grade, toe } = hall;
  const local = frame(out, center, grade, 0);
  const x = width / 2;
  const z = depth / 2;
  box(local, 'stone', [-x - 0.25, toe - grade, -z - 0.24], [x + 0.25, 0.28, z + 0.46], sill);
  box(local, 'plaster', [-x, 0.28, -z], [x, 2.96, z - 0.36], shadowRed);
  const count = 3;
  for (let i = 0; i <= count; i++) {
    const u = width * (i / count - 0.5);
    beam(local, 'timber', [u, 0.28, z + 0.04], [u, 3.02, z + 0.04], 0.18, 0.18, red);
    if (i === count || detail < 1) continue;
    const left = u + 0.23;
    const right = u + width / count - 0.23;
    box(local, 'timber', [left, 0.45, z - 0.22], [right, 2.66, z - 0.14], red);
    box(local, 'timber', [left + 0.08, 1.47, z - 0.145], [right - 0.08, 2.51, z - 0.12], dark);
    if (detail >= 2) {
      for (let j = 1; j < 6; j++) {
        const u = left + ((right - left) * j) / 6;
        beam(local, 'timber', [u, 1.48, z - 0.09], [u, 2.5, z - 0.09], 0.043, 0.049, red);
      }
      for (const y of [1.75, 2.01, 2.27])
        beam(local, 'timber', [left, y, z - 0.082], [right, y, z - 0.082], 0.043, 0.049, red);
    }
  }
  courtRoof(local, width + 0.83, depth + 0.69, 3.13, 1.52, slate, detail, true, 0.18);
}

function rockery(out, { center, grade, size, seed }, detail) {
  const local = frame(out, center, grade, 0.22 * Math.sin(seed * 2.7));
  const [width, height, depth] = size;
  const palette = [
    [0.43, 0.419, 0.373],
    [0.51, 0.478, 0.406],
    [0.549, 0.521, 0.452],
    [0.46, 0.429, 0.368],
  ];
  const count = [1, 2, 3, 4, 5][detail];
  const sides = [5, 6, 7, 8, 9][detail];
  for (let i = 0; i < count; i++) {
    const y = (height * i) / count - 0.12;
    const radius = (1 - (i / count) * 0.33) * (0.91 + Math.sin(seed - i * 1.7) * 0.1);
    const shift = [Math.sin(seed + i * 0.8) * width * 0.1, Math.cos(seed - i) * depth * 0.105];
    const ring = (h, factor) =>
      radialRing(
        h,
        radius * width * factor,
        radius * depth * factor,
        sides,
        shift,
        seed * 0.24 + i * 0.21,
      ).map(([u, v, w], j) => {
        const variation = 0.99 + Math.sin(seed * 2 + j * 4 + i * 0.52) * 0.13;
        return [u * variation, v + Math.sin(seed + j * 4.3 + i) * 0.084, w * variation];
      });
    loft(
      local,
      'limestone',
      [
        ring(y, 0.48),
        ring(y + (height * 0.22) / count, 0.55),
        ring(y + (height * 1.16) / count, 0.46),
      ],
      palette[(i + seed) % palette.length],
    );
  }
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  const { gate, walls, hall, paving, rocks } = layout.silkwormTemple;
  gateway(out, gate, detail);
  shrine(out, hall, detail);
  for (const wall of walls) enclosure(out, wall, detail);
  for (const strip of paving)
    for (let i = 1; i < strip.length; i++)
      face(out, 'stone', [...strip[i - 1], ...strip[i].toReversed()], sill, up);
  for (const [i, rock] of rocks.entries())
    if (detail > 0 || i % 3 === 0) rockery(out, rock, detail);
}

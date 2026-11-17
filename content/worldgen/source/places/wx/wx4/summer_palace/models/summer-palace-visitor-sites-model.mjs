import {
  beam,
  loft,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import {
  courtBay,
  courtRoof,
  dark,
  face,
  frame,
  gold,
  indigo,
  levels,
  red,
  roofs,
  solid,
  turquoise,
  up,
} from './summer-palace-model.mjs';

export { surfaces } from './summer-palace-model.mjs';

export const forms = new Set(['new-entrance', 'picture-scroll']);

const greyStone = [0.485, 0.45, 0.391];
const buffStone = [0.584, 0.554, 0.49];
const roofTrim = [0.621, 0.337, 0.105];

function post(out, x, z, y, top, detail, size = 0.21) {
  if (detail <= 1) {
    beam(out, 'timber', [x, y, z], [x, top, z], size * 2, size * 2, red);
    return;
  }
  const n = detail === 2 ? 6 : 12;
  loft(
    out,
    'timber',
    [radialRing(y, size, size, n, [x, z]), radialRing(top, size * 0.91, size * 0.91, n, [x, z])],
    red,
    { cap: false },
  );
  box(out, 'stone', [x - size, y, z - size], [x + size, y + 0.12, z + size], buffStone);
}

function handrail(out, a, b, detail, lacquered = false) {
  const material = lacquered ? 'timber' : 'stone';
  const color = lacquered ? turquoise : buffStone;
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(1, Math.round(length / (detail >= 2 ? 0.84 : 1.62)));
  const point = (i, dy) => a.map((v, k) => v + ((b[k] - v) * i) / n + (k === 1 ? dy : 0));
  beam(out, material, point(0, 0.83), point(n, 0.83), 0.1, 0.096, color);
  if (detail === 0) return;
  for (let i = 0; i <= n; i++) {
    beam(out, material, point(i, 0), point(i, 0.86), 0.105, 0.107, color);
    if (lacquered && detail >= 2 && i < n)
      beam(out, material, point(i, 0.24), point(i + 1, 0.24), 0.1, 0.085, red);
  }
}

function roofApron(out, rings, detail) {
  loft(out, 'tile', rings, roofs.green, { cap: false });
  const edge = rings[0];
  for (const [i, a] of edge.entries()) {
    const b = edge[(i + 1) % edge.length];
    const lowA = [a[0], a[1] - 0.14, a[2]];
    const lowB = [b[0], b[1] - 0.14, b[2]];
    face(out, 'tile', [a, lowA, lowB, b], roofTrim, [a[0] + b[0], 0, a[2] + b[2]]);
    face(
      out,
      'timber',
      [lowA, lowB, [0, Math.min(...edge.map((p) => p[1])) - 0.15, 0]],
      dark,
      [0, -1, 0],
    );
    if (detail < 2 || i % 2) continue;
    for (let k = 1; k < rings.length; k++)
      beam(out, 'tile', rings[k - 1][i], rings[k][i], 0.145, 0.12, roofTrim);
    if (detail >= 3)
      beam(out, 'tile', a, [a[0] * 1.031, a[1] + 0.19, a[2] * 1.031], 0.12, 0.128, roofTrim);
  }
}

function octagonalPavilion(out, room, detail) {
  const { center, width, depth, angle } = room.frame;
  const body = frame(out, center, room.floor, angle);
  const ring = (height, scale) =>
    radialRing(height, scale * width * 0.5, scale * depth * 0.5, 8, [0, 0], Math.PI / 8);
  const floor = ring(0, 1);
  solid(
    body,
    'stone',
    floor.map(([x, , z]) => [x, z]),
    room.toe - room.floor,
    0,
    greyStone,
  );
  loft(body, 'stone', [ring(3.16, 0.91), ring(3.42, 0.97)], buffStone);
  for (const [deck, top, size] of [
    [0, 2.96, 0.82],
    [3.42, 6.22, 0.73],
  ]) {
    const posts = ring(deck, size);
    for (const [i, p] of posts.entries()) {
      if (detail === 0 && i % 2) continue;
      const [x, , z] = p,
        q = posts[(i + 1) % posts.length];
      post(body, x, z, deck, top, detail, 0.155);
      if (deck > 0 && detail > 0) handrail(body, p, q, detail, true);
      if (detail >= 1) {
        beam(body, 'timber', [x, top - 0.1, z], [q[0], top - 0.1, q[2]], 0.16, 0.39, indigo);
        if (detail >= 2) {
          beam(
            body,
            'timber',
            [x * 0.91, top + 0.19, z * 0.91],
            [x * 1.11, top + 0.19, z * 1.11],
            0.3,
            0.22,
            turquoise,
          );
          beam(body, 'enamel', [x, top - 0.24, z], [q[0], top - 0.24, q[2]], 0.08, 0.044, gold);
        }
      }
    }
  }
  for (const [height, rise, scale, tip] of [
    [3.03, 0.68, 1.06, 0.74],
    [6.36, 1.74, 0.98, 0.034],
  ]) {
    const intervals = detail === 0 ? [0, 1] : [0, 0.35, 0.71, 1];
    roofApron(
      body,
      intervals.map((t) => {
        const vertices = ring(height + rise * (0.51 * t + 0.49 * t * t), scale * (1 - t) + tip * t);
        return vertices.flatMap(([x, y, z], i) => {
          const q = vertices[(i + 1) % vertices.length];
          return [
            [x, y + (1 - t) * (tip > 0.1 ? 0.24 : 0.36), z],
            [(x + q[0]) / 2, y, (z + q[2]) / 2],
          ];
        });
      }),
      detail,
    );
  }
  loft(
    body,
    'enamel',
    [
      [8.01, 0.24],
      [8.23, 0.19],
      [8.42, 0.26],
      [8.62, 0.12],
      [8.66, 0.035],
    ].map(([y, radius]) => radialRing(y, radius, radius, detail >= 2 ? 12 : 6)),
    roofTrim,
  );
}

function wing(out, room, detail) {
  const { center, width: w, depth: d, angle } = room.frame;
  const body = frame(out, center, room.floor, angle);
  const isHall = room.role === 'picture-hall';
  solid(out, 'stone', room.outline, room.toe, room.floor, greyStone);
  const lower = isHall ? 3.52 : 2.8;
  if (detail > 0) {
    courtBay(body, w, d, 0, lower, 3, detail, { frontScreen: true, wall: true, plaque: isHall });
  } else {
    box(body, 'plaster', [-w * 0.42, 0, -d * 0.4], [w * 0.42, lower, d * 0.4], red);
  }
  const firstEave = lower + 0.25;
  const rise = isHall ? 1.63 : 0.84;
  hallRoof(body, w * 1.096, d * 1.13, firstEave, rise, detail, isHall);
  if (isHall) return;
  const upper = firstEave + 0.36;
  const uw = w * 0.78,
    ud = d * 0.73;
  if (detail > 0) {
    courtBay(body, uw, ud, upper, 2.25, 3, detail, { frontScreen: true, wall: true });
  } else {
    box(body, 'plaster', [-uw * 0.41, upper, -ud * 0.4], [uw * 0.41, upper + 2.24, ud * 0.4], red);
  }
  hallRoof(body, uw * 1.21, ud * 1.23, upper + 2.48, 1.38, detail, true);
}

function hallRoof(out, w, d, y, rise, detail, gabled) {
  if (detail > 0) {
    courtRoof(out, w, d, y, rise, roofs.green, detail, gabled, rise * 0.177);
    return;
  }
  const x = w * 0.5,
    z = d * 0.5,
    ridge = x * 0.76;
  for (const s of [-1, 1]) {
    face(
      out,
      'tile',
      [
        [-x, y, s * z],
        [x, y, s * z],
        [ridge, y + rise, 0],
        [-ridge, y + rise, 0],
      ],
      roofs.green,
      up,
    );
    face(
      out,
      'tile',
      [
        [s * x, y, z],
        [s * x, y, -z],
        [s * ridge, y + rise, 0],
      ],
      roofs.green,
      [s, 1, 0],
    );
  }
}

function hillsideWalk(out, { from, to, width, toe, covered }, detail) {
  const [x, y, z] = from,
    [u, v, w] = to;
  const length = Math.hypot(u - x, w - z),
    rise = v - y;
  const body = frame(out, [x, z], y, Math.atan2(x - u, w - z));
  const half = width / 2;
  const count = detail === 1 ? 5 : Math.max(2, Math.ceil(Math.abs(rise) / 0.2));
  const base = Math.min(toe - y, rise - 0.23, -0.23);
  if (detail === 0) {
    face(
      body,
      'stone',
      [
        [-half, 0, 0],
        [half, 0, 0],
        [half, rise, length],
        [-half, rise, length],
      ],
      buffStone,
      up,
    );
    for (const side of [-1, 1]) {
      const x = side * half;
      face(
        body,
        'stone',
        [
          [x, 0, 0],
          [x, rise, length],
          [x, base, length],
          [x, base, 0],
        ],
        greyStone,
        [side, 0, 0],
      );
    }
  }
  for (let i = 0; detail > 0 && i < count; i++) {
    const high = (rise * (rise > 0 ? i + 1 : i)) / count;
    box(
      body,
      'stone',
      [-half, base, (length * i) / count],
      [half, high, (length * (i + 1)) / count],
      buffStone,
    );
  }
  if (!covered) {
    for (const side of [-1, 1])
      handrail(body, [side * half, 0, 0], [side * half, rise, length], detail);
    return;
  }
  const bays = detail === 0 ? 1 : Math.max(2, Math.round(length / 2.8));
  const head = 2.42;
  for (let i = 0; i <= bays; i++) {
    for (const side of [-1, 1]) {
      const px = side * (half - 0.04),
        pz = (length * i) / bays,
        py = (rise * i) / bays;
      post(body, px, pz, py, py + head, detail, 0.098);
      if (i < bays && detail > 1) {
        const next = [px, py + rise / bays, pz + length / bays];
        handrail(body, [px, py, pz], next, detail, true);
      }
    }
  }
  const overhang = half + 0.36;
  for (const sign of [-1, 1]) {
    const roof = [
      [0, head + 0.68, -0.2],
      [overhang * sign, head, -0.25],
      [overhang * sign, head + rise, length + 0.25],
      [0, head + rise + 0.68, length + 0.2],
    ];
    const soffit = roof.map(([x, y, z]) => [x, y - 0.12, z]);
    face(body, 'tile', roof, roofs.green, up);
    face(body, 'timber', soffit, dark, [0, -1, 0]);
    for (const [a, b, normal] of [
      [0, 1, [0, 0, -1]],
      [1, 2, [sign, 0, 0]],
      [2, 3, [0, 0, 1]],
    ])
      face(body, 'timber', [roof[a], roof[b], soffit[b], soffit[a]], dark, normal);
    if (detail > 0)
      beam(
        body,
        'tile',
        [overhang * sign, head, -0.25],
        [overhang * sign, head + rise, length + 0.25],
        0.12,
        0.12,
        roofTrim,
      );
  }
  beam(
    body,
    'tile',
    [0, head + 0.68, -0.2],
    [0, head + rise + 0.68, length + 0.2],
    0.12,
    0.13,
    roofTrim,
  );
}

function stoneArch(out, { center, floor, toe }, detail) {
  const body = frame(out, center, floor, 0);
  for (const x of [-1.56, 1.56]) {
    box(body, 'stone', [x - 0.36, toe - floor, -0.4], [x + 0.36, 0.16, 0.4], greyStone);
    box(body, 'marble', [x - 0.18, 0.16, -0.21], [x + 0.18, 3.52, 0.21], buffStone);
    if (detail > 0) box(body, 'marble', [x - 0.28, 2.77, -0.28], [x + 0.28, 2.97, 0.28], buffStone);
  }
  box(body, 'marble', [-1.83, 2.77, -0.23], [1.83, 3.15, 0.23], buffStone);
  box(body, 'marble', [-1.15, 3.14, -0.19], [1.15, 3.57, 0.19], buffStone);
  if (detail === 0) box(body, 'tile', [-1.28, 3.57, -0.42], [1.28, 3.73, 0.42], roofs.grey);
  else courtRoof(body, 2.56, 0.91, 3.58, 0.55, roofs.grey, Math.min(detail, 2), false, 0.094);
}

function pictureScroll(out, layout, detail) {
  const { walks, arch } = layout.pictureScroll;
  for (const room of layout.sites) {
    if (room.role === 'chenghui-pavilion') octagonalPavilion(out, room, detail);
    else wing(out, room, detail);
  }
  for (const walk of walks) hillsideWalk(out, walk, detail);
  stoneArch(out, arch, detail);
}

function gateWing(out, side, toe, detail) {
  const local = frame(out, [side * 6.43, 0], 0, 0);
  const outer = side * 1.74,
    opening = side * 0.47;
  box(local, 'stone', [-1.74, 2.36, -0.95], [1.74, 3.23, 1.0], greyStone);
  box(
    local,
    'stone',
    [Math.min(outer, opening), toe, -0.95],
    [Math.max(outer, opening), 2.36, 1.0],
    greyStone,
  );
  box(
    local,
    'stone',
    [side * -1.52 - 0.22, toe, -0.95],
    [side * -1.52 + 0.22, 2.36, 1.0],
    greyStone,
  );
  box(local, 'tile', [-1.8, 3.2, -1.06], [1.8, 3.38, 1.11], roofs.grey);
  if (side > 0) box(local, 'timber', [-1.3, 0, 0.08], [0.47, 2.36, 0.22], red);
  if (detail >= 2) {
    for (const x of [side * -1.33, opening])
      beam(local, 'timber', [x, 0.03, 0.93], [x, 2.42, 0.93], 0.105, 0.135, red);
    beam(
      local,
      'timber',
      [Math.min(side * -1.33, opening), 2.35, 0.93],
      [Math.max(side * -1.33, opening), 2.35, 0.93],
      0.12,
      0.12,
      red,
    );
    for (const y of [2.54, 2.82, 3.07])
      beam(local, 'stone', [-1.7, y, 1.02], [1.7, y, 1.02], 0.047, 0.049, buffStone);
  }
}

function accessibleGate(out, { grade, toe, aprons }, detail) {
  const body = frame(out, [0, 0], grade, 0);
  box(body, 'stone', [-4.7, toe, -1.87], [4.7, 0, 1.87], buffStone);
  for (const { z, surface } of aprons) {
    const side = Math.sign(z),
      edge = side * 1.87;
    const a = [-4.65, 0, edge],
      b = [4.65, 0, edge];
    const c = [4.65, surface, z],
      d = [-4.65, surface, z];
    face(body, 'stone', [a, b, c, d], buffStone, up);
    for (const sign of [-1, 1]) {
      const x = sign * 4.65;
      face(
        body,
        'stone',
        [
          [x, 0, edge],
          [x, surface, z],
          [x, toe, z],
          [x, toe, edge],
        ],
        greyStone,
        [sign, 0, 0],
      );
      if (detail > 0) handrail(body, [x, 0, edge], [x, surface, z], detail);
    }
  }
  const lintel = 2.88;
  for (const side of [-1, 1]) {
    const z = side * 1.6;
    beam(body, 'timber', [-4.57, lintel, z], [4.57, lintel, z], 0.24, 0.34, dark);
    for (const x of [-4.53, -1.49, 1.49, 4.53]) {
      post(body, x, z, 0, lintel, detail, 0.158);
      if (detail >= 2)
        beam(
          body,
          'timber',
          [x, lintel + 0.16, z - 0.27],
          [x, lintel + 0.16, z + 0.27],
          0.37,
          0.18,
          turquoise,
        );
    }
  }
  for (const side of [-1, 1]) {
    const x = side * 2.95;
    box(body, 'timber', [x - 1.24, 0, -0.93], [x + 1.24, 0.91, 0.96], dark);
    for (const sign of [-1, 1]) {
      const z = sign * 0.93;
      box(
        body,
        'glass',
        [x - 1.24, 0.94, z - 0.039],
        [x + 1.24, 2.45, z + 0.039],
        [0.28, 0.286, 0.273],
      );
      if (detail >= 2)
        for (const dx of [-1.24, 0, 1.24])
          beam(body, 'timber', [x + dx, 0.91, z], [x + dx, 2.51, z], 0.115, 0.09, dark);
    }
    gateWing(body, side, toe, detail);
  }
  if (detail > 0) {
    box(body, 'enamel', [-0.82, 2.62, 1.8], [0.82, 2.91, 1.9], gold);
    box(body, 'timber', [-0.76, 2.664, 1.893], [0.76, 2.86, 1.94], indigo);
  }
  courtRoof(body, 9.72, 4.68, 3.16, 1.25, roofs.grey, detail, true, 0.22);
}

export function buildSummerPalaceMember(out, layout, level) {
  const detail = levels[level];
  if (layout.form === 'new-entrance') accessibleGate(out, layout.visitorGate, detail);
  else pictureScroll(out, layout, detail);
}

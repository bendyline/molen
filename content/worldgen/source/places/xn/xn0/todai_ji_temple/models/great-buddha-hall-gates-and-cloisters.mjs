import { beam } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  extrude,
  facade,
  fbox,
  lathe,
  quad4,
  rgb,
  tri,
} from '../../../../../../../../packages/worldgen/scripts/place-recipe-kit.mjs';
import { cap } from '../../../../r1/r1f/adelaide_railway_station/models/classical.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  wood: { slot: 'wall', graph: 'wood_plain', roughness: 0.95 },
  bracket: { slot: 'trim', graph: 'wood_vertical', roughness: 0.95 },
  plaster: { slot: 'wall', graph: 'plaster_lime', roughness: 0.97 },
  tile: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.91 },
  stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.95 },
  bronze: { slot: 'trim', graph: 'metal_copper', roughness: 0.88 },
};

const F = facade(site.frame.origin, site.frame.along);
const p = F.P;
const xz = ([x, , z]) => [x, z];
const ash = rgb('a39880');
const limestone = rgb('b6b5a0');
const brick = rgb('a29c86');
const oak = rgb('635447');
const wood = rgb('4a3d35');
const burnt = rgb('704235');
const umber = rgb('75665b');
const pale = rgb('b9b4a0');
const slate = rgb('52565d');
const lead = rgb('696c70');
const gold = rgb('d4ad4f');
const bellGreen = rgb('566654');

const center = ([a, b, c, d]) => [(a + c) / 2, (b + d) / 2];
const mix = (a, b, t) => a + (b - a) * t;
const panel = (out, slot, frame, u, U, y, Y, d, c) =>
  quad4(out, slot, frame.P(u, y, d), frame.P(U, y, d), frame.P(U, Y, d), frame.P(u, Y, d), c);

function pad(out, ring, g, y, tint = ash) {
  extrude(out, 'stone', ring, g, y, tint, { top: false });
  cap(out, 'stone', ring, y, tint);
}

function hip(
  out,
  frame,
  w,
  d,
  eave,
  rise,
  detail,
  { curl = 0.89, ridge = 0.72, broad = 0.14 } = {},
) {
  const levels = [1, 2, 4, 6][detail],
    across = [1, 2, 4, 6][detail];
  const rows = Array.from({ length: levels + 1 }, (_, j) => {
    const t = j / levels;
    const a = mix(w, ridge * w, t),
      b = mix(d, broad * d, t);
    const corners = [
      [-a, b],
      [a, b],
      [a, -b],
      [-a, -b],
    ];
    return corners.flatMap((corner, i) =>
      Array.from({ length: across }, (_, k) => {
        const f = k / across;
        const end = corners[(i + 1) % 4];
        const y =
          eave + rise * Math.pow(t, 1.62) + (1 - t) * curl * Math.pow(Math.abs(f * 2 - 1), 3.2);
        return frame.P(mix(corner[0], end[0], f), y, mix(corner[1], end[1], f));
      }),
    );
  });
  for (let j = 1; j < rows.length; j++) {
    const a = rows[j - 1],
      b = rows[j];
    for (let i = 0; i < a.length; i++) {
      const k = (i + 1) % a.length;
      tri(out, 'tile', a[i], a[k], b[k], slate);
      tri(out, 'tile', a[i], b[k], b[i], slate);
    }
  }
  const top = rows.at(-1),
    hub = frame.P(0, eave + rise + 0.1, 0);
  for (let i = 0; i < top.length; i++)
    tri(out, 'tile', top[i], top[(i + 1) % top.length], hub, lead);
  if (detail === 0) return;
  const lip = rows[0];
  for (const [i, a] of lip.entries()) {
    const b = lip[(i + 1) % lip.length];
    const low = ([x, y, z]) => [x, y - 0.2, z];
    quad4(out, 'tile', a, low(a), low(b), b, lead);
    const u = mix(a[0], hub[0], 0.14),
      v = mix(a[2], hub[2], 0.14);
    const U = mix(b[0], hub[0], 0.14),
      V = mix(b[2], hub[2], 0.14);
    const innerA = [u, eave - 0.35, v],
      innerB = [U, eave - 0.35, V];
    tri(out, 'wood', low(b), low(a), innerA, oak);
    tri(out, 'wood', low(b), innerA, innerB, oak);
  }
  beam(
    out,
    'tile',
    frame.P(-w * ridge, eave + rise + 0.2, 0),
    frame.P(w * ridge, eave + rise + 0.2, 0),
    0.45,
    0.36,
    lead,
  );
}

function posts(out, frame, x, y, Y, d, detail, color, width = 0.62) {
  if (detail < 2) fbox(out, 'wood', frame, x - width, x + width, y, Y, d - width, d + width, color);
  else {
    lathe(
      out,
      'wood',
      xz(frame.P(x, 0, d)),
      [
        [y, width, width],
        [Y, width * 0.91, width * 0.91],
      ],
      detail === 3 ? 12 : 8,
      color,
      { capTop: false },
    );
    fbox(
      out,
      'stone',
      frame,
      x - width * 1.04,
      x + width * 1.04,
      y - 0.045,
      y + 0.28,
      d - width * 1.04,
      d + width * 1.04,
      brick,
    );
  }
}

function bracket(out, f, u, y, d, c, detail) {
  for (let i = 0, n = detail === 3 ? 4 : 2; i < n; i++) {
    const k = 0.41 + i * 0.16,
      z = 0.57 + i * 0.22;
    fbox(
      out,
      'bracket',
      f,
      u - k,
      u + k,
      y + i * 0.41,
      y + i * 0.41 + 0.42,
      d - z * 0.42,
      d + z,
      c,
    );
  }
}

function steps(out, f, w, g, Y, d, detail) {
  const n = [2, 3, 5, 7][detail];
  for (let i = 0; i < n; i++) {
    const t = i / n;
    fbox(
      out,
      'stone',
      f,
      -w,
      w,
      g - 0.44,
      mix(g, Y, (i + 1) / n),
      d - 0.53,
      d + (1 - t) * 2.84,
      limestone,
    );
  }
}

function goldTail(out, frame, u, ridge, top, side, detail) {
  const n = [2, 4, 7, 9][detail];
  const p = (t) =>
    frame.P(
      u + side * (Math.sin(t * Math.PI * 0.85) * 1.57 - 0.37 * t),
      mix(ridge, top - 0.15, t),
      0.14 + Math.sin(t * 0.7) * 0.18,
    );
  for (let i = 0; i < n; i++) {
    const t = i / n;
    beam(out, 'bronze', p(t), p((i + 1) / n), mix(0.48, 0.2, t), mix(0.63, 0.2, t), gold);
  }
}

function karahafu(out, f, g, d, detail) {
  const n = [4, 6, 10, 16][detail],
    w = 9.56;
  const y = (t) =>
    g + 20.28 + 3.12 * (0.5 + 0.38 * Math.cos(t * Math.PI) + 0.12 * Math.cos(2 * t * Math.PI));
  for (let i = 0; i < n; i++) {
    const a = (2 * i) / n - 1,
      b = (2 * (i + 1)) / n - 1;
    const A = f.P(a * w, y(a), d),
      B = f.P(b * w, y(b), d);
    quad4(
      out,
      'tile',
      A,
      B,
      f.P(b * w, y(b) + 0.48, d - 4.07),
      f.P(a * w, y(a) + 0.48, d - 4.07),
      slate,
    );
    quad4(
      out,
      'bracket',
      f.P(a * w, y(a) - 0.31, d + 0.024),
      f.P(b * w, y(b) - 0.31, d + 0.024),
      B,
      A,
      gold,
    );
    quad4(
      out,
      'wood',
      f.P(a * w, g + 18.78, d - 0.04),
      f.P(b * w, g + 18.78, d - 0.04),
      B,
      A,
      wood,
    );
  }
}

function hall(out, part, detail) {
  const [a, b, c, d] = part.box,
    [u, v] = center(part.box);
  const f = facade(xz(p(u, 0, v)), F.along),
    g = part.grade;
  const W = (c - a) / 2,
    D = (d - b) / 2;
  pad(out, site.cutouts[0], g - 5.41, g - 0.46);
  fbox(out, 'stone', f, -W + 2.54, W - 2.54, g - 0.48, g + 1.52, -D + 3.71, D - 4.24, ash);
  steps(out, f, 11.67, g - 0.45, g + 1.54, D - 4.3, detail);
  hip(out, f, W, D, g + 20.01, 7.89, detail, { curl: 1.44, ridge: 0.77, broad: 0.19 });
  hip(out, f, W * 0.91, D * 0.78, g + 31.74, 12.55, detail, {
    curl: 1.53,
    ridge: 0.64,
    broad: 0.116,
  });
  const ridge = g + 44.29;
  goldTail(out, f, -W * 0.91 * 0.64, ridge, g + part.height, -1, detail);
  goldTail(out, f, W * 0.91 * 0.64, ridge, g + part.height, 1, detail);
  karahafu(out, f, g, D + 0.21, detail);
  const front = D - 5.68,
    rear = -D + 4.86,
    side = W - 5.99;
  fbox(out, 'wood', f, -side, side, g + 1.52, g + 20.37, rear, front - 7.4, wood);
  fbox(out, 'wood', f, -side, side, g + 19.36, g + 20.54, rear, front + 0.08, oak);
  fbox(
    out,
    'wood',
    f,
    -side * 0.91,
    side * 0.91,
    g + 20.51,
    g + 25.5,
    rear * 0.79,
    front * 0.79,
    wood,
  );
  fbox(
    out,
    'plaster',
    f,
    -side * 0.91,
    side * 0.91,
    g + 25.37,
    g + 33.1,
    rear * 0.79,
    front * 0.79,
    pale,
  );
  for (const [sx, z] of [
    [1, front],
    [-1, rear],
  ]) {
    const wall = facade(
      xz(f.P(0, 0, z)),
      F.along.map((v) => v * sx),
    );
    const count = [4, 8, 10, 10][detail],
      span = (side * 2) / count;
    for (let i = 0; i <= count; i++) {
      const x = i * span - side;
      posts(out, wall, x, g + 1.51, g + 19.51, 0, detail, wood, 0.51);
      if (i === count) continue;
      const inBay = x + span * 0.5;
      if (Math.abs(inBay) > span * 0.75) {
        fbox(out, 'wood', wall, x + 0.55, x + span - 0.55, g + 1.52, g + 13.19, -0.5, -0.03, oak);
      }
      panel(out, 'plaster', wall, x + 0.52, x + span - 0.52, g + 14.07, g + 18.25, -0.08, pale);
      if (detail > 0) {
        const ridgeRow = (y, a, b) =>
          fbox(out, 'bracket', wall, x + 0.071, x + span - 0.063, y, y + 0.27, a, b, oak);
        if (detail > 1) ridgeRow(g + 14.22, 0, 0.36);
        ridgeRow(g + 16.11, 0.168, 0.67);
        ridgeRow(g + 18.22, 0.31, 0.88);
        if (detail > 1) bracket(out, wall, x, g + 17.92, 0, wood, detail);
        if (detail > 1 && Math.abs(inBay) > span * 0.75)
          for (let j = 0; j < 5; j++) {
            const u = x + (span * (j + 1)) / 6;
            fbox(
              out,
              'bracket',
              wall,
              u - 0.073,
              u + 0.076,
              g + 8.14,
              g + 12.77,
              -0.04,
              0.19,
              wood,
            );
          }
      }
    }
    const high = facade(xz(f.P(0, 0, z * 0.79)), wall.along);
    for (let i = 0, n = detail === 0 ? 4 : 8; i <= n; i++) {
      const x = side * 0.9 * ((2 * i) / n - 1);
      posts(out, high, x, g + 25.4, g + 32.1, 0.055, Math.min(detail, 1), wood, 0.3);
      if (detail > 1) bracket(out, high, x, g + 29.99, 0, wood, detail);
    }
  }
  for (const s of [-1, 1]) {
    const face = facade(
      xz(f.P(s * side, 0, 0)),
      F.normal.map((v) => -s * v),
    );
    for (let i = 0, n = detail === 0 ? 3 : 6; i <= n; i++) {
      const u = (front - 6.95) * ((2 * i) / n - 1);
      posts(out, face, u, g + 1.52, g + 20.52, 0, Math.min(detail, 2), wood, 0.47);
      if (detail > 0 && i < n)
        panel(
          out,
          'plaster',
          face,
          u + 0.53,
          u + ((front - 6.95) * 2) / n - 0.49,
          g + 13.62,
          g + 18.11,
          0.031,
          pale,
        );
    }
  }
}

function gate(out, part, detail) {
  const [a, b, c, d] = part.box,
    [u, v] = center(part.box),
    g = part.grade;
  const f = facade(xz(p(u, 0, v)), F.along),
    W = (c - a) / 2,
    D = (d - b) / 2;
  const large = part.role === 'south',
    middle = part.role === 'middle';
  const h = part.height,
    n = large ? 5 : middle ? 5 : 3;
  const r = large ? oak : middle ? burnt : wood;
  const ground = large ? site.cutouts[2] : middle ? site.cutouts[1] : part.outline;
  pad(out, ground, g - 3.59, g + 0.45);
  if (large || middle) steps(out, f, W * 0.47, g + 0.46, g + 1.05, D - 2.42, detail);
  const span = (1.62 * W) / n;
  for (const side of [-1, 1]) {
    const z = side * D * 0.65;
    for (let i = 0; i <= n; i++) {
      const x = (i - n / 2) * span;
      posts(out, f, x, g + 0.43, g + h * 0.52, z, detail, r, large ? 0.53 : 0.35);
      if (i === n) continue;
      if (i === 0 || i === n - 1)
        fbox(
          out,
          'wood',
          f,
          x + 0.42,
          x + span - 0.42,
          g + 0.46,
          g + h * 0.38,
          z - 0.44,
          z + 0.443,
          r,
        );
      if (detail > 0) {
        fbox(
          out,
          'plaster',
          f,
          x + 0.39,
          x + span - 0.39,
          g + h * 0.4,
          g + h * 0.5,
          z - 0.25,
          z + 0.26,
          pale,
        );
        if (detail > 1) bracket(out, f, x, g + h * 0.45, z, r, detail);
      }
    }
    if (detail > 0) {
      for (const y of detail === 1
        ? [h * 0.45, h * 0.52, h * 0.75]
        : [h * 0.37, h * 0.45, h * 0.52, h * 0.69, h * 0.75]) {
        fbox(out, 'bracket', f, -W * 0.87, W * 0.87, g + y, g + y + 0.25, z - 0.29, z + 0.28, r);
      }
    }
  }
  const lower = g + h * (large ? 0.51 : 0.62),
    upper = g + h * (large ? 0.77 : 0.78);
  const roofDetail = detail === 1 ? 0 : detail;
  hip(out, f, W, D, lower, h * 0.177, roofDetail, { curl: large ? 1.08 : 0.62 });
  fbox(out, 'wood', f, -W * 0.74, W * 0.74, lower + 0.38, upper + 0.16, -D * 0.53, D * 0.53, r);
  if (detail > 0) {
    for (const s of [-1, 1]) {
      const z = s * D * 0.54;
      panel(out, 'plaster', f, -W * 0.68, W * 0.68, lower + h * 0.136, upper - 0.36, z, pale);
      if (detail > 1) {
        const along = facade(
          xz(f.P(0, 0, z)),
          F.along.map((v) => v * s),
        );
        for (let i = 0; i <= n; i++)
          bracket(out, along, (i - n / 2) * span * 0.85, upper - 0.88, 0, r, detail);
      }
    }
  }
  hip(out, f, W * (large ? 1.018 : 0.94), D * 0.91, upper, h * 0.22, roofDetail, {
    curl: large ? 1.08 : 0.83,
    ridge: 0.74,
  });
}

function bell(out, part, detail) {
  const [a, b, c, d] = part.box,
    [x, z] = center(part.box),
    g = part.grade;
  const f = facade(xz(p(x, 0, z)), F.along),
    W = (c - a) / 2,
    D = (d - b) / 2;
  pad(out, site.cutouts[3], g - 3.65, g + 0.62, brick);
  steps(out, f, 2.19, g - 0.23, g + 0.68, D - 1.77, detail);
  for (const u of [-W * 0.54, W * 0.54])
    for (const v of [-D * 0.53, D * 0.53]) {
      posts(out, f, u, g + 0.64, g + 10.12, v, detail, wood, 0.42);
      if (detail > 0) bracket(out, f, u, g + 7.89, v, oak, detail);
    }
  for (const s of [-1, 1]) {
    const d = s * D * 0.53;
    fbox(out, 'bracket', f, -W * 0.62, W * 0.62, g + 5.98, g + 6.56, d - 0.36, d + 0.36, wood);
    fbox(out, 'bracket', f, -W * 0.62, W * 0.62, g + 8.25, g + 9.39, d - 0.47, d + 0.49, oak);
  }
  hip(out, f, W, D, g + 9.21, part.height - 9.21, detail, { curl: 1.35, ridge: 0.15, broad: 0.62 });
  const ring = xz(f.P(0, 0, 0)),
    n = [6, 10, 16, 24][detail];
  lathe(
    out,
    'bronze',
    ring,
    [
      [g + 2.68, 1.73, 1.73],
      [g + 2.93, 1.8, 1.8],
      [g + 4.6, 1.6, 1.6],
      [g + 6.68, 1.27, 1.27],
      [g + 6.91, 0.77, 0.77],
      [g + 7.16, 0.21, 0.21],
    ],
    n,
    bellGreen,
    { capBottom: false },
  );
  if (detail > 1) {
    lathe(
      out,
      'bronze',
      ring,
      [
        [g + 3.12, 1.81, 1.81],
        [g + 3.25, 1.81, 1.81],
      ],
      n,
      lead,
      { capTop: false },
    );
    beam(out, 'bracket', f.P(-3.28, g + 4.1, -0.57), f.P(-1.14, g + 3.74, -0.62), 0.29, 0.32, oak);
  }
}

function cloister(out, part, detail) {
  const g = part.grade;
  pad(out, part.outline, g - 1.96, g + 0.26, brick);
  for (const [a, b, c, d] of part.ranges) {
    const length = c - a,
      depth = d - b;
    const [x, z] = center([a, b, c, d]);
    const long = length > depth;
    const f = facade(xz(p(x, 0, z)), long ? F.along : F.normal);
    const W = Math.max(length, depth) / 2,
      D = Math.min(length, depth) / 2;
    const outer = (long ? z > 110 : x < site.parts[0].box[2] / 2) ? 1 : -1;
    hip(out, f, W, D, g + 4.71, part.height - 4.71, Math.max(0, detail - 1), {
      curl: 0.38,
      ridge: 0.88,
    });
    const z0 = D * 0.63 * outer;
    fbox(out, 'plaster', f, -W + 0.19, W - 0.18, g + 0.26, g + 3.86, z0 - 0.21, z0 + 0.24, pale);
    const spans = detail === 0 ? 3 : Math.max(2, Math.ceil((2 * W) / (detail === 1 ? 11.5 : 4.87)));
    for (let i = 0; i <= spans; i++) {
      const u = mix(-W + 0.31, W - 0.34, i / spans);
      fbox(out, 'wood', f, u - 0.16, u + 0.17, g + 0.25, g + 4.52, -z0 - 0.16, -z0 + 0.17, wood);
      if (detail > 1) bracket(out, f, u, g + 3.98, -z0, wood, detail);
    }
    if (detail > 0)
      fbox(out, 'bracket', f, -W + 0.2, W - 0.21, g + 4.13, g + 4.5, -z0 - 0.19, -z0 + 0.18, oak);
  }
}

function build(out, detail) {
  for (const part of site.parts) {
    switch (part.role) {
      case 'hall':
        hall(out, part, detail);
        break;
      case 'bell':
        bell(out, part, detail);
        break;
      case 'cloister':
        cloister(out, part, detail);
        break;
      default:
        gate(out, part, detail);
    }
  }
}

export function buildSkyline(out) {
  for (const part of site.parts) {
    const { role, grade: g, height: h, box, ranges } = part;
    const [a, b, c, d] = box;
    const [u, v] = center(box);
    const f = facade(xz(p(u, 0, v)), F.along);
    const W = (c - a) / 2,
      D = (d - b) / 2;
    if (role === 'hall') {
      pad(out, site.cutouts[0], g - 5.41, g - 0.46);
      fbox(out, 'stone', f, -W + 2.54, W - 2.54, g - 0.48, g + 1.52, -D + 3.71, D - 4.24, ash);
      fbox(out, 'wood', f, -W + 5.99, W - 5.99, g + 1.51, g + 20.37, -D + 4.86, D - 12.93, wood);
      fbox(out, 'wood', f, -W * 0.76, W * 0.76, g + 20.51, g + 25.5, -D * 0.67, D * 0.67, wood);
      fbox(out, 'plaster', f, -W * 0.76, W * 0.76, g + 25.37, g + 33.1, -D * 0.67, D * 0.67, pale);
      hip(out, f, W, D, g + 20.01, 7.89, 0, { curl: 1.44, ridge: 0.77, broad: 0.19 });
      hip(out, f, W * 0.91, D * 0.78, g + 31.74, 12.55, 0, {
        curl: 1.53,
        ridge: 0.64,
        broad: 0.116,
      });
      for (const s of [-1, 1]) goldTail(out, f, s * W * 0.91 * 0.64, g + 44.29, g + h, s, 0);
      karahafu(out, f, g, D + 0.21, 0);
      continue;
    }
    if (role === 'cloister') {
      for (const range of ranges) {
        const [x, z] = center(range);
        const length = range[2] - range[0],
          depth = range[3] - range[1];
        const t = facade(xz(p(x, 0, z)), length > depth ? F.along : F.normal);
        const a = Math.max(length, depth) / 2,
          b = Math.min(length, depth) / 2;
        fbox(out, 'plaster', t, -a + 0.1, a - 0.1, g - 1.96, g + 4.74, -b * 0.64, b * 0.64, pale);
        hip(out, t, a, b, g + 4.71, h - 4.71, 0, { curl: 0.38, ridge: 0.88 });
      }
      continue;
    }
    if (role === 'bell') {
      pad(out, site.cutouts[3], g - 3.65, g + 0.62, brick);
      for (const x of [-W * 0.54, W * 0.54])
        for (const z of [-D * 0.53, D * 0.53])
          posts(out, f, x, g + 0.64, g + 10.12, z, 0, wood, 0.42);
      const at = xz(f.P(0, 0, 0));
      lathe(
        out,
        'bronze',
        at,
        [
          [g + 2.68, 1.73, 1.73],
          [g + 6.68, 1.27, 1.27],
          [g + 7.16, 0.2, 0.2],
        ],
        6,
        bellGreen,
      );
      hip(out, f, W, D, g + 9.21, h - 9.21, 0, { curl: 1.35, ridge: 0.15, broad: 0.62 });
      continue;
    }
    const large = role === 'south',
      middle = role === 'middle',
      r = large ? oak : middle ? burnt : wood;
    const floor = large ? site.cutouts[2] : middle ? site.cutouts[1] : part.outline;
    pad(out, floor, g - 3.59, g + 0.45);
    const lower = g + h * (large ? 0.51 : 0.62),
      upper = g + h * (large ? 0.77 : 0.78);
    for (const x of [-0.73, -0.38, 0.38, 0.73])
      posts(out, f, x * W, g + 0.43, lower, D * 0.55, 0, r, large ? 0.55 : 0.35);
    fbox(out, 'wood', f, -W * 0.74, W * 0.74, lower + 0.38, upper + 0.16, -D * 0.53, D * 0.53, r);
    hip(out, f, W, D, lower, h * 0.177, 0, { curl: 0.67 });
    hip(out, f, W * (large ? 1.018 : 0.94), D * 0.91, upper, h * 0.22, 0, {
      curl: 1.08,
      ridge: 0.74,
    });
  }
}
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;

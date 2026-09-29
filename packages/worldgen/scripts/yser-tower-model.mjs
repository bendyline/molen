/** Current 1965 Yser Tower; original mesh reconstructed from the official management drawings. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import { face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const bytes = readFileSync(structureSourcePath('n0604_yser_tower', 'map-frame.json'));
const map = JSON.parse(bytes);
const brick = [0.53, 0.405, 0.335],
  coping = [0.47, 0.49, 0.48],
  stone = [0.4, 0.4, 0.35];
const glass = [0.19, 0.25, 0.265],
  metal = [0.49, 0.54, 0.53],
  yellow = [0.95, 0.61, 0.075];
const dark = [0.08, 0.08, 0.075],
  bronze = [0.33, 0.285, 0.18];
const tau = Math.PI * 2;
// Digitised proportions of the measured twelfth-floor plan, management plan p.33.
const shaft = [
  [286, 259],
  [343, 313],
  [526, 313],
  [581, 259],
  [685, 360],
  [626, 422],
  [711, 506],
  [626, 591],
  [685, 650],
  [581, 752],
  [526, 697],
  [343, 697],
  [286, 752],
  [185, 650],
  [244, 591],
  [159, 506],
  [244, 422],
  [184, 360],
].map(([x, z]) => [(x - 435) * 0.028, (z - 506) * 0.028]);
function cap(out, slot, ring, y, color) {
  const ids = earcut(ring.flat());
  for (let i = 0; i < ids.length; i += 3) {
    let p = ids.slice(i, i + 3).map((j) => [ring[j][0], y, ring[j][1]]);
    if ((p[1][2] - p[0][2]) * (p[2][0] - p[0][0]) - (p[1][0] - p[0][0]) * (p[2][2] - p[0][2]) < 0)
      p = p.reverse();
    triangle(out, slot, p, color);
  }
}
function solid(out, slot, ring, y0, y1, color) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      out,
      slot,
      [
        [a[0], y0, a[1]],
        [a[0], y1, a[1]],
        [b[0], y1, b[1]],
        [b[0], y0, b[1]],
      ],
      color,
    );
  }
  cap(out, slot, ring, y1, color);
}
function panel(out, slot, a, b, y0, y1, holes = [], color = brick, scale = () => 1) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    nx = (b[1] - a[1]) / length,
    nz = -(b[0] - a[0]) / length;
  const point = (t, y, depth = 0) => [
    (a[0] + (b[0] - a[0]) * t) * scale(y) + nx * depth,
    y,
    (a[1] + (b[1] - a[1]) * t) * scale(y) + nz * depth,
  ];
  const xs = [...new Set([0, 1, ...holes.flatMap((h) => [h.t0, h.t1])])].sort((a, b) => a - b),
    ys = [...new Set([y0, y1, ...holes.flatMap((h) => [h.y0, h.y1])])].sort((a, b) => a - b);
  for (let xi = 1; xi < xs.length; xi++)
    for (let yi = 1; yi < ys.length; yi++) {
      const l = xs[xi - 1],
        r = xs[xi],
        lo = ys[yi - 1],
        hi = ys[yi];
      if (
        holes.some(
          (h) =>
            (l + r) / 2 > h.t0 &&
            (l + r) / 2 < h.t1 &&
            (lo + hi) / 2 > h.y0 &&
            (lo + hi) / 2 < h.y1,
        )
      )
        continue;
      face(out, slot, [point(l, lo), point(l, hi), point(r, hi), point(r, lo)], color);
    }
  for (const h of holes) {
    const d = h.depth ?? -0.24,
      p = [point(h.t0, h.y0), point(h.t0, h.y1), point(h.t1, h.y1), point(h.t1, h.y0)],
      q = [point(h.t0, h.y0, d), point(h.t0, h.y1, d), point(h.t1, h.y1, d), point(h.t1, h.y0, d)];
    for (let i = 0; i < 4; i++)
      face(out, slot, [p[i], q[i], q[(i + 1) % 4], p[(i + 1) % 4]], color);
    face(out, h.opaque ? 'metal' : 'glass', q, h.opaque ? metal : glass);
    const cols = h.cols ?? 1,
      rows = h.rows ?? 1;
    for (let i = 0; i <= cols; i++)
      beam(
        out,
        'metal',
        point(h.t0 + ((h.t1 - h.t0) * i) / cols, h.y0, d + 0.025),
        point(h.t0 + ((h.t1 - h.t0) * i) / cols, h.y1, d + 0.025),
        0.055,
        0.055,
        metal,
      );
    for (let i = 0; i <= rows; i++)
      beam(
        out,
        'metal',
        point(h.t0, h.y0 + ((h.y1 - h.y0) * i) / rows, d + 0.025),
        point(h.t1, h.y0 + ((h.y1 - h.y0) * i) / rows, d + 0.025),
        0.055,
        0.055,
        metal,
      );
  }
}
function railing(out, a, b, y) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]),
    count = Math.ceil(length / 1.2);
  for (let i = 0; i <= count; i++) {
    const t = i / count,
      x = a[0] + (b[0] - a[0]) * t,
      z = a[1] + (b[1] - a[1]) * t;
    beam(out, 'metal', [x, y, z], [x, y + 0.85, z], 0.045, 0.045, metal);
  }
  for (const h of [0.4, 0.85])
    beam(out, 'metal', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.045, 0.045, metal);
}
function terrace(out, ring, y, slot = 'brick') {
  cap(out, 'concrete', ring, y, [0.52, 0.54, 0.54]);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    beam(
      out,
      slot,
      [a[0], y + 0.35, a[1]],
      [b[0], y + 0.35, b[1]],
      0.45,
      0.7,
      slot === 'brick' ? brick : stone,
    );
    beam(out, 'limestone_raw', [a[0], y + 0.73, a[1]], [b[0], y + 0.73, b[1]], 0.49, 0.08, coping);
  }
}
const glyphs = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  G: ['01111', '10000', '10000', '10111', '10001', '10001', '01110'],
  I: ['111', '010', '010', '010', '010', '010', '111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
};
function inscription(out, text) {
  const columns = [...text].reduce((n, c) => n + (c === ' ' ? 3 : glyphs[c][0].length + 1), 0),
    unit = Math.min(0.045, 6.5 / columns);
  let x = (-columns * unit) / 2;
  for (const c of text) {
    if (c === ' ') {
      x += unit * 3;
      continue;
    }
    const g = glyphs[c];
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < g[row].length; col++)
        if (g[row][col] === '1')
          box(
            out,
            'metal',
            [x + col * unit, 8.75 + (6 - row) * unit, 3.71],
            [x + (col + 1) * unit, 8.75 + (7 - row) * unit, 3.75],
            [0.9, 0.9, 0.84],
          );
    x += (g[0].length + 1) * unit;
  }
}
function base(out) {
  const ring = map.geometry.outline;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      holes = [];
    if (len > 8)
      for (const t of [0.2, 0.5, 0.8])
        holes.push({ t0: t - 0.027, t1: t + 0.027, y0: 2.1, y1: 3.65 });
    if (i === 6) holes.push({ t0: 0.03, t1: 0.97, y0: 0.05, y1: 2.65, cols: 2 });
    panel(out, 'yser_stone', a, b, 0, 4.8, holes, stone);
    // The irregular Ourthe stone facade is an original small-course relief, not a photo map.
    const nx = (b[1] - a[1]) / len,
      nz = -(b[0] - a[0]) / len;
    for (let row = 0; row < 12; row++)
      for (let col = 0; col < Math.ceil(len / 0.62); col++) {
        const t0 = Math.max(0, (col * 0.62 + (row % 2) * 0.31) / len),
          t1 = Math.min(1, t0 + 0.595 / len),
          lo = 0.035 + row * 0.393,
          hi = lo + 0.365;
        if (t1 - t0 < 0.002 || holes.some((h) => t1 > h.t0 && t0 < h.t1 && hi > h.y0 && lo < h.y1))
          continue;
        const p = (t, y) => [
          a[0] + (b[0] - a[0]) * t + nx * 0.015,
          y,
          a[1] + (b[1] - a[1]) * t + nz * 0.015,
        ];
        const shade =
          0.93 +
          (((Math.imul(row + 13, 73856093) ^ Math.imul(col + 43, 19349663)) >>> 0) % 101) / 720;
        face(
          out,
          'yser_stone',
          [p(t0, lo), p(t0, hi), p(t1, hi), p(t1, lo)],
          stone.map((v) => v * shade),
        );
      }
    if (len > 4) railing(out, a, b, 4.85);
  }
  cap(out, 'concrete', ring, 4.8, [0.6, 0.61, 0.59]);
  // Four diagonal stepped corner pavilions and their actual open roof terraces.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const o = transform(out, Math.PI / 4, [sx * 8.5, 0, sz * 8.5]);
      box(o, 'brick', [-3.7, 4.8, -3.7], [3.7, 10.1, 3.7], brick);
      terrace(
        o,
        [
          [-3.6, -3.6],
          [3.6, -3.6],
          [3.6, 3.6],
          [-3.6, 3.6],
        ],
        10.1,
      );
      const q = transform(out, Math.PI / 4, [sx * 6.5, 0, sz * 6.5]);
      box(q, 'brick', [-2.6, 10.1, -2.6], [2.6, 13.2, 2.6], brick);
      terrace(
        q,
        [
          [-2.52, -2.52],
          [2.52, -2.52],
          [2.52, 2.52],
          [-2.52, 2.52],
        ],
        13.2,
      );
      for (let side = 0; side < 4; side++) {
        const v = transform(o, (side * Math.PI) / 2);
        for (let r = 0; r < 4; r++)
          for (let c = 0; c < 6; c++)
            box(
              v,
              'yser_stone',
              [-3.15 + c * 1.25, 5.4 + r * 0.98, 3.7],
              [-2.92 + c * 1.25, 5.63 + r * 0.98, 3.724],
              [0.23, 0.25, 0.235],
            );
      }
    }
  for (const [sx, sz, text] of [
    [-1, 1, 'NO MORE WAR'],
    [1, 1, 'PLUS JAMAIS DE GUERRE'],
    [1, -1, 'NIE WIEDER KRIEG'],
    [-1, -1, 'NOOIT MEER OORLOG'],
  ])
    inscription(transform(out, Math.atan2(sx, sz), [sx * 8.5, 0, sz * 8.5]), text);
  // White entrance: sliding doors between two externally accessible stair flights.
  box(out, 'concrete', [-2.9, 0, 17.5], [-1.65, 4.8, 19.45], [0.77, 0.76, 0.71]);
  box(out, 'concrete', [1.65, 0, 17.5], [2.9, 4.8, 19.45], [0.77, 0.76, 0.71]);
  box(out, 'concrete', [-1.65, 2.7, 17.5], [1.65, 4.8, 19.45], [0.77, 0.76, 0.71]);
  panel(
    out,
    'concrete',
    [1.65, 19.45],
    [-1.65, 19.45],
    0.03,
    2.7,
    [{ t0: 0.015, t1: 0.985, y0: 0.08, y1: 2.62, cols: 2 }],
    coping,
  );
  for (const s of [-1, 1]) {
    const o = s === 1 ? out : transform(out, 0, [0, 0, 0]);
    const count = 28;
    for (let j = 0; j < count; j++) {
      const xa = 3 + j * 0.37,
        xb = xa + 0.37,
        y = 4.8 * (1 - j / count);
      box(
        o,
        'concrete',
        [s === 1 ? xa : -xb, 0, 17.6],
        [s === 1 ? xb : -xa, y, 19.35],
        j % 2 ? [0.66, 0.66, 0.63] : [0.76, 0.76, 0.72],
      );
    }
    beam(
      out,
      'concrete',
      [s * 3, 5.05, 19.45],
      [s * 13.36, 0.45, 19.45],
      0.36,
      0.7,
      [0.75, 0.74, 0.7],
    );
    for (let j = 0; j < 29; j++) {
      const x = 3 + j * 0.37,
        y = 4.8 * (1 - j / 28);
      beam(out, 'metal', [s * x, y + 0.32, 19.35], [s * x, y + 1, 19.35], 0.04, 0.04, metal);
    }
    beam(out, 'metal', [s * 3, 5.8, 19.35], [s * 13.36, 1, 19.35], 0.05, 0.05, metal);
  }
  box(out, 'yser_stone', [-0.58, 4.8, 19.46], [0.58, 5.1, 19.55], stone);
  box(out, 'yser_stone', [-0.22, 5.1, 19.46], [0.22, 6.65, 19.55], stone);
  box(out, 'yser_stone', [-0.59, 6.02, 19.46], [0.59, 6.36, 19.55], stone);
}
function trunk(out) {
  const scale = (y) => 1.16 - ((y - 13.2) / 53.6) * 0.26;
  for (let i = 0; i < shaft.length; i++) {
    const a = shaft[i],
      b = shaft[(i + 1) % shaft.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      holes = [];
    if ([1, 5, 6, 10, 14, 15].includes(i))
      for (let j = 0; j < 18; j++) {
        const y = 14.6 + j * 2.85;
        holes.push({
          t0: 0.5 - 0.18 / len,
          t1: 0.5 + 0.18 / len,
          y0: y,
          y1: y + 0.9,
          depth: -0.32,
        });
      }
    panel(out, 'brick', a, b, 13.2, 66.8, holes, brick, scale);
  }
  cap(
    out,
    'brick',
    shaft.map(([x, z]) => [x * 0.9, z * 0.9]),
    66.8,
    brick,
  );
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * 4.2,
        z = sz * 4.35;
      const ring = [
        [x - 1.1, z - 1.2],
        [x + 1.1, z - 1.2],
        [x + 1.1, z + 1.2],
        [x - 1.1, z + 1.2],
      ];
      solid(out, 'brick', ring, 58.5, 60.0, brick);
      terrace(out, ring, 60.0);
      // Short projecting piers and limestone returns below the four balcony corners.
      box(out, 'limestone_raw', [x - 0.2, 56.5, z - 0.2], [x + 0.2, 60.1, z + 0.2], coping);
    }
  const frontZ = shaft[10][1] * scale(64);
  box(out, 'shadow', [-0.38, 63.1, frontZ + 0.015], [0.38, 65.6, frontZ + 0.055], dark);
  for (let i = 0; i < 11; i++)
    box(
      out,
      'concrete',
      [-0.43, 63.1 + i * 0.23, frontZ + 0.06],
      [0.43, 63.17 + i * 0.23, frontZ + 0.19],
      [0.78, 0.77, 0.71],
    );
}
function letter(out, ch, cx, cy, z, size = 2.5) {
  const glyph = {
    A: [
      [
        [0, 0],
        [0.5, 1],
      ],
      [
        [0.5, 1],
        [1, 0],
      ],
      [
        [0.23, 0.4],
        [0.77, 0.4],
      ],
    ],
    V: [
      [
        [0, 1],
        [0.5, 0],
      ],
      [
        [0.5, 0],
        [1, 1],
      ],
    ],
    K: [
      [
        [0, 0],
        [0, 1],
      ],
      [
        [0, 0.48],
        [1, 1],
      ],
      [
        [0.25, 0.6],
        [1, 0],
      ],
    ],
  }[ch];
  for (const [a, b] of glyph) {
    // The stroke width belongs in the facade plane, including diagonal letters.
    const ax = cx + (a[0] - 0.5) * size,
      ay = cy + a[1] * size,
      bx = cx + (b[0] - 0.5) * size,
      by = cy + b[1] * size,
      length = Math.hypot(bx - ax, by - ay),
      dx = (-(by - ay) / length) * 0.125,
      dy = ((bx - ax) / length) * 0.125;
    const ring = [
      [ax - dx, ay - dy],
      [bx - dx, by - dy],
      [bx + dx, by + dy],
      [ax + dx, ay + dy],
    ];
    face(
      out,
      'metal',
      ring.map(([x, y]) => [x, y, z + 0.0325]),
      yellow,
    );
    face(
      out,
      'metal',
      [...ring].reverse().map(([x, y]) => [x, y, z - 0.0325]),
      yellow,
    );
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i],
        q = ring[(i + 1) % ring.length];
      face(
        out,
        'metal',
        [
          [p[0], p[1], z - 0.0325],
          [q[0], q[1], z - 0.0325],
          [q[0], q[1], z + 0.0325],
          [p[0], p[1], z + 0.0325],
        ],
        yellow,
      );
    }
  }
}
function crown(out) {
  // Front/back cross-shaped masonry shells with recessed glazing; neither arm is a floating box.
  const cross = [
    [-3.25, 66.8],
    [3.25, 66.8],
    [3.25, 69.5],
    [7.5, 69.5],
    [7.5, 80.2],
    [3.25, 80.2],
    [3.25, 84],
    [-3.25, 84],
    [-3.25, 80.2],
    [-7.5, 80.2],
    [-7.5, 69.5],
    [-3.25, 69.5],
  ];
  const windows = [
    { x0: -2.3, x1: 2.3, y0: 68.7, y1: 72.35, cols: 4, rows: 2 },
    { x0: -6.25, x1: 6.25, y0: 72.5, y1: 77.15, cols: 12, rows: 2 },
    { x0: -2.3, x1: 2.3, y0: 77.3, y1: 81.2, cols: 4, rows: 2 },
  ];
  for (const sign of [-1, 1]) {
    const o = transform(out, sign === 1 ? 0 : Math.PI);
    for (const [x0, x1, y0, y1] of [
      [-3.25, 3.25, 66.8, 69.5],
      [-7.5, 7.5, 69.5, 80.2],
      [-3.25, 3.25, 80.2, 84],
    ]) {
      const holes = windows
        .filter((h) => h.y1 > y0 && h.y0 < y1)
        .map((h) => ({
          t0: (x1 - h.x1) / (x1 - x0),
          t1: (x1 - h.x0) / (x1 - x0),
          y0: Math.max(y0, h.y0),
          y1: Math.min(y1, h.y1),
          cols: h.cols,
          rows: h.rows,
        }));
      panel(o, 'brick', [x1, 4.5], [x0, 4.5], y0, y1, holes, brick);
    }
    letter(o, 'A', 0, 78.0, 4.62);
    letter(o, 'V', -4.15, 73.45, 4.62);
    letter(o, 'V', 0, 73.45, 4.62);
    letter(o, 'K', 4.15, 73.45, 4.62);
    letter(o, 'V', 0, 69.25, 4.62);
  }
  for (let i = 0; i < cross.length; i++) {
    const a = cross[i],
      b = cross[(i + 1) % cross.length];
    if (a[0] === b[0] && Math.abs(a[0]) === 7.5) {
      const s = Math.sign(a[0]),
        o = transform(out, (s * Math.PI) / 2);
      panel(
        o,
        'brick',
        [4.5, 7.5],
        [-4.5, 7.5],
        69.5,
        80.2,
        [{ t0: 0.15, t1: 0.85, y0: 72.5, y1: 77.15, cols: 8, rows: 4 }],
        brick,
      );
    } else if (!(a[1] === b[1] && (a[1] === 84 || a[1] === 80.2)))
      face(
        out,
        'brick',
        [
          [a[0], a[1], -4.5],
          [b[0], b[1], -4.5],
          [b[0], b[1], 4.5],
          [a[0], a[1], 4.5],
        ],
        brick,
      );
  }
  // Open side terraces above the arms, central higher roof terrace and stair head.
  for (const s of [-1, 1]) {
    const lo = s < 0 ? -7.45 : 3.25,
      hi = s < 0 ? -3.25 : 7.45;
    terrace(
      out,
      [
        [lo, -4.45],
        [hi, -4.45],
        [hi, 4.45],
        [lo, 4.45],
      ],
      79.43,
    );
    for (const z of [-2.1, 2.1])
      box(
        out,
        'metal',
        [s < 0 ? -3.28 : 3.26, 80.2, z - 0.4],
        [s < 0 ? -3.26 : 3.28, 82.25, z + 0.4],
        metal,
      );
  }
  terrace(
    out,
    [
      [-3.2, -4.45],
      [3.2, -4.45],
      [3.2, 4.45],
      [-3.2, 4.45],
    ],
    83.23,
  );
  box(out, 'concrete', [-1.1, 83.24, -1.5], [1.1, 84.15, 1.5], [0.5, 0.52, 0.51]);
  sphere(out, 'glass', [0, 84.15, -0.45], [0.8, 0.25, 0.7], [0.59, 0.64, 0.64], 24, 10);
  beam(out, 'metal', [0.8, 84.15, 0.9], [0.8, 89.8, 0.9], 0.08, 0.08, metal);
  // A small plain flying banner records the variable flag without inventing a heraldic texture.
  const flag = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    flag.push([0.8 + t * 1.9, 88.6 - 0.16 * t, 0.9 + Math.sin(t * tau) * 0.17]);
  }
  for (let i = 1; i < flag.length; i++) {
    const a = flag[i - 1],
      b = flag[i];
    face(out, 'metal', [a, b, [b[0], b[1] - 0.95, b[2]], [a[0], a[1] - 0.95, a[2]]], yellow);
  }
}
function carillon(out) {
  const z = 6.6;
  for (const x of [-1.75, 0, 1.75])
    beam(out, 'metal', [x, 14.1, z], [x, 24.1, z], 0.09, 0.09, [0.17, 0.19, 0.17]);
  const counts = [5, 5, 5, 5, 5, 4, 4, 4];
  let id = 0;
  for (let row = 0; row < counts.length; row++) {
    const y = 15 + row * 1.08,
      n = counts[row];
    beam(out, 'metal', [-1.9, y + 0.65, z], [1.9, y + 0.65, z], 0.1, 0.1, [0.17, 0.19, 0.17]);
    for (let col = 0; col < n; col++) {
      const x = (col - (n - 1) / 2) * 0.79,
        r = 0.16 + (0.24 * row) / 7;
      loft(
        out,
        'metal',
        [
          [y, r],
          [y + 0.07, r * 0.96],
          [y + 0.18, r * 0.75],
          [y + 0.45, r * 0.5],
          [y + 0.55, r * 0.4],
        ].map(([h, r]) => radialRing(h, r, r, 24, [x, z + 0.22])),
        bronze,
        { cap: false },
      );
      beam(out, 'metal', [x, y + 0.55, z + 0.22], [x, y + 0.71, z], 0.05, 0.05, bronze);
      sphere(out, 'metal', [x, y + 0.055, z + 0.22], [0.055, 0.07, 0.055], bronze, 12, 6);
      id++;
    }
  }
  if (id !== 37) throw Error('Yser carillon must contain 37 bells');
}
function build(out) {
  base(out);
  trunk(out);
  crown(out);
  carillon(out);
}
export const yserTower = {
  id: 'n0604_yser_tower',
  planId: 'N0604',
  title: 'Yser Tower',
  wikidata: 'Q1708620',
  authoringFile: 'yser-tower-model.mjs',
  build,
  size: [35.3, 89.8, 37.5],
  front: 'Native +Z northeast toward the current entrance and exterior carillon; +X northwest',
  origin: 'Mapped current tower platform center; Y=0 exterior ground',
  brief:
    'The current 1965 IJzertoren: octagonal Ourthe-stone platform, double external stair entrance, stepped brick pavilions, six-lobed tapering shaft, recessed slit windows, four balconies, glazed cross crown with original AVV/VVK letter geometry, open roof terraces and the 37-bell northeast carillon.',
  refs: [
    'https://www.museumaandeijzer.be/nl/over-de-organisatie/',
    'https://plannen.onroerenderfgoed.be/plannen/219/bestanden/908',
    'https://inventaris.onroerenderfgoed.be/erfgoedobjecten/78242',
    'https://biblio.ugent.be/publication/8716312/file/8738740.pdf',
    'https://www.museumaandeijzer.be/nl/home/het-klokkenspel-van-de-ijzertoren/?lid=39220',
    'https://www.diksmuide.be/erfgoeddag-game-on',
    'https://www.museumaandeijzer.be/swfiles/files/DJI_0295.jpg',
    'https://www.openstreetmap.org/way/89482810',
  ],
  facts: {
    currentTowerOpened: '1965-08-22',
    architect: 'Robert Van Averbeke',
    structuralHeightMeters: 84,
    crossCantileverLevelMeters: 69.5,
    letterHeightMeters: 2.5,
    carillonBells: 37,
    panoramicRoomPublishedOpeningWindows: 144,
    planSource:
      'Official 2016 management plan pp.32–35: measured ground/12th/20th-floor outlines, original section and crown elevation',
    materials:
      'Brown handmade manganese brick (Nelissen, Kesselt-Lanaken); irregular Ourthe stone at ground floor; blue limestone copings; powder-coated aluminium frames and letters',
  },
  scaleBasis:
    'The museum establishes the 84 m current tower and 2.5 m letters. The official management plan pp.32–35 supplies the six-lobed shaft, floor sections and crown; its pp.36–49 documents terraces, cladding, windows and entrance. The construction-history paper places the cantilever at 69.50 m. Exact mapped ground footprint supplies scale and the entry projection supplies the directed northeast phase. Secondary heights, small panel widths, bell arrangement and stone relief are proportional reconstructions from these drawings and current operator photographs.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    source: map.source,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    evidence: map.basis,
    limitations:
      'Ordinary ground contact; independent Pax gate, demolished first tower remains, forecourt ticket building and surrounding park are excluded.',
  },
  limits: [
    'This models the current 1965 tower, not the demolished 1930 tower. Facade plans and gross dimensions are sourced; individual stone positions, exact brick repair patches, small terrace equipment and bell attachment details are reconstructed.',
    'The roof flag is a plain variable banner; no heraldic image, downloaded mesh or photograph is embedded.',
    'Interiors and the independent Pax gate/old-tower crypt are outside this exterior model.',
  ],
  cameras: [
    { name: 'northeast-entrance', position: [65, 45, 110], lookAt: [0, 37, 0] },
    { name: 'southwest-rear', position: [-85, 50, -112], lookAt: [0, 39, 0] },
    { name: 'cross-crown-detail', position: [32, 80, 55], lookAt: [0, 77, 0] },
    { name: 'roof-and-shaft-plan', position: [5, 152, 10], lookAt: [0, 35, 0] },
    { name: 'entrance-and-carillon', position: [22, 18, 46], lookAt: [0, 14, 7] },
    { name: 'far-silhouette', position: [125, 65, 170], lookAt: [0, 43, 0] },
  ],
};

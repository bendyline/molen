/** Original 1930 museum-era Sukharev Tower exterior from archival plans and photographs. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beam, chamferedRectangle, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  archBay,
  column,
  cornice,
  facade,
  face,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const tau = Math.PI * 2;
const red = [0.59, 0.23, 0.17],
  redDark = [0.48, 0.17, 0.12];
const white = [0.82, 0.79, 0.69],
  light = [0.9, 0.87, 0.77];
const roofGreen = [0.24, 0.37, 0.31],
  roofOchre = [0.48, 0.4, 0.23];
const glass = [0.1, 0.15, 0.17],
  iron = [0.065, 0.068, 0.064];
const mapBytes = readFileSync(
  structureSourcePath('n0607_sukharev_tower', 'map-frame.json'),
  'utf8',
);
const map = JSON.parse(mapBytes);

function line(out, slot, points, width, color) {
  for (let i = 1; i < points.length; i++)
    beam(out, slot, points[i - 1], points[i], width, width, color);
}
function arc(out, slot, x, y, z, rx, ry, width, color, a0 = 0, a1 = Math.PI) {
  line(
    out,
    slot,
    Array.from({ length: 33 }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / 32;
      return [x + rx * Math.cos(a), y + ry * Math.sin(a), z];
    }),
    width,
    color,
  );
}
function bulb(out, x, y, z, h = 1, r = 0.2) {
  loft(
    out,
    'limestone',
    [
      [0, 0.7],
      [0.13, 0.8],
      [0.2, 0.46],
      [0.35, 0.54],
      [0.52, 1],
      [0.7, 0.77],
      [0.82, 0.4],
      [0.91, 0.38],
      [1, 0.56],
    ].map(([t, rr]) => radialRing(y + t * h, rr * r, rr * r, 12, [x, z])),
    white,
  );
}
function twistedColumn(out, x, y, z, h, r = 0.18) {
  column(out, 'limestone', x, z, y, y + h, r, white, 16);
  for (let k = 0; k < 2; k++)
    line(
      out,
      'limestone',
      Array.from({ length: 73 }, (_, i) => {
        const t = i / 72,
          a = t * tau * 3.8 + k * Math.PI;
        return [x + Math.cos(a) * r * 0.9, y + 0.23 + t * (h - 0.46), z + Math.sin(a) * r * 0.9];
      }),
      r * 0.38,
      light,
    );
}
/** Carved broken segmental pediment and shell relief, based on the surviving survey detail. */
function pediment(out, x, y, z, w, h) {
  const r = w / 2;
  for (const sign of [-1, 1]) {
    line(
      out,
      'limestone',
      [
        [x + sign * (r + 0.2), y, z],
        [x + sign * r * 0.72, y + 0.15, z],
        [x + sign * r * 0.3, y + h * 0.68, z],
        [x + sign * r * 0.16, y + h * 0.79, z],
      ],
      0.14,
      white,
    );
    sphere(out, 'limestone', [x + sign * r * 0.83, y + 0.2, z], [0.19, 0.23, 0.13], white, 12, 6);
    bulb(out, x + sign * r * 0.86, y + 0.32, z, 0.54, 0.105);
  }
  box(
    out,
    'limestone',
    [x - r - 0.23, y - 0.14, z - 0.12],
    [x + r + 0.23, y + 0.04, z + 0.15],
    white,
  );
  for (let i = 0; i < 9; i++) {
    const a = 0.12 + (i * (Math.PI - 0.24)) / 8;
    line(
      out,
      'limestone',
      [
        [x, y + 0.08, z + 0.09],
        [x + Math.cos(a) * r * 0.49, y + 0.1 + Math.sin(a) * h * 0.66, z + 0.1],
      ],
      0.075,
      light,
    );
  }
  bulb(out, x, y + h * 0.68, z, 0.58, 0.13);
}
function windowTrim(out, x, y, z, w, h, { ornate = true, blind = false } = {}) {
  box(
    out,
    blind ? 'brick' : 'glass',
    [x - w / 2, y, z - 0.26],
    [x + w / 2, y + h, z - 0.2],
    blind ? redDark : glass,
  );
  for (const sign of [-1, 1]) {
    box(
      out,
      'limestone',
      [x + (sign * w) / 2 - 0.09, y - 0.1, z - 0.27],
      [x + (sign * w) / 2 + 0.09, y + h + 0.12, z + 0.08],
      white,
    );
    if (ornate) twistedColumn(out, x + sign * (w / 2 + 0.24), y - 0.05, z + 0.04, h + 0.1, 0.14);
  }
  for (const yy of [y - 0.12, y + h])
    box(
      out,
      'limestone',
      [x - w / 2 - 0.22, yy, z - 0.14],
      [x + w / 2 + 0.22, yy + 0.15, z + 0.11],
      white,
    );
  if (!blind) {
    box(out, 'wood', [x - 0.055, y, z - 0.17], [x + 0.055, y + h, z - 0.08], [0.36, 0.29, 0.21]);
    for (const t of [0.33, 0.68])
      box(
        out,
        'wood',
        [x - w / 2, y + h * t - 0.04, z - 0.17],
        [x + w / 2, y + h * t + 0.04, z - 0.08],
        [0.36, 0.29, 0.21],
      );
  }
  if (ornate) pediment(out, x, y + h + 0.18, z + 0.02, w + 0.5, 0.95);
  box(
    out,
    'limestone',
    [x - w / 2 - 0.28, y - 0.27, z - 0.16],
    [x + w / 2 + 0.28, y - 0.12, z + 0.2],
    white,
  );
}
function windowWall(out, width, y0, y1, z, windows) {
  facade(
    out,
    'brick',
    width,
    y0,
    y1,
    z,
    windows.map(([x, y, w, h]) => ({ x, y, w, top: y + h, spring: y + h, rise: 0, depth: 0.38 })),
    red,
  );
  for (const [x, y, w, h, opt] of windows) windowTrim(out, x, y, z, w, h, opt);
}
function wallPilaster(out, x, y0, y1, z, w = 0.45) {
  box(out, 'brick', [x - w / 2, y0, z - 0.03], [x + w / 2, y1, z + 0.16], redDark);
  for (const yy of [y0 + 0.1, y1 - 0.34, y1 - 0.13])
    box(
      out,
      'limestone',
      [x - w / 2 - 0.1, yy, z - 0.09],
      [x + w / 2 + 0.1, yy + 0.12, z + 0.24],
      white,
    );
}
function parapet(out, width, z, y, panels) {
  box(out, 'brick', [-width / 2, y, z - 0.38], [width / 2, y + 1.15, z], red);
  box(
    out,
    'limestone',
    [-width / 2 - 0.08, y + 1.15, z - 0.44],
    [width / 2 + 0.08, y + 1.34, z + 0.08],
    white,
  );
  for (let i = 0; i < panels; i++) {
    const x = -width / 2 + ((i + 0.5) * width) / panels,
      w = width / panels - 0.4;
    box(out, 'brick', [x - w / 2, y + 0.22, z + 0.015], [x + w / 2, y + 0.94, z + 0.08], redDark);
    for (const xx of [x - w / 2, x + w / 2])
      box(
        out,
        'limestone',
        [xx - 0.04, y + 0.19, z + 0.08],
        [xx + 0.04, y + 0.96, z + 0.13],
        white,
      );
    for (const yy of [y + 0.19, y + 0.92])
      box(out, 'limestone', [x - w / 2, yy, z + 0.08], [x + w / 2, yy + 0.07, z + 0.13], white);
  }
}
function arcade(out, width, z, arches, top = 8.05) {
  let edge = -width / 2;
  for (const [x, w, spring] of arches) {
    if (x - w / 2 > edge) box(out, 'brick', [edge, 0, z - 1.1], [x - w / 2, top, z], red);
    archBay(out, 'brick', x, w, 0, spring, w * 0.38, top, z, 1.1, red, { back: false });
    for (const rr of [0, 0.19])
      arc(out, 'limestone', x, spring, z + 0.04 + rr * 0.2, w / 2 + rr, w * 0.38 + rr, 0.11, white);
    for (const sign of [-1, 1])
      wallPilaster(out, x + sign * (w / 2 + 0.22), 0.3, top, z + 0.02, 0.35);
    edge = x + w / 2;
  }
  if (edge < width / 2) box(out, 'brick', [edge, 0, z - 1.1], [width / 2, top, z], red);
}
function staircase(out) {
  const z0 = 6.8,
    z1 = 12.0;
  // Two straight flights, with the north enclosing wall and overhead roof removed in 1923–25.
  const profile = [
    [20.8, 8.3],
    [26.1, 8.3],
    [33.3, 4.15],
    [37.2, 4.15],
    [44.4, 0.12],
  ];
  for (let j = 1; j < profile.length; j++) {
    const [a, ya] = profile[j - 1],
      [b, yb] = profile[j];
    const n = Math.abs(ya - yb) < 0.01 ? 1 : 23;
    for (let i = 0; i < n; i++) {
      const x0 = a + ((b - a) * i) / n,
        x1 = a + ((b - a) * (i + 1)) / n;
      const y = ya + ((yb - ya) * i) / n;
      box(out, 'brick', [x0, 0, z0], [x1, Math.max(0.08, y - 0.13), z1], red);
      box(
        out,
        'darkstone',
        [x0, Math.max(0.01, y - 0.13), z0 - 0.02],
        [x1 + 0.015, y + 0.01, z1 + 0.02],
        [0.58, 0.57, 0.51],
      );
    }
    for (const z of [z0, z1]) {
      beam(out, 'brick', [a, ya + 0.55, z], [b, yb + 0.55, z], 0.42, 1.1, red);
      beam(out, 'limestone', [a, ya + 1.12, z], [b, yb + 1.12, z], 0.52, 0.14, white);
    }
  }
  for (const [x, y] of profile.slice(0, -1))
    for (const z of [z0, z1]) {
      box(
        out,
        'brick',
        [x - 0.24, Math.max(0, y - 0.1), z - 0.25],
        [x + 0.24, y + 1.45, z + 0.25],
        red,
      );
      bulb(out, x, y + 1.42, z, 0.65, 0.17);
    }
  // Doors and slit windows to the rooms beneath the surviving stone stair.
  for (const [x, y, w, h] of [
    [23, 0.8, 1.25, 2.6],
    [29, 0.65, 1.1, 2.2],
    [36, 0.3, 0.8, 1.3],
  ]) {
    const f = transform(out, 0, [0, 0, 0]);
    windowTrim(f, x, y, z1 + 0.34, w, h, { ornate: x < 26 });
  }
}
function clock(out, z, y) {
  const r = 1.68;
  for (let i = 0; i < 96; i++) {
    const a = (i * tau) / 96,
      b = ((i + 1) * tau) / 96;
    triangle(
      out,
      'plaster',
      [
        [0, y, z],
        [r * Math.sin(b), y + r * Math.cos(b), z],
        [r * Math.sin(a), y + r * Math.cos(a), z],
      ],
      light,
    );
  }
  arc(out, 'metal', 0, y, z + 0.025, r, r, 0.09, iron, 0, tau);
  arc(out, 'metal', 0, y, z + 0.03, r * 0.69, r * 0.69, 0.035, iron, 0, tau);
  const roman = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12,
      center = [Math.sin(a) * r * 0.83, y + Math.cos(a) * r * 0.83];
    const t = roman[i],
      spacing = 0.135;
    for (let j = 0; j < t.length; j++) {
      const xx = (j - (t.length - 1) / 2) * spacing;
      const p = (u, v) => [
        center[0] + (xx + u) * Math.cos(a) + v * Math.sin(a),
        center[1] - (xx + u) * Math.sin(a) + v * Math.cos(a),
        z + 0.065,
      ];
      if (t[j] === 'I') beam(out, 'metal', p(0, -0.14), p(0, 0.14), 0.04, 0.025, iron);
      else if (t[j] === 'V') {
        beam(out, 'metal', p(-0.045, 0.14), p(0, -0.14), 0.04, 0.025, iron);
        beam(out, 'metal', p(0, -0.14), p(0.045, 0.14), 0.04, 0.025, iron);
      } else {
        beam(out, 'metal', p(-0.045, -0.14), p(0.045, 0.14), 0.04, 0.025, iron);
        beam(out, 'metal', p(-0.045, 0.14), p(0.045, -0.14), 0.04, 0.025, iron);
      }
    }
  }
  for (const [angle, length] of [
    [-1.05, 1.1],
    [1.4, 1.38],
  ])
    beam(
      out,
      'metal',
      [0, y, z + 0.11],
      [Math.sin(angle) * length, y + Math.cos(angle) * length, z + 0.11],
      0.075,
      0.04,
      iron,
    );
  sphere(out, 'metal', [0, y, z + 0.13], [0.12, 0.12, 0.07], iron, 16, 8);
}
function bell(out, x, y, z, r) {
  loft(
    out,
    'metal',
    [
      [0, 1.05],
      [0.16, 1.04],
      [0.28, 0.83],
      [0.68, 0.51],
      [1, 0.43],
      [1.18, 0.28],
    ].map(([t, rr]) => radialRing(y + t * r, r * rr, r * rr, 24, [x, z])),
    [0.38, 0.28, 0.14],
    { cap: false },
  );
  beam(out, 'metal', [x, y + 0.5 * r, z], [x, y - 0.15 * r, z], 0.09, 0.09, iron);
}
function tentRoof(out, cx, cz, y, r, h, sides = 8) {
  loft(
    out,
    'metal',
    [
      radialRing(y, r, r, sides, [cx, cz], Math.PI / 8),
      radialRing(y + h, 0.05, 0.05, sides, [cx, cz], Math.PI / 8),
    ],
    roofGreen,
  );
  const rows = Math.ceil(h / 0.3);
  for (let row = 0; row < rows; row++) {
    const t0 = row / rows,
      t1 = (row + 0.87) / rows;
    const rr0 = r * (1 - t0),
      rr1 = r * (1 - t1);
    const ring0 = radialRing(y + h * t0, rr0, rr0, sides, [cx, cz], Math.PI / 8),
      ring1 = radialRing(y + h * t1, rr1, rr1, sides, [cx, cz], Math.PI / 8);
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides,
        segments = Math.max(1, Math.ceil(rr0 * 1.8));
      for (let k = 0; k < segments; k++) {
        const f0 = (k + 0.04) / segments,
          f1 = (k + 0.96) / segments;
        const p = (ring, t) =>
          ring[i].map((v, j) => v + (ring[next][j] - v) * t + (j === 1 ? 0.025 : 0));
        face(
          out,
          'metal',
          [p(ring0, f0), p(ring0, f1), p(ring1, f1), p(ring1, f0)],
          (row + i + k) % 9 === 0 ? roofOchre : roofGreen,
        );
      }
    }
  }
  for (let i = 0; i < sides; i++) {
    const a = Math.PI / 8 - (i * tau) / sides;
    beam(
      out,
      'metal',
      [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r],
      [cx, y + h, cz],
      0.075,
      0.075,
      [0.48, 0.48, 0.34],
    );
  }
}
function tower(out) {
  // The shaft is an octagon with broad cardinal faces and narrow diagonal returns.
  const rings = [
    [25, 10.4, 2.3],
    [32.7, 9.1, 1.85],
    [41.2, 8.15, 1.55],
    [48.9, 7.35, 1.45],
  ];
  for (let level = 0; level < rings.length - 1; level++) {
    const [y, w, ch] = rings[level],
      [top, next] = rings[level + 1];
    loft(
      out,
      'brick',
      [chamferedRectangle(0, y, 0, w, w, ch), chamferedRectangle(0, top, 0, next, next, ch * 0.92)],
      red,
    );
  }
  for (const [y, w, ch] of rings.slice(1)) {
    for (const [dy, dw] of [
      [0, 0.15],
      [0.18, 0.35],
      [0.36, 0.16],
    ])
      loft(
        out,
        'limestone',
        [
          chamferedRectangle(0, y + dy, 0, w + dw, w + dw, ch),
          chamferedRectangle(0, y + dy + 0.14, 0, w + dw, w + dw, ch),
        ],
        white,
      );
  }
  for (let side = 0; side < 4; side++) {
    const f = transform(out, (side * Math.PI) / 2);
    for (const [y, z, w, h] of [
      [26.6, 5.1, 2.3, 4.6],
      [34.4, 4.49, 2.15, 4.8],
    ]) {
      windowTrim(f, 0, y, z + 0.4, w, h);
      if (y < 30) arc(f, 'brick', 0, y + h - 0.1, z - 0.06, 2.18, 2.4, 0.18, redDark);
    }
    clock(f, 4.02, 45.0);
    for (const sign of [-1, 1]) {
      column(f, 'limestone', sign * 2.64, 4.82, 25.65, 32.5, 0.17, white, 16);
      twistedColumn(f, sign * 2.35, 33.35, 4.38, 7.48, 0.17);
      column(f, 'limestone', sign * 2.1, 4.0, 41.95, 48.8, 0.17, white, 16);
    }
    for (let i = 0; i < 9; i++) bulb(f, -2.3 + i * 0.575, 32.1, 4.76, 0.78, 0.12);
  }
  // Narrow diagonal windows and corner shafts are visible on the historical photographs.
  for (let i = 0; i < 4; i++) {
    const f = transform(out, Math.PI / 4 + (i * Math.PI) / 2);
    for (const [y, z, h] of [
      [27.2, 5.62, 4.2],
      [35.05, 5.01, 4.45],
      [43, 4.58, 3.85],
    ])
      windowTrim(f, 0, y, z + 0.4, 0.93, h, { ornate: false });
  }
  // Open belfry arches with nine actual bell silhouettes, rather than a solid dark cap.
  const r = 4.5,
    points = radialRing(49.5, r, r, 8, [0, 0], Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const p = points[i],
      q = points[(i + 1) % 8],
      cx = (p[0] + q[0]) / 2,
      cz = (p[2] + q[2]) / 2;
    const width = Math.hypot(p[0] - q[0], p[2] - q[2]),
      f = transform(out, Math.atan2(cx, cz), [cx, 0, cz]);
    archBay(f, 'brick', 0, width - 0.68, 49.6, 53.2, 1.65, 55.2, 0, 0.55, red, { back: false });
    arc(f, 'limestone', 0, 53.2, 0.03, (width - 0.68) / 2, 1.65, 0.12, white);
    for (const sign of [-1, 1]) twistedColumn(f, sign * (width / 2 - 0.16), 49.2, 0.09, 5.8, 0.16);
    for (let k = 0; k < 4; k++)
      bulb(f, -width / 2 + 0.56 + (k * (width - 1.12)) / 3, 49.5, 0.07, 0.8, 0.115);
    box(f, 'limestone', [-width / 2 + 0.2, 50.3, -0.1], [width / 2 - 0.2, 50.48, 0.18], white);
    bulb(f, 0, 54.87, 0.04, 0.92, 0.17);
  }
  box(out, 'wood', [-2.9, 53, -0.17], [2.9, 53.25, 0.17], [0.25, 0.18, 0.11]);
  bell(out, 0, 50.85, 0, 0.82);
  for (let i = 0; i < 8; i++) {
    const a = (tau * i) / 8;
    bell(out, Math.cos(a) * 2.4, 51.4 + (i % 2) * 0.4, Math.sin(a) * 2.4, 0.27 + (i % 3) * 0.075);
  }
  tentRoof(out, 0, 0, 54.85, 4.6, 7.4);
  bulb(out, 0, 62.2, 0, 0.75, 0.19);
  beam(out, 'metal', [0, 62.9, 0], [0, 64, 0], 0.045, 0.045, iron);
  // No imperial eagle: the 1926 museum director records its removal in 1919.
  for (const x of [-4.9, 4.9])
    for (const z of [-4.9, 4.9]) {
      column(out, 'brick', x, z, 25.4, 27, 0.56, red, 8);
      tentRoof(out, x, z, 26.8, 1.07, 4.8);
      bulb(out, x, 31.55, z, 0.65, 0.15);
    }
}
function buildSukharev(out) {
  // Pass-through gate remains open north–south; massive chambers flank it.
  const W = 41.6,
    D = 24.5;
  const sideRooms = [
    [-18.45, -4.25],
    [4.25, 18.45],
  ];
  for (const [x0, x1] of sideRooms)
    box(
      out,
      'brick',
      [x0 < -5 ? x0 + 0.9 : x0, 0.04, -8.9],
      [x1 > 5 ? x1 - 0.9 : x1, 8.25, 8.9],
      red,
    );
  archBay(out, 'brick', 0, 8.5, 0, 4.1, 3.25, 8.3, 9.8, 19.6, red, { back: false });
  // Exterior galleries are real arcades. Sretenska (south) has six, north has five.
  arcade(out, W, D / 2, [
    [-16.0, 6.0, 3.8],
    [-8.5, 6.1, 3.8],
    [0, 7.5, 3.7],
    [7.25, 4.4, 3.8],
    [12.5, 4.4, 3.8],
    [17.55, 4.3, 3.8],
  ]);
  arcade(transform(out, Math.PI), W, D / 2, [
    [-16.5, 6.1, 3.9],
    [-8.4, 6.4, 3.9],
    [0, 7.2, 4],
    [8.3, 6.4, 3.9],
    [16.4, 6.1, 3.9],
  ]);
  for (const sign of [-1, 1])
    arcade(transform(out, (sign * Math.PI) / 2), D, W / 2, [
      [-8, 6.1, 3.8],
      [0, 6.1, 3.8],
      [8, 6.1, 3.8],
    ]);
  // Recessed ground-floor doors and decorated windows inside the galleries.
  for (let side = 0; side < 2; side++) {
    const f = transform(out, side * Math.PI);
    for (const cx of [-11.35, 11.35])
      windowWall(transform(f, 0, [cx, 0, 0]), 14.2, 0, 8.25, 9.8, [
        [-3.9, 1, 1.35, 2.85],
        [2.9, 1, 1.35, 2.85],
      ]);
  }
  for (const sign of [-1, 1]) {
    const f = transform(out, (sign * Math.PI) / 2);
    windowWall(
      f,
      19.6,
      0,
      8.25,
      18.5,
      [-6.8, 0, 6.8].map((x) => [x, 1, 1.35, 2.85]),
    );
  }
  for (const y of [7.85, 8.2]) cornice(out, 'limestone', W, D, y, 0.28, white);
  box(out, 'darkstone', [-20.8, 8.48, -12.25], [20.8, 8.6, 12.25], [0.48, 0.47, 0.43]);
  // The wide second-floor outer terrace and its deeply carved twelve-window walls.
  const longs = [-16.3, -12.85, -9.4, -5.95, -2.5, 0.95, 4.4, 7.85, 11.3, 14.75];
  for (let i = 0; i < 2; i++) {
    const f = transform(out, i * Math.PI);
    windowWall(
      f,
      37,
      8.6,
      16.75,
      9.8,
      longs.map((x) => [x, 10.5, 1.55, 3.75]),
    );
    parapet(f, 41.6, 12.3, 8.62, 12);
    for (const x of [-18.3, -11.5, -4.7, 2.15, 9, 16.5]) wallPilaster(f, x, 8.65, 16.7, 9.82, 0.35);
  }
  for (const sign of [-1, 1]) {
    const f = transform(out, (sign * Math.PI) / 2);
    windowWall(
      f,
      19.6,
      8.6,
      16.75,
      18.5,
      [-6.6, -2.2, 2.2, 6.6].map((x) => [x, 10.5, 1.55, 3.75]),
    );
    parapet(f, 24.5, 20.8, 8.62, 7);
  }
  cornice(out, 'limestone', 37.25, 20.1, 16.65, 0.6, white);
  box(out, 'darkstone', [-18.85, 17.25, -10.15], [18.85, 17.4, 10.15], [0.5, 0.48, 0.43]);
  // Third-floor chambers, end vestibules and opened north/south iron-framed central arches.
  for (let i = 0; i < 2; i++) {
    const f = transform(out, i * Math.PI);
    const windows = [-15.35, -12.1, -8.85, -5.6, 5.6, 8.85, 12.1, 15.35].map((x) => [
      x,
      19.1,
      1.7,
      3.6,
    ]);
    windowWall(f, 34.9, 17.4, 24.8, 8.55, [...windows, [-2, 18.3, 2.9, 5.4], [2, 18.3, 2.9, 5.4]]);
    for (const x of [-2, 2]) {
      arc(f, 'limestone', x, 22.6, 8.61, 1.44, 1.15, 0.15, white);
      for (const dx of [-0.95, 0, 0.95])
        box(f, 'metal', [x + dx - 0.035, 18.3, 8.44], [x + dx + 0.035, 23.65, 8.5], iron);
    }
    parapet(f, 37.6, 10.2, 17.4, 11);
    for (const x of [-17.3, -10.6, -4.3, 4.3, 10.6, 17.3]) {
      column(f, 'limestone', x, 8.65, 17.5, 24.75, 0.19, white);
    }
  }
  for (const sign of [-1, 1]) {
    const f = transform(out, (sign * Math.PI) / 2);
    windowWall(
      f,
      17.1,
      17.4,
      24.8,
      17.45,
      [-6.35, -2.13, 2.13, 6.35].map((x) => [x, 19.1, 1.7, 3.6]),
    );
    parapet(f, 20.1, 18.75, 17.4, 6);
    for (const x of [-8.35, -4.2, 0, 4.2, 8.35])
      column(f, 'limestone', x, 17.55, 17.5, 24.75, 0.19, white);
  }
  cornice(out, 'limestone', 35.35, 17.6, 24.8, 0.58, white);
  // Low four-sided roof surfaces meet the central tower without obsolete high pre-1701 tents.
  loft(
    out,
    'metal',
    [
      chamferedRectangle(0, 25.35, 0, 35.6, 17.9, 0.2),
      chamferedRectangle(0, 26.0, 0, 10.5, 10.5, 0.2),
    ],
    [0.25, 0.31, 0.29],
  );
  // Tall panelled roof-edge parapet visible on the post-restoration photographs.
  for (let i = 0; i < 2; i++) parapet(transform(out, i * Math.PI), 35.5, 8.86, 25.35, 10);
  for (const sign of [-1, 1]) parapet(transform(out, (sign * Math.PI) / 2), 17.75, 17.75, 25.35, 5);
  // Characteristic eastern loggia at the head of the long stone staircase.
  const east = transform(out, Math.PI / 2, [20.76, 8.6, 6.0]);
  arcade(
    east,
    11.8,
    0,
    [
      [-3.0, 4.2, 4.2],
      [2.7, 4.2, 4.2],
    ],
    7.8,
  );
  box(east, 'limestone', [-6.1, 7.78, -2.5], [6.1, 8.05, 0.25], white);
  // The museum photograph shows a solid, curved tympanum here, not an open shell like
  // the small window pediments. Its paired ogees rise to a short central round arch.
  const gable = Array.from({ length: 65 }, (_, i) => {
    const x = -5.3 + (10.6 * i) / 64;
    const t = Math.abs(x) / 5.3;
    return [x, 8.12 + 2.12 * (0.5 + 0.5 * Math.cos(Math.PI * t)), 0.15];
  });
  for (let i = 1; i < gable.length; i++) {
    const a = gable[i - 1],
      b = gable[i];
    face(east, 'brick', [[a[0], 8.1, 0.09], [b[0], 8.1, 0.09], b, a], red);
    face(
      east,
      'brick',
      [
        [b[0], 8.1, -0.45],
        [a[0], 8.1, -0.45],
        [a[0], a[1], -0.45],
        [b[0], b[1], -0.45],
      ],
      red,
    );
    face(east, 'brick', [a, b, [b[0], b[1], -0.45], [a[0], a[1], -0.45]], red);
  }
  line(east, 'limestone', gable, 0.15, white);
  box(east, 'limestone', [-5.6, 8.0, -0.48], [5.6, 8.16, 0.27], white);
  for (const x of [-5.45, -2.2, 2.2, 5.45])
    bulb(east, x, 8.16 + (Math.abs(x) < 3 ? 1.52 : 0), 0.12, 0.8, 0.17);
  // Recessed small central round panel and three blind scallops below the coping.
  for (const x of [-0.7, 0, 0.7]) {
    arc(east, 'limestone', x, 8.16, 0.23, 0.17, 0.4, 0.07, white);
  }
  staircase(out);
  tower(out);
  // Current museum-era rainwater pipes and stone memorial panels flank the southern gateway.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      line(
        out,
        'metal',
        [
          [sx * 17.4, 25.5, sz * 8.64],
          [sx * 17.4, 17.5, sz * 8.64],
          [sx * 18.55, 16.9, sz * 9.86],
          [sx * 18.55, 8.9, sz * 9.86],
          [sx * 20.64, 8.4, sz * 12.33],
          [sx * 20.64, 0.4, sz * 12.33],
        ],
        0.13,
        iron,
      );
    }
  for (const x of [-6.2, 3.1]) {
    box(out, 'marble', [x - 0.62, 2.25, 12.28], [x + 0.62, 4.4, 12.43], light);
    pediment(out, x, 4.45, 12.48, 1.4, 0.8);
    for (let i = 0; i < 8; i++)
      box(
        out,
        'limestone',
        [x - 0.45, 2.55 + i * 0.19, 12.44],
        [x + 0.36 + (i % 3) * 0.04, 2.575 + i * 0.19, 12.46],
        [0.54, 0.53, 0.46],
      );
  }
}

export const sukharevTower = {
  id: 'n0607_sukharev_tower',
  planId: 'N0607',
  title: 'Sukharev Tower — museum exterior, 1930',
  wikidata: 'Q913949',
  build: buildSukharev,
  componentMap: { limestone: 'limestone_raw' },
  authoringFile: 'sukharev-tower-model.mjs',
  brief:
    'Historical museum-era gate tower: asymmetric arcaded galleries, carved window surrounds, octagonal clock shaft, open nine-bell belfry, tiled tent roof and uncovered two-flight eastern stair. The removed imperial eagle is absent.',
  size: [65.5, 64, 25.3],
  front: '+Z is the Sretenska/southern facade; +X is the eastern staircase direction',
  origin: 'Center of the main 41.6 × 24.5 m rectangular tower base; Y=0 at the historic pavement',
  appearance: {
    kind: 'historical',
    currentWorldEligible: false,
    validFrom: '1926-01-06',
    validUntil: '1934-04-01',
    representedDate: '1930-01-01',
    notes:
      'Documented post-1925 restoration appearance. Deliberately conservative end date before the April–May 1934 demolition. Explicit viewingDate is required; this is never a current-world building.',
  },
  refs: [
    'https://history.wikireading.ru/321090',
    'https://upload.wikimedia.org/wikipedia/commons/b/b0/Sukhareva_bashnya_v_Moskve.pdf',
    'https://api.ziyonet.uz/uploads/books/10000014/jMb0bL5knCcfTJ5.pdf',
    'https://online.mosmuseum.ru/moskva-404-1',
    'https://mosmuseum.ru/exhibitions/p/suhareva_tower/',
    'https://www.mos.ru/upload/documents/files/5479/AKTGIKEBolshayaSyharevskayaploshad3.pdf',
  ],
  facts: {
    director1926DimensionsSazhen: [19.5, 30, 11.5],
    sazhenMeters: 2.1336,
    mainFootprintMeters: [41.6, 24.5],
    reconstructedHeightMeters: 64,
    stairExtensionMeters: 23.6,
    southernArcadeOpenings: 6,
    northernArcadeOpenings: 5,
    clockInstallationYear: 1899,
    bellCount: 9,
    eagleRemovedYear: 1919,
    exteriorRestorationYears: [1923, 1925],
    sourceDrawingPage: 106,
  },
  scaleBasis:
    'Museum director P. V. Sytin’s 1926 firsthand account gives approximately 19.5 × 11.5 sazhen and 30 sazhen height. The 41.6 × 24.5 m base and 64 m envelope use those dimensions; archival plans, the reproduced measured elevation/sections (plate 106), and the Museum of Moscow photograph determine tier proportions, the asymmetric galleries, eastern staircase and carved details. Small details and vertical tier levels are a proportional reconstruction, not a claim of surviving surveyed fabric.',
  geographicProposal: {
    ...map.proposal,
    status: 'historical-proposal',
    source: map.sourceUrl,
    anchor: map.anchor,
    heading: map.heading,
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(mapBytes).digest('hex')}`,
    evidence: map.notes,
    limitations:
      'Historical-map registration accuracy is recorded in map-frame.json. Present-day roads and surrounding buildings do not constitute a reconstructed 1930 streetscape.',
  },
  limits: [
    'Dated 1930 exterior only. The building was demolished in 1934; the model requires explicit historical-date opt-in.',
    'Archive descriptions give approximate total dimensions. Tier elevations, individual relief profiles, glazed tile colors and stair subdivisions are reconstructed from drawings and monochrome photographs; they are not an archaeological survey.',
    'The imperial eagle, obsolete staircase canopy, removed northern chapel and pre-1701 high chamber roofs are intentionally absent. Interiors, museum displays and surrounding tram infrastructure are outside this exterior asset.',
  ],
  cameras: [
    { name: 'southern-gate-and-windows', position: [34, 22, 60], lookAt: [0, 16, 0] },
    { name: 'north-five-arches', position: [-34, 25, -62], lookAt: [0, 19, 0] },
    { name: 'eastern-staircase', position: [63, 19, 38], lookAt: [24, 10, 5] },
    { name: 'western-loggia', position: [-49, 19, -12], lookAt: [-8, 17, 0] },
    { name: 'clock-and-belfry', position: [18, 47, 30], lookAt: [0, 45, 0] },
    { name: 'carved-window-surrounds', position: [9, 22, 27], lookAt: [6, 20, 9] },
    { name: 'arch-through-passage', position: [-2, 3, 26], lookAt: [0, 4, 0] },
    { name: 'roof-and-tilework', position: [24, 68, -26], lookAt: [0, 42, 0] },
    { name: 'far-silhouette', position: [102, 72, 126], lookAt: [4, 29, 0] },
  ],
};

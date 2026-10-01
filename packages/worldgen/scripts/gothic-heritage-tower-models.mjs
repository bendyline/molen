/** Individually researched Gothic monument exteriors, with original sculptural detail. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  annulus,
  archBay,
  column,
  facade,
  finial,
  frame,
  tau,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

function rosette(out, x, y, z, r, color, petals = 4) {
  for (let petal = 0; petal < petals; petal++)
    for (let i = 0; i < 18; i++) {
      const a = (petal / petals) * tau,
        b = (i / 18) * tau,
        c = ((i + 1) / 18) * tau;
      const p = (t) => [
        x + Math.cos(a) * r * 0.43 + Math.cos(t) * r * 0.54,
        y + Math.sin(a) * r * 0.43 + Math.sin(t) * r * 0.54,
        z,
      ];
      beam(out, 'limestone', p(b), p(c), r * 0.11, r * 0.13, color);
    }
}
function pointedLine(out, x, y0, spring, rise, width, z, color, thickness = 0.12) {
  const r = width / 2,
    arch = (a) =>
      spring + (rise * Math.sqrt(Math.max(0, 4 - (Math.abs(a) / r + 1) ** 2))) / Math.sqrt(3);
  for (let i = 0; i < 28; i++) {
    const a = -r + (i * width) / 28,
      b = -r + ((i + 1) * width) / 28;
    beam(out, 'limestone', [x + a, arch(a), z], [x + b, arch(b), z], thickness, thickness, color);
  }
  for (const s of [-1, 1])
    beam(out, 'limestone', [x + s * r, y0, z], [x + s * r, spring, z], thickness, thickness, color);
}
function crockets(out, x, y, z, height, color) {
  finial(out, x, y, z, height, color);
  for (let i = 1; i <= 4; i++)
    for (const s of [-1, 1]) {
      const yy = y + i * height * 0.16;
      sphere(
        out,
        'limestone',
        [x + s * 0.16 * (1 - i * 0.12), yy, z],
        [0.11, 0.14, 0.12],
        color,
        8,
        6,
      );
    }
}
function figure(out, x, y, z, height, color, kind = 'saint', turn = 0) {
  const a = transform(out, turn, [x, y, z]),
    h = height;
  // Original draped figures: separately modeled body, folded cloak, head and gesturing arms.
  loft(
    a,
    'carvedstone',
    [
      [0, 0.19, 0.12],
      [0.42, 0.2, 0.14],
      [0.68, 0.16, 0.115],
      [0.76, 0.13, 0.11],
    ].map(([yy, rx, rz]) => radialRing(yy * h, rx * h, rz * h, 20)),
    color,
  );
  sphere(a, 'carvedstone', [0, 0.86 * h, 0], [0.092 * h, 0.115 * h, 0.09 * h], color, 16, 12);
  for (let i = 0; i < 7; i++)
    beam(
      a,
      'carvedstone',
      [(i - 3) * h * 0.04, 0.06 * h, 0.13 * h],
      [(i - 3) * h * 0.025, 0.67 * h, 0.1 * h],
      0.024 * h,
      0.022 * h,
      color,
    );
  beam(
    a,
    'carvedstone',
    [-0.15 * h, 0.69 * h, 0],
    [-0.22 * h, 0.47 * h, 0.08 * h],
    0.095 * h,
    0.085 * h,
    color,
  );
  beam(
    a,
    'carvedstone',
    [0.15 * h, 0.68 * h, 0],
    [0.24 * h, 0.72 * h, 0.13 * h],
    0.095 * h,
    0.085 * h,
    color,
  );
  for (const s of [-1, 1])
    sphere(
      a,
      'carvedstone',
      [s * 0.1 * h, 0.025 * h, 0.09 * h],
      [0.075 * h, 0.04 * h, 0.11 * h],
      color,
      12,
      8,
    );
  if (kind === 'pilgrim') {
    beam(
      a,
      'wood',
      [0.29 * h, 0, 0.12 * h],
      [0.29 * h, 1.08 * h, 0.12 * h],
      0.028 * h,
      0.028 * h,
      [0.47, 0.4, 0.3],
    );
    loft(
      a,
      'carvedstone',
      [radialRing(0.91 * h, 0.14 * h, 0.11 * h, 24), radialRing(0.94 * h, 0.14 * h, 0.11 * h, 24)],
      color,
    );
    box(a, 'carvedstone', [-0.22 * h, 0.41 * h, 0.02 * h], [-0.11 * h, 0.59 * h, 0.13 * h], color);
  }
  if (kind === 'king') {
    annulus(
      transform(a, 0, [0, 0.935 * h, 0]),
      'carvedstone',
      0.06 * h,
      0.11 * h,
      0,
      0.035 * h,
      color,
      16,
    );
    for (let i = 0; i < 5; i++)
      sphere(
        a,
        'carvedstone',
        [Math.cos((i / 5) * tau) * 0.086 * h, 0.992 * h, Math.sin((i / 5) * tau) * 0.086 * h],
        [0.022 * h, 0.046 * h, 0.022 * h],
        color,
        8,
        6,
      );
  }
  if (kind === 'angel')
    for (const s of [-1, 1])
      for (let j = 0; j < 8; j++)
        beam(
          a,
          'carvedstone',
          [s * 0.13 * h, 0.62 * h, -0.1 * h],
          [s * (0.38 - j * 0.017) * h, (0.83 - j * 0.07) * h, -0.17 * h],
          0.09 * h,
          0.045 * h,
          color,
        );
  box(a, 'carvedstone', [-0.09 * h, 0.54 * h, 0.12 * h], [0.11 * h, 0.68 * h, 0.18 * h], color);
}
function niche(out, x, y, z, height, color, kind = 'saint') {
  archBay(
    out,
    'limestone',
    x,
    height * 0.53,
    y,
    y + height * 0.86,
    height * 0.4,
    y + height * 1.3,
    z,
    0.21,
    color,
    { pointed: true, trim: 0.075 },
  );
  figure(out, x, y + 0.08, z - 0.02, height * 0.91, color, kind);
  const w = height * 0.68;
  box(out, 'limestone', [x - w * 0.58, y - 0.2, z - 0.12], [x + w * 0.58, y, z + 0.4], color);
  for (const s of [-1, 1])
    column(out, 'limestone', x + (s * w) / 2, z + 0.22, y, y + height * 1.2, 0.055, color, 8);
  for (const s of [-1, 1])
    beam(
      out,
      'limestone',
      [x + s * w * 0.58, y + height * 1.18, z + 0.35],
      [x, y + height * 1.57, z + 0.35],
      0.11,
      0.15,
      color,
    );
  crockets(out, x, y + height * 1.57, z + 0.35, height * 0.29, color);
}
function animal(out, x, y, z, kind, color, turn) {
  const a = transform(out, turn, [x, y, z]);
  if (kind === 'angel') {
    figure(a, 0, 0, 0, 1.8, color, 'angel');
    return;
  }
  if (kind === 'eagle') {
    sphere(a, 'carvedstone', [0, 0.7, 0], [0.37, 0.63, 0.34], color, 16, 12);
    sphere(a, 'carvedstone', [0, 1.34, 0.1], [0.19, 0.22, 0.2], color, 14, 10);
    for (const s of [-1, 1])
      for (let i = 0; i < 10; i++)
        beam(
          a,
          'carvedstone',
          [s * 0.25, 0.85, -0.04],
          [s * (1.2 - i * 0.08), 1.3 - i * 0.09, -0.22],
          0.16,
          0.1,
          color,
        );
    beam(a, 'carvedstone', [0, 1.36, 0.2], [0, 1.3, 0.49], 0.1, 0.12, color);
    return;
  }
  sphere(a, 'carvedstone', [0, 0.53, 0], [0.43, 0.47, 0.84], color, 20, 12);
  sphere(a, 'carvedstone', [0, 0.97, 0.61], [0.34, 0.36, 0.31], color, 16, 12);
  sphere(a, 'carvedstone', [0, 0.8, 0.9], [0.27, 0.17, 0.23], color, 16, 10);
  for (const s of [-1, 1])
    for (const z of [-0.5, 0.48])
      beam(a, 'carvedstone', [s * 0.32, 0.47, z], [s * 0.33, 0.05, z + 0.14], 0.17, 0.2, color);
  if (kind === 'bull')
    for (const s of [-1, 1])
      beam(a, 'carvedstone', [s * 0.23, 1.12, 0.62], [s * 0.44, 1.4, 0.62], 0.085, 0.085, color);
  if (kind === 'lion') sphere(a, 'carvedstone', [0, 1.0, 0.47], [0.48, 0.46, 0.32], color, 20, 12);
  for (const s of [-1, 1])
    for (let i = 0; i < 7; i++)
      beam(
        a,
        'carvedstone',
        [s * 0.36, 0.6, -0.25],
        [s * (0.64 + i * 0.025), 0.95 + i * 0.065, -0.7 + i * 0.045],
        0.13,
        0.08,
        color,
      );
}

function buildSaintJacques(out) {
  const stone = [0.83, 0.76, 0.61],
    trim = [0.9, 0.83, 0.69],
    recess = [0.24, 0.22, 0.18];
  box(out, 'limestone', [-6.2, 0, -5.8], [6.2, 0.65, 5.8], stone);
  // Ground-floor through arches remain open around Pascal's sheltered monument.
  for (const x of [-4.4, 4.4])
    for (const z of [-4.2, 4.2])
      box(out, 'limestone', [x - 1.1, 0.65, z - 1], [x + 1.1, 7.4, z + 1], stone);
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2),
      w = side % 2 ? 10.4 : 11.2,
      z = side % 2 ? 5.6 : 5.2;
    archBay(wall, 'limestone', 0, 6.5, 0.65, 4.6, 2.7, 8.15, z, 1.5, stone, {
      pointed: true,
      back: false,
      trim: 0.25,
    });
    for (const sign of [-1, 1])
      box(
        wall,
        'limestone',
        [sign < 0 ? -w / 2 : 3.25, 0.65, z - 1.5],
        [sign < 0 ? -3.25 : w / 2, 8.15, z],
        stone,
      );
  }
  box(out, 'limestone', [-1.05, 0.65, -1.05], [1.05, 1.75, 1.05], trim);
  figure(out, 0, 1.75, 0, 3.8, trim);
  // Long paired lancets, separately modeled mullions and flame-like carved tracery.
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2),
      w = side % 2 ? 10.4 : 11.2,
      z = side % 2 ? 5.6 : 5.2;
    const windows = [];
    for (const x of [-1.28, 1.28]) {
      windows.push({
        x,
        w: 1.72,
        y: 16.2,
        spring: 25.5,
        rise: 2.35,
        top: 28.0,
        depth: 0.68,
        pointed: true,
        trim: 0.16,
      });
      windows.push({
        x,
        w: 1.72,
        y: 30.4,
        spring: 45.8,
        rise: 2.45,
        top: 48.4,
        depth: 0.68,
        pointed: true,
        trim: 0.16,
      });
    }
    facade(wall, 'limestone', w, 8.15, 53.6, z, windows, stone);
    for (const win of windows) {
      for (let yy = win.y + 0.45; yy < win.spring; yy += 1.2)
        box(wall, 'wood', [win.x - 0.7, yy, z - 0.61], [win.x + 0.7, yy + 0.14, z - 0.51], recess);
      box(
        wall,
        'limestone',
        [win.x - 0.055, win.y, z - 0.18],
        [win.x + 0.055, win.spring + 0.5, z + 0.02],
        trim,
      );
      pointedLine(
        wall,
        win.x,
        win.y,
        win.spring + 0.2,
        win.rise + 0.22,
        win.w + 0.44,
        z + 0.1,
        trim,
        0.12,
      );
    }
    for (const x of [-3.7, 0, 3.7]) {
      for (const y of [8.7, 29.0, 48.6]) {
        pointedLine(wall, x, y, y + 2.3, 1.8, 1.7, z + 0.1, trim, 0.095);
        rosette(wall, x, y + 2.8, z + 0.18, 0.38, trim, 3);
        crockets(wall, x, y + 4.2, z + 0.16, 0.62, trim);
      }
      if (x)
        for (const yy of [17, 32])
          for (const offset of [-0.37, 0.37])
            column(wall, 'limestone', x + offset, z + 0.14, yy, yy + 10, 0.045, trim, 8);
    }
    // Nineteen restored facade saints occupy two stages and intermediate niches.
    for (const x of [-4.1, 4.1])
      for (const y of [12.0, 39.0]) niche(wall, x, y, z + 0.16, 2.5, trim);
    if (side !== 2) niche(wall, 0, 10.4, z + 0.2, 2.5, trim);
    for (const y of [15, 29, 48.9, 52.8])
      box(wall, 'limestone', [-w / 2 - 0.18, y, z - 0.02], [w / 2 + 0.18, y + 0.2, z + 0.36], trim);
    for (let i = 0; i < 22; i++)
      box(
        wall,
        'limestone',
        [-w / 2 + (i * w) / 22, 52.35, z + 0.02],
        [-w / 2 + (i * w) / 22 + 0.22, 52.83, z + 0.45],
        trim,
      );
    for (let i = 0; i < 10; i++) {
      const x = ((i - 4.5) * w) / 10;
      pointedLine(wall, x, 53.65, 54.08, 0.39, w / 11, z + 0.28, trim, 0.085);
      box(wall, 'limestone', [x - 0.04, 53.6, z + 0.17], [x + 0.04, 54.68, z + 0.4], trim);
    }
    box(wall, 'limestone', [-w / 2 - 0.15, 54.61, z + 0.1], [w / 2 + 0.15, 54.82, z + 0.46], trim);
  }
  // Paired buttress shafts at the four corners step inward through each historic stage.
  for (const x of [-5.2, 5.2])
    for (const z of [-4.8, 4.8]) {
      for (const [y0, y1, r] of [
        [0.65, 15, 1.0],
        [15, 29, 0.86],
        [29, 48.8, 0.68],
        [48.8, 54, 0.56],
      ]) {
        box(out, 'limestone', [x - r, y0, z - r], [x + r, y1, z + r], stone);
        loft(
          out,
          'limestone',
          [
            radialRing(y1, r * 1.4, r * 1.4, 4, [x, z], Math.PI / 4),
            radialRing(y1 + 0.4, r * 0.95, r * 0.95, 4, [x, z], Math.PI / 4),
          ],
          trim,
        );
        for (const dx of [-r * 0.63, r * 0.63])
          column(
            out,
            'limestone',
            x + dx,
            z + (z > 0 ? r : -r),
            y0 + 0.5,
            y1 - 0.3,
            0.055,
            trim,
            8,
          );
      }
      for (const yy of [29, 51.6]) {
        const dir = Math.sign(z);
        beam(out, 'limestone', [x, yy, z], [x, yy - 0.2, z + dir * 2.15], 0.26, 0.36, trim);
        sphere(out, 'limestone', [x, yy - 0.17, z + dir * 2.15], [0.21, 0.25, 0.31], trim, 12, 8);
      }
    }
  box(out, 'slate', [-5.3, 53.45, -5.05], [5.3, 53.65, 5.05], [0.41, 0.41, 0.36]);
  // The official tourist board identifies the raised pilgrim statue at the northwest corner.
  const northwest = transform(out, 0, [-4.75, 0, -4.75]);
  loft(
    northwest,
    'limestone',
    [
      [54, 0.96],
      [57.2, 0.62],
      [57.55, 0.74],
    ].map(([y, r]) => radialRing(y, r, r, 8)),
    trim,
  );
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * tau;
    beam(
      northwest,
      'limestone',
      [Math.cos(a) * 1.6, 54, Math.sin(a) * 1.6],
      [Math.cos(a) * 0.55, 57, Math.sin(a) * 0.55],
      0.22,
      0.26,
      trim,
    );
    crockets(northwest, Math.cos(a) * 1.15, 55.2, Math.sin(a) * 1.15, 1.3, trim);
  }
  figure(northwest, 0, 57.55, 0, 3, trim, 'pilgrim', Math.PI);
  for (const [x, z, kind] of [
    [4.75, -4.75, 'eagle'],
    [4.75, 4.75, 'lion'],
    [-4.75, 4.75, 'bull'],
  ]) {
    box(out, 'limestone', [x - 0.7, 54, z - 0.7], [x + 0.7, 54.7, z + 0.7], trim);
    animal(out, x, 54.7, z, kind, trim, Math.atan2(x, z));
  }
  animal(out, -4.75, 54.75, -4.75, 'angel', trim, Math.PI);
}

function buildPowder(out) {
  const stone = [0.41, 0.36, 0.29],
    trim = [0.65, 0.57, 0.44],
    roof = [0.47, 0.44, 0.34],
    gold = [0.84, 0.63, 0.21];
  const a = transform(out, 0, [-0.4, 0, 0]),
    width = 14.5,
    depth = 14.15;
  for (const side of [0, 2]) {
    const wall = transform(a, (side * Math.PI) / 2);
    archBay(wall, 'limestone', 0, 7.15, 0, 5.5, 4.65, 13.8, depth / 2, depth, stone, {
      pointed: true,
      back: false,
      trim: 0.3,
    });
    for (const sign of [-1, 1])
      box(
        wall,
        'limestone',
        [sign < 0 ? -width / 2 : 3.575, 0, depth / 2 - 1.4],
        [sign < 0 ? -3.575 : width / 2, 13.8, depth / 2],
        stone,
      );
    for (let row = 0; row < 4; row++)
      pointedLine(
        wall,
        0,
        0.05,
        5.5 + row * 0.11,
        4.65 + row * 0.11,
        7.15 + row * 0.26,
        depth / 2 + 0.03 + row * 0.025,
        trim,
        0.11,
      );
  }
  for (const side of [-1, 1])
    box(
      a,
      'limestone',
      [side < 0 ? -width / 2 : 3.575, 0, -depth / 2],
      [side < 0 ? -3.575 : width / 2, 13.8, depth / 2],
      stone,
    );
  // Ribbed passage follows the open portal, never a dark painted rectangle.
  for (const z of [-6.3, -2.1, 2.1, 6.3]) pointedLine(a, 0, 0, 5.5, 4.65, 7.16, z, trim, 0.16);
  for (let side = 0; side < 4; side++) {
    const wall = transform(a, (side * Math.PI) / 2),
      w = side % 2 ? depth : width,
      z = side % 2 ? width / 2 : depth / 2;
    const win =
      side % 2
        ? [
            { x: 0, w: 2, y: 19, spring: 23.5, rise: 0.05, top: 23.6, depth: 0.4 },
            { x: 0, w: 2.5, y: 29, spring: 35.8, rise: 0.05, top: 35.9, depth: 0.4 },
          ]
        : [
            { x: 0, w: 2.5, y: 16.2, spring: 21, rise: 0.08, top: 21.1, depth: 0.45 },
            ...[-2.15, 2.15].map((x) => ({
              x,
              w: 1.8,
              y: 28,
              spring: 34.2,
              rise: 0.1,
              top: 34.35,
              depth: 0.45,
            })),
          ];
    facade(wall, 'limestone', w, 13.8, 43.8, z, win, stone);
    for (const v of win) {
      frame(wall, 'limestone', v.x, v.y, v.w, v.top - v.y, z + 0.06, 0.19, trim);
      box(wall, 'limestone', [v.x - 0.06, v.y, z - 0.17], [v.x + 0.06, v.top, z - 0.05], trim);
      for (let yy = v.y + 0.9; yy < v.top; yy += 1.2)
        box(
          wall,
          'metal',
          [v.x - v.w / 2, yy, z - 0.18],
          [v.x + v.w / 2, yy + 0.06, z - 0.1],
          [0.35, 0.32, 0.26],
        );
    }
    for (const y of [13.5, 25.3, 42.6, 43.7])
      box(wall, 'limestone', [-w / 2 - 0.1, y, z - 0.15], [w / 2 + 0.1, y + 0.36, z + 0.31], trim);
    if (side % 2 === 0) {
      for (const x of [-4.8, 4.8]) niche(wall, x, 17.2, z + 0.24, 3.4, trim, 'king');
      for (const x of [-4.8, 0, 4.8])
        niche(wall, x, 35.8, z + 0.23, 2.0, trim, side === 0 ? 'saint' : 'angel');
      for (const x of [-2.2, 2.2]) {
        pointedLine(wall, x, 22, 23.5, 2.8, 4.1, z + 0.32, trim, 0.14);
        rosette(wall, x, 24.25, z + 0.36, 0.45, trim);
      }
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 1.76;
        pointedLine(wall, x, 38.7, 40.7, 1.6, 1.72, z + 0.26, trim, 0.15);
        crockets(wall, x, 42.34, z + 0.28, 0.53, trim);
      }
    }
    for (let i = 0; i < 14; i++) {
      const x = (i - 6.5) * (w / 14);
      box(wall, 'limestone', [x - 0.25, 42.95, z + 0.04], [x + 0.25, 43.65, z + 0.52], trim);
      rosette(wall, x, 44.93, z + 0.2, 0.38, trim, 4);
      box(wall, 'limestone', [x - 0.045, 43.9, z + 0.02], [x + 0.045, 46, z + 0.36], trim);
    }
    box(wall, 'limestone', [-w / 2 - 0.1, 43.83, z - 0.02], [w / 2 + 0.1, 44.08, z + 0.4], trim);
    box(wall, 'limestone', [-w / 2 - 0.1, 45.84, z - 0.02], [w / 2 + 0.1, 46.07, z + 0.4], trim);
  }
  for (const x of [-6.85, 6.7])
    for (const z of [-6.6, 6.6]) {
      column(a, 'limestone', x, z, 13.8, 44.1, 0.43, trim, 16);
      loft(
        a,
        'limestone',
        [
          [43.7, 0.8],
          [44.1, 0.85],
          [46.25, 0.69],
        ].map(([y, r]) => radialRing(y, r, r, 8, [x, z])),
        trim,
      );
      loft(
        a,
        'slate',
        [
          [46.2, 0.76],
          [50.95, 0.055],
        ].map(([y, r]) => radialRing(y, r, r, 8, [x, z])),
        roof,
      );
      beam(a, 'metal', [x, 50.7, z], [x, 52.1, z], 0.055, 0.055, gold);
      sphere(a, 'metal', [x, 51.28, z], [0.15, 0.18, 0.15], gold, 12, 8);
      for (const yy of [16.2, 25.5, 35.5]) {
        loft(
          a,
          'limestone',
          [
            [yy - 0.45, 0.65],
            [yy, 0.84],
            [yy + 0.18, 0.6],
          ].map(([y, r]) => radialRing(y, r, r, 8, [x, z])),
          trim,
        );
        crockets(a, x, yy + 0.2, z, 0.92, trim);
      }
    }
  // A steep chisel roof with a north/south ridge, two front dormers and golden ridge fittings.
  const roofRings = [
    [
      [-6.9, 45.7, -6.65],
      [-6.9, 45.7, 6.65],
      [6.9, 45.7, 6.65],
      [6.9, 45.7, -6.65],
    ],
    [
      [-3.2, 62.5, -0.07],
      [-3.2, 62.5, 0.07],
      [3.2, 62.5, 0.07],
      [3.2, 62.5, -0.07],
    ],
  ];
  loft(a, 'slate', roofRings, roof);
  for (const s of [-1, 1]) {
    for (const [y, x] of [
      [50.2, 0],
      [57.15, 0],
    ]) {
      const z = s * ((6.65 * (62.5 - y)) / 16.8 + 0.05),
        wall = transform(a, s > 0 ? 0 : Math.PI, [0, 0, z]);
      box(wall, 'limestone', [-0.54, y, 0], [0.54, y + 1.2, 0.53], trim);
      archBay(wall, 'limestone', x, 0.57, y + 0.2, y + 0.75, 0.21, y + 1.08, 0.54, 0.1, trim, {
        pointed: true,
        trim: 0.075,
      });
      triangle(
        wall,
        'slate',
        [
          [-0.67, y + 1.15, 0.59],
          [0.67, y + 1.15, 0.59],
          [0, y + 1.9, 0.59],
        ],
        roof,
      );
      crockets(wall, 0, y + 1.9, 0.58, 0.36, gold);
    }
    beam(a, 'metal', [s * 3.25, 62.3, 0], [s * 3.25, 65, 0], 0.09, 0.09, gold);
    sphere(a, 'metal', [s * 3.25, 63.55, 0], [0.2, 0.23, 0.2], gold, 16, 10);
  }
  beam(a, 'metal', [-3.25, 63, 0], [3.25, 63, 0], 0.08, 0.08, gold);
  for (let x = -3; x < 3.01; x += 0.45) {
    beam(a, 'metal', [x, 62.45, 0], [x, 63.65, 0], 0.04, 0.04, gold);
    sphere(a, 'metal', [x, 63.65, 0], [0.07, 0.07, 0.07], gold, 8, 6);
  }
  // Eastern stair turret is recorded by the exact mapped rounded projection.
  loft(
    out,
    'limestone',
    [
      [0, 0.8],
      [26, 0.8],
      [26.5, 0.62],
    ].map(([y, r]) => radialRing(y, r, r, 24, [7.45, -3.68])),
    stone,
  );
  loft(
    out,
    'slate',
    [
      radialRing(26.45, 0.89, 0.89, 12, [7.45, -3.68]),
      radialRing(28, 0.04, 0.04, 12, [7.45, -3.68]),
    ],
    roof,
  );
}

function buildVictoria(out) {
  const stone = [0.77, 0.64, 0.42],
    trim = [0.87, 0.75, 0.53],
    roof = [0.31, 0.37, 0.35],
    gold = [0.88, 0.64, 0.2];
  // Authored in the exact mapped square frame: +X north, −Z west toward Abingdon Street.
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2),
      porch = side === 2 || side === 3;
    const windows = [];
    if (porch)
      windows.push({
        x: 0,
        w: 8.4,
        y: 0,
        spring: 11.7,
        rise: 5.9,
        top: 19.2,
        depth: 2.1,
        pointed: true,
        back: false,
        trim: 0.31,
      });
    else
      for (const x of [-4.15, 0, 4.15])
        windows.push({
          x,
          w: 2.9,
          y: 3.3,
          spring: 14,
          rise: 2.5,
          top: 17.1,
          depth: 0.7,
          pointed: true,
          trim: 0.16,
        });
    for (const [y, spring, top] of [
      [20.5, 31.2, 33.8],
      [46.5, 65, 67.7],
    ])
      for (const x of [-4.15, 0, 4.15])
        windows.push({
          x,
          w: 3.16,
          y,
          spring,
          rise: 2.55,
          top,
          depth: 0.85,
          pointed: true,
          trim: 0.19,
        });
    for (const [y, top] of [
      [37.0, 41.1],
      [71.4, 75.6],
    ])
      for (let i = 0; i < 7; i++)
        windows.push({
          x: (i - 3) * 1.62,
          w: 1.03,
          y,
          spring: top - 0.75,
          rise: 0.69,
          top,
          depth: 0.57,
          pointed: true,
          trim: 0.11,
        });
    facade(wall, 'limestone', 20.15, 0, 80.4, 10.075, windows, stone);
    for (const w of windows) {
      if (w.w > 5) continue;
      if (w.w > 2) {
        for (const sign of [-1, 1])
          box(
            wall,
            'limestone',
            [w.x + sign * 0.51 - 0.045, w.y, 9.4],
            [w.x + sign * 0.51 + 0.045, w.spring + 0.3, 9.72],
            trim,
          );
        for (let yy = w.y + 1; yy < w.spring; yy += 1.5)
          box(
            wall,
            'metal',
            [w.x - w.w / 2 + 0.11, yy, 9.36],
            [w.x + w.w / 2 - 0.11, yy + 0.065, 9.48],
            [0.36, 0.37, 0.3],
          );
        const middle = (w.y + w.spring) / 2;
        box(
          wall,
          'limestone',
          [w.x - w.w / 2, middle, 9.43],
          [w.x + w.w / 2, middle + 0.27, 9.75],
          trim,
        );
        rosette(wall, w.x, w.spring + 0.43, 9.72, 0.52, trim);
        pointedLine(wall, w.x, w.y, w.spring + 0.55, 2.66, w.w + 0.62, 10.27, trim, 0.17);
        for (const s of [-1, 1])
          beam(
            wall,
            'limestone',
            [w.x + s * (w.w / 2 + 0.31), w.spring + 0.55, 10.27],
            [w.x, w.top + 1.22, 10.27],
            0.16,
            0.18,
            trim,
          );
        crockets(wall, w.x, w.top + 1.2, 10.27, 0.69, trim);
      }
    }
    // Perpendicular blind panels, pin shafts, Tudor roses and portcullis relief bands.
    for (const y of [18.4, 34.6, 42.3, 68.9, 76.8]) {
      box(wall, 'limestone', [-10.15, y, 9.9], [10.15, y + 0.35, 10.42], trim);
      for (let i = 0; i < 12; i++) {
        const x = (i - 5.5) * 1.23;
        frame(wall, 'limestone', x, y + 0.58, 0.98, 1.15, 10.15, 0.08, trim);
        if (i % 2) rosette(wall, x, y + 1.12, 10.29, 0.35, trim, 5);
        else {
          for (let dx = -0.3; dx <= 0.31; dx += 0.15)
            beam(
              wall,
              'limestone',
              [x + dx, y + 0.68, 10.31],
              [x + dx, y + 1.46, 10.31],
              0.055,
              0.055,
              trim,
            );
          for (const yy of [y + 0.87, y + 1.14])
            box(wall, 'limestone', [x - 0.34, yy, 10.28], [x + 0.34, yy + 0.055, 10.37], trim);
        }
      }
    }
    for (const x of [-7.4, -6.35, 6.35, 7.4]) {
      box(wall, 'limestone', [x - 0.085, 2.0, 10.04], [x + 0.085, 78.8, 10.32], trim);
      for (const y of [5, 23, 48]) {
        pointedLine(wall, x, y, y + 8.3, 1.0, 0.82, 10.34, trim, 0.085);
        rosette(wall, x, y + 5.7, 10.35, 0.2, trim);
      }
    }
    if (porch) {
      // West and south porch arches open into the same vaulted ceremonial entrance.
      for (let j = 0; j < 5; j++)
        pointedLine(
          wall,
          0,
          0,
          11.7 + j * 0.12,
          5.9 + j * 0.15,
          8.4 + j * 0.42,
          10.12 + j * 0.035,
          trim,
          0.14,
        );
      for (const x of [-6.1, 6.1]) niche(wall, x, 9.4, 10.27, 3.2, trim, 'saint');
      for (let x = -4; x <= 4; x += 0.34)
        beam(wall, 'metal', [x, 0, 10.21], [x, 3.9, 10.21], 0.075, 0.075, [0.15, 0.18, 0.16]);
      for (const y of [1.4, 3.6])
        box(wall, 'metal', [-4.17, y, 10.15], [4.17, y + 0.085, 10.29], gold);
    }
  }
  // The historic primary account places the inner royal doorway on the north wall.
  const inner = transform(out, -Math.PI / 2);
  box(inner, 'limestone', [-8.1, 0, -8.45], [8.1, 19.2, -8.15], stone);
  box(inner, 'wood', [-3.6, 0, -8.14], [3.6, 8.4, -7.94], [0.17, 0.14, 0.11]);
  archBay(inner, 'limestone', 0, 7.4, 0, 8.5, 3.5, 17.65, -7.86, 0.38, trim, {
    pointed: true,
    back: false,
    trim: 0.28,
  });
  for (let x = -3.25; x <= 3.3; x += 0.65)
    for (let y = 0.4; y < 8; y += 1.02) frame(inner, 'metal', x, y, 0.49, 0.73, -7.88, 0.035, gold);
  for (const x of [-5.6, 5.6]) niche(inner, x, 9.4, -7.83, 3.2, trim, 'saint');
  rosette(inner, 0, 13.7, -7.81, 1.1, trim, 5);
  // Recessed vault roof and crossed ribs retain real openings below both outer arches.
  box(out, 'limestone', [-8.1, 18.85, -8.1], [8.1, 19.2, 8.1], stone);
  for (const sign of [-1, 1])
    for (let i = 0; i < 24; i++) {
      const t = i / 24,
        u = (i + 1) / 24;
      const p = (v) => [
        (v - 0.5) * 16,
        17.45 + 1.34 * Math.sin(v * Math.PI),
        sign * (v - 0.5) * 16,
      ];
      beam(out, 'limestone', p(t), p(u), 0.24, 0.24, trim);
    }
  sphere(out, 'carvedstone', [0, 18.7, 0], [0.53, 0.22, 0.53], trim, 20, 12);
  // Four octagonal turrets are continuous buttresses with independent upper lanterns.
  for (const x of [-9.53, 9.53])
    for (const z of [-9.51, 9.51]) {
      loft(
        out,
        'limestone',
        [
          [0, 2.35],
          [0.6, 2.35],
          [1, 2.18],
          [78.1, 2.18],
          [78.65, 2.34],
        ].map(([y, r]) => radialRing(y, r, r, 8, [x, z], Math.PI / 8)),
        stone,
      );
      for (const y of [18.5, 34.6, 42.3, 68.9, 76.8, 78.7])
        loft(
          out,
          'limestone',
          [
            [y, 2.23],
            [y + 0.28, 2.4],
            [y + 0.68, 2.42],
            [y + 0.84, 2.23],
          ].map(([yy, r]) => radialRing(yy, r, r, 8, [x, z], Math.PI / 8)),
          trim,
        );
      for (let side = 0; side < 8; side++) {
        const a = (side * tau) / 8,
          wall = transform(out, a, [x, 0, z]);
        for (const yy of [3.8, 23.7, 47.5]) {
          pointedLine(wall, 0, yy, yy + 8.3, 0.85, 1.1, 2.04, trim, 0.08);
          for (const s of [-1, 1])
            box(
              wall,
              'limestone',
              [s * 0.42 - 0.04, yy, 2.04],
              [s * 0.42 + 0.04, yy + 9, 2.2],
              trim,
            );
        }
        for (const yy of [80.1, 87.0]) {
          archBay(wall, 'limestone', 0, 1.09, yy, yy + 4.45, 0.66, yy + 5.36, 2.1, 0.35, trim, {
            pointed: true,
            back: false,
            trim: 0.12,
          });
          for (const s of [-1, 1])
            column(wall, 'limestone', s * 0.73, 2.1, yy, yy + 5.35, 0.13, trim, 10);
        }
        const corner = a + Math.PI / 8;
        beam(
          out,
          'limestone',
          [x + Math.sin(corner) * 2.09, 78.8, z + Math.cos(corner) * 2.09],
          [x + Math.sin(corner) * 2.09, 92.6, z + Math.cos(corner) * 2.09],
          0.18,
          0.18,
          trim,
        );
      }
      for (const y of [79.9, 85.8, 86.5, 92.5])
        loft(
          out,
          'limestone',
          [
            radialRing(y, 2.39, 2.39, 8, [x, z], Math.PI / 8),
            radialRing(y + 0.28, 2.39, 2.39, 8, [x, z], Math.PI / 8),
          ],
          trim,
        );
      loft(
        out,
        'limestone',
        [
          [92.75, 2.38],
          [93.25, 2.34],
          [96.7, 0.23],
        ].map(([y, r]) => radialRing(y, r, r, 8, [x, z], Math.PI / 8)),
        stone,
      );
      for (let j = 0; j < 8; j++) {
        const a = (j * tau) / 8;
        for (let k = 0; k < 5; k++) {
          const y = 93.2 + k * 0.59,
            r = 2.25 - k * 0.37;
          sphere(
            out,
            'carvedstone',
            [x + Math.cos(a) * r, y, z + Math.sin(a) * r],
            [0.2, 0.21, 0.19],
            trim,
            10,
            6,
          );
        }
      }
      column(out, 'limestone', x, z, 96.7, 97.65, 0.2, trim, 12);
      sphere(out, 'metal', [x, 97.92, z], [0.37, 0.35, 0.37], gold, 20, 12);
      beam(out, 'metal', [x, 98.12, z], [x, 98.5, z], 0.08, 0.08, gold);
    }
  // Slate mansard and its tall dormer openings, beneath the open gilded crown.
  box(out, 'limestone', [-10.075, 80.05, -10.075], [10.075, 80.25, 10.075], stone);
  loft(
    out,
    'slate',
    [
      [
        [-8.1, 80.25, -8.1],
        [-8.1, 80.25, 8.1],
        [8.1, 80.25, 8.1],
        [8.1, 80.25, -8.1],
      ],
      [
        [-5.1, 87, -5.1],
        [-5.1, 87, 5.1],
        [5.1, 87, 5.1],
        [5.1, 87, -5.1],
      ],
    ],
    roof,
  );
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    for (const x of [-4.6, 0, 4.6]) {
      const dormer = transform(wall, 0, [x, 0, 0]);
      facade(
        dormer,
        'limestone',
        2.2,
        79.7,
        84.3,
        8.07,
        [
          {
            x: 0,
            w: 1.28,
            y: 80.1,
            spring: 83.3,
            rise: 0.7,
            top: 84.22,
            depth: 0.3,
            pointed: true,
            trim: 0.13,
          },
        ],
        trim,
      );
      for (const s of [-1, 1])
        beam(wall, 'limestone', [x + s * 1.16, 84.2, 8.15], [x, 85.25, 8.15], 0.17, 0.22, trim);
      crockets(wall, x, 85.1, 8.15, 1.16, trim);
    }
    for (let i = 0; i < 12; i++) {
      const x = (i - 5.5) * 0.96;
      rosette(wall, x, 87.07, 5.67, 0.35, gold, 4);
      beam(wall, 'metal', [x, 86.35, 5.62], [x, 87.65, 5.62], 0.075, 0.075, gold);
    }
    beam(wall, 'metal', [-5.85, 86.45, 5.62], [5.85, 86.45, 5.62], 0.12, 0.12, gold);
    beam(wall, 'metal', [-5.85, 87.62, 5.62], [5.85, 87.62, 5.62], 0.12, 0.12, gold);
    for (const s of [-1, 1]) {
      beam(wall, 'metal', [s * 5.5, 87.7, 5.5], [0, 98.25, 0], 0.18, 0.18, gold);
      beam(wall, 'metal', [s * 4.95, 88, 5.1], [0, 97.7, 0.15], 0.14, 0.14, [0.2, 0.26, 0.24]);
    }
    for (let i = 0; i < 5; i++) {
      const x = (i - 2) * 2.07;
      pointedLine(wall, x, 87.6, 91, 1.5, 2.05, 5.05, gold, 0.11);
    }
  }
  for (const x of [-5.55, 5.55])
    for (const z of [-5.55, 5.55]) {
      beam(out, 'metal', [x, 86.4, z], [x, 93, z], 0.19, 0.19, gold);
      for (let i = 0; i < 4; i++)
        sphere(
          out,
          'metal',
          [x, 92.1 + i * 0.34, z],
          [0.19 - i * 0.031, 0.16, 0.19 - i * 0.031],
          gold,
          10,
          6,
        );
    }
  // Iron flagstaff, four slender stays and a geometrically colored Union flag.
  loft(
    out,
    'metal',
    [
      [94, 0.33],
      [98.5, 0.27],
      [111, 0.15],
      [120.15, 0.095],
    ].map(([y, r]) => radialRing(y, r, r, 20)),
    [0.14, 0.2, 0.19],
  );
  for (const x of [-5.3, 5.3])
    for (const z of [-5.3, 5.3])
      beam(out, 'metal', [x, 87.8, z], [0, 112.5, 0], 0.032, 0.032, [0.25, 0.29, 0.27]);
  sphere(out, 'metal', [0, 120.3, 0], [0.18, 0.2, 0.18], gold, 20, 12);
  const flag = (u, v) => [
    u * 7.2,
    118.7 - v * 3.6,
    0.28 + Math.sin(u * tau * 1.35) * 0.35 + u * 0.3,
  ];
  const cols = 72,
    rows = 36;
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      const u = (i + 0.5) / cols,
        v = (j + 0.5) / rows,
        x = 2 * u - 1,
        y = 2 * v - 1,
        diag = Math.min(Math.abs(y - x), Math.abs(y + x));
      let col = [0.08, 0.16, 0.36];
      if (diag < 0.17 || Math.abs(x) < 0.18 || Math.abs(y) < 0.26) col = [0.94, 0.94, 0.88];
      if (diag < 0.064 || Math.abs(x) < 0.105 || Math.abs(y) < 0.15) col = [0.73, 0.13, 0.17];
      const p = [
        flag(i / cols, j / rows),
        flag((i + 1) / cols, j / rows),
        flag((i + 1) / cols, (j + 1) / rows),
        flag(i / cols, (j + 1) / rows),
      ];
      triangle(out, 'carvedstone', [p[0], p[1], p[2]], col);
      triangle(out, 'carvedstone', [p[0], p[2], p[3]], col);
      triangle(out, 'carvedstone', [p[2], p[1], p[0]], col);
      triangle(out, 'carvedstone', [p[3], p[2], p[0]], col);
    }
}

export const gothicHeritageTowers = [
  {
    id: 'n0569_saint_jacques_tower',
    planId: 'N0569',
    title: 'Saint-Jacques Tower',
    wikidata: 'Q1431547',
    build: buildSaintJacques,
    authoringFile: 'gothic-heritage-tower-models.mjs',
    brief:
      'Flamboyant Gothic Paris bell tower with long paired lancets, dense carved tracery, stepped corner buttresses, nineteen facade saints, open parapet, gargoyles, four evangelist symbols and the raised northwest pilgrim statue.',
    size: [13.3, 60.8, 12.3],
    front: '+Z is the south facade; the elevated Saint James occupies the northwest (−X,−Z) corner',
    origin: 'Exact mapped tower centroid, pavement contact Y=0',
    refs: [
      'https://www.paris.fr/pages/sept-choses-a-savoir-sur-la-tour-saint-jacques-23432',
      'https://parisjetaime.com/culture/tour-saint-jacques-p993',
      'https://www.openstreetmap.org/way/20326709',
    ],
    facts: {
      terraceHeightMeters: 54,
      facadeSaintCount: 19,
      facadeStatueHeightMeters: 2.5,
      evangelistSymbols: ['lion', 'bull', 'eagle', 'angel'],
      saintJamesCorner: 'northwest',
      completionYear: 1523,
    },
    scaleBasis:
      'City of Paris terrace elevation and facade statue dimensions establish vertical scale; the exact OSM footprint constrains plan. Primary exterior photographs determine the two long lancet stages, carved blind tracery and stepped corner buttresses. The raised statue and pedestal extend above the 54 m terrace.',
    geographicProposal: {
      anchor: [2.348915931, 48.857997773],
      heading: -0.376231267483,
      source: 'https://www.openstreetmap.org/way/20326709',
      evidence:
        'Mapped wall axes and published northwest location of the raised Saint James jointly resolve the native frame and the 180-degree ambiguity.',
      orientationConfidence: 'mapped-walls-and-published-northwest-statue',
      limitations:
        'Small buttress offsets are fitted to the irregular map outline; the original surrounding church is absent from this present-day exterior.',
    },
    limits: [
      'Facade saints, animals and relief tracery are original polygonal sculptures preserving their architectural positions and silhouettes; they are not casts of individual artworks.',
      'The 54 m terrace is published; minor crown pedestal elevations are scaled from city photographs. Temporary closure and scaffolding are omitted from the permanent exterior.',
    ],
    cameras: [
      { name: 'lower-tracery', position: [16, 16, 23], lookAt: [0, 13, 0] },
      { name: 'lancets', position: [16, 38, 25], lookAt: [0, 36, 0] },
      { name: 'northwest-pilgrim', position: [-15, 62, -17], lookAt: [-3, 56, -3] },
      { name: 'gargoyles-crown', position: [20, 56, 22], lookAt: [0, 51, 0] },
      { name: 'far-silhouette', position: [73, 39, 96], lookAt: [0, 29, 0] },
    ],
  },
  {
    id: 'n0570_powder_tower',
    planId: 'N0570',
    title: 'Powder Tower',
    wikidata: 'Q1488700',
    build: buildPowder,
    authoringFile: 'gothic-heritage-tower-models.mjs',
    brief:
      'Prague’s current Gothic city gate: open pointed portal and ribbed passage, royal statues and canopies, heraldic gallery, corner spires, high chisel slate roof, paired dormers, golden ridgework and mapped stair turret.',
    size: [16.7, 65, 15.5],
    front: '+Z is the east portal facing Náměstí Republiky; −Z is the Celetná Street portal',
    origin:
      'Exact-QID mapped centroid with the actual pavement at Y=0; the historical buried moat foundation is excluded',
    refs: [
      'https://prague.eu/en/objevujte/powder-gate-tower-prasna-brana/',
      'https://prague.eu/en/550-copy/',
      'https://www.openstreetmap.org/way/27124370',
    ],
    facts: {
      heightMeters: 65,
      galleryHeightMeters: 44,
      cornerRoofSpireHeightMeters: 6,
      cornerRoofSpireCount: 4,
      restorationYears: [1875, 1886],
      roofShape: 'chisel',
      passage: 'pointed gate with net vault',
    },
    scaleBasis:
      'The municipal operator gives the total height, gallery elevation and corner spire dimensions. Exact mapped outline supplies the rectangular body, corner turrets and eccentric stair turret; current official photographs determine roof pitch, dormers, carved facade stages and weathered sandstone colors.',
    geographicProposal: {
      anchor: [14.427757226, 50.087248534],
      heading: 1.267457055494,
      source: 'https://www.openstreetmap.org/way/27124370',
      evidence:
        'The two open portals occupy the east and west facades. Their transverse ridge and the eccentric mapped stair turret preserve the exact local frame rather than defaulting the gateway to north.',
      orientationConfidence: 'exact-outline-turret-and-east-west-gate',
      limitations:
        'The adjoining Municipal House connection is separate architecture; the gate itself retains a walkable passage and native ground-contact piers.',
    },
    limits: [
      'Royal figures and heraldic relief are original polygonal reconstructions based on the photographed facade rhythm, not reproductions of individual inscriptions or coats of arms.',
      'The present permanent exterior is modeled, including the nineteenth-century roof; temporary maintenance scaffolding is omitted.',
    ],
    cameras: [
      { name: 'portal-vault', position: [12, 7, 25], lookAt: [0, 6, 0] },
      { name: 'royal-statues', position: [15, 25, 29], lookAt: [0, 25, 0] },
      { name: 'gallery', position: [20, 48, 25], lookAt: [0, 42, 0] },
      { name: 'chisel-roof', position: [25, 68, 31], lookAt: [0, 52, 0] },
      { name: 'far-silhouette', position: [82, 44, 108], lookAt: [0, 31, 0] },
    ],
  },
  {
    id: 'n0578_victoria_tower',
    planId: 'N0578',
    title: 'Victoria Tower',
    wikidata: 'Q1858077',
    build: buildVictoria,
    authoringFile: 'gothic-heritage-tower-models.mjs',
    brief:
      'The richly carved Westminster archive tower: Sovereign’s Entrance, paired lancets, Perpendicular blind tracery, Tudor rose and portcullis bands, four octagonal lantern pinnacles, slate mansard and dormers, open gilded crown and stayed iron flagstaff with Union flag.',
    size: [24.3, 120.5, 24.3],
    front:
      '−Z is the western Sovereign’s Entrance toward Abingdon Street; +X is north toward the adjoining Palace',
    origin:
      'Exact-QID mapped tower centroid, pavement contact Y=0; separate Palace wings are not included',
    refs: [
      'https://www.parliament.uk/about/living-heritage/building/palace/architecture/palacestructure/victoria-tower/',
      'https://www.parliament.uk/about/living-heritage/building/palace/architecture/palacestructure/victoria-tower/victoria-tower-project/',
      'https://www.parliament.uk/about/living-heritage/building/cultural-collections/archives/victoriatower/purposebuilthome/',
      'https://alicecartledge.co.uk/projects/restoration-and-renewal-victoria-tower',
      'https://www.parliament.uk/link/45992c23d00c4e61b1d5dfb0b5fea042.aspx',
      'https://www.openstreetmap.org/way/367642689',
      'https://upload.wikimedia.org/wikipedia/commons/9/91/The_houses_of_Parliament%3B_%28IA_housesofparliame00unse%29.pdf',
      'https://commons.wikimedia.org/wiki/File:Westminster_Palace_Victoria_Tower.jpg',
    ],
    facts: {
      stoneTowerHeightMeters: 98.5,
      additionalFlagstaffHeightMeters: 22,
      overallHeightMeters: 120.5,
      archiveFloors: 12,
      cornerLanterns: 4,
      completedYear: 1860,
      principalEntrance:
        'Sovereign’s Entrance with west and south open porch arches and north inner doorway',
      modeledState: 'permanent exterior without temporary restoration scaffolding',
    },
    scaleBasis:
      'Parliament publishes the 98.5 m stone tower and additional 22 m flagstaff. The exact mapped outline determines the approximately 20.15 m main body and projecting octagonal corners. The restoration architect’s current exterior photograph establishes major lancet stages, smaller seven-light bands, tracery, mansard dormers, open corner lanterns and gilded iron crown. Parliament’s Abingdon Street visitor route and the credited southwest photograph establish the west and south open porch arches. The contemporary 1852 published account locates the inner royal doorway on the north side of that porch.',
    geographicProposal: {
      anchor: [-0.125360296, 51.498325872],
      heading: 1.439543401306,
      source: 'https://www.openstreetmap.org/way/367642689',
      evidence:
        'Mapped wall axes and four turret footprints determine the native square frame. The western street-facing coach entrance resolves the otherwise symmetric frame; +X follows the northward Palace connection.',
      orientationConfidence: 'exact-turret-outline-and-street-facing-entrance',
      limitations:
        'This source contains the tower alone; the Palace wings attached on its north and east sides remain separate structures. The published 98.5 m height takes precedence over the older 96 m OSM tag.',
    },
    limits: [
      'Carved saints, heraldic roses and portcullises are original polygonal relief and figures, not casts of named artworks or transcribed royal inscriptions. The visible facade divisions, lanterns and crown follow the restoration architect’s photographs.',
      'The permanent exterior is modeled without temporary 2025–2031 repair scaffolding. The Union flag represents an ordinary non-sovereign-present state; flag motion and archive interiors are outside this static exterior asset.',
    ],
    cameras: [
      { name: 'sovereign-entrance', position: [-25, 12, -32], lookAt: [0, 10, 0] },
      { name: 'lancet-tracery', position: [28, 53, 40], lookAt: [0, 51, 0] },
      { name: 'lantern-crown', position: [30, 101, 36], lookAt: [0, 90, 0] },
      { name: 'flagstaff', position: [35, 122, 46], lookAt: [0, 106, 0] },
      { name: 'far-silhouette', position: [137, 76, 174], lookAt: [0, 57, 0] },
    ],
  },
];

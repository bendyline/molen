/** Independently referenced landmark exteriors; never used as anonymous category buildings. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  annulus,
  archBay,
  balcony,
  column,
  cornice,
  dark,
  deform,
  facade,
  face,
  finial,
  frame,
  pediment,
  stone,
  tau,
  transform,
  triangle,
  white,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const molePink = [0.76, 0.66, 0.55];
const roofStone = [0.49, 0.49, 0.45];
function squareRing(y, r) {
  return [
    [-r, y, -r],
    [-r, y, r],
    [r, y, r],
    [r, y, -r],
  ];
}
function oculus(out, x, y, z, r, color = stone) {
  sphere(out, 'shadow', [x, y, z], [r * 0.84, r * 0.84, 0.035], dark, 32, 16);
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * tau,
      b = ((i + 1) / 48) * tau;
    beam(
      out,
      'limestone',
      [x + Math.cos(a) * r, y + Math.sin(a) * r, z],
      [x + Math.cos(b) * r, y + Math.sin(b) * r, z],
      r * 0.22,
      r * 0.25,
      color,
    );
  }
}

function buildMole(out) {
  // Exact-QID outline distinguishes the broad entrance wings from the main 39 m square.
  box(out, 'limestone', [-19.1, 0, -17.25], [19.1, 24, 21], molePink);
  for (const sign of [-1, 1]) {
    box(
      out,
      'limestone',
      [sign < 0 ? -25.25 : 19.75, 0, 9.5],
      [sign < 0 ? -19.75 : 25.25, 16, 21.5],
      molePink,
    );
    box(
      out,
      'slate',
      [sign < 0 ? -25.5 : 19.7, 16, 9.3],
      [sign < 0 ? -19.7 : 25.5, 16.35, 21.75],
      roofStone,
    );
  }
  // Lower temple frontage with pilasters, glazed openings and projecting triangular pronaos.
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2, [0, 0, 1.85]);
    const wins = [];
    for (const y of [2.2, 10.3])
      for (let i = -3; i <= 3; i++)
        wins.push({ x: i * 5.2, w: 2.7, y, spring: y + 5.2, rise: 0.02, top: y + 5.3, depth: 0.4 });
    facade(wall, 'limestone', 39.5, 0, 24, 19.78, wins, molePink);
    for (let i = -3; i <= 3; i++)
      for (const y of [2.2, 10.3])
        frame(wall, 'limestone', i * 5.2, y, 2.7, 5.3, 19.82, 0.18, stone);
    for (let i = -4; i <= 4; i++)
      box(wall, 'limestone', [i * 4.75 - 0.32, 0.6, 19.83], [i * 4.75 + 0.32, 24, 20.13], stone);
  }
  const front = transform(out, Math.PI, [0, 0, 1.85]);
  box(front, 'limestone', [-14.5, 0.2, 19.8], [14.5, 1.2, 23], stone);
  for (let i = 0; i < 6; i++)
    column(front, 'limestone', -11.5 + i * 4.6, 22.4, 1.2, 19.7, 0.48, stone, 20);
  box(front, 'limestone', [-14.6, 19.7, 19.7], [14.6, 21.2, 23.15], stone);
  pediment(front, 29.2, 21.2, 23.25, 4.4, stone);
  oculus(front, 0, 23.2, 23.32, 1.12, molePink);
  // Upper colonnade and the five large semicircular clerestory lights on each elevation.
  cornice(out, 'limestone', 40.2, 40.2, 24, 0.7, stone);
  box(out, 'shadow', [-17.3, 24.7, -17.3], [17.3, 36.1, 17.3], [0.31, 0.29, 0.25]);
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    for (let i = 0; i < 22; i++)
      column(wall, 'limestone', -18.4 + (i * 36.8) / 21, 19.45, 25, 35.6, 0.23, stone, 12);
    for (let i = 0; i < 21; i++)
      box(
        wall,
        'shadow',
        [-18.05 + (i * 36.8) / 21, 27.4, 17.4],
        [-16.78 + (i * 36.8) / 21, 34.9, 17.48],
        [0.31, 0.34, 0.33],
      );
    const windows = Array.from({ length: 5 }, (_, i) => ({
      x: (i - 2) * 6.2,
      w: 5.35,
      y: 42.57,
      spring: 42.57,
      rise: 2.675,
      top: 46,
      depth: 0.65,
    }));
    facade(wall, 'limestone', 33.3, 39.1, 49, 16.65, windows, molePink);
    for (const w of windows)
      for (const k of [-1, 1])
        box(
          wall,
          'limestone',
          [w.x + k * 0.87 - 0.09, 42.57, 16.3],
          [w.x + k * 0.87 + 0.09, 44.65, 16.72],
          stone,
        );
    for (let i = 0; i < 52; i++)
      box(
        wall,
        'limestone',
        [-19.75 + i * 0.76, 35.9, 19.3],
        [-19.42 + i * 0.76, 36.33, 20.2],
        stone,
      );
  }
  cornice(out, 'limestone', 40.5, 40.5, 36, 0.9, stone);
  loft(out, 'slate', [squareRing(36.9, 20.4), squareRing(39.1, 16.9)], roofStone);
  cornice(out, 'limestone', 33.6, 33.6, 48.45, 0.55, stone);
  // Cylindrical pavilion surfaces meet along diagonal hips. The granite ribs remain parallel,
  // as measured in the contemporary engineering account, rather than converging to the center.
  const radiusAt = (y) => 16.65 - 11.915 * ((y - 49) / (82.32 - 49)) ** 1.43;
  const levels = Array.from({ length: 81 }, (_, i) => 49 + (i * (82.32 - 49)) / 80);
  loft(
    out,
    'slate',
    levels.map((y) => squareRing(y, radiusAt(y))),
    roofStone,
  );
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    for (let rib = 0; rib < 18; rib++) {
      const x = (rib - 8.5) * 1.8;
      for (let j = 0; j < levels.length - 1; j++) {
        const a = levels[j],
          b = levels[j + 1];
        if (Math.abs(x) + 0.18 > radiusAt(b)) continue;
        beam(
          wall,
          'limestone',
          [x, a, radiusAt(a) + 0.055],
          [x, b, radiusAt(b) + 0.055],
          0.39,
          0.11,
          [0.68, 0.66, 0.59],
        );
      }
    }
    for (let j = 1; j < 40; j++) {
      const y = 49 + (j * (82.32 - 49)) / 40,
        r = radiusAt(y);
      beam(
        wall,
        'limestone',
        [-r, y, r + 0.06],
        [r, y, r + 0.06],
        0.035,
        0.035,
        [0.33, 0.35, 0.33],
      );
    }
    for (let row = 0; row < 4; row++) {
      const y = 55 + row * 6.25,
        r = radiusAt(y);
      const count = [6, 5, 4, 3][row];
      for (let i = 0; i < count; i++) {
        const x = (i - (count - 1) / 2) * 3.6;
        if (Math.abs(x) + 0.5 >= r) continue;
        const eye = transform(wall, 0, [x, y, r + 0.16]);
        // Circular granite frame in the sloping roof: original geometry, no photo decals.
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * tau,
            b = ((k + 1) / 24) * tau;
          beam(
            eye,
            'limestone',
            [Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0],
            [Math.cos(b) * 0.36, Math.sin(b) * 0.36, 0],
            0.13,
            0.13,
            molePink,
          );
        }
        face(
          eye,
          'shadow',
          [
            [-0.28, -0.28, 0.005],
            [0.28, -0.28, 0.005],
            [0.28, 0.28, 0.005],
            [-0.28, 0.28, 0.005],
          ],
          dark,
        );
      }
    }
    // Twenty-one rows of visible metal stars follow the construction joint rhythm.
    for (let j = 1; j <= 20; j++) {
      const y = 49 + (j * (82.32 - 49)) / 21,
        r = radiusAt(y);
      for (let i = 0; i < 18; i++) {
        const x = (i - 8.5) * 1.8;
        if (Math.abs(x) + 0.2 >= r) continue;
        for (const a of [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4])
          beam(
            wall,
            'metal',
            [x - Math.cos(a) * 0.09, y - Math.sin(a) * 0.09, r + 0.16],
            [x + Math.cos(a) * 0.09, y + Math.sin(a) * 0.09, r + 0.16],
            0.025,
            0.025,
            [0.47, 0.4, 0.23],
          );
      }
    }
  }
  // Measured 9.47 m closure, 11.92 m platform, two 20-column orders at 1.8 m centers.
  box(out, 'limestone', [-4.735, 82.32, -4.735], [4.735, 85.05, 4.735], stone);
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    for (let i = 0; i < 6; i++)
      beam(
        wall,
        'limestone',
        [-4.5 + i * 1.8, 82.6, 4.8],
        [-4.5 + i * 1.8, 85.4, 5.85],
        0.38,
        0.55,
        stone,
      );
  }
  cornice(out, 'limestone', 11.38, 11.38, 85.2, 0.65, stone);
  box(out, 'shadow', [-2.58, 85.85, -2.58], [2.58, 98.65, 2.58], [0.24, 0.25, 0.24]);
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    for (let i = 0; i < 6; i++) {
      const x = -4.5 + i * 1.8;
      box(wall, 'limestone', [x - 0.24, 85.85, 4.26], [x + 0.24, 88.05, 4.74], stone);
      column(wall, 'limestone', x, 4.5, 88.19, 92.63, 0.2, molePink, 16);
      column(wall, 'limestone', x, 4.5, 93.18, 98.35, 0.2, molePink, 16);
    }
    for (let i = 0; i < 29; i++)
      column(wall, 'limestone', -5.65 + i * 0.404, 5.68, 85.85, 86.95, 0.045, molePink, 8);
    box(wall, 'limestone', [-5.96, 86.95, 5.58], [5.96, 87.13, 5.86], stone);
    pediment(wall, 11.7, 99.0, 5.75, 3.7, stone);
    oculus(wall, 0, 100.25, 5.82, 0.58, molePink);
  }
  cornice(out, 'limestone', 10.7, 10.7, 92.63, 0.55, stone);
  cornice(out, 'limestone', 11.2, 11.2, 98.35, 0.65, stone);
  loft(out, 'slate', [radialRing(99.3, 5.7, 5.7, 96), radialRing(106.4, 3.5, 3.5, 96)], roofStone);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * tau;
    beam(
      out,
      'limestone',
      [Math.cos(a) * 5.72, 99.5, Math.sin(a) * 5.72],
      [Math.cos(a) * 3.55, 106.4, Math.sin(a) * 3.55],
      0.13,
      0.13,
      stone,
    );
  }
  balcony(out, 3.8, 106.73);
  for (const [bottom, top, r] of [
    [107.03, 114.2, 2.93],
    [114.78, 121.48, 2.1],
  ]) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * tau;
      column(out, 'limestone', Math.cos(a) * r, Math.sin(a) * r, bottom + 1, top, 0.21, stone, 16);
    }
    loft(
      out,
      'shadow',
      [radialRing(bottom, 0.95, 0.95, 32), radialRing(top, 0.95, 0.95, 32)],
      [0.28, 0.27, 0.23],
    );
    balcony(out, r + 0.48, top);
  }
  loft(out, 'limestone', [radialRing(122, 1.3, 1.3, 8), radialRing(126.68, 1.3, 1.3, 8)], stone);
  for (let i = 0; i < 8; i++) {
    const wall = transform(out, (i * tau) / 8);
    facade(
      wall,
      'limestone',
      1.44,
      122,
      126.68,
      1.74,
      [{ x: 0, w: 1.05, y: 122.4, spring: 124.9, rise: 0.525, top: 126.1, depth: 0.22 }],
      stone,
    );
    column(wall, 'limestone', -0.65, 1.73, 122.1, 126.1, 0.12, stone, 12);
  }
  balcony(out, 2.35, 126.48);
  loft(
    out,
    'limestone',
    [radialRing(127, 1.68, 1.68, 8), radialRing(147.05, 1.02, 1.02, 8)],
    stone,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8;
    beam(
      out,
      'limestone',
      [Math.cos(a) * 1.71, 127, Math.sin(a) * 1.71],
      [Math.cos(a) * 1.04, 147, Math.sin(a) * 1.04],
      0.09,
      0.09,
      white,
    );
  }
  for (const [y, r] of [
    [130.8, 2],
    [137.15, 1.8],
    [143.5, 1.58],
    [147.05, 1.85],
  ])
    balcony(out, r, y, 48, 'metal', [0.3, 0.33, 0.32]);
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8;
    column(
      out,
      'limestone',
      Math.cos(a) * 0.94,
      Math.sin(a) * 0.94,
      148.3,
      151.35,
      0.12,
      stone,
      12,
    );
  }
  loft(
    out,
    'limestone',
    [radialRing(151.35, 1.55, 1.55, 8), radialRing(157.4, 0.57, 0.57, 8)],
    stone,
  );
  balcony(out, 0.96, 157.4, 32, 'metal', [0.3, 0.33, 0.32]);
  loft(out, 'limestone', [radialRing(158.3, 0.62, 0.62, 8), radialRing(161, 0.3, 0.3, 8)], stone);
  sphere(out, 'metal', [0, 162.1, 0], [0.46, 0.55, 0.46], [0.39, 0.45, 0.37], 24, 12);
  loft(
    out,
    'metal',
    [radialRing(162.6, 0.29, 0.29, 16), radialRing(164.3, 0.07, 0.07, 16)],
    [0.3, 0.37, 0.3],
  );
  // Present-day twelve-point star replaces the nineteenth-century winged genius.
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12,
      b = ((i + 1) * tau) / 12,
      m = (a + b) / 2;
    triangle(
      out,
      'metal',
      [
        [Math.cos(a) * 1.5, 166 + Math.sin(a) * 1.5, 0],
        [Math.cos(m) * 0.5, 166 + Math.sin(m) * 0.5, 0.04],
        [0, 166, 0.12],
      ],
      [0.52, 0.58, 0.44],
    );
    triangle(
      out,
      'metal',
      [
        [Math.cos(m) * 0.5, 166 + Math.sin(m) * 0.5, 0.04],
        [Math.cos(b) * 1.5, 166 + Math.sin(b) * 1.5, 0],
        [0, 166, 0.12],
      ],
      [0.52, 0.58, 0.44],
    );
    triangle(
      out,
      'metal',
      [
        [0, 166, -0.12],
        [Math.cos(m) * 0.5, 166 + Math.sin(m) * 0.5, -0.04],
        [Math.cos(a) * 1.5, 166 + Math.sin(a) * 1.5, 0],
      ],
      [0.52, 0.58, 0.44],
    );
    triangle(
      out,
      'metal',
      [
        [0, 166, -0.12],
        [Math.cos(b) * 1.5, 166 + Math.sin(b) * 1.5, 0],
        [Math.cos(m) * 0.5, 166 + Math.sin(m) * 0.5, -0.04],
      ],
      [0.52, 0.58, 0.44],
    );
  }
}

function buildGiotto(out) {
  const green = [0.14, 0.27, 0.23],
    pink = [0.63, 0.4, 0.36],
    marble = [0.92, 0.91, 0.84];
  const r = 6.48;
  box(out, 'limestone', [-7.4, 0, -7.4], [7.4, 0.7, 7.4], marble);
  box(out, 'limestone', [-6, 0.7, -6], [6, 35.5, 6], marble);
  for (const x of [-5.94, 5.94])
    for (const z of [-5.94, 5.94]) {
      loft(
        out,
        'limestone',
        [
          radialRing(0.7, 1.46, 1.46, 8, [x, z], Math.PI / 8),
          radialRing(82, 1.46, 1.46, 8, [x, z], Math.PI / 8),
        ],
        marble,
      );
      for (let j = 0; j < 15; j++) {
        const y = 3 + j * 5.15;
        for (let side = 0; side < 4; side++) {
          const wall = transform(out, (side * Math.PI) / 2, [x, 0, z]);
          box(wall, 'limestone', [-0.38, y, 1.354], [0.38, y + 3.3, 1.378], pink);
          frame(wall, 'limestone', 0, y, 0.8, 3.3, 1.4, 0.1, green);
        }
      }
    }
  const ornament = (wall, x, y, radius, sides, rotation, color) => {
    const points = Array.from({ length: sides }, (_, i) => {
      const a = rotation + (i / sides) * tau;
      return [x + Math.cos(a) * radius, y + Math.sin(a) * radius, 6.58];
    });
    wall.addConvexPolygon(
      'limestone',
      'palette:#ffffff',
      points,
      [0, 0, 1],
      (p) => [p[0], p[1]],
      color,
    );
    for (let i = 0; i < sides; i++)
      beam(wall, 'limestone', points[i], points[(i + 1) % sides], 0.14, 0.1, marble);
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8;
      sphere(
        wall,
        'limestone',
        [x + Math.cos(a) * radius * 0.44, y + Math.sin(a) * radius * 0.44, 6.7],
        [radius * 0.11, radius * 0.17, 0.035],
        marble,
        8,
        4,
      );
    }
  };
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    const door =
      side === 2
        ? [{ x: 0, w: 1.85, y: 0.7, spring: 3.25, rise: 1.12, top: 4.6, depth: 0.3, pointed: true }]
        : [];
    facade(wall, 'limestone', 12.96, 0.7, 35.5, r, door, marble);
    // The two lowest narrative cycles retain their actual 26 + 28 panel count and shapes.
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 1.52;
      box(wall, 'limestone', [x - 0.6, 6, 6.495], [x + 0.6, 11.5, 6.52], pink);
      frame(wall, 'limestone', x, 6, 1.2, 5.5, 6.55, 0.15, green);
      ornament(wall, x, 8.8, 0.67, 4, 0, marble);
      if (!(side === 2 && i === 3) && !(side === 2 && i === 2))
        ornament(wall, x, 3.5, 0.6, 6, Math.PI / 6, pink);
    }
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * 2.55;
      box(wall, 'limestone', [x - 0.83, 16.7, 6.49], [x + 0.83, 24.8, 6.54], green);
      frame(wall, 'limestone', x, 16.7, 1.66, 8.1, 6.57, 0.13, marble);
      archBay(wall, 'limestone', x, 1.3, 17.3, 22.3, 1.75, 24.4, 6.66, 0.14, marble, {
        pointed: true,
      });
      const robe = transform(wall, 0, [x, 0, 6.68]);
      loft(
        robe,
        'limestone',
        [
          radialRing(17.7, 0.35, 0.22, 12),
          radialRing(19.9, 0.27, 0.2, 12),
          radialRing(20.55, 0.33, 0.18, 12),
        ],
        marble,
      );
      sphere(robe, 'limestone', [0, 21.05, 0], [0.22, 0.31, 0.2], marble, 16, 8);
      beam(robe, 'limestone', [-0.27, 20.25, 0], [-0.15, 19.55, 0.25], 0.18, 0.18, marble);
      beam(robe, 'limestone', [0.27, 20.25, 0], [0.33, 19.15, 0.08], 0.17, 0.17, marble);
      for (let k = -2; k <= 2; k++)
        beam(
          robe,
          'limestone',
          [k * 0.1, 17.75, 0.21],
          [k * 0.085, 19.9, 0.18],
          0.035,
          0.035,
          [0.72, 0.72, 0.65],
        );
      box(wall, 'limestone', [x - 0.7, 27.4, 6.49], [x + 0.7, 33, 6.53], pink);
      frame(wall, 'limestone', x, 27.4, 1.4, 5.6, 6.56, 0.16, green);
    }
    for (const y of [1.4, 4.8, 12.4, 14.1, 15.2, 25.4, 26.3, 34.1]) {
      for (const [a, b] of side === 2 && y === 1.4
        ? [
            [-6.5, -1.02],
            [1.02, 6.5],
          ]
        : [[-6.5, 6.5]]) {
        box(wall, 'limestone', [a, y, 6.48], [b, y + 0.24, 6.65], green);
        box(wall, 'limestone', [a, y + 0.28, 6.49], [b, y + 0.45, 6.64], pink);
      }
    }
  }
  // Pairs of biforas in the lower two open loggias, then the large three-light loggia.
  for (const [y0, y1, count] of [
    [36.4, 52.2, 2],
    [53.2, 67, 2],
    [68.2, 81.1, 1],
  ]) {
    box(out, 'darkstone', [-5.8, y0 - 0.3, -5.8], [5.8, y0, 5.8], [0.31, 0.32, 0.29]);
    // The opaque interior stair/bell envelope provides the deep shadow visible through the
    // exterior openings; otherwise one-sided facade panels incorrectly expose the sky.
    box(out, 'shadow', [-4.8, y0, -4.8], [4.8, y1, 4.8], [0.07, 0.075, 0.065]);
    for (let side = 0; side < 4; side++) {
      const wall = transform(out, (side * Math.PI) / 2);
      const xs = count === 2 ? [-2.75, 2.75] : [0];
      const width = count === 2 ? 3.65 : 7.25;
      const spring = y1 - 5.05,
        rise = count === 2 ? 2.7 : 3.15;
      facade(
        wall,
        'limestone',
        12.96,
        y0,
        y1,
        6.48,
        xs.map((x) => ({
          x,
          w: width,
          y: y0 + 1.1,
          spring,
          rise,
          top: y1 - 0.7,
          depth: 0.65,
          pointed: true,
          back: false,
        })),
        marble,
      );
      for (const x of xs) {
        for (let ring = 0; ring < 4; ring++) {
          const rr = width / 2 + 0.1 + ring * 0.14,
            hh = rise + 0.1 + ring * 0.14;
          for (let k = 0; k < 40; k++) {
            const a = -rr + (k * rr * 2) / 40,
              b = -rr + ((k + 1) * rr * 2) / 40;
            const yy = (t) =>
              spring +
              (hh * Math.sqrt(Math.max(0, 4 - (Math.abs(t) / rr + 1) ** 2))) / Math.sqrt(3);
            beam(
              wall,
              'limestone',
              [x + a, yy(a), 6.67],
              [x + b, yy(b), 6.67],
              0.145,
              0.13,
              ring % 2 ? green : marble,
            );
          }
        }
        // Polychrome surrounds, pointed gables, crockets and narrow mullion columns.
        for (const s of [-1, 1]) {
          box(
            wall,
            'limestone',
            [x + (s * width) / 2 - 0.22, y0 + 0.65, 6.54],
            [x + (s * width) / 2 + 0.22, spring, 6.68],
            green,
          );
          column(wall, 'limestone', x + (s * width) / 2, 6.72, y0 + 0.8, spring, 0.13, marble, 12);
        }
        const mullions = count === 2 ? [0] : [-1.22, 1.22];
        for (const mx of mullions)
          column(wall, 'limestone', x + mx, 6.33, y0 + 1.1, spring + 0.35, 0.13, marble, 16);
        const smallCenters = count === 2 ? [-0.94, 0.94] : [-2.43, 0, 2.43];
        for (const cx of smallCenters) {
          const rr = count === 2 ? 0.83 : 1.06;
          for (let k = 0; k < 24; k++) {
            const a = (k / 24) * Math.PI,
              b = ((k + 1) / 24) * Math.PI;
            beam(
              wall,
              'limestone',
              [x + cx + Math.cos(a) * rr, spring - 0.35 + Math.sin(a) * rr, 6.32],
              [x + cx + Math.cos(b) * rr, spring - 0.35 + Math.sin(b) * rr, 6.32],
              0.14,
              0.18,
              marble,
            );
          }
        }
        const peak = y1 - 0.45,
          base = peak - 2.1;
        for (const s of [-1, 1]) {
          beam(
            wall,
            'limestone',
            [x + s * (width / 2 + 0.48), base, 6.66],
            [x, peak, 6.66],
            0.25,
            0.2,
            green,
          );
          beam(
            wall,
            'limestone',
            [x + s * (width / 2 + 0.48), base + 0.2, 6.75],
            [x, peak + 0.2, 6.75],
            0.18,
            0.18,
            marble,
          );
          for (let k = 1; k < 6; k++) {
            const t = k / 6;
            sphere(
              wall,
              'limestone',
              [x + s * (width / 2 + 0.48) * (1 - t), base + (peak - base) * t + 0.26, 6.78],
              [0.11, 0.16, 0.12],
              marble,
              8,
              6,
            );
          }
        }
        finial(wall, x, peak + 0.22, 6.68, 0.48, marble);
      }
      for (const x of [-5.25, 5.25]) {
        box(wall, 'limestone', [x - 0.42, y0 + 2, 6.52], [x + 0.42, y1 - 2.5, 6.55], pink);
        frame(wall, 'limestone', x, y0 + 2, 0.84, y1 - y0 - 4.5, 6.58, 0.15, green);
      }
      for (let i = 0; i < 11; i++)
        ornament(wall, (i - 5) * 1.08, y0 + 0.2, 0.27, 4, Math.PI / 4, pink);
    }
    cornice(out, 'limestone', 14.1, 14.1, y1, 0.68, marble);
  }
  for (const y of [13.4, 35.4]) cornice(out, 'limestone', 14.3, 14.3, y, 0.9, marble);
  // Deep corbelled horizontal crown, with an open roof terrace and parapet lattice.
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    for (let i = 0; i < 20; i++) {
      const x = -7 + (i * 14) / 19;
      beam(wall, 'limestone', [x, 81.5, 6.6], [x, 82.9, 7.9], 0.28, 0.36, marble);
      box(wall, 'limestone', [x - 0.12, 83.55, 7.8], [x + 0.12, 84.42, 8.04], marble);
    }
    box(wall, 'limestone', [-8, 83.25, 7.58], [8, 83.55, 8.15], marble);
    box(wall, 'limestone', [-8.15, 84.42, 7.62], [8.15, 84.7, 8.15], marble);
    box(wall, 'limestone', [-7.5, 82.95, 7.5], [7.5, 83.2, 7.9], green);
  }
  box(out, 'limestone', [-7.8, 82.9, -7.8], [7.8, 83.25, 7.8], marble);
}

function buildAzadi(out) {
  const marble = [0.9, 0.9, 0.82],
    tile = [0.23, 0.58, 0.56];
  // Separate curved diagonal blades leave both the great arch and the lower side arch open.
  const stations = [
    [0, 32, 19, 8.5, 7.5, 3, 4.5, 5],
    [5, 25.8, 15.8, 8.25, 7.05, 2.8, 4.9, 5.1],
    [10, 20.2, 12.9, 7.7, 6.6, 2.5, 5.5, 5.5],
    [15, 15.1, 10.35, 6.9, 6.05, 2.2, 6.1, 6.05],
    [20, 11.5, 8.25, 5.25, 5.6, 1.8, 7, 5.6],
    [24, 9.05, 6.9, 3.1, 5.4, 1, 6.9, 5.4],
    [27, 7.5, 5.7, 0, 5.7, 0, 5.7, 5.7],
  ].map((s) => [s[0] * 1.2, ...s.slice(1)]);
  const sample = (y) => {
    const k = Math.min(
      stations.length - 1,
      Math.max(
        1,
        stations.findIndex((s) => s[0] >= y),
      ),
    );
    const a = stations[k - 1],
      b = stations[k],
      t = (y - a[0]) / (b[0] - a[0]);
    const before = stations[Math.max(0, k - 2)],
      after = stations[Math.min(stations.length - 1, k + 1)];
    return a.map((v, i) =>
      i === 0
        ? y
        : (2 * t ** 3 - 3 * t * t + 1) * v +
          (((t ** 3 - 2 * t * t + t) * (b[i] - before[i])) / (b[0] - before[0])) * (b[0] - a[0]) +
          (-2 * t ** 3 + 3 * t * t) * b[i] +
          (((t ** 3 - t * t) * (after[i] - v)) / (after[0] - a[0])) * (b[0] - a[0]),
    );
  };
  const fine = Array.from({ length: 163 }, (_, i) => sample(i * 0.2));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const rings = fine.map(([y, rx, rz, ix, iz, tx, thickness, innerThickness]) => {
        const p = [
          [ix, y, iz],
          [rx, y, rz],
          [rx, y, rz - thickness],
          [ix + tx, y, iz - innerThickness],
        ].map(([x, y, z]) => [sx * x, y, sz * z]);
        return sx * sz < 0 ? p.reverse() : p;
      });
      loft(out, 'limestone', rings, marble);
      for (let strip = 0; strip < 10; strip++) {
        const t = strip / 9;
        for (let i = 0; i < fine.length - 1; i++) {
          const p = ([y, rx, rz, ix, iz]) => [
            sx * (ix + (rx - ix) * t),
            y,
            sz * (iz + (rz - iz) * t + 0.025),
          ];
          beam(out, 'metal', p(fine[i]), p(fine[i + 1]), 0.065, 0.035, tile);
        }
      }
      // The side-facing blade ribs follow the outside return, rather than cutting across the arch.
      for (let strip = 1; strip < 6; strip++) {
        const t = strip / 6;
        for (let i = 0; i < fine.length - 1; i++) {
          const p = ([y, rx, rz, ix, iz, tx, thickness, innerThickness]) => [
            sx * (ix + tx + (rx - ix - tx) * t),
            y,
            sz * (iz - innerThickness + (rz - thickness - iz + innerThickness) * t - 0.025),
          ];
          beam(out, 'metal', p(fine[i]), p(fine[i + 1]), 0.055, 0.03, tile);
        }
      }
    }
  const topRings = [
    [32.4, 7.5, 5.7],
    [35, 7.15, 5.2],
    [38, 7.05, 4.7],
    [41, 7.15, 4.42],
    [44.4, 7.55, 4.6],
  ];
  loft(
    out,
    'limestone',
    topRings.map(([y, rx, rz]) => [
      [-rx, y, -rz],
      [-rx, y, rz],
      [rx, y, rz],
      [rx, y, -rz],
    ]),
    marble,
  );
  // Curved soffit and crossed blue tile lattice, visible through the great opening.
  const vault = (x, z) => [x, 24.5 + 7.9 * (Math.abs(z) / 5.7) ** 1.5 - 0.15 * x * x, z];
  for (let i = 0; i < 32; i++)
    for (let j = 0; j < 24; j++) {
      const x = -7.5 + (i * 15) / 32,
        z = -5.7 + (j * 11.4) / 24;
      face(
        out,
        'limestone',
        [
          vault(x, z),
          vault(x + 15 / 32, z),
          vault(x + 15 / 32, z + 11.4 / 24),
          vault(x, z + 11.4 / 24),
        ],
        marble,
      );
    }
  for (let diagonal = -10; diagonal <= 10; diagonal++)
    for (const sign of [-1, 1]) {
      let prev;
      for (let i = 0; i <= 80; i++) {
        const x = -7.4 + (i * 14.8) / 80,
          z = sign * x * 0.7 + diagonal * 0.95;
        if (Math.abs(z) > 5.69) {
          prev = undefined;
          continue;
        }
        const p = vault(x, z);
        p[1] -= 0.06;
        if (prev) beam(out, 'metal', prev, p, 0.13, 0.08, tile);
        prev = p;
      }
    }
  // Four shallow windcatcher-like crown faces with the photographed blue vent rhythm.
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2),
      w = side % 2 ? 8.85 : 14.4,
      z = side % 2 ? 7.65 : 4.55;
    const count = side % 2 ? 5 : 9;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.78;
      archBay(wall, 'limestone', x, 0.45, 42.5, 43.32, 0.3, 43.85, z + 0.11, 0.04, marble, {
        pointed: true,
        trim: 0.075,
      });
      box(wall, 'metal', [x - 0.16, 42.55, z + 0.08], [x + 0.16, 43.18, z + 0.1], tile);
    }
    for (const sign of [-1, 1]) {
      beam(
        wall,
        'limestone',
        [sign * (w / 2 - 0.25), 33, z + 0.24],
        [sign * (w / 2 + 0.25), 45, z + 0.3],
        0.5,
        0.45,
        marble,
      );
    }
    for (let i = 0; i < 5; i++)
      box(
        wall,
        'shadow',
        [(i - 2) * 0.4, 40.7, z + 0.035],
        [(i - 2) * 0.4 + 0.08, 42.2, z + 0.055],
        [0.39, 0.48, 0.43],
      );
  }
  box(out, 'limestone', [-7.1, 44.35, -4.4], [7.1, 44.52, 4.4], marble);
}

function buildSoyembika(target) {
  const heading = -1.335984319155;
  // The reserve gives the lean in geographic NE, not an arbitrary local diagonal.
  const east = 1.98 / Math.sqrt(2) / 58,
    south = -east;
  const lean = [
    Math.cos(heading) * east - Math.sin(heading) * south,
    Math.sin(heading) * east + Math.cos(heading) * south,
  ];
  const stages = [
    [0, 0],
    [13.95, 12],
    [23.45, 18],
    [30.85, 24],
    [36.25, 30],
    [41.95, 36],
    [50.3, 45],
    [53.2, 49],
    [56.95, 56.95],
    [58.02, 58.02],
  ];
  const out = deform(target, ([x, y, z]) => {
    const i = Math.max(
        1,
        stages.findIndex((p) => p[0] >= y),
      ),
      a = stages[i - 1],
      b = stages[i];
    const height = a[1] + ((y - a[0]) / (b[0] - a[0])) * (b[1] - a[1]);
    return [x + height * lean[0], height, z + height * lean[1]];
  });
  const red = [0.64, 0.36, 0.23],
    trim = [0.68, 0.4, 0.27],
    roof = [0.18, 0.35, 0.26];
  const width = Math.sqrt(140),
    r = width / 2;
  for (const sign of [-1, 1])
    box(out, 'brick', [sign < 0 ? -r : 2.05, 0, -r], [sign < 0 ? -2.05 : r, 13.5, r], red);
  for (let side = 0; side < 2; side++) {
    const wall = transform(out, side * Math.PI);
    archBay(wall, 'brick', 0, 4.1, 0, 6.5, 2.05, 13.5, r, 2 * r, red, { back: false, trim: 0.32 });
    for (const x of [-4.85, -3.05, 3.05, 4.85]) {
      column(wall, 'brick', x, r + 0.18, 0.3, 10.7, 0.23, trim, 16);
      box(wall, 'brick', [x - 0.48, 10.5, r - 0.05], [x + 0.48, 11.05, r + 0.52], trim);
    }
    // Forged decorative gate, with actual bars and sun/crescent medallions; fine relief is omitted.
    for (let i = -10; i <= 10; i++)
      box(
        wall,
        'metal',
        [i * 0.187 - 0.017, 0.18, r - 0.22],
        [i * 0.187 + 0.017, 6.3, r - 0.18],
        [0.16, 0.17, 0.14],
      );
    for (const y of [1.1, 3.3, 5.7])
      box(wall, 'metal', [-1.97, y, r - 0.25], [1.97, y + 0.04, r - 0.14], [0.16, 0.17, 0.14]);
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * tau,
        b = ((i + 1) / 32) * tau;
      beam(
        wall,
        'metal',
        [Math.cos(a) * 0.75, 4 + Math.sin(a) * 0.75, r - 0.15],
        [Math.cos(b) * 0.75, 4 + Math.sin(b) * 0.75, r - 0.15],
        0.045,
        0.045,
        [0.52, 0.41, 0.18],
      );
    }
  }
  cornice(out, 'brick', width, width, 13.5, 0.45, trim);
  // Shallow shirinka panels with projecting borders on the first terrace parapet.
  for (let side = 0; side < 4; side++) {
    const wall = transform(out, (side * Math.PI) / 2);
    box(wall, 'brick', [-r, 13.95, r - 0.24], [r, 15, r], red);
    for (let i = 0; i < 12; i++)
      frame(
        wall,
        'brick',
        -r + 0.55 + (i * (width - 1.1)) / 11,
        14.15,
        0.55,
        0.5,
        r + 0.015,
        0.09,
        trim,
      );
    if (side % 2 === 1) {
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * tau,
          b = ((i + 1) / 32) * tau;
        beam(
          wall,
          'brick',
          [Math.cos(a) * 0.37, 11.7 + Math.sin(a) * 0.37, r + 0.12],
          [Math.cos(b) * 0.37, 11.7 + Math.sin(b) * 0.37, r + 0.12],
          0.16,
          0.16,
          trim,
        );
      }
      face(
        wall,
        'shadow',
        [
          [-0.24, 11.46, r + 0.03],
          [0.24, 11.46, r + 0.03],
          [0.24, 11.94, r + 0.03],
          [-0.24, 11.94, r + 0.03],
        ],
        dark,
      );
    }
  }
  // Three square tiers, then two octagonal stages. The gallery terraces are left open.
  for (const [w, y0, y1] of [
    [9.15, 13.95, 23],
    [7.05, 23.45, 30.4],
  ]) {
    const rr = w / 2;
    box(out, 'brick', [-rr + 0.5, y0, -rr + 0.5], [rr - 0.5, y1, rr - 0.5], red);
    for (let side = 0; side < 4; side++) {
      const wall = transform(out, (side * Math.PI) / 2);
      facade(
        wall,
        'brick',
        w,
        y0,
        y1,
        rr,
        [{ x: 0, w: 1.25, y: y0 + 1, spring: y0 + 3.3, rise: 0.35, top: y0 + 3.8, depth: 0.36 }],
        red,
      );
      frame(wall, 'brick', 0, y0 + 0.85, 1.65, 3.1, rr + 0.015, 0.17, trim);
      for (const x of [-w * 0.31, w * 0.31]) {
        frame(wall, 'brick', x, y0 + 1.05, 1.22, 3.15, rr + 0.018, 0.17, trim);
        box(
          wall,
          'brick',
          [x - 0.5, y0 + 1.2, rr + 0.025],
          [x + 0.5, y0 + 4.08, rr + 0.045],
          [0.6, 0.33, 0.22],
        );
      }
      for (const x of [-rr + 0.28, rr - 0.28])
        box(wall, 'brick', [x - 0.16, y0, rr], [x + 0.16, y1, rr + 0.16], trim);
    }
    cornice(out, 'brick', w + 0.2, w + 0.2, y1, 0.45, trim);
    for (let side = 0; side < 4; side++) {
      const wall = transform(out, (side * Math.PI) / 2);
      box(
        wall,
        'brick',
        [-rr - 0.14, y1 + 0.45, rr - 0.16],
        [rr + 0.14, y1 + 1.05, rr + 0.14],
        red,
      );
      for (let i = 0; i < Math.floor(w / 0.22); i++)
        box(
          wall,
          'brick',
          [-rr + i * 0.22, y1 + 0.45, rr + 0.16],
          [-rr + i * 0.22 + 0.075, y1 + 1.05, rr + 0.24],
          trim,
        );
    }
  }
  for (const [y0, y1, radius, window] of [
    [30.85, 35.8, 3.32, false],
    [36.25, 41.5, 2.92, true],
  ]) {
    const apothem = radius * Math.cos(Math.PI / 8),
      width = 2 * radius * Math.sin(Math.PI / 8);
    loft(
      out,
      'brick',
      [
        radialRing(y0, radius - 0.55, radius - 0.55, 8, [0, 0], Math.PI / 8),
        radialRing(y1, radius - 0.55, radius - 0.55, 8, [0, 0], Math.PI / 8),
      ],
      red,
    );
    for (let side = 0; side < 8; side++) {
      const wall = transform(out, (side * Math.PI) / 4);
      facade(
        wall,
        'brick',
        width,
        y0,
        y1,
        apothem,
        [
          {
            x: 0,
            w: window ? 1.04 : 0.72,
            y: y0 + 0.7,
            spring: y1 - 1.35,
            rise: window ? 0.52 : 0.09,
            top: y1 - 0.65,
            depth: 0.4,
          },
        ],
        red,
      );
      for (const x of [-width / 2 + 0.11, width / 2 - 0.11])
        column(wall, 'brick', x, apothem + 0.07, y0 + 0.1, y1 - 0.25, 0.115, trim, 12);
      frame(
        wall,
        'brick',
        0,
        y0 + 0.6,
        window ? 1.36 : 1.02,
        y1 - y0 - 1.1,
        apothem + 0.03,
        0.1,
        trim,
      );
    }
    loft(
      out,
      'brick',
      [
        radialRing(y1, radius + 0.12, radius + 0.12, 8, [0, 0], Math.PI / 8),
        radialRing(y1 + 0.35, radius + 0.24, radius + 0.24, 8, [0, 0], Math.PI / 8),
      ],
      trim,
    );
    loft(
      out,
      'metal',
      [
        radialRing(y1 + 0.35, radius + 0.29, radius + 0.29, 8, [0, 0], Math.PI / 8),
        radialRing(y1 + 0.45, radius + 0.29, radius + 0.29, 8, [0, 0], Math.PI / 8),
      ],
      roof,
    );
  }
  loft(
    out,
    'brick',
    [
      radialRing(41.95, 2.65, 2.65, 8, [0, 0], Math.PI / 8),
      radialRing(50, 1.22, 1.22, 8, [0, 0], Math.PI / 8),
    ],
    red,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8 + Math.PI / 8;
    beam(
      out,
      'brick',
      [Math.cos(a) * 2.68, 42, Math.sin(a) * 2.68],
      [Math.cos(a) * 1.25, 50, Math.sin(a) * 1.25],
      0.14,
      0.14,
      trim,
    );
  }
  loft(
    out,
    'brick',
    [
      radialRing(50, 1.28, 1.28, 8, [0, 0], Math.PI / 8),
      radialRing(50.3, 1.43, 1.43, 8, [0, 0], Math.PI / 8),
    ],
    trim,
  );
  loft(out, 'brick', [radialRing(50.3, 0.72, 0.72, 8), radialRing(53.2, 0.72, 0.72, 8)], red);
  for (let side = 0; side < 8; side++) {
    const wall = transform(out, (side * Math.PI) / 4);
    facade(
      wall,
      'brick',
      1.05,
      50.3,
      53.2,
      1.22,
      [{ x: 0, w: 0.54, y: 50.65, spring: 52.3, rise: 0.27, top: 52.9, depth: 0.32 }],
      red,
    );
    for (const s of [-1, 1]) column(wall, 'brick', s * 0.44, 1.22, 50.35, 53.2, 0.07, trim, 8);
  }
  loft(
    out,
    'metal',
    [
      radialRing(53.2, 1.51, 1.51, 8, [0, 0], Math.PI / 8),
      radialRing(56.95, 0.07, 0.07, 8, [0, 0], Math.PI / 8),
    ],
    roof,
  );
  sphere(out, 'metal', [0, 57.16, 0], [0.19, 0.22, 0.19], [0.85, 0.66, 0.25], 24, 12);
  box(out, 'metal', [-0.035, 57.2, -0.035], [0.035, 57.55, 0.035], [0.85, 0.66, 0.25]);
  // Thin swept crescent, explicitly curved rather than a flat circular plate.
  for (let i = 0; i < 30; i++) {
    const a = (-0.33 + (i / 30) * 1.66) * Math.PI,
      b = (-0.33 + ((i + 1) / 30) * 1.66) * Math.PI;
    beam(
      out,
      'metal',
      [Math.cos(a) * 0.34, 57.66 + Math.sin(a) * 0.34, 0],
      [Math.cos(b) * 0.34, 57.66 + Math.sin(b) * 0.34, 0],
      0.045,
      0.04,
      [0.85, 0.66, 0.25],
    );
  }
}

export const nextHeritageTowers = [
  {
    id: 'n0565_mole_antonelliana',
    planId: 'N0565',
    title: 'Mole Antonelliana',
    wikidata: 'Q201902',
    build: buildMole,
    brief:
      'Turin’s immense pavilion cupola with parallel granite ribs and roof lights, lower colonnade and temple portico, measured double-order tempietto, concentric circular galleries, tapering octagonal spire and the present star.',
    size: [51, 167.5, 45],
    front:
      '−Z is the projecting entrance portico / Via Montebello side; +Z has the broad rear wings',
    origin:
      'OSM footprint rectangle center at nominal exterior ground; main cupola centered on the tower axis',
    refs: [
      'https://www.comune.torino.it/vivere-comune/luoghi/mole-antonelliana',
      'https://www.museocinema.it/en/mole-antonelliana',
      'https://digit.biblio.polito.it/4554/1/01_ING.CIV.%20ART_IND_1890_GEN.pdf',
      'https://www.openstreetmap.org/way/83111423',
    ],
    facts: {
      heightMeters: 167.5,
      cupolaCrownMeters: 82.32,
      originalTerraceMeters: 85.85,
      terraceSideMeters: 11.92,
      closureSideMeters: 9.47,
      columnSpacingMeters: 1.8,
      tempiettoColumnsPerOrder: 20,
      circularGalleryMeters: 107.03,
      roofRibWidthMeters: 0.39,
      roofRibSpacingMeters: 1.8,
      roofLightsPerFace: 18,
      sourcePages: [1, 3, 4, 6, 7, 8, 17],
    },
    scaleBasis:
      'City present height; museum terrace and cupola route; 1890 contemporary engineering dimensions and plate constrain the upper architecture. The former terminal statue is replaced with the modern star visible in museum photographs. OSM controls the asymmetric lower plan.',
    geographicProposal: {
      anchor: [7.693204737, 45.06901597],
      heading: 1.088604755236,
      source: 'https://www.openstreetmap.org/way/83111423',
      evidence:
        'Exact-QID outline places its approximately 29 m projecting entrance portico on local −Z and the broad 50 m rear wings on +Z. The authored plan preserves that asymmetry, resolving the minimum-rectangle half-turn ambiguity.',
      orientationConfidence: 'asymmetric-footprint',
      limitations:
        'The roughly 29 m mapped portico and broad rear wings agree with the authored footprint. Exact paving joints and the sloping street edge are not modeled.',
    },
    limits: [
      'Lower facade floor heights and exact glazing subdivisions are fitted to museum exterior photography. The measured upper structure is reconstructed with simplified capitals and scroll brackets.',
      'Roof ribs and 18 circular roof lights per side follow the contemporary engineering account; irregular restoration patches and individual iron fittings are simplified.',
      'The nineteenth-century plate supplies structural dimensions but the present star and modern glazing follow museum photographs. Tiny carved figures and allegorical pediment sculpture are represented only by their architectural surrounds.',
    ],
    cameras: [
      { name: 'near-portico', position: [-28, 24, -59], lookAt: [0, 17, -9] },
      { name: 'near-cupola', position: [45, 65, 61], lookAt: [0, 60, 0] },
      { name: 'tempietto', position: [25, 98, 34], lookAt: [0, 96, 0] },
      { name: 'spire', position: [18, 141, 31], lookAt: [0, 136, 0] },
      { name: 'far-silhouette', position: [190, 108, 244], lookAt: [0, 82, 0] },
    ],
  },
  {
    id: 'n0574_soyembika_tower',
    planId: 'N0574',
    title: 'Söyembikä Tower',
    wikidata: 'Q2166466',
    build: buildSoyembika,
    brief:
      'Seven-tier leaning brick gate tower of the Kazan Kremlin: open vaulted gate, pylon columns, recessed shirinka parapets, square gallery stages, octagonal upper chambers, tall faceted brick tent and green spire with gilded crescent.',
    size: [13, 58, 13],
    front: '+Z is the approximately west-facing gate facade',
    origin: 'Mapped tower outline center at nominal exterior ground',
    refs: [
      'https://kazan-kremlin.ru/en/architectural-objects/bashnya-syuyumbike',
      'https://www.openstreetmap.org/way/228963085',
    ],
    facts: {
      heightMeters: 58,
      baseAreaSquareMeters: 140,
      tiers: 7,
      lowerSquareTiers: 3,
      upperOctagonalTiers: [4, 5, 7],
      leanMeters: 1.98,
      leanDirection: 'north-east',
      baseOrnamentalColumns: 8,
      mappedStageElevationsMeters: [12, 18, 24, 30, 36, 45, 49],
      mappedGreenRoofHeightMeters: 9,
    },
    scaleBasis:
      'Kazan Kremlin museum-reserve dimensions and architectural description; official exterior photograph constrains the stepped stage envelopes. The separate OSM parts 228963086–228963092 supply stage elevations and a 9 m green roof; opening dimensions are photo-fitted.',
    geographicProposal: {
      anchor: [49.105181097, 55.800475854],
      heading: -1.335984319155,
      source: 'https://www.openstreetmap.org/way/228963085',
      evidence:
        'Exact-QID mapped wall axes orient the long lower passage facade approximately west/east. The documented 1.98 m NE lean is transformed from geographic east/north into this local frame; the nearly symmetric gate elevations do not require a half-turn distinction.',
      orientationConfidence: 'footprint-axis-with-published-lean',
      limitations:
        'The OSM polygon is wider than the published 140 square metre tower footprint, apparently including lower projections. The authored square shaft is not stretched to that polygon; its center and ground contact need the placement view review. The decorative gate winter-solstice statement is not used as a measured shaft azimuth.',
    },
    limits: [
      'Individual tier heights and brick profiles are fitted to the official exterior photograph. The 140 square metre square base is used instead of the larger OSM lower outline; small attached wall projections are excluded.',
      'Gate ornament is represented by bars and a sun medallion; figurative metalwork, brick repair patterns, inscriptions and highly detailed console capitals remain simplified.',
      'The reported lean is represented as a linear shear of the exterior. A measured deformation survey could refine the relative lean of individual tiers.',
    ],
    cameras: [
      { name: 'gate-vault', position: [12, 9, 20], lookAt: [0, 7, 0] },
      { name: 'terrace-panels', position: [16, 24, 22], lookAt: [0, 19, 0] },
      { name: 'octagonal-crown', position: [15, 45, 22], lookAt: [0, 41, 0] },
      { name: 'far-lean', position: [65, 37, 85], lookAt: [0, 29, 0] },
    ],
  },
  {
    id: 'n0572_giotto_s_campanile',
    planId: 'N0572',
    componentMap: { limestone: 'marble' },
    title: 'Giotto’s Campanile',
    wikidata: 'Q1140023',
    build: buildGiotto,
    brief:
      'Florentine polychrome marble campanile, with reinforced octagonal corners, hexagonal and diamond relief cycles, statue niches, paired biforas and a three-light belfry loggia, Gothic gables, projecting corbels and an open flat crown.',
    size: [16.3, 84.7, 16.3],
    front: '−Z is the cathedral-facing north entrance elevation',
    origin: 'Exact-QID mapped shaft center at exterior pavement',
    refs: [
      'https://duomo.firenze.it/en/discover/giotto-s-bell-tower',
      'https://duomo.firenze.it/en/visit/plan-your-visit',
      'https://curiositadifirenze.blogspot.com/2018/01/campanile-di-giotto.html',
      'https://www.openstreetmap.org/way/251650632',
    ],
    facts: {
      heightMeters: 84.7,
      baseApproximateMeters: 15,
      hexagonalPanels: 26,
      diamondPanels: 28,
      statueNiches: 16,
      openLoggias: 3,
      highestLoggiaLights: 3,
    },
    scaleBasis:
      'Opera del Duomo published 84.7 m height and roughly 15 m square base; mapped reinforced-corner plan determines shaft width and alignment. Photographer Roberto Di Ferdinando’s exterior image and Opera descriptions establish loggia/window and marble-panel hierarchy.',
    geographicProposal: {
      anchor: [11.2556971, 43.772849685],
      heading: 1.55145127096 - Math.PI / 2,
      source: 'https://www.openstreetmap.org/way/251650632',
      evidence:
        'Exact-QID reinforced-corner outline supplies the nearly north/south facade axis. The museum’s cathedral-side rear entrance determines the authored −Z face; the square plan otherwise permits quarter turns.',
      orientationConfidence: 'footprint-plus-entrance-side',
      limitations:
        'Top crown projects beyond the mapped shaft, as visible in the reference. Exterior paving and temporary restoration scaffolding are excluded.',
    },
    limits: [
      'The narrative bas-reliefs and statues retain their counts, shapes and architectural niches but are original simplified sculptural reliefs, not reproductions of the individual named artworks.',
      'Panel elevations, marble flower designs, moulding sections and window tracery are fitted to exterior photography. Exact conservation stone-cut patterns are not claimed.',
      'Permanent exterior is modeled; temporary restoration scaffolding is excluded.',
    ],
    cameras: [
      { name: 'lower-marble-cycles', position: [17, 18, 26], lookAt: [0, 16, 0] },
      { name: 'bifora-loggias', position: [22, 53, 27], lookAt: [0, 49, 0] },
      { name: 'crown-corbelwork', position: [20, 88, 25], lookAt: [0, 78, 0] },
      { name: 'north-door', position: [-12, 7, -23], lookAt: [0, 4, 0] },
      { name: 'far-silhouette', position: [112, 55, 145], lookAt: [0, 43, 0] },
    ],
  },
  {
    id: 'n0563_azadi_tower',
    planId: 'N0563',
    componentMap: { limestone: 'marble' },
    title: 'Azadi Tower',
    wikidata: 'Q1140026',
    build: buildAzadi,
    groundNormalize: true,
    brief:
      'Hossein Amanat’s four curved marble blades, flaring to diagonal feet beneath the pointed great arch, with a lower crossing arch, curved lattice soffit, long blue stone joints and a windcatcher-like perforated crown.',
    size: [64, 45.25, 38],
    front: '±Z are the major east/west arch elevations; ±X are the narrower side arches',
    origin: 'Exact-QID mapped monument center at the surrounding plaza',
    refs: [
      'https://visitiran.ir/attraction/azadi-tower',
      'https://amanatarchitect.com/wp-content/uploads/2024/05/Bidoun-Interview-2013-1.pdf',
      'https://www.openstreetmap.org/relation/7814369',
    ],
    facts: {
      publishedHeightMeters: 45,
      publishedWidthMeters: 64,
      mappedMaximumOutlineMeters: [69.008, 39.998],
      majorFacades: 'east and west',
      architect: 'Hossein Amanat',
      cladding: 'white marble',
    },
    scaleBasis:
      'Iran official tourism dimensions and exterior photographs, architect interview, and exact-QID OSM diagonal-blade outline. The published 64 m width is preferred to the map’s 69 m outer outline; the detailed curves and tile lattice are photograph-fitted.',
    geographicProposal: {
      anchor: [51.338060499, 35.699738365],
      heading: -1.537172291074,
      source: 'https://www.openstreetmap.org/relation/7814369',
      evidence:
        'Mapped diagonal four-foot plan aligns the 64 m long dimension nearly north/south and the major arched ±Z facades east/west, as described by the official tourism source. The two-fold exterior symmetry makes a half-turn immaterial.',
      orientationConfidence: 'footprint-plus-published-major-facades',
      limitations:
        'Model fits the published 64 m monument rather than all map outline extremities. The plaza, fountain, ramps and surrounding landscaping are separate scenery.',
    },
    limits: [
      'Blade curvature, arch intrados, soffit tile lattice and crown opening dimensions are fitted to official exterior photography rather than the original structural drawings.',
      'Blue joints and crossed soffit ribs are geometric; their exact tile tessellation, marble panel seam layout and tiny crown motifs remain simplified.',
      'The under-plaza museum, fountain and landscaped square are outside this exterior monument asset.',
    ],
    cameras: [
      { name: 'great-arch', position: [12, 16, 72], lookAt: [0, 20, 0] },
      { name: 'crossing-arch', position: [64, 19, 16], lookAt: [0, 19, 0] },
      { name: 'vault-lattice', position: [0, 7, 18], lookAt: [0, 24, 0] },
      { name: 'crown', position: [22, 44, 32], lookAt: [0, 39, 0] },
      { name: 'far-silhouette', position: [95, 55, 130], lookAt: [0, 22, 0] },
    ],
  },
];

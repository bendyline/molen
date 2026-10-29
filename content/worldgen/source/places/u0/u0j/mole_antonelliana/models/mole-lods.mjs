/** Component-resampled Mole exterior; the original detailed master recipe is untouched. */
import {
  beam,
  loft,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  dark,
  column as detailedColumn,
  cornice as detailedCornice,
  frame as detailedFrame,
  face,
  pediment,
  stone,
  tau,
  transform,
  triangle,
  white,
} from '../../../../../../../../packages/worldgen/scripts/heritage-tower-detail-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const molePink = [0.76, 0.66, 0.55],
  roofStone = [0.49, 0.49, 0.45];
const squareRing = (y, r) => [
  [-r, y, -r],
  [-r, y, r],
  [r, y, r],
  [r, y, -r],
];
export const moleRadiusAt = (y) => 16.65 - 11.915 * Math.pow((y - 49) / (82.32 - 49), 1.43);

export function moleSkyline(out) {
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
  box(out, 'limestone', [-14.6, 0.2, -21.4], [14.6, 1.2, -17.9], stone);
  box(out, 'shadow', [-13.8, 1.2, -18.1], [13.8, 19.7, -17.95], dark);
  for (let i = 0; i < 6; i++)
    box(
      out,
      'limestone',
      [-11.5 + i * 4.6 - 0.48, 1.2, -21.03],
      [-11.5 + i * 4.6 + 0.48, 19.7, -20.07],
      stone,
    );
  box(out, 'limestone', [-14.6, 19.7, -21.3], [14.6, 21.2, -17.85], stone);
  const front = transform(out, Math.PI, [0, 0, 1.85]);
  triangle(
    front,
    'limestone',
    [
      [-14.6, 21.2, 23.25],
      [14.6, 21.2, 23.25],
      [0, 25.6, 23.25],
    ],
    stone,
  );
  box(out, 'shadow', [-17.3, 24.7, -17.3], [17.3, 36.1, 17.3], [0.31, 0.29, 0.25]);
  for (const x of [-19.45, 19.45])
    for (const z of [-19.45, 19.45])
      box(out, 'limestone', [x - 0.45, 24.7, z - 0.45], [x + 0.45, 36, z + 0.45], stone);
  for (const [width, y, h] of [
    [40.74, 24, 0.7],
    [41.04, 36, 0.9],
    [34.14, 48.45, 0.55],
  ])
    box(out, 'limestone', [-width / 2, y, -width / 2], [width / 2, y + h, width / 2], stone);
  loft(out, 'slate', [squareRing(36.9, 20.4), squareRing(39.1, 16.9)], roofStone);
  box(out, 'limestone', [-16.65, 39.1, -16.65], [16.65, 49, 16.65], molePink);
  loft(
    out,
    'slate',
    Array.from({ length: 9 }, (_, i) => {
      const y = 49 + (i * (82.32 - 49)) / 8;
      return squareRing(y, moleRadiusAt(y));
    }),
    roofStone,
  );
  upperProxy(out, 4);
}

function upperProxy(out, sides) {
  for (const [width, y, h] of [
    [11.92, 85.2, 0.65],
    [11.24, 92.63, 0.55],
    [11.74, 98.35, 0.65],
  ])
    box(out, 'limestone', [-width / 2, y, -width / 2], [width / 2, y + h, width / 2], stone);
  box(out, 'limestone', [-4.735, 82.32, -4.735], [4.735, 85.05, 4.735], stone);
  box(out, 'shadow', [-2.58, 85.85, -2.58], [2.58, 98.65, 2.58], [0.24, 0.25, 0.24]);
  for (const [bottom, top] of [
    [85.85, 92.63],
    [93.18, 98.35],
  ])
    for (const x of [-4.5, 4.5])
      for (const z of [-4.5, 4.5])
        box(out, 'limestone', [x - 0.3, bottom, z - 0.3], [x + 0.3, top, z + 0.3], molePink);
  loft(out, 'slate', [radialRing(99.3, 5.7, 5.7, 8), radialRing(106.4, 3.5, 3.5, 8)], roofStone);
  for (let side = 0; side < 4; side++)
    triangle(
      transform(out, (side * Math.PI) / 2),
      'limestone',
      [
        [-5.85, 99, 5.75],
        [5.85, 99, 5.75],
        [0, 102.7, 5.75],
      ],
      stone,
    );
  const profile = [
    [106.73, 3.8],
    [107.03, 3.8],
    [107.04, 0.95],
    [114.2, 0.95],
    [114.21, 3.41],
    [114.5, 3.41],
    [114.78, 0.95],
    [121.48, 0.95],
    [121.49, 2.58],
    [121.78, 2.58],
    [122, 1.3],
    [126.48, 1.3],
    [126.49, 2.35],
    [126.78, 2.35],
    [127, 1.68],
    [130.8, 1.55],
    [130.81, 2],
    [131.1, 2],
    [131.11, 1.55],
    [137.15, 1.35],
    [137.16, 1.8],
    [137.45, 1.8],
    [137.46, 1.35],
    [143.5, 1.15],
    [143.51, 1.58],
    [143.8, 1.58],
    [143.81, 1.15],
    [147.05, 1.02],
    [147.06, 1.85],
    [147.35, 1.85],
    [148.3, 0.94],
    [151.35, 0.94],
    [151.36, 1.55],
    [157.4, 0.57],
    [157.41, 0.96],
    [157.7, 0.96],
    [158.3, 0.62],
    [161, 0.3],
    [162.6, 0.29],
    [164.3, 0.07],
    [167.5, 0.01],
  ];
  loft(
    out,
    'limestone',
    profile.map(([y, r]) => radialRing(y, r, r, sides)),
    stone,
  );
  for (const [bottom, top, r] of [
    [107.03, 114.2, 2.93],
    [114.5, 121.48, 2.1],
  ])
    for (let i = 0; i < 4; i++) {
      const a = (i * tau) / 4,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      box(out, 'limestone', [x - 0.21, bottom, z - 0.21], [x + 0.21, top, z + 0.21], stone);
    }
}

function builder(cfg) {
  function frame(out, slot, x, y, w, h, z, border, color) {
    if (cfg.profiled) return detailedFrame(out, slot, x, y, w, h, z, border, color);
    for (const [x0, y0, x1, y1] of [
      [x - w / 2 - border, y - border, x + w / 2 + border, y],
      [x - w / 2 - border, y + h, x + w / 2 + border, y + h + border],
      [x - w / 2 - border, y, x - w / 2, y + h],
      [x + w / 2, y, x + w / 2 + border, y + h],
    ])
      face(
        out,
        slot,
        [
          [x0, y0, z + 0.05],
          [x1, y0, z + 0.05],
          [x1, y1, z + 0.05],
          [x0, y1, z + 0.05],
        ],
        color,
      );
  }
  const column = (out, slot, x, z, y0, y1, r, color) => {
    if (cfg.profiled) return detailedColumn(out, slot, x, z, y0, y1, r, color, cfg.columnSides);
    loft(
      out,
      slot,
      [
        radialRing(y0, r, r, cfg.columnSides, [x, z]),
        radialRing(y1, r * 0.85, r * 0.85, cfg.columnSides, [x, z]),
      ],
      color,
    );
  };
  const cornice = (out, slot, w, d, y, rise = 0.55, color = stone) =>
    cfg.profiled
      ? detailedCornice(out, slot, w, d, y, rise, color)
      : box(
          out,
          slot,
          [-w / 2 - 0.27, y, -d / 2 - 0.27],
          [w / 2 + 0.27, y + rise, d / 2 + 0.27],
          color,
        );
  function oculus(out, x, y, z, r, color = stone) {
    const point = (a, radius, zz) => [x + Math.cos(a) * radius, y + Math.sin(a) * radius, zz];
    const n = cfg.eyeSides;
    for (let i = 0; i < n; i++) {
      const a = (i * tau) / n,
        b = ((i + 1) * tau) / n;
      face(
        out,
        'limestone',
        [
          point(a, r, z + 0.03),
          point(b, r, z + 0.03),
          point(b, r * 0.72, z + 0.03),
          point(a, r * 0.72, z + 0.03),
        ],
        color,
      );
      triangle(out, 'shadow', [[x, y, z], point(a, r * 0.72, z), point(b, r * 0.72, z)], dark);
    }
  }
  function facade(out, slot, width, y0, y1, z, windows, color = stone) {
    const xs = [
      ...new Set([
        -width / 2,
        width / 2,
        ...windows.flatMap((w) => [w.x - w.w / 2, w.x + w.w / 2]),
      ]),
    ].sort((a, b) => a - b);
    const ys = [...new Set([y0, y1, ...windows.flatMap((w) => [w.y, w.top])])].sort(
      (a, b) => a - b,
    );
    for (let j = 1; j < ys.length; j++)
      for (let i = 1; i < xs.length; i++) {
        const x = (xs[i - 1] + xs[i]) / 2,
          y = (ys[j - 1] + ys[j]) / 2;
        if (windows.some((w) => x > w.x - w.w / 2 && x < w.x + w.w / 2 && y > w.y && y < w.top))
          continue;
        face(
          out,
          slot,
          [
            [xs[i - 1], ys[j - 1], z],
            [xs[i], ys[j - 1], z],
            [xs[i], ys[j], z],
            [xs[i - 1], ys[j], z],
          ],
          color,
        );
      }
    for (const w of windows) {
      const r = w.w / 2,
        back = z - (w.depth ?? 0.45),
        n = w.rise < 0.1 ? 1 : cfg.arch;
      face(
        out,
        'shadow',
        [
          [w.x - r, w.y, back],
          [w.x + r, w.y, back],
          [w.x + r, w.spring + w.rise, back],
          [w.x - r, w.spring + w.rise, back],
        ],
        dark,
      );
      for (let i = 0; i < n; i++) {
        const a = -r + (w.w * i) / n,
          b = -r + (w.w * (i + 1)) / n,
          ya = w.spring + w.rise * Math.sqrt(Math.max(0, 1 - (a * a) / (r * r))),
          yb = w.spring + w.rise * Math.sqrt(Math.max(0, 1 - (b * b) / (r * r)));
        face(
          out,
          slot,
          [
            [w.x + a, ya, z],
            [w.x + b, yb, z],
            [w.x + b, w.top, z],
            [w.x + a, w.top, z],
          ],
          color,
        );
        face(
          out,
          slot,
          [
            [w.x + a, ya, back],
            [w.x + b, yb, back],
            [w.x + b, yb, z],
            [w.x + a, ya, z],
          ],
          color,
        );
      }
      if (w.spring > w.y) {
        face(
          out,
          slot,
          [
            [w.x - r, w.y, z],
            [w.x - r, w.y, back],
            [w.x - r, w.spring, back],
            [w.x - r, w.spring, z],
          ],
          color,
        );
        face(
          out,
          slot,
          [
            [w.x + r, w.y, back],
            [w.x + r, w.y, z],
            [w.x + r, w.spring, z],
            [w.x + r, w.spring, back],
          ],
          color,
        );
      }
      face(
        out,
        slot,
        [
          [w.x - r, w.y, z],
          [w.x + r, w.y, z],
          [w.x + r, w.y, back],
          [w.x - r, w.y, back],
        ],
        color,
      );
    }
  }
  function balcony(out, radius, y, _sides, _slot = 'limestone', color = stone) {
    const sides = cfg.roundSides,
      slot = _slot;
    loft(
      out,
      slot,
      [radialRing(y, radius, radius, sides), radialRing(y + 0.3, radius, radius, sides)],
      color,
    );
    const point = (r, yy, a) => [Math.cos(a) * r, yy, Math.sin(a) * r];
    if (!cfg.railPosts) {
      loft(
        out,
        slot,
        [radialRing(y + 0.3, radius, radius, sides), radialRing(y + 1.26, radius, radius, sides)],
        color,
      );
      return;
    }
    for (let i = 0; i < sides; i++) {
      const a = (-i * tau) / sides,
        b = (-(i + 1) * tau) / sides;
      for (const [r, y0, y1, reverse] of [
        [radius + 0.04, y + 1.12, y + 1.26, false],
        [radius - 0.28, y + 1.12, y + 1.26, true],
      ]) {
        const p = [point(r, y0, a), point(r, y0, b), point(r, y1, b), point(r, y1, a)];
        face(out, slot, reverse ? p.reverse() : p, color);
      }
      face(
        out,
        slot,
        [
          point(radius - 0.28, y + 1.26, a),
          point(radius + 0.04, y + 1.26, a),
          point(radius + 0.04, y + 1.26, b),
          point(radius - 0.28, y + 1.26, b),
        ],
        color,
      );
    }
    for (let i = 0; i < cfg.railPosts; i++) {
      const a = (i * tau) / cfg.railPosts,
        x = Math.cos(a) * (radius - 0.14),
        z = Math.sin(a) * (radius - 0.14);
      box(out, slot, [x - 0.045, y + 0.3, z - 0.045], [x + 0.045, y + 1.12, z + 0.045], color);
    }
  }
  function roofRib(out, slot, a, b, width, depth, color) {
    const p = (v, x, z) => [v[0] + x, v[1], v[2] + z];
    face(
      out,
      slot,
      [
        p(a, -width / 2, depth / 2),
        p(a, width / 2, depth / 2),
        p(b, width / 2, depth / 2),
        p(b, -width / 2, depth / 2),
      ],
      color,
    );
    if (cfg.ribSides)
      for (const s of [-1, 1]) {
        const q = [
          p(a, (s * width) / 2, -depth / 2),
          p(a, (s * width) / 2, depth / 2),
          p(b, (s * width) / 2, depth / 2),
          p(b, (s * width) / 2, -depth / 2),
        ];
        face(out, slot, s > 0 ? q.reverse() : q, color);
      }
  }
  function buildMole(out) {
    // Exact-QID outline distinguishes the broad rear wings from the main 39 m square.
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
          wins.push({
            x: i * 5.2,
            w: 2.7,
            y,
            spring: y + 5.2,
            rise: 0.02,
            top: y + 5.3,
            depth: 0.4,
          });
      facade(wall, 'limestone', 39.5, 0, 24, 19.78, wins, molePink);
      if (cfg.frames)
        for (let i = -3; i <= 3; i++)
          for (const y of [2.2, 10.3])
            frame(wall, 'limestone', i * 5.2, y, 2.7, 5.3, 19.82, 0.18, stone);
      for (let i = -4; i <= 4; i++)
        if (cfg.frames || i % 2 === 0)
          box(
            wall,
            'limestone',
            [i * 4.75 - 0.32, 0.6, 19.83],
            [i * 4.75 + 0.32, 24, 20.13],
            stone,
          );
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
      for (let i = 0; i < cfg.lowerColumns; i++)
        column(
          wall,
          'limestone',
          -18.4 + (i * 36.8) / (cfg.lowerColumns - 1),
          19.45,
          24.7,
          35.6,
          0.23,
          stone,
          12,
        );
      for (let i = 0; i < (cfg.frames ? 21 : 0); i++)
        box(
          wall,
          'shadow',
          [-18.05 + (i * 36.8) / (cfg.lowerColumns - 1), 27.4, 17.4],
          [-16.78 + (i * 36.8) / (cfg.lowerColumns - 1), 34.9, 17.48],
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
      for (let i = 0; i < (cfg.profiled ? 52 : 0); i++)
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
    const radiusAt = (y) => 16.65 - 11.915 * Math.pow((y - 49) / (82.32 - 49), 1.43);
    const levels = Array.from(
      { length: cfg.curve + 1 },
      (_, i) => 49 + (i * (82.32 - 49)) / cfg.curve,
    );
    loft(
      out,
      'slate',
      levels.map((y) => squareRing(y, radiusAt(y))),
      roofStone,
    );
    for (let side = 0; side < 4; side++) {
      const wall = transform(out, (side * Math.PI) / 2);
      for (let rib = 0; rib < (cfg.ribs ? 18 : 0); rib++) {
        const x = (rib - 8.5) * 1.8;
        for (let j = 0; j < levels.length - 1; j++) {
          const a = levels[j],
            b = levels[j + 1];
          if (Math.abs(x) + 0.18 > radiusAt(b)) continue;
          roofRib(
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
      for (let row = 0; row < cfg.eyeRows; row++) {
        const y = 55 + row * 6.25,
          r = radiusAt(y);
        const count = [6, 5, 4, 3][row];
        for (let i = 0; i < count; i++) {
          const x = (i - (count - 1) / 2) * 3.6;
          if (Math.abs(x) + 0.5 >= r) continue;
          const eye = transform(wall, 0, [x, y, r + 0.16]);
          oculus(eye, 0, 0, 0, 0.36, molePink);
        }
      }
    }
    if (cfg.proxyUpper) {
      upperProxy(out, 6);
      return;
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
        column(wall, 'limestone', x, 4.5, 88.05, 92.63, 0.2, molePink, 16);
        column(wall, 'limestone', x, 4.5, 93.18, 98.35, 0.2, molePink, 16);
      }
      for (let i = 0; i < cfg.squareRailPosts; i++)
        column(
          wall,
          'limestone',
          -5.65 + (i * 11.3) / Math.max(1, cfg.squareRailPosts - 1),
          5.68,
          85.85,
          86.95,
          0.045,
          molePink,
          8,
        );
      box(wall, 'limestone', [-5.96, 86.95, 5.58], [5.96, 87.13, 5.86], stone);
      pediment(wall, 11.7, 99.0, 5.75, 3.7, stone);
      oculus(wall, 0, 100.25, 5.82, 0.58, molePink);
    }
    cornice(out, 'limestone', 10.7, 10.7, 92.63, 0.55, stone);
    cornice(out, 'limestone', 11.2, 11.2, 98.35, 0.65, stone);
    loft(
      out,
      'slate',
      [radialRing(99.3, 5.7, 5.7, cfg.roundSides), radialRing(106.4, 3.5, 3.5, cfg.roundSides)],
      roofStone,
    );
    for (let i = 0; i < (cfg.ribs ? 12 : 0); i++) {
      const a = (i / 12) * tau;
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
        column(
          out,
          'limestone',
          Math.cos(a) * r,
          Math.sin(a) * r,
          bottom === 114.78 ? 114.5 : bottom,
          top,
          0.21,
          stone,
          16,
        );
      }
      loft(
        out,
        'shadow',
        [
          radialRing(bottom, 0.95, 0.95, cfg.roundSides),
          radialRing(top, 0.95, 0.95, cfg.roundSides),
        ],
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
        147.35,
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
    sphere(out, 'metal', [0, 162.1, 0], [0.46, 0.55, 0.46], [0.39, 0.45, 0.37], cfg.roundSides, 6);
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

  return buildMole;
}

export const moleDistrict = builder({
  proxyUpper: true,
  lowerColumns: 7,
  columnSides: 4,
  profiled: false,
  frames: false,
  arch: 4,
  curve: 10,
  ribs: false,
  ribSides: false,
  eyeRows: 0,
  eyeSides: 8,
  roundSides: 8,
  railPosts: 0,
  squareRailPosts: 0,
});

export const moleStreet = builder({
  lowerColumns: 22,
  columnSides: 6,
  profiled: false,
  frames: true,
  arch: 6,
  curve: 18,
  ribs: true,
  ribSides: false,
  eyeRows: 4,
  eyeSides: 8,
  roundSides: 12,
  railPosts: 8,
  squareRailPosts: 4,
});

export const moleCloseup = builder({
  lowerColumns: 22,
  columnSides: 8,
  profiled: true,
  frames: true,
  arch: 10,
  curve: 36,
  ribs: true,
  ribSides: true,
  eyeRows: 4,
  eyeSides: 12,
  roundSides: 24,
  railPosts: 16,
  squareRailPosts: 16,
});

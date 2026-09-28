/** Individually researched tower exteriors, candidates N0580–N0591. Dimensions are metres. */

import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  annulus,
  archBay,
  column,
  facade,
  face,
  frame,
  tau,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

function dial(out, x, y, z, r, color) {
  const p = (rr, a, zz = z) => [x + Math.sin(a) * rr, y + Math.cos(a) * rr, zz];
  for (let i = 0; i < 72; i++) {
    const a = (i * tau) / 72,
      b = ((i + 1) * tau) / 72;
    triangle(out, 'carvedstone', [[x, y, z], p(r, b), p(r, a)], [0.07, 0.09, 0.075]);
    beam(out, 'metal', p(r, a, z + 0.02), p(r, b, z + 0.02), 0.043, 0.045, color);
  }
  // Traditional clockface numerals, including the photographed IIII at four.
  const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  const strokes = {
    I: [[0, 0, 0, 1]],
    V: [
      [-0.5, 1, 0, 0],
      [0, 0, 0.5, 1],
    ],
    X: [
      [-0.5, 0, 0.5, 1],
      [-0.5, 1, 0.5, 0],
    ],
  };
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12,
      label = numerals[i],
      cw = 0.085,
      ch = r * 0.19;
    const at = (u, v) => [
      x + Math.sin(a) * (r * 0.72 + v * ch) + Math.cos(a) * u,
      y + Math.cos(a) * (r * 0.72 + v * ch) - Math.sin(a) * u,
      z + 0.045,
    ];
    for (let j = 0; j < label.length; j++)
      for (const [u, v, uu, vv] of strokes[label[j]]) {
        const cx = (j - (label.length - 1) / 2) * cw;
        beam(
          out,
          'metal',
          at(cx + u * cw * 0.7, v),
          at(cx + uu * cw * 0.7, vv),
          0.029,
          0.035,
          color,
        );
      }
  }
  beam(out, 'metal', [x, y, z + 0.08], p(r * 0.78, 0.31, z + 0.08), 0.055, 0.055, color);
  beam(out, 'metal', [x, y, z + 0.1], p(r * 0.52, 2.21, z + 0.1), 0.08, 0.06, color);
  sphere(out, 'metal', [x, y, z + 0.11], [0.095, 0.095, 0.055], color, 16, 8);
}

function buildMunt(out) {
  const brick = [0.55, 0.33, 0.23],
    stone = [0.75, 0.73, 0.6],
    lead = [0.37, 0.4, 0.36],
    dark = [0.07, 0.09, 0.08],
    gold = [0.87, 0.65, 0.21];
  const angle = 0.4307,
    rr = 2.89,
    parts = JSON.parse(
      readFileSync(structureSourcePath('n0585_munttoren', 'reference-metadata.json'), 'utf8'),
    ).parts;
  // Round medieval lower shaft with actual recessed openings between the pale stone courses.
  const windows = [
    { a: angle, w: 0.82, y: 0.45, top: 2.45 },
    { a: angle + Math.PI / 4, w: 0.27, y: 2.25, top: 3.25 },
    { a: angle + Math.PI / 2, w: 0.7, y: 5.2, top: 6.12 },
    { a: angle + Math.PI, w: 0.27, y: 3.9, top: 5.0 },
    { a: angle + Math.PI * 1.5, w: 0.7, y: 5.2, top: 6.12 },
  ];
  const ys = [0, 0.45, 2.25, 2.45, 3.25, 3.9, 5, 5.2, 6.12, 8.45];
  const p = (a, y, r = rr) => [Math.sin(a) * r, y, Math.cos(a) * r];
  for (let i = 0; i < 128; i++) {
    const a = (i * tau) / 128,
      b = ((i + 1) * tau) / 128,
      m = (a + b) / 2;
    for (let j = 0; j < ys.length - 1; j++) {
      const y = (ys[j] + ys[j + 1]) / 2;
      if (
        windows.some(
          (w) =>
            Math.abs(Math.atan2(Math.sin(m - w.a), Math.cos(m - w.a))) < w.w / 2 / rr &&
            y > w.y &&
            y < w.top,
        )
      )
        continue;
      face(out, 'brick', [p(a, ys[j]), p(b, ys[j]), p(b, ys[j + 1]), p(a, ys[j + 1])], brick);
    }
  }
  for (const w of windows) {
    const wall = transform(out, w.a);
    archBay(
      wall,
      'limestone',
      0,
      w.w,
      w.y,
      w.top - 0.22,
      0.2,
      w.top + 0.02,
      rr - 0.025,
      0.24,
      stone,
      { trim: 0.075 },
    );
    if (w.w > 0.5) {
      box(
        wall,
        'wood',
        [-w.w / 2, w.y, rr - 0.265],
        [w.w / 2, w.top - 0.18, rr - 0.24],
        [0.31, 0.35, 0.24],
      );
      for (let y = w.y + 0.25; y < w.top - 0.2; y += 0.35)
        beam(
          wall,
          'limestone',
          [-w.w / 2, y, rr - 0.2],
          [w.w / 2, y, rr - 0.2],
          0.04,
          0.045,
          stone,
        );
    }
  }
  for (const y of [0.45, 1.23, 2.06, 3.1, 4.08, 5.04, 6.02, 7.07, 8.1])
    annulus(out, 'limestone', rr - 0.1, rr + 0.018, y, y + 0.11, stone, 128);
  // Upper octagonal brick stage preserves the mapped clock-frame rotation.
  for (let i = 0; i < 8; i++) {
    const wall = transform(out, angle + (i * Math.PI) / 4),
      w = 2 * rr * Math.sin(Math.PI / 8),
      z = rr * Math.cos(Math.PI / 8);
    facade(
      wall,
      'brick',
      w,
      8.45,
      14.2,
      z,
      [
        { x: 0, w: 0.74, y: 9.5, spring: 10.6, rise: 0.36, top: 11.08, depth: 0.27, trim: 0.09 },
        { x: 0, w: 0.79, y: 12.1, spring: 13.26, rise: 0.39, top: 13.79, depth: 0.27, trim: 0.09 },
      ],
      brick,
    );
    for (const y of [8.45, 11.54, 14.05])
      box(
        wall,
        'limestone',
        [-w / 2 - 0.025, y, z - 0.06],
        [w / 2 + 0.025, y + 0.15, z + 0.13],
        stone,
      );
    for (const x of [-w * 0.41, w * 0.41])
      for (let y = 8.8; y < 14; y += 0.42)
        box(wall, 'limestone', [x - 0.105, y, z - 0.03], [x + 0.105, y + 0.18, z + 0.018], stone);
    for (const y of [10.05, 12.65]) {
      box(wall, 'wood', [-0.32, y - 0.4, z - 0.26], [0.32, y + 0.7, z - 0.23], dark);
      beam(wall, 'limestone', [0, y - 0.4, z - 0.2], [0, y + 0.7, z - 0.2], 0.045, 0.05, stone);
      beam(
        wall,
        'limestone',
        [-0.34, y + 0.16, z - 0.2],
        [0.34, y + 0.16, z - 0.2],
        0.045,
        0.05,
        stone,
      );
    }
  }
  const ring = (y, r) => radialRing(y, r, r, 8, [0, 0], -0.0375);
  loft(
    out,
    'metal',
    [
      [14.18, 3.03],
      [14.53, 2.93],
      [14.91, 2.33],
    ].map(([y, r]) => ring(y, r)),
    lead,
  );
  // Gray lead-clad Renaissance blind-arch stage with engaged pilasters.
  for (let i = 0; i < 8; i++) {
    const wall = transform(out, angle + (i * Math.PI) / 4),
      r = 2.28,
      z = r * Math.cos(Math.PI / 8),
      w = 2 * r * Math.sin(Math.PI / 8);
    facade(
      wall,
      'metal',
      w,
      14.9,
      20.9,
      z,
      [{ x: 0, w: 1.2, y: 15.3, spring: 19.1, rise: 0.6, top: 20.0, depth: 0.15, trim: 0.13 }],
      lead,
    );
    box(wall, 'metal', [-0.56, 15.3, z - 0.17], [0.56, 19.18, z - 0.14], [0.5, 0.51, 0.46]);
    for (const x of [-w / 2 + 0.12, w / 2 - 0.12])
      column(wall, 'metal', x, z + 0.05, 15.05, 20.55, 0.1, [0.5, 0.52, 0.47], 12);
    for (const y of [14.93, 20.3, 20.66])
      box(wall, 'metal', [-w / 2 - 0.1, y, z - 0.08], [w / 2 + 0.1, y + 0.16, z + 0.15], lead);
  }
  loft(
    out,
    'metal',
    [
      [20.9, 2.55],
      [21.28, 2.55],
      [21.7, 1.87],
    ].map(([y, r]) => ring(y, r)),
    lead,
  );
  loft(out, 'metal', [ring(21.45, 1.79), ring(25.16, 1.79)], lead);
  for (let i = 0; i < 4; i++) {
    const wall = transform(out, angle + (i * Math.PI) / 2);
    dial(wall, 0, 23.53, 2.0, 1.3, gold);
    triangle(
      wall,
      'metal',
      [
        [-1.35, 21.28, 2.01],
        [1.35, 21.28, 2.01],
        [0, 22.0, 2.01],
      ],
      lead,
    );
    for (const s of [-1, 1])
      beam(wall, 'metal', [s * 1.39, 21.3, 2.09], [0, 22.03, 2.09], 0.09, 0.12, stone);
  }
  // Open bell lantern with original visible bell geometry, no opaque filled-in octagon.
  for (let i = 0; i < 8; i++) {
    const wall = transform(out, angle + (i * Math.PI) / 4),
      z = 1.57 * Math.cos(Math.PI / 8),
      w = 2 * 1.57 * Math.sin(Math.PI / 8);
    archBay(wall, 'metal', 0, w - 0.27, 25.13, 28.44, 0.39, 29.15, z, 0.17, lead, {
      back: false,
      trim: 0.07,
    });
    for (const x of [-w / 2 + 0.07, w / 2 - 0.07])
      column(wall, 'metal', x, z, 25.05, 29.15, 0.11, stone, 12);
    for (let level = 0; level < 3; level++) {
      const y = 25.65 + level * 0.98,
        r = 0.37 - level * 0.07;
      loft(
        wall,
        'metal',
        [
          [y, 0.7 * r],
          [y + 0.1, r],
          [y + 0.28, r * 0.7],
          [y + 0.54, r * 0.44],
          [y + 0.64, r * 0.25],
        ].map(([yy, rr]) => radialRing(yy, rr, rr, 20, [0, 0.65])),
        gold,
      );
      beam(wall, 'metal', [-0.43, y + 0.65, 0.65], [0.43, y + 0.65, 0.65], 0.1, 0.12, lead);
      beam(
        wall,
        'metal',
        [0, y + 0.18, 0.65],
        [0, y + 0.52, 0.65],
        0.045,
        0.045,
        [0.22, 0.2, 0.13],
      );
    }
  }
  for (const y of [25.05, 29.05, 29.37])
    loft(out, 'metal', [ring(y, 1.81), ring(y + 0.17, 1.81)], lead);
  loft(
    out,
    'metal',
    [
      [29.55, 1.86],
      [30.35, 1.09],
      [31.53, 0.66],
      [31.88, 0.59],
    ].map(([y, r]) => ring(y, r)),
    lead,
  );
  // Open orb and weathercock finial, fitted to the municipal measured elevation.
  for (let j = 0; j < 8; j++) {
    const a = (j * tau) / 8;
    for (let i = 0; i < 22; i++) {
      const t = (i / 22) * Math.PI,
        u = ((i + 1) / 22) * Math.PI;
      const p = (v) => [
        Math.sin(v) * 1.05 * Math.cos(a),
        32 + (v / Math.PI) * 2.2,
        Math.sin(v) * 1.05 * Math.sin(a),
      ];
      beam(out, 'metal', p(t), p(u), 0.065, 0.07, lead);
    }
  }
  annulus(out, 'metal', 1.0, 1.085, 33.03, 33.12, lead, 64);
  beam(out, 'metal', [0, 31.85, 0], [0, 40.6, 0], 0.075, 0.075, lead);
  for (const [y, r] of [
    [34.5, 0.25],
    [36.1, 0.24],
    [38.35, 0.17],
  ])
    sphere(out, 'metal', [0, y, 0], [r, r, r], gold, 24, 12);
  for (const y of [36.8, 38.4]) {
    beam(out, 'metal', [-0.7, y, 0], [0.7, y, 0], 0.055, 0.055, lead);
    sphere(out, 'metal', [0, y, 0], [0.15, 0.15, 0.15], lead, 16, 8);
  }
  const bird = transform(out, 0, [0, 40.13, 0]);
  sphere(bird, 'metal', [0.05, 0.25, 0], [0.38, 0.26, 0.1], gold, 24, 12);
  sphere(bird, 'metal', [0.33, 0.56, 0], [0.17, 0.22, 0.09], gold, 20, 12);
  beam(bird, 'metal', [0.29, 0.73, 0], [0.38, 0.87, 0], 0.08, 0.07, gold);
  triangle(
    bird,
    'metal',
    [
      [0.43, 0.59, 0.025],
      [0.65, 0.52, 0.025],
      [0.43, 0.47, 0.025],
    ],
    gold,
  );
  for (let i = 0; i < 5; i++)
    beam(bird, 'metal', [-0.23, 0.23, 0], [-0.53 - i * 0.05, 0.38 + i * 0.13, 0], 0.1, 0.085, gold);
  // The two narrow historic projections are distinct from the adjoining guard house.
  for (const [id, height] of [
    [751683816, 7],
    [751683817, 10],
  ]) {
    const poly = parts.find((p) => p.id === id).outline.slice(0, -1);
    const rev =
      poly.reduce((s, p, i) => {
        const q = poly[(i + 1) % poly.length];
        return s + p[0] * q[1] - p[1] * q[0];
      }, 0) > 0
        ? poly.toReversed()
        : poly;
    loft(
      out,
      'brick',
      [rev.map(([x, z]) => [x, 0, z]), rev.map(([x, z]) => [x, height - 1, z])],
      brick,
    );
    const cx = poly.reduce((s, p) => s + p[0], 0) / 4,
      cz = poly.reduce((s, p) => s + p[1], 0) / 4;
    loft(
      out,
      'metal',
      [
        rev.map(([x, z]) => [x, height - 1, z]),
        rev.map(([x, z]) => [cx + (x - cx) * 0.03, height, cz + (z - cz) * 0.8]),
      ],
      lead,
    );
  }
}

function buildKizil(out) {
  const stone = [0.64, 0.48, 0.3],
    brick = [0.7, 0.34, 0.2],
    pale = [0.74, 0.63, 0.45],
    dark = [0.15, 0.15, 0.12];
  // Exact mapped eight major corners: the slight asymmetry is retained.
  const ring = [
    [14.239, -5.081],
    [14.239, 5.965],
    [6.185, 13.674],
    [-5.808, 13.675],
    [-14.239, 6.063],
    [-14.233, -4.992],
    [-5.716, -13.683],
    [6.277, -13.683],
  ];
  for (let i = 0; i < 8; i++) {
    const p = ring[i],
      q = ring[(i + 1) % 8],
      dx = q[0] - p[0],
      dz = q[1] - p[1],
      width = Math.hypot(dx, dz);
    const a = Math.atan2(dz, -dx),
      wall = transform(out, a, [(p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2]);
    // Loopholes have real reveals; the western entrance is deliberately small.
    const lower = [
      { x: 0, w: 0.27, y: 6.1, spring: 7.07, rise: 0.1, top: 7.25, depth: 0.65, trim: 0 },
      ...[-2.65, 2.65].map((x) => ({
        x,
        w: 0.22,
        y: 11.7,
        spring: 12.73,
        rise: 0.09,
        top: 12.94,
        depth: 0.68,
        trim: 0,
      })),
      { x: 0, w: 0.27, y: 16.4, spring: 17.42, rise: 0.12, top: 17.58, depth: 0.66, trim: 0 },
    ];
    if (i === 5)
      lower.push({
        x: -2.25,
        w: 1.27,
        y: 3,
        spring: 4.54,
        rise: 0.42,
        top: 5.05,
        depth: 1.2,
        trim: 0.12,
      });
    facade(wall, 'limestone', width, 0, 18.8, 0, lower, stone);
    const upper = [
      ...[-2.65, 2.65].map((x) => ({
        x,
        w: 0.24,
        y: 21.2,
        spring: 22.35,
        rise: 0.09,
        top: 22.56,
        depth: 0.62,
        trim: 0,
      })),
      { x: 0, w: 0.25, y: 26.2, spring: 27.1, rise: 0.1, top: 27.29, depth: 0.6, trim: 0 },
    ];
    facade(wall, 'brick', width, 18.8, 31.35, 0, upper, brick);
    // Irregular pale ashlar repairs and reused column ends occur in the lower stonework.
    for (let row = 0; row < 21; row++)
      for (let j = 0; j < Math.floor(width / 0.9); j++) {
        if ((row * 11 + j * 7 + i * 13) % 19 !== 0) continue;
        const x = -width / 2 + 0.45 + j * 0.9,
          y = 0.5 + row * 0.81;
        if (
          lower.some((w) => Math.abs(x - w.x) < w.w / 2 + 0.5 && y > w.y - 0.5 && y < w.top + 0.4)
        )
          continue;
        box(wall, 'limestone', [x - 0.39, y, -0.01], [x + 0.39, y + 0.34, 0.017], pale);
      }
    // Twenty-two projecting defensive drop openings: six faces have three, two have two.
    const count = i === 1 || i === 5 ? 2 : 3;
    for (let j = 0; j < count; j++) {
      const x = (j - (count - 1) / 2) * 3.3;
      for (const s of [-1, 1]) {
        box(
          wall,
          'limestone',
          [x + s * 0.44 - 0.13, 27.52, 0.02],
          [x + s * 0.44 + 0.13, 28.16, 0.54],
          pale,
        );
        box(
          wall,
          'brick',
          [x + s * 0.46 - 0.19, 28.1, 0],
          [x + s * 0.46 + 0.19, 29.36, 0.76],
          brick,
        );
      }
      box(wall, 'brick', [x - 0.75, 29.28, -0.04], [x + 0.75, 29.65, 0.83], brick);
      face(
        wall,
        'shadow',
        [
          [x - 0.28, 28.15, 0.025],
          [x + 0.28, 28.15, 0.025],
          [x + 0.28, 29.28, 0.025],
          [x - 0.28, 29.28, 0.025],
        ],
        dark,
      );
    }
    box(wall, 'brick', [-width / 2, 31.2, -0.77], [width / 2, 31.48, 0.025], brick);
    for (let j = 0; j < 7; j++) {
      const x = -width / 2 + ((j + 0.5) * width) / 7;
      box(wall, 'brick', [x - 0.46, 31.4, -0.86], [x + 0.46, 33, 0.05], brick);
      box(wall, 'limestone', [x - 0.48, 32.91, -0.9], [x + 0.48, 33.04, 0.08], pale);
    }
    // The open upper terrace and lower arcaded court are visible from world-viewer flight.
    const inside = transform(out, a + Math.PI, [
      ((p[0] + q[0]) * 0.72) / 2,
      0,
      ((p[1] + q[1]) * 0.72) / 2,
    ]);
    facade(
      inside,
      'brick',
      width * 0.72,
      24.25,
      28.4,
      0,
      [-1, 1].map((s) => ({
        x: s * width * 0.18,
        w: width * 0.285,
        y: 24.25,
        spring: 26.4,
        rise: 1.35,
        top: 28.25,
        depth: 0.48,
        pointed: true,
        trim: 0.09,
      })),
      brick,
    );
    face(
      out,
      'limestone',
      [
        [p[0] * 0.72, 28.4, p[1] * 0.72],
        [q[0] * 0.72, 28.4, q[1] * 0.72],
        [q[0] * 0.946, 28.4, q[1] * 0.946],
        [p[0] * 0.946, 28.4, p[1] * 0.946],
      ],
      pale,
    );
    // Parapet inner face retains the gallery walkway without sealing the central court.
    face(
      out,
      'brick',
      [
        [p[0] * 0.946, 28.4, p[1] * 0.946],
        [q[0] * 0.946, 28.4, q[1] * 0.946],
        [q[0] * 0.946, 31.4, q[1] * 0.946],
        [p[0] * 0.946, 31.4, p[1] * 0.946],
      ],
      brick,
    );
    if (i < 6) box(wall, 'limestone', [-0.16, 30.02, 0.02], [0.16, 30.22, 1.1], pale);
  }
  // An octagonal terrace, central cistern mouth and sixteen light wells in two rings.
  loft(
    out,
    'limestone',
    [
      radialRing(24.1, 10.95, 10.95, 8, [0, 0], Math.PI / 8),
      radialRing(24.27, 10.95, 10.95, 8, [0, 0], Math.PI / 8),
    ],
    pale,
  );
  annulus(out, 'limestone', 0.62, 1.05, 24.27, 24.72, stone, 32);
  annulus(out, 'limestone', 0.58, 1.14, 24.7, 24.9, pale, 32);
  for (const r of [3.8, 7.4])
    for (let i = 0; i < 8; i++) {
      const a = (i * tau) / 8,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r;
      box(out, 'limestone', [x - 0.48, 24.27, z - 0.37], [x + 0.48, 24.49, z + 0.37], pale);
      box(out, 'shadow', [x - 0.27, 24.49, z - 0.22], [x + 0.27, 24.5, z + 0.22], dark);
    }
  // Two stair flights connect court and perimeter gallery at opposite sides.
  for (const sign of [-1, 1])
    for (let i = 0; i < 17; i++)
      box(
        out,
        'limestone',
        [sign > 0 ? 8.65 : -10.3, 24.27, -4.8 + i * 0.32],
        [sign > 0 ? 10.3 : -8.65, 24.27 + (i + 1) * (4.13 / 17), -4.48 + i * 0.32],
        pale,
      );
  // Inscription tablets: primary source fixes the northern tablet at approximately ten metres.
  for (const [side, y] of [
    [7, 10],
    [3, 12.2],
  ]) {
    const p = ring[side],
      q = ring[(side + 1) % 8],
      a = Math.atan2(q[1] - p[1], p[0] - q[0]);
    const wall = transform(out, a, [(p[0] + q[0]) / 2, 0, (p[1] + q[1]) / 2]);
    box(wall, 'limestone', [-1.12, y, -0.02], [1.12, y + 1.27, 0.15], pale);
    for (let line = 0; line < 4; line++)
      for (let k = 0; k < 13; k++)
        box(
          wall,
          'carvedstone',
          [-0.97 + k * 0.15, y + 0.14 + line * 0.25, 0.15],
          [-0.91 + k * 0.15, y + 0.25 + line * 0.25, 0.17],
          stone,
        );
  }
}

export const heritageTowers580 = [
  {
    id: 'n0591_k_z_l_kule',
    planId: 'N0591',
    title: 'Kızıl Kule',
    wikidata: 'Q2470666',
    build: buildKizil,
    authoringFile: 'heritage-towers-580-models.mjs',
    brief:
      'Alanya’s octagonal Red Tower: heavy limestone lower walls, red brick upper defenses, narrow arrow slits, twenty-two projecting drop openings, crenellated crown, open arcaded roof court, gallery stairs, cistern and sixteen light wells.',
    size: [29, 33.04, 28],
    front:
      'Exact mapped native frame; the small west entrance occupies the west-facing diagonal wall',
    origin:
      'Exact mapped tower centroid with lowest eastern stone base at Y=0; the western ground naturally rises around its lower three metres',
    refs: [
      'https://www.alanya.bel.tr/S/811/Red-Tower',
      'https://www.alanya.bel.tr/Photos/Pages/850440640.jpg',
      'https://www.alanya.bel.tr/Photos/Gallery/Photos/503820288.jpg',
      'https://www.alanya.bel.tr/Photos/Gallery/Photos/400203936.jpg',
      'https://www.openstreetmap.org/way/57956094',
    ],
    facts: {
      eastHeightMeters: 33,
      westGroundRiseMeters: 3,
      planSides: 8,
      tiers: 5,
      defensiveDropOpenings: 22,
      drains: 6,
      terraceLightWells: 16,
      completionYear: 1226,
    },
    scaleBasis:
      'Alanya municipality publishes the 33 m eastern height, 3 m terrain difference, eight-sided plan and defensive opening counts. Exact OSM corners set the asymmetric plan; municipal aerial photographs establish the stone/brick transition, crenels and open roof court with lower arches and two stair flights.',
    geographicProposal: {
      anchor: [31.998251276, 36.536394584],
      heading: 0.540081694339,
      source: 'https://www.openstreetmap.org/way/57956094',
      evidence:
        'The eight mapped major corners are authored directly in the cached native frame. The small west-facing entrance and northern inscription tablet resolve rotational ambiguity; lowest eastern base is the ground contact datum.',
      orientationConfidence: 'exact-eight-corner-outline-and-primary-directed-features',
      limitations:
        'The adjoining city walls are separate structures. The documented 3 m western ground rise is not baked into a terrain slab; the tower retains the complete lower eastern wall for terrain placement.',
    },
    limits: [
      'Inscription tablets preserve their documented faces and relief rhythm without inventing legible Arabic text. Minor individual reused stone positions are original geometric reconstructions.',
      'The visible open rooftop court, stairs, gallery, cistern and light wells are modeled; enclosed interior museum rooms are outside this exterior asset.',
    ],
    cameras: [
      { name: 'west-entrance', position: [-30, 10, -29], lookAt: [-8, 8, -7] },
      { name: 'drop-openings', position: [25, 29, 30], lookAt: [0, 27, 0] },
      { name: 'open-terrace', position: [32, 51, 34], lookAt: [0, 27, 0] },
      { name: 'north-tablet', position: [29, 15, -31], lookAt: [5, 13, -8] },
      { name: 'far-silhouette', position: [60, 28, 72], lookAt: [0, 16, 0] },
    ],
  },
  {
    id: 'n0585_munttoren',
    planId: 'N0585',
    title: 'Munttoren',
    wikidata: 'Q1429748',
    build: buildMunt,
    authoringFile: 'heritage-towers-580-models.mjs',
    brief:
      'Amsterdam’s surviving round gate tower with pale stone courses, upper octagonal brick stage, lead-clad Renaissance arches, four gilt clocks, an open carillon lantern, slender roof, open orb and gilded weathercock. Two mapped narrow lower projections retain the real asymmetric plan.',
    size: [9, 41, 6.2],
    front:
      'Clock frame follows the mapped octagonal parts; +X follows the southeast projection and −X the northwest stair projection',
    origin:
      'Concentric mapped octagonal tower center, pavement Y=0; the separate nineteenth-century guard house is outside this tower asset',
    refs: [
      'https://pure.uva.nl/ws/files/2809631/178913_Historisch_hout_in_Amsterdamse_monumenten.pdf',
      'https://amsterdam-monumentenstad.nl/database/grachtenboek_objecten.php?id=3085',
      'https://amsterdam-monumentenstad.nl/database/pics/3/20200902-8.jpg',
      'https://amsterdam-monumentenstad.nl/database/uploads/3/20200902-11.jpg',
      'https://amsterdam-monumentenstad.nl/database/uploads/3/20200902-12.jpg',
      'https://amsterdam-monumentenstad.nl/database/uploads/3/munttoren-tek.jpg',
      'https://www.amsterdam.nl/stadsarchief/stukken/grachten-torens/munttoren/',
      'https://www.openstreetmap.org/way/57862728',
    ],
    facts: {
      overallHeightMeters: 41,
      clockFaces: 4,
      upperPlanSides: 8,
      existingCarillonBells: 38,
      spireDesigner: 'Hendrick de Keyser',
      spireCompletionYear: 1620,
      mainBrickStageHeightMeters: 14.2,
    },
    scaleBasis:
      'The Amsterdam Bureau of Monuments and Archaeology report reproduces Dik de Roon’s measured sections/elevation with a 10 m scale on page 126. Its proportions are combined with the 41 m finial height recorded by the monument researcher, original current photographs and concentric mapped octagonal parts. Legacy OSM part heights omit the upper finial and do not set the overall elevation.',
    geographicProposal: {
      anchor: [4.8932134, 52.3670565],
      heading: -0.982021760349,
      source: 'https://www.openstreetmap.org/way/57862728',
      evidence:
        'Center is refined from the concentric tower parts instead of the bounding box containing asymmetric projections. Both southeast and northwest projections are reproduced from their exact map polygons; the octagonal clock stages retain their mapped directed axes.',
      orientationConfidence: 'exact-part-centroids-and-asymmetric-projections',
      limitations:
        'The adjoining former guard house is a separately mapped building; it is not included or used to scale the tower. Small stone ornament and restored openings follow current photographs.',
    },
    limits: [
      'The measured municipal drawing establishes main proportions; individually weathered masonry, tiny clock lettering and lead seams are represented by original geometric detail and shared metric materials.',
      'Open visible carillon bells are modeled; hidden clockwork and occupied internal rooms are outside this exterior asset.',
    ],
    cameras: [
      { name: 'medieval-base', position: [11, 7, 13], lookAt: [0, 6, 0] },
      { name: 'renaissance-stage', position: [12, 19, 15], lookAt: [0, 18, 0] },
      { name: 'clock-carillon', position: [9, 28, 12], lookAt: [0, 25, 0] },
      { name: 'orb-weathercock', position: [10, 40, 13], lookAt: [0, 35, 0] },
      { name: 'far-silhouette', position: [47, 25, 60], lookAt: [0, 20, 0] },
    ],
  },
];

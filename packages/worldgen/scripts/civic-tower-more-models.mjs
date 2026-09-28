/** Researched exterior reconstructions. Dimensioned sources take precedence over tourist summaries. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  archBay,
  column,
  deform,
  facade,
  face,
  frame,
  tau,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

function buildBeyazit(out) {
  const stone = [0.73, 0.7, 0.61],
    trim = [0.83, 0.79, 0.69],
    shade = [0.2, 0.22, 0.19],
    metal = [0.33, 0.34, 0.3];
  // The published restoration survey gives a 12 m square tapered base, 8.95 m high.
  const sq = (y, r, c = 0.28) =>
    [
      [-r, y, -r + c],
      [-r + c, y, -r],
      [r - c, y, -r],
      [r, y, -r + c],
      [r, y, r - c],
      [r - c, y, r],
      [-r + c, y, r],
      [-r, y, r - c],
    ].reverse();
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const wall = deform(transform(out, a), ([x, y, z]) => [
      x * (1 - (y * 0.85) / 8.95 / 6),
      y,
      z - (y * 0.85) / 8.95,
    ]);
    facade(
      wall,
      'limestone',
      12,
      0,
      8.95,
      6,
      a === 0
        ? [{ x: 0, w: 0.97, y: 0, spring: 1.565, rise: 0.485, top: 2.3, depth: 0.55, trim: 0.14 }]
        : [],
      stone,
    );
  }
  // Round transom, blind relieving arch and the inscription panel on the opposite side.
  for (let i = 0; i < 40; i++) {
    const a = (i * tau) / 40,
      b = ((i + 1) * tau) / 40,
      p = (t, r) => [Math.sin(t) * r, 2.85 + Math.cos(t) * r, 5.76];
    triangle(out, 'shadow', [[0, 2.85, 5.758], p(b, 0.2), p(a, 0.2)], shade);
    beam(out, 'limestone', p(a, 0.255), p(b, 0.255), 0.1, 0.12, trim);
  }
  const back = transform(out, Math.PI);
  box(back, 'limestone', [-1.9, 3.2, 5.45], [1.9, 4.5, 5.71], trim);
  box(back, 'carvedstone', [-1.68, 3.4, 5.713], [1.68, 4.28, 5.73], [0.51, 0.53, 0.48]);
  for (let line = 0; line < 5; line++)
    for (let j = 0; j < 17; j++) {
      const x = -1.5 + j * 0.18,
        y = 3.54 + line * 0.13;
      beam(back, 'carvedstone', [x, y, 5.75], [x + 0.1, y + 0.035, 5.75], 0.013, 0.019, trim);
    }
  loft(
    out,
    'limestone',
    [sq(8.7, 5.2, 0.65), sq(8.95, 5.43, 0.65), sq(9.15, 5.43, 0.65), sq(9.35, 5.02, 0.65)],
    trim,
  );
  // Continuous twelve-fluted stone shaft with its two curved transitions.
  const profile = [
    [9.3, 4.05],
    [9.55, 4.15],
    [9.75, 4.65],
    [10.0, 4.97],
    [10.35, 5.02],
    [10.7, 4.82],
    [11.15, 4.48],
    [11.7, 4.2],
    [12.3, 4.05],
    [12.9, 4.02],
    [13.1, 4.19],
    [13.45, 4.19],
    [13.62, 4.02],
    [33.85, 4.02],
    [34.05, 4.2],
    [34.42, 4.2],
    [34.59, 4.02],
    [36.0, 4.02],
    [36.2, 4.2],
    [36.55, 4.2],
    [36.72, 4.02],
    [38.4, 4.05],
    [39.0, 4.19],
    [39.7, 4.6],
    [40.5, 5.1],
    [41.35, 5.48],
    [42.2, 5.64],
    [43.3, 5.7],
    [43.55, 5.94],
    [43.85, 5.94],
    [44.08, 5.72],
    [45.4, 5.72],
  ];
  const ring = (y, r) =>
    Array.from({ length: 192 }, (_, i) => {
      const a = (i * tau) / 192,
        rr = r + (y < 43.3 ? 0.13 * Math.max(0, Math.cos(a * 12)) ** 6 : 0);
      return [Math.sin(a) * rr, y, Math.cos(a) * rr];
    });
  loft(
    out,
    'beyazit_stone',
    profile.map(([y, r]) => ring(y, r)),
    stone,
  );
  for (let i = 0; i < 9; i++) {
    const y = 15.54 + i * 2.9,
      wall = transform(out, ((i % 4) * Math.PI) / 2);
    box(wall, 'shadow', [-0.11, y, 4.035], [0.11, y + 0.7, 4.055], shade);
    frame(wall, 'limestone', 0, y, 0.22, 0.7, 4.06, 0.045, trim);
  }
  // Actual arched watch-room windows: twelve apertures in the surveyed circular floor.
  const radius = 5.58;
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12,
      wall = transform(out, a),
      width = 2 * radius * Math.tan(Math.PI / 12);
    facade(
      wall,
      'limestone',
      width,
      45.4,
      50.15,
      radius,
      [{ x: 0, w: 1.24, y: 45.65, spring: 48.15, rise: 0.62, top: 49.0, depth: 0.37, trim: 0.14 }],
      stone,
    );
    for (const x of [-0.52, 0.52])
      beam(
        wall,
        'wood',
        [x, 45.5, radius - 0.15],
        [x, 48.19, radius - 0.15],
        0.07,
        0.08,
        [0.38, 0.29, 0.18],
      );
    for (const y of [46.15, 47.16, 48.1])
      beam(
        wall,
        'wood',
        [-0.59, y, radius - 0.15],
        [0.59, y, radius - 0.15],
        0.065,
        0.07,
        [0.38, 0.29, 0.18],
      );
    for (let k = 0; k < 18; k++) {
      const t = (k * Math.PI) / 18,
        u = ((k + 1) * Math.PI) / 18;
      beam(
        wall,
        'wood',
        [Math.cos(t) * 0.58, 48.1 + Math.sin(t) * 0.58, radius - 0.15],
        [Math.cos(u) * 0.58, 48.1 + Math.sin(u) * 0.58, radius - 0.15],
        0.065,
        0.07,
        [0.38, 0.29, 0.18],
      );
    }
    for (const x of [-width / 2 + 0.12, width / 2 - 0.12])
      box(
        wall,
        'limestone',
        [x - 0.09, 45.4, radius - 0.01],
        [x + 0.09, 49.85, radius + 0.14],
        trim,
      );
  }
  const disk = (y, r, h, color = trim) =>
    loft(out, 'beyazit_stone', [radialRing(y, r, r, 192), radialRing(y + h, r, r, 192)], color);
  for (const [y, r, h] of [
    [44.6, 5.9, 0.32],
    [49.8, 5.8, 0.2],
    [50.0, 6.0, 0.22],
    [50.22, 6.34, 0.23],
    [50.45, 6.43, 0.17],
  ])
    disk(y, r, h);
  for (let i = 0; i < 48; i++) {
    const a = (i * tau) / 48,
      wall = transform(out, a);
    box(wall, 'limestone', [-0.12, 49.45, 5.66], [0.12, 50.17, 6.17], trim);
  }
  // Octagonal signalling floors progressively decrease in diameter, with circular windows.
  loft(
    out,
    'limestone',
    [
      radialRing(50.55, 3.13, 3.13, 8, [0, 0], Math.PI / 8),
      radialRing(53.3, 3.13, 3.13, 8, [0, 0], Math.PI / 8),
    ],
    stone,
  );
  function balustrade(y, r, n) {
    const ap = r * Math.cos(Math.PI / 8),
      w = 2 * r * Math.sin(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const wall = transform(out, (k * Math.PI) / 4);
      for (let j = 0; j <= n; j++) {
        const x = -w / 2 + (j * w) / n;
        column(wall, 'limestone', x, ap, y, y + 0.84, 0.075, trim, 10);
      }
      box(
        wall,
        'limestone',
        [-w / 2 - 0.06, y + 0.82, ap - 0.12],
        [w / 2 + 0.06, y + 1.02, ap + 0.12],
        trim,
      );
    }
  }
  for (const [y0, y1, r] of [
    [53.3, 57.8, 3.08],
    [57.8, 62.2, 2.75],
    [62.2, 66.55, 2.42],
  ]) {
    const ap = r * Math.cos(Math.PI / 8),
      w = 2 * r * Math.sin(Math.PI / 8);
    loft(
      out,
      'limestone',
      [radialRing(y0, r, r, 8, [0, 0], Math.PI / 8), radialRing(y1, r, r, 8, [0, 0], Math.PI / 8)],
      stone,
    );
    for (let k = 0; k < 8; k++) {
      const wall = transform(out, (k * Math.PI) / 4);
      for (const x of [-w / 2 + 0.15, w / 2 - 0.15])
        box(
          wall,
          'limestone',
          [x - 0.08, y0 + 0.3, ap - 0.02],
          [x + 0.08, y1 - 0.15, ap + 0.09],
          trim,
        );
      if (k % 2 === 0) {
        const cy = y0 + 2.6;
        for (let j = 0; j < 48; j++) {
          const a = (j * tau) / 48,
            b = ((j + 1) * tau) / 48,
            p = (t, rr) => [Math.sin(t) * rr, cy + Math.cos(t) * rr, ap + 0.018];
          triangle(wall, 'shadow', [[0, cy, ap + 0.016], p(b, 0.42), p(a, 0.42)], shade);
          beam(wall, 'limestone', p(a, 0.49), p(b, 0.49), 0.12, 0.13, trim);
        }
        beam(wall, 'metal', [-0.41, cy, ap + 0.03], [0.41, cy, ap + 0.03], 0.04, 0.05, metal);
        beam(
          wall,
          'metal',
          [0, cy - 0.41, ap + 0.03],
          [0, cy + 0.41, ap + 0.03],
          0.04,
          0.05,
          metal,
        );
      }
    }
    loft(
      out,
      'limestone',
      [
        radialRing(y0, r + 0.34, r + 0.34, 8, [0, 0], Math.PI / 8),
        radialRing(y0 + 0.25, r + 0.34, r + 0.34, 8, [0, 0], Math.PI / 8),
      ],
      trim,
    );
    balustrade(y0 + 0.25, r + 0.22, 6);
  }
  loft(
    out,
    'limestone',
    [
      radialRing(66.55, 2.65, 2.65, 8, [0, 0], Math.PI / 8),
      radialRing(67, 2.65, 2.65, 8, [0, 0], Math.PI / 8),
    ],
    trim,
  );
  for (let i = 0; i < 16; i++) {
    const a = (i * tau) / 16;
    beam(
      out,
      'metal',
      [Math.sin(a) * 2.4, 67, Math.cos(a) * 2.4],
      [Math.sin(a) * 2.4, 68.0, Math.cos(a) * 2.4],
      0.025,
      0.03,
      metal,
    );
  }
  loft(out, 'metal', [radialRing(67, 0.19, 0.19, 32), radialRing(79, 0.1, 0.1, 32)], metal);
  for (const y of [68.2, 71.8, 75.2]) disk(y, 0.25, 0.08, metal);
  // Short modern aerials are visible in the university's current photograph.
  for (let i = 0; i < 6; i++) {
    const a = (i * tau) / 6;
    beam(
      out,
      'metal',
      [Math.sin(a) * 1.6, 66.95, Math.cos(a) * 1.6],
      [Math.sin(a) * 1.6, 69.0, Math.cos(a) * 1.6],
      0.04,
      0.05,
      metal,
    );
  }
}

function buildKrakow(out) {
  const brick = [0.57, 0.32, 0.21],
    stone = [0.72, 0.71, 0.63],
    light = [0.84, 0.82, 0.72],
    dark = [0.12, 0.14, 0.12],
    copper = [0.16, 0.22, 0.2],
    gold = [0.91, 0.72, 0.31];
  const hx = 6.42,
    hz = 5.48;
  const faces = [
    [0, hx, hz],
    [Math.PI, hx, hz],
    [Math.PI / 2, hz, hx],
    [-Math.PI / 2, hz, hx],
  ];
  // The plain north wall was once attached to the demolished town hall.
  for (const [a, half, z] of faces) {
    const wall = transform(out, a),
      north = a === 0;
    const holes = north
      ? [
          { x: 0, w: 1.3, y: 1.35, spring: 3.24, rise: 0.22, top: 3.65, trim: 0.18 },
          { x: 3.5, w: 1.15, y: 8.6, spring: 10.2, rise: 0.01, top: 10.3, trim: 0.12 },
          { x: -0.5, w: 1.1, y: 9.5, spring: 11.4, rise: 0.01, top: 11.5, trim: 0.13 },
          { x: 0, w: 1.13, y: 18.9, spring: 21.0, rise: 0.34, top: 21.5, trim: 0.13 },
          { x: 2.2, w: 1.1, y: 27.8, spring: 29.5, rise: 0.3, top: 30.0, trim: 0.14 },
          { x: 0, w: 1.34, y: 36.1, spring: 38.1, rise: 0.68, top: 39.1, trim: 0.2 },
        ]
      : [
          { x: -2.65, w: 1.05, y: 4.2, spring: 5.6, rise: 0.01, top: 5.7, trim: 0.12 },
          { x: 0, w: 2.14, y: 22.0, spring: 26.0, rise: 1.6, top: 28.0, pointed: true, trim: 0.26 },
          {
            x: 0,
            w: 2.36,
            y: 35.5,
            spring: 38.0,
            rise: 1.65,
            top: 40.1,
            pointed: true,
            trim: 0.33,
          },
        ];
    facade(wall, 'brick', half * 2, 0, 42.35, z, holes, brick);
    for (const h of holes) {
      frame(wall, 'limestone', h.x, h.y, h.w, h.spring - h.y, z + 0.015, 0.11, stone);
      if (h.y > 3)
        for (let x = h.x - h.w / 2 + 0.2; x < h.x + h.w / 2; x += 0.23)
          beam(wall, 'metal', [x, h.y + 0.04, z - 0.2], [x, h.spring, z - 0.2], 0.033, 0.04, dark);
    }
    // Alternating dressed corner quoins persist even on the north brick face.
    for (const s of [-1, 1])
      for (let k = 0; k < 47; k++) {
        const width = k % 2 ? 0.32 : 0.73;
        box(
          wall,
          'limestone',
          [s > 0 ? half - width : -half, k * 0.89, z - 0.01],
          [s > 0 ? half : -half + width, k * 0.89 + 0.34, z + 0.07],
          stone,
        );
      }
    if (north) {
      // Blocked openings, small stone balcony, and the north entrance's older relieving arches.
      box(wall, 'limestone', [-2.34, 9.0, z + 0.02], [-1.35, 10.2, z + 0.055], stone);
      frame(wall, 'limestone', -1.845, 9.0, 0.99, 1.2, z + 0.06, 0.12, light);
      box(wall, 'limestone', [-0.95, 18.6, z - 0.05], [0.95, 18.93, z + 0.92], stone);
      for (const x of [-0.7, 0, 0.7]) {
        beam(wall, 'limestone', [x, 17.4, z], [x, 18.64, z + 0.78], 0.26, 0.3, stone);
        beam(wall, 'metal', [x, 18.9, z + 0.79], [x, 19.75, z + 0.79], 0.035, 0.04, dark);
      }
      for (let x = -0.8; x < 0.85; x += 0.14)
        beam(wall, 'metal', [x, 18.95, z + 0.79], [x, 19.72, z + 0.79], 0.024, 0.025, dark);
      beam(wall, 'metal', [-0.89, 19.75, z + 0.79], [0.89, 19.75, z + 0.79], 0.045, 0.05, dark);
      for (const [xx, yy, r] of [
        [0, 4.1, 1.45],
        [3.5, 0.25, 1.55],
        [-3.5, 0.1, 1.35],
      ])
        for (let k = 0; k < 24; k++) {
          const t = (k * Math.PI) / 24,
            u = ((k + 1) * Math.PI) / 24;
          beam(
            wall,
            'brick',
            [xx + Math.cos(t) * r, yy + Math.sin(t) * r, z + 0.07],
            [xx + Math.cos(u) * r, yy + Math.sin(u) * r, z + 0.07],
            0.17,
            0.15,
            [0.65, 0.41, 0.28],
          );
        }
      for (let i = 0; i < 9; i++)
        box(
          wall,
          'limestone',
          [-1.36, 0, z + 0.06],
          [1.36, (i + 1) * 0.15, z + 3.15 - i * 0.31],
          stone,
        );
      for (const s of [-1, 1]) {
        box(
          wall,
          'limestone',
          [s * 1.78 - 0.45, 0, z + 0.1],
          [s * 1.78 + 0.45, 1.5, z + 3.5],
          stone,
        );
        box(
          wall,
          'limestone',
          [s * 1.78 - 0.52, 1.5, z + 0.05],
          [s * 1.78 + 0.52, 1.67, z + 3.58],
          light,
        );
        // Two reclining stone lions: shaped body, front paws, mane, eyes and mouth.
        sphere(wall, 'carvedstone', [s * 1.78, 1.97, z + 2.54], [0.36, 0.27, 0.62], stone, 24, 14);
        sphere(wall, 'carvedstone', [s * 1.78, 2.2, z + 2.94], [0.37, 0.4, 0.29], stone, 24, 16);
        sphere(wall, 'carvedstone', [s * 1.78, 2.23, z + 3.14], [0.23, 0.24, 0.17], light, 24, 16);
        for (const q of [-1, 1]) {
          sphere(
            wall,
            'carvedstone',
            [s * 1.78 + q * 0.22, 1.74, z + 3.04],
            [0.15, 0.11, 0.35],
            stone,
            20,
            12,
          );
          sphere(
            wall,
            'carvedstone',
            [s * 1.78 + q * 0.17, 2.51, z + 2.97],
            [0.105, 0.11, 0.075],
            stone,
            16,
            10,
          );
          sphere(
            wall,
            'carvedstone',
            [s * 1.78 + q * 0.091, 2.31, z + 3.279],
            [0.035, 0.023, 0.018],
            dark,
            12,
            8,
          );
        }
        sphere(wall, 'carvedstone', [s * 1.78, 2.2, z + 3.3], [0.062, 0.043, 0.043], dark, 16, 8);
        beam(
          wall,
          'carvedstone',
          [s * 1.78 - 0.09, 2.12, z + 3.27],
          [s * 1.78 + 0.09, 2.12, z + 3.27],
          0.025,
          0.03,
          dark,
        );
        for (let k = 0; k < 22; k++) {
          const t = (k * tau) / 22;
          beam(
            wall,
            'carvedstone',
            [s * 1.78 + Math.sin(t) * 0.25, 2.24 + Math.cos(t) * 0.31, z + 3.04],
            [s * 1.78 + Math.sin(t) * 0.35, 2.24 + Math.cos(t) * 0.39, z + 2.86],
            0.05,
            0.05,
            stone,
          );
        }
      }
      frame(wall, 'limestone', 0, 1.33, 1.45, 2.45, z + 0.07, 0.19, light);
      for (const x of [-0.7, 0.7])
        box(wall, 'limestone', [x - 0.18, 1.4, z + 0.04], [x + 0.18, 4.18, z + 0.25], stone);
      box(wall, 'limestone', [-1, 3.73, z + 0.02], [1, 4.15, z + 0.29], stone);
      for (const s of [-1, 1])
        beam(
          wall,
          'carvedstone',
          [s * 0.67, 3.84, z + 0.31],
          [0, 4.09, z + 0.31],
          0.09,
          0.08,
          light,
        );
      continue;
    }
    // Continuous lower dressed-stone fields frame the oriels; the upper blind panels retain brick.
    for (const s of [-1, 1]) {
      const side = transform(wall, 0, [(s * (half + 2.18)) / 2, 0, 0]);
      box(
        side,
        'limestone',
        [-(half - 2.18) / 2, 9.8, z + 0.012],
        [(half - 2.18) / 2, 20.15, z + 0.048],
        stone,
      );
      for (let band = 0; band < 9; band++) {
        const y = 20.15 + band * 0.74,
          inner = 2.2 - 0.145 * band;
        box(
          wall,
          'limestone',
          [s > 0 ? inner : -half + 0.18, y, z + 0.01],
          [s > 0 ? half - 0.18 : -inner, y + 0.58, z + 0.065],
          stone,
        );
      }
    }
    // Pointed ashlar surrounds are distinct from the surrounding red brick.
    for (const [w, y0, spring, rise] of [
      [2.14, 22, 26, 1.6],
      [2.36, 35.5, 38, 1.65],
    ]) {
      const r = w / 2,
        archY = (x) =>
          spring + (rise * Math.sqrt(Math.max(0, 4 - (Math.abs(x) / r + 1) ** 2))) / Math.sqrt(3);
      for (const s of [-1, 1])
        beam(
          wall,
          'limestone',
          [s * r, y0, z + 0.11],
          [s * r, spring, z + 0.11],
          0.32,
          0.29,
          light,
        );
      for (let k = 0; k < 40; k++) {
        const x = -r + (k * w) / 40,
          xx = -r + ((k + 1) * w) / 40;
        beam(
          wall,
          'limestone',
          [x, archY(x), z + 0.11],
          [xx, archY(xx), z + 0.11],
          0.34,
          0.3,
          light,
        );
      }
    }
    // Reconstructed Gothic oriels, including a real window recess and deep corbel underside.
    const oriel = transform(wall, 0, [0, 0, z + 0.62]);
    box(oriel, 'limestone', [-2.22, 9.2, -0.65], [2.22, 10.1, 0.5], stone);
    facade(
      oriel,
      'limestone',
      4.45,
      10.1,
      19.0,
      0.52,
      [{ x: 0, w: 2.13, y: 11.45, spring: 17.4, rise: 0.01, top: 17.42, trim: 0.13, depth: 0.4 }],
      stone,
    );
    for (const s of [-1, 1])
      box(
        oriel,
        'limestone',
        [s > 0 ? 2.04 : -2.22, 10, -0.67],
        [s > 0 ? 2.22 : -2.04, 19, 0.52],
        stone,
      );
    box(oriel, 'limestone', [-2.3, 18.9, -0.67], [2.3, 19.25, 0.62], light);
    for (const x of [-1.8, -0.9, 0, 0.9, 1.8]) {
      beam(oriel, 'limestone', [x, 8.3, -0.48], [x, 9.45, 0.36], 0.32, 0.46, stone);
      box(oriel, 'limestone', [x - 0.23, 9.36, -0.55], [x + 0.23, 9.63, 0.58], light);
    }
    for (const x of [-1.03, 0, 1.03])
      beam(oriel, 'limestone', [x, 11.4, 0.3], [x, 17.5, 0.3], 0.1, 0.11, light);
    for (const y of [11.5, 14.7, 17.4])
      beam(oriel, 'limestone', [-1.07, y, 0.3], [1.07, y, 0.3], 0.1, 0.11, light);
    for (let x = -0.9; x < 1; x += 0.22)
      beam(oriel, 'metal', [x, 11.55, 0.18], [x, 17.35, 0.18], 0.025, 0.03, dark);
    for (let y = 11.9; y < 17.4; y += 0.45)
      beam(oriel, 'metal', [-1.02, y, 0.18], [1.02, y, 0.18], 0.025, 0.025, dark);
    loft(
      wall,
      'copper',
      [
        [
          [-2.5, 19.2, z - 0.1],
          [2.5, 19.2, z - 0.1],
          [2.5, 19.2, z + 1.35],
          [-2.5, 19.2, z + 1.35],
        ].reverse(),
        [
          [-2.02, 20.4, z - 0.1],
          [2.02, 20.4, z - 0.1],
          [2.02, 20.4, z + 0.07],
          [-2.02, 20.4, z + 0.07],
        ].reverse(),
      ],
      copper,
    );
    // Stone blind tracery preserves the tall red-brick insets visible in the registry photos.
    for (const s of [-1, 1])
      for (let k = 0; k < 4; k++) {
        const x = s * (2.6 + k * 0.88),
          top = 34.6 - (k % 2) * 0.4;
        if (Math.abs(x) > half - 0.4) continue;
        box(wall, 'limestone', [x - 0.16, 9.7, z + 0.035], [x + 0.16, top, z + 0.19], stone);
        for (let j = 0; j < 22; j++)
          if (j < 12 || j % 4 === k % 4)
            box(
              wall,
              'limestone',
              [x - 0.38, 10.3 + j * 1.05, z + 0.02],
              [x + 0.38, 10.7 + j * 1.05, z + 0.1],
              light,
            );
        sphere(wall, 'carvedstone', [x, top + 0.05, z + 0.12], [0.22, 0.22, 0.12], stone, 12, 8);
      }
    for (const s of [-1, 1]) {
      beam(wall, 'limestone', [s * 2.35, 20.4, z + 0.2], [0, 31.5, z + 0.2], 0.25, 0.26, stone);
      for (let k = 0; k < 13; k++) {
        const t = (k + 0.25) / 13,
          x = s * 2.35 * (1 - t),
          y = 20.4 + 11.1 * t;
        sphere(wall, 'carvedstone', [x + s * 0.13, y, z + 0.25], [0.19, 0.15, 0.12], stone, 12, 8);
      }
    }
    sphere(wall, 'carvedstone', [0, 31.65, z + 0.23], [0.22, 0.3, 0.16], stone, 16, 10);
    for (let x = -half + 0.55; x < half - 0.4; x += 0.71) {
      if (Math.abs(x) < 2.4) continue;
      for (let k = 0; k < 24; k++) {
        const t = (k * tau) / 24,
          u = ((k + 1) * tau) / 24,
          p = (a) => [
            x + Math.sin(a) * (0.23 + 0.045 * Math.cos(a * 4)),
            19.9 + Math.cos(a) * (0.23 + 0.045 * Math.cos(a * 4)),
            z + 0.2,
          ];
        beam(wall, 'carvedstone', p(t), p(u), 0.065, 0.07, light);
      }
    }
    beam(wall, 'limestone', [0, 22, z - 0.12], [0, 26.8, z - 0.12], 0.11, 0.13, light);
    beam(wall, 'limestone', [-1.02, 25.9, z - 0.12], [1.02, 25.9, z - 0.12], 0.1, 0.12, light);
    box(wall, 'limestone', [-half + 0.2, 34.0, z + 0.01], [half - 0.2, 34.33, z + 0.13], light);
    // Blind Gothic upper frieze and the corbelled Baroque cornice.
    for (let x = -half + 0.55; x < half - 0.4; x += 0.7) {
      if (Math.abs(x) < 1.5) continue;
      beam(
        wall,
        'brick',
        [x, 35.1, z + 0.04],
        [x, 41.45, z + 0.04],
        0.15,
        0.16,
        [0.63, 0.36, 0.25],
      );
      for (let k = 0; k < 10; k++) {
        const t = (k * Math.PI) / 10,
          u = ((k + 1) * Math.PI) / 10;
        beam(
          wall,
          'brick',
          [x - 0.35 + 0.35 * Math.cos(t), 40.95 + 0.34 * Math.sin(t), z + 0.06],
          [x - 0.35 + 0.35 * Math.cos(u), 40.95 + 0.34 * Math.sin(u), z + 0.06],
          0.14,
          0.16,
          [0.63, 0.36, 0.25],
        );
      }
    }
    for (let x = -half + 0.35; x < half; x += 0.75)
      box(wall, 'limestone', [x - 0.15, 41.75, z - 0.04], [x + 0.15, 42.5, z + 0.37], stone);
  }
  for (const [y, x, z, h] of [
    [42.3, hx + 0.19, hz + 0.19, 0.27],
    [42.57, hx + 0.4, hz + 0.4, 0.27],
    [42.84, hx + 0.53, hz + 0.53, 0.2],
  ])
    box(out, 'limestone', [-x, y, -z], [x, y + h, z], light);
  // Four small canopied corner brackets mark the Gothic upper storey.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const corner = transform(out, Math.atan2(sx, sz), [sx * (hx - 0.05), 0, sz * (hz - 0.05)]);
      column(corner, 'limestone', 0, 0.2, 31.1, 33.7, 0.17, stone, 12);
      loft(
        corner,
        'limestone',
        [
          [33.7, 0.46],
          [34.0, 0.58],
          [35.4, 0.05],
        ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0.18])),
        stone,
      );
      sphere(corner, 'carvedstone', [0, 35.5, 0.18], [0.1, 0.15, 0.1], stone, 12, 8);
    }
  const chx = 5.41,
    chz = 4.6;
  box(out, 'brick', [-chx, 43.04, -chz], [chx, 51.05, chz], brick);
  for (const [a, half, z] of [
    [0, chx, chz],
    [Math.PI, chx, chz],
    [Math.PI / 2, chz, chx],
    [-Math.PI / 2, chz, chx],
  ]) {
    const wall = transform(out, a),
      cy = 47.7,
      r = 2.05,
      zz = z + 0.06,
      p = (rr, t) => [Math.sin(t) * rr, cy + Math.cos(t) * rr, zz];
    for (let j = 0; j < 96; j++) {
      triangle(
        wall,
        'carvedstone',
        [[0, cy, zz], p(r, ((j + 1) * tau) / 96), p(r, (j * tau) / 96)],
        [0.24, 0.36, 0.29],
      );
      beam(wall, 'metal', p(r, (j * tau) / 96), p(r, ((j + 1) * tau) / 96), 0.045, 0.06, gold);
    }
    const labels = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'],
      strokes = {
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
    for (let j = 0; j < 12; j++) {
      const t = (j * tau) / 12,
        label = labels[j],
        at = (u, v) => [
          Math.sin(t) * (1.5 + v * 0.31) + Math.cos(t) * u,
          cy + Math.cos(t) * (1.5 + v * 0.31) - Math.sin(t) * u,
          zz + 0.04,
        ];
      for (let k = 0; k < label.length; k++)
        for (const [x, y, xx, yy] of strokes[label[k]]) {
          const u = (k - (label.length - 1) / 2) * 0.13;
          beam(wall, 'metal', at(u + x * 0.1, y), at(u + xx * 0.1, yy), 0.039, 0.047, gold);
        }
    }
    sphere(wall, 'carvedstone', [0, cy, zz + 0.1], [0.25, 0.25, 0.07], gold, 24, 14);
    for (let i = 0; i < 16; i++) {
      const t = (i * tau) / 16;
      beam(wall, 'metal', p(0.27, t), p(i % 2 ? 0.42 : 0.51, t), 0.045, 0.05, gold);
    }
    beam(wall, 'metal', [0, cy, zz + 0.15], [1.31, cy + 0.88, zz + 0.15], 0.08, 0.07, gold);
    beam(wall, 'metal', [0, cy, zz + 0.18], [-0.32, cy + 0.85, zz + 0.18], 0.11, 0.07, gold);
    frame(wall, 'limestone', 0, 43.6, 0.68, 0.84, z + 0.025, 0.095, stone);
    box(wall, 'shadow', [-0.33, 43.6, z + 0.02], [0.33, 44.44, z + 0.04], dark);
  }
  box(out, 'limestone', [-chx - 0.27, 51.05, -chz - 0.27], [chx + 0.27, 51.34, chz + 0.27], stone);
  const oct = (y, r) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8);
  loft(
    out,
    'copper',
    [
      [51.34, 6.3],
      [51.65, 6.1],
      [52.35, 4.64],
      [53.0, 4.31],
    ].map(([y, r]) => oct(y, r)),
    copper,
  );
  function lantern(y0, y1, r) {
    const ap = r * Math.cos(Math.PI / 8),
      w = 2 * r * Math.sin(Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      const wall = transform(out, (i * Math.PI) / 4);
      facade(
        wall,
        'copper',
        w,
        y0,
        y1,
        ap,
        [
          {
            x: 0,
            w: w * 0.63,
            y: y0 + 0.4,
            spring: y1 - 0.93,
            rise: w * 0.315,
            top: y1 - 0.1,
            depth: 0.19,
            trim: 0.12,
          },
        ],
        copper,
      );
      for (const x of [-w / 2 + 0.13, w / 2 - 0.13])
        column(wall, 'copper', x, ap, y0 + 0.12, y1 - 0.03, 0.11, [0.23, 0.29, 0.26], 12);
      for (let y = y0 + 0.55; y < y1 - 0.75; y += 0.27)
        box(wall, 'copper', [-w * 0.32, y, ap - 0.08], [w * 0.32, y + 0.065, ap + 0.03], copper);
    }
    loft(out, 'copper', [oct(y1, r + 0.23), oct(y1 + 0.2, r + 0.23)], copper);
  }
  lantern(52.98, 57.62, 4.26);
  loft(
    out,
    'copper',
    [
      [57.8, 4.55],
      [58.1, 4.39],
      [58.6, 3.8],
      [59.2, 3.75],
      [59.65, 4.3],
      [60.15, 4.46],
      [60.65, 4.2],
      [61.25, 3.35],
      [61.75, 2.46],
      [62.0, 2.33],
      [62.2, 2.66],
    ].map(([y, r]) => oct(y, r)),
    copper,
  );
  lantern(62.17, 66.32, 2.3);
  loft(
    out,
    'copper',
    [
      [66.5, 2.58],
      [66.8, 2.31],
      [67.2, 1.7],
      [67.6, 1.68],
      [68.0, 2.12],
      [68.4, 2.16],
      [68.85, 1.73],
      [69.25, 1.04],
      [69.6, 0.46],
      [70.0, 0.34],
    ].map(([y, r]) => oct(y, r)),
    copper,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    for (const [y0, y1, r0, r1] of [
      [53, 57.6, 4.26, 4.26],
      [62.2, 66.3, 2.3, 2.3],
    ])
      beam(
        out,
        'metal',
        [Math.cos(a) * r0, y0, Math.sin(a) * r0],
        [Math.cos(a) * r1, y1, Math.sin(a) * r1],
        0.055,
        0.06,
        [0.29, 0.35, 0.3],
      );
  }
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * 5.25,
        z = sz * 4.45;
      loft(
        out,
        'limestone',
        [
          [51.35, 0.19],
          [51.65, 0.29],
          [52.05, 0.18],
          [52.4, 0.08],
        ].map(([y, r]) => radialRing(y, r, r, 16, [x, z])),
        stone,
      );
      sphere(out, 'copper', [x, 52.02, z], [0.27, 0.33, 0.27], [0.29, 0.43, 0.35], 16, 10);
    }
  loft(
    out,
    'metal',
    [
      [70, 0.24],
      [70.5, 0.18],
      [71.3, 0.12],
      [72.2, 0.07],
      [75, 0.018],
    ].map(([y, r]) => radialRing(y, r, r, 24)),
    gold,
  );
  for (const [y, r] of [
    [70.35, 0.3],
    [71.1, 0.22],
    [72.15, 0.24],
  ])
    sphere(out, 'metal', [0, y, 0], [r, r * 1.25, r], gold, 24, 14);
  // Crown and white eagle are original relief geometry, never copied photo textures.
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8;
    beam(
      out,
      'metal',
      [Math.sin(a) * 0.2, 72.25, Math.cos(a) * 0.2],
      [Math.sin(a) * 0.27, 72.6, Math.cos(a) * 0.27],
      0.038,
      0.05,
      gold,
    );
    sphere(
      out,
      'metal',
      [Math.sin(a) * 0.27, 72.6, Math.cos(a) * 0.27],
      [0.055, 0.055, 0.055],
      gold,
      12,
      8,
    );
  }
  const eagle = transform(out, 0, [0, 73.4, 0]);
  sphere(eagle, 'carvedstone', [0, 0.35, 0], [0.16, 0.25, 0.12], light, 20, 12);
  sphere(eagle, 'carvedstone', [0.09, 0.61, 0], [0.13, 0.13, 0.1], light, 20, 12);
  beam(eagle, 'metal', [0.18, 0.63, 0.01], [0.32, 0.6, 0.01], 0.05, 0.06, gold);
  for (const s of [-1, 1])
    for (let i = 0; i < 8; i++)
      beam(
        eagle,
        'carvedstone',
        [s * 0.12, 0.28 + i * 0.035, -0.02],
        [s * (0.34 + i * 0.055), 0.4 + i * 0.065, -0.035],
        0.07,
        0.065,
        light,
      );
}

export const civicTowersMore = [
  {
    id: 'n0587_beyaz_t_tower',
    planId: 'N0587',
    title: 'Beyazıt Tower',
    wikidata: 'Q853029',
    build: buildBeyazit,
    authoringFile: 'civic-tower-more-models.mjs',
    brief:
      'The surveyed Istanbul fire tower: tapered square limestone pedestal, twelve-fluted cylindrical shaft, double-curved capital, arched watch room, three octagonal signalling levels with round windows and stone balustrades, and slender flagpole.',
    size: [13, 79, 13],
    front: '+Z is the north-north-west entrance facade',
    origin: 'Center of the exact mapped tower at the surveyed ground datum Y=0',
    refs: [
      'https://doi.org/10.3390/buildings15050650',
      'https://mdpi-res.com/d_attachment/buildings/buildings-15-00650/article_deploy/buildings-15-00650.pdf',
      'https://iletim.istanbul.edu.tr/index.php/2025/09/09/turk-tarih-mirascisi-istanbul-universitesi/',
      'https://itfaiye.ibb.gov.tr/tr/yangin-kuleleri.html',
      'https://www.openstreetmap.org/way/639302102',
    ],
    facts: {
      masonryHeightMeters: 67,
      flagpoleHeightMeters: 12,
      overallModeledHeightMeters: 79,
      baseWidthMeters: 12,
      baseTopWidthMeters: 10.3,
      baseHeightMeters: 8.95,
      guardFloorDatum: 45.4,
      signFloorDatum: 55.5,
      guardRoomWindows: 12,
      upperOctagonalFloors: 3,
      entranceWidthMeters: 0.97,
      entranceHeightMeters: 2.05,
    },
    scaleBasis:
      'Şekerci, Damcı and Öztorun (Buildings 2025, 15, 650; CC BY 4.0) report the restoration survey dimensions and reproduce the measured elevation and compass plans. The 67 m masonry body and approximately 12 m flagpole are used directly. Their surveyed 12 windows take precedence over the 13-window secondary summaries. University photographs establish the current stonework and aerials.',
    geographicProposal: {
      anchor: [28.96489565, 41.012785761],
      heading: -2.994195268438,
      source: 'https://www.openstreetmap.org/way/639302102',
      evidence:
        'The exact-identity square-base axes are combined with the north entrance identified in the published survey. The native +Z portal faces north-north-west; the surveyed base, rather than the larger projecting circular cornice, controls plan scale.',
      orientationConfidence: 'exact-base-axis-and-surveyed-north-entrance',
      limitations:
        'The paper’s printed geographic coordinate differs from the exact mapped footprint; placement uses the map footprint center. The common 85 m tourist height is not reconciled with the published 67 m masonry plus 12 m pole survey and is not used to stretch the model.',
    },
    limits: [
      'Minor weathering, individual carved calligraphic strokes and changing weather-light colours are not transcribed; the inscription is a recessed relief panel with a nontextual line treatment.',
      'The measured 79 m overall envelope differs from the widely repeated 85 m tourist summary; that discrepancy is preserved explicitly rather than hidden by arbitrary scaling.',
    ],
    cameras: [
      { name: 'north-portal', position: [14, 7, 20], lookAt: [0, 5, 0] },
      { name: 'fluted-shaft', position: [16, 30, 23], lookAt: [0, 29, 0] },
      { name: 'watch-room', position: [19, 48, 24], lookAt: [0, 46, 0] },
      { name: 'signal-floors', position: [15, 64, 21], lookAt: [0, 59, 0] },
      { name: 'far-silhouette', position: [90, 49, 117], lookAt: [0, 39, 0] },
    ],
  },
  {
    id: 'n0590_town_hall_tower',
    planId: 'N0590',
    title: 'Town Hall Tower (Kraków)',
    wikidata: 'Q1786361',
    build: buildKrakow,
    authoringFile: 'civic-tower-more-models.mjs',
    brief:
      'Kraków’s surviving Gothic town-hall tower with three richly dressed facades, projecting stone oriels, blind tracery and crocketed window gables, a plain north wall and lion stairway, four green Roman clocks, dark copper Baroque helmet and gilded crown with White Eagle.',
    size: [15, 75, 15],
    front: '+Z is the plain north-north-east entrance facade',
    origin:
      'Center of the surviving tower at ground level Y=0; entrance stair projects to native +Z',
    refs: [
      'https://muzeumkrakowa.pl/oddzialy/wieza-ratuszowa',
      'https://muzeumkrakowa.pl/oddzialy/historia-6',
      'https://muzeumkrakowa.pl/plik-do-pobrania/811',
      'https://sklep.muzeumkrakowa.pl/produkt/wieza-ratuszowa-przewodnik',
      'https://zabytek.pl/pl/obiekty/krakow-wieza-ratuszowa',
      'https://www.openstreetmap.org/way/25122842',
    ],
    facts: {
      museumPublishedHeightMeters: 75,
      decoratedFacades: 3,
      plainFormerlyAttachedFacades: 1,
      orielWindows: 3,
      clockFaces: 4,
      baroqueHelmetDate: 1783,
      knownLeanCentimeters: 55,
    },
    scaleBasis:
      'The museum’s published 75 m height sets the vertical envelope. The exact-identity mapped tower controls plan and orientation. Registry exterior photographs and the museum leaflet elevation establish storey proportions, asymmetric stone cladding, three reconstructed oriels, clock tier and compound octagonal copper roof.',
    geographicProposal: {
      anchor: [19.936407342, 50.061475549],
      heading: 2.714243093257,
      source: 'https://www.openstreetmap.org/way/25122842',
      evidence:
        'The exact mapped principal wall axis is directed so the plain entrance and lion stairway face north-north-east, matching the registry description and site photographs. The base shaft is slightly inset from projecting stonework in the mapped outline.',
      orientationConfidence: 'exact-map-axis-and-primary-described-entrance',
      limitations:
        'The documented 55 cm lean has no defensible compass vector in the cited evidence and is not arbitrarily assigned. The source does not treat the demolished adjoining town hall as a present building.',
    },
    limits: [
      'Stone tracery, corbels and lions are original polygonal reconstructions from current published views; tiny tool marks, individual damage patches and inscriptions are not transcribed.',
      'The historical lean magnitude is documented, but its direction is unresolved and not guessed. Clock hands are fixed, and the tower interior and demolished adjoining town hall are outside the exterior asset.',
    ],
    cameras: [
      { name: 'north-lion-stair', position: [14, 8, 23], lookAt: [0, 7, 1] },
      { name: 'gothic-oriel', position: [-21, 23, -25], lookAt: [0, 21, 0] },
      { name: 'clock-and-frieze', position: [21, 46, -25], lookAt: [0, 42, 0] },
      { name: 'copper-helmet', position: [17, 68, 24], lookAt: [0, 62, 0] },
      { name: 'far-silhouette', position: [88, 49, 116], lookAt: [0, 37.5, 0] },
    ],
  },
];

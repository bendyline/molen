/** Original researched civic tower exteriors. All dimensions are metres. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
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

function buildMichael(out) {
  const plaster = [0.91, 0.86, 0.77],
    white = [0.96, 0.92, 0.85],
    stone = [0.7, 0.65, 0.54],
    copper = [0.22, 0.54, 0.47],
    gold = [0.93, 0.7, 0.2],
    iron = [0.16, 0.18, 0.17],
    wood = [0.24, 0.19, 0.15];
  const halfX = 4.39,
    halfZ = 4.42;
  for (const [a, w, z] of [
    [0, 2 * halfX, halfZ],
    [Math.PI, 2 * halfX, halfZ],
    [Math.PI / 2, 2 * halfZ, halfX],
    [-Math.PI / 2, 2 * halfZ, halfX],
  ]) {
    const wall = transform(out, a),
      gate = a === 0 || a === Math.PI;
    const windows = [7.7, 12.4, 17.1, 21.7, 25.5].map((y) => ({
      x: 0,
      w: y > 25 ? 1.0 : 1.27,
      y,
      spring: y + 1.35,
      rise: 0.01,
      top: y + 1.38,
      depth: 0.25,
      trim: 0.09,
    }));
    if (gate)
      windows.push({
        x: 0,
        w: 3.72,
        y: 0,
        spring: 3.12,
        rise: 1.35,
        top: 5.2,
        depth: 8.84,
        back: false,
        trim: 0.21,
      });
    facade(wall, 'plaster', w, 0, 28.35, z, windows, plaster);
    for (const y of [7.7, 12.4, 17.1, 21.7, 25.5]) {
      const ww = y > 25 ? 1.0 : 1.27;
      box(wall, 'wood', [-ww / 2, y, z - 0.27], [ww / 2, y + 1.35, z - 0.245], wood);
      for (const x of [-ww / 2, 0, ww / 2])
        beam(wall, 'wood', [x, y, z - 0.16], [x, y + 1.35, z - 0.16], 0.08, 0.09, wood);
      for (const yy of [y, y + 0.55, y + 1.35])
        beam(wall, 'wood', [-ww / 2, yy, z - 0.16], [ww / 2, yy, z - 0.16], 0.08, 0.09, wood);
      box(
        wall,
        'plaster',
        [-ww / 2 - 0.16, y - 0.12, z - 0.02],
        [ww / 2 + 0.16, y + 0.025, z + 0.14],
        white,
      );
    }
    for (const s of [-1, 1])
      for (let y = 0.4; y < 27.3; y += 0.75) {
        const ww = Math.round(y / 0.75) % 2 ? 0.57 : 0.93;
        box(
          wall,
          'plaster',
          [s > 0 ? w / 2 - ww : -w / 2, y, z - 0.02],
          [s > 0 ? w / 2 : -w / 2 + ww, y + 0.11, z + 0.042],
          white,
        );
      }
    if (gate) {
      for (let i = 0; i < 14; i++) {
        const a = (i * Math.PI) / 14,
          b = ((i + 1) * Math.PI) / 14,
          p = (t) => [Math.cos(t) * 2.05, 3.12 + Math.sin(t) * 1.57, z + 0.08];
        beam(wall, 'limestone', p(a), p(b), 0.21, 0.18, stone);
      }
      for (const s of [-1, 1])
        box(
          wall,
          'limestone',
          [s * 1.96 - 0.13, 0, z - 0.02],
          [s * 1.96 + 0.13, 3.18, z + 0.13],
          stone,
        );
    }
  }
  // Open passage ground; adjacent narrow houses are separate map footprints.
  box(out, 'limestone', [-1.85, 0, -4.42], [1.85, 0.035, 4.42], stone);
  box(out, 'plaster', [-4.55, 28.15, -4.57], [4.55, 28.55, 4.57], white);
  // Slightly chamfered clock stage and the wraparound public viewing gallery.
  const chamfer = (y, r, c) =>
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
  loft(out, 'plaster', [chamfer(28.5, 3.21, 0.7), chamfer(35.15, 3.21, 0.7)], plaster);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const wall = transform(out, a);
    for (let j = 0; j <= 20; j++) {
      const x = -4.4 + j * 0.44;
      beam(wall, 'metal', [x, 28.55, 4.43], [x, 29.53, 4.43], 0.027, 0.032, iron);
      if (j < 20)
        for (let k = 0; k < 10; k++) {
          const t = (k * Math.PI) / 10,
            u = ((k + 1) * Math.PI) / 10;
          beam(
            wall,
            'metal',
            [x + 0.22 - 0.22 * Math.cos(t), 29.45 + 0.27 * Math.sin(t), 4.43],
            [x + 0.22 - 0.22 * Math.cos(u), 29.45 + 0.27 * Math.sin(u), 4.43],
            0.025,
            0.028,
            iron,
          );
        }
    }
    for (const y of [28.67, 29.49])
      beam(wall, 'metal', [-4.43, y, 4.43], [4.43, y, 4.43], 0.035, 0.038, iron);
    // Small balcony door below each photographed Roman clock dial.
    box(wall, 'wood', [-0.38, 28.5, 3.2], [0.38, 30.13, 3.24], wood);
    frame(wall, 'plaster', 0, 28.5, 0.83, 1.64, 3.24, 0.09, white);
    const cy = 33.47,
      r = 1.1,
      z = 3.26,
      p = (rr, t) => [Math.sin(t) * rr, cy + Math.cos(t) * rr, z];
    for (let j = 0; j < 72; j++) {
      triangle(
        wall,
        'carvedstone',
        [[0, cy, z], p(r, ((j + 1) * tau) / 72), p(r, (j * tau) / 72)],
        white,
      );
      beam(wall, 'metal', p(r, (j * tau) / 72), p(r, ((j + 1) * tau) / 72), 0.028, 0.032, iron);
    }
    const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'],
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
        label = numerals[j],
        at = (u, v) => [
          Math.sin(t) * (0.77 + v * 0.18) + Math.cos(t) * u,
          cy + Math.cos(t) * (0.77 + v * 0.18) - Math.sin(t) * u,
          z + 0.028,
        ];
      for (let k = 0; k < label.length; k++)
        for (const [x, y, xx, yy] of strokes[label[k]]) {
          const c = (k - (label.length - 1) / 2) * 0.072;
          beam(wall, 'metal', at(c + x * 0.053, y), at(c + xx * 0.053, yy), 0.024, 0.028, iron);
        }
    }
    beam(wall, 'metal', [0, cy, z + 0.07], [0.68, cy - 0.57, z + 0.07], 0.045, 0.045, iron);
    beam(wall, 'metal', [0, cy, z + 0.1], [-0.3, cy + 0.49, z + 0.1], 0.065, 0.05, iron);
    sphere(wall, 'metal', [0, cy, z + 0.1], [0.1, 0.1, 0.06], iron, 16, 8);
    // Curved Baroque cornice rises over the clock instead of a plain rectangular lid.
    for (let i = 0; i < 36; i++) {
      const x = -3.42 + (i * 6.84) / 36,
        xx = -3.42 + ((i + 1) * 6.84) / 36;
      const y = (v) => 35.15 + 0.36 * Math.exp((-v * v) / 1.7);
      face(
        wall,
        'plaster',
        [
          [x, 34.92, 3.23],
          [xx, 34.92, 3.23],
          [xx, y(xx), 3.23],
          [x, y(x), 3.23],
        ],
        plaster,
      );
      for (const dy of [0, 0.18])
        beam(wall, 'plaster', [x, y(x) + dy, 3.33], [xx, y(xx) + dy, 3.33], 0.15, 0.17, white);
    }
  }
  // Continuous octagonal copper bulb profiles copied as measured proportions, not texture pictures.
  const ring = (y, r) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8);
  const roofProfile = [
    [35.45, 4.1],
    [35.75, 3.85],
    [36.3, 3.32],
    [37.0, 2.85],
    [37.65, 2.76],
    [38.05, 3.15],
    [38.6, 4.05],
    [39.15, 4.38],
    [39.72, 4.35],
    [40.25, 3.84],
    [40.7, 2.81],
    [41.18, 1.82],
    [41.42, 1.76],
    [41.62, 2.25],
    [41.86, 2.24],
  ];
  loft(
    out,
    'copper',
    roofProfile.map(([y, r]) => ring(y, r)),
    copper,
  );
  const upperProfile = [
    [45.02, 2.05],
    [45.2, 2.17],
    [45.48, 1.75],
    [45.92, 1.34],
    [46.23, 1.36],
    [46.55, 1.94],
    [46.92, 2.08],
    [47.22, 1.82],
    [47.6, 1.18],
    [47.9, 0.62],
    [49.02, 0.08],
  ];
  loft(
    out,
    'copper',
    upperProfile.map(([y, r]) => ring(y, r)),
    copper,
  );
  for (let i = 0; i < 8; i++) {
    const a = (i * tau) / 8,
      wall = transform(out, a),
      z = 1.72,
      w = 2 * z * Math.tan(Math.PI / 8);
    archBay(wall, 'copper', 0, w - 0.3, 41.84, 44.06, 0.43, 44.83, z, 0.21, copper, {
      back: false,
      trim: 0.14,
    });
    for (const x of [-w / 2 + 0.1, w / 2 - 0.1])
      column(wall, 'copper', x, z, 41.85, 44.74, 0.12, copper, 12);
    for (let x = -w / 2 + 0.2; x < w / 2; x += 0.2)
      beam(wall, 'metal', [x, 41.95, z - 0.07], [x, 44.04, z - 0.07], 0.022, 0.022, iron);
    for (const y of [41.87, 44.71, 44.94])
      box(wall, 'copper', [-w / 2 - 0.1, y, z - 0.08], [w / 2 + 0.1, y + 0.13, z + 0.17], copper);
    // Gilt scalloped edge and small rosettes retained after the 2023 conservation.
    for (let k = 0; k < 10; k++) {
      const t = (k * Math.PI) / 10,
        u = ((k + 1) * Math.PI) / 10;
      beam(
        wall,
        'metal',
        [Math.cos(t) * 0.56, 44.0 + Math.sin(t) * 0.5, z + 0.12],
        [Math.cos(u) * 0.56, 44.0 + Math.sin(u) * 0.5, z + 0.12],
        0.032,
        0.035,
        gold,
      );
    }
    for (const yy of [36.82, 45.93])
      sphere(wall, 'metal', [0, yy, yy < 40 ? 2.9 : 1.43], [0.1, 0.1, 0.027], gold, 12, 6);
  }
  // Two visible suspended bells in the open upper lantern.
  for (const x of [-0.42, 0.47])
    loft(
      out,
      'metal',
      [
        [42.3, 0.52],
        [42.43, 0.63],
        [42.75, 0.42],
        [43.26, 0.23],
      ].map(([y, r]) => radialRing(y, r, r, 32, [x, 0])),
      [0.43, 0.3, 0.16],
    );
  // Original gilded Michael group: armoured angel, feathered wings, shield, sword and defeated dragon.
  const figure = transform(out, 0, [0, 49.02, 0]),
    goldOut = {
      addQuad: (_s, r, p, n, u, c) => figure.addQuad('carvedstone', r, p, n, u, c),
      addTriangle: (_s, r, p, n, u, c) => figure.addTriangle('carvedstone', r, p, n, u, c),
      addConvexPolygon: (_s, r, p, n, u, c) =>
        figure.addConvexPolygon('carvedstone', r, p, n, u, c),
    };
  sphere(goldOut, 'metal', [0, 0.16, 0], [0.38, 0.18, 0.32], gold, 20, 12);
  for (const s of [-1, 1]) {
    beam(goldOut, 'metal', [s * 0.18, 0.25, 0], [s * 0.13, 0.86, 0.03], 0.15, 0.16, gold);
    sphere(goldOut, 'metal', [s * 0.2, 0.22, 0.13], [0.14, 0.08, 0.25], gold, 16, 8);
  }
  sphere(goldOut, 'metal', [0, 1.03, 0], [0.32, 0.4, 0.2], gold, 24, 14);
  sphere(goldOut, 'metal', [0, 1.58, 0.03], [0.18, 0.23, 0.15], gold, 24, 14);
  loft(
    goldOut,
    'metal',
    [
      [1.66, 0.23],
      [1.83, 0.18],
      [1.91, 0.035],
    ].map(([y, r]) => radialRing(y, r, r, 20)),
    gold,
  );
  for (const s of [-1, 1])
    for (let i = 0; i < 8; i++) {
      const y = 1.03 + i * 0.065;
      beam(
        goldOut,
        'metal',
        [s * 0.22, y, -0.1],
        [s * (0.54 + i * 0.039), 1.48 + i * 0.057, -0.19],
        0.075,
        0.07,
        gold,
      );
    }
  beam(goldOut, 'metal', [-0.28, 1.25, 0], [-0.62, 1.57, 0.05], 0.14, 0.15, gold);
  beam(goldOut, 'metal', [-0.62, 1.57, 0.05], [-0.76, 1.27, 0.09], 0.11, 0.12, gold);
  beam(goldOut, 'metal', [-0.76, 1.2, 0.09], [-0.34, 1.96, 0.09], 0.037, 0.05, gold);
  sphere(goldOut, 'metal', [0.3, 1.07, 0.3], [0.25, 0.34, 0.07], gold, 24, 14);
  sphere(goldOut, 'metal', [0.3, 1.07, 0.37], [0.09, 0.1, 0.08], gold, 16, 10);
  sphere(goldOut, 'metal', [0.1, 0.14, 0.23], [0.43, 0.12, 0.2], gold, 20, 10);
  beam(goldOut, 'metal', [0.38, 0.14, 0.14], [0.6, 0.3, 0.2], 0.1, 0.1, gold);
  // Conservation photographs show articulated armour and a plumed helmet, not an unadorned figurine.
  for (const s of [-1, 1]) {
    sphere(goldOut, 'metal', [s * 0.29, 1.24, 0.02], [0.17, 0.18, 0.2], gold, 24, 14);
    sphere(goldOut, 'metal', [s * 0.155, 0.58, 0.035], [0.115, 0.13, 0.115], gold, 20, 12);
    loft(
      goldOut,
      'metal',
      [
        [0.27, 0.13],
        [0.42, 0.105],
        [0.54, 0.095],
      ].map(([y, r]) => radialRing(y, r, r, 16, [s * 0.18, 0.02])),
      gold,
    );
    for (let i = 0; i < 4; i++)
      beam(
        goldOut,
        'metal',
        [s * 0.29 - 0.11, 1.18 + i * 0.035, 0.19],
        [s * 0.29 + 0.11, 1.18 + i * 0.035, 0.19],
        0.026,
        0.025,
        gold,
      );
    sphere(
      goldOut,
      'metal',
      [s * 0.065, 1.635, 0.168],
      [0.037, 0.022, 0.023],
      [0.59, 0.4, 0.1],
      16,
      8,
    );
    beam(goldOut, 'metal', [s * 0.018, 1.545, 0.197], [s * 0.069, 1.543, 0.168], 0.025, 0.03, gold);
  }
  sphere(goldOut, 'metal', [0, 1.588, 0.19], [0.04, 0.07, 0.07], gold, 20, 12);
  sphere(goldOut, 'metal', [0, 1.497, 0.124], [0.09, 0.047, 0.07], gold, 20, 12);
  loft(
    goldOut,
    'metal',
    [
      [1.703, 0.247],
      [1.728, 0.263],
      [1.759, 0.198],
    ].map(([y, r]) => radialRing(y, r, r, 40)),
    gold,
  );
  for (let i = 0; i < 7; i++) {
    const yy = 1.78 + i * 0.025;
    beam(
      goldOut,
      'metal',
      [-0.035, yy, -0.015],
      [-0.12 - i * 0.008, yy + 0.13, -0.04],
      0.035,
      0.022,
      gold,
    );
    beam(
      goldOut,
      'metal',
      [0.035, yy, -0.015],
      [0.12 + i * 0.008, yy + 0.13, -0.04],
      0.035,
      0.022,
      gold,
    );
  }
  beam(goldOut, 'metal', [0.3, 1.18, 0.03], [0.48, 0.99, 0.19], 0.14, 0.15, gold);
  beam(goldOut, 'metal', [0.48, 0.99, 0.19], [0.29, 1.02, 0.28], 0.12, 0.13, gold);
  for (let i = 0; i < 20; i++) {
    const a = (i * tau) / 20;
    sphere(
      goldOut,
      'metal',
      [0.3 + Math.sin(a) * 0.215, 1.07 + Math.cos(a) * 0.3, 0.347],
      [0.018, 0.018, 0.015],
      gold,
      8,
      6,
    );
    if (i % 2 === 0)
      beam(
        goldOut,
        'metal',
        [0.3 + Math.sin(a) * 0.085, 1.07 + Math.cos(a) * 0.1, 0.405],
        [0.3 + Math.sin(a) * 0.19, 1.07 + Math.cos(a) * 0.265, 0.358],
        0.033,
        0.028,
        gold,
      );
  }
  beam(goldOut, 'metal', [-0.82, 1.28, 0.09], [-0.62, 1.17, 0.09], 0.035, 0.04, gold);
  sphere(goldOut, 'metal', [0.5, 0.25, 0.21], [0.16, 0.1, 0.095], gold, 20, 12);
  for (const s of [-1, 1])
    sphere(
      goldOut,
      'metal',
      [0.55, 0.28, 0.21 + s * 0.065],
      [0.018, 0.018, 0.015],
      [0.38, 0.27, 0.07],
      12,
      6,
    );
}

function buildVelasca(out) {
  const render = [0.75, 0.56, 0.42],
    edge = [0.79, 0.64, 0.5],
    panel = [0.57, 0.43, 0.34],
    glass = [0.27, 0.4, 0.45],
    aluminum = [0.62, 0.65, 0.61],
    roof = [0.27, 0.41, 0.35];
  const halfX = 18.96,
    halfZ = 10.27,
    upperX = 22.3,
    upperZ = 13.28;
  box(out, 'concrete', [-halfX, 0, -halfZ], [halfX, 60.15, halfZ], render);
  // Each inset window carries a modeled reveal, sill, aluminium frame and sash rail.
  function window(wall, x, y, z, w = 1.5, h = 2.24, loggia = false) {
    const inset = loggia ? 0.82 : 0.12,
      back = loggia ? z - inset : z + 0.06;
    if (!loggia)
      box(
        wall,
        'concrete',
        [x - w / 2 - 0.09, y - 0.1, z],
        [x + w / 2 + 0.09, y + h + 0.1, z + 0.055],
        edge,
      );
    face(
      wall,
      'glass',
      [
        [x - w / 2, y, back],
        [x + w / 2, y, back],
        [x + w / 2, y + h, back],
        [x - w / 2, y + h, back],
      ],
      glass,
    );
    if (loggia) {
      // Real apertures are cut out of the upper wall; glazing sits behind the external plane.
      box(
        wall,
        'concrete',
        [x - w / 2 - 0.16, y - 0.15, back],
        [x - w / 2, y + h + 0.1, z + 0.03],
        render,
      );
      box(
        wall,
        'concrete',
        [x + w / 2, y - 0.15, back],
        [x + w / 2 + 0.16, y + h + 0.1, z + 0.03],
        render,
      );
      box(wall, 'concrete', [x - w / 2, y + h, back], [x + w / 2, y + h + 0.13, z + 0.03], render);
      box(wall, 'concrete', [x - w / 2, y - 0.1, back], [x + w / 2, y + 0.02, z + 0.03], edge);
      for (let xx = x - w / 2; xx <= x + w / 2 + 0.01; xx += 0.28)
        beam(
          wall,
          'metal',
          [xx, y + 0.04, z + 0.025],
          [xx, y + 0.88, z + 0.025],
          0.027,
          0.035,
          [0.25, 0.28, 0.26],
        );
      beam(
        wall,
        'metal',
        [x - w / 2, y + 0.88, z + 0.025],
        [x + w / 2, y + 0.88, z + 0.025],
        0.045,
        0.05,
        aluminum,
      );
    } else {
      for (const xx of [x - w / 2, x + w / 2])
        beam(wall, 'metal', [xx, y, z + 0.1], [xx, y + h, z + 0.1], 0.055, 0.07, aluminum);
      for (const yy of [y, y + h * 0.49, y + h])
        beam(
          wall,
          'metal',
          [x - w / 2, yy, z + 0.1],
          [x + w / 2, yy, z + 0.1],
          0.055,
          0.06,
          aluminum,
        );
    }
  }
  const sides = [
    [0, halfX, halfZ, 15],
    [Math.PI, halfX, halfZ, 15],
    [Math.PI / 2, halfZ, halfX, 8],
    [-Math.PI / 2, halfZ, halfX, 8],
  ];
  for (const [a, half, z, count] of sides) {
    const wall = transform(out, a),
      pitch = (half * 2) / count;
    for (let floor = 0; floor < 16; floor++) {
      const y = 6.0 + floor * 3.23;
      for (let j = 0; j < count; j++) {
        const x = -half + (j + 0.5) * pitch;
        window(wall, x, y, z + 0.015, Math.min(1.52, pitch * 0.64));
        box(
          wall,
          'concrete',
          [x + 0.85, y - 0.1, z + 0.04],
          [x + pitch * 0.43, y + 2.4, z + 0.08],
          panel,
        );
      }
    }
    for (let j = 0; j <= count; j++)
      box(
        wall,
        'concrete',
        [-half + j * pitch - 0.085, 5.65, z + 0.01],
        [-half + j * pitch + 0.085, 60.15, z + 0.24],
        edge,
      );
    // Glazed commercial entrance level and separate concrete lintel.
    for (let j = 0; j < count; j++)
      window(wall, -half + (j + 0.5) * pitch, 0.35, z + 0.025, pitch - 0.26, 4.55);
    box(wall, 'concrete', [-half - 0.1, 5.1, z - 0.04], [half + 0.1, 5.65, z + 0.26], edge);
  }
  // Twenty structural ribs follow the published 18th-storey plan, including paired rotated corner ribs.
  const supports = [];
  for (const s of [-1, 1])
    for (const x of [-18.96, -11.85, -3.95, 3.95, 11.85, 18.96])
      supports.push({
        p: [x, halfZ * s],
        q: [Math.abs(x) > 18 ? Math.sign(x) * 22.6 : x, 13.75 * s],
      });
  for (const s of [-1, 1])
    for (const z of [-9.76, -3.16, 3.16, 9.76])
      supports.push({
        p: [halfX * s, z],
        q: [22.75 * s, Math.abs(z) > 9 ? Math.sign(z) * 13.0 : z],
      });
  for (const { p, q } of supports) {
    beam(out, 'concrete', [p[0], 0, p[1]], [p[0], 48.3, p[1]], 0.65, 0.9, edge);
    beam(out, 'concrete', [p[0], 48.3, p[1]], [q[0], 60.15, q[1]], 0.72, 0.95, edge);
    beam(out, 'concrete', [q[0], 60.15, q[1]], [q[0], 90.7, q[1]], 0.64, 0.88, edge);
    beam(out, 'concrete', [p[0], 60.15, p[1]], [q[0], 60.15, q[1]], 0.44, 0.52, edge);
  }
  // Open service-floor belt: the main shaft remains visibly recessed behind the projecting upper block.
  box(out, 'concrete', [-halfX, 60.15, -halfZ], [halfX, 63.65, halfZ], panel);
  box(out, 'concrete', [-upperX, 63.65, -upperZ], [upperX, 63.8, upperZ], render);
  box(out, 'concrete', [-upperX, 90.18, -upperZ], [upperX, 90.35, upperZ], render);
  for (const [a, h, z, count] of [
    [0, upperX, upperZ, 19],
    [Math.PI, upperX, upperZ, 19],
    [Math.PI / 2, upperZ, upperX, 11],
    [-Math.PI / 2, upperZ, upperX, 11],
  ]) {
    const wall = transform(out, a),
      pitch = (h * 2) / count;
    const holes = [];
    // The archived elevations show staggered individual windows and deep apartment loggias.
    for (let floor = 0; floor < 6; floor++)
      for (let j = 0; j < count; j++) {
        const y = 64.65 + floor * 3.9,
          x = -h + (j + 0.5) * pitch;
        const loggia =
          (j + 2 * floor + (a === Math.PI ? 3 : 0)) % 7 === 3 || (j + floor) % 11 === 1;
        if (loggia) holes.push({ x, y, w: pitch - 0.25, h: 2.55 });
        window(wall, x, y, z + 0.012, loggia ? pitch - 0.25 : 1.48, 2.55, loggia);
        if (!loggia)
          box(
            wall,
            'concrete',
            [x + 0.85, y, z + 0.02],
            [x + pitch * 0.46, y + 2.57, z + 0.06],
            panel,
          );
      }
    const xs = [...new Set([-h, h, ...holes.flatMap((q) => [q.x - q.w / 2, q.x + q.w / 2])])].sort(
      (x, y) => x - y,
    );
    const ys = [...new Set([63.65, 90.35, ...holes.flatMap((q) => [q.y, q.y + q.h])])].sort(
      (x, y) => x - y,
    );
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < ys.length - 1; j++) {
        const x = (xs[i] + xs[i + 1]) / 2,
          y = (ys[j] + ys[j + 1]) / 2;
        if (holes.some((q) => x > q.x - q.w / 2 && x < q.x + q.w / 2 && y > q.y && y < q.y + q.h))
          continue;
        face(
          wall,
          'concrete',
          [
            [xs[i], ys[j], z],
            [xs[i + 1], ys[j], z],
            [xs[i + 1], ys[j + 1], z],
            [xs[i], ys[j + 1], z],
          ],
          render,
        );
      }
    for (let j = 0; j <= count; j++)
      box(
        wall,
        'concrete',
        [-h + j * pitch - 0.07, 63.65, z + 0.02],
        [-h + j * pitch + 0.07, 90.5, z + 0.24],
        edge,
      );
    // 18th-floor exterior tie rail and 25th-floor open terrace balustrade.
    for (const [y, zoff] of [
      [60.45, -3.05],
      [90.5, 0.05],
    ]) {
      for (let x = -h; x <= h; x += 0.48)
        beam(
          wall,
          'metal',
          [x, y, z + zoff],
          [x, y + 1.1, z + zoff],
          0.035,
          0.045,
          [0.24, 0.27, 0.24],
        );
      beam(wall, 'metal', [-h, y + 1.1, z + zoff], [h, y + 1.1, z + zoff], 0.055, 0.06, aluminum);
    }
    box(wall, 'concrete', [-h - 0.22, 90.12, z - 0.25], [h + 0.22, 90.45, z + 0.4], edge);
  }
  // Recessed duplex penthouse, broad stepped copper hips and four tall terminal chimneys.
  const ring = (y, x, z) => [
    [-x, y, -z],
    [-x, y, z],
    [x, y, z],
    [x, y, -z],
  ];
  box(out, 'concrete', [-18.2, 90.35, -9.7], [18.2, 96.2, 9.7], render);
  loft(
    out,
    'copper',
    [ring(91.2, 21.6, 12.6), ring(96.0, 17.2, 8.25), ring(99.1, 15.4, 6.7)],
    roof,
  );
  for (const a of [0, Math.PI]) {
    const wall = transform(out, a);
    for (let j = 0; j < 18; j++) window(wall, -16.6 + j * 1.95, 93.0, 11.18, 1.57, 1.08);
    box(wall, 'metal', [-17.7, 94.12, 10.76], [17.7, 94.33, 11.53], roof);
  }
  box(out, 'concrete', [-12.4, 96.3, -4.0], [12.4, 102.7, 4.0], panel);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const x = sx * 16.0,
        z = sz * 6.7;
      box(out, 'concrete', [x - 0.8, 96.0, z - 1.15], [x + 0.8, 105.68, z + 1.15], edge);
      box(out, 'metal', [x - 0.98, 105.68, z - 1.3], [x + 0.98, 106, z + 1.3], roof);
    }
  for (let x = -11.7; x < 12; x += 1.1)
    for (const s of [-1, 1])
      box(
        out,
        'concrete',
        [x, 102.4, s > 0 ? 2.9 : -4.3],
        [x + 0.55, 103.4, s > 0 ? 4.3 : -2.9],
        edge,
      );
  // Original low entrance pavilion, aligned to the north-west long face in the mapped site.
  box(out, 'concrete', [-14.4, 0, -20.0], [15.1, 6.1, -10.25], render);
  const front = transform(out, Math.PI);
  for (let j = 0; j < 12; j++) window(front, -14.6 + (j + 0.5) * 2.45, 0.4, 20.015, 2.2, 5.0);
  box(out, 'concrete', [-14.65, 6.0, -20.3], [15.35, 6.55, -9.9], edge);
  for (const x of [-12, -7, -2, 3, 8, 13])
    beam(out, 'metal', [x, 0, -20.35], [x, 5.9, -20.35], 0.1, 0.12, [0.2, 0.22, 0.19]);
}

export const civicTowers = [
  {
    id: 'n0588_michael_s_gate',
    planId: 'N0588',
    title: 'Michael’s Gate',
    wikidata: 'Q1717975',
    build: buildMichael,
    authoringFile: 'civic-tower-models.mjs',
    brief:
      'Bratislava’s restored white city-gate tower, with an open vaulted passage, deeply inset timber windows, fine iron viewing-gallery rail, four Roman clockfaces, an elaborate copper double-bulb lantern and gilded Michael-and-dragon finial.',
    size: [10, 51, 10],
    front: '+Z faces south-southeast down Michalská Street; the through passage runs along ±Z',
    origin: 'Exact mapped tower center at passage pavement Y=0',
    refs: [
      'https://mmb.sk/lokality/michalska-veza',
      'https://muzeumbratislava.sk/node/104',
      'https://www.visitbratislava.com/places/michaels-gate/',
      'https://bratislava.sk/spravy/rekonstrukcia-michalskej-veze-je-spustena',
      'https://bucket-mmb-production.up.railway.app/strapi-uploads/Michalska_veza_cb7dbe1430.jpg',
      'https://muzeumbratislava.sk/sites/default/files/img_3386.jpg',
      'https://www.openstreetmap.org/way/39391573',
    ],
    facts: {
      heightMeters: 51,
      currentBaroqueForm: 1758,
      restorationCompleted: 2023,
      clockDials: 4,
      lanternBells: 2,
      footprintMeters: [8.78, 8.846],
    },
    scaleBasis:
      'The municipal restoration announcement specifies approximately 51 m total height and conservation of the Michael statue and two bells. Museum-owned post-restoration overview and close photographs establish the present white facade, gallery, gilded trim, Roman numerals, open octagonal lantern and complex green copper profiles. The exact-identity map outline controls the 8.8 m plan; tier heights and ornament are reconstructed proportionally from the museum photographs.',
    geographicProposal: {
      anchor: [17.106756436, 48.145128048],
      heading: 0.32935825828,
      source: 'https://www.openstreetmap.org/way/39391573',
      evidence:
        'The nearly square exact-identity footprint and the Michalská through-passage determine a directed frame: authored +Z faces south-southeast into the old city. The mapped long axis is rotated by pi/2 so the passage, rather than the side wall, follows the street.',
      orientationConfidence: 'exact-footprint-and-street-passage-direction',
      limitations:
        'Attached townhouses, including the narrow neighbouring house, retain separate map footprints. Only the gate tower itself is included.',
    },
    limits: [
      'Sculpted wings, armour, shield and dragon are original polygonal reconstructions informed by the museum’s restoration close-up, not a scan of the historic sculpture.',
      'Exterior ornament and tier heights are photograph-derived within the published overall height; public clock hands are held at a fixed display time.',
    ],
    cameras: [
      { name: 'city-gate', position: [15, 6, 22], lookAt: [0, 5, 0] },
      { name: 'clock-gallery', position: [17, 32, 24], lookAt: [0, 31, 0] },
      { name: 'copper-lantern', position: [14, 43, 18], lookAt: [0, 42, 0] },
      { name: 'gilded-michael', position: [4.5, 51, 6], lookAt: [0, 50, 0] },
      { name: 'far-silhouette', position: [70, 33, 90], lookAt: [0, 25, 0] },
    ],
  },
  {
    id: 'n0589_torre_velasca',
    planId: 'N0589',
    title: 'Torre Velasca',
    wikidata: 'Q1156274',
    build: buildVelasca,
    authoringFile: 'civic-tower-models.mjs',
    brief:
      'The restored BBPR tower: warm rendered concrete ribs, twenty exterior supports turning into inclined struts, a recessed service belt, an overhanging six-storey apartment block with loggias, stepped copper duplex roofs and tall paired chimneys.',
    size: [47, 106, 35],
    front:
      '−Z is the north-west long elevation with the low entrance pavilion; +X follows the mapped north-east long axis',
    origin: 'Exact upper-block mapped center at plaza contact Y=0',
    refs: [
      'https://www.ceas.it/project/torre-velasca/',
      'https://www.ceas.it/wp-content/uploads/2024/01/Pianta-Strutturale-scaled.webp',
      'https://www.ceas.it/wp-content/uploads/2024/01/Torre-Velasca1%C2%A9Albo-scaled-e1705405835525.webp',
      'https://www.olivari.it/wp-content/uploads/2025/03/Velasca.pdf',
      'https://torrevelasca.it/progetto/',
      'https://www.openstreetmap.org/relation/18238298',
    ],
    facts: {
      heightMeters: 106,
      officeLevels: 16,
      upperApartmentLevels: 6,
      duplexLevels: 2,
      transferFloor: 18,
      transferFloorDatumMeters: 60.15,
      mainStructuralGridMeters: [36.9, 19.52],
      externalRibs: 20,
      upperMappedEnvelopeMeters: [45.8, 27.791],
    },
    scaleBasis:
      'CEAS publishes the 18th-floor structural plan at +60.15 m with a 36.90 × 19.52 m main grid and twenty exterior ribs. The restoration supplier’s archival booklet reproduces upper/lower plans, the complete upper elevation, duplex section and contemporary material descriptions. Exact OSM roof parts confirm the projecting upper envelope and 106 m chimney top. Photographs establish the restored warm render, contrasting aggregate panels and individual loggia/window rhythm.',
    geographicProposal: {
      anchor: [9.19069705, 45.45988005],
      heading: 0.807825546326,
      source: 'https://www.openstreetmap.org/relation/18238298',
      evidence:
        'The exact-identity mapped upper rectangle establishes center and long north-east/south-west axis; its 45.8 × 27.791 m envelope corresponds to the projecting block and structural ribs, not the narrower office shaft. The north-west entrance pavilion follows the source plans and site relation.',
      orientationConfidence: 'exact-upper-envelope-and-published-structural-plan',
      limitations:
        'Mapped roof height metadata omits some chimney detail; the published 106 m architectural height controls the model. Rooftop antennas and temporary maintenance scaffolding are not part of the stable architectural envelope.',
    },
    limits: [
      'Irregular apartment window/loggia sequencing is reconstructed from the archived elevations and current photographs. Small operable shutter positions are represented consistently rather than as a changing occupancy state.',
      'The restored exterior is represented; original distressed patches and temporary scaffolding visible in restoration-progress photographs are not reproduced.',
    ],
    cameras: [
      { name: 'inclined-ribs', position: [44, 61, 51], lookAt: [0, 56, 0] },
      { name: 'apartment-loggias', position: [38, 80, 49], lookAt: [0, 77, 0] },
      { name: 'duplex-roof', position: [52, 119, -57], lookAt: [0, 97, 0] },
      { name: 'entrance-pavilion', position: [30, 12, -46], lookAt: [0, 5, -11] },
      { name: 'far-silhouette', position: [161, 86, 177], lookAt: [0, 53, 0] },
    ],
  },
];

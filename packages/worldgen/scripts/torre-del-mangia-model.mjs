/** Original Siena civic-tower exterior from city photographs and published dimensions. */
import { beam, loft, radialRing, sphere } from './authored-structure-mesh.mjs';
import {
  archBay,
  cornice,
  facade,
  face,
  transform,
  triangle,
} from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';

const tau = Math.PI * 2,
  brick = [0.56, 0.295, 0.19],
  stone = [0.86, 0.81, 0.68],
  old = [0.66, 0.62, 0.51],
  iron = [0.13, 0.15, 0.14],
  bronze = [0.31, 0.32, 0.22],
  dark = [0.08, 0.09, 0.08];
const masonryTop = 87.45,
  shaftTop = 69.6;
function disk(out, slot, x, y, z, r, color, n = 64) {
  for (let i = 0; i < n; i++) {
    const a = (i * tau) / n,
      b = ((i + 1) * tau) / n;
    triangle(
      out,
      slot,
      [
        [x, y, z],
        [x + r * Math.cos(a), y + r * Math.sin(a), z],
        [x + r * Math.cos(b), y + r * Math.sin(b), z],
      ],
      color,
    );
  }
}
function rim(out, slot, x, y, z, r, thick, color) {
  for (let i = 0; i < 64; i++) {
    const a = (i * tau) / 64,
      b = ((i + 1) * tau) / 64;
    beam(
      out,
      slot,
      [x + r * Math.cos(a), y + r * Math.sin(a), z],
      [x + r * Math.cos(b), y + r * Math.sin(b), z],
      thick,
      thick,
      color,
    );
  }
}
function shield(out, x, y, z, scale = 1, kind = 0) {
  const a = transform(out, 0, [x, y, z]),
    w = 0.44 * scale,
    h = 0.73 * scale;
  const shape = [
    [-w, 0, 0],
    [0, -h * 0.3, 0],
    [w, 0, 0],
    [w, h, 0],
    [-w, h, 0],
  ];
  for (let i = 1; i < shape.length - 1; i++)
    triangle(a, 'carvedstone', [shape[0], shape[i], shape[i + 1]], stone);
  if (kind === 0) {
    const p = [
      [-w + 0.07, 0, 0.03],
      [0, -h * 0.2, 0.03],
      [w - 0.07, 0, 0.03],
      [w - 0.07, h * 0.37, 0.03],
      [-w + 0.07, h * 0.37, 0.03],
    ];
    for (let i = 1; i < p.length - 1; i++)
      triangle(a, 'darkstone', [p[0], p[i], p[i + 1]], [0.18, 0.2, 0.17]);
  } else {
    // Small heraldic relief is deliberately geometric, retaining its raised silhouette.
    beam(
      a,
      'carvedstone',
      [-w * 0.35, h * 0.1, 0.045],
      [w * 0.16, h * 0.57, 0.045],
      0.14 * scale,
      0.1 * scale,
      old,
    );
    sphere(
      a,
      'carvedstone',
      [w * 0.17, h * 0.6, 0.05],
      [0.12 * scale, 0.12 * scale, 0.08 * scale],
      old,
      12,
      8,
    );
    for (const s of [-1, 1])
      beam(
        a,
        'carvedstone',
        [0, h * 0.4, 0.04],
        [s * w * 0.7, h * 0.66, 0.04],
        0.08 * scale,
        0.08 * scale,
        old,
      );
  }
}
function gargoyle(out, x, y, z, angle = 0) {
  const f = transform(out, angle, [x, y, z]);
  box(f, 'limestone', [-0.19, -0.13, -0.2], [0.19, 0.16, 0.22], stone);
  sphere(f, 'carvedstone', [0, 0.04, 0.47], [0.17, 0.19, 0.36], old, 14, 8);
  sphere(f, 'carvedstone', [0, 0.19, 0.73], [0.2, 0.18, 0.2], stone, 14, 8);
  for (const s of [-1, 1]) {
    sphere(f, 'carvedstone', [s * 0.135, 0.36, 0.71], [0.055, 0.1, 0.07], old, 8, 6);
    beam(f, 'carvedstone', [s * 0.12, 0.05, 0.42], [s * 0.13, -0.14, 0.6], 0.09, 0.09, old);
  }
  box(f, 'shadow', [-0.12, 0.07, 0.885], [0.12, 0.16, 0.91], dark);
}
function merlons(out, r, y0, y1, count = 4) {
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const f = transform(out, a);
    for (let i = 0; i < count; i++) {
      const x = -r + 0.36 + (i * (2 * r - 0.72)) / (count - 1),
        w = i === 0 || i === count - 1 ? 0.74 : 0.91;
      box(f, 'limestone', [x - w / 2, y0, r - 0.53], [x + w / 2, y1, r + 0.035], stone);
      box(
        f,
        'limestone',
        [x - w / 2 - 0.055, y1 - 0.11, r - 0.58],
        [x + w / 2 + 0.055, y1 + 0.035, r + 0.09],
        old,
      );
    }
  }
}
function clock(out) {
  const f = transform(out, Math.PI),
    y = 24.7,
    z = 3.56,
    r = 1.9;
  disk(f, 'carvedstone', 0, y, z, r, [0.85, 0.83, 0.75]);
  rim(f, 'limestone', 0, y, z + 0.045, r, 0.095, stone);
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
  const labels = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
  for (let i = 0; i < 12; i++) {
    const a = (i * tau) / 12,
      at = (x, h) => [
        Math.sin(a) * (1.3 + h * 0.27) + Math.cos(a) * x,
        y + Math.cos(a) * (1.3 + h * 0.27) - Math.sin(a) * x,
        z + 0.065,
      ];
    for (let j = 0; j < labels[i].length; j++)
      for (const [x, h, xx, hh] of strokes[labels[i][j]]) {
        const off = (j - (labels[i].length - 1) / 2) * 0.105;
        beam(f, 'metal', at(off + x * 0.07, h), at(off + xx * 0.07, hh), 0.032, 0.025, iron);
      }
  }
  for (let i = 0; i < 60; i++) {
    const a = (i * tau) / 60;
    beam(
      f,
      'metal',
      [Math.sin(a) * 1.67, y + Math.cos(a) * 1.67, z + 0.045],
      [Math.sin(a) * 1.73, y + Math.cos(a) * 1.73, z + 0.045],
      0.022,
      0.021,
      iron,
    );
  }
  beam(f, 'metal', [0, y, z + 0.1], [0.93, y + 1.05, z + 0.1], 0.058, 0.05, iron);
  beam(f, 'metal', [0, y, z + 0.15], [-0.66, y + 0.18, z + 0.15], 0.085, 0.065, iron);
  sphere(f, 'metal', [0, y, z + 0.15], [0.13, 0.13, 0.08], iron, 16, 8);
  // Pale diagonal scars mark the vanished protective roof above the dial.
  for (const s of [-1, 1])
    beam(
      f,
      'limestone',
      [0, 28.72, 3.56],
      [s * 2.48, 26.87, 3.56],
      0.075,
      0.032,
      [0.71, 0.59, 0.45],
    );
}
function shaft(out) {
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const f = transform(out, a),
      front = a === Math.PI,
      holes = [];
    for (const y of [32.3, 43.7, 56.1, 66.6])
      holes.push({
        x: front && y < 60 ? 0.24 : 0,
        y,
        w: y > 66 ? 0.49 : 0.21,
        spring: y + (y > 66 ? 1.69 : 0.66),
        rise: y > 66 ? 0.24 : 0,
        top: y + (y > 66 ? 1.95 : 0.66),
        depth: 0.32,
        trim: 0,
      });
    if (a === 0)
      holes.push({
        x: 0,
        y: 1.4,
        w: 1.1,
        spring: 3.3,
        rise: 0.5,
        top: 3.8,
        depth: 0.38,
        trim: 0.06,
      });
    facade(f, 'brick', 7.1, 0, shaftTop, 3.55, holes, brick);
    // Visible putlog sockets form irregular, restrained rows rather than painted dots.
    for (let row = 0; row < 47; row++)
      for (let j = 0; j < 6; j++) {
        const x = -3.02 + j * 1.18 + (row % 3 === 0 ? 0.12 : 0),
          y = 5.8 + row * 1.31;
        if (
          (front && Math.abs(x) < 2.1 && y > 22 && y < 29) ||
          holes.some((w) => Math.abs(x - w.x) < 0.42 && y > w.y - 0.2 && y < w.top + 0.2)
        )
          continue;
        box(f, 'shadow', [x - 0.057, y, 3.555], [x + 0.057, y + 0.115, 3.568], dark);
        if ((row + j) % 4 === 0)
          box(
            f,
            'limestone',
            [x - 0.09, y + 0.116, 3.555],
            [x + 0.09, y + 0.157, 3.587],
            [0.67, 0.57, 0.44],
          );
      }
    for (let j = 0; j < 10; j++) {
      const x = -3.35 + j * 0.74;
      box(f, 'limestone', [x - 0.13, 68.68, 3.52], [x + 0.13, 69.57, 3.67], [0.77, 0.72, 0.61]);
    }
    // Individual restoration patches supplement the shared brick graph.
    for (let row = 0; row < 89; row++)
      for (let j = 0; j < 11; j++)
        if ((row * 31 + j * 17) % 37 === 0) {
          const x = -3.3 + j * 0.61,
            y = 0.7 + row * 0.75;
          if (front && Math.abs(x) < 2.2 && y > 21 && y < 29) continue;
          face(
            f,
            'brick',
            [
              [x, y, 3.572],
              [x + 0.22, y, 3.572],
              [x + 0.22, y + 0.1, 3.572],
              [x, y + 0.1, 3.572],
            ],
            [0.7, 0.41, 0.275],
          );
        }
  }
  box(out, 'darkstone', [-3.62, 69.5, -3.62], [3.62, 69.67, 3.62], [0.22, 0.245, 0.2]);
  clock(out);
}
function corbelCrown(out, rCore, rEdge, y0, y1, archCount) {
  // Tall inverted corbels project from the brick core to the open arcaded crown.
  const w = rEdge * 2,
    spacing = w / archCount;
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const f = transform(out, a);
    for (let j = 1; j < archCount; j++) {
      const x = -rEdge + j * spacing;
      const rings = [
        [y0, 0.13, rCore],
        [y0 + 0.65, 0.21, rCore + 0.15],
        [y1 - 1.03, 0.27, rEdge - 0.12],
      ].map(([y, rr, z]) => [
        [x - rr, y, z - 0.28],
        [x - rr, y, z + 0.1],
        [x + rr, y, z + 0.1],
        [x + rr, y, z - 0.28],
      ]);
      loft(f, 'limestone', rings, stone);
    }
    // A broad diagonal bracket joins each projecting corner to the actual shaft corner.
    // Extending an ordinary wall bracket at x=rEdge left its foot hanging in space.
    const corner = transform(out, a + Math.PI / 4),
      at = (y, r, w) => [
        [-w, y, r - 0.32],
        [-w, y, r + 0.12],
        [w, y, r + 0.12],
        [w, y, r - 0.32],
      ];
    loft(
      corner,
      'limestone',
      [
        at(y0, rCore * Math.SQRT2 - 0.02, 0.17),
        at(y0 + 0.65, (rCore + 0.15) * Math.SQRT2, 0.24),
        at(y1 - 1.03, (rEdge - 0.13) * Math.SQRT2, 0.38),
      ],
      stone,
    );
    for (let j = 0; j < archCount; j++) {
      const x = -rEdge + (j + 0.5) * spacing;
      archBay(
        f,
        'limestone',
        x,
        spacing - 0.5,
        y1 - 1.85,
        y1 - 1.18,
        0.65,
        y1 + 0.1,
        rEdge,
        0.85,
        stone,
        { back: false, trim: 0.065 },
      );
      for (let k = 0; k < 16; k++) {
        const aa = (k * Math.PI) / 16,
          bb = ((k + 1) * Math.PI) / 16,
          rr = (spacing - 0.5) / 2 + 0.1;
        beam(
          f,
          'darkstone',
          [x + rr * Math.cos(aa), y1 - 1.18 + 0.73 * Math.sin(aa), rEdge + 0.055],
          [x + rr * Math.cos(bb), y1 - 1.18 + 0.73 * Math.sin(bb), rEdge + 0.055],
          0.034,
          0.035,
          [0.3, 0.32, 0.265],
        );
      }
    }
    box(
      f,
      'limestone',
      [-rEdge - 0.06, y1, rEdge - 0.87],
      [rEdge + 0.06, y1 + 0.23, rEdge + 0.09],
      stone,
    );
    for (let j = 0; j < archCount * 4; j++) {
      const x = -rEdge + ((j + 0.5) * w) / (archCount * 4);
      box(
        f,
        'limestone',
        [x - 0.075, y1 + 0.23, rEdge - 0.08],
        [x + 0.075, y1 + 0.51, rEdge + 0.11],
        old,
      );
    }
  }
}
function upper(out) {
  box(out, 'limestone', [-3.55, 69.67, -3.55], [3.55, 74.8, 3.55], stone);
  corbelCrown(out, 3.55, 4.68, 69.68, 74.35, 5);
  cornice(out, 'limestone', 9.42, 9.42, 74.87, 0.4, stone);
  box(out, 'limestone', [-4.65, 75.27, -4.65], [4.65, 75.52, 4.65], stone);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const f = transform(out, a);
    box(f, 'limestone', [-4.66, 75.5, 4.08], [4.66, 76.42, 4.67], stone);
    for (const x of [-1.65, 0, 1.65]) shield(f, x, 75.83, 4.69, 0.55, x === 0 ? 1 : 0);
  }
  merlons(out, 4.66, 76.42, 77.78, 4);
  // The upper belfry has actual through-arches on all sides.
  const h = 2.54;
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const f = transform(out, a),
      opening = {
        x: 0,
        y: 77.18,
        w: 2.17,
        spring: 81.27,
        rise: 1.1,
        top: 82.42,
        depth: 0.7,
        back: false,
        trim: 0.095,
      };
    facade(f, 'limestone', 2 * h, 75.52, 84.8, h, [opening], stone);
    facade(
      transform(f, Math.PI),
      'limestone',
      2 * h,
      75.52,
      84.8,
      -h + 0.7,
      [{ ...opening, depth: 0.035, trim: 0 }],
      old,
    );
    for (const x of [-1.84, 1.84])
      for (const y of [78.2, 81.0, 83.9])
        box(f, 'shadow', [x - 0.055, y, h + 0.003], [x + 0.055, y + 0.23, h + 0.012], dark);
    for (const x of [-1.92, 1.92])
      beam(f, 'metal', [x, 78, h + 0.03], [x, 84.25, h + 0.03], 0.038, 0.03, iron);
    box(f, 'metal', [-h, 81.15, h + 0.06], [h, 81.21, h + 0.12], iron);
    // Safety rails remain slender inside the lower open arch.
    for (let j = 0; j < 12; j++)
      beam(
        f,
        'metal',
        [-1.04 + j * 0.189, 77.22, h - 0.1],
        [-1.04 + j * 0.189, 78.12, h - 0.1],
        0.025,
        0.025,
        iron,
      );
    beam(f, 'metal', [-1.04, 78.12, h - 0.1], [1.04, 78.12, h - 0.1], 0.035, 0.035, iron);
  }
  box(out, 'limestone', [-h, 75.51, -h], [h, 77.18, h], stone);
  corbelCrown(out, h, 3.1, 82.37, 84.45, 3);
  cornice(out, 'limestone', 6.24, 6.24, 84.96, 0.32, stone);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2])
    box(transform(out, a), 'limestone', [-3.1, 85.28, 2.56], [3.1, 85.92, 3.1], stone);
  box(out, 'limestone', [-2.55, 84.6, -2.55], [2.55, 84.79, 2.55], stone);
  merlons(out, 3.1, 85.92, masonryTop, 3);
  for (const s of [-1, 1])
    for (const t of [-1, 1]) {
      gargoyle(out, s * 4.57, 74.43, t * 4.57, Math.atan2(s, t));
      gargoyle(out, s * 2.55, 80.62, t * 2.55, Math.atan2(s, t));
    }
  // Open iron bell support is separate from the masonry elevation.
  for (const s of [-1, 1])
    for (const t of [-1, 1]) {
      const at = (u) => [
        s * 2.24 * Math.cos((u * Math.PI) / 2),
        86.05 + u * 5.05,
        t * 1.6 * Math.cos((u * Math.PI) / 2),
      ];
      for (let j = 0; j < 32; j++)
        beam(out, 'metal', at(j / 32), at((j + 1) / 32), 0.105, 0.13, iron);
      for (let j = 1; j < 6; j++) {
        const u = j / 6,
          p = at(u);
        sphere(out, 'metal', p, [0.095, 0.095, 0.095], iron, 8, 6);
      }
    }
  for (const z of [-0.72, 0.72])
    beam(out, 'metal', [-1.24, 90.1, z], [1.24, 90.1, z], 0.16, 0.17, iron);
  for (const x of [-1.28, 1.28])
    beam(out, 'metal', [x, 86.5, -1.1], [x, 90.25, -0.72], 0.08, 0.1, iron);
  // Sunto: the published 1.98 m mouth and 2.34 m overall bell height.
  const bell = transform(out, 0, [0, -4.3, 0]);
  const prof = [
    [91.95, 0.99],
    [92.08, 0.94],
    [92.35, 0.81],
    [92.78, 0.67],
    [93.34, 0.51],
    [93.74, 0.43],
    [93.95, 0.23],
    [94.17, 0.23],
    [94.29, 0.12],
  ];
  loft(
    bell,
    'copper',
    prof.map(([y, r]) => radialRing(y, r, r, 64)),
    bronze,
    { cap: false },
  );
  for (const [y, r] of [
    [92.09, 0.945],
    [92.36, 0.808],
    [93.69, 0.443],
  ])
    loft(bell, 'copper', [radialRing(y, r, r, 64), radialRing(y + 0.045, r, r, 64)], bronze);
  loft(
    bell,
    'shadow',
    [radialRing(91.975, 0.87, 0.87, 64), radialRing(92.02, 0.87, 0.87, 64)],
    dark,
  );
  beam(bell, 'metal', [0, 92.25, 0], [0, 91.66, 0], 0.13, 0.13, iron);
  sphere(bell, 'metal', [0, 91.62, 0], [0.21, 0.25, 0.21], iron, 16, 8);
  beam(out, 'metal', [0, 90.85, 0], [0, 102, 0], 0.055, 0.055, iron);
  // Stationary white/black city vane; wind animation is not inferred.
  for (const y of [100.9, 101.28])
    beam(out, 'metal', [-0.78, y, 0], [0.86, y, 0], 0.025, 0.025, iron);
  face(
    out,
    'carvedstone',
    [
      [0.05, 100.85, 0.01],
      [1.3, 100.92, 0.01],
      [1.23, 101.53, 0.01],
      [0.05, 101.6, 0.01],
    ],
    [0.89, 0.9, 0.84],
  );
  face(
    out,
    'metal',
    [
      [0.05, 100.85, 0.018],
      [1.3, 100.92, 0.018],
      [1.265, 101.21, 0.018],
      [0.05, 101.225, 0.018],
    ],
    iron,
  );
  face(
    out,
    'carvedstone',
    [
      [0.05, 101.6, -0.01],
      [1.23, 101.53, -0.01],
      [1.3, 100.92, -0.01],
      [0.05, 100.85, -0.01],
    ],
    [0.89, 0.9, 0.84],
  );
  face(
    out,
    'metal',
    [
      [0.05, 101.225, -0.018],
      [1.265, 101.21, -0.018],
      [1.3, 100.92, -0.018],
      [0.05, 100.85, -0.018],
    ],
    iron,
  );
  for (const s of [-1, 1]) {
    beam(out, 'metal', [s * 2.68, 86.2, 2.7], [s * 2.68, 91.0, 2.7], 0.025, 0.025, iron);
    sphere(out, 'metal', [s * 2.68, 91.02, 2.7], [0.07, 0.07, 0.07], iron, 8, 6);
  }
}
function statue(out, x, y, z, angle) {
  const f = transform(out, angle, [x, y, z]);
  loft(
    f,
    'carvedstone',
    [
      [0, 0.22],
      [0.15, 0.24],
      [0.75, 0.17],
      [1.01, 0.24],
    ].map(([yy, r]) => radialRing(yy, r, r * 0.62, 16)),
    stone,
  );
  sphere(f, 'carvedstone', [0, 1.14, 0], [0.13, 0.16, 0.12], stone, 16, 10);
  for (const s of [-1, 1])
    beam(f, 'carvedstone', [s * 0.19, 0.94, 0], [s * 0.21, 0.51, 0.06], 0.11, 0.12, stone);
  beam(f, 'carvedstone', [-0.14, 0.04, 0.08], [-0.14, 0, 0.17], 0.14, 0.17, stone);
  beam(f, 'carvedstone', [0.14, 0.04, 0.08], [0.14, 0, 0.17], 0.14, 0.17, stone);
}
function chapel(out) {
  // The chapel is the attached projecting foot of the tower, retaining its own mapped footprint.
  const centerZ = -7.1,
    rx = 4.6,
    rz = 3.38;
  box(out, 'limestone_raw', [-4.7, 0, centerZ - 3.49], [4.7, 0.34, centerZ + 3.49], stone);
  box(out, 'limestone_raw', [-4.57, 0.34, centerZ - 3.34], [4.57, 0.56, centerZ + 3.34], stone);
  for (const x of [-3.72, 3.72])
    for (const z of [centerZ - 2.63, centerZ + 2.63]) {
      box(out, 'limestone_raw', [x - 0.72, 0.56, z - 0.72], [x + 0.72, 1.02, z + 0.72], old);
      box(out, 'limestone_raw', [x - 0.61, 1.02, z - 0.61], [x + 0.61, 5.9, z + 0.61], stone);
      for (const y of [1.16, 2.94, 4.85, 5.9])
        box(out, 'limestone_raw', [x - 0.73, y, z - 0.73], [x + 0.73, y + 0.18, z + 0.73], stone);
      for (const [a, off] of [
        [0, [0, 0, 0.64]],
        [Math.PI, [0, 0, -0.64]],
        [Math.PI / 2, [0.64, 0, 0]],
        [-Math.PI / 2, [-0.64, 0, 0]],
      ]) {
        const f = transform(out, a, [x + off[0], 0, z + off[2]]);
        for (const y of [1.45, 3.32]) {
          box(f, 'shadow', [-0.29, y, -0.02], [0.29, y + 1.36, 0.005], [0.45, 0.43, 0.36]);
          statue(f, 0, y + 0.045, 0.085, 0);
        }
        for (let j = 0; j < 5; j++)
          sphere(f, 'carvedstone', [-0.46 + j * 0.23, 5.78, 0.07], [0.09, 0.16, 0.1], stone, 10, 6);
      }
    }
  for (const [a, w, z] of [
    [0, 9.2, rz],
    [Math.PI, 9.2, rz],
    [Math.PI / 2, 6.76, rx],
    [-Math.PI / 2, 6.76, rx],
  ]) {
    const f = transform(out, a, [0, 0, centerZ]),
      opening = w > 8 ? 5.96 : 3.72,
      r = 2.98;
    facade(
      f,
      'limestone_raw',
      w,
      5.92,
      9.76,
      z,
      [
        {
          x: 0,
          y: 5.92,
          w: opening,
          spring: 6.0,
          rise: r,
          top: 6 + r + 0.015,
          depth: 1.18,
          back: false,
          trim: 0.18,
        },
      ],
      stone,
    );
    facade(
      transform(f, Math.PI),
      'limestone_raw',
      w,
      5.92,
      9.76,
      -z + 1.18,
      [
        {
          x: 0,
          y: 5.92,
          w: opening,
          spring: 6.0,
          rise: r,
          top: 6 + r + 0.015,
          depth: 0.035,
          back: false,
          trim: 0,
        },
      ],
      old,
    );
    box(f, 'limestone_raw', [-w / 2, 9.5, z - 0.45], [w / 2, 10.89, z + 0.08], stone);
    for (const y of [9.5, 9.81, 10.05, 10.39, 10.72])
      box(
        f,
        'limestone_raw',
        [-w / 2 - 0.13, y, z - 0.16],
        [w / 2 + 0.13, y + 0.15, z + 0.2],
        stone,
      );
    for (let i = 0; i < Math.floor(w / 0.28); i++) {
      const x = -w / 2 + 0.18 + i * 0.28;
      box(f, 'limestone_raw', [x - 0.045, 10.5, z + 0.14], [x + 0.045, 10.68, z + 0.27], old);
    }
    for (const x of [-w * 0.39, w * 0.39]) {
      rim(f, 'carvedstone', x, 9.16, z + 0.03, 0.2, 0.054, old);
      sphere(f, 'carvedstone', [x, 9.16, z + 0.06], [0.08, 0.08, 0.06], stone, 10, 6);
    }
  }
  // The open chapel exposes a groin vault: two crossing barrel profiles meet on diagonal ribs.
  const ceiling = (x, z) =>
    6.0 +
    2.98 *
      Math.max(
        Math.sqrt(Math.max(0, 1 - (x / 2.98) ** 2)),
        Math.sqrt(Math.max(0, 1 - (z / 1.86) ** 2)),
      );
  for (let i = 0; i < 32; i++)
    for (let j = 0; j < 24; j++) {
      const x0 = -2.98 + (i * 5.96) / 32,
        x1 = -2.98 + ((i + 1) * 5.96) / 32,
        z0 = -1.86 + (j * 3.72) / 24,
        z1 = -1.86 + ((j + 1) * 3.72) / 24;
      face(
        out,
        'plaster',
        [
          [x0, ceiling(x0, z0), centerZ + z0],
          [x1, ceiling(x1, z0), centerZ + z0],
          [x1, ceiling(x1, z1), centerZ + z1],
          [x0, ceiling(x0, z1), centerZ + z1],
        ],
        [0.66, 0.62, 0.51],
      );
    }
  for (const s of [-1, 1])
    for (const t of [-1, 1])
      for (let j = 0; j < 24; j++) {
        const at = (u) => [
          s * 2.98 * u,
          6 + 2.98 * Math.sqrt(1 - u * u) - 0.035,
          centerZ + t * 1.86 * u,
        ];
        beam(out, 'carvedstone', at(j / 24), at((j + 1) / 24), 0.09, 0.1, old);
      }
  box(out, 'limestone_raw', [-4.65, 10.87, centerZ - 3.43], [4.65, 11.17, centerZ + 3.43], stone);
  // Low roof falls toward its edge; upper frieze and griffin silhouettes sit on the front crest.
  loft(
    out,
    'limestone_raw',
    [
      [
        [-4.6, 11.17, centerZ - 3.35],
        [-4.6, 11.17, centerZ + 3.35],
        [4.6, 11.17, centerZ + 3.35],
        [4.6, 11.17, centerZ - 3.35],
      ],
      [
        [-4.1, 11.42, centerZ - 2.9],
        [-4.1, 11.42, centerZ + 2.9],
        [4.1, 11.42, centerZ + 2.9],
        [4.1, 11.42, centerZ - 2.9],
      ],
    ],
    old,
  );
  // Low-relief heraldic beasts sit within the cornice frieze, not as roof statues.
  for (const [a, w, z] of [
    [0, 9.2, rz],
    [Math.PI, 9.2, rz],
    [Math.PI / 2, 6.76, rx],
    [-Math.PI / 2, 6.76, rx],
  ]) {
    const f = transform(out, a, [0, 0, centerZ]);
    for (let j = 0; j < 6; j++) {
      const x = -w * 0.4 + j * w * 0.16,
        s = j % 2 === 0 ? 1 : -1;
      sphere(f, 'carvedstone', [x, 10.29, z + 0.13], [0.31, 0.13, 0.07], old, 12, 8);
      sphere(f, 'carvedstone', [x + s * 0.25, 10.38, z + 0.15], [0.1, 0.1, 0.065], stone, 12, 8);
      for (const dx of [-0.2, 0.2])
        beam(
          f,
          'carvedstone',
          [x + dx, 10.23, z + 0.14],
          [x + dx - s * 0.05, 10.13, z + 0.17],
          0.04,
          0.05,
          old,
        );
      beam(
        f,
        'carvedstone',
        [x - s * 0.27, 10.32, z + 0.13],
        [x - s * 0.44, 10.43, z + 0.16],
        0.04,
        0.04,
        old,
      );
    }
  }
  // Three iron perimeter screens remain transparent; the back is against the shaft.
  for (const [a, w, z] of [
    [Math.PI, 6.1, 3.0],
    [Math.PI / 2, 4.0, 4.28],
    [-Math.PI / 2, 4.0, 4.28],
  ]) {
    const f = transform(out, a, [0, 0, centerZ]);
    for (let j = 0; j <= Math.round(w / 0.14); j++) {
      const x = -w / 2 + (j * w) / Math.round(w / 0.14);
      beam(f, 'metal', [x, 0.56, z], [x, 2.02, z], 0.022, 0.022, iron);
      sphere(f, 'metal', [x, 2.06, z], [0.034, 0.072, 0.034], iron, 6, 4);
    }
    for (const y of [0.85, 1.82])
      beam(f, 'metal', [-w / 2, y, z], [w / 2, y, z], 0.035, 0.035, iron);
  }
}
function build(out) {
  shaft(out);
  upper(out);
  chapel(out);
}

export const torreDelMangia = {
  id: 'n0596_torre_del_mangia',
  planId: 'N0596',
  title: 'Torre del Mangia',
  wikidata: 'Q2472396',
  authoringFile: 'torre-del-mangia-model.mjs',
  build,
  brief:
    'Siena’s brick civic tower with deeply projecting travertine arcades, two crenellated crowns, through-open belfry, exposed Sunto bell and curved iron support, clock and attached sculptured Cappella di Piazza.',
  size: [11, 102.1, 16],
  front:
    'Native -Z faces Piazza del Campo and the projecting chapel; +X follows the northeast facade axis',
  origin:
    'Center of the mapped tower crown in XZ; Y=0 is the Piazza del Campo ground at the chapel',
  refs: [
    'https://comune.siena.it/luogo/torre-del-mangia',
    'https://museocivico.comune.siena.it/il-palazzo',
    'https://www.visitsiena.it/33-il-campanone/',
    "https://campanologia.org/sites/www.campanologia.org/files/allegati_pagina_base/Campanili%20pi%C3%B9%20alti%20d'Italia%20-%20altezza%20superiore%20ai%2070%20mt_15.pdf",
    'https://cultura.gov.it/luogo/torre-del-mangia',
    'https://www.openstreetmap.org/way/265416598',
    'https://www.openstreetmap.org/way/252463679',
  ],
  facts: {
    publishedShaftSideMeters: 7,
    authoredShaftSideMeters: 7.1,
    publishedMasonryHeightMeters: 87.45,
    publishedBellStructureHeightMeters: 97,
    reconstructedCurvedFrameApexMeters: 91.1,
    publishedLightningTipMeters: 102,
    bellHeightMeters: 2.34,
    bellDiameterMeters: 1.98,
    bellInstallationYear: 1666,
    chapelMappedSizeMeters: [9.39, 6.98],
    shaftTopReconstructionMeters: shaftTop,
    lowerCorbelArcadesPerSide: 5,
    upperCorbelArcadesPerSide: 3,
  },
  scaleBasis:
    'The Comune di Siena publishes a roughly 7 m square shaft and 87/102 m masonry/lightning heights. The Italian bell-research association separately records 87.45 m masonry and 97 m including the exposed bell structure. The 97 m bell-structure scope is ambiguous: the primary aerial image places the curved support roughly twice the 2.34 m bell height above its footing. The arch is reconstructed with a 91.1 m apex; the thin central lightning mast continues to the owner’s 102 m tip. The conflicting tabulated height is retained as evidence rather than used to stretch the visible support. The city museum’s high-resolution exterior photographs establish the paired crowns, arches, sockets, clock, chapel niches and relief. The city’s aerial bell photograph and published 2.34 × 1.98 m bell dimensions inform the separate open iron support. Intermediate levels, supports and sculptural detail are proportional original reconstructions, not a new survey.',
  geographicProposal: {
    status: 'preview-proposal',
    anchor: [11.332198478, 43.318289062],
    heading: 0.918998496,
    source: 'https://www.openstreetmap.org/way/265416598',
    evidence:
      'Exact-QID tower outline supplies center and axis. Independently mapped chapel way252463679 lies on native -Z toward the Campo, fixing the signed front and the attached footprint. Primary city photos confirm the clock and chapel face.',
    orientationConfidence: 'exact-identity-plus-attached-chapel',
    limitations:
      'The mapped crown envelope is wider than the published square shaft; native dimensions are retained without footprint stretching. The surrounding Palazzo Pubblico is a separate building. Ground elevation is terrain contact; small court/piazza level differences are not surveyed.',
  },
  limits: [
    'The tower and attached chapel are included; the remaining Palazzo Pubblico, interior stairways and neighboring urban fabric are separate assets.',
    'Small saint, griffin, wolf-drain and heraldic details are original polygonal relief informed by primary photographs; inscriptions and individual historic cracks are not facsimiles.',
    'Masonry and lightning heights follow published owner dimensions. The 97 m bell-association structure datum has unclear scope and is not the visible curved support apex; the arch apex at 91.1 m and intermediate vertical intervals are proportional reconstructions from the primary aerial photograph.',
  ],
  cameras: [
    { name: 'piazza-clock-and-chapel', position: [-20, 21, -30], lookAt: [0, 15, -4] },
    { name: 'lower-stone-corbel-crown', position: [19, 73, -23], lookAt: [0, 74, 0] },
    { name: 'belfry-and-exposed-bell', position: [-17, 92, -19], lookAt: [0, 89, 0] },
    { name: 'chapel-niches-and-arches', position: [13, 9, -21], lookAt: [0, 6, -7] },
    { name: 'far-silhouette', position: [98, 59, -146], lookAt: [0, 49, 0] },
  ],
};

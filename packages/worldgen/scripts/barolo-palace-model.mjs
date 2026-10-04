/** Original Palacio Barolo exterior. Documentary dimensions are separate from reconstruction. */
import { beam, loft, normalFor, radialRing, sphere } from './authored-structure-mesh.mjs';
import { box, quad, tube } from './structure-mesh.mjs';

const stone = [0.8, 0.76, 0.66],
  trim = [0.88, 0.84, 0.74];
const green = [0.19, 0.34, 0.23],
  glass = [0.22, 0.3, 0.31],
  white = [0.81, 0.82, 0.75];
const parts = [];
const face = (o, s, p, c) => quad(o, s, p, normalFor(...p), c);
function transformed(out, { translation = [0, 0, 0], angle = 0 } = {}) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const vector = ([x, y, z]) => [c * x + s * z, y, -s * x + c * z];
  const point = (p) => vector(p).map((v, i) => v + translation[i]);
  return {
    detail: out.detail,
    ...Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
        name,
        (s, r, p, n, u, c) => out[name](s, r, p.map(point), vector(n), u, c),
      ]),
    ),
  };
}
function lathe(o, slot, x, z, profile, color = trim, sides = 24) {
  if (o.detail)
    sides = Math.min(sides, o.detail === 'district' ? 6 : o.detail === 'street' ? 8 : 12);
  loft(
    o,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, [x, z])),
    color,
  );
}
function path(o, slot, points, radius, color = trim, sides = 8) {
  if (o.detail) {
    const step = o.detail === 'district' ? 4 : o.detail === 'street' ? 4 : 2;
    points = points.filter((_, i) => i % step === 0 || i === points.length - 1);
    sides = Math.min(sides, o.detail === 'district' ? 3 : 4);
  }
  for (let i = 1; i < points.length; i++)
    tube(o, slot, points[i - 1], points[i], radius, color, sides);
}
function archPoints(x, y, z, radius, rise = radius, pointed = false, count = 32) {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = (Math.PI * i) / count;
    return [
      x - radius * Math.cos(t),
      y +
        rise *
          (pointed
            ? Math.sqrt(Math.max(0, 4 - (Math.abs(Math.cos(t)) + 1) ** 2)) / Math.sqrt(3)
            : Math.sin(t)),
      z,
    ];
  });
}
function arch(o, x, y, z, width, rise, pointed = false, thickness = 0.14) {
  for (const offset of [0, 0.23, 0.47])
    path(
      o,
      'concrete',
      archPoints(x, y, z - offset * 0.08, width / 2 + offset, rise + offset, pointed),
      thickness,
      trim,
    );
}
function window(o, x, y, z, w, h, { rounded = false, pointed = false, grille = 3 } = {}) {
  if (o.detail) {
    const rect = (slot, xx, yy, ww, hh, zz, color) =>
      face(
        o,
        slot,
        [
          [xx + ww / 2, yy, zz],
          [xx - ww / 2, yy, zz],
          [xx - ww / 2, yy + hh, zz],
          [xx + ww / 2, yy + hh, zz],
        ],
        color,
      );
    rect('concrete', x, y - 0.12, w + 0.3, h + 0.24, z + 0.015, trim);
    rect('glass', x, y, w, h, z, glass);
    if (o.detail !== 'district') {
      for (const dx of [-w / 2, 0, w / 2]) rect('metal', x + dx, y, 0.07, h, z - 0.025, white);
      for (const dy of [0, h / 2, h]) rect('metal', x, y + dy, w, 0.065, z - 0.025, white);
    }
    if (rounded) {
      const p = archPoints(x, y + h, z - 0.03, w / 2, w * 0.375, pointed, 12);
      o.addConvexPolygon(
        'glass',
        'palette:#ffffff',
        [...p].reverse(),
        [0, 0, -1],
        (p) => [p[0], p[1]],
        glass,
      );
      path(o, 'concrete', p, 0.11, trim);
    }
    return;
  }
  if (o.detail) grille = Math.min(grille, o.detail === 'district' ? 1 : 3);
  // Opaque PBR glazing behind raised metal frames; no baked light or photographic textures.
  box(o, 'glass', [x - w / 2, y, z], [x + w / 2, y + h, z + 0.07], glass);
  for (let i = 0; i <= grille; i++) {
    const xx = x - w / 2 + (w * i) / grille;
    box(o, 'metal', [xx - 0.035, y, z - 0.055], [xx + 0.035, y + h, z], white);
  }
  const rows =
    o.detail === 'district' ? 1 : o.detail === 'street' ? 2 : Math.max(2, Math.round(h / 0.65));
  for (let i = 0; i <= rows; i++) {
    const yy = y + (h * i) / rows;
    box(o, 'metal', [x - w / 2, yy - 0.03, z - 0.055], [x + w / 2, yy + 0.03, z], white);
  }
  for (const dx of [-w / 2 - 0.11, w / 2 + 0.11])
    box(
      o,
      'concrete',
      [x + dx - 0.075, y - 0.1, z - 0.13],
      [x + dx + 0.075, y + h + 0.1, z + 0.13],
      trim,
    );
  box(o, 'concrete', [x - w / 2 - 0.23, y - 0.14, z - 0.25], [x + w / 2 + 0.23, y, z + 0.12], trim);
  if (rounded) {
    const p = archPoints(x, y + h, z, w / 2, (w / 2) * 0.75, pointed);
    o.addConvexPolygon(
      'glass',
      'palette:#ffffff',
      [...p].reverse(),
      [0, 0, -1],
      (p) => [p[0], p[1]],
      glass,
    );
    arch(o, x, y + h, z - 0.12, w, (w / 2) * 0.75, pointed, 0.09);
  } else
    box(
      o,
      'concrete',
      [x - w / 2 - 0.22, y + h, z - 0.2],
      [x + w / 2 + 0.22, y + h + 0.14, z + 0.1],
      trim,
    );
}
function rail(o, points, y, height = 0.86) {
  path(
    o,
    'concrete',
    points.map(([x, , z]) => [x, y, z]),
    0.11,
  );
  path(
    o,
    'concrete',
    points.map(([x, , z]) => [x, y + height, z]),
    0.13,
  );
  if (o.detail === 'district') return;
  if (o.detail) points = points.filter((_, i) => i % 2 === 0 || i === points.length - 1);
  for (let j = 1; j < points.length; j++) {
    const a = points[j - 1],
      b = points[j],
      count = Math.max(
        1,
        Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / (o.detail ? 0.5 : 0.26)),
      );
    for (let i = 0; i < count; i++) {
      const x = a[0] + ((b[0] - a[0]) * i) / count,
        z = a[2] + ((b[2] - a[2]) * i) / count;
      if (o.detail) {
        box(
          o,
          'concrete',
          [x - 0.05, y + 0.1, z - 0.05],
          [x + 0.05, y + height - 0.1, z + 0.05],
          trim,
        );
        continue;
      }
      lathe(
        o,
        'concrete',
        x,
        z,
        [
          [y + 0.1, 0.055],
          [y + 0.23, 0.085],
          [y + height * 0.6, 0.045],
          [y + height - 0.1, 0.06],
        ],
        trim,
        8,
      );
    }
  }
}
function balcony(o, x, y, z, r = 1.2) {
  lathe(
    o,
    'concrete',
    x,
    z,
    [
      [y - 0.55, r * 0.35],
      [y - 0.28, r * 0.92],
      [y - 0.12, r],
      [y, r],
    ],
    trim,
    32,
  );
  rail(
    o,
    Array.from({ length: 25 }, (_, i) => [
      x + r * Math.cos((Math.PI * i) / 24),
      y,
      z - r * Math.sin((Math.PI * i) / 24),
    ]),
    y,
  );
}
function rosette(o, x, y, z, size = 0.13) {
  if (o.detail) return;
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    sphere(
      o,
      'concrete',
      [x + Math.cos(a) * size, y + Math.sin(a) * size, z],
      [size * 0.38, size * 0.38, size * 0.18],
      trim,
      8,
      4,
    );
  }
}

function bowBay(o) {
  const p = [
    [-1.05, 0, 0],
    [-0.69, 0, -0.64],
    [0.69, 0, -0.64],
    [1.05, 0, 0],
  ];
  for (let j = 1; j < p.length; j++) {
    const a = p[j - 1],
      b = p[j];
    for (const [lo, hi] of [
      [0, 0.85],
      [3.6, 3.8],
    ])
      face(
        o,
        'concrete',
        [
          [b[0], lo, b[2]],
          [a[0], lo, a[2]],
          [a[0], hi, a[2]],
          [b[0], hi, b[2]],
        ],
        stone,
      );
    const h = 2.68;
    face(
      o,
      'glass',
      [
        [b[0], 0.88, b[2] + 0.035],
        [a[0], 0.88, a[2] + 0.035],
        [a[0], 0.88 + h, a[2] + 0.035],
        [b[0], 0.88 + h, b[2] + 0.035],
      ],
      glass,
    );
    if (o.detail === 'district') continue;
    for (const q of [a, b])
      beam(o, 'concrete', [q[0], 0.8, q[2]], [q[0], 3.65, q[2]], 0.1, 0.13, trim);
    for (const yy of [0.84, 1.72, 2.63, 3.6])
      beam(o, 'metal', [a[0], yy, a[2] - 0.04], [b[0], yy, b[2] - 0.04], 0.055, 0.055, white);
    for (const yy of o.detail ? [0.2, 3.72] : [0.03, 0.2, 0.7, 3.72])
      beam(o, 'concrete', [a[0], yy, a[2] - 0.11], [b[0], yy, b[2] - 0.11], 0.12, 0.16, trim);
  }
  for (const xx of [-0.42, 0, 0.42]) rosette(o, xx, 0.43, -0.69);
  box(o, 'metal', [-0.025, 0.87, -0.7], [0.025, 3.58, -0.61], white);
}
const bayX = [-14.0, -11.4, -8.8, -6.2, 6.2, 8.8, 11.4, 14.0];
parts.push({
  name: 'bow-window-module',
  gpuInstances: true,
  build: bowBay,
  instances: [0, Math.PI].flatMap((angle) =>
    bayX.flatMap((x) =>
      Array.from({ length: 7 }, (_, i) => ({
        angle,
        translation: [x, 13.5 + i * 3.8, angle === 0 ? -22.13 : 22.13],
      })),
    ),
  ),
});

function base(o) {
  // Two street wings joined by a central spine leave the documented H-plan light courts open.
  for (const [z0, z1] of [
    [-22.105, -11.5],
    [11.5, 22.105],
  ]) {
    for (const [x0, x1] of [
      [-15.44, -3.75],
      [3.75, 15.44],
    ]) {
      box(o, 'concrete', [x0, 0, z0], [x1, 40.1, z1], stone);
      box(o, 'marble', [x0, 0, z0 - 0.05], [x1, 1.5, z1 + 0.05], [0.39, 0.37, 0.31]);
    }
    box(o, 'concrete', [-3.75, 13.5, z0], [3.75, 40.1, z1], stone);
  }
  for (const [x0, x1] of [
    [-5.5, -3.75],
    [3.75, 5.5],
  ])
    box(o, 'concrete', [x0, 0, -11.5], [x1, 40.1, 11.5], stone);
  box(o, 'concrete', [-3.75, 13.5, -11.5], [3.75, 40.1, 11.5], stone);
  box(o, 'marble', [-3.75, 0, -22.105], [3.75, 0.08, 22.105], [0.65, 0.6, 0.49]);
  // Through passage: high vault, recessed side arcades, repeated pairs of half columns.
  for (let i = 0; i < 9; i++) {
    const z = -21.3 + i * 5.325;
    arch(o, 0, 9.0, z, 7.5, 4.45, false, 0.23);
    for (const x of [-3.68, 3.68]) {
      lathe(
        o,
        'concrete',
        x,
        z,
        [
          [0.1, 0.4],
          [0.5, 0.48],
          [0.8, 0.32],
          [8.4, 0.32],
          [8.8, 0.48],
          [9.05, 0.4],
        ],
        trim,
        24,
      );
    }
  }
  for (let i = 0; i < 40; i++) {
    const a = (Math.PI * i) / 40,
      b = (Math.PI * (i + 1)) / 40;
    face(
      o,
      'concrete',
      [
        [-3.75 * Math.cos(a), 9 + 4.5 * Math.sin(a), -22.1],
        [-3.75 * Math.cos(b), 9 + 4.5 * Math.sin(b), -22.1],
        [-3.75 * Math.cos(b), 9 + 4.5 * Math.sin(b), 22.1],
        [-3.75 * Math.cos(a), 9 + 4.5 * Math.sin(a), 22.1],
      ],
      stone,
    );
  }
  for (const angle of [0, Math.PI]) {
    const out = transformed(o, { angle });
    for (const x of [-13.6, -10.5, -7.4, 7.4, 10.5, 13.6]) {
      window(out, x, 1.7, -22.17, 1.95, 4.15, { rounded: true });
      window(out, x, 8.1, -22.17, 1.65, 3.3);
    }
    for (const x of [-4.65, -4.12, 4.12, 4.65])
      lathe(
        out,
        'concrete',
        x,
        -22.48,
        [
          [0, 0.28],
          [0.6, 0.34],
          [1, 0.22],
          [9.8, 0.22],
          [10.4, 0.48],
          [10.75, 0.4],
        ],
        trim,
        24,
      );
    arch(out, 0, 9, -22.4, 7.5, 4.5, false, 0.19);
    for (const y of [12.8, 13.1, 13.45, 39.65, 40.0])
      box(out, 'concrete', [-15.5, y, -22.38], [15.5, y + 0.15, -21.7], trim);
    for (let floor = 0; floor < 10; floor++) {
      const y = 13.5 + floor * 3.8;
      box(out, 'concrete', [-4.7, y, -22.45], [4.7, y + 3.8, -20.4], stone);
      const center = transformed(out, { translation: [0, y, -22.48] });
      // A wider projecting central bay and paired circular side balconies.
      for (const xx of [-1.15, 1.15]) window(center, xx, 0.82, -0.44, 1.75, 2.62);
      for (const xx of [-3.55, 3.55]) {
        window(center, xx, 0.83, 0, 1.5, 2.5);
        balcony(center, xx, 0.05, -0.12, 1.14);
      }
      rail(
        center,
        [
          [-2.4, 0, -0.72],
          [2.4, 0, -0.72],
        ],
        0.12,
        0.7,
      );
    }
  }
  // Courtyard openings and plain party walls; neighboring properties are not included.
  for (const angle of [-Math.PI / 2, Math.PI / 2]) {
    const out = transformed(o, { angle });
    for (let i = 0; i < 10; i++)
      for (const x of [-7.5, -4.5, -1.5, 1.5, 4.5, 7.5])
        window(out, x, 4.7 + i * 3.4, -5.54, 1.3, 2.1);
  }
}
parts.push({ name: 'body-passage-and-central-bays', build: base, instances: [{}] });

function mansard(o) {
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -15.44 : 4.9,
      x1 = side < 0 ? -4.9 : 15.44;
    const shape = (y) => (y < 43.5 ? -22.1 : -22.1 + Math.pow((y - 43.5) / 8.6, 1.7) * 3.3);
    for (let i = 0; i < 48; i++) {
      const y = 40.1 + i / 4,
        yy = y + 0.25;
      face(
        o,
        'metal',
        [
          [x1, y, shape(y)],
          [x0, y, shape(y)],
          [x0, yy, shape(yy)],
          [x1, yy, shape(yy)],
        ],
        green,
      );
    }
    box(o, 'concrete', [x0, 40.1, -18.65], [x1, 52.1, -11.5], stone);
    box(o, 'concrete', [x0, 52.1, -19.1], [x1, 52.4, -11.5], trim);
    rail(
      o,
      [
        [x0, 0, -18.9],
        [x1, 0, -18.9],
      ],
      52.4,
    );
    for (const x of bayX.filter((x) => Math.sign(x) === side)) {
      window(o, x, 40.2, -22.29, 1.63, 1.6, { rounded: true });
      window(o, x, 44.2, shape(44.2) - 0.15, 1.4, 1.65);
      window(o, x, 47.7, shape(47.7) - 0.12, 1.4, 1.35);
      const z = shape(50.85) - 0.2;
      const loop = Array.from({ length: 33 }, (_, i) => [
        x + 0.58 * Math.cos((i * Math.PI) / 16),
        50.85 + 0.54 * Math.sin((i * Math.PI) / 16),
        z,
      ]);
      path(o, 'concrete', loop, 0.12);
      o.addConvexPolygon(
        'glass',
        'palette:#ffffff',
        loop.slice(0, -1).reverse(),
        [0, 0, -1],
        (p) => [p[0], p[1]],
        glass,
      );
      beam(o, 'metal', [x, 50.34, z - 0.03], [x, 51.36, z - 0.03], 0.05, 0.05, white);
      for (const dx of [-1.22, 1.22])
        path(
          o,
          'concrete',
          Array.from({ length: 25 }, (_, i) => {
            const y = 43.1 + (i * 9) / 24;
            return [x + dx, y, shape(y) - 0.06];
          }),
          0.105,
        );
      rail(
        o,
        [
          [x - 1.1, 0, -22.66],
          [x + 1.1, 0, -22.66],
        ],
        39.9,
      );
    }
  }
}
parts.push({ name: 'green-mansard', build: mansard, instances: [{}, { angle: Math.PI }] });

function towerPlan(y, a, c = 1.6) {
  return [
    [-a + c, -a],
    [-a, -a + c],
    [-a, a - c],
    [-a + c, a],
    [a - c, a],
    [a, a - c],
    [a, -a + c],
    [a - c, -a],
  ].map(([x, z]) => [x, y, z]);
}
function towerBand(o, y, a) {
  loft(
    o,
    'concrete',
    [towerPlan(y - 0.35, a - 0.3), towerPlan(y - 0.17, a), towerPlan(y, a)],
    trim,
  );
  for (let side = 0; side < 4; side++) {
    const out = transformed(o, { angle: (side * Math.PI) / 2 });
    rail(
      out,
      [
        [-a + 1.5, 0, -a],
        [a - 1.5, 0, -a],
      ],
      y,
    );
    for (const x of [-a + 1.2, a - 1.2]) balcony(out, x, y, -a + 0.55, 1.25);
  }
}
function tower(o) {
  const levels = [
    [40.1, 8.15],
    [52.4, 8.15],
    [60, 7.7],
    [70.4, 7.25],
    [76, 7.0],
    [82.7, 6.6],
    [86, 6.2],
  ];
  loft(
    o,
    'concrete',
    levels.map(([y, r]) => towerPlan(y, r)),
    stone,
  );
  for (const [y, r] of levels.slice(1)) towerBand(o, y, r + 0.48);
  for (let side = 0; side < 4; side++) {
    const out = transformed(o, { angle: (side * Math.PI) / 2 });
    for (const [y, r, h, w] of [
      [52.6, 8.1, 2.7, 4.1],
      [56.5, 7.95, 2.5, 4.1],
      [61, 7.65, 4, 4.5],
      [71.4, 7.25, 3.3, 4.1],
      [77.2, 6.95, 3.3, 4.2],
      [83.2, 6.5, 1.6, 2.4],
    ]) {
      window(out, 0, y, -r - 0.14, w, h, { rounded: y >= 61, pointed: y === 61, grille: 6 });
      if (y === 61) arch(out, 0, y + h, -r - 0.35, 7.4, 4.9, true, 0.2);
    }
    for (const sign of [-1, 1]) {
      const rings = [
        [52.5, 8.15, 0.78],
        [60, 7.7, 0.78],
        [60.3, 7.68, 0.95],
        [69.5, 7.3, 0.83],
        [70.4, 7.25, 1.0],
        [75.8, 7.0, 0.85],
        [76, 7.0, 1.0],
        [82.7, 6.6, 0.72],
      ];
      loft(
        out,
        'concrete',
        rings.map(([y, a, r]) =>
          radialRing(y, r, r, o.detail ? 12 : 28, [sign * (a - 1.15), -a + 0.36]),
        ),
        trim,
      );
      balcony(out, sign * 6.2, 68, -7.0, 1.35);
    }
  }
  // Ribbed curvilinear crown, with eight buttresses and scalloped lower turrets.
  const profile = [
    [85.9, 5.6],
    [87, 5.4],
    [88.8, 4.85],
    [90.5, 4.1],
    [92, 3.7],
    [94, 3.65],
    [95.1, 3.0],
  ];
  lathe(o, 'concrete', 0, 0, profile, stone, 64);
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4,
      c = Math.cos(a),
      s = Math.sin(a);
    path(
      o,
      'concrete',
      profile.map(([y, r]) => [(r + 0.08) * c, y, (r + 0.08) * s]),
      0.2,
      trim,
      12,
    );
    const x = 5.4 * c,
      z = 5.4 * s;
    lathe(
      o,
      'concrete',
      x,
      z,
      [
        [82.8, 0.74],
        [84.7, 0.74],
        [85, 0.98],
        [85.7, 0.86],
        [86.4, 0.48],
        [86.7, 0.12],
      ],
      trim,
      24,
    );
    const local = transformed(o, { angle: -a - Math.PI / 2 });
    window(local, 0, 88.7, -4.9, 1.25, 2.1, { rounded: true, grille: 2 });
  }
  for (const [y, r] of [
    [86.8, 5.55],
    [91.8, 3.86],
    [95.0, 3.25],
  ])
    lathe(
      o,
      'concrete',
      0,
      0,
      [
        [y, r],
        [y + 0.18, r],
      ],
      trim,
      64,
    );
  rail(o, [...radialRing(95.3, 3.1, 3.1, 48), radialRing(95.3, 3.1, 3.1, 48)[0]], 95.3, 0.75);
  lathe(
    o,
    'concrete',
    0,
    0,
    [
      [95.1, 2.3],
      [95.55, 2.3],
    ],
    trim,
    32,
  );
  loft(
    o,
    'clear_glass',
    [
      [95.55, 2.15],
      [98.3, 2.15],
      [99.05, 1.6],
    ].map(([y, r]) => radialRing(y, r, r, 16)),
    [0.66, 0.74, 0.7],
  );
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    path(
      o,
      'metal',
      [
        [2.15 * Math.cos(a), 95.55, 2.15 * Math.sin(a)],
        [2.15 * Math.cos(a), 98.3, 2.15 * Math.sin(a)],
        [1.6 * Math.cos(a), 99.05, 1.6 * Math.sin(a)],
      ],
      0.035,
      [0.25, 0.29, 0.25],
    );
  }
  lathe(
    o,
    'metal',
    0,
    0,
    [
      [99.03, 1.65],
      [99.5, 1.1],
      [99.7, 0.16],
    ],
    [0.27, 0.37, 0.29],
    32,
  );
  tube(o, 'metal', [0, 99.5, 0], [0, 100, 0], 0.045, [0.25, 0.3, 0.25], 12);
  lathe(
    o,
    'metal',
    0,
    0,
    [
      [95.6, 0.35],
      [96.45, 0.35],
      [96.55, 0.7],
    ],
    [0.28, 0.26, 0.22],
    24,
  );
  tube(o, 'metal', [0, 97.2, 0.48], [0, 97.2, -0.6], 0.77, [0.25, 0.25, 0.2], 40);
  tube(o, 'glass', [0, 97.2, -0.6], [0, 97.2, -0.64], 0.72, [0.74, 0.76, 0.67], 40);
}
parts.push({
  name: 'sculpted-tower-and-lantern',
  build: tower,
  instances: [{ translation: [0, 0, -14] }],
});

/** Hand-authored levels omit subpixel relief while retaining the palace's actual composition. */
export function buildBaroloRuntime(out, detail) {
  for (const p of parts)
    for (const instance of p.instances) p.build(transformed({ ...out, detail }, instance));
}
export function buildBaroloSkyline(o) {
  for (const z of [-16.8, 16.8])
    box(o, 'concrete', [-15.44, 0, z - 5.3], [15.44, 40.1, z + 5.3], stone);
  box(o, 'concrete', [-5.5, 0, -16.8], [5.5, 40.1, 16.8], stone);
  for (const angle of [0, Math.PI]) {
    const out = transformed(o, { angle });
    for (const [x0, x1] of [
      [-15.44, -4.9],
      [4.9, 15.44],
    ]) {
      face(
        out,
        'metal',
        [
          [x1, 40.1, -22.1],
          [x0, 40.1, -22.1],
          [x0, 52.4, -18.8],
          [x1, 52.4, -18.8],
        ],
        green,
      );
      box(out, 'concrete', [x0, 40.1, -18.8], [x1, 52.4, -11.5], stone);
    }
  }
  const top = transformed(o, { translation: [0, 0, -14] });
  loft(
    top,
    'concrete',
    [
      [40.1, 8.15],
      [60, 7.7],
      [76, 7.0],
      [86, 6.2],
    ].map(([y, r]) => towerPlan(y, r)),
    stone,
  );
  for (const [y, r] of [
    [60, 8.1],
    [70.4, 7.65],
    [76, 7.4],
    [82.7, 7.0],
    [86, 6.6],
  ])
    loft(top, 'concrete', [towerPlan(y - 0.4, r), towerPlan(y, r)], trim);
  loft(
    top,
    'concrete',
    [
      [86, 5.6],
      [90.5, 4.1],
      [95, 3.0],
      [95.5, 2.15],
      [98.3, 2.15],
      [99.05, 1.6],
      [99.7, 0.16],
      [100, 0.05],
    ].map(([y, r]) => radialRing(y, r, r, 12)),
    stone,
  );
}

export const baroloPalaceStudy = {
  id: 'N0234',
  key: 'barolo_palace',
  title: 'Palacio Barolo',
  wikidataId: 'Q571763',
  build(out) {
    for (const p of parts) for (const instance of p.instances) p.build(transformed(out, instance));
  },
  encodeAssembly(encode, join) {
    return join(
      parts.map((p) => ({ ...p, glb: encode(p.build, p.name) })),
      'Molen original Palacio Barolo exterior',
    );
  },
  brief:
    'H-plan palace with a through passage, repeated projecting bow windows, three-level green mansards, central bays and circular balconies, pointed tower arches, layered cornices, ribbed crown and glazed lighthouse.',
  sourceFacts: {
    plotWidthMeters: 30.88,
    plotDepthMeters: 44.21,
    passageWidthMeters: 7.5,
    passageHeightMeters: 13.5,
    ownerOverallHeightMeters: 100,
    municipalDomeHeightMeters: 86,
    ownerDomeHeightMeters: 90,
    nationalHeritageOverallHeightMeters: 103,
    cadastralParcel: '012-039-004',
    entrances: ['Avenida de Mayo 1370', 'Hipólito Yrigoyen 1373'],
  },
  reconstruction: {
    basis:
      'Original geometry reconstructed from owner front, mansard, tower and lantern photographs; municipal heritage book photo plates and H-plan description; rear photograph by Elsapucai; aerial photograph linked by El Ojo del Arte. Intermediate elevations, light-court dimensions, tower offset, mouldings and decorative motifs are approximate.',
    bodyRoofMeters: 40.1,
    mansardTopMeters: 52.4,
    towerCenterXZ: [0, -14],
    overallHeightChoiceMeters: 100,
  },
  refs: [
    'https://palaciobarolo.com.ar/palacio-barolo/resena-historica/',
    'https://palaciobarolo.com.ar/palacio-barolo/arquitectura/',
    'https://palaciobarolo.com.ar/multimedia/',
    'https://buenosaires.gob.ar/areas/cultura/cpphc/archivos/libros/temas_15.pdf',
    'https://www.argentina.gob.ar/node/439660',
    'https://documentosboletinoficial.buenosaires.gob.ar/publico/PE-DIS-MJGGC-DGIUR-663-26-ANX.pdf',
    'https://commons.wikimedia.org/wiki/File:Palacio_Barolo_(desde_calle_Yrigoyen).JPG',
    'https://elojodelarte.com/patrimonio/el-palacio-barolo',
  ],
  sourceDocuments: ['reference-metadata.json'],
  nativeAxes: {
    up: '+Y',
    longitudinal: '+Z toward Hipólito Yrigoyen',
    front: '-Z toward Avenida de Mayo',
    origin: 'Working parcel center at pavement datum, not a verified geographic anchor',
  },
  geographic: () => ({
    status: 'research-only',
    reviewStatus: 'cached-footprint-conflict; automatic placement disabled',
    notes:
      'OSM way 1386044833 has exact Q571763 identity but a 60.285 by 43.074 m outline, inconsistent with the documented 30.88 by 44.21 m parcel. Do not stretch this model or suppress neighboring map buildings using that outline. Municipal parcel 012-039-004 is the next registration source.',
  }),
  geographicNote:
    'The cached exact-QID OSM footprint is inconsistent with the documented parcel width. The retained anchor and heading are evidence only; automatic placement is disabled pending a corrected parcel and signed orientation review.',
  limitations: [
    'Geographic registration is unresolved: the cached 60 m frontage conflicts with the documented 30.88 m frontage. This model is catalogued but not automatically placed.',
    'Maximum exterior fidelity remains pending. H-plan proportions, intermediate heights, tower offset, dome curvature, balcony profiles and ornamental relief are photographic reconstructions without measured drawings.',
    'The rear uses the observed related façade vocabulary but requires a more complete elevation reference. Light-court windows, roofs and party walls are schematic.',
    'Owner height is 100 m; national heritage lists 103 m, and dome heights differ between references. This model uses 100 m and records the disagreement.',
    'Mansard tiling, figurative sculptures, exact façade inscriptions, full shopfront signs, modern air-conditioning equipment and surveyed passage furnishings remain unauthored. No third-party photographs or meshes are embedded.',
  ],
  camera: { position: [-95, 65, -145], lookAt: [0, 45, -6], fov: 39 },
  qaCameras: [
    { name: 'avenida-front', position: [0, 37, -94], lookAt: [0, 42, -14] },
    { name: 'bow-window-relief', position: [-12, 22, -32], lookAt: [-10, 22, -22] },
    { name: 'portal', position: [0, 7, -39], lookAt: [0, 7, -21] },
    { name: 'through-passage', position: [0, 4, -18], lookAt: [0, 5, 15] },
    { name: 'green-mansard', position: [-22, 49, -43], lookAt: [-9, 47, -20] },
    { name: 'tower-pointed-arch', position: [-18, 67, -40], lookAt: [0, 66, -21] },
    { name: 'balconies', position: [18, 79, -37], lookAt: [2, 78, -20] },
    { name: 'crown-and-lantern', position: [-20, 99, -37], lookAt: [0, 91, -14] },
    { name: 'lantern-mechanism', position: [-4, 98, -19], lookAt: [0, 97, -14] },
    { name: 'rear-elevation', position: [0, 42, 85], lookAt: [0, 43, 12] },
    { name: 'courtyards', position: [61, 78, 38], lookAt: [0, 30, 0] },
  ],
};

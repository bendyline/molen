import {
  beam,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const controls = {
  anchor: [21.19272217154503, 41.877985095930555],
  heading: 0.1384706325548526,
  datum: 468,
  crest: 474.4,
  foundation: 348.3,
  crestLength: 302.8009136276473,
  crestRoad: [
    [-151.40046, 0],
    [-72.1, 3.1],
    [6.3, 3.0],
    [112.2, 1.7],
    [151.40046, 0],
  ],
  pool: 459,
  poolMinimum: 432,
  spillway: { center: [194, 114], radius: 20.5, lip: 461.7 },
  tower: { center: [148, 23], ground: 470, width: 12.2, depth: 11.6, height: 14.8 },
  plant: {
    outline: [
      [27, -425],
      [89, -425],
      [89, -398],
      [27, -398],
    ],
    floor: 366.6,
    wallHeight: 13.2,
    units: 2,
  },
  yard: {
    outline: [
      [24, -398],
      [91, -398],
      [91, -347],
      [24, -347],
    ],
    floor: 366.65,
  },
};
const palette = {
  riprap: { slot: 'foundation', graph: 'stone_limestone_raw', rgb: [0.68, 0.658, 0.592] },
  rock: { slot: 'foundation', graph: 'gravel', rgb: [0.54, 0.527, 0.466] },
  wall: { slot: 'wall', graph: 'concrete_boardformed', rgb: [0.64, 0.625, 0.566] },
  trim: { slot: 'trim', graph: 'concrete_plain', rgb: [0.78, 0.772, 0.71] },
  house: { slot: 'wall', graph: 'stucco', rgb: [0.78, 0.57, 0.301] },
  white: { slot: 'trim', graph: 'concrete_plain', rgb: [0.89, 0.878, 0.8] },
  roof: { slot: 'roof', graph: 'metal_standing_seam', rgb: [0.56, 0.164, 0.12] },
  rail: { slot: 'trim', graph: 'metal_painted', rgb: [0.284, 0.456, 0.516] },
  gate: { slot: 'trim', graph: 'metal_painted', rgb: [0.198, 0.249, 0.264] },
  glass: { slot: 'window', graph: 'window_grid', rgb: [0.176, 0.247, 0.272] },
};
export const damSurfaces = Object.fromEntries(
  Object.entries(palette).map(([key, { rgb, ...surface }]) => [key, surface]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const { datum, crest, foundation } = controls;
const p = (x, y, z) => [x, y - datum, z];
const rod = (o, m, a, b, w, d) => beam(o, m, a, b, w, d, palette[m].rgb);
const box = (o, m, x, y, z, w, h, d) => rod(o, m, p(x, y - h / 2, z), p(x, y + h / 2, z), d, w);
function face(o, m, points, toward, shade = 1) {
  let n = normalFor(...points);
  if (n.reduce((sum, v, i) => sum + v * toward[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  const add = points.length === 3 ? o.addTriangle : o.addQuad;
  add.call(
    o,
    m,
    'palette:#ffffff',
    points,
    n,
    undefined,
    palette[m].rgb.map((v) => v * shade),
  );
}
function patch(o, m, a, b, c, d, n, shade) {
  face(o, m, [a, b, c], n, shade);
  face(o, m, [a, c, d], n, shade);
}
const relief = [
  [-301, 350.1, -48, 20],
  [-283, 356.5, -60, 40],
  [-257, 376, -79, 61],
  [-216, 398, -108, 84],
  [-190, 409, -130, 96],
  [-151, 424, -143, 108],
  [-119, 437, -149, 118],
  [-81, 450, -150, 129],
  [-36, 467, -151, 143],
  [-7, crest - 0.2, -151.4, 151.4],
];
function earthwork(o, tier) {
  const rows =
    tier === 0 ? relief.filter((_, i) => i % 2 === 0 || i === relief.length - 1) : relief;
  const segments = [7, 10, 15, 20, 25][tier];
  for (let j = 1; j < rows.length; j++) {
    const [z, y, a, b] = rows[j - 1],
      [Z, Y, A, B] = rows[j];
    for (let i = 0; i < segments; i++) {
      const u = i / segments,
        v = (i + 1) / segments;
      const bulge = (t) => Math.sin(t * Math.PI) * 1.4;
      const at = (x, h, z, t) => p(x, h + bulge(t), z);
      patch(
        o,
        'riprap',
        at(a + (b - a) * u, y, z, u),
        at(a + (b - a) * v, y, z, v),
        at(A + (B - A) * v, Y, Z, v),
        at(A + (B - A) * u, Y, Z, u),
        [0, 1, -0.2],
        0.96 + (i % 4) * 0.02,
      );
    }
    for (const side of [-1, 1]) {
      const x = side < 0 ? a : b,
        X = side < 0 ? A : B;
      patch(o, 'rock', p(x, foundation, z), p(X, foundation, Z), p(X, Y, Z), p(x, y, z), [
        side,
        0,
        0,
      ]);
    }
  }
  const top = controls.crestRoad,
    wide = [
      [-151.4, 7.5],
      [151.4, 7.5],
    ],
    toe = [
      [-57, 92],
      [132, 92],
    ];
  patch(
    o,
    'riprap',
    p(wide[0][0], crest - 0.2, wide[0][1]),
    p(wide[1][0], crest - 0.2, wide[1][1]),
    p(toe[1][0], foundation + 4, toe[1][1]),
    p(toe[0][0], foundation + 4, toe[0][1]),
    [0, 1, 1],
  );
}
function road(o, tier) {
  const path = controls.crestRoad;
  for (let i = 1; i < path.length; i++) {
    const [a, z] = path[i - 1],
      [b, Z] = path[i];
    patch(
      o,
      'trim',
      p(a, crest, z - 5),
      p(b, crest, Z - 5),
      p(b, crest, Z + 5),
      p(a, crest, z + 5),
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      patch(
        o,
        'wall',
        p(a, crest - 0.4, z + side * 5),
        p(b, crest - 0.4, Z + side * 5),
        p(b, crest + 0.28, Z + side * 5),
        p(a, crest + 0.28, z + side * 5),
        [0, 0, side],
      );
      if (tier > 0)
        rod(
          o,
          'rail',
          p(a, crest + 1.1, z + side * 4.8),
          p(b, crest + 1.1, Z + side * 4.8),
          0.085,
          0.105,
        );
    }
    if (tier > 1) {
      const count = Math.ceil((b - a) / (tier > 2 ? 5.8 : 12));
      for (let k = 0; k < count; k++) {
        const t = k / count,
          x = a + (b - a) * t,
          w = z + (Z - z) * t;
        for (const side of [-1, 1]) box(o, 'rail', x, crest + 0.65, w + side * 4.8, 0.09, 1.0, 0.1);
      }
    }
  }
}
function ring(o, tier) {
  const {
      center: [x, z],
      radius: r,
      lip: top,
    } = controls.spillway,
    n = [12, 20, 32, 44, 60][tier];
  const rows = [
    [428, 8],
    [441, 11],
    [451, r - 2],
    [top - 0.8, r],
    [top, r + 1.05],
  ];
  const pt = (i, R, h) =>
    p(x + Math.cos((i / n) * Math.PI * 2) * R, h, z + Math.sin((i / n) * Math.PI * 2) * R);
  for (let i = 0; i < n; i++) {
    const a = i,
      b = i + 1,
      theta = ((i + 0.5) / n) * Math.PI * 2,
      dir = [Math.cos(theta), 0, Math.sin(theta)];
    for (let j = 1; j < rows.length; j++) {
      const [y, R] = rows[j - 1],
        [Y, S] = rows[j];
      patch(
        o,
        'wall',
        pt(a, R, y),
        pt(b, R, y),
        pt(b, S, Y),
        pt(a, S, Y),
        dir,
        0.97 + (i % 5) * 0.015,
      );
      patch(
        o,
        'wall',
        pt(a, R - 1, y),
        pt(b, R - 1, y),
        pt(b, S - 1, Y),
        pt(a, S - 1, Y),
        dir.map((v) => -v),
        0.78,
      );
    }
    const y = top;
    patch(
      o,
      'trim',
      pt(a, r + 1.05, y),
      pt(b, r + 1.05, y),
      pt(b, r - 0.95, y),
      pt(a, r - 0.95, y),
      [0, 1, 0],
    );
    face(o, 'gate', [p(x, 428, z), pt(a, 7, 428), pt(b, 7, 428)], [0, 1, 0], 0.32);
  }
  // Bank retaining wall and the low service landing seen beside the weir.
  box(o, 'wall', x, 446, z - 25, 48, 30, 5);
  box(o, 'trim', x, 461.3, z - 25, 49, 0.8, 5.8);
  box(o, 'wall', x - 25.8, 446, z - 7.1, 7.6, 29, 20);
  box(o, 'trim', x - 27.9, 435.7, z + 6.3, 15.5, 0.7, 6.2);
  for (const xx of [x - 10, x + 10]) box(o, 'trim', xx, 465.8, z - 25, 1.45, 8.2, 1.45);
}
function gable(o, m, x, z, y, w, d, h) {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - d / 2,
    v = z + d / 2,
    top = y + h;
  patch(o, m, p(a, y, u), p(a, y, v), p(x, top, v), p(x, top, u), [-1, 1, 0]);
  patch(o, m, p(b, y, u), p(b, y, v), p(x, top, v), p(x, top, u), [1, 1, 0]);
  for (const [zz, sign] of [
    [u, -1],
    [v, 1],
  ])
    face(o, m, [p(a, y, zz), p(b, y, zz), p(x, top, zz)], [0, 0, sign]);
}
function tower(o, tier) {
  const {
    center: [x, z],
    ground: y,
    width: w,
    depth: d,
    height: h,
  } = controls.tower;
  box(o, 'white', x, y + h / 2, z, w, h, d);
  box(o, 'white', x, y + h - 1.5, z, w + 1.4, 3.2, d + 1.1);
  for (const side of [-1, 1]) {
    box(o, 'glass', x, y + h - 1.45, z + side * (d / 2 + 0.57), w - 1.4, 1.95, 0.13);
    box(o, 'glass', x + side * (w / 2 + 0.75), y + h - 1.45, z, 0.12, 1.95, d - 1.6);
  }
  gable(o, 'roof', x, z, y + h + 0.2, w + 2.4, d + 2.2, 2.5);
  box(o, 'trim', x + 23, y + 2.6, z + 18, 35, 1.8, 9);
  for (const xx of [x + 11, x + 23, x + 35]) box(o, 'wall', xx, y - 8, z + 18, 1.7, 22, 1.9);
  if (tier > 0) {
    for (const zz of [z + 14, z + 22])
      rod(o, 'rail', p(x + 6, y + 4.1, zz), p(x + 40, y + 4.1, zz), 0.085, 0.105);
    const A = p(x + 4, y + 0.25, z + 21),
      B = p(x + 16, 437, z + 81);
    for (const side of [-1, 1])
      rod(
        o,
        'rail',
        A.map((v, i) => (i === 0 ? v + side * 1.8 : v)),
        B.map((v, i) => (i === 0 ? v + side * 1.8 : v)),
        0.24,
        0.27,
      );
  }
}
function powerhouse(o, tier) {
  const { outline, floor, wallHeight } = controls.plant,
    [a, b, c, d] = outline;
  const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2],
    w = b[0] - a[0],
    depth = d[1] - a[1];
  box(o, 'wall', ...[mid[0], floor - 2.1, mid[1]], w + 3, 4.2, depth + 3);
  box(o, 'house', mid[0], floor + wallHeight / 2, mid[1], w, wallHeight, depth);
  // Hall ridge follows the long east-west axis.
  const eave = floor + wallHeight;
  const corners = [
    [a[0] - 1, a[1] - 0.8],
    [b[0] + 1, b[1] - 0.8],
    [c[0] + 1, c[1] + 0.8],
    [d[0] - 1, d[1] + 0.8],
  ];
  for (const [r, s] of [
    [[corners[0], corners[1]], -1],
    [[corners[3], corners[2]], 1],
  ]) {
    patch(
      o,
      'roof',
      p(r[0][0], eave, r[0][1]),
      p(r[1][0], eave, r[1][1]),
      p(r[1][0], eave + 3.4, mid[1]),
      p(r[0][0], eave + 3.4, mid[1]),
      [0, 1, s],
    );
  }
  for (const [x, sign] of [
    [a[0], -1],
    [b[0], 1],
  ])
    face(o, 'house', [p(x, eave, a[1]), p(x, eave, c[1]), p(x, eave + 3.4, mid[1])], [sign, 0, 0]);
  const bays = tier === 0 ? 4 : 8;
  for (let i = 0; i < bays; i++) {
    const x = a[0] + ((i + 0.5) * w) / bays;
    box(o, 'glass', x, floor + 7.7, d[1] + 0.07, (w / bays) * 0.76, 3, 0.16);
    if (tier > 0) {
      box(o, 'white', a[0] + (i * w) / bays, floor + 6.6, d[1] + 0.3, 0.44, 13.25, 0.6);
      if (i % 3 === 1) box(o, 'gate', x, floor + 3.1, d[1] + 0.095, 4.1, 5.6, 0.16);
    }
  }
  box(o, 'house', 15, floor + 4.6, -385, 15, 9.2, 30);
  gable(o, 'roof', 15, -385, floor + 9.3, 17, 32, 2.1);
  box(o, 'house', 0, floor + 4.2, -386, 12, 8.4, 42);
  gable(o, 'roof', 0, -386, floor + 8.5, 14, 44, 1.8);
  box(o, 'trim', 57, floor - 0.2, -371, 70, 0.4, 54);
  if (tier > 0)
    for (const x of [42, 69]) {
      box(o, 'gate', x, floor + 2.7, -393, 9.8, 5.3, 6.7);
      for (const z of [-395.5, -391])
        rod(o, 'rail', p(x - 4, floor + 6, z), p(x + 4, floor + 6, z), 0.3, 0.34);
    }
  if (tier > 1)
    for (const x of [33, 49, 66, 82]) {
      for (const z of [-384, -367]) {
        box(o, 'gate', x, floor + 2.4, z, 1.15, 4.8, 1.3);
        rod(o, 'rail', p(x, floor + 5, z), p(x, floor + 8, z), 0.28, 0.3);
      }
      rod(o, 'rail', p(x, floor + 8, -384), p(x, floor + 8, -367), 0.19, 0.22);
    }
  for (const x of [28, 88])
    rod(o, 'wall', p(x, floor - 1.1, -425), p(x, floor - 1.1, -452), 3.8, 5.6);
}
export function buildDamLevel(o, name) {
  const tier = tiers[name];
  if (tier === undefined) throw Error('Unknown Kozjak tier: ' + name);
  earthwork(o, tier);
  road(o, tier);
  ring(o, tier);
  tower(o, tier);
  powerhouse(o, tier);
}
export const buildDamSkyline = (o) => buildDamLevel(o, 'skyline');
export const buildDamDistrict = (o) => buildDamLevel(o, 'district');
export const buildDamStreet = (o) => buildDamLevel(o, 'street');
export const buildDamCloseup = (o) => buildDamLevel(o, 'closeup');

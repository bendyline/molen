/** Surviving Robben Island maximum-security prison: mapped compound and photo-derived exteriors. */
import './install-deterministic-math.mjs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { B, landmarkSurfaces, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const ref = 'palette:#ffffff';
// Independent terrain controls sampled from terrain-grid.json; never fitted to the model.
const terrainControls = [
  [
    7.2933, 7.876, 7.8749, 7.6538, 7.3442, 6.7476, 6.2023, 5.6843, 5.6394, 5.5592, 5.2664, 5.0363,
    5.0,
  ],
  [
    5.7394, 5.736, 6.3854, 6.5101, 6.1987, 5.9437, 4.7453, 4.0569, 4.2984, 4.449, 4.072, 3.7655,
    4.5741,
  ],
  [5.0, 5.1643, 5.1238, 5.0328, 5.1886, 5.017, 5.0, 4.1827, 4.0, 4.0, 3.5295, 3.0, 3.7318],
  [4.7761, 4.0439, 4.1082, 4.5168, 4.9977, 4.2774, 4.659, 4.0, 4.0, 4.1562, 4.448, 3.9943, 4.3973],
  [
    4.0539, 3.8238, 3.9923, 3.8596, 3.6043, 3.2514, 3.9768, 4.0, 4.0182, 5.0654, 5.4878, 5.2714,
    5.0,
  ],
  [4.0, 2.8665, 2.4856, 2.137, 2.0, 2.7598, 3.3279, 4.0, 4.5367, 5.2519, 5.9893, 6.0, 5.7868],
  [2.4061, 1.965, 1.0091, 1.8471, 2.0388, 2.9534, 3.6984, 4.0, 4.2435, 5.8499, 6.0, 5.6646, 5.2618],
  [
    1.7019, 1.2003, 0.8818, 1.1616, 1.2677, 2.1737, 3.6212, 3.989, 4.0615, 5.082, 5.8274, 5.5356,
    5.0,
  ],
  [1.0, 0.9991, 0.172, 0.371, 1.0141, 1.9996, 2.9947, 3.058, 3.0672, 3.8518, 4.8692, 5.0, 5.0],
  [0.1651, 1.0, 0.9957, 0.9846, 0.989, 1.1319, 2.7362, 3.0, 3.3577, 3.9984, 4.6483, 5.0, 5.0],
  [
    -0.3614, 0.9976, 1.0, 0.9283, 0.0443, 0.6647, 1.6726, 3.3339, 4.491, 4.8421, 5.292, 5.3198,
    5.497,
  ],
  [
    -0.2314, 0.9137, 0.9985, 0.2259, 0.002, 0.7202, 2.0096, 3.2761, 4.0606, 4.7243, 5.1081, 5.9993,
    6.0008,
  ],
  [-0.937, -0.1754, 0.4553, 0.0, 0.0, 0.3839, 1.6094, 2.756, 3.5624, 4.2568, 4.9905, 5.3642, 6.0],
];
function terrainBase(x, z) {
  const u = Math.max(0, Math.min(11.9999, (x + 140) / 25)),
    v = Math.max(0, Math.min(11.9999, (z + 125) / 25));
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    h = terrainControls;
  return (
    h[j][i] * (1 - a) * (1 - b) +
    h[j][i + 1] * a * (1 - b) +
    h[j + 1][i] * (1 - a) * b +
    h[j + 1][i + 1] * a * b
  );
}

const slate = rgb('667170'),
  mortar = rgb('a3a49a'),
  white = rgb('dcded4'),
  roof = rgb('c5c8be'),
  dark = rgb('263e45'),
  red = rgb('84524c'),
  concrete = rgb('9b9f95'),
  iron = rgb('929b8e');
function at(o, x, z, a = 0, base = 0) {
  const co = Math.cos(a),
    si = Math.sin(a),
    p = (v) => [x + co * v[0] + si * v[2], v[1] + base, z - si * v[0] + co * v[2]],
    n = (v) => [co * v[0] + si * v[2], v[1], -si * v[0] + co * v[2]];
  return {
    addTriangle: (s, r, v, nm, u, c) => o.addTriangle(s, r, v.map(p), n(nm), u, c),
    addQuad: (s, r, v, nm, u, c) => o.addQuad(s, r, v.map(p), n(nm), u, c),
    addConvexPolygon: (s, r, v, nm, u, c) => {
      const ps = v.map(p),
        uv = v.map(u);
      return o.addConvexPolygon(s, r, ps, n(nm), (v) => uv[ps.indexOf(v)], c);
    },
  };
}
function face(o, s, x, y, z, w, h, c, n = 1) {
  quad(
    o,
    s,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, n],
    c,
  );
}
function window(o, x, z, y, w, h, d, frame = white) {
  face(o, 'glass', x, y, z, w, h, dark);
  if (!d) return;
  face(o, 'metal', x - w / 2 - 0.035, y - 0.04, z + 0.025, 0.07, h + 0.08, frame);
  face(o, 'metal', x + w / 2 + 0.035, y - 0.04, z + 0.025, 0.07, h + 0.08, frame);
  face(o, 'metal', x, y + h, z + 0.026, w + 0.14, 0.07, frame);
  face(o, 'metal', x, y - 0.08, z + 0.03, w + 0.18, 0.09, red);
  if (d > 2) {
    for (let i = 1; i <= 4; i++)
      face(o, 'metal', x - w / 2 + (w * i) / 5, y, z + 0.045, 0.035, h, frame);
    for (const v of [0.34, 0.68]) face(o, 'metal', x, y + h * v, z + 0.046, w, 0.03, frame);
  }
}
function masonry(o, w, h, z, d) {
  if (d < 3) return;
  face(o, 'stone', 0, 0, z - 0.004, w, h, mortar);
  const rows = Math.ceil(h / 0.95),
    cols = Math.ceil(w / 3);
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const jitter = (k) => (((k * 29 + j * 17) % 11) - 5) * 0.035;
      const left = -w / 2 + (i * w) / cols + (i ? jitter(i) : 0);
      const right = -w / 2 + ((i + 1) * w) / cols + (i + 1 < cols ? jitter(i + 1) : 0);
      const bottom = (j * h) / rows,
        top = ((j + 1) * h) / rows,
        hh = top - bottom;
      const ps = [
        [left + 0.035, bottom + hh * 0.12, z],
        [left + (right - left) * 0.23, bottom + 0.035, z],
        [right - 0.06, bottom + hh * 0.09, z],
        [right - 0.025, top - hh * 0.2, z],
        [right - (right - left) * 0.22, top - 0.035, z],
        [left + 0.045, top - hh * 0.11, z],
      ];
      const colors = [rgb('586969'), rgb('63716e'), rgb('6e7c75'), rgb('64736e')];
      o.addConvexPolygon('stone', ref, ps, [0, 0, 1], (v) => [v[0], v[1]], colors[(i * 3 + j) % 4]);
    }
}
function gable(o, w, depth, y, rise, d) {
  const W = w / 2 + 0.4,
    D = depth / 2 + 0.4,
    Y = y + 0.08;
  for (const sign of [-1, 1]) {
    quad(
      o,
      'roof',
      [
        [-W, Y, sign * D],
        [W, Y, sign * D],
        [W, Y + rise, 0],
        [-W, Y + rise, 0],
      ],
      [0, D, sign * rise],
      roof,
    );
    if (d)
      quad(
        o,
        'roof',
        [
          [-W, Y - 0.12, sign * D],
          [W, Y - 0.12, sign * D],
          [W, Y + rise - 0.12, 0],
          [-W, Y + rise - 0.12, 0],
        ],
        [0, -D, -sign * rise],
        roof,
      );
    if (d) {
      B(o, 'metal', 0, Y - 0.08, sign * D, w + 0.8, 0.14, 0.16, white);
      if (d > 1) {
        const step = d > 2 ? 0.55 : 3.5;
        for (let x = -W + 0.1; x < W; x += step) {
          quad(
            o,
            'roof',
            [
              [x, Y + 0.018, sign * D],
              [x + 0.045, Y + 0.018, sign * D],
              [x + 0.045, Y + rise + 0.018, 0],
              [x, Y + rise + 0.018, 0],
            ],
            [0, D, sign * rise],
            white,
          );
        }
      }
    }
  }
  for (const sign of [-1, 1]) {
    const p = [
      [(sign * w) / 2, y, -depth / 2],
      [(sign * w) / 2, y, depth / 2],
      [(sign * w) / 2, y + rise, 0],
    ];
    o.addTriangle(
      'stone',
      ref,
      p,
      [sign, 0, 0],
      p.map((v) => [v[2], v[1]]),
      slate,
    );
    if (d > 1)
      for (const s of [-1, 1])
        beam(o, 'metal', [sign * W, Y, s * D], [sign * W, Y + rise, 0], 0.12, 0.14, white);
  }
}
function block(
  o,
  x,
  z,
  w,
  depth,
  d,
  {
    a = 0,
    h = 3.5,
    rise = 1.35,
    whiteTop = false,
    front = true,
    back = true,
    end = true,
    entrance = false,
    y = 0,
    base = terrainBase(x, z),
  } = {},
) {
  const q = at(o, x, z, a, base);
  B(q, 'stone', 0, -1.5 + y, 0, w, h + 1.5, depth, slate);
  if (whiteTop && d) B(q, 'plaster', 0, y + 2.05, 0, w + 0.015, h - 2.05, depth + 0.015, white);
  gable(q, w, depth, h + y, rise, d);
  for (const sign of [-1, 1]) {
    const f = at(q, 0, 0, sign === 1 ? 0 : Math.PI);
    masonry(f, w, whiteTop ? 2.05 : h, depth / 2 + 0.015, d);
    if (!(sign === 1 ? front : back) || !d) continue;
    const count = Math.max(1, Math.round((w - 2) / 3.3));
    const positions =
      entrance && sign === 1
        ? [-17, -14, -11, -8, 0, 3, 6, 9, 12, 15, 18]
        : Array.from({ length: count }, (_, i) => -w / 2 + ((i + 0.5) * w) / count);
    for (const xx of positions) {
      window(
        f,
        xx,
        depth / 2 + 0.06,
        1.45 + y,
        whiteTop ? 0.8 : 1.35,
        whiteTop ? 1.05 : 1.35,
        d > 1 ? d : 0,
        entrance ? red : white,
      );
    }
    if (d > 1)
      for (const xx of [-w / 2 + 0.35, w / 2 - 0.35])
        B(f, 'metal', xx, y, depth / 2 + 0.17, 0.09, h, 0.09, white);
  }
  if (end && d)
    for (const sign of [-1, 1]) {
      const f = at(q, (sign * w) / 2, 0, (sign * Math.PI) / 2);
      masonry(f, depth, whiteTop ? 2.05 : h, 0.015, d);
      for (const xx of [-depth / 3, 0, depth / 3])
        window(f, xx, 0.06, 1.45 + y, 0.9, 1.3, d > 1 ? d : 0);
    }
  if (entrance) {
    B(q, 'plaster', -5, y, depth / 2 + 0.12, 4.4, 2.8, 0.3, white);
    face(q, 'glass', -5, y, depth / 2 + 0.3, 1.6, 2.5, dark);
    B(q, 'roof', -5, 2.85 + y, depth / 2 + 0.4, 4.8, 0.2, 1.1, roof);
    if (d > 1) B(q, 'concrete', -5, -0.08 + y, depth / 2 + 1.1, 5, 0.22, 1.8, concrete);
  }
}
function wall(o, a, b, y, h, d) {
  beam(o, 'concrete', [a[0], y + h / 2, a[1]], [b[0], y + h / 2, b[1]], 0.38, h, concrete);
  if (d > 1) beam(o, 'concrete', [a[0], y + h, a[1]], [b[0], y + h, b[1]], 0.48, 0.13, white);
}
function hBlock(o, cx, cz, d) {
  const base = terrainBase(cx, cz);
  for (const sign of [-1, 1]) block(o, cx + sign * 11.3, cz, 47, 8.6, d, { a: Math.PI / 2, base });
  block(o, cx, cz, 14.1, 15.4, d, { front: false, back: false, end: false, h: 3.5, rise: 1.35 });
  for (const s of [-1, 1]) {
    wall(o, [cx - 7, cz + s * 23.5], [cx + 7, cz + s * 23.5], base, 3.1, d);
    if (d > 1) B(o, 'metal', cx, base, cz + s * 23.55, 1.2, 2.2, 0.12, iron);
  }
  if (d > 1) {
    B(o, 'roof', cx, base + 4.95, cz, 2.8, 0.2, 2.1, white);
    B(o, 'metal', cx, base + 4.7, cz, 2.3, 0.25, 1.6, iron);
  }
}
function tower(output, worldX, worldZ, w, d) {
  const o = at(output, worldX, worldZ, 0, terrainBase(worldX, worldZ)),
    x = 0,
    z = 0;
  B(o, 'stone', x, -1.5, z, w, 8.15, w, slate);
  if (d) B(o, 'concrete', x, 6.65, z, w, 1.2, w, concrete);
  B(o, 'roof', x, 7.85, z, w + 0.9, 0.23, w + 0.9, roof);
  if (d)
    for (let k = 0; k < 4; k++) {
      const f = at(o, x, z, (k * Math.PI) / 2);
      window(f, 0, w / 2 + 0.03, 6.5, w * 0.7, 1.05, d > 1 ? d : 0);
      face(f, 'glass', 0, 3.2, w / 2 + 0.025, 0.5, 0.2, dark);
      if (d > 2) masonry(f, w, 6.45, w / 2 + 0.012, d);
    }
}
function fence(o, a, b, d, offset = 0) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    nx = -dz / len,
    nz = dx / len,
    p = (t, y) => [
      a[0] + dx * t + nx * offset,
      y + terrainBase(a[0] + dx * t + nx * offset, a[1] + dz * t + nz * offset),
      a[1] + dz * t + nz * offset,
    ];
  if (!d) {
    beam(o, 'metal', p(0, 1.7), p(1, 1.7), 0.06, 0.06, iron);
    return;
  }
  const bays = Math.ceil(len / (d > 2 ? 4 : 12));
  for (let i = 0; i <= bays; i++) {
    const t = i / bays;
    if (d > 1) {
      beam(o, 'metal', p(t, -1.4), p(t, 3.3), 0.09, 0.09, iron);
      beam(
        o,
        'metal',
        p(t, 3.3),
        [p(t, 3.9)[0] + nx * 0.45, p(t, 3.9)[1], p(t, 3.9)[2] + nz * 0.45],
        0.065,
        0.065,
        iron,
      );
    } else {
      const q = p(t, 0);
      quad(
        o,
        'metal',
        [
          [q[0] - 0.055, q[1], q[2]],
          [q[0] + 0.055, q[1], q[2]],
          [q[0] + 0.055, q[1] + 3.8, q[2]],
          [q[0] - 0.055, q[1] + 3.8, q[2]],
        ],
        [0, 0, 1],
        iron,
      );
    }
  }
  for (const y of d > 2 ? [0.5, 1, 1.5, 2, 2.5, 3, 3.65] : [1, 2.2, 3.3])
    for (let i = 0; i < (d > 2 ? 8 : d > 1 ? 2 : 1); i++) {
      const steps = d > 2 ? 8 : d > 1 ? 2 : 1;
      beam(o, 'metal', p(i / steps, y), p((i + 1) / steps, y), 0.025, 0.025, iron);
    }
  if (d > 2)
    for (let i = 0; i < bays; i += 2) {
      const aa = p((i + 0.1) / bays, 0.4),
        bb = p((i + 0.9) / bays, 3.05);
      beam(o, 'metal', aa, bb, 0.018, 0.018, iron);
      beam(o, 'metal', p((i + 0.1) / bays, 3.05), p((i + 0.9) / bays, 0.4), 0.018, 0.018, iron);
    }
}
function prison(o, _frame, d = 3) {
  for (const [x, z] of [
    [10, -18.3],
    [-35, 20.4],
    [9.8, 58.1],
    [-79.7, -18.5],
  ])
    hBlock(o, x, z, d);
  // Main U-shaped prison group: open court spaces retained between low gabled bars.
  block(o, -54.7, 95.2, 139, 9.6, d, { whiteTop: true });
  block(o, 10, 111.4, 32.2, 9.6, d, { a: Math.PI / 2, whiteTop: true });
  block(o, -91.3, 111, 32, 9.7, d, { a: Math.PI / 2, whiteTop: true });
  block(o, -37.7, 111.3, 32, 6.3, d, { a: Math.PI / 2, whiteTop: true });
  block(o, -10.8, 111.5, 32, 10.6, d, { a: Math.PI / 2, whiteTop: true });
  block(o, -40.7, 127.2, 110.6, 9.5, d, { whiteTop: true });
  // The separately projecting reception has the eleven red-framed windows in the dated entrance image.
  block(o, -31.1, 141.4, 39.5, 12.8, d, { h: 3.7, rise: 1.5, entrance: true });
  block(o, 3.6, 141.6, 26.8, 13, d, { h: 3.5, rise: 1.4, whiteTop: true });
  block(o, -79.8, 138.7, 31, 6.6, d, { h: 3.0, rise: 0.8, whiteTop: true });
  // Kitchen group and dining hall to the southwest.
  block(o, -33.4, -66.8, 27, 10.2, d, { h: 3.6, rise: 1.3 });
  block(o, -33.3, -86.1, 27, 9, d, { h: 3.6, rise: 1.2 });
  for (const x of [-41.8, -24.7])
    block(o, x, -76.8, 10.2, 8.8, d, {
      a: Math.PI / 2,
      h: 3.6,
      rise: 1.2,
      front: false,
      back: false,
    });
  block(o, -75.4, -72.3, 40.2, 17.2, d, { h: 4.2, rise: 2.05 });
  block(o, -15.3, -86.7, 6, 6.8, d, { h: 2.8, rise: 0.7 });
  block(o, -34.2, -49.1, 3.8, 4.1, d, { h: 2.5, rise: 0.5 });
  block(o, 58.7, 145.5, 13.8, 7.1, d, { h: 2.7, rise: 0.7, whiteTop: true });
  for (const [x, z, w] of [
    [52.5, -93.4, 4.3],
    [-104.6, -106.6, 3.7],
    [132.2, -104.9, 3.8],
    [-106.1, 147.6, 4.5],
    [103.5, 151.5, 3.8],
  ])
    tower(o, x, z, w, d);
  const perimeter = [
    [-106, -106],
    [132, -105],
    [103.5, 151.5],
    [18, 151.5],
  ];
  for (let i = 1; i < perimeter.length; i++) fence(o, perimeter[i - 1], perimeter[i], d);
  fence(o, [-106, -106], [-106, 147.6], d);
  fence(o, [-106, 147.6], [-96, 147.6], d);
  if (d > 2) {
    fence(o, [-106, -106], [132, -105], d, 4);
    fence(o, [132, -105], [103.5, 151.5], d, 4);
    fence(o, [-106, -106], [-106, 147.6], d, -4);
  }
  // Local courtyard barriers and kitchen chimneys are separate from the outer fence.
  for (const [a, b] of [
    [
      [-96, 50],
      [-96, 87],
    ],
    [
      [26, 7],
      [26, 31],
    ],
    [
      [-18, -44],
      [-18, -59],
    ],
    [
      [-49, -45],
      [-49, -59],
    ],
  ])
    wall(o, a, b, terrainBase((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), 3.2, d);
  for (const x of [-39, -28]) {
    loft(
      o,
      'metal',
      [
        radialRing(9.6, 0.45, 0.45, d > 1 ? 12 : 6, [x, -67]),
        radialRing(13, 0.42, 0.42, d > 1 ? 12 : 6, [x, -67]),
      ],
      rgb('797f77'),
    );
  }
  if (d > 1) {
    for (const x of [-44, -39, -34]) B(o, 'roof', x, 9.2, -66, 1.4, 0.45, 2.1, white);
    B(o, 'metal', -36.1, 0, 150, 0.08, 9.4, 0.08, white);
    B(o, 'metal', -6, 0, 157, 0.13, 7.2, 0.13, iron);
    B(o, 'metal', -6, 7.1, 157, 0.5, 0.35, 0.38, white);
    // Short entrance approach; the terrain and lawns are not flattened into a large podium.
    B(o, 'concrete', -36.1, -0.08, 153, 3.5, 0.13, 7, concrete);
  }
}
export function robbenPrisonSkyline(o) {
  prison(o, undefined, 0);
}
export function robbenPrisonDistrict(o) {
  prison(o, undefined, 1);
}
export function robbenPrisonStreet(o) {
  prison(o, undefined, 2);
}
const surfaces = {
  stone: { ...landmarkSurfaces.stone, slot: 'wall', graph: 'stone_basalt' },
  plaster: { ...landmarkSurfaces.stone, slot: 'wall', graph: 'plaster_lime' },
  roof: { ...landmarkSurfaces.roof, graph: 'metal_corrugated', metallic: 0, roughness: 0.94 },
  concrete: { ...landmarkSurfaces.concrete },
  metal: { ...landmarkSurfaces.metal },
  glass: { ...landmarkSurfaces.glass, localRef: ref },
};
export const robbenPrisonModel = {
  id: 'robben_island_prison',
  recipe: 'structure-robben-island-prison.mjs',
  key: 'robben_island_prison',
  cell: 'k3/k3v',
  title: 'Robben Island maximum-security prison',
  brief:
    'Mapped four H-blocks, open isolation courts, blue-stone entrance, light corrugated roofs, service buildings, five watchtowers and the surrounding fence.',
  camera: [240, 200, 330],
  lookAt: [0, 0, 20],
  qaCameras: [
    { name: 'front', position: [-30, 30, 250], lookAt: [-30, 3, 110] },
    { name: 'back', position: [-220, 120, -240], lookAt: [0, 0, 10] },
  ],
  build: prison,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  mediumFiContext: { scale: 1.4 },
  groundContactBasis:
    'Main entrance approach at [-38,151]; independent source terrain remains unchanged.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-robben-island-prison.mjs',
    level: 'skyline',
    export: 'robbenPrisonSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'robbenPrisonDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'robbenPrisonStreet', errorMeters: 0.2, surfaces },
    },
  },
  limitations: [
    'Original medium-fi surviving museum exterior, based on individually inspected 2010–2018 Qualla photographs and mapped footprints; not a site survey.',
    'Four H-blocks, main open courtyards, service buildings and five watchtowers retain their mapped layout. Main roof segmentation, smaller courtyard walls and hidden facade details are interpretations.',
    'Heights, window spacing beyond the photographed entrance and B-section, fence bays and rooftop equipment are photographic estimates. Irregular blue-stone cladding is generalized using authored polygons and shared basalt.',
    'Roof uses a matte corrugated shared surface to represent the observed pale cement sheets; it is not evidence that the original roof is metal.',
    'Kramat, graveyard, other prisons, interiors, exhibits, furnishings and vegetation are excluded. No reference-image pixels are embedded.',
    'Independent terrain is preserved. Whole blocks and towers use fixed locally sampled floor elevations; fences follow the sampled slope. These inferred levels are not a survey, and exact ground contact can differ on another host elevation dataset.',
  ],
};

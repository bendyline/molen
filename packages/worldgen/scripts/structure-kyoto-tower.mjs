/** Kyoto's smooth white shell and two-tier red cage on its actual nine-storey hotel podium. */
import './install-deterministic-math.mjs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';
import { quad } from './structure-mesh.mjs';

const tau = Math.PI * 2,
  white = rgb('e7e6dc'),
  red = rgb('cb4f32'),
  brown = rgb('5f5148'),
  beige = rgb('b3ac98'),
  glass = rgb('788d91'),
  steel = rgb('839b9c'),
  dark = rgb('454e50'),
  roof = rgb('b8b8a7'),
  concrete = rgb('a7a69c');
const outline = [
  [26.0523, -18.59129],
  [26.0523, 19.08057],
  [19.44749, 25.6854],
  [-26.78616, 25.6854],
  [-27.03079, -18.59129],
].reverse();
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
function face(o, slot, x, y, z, w, h, c) {
  quad(
    o,
    slot,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    c,
  );
}
function polygon(o, slot, ring, y0, y1, c) {
  loft(o, slot, [ring.map(([x, z]) => [x, y0, z]), ring.map(([x, z]) => [x, y1, z])], c);
}
function round(o, slot, levels, n, c, cap = true) {
  loft(
    o,
    slot,
    levels.map(([y, r]) => radialRing(y, r, r, n)),
    c,
    { cap },
  );
}
const floors = [0.1, 4.5, 8.2, 11.8, 15, 18.2, 21.4, 24.6, 27.8, 30.8];
function hotel(o, d) {
  polygon(o, 'wall', outline, -0.8, 0.1, concrete);
  polygon(
    o,
    'wall',
    outline.map(([x, z]) => [x * 0.97, 3.5 + (z - 3.5) * 0.97]),
    0.1,
    30.8,
    brown,
  );
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      angle = Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
      q = facing(o, angle, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
      south = i === 1;
    if (d < 2)
      for (const sign of [-1, 1])
        face(q, 'wall', sign * (len / 2 - 0.15), 0.1, 0.002, 0.3, 30.7, beige);
    for (let row = 0; row < 9; row++) {
      const y = floors[row],
        hi = floors[row + 1],
        band = row < 2 ? rgb('c5c6bf') : brown,
        lo = y + (row < 3 ? 0.65 : 0.62),
        top = hi - 0.56,
        depth = d === 0 ? 0.02 : 0.18,
        entry = row === 0 && south && d > 0,
        doorX = 13.7,
        left = doorX - 1.5,
        right = doorX + 1.5;
      const span = (slot, x0, x1, yy, z, h, c) => {
        if (x1 > x0) face(q, slot, (x0 + x1) / 2, yy, z, x1 - x0, h, c);
      };
      if (entry) {
        span('wall', -len / 2, left, y, 0, lo - y, band);
        span('wall', right, len / 2, y, 0, lo - y, band);
      } else face(q, 'wall', 0, y, 0, len, lo - y, band);
      face(q, 'wall', 0, top, 0, len, hi - top, band);
      if (d > 1)
        for (const sign of [-1, 1])
          B(q, 'wall', sign * (len / 2 - 0.15), lo, -0.1, 0.3, top - lo, 0.2, beige);
      const glaze = (x0, x1) => {
        const count =
            d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 3 : Math.max(1, Math.floor((x1 - x0) / 1.7)),
          colours = [glass, rgb('82969b'), rgb('a4aaa2'), rgb('6e858a'), rgb('a9aa9e')];
        for (let j = 0; j < count; j++) {
          const l = x0 + ((x1 - x0) * j) / count,
            r = x0 + ((x1 - x0) * (j + 1)) / count;
          span(
            'glass',
            l,
            r,
            lo,
            -depth,
            top - lo,
            row > 2 && d > 0 ? colours[(j * 3 + row * 2 + i) % colours.length] : glass,
          );
        }
      };
      if (entry) {
        glaze(-len / 2 + 0.3, left);
        glaze(right, len / 2 - 0.3);
        span('wall', left, right, 3.4, 0, top - 3.4, band);
      } else glaze(-len / 2 + 0.3, len / 2 - 0.3);
      if (d > 0) {
        for (const [x0, x1] of entry
          ? [
              [-len / 2 + 0.3, left],
              [right, len / 2 - 0.3],
            ]
          : [[-len / 2 + 0.3, len / 2 - 0.3]])
          quad(
            q,
            'wall',
            [
              [x0, lo, 0],
              [x1, lo, 0],
              [x1, lo, -depth],
              [x0, lo, -depth],
            ],
            [0, 1, 0],
            beige,
          );
        quad(
          q,
          'wall',
          [
            [-len / 2 + 0.3, top, -depth],
            [len / 2 - 0.3, top, -depth],
            [len / 2 - 0.3, top, 0],
            [-len / 2 + 0.3, top, 0],
          ],
          [0, -1, 0],
          band,
        );
      }
      const count = d === 0 ? 0 : Math.max(1, Math.floor(len / (d === 1 ? 5.6 : 1.7)));
      for (let j = 1; j < count; j++) {
        const x = -len / 2 + (j * len) / count;
        if (entry && Math.abs(x - doorX) < 1.7) continue;
        if (d === 3) {
          B(q, 'metal', x, lo, -depth + 0.025, 0.055, top - lo, 0.06, steel);
          if (row > 2)
            B(
              q,
              'metal',
              x + (len / count) * 0.48,
              lo,
              -depth + 0.025,
              0.035,
              top - lo,
              0.04,
              steel,
            );
        } else face(q, 'metal', x, lo, -depth + 0.025, 0.045, top - lo, steel);
      }
      if (d > 1) {
        const yy = lo + (top - lo) * 0.72;
        if (entry) {
          span('metal', -len / 2 + 0.3, left, yy, -depth + 0.03, 0.045, steel);
          span('metal', right, len / 2 - 0.3, yy, -depth + 0.03, 0.045, steel);
        } else face(q, 'metal', 0, yy, -depth + 0.03, len - 0.6, 0.045, steel);
      }
      if (d > 0) {
        if (entry) {
          span('wall', -len / 2, left, y + 0.06, 0.035, 0.14, band);
          span('wall', right, len / 2, y + 0.06, 0.035, 0.14, band);
        } else face(q, 'wall', 0, y + 0.06, 0.035, len, 0.14, band);
        if (row > 2) face(q, 'metal', 0, hi - 0.15, 0.04, len, 0.045, beige);
      }
      if (entry) {
        B(q, 'wall', doorX, 0.1, -0.09, 3, 0.1, 0.3, beige);
        face(q, 'glass', doorX, 0.2, -0.28, 2.7, 3.2, dark);
        for (const x of [doorX - 1.44, doorX + 1.44])
          B(q, 'wall', x, 0.2, -0.14, 0.12, 3.2, 0.28, beige);
        B(q, 'metal', doorX, 0.2, -0.22, 0.065, 3.2, 0.08, steel);
        B(q, 'wall', doorX, 3.4, -0.14, 3, 0.12, 0.28, beige);
        B(q, 'metal', doorX, 3.6, 0.45, 4, 0.14, 1.1, beige);
        B(q, 'wall', doorX, 0.02, 0.35, 3.3, 0.17, 0.9, concrete);
      }
    }
  }
  polygon(o, 'wall', outline, 30.62, 30.9, brown);
  for (const [x, z, w, depth] of [
    [-3, 17, 42, 14],
    [21, 3, 6, 30],
  ])
    quad(
      o,
      'roof',
      [
        [x - w / 2, 30.94, z + depth / 2],
        [x + w / 2, 30.94, z + depth / 2],
        [x + w / 2, 30.94, z - depth / 2],
        [x - w / 2, 30.94, z - depth / 2],
      ],
      [0, 1, 0],
      roof,
    );
  if (d > 0) {
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length],
        n = d === 1 ? 1 : Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (d === 2 ? 6 : 2.0));
      beam(o, 'metal', [a[0], 32, a[1]], [b[0], 32, b[1]], 0.07, 0.07, steel);
      for (let j = 0; j <= n; j++) {
        const t = j / n,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        beam(o, 'metal', [x, 30.95, z], [x, 32, z], 0.055, 0.055, steel);
      }
    }
    for (const [x, z, w, h, dep] of [
      [-19, -8, 9, 3.2, 12],
      [-17, 9, 7, 1.8, 7],
      [14, -12, 8, 2.8, 8],
      [-5, -14, 7, 1.5, 5],
    ]) {
      B(o, 'wall', x, 30.95, z, w, h, dep, beige);
      if (d > 1)
        for (let k = 0; k < 4; k++)
          face(
            facing(o, 0, x, z + dep / 2 + 0.01),
            'metal',
            0,
            31.3 + k * 0.28,
            0,
            w - 0.6,
            0.055,
            steel,
          );
    }
  }
}
function cage(o, d) {
  const n = d === 0 ? 8 : d === 1 ? 16 : d === 2 ? 32 : 64;
  round(
    o,
    'metal',
    [
      [97, 2.55],
      [98.2, 4.6],
    ],
    n,
    red,
  );
  round(
    o,
    'glass',
    [
      [98.2, 4.6],
      [100.5, 4.9],
    ],
    n,
    glass,
    false,
  );
  round(
    o,
    'metal',
    [
      [100.5, 4.9],
      [103, 7.05],
    ],
    n,
    white,
  );
  round(
    o,
    'glass',
    [
      [103, 7.05],
      [105.4, 7.05],
    ],
    n,
    glass,
    false,
  );
  round(
    o,
    'metal',
    [
      [105.4, 7.05],
      [106, 6.4],
    ],
    n,
    red,
  );
  const ribs = d === 0 ? 8 : d === 1 ? 16 : 32,
    controlProfile = [
      [97.3, 3.0],
      [98, 5.0],
      [100, 7.5],
      [102, 8.65],
      [104, 8.4],
      [105.6, 7.3],
    ];
  const profile =
    d < 2
      ? controlProfile
      : Array.from({ length: d === 2 ? 10 : 21 }, (_, k) => {
          const y = 97.3 + (k / (d === 2 ? 9 : 20)) * (105.6 - 97.3);
          let i = 1;
          while (i < controlProfile.length - 1 && controlProfile[i][0] < y) i++;
          const a = controlProfile[i - 1],
            b = controlProfile[i],
            prev = controlProfile[Math.max(0, i - 2)],
            next = controlProfile[Math.min(controlProfile.length - 1, i + 1)],
            dy = b[0] - a[0],
            t = (y - a[0]) / dy,
            m0 = (b[1] - prev[1]) / (b[0] - prev[0]),
            m1 = (next[1] - a[1]) / (next[0] - a[0]),
            r =
              (2 * t * t * t - 3 * t * t + 1) * a[1] +
              (t * t * t - 2 * t * t + t) * dy * m0 +
              (-2 * t * t * t + 3 * t * t) * b[1] +
              (t * t * t - t * t) * dy * m1;
          return [y, r];
        });
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * tau,
      q = facing(o, a);
    for (let j = 1; j < profile.length; j++) {
      const p = ([y, r]) => [0, y, r];
      if (d < 2) {
        const aa = p(profile[j - 1]),
          bb = p(profile[j]);
        const pp = [
          [-0.09, aa[1], aa[2]],
          [0.09, aa[1], aa[2]],
          [0.09, bb[1], bb[2]],
          [-0.09, bb[1], bb[2]],
        ];
        quad(q, 'metal', pp, normalFor(...pp), red);
      } else beam(q, 'metal', p(profile[j - 1]), p(profile[j]), 0.17, 0.11, red);
    }
    if (d > 0) {
      for (const [y0, y1, r] of [
        [98.3, 100.45, 4.78],
        [103.03, 105.35, 7.08],
      ]) {
        beam(q, 'metal', [0, y0, r], [0, y1, r], 0.06, 0.07, steel);
        if (d > 1) {
          B(q, 'metal', 0, y0 + 0.2, r, 0.5, 0.05, 0.11, steel);
          B(q, 'metal', 0, y1 - 0.48, r, 0.7, 0.05, 0.1, steel);
        }
      }
    }
  }
  for (const [y, r] of [
    [100, 7.5],
    [102, 8.65],
    [104, 8.4],
    [105.6, 7.3],
  ]) {
    if (d < 2)
      round(
        o,
        'metal',
        [
          [y - 0.055, r],
          [y + 0.055, r],
        ],
        n,
        red,
        false,
      );
    else torus(o, 'metal', [0, y, 0], r, 0.07, red, d === 2 ? 32 : 64, 4);
  }
  if (d > 1) {
    for (const [y, r] of [
      [98.25, 4.64],
      [100.45, 4.9],
      [103.05, 7.1],
      [105.35, 7.1],
    ]) {
      round(
        o,
        'metal',
        [
          [y - 0.035, r],
          [y + 0.035, r],
        ],
        n,
        steel,
        false,
      );
    }
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * tau,
        q = facing(o, a);
      beam(q, 'metal', [0, 100.55, 5.05], [0, 102.9, 6.95], 0.055, 0.065, white);
      if (d === 3)
        for (const [y, r] of [
          [98.3, 4.92],
          [103.1, 7.3],
        ]) {
          B(q, 'metal', 0, y, r, 0.6, 0.35, 0.04, steel);
          for (let j = 0; j < 5; j++)
            face(q, 'metal', (j - 2) * 0.11, y + 0.05, r + 0.025, 0.025, 0.25, dark);
        }
    }
  }
}
const shaftProfile = [
  [46.6, 5.0],
  [48, 4.4],
  [50, 3.8],
  [54, 3.25],
  [60, 2.9],
  [70, 2.7],
  [82, 2.6],
  [97, 2.55],
];
const shaftRadius = (y) => {
  let i = 1;
  while (i < shaftProfile.length - 1 && shaftProfile[i][0] < y) i++;
  const a = shaftProfile[i - 1],
    b = shaftProfile[i];
  return a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
};
function tower(o, d) {
  const n = d === 0 ? 8 : d === 1 ? 16 : d === 2 ? 48 : 96;
  round(
    o,
    'metal',
    [
      [30.9, 7.8],
      [34.6, 7.8],
    ],
    n,
    beige,
  );
  round(
    o,
    'glass',
    [
      [34.6, 6.2],
      [38, 6.2],
    ],
    n,
    glass,
    false,
  );
  round(
    o,
    'glass',
    [
      [38, 6.2],
      [46.6, 12.5],
    ],
    n,
    rgb('6b8084'),
  );
  round(
    o,
    'metal',
    [
      [46.6, 12.6],
      [46.9, 12.6],
    ],
    n,
    brown,
  );
  if (d > 0) {
    const ribs = d === 1 ? 16 : 32;
    for (let i = 0; i < ribs; i++) {
      const a = (i / ribs) * tau;
      beam(
        o,
        'metal',
        [Math.sin(a) * 6.22, 38, Math.cos(a) * 6.22],
        [Math.sin(a) * 12.53, 46.6, Math.cos(a) * 12.53],
        0.09,
        0.12,
        steel,
      );
    }
    for (const y of [40.8, 43.6]) {
      const r = 6.2 + ((y - 38) / 8.6) * 6.3;
      round(
        o,
        'metal',
        [
          [y - 0.045, r],
          [y + 0.045, r],
        ],
        n,
        steel,
        false,
      );
    }
  }
  round(o, 'metal', shaftProfile, n, white);
  if (d === 3) {
    for (let y = 50; y < 97; y += 4) {
      const r = shaftRadius(y) + 0.005;
      round(
        o,
        'metal',
        [
          [y, r],
          [y + 0.01, r],
        ],
        n,
        rgb('d5d7d1'),
        false,
      );
      for (const a of [0, Math.PI]) {
        const q = facing(o, a);
        B(q, 'metal', 0, y - 0.06, r + 0.02, 0.18, 0.12, 0.2, white);
      }
    }
  }
  cage(o, d);
  round(
    o,
    'metal',
    [
      [106, 2.55],
      [113.9, 2.4],
      [114.5, 2.15],
    ],
    n,
    white,
  );
  // Both cleared Qualla and CC0 station views show flat-faced red/white mast panels.
  for (const [levels, colour] of [
    [
      [
        [114.5, 1.1],
        [118.5, 1.08],
      ],
      red,
    ],
    [
      [
        [118.5, 1.08],
        [122, 1.0],
      ],
      white,
    ],
    [
      [
        [122, 1.05],
        [122.3, 1.05],
        [123, 0.3],
      ],
      red,
    ],
  ])
    loft(
      o,
      'metal',
      levels.map(([y, halfWidth]) =>
        radialRing(y, halfWidth * Math.SQRT2, halfWidth * Math.SQRT2, 4, [0, 0], Math.PI / 4),
      ),
      colour,
    );
  round(
    o,
    'metal',
    [
      [123, 0.09],
      [130.85, 0.055],
      [131, 0.015],
    ],
    d < 2 ? 4 : 8,
    white,
  );
  if (d > 1) {
    const q = facing(o, Math.PI);
    for (const x of [-0.33, 0.33]) B(q, 'metal', x, 106, 2.61, 0.045, 8.1, 0.05, steel);
    for (let j = 0; j < 24; j++) B(q, 'metal', 0, 106 + j * 0.33, 2.64, 0.7, 0.025, 0.05, steel);
    if (d === 3)
      for (let y = 107; y < 114; y += 1.3) {
        const pts = Array.from({ length: 9 }, (_, j) => [
          0.48 * Math.cos((j / 8) * Math.PI),
          y,
          2.65 + 0.48 * Math.sin((j / 8) * Math.PI),
        ]);
        for (let j = 1; j < pts.length; j++)
          beam(q, 'metal', pts[j - 1], pts[j], 0.025, 0.025, steel);
      }
  }
}
export function kyotoTower(o, _frame, d = 3) {
  hotel(o, d);
  tower(o, d);
}
export const kyotoTowerSkyline = (o) => kyotoTower(o, undefined, 0);
export const kyotoTowerDistrict = (o) => kyotoTower(o, undefined, 1);
export const kyotoTowerStreet = (o) => kyotoTower(o, undefined, 2);
const surfaces = {
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.15 },
  wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.9, metallic: 0 },
  roof: { slot: 'roof', graph: 'membrane', roughness: 0.92, metallic: 0 },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.3, metallic: 0.08 },
};
export const kyotoTowerModel = {
  id: 'kyoto_tower',
  key: 'kyoto_tower',
  recipe: 'structure-kyoto-tower.mjs',
  cell: 'xn/xn0',
  title: 'Kyoto Tower',
  brief:
    'Smooth white candle/lighthouse shell with orange-red two-tier glazed observation cage, white upper service drum and flat-faced banded antenna, inverted dark lower bowl, actual nine-storey hotel/commercial podium with light lower frontage, dark upper bands, southeast chamfer, window belts and own roof/service blocks. Neighbor buildings and Kyoto Station fixtures excluded.',
  camera: [-85, 66, 138],
  lookAt: [0, 55, 0],
  qaCameras: [
    { name: 'front', position: [0, 65, 270], lookAt: [0, 61, 0] },
    { name: 'front-detail', position: [-17, 105, 29], lookAt: [0, 102, 0] },
    { name: 'back', position: [153, 82, -220], lookAt: [0, 60, 0] },
    { name: 'base-detail', position: [45, 23, 63], lookAt: [2, 16, 4] },
    { name: 'bowl-detail', position: [-18, 48, 30], lookAt: [0, 42, 0] },
  ],
  mediumFiContext: { scale: 1.2 },
  build: kyotoTower,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Dry south sidewalk[10,28.5] establishes independent GSI1A datum28.2078m; all16641 samples valid, three retained original tiles include checked unused5A fallback. Native mapped footprint spans-.131..+.402m. Own foundation reaches-.8m; south entry threshold+.2m clears unchanged approach, while upper window belts clear grade on the rising rear side. Actual mapped podium/tower axis and southeast chamfer reviewed as a bounded preview. Footprint replacement disabled.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-kyoto-tower.mjs',
    level: 'skyline',
    export: 'kyotoTowerSkyline',
    errorMeters: 1.5,
    surfaces,
    authoredLevels: {
      district: { export: 'kyotoTowerDistrict', errorMeters: 0.5, surfaces },
      street: { export: 'kyotoTowerStreet', errorMeters: 0.15, surfaces },
    },
  },
  limitations: [
    'Started with two cleared published Qualla2011 creator-CC0 originals; independently verified creator-CC0 Brakeet2019 tower/hotel and Mr.ちゅらさん2024 exterior photographs fill missing coverage. Earlier attribution-licensed and aerial imagery are excluded from current approval. White shaft remains white; temporary coloured lighting is not baked into materials. Own supporting hotel/commercial podium included; separate buildings, station canopies/trees/signs and interiors excluded. No photographic pixels redistributed.',
    'Mapped30.8m podium and height-coded tower parts plus primary131m total/100m observation guide vertical hierarchy. Smooth shaft profile, cage-rib count/gauges, window divisions, rear facades, roof/mechanical details and entrance positions remain original medium-fi estimates, not surveyed construction geometry. Small signs/branding and roof furniture omitted.',
    'Independent original GSI1A terrain retained unchanged with all16641 valid source samples. Own foundation/south entrance contact reviewed as a bounded preview; other host terrain remains unverified and footprint replacement disabled.',
  ],
};

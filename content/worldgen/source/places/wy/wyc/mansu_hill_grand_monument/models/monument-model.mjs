/** The Mansu Hill bronze pair, stone banners and museum backdrop. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  cross,
  loft,
  normalFor,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.56, metallic: 0.52 },
  flag: { slot: 'wall', graph: 'stone_granite', roughness: 0.84 },
  paving: { slot: 'foundation', graph: 'stone_granite', roughness: 0.89 },
  wall: { slot: 'wall', graph: 'stone_marble', roughness: 0.78 },
};
const palette = {
  bronze: '956647',
  highlight: 'ac7a53',
  crease: '674936',
  hair: '6e503b',
  shoe: '79543c',
  group: '80614a',
  granite: 'bfc0b7',
  step: 'a9aba1',
  cap: 'c9cbc3',
  flag: 'a08077',
  flagDark: '846761',
  flagLight: 'a68b80',
  rock: '6a5c4e',
  wall: 'b9c1be',
  wallDark: '9da7a9',
  trim: 'ced0c9',
  slit: '515c5d',
  roof: 'aaaead',
  sky: 'cda58a',
  ridge: '8b9e9c',
  snow: 'd9ddd0',
  ice: 'b2c2be',
  shade: '879c9a',
  rockBlue: '687e80',
  water: '9daead',
};
const color = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((h) => {
      const s = parseInt(h, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const up = [0, 1, 0],
  front = [0, 0, 1],
  tau = Math.PI * 2,
  lerp = (a, b, t) => a + (b - a) * t;
const plus = (a, b) => a.map((v, i) => v + b[i]),
  minus = (a, b) => a.map((v, i) => v - b[i]);
const lift = ([x, z], y) => [x, y, z];
function triangle(out, slot, tint, p, want) {
  let n = normalFor(...p);
  if (Math.hypot(...n) < 0.99) return;
  if (n.reduce((s, v, i) => s + v * want[i], 0) < 0) {
    p = p.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', p, n, undefined, color[tint]);
}
function face(out, slot, tint, p, want) {
  triangle(out, slot, tint, [p[0], p[1], p[2]], want);
  triangle(out, slot, tint, [p[0], p[2], p[3]], want);
}
function slab(out, slot, tint, x, y, z, width, height, depth) {
  box(out, slot, [x, y, z], [x + width, y + height, z + depth], color[tint]);
}
function polygon(out, slot, tint, ring, y) {
  const indices = earcut(ring.flat(), undefined, 2);
  for (let i = 0; i < indices.length; i += 3)
    triangle(
      out,
      slot,
      tint,
      indices.slice(i, i + 3).map((k) => lift(ring[k], y)),
      up,
    );
}
function walls(out, slot, tint, ring, bottom, top) {
  const sign = Math.sign(
    ring.reduce((sum, [x, z], i) => {
      const [a, b] = ring[(i + 1) % ring.length];
      return sum + x * b - a * z;
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      out,
      slot,
      tint,
      [lift(a, bottom(a)), lift(b, bottom(b)), lift(b, top(b)), lift(a, top(a))],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
  }
}
function grade(x, z) {
  const { origin, step, size, heights } = layout.grade;
  const [u, v] = [x, z].map((n, i) =>
    Math.max(0, Math.min(size[i] - 1.001, (n - origin[i]) / step)),
  );
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * size[0] + i;
  return lerp(
    lerp(heights[k], heights[k + 1], a),
    lerp(heights[k + size[0]], heights[k + size[0] + 1], a),
    b,
  );
}
function meshSkin(out, rings, tint, cap = true) {
  loft(
    {
      addQuad(_slot, _ref, p, n) {
        face(out, 'bronze', tint, p, n);
      },
      addConvexPolygon(...args) {
        out.addConvexPolygon(...args);
      },
    },
    'bronze',
    rings,
    color[tint],
    { cap },
  );
}
function oval(out, origin, rows, sides, tint, fold = 0) {
  const rings = rows.map(([y, x, z, w, d], j) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (-tau * i) / sides,
        wrinkle = 1 + fold * Math.sin(5 * a + 0.65 * j);
      return plus(origin, [x + Math.cos(a) * w * wrinkle, y, z + Math.sin(a) * d * wrinkle]);
    }),
  );
  meshSkin(out, rings, tint);
}
function limb(out, origin, rows, sides, tint) {
  const rings = rows.map(([x, y, z, r, w], j) => {
    const tangent = normalize(
      minus(
        rows[Math.min(rows.length - 1, j + 1)].slice(0, 3),
        rows[Math.max(0, j - 1)].slice(0, 3),
      ),
    );
    const side = normalize(cross(tangent, [0, 0, 1])),
      depth = cross(tangent, side);
    return Array.from({ length: sides }, (_, i) => {
      const a = (tau * i) / sides;
      return plus(
        origin,
        [x, y, z].map((v, k) => v + side[k] * r * Math.cos(a) + depth[k] * w * Math.sin(a)),
      );
    });
  });
  meshSkin(out, rings, tint);
}
function bronzeSphere(out, origin, center, radii, tint, sides, latitudes) {
  sphere(out, 'bronze', plus(origin, center), radii, color[tint], sides, latitudes);
}
function seam(out, origin, vertices, w, tint = 'highlight') {
  beamPath(
    out,
    'bronze',
    vertices.map((p) => plus(origin, p)),
    w,
    w * 0.66,
    color[tint],
  );
}
function podium(out, d) {
  const ring = layout.main.outline;
  polygon(out, 'paving', 'granite', ring, 0.31);
  walls(
    out,
    'paving',
    'step',
    ring,
    ([x, z]) => Math.min(grade(x, z) - 0.25, 0.27),
    () => 0.31,
  );
  for (let i = 0; i < 2; i++) {
    const [x, z] = layout.main.pair[i].point;
    slab(out, 'paving', 'granite', x - 4.85, 0.31, z - 3.6, 9.7, 1.65, 7.2);
    slab(out, 'paving', 'cap', x - 4.62, 1.96, z - 3.43, 9.24, 0.39, 6.86);
    slab(out, 'flag', 'flagDark', x - 3.74, 2.35, z - 2.55, 7.48, 0.46, 5.1);
    if (d >= 2)
      for (let j = 1; j < 5; j++)
        slab(out, 'paving', 'step', x - 4.85 + (9.7 * j) / 5, 0.34, z + 3.6, 0.018, 1.59, 0.013);
  }
}
function faceSculpt(out, o, right, d, sides) {
  const x = right ? -0.19 : 0.12,
    z = 0.2;
  const rows = [
    [18.05, x, z - 0.21, 0.49, 0.47],
    [18.65, x, z - 0.12, 0.73, 0.61],
    [19.06, x, z + 0.13, 0.82, 0.69],
    [19.68, x, z + 0.18, 0.94, 0.82],
    [20.22, x - 0.03, z + 0.15, 0.98, 0.81],
    [20.75, x - 0.05, z, 0.9, 0.79],
    [21.18, x - 0.07, z - 0.13, 0.77, 0.68],
    [21.4, x - 0.05, z - 0.14, 0.5, 0.51],
  ];
  oval(out, o, d === 0 ? rows.filter((_, i) => [0, 2, 4, 7].includes(i)) : rows, sides, 'bronze');
  const hair = right
    ? [
        [20.62, x, z - 0.29, 0.89, 0.69],
        [21.1, x - 0.08, z - 0.12, 0.96, 0.77],
        [21.52, x - 0.13, z - 0.13, 0.9, 0.73],
        [21.9, x - 0.18, z - 0.2, 0.65, 0.54],
        [22.01, x - 0.23, z - 0.26, 0.33, 0.32],
      ]
    : [
        [20.73, x, z - 0.3, 0.89, 0.68],
        [21.14, x, z - 0.2, 0.91, 0.8],
        [21.44, x - 0.1, z - 0.18, 0.82, 0.74],
        [21.57, x - 0.15, z - 0.21, 0.49, 0.5],
      ];
  oval(out, o, d === 0 ? [hair[0], hair.at(-1)] : hair, sides, 'hair', d >= 2 ? 0.034 : 0);
  if (d < 1) return;
  for (const s of [-1, 1])
    bronzeSphere(
      out,
      o,
      [x + s * 0.89, 19.82, z - 0.03],
      [0.23, 0.39, 0.25],
      'bronze',
      d >= 2 ? 8 : 5,
      d >= 2 ? 5 : 3,
    );
  limb(
    out,
    o,
    [
      [x, 19.62, z + 1, 0.18, 0.21],
      [x - 0.03, 19.91, z + 1.02, 0.235, 0.27],
      [x - 0.02, 20.25, z + 0.84, 0.12, 0.14],
    ],
    d >= 2 ? 8 : 5,
    'highlight',
  );
  if (d < 2) return;
  for (const s of [-1, 1]) {
    bronzeSphere(out, o, [x + s * 0.4, 20.17, z + 0.785], [0.26, 0.085, 0.13], 'crease', 10, 5);
    bronzeSphere(out, o, [x + s * 0.42, 19.86, z + 0.74], [0.33, 0.2, 0.19], 'bronze', 10, 6);
    seam(
      out,
      o,
      [
        [x + s * 0.24, 20.38, z + 0.82],
        [x + s * 0.47, 20.42, z + 0.77],
        [x + s * 0.68, 20.31, z + 0.68],
      ],
      0.07,
      'hair',
    );
    if (right) {
      const lens = Array.from({ length: 9 }, (_, i) => {
        const a = (tau * i) / 8;
        return [
          x + s * 0.38 + 0.3 * Math.cos(a),
          20.19 + 0.19 * Math.sin(a),
          z + 0.91 - 0.23 * Math.abs(s * 0.23 + 0.32 * Math.cos(a)),
        ];
      });
      seam(out, o, lens, 0.037, 'hair');
      seam(
        out,
        o,
        [
          [x + s * 0.66, 20.23, z + 0.78],
          [x + s * 0.92, 20.18, z + 0.18],
        ],
        0.039,
        'hair',
      );
    }
  }
  if (right)
    seam(
      out,
      o,
      [
        [x - 0.1, 20.26, z + 0.96],
        [x + 0.1, 20.26, z + 0.96],
      ],
      0.034,
      'hair',
    );
  seam(
    out,
    o,
    [
      [x - 0.41, 19.6, z + 0.78],
      [x - 0.22, 19.46, z + 0.88],
      [x + 0.15, 19.44, z + 0.9],
      [x + 0.37, 19.57, z + 0.78],
    ],
    0.105,
    'crease',
  );
  seam(
    out,
    o,
    [
      [x - 0.22, 19.44, z + 0.86],
      [x, 19.4, z + 0.93],
      [x + 0.19, 19.45, z + 0.88],
    ],
    0.068,
  );
  if (d >= 3)
    for (let i = 0; i < 9; i++) {
      const u = (i - 4) * 0.16;
      seam(
        out,
        o,
        [
          [x + u, 21.08, z + 0.59 - 0.44 * Math.abs(u)],
          [x + u - 0.12, right ? 21.67 : 21.44, z + 0.4],
          [x + u - 0.21, right ? 21.8 : 21.51, z - 0.2],
        ],
        0.065,
        'highlight',
      );
    }
}
function coat(out, o, right, d, sides) {
  const rows = right
    ? [
        [7.6, 2.44, 1.15, -0.28],
        [9.2, 2.63, 1.3, -0.22],
        [12.5, 2.43, 1.48, -0.22],
        [15.2, 2.52, 1.58, -0.18],
        [17.0, 2.6, 1.29, -0.09],
        [18.11, 0.78, 0.65, 0.01],
      ]
    : [
        [5.5, 2.92, 1.52, -0.36],
        [6.5, 2.79, 1.49, -0.28],
        [10.0, 2.5, 1.44, -0.25],
        [13.9, 2.17, 1.33, -0.24],
        [17.07, 2.55, 1.26, -0.17],
        [18.14, 0.78, 0.63, 0],
      ];
  const retained = d === 0 ? rows.filter((_, i) => [0, 2, 4, 5].includes(i)) : rows;
  const ring = (r, i, inner = false) => {
    const [y, w, h, z] = r,
      t = i / sides,
      a = 0.36 + t * (tau - 0.72);
    const ruffle = d >= 2 ? 1 + 0.036 * Math.cos(7 * a + 1.7 * y) : 1;
    return plus(o, [
      (w - (inner ? 0.12 : 0)) * Math.sin(a) * ruffle,
      y,
      (h - (inner ? 0.1 : 0)) * Math.cos(a) * ruffle + z,
    ]);
  };
  for (let j = 1; j < retained.length; j++)
    for (let i = 0; i < sides; i++) {
      const a = retained[j - 1],
        b = retained[j],
        p = [ring(a, i), ring(a, i + 1), ring(b, i + 1), ring(b, i)];
      face(out, 'bronze', i === Math.floor(sides / 2) ? 'crease' : 'bronze', p, [
        p[0][0] - o[0],
        0,
        p[0][2] - o[2] + 0.17,
      ]);
      if (d >= 2 && j === 1)
        face(
          out,
          'bronze',
          'crease',
          [ring(a, i, true), ring(a, i + 1, true), p[1], p[0]],
          [0, -1, 0],
        );
    }
  for (const i of [0, sides])
    for (let j = 1; j < retained.length; j++) {
      const a = retained[j - 1],
        b = retained[j];
      face(
        out,
        'bronze',
        'crease',
        [ring(a, i), ring(a, i, true), ring(b, i, true), ring(b, i)],
        [i === 0 ? -1 : 1, 0, 0.3],
      );
    }
  if (d < 1) return;
  for (const s of [-1, 1]) {
    const lapel = [
      [s * 0.51, 18.11, 0.55],
      [s * 1.44, 17.29, 0.81],
      [s * 0.91, 16.22, 1.33],
      [s * 1.27, 16.22, 1.31],
      [s * 0.33, right ? 13.73 : 13.28, 1.38],
      [s * 0.48, 17.1, 1.12],
    ].map((p) => plus(o, p));
    for (let i = 1; i < lapel.length - 1; i++)
      triangle(
        out,
        'bronze',
        s === -1 ? 'highlight' : 'bronze',
        [lapel[0], lapel[i], lapel[i + 1]],
        front,
      );
    if (d >= 2) {
      seam(
        out,
        o,
        [
          [s * 0.51, 18.11, 0.6],
          [s * 1.44, 17.29, 0.86],
          [s * 0.91, 16.22, 1.38],
          [s * 1.27, 16.22, 1.36],
          [s * 0.33, right ? 13.73 : 13.28, 1.43],
          [s * 0.81, right ? 8.1 : 5.7, 1.29],
        ],
        0.073,
      );
      if (right) {
        for (const y of [11.32, 15.14]) {
          const w = y > 14 ? 0.78 : 1.04,
            h = y > 14 ? 0.62 : 0.82;
          const a = plus(o, [s * 1.62 - w / 2, y, 1.17]),
            b = plus(o, [s * 1.62 + w / 2, y + h, 1.26]);
          face(
            out,
            'bronze',
            'bronze',
            [[a[0], a[1], a[2]], [b[0], a[1], a[2]], b, [a[0], b[1], b[2]]],
            front,
          );
          seam(
            out,
            o,
            [
              [s * 1.62 - w / 2, y + h, 1.29],
              [s * 1.62, y + h - 0.14, 1.35],
              [s * 1.62 + w / 2, y + h, 1.29],
            ],
            0.075,
            'crease',
          );
        }
      }
    }
  }
  if (!right) {
    const p = [
      [0, 17.88, 1.01],
      [-0.26, 17.56, 1.14],
      [-0.16, 15.92, 1.48],
      [0.08, 15.38, 1.47],
      [0.26, 16.18, 1.4],
      [0.16, 17.6, 1.11],
    ].map((p) => plus(o, p));
    for (let i = 1; i < p.length - 1; i++)
      triangle(out, 'bronze', 'crease', [p[0], p[i], p[i + 1]], front);
    if (d >= 2)
      for (let i = 0; i < 4; i++)
        bronzeSphere(
          out,
          o,
          [-0.97 - i * 0.15, 15.12 - i * 1.76, 1.14 - i * 0.045],
          [0.14, 0.14, 0.075],
          'highlight',
          7,
          4,
        );
  } else if (d >= 2) {
    seam(
      out,
      o,
      [
        [-0.16, 17.72, 1.18],
        [-0.17, 16.0, 1.43],
        [-0.14, 13.62, 1.49],
        [-0.13, 11.73, 1.34],
      ],
      0.066,
      'crease',
    );
    seam(
      out,
      o,
      [
        [-0.84, 11.76, 1.18],
        [-0.12, 11.67, 1.35],
        [0.82, 11.82, 1.19],
      ],
      0.069,
      'highlight',
    );
  }
}
function statue(out, index, d) {
  const [x, z] = layout.main.pair[index].point,
    right = index === 1,
    o = [x, 2.81, z],
    sides = [5, 6, 12, 18, 24][d];
  for (const s of [-1, 1]) {
    const shift = right ? 0.2 * s : 0,
      zToe = s === -1 ? 0.39 : 0.04;
    const shoe = [
      [0.012, s * 1.33 + shift, zToe + 0.4, 0.6, 1.06],
      [0.17, s * 1.33 + shift, zToe + 0.43, 0.65, 1.09],
      [0.47, s * 1.29 + shift, zToe + 0.29, 0.64, 0.94],
      [0.73, s * 1.27 + shift, zToe + 0.02, 0.51, 0.61],
    ];
    oval(out, o, d <= 1 ? [shoe[0], shoe[2]] : shoe, sides, 'shoe');
    const trousers = [
      [0.5, s * 1.26 + shift, zToe - 0.08, 0.6, 0.6],
      [1.58, s * 1.28 + shift, zToe - 0.16, 0.65, 0.67],
      [4.1, s * 1.2 + shift, -0.03, 0.67, 0.7],
      [6.42, s * 1.11 + shift, -0.06, 0.79, 0.82],
      [10.05, s * 0.87, -0.03, 1.02, 0.99],
      [11.7, s * 0.66, -0.04, 1.05, 0.94],
    ];
    oval(
      out,
      o,
      d <= 1 ? [trousers[0], trousers[3], trousers[5]] : trousers,
      sides,
      'bronze',
      d >= 2 ? 0.04 : 0,
    );
    if (d >= 2)
      seam(
        out,
        o,
        [
          [s * 1.25 + shift, 1.42, zToe + 0.53],
          [s * 1.3 + shift, 4.2, 0.68],
          [s * 1.15 + shift, 6.45, 0.77],
          [s * 0.87, 10, 0.97],
        ],
        0.078,
        'highlight',
      );
  }
  const torso = [
    [9.3, 0, -0.12, 1.68, 1.14],
    [12.2, 0, -0.08, 1.77, 1.53],
    [14.7, -0.06, 0, 1.97, 1.48],
    [17.14, -0.05, -0.03, 2.18, 1.16],
    [18.26, 0, 0, 0.62, 0.55],
  ];
  oval(out, o, d === 0 ? [torso[0], torso[3], torso[4]] : torso, sides, 'bronze');
  coat(out, o, right, d, sides);
  const left = right
    ? [
        [-1.91, 16.98, -0.14, 0.82, 0.92],
        [-2.41, 15.95, 0.02, 0.8, 0.8],
        [-2.6, 14.32, 0.21, 0.68, 0.67],
        [-2.77, 12.46, 0.48, 0.53, 0.53],
        [-2.81, 10.32, 0.65, 0.38, 0.39],
      ]
    : [
        [-1.95, 16.93, -0.11, 0.81, 0.91],
        [-2.64, 17.15, 0.17, 0.8, 0.87],
        [-3.93, 17.8, 0.65, 0.68, 0.69],
        [-5.18, 18.84, 1.23, 0.56, 0.58],
        [-6.17, 19.96, 1.9, 0.39, 0.45],
      ];
  const bent = right
    ? [
        [2.04, 16.89, -0.22, 0.86, 0.94],
        [2.95, 16.14, -0.18, 0.83, 0.87],
        [3.23, 14.91, -0.54, 0.71, 0.72],
        [2.93, 13.59, -1.03, 0.56, 0.57],
        [2.31, 12.6, -1.24, 0.4, 0.42],
      ]
    : [
        [2.03, 16.88, -0.21, 0.81, 0.92],
        [2.87, 16.0, -0.32, 0.75, 0.82],
        [3.42, 14.61, -0.54, 0.66, 0.68],
        [2.87, 13.48, -1.16, 0.51, 0.55],
        [2.02, 12.6, -1.34, 0.37, 0.4],
      ];
  for (const arm of [left, bent])
    limb(out, o, d === 0 ? [arm[0], arm[2], arm[4]] : arm, sides, 'bronze');
  const neck = [
    [17.7, 0, 0.04, 0.59, 0.56],
    [18.42, right ? -0.16 : 0.06, 0.06, 0.61, 0.6],
    [19.0, right ? -0.18 : 0.08, 0.16, 0.65, 0.61],
  ];
  oval(out, o, neck, sides, 'bronze');
  faceSculpt(out, o, right, d, sides);
  if (right) {
    limb(
      out,
      o,
      [
        [-2.81, 10.39, 0.68, 0.34, 0.3],
        [-2.84, 9.91, 0.76, 0.35, 0.31],
        [-2.78, 9.56, 0.85, 0.23, 0.24],
      ],
      sides,
      'bronze',
    );
    if (d >= 2)
      for (let i = 0; i < 3; i++)
        seam(
          out,
          o,
          [
            [-2.95 + i * 0.12, 10.06, 1.04],
            [-2.96 + i * 0.11, 9.74, 1.04],
            [-2.88 + i * 0.1, 9.58, 0.97],
          ],
          0.074,
          'crease',
        );
  } else {
    limb(
      out,
      o,
      [
        [-6.14, 19.91, 1.92, 0.39, 0.34],
        [-6.48, 20.33, 2.11, 0.48, 0.29],
        [-6.83, 20.73, 2.23, 0.46, 0.24],
        [-7.2, 21.12, 2.26, 0.28, 0.15],
      ],
      sides,
      'bronze',
    );
    if (d >= 2)
      for (let i = 0; i < 4; i++) {
        const u = i * 0.16;
        limb(
          out,
          o,
          [
            [-6.83 + u * 0.7, 20.89 + u, 2.23 + u * 0.36, 0.125, 0.15],
            [-7.19 + u * 0.6, 21.36 + u, 2.29 + u * 0.39, 0.106, 0.12],
            [-7.34 + u * 0.52, 21.49 + u, 2.3 + u * 0.46, 0.065, 0.08],
          ],
          d >= 3 ? 8 : 6,
          'bronze',
        );
      }
    if (d >= 1)
      limb(
        out,
        o,
        [
          [-6.64, 20.39, 2.38, 0.2, 0.19],
          [-6.61, 20.95, 2.5, 0.15, 0.14],
          [-6.85, 21.37, 2.55, 0.1, 0.1],
        ],
        Math.max(5, sides - 4),
        'bronze',
      );
  }
  if (d >= 2) {
    bronzeSphere(out, o, [right ? 2.19 : 1.95, 12.53, -1.45], [0.38, 0.35, 0.33], 'bronze', 8, 5);
    for (const arm of [left, bent]) {
      const [a, b] = arm.slice(-2);
      const toward = normalize(minus(b.slice(0, 3), a.slice(0, 3)));
      const v = b.slice(0, 3);
      limb(
        out,
        o,
        [
          [
            ...plus(
              v,
              toward.map((x) => -0.25 * x),
            ),
            b[3] * 1.13,
            b[4] * 1.11,
          ],
          [...v, b[3] * 1.03, b[4] * 1.03],
        ],
        sides,
        'highlight',
      );
    }
  }
}
function banner(out, w, d) {
  const x = w.point[0],
    sign = Math.sign(x),
    inner = -sign,
    base = -1.84;
  const top = [8.2, 9.0, 11.5, 12.4, 14.8, 18.6, 22.2];
  const n = d === 0 ? 6 : d === 1 ? 9 : 16;
  const shape = (u, v, side) => {
    const z = lerp(9.4, 53.8, u),
      k = u * (top.length - 1),
      i = Math.min(Math.floor(k), top.length - 2);
    const h = lerp(top[i], top[i + 1], k - i);
    const bend = Math.sin(u * 8.0 + v * 3.1) * (0.21 + v * 0.39) + 0.22 * Math.sin(v * 13 + u * 11);
    const x0 = x + sign * (0.23 + 0.85 * u + bend);
    return [
      x0 + side * (0.37 + u * 0.2 - v * 0.13),
      base + (h - base) * v,
      z + v * (u - 0.25) * 1.2,
    ];
  };
  const rows = d === 0 ? 1 : d === 1 ? 3 : 5;
  for (let j = 0; j < n; j++) {
    const u = j / n,
      v = (j + 1) / n;
    for (const side of [-1, 1])
      for (let i = 0; i < rows; i++) {
        const a = i / rows,
          b = (i + 1) / rows;
        face(
          out,
          'flag',
          (i + j) % 6 === 0 ? 'flagLight' : side === inner ? 'flag' : 'flagDark',
          [shape(u, a, side), shape(v, a, side), shape(v, b, side), shape(u, b, side)],
          [side, 0, 0],
        );
      }
    face(
      out,
      'flag',
      'flagLight',
      [shape(u, 1, -1), shape(v, 1, -1), shape(v, 1, 1), shape(u, 1, 1)],
      up,
    );
  }
  for (const u of [0, 1])
    face(
      out,
      'flag',
      'flagDark',
      [shape(u, 0, -1), shape(u, 0, 1), shape(u, 1, 1), shape(u, 1, -1)],
      [0, 0, u === 0 ? -1 : 1],
    );
  const low = ([a, z]) => Math.min(base - 0.55, grade(a, z) - 0.28);
  polygon(out, 'paving', 'granite', w.outline, base);
  walls(out, 'paving', 'step', w.outline, low, () => base);
  if (d >= 1) {
    const rib = (u, a, b, t) => {
      const p = shape(u, a, inner),
        q = shape(u, b, inner);
      beam(out, 'flag', p, q, t, 0.22, color.flagDark);
    };
    for (const [u, a, b, t] of [
      [0.99, 0.03, 0.99, 0.28],
      [0.64, 0.07, 0.79, 0.19],
      [0.21, 0.05, 0.79, 0.17],
    ])
      rib(u, a, b, t);
    for (const [u, v] of [
      [0.45, 0.55],
      [0.12, 0.55],
      [0.68, 0.78],
    ]) {
      const a = shape(u, 0.2, inner),
        b = shape(v, 0.71, inner),
        c = shape(u, 0.23, inner),
        e = shape(v, 0.6, inner);
      for (const p of [a, b, c, e]) p[0] += inner * 0.09;
      face(out, 'flag', 'flagDark', [a, b, e, c], [inner, 0, 0]);
    }
  }
  const count = [0, 8, 24, 51, 60][d];
  const reliefBase = (u, row) => base + 0.17 + u * u * (1.1 + (2 - row) * 0.43);
  if (d >= 1) {
    const segments = d === 1 ? 4 : 12;
    const shelf = (u, row) => [
      x + inner * (0.12 + row * 0.72 + u * 0.42),
      reliefBase(u, row),
      10.0 + u * 43.5,
    ];
    for (let j = 0; j < segments; j++) {
      const a = j / segments,
        b = (j + 1) / segments;
      for (let row = 0; row < 3; row++)
        face(
          out,
          'bronze',
          j % 3 === 1 ? 'crease' : 'group',
          [shelf(a, row), shelf(b, row), shelf(b, row + 1), shelf(a, row + 1)],
          up,
        );
      const p = shelf(a, 3),
        q = shelf(b, 3);
      face(out, 'bronze', 'crease', [p, q, [q[0], base, q[2]], [p[0], base, p[2]]], [inner, 0, 0]);
    }
  }
  for (let i = 0; i < count; i++) {
    const row = i % 3,
      j = Math.floor(i / 3),
      u = (j + 0.4 + row * 0.28) / (Math.ceil(count / 3) + 0.12);
    const h =
      (2.85 + 0.85 * Math.cos(i * 17.13) + 1.9 * Math.pow(u, 3)) *
      (row === 0 ? 1 : row === 1 ? 0.89 : 0.8);
    const t = (i * 13 + Math.floor(i / 3)) % 9;
    reliefFigure(
      out,
      [
        x + inner * (0.5 + row * 0.72 + u * 0.42),
        reliefBase(u, row + 0.5) - h * 0.031,
        10.0 + u * 43.5,
      ],
      inner,
      h,
      t,
      d,
    );
  }
}
function reliefFigure(out, o, inner, h, pose, d) {
  const yaw = inner * (1.0 + 0.37 * Math.sin(pose * 3.19)),
    s = Math.sin(yaw),
    c = Math.cos(yaw);
  const crouch = pose === 4 || pose === 8;
  const tall = crouch ? 0.74 : 1,
    unit = h / 1.8;
  const point = (x, y, z) => plus(o, [(c * x + s * z) * unit, y * unit, (-s * x + c * z) * unit]);
  const wrapped = Object.fromEntries(
    ['addConvexPolygon', 'addQuad', 'addTriangle'].map((method) => [
      method,
      (slot, ref, p, n, uv, tint) =>
        out[method](
          slot,
          ref,
          p.map((v) => point(...v)),
          [c * n[0] + s * n[2], n[1], -s * n[0] + c * n[2]],
          uv,
          tint,
        ),
    ]),
  );
  const sides = d <= 2 ? 4 : d === 3 ? 5 : 7,
    zero = [0, 0, 0],
    tint = pose % 4 === 1 ? 'bronze' : 'group';
  const profile = (rows) => (d <= 2 ? [rows[0], rows.at(-1)] : rows);
  const torso = [
    [0.66 * tall, 0, 0, 0.18, 0.12],
    [1.11 * tall, 0, 0.08, 0.23, 0.14],
    [1.44 * tall, 0, 0.09, 0.23, 0.125],
    [1.52 * tall, 0, 0.09, 0.08, 0.08],
  ];
  oval(wrapped, zero, d === 1 ? torso.slice(0, 3) : torso, sides, tint);
  for (const k of [-1, 1]) {
    const step = ((pose % 3) - 1) * 0.22 * k;
    limb(
      wrapped,
      zero,
      profile([
        [k * 0.1, 0.77 * tall, 0, 0.115, 0.12],
        [k * 0.14, 0.34 * tall, 0.06 + step * 0.4, 0.085, 0.09],
        [k * 0.16, 0.055, step, 0.064, 0.073],
      ]),
      sides,
      tint,
    );
    const reach = (pose === 0 && k === -1) || (pose === 3 && k === 1) || (pose === 6 && k === -1);
    const armEnd = [
      k * (reach ? 0.57 : 0.29),
      reach ? 1.68 * tall : 0.9 * tall,
      reach ? 0.44 : pose % 2 ? 0.34 : 0.05,
    ];
    limb(
      wrapped,
      zero,
      profile([
        [k * 0.19, 1.38 * tall, 0.08, 0.104, 0.11],
        [k * (reach ? 0.4 : 0.3), 1.15 * tall, 0.18, 0.081, 0.086],
        [...armEnd, 0.053, 0.059],
      ]),
      sides,
      tint,
    );
    if (reach && pose !== 3)
      beam(
        wrapped,
        'bronze',
        armEnd,
        plus(armEnd, [k * 0.12, 0.57, 0.04]),
        0.041,
        0.033,
        color.crease,
      );
  }
  const head = [
    [1.44 * tall, 0, 0.11, 0.082, 0.08],
    [1.57 * tall, 0, 0.11, 0.116, 0.108],
    [1.7 * tall, 0, 0.09, 0.112, 0.114],
    [1.76 * tall, 0, 0.07, 0.054, 0.06],
  ];
  oval(wrapped, zero, d === 1 ? head.slice(0, 3) : head, sides, 'bronze');
  if (d >= 2) {
    if (pose % 4 !== 1)
      oval(
        wrapped,
        zero,
        [
          [1.65 * tall, 0, 0.115, 0.135, 0.156],
          [1.76 * tall, 0, 0.073, 0.139, 0.109],
          [1.8 * tall, 0, 0.071, 0.082, 0.08],
        ],
        sides,
        'crease',
      );
    if (pose % 3 === 0)
      beam(
        wrapped,
        'bronze',
        [-0.19, 1.37 * tall, 0.21],
        [0.14, 0.82 * tall, 0.13],
        0.047,
        0.021,
        color.crease,
      );
    if (pose === 1 || pose === 4) {
      const cape = [
        [-0.21, 1.4 * tall, 0.03],
        [0.23, 1.4 * tall, 0.03],
        [0.32, 0.66 * tall, -0.29],
        [-0.32, 0.67 * tall, -0.2],
      ];
      face(wrapped, 'bronze', 'crease', cape, [0, 0, -1]);
      face(wrapped, 'bronze', 'group', cape, [0, 0, 1]);
    }
  }
}
function museum(out, d) {
  for (const m of layout.museum) {
    const top = m.height + 1.4;
    polygon(out, 'wall', 'roof', m.outline, top);
    walls(
      out,
      'wall',
      m.height === 29 ? 'wallDark' : 'wall',
      m.outline,
      ([x, z]) => Math.min(grade(x, z) - 0.5, 1.4),
      () => top,
    );
  }
  const bands = [
    [22.1, 1.3],
    [19.33, 0.52],
    [27.38, 1.1],
  ];
  for (const [i, [y, h]] of bands.entries()) {
    if (d === 0 && i > 1) break;
    if (i === 2) slab(out, 'wall', 'trim', -40.5, y, -60.24, 106.5, h, 0.56);
    else slab(out, 'wall', i === 1 ? 'wallDark' : 'trim', -93, y, -43.41, 180.5, h, 0.65);
  }
  const [x0, x1, z, y0, y1] = [-49, 52, -42.99, 5.84, 17.46];
  if (d >= 1) {
    slab(out, 'wall', 'trim', -93, 10.55, -43.41, x0 + 93, 0.34, 0.65);
    slab(out, 'wall', 'trim', x1, 10.55, -43.41, 87.5 - x1, 0.34, 0.65);
  }
  const panel = (t, p) =>
    face(
      out,
      'wall',
      t,
      p.map(([x, y]) => [x, y, z]),
      front,
    );
  panel('sky', [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ]);
  const peaks = [
    [-49, 8.1],
    [-41, 9.6],
    [-32, 11.6],
    [-23, 9.1],
    [-14, 11.6],
    [-8, 10.7],
    [3, 13.45],
    [12, 10.9],
    [21, 12.4],
    [27, 11.1],
    [40, 15.3],
    [45, 13.2],
    [52, 12.2],
  ];
  for (let i = 1; i < peaks.length; i++) {
    const [a, h] = peaks[i - 1],
      [b, k] = peaks[i],
      q = (a + b) * 0.5;
    const put = (t, p, off) =>
      triangle(
        out,
        'wall',
        t,
        p.map(([x, y]) => [x, y, z + off]),
        front,
      );
    put(
      'ridge',
      [
        [a, y0],
        [a, h],
        [b, k],
      ],
      0.014,
    );
    put(
      'ridge',
      [
        [a, y0],
        [b, k],
        [b, y0],
      ],
      0.014,
    );
    put(
      i % 2 ? 'snow' : 'ice',
      [
        [a, h],
        [b, k],
        [q - 2.4, y0 + 1.7],
      ],
      0.028,
    );
    put(
      'shade',
      [
        [a, y0 + 0.1],
        [b, k],
        [q - 2.4, y0 + 1.7],
      ],
      0.035,
    );
    if (d >= 2) {
      put(
        'rockBlue',
        [
          [a, y0 + 0.38],
          [q - 2.4, y0 + 1.7],
          [b, y0 + 1.13],
        ],
        0.044,
      );
      put(
        'ice',
        [
          [q, lerp(h, k, 0.45)],
          [b, k],
          [b - 0.25, y0 + 2.13],
        ],
        0.045,
      );
    }
  }
  if (d < 1) return;
  for (const [start, end] of [
    [-91, -50],
    [54, 86],
  ]) {
    for (let x = start; x < end; x += 7.8) {
      slab(out, 'wall', 'trim', x, 2.25, -43.22, 0.75, 15.0, 0.55);
      if (d >= 2) slab(out, 'wall', 'wallDark', x + 0.97, 11.91, -43.2, 0.67, 0.82, 0.16);
    }
  }
  for (const [start, end, y, depth] of [
    [-91, 86, 20, -42.78],
    [-39, 65, 25.8, -60.02],
  ]) {
    for (let x = start; x < end - 3; x += 7.1) {
      face(
        out,
        'wall',
        'slit',
        [
          [x, y, depth],
          [x + 4.6, y, depth],
          [x + 4.6, y + 0.56, depth],
          [x, y + 0.56, depth],
        ],
        front,
      );
      if (d >= 2)
        for (let r = 1; r < 4; r++)
          slab(out, 'wall', 'wallDark', x, y + r * 0.13, depth + 0.15, 4.6, 0.044, 0.026);
    }
  }
  if (d >= 2) {
    for (const y of [y0 - 0.24, y1])
      slab(out, 'wall', 'trim', x0 - 0.28, y, z + 0.07, x1 - x0 + 0.56, 0.24, 0.17);
    for (const x of [x0 - 0.24, x1])
      slab(out, 'wall', 'trim', x, y0 - 0.24, z + 0.075, 0.24, y1 - y0 + 0.48, 0.17);
    for (let x = -144; x < -94; x += 5.6) {
      slab(out, 'wall', 'trim', x, 1.7, -37.1, 0.52, 6.4, 0.51);
      slab(out, 'wall', 'slit', x + 0.69, 5.92, -37.0, 3.45, 0.58, 0.23);
    }
  }
}
function court(out, d) {
  if (d === 0) return;
  // Native semantic paving already covers the open plaza. Only the stairs and landings
  // need authored geometry, so terrain and paving never compete across the larger court.
  const tread = (z) => Math.max(0, Math.ceil((70.4 - z) / 0.69)) * 0.096 - 3.55;
  const sample = (x, z) => [x, grade(x, z) + 0.105, z];
  for (let i = 0; i < 16; i++) {
    const z = 70.4 - (16 - i) * 0.69,
      v = z + 0.69,
      y = tread(z + 0.08),
      t = 16 - i;
    const lo = -26.2,
      hi = 26.8;
    const bottom = Math.min(y - 0.12, grade(lo, z) - 0.18, grade(hi, z) - 0.18);
    slab(out, 'paving', t % 3 === 0 ? 'cap' : 'granite', lo, bottom, z, hi - lo, y - bottom, v - z);
  }
  for (const [seam, end, y] of [
    [59.36, 57.0, tread(59.44)],
    [70.4, 73.25, tread(70.0)],
  ]) {
    const lo = -26.2;
    const hi = 26.8;
    const near = [lift([lo, seam], y), lift([hi, seam], y)];
    const far = [sample(lo, end), sample(hi, end)];
    face(out, 'paving', 'granite', [near[0], near[1], far[1], far[0]], up);
    for (const i of [0, 1]) {
      const p = near[i];
      const q = far[i];
      triangle(
        out,
        'paving',
        'step',
        [p, q, lift([p[0], p[2]], grade(p[0], p[2]) - 0.16)],
        [i === 0 ? -1 : 1, 0, 0],
      );
    }
  }
}
export function buildMonumentLevel(out, level) {
  const d = tiers[level];
  podium(out, d);
  for (let i = 0; i < 2; i++) statue(out, i, d);
  for (const wing of layout.wings) banner(out, wing, d);
  museum(out, d);
  court(out, d);
}
export const buildSkyline = (out) => buildMonumentLevel(out, 'skyline');
export const buildDistrict = (out) => buildMonumentLevel(out, 'district');
export const buildStreet = (out) => buildMonumentLevel(out, 'street');
export const buildCloseup = (out) => buildMonumentLevel(out, 'closeup');
export const buildMaster = (out) => buildMonumentLevel(out, 'master');

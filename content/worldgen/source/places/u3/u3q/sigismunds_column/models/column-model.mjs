/** Warsaw's Sigismund III column with authored cast ornament and figure. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const columnSurfaces = {
  granite: { slot: 'foundation', graph: 'stone_granite' },
  stone: { slot: 'wall', graph: 'stone_limestone_raw' },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', metallic: 0.62, roughness: 0.58 },
};
const hex = {
  step: '898781',
  stepEdge: 'a09b90',
  base: '646563',
  baseEdge: '88857b',
  pedestal: 'b4aca0',
  stone: 'c4baac',
  warm: 'c4b2a0',
  shaft: 'c4b4a5',
  shaftShade: 'beae9f',
  stoneDark: '9e9486',
  bronze: '535b55',
  black: '404c46',
  patina: '61706a',
  bronzeLit: '73786d',
  ridge: '666e65',
  letter: '657167',
  plaque: '465450',
  verdigris: '697a70',
  eye: '474e48',
};
const C = Object.fromEntries(
  Object.entries(hex).map(([key, h]) => [
    key,
    h.match(/../g).map((pair) => {
      const s = parseInt(pair, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const REF = 'palette:#ffffff',
  TAU = 2 * Math.PI,
  TIERS = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const mix = (a, b, t) => a + (b - a) * t,
  lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const norm = (v) => {
  const d = Math.hypot(...v) || 1;
  return v.map((x) => x / d);
};
const [cx, cz] = layout.center;
const A = ([x, y, z]) => [x + cx, y, z + cz];
const up = [0, 1, 0];

function face(out, slot, tone, points, wanted) {
  for (let p of points.length === 3
    ? [points]
    : [points.slice(0, 3), [points[0], points[2], points[3]]]) {
    let n = normalFor(...p);
    if (Math.hypot(...n) < 0.9) continue;
    if (n.reduce((s, v, i) => s + v * wanted[i], 0) < 0) {
      p = [p[0], p[2], p[1]];
      n = n.map((v) => -v);
    }
    out.addTriangle(slot, REF, p, n, undefined, C[tone]);
  }
}
function rings(out, slot, tone, profile, n = 16, center = [cx, cz], cap = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, n, center)),
    C[tone],
    { cap },
  );
}
function blocks(out, slot, tone, profile, bevel = 0.07) {
  loft(
    out,
    slot,
    profile.map(([y, w, d = w]) => chamferedRectangle(cx, y, cz, w, d, bevel)),
    C[tone],
  );
}
function step(out, part, index, tier) {
  const all = part.ring;
  const p = tier ? all : all.filter((_, i) => i % 3 !== 2);
  const bottom = index === 0 ? -0.3 : part.base - 0.012,
    top = part.top;
  const tone = index % 2 ? 'stepEdge' : 'step';
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      normal = norm([a[0] + b[0], 0, a[1] + b[1]]);
    const aa = a.map((v) => v * 0.994),
      bb = b.map((v) => v * 0.994),
      H = tier ? top - 0.027 : top;
    const pt = ([x, z], y) => [x, y, z];
    face(out, 'granite', tone, [pt(a, bottom), pt(b, bottom), pt(b, H), pt(a, H)], normal);
    if (tier)
      face(out, 'granite', 'stepEdge', [pt(a, H), pt(b, H), pt(bb, top), pt(aa, top)], normal);
  }
  const t = earcut(p.flat());
  for (let i = 0; i < t.length; i += 3)
    face(
      out,
      'granite',
      tone,
      t
        .slice(i, i + 3)
        .map((j) => [p[j][0] * (tier ? 0.994 : 1), top, p[j][1] * (tier ? 0.994 : 1)]),
      up,
    );
}
function plaque(out, tier, side) {
  const normals = [
      [0, 0, 1],
      [1, 0, 0],
      [0, 0, -1],
      [-1, 0, 0],
    ],
    n = normals[side],
    t = [n[2], 0, -n[0]];
  const point = (u, y, d) => [cx + n[0] * d + t[0] * u, y, cz + n[2] * d + t[2] * u];
  const w = 0.668,
    d = 0.948,
    y0 = 2.31,
    y1 = 4.49;
  face(
    out,
    'bronze',
    'plaque',
    [point(-w, y0, d), point(w, y0, d), point(w, y1, d), point(-w, y1, d)],
    n,
  );
  if (!tier) return;
  const edges = [
    [-w, y0],
    [w, y0],
    [w, y1],
    [-w, y1],
  ];
  beamPath(
    out,
    'stone',
    edges.map((p) => point(...p, d + 0.012)),
    0.068,
    0.039,
    C.stoneDark,
    true,
  );
  if (tier >= 2) {
    const count = side === 0 ? 22 : side === 2 ? 15 : 19;
    for (let row = 0; row < count; row++) {
      const y = y1 - 0.17 - row * (1.81 / count),
        length = 0.47 - 0.05 * ((row * 7 + side * 2) % 5);
      const pieces = tier >= 3 ? 8 : 3;
      for (let j = 0; j < pieces; j++) {
        const u = -length + (2 * length * j) / pieces,
          v = u + ((2 * length) / pieces) * 0.79,
          h = tier >= 3 ? 0.012 : 0.019;
        face(
          out,
          'bronze',
          row % 4 === 1 ? 'ridge' : 'letter',
          [
            point(u, y, d + 0.009),
            point(v, y, d + 0.009),
            point(v, y + h, d + 0.009),
            point(u, y + h, d + 0.009),
          ],
          n,
        );
      }
    }
  }
}
function bronzeOrnament(out, tier) {
  if (!tier) return;
  const n = tier >= 3 ? 13 : 7;
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      s = Math.sin(a),
      c = Math.cos(a);
    const p = (u, y, r) => [cx + c * u + s * r, y, cz - s * u + c * r];
    const swag = Array.from({ length: n }, (_, i) => {
      const t = i / (n - 1);
      return p(
        mix(-0.91, 0.91, t),
        5.16 + 0.28 * Math.pow(2 * t - 1, 2),
        0.99 + 0.15 * Math.sin(Math.PI * t),
      );
    });
    beamPath(out, 'bronze', swag, 0.095, 0.112, C.bronze);
    if (tier >= 2)
      for (let i = 1; i < n - 1; i++) {
        const q = swag[i],
          t = i / (n - 1);
        beam(
          out,
          'bronze',
          p(mix(-0.91, 0.91, t) - 0.072, q[1] + 0.11, 1.04),
          q,
          0.053,
          0.064,
          C.ridge,
        );
      }
    const pts = Array.from({ length: tier >= 3 ? 20 : 10 }, (_, i) => {
      const q = (TAU * i) / (tier >= 3 ? 20 : 10);
      return p(0.4 * Math.cos(q), 4.79 + 0.32 * Math.sin(q), 1.153 + 0.025 * Math.cos(2 * q));
    });
    if (side === 0 || side === 2) {
      beamPath(out, 'bronze', pts, 0.084, 0.09, C.patina, true);
      for (let i = 0; i < pts.length; i++)
        face(
          out,
          'bronze',
          'plaque',
          [p(0, 4.79, 1.142), pts[i], pts[(i + 1) % pts.length]],
          [s, 0, c],
        );
    }
    const bird = p(0.88, 5.37, 1.0),
      head = p(0.85, 5.58, 1.055);
    sphere(
      out,
      'bronze',
      bird,
      [0.115, 0.17, 0.105],
      C.bronze,
      tier >= 2 ? 10 : 6,
      tier >= 2 ? 6 : 4,
    );
    if (tier >= 2) {
      sphere(out, 'bronze', head, [0.074, 0.091, 0.068], C.bronzeLit, 8, 5);
      for (const sign of [-1, 1]) {
        const q = p(0.88 + sign * 0.13, 5.5, 1.02),
          tip = p(0.88 + sign * 0.32, 5.39, 0.99);
        face(out, 'bronze', 'patina', [p(0.88, 5.34, 1.078), q, tip], [s, 0.3, c]);
        face(
          out,
          'bronze',
          'bronze',
          [p(0.88, 5.32, 1.01), tip, p(0.88 + sign * 0.14, 5.23, 1.056)],
          [s, 0.3, c],
        );
        if (tier >= 3)
          for (let j = 0; j < 4; j++)
            beam(
              out,
              'bronze',
              p(0.88 + sign * 0.12, 5.43 - j * 0.029, 1.07),
              lerp(tip, q, j * 0.19),
              0.025,
              0.026,
              C.ridge,
            );
      }
    }
  }
}
function pedestal(out, tier) {
  layout.steps.forEach((p, i) => step(out, p, i, tier));
  blocks(
    out,
    'granite',
    'base',
    tier
      ? [
          [0.585, 2.51],
          [0.73, 2.51],
          [0.82, 2.4],
          [1.75, 2.39],
          [1.89, 2.29],
          [2.03, 2.15],
        ]
      : [
          [0.585, 2.51],
          [1.75, 2.39],
          [2.03, 2.15],
        ],
    0.09,
  );
  blocks(
    out,
    'stone',
    'pedestal',
    tier
      ? [
          [1.97, 2.05],
          [2.18, 1.89],
          [4.46, 1.88],
          [4.58, 2.01],
          [4.74, 2.05],
        ]
      : [
          [1.97, 2.05],
          [2.18, 1.89],
          [4.74, 2.05],
        ],
    0.045,
  );
  blocks(
    out,
    'granite',
    'baseEdge',
    tier
      ? [
          [4.69, 2.07],
          [4.83, 2.1],
          [4.91, 2.55],
          [5.1, 2.54],
          [5.17, 2.31],
        ]
      : [
          [4.69, 2.07],
          [4.91, 2.55],
          [5.17, 2.31],
        ],
    0.054,
  );
  for (let side = 0; side < 4; side++) plaque(out, tier, side);
  bronzeOrnament(out, tier);
}

function capitalLeaves(out, tier) {
  if (!tier) return;
  const n = tier === 1 ? 8 : tier === 2 ? 12 : 16;
  for (let j = 0; j < n; j++) {
    const a = (TAU * j) / n,
      s = Math.sin(a),
      c = Math.cos(a);
    const p = (u, y, r) => [cx + r * s + c * u, y, cz + r * c - s * u];
    const base = p(0, 17.4, 0.63),
      mid = p(0, 17.74, 0.8),
      top = p(0, 18.0, 0.97),
      l = p(-0.109, 17.72, 0.72),
      r = p(0.109, 17.72, 0.72),
      nrm = [s, 0.14, c];
    for (const [tone, points] of [
      ['bronze', [base, l, mid]],
      ['ridge', [base, mid, r]],
      ['patina', [l, top, mid]],
      ['bronze', [mid, top, r]],
    ])
      face(out, 'bronze', tone, points, nrm);
    if (tier >= 2) {
      for (const sign of [-1, 1])
        face(
          out,
          'bronze',
          'bronzeLit',
          [p(sign * 0.06, 17.61, 0.775), p(sign * 0.14, 17.79, 0.825), p(sign * 0.11, 17.9, 0.887)],
          nrm,
        );
      beam(out, 'bronze', base, mid, 0.025, 0.031, C.patina);
    }
  }
  for (const a of [Math.PI / 4, (Math.PI * 3) / 4, (Math.PI * 5) / 4, (Math.PI * 7) / 4]) {
    const s = Math.sin(a),
      c = Math.cos(a),
      q = (u, y, r) => [cx + s * r + c * u, y, cz + c * r - s * u];
    const path = Array.from({ length: tier >= 3 ? 17 : 8 }, (_, i) => {
      const t = i / (tier >= 3 ? 16 : 7),
        b = t * TAU * 1.22;
      return q(0.12 * Math.cos(b) * (1 - t), 17.94 + 0.13 * Math.sin(b) * (1 - t), 0.97);
    });
    beamPath(out, 'bronze', path, 0.071, 0.069, C.ridge);
  }
}
function shaft(out, tier) {
  const n = [9, 16, 28, 40, 56][tier];
  rings(
    out,
    'bronze',
    'black',
    [
      [5.11, 0.99],
      [5.22, 0.99],
      [5.34, 0.82],
      [5.5, 0.83],
    ],
    n,
  );
  rings(
    out,
    'stone',
    'shaft',
    tier
      ? [
          [5.5, 0.805],
          [5.71, 0.81],
          [7.8, 0.807],
          [10.7, 0.781],
          [13.5, 0.744],
          [16.26, 0.697],
          [17.34, 0.669],
        ]
      : [
          [5.5, 0.81],
          [17.34, 0.67],
        ],
    n,
    [cx, cz],
    false,
  );
  rings(
    out,
    'bronze',
    'bronze',
    tier
      ? [
          [17.29, 0.67],
          [17.37, 0.715],
          [17.46, 0.687],
          [17.63, 0.754],
          [17.84, 0.87],
          [18.03, 0.97],
        ]
      : [
          [17.29, 0.67],
          [18.03, 0.97],
        ],
    n,
  );
  capitalLeaves(out, tier);
  blocks(
    out,
    'stone',
    'stone',
    [
      [18.0, 1.67],
      [18.11, 1.86],
      [18.27, 1.91],
      [18.36, 2.1],
      [18.52, 2.13],
      [18.6, 2.31],
      [18.75, 2.33],
    ],
    0.05,
  );
  blocks(
    out,
    'granite',
    'base',
    [
      [18.74, 1.3, 0.91],
      [18.84, 1.34, 1.01],
      [18.94, 1.38, 1.02],
    ],
    0.035,
  );
}

/** A tapered axis with cross sections perpendicular to the limb. */
function limb(out, points, n, tone, cap = true) {
  const centers = points.map(([x, y, z]) => [x, y, z]);
  const frames = points.map(([x, y, z, w, d], i) => {
    const a = centers[Math.max(0, i - 1)],
      b = centers[Math.min(centers.length - 1, i + 1)];
    const axis = norm(b.map((v, k) => v - a[k])),
      side = norm([axis[1], -axis[0], 0]),
      front = norm([-axis[2] * side[1], axis[2] * side[0], axis[0] * side[1] - axis[1] * side[0]]);
    return Array.from({ length: n }, (_, j) => {
      const q = (TAU * j) / n;
      return A([x, y, z].map((v, k) => v + w * side[k] * Math.cos(q) + d * front[k] * Math.sin(q)));
    });
  });
  loft(out, 'bronze', frames, C[tone], { cap });
}
function body(out, profile, n, tone) {
  loft(
    out,
    'bronze',
    profile.map(([y, x, z, w, d]) => radialRing(y, w, d, n, [x + cx, z + cz])),
    C[tone],
  );
}
function ornamentSphere(out, p, r, n, m, tone) {
  sphere(out, 'bronze', A(p), r, C[tone], n, m);
}

const torso = [
  [19.95, -0.03, -0.025, 0.35, 0.25],
  [20.11, -0.05, -0.025, 0.38, 0.261],
  [20.38, -0.04, -0.035, 0.327, 0.252],
  [20.65, 0.012, -0.023, 0.398, 0.281],
  [20.88, 0.025, -0.028, 0.476, 0.274],
  [21.04, 0.032, -0.038, 0.34, 0.224],
  [21.11, 0.04, -0.039, 0.191, 0.161],
];
const legs = [
  [
    [-0.235, 18.961, 0.101, 0.115, 0.141],
    [-0.253, 19.132, 0.109, 0.111, 0.121],
    [-0.284, 19.45, 0.139, 0.125, 0.13],
    [-0.26, 19.715, 0.194, 0.176, 0.165],
    [-0.171, 20.042, 0.003, 0.184, 0.201],
  ],
  [
    [0.23, 18.961, -0.093, 0.108, 0.132],
    [0.259, 19.12, -0.073, 0.102, 0.115],
    [0.291, 19.42, -0.051, 0.12, 0.125],
    [0.285, 19.7, -0.105, 0.167, 0.159],
    [0.154, 20.04, -0.052, 0.181, 0.195],
  ],
];
const arms = [
  [
    [-0.375, 20.912, -0.058, 0.196, 0.211],
    [-0.576, 20.686, 0.001, 0.159, 0.151],
    [-0.684, 20.389, 0.121, 0.127, 0.125],
    [-0.865, 20.079, 0.278, 0.081, 0.089],
    [-0.91, 19.99, 0.3, 0.084, 0.08],
  ],
  [
    [0.397, 20.881, -0.022, 0.187, 0.196],
    [0.587, 20.687, 0.029, 0.15, 0.143],
    [0.744, 20.714, 0.101, 0.124, 0.131],
    [0.966, 20.988, 0.172, 0.083, 0.085],
    [1.07, 21.08, 0.192, 0.092, 0.094],
  ],
];

function cloak(out, tier) {
  const rows = [
    [21.084, 0.32, 0.211, 0],
    [20.9, 0.55, 0.235, 0.017],
    [20.6, 0.647, 0.281, 0.03],
    [20.16, 0.75, 0.295, 0.054],
    [19.69, 0.78, 0.302, 0.064],
    [19.16, 0.73, 0.247, 0.05],
  ];
  const cols = [7, 12, 20, 30, 42][tier],
    chosen = tier === 0 ? [rows[0], rows[2], rows[4], rows[5]] : rows;
  const pos = (row, j, back = 0) => {
    const [y, w, d, f] = chosen[row],
      u = j / cols,
      a = mix(0.95, TAU - 0.86, u),
      lower = row / (chosen.length - 1);
    const fold = Math.sin(u * TAU * (tier >= 2 ? 6 : 3) + 0.9 * lower) * f;
    return A([
      w * Math.sin(a) + fold * 0.44,
      y + 0.075 * Math.sin(a * 2) * lower + (j === 0 ? -0.06 : 0),
      (d + fold + back) * Math.cos(a) - 0.142 - lower * 0.13,
    ]);
  };
  for (let i = 1; i < chosen.length; i++)
    for (let j = 0; j < cols; j++) {
      const a = pos(i - 1, j),
        b = pos(i - 1, j + 1),
        c = pos(i, j + 1),
        d = pos(i, j),
        angle = mix(0.95, TAU - 0.86, (j + 0.5) / cols),
        n = [Math.sin(angle), 0.02, Math.cos(angle)];
      face(out, 'bronze', j % 5 === 3 ? 'patina' : 'bronze', [a, b, c, d], n);
      if (tier)
        face(
          out,
          'bronze',
          'black',
          [
            pos(i - 1, j, -0.027),
            pos(i - 1, j + 1, -0.027),
            pos(i, j + 1, -0.027),
            pos(i, j, -0.027),
          ],
          n.map((v) => -v),
        );
    }
  if (tier >= 2) {
    for (const j of [0, cols])
      beamPath(
        out,
        'bronze',
        chosen.map((_, i) => pos(i, j)),
        0.045,
        0.037,
        C.ridge,
      );
    beamPath(
      out,
      'bronze',
      Array.from({ length: cols + 1 }, (_, j) => pos(chosen.length - 1, j)),
      0.046,
      0.034,
      C.patina,
    );
  }
}
function head(out, tier) {
  const n = [7, 10, 16, 24, 28][tier];
  const profile = [
    [21.02, 0.055, 0.025, 0.105, 0.122],
    [21.14, 0.054, 0.06, 0.139, 0.154],
    [21.24, 0.05, 0.071, 0.192, 0.167],
    [21.38, 0.049, 0.07, 0.214, 0.184],
    [21.53, 0.051, 0.066, 0.198, 0.181],
    [21.65, 0.05, 0.045, 0.15, 0.15],
  ];
  body(out, tier ? profile : [profile[0], profile[2], profile[3], profile[5]], n, 'bronze');
  const crown = [
    [21.53, 0.047, 0.046, 0.202, 0.18],
    [21.59, 0.047, 0.046, 0.226, 0.205],
    [21.67, 0.047, 0.046, 0.221, 0.199],
    [21.785, 0.046, 0.045, 0.142, 0.137],
    [21.828, 0.045, 0.045, 0.061, 0.065],
  ];
  body(out, tier ? crown : [crown[0], crown[1], crown[4]], n, 'patina');
  if (tier) {
    ornamentSphere(out, [0.045, 21.861, 0.044], [0.052, 0.052, 0.052], 8, 5, 'bronzeLit');
    beam(out, 'bronze', A([0.045, 21.9, 0.044]), A([0.045, 22.0, 0.044]), 0.022, 0.024, C.ridge);
    beam(out, 'bronze', A([-0.005, 21.96, 0.044]), A([0.095, 21.96, 0.044]), 0.018, 0.023, C.ridge);
    if (tier >= 2) {
      for (const sign of [-1, 1]) {
        ornamentSphere(
          out,
          [0.05 + sign * 0.167, 21.336, 0.026],
          [0.058, 0.131, 0.117],
          n,
          7,
          'black',
        );
        beamPath(
          out,
          'bronze',
          [
            [0.052 + sign * 0.041, 21.438, 0.244],
            [0.05 + sign * 0.091, 21.452, 0.244],
            [0.05 + sign * 0.144, 21.436, 0.217],
          ].map(A),
          0.022,
          0.02,
          C.bronze,
        );
        ornamentSphere(
          out,
          [0.049 + sign * 0.095, 21.421, 0.238],
          [0.054, 0.013, 0.013],
          8,
          5,
          'eye',
        );
        beamPath(
          out,
          'bronze',
          [
            [0.051 + sign * 0.015, 21.313, 0.26],
            [0.049 + sign * 0.076, 21.318, 0.248],
            [0.049 + sign * 0.134, 21.298, 0.218],
          ].map(A),
          0.031,
          0.026,
          C.black,
        );
      }
      const nose = [
        [0.031, 21.424, 0.242],
        [0.069, 21.426, 0.243],
        [0.1, 21.34, 0.249],
        [0.059, 21.344, 0.31],
        [0.019, 21.346, 0.254],
      ].map(A);
      for (const q of [
        [0, 1, 3],
        [0, 3, 4],
        [1, 2, 3],
        [2, 4, 3],
      ])
        face(
          out,
          'bronze',
          'bronze',
          q.map((j) => nose[j]),
          [0, 0, 1],
        );
      body(
        out,
        [
          [21.165, 0.05, 0.125, 0.053, 0.069],
          [21.213, 0.05, 0.147, 0.094, 0.094],
          [21.274, 0.05, 0.144, 0.11, 0.095],
        ],
        n,
        'black',
      );
      for (let j = 0; j < (tier >= 3 ? 12 : 7); j++) {
        const a = (TAU * j) / (tier >= 3 ? 12 : 7),
          x = 0.047 + 0.198 * Math.cos(a),
          z = 0.046 + 0.178 * Math.sin(a);
        ornamentSphere(out, [x, 21.627, z], [0.033, 0.046, 0.034], 6, 4, 'ridge');
        if (tier >= 3)
          beam(
            out,
            'bronze',
            A([x, 21.602, z]),
            A([x * 0.68 + 0.018, 21.771, z * 0.62 + 0.016]),
            0.032,
            0.025,
            C.bronzeLit,
          );
      }
    }
  }
}
function armorDetail(out, tier) {
  if (tier < 2) return;
  const count = tier === 2 ? 5 : 8,
    sections = tier === 2 ? 10 : 16;
  for (let i = 0; i < count; i++) {
    const y0 = mix(19.68, 20.5, i / count),
      y1 = mix(19.68, 20.5, (i + 1) / count),
      w = mix(0.405, 0.335, i / (count - 1)),
      r = mix(0.315, 0.251, i / (count - 1));
    const p = (a, y, lift) =>
      A([w * Math.sin(a) - 0.024, y + 0.044 * Math.cos(2 * a), 0.023 + r * Math.cos(a) + lift]);
    for (let j = 0; j < sections; j++) {
      const a = mix(-1.39, 1.39, j / sections),
        b = mix(-1.39, 1.39, (j + 1) / sections),
        m = (a + b) / 2;
      face(
        out,
        'bronze',
        i % 3 === 0 ? 'ridge' : 'bronze',
        [p(a, y0, 0.016), p(b, y0, 0.016), p(b, y1, -0.012), p(a, y1, -0.012)],
        [Math.sin(m), 0, Math.cos(m)],
      );
      if (tier >= 3)
        face(
          out,
          'bronze',
          'black',
          [p(a, y0 - 0.015, 0.004), p(b, y0 - 0.015, 0.004), p(b, y0, 0.016), p(a, y0, 0.016)],
          [Math.sin(m), -0.15, Math.cos(m)],
        );
    }
    if (tier >= 3)
      for (const side of [-1, 1])
        ornamentSphere(
          out,
          [side * 0.216 - 0.018, y0 + 0.047, 0.027 + r * 0.84],
          [0.016, 0.021, 0.012],
          6,
          4,
          'ridge',
        );
  }
  const sash = Array.from({ length: 11 }, (_, j) => {
    const t = j / 10;
    return A([mix(-0.38, 0.3, t), mix(20.78, 20.24, t), 0.239 + 0.073 * Math.sin(t * Math.PI)]);
  });
  beamPath(out, 'bronze', sash, 0.059, 0.035, C.ridge);
  ornamentSphere(out, [0.025, 20.778, 0.265], [0.052, 0.053, 0.021], 8, 5, 'bronzeLit');
  for (const side of [-1, 1]) {
    const mantle = [
      [-0.015, 20.986, 0.194],
      [0.27, 21.041, 0.116],
      [0.464, 20.89, 0.092],
      [0.365, 20.716, 0.253],
      [0.132, 20.788, 0.29],
    ].map(([x, y, z]) => A([x * side, y, z]));
    for (const [i, idx] of [
      [0, [0, 1, 4]],
      [1, [1, 2, 3]],
      [2, [1, 3, 4]],
    ])
      face(
        out,
        'bronze',
        i === 1 ? 'ridge' : 'bronze',
        idx.map((k) => mantle[k]),
        [side * 0.2, 0.25, 0.85],
      );
    if (tier >= 3) beamPath(out, 'bronze', mantle.slice(2), 0.027, 0.025, C.patina);
  }
  if (tier >= 3)
    for (const sign of [-1, 1]) {
      const ring = Array.from({ length: 14 }, (_, j) => {
        const q = (TAU * j) / 14;
        return A([sign * 0.257 + 0.091 * Math.cos(q), 19.68 + 0.102 * Math.sin(q), 0.24]);
      });
      beamPath(out, 'bronze', ring, 0.024, 0.03, C.ridge, true);
    }
}
function attributes(out, tier) {
  const { cross, sword } = layout.statue;
  const along = norm(cross.top.map((v, i) => v - cross.bottom[i])),
    perp = [along[1], -along[0], 0];
  const center = lerp(
    cross.bottom,
    cross.top,
    (cross.armY - cross.bottom[1]) / (cross.top[1] - cross.bottom[1]),
  );
  const end = (sign) => center.map((v, i) => v + (sign * perp[i] * cross.armWidth) / 2);
  beam(out, 'bronze', A(cross.bottom), A(cross.top), 0.159, 0.119, C.patina);
  beam(out, 'bronze', A(end(-1)), A(end(1)), 0.148, 0.11, C.patina);
  const aim = norm(sword.tip.map((v, i) => v - sword.hand[i])),
    axis = norm([aim[1], -aim[0], 0]);
  const grip = sword.hand.map((v, i) => v + aim[i] * 0.1),
    pommel = sword.hand.map((v, i) => v - aim[i] * 0.17);
  const mid = lerp(grip, sword.tip, 0.55),
    blade = (p, w, s) => A(p.map((v, i) => v + s * w * axis[i]));
  const bladeWidth = tier === 0 ? 0.061 : 0.042;
  for (const s of [-1, 1]) {
    const b = blade(grip, bladeWidth, -1),
      c = blade(grip, bladeWidth, 1),
      v = blade(mid, bladeWidth * 0.7, 1),
      u = blade(mid, bladeWidth * 0.7, -1);
    const lift = (p) => p.map((q, i) => q + (i === 2 ? s * 0.011 : 0));
    face(out, 'bronze', 'verdigris', [lift(b), lift(c), lift(v), lift(u)], [0, 0, s]);
    face(out, 'bronze', 'verdigris', [lift(u), lift(v), A(sword.tip)], [0, 0, s]);
  }
  beam(out, 'bronze', A(pommel), A(grip), 0.061, 0.054, C.ridge);
  if (tier) {
    const a = grip.map((v, i) => v - axis[i] * 0.134),
      b = grip.map((v, i) => v + axis[i] * 0.112);
    beam(out, 'bronze', A(a), A(b), 0.051, 0.046, C.patina);
    if (tier >= 2)
      for (const [x, y, z] of [sword.hand, [1.076, 21.079, 0.241]])
        for (let j = 0; j < 4; j++) {
          beam(
            out,
            'bronze',
            A([x - 0.053, y - 0.042 + j * 0.027, z]),
            A([x + 0.042, y - 0.039 + j * 0.027, z + 0.042]),
            0.027,
            0.028,
            C.ridge,
          );
        }
  }
}
function statue(out, tier) {
  const n = [6, 9, 12, 20, 24][tier];
  cloak(out, tier);
  body(out, tier ? torso : [torso[0], torso[2], torso[4], torso[6]], n, 'bronze');
  for (const p of legs) {
    limb(out, tier ? p : [p[0], p[2], p[4]], n, 'bronze');
    const [x, y, z] = p[0];
    ornamentSphere(out, [x, y - 0.004, z + 0.07], [0.116, 0.054, 0.204], n, tier ? 6 : 4, 'black');
  }
  for (const p of arms) limb(out, tier ? p : [p[0], p[2], p[4]], n, 'bronze');
  head(out, tier);
  armorDetail(out, tier);
  attributes(out, tier);
}
export function buildColumnLevel(out, level = 'master') {
  const tier = TIERS[level];
  if (tier === undefined) throw Error(`Unknown Sigismund’s Column tier ${level}`);
  pedestal(out, tier);
  shaft(out, tier);
  statue(out, tier);
}
export const buildColumnSkyline = (out) => buildColumnLevel(out, 'skyline');
export const buildColumnDistrict = (out) => buildColumnLevel(out, 'district');
export const buildColumnStreet = (out) => buildColumnLevel(out, 'street');
export const buildColumnCloseup = (out) => buildColumnLevel(out, 'closeup');

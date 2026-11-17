/** Hubert Le Sueur's equestrian monument at the top of Whitehall. */
import { readFileSync } from 'node:fs';
import {
  beamPath,
  chamferedRectangle,
  cross,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.55, metallic: 0.63 },
  limestone: { slot: 'wall', graph: 'stone_limestone_raw', roughness: 0.87 },
  granite: { slot: 'foundation', graph: 'stone_granite', roughness: 0.88 },
};
const palette = {
  bronze: '505954',
  shine: '656d64',
  fold: '3a4440',
  black: '2b3532',
  stone: 'd4c9ad',
  carving: 'ddd1b7',
  crease: 'b1a48c',
  granite: '8c8c81',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([name, h]) => [
    name,
    h.match(/../g).map((v) => {
      const x = parseInt(v, 16) / 255;
      return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const [cx, cz] = layout.center;
const padY = 3.47;
const tau = Math.PI * 2;
const m = (a, b, t) => a + (b - a) * t;
const shape = (x, y, z) => [cx + x, padY + y, cz + z];
const side = (p, sign) => [p[0] * sign, p[1], p[2]];
function organic(out, slot, tint, form, d) {
  const n = [4, 8, 16, 32, 40][d],
    sub = [1, 1, 2, 4, 5][d];
  const samples = [
    ...form.flatMap((p, i) => {
      if (i === form.length - 1) return [];
      const a = form[Math.max(0, i - 1)],
        b = form[i + 1],
        c = form[Math.min(i + 2, form.length - 1)];
      return Array.from({ length: sub }, (_, j) => {
        if (!j) return p;
        const t = j / sub,
          t2 = t * t,
          t3 = t2 * t;
        return p.map((v, k) => {
          const y =
            0.5 *
            (2 * v +
              (-a[k] + b[k]) * t +
              (2 * a[k] - 5 * v + 4 * b[k] - c[k]) * t2 +
              (-a[k] + 3 * v - 3 * b[k] + c[k]) * t3);
          return k < 3 ? y : Math.max(0.003, y);
        });
      });
    }),
    form.at(-1),
  ];
  const rings = samples.map(([x, y, z, u, v], i) => {
    const a = samples[Math.max(0, i - 1)],
      b = samples[Math.min(i + 1, samples.length - 1)];
    const axis = normalize([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    const reference = Math.abs(axis[0]) > 0.94 ? [0, 1, 0] : [1, 0, 0];
    const sideways = normalize(
      reference.map((v, i) => v - axis[i] * reference.reduce((s, r, j) => s + r * axis[j], 0)),
    );
    const outward = cross(axis, sideways);
    return Array.from({ length: n }, (_, j) => {
      const t = (j / n) * tau,
        r = Math.cos(t) * u,
        s = Math.sin(t) * v;
      return [
        x + sideways[0] * r + outward[0] * s,
        y + sideways[1] * r + outward[1] * s,
        z + sideways[2] * r + outward[2] * s,
      ];
    });
  });
  for (let i = 1; i < rings.length; i++)
    for (let j = 0; j < n; j++) {
      const a = rings[i - 1][j],
        b = rings[i - 1][(j + 1) % n],
        c = rings[i][(j + 1) % n],
        e = rings[i][j];
      for (const p of [
        [a, b, c],
        [a, c, e],
      ])
        out.addTriangle(slot, '', p, normalFor(...p), undefined, colors[tint]);
    }
  for (const r of [rings[0].toReversed(), rings.at(-1)])
    out.addConvexPolygon(slot, '', r, normalFor(r[0], r[1], r[2]), undefined, colors[tint]);
}
function form(out, tint, rows, d) {
  organic(
    out,
    'bronze',
    tint,
    rows.map(([x, y, z, a, b]) => [...shape(x, y, z), a, b]),
    d,
  );
}
function ellipsoid(out, slot, tint, center, radii, d) {
  const n = [5, 7, 10, 15, 20][d];
  sphere(out, slot, center, radii, colors[tint], n, Math.max(4, Math.floor(n * 0.6)));
}
function strap(out, points, width, depth, tint = 'fold') {
  beamPath(
    out,
    'bronze',
    points.map((p) => shape(...p)),
    width,
    depth,
    colors[tint],
  );
}
const standingFore = [
  [0.27, 1.17, 0.48, 0.18, 0.24],
  [0.28, 0.84, 0.44, 0.115, 0.14],
  [0.29, 0.57, 0.46, 0.076, 0.077],
  [0.29, 0.24, 0.47, 0.063, 0.057],
  [0.3, 0.1, 0.5, 0.088, 0.088],
  [0.3, -0.03, 0.55, 0.096, 0.13],
];
const raisedFore = [
  [0.28, 1.19, 0.51, 0.19, 0.2],
  [0.29, 0.94, 0.62, 0.14, 0.16],
  [0.3, 0.89, 0.94, 0.102, 0.098],
  [0.31, 0.93, 1.24, 0.082, 0.092],
  [0.32, 0.78, 1.32, 0.065, 0.068],
  [0.32, 0.5, 1.31, 0.055, 0.068],
  [0.32, 0.42, 1.32, 0.098, 0.105],
  [0.32, 0.355, 1.34, 0.077, 0.086],
];
const hind = [
  [0.21, 1.3, -0.9, 0.24, 0.28],
  [0.3, 1.01, -0.87, 0.19, 0.23],
  [0.31, 0.79, -0.73, 0.137, 0.17],
  [0.32, 0.56, -0.95, 0.084, 0.105],
  [0.32, 0.38, -1.14, 0.074, 0.087],
  [0.32, 0.17, -1.05, 0.06, 0.071],
  [0.33, -0.03, -0.96, 0.104, 0.13],
];
const torso = [
  [0, 1.17, -1.35, 0.055, 0.15],
  [0, 1.23, -1.22, 0.27, 0.38],
  [0, 1.25, -0.97, 0.46, 0.56],
  [0, 1.17, -0.55, 0.47, 0.55],
  [0, 1.16, -0.12, 0.43, 0.56],
  [0, 1.24, 0.29, 0.46, 0.57],
  [0, 1.3, 0.62, 0.4, 0.47],
  [0, 1.31, 0.83, 0.18, 0.28],
  [0, 1.31, 0.88, 0.045, 0.09],
];
const neck = [
  [0, 1.27, 0.43, 0.27, 0.28],
  [0, 1.58, 0.47, 0.36, 0.375],
  [0, 1.91, 0.63, 0.28, 0.36],
  [0, 2.2, 0.82, 0.22, 0.29],
  [0, 2.44, 0.96, 0.175, 0.22],
  [0, 2.58, 1.08, 0.145, 0.14],
];
const head = [
  [0, 2.5, 0.9, 0.16, 0.15],
  [0, 2.52, 1.06, 0.185, 0.251],
  [0, 2.44, 1.25, 0.161, 0.225],
  [0, 2.26, 1.39, 0.136, 0.153],
  [0, 2.14, 1.48, 0.135, 0.111],
  [0, 2.115, 1.53, 0.095, 0.079],
  [0, 2.1, 1.555, 0.054, 0.044],
];
function horse(out, d) {
  form(out, 'bronze', torso, d);
  form(out, 'bronze', neck, d);
  form(out, 'bronze', head, d);
  for (const [mirror, rows] of [
    [1, standingFore],
    [-1, raisedFore],
    [1, hind],
    [-1, hind.map(([x, y, z, a, b]) => [x, y, z + 0.115 * (1 - y / 1.3), a, b])],
  ]) {
    form(
      out,
      'bronze',
      rows.map(([x, y, z, a, b]) => [x * mirror, y, z, a, b]),
      d,
    );
  }
  form(
    out,
    'fold',
    [
      [0, 1.48, -1.18, 0.092, 0.11],
      [-0.03, 1.28, -1.38, 0.109, 0.13],
      [-0.03, 0.93, -1.48, 0.116, 0.108],
      [-0.01, 0.55, -1.49, 0.108, 0.079],
      [0.03, 0.16, -1.53, 0.08, 0.046],
      [0.04, 0.06, -1.61, 0.027, 0.022],
    ],
    d,
  );
  for (const s of [-1, 1]) {
    form(
      out,
      'bronze',
      [
        [s * 0.095, 2.58, 1.1, 0.062, 0.067],
        [s * 0.118, 2.73, 1.095, 0.041, 0.047],
        [s * 0.113, 2.86, 1.14, 0.009, 0.015],
      ],
      d,
    );
  }
  if (d === 0) return;
  for (const s of [-1, 1]) {
    ellipsoid(out, 'bronze', 'fold', shape(s * 0.149, 2.47, 1.25), [0.03, 0.036, 0.052], d);
    ellipsoid(out, 'bronze', 'black', shape(s * 0.123, 2.17, 1.5), [0.027, 0.038, 0.039], d);
    strap(
      out,
      [
        [s * 0.127, 2.15, 1.43],
        [s * 0.171, 2.31, 1.23],
        [s * 0.167, 2.53, 1.13],
        [s * 0.095, 2.63, 1.02],
      ],
      0.037,
      0.012,
    );
    strap(
      out,
      [
        [s * 0.139, 2.17, 1.43],
        [s * 0.205, 2.05, 1.39],
        [s * 0.26, 1.97, 1.24],
        [s * 0.35, 1.93, 0.67],
        [s * 0.28, 2.02, 0.24],
        [s * 0.2, 2.09, 0.07],
      ],
      0.024,
      0.011,
    );
    if (d < 2) continue;
    strap(
      out,
      [
        [s * 0.133, 2.12, 1.45],
        [s * 0.205, 1.97, 1.42],
        [s * 0.245, 1.86, 1.33],
        [s * 0.28, 1.83, 1.17],
        [s * 0.34, 1.85, 0.65],
        [s * 0.27, 2.0, 0.19],
        [s * 0.18, 2.1, 0.04],
      ],
      0.015,
      0.009,
    );
    for (let i = 0; i < d * 3; i++) {
      const u = i / (d * 3),
        x = s * m(0.05, 0.18, u);
      strap(
        out,
        [
          [x, 2.58 - u * 0.18, 1.03 - u * 0.62],
          [x + s * 0.018, 2.47 - u * 0.25, 1.02 - u * 0.62],
          [x + s * 0.01, 2.39 - u * 0.25, 0.98 - u * 0.57],
        ],
        0.027,
        0.012,
        i % 2 ? 'fold' : 'bronze',
      );
    }
  }
}
function rider(out, d) {
  form(
    out,
    'bronze',
    [
      [0, 1.6, -0.37, 0.178, 0.166],
      [0, 1.77, -0.3, 0.235, 0.182],
      [0, 2.01, -0.29, 0.238, 0.158],
      [0, 2.21, -0.32, 0.28, 0.153],
      [0, 2.34, -0.31, 0.25, 0.12],
      [0, 2.4, -0.28, 0.086, 0.077],
    ],
    d,
  );
  form(
    out,
    'bronze',
    [
      [0, 2.33, -0.28, 0.084, 0.077],
      [0, 2.45, -0.26, 0.086, 0.09],
      [0, 2.49, -0.24, 0.09, 0.109],
      [0, 2.57, -0.26, 0.126, 0.11],
      [0, 2.73, -0.29, 0.14, 0.128],
      [0, 2.81, -0.3, 0.085, 0.083],
      [0, 2.84, -0.3, 0.011, 0.02],
    ],
    d,
  );
  for (const s of [-1, 1]) {
    const mirrored = (rows) => rows.map(([x, y, z, a, b]) => [...side([x, y, z], s), a, b]);
    form(
      out,
      'bronze',
      mirrored([
        [0.18, 1.79, -0.37, 0.145, 0.18],
        [0.3, 1.67, -0.25, 0.14, 0.15],
        [0.39, 1.55, -0.12, 0.117, 0.114],
        [0.43, 1.34, -0.17, 0.077, 0.087],
        [0.43, 1.17, -0.17, 0.072, 0.07],
        [0.42, 1.05, -0.1, 0.074, 0.069],
        [0.42, 1.04, 0.015, 0.043, 0.052],
      ]),
      d,
    );
    form(
      out,
      'bronze',
      mirrored([
        [0.19, 2.28, -0.28, 0.117, 0.124],
        [0.29, 2.2, -0.24, 0.113, 0.101],
        [0.32, 2.03, -0.2, 0.096, 0.098],
        [0.3, 2.02, -0.04, 0.081, 0.087],
        [0.2, 2.07, 0.097, 0.067, 0.061],
        [0.17, 2.08, 0.16, 0.047, 0.045],
      ]),
      d,
    );
    if (d < 1) continue;
    ellipsoid(out, 'bronze', 'fold', shape(s * 0.123, 2.64, -0.298), [0.065, 0.165, 0.09], d);
    strap(
      out,
      [
        [s * 0.38, 1.4, -0.16],
        [s * 0.48, 1.22, -0.08],
        [s * 0.49, 1.03, -0.05],
        [s * 0.39, 1.03, 0.012],
        [s * 0.38, 1.2, -0.066],
      ],
      0.022,
      0.023,
      'shine',
    );
    strap(
      out,
      [
        [s * 0.23, 1.76, -0.59],
        [s * 0.42, 1.58, -0.76],
        [s * 0.39, 1.43, -0.92],
        [s * 0.32, 1.37, -0.98],
      ],
      0.047,
      0.016,
    );
    if (d < 2) continue;
    for (let i = 0; i < d * 3; i++) {
      const u = (i + 0.5) / (d * 3),
        z = m(-0.32, -0.38, u);
      ellipsoid(
        out,
        'bronze',
        i % 3 ? 'fold' : 'bronze',
        shape(
          s * (0.126 + 0.024 * Math.sin(i * 2)),
          2.74 - u * 0.28,
          z + 0.022 * Math.sin(i * 2.4),
        ),
        [0.044, 0.041, 0.054],
        d - 1,
      );
    }
    for (let i = 0; i < d + 2; i++) {
      const y = 1.17 + i * 0.046;
      strap(
        out,
        [
          [s * 0.37, y, -0.04],
          [s * 0.446, y - 0.012, -0.077],
          [s * 0.496, y, -0.144],
        ],
        0.018,
        0.01,
        'shine',
      );
    }
    for (let i = 0; i < 3; i++) {
      const y = 2.245 - i * 0.051;
      strap(
        out,
        [
          [s * 0.218, y, -0.119],
          [s * 0.28, y + 0.007, -0.137],
          [s * 0.353, y - 0.007, -0.205],
        ],
        0.014,
        0.01,
        'shine',
      );
    }
    strap(
      out,
      [
        [s * 0.049, 2.597, -0.104],
        [s * 0.085, 2.607, -0.117],
        [s * 0.111, 2.596, -0.147],
      ],
      0.021,
      0.01,
    );
    strap(
      out,
      [
        [s * 0.035, 2.65, -0.173],
        [s * 0.065, 2.659, -0.168],
        [s * 0.089, 2.65, -0.183],
      ],
      0.013,
      0.006,
      'black',
    );
  }
  if (d < 1) return;
  ellipsoid(out, 'bronze', 'bronze', shape(0, 2.557, -0.117), [0.034, 0.055, 0.043], d);
  form(
    out,
    'fold',
    [
      [0, 2.56, -0.115, 0.08, 0.028],
      [0, 2.5, -0.117, 0.072, 0.037],
      [0, 2.43, -0.147, 0.027, 0.026],
    ],
    d,
  );
  strap(
    out,
    [
      [-0.08, 2.539, -0.123],
      [0, 2.533, -0.087],
      [0.083, 2.538, -0.125],
    ],
    0.028,
    0.012,
    'fold',
  );
  strap(
    out,
    [
      [-0.24, 2.285, -0.18],
      [-0.17, 2.2, -0.114],
      [0.025, 2.087, -0.106],
      [0.213, 1.923, -0.171],
    ],
    0.05,
    0.018,
    'shine',
  );
  strap(
    out,
    [
      [0.29, 1.98, -0.35],
      [0.42, 1.66, -0.64],
      [0.47, 1.42, -0.88],
      [0.54, 1.22, -1.07],
    ],
    0.024,
    0.022,
    'shine',
  );
  if (d >= 2)
    strap(
      out,
      [
        [-0.13, 2.093, 0.278],
        [-0.16, 2.09, 0.1],
        [-0.16, 2.06, -0.08],
      ],
      0.032,
      0.033,
      'shine',
    );
}
function moulding(out, slot, tint, rows) {
  loft(
    out,
    slot,
    rows.map(([y, w, z, t]) => chamferedRectangle(cx, y, cz, w, z, t)),
    colors[tint],
  );
}
function panelRelief(out, d, sign) {
  const z = cz + sign * 0.435 * layout.depth;
  const p = (x, y, t = 0) => [cx + x, y, z + sign * t];
  const relief = (x, y, t, r) => ellipsoid(out, 'limestone', 'carving', p(x, y, t), r, d);
  const vine = (path, w = 0.039, t = 0.035) =>
    beamPath(
      out,
      'limestone',
      path.map((q) => p(...q)),
      w,
      t,
      colors.carving,
    );
  const shield = [
    [-0.32, 2.48, 0.05],
    [0.32, 2.48, 0.05],
    [0.31, 2.1, 0.11],
    [0.2, 1.91, 0.11],
    [0, 1.81, 0.14],
    [-0.2, 1.91, 0.11],
    [-0.31, 2.1, 0.11],
  ];
  const pts = shield.map((q) => p(...q));
  const center = p(0, 2.18, 0.17);
  for (let i = 0; i < pts.length; i++) {
    let edge = [pts[i], pts[(i + 1) % pts.length], center],
      n = normalFor(...edge);
    if (n[2] * sign < 0) {
      edge = edge.toReversed();
      n = n.map((v) => -v);
    }
    out.addTriangle('limestone', '', edge, n, undefined, colors[i % 2 ? 'stone' : 'carving']);
  }
  vine([...shield, shield[0]], 0.056, 0.056);
  relief(0, 2.67, 0.056, [0.27, 0.105, 0.095]);
  relief(0, 2.86, 0.105, [0.052, 0.054, 0.036]);
  for (const s of [-1, 1]) {
    relief(s * 0.47, 2.19, 0.084, [0.125, 0.113, 0.095]);
    organic(
      out,
      'limestone',
      'carving',
      [
        [s * 0.46, 1.69, 0.08, 0.066, 0.044],
        [s * 0.53, 1.9, 0.095, 0.084, 0.068],
        [s * 0.54, 2.07, 0.083, 0.057, 0.06],
      ].map(([x, y, z, a, b]) => [...p(x, y, z), a, b]),
      d,
    );
    vine(
      [
        [s * 0.47, 1.81, 0.12],
        [s * 0.34, 1.85, 0.2],
        [s * 0.24, 1.98, 0.18],
      ],
      0.085,
      0.065,
    );
    vine(
      [
        [s * 0.58, 1.89, 0.06],
        [s * 0.65, 2.18, 0.06],
        [s * 0.7, 2.53, 0.025],
        [s * 0.61, 2.7, 0.025],
      ],
      0.084,
      0.074,
    );
    vine(
      [
        [s * 0.04, 2.65, 0.14],
        [s * 0.11, 2.79, 0.123],
        [s * 0.23, 2.78, 0.075],
        [s * 0.25, 2.68, 0.069],
      ],
      0.035,
      0.034,
    );
    if (d >= 2)
      for (let i = 0; i < 6; i++) {
        const u = i / 5,
          x = s * (0.36 + u * 0.27),
          y = 1.56 + u * 0.21;
        vine(
          [
            [s * 0.23, 1.57, 0.08],
            [x, y, 0.12],
            [x + s * 0.06, y + 0.09, 0.06],
          ],
          0.028,
          0.032,
        );
      }
    if (d >= 2) {
      vine(
        [
          [s * 0.54, 2.08, 0.12],
          [s * 0.5, 1.95, 0.16],
          [s * 0.38, 1.94, 0.21],
          [s * 0.31, 2.04, 0.14],
        ],
        0.06,
        0.05,
      );
      vine(
        [
          [s * 0.52, 1.75, 0.1],
          [s * 0.42, 1.63, 0.16],
          [s * 0.48, 1.45, 0.13],
          [s * 0.6, 1.43, 0.092],
        ],
        0.1,
        0.075,
      );
      vine(
        [
          [s * 0.56, 1.72, 0.12],
          [s * 0.64, 1.62, 0.12],
          [s * 0.59, 1.51, 0.15],
        ],
        0.075,
        0.05,
      );
      relief(s * 0.46, 2.2, 0.158, [0.072, 0.071, 0.027]);
      for (let i = 0; i < 5; i++) {
        const x = s * (0.57 + i * 0.025),
          y = 2.23 + i * 0.069;
        vine(
          [
            [x, y, 0.071],
            [x + s * 0.035, y + 0.1, 0.104],
            [x + s * 0.017, y + 0.18, 0.06],
          ],
          0.034,
          0.023,
        );
      }
    }
  }
  if (d < 2) return;
  vine(
    [
      [0, 1.91, 0.164],
      [0, 2.43, 0.169],
    ],
    0.016,
    0.025,
  );
  vine(
    [
      [-0.27, 2.186, 0.114],
      [0.27, 2.186, 0.114],
    ],
    0.016,
    0.025,
  );
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const y = 1.99 + i * 0.14;
      vine(
        [
          [s * 0.078, y, 0.171],
          [s * 0.17, y + 0.03, 0.169],
          [s * 0.222, y - 0.01, 0.135],
        ],
        0.025,
        0.025,
      );
    }
}
function base(out, d) {
  const w = layout.width,
    z = layout.depth;
  moulding(out, 'granite', 'granite', [
    [-0.4, w * 1.08, z * 1.09, 0.11],
    [0.16, w * 1.08, z * 1.09, 0.11],
    [0.3, w * 1.01, z * 1.01, 0.1],
  ]);
  const profiles =
    d === 0
      ? [
          [0.3, w, z, 0.08],
          [0.89, w * 0.8, z * 0.88, 0.09],
          [2.98, w * 0.8, z * 0.88, 0.1],
          [3.32, w * 1.06, z * 1.03, 0.1],
        ]
      : [
          [0.3, w, z, 0.1],
          [0.38, w, z, 0.1],
          [0.5, w * 0.97, z * 0.98, 0.1],
          [0.56, w * 0.94, z * 0.97, 0.1],
          [0.73, w * 0.85, z * 0.91, 0.1],
          [0.82, w * 0.82, z * 0.89, 0.1],
          [0.9, w * 0.84, z * 0.9, 0.08],
          [0.96, w * 0.82, z * 0.88, 0.08],
          [2.83, w * 0.81, z * 0.88, 0.085],
          [2.9, w * 0.86, z * 0.9, 0.085],
          [2.97, w * 0.88, z * 0.95, 0.085],
          [3.02, w * 0.89, z * 0.96, 0.09],
          [3.09, w * 0.96, z * 1.0, 0.09],
          [3.2, w * 0.97, z * 1.02, 0.11],
          [3.28, w * 1.08, z * 1.05, 0.12],
          [3.32, w * 1.08, z * 1.05, 0.13],
        ];
  moulding(out, 'limestone', 'stone', profiles);
  const n = d === 0 ? 8 : 20;
  loft(
    out,
    'granite',
    [
      radialRing(3.316, w * 0.431, z * 0.47, n, [cx, cz]),
      radialRing(padY, w * 0.41, z * 0.455, n, [cx, cz]),
    ],
    colors.granite,
  );
  if (d >= 1) {
    for (const sign of [-1, 1]) {
      const x = cx + sign * w * 0.412,
        x0 = x + sign * 0.014;
      beamPath(
        out,
        'limestone',
        [
          [x0, 1.06, cz - z * 0.4],
          [x0, 2.76, cz - z * 0.4],
          [x0, 2.76, cz + z * 0.4],
          [x0, 1.06, cz + z * 0.4],
        ],
        0.044,
        0.038,
        colors.crease,
        true,
      );
      panelRelief(out, d, sign);
    }
  }
}
export function buildStatueLevel(out, level) {
  const d = tiers[level];
  if (d === undefined) throw new Error('Unknown Charing Cross detail level');
  base(out, d);
  horse(out, d);
  rider(out, d);
}
export const buildSkyline = (out) => buildStatueLevel(out, 'skyline');
export const buildDistrict = (out) => buildStatueLevel(out, 'district');
export const buildStreet = (out) => buildStatueLevel(out, 'street');
export const buildCloseup = (out) => buildStatueLevel(out, 'closeup');
export const buildMaster = (out) => buildStatueLevel(out, 'master');

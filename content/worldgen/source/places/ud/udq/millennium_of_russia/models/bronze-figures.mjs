/** Sculpted silhouettes, drapery and attributes for the Millennium of Russia bronze groups. */
import {
  beam,
  cross,
  loft,
  normalFor,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  tube,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const TAU = Math.PI * 2;
const bronze = 'bronze';
const mix = (a, b, t) => a + (b - a) * t;
const palette = {
  cast: '69716a',
  shade: '545f56',
  patina: '72857a',
  edge: '8c9383',
  dark: '4d564f',
  stone: '767a74',
  seam: '657168',
  iron: '555b53',
  glass: 'c0b28a',
  gravel: 'b5a58c',
  paving: '9e9d91',
};
export const color = Object.fromEntries(
  Object.entries(palette).map(([key, hex]) => [
    key,
    hex.match(/../g).map((c) => {
      const v = parseInt(c, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }),
  ]),
);
export const radial = (a, r, y) => [Math.sin(a) * r, y, Math.cos(a) * r];
export const localFrame =
  (origin, angle, scale = 1, depth = 1) =>
  ([x, y, z]) => [
    origin[0] + scale * (x * Math.cos(angle) + z * depth * Math.sin(angle)),
    origin[1] + scale * y,
    origin[2] + scale * (-x * Math.sin(angle) + z * depth * Math.cos(angle)),
  ];
const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const Pn = (p, d) => sub(p(d), p([0, 0, 0]));
export function face(out, slot, tint, vertices, desired) {
  if (vertices.length === 4) {
    face(out, slot, tint, vertices.slice(0, 3), desired);
    face(out, slot, tint, [vertices[0], vertices[2], vertices[3]], desired);
    return;
  }
  let points = vertices;
  let n = normalFor(...points.slice(0, 3));
  if (Math.hypot(...n) < 0.99) return;
  if (dot(n, desired) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', points, n, undefined, color[tint]);
}
function shape(out, p, sections, sides, tint, folds = 0) {
  const rings = sections.map(([y, x, z, rx, rz], j) =>
    Array.from({ length: sides }, (_, i) => {
      const a = (i * TAU) / sides;
      const contour =
        1 + folds * (0.65 * Math.cos(a * 3 + j * 0.64) + 0.35 * Math.sin(a * 5 - j * 0.69));
      return p([x + Math.cos(a) * rx * contour, y, z - Math.sin(a) * rz * contour]);
    }),
  );
  loft(out, bronze, rings, color[tint]);
}
function oval(out, p, [x, y, z], [rx, ry, rz], sides, steps, tint) {
  const rings = Array.from({ length: steps - 1 }, (_, j) => {
    const a = Math.PI * ((j + 1) / steps - 0.5),
      h = Math.sin(a),
      r = Math.cos(a);
    return [y + ry * h, x, z, rx * r, rz * r];
  });
  shape(
    out,
    p,
    [[y - ry, x, z, rx * 0.027, rz * 0.027], ...rings, [y + ry, x, z, rx * 0.027, rz * 0.027]],
    sides,
    tint,
  );
}
function swept(out, p, stations, sides, tint) {
  const centers = stations.map(([pt]) => p(pt));
  const scale = Math.hypot(...Pn(p, [0, 1, 0]));
  let u;
  const rings = centers.map((c, i) => {
    const along = normalize(
      sub(centers[Math.min(i + 1, centers.length - 1)], centers[Math.max(i - 1, 0)]),
    );
    if (u) {
      const tangent = dot(u, along);
      u = normalize(u.map((x, k) => x - tangent * along[k]));
    } else {
      u = normalize(cross(along, Math.abs(along[1]) > 0.94 ? [1, 0, 0] : [0, 1, 0]));
    }
    const v = normalize(cross(along, u));
    return Array.from({ length: sides }, (_, j) => {
      const a = (j * TAU) / sides,
        r = stations[i][1] * scale;
      return c.map((q, k) => q + r * (u[k] * Math.cos(a) + v[k] * Math.sin(a)));
    });
  });
  for (let j = 0; j + 1 < rings.length; j++)
    for (let k = 0; k < sides; k++) {
      const i = (k + 1) % sides;
      const n = sub(rings[j][k], centers[j]);
      face(out, bronze, tint, [rings[j][k], rings[j][i], rings[j + 1][i], rings[j + 1][k]], n);
    }
  for (const [j, m] of [
    [0, 1],
    [rings.length - 1, rings.length - 2],
  ]) {
    const n = sub(centers[j], centers[m]);
    for (let k = 0; k < sides; k++)
      face(out, bronze, tint, [centers[j], rings[j][k], rings[j][(k + 1) % sides]], n);
  }
}
const armPoses = {
  guard: [
    [
      [-0.21, 0.66, 0.04],
      [-0.14, 0.49, 0.25],
    ],
    [
      [0.21, 0.67, 0.08],
      [0.22, 0.57, 0.24],
    ],
  ],
  raise: [
    [
      [-0.24, 0.81, 0.03],
      [-0.35, 0.98, 0.08],
    ],
    [
      [0.21, 0.65, 0.08],
      [0.24, 0.51, 0.19],
    ],
  ],
  standard: [
    [
      [-0.24, 0.66, 0.11],
      [-0.28, 0.6, 0.26],
    ],
    [
      [0.21, 0.67, 0.13],
      [0.18, 0.57, 0.25],
    ],
  ],
  sceptre: [
    [
      [-0.21, 0.64, 0.06],
      [-0.2, 0.52, 0.16],
    ],
    [
      [0.23, 0.72, 0.09],
      [0.26, 0.77, 0.24],
    ],
  ],
  prayer: [
    [
      [-0.19, 0.62, 0.09],
      [-0.032, 0.7, 0.23],
    ],
    [
      [0.18, 0.63, 0.09],
      [0.029, 0.69, 0.25],
    ],
  ],
  offer: [
    [
      [-0.21, 0.61, 0.12],
      [-0.1, 0.59, 0.34],
    ],
    [
      [0.19, 0.63, 0.13],
      [0.12, 0.61, 0.36],
    ],
  ],
  rest: [
    [
      [-0.21, 0.57, 0.09],
      [-0.26, 0.32, 0.22],
    ],
    [
      [0.2, 0.59, 0.1],
      [0.25, 0.39, 0.24],
    ],
  ],
  point: [
    [
      [-0.24, 0.74, 0.02],
      [-0.53, 0.76, 0.22],
    ],
    [
      [0.21, 0.63, 0.1],
      [0.14, 0.53, 0.2],
    ],
  ],
  bless: [
    [
      [-0.16, 0.71, 0.12],
      [-0.005, 0.86, 0.17],
    ],
    [
      [0.22, 0.74, 0.12],
      [0.34, 0.89, 0.19],
    ],
  ],
};
function cape(out, p, sides, detail, style) {
  const n = detail === 0 ? 4 : sides,
    rows = detail >= 3 ? 7 : 4;
  const hem = style === 'mail' ? 0.36 : style === 'coat' ? 0.22 : 0.11;
  const at = (j, i) => {
    const t = j / rows,
      u = (2 * i) / n - 1;
    const y = mix(0.79 - 0.07 * Math.abs(u), hem + 0.1 * Math.abs(u), t);
    const x = u * mix(0.172, 0.285, t) + 0.1 * t;
    const z = -mix(0.084, 0.173, t) + 0.039 * Math.sin(u * 12 + t * 3) - 0.035 * Math.abs(u);
    return p([x, y, z]);
  };
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < n; i++) {
      const pts = [at(j, i), at(j, i + 1), at(j + 1, i + 1), at(j + 1, i)];
      face(out, bronze, i % 4 === 0 ? 'patina' : 'cast', pts, Pn(p, [0, 0, -1]));
      if (i === 0 || i === n - 1 || j === rows - 1) {
        const inside = pts.map((v) => v.map((n, k) => n + Pn(p, [0, 0, 0.011])[k]));
        face(out, bronze, 'shade', inside, Pn(p, [0, 0, 1]));
      }
    }
}
function head(out, p, sides, detail, style, tint, relief) {
  shape(
    out,
    p,
    [
      [0.79, 0, 0.015, 0.035, 0.03],
      [0.824, 0, 0.022, 0.048, 0.04],
      [0.862, 0, 0.023, 0.061, 0.05],
      [0.907, 0, 0.018, 0.067, 0.058],
      [0.951, 0, 0.013, 0.057, 0.051],
      [0.967, 0, 0.008, 0.025, 0.027],
    ],
    sides,
    tint,
  );
  if (style === 'helmet') {
    shape(
      out,
      p,
      [
        [0.896, 0, 0.011, 0.074, 0.062],
        [0.919, 0, 0.009, 0.074, 0.063],
        [0.959, 0, 0.004, 0.06, 0.053],
        [1.008, 0, 0.004, 0.023, 0.03],
        [1.032, 0, 0.004, 0.009, 0.011],
      ],
      sides,
      'patina',
    );
  } else if (style === 'crown' || style === 'cap') {
    shape(
      out,
      p,
      [
        [0.9, 0, 0.01, 0.073, 0.06],
        [0.918, 0, 0.009, 0.078, 0.065],
        [0.971, 0, 0.01, 0.068, 0.06],
        [0.994, 0, 0.01, 0.048, 0.048],
        [1.016, 0, 0.01, 0.019, 0.021],
      ],
      sides,
      'shade',
    );
    if (style === 'crown') oval(out, p, [0, 1.021, 0.011], [0.019, 0.022, 0.019], sides, 4, 'edge');
  } else if (style === 'hood') {
    shape(
      out,
      p,
      [
        [0.824, 0, -0.01, 0.077, 0.037],
        [0.89, 0, -0.021, 0.084, 0.055],
        [0.96, 0, -0.017, 0.075, 0.06],
        [0.985, 0, -0.01, 0.034, 0.039],
      ],
      sides,
      'patina',
    );
  } else {
    shape(
      out,
      p,
      [
        [0.889, 0, -0.016, 0.065, 0.039],
        [0.931, 0, -0.015, 0.067, 0.046],
        [0.962, 0, 0.002, 0.052, 0.049],
        [0.976, 0, 0.004, 0.022, 0.026],
      ],
      sides,
      'shade',
    );
    if (style === 'laurel' && detail > 1)
      for (const s of [-1, 1])
        for (let i = 0; i < 5; i++)
          oval(
            out,
            p,
            [s * (0.058 - 0.005 * i), 0.922 + i * 0.008, 0.044 - i * 0.017],
            [0.014, 0.011, 0.02],
            5,
            4,
            'edge',
          );
  }
  if (detail < 2) return;
  const center = p([0, 0.88, 0.094]),
    left = p([-0.023, 0.863, 0.07]),
    right = p([0.024, 0.864, 0.071]),
    top = p([0, 0.909, 0.075]);
  face(out, bronze, tint, [left, right, center], Pn(p, [0, 0, 1]));
  face(out, bronze, tint, [center, right, top], Pn(p, [0, 0, 1]));
  face(out, bronze, tint, [left, center, top], Pn(p, [0, 0, 1]));
  if (relief || detail < 3) return;
  for (const s of [-1, 1]) {
    oval(out, p, [s * 0.064, 0.882, 0.022], [0.011, 0.025, 0.017], 6, 4, tint);
    swept(
      out,
      p,
      [
        [[s * 0.009, 0.901, 0.074], 0.006],
        [[s * 0.037, 0.901, 0.069], 0.008],
        [[s * 0.047, 0.895, 0.056], 0.004],
      ],
      5,
      'shade',
    );
  }
  swept(
    out,
    p,
    [
      [[-0.021, 0.846, 0.066], 0.004],
      [[0, 0.844, 0.078], 0.006],
      [[0.023, 0.846, 0.066], 0.004],
    ],
    5,
    'shade',
  );
  if (style === 'helmet' || style === 'crown' || style === 'cap')
    shape(
      out,
      p,
      [
        [0.798, 0, 0.043, 0.02, 0.023],
        [0.827, 0, 0.045, 0.045, 0.036],
        [0.86, 0, 0.035, 0.053, 0.032],
      ],
      sides,
      'shade',
      0.16,
    );
}
function wings(out, p, detail) {
  for (const side of [-1, 1]) {
    const at = ([x, y, z]) => p([x * side, y, z]);
    const n = detail === 0 ? 5 : detail === 1 ? 8 : 13;
    const root = (t) => [
      0.102 + 0.137 * t,
      0.806 + 0.065 * Math.sin(Math.PI * t),
      -0.107 - 0.018 * t,
    ];
    const tip = (t) => [
      0.24 + 0.42 * t,
      0.213 + 0.31 * t - 0.021 * Math.sin(t * Math.PI),
      -0.176 - 0.14 * t,
    ];
    for (let i = 0; i < n; i++) {
      const t = i / n,
        s = (i + 1) / n,
        m = (t + s) / 2;
      const a = at(root(t)),
        b = at(root(s)),
        c = at(tip(s)),
        d = at(tip(t));
      face(out, bronze, i % 4 === 0 ? 'patina' : 'cast', [a, b, c, d], Pn(p, [0, 0, 1]));
      face(out, bronze, 'shade', [a, d, c, b], Pn(p, [0, 0, -1]));
      if (detail >= 2) {
        const inset = tip(m).map((v, j) => mix(root(m)[j], v, 0.96));
        const start = root(m).map((v, j) => mix(v, inset[j], 0.31));
        tube(
          out,
          bronze,
          at(start),
          at(inset),
          0.008 * Math.hypot(...Pn(p, [0, 1, 0])),
          color.seam,
          5,
        );
      }
    }
    swept(
      out,
      at,
      [
        [[0.086, 0.76, -0.086], 0.059],
        [[0.2, 0.85, -0.129], 0.048],
        [[0.36, 0.777, -0.186], 0.021],
        [[0.58, 0.58, -0.24], 0.005],
      ],
      7,
      'patina',
    );
  }
}
function shield(out, p, type, detail) {
  const n = detail < 2 ? 8 : 16,
    ellipse = type === 'round shield';
  const boundary = Array.from({ length: n }, (_, i) => {
    const a = (i * TAU) / n,
      y = 0.37 + Math.sin(a) * (ellipse ? 0.2 : 0.31);
    const w = ellipse ? 1 : 0.75 + 0.25 * Math.sin(a);
    return [Math.cos(a) * 0.176 * w - 0.018, y, 0.251];
  });
  const hub = p([-0.018, 0.39, 0.304]);
  for (let i = 0; i < n; i++) {
    const a = boundary[i],
      b = boundary[(i + 1) % n];
    face(out, bronze, 'patina', [hub, p(a), p(b)], Pn(p, [0, 0, 1]));
    face(
      out,
      bronze,
      'shade',
      [p([a[0], a[1], 0.225]), p([b[0], b[1], 0.225]), p(b), p(a)],
      Pn(p, [a[0], a[1] - 0.37, 0.012]),
    );
  }
  if (detail >= 2) {
    tubePath(
      out,
      bronze,
      boundary.map(p),
      0.01 * Math.hypot(...Pn(p, [0, 1, 0])),
      color.edge,
      5,
      true,
    );
    oval(out, p, [-0.017, 0.39, 0.309], [0.028, 0.032, 0.018], 8, 5, 'edge');
    for (const a of [
      [-0.055, 0.51, 0.29],
      [0.039, 0.51, 0.29],
      [-0.045, 0.23, 0.28],
      [0.038, 0.23, 0.28],
    ])
      oval(out, p, a, [0.01, 0.012, 0.009], 6, 4, 'edge');
  }
}
function attributes(out, p, f, detail) {
  const type = f.object;
  if (type === 'wings') {
    wings(out, p, detail);
    return;
  }
  if (type === 'kite shield' || type === 'round shield') {
    shield(out, p, type, detail);
    return;
  }
  if (type === 'orb' || type === 'crown cushion' || type === 'child') {
    if (type === 'child') return;
    oval(
      out,
      p,
      type === 'orb' ? [0.02, 0.68, 0.27] : [0.01, 0.6, 0.37],
      type === 'orb' ? [0.065, 0.065, 0.061] : [0.135, 0.046, 0.08],
      8,
      5,
      'edge',
    );
    return;
  }
  const poles = {
    'raised cross': [[-0.355, 0.961, 0.08], [-0.38, 1.146, 0.075], 0.014],
    'long mace': [[-0.34, 0.61, 0.265], [0.48, 0.43, 0.26], 0.023],
    sceptre: [[0.26, 0.68, 0.24], [0.29, 0.96, 0.22], 0.013],
    sword: [[0.18, 0.6, 0.28], [0.55, 0.48, 0.29], 0.019],
    'broken spear': [[-0.29, 0.23, 0.28], [0.36, 0.18, 0.26], 0.02],
    'broken standard': [[-0.3, 0.19, 0.26], [0.44, 0.13, 0.25], 0.021],
    idol: [[-0.42, 0.33, 0.32], [0.2, 0.28, 0.25], 0.035],
  };
  const pole = poles[type];
  if (!pole) return;
  const [a, b, r] = pole,
    S = Math.hypot(...Pn(p, [0, 1, 0]));
  tube(out, bronze, p(a), p(b), r * S, color.edge, detail < 2 ? 5 : 8);
  if (type === 'raised cross') {
    for (const [y, width] of [
      [1.1, 0.07],
      [1.137, 0.039],
    ])
      tube(
        out,
        bronze,
        p([-0.38 - width, y, 0.073]),
        p([-0.38 + width, y, 0.073]),
        0.009 * S,
        color.edge,
        6,
      );
  } else if (type === 'long mace' || type === 'sceptre' || type === 'idol') {
    oval(out, p, b, [r * 1.65, r * 1.8, r * 1.65], 7, 5, 'patina');
  }
}

function smallFigure(out, p, f, detail, relief) {
  const n = detail === 0 || (relief && detail === 2) ? 4 : detail < 3 || relief ? 5 : 6;
  const tint = f.garment === 'robe' ? 'patina' : 'cast';
  const crouched = f.pose === 'kneel' || f.pose === 'recline' || f.pose === 'crouch';
  const hem = crouched ? 0.08 : f.garment === 'mail' ? 0.16 : 0.027;
  const body =
    detail < 2 || (relief && detail === 2)
      ? [
          [hem, 0, 0.01, 0.14, 0.077],
          [0.68, 0, 0.02, 0.164, 0.092],
          [0.8, 0, 0.01, 0.067, 0.049],
        ]
      : [
          [hem, -0.011, 0.02, 0.136, 0.083],
          [0.37, -0.016, 0.01, 0.133, 0.079],
          [0.59, 0.004, 0.015, 0.144, 0.094],
          [0.733, 0.008, 0.013, 0.165, 0.086],
          [0.8, 0, 0.012, 0.067, 0.045],
        ];
  shape(out, p, body, n, tint, 0.05);
  const cap = f.head === 'helmet' ? 0.999 : f.head === 'crown' ? 0.991 : 0.968;
  const skull = [
    [0.795, 0, 0.024, 0.032, 0.029],
    [0.866, 0, 0.029, 0.06, 0.05],
    [0.923, 0, 0.017, 0.061, 0.05],
    [cap, 0, 0.01, 0.018, 0.027],
  ];
  shape(out, p, relief ? skull.filter((_, i) => i !== 1) : skull, n, tint);
  if (detail === 0) {
    if (f.object === 'wings') {
      for (const side of [-1, 1]) {
        const wing = [
          [side * 0.12, 0.79, -0.08],
          [side * 0.37, 0.87, -0.16],
          [side * 0.57, 0.27, -0.2],
          [side * 0.23, 0.49, -0.14],
        ].map(p);
        face(out, bronze, 'shade', wing, Pn(p, [0, 0, 1]));
        face(out, bronze, 'shade', wing, Pn(p, [0, 0, -1]));
      }
    } else if (f.object === 'kite shield') {
      const a = p([-0.17, 0.56, 0.12]),
        b = p([0.17, 0.56, 0.12]),
        c = p([0, 0.09, 0.18]);
      face(out, bronze, 'patina', [a, b, c], Pn(p, [0, 0, 1]));
    } else if (f.object === 'raised cross') {
      const h = Math.hypot(...Pn(p, [0, 1, 0]));
      beam(
        out,
        bronze,
        p([-0.15, 0.7, 0.06]),
        p([-0.36, 1.13, 0.09]),
        h * 0.03,
        h * 0.024,
        color.edge,
      );
    }
    return;
  }
  if (relief && detail === 2) return;
  const hands = armPoses[f.gesture] ?? armPoses.guard;
  for (const [i, [elbow, hand]] of hands.entries()) {
    if (relief && i === 1 && f.gesture !== 'prayer' && f.gesture !== 'offer') continue;
    const side = i === 0 ? -1 : 1;
    swept(
      out,
      p,
      [
        [[side * 0.131, 0.735, 0.02], 0.052],
        [elbow, 0.037],
        [hand, 0.021],
      ],
      relief ? 4 : 5,
      tint,
    );
  }
  if (!relief) attributes(out, p, f, detail);
}

/** Figure local coordinates describe one full visible height, with independent posed limbs. */
export function figure(out, origin, yaw, f, detail, { relief = false, depth = 1 } = {}) {
  const crouched = f.pose === 'kneel' || f.pose === 'crouch' || f.pose === 'recline',
    stride = f.pose === 'stride',
    lean = f.pose === 'recline' ? 0.29 : crouched ? 0.1 : 0;
  const world = localFrame(origin, yaw, f.h, depth);
  const p = ([x, y, z]) =>
    world([
      x + lean * Math.max(0, y - 0.28),
      y,
      z + (crouched ? 0.082 * Math.max(0, y - 0.34) : 0),
    ]);
  if (detail < 2 || (relief && detail < 4)) {
    smallFigure(out, p, f, detail, relief);
    return p;
  }
  const sides = relief ? [4, 5, 6, 7, 8][detail] : [6, 8, 10, 13, 16][detail];
  const tint = f.garment === 'robe' ? 'patina' : 'cast';
  const hem = crouched ? 0.15 : f.garment === 'robe' ? 0.036 : f.garment === 'cloak' ? 0.2 : 0.42;
  const torso =
    relief && detail < 3
      ? [
          [hem, 0, 0.02, 0.121, 0.06],
          [0.51, 0, 0.01, 0.122, 0.081],
          [0.74, 0, 0.009, 0.155, 0.084],
          [0.797, 0, 0.01, 0.065, 0.052],
        ]
      : [
          [hem, -0.01, 0.02, 0.14, 0.085],
          [mix(hem, 0.49, 0.53), -0.015, 0.02, 0.152, 0.098],
          [0.52, 0.007, 0.017, 0.125, 0.086],
          [0.615, 0.016, 0.012, 0.13, 0.091],
          [0.711, 0.009, 0.015, 0.158, 0.099],
          [0.755, 0, 0.011, 0.177, 0.083],
          [0.797, 0, 0.009, 0.063, 0.055],
        ];
  shape(out, p, torso, sides, tint, f.garment === 'mail' ? 0.05 : 0.16);
  if (!relief && f.garment !== 'tunic' && detail > 0) cape(out, p, sides, detail, f.garment);
  if (!relief || detail > 1) {
    for (const s of [-1, 1]) {
      const knee = [
        s * 0.091,
        crouched ? 0.19 : 0.263,
        crouched ? 0.165 : stride ? s * 0.092 : 0.021,
      ];
      const foot = [
        s * (crouched ? 0.143 : 0.095),
        0.033,
        crouched ? -0.105 : stride ? s * 0.108 : 0.014,
      ];
      swept(
        out,
        p,
        [
          [[s * 0.081, 0.483, 0.018], 0.071],
          [knee, 0.052],
          [[foot[0], 0.115, foot[2]], 0.043],
          [foot, 0.039],
        ],
        Math.max(4, sides - 2),
        f.garment === 'mail' ? 'shade' : tint,
      );
      if (!relief)
        oval(
          out,
          p,
          [foot[0], 0.041, foot[2] + 0.042],
          [0.053, 0.041, 0.091],
          Math.max(6, sides - 2),
          4,
          'shade',
        );
    }
  }
  const arms = armPoses[f.gesture] ?? armPoses.guard;
  arms.forEach(([elbow, hand], i) => {
    const s = i === 0 ? -1 : 1,
      start = [s * 0.146, 0.737, 0.012];
    if (relief && detail === 1) return;
    swept(
      out,
      p,
      [
        [start, 0.066],
        [elbow, 0.046],
        [hand, 0.024],
      ],
      Math.max(4, sides - 2),
      tint,
    );
    if (!relief && detail >= 1)
      oval(out, p, hand, [0.035, 0.048, 0.03], Math.max(6, sides - 2), 4, 'edge');
  });
  head(out, p, sides, detail, f.head, tint, relief);
  if (!relief) {
    if (detail >= 2) {
      swept(
        out,
        p,
        [
          [[-0.125, 0.54, 0.082], 0.012],
          [[0, 0.53, 0.11], 0.015],
          [[0.126, 0.54, 0.083], 0.012],
        ],
        6,
        'edge',
      );
      if (f.garment === 'mail' || f.garment === 'coat')
        swept(
          out,
          p,
          [
            [[-0.109, 0.749, 0.092], 0.018],
            [[-0.035, 0.682, 0.125], 0.018],
            [[0.11, 0.56, 0.102], 0.013],
          ],
          7,
          'patina',
        );
    }
    attributes(out, p, f, detail);
  }
  return p;
}

export function trefoilCross(out, base, axis, height, detail) {
  const p = localFrame(base, axis);
  const top = height,
    arm = height - 0.69,
    r = detail === 0 ? 0.115 : 0.085;
  beam(out, bronze, p([0, 0, 0]), p([0, top - 0.12, 0]), r * 2, 0.139, color.cast);
  beam(out, bronze, p([-0.91, arm, 0]), p([0.91, arm, 0]), r * 1.9, 0.139, color.cast);
  for (const [x, y] of [
    [0, top - 0.17],
    [-0.91, arm],
    [0.91, arm],
  ]) {
    sphere(
      out,
      bronze,
      p([x, y, 0]),
      [0.129, detail < 2 ? 0.17 : 0.145, 0.088],
      color.patina,
      detail < 2 ? 4 : 10,
      detail < 2 ? 3 : 6,
    );
    if (detail > 1) {
      for (const s of [-1, 1])
        sphere(
          out,
          bronze,
          p([x + s * 0.099, y + 0.025, 0]),
          [0.069, 0.075, 0.075],
          color.edge,
          7,
          5,
        );
      sphere(out, bronze, p([x, y + 0.09, 0]), [0.077, 0.079, 0.074], color.edge, 7, 5);
    }
  }
  if (detail > 1) {
    for (const x of [-0.051, 0.051])
      beam(out, bronze, p([x, 0.17, 0.074]), p([x, top - 0.22, 0.074]), 0.018, 0.016, color.edge);
    for (const y of [arm - 0.047, arm + 0.047])
      beam(out, bronze, p([-0.88, y, 0.074]), p([0.88, y, 0.074]), 0.017, 0.017, color.edge);
  }
}

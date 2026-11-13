/** Bronze page stacks, four posed figures, and the open puzzle globe in Słubice. */
import { readFileSync } from 'node:fs';
import {
  beam,
  beamPath,
  cross,
  normalFor,
  normalize,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.67, metallic: 0.52 },
  plaque: { slot: 'wall', graph: 'metal_painted', roughness: 0.57, metallic: 0.16 },
};
const colors = {
  page: [0.185, 0.119, 0.075],
  darkPage: [0.106, 0.081, 0.056],
  pageEdge: [0.277, 0.184, 0.116],
  figure: [0.291, 0.205, 0.129],
  warm: [0.329, 0.228, 0.136],
  patina: [0.202, 0.159, 0.115],
  hair: [0.207, 0.146, 0.093],
  globe: [0.394, 0.289, 0.191],
  crown: [0.432, 0.329, 0.231],
  seam: [0.104, 0.085, 0.064],
  plaque: [0.092, 0.205, 0.173],
  letter: [0.75, 0.81, 0.69],
};
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  tau = 2 * Math.PI;
const ref = 'palette:#ffffff',
  up = [0, 1, 0],
  normalFront = [1, 0, 0],
  mix = (a, b, t) => a + (b - a) * t;
const delta = (a, b) => a.map((v, i) => v - b[i]);
function face(out, slot, tone, points, dir, rounded = false) {
  points = points
    .map((p) => p.map(Math.fround))
    .filter((p, i, all) => !all.slice(0, i).some((q) => q.every((v, j) => v === p[j])));
  if (points.length < 3) return;
  let n = normalFor(...points);
  if (n.reduce((s, v, i) => s + v * dir[i], 0) < 0) {
    points = points.toReversed();
    n = normalFor(...points);
  }
  if (Math.hypot(...n) < 0.5) return;
  if (rounded && Math.hypot(...dir) > 1e-8) n = normalize(dir);
  const color = typeof tone === 'string' ? colors[tone] : tone;
  if (points.length === 3) out.addTriangle(slot, ref, points, n, undefined, color);
  else out.addQuad(slot, ref, points, n, undefined, color);
}
const bronze = (out, tone, p, dir, rounded) => face(out, 'bronze', tone, p, dir, rounded);
const p2 = (p, q, t) => p.map((v, i) => mix(v, q[i], t));

function pages(out, shape, bottom, top, count, tier, seed) {
  const profile = shape.flatMap((p, i) => {
    const q = shape[(i + 1) % shape.length];
    return tier < 2 ? [p] : [p, p2(p, q, 0.33), p2(p, q, 0.68)];
  });
  const center = profile.reduce(
    ([x, z], p) => [x + p[0] / profile.length, z + p[1] / profile.length],
    [0, 0],
  );
  const sign = Math.sign(
    profile.reduce((s, p, i) => {
      const q = profile[(i + 1) % profile.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
  const rings = [];
  for (let i = 0; i <= count; i++) {
    const y = mix(bottom, top, i / count),
      jag = i > 0 && i < count ? 0.0024 : 0;
    const lip = (i % 2 === 1 ? 0.013 : -0.006) * (tier === 0 ? 0 : 1);
    rings.push(
      profile.map(([x, z], j) => [
        mix(x, center[0], -lip) + jag * Math.sin(seed + 1.34 * j + 1.9 * i),
        y + jag * Math.sin(seed * 0.45 + j * 1.73 + i * 0.82),
        mix(z, center[1], -lip) + jag * Math.cos(seed + 1.4 * j + i * 0.71),
      ]),
    );
  }
  for (let i = 1; i < rings.length; i++)
    for (let j = 0; j < profile.length; j++) {
      const k = (j + 1) % profile.length,
        a = rings[i - 1][j],
        b = rings[i - 1][k],
        c = rings[i][k],
        d = rings[i][j];
      const n = [sign * (b[2] - a[2]), 0, sign * (a[0] - b[0])],
        t = i % 4 === 2 ? 'darkPage' : i % 6 === 5 ? 'pageEdge' : 'page';
      bronze(out, t, [a, b, c], n);
      bronze(out, t, [a, c, d], n);
    }
  const triangles = earcut(shape.flat()),
    stride = tier < 2 ? 1 : 3;
  for (let i = 0; i < triangles.length; i += 3)
    for (const [ring, n, tone] of [
      [rings[0], [0, -1, 0], 'darkPage'],
      [rings.at(-1), up, 'pageEdge'],
    ])
      bronze(
        out,
        tone,
        triangles.slice(i, i + 3).map((j) => ring[j * stride]),
        n,
      );
}
function figureFrame({ angle, radius, base, stretch }) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return {
    toWorld: ([u, y, v]) => [
      c * (radius - v) + s * u,
      base + y * stretch,
      s * (radius - v) - c * u,
    ],
    toLocal: ([x, y, z]) => [s * x - c * z, (y - base) / stretch, radius - c * x - s * z],
  };
}
function sweep(out, frame, rows, count, tone) {
  if (count >= 11) {
    rows = rows.flatMap((a, i) => {
      const b = rows[i + 1];
      if (!b) return [a];
      const before = rows[Math.max(0, i - 1)],
        after = rows[Math.min(rows.length - 1, i + 2)];
      return [a, a.map((v, k) => (9 * v + 9 * b[k] - before[k] - after[k]) / 16)];
    });
  }
  const centers = rows.map((r) => r.slice(0, 3));
  const rings = rows.map(([u, y, v, w, d], i) => {
    const axis = normalize(
      delta(centers[Math.min(i + 1, rows.length - 1)], centers[Math.max(0, i - 1)]),
    );
    const side = normalize(cross(axis, Math.abs(axis[2]) > 0.89 ? [0, 1, 0] : [0, 0, 1])),
      other = cross(axis, side);
    return Array.from({ length: count }, (_, j) => {
      const a = (tau * j) / count;
      return frame.toWorld(
        [u, y, v].map((v, k) => v + side[k] * w * Math.cos(a) + other[k] * d * Math.sin(a)),
      );
    });
  });
  for (let i = 1; i < rows.length; i++)
    for (let j = 0; j < count; j++) {
      const k = (j + 1) % count,
        a = rings[i - 1][j],
        b = rings[i - 1][k],
        c = rings[i][k],
        d = rings[i][j];
      const midpoint = frame.toWorld(p2(centers[i - 1], centers[i], 0.5));
      const tint =
        count >= 8
          ? colors[tone].map((v, k) =>
              mix(v, colors.patina[k], 0.17 + 0.13 * Math.sin(j * 0.79 + i * 0.58)),
            )
          : tone;
      for (const pts of [
        [a, b, c],
        [a, c, d],
      ])
        bronze(
          out,
          tint,
          pts,
          delta(p2(p2(pts[0], pts[1], 0.5), pts[2], 1 / 3), midpoint),
          count >= 8,
        );
    }
  for (const [i, j] of [
    [0, 1],
    [rows.length - 1, rows.length - 2],
  ]) {
    const a = frame.toWorld(centers[i]),
      dir = delta(a, frame.toWorld(centers[j]));
    for (let k = 1; k < count - 1; k++)
      bronze(out, tone, [rings[i][0], rings[i][k], rings[i][k + 1]], dir);
  }
}
function head(out, f, tier, p, hair) {
  const [u, y, v] = p,
    n = [5, 7, 9, 13, 16][tier];
  const profile = [
    [u, y - 0.063, v, 0.024, 0.025],
    [u, y - 0.042, v + 0.006, 0.053, 0.045],
    [u, y - 0.008, v + 0.005, 0.064, 0.058],
    [u, y + 0.033, v - 0.007, 0.061, 0.057],
    [u, y + 0.062, v - 0.012, 0.04, 0.042],
    [u, y + 0.07, v - 0.017, 0.016, 0.017],
  ];
  sweep(
    out,
    f,
    tier === 0
      ? [profile[0], profile[2], profile[4]]
      : tier === 1
        ? profile.filter((_, i) => i !== 1 && i !== 4)
        : profile,
    n,
    'figure',
  );
  if (tier < 2) return;
  const nose = [
    [u - 0.023, y - 0.016, v + 0.047],
    [u + 0.023, y - 0.016, v + 0.047],
    [u + 0.008, y + 0.018, v + 0.058],
    [u - 0.009, y + 0.024, v + 0.057],
  ];
  bronze(
    out,
    'warm',
    [f.toWorld(nose[0]), f.toWorld(nose[1]), f.toWorld([u, y - 0.008, v + 0.082])],
    delta(f.toWorld([u, y, v + 1]), f.toWorld([u, y, v])),
  );
  bronze(
    out,
    'figure',
    [f.toWorld(nose[2]), f.toWorld(nose[3]), f.toWorld([u, y - 0.008, v + 0.082])],
    delta(f.toWorld([u, y, v + 1]), f.toWorld([u, y, v])),
  );
  const spread = hair === 'waved' ? 0.072 : hair === 'swept' ? 0.068 : 0.056;
  const locks = tier >= 3 ? (hair === 'waved' ? 8 : 6) : 3;
  for (let i = 0; i < locks; i++) {
    const t = (i / (locks - 1)) * 2 - 1,
      h = Math.sqrt(1 - t * t) * 0.035;
    const path = [
      [u + spread * t, y + 0.041 + h, v + 0.018],
      [u + spread * t + 0.012, y + 0.051 + h, v - 0.03],
      [u + spread * t + 0.022, y + 0.018, v - 0.062],
      [u + spread * t + 0.027, y - (hair === 'waved' ? 0.072 : 0.033), v - 0.068],
    ];
    beamPath(
      out,
      'bronze',
      path.map(f.toWorld),
      tier >= 3 ? 0.013 : 0.024,
      0.009,
      colors[i % 3 === 2 ? 'warm' : 'hair'],
    );
  }
}
function handContact(angle, y) {
  const { center, radii } = layout.globe,
    t = Math.sqrt(Math.max(0, 1 - ((y - center[1]) / radii[1]) ** 2));
  return [
    center[0] + (t * radii[0] + 0.0035) * Math.cos(angle),
    y,
    center[2] + (t * radii[2] + 0.0035) * Math.sin(angle),
  ];
}
function figure(out, data, tier, index) {
  const f = figureFrame(data),
    n = [4, 5, 8, 11, 13][tier],
    { lean, face, leg, angle, contact, hair } = data;
  const rows = [
    [-0.007, 0.365, 0.011, 0.078, 0.066],
    [0, 0.435, 0.027, 0.106, 0.071],
    [0.005, 0.506, 0.048, 0.074, 0.057],
    [0.002, 0.588, 0.075, 0.096, 0.067],
    [face * 0.2, 0.668, lean, 0.111, 0.066],
    [face * 0.35, 0.725, lean + 0.005, 0.09, 0.052],
    [face * 0.42, 0.757, lean + 0.017, 0.034, 0.035],
    [face * 0.47, 0.797, lean + 0.029, 0.031, 0.032],
  ];
  sweep(
    out,
    f,
    tier === 0
      ? [rows[0], rows[4], rows.at(-1)]
      : tier === 1
        ? rows.filter((_, i) => i !== 2 && i !== 5)
        : rows,
    n,
    'figure',
  );
  for (const [j, side] of [-1, 1].entries()) {
    const bend = leg[j],
      heel = -0.031 + side * (index % 2 === 0 ? 0.044 : -0.035);
    const foot = [side * (0.065 + bend * 0.23), 0.027, heel],
      ankle = [foot[0], 0.063, heel],
      knee = [side * (0.064 + bend * 0.2), 0.215, 0.041 + bend * 0.36];
    const thigh = [side * 0.053, 0.435, 0.027];
    const calf = [mix(ankle[0], knee[0], 0.38), 0.119, mix(ankle[2], knee[2], 0.39) - 0.021];
    const legRows = [
      [...thigh, 0.054, 0.059],
      [side * 0.071, 0.33, 0.064, 0.061, 0.06],
      [...knee, 0.046, 0.043],
      [...calf, 0.044, 0.04],
      [...ankle, 0.023, 0.027],
      [...foot, 0.031, 0.032],
    ];
    sweep(
      out,
      f,
      tier === 0
        ? [legRows[0], legRows[2], legRows.at(-1)]
        : tier === 1
          ? [legRows[0], legRows[2], legRows[3], legRows.at(-1)]
          : legRows,
      n,
      'figure',
    );
    const feet = f.toWorld([foot[0], 0.021, heel + 0.033]);
    if (tier > 0)
      sphere(out, 'bronze', feet, [0.037, 0.025, 0.039], colors.figure, tier >= 3 ? 9 : 6, 4);

    const a = angle + side * (index === 0 ? 0.167 : 0.242) + (index % 2 === 0 ? 0.052 : -0.065),
      end = handContact(a, contact[j]),
      local = f.toLocal(end);
    const shoulder = [side * 0.088, 0.672, lean],
      elbow = [side * (0.102 + (j === index % 2 ? 0.035 : 0)), 0.877, lean * 0.45 - 0.016];
    const armRows = [
      [...shoulder, 0.048, 0.047],
      [side * 0.117, 0.779, lean * 0.63, 0.042, 0.039],
      [...elbow, 0.032, 0.032],
      [
        mix(elbow[0], local[0], 0.66),
        mix(elbow[1], local[1], 0.62),
        mix(elbow[2], local[2], 0.66),
        0.026,
        0.026,
      ],
      [local[0], local[1] - 0.046, local[2] - 0.005, 0.02, 0.018],
      [...local, 0.029, 0.015],
    ];
    sweep(
      out,
      f,
      tier === 0
        ? [armRows[0], armRows[2], armRows.at(-1)]
        : tier === 1
          ? armRows.filter((_, i) => i !== 1 && i !== 3)
          : armRows,
      n,
      'warm',
    );
    if (tier >= 2) {
      for (let k = 0; k < 4; k++) {
        const skew = (k - 1.5) * 0.042,
          top = handContact(a + skew, contact[j] + [0.043, 0.062, 0.059, 0.04][k]);
        const base = handContact(a + skew * 0.9, contact[j] - 0.008);
        beamPath(
          out,
          'bronze',
          [base, p2(base, top, 0.54), top],
          tier >= 3 ? 0.008 : 0.01,
          0.011,
          colors.warm,
        );
      }
      const thumb = handContact(a + side * 0.129, contact[j] + 0.013);
      beam(out, 'bronze', end, thumb, 0.011, 0.012, colors.figure);
    }
  }
  head(out, f, tier, [face * 0.49, 0.825, lean + 0.026], hair);
}

const narrowTab = [
  [0, 0],
  [0.29, 0],
  [0.415, 0],
  [0.392, 0.09],
  [0.358, 0.128],
  [0.37, 0.192],
  [0.423, 0.23],
  [0.5, 0.246],
  [0.577, 0.23],
  [0.63, 0.192],
  [0.642, 0.128],
  [0.608, 0.09],
  [0.585, 0],
  [0.71, 0],
  [1, 0],
];
function border(u, v, horizontal, tier) {
  const sign = ((u % layout.globe.columns) + 2 * v + (horizontal ? 1 : 0)) % 3 === 0 ? -1 : 1;
  const tab =
    tier === 0
      ? [
          [0, 0],
          [1, 0],
        ]
      : tier === 1
        ? narrowTab.filter((_, i) => [0, 2, 4, 7, 10, 12, 14].includes(i))
        : narrowTab;
  const amp = tier === 0 ? 0 : sign * (horizontal && (v === 0 || v === 6) ? 0 : 0.86);
  return tab.map(([f, g]) => (horizontal ? [u + f, v + g * amp] : [u + g * amp, v + f]));
}
function globePoint([u, v], skin = 0) {
  const { center, radii, columns, latitude, glyphRotation } = layout.globe;
  const i = Math.max(0, Math.min(latitude.length - 2, Math.floor(v))),
    t = mix(latitude[i], latitude[i + 1], v - i),
    a = (tau * u) / columns + glyphRotation;
  return [
    center[0] + (radii[0] + skin) * Math.cos(t) * Math.cos(a),
    center[1] + (radii[1] + skin) * Math.sin(t),
    center[2] + (radii[2] + skin) * Math.cos(t) * Math.sin(a),
  ];
}
function globePanel(out, uv, tone, detail, skin = 0, inside = false) {
  const { center, radii } = layout.globe,
    points = uv.map((p) => globePoint(p, skin));
  if (detail) {
    const [a, b, c] = uv,
      d = p2(a, b, 0.5),
      e = p2(b, c, 0.5),
      f = p2(c, a, 0.5);
    for (const t of [
      [a, d, f],
      [d, b, e],
      [f, e, c],
      [d, e, f],
    ])
      globePanel(out, t, tone, false, skin, inside);
  } else {
    const n = delta(p2(p2(points[0], points[1], 0.5), points[2], 1 / 3), center).map(
      (v, i) => v / radii[i] ** 2,
    );
    bronze(out, tone, points, inside ? n.map((v) => -v) : n, true);
  }
}
const glyphs = {
  W: [
    [
      [0, 1],
      [0.2, 0],
      [0.49, 0.66],
      [0.75, 0],
      [1, 1],
    ],
  ],
  I: [
    [
      [0.5, 0],
      [0.5, 1],
    ],
    [
      [0.1, 0],
      [0.9, 0],
    ],
    [
      [0.1, 1],
      [0.9, 1],
    ],
  ],
  K: [
    [
      [0.12, 0],
      [0.12, 1],
    ],
    [
      [0.92, 1],
      [0.12, 0.45],
      [0.94, 0],
    ],
  ],
  P: [
    [
      [0.14, 0],
      [0.14, 1],
      [0.67, 1],
      [0.92, 0.83],
      [0.87, 0.61],
      [0.14, 0.58],
    ],
  ],
  E: [
    [
      [0.88, 1],
      [0.14, 1],
      [0.14, 0],
      [0.9, 0],
    ],
    [
      [0.14, 0.52],
      [0.73, 0.52],
    ],
  ],
  D: [
    [
      [0.14, 0],
      [0.14, 1],
      [0.6, 1],
      [0.9, 0.75],
      [0.94, 0.34],
      [0.65, 0],
      [0.14, 0],
    ],
  ],
  A: [
    [
      [0.04, 0],
      [0.52, 1],
      [0.96, 0],
    ],
    [
      [0.24, 0.39],
      [0.79, 0.39],
    ],
  ],
  M: [
    [
      [0.1, 0],
      [0.1, 1],
      [0.49, 0.43],
      [0.89, 1],
      [0.89, 0],
    ],
  ],
  H: [
    [
      [0.13, 0],
      [0.13, 1],
    ],
    [
      [0.87, 0],
      [0.87, 1],
    ],
    [
      [0.13, 0.53],
      [0.87, 0.53],
    ],
  ],
  R: [
    [
      [0.14, 0],
      [0.14, 1],
      [0.67, 1],
      [0.92, 0.83],
      [0.87, 0.61],
      [0.14, 0.58],
    ],
    [
      [0.58, 0.58],
      [0.93, 0],
    ],
  ],
  N: [
    [
      [0.12, 0],
      [0.12, 1],
      [0.9, 0],
      [0.9, 1],
    ],
  ],
  O: [
    [
      [0.38, 0],
      [0.13, 0.23],
      [0.1, 0.74],
      [0.35, 1],
      [0.68, 1],
      [0.89, 0.72],
      [0.9, 0.24],
      [0.65, 0],
      [0.38, 0],
    ],
  ],
  B: [
    [
      [0.15, 0],
      [0.15, 1],
      [0.68, 1],
      [0.89, 0.8],
      [0.67, 0.54],
      [0.15, 0.54],
      [0.68, 0.54],
      [0.94, 0.34],
      [0.72, 0],
      [0.15, 0],
    ],
  ],
  Y: [
    [
      [0.1, 1],
      [0.48, 0.48],
      [0.91, 1],
    ],
    [
      [0.48, 0.48],
      [0.48, 0],
    ],
  ],
  Ω: [
    [
      [0.07, 0],
      [0.37, 0],
      [0.14, 0.35],
      [0.18, 0.72],
      [0.41, 1],
      [0.67, 0.97],
      [0.88, 0.72],
      [0.88, 0.35],
      [0.66, 0],
      [0.95, 0],
    ],
  ],
  И: [
    [
      [0.12, 1],
      [0.12, 0],
      [0.89, 1],
      [0.89, 0],
    ],
  ],
  文: [
    [
      [0.14, 0.71],
      [0.87, 0.71],
    ],
    [
      [0.5, 0.99],
      [0.62, 0.81],
    ],
    [
      [0.26, 0.69],
      [0.4, 0.37],
      [0.91, 0],
    ],
    [
      [0.71, 0.69],
      [0.6, 0.36],
      [0.12, 0.02],
    ],
  ],
  G: [
    [
      [0.89, 0.85],
      [0.63, 1],
      [0.35, 0.98],
      [0.13, 0.75],
      [0.12, 0.27],
      [0.35, 0.02],
      [0.69, 0.02],
      [0.89, 0.24],
      [0.89, 0.48],
      [0.57, 0.48],
    ],
  ],
};
function globeLetters(out, u, v, tier) {
  if (tier < 2 || v === 0 || v === 5 || (u + v) % 3 === 0) return;
  const glyph = ['Ω', 'W', 'И', 'H', 'Ε', '文', 'A', 'G', 'O', 'E'][(u + 3 * v) % 10];
  for (const path of glyphs[glyph] ?? glyphs.E) {
    for (let i = 1; i < path.length; i++) {
      const ab = path
        .slice(i - 1, i + 1)
        .map(([x, y]) => globePoint([u + 0.33 + x * 0.34, v + 0.33 + y * 0.34], 0.0022));
      beam(out, 'bronze', ab[0], ab[1], tier === 2 ? 0.0022 : 0.0017, 0.0011, colors.seam);
    }
  }
}
function puzzleGlobe(out, tier) {
  const { columns, missing, center, radii } = layout.globe;
  const absent = (u, v) => missing.some(([r, c]) => r === v && c === u);
  for (let v = 0; v < 6; v++)
    for (let u = 0; u < columns; u++) {
      if (absent(u, v)) continue;
      const path = [
        border(u, v, true, tier),
        border(u + 1, v, false, tier),
        border(u, v + 1, true, tier).toReversed(),
        border(u, v, false, tier).toReversed(),
      ].flatMap((p) => p.slice(0, -1));
      const inset = tier === 0 ? 0 : tier === 1 ? 0.025 : 0.022;
      const polygon = path.map(([a, b]) => [mix(a, u + 0.5, inset), mix(b, v + 0.5, inset)]),
        indices = earcut(polygon.flat());
      const tone = v >= 4 ? 'crown' : 'globe';
      if (tier === 2) {
        const cell = [
          [u, v],
          [u + 1, v],
          [u + 1, v + 1],
          [u, v + 1],
        ];
        globePanel(out, [cell[0], cell[1], cell[2]], 'seam', false, -0.013);
        globePanel(out, [cell[0], cell[2], cell[3]], 'seam', false, -0.013);
      }
      for (let i = 0; i < indices.length; i += 3) {
        const triangle = indices.slice(i, i + 3).map((j) => polygon[j]);
        globePanel(out, triangle, tone, tier >= 3);
        if (tier >= 3)
          globePanel(
            out,
            indices.slice(i, i + 3).map((j) => path[j]),
            'seam',
            true,
            -0.013,
          );
        if (tier >= 3 && (v >= 4 || v === 0)) globePanel(out, triangle, 'seam', false, -0.01, true);
      }
      if (tier >= 3 || (tier === 2 && v >= 4))
        for (let i = 0; i < polygon.length; i++) {
          const j = (i + 1) % polygon.length,
            a = globePoint(polygon[i]),
            b = globePoint(polygon[j]);
          bronze(
            out,
            'seam',
            [a, b, globePoint(polygon[j], -0.005), globePoint(polygon[i], -0.005)],
            delta(a, globePoint([u + 0.5, v + 0.5])),
          );
        }
      globeLetters(out, u, v, tier);
    }
  for (const [v, sign] of [
    [0, -1],
    [6, 1],
  ])
    for (let u = 0; u < columns; u++) {
      if (sign === 1 && absent(u, 5)) continue;
      const point = [center[0], center[1] + sign * radii[1], center[2]];
      bronze(
        out,
        sign === 1 ? 'crown' : 'globe',
        [globePoint([u, v]), globePoint([u + 1, v]), point],
        [0, sign, 0],
      );
    }
}
function plaque(out, tier) {
  const x = 0.586,
    z = 0.075,
    y = 0.273,
    hw = 0.151,
    hh = 0.174;
  const corners = [
    [x, y - hh, z - hw],
    [x, y - hh, z + hw],
    [x, y + hh, z + hw],
    [x, y + hh, z - hw],
  ];
  face(out, 'plaque', 'plaque', corners, normalFront);
  if (tier === 0) return;
  const rim = corners.map(([a, b, c]) => [a + 0.003, b, c]);
  beamPath(out, 'plaque', rim, 0.005, 0.004, colors.letter, true);
  for (const p of rim) sphere(out, 'bronze', p, [0.009, 0.009, 0.009], colors.pageEdge, 5, 3);
  const line = (text, at, wide, height) => {
    const gap = wide / text.length;
    for (let i = 0; i < text.length; i++)
      for (const path of glyphs[text[i]] ?? []) {
        const positions = path.map(([a, b]) => [
          x + 0.006,
          at + b * height,
          z + wide * 0.5 - gap * (i + 0.15 + a * 0.73),
        ]);
        for (let k = 1; k < positions.length; k++)
          beam(out, 'plaque', positions[k - 1], positions[k], 0.0025, 0.0012, colors.letter);
      }
  };
  line('WIKIPEDIA', y + 0.072, 0.223, 0.035);
  if (tier >= 2) line('MIHRAN HAKOBYAN', y + 0.125, 0.23, 0.014);
  for (let i = 0; i < (tier >= 2 ? 8 : 4); i++) {
    const at = y + 0.044 - 0.02 * i,
      w = 0.219 - (i % 3) * 0.019;
    for (const [a, b] of [
      [z - w / 2, z - 0.018],
      [z - 0.009, z + w / 2],
    ])
      face(
        out,
        'plaque',
        'letter',
        [
          [x + 0.005, at, a],
          [x + 0.005, at, b],
          [x + 0.005, at + 0.004, b],
          [x + 0.005, at + 0.004, a],
        ],
        normalFront,
      );
  }
}
export function buildWikipediaMonumentLevel(out, level) {
  const tier = tiers[level];
  if (tier === undefined) throw Error(`Unknown monument level ${level}`);
  pages(out, layout.base, -0.048, layout.plinthTop, [1, 8, 18, 52, 66][tier], tier, 1);
  for (const [index, f] of layout.figures.entries()) {
    const c = Math.cos(f.angle),
      s = Math.sin(f.angle),
      r = f.radius - 0.025;
    const shape = [
      [-0.137, -0.143],
      [0.128, -0.143],
      [0.141, 0.122],
      [-0.139, 0.137],
    ].map(([x, z]) => [c * (r + z) + s * x, s * (r + z) - c * x]);
    pages(
      out,
      shape,
      layout.plinthTop - 0.012,
      f.base + 0.006,
      [1, 6, 10, 27, 36][tier],
      tier,
      index + 3,
    );
    figure(out, f, tier, index);
  }
  puzzleGlobe(out, tier);
  plaque(out, tier);
}
export const buildWikipediaMonumentSkyline = (out) => buildWikipediaMonumentLevel(out, 'skyline');
export const buildWikipediaMonumentDistrict = (out) => buildWikipediaMonumentLevel(out, 'district');
export const buildWikipediaMonumentStreet = (out) => buildWikipediaMonumentLevel(out, 'street');
export const buildWikipediaMonumentCloseup = (out) => buildWikipediaMonumentLevel(out, 'closeup');

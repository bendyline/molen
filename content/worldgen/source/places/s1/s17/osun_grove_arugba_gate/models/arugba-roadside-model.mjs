import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import {
  box,
  tubePath,
} from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const ref = 'palette:#ffffff';
const clay = [0.365, 0.307, 0.22];
const paleClay = [0.465, 0.394, 0.285];
const lichen = [0.285, 0.326, 0.134];
const iron = [0.112, 0.123, 0.115];
const ironRelief = [0.172, 0.177, 0.15];
const paint = [0.235, 0.241, 0.21];
// The back of the ironwork and the sheltered gable are visible from the same tour camera.
const c = Math.cos(0.304);
const s = Math.sin(0.304);
export const frontagePoint = ([x, y, z]) => [
  -2.044 + c * x - s * z,
  0.507 + y,
  4.561 + s * x + c * z,
];
const frontageNormal = ([x, y, z]) => [c * x - s * z, y, s * x + c * z];

function frontageCoordinates(builder) {
  const surface = (method) => (slot, material, points, normal, uv, color) =>
    builder[method](slot, material, points.map(frontagePoint), frontageNormal(normal), uv, color);
  return {
    addQuad: surface('addQuad'),
    addTriangle: surface('addTriangle'),
    addConvexPolygon: surface('addConvexPolygon'),
  };
}

const quad = (out, slot, points, color) =>
  out.addQuad(slot, ref, points, normalFor(...points), [], color);

// The pedestrian arch stands in front of the sheltered clay portal.
const innerArch = [
  [-0.65, -0.09],
  [-0.63, 1.14],
  [-0.61, 1.88],
  [-0.53, 2.16],
  [-0.32, 2.28],
  [0, 2.37],
  [0.36, 2.29],
  [0.59, 2.14],
  [0.71, 1.82],
  [0.69, 0.99],
  [0.73, -0.09],
];
const outerArch = [
  [-1.18, -0.13],
  [-1.26, 1.09],
  [-1.24, 1.92],
  [-1.24, 2.67],
  [-0.85, 2.85],
  [-0.21, 3.12],
  [0.32, 3.02],
  [0.81, 2.82],
  [1.19, 2.58],
  [1.24, 1.03],
  [1.25, -0.13],
];

const wallCrown = [
  [-7.95, 2.37],
  [-7.54, 2.71],
  [-7.1, 2.4],
  [-6.82, 1.48],
  [-6.18, 1.64],
  [-5.73, 1.38],
  [-5.28, 1.62],
  [-4.83, 1.36],
  [-4.42, 1.49],
  [-3.99, 1.26],
  [-3.48, 1.51],
  [-2.94, 1.32],
  [-2.38, 1.35],
  [-1.93, 1.52],
  [-1.51, 1.45],
  [-1.1, 1.73],
];

function lowWall(out, slot, xHeights, bottomY, front, back, color, reliefDetail) {
  for (const [i, [x, y]] of xHeights.slice(1).entries()) {
    const [a, top] = xHeights[i];
    const face = [
      [a, bottomY, front],
      [x, bottomY, front],
      [x, y, front],
      [a, top, front],
    ];
    if (reliefDetail >= 3) {
      const left = xHeights[0][0];
      const right = xHeights.at(-1)[0];
      const rows = reliefDetail === 3 ? 31 : 43;
      reliefPanel(out, face, wallCups, reliefDetail, rows, (point) =>
        Math.min(1, (point[0] - left) / 0.2, (right - point[0]) / 0.2),
      );
    } else {
      quad(out, slot, face, color);
    }
    quad(
      out,
      slot,
      [
        [x, bottomY, back],
        [a, bottomY, back],
        [a, top, back],
        [x, y, back],
      ],
      color,
    );
    quad(
      out,
      slot,
      [
        [a, top, front],
        [x, y, front],
        [x, y, back],
        [a, top, back],
      ],
      color,
    );
    quad(
      out,
      slot,
      [
        [a, bottomY, back],
        [x, bottomY, back],
        [x, bottomY, front],
        [a, bottomY, front],
      ],
      color,
    );
  }
  const [left, lHeight] = xHeights[0];
  const [right, rHeight] = xHeights.at(-1);
  quad(
    out,
    slot,
    [
      [left, bottomY, back],
      [left, bottomY, front],
      [left, lHeight, front],
      [left, lHeight, back],
    ],
    color,
  );
  quad(
    out,
    slot,
    [
      [right, bottomY, front],
      [right, bottomY, back],
      [right, rHeight, back],
      [right, rHeight, front],
    ],
    color,
  );
}

function arch(out, detail) {
  const chosen = detail === 0 ? [0, 2, 3, 5, 7, 8, 10] : innerArch.map((_, i) => i);
  const ring = (path, z, i) => [...path[i], z];
  for (const [i, b] of chosen.slice(1).entries()) {
    const a = chosen[i];
    const [f0, f1] = [ring(innerArch, 0.22, a), ring(innerArch, 0.22, b)];
    const [o0, o1] = [ring(outerArch, 0.29, a), ring(outerArch, 0.29, b)];
    const [r0, r1] = [ring(innerArch, -0.29, a), ring(innerArch, -0.29, b)];
    const [p0, p1] = [ring(outerArch, -0.34, a), ring(outerArch, -0.34, b)];
    if (detail >= 3) {
      reliefPanel(out, [f0, f1, o1, o0], archCups, detail, detail === 3 ? 12 : 16);
    } else {
      quad(out, 'earth', [f0, f1, o1, o0], i % 3 === 1 ? clay : paleClay);
    }
    quad(out, 'earth', [r1, r0, p0, p1], clay);
    quad(out, 'earth', [o0, o1, p1, p0], paleClay);
    quad(out, 'earth', [f0, r0, r1, f1], clay);
  }
  for (const [i, frontFirst] of [
    [0, true],
    [10, false],
  ]) {
    const f = ring(innerArch, 0.22, i);
    const r = ring(innerArch, -0.29, i);
    const o = ring(outerArch, 0.29, i);
    const p = ring(outerArch, -0.34, i);
    quad(out, 'earth', frontFirst ? [o, p, r, f] : [f, r, p, o], clay);
  }
}

// Rolled, concave reliefs on the two clay piers and the adjoining low wall.
function clayCup(out, x, y, rx, ry, baseZ, tilt, detail, index) {
  const sides = detail >= 3 ? 16 : detail === 2 ? 10 : 7;
  const point = (segment, radius, depth) => {
    const a = (segment * 2 * Math.PI) / sides;
    const lobe =
      radius * (1 + 0.14 * Math.sin(3 * a + index * 0.83) + 0.11 * Math.cos(2 * a - index));
    const u = Math.cos(a) * rx * lobe;
    return [
      x + u + (1 - radius) * rx * 0.16 * Math.sin(index),
      y + Math.sin(a) * ry * lobe + tilt * u,
      baseZ + depth * (1 + 0.25 * Math.cos(a + index)),
    ];
  };
  const rise = 0.101 + 0.027 * Math.sin(index * 1.97);
  const rings =
    detail >= 2
      ? [
          [1, -0.031],
          [0.86, rise * 0.52],
          [0.71, rise],
          [0.56, rise * 0.73],
          [0.35, 0.007],
        ]
      : [
          [1, -0.031],
          [0.71, rise],
          [0.35, 0.007],
        ];
  for (const [r, [radius, depth]] of rings.slice(1).entries()) {
    const [outer, back] = rings[r];
    for (let i = 0; i < sides; i++) {
      const rim = Math.sin(i * 1.71 + index * 0.8) > 0.18 ? lichen : paleClay;
      quad(
        out,
        'earth',
        [
          point(i, outer, back),
          point(i + 1, outer, back),
          point(i + 1, radius, depth),
          point(i, radius, depth),
        ],
        r < 2 ? rim : clay,
      );
    }
  }
  for (let i = 0; i < sides; i++) {
    const p = [point(0, 0, 0.006), point(i, 0.35, 0.007), point(i + 1, 0.35, 0.007)];
    out.addTriangle('earth', ref, p, normalFor(...p), [], clay);
  }
}

const cups = [
  [-6.63, 0.69, 0.43, 0.31, 0.22, -0.24],
  [-6.01, 0.94, 0.31, 0.29, 0.22, 0.46],
  [-5.57, 0.48, 0.28, 0.26, 0.22, -0.42],
  [-5.15, 1.05, 0.38, 0.21, 0.22, -0.24],
  [-4.81, 0.58, 0.34, 0.33, 0.22, 0.22],
  [-4.32, 0.91, 0.32, 0.31, 0.22, 0.56],
  [-3.87, 0.42, 0.31, 0.21, 0.22, 0.36],
  [-3.48, 0.89, 0.42, 0.34, 0.22, -0.24],
  [-2.91, 0.63, 0.29, 0.27, 0.22, -0.6],
  [-2.49, 0.98, 0.32, 0.21, 0.22, 0.3],
  [-2.15, 0.57, 0.36, 0.26, 0.22, -0.38],
  [-1.73, 1.06, 0.35, 0.25, 0.22, 0.17],
  [-1.44, 0.52, 0.23, 0.33, 0.22, 0.22],
  [-0.96, 0.73, 0.24, 0.35, 0.27, 0.22],
  [-0.94, 1.43, 0.24, 0.33, 0.27, -0.33],
  [-0.95, 2.3, 0.25, 0.28, 0.265, -0.3],
  [-0.52, 2.59, 0.26, 0.23, 0.27, -0.13],
  [-0.15, 2.71, 0.21, 0.26, 0.265, 0.25],
  [0.27, 2.66, 0.27, 0.19, 0.265, -0.18],
  [0.67, 2.51, 0.19, 0.16, 0.27, 0.4],
  [1.02, 2.12, 0.2, 0.32, 0.275, 0.49],
  [1.02, 1.37, 0.21, 0.32, 0.275, -0.32],
  [1.03, 0.57, 0.2, 0.32, 0.275, 0.31],
];

// Small pockets between the larger bowls break up the relief on the road photo.
const wallCups = [
  ...cups.slice(0, 13),
  [-6.44, 1.16, 0.17, 0.14, 0.21, 0.21],
  [-6.19, 0.37, 0.15, 0.19, 0.21, 0.36],
  [-5.65, 1.17, 0.19, 0.14, 0.21, 0.43],
  [-5.25, 0.3, 0.17, 0.14, 0.21, -0.32],
  [-4.84, 1.11, 0.18, 0.15, 0.21, -0.24],
  [-4.34, 0.36, 0.17, 0.16, 0.21, 0.26],
  [-3.93, 0.96, 0.21, 0.13, 0.21, -0.22],
  [-3.34, 0.34, 0.2, 0.19, 0.21, 0.32],
  [-2.97, 1.06, 0.19, 0.14, 0.21, 0.25],
  [-2.5, 0.34, 0.2, 0.18, 0.21, 0.28],
  [-1.87, 0.36, 0.18, 0.17, 0.21, -0.21],
];
const archCups = cups.slice(13);
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
const clamp = (value) => Math.max(0, Math.min(1, value));

// Sculpt the recess and its lip into the face. The deformation vanishes at
// the cap, foot and jamb so the same outer shell closes all detail levels.
function reliefPanel(out, [a, b, c, d], cavities, detail, rows, endFade = () => 1) {
  const spacing = detail === 3 ? 0.07 : 0.05;
  const extent = Math.max(
    Math.hypot(b[0] - a[0], b[1] - a[1]),
    Math.hypot(c[0] - d[0], c[1] - d[1]),
  );
  const columns = Math.ceil(extent / spacing);
  const sample = (u, v) => {
    const point = mix(mix(a, b, u), mix(d, c, u), v);
    const [x, y] = point;
    let relief = 0;
    let recess = 0;
    for (const [i, [cx, cy, rx, ry, , tilt]] of cavities.entries()) {
      const dx = x - cx;
      const px = dx / rx;
      const py = (y - cy - tilt * dx) / ry;
      const r = Math.hypot(px, py) / (1 + 0.12 * Math.sin(3.2 * px + 2.4 * py + i));
      if (r >= 1.3) continue;
      const lip = clamp(1 - ((r - 0.79) / 0.51) ** 2);
      const hollow = clamp(1 - (r / 0.73) ** 2);
      relief += 0.061 * lip ** 2 - 0.118 * hollow ** 2;
      recess = Math.max(recess, hollow);
    }
    const fade = Math.min(1, v * 8, (1 - v) * 8, endFade(point));
    const clayRoll = 0.029 * Math.sin(x * 7 + y * 3) + 0.036 * Math.sin(x * 1.83 - y * 5.1);
    point[2] += Math.max(-0.17, Math.min(0.15, clayRoll + relief)) * fade;
    const damp = clamp(0.34 - 0.49 * y + 0.22 * Math.sin(x * 2.8 + y * 4));
    const patina = mix(clay, lichen, damp);
    const tint = mix(patina, paleClay, clamp(0.19 + 0.18 * Math.sin(x * 4.1 + y * 3.9) - recess));
    return { point, tint: tint.map((value) => value * (1 - fade * recess * 0.31)) };
  };
  let previous = Array.from({ length: rows + 1 }, (_, i) => sample(0, i / rows));
  for (let j = 1; j <= columns; j++) {
    const current = Array.from({ length: rows + 1 }, (_, i) => sample(j / columns, i / rows));
    for (let i = 0; i < rows; i++) {
      const face = [previous[i], current[i], current[i + 1], previous[i + 1]];
      const color = face[0].tint.map((_, k) => face.reduce((sum, v) => sum + v.tint[k], 0) / 4);
      const points = face.map(({ point }) => point);
      const diagonal = points[0].map((value, k) => value + points[3][k] - points[1][k]);
      out.addQuad('earth', ref, points, normalFor(points[0], points[2], diagonal), [], color);
    }
    previous = current;
  }
}

function carvedClay(out, detail) {
  const wall =
    detail === 0 ? wallCrown.filter((_, i) => [0, 2, 3, 5, 10, 14, 15].includes(i)) : wallCrown;
  lowWall(out, 'earth', wall, -0.13, 0.21, -0.25, clay, detail);
  arch(out, detail);
  box(out, 'base', [-0.74, -0.14, -0.7], [0.78, -0.004, 0.7], paleClay);
  if (detail === 0) return;
  beamPath(
    out,
    'earth',
    [
      [-3.3, 1.32, 0.1],
      [-3.1, 1.52, 0.1],
      [-2.89, 1.94, 0.06],
      [-2.6, 2.13, 0.06],
      [-2.39, 1.96, 0.08],
      [-2.25, 1.61, 0.08],
      [-1.97, 1.5, 0.09],
    ],
    0.13,
    0.18,
    paleClay,
  );
  if (detail >= 3) return;
  for (const [i, data] of cups.entries())
    if (detail >= 2 || i % 3 === 0) clayCup(out, ...data, detail, i);
  if (detail < 2) return;
  for (const path of [
    [
      [-7.17, 0.53, 0.21],
      [-7.04, 0.91, 0.27],
      [-6.87, 1.28, 0.29],
      [-6.55, 1.42, 0.23],
    ],
    [
      [-6.14, 0.26, 0.22],
      [-5.87, 0.54, 0.31],
      [-5.71, 0.98, 0.32],
      [-5.4, 1.28, 0.23],
    ],
    [
      [-4.71, 0.32, 0.22],
      [-4.58, 0.8, 0.32],
      [-4.31, 1.11, 0.28],
      [-4.1, 1.29, 0.2],
    ],
    [
      [-2.78, 0.19, 0.22],
      [-2.58, 0.42, 0.31],
      [-2.41, 0.68, 0.32],
      [-2.27, 0.85, 0.24],
    ],
    [
      [-0.89, 0.16, 0.27],
      [-0.84, 0.4, 0.36],
      [-0.86, 0.84, 0.34],
      [-0.99, 1.03, 0.28],
    ],
    [
      [0.88, 1.39, 0.26],
      [0.97, 1.62, 0.4],
      [1.13, 1.85, 0.35],
      [1.16, 2.12, 0.28],
    ],
  ])
    beamPath(out, 'earth', path, 0.073, 0.088, paleClay);
}

const leaves = [
  [
    [1.22, 2.02],
    [1.63, 2.04],
    [1.97, 2.22],
    [2.28, 2.04],
    [2.78, 2.03],
    [3.24, 2.31],
    [3.69, 2.05],
    [4.14, 2.31],
    [4.54, 2.05],
    [5.27, 2.18],
  ],
  [
    [5.33, 2.18],
    [5.74, 2.18],
    [6.04, 2.01],
    [6.48, 2.05],
    [6.79, 2.15],
    [7.03, 1.99],
    [7.32, 2.02],
    [7.67, 2.16],
    [8.02, 1.99],
    [8.39, 1.98],
    [8.62, 2.11],
    [8.85, 2.04],
  ],
];

function roundCrown(profile, detail) {
  return profile.flatMap(([x, y], i) => {
    const before = profile[i - 1];
    const after = profile[i + 1];
    if (!before || !after || y < Math.max(before[1], after[1]) + 0.12) return [[x, y]];
    const half = Math.min(x - before[0], after[0] - x) * 0.65;
    const fall = y - (before[1] + after[1]) * 0.5;
    const rim = [
      [x - half, y - fall * 0.38],
      [x - half * 0.45, y - fall * 0.1],
      [x + half * 0.45, y - fall * 0.1],
      [x + half, y - fall * 0.38],
    ];
    return detail === 0 ? [rim[0], [x, y], rim[3]] : rim;
  });
}

const patina = [0.132, 0.14, 0.127];
const rim = [0.284, 0.283, 0.237];

function ironPatch(out, outline, depth, color = ironRelief) {
  const z = 0.102;
  const center = outline.reduce(
    ([u, v], [x, y]) => [u + x / outline.length, v + y / outline.length],
    [0, 0],
  );
  const base = outline.map(([x, y]) => [x, y, z]);
  const cap = outline.map(([x, y]) => [
    center[0] + (x - center[0]) * 0.91,
    center[1] + (y - center[1]) * 0.91,
    z + depth,
  ]);
  const indices = earcut(outline.flat());
  for (let i = 0; i < indices.length; i += 3) {
    const [a, b, c] = indices.slice(i, i + 3);
    for (const points of [
      [cap[a], cap[b], cap[c]],
      [base[c], base[b], base[a]],
    ])
      out.addTriangle('iron', ref, points, normalFor(...points), [], color);
  }
  const signed = outline.reduce((sum, [x, y], i) => {
    const [u, v] = outline[(i + 1) % outline.length];
    return sum + x * v - y * u;
  }, 0);
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    const points = [base[i], base[j], cap[j], cap[i]];
    if (signed < 0) points.reverse();
    quad(out, 'iron', points, patina);
  }
}

function wire(out, path, radius = 0.015, color = rim, sides = 5) {
  tubePath(
    out,
    'iron',
    path.map(([x, y, z = 0.225]) => [x, y, z]),
    radius,
    color,
    sides,
  );
}

function ovalHead(out, x, y, scale, detail, look = 0) {
  sphere(
    out,
    'iron',
    [x, y, 0.151],
    [0.071 * scale, 0.095 * scale, 0.064],
    ironRelief,
    detail >= 3 ? 12 : 8,
    5,
  );
  if (detail < 3) return;
  wire(
    out,
    [
      [x - 0.046 * scale, y + 0.027 * scale, 0.205],
      [x - 0.016 * scale, y + 0.033 * scale, 0.22],
    ],
    0.009,
    paint,
  );
  wire(
    out,
    [
      [x + 0.014 * scale, y + 0.035 * scale, 0.217],
      [x + 0.045 * scale, y + 0.028 * scale, 0.204],
    ],
    0.009,
    paint,
  );
  wire(
    out,
    [
      [x + look * 0.013, y + 0.025 * scale, 0.217],
      [x + look * 0.025, y - 0.015 * scale, 0.236],
      [x - 0.011 + look * 0.013, y - 0.026 * scale, 0.214],
    ],
    0.012,
    ironRelief,
  );
  wire(
    out,
    [
      [x - 0.023 * scale, y - 0.044 * scale, 0.2],
      [x, y - 0.051 * scale, 0.215],
      [x + 0.024 * scale, y - 0.042 * scale, 0.2],
    ],
    0.008,
    patina,
  );
}

function mermaid(out, detail) {
  ironPatch(
    out,
    [
      [2.69, 1.28],
      [2.63, 1.51],
      [2.71, 1.85],
      [2.79, 1.98],
      [2.94, 2.04],
      [3.09, 1.95],
      [3.14, 1.67],
      [3.09, 1.28],
      [2.88, 1.21],
    ],
    0.11,
  );
  ironPatch(
    out,
    [
      [2.69, 1.31],
      [3.08, 1.3],
      [3.15, 1.18],
      [3.13, 0.91],
      [3.04, 0.64],
      [3.06, 0.47],
      [3.16, 0.4],
      [3.09, 0.29],
      [2.83, 0.21],
      [2.43, 0.21],
      [2.21, 0.17],
      [2.29, 0.34],
      [2.28, 0.52],
      [2.23, 0.69],
      [2.54, 0.5],
      [2.81, 0.41],
      [2.93, 0.47],
      [2.78, 0.76],
      [2.69, 0.99],
    ],
    0.088,
    ironRelief,
  );
  for (const [path, radius] of [
    [
      [
        [2.75, 1.92, 0.173],
        [2.6, 1.76, 0.203],
        [2.42, 1.51, 0.198],
        [2.31, 1.24, 0.162],
      ],
      0.056,
    ],
    [
      [
        [3.03, 1.94, 0.176],
        [3.26, 1.72, 0.227],
        [3.45, 1.5, 0.199],
        [3.7, 1.46, 0.174],
      ],
      0.053,
    ],
  ])
    wire(out, path, radius, ironRelief, detail >= 3 ? 8 : 5);
  ovalHead(out, 2.89, 2.08, 1, detail, -1);
  ironPatch(
    out,
    [
      [2.81, 2.1],
      [2.8, 2.21],
      [2.85, 2.32],
      [2.92, 2.37],
      [2.99, 2.25],
      [2.97, 2.11],
    ],
    0.086,
    paint,
  );
  if (detail < 2) return;
  wire(
    out,
    [
      [2.79, 1.95, 0.219],
      [2.81, 1.81, 0.232],
      [2.91, 1.77, 0.233],
      [3, 1.84, 0.204],
    ],
    0.017,
    paint,
  );
  wire(
    out,
    [
      [2.81, 1.94, 0.226],
      [2.86, 1.88, 0.234],
      [2.92, 1.87, 0.239],
      [2.985, 1.9, 0.219],
    ],
    0.012,
    paint,
  );
  // The tails of the separate scale rows follow the narrowing body.
  const rows = detail >= 3 ? 11 : 5;
  for (let r = 0; r < rows; r++) {
    const t = r / (rows - 1),
      y = 1.24 - 0.74 * t,
      center = 2.886 + 0.074 * t,
      width = 0.166 * (1 - 0.71 * t);
    const count = detail >= 3 ? (r < 5 ? 4 : r < 8 ? 3 : 2) : 2;
    for (let a = 0; a < count; a++) {
      const seg = (2 * width) / count,
        x = center - width + seg * a + 0.04 * seg * (r % 2);
      wire(
        out,
        [
          [x, y, 0.199],
          [x + seg * 0.5, y - 0.024, 0.204],
          [x + seg * 0.96, y + 0.002, 0.198],
        ],
        detail >= 3 ? 0.009 : 0.011,
        paint,
        4,
      );
    }
  }
  for (const row of [
    [
      [2.29, 0.32, 0.179],
      [2.56, 0.28, 0.2],
      [2.82, 0.31, 0.204],
      [3.07, 0.43, 0.19],
    ],
    [
      [2.29, 0.46, 0.174],
      [2.55, 0.36, 0.2],
      [2.83, 0.36, 0.208],
      [3.05, 0.45, 0.194],
    ],
    [
      [2.27, 0.58, 0.168],
      [2.58, 0.41, 0.192],
      [2.85, 0.39, 0.203],
    ],
  ])
    wire(out, row, 0.012, paint);
  if (detail < 3) return;
  for (const [from, to] of [
    [
      [2.71, 1.91],
      [2.31, 1.29],
    ],
    [
      [3.05, 1.89],
      [3.61, 1.47],
    ],
  ]) {
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7,
        x = from[0] + (to[0] - from[0]) * t,
        y = from[1] + (to[1] - from[1]) * t;
      wire(
        out,
        [
          [x - 0.024, y - 0.019, 0.204],
          [x, y, 0.245],
          [x + 0.033, y + 0.014, 0.21],
        ],
        0.012,
        paint,
        4,
      );
    }
  }
}

function seatedDrummer(out, detail) {
  ironPatch(
    out,
    [
      [1.5, 0.99],
      [1.57, 1.32],
      [1.71, 1.49],
      [1.94, 1.45],
      [2.09, 1.27],
      [2.05, 1.05],
      [2.14, 0.9],
      [2.03, 0.78],
      [1.9, 0.82],
      [1.84, 0.64],
      [1.65, 0.64],
      [1.61, 0.83],
      [1.46, 0.78],
    ],
    0.116,
  );
  ovalHead(out, 1.78, 1.52, 0.93, detail, 1);
  ironPatch(
    out,
    [
      [1.69, 1.53],
      [1.7, 1.64],
      [1.77, 1.69],
      [1.87, 1.64],
      [1.89, 1.55],
    ],
    0.08,
    patina,
  );
  ironPatch(
    out,
    [
      [1.62, 0.81],
      [1.8, 0.84],
      [1.81, 0.64],
      [1.72, 0.34],
      [1.55, 0.28],
      [1.55, 0.39],
      [1.63, 0.43],
      [1.59, 0.62],
    ],
    0.077,
  );
  ironPatch(
    out,
    [
      [1.83, 0.81],
      [1.98, 0.85],
      [1.98, 0.63],
      [1.92, 0.4],
      [1.97, 0.37],
      [1.94, 0.28],
      [1.78, 0.31],
      [1.82, 0.44],
      [1.79, 0.64],
    ],
    0.095,
  );
  wire(
    out,
    [
      [1.54, 1.27, 0.166],
      [1.53, 1.12, 0.21],
      [1.66, 0.99, 0.242],
      [1.84, 1.0, 0.244],
    ],
    0.039,
    paint,
  );
  const barrel = [1.84, 1.04, 0.246];
  sphere(out, 'iron', barrel, [0.266, 0.118, 0.121], patina, detail >= 3 ? 14 : 10, 6);
  wire(
    out,
    [
      [1.58, 1.015, 0.258],
      [1.72, 1.055, 0.354],
      [1.92, 1.049, 0.355],
      [2.08, 1.02, 0.263],
    ],
    0.019,
    paint,
  );
  if (detail < 3) return;
  for (const x of [1.65, 1.75, 1.85, 1.95, 2.04])
    wire(
      out,
      [
        [x, 1.107, 0.315],
        [x + 0.026, 1.049, 0.366],
        [x + 0.047, 0.989, 0.319],
      ],
      0.012,
      rim,
      4,
    );
  wire(
    out,
    [
      [2.045, 1.3, 0.161],
      [2.104, 1.18, 0.219],
      [2.047, 1.091, 0.279],
      [1.912, 1.11, 0.36],
    ],
    0.038,
    ironRelief,
  );
  for (const x of [1.59, 1.65, 1.71, 1.77, 1.9, 1.96, 2.02])
    wire(
      out,
      [
        [x + 0.011, 0.823, 0.207],
        [x - 0.021, 0.735, 0.218],
        [x - 0.024, 0.667, 0.206],
      ],
      0.009,
      paint,
      4,
    );
}

function kneelingBearer(out, detail) {
  const x = 4.67;
  const p = ([u, v]) => [x + u, v];
  ironPatch(
    out,
    [
      [-0.17, 1.48],
      [0.02, 1.59],
      [0.22, 1.44],
      [0.32, 1.13],
      [0.42, 0.84],
      [0.37, 0.44],
      [0.2, 0.31],
      [-0.13, 0.3],
      [-0.31, 0.44],
      [-0.4, 0.62],
      [-0.3, 0.84],
      [-0.35, 1.12],
      [-0.2, 1.26],
    ].map(p),
    0.1,
  );
  ovalHead(out, x, 1.45, 0.9, detail, 1);
  ironPatch(
    out,
    [
      [x - 0.11, 1.49],
      [x - 0.04, 1.67],
      [x + 0.047, 1.65],
      [x + 0.086, 1.5],
    ],
    0.11,
    paint,
  );
  wire(
    out,
    [
      [x - 0.1, 1.31, 0.215],
      [x - 0.22, 1.1, 0.23],
      [x - 0.36, 1.04, 0.285],
      [x - 0.25, 0.91, 0.283],
      [x - 0.05, 0.94, 0.235],
    ],
    0.045,
    ironRelief,
  );
  wire(
    out,
    [
      [x + 0.116, 1.29, 0.202],
      [x + 0.208, 1.1, 0.253],
      [x + 0.328, 1.01, 0.235],
      [x + 0.224, 0.83, 0.228],
      [x - 0.027, 0.78, 0.23],
    ],
    0.044,
    paint,
  );
  wire(
    out,
    [
      [x - 0.245, 0.62, 0.223],
      [x - 0.066, 0.576, 0.254],
      [x + 0.101, 0.63, 0.248],
      [x + 0.31, 0.55, 0.2],
    ],
    0.022,
    paint,
  );
  if (detail >= 3)
    for (let i = 0; i < 6; i++) {
      const u = -0.21 + i * 0.076;
      wire(
        out,
        [
          [x + u, 1.046, 0.219],
          [x + 0.81 * u, 0.85, 0.263],
          [x + u * 1.25, 0.585, 0.214],
        ],
        0.013,
        paint,
        4,
      );
    }
}

function hoodedBearer(out, detail) {
  ironPatch(
    out,
    [
      [3.49, 1.0],
      [3.45, 1.43],
      [3.51, 1.73],
      [3.63, 1.86],
      [3.89, 1.82],
      [4.02, 1.58],
      [4.11, 1.18],
      [3.96, 1.21],
      [3.86, 1.43],
      [3.59, 1.34],
    ],
    0.085,
    patina,
  );
  ironPatch(
    out,
    [
      [3.51, 1.69],
      [3.57, 1.835],
      [3.69, 1.88],
      [3.92, 1.869],
      [4.01, 1.74],
      [3.89, 1.752],
      [3.677, 1.748],
    ],
    0.15,
    ironRelief,
  );
  ovalHead(out, 3.745, 1.502, 0.86, detail);
  wire(
    out,
    [
      [3.522, 1.276, 0.175],
      [3.64, 1.364, 0.233],
      [3.823, 1.375, 0.238],
      [3.935, 1.44, 0.2],
    ],
    0.024,
    paint,
  );
  if (detail < 3) return;
  for (let i = 0; i < 5; i++) {
    const y = 1.56 + i * 0.029;
    wire(
      out,
      [
        [3.61, y, 0.18],
        [3.733, y + 0.01, 0.208],
        [3.841, y, 0.185],
      ],
      0.007,
      rim,
      4,
    );
  }
}

function vessel(out, x, y, width, height, detail, color, carved = false) {
  const sides = detail >= 3 ? 16 : 8;
  // Folded metal turns under at the lip into a shallow dark bowl.
  const stages = [
    [0, 0.39, 0.047],
    [0.11, 0.73, 0.117],
    [0.34, 0.99, 0.173],
    [0.64, 1, 0.181],
    [0.83, 0.75, 0.14],
    [0.94, 0.67, 0.13],
    [1, 0.82, 0.118],
    [0.951, 0.61, 0.096],
    [0.82, 0.53, 0.075],
  ];
  const rings = stages.map(([h, r, z]) =>
    radialRing(y + h * height, width * r * 0.5, z, sides, [x, 0.144]),
  );
  loft(out, 'iron', rings, color);
  const half = width * 0.42;
  if (detail < 3 || !carved) return;
  wire(
    out,
    [
      [x - half, y + height * 0.41, 0.246],
      [x - half * 0.67, y + height * 0.364, 0.298],
      [x, y + height * 0.35, 0.329],
      [x + half * 0.68, y + height * 0.366, 0.298],
      [x + half, y + height * 0.42, 0.246],
    ],
    0.013,
    rim,
  );
  for (let i = 0; i < 8; i++) {
    const u = (i - 3.5) / 4.5;
    const center = x + half * u;
    const z = 0.326 - 0.081 * u * u;
    const Y = y + height * 0.28;
    wire(
      out,
      [
        [center - 0.038, Y - 0.048, z],
        [center + 0.004, Y, z + 0.008],
        [center + 0.026, Y + 0.035, z],
        [center + 0.046, Y + 0.016, z],
      ],
      0.008,
      rim,
      4,
    );
    wire(
      out,
      [
        [center - 0.04, Y + 0.015, z],
        [center - 0.024, Y + 0.043, z],
        [center + 0.013, Y + 0.051, z],
      ],
      0.008,
      paint,
      4,
    );
  }
}

const coats = [
  {
    body: [
      [5.75, 0.92],
      [5.66, 1.25],
      [5.78, 1.62],
      [5.89, 1.72],
      [6.02, 1.7],
      [6.12, 1.55],
      [6.23, 1.23],
      [6.26, 0.93],
      [6.13, 0.8],
      [5.92, 0.89],
      [5.77, 0.83],
    ],
    head: [5.948, 1.79],
    hem: [5.71, 6.2, 0.85],
    legs: [5.841, 6.09],
    arms: [
      [
        [5.84, 1.56],
        [5.68, 1.38],
        [5.72, 1.21],
        [5.87, 1.24],
      ],
      [
        [6.045, 1.57],
        [6.24, 1.33],
        [6.34, 1.23],
      ],
    ],
  },
  {
    body: [
      [6.31, 0.84],
      [6.22, 1.24],
      [6.28, 1.46],
      [6.51, 1.63],
      [6.67, 1.58],
      [6.78, 1.46],
      [6.9, 1.15],
      [6.84, 0.88],
      [6.67, 0.75],
      [6.54, 0.82],
      [6.4, 0.76],
    ],
    head: [6.566, 1.73],
    hem: [6.34, 6.83, 0.8],
    legs: [6.43, 6.738],
    arms: [
      [
        [6.39, 1.48],
        [6.32, 1.2],
        [6.41, 1.09],
        [6.68, 1.11],
      ],
      [
        [6.68, 1.46],
        [6.86, 1.28],
        [6.95, 1.18],
      ],
    ],
  },
  {
    body: [
      [8.04, 0.72],
      [8.01, 1.17],
      [8.07, 1.37],
      [8.15, 1.53],
      [8.34, 1.51],
      [8.47, 1.57],
      [8.56, 1.37],
      [8.53, 1.1],
      [8.63, 0.76],
      [8.43, 0.7],
      [8.27, 0.75],
      [8.13, 0.7],
    ],
    head: [8.376, 1.71],
    hem: [8.05, 8.58, 0.75],
    legs: [8.21, 8.464],
    arms: [
      [
        [8.17, 1.44],
        [7.99, 1.31],
        [7.99, 1.1],
        [8.28, 1.16],
      ],
      [
        [8.46, 1.49],
        [8.53, 1.26],
        [8.49, 1.14],
        [8.32, 1.17],
      ],
    ],
  },
];

function musicians(out, detail) {
  for (const {
    body,
    head: [x, y],
    hem: [left, right, low],
    legs,
    arms,
  } of coats) {
    for (const a of legs)
      ironPatch(
        out,
        [
          [a - 0.09, 0.92],
          [a + 0.095, 0.95],
          [a + 0.068, 0.41],
          [a + 0.12, 0.31],
          [a + 0.015, 0.23],
          [a - 0.11, 0.27],
          [a - 0.086, 0.43],
        ],
        0.079,
        patina,
      );
    ironPatch(out, body, 0.123);
    ovalHead(out, x, y, 1.05, detail);
    ironPatch(
      out,
      [
        [x - 0.214, y + 0.056],
        [x - 0.103, y + 0.124],
        [x + 0.069, y + 0.13],
        [x + 0.186, y + 0.043],
        [x + 0.107, y + 0.007],
        [x - 0.19, y + 0.023],
      ],
      0.109,
      paint,
    );
    for (const path of arms)
      wire(
        out,
        path.map(([x, y], i) => [x, y, i === 0 ? 0.177 : i === 1 ? 0.254 : 0.263]),
        0.039,
        paint,
      );
    for (let i = 0; i < (detail >= 3 ? 8 : 3); i++) {
      const bows = detail >= 3 ? 7 : 2;
      const u = i / bows,
        edge = left + (right - left) * u;
      wire(
        out,
        [
          [x + (u - 0.5) * 0.265, low + 0.62, 0.229],
          [edge + (u - 0.5) * 0.011, low + 0.24, 0.235],
          [edge, low + 0.028, 0.224],
        ],
        detail >= 3 ? 0.01 : 0.011,
        paint,
        4,
      );
    }
  }
  // The raised oval mask and cup stand above the largest vessel on the right leaf.
  ironPatch(
    out,
    [
      [7.187, 1.95],
      [7.365, 1.99],
      [7.565, 1.9],
      [7.573, 1.69],
      [7.69, 1.58],
      [7.53, 1.47],
      [7.376, 1.53],
      [7.266, 1.48],
      [7.098, 1.61],
      [7.187, 1.69],
    ],
    0.152,
    patina,
  );
  wire(
    out,
    [
      [7.18, 1.56, 0.222],
      [7.291, 1.58, 0.281],
      [7.445, 1.542, 0.287],
      [7.59, 1.585, 0.25],
    ],
    0.022,
    ironRelief,
  );
  if (detail >= 3) {
    wire(
      out,
      [
        [7.34, 1.93, 0.24],
        [7.29, 1.86, 0.261],
        [7.31, 1.77, 0.266],
        [7.4, 1.72, 0.246],
        [7.47, 1.77, 0.263],
        [7.48, 1.87, 0.258],
        [7.42, 1.92, 0.24],
      ],
      0.012,
      paint,
    );
    wire(
      out,
      [
        [6.02, 1.62, 0.25],
        [6.29, 1.74, 0.264],
        [6.67, 1.98, 0.185],
      ],
      0.021,
      paint,
    );
    wire(
      out,
      [
        [5.74, 1.29, 0.264],
        [6.07, 1.14, 0.265],
        [6.43, 1.18, 0.282],
      ],
      0.021,
      rim,
    );
    wire(
      out,
      [
        [8.54, 1.12, 0.241],
        [8.33, 1.24, 0.316],
        [8.12, 1.17, 0.252],
      ],
      0.021,
      rim,
    );
  }
}

function fishAndSeam(out) {
  const fish = (x, y, s, skew) => {
    const f = ([u, v]) => [x + u * s, y + v * s + u * skew * s];
    ironPatch(
      out,
      [
        [-0.23, 0],
        [-0.17, 0.082],
        [-0.054, 0.12],
        [0.096, 0.081],
        [0.165, 0.017],
        [0.218, 0.065],
        [0.24, -0.054],
        [0.166, -0.025],
        [0.034, -0.093],
        [-0.083, -0.092],
      ].map(f),
      0.065,
      paint,
    );
    wire(
      out,
      [
        [-0.16, 0.014],
        [-0.09, 0.003],
        [0.05, -0.018],
        [0.144, 0.024],
      ].map((p) => [...f(p), 0.162]),
      0.01,
      patina,
      4,
    );
  };
  fish(1.81, 2.009, 0.94, -0.36);
  fish(2.41, 1.88, 1.02, 0.48);
  fish(3.26, 2.074, 0.91, -0.34);
  fish(7.031, 1.865, 0.9, -0.2);
  fish(7.79, 1.998, 0.78, 0.71);
  fish(8.6, 1.928, 0.82, -0.6);
  for (let k = 0; k < 12; k++) {
    const y = 0.32 + k * 0.15;
    const d = 0.037 * Math.cos((k - 4) * 0.22);
    wire(
      out,
      [
        [5.41, y, 0.14],
        [5.54 + d, y + 0.024, 0.244],
        [5.67 + d, y + 0.006, 0.194],
      ],
      0.024,
      paint,
      4,
    );
  }
}
function metalGates(out, detail) {
  for (const pattern of leaves) {
    const line =
      detail === 0 ? pattern.filter((_, i) => i % 3 === 0 || i === pattern.length - 1) : pattern;
    lowWall(out, 'iron', roundCrown(line, detail), 0.135, 0.106, -0.027, iron);
  }
  box(out, 'earth', [8.85, -0.12, -0.35], [9.36, 2.42, 0.29], clay);
  box(out, 'base', [8.84, -1.42, -0.37], [9.37, -0.114, 0.31], [0.29, 0.26, 0.21]);
  if (detail === 0) return;
  for (const x of [1.42, 5.12, 5.48, 8.68]) {
    box(out, 'iron', [x - 0.049, -0.016, -0.045], [x + 0.049, 0.17, 0.112], iron);
  }
  mermaid(out, detail);
  if (detail >= 2) {
    seatedDrummer(out, detail);
    kneelingBearer(out, detail);
    hoodedBearer(out, detail);
    musicians(out, detail);
    vessel(out, 3.69, 0.21, 0.86, 0.87, detail, ironRelief, true);
    vessel(out, 4.12, 0.36, 0.52, 0.62, detail, patina);
    vessel(out, 7.43, 0.185, 0.935, 1.05, detail, ironRelief, true);
    if (detail >= 3) fishAndSeam(out);
  }
  sphere(out, 'iron', [4.78, 1.98, 0.156], [0.45, 0.49, 0.163], paint, detail >= 3 ? 18 : 10, 6);
  beamPath(
    out,
    'iron',
    [
      [4.34, 1.93, 0.177],
      [4.65, 1.91, 0.307],
      [4.94, 1.91, 0.312],
      [5.22, 1.94, 0.181],
    ],
    0.057,
    0.048,
    iron,
  );
  if (detail >= 2) {
    for (const [i, y] of [0.26, 0.64, 1.08, 1.48, 1.9].entries())
      clayCup(out, 9.1, y, 0.17, 0.18, 0.29, 0.26, detail, i);
  }
}

// The concrete apron joins the arch and iron leaves to the sheltered portal.
// Its grove-side edge narrows at the wall ends and drops toward the clay sill.
const apronStations = [
  [-7.9, -0.72, 0.16, -0.06],
  [-6.4, -1.26, 0.17, -0.1],
  [-4.1, -2.04, 0.17, -0.13],
  [-1.8, -2.91, 0.13, -0.2],
  [-0.51, -3.68, 0.15, -0.22],
  [0.82, -4.18, 0.18, -0.27],
  [2.51, -4.29, 0.17, -0.27],
  [4.14, -3.87, 0.15, -0.21],
  [6.22, -3.43, 0.16, -0.18],
  [7.75, -2.36, 0.17, -0.16],
  [9.36, -1.11, 0.2, -0.1],
];

function forecourtPaving(out, detail) {
  const controls =
    detail === 0 ? apronStations.filter((_, i) => [0, 3, 5, 6, 8, 10].includes(i)) : apronStations;
  const bands = [2, 3, 6, 9, 12][detail];
  const point = ([x, back, front, backHeight], j) => {
    const t = j / bands;
    const z = front + (back - front) * t;
    const weathering = Math.sin(17.3 * x + 9.61 * z) * Math.sin(11.7 * z) * 0.015;
    const y = -0.019 + (backHeight + 0.019) * t + weathering * t;
    return [x, y, z];
  };
  const paint = ([x, , z]) => {
    const blemish =
      0.5 + 0.08 * Math.sin(x * 3.91 + 2.18 * z) + 0.035 * Math.cos(x * 6.4 - z * 3.53);
    const wet = 0.5 + 0.1 * Math.cos(3.2 * z - x * 0.49);
    return [
      0.26 + 0.18 * blemish - 0.06 * wet,
      0.255 + 0.165 * blemish - 0.03 * wet,
      0.221 + 0.155 * blemish - 0.08 * wet,
    ];
  };
  const apronEdge = (a, b) => {
    // The paving steps into the rising north verge. On the downhill end,
    // its footing continues to the retained terrain below the apron.
    const lower = ([x, y, z]) => [x, y - 0.2 - 0.145 * Math.max(0, x - 1.8), z];
    quad(
      out,
      'paving',
      [a, b, lower(b), lower(a)],
      paint(a).map((channel) => channel * 0.8),
    );
  };
  for (const [i, right] of controls.slice(1).entries()) {
    const left = controls[i];
    for (let j = 0; j < bands; j++) {
      const p = [point(left, j), point(right, j), point(right, j + 1), point(left, j + 1)];
      for (const [a, b, c] of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const triangle = [p[a], p[b], p[c]];
        const center = triangle[0].map(
          (v, axis) => (v + triangle[1][axis] + triangle[2][axis]) / 3,
        );
        out.addTriangle('paving', ref, triangle, normalFor(...triangle), [], paint(center));
      }
    }
    for (const [a, b] of [
      [point(right, 0), point(left, 0)],
      [point(left, bands), point(right, bands)],
    ]) {
      apronEdge(a, b);
    }
  }
  for (const [start, reverse] of [
    [controls[0], false],
    [controls.at(-1), true],
  ]) {
    for (let j = 0; j < bands; j++) {
      const a = point(start, j);
      const b = point(start, j + 1);
      apronEdge(reverse ? b : a, reverse ? a : b);
    }
  }
}

export function buildArugbaRoadside(builder, detail) {
  const out = frontageCoordinates(builder);
  forecourtPaving(out, detail);
  carvedClay(out, detail);
  metalGates(out, detail);
}

/** Cathedral Basilica of Zacatecas, late 2000s. */
import fs from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import {
  B as box,
  rgb,
} from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { quad, tube } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}.json`, import.meta.url)));
const plan = read('plan-controls');
const outline = read('map-frame').geometry.polygons[0];
const ground = read('terrain-grid');
const {
  bounds,
  foundationBottom,
  westThreshold,
  aisleTop,
  naveTop,
  westFrontCenter,
  towers,
  dome,
  sideEntrances,
} = plan.section;
const [west, east, back, front] = bounds;
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  carved: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.93, metallic: 0 },
  cream: { slot: 'roof', graph: 'plaster_lime', roughness: 0.9, metallic: 0 },
  tiles: { slot: 'roof', graph: 'tile_ceramic', roughness: 0.82, metallic: 0 },
  iron: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.77, metallic: 0.32 },
  dark: { slot: 'trim', localRef: 'palette:#fefcff', roughness: 0.89, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries({
    stone: 'c79476',
    carved: 'c78b67',
    cream: 'dfd3b6',
    tiles: '8f776b',
    iron: '686858',
    dark: '59483f',
    ledge: 'd5a07b',
    upper: 'c1947a',
    roof: 'ae9d87',
    window: '504a46',
    light: 'ddc7a9',
    door: '735843',
  }).map(([key, value]) => [key, rgb(value)]),
);

function face(out, slot, points, expected, color = colors[slot]) {
  let normal = normalFor(...points);
  if (normal.reduce((sum, v, i) => sum + v * expected[i], 0) < 0) {
    points = [...points].reverse();
    normal = normalFor(...points);
  }
  if (points.length === 4) quad(out, slot, points, normal, color);
  else
    out.addTriangle(
      slot,
      'palette:#ffffff',
      points,
      normal,
      [
        [0, 0],
        [1, 0],
        [0.5, 1],
      ],
      color,
    );
}
function block(out, slot, [x0, x1, z0, z1], y0, y1, color = colors[slot]) {
  box(out, slot, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, color);
}
function ringShape(out, slot, center, profile, sides, color = colors[slot], cap = true) {
  loft(
    out,
    slot,
    profile.map(([y, r]) => radialRing(y, r, r, sides, center, Math.PI / 8)),
    color,
    { cap },
  );
}
function floorAt(x, z) {
  const u = (x - ground.origin[0]) / ground.stepMeters,
    v = (z - ground.origin[1]) / ground.stepMeters;
  const i = Math.floor(u),
    j = Math.floor(v),
    a = ground.heightsMeters[j],
    b = ground.heightsMeters[j + 1];
  return (
    (a[i] + (a[i + 1] - a[i]) * (u - i)) * (1 - v + j) +
    (b[i] + (b[i + 1] - b[i]) * (u - i)) * (v - j) -
    ground.modelDatumElevationMeters
  );
}
function side(x, z, dx, dz) {
  return {
    at: (u, y, d = 0) => [x + dx * u - dz * d, y, z + dz * u + dx * d],
    normal: [-dz, 0, dx],
    along: [dx, 0, dz],
  };
}
function panel(out, slot, f, x0, x1, low, high, offset, color = colors[slot]) {
  face(
    out,
    slot,
    [f.at(x0, low, offset), f.at(x1, low, offset), f.at(x1, high, offset), f.at(x0, high, offset)],
    f.normal,
    color,
  );
}
function stoneBlock(out, slot, f, x0, x1, y0, y1, back, front, color = colors[slot]) {
  const a = f.at(x0, 0, back),
    b = f.at(x1, 0, front);
  block(
    out,
    slot,
    [Math.min(a[0], b[0]), Math.max(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[2], b[2])],
    y0,
    y1,
    color,
  );
}
function archPoints(width, spring, rise, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const angle = Math.PI * (1 - i / segments);
    return [(Math.cos(angle) * width) / 2, spring + Math.sin(angle) * rise];
  });
}
function reliefArch(
  out,
  f,
  u,
  width,
  bottom,
  spring,
  rise,
  lod,
  depth,
  slot = 'dark',
  tone = colors.window,
) {
  const left = u - width / 2,
    right = u + width / 2,
    curve = archPoints(width, spring, rise, [2, 6, 8, 12][lod]);
  panel(out, slot, f, left, right, bottom, spring, depth, tone);
  for (let i = 1; i < curve.length; i++) {
    const [a, y] = curve[i - 1],
      [b, yy] = curve[i];
    face(
      out,
      slot,
      [
        f.at(u, y === spring ? spring : spring + 0.001, depth),
        f.at(u + a, y, depth),
        f.at(u + b, yy, depth),
      ],
      f.normal,
      tone,
    );
    if (lod) {
      const x0 = u + a * 1.1,
        x1 = u + b * 1.1,
        y0 = spring + (y - spring) * 1.1 + 0.08,
        y1 = spring + (yy - spring) * 1.1 + 0.08;
      face(
        out,
        'carved',
        [
          f.at(u + a, y, depth + 0.17),
          f.at(u + b, yy, depth + 0.17),
          f.at(x1, y1, depth + 0.17),
          f.at(x0, y0, depth + 0.17),
        ],
        f.normal,
        colors.ledge,
      );
    }
  }
  if (lod)
    for (const [a, b] of [
      [left - 0.13, left],
      [right, right + 0.13],
    ])
      panel(out, 'carved', f, a, b, bottom, spring + 0.08, depth + 0.17, colors.ledge);
}
function disk(out, f, u, y, r, depth, lod, slot, tone, inner = 0) {
  const count = [8, 12, 16, 24][lod];
  const at = (r, angle) => f.at(u + r * Math.cos(angle), y + r * Math.sin(angle), depth);
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count,
      b = ((i + 1) * Math.PI * 2) / count;
    const p = inner
      ? [at(inner, a), at(r, a), at(r, b), at(inner, b)]
      : [f.at(u, y, depth), at(r, a), at(r, b)];
    face(out, slot, p, f.normal, tone);
  }
}
function finial(out, x, z, y, height, lod) {
  const s = height;
  ringShape(
    out,
    'carved',
    [x, z],
    [
      [y, s * 0.17],
      [y + s * 0.18, s * 0.22],
      [y + s * 0.38, s * 0.145],
      [y + s * 0.63, s * 0.18],
      [y + s, s * 0.035],
    ].filter((_, i) => lod > 1 || i % 2 === 0),
    lod > 1 ? 8 : 5,
    colors.ledge,
    false,
  );
}
function cross(out, x, z, y, scale, lod) {
  if (!lod) {
    const f = side(x, z, 1, 0);
    panel(out, 'iron', f, -0.09 * scale, 0.09 * scale, y, y + 1.35 * scale, 0);
    panel(out, 'iron', f, -0.53 * scale, 0.53 * scale, y + 0.77 * scale, y + 0.92 * scale, 0.008);
    return;
  }
  tube(out, 'iron', [x, y, z], [x, y + 1.35 * scale, z], 0.065 * scale, colors.iron, 6);
  tube(
    out,
    'iron',
    [x - 0.5 * scale, y + 0.85 * scale, z],
    [x + 0.5 * scale, y + 0.85 * scale, z],
    0.052 * scale,
    colors.iron,
    6,
  );
}

function bellStage(out, x, z, half, base, top, lod) {
  const foot = base + (top - base) * 0.16;
  block(
    out,
    'carved',
    [x - half - 0.27, x + half + 0.27, z - half - 0.27, z + half + 0.27],
    base,
    foot,
    colors.ledge,
  );
  block(
    out,
    'carved',
    [x - half - 0.29, x + half + 0.29, z - half - 0.29, z + half + 0.29],
    top - 0.5,
    top,
    colors.ledge,
  );
  const rise = (top - base) * 0.19,
    spring = top - (top - base) * 0.16 - rise;
  const centers = [-half * 0.42, half * 0.42],
    w = half * 0.52;
  const edges = [
    side(x, z + half, 1, 0),
    side(x + half, z, 0, -1),
    side(x, z - half, -1, 0),
    side(x - half, z, 0, 1),
  ];
  for (const f of edges) {
    if (lod >= 2) {
      stoneBlock(
        out,
        'carved',
        f,
        -half - 0.12,
        half + 0.12,
        base + 0.43,
        base + 0.78,
        0.27,
        0.49,
        colors.ledge,
      );
      stoneBlock(
        out,
        'carved',
        f,
        -half - 0.15,
        half + 0.15,
        top - 0.58,
        top - 0.13,
        0.23,
        0.57,
        colors.ledge,
      );
    }
    if (!lod) {
      panel(out, 'stone', f, -half, half, foot, top - 0.48, 0);
      for (const u of centers) reliefArch(out, f, u, w, foot + 0.12, spring, rise, 0, 0.035);
      continue;
    }
    const outer = [
      -half,
      centers[0] - w / 2,
      centers[0] + w / 2,
      centers[1] - w / 2,
      centers[1] + w / 2,
      half,
    ];
    for (let i = 0; i < outer.length - 1; i += 2)
      stoneBlock(out, 'stone', f, outer[i], outer[i + 1], foot, top - 0.48, -0.93, 0);
    const curve = archPoints(w, spring, rise, lod === 1 ? 4 : lod === 2 ? 6 : 8);
    for (const u of centers) {
      for (let i = 1; i < curve.length; i++) {
        const [a, y] = curve[i - 1],
          [b, yy] = curve[i];
        face(
          out,
          'stone',
          [f.at(u + a, y), f.at(u + b, yy), f.at(u + b, top - 0.48), f.at(u + a, top - 0.48)],
          f.normal,
        );
        face(
          out,
          'carved',
          [f.at(u + a, y), f.at(u + b, yy), f.at(u + b, yy, -0.93), f.at(u + a, y, -0.93)],
          [0, -1, 0],
        );
      }
      if (lod >= 2) {
        const [bx, , bz] = f.at(u, 0, -0.79);
        ringShape(
          out,
          'iron',
          [bx, bz],
          [
            [spring - 2.02, 0.67],
            [spring - 1.82, 0.52],
            [spring - 0.73, 0.34],
            [spring - 0.55, 0.24],
          ],
          lod === 2 ? 8 : 12,
        );
      }
    }
    if (lod >= 2)
      for (const u of [-half + 0.36, 0, half - 0.36]) {
        stoneBlock(out, 'carved', f, u - 0.16, u + 0.16, foot, top - 0.55, -0.04, 0.25);
        stoneBlock(
          out,
          'carved',
          f,
          u - 0.24,
          u + 0.24,
          top - 1.15,
          top - 0.55,
          -0.045,
          0.37,
          colors.ledge,
        );
      }
  }
}
function tower(out, s, lod) {
  const { center: x, width, depth, baseTop, lowerTop, upperTop, capTop, lanternTop } = s;
  const z = front - depth * 0.47;
  block(
    out,
    'stone',
    [x - width / 2, x + width / 2, front - depth, front],
    foundationBottom,
    baseTop,
  );
  block(
    out,
    'carved',
    [x - width / 2 - 0.17, x + width / 2 + 0.17, front - depth - 0.2, front + 0.24],
    baseTop - 0.55,
    baseTop,
    colors.ledge,
  );
  bellStage(out, x, z, width * 0.43, baseTop, lowerTop, lod);
  bellStage(out, x, z, width * 0.345, lowerTop, upperTop, lod);
  const n = lod === 0 ? 8 : lod === 1 ? 12 : lod === 2 ? 16 : 24;
  const r = width * 0.345;
  ringShape(
    out,
    'tiles',
    [x, z],
    [
      [upperTop - 0.15, r],
      [upperTop + 0.8, r * 0.91],
      [capTop - 0.9, r * 0.49],
      [capTop, 0.75],
    ],
    n,
  );
  if (lod >= 2) {
    const count = 12;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        p = (rr, y) => [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
      beam(
        out,
        'cream',
        p(r * 0.916, upperTop + 0.82),
        p(r * 0.499, capTop - 0.9),
        0.105,
        0.11,
        colors.light,
      );
    }
  }
  ringShape(
    out,
    'carved',
    [x, z],
    [
      [capTop - 0.05, 0.76],
      [capTop + 0.3, 0.67],
      [lanternTop - 0.31, 0.55],
      [lanternTop, 0.67],
    ],
    lod > 1 ? 8 : 6,
    colors.ledge,
  );
  cross(out, x, z, lanternTop, 1, lod);
  if (s.clock) {
    const f = side(x + width / 2, z, 0, -1),
      y = baseTop - 1.43;
    disk(out, f, 1.17, y, 0.81, 0.05, lod, 'cream', colors.light);
    if (lod) disk(out, f, 1.17, y, 0.88, 0.064, lod, 'carved', colors.ledge, 0.79);
    if (lod) {
      panel(out, 'iron', f, 1.13, 1.2, y, y + 0.46, 0.091);
      face(
        out,
        'iron',
        [
          f.at(1.17, y - 0.026, 0.092),
          f.at(0.82, y - 0.25, 0.092),
          f.at(0.86, y - 0.29, 0.092),
          f.at(1.2, y - 0.045, 0.092),
        ],
        f.normal,
      );
    }
  }
}
function pilaster(out, f, u, y0, y1, depth, lod, half = 0.34) {
  stoneBlock(out, 'carved', f, u - half, u + half, y0, y1, -0.025, depth, colors.carved);
  for (const [a, b] of [
    [y0, y0 + 0.33],
    [y1 - 0.44, y1],
  ])
    stoneBlock(
      out,
      'carved',
      f,
      u - half - 0.15,
      u + half + 0.15,
      a,
      b,
      -0.04,
      depth + 0.16,
      colors.ledge,
    );
  if (lod >= 2) {
    for (let i = 0; i < 5; i++) {
      const y = y0 + 0.62 + ((y1 - y0 - 1.42) * i) / 5;
      face(
        out,
        'carved',
        [
          f.at(u - half, y, depth + 0.035),
          f.at(u + half, y + 0.28, depth + 0.035),
          f.at(u + half, y + 0.42, depth + 0.035),
          f.at(u - half, y + 0.15, depth + 0.035),
        ],
        f.normal,
        colors.ledge,
      );
    }
  }
}
function niche(out, f, u, y, w, h, lod, d = 0.15) {
  reliefArch(out, f, u, w, y, y + h * 0.73, h * 0.25, lod, d, 'dark', colors.door);
  if (lod >= 2) {
    const q = f.at(u, 0, d + 0.15);
    const base = y + 0.18,
      top = y + h * 0.77;
    ringShape(
      out,
      'carved',
      [q[0], q[2]],
      [
        [base, w * 0.22],
        [base + h * 0.12, w * 0.3],
        [top - h * 0.27, w * 0.22],
        [top - h * 0.18, w * 0.19],
        [top - h * 0.11, w * 0.14],
        [top - h * 0.04, w * 0.16],
        [top, w * 0.09],
      ],
      lod === 2 ? 5 : 7,
      colors.ledge,
      false,
    );
  }
}
function steps(out, f, width, floor, lod) {
  const [x, , z] = f.at(0, 0, 2.65),
    grade = floorAt(x, z) + 0.035;
  if (grade >= floor - 0.07) return;
  const count = lod ? Math.min(8, Math.max(2, Math.ceil((floor - grade) / 0.16))) : 1;
  const run = Math.max(1.25, (floor - grade) * 2.85);
  for (let i = 0; i < count; i++)
    stoneBlock(
      out,
      'carved',
      f,
      -width / 2,
      width / 2,
      grade - 0.65,
      floor - ((floor - grade) * i) / count,
      0.36 + (run * i) / count,
      0.36 + (run * (i + 1)) / count,
      colors.ledge,
    );
}
function mainPortal(out, lod) {
  const f = side(westFrontCenter, front, 1, 0);
  stoneBlock(out, 'stone', f, -8.1, 8.1, foundationBottom, 18.7, -1.65, 0.16);
  stoneBlock(out, 'carved', f, -7.8, 7.8, westThreshold, 9.12, 0.16, 0.38);
  stoneBlock(out, 'carved', f, -7.43, 7.43, 9.38, 17.02, 0.16, 0.33);
  stoneBlock(out, 'carved', f, -5.22, 5.22, 17.43, 22.08, -1.32, 0.28);
  stoneBlock(out, 'carved', f, -2.23, 2.23, 22.08, 23.45, -1.27, 0.26);
  for (const [half, y0, y1] of [
    [8.15, 8.92, 9.43],
    [7.57, 16.88, 17.47],
    [5.47, 21.72, 22.19],
  ])
    stoneBlock(out, 'carved', f, -half, half, y0, y1, -0.04, 0.82, colors.ledge);
  reliefArch(out, f, 0, 4.8, westThreshold, 5.11, 1.99, lod, 0.41, 'dark', colors.door);
  disk(out, f, 0, 13.2, 1.65, 0.355, lod, 'dark', colors.window);
  disk(out, f, 0, 13.2, 2.0, 0.48, lod, 'carved', colors.ledge, 1.56);
  if (lod) {
    const detail = lod === 1 ? 6 : 8;
    for (let i = 0; i < detail; i++) {
      const a = (i * 2 * Math.PI) / detail;
      beam(
        out,
        'carved',
        f.at(0, 13.2, 0.515),
        f.at(1.56 * Math.cos(a), 13.2 + 1.56 * Math.sin(a), 0.515),
        0.12,
        0.105,
        colors.ledge,
      );
    }
    for (const sign of [-1, 1]) {
      for (const u of [3.03, 5.18, 7.28])
        pilaster(out, f, sign * u, westThreshold + 0.26, 8.95, 0.74, lod);
      for (const u of [2.68, 4.86, 6.9]) pilaster(out, f, sign * u, 9.47, 16.9, 0.66, lod, 0.28);
      pilaster(out, f, sign * 2.35, 17.6, 21.8, 0.58, lod, 0.28);
      pilaster(out, f, sign * 4.72, 17.6, 21.8, 0.52, lod, 0.26);
      for (const u of [4.09, 6.16]) niche(out, f, sign * u, 2.34, 1.1, 3.35, lod, 0.42);
      for (const u of [3.71, 5.83]) niche(out, f, sign * u, 11.07, 1.13, 3.27, lod, 0.37);
      const [x, , z] = f.at(sign * 5.05, 0, 0.04);
      finial(out, x, z, 22.12, 1.24, lod);
    }
    niche(out, f, 0, 18.35, 1.68, 2.9, lod, 0.32);
  }
  const crest = lod
    ? [
        [-4.9, 22.03],
        [-3.47, 22.79],
        [-2.39, 22.95],
        [-1.47, 23.8],
        [0, 24.09],
        [1.47, 23.8],
        [2.39, 22.95],
        [3.47, 22.79],
        [4.9, 22.03],
      ]
    : [
        [-4.9, 22.03],
        [0, 24.09],
        [4.9, 22.03],
      ];
  for (let i = 1; i < crest.length; i++) {
    const [a, y] = crest[i - 1],
      [b, yy] = crest[i];
    face(
      out,
      'carved',
      [f.at(a, 21.98, 0.29), f.at(b, 21.98, 0.29), f.at(b, yy, 0.29), f.at(a, y, 0.29)],
      f.normal,
    );
    if (lod >= 2)
      beam(out, 'carved', f.at(a, y, 0.34), f.at(b, yy, 0.34), 0.21, 0.24, colors.ledge);
  }
  cross(out, westFrontCenter, front - 0.32, 24.05, 0.81, lod);
  steps(out, f, 7.15, westThreshold, lod);
}
function nave(out, lod) {
  const x = westFrontCenter;
  block(out, 'stone', bounds, foundationBottom, aisleTop - 0.28);
  block(
    out,
    'carved',
    [west - 0.16, east + 0.16, back - 0.16, front - 0.26],
    aisleTop - 0.51,
    aisleTop,
    colors.ledge,
  );
  block(out, 'stone', [x - 8.2, x + 8.2, back + 0.43, front - 5.3], aisleTop, naveTop - 0.4);
  block(
    out,
    'stone',
    [west + 2.15, east - 2.15, -21.9, -5.8],
    aisleTop,
    naveTop - 0.4,
    colors.upper,
  );
  block(
    out,
    'cream',
    [x - 8.3, x + 8.3, back + 0.39, front - 5.27],
    naveTop - 0.45,
    naveTop,
    colors.roof,
  );
  block(
    out,
    'cream',
    [west + 2.08, east - 2.08, -21.99, -5.75],
    naveTop - 0.44,
    naveTop + 0.025,
    colors.roof,
  );
  if (lod) {
    for (const sign of [-1, 1]) {
      const f = side(sign < 0 ? west : east, 0, 0, -sign);
      for (const z of [-31, -24, -15, -6, 11, 17]) {
        const u = z * -sign;
        const y = 7.2 + (z === 17 ? 0.15 : 0);
        panel(out, 'carved', f, u - 0.94, u + 0.94, y - 0.16, y + 2.65, 0.06, colors.ledge);
        panel(out, 'dark', f, u - 0.72, u + 0.72, y, y + 2.48, 0.1, colors.window);
        if (lod >= 2) {
          panel(out, 'carved', f, u - 0.07, u + 0.07, y, y + 2.48, 0.132, colors.upper);
          panel(out, 'carved', f, u - 0.72, u + 0.72, y + 1.07, y + 1.2, 0.132, colors.upper);
        }
      }
      if (lod >= 2)
        for (const z of [-32.9, -22.8, -7.2, 8.2, 13.15]) {
          const u = z * -sign;
          stoneBlock(out, 'stone', f, u - 0.29, u + 0.29, 1, aisleTop - 0.17, 0.02, 0.32);
          const [px, , pz] = f.at(u, 0, 0.12);
          finial(out, px, pz, aisleTop, 0.95, lod);
        }
    }
  }
  if (lod >= 2) {
    const rear = side(x, back, -1, 0);
    reliefArch(out, rear, 0, 2.85, 7.23, 10.41, 1.03, lod, 0.035);
    for (const u of [-8.5, 8.5]) {
      panel(out, 'carved', rear, u - 0.85, u + 0.85, 6.75, 9.37, 0.064, colors.ledge);
      panel(out, 'dark', rear, u - 0.64, u + 0.64, 6.97, 9.16, 0.095, colors.window);
    }
  }
  for (const { side: sign, z, threshold } of sideEntrances) {
    const f = side(sign < 0 ? west : east, z, 0, -sign);
    stoneBlock(out, 'carved', f, -3.37, 3.37, threshold, 9.13, -0.1, 0.43);
    stoneBlock(out, 'carved', f, -2.82, 2.82, 9.13, 10.92, -0.12, 0.36);
    reliefArch(out, f, 0, 3.5, threshold, 2.9, 1.62, lod, 0.465, 'dark', colors.door);
    if (lod) {
      niche(out, f, 0, 5.65, 1.5, 2.53, lod, 0.48);
      for (const u of [-2.65, 2.65]) pilaster(out, f, u, threshold, 8.96, 0.74, lod, 0.24);
      stoneBlock(out, 'carved', f, -3.52, 3.52, 8.96, 9.38, -0.02, 0.82, colors.ledge);
      stoneBlock(out, 'carved', f, -2.92, 2.92, 10.74, 11.12, -0.02, 0.67, colors.ledge);
    }
    steps(out, f, 4.5, threshold, lod);
  }
}
function crossing(out, lod) {
  const {
    center: [x, z],
    drumBase,
    drumTop,
    radius: r,
    capTop,
    lanternTop,
  } = dome;
  ringShape(
    out,
    'stone',
    [x, z],
    [
      [drumBase - 0.22, r + 0.63],
      [drumBase + 0.43, r + 0.66],
      [drumTop - 0.38, r],
      [drumTop, r + 0.24],
    ],
    8,
    colors.stone,
  );
  const profile = [
    [drumTop, r],
    [drumTop + 1.53, r * 0.96],
    [drumTop + 3.13, r * 0.87],
    [drumTop + 4.9, r * 0.7],
    [drumTop + 6.36, r * 0.51],
    [capTop - 0.43, r * 0.24],
    [capTop, 0.86],
  ];
  const steps = lod === 0 ? 1 : lod === 1 ? 2 : lod === 2 ? 3 : 4,
    vertices = 8 * steps,
    offset = Math.PI / 8;
  ringShape(
    out,
    'cream',
    [x, z],
    lod === 0 ? profile.filter((_, i) => i % 2 === 0) : profile,
    vertices,
    colors.cream,
  );
  if (lod) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4 + offset,
        p = (y, r) => [x + r * Math.cos(a), y, z + r * Math.sin(a)];
      for (let j = 1; j < profile.length; j++) {
        const [y, r] = profile[j - 1],
          [yy, rr] = profile[j];
        if (lod === 1) {
          const band = (angle, y, r) => [x + r * Math.cos(angle), y, z + r * Math.sin(angle)];
          face(
            out,
            'carved',
            [
              band(a - 0.016, y, r + 0.06),
              band(a + 0.016, y, r + 0.06),
              band(a + 0.016, yy, rr + 0.06),
              band(a - 0.016, yy, rr + 0.06),
            ],
            [Math.cos(a), 1, Math.sin(a)],
            colors.ledge,
          );
        } else beam(out, 'carved', p(y, r + 0.045), p(yy, rr + 0.045), 0.35, 0.19, colors.ledge);
      }
      const next = a + Math.PI / 4,
        m = (a + next) / 2,
        n = [Math.cos(m), 0, Math.sin(m)];
      const u0 = p(drumBase + 0.96, r * 0.924),
        at = (u, y, d) => [
          x + n[0] * (r * 0.924 + d) - n[2] * u,
          y,
          z + n[2] * (r * 0.924 + d) + n[0] * u,
        ];
      const f = { at, normal: n };
      reliefArch(out, f, 0, 1.35, u0[1], drumTop - 1.6, 0.59, lod, 0.22);
    }
  }
  ringShape(
    out,
    'carved',
    [x, z],
    [
      [capTop - 0.09, 1.1],
      [capTop + 0.45, 0.82],
      [lanternTop - 0.43, 0.72],
      [lanternTop, 0.92],
    ],
    lod ? 8 : 6,
    colors.ledge,
  );
  cross(out, x, z, lanternTop, 1.03, lod);
}

function build(out, _frame, lod = 3) {
  nave(out, lod);
  for (const t of towers) tower(out, t, lod);
  mainPortal(out, lod);
  crossing(out, lod);
}
export const cathedralSkyline = (out) => build(out, undefined, 0);
export const cathedralDistrict = (out) => build(out, undefined, 1);
export const cathedralStreet = (out) => build(out, undefined, 2);
export const cathedralCloseup = (out) => build(out, undefined, 3);

const recipe = 'cathedral-model.mjs',
  camera = [70, 47, 94],
  lookAt = [-1, 17, -2];
export const cathedralModel = {
  id: plan.model,
  key: plan.model,
  cell: plan.cell,
  title: plan.title,
  wikidataId: plan.wikidataId,
  recipe,
  surfaces,
  build,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  progressLedger: 'qualla-003.PROGRESS.md',
  brief:
    'Rose cantera cathedral basilica with carved west front, two open belfries, three-aisle massing and cream crossing dome.',
  appearance: {
    kind: 'historical',
    representedDate: plan.representedDate,
    validFrom: plan.validFrom,
    validUntil: plan.validUntil,
    currentWorldEligible: false,
  },
  camera,
  lookAt,
  buildingCutout: {
    outline,
    minimumCoverage: 0.95,
    basis: 'Replace the named mapped cathedral only during the dated preview.',
  },
  mediumFiContext: {
    scale: 0.85,
    groundY: 0,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'stone_sandstone',
    'stone_sandstone_raw',
    'plaster_lime',
    'tile_ceramic',
    'metal_bronze_cast',
  ],
  qaCameras: [
    { name: 'avenida-hidalgo-carved-west-front', position: [-1, 23, 91], lookAt: [-1, 22, 23] },
    { name: 'south-clock-belfry-and-crossing-dome', position: [78, 32, 35], lookAt: [0, 21, 6] },
    { name: 'nave-aisles-and-north-portal', position: [-62, 35, -32], lookAt: [-1, 16, -2] },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: `whole-zacatecas-cathedral-${reviewLod}`,
    position: camera,
    lookAt,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: `content/worldgen/source/places/${plan.cell}/${plan.model}/models/${recipe}`,
    level: 'skyline',
    export: 'cathedralSkyline',
    errorMeters: 0.48,
    surfaces,
    authoredLevels: Object.fromEntries(
      [
        ['district', 'cathedralDistrict', 0.2],
        ['street', 'cathedralStreet', 0.08],
        ['closeup', 'cathedralCloseup', 0.03],
      ].map(([name, exportName, errorMeters]) => [
        name,
        { export: exportName, errorMeters, surfaces },
      ]),
    ),
  },
  limitations: plan.limitations,
  sourceLicense:
    'Original deterministic geometry under the repository license. Geographic outline from OpenStreetMap. The cleared Cocojorgemedina and Álvaro de la Paz Franco exterior photographs inform proportions and finishes.',
};

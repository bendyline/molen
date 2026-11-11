/** Amsterdam Centraal, from the Cuypers frontage to the glazed IJ bus canopy. */
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { prism, rect } from './khmer-structure-geometry.mjs';

export const layout = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u1/u17/amsterdam_central_station/layout.json',
      import.meta.url,
    ),
  ),
);
const limestone = { slot: 'trim', graph: 'stone_limestone', roughness: 0.93 };
const steel = { slot: 'trim', graph: 'metal_painted', roughness: 0.73, metallic: 0.2 };
const opaqueGlass = {
  slot: 'wall',
  graph: 'glass_frit_triangular',
  roughness: 0.36,
  metallic: 0.12,
};
const clear = {
  slot: 'window',
  localRef: 'palette:#eff7ff',
  roughness: 0.29,
  metallic: 0.08,
  alphaMode: 'BLEND',
  baseColorFactor: [1, 1, 1, 0.68],
  doubleSided: true,
};
const concrete = { slot: 'foundation', graph: 'stone_granite', roughness: 0.94 };
export const surfaces = {
  brick: { slot: 'wall', graph: 'brick_flemish', roughness: 0.94 },
  stone: limestone,
  gold: limestone,
  slate: { slot: 'roof', graph: 'slate', roughness: 0.9 },
  roof: { slot: 'roof', graph: 'metal_standing_seam', roughness: 0.85 },
  steel,
  frame: steel,
  dial: steel,
  black: steel,
  glazing: opaqueGlass,
  skylight: opaqueGlass,
  clear,
  letter: clear,
  platform: concrete,
  asphalt: concrete,
  yellow: concrete,
};
const palette = {
  brick: [0.395, 0.107, 0.071],
  stone: [0.68, 0.582, 0.418],
  gold: [0.86, 0.55, 0.12],
  slate: [0.104, 0.122, 0.139],
  roof: [0.074, 0.083, 0.103],
  steel: [0.083, 0.107, 0.128],
  frame: [0.47, 0.51, 0.52],
  dial: [0.074, 0.184, 0.134],
  black: [0.036, 0.045, 0.061],
  glazing: [0.098, 0.171, 0.231],
  skylight: [0.3, 0.478, 0.542],
  clear: [0.4, 0.61, 0.735],
  letter: [0.7, 0.058, 0.03],
  platform: [0.45, 0.438, 0.392],
  asphalt: [0.16, 0.176, 0.181],
  yellow: [0.82, 0.61, 0.16],
};
const up = [0, 1, 0],
  down = [0, -1, 0],
  south = [0, 0, 1],
  ref = 'palette:#ffffff';
const mix = (a, b, t) => a + (b - a) * t,
  range = (n) => Array.from({ length: n }, (_, i) => i);
const tint = (a, b = 0) =>
  0.93 + (((Math.imul(a + 61, 31307) ^ Math.imul(b + 29, 9791)) >>> 5) % 127) / 1190;
function faceWriter(out) {
  return (role, vertices, direction, tone = 1) => {
    for (let i = 1; i < vertices.length - 1; i++) {
      const points = [vertices[0], vertices[i], vertices[i + 1]].map((p) => p.map(Math.fround));
      let n = normalFor(...points);
      if (Math.hypot(...n) < 0.5) continue;
      if (n.reduce((s, x, j) => s + x * direction[j], 0) < 0) {
        points.reverse();
        n = n.map((x) => -x);
      }
      out.addTriangle(
        role,
        ref,
        points,
        n,
        undefined,
        palette[role].map((v) => Math.min(1, v * tone)),
      );
    }
  };
}
function cap(f, role, rings, point, dir = up, tone = 1) {
  const starts = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    starts.push(k);
    k += h.length;
  }
  const v = rings.flat(),
    p = v.map(point),
    ix = earcut(v.flat(), starts);
  for (let i = 0; i < ix.length; i += 3) f(role, [p[ix[i]], p[ix[i + 1]], p[ix[i + 2]]], dir, tone);
}
const block = (f, r, x, z, w, d, lo, hi) => prism(f, r, rect(x, z, w, d), lo, hi, false);
const panel = (f, r, z, x0, x1, y0, y1, tone = 1) => {
  if (x1 - x0 > 0.0005 && y1 - y0 > 0.0005)
    f(
      r,
      [
        [x0, y0, z],
        [x1, y0, z],
        [x1, y1, z],
        [x0, y1, z],
      ],
      south,
      tone,
    );
};
function strip(f, role, a, b, lo, hi, tone = 1) {
  const [x, z] = a,
    [u, v] = b;
  f(
    role,
    [
      [x, lo, z],
      [u, lo, v],
      [u, hi, v],
      [x, hi, z],
    ],
    [v - z, 0, x - u],
    tone,
  );
}
function loft(f, role, rings, tops = true) {
  for (let j = 1; j < rings.length; j++) {
    const a = rings[j - 1],
      b = rings[j];
    for (let i = 0; i < a.length; i++) {
      const k = (i + 1) % a.length,
        n = [a[k][2] - a[i][2], 0, a[i][0] - a[k][0]];
      f(role, [a[i], a[k], b[k], b[i]], n, tint(i, j));
    }
  }
  if (tops) f(role, rings.at(-1), up);
}
const rectY = (x, z, w, d, y) => rect(x, z, w, d).outline.map(([a, b]) => [a, y, b]);
function hipped(f, x, z, w, d, lo, hi, tier, flat = 0.52) {
  const long = w >= d;
  const base = rectY(x, z, w + 0.42, d + 0.45, lo),
    upper = rectY(x, z, w * (long ? flat : 0.19), d * (long ? 0.18 : flat), hi);
  loft(f, 'slate', [base, upper]);
  if (tier >= 2) {
    const [a, b] = long ? [upper[0], upper[1]] : [upper[0], upper[3]];
    strip(f, 'frame', [a[0], a[2]], [b[0], b[2]], hi, hi + 0.28);
  }
}
function column(f, role, x, z, sections, n, tone = 1) {
  const rings = sections.map(([y, r]) =>
    range(n).map((i) => {
      const a = (2 * Math.PI * i) / n;
      return [x + r * Math.cos(a), y, z + r * Math.sin(a)];
    }),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const a = rings[j - 1],
        b = rings[j],
        k = (i + 1) % n,
        t = (2 * Math.PI * (i + 0.5)) / n;
      f(role, [a[i], a[k], b[k], b[i]], [Math.cos(t), 0, Math.sin(t)], tone);
    }
  f(role, rings.at(-1), up, tone);
}
function faceDisc(f, role, x, y, z, r, n, tone = 1) {
  const p = range(n).map((i) => {
    const a = (2 * Math.PI * i) / n;
    return [x + r * Math.cos(a), y + r * Math.sin(a), z];
  });
  f(role, p, south, tone);
}
function moulding(f, x, y, z, w, h, tier) {
  if (tier <= 1) {
    panel(f, 'stone', z + 0.035, x - w * 0.55, x + w * 0.55, y - 0.12, y + h + 0.11);
    return;
  }
  panel(f, 'stone', z + 0.13, x - w * 0.56, x + w * 0.56, y - 0.14, y + 0.035);
  panel(f, 'stone', z + 0.13, x - w * 0.56, x - w * 0.48, y, y + h);
  panel(f, 'stone', z + 0.13, x + w * 0.48, x + w * 0.56, y, y + h);
  panel(f, 'stone', z + 0.13, x - w * 0.56, x + w * 0.56, y + h - 0.055, y + h + 0.12);
}
function window(f, x, y, z, w, h, tier, arched = false, mullions = 2) {
  const a = x - w * 0.5,
    b = x + w * 0.5,
    top = y + h;
  if (!arched) {
    moulding(f, x, y, z, w, h, tier);
    panel(f, 'glazing', z + 0.19, a, b, y + 0.03, top - 0.03);
  } else {
    const rise = Math.min(w * 0.46, h * 0.39),
      spring = top - rise,
      n = tier >= 3 ? 10 : tier === 2 ? 6 : 4;
    const R = (i, r) => [
      x + Math.cos((Math.PI * i) / n) * (w * 0.5 + r),
      spring + Math.sin((Math.PI * i) / n) * (rise + r),
    ];
    for (let i = 0; i < n; i++) {
      const p = [R(i, 0), R(i + 1, 0), R(i + 1, 0.16), R(i, 0.16)];
      f(
        'stone',
        p.map(([u, v]) => [u, v, z + 0.16]),
        south,
      );
      const [u, Y] = R(i, 0),
        [v, Z] = R(i + 1, 0);
      f(
        'glazing',
        [
          [x, spring, z + 0.19],
          [u, Y, z + 0.19],
          [v, Z, z + 0.19],
        ],
        south,
      );
    }
    panel(f, 'glazing', z + 0.19, a, b, y + 0.03, spring + 0.01);
    panel(f, 'stone', z + 0.15, a - 0.14, a, y, spring);
    panel(f, 'stone', z + 0.15, b, b + 0.14, y, spring);
    panel(f, 'stone', z + 0.15, a - 0.14, b + 0.14, y - 0.14, y);
  }
  if (tier >= 2) {
    for (let i = 1; i <= mullions; i++) {
      const u = mix(a, b, i / (mullions + 1));
      panel(f, 'frame', z + 0.25, u - 0.039, u + 0.039, y, top - (arched ? w * 0.32 : 0));
    }
    panel(f, 'frame', z + 0.24, a, b, y + h * 0.53, y + h * 0.53 + 0.065);
  }
}
function gable(f, x, z, w, y, h, tier) {
  const p =
    tier === 0
      ? [
          [-0.5, 0],
          [0, 1],
          [0.5, 0],
        ]
      : tier === 1
        ? [
            [-0.5, 0],
            [-0.26, 0.58],
            [-0.11, 1],
            [0.11, 1],
            [0.26, 0.58],
            [0.5, 0],
          ]
        : [
            [-0.5, 0],
            [-0.43, 0.31],
            [-0.3, 0.53],
            [-0.23, 0.71],
            [-0.11, 0.86],
            [-0.1, 1],
            [0.1, 1],
            [0.11, 0.86],
            [0.23, 0.71],
            [0.3, 0.53],
            [0.43, 0.31],
            [0.5, 0],
          ];
  const outline = p.map(([u, v]) => [x + u * w, y + v * h]);
  cap(f, 'brick', [outline], ([u, v]) => [u, v, z], south);
  for (let i = 0; tier >= 2 && i < p.length - 1; i++) {
    const [a, b] = outline[i],
      [c, d] = outline[i + 1];
    f(
      'stone',
      [
        [a, b - 0.05, z + 0.037],
        [c, d - 0.05, z + 0.037],
        [c, d + 0.14, z + 0.037],
        [a, b + 0.14, z + 0.037],
      ],
      south,
    );
  }
  if (tier >= 1) {
    window(f, x, y + 0.22, z, w * 0.31, h * 0.45, tier, true, 1);
    if (tier >= 2)
      for (const sign of [-1, 1])
        faceDisc(f, 'stone', x + sign * w * 0.25, y + h * 0.28, z + 0.12, 0.32, 8);
  }
}
function dormer(f, x, z, y, tier, dir = 1) {
  const w = tier >= 3 ? 1.35 : 1.49,
    d = 1.68;
  block(f, 'brick', x, z, w, d, y - 0.26, y + 1.29);
  hipped(f, x, z, w + 0.22, d + 0.14, y + 1.22, y + 1.83, 0, 0.35);
  if (dir > 0) window(f, x, y + 0.03, z + d * 0.5, w * 0.6, 1.0, tier, false, 1);
}
function wing(f, B, tier) {
  const { x0, x1, z0, z1, wall, ridge, gables, bays } = B,
    base = layout.historic.base,
    x = (x0 + x1) * 0.5,
    z = (z0 + z1) * 0.5,
    w = x1 - x0,
    d = z1 - z0;
  block(f, 'brick', x, z, w, d, base, wall);
  hipped(f, x, z, w, d, wall + 0.15, ridge, tier, 0.84);
  if (tier === 0) {
    for (const u of gables) gable(f, u, z1 + 0.24, 6.9, wall - 1.1, 5.51, 0);
    return;
  }
  block(f, 'stone', x, z, w + 0.34, d + 0.42, base, 1.77);
  panel(f, 'stone', z1 + 0.16, x0, x1, wall - 0.46, wall + 0.12);
  const n = tier === 1 ? Math.ceil(bays * 0.56) : bays;
  for (let i = 0; i < n; i++) {
    const u = x0 + (w * (i + 0.5)) / n;
    window(f, u, 2.32, z1, Math.min(3.2, (w / n) * 0.64), 3.7, tier, false, 2);
    window(f, u, 7.47, z1, Math.min(3.2, (w / n) * 0.64), 4.65, tier, false, 2);
    if (tier >= 3) window(f, u, 1.79, z0 - 0.07, 1.43, 3.15, 1);
    if (tier >= 2) {
      panel(
        f,
        'stone',
        z1 + 0.06,
        u - (w / n) * 0.48,
        u - (w / n) * 0.41,
        1.76,
        wall - 0.45,
        tint(i),
      );
      if (i % 2 === 0 && Math.min(...gables.map((g) => Math.abs(u - g))) > 3.3)
        dormer(f, u, z1 - 2.35, wall + 1.25, tier);
    }
  }
  panel(f, 'stone', z1 + 0.145, x0, x1, 6.52, 6.76);
  panel(f, 'stone', z1 + 0.146, x0, x1, 12.93, 13.23);
  for (const u of gables) {
    gable(f, u, z1 + 0.28, 7.1, wall - 1.05, 6.14, tier);
    if (tier >= 2)
      column(
        f,
        'stone',
        u,
        z1 + 0.04,
        [
          [wall + 4.99, 0.27],
          [wall + 5.54, 0.2],
          [wall + 6.03, 0.052],
        ],
        6,
      );
  }
}
function pavilion(f, B, tier) {
  const { x, z, w, d, wall, ridge } = B,
    base = layout.historic.base,
    front = z + d * 0.5;
  block(f, 'brick', x, z, w, d, base, wall);
  hipped(f, x, z, w, d, wall + 0.14, ridge, tier, 0.63);
  if (tier >= 1) {
    block(f, 'stone', x, z, w + 0.16, d + 0.2, base, 1.72);
    panel(f, 'stone', front + 0.07, x - w * 0.5, x + w * 0.5, wall - 0.36, wall + 0.13);
    for (const k of [-1, 0, 1]) {
      const a = x + k * w * 0.3;
      window(f, a, 2.29, front, Math.min(2.35, w * 0.2), 3.81, tier);
      window(f, a, 7.2, front, Math.min(2.55, w * 0.21), 4.29, tier, true);
      if (tier >= 2)
        window(
          f,
          a,
          12.35,
          front,
          Math.min(1.54, w * 0.17),
          Math.min(2.9, wall - 12.7),
          tier,
          true,
          1,
        );
    }
    gable(f, x, front + 0.13, w * 0.67, wall - 0.98, 4.07, tier);
  }
}
function crest(f, x, y, z, tier) {
  const shield = [
    [-1.1, 0],
    [-1.1, 1.5],
    [1.1, 1.5],
    [1.1, 0],
    [0.76, -0.57],
    [0, -0.86],
    [-0.76, -0.57],
  ];
  cap(f, 'stone', [shield.map(([a, b]) => [x + a, y + b])], ([a, b]) => [a, b, z], south);
  const core = shield.map(([a, b]) => [x + a * 0.75, y + b * 0.76]);
  cap(f, 'brick', [core], ([a, b]) => [a, b, z + 0.028], south, 1.14);
  for (const b of [-0.32, 0.2, 0.72]) {
    f(
      'gold',
      [
        [x - 0.17, y + b - 0.14, z + 0.049],
        [x + 0.17, y + b + 0.17, z + 0.049],
        [x + 0.07, y + b + 0.24, z + 0.049],
        [x - 0.26, y + b - 0.07, z + 0.049],
      ],
      south,
    );
    f(
      'gold',
      [
        [x + 0.17, y + b - 0.14, z + 0.058],
        [x - 0.17, y + b + 0.17, z + 0.058],
        [x - 0.08, y + b + 0.24, z + 0.058],
        [x + 0.26, y + b - 0.07, z + 0.058],
      ],
      south,
    );
  }
  if (tier >= 2)
    for (const a of [-0.76, -0.37, 0, 0.37, 0.76])
      faceDisc(f, 'gold', x + a, y + 1.79, z + 0.12, 0.18, 8);
}
function dialTower(f, out, T, tier) {
  const { x, z, w, d, wall, faceY, ridge, top, wind } = T,
    base = layout.historic.base,
    front = z + d * 0.5;
  block(f, 'brick', x, z, w, d, base, wall);
  const shape =
    tier === 0
      ? [
          [wall, 1.09],
          [wall + 5.13, 0.52],
          [ridge, 0.285],
        ]
      : [
          [wall, 1.05],
          [wall + 0.43, 1.1],
          [wall + 0.61, 1.02],
          [wall + 5.13, 0.52],
          [ridge, 0.285],
        ];
  loft(
    f,
    'slate',
    shape.map(([y, s]) => rectY(x, z, w * s, d * s, y)),
  );
  if (tier <= 1)
    column(
      f,
      'stone',
      x,
      z,
      [
        [ridge - 0.02, 0.86],
        [top - 0.85, 0.42],
        [top, 0.065],
      ],
      tier === 0 ? 4 : 8,
    );
  else {
    const N = tier >= 3 ? 12 : 8;
    column(
      f,
      'stone',
      x,
      z,
      [
        [ridge - 0.025, 0.9],
        [ridge + 0.28, 0.9],
        [ridge + 0.41, 0.56],
      ],
      N,
    );
    column(
      f,
      'brick',
      x,
      z,
      [
        [ridge + 0.4, 0.51],
        [ridge + 1.67, 0.44],
        [ridge + 1.81, 0.66],
      ],
      N,
    );
    for (let j = 0; j < 8; j++) {
      const a = (2 * Math.PI * j) / 8,
        u = x + 0.53 * Math.cos(a),
        v = z + 0.53 * Math.sin(a);
      block(f, 'steel', u, v, 0.115, 0.115, ridge + 1.8, top - 0.94);
    }
    column(
      f,
      'steel',
      x,
      z,
      [
        [top - 1.0, 0.72],
        [top - 0.76, 0.62],
        [top - 0.53, 0.4],
        [top - 0.18, 0.27],
        [top, 0.063],
      ],
      N,
    );
    for (const [u, v] of rect(x, z, w * 0.265, d * 0.265).outline) {
      column(
        f,
        'stone',
        u,
        v,
        [
          [ridge - 0.03, 0.087],
          [ridge + 0.62, 0.052],
          [ridge + 0.82, 0.02],
        ],
        6,
      );
    }
  }
  if (tier === 0) return;
  block(f, 'stone', x, z, w + 0.31, d + 0.25, base, 1.72);
  const n = tier >= 3 ? 32 : tier === 2 ? 22 : 12,
    r = w * 0.295;
  panel(f, 'stone', front + 0.11, x - r - 1.0, x + r + 1.0, faceY - r - 0.71, faceY + r + 0.7);
  faceDisc(f, 'gold', x, faceY, front + 0.21, r + 0.2, n);
  faceDisc(f, 'dial', x, faceY, front + 0.25, r, n, wind ? 0.89 : 1.07);
  const hand = (a, len, width) => {
    const point = [x + Math.cos(a) * len, faceY + Math.sin(a) * len, front + 0.42];
    if (tier >= 2) beam(out, 'gold', [x, faceY, front + 0.42], point, width, 0.058, palette.gold);
    else
      f('gold', [[x - width, faceY, front + 0.42], point, [x + width, faceY, front + 0.42]], south);
  };
  hand(wind ? 2.37 : 3.99, r * 0.72, 0.16);
  if (!wind) hand(0.38, r * 0.58, 0.19);
  if (tier >= 2) {
    for (let i = 0; i < (wind ? 8 : 12); i++) {
      const a = (2 * Math.PI * i) / (wind ? 8 : 12),
        p = [x + Math.cos(a) * r * 0.79, faceY + Math.sin(a) * r * 0.79];
      faceDisc(f, 'gold', p[0], p[1], front + 0.3, wind ? 0.12 : 0.1, 6);
    }
    faceDisc(f, 'gold', x, faceY, front + 0.47, 0.19, 10);
    for (const side of [-1, 1])
      for (let j = 0; j < 18; j++) {
        const u = x + side * (w * 0.5 - 0.19),
          y = 1.9 + j * 1.05;
        panel(f, 'stone', front + 0.085, u - 0.21, u + 0.21, y, y + 0.43, tint(j));
      }
    dormer(f, x, z + d * 0.3, wall + 2.37, tier);
  }
  window(f, x, 7.55, front, w * 0.57, 5.11, tier, true, 2);
  if (tier >= 2)
    for (const a of [-0.31, 0, 0.31]) {
      faceDisc(f, 'stone', x + w * a, 6.23, front + 0.12, 0.72, 12);
      faceDisc(f, 'gold', x + w * a, 6.23, front + 0.14, 0.44, 8, 0.6);
      panel(f, 'stone', front + 0.08, x + w * a - 0.69, x + w * a + 0.69, 3.13, 5.48);
    }
  if (tier >= 2)
    for (let i = 0; i < 5; i++)
      window(f, x + (i - 2) * w * 0.15, wall - 2.18, front, w * 0.105, 1.49, 1, true, 0);
}
function cuypers(f, out, tier) {
  const H = layout.historic,
    { hall, dials } = H;
  for (const B of H.wings) wing(f, B, tier);
  for (const B of [...H.pavilions, ...H.annexes]) pavilion(f, B, tier);
  const { x0, x1, z0, z1, wall, ridge } = hall,
    x = (x0 + x1) * 0.5,
    z = (z0 + z1) * 0.5,
    w = x1 - x0,
    d = z1 - z0;
  block(f, 'brick', x, z, w, d, 3.9, wall);
  hipped(f, x, z, w, d, wall + 0.28, ridge, tier, 0.65);
  block(f, 'stone', x, z1 - 1.38, w + 0.16, 3.1, 3.23, 4.17);
  block(f, 'stone', x, z0 + 0.7, w, 0.98, H.base, 3.9);
  for (const u of tier === 0 ? [-19.7, 19.7] : [-19.7, -12.8, -6.8, 0, 6.8, 12.8, 19.7])
    block(f, 'stone', u, z1 - 1.16, u === 0 ? 0.46 : 0.76, 2.86, H.base, 3.33);
  gable(f, 0, z1 + 0.35, 18.2, wall - 0.23, 8.5, tier);
  for (const T of dials) dialTower(f, out, T, tier);
  if (tier === 0) return;
  for (const u of [-12.5, -6.25, 0, 6.25, 12.5]) window(f, u, 4.63, z1, 3.42, 4.95, tier, false, 2);
  for (const u of [-9.52, 0, 9.52]) window(f, u, 10.63, z1, 5.24, 8.11, tier, true, 2);
  panel(f, 'stone', z1 + 0.16, -15.4, 15.4, 10.02, 10.37);
  panel(f, 'stone', z1 + 0.14, -15.4, 15.4, 19.04, 19.34);
  panel(f, 'stone', z1 + 0.16, -15.4, 15.4, 20.46, 20.89);
  if (tier >= 2) {
    crest(f, 0, 23.74, z1 + 0.61, tier);
    for (const u of [-9.52, 0, 9.52]) {
      const crown = [
        [-2.31, 0],
        [-1.92, 0.81],
        [-0.98, 1.29],
        [0, 1.42],
        [0.98, 1.29],
        [1.92, 0.81],
        [2.31, 0],
      ];
      cap(
        f,
        'stone',
        [crown.map(([a, b]) => [a + u, b + 17.06])],
        ([a, b]) => [a, b, z1 + 0.218],
        south,
      );
      if (tier >= 3)
        for (const k of [-1, 0, 1]) {
          faceDisc(f, k === 0 ? 'gold' : 'stone', u + k * 0.91, 17.69, z1 + 0.28, 0.31, 8, 0.88);
          panel(
            f,
            'stone',
            z1 + 0.255,
            u + k * 0.91 - 0.21,
            u + k * 0.91 + 0.21,
            17.11,
            17.56,
            0.84,
          );
        }
    }
    for (let i = 0; i < 10; i++) {
      const u = -13.9 + i * 3.08;
      panel(f, 'stone', z1 + 0.175, u - 0.95, u + 0.95, 19.42, 20.35);
      panel(f, i % 2 === 0 ? 'brick' : 'dial', z1 + 0.197, u - 0.54, u + 0.54, 19.55, 20.22);
      if (tier >= 3) faceDisc(f, 'gold', u, 19.88, z1 + 0.22, 0.15, 8);
    }
    for (const u of [-14.35, -4.78, 4.78, 14.35])
      for (let j = 0; j < 9; j++) {
        const y = 10.44 + j * 0.93;
        panel(f, 'stone', z1 + 0.2, u - 0.24, u + 0.24, y, y + 0.21, tint(j));
      }
    for (const u of [-11.2, 11.2])
      column(
        f,
        'stone',
        u,
        z1 - 0.25,
        [
          [20.6, 0.28],
          [23.54, 0.23],
          [24.37, 0.09],
        ],
        8,
      );
    column(
      f,
      'stone',
      0,
      z1 - 0.12,
      [
        [29.0, 0.56],
        [29.66, 0.47],
        [31.4, 0.18],
        [32.42, 0.046],
      ],
      8,
    );
  }
}
function entryCanopies(f, tier) {
  if (tier === 0) return;
  for (const [i, ring] of layout.entryCanopies.entries()) {
    const edge = i === 3 ? 3.49 : 3.65;
    const peak = ring.reduce((p, q) => (p[1] < q[1] ? p : q))[1];
    const y = ([, z]) => edge + Math.max(0, 0.69 - (z - peak) * 0.12);
    cap(f, 'skylight', [ring], (p) => [p[0], y(p), p[1]]);
    cap(f, 'steel', [ring], (p) => [p[0], y(p) - 0.14, p[1]], down);
    for (let j = 0; j < ring.length; j++) {
      const a = ring[j],
        b = ring[(j + 1) % ring.length],
        dy = y(a),
        ey = y(b);
      f(
        'frame',
        [
          [a[0], dy - 0.16, a[1]],
          [b[0], ey - 0.16, b[1]],
          [b[0], ey, b[1]],
          [a[0], dy, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
}
function shape(R, v) {
  return R.spring + R.rise * Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2));
}
function roofPoint(R, x, v, lift = 0) {
  const u = (x - R.start[0]) / (R.end[0] - R.start[0]);
  return [
    x,
    shape(R, v) + lift,
    mix(mix(R.start[1], R.end[1], u), mix(R.start[2], R.end[2], u), v),
  ];
}
function rib(f, R, x, steps, width, tier) {
  for (let i = 0; i < steps; i++) {
    const a = i / steps,
      b = (i + 1) / steps,
      p = roofPoint(R, x - width * 0.5, a, -0.14),
      q = roofPoint(R, x + width * 0.5, a, -0.14),
      r = roofPoint(R, x + width * 0.5, b, -0.14),
      s = roofPoint(R, x - width * 0.5, b, -0.14);
    f('frame', [p, q, r, s], down);
    if (tier >= 3) {
      const h = R.bus ? 0.31 : 0.48;
      f('steel', [p, s, [s[0], s[1] - h, s[2]], [p[0], p[1] - h, p[2]]], [-1, 0, 0]);
    }
  }
}
function railScreen(f, out, R, x, tier, steps) {
  const y = 4.38,
    shift = x === R.start[0] ? -0.067 : 0.067,
    n = [Math.sign(shift), 0, 0];
  for (let i = 0; i < steps; i++) {
    const a = roofPoint(R, x, i / steps),
      b = roofPoint(R, x, (i + 1) / steps),
      A = [x + shift, a[1] - 0.16, a[2]],
      B = [x + shift, b[1] - 0.16, b[2]];
    f(
      tier === 0 ? 'skylight' : 'clear',
      [[x + shift, y, a[2]], [x + shift, y, b[2]], B, A],
      n,
      0.92,
    );
  }
  if (tier === 0) return;
  const count = tier >= 3 ? 32 : tier === 2 ? 17 : 7,
    a = roofPoint(R, x, 0),
    b = roofPoint(R, x, 1);
  for (let j = 1; j < count; j++) {
    const v = j / count,
      p = roofPoint(R, x, v),
      z = p[2],
      w = tier >= 2 ? 0.075 : 0.14;
    f(
      'frame',
      [
        [x + shift * 2, y, z - w],
        [x + shift * 2, y, z + w],
        [x + shift * 2, p[1] - 0.2, z + w],
        [x + shift * 2, p[1] - 0.2, z - w],
      ],
      n,
    );
  }
  for (let i = 0; i < (tier >= 2 ? 3 : 1); i++) {
    const Y = y + 0.15 + i * 2.7,
      u = 0.5 * (1 - Math.sqrt(Math.max(0, 1 - ((Y - R.spring) / R.rise) ** 2)));
    const z0 = mix(a[2], b[2], u),
      z1 = mix(a[2], b[2], 1 - u);
    f(
      'frame',
      [
        [x + shift * 2, Y, z0],
        [x + shift * 2, Y, z1],
        [x + shift * 2, Y + 0.11, z1],
        [x + shift * 2, Y + 0.11, z0],
      ],
      n,
    );
  }
  if (tier >= 2)
    beam(out, 'steel', [x, y - 0.18, a[2]], [x, y - 0.18, b[2]], 0.31, 0.23, palette.steel);
}
function shed(f, out, R, tier) {
  const steps = [6, 10, 16, 24, 32][tier],
    x0 = R.start[0],
    x1 = R.end[0];
  if (R.bus) {
    for (const [i, band] of layout.busBands[steps].entries()) {
      const a = i / steps,
        b = (i + 1) / steps;
      const p = ([x, v]) => {
        const P = roofPoint(R, x, v);
        P[1] = mix(shape(R, a), shape(R, b), (v - a) / (b - a));
        return P;
      };
      for (const shape of band.glass) cap(f, 'clear', shape, p, up, tint(i));
      for (const shape of band.letters) cap(f, 'letter', shape, p, up, 1.0);
    }
  } else {
    const widths = [
      ...new Set([...range(steps + 1).map((i) => i / steps), ...R.skylights.flat()]),
    ].sort((a, b) => a - b);
    for (let i = 1; i < widths.length; i++) {
      const a = widths[i - 1],
        b = widths[i],
        mid = (a + b) * 0.5,
        g = R.skylights.some(([lo, hi]) => mid > lo && mid < hi);
      const p = [
        roofPoint(R, x0, a),
        roofPoint(R, x1, a),
        roofPoint(R, x1, b),
        roofPoint(R, x0, b),
      ];
      f(g ? (tier >= 2 ? 'clear' : 'skylight') : 'roof', p, up, tint(i));
      // Opaque roofs need their own inner faces for the platform and screen views.
      if (tier >= 1 && (!g || tier === 1))
        f(
          g ? 'skylight' : 'roof',
          p.map(([x, y, z]) => [x, y - 0.065, z]),
          down,
          0.91,
        );
    }
  }
  if (R.screen) for (const x of [x0, x1]) railScreen(f, out, R, x, tier, steps);
  if (tier === 0) return;
  const ribs = tier === 1 ? Math.ceil(R.ribs / 6) : tier === 2 ? Math.ceil(R.ribs / 2) : R.ribs;
  for (let i = 0; i < ribs; i++) {
    const x = mix(x0 + 0.1, x1 - 0.1, i / (ribs - 1));
    rib(f, R, x, steps, tier >= 2 ? 0.17 : 0.28, tier);
    if (tier >= 2 && i % (R.bus ? 1 : 2) === 0)
      for (const v of [0, 1]) {
        const p = roofPoint(R, x, v),
          w = R.bus ? 0.39 : 0.34;
        const base = R.bus ? (v === 0 ? -5.18 : 2.73) : -3.38;
        if (tier >= 3 && R.bus)
          beam(
            out,
            'steel',
            [x, base, p[2] + (v === 0 ? 1.12 : -0.77)],
            [x, p[1] - 0.16, p[2]],
            w,
            w * 0.83,
            palette.steel,
          );
        else block(f, 'steel', x, p[2], w, w, base, p[1] - 0.22);
      }
  }
  if (tier >= 2)
    for (const v of range(tier >= 3 ? 17 : 8).map((i) => (i + 1) / (tier >= 3 ? 18 : 9))) {
      const a = roofPoint(R, x0, v, -0.145),
        b = roofPoint(R, x1, v, -0.145);
      f('frame', [a, b, [b[0], b[1] - 0.12, b[2]], [a[0], a[1] - 0.12, a[2]]], [0, 0, 1]);
    }
}
function busDeck(f, tier) {
  const R = layout.roofs[3],
    x0 = R.start[0],
    x1 = R.end[0],
    u = [x0, -85, 26, x1];
  const z = (x, v) => roofPoint(R, x, v)[2];
  for (const [a, b] of [
    [0.08, 0.31],
    [0.35, 0.92],
  ]) {
    const y = 3.13;
    const p = [
      [x0, y, z(x0, a)],
      [x1, y, z(x1, a)],
      [x1, y, z(x1, b)],
      [x0, y, z(x0, b)],
    ];
    f(a < 0.3 ? 'asphalt' : 'platform', p, up);
    for (const v of [a, b]) strip(f, 'platform', [x0, z(x0, v)], [x1, z(x1, v)], 2.65, y);
  }
  if (tier >= 1) {
    block(f, 'frame', -151.62, -72.67, 13.82, 4.2, 3.15, 5.97);
    panel(f, 'glazing', -70.54, -157.54, -145.81, 4.06, 5.51);
    for (const [a, b] of [
      [0.082, 0.085],
      [0.317, 0.319],
      [0.904, 0.907],
    ])
      f(
        'yellow',
        [
          [x0, 3.146, z(x0, a)],
          [x1, 3.146, z(x1, a)],
          [x1, 3.146, z(x1, b)],
          [x0, 3.146, z(x0, b)],
        ],
        up,
      );
    for (let i = 1; i < u.length; i++) {
      const a = u[i - 1] + 0.16,
        b = u[i] - 0.16;
      strip(f, 'clear', [a, z(a, 0.083)], [b, z(b, 0.083)], 3.22, 4.35);
      strip(f, 'steel', [a, z(a, 0.082)], [b, z(b, 0.082)], 4.35, 4.45);
    }
  }
  if (tier >= 2) {
    for (let i = 0; i < 24; i++) {
      const x = mix(x0 + 4, x1 - 4, i / 23),
        p = z(x, 0.083);
      block(f, 'steel', x, p, 0.18, 0.22, 3.16, 4.45);
      if (i % 3 === 0) block(f, 'platform', x, z(x, 0.25), 0.6, 0.79, -4.85, 2.64);
    }
  }
}
function platforms(f, tier) {
  for (const P of layout.platforms) {
    const { x0, x1, z, width } = P;
    const profile = tier <= 1 ? [P.grade[0], P.grade[3], P.grade.at(-1)] : P.grade;
    for (let j = 1; j < profile.length; j++) {
      const [a, g] = profile[j - 1],
        [b, G] = profile[j],
        u = Math.max(x0, a),
        v = Math.min(x1, b),
        d = width * 0.5;
      if (v <= u) continue;
      const A = mix(g, G, (u - a) / (b - a)) + 0.68,
        B = mix(g, G, (v - a) / (b - a)) + 0.68;
      const point = (x, y, q) => [x, y, z + q];
      f('platform', [point(u, A, -d), point(v, B, -d), point(v, B, d), point(u, A, d)], up);
      if (tier >= 1)
        for (const side of [-1, 1]) {
          const edge = d * side;
          f(
            'platform',
            [
              point(u, A - 0.74, edge),
              point(v, B - 0.74, edge),
              point(v, B, edge),
              point(u, A, edge),
            ],
            [0, 0, side],
          );
          if (tier >= 2)
            f(
              'yellow',
              [
                point(u, A + 0.012, edge),
                point(v, B + 0.012, edge),
                point(v, B + 0.012, edge - side * 0.125),
                point(u, A + 0.012, edge - side * 0.125),
              ],
              up,
              0.86,
            );
        }
    }
  }
  if (tier >= 2) block(f, 'glazing', 0.8, -25.4, 14.9, 3.92, -1.7, 2.91);
}

const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
export function buildAmsterdamCentraalLevel(out, level) {
  const tier = tiers[level],
    f = faceWriter(out);
  cuypers(f, out, tier);
  entryCanopies(f, tier);
  for (const R of layout.roofs) shed(f, out, R, tier);
  busDeck(f, tier);
  platforms(f, tier);
}
export const buildAmsterdamCentraalSkyline = (out) => buildAmsterdamCentraalLevel(out, 'skyline');
export const buildAmsterdamCentraalDistrict = (out) => buildAmsterdamCentraalLevel(out, 'district');
export const buildAmsterdamCentraalStreet = (out) => buildAmsterdamCentraalLevel(out, 'street');
export const buildAmsterdamCentraalCloseup = (out) => buildAmsterdamCentraalLevel(out, 'closeup');

import { MeshBufferBuilder } from '../../../../../../../../packages/worldgen/dist/kernel.mjs';
import {
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  masonry: { slot: 'wall', graph: 'brick_stack', roughness: 0.95 },
  plinth: { slot: 'foundation', graph: 'stone_sandstone', roughness: 0.96 },
  carved: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.93 },
  metal: { slot: 'trim', graph: 'metal_copper', roughness: 0.62 },
};
const stone = rgb('a19987');
const trim = rgb('b4a791');
const dark = rgb('5d5850');
const nicheShade = rgb('84796a');
const pale = rgb('c7bfa9');
const gilt = rgb('c9a263');
const shades = ['9d9184', 'b2a48e', 'ac9d88', 'b5aa99'].map(rgb);
const square = [
  [-1, -1],
  [-1, 1],
  [1, 1],
  [1, -1],
];
const stepped = [
  [-1, -0.77],
  [-1, 0.77],
  [-0.77, 0.77],
  [-0.77, 1],
  [0.77, 1],
  [0.77, 0.77],
  [1, 0.77],
  [1, -0.77],
  [0.77, -0.77],
  [0.77, -1],
  [-0.77, -1],
  [-0.77, -0.77],
];
const a = (site.planAngleDegrees * Math.PI) / 180,
  sin = Math.sin(a),
  cos = Math.cos(a);
const atSite = (x, y, z) => [x * cos - z * sin, y, x * sin + z * cos];
function frame(cx, cz) {
  return (x, y, z, side = 0) => {
    const [u, v] = side === 0 ? [x, z] : side === 1 ? [-z, x] : side === 2 ? [-x, -z] : [z, -x];
    return atSite(cx + u, y, cz + v);
  };
}
function face(out, slot, points, color) {
  const n = normalFor(...points);
  if (points.length === 3) out.addTriangle(slot, '', points, n, [], color);
  else out.addQuad(slot, '', points, n, [], color);
}
function cap(out, slot, points, color) {
  const scratch = new MeshBufferBuilder();
  const outline = points.map(([x, , z]) => [x, z]),
    up = [0, 1, 0];
  if (
    !scratch.addCap(
      'foundation',
      'palette:#ffffff',
      outline,
      [],
      () => points[0][1],
      up,
      (p) => p,
      color,
    )
  )
    throw Error('Invalid Mahabodhi podium profile');
  const { positions, indices } = scratch.finalize();
  for (let i = 0; i < indices.length; i += 3) {
    const p = [0, 1, 2].map((j) =>
      Array.from(positions.slice(indices[i + j] * 3, indices[i + j] * 3 + 3)),
    );
    out.addTriangle(slot, '', p, up, [], color);
  }
}
function profile(out, slot, at, levels, color, outline = square) {
  const rings = levels.map(([y, w, d]) => outline.map(([x, z]) => at(x * w, y, z * d)));
  loft(out, slot, rings, color, { cap: outline === square });
  if (outline !== square) cap(out, slot, rings.at(-1), color);
}
function block(out, slot, at, x, y, z, w, h, d, color, side = 0) {
  profile(
    out,
    slot,
    (u, v, t) => at(x + u, y + v, z + t, side),
    [
      [0, w / 2, d / 2],
      [h, w / 2, d / 2],
    ],
    color,
  );
}
function roundCrown(out, at, levels, count, slot, color) {
  loft(
    out,
    slot,
    levels.map(([y, r]) =>
      Array.from({ length: count }, (_, i) => {
        const t = (-2 * Math.PI * i) / count;
        return at(r * Math.cos(t), y, r * Math.sin(t));
      }),
    ),
    color,
  );
}
function plinth(out, detail) {
  const p = site.plinth;
  const levels =
    detail === 0
      ? [
          [-2.4, 1],
          [1.46, 1],
        ]
      : [
          [-2.4, 1],
          [0.31, 1],
          [0.42, 0.985],
          [0.83, 0.982],
          [0.91, 1],
          [1.46, 1],
        ];
  const rings = levels.map(([y, s]) => p.map(([x, z]) => atSite(x * s, y, z * s)));
  loft(out, 'plinth', rings, stone, { cap: false });
  cap(out, 'plinth', rings.at(-1), pale);
}

function arch(out, at, x, y, z, w, h, side, detail, statue = false, shade = dark) {
  const curve =
    detail < 3
      ? [0, Math.PI / 2, Math.PI]
      : [0, Math.PI / 5, (2 * Math.PI) / 5, (3 * Math.PI) / 5, (4 * Math.PI) / 5, Math.PI];
  const p = (u, v, d) => at(x + u, y + v, z + d, side);
  const recess = [
    p(-w / 2, 0, 0.013),
    p(w / 2, 0, 0.013),
    p(w / 2, h * 0.61, 0.013),
    p(-w / 2, h * 0.61, 0.013),
  ];
  face(out, 'carved', recess, shade);
  const band = (t, k, d) => p(Math.cos(t) * w * k, h * 0.61 + Math.sin(t) * h * k * 0.68, d);
  for (let k = 0; k < curve.length - 1; k++) {
    const a = curve[k],
      b = curve[k + 1];
    const tip = band(a, 0.5, 0.014),
      next = band(b, 0.5, 0.014);
    face(out, 'carved', [p(0, h * 0.61, 0.014), tip, next], shade);
    face(out, 'carved', [tip, band(a, 0.64, 0.062), band(b, 0.64, 0.062), next], trim);
  }
  const slot = detail >= 3 ? 'carved' : 'masonry';
  for (const hand of [-1, 1]) {
    if (detail < 3) {
      const u = hand * w * 0.5,
        v = hand * w * 0.63;
      const lo = Math.min(u, v),
        hi = Math.max(u, v);
      face(
        out,
        slot,
        [p(lo, 0, 0.055), p(hi, 0, 0.055), p(hi, h * 0.61, 0.055), p(lo, h * 0.61, 0.055)],
        trim,
      );
    } else
      block(out, slot, at, x + hand * w * 0.56, y, z + 0.044, w * 0.13, h * 0.62, 0.13, trim, side);
  }
  if (statue && detail >= 3) {
    block(out, 'carved', at, x, y + 0.035, z + 0.049, w * 0.44, h * 0.14, 0.142, stone, side);
    block(
      out,
      'carved',
      at,
      x,
      y + h * 0.175,
      z + 0.066,
      w * 0.24,
      h * 0.47,
      0.19,
      shades[1],
      side,
    );
    block(
      out,
      'carved',
      at,
      x,
      y + h * 0.68,
      z + 0.081,
      w * 0.18,
      h * 0.137,
      0.17,
      shades[2],
      side,
    );
  }
}

function tower(out, form, detail, main) {
  const {
      center: [x, z],
      height,
      width,
    } = form,
    at = frame(x, z);
  const base = main ? 6.7 : 4.15,
    top = height - (main ? 4.55 : 3.29),
    h = top - base,
    r = width / 2;
  const tiers = detail === 1 ? (main ? 8 : 5) : main ? 12 : 8;
  const capR = r * 0.35;
  const longRing = detail >= 3 && main ? stepped : square;
  const row = (y, r) => [y, r, r];
  profile(
    out,
    'plinth',
    at,
    [row(1.44, r * 1.145), row(base - 0.56, r * 1.145), row(base, r * 1.05)],
    stone,
  );
  if (detail === 0) {
    profile(
      out,
      'masonry',
      at,
      [
        row(base, r),
        row(base + h * 0.29, r * 0.83),
        row(base + h * 0.66, r * 0.59),
        row(top, r * 0.35),
      ],
      stone,
    );
    roundCrown(
      out,
      at,
      [
        [top - 0.06, capR],
        [top + (height - top) * 0.55, capR * 0.6],
        [height, capR * 0.075],
      ],
      8,
      main ? 'metal' : 'carved',
      main ? gilt : trim,
    );
    return;
  }
  for (let i = 0; i < tiers; i++) {
    const lower = i / tiers,
      upper = (i + 1) / tiers;
    const y = base + h * lower,
      next = base + h * upper;
    const radius = r * (1 - 0.65 * Math.pow(lower, 1.13));
    const neck = r * (1 - 0.65 * Math.pow(upper, 1.13));
    const dh = next - y;
    profile(
      out,
      'masonry',
      at,
      [
        row(y - 0.008, radius),
        row(y + dh * 0.14, radius * 1.026),
        row(next - 0.105, neck),
        row(next, neck),
      ],
      stone,
      longRing,
    );
    const shelf = radius * (detail === 1 ? 1.05 : 1.076);
    profile(
      out,
      'carved',
      at,
      [row(y + dh * 0.073, shelf), row(y + dh * 0.155, shelf), row(y + dh * 0.213, radius * 1.011)],
      shades[(i + (main ? 0 : 1)) % shades.length],
      longRing,
    );
    if (detail === 1 && i % 2 !== 0) continue;
    for (let s = 0; s < 4; s++) {
      const count = detail === 1 ? 1 : detail === 2 ? (main ? 3 : 1) : main ? 5 : 3;
      const w = (radius * 1.54) / count;
      const reliefAt = (x, v, z, side) => {
        const t = Math.max(0, Math.min(1, (v - y - dh * 0.14) / (dh * 0.86 - 0.105)));
        const faceRadius = radius * 1.026 + (neck - radius * 1.026) * t;
        return at(x, v, z + faceRadius, side);
      };
      for (let j = 0; j < count; j++) {
        const xx = (j + (1 - count) / 2) * w;
        const middle = j === (count - 1) / 2;
        const nicheHeight = dh * (i < 2 && middle ? 0.64 : middle ? 0.5 : 0.36);
        arch(
          out,
          reliefAt,
          xx,
          y + dh * (middle ? 0.235 : 0.35),
          0,
          w * 0.74,
          nicheHeight,
          s,
          detail,
          i < 3 && j % 2 === 0,
          nicheShade,
        );
      }
      if (detail >= 3) {
        for (const xx of [-radius * 0.686, radius * 0.686])
          block(
            out,
            'carved',
            reliefAt,
            xx,
            y + dh * 0.146,
            -0.045,
            0.13 + radius * 0.047,
            dh * 0.69,
            0.19,
            trim,
            s,
          );
      }
      if (detail >= 3 && main) {
        for (const xx of [-radius * 0.479, 0, radius * 0.479])
          block(
            out,
            'carved',
            reliefAt,
            xx,
            y + dh * 0.848,
            0,
            0.24 + radius * (detail >= 4 ? 0.14 : 0.11),
            dh * 0.091,
            0.131,
            pale,
            s,
          );
      }
    }
  }
  const sides = detail < 2 ? 8 : detail < 3 ? 12 : detail === 3 ? 20 : 24;
  const delta = height - top;
  roundCrown(
    out,
    at,
    [
      [top - 0.06, capR * 0.98],
      [top + delta * 0.13, capR * 1.07],
      [top + delta * 0.27, capR * 0.91],
      [top + delta * 0.41, capR * 0.75],
      [top + delta * 0.65, capR * 0.52],
      [top + delta * 0.79, capR * 0.45],
      [top + delta * 0.84, capR * 0.29],
    ],
    sides,
    'carved',
    trim,
  );
  roundCrown(
    out,
    at,
    [
      [top + delta * 0.83, capR * 0.3],
      [top + delta * 0.96, capR * 0.19],
      [height, capR * 0.078],
    ],
    sides,
    main ? 'metal' : 'carved',
    main ? gilt : trim,
  );
}

function entry(out, detail) {
  const at = frame(14.65, 0),
    f = 1.46,
    canopy = 6.39;
  const r = 7.75,
    w = 5.16;
  block(out, 'masonry', at, -3.72, f, 0, 2.45, 4.76, 10.07, stone);
  block(out, 'carved', at, 0, canopy, 0, 16.79, 0.55, 11.25, trim);
  block(out, 'plinth', at, -0.5, canopy + 0.55, 0, 15.01, 0.54, 10.62, stone);
  block(out, 'carved', at, -1.49, canopy + 1.09, 0, 12.57, 0.26, 10.11, trim);
  for (const side of [-1, 1]) {
    block(out, 'masonry', at, -0.1, f, side * w * 0.85, r * 1.79, 4.99, 1.68, stone);
    block(out, 'carved', at, r * 0.992, f, side * 2.78, 0.9, 4.93, 1.14, trim);
    if (detail >= 1) {
      for (const x of [-5.58, -1.35, 3.17, 6.98])
        block(out, 'carved', at, x, f, side * w * 0.976, 0.53, 5.02, 0.57, pale);
      arch(out, at, side * 3.95, f + 0.35, r * 1.032, 1.26, 3.41, 3, detail, true);
      arch(out, at, side * 3.25, canopy + 0.99, 6.01, 0.89, 2.56, 3, detail, true);
    }
  }
  for (const x of [-3.1, 1.0, 4.95]) {
    for (const z of [-1.51, 1.51]) {
      block(out, 'carved', at, x, f, z, 0.45, 4.96, 0.45, trim);
      if (detail >= 2) block(out, 'carved', at, x, canopy - 0.31, z, 0.69, 0.28, 0.64, pale);
    }
  }
  block(out, 'carved', at, 6.4, canopy + 1.14, 0, 1.31, 2.64, 9.95, stone);
  if (detail >= 1) {
    arch(out, at, 0, canopy + 1.52, 7.12, 1.74, 1.79, 3, detail, true);
    for (const z of [-3.02, 3.02])
      arch(out, at, z, canopy + 1.5, 7.12, 1.16, 1.51, 3, detail, true, nicheShade);
    block(out, 'carved', at, 6.45, canopy + 3.78, 0, 1.6, 0.175, 10.27, trim);
    for (const z of [-4.96, 4.96])
      block(out, 'carved', at, 0, canopy + 1.05, z, 13.12, 0.39, 0.27, trim);
  }
  const count = detail < 2 ? 3 : 7;
  for (let i = 0; i < count; i++)
    block(
      out,
      'plinth',
      at,
      9.95 - i * 0.267,
      -0.09,
      0,
      0.271,
      (1.55 * (i + 1)) / count,
      5.3,
      pale,
    );
}

function rail(out, detail) {
  if (detail < 1) return;
  // The low stone balustrade frames the sides of the raised terrace.
  const members = [
    [-8.8, 22.1, -12.83],
    [-8.8, 22.0, 12.82],
  ];
  for (const [x1, x2, z] of members) {
    block(out, 'carved', atSite, (x1 + x2) / 2, 1.46, z, x2 - x1, 0.31, 0.59, shades[1]);
    block(out, 'carved', atSite, (x1 + x2) / 2, 2.59, z, x2 - x1, 0.34, 0.51, trim);
    const n = detail < 2 ? 7 : 14;
    for (let i = 0; i <= n; i++)
      block(
        out,
        'carved',
        atSite,
        x1 + ((x2 - x1) * i) / n,
        1.76,
        z,
        0.42,
        0.86,
        0.46,
        shades[(i + 2) % shades.length],
      );
  }
}

function build(out, detail) {
  plinth(out, detail);
  tower(out, site.mainTower, detail, true);
  for (const p of site.subsidiaryTowers) tower(out, p, detail, false);
  entry(out, detail);
  rail(out, detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);

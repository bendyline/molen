/** The formal entrance planting at Lubiechów, within its three mapped lawn edges. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import {
  loft,
  normalFor,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import earcut from '../../../../../../../../packages/worldgen/scripts/polygon-triangulation.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const key = 'ksiaz_palm_forecourt';
export const title = 'Lubiechów Palm House entrance garden';
export const frame = JSON.parse(readFileSync(new URL('../map-frame.json', import.meta.url)));
const means = JSON.parse(readFileSync(new URL('../surface-means.json', import.meta.url)));
export const surfaces = {
  foliage: { slot: 'foundation', roughness: 0.96, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_sandstone_raw', roughness: 0.93, metallic: 0 },
  soil: { slot: 'foundation', graph: 'gravel', roughness: 0.95, metallic: 0 },
  timber: { slot: 'trim', graph: 'wood_plain', roughness: 0.87, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.66, metallic: 0.2 },
};
export const palette = {
  turf: '718842',
  turfShade: '61783b',
  hedge: '485e34',
  hedgeTop: '5b7139',
  yew: '456045',
  yewLit: '577246',
  yewShade: '364f3d',
  globe: '96964a',
  bush: '4d6742',
  bushShade: '3d5238',
  heath: '905575',
  heathLight: 'aa6d88',
  soil: '77634f',
  curb: 'ac9d81',
  urn: 'dbcfaf',
  bowl: 'c8c3ad',
  bark: '5b4c37',
  wood: '866049',
  iron: '494843',
};
const c = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, rgb(v)]));
const modelRef = 'palette:#ffffff';

export function terrainY([x, z]) {
  const { origin, step, width, height, heights } = frame.terrain;
  const u = (x - origin[0]) / step,
    v = (z - origin[1]) / step,
    i = Math.floor(u),
    j = Math.floor(v);
  if (i < 0 || j < 0 || i >= width - 1 || j >= height - 1)
    throw Error(`Garden vertex outside terrain samples: ${x},${z}`);
  const a = u - i,
    b = v - j,
    H = (i, j) => heights[j * width + i];
  return (
    (1 - a) * (1 - b) * H(i, j) +
    a * (1 - b) * H(i + 1, j) +
    (1 - a) * b * H(i, j + 1) +
    a * b * H(i + 1, j + 1)
  );
}
const near = ([x, z], s) => [x, terrainY([x, z]) + s, z];
const planarAt = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const centerOf = (ring) =>
  ring.reduce(([x, z], p) => [x + p[0] / ring.length, z + p[1] / ring.length], [0, 0]);

function face(o, slot, tint, p, normal) {
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]].map((p) => p.map(Math.fround)),
      n = normalFor(...t);
    const dot = n.reduce((s, x, j) => s + x * normal[j], 0);
    if (Math.abs(dot) < 1e-6) continue;
    if (dot < 0) [t[1], t[2]] = [t[2], t[1]];
    o.addTriangle(
      slot,
      modelRef,
      t,
      normalFor(...t),
      t.map(([x, , z]) => [x, z]),
      c[tint],
    );
  }
}
function ground(o, ring, slot, tint, lift, subdivide = 0) {
  const ix = earcut(ring.flat());
  const triangle = (a, b, d, level) => {
    if (level) {
      const ab = planarAt(a, b, 0.5),
        bd = planarAt(b, d, 0.5),
        da = planarAt(d, a, 0.5);
      for (const [u, v, w] of [
        [a, ab, da],
        [ab, b, bd],
        [da, bd, d],
        [ab, bd, da],
      ])
        triangle(u, v, w, level - 1);
    } else {
      face(
        o,
        slot,
        tint,
        [a, b, d].map((p) => near(p, lift)),
        [0, 1, 0],
      );
    }
  };
  for (let i = 0; i < ix.length; i += 3)
    triangle(...ix.slice(i, i + 3).map((k) => ring[k]), subdivide);
}
function edging(o, ring, slot, tint, topTint, bottom, top, inset) {
  const center = centerOf(ring);
  const outer = ring.map((p) => near(p, top)),
    inner = ring.map((p) => near(planarAt(p, center, inset), top));
  for (const [i, p] of ring.entries()) {
    const j = (i + 1) % ring.length,
      d = planarAt(p, ring[j], 0.5).map((v, k) => v - center[k]);
    const n = [d[0], 0, d[1]];
    face(o, slot, tint, [near(p, bottom), near(ring[j], bottom), outer[j], outer[i]], n);
    face(o, slot, topTint, [outer[i], outer[j], inner[j], inner[i]], [0, 1, 0]);
    face(
      o,
      slot,
      tint,
      [
        inner[i],
        inner[j],
        near(planarAt(ring[j], center, inset), bottom),
        near(planarAt(p, center, inset), bottom),
      ],
      n.map((x) => -x),
    );
  }
}
function radial([x, z], y, r, sides, depth = r, angle = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const t = angle - (i * 2 * Math.PI) / sides;
    return [x + r * Math.cos(t), y, z + depth * Math.sin(t)];
  });
}
function turning(o, slot, tint, p, base, profile, sides, cap = true) {
  loft(
    o,
    slot,
    profile.map(([y, r]) => radial(p, base + y, r, sides)),
    c[tint],
    { cap },
  );
}
function clippedTree(o, p, r, h, detail) {
  const y = terrainY(p),
    sides = [6, 8, 10, 12][detail];
  turning(
    o,
    'timber',
    'bark',
    p,
    y - 0.05,
    [
      [0, r * 0.18],
      [h * 0.23, r * 0.135],
    ],
    6,
  );
  const profile = [
    [0.09, 0.31],
    [0.18, 0.86],
    [0.33, 1],
    [0.57, 0.77],
    [0.79, 0.53],
    [0.93, 0.28],
    [1, 0.042],
  ];
  const rings = profile.map(([v, u], k) =>
    radial(p, y + h * v, r * u, sides, r * u * 0.81, (k % 2) * 0.015),
  );
  for (let i = 1; i < rings.length; i++)
    loft(
      o,
      'foliage',
      rings.slice(i - 1, i + 1),
      c[i < 2 ? 'yewShade' : i > 4 ? 'yewLit' : 'yew'],
      { cap: false },
    );
  const tip = rings.at(-1);
  face(o, 'foliage', 'yewLit', tip, [0, 1, 0]);
}
function knob(o, slot, tint, p, base, r, height, detail) {
  const density = [6, 7, 9, 10][detail],
    slices = [4, 4, 5, 6][detail];
  sphere(
    o,
    slot,
    [p[0], base + height / 2, p[1]],
    [r, height / 2, r * 0.82],
    c[tint],
    density,
    slices,
  );
}
function shrub(o, p, r, h, d) {
  const y = terrainY(p);
  knob(o, 'foliage', 'bushShade', p, y - 0.045, r, h, d);
  if (d < 2) return;
  for (const [x, z, k] of [
    [-0.54, 0.08, 0.65],
    [0.31, -0.48, 0.78],
    [0.25, 0.44, 0.62],
  ]) {
    const q = [p[0] + x * r, p[1] + z * r];
    knob(o, 'foliage', k > 0.7 ? 'bush' : 'yewLit', q, y + h * 0.12, r * k, h * k, d === 3 ? 2 : 0);
  }
}
function bench(o, { center: p, heading }, detail) {
  const y = terrainY(p) + 0.1,
    cos = Math.cos(heading),
    sin = Math.sin(heading);
  const o2 = {
    addQuad: (slot, ref, points, normal, uv, col) =>
      o.addQuad(
        slot,
        ref,
        points.map(([x, y, z]) => [p[0] + cos * x + sin * z, y, p[1] - sin * x + cos * z]),
        [cos * normal[0] + sin * normal[2], normal[1], -sin * normal[0] + cos * normal[2]],
        uv,
        col,
      ),
  };
  const B = (slot, tint, x, y0, z, w, h, d) =>
    box(o2, slot, [x - w / 2, y + y0, z - d / 2], [x + w / 2, y + y0 + h, z + d / 2], c[tint]);
  for (const x of [-0.69, 0.69]) {
    for (const z of [-0.175, 0.17]) B('metal', 'iron', x, -0.035, z, 0.065, 0.46, 0.07);
    B('metal', 'iron', x, 0.36, 0, 0.072, 0.08, 0.54);
    B('metal', 'iron', x, 0.43, -0.22, 0.055, 0.46, 0.062);
  }
  for (const z of detail >= 2 ? [-0.16, -0.056, 0.056, 0.16] : [0])
    B('timber', 'wood', 0, 0.43, z, 1.72, 0.059, detail >= 2 ? 0.094 : 0.39);
  for (const y of detail >= 2 ? [0.62, 0.743, 0.856] : [0.65])
    B('timber', 'wood', 0, y, -0.227, 1.72, detail >= 2 ? 0.092 : 0.27, 0.067);
}
function urn(o, d) {
  const p = frame.urn,
    y = terrainY(p) + 0.09,
    sides = [8, 10, 16, 24][d];
  const profile = d
    ? [
        [0, 0.33],
        [0.1, 0.33],
        [0.14, 0.249],
        [0.31, 0.175],
        [0.44, 0.155],
        [0.53, 0.25],
        [0.61, 0.23],
        [0.68, 0.36],
        [0.79, 0.52],
        [0.95, 0.64],
        [1.03, 0.66],
        [1.07, 0.61],
        [1.035, 0.58],
        [0.98, 0.52],
      ]
    : [
        [0, 0.32],
        [0.42, 0.16],
        [0.64, 0.29],
        [0.96, 0.66],
        [1.06, 0.62],
      ];
  turning(o, 'stone', 'urn', p, y, profile, sides);
  knob(o, 'foliage', 'hedgeTop', p, y + 0.94, 0.56, 0.27, Math.min(d, 2));
  if (d >= 2)
    for (const [dx, dz, f] of [
      [0.45, -0.26, 0.08],
      [-0.49, 0.2, 0.07],
      [0.08, 0.53, -0.025],
    ]) {
      knob(o, 'foliage', 'bush', [p[0] + dx, p[1] + dz], y + 0.68 + f, 0.215, 0.41, 1);
    }
}
function floweringPatch(o, p, r, detail, lift = 0.108) {
  const ring = radial(p, 0, r, detail >= 2 ? 14 : 8, r * 0.37).map(([x, , z]) => [x, z]);
  ground(o, ring, 'soil', 'soil', lift);
  const stems = detail === 3 ? 11 : detail === 2 ? 7 : 4;
  for (let i = 0; i < stems; i++) {
    const t = (i + 0.5) / stems,
      q = [p[0] + (t * 2 - 1) * r * 0.91, p[1] + Math.sin(i * 2.4) * r * 0.17];
    knob(
      o,
      'foliage',
      i % 3 ? 'heath' : 'heathLight',
      q,
      terrainY(q) + lift - 0.018,
      r * 0.24,
      0.22 + 0.1 * Math.sin(t * Math.PI),
      detail ? 1 : 0,
    );
  }
}
export function buildPalmForecourt(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  if (d === undefined) throw Error(`Unknown forecourt detail level ${level}`);
  for (const [i, ring] of frame.geometry.polygons.entries()) {
    ground(o, ring, 'foliage', i === 0 ? 'turf' : 'turfShade', 0.075, d > 0 ? 1 : 0);
    if (d) edging(o, ring, 'stone', 'curb', 'curb', -0.13, 0.14, 0.045);
  }
  const island = frame.geometry.polygons[0],
    center = centerOf(island);
  edging(
    o,
    island.map((p) => planarAt(p, center, 0.045)),
    'foliage',
    'hedge',
    'hedgeTop',
    0.095,
    0.645,
    0.165,
  );
  clippedTree(o, frame.center, 1.22, 2.97, d);
  for (const p of frame.globes) {
    const y = terrainY(p);
    turning(
      o,
      'timber',
      'bark',
      p,
      y + 0.065,
      [
        [0, 0.048],
        [0.76, 0.036],
      ],
      6,
    );
    knob(o, 'foliage', 'globe', p, y + 0.54, 0.61, 1.0, d);
  }
  for (const [x, z, r, h] of frame.yews) clippedTree(o, [x, z], r, h, d);
  for (const [i, [x, z, r, h]] of frame.shrubs.entries())
    if (d || i % 2 === 0) shrub(o, [x, z], r, h, d);
  urn(o, d);
  for (const p of frame.heather) if (d) floweringPatch(o, p, 1.32, d);
  for (const p of d ? frame.bowls : []) {
    const y = terrainY(p) + 0.095;
    turning(
      o,
      'stone',
      'bowl',
      p,
      y,
      [
        [0, 0.26],
        [0.13, 0.46],
        [0.31, 0.65],
        [0.34, 0.63],
        [0.3, 0.59],
      ],
      d >= 2 ? 12 : 8,
    );
    if (d) floweringPatch(o, p, 0.54, d, 0.398);
  }
  if (d) for (const data of frame.benches) bench(o, data, d);
}
export function buildPalmForecourtSkyline(o) {
  const color = (slot, tint) => tint.map((v, i) => v * (means[slot]?.[i] ?? 1));
  buildPalmForecourt(
    {
      addQuad: (s, r, p, n, uv, c) => o.addQuad('silhouette', r, p, n, uv, color(s, c)),
      addTriangle: (s, r, p, n, uv, c) => o.addTriangle('silhouette', r, p, n, uv, color(s, c)),
      addConvexPolygon: (s, r, p, n, uv, c) =>
        o.addConvexPolygon('silhouette', r, p, n, uv, color(s, c)),
    },
    'skyline',
  );
}

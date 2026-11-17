/** Josefsplatz façade, State Hall roof, and Austrian National Library parapet sculpture. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { prism } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url), 'utf8'));
export const surfaces = {
  plaster: { slot: 'wall', graph: 'plaster_lime' },
  stone: { slot: 'trim', graph: 'stone_limestone' },
  tile: { slot: 'roof', graph: 'tile_ceramic' },
  copper: { slot: 'roof', graph: 'metal_copper' },
  gold: { slot: 'trim', graph: 'metal_stainless', roughness: 0.31, metallic: 0.9 },
  wood: { slot: 'door', graph: 'wood_plain' },
  glass: { slot: 'window', localRef: 'palette:#ffffff', roughness: 0.29, metallic: 0.24 },
};

const cream = [0.92, 0.895, 0.82],
  pale = [0.97, 0.952, 0.89],
  gray = [0.62, 0.61, 0.55],
  shadow = [0.47, 0.45, 0.4];
const tile = [0.39, 0.285, 0.24],
  burnt = [0.58, 0.33, 0.25],
  oxidized = [0.29, 0.46, 0.4];
const navy = [0.11, 0.2, 0.235],
  blue = [0.25, 0.36, 0.42],
  gilt = [0.84, 0.57, 0.17];

function meshFace(out, slot, points, normal, color) {
  if (normalFor(...points).reduce((sum, v, i) => sum + v * normal[i], 0) < 0)
    points = [...points].reverse();
  const front = normalFor(...points);
  if (points.length === 3) out.addTriangle(slot, '', points, front, [], color);
  else out.addQuad(slot, '', points, front, [], color);
}
const block = (out, k, x, y, z, w, h, d, color) =>
  box(out, k, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], color);

function front(out, x, z, angle) {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  const n = ([a, b, d]) => [a * c - d * s, b, a * s + d * c];
  const p = (v) => n(v).map((value, i) => value + [x, layout.base, z][i]);
  return {
    addTriangle: (k, r, v, m, u, t) => out.addTriangle(k, r, v.map(p), n(m), u, t),
    addQuad: (k, r, v, m, u, t) => out.addQuad(k, r, v.map(p), n(m), u, t),
    addConvexPolygon: (k, r, v, m, u, t) => out.addConvexPolygon(k, r, v.map(p), n(m), u, t),
  };
}

function rectangle(out, k, x, y, z, w, h, color) {
  meshFace(
    out,
    k,
    [
      [x - w / 2, y, z],
      [x + w / 2, y, z],
      [x + w / 2, y + h, z],
      [x - w / 2, y + h, z],
    ],
    [0, 0, 1],
    color,
  );
}

function curvedPanel(out, k, x, y, z, w, h, rise, steps, color) {
  rectangle(out, k, x, y, z, w, h - rise, color);
  for (let i = 0; i < steps; i++) {
    const a = (Math.PI * i) / steps,
      b = (Math.PI * (i + 1)) / steps;
    meshFace(
      out,
      k,
      [
        [x, y + h - rise, z],
        [x + (Math.cos(a) * w) / 2, y + h - rise + Math.sin(a) * rise, z],
        [x + (Math.cos(b) * w) / 2, y + h - rise + Math.sin(b) * rise, z],
      ],
      [0, 0, 1],
      color,
    );
  }
}

function window(out, x, y, w, h, level, { arch = true, door = false } = {}) {
  const steps = level === 1 ? 4 : level === 2 ? 8 : level === 3 ? 12 : 16;
  const rise = arch ? w * (door ? 0.42 : 0.41) : 0;
  const k = door ? 'wood' : 'glass',
    color = door ? navy : blue;
  if (arch) {
    curvedPanel(out, 'stone', x, y - 0.15, 0.11, w + 0.34, h + 0.36, rise + 0.16, steps, gray);
    curvedPanel(out, k, x, y + 0.04, 0.135, w, h, rise, steps, color);
  } else {
    rectangle(out, 'stone', x, y - 0.12, 0.107, w + 0.26, h + 0.24, pale);
    rectangle(out, k, x, y, 0.138, w, h, color);
  }
  if (level >= 2) {
    if (!door) block(out, 'stone', x, y - 0.2, 0.11, w + 0.56, 0.16, 0.36, pale);
    const cols = door ? 2 : level >= 3 ? 4 : 2,
      rows = door ? 3 : level >= 3 ? 7 : 3;
    const rule = door ? navy : cream,
      slot = door ? 'wood' : 'stone';
    for (let i = 1; i < cols; i++)
      rectangle(out, slot, x + w * (i / cols - 0.5), y + 0.04, 0.159, 0.047, h - rise - 0.03, rule);
    for (let i = 1; i <= rows; i++)
      rectangle(out, slot, x, y + (i * (h - rise)) / (rows + 1), 0.159, w, 0.049, rule);
    if (arch)
      for (let j = 1; j < (level >= 3 ? 8 : 4); j++) {
        const a = (Math.PI * j) / (level >= 3 ? 8 : 4);
        beam(
          out,
          slot,
          [x, y + h - rise + 0.04, 0.169],
          [x + Math.cos(a) * w * 0.49, y + h - rise + Math.sin(a) * rise, 0.17],
          0.038,
          0.031,
          rule,
        );
      }
    if (door) {
      block(out, 'stone', x, y - 0.1, 0.2, w + 0.65, 0.12, 0.52, gray);
      for (const sign of [-1, 1])
        block(out, 'gold', x + sign * 0.13, y + 1.3, 0.185, 0.054, 0.17, 0.047, gilt);
    }
  }
}

function pilaster(out, x, y, h, w, level) {
  block(out, 'plaster', x, y, 0.13, w, h, 0.28, cream);
  if (level < 2) return;
  block(out, 'stone', x, y, 0.16, w * 1.3, 0.21, 0.36, pale);
  block(out, 'stone', x, y + h - 0.54, 0.16, w * 1.3, 0.37, 0.4, pale);
  block(out, 'stone', x, y + h - 0.14, 0.2, w * 1.62, 0.14, 0.53, gray);
  if (level >= 3)
    for (const sign of [-1, 1]) {
      sphere(
        out,
        'stone',
        [x + sign * w * 0.52, y + h - 0.33, 0.35],
        [w * 0.23, 0.25, 0.12],
        pale,
        6,
        4,
      );
      block(out, 'stone', x + sign * w * 0.32, y + h - 0.77, 0.25, 0.13, 0.36, 0.16, cream);
    }
}

function band(out, w, y, depth = 0.5, tint = pale) {
  block(out, 'stone', 0, y, depth * 0.35, w, 0.19, depth, tint);
}

function bayGroup(out, w, count, level, { center = -1, frontage = true } = {}) {
  if (level === 0) return;
  const spacing = w / count;
  band(out, w, 6.34, 0.63);
  band(out, w, 12.02, 0.24, cream);
  band(out, w, 21.41, 0.79);
  band(out, w, 22.12, 0.66, cream);
  for (let i = 0; i < count; i++) {
    const x = spacing * (i + 0.5 - count / 2),
      emphasis = i === center;
    window(
      out,
      x,
      emphasis ? 0.18 : 1.89,
      Math.min(spacing * 0.61, emphasis ? 2.75 : 1.4),
      emphasis ? 5.62 : 3.09,
      level,
      { door: emphasis },
    );
    window(out, x, 7.3, Math.min(spacing * 0.54, emphasis ? 2.1 : 1.33), 4.28, level, {
      arch: !emphasis,
    });
    window(
      out,
      x,
      13.2,
      Math.min(spacing * 0.59, emphasis ? 2.3 : 1.48),
      emphasis ? 6.9 : 5.21,
      level,
      { arch: emphasis },
    );
    if (i < count - 1) pilaster(out, x + spacing / 2, 6.55, 14.77, 0.48, level);
    if (level >= 3 && frontage) {
      rectangle(out, 'stone', x, 19.22, 0.025, Math.min(spacing * 0.39, 0.96), 0.55, pale);
      block(out, 'stone', x, 22.35, 0.1, spacing * 0.78, 1.14, 0.16, cream);
      for (let j = 0; j < 3; j++)
        block(out, 'stone', x + spacing * (j - 1) * 0.27, 20.94, 0.2, 0.19, 0.31, 0.3, pale);
    }
    if (emphasis && level >= 2) {
      block(out, 'stone', x, 6.45, 0.42, spacing * 0.68, 0.23, 0.91, pale);
      block(out, 'stone', x, 7.22, 0.66, spacing * 0.68, 0.13, 0.3, pale);
      if (level >= 3)
        for (let j = 0; j < 9; j++)
          block(out, 'stone', x + spacing * (j - 4) * 0.069, 6.65, 0.66, 0.086, 0.55, 0.13, pale);
    }
  }
  if (level >= 3 && frontage)
    for (let i = 0; i < 10; i++) {
      const y = 0.64 + i * 0.51;
      // Rustication stops at the doors and windows, leaving their ashlar surrounds intact.
      for (let j = 0; j < count; j++) {
        const edge = spacing * (j - count / 2),
          trim = i < 2 ? 0.42 : 1.24;
        rectangle(
          out,
          'stone',
          edge + spacing * 0.22,
          y,
          0.037,
          Math.max(0.15, spacing * 0.44 - trim),
          0.029,
          shadow,
        );
        rectangle(
          out,
          'stone',
          edge + spacing * 0.79,
          y,
          0.037,
          Math.max(0.15, spacing * 0.42 - trim),
          0.029,
          shadow,
        );
      }
    }
}

function roof(out, cx, cz, width, depth, y, rise, shape, color) {
  const rings = shape.map(([height, extent, run]) => {
    const a = (width / 2) * extent,
      b = (depth / 2) * run;
    return [
      [cx - a, y + rise * height, cz - b],
      [cx + a, y + rise * height, cz - b],
      [cx + a, y + rise * height, cz + b],
      [cx - a, y + rise * height, cz + b],
    ];
  });
  loft(
    out,
    'tile',
    rings.map((r) => r.toReversed()),
    color,
  );
  block(
    out,
    'copper',
    cx,
    y + rise - 0.09,
    cz,
    width * shape.at(-1)[1] + 0.25,
    0.15,
    0.24,
    oxidized,
  );
}

function urn(out, x, y, z, level) {
  const rings = [
    [0, 0.34],
    [0.19, 0.34],
    [0.25, 0.24],
    [0.38, 0.35],
    [0.72, 0.43],
    [0.98, 0.29],
    [1.04, 0.31],
    [1.16, 0.145],
    [1.31, 0.035],
  ];
  loft(
    out,
    'stone',
    rings.map(([h, r]) => radialRing(y + h, r, r, level >= 3 ? 10 : 5, [x, z])),
    pale,
  );
}

function figure(out, x, y, z, height, pose, level) {
  const n = level >= 3 ? 9 : 6;
  loft(
    out,
    'stone',
    [
      [0.02, 0.16, 0.13],
      [0.17, 0.16, 0.12],
      [0.42, 0.117, 0.105],
      [0.53, 0.145, 0.127],
      [0.78, 0.152, 0.11],
      [0.84, 0.058, 0.06],
    ].map(([h, rx, rz]) =>
      radialRing(y + h * height, rx * height, rz * height, n, [x + h * pose * 0.18, z]),
    ),
    pale,
  );
  sphere(
    out,
    'stone',
    [x + pose * 0.15 * height, y + 0.935 * height, z],
    [0.08 * height, 0.109 * height, 0.081 * height],
    cream,
    n,
    5,
  );
  const joint = [x + pose * 0.24 * height, y + 0.73 * height, z + 0.12];
  beam(
    out,
    'stone',
    joint,
    [x + pose * 0.36 * height, y + 0.88 * height, z + 0.29],
    0.1 * height,
    0.1 * height,
    pale,
  );
  beam(
    out,
    'stone',
    [x + pose * 0.36 * height, y + 0.88 * height, z + 0.29],
    [x + pose * 0.29 * height, y + 1.06 * height, z + 0.41],
    0.07 * height,
    0.075 * height,
    pale,
  );
  if (level >= 3)
    beam(
      out,
      'stone',
      [x - pose * 0.13 * height, y + 0.77 * height, z],
      [x - pose * 0.19 * height, y + 0.52 * height, z + 0.13],
      0.11 * height,
      0.09 * height,
      cream,
    );
}

function horse(out, x, y, z, level) {
  const n = level >= 3 ? 9 : 6,
    l = level >= 3 ? 6 : 4;
  sphere(out, 'stone', [x, y + 1.27, z], [0.39, 0.45, 0.82], pale, n, l);
  beam(out, 'stone', [x, y + 1.43, z + 0.45], [x + 0.03, y + 2.2, z + 0.75], 0.39, 0.47, cream);
  sphere(out, 'stone', [x + 0.03, y + 2.24, z + 0.94], [0.23, 0.38, 0.32], pale, n, l);
  for (const s of [-1, 1]) {
    const u = x + s * 0.22;
    beam(
      out,
      'stone',
      [u, y + 1.08, z - 0.45],
      [u + s * 0.06, y + 0.1, z - 0.65],
      0.16,
      0.17,
      pale,
    );
    const knee = [u + s * 0.11, y + 1.22 + s * 0.25, z + 0.77];
    beam(out, 'stone', [u, y + 1.25, z + 0.48], knee, 0.16, 0.17, pale);
    beam(out, 'stone', knee, [u + s * 0.14, y + 0.81 + s * 0.22, z + 1.08], 0.13, 0.13, cream);
    if (level >= 3)
      beam(
        out,
        'stone',
        [x + s * 0.1, y + 2.47, z + 0.82],
        [x + s * 0.13, y + 2.73, z + 0.8],
        0.09,
        0.08,
        pale,
      );
  }
  if (level >= 3)
    beam(out, 'stone', [x, y + 1.41, z - 0.68], [x + 0.04, y + 0.42, z - 1.13], 0.15, 0.15, cream);
}

function sculpture(out, level) {
  const [x, y, z] = [1.57, layout.base, 14.52];
  block(out, 'stone', x, y + 25.92, z, 13.28, 1.87, 2.35, cream);
  if (level === 0) return;
  block(out, 'stone', x, y + 27.68, z, 13.46, 0.26, 2.48, pale);
  block(out, 'copper', x, y + 25.93, z + 1.08, 13.69, 0.1, 0.43, oxidized);
  if (level >= 2) {
    for (let j = 0; j < 4; j++)
      rectangle(out, 'stone', x, y + 26.39 + j * 0.252, z + 1.2, 9.72 - j * 0.55, 0.038, gray);
    for (const s of [-1, 1]) {
      for (const u of [7.05, 23.9, 33.6])
        urn(out, x + s * u, y + 24.95, u === 7.05 ? 14.22 : 8.3, level);
      const a = x + s * 22.45;
      sphere(
        out,
        'gold',
        [a, y + 27.32, 8.29],
        [1.47, 1.61, 1.42],
        gilt,
        level >= 3 ? 19 : 12,
        level >= 3 ? 11 : 7,
      );
      figure(out, a - s * 1.58, y + 24.93, 8.72, 2.35, s, level);
      figure(out, a + s * 1.7, y + 24.93, 8.48, 2.27, -s, level);
    }
    for (const a of [-3.4, -1.21, 1.21, 3.4]) horse(out, x + a, y + 27.93, z, level);
    figure(out, x, y + 28.06, z - 0.62, 3.42, 1, level);
    figure(out, x - 5.15, y + 27.88, z, 1.91, 1, level);
    figure(out, x + 5.2, y + 27.88, z, 1.91, -1, level);
  } else {
    for (const a of [-3.4, -1.21, 1.21, 3.4])
      block(out, 'stone', x + a, y + 27.92, z, 1.11, 2.19, 1.71, pale);
    block(out, 'stone', x, y + 27.92, z - 0.62, 1.32, 3.53, 1.14, pale);
    for (const s of [-1, 1]) {
      sphere(out, 'gold', [x + s * 22.45, y + 27.32, 8.29], [1.47, 1.61, 1.42], gilt, 8, 4);
      for (const j of [-1, 1])
        block(out, 'stone', x + s * 22.45 + j * 1.59, y + 24.93, 8.6, 0.61, 2.0, 0.62, pale);
    }
  }
}

function build(out, level) {
  const y = layout.base;
  prism(
    (k, p, n) => meshFace(out, k, p, n, cream),
    'plaster',
    { outline: layout.outline, holes: [] },
    layout.foundation,
    y + (level === 0 ? 24.97 : 23.52),
    false,
  );
  // The outer parapet follows the real plan. Roof drains and lower mouldings use the same wall line.
  for (let i = 0; level > 0 && i < layout.outline.length; i++) {
    const [x, z] = layout.outline[i],
      [a, b] = layout.outline[(i + 1) % layout.outline.length];
    const width = Math.hypot(a - x, b - z);
    if (width < 0.12) continue;
    const wall = front(out, (x + a) / 2, (z + b) / 2, Math.atan2(b - z, a - x));
    block(wall, 'stone', 0, 22.96, 0, width + 0.13, 0.18, 0.6, pale);
    block(wall, 'plaster', 0, 23.12, 0, width + 0.1, 1.89, 0.4, cream);
    block(wall, 'stone', 0, 24.95, 0, width + 0.13, 0.21, 0.58, pale);
    if (level >= 2 && width > 3.0) band(wall, width, 0.41, 0.22, gray);
  }
  const hip = [
    [0, 1, 1],
    [0.8, 0.76, 0.32],
    [1, 0.6, 0.015],
  ];
  roof(out, -24.44, -1.12, 28.9, 19.85, y + 23.5, 7.55, hip, tile);
  roof(out, 24.01, -1.02, 24.25, 19.5, y + 23.5, 7.74, hip, tile);
  roof(out, 44.1, -5.68, 18.84, 26.9, y + 23.5, 7.48, hip, burnt);
  prism(
    (k, p, n) => meshFace(out, k, p, n, cream),
    'plaster',
    { outline: layout.dome, holes: [] },
    y + 23.43,
    y + 27.53,
    false,
  );
  const main =
    level === 0
      ? [
          [0, 1, 1],
          [0.74, 0.81, 0.72],
          [1, 0.59, 0.4],
        ]
      : [
          [0, 1, 1],
          [0.63, 0.97, 0.87],
          [0.82, 0.88, 0.71],
          [1, 0.64, 0.43],
        ];
  roof(out, 1.61, -1.47, 19.82, 29.25, y + 27.45, 13.42, main, tile);
  const central = front(out, 1.6, 16.27, -0.011);
  if (level > 0) {
    bayGroup(front(out, -24.95, 9.14, 0), 27.1, 5, level, { center: 2 });
    bayGroup(front(out, 25.78, 9.02, 0.007), 26.6, 5, level, { center: 2 });
    bayGroup(front(out, 47.52, 9.16, 0.007), 15.2, 3, level);
    bayGroup(front(out, 1.6, -19.02, Math.PI), 15.52, 3, level, { center: 1, frontage: false });
    for (const [x, z, w] of [
      [-24, -11.16, 28.0],
      [23.5, -10.89, 20.6],
      [44.2, -19.56, 16.0],
    ])
      bayGroup(front(out, x, z, Math.PI), w, Math.round(w / 5.2), level, { frontage: false });
    bayGroup(central, 15.8, 3, level, { center: 1 });
    for (const s of [-1, 1]) {
      pilaster(central, s * 5.88, 6.55, 14.92, 0.84, level);
      pilaster(central, s * 6.92, 6.55, 14.92, 0.66, level);
    }
    const dormer = front(out, 1.6, 12.5, 0);
    block(dormer, 'plaster', 0, 27.46, 0, 10.0, 6.2, 2.1, cream);
    curvedPanel(dormer, 'stone', 0, 27.48, 1.11, 9.8, 10.2, 4.45, level >= 3 ? 18 : 8, pale);
    const raised = front(out, 1.6, 13.67, 0);
    window(raised, 0, 28.02, 7.77, 8.72, level);
    if (level >= 2) {
      for (const [x, z] of [
        [-30, -5],
        [-19, -5],
        [20, -5],
        [32, -5],
      ]) {
        block(out, 'plaster', x, y + 29.1, z, 1.18, 2.35, 1.34, cream);
        block(out, 'stone', x, y + 31.36, z, 1.39, 0.18, 1.51, gray);
      }
      loft(
        out,
        'copper',
        [
          [0, 0.72],
          [0.16, 0.81],
          [0.31, 0.79],
          [0.97, 0.3],
          [1.28, 0.1],
        ].map(([h, r]) => radialRing(y + 40.77 + h, r, r, level >= 3 ? 12 : 7, [1.61, -1.47])),
        oxidized,
      );
      sphere(out, 'gold', [1.61, y + 42.24, -1.47], [0.24, 0.26, 0.24], gilt, 9, 5);
    }
  }
  sculpture(out, level);
}

export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);

import { loft } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
import site from '../site-controls.json' with { type: 'json' };

export const surfaces = {
  marble: { slot: 'trim', graph: 'stone_marble', roughness: 0.95 },
  rubble: { slot: 'foundation', graph: 'stone_limestone_weathered', roughness: 0.98 },
  ashlar: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96 },
};

const TAU = Math.PI * 2;
const angle = (site.planAngleDegrees * Math.PI) / 180;
const sin = Math.sin(angle),
  cos = Math.cos(angle);
const transform = ([x, y, z]) => [x * cos - z * sin, y, x * sin + z * cos];
const tones = ['b7b1a1', 'c1bcab', 'a9a596', 'c8c2b1', 'ada999', 'bcb6a3'].map(rgb);
const pick = (i) => tones[((i % tones.length) + tones.length) % tones.length];

function oriented(out) {
  return {
    addTriangle(slot, ref, points, normal, uv, color) {
      out.addTriangle(slot, ref, points.map(transform), transform(normal), uv, color);
    },
    addQuad(slot, ref, points, normal, uv, color) {
      out.addQuad(slot, ref, points.map(transform), transform(normal), uv, color);
    },
    addConvexPolygon(slot, ref, points, normal, uv, color) {
      out.addConvexPolygon(slot, ref, points.map(transform), transform(normal), uv, color);
    },
  };
}

function block(out, x, y, z, w, h, d, seed, detail, material = 'rubble') {
  if (detail < 2) {
    box(out, material, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2], pick(seed));
    return;
  }
  const ch = 0.19 + 0.06 * Math.sin(seed);
  const ring = [
    [-0.5 + ch, -0.5],
    [-0.5, -0.5 + ch],
    [-0.5, 0.5 - ch],
    [-0.5 + ch, 0.5],
    [0.5 - ch, 0.5],
    [0.5, 0.5 - ch],
    [0.5, -0.5 + ch],
    [0.5 - ch, -0.5],
  ];
  const section = (height, size) =>
    ring.map(([u, v], i) => [
      x + size * u * w + 0.06 * w * Math.sin(seed + i * 0.71),
      y + h * (height + 0.09 * Math.sin(seed + i * 1.9)),
      z + size * v * d + 0.052 * d * Math.cos(seed + i * 1.4),
    ]);
  // Small corner cuts and battered shoulders catch light without baking the weathering into textures.
  loft(out, material, [section(0, 0.94), section(0.65, 1), section(1, 0.76)], pick(seed));
}

const drums = [
  [1.69, 2.72, 0.96, false, 0],
  [2.72, 3.69, 0.83, true, 2],
  [3.69, 4.91, 0.86, true, 3],
  [4.91, 5.91, 0.82, true, 1],
  [5.91, 6.88, 0.78, true, 5],
  [6.88, 7.98, 0.79, false, 1],
  [7.98, 9.11, 0.76, false, 4],
  [9.11, 10.13, 0.75, false, 2],
  [10.13, 11.24, 0.74, false, 0],
  [11.24, 12.23, 0.7, false, 5],
  [12.23, 13.2, 0.73, false, 1],
  [13.2, 14.35, 0.63, false, 2],
];

function drum(out, x, z, y0, y1, radius, fluted, color, detail, index) {
  const scallops = detail === 3 ? 18 : 12;
  const sides =
    detail === 3 && fluted
      ? scallops * 3
      : detail === 2 && fluted
        ? scallops * 2
        : detail === 3
          ? 28
          : detail === 2
            ? 20
            : 12;
  const shape = (y, r) => {
    return Array.from({ length: sides }, (_, j) => {
      const a = (-TAU * j) / sides;
      const groove = fluted && detail > 1 ? 0.072 * (0.5 + 0.5 * Math.cos(a * scallops)) : 0;
      const wear =
        detail > 1 ? 0.029 * Math.cos(a * 4 + index) + 0.018 * Math.sin(a * 7 + index) : 0;
      const p = r - groove + wear;
      return [x + p * Math.cos(a), y + 0.025 * Math.sin(a * 3 + index), z + p * Math.sin(a)];
    });
  };
  const h = y1 - y0;
  const profile =
    detail > 1
      ? [
          shape(y0 + 0.014, radius * 0.94),
          shape(y0 + 0.12 * h, radius),
          shape(y1 - 0.15 * h, radius * 0.982),
          shape(y1 - 0.014, radius * 0.936),
        ]
      : [shape(y0 + 0.018, radius * 0.97), shape(y1 - 0.018, radius * 0.96)];
  loft(out, 'marble', profile, color);
}

function standingColumn(out, detail) {
  const steps = [
    [-0.22, 0.47, 4.77, 3.87],
    [0.44, 0.85, 3.97, 3.37],
    [0.83, 1.27, 3.23, 2.94],
    [1.24, 1.72, 2.39, 2.12],
  ];
  for (const [i, [lo, hi, w, d]] of steps.entries()) {
    const count = detail > 1 ? 3 : 1;
    for (let k = 0; k < count; k++)
      block(
        out,
        ((k - (count - 1) / 2) * w) / count,
        lo,
        0,
        w / count + 0.03,
        hi - lo,
        d,
        i + k,
        detail,
        i === 3 ? 'ashlar' : 'rubble',
      );
  }
  if (!detail) {
    drum(out, 0, 0, 1.67, 5.99, 0.9, false, tones[0], 0, 0);
    drum(out, 0.028, 0, 5.96, 10.17, 0.79, false, tones[2], 0, 1);
    drum(out, 0.03, -0.023, 10.14, site.standingColumnHeight, 0.7, false, tones[1], 0, 2);
    return;
  }
  for (const [i, [lo, hi, r, fluted, c]] of drums.entries()) {
    const dx = 0.061 * Math.sin(i * 0.79),
      dz = 0.042 * Math.cos(i * 0.77);
    drum(out, dx, dz, lo, hi, r, fluted, pick(c), detail, i);
  }
}

// Photo-based surviving runs remain discontinuous within the mapped archaeological site.
const walls = [
  [-106.8, -78.1, -4.9, -0.53, 0.38, 2.6],
  [-103.45, -88.3, 9.7, -0.31, 0.23, 1.22],
  [-76.1, -62.78, -4.85, -0.29, 0.26, 1.54],
  [-72.72, -47.57, 8.2, -0.26, 0.27, 1.35],
  [-50.7, -20.7, 13.54, -0.31, 0.31, 1.19],
  [-44.1, -15.65, -10.1, -0.26, 0.24, 1.28],
  [-12.8, 6.3, 10.57, -0.18, 0.42, 1.44],
  [-25.8, -20.1, -6.4, -0.25, 0.24, 2.4],
];
const isolated = [
  [-101.7, 3.0, 1.7, 0.59, 1.1],
  [-88.4, -4.1, 1.9, 0.74, 1.6],
  [-73.6, 3.8, 1.43, 0.48, 1.21],
  [-52.4, 1.9, 1.67, 0.71, 1.6],
  [-39.1, 4.96, 1.48, 0.95, 1.22],
  [-21.73, 17.22, 1.25, 0.62, 1.77],
  [-17.2, -11.86, 1.55, 0.68, 1.12],
  [-8.5, -6.0, 1.59, 0.71, 1.37],
  [-2.5, 7.42, 1.26, 0.85, 1.05],
  [4.7, 3.75, 1.24, 0.6, 1.69],
  [-52.9, -5.8, 1.45, 0.48, 1.2],
  [-65.56, -2.3, 1.48, 0.48, 1.1],
];

function remains(out, detail) {
  for (const [i, [from, to, z, y, h, depth]] of walls.entries()) {
    const blocks =
      detail === 0 ? 2 : Math.ceil((to - from) / (detail === 1 ? 3.6 : detail === 2 ? 2.42 : 1.71));
    const gap = (to - from) / blocks;
    for (let j = 0; j < blocks; j++) {
      if (detail > 0 && j % 7 === 4 && i < 6) continue;
      const x = from + (j + 0.5) * gap,
        d = 0.07 * Math.cos(i * 1.3 + j * 0.77);
      block(
        out,
        x,
        y,
        z + d,
        gap * (detail > 1 ? 0.93 : 0.985),
        h - y + 0.12 * Math.sin(j + i),
        depth,
        i + j,
        detail,
      );
    }
  }
  if (!detail) return;
  for (const [i, [x, z, w, h, d]] of isolated.entries())
    block(out, x, -0.29, z, w, h + 0.22, d, i + 7, detail);

  // The detached fluted fragment stack in the foreground of the southwest photograph.
  const x = -10.6,
    z = 9.0;
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6;
    block(
      out,
      x + 1.05 * Math.cos(a),
      -0.24,
      z + 0.72 * Math.sin(a),
      1.24,
      0.94,
      1.19,
      i + 8,
      detail,
    );
  }
  block(out, x, 0.64, z, 2.35, 0.59, 1.86, 2, detail);
  drum(out, x, z, 1.19, 1.83, 0.79, false, tones[2], detail, 2);
  drum(out, x + 0.07, z, 1.81, 2.42, 0.76, true, tones[0], detail, 3);
  block(out, x - 0.08, 2.42, z - 0.13, 1.12, 0.57, 0.87, 3, detail, 'marble');
}

function build(out, detail) {
  standingColumn(out, detail);
  remains(oriented(out), detail);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = buildCloseup;

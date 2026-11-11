/** The present-day display foundations and low earthworks at Altenmünster. */
import { readFileSync } from 'node:fs';
import { normalFor } from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.97 },
  stone: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.9 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.98 },
  earth: { slot: 'foundation', localRef: 'palette:#ffffff', roughness: 0.99 },
};
const tones = {
  wall: '8a8877',
  dark: '706b5e',
  warm: '92816a',
  sand: '9c9179',
  cap: '9b927e',
  moss: '7c8066',
  gravel: 'ad9e82',
  edge: 'a2977c',
  grass: '85945d',
  sunGrass: '8e9b65',
  green: '788756',
};
const color = Object.fromEntries(
  Object.entries(tones).map(([key, value]) => [
    key,
    value.match(/../g).map((h) => {
      const s = parseInt(h, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const tiers = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 },
  up = [0, 1, 0];
const mix = (a, b, t) => a + (b - a) * t;
function grade(x, z) {
  const { origin, step, size, heights } = layout.grade;
  const [u, v] = [x, z].map((p, i) =>
    Math.min(size[i] - 1.001, Math.max(0, (p - origin[i]) / step)),
  );
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * size[0] + i;
  return mix(
    mix(heights[k], heights[k + 1], a),
    mix(heights[k + size[0]], heights[k + size[0] + 1], a),
    b,
  );
}
function tri(out, slot, tint, points, normal) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.99) return;
  if (n.reduce((s, v, i) => s + v * normal[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', points, n, undefined, color[tint]);
}
function quad(out, slot, tint, [a, b, c, d], n) {
  tri(out, slot, tint, [a, b, c], n);
  tri(out, slot, tint, [a, c, d], n);
}
function rectangle(out, slot, tint, x0, z0, x1, z1, d) {
  const n = d < 2 ? 1 : Math.ceil((x1 - x0) / 3),
    m = d < 2 ? 2 : Math.ceil((z1 - z0) / 3);
  const at = (u, v) => {
    const x = mix(x0, x1, u / n),
      z = mix(z0, z1, v / m);
    return [x, grade(x, z) + 0.22, z];
  };
  for (let u = 0; u < n; u++)
    for (let v = 0; v < m; v++)
      quad(out, slot, tint, [at(u, v), at(u, v + 1), at(u + 1, v + 1), at(u + 1, v)], up);
}
const wallColors = ['wall', 'warm', 'dark', 'sand', 'wall', 'moss', 'wall'];
function wall(out, a, b, width, height, d) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    nx = dz / l,
    nz = -dx / l;
  const n = Math.max(
    1,
    Math.ceil(l / (d === 0 ? 9 : d === 1 ? 4.5 : d === 2 ? 1.6 : d === 3 ? 0.82 : 0.66)),
  );
  const at = (u, y, s) => {
    const x = mix(a[0], b[0], u) + nx * s * width * 0.5,
      z = mix(a[1], b[1], u) + nz * s * width * 0.5;
    return [x, grade(x, z) + y, z];
  };
  const noise = (j) => 0.042 * Math.sin(j * 3.12 + a[0] * 5.7 + a[1] * 0.6);
  for (let i = 0; i < n; i++) {
    const u = i / n,
      v = (i + 1) / n,
      topA = height + noise(i),
      topB = height + noise(i + 1);
    for (const side of [-1, 1]) {
      const normal = [side * nx, 0, side * nz],
        bottom = -0.23;
      const levels = d === 0 ? [-0.23, 1] : d < 3 ? [-0.23, 0.42, 1] : [-0.23, 0.21, 0.46, 0.7, 1];
      for (let j = 1; j < levels.length; j++) {
        const tint =
          d === 0
            ? 'wall'
            : wallColors[
                (i * 3 + j * 2 + Math.floor(a[0] * 19 + a[1] * 13) + 2222) % wallColors.length
              ];
        const y0 = j === 1 ? bottom : levels[j - 1] * topA,
          y1 = j === 1 ? bottom : levels[j - 1] * topB;
        const p = [
          at(u, y0, side),
          at(v, y1, side),
          at(v, levels[j] * topB, side),
          at(u, levels[j] * topA, side),
        ];
        quad(out, 'rubble', tint, p, normal);
        if (d >= 3 && j !== levels.length - 1 && i % 3 !== 1) {
          const w = (v - u) * (0.22 + 0.22 * Math.cos(i * 7.7 + j * 3.5)),
            t = (u + v) * 0.5,
            s = side * 1.023;
          const left = at(t - w, levels[j] * topA - 0.025, s),
            right = at(t + w, levels[j] * topB - 0.021, s);
          quad(
            out,
            'rubble',
            'dark',
            [
              left,
              right,
              [right[0], right[1] + 0.018, right[2]],
              [left[0], left[1] + 0.018, left[2]],
            ],
            normal,
          );
        }
      }
    }
    quad(
      out,
      'stone',
      i % 6 === 2 ? 'moss' : 'cap',
      [at(u, topA, -1), at(u, topA, 1), at(v, topB, 1), at(v, topB, -1)],
      up,
    );
  }
  for (const [u, s] of [
    [0, -1],
    [1, 1],
  ]) {
    const top = height + noise(u === 0 ? 0 : n);
    quad(
      out,
      'rubble',
      'wall',
      [at(u, -0.23, -1), at(u, -0.23, 1), at(u, top, 1), at(u, top, -1)],
      [dx * s, 0, dz * s],
    );
  }
}
function threshold(out, z, halfWidth, door, d) {
  const start = -halfWidth,
    end = halfWidth;
  wall(out, [start, z], [-door * 0.5, z], 0.63, 0.69, d);
  wall(out, [door * 0.5, z], [end, z], 0.63, 0.69, d);
  rectangle(out, 'stone', 'edge', -door * 0.5, z - 0.38, door * 0.5, z + 0.36, d);
}
function earthwork(out, a, b, width, height, d) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz),
    nx = dz / l,
    nz = -dx / l;
  const n = Math.max(4, Math.ceil(l / (d < 2 ? 7 : 3)));
  const sections =
    d < 2
      ? [
          [-1, 0],
          [0, 1],
          [1, 0],
        ]
      : [
          [-1, 0],
          [-0.68, 0.23],
          [-0.27, 0.88],
          [0.2, 1],
          [0.65, 0.3],
          [1, 0],
        ];
  const at = (i, j) => {
    const u = i / n,
      [side, profile] = sections[j];
    const x = mix(a[0], b[0], u) + side * nx * width * 0.5,
      z = mix(a[1], b[1], u) + side * nz * width * 0.5;
    const taper = Math.min(1, Math.min(u, 1 - u) * 5);
    return [x, grade(x, z) + 0.075 + height * profile * taper, z];
  };
  for (let i = 0; i < n; i++)
    for (let j = 1; j < sections.length; j++)
      quad(
        out,
        'earth',
        j % 3 === 0 ? 'green' : j % 2 === 0 ? 'sunGrass' : 'grass',
        [at(i, j - 1), at(i, j), at(i + 1, j), at(i + 1, j - 1)],
        up,
      );
}
export function buildLevel(out, level) {
  const d = tiers[level],
    { outer } = layout.geometry.walls;
  rectangle(out, 'gravel', 'gravel', -4.69, -4.85, 4.69, 9.97, d);
  rectangle(out, 'gravel', 'gravel', -3.44, -10.64, 3.44, -4.93, d);
  for (let i = 1; i < outer.length; i++)
    wall(out, outer[i - 1], outer[i], 0.61, i === 4 ? 0.82 : 0.68, d);
  threshold(out, 10.0, 4.8, 1.92, d);
  threshold(out, 3.05, 4.73, 1.72, d);
  threshold(out, -4.9, 3.55, 1.55, d);
  if (d >= 1) {
    for (const s of [-1, 1]) {
      wall(out, [s * 2.55, -10.73], [s * 2.55, -9.36], 0.6, 0.57, d);
      rectangle(out, 'stone', 'sand', s < 0 ? -3.18 : 1.97, -10.33, s < 0 ? -1.97 : 3.18, -9.78, d);
    }
  }
  for (const [a, b, w, h] of [
    [[7.8, 7.1], [7.8, -22.1], 3.8, 0.56],
    [[7.8, -22.1], [11.25, -22.1], 2.4, 0.52],
    [[11.25, -22.1], [13.0, -2.4], 2.9, 0.56],
    [[13.0, -2.4], [8.6, -2.4], 2.6, 0.43],
  ])
    earthwork(out, a, b, w, h, d);
}
export const buildSkyline = (out) => buildLevel(out, 'skyline');
export const buildDistrict = (out) => buildLevel(out, 'district');
export const buildStreet = (out) => buildLevel(out, 'street');
export const buildCloseup = (out) => buildLevel(out, 'closeup');
export const buildMaster = (out) => buildLevel(out, 'master');

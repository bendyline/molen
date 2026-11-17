/** Photo-based geometry for the outdoor civilian memorial at Mount Herzl. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  beamPath,
  loft,
  normalFor,
  normalize,
  radialRing,
  sphere,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  wall: { slot: 'wall', graph: 'stone_limestone_weathered', roughness: 0.92 },
  paving: { slot: 'foundation', graph: 'stone_limestone', roughness: 0.92 },
  tower: { slot: 'trim', graph: 'concrete_plain', roughness: 0.87 },
  bronze: { slot: 'door', graph: 'metal_bronze_cast', roughness: 0.78, metallic: 0.16 },
};
const colors = {
  warm: [0.88, 0.79, 0.65],
  cream: [0.97, 0.91, 0.78],
  tan: [0.73, 0.65, 0.53],
  joint: [0.55, 0.48, 0.38],
  rose: [0.64, 0.43, 0.35],
  bronze: [0.15, 0.17, 0.18],
  plate: [0.2, 0.22, 0.22],
  letters: [0.4, 0.43, 0.41],
  torch: [0.22, 0.24, 0.23],
  rock: [0.56, 0.5, 0.4],
  earth: [0.42, 0.35, 0.25],
  leaf: [0.29, 0.35, 0.14],
  flower: [0.74, 0.19, 0.12],
};
const up = [0, 1, 0],
  _tau = Math.PI * 2,
  mix = (a, b, t) => a + (b - a) * t;
const lerp = (a, b, t) => a.map((p, i) => mix(p, b[i], t));
const style = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const P = ([x, z], y) => [x, y, z];
function edge(a, b) {
  const [x, z] = a,
    length = Math.hypot(b[0] - x, b[1] - z),
    dx = (b[0] - x) / length,
    dz = (b[1] - z) / length;
  return {
    a,
    b,
    length,
    dx,
    dz,
    normal: [dz, 0, -dx],
    point: (s, h, d = 0) => [x + s * dx + dz * d, h, z + s * dz - dx * d],
  };
}
function tri(out, slot, color, points, wanted) {
  let normal = normalFor(...points);
  if (Math.hypot(...normal) < 0.95) return;
  if (normal.reduce((v, p, i) => v + p * wanted[i], 0) < 0) {
    normal = normal.map((n) => -n);
    points = points.toReversed();
  }
  out.addTriangle(slot, '', points, normal, undefined, color);
}
function quad(out, slot, color, [a, b, c, d], normal) {
  tri(out, slot, color, [a, b, c], normal);
  tri(out, slot, color, [a, c, d], normal);
}
function plane(out, slot, color, ring, height) {
  const ids = earcut(ring.flat());
  for (let k = 0; k < ids.length; k += 3)
    tri(
      out,
      slot,
      color,
      ids.slice(k, k + 3).map((i) => P(ring[i], height(...ring[i]))),
      up,
    );
}
function ground(x, z) {
  const { origin, step, width, height, samples } = layout.siteGrid;
  const [u, v] = [x, z].map((x, i) =>
    Math.max(0, Math.min((i ? height : width) - 1.001, (x - origin[i]) / step)),
  );
  const i = Math.floor(u),
    j = Math.floor(v),
    k = j * width + i;
  return mix(
    mix(samples[k], samples[k + 1], u - i),
    mix(samples[k + width], samples[k + width + 1], u - i),
    v - j,
  );
}
const grade = (x, z) => -0.1 + 0.157 * x + 0.022 * z;
function slab(out, ring, height, slot = 'paving', color = colors.cream) {
  plane(out, slot, color, ring, height);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      e = edge(a, b),
      ya = height(...a),
      yb = height(...b);
    const low = (p, y) => Math.min(y - 0.22, ground(...p) - 0.35);
    quad(
      out,
      'wall',
      colors.warm,
      [P(a, low(a, ya)), P(a, ya), P(b, yb), P(b, low(b, yb))],
      e.normal,
    );
    quad(
      out,
      'wall',
      colors.warm,
      [P(a, low(a, ya)), P(a, ya), P(b, yb), P(b, low(b, yb))],
      e.normal.map((n) => -n),
    );
  }
}
function paving(out, lod) {
  slab(out, layout.court, grade);
  // The court opens onto two native paths. Grade each short connection at its outer edge.
  const south = layout.connections[0];
  const first = layout.entrance;
  const southRamp = (x, z) =>
    mix(grade(x, z), ground(x, z) + 0.11, Math.max(0, Math.min(1, z / south[1])));
  slab(out, layout.opening, southRamp);
  const northRamp = (x, z) =>
    mix(grade(x, z), ground(x, z) + 0.11, Math.max(0, Math.min(1, (x - 5) / 9.5)));
  slab(out, layout.promenade, northRamp);
  if (lod < 1) return;
  // Fan-shaped brick lines align with the tower and terminate at the curved terrace edge.
  const sweep = layout.court.slice(2, -1);
  for (const [i, end] of sweep.entries()) {
    if (lod === 1 && i % 2) continue;
    const start = lerp(layout.court[0], end, 0.08),
      finish = lerp(layout.court[0], end, 0.977);
    const e = edge(start, finish),
      w = 0.18;
    const strip = (s, d) => {
      const [x, , z] = e.point(s, 0, d);
      return [x, grade(x, z) + 0.008, z];
    };
    const n = lod >= 3 ? Math.ceil(e.length / 0.53) : 1;
    for (let j = 0; j < n; j++) {
      const a = (j * e.length) / n + 0.007,
        b = ((j + 1) * e.length) / n - 0.007;
      quad(
        out,
        'paving',
        j % 5 === 3 ? colors.tan : colors.rose,
        [strip(a, -w), strip(b, -w), strip(b, w), strip(a, w)],
        up,
      );
    }
  }
  if (lod < 2) return;
  for (const t of [0.25, 0.39, 0.54, 0.69, 0.84, 0.96]) {
    const ring = sweep.map((end) => lerp(layout.court[0], end, t));
    for (let i = 1; i < ring.length; i++) {
      const e = edge(ring[i - 1], ring[i]);
      const stone = (s, d) => {
        const [x, , z] = e.point(s, 0, d);
        return [x, grade(x, z) + 0.005, z];
      };
      quad(
        out,
        'paving',
        colors.joint,
        [stone(0, -0.014), stone(e.length, -0.014), stone(e.length, 0.014), stone(0, 0.014)],
        up,
      );
    }
  }
  const [a, b] = first;
  const e = edge(a, b);
  for (let j = 0; j < 5; j++) {
    const x = ((j + 0.5) * e.length) / 5,
      [u, , v] = e.point(x, 0, -0.9);
    sphere(out, 'wall', [u, southRamp(u, v) + 0.14, v], [0.35, 0.25, 0.32], colors.leaf, 7, 4);
    if (lod >= 3)
      sphere(
        out,
        'wall',
        [u + 0.17, southRamp(u, v) + 0.3, v],
        [0.1, 0.07, 0.14],
        colors.flower,
        5,
        3,
      );
  }
}
// The two walls present their plaques toward the shared court.
function nameWall(out, a, b, lod, variant) {
  const e = edge(a, b);
  const from = variant === 0 ? 0 : 1.75,
    to = variant === 0 ? e.length - 1.8 : e.length;
  const bottom = (s) => {
    const [x, , z] = e.point(s, 0);
    return grade(x, z);
  };
  const top = (s) => bottom(s) + 3.1 + (0.39 * s) / e.length;
  const set = (s, y, d) => e.point(s, y, d);
  const N = e.normal,
    B = N.map((v) => -v);
  const width = 0.38;
  for (const [depth, normal] of [
    [0, N],
    [-width, B],
  ]) {
    quad(
      out,
      'wall',
      colors.warm,
      [
        set(from, bottom(from) - 0.36, depth),
        set(to, bottom(to) - 0.36, depth),
        set(to, top(to), depth),
        set(from, top(from), depth),
      ],
      normal,
    );
  }
  quad(
    out,
    'wall',
    colors.cream,
    [
      set(from, top(from), 0),
      set(to, top(to), 0),
      set(to, top(to), -width),
      set(from, top(from), -width),
    ],
    up,
  );
  for (const s of [from, to]) {
    const n = [e.dx, 0, e.dz].map((v) => v * (s === from ? -1 : 1));
    quad(
      out,
      'wall',
      colors.warm,
      [
        set(s, bottom(s) - 0.36, 0),
        set(s, top(s), 0),
        set(s, top(s), -width),
        set(s, bottom(s) - 0.36, -width),
      ],
      n,
    );
  }
  if (lod >= 2) {
    for (let row = 0; row < 9; row++) {
      const left = from + 0.19 * (row % 2),
        h = row * 0.365;
      const n = Math.ceil((to - left) / (lod === 2 ? 1.68 : 1.07));
      for (let i = 0; i < n; i++) {
        const p = mix(left, to, i / n) + 0.013,
          q = mix(left, to, (i + 1) / n) - 0.013;
        const d = 0.011 + 0.012 * ((i + row) % 3);
        quad(
          out,
          'wall',
          [colors.cream, colors.warm, colors.tan][(row * 7 + i * 5) % 3],
          [
            set(p, bottom(p) + h, d),
            set(q, bottom(q) + h, d),
            set(q, Math.min(top(q), bottom(q) + h + 0.344), d),
            set(p, Math.min(top(p), bottom(p) + h + 0.344), d),
          ],
          N,
        );
      }
    }
  }
  const plate = (s, width, h, height, depth, color) => {
    const a = s - width / 2,
      b = s + width / 2,
      y = bottom(s) + h - height / 2,
      z = y + height;
    quad(
      out,
      'bronze',
      color,
      [set(a, y, depth), set(b, y, depth), set(b, z, depth), set(a, z, depth)],
      N,
    );
  };
  const count = lod === 0 ? 8 : Math.floor((to - from) / 1.46);
  for (let j = 0; j < count; j++) {
    const s = mix(from + 0.82, to - 0.82, j / (count - 1)),
      w = lod === 0 ? 1.58 : mix(0.92, 1.16, (j % 5) / 4);
    const h = 1.12 + (j % 3) * 0.53 + (variant === 0 ? 0 : 0.09),
      ht = 0.49 + (j % 4) * 0.066;
    plate(s, w, h, ht, 0.051, colors.bronze);
    if (lod >= 1) plate(s, w - 0.047, h, ht - 0.047, 0.058, colors.plate);
    if (lod >= 3) {
      // Reproduces the tonal density of bronze engraving without inventing commemorative names.
      const rows = lod === 4 ? 9 : 6;
      for (let r = 0; r < rows; r++) {
        const y = h + ((r - (rows - 1) / 2) * ht) / (rows + 2);
        for (let g = 0; g < (lod === 4 ? 4 : 2); g++) {
          const groups = lod === 4 ? 4 : 2,
            d = w / groups;
          plate(
            s + d * (g - (groups - 1) / 2),
            d * (0.53 + ((j + g + 3 * r) % 5) * 0.06),
            y,
            0.009,
            0.061,
            colors.bronze,
          );
        }
      }
    }
  }
}
function tower(out, lod) {
  const height = 6.25,
    width = 1.8;
  const corners = [
    [-width, -width],
    [width, -width],
    [width, width],
    [-width, width],
  ];
  const opening = [
    [-0.08, 1.23],
    [0.58, 1.4],
    [0.96, 1.9],
    [1.02, 2.65],
    [0.91, 3.27],
    [0.97, 3.89],
    [0.76, 4.55],
    [0.33, 5.02],
    [-0.14, 5.14],
    [-0.65, 4.93],
    [-0.94, 4.51],
    [-0.94, 4.01],
    [-0.82, 3.47],
    [-0.98, 2.93],
    [-0.96, 2.15],
    [-0.64, 1.5],
  ];
  const rim =
    lod === 0
      ? opening.filter((_, i) => i % 3 !== 1)
      : lod === 1
        ? opening
        : opening.flatMap((p, i) => {
            const prev = opening[(i + opening.length - 1) % opening.length],
              q = opening[(i + 1) % opening.length],
              next = opening[(i + 2) % opening.length];
            return [p, p.map((v, j) => (9 * (v + q[j]) - prev[j] - next[j]) / 16)];
          });
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4],
      e = edge(a, b);
    const map = ([u, y], d) => {
      const v = 1 - (0.116 * y) / height;
      return [
        (a[0] + (b[0] - a[0]) * (0.5 + u / e.length)) * v + e.normal[0] * d,
        y,
        (a[1] + (b[1] - a[1]) * (0.5 + u / e.length)) * v + e.normal[2] * d,
      ];
    };
    const outer = [
      [-width, -0.26],
      [width, -0.26],
      [width, height],
      [-width, height],
    ];
    const sheets = [outer, rim];
    for (const [d, n] of [
      [0, e.normal],
      [-0.27, e.normal.map((v) => -v)],
    ]) {
      const points = sheets.flat(),
        ids = earcut(points.flat(), [outer.length]);
      for (let j = 0; j < ids.length; j += 3)
        tri(
          out,
          'tower',
          d === 0 ? colors.cream : colors.warm,
          ids.slice(j, j + 3).map((k) => map(points[k], d)),
          n,
        );
    }
    for (let j = 0; j < rim.length; j++) {
      const k = (j + 1) % rim.length,
        p = rim[j],
        q = rim[k],
        m = lerp(p, q, 0.5);
      const want = normalize([e.dx * -m[0], 3.13 - m[1], e.dz * -m[0]]);
      const lip = (t) => lerp(t, [0, 3.13], 0.075);
      quad(
        out,
        'tower',
        colors.warm,
        [map(p, 0), map(q, 0), map(lip(q), -0.09), map(lip(p), -0.09)],
        want,
      );
      quad(
        out,
        'tower',
        colors.tan,
        [map(lip(p), -0.09), map(lip(q), -0.09), map(q, -0.27), map(p, -0.27)],
        want,
      );
    }
  }
  const top = corners.map(([x, z]) => [x * 0.884, z * 0.884]);
  plane(out, 'tower', colors.cream, top, () => height);
}
function flame(out, lod) {
  const x = -1.45,
    z = -3.15,
    y = grade(x, z) + 0.04;
  const r = (h, a, b, n) => radialRing(y + h, a, b, n, [x, z], Math.PI / 6);
  loft(
    out,
    'bronze',
    [r(0, 0.47, 0.36, 8), r(0.085, 0.44, 0.34, 8), r(0.16, 0.38, 0.28, 8)],
    colors.rock,
  );
  loft(
    out,
    'bronze',
    [r(0.14, 0.27, 0.2, 7), r(1.3, 0.185, 0.154, 7), r(1.34, 0.24, 0.21, 7)],
    colors.torch,
  );
  for (const [s, w, h] of [
    [1, 0.25, 0.53],
    [-1, 0.18, 0.62],
  ]) {
    const path = [
      [x, y + 1.33, z],
      [x + s * w, y + 1.52, z + 0.022],
      [x + s * w * 0.9, y + 1.68, z - 0.03],
      [x + 0.04, y + 1.33 + h, z],
    ];
    beamPath(out, 'bronze', path, lod === 0 ? 0.069 : 0.045, 0.052, colors.bronze);
  }
  const layers = lod === 0 ? 2 : 5;
  for (let i = 0; i < layers; i++) {
    const a = [x - 0.2, y + 0.12 + i * 0.123, z + 0.14 - i * 0.04],
      b = [x + 0.68 - i * 0.091, y + 0.26 + i * 0.233, z + 0.12 + i * 0.051];
    const wing = [
      a,
      b,
      [b[0] - 0.16, b[1] + 0.144, b[2] + 0.07],
      [a[0] + 0.075, a[1] + 0.3, a[2] + 0.07],
    ];
    quad(out, 'bronze', i % 2 ? colors.torch : colors.rock, wing, [0, 0, 1]);
    quad(out, 'bronze', colors.bronze, wing, [0, 0, -1]);
    if (lod >= 3)
      beam(
        out,
        'bronze',
        [a[0], a[1] + 0.075, a[2] + 0.031],
        [b[0] - 0.049, b[1] + 0.049, b[2] + 0.041],
        0.021,
        0.02,
        colors.letters,
      );
  }
}
function rim(out, lod) {
  const perimeter = layout.court.slice(2);
  for (let i = 0; i < perimeter.length - 2; i++) {
    const e = edge(perimeter[i], perimeter[i + 1]),
      steps = Math.ceil(e.length / (lod >= 2 ? 2.95 : 7.5));
    for (let j = 0; j < steps; j++) {
      const a = (e.length * j) / steps,
        b = (e.length * (j + 1)) / steps;
      const H = (s, d, h) => {
        const [x, , z] = e.point(s, 0, d);
        return [x, grade(x, z) + h, z];
      };
      const h = 0.31 + (i % 3) * 0.048;
      quad(out, 'wall', colors.warm, [H(a, 0, 0), H(b, 0, 0), H(b, 0, h), H(a, 0, h)], e.normal);
      quad(out, 'wall', colors.cream, [H(a, 0, h), H(b, 0, h), H(b, -0.32, h), H(a, -0.32, h)], up);
    }
  }
  if (lod < 1) return;
  // The short title wall and stone ramp mark the lower arrival from the south.
  const [a, b] = layout.entrance,
    e = edge(a, b);
  const H = (s, d, w) => {
    const [x, , z] = e.point(s, 0, d);
    return [x, ground(x, z) + w, z];
  };
  for (const [d, n] of [
    [-0.18, e.normal.map((v) => -v)],
    [0.18, e.normal],
  ]) {
    quad(
      out,
      'wall',
      colors.warm,
      [H(0, d, -0.46), H(e.length, d, -0.46), H(e.length, d, 1.28), H(0, d, 1.28)],
      n,
    );
  }
  quad(
    out,
    'wall',
    colors.cream,
    [H(0, -0.18, 1.28), H(e.length, -0.18, 1.28), H(e.length, 0.18, 1.28), H(0, 0.18, 1.28)],
    up,
  );
}
export function buildMemorialLevel(out, level) {
  const lod = style[level];
  if (lod === undefined) throw Error('Unknown Mount Herzl detail level');
  paving(out, lod);
  nameWall(out, layout.first, [0, 0], lod, 0);
  nameWall(out, [0, 0], layout.second, lod, 1);
  tower(out, lod);
  flame(out, lod);
  rim(out, lod);
}
export const buildSkyline = (out) => buildMemorialLevel(out, 'skyline');
export const buildDistrict = (out) => buildMemorialLevel(out, 'district');
export const buildStreet = (out) => buildMemorialLevel(out, 'street');
export const buildCloseup = (out) => buildMemorialLevel(out, 'closeup');
export const buildMaster = (out) => buildMemorialLevel(out, 'master');

/** The original Guidestones at Elbert County, with its granite tablet and sight apertures. */
import { readFileSync } from 'node:fs';
import {
  chamferedRectangle,
  loft,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.88 },
  gravel: { slot: 'foundation', graph: 'gravel', roughness: 0.94 },
};
const c = {
  face: [0.64, 0.662, 0.65],
  light: [0.705, 0.719, 0.695],
  pitched: [0.65, 0.672, 0.648],
  underside: [0.49, 0.507, 0.491],
  base: [0.645, 0.645, 0.614],
  grit: [0.74, 0.713, 0.635],
  lettering: [0.34, 0.366, 0.353],
  tablet: [0.506, 0.525, 0.521],
};
const { faces, gnomonWidth, capLength, capHoleDiameter } = layout.dimensions;
const G = faces.thickness / 2,
  y0 = 0.09,
  y1 = y0 + faces.height,
  tau = Math.PI * 2;
const az = (layout.azimuthDegrees * Math.PI) / 180;
const positions = [
  { x: -1, z: -1, front: 'russian', back: 'chinese' },
  { x: 1, z: -1, front: 'spanish', back: 'english' },
  { x: -1, z: 1, front: 'arabic', back: 'hebrew' },
  { x: 1, z: 1, front: 'hindi', back: 'swahili' },
];
const topology = {
  english: [26, 30, 28, 22, 25, 31, 22, 26, 31, 25, 19, 25, 27, 29, 24, 26, 31, 21, 30],
  spanish: [
    28, 25, 25, 27, 23, 29, 31, 19, 25, 29, 28, 19, 27, 29, 26, 24, 25, 30, 23, 31, 29, 28, 25, 28,
    25,
  ],
  swahili: [
    28, 26, 27, 21, 31, 24, 29, 16, 28, 24, 28, 23, 24, 27, 26, 27, 23, 17, 29, 26, 31, 24, 20, 14,
  ],
  russian: [24, 26, 24, 24, 23, 26, 21, 21, 30, 24, 21, 23, 22, 26, 26, 28, 19, 26, 28, 25],
  chinese: [11, 12, 12, 10, 11, 13, 12, 10, 11, 12, 11, 12, 12, 10, 11, 10, 12, 10, 12, 11],
  hebrew: [22, 25, 26, 21, 24, 24, 27, 19, 25, 18, 25, 25, 23, 23, 22, 26, 25, 25, 20, 18],
  arabic: [23, 26, 23, 26, 29, 20, 23, 27, 20, 25, 26, 18, 25, 27, 23, 23, 25, 20, 22],
  hindi: [23, 24, 21, 28, 24, 23, 25, 28, 23, 22, 25, 24, 28, 27, 25, 22, 25, 24, 20, 22],
};
const hash = (i, j, k) =>
  (((i + 17) * 53 + (j + 11) * 37 + (k + 13) * 91 + (i + 25) * (j + 17) * 13) % 997) / 996;
const scale = (a, f) => a.map((v) => v * f);
const mix = (a, b, t) => a + (b - a) * t;
const plus = (a, b) => a.map((v, i) => v + b[i]);
const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const up = [0, 1, 0];
function triangle(out, slot, p, n, color) {
  let normal = normalFor(...p);
  if (dot(normal, n) < 0) {
    p = p.toReversed();
    normal = scale(normal, -1);
  }
  out.addTriangle(slot, '', p, normal, undefined, color);
}
function quad(out, slot, p, n, color) {
  let normal = normalFor(...p);
  if (dot(normal, n) < 0) {
    p = p.toReversed();
    normal = scale(normal, -1);
  }
  out.addQuad(slot, '', p, normal, undefined, color);
}
function lowStone(out, point, w, h, z0, z1, depth) {
  const ring = (y, a) =>
    chamferedRectangle(0, y, (z0 + z1) / 2, w + a, z1 - z0 + a, 0.025).map(([x, y, z]) =>
      point(x, y, z),
    );
  loft(out, 'granite', [ring(h - depth, -0.02), ring(h, 0.0)], c.base);
}
function unevenFace(out, p, q, n, color, d, seed, amplitude = 0.045) {
  const div = d === 0 ? 1 : d === 1 ? 3 : d === 2 ? 9 : d === 3 ? 16 : 22;
  const across = d <= 1 ? 1 : 3;
  const grid = Array.from({ length: div + 1 }, (_, i) =>
    Array.from({ length: across + 1 }, (_, j) => {
      const a = plus(scale(p[0], 1 - j / across), scale(p[1], j / across));
      const b = plus(scale(q[0], 1 - j / across), scale(q[1], j / across));
      const point = plus(scale(a, 1 - i / div), scale(b, i / div));
      const bulge =
        j > 0 && j < across && i > 0 && i < div ? (hash(i, j, seed) - 0.34) * amplitude : 0;
      return plus(point, scale(n, bulge));
    }),
  );
  for (let i = 0; i < div; i++)
    for (let j = 0; j < across; j++) {
      const a = grid[i][j],
        b = grid[i][j + 1],
        d0 = grid[i + 1][j],
        e = grid[i + 1][j + 1];
      const t = 0.956 + hash(i, j, seed) * 0.09;
      triangle(out, 'granite', [a, b, e], n, scale(color, t));
      triangle(out, 'granite', [a, e, d0], n, scale(color, 2 - t));
    }
}
function stroke(out, p, n, x, y, u, v, width, color) {
  const k = width / (2 * Math.hypot(u - x, v - y)),
    a = (y - v) * k,
    b = (u - x) * k;
  quad(
    out,
    'granite',
    [p(x + a, y + b), p(x - a, y - b), p(u - a, v - b), p(u + a, v + b)],
    n,
    color,
  );
}
function inscription(out, p, n, language, d, seed) {
  if (d === 0) return;
  const rows = topology[language],
    rightToLeft = ['arabic', 'hebrew'].includes(language);
  const chinese = language === 'chinese',
    curved = language === 'arabic',
    barred = language === 'hindi';
  const upper = 4.7,
    lower = rows.length > 22 ? 0.36 : 0.9,
    step = (upper - lower) / (rows.length - 1),
    width = 1.77;
  for (let j = 0; j < rows.length; j++) {
    const count = rows[j],
      length = width * (0.62 + count * 0.012),
      cell = length / count,
      y = upper - j * step;
    const height = chinese ? 0.115 : 0.096;
    const dir = rightToLeft ? -1 : 1;
    for (let k = 0; k < count; k++) {
      if (!chinese && (k + 3 * j) % 7 === 5) continue;
      const x = dir * (-length / 2 + (k + 0.44) * cell),
        w = cell * 0.59;
      const mark = (a, b, g, h, bold = 1) =>
        stroke(
          out,
          p,
          n,
          x + a * w,
          y + b * height,
          x + g * w,
          y + h * height,
          bold * (chinese ? 0.01 : 0.006),
          c.lettering,
        );
      const style = Math.floor(hash(k, j, seed) * 6);
      if (d === 1) {
        if (k % 3 !== 0) continue;
        if (chinese) mark(-0.54, 0.15, 0.52, 0.15, 1.35);
        else mark(-0.22, -0.12, 0.13, 0.23, 1.18);
      } else if (chinese) {
        mark(-0.51, 0.39, 0.49, 0.39);
        mark(-0.49, -0.29, 0.48, -0.29);
        if (style % 2 === 0 || d >= 3)
          mark((style % 3) * 0.18 - 0.16, -0.43, (style % 3) * 0.18 - 0.16, 0.46);
        if (d >= 3) mark(-0.45, 0.03, (style % 4) * 0.12, 0.03);
      } else if (curved) {
        mark(-0.78, 0.02, -0.18, -0.19);
        if (style % 3 !== 1 || d >= 3) mark(-0.18, -0.19, 0.78, 0.01);
        if (d >= 3) mark(0.32, 0.27, 0.45, 0.27, 1.12);
      } else if (barred) {
        mark(-0.66, 0.34, 0.62, 0.34);
        if (style % 3 !== 1 || d >= 3) mark(0.26, -0.38, 0.26, 0.34);
        if (d >= 3) mark(-0.28, 0.09, -0.08, -0.24);
      } else {
        mark(-0.45, -0.45, style % 2 === 0 ? -0.45 : 0.13, 0.45);
        if (style !== 0 || d >= 3) mark(0.54, -0.45, 0.29, 0.44);
        if (d >= 3) mark(-0.43, style === 2 ? 0.31 : -0.04, 0.41, style === 2 ? 0.31 : -0.04);
      }
    }
  }
}
function upright(out, row, d, i) {
  const e = [row.x * Math.sin(az), 0, row.z * Math.cos(az)],
    q = [-e[2], 0, e[0]];
  const near = 0.71,
    far = near + faces.width;
  const P = (x, y, z) => [e[0] * x + q[0] * z, y, e[2] * x + q[2] * z];
  lowStone(
    out,
    (x, y, z) => P(z, y, -x),
    0.6096,
    y0,
    near - 0.126,
    far + 0.126,
    y0 - layout.foundationDepth,
  );
  const [west, east] = [-G, G];
  for (const normal of [-1, 1]) {
    const N = scale(q, normal),
      a = P(near, y0, normal * G),
      b = P(far, y0, normal * G);
    const c1 = P(far, y1, normal * G),
      d1 = P(near, y1, normal * G);
    quad(out, 'granite', [a, b, c1, d1], N, c.face);
    const language = normal === 1 ? row.front : row.back;
    inscription(
      out,
      (x, y) => P((near + far) / 2 + x * normal, y0 + y, normal * (G + 0.0012)),
      N,
      language,
      d,
      i * 2 + normal + 1,
    );
  }
  for (const [x, m] of [
    [near, -1],
    [far, 1],
  ])
    unevenFace(
      out,
      [P(x, y0, west), P(x, y0, east)],
      [P(x, y1, west), P(x, y1, east)],
      scale(e, m),
      c.pitched,
      d,
      i,
    );
  for (const [y, n] of [
    [y0, [0, -1, 0]],
    [y1, up],
  ])
    quad(
      out,
      'granite',
      [P(near, y, west), P(far, y, west), P(far, y, east), P(near, y, east)],
      n,
      c.light,
    );
}
function apertureGrid(out, coord, u, v, rows, cols, cut, n, color) {
  for (let i = 0; i < u.length - 1; i++)
    for (let j = 0; j < v.length - 1; j++) {
      if (i === cols && j === rows && cut) continue;
      const a = u[i],
        b = u[i + 1],
        c1 = v[j],
        d = v[j + 1];
      quad(out, 'granite', [coord(a, c1), coord(b, c1), coord(b, d), coord(a, d)], n, color);
    }
}
function gnomon(out, d) {
  const z = gnomonWidth / 2;
  lowStone(out, (x, y, z) => [x, y, z], 0.6604, y0, -0.64135, 0.64135, y0 - layout.foundationDepth);
  const yb = 1.49,
    yt = 1.59,
    halfSlot = 0.265;
  for (const s of [-1, 1]) {
    const P = (z, y) => [s * G, y, z];
    apertureGrid(
      out,
      P,
      [-z, -halfSlot, halfSlot, z],
      [y0, yb, yt, y1],
      1,
      1,
      true,
      [s, 0, 0],
      c.face,
    );
  }
  for (const m of [-1, 1]) {
    quad(
      out,
      'granite',
      [
        [-G, yb, m * halfSlot],
        [G, yb, m * halfSlot],
        [G, yt, m * halfSlot],
        [-G, yt, m * halfSlot],
      ],
      [0, 0, -m],
      c.underside,
    );
    const y = m === 1 ? yb : yt;
    quad(
      out,
      'granite',
      [
        [-G, y, -halfSlot],
        [G, y, -halfSlot],
        [G, y, halfSlot],
        [-G, y, halfSlot],
      ],
      [0, m, 0],
      c.underside,
    );
  }
  const radius = 0.052,
    n = d <= 1 ? 8 : d === 2 ? 12 : 24;
  const height = { 1: 2.08, '-1': 2.08 + 2 * z * Math.tan((layout.anchor[1] * Math.PI) / 180) };
  const ring = (s) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * tau + Math.PI / 4;
      return [Math.cos(a) * radius, height[s] + Math.sin(a) * radius, s * z];
    });
  const front = ring(1),
    rear = ring(-1);
  for (const [s, ring] of [
    [1, front],
    [-1, rear],
  ]) {
    const y = height[s],
      low = y - 0.145,
      high = y + 0.145;
    apertureGrid(
      out,
      (x, y) => [x, y, s * z],
      [-G, G],
      [y0, low, high, y1],
      1,
      0,
      true,
      [0, 0, s],
      c.pitched,
    );
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ring[i],
        b = ring[j],
        offset = (p) =>
          scale([p[0], p[1] - y, 0], 0.145 / Math.max(Math.abs(p[0]), Math.abs(p[1] - y)));
      const project = (p) => plus([0, y, s * z], offset(p));
      quad(out, 'granite', [a, b, project(b), project(a)], [0, 0, s], c.pitched);
    }
    for (const [x0, x1] of [
      [-G, -0.145],
      [0.145, G],
    ])
      quad(
        out,
        'granite',
        [
          [x0, low, s * z],
          [x1, low, s * z],
          [x1, high, s * z],
          [x0, high, s * z],
        ],
        [0, 0, s],
        c.pitched,
      );
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const center = [0, height[1], z],
      n0 = plus(center, scale(plus(front[i], front[j]), -0.5));
    quad(out, 'granite', [front[i], front[j], rear[j], rear[i]], n0, c.underside);
  }
}
function cap(out, d) {
  const x = faces.width / 2,
    z = capLength / 2,
    b = y1,
    t = b + faces.thickness;
  const bore = [0.513, -0.103],
    radius = capHoleDiameter / 2;
  const corners = [
    [-x, -z],
    [-x, z],
    [x, z],
    [x, -z],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = corners[i],
      p = corners[j],
      N = [a[1] - p[1], 0, p[0] - a[0]];
    const P = (u, v) => [mix(a[0], p[0], u), v, mix(a[1], p[1], u)];
    unevenFace(
      out,
      [P(0, b), P(1, b)],
      [P(0, t), P(1, t)],
      scale(N, 1 / Math.hypot(...N)),
      c.pitched,
      d,
      i + 12,
      0.009,
    );
    if (d >= 1) {
      for (let j = 0; j < 2; j++)
        for (let k = 0; k < (i % 2 ? 19 : 23); k++) {
          const u = 0.1 + (k * 0.8) / (i % 2 ? 19 : 23),
            v = t - 0.143 - j * 0.149;
          const q = (u, v) => plus(P(u, v), scale(N, 0.007 / Math.hypot(...N)));
          stroke(
            out,
            q,
            N,
            u,
            v - 0.04,
            u + 0.008 + (k % 3) * 0.003,
            v + 0.052,
            0.005,
            c.lettering,
          );
          if (d >= 2)
            stroke(out, q, N, u + 0.009, v - 0.02, u + 0.018, v + 0.012, 0.0044, c.lettering);
        }
    }
  }
  const n = d === 0 ? 8 : d === 1 ? 8 : d === 2 ? 16 : 24;
  const around = Array.from({ length: n }, (_, i) => (i / n) * tau);
  const point = (y, a, r) => [bore[0] + Math.cos(a) * r, y, bore[1] + Math.sin(a) * r];
  const contour = (y, a) => {
    const u = Math.cos(a),
      v = Math.sin(a);
    const f = Math.min(
      (u >= 0 ? x - bore[0] : -x - bore[0]) / u,
      (v >= 0 ? z - bore[1] : -z - bore[1]) / v,
    );
    return point(y, a, f);
  };
  for (const [y, N, col] of [
    [b, [0, -1, 0], c.underside],
    [t, up, c.light],
  ]) {
    const section = around
      .concat(corners.map(([x, z]) => (Math.atan2(z - bore[1], x - bore[0]) + tau) % tau))
      .sort((a, b) => a - b);
    for (let i = 0; i < section.length; i++) {
      const a = section[i],
        a1 = section[(i + 1) % section.length];
      quad(
        out,
        'granite',
        [point(y, a, radius), contour(y, a), contour(y, a1), point(y, a1, radius)],
        N,
        col,
      );
    }
  }
  for (let i = 0; i < n; i++) {
    const a = around[i],
      a1 = around[(i + 1) % n],
      a0 = a + Math.PI / n;
    quad(
      out,
      'granite',
      [point(b, a, radius), point(t, a, radius), point(t, a1, radius), point(b, a1, radius)],
      [-Math.cos(a0), 0, -Math.sin(a0)],
      c.underside,
    );
  }
}
function site(out, d) {
  const { apron, plaque } = layout;
  const center = [0, 0.276, 0];
  for (let i = 0; i < apron.length; i++)
    triangle(out, 'gravel', [center, apron[i], apron[(i + 1) % apron.length]], up, c.grit);
  const { x, z, y, width: w, length: l } = plaque;
  box(out, 'granite', [x - w / 2, y - 0.32, z - l / 2], [x + w / 2, y, z + l / 2], c.tablet);
  if (d === 0) return;
  const P = (u, v) => [x + u, y + 0.001, z + v];
  for (const s of [-1, 1])
    for (let j = 0; j < 9; j++)
      for (let k = 0; k < 13; k++) {
        if ((j + k) % 7 === 0) continue;
        const u = s * 0.49 - 0.33 + k * 0.053,
          v = -0.57 + j * 0.056;
        stroke(out, P, up, u, v - 0.017, u + 0.022, v + 0.015, 0.005, c.lettering);
      }
  const a = 0.48;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      stroke(
        out,
        P,
        up,
        sx * 0.065,
        0.51 + sz * 0.06,
        sx * a,
        0.51 + sz * 0.29,
        0.012,
        c.lettering,
      );
  const title = 'THE GEORGIA GUIDESTONES';
  const outlines = {
    A: [
      [0, 0, 0.5, 1],
      [0.5, 1, 1, 0],
      [0.22, 0.43, 0.78, 0.43],
    ],
    D: [
      [0, 0, 0, 1],
      [0, 1, 0.75, 1],
      [0.75, 1, 1, 0.76],
      [1, 0.76, 1, 0.25],
      [1, 0.25, 0.75, 0],
      [0.75, 0, 0, 0],
    ],
    E: [
      [1, 1, 0, 1],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0.49, 0.79, 0.49],
    ],
    G: [
      [0.96, 0.91, 0.72, 1],
      [0.72, 1, 0.27, 1],
      [0.27, 1, 0, 0.77],
      [0, 0.77, 0, 0.23],
      [0, 0.23, 0.27, 0],
      [0.27, 0, 0.74, 0],
      [0.74, 0, 0.98, 0.2],
      [0.98, 0.2, 0.98, 0.5],
      [0.98, 0.5, 0.52, 0.5],
    ],
    H: [
      [0, 0, 0, 1],
      [0, 0.49, 1, 0.49],
      [1, 0, 1, 1],
    ],
    I: [[0.5, 0, 0.5, 1]],
    N: [
      [0, 0, 0, 1],
      [0, 1, 1, 0],
      [1, 0, 1, 1],
    ],
    O: [
      [0.22, 0, 0.78, 0],
      [0.78, 0, 1, 0.23],
      [1, 0.23, 1, 0.77],
      [1, 0.77, 0.78, 1],
      [0.78, 1, 0.22, 1],
      [0.22, 1, 0, 0.77],
      [0, 0.77, 0, 0.23],
      [0, 0.23, 0.22, 0],
    ],
    R: [
      [0, 0, 0, 1],
      [0, 1, 0.77, 1],
      [0.77, 1, 1, 0.78],
      [1, 0.78, 0.77, 0.52],
      [0.77, 0.52, 0, 0.52],
      [0.48, 0.52, 1, 0],
    ],
    S: [
      [1, 0.89, 0.75, 1],
      [0.75, 1, 0.25, 1],
      [0.25, 1, 0, 0.78],
      [0, 0.78, 0.23, 0.5],
      [0.23, 0.5, 0.78, 0.5],
      [0.78, 0.5, 1, 0.25],
      [1, 0.25, 0.75, 0],
      [0.75, 0, 0.25, 0],
      [0.25, 0, 0, 0.11],
    ],
    T: [
      [0, 1, 1, 1],
      [0.5, 1, 0.5, 0],
    ],
    U: [
      [0, 1, 0, 0.2],
      [0, 0.2, 0.25, 0],
      [0.25, 0, 0.75, 0],
      [0.75, 0, 1, 0.2],
      [1, 0.2, 1, 1],
    ],
  };
  for (let j = 0; j < title.length; j++) {
    const x = (j - title.length / 2) * 0.082;
    for (const [a, b, h, k] of outlines[title[j]] ?? [])
      stroke(
        out,
        P,
        up,
        x + a * 0.063,
        -0.87 - b * 0.114,
        x + h * 0.063,
        -0.87 - k * 0.114,
        0.0045,
        c.lettering,
      );
  }
}
function build(out, d) {
  site(out, d);
  for (const [i, row] of positions.entries()) upright(out, row, d, i);
  gnomon(out, d);
  cap(out, d);
}
export const buildSkyline = (out) => build(out, 0);
export const buildDistrict = (out) => build(out, 1);
export const buildStreet = (out) => build(out, 2);
export const buildCloseup = (out) => build(out, 3);
export const buildMaster = (out) => build(out, 4);
export function buildTowerLevel(out, level) {
  const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
  build(out, levels[level]);
}

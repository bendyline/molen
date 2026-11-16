/** Photo-matched sculptural arch, modeled in the signed highway frame. */
import { readFileSync } from 'node:fs';
import {
  beam,
  chamferedRectangle,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { box } from '../../../../../../../../packages/worldgen/scripts/structure-mesh.mjs';
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  granite: { slot: 'wall', graph: 'stone_granite', roughness: 0.87 },
  footing: { slot: 'foundation', graph: 'stone_limestone_raw', roughness: 0.96 },
  bronze: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.71, metallic: 0.47 },
  paving: { slot: 'roof', graph: 'concrete_panel', roughness: 0.93 },
};
const colors = {
  granite: [0.75, 0.708, 0.626],
  edge: [0.843, 0.793, 0.714],
  shade: [0.61, 0.58, 0.522],
  bed: [0.62, 0.592, 0.531],
  dark: [0.46, 0.419, 0.349],
  bronze: [0.425, 0.294, 0.203],
  relief: [0.53, 0.361, 0.236],
  gold: [0.635, 0.448, 0.275],
  paving: [0.585, 0.576, 0.54],
};
const v = (p, q, t) => p.map((s, i) => s + (q[i] - s) * t);
const up = [0, 1, 0],
  tau = 2 * Math.PI;
const phase = (i, j) => ((i * 109 + j * 83 + 47) % 127) / 126;

function face(out, slot, points, normal, color) {
  let n = normalFor(...points);
  if (n.reduce((s, v, i) => s + v * normal[i], 0) < 0) {
    points = points.toReversed();
    n = n.map((x) => -x);
  }
  if (points.length === 3) out.addTriangle(slot, '', points, n, undefined, color);
  else out.addQuad(slot, '', points, n, undefined, color);
}
function smoothTriangle(out, points, normals, color) {
  const average = normals[0].map((_, axis) => normals.reduce((sum, n) => sum + n[axis], 0));
  const length = Math.hypot(...average);
  out.addTriangle(
    'granite',
    '',
    points,
    average.map((v) => v / length),
    undefined,
    color,
  );
}
function cutBlock(out, slot, [x, y, z], w, h, d, c, chamfer = 0.13) {
  const rings = [y, y + h].map((t) => chamferedRectangle(x, t, z, w, d, chamfer));
  loft(out, slot, rings, colors[c]);
}
function section(y, left, right, rise, back, folds, sign) {
  const x = (f) => sign * (left + (right - left) * f);
  const z = (f) => back * (Math.sin(Math.PI * f) * 0.25 + 0.75);
  const front = folds.map(([f, relief]) => [x(f), y + f * rise, z(f) + relief]);
  const rear = folds.toReversed().map(([f, relief]) => [x(f), y + f * rise, -z(f) - relief * 0.72]);
  return sign === 1 ? front.concat(rear) : front.concat(rear).toReversed();
}
const skirts = [
  [1.11, 11.15, 28.1, 0, 3.36],
  [2.4, 11.28, 27.65, 0, 3.21],
  [4.15, 11.51, 26.18, 0.04, 3.1],
  [7.1, 12.3, 23.37, 0.08, 2.83],
  [10.45, 13.5, 20.1, 0.11, 2.45],
  [13.85, 14.45, 17.32, 0.05, 1.98],
  [17.5, 14.78, 15.96, 0.04, 1.58],
  [18.6, 14.92, 16.88, 0.04, 1.41],
];
const skirtFull = [
  [0, -0.22],
  [0.086, 0.09],
  [0.143, 0.07],
  [0.19, -0.28],
  [0.242, 0.21],
  [0.34, 0.12],
  [0.47, 0.22],
  [0.51, -0.31],
  [0.55, 0.32],
  [0.7, 0.19],
  [0.77, -0.19],
  [0.84, 0.18],
  [1, -0.25],
];
const skirtLow = [
  [0, -0.12],
  [0.24, 0.13],
  [0.5, -0.22],
  [0.7, 0.19],
  [1, -0.19],
];
function garment(out, s, d) {
  const folds = d === 0 ? skirtLow.filter((_, i) => i % 2 === 0) : d === 1 ? skirtLow : skirtFull,
    rows = d === 0 ? skirts.filter((_, i) => i % 2 === 0 || i === skirts.length - 1) : skirts;
  const skirt = rows.map(([y, a, b, r, z]) => section(y, a, b, r, z, folds, s));
  if (d < 2) {
    loft(out, 'granite', skirt, colors.granite);
  } else {
    for (let j = 1; j < skirt.length; j++) {
      const lo = skirt[j - 1],
        hi = skirt[j];
      const rows = Math.max(2, Math.ceil((hi[0][1] - lo[0][1]) / (d === 2 ? 0.86 : 0.49)));
      for (let i = 0; i < lo.length; i++) {
        const next = (i + 1) % lo.length;
        const columns = Math.max(
          1,
          Math.ceil(
            Math.hypot(lo[next][0] - lo[i][0], lo[next][2] - lo[i][2]) / (d === 2 ? 1.56 : 0.89),
          ),
        );
        const normal = normalFor(lo[i], lo[next], hi[next]);
        const sample = (x, y) => v(v(lo[i], lo[next], x), v(hi[i], hi[next], x), y);
        for (let row = 0; row < rows; row++) {
          const a = row / rows,
            b = (row + 1) / rows,
            sh = 0.003;
          for (let col = 0; col < columns; col++) {
            const c = col / columns,
              e = (col + 1) / columns;
            const color = colors.granite.map(
              (x) => x * (0.955 + phase(col + i * 3, row + j * 7) * 0.084),
            );
            face(
              out,
              'granite',
              [sample(c, a), sample(e, a), sample(e, b), sample(c, b)],
              normal,
              color,
            );
          }
          if (d >= 3) {
            const p0 = sample(0, b - sh).map((x, j) => x + normal[j] * 0.004),
              p1 = sample(1, b - sh).map((x, j) => x + normal[j] * 0.004);
            const p2 = sample(1, b).map((x, j) => x + normal[j] * 0.004),
              p3 = sample(0, b).map((x, j) => x + normal[j] * 0.004);
            face(out, 'granite', [p0, p1, p2, p3], normal, colors.shade);
          }
        }
      }
    }
  }
  const upper = [
    [17.72, 14.42, 16.04, 0.16, 1.4],
    [18.84, 13.63, 16.72, 0.28, 1.61],
    [20.05, 13.26, 16.69, 0.31, 1.49],
    [21.6, 13.62, 16.43, 0.1, 1.22],
  ];
  loft(
    out,
    'granite',
    upper.map(([y, a, b, r, z]) =>
      section(y, a, b, r, z, d === 0 ? skirtLow.filter((_, i) => i % 2 === 0) : skirtLow, s),
    ),
    colors.edge,
  );
  if (d < 2) return;
  for (const side of [-1, 1]) {
    for (const f of [0.18, 0.48, 0.77]) {
      const points = rows
        .slice(0, -1)
        .map(([y, a, b, r, z]) => [
          s * (a + (b - a) * f),
          y + f * r,
          side * (z * (Math.sin(Math.PI * f) * 0.25 + 0.75) - 0.18),
        ]);
      for (let j = 0; j < points.length - 1; j++)
        beam(out, 'granite', points[j], points[j + 1], 0.045, 0.044, colors.shade);
    }
  }
}
function prismPath(out, slot, path, profile, material) {
  const rings = path.map(([x, y, z, w, h]) => profile.map(([u, v]) => [x, y + u * h, z + v * w]));
  loft(out, slot, rings, colors[material]);
}
const oval = (n) =>
  Array.from({ length: n }, (_, i) => [Math.cos((i / n) * tau), Math.sin((i / n) * tau)]);
function arms(out, s, d) {
  const facets = d === 0 ? 4 : d === 1 ? 6 : 12;
  const p = oval(facets);
  // Squared upper contour and lowered inner sleeves follow the carved granite drapery.
  const arm = [
    [15.42, 20, 0.3, 1.32, 1.5],
    [13.13, 20.12, 0.36, 1.37, 1.39],
    [10.55, 20.66, 0.42, 1.32, 1.28],
    [7.5, 21.37, 0.52, 1.18, 1.28],
    [5.21, 22.28, 0.52, 0.94, 1.07],
    [3.38, 23.21, 0.39, 0.72, 0.79],
    [2.03, 23.89, 0.33, 0.52, 0.5],
    [1.25, 24.08, 0.2, 0.43, 0.31],
  ];
  const second = [
    [14.76, 19.75, -0.51, 0.98, 1.14],
    [12.48, 19.87, -0.56, 0.94, 1.05],
    [9.2, 20.3, -0.61, 0.79, 1.01],
    [6.0, 20.9, -0.7, 0.69, 1.05],
    [3.49, 21.57, -0.49, 0.53, 1.23],
    [2.21, 22.12, -0.29, 0.48, 1.15],
    [1.19, 23.3, -0.16, 0.4, 0.64],
  ];
  const orient = (rows) => rows.map(([x, y, z, w, h]) => [s * x, y, s * z, w, h]);
  const profile = p;
  const sparse = (rows) =>
    d === 0 ? rows.filter((_, i) => i % 2 === 0 || i === rows.length - 1) : rows;
  prismPath(out, 'granite', orient(sparse(arm)), profile, 'edge');
  prismPath(out, 'granite', orient(sparse(second)), profile, 'granite');
  if (d === 0) return;
  for (const rows of [arm, second]) {
    const [x, y, z, w] = rows.at(-1),
      count = d === 1 ? 3 : 4;
    for (let i = 0; i < count; i++) {
      const a = x - (i % 2) * 0.08,
        b = y + (i - 1.5) * 0.13,
        c = s * (z + (i - count / 2) * w * 0.26);
      const end = [s * (a - 0.65 - (i % 2) * 0.16), b + 0.075, c];
      beam(out, 'granite', [s * a, b, c], end, 0.19, 0.17, colors.edge);
    }
  }
}
function head(out, s, d) {
  const center = 15.15;
  const rows = [
    [21.14, 0.54, 0.49, -0.03],
    [22.36, 0.59, 0.57, -0.04],
    [22.79, 0.78, 0.69, -0.08],
    [23.08, 0.93, 0.69, -0.12],
    [23.43, 0.95, 0.72, -0.2],
    [23.55, 1.04, 0.73, -0.19],
    [23.76, 1.02, 0.77, -0.17],
    [23.94, 1.08, 0.79, -0.19],
    [24.08, 1.01, 0.78, -0.14],
    [24.21, 1.12, 0.79, -0.18],
    [24.45, 1.02, 0.79, -0.08],
    [24.8, 0.81, 0.71, 0.07],
    [25.1, 0.54, 0.52, 0.23],
    [25.26, 0.23, 0.27, 0.29],
  ];
  const n = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 24 : d === 3 ? 32 : 40;
  const points = (rows, features) =>
    rows.map(([y, xr, zr, offset], j) =>
      radialRing(y, xr, zr, n, [s * (center + offset), 0]).map((p, i) => {
        const frontal = s * p[0] < center + offset;
        if (features && frontal) {
          const across = Math.max(0, 1 - Math.abs(p[2]) / (zr * 0.49));
          const nose = y >= 23.76 && y <= 24.08 ? Math.max(0, 1 - Math.abs(y - 23.94) / 0.23) : 0;
          const lips = y >= 23.43 && y <= 23.55 ? 0.09 : 0;
          p[0] -= s * (0.28 * nose + lips) * across;
        }
        if (features && d >= 2 && s * p[0] > center + 0.3) p[0] += s * (phase(i, j) - 0.36) * 0.071;
        return p;
      }),
    );
  const shape = points(
    d === 0 ? rows.filter((_, i) => i % 3 === 0 || i === rows.length - 1) : rows,
    true,
  );
  const normals = shape.map((ring, j) =>
    ring.map((p, i) => {
      const a = ring[(i + n - 1) % n],
        b = ring[(i + 1) % n],
        c = shape[Math.min(j + 1, shape.length - 1)][i],
        e = shape[Math.max(0, j - 1)][i];
      const n0 = normalFor(
        p,
        p.map((x, k) => x + c[k] - e[k]),
        p.map((x, k) => x + b[k] - a[k]),
      );
      const radial = [p[0] - s * center, 0, p[2]];
      return n0.reduce((sum, v, i) => sum + v * radial[i], 0) < 0 ? n0.map((v) => -v) : n0;
    }),
  );
  for (let j = 1; j < shape.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        a = shape[j - 1][i],
        b = shape[j - 1][k],
        c = shape[j][k],
        e = shape[j][i];
      const normal = [a[0] + b[0] + c[0] + e[0] - 4 * s * center, 0, a[2] + b[2] + c[2] + e[2]];
      for (const points of [
        [a, b, c],
        [a, c, e],
      ]) {
        if (d < 2) face(out, 'granite', points, normal, colors.edge);
        else {
          const [na, nb, nc, ne] = [
            normals[j - 1][i],
            normals[j - 1][k],
            normals[j][k],
            normals[j][i],
          ];
          smoothTriangle(out, points, points[1] === b ? [na, nb, nc] : [na, nc, ne], colors.edge);
        }
      }
    }
  for (const [ring, normal] of [
    [shape[0], [0, -1, 0]],
    [shape.at(-1), up],
  ])
    for (let i = 0; i < n; i++)
      face(
        out,
        'granite',
        [[s * center, ring[0][1], 0], ring[i], ring[(i + 1) % n]],
        normal,
        colors.edge,
      );
  const hair = [
    [22.03, 0.21, 0.24, 0.81],
    [22.22, 0.43, 0.45, 0.91],
    [22.63, 0.53, 0.51, 0.92],
    [23.05, 0.42, 0.47, 0.9],
    [23.47, 0.24, 0.27, 0.84],
  ];
  if (d >= 1) loft(out, 'granite', points(hair, false), colors.granite);
  if (d < 2) return;
  for (const [k, z] of [-0.51, 0.51].entries()) {
    const n = d === 2 ? 7 : 11,
      ear = radialRing(0, 0.22, 0.12, n);
    const rings = [0.01, 0.102, 0.143].map((r, i) =>
      ear.map(([x, , y]) => [
        s * (center + x * (1 - i * 0.18) + 0.26),
        23.65 + y * 1.7,
        s * (z + (k ? 1 : -1) * r),
      ]),
    );
    loft(out, 'granite', k ? rings : rings.map((r) => r.toReversed()), colors.granite, {
      cap: false,
    });
    // The sculpted eye and the parted lips sit in the inner facial profile.
    beam(
      out,
      'granite',
      [s * (center - 0.67), 24.11, z * 0.88],
      [s * (center - 0.95), 24.08, z * 0.62],
      0.05,
      0.045,
      colors.shade,
    );
    beam(
      out,
      'granite',
      [s * (center - 0.89), 23.44, z * 0.72],
      [s * (center - 1.145), 23.43, z * 0.37],
      0.046,
      0.049,
      colors.shade,
    );
  }
  const locks = d === 2 ? 5 : 9;
  for (let i = 0; i < locks; i++) {
    const az = (i / (locks - 1) - 0.5) * Math.PI * 1.28;
    const chain = [
      [s * (center + 0.58 + 0.18 * Math.cos(az)), 24.85, Math.sin(az) * 0.46],
      [s * (center + 0.75 + 0.115 * Math.cos(az)), 24.39, Math.sin(az) * 0.64],
      [s * (center + 0.89 + 0.1 * Math.cos(az)), 23.83, Math.sin(az) * 0.62],
      [s * (center + 1.27 + 0.11 * Math.cos(az)), 22.74, Math.sin(az) * 0.34],
    ];
    for (let j = 0; j < chain.length - 1; j++)
      beam(out, 'granite', chain[j], chain[j + 1], 0.067, 0.046, colors.shade);
  }
}
function sectionPolygon(out, poly, n, z, slot, c) {
  // The trace is star-shaped about its supplied center and follows the source silhouette.
  const ctr = poly[0];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i],
      b = poly[i === poly.length - 1 ? 1 : i + 1];
    face(
      out,
      slot,
      [
        [ctr[0], ctr[1], z],
        [a[0], a[1], z],
        [b[0], b[1], z],
      ],
      n,
      colors[c],
    );
  }
}
const peninsula = [
  [0, 27.4],
  [0.12, 28.18],
  [0.87, 29.28],
  [1.18, 29.36],
  [1.02, 29.06],
  [1.2, 28.82],
  [0.96, 28.49],
  [0.68, 28.31],
  [0.48, 27.96],
  [0.26, 27.84],
  [0.51, 27.55],
  [0.63, 27.23],
  [0.52, 26.83],
  [0.09, 26.64],
  [-0.38, 26.6],
  [-0.44, 26.85],
  [-0.33, 27.1],
  [-0.54, 27.35],
  [-0.65, 27.52],
  [-0.4, 27.63],
  [-0.64, 27.79],
  [-0.85, 28.02],
  [-0.64, 28.25],
  [-0.2, 28.31],
  [-0.085, 28.63],
  [0.16, 28.67],
];
function emblem(out, d) {
  const r = layout.dimensions.medallionRadius,
    y = 30 - r,
    n = d === 0 ? 12 : d === 1 ? 24 : d === 2 ? 54 : d === 3 ? 72 : 90;

  const rim = (z, radius) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * tau;
      return [r * Math.cos(a) * radius, y + r * Math.sin(a) * radius, z];
    });
  const lo = rim(-0.48, 1),
    hi = rim(0.48, 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      N = [lo[i][0] + lo[j][0], lo[i][1] + lo[j][1] - 2 * y, 0];
    face(out, 'granite', [lo[i], lo[j], hi[j], hi[i]], N, colors.granite);
  }
  for (const s of [-1, 1]) {
    const ring = rim(s * 0.48, 1),
      lip = rim(s * 0.548, 0.96),
      faceRing = rim(s * 0.535, 0.942),
      normal = [0, 0, s];
    for (let j = 0; j < n; j++) {
      const k = (j + 1) % n;
      if (d >= 1) face(out, 'granite', [ring[j], ring[k], lip[k], lip[j]], normal, colors.edge);
      if (d >= 1)
        face(out, 'bronze', [lip[j], lip[k], faceRing[k], faceRing[j]], normal, colors.gold);
      const disk = d === 0 ? ring : faceRing;
      face(out, 'granite', [[0, y, s * 0.535], disk[j], disk[k]], normal, colors.edge);
    }
    sectionPolygon(
      out,
      peninsula.map(([x, y]) => [s * x, y]),
      normal,
      s * 0.571,
      'bronze',
      'relief',
    );
    if (d >= 1) cutBlock(out, 'granite', [0, 24.55, s * 0.49], 4.48, 0.78, 0.16, 'edge', 0.07);
    if (d >= 1)
      for (let j = 0; j < 5; j++) {
        const x = (j - 2) * 0.81;
        for (let k = 0; k < 4; k++) {
          const y = 24.78 + k * 0.149;
          beam(
            out,
            'bronze',
            [x - 0.25, y, s * 0.585],
            [x + 0.25, y + 0.064 * (k % 2), s * 0.585],
            0.064,
            0.063,
            colors.bronze,
          );
        }
        beam(
          out,
          'bronze',
          [x - 0.19, 24.72, s * 0.585],
          [x - 0.19, 25.27, s * 0.585],
          0.062,
          0.055,
          colors.bronze,
        );
      }
  }
  box(out, 'granite', [-1.71, 23.65, -0.58], [1.71, 25.13, 0.58], colors.edge);
}
function relief(out, s, d) {
  const cx = s * 24.7;
  if (d === 0)
    box(out, 'granite', [cx - 5.375, 1.11, 4.36], [cx + 5.375, 5.14, 5.94], colors.granite);
  else cutBlock(out, 'granite', [cx, 1.11, 5.15], 10.75, 4.03, 1.58, 'granite', 0.12);
  const profile = [
    [-5, 1.42],
    [-4.84, 2.89],
    [-4, 3.5],
    [-3.6, 4.84],
    [-0.14, 4.89],
    [1.12, 4.57],
    [3.39, 3.79],
    [4.89, 3.18],
    [5, 1.42],
  ];
  sectionPolygon(
    out,
    [[0, 2.48], ...profile].map(([x, y]) => [cx + s * x, y]),
    [0, 0, 1],
    5.958,
    'bronze',
    'bronze',
  );
  if (d === 0) return;
  const shapes = [
    [-3.73, 2.14, 0.64, 1.73, 0.38],
    [-2.63, 2.0, 0.55, 1.83, 0.32],
    [-1.29, 2.35, 0.87, 2.24, 0.26],
    [-0.04, 2.32, 0.62, 1.87, 0.21],
    [1.11, 2.04, 0.57, 1.54, 0.24],
    [2.11, 2.03, 0.55, 1.34, 0.16],
    [3.27, 1.96, 0.52, 1.23, 0.16],
  ];
  const n = d === 1 ? 4 : d === 2 ? 10 : d === 3 ? 14 : 18;
  for (const [i, [x, y, w, h, lean]] of shapes.entries()) {
    const p = [cx + s * x, 0, 6.01],
      to = (x, y, z = 0) => [p[0] + s * x, y, p[2] + z];
    const folds = (yy, rx, rz, x, z) => radialRing(yy, rx, rz, n, [p[0] + s * x, p[2] + z]);
    loft(
      out,
      'bronze',
      [
        folds(y, w * 0.66, 0.16, 0, 0.05),
        folds(y + h * 0.32, w * 0.89, 0.29, lean * 0.32, 0.1),
        folds(y + h * 0.66, w * 0.58, 0.24, lean * 0.6, 0.1),
        folds(y + h * 0.71, w * 0.3, 0.12, lean * 0.66, 0.1),
      ],
      colors[i % 3 ? 'relief' : 'bronze'],
    );
    loft(
      out,
      'bronze',
      [
        folds(y + h * 0.69, w * 0.19, 0.126, lean, 0.15),
        folds(y + h * 0.81, w * 0.39, 0.184, lean, 0.19),
        folds(y + h * 0.96, w * 0.31, 0.166, lean + 0.09, 0.18),
        folds(y + h, w * 0.15, 0.076, lean + 0.14, 0.12),
      ],
      colors.relief,
    );
    if (d >= 2) {
      const up = i % 3 !== 1,
        tip = to(lean + s * 0.98, y + h * (up ? 1.04 : 0.48), 0.21),
        elbow = to(lean + s * 0.73, y + h * 0.5, 0.31);
      beam(
        out,
        'bronze',
        to(lean * 0.7, y + h * 0.63, 0.18),
        elbow,
        w * 0.28,
        w * 0.27,
        colors.relief,
      );
      beam(out, 'bronze', elbow, tip, w * 0.24, w * 0.24, colors.relief);
    }
  }
}
function base(out, s, d) {
  const C = s * 20.55,
    depth = layout.foundationDepth,
    top = s === 1 ? 2.23 : 1.13;
  const detailed = d >= 2 ? 15 : 3;
  if (d === 0) box(out, 'footing', [C - 10.2, depth, -5.9], [C + 10.2, top, 5.9], colors.bed);
  else cutBlock(out, 'footing', [C, depth, 0], 20.4, top - depth, 11.8, 'bed', 0.31);
  for (let j = 1; j < detailed; j++) {
    const x = C - 10.2 + (j * 20.4) / detailed;
    if (d >= 1)
      for (const z of [-5.912, 5.912]) {
        face(
          out,
          'footing',
          [
            [x - 0.032, 0.38, z],
            [x + 0.032, 0.38, z],
            [x + 0.032, top, z],
            [x - 0.032, top, z],
          ],
          [0, 0, Math.sign(z)],
          colors.dark,
        );
      }
  }
  box(out, 'paving', [s * 24.8 - 5.6, -0.32, 5.93], [s * 24.8 + 5.6, 0.37, 10.27], colors.paving);
  if (d >= 1)
    for (let i = 0; i < 4; i++)
      box(
        out,
        'paving',
        [s * 24.8 - 3.4, 0.08 + i * 0.15, 9.38 - i * 0.44],
        [s * 24.8 + 3.4, 0.26 + i * 0.15, 10.1 - i * 0.44],
        colors.paving,
      );
  relief(out, s, d);
  if (d >= 1) {
    const doorX = s * 28.7;
    box(out, 'bronze', [doorX - 0.82, 1.14, -5.936], [doorX + 0.82, 3.9, -5.92], colors.bronze);
    if (d >= 2)
      beam(out, 'bronze', [doorX, 1.22, -5.971], [doorX, 3.88, -5.971], 0.027, 0.028, colors.gold);
  }
}
function build(out, d) {
  for (const sign of [-1, 1]) {
    base(out, sign, d);
    garment(out, sign, d);
    arms(out, sign, d);
    head(out, sign, d);
  }
  emblem(out, d);
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

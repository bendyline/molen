/** Original measured-envelope Bierpinsel exterior, photographed September 2026. */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing } from './authored-structure-mesh.mjs';
import { face, transform, triangle } from './heritage-tower-detail-mesh.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const mapBytes = readFileSync(structureSourcePath('n0614_bierpinsel', 'map-frame.json'));
const map = JSON.parse(mapBytes);
const pale = [0.76, 0.75, 0.67],
  white = [0.84, 0.84, 0.77],
  gray = [0.39, 0.41, 0.4];
const black = [0.07, 0.085, 0.095],
  glass = [0.1, 0.18, 0.22],
  orange = [0.66, 0.3, 0.19];
const cyan = [0.16, 0.62, 0.74],
  yellow = [0.75, 0.67, 0.4],
  violet = [0.41, 0.32, 0.51];
const pi = Math.PI;

function line(out, slot, points, width, color) {
  for (let i = 1; i < points.length; i++)
    beam(out, slot, points[i - 1], points[i], width, width, color);
}
function ellipse(out, cx, cy, rx, ry, z, color) {
  for (let i = 0; i < 48; i++) {
    const a = (i * pi) / 24,
      b = ((i + 1) * pi) / 24;
    triangle(
      out,
      'metal',
      [
        [cx, cy, z],
        [cx + rx * Math.cos(a), cy + ry * Math.sin(a), z],
        [cx + rx * Math.cos(b), cy + ry * Math.sin(b), z],
      ],
      color,
    );
  }
}
function radial(out, a) {
  return transform(out, pi / 2 - a);
}
const profile = [
  [19.3, 7.1],
  [20.0, 8.1],
  [24.6, 11.5],
  [25.2, 11.77],
  [29.5, 11.77],
  [30.15, 11.57],
  [30.65, 10.72],
  [34.75, 10.72],
  [35.35, 10.48],
  [35.8, 9.6],
  [39.9, 9.6],
];
function radius(y) {
  const n = profile.findIndex((v) => v[0] >= y);
  if (n <= 0) return profile[0][1];
  const a = profile[n - 1],
    b = profile[n];
  return a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
}
const openings = [
  [21.55, 24.05, 1.52],
  [27.85, 29.25, 1.59],
  [32.85, 34.45, 1.55],
];
function muralColor(index, u, y) {
  if (index === 0 || index === 8) return y > 25 ? white : black;
  const wave = 25.1 + 0.75 * Math.cos(u * 1.6 + index * 0.7);
  if (y < wave) return black;
  if (index === 3) return y > 30 ? white : black;
  if (index === 6) return y > 30.7 ? black : white;
  return y < 31.0 ? white : Math.sin(index * 1.7 + u * 0.7) > -0.25 ? white : black;
}
function paintedPanel(out, index, points, edge) {
  const boundary = (u) =>
    index === 0 || index === 8 ? 25 : 25.1 + 0.75 * Math.cos(u * 1.6 + index * 0.7);
  for (const sign of [-1, 1]) {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const da = sign * (a[1] - boundary(a[0])),
        db = sign * (b[1] - boundary(b[0]));
      if (da >= 0) result.push(a);
      if (da < 0 !== db < 0) {
        let lo = 0,
          hi = 1;
        for (let k = 0; k < 25; k++) {
          const t = (lo + hi) / 2,
            u = a[0] + (b[0] - a[0]) * t,
            y = a[1] + (b[1] - a[1]) * t;
          if (sign * (y - boundary(u)) < 0 === da < 0) lo = t;
          else hi = t;
        }
        const t = (lo + hi) / 2;
        result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    if (result.length < 3) continue;
    const u = result.reduce((sum, p) => sum + p[0], 0) / result.length;
    const y = result.reduce((sum, p) => sum + p[1], 0) / result.length;
    const color = muralColor(index, u, y + sign * 0.0001);
    const p = result.map(([u, y]) => [u, y, radius(y) - edge(u)]);
    for (let i = 1; i < p.length - 1; i++) {
      const area = Math.abs(
        (result[i][0] - result[0][0]) * (result[i + 1][1] - result[0][1]) -
          (result[i][1] - result[0][1]) * (result[i + 1][0] - result[0][0]),
      );
      if (area > 1e-5) triangle(out, 'metal', [p[0], p[i], p[i + 1]], color);
    }
  }
}

/** Nine aluminum capsules: two upright windows and one outward-sloping window per bay. */
function capsule(out, index, a) {
  const f = radial(out, a),
    w = 1.98;
  const levels = [
    19.3, 20, 21.55, 24.05, 24.6, 25.2, 27.85, 29.25, 29.5, 30.15, 30.65, 32.85, 34.45, 34.75,
    35.35, 35.8,
  ];
  const ys = [
    ...new Set([...levels, ...Array.from({ length: 109 }, (_, i) => 19.3 + i * 0.15)]),
  ].sort((a, b) => a - b);
  for (let j = 1; j < ys.length; j++) {
    const y0 = ys[j - 1],
      y1 = ys[j],
      mid = (y0 + y1) / 2;
    const window = openings.find(([lo, hi]) => mid > lo && mid < hi);
    const slices = 48;
    for (let k = 0; k < slices; k++) {
      const u0 = -w + (2 * w * k) / slices,
        u1 = -w + (2 * w * (k + 1)) / slices,
        u = (u0 + u1) / 2;
      if (window && Math.abs(u) < window[2]) continue;
      const edge = (u) => 0.1 * Math.pow(Math.abs(u) / w, 8);
      paintedPanel(
        f,
        index,
        [
          [u0, y0],
          [u1, y0],
          [u1, y1],
          [u0, y1],
        ],
        edge,
      );
    }
    for (const s of [-1, 1]) {
      const pts = [
        [s * w, y0, 6.7],
        [s * w, y0, radius(y0) - 0.1],
        [s * w, y1, radius(y1) - 0.1],
        [s * w, y1, 6.7],
      ];
      face(
        f,
        'metal',
        s > 0 ? pts : pts.toReversed(),
        index === 3 ? cyan : index === 4 ? yellow : black,
      );
    }
  }
  // Rear shell, floor edge and top keep the asset watertight without covering glazing.
  box(f, 'metal', [-w, 19.3, 6.65], [w, 35.8, 6.7], gray);
  for (const y of [19.3, 35.8])
    face(
      f,
      'metal',
      [
        [-w, y, 6.7],
        [w, y, 6.7],
        [w, y, radius(y)],
        [-w, y, radius(y)],
      ],
      y < 20 ? orange : pale,
    );
  for (const [lo, hi, half] of openings) {
    const z0 = radius(lo),
      z1 = radius(hi);
    face(
      f,
      'glass',
      [
        [-half, lo, z0 - 0.13],
        [half, lo, z0 - 0.13],
        [half, hi, z1 - 0.13],
        [-half, hi, z1 - 0.13],
      ],
      glass,
    );
    line(
      f,
      'metal',
      [
        [-half, lo, z0 + 0.018],
        [half, lo, z0 + 0.018],
        [half, hi, z1 + 0.018],
        [-half, hi, z1 + 0.018],
        [-half, lo, z0 + 0.018],
      ],
      0.085,
      pale,
    );
    const yy = hi - 0.38,
      zz = radius(yy) + 0.026;
    line(
      f,
      'metal',
      [
        [-half, yy, zz],
        [half, yy, zz],
      ],
      0.06,
      pale,
    );
    for (const u of [-half * 0.74, half * 0.74])
      line(
        f,
        'metal',
        [
          [u, yy, zz],
          [u, hi, z1 + 0.025],
        ],
        0.043,
        gray,
      );
    // Deep aluminum reveals and projecting horizontal sill.
    for (const s of [-1, 1])
      face(
        f,
        'metal',
        [
          [s * half, lo, z0 - 0.14],
          [s * half, hi, z1 - 0.14],
          [s * half, hi, z1 + 0.04],
          [s * half, lo, z0 + 0.04],
        ],
        pale,
      );
    beam(
      f,
      'metal',
      [-half - 0.04, lo - 0.06, z0 + 0.11],
      [half + 0.04, lo - 0.06, z0 + 0.11],
      0.13,
      0.2,
      pale,
    );
  }
  // Small mural eye/mouth fields sit on the real capsules, not on photographic billboards.
  if (index !== 3 && index !== 4) {
    const y = 31.58,
      z = radius(y) + 0.021;
    ellipse(f, 0, y, 1.0, 0.33, z, index % 2 ? black : [0.2, 0.37, 0.45]);
    line(
      f,
      'metal',
      Array.from({ length: 25 }, (_, i) => {
        const u = -1.45 + (2.9 * i) / 24;
        return [u, 26.45 - 0.3 * Math.cos(u * 1.4 + index), radius(26.5) + 0.025];
      }),
      0.055,
      index % 2 ? black : gray,
    );
  }
  // Aluminum cassette seams and fasteners follow metric panel divisions.
  for (const y of [20.4, 24.6, 25.2, 26.7, 29.6, 30.6, 31.7, 34.8, 35.65]) {
    line(
      f,
      'metal',
      [
        [-w + 0.035, y, radius(y) + 0.006],
        [w - 0.035, y, radius(y) + 0.006],
      ],
      0.013,
      gray,
    );
    for (const u of [-1.82, 1.82])
      box(
        f,
        'metal',
        [u - 0.025, y - 0.025, radius(y) + 0.008],
        [u + 0.025, y + 0.025, radius(y) + 0.025],
        pale,
      );
  }
  // Ventilated upper floor has separate louvers on every panel, with the mural's broad swirls.
  for (let n = 0; n < 47; n++) {
    const y = 35.95 + n * 0.083;
    const color =
      index % 3 === 0 && y > 37.4
        ? white
        : index === 2 && y > 37.7
          ? orange
          : y > 36.7 + Math.cos(index) * 1.5
            ? white
            : black;
    box(f, 'metal', [-2.48, y, 9.52], [2.48, y + 0.04, 9.68], color);
  }
  box(f, 'metal', [-2.52, 35.77, 9.53], [2.52, 35.93, 9.73], pale);
  box(f, 'metal', [-2.52, 39.87, 9.53], [2.52, 40.02, 9.76], gray);
}

function stairs(out) {
  // The externally exposed dogleg escape stair is independent of the solid elevator spine.
  for (let flight = 0; flight < 6; flight++) {
    const y0 = 6.2 + flight * (14.2 / 6),
      y1 = y0 + 14.2 / 6;
    const forward = flight % 2 === 0,
      x0 = forward ? -9.0 : -3.9,
      x1 = forward ? -3.9 : -9.0;
    const z = flight % 2 === 0 ? 4.25 : 5.95;
    const count = 13;
    for (let j = 0; j < count; j++) {
      const xa = x0 + ((x1 - x0) * j) / count,
        xb = x0 + ((x1 - x0) * (j + 1)) / count,
        y = y0 + ((y1 - y0) * (j + 1)) / count;
      box(
        out,
        'concrete',
        [Math.min(xa, xb) - 0.012, y - 0.22, z - 0.66],
        [Math.max(xa, xb) + 0.012, y, z + 0.66],
        pale,
      );
    }
    for (const zz of [z - 0.77, z + 0.77]) {
      beam(out, 'concrete', [x0, y0 + 0.25, zz], [x1, y1 + 0.25, zz], 0.15, 1.0, pale);
      beam(out, 'metal', [x0, y0 + 1.02, zz], [x1, y1 + 1.02, zz], 0.06, 0.06, gray);
    }
    const landing = forward ? -3.85 : -9.05;
    box(out, 'concrete', [landing - 0.7, y1 - 0.25, 3.43], [landing + 0.7, y1, 6.78], pale);
    for (const z2 of [3.4, 6.79])
      box(
        out,
        'concrete',
        [landing - 0.72, y1, z2 - 0.1],
        [landing + 0.72, y1 + 0.95, z2 + 0.1],
        pale,
      );
  }
  // Lower public stair between pavement and road-level pedestrian landing.
  for (let j = 0; j < 35; j++) {
    const x = -15.1 + j * 0.25,
      y = 0.17 * (j + 1);
    box(out, 'concrete', [x, Math.max(0, y - 0.2), 3.0], [x + 0.27, y, 5.75], pale);
  }
  for (const z of [2.94, 5.8]) {
    beam(out, 'concrete', [-15.1, 0.72, z], [-6.4, 6.58, z], 0.26, 1.0, pale);
    beam(out, 'metal', [-15.0, 1.28, z], [-6.4, 7.09, z], 0.06, 0.06, [0.15, 0.35, 0.5]);
  }
}

function rearWing(out) {
  // Four horizontal strips in the original rectangular services/stair wing.
  box(out, 'metal', [-15.4, 20.4, -6.7], [-5.2, 39.9, 6.7], pale);
  const f = transform(out, -pi / 2, [-15.43, 0, 0]);
  const colors = [
    violet,
    [0.26, 0.65, 0.57],
    white,
    [0.82, 0.73, 0.4],
    white,
    [0.62, 0.36, 0.48],
    white,
    [0.4, 0.61, 0.32],
    cyan,
  ];
  for (let j = 0; j < 9; j++)
    box(f, 'metal', [-6.7, 20.4 + j * 2.17, 0], [6.7, 20.4 + (j + 1) * 2.17, 0.08], colors[j]);
  for (const y of [22.8, 27.3, 31.8, 36.3]) {
    box(f, 'shadow', [-4.65, y - 0.12, 0.09], [4.65, y + 1.13, 0.12], black);
    box(f, 'glass', [-4.45, y, 0.13], [4.45, y + 1.01, 0.15], glass);
    for (let k = 0; k < 8; k++)
      box(f, 'metal', [-4.5 + k * 1.28, y - 0.05, 0.16], [-4.46 + k * 1.28, y + 1.08, 0.23], pale);
    for (const s of [-1, 1])
      box(f, 'glass', [s * 5.8 - 0.39, y, 0.1], [s * 5.8 + 0.39, y + 0.99, 0.15], glass);
  }
  // Windowed side walls; the front merges with the round restaurant floor plate.
  for (const sign of [-1, 1]) {
    const g = transform(out, sign === 1 ? 0 : pi, [-10.25, 0, sign * 6.74]);
    for (let j = 0; j < 9; j++)
      box(
        g,
        'metal',
        [-5.07, 20.4 + j * 2.17, 0],
        [5.07, 20.4 + (j + 1) * 2.17, 0.06],
        colors[(j + 2) % colors.length],
      );
    for (const y of [22.8, 27.3, 31.8, 36.3])
      for (let k = 0; k < 7; k++) {
        box(g, 'glass', [-4.8 + k * 1.37, y, 0.075], [-3.77 + k * 1.37, y + 1.05, 0.1], glass);
        box(g, 'metal', [-4.9 + k * 1.37, y - 0.04, 0.11], [-4.82 + k * 1.37, y + 1.1, 0.16], gray);
      }
  }
  box(out, 'metal', [-15.55, 39.9, -6.84], [-5.15, 40.1, 6.84], [0.57, 0.18, 0.15]);
  box(out, 'metal', [-15.5, 20.2, -6.8], [-5.1, 20.4, 6.8], [0.57, 0.18, 0.15]);
  // Rear rooftop machinery follows the 1979 municipal aerial; no invented spire.
  box(out, 'concrete', [-11.6, 40.02, -2.1], [-6.4, 42.51, 2.1], pale);
  for (let k = 0; k < 24; k++)
    box(out, 'metal', [-11.67, 40.17 + k * 0.086, -2.15], [-11.6, 40.21 + k * 0.086, 2.15], gray);
}

function buildBierpinsel(out) {
  // D-shaped central elevator shaft, split into original fair-faced concrete pours.
  const core = map.core.slice(0, -1);
  loft(
    out,
    'concrete',
    [core.map(([x, z]) => [x, 0, z]), core.map(([x, z]) => [x, 20.6, z])],
    pale,
  );
  for (let j = 0; j < 14; j++) {
    const y = 0.15 + j * 1.44;
    for (let k = 1; k < core.length; k++)
      line(
        out,
        'concrete',
        [
          [core[k - 1][0] + 0.008, y, core[k - 1][1] + 0.008],
          [core[k][0] + 0.008, y, core[k][1] + 0.008],
        ],
        0.017,
        [0.61, 0.61, 0.56],
      );
  }
  // Small street entrance on the rounded stem, with original tiled lower cladding.
  const entry = radial(out, 0);
  box(entry, 'shadow', [-0.68, 0.04, 2.31], [1.61, 2.9, 2.35], black);
  for (let j = 0; j < 2; j++) {
    box(entry, 'glass', [-0.62 + j * 1.1, 0.1, 2.36], [0.41 + j * 1.1, 2.75, 2.39], glass);
    box(entry, 'metal', [-0.66 + j * 1.1, 0.04, 2.4], [-0.6 + j * 1.1, 2.85, 2.46], pale);
  }
  box(entry, 'metal', [-0.76, 2.86, 2.3], [1.71, 3.17, 2.51], white);
  // Road-level wraparound landing, only the building's attached platform is included.
  const landing = [
    [-10.6, 2.0],
    [-10.6, 7.0],
    [0.2, 7.0],
    [2.4, 6.2],
    [3.4, 4.6],
    [3.6, 2.7],
    [2.9, 0.8],
    [-1.0, 0.5],
  ];
  loft(
    out,
    'concrete',
    [landing.map(([x, z]) => [x, 5.4, z]), landing.map(([x, z]) => [x, 6.3, z])],
    pale,
  );
  for (let i = 1; i < landing.length; i++)
    beam(
      out,
      'concrete',
      [landing[i - 1][0], 6.86, landing[i - 1][1]],
      [landing[i][0], 6.86, landing[i][1]],
      0.25,
      1.1,
      pale,
    );
  stairs(out);
  // Twelve radial steel cantilevers are visible beneath the projected restaurant head.
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) * pi) / 6,
      g = radial(out, a);
    const foot = [0.25 + 2.15 * Math.cos(a), 12.8, 1.1 + 2.15 * Math.sin(a)];
    const bend = [0.25 + 2.25 * Math.cos(a), 17.15, 1.1 + 2.25 * Math.sin(a)];
    beam(out, 'metal', foot, bend, 0.47, 0.53, gray);
    beam(out, 'metal', bend, [8.7 * Math.cos(a), 23.0, 8.7 * Math.sin(a)], 0.48, 0.58, gray);
    beam(g, 'metal', [0, 23.0, 8.7], [0, 40.12, 10.0], 0.25, 0.36, pale);
    box(g, 'metal', [-0.18, 39.9, 9.82], [0.18, 40.36, 10.14], gray);
  }
  // Solid floor body stays behind each capsule, allowing its glazing recess to remain visible.
  loft(
    out,
    'metal',
    [
      radialRing(20.25, 7.95, 7.95, 12, [0, 0], pi / 12),
      radialRing(39.95, 9.57, 9.57, 12, [0, 0], pi / 12),
    ],
    black,
  );
  for (let i = 0; i < 9; i++) capsule(out, i, ((i - 4) * pi) / 6);
  // The cyan and ochre painted ribbons are between capsules, following the actual shell.
  for (const [a, color] of [
    [-pi / 12, cyan],
    [pi / 12, yellow],
  ]) {
    const g = radial(out, a);
    for (let i = 1; i < profile.length; i++) {
      const [y0, r0] = profile[i - 1],
        [y1, r1] = profile[i];
      face(
        g,
        'metal',
        [
          [-0.61, y0, r0 + 0.018],
          [0.61, y0, r0 + 0.018],
          [0.61, y1, r1 + 0.018],
          [-0.61, y1, r1 + 0.018],
        ],
        color,
      );
      // Irregular painted crack motif on the cyan ribbon, as in the district photographs.
      if (color === cyan)
        for (let j = 0; j < Math.floor((y1 - y0) * 3); j++) {
          const y = y0 + (j + 0.5) / 3,
            rr = radius(y) + 0.032,
            u = 0.42 * Math.sin(j * 2.9 + i);
          line(
            g,
            'metal',
            [
              [u - 0.12, y - 0.13, rr],
              [u, y, rr],
              [u - 0.05, y + 0.12, rr],
              [u + 0.1, y + 0.22, rr],
            ],
            0.018,
            [0.12, 0.3, 0.34],
          );
        }
    }
  }
  rearWing(out);
  // Flat roof ring and the D-shaped lift machinery enclosure seen in the municipal aerial.
  loft(
    out,
    'metal',
    [
      radialRing(39.91, 9.63, 9.63, 12, [0, 0], pi / 12),
      radialRing(40.08, 9.63, 9.63, 12, [0, 0], pi / 12),
    ],
    [0.47, 0.48, 0.43],
  );
  const d = [];
  for (let i = 0; i <= 24; i++) {
    const a = -pi / 2 + (i * pi) / 24;
    d.push([-0.6 + 2.45 * Math.cos(a), 40.08, 2.45 * Math.sin(a)]);
  }
  d.push([-4.5, 40.08, 2.45], [-4.5, 40.08, -2.45]);
  d.reverse();
  loft(out, 'concrete', [d, d.map(([x, _y, z]) => [x, 42.514, z])], pale);
  for (let i = 0; i < 9; i++) {
    const a = ((i - 4) * pi) / 6,
      g = radial(out, a);
    box(g, 'metal', [-0.72, 40.09, 7.3], [0.72, 40.72, 8.35], gray);
    for (let k = 0; k < 8; k++)
      box(g, 'metal', [-0.7, 40.16 + k * 0.065, 8.35], [0.7, 40.185 + k * 0.065, 8.41], black);
    box(g, 'metal', [-0.03, 40.11, 9.48], [0.03, 40.85, 9.55], gray);
  }
  // Broad current mural accents on the central core; no third-party image is embedded.
  for (let i = 1; i < 10; i++) {
    const a = core[i - 1],
      b = core[i];
    const point = (p, y) => [p[0] + 0.022 * (p[0] - 0.2), y, p[1] + 0.022 * (p[1] - 1.1)];
    face(
      out,
      'metal',
      [point(a, 7.5), point(b, 7.5), point(b, 11.9), point(a, 11.9)],
      i > 2 && i < 8 ? [0.63, 0.38, 0.49] : [0.63, 0.63, 0.63],
    );
  }
}

export const bierpinsel = {
  id: 'n0614_bierpinsel',
  planId: 'N0614',
  title: 'Bierpinsel',
  wikidata: 'Q520281',
  build: buildBierpinsel,
  authoringFile: 'bierpinsel-model.mjs',
  size: [28, 42.514, 24],
  brief:
    'Nine radial aluminum restaurant capsules above a D-shaped lift shaft, branching steel ribs, a rectangular service wing, exposed dogleg stairs, roof machinery and the surviving street-art facade.',
  front: '+X points southeast, away from the northwest rectangular service wing; +Z is southwest',
  origin: 'Center fitted to the nine mapped radial capsule faces; Y=0 at local street level',
  appearance: { kind: 'current', representedDate: '2026-09-23', currentWorldEligible: true },
  refs: [
    'https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09097832',
    'https://www.bauwelt.de/dl/1733389/artikel.pdf',
    'https://www.moderne-regional.de/interview-ursulina-schueler-witte-zum-bierpinsel/',
    'https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5813.zip',
    'https://www.berlin.de/ba-steglitz-zehlendorf/aktuelles/pressemitteilungen/2026/pressemitteilung.1717697.php',
    'https://www.berlin.de/sehenswuerdigkeiten/5514897-3558930-bierpinsel.html',
    'https://www.tagesspiegel.de/berlin/berliner-chronik-2-juli-1976-808588.html',
    'https://www.openstreetmap.org/way/28503881',
  ],
  facts: {
    architects: ['Ralf Schüler', 'Ursulina Schüler-Witte'],
    opened: 1976,
    measured2026HeightMeters: 42.514,
    measuredGroundElevation: 45.816,
    measuredMaximumRoofElevation: 88.33,
    tourismHeightMeters: 47,
    radialCapsuleCount: 9,
    radialCantileverCount: 12,
    outerCapsuleFaceRadiusMeters: 11.76998,
    restaurantFloorIntervalReported1976: [23, 31],
    muralYear: 2010,
    photographicAppearanceDate: '2026-09-23',
  },
  scaleBasis:
    'The exact OSM outline and original architect floor plan govern the nine radial capsules and rectangular rear wing. Berlin’s March 2026 LoD2 building DEBE06YYB0000lX5 gives local ground 45.816 m and maximum roof 88.33 m, or 42.514 m above ground; this measured exterior envelope is used instead of silently stretching to the undatumed tourism height 47 m. Occupied tiers and details follow contemporary and September 2026 district photographs. The generalized LoD2 mesh is evidence only, not redistributed geometry.',
  geographicProposal: {
    anchor: map.anchor,
    heading: map.heading,
    elevationMode: 'terrain-contact',
    status: 'preview-proposal',
    source: map.sourceUrl,
    notes: map.notes.join(' '),
    mapGeometrySource: 'map-frame.json',
    mapGeometryHash: `sha256:${createHash('sha256').update(mapBytes).digest('hex')}`,
  },
  limits: [
    'Current September 2026 exterior; the restaurant is closed and the district reports recent facade-panel loss. This model does not claim the proposed restoration or reopening has occurred.',
    'Berlin’s measured 42.514 m exterior envelope differs from the tourism description of 47 m. The difference is preserved in the source evidence; no unverified foundation or roof extension is invented to reconcile it.',
    'Facade cassette profiles, stair landings and occupied-floor heights are proportionally reconstructed from primary photographs and the architect plan. The street-art mural retains broad color fields and forms without reproducing every painted face, tag, stain or missing panel.',
    'Adjacent road bridge, subway entrances, commercial signs and interiors are outside the tower asset. The attached street stair and pedestrian landing are included; their connection elevation remains a local photographic reconstruction.',
  ],
  cameras: [
    { name: 'southeast-capsules', position: [39, 29, 26], lookAt: [0, 26, 0] },
    { name: 'northwest-service-wing', position: [-38, 30, -21], lookAt: [-7, 27, 0] },
    { name: 'branching-steel-and-stem', position: [24, 13, 21], lookAt: [0, 17, 0] },
    { name: 'sloping-lower-window', position: [23, 20, 1], lookAt: [9, 24, 0] },
    { name: 'upper-capsule-and-louvers', position: [22, 34, 7], lookAt: [7, 35, 2] },
    { name: 'external-dogleg-stair', position: [-24, 12, 22], lookAt: [-6, 12, 4] },
    { name: 'pavement-entrance', position: [13, 4, 8], lookAt: [0, 3, 1] },
    { name: 'roof-machinery', position: [27, 60, -23], lookAt: [-1, 36, 0] },
    { name: 'far-silhouette', position: [72, 46, 86], lookAt: [-1, 21, 0] },
  ],
};

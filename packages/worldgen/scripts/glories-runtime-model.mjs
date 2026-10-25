/** Torre Glories: budgeted elliptical pixel skins and a closed glass crown. */
import { readFileSync } from 'node:fs';
import { face, localOutline, mappedCap, mappedSolid } from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'torre_glories',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const palette = [
  [0.62, 0.06, 0.035],
  [0.74, 0.075, 0.04],
  [0.56, 0.13, 0.095],
  [0.79, 0.15, 0.08],
  [0.57, 0.2, 0.16],
  [0.38, 0.09, 0.11],
  [0.51, 0.19, 0.2],
  [0.65, 0.28, 0.22],
  [0.39, 0.28, 0.27],
  [0.54, 0.37, 0.33],
  [0.28, 0.24, 0.33],
  [0.42, 0.29, 0.4],
  [0.36, 0.36, 0.4],
  [0.48, 0.44, 0.46],
  [0.49, 0.49, 0.5],
  [0.08, 0.2, 0.36],
  [0.12, 0.29, 0.47],
  [0.19, 0.36, 0.53],
  [0.26, 0.43, 0.6],
  [0.22, 0.33, 0.44],
  [0.33, 0.43, 0.52],
  [0.38, 0.49, 0.59],
  [0.47, 0.55, 0.59],
  [0.56, 0.62, 0.64],
  [0.65, 0.67, 0.66],
];
const settings = {
  skyline: {
    n: 24,
    rows: 12,
    crown: 6,
    windowPixels: false,
    louvrePitch: 0,
    louvreN: 0,
    meridians: 0,
    parallels: 0,
    rails: 0,
  },
  district: {
    n: 32,
    rows: 25,
    crown: 10,
    windowPixels: false,
    louvrePitch: 0,
    louvreN: 0,
    meridians: 8,
    parallels: 6,
    rails: 0,
  },
  street: {
    n: 64,
    rows: 48,
    crown: 14,
    windowPixels: true,
    louvrePitch: 3,
    louvreN: 24,
    meridians: 16,
    parallels: 8,
    rails: 8.1,
  },
  closeup: {
    n: 96,
    rows: 96,
    crown: 30,
    windowPixels: true,
    louvrePitch: 1.2,
    louvreN: 48,
    meridians: 28,
    parallels: 15,
    rails: 4.05,
  },
};
const rx = map.plan.length / 2,
  rz = map.plan.width / 2,
  height = 144.4,
  start = 76.4;
export const gloriesScale = (y) =>
  y <= start ? 1 : Math.sqrt(Math.max(0, 1 - ((y - start) / (height - start)) ** 2));
function point(t, y, depth = 0) {
  const s = gloriesScale(y),
    a = t * Math.PI * 2;
  return [
    Math.max(0.001, rx * s + depth) * Math.cos(a),
    y,
    -Math.max(0.001, rz * s + depth) * Math.sin(a),
  ];
}
const hash = (x, y) => {
  let v = Math.imul(x + 119, 374761393) ^ Math.imul(y + 71, 668265263);
  v = Math.imul(v ^ (v >>> 13), 1274126177);
  return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
};
const cells = [];
for (let j = 0; j < 125; j++) for (let i = 0; i < 132; i++) cells.push({ i, j, score: hash(i, j) });
const windows = new Set(
  cells
    .toSorted((a, b) => a.score - b.score)
    .slice(0, 4500)
    .map((p) => `${p.i}:${p.j}`),
);
const baseGlass = [0.095, 0.16, 0.2],
  veil = [0.38, 0.49, 0.54];
function color(i, j) {
  const wave = Math.sin(i * 0.125 + j * 0.038) * 0.14 + Math.cos(i * 0.33 - j * 0.08) * 0.07,
    t = Math.max(
      0,
      Math.min(0.999, j / 125 + wave + (hash(Math.floor(i / 3), Math.floor(j / 4)) - 0.5) * 0.31),
    );
  return palette[Math.min(24, Math.floor(t * 25))].map((v, k) => v * 0.78 + veil[k] * 0.22);
}
function sample(i, j, n, rows, includeWindows) {
  const result = [0, 0, 0];
  let count = 0;
  for (
    let y = Math.floor((j * 125) / rows);
    y < Math.max(Math.floor((j * 125) / rows) + 1, Math.floor(((j + 1) * 125) / rows));
    y++
  )
    for (
      let x = Math.floor((i * 132) / n);
      x < Math.max(Math.floor((i * 132) / n) + 1, Math.floor(((i + 1) * 132) / n));
      x++
    ) {
      const p = includeWindows && windows.has(`${x}:${y}`) ? baseGlass : color(x, y);
      for (let k = 0; k < 3; k++) result[k] += p[k];
      count++;
    }
  return result.map((v) => v / count);
}
function build(out, level) {
  const c = settings[level],
    top = 115;
  // The distant foundation shares the faceted shaft boundary; near views retain the map outline.
  const foundation =
    level === 'skyline'
      ? Array.from({ length: c.n }, (_, i) => {
          const p = point(i / c.n, 0);
          return [p[0], p[2]];
        })
      : localOutline(map);
  mappedSolid(out, 'foundation', foundation, 0, 0.25, [0.35, 0.36, 0.34]);
  for (let j = 0; j < c.rows; j++) {
    const lo = 0.25 + ((top - 0.25) * j) / c.rows,
      hi = 0.25 + ((top - 0.25) * (j + 1)) / c.rows;
    for (let i = 0; i < c.n; i++) {
      const t0 = i / c.n,
        t1 = (i + 1) / c.n;
      face(
        out,
        'pink',
        [point(t0, lo), point(t1, lo), point(t1, hi), point(t0, hi)],
        sample(i, j, c.n, c.rows, !c.windowPixels),
      );
      if (
        c.windowPixels &&
        windows.has(
          `${Math.floor(((i + 0.5) * 132) / c.n)}:${Math.floor(((j + 0.5) * 125) / c.rows)}`,
        )
      ) {
        const dt = 0.07 / c.n,
          dy = Math.min(0.1, (hi - lo) * 0.12);
        face(
          out,
          'glass',
          [
            point(t0 + dt, lo + dy, 0.012),
            point(t1 - dt, lo + dy, 0.012),
            point(t1 - dt, hi - dy, 0.012),
            point(t0 + dt, hi - dy, 0.012),
          ],
          baseGlass,
        );
      }
    }
  }
  // Arc sampling keeps the rounded crown closed without a steep final triangular spike.
  const phi0 = Math.asin((115 - start) / (height - start)),
    ys = Array.from(
      { length: c.crown + 1 },
      (_, i) => start + (height - start) * Math.sin(phi0 + ((Math.PI / 2 - phi0) * i) / c.crown),
    );
  ys[ys.length - 1] = 144.399;
  for (let j = 0; j < c.crown; j++)
    for (let i = 0; i < c.n; i++)
      face(
        out,
        'glass',
        [
          point(i / c.n, ys[j]),
          point((i + 1) / c.n, ys[j]),
          point((i + 1) / c.n, ys[j + 1]),
          point(i / c.n, ys[j + 1]),
        ],
        [0.33, 0.46, 0.5],
      );
  // Closed pale oculus; the exact top-ring dimensions are reconstructed.
  const cap = Array.from({ length: c.n }, (_, i) => {
    const p = point(i / c.n, 144.399);
    return [p[0], p[2]];
  });
  mappedCap(out, 'glass', cap, 144.4, [0.4, 0.53, 0.57]);
  if (c.louvrePitch)
    for (let y = 0.42; y < 143.6; y += c.louvrePitch) {
      const hi = Math.min(143.8, y + 0.11 * c.louvrePitch),
        n = Math.max(12, Math.round(c.louvreN * Math.max(0.3, gloriesScale(y))));
      for (let i = 0; i < n; i++) {
        const a = i / n,
          b = (i + 1) / n,
          tilt = 0.07 + 0.04 * (0.5 + 0.5 * Math.cos((a + b) * Math.PI + map.heading));
        face(
          out,
          'glass',
          [point(a, y, 0.02), point(b, y, 0.02), point(b, hi, -tilt), point(a, hi, -tilt)],
          [0.47, 0.57, 0.6],
        );
      }
    }
  for (let i = 0; i < c.meridians; i++)
    for (let j = 0; j < c.crown; j++) {
      const t = i / c.meridians,
        delta = Math.min(0.006, 0.16 / (rx * gloriesScale(ys[j]) * Math.PI * 2));
      face(
        out,
        'metal',
        [
          point(t - delta, ys[j], 0.03),
          point(t + delta, ys[j], 0.03),
          point(t + delta, ys[j + 1], 0.03),
          point(t - delta, ys[j + 1], 0.03),
        ],
        [0.54, 0.61, 0.62],
      );
    }
  for (let j = 0; j < c.parallels; j++) {
    const y = 115 + ((143.6 - 115) * j) / c.parallels;
    for (let i = 0; i < c.n; i++)
      face(
        out,
        'metal',
        [
          point(i / c.n, y - 0.07, 0.035),
          point((i + 1) / c.n, y - 0.07, 0.035),
          point((i + 1) / c.n, y + 0.07, 0.035),
          point(i / c.n, y + 0.07, 0.035),
        ],
        [0.54, 0.61, 0.62],
      );
  }
  if (c.rails)
    for (let y = 4.7; y < 114; y += c.rails)
      for (let i = 0; i < c.n; i++)
        face(
          out,
          'metal',
          [
            point(i / c.n, y - 0.035, 0.04),
            point((i + 1) / c.n, y - 0.035, 0.04),
            point((i + 1) / c.n, y + 0.035, 0.04),
            point(i / c.n, y + 0.035, 0.04),
          ],
          [0.54, 0.61, 0.62],
        );
}
function skylineOutput(out) {
  const result = {};
  for (const name of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    result[name] = (slot, _ref, p, n, uv, color) => {
      const mean = scope.sourceFacts.surfaceMeans[scope.surfaceOverrides[slot]?.graph] ?? [1, 1, 1];
      out[name](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        color.map((v, i) => v * mean[i]),
      );
    };
  return result;
}
export const buildGloriesSkyline = (out) => build(skylineOutput(out), 'skyline');
export const buildGloriesDistrict = (out) => build(out, 'district');
export const buildGloriesStreet = (out) => build(out, 'street');
export const buildGloriesCloseup = (out) => build(out, 'closeup');
export const buildGloriesReviewedMaster = (out) => build(out, 'closeup');

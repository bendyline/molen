/** Kõpu: attributed asymmetric ground footprint; retained original upper tower and 37.7m conductor. */
import { readFileSync } from 'node:fs';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import { ring } from './lighthouse-expansion-models.mjs';
import { buildKopu, lathe } from './lighthouse-models.mjs';
import { box } from './structure-mesh.mjs';
export const kopuRuntimeAssetId = 'molen.worldgen.structure.n0641_kopu_lighthouse';
const frame = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u6/u6r/n0641_kopu_lighthouse/map-frame.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const base = frame.geometry.outline.slice(0, -1);
const top = [
  [1.3, -4.45],
  [1.3, -4.18],
  [4.18, -4.18],
  [4.18, -1.508],
  [4.45, -1.508],
  [4.45, 1.508],
  [4.18, 1.508],
  [4.18, 4.18],
  [1.768, 4.18],
  [1.768, 4.45],
  [-0.3, 4.45],
  [-1.768, 4.45],
  [-1.768, 4.18],
  [-4.18, 4.18],
  [-4.18, 1.612],
  [-4.45, 1.612],
  [-4.45, -1.612],
  [-4.18, -1.612],
  [-4.18, -4.18],
  [-1.3, -4.18],
  [-1.3, -4.45],
];
const white = [0.89, 0.89, 0.85],
  red = [0.64, 0.13, 0.095],
  dark = [0.09, 0.115, 0.12];
const foot = base[10],
  entryShift = [foot[0], foot[1] - 11.2];
function vertex(i, y) {
  if (y <= 22.8) {
    const t = y / 22.8;
    return [base[i][0] * (1 - t) + top[i][0] * t, y, base[i][1] * (1 - t) + top[i][1] * t];
  }
  const t = (y - 22.8) / 0.85,
    [x, z] = top[i],
    scale = Math.min(1, 4.12 / Math.max(Math.abs(x), Math.abs(z)));
  return [x * (1 - t) + x * scale * t, y, z * (1 - t) + z * scale * t];
}
function triangle(out, slot, p, color) {
  const v = cross(
    p[1].map((n, i) => n - p[0][i]),
    p[2].map((n, i) => n - p[0][i]),
  );
  if (Math.hypot(...v) < 1e-8) return;
  const n = normalFor(...p),
    axis = Math.abs(n[0]) > Math.abs(n[2]) ? 2 : 0;
  out.addTriangle(
    slot,
    'metric:uv',
    p,
    n,
    p.map((p) => [p[axis], p[1]]),
    color,
  );
}
function face(out, slot, p, color) {
  triangle(out, slot, [p[0], p[1], p[2]], color);
  triangle(out, slot, [p[0], p[2], p[3]], color);
}
/** Ground controls are mapped; all profiles above the base are explicitly reconstructed. */
export function buildKopuLower(out, color = white, vents = true) {
  for (const y of [0, 4, 11, 22.8]) {
    const hi = { 0: 4, 4: 11, 11: 22.8, 22.8: 23.65 }[y];
    for (let i = 0; i < base.length; i++) {
      const j = (i + 1) % base.length;
      face(out, 'plaster', [vertex(j, y), vertex(i, y), vertex(i, hi), vertex(j, hi)], color);
    }
  }
  for (let i = 0; i < base.length; i++) {
    const j = (i + 1) % base.length;
    triangle(out, 'plaster', [[0, 0, 0], vertex(i, 0), vertex(j, 0)], color);
  }
  if (!vents) return;
  for (const [a, b] of [
    [0, 20],
    [5, 4],
    [11, 9],
    [16, 15],
  ])
    for (const y of [7.2, 13.5, 18.7]) {
      const edge = (h) => {
        const p = vertex(a, h),
          q = vertex(b, h),
          dx = q[0] - p[0],
          dz = q[2] - p[2],
          len = Math.hypot(dx, dz),
          normal = [-dz / len, 0, dx / len];
        return [-1, 1].map((s) => [
          (p[0] + q[0]) / 2 + (s * 0.12 * dx) / len + normal[0] * 0.02,
          h,
          (p[2] + q[2]) / 2 + (s * 0.12 * dz) / len + normal[2] * 0.02,
        ]);
      };
      const lo = edge(y),
        hi = edge(y + 0.65);
      face(out, 'glass', [lo[0], lo[1], hi[1], hi[0]], dark);
    }
}
function upperAndEntry(out, { district = false } = {}) {
  const bolt = (p) =>
    p.every((q) =>
      [25.24, 25.56, 28.39, 28.71, 31.64, 31.96].some((y) => Math.abs(q[1] - y) < 0.06),
    ) &&
    p.every(
      (q) =>
        (Math.abs(Math.abs(q[0]) - 2.65) < 0.06 && Math.abs(Math.abs(q[2]) - 4.2) < 0.04) ||
        (Math.abs(Math.abs(q[2]) - 2.65) < 0.06 && Math.abs(Math.abs(q[0]) - 4.2) < 0.04),
    );
  const proxy = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((method) => [
      method,
      (slot, ref, p, n, uv, color) => {
        const entry = p.every((q) => q[2] >= 10.49 && q[1] <= 3.3);
        if (entry) {
          out[method](
            slot,
            ref,
            p.map((q) => [q[0] + entryShift[0], q[1], q[2] + entryShift[1]]),
            n,
            uv,
            color,
          );
          return;
        }
        if (!p.every((q) => q[1] >= 23.6)) return;
        if (district && (p.some((q) => q[1] > 33.86) || bolt(p))) return;
        out[method](slot, ref, p, n, uv, color);
      },
    ]),
  );
  buildKopu(proxy);
}
export function buildKopuCurrent(out) {
  buildKopuLower(out);
  upperAndEntry(out);
}
function lanternLow(out, sides = 12) {
  lathe(
    out,
    'metal',
    [
      [33.85, 1.8748],
      [34.01, 1.8748],
      [34.08, 1.72],
    ],
    red,
    sides,
  );
  lathe(
    out,
    'glass',
    [
      [34.08, 1.6856],
      [35.87, 1.6856],
    ],
    [0.27, 0.39, 0.42],
    sides,
  );
  for (let i = 0; i < sides; i++) {
    const a = (i * Math.PI * 2) / sides,
      p = (y) => [Math.cos(a) * 1.72, y, Math.sin(a) * 1.72];
    beam(out, 'metal', p(34.02), p(35.87), 0.09, 0.09, red);
  }
  for (const y of [34.88, 35.87]) ring(out, 'metal', y, 1.73, 1.77, 0.055, red, sides);
  lathe(
    out,
    'metal',
    [
      [35.87, 1.9952],
      [36.01, 1.9952],
      [36.22, 1.6512],
      [36.51, 0.6536],
      [36.67, 0.065],
    ],
    red,
    sides,
  );
  lathe(
    out,
    'metal',
    [
      [36.67, 0.01],
      [36.83, 0.13],
      [36.99, 0.01],
    ],
    red,
    8,
  );
  lathe(
    out,
    'metal',
    [
      [36.95, 0.016],
      [37.7, 0.016],
    ],
    dark,
    4,
  );
}
export function buildKopuDistrict(out) {
  buildKopuLower(out);
  upperAndEntry(out, { district: true });
  box(out, 'plaster', [-1.6, 33.85, -2.8], [1.6, 34.55, -0.9], white);
  box(out, 'metal', [-1.68, 34.5, -2.87], [1.68, 34.62, -0.83], red);
  for (const side of [-1, 1]) {
    beam(out, 'metal', [-4.3, 34.35, side * 4.3], [4.3, 34.35, side * 4.3], 0.052, 0.052, red);
    beam(out, 'metal', [side * 4.3, 34.35, -4.3], [side * 4.3, 34.35, 4.3], 0.052, 0.052, red);
  }
  for (const x of [-4.3, 0, 4.3])
    for (const z of [-4.3, 4.3]) beam(out, 'metal', [x, 33.85, z], [x, 34.35, z], 0.04, 0.04, red);
  for (const x of [-4.3, 4.3]) beam(out, 'metal', [x, 33.85, 0], [x, 34.35, 0], 0.04, 0.04, red);
  lanternLow(out, 16);
}
const plasterMean = [0.856015, 0.827728, 0.727643],
  metalMean = [0.908889, 0.908889, 0.908889],
  woodMean = [0.825128, 0.825128, 0.825128];
export function buildKopuSkyline(out) {
  const tint = (c, m) => c.map((v, i) => v * m[i]),
    w = tint(white, plasterMean),
    r = tint(red, metalMean);
  buildKopuLower(out, w, false);
  box(out, 'plaster', [-4.12, 23.65, -4.12], [4.12, 32.9, 4.12], w);
  box(out, 'plaster', [-4.65, 32.9, -4.65], [4.65, 33.4, 4.65], w);
  box(out, 'metal', [-4.68, 33.36, -4.68], [4.68, 33.85, 4.68], r);
  box(out, 'plaster', [-1.6, 33.85, -2.8], [1.6, 34.55, -0.9], w);
  box(out, 'metal', [-1.68, 34.5, -2.87], [1.68, 34.62, -0.83], r);
  // Far panes retain portable linear colors; all painted metal uses the canonical graph mean.
  const mapped = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
      name,
      (slot, ref, p, n, uv, c) =>
        out[name](slot, ref, p, n, uv, slot === 'metal' ? tint(c, metalMean) : c),
    ]),
  );
  lanternLow(mapped, 8);
  box(
    out,
    'plaster',
    [-1.3 + entryShift[0], 0, 10.6 + entryShift[1]],
    [1.3 + entryShift[0], 2.4, 12.5 + entryShift[1]],
    w,
  );
  box(
    out,
    'wood',
    [-0.7 + entryShift[0], 0.1, 12.51 + entryShift[1]],
    [0.7 + entryShift[0], 2.1, 12.53 + entryShift[1]],
    tint([0.31, 0.22, 0.16], woodMean),
  );
  box(
    out,
    'metal',
    [-1.48 + entryShift[0], 2.38, 10.5 + entryShift[1]],
    [1.48 + entryShift[0], 3.18, 12.65 + entryShift[1]],
    r,
  );
}

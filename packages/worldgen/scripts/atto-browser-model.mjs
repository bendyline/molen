/** Budgeted ATTO tower derivatives. The instanced detailed master remains separate. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';

const fit = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/6x/6xw/n0621_amazon_tall_tower_observatory/pmtiles-fit.json',
      import.meta.url,
    ),
  ),
);
const red = [0.79, 0.235, 0.085],
  white = [0.86, 0.865, 0.82],
  silver = [0.66, 0.7, 0.7],
  dark = [0.08, 0.105, 0.11];
const mean = {
  metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  stainless: [0.818960257808076, 0.8228885700850488, 0.8228885700850488],
  concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
};
const levels = [54, 108, 162, 216, 270, 321],
  radii = [75, 75, 150, 150, 225, 225];
const paint = (y) => (Math.floor(y / 30) % 2 ? white : red);
function ground(x, z) {
  const g = fit.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - fit.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
function safe(out, far) {
  function emit(s, r, p, _n, uv, c) {
    p = p.map((v) => v.map(Math.fround));
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]],
        n = normalFor(...t);
      if (Math.hypot(...n) < 0.5) continue;
      out.addTriangle(
        s,
        r,
        t,
        n,
        typeof uv === 'function' ? t.map(uv) : [uv[0], uv[i], uv[i + 1]],
        far ? c.map((v, j) => v * (mean[s]?.[j] ?? 1)) : c,
      );
    }
  }
  return Object.fromEntries(['addTriangle', 'addQuad', 'addConvexPolygon'].map((k) => [k, emit]));
}
function rail(o, a, b, col, width = 0.09) {
  beam(o, 'metal', a, b, width, width, col);
}
function build(out, d) {
  const o = safe(out, d === 0),
    base = 0.35;
  // Keep the red/white shaft readable even when braces occupy less than one pixel.
  for (let y = 0; y < 325; y += 30)
    for (const x of [-1.5, 1.5])
      for (const z of [-1.5, 1.5])
        rail(
          o,
          [x, y + base, z],
          [x, Math.min(325, y + 30) + base, z],
          paint(y),
          d === 0 ? 0.2 : 0.18,
        );
  const step = d === 1 ? 30 : d === 2 ? 6 : 3;
  if (d > 0)
    for (let y = 0; y < 321; y += step) {
      const top = Math.min(321, y + step),
        col = paint(y);
      for (let side = 0; side < 4; side++) {
        const a = (side * Math.PI) / 2,
          c = Math.cos(a),
          s = Math.sin(a),
          p = (x, h, z) => [c * x + s * z, h + base, -s * x + c * z];
        rail(o, p(-1.45, y, 1.48), p(1.45, top, 1.48), col);
        rail(o, p(1.45, y, 1.48), p(-1.45, top, 1.48), col);
        rail(o, p(-1.5, y, 1.5), p(1.5, y, 1.5), col);
      }
    }
  const floor = base + 321;
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      c = Math.cos(a),
      s = Math.sin(a);
    const p = (x, h) => [c * x + s * 1.5, h, -s * x + c * 1.5];
    rail(o, p(-1.5, floor + 4), p(1.5, floor + 4), red);
    rail(o, p(-1.5, floor), p(1.5, floor + 4), red);
    rail(o, p(1.5, floor), p(-1.5, floor + 4), red);
  }
  box(o, 'metal', [-3, floor - 0.12, -3], [3, floor, 3], red);
  for (const x of [-2.9, 2.9]) rail(o, [x, floor + 1.1, -2.9], [x, floor + 1.1, 2.9], red, 0.08);
  for (const z of [-2.9, 2.9]) rail(o, [-2.9, floor + 1.1, z], [2.9, floor + 1.1, z], red, 0.08);
  if (d > 0)
    for (const x of [-2.9, 0, 2.9])
      for (const z of [-2.9, 0, 2.9])
        if (x || z) rail(o, [x, floor, z], [x, floor + 1.1, z], red, 0.07);
  beam(o, 'stainless', [0, floor, 0], [0, base + 331, 0], 0.04, 0.04, silver);
  for (let side = 0; side < 4; side++) {
    const a = (side * Math.PI) / 2,
      c = Math.cos(a),
      s = Math.sin(a),
      p = (x, h, z) => [c * x + s * z, h, -s * x + c * z];
    for (const [i, h] of levels.entries()) {
      const radius = radii[i],
        extent = h === 321 ? 3.8 : 2.25,
        start = p(0, h + base, extent);
      if (d > 0) {
        rail(o, p(-1.5, h + base, 1.5), start, paint(h - 0.01), 0.1);
        rail(o, p(1.5, h + base, 1.5), start, paint(h - 0.01), 0.1);
      }
      for (const sign of [-1, 1]) {
        const end = p((sign * radius) / Math.sqrt(2), 0, radius / Math.sqrt(2));
        end[1] = ground(end[0], end[2]) + 0.9;
        const count = [1, 1, 2, 8][d];
        let last = start;
        for (let j = 1; j <= count; j++) {
          const t = j / count,
            point = start.map(
              (v, k) => v + (end[k] - v) * t - (k === 1 ? 4 * radius * 0.012 * t * (1 - t) : 0),
            );
          if (d === 0) {
            const w = 0.025;
            o.addQuad(
              'stainless',
              'palette:#ffffff',
              [
                [last[0] - w, last[1], last[2]],
                [point[0] - w, point[1], point[2]],
                [point[0] + w, point[1], point[2]],
                [last[0] + w, last[1], last[2]],
              ],
              [0, 0, 1],
              [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
              ],
              silver,
            );
          } else beam(o, 'stainless', last, point, 0.028, 0.028, silver);
          last = point;
        }
      }
    }
  }
  // Original approximate radii are retained. Each visible block uses the same PMTiles grid.
  for (const radius of [75, 150, 225])
    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2,
        x = radius * Math.cos(a),
        z = radius * Math.sin(a),
        y = ground(x, z);
      box(
        o,
        'concrete',
        [x - 0.7, y - 0.15, z - 0.7],
        [x + 0.7, y + 0.55, z + 0.7],
        [0.58, 0.57, 0.52],
      );
      if (d > 0) beam(o, 'stainless', [x, y + 0.4, z], [x, y + 1.02, z], 0.12, 0.12, silver);
    }
  const toe =
    Math.min(ground(-1.9, -1.9), ground(1.9, -1.9), ground(1.9, 1.9), ground(-1.9, 1.9)) - 0.2;
  box(o, 'concrete', [-1.9, toe, -1.9], [1.9, base, 1.9], [0.61, 0.6, 0.55]);
  if (d === 0) return;
  if (d === 3)
    for (let i = 0; i < 2; i++)
      box(
        o,
        'stainless',
        [-0.42, base - 0.14 + i * 0.07, 1.9 + i * 0.2],
        [0.42, base - 0.1 + i * 0.07, 2.1 + i * 0.2],
        silver,
      );
  // District keeps landings; street uses flights; closeup retains all 1500 tread impressions.
  for (let i = 0; i < 107; i++) {
    const y = i * 3 + base,
      flip = i % 2 ? -1 : 1;
    if (d >= 2) {
      const count = d === 3 ? 14 : 1;
      for (let j = 1; j <= count; j++) {
        const x = flip * (-1.15 + (2.3 * j) / count),
          h = y + (3 * j) / count;
        box(
          o,
          'stainless',
          [x - 0.09, h - 0.04, Math.min(0.23 * flip, 1.05 * flip)],
          [x + 0.09, h, Math.max(0.23 * flip, 1.05 * flip)],
          silver,
        );
      }
      rail(
        o,
        [-1.2 * flip, y + 1.05, 0.23 * flip],
        [1.2 * flip, y + 4.05, 0.23 * flip],
        silver,
        0.035,
      );
      rail(
        o,
        [-1.2 * flip, y + 1.05, 1.05 * flip],
        [1.2 * flip, y + 4.05, 1.05 * flip],
        silver,
        0.035,
      );
    }
    if (d >= 2 || i % 16 === 0)
      box(o, 'stainless', [-1.3, y - 0.04, -1.25], [1.3, y, 0.05], silver);
  }
  for (const x of [-1.68, -1.82])
    beam(o, 'metal', [x, base, 1.68], [x, floor, 1.68], 0.05, 0.05, dark);
  if (d >= 2) {
    box(o, 'metal', [-2.35, 8.3 + base, 1.5], [-1.68, 10.1 + base, 2.25], white);
    box(o, 'stainless', [-2.42, 10.1 + base, 1.45], [-1.62, 10.15 + base, 2.3], silver);
    box(o, 'metal', [-2.38, 8.45 + base, 1.45], [-2.32, 9.95 + base, 1.5], [0.89, 0.72, 0.055]);
    box(o, 'metal', [-2.3, 8.5 + base, 2.25], [-1.73, 9.25 + base, 2.27], dark);
    if (d === 3)
      for (let i = 0; i < 6; i++)
        box(
          o,
          'stainless',
          [-2.25, 8.58 + base + i * 0.1, 2.27],
          [-1.78, 8.6 + base + i * 0.1, 2.285],
          silver,
        );
  }
}
export const buildAttoSkyline = (o) => build(o, 0);
export const buildAttoDistrict = (o) => build(o, 1);
export const buildAttoStreet = (o) => build(o, 2);
export const buildAttoCloseup = (o) => build(o, 3);

/** Picture-based Swallow's Nest exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildSwallowsNestRuntime } from './swallows-nest-model.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sz/szb/n0271_swallow_s_nest/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    concrete: [0.44849861649919487, 0.44906994842942866, 0.37575318374011624],
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
  };
export function swallowsNestGround(x, z) {
  const g = grade.grid,
    u = Math.max(0, Math.min(g.width - 1.000001, (x - g.origin[0]) / g.stepMeters)),
    v = Math.max(0, Math.min(g.height - 1.000001, (z - g.origin[1]) / g.stepMeters)),
    i = Math.floor(u),
    j = Math.floor(v),
    fx = u - i,
    fz = v - j,
    at = (a, b) => g.heights[(j + b) * g.width + i + a] - grade.datumMeters;
  return (
    (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fz) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fz
  );
}
function rockApron(o, level, far) {
  const frame = JSON.parse(
      readFileSync(
        new URL(
          '../../../content/worldgen/source/places/sz/szb/n0271_swallow_s_nest/map-frame.json',
          import.meta.url,
        ),
      ),
    ),
    [cx, cz] = frame.controls.towerCenter,
    n = [6, 8, 12, 16][level],
    p = [
      [-11.4, -3.3],
      [-5.6, -4.3],
      [2.5, -4.25],
      [cx, cz - 4.25],
    ];
  for (let i = 1; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    p.push([cx + 4.25 * Math.cos(a), cz + 4.25 * Math.sin(a)]);
  }
  p.push([2, 4.5], [-5.6, 4.5], [-11.4, 3.2]);
  const edge = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (far ? 4 : 2.2)));
    for (let j = 0; j < steps; j++)
      edge.push([a[0] + ((b[0] - a[0]) * j) / steps, a[1] + ((b[1] - a[1]) * j) / steps]);
  }
  const rows = far ? 2 : 4,
    points = Array.from({ length: rows + 1 }, (_, row) =>
      edge.map(([x, z], i) => {
        const t = row / rows,
          r = Math.hypot(x, z) || 1,
          w =
            t === 0 || t === 1
              ? 0
              : (0.28 + 0.25 * Math.sin(i * 1.71 + row * 0.8)) * Math.sin(t * Math.PI),
          X = x + (x / r) * w,
          Z = z + (z / r) * w,
          bottom = Math.min(5.5, swallowsNestGround(x, z) - 0.6);
        return [X, 6.05 + (bottom - 6.05) * t, Z];
      }),
    ),
    color = [0.48, 0.47, 0.42].map((v, i) => (far ? v * (MEANS.concrete?.[i] ?? 1) : v));
  for (let row = 0; row < rows; row++)
    for (let i = 0; i < edge.length; i++) {
      const j = (i + 1) % edge.length,
        q = [points[row + 1][i], points[row][i], points[row][j], points[row + 1][j]];
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        const t = ids.map((k) => q[k]);
        o.addTriangle(
          'concrete',
          'palette:#ffffff',
          t,
          normalFor(...t),
          [
            [0, 0],
            [1, 0],
            [0, 1],
          ],
          color,
        );
      }
    }
}
function reviewed(o, level) {
  const far = level === 'skyline';
  rockApron(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level], far);
  function emit(s, r, p, n, uv, c) {
    if (far && n[1] < -0.98) return;
    const ps = p.map(([x, y, z]) => [x, y === 0 ? 6.05 : y + 6, z]),
      col = far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c;
    for (let i = 1; i < ps.length - 1; i++) {
      const t = [ps[0], ps[i], ps[i + 1]];
      o.addTriangle(
        s,
        r,
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        col,
      );
    }
  }
  buildSwallowsNestRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildSwallowsNestReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildSwallowsNestReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildSwallowsNestReviewedDistrict = (o) => reviewed(o, 'district');
export const buildSwallowsNestReviewedStreet = (o) => reviewed(o, 'street');
export const buildSwallowsNestReviewedCloseup = (o) => reviewed(o, 'closeup');

/** Picture-based Hermann Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { buildHermannRuntime } from './hermann-castle-model.mjs';
import { normalFor } from './authored-structure-mesh.mjs';
const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ud/uds/n0274_hermann_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
  };
export function hermannGround(x, z) {
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
function reviewed(o, level) {
  const far = level === 'skyline';
  function emit(s, r, p, n, uv, c) {
    if (s === 'foliage' || (far && n[1] < -0.98)) return;
    const ps = p.map(([x, y, z]) => [
        x,
        y <= 0.12 && n[1] > 0.98 && !(x > 25 && x < 76 && z > -2 && z < 55)
          ? hermannGround(x, z) + y + 0.08
          : y === 0 && n[1] < 0.98
            ? Math.min(0.8, hermannGround(x, z) - 1.5)
            : y + 0.8,
        z,
      ]),
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
  buildHermannRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildHermannReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildHermannReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildHermannReviewedDistrict = (o) => reviewed(o, 'district');
export const buildHermannReviewedStreet = (o) => reviewed(o, 'street');
export const buildHermannReviewedCloseup = (o) => reviewed(o, 'closeup');

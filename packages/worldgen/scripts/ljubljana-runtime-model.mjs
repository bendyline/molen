/** Picture-based Ljubljana Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildLjubljanaRuntime } from './ljubljana-castle-model.mjs';

const OLD_MEANS = JSON.parse(
  readFileSync(
    new URL(
      '../../../content/worldgen/source/places/u2/u24/ljubljana_castle/surface-means.json',
      import.meta.url,
    ),
  ),
);
const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u2/u24/ljubljana_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    stone: [0.44849861649919487, 0.44906994842942866, 0.37575318374011624],
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    paving: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
  };
export function ljubljanaGround(x, z) {
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
  function emit(s, r, p, n, _uv, c) {
    if (far && n[1] < -0.98) return;
    const ps = p.map(([x, y, z]) =>
        [x, y === 0 && n[1] < 0.98 ? ljubljanaGround(x, z) - 0.4 : y + 2, z].map(Math.fround),
      ),
      col = far ? c.map((v, i) => (v * (MEANS[s]?.[i] ?? 1)) / (OLD_MEANS[s]?.[i] ?? 1)) : c;
    for (let i = 1; i < ps.length - 1; i++) {
      const t = [ps[0], ps[i], ps[i + 1]];
      const nn = normalFor(...t);
      if (Math.hypot(...nn) < 0.5) continue;
      o.addTriangle(
        s,
        r,
        t,
        nn,
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        col,
      );
    }
  }
  buildLjubljanaRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildLjubljanaReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildLjubljanaReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildLjubljanaReviewedDistrict = (o) => reviewed(o, 'district');
export const buildLjubljanaReviewedStreet = (o) => reviewed(o, 'street');
export const buildLjubljanaReviewedCloseup = (o) => reviewed(o, 'closeup');

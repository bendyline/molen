/** Picture-based Corvin Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildCorvinRuntime } from './corvin-castle-model.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u8/u80/corvin_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    stone: [0.44849861649919487, 0.44906994842942866, 0.37575318374011624],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    foliage: [0.44849861649919487, 0.44906994842942866, 0.37575318374011624],
  };
export function corvinGround(x, z) {
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
    const ps = p.map(([x, y, z]) => [
        x,
        y === 0 && n[1] < 0.98
          ? Math.min(0.8, corvinGround(x, z) - 1.5)
          : y +
            0.8 +
            ((s === 'wood' || Math.abs(y - 8.55) < 1e-6) &&
            y <= 10.2 &&
            z < -23 &&
            Math.abs(x - 35) < 4
              ? Math.min(1, (-z - 23) / 71) * (corvinGround(35, -94) + 0.65 - 9.8)
              : 0),
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
  buildCorvinRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildCorvinReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildCorvinReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildCorvinReviewedDistrict = (o) => reviewed(o, 'district');
export const buildCorvinReviewedStreet = (o) => reviewed(o, 'street');
export const buildCorvinReviewedCloseup = (o) => reviewed(o, 'closeup');

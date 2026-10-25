/** Picture-based Pembroke Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildPembrokeRuntime } from './pembroke-castle-model.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gch/pembroke_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    rubble: [0.6477386511264271, 0.6303290420978949, 0.5582142312416606],
    carved: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    aggregate: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
  };
export function pembrokeGround(x, z) {
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
        [x, y <= 0.401 ? pembrokeGround(x, z) - 0.4 : y - 7, z].map(Math.fround),
      ),
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
  buildPembrokeRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildPembrokeReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildPembrokeReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildPembrokeReviewedDistrict = (o) => reviewed(o, 'district');
export const buildPembrokeReviewedStreet = (o) => reviewed(o, 'street');
export const buildPembrokeReviewedCloseup = (o) => reviewed(o, 'closeup');

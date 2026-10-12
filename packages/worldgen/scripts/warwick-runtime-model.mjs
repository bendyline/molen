/** Picture-based Warwick Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { buildWarwickRuntime } from './warwick-castle-model.mjs';
import { normalFor } from './authored-structure-mesh.mjs';
const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gcq/n0290_warwick_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    sandstone: [0.6849383831581978, 0.6023767969729558, 0.46768227309766186],
    slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
  };
export function warwickGround(x, z) {
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
    if (far && n[1] < -0.98) return;
    const ps = p.map(([x, y, z]) => [
        x,
        y === 0 && n[1] < 0.98 ? Math.min(-6, warwickGround(x, z) - 1.5) : y + -6,
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
  buildWarwickRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildWarwickReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildWarwickReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildWarwickReviewedDistrict = (o) => reviewed(o, 'district');
export const buildWarwickReviewedStreet = (o) => reviewed(o, 'street');
export const buildWarwickReviewedCloseup = (o) => reviewed(o, 'closeup');

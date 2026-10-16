/** Picture-based Castel Nuovo exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildCastelNuovoRuntime } from './castel-nuovo-model.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/sr/sr6/n0289_castel_nuovo/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    basalt: [0.5405470060281218, 0.565117710972021, 0.5379676849277553],
    sandstone: [0.6849383831581978, 0.6023767969729558, 0.46768227309766186],
    marble: [0.9160827848592121, 0.9160827848592121, 0.9160827848592121],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    foliage: [0.44849861649919487, 0.44906994842942866, 0.37575318374011624],
  };
export function castelNuovoGround(x, z) {
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
        y === 0 && n[1] < 0.98 ? Math.min(1, castelNuovoGround(x, z) - 1.5) : y + 1,
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
  buildCastelNuovoRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildCastelNuovoReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildCastelNuovoReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildCastelNuovoReviewedDistrict = (o) => reviewed(o, 'district');
export const buildCastelNuovoReviewedStreet = (o) => reviewed(o, 'street');
export const buildCastelNuovoReviewedCloseup = (o) => reviewed(o, 'closeup');

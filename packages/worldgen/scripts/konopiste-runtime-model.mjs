/** Picture-based Konopiště Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildKonopisteRuntime } from './konopiste-castle-model.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u2/u2f/konopiste_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    foliage: [0.44849861649919487, 0.44906994842942866, 0.37575318374011624],
  };
export function konopisteGround(x, z) {
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
        y === 0 && n[1] < 0.98 ? Math.min(0.6, konopisteGround(x, z) - 1.5) : y + 0.6,
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
  buildKonopisteRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildKonopisteReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildKonopisteReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildKonopisteReviewedDistrict = (o) => reviewed(o, 'district');
export const buildKonopisteReviewedStreet = (o) => reviewed(o, 'street');
export const buildKonopisteReviewedCloseup = (o) => reviewed(o, 'closeup');

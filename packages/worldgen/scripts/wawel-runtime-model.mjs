/** Picture-based Wawel Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { buildWawelRuntime } from './wawel-castle-model.mjs';
import { normalFor } from './authored-structure-mesh.mjs';
const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u2/u2y/n0299_wawel_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    stone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    patina: [0.6357568684279634, 0.680368873795494, 0.6174688939562135],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    aggregate: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
  };
export function wawelGround(x, z) {
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
    const ps = p.map(([x, y, z]) =>
        [x, y === 0 && n[1] < 0.98 ? wawelGround(x, z) - 0.4 : y - 6, z].map(Math.fround),
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
  buildWawelRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildWawelReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildWawelReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildWawelReviewedDistrict = (o) => reviewed(o, 'district');
export const buildWawelReviewedStreet = (o) => reviewed(o, 'street');
export const buildWawelReviewedCloseup = (o) => reviewed(o, 'closeup');

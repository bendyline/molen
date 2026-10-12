/** Picture-based Akershus Fortress exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { buildAkershusRuntime } from './akershus-fortress-model.mjs';
import { normalFor } from './authored-structure-mesh.mjs';
const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u4/u4x/n0282_akershus_fortress/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    patina: [0.6357568684279634, 0.680368873795494, 0.6174688939562135],
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
  };
export function akershusGround(x, z) {
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
    if ((far && n[1] < -0.98) || (s === 'foliage' && p.some((v) => v[1] < 12))) return;
    const bottom = Math.min(...p.map((v) => v[1]));
    const ps = p.map(([x, y, z]) => [
        x,
        n[1] < 0.98 && y === bottom && (y === 0 || (s === 'stone' && [4, 7, 12].includes(y)))
          ? Math.min(y - 8, akershusGround(x, z) - 1.5)
          : y - 8,
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
  buildAkershusRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildAkershusReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildAkershusReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildAkershusReviewedDistrict = (o) => reviewed(o, 'district');
export const buildAkershusReviewedStreet = (o) => reviewed(o, 'street');
export const buildAkershusReviewedCloseup = (o) => reviewed(o, 'closeup');

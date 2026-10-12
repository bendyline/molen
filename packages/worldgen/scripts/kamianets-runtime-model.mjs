/** Picture-based Kamianets-Podilskyi Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { buildKamianetsRuntime } from './kamianets-castle-model.mjs';
import { normalFor } from './authored-structure-mesh.mjs';
const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u8/u8d/n0278_kamianets_podilskyi_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    shingle: [0.6505758810377034, 0.6003915913257906, 0.4807971262820383],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
  };
export function kamianetsGround(x, z) {
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
        y === 0 && n[1] < 0.98 ? Math.min(11, kamianetsGround(x, z) - 1.5) : y + 11,
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
  buildKamianetsRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildKamianetsReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildKamianetsReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildKamianetsReviewedDistrict = (o) => reviewed(o, 'district');
export const buildKamianetsReviewedStreet = (o) => reviewed(o, 'street');
export const buildKamianetsReviewedCloseup = (o) => reviewed(o, 'closeup');

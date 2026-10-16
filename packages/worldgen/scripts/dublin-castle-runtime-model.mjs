/** Picture-based Dublin Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildDublinRuntime, buildDublinSkyline } from './dublin-castle-model.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/gc/gc7/n0275_dublin_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    slate: [0.5949296246834199, 0.6327938708909794, 0.6537532348745474],
    patina: [0.6357568684279634, 0.680368873795494, 0.6174688939562135],
  };
export function dublinGround(x, z) {
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
    if ((far && n[1] < -0.98) || (n[1] > 0.98 && p.every((v) => v[1] === 0))) return;
    const ps = p.map(([x, y, z]) => [
        x,
        y <= 0.1 && n[1] > 0.98
          ? (x + 16.462) ** 2 + (z - 24.086) ** 2 < 29.2 ** 2
            ? 0.4 + y
            : dublinGround(x, z) + y + 0.08
          : y === 0
            ? Math.min(4.5, dublinGround(x, z) - 1.5)
            : y + 4.5,
        z,
      ]),
      col = far
        ? c.map(
            (v, i) => (v * (MEANS[s]?.[i] ?? 1)) / (s === 'glass' || s === 'foliage' ? 1 : 0.65),
          )
        : c;
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
  const target = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit]),
  );
  far ? buildDublinSkyline(target) : buildDublinRuntime(target, level);
}
export const buildDublinReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildDublinReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildDublinReviewedDistrict = (o) => reviewed(o, 'district');
export const buildDublinReviewedStreet = (o) => reviewed(o, 'street');
export const buildDublinReviewedCloseup = (o) => reviewed(o, 'closeup');

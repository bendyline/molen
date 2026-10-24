/** Picture-based Lubart's Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildLubartRuntime, buildLubartSkyline } from './lubart-castle-model.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u9/u94/lubarts_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    shingle: [0.6505758810377034, 0.6003915913257906, 0.4807971262820383],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  };
export function lubartGround(x, z) {
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
        y === 0 && n[1] < 0.98 ? Math.min(3.2, lubartGround(x, z) - 1.5) : y + 3.2,
        z,
      ]),
      col = far
        ? c.map(
            (v, i) => (v * (MEANS[s]?.[i] ?? 1)) / (['glass', 'foliage'].includes(s) ? 1 : 0.65),
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
  far ? buildLubartSkyline(target) : buildLubartRuntime(target, level);
}
export const buildLubartReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildLubartReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildLubartReviewedDistrict = (o) => reviewed(o, 'district');
export const buildLubartReviewedStreet = (o) => reviewed(o, 'street');
export const buildLubartReviewedCloseup = (o) => reviewed(o, 'closeup');

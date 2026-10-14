/** Picture-based Elmina Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { buildElminaRuntime } from './elmina-castle-model.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/eb/ebz/n0287_elmina_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    limestone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    foliage: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
  };
export function elminaGround(x, z) {
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
        x * 0.9,
        y === 0 && n[1] < 0.98
          ? Math.min(0.8, elminaGround(x * 0.9, z * 0.9) - 1.5)
          : y +
            0.8 +
            ((s === 'wood' || Math.abs(y - 3.55) < 1e-6) &&
            y <= 4.75 &&
            z > 36 &&
            Math.abs(x + 47) < 3
              ? Math.min(1, (z - 36) / 30) * (elminaGround(-42.3, 59.4) + 0.65 - 4.8)
              : 0),
        z * 0.9,
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
  buildElminaRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
}
export const buildElminaReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildElminaReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildElminaReviewedDistrict = (o) => reviewed(o, 'district');
export const buildElminaReviewedStreet = (o) => reviewed(o, 'street');
export const buildElminaReviewedCloseup = (o) => reviewed(o, 'closeup');

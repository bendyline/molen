/** Picture-based Kalmar Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { normalFor } from './authored-structure-mesh.mjs';
import { kalmarParts, kalmarPlanPoint } from './kalmar-castle-model.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/u6/u65/n0296_kalmar_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    rubble: [0.6477386511264271, 0.6303290420978949, 0.5582142312416606],
    carved: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    patina: [0.6357568684279634, 0.680368873795494, 0.6174688939562135],
    metal: [0.7166240388540023, 0.7468631624871399, 0.755585931520634],
    aggregate: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
  };
export function kalmarGround(x, z) {
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
  let bridge = false;
  const start = kalmarPlanPoint(-98.235, 21.811),
    end = kalmarPlanPoint(-65.898, 3.359),
    dx = end[0] - start[0],
    dz = end[1] - start[1],
    lengthSquared = dx * dx + dz * dz;
  function emit(s, r, p, n, uv, c) {
    if (far && n[1] < -0.98) return;
    const ps = p.map(([x, y, z]) =>
        [
          x,
          y <= 0.301
            ? kalmarGround(x, z) - 0.4
            : y +
              0.5 +
              (bridge && y > 3
                ? (1 -
                    Math.max(
                      0,
                      Math.min(1, ((x - start[0]) * dx + (z - start[1]) * dz) / lengthSquared),
                    )) *
                  (kalmarGround(...start) + 0.2 - 4.7)
                : 0),
          z,
        ].map(Math.fround),
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
  const target = Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit]),
    ),
    detail = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  for (const [name, build] of Object.entries(kalmarParts)) {
    bridge = name === 'bridge';
    build(target, detail);
  }
}
export const buildKalmarReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildKalmarReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildKalmarReviewedDistrict = (o) => reviewed(o, 'district');
export const buildKalmarReviewedStreet = (o) => reviewed(o, 'street');
export const buildKalmarReviewedCloseup = (o) => reviewed(o, 'closeup');

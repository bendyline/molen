/** Picture-based Saint Michael's Castle exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { buildSaintMichaelRuntime } from './saint-michaels-castle-model.mjs';
import { normalFor } from './authored-structure-mesh.mjs';
const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ud/udt/n0300_saint_michael_s_castle/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    stone: [0.753900431769648, 0.7102426360381505, 0.6162437456625109],
    granite: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    copper: [0.6357568684279634, 0.680368873795494, 0.6174688939562135],
    painted: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    paving: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
  };
export function saintMichaelGround(x, z) {
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
        [x, y === 0 && n[1] < 0.98 ? -21.75 : y - 21, z].map(Math.fround),
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
  buildSaintMichaelRuntime(
    Object.fromEntries(['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [k, emit])),
    level,
  );
  // Bounded paved apron fills the viewer's reversible ground opening.
  const inner = [
      [-83, -84],
      [86, -84],
      [86, 86],
      [-83, 86],
    ],
    outer = [
      [-85, -86],
      [88, -86],
      [88, 88],
      [-85, 88],
    ],
    color = [0.485, 0.445, 0.38].map((v, i) => (far ? v * MEANS.paving[i] : v));
  function floor(points) {
    const ps = points.map((p) => p.map(Math.fround));
    for (let i = 1; i < ps.length - 1; i++) {
      const t = [ps[0], ps[i], ps[i + 1]];
      o.addTriangle(
        'paving',
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  }
  floor(inner.map(([x, z]) => [x, -21.15, z]).reverse());
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      a = inner[i],
      b = inner[j],
      A = outer[i],
      B = outer[j];
    floor([
      [b[0], -21.15, b[1]],
      [a[0], -21.15, a[1]],
      [A[0], saintMichaelGround(...A) + 0.05, A[1]],
      [B[0], saintMichaelGround(...B) + 0.05, B[1]],
    ]);
  }
}
export const buildSaintMichaelReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildSaintMichaelReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildSaintMichaelReviewedDistrict = (o) => reviewed(o, 'district');
export const buildSaintMichaelReviewedStreet = (o) => reviewed(o, 'street');
export const buildSaintMichaelReviewedCloseup = (o) => reviewed(o, 'closeup');

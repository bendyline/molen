/** Picture-based Aljafería exterior fit to standard viewer PMTiles. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { aljaferiaParts } from './aljaferia-palace-model.mjs';
import { normalFor } from './authored-structure-mesh.mjs';

const grade = JSON.parse(
    readFileSync(
      new URL(
        '../../../content/worldgen/source/places/ez/ezr/n0294_aljaferia/pmtiles-fit.json',
        import.meta.url,
      ),
    ),
  ),
  MEANS = {
    limestone: [0.6849383831581978, 0.6023767969729558, 0.46768227309766186],
    plaster: [0.8560149893924018, 0.8277277519506693, 0.7276425175607023],
    brick: [0.6203447773399442, 0.5498229265059562, 0.5049628982589958],
    tile: [0.5592671977481501, 0.5524651935698748, 0.5295030481008905],
    wood: [0.8251277774132705, 0.8251277774132705, 0.8251277774132705],
    aggregate: [0.6893546167686782, 0.6750929657086415, 0.6305210116163465],
  };
export function aljaferiaGround(x, z) {
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
  let scarp = false;
  const angle = 0.093502934695,
    cs = Math.cos(angle),
    sn = Math.sin(angle);
  function emit(s, r, p, n, uv, c) {
    if (far && n[1] < -0.98) return;
    if (scarp && s === 'foliage') return;
    const ps = p.map(([x, y, z]) => {
        let h = y + 5.5;
        if (scarp) {
          if (s === 'limestone' && y < -4) h = aljaferiaGround(x, z) - 0.3;
          if (
            s === 'aggregate' &&
            (Math.abs(y + 0.32) < 0.001 || Math.abs(y - 0.02) < 0.001 || Math.abs(y - 0.9) < 0.001)
          ) {
            const px = cs * x - sn * z,
              pz = sn * x + cs * z,
              t = Math.max(0, Math.min(1, Math.max(px - 52, -px - 55, pz - 48, -pz - 48) / 14));
            h += t * (aljaferiaGround(x, z) + 0.15 - 5.5);
          }
        } else if (y === 0 && n[1] < 0.98) h = Math.min(5.5, aljaferiaGround(x, z) - 1.5);
        return [x, h, z].map(Math.fround);
      }),
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
    d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level];
  for (const [name, build] of Object.entries(aljaferiaParts)) {
    scarp = name === 'moat';
    build(target, d);
  }
}
export const buildAljaferiaReviewedMaster = (o) => reviewed(o, 'closeup');
export const buildAljaferiaReviewedSkyline = (o) => reviewed(o, 'skyline');
export const buildAljaferiaReviewedDistrict = (o) => reviewed(o, 'district');
export const buildAljaferiaReviewedStreet = (o) => reviewed(o, 'street');
export const buildAljaferiaReviewedCloseup = (o) => reviewed(o, 'closeup');

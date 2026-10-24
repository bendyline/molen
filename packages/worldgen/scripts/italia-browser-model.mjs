/** Curved Italia tower with shared concrete sunshades and tiered window/louver impressions. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import {
  face,
  guardrail,
  localOutline,
  rectangularPlan,
  ringAt,
  shift,
  solidPlan,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(readFileSync(structureSourcePath('edificio_italia', 'map-frame.json'))),
  MEANS = {
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    glass: [1, 1, 1],
  },
  pale = [0.75, 0.75, 0.68];
function writer(out, far) {
  const tri = (s, p, c) => {
    p = p.map((v) => v.map(Math.fround));
    const a = p[1].map((v, i) => v - p[0][i]),
      b = p[2].map((v, i) => v - p[0][i]);
    if (Math.hypot(...cross(a, b)) < 1e-10) return;
    out.addTriangle(
      s,
      'palette:#ffffff',
      p,
      normalFor(...p),
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      far ? c.map((v, i) => v * (MEANS[s]?.[i] ?? 1)) : c,
    );
  };
  return {
    addTriangle(s, _r, p, _n, _u, c) {
      tri(s, p, c);
    },
    addQuad(s, _r, p, _n, _u, c) {
      tri(s, p.slice(0, 3), c);
      tri(s, [p[0], p[2], p[3]], c);
    },
    addConvexPolygon(s, _r, p, _n, _u, c) {
      for (let i = 1; i < p.length - 1; i++) tri(s, [p[0], p[i], p[i + 1]], c);
    },
  };
}

function simplify(points, error) {
  const p = points.slice();
  if (Math.hypot(...p.at(-1).map((v, i) => v - p[0][i])) < 0.001) p.pop();
  const rdp = (ps) => {
    if (ps.length < 3) return ps;
    const a = ps[0],
      b = ps.at(-1),
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      len = dx * dx + dz * dz;
    let max = error,
      index = -1;
    for (let i = 1; i < ps.length - 1; i++) {
      const q = ps[i],
        t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / (len || 1))),
        d = Math.hypot(q[0] - a[0] - dx * t, q[1] - a[1] - dz * t);
      if (d > max) {
        max = d;
        index = i;
      }
    }
    return index < 0
      ? [a, b]
      : [...rdp(ps.slice(0, index + 1)).slice(0, -1), ...rdp(ps.slice(index))];
  };
  let k = 1;
  for (let i = 2; i < p.length; i++)
    if (
      Math.hypot(...p[i].map((v, j) => v - p[0][j])) >
      Math.hypot(...p[k].map((v, j) => v - p[0][j]))
    )
      k = i;
  return [...rdp(p.slice(0, k + 1)).slice(0, -1), ...rdp([...p.slice(k), p[0]]).slice(0, -1)];
}

function _closed(p, error) {
  const q = simplify(p, error);
  return [...q, q[0]];
}

function build(target, tier) {
  const out = writer(target, tier === 0),
    plan = simplify(localOutline(map), [2.4, 1, 0.35, 0.1][tier]);
  solidPlan(out, 'stone', plan, 0, 0.45, [0.4, 0.42, 0.4]);
  function curtain(p, lo, hi, pitch, rows, fin = true) {
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.04) continue;
      const n = [(a[1] - b[1]) / len, 0, (b[0] - a[0]) / len],
        cols = Math.max(1, Math.ceil(len / pitch)),
        point = (u, y, d = 0) =>
          shift([a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u], n, d);
      for (let j = 0; j < cols; j++)
        for (let k = 0; k < rows; k++) {
          const y = lo + ((hi - lo) * k) / rows,
            y1 = lo + ((hi - lo) * (k + 1)) / rows;
          face(
            out,
            'glass',
            [
              point(j / cols, y),
              point((j + 1) / cols, y),
              point((j + 1) / cols, y1),
              point(j / cols, y1),
            ],
            (i + j + k) % 7 === 0 ? [0.44, 0.46, 0.4] : [0.27, 0.3, 0.28],
          );
          if (tier === 3 && (i + j + k) % 7 === 0)
            for (let l = 1; l < 5; l++) {
              const yy = y + ((y1 - y) * l) / 5;
              face(
                out,
                'metal',
                [
                  point(j / cols, yy, 0.1),
                  point((j + 1) / cols, yy, 0.1),
                  point((j + 1) / cols, yy + 0.085, 0.1),
                  point(j / cols, yy + 0.085, 0.1),
                ],
                [0.63, 0.63, 0.55],
              );
            }
        }
      if (fin)
        for (let j = 0; j < cols; j++)
          beam(
            out,
            'concrete',
            point(j / cols, lo, 0.22),
            point(j / cols, hi, 0.22),
            0.13,
            0.52,
            pale,
          );
      for (let k = 1; k <= rows; k++) {
        const y = lo + ((hi - lo) * k) / rows;
        face(
          out,
          'concrete',
          [
            point(0, y - 0.1, 0.28),
            point(1, y - 0.1, 0.28),
            point(1, y + 0.1, 0.28),
            point(0, y + 0.1, 0.28),
          ],
          [0.72, 0.72, 0.66],
        );
        if (tier > 0)
          face(
            out,
            'concrete',
            [
              point(0, y + 0.1, 0),
              point(1, y + 0.1, 0),
              point(1, y + 0.1, 0.52),
              point(0, y + 0.1, 0.52),
            ],
            [0.72, 0.72, 0.66],
          );
      }
    }
  }
  curtain(plan, 0.45, 10, [30, 12, 4, 1.7][tier], [1, 2, 3, 3][tier], tier > 0);
  curtain(plan, 10, 150.6, [30, 10, 3.4, 1.7][tier], [4, 10, 22, 44][tier]);
  solidPlan(out, 'concrete', plan, 150.6, 151, pale);
  const top = plan.map(([x, z]) => [x * 0.92, z * 0.88]);
  curtain(top, 151, 158.5, [30, 12, 4, 1.7][tier], tier === 0 ? 1 : 2, tier > 0);
  solidPlan(out, 'concrete', top, 158.5, 159.3, pale);
  if (tier > 1) guardrail(out, ringAt(top, 159.3), 1.1, [0.43, 0.46, 0.43]);
  else curtain(top, 159.3, 160.4, 100, 1, false);
  solidPlan(out, 'metal', rectangularPlan(14, 8, 1, 0), 159.3, 164.2, [0.58, 0.6, 0.57]);
  for (let x = -5; x <= 7; x += [12, 4, 2.4, 1.2][tier])
    box(out, 'metal', [x, 164.2, -3.5], [x + 0.12, 165, 3.5], [0.44, 0.47, 0.45]);
}
export const buildItaliaSkyline = (o) => build(o, 0),
  buildItaliaDistrict = (o) => build(o, 1),
  buildItaliaStreet = (o) => build(o, 2),
  buildItaliaCloseup = (o) => build(o, 3);

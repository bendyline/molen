/** Mirante do Vale: mapped thin slab, window/AC grid and pictured open roof structure. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import {
  bandPlan,
  face,
  grid,
  localOutline,
  solidPlan,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(
    readFileSync(structureSourcePath('n0138_mirante_do_vale', 'map-frame.json')),
  ),
  MEANS = {
    stone: [0.7011092892788303, 0.7011092892788303, 0.7011092892788303],
    concrete: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
    metal: [0.9088893864967214, 0.9088893864967214, 0.9088893864967214],
    glass: [1, 1, 1],
  };
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
function build(target, tier) {
  const out = writer(target, tier === 0),
    plan = localOutline(map),
    metal = [0.66, 0.67, 0.63],
    glass = [0.29, 0.34, 0.35],
    pitch = [20, 10, 3.33, 3.33][tier];
  solidPlan(out, 'stone', plan, 0, 0.55, [0.37, 0.38, 0.37]);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.04) continue;
    for (const [lo, hi, color] of [
      [0.55, 7, [0.18, 0.22, 0.23]],
      [7, 160, glass],
    ])
      grid(
        out,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        color,
        [16, 4.8, 1.6, 1.6][tier],
        tier === 0 ? 30 : tier === 1 ? 10 : 3.33,
        tier === 0 ? 0.08 : 0.12,
        metal,
      );
  }
  for (let y = 7; y < 160; y += pitch) {
    if (tier === 0) {
      for (let i = 0; i < plan.length; i++) {
        const a = plan[i],
          b = plan[(i + 1) % plan.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (len < 0.04) continue;
        const nx = ((a[1] - b[1]) / len) * 0.03,
          nz = ((b[0] - a[0]) / len) * 0.03;
        face(
          out,
          'metal',
          [
            [a[0] + nx, y, a[1] + nz],
            [b[0] + nx, y, b[1] + nz],
            [b[0] + nx, y + 0.18, b[1] + nz],
            [a[0] + nx, y + 0.18, a[1] + nz],
          ],
          [0.58, 0.6, 0.58],
        );
      }
    } else bandPlan(out, plan, y, 0.18, 0.22, [0.58, 0.6, 0.58], 'metal');
  }
  solidPlan(out, 'metal', plan, 159.95, 160.1, [0.31, 0.33, 0.33]);
  // The reference shows an exposed upper structural frame, not a filled roof block.
  for (const y of tier === 0 ? [160, 169.8] : [160, 163.33, 166.66, 169.8])
    bandPlan(out, plan, y, 0.2, 0.23, metal, 'metal');
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length],
      len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (len < 0.04) continue;
    const count = Math.max(1, Math.ceil(len / [18, 9, 4.8, 4.8][tier]));
    for (let j = 0; j < count; j++) {
      const t = j / count,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      beam(out, 'metal', [x, 160, z], [x, 170, z], 0.2, 0.22, metal);
    }
  }
  if (tier > 0) box(out, 'concrete', [-7, 160.1, -3.5], [7, 168, 3.5], [0.46, 0.47, 0.44]);
  if (tier > 0)
    for (const z of [-9.33, 9.35])
      for (let floor = 3; floor < 44; floor += tier === 1 ? 6 : 1)
        for (let bay = 0; bay < 36; bay++)
          if ((floor * 19 + bay * 7 + (z > 0 ? 3 : 0)) % 13 === 0) {
            const x = -29 + bay * 1.65,
              y = 8 + floor * 3.33;
            box(
              out,
              'metal',
              [x - 0.4, y, z - (z < 0 ? 0.42 : 0)],
              [x + 0.4, y + 0.6, z + (z > 0 ? 0.42 : 0)],
              [0.54, 0.55, 0.51],
            );
            if (tier === 3)
              for (let k = 1; k < 5; k++)
                beam(
                  out,
                  'metal',
                  [x - 0.35, y + k * 0.115, z + (z > 0 ? 0.43 : -0.43)],
                  [x + 0.35, y + k * 0.115, z + (z > 0 ? 0.43 : -0.43)],
                  0.022,
                  0.025,
                  [0.25, 0.28, 0.28],
                );
          }
  // Retained source approximations for four current observation boxes; picture predates them.
  for (const [x, z, sx, sz] of [
    [0, 10.2, 2.1, 2.5],
    [0, -10.2, 2.1, 2.5],
    [34, 0, 2.5, 2.1],
    [-35, 0, 2.5, 2.1],
  ]) {
    box(
      out,
      'glass',
      [x - sx / 2, 150, z - sz / 2],
      [x + sx / 2, 153, z + sz / 2],
      [0.28, 0.42, 0.45],
    );
    if (tier > 0)
      for (const xx of [x - sx / 2, x + sx / 2])
        for (const zz of [z - sz / 2, z + sz / 2])
          beam(out, 'metal', [xx, 150, zz], [xx, 153, zz], 0.05, 0.05, metal);
  }
}
export const buildMiranteSkyline = (o) => build(o, 0),
  buildMiranteDistrict = (o) => build(o, 1),
  buildMiranteStreet = (o) => build(o, 2),
  buildMiranteCloseup = (o) => build(o, 3);

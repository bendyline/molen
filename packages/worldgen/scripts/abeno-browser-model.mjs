/** Abeno Harukas derivatives preserve the western tower, stepped envelope and open sky court. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import { beam, cross, normalFor } from './authored-structure-mesh.mjs';
import {
  face,
  bandPlan as fullBandPlan,
  grid,
  guardrail,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  rectangularPlan,
  ringAt,
  solidPlan,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const map = JSON.parse(readFileSync(structureSourcePath('n0139_abeno_harukas', 'map-frame.json'))),
  MEANS = {
    foundation: [0.7108161524542215, 0.7108161524542215, 0.6819278525713045],
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
  function glazedOutline(out, plan, lo, hi, dy, color, frameColor, frame) {
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.04) continue;
      grid(
        out,
        [
          [a[0], lo, a[1]],
          [b[0], lo, b[1]],
          [b[0], hi, b[1]],
          [a[0], hi, a[1]],
        ],
        color,
        [30, 9.6, 3.2, 1.6][tier],
        dy * [8, 4, 2, 1][tier],
        tier === 0 ? 0 : frame,
        frameColor,
      );
    }
  }

  function bandPlan(out, plan, y, h, depth, color, slot = 'concrete') {
    if (tier > 0) return fullBandPlan(out, plan, y, h, depth, color, slot);
    for (let i = 0; i < plan.length; i++) {
      const a = plan[i],
        b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.04) continue;
      const nx = ((a[1] - b[1]) / len) * 0.03,
        nz = ((b[0] - a[0]) / len) * 0.03;
      face(
        out,
        slot,
        [
          [a[0] + nx, y, a[1] + nz],
          [b[0] + nx, y, b[1] + nz],
          [b[0] + nx, y + h, b[1] + nz],
          [a[0] + nx, y + h, a[1] + nz],
        ],
        color,
      );
    }
  }
  const out = writer(target, tier === 0),
    m = map;
  const plan = localOutline(m);
  const towerPlan = partPlan(
    m,
    partsEvidence('n0139_abeno_harukas').find((p) => p.id === 488467176),
  );
  mappedSolid(out, 'foundation', plan, 0, 0.5, [0.5, 0.52, 0.51]);
  for (let i = 0; i < plan.length; i++) {
    const a = plan[i],
      b = plan[(i + 1) % plan.length];
    if ((a[0] + b[0]) / 2 < -48.6) continue;
    grid(
      out,
      [
        [a[0], 0.5, a[1]],
        [b[0], 0.5, b[1]],
        [b[0], 44, b[1]],
        [a[0], 44, a[1]],
      ],
      [0.32, 0.39, 0.41],
      [30, 9.6, 3.2, 1.6][tier],
      4.3 * [8, 4, 2, 1][tier],
      tier === 0 ? 0 : 0.11,
      [0.72, 0.74, 0.74],
    );
  }
  mappedCap(out, 'concrete', plan, 44, [0.6, 0.62, 0.61]);
  for (let y = 5; y < 44; y += 4.3 * [8, 4, 2, 1][tier])
    bandPlan(out, plan, y, 0.22, 0.3, [0.72, 0.73, 0.72], 'metal');
  const stages = [
    [-92, 0, 84, 82, 0.5, 80],
    [-89, -7, 78, 66, 80, 190],
    [-88, -18, 76, 42, 190, 287],
  ];
  for (const [cx, cz, w, d, a, b] of stages) {
    const ring = a < 1 ? towerPlan : rectangularPlan(w, d, cx, cz);
    glazedOutline(
      out,
      ring,
      a,
      b,
      a < 1 ? 4.8 : 4.65,
      [0.34, 0.43, 0.47],
      [0.65, 0.71, 0.73],
      0.072,
    );
    for (let y = a + 4.65; y < b; y += 4.65 * [8, 4, 2, 1][tier])
      bandPlan(out, ring, y, 0.22, 0.2, [0.67, 0.73, 0.75], 'metal');
    mappedSolid(out, 'metal', ring, b, b + 0.25, [0.54, 0.59, 0.59]);
    if (tier > 1) guardrail(out, ringAt(ring, b + 0.25), 1.15, [0.56, 0.61, 0.62]);
    // The glass skin includes continuous vertical projecting fins and deep shadow-box strips.
    for (let x = cx - w / 2 + 3; tier > 1 && a >= 1 && x < cx + w / 2; x += 3.9)
      for (const z of [cz - d / 2, cz + d / 2])
        beam(out, 'metal', [x, a + 0.1, z], [x, b, z], 0.1, 0.42, [0.67, 0.74, 0.77]);
    if (tier === 3 && b < 287) {
      for (let x = cx - w / 2 + 2; x < cx + w / 2 - 4; x += 8)
        box(
          out,
          'concrete',
          [x, b + 0.25, cz + d / 2 - 7],
          [x + 4, b + 1.25, cz + d / 2 - 3],
          [0.34, 0.4, 0.33],
        );
    }
  }
  const top = rectangularPlan(76, 42, -88, -18),
    inner = rectangularPlan(49, 19, -88, -18);
  // Open-air sky garden under the surrounding glazed observation gallery.
  glazedOutline(out, top, 287.25, 299.75, 4.15, [0.37, 0.46, 0.48], [0.7, 0.76, 0.76], 0.095);
  glazedOutline(
    out,
    inner.toReversed(),
    287.25,
    296,
    4.15,
    [0.32, 0.4, 0.42],
    [0.65, 0.7, 0.72],
    0.1,
  );
  mappedCap(out, 'metal', top, 299.75, [0.64, 0.69, 0.68], [inner]);
  bandPlan(out, top, 299.75, 0.25, 0.4, [0.72, 0.75, 0.74], 'metal');
  solidPlan(out, 'concrete', inner, 287, 287.25, [0.49, 0.47, 0.42]);
  for (let bay = 0; tier > 1 && bay < 9; bay++)
    for (const z of [-39, 3]) {
      const x = -125.5 + (75 * bay) / 9,
        nextX = -125.5 + (75 * (bay + 1)) / 9;
      beam(out, 'metal', [x, 289, z], [nextX, 298.7, z], 0.33, 0.4, [0.75, 0.79, 0.79]);
      beam(out, 'metal', [nextX, 289, z], [x, 298.7, z], 0.33, 0.4, [0.75, 0.79, 0.79]);
    }
  for (let x = -124; tier === 3 && x < -54; x += 10)
    box(out, 'metal', [x, 44.1, 17], [x + 4.5, 47.2, 25], [0.61, 0.65, 0.65]);
}

export const buildAbenoSkyline = (o) => build(o, 0),
  buildAbenoDistrict = (o) => build(o, 1),
  buildAbenoStreet = (o) => build(o, 2),
  buildAbenoCloseup = (o) => build(o, 3);

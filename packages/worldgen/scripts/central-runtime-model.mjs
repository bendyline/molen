/** Central Plaza: signed triangular facade, open green-granite base and three-legged crown. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing, torus } from './authored-structure-mesh.mjs';
import {
  bandPlan,
  face,
  guardrail,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const scope = JSON.parse(
    readFileSync(structureSourcePath('n0181_central_plaza', 'review-scope.json')),
  ),
  map = JSON.parse(readFileSync(structureSourcePath('n0181_central_plaza', 'map-frame.json')));
const settings = {
  skyline: { mult: 0, sides: 4, rings: false, roof: 0 },
  district: { mult: 12, sides: 8, rings: false, roof: 8 },
  street: { mult: 3, sides: 12, rings: true, roof: 3 },
  closeup: { mult: 1, sides: 24, rings: true, roof: 1 },
};
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.035);
}
function plazaBand(out, cfg, plan, y, h, depth, color) {
  if (cfg.mult !== 12) return bandPlan(out, plan, y, h, depth, color, 'metal');
  // District keeps the published transfer/crown bands as shallow continuous strips.
  for (const { a, b, n } of edges(plan))
    face(
      out,
      'metal',
      [
        [a[0], y, a[1]],
        [b[0], y, b[1]],
        [b[0], y + h, b[1]],
        [a[0], y + h, a[1]],
      ].map((p) => shift(p, n, depth / 2)),
      color,
    );
}

function plazaFacade(
  out,
  cfg,
  plan,
  y0,
  y1,
  { gold = [0.49, 0.445, 0.34], scratch = false, step = 3.6 } = {},
) {
  for (const { a, b, len, n } of edges(plan)) {
    const cols = Math.max(1, Math.round(len / 1.53)),
      rows = Math.max(1, Math.round((y1 - y0) / step));
    const at = (u, y, d = 0) =>
      shift([a[0] + (b[0] - a[0]) * u, y, a[1] + (b[1] - a[1]) * u], n, d);
    const pane = (i, y) => {
      let c = len < 15 ? [0.5, 0.56, 0.58] : gold;
      const center = (i + 0.5) / cols - 0.5;
      if (scratch && len > 35) {
        const stripes =
            y < 92 ? [0] : y < 171 ? [-0.057, 0, 0.057] : [-0.114, -0.057, 0, 0.057, 0.114],
          zone =
            (y > 43 && y < 88) ||
            (y > 102 && y < 159) ||
            (y > 188 && y < 249 - Math.abs(center) * 110);
        if (zone && stripes.some((u) => Math.round((u + 0.5) * cols - 0.5) === i))
          c = [0.74, 0.72, 0.63];
        else if (Math.abs(center) > 0.38) c = [0.53, 0.58, 0.59];
      }
      return c;
    };
    if (!cfg.mult) {
      const sum = [0, 0, 0],
        coverage = 0.052 / 2 + 0.052 / 4,
        mean = scope.sourceFacts.surfaceMeans.metal_painted;
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const c = pane(i, y0 + ((y1 - y0) * (j + 0.5)) / rows);
          for (let k = 0; k < 3; k++)
            sum[k] +=
              (c[k] * (1 - coverage) + [0.64, 0.62, 0.53][k] * mean[k] * coverage) / (cols * rows);
        }
      face(out, 'glass', [at(0, y0), at(1, y0), at(1, y1), at(0, y1)], sum);
      continue;
    }
    // One opaque backing plane, with narrow frit patches at the original pane phase.
    // This avoids splitting every plain pane into several height intervals.
    face(
      out,
      'glass',
      [at(0, y0), at(1, y0), at(1, y1), at(0, y1)],
      len < 15 ? [0.5, 0.56, 0.58] : gold,
    );
    if (scratch && len > 35) {
      for (let i = 0; i < cols; i++) {
        const center = (i + 0.5) / cols - 0.5;
        if (Math.abs(center) > 0.38)
          face(
            out,
            'glass',
            [
              at(i / cols, y0, 0.005),
              at((i + 1) / cols, y0, 0.005),
              at((i + 1) / cols, y1, 0.005),
              at(i / cols, y1, 0.005),
            ],
            [0.53, 0.58, 0.59],
          );
      }
      for (const [lo, hi, stripes] of [
        [43, 88, [0]],
        [102, 159, [-0.057, 0, 0.057]],
        [188, 249, [-0.114, -0.057, 0, 0.057, 0.114]],
      ])
        for (const stripe of stripes) {
          const i = Math.round((stripe + 0.5) * cols - 0.5),
            low = Math.max(y0, lo),
            high = Math.min(y1, hi - (lo === 188 ? Math.abs((i + 0.5) / cols - 0.5) * 110 : 0));
          if (high > low)
            face(
              out,
              'glass',
              [
                at(i / cols, low, 0.006),
                at((i + 1) / cols, low, 0.006),
                at((i + 1) / cols, high, 0.006),
                at(i / cols, high, 0.006),
              ],
              [0.74, 0.72, 0.63],
            );
        }
    }
    const nr = Math.max(1, Math.round(rows / cfg.mult)),
      nc = Math.max(1, Math.round(cols / cfg.mult));
    for (let j = 1; j <= nr; j++) {
      const y = y0 + ((y1 - y0) * j) / nr;
      face(
        out,
        'glass',
        [
          at(0, y - 0.49, 0.035),
          at(1, y - 0.49, 0.035),
          at(1, y - 0.1, 0.035),
          at(0, y - 0.1, 0.035),
        ],
        [0.63, 0.66, 0.63],
      );
    }
    for (let i = 0; i <= nc; i++) {
      const u = i / nc,
        w = 0.026 / len;
      face(
        out,
        'metal',
        [
          at(Math.max(0, u - w), y0, 0.04),
          at(Math.min(1, u + w), y0, 0.04),
          at(Math.min(1, u + w), y1, 0.04),
          at(Math.max(0, u - w), y1, 0.04),
        ],
        [0.64, 0.62, 0.53],
      );
      if (i % 3 === 0)
        beam(out, 'metal', at(u, y0, 0.035), at(u, y1, 0.035), 0.11, 0.15, [0.64, 0.57, 0.39]);
    }
  }
}
function plazaGlazedTriangle(out, cfg, a, b, tip) {
  tri(out, 'glass', [a, b, tip], [0.61, 0.66, 0.67]);
  if (!cfg.roof) return;
  const n = normalFor(a, b, tip),
    at = (p) => shift(p, n, 0.04),
    height = tip[1] - a[1],
    rows = Math.max(1, Math.round(height / (1.5 * cfg.roof)));
  for (let j = 1; j < rows; j++) {
    const t = j / rows,
      w = 0.03 / height;
    face(
      out,
      'metal',
      [
        at(lerp(a, tip, t - w)),
        at(lerp(b, tip, t - w)),
        at(lerp(b, tip, t + w)),
        at(lerp(a, tip, t + w)),
      ],
      [0.69, 0.66, 0.52],
    );
  }
  const width = Math.hypot(...a.map((v, k) => v - b[k])),
    cols = Math.max(1, Math.round(width / (2 * cfg.roof)));
  for (let i = 1; i < cols; i++) {
    const u = i / cols,
      w = 0.03 / width;
    tri(out, 'metal', [at(lerp(a, b, u - w)), at(lerp(a, b, u + w)), at(tip)], [0.69, 0.66, 0.52]);
  }
}
function buildCentralPlaza(out, m, cfg) {
  const pieces = map.elements,
    plan = localOutline(m),
    part = (id) =>
      partPlan(
        m,
        pieces.find((p) => p.id === id),
      );
  const center = [-0.01329, 4.79924],
    scale = (p, s) =>
      p.map(([x, z]) => [center[0] + (x - center[0]) * s, center[1] + (z - center[1]) * s]);
  const green = [0.19, 0.27, 0.225],
    gold = [0.67, 0.57, 0.36],
    silver = [0.68, 0.7, 0.65];
  mappedSolid(out, 'foundation', plan, 0, 0.18, [0.58, 0.57, 0.5]);
  // At the public base the 36 upper columns transfer onto 18 circular columns.
  // The inset glazed lobby preserves the open circulation outside those columns.
  const lobby = scale(plan, 0.73),
    clear = {
      ...out,
      addTriangle(slot, ...args) {
        out.addTriangle(slot === 'glass' ? 'clear_glass' : slot, ...args);
      },
      addQuad(slot, ...args) {
        out.addQuad(slot === 'glass' ? 'clear_glass' : slot, ...args);
      },
    };
  plazaFacade(clear, cfg, lobby, 0.18, 23.6, { gold: [0.51, 0.59, 0.55], step: 4.1 });
  for (const { a, b } of edges(plan).filter((e) => e.len > 35)) {
    for (let i = 0; i < 5; i++) {
      const p = lerp(a, b, 0.12 + i * 0.19),
        x = center[0] + (p[0] - center[0]) * 0.96,
        z = center[1] + (p[1] - center[1]) * 0.96;
      loft(
        out,
        'cladding',
        [
          radialRing(0.18, cfg.rings ? 1.51 : 1.4, cfg.rings ? 1.51 : 1.4, cfg.sides, [x, z]),
          ...(cfg.rings
            ? [
                radialRing(0.72, 1.51, 1.51, cfg.sides, [x, z]),
                radialRing(0.86, 1.4, 1.4, cfg.sides, [x, z]),
                radialRing(23.6, 1.4, 1.4, cfg.sides, [x, z]),
              ]
            : []),
          radialRing(24.8, cfg.rings ? 1.56 : 1.4, cfg.rings ? 1.56 : 1.4, cfg.sides, [x, z]),
        ],
        green,
      );
      if (cfg.rings)
        for (const y of [0.78, 23.6])
          torus(out, 'metal', [x, y, z], 1.45, 0.055, silver, cfg.sides, cfg.mult === 1 ? 4 : 3);
    }
  }
  // Three additional corner columns flank the recessed corner entry bays.
  for (const p of [
    [0, -24.3],
    [-25.25, 19.35],
    [25.25, 19.35],
  ]) {
    loft(
      out,
      'cladding',
      [radialRing(0.18, 1.5, 1.5, cfg.sides, p), radialRing(24.8, 1.4, 1.4, cfg.sides, p)],
      green,
    );
  }
  mappedSolid(out, 'cladding', plan, 24.8, 30.5, [0.28, 0.31, 0.275]);
  if (cfg.mult)
    for (const y of [24.9, 26.65, 28.4, 30.25]) plazaBand(out, cfg, plan, y, 0.13, 0.075, silver);
  // Recessed first-floor circulation balcony and its exposed edge/guardrails.
  const balcony = scale(plan, 0.82);
  mappedSolid(out, 'cladding', balcony, 6.35, 7.05, green);
  if (cfg.rings)
    guardrail(
      out,
      balcony.map(([x, z]) => [x, 7.05, z]),
      1.1,
      [0.6, 0.6, 0.52],
    );
  plazaFacade(out, cfg, plan, 30.5, 165.3, { scratch: true });
  plazaFacade(out, cfg, plan, 165.3, 172.3, { gold: [0.22, 0.27, 0.28], step: 3.5 });
  if (cfg.mult) plazaBand(out, cfg, plan, 171.6, 0.7, 0.12, silver);
  plazaFacade(out, cfg, plan, 172.3, 265.9, { scratch: true });
  // Mechanical crown contracts in independently mapped steps, then reaches the
  // glazed observation gallery at 292.5 mPD − 4.1 mPD = 288.4 m above ground.
  const tiers = [
    { plan: part(1047690916), y0: 265.9, y1: 275 },
    { plan: part(1047690915), y0: 275, y1: 282 },
    { plan: part(1047690914), y0: 282, y1: 288.4 },
  ];
  mappedCap(out, 'metal', plan, 265.85, [0.46, 0.47, 0.4]);
  for (const t of tiers) {
    plazaFacade(out, cfg, t.plan, t.y0, t.y1, { gold: [0.4, 0.46, 0.47], step: 3.2 });
    if (cfg.mult)
      for (const y of [t.y0 + 0.15, t.y1 - 0.6]) plazaBand(out, cfg, t.plan, y, 0.32, 0.11, gold);
    mappedCap(out, 'metal', t.plan, t.y1 - 0.08, [0.49, 0.51, 0.47]);
    if (cfg.mult && t.y1 === 275)
      for (const { a, b, n } of edges(t.plan))
        for (let j = 0; j < 7; j++) {
          const y = 266.6 + j * 0.36;
          face(
            out,
            'glass',
            [
              [a[0], y, a[1]],
              [b[0], y, b[1]],
              [b[0], y + 0.15, b[1]],
              [a[0], y + 0.15, a[1]],
            ].map((p) => shift(p, n, 0.07)),
            [0.16, 0.195, 0.19],
          );
        }
  }
  const roof = part(1047690914),
    apex = [center[0], 310.3, center[1]];
  for (const { a, b } of edges(roof))
    plazaGlazedTriangle(out, cfg, [a[0], 288.4, a[1]], [b[0], 288.4, b[1]], apex);
  // Gold-clad concrete feature frame: three legs at the truncated corners,
  // sloping roof struts and an open Vierendeel mast support (not a solid box).
  const feet = part(1047690915),
    tops = [];
  for (const p of feet) {
    const d = Math.hypot(p[0] - center[0], p[1] - center[1]),
      q = [center[0] + ((p[0] - center[0]) * 2.4) / d, center[1] + ((p[1] - center[1]) * 2.4) / d];
    tops.push(q);
    beam(out, 'metal', [p[0], 265.9, p[1]], [p[0], 288.4, p[1]], 0.95, 1.15, gold);
    beam(out, 'metal', [p[0], 288.4, p[1]], [q[0], 314.3, q[1]], 1.02, 1.22, gold);
    beam(out, 'metal', [q[0], 314.3, q[1]], [q[0], 330.05, q[1]], 0.68, 0.8, gold);
  }
  for (const y of [314.3, 318.25, 322.2, 326.15, 330.05])
    for (const { a, b } of edges(tops)) {
      beam(out, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.66, 1.2, gold);
      // Static daylight representation of Lightime's four illuminated bands.
      if (y < 330)
        face(
          out,
          'glass',
          [
            [a[0], y + 0.28, a[1]],
            [b[0], y + 0.28, b[1]],
            [b[0], y + 0.63, b[1]],
            [a[0], y + 0.63, a[1]],
          ],
          [0.74, 0.79, 0.75],
        );
    }
  loft(
    out,
    'metal',
    [
      radialRing(310.3, 0.8, 0.8, cfg.sides, center),
      radialRing(333.2, 0.66, 0.66, cfg.sides, center),
      radialRing(352.5, 0.43, 0.43, cfg.sides, center),
      radialRing(365.8, 0.2, 0.2, cfg.sides, center),
      radialRing(374.3, 0.035, 0.035, cfg.sides, center),
    ],
    gold,
  );
  if (cfg.rings)
    for (let y = 331.5; y < 364; y += 3.8)
      torus(
        out,
        'metal',
        [center[0], y, center[1]],
        0.66 - (y - 331.5) * 0.013,
        0.043,
        [0.74, 0.71, 0.58],
        cfg.sides,
        4,
      );
  // Bronze/glass door frames occupy all three recessed corner entry fronts.
  if (cfg.rings)
    for (const { a, b, len } of edges(lobby).filter((e) => e.len > 3 && e.len < 8)) {
      const p = lerp(a, b, 0.5),
        d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      for (const u of [-1.05, 0, 1.05])
        beam(
          out,
          'metal',
          [p[0] + d[0] * u, 0.2, p[1] + d[1] * u],
          [p[0] + d[0] * u, 3.45, p[1] + d[1] * u],
          0.09,
          0.12,
          gold,
        );
      beam(
        out,
        'metal',
        [p[0] - d[0] * 1.05, 3.45, p[1] - d[1] * 1.05],
        [p[0] + d[0] * 1.05, 3.45, p[1] + d[1] * 1.05],
        0.1,
        0.12,
        gold,
      );
    }
}

function build(out, level) {
  const cfg = settings[level];
  const target =
    level === 'skyline'
      ? Object.fromEntries(
          ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
            name,
            (slot, _ref, p, n, uv, c) => {
              const mean = slot.includes('glass')
                ? null
                : scope.sourceFacts.surfaceMeans[
                    slot === 'metal' ? 'metal_painted' : 'stone_granite'
                  ];
              out[name](
                'silhouette',
                'palette:#ffffff',
                p,
                n,
                uv,
                mean ? c.map((v, i) => v * mean[i]) : c,
              );
            },
          ]),
        )
      : out;
  buildCentralPlaza(target, map, cfg);
}
export const buildCentralReviewedMaster = (out) => build(out, 'closeup');
export const buildCentralSkyline = (out) => build(out, 'skyline');
export const buildCentralDistrict = (out) => build(out, 'district');
export const buildCentralStreet = (out) => build(out, 'street');
export const buildCentralCloseup = (out) => build(out, 'closeup');

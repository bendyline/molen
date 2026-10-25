/** Tuntex: open prongs and passage, planar facades and layered Chinese crown. */
import { readFileSync } from 'node:fs';
import { beam, loft, radialRing, torus } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'tuntex_sky_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  skyline: { mult: 0, crown: 6, seams: 0, mast: 6 },
  district: { mult: 16, crown: 12, seams: 0, mast: 8 },
  street: { mult: 3, crown: 2.8, seams: 7, mast: 12 },
  closeup: { mult: 1, crown: 1.4, seams: 14, mast: 16 },
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
function cleanPlan(plan) {
  let points = plan;
  for (let pass = 0; pass < 4; pass++) {
    const next = points.filter((p, i) => {
      const a = points[(i + points.length - 1) % points.length],
        b = points[(i + 1) % points.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return (
        len < 0.05 ||
        Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) / len > 0.045
      );
    });
    if (next.length === points.length || next.length < 3) break;
    points = next;
  }
  return clockwise(points);
}

/** Whole facade backing and independent long strips; no individual framed cells. */
function field(out, a, b, n, low, high, cfg, { bright = false, pink = false } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    depth = bright ? 0.58 : 0;
  const at = (t, y, d = 0) => [
    a[0] + (b[0] - a[0]) * t + n[0] * (depth + d),
    y,
    a[1] + (b[1] - a[1]) * t + n[2] * (depth + d),
  ];
  const trim = pink ? [0.54, 0.46, 0.42] : [0.2, 0.31, 0.3],
    glass = bright ? [0.26, 0.45, 0.44] : [0.12, 0.26, 0.26];
  const coverage = 0.085 / 2.25 + 1.06 / 4.02,
    mean = scope.sourceFacts.surfaceMeans.metal_painted;
  const c = cfg.mult
    ? glass
    : glass.map((v, i) => v * (1 - coverage) + trim[i] * mean[i] * coverage);
  face(out, 'glass', [at(0, low), at(1, low), at(1, high), at(0, high)], c);
  if (!cfg.mult) return;
  const quad = (u0, u1, y0, y1) =>
    face(
      out,
      'metal',
      [at(u0, y0, 0.012), at(u1, y0, 0.012), at(u1, y1, 0.012), at(u0, y1, 0.012)],
      trim,
    );
  const cols = Math.max(1, Math.round(len / (2.25 * cfg.mult))),
    width = pink ? 0.23 : 0.085;
  for (let k = 0; k <= cols; k++) {
    const t = k / cols;
    quad(Math.max(0, t - width / (2 * len)), Math.min(1, t + width / (2 * len)), low, high);
  }
  const rows = Math.max(1, Math.round((high - low) / (4.02 * cfg.mult)));
  for (let j = 0; j <= rows; j++) {
    const y = low + ((high - low) * j) / rows;
    quad(0, 1, Math.max(low, y - 0.34), Math.min(high, y + 0.72));
  }
}
function buildTuntex(out, m, level) {
  const cfg = settings[level],
    ev = map.elements,
    base = cleanPlan(localOutline(m));
  const plan = (id) =>
    cleanPlan(
      partPlan(
        m,
        ev.find((p) => p.id === id),
      ),
    );
  const legs = [plan(344740871), plan(344740872)],
    shaft = plan(344740874),
    stone = [0.72, 0.57, 0.49],
    trim = [0.39, 0.5, 0.47],
    dark = [0.13, 0.24, 0.24];
  mappedSolid(out, 'foundation', base, 0, 0.25, [0.48, 0.46, 0.43]);

  // The 13.1 m ground passage is explicitly clipped from both broad facades.
  for (const { a, b, n, len } of edges(base)) {
    const cuts = [0, 1];
    if (Math.abs(n[2]) > 0.9)
      for (const x of [-6.55, 6.55]) {
        const t = (x - a[0]) / (b[0] - a[0]);
        if (t > 0 && t < 1) cuts.push(t);
      }
    cuts.sort((a, b) => a - b);
    for (let k = 1; k < cuts.length; k++) {
      const aa = lerp(a, b, cuts[k - 1]),
        bb = lerp(a, b, cuts[k]),
        mid = lerp(aa, bb, 0.5),
        skip = Math.abs(n[2]) > 0.9 && Math.abs(mid[0]) < 6.55;
      const p = (v, y, o = 0) => [v[0] + n[0] * o, y, v[1] + n[2] * o];
      if (!skip) {
        const c = cfg.mult ? [0.19, 0.31, 0.32] : [0.21, 0.32, 0.33];
        face(out, 'glass', [p(aa, 0.25), p(bb, 0.25), p(bb, 8.3), p(aa, 8.3)], c);
        if (cfg.mult) {
          const count = Math.max(
            1,
            Math.round(Math.hypot(bb[0] - aa[0], bb[1] - aa[1]) / (1.5 * cfg.mult)),
          );
          for (let i = 0; i <= count; i++) {
            const q = lerp(aa, bb, i / count),
              length = Math.hypot(bb[0] - aa[0], bb[1] - aa[1]),
              tx = ((bb[0] - aa[0]) / length) * 0.06,
              tz = ((bb[1] - aa[1]) / length) * 0.06;
            face(
              out,
              'cladding',
              [
                [q[0] - tx + n[0] * 0.012, 0.25, q[1] - tz + n[2] * 0.012],
                [q[0] + tx + n[0] * 0.012, 0.25, q[1] + tz + n[2] * 0.012],
                [q[0] + tx + n[0] * 0.012, 8.3, q[1] + tz + n[2] * 0.012],
                [q[0] - tx + n[0] * 0.012, 8.3, q[1] - tz + n[2] * 0.012],
              ],
              stone,
            );
          }
        }
      }
      face(out, 'cladding', [p(aa, 8.3), p(bb, 8.3), p(bb, 50), p(aa, 50)], stone);
      if (cfg.mult)
        for (let j = 2; j < 12; j++) {
          const hi = 0.25 + ((j + 1) * 49.75) / 12;
          face(
            out,
            'glass',
            [
              p(aa, hi - 0.85, 0.012),
              p(bb, hi - 0.85, 0.012),
              p(bb, hi - 0.24, 0.012),
              p(aa, hi - 0.24, 0.012),
            ],
            [0.16, 0.22, 0.23],
          );
        }
    }
    const count = Math.max(1, Math.round(len / 15));
    for (let i = 0; i <= count; i++) {
      const q = lerp(a, b, i / count);
      if (Math.abs(q[0]) < 7 && Math.abs(n[2]) > 0.9) continue;
      if (level === 'street' || level === 'closeup')
        beam(
          out,
          'cladding',
          [q[0] + n[0] * 0.12, 0.4, q[1] + n[2] * 0.12],
          [q[0] + n[0] * 0.12, 49.8, q[1] + n[2] * 0.12],
          0.65,
          0.48,
          [0.8, 0.64, 0.55],
        );
    }
  }
  mappedCap(out, 'cladding', base, 50, stone);
  // Tunnel reveals and ceiling, deliberately leaving its middle open.
  for (const x of [-6.55, 6.55]) {
    const p = [
      [x, 0.25, -33.82],
      [x, 0.25, 33.82],
      [x, 8.3, 33.82],
      [x, 8.3, -33.82],
    ];
    face(out, 'cladding', x < 0 ? p.toReversed() : p, [0.66, 0.55, 0.47]);
  }
  face(
    out,
    'cladding',
    [
      [-6.55, 8.3, -33.82],
      [6.55, 8.3, -33.82],
      [6.55, 8.3, 33.82],
      [-6.55, 8.3, 33.82],
    ],
    [0.61, 0.53, 0.46],
  );
  const body = (poly, low, high, kind) => {
    for (const { a, b, n } of edges(poly)) {
      const front = Math.abs(n[2]) > 0.9,
        shaftFace = edges(shaft).find((e) => Math.abs(e.n[2]) > 0.9 && e.n[2] * n[2] > 0),
        join = shaftFace
          ? [Math.min(shaftFace.a[0], shaftFace.b[0]), Math.max(shaftFace.a[0], shaftFace.b[0])]
          : [-27.3, 27.3],
        cuts = [0, 1];
      for (const x of [-59, -18.5, -13, -8, 8, 13, 18.5, 59, ...join]) {
        const t = (x - a[0]) / (b[0] - a[0]);
        if (Number.isFinite(t) && t > 0 && t < 1) cuts.push(t);
      }
      cuts.sort((a, b) => a - b);
      const ys = [low, ...[59, 145, 185, 190].filter((y) => y > low && y < high), high];
      for (let j = 1; j < ys.length; j++)
        for (let i = 1; i < cuts.length; i++) {
          const aa = lerp(a, b, cuts[i - 1]),
            bb = lerp(a, b, cuts[i]),
            mid = lerp(aa, bb, 0.5),
            y0 = ys[j - 1],
            y1 = ys[j];
          if (
            kind === 'leg' &&
            y0 >= 145 &&
            (front ? mid[0] > join[0] && mid[0] < join[1] : Math.abs(mid[0]) < 8)
          )
            continue;
          if (kind === 'shaft' && !front && y1 <= 190) continue;
          const bright =
            kind === 'leg' &&
            front &&
            Math.abs(mid[0]) > 13 &&
            Math.abs(mid[0]) < 59 &&
            y0 >= 59 &&
            y1 <= 145;
          const pink = kind === 'shaft' && front && Math.abs(mid[0]) < 18.5 && y0 >= 185;
          field(out, aa, bb, n, y0, y1, cfg, { bright, pink });
        }
      if (cfg.mult && kind === 'shaft' && Math.abs(n[2]) > 0.9)
        for (const y of [196, 261, 312]) {
          beam(
            out,
            'cladding',
            [a[0] + n[0] * 0.2, y, a[1] + n[2] * 0.2],
            [b[0] + n[0] * 0.2, y, b[1] + n[2] * 0.2],
            0.55,
            0.38,
            stone,
          );
          if (cfg.mult)
            for (let k = 1; k < (level === 'district' ? 5 : 16); k++) {
              const q = lerp(a, b, k / (level === 'district' ? 5 : 16));
              beam(
                out,
                'cladding',
                [q[0] + n[0] * 0.34, y - 3.3, q[1] + n[2] * 0.34],
                [q[0] + n[0] * 0.34, y - 0.18, q[1] + n[2] * 0.34],
                0.56,
                0.55,
                [0.67, 0.58, 0.51],
              );
            }
        }
    }
  };
  // Three explicit ranges keep the bridge aperture and eliminate hidden
  // overlapping facade skins where the central tower joins the two prongs.
  for (const poly of legs) {
    body(poly, 50, 145, 'leg');
    body(poly, 145, 185, 'leg');
  }
  body(shaft, 145, 190, 'shaft');
  body(shaft, 190, 327, 'shaft');
  mappedCap(out, 'metal', shaft, 145, dark, [], true);
  mappedCap(out, 'metal', shaft, 327, trim);
  const lowCenter = plan(344740873);
  for (const { a, b, n } of edges(lowCenter)) field(out, a, b, n, 50, 70, cfg, { pink: true });
  mappedCap(out, 'cladding', lowCenter, 70, stone);
  // Decorative raised piers and a low saddle on the aperture sill.
  for (const z of [-33.84, 33.84])
    for (const x of [-6.6, 6.1]) {
      box(out, 'cladding', [x - 0.6, 68, z - 0.55], [x + 0.6, 76, z + 0.55], stone);
      const ring = clockwise([
        [x - 0.85, z - 0.85],
        [x + 0.85, z - 0.85],
        [x + 0.85, z + 0.85],
        [x - 0.85, z + 0.85],
      ]);
      loft(
        out,
        'cladding',
        [
          ring.map((p) => [p[0], 76, p[1]]),
          ring.map((p) => [x + (p[0] - x) * 0.28, 78, p[1] > z ? z + 0.24 : z - 0.24]),
        ],
        stone,
      );
    }
  if (level === 'street' || level === 'closeup')
    for (let i = 0; i < 7; i++) {
      const z = -29 + i * 9.5;
      beam(out, 'metal', [-7.3, 143.8, z], [7.0, 143.8, z], 0.48, 1.05, dark);
      beam(out, 'metal', [-7.3, 143.3, z], [0, 145, z], 0.24, 0.32, trim);
      beam(out, 'metal', [0, 145, z], [7.0, 143.3, z], 0.24, 0.32, trim);
    }
  // Pale framed projections on each lower prong; vertical relief and short
  // brackets below their sills are visible in the architect's harbor views.
  for (const sign of [-1, 1])
    for (const z of [-33.85, 33.85]) {
      const x0 = sign < 0 ? -59 : 13,
        x1 = sign < 0 ? -13 : 59,
        nz = Math.sign(z);
      if (cfg.mult)
        for (const x of [x0, x1])
          beam(
            out,
            'cladding',
            [x, 59, z + nz * 0.8],
            [x, 146.5, z + nz * 0.8],
            0.4,
            0.55,
            [0.63, 0.58, 0.51],
          );
      if (cfg.mult)
        for (const y of [59, 146.5])
          beam(
            out,
            'cladding',
            [x0, y, z + nz * 0.8],
            [x1, y, z + nz * 0.8],
            0.5,
            0.56,
            [0.68, 0.6, 0.53],
          );
      if (level === 'street' || level === 'closeup')
        for (let j = 0; j < 15; j++) {
          const x = x0 + ((j + 0.5) * (x1 - x0)) / (level === 'district' ? 5 : 15);
          beam(
            out,
            'cladding',
            [x, 55.5, z + nz * 0.4],
            [x, 58.8, z + nz * 0.8],
            0.45,
            0.55,
            stone,
          );
        }
    }
  const crown = (poly, y, height) => {
    for (const { a, b, n, len } of edges(poly)) {
      const segments = level === 'skyline' ? 4 : Math.max(6, 2 * Math.ceil(len / (2 * cfg.crown)));
      const rise = (t) =>
        y +
        1.3 +
        height * Math.pow(Math.abs(2 * t - 1), 5) +
        1.4 * Math.exp(-(((t - 0.5) / 0.11) ** 2));
      for (let i = 0; i < segments; i++) {
        const t0 = i / segments,
          t1 = (i + 1) / segments,
          p = lerp(a, b, t0),
          q = lerp(a, b, t1);
        face(
          out,
          'metal',
          [
            [p[0], y, p[1]],
            [q[0], y, q[1]],
            [q[0], rise(t1), q[1]],
            [p[0], rise(t0), p[1]],
          ],
          dark,
        );
        face(
          out,
          'metal',
          [
            [p[0] - n[0] * 0.4, y, p[1] - n[2] * 0.4],
            [p[0] - n[0] * 0.4, rise(t0), p[1] - n[2] * 0.4],
            [q[0] - n[0] * 0.4, rise(t1), q[1] - n[2] * 0.4],
            [q[0] - n[0] * 0.4, y, q[1] - n[2] * 0.4],
          ],
          trim,
        );
        face(
          out,
          'cladding',
          [
            [p[0], rise(t0), p[1]],
            [q[0], rise(t1), q[1]],
            [q[0] - n[0] * 0.4, rise(t1), q[1] - n[2] * 0.4],
            [p[0] - n[0] * 0.4, rise(t0), p[1] - n[2] * 0.4],
          ],
          stone,
        );
      }
    }
  };
  for (const sign of [-1, 1]) {
    const corners = legs[sign < 0 ? 0 : 1]
        .filter((p) => p[0] * sign > 50)
        .sort((a, b) => a[1] - b[1]),
      join = shaft.filter((p) => p[0] * sign > 0).sort((a, b) => a[1] - b[1]),
      outer = clockwise([corners[0], join[0], join[1], corners[1]]);
    mappedCap(out, 'metal', outer, 185, [0.27, 0.38, 0.34]);
    crown(outer, 185, 3.6);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 2; j++) {
        const x = sign * (36 + i * 8.1),
          z = -11 + j * 22;
        box(out, 'metal', [x - 2.8, 185, z - 4.2], [x + 2.8, 188, z + 4.2], [0.58, 0.59, 0.54]);
        if (level === 'street' || level === 'closeup')
          for (let k = 0; k < 7; k++)
            beam(
              out,
              'metal',
              [x - 2.6, 188.05, z - 3.8 + k * 1.16],
              [x + 2.6, 188.05, z - 3.8 + k * 1.16],
              0.09,
              0.07,
              [0.27, 0.31, 0.3],
            );
      }
  }
  crown(shaft, 327, 4.1);
  const hip = plan(345038766),
    center = hip.reduce((a, p) => [a[0] + p[0] / hip.length, a[1] + p[1] / hip.length], [0, 0]);
  body(hip, 327, 335, 'roof');
  const roofRings = [
    [335, 1],
    [336, 1.04],
    [339, 0.82],
    [343.4, 0.46],
    [347.5, 0.14],
  ].map(([y, s]) =>
    hip.map((p) => [center[0] + (p[0] - center[0]) * s, y, center[1] + (p[1] - center[1]) * s]),
  );
  loft(out, 'metal', roofRings, [0.2, 0.39, 0.35]);
  for (let j = 1; j < roofRings.length; j++)
    for (let i = 0; i < 4; i++) {
      const k = (i + 1) % 4,
        a = roofRings[j - 1][i],
        b = roofRings[j - 1][k],
        c = roofRings[j][k],
        d = roofRings[j][i];
      if (cfg.mult) beam(out, 'cladding', a, d, 0.25, 0.28, stone);
      for (let col = 1; col <= cfg.seams; col++)
        beam(
          out,
          'metal',
          lerp(a, b, col / (cfg.seams + 1)),
          lerp(d, c, col / (cfg.seams + 1)),
          0.07,
          0.075,
          [0.36, 0.51, 0.43],
        );
      if (cfg.mult) beam(out, 'metal', d, c, 0.15, 0.16, [0.4, 0.55, 0.47]);
    }
  const mast = plan(345038767),
    mc = mast.reduce((a, p) => [a[0] + p[0] / mast.length, a[1] + p[1] / mast.length], [0, 0]);
  loft(
    out,
    'stainless',
    [
      radialRing(346.8, 1.4, 1.4, cfg.mast, mc),
      radialRing(352, 1.16, 1.16, cfg.mast, mc),
      radialRing(360, 0.72, 0.72, cfg.mast, mc),
      radialRing(373, 0.25, 0.25, cfg.mast, mc),
      radialRing(378, 0.055, 0.055, cfg.mast, mc),
    ],
    [0.87, 0.89, 0.85],
  );
  if (cfg.mult)
    for (const [y, r] of [
      [350, 1.65],
      [353, 1.4],
      [357, 1.1],
      [361, 0.88],
      [368, 0.54],
    ])
      torus(
        out,
        'stainless',
        [mc[0], y, mc[1]],
        r,
        0.1,
        [0.84, 0.87, 0.82],
        level === 'district' ? 8 : 24,
        level === 'district' ? 3 : 6,
      );
}

function build(out, level) {
  const target =
    level === 'skyline'
      ? Object.fromEntries(
          ['addQuad', 'addTriangle', 'addConvexPolygon'].map((name) => [
            name,
            (slot, _ref, points, normal, uv, color) => {
              const mean =
                slot === 'glass'
                  ? null
                  : scope.sourceFacts.surfaceMeans[
                      slot === 'stainless'
                        ? 'metal_stainless'
                        : slot === 'metal'
                          ? 'metal_painted'
                          : 'stone_granite'
                    ];
              out[name](
                'silhouette',
                'palette:#ffffff',
                points,
                normal,
                uv,
                mean ? color.map((v, i) => v * mean[i]) : color,
              );
            },
          ]),
        )
      : out;
  buildTuntex(target, map, level);
}
export const buildTuntexReviewedMaster = (out) => build(out, 'closeup');
export const buildTuntexSkyline = (out) => build(out, 'skyline');
export const buildTuntexDistrict = (out) => build(out, 'district');
export const buildTuntexStreet = (out) => build(out, 'street');
export const buildTuntexCloseup = (out) => build(out, 'closeup');

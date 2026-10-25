/** Merdeka 118: continuous triangular glass planes and signed angular spire. */
import { readFileSync } from 'node:fs';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import {
  clockwise,
  face,
  grid,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'merdeka_118',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json')));
const settings = {
  skyline: { mult: 0, mastStep: 0, rail: 0 },
  district: { mult: 8, mastStep: 8.8, rail: 8.1 },
  street: { mult: 2, mastStep: 4.4, rail: 2.7 },
  closeup: { mult: 1, mastStep: 2.2, rail: 1.35 },
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
function slicePlane(poly, axis, value, keepGreater) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length];
    const da = (a[axis] - value) * (keepGreater ? 1 : -1),
      db = (b[axis] - value) * (keepGreater ? 1 : -1);
    if (da >= -1e-8) result.push(a);
    if ((da > 1e-8 && db < -1e-8) || (da < -1e-8 && db > 1e-8))
      result.push(lerp(a, b, da / (da - db)));
  }
  return result.filter(
    (p, i) =>
      Math.hypot(
        p[0] - result[(i + result.length - 1) % result.length][0],
        p[1] - result[(i + result.length - 1) % result.length][1],
      ) > 1e-6,
  );
}

/** Continuous opaque facet plus long clipped mullion strips on its actual inclined plane. */
function glazedFacet(out, points, color, pitch, floorPitch, mult) {
  const n = normalFor(...points),
    hd = Math.hypot(n[0], n[2]);
  if (hd < 0.01) return;
  const frame = [0.34, 0.44, 0.49],
    mean = scope.sourceFacts.surfaceMeans.metal_painted;
  const coverage = mult ? 0 : 0.055 / 1.55 + 0.055 / 4.15;
  tri(
    out,
    'glass',
    points,
    color.map((v, i) => v * (1 - coverage) + frame[i] * mean[i] * coverage),
  );
  if (!mult) return;
  const u = [n[2] / hd, 0, -n[0] / hd],
    d = points[0].reduce((s, v, i) => s + v * n[i], 0),
    poly = points.map((p) => [p[0] * u[0] + p[2] * u[2], p[1]]);
  const restore = ([s, y]) => {
    const h = (d - n[1] * y) / hd;
    return shift([u[0] * s + (n[0] / hd) * h, y, u[2] * s + (n[2] / hd) * h], n, 0.012);
  };
  const emit = (p) => {
    for (let k = 1; k < p.length - 1; k++) {
      const t = [p[0], p[k], p[k + 1]],
        a = t[0],
        b = t[1],
        c = t[2];
      if (Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) < 0.00015)
        continue;
      const xyz = t.map(restore);
      if (normalFor(...xyz).reduce((s, v, i) => s + v * n[i], 0) < 0) xyz.reverse();
      tri(out, 'metal', xyz, frame);
    }
  };
  for (const [axis, interval] of [
    [0, pitch * mult],
    [1, floorPitch * mult],
  ]) {
    const lo = Math.min(...poly.map((p) => p[axis])),
      hi = Math.max(...poly.map((p) => p[axis]));
    for (let i = Math.floor(lo / interval); i <= Math.ceil(hi / interval); i++) {
      let p = slicePlane(poly, axis, i * interval - 0.0275, true);
      p = slicePlane(p, axis, i * interval + 0.0275, false);
      if (p.length >= 3) emit(p);
    }
  }
}
function buildMerdeka(out, m, level) {
  const cfg = settings[level],
    base = cleanPlan(localOutline(m));
  const silver = [0.69, 0.74, 0.77],
    deep = [0.24, 0.39, 0.46],
    cyan = [0.36, 0.51, 0.57],
    pale = [0.43, 0.57, 0.62];
  mappedSolid(out, 'foundation', base, 0, 0.24, [0.53, 0.52, 0.48]);
  // The minimum rectangle frame is aligned to an edge of the diamond, not to
  // its long diagonal. Coordinates retain that OSM frame and the separate mast.
  // Completed architect/engineer plans clip both acute ends of the diamond.
  const plans = [
    [
      [-22, -20.94],
      [16.46, -20.94],
      [32.98, 10.35],
      [26.31, 20.82],
      [-10.21, 20.94],
      [-27.96, -11.71],
    ],
    [
      [-25, -20.2],
      [13.11, -15.68],
      [32.98, 10.35],
      [26.31, 20.82],
      [-6.88, 15.73],
      [-23.5, -5.2],
    ],
    [
      [-17.2, -17.6],
      [16.46, -20.94],
      [32.98, 10.35],
      [26.31, 20.82],
      [-10.21, 20.94],
      [-16.94, 2.87],
    ],
    [
      [-3.42, -18.25],
      [16.46, -20.94],
      [32.98, 10.35],
      [26.31, 20.82],
      [-6.88, 15.73],
      [-16.94, 2.87],
    ],
    [
      [-3.1, -10.58],
      [23.05, -2.67],
      [32.98, 10.35],
      [26.31, 20.82],
      [9.72, 18.28],
      [-1.84, 7.81],
    ],
  ].map(clockwise);
  const ys = [18, 122, 247, 372, 488];
  const rings = plans.map((p, i) => p.map(([x, z]) => [x, ys[i], z]));
  const facets = [];
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 6; i++) {
      const k = (i + 1) % 6,
        a = rings[j - 1][i],
        b = rings[j - 1][k],
        c = rings[j][k],
        d = rings[j][i];
      const flip = (i + j) % 2 === 0;
      const triangles = flip
        ? [
            [a, b, d],
            [b, c, d],
          ]
        : [
            [a, b, c],
            [a, c, d],
          ];
      for (let t = 0; t < 2; t++)
        facets.push({
          points: triangles[t],
          color: [deep, cyan, pale, deep, cyan, pale][(i + (flip ? t : 1 - t)) % 6],
        });
    }
  for (const { points, color } of facets) {
    glazedFacet(out, points, color, 1.55, 4.15, cfg.mult);
    // The blade-like diagonal junctions are thin framed folds in the envelope.
    const n = normalFor(...points);
    for (let i = 0; i < 3; i++)
      if (cfg.mult && Math.abs(points[i][1] - points[(i + 1) % 3][1]) > 40)
        beam(
          out,
          'stainless',
          shift(points[i], n, 0.035),
          shift(points[(i + 1) % 3], n, 0.035),
          0.1,
          0.12,
          [0.68, 0.77, 0.79],
        );
  }
  // The actual completed crown has a flat upper glass face with diagonal return
  // planes and a lower viewing terrace, as shown in PAM's2025 close photograph.
  const topPlan = clockwise([
    [7.76, -7.29],
    [23.05, -2.67],
    [32.98, 10.35],
    [26.31, 20.82],
    [9.72, 18.28],
    [-1.84, 7.81],
  ]);
  const topYs = [509.5, 518.5, 518.5, 518.5, 518.5, 509.5].toReversed();
  const crown = topPlan.map(([x, z], i) => [x, topYs[i], z]);
  for (let i = 0; i < 6; i++) {
    const k = (i + 1) % 6,
      a = rings.at(-1)[i],
      b = rings.at(-1)[k],
      c = crown[k],
      d = crown[i];
    for (const p of [
      [a, b, c],
      [a, c, d],
    ])
      glazedFacet(out, p, i % 2 ? deep : pale, 1.45, 3.4, cfg.mult);
    if (cfg.mult) beam(out, 'metal', c, d, 0.16, 0.22, silver);
  }
  // The upper skin is a parapet around a lower maintenance roof. A fan to the
  // high parapet would bury the actual mechanical deck and its plant enclosure.
  mappedCap(out, 'metal', topPlan, 509.2, [0.49, 0.54, 0.56]);
  for (let i = 0; i < 6; i++) {
    const k = (i + 1) % 6,
      a = crown[i],
      b = crown[k];
    face(out, 'metal', [[b[0], 509.2, b[2]], [a[0], 509.2, a[2]], a, b], [0.48, 0.55, 0.58]);
  }
  const plant = clockwise([
    [7, 1],
    [20, 1],
    [20, 11],
    [7, 11],
  ]);
  mappedSolid(out, 'metal', plant, 509.2, 511.1, [0.43, 0.48, 0.5]);
  if (level === 'street' || level === 'closeup')
    for (let k = 0; k < 10; k++)
      beam(
        out,
        'metal',
        [7.2 + k * 1.26, 511.13, 1.2],
        [7.2 + k * 1.26, 511.13, 10.8],
        0.16,
        0.15,
        [0.65, 0.69, 0.7],
      );
  if (cfg.mult)
    for (const yy of [478.8, 482.2]) {
      // Paired upper plant/observation bands are inset inside the south glass face.
      const p = plans[3].map((a, i) => lerp(a, plans[4][i], (yy - 372) / (488 - 372))),
        a = p[0],
        b = p[5],
        n = edges(p)[5].n;
      for (let k = 0; k < (level === 'district' ? 6 : 19); k++) {
        const q = lerp(a, b, (k + 0.5) / (level === 'district' ? 6 : 19));
        beam(
          out,
          'metal',
          [q[0] + n[0] * 0.08, yy, q[1] + n[2] * 0.08],
          [q[0] + n[0] * 0.08, yy + 1.2, q[1] + n[2] * 0.08],
          0.24,
          0.14,
          [0.16, 0.24, 0.28],
        );
      }
    }
  //160.4 m external spire, at the independently mapped north-eastern corner.
  // Its skin is an angular taper with an off-axis crease, not a circular mast.
  const center = [30.18, 15.74],
    spireYs = [509.8, 518.5, 551, 578, 619, 653, 678.9];
  const widths = [
    [3.6, 4.4],
    [3.6, 4.4],
    [3.05, 3.7],
    [2.35, 2.9],
    [1.3, 1.65],
    [0.61, 0.83],
    [0.09, 0.1],
  ];
  const spireRings = spireYs.map((y, j) => {
    const [w, d] = widths[j],
      skew = j === 2 ? -0.65 : j === 3 ? 0.25 : 0;
    return clockwise([
      [-w * 0.5, -d * 0.5],
      [w * 0.5, -d * 0.5],
      [w * 0.5 + skew, d * 0.15],
      [w * 0.15, d * 0.5],
      [-w * 0.5, d * 0.5],
    ]).map(([x, z]) => [center[0] + x, y, center[1] + z]);
  });
  for (let j = 1; j < spireRings.length; j++)
    for (let i = 0; i < 5; i++) {
      const k = (i + 1) % 5,
        a = spireRings[j - 1][i],
        b = spireRings[j - 1][k],
        c = spireRings[j][k],
        d = spireRings[j][i];
      face(out, 'metal', [a, b, c, d], i % 2 ? [0.28, 0.47, 0.55] : [0.6, 0.69, 0.72]);
      if (cfg.mult) beam(out, 'stainless', a, d, 0.075, 0.07, silver);

      if (cfg.mastStep) {
        const divisions = Math.ceil((c[1] - b[1]) / cfg.mastStep),
          n = normalFor(a, b, c);
        for (let row = 1; row < divisions; row++) {
          const t = row / divisions,
            dt = 0.0225 / (c[1] - b[1]);
          face(
            out,
            'metal',
            [lerp(a, d, t - dt), lerp(b, c, t - dt), lerp(b, c, t + dt), lerp(a, d, t + dt)].map(
              (p) => shift(p, n, 0.012),
            ),
            [0.5, 0.59, 0.61],
          );
        }
      }
    }
  // The angular metal skin meets the lower maintenance deck and is closed at its tip.
  const bottom = spireRings[0];
  for (let i = 0; i < bottom.length; i++) {
    const a = bottom[i],
      b = bottom[(i + 1) % bottom.length];
    face(out, 'metal', [[a[0], 509.2, a[2]], [b[0], 509.2, b[2]], b, a], [0.6, 0.69, 0.72]);
  }
  mappedCap(
    out,
    'metal',
    spireRings.at(-1).map((p) => [p[0], p[2]]),
    678.9,
    [0.6, 0.69, 0.72],
  );
  // Shared open-air crown rail along the lower end of the stepped roof.
  if (cfg.rail)
    for (const i of [0, 4, 5]) {
      const k = (i + 1) % 6,
        a = crown[i],
        b = crown[k];
      beam(out, 'stainless', a, b, 0.08, 0.07, silver);
      const count = Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / cfg.rail);
      for (let j = 0; j <= count; j++) {
        const q = lerp(a, b, j / count);
        beam(out, 'stainless', q, [q[0], q[1] + 1.1, q[2]], 0.055, 0.055, silver);
      }
      beam(
        out,
        'stainless',
        [a[0], a[1] + 1.1, a[2]],
        [b[0], b[1] + 1.1, b[2]],
        0.07,
        0.065,
        silver,
      );
    }
  // Glazed low atrium, warm stone piers and the continuous faceted metal canopy.
  const lobby = plans[0];
  for (const { a, b, n, len } of edges(lobby)) {
    grid(
      out,
      [
        [a[0], 0.24, a[1]],
        [b[0], 0.24, b[1]],
        [b[0], 18, b[1]],
        [a[0], 18, a[1]],
      ],
      [0.26, 0.39, 0.42],
      cfg.mult ? 2 * cfg.mult : 80,
      cfg.mult ? 3.55 * cfg.mult : 40,
      cfg.mult ? 0.085 : 0,
      [0.33, 0.39, 0.39],
    );
    const divisions = Math.max(1, Math.floor(len / 8));
    for (let j = 0; j <= divisions; j++) {
      const q = lerp(a, b, j / divisions),
        at = (y, o = 0) => [q[0] + n[0] * o, y, q[1] + n[2] * o];
      beam(out, 'cladding', at(0.3, -0.16), at(15, -0.16), 0.56, 0.62, [0.74, 0.68, 0.56]);
    }
    if (len > 20) {
      const c = lerp(a, b, 0.5),
        tip = [c[0] + n[0] * 10.5, 12.7, c[1] + n[2] * 10.5];
      const q0 = [a[0], 17.4, a[1]],
        q1 = [b[0], 17.4, b[1]];
      const left = [a[0] + n[0] * 6, 8.5, a[1] + n[2] * 6],
        right = [b[0] + n[0] * 6, 8.5, b[1] + n[2] * 6];
      for (const points of [
        [q0, left, tip],
        [q0, tip, q1],
        [q1, tip, right],
      ]) {
        const p = normalFor(...points)[1] < 0 ? points.toReversed() : points;
        tri(out, 'metal', p, [0.5, 0.59, 0.62]);
        tri(out, 'metal', p.map((v) => [v[0], v[1] - 0.34, v[2]]).toReversed(), [0.72, 0.7, 0.61]);
        for (let i = 0; i < 3; i++) {
          const k = (i + 1) % 3;
          face(
            out,
            'metal',
            [p[i], p[k], [p[k][0], p[k][1] - 0.34, p[k][2]], [p[i][0], p[i][1] - 0.34, p[i][2]]],
            [0.6, 0.63, 0.62],
          );
          if (cfg.mult) beam(out, 'stainless', p[i], p[k], 0.07, 0.055, silver);
        }
      }
      const foot = [c[0] + n[0] * 4.2, 0.42, c[1] + n[2] * 4.2];
      for (const t of [0.31, 0.69]) {
        const q = lerp(q0, q1, t);
        beam(
          out,
          'metal',
          foot,
          [q[0] + n[0] * 2.7, 15.6, q[2] + n[2] * 2.7],
          0.53,
          0.66,
          [0.63, 0.65, 0.62],
        );
      }
      // Glass door banks below the sheltered center, with stainless pull bars.
      if (level === 'street' || level === 'closeup')
        for (const t of [0.43, 0.5, 0.57]) {
          const q = lerp(a, b, t),
            tangent = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len];
          beam(
            out,
            'stainless',
            [q[0] + n[0] * 0.12, 0.7, q[1] + n[2] * 0.12],
            [q[0] + n[0] * 0.12, 2.15, q[1] + n[2] * 0.12],
            0.045,
            0.045,
            silver,
          );
          beam(
            out,
            'metal',
            [q[0] - tangent[0] * 1.1, 3.1, q[1] - tangent[2] * 1.1],
            [q[0] + tangent[0] * 1.1, 3.1, q[1] + tangent[2] * 1.1],
            0.08,
            0.15,
            [0.37, 0.4, 0.39],
          );
        }
    }
  }
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
                          : 'stone_travertine'
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
  buildMerdeka(target, map, level);
}
export const buildMerdekaReviewedMaster = (out) => build(out, 'closeup');
export const buildMerdekaSkyline = (out) => build(out, 'skyline');
export const buildMerdekaDistrict = (out) => build(out, 'district');
export const buildMerdekaStreet = (out) => build(out, 'street');
export const buildMerdekaCloseup = (out) => build(out, 'closeup');

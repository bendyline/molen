/** Complete mapped exterior; preserve the original recipe and correct its entry/planter placement. */
import { readFileSync } from 'node:fs';
import { loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  bandPlan,
  clockwise,
  face,
  lerp,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  rectangularPlan,
} from './signature-tower-expansion-models.mjs';
import { skylineNext } from './signature-tower-next-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0152_trump_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'), 'utf8')),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'), 'utf8')),
  original = skylineNext.find((m) => m.id === 'N0152').build,
  bronze = [0.2, 0.18, 0.145],
  glass = [0.14, 0.135, 0.12],
  gold = [0.67, 0.48, 0.19];
export const trumpPortalCenter = [-26.21749137991779, -9.684525097376484];
export const trumpTerracePlanters = Array.from({ length: 5 }, (_, i) => ({
  x: -20.7 + i * 4.01,
  z: 15.3,
  y: 25 + i * 5,
}));
const tiers = [
  [265345374, 0, 20],
  [159831423, 20, 25],
  [159831419, 25, 30],
  [159831422, 30, 35],
  [159831420, 35, 40],
  [159831421, 40, 45],
  [159831418, 45, 202.4],
];
function clean(plan) {
  let p = plan;
  for (let pass = 0; pass < 4; pass++)
    p = p.filter((b, i) => {
      const a = p[(i + p.length - 1) % p.length],
        c = p[(i + 1) % p.length],
        d = Math.hypot(c[0] - a[0], c[1] - a[1]);
      return (
        d < 0.02 ||
        Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / d > 0.028
      );
    });
  return clockwise(p);
}
const parts = partsEvidence(key),
  plans = tiers.map(([id, lo, hi]) => ({
    id,
    lo,
    hi,
    plan: clean(
      partPlan(
        map,
        parts.find((p) => p.id === id),
      ),
    ),
  }));
function edges(plan) {
  return plan.map((a, i) => {
    const b = plan[(i + 1) % plan.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
  });
}
const shifted = (p, n, d) => p.map((v, i) => v + n[i] * d),
  average = (color, graph) => color.map((v, i) => v * scope.sourceFacts.surfaceMeans[graph][i]);

// Subtract a rectangular portal opening without leaving the original glazing in front of it.
function clipped(poly, axis, value, side) {
  const result = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      aa = side * (a[axis] - value) >= -1e-9,
      bb = side * (b[axis] - value) >= -1e-9;
    if (aa) result.push(a);
    if (aa !== bb) result.push(lerp(a, b, (value - a[axis]) / (b[axis] - a[axis])));
  }
  return result;
}
function outsidePortal(poly) {
  let remainder = poly;
  const result = [];
  for (const [axis, value, side] of [
    [2, trumpPortalCenter[1] - 3.6, 1],
    [2, trumpPortalCenter[1] + 3.6, -1],
    [1, 0.25, 1],
    [1, 8.3, -1],
  ]) {
    const outside = clipped(remainder, axis, value, -side);
    if (outside.length >= 3) result.push(outside);
    remainder = clipped(remainder, axis, value, side);
    if (remainder.length < 3) break;
  }
  return result;
}
function emit(out, component, poly, color) {
  for (let i = 2; i < poly.length; i++) {
    const p = [poly[0], poly[i - 1], poly[i]],
      n = normalFor(...p);
    if (!n.every(Number.isFinite)) continue;
    const a = p[1].map((v, k) => v - p[0][k]),
      b = p[2].map((v, k) => v - p[0][k]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      1e-7
    )
      continue;
    out.addTriangle(
      component,
      'palette:#ffffff',
      p,
      n,
      [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      color,
    );
  }
}
function portal(out, level) {
  const [x, z] = trumpPortalCenter,
    m = level === 'skyline' ? 'glass' : 'metal',
    tint = (c) => (level === 'skyline' ? average(c, 'metal_painted') : c);
  box(out, m, [x - 0.1, 0.25, z - 3.6], [x + 0.5, 8.3, z - 3.34], tint(bronze));
  box(out, m, [x - 0.1, 0.25, z + 3.34], [x + 0.5, 8.3, z + 3.6], tint(bronze));
  box(out, m, [x - 0.1, 7.65, z - 3.6], [x + 0.5, 8.3, z + 3.6], tint(bronze));
  box(out, m, [x - 0.95, 7.5, z - 3.6], [x + 0.14, 7.65, z + 3.6], tint(gold));
  face(
    out,
    'glass',
    [
      [x + 0.45, 0.25, z - 3.34],
      [x + 0.45, 0.25, z + 3.34],
      [x + 0.45, 7.65, z + 3.34],
      [x + 0.45, 7.65, z - 3.34],
    ],
    [0.075, 0.08, 0.065],
  );
  if (level === 'skyline' || level === 'district') return;
  for (const dz of [-3.2, -1.6, 0, 1.6, 3.2])
    box(out, 'metal', [x + 0.35, 0.25, z + dz - 0.045], [x + 0.45, 7.5, z + dz + 0.045], gold);
  box(out, 'metal', [x + 0.34, 2.6, z - 3.34], [x + 0.46, 2.76, z + 3.34], gold);
}
function storefront(out) {
  for (const z of [-15.1, -3.25, 1.1, 5.45, 9.8, 14.15]) {
    box(out, 'metal', [-26.34, 0.25, z - 0.06], [-26.22, 5.1, z + 0.06], gold);
    box(out, 'metal', [-27.4, 5.1, z - 1.7], [-26.1, 5.45, z + 1.7], [0.57, 0.4, 0.16]);
  }
}
/** The original recipe stays unchanged and separately byte-tested. */
export function buildTrumpReviewedMaster(out, m) {
  const wrapped = {};
  for (const method of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    wrapped[method] = (component, ref, points, normal, uv, color) => {
      // Original planting was one whole diagonal bay west of each supporting roof.
      if (['stone', 'recess'].includes(component) && points.every((p) => p[1] >= 25)) {
        out[method](
          component,
          ref,
          points.map((p) => [p[0] + 3.6, p[1], p[2]]),
          normal,
          uv,
          color,
        );
        return;
      }
      if (component === 'metal' && color[0] > 0.5 && points.every((p) => p[0] < -26 && p[1] <= 5.5))
        return;
      if (
        Math.abs(normal[0]) > 0.1 &&
        points.every((p) => p[0] < -26) &&
        points.some((p) => p[1] < 8.3)
      ) {
        for (const poly of outsidePortal(points)) emit(out, component, poly, color);
        return;
      }
      out[method](component, ref, points, normal, uv, color);
    };
  original(wrapped, m);
  storefront(out);
  portal(out, 'closeup');
}
function curtain(out, e, lo, hi, level) {
  const { a, b, n, len } = e,
    at = (s, y, d = 0) => shifted([a[0] + (b[0] - a[0]) * s, y, a[1] + (b[1] - a[1]) * s], n, d),
    pane = [at(0, lo), at(1, lo), at(1, hi), at(0, hi)],
    isEntry = lo < 8.3 && a[0] < -26 && b[0] < -26 && n[0] < -0.8;
  if (isEntry) for (const p of outsidePortal(pane)) emit(out, 'glass', p, glass);
  else face(out, 'glass', pane, level === 'skyline' ? [0.151, 0.142, 0.12] : glass);
  if (level === 'skyline') return;
  const floors = Math.max(1, Math.round((hi - lo) / 3.26)),
    stride = level === 'district' ? 2 : 1;
  for (let row = stride; row <= floors; row += stride) {
    const y = lo + ((hi - lo) * row) / floors,
      p = [at(0, y - 0.78, 0.012), at(1, y - 0.78, 0.012), at(1, y, 0.012), at(0, y, 0.012)];
    if (isEntry) for (const q of outsidePortal(p)) emit(out, 'metal', q, bronze);
    else face(out, 'metal', p, bronze);
  }
  if (level === 'district' && hi > 20) return;
  const columns = Math.max(1, Math.ceil(len / 1.45)),
    half = Math.min(0.035, 0.22 * (len / columns)) / len;
  for (let i = 0; i <= columns; i++) {
    const s0 = Math.max(0, i / columns - half),
      s1 = Math.min(1, i / columns + half),
      p = [at(s0, lo, 0.03), at(s1, lo, 0.03), at(s1, hi, 0.03), at(s0, hi, 0.03)];
    if (isEntry) for (const q of outsidePortal(p)) emit(out, 'metal', q, bronze);
    else face(out, 'metal', p, bronze);
  }
}
function planting(out, level) {
  for (const { x, z, y } of trumpTerracePlanters) {
    box(
      out,
      level === 'skyline' ? 'glass' : 'stone',
      [x - 0.7, y, z - 1.15],
      [x + 2.2, y + 0.65, z + 0.1],
      level === 'skyline' ? average([0.28, 0.29, 0.25], 'stone_granite') : [0.28, 0.29, 0.25],
    );
    const count = level === 'street' ? 4 : 1;
    for (let i = 0; i < count; i++)
      loft(
        out,
        level === 'skyline' ? 'glass' : 'recess',
        [
          radialRing(y + 0.6, count === 1 ? 1.15 : 0.55, 0.5, 6, [
            x + (count === 1 ? 0.63 : -0.2 + i * 0.55),
            z - 0.52,
          ]),
          radialRing(y + 1.6, 0.13, 0.12, 6, [
            x + (count === 1 ? 0.63 : -0.2 + i * 0.55),
            z - 0.52,
          ]),
        ],
        [0.16, 0.25, 0.12],
      );
  }
}
function build(out, level) {
  if (level === 'closeup') return buildTrumpReviewedMaster(out, map);
  for (const { lo, hi, plan } of plans) {
    if (lo === 0)
      mappedSolid(
        out,
        level === 'skyline' ? 'glass' : 'stone',
        plan,
        0,
        0.25,
        level === 'skyline' ? average([0.3, 0.28, 0.23], 'stone_granite') : [0.3, 0.28, 0.23],
      );
    for (const e of edges(plan)) curtain(out, e, Math.max(0.25, lo), hi, level);
    mappedCap(
      out,
      level === 'skyline' ? 'glass' : 'concrete',
      plan,
      hi,
      level === 'skyline' ? average([0.3, 0.31, 0.28], 'concrete_plain') : [0.3, 0.31, 0.28],
    );
    if (level === 'street') bandPlan(out, plan, hi - 0.15, 0.15, 0.25, bronze, 'metal');
  }
  planting(out, level);
  portal(out, level);
  if (level === 'street') storefront(out);
  const service = rectangularPlan(11, 7, 1, -7);
  mappedSolid(
    out,
    level === 'skyline' ? 'glass' : 'metal',
    service,
    199.9,
    201.9,
    level === 'skyline' ? average([0.42, 0.47, 0.49], 'metal_painted') : [0.42, 0.47, 0.49],
  );
}
export const buildTrumpSkyline = (out) => build(out, 'skyline');
export const buildTrumpDistrict = (out) => build(out, 'district');
export const buildTrumpStreet = (out) => build(out, 'street');
export const buildTrumpCloseup = (out) => build(out, 'closeup');

/** Almas Tower: two clipped shafts, closed diamond wings and an attached elliptical mast. */
import { readFileSync } from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'almas_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'))),
  silver = [0.76, 0.79, 0.8],
  blue = [0.27, 0.38, 0.42];
const settings = {
  skyline: { shaft: 20, podium: 16, mast: 8, column: 4, dome: 6, step: 0, frames: false },
  district: { shaft: 32, podium: 24, mast: 12, column: 6, dome: 8, step: 6, frames: false },
  street: { shaft: 48, podium: 32, mast: 20, column: 8, dome: 12, step: 2, frames: true },
  closeup: { shaft: 64, podium: 48, mast: 24, column: 8, dome: 16, step: 1, frames: true },
};
function edges(plan) {
  return plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.001);
}
function inside([x, z], plan) {
  let yes = false;
  for (let i = 0, j = plan.length - 1; i < plan.length; j = i++) {
    const a = plan[i],
      b = plan[j];
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      yes = !yes;
  }
  return yes;
}
function clippedEllipse(cx, cz, side, sides) {
  const ring = Array.from({ length: sides }, (_, i) => {
      const a = (-i * Math.PI * 2) / sides;
      return [cx + 27 * Math.cos(a), cz + 12.5 * Math.sin(a)];
    }),
    result = [],
    distance = (p) => (side < 0 ? p[0] + 32 : 32 - p[0]);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      da = distance(a),
      db = distance(b);
    if (da >= -1e-7) result.push(a);
    if ((da > 1e-7 && db < -1e-7) || (da < -1e-7 && db > 1e-7))
      result.push(lerp(a, b, da / (da - db)));
  }
  return result;
}
function splitEdge(a, b, other) {
  const v = [b[0] - a[0], b[1] - a[1]],
    ts = [0, 1];
  for (const { a: c, b: d } of edges(other)) {
    const w = [d[0] - c[0], d[1] - c[1]],
      den = v[0] * w[1] - v[1] * w[0];
    if (Math.abs(den) < 1e-9) continue;
    const q = [c[0] - a[0], c[1] - a[1]],
      t = (q[0] * w[1] - q[1] * w[0]) / den,
      u = (q[0] * v[1] - q[1] * v[0]) / den;
    if (t > 1e-7 && t < 1 - 1e-7 && u >= 0 && u <= 1) ts.push(t);
  }
  ts.sort((a, b) => a - b);
  return ts.slice(0, -1).map((t, i) => [lerp(a, b, t), lerp(a, b, ts[i + 1])]);
}
function cap(out, plan, height, slot, color) {
  for (const ids of ShapeUtils.triangulateShape(
    plan.map((p) => new Vector2(...p)),
    [],
  )) {
    let ps = ids.map((i) => [plan[i][0], height(plan[i]), plan[i][1]]);
    if (normalFor(...ps)[1] < 0) ps = ps.toReversed();
    tri(out, slot, ps, color);
  }
}
function strip(out, a, b, lo, hi, color, offset = 0.035) {
  const poly = [
      [a[0], lo, a[1]],
      [b[0], lo, b[1]],
      [b[0], hi, b[1]],
      [a[0], hi, a[1]],
    ],
    n = normalFor(...poly);
  face(
    out,
    'metal',
    poly.map((p) => shift(p, n, offset)),
    color,
  );
}
function build(out, level) {
  const c = settings[level],
    north = clippedEllipse(-9, -8.5, -1, c.shaft),
    south = clippedEllipse(9, 8.5, 1, c.shaft),
    nRoof = ([x]) => 232 + ((18 - x) * 8) / 50,
    sRoof = ([x]) => 279 + ((x + 18) * 21) / 50;
  for (const [plan, other, isNorth] of [
    [north, south, true],
    [south, north, false],
  ]) {
    const ceiling = isNorth ? 232 : 279,
      roof = isNorth ? nRoof : sRoof;
    for (const { a, b } of edges(plan))
      for (const [aa, bb] of splitEdge(a, b, other)) {
        const covered = inside(lerp(aa, bb, 0.5), other);
        if (isNorth && covered) continue;
        const bottomA = covered ? nRoof(aa) : 0.22,
          bottomB = covered ? nRoof(bb) : 0.22,
          flat = Math.abs(aa[0] - bb[0]) < 1e-5,
          poly = [
            [aa[0], bottomA, aa[1]],
            [bb[0], bottomB, bb[1]],
            [bb[0], ceiling, bb[1]],
            [aa[0], ceiling, aa[1]],
          ];
        face(out, flat ? 'metal' : 'glass', poly, flat ? silver : blue);
        if (flat && c.step) {
          const n = normalFor(...poly);
          for (let z = Math.min(aa[1], bb[1]) + 1.35; z < Math.max(aa[1], bb[1]) - 1.3; z += 2.65) {
            let p = [
              [aa[0] + n[0] * 0.025, Math.max(bottomA, bottomB), z - 0.2],
              [aa[0] + n[0] * 0.025, Math.max(bottomA, bottomB), z + 0.2],
              [aa[0] + n[0] * 0.025, ceiling - 1, z + 0.2],
              [aa[0] + n[0] * 0.025, ceiling - 1, z - 0.2],
            ];
            if (normalFor(...p)[0] * n[0] < 0) p = p.toReversed();
            face(out, 'recess', p, [0.17, 0.24, 0.27]);
          }
        }
        if (!flat && c.step) {
          for (let y = c.step * 4; y < ceiling; y += c.step * 4) {
            if (y - 0.57 * c.step <= Math.max(bottomA, bottomB)) continue;
            strip(out, aa, bb, y - 0.57 * c.step, y, silver);
          }
          for (const y of [42, 121, 212, 279])
            if (y < ceiling && y > Math.max(bottomA, bottomB) + 2)
              strip(out, aa, bb, y - 0.9, y + 0.9, [0.47, 0.53, 0.55], 0.055);
        }
        const topA = roof(aa),
          topB = roof(bb);
        if (topA > ceiling + 0.001 && topB > ceiling + 0.001)
          face(
            out,
            'metal',
            [
              [aa[0], ceiling, aa[1]],
              [bb[0], ceiling, bb[1]],
              [bb[0], topB, bb[1]],
              [aa[0], topA, aa[1]],
            ],
            silver,
          );
        else if (topA > ceiling + 0.001)
          tri(
            out,
            'metal',
            [
              [aa[0], ceiling, aa[1]],
              [bb[0], topB, bb[1]],
              [aa[0], topA, aa[1]],
            ],
            silver,
          );
        else if (topB > ceiling + 0.001)
          tri(
            out,
            'metal',
            [
              [aa[0], ceiling, aa[1]],
              [bb[0], ceiling, bb[1]],
              [bb[0], topB, bb[1]],
            ],
            silver,
          );
      }
    cap(out, plan, roof, 'metal', [0.59, 0.65, 0.67]);
  }
  const mast = [31.9, 8.5];
  loft(
    out,
    'metal',
    [radialRing(279, 1.7, 3.7, c.mast, mast), radialRing(337, 1, 2.5, c.mast, mast)],
    silver,
  );
  loft(
    out,
    'metal',
    [radialRing(337, 0.75, 2.15, c.mast, mast), radialRing(360, 0.12, 0.3, c.mast, mast)],
    [0.83, 0.85, 0.85],
  );
  mappedSolid(out, 'foundation', localOutline(map), 0, 0.3, [0.49, 0.49, 0.46]);
  const center = Array.from({ length: c.podium }, (_, i) => {
    const a = (-i * Math.PI * 2) / c.podium;
    return [40 * Math.cos(a), 35 * Math.sin(a)];
  });
  for (const { a, b } of edges(center)) {
    face(
      out,
      'glass',
      [
        [a[0], 0.3, a[1]],
        [b[0], 0.3, b[1]],
        [b[0], 12.5, b[1]],
        [a[0], 12.5, a[1]],
      ],
      [0.22, 0.29, 0.31],
    );
    if (c.step) for (const y of [4.35, 8.4]) strip(out, a, b, y - 0.1, y, silver);
  }
  mappedCap(out, 'stone', center, 12.5, [0.67, 0.65, 0.59]);
  const raw = map.geometry.outline;
  [
    [0, 1, 2],
    [2, 3, 5],
    [6, 7, 8],
    [9, 11, 12],
    [14, 15, 16],
    [19, 20, 21],
    [23, 24, 25],
    [27, 29, 0],
  ].forEach(([li, ti, ri], index) => {
    const plan = [raw[li], raw[ti], raw[ri]].map((p) => p.slice());
    if (
      plan.reduce((s, p, i) => s + p[0] * plan[(i + 1) % 3][1] - p[1] * plan[(i + 1) % 3][0], 0) > 0
    )
      plan.reverse();
    const tip = raw[ti],
      long = index === 0,
      tipDistance = Math.hypot(...tip),
      radial = (p) => Math.min(1, Math.max(0, (Math.hypot(...p) - 35) / (tipDistance - 35))),
      top = (p) => (long ? 18.6 : 16 - radial(p) * 3.5),
      bottom = (p) => 4.1 + radial(p) * (long ? 6 : 3.1),
      roofHeight = (p) => (long ? 20.85 : top(p) + 0.65);
    for (const { a, b, len, n } of edges(plan)) {
      face(
        out,
        'glass',
        [
          [a[0], bottom(a), a[1]],
          [b[0], bottom(b), b[1]],
          [b[0], top(b), b[1]],
          [a[0], top(a), a[1]],
        ],
        [0.22, 0.32, 0.35],
      );
      face(
        out,
        'metal',
        [
          [a[0], top(a), a[1]],
          [b[0], top(b), b[1]],
          [b[0], roofHeight(b), b[1]],
          [a[0], roofHeight(a), a[1]],
        ],
        [0.61, 0.67, 0.69],
      );
      if (c.frames) {
        for (const high of [false, true])
          beam(
            out,
            'metal',
            shift([a[0], high ? top(a) : bottom(a), a[1]], n, 0.1),
            shift([b[0], high ? top(b) : bottom(b), b[1]], n, 0.1),
            0.5,
            0.45,
            silver,
          );
        const bays = Math.max(2, Math.round(len / (long ? 12 : 8)));
        for (let i = 0; i < bays; i++) {
          const u = lerp(a, b, i / bays),
            v = lerp(a, b, (i + 1) / bays);
          beam(
            out,
            'metal',
            shift([u[0], i % 2 ? top(u) - 0.2 : bottom(u) + 0.2, u[1]], n, 0.25),
            shift([v[0], i % 2 ? bottom(v) + 0.2 : top(v) - 0.2, v[1]], n, 0.25),
            0.4,
            0.43,
            silver,
          );
        }
        beam(
          out,
          'metal',
          [a[0], roofHeight(a), a[1]],
          [b[0], roofHeight(b), b[1]],
          0.5,
          0.34,
          silver,
        );
      }
    }
    const roof = plan.map((p) => [p[0], roofHeight(p), p[1]]);
    tri(out, 'glass', normalFor(...roof)[1] < 0 ? roof.toReversed() : roof, [0.42, 0.54, 0.56]);
    const underside = plan.map((p) => [p[0], bottom(p), p[1]]);
    tri(
      out,
      'metal',
      normalFor(...underside)[1] > 0 ? underside.toReversed() : underside,
      [0.48, 0.53, 0.54],
    );
    if (c.frames) {
      const ti = plan.findIndex((p) => Math.hypot(p[0] - tip[0], p[1] - tip[1]) < 0.01),
        a = roof[(ti + 1) % 3],
        b = roof[(ti + 2) % 3],
        t = roof[ti],
        rows = Math.max(3, Math.ceil(Math.hypot(...t.map((v, i) => v - (a[i] + b[i]) / 2)) / 5));
      for (let j = 1; j < rows; j++)
        beam(out, 'metal', lerp(a, t, j / rows), lerp(b, t, j / rows), 0.13, 0.15, silver);
      for (let j = 1; j < 4; j++) beam(out, 'metal', lerp(a, b, j / 4), t, 0.12, 0.13, silver);
    }
    for (const end of [raw[li], raw[ri]]) {
      const q = end.map((v) => v * 0.82);
      tube(
        out,
        'concrete',
        [q[0], 0.55, q[1]],
        [end[0], bottom(end) + 0.2, end[1]],
        0.5,
        [0.69, 0.68, 0.64],
        c.column,
      );
    }
  });
  // Contractor photograph shows two domes. Heights/radii are explicit estimates.
  for (const p of [
    [-26, 11],
    [26, -11],
  ]) {
    loft(
      out,
      'metal',
      [radialRing(12.5, 3.45, 3.45, c.dome, p), radialRing(13.2, 3.45, 3.45, c.dome, p)],
      silver,
    );
    loft(
      out,
      'glass',
      [
        radialRing(13.2, 3.2, 3.2, c.dome, p),
        radialRing(14.55, 1.95, 1.95, c.dome, p),
        radialRing(15.4, 0.16, 0.16, c.dome, p),
      ],
      [0.4, 0.53, 0.55],
    );
  }
}
function skylineOutput(out) {
  const result = {};
  for (const name of ['addQuad', 'addTriangle', 'addConvexPolygon'])
    result[name] = (slot, _ref, p, n, uv, color) => {
      const mean = scope.sourceFacts.surfaceMeans[scope.surfaceOverrides[slot]?.graph] ?? [1, 1, 1];
      out[name](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        color.map((v, i) => v * mean[i]),
      );
    };
  return result;
}
export const buildAlmasSkyline = (out) => build(skylineOutput(out), 'skyline');
export const buildAlmasDistrict = (out) => build(out, 'district');
export const buildAlmasStreet = (out) => build(out, 'street');
export const buildAlmasCloseup = (out) => build(out, 'closeup');
export const buildAlmasReviewedMaster = buildAlmasCloseup;

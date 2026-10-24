/** Individually reviewed Q1: asymmetric apartment shaft, open sail and northern climb. */
import { readFileSync } from 'node:fs';
import { beam, cross, loft, normalFor, normalize, radialRing } from './authored-structure-mesh.mjs';
import {
  face,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  partPlan,
  partsEvidence,
  shift,
  tri,
} from './signature-tower-expansion-models.mjs';
import { box } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'q1_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'))),
  podiumPart = partsEvidence(key).find((p) => p.id === 492716887),
  white = [0.79, 0.81, 0.78],
  blue = [0.24, 0.36, 0.42],
  steel = [0.66, 0.71, 0.72];
export const q1Mast = map.orientationControl.mastLocal;
export const q1ClimbRoute = [
  [-19.5, -13.8],
  [-10, -19.3],
  [0, -18.1],
  [9, -15.2],
  [19, -8.4],
  [23.1, -2.2],
];
export const q1CeilingHeight = (p) => 234.5 + 10.5 * Math.max(0, Math.min(1, (p[0] + 22.7) / 45.4));
export const q1SailHeight = (p) => 245 + 34 * Math.max(0, Math.min(1, (p[0] + 22.7) / 45.4));
const settings = {
  source: {
    tolerance: 0,
    floors: 76,
    columns: 1.55,
    balconyFloors: 73,
    balconyRails: true,
    ribSpacing: 3.6,
    crownBands: 4.15,
    steps: 172,
    sides: 8,
  },
  closeup: {
    tolerance: 0,
    floors: 76,
    columns: 1.55,
    balconyFloors: 73,
    balconyRails: true,
    ribSpacing: 3.6,
    crownBands: 4.15,
    steps: 172,
    sides: 8,
  },
  street: {
    tolerance: 0.28,
    floors: 76,
    columns: 3.1,
    balconyFloors: 73,
    balconyRails: false,
    ribSpacing: 7.2,
    crownBands: 8.3,
    steps: 64,
    sides: 4,
  },
  district: {
    tolerance: 0.65,
    floors: 12,
    columns: 10,
    balconyFloors: 12,
    balconyRails: false,
    ribSpacing: 14.4,
    crownBands: 16.6,
    steps: 0,
    sides: 3,
  },
  skyline: {
    tolerance: 1.1,
    floors: 0,
    columns: 0,
    balconyFloors: 0,
    balconyRails: false,
    ribSpacing: 34,
    crownBands: 0,
    steps: 0,
    sides: 3,
  },
};
const edges = (plan) =>
  plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((p) => p.len > 0.001);
const pointSegment = (p, a, b) => {
  const v = [b[0] - a[0], b[1] - a[1]],
    l = v[0] ** 2 + v[1] ** 2,
    t = l ? Math.max(0, Math.min(1, ((p[0] - a[0]) * v[0] + (p[1] - a[1]) * v[1]) / l)) : 0;
  return Math.hypot(p[0] - a[0] - t * v[0], p[1] - a[1] - t * v[1]);
};
function simplified(original, tolerance) {
  const p = original.map((q) => [...q]);
  if (!tolerance) return p;
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      // Test all original samples, rather than accumulating successive local errors.
      const next = p.filter((_, j) => i !== j);
      if (
        original.every(
          (q) =>
            Math.min(...next.map((a, j) => pointSegment(q, a, next[(j + 1) % next.length]))) <=
            tolerance,
        )
      ) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function member(out, slot, a, b, r, color, level) {
  const axis = normalize(b.map((v, i) => v - a[i])),
    u = normalize(cross(axis, Math.abs(axis[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(axis, u),
    sides = settings[level].sides;
  const ring = (p) =>
    Array.from({ length: sides }, (_, i) =>
      p.map(
        (x, k) =>
          x +
          r *
            (Math.cos((i * 2 * Math.PI) / sides) * u[k] +
              Math.sin((i * 2 * Math.PI) / sides) * v[k]),
      ),
    );
  loft(out, slot, [ring(a), ring(b)], color, { cap: false });
}
function curtain(out, plan, lo, hi, c, level) {
  for (const { a, b, n, len } of edges(plan)) {
    const at = (t, y, lift = 0) =>
      shift([a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t], n, lift);
    face(out, 'glass', [at(0, lo), at(1, lo), at(1, hi), at(0, hi)], blue);
    for (let j = 1; j <= c.floors; j++) {
      const y = lo + ((hi - lo) * j) / c.floors,
        h = level === 'district' ? 0.8 : 0.56;
      face(
        out,
        'metal',
        [at(0, y - h, 0.025), at(1, y - h, 0.025), at(1, y, 0.025), at(0, y, 0.025)],
        white,
      );
    }
    if (c.columns) {
      const count = Math.max(1, Math.ceil(len / c.columns)),
        half = Math.min(0.21 / count, 0.23 / len);
      for (let j = 0; j <= count; j++) {
        const l = Math.max(0, j / count - half),
          r = Math.min(1, j / count + half);
        face(
          out,
          'metal',
          [at(l, lo, 0.045), at(r, lo, 0.045), at(r, hi, 0.045), at(l, hi, 0.045)],
          white,
        );
      }
    }
  }
}
function balconies(out, plan, c, level) {
  for (const { a, b, n, len } of edges(plan)) {
    if ((a[0] + b[0]) / 2 > -8 || len < 1) continue;
    for (let j = 1; j <= c.balconyFloors; j++) {
      const y = 6.2 + (j * 226.3) / (level === 'district' ? 13 : 76),
        a0 = [a[0], y, a[1]],
        b0 = [b[0], y, b[1]],
        aa = shift(a0, n, 0.65),
        bb = shift(b0, n, 0.65);
      const top = [a0, b0, bb, aa];
      if (normalFor(...top)[1] < 0) top.reverse();
      face(out, 'concrete', top, white);
      face(out, 'concrete', top.map((p) => shift(p, [0, 1, 0], -0.18)).toReversed(), white);
      face(out, 'metal', [shift(aa, [0, 1, 0], -0.18), shift(bb, [0, 1, 0], -0.18), bb, aa], white);
      if (level === 'district') continue;
      face(
        out,
        'clear_glass',
        [aa, bb, shift(bb, [0, 1, 0], 1), shift(aa, [0, 1, 0], 1)],
        [0.58, 0.73, 0.77],
      );
      if (c.balconyRails)
        face(
          out,
          'metal',
          [
            shift(aa, [0, 1, 0], 0.93),
            shift(bb, [0, 1, 0], 0.93),
            shift(bb, [0, 1, 0], 1),
            shift(aa, [0, 1, 0], 1),
          ],
          white,
        );
      if (c.balconyRails) {
        const count = Math.max(1, Math.round(len / 3));
        for (let k = 0; k <= count; k++) {
          const p = lerp(aa, bb, k / count),
            t = normalize(bb.map((v, i) => v - aa[i]));
          face(
            out,
            'metal',
            [
              shift(p, t, -0.08),
              shift(p, t, 0.08),
              shift(shift(p, t, 0.08), [0, 1, 0], 1),
              shift(shift(p, t, -0.08), [0, 1, 0], 1),
            ],
            white,
          );
        }
      }
    }
  }
}
function glazedRoof(out, plan, level) {
  const ps = plan.map((p) => [p[0], q1CeilingHeight(p), p[1]]);
  // Ear clipping remains valid for a planar sloped ceiling; the sail above stays open.
  const wrapped = {
    addTriangle: (slot, ref, p, _n, uv, color) => {
      const q = p.map((v) => [v[0], q1CeilingHeight([v[0], v[2]]), v[2]]);
      out.addTriangle(slot, ref, q, normalFor(...q), uv, color);
    },
  };
  mappedCap(wrapped, 'clear_glass', plan, 0, [0.7, 0.82, 0.84]);
  for (const { a, b, n } of edges(plan)) {
    const topA = q1CeilingHeight(a),
      topB = q1CeilingHeight(b);
    face(
      out,
      'glass',
      [
        [a[0], 232.5, a[1]],
        [b[0], 232.5, b[1]],
        [b[0], topB, b[1]],
        [a[0], topA, a[1]],
      ],
      [0.21, 0.34, 0.41],
    );
    if (level !== 'skyline') {
      member(
        out,
        'metal',
        shift([a[0], topA, a[1]], n, 0.08),
        shift([b[0], topB, b[1]], n, 0.08),
        0.18,
        white,
        level,
      );
      member(out, 'metal', [a[0], 232.5, a[1]], [a[0], topA, a[1]], 0.16, white, level);
    }
  }
  if (level === 'source' || level === 'closeup' || level === 'street')
    for (let x = -15; x <= 15; x += level === 'street' ? 15 : 5) {
      const y = q1CeilingHeight([x, 0]);
      member(out, 'metal', [x, y + 0.08, -9], [x, y + 0.08, 9], 0.15, white, level);
    }
  return ps;
}
function sail(out, plan, c, level) {
  for (const { a, b, len, n } of edges(plan)) {
    const aa = [a[0], 245, a[1]],
      bb = [b[0], 245, b[1]],
      ta = [a[0], q1SailHeight(a), a[1]],
      tb = [b[0], q1SailHeight(b), b[1]];
    if (q1SailHeight(a) > 245.001 || q1SailHeight(b) > 245.001) {
      if (q1SailHeight(a) <= 245.001) tri(out, 'clear_glass', [aa, bb, tb], [0.72, 0.82, 0.85]);
      else if (q1SailHeight(b) <= 245.001)
        tri(out, 'clear_glass', [aa, tb, ta], [0.72, 0.82, 0.85]);
      else face(out, 'clear_glass', [aa, bb, tb, ta], [0.72, 0.82, 0.85]);
      member(
        out,
        'metal',
        shift(ta, n, 0.03),
        shift(tb, n, 0.03),
        level === 'skyline' ? 0.24 : 0.14,
        white,
        level,
      );
    }
    const count = Math.max(1, Math.round(len / c.ribSpacing));
    for (let j = 0; j < count; j++) {
      const p = lerp(a, b, j / count);
      member(
        out,
        'metal',
        [p[0], 233, p[1]],
        [p[0], q1SailHeight(p) + 7.5, p[1]],
        level === 'skyline' ? 0.32 : 0.2,
        white,
        level,
      );
    }
    if (c.crownBands)
      for (let y = 249.15; y < 279; y += c.crownBands) {
        const ha = q1SailHeight(a),
          hb = q1SailHeight(b);
        let l = 0,
          r = 1;
        if (ha < y && hb < y) continue;
        if (ha < y) l = (y - ha) / (hb - ha);
        else if (hb < y) r = (y - ha) / (hb - ha);
        const p = lerp(a, b, l),
          q = lerp(a, b, r),
          aa = shift([p[0], y - 0.1, p[1]], n, 0.04),
          bb = shift([q[0], y - 0.1, q[1]], n, 0.04);
        face(out, 'metal', [aa, bb, shift(bb, [0, 1, 0], 0.2), shift(aa, [0, 1, 0], 0.2)], white);
      }
  }
}
function climb(out, c, level) {
  const lengths = [0];
  for (let i = 1; i < q1ClimbRoute.length; i++)
    lengths.push(
      lengths.at(-1) + Math.hypot(...q1ClimbRoute[i].map((v, k) => v - q1ClimbRoute[i - 1][k])),
    );
  const length = lengths.at(-1),
    at = (d) => {
      let i = 1;
      while (i < lengths.length - 1 && d > lengths[i]) i++;
      const a = q1ClimbRoute[i - 1],
        b = q1ClimbRoute[i],
        span = lengths[i] - lengths[i - 1],
        q = lerp(a, b, (d - lengths[i - 1]) / span);
      return {
        p: [q[0], 240 + (d / length) * 30, q[1]],
        n: [-(b[1] - a[1]) / span, 0, (b[0] - a[0]) / span],
      };
    };
  if (c.steps)
    for (let i = 0; i < c.steps; i++) {
      const { p, n } = at(((i + 0.5) * length) / c.steps);
      p[1] = 240 + ((i + 1) * 30) / c.steps;
      beam(
        out,
        'metal',
        shift(p, n, -0.72),
        shift(p, n, 0.72),
        (length / c.steps) * 0.91,
        0.08,
        steel,
      );
      if (level === 'source' || level === 'closeup')
        if (i % 10 === 0 || i === c.steps - 1)
          for (const side of [-1, 1]) {
            const q = shift(p, n, side * 0.74);
            member(out, 'metal', q, shift(q, [0, 1, 0], 1.05), 0.04, steel, level);
          }
    }
  for (let i = 1; i < lengths.length; i++) {
    const a = at(lengths[i - 1] + 0.000001),
      b = at(lengths[i] - 0.000001);
    if (!c.steps)
      face(
        out,
        'metal',
        [
          shift(a.p, a.n, -0.72),
          shift(b.p, b.n, -0.72),
          shift(b.p, b.n, 0.72),
          shift(a.p, a.n, 0.72),
        ],
        steel,
      );
    for (const side of [-1, 1])
      for (const rise of level === 'skyline' ? [-0.22] : [-0.22, 1.05])
        member(
          out,
          'metal',
          shift(shift(a.p, a.n, side * 0.74), [0, 1, 0], rise),
          shift(shift(b.p, b.n, side * 0.74), [0, 1, 0], rise),
          rise < 0 ? 0.14 : 0.04,
          steel,
          level,
        );
  }
  box(out, 'metal', [20.2, 269.85, -3.8], [23.9, 270, -0.2], [0.61, 0.67, 0.68]);
  if (level !== 'skyline')
    for (const x of [20.3, 23.8])
      member(out, 'metal', [x, 271.08, -3.7], [x, 271.08, -0.3], 0.04, white, level);
}
function courtyardCanopy(out, level) {
  const fine = level === 'source' || level === 'closeup' || level === 'street';
  const p = [
    [-20.5, 6.5, -7],
    [-20.5, 6.5, 10],
    [-26, 7.6, 10],
    [-26, 7.6, -7],
  ];
  face(out, 'clear_glass', p, [0.65, 0.81, 0.85]);
  for (const z of fine ? [-7, -4, -1, 2, 5, 8, 10] : [-7, 10])
    member(out, 'metal', [-20.5, 6.5, z], [-26, 7.6, z], 0.16, steel, level);
  // Three broad metal blades and slender supports reproduce the photographed shade motif.
  for (const z of [-6, 1, 8]) {
    tri(
      out,
      'metal',
      [
        [-20.2, 7, z - 1],
        [-28, 9, z],
        [-20.2, 7, z + 1],
      ],
      [0.42, 0.57, 0.6],
    );
    tri(
      out,
      'metal',
      [
        [-20.2, 6.9, z + 1],
        [-28, 8.9, z],
        [-20.2, 6.9, z - 1],
      ],
      [0.36, 0.48, 0.51],
    );
    if (fine) member(out, 'metal', [-23.5, 3, z], [-26.5, 8.3, z], 0.18, steel, level);
  }
}
function build(out, level) {
  const c = settings[level],
    plan = simplified(localOutline(map), c.tolerance),
    podium = simplified(partPlan(map, podiumPart), c.tolerance),
    roofPlan = plan.map((p) => p.map((v) => v * 0.93)),
    crown = plan.map((p) => p.map((v) => v * 0.98));
  mappedSolid(out, 'stone', podium, 0, 0.3, [0.58, 0.57, 0.52]);
  curtain(
    out,
    podium,
    0.3,
    6.2,
    {
      floors: level === 'skyline' ? 0 : 2,
      columns: level === 'skyline' ? 0 : level === 'district' ? 8 : 3,
    },
    level,
  );
  mappedCap(out, 'concrete', podium, 6.2, [0.72, 0.72, 0.67]);
  curtain(out, plan, 6.2, 232.5, c, level);
  mappedCap(out, 'concrete', plan, 232.5, [0.66, 0.7, 0.66]);
  balconies(out, plan, c, level);
  glazedRoof(out, roofPlan, level);
  sail(out, crown, c, level);
  const rings = [
    [232.5, 0.7],
    [285, 0.58],
    [309, 0.34],
    [322.5, 0.05],
  ].map(([y, r]) =>
    radialRing(
      y,
      r,
      r,
      level === 'source' || level === 'closeup'
        ? 32
        : level === 'street'
          ? 16
          : level === 'district'
            ? 8
            : 4,
      q1Mast,
    ),
  );
  loft(out, 'metal', rings, [0.84, 0.86, 0.83]);
  climb(out, c, level);
  courtyardCanopy(out, level);
}
export function buildQ1ReviewedMaster(out) {
  build(out, 'source');
}
export function buildQ1Closeup(out) {
  build(out, 'closeup');
}
export function buildQ1Street(out) {
  build(out, 'street');
}
export function buildQ1District(out) {
  build(out, 'district');
}
export function buildQ1Skyline(out) {
  const wrapped = {};
  for (const method of ['addTriangle', 'addQuad', 'addConvexPolygon'])
    wrapped[method] = (component, _ref, p, n, uv, color) => {
      const graph = { stone: 'stone_granite', metal: 'metal_painted', concrete: 'concrete_plain' }[
          component
        ],
        mean = scope.sourceFacts.surfaceMeans[graph];
      out[method](
        'glass',
        'palette:#ffffff',
        p,
        n,
        uv,
        mean ? color.map((v, i) => v * mean[i]) : color,
      );
    };
  build(wrapped, 'skyline');
}

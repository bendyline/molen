/** Individually reviewed triangular tower, nine gardens, flat crown and lattice mast. */
import { readFileSync } from 'node:fs';
import { beam, loft, normalFor, radialRing } from './authored-structure-mesh.mjs';
import {
  bandPlan,
  face,
  grid,
  lerp,
  localOutline,
  mappedCap,
  mappedSolid,
  panel,
  partPlan,
  partsEvidence,
  shift,
} from './signature-tower-expansion-models.mjs';
import { tube } from './structure-mesh.mjs';
import { structureSourcePath } from './structure-source-paths.mjs';

const key = 'n0159_commerzbank_tower',
  map = JSON.parse(readFileSync(structureSourcePath(key, 'map-frame.json'))),
  scope = JSON.parse(readFileSync(structureSourcePath(key, 'review-scope.json'))),
  parts = partsEvidence(key),
  part = (id) => parts.find((p) => p.id === id),
  silver = [0.78, 0.8, 0.78],
  glass = [0.35, 0.44, 0.39];
export const commerzbankEntrance = map.orientationControl.entranceLocal;
const entryNormal = [-0.866025403784, 0, -0.5],
  entryTangent = [-0.5, 0, 0.866025403784];
const edges = (plan) =>
  plan
    .map((a, i) => {
      const b = plan[(i + 1) % plan.length],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { a, b, len, n: [-(b[1] - a[1]) / len, 0, (b[0] - a[0]) / len] };
    })
    .filter((e) => e.len > 0.05);
function simplified(plan, tolerance) {
  const p = plan.map((q) => [...q]);
  if (!tolerance) return p;
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        v = [c[0] - a[0], c[1] - a[1]],
        l = v[0] * v[0] + v[1] * v[1],
        t = l ? Math.max(0, Math.min(1, ((b[0] - a[0]) * v[0] + (b[1] - a[1]) * v[1]) / l)) : 0;
      if (Math.hypot(b[0] - a[0] - t * v[0], b[1] - a[1] - t * v[1]) < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
const planFor = (id, level) =>
  simplified(partPlan(map, part(id)), level === 'skyline' ? 0.75 : level === 'district' ? 0.4 : 0);
const detailLevel = (level) => level === 'source' || level === 'closeup';
// Cut the entrance through every forward facade layer; add recessed doors afterwards.
function cutEntrance(target) {
  const u = (p) =>
      (p[0] - commerzbankEntrance[0]) * entryTangent[0] +
      (p[2] - commerzbankEntrance[1]) * entryTangent[2],
    depth = (p) =>
      (p[0] - commerzbankEntrance[0]) * entryNormal[0] +
      (p[2] - commerzbankEntrance[1]) * entryNormal[2];
  const clip = (ps, value, bound, less) => {
    const out = [];
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i],
        b = ps[(i + 1) % ps.length],
        f = value(a) - bound,
        g = value(b) - bound,
        inside = less ? f <= 0 : f >= 0;
      if (inside) out.push(a);
      if ((f < 0 && g > 0) || (f > 0 && g < 0)) out.push(lerp(a, b, f / (f - g)));
    }
    return out.filter((p, i, a) => !i || Math.hypot(...p.map((v, k) => v - a[i - 1][k])) > 1e-7);
  };
  const emit = (component, ref, ps, normal, _uv, color) => {
    const us = ps.map(u);
    let polygons = [ps];
    if (
      ['metal', 'glass'].includes(component) &&
      ps.every((p) => Math.abs(depth(p)) < 0.48) &&
      Math.min(...ps.map((p) => p[1])) < 3.6 &&
      Math.max(...us) > -1.4 &&
      Math.min(...us) < 1.4
    ) {
      const mid = clip(clip(ps, u, -1.4, false), u, 1.4, true);
      polygons = [
        clip(ps, u, -1.4, true),
        clip(ps, u, 1.4, false),
        clip(mid, (p) => p[1], 0.4, true),
        clip(mid, (p) => p[1], 3.6, false),
      ];
    }
    for (const p of polygons)
      for (let j = 1; j < p.length - 1; j++) {
        const triangle = [p[0], p[j], p[j + 1]];
        if (Math.hypot(...normalFor(...triangle)) > 0.5)
          target.addTriangle(
            component,
            ref,
            triangle,
            normal,
            [
              [0, 0],
              [1, 0],
              [0, 1],
            ],
            color,
          );
      }
  };
  return { addTriangle: emit, addQuad: emit, addConvexPolygon: emit };
}
function entrance(out, level) {
  const at = (s, y, d) => [
    commerzbankEntrance[0] + s * entryTangent[0] + d * entryNormal[0],
    y,
    commerzbankEntrance[1] + s * entryTangent[2] + d * entryNormal[2],
  ];
  face(
    out,
    'stone',
    [at(-1.55, 0.4, -0.65), at(1.55, 0.4, -0.65), at(1.55, 0.4, 0.5), at(-1.55, 0.4, 0.5)],
    [0.48, 0.49, 0.46],
  );
  if (level === 'skyline') return;
  for (const s of [-1.4, 1.4])
    face(
      out,
      'metal',
      [at(s, 0.4, -0.65), at(s, 0.4, 0.12), at(s, 3.6, 0.12), at(s, 3.6, -0.65)],
      silver,
    );
  face(
    out,
    'metal',
    [at(-1.4, 3.6, -0.65), at(1.4, 3.6, -0.65), at(1.4, 3.6, 0.12), at(-1.4, 3.6, 0.12)],
    silver,
  );
  for (const [a, b] of [
    [-1.4, -0.07],
    [0.07, 1.4],
  ])
    panel(
      out,
      [at(a, 0.4, -0.55), at(b, 0.4, -0.55), at(b, 3.6, -0.55), at(a, 3.6, -0.55)],
      [0.16, 0.23, 0.24],
      0.07,
      silver,
    );
  if (level === 'district') return;
  for (const s of [-0.18, 0.18])
    beam(out, 'metal', at(s, 1, -0.44), at(s, 1.8, -0.44), 0.035, 0.05, silver);
}
function curtain(out, plan, y0, y1, level, body = glass) {
  const far = level === 'skyline',
    district = level === 'district',
    street = level === 'street';
  for (const { a, b, n, len } of edges(plan)) {
    const at = (t, y, d = 0) =>
      shift([a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t], n, d);
    if (!detailLevel(level)) face(out, 'glass', [at(0, y0), at(1, y0), at(1, y1), at(0, y1)], body);
    if (far) continue;
    const floors = Math.max(1, Math.round((y1 - y0) / 3.65));
    for (let f = 1; f <= floors; f++) {
      const hi = y0 + ((y1 - y0) * f) / floors,
        lo = hi - 0.9;
      if (detailLevel(level)) {
        const bottom = y0 + ((y1 - y0) * (f - 1)) / floors;
        face(out, 'glass', [at(0, bottom), at(1, bottom), at(1, lo), at(0, lo)], body);
      }
      if (district || street)
        face(
          out,
          'metal',
          [at(0, lo, 0.02), at(1, lo, 0.02), at(1, hi, 0.02), at(0, hi, 0.02)],
          silver,
        );
      else
        for (const [[l, d0], [h, d1]] of [
          [
            [lo, 0],
            [lo + 0.27, -0.12],
          ],
          [
            [lo + 0.27, -0.12],
            [hi - 0.09, -0.06],
          ],
          [
            [hi - 0.09, -0.06],
            [hi, 0.01],
          ],
        ])
          face(out, 'metal', [at(0, l, d0), at(1, l, d0), at(1, h, d1), at(0, h, d1)], silver);
    }
    const columns = Math.max(1, Math.ceil(len / (district ? 5.8 : street ? 2.9 : 1.45))),
      w = Math.min(0.22 / columns, 0.035 / len);
    for (let j = 0; j <= columns; j++) {
      const l = Math.max(0, j / columns - w),
        h = Math.min(1, j / columns + w);
      if (h > l)
        face(
          out,
          'metal',
          [at(l, y0, 0.03), at(h, y0, 0.03), at(h, y1, 0.03), at(l, y1, 0.03)],
          silver,
        );
    }
  }
}
function cladCore(out, plan, y0, y1, level) {
  mappedSolid(out, 'metal', plan, y0, y1, silver);
  if (level === 'skyline') return;
  for (const { a, b, n, len } of edges(plan)) {
    const at = (t, y) => shift([a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t], n, 0.025),
      half = Math.min(0.08, 0.16 / len);
    face(
      out,
      'glass',
      [at(0.5 - half, y0), at(0.5 + half, y0), at(0.5 + half, y1), at(0.5 - half, y1)],
      [0.29, 0.35, 0.33],
    );
    if (level === 'source' || level === 'closeup')
      for (const y of [y0 + 0.2, y1 - 0.2])
        face(out, 'metal', [at(0, y), at(1, y), at(1, y + 0.1), at(0, y + 0.1)], silver);
  }
}
function gardenTree(out, x, y, z, level) {
  const far = level === 'skyline',
    district = level === 'district',
    sides = far ? 3 : district ? 4 : level === 'street' ? 6 : 12;
  if (!far)
    tube(out, 'metal', [x, y, z], [x, y + 3.18, z], 0.14, [0.28, 0.23, 0.17], district ? 4 : 6);
  loft(
    out,
    'recess',
    [
      radialRing(y + 1.325, 1.166, 1.113, sides, [x, z]),
      radialRing(y + 3.445, 1.855, 1.696, sides, [x, z]),
      radialRing(y + 5.3, 0.1, 0.1, sides, [x, z]),
    ],
    [0.2, 0.29, 0.13],
  );
}
function mastStrut(out, a, b, r, color, level) {
  if (level !== 'skyline' && level !== 'district') {
    tube(out, 'metal', a, b, r, color, level === 'district' ? 4 : level === 'street' ? 4 : 6);
    return;
  }
  // Two intersecting strips stay perpendicular to vertical, horizontal and diagonal members.
  const v = b.map((x, i) => x - a[i]),
    horizontal = Math.hypot(v[0], v[2]),
    first = horizontal > 1e-9 ? [(v[2] * r) / horizontal, 0, (-v[0] * r) / horizontal] : [r, 0, 0],
    c = [
      v[1] * first[2] - v[2] * first[1],
      v[2] * first[0] - v[0] * first[2],
      v[0] * first[1] - v[1] * first[0],
    ],
    second = c.map((x) => (x * r) / Math.hypot(...c));
  for (const n of [first, second])
    face(
      out,
      'metal',
      [
        a.map((v, i) => v - n[i]),
        b.map((v, i) => v - n[i]),
        b.map((v, i) => v + n[i]),
        a.map((v, i) => v + n[i]),
      ],
      color,
    );
}
function lattice(out, level) {
  const base = partPlan(map, part(183060776)),
    upper = partPlan(map, part(279967630)),
    centroid = (p) => p.reduce((s, q) => s.map((v, i) => v + q[i] / p.length), [0, 0]);
  const lower = centroid(base),
    higher = centroid(upper);
  for (const [plan, lo, hi, step] of [
    [base, 215, 265, level === 'skyline' ? 25 : level === 'district' ? 12.5 : 5],
    [upper, 265, 299.9, level === 'skyline' ? 17.5 : level === 'district' ? 8.75 : 5],
  ]) {
    const c = plan === base ? lower : higher,
      count = Math.ceil((hi - lo) / step);
    for (let j = 0; j < count; j++) {
      const y0 = lo + ((hi - lo) * j) / count,
        y1 = lo + ((hi - lo) * (j + 1)) / count,
        color = j % 2 ? [0.85, 0.86, 0.82] : [0.72, 0.12, 0.1];
      const at = (p, y) => {
        const taper = plan === upper ? 1 - (0.7 * (y - lo)) / (hi - lo) : 1;
        return [c[0] + (p[0] - c[0]) * taper, y, c[1] + (p[1] - c[1]) * taper];
      };
      for (let i = 0; i < 3; i++) {
        const a = plan[i],
          b = plan[(i + 1) % 3];
        mastStrut(out, at(a, y0), at(a, y1), 0.1, color, level);
        mastStrut(out, at(a, y0), at(b, y1), 0.065, color, level);
        if (level !== 'skyline') mastStrut(out, at(a, y1), at(b, y1), 0.075, color, level);
      }
    }
  }
}
function build(out, level) {
  const detail = level === 'source' || level === 'closeup',
    target = out;
  out = cutEntrance(out);
  mappedSolid(
    out,
    'stone',
    simplified(localOutline(map), level === 'skyline' ? 0.75 : level === 'district' ? 0.4 : 0),
    0,
    0.4,
    [0.47, 0.46, 0.42],
  );
  for (const { id, high, gardens } of [
    { id: 279967645, high: 190, gardens: [70, 110, 150] },
    { id: 279967660, high: 180, gardens: [40, 80, 120] },
    { id: 279967663, high: 200, gardens: [60, 100, 140] },
  ]) {
    const p = planFor(id, level);
    let y = 0.4;
    for (const low of [...gardens, high]) {
      curtain(out, p, y, low, level);
      mappedCap(out, 'concrete', p, low, [0.62, 0.64, 0.59]);
      if (low === high) break;
      const top = low + 15,
        c = p.reduce((s, q) => s.map((v, i) => v + q[i] / p.length), [0, 0]);
      for (const { a, b, len } of edges(p)) {
        const mid = lerp(a, b, 0.5);
        if (Math.hypot(mid[0], mid[1] - 7) < 17) {
          if (level === 'skyline' || level === 'district')
            face(
              out,
              'glass',
              [
                [a[0], low, a[1]],
                [b[0], low, b[1]],
                [b[0], top, b[1]],
                [a[0], top, a[1]],
              ],
              glass,
            );
          else
            grid(
              out,
              [
                [a[0], low, a[1]],
                [b[0], low, b[1]],
                [b[0], top, b[1]],
                [a[0], top, a[1]],
              ],
              glass,
              level === 'street' ? 5 : 2.5,
              3.6,
              0.07,
              silver,
            );
          continue;
        }
        if (level !== 'skyline') {
          const count = Math.max(1, Math.round(len / (level === 'district' ? 12 : 4.5)));
          for (let i = 0; i <= count; i++) {
            const q = lerp(a, b, i / count);
            if (level === 'district')
              mastStrut(out, [q[0], low, q[1]], [q[0], top, q[1]], 0.11, silver, level);
            else beam(out, 'metal', [q[0], low, q[1]], [q[0], top, q[1]], 0.16, 0.22, silver);
          }
          for (const yy of level === 'district' ? [low + 7.5] : [low + 5, low + 10]) {
            if (level === 'district')
              mastStrut(out, [a[0], yy, a[1]], [b[0], yy, b[1]], 0.09, silver, level);
            else beam(out, 'metal', [a[0], yy, a[1]], [b[0], yy, b[1]], 0.13, 0.18, silver);
          }
        }
        if (len > 6) {
          const t = lerp(mid, c, 0.55);
          gardenTree(out, t[0], low + 0.3, t[1], level);
        }
      }
      mappedCap(out, 'concrete', p, top, [0.67, 0.69, 0.65], [], true);
      y = top;
    }
  }
  for (const id of [127956225, 183060775, 279967650]) {
    const p = planFor(id, level),
      hi = +part(id).tags.height;
    cladCore(out, p, 0.4, hi, level);
    if (detail) bandPlan(out, p, hi - 0.3, 0.3, 0.45, silver, 'metal');
  }
  cladCore(out, planFor(183060773, level), 220, 259, level);
  // The engineer publishes a160m central atrium. Its reconstructed glazing roof closes
  // the actual triangular gap between the three independent office-wing plans.
  const atrium = [
    [0.4555732304551615, -3.6643532878686016],
    [-8.195995224854151, 10.798474648711945],
    [8.53060009435102, 11.080399955388957],
  ];
  mappedCap(out, 'glass', atrium, 160, [0.36, 0.45, 0.43]);
  if (level !== 'skyline')
    for (const { a, b } of edges(atrium))
      beam(out, 'metal', [a[0], 159.95, a[1]], [b[0], 159.95, b[1]], 0.1, 0.1, silver);
  lattice(out, level);
  const tip = partPlan(map, part(279967630)).reduce(
    (s, p, _, plan) => s.map((v, i) => v + p[i] / plan.length),
    [0, 0],
  );
  mastStrut(out, [tip[0], 299.8, tip[1]], [tip[0], 300, tip[1]], 0.025, silver, level);
  entrance(target, level);
}
export function buildCommerzbankReviewedMaster(out) {
  build(out, 'source');
}
export function buildCommerzbankCloseup(out) {
  build(out, 'closeup');
}
export function buildCommerzbankStreet(out) {
  build(out, 'street');
}
export function buildCommerzbankDistrict(out) {
  build(out, 'district');
}
export function buildCommerzbankSkyline(out) {
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

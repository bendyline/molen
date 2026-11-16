/** Deterministic exterior of the independently streamed Bali Mandara viaduct sections. */
import { readFileSync } from 'node:fs';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const surfaces = {
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.92 },
  pavement: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.97 },
  steel: { slot: 'trim', graph: 'metal_painted', roughness: 0.72, metallic: 0.17 },
};
const asphalt = [0.103, 0.104, 0.1],
  slab = [0.59, 0.565, 0.511],
  gray = [0.41, 0.425, 0.403];
const pierConcrete = [0.47, 0.459, 0.414],
  white = [0.86, 0.827, 0.734],
  silver = [0.69, 0.702, 0.661];
const up = [0, 1, 0],
  down = [0, -1, 0];
const levels = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const mix = (a, b, t) => a + (b - a) * t;
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
function triangle(out, slot, color, points, facing) {
  let n = normalFor(...points);
  if (Math.hypot(...n) < 0.9) return;
  if (dot(n, facing) < 0) {
    points = points.toReversed();
    n = n.map((v) => -v);
  }
  out.addTriangle(slot, '', points, n, undefined, color);
}
function face(out, slot, tint, [a, b, c, d], facing) {
  triangle(out, slot, tint, [a, b, c], facing);
  triangle(out, slot, tint, [a, c, d], facing);
}
function at(lane, s) {
  const rows = lane.centerline;
  if (s <= rows[0][0]) return rows[0];
  if (s >= rows.at(-1)[0]) return rows.at(-1);
  let lo = 0,
    hi = rows.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (rows[m][0] > s) hi = m;
    else lo = m;
  }
  const a = rows[lo],
    b = rows[hi],
    t = (s - a[0]) / (b[0] - a[0]);
  return a.map((v, i) => mix(v, b[i], t));
}
function point([, x, z, y, dx, dz], offset = 0, lift = 0) {
  const scale = Math.hypot(dx, dz);
  return [x - (dz * offset) / scale, y + lift, z + (dx * offset) / scale];
}
const side = (row, sign) => [-row[5] * sign, 0, row[4] * sign];
function reduceRows(rows, tolerance) {
  const last = rows.length - 1,
    keep = new Set([0, last]),
    stack = [[0, last]];
  while (stack.length) {
    const [lo, hi] = stack.pop(),
      a = rows[lo],
      b = rows[hi];
    let best = hi,
      max = tolerance;
    for (let i = lo + 1; i < hi; i++) {
      const r = rows[i],
        t = (r[0] - a[0]) / (b[0] - a[0]);
      const error = Math.hypot(
        r[1] - mix(a[1], b[1], t),
        r[2] - mix(a[2], b[2], t),
        r[3] - mix(a[3], b[3], t),
      );
      if (error > max) {
        best = i;
        max = error;
      }
    }
    if (best === hi) continue;
    keep.add(best);
    stack.push([lo, best], [best, hi]);
  }
  return rows.filter((_, i) => keep.has(i));
}
function sweep(out, slot, color, a, b, inner, y0, outer, y1, facing) {
  face(
    out,
    slot,
    color,
    [point(a, inner, y0), point(b, inner, y0), point(b, outer, y1), point(a, outer, y1)],
    facing,
  );
}
function eachSpan(rows, draw) {
  for (let i = 1; i < rows.length; i++) draw(rows[i - 1], rows[i]);
}
/** End normals are sampled before section cuts, so all LODs meet the neighboring deck edges. */
function deck(out, lane, detail, rows) {
  const w = lane.halfWidth;
  eachSpan(rows, (a, b) => {
    sweep(out, 'pavement', asphalt, a, b, -w, 0, w, 0, up);
    if (detail === 0) return;
    for (const sign of [-1, 1]) {
      const edge = w * sign,
        n = side(a, sign),
        lower = (w - 0.36) * sign;
      sweep(out, 'concrete', slab, a, b, edge, -0.21, edge, 0, n);
      if (detail > 0) sweep(out, 'concrete', gray, a, b, lower, -0.66, edge, -0.21, n);
    }
    if (detail > 0) sweep(out, 'concrete', gray, a, b, -w + 0.36, -0.66, w - 0.36, -0.66, down);
  });
}
function parapets(out, lane, rows, detail) {
  if (detail === 0) return;
  const w = lane.halfWidth;
  for (const sign of [-1, 1]) {
    const open = (station) => lane.barriers.some(([from, to]) => station >= from && station <= to);
    const extra = lane.barriers.flatMap(([from, to]) => [at(lane, from), at(lane, to)]);
    const spanRows = [...rows, ...extra]
      .sort((a, b) => a[0] - b[0])
      .filter((r, i, a) => !i || r[0] - a[i - 1][0] > 0.011);
    eachSpan(spanRows, (a, b) => {
      if (open((a[0] + b[0]) / 2)) return;
      const outside = (w - 0.043) * sign,
        inside = (w - 0.38) * sign,
        n = side(a, sign);
      sweep(out, 'concrete', slab, a, b, inside, 0.57, outside, 0.57, up);
      sweep(out, 'concrete', slab, a, b, outside, 0, outside, 0.57, n);
      if (detail < 2) return;
      sweep(
        out,
        'concrete',
        slab,
        a,
        b,
        inside,
        0,
        inside,
        0.57,
        n.map((v) => -v),
      );
      const rail = (w - 0.155) * sign;
      sweep(out, 'steel', silver, a, b, rail - 0.036, 0.91, rail + 0.036, 0.91, up);
      sweep(out, 'steel', silver, a, b, rail, 0.84, rail, 0.91, n);
      if (detail >= 3)
        sweep(
          out,
          'steel',
          silver,
          a,
          b,
          rail + 0.008,
          0.84,
          rail + 0.008,
          0.91,
          n.map((v) => -v),
        );
    });
    if (detail < 2) continue;
    const stride = detail === 2 ? 36 : detail === 3 ? 14.7 : 6.75;
    for (let s = (Math.floor(lane.from / stride) + 1) * stride; s < lane.to - 0.1; s += stride) {
      if (open(s)) continue;
      const row = at(lane, s),
        offset = (w - 0.15) * sign;
      beam(out, 'steel', point(row, offset, 0.57), point(row, offset, 0.89), 0.065, 0.086, silver);
    }
  }
}
function lines(out, lane, rows, detail) {
  if (detail < 2) return;
  const w = lane.halfWidth;
  for (const edge of [-w + 0.54, w - 0.54])
    eachSpan(rows, (a, b) =>
      sweep(out, 'pavement', white, a, b, edge - 0.055, 0.016, edge + 0.055, 0.016, up),
    );
  if (lane.kind === 'motorcycle' || lane.kind === 'connector') return;
  const spacing = detail === 2 ? 26 : detail === 3 ? 13 : 10.7;
  for (let s = Math.ceil(lane.from / spacing) * spacing; s < lane.to - 0.2; s += spacing) {
    const end = Math.min(s + (detail === 2 ? 7.8 : 4.1), lane.to);
    sweep(out, 'pavement', white, at(lane, s), at(lane, end), -0.062, 0.018, 0.062, 0.018, up);
  }
}
function pile(out, pos, foot, detail, radius) {
  const [x, y, z] = pos;
  if (y - foot < 0.3) return;
  const ring = (h, r) =>
    radialRing(h, r, r, detail >= 4 ? 12 : detail === 3 ? 8 : detail === 2 ? 6 : 4, [x, z]);
  const rings =
    detail < 3
      ? [ring(foot, radius), ring(y, radius)]
      : [ring(foot, radius * 1.12), ring(y - 0.32, radius), ring(y, radius * 1.38)];
  loft(out, 'concrete', rings, pierConcrete, { cap: false });
}
function piles(out, lane, detail, sectionPoleBudget) {
  const w = lane.halfWidth;
  const stride =
    detail === 0
      ? Math.max(1, Math.ceil(lane.piers.length / sectionPoleBudget))
      : detail === 1
        ? 4
        : detail <= 3
          ? 2
          : 1;
  for (let i = 0; i < lane.piers.length; i += stride) {
    const row = lane.piers[i],
      floor = row[6],
      offsets = detail < 2 || w < 2.3 ? [0] : [-w * 0.51, w * 0.51];
    for (const offset of offsets)
      pile(out, point(row, offset, -0.72), floor, detail, offsets.length === 1 ? 0.39 : 0.3);
    if (detail < 2) continue;
    beam(
      out,
      'concrete',
      point(row, -w * 0.77, -0.76),
      point(row, w * 0.77, -0.76),
      0.73,
      detail === 2 ? 0.26 : 0.43,
      slab,
    );
    if (detail === 4)
      for (const p of offsets) {
        beam(out, 'steel', point(row, p, -0.64), point(row, p, -0.43), 0.41, 0.39, gray);
      }
  }
}
function lighting(out, lane, detail) {
  if (detail < 2 || lane.kind !== 'road') return;
  const spacing = detail < 4 ? 102 : 57.8;
  const offset = lane.halfWidth - 0.34;
  for (let s = Math.ceil(lane.from / spacing) * spacing; s < lane.to - 1.1; s += spacing) {
    const row = at(lane, s);
    const base = point(row, offset, 0.58),
      top = point(row, offset, 7.7),
      end = point(row, offset - 2.34, 8.02);
    beam(out, 'steel', base, top, 0.128, 0.146, silver);
    if (detail >= 3) beam(out, 'steel', top, end, 0.094, 0.12, silver);
    beam(out, 'steel', end, point(row, offset - 2.67, 7.99), 0.15, 0.11, white);
  }
}
export function buildCausewaySection(out, level, id) {
  const section = layout.sections.find((s) => s.id === id),
    detail = levels[level];
  if (!section || detail === undefined)
    throw Error('Unknown Bali Mandara section or LOD ' + id + ' ' + level);
  const poleBudget = Math.max(2, Math.floor(52 / section.lanes.length));
  for (const lane of section.lanes) {
    const rows =
      detail <= 3
        ? reduceRows(
            lane.centerline,
            [Math.min(lane.halfWidth * 0.65, 1.3), 1.03, 0.31, 0.105][detail],
          )
        : lane.centerline;
    deck(out, lane, detail, rows);
    piles(out, lane, detail, poleBudget);
    parapets(out, lane, rows, detail);
    lines(out, lane, rows, detail);
    lighting(out, lane, detail);
  }
}

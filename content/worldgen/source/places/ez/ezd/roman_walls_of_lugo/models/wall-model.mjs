/** Current Roman Walls of Lugo from the mapped inner and outer rampart faces. */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  beam,
  loft,
  normalFor,
  radialRing,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';

const earcut = createRequire(
  new URL('../../../../../../../../packages/worldgen/package.json', import.meta.url),
)('earcut').default;
export const layout = JSON.parse(readFileSync(new URL('../layout.json', import.meta.url)));
export const wallSurfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall' },
  ashlar: { slot: 'trim', graph: 'stone_ashlar' },
  walk: { slot: 'foundation', graph: 'stone_granite' },
};
const tones = {
  stone: 'a8a396',
  gray: '9e9d93',
  warm: 'aaa191',
  cold: '999c96',
  dry: 'aaa79a',
  moss: '9f9d86',
  trim: 'bbb3a0',
  quoin: 'aca18d',
  coping: 'b0a998',
  road: 'b8b1a1',
  patched: 'a8a294',
  dark: '706b5b',
  niche: '858073',
  pearl: 'c7bda9',
};
const color = Object.fromEntries(
  Object.entries(tones).map(([key, hex]) => [
    key,
    hex.match(/../g).map((v) => {
      const s = parseInt(v, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }),
  ]),
);
const REF = 'palette:#ffffff',
  TIER = { skyline: 0, district: 1, street: 2, closeup: 3, master: 4 };
const mix = (a, b, t) => a + (b - a) * t,
  lerp = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
const sub = (a, b) => a.map((v, i) => v - b[i]),
  normalize = (p) => {
    const n = Math.hypot(...p) || 1;
    return p.map((v) => v / n);
  };
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  xyz = ([x, z], y) => [x, y, z],
  up = [0, 1, 0];

function face(out, slot, tone, points, wanted) {
  if (slot === 'rubble' && points.length === 4) {
    const n = normalFor(...points);
    if (Math.hypot(...n) > 0.9) {
      const p = dot(n, wanted) < 0 ? points.toReversed() : points;
      const normal = normalFor(...p);
      const uv = ([x, y, z]) => [x * normal[2] - z * normal[0], y * 3.45];
      out.addQuad(slot, 'metric:uv', p, normal, p.map(uv), color[tone]);
      return;
    }
  }
  const triangles =
    points.length === 3 ? [points] : [points.slice(0, 3), [points[0], points[2], points[3]]];
  for (let p of triangles) {
    const a = sub(p[1], p[0]),
      b = sub(p[2], p[0]);
    if (
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]) <
      0.000001
    )
      continue;
    let n = normalFor(...p);
    if (dot(n, wanted) < 0) {
      p = [p[0], p[2], p[1]];
      n = n.map((v) => -v);
    }
    out.addTriangle(slot, REF, p, n, undefined, color[tone]);
  }
}
function segmentError(p, a, b) {
  const v = sub(b, a),
    den = dot(v, v) || 1,
    t = Math.max(0, Math.min(1, dot(sub(p, a), v) / den));
  return Math.hypot(...sub(p, lerp(a, b, t)));
}
function simplify(run, tolerance) {
  let max = 0,
    split = 0;
  const first = run[0],
    last = run.at(-1);
  for (let i = 1; i < run.length - 1; i++) {
    const row = run[i],
      t = (row.s - first.s) / (last.s - first.s || 1);
    const error = Math.max(
      segmentError(row.p, first.p, last.p),
      Math.abs(row.top - mix(first.top, last.top, t)) * 1.3,
      Math.abs(row.base - mix(first.base, last.base, t)) * 0.82,
    );
    if (error > max) {
      max = error;
      split = i;
    }
  }
  return max > tolerance
    ? [
        ...simplify(run.slice(0, split + 1), tolerance).slice(0, -1),
        ...simplify(run.slice(split), tolerance),
      ]
    : [first, last];
}
function makeRim(which, tier) {
  const gates = layout.gates.map((g) => ({ index: g.index, m: g.mouths[which] }));
  const all = layout.rims[which].filter((r) =>
    gates.every(({ m }) => r.s < m.start - 0.02 || r.s > m.end + 0.02),
  );
  for (const { m, index } of gates)
    all.push({ ...m.samples[0], portal: index, break: true }, { ...m.samples.at(-1), break: true });
  if (which === 1 && tier)
    for (const {
      opening: [a, b],
    } of layout.stairs) {
      all.push({ ...a, break: true }, { ...b, break: true });
      for (const row of all) if (row.s >= a.s && row.s < b.s) row.stairOpening = true;
    }
  all.sort((a, b) => a.s - b.s);
  if (tier >= 2) return all;
  const anchors = all.flatMap((r, i) => (r.break || i === 0 || i === all.length - 1 ? [i] : []));
  const tolerance = which === 0 ? [4.1, 1.92][tier] : [2.8, 1.7][tier];
  return [
    ...anchors
      .slice(1)
      .flatMap((b, i) => simplify(all.slice(anchors[i], b + 1), tolerance).slice(0, -1)),
    all.at(-1),
  ];
}
function outward(a, b, side) {
  const [x, z] = normalize(sub(b, a));
  return [z * side, -x * side];
}
const toneAt = (i) =>
  ['stone', 'gray', 'warm', 'cold', 'dry', 'moss', 'stone', 'warm'][
    (Math.imul(i, 2654435761) >>> 23) % 8
  ];
function wallRim(out, rows, which, tier) {
  const side = which === 0 ? 1 : -1;
  const normalAt = (i) =>
    normalize(
      outward(rows.at(i - 1).p, rows[i].p, side).map(
        (v, k) => v + outward(rows[i].p, rows[(i + 1) % rows.length].p, side)[k],
      ),
    );
  for (let i = 0; i < rows.length; i++) {
    const a = rows[i],
      j = (i + 1) % rows.length,
      b = rows[j],
      n = outward(a.p, b.p, side),
      normal = [n[0], 0, n[1]];
    const p = xyz(a.p, a.top),
      q = xyz(b.p, b.top),
      colorName = tier === 0 ? 'stone' : toneAt(Math.floor(a.s / 4.3) + which * 829);
    if (a.portal === undefined) {
      if (tier >= 3 && Math.hypot(...sub(b.p, a.p)) > 2.25) {
        const r = xyz(a.p, a.base),
          s = xyz(b.p, b.base),
          level = 0.28 + (i % 7) * 0.021;
        const m = lerp(r, p, level),
          k = lerp(s, q, level);
        face(out, 'rubble', colorName, [r, s, k, m], normal);
        face(out, 'rubble', toneAt(Math.floor(a.s / 6.2) + 7), [m, k, q, p], normal);
      } else face(out, 'rubble', colorName, [xyz(a.p, a.base), xyz(b.p, b.base), q, p], normal);
    }
    if (!tier || (tier === 1 && which === 1)) continue;
    const lip = (row, index) => {
      const n = normalAt(index),
        w = which === 0 ? 0.42 : 0.32;
      return row.p.map((v, k) => v - w * n[k]);
    };
    const rise = which === 0 ? 1.04 : 0.77,
      h = tier >= 2 ? rise + ((i % 5) - 2) * 0.012 : rise;
    if (a.stairOpening) continue;
    const la = lip(a, i),
      lb = lip(b, j),
      ta = xyz(a.p, a.top + h),
      tb = xyz(b.p, b.top + h),
      pa = xyz(la, a.top + h),
      pb = xyz(lb, b.top + h);
    face(out, 'rubble', colorName, [p, q, tb, ta], normal);
    face(
      out,
      'rubble',
      'patched',
      [xyz(la, a.top - 0.035), xyz(lb, b.top - 0.035), pb, pa],
      normal.map((v) => -v),
    );
    face(out, 'ashlar', 'coping', [ta, tb, pb, pa], up);
  }
}
function walkway(out, outer, inner) {
  const points = [...outer, ...inner],
    triangles = earcut(
      points.flatMap((r) => r.p),
      [outer.length],
    );
  for (let i = 0; i < triangles.length; i += 3) {
    const rows = triangles.slice(i, i + 3).map((j) => points[j]);
    face(
      out,
      'walk',
      'road',
      rows.map((row) => xyz(row.p, row.top - 0.012)),
      up,
    );
  }
}

function portal(out, g, tier) {
  const count = [4, 7, 12, 18, 22][tier];
  const [a, b] = g.mouths;
  const lateral = normalize(sub(a.samples.at(-1).p, a.samples[0].p)),
    dir = g.dir;
  const frames = [a, b].map((m) => ({ m, start: m.samples[0], end: m.samples.at(-1) }));
  function frame({ m, start, end }, theta, thickness = 0, proud = 0, side = 1) {
    const ratio = (1 - Math.cos(theta)) / 2,
      p = lerp(start.p, end.p, ratio),
      center = lerp(start.p, end.p, 0.5);
    const v = normalize(sub(end.p, start.p)),
      horizontal = -Math.cos(theta) * thickness;
    const x = p.map((n, i) => n + v[i] * horizontal + dir[i] * proud * side);
    const z = m.spring + (m.crown - m.spring + thickness) * Math.sin(theta);
    return {
      p: xyz(x, z),
      top: xyz(
        center.map((_, i) => p[i]),
        mix(start.top, end.top, ratio),
      ),
      t: ratio,
    };
  }
  const profiles = frames.map((f) =>
    Array.from({ length: count + 1 }, (_, i) => frame(f, (Math.PI * i) / count)),
  );
  for (let j = 0; j < 2; j++) {
    const side = j === 0 ? 1 : -1,
      normal = [dir[0] * side, 0, dir[1] * side],
      { m, start, end } = frames[j];
    for (let i = 1; i <= count; i++) {
      const p = profiles[j][i - 1],
        q = profiles[j][i];
      face(out, 'rubble', toneAt(g.index * 19 + i), [p.p, q.p, q.top, p.top], normal);
      if (!tier) continue;
      const angles = [(Math.PI * (i - 1)) / count, (Math.PI * i) / count],
        trim = tier >= 2 ? 0.39 : 0.29;
      const inner = angles.map((t) => frame(frames[j], t, 0, 0.038, side).p);
      const outer = angles.map((t) => frame(frames[j], t, trim, 0.045, side).p);
      face(
        out,
        'ashlar',
        i % 4 === 0 ? 'quoin' : 'trim',
        [inner[0], inner[1], outer[1], outer[0]],
        normal,
      );
    }
    if (tier >= 2)
      for (const [sign, row] of [
        [-1, start],
        [1, end],
      ]) {
        const span = m.spring - row.base,
          n = 6;
        for (let i = 0; i < n; i++) {
          const y0 = row.base + (span * i) / n,
            y1 = row.base + (span * (i + 1)) / n - 0.018;
          const left = row.p.map((v, k) => v + dir[k] * side * 0.042),
            right = left.map((v, k) => v + lateral[k] * sign * (i % 2 ? 0.4 : 0.48));
          face(
            out,
            'ashlar',
            i % 3 ? 'trim' : 'quoin',
            [xyz(left, y0), xyz(right, y0), xyz(right, y1), xyz(left, y1)],
            normal,
          );
        }
      }
  }
  for (let i = 1; i <= count; i++) {
    const theta = (Math.PI * (i - 0.5)) / count,
      normal = [lateral[0] * Math.cos(theta), -Math.sin(theta), lateral[1] * Math.cos(theta)];
    face(
      out,
      'ashlar',
      i % 5 === 0 ? 'quoin' : 'patched',
      [profiles[0][i - 1].p, profiles[0][i].p, profiles[1][i].p, profiles[1][i - 1].p],
      normal,
    );
  }
  for (const [i, sign] of [
    [0, 1],
    [count, -1],
  ]) {
    const outer = i === 0 ? frames[0].start : frames[0].end,
      inner = i === 0 ? frames[1].start : frames[1].end;
    face(
      out,
      'ashlar',
      'quoin',
      [xyz(outer.p, outer.base), xyz(inner.p, inner.base), profiles[1][i].p, profiles[0][i].p],
      [sign * lateral[0], 0, sign * lateral[1]],
    );
  }
}

function wallFeature(
  out,
  { center, dir, normal, y },
  width,
  height,
  depth,
  openings,
  tier,
  slot = 'rubble',
) {
  const p = (u, h, offset = 0) =>
    xyz(
      center.map((v, i) => v + u * dir[i] + offset * normal[i]),
      y + h,
    );
  const heightAt = typeof height === 'function' ? height : () => height;
  const top = (u, offset = 0) => p(u, heightAt(u), offset);
  const count = tier === 0 ? 3 : tier === 1 ? 5 : 8;
  const side = [normal[0], 0, normal[1]],
    back = side.map((v) => -v);
  let last = -width / 2;
  for (const { x, w, base, spring, rise } of openings) {
    for (const offset of [0, -depth]) {
      const n = offset === 0 ? side : back;
      face(
        out,
        slot,
        'stone',
        [p(last, 0, offset), p(x - w, 0, offset), top(x - w, offset), top(last, offset)],
        n,
      );
      face(
        out,
        slot,
        'stone',
        [p(x - w, 0, offset), p(x + w, 0, offset), p(x + w, base, offset), p(x - w, base, offset)],
        n,
      );
      for (let j = 0; j < count; j++) {
        const a = (Math.PI * j) / count,
          b = (Math.PI * (j + 1)) / count;
        const u = x - w * Math.cos(a),
          v = x - w * Math.cos(b),
          h = spring + rise * Math.sin(a),
          k = spring + rise * Math.sin(b);
        face(
          out,
          slot,
          'gray',
          [p(u, h, offset), p(v, k, offset), top(v, offset), top(u, offset)],
          n,
        );
        if (offset === 0)
          face(
            out,
            'ashlar',
            'trim',
            [p(u, h), p(v, k), p(v, k, -depth), p(u, h, -depth)],
            [
              dir[0] * Math.cos((a + b) / 2),
              -Math.sin((a + b) / 2),
              dir[1] * Math.cos((a + b) / 2),
            ],
          );
      }
    }
    for (const sign of [-1, 1]) {
      const u = x + sign * w;
      face(
        out,
        'ashlar',
        'quoin',
        [p(u, base), p(u, spring), p(u, spring, -depth), p(u, base, -depth)],
        [-sign * dir[0], 0, -sign * dir[1]],
      );
    }
    last = x + w;
  }
  for (const offset of [0, -depth])
    face(
      out,
      slot,
      'gray',
      [p(last, 0, offset), p(width / 2, 0, offset), top(width / 2, offset), top(last, offset)],
      offset === 0 ? side : back,
    );
  for (const sign of [-1, 1])
    face(
      out,
      slot,
      'warm',
      [
        p((sign * width) / 2, 0),
        top((sign * width) / 2),
        top((sign * width) / 2, -depth),
        p((sign * width) / 2, 0, -depth),
      ],
      [dir[0] * sign, 0, dir[1] * sign],
    );
  const profile = [
    -width / 2,
    ...openings.flatMap(({ x, w }) =>
      Array.from({ length: count + 1 }, (_, j) => x - w * Math.cos((Math.PI * j) / count)),
    ),
    width / 2,
  ];
  for (let i = 1; i < profile.length; i++) {
    const a = profile[i - 1],
      b = profile[i];
    face(out, 'ashlar', 'coping', [top(a), top(b), top(b, -depth), top(a, -depth)], up);
  }
  return p;
}
function mosqueira(out, tier) {
  const { center, dir, out: normal, top, height } = layout.mosqueira;
  const irregular = (u) =>
    height +
    0.39 +
    0.36 * Math.sin(0.9 * u + 0.46) +
    0.22 * Math.cos(2.22 * u) +
    0.035 * Math.sin(9.1 * u);
  wallFeature(
    out,
    { center, dir, normal, y: top - 0.46 },
    6.0,
    irregular,
    0.75,
    [
      { x: -1.36, w: 0.61, base: 1.04, spring: 2.39, rise: 0.65 },
      { x: 1.37, w: 0.64, base: 1.18, spring: 2.47, rise: 0.68 },
    ],
    tier,
  );
}
function rampartStairs(out, tier) {
  if (!tier) return;
  for (const s of layout.stairs) {
    const [dx, dz] = normalize(sub(s.top, s.foot));
    const point = (t, w, y) => {
      const [x, z] = lerp(s.foot, s.top, t);
      return [x - dz * w, y, z + dx * w];
    };
    const count = tier === 1 ? 12 : Math.ceil((s.deck - s.ground) / 0.195),
      half = s.width / 2;
    for (let i = 0; i < count; i++) {
      const a = i / count,
        b = (i + 1) / count,
        y = mix(s.ground, s.deck, b),
        prev = mix(s.ground, s.deck, a);
      face(
        out,
        'walk',
        'patched',
        [point(a, -half, y), point(b, -half, y), point(b, half, y), point(a, half, y)],
        up,
      );
      face(
        out,
        'ashlar',
        'quoin',
        [point(a, -half, prev), point(a, half, prev), point(a, half, y), point(a, -half, y)],
        [-dx, 0, -dz],
      );
      for (const sign of [-1, 1]) {
        const w = sign * half;
        face(
          out,
          'rubble',
          'stone',
          [
            point(a, w, s.ground - 0.48),
            point(b, w, s.ground - 0.48),
            point(b, w, y),
            point(a, w, y),
          ],
          [-dz * sign, 0, dx * sign],
        );
      }
    }
  }
}
function santiagoShrine(out, tier) {
  if (!tier) return;
  const g = layout.gates.find((g) => g.name === 'Porta de Santiago'),
    inside = g.mouths[1],
    normal = g.dir.map((v) => -v);
  const direction = normalize(sub(inside.samples.at(-1).p, inside.samples[0].p));
  const y = (inside.samples[0].top + inside.samples.at(-1).top) / 2 + 0.07;
  const p = wallFeature(
    out,
    { center: inside.center, dir: direction, normal, y },
    3.55,
    3.34,
    0.64,
    [{ x: 0, w: 0.79, base: 0.74, spring: 2.16, rise: 0.72 }],
    tier,
    'ashlar',
  );
  face(
    out,
    'ashlar',
    'niche',
    [p(-0.81, 0.74, -0.62), p(0.81, 0.74, -0.62), p(0.81, 2.94, -0.62), p(-0.81, 2.94, -0.62)],
    [normal[0], 0, normal[1]],
  );
  for (const sign of [-1, 1])
    beam(
      out,
      'ashlar',
      p(sign * 0.98, 0.45, 0.16),
      p(sign * 0.98, 2.29, 0.16),
      0.27,
      0.29,
      color.trim,
    );
  beam(out, 'ashlar', p(-1.5, 0.68, 0.21), p(1.5, 0.68, 0.21), 0.36, 0.25, color.pearl);
  if (tier < 2) return;
  const [x, , z] = p(0.04, 1.08, -0.07);
  loft(
    out,
    'ashlar',
    [
      radialRing(y + 0.79, 0.32, 0.19, 8, [x, z]),
      radialRing(y + 1.23, 0.43, 0.22, 8, [x, z]),
      radialRing(y + 1.52, 0.22, 0.19, 8, [x, z]),
    ],
    color.quoin,
  );
  const [hx, , hz] = p(0.07, 1.47, 0.12);
  loft(
    out,
    'ashlar',
    [
      radialRing(y + 1.42, 0.23, 0.19, 8, [hx, hz]),
      radialRing(y + 2.02, 0.19, 0.17, 8, [hx, hz]),
      radialRing(y + 2.27, 0.13, 0.13, 8, [hx, hz]),
    ],
    color.pearl,
  );
}
export function buildWallLevel(out, level = 'master') {
  const tier = TIER[level];
  if (tier === undefined) throw Error(`Unknown Lugo tier ${level}`);
  const outer = makeRim(0, tier),
    inner = makeRim(1, tier);
  wallRim(out, outer, 0, tier);
  wallRim(out, inner, 1, tier);
  walkway(out, outer, inner);
  for (const gate of layout.gates) portal(out, gate, tier);
  mosqueira(out, tier);
  santiagoShrine(out, tier);
  rampartStairs(out, tier);
}
export const buildWallSkyline = (out) => buildWallLevel(out, 'skyline');
export const buildWallDistrict = (out) => buildWallLevel(out, 'district');
export const buildWallStreet = (out) => buildWallLevel(out, 'street');
export const buildWallCloseup = (out) => buildWallLevel(out, 'closeup');

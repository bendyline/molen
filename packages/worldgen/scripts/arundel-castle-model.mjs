/** Current Arundel exterior from attributed map rings, published keep/motte facts and own controls. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/gc/gcp/n0303_arundel_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = frame.controls;
const co = Math.cos(k.planAngleRadians),
  si = Math.sin(k.planAngleRadians);
export const arundelPlanPoint = (x, z) => [x * co - z * si, x * si + z * co];
const local = ([x, z]) => [x * co + z * si, -x * si + z * co];
const native = ([x, y, z]) => {
  const p = arundelPlanPoint(x, z);
  return [p[0], y, p[1]];
};
export const arundelPalette = {
  wall: '#cbc3ad',
  rubble: '#c4bcaa',
  stone: '#ddd2b7',
  roof: '#94a1aa',
  wood: '#998565',
  glass: '#4d6178',
  paving: '#bbb3a2',
  lawn: '#86a36a',
};
export const arundelSurfaces = {
  masonry: { slot: 'wall', graph: 'stone_limestone', roughness: 0.91, metallic: 0 },
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.94, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  slate: { slot: 'roof', graph: 'slate', roughness: 0.85, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
  lawn: { slot: 'wall', roughness: 0.98, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries(arundelPalette).map(([name, hex]) => [
    name,
    hex
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const clean = (p) =>
  Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.002 ? p.slice(0, -1) : p;
const area = (p) =>
  p.reduce((sum, a, i) => {
    const b = p[(i + 1) % p.length];
    return sum + a[0] * b[1] - a[1] * b[0];
  }, 0);
const get = (id) => clean(frame.geometry.rawFeatures.find((w) => w.id === id).points).map(local);
const rect = (x, z, w, h) => [
  [x - w / 2, z - h / 2],
  [x + w / 2, z - h / 2],
  [x + w / 2, z + h / 2],
  [x - w / 2, z + h / 2],
];
const circle = (c, r, n) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
  });
function face(o, p, color = 'wall', slot = 'masonry', target, d = 3) {
  p = p.map((v) => v.map(Math.fround));
  for (let i = 1; i < p.length - 1; i++) {
    const n = normalFor(p[0], p[i], p[i + 1]);
    if (Math.hypot(...n) < 0.5) continue;
    if (target && n.reduce((sum, v, j) => sum + v * target[j], 0) < 0) p = [...p].reverse();
    break;
  }
  const c =
    d === 0 && means[slot] ? colors[color].map((v, i) => v * means[slot][i]) : colors[color];
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[2]]),
      c,
    );
  }
}
function adapter(o) {
  return {
    addTriangle(slot, ref, p, _n, uv, color) {
      const q = p.map(native).map((v) => v.map(Math.fround)),
        n = normalFor(...q);
      const vector = cross(
        q[1].map((v, i) => v - q[0][i]),
        q[2].map((v, i) => v - q[0][i]),
      );
      if (Math.hypot(...vector) < 1e-10) return;
      if (Math.hypot(...n) >= 0.5) o.addTriangle(slot, ref, q, n, uv, color);
    },
  };
}
/** Keep unaffected faces intact; only triangles intersecting the aperture need clipping. */
function cutBuilder(o, holes) {
  const cut = openingBuilder(o, holes);
  return {
    addTriangle(slot, ref, p, n, uv, color) {
      const overlaps = holes.some(
        (h) =>
          !h.planes.some((plane) =>
            p.every((v) => v.reduce((sum, x, i) => sum + x * plane[i], plane[3]) < -1e-7),
          ),
      );
      (overlaps ? cut : o).addTriangle(slot, ref, p, n, uv, color);
    },
  };
}
function cap(o, rings, y, color = 'wall', slot = 'masonry', d = 3) {
  const points = rings.flat(),
    holes = [],
    flat = points.flat();
  let index = rings[0].length;
  for (const p of rings.slice(1)) {
    holes.push(index);
    index += p.length;
  }
  const indices = earcut(flat, holes, 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      o,
      indices
        .slice(i, i + 3)
        .map((j) => [points[j][0], typeof y === 'function' ? y(points[j]) : y, points[j][1]]),
      color,
      slot,
      [0, 1, 0],
      d,
    );
}
function triangles(rings) {
  const p = rings.flat(),
    holes = [];
  let n = rings[0].length;
  for (const q of rings.slice(1)) {
    holes.push(n);
    n += q.length;
  }
  const ix = earcut(p.flat(), holes, 2),
    out = [];
  for (let i = 0; i < ix.length; i += 3) out.push(ix.slice(i, i + 3).map((j) => p[j]));
  return out;
}
function clip(p, fn) {
  if (p.length < 3) return [];
  const out = [];
  let a = p.at(-1),
    av = fn(a);
  for (const b of p) {
    const bv = fn(b);
    if (av >= -1e-7 !== bv >= -1e-7) {
      const t = av / (av - bv);
      out.push(a.map((v, i) => v + (b[i] - v) * t));
    }
    if (bv >= -1e-7) out.push(b);
    a = b;
    av = bv;
  }
  return out;
}
function simplify(p, tolerance) {
  p = clean(p);
  let changed = true;
  while (changed && p.length > 8) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 1e-6) continue;
      const t = ((b[0] - a[0]) * (c[0] - a[0]) + (b[1] - a[1]) * (c[1] - a[1])) / (len * len),
        distance = Math.abs((c[0] - a[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (c[1] - a[1])) / len;
      if (t > 0 && t < 1 && distance < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
function prism(o, p, y0, y1, color = 'wall', slot = 'masonry', d = 3, top = true) {
  const sign = Math.sign(area(p));
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      lo = (v) => (typeof y0 === 'function' ? y0(v) : y0),
      hi = (v) => (typeof y1 === 'function' ? y1(v) : y1);
    face(
      o,
      [
        [a[0], lo(a), a[1]],
        [b[0], lo(b), b[1]],
        [b[0], hi(b), b[1]],
        [a[0], hi(a), a[1]],
      ],
      color,
      slot,
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      d,
    );
  }
  if (top) cap(o, [p], y1, color, slot, d);
}
function wallRing(o, p, y0, y1, color, slot, d, hole = false) {
  const sign = Math.sign(area(p)) * (hole ? -1 : 1);
  for (let i = 0; i < (p.length === 2 ? 1 : p.length); i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      o,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      color,
      slot,
      [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      d,
    );
  }
}
function edgeBox(o, a, b, y, h, width, color, slot, d) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < 0.01) return;
  const n = [((-(b[1] - a[1]) / len) * width) / 2, (((b[0] - a[0]) / len) * width) / 2];
  prism(
    o,
    [
      [a[0] + n[0], a[1] + n[1]],
      [b[0] + n[0], b[1] + n[1]],
      [b[0] - n[0], b[1] - n[1]],
      [a[0] - n[0], a[1] - n[1]],
    ],
    y,
    y + h,
    color,
    slot,
    d,
  );
}
function crenels(
  o,
  p,
  y,
  d,
  {
    hole = false,
    color = 'stone',
    slot = 'stone',
    spacing = 3.2,
    width = 0.75,
    height = 1.15,
  } = {},
) {
  if (d === 0) return;
  const sign = Math.sign(area(p)) * (hole ? -1 : 1);
  for (let i = 0; i < (p.length === 2 ? 1 : p.length); i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < (d === 1 && p.length === 2 ? 5 : 0.8)) continue;
    const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
      n = [sign * u[1], -sign * u[0]];
    if (d !== 1) edgeBox(o, a, b, y, 0.45, width, color, slot, d);
    const count = Math.max(1, Math.round(len / (d === 1 ? spacing * 1.7 : spacing)));
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count,
        c = a.map((v, q) => v + (b[q] - v) * t),
        half = Math.min(0.65, (len / count) * 0.3);
      if (d === 1) {
        const a0 = c.map((v, q) => v - u[q] * half),
          b0 = c.map((v, q) => v + u[q] * half),
          y0 = y;
        for (const side of [-1, 1])
          face(
            o,
            [
              [a0[0] + ((u[1] * width) / 2) * side, y0, a0[1] - ((u[0] * width) / 2) * side],
              [b0[0] + ((u[1] * width) / 2) * side, y0, b0[1] - ((u[0] * width) / 2) * side],
              [
                b0[0] + ((u[1] * width) / 2) * side,
                y0 + height,
                b0[1] - ((u[0] * width) / 2) * side,
              ],
              [
                a0[0] + ((u[1] * width) / 2) * side,
                y0 + height,
                a0[1] - ((u[0] * width) / 2) * side,
              ],
            ],
            color,
            slot,
            [u[1] * side, 0, -u[0] * side],
            d,
          );
        face(
          o,
          [
            [a0[0] + (u[1] * width) / 2, y0 + height, a0[1] - (u[0] * width) / 2],
            [b0[0] + (u[1] * width) / 2, y0 + height, b0[1] - (u[0] * width) / 2],
            [b0[0] - (u[1] * width) / 2, y0 + height, b0[1] + (u[0] * width) / 2],
            [a0[0] - (u[1] * width) / 2, y0 + height, a0[1] + (u[0] * width) / 2],
          ],
          color,
          slot,
          [0, 1, 0],
          d,
        );
        continue;
      }
      edgeBox(
        o,
        c.map((v, q) => v - u[q] * half + n[q] * 0.05),
        c.map((v, q) => v + u[q] * half + n[q] * 0.05),
        y + 0.4,
        height,
        width,
        color,
        slot,
        d,
      );
    }
  }
}
function panel(o, a, b, t, bottom, width, height, d, { pointed = false } = {}) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [u[1], -u[0]],
    c = a.map((v, i) => v + (b[i] - v) * t + n[i] * 0.035),
    w = width / 2;
  const shape = pointed
    ? [
        [-w, bottom],
        [w, bottom],
        [w, bottom + height * 0.7],
        [0, bottom + height],
        [-w, bottom + height * 0.7],
      ]
    : [
        [-w, bottom],
        [w, bottom],
        [w, bottom + height],
        [-w, bottom + height],
      ];
  face(
    o,
    shape.map(([x, y]) => [c[0] + u[0] * x, y, c[1] + u[1] * x]),
    'glass',
    'glass',
    [n[0], 0, n[1]],
    d,
  );
  if (d >= 2) {
    edgeBox(
      o,
      c.map((v, i) => v - u[i] * (w + 0.13)),
      c.map((v, i) => v + u[i] * (w + 0.13)),
      bottom - 0.25,
      0.24,
      0.3,
      'stone',
      'stone',
      d,
    );
    if (width > 2.3)
      edgeBox(
        o,
        c.map((v, i) => v - u[i] * 0.1),
        c.map((v, i) => v + u[i] * 0.1),
        bottom,
        height - 0.25,
        0.19,
        'stone',
        'stone',
        d,
      );
  }
}
function ringWindows(o, p, y0, h, d, { hole = false, spacing = 5.7, pointed = false } = {}) {
  if (d === 0) return;
  if (Math.sign(area(p)) * (hole ? -1 : 1) < 0) p = [...p].reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 4.5) continue;
    const count = Math.max(1, Math.round(len / (d === 1 ? spacing * 1.8 : spacing)));
    for (let j = 0; j < count; j++)
      for (const y of d === 1 ? [y0 + h * 0.48] : [y0 + 3.2, y0 + 8.2, y0 + 12.8])
        if (y + 2.9 < y0 + h) panel(o, a, b, (j + 0.5) / count, y, 1.35, 2.5, d, { pointed });
  }
}
function mainRings(d) {
  const tol = d === 0 ? 2.7 : d === 1 ? 1.6 : 0;
  return [71729743, 173875638, 71729745].map((id) => {
    const p = get(id);
    return tol ? simplify(p, tol) : p;
  });
}
function gateOpenings(d) {
  const p = get(k.innerGate.routeWay);
  return p.slice(0, -1).map((a, i) => {
    const b = p[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return prepareOpening(
      {
        center: a.map((v, i) => (v + b[i]) / 2),
        axis: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
        width: k.innerGate.width,
        height: k.innerGate.height,
        spring: k.innerGate.height - k.innerGate.width / 2,
        depth: len + 6,
        bottom: 0,
        shape: 'round',
      },
      0,
      d,
    );
  });
}
/** Reveals on overlapping corridor sections must not become an interior barrier. */
function corridorReveals(o, p, top, holes) {
  for (const h of holes)
    openingReveals(
      cutBuilder(
        o,
        holes.filter((other) => other !== h),
      ),
      p,
      () => 0,
      () => top,
      [h],
      colors.rubble,
    );
}
function complex(o, d) {
  const rings = mainRings(d),
    holes = d ? gateOpenings(d) : [],
    cut = holes.length ? cutBuilder(o, holes) : o;
  for (let ri = 0; ri < rings.length; ri++) {
    const p = rings[ri],
      sign = Math.sign(area(p)) * (ri ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const a = p[i],
        b = p[(i + 1) % p.length],
        ts = [0, 1];
      if ((a[0] - k.residence.splitX) * (b[0] - k.residence.splitX) < 0)
        ts.splice(1, 0, (k.residence.splitX - a[0]) / (b[0] - a[0]));
      for (let j = 0; j < ts.length - 1; j++) {
        const q = ts.slice(j, j + 2).map((t) => a.map((v, n) => v + (b[n] - v) * t)),
          mid = (q[0][0] + q[1][0]) / 2,
          top = mid >= k.residence.splitX ? k.residence.eaveY : k.curtain.height;
        face(
          cut,
          [
            [q[0][0], 0, q[0][1]],
            [q[1][0], 0, q[1][1]],
            [q[1][0], top, q[1][1]],
            [q[0][0], top, q[0][1]],
          ],
          mid >= 5 ? 'wall' : 'rubble',
          mid >= 5 ? 'masonry' : 'rubble',
          [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
          d,
        );
        if (!ri && mid < -30)
          crenels(cut, q, top, d, { color: 'rubble', slot: 'rubble', spacing: 4.7 });
      }
    }
  }
  for (const t of triangles(rings))
    for (const east of [false, true]) {
      const p = clip(t, (v) => (east ? v[0] - 5 : 5 - v[0]));
      if (p.length < 3) continue;
      cap(cut, [p], east ? 17 : 7, east ? 'wall' : 'rubble', east ? 'masonry' : 'rubble', d);
      if (east)
        for (let i = 0; i < p.length; i++) {
          const a = p[i],
            b = p[(i + 1) % p.length];
          if (Math.abs(a[0] - 5) < 1e-5 && Math.abs(b[0] - 5) < 1e-5)
            face(
              cut,
              [
                [5, 7, a[1]],
                [5, 7, b[1]],
                [5, 17, b[1]],
                [5, 17, a[1]],
              ],
              'wall',
              'masonry',
              [-1, 0, 0],
              d,
            );
        }
    }
  if (holes.length)
    for (const triangle of triangles(rings)) {
      const part = clip(triangle, (v) => v[0] - 5);
      if (part.length >= 3) corridorReveals(o, part, 17, holes);
    }
}
function roofPatch(o, p, planes, d) {
  for (const fn of planes) {
    let q = p;
    for (const other of planes) {
      q = clip(q, (v) => other(v) - fn(v));
      if (q.length < 3) break;
    }
    if (q.length < 3) continue;
    const pieces = [clip(q, (v) => fn(v)), clip(q, (v) => -fn(v))];
    for (let i = 0; i < pieces.length; i++) {
      const a = pieces[i];
      if (a.length < 3) continue;
      const height = (v) => 17 + (i ? 0 : Math.max(0, fn(v)));
      cap(o, [a], height, 'roof', 'slate', d);
      for (let j = 0; j < a.length; j++) {
        const v = a[j],
          w = a[(j + 1) % a.length];
        if (Math.abs(v[0] - 107) < 1e-6 && Math.abs(w[0] - 107) < 1e-6)
          face(
            o,
            [
              [v[0], 17, v[1]],
              [w[0], 17, w[1]],
              [w[0], height(w), w[1]],
              [v[0], height(v), v[1]],
            ],
            'roof',
            'slate',
            [1, 0, 0],
            d,
          );
      }
    }
  }
}
function residence(o, d) {
  const rings = mainRings(d),
    cut = d ? cutBuilder(o, gateOpenings(d)) : o;
  for (const t of triangles(rings)) {
    const east = clip(t, (v) => v[0] - 5);
    if (east.length < 3) continue;
    const end = clip(east, (v) => v[0] - 107);
    if (end.length >= 3)
      roofPatch(cut, end, [(v) => (v[0] - 107) * 0.4, (v) => (143 - v[0]) * 0.4, () => 5.5], d);
    const middle = clip(east, (v) => 107 - v[0]);
    if (middle.length < 3) continue;
    const north = clip(middle, (v) => 8 - v[1]);
    if (north.length >= 3) roofPatch(cut, north, [() => 1], d);
    const south = clip(middle, (v) => v[1] - 8);
    if (south.length >= 3)
      roofPatch(cut, south, [(v) => (v[1] - 8) * 0.8, (v) => (42 - v[1]) * 0.7, () => 7.5], d);
  }
  // Seal actual roof boundaries without sides between every cap triangle.
  const height = ([x, z]) =>
    x >= 107
      ? 17 + Math.max(0, Math.min((x - 107) * 0.4, (143 - x) * 0.4, 5.5))
      : z <= 8
        ? 18
        : 17 + Math.max(0, Math.min((z - 8) * 0.8, (42 - z) * 0.7, 7.5));
  for (let ri = 0; ri < 2; ri++)
    for (let j = 0; j < rings[ri].length; j++) {
      const a = rings[ri][j],
        b = rings[ri][(j + 1) % rings[ri].length],
        times = [0, 1];
      for (const [axis, value] of [
        [0, 5],
        [0, 107],
        [0, 120.75],
        [0, 129.25],
        [1, 8],
        [1, 17.375],
        [1, 31.2857142857],
        [1, 42],
      ])
        if ((a[axis] - value) * (b[axis] - value) < 0)
          times.push((value - a[axis]) / (b[axis] - a[axis]));
      times.sort((a, b) => a - b);
      for (let l = 0; l < times.length - 1; l++) {
        const q = times.slice(l, l + 2).map((t) => a.map((v, i) => v + (b[i] - v) * t));
        if ((q[0][0] + q[1][0]) / 2 < 5) continue;
        const sign = Math.sign(area(rings[ri])) * (ri ? -1 : 1);
        face(
          cut,
          [
            [q[0][0], 17, q[0][1]],
            [q[1][0], 17, q[1][1]],
            [q[1][0], height(q[1]), q[1][1]],
            [q[0][0], height(q[0]), q[0][1]],
          ],
          'wall',
          'masonry',
          [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
          d,
        );
      }
    }
  if (d === 0) return;
  for (let ri = 0; ri < 2; ri++) {
    const p = rings[ri];
    for (let i = 0; i < p.length; i++) {
      let a = p[i],
        b = p[(i + 1) % p.length];
      if (a[0] < 10 && b[0] < 10) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 4.6) continue;
      if (ri) [a, b] = [b, a];
      const bays = Math.max(1, Math.round(len / (d === 1 ? 10 : 5.8)));
      for (let j = 0; j < bays; j++)
        for (const y of d === 1 ? [8] : [3.2, 8.2, 12.8])
          panel(o, a, b, (j + 0.5) / bays, y, 1.3, 2.5, d, { pointed: true });
      if (!ri) {
        crenels(o, [a, b], 17, d, { spacing: 4.3, height: 1.1 });
        if (d >= 3 && len > 9)
          for (let j = 0; j < bays; j++) {
            const t = (j + 0.08) / bays,
              c = a.map((v, n) => v + (b[n] - v) * t),
              u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
              n = [u[1], -u[0]];
            prism(
              o,
              [
                c.map((v, q) => v - u[q] * 0.35),
                c.map((v, q) => v + u[q] * 0.35),
                c.map((v, q) => v + u[q] * 0.35 + n[q] * 0.85),
                c.map((v, q) => v - u[q] * 0.35 + n[q] * 0.85),
              ],
              0,
              14,
              'stone',
              'stone',
              d,
            );
          }
      }
    }
  }
  if (d >= 2)
    for (const [x, z, h] of [
      [12, -38, 24],
      [39, -38, 26],
      [67, -38, 24],
      [94, -40, 23],
      [134, -35, 28],
      [134, -7, 29],
      [98, 21, 31],
      [55, 26, 30],
    ])
      prism(o, rect(x, z, 1.2, 1.7), 17, h, 'stone', 'stone', d);
  // Paired long Gothic lights on the south cross-gable are the large-scale chapel identity.
  if (d >= 1) {
    const a = [49, 27.1],
      b = [70, 27.1];
    for (const t of [0.43, 0.57]) panel(o, a, b, t, 5.5, 2.0, 12, d, { pointed: true });
  }
}
function motte(o, d) {
  const n = d === 0 ? 12 : d === 1 ? 20 : 32,
    c = k.motte.center,
    levels = [
      [k.motte.baseRadius, 0],
      [28, 8],
      [k.motte.topRadius, k.motte.height],
    ];
  for (let j = 0; j < levels.length - 1; j++) {
    const lower = circle(c, levels[j][0], n),
      upper = circle(c, levels[j + 1][0], n);
    for (let i = 0; i < n; i++) {
      const next = (i + 1) % n;
      face(
        o,
        [
          [lower[i][0], levels[j][1], lower[i][1]],
          [lower[next][0], levels[j][1], lower[next][1]],
          [upper[next][0], levels[j + 1][1], upper[next][1]],
          [upper[i][0], levels[j + 1][1], upper[i][1]],
        ],
        'lawn',
        'lawn',
        [lower[i][0] - c[0], 0.4, lower[i][1] - c[1]],
        d,
      );
    }
  }
  cap(o, [circle(c, k.motte.topRadius, n)], 20, 'lawn', 'lawn', d);
}
function keep(o, d) {
  const outer = d === 0 ? simplify(get(k.keep.way), 1.8) : get(k.keep.way),
    inner = d === 0 ? simplify(get(k.keep.courtWay), 0.8) : get(k.keep.courtWay),
    top = k.keep.baseY + k.keep.height;
  wallRing(o, outer, 20, top, 'rubble', 'rubble', d);
  wallRing(o, inner, 20, top, 'rubble', 'rubble', d, true);
  cap(o, [outer, inner], top, 'stone', 'stone', d);
  crenels(o, outer, top, d, {
    spacing: 2.8,
    color: 'rubble',
    slot: 'rubble',
    width: 0.7,
    height: 1.1,
  });
  if (d >= 1) {
    ringWindows(o, outer, 20, 9, d, { spacing: 6 });
    // Attached well/stair mass reaches into the hollow keep; original photographic estimate.
    const annex = rect(-16.5, -8.1, 6.5, 5.2);
    prism(o, annex, 20, 32.5, 'rubble', 'rubble', d);
    crenels(o, annex, 32.5, d, { spacing: 3.2, color: 'rubble', slot: 'rubble' });
  }
}
function towers(o, d) {
  const selected = d <= 1 ? k.towers.filter((_, i) => [0, 1, 4, 5, 6].includes(i)) : k.towers;
  for (const tower of selected) {
    const n = d === 0 ? 6 : d === 1 ? 8 : 20,
      p =
        tower.kind === 'square'
          ? rect(...tower.center, tower.radius * 2, tower.radius * 2)
          : circle(tower.center, tower.radius, n);
    prism(o, p, 0, tower.height, 'wall', 'masonry', d);
    const crown = tower.corbel ? circle(tower.center, tower.radius * 1.1, n) : p;
    if (tower.corbel) {
      const low = circle(tower.center, tower.radius, n);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        face(
          o,
          [
            [low[i][0], tower.height - 2.7, low[i][1]],
            [low[j][0], tower.height - 2.7, low[j][1]],
            [crown[j][0], tower.height - 1.1, crown[j][1]],
            [crown[i][0], tower.height - 1.1, crown[i][1]],
          ],
          'stone',
          'stone',
          undefined,
          d,
        );
      }
      prism(o, crown, tower.height - 1.1, tower.height + 0.6, 'wall', 'masonry', d);
    }
    crenels(o, crown, tower.height + 0.6, d, { spacing: 3.5 });
    ringWindows(o, p, 0, tower.height, d, { spacing: 7.5 });
    if (d >= 2 && tower.corbel)
      for (let i = 0; i < n; i += 2) {
        const a = (i * Math.PI * 2) / n,
          c = [
            tower.center[0] + tower.radius * Math.cos(a),
            tower.center[1] + tower.radius * Math.sin(a),
          ];
        prism(o, rect(...c, 0.7, 0.7), tower.height - 3.4, tower.height - 1, 'stone', 'stone', d);
      }
  }
}
function gates(o, d) {
  const b = k.barbican,
    p = rect(...b.center, b.width, b.depth),
    aperture = d
      ? prepareOpening(
          {
            center: b.center,
            axis: [1, 0],
            width: 2.7,
            height: 4.2,
            spring: 2.85,
            depth: 16,
            bottom: 0,
            shape: 'round',
          },
          0,
          d,
        )
      : null,
    barbicanOut = aperture ? cutBuilder(o, [aperture]) : o;
  prism(barbicanOut, p, 0, b.height, 'rubble', 'rubble', d);
  crenels(barbicanOut, p, b.height, d, { color: 'rubble', slot: 'rubble' });
  if (aperture)
    openingReveals(
      o,
      p,
      () => 0,
      () => b.height,
      [aperture],
      colors.rubble,
    );
  if (d >= 1)
    for (const [x, z] of [
      [b.center[0] - 3, b.center[1] + 2],
      [b.center[0] + 3, b.center[1] + 2],
    ]) {
      const q = circle([x, z], 1.8, d === 1 ? 8 : 12);
      prism(o, q, 0, b.height + 2, 'rubble', 'rubble', d);
      crenels(o, q, b.height + 2, d, { color: 'rubble', slot: 'rubble' });
    }
  const p0 = get(k.innerGate.routeWay),
    a = p0[0],
    b0 = p0.at(-1),
    len = Math.hypot(b0[0] - a[0], b0[1] - a[1]),
    u = [(b0[0] - a[0]) / len, (b0[1] - a[1]) / len],
    n = [-u[1], u[0]],
    center = k.innerGate.center;
  const gate = [
      [-5.6, -6],
      [5.6, -6],
      [5.6, 6],
      [-5.6, 6],
    ].map(([x, z]) => [center[0] + n[0] * x + u[0] * z, center[1] + n[1] * x + u[1] * z]),
    holes = d ? gateOpenings(d) : [],
    cut = holes.length ? cutBuilder(o, holes) : o;
  prism(cut, gate, 0, k.innerGate.topY, 'rubble', 'rubble', d);
  crenels(cut, gate, k.innerGate.topY, d, { color: 'rubble', slot: 'rubble' });
  if (holes.length) corridorReveals(o, gate, k.innerGate.topY, holes);
  const bridge = get(896541324);
  if (d >= 1) {
    edgeBox(o, bridge[0], bridge.at(-1), 0.2, 0.4, 3.9, 'wood', 'wood', d);
    for (const side of [-1, 1]) {
      const q = bridge.map((v) => [v[0] + side * 1.8, v[1]]);
      edgeBox(o, q[0], q.at(-1), 0.6, 1.1, 0.25, 'wood', 'wood', d);
    }
  }
}
function courtyard(o, d) {
  if (d === 0) return;
  cap(o, [mainRings(d)[1]], 0.015, 'lawn', 'lawn', d);
  const c = [73, -6],
    n = d === 1 ? 16 : 28;
  const oval = (rx, rz) => circle([0, 0], 1, n).map((p) => [c[0] + p[0] * rx, c[1] + p[1] * rz]);
  cap(o, [oval(31, 15.5), oval(27.5, 12)], 0.04, 'paving', 'paving', d);
  cap(o, [oval(27.5, 12)], 0.06, 'lawn', 'lawn', d);
  const outer = circle(c, 3.1, d === 1 ? 10 : 16),
    inner = circle(c, 2.5, d === 1 ? 10 : 16);
  wallRing(o, outer, 0.06, 0.65, 'stone', 'stone', d);
  wallRing(o, inner, 0.06, 0.65, 'stone', 'stone', d, true);
  cap(o, [outer, inner], 0.65, 'stone', 'stone', d);
  cap(o, [inner], 0.3, 'glass', 'glass', d);
}
const builders = { complex, residence, motte, keep, towers, gates, courtyard };
export const arundelParts = Object.fromEntries(
  Object.entries(builders).map(([name, fn]) => [name, (o, d) => fn(adapter(o), d)]),
);
export function buildArundelRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const fn of Object.values(arundelParts)) fn(o, d);
}
export const buildArundelSkyline = (o) => buildArundelRuntime(o, 'skyline');
const camera = (name, position, lookAt) => ({
  name,
  position: native(position),
  lookAt: native(lookAt),
});
export const arundelStudy = {
  id: 'N0303',
  key: 'arundel_castle',
  title: 'Arundel Castle',
  category: 'castle',
  wikidataId: 'Q716667',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildArundelRuntime(o),
  surfaceOverrides: arundelSurfaces,
  brief:
    'Current Arundel Castle exterior: hollow Norman shell keep on its artificial motte, medieval northern curtain and gate defenses, open residential quadrangle with Gothic window rhythm, corbelled round towers, slate pitched roofs and chimneys.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: arundelPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 8,
    identityFeatures: [
      'Hollow oval Norman shell keep on a twenty-metre artificial motte',
      'Medieval gatehouse, barbican and northern curtain enclosure',
      'Open residential quadrangle, tall corbelled round towers and Gothic south roof massing',
    ],
  },
  sourceFacts: {
    exactCastleRelation: 1118816,
    currentKeepPartWay: 1421681564,
    publishedDimensions: refs.publishedDimensions,
  },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json', 'surface-means.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; own map traces © OpenStreetMap contributors, ODbL-1.0. Historic England numerical facts attributed; photographic references not redistributed.',
  sourceNotice:
    'Six existing shared 256-square stone, slate, timber and gravel graphs; flat glass and earthwork lawn. Metric repeats and linear tints. No embedded/new image, downloaded mesh or photo texture.',
  dataAttribution:
    '© OpenStreetMap contributors; Historic England; Arundel Castle Trustees; VisitEngland.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus:
      'Inactive draft: photographic sections and bailey/natural escarpment attachment require actual-site review.',
  }),
  geographicNote:
    'Exact-QID map rings and separately mapped keep/tunnel remain attributed in native East/South heading 0. Published motte/keep dimensions guide a provisional base; actual site elevation and facade fit remain pending.',
  limitations: refs.limitations,
  importReason:
    'Keep the current open keep/courtyard, motte and medieval/residential identities through four source-authored browser levels.',
  previewGround: false,
  mediumFiContext: { scale: '1.35', neighborStyle: 'molen.worldgen.regional.atlantic.detached' },
  camera: { position: native([-210, 155, 215]), lookAt: native([0, 12, 0]), fov: 43 },
  qaCameras: [
    camera('keep-and-motte', [-78, 53, 61], [-16, 21, 2]),
    camera('residential-quadrangle', [40, 67, -2], [100, 13, -1]),
    camera('south-towers-and-roof', [95, 46, 113], [91, 17, 15]),
    camera('inner-gate-passage', [2, 4.4, 67], [32, 3, 26]),
    camera('roof-plan', [4, 312, 6], [4, 0, 6]),
    camera('northern-bailey', [-210, 61, -14], [-86, 9, -12]),
  ],
};

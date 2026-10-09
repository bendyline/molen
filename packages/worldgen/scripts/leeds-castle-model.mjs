/** Current Leeds Castle architecture from attributed component traces and original photographic sections. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const root = new URL(
  '../../../content/worldgen/source/places/u1/u10/n0304_leeds_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, root)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  means = read('surface-means.json'),
  k = frame.controls;
const co = Math.cos(k.planAngleRadians),
  si = Math.sin(k.planAngleRadians);
export const leedsPlanPoint = (x, z) => [x * co - z * si, x * si + z * co];
const local = ([x, z]) => [x * co + z * si, -x * si + z * co];
const native = ([x, y, z]) => {
  const p = leedsPlanPoint(x, z);
  return [p[0], y, p[1]];
};
export const leedsPalette = {
  wall: '#d3d5cc',
  stone: '#e0d9bd',
  roof: '#736256',
  wood: '#998565',
  glass: '#4d6178',
  paving: '#bbb3a2',
  lawn: '#86a36a',
};
export const leedsSurfaces = {
  masonry: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.96, metallic: 0 },
  stone: { slot: 'trim', graph: 'stone_limestone_raw', roughness: 0.91, metallic: 0 },
  tile: { slot: 'roof', graph: 'tile_flat', roughness: 0.85, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_plain', roughness: 0.82, metallic: 0 },
  paving: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  glass: { slot: 'window', roughness: 0.2, metallic: 0.28 },
  lawn: { slot: 'wall', roughness: 0.98, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries(leedsPalette).map(([name, hex]) => [
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
const select = (indices) => indices.map((index) => get(120567637)[index]);
const rings = (d, kind) => {
  const p = select(k[kind].outerIndices),
    tol = d === 0 ? 0.75 : d === 1 ? 0.3 : 0;
  return [tol ? simplify(p, tol) : p, ...(kind === 'gloriette' ? [get(k.gloriette.courtWay)] : [])];
};
function apertures(o, p, lo, hi, holes, d, color = 'wall', slot = 'masonry', top = true) {
  const cut = holes.length ? cutBuilder(o, holes) : o;
  prism(cut, p, lo, hi, color, slot, d, top);
  const reveals = {
    addTriangle(_s, r, q, n, uv, c) {
      o.addTriangle(slot, r, q, n, uv, c);
    },
  };
  for (const h of holes)
    openingReveals(
      cutBuilder(
        reveals,
        holes.filter((other) => other !== h),
      ),
      p,
      () => lo,
      () => hi,
      [h],
      colors[color],
    );
  return cut;
}
function ringMass(o, p, y0, y1, d) {
  for (let i = 0; i < p.length; i++) wallRing(o, p[i], y0, y1, 'wall', 'masonry', d, i > 0);
}
/** Clip roof triangles at its ridge lines, retaining the actual mapped court void. */
function roof(o, p, base, rise, d, { hipBox } = {}) {
  if (d === 0) {
    // Low tiled pitches behind the battlements collapse to a mean-colored distant cap.
    cap(o, p, base + rise * 0.3, 'roof', 'tile', d);
    return;
  }
  if (!hipBox) {
    // The Gloriette's shallow tiled roof stays below its historic battlements.
    cap(o, p, base, 'roof', 'tile', d);
    return;
  }
  const [xmin, zmin, xmax, zmax] = hipBox,
    run = 4.2;
  const high = (q) =>
    base +
    rise *
      Math.max(
        0,
        Math.min(
          1,
          (q[0] - xmin) / run,
          (xmax - q[0]) / run,
          (q[1] - zmin) / run,
          (zmax - q[1]) / run,
        ),
      );
  const xs = [xmin - 8, xmin + run, xmax - run, xmax + 8],
    zs = [zmin - 8, zmin + run, zmax - run, zmax + 8];
  for (const t of triangles(p))
    for (let i = 0; i < xs.length - 1; i++)
      for (let j = 0; j < zs.length - 1; j++) {
        let q = clip(t, (v) => v[0] - xs[i]);
        q = clip(q, (v) => xs[i + 1] - v[0]);
        q = clip(q, (v) => v[1] - zs[j]);
        q = clip(q, (v) => zs[j + 1] - v[1]);
        if (q.length >= 3) cap(o, [q], high, 'roof', 'tile', d);
      }
  for (const q of p) wallRing(o, q, base - 0.2, base, 'roof', 'tile', d, p.indexOf(q) > 0);
}
function band(o, p, y, d) {
  if (d < 2) return;
  for (let i = 0; i < p.length; i++)
    edgeBox(o, p[i], p[(i + 1) % p.length], y, 0.26, 0.24, 'stone', 'stone', d);
}
function windows(
  o,
  p,
  ys,
  d,
  { hole = false, spacing = 5.2, width = 1.65, height = 2.7, mullions = false } = {},
) {
  if (!d) return;
  if (Math.sign(area(p)) * (hole ? -1 : 1) < 0) p = [...p].reverse();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 3.6) continue;
    const count = Math.max(1, Math.round(len / (d === 1 ? spacing * 1.7 : spacing)));
    for (let j = 0; j < count; j++)
      for (const y of d === 1 ? [ys.at(-1)] : ys) {
        const t = (j + 0.5) / count;
        panel(o, a, b, t, y, Math.min(width, (len / count) * 0.63), height, d);
        if (d >= 2 && mullions) {
          const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
            n = [u[1], -u[0]],
            c = a.map((v, h) => v + (b[h] - v) * t + n[h] * 0.07);
          const w = Math.min(width, (len / count) * 0.63);
          edgeBox(
            o,
            c.map((v, h) => v - (u[h] * w) / 2),
            c.map((v, h) => v + (u[h] * w) / 2),
            y + height * 0.49,
            0.13,
            0.16,
            'stone',
            'stone',
            d,
          );
          for (const f of w > 3 ? [-0.22, 0.22] : [0]) {
            const mid = c.map((v, h) => v + u[h] * w * f);
            edgeBox(
              o,
              mid.map((v, h) => v - u[h] * 0.075),
              mid.map((v, h) => v + u[h] * 0.075),
              y,
              height,
              0.15,
              'stone',
              'stone',
              d,
            );
          }
        }
      }
  }
}
function newCastle(o, d) {
  const p = rings(d, 'newCastle'),
    c = k.newCastle;
  ringMass(o, p, 0, c.wallTopY, d);
  roof(o, p, c.roofBaseY, c.roofRise, d, { hipBox: [20, -24, 48, 20] });
  crenels(o, p[0], c.wallTopY, d, { spacing: 2.7, height: 1.05, width: 0.7 });
  band(o, p[0], 5.1, d);
  band(o, p[0], 9.65, d);
  windows(o, p[0], [5.4, 10.1], d, { spacing: 5.3, width: 2.6, height: 2.9, mullions: true });
  const gate = rect(...c.gateCenter, ...c.gateSize);
  const opening = d
    ? prepareOpening(
        {
          center: c.gateCenter,
          axis: [0, 1],
          width: 2.6,
          height: 3.7,
          spring: 2.4,
          depth: 12,
          bottom: k.baileyFloorY,
          shape: 'round',
        },
        0,
        d,
      )
    : null;
  // The raised gateway has an entry recess with a closed timber door behind it.
  if (opening) {
    apertures(o, gate, 0, c.gateTopY, [opening], d);
  } else prism(o, gate, 0, c.gateTopY, 'wall', 'masonry', d);
  crenels(o, gate, c.gateTopY, d, { spacing: 2.8, height: 1.05 });
  windows(o, gate, [10.2, 15.25], d, { spacing: 6.0, width: 2.4, height: 2.5, mullions: true });
  if (d > 0)
    face(
      o,
      [
        [15.86, 4.4, -2.0],
        [15.86, 4.4, 0.6],
        [15.86, 6.8, 0.6],
        [15.86, 8.0, -0.7],
        [15.86, 6.8, -2.0],
      ],
      'wood',
      'wood',
      [-1, 0, 0],
      d,
    );
  for (const t of k.turrets.slice(0, d === 0 ? 4 : 6)) {
    const q = circle(t.center, t.radius, 8);
    prism(o, q, 0, t.height, 'wall', 'masonry', d);
    crenels(o, q, t.height, d, { spacing: 2.2, height: 0.75, width: 0.55 });
  }
  if (d >= 2)
    for (const [x, z] of [
      [28, -15],
      [38, 13],
      [33, 0],
    ]) {
      prism(o, rect(x, z, 1.3, 2.2), 14.4, 18.1, 'wall', 'masonry', d);
      if (d === 3) prism(o, rect(x, z, 1.6, 2.5), 17.8, 18.2, 'stone', 'stone', d);
    }
}
function gloriette(o, d) {
  const p = rings(d, 'gloriette'),
    g = k.gloriette;
  ringMass(o, p, 0, g.wallTopY, d);
  roof(o, p, g.roofBaseY, g.roofRise, d);
  crenels(o, p[0], g.wallTopY, d, { spacing: 2.7, height: 1.0 });
  if (d >= 2)
    crenels(o, p[1], g.wallTopY, d, { hole: true, spacing: 3.1, height: 0.8, width: 0.55 });
  windows(o, p[0], [4.9, 9.8], d, { spacing: 4.8, width: 1.8, height: 2.65, mullions: true });
  windows(o, p[1], [5.0, 10.0], d, { hole: true, spacing: 4.5, width: 1.2, height: 2.5 });
  band(o, p[0], 4.6, d);
  band(o, p[0], 9.25, d);
  const bell = rect(...g.bellCenter, ...g.bellSize);
  prism(o, bell, 0, g.bellTopY, 'wall', 'masonry', d);
  crenels(o, bell, g.bellTopY, d, { spacing: 2.6, height: 0.8 });
  windows(o, bell, [14.9], d, { spacing: 5, width: 1.5, height: 2.35 });
  if (d >= 2)
    for (const [x, z] of g.chimneyCenters)
      prism(o, rect(x, z, 1.1, 1.6), g.roofBaseY, 17.4, 'wall', 'masonry', d);
  cap(o, [p[1]], k.baileyFloorY + 0.02, 'lawn', 'lawn', d);
}
function bridgeHoles(d) {
  const b = k.coveredBridge;
  return b.archCenters.map((center) =>
    prepareOpening(
      {
        center,
        axis: b.archAxis,
        width: b.archWidth,
        height: b.archHeight,
        spring: b.archSpring,
        depth: b.depth,
        bottom: b.archBottomY,
        shape: 'pointed',
      },
      0,
      d,
    ),
  );
}
function coveredBridge(o, d) {
  const p = select(k.coveredBridge.outerIndices),
    b = k.coveredBridge;
  apertures(o, p, 0, b.wallTopY, bridgeHoles(d), d);
  cap(o, [p], b.wallTopY + 0.01, 'roof', 'tile', d);
  crenels(o, p, b.wallTopY, d, { spacing: 2.8, height: 0.95 });
  windows(o, p, [5.5, 10.1], d, { spacing: 4.0, width: 1.6, height: 2.4, mullions: true });
}
function bathHoles(d) {
  const b = k.watergate;
  return b.archCenters.map((center) =>
    prepareOpening(
      {
        center,
        axis: b.archAxis,
        width: b.archWidth,
        height: b.archHeight,
        spring: b.archSpring,
        depth: b.depth,
        bottom: b.bottomY,
        shape: 'pointed',
      },
      0,
      d,
    ),
  );
}
function maiden(o, d) {
  const p = get(k.maiden.way),
    m = k.maiden;
  apertures(o, get(k.watergate.retainingWay), 0, k.baileyFloorY, d ? bathHoles(d) : [], d);
  prism(o, p, k.baileyFloorY, m.wallTopY, 'wall', 'masonry', d, false);
  const min = [0, 1].map((i) => Math.min(...p.map((v) => v[i]))),
    max = [0, 1].map((i) => Math.max(...p.map((v) => v[i])));
  roof(o, [p], m.roofBaseY, m.roofRise, d, { hipBox: [...min, ...max] });
  crenels(o, p, m.wallTopY, d, { spacing: 2.6, height: 1.0 });
  windows(o, p, [5.3, 9.15], d, { spacing: 4.3, width: 1.7, height: 2.3, mullions: true });
  band(o, p, 8.5, d);
}
function gateHoles(d) {
  const p = get(k.gatehouse.routeWay);
  return p.slice(0, -1).map((a, i) => {
    const b = p[i + 1],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return prepareOpening(
      {
        center: a.map((v, j) => (v + b[j]) / 2),
        axis: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len],
        width: k.gatehouse.passageWidth,
        height: k.gatehouse.passageHeight,
        spring: 3.5,
        depth: len + 4,
        bottom: k.baileyFloorY,
        shape: 'pointed',
      },
      0,
      d,
    );
  });
}
function gatehouse(o, d) {
  const g = k.gatehouse,
    p = get(g.way),
    holes = d ? gateHoles(d) : [];
  apertures(o, get(g.retainingWay), 0, k.baileyFloorY, holes, d);
  const out = apertures(o, p, k.baileyFloorY, g.wallTopY, holes, d, 'wall', 'masonry', false);
  const roofP = [p.slice(0, 4).concat(p.slice(8, 10)), p.slice(3, 9)];
  for (const q of roofP) {
    const center = q.reduce((c, v) => c.map((n, i) => n + v[i] / q.length), [0, 0]);
    for (let i = 0; i < q.length; i++)
      face(
        out,
        [
          [q[i][0], g.roofBaseY, q[i][1]],
          [q[(i + 1) % q.length][0], g.roofBaseY, q[(i + 1) % q.length][1]],
          [center[0], g.roofBaseY + g.roofRise, center[1]],
        ],
        'roof',
        'tile',
        [0, 1, 0],
        d,
      );
  }
  windows(out, p, [6.0], d, { spacing: 4.5, width: 1.3, height: 2.5 });
  const gate = rect(-83, -24, 9.8, 8.0);
  apertures(o, gate, k.baileyFloorY, 12.1, holes, d);
  crenels(out, gate, 12.1, d, { spacing: 2.6, height: 0.95 });
}
function foundation(o, d) {
  const raw = get(k.foundation.way),
    p = d === 0 ? simplify(raw, 1.5) : d === 1 ? simplify(raw, 0.6) : raw;
  // Split the entire island mass, including vertical walls, at the bridge's water channel.
  // Clipping only the top left an unsupported foundation wall across the channel.
  const islands = [
    clip(p, (v) => k.foundation.bridgeGapX[0] - v[0]),
    clip(p, (v) => v[0] - k.foundation.bridgeGapX[1]),
  ];
  const out = cutBuilder(o, [...bridgeHoles(d), ...(d ? bathHoles(d) : [])]);
  for (const island of islands) {
    cap(o, [island], k.foundation.topY, 'lawn', 'lawn', d);
    prism(out, island, 0, k.foundation.topY, 'wall', 'masonry', d, false);
  }
  if (d > 0) {
    const path = get(4301354);
    const offsets = path.map((b, i) => {
      const a = path[(i + path.length - 1) % path.length],
        c = path[(i + 1) % path.length],
        previous = Math.hypot(b[0] - a[0], b[1] - a[1]),
        next = Math.hypot(c[0] - b[0], c[1] - b[1]),
        n0 = [(b[1] - a[1]) / previous, -(b[0] - a[0]) / previous],
        n1 = [(c[1] - b[1]) / next, -(c[0] - b[0]) / next],
        length = Math.hypot(n0[0] + n1[0], n0[1] + n1[1]),
        n = n0.map((v, axis) => (v + n1[axis]) / length),
        scale = 1.1 / Math.max(0.35, n[0] * n1[0] + n[1] * n1[1]);
      return n.map((v) => v * scale);
    });
    const bands = [1, -1].map((side) =>
      path.map((p, i) => p.map((v, axis) => v + offsets[i][axis] * side)),
    );
    const bottom = k.baileyFloorY + 0.035,
      top = bottom + 0.05;
    cap(o, bands, top, 'paving', 'paving', d);
    for (const [i, ring] of bands.entries())
      wallRing(o, ring, bottom, top, 'paving', 'paving', d, i > 0);
  }
}
function curtain(o, d) {
  for (const id of k.curtain.ways) {
    const p = d === 0 ? simplify(get(id), 1.3) : get(id);
    for (let i = 0; i < p.length - 1; i++)
      edgeBox(
        o,
        p[i],
        p[i + 1],
        k.baileyFloorY,
        k.curtain.height - k.baileyFloorY,
        0.9,
        'wall',
        'masonry',
        d,
      );
  }
  const ivy = get(k.ivyTower.way),
    ip = d === 0 ? circle([45.8, 22.5], 3.7, 6) : d === 1 ? simplify(ivy, 0.35) : ivy;
  prism(o, ip, 0, k.ivyTower.height, 'wall', 'masonry', d);
  const c = ip.reduce((s, v) => s.map((n, j) => n + v[j] / ip.length), [0, 0]);
  for (let i = 0; i < ip.length; i++)
    face(
      o,
      [
        [ip[i][0], k.ivyTower.height, ip[i][1]],
        [ip[(i + 1) % ip.length][0], k.ivyTower.height, ip[(i + 1) % ip.length][1]],
        [c[0], k.ivyTower.height + k.ivyTower.roofRise, c[1]],
      ],
      'roof',
      'tile',
      [0, 1, 0],
      d,
    );
  const bastions = [
    [-37.5, -40],
    [-4, -41],
    [1.5, 43.5],
  ];
  for (const c of bastions) prism(o, circle(c, 2.8, d <= 1 ? 6 : 10), 0, 6.1, 'wall', 'masonry', d);
}
function entranceBridge(o, d) {
  const route = get(120567641),
    a = route[0],
    b = route.at(-1),
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len],
    n = [-u[1], u[0]];
  const p = [
    a.map((v, i) => v + n[i] * 2.0),
    b.map((v, i) => v + n[i] * 2.0),
    b.map((v, i) => v - n[i] * 2.0),
    a.map((v, i) => v - n[i] * 2.0),
  ];
  const holes = [0.26, 0.72].map((t) =>
    prepareOpening(
      {
        center: a.map((v, i) => v + (b[i] - v) * t),
        axis: u,
        width: 5.5,
        height: 3.75,
        spring: 2.5,
        depth: 6,
        bottom: -0.3,
        shape: 'pointed',
      },
      0,
      d,
    ),
  );
  apertures(o, p, 0, k.baileyFloorY, holes, d);
  for (const s of [-1, 1])
    edgeBox(
      o,
      a.map((v, i) => v + n[i] * 1.8 * s),
      b.map((v, i) => v + n[i] * 1.8 * s),
      k.baileyFloorY,
      1.0,
      0.42,
      'stone',
      'stone',
      d,
    );
  if (d >= 1) {
    const ruin = get(895608773);
    for (let i = 0; i < ruin.length; i++)
      edgeBox(o, ruin[i], ruin[(i + 1) % ruin.length], 0, 2.1, 0.9, 'wall', 'masonry', d);
  }
}
const builders = {
  newCastle,
  gloriette,
  coveredBridge,
  maiden,
  gatehouse,
  foundation,
  curtain,
  entranceBridge,
};
export const leedsParts = Object.fromEntries(
  Object.entries(builders).map(([name, fn]) => [name, (o, d) => fn(adapter(o), d)]),
);
export function buildLeedsRuntime(o, level = 'closeup') {
  const d = { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3;
  for (const fn of Object.values(leedsParts)) fn(o, d);
}
export const buildLeedsSkyline = (o) => buildLeedsRuntime(o, 'skyline');
const camera = (name, position, lookAt) => ({
  name,
  position: native(position),
  lookAt: native(lookAt),
});
export const leedsStudy = {
  id: 'N0304',
  key: 'leeds_castle',
  title: 'Leeds Castle',
  category: 'castle',
  wikidataId: 'Q746876',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildLeedsRuntime(o),
  surfaceOverrides: leedsSurfaces,
  brief:
    'Current two-island Leeds Castle: Tudor-style New Castle/octagonal turrets, D-shaped hollow Gloriette with bell tower, two-storey covered bridge over open pointed arches, Maidens Tower/bath arches, medieval southwest gatehouse, low curtain/island and entrance bridge.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: leedsPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 7,
    identityFeatures: [
      'D-shaped Gloriette with open courtyard and raised bell turret',
      'Rectangular New Castle with octagonal corner and taller front gate turrets',
      'Two islands and covered bridge with two actual pointed water arches',
    ],
  },
  sourceFacts: { exactCastleRelation: 6941053, publishedDimensions: refs.publishedDimensions },
  reconstruction: frame.reconstruction,
  scaleBasis: k.basis,
  refs: refs.references.map((r) => r.url),
  sourceDocuments: ['map-frame.json', 'reference-metadata.json', 'surface-means.json'],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original geometry under repository license; original attributed map controls © OpenStreetMap contributors,ODbL-1.0. Historic England listing facts attributed. Operator photographs not redistributed.',
  sourceNotice:
    'Five existing shared256-square masonry/raw stone/clay tile/timber/gravel graphs with metric repeats and linear tints. Flat glass/lawn. No embedded/new image, downloaded mesh or copied photo texture.',
  dataAttribution:
    '© OpenStreetMap contributors; Historic England; Leeds Castle Foundation/Thomas Alexander.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus:
      'Inactive draft: provisional moat/bailey attachment and estimated sections need actual-site review.',
  }),
  geographicNote:
    'Attributed current map components retain native East/South heading0. Water planeY0 and bailey floorY4.4 are provisional source controls; facade fit and actual water/shore datum remain pending.',
  limitations: refs.limitations,
  importReason:
    'Preserve separately mapped current castle components, real Gloriette court and bridge/gate apertures through four authored browser levels.',
  previewGround: false,
  mediumFiContext: { scale: '2.6', neighborStyle: 'molen.worldgen.regional.atlantic.detached' },
  camera: { position: native([-160, 120, 190]), lookAt: native([0, 8, -7]), fov: 43 },
  qaCameras: [
    camera('new-castle-front', [-30, 30, -6], [27, 10, -1]),
    camera('gloriette-courtyard', [85, 54, -13], [78, 7, -19]),
    camera('covered-bridge-water-arches', [55, 7, 22], [55, 4, -14]),
    camera('maidens-tower-and-bath', [-9, 13, 65], [-25, 5, 31]),
    camera('gatehouse-passage', [-118, 9, -37], [-74, 7, -22]),
    camera('mapped-roofs-and-islands', [3, 250, -1], [3, 0, -1]),
  ],
};

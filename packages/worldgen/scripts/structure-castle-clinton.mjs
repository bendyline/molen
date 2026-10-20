/** Present Castle Clinton: a hollow D-shaped brownstone fort, restored roofed walks and two kiosks. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { beam, normalFor } from './authored-structure-mesh.mjs';
import { B, rgb } from './landmark-model-helpers.mjs';

const ref = 'palette:#ffffff',
  defaultFrame = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dr/dr5/castle_clinton/map-frame.json',
        import.meta.url,
      ),
    ),
  ),
  fixedGround = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dr/dr5/castle_clinton/terrain-grid.json',
        import.meta.url,
      ),
    ),
  );
const stone = rgb('a38170'),
  mortar = rgb('84776b'),
  brick = rgb('a2745b'),
  wood = rgb('6c5448'),
  white = rgb('d7d5ca'),
  roofColor = rgb('727269'),
  metal = rgb('373d3b'),
  glass = rgb('536463'),
  paving = rgb('aaa69c');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  tint = (c, t) => c.map((v) => Math.min(1, v * t));
function triangle(o, s, p, c, n) {
  p = p.map((q) => q.map(Math.fround));
  let normal = normalFor(...p);
  if (Math.hypot(...normal) < 0.5) return;
  if (n && normal.reduce((s, v, i) => s + v * n[i], 0) < 0) {
    p = [p[0], p[2], p[1]];
    normal = normal.map((v) => -v);
  }
  o.addTriangle(
    s,
    ref,
    p,
    normal,
    p.map((q) => [q[0] + q[2], q[1]]),
    c,
  );
}
function quad(o, s, p, c, n) {
  triangle(o, s, [p[0], p[1], p[2]], c, n);
  triangle(o, s, [p[0], p[2], p[3]], c, n);
}
function strip(o, s, a, b, width, colour, n) {
  const axis = b.map((v, i) => v - a[i]),
    v = [
      n[1] * axis[2] - n[2] * axis[1],
      n[2] * axis[0] - n[0] * axis[2],
      n[0] * axis[1] - n[1] * axis[0],
    ],
    len = Math.hypot(...v);
  if (len < 0.0001) return;
  const offset = v.map((x) => (x * width) / len / 2);
  quad(
    o,
    s,
    [
      a.map((v, i) => v - offset[i]),
      b.map((v, i) => v - offset[i]),
      b.map((v, i) => v + offset[i]),
      a.map((v, i) => v + offset[i]),
    ],
    colour,
    n,
  );
}
function polygon(o, s, p, c, n) {
  const k = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[2]) > 0.7 ? 2 : 0,
    axes = k === 1 ? [0, 2] : k === 2 ? [0, 1] : [2, 1],
    ids = earcut(p.flatMap((q) => axes.map((i) => q[i])));
  for (let i = 0; i < ids.length; i += 3)
    triangle(
      o,
      s,
      ids.slice(i, i + 3).map((j) => p[j]),
      c,
      n,
    );
}
function facing(o, a, x = 0, z = 0) {
  const c = Math.cos(a),
    s = Math.sin(a),
    v = (p) => [c * p[0] + s * p[2], p[1], -s * p[0] + c * p[2]],
    q = (p) => {
      const r = v(p);
      return [r[0] + x, r[1], r[2] + z];
    };
  return {
    addTriangle: (s, r, p, n, u, c) => o.addTriangle(s, r, p.map(q), v(n), u, c),
    addQuad: (s, r, p, n, u, c) => o.addQuad(s, r, p.map(q), v(n), u, c),
    addConvexPolygon: (s, r, p, n, u, c) => {
      const pp = p.map(q),
        uv = p.map(u);
      return o.addConvexPolygon(s, r, pp, v(n), (p) => uv[pp.indexOf(p)], c);
    },
  };
}
const getGround = (x, z) => {
  const a = (x - fixedGround.origin[0]) / fixedGround.stepMeters,
    b = (z - fixedGround.origin[1]) / fixedGround.stepMeters,
    i = Math.floor(a),
    j = Math.floor(b),
    u = a - i,
    v = b - j,
    h = fixedGround.heightsMeters;
  if (i < 0 || j < 0 || i + 1 >= h[0].length || j + 1 >= h.length)
    throw Error('Outside frozen independent terrain');
  return (
    (h[j][i] * (1 - u) + h[j][i + 1] * u) * (1 - v) +
    (h[j + 1][i] * (1 - u) + h[j + 1][i + 1] * u) * v -
    fixedGround.modelDatumElevationMeters
  );
};
const area = (r) =>
  r.reduce((s, p, i) => {
    const q = r[(i + 1) % r.length];
    return s + p[0] * q[1] - q[0] * p[1];
  }, 0) / 2;
const outward = (r, i) => {
  const a = r[i],
    b = r[(i + 1) % r.length],
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    sgn = area(r) > 0 ? 1 : -1;
  return [(sgn * (b[1] - a[1])) / len, 0, (sgn * (a[0] - b[0])) / len];
};
function clip(poly, value) {
  const q = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i],
      b = poly[(i + 1) % poly.length],
      x = value(a),
      y = value(b);
    if (x >= 0) q.push(a);
    if (x < 0 !== y < 0) q.push(a.map((v, k) => v + ((b[k] - v) * x) / (x - y)));
  }
  return q;
}
function subtractRect(poly, h) {
  const pieces = [],
    bounds = [
      (p) => h.x - h.w / 2 - p[0],
      (p) => p[0] - h.x - h.w / 2,
      (p) => h.y - p[1],
      (p) => p[1] - h.y - h.h,
    ];
  let inside = poly;
  for (const b of bounds) {
    const p = clip(inside, b);
    if (p.length >= 3) pieces.push(p);
    inside = clip(inside, (p) => -b(p));
    if (inside.length < 3) break;
  }
  return pieces;
}
function cutFace(o, slot, outer, holes, map, n, color) {
  let pieces = [outer];
  for (const h of holes) pieces = pieces.flatMap((p) => subtractRect(p, h));
  for (const p of pieces)
    if (p.length >= 3)
      polygon(
        o,
        slot,
        p.map((p) => map(...p)),
        color,
        n,
      );
}
function cap(o, slot, r, y, color, n = [0, 1, 0]) {
  polygon(
    o,
    slot,
    r.map((p) => [p[0], typeof y === 'function' ? y(...p) : y, p[1]]),
    color,
    n,
  );
}
function cylinder(o, slot, x, z, lo, hi, r, n, color) {
  const ring = Array.from({ length: n }, (_, i) => [
    x + Math.cos((i / n) * Math.PI * 2) * r,
    z + Math.sin((i / n) * Math.PI * 2) * r,
  ]);
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n];
    quad(
      o,
      slot,
      [
        [a[0], lo, a[1]],
        [b[0], lo, b[1]],
        [b[0], hi, b[1]],
        [a[0], hi, a[1]],
      ],
      color,
      outward(ring, i),
    );
  }
  cap(o, slot, ring, hi, color);
}
function convexHull(points) {
  const sorted = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    half = (a) => {
      const out = [];
      for (const p of a) {
        while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop();
        out.push(p);
      }
      return out;
    };
  return [...half(sorted).slice(0, -1), ...half(sorted.slice().reverse()).slice(0, -1)];
}
function innerWallPlan(r) {
  // Constant2.4384m main-body inset; native small front projections remain decorative thickness.
  const hull = convexHull(r),
    thick = 2.4384,
    inset = hull.map((p, i) => {
      const prev = hull[(i + hull.length - 1) % hull.length],
        next = hull[(i + 1) % hull.length],
        a = [p[0] - prev[0], p[1] - prev[1]],
        b = [next[0] - p[0], next[1] - p[1]],
        al = Math.hypot(...a),
        bl = Math.hypot(...b),
        aa = [p[0] - (a[1] / al) * thick, p[1] + (a[0] / al) * thick],
        bb = [p[0] - (b[1] / bl) * thick, p[1] + (b[0] / bl) * thick],
        den = a[0] * b[1] - a[1] * b[0],
        t = ((bb[0] - aa[0]) * b[1] - (bb[1] - aa[1]) * b[0]) / den;
      return [aa[0] + a[0] * t, aa[1] + a[1] * t];
    });
  return r.map((p) => {
    let distance = Infinity;
    for (let i = 0; i < inset.length; i++) {
      const a = inset[i],
        b = inset[(i + 1) % inset.length],
        v = [b[0] - a[0], b[1] - a[1]],
        den = p[0] * v[1] - p[1] * v[0];
      if (Math.abs(den) < 1e-10) continue;
      const t = (a[0] * v[1] - a[1] * v[0]) / den,
        u = (a[0] * p[1] - a[1] * p[0]) / den;
      if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) distance = Math.min(distance, t);
    }
    if (!Number.isFinite(distance)) throw Error('Unresolved wall inset');
    return p.map((v) => v * distance);
  });
}
export function castleClintonControls(frame = defaultFrame) {
  const outer = frame.geometry.outline,
    inner = innerWallPlan(outer),
    court = frame.geometry.holes[0],
    lengths = outer.map((p, i) =>
      Math.hypot(p[0] - outer[(i + 1) % outer.length][0], p[1] - outer[(i + 1) % outer.length][1]),
    ),
    offsets = [0];
  for (const l of lengths) offsets.push(offsets.at(-1) + l);
  const front = offsets[2] + lengths[2] / 2,
    rear = offsets[22],
    ports = [];
  for (let i = 0; i < 28; i++) {
    let s = offsets[5] + ((offsets.at(-1) - offsets[5]) * (i + 0.5)) / 28;
    if (Math.abs(s - rear) < 3) s += 3;
    ports.push(s);
  }
  return { outer, inner, court, lengths, offsets, front, rear, ports };
}
function surfaceFloor(o, r, d, slot = 'ground', color = paving, extra = 0) {
  if (d === 0) {
    cap(o, slot, r, 0.62, color);
    return;
  }
  const step = d === 1 ? 6 : d === 2 ? 3 : 1,
    offset = d === 1 ? 0.28 : d === 2 ? 0.14 : 0.08,
    ids = earcut(r.flat());
  for (let k = 0; k < ids.length; k += 3) {
    const tri = ids.slice(k, k + 3).map((i) => r[i]),
      lo = [0, 1].map((j) => Math.floor(Math.min(...tri.map((p) => p[j])) / step) * step),
      hi = [0, 1].map((j) => Math.max(...tri.map((p) => p[j])));
    for (let x = lo[0]; x < hi[0]; x += step)
      for (let z = lo[1]; z < hi[1]; z += step) {
        let p = clip(tri, (p) => p[0] - x);
        p = clip(p, (p) => x + step - p[0]);
        p = clip(p, (p) => p[1] - z);
        p = clip(p, (p) => z + step - p[1]);
        if (p.length >= 3) cap(o, slot, p, (x, z) => getGround(x, z) + offset + extra, color);
      }
  }
}
function ashlar(o, len, holes, map, n, d) {
  if (d < 2) return;
  const height = d === 2 ? 0.75 : 0.43;
  for (let y = -0.35, row = 0; y < 5.88; y += height, row++) {
    for (let x = -0.7 * (row % 2), j = 0; x < len; x += d === 2 ? 2.0 : 1.05, j++) {
      const w = d === 2 ? 1.96 : 1.01,
        x0 = Math.max(0.012, x + 0.02),
        x1 = Math.min(len - 0.012, x + w),
        y0 = y + 0.022,
        y1 = Math.min(5.9, y + height - 0.012);
      if (x1 - x0 < 0.04 || y1 - y0 < 0.04) continue;
      const c = mix(
        stone,
        (j * 7 + row * 11) % 5 === 0 ? rgb('b29578') : rgb('986e60'),
        ((j * 17 + row * 13) % 9) / 22,
      );
      cutFace(
        o,
        'stone',
        [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ],
        holes.map((h) => ({ ...h, w: h.w + 0.025, y: h.y - 0.012, h: h.h + 0.024 })),
        (x, y) => map(x, y, 0.012),
        n,
        c,
      );
    }
  }
}
function walls(o, c, d) {
  const { outer: r, inner, lengths, offsets, front, rear, ports } = c,
    all = [
      { s: front, w: 2.8, y: -0.6, h: 4.15, kind: 'front' },
      { s: rear, w: 2.5, y: -0.6, h: 3.65, kind: 'rear' },
      ...(d === 0 ? [] : ports.map((s) => ({ s, w: 1.05, y: 1.05, h: 0.9, kind: 'gun' }))),
    ];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      aa = inner[i],
      bb = inner[(i + 1) % r.length],
      len = lengths[i],
      n = outward(r, i),
      t = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
      map = (u, y, side = 0) => {
        const q = side === 1 ? aa : a,
          qq = side === 1 ? bb : b;
        return [
          q[0] + ((qq[0] - q[0]) * u) / len + (side === 1 ? 0 : n[0] * side),
          y,
          q[1] + ((qq[1] - q[1]) * u) / len + (side === 1 ? 0 : n[2] * side),
        ];
      },
      holes = all
        .filter((h) => h.s + h.w / 2 > offsets[i] && h.s - h.w / 2 < offsets[i + 1])
        .map((h) => ({ ...h, x: h.s - offsets[i] })),
      rect = [
        [0, -2],
        [len, -2],
        [len, 6],
        [0, 6],
      ];
    cutFace(o, 'stone', rect, holes, (u, y) => map(u, y), n, d > 1 ? mortar : stone);
    cutFace(
      o,
      'stone',
      rect,
      holes,
      (u, y) => map(u, y, 1),
      n.map((v) => -v),
      stone,
    );
    for (const h of holes) {
      const u0 = Math.max(0, h.x - h.w / 2),
        u1 = Math.min(len, h.x + h.w / 2),
        lo = h.y,
        hi = h.y + h.h;
      for (const [u, normal] of [
        [h.x - h.w / 2, t],
        [h.x + h.w / 2, t.map((v) => -v)],
      ])
        if (u > 1e-6 && u < len - 1e-6)
          quad(
            o,
            'stone',
            [map(u, lo), map(u, hi), map(u, hi, 1), map(u, lo, 1)],
            tint(stone, 0.91),
            normal,
          );
      quad(
        o,
        'stone',
        [map(u0, lo), map(u1, lo), map(u1, lo, 1), map(u0, lo, 1)],
        stone,
        [0, 1, 0],
      );
      quad(
        o,
        'stone',
        [map(u0, hi), map(u0, hi, 1), map(u1, hi, 1), map(u1, hi)],
        stone,
        [0, -1, 0],
      );
      if (h.kind === 'gun' && d > 1) {
        for (const u of [h.x - 0.28, h.x, h.x + 0.28])
          if (u > 0 && u < len)
            beam(o, 'metal', map(u, lo + 0.03, 1), map(u, hi - 0.03, 1), 0.035, 0.035, metal);
      }
    }
    quad(o, 'stone', [map(0, 6), map(len, 6), map(len, 6, 1), map(0, 6, 1)], stone, [0, 1, 0]);
    quad(o, 'stone', [map(0, -2), map(0, -2, 1), map(len, -2, 1), map(len, -2)], stone, [0, -1, 0]);
    ashlar(o, len, holes, (u, y, offset) => map(u, y, offset), n, d);
    ashlar(
      o,
      len,
      holes,
      (u, y, offset) => map(u, y, 1).map((v, k) => v - n[k] * offset),
      n.map((v) => -v),
      d,
    );
    if (d > 0) {
      quad(
        o,
        'stone',
        [map(0, 5.91, 0.035), map(len, 5.91, 0.035), map(len, 6.08, 0.035), map(0, 6.08, 0.035)],
        tint(stone, 0.94),
        n,
      );
      quad(
        o,
        'stone',
        [map(0, 6.08, 0.035), map(len, 6.08, 0.035), map(len, 6.08, 1), map(0, 6.08, 1)],
        stone,
        [0, 1, 0],
      );
    }
  }
}
function innerButtresses(o, c, d) {
  if (d === 0) return;
  for (let j = 0; j < c.ports.length - 1; j++) {
    if (d === 1 && j % 3) continue;
    const s = (c.ports[j] + c.ports[j + 1]) / 2;
    if (Math.abs(s - c.rear) < 2.8) continue;
    const i = c.offsets.findIndex((v, k) => k < c.outer.length && s >= v && s < c.offsets[k + 1]),
      u = (s - c.offsets[i]) / c.lengths[i],
      a = c.inner[i],
      b = c.inner[(i + 1) % c.inner.length],
      x = a[0] + (b[0] - a[0]) * u,
      z = a[1] + (b[1] - a[1]) * u,
      n = outward(c.outer, i).map((v) => -v),
      q = facing(o, Math.atan2(n[0], n[2]), x, z);
    B(q, 'stone', 0, -2, 0.29, 1.5, 4.12, 0.58, stone);
    if (d > 1) B(q, 'stone', 0, 2.12, 0.29, 1.58, 0.12, 0.65, stone);
  }
}
function roofRing(o, c, d) {
  const all = [...c.inner, ...c.court],
    ids = earcut(all.flat(), [c.inner.length]);
  // The same planar triangulation is adequate for independently graded decking.
  if (d > 0)
    for (let i = 0; i < ids.length; i += 3)
      surfaceFloor(
        o,
        ids.slice(i, i + 3).map((j) => all[j]),
        d,
        'wood',
        rgb('a29885'),
        0.015,
      );
  // Pair corresponding boundary rays so a roof wedge cannot bridge distant parts of the annulus.
  const baseAngles = all
      .map((p) => Math.atan2(p[1], p[0]))
      .sort((a, b) => a - b)
      .filter((a, i, r) => i === 0 || a - r[i - 1] > 1e-8),
    angles =
      d < 2
        ? baseAngles
        : baseAngles.flatMap((a, i) => {
            const b = i + 1 < baseAngles.length ? baseAngles[i + 1] : baseAngles[0] + Math.PI * 2,
              n = Math.ceil((b - a) / (Math.PI / 60));
            return Array.from({ length: n }, (_, j) => a + ((b - a) * j) / n);
          }),
    boundary = (r, a) => {
      const exact = r.find(
        (p) =>
          Math.abs(
            Math.atan2(Math.sin(Math.atan2(p[1], p[0]) - a), Math.cos(Math.atan2(p[1], p[0]) - a)),
          ) < 1e-10,
      );
      if (exact) return exact;
      const v = [Math.cos(a), Math.sin(a)];
      let nearest = Infinity;
      for (let i = 0; i < r.length; i++) {
        const p = r[i],
          q = r[(i + 1) % r.length],
          w = [q[0] - p[0], q[1] - p[1]],
          den = v[0] * w[1] - v[1] * w[0];
        if (Math.abs(den) < 1e-12) continue;
        const t = (p[0] * w[1] - p[1] * w[0]) / den,
          u = (p[0] * v[1] - p[1] * v[0]) / den;
        if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) nearest = Math.min(nearest, t);
      }
      if (!Number.isFinite(nearest)) throw Error('Unresolved roof boundary');
      return v.map((v) => v * nearest);
    };
  for (let i = 0; i < angles.length; i++) {
    const a = angles[i],
      b = angles[(i + 1) % angles.length],
      innerA = boundary(c.court, a),
      innerB = boundary(c.court, b),
      outerA = boundary(c.inner, a),
      outerB = boundary(c.inner, b),
      p = [
        [innerA[0], 3.55, innerA[1]],
        [outerA[0], 5.25, outerA[1]],
        [outerB[0], 5.25, outerB[1]],
        [innerB[0], 3.55, innerB[1]],
      ];
    quad(o, 'roof', p, roofColor, [0, 1, 0]);
    if (d > 0)
      quad(
        o,
        'wood',
        p.map((p) => [p[0], p[1] - 0.12, p[2]]),
        tint(wood, 0.85),
        [0, -1, 0],
      );
  }
  for (let i = 0; i < c.court.length; i++) {
    const a = c.court[i],
      b = c.court[(i + 1) % c.court.length],
      n = outward(c.court, i).map((v) => -v),
      len = Math.hypot(a[0] - b[0], a[1] - b[1]);
    quad(
      o,
      'wood',
      [
        [a[0], 3.34, a[1]],
        [b[0], 3.34, b[1]],
        [b[0], 3.55, b[1]],
        [a[0], 3.55, a[1]],
      ],
      i === 4 ? white : wood,
      n,
    );
    const count =
      d === 0 ? (i % 3 === 0 ? 1 : 0) : Math.max(1, Math.round(len / (d === 1 ? 5 : 3.8)));
    for (let j = 0; j < count; j++) {
      const u = (j + 0.5) / count,
        x = a[0] + (b[0] - a[0]) * u,
        z = a[1] + (b[1] - a[1]) * u,
        lo = d === 0 ? 0.62 : getGround(x, z) + (d === 1 ? 0.28 : d === 2 ? 0.14 : 0.08);
      if (i === 4 && Math.abs(x - 0.99) < 1.6) continue;
      if (i === 4) {
        B(o, 'wood', x, lo, z, 0.2, 3.34 - lo, 0.2, white);
        if (d > 1) {
          B(o, 'wood', x, lo, z, 0.36, 0.12, 0.36, white);
          B(o, 'wood', x, 3.18, z, 0.33, 0.16, 0.33, white);
        }
      } else {
        cylinder(
          o,
          'brick',
          x,
          z,
          lo,
          3.34,
          d === 0 ? 0.23 : 0.28,
          d < 2 ? 6 : d === 2 ? 8 : 12,
          brick,
        );
        if (d > 1) cylinder(o, 'stone', x, z, lo, lo + 0.09, 0.34, 8, stone);
      }
      if (d === 3) {
        let target,
          distance = Infinity;
        for (let k = 0; k < c.inner.length; k++) {
          const a = c.inner[k],
            b = c.inner[(k + 1) % c.inner.length],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))),
            q = [a[0] + u * dx, 5.1, a[1] + u * dz],
            dd = Math.hypot(q[0] - x, q[2] - z);
          if (dd < distance) {
            target = q;
            distance = dd;
          }
        }
        beam(o, 'wood', [x, 3.38, z], target, 0.13, 0.18, wood);
      }
    }
  }
}
function windowPanel(o, a, b, lo, hi, holes, d, slot = 'stone', color = stone) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = [(b[1] - a[1]) / len, 0, (a[0] - b[0]) / len],
    map = (x, y, depth = 0) => [
      a[0] + ((b[0] - a[0]) * x) / len - n[0] * depth,
      y,
      a[1] + ((b[1] - a[1]) * x) / len - n[2] * depth,
    ];
  cutFace(
    o,
    slot,
    [
      [0, lo],
      [len, lo],
      [len, hi],
      [0, hi],
    ],
    holes,
    (x, y) => map(x, y),
    n,
    color,
  );
  for (const h of holes) {
    const x0 = h.x - h.w / 2,
      x1 = h.x + h.w / 2,
      y0 = h.y,
      y1 = h.y + h.h,
      p = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ],
      front = p.map((p) => map(...p)),
      back = p.map((p) => map(...p, 0.16));
    for (let k = 0; k < 4; k++)
      quad(o, slot, [front[k], front[(k + 1) % 4], back[(k + 1) % 4], back[k]], color);
    quad(o, h.door ? 'wood' : 'glass', back, h.door ? wood : glass, n);
    if (d > 0)
      for (let k = 0; k < 4; k++) {
        const p0 = front[k],
          p1 = front[(k + 1) % 4];
        if (d === 1) strip(o, 'wood', p0, p1, 0.065, white, n);
        else beam(o, 'wood', p0, p1, 0.065, 0.065, white);
      }
    if (d > 1 && !h.door) {
      for (const u of [1 / 3, 2 / 3])
        beam(
          o,
          'wood',
          map(x0, y0 + h.h * u, 0.13),
          map(x1, y0 + h.h * u, 0.13),
          0.04,
          0.04,
          white,
        );
      beam(o, 'wood', map(h.x, y0, 0.13), map(h.x, y1, 0.13), 0.04, 0.04, white);
    }
  }
}
function quarters(o, d) {
  // Existing straight-front restored quarters; central entrance remains genuinely open.
  const a = [-19.8, 12.5],
    b = [19.5, 12.5],
    n = [0, 0, -1],
    len = b[0] - a[0],
    doorX = 0.99 - a[0],
    portal = { x: doorX, w: 2.8, y: -0.6, h: 4.15 },
    holes =
      d === 0
        ? []
        : [-16, -12, -8, -4, 5.6, 9.6, 13.6, 17.0].map((x) => ({
            x: x - a[0],
            w: 1.05,
            y: 1.05,
            h: 1.72,
          }));
  // Reverse front map so outward faces toward the open court.
  const map = (x, y, dep = 0) => [a[0] + x, y, 12.5 + dep];
  cutFace(
    o,
    'stone',
    [
      [0, -2],
      [len, -2],
      [len, 4.14],
      [0, 4.14],
    ],
    [portal, ...holes],
    (x, y) => map(x, y),
    n,
    stone,
  );
  for (const h of holes) {
    const p = [
      [h.x - h.w / 2, h.y],
      [h.x + h.w / 2, h.y],
      [h.x + h.w / 2, h.y + h.h],
      [h.x - h.w / 2, h.y + h.h],
    ];
    for (let i = 0; i < 4; i++)
      quad(
        o,
        'stone',
        [map(...p[i]), map(...p[(i + 1) % 4]), map(...p[(i + 1) % 4], 0.18), map(...p[i], 0.18)],
        stone,
      );
    quad(
      o,
      'glass',
      p.map((p) => map(...p, 0.18)),
      glass,
      n,
    );
    if (d > 0)
      for (let i = 0; i < 4; i++)
        strip(o, 'wood', map(...p[i]), map(...p[(i + 1) % 4]), 0.075, white, n);
    if (d > 1) {
      for (let j = 1; j < 3; j++)
        beam(
          o,
          'wood',
          map(h.x - h.w / 2, h.y + (h.h * j) / 3, 0.14),
          map(h.x + h.w / 2, h.y + (h.h * j) / 3, 0.14),
          0.045,
          0.045,
          white,
        );
      beam(o, 'wood', map(h.x, h.y, 0.14), map(h.x, h.y + h.h, 0.14), 0.045, 0.045, white);
    }
  }
  for (const x of [0.99 - 1.4, 0.99 + 1.4])
    quad(
      o,
      'stone',
      [
        [x, -0.6, 12.5],
        [x, -0.6, 20.1],
        [x, 3.55, 20.1],
        [x, 3.55, 12.5],
      ],
      stone,
      [x < 0.99 ? 1 : -1, 0, 0],
    );
  quad(
    o,
    'wood',
    [
      [0.99 - 1.4, 3.55, 12.5],
      [0.99 + 1.4, 3.55, 12.5],
      [0.99 + 1.4, 3.55, 20.1],
      [0.99 - 1.4, 3.55, 20.1],
    ],
    wood,
    [0, -1, 0],
  );
  for (const x of [-19.8, 19.5])
    quad(
      o,
      'stone',
      [
        [x, -2, 12.5],
        [x, -2, 20.1],
        [x, 5.2, 20.1],
        [x, 4.14, 12.5],
      ],
      stone,
      [x < 0 ? -1 : 1, 0, 0],
    );
  for (const x of [-9.3, 10.7]) {
    B(o, 'stone', x, 4.8, 19.0, 1.35, 2.3, 1.35, stone);
    if (d > 0) B(o, 'stone', x, 7.1, 19, 1.55, 0.19, 1.55, tint(stone, 0.9));
  }
}
function portal(o, c, d) {
  const a = c.outer[3],
    b = c.outer[2],
    cx = (a[0] + b[0]) / 2,
    cz = (a[1] + b[1]) / 2,
    angle = Math.atan2(-(b[1] - a[1]), b[0] - a[0]),
    q = facing(o, angle, cx, cz);
  for (const x of [-3.35, -1.95, 1.95, 3.35]) {
    if (d < 2) B(q, 'stone', x, -0.35, 0.08, 0.87, 5.8, 0.4, stone);
    else {
      for (let j = 0; j < 8; j++)
        B(
          q,
          'stone',
          x,
          -0.35 + j * 0.72,
          0.09,
          j % 2 === 0 ? 0.97 : 0.82,
          0.67,
          0.4,
          mix(stone, rgb('b59a83'), (j % 3) * 0.07),
        );
      B(q, 'stone', x, -0.25, 0.13, 1.06, 0.18, 0.5, stone);
      B(q, 'stone', x, 5.32, 0.13, 1.03, 0.18, 0.52, stone);
    }
  }
  for (const [y, h, w, dep] of [
    [5.45, 0.18, 7.7, 0.44],
    [5.63, 0.62, 7.6, 0.38],
    [6.25, 0.18, 8.1, 0.58],
    [6.43, 0.22, 8.7, 0.76],
    [6.65, 0.22, 9, 0.83],
    [6.87, 0.18, 8.1, 0.48],
    [7.05, 0.13, 4.2, 0.48],
  ])
    B(q, 'stone', 0, y, dep / 2, w, h, dep, stone);
  if (d > 0) {
    const n = d === 1 ? 6 : d === 2 ? 10 : 14;
    for (let i = 0; i < n; i++) {
      const aa = (i / n) * Math.PI,
        bb = ((i + 1) / n) * Math.PI,
        r = 1.42,
        rr = 1.75,
        y = 3.55;
      quad(
        q,
        'stone',
        [
          [r * Math.cos(aa), y + r * Math.sin(aa), 0.04],
          [rr * Math.cos(aa), y + rr * Math.sin(aa), 0.04],
          [rr * Math.cos(bb), y + rr * Math.sin(bb), 0.04],
          [r * Math.cos(bb), y + r * Math.sin(bb), 0.04],
        ],
        tint(stone, i % 2 ? 0.92 : 1.06),
        [0, 0, 1],
      );
    }
    for (const x of [-5.1, 5.1]) B(q, 'metal', x, 0.85, 0.025, 0.65, 1.25, 0.055, metal);
  }
}
function kiosk(o, r, d) {
  const lo = -1,
    wall = 3.0,
    center = [0, 1].map((k) => r.reduce((s, p) => s + p[k], 0) / r.length),
    scored = r
      .map((p, i) => {
        const n = outward(r, i),
          b = r[(i + 1) % r.length];
        return { i, score: n[2], len: Math.hypot(b[0] - p[0], b[1] - p[1]) };
      })
      .filter((e) => e.len > 1.25)
      .sort((a, b) => b.score - a.score),
    door = scored[0]?.i;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      holes =
        d === 0
          ? []
          : i === door
            ? [
                {
                  x: len * 0.5,
                  w: Math.min(1.05, len * 0.72),
                  y: getGround(...center) + 0.1,
                  h: 2.0,
                  door: true,
                },
              ]
            : [];
    windowPanel(o, a, b, lo, wall, holes, d, 'wood', wood);
  }
  cap(o, 'wood', r, wall, wood);
  const roof = r.map((p) => p.map((v, k) => center[k] + (v - center[k]) * 1.08)),
    tip = [center[0], 4.7, center[1]];
  for (let i = 0; i < roof.length; i++) {
    const a = roof[i],
      b = roof[(i + 1) % roof.length];
    triangle(o, 'roof', [[a[0], 3.06, a[1]], [b[0], 3.06, b[1]], tip], roofColor, [0, 1, 0]);
    if (d > 0)
      quad(
        o,
        'wood',
        [
          [a[0], 2.96, a[1]],
          [b[0], 2.96, b[1]],
          [b[0], 3.06, b[1]],
          [a[0], 3.06, a[1]],
        ],
        wood,
        outward(roof, i),
      );
  }
  if (d > 1) {
    B(o, 'stone', center[0], 4.7, center[1], 0.16, 0.16, 0.16, white);
    B(o, 'metal', center[0], 4.86, center[1], 0.04, 0.16, 0.04, metal);
  }
}
export function castleClinton(o, frame = defaultFrame, d = 3) {
  const c = castleClintonControls(frame);
  surfaceFloor(o, c.outer, d);
  walls(o, c, d);
  innerButtresses(o, c, d);
  roofRing(o, c, d);
  quarters(o, d);
  portal(o, c, d);
  for (const f of frame.features.filter((f) => f.index !== 5)) kiosk(o, f.rings[0], d);
}
export const castleClintonSkyline = (o) => castleClinton(o, undefined, 0),
  castleClintonDistrict = (o) => castleClinton(o, undefined, 1),
  castleClintonStreet = (o) => castleClinton(o, undefined, 2);
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_sandstone', roughness: 0.94, metallic: 0 },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.95, metallic: 0 },
  wood: { slot: 'trim', graph: 'wood_vertical', roughness: 0.91, metallic: 0 },
  roof: { slot: 'roof', graph: 'shingle_cedar', roughness: 0.9, metallic: 0 },
  metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.6, metallic: 0.12 },
  glass: { slot: 'window', localRef: ref, roughness: 0.3, metallic: 0.04 },
  ground: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
};
export const castleClintonModel = {
  id: 'castle_clinton',
  key: 'castle_clinton',
  recipe: 'structure-castle-clinton.mjs',
  cell: 'dr/dr5',
  title: 'Castle Clinton',
  brief:
    'Current hollow D-shaped varied brownstone fort with thick separate outer wall, real front/rear passageways and28 interpreted barred gunports, broad gray-shingle covered perimeter walks, curved brick-pier porch and straight pale-wood colonnade/restored quarters. Filled upper gateway arch, rusticated four-pilaster surround, layered cornice/two chimneys and two dark polygonal wood kiosks. Open courtyard and mapped roof opening remain distinct from wall thickness; no aquarium dome.',
  camera: [62, 48, 70],
  lookAt: [0, 2, -1],
  qaCameras: [
    { name: 'main-gateway', position: [4, 5, 45], lookAt: [1, 3.5, 22] },
    { name: 'open-court', position: [0, 18, 14], lookAt: [0, 2, -8] },
    { name: 'front-quarters', position: [0, 4, -2], lookAt: [1, 2, 14] },
    { name: 'curved-casemates', position: [13, 3, -6], lookAt: [23, 2, -9] },
    { name: 'rear-gate', position: [2, 4, -45], lookAt: [-0.2, 2, -29] },
    { name: 'kiosks', position: [0, 12, 13], lookAt: [0, 2, -9] },
    { name: 'overhead', position: [0, 95, 25], lookAt: [0, 0, -3] },
  ],
  mediumFiContext: { scale: 1.2 },
  build: castleClinton,
  surfaces,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    'Original locked USGS NY_CMPG_2013 F32 bare-earth export and4 metadata files preserved before geometry;66049 unchanged values,2.5969m dry-court provider datum. Own thin paving is sampled from that independent field; no source heights fitted or flattened. Full runtime/visual/placement review remains separate.',
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-castle-clinton.mjs',
    level: 'skyline',
    export: 'castleClintonSkyline',
    errorMeters: 2,
    surfaces,
    authoredLevels: {
      district: { export: 'castleClintonDistrict', errorMeters: 0.7, surfaces },
      street: { export: 'castleClintonStreet', errorMeters: 0.22, surfaces },
    },
  },
  limitations: [
    ...defaultFrame.limitations,
    'Current6m wall,7.18m portal/7.29m chimneys,3.55..5.25m attached gray roofs and4.7m kiosk roofs are photographic estimates, not measured endpoints. Inner main-body inset follows primary8ft control; native court hole marks roof edge, not masonry thickness.28 historical gunport positions are evenly interpreted along the surviving curved ring, with small adjustments near the mapped rear gate; exact present count/positions, inner buttress spacing and individual infills remain approximate.',
    'Native outer/roof opening and kiosk plans are retained. Main and rear passages follow actual mapped tunnel paths; portal upper semicircle is filled stone above actual rectangular opening. Fine lettering/plaques and fixtures are simplified without copied text/heraldry.',
    'Own courtyard paving follows held-fixed independent bare-earth grade with a thin clearance, without changing original field. Coarse detail levels approximate floor grade; hidden wall-ground interpolation, source2013 project vs later paving changes, exact thresholds and default coarse Earth host compatibility remain unverified.',
    'Eleven actual local originals constrain exterior. Historical1959–1967 aerial supplies comparison only; current restored portico/quarters/kiosks follow2010–2019 photos. City, vegetation, people, portable signs/barriers, cannon displays, flag and interiors excluded.',
  ],
};

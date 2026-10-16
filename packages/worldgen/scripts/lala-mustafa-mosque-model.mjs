/** Lala Mustafa Pasha: three-portal Gothic front, open tower shells and north minaret. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/sy/sy0/n0333_lala_mustafa_pasha_mosque/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const rec = frame.reconstruction,
  floor = rec.floorY;
const palette = {
  stone: '#bea477',
  trim: '#d8c08e',
  roofstone: '#b7ab8e',
  foundation: '#ad9a78',
  slate: '#6c7177',
  bronze: '#ae9467',
  door: '#705438',
  glass: '#485454',
};
const colors = Object.fromEntries(
  Object.entries(palette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  ]),
);
const unit = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const center = (r) => [0, 1].map((k) => r.reduce((n, p) => n + p[k], 0) / r.length);
const sign = (r) =>
  Math.sign(
    r.reduce((s, p, i) => {
      const q = r[(i + 1) % r.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
const rect = (p, w, h) => [
  [p[0] - w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] + h / 2],
  [p[0] - w / 2, p[1] + h / 2],
];
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, lalaGround(...p) - 0.35);
export function lalaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Lala Mustafa Pasha footing outside retained terrain');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    H = g.heights;
  return (
    (H[k] * (1 - a) + H[k + 1] * a) * (1 - b) +
    (H[k + g.width] * (1 - a) + H[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, d) {
  return (slot, p, direction) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction) {
      for (let i = 1; i < p.length - 1; i++) {
        const n = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...n) < 0.5) continue;
        if (n.reduce((sum, v, k) => sum + v * direction[k], 0) < 0) p = p.toReversed();
        break;
      }
    }
    const color = d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot];
    for (let i = 1; i < p.length - 1; i++) {
      const t = [p[0], p[i], p[i + 1]];
      if (
        Math.hypot(
          ...cross(
            t[1].map((v, k) => v - t[0][k]),
            t[2].map((v, k) => v - t[0][k]),
          ),
        ) < 1e-7
      )
        continue;
      out.addTriangle(
        slot,
        'palette:#ffffff',
        t,
        normalFor(...t),
        [
          [0, 0],
          [1, 0],
          [0, 1],
        ],
        color,
      );
    }
  };
}
function cap(face, r, y, slot, holes = []) {
  const points = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const s = sign(r) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face(slot, [at(p, b), at(q, b), at(q, t), at(p, t)], [(q[1] - p[1]) * s, 0, (p[0] - q[0]) * s]);
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function profile(face, r, levels, slot) {
  for (let i = 1; i < levels.length; i++) {
    const [b, a] = levels[i - 1],
      [t, c] = levels[i],
      lo = scaled(r, a),
      hi = scaled(r, c),
      s = sign(r);
    for (let j = 0; j < r.length; j++) {
      const k = (j + 1) % r.length;
      face(
        slot,
        [at(lo[j], b), at(lo[k], b), at(hi[k], t), at(hi[j], t)],
        [(r[k][1] - r[j][1]) * s, 0.1, (r[j][0] - r[k][0]) * s],
      );
    }
  }
  const [t, f] = levels.at(-1);
  if (f > 0) cap(face, scaled(r, f), t, slot);
}
const box = (face, p, w, d, b, t, slot) => solid(face, rect(p, w, d), b, t, slot);
function faceFrame(r, i) {
  const a = r[i],
    b = r[(i + 1) % r.length],
    axis = unit(b.map((v, k) => v - a[k])),
    normal = [axis[1] * sign(r), -axis[0] * sign(r)];
  return { a, b, axis, normal, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
}
function pane(face, h, d, offset = -0.18, slot = 'glass') {
  const p = prepareOpening(h, 0, d),
    normal = [-p.axis[1], p.axis[0]];
  offset *= Math.sign(normal[0] * h.normal[0] + normal[1] * h.normal[1]);
  face(
    slot,
    openingShape(h, d).map((q) => p.point(...q, offset)),
    [h.normal[0], 0, h.normal[1]],
  );
}
function archBand(face, h, d, w = 0.45, slot = 'trim', offset = 0.08) {
  const outer = openingShape(
      {
        ...h,
        width: h.width + w * 2,
        height: h.height + w,
        bottom: h.bottom - w,
        spring: h.spring + w,
      },
      d,
    ),
    inner = openingShape(h, d),
    p = prepareOpening(h, 0, d);
  offset *= Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (outer.length !== inner.length) return;
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    face(
      slot,
      [
        p.point(...outer[i], offset),
        p.point(...outer[j], offset),
        p.point(...inner[j], offset),
        p.point(...inner[i], offset),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
}
export const lalaOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !lalaOpenings.some((q) => q.name === h.name)) lalaOpenings.push(h);
  return h;
};
function shell(out, d, r, b, t, holes = [], slot = 'stone', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
    face = writer(openingBuilder(out, hs), d);
  const apertureBounds = (h) => {
    const p = h.ring.flatMap((q) => [h.point(...q, -h.depth / 2), h.point(...q, h.depth / 2)]);
    return [0, 1, 2].map((k) => [Math.min(...p.map((q) => q[k])), Math.max(...p.map((q) => q[k]))]);
  };
  const overlaps = (a, b) => a.every((r, k) => r[0] <= b[k][1] + 1e-6 && r[1] >= b[k][0] - 1e-6);
  const apertureBoxes = hs.map(apertureBounds);
  sides(face, r, b, t, slot);
  if (inner) sides(face, inner, b, t, slot, true);
  if (inner) cap(face, r, t, slot, [inner]);
  const cavity = inner
    ? {
        planes: inner.map((a, i) => {
          const q = inner[(i + 1) % inner.length],
            dx = q[0] - a[0],
            dz = q[1] - a[1],
            s = sign(inner);
          return [-dz * s, 0, dx * s, (dz * a[0] - dx * a[1]) * s];
        }),
      }
    : undefined;
  for (const h of hs) {
    const reveals = openingBuilder(out, [
      ...hs.filter((q, i) => q !== h && overlaps(apertureBoxes[hs.indexOf(h)], apertureBoxes[i])),
      ...(cavity ? [cavity] : []),
    ]);
    openingReveals(
      {
        addTriangle(_s, ref, p, n, uv, col) {
          reveals.addTriangle(slot, ref, p, n, uv, col);
        },
      },
      r,
      (p) => (typeof b === 'function' ? b(p) : floor + b),
      () => floor + t,
      [h],
      d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot],
    );
  }
}
function simplify(r, tolerance) {
  let changed = true,
    p = [...r];
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        u = c.map((v, k) => v - a[k]),
        len = Math.hypot(...u),
        t = Math.max(
          0,
          Math.min(1, ((b[0] - a[0]) * u[0] + (b[1] - a[1]) * u[1]) / (len * len || 1)),
        ),
        q = lerp(a, c, t);
      if (Math.hypot(b[0] - q[0], b[1] - q[1]) < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * 2 * Math.PI) / n),
    p[1] + r * Math.sin(offset + (i * 2 * Math.PI) / n),
  ]);
const band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
function beam(face, a, b, w, slot = 'trim') {
  const axis = unit(b.map((v, k) => v - a[k])),
    u = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    v = unit(cross(axis, u)),
    corners = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([s, t]) => p.map((n, k) => n + ((u[k] * s + v[k] * t) * w) / 2)),
    lo = corners(a),
    hi = corners(b);
  face(
    slot,
    lo,
    axis.map((v) => -v),
  );
  face(slot, hi, axis);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
function _crossTop(face, p, base, top, d) {
  box(face, p, 0.13, 0.13, base - 0.1, top, 'bronze');
  if (d) box(face, p, 0.95, 0.13, top - 0.65, top - 0.48, 'bronze');
}
function _cone(face, r, base, top, d) {
  profile(
    face,
    r,
    d === 0
      ? [
          [base, 1.06],
          [top, 0.025],
        ]
      : [
          [base, 1.05],
          [base + 0.2, 1.06],
          [top, 0.025],
        ],
    'slate',
  );
  if (d >= 3) {
    const p = center(r);
    for (let i = 0; i < r.length; i++) beam(face, at(r[i], base), at(p, top - 0.1), 0.065, 'trim');
  }
}
function subtractConvex(polygon, mask) {
  const pieces = [];
  let remaining = polygon;
  const clip = (p, a, b, positive) => {
    const result = [],
      value = (q) =>
        ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) *
        sign(mask) *
        (positive ? 1 : -1);
    if (!p.length) return result;
    let previous = p.at(-1),
      v = value(previous);
    for (const q of p) {
      const w = value(q);
      if (v >= 0 !== w >= 0) result.push(lerp(previous, q, v / (v - w)));
      if (w >= 0) result.push(q);
      previous = q;
      v = w;
    }
    return result;
  };
  for (let i = 0; i < mask.length && remaining.length > 2; i++) {
    const a = mask[i],
      b = mask[(i + 1) % mask.length],
      outside = clip(remaining, a, b, false);
    if (outside.length > 2) pieces.push(outside);
    remaining = clip(remaining, a, b, true);
  }
  return pieces;
}
function _roof(face, r, short, base, top, slot = 'metal', masks = []) {
  const lo = Math.min(...r.map((p) => p[short])),
    hi = Math.max(...r.map((p) => p[short])),
    mid = (lo + hi) / 2,
    half = (hi - lo) / 2,
    y = (p) => floor + base + (top - base) * (1 - Math.min(1, Math.abs(p[short] - mid) / half));
  const polys = [];
  for (const sign of [-1, 1]) {
    const out = [];
    let a = r.at(-1),
      av = (a[short] - mid) * sign;
    for (const b of r) {
      const v = (b[short] - mid) * sign;
      if (av >= 0 !== v >= 0) out.push(lerp(a, b, av / (av - v)));
      if (v >= 0) out.push(b);
      a = b;
      av = v;
    }
    if (out.length > 2) polys.push(out);
  }
  for (const p of masks.reduce((ps, m) => ps.flatMap((p) => subtractConvex(p, m)), polys))
    cap(face, p, y, slot);
  const outline = r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      ts = [0];
    if (Math.abs(b[short] - a[short]) > 1e-8) {
      const t = (mid - a[short]) / (b[short] - a[short]);
      if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
    }
    return ts.sort((a, b) => a - b).map((t) => lerp(a, b, t));
  });
  sides(face, outline, base, y, 'stone');
}
function windows(face, r, d, bottom = 2.7, height = 3.1, name = 'body', spacing = 5) {
  if (!d) return;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < (d === 1 ? 4 : 1.1)) continue;
    const count = Math.max(1, Math.floor(f.length / (spacing * (d === 1 ? 1.8 : 1))));
    for (let k = 0; k < count; k++) {
      const p = lerp(f.a, f.b, (k + 0.5) / count);
      if (name === 'body' && p[0] < -14 && Math.abs(p[1] - rec.front.z) < 3.5) continue;
      if (name === 'aisle' && p[0] < -27) continue;
      const h = {
        center: p,
        axis: f.axis,
        normal: f.normal,
        width: Math.min(name === 'drum' ? 1.05 : 1.3, (f.length / count) * 0.65),
        bottom: floor + bottom,
        height,
        spring: height * 0.67,
        shape: 'pointed',
        depth: 1,
      };
      pane(face, h, d, 0.2);
      if (d >= 3) archBand(face, h, d, 0.18, 'trim', 0.12);
    }
  }
}
const ring = (r, d) => simplify(r, d === 0 ? 0.6 : 0.02);
const portal = (p, d) =>
  remember(
    {
      name: `west-portal-${p.z}`,
      center: [-30.1, p.z],
      axis: [0, 1],
      normal: [-1, 0],
      width: p.width,
      bottom: floor + 0.03,
      height: p.height,
      spring: p.height * 0.67,
      shape: 'pointed',
      depth: 12,
    },
    d,
  );
function gable(face, x, z, width, base, top, depth, slot = 'stone') {
  const p = [
      [z - width / 2, base],
      [z + width / 2, base],
      [z, top],
    ],
    side = (x) => p.map((q) => [x, floor + q[1], q[0]]),
    a = side(x - depth / 2),
    b = side(x + depth / 2);
  face(slot, a, [-1, 0, 0]);
  face(slot, b, [1, 0, 0]);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    face(slot, [a[i], a[j], b[j], b[i]]);
  }
}
function towerHoles(t, d) {
  if (!d) return [];
  const faces = [
    { name: 'front', center: [-30.3, t.center[1]], axis: [0, 1], normal: [-1, 0], width: 5.35 },
    { name: 'back', center: [-22.3, t.center[1]], axis: [0, 1], normal: [1, 0], width: 4.65 },
    {
      name: 'inner',
      center: [-26.3, t.name === 'north' ? -5.8 : 5.8],
      axis: [1, 0],
      normal: [0, t.name === 'north' ? 1 : -1],
      width: 4.35,
    },
  ];
  if (t.name === 'south')
    faces.push({
      name: 'outer',
      center: [-26.3, 15.12],
      axis: [1, 0],
      normal: [0, 1],
      width: 4.35,
    });
  return faces.map((h) =>
    remember(
      {
        ...h,
        name: `${t.name}-upper-${h.name}`,
        bottom: floor + 23,
        height: 9.8,
        spring: 6.25,
        shape: 'pointed',
        depth: 1.8,
      },
      d,
    ),
  );
}
function tower(out, d, t, portals) {
  const hs = towerHoles(t, d),
    face = writer(out, d),
    r = ring(t.outline, d),
    open = d === 1 ? hs.filter((h) => h.name.endsWith('front')) : hs;
  if (!d) solid(face, r, footing, t.wall, 'stone');
  else shell(out, d, r, footing, t.wall, [...portals, ...open], 'stone', t.inner);
  for (const h of hs) {
    if (d === 1 && !open.includes(h)) pane(face, h, d, 0.1);
    if (d >= 2) archBand(face, h, d, 0.35, 'trim', 0.12);
  }
  gable(
    writer(
      openingBuilder(
        out,
        open.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    -30.52,
    t.center[1],
    6.1,
    31.8,
    t.gable,
    0.45,
    'trim',
  );
  if (d) {
    band(face, r, 14.6, 0.3);
    band(face, r, 22.5, 0.3);
    band(face, r, t.wall - 0.2, 0.23);
    const piers = [t.outline[0], t.outline[1]];
    for (const p of piers) {
      const q = [p[0] - 0.15, p[1]];
      solid(face, rect(q, 0.85, 0.9), 0, t.wall + 0.25, 'trim');
      if (d >= 2)
        profile(
          face,
          rect(q, 0.85, 0.9),
          [
            [t.wall + 0.25, 1],
            [t.wall + 1.4, 0.65],
            [t.wall + 1.9, 0.05],
          ],
          'trim',
        );
    }
    for (const p of [t.outline[2], t.outline[3]])
      box(face, p, 0.68, 0.75, t.wall - 0.15, t.wall + 0.7, 'stone');
  }
}
function vaultedRoof(face, polygon, d) {
  const r = ring(polygon.outline, d),
    n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : d === 3 ? 12 : 16,
    lo = -5.8,
    hi = 7.05,
    mid = (lo + hi) / 2;
  const y = (z) =>
    rec.clerestory +
    (rec.vaultTop - rec.clerestory) *
      Math.sqrt(Math.max(0, 1 - Math.pow((z - mid) / ((hi - lo) / 2), 2)));
  // Each narrow convex strip is clipped against the mapped rounded apse.
  const clip = (r, z, greater) => {
    const p = [];
    let a = r.at(-1),
      v = (a[1] - z) * (greater ? 1 : -1);
    for (const b of r) {
      const w = (b[1] - z) * (greater ? 1 : -1);
      if (v >= 0 !== w >= 0) p.push(lerp(a, b, v / (v - w)));
      if (w >= 0) p.push(b);
      a = b;
      v = w;
    }
    return p;
  };
  for (let i = 0; i < n; i++) {
    const a = lo + ((hi - lo) * i) / n,
      b = lo + ((hi - lo) * (i + 1)) / n,
      part = clip(clip(r, a, true), b, false);
    if (part.length < 3) continue;
    cap(face, part, (p) => floor + y(a) + ((y(b) - y(a)) * (p[1] - a)) / (b - a), 'roofstone');
  }
  const ends = r.filter((p) => p[0] > 24.6);
  if (d && ends.length > 2)
    for (let i = 0; i < ends.length - 1; i++) {
      const a = ends[i],
        b = ends[i + 1];
      face('stone', [
        at(a, rec.clerestory),
        at(b, rec.clerestory),
        at(b, (p) => floor + y(p[1])),
        at(a, (p) => floor + y(p[1])),
      ]);
    }
}
function flyingArch(face, d, p) {
  const a = [p.x, p.innerZ],
    b = [p.x, p.z],
    n = d === 0 ? 1 : d === 1 ? 4 : d === 2 ? 8 : d === 3 ? 12 : 16,
    width = d ? 0.72 : 1.1;
  const upper = (t) => 23.6 - 1.4 * t,
    lower = (t) => (d ? upper(t) - 1.05 - 3.0 * (1 - Math.sin(Math.PI * t)) : upper(t) - 1.25);
  for (let i = 0; i < n; i++) {
    const t = i / n,
      u = (i + 1) / n,
      v = lerp(a, b, t),
      w = lerp(a, b, u),
      q = (point, y, side) => [point[0] + (side * width) / 2, floor + y, point[1]];
    const lo = [q(v, lower(t), -1), q(w, lower(u), -1), q(w, upper(u), -1), q(v, upper(t), -1)],
      hi = [q(v, lower(t), 1), q(w, lower(u), 1), q(w, upper(u), 1), q(v, upper(t), 1)];
    face('stone', lo, [-1, 0, 0]);
    face('stone', hi, [1, 0, 0]);
    face('stone', [lo[0], lo[1], hi[1], hi[0]], [0, -1, 0]);
    face('trim', [lo[3], lo[2], hi[2], hi[3]], [0, 1, 0]);
    if (i === 0) face('stone', [lo[0], lo[3], hi[3], hi[0]]);
    if (i === n - 1) face('stone', [lo[1], lo[2], hi[2], hi[1]]);
  }
}
function buttresses(face, d) {
  for (const p of rec.outerButtresses) {
    const r = rect([p.x, p.z], p.baseWidth, 2.6);
    if (!d) solid(face, r, footing, p.head, 'stone');
    else {
      solid(face, r, footing, 12, 'stone');
      profile(
        face,
        r,
        [
          [12, 1],
          [13, 0.8],
          [p.head - 0.4, 0.8],
          [p.head, 0.35],
        ],
        'stone',
      );
      if (d >= 2) {
        band(face, r, 12, 0.15);
        box(face, [p.x, p.z], 0.7, 1.4, p.head, p.head + 0.45, 'trim');
      }
    }
    flyingArch(face, d, p);
  }
}
function minaret(out, d) {
  const face = writer(out, d),
    m = rec.minaret,
    n = d === 0 ? 8 : d === 1 ? 8 : d === 2 ? 12 : d === 3 ? 16 : 24,
    r = regular(m.center, m.radius, n, Math.PI / 8);
  solid(face, r, 0, m.balcony, 'stone');
  profile(
    face,
    r,
    d === 0
      ? [
          [m.balcony, 1.6],
          [m.balcony + 0.5, 1],
        ]
      : [
          [m.balcony - 0.4, 1],
          [m.balcony, 1.65],
          [m.balcony + 0.6, 1.65],
          [m.balcony + 0.7, 0.82],
        ],
    'trim',
  );
  solid(face, scaled(r, 0.78), m.balcony + 0.65, m.eave, 'stone');
  profile(
    face,
    scaled(r, 0.83),
    [
      [m.eave, 1.05],
      [d ? m.top - 0.5 : m.top, 0.035],
    ],
    'slate',
  );
  if (d) {
    const count = d === 1 ? 6 : 12;
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count,
        p = [
          m.center[0] + m.radius * 1.5 * Math.cos(a),
          m.center[1] + m.radius * 1.5 * Math.sin(a),
        ];
      box(face, p, 0.1, 0.1, m.balcony + 0.6, m.balcony + 1.55, 'trim');
    }
    profile(
      face,
      r,
      [
        [m.balcony + 1.55, 1.56],
        [m.balcony + 1.67, 1.56],
      ],
      'trim',
    );
    windows(face, r, d, m.base + 2, 3.1, 'minaret', 5);
  }
  if (d) box(face, m.center, 0.08, 0.08, m.top - 0.55, m.top, 'bronze');
  if (d >= 2) {
    const x = m.center[0],
      z = m.center[1],
      y = floor + m.top - 0.25;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI * 0.7 + (i * Math.PI * 1.4) / 9,
        b = -Math.PI * 0.7 + ((i + 1) * Math.PI * 1.4) / 9;
      beam(
        face,
        [x, y + 0.25 * Math.sin(a), z + 0.25 * Math.cos(a)],
        [x, y + 0.25 * Math.sin(b), z + 0.25 * Math.cos(b)],
        0.045,
        'bronze',
      );
    }
  }
}
function terrace(face, d) {
  const r = rec.front.terrace,
    y = rec.front.terraceTop;
  solid(face, r, footing, y, 'foundation');
  const n = d === 0 ? 1 : d === 1 ? 4 : 9,
    z0 = 15.1,
    z1 = 20.1;
  for (let i = 0; i < n; i++) {
    const z = z0 + ((z1 - z0) * i) / n,
      next = z0 + ((z1 - z0) * (i + 1)) / n,
      top = floor + y - (i + 1) * 0.24;
    solid(
      face,
      rect([-38, (z + next) / 2], 5.2, next - z),
      (p) => Math.min(top - 0.1, lalaGround(...p) - 0.12),
      () => top,
      'foundation',
    );
  }
  if (d >= 2) {
    for (const x of [-43, -30.5]) solid(face, rect([x, 0], 0.65, 30.2), y, y + 0.72, 'stone');
    solid(face, rect([-36.7, -15.0], 12.5, 0.6), y, y + 0.72, 'stone');
  }
}
function facade(out, d, portals) {
  const face = writer(
    openingBuilder(
      out,
      portals.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  const r = rect([-30.4, 0], 1.4, 11.6);
  solid(face, r, 0, 27.2, 'stone');
  gable(face, -30.5, 0, 11.6, 26.8, rec.front.gableTop, 1.3, 'stone');
  for (const p of rec.front.portals) {
    const r = rect([-31.4, p.z], 2.5, p.width + 2.7);
    solid(face, r, 0, p.height - 0.2, 'stone');
    gable(face, -31.5, p.z, p.width + 3.3, p.height - 0.2, p.hood, 2.2, 'stone');
    const h = portals.find((h) => h.center[1] === p.z);
    if (d) {
      archBand(writer(out, d), { ...h, center: [-32.73, p.z] }, d, p.width * 0.14, 'trim', 0.08);
      if (d >= 2)
        for (let i = 1; i < 3; i++)
          archBand(
            writer(out, d),
            {
              ...h,
              center: [-32.78 - i * 0.04, p.z],
              width: h.width + i * 0.42,
              height: h.height + i * 0.32,
              spring: h.spring + i * 0.2,
            },
            d,
            0.14,
            'trim',
            0.08,
          );
    }
    pane(
      writer(out, d),
      {
        ...h,
        center: [-25.3, p.z],
        width: p.width * 0.9,
        height: p.height * 0.86,
        spring: h.spring * 0.86,
      },
      d,
      0.05,
      'door',
    );
  }
  if (d) {
    const h = {
      name: 'central-rose-panel',
      center: [-31.21, 0],
      axis: [0, 1],
      normal: [-1, 0],
      width: 8.2,
      bottom: floor + 15,
      height: 11.2,
      spring: 7.5,
      shape: 'pointed',
      depth: 1,
    };
    pane(writer(out, d), h, d, 0.1);
    archBand(writer(out, d), h, d, 0.45, 'trim', 0.2);
    const f = writer(out, d),
      n = d === 1 ? 12 : d === 2 ? 16 : 24,
      point = (r, a) => [-31.43, floor + 23.1 + r * Math.sin(a), r * Math.cos(a)];
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n;
      f('trim', [point(2.3, a), point(2.5, a), point(2.5, b), point(2.3, b)], [-1, 0, 0]);
    }
    if (d >= 2) {
      for (let i = 0; i < 8; i++)
        beam(f, point(0.25, (i * Math.PI) / 4), point(2.3, (i * Math.PI) / 4), 0.09, 'trim');
      for (const z of [-2.6, -1.3, 0, 1.3, 2.6])
        beam(f, [-31.43, floor + 15.1, z], [-31.43, floor + 21.2, z], 0.1, 'trim');
    }
    for (const z of [-5.75, 5.75]) solid(f, rect([-31.5, z], 0.65, 0.7), 0, 27.1, 'trim');
  }
}
function build(out, d) {
  const portals = rec.front.portals.map((p) => portal(p, d)),
    face = writer(
      openingBuilder(
        out,
        portals.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  for (const p of rec.main.polygons) {
    const r = ring(p.outline, d);
    solid(face, r, footing, 0, 'foundation');
    shell(out, d, r, 0, rec.aisle, portals, 'stone');
    cap(face, r, rec.aisle, 'roofstone');
    if (d) windows(writer(out, d), r, d, 5.7, 6.0, 'aisle', 8.7);
  }
  for (const p of rec.core) {
    const r = ring(p.outline, d);
    solid(face, r, 0, rec.clerestory, 'stone');
    vaultedRoof(face, p, d);
    if (d) {
      band(face, r, rec.clerestory - 0.25, 0.25);
      windows(writer(out, d), r, d, 17.5, 4.4, 'clerestory', 8.7);
    }
  }
  facade(out, d, portals);
  for (const t of rec.towers) tower(out, d, t, portals);
  buttresses(writer(out, d), d);
  minaret(out, d);
  terrace(writer(out, d), d);
}
export const buildLalaSkyline = (out) => build(out, 0);
export const buildLalaDistrict = (out) => build(out, 1);
export const buildLalaStreet = (out) => build(out, 2);
export const buildLalaCloseup = (out) => build(out, 3);
export const lalaStudy = {
  id: 'N0333',
  key: 'lala_mustafa_pasha_mosque',
  title: 'Lala Mustafa Pasha Mosque',
  category: 'cathedral',
  wikidataId: 'Q2047700',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual current Lala Mustafa Pasha mosque exterior with three Gothic west portal hoods, central pointed rose panel, open upper western tower shells, northern minaret, low vaulted nave/aisles/rounded apse, flying buttresses, closed doors and approximate raised terrace/side steps.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID outline and current unioned parent35184403834936 preserve the full61x30m plan and rounded eastern apse. No tagged height or roof/tower parts.',
    architecturalHeights: rec.heightBasis,
    retainedSiteElevation:
      'Old OSM ele21m retained as a site tag; coarse currentDEM10.9117m is not a surveyed floor.',
  },
  reconstruction: rec,
  scaleBasis:
    'Full mapped mosque envelope with picture-led original façade, tower, minaret, vault and flying-buttress estimates. No surveyed vertical dimensions.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared 256-square sandstone/slate/raw-stone/bronze/wood graphs use metric UVs and linear tints. Sandstone spans wall/trim/roof roles; glazing uses vertex colors. No embedded images.',
  importReason:
    'Four independently authored browser levels preserve the recognizable west Gothic front, northern minaret, long low vault and flying buttresses at the mapped site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Exact damage outlines, stone tracery, sculpture, lettering, full interiors, surrounding precinct and temporary restoration scaffolding excluded. Doors are closed and surfaces do not certify pedestrian collision. Physical laptop/phone timing remains pending.',
    'Skyline preserves closed tower/gable/minaret/vault silhouettes and simplified buttress connections; district restores front upper openings and shared textures; street restores additional tower openings, curved flying arches and principal rose/portal trim; closeup refines curve segments, pinnacles, terrace and balcony. LOD detail changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'three-west-portals-and-central-rose',
      position: [-84, 28, 4],
      lookAt: [-29, 19, 0],
      fov: 43,
    },
    { name: 'open-west-tower-shells', position: [-47, 48, 32], lookAt: [-26, 29, 3], fov: 43 },
    {
      name: 'northern-minaret-and-balcony',
      position: [-42, 49, -36],
      lookAt: [-26, 32, -13],
      fov: 43,
    },
    { name: 'south-aisle-and-flying-arches', position: [2, 31, 54], lookAt: [-2, 17, 11], fov: 43 },
    {
      name: 'low-vault-and-rounded-eastern-apse',
      position: [58, 41, 30],
      lookAt: [17, 18, 2],
      fov: 43,
    },
    {
      name: 'west-terrace-and-south-steps',
      position: [-55, 13, 39],
      lookAt: [-37, 4, 12],
      fov: 43,
    },
  ],
};

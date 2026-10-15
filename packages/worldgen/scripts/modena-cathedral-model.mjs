/** Modena Cathedral and Ghirlandina: rose, galleries, three apses and tiered belfry. */
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
  '../../../content/worldgen/source/places/sp/spz/n0342_modena_cathedral/',
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
  stone: '#dfd5bf',
  pink: '#c29c8b',
  trim: '#eee5d1',
  roof: '#b67d59',
  foundation: '#b2a68c',
  door: '#6c513b',
  glass: '#4d6178',
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
const footing = (p) => Math.min(floor - 0.3, modenaGround(...p) - 0.35);
export function modenaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Modena Cathedral footing outside retained terrain');
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
  return (slot, p, direction, colorOverride) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction) {
      for (let i = 1; i < p.length - 1; i++) {
        const n = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...n) < 0.5) continue;
        if (n.reduce((sum, v, k) => sum + v * direction[k], 0) < 0) p = p.toReversed();
        break;
      }
    }
    const tint = colorOverride ?? colors[slot];
    const color = d === 0 ? tint.map((v, k) => v * means[slot][k]) : tint;
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
function masked(out, holes) {
  const boxes = holes.map((h) => {
    if (h.bounds) return h.bounds;
    const p = h.ring.flatMap((q) => [h.point(...q, -h.depth / 2), h.point(...q, h.depth / 2)]);
    return [0, 1, 2].map((k) => [Math.min(...p.map((p) => p[k])), Math.max(...p.map((p) => p[k]))]);
  });
  return {
    addTriangle(...args) {
      const p = args[2],
        box = [0, 1, 2].map((k) => [
          Math.min(...p.map((p) => p[k])),
          Math.max(...p.map((p) => p[k])),
        ]);
      const near = holes.filter((_, i) =>
        boxes[i].every((b, k) => b[0] <= box[k][1] + 1e-6 && b[1] >= box[k][0] - 1e-6),
      );
      if (near.length) openingBuilder(out, near).addTriangle(...args);
      else out.addTriangle(...args);
    },
  };
}
function shell(out, d, r, b, t, holes = [], slot = 'stone', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
    face = writer(masked(out, hs), d);
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
const ring = (r, d) => simplify(r, d ? 0.035 : 0.23),
  dot2 = (p, a) => p[0] * a[0] + p[1] * a[1];
function clip(r, axis, value, greater) {
  const result = [];
  let a = r.at(-1),
    av = dot2(a, axis) - value;
  for (const b of r) {
    const bv = dot2(b, axis) - value;
    if (av >= 0 !== bv >= 0) {
      const t = av / (av - bv);
      result.push(lerp(a, b, t));
    }
    if (greater ? bv >= 0 : bv <= 0) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
function roof(face, r, axis, eave, top, slot = 'roof', lean) {
  const cross = [-axis[1], axis[0]],
    vs = r.map((p) => dot2(p, cross)),
    lo = Math.min(...vs),
    hi = Math.max(...vs),
    mid = lean === 'high' ? hi : lean === 'low' ? lo : (lo + hi) / 2,
    y = (p) =>
      eave + (top - eave) * (1 - Math.abs((dot2(p, cross) - mid) / ((hi - lo) / (lean ? 1 : 2))));
  for (const greater of lean ? [true] : [false, true]) {
    const q = lean ? r : clip(r, cross, mid, greater);
    if (q.length >= 3) cap(face, q, (p) => floor + y(p), slot);
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      pts = [
        a,
        ...((dot2(a, cross) - mid) * (dot2(b, cross) - mid) < 0
          ? [lerp(a, b, (mid - dot2(a, cross)) / (dot2(b, cross) - dot2(a, cross)))]
          : []),
        b,
      ];
    for (let j = 1; j < pts.length; j++) {
      const p = pts[j - 1],
        q = pts[j];
      face(
        'stone',
        [at(p, eave), at(q, eave), at(q, y(q)), at(p, y(p))],
        [(b[1] - a[1]) * sign(r), 0, (a[0] - b[0]) * sign(r)],
      );
    }
  }
}
const hole = (
  name,
  p,
  axis,
  normal,
  width,
  bottom,
  height,
  spring = height,
  shape = 'rect',
  depth = 2.2,
) => ({
  name,
  center: p,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape,
  depth,
});
export const modenaPortals = () => [
  hole('west-main', [-32.94, -1.1], [0, 1], [-1, 0], 3.3, 0.1, 6.3, 4.65, 'round', 3.5),
  hole('west-north', [-32.94, -10], [0, 1], [-1, 0], 2.1, 0.1, 4.3, 3.2, 'round', 3.5),
  hole('west-south', [-32.94, 7.7], [0, 1], [-1, 0], 2.1, 0.1, 4.3, 3.2, 'round', 3.5),
  hole('south-porta-regia', [6.1, 11.65], [1, 0], [0, 1], 3.1, 0.1, 5.5, 3.95, 'round', 3.5),
];
export function modenaRose(d = 3) {
  const p = [-32.94, -1.1],
    cy = floor + 17.25,
    r = 3.65,
    n = d >= 3 ? 32 : d >= 2 ? 24 : 16,
    axis = [0, 1],
    normal = [-1, 0],
    point = (u, v, off) => [p[0] - off, cy + v, p[1] + u],
    q = Array.from({ length: n }, (_, i) => [
      r * Math.cos((i * 2 * Math.PI) / n),
      r * Math.sin((i * 2 * Math.PI) / n),
    ]),
    planes = [
      [-1, 0, 0, 2 + p[0]],
      [1, 0, 0, 2 - p[0]],
    ];
  for (let i = 0; i < n; i++) {
    const a = q[i],
      b = q[(i + 1) % n],
      du = b[0] - a[0],
      dv = b[1] - a[1];
    planes.push([0, du, -dv, dv * a[0] - du * a[1] - du * cy + dv * p[1]]);
  }
  return {
    planes,
    point,
    ring: q,
    r,
    axis,
    normal,
    bounds: [
      [p[0] - 2, p[0] + 2],
      [cy - r, cy + r],
      [p[1] - r - 1, p[1] + r + 1],
    ],
  };
}
function rosette(face, d) {
  const h = modenaRose(d);
  face(
    'glass',
    h.ring.map((p) => h.point(...p, d ? -0.85 : 0.03)),
    [-1, 0, 0],
  );
  if (!d) return;
  for (const [r0, r1, off] of [
    [h.r, h.r + 0.35, 0.18],
    [h.r + 0.4, h.r + 0.7, 0.04],
  ])
    for (let i = 0; i < h.ring.length; i++) {
      const j = (i + 1) % h.ring.length,
        a = h.ring[i],
        b = h.ring[j],
        pt = (p, r, off) => h.point((p[0] * r) / h.r, (p[1] * r) / h.r, off);
      face('trim', [pt(a, r0, off), pt(b, r0, off), pt(b, r1, off), pt(a, r1, off)], [-1, 0, 0]);
      if (r0 === h.r)
        face('trim', [pt(a, r0, off), pt(b, r0, off), pt(b, r0, -0.8), pt(a, r0, -0.8)]);
    }
  const n = d >= 3 ? 24 : d >= 2 ? 16 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    beam(
      face,
      h.point(0.62 * Math.cos(a), 0.62 * Math.sin(a), 0.2),
      h.point((h.r - 0.12) * Math.cos(a), (h.r - 0.12) * Math.sin(a), 0.2),
      d >= 3 ? 0.105 : 0.14,
      'trim',
    );
  }
  for (let i = 0; i < h.ring.length; i++) {
    const j = (i + 1) % h.ring.length;
    face(
      'trim',
      [
        h.point((h.ring[i][0] * 0.62) / h.r, (h.ring[i][1] * 0.62) / h.r, 0.2),
        h.point((h.ring[j][0] * 0.62) / h.r, (h.ring[j][1] * 0.62) / h.r, 0.2),
        h.point((h.ring[j][0] * 0.82) / h.r, (h.ring[j][1] * 0.82) / h.r, 0.2),
        h.point((h.ring[i][0] * 0.82) / h.r, (h.ring[i][1] * 0.82) / h.r, 0.2),
      ],
      [-1, 0, 0],
    );
  }
}
function column(face, p, r, b, t, d, slot = 'trim') {
  solid(face, regular(p, r, d >= 3 ? 10 : 6), b, t, slot);
  if (d >= 3) {
    solid(face, rect(p, r * 2.8, r * 2.8), b - 0.1, b + 0.2, slot);
    profile(
      face,
      rect(p, r * 2, r * 2),
      [
        [t - 0.1, 1],
        [t + 0.25, 1.6],
      ],
      slot,
    );
  }
}
function window(face, h, d, actual = false, slot = 'glass') {
  pane(face, h, d, actual ? -0.32 : 0.04, slot);
  if (d >= 2) archBand(face, h, d, 0.14, 'trim', 0.08);
}
function gallery(face, p, axis, normal, width, bottom, d) {
  if (!d) return;
  const n = d >= 2 ? 3 : 1,
    w = (width - 0.5) / n;
  for (let i = 0; i < n; i++) {
    const q = p.map((v, k) => v + axis[k] * ((i - (n - 1) / 2) * (w + 0.12)));
    window(
      face,
      hole('blind-gallery', q, axis, normal, w - 0.12, bottom, 2.6, 1.7, 'round'),
      d,
      false,
      'door',
    );
    if (d >= 2 && i < n - 1)
      column(
        face,
        q.map((v, k) => v + (axis[k] * (w + 0.12)) / 2 + normal[k] * 0.12),
        0.13,
        bottom,
        bottom + 1.6,
        d,
      );
  }
  archBand(
    face,
    hole('gallery-surround', p, axis, normal, width, bottom - 0.25, 4.1, 2.3, 'round'),
    d,
    0.2,
    'trim',
    0.1,
  );
}
function church(out, face, d) {
  const r = ring(rec.main.polygons[0].outline, d),
    portals = modenaPortals(),
    cut = d ? masked(out, [modenaRose(d)]) : out,
    wall = writer(cut, d);
  sides(face, r, footing, 0, 'foundation');
  cap(face, r, 0, 'foundation');
  // Apses and the projecting south portico have separate lower profiles.
  const lower = clip(clip(r, [1, 0], 28, false), [0, 1], 11.7, false);
  shell(cut, d, lower, 0, 10.6, d ? portals : [], 'stone');
  for (const t of rec.roofs) {
    if (t.name === 'south-porta-regia') continue;
    const q = ring(t.outline, d);
    shell(cut, d, q, 0, t.eave, d ? portals : [], 'stone');
    roof(
      wall,
      q,
      t.axis,
      t.eave,
      t.top,
      'roof',
      t.name === 'north-aisle' ? 'high' : t.name === 'south-aisle' ? 'low' : undefined,
    );
  }
  for (const a of rec.apses) {
    const q = ring(a.outline, d),
      p = center(q),
      base = [Math.min(...q.map((p) => p[0])), -1.1];
    sides(face, q, 0, a.eave, 'stone');
    for (let i = 0; i < q.length; i++) {
      const A = q[i],
        B = q[(i + 1) % q.length];
      if (A[0] < 28.1 && B[0] < 28.1) continue;
      face('trim', [at(A, a.eave), at(B, a.eave), at([base[0], p[1]], a.top)], [0, 1, 0]);
    }
    if (d)
      for (let i = 0; i < q.length; i++) {
        const f = faceFrame(q, i);
        if (f.normal[0] < 0.1 || f.length < 1.3) continue;
        if (d >= 2)
          column(
            face,
            f.a.map((v, k) => v + f.normal[k] * 0.1),
            0.14,
            1,
            a.eave - 0.25,
            d,
          );
        window(
          face,
          hole('apse-window', lerp(f.a, f.b, 0.5), f.axis, f.normal, 0.75, 5, 3.1, 2.5, 'round'),
          d,
        );
      }
    if (d) band(face, q, a.eave - 0.35, 0.25, 'trim', 1.015);
  }
  if (d) {
    for (const h of portals) {
      pane(face, h, d, -1.25, 'door');
      archBand(face, h, d, 0.45, h.name === 'south-porta-regia' ? 'pink' : 'trim', 0.1);
      if (d >= 2) archBand(face, h, d, 0.22, 'trim', 0.33);
    }
    for (const z of [-11, -6, 3.8, 8.5]) gallery(face, [-32.98, z], [0, 1], [-1, 0], 3.8, 8.6, d);
    for (const side of [-1, 1])
      for (const x of [-27, -15, -3, 9, 21]) {
        const z = side < 0 ? -13.85 : 11.65;
        gallery(face, [x, z], [1, 0], [0, side], 8.5, 8.4, d);
        if (d >= 2) solid(face, rect([x - 5.2, z + side * 0.15], 0.55, 0.65), 0, 15.2, 'trim');
      }
    for (const side of [-1, 1])
      for (const x of [-27, -15, -3, 9, 21])
        window(
          face,
          hole(
            'clerestory',
            [x, side < 0 ? -6 : 3.85],
            [1, 0],
            [0, side],
            1.25,
            16.9,
            2.4,
            1.65,
            'round',
          ),
          d,
        );
  }
  for (const t of rec.turrets) {
    const p = center(t.outline),
      q = regular(p, 0.98, d ? 8 : 4, Math.PI / 8),
      b = t.top > 27 ? 18.5 : 19.9;
    solid(face, q, b, t.top - 3.2, 'stone');
    if (d >= 2) {
      const inner = scaled(q, 0.68);
      shell(
        out,
        d,
        q,
        t.top - 3.2,
        t.top - 1.1,
        q.map((_a, i) => {
          const f = faceFrame(q, i);
          return hole(
            'roof-turret',
            lerp(f.a, f.b, 0.5),
            f.axis,
            f.normal,
            0.48,
            t.top - 3.02,
            1.55,
            1.1,
            'round',
            1.5,
          );
        }),
        'trim',
        inner,
      );
    } else solid(face, q, t.top - 3.2, t.top - 1.1, 'trim');
    profile(
      face,
      q,
      [
        [t.top - 1.1, 1.1],
        [t.top, 0],
      ],
      'trim',
    );
  }
  if (d >= 2) {
    for (const x of [-32.65, -20.9, -8.95, 2.95]) {
      const q = rect([x, -1.1], 0.55, 9.9);
      roof(face, q, [1, 0], 19.9, 22.4, 'trim');
    }
    for (const z of [-6, 3.85]) solid(face, rect([-32.7, z], 0.7, 0.7), 0, 23, 'trim');
  }
  rosette(face, d);
}
export function modenaPorchArches() {
  return [
    hole('west-lower-protiro', [-36.05, -1.1], [0, 1], [-1, 0], 4.2, 0.25, 6.55, 4.1, 'round', 1.6),
    hole('west-upper-protiro', [-36.05, -1.1], [0, 1], [-1, 0], 4.2, 7.35, 4.6, 2.8, 'round', 1.6),
    hole('south-lower-portico', [6.1, 13.85], [1, 0], [0, 1], 5.5, 0.25, 6.65, 4.1, 'round', 1.6),
    ...[-1, 0, 1].map((i) =>
      hole(
        `south-upper-loggia-${i}`,
        [6.1 + i * 1.75, 13.85],
        [1, 0],
        [0, 1],
        1.5,
        8.2,
        2.6,
        1.75,
        'round',
        1.6,
      ),
    ),
  ];
}
function porches(out, face, d) {
  if (!d) return;
  const hs = modenaPorchArches();
  for (const [name, p, w, dep, b, t] of [
    ['west-lower', [-35.8, -1.1], 0.5, 5.7, 0, 7],
    ['west-upper', [-35.8, -1.1], 0.5, 5.7, 7.2, 12.4],
    ['south-lower', [6.1, 13.6], 7.0, 0.5, 0, 7],
    ['south-upper', [6.1, 13.6], 7.0, 0.5, 7.8, 11.3],
  ]) {
    const slot = name.startsWith('south') ? 'pink' : 'trim',
      holes = hs.filter((h) =>
        h.name.startsWith(
          name.startsWith('west')
            ? `${name}-protiro`
            : name === 'south-lower'
              ? 'south-lower-portico'
              : 'south-upper-loggia',
        ),
      );
    shell(out, d, rect(p, w, dep), b, t, holes, slot);
    cap(face, rect(p, w, dep), t, slot);
  }
  for (const [x, z] of [
    [-34.4, -3.75],
    [-34.4, 1.55],
  ]) {
    solid(face, rect([x, z], 3.3, 0.4), 6.7, 7.2, 'trim');
    solid(face, rect([x, z], 3.3, 0.4), 12.2, 12.4, 'trim');
  }
  roof(face, rect([-34.5, -1.1], 3.3, 5.8), [1, 0], 12.4, 13.7, 'trim');
  const t = rec.roofs.find((t) => t.name === 'south-porta-regia');
  roof(face, t.outline, t.axis, t.eave, t.top, 'roof');
  if (d >= 2) {
    for (const z of [-3.5, 1.3]) column(face, [-36, z], 0.25, 0.3, 4.1, d);
    for (const x of [3.2, 9]) column(face, [x, 13.8], 0.3, 0.3, 4.1, d, 'pink');
  }
}
const towerRing = (d) => ring(rec.tower.polygons[0].outline, d),
  towerCenter = center(towerRing(0)),
  octagon = regular(towerCenter, 4.1, 8, Math.PI / 8);
export function modenaBelfry(d = 3) {
  const a = [],
    r = towerRing(0);
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 7) continue;
    for (const [y, n, w, h] of [
      [29, 2, 1.35, 3.6],
      [38, 3, 1.3, 3.8],
      [49, 3, 1.55, 4.6],
    ])
      for (let j = 0; j < n; j++)
        a.push(
          hole(
            `square-belfry-${i}-${y}-${j}`,
            lerp(f.a, f.b, 0.5).map((v, k) => v + f.axis[k] * (j - (n - 1) / 2) * (w + 0.35)),
            f.axis,
            f.normal,
            w,
            y,
            h,
            h - w * 0.5,
            'round',
            3.8,
          ),
        );
  }
  if (d >= 2)
    for (let i = 0; i < 8; i++) {
      const f = faceFrame(octagon, i);
      a.push(
        hole(
          `octagonal-belfry-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          1.6,
          59.1,
          4.5,
          3.6,
          'round',
          3,
        ),
      );
    }
  return a;
}
export const modenaConnection = () =>
  hole('tower-connecting-arch', [20.7, -15.65], [0, 1], [1, 0], 3.25, 0.2, 7.4, 5.3, 'round', 5);
function campanile(out, face, d) {
  const r = towerRing(d),
    p = towerCenter,
    hs = modenaBelfry(d);
  sides(face, r, footing, 0, 'foundation');
  if (d >= 2) {
    shell(
      out,
      d,
      r,
      0,
      57,
      hs.filter((h) => h.name.startsWith('square')),
      'stone',
      scaled(r, 0.73),
    );
    cap(face, r, 47.5, 'stone');
    shell(
      out,
      d,
      octagon,
      57,
      65.5,
      hs.filter((h) => h.name.startsWith('octagonal')),
      'trim',
      scaled(octagon, 0.7),
    );
    cap(face, octagon, 57, 'stone');
  } else {
    solid(face, r, 0, 57, 'stone');
    solid(face, octagon, 57, 65.5, 'trim');
    if (d) for (const h of hs) window(face, h, d);
  }
  for (const y of [14, 25, 35, 46.9, 56.7]) {
    profile(
      face,
      r,
      [
        [y, 1],
        [y + 0.3, 1.04],
        [y + 0.6, 1.04],
      ],
      'trim',
    );
  }
  profile(
    face,
    octagon,
    [
      [65.5, 1],
      [66, 1.1],
      [66.4, 1.1],
    ],
    'trim',
  );
  profile(
    face,
    octagon,
    [
      [66.4, 1.02],
      [85, 0],
    ],
    'trim',
  );
  if (d >= 2) {
    for (const h of hs) archBand(face, h, d, 0.17, 'trim', 0.06);
    for (const q of octagon) solid(face, regular(q, 0.16, 6), 65.2, 67, 'trim');
  }
  const bridge = rect([20.7, -15.65], 3.1, 4.7),
    h = modenaConnection();
  shell(out, d, bridge, 0, 10.3, d ? [h] : [], 'stone');
  roof(face, bridge, [0, 1], 10.3, 11.4, 'roof');
  if (d >= 3) {
    for (const y of [3.5, 8.5, 19]) {
      const f = faceFrame(r, 0);
      window(face, hole('tower-slit', lerp(f.a, f.b, 0.5), f.axis, f.normal, 0.48, y, 1.35), d);
    }
    beam(face, at(p, 84.6), at(p, 85), 0.08, 'trim');
  }
}
function build(out, d) {
  const stable = {
      addTriangle(slot, ref, points, n, uv, color) {
        const p = points.map((v) => v.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-9
        )
          return;
        out.addTriangle(slot, ref, p, n, uv, color);
      },
    },
    face = writer(stable, d);
  church(stable, face, d);
  porches(stable, face, d);
  campanile(stable, face, d);
}
export const buildModenaSkyline = (o) => build(o, 0),
  buildModenaDistrict = (o) => build(o, 1),
  buildModenaStreet = (o) => build(o, 2),
  buildModenaCloseup = (o) => build(o, 3);
export const modenaStudy = {
  id: 'N0342',
  key: 'modena_cathedral',
  title: 'Modena Cathedral',
  category: 'cathedral',
  wikidataId: 'Q753721',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Modena Cathedral/Ghirlandina: recessed spoke rose,stepped west gables/three-arch gallery bays,pilasters,two-tier west porch,pink southern Porta Regia,three conical eastern apses,four roof turrets,red-tiled raised nave/aisles and tall tiered square/octagonal belfry/stone spire.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way548995705 and22 current PMTiles church/tower parent/part controls; signed west rose/triple eastern apse/southern porch.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Approximately66x28m cathedral and separate mapped10.4m-square Ghirlandina. Current map controls vertical stages; eaves,porches,galleries and spire transitions are picture-led interpretations.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing256-square raw/weathered limestone,ceramic tile and wood graphs across seven roles; selected pink architectural trim shares limestone through linear vertex tints. Metric UVs,flat glass,no embedded images.',
  importReason:
    'Four authored levels retain unique cathedral rose/porches/three apses and Ghirlandina at signed Modena placement.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Selected gallery bays are shallow pane/arch/column representations rather than fully excavated interiors. Rose spokes,porches,roof turrets,pink trim and connecting arch are approximate. Exact lions,sculpture/reliefs,full interiors,adjacent town/square and certified walking excluded. Physical phone/laptop timings pending.',
    'Skyline omits portals/gallery/porch details and uses solid tower masses/mean-tinted roofs. District adds textures,rose/recessed closed portals,actual porch/connecting arches and simplified flat belfry/grouped bays. Street adds actual square/octagonal belfry cuts,selected gallery columns/pilasters,roof bands and turret openings. Closeup refines arch segmentation,rose spokes and columns. Detail/profile changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'stepped-west-front-and-large-rose',
      position: [-91, 31, 6],
      lookAt: [-32, 13, -1],
      fov: 43,
    },
    {
      name: 'two-tier-western-protiro',
      position: [-51, 10, 2],
      lookAt: [-34.6, 7.6, -1.1],
      fov: 48,
    },
    {
      name: 'pink-porta-regia-and-south-gallery',
      position: [-2, 20, 45],
      lookAt: [6.1, 8.5, 11.65],
      fov: 48,
    },
    { name: 'three-apses-and-roof-turrets', position: [76, 32, 30], lookAt: [25, 14, -1], fov: 43 },
    {
      name: 'ghirlandina-tiered-belfry-and-spire',
      position: [-30, 83, -87],
      lookAt: [20, 57, -23],
      fov: 43,
    },
    {
      name: 'north-aisle-and-tower-connecting-arch',
      position: [-16, 25, -66],
      lookAt: [10, 12, -13],
      fov: 48,
    },
  ],
};

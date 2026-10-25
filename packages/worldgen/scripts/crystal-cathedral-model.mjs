/** Crystal Cathedral: folded shared glazing shell and detached open pointed-steel spire. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingShape as baseOpeningShape,
  prepareOpening as basePrepareOpening,
  openingBuilder,
  openingReveals,
} from './authored-wall-openings.mjs';

const openingShape = (h, d) =>
  h.shape === 'circle'
    ? Array.from({ length: d <= 1 ? 8 : 16 }, (_, i) => {
        const a = (i * Math.PI * 2) / (d <= 1 ? 8 : 16);
        return [
          (Math.cos(a) * h.width) / 2,
          h.bottom + h.height / 2 + (Math.sin(a) * h.height) / 2,
        ];
      })
    : baseOpeningShape(h, d);
function prepareOpening(h, b, d) {
  const v = basePrepareOpening(h, b, d);
  if (h.shape !== 'circle') return v;
  const ring = openingShape(h, d),
    axis = v.axis,
    normal = v.normal,
    centerN = h.center[0] * normal[0] + h.center[1] * normal[1],
    planes = [
      [normal[0], 0, normal[1], h.depth / 2 - centerN],
      [-normal[0], 0, -normal[1], h.depth / 2 + centerN],
    ];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      q = ring[(i + 1) % ring.length],
      du = q[0] - a[0],
      dv = q[1] - a[1];
    planes.push([
      -dv * axis[0],
      du,
      -dv * axis[1],
      dv * (h.center[0] * axis[0] + h.center[1] * axis[1] + a[0]) - du * (b + a[1]),
    ]);
  }
  return { ...v, ring, planes };
}
const source = new URL(
  '../../../content/worldgen/source/places/9q/9qh/crystal_cathedral/',
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
  glass: '#b2cad9',
  steel: '#bbc5cb',
  frame: '#c2cdd0',
  concrete: '#d4cebc',
  accent: '#bdb17c',
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
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, crystalCathedralGround(...p) - 0.35);
export function crystalCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Crystal Cathedral footing outside retained terrain');
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
    const _normal = direction ?? normalFor(p[0], p[1], p[2]);
    const tint = colorOverride ?? colors[slot];
    // Shared window-slot materials render untinted; match their mean at skyline distance.
    const color =
      d === 0 ? (slot === 'glass' ? means.glass : tint.map((v, k) => v * means[slot][k])) : tint;
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
        height: h.height + w * 2,
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
function shell(out, d, r, b, t, holes = [], slot = 'wall', inner = null) {
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
const _band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
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
const coarse = (r) => {
  r = r.map((p) => [...p]);
  let changed = true;
  while (changed && r.length > 4) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i + r.length - 1) % r.length],
        b = r[i],
        c = r[(i + 1) % r.length],
        dx = c[0] - a[0],
        dz = c[1] - a[1],
        t = ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (dx * dx + dz * dz);
      // Current tile quantization creates tiny overshooting spikes on the porch edge.
      if (t >= -0.05 && t <= 1.05 && Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz) < 1.4) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
};
function _gable(face, r, eave, top, slot = 'roof', axis = 0) {
  const rr = coarse(r);
  if (rr.length === 4) {
    const caps = [edge(rr, axis === 0 ? [-1, 0] : [0, -1]), edge(rr, axis === 0 ? [1, 0] : [0, 1])],
      ridge = caps.map((f) => lerp(f.a, f.b, 0.5)),
      nearest = (p) => (p === caps[0].a || p === caps[0].b ? ridge[0] : ridge[1]);
    for (let i = 0; i < rr.length; i++) {
      const f = faceFrame(rr, i);
      if (Math.abs(f.normal[axis]) > 0.65) continue;
      face(
        slot,
        [at(f.a, eave), at(f.b, eave), at(nearest(f.b), top), at(nearest(f.a), top)],
        [0, 1, 0],
      );
    }
    for (let i = 0; i < 2; i++) {
      const f = caps[i];
      face(
        'wall',
        [at(f.a, eave), at(f.b, eave), at(ridge[i], top)],
        [f.normal[0], 0, f.normal[1]],
      );
    }
    return;
  }
  hip(face, r, eave, top, slot, axis);
}
function hip(face, r, eave, top, slot = 'roof', axis = 0) {
  const k = 1 - axis,
    vs = r.map((p) => p[k]),
    xs = r.map((p) => p[axis]),
    mid = (Math.min(...vs) + Math.max(...vs)) / 2,
    rad = (Math.max(...vs) - Math.min(...vs)) / 2,
    lo = Math.min(...xs) + rad,
    hi = Math.max(...xs) - rad,
    point = (p) => {
      const q = [...p];
      q[k] = mid;
      q[axis] = lo <= hi ? Math.max(lo, Math.min(hi, p[axis])) : (lo + hi) / 2;
      return q;
    };
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(
      slot,
      [at(r[i], eave), at(r[j], eave), at(point(r[j]), top), at(point(r[i]), top)],
      [0, 1, 0],
    );
  }
}
const hole = (name, p, a, n, w, b, h, s = h, shape = 'pointed', depth = 5) => ({
  name,
  center: p,
  axis: a,
  normal: n,
  width: w,
  bottom: floor + b,
  height: h,
  spring: s,
  shape,
  depth,
});
const edge = (r, n) =>
  r
    .map((_, i) => faceFrame(r, i))
    .filter((f) => f.normal[0] * n[0] + f.normal[1] * n[1] > 0.65)
    .sort((a, b) => b.length - a.length)[0];
function profile(face, ring, levels, slot) {
  const origin = center(ring);
  let prev = scaled(ring, levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const r = scaled(ring, levels[i][1]);
    for (let k = 0; k < r.length; k++) {
      const j = (k + 1) % r.length;
      face(
        slot,
        [
          at(prev[k], levels[i - 1][0]),
          at(prev[j], levels[i - 1][0]),
          at(r[j], levels[i][0]),
          at(r[k], levels[i][0]),
        ],
        [(prev[k][0] + prev[j][0]) / 2 - origin[0], 0, (prev[k][1] + prev[j][1]) / 2 - origin[1]],
      );
    }
    prev = r;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
function _panel(face, h, d) {
  const sd = d === 2 ? 1 : d;
  pane(face, h, sd, d >= 2 ? -0.75 : 0.07, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, sd, 0.35, 'trim', 0.09);
  if (h.kind === 'door') archBand(face, h, sd, 0.7, 'trim', 0.14);
  const p = prepareOpening(h, 0, sd),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (h.kind === 'door') {
    beam(
      face,
      p.point(0, h.bottom, -0.68 * sg),
      p.point(0, h.bottom + h.spring, -0.68 * sg),
      0.12,
      'accent',
    );
    return;
  }
  if (h.spring > 0)
    for (const u of [-0.22, 0.22])
      beam(
        face,
        p.point(h.width * u, h.bottom, -0.66 * sg),
        p.point(h.width * u, h.bottom + h.spring, -0.66 * sg),
        0.11,
        'trim',
      );
  if (d >= 3 && h.shape === 'round') {
    for (const a of [Math.PI / 6, Math.PI / 2, (Math.PI * 5) / 6]) {
      const r = h.width / 2;
      beam(
        face,
        p.point(0, h.bottom + Math.max(0, h.spring - 0.1), -0.64 * sg),
        p.point(Math.cos(a) * r * 0.85, h.bottom + h.spring + Math.sin(a) * r * 0.85, -0.64 * sg),
        0.11,
        'trim',
      );
    }
  }
}

const e = rec.estimated,
  main = rec.main.polygons[0].outline,
  star = e.star,
  spire = rec.plans.spire[0].outline;
const _R = (a, b, x, z) => [
  [a, b],
  [x, b],
  [x, z],
  [a, z],
];
const circle = (p, r, n, off = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos(off + (i * Math.PI * 2) / n) * r,
    p[1] + Math.sin(off + (i * Math.PI * 2) / n) * r,
  ]);
const sp = (u, v) => e.spireCenter.map((p, k) => p + e.spireU[k] * u + e.spireV[k] * v);
const roofPoint = (p, h) => at(p, h);
function entry(name, a, b, width) {
  const axis = unit(b.map((v, k) => v - a[k])),
    normal = [axis[1] * sign(main), -axis[0] * sign(main)];
  return {
    ...hole(name, lerp(a, b, 0.5), axis, normal, width, 0.4, 2.7, 2.7, 'rect', 4),
    kind: 'door',
  };
}
function entries() {
  return [
    entry('mapped-notch-entry', main[6], main[7], 2.05),
    entry('estimated-south-canopy-entry', star[1], lerp(star[1], star[2], 0.55), 6.2),
  ];
}
export const crystalCathedralEntries = entries;
function pavilionDoor() {
  const theta = Math.atan2(e.spireU[1], e.spireU[0]),
    p = e.spireCenter,
    r = 2.4 * Math.cos(Math.PI / 8),
    center = [p[0] + Math.cos(theta) * r, p[1] + Math.sin(theta) * r];
  return hole(
    'spire-pavilion-door',
    center,
    [-Math.sin(theta), Math.cos(theta)],
    [Math.cos(theta), Math.sin(theta)],
    1.3,
    0.4,
    2.65,
    2.65,
    'rect',
    3,
  );
}
export const crystalCathedralPavilionDoor = pavilionDoor;
function bandedWall(out, d, r, heights, holes = []) {
  const hs = holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
    face = writer(masked(out, hs), d);
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length,
      f = faceFrame(r, i);
    face(
      'glass',
      [at(r[i], 0.4), at(r[j], 0.4), at(r[j], heights[j]), at(r[i], heights[i])],
      [f.normal[0], 0, f.normal[1]],
    );
  }
  for (const h of hs)
    openingReveals(
      {
        addTriangle(_s, ref, p, n, uv, col) {
          out.addTriangle('frame', ref, p, n, uv, col);
        },
      },
      r,
      () => floor + 0.4,
      () => floor + 40,
      [h],
      d === 0 ? colors.frame.map((v, k) => v * means.frame[k]) : colors.frame,
    );
}
function portal(face, h, d) {
  pane(face, h, d === 2 ? 1 : d, -0.75, 'glass');
  if (d > 0) {
    archBand(face, h, d === 2 ? 1 : d, 0.18, 'frame', 0.05);
    const p = prepareOpening(h, 0, d === 2 ? 1 : d),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    for (const u of h.width > 3 ? [-0.25, 0, 0.25] : [0])
      beam(
        face,
        p.point(h.width * u, h.bottom, -0.67 * sg),
        p.point(h.width * u, h.bottom + h.height, -0.67 * sg),
        0.08,
        'frame',
      );
  }
}
function canopy(face, h, d) {
  const ax = h.axis,
    no = h.normal,
    point = (u, v) => h.center.map((p, k) => p + ax[k] * u + no[k] * v),
    w = h.width / 2 + 0.8;
  const ring = [point(-w, -0.2), point(w, -0.2), point(w, 2.4), point(-w, 2.4)];
  solid(face, ring, footing, 0.4, 'concrete');
  sides(face, ring, 3.2, 3.55, 'concrete');
  cap(face, ring, 3.55, 'concrete');
  face(
    'concrete',
    ring.map((p) => at(p, 3.2)),
    [0, -1, 0],
  );
  for (const u of [-w + 0.2, w - 0.2])
    beam(face, at(point(u, 2.1), 0.4), at(point(u, 2.1), 3.2), d === 0 ? 0.3 : 0.22, 'concrete');
  if (d >= 2) beam(face, at(point(-w, 2.4), 3.19), at(point(w, 2.4), 3.19), 0.1, 'frame');
}
function roofGrid(face, a, b, c, step, width) {
  const count = Math.max(
    2,
    Math.ceil(
      Math.max(Math.hypot(...b.map((v, k) => v - a[k])), Math.hypot(...c.map((v, k) => v - a[k]))) /
        step,
    ),
  );
  for (let i = 1; i < count; i++) {
    const t = i / count,
      lo = lerp(a, b, t),
      hi = lerp(a, c, t);
    beam(
      face,
      lo.map((v, k) => v + (k === 1 ? 0.055 : 0)),
      hi.map((v, k) => v + (k === 1 ? 0.055 : 0)),
      width,
      'frame',
    );
  }
}
function blade(face, p, base, tip, w, d) {
  const r = [
    [-w / 2, -0.35],
    [w / 2, -0.35],
    [0, 0.35],
  ].map(([u, v]) => p.map((n, k) => n + e.spireU[k] * u + e.spireV[k] * v));
  solid(face, r, base, tip - 2.7, 'steel');
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    face(
      'steel',
      [at(r[i], tip - 2.7), at(r[j], tip - 2.7), at(p, tip)],
      [(r[i][0] + r[j][0]) / 2 - p[0], 0, (r[i][1] + r[j][1]) / 2 - p[1]],
    );
  }
  if (d >= 3)
    for (const y of [28, 39, 50])
      if (y > base + 0.5 && y < tip - 3)
        beam(
          face,
          at(
            p.map((v, k) => v + e.spireU[k] * w * 0.45),
            y,
          ),
          at(
            p.map((v, k) => v - e.spireU[k] * w * 0.45),
            y,
          ),
          0.075,
          'frame',
        );
}
function dome(face, p, r, b, t, d) {
  const n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 16 : 24,
    steps = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 5 : 7,
    levels = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((i / steps) * Math.PI) / 2;
    levels.push([b + (t - b) * Math.sin(a), Math.max(0.01, Math.cos(a))]);
  }
  profile(face, circle(p, r, n), levels, 'accent');
}
function build(out, d) {
  const target = out;
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const toWorld = (p) => [p[0] * c + p[2] * s, -p[0] * s + p[2] * c];
  const clearance = e.footprintClearance.map(([x, z]) => toWorld([x, 0, z]));
  const clearanceBounds = [0, 1].map((k) => [
    Math.min(...clearance.map((p) => p[k])) - 2,
    Math.max(...clearance.map((p) => p[k])) + 2,
  ]);
  function emit(args) {
    const p = args[2].map((q) => q.map(Math.fround));
    if (
      Math.hypot(
        ...cross(
          p[1].map((v, k) => v - p[0][k]),
          p[2].map((v, k) => v - p[0][k]),
        ),
      ) < 1e-7
    )
      return;
    const w = p.map(toWorld),
      bounds = [0, 1].map((k) => [
        Math.min(...w.map((p) => p[k])),
        Math.max(...w.map((p) => p[k])),
      ]);
    const lengths = w.map((p, i) => Math.hypot(p[0] - w[(i + 1) % 3][0], p[1] - w[(i + 1) % 3][1]));
    const longest = Math.max(...lengths),
      i = lengths.indexOf(longest);
    // Localize conservative viewer footprint stamps around the real gap between components.
    if (
      longest > 6 &&
      clearanceBounds.every((b, k) => b[0] <= bounds[k][1] && b[1] >= bounds[k][0])
    ) {
      const j = (i + 1) % 3,
        k = (i + 2) % 3,
        mid = p[i].map((v, a) => (v + p[j][a]) / 2),
        uv = args[4],
        uvMid = uv[i].map((v, a) => (v + uv[j][a]) / 2);
      emit([args[0], args[1], [p[i], mid, p[k]], args[3], [uv[i], uvMid, uv[k]], args[5]]);
      emit([args[0], args[1], [mid, p[j], p[k]], args[3], [uvMid, uv[j], uv[k]], args[5]]);
    } else target.addTriangle(...args);
  }
  out = {
    addTriangle(...args) {
      emit(args);
    },
  };
  const face = writer(out, d),
    es = entries();
  solid(face, main, footing, 0.4, 'concrete');
  bandedWall(out, d, star, e.perimeterHeights, [es[1]]);
  const rp = at(e.roofCenter, e.roofCenterHeight);
  for (let i = 0; i < star.length; i++) {
    const j = (i + 1) % star.length,
      a = roofPoint(star[i], e.perimeterHeights[i]),
      b = roofPoint(star[j], e.perimeterHeights[j]);
    face('glass', [rp, a, b], [0, 1, 0]);
  }
  // The small current-map notch becomes a connected low glass entry projection.
  const lobby = [main[5], main[6], main[7], main[8]];
  bandedWall(
    out,
    d,
    lobby,
    lobby.map(() => 3.2),
    [es[0]],
  );
  cap(face, lobby, 3.2, 'concrete');
  for (const h of es) {
    portal(face, h, d);
    canopy(face, h, d);
  }
  if (d > 0) {
    for (let i = 0; i < star.length; i++) {
      const j = (i + 1) % star.length,
        a = roofPoint(star[i], e.perimeterHeights[i]),
        b = roofPoint(star[j], e.perimeterHeights[j]);
      beam(face, at(star[i], 0.4), a, 0.16, 'frame');
      beam(face, a, b, 0.16, 'frame');
      beam(face, rp, a, 0.19, 'frame');
      const step = d === 1 ? 18 : d === 2 ? 9 : 5.5;
      roofGrid(face, rp, a, b, step, d === 1 ? 0.1 : 0.075);
      if (d >= 2) roofGrid(face, a, b, rp, step, 0.075);
      if (d >= 2) {
        const f = faceFrame(star, i),
          count = Math.floor(f.length / 6);
        for (let k = 1; k <= count; k++) {
          const t = k / (count + 1),
            p = lerp(f.a, f.b, t),
            h = e.perimeterHeights[i] + (e.perimeterHeights[j] - e.perimeterHeights[i]) * t;
          beam(face, at(p, 0.5), at(p, h), 0.085, 'frame');
        }
        for (let y = 6; y < Math.max(e.perimeterHeights[i], e.perimeterHeights[j]) - 1; y += 6) {
          let lo = 0,
            hi = 1;
          const a = e.perimeterHeights[i],
            b = e.perimeterHeights[j];
          if (a < y) lo = (y - a) / (b - a);
          if (b < y) hi = (a - y) / (a - b);
          if (hi > lo)
            beam(face, at(lerp(f.a, f.b, lo), y), at(lerp(f.a, f.b, hi), y), 0.07, 'frame');
        }
      }
    }
  } else {
    // A few structural edges carry the folded silhouette at skyline distance.
    for (let i = 0; i < star.length; i += 2) beam(face, rp, at(star[i], 40), 0.23, 'frame');
  }
  // Detached mapped73m steel spire;gaps remain geometry at every level.
  solid(face, spire, footing, 0.4, 'concrete');
  const n = d === 0 ? 5 : d === 1 ? 7 : 9;
  for (const sg of [-1, 1])
    for (let i = 0; i < n; i++) {
      const u = -3.8 + (i * 7.6) / (n - 1),
        p = sp(u, sg * 3.8),
        base = 0.4 + (1 - Math.abs(u) / 3.8) * 10,
        tip = 73 - (Math.abs(u) / 3.8) * 12 - (sg > 0 ? 3 : 0);
      blade(face, p, base, tip, d === 0 ? 0.65 : 0.55, d);
    }
  for (const u of [-3.8, 3.8]) blade(face, sp(u, 0), 0.4, 55, d === 0 ? 0.6 : 0.55, d);
  const levels =
    d === 0
      ? [22, 40, 58]
      : d === 1
        ? [16, 28, 40, 52, 62]
        : Array.from({ length: 9 }, (_, i) => 12 + i * 6);
  for (const y of levels) {
    const r = [sp(-3.8, -3.8), sp(3.8, -3.8), sp(3.8, 3.8), sp(-3.8, 3.8)];
    for (let i = 0; i < 4; i++)
      beam(face, at(r[i], y), at(r[(i + 1) % 4], y), d === 0 ? 0.2 : 0.13, 'steel');
  }
  if (d >= 2) {
    const ys = d === 2 ? [21, 31, 41, 51] : Array.from({ length: 9 }, (_, i) => 19 + i * 4.5);
    for (const y of ys) {
      beam(face, at(sp(-2.5, 0), y + 0.9), at(sp(2.5, 0), y + 0.9), 0.14, 'steel');
      for (const u of [-1.2, 1.2])
        profile(
          face,
          circle(sp(u, 0), 0.4, d === 2 ? 6 : 10),
          [
            [y, 1],
            [y + 0.14, 0.98],
            [y + 0.6, 0.45],
            [y + 0.85, 0.42],
          ],
          'accent',
        );
    }
    if (d >= 3)
      for (let i = 0; i < levels.length - 1; i++)
        for (const sg of [-1, 1])
          beam(
            face,
            at(sp(-3.8, sg * 3.8), levels[i]),
            at(sp(3.8, sg * 3.8), levels[i + 1]),
            0.09,
            'steel',
          );
  }
  const theta = Math.atan2(e.spireU[1], e.spireU[0]),
    ring = circle(e.spireCenter, 2.4, 8, theta - Math.PI / 8),
    h = pavilionDoor();
  shell(out, d, ring, 0.4, 3.6, [h], 'concrete');
  cap(face, ring, 3.6, 'concrete');
  portal(face, h, d);
  dome(face, e.spireCenter, 2.5, 3.6, 4.8, d);
  if (d > 0)
    for (const p of ring) solid(face, circle(p, 0.12, d === 1 ? 4 : 6), 0.4, 3.6, 'concrete');
}
export const buildCrystalCathedralSkyline = (o) => build(o, 0),
  buildCrystalCathedralDistrict = (o) => build(o, 1),
  buildCrystalCathedralStreet = (o) => build(o, 2),
  buildCrystalCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const crystalCathedralStudy = {
  id: 'crystal_cathedral',
  key: 'crystal_cathedral',
  title: 'Crystal Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1051217',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current11-vertex main plus4-vertex associated73m spire.15 raw vertices/tags retained rigidly.Detached northwest spire signs retained axis;current Christ Cathedral and legacy Crystal Cathedral identity both retained.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0.Linked photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing cached256-square commercial window-grid,polished stainless steel,painted metal and plain concrete graphs.Linear blue-gray glazing/silver/pale-concrete tints,metric UVs and flat architectural normals.Gold-toned pavilion/bell accents use local geometric PBR colors.Opaque reflective exterior glazing;no interior/transmission simulation,no embedded images,unique facade maps or baked sky/tree reflections.',
  importReason:
    'Four browser levels preserve pointed folded glass shell,high tips/inward valleys,pale low entry canopies and detached open staggered steel spire/small pavilion.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three actually inspected2007/2009 photographs plus standard viewer PMTiles/DEM.No bespoke plans/surveys researched or photographs/reflections redistributed.Main roof fold/valley interpretation,entrance locations/profiles,spire blade count/sections/offsets,inner bell count and pavilion details are approximate.Opaque reflective exterior glazing simplifies transparency/interiors.Canonical shared pane grid differs from exact glazing pitch.Fine signage,engineering details,interiors and current campus renovations excluded or simplified.Other campus buildings,basins,trees/gardens and roads remain host content.Physical phone/laptop timing pending.',
    'Skyline preserves folded shell,sharp tips,open spire gaps/staggered crown and small base pavilion.District adds shared pane grid,coarse geometric roof-frame lines,spire connectors and real entrance/pavilion recesses.Street adds finer roof/wall frame lines and simplified inner bell rows.Closeup/master refine frame density,blade seams,connectors and bell profiles.Each level retains open spire geometry.Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('folded-glass-shell-and-northwest-spire', [-129, 63, -104], [-6, 26, 0]),
    cam('mapped-notch-entry-and-glazing-grid', [35, 13, -78], [10, 10, -24]),
    cam('opposite-wing-valley-and-pale-canopy', [-10, 24, 106], [-4, 17, 18]),
    cam('open-steel-spire-and-base-pavilion', [-100, 20, -71], [-45, 18, -21]),
    cam('staggered-steel-crown-and-bell-rows', [-96, 71, -64], [-45, 54, -21]),
    cam('roof-and-signed-whole-plan', [0, 192, 1], [0, 21, 0]),
  ],
};

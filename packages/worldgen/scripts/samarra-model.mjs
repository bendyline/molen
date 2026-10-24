/** Samarra: open mapped ruin enclosure,rounded buttresses and a map-controlled helical minaret. */
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

const openingShape = (h, d) => {
  if (h.shape === 'pointed') {
    const w = h.width / 2,
      n = d <= 0 ? 1 : d === 1 ? 2 : d === 2 ? 3 : d === 3 ? 5 : 6,
      points = [
        [-w, h.bottom],
        [w, h.bottom],
        [w, h.bottom + h.spring],
      ];
    for (let i = 1; i <= n; i++) {
      const a = ((i / n) * Math.PI) / 3;
      points.push([
        -w + 2 * w * Math.cos(a),
        h.bottom + h.spring + ((h.height - h.spring) * Math.sin(a)) / Math.sin(Math.PI / 3),
      ]);
    }
    for (let i = 1; i <= n; i++) {
      const a = (Math.PI * 2) / 3 + ((i / n) * Math.PI) / 3;
      points.push([
        w + 2 * w * Math.cos(a),
        h.bottom + h.spring + ((h.height - h.spring) * Math.sin(a)) / Math.sin(Math.PI / 3),
      ]);
    }
    return points;
  }
  if (h.shape === 'circle')
    return Array.from({ length: d <= 1 ? 8 : 16 }, (_, i) => {
      const a = (i * Math.PI * 2) / (d <= 1 ? 8 : 16);
      return [(Math.cos(a) * h.width) / 2, h.bottom + h.height / 2 + (Math.sin(a) * h.height) / 2];
    });
  return baseOpeningShape(h, d);
};
function prepareOpening(h, b, d) {
  const v = basePrepareOpening(h, b, d);
  if (!['circle', 'pointed'].includes(h.shape)) return v;
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
  '../../../content/worldgen/source/places/sy/syp/great_mosque_of_samarra/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const rec = frame.reconstruction,
  floor = rec.floorY;
const palette = { wall: '#c8ac83', cap: '#cab28d', foundation: '#bda583' };
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
const footing = (p) => Math.min(-0.35, floor - 0.3, samarraGround(...p) - 0.35);
export function samarraGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Great Mosque of Samarra footing outside retained terrain');
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
function _solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function _faceFrame(r, i) {
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
function _archBand(face, h, d, w = 0.45, slot = 'trim', offset = 0.08) {
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
function _shell(out, d, r, b, t, holes = [], slot = 'wall', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
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
function _beam(face, a, b, w, slot = 'trim', capped = true) {
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
  if (capped) {
    face(
      slot,
      lo,
      axis.map((v) => -v),
    );
    face(slot, hi, axis);
  }
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
const _coarse = (r) => {
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
function _profile(face, ring, levels, slot, origin = center(ring)) {
  const scale = (f) => ring.map((p) => p.map((v, k) => origin[k] + (v - origin[k]) * f));
  let prev = scale(levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const r = scale(levels[i][1]);
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
const _rect = (x, z, w, h) => [
    [x - w / 2, z - h / 2],
    [x + w / 2, z - h / 2],
    [x + w / 2, z + h / 2],
    [x - w / 2, z + h / 2],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
      p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
    ]);
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      center: lerp(a, b, 0.5),
      length: Math.hypot(...b.map((v, k) => v - a[k])),
    };
  });
const field = (name, center, axis, normal, width, bottom, height, spring, depth = 1) => ({
  name,
  center,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape: 'pointed',
  depth,
});
const point = (h, u, y, dep = 0) => [
  h.center[0] + h.axis[0] * u + h.normal[0] * dep,
  y,
  h.center[1] + h.axis[1] * u + h.normal[1] * dep,
];
function _down(face, r, y, slot, holes = []) {
  const p = [...r, ...holes.flat()],
    starts = [];
  let n = r.length;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(p.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, -1, 0],
    );
}
function _panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    p = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
      ...r,
    ],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function _reveal(face, h, d, front, back, slot = 'wall') {
  const r = openingShape(h, d),
    sg = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      du = b[0] - a[0],
      dy = b[1] - a[1];
    face(
      slot,
      [point(h, ...a, front), point(h, ...b, front), point(h, ...b, back), point(h, ...a, back)],
      [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
    );
  }
}
const plans = rec.plans,
  towerShift = rec.minaretFloorY - floor;
function northFace() {
  return edges(plans.outer).find((e) => e.center[0] > 70 && e.length > 100);
}
export function samarraGate() {
  const e = northFace(),
    t = (2.35 - e.a[1]) / (e.b[1] - e.a[1]);
  return {
    ...field('estimated-north-breach', lerp(e.a, e.b, t), e.axis, e.normal, 8, 0.15, 6.5, 3.9, 20),
    shape: 'round',
  };
}
export function samarraNiches(d) {
  if (d < 2) return [];
  const hs = [];
  for (const e of edges(plans.outer)) {
    if (e.length < 35) continue;
    const n = Math.floor(e.length / 6.5);
    for (let i = 0; i < n; i++) {
      const center = lerp(e.a, e.b, (i + 0.5) / n);
      if (
        plans.buttresses.some(
          (b) => Math.hypot(b.center[0] - center[0], b.center[1] - center[1]) < b.radius + 0.85,
        )
      )
        continue;
      hs.push({
        ...field(`upper-frieze-${hs.length}`, center, e.axis, e.normal, 1.0, 9.35, 1.0, 0.65, 0.8),
        shape: 'round',
      });
    }
  }
  return hs;
}
function enclosure(out, face, d) {
  const gate = samarraGate(),
    niches = samarraNiches(d);
  sides(face, plans.outer, footing, 0, 'wall');
  sides(face, plans.inner, footing, 0, 'wall', true);
  _shell(out, d, plans.outer, 0, plans.wallHeight, [gate, ...niches], 'wall', plans.inner);
  for (const h of niches) pane(face, h, d, -0.35, 'wall');
  // A low threshold closes the breach floor;the passage above it is open through the wall.
  const q = gate.center,
    axis = gate.axis,
    n = gate.normal,
    ring = [
      [-4.1, 2.4],
      [4.1, 2.4],
      [4.1, -7.4],
      [-4.1, -7.4],
    ].map(([u, v]) => [q[0] + axis[0] * u + n[0] * v, q[1] + axis[1] * u + n[1] * v]);
  cap(face, ring, 0.17, 'foundation');
  for (const b of plans.buttresses) {
    const n = [2, 3, 5, 7, 9][d],
      a = [-b.normal[1], b.normal[0]],
      p = b.center.map((v, k) => v - b.normal[k] * 0.07),
      ring = Array.from({ length: n + 1 }, (_, i) => {
        const t = -Math.PI / 2 + (i * Math.PI) / n;
        return p.map((v, k) => v + b.radius * (b.normal[k] * Math.cos(t) + a[k] * Math.sin(t)));
      });
    sides(face, ring, footing, 10.95, 'wall');
    cap(face, ring, 10.95, 'cap');
  }
}
export function samarraCrownFields(d) {
  if (d === 0) return [];
  const r = circle(plans.crownCenter, plans.crownRadius, d === 1 ? 8 : 16);
  return edges(r)
    .filter((_, i) => d === 1 || i % 2 === 0)
    .map((e, i) => ({
      ...field(
        `summit-arch-${i}`,
        e.center,
        e.axis,
        e.normal,
        d === 1 ? 0.75 : 0.85,
        49.0,
        2.05,
        1.48,
        2.2,
      ),
      shape: 'round',
    }));
}
function tower(out, face, d) {
  const tf = (slot, p, normal, col) =>
      face(
        slot,
        p.map((p) => [p[0], p[1] + towerShift, p[2]]),
        normal,
        col,
      ),
    shiftedFooting = (p) => footing(p) - towerShift;
  sides(tf, plans.platform, shiftedFooting, plans.platformHeight, 'wall');
  cap(tf, plans.platform, plans.platformHeight, 'foundation');
  const shiftedRamp = {
    addTriangle(slot, ref, p, normal, uv, color) {
      out.addTriangle(
        slot,
        ref,
        p.map((p) => [p[0], p[1] + towerShift, p[2]]),
        normal,
        uv,
        color,
      );
    },
  };
  const rf = writer(
    masked(
      shiftedRamp,
      samarraCrownFields(d).map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  const ps = plans.rampTiers[d],
    origin = plans.rampCenter;
  for (let i = 0; i < ps.length - 1; i++) {
    const a = ps[i],
      b = ps[i + 1],
      normal = [
        (a.point[0] + b.point[0]) / 2 - origin[0],
        0,
        (a.point[1] + b.point[1]) / 2 - origin[1],
      ];
    rf('wall', [at(a.point, 2.69), at(b.point, 2.69), at(b.point, b.y), at(a.point, a.y)], normal);
    rf(
      'wall',
      [at(a.inner, 2.69), at(b.inner, 2.69), at(b.inner, b.y), at(a.inner, a.y)],
      normal.map((v) => -v),
    );
    tf('cap', [at(a.point, a.y), at(b.point, b.y), at(b.inner, b.y), at(a.inner, a.y)], [0, 1, 0]);
    // Fill each helical sector to the axis;the minaret is a solid spiral mass.
    tf('cap', [at(a.inner, a.y), at(b.inner, b.y), at(origin, b.y), at(origin, a.y)], [0, 1, 0]);
  }
  for (const a of [ps[0], ps.at(-1)])
    rf(
      'wall',
      [at(origin, 2.69), at(a.point, 2.69), at(a.point, a.y), at(origin, a.y)],
      [a.point[1] - origin[1], 0, origin[0] - a.point[0]],
    );
  // The narrow core is buried in the helical solid and stops below the open summit crown.
  _solid(
    tf,
    circle(plans.crownCenter, 1.85, d <= 1 ? 8 : 16),
    plans.platformHeight,
    plans.crownBase,
    'wall',
  );
  const r = circle(plans.crownCenter, plans.crownRadius, d <= 1 ? 8 : 16),
    inner = circle(plans.crownCenter, 1.85, d <= 1 ? 8 : 16);
  if (d === 0) {
    sides(tf, r, plans.crownBase, 49, 'wall');
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        p = [plans.crownCenter[0] + Math.cos(a) * 2.15, plans.crownCenter[1] + Math.sin(a) * 2.15];
      _solid(tf, _rect(...p, 0.75, 0.75), 49, 51.6, 'wall');
    }
    sides(tf, r, 51.6, 52, 'wall');
    cap(tf, r, 52, 'cap');
    _down(tf, r, 51.6, 'cap');
  } else {
    const shifted = {
      addTriangle(slot, ref, p, n, uv, col) {
        out.addTriangle(
          slot,
          ref,
          p.map((p) => [p[0], p[1] + towerShift, p[2]]),
          n,
          uv,
          col,
        );
      },
    };
    _shell(shifted, d, r, plans.crownBase, 52, samarraCrownFields(d), 'wall', inner);
    cap(tf, r, 52, 'cap');
    _down(tf, r, 52, 'cap');
    cap(tf, inner, plans.crownBase, 'foundation');
  }
}
export function samarraApproachTop(p) {
  const x0 = Math.min(...plans.approach.map((p) => p[0])),
    x1 = Math.max(...plans.approach.map((p) => p[0])),
    t = Math.max(0, Math.min(1, (p[0] - x0) / (x1 - x0)));
  return floor + 0.15 + (rec.minaretFloorY + plans.platformHeight - floor - 0.15) * t;
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((p) => p.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-7
        )
          return;
        target.addTriangle(a[0], a[1], p, a[3], a[4], a[5]);
      },
    },
    face = writer(out, d);
  enclosure(out, face, d);
  tower(out, face, d);
  sides(face, plans.approach, footing, samarraApproachTop, 'wall');
  cap(face, plans.approach, samarraApproachTop, 'foundation');
}
export const buildSamarraSkyline = (o) => build(o, 0),
  buildSamarraDistrict = (o) => build(o, 1),
  buildSamarraStreet = (o) => build(o, 2),
  buildSamarraCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const samarraStudy = {
  id: 'great_mosque_of_samarra',
  key: 'great_mosque_of_samarra',
  title: 'Great Mosque of Samarra',
  category: 'mosque',
  wikidataId: 'Q593115',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: { horizontalBasis: rec.identityBasis, architecturalHeights: rec.heightBasis },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Two existing shared256² brick/fired-clay graphs,three merged wall/cap/foundation roles with metric UVs and linear tints. Source retains383 map controls and all height tags. Zero embedded images,unique atlases,baked light or photographic art.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi ruin exterior with an open enclosure,44 approximate rounded buttresses,selected top frieze recesses,one approximate northern breach and separate helical minaret/platform/approach. No fence-ground slab,historical hall roof or navigable reconstruction. All379 ramp profiles through51.87m guide the complete coalesced continuous spiral;the final52m platform becomes the approximate summit cap. Internal sectors fill the solid mass;individual13cm treads are omitted from runtime levels. Exact damage,restoration,interior foundations,buttress/door/frieze counts and fine walking clearance remain unverified. Physical-device timing remains unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('five-coil-minaret', [165, 66, 67], [111, 29, 2]),
    cam('open-summit-crown', [125, 60, 19], [111.7, 54, 2.5]),
    cam('north-breach-and-approach', [109, 15, 23], [73, 9, 2.35]),
    cam('rounded-enclosure-buttresses', [-41, 24, 123], [-50, 12, 86]),
    cam('open-ruin-interior', [-40, 175, 100], [-50, 8, 0]),
    cam('enclosure-platform-plan', [-25, 445, 0.1], [-25, 10, 0]),
  ],
};

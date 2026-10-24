/** Hassan II Mosque: square minaret, green roof tiers and polygonal Moorish court. */
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
  '../../../content/worldgen/source/places/ev/evf/hassan_ii_mosque/',
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
  wall: '#e6d4b7',
  trim: '#dfd3bc',
  roof: '#518069',
  door: '#705d4c',
  gold: '#bda46a',
  glass: '#52636b',
  tile: '#6b9990',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, hassanGround(...p) - 0.35);
export function hassanGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Hassan II Mosque footing outside retained terrain');
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
function solid(face, r, b, t, slot) {
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
function beam(face, a, b, w, slot = 'trim', capped = true) {
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
function profile(face, ring, levels, slot, origin = center(ring)) {
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
function facetedRecesses(face, ring, bottom, top, fields, d) {
  for (const e of edges(ring)) {
    const midpoint = lerp(e.a, e.b, 0.5);
    const h = fields.find((h) => Math.hypot(...h.center.map((v, k) => v - midpoint[k])) < 1e-5);
    if (!h) {
      face(
        'wall',
        [at(e.a, bottom), at(e.b, bottom), at(e.b, top), at(e.a, top)],
        [e.normal[0], 0, e.normal[1]],
      );
      continue;
    }
    const outer = [
      [-e.length / 2, floor + bottom],
      [e.length / 2, floor + bottom],
      [e.length / 2, floor + top],
      [-e.length / 2, floor + top],
    ];
    const aperture = openingShape(h, d),
      points = [...outer, ...aperture];
    const indices = earcut(points.flat(), [outer.length], 2);
    const point = ([u, y], depth = 0) => [
      h.center[0] + h.axis[0] * u + h.normal[0] * depth,
      y,
      h.center[1] + h.axis[1] * u + h.normal[1] * depth,
    ];
    for (let i = 0; i < indices.length; i += 3)
      face(
        'wall',
        indices.slice(i, i + 3).map((j) => point(points[j])),
        [h.normal[0], 0, h.normal[1]],
      );
    const orientation = sign(aperture);
    for (let i = 0; i < aperture.length; i++) {
      const a = aperture[i],
        b = aperture[(i + 1) % aperture.length],
        du = b[0] - a[0],
        dy = b[1] - a[1];
      face(
        'wall',
        [point(a), point(b), point(b, -(h.inset ?? 0.24)), point(a, -(h.inset ?? 0.24))],
        [-dy * h.axis[0] * orientation, du * orientation, -dy * h.axis[1] * orientation],
      );
    }
  }
}
const plans = rec.plans,
  rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  edges = (r) =>
    r.map((a, i) => {
      const b = r[(i + 1) % r.length],
        axis = unit(b.map((v, k) => v - a[k]));
      return {
        a,
        b,
        axis,
        normal: [axis[1] * sign(r), -axis[0] * sign(r)],
        length: Math.hypot(...b.map((v, k) => v - a[k])),
      };
    }),
  hole = (
    name,
    center,
    axis,
    normal,
    width,
    bottom,
    height,
    spring = height,
    shape = 'pointed',
    depth = 2,
  ) => ({
    name,
    center,
    axis,
    normal,
    width,
    bottom: floor + bottom,
    height,
    spring,
    shape,
    depth,
  });
function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    lo = [],
    hi = [];
  for (const q of p) {
    while (lo.length > 1 && cross(lo.at(-2), lo.at(-1), q) <= 0) lo.pop();
    lo.push(q);
  }
  for (const q of p.toReversed()) {
    while (hi.length > 1 && cross(hi.at(-2), hi.at(-1), q) <= 0) hi.pop();
    hi.push(q);
  }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
function down(face, r, y, slot, holes = []) {
  const points = [...r, ...holes.flat()],
    starts = [];
  let off = r.length;
  for (const h of holes) {
    starts.push(off);
    off += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((j) => at(points[j], y)),
      [0, -1, 0],
    );
}
function hip(face, r, eave, top, d) {
  let [A, B, C, D] = r;
  const length = (a, b) => Math.hypot(...a.map((v, k) => v - b[k]));
  if (length(A, B) < length(B, C)) [A, B, C, D] = [B, C, D, A];
  const L = length(A, B),
    W = (length(B, C) + length(D, A)) / 2,
    t = Math.min(0.45, W / (2 * L)),
    q0 = lerp(lerp(A, D, 0.5), lerp(B, C, 0.5), t),
    q1 = lerp(lerp(A, D, 0.5), lerp(B, C, 0.5), 1 - t);
  for (const p of [
    [at(A, eave), at(B, eave), at(q1, top), at(q0, top)],
    [at(B, eave), at(C, eave), at(q1, top)],
    [at(C, eave), at(D, eave), at(q0, top), at(q1, top)],
    [at(D, eave), at(A, eave), at(q0, top)],
  ])
    face('roof', p, [0, 1, 0]);
  if (d >= 2) {
    for (const p of [
      [A, q0],
      [D, q0],
      [B, q1],
      [C, q1],
    ])
      beam(face, at(p[0], eave), at(p[1], top), 0.24, 'roof');
    beam(face, at(q0, top), at(q1, top), 0.28, 'roof');
  }
}
function pyramid(face, r, b, t) {
  const C = center(r);
  for (let i = 0; i < r.length; i++)
    face('roof', [at(r[i], b), at(r[(i + 1) % r.length], b), at(C, t)], [0, 1, 0]);
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(
      face,
      h,
      d,
      d === 1 ? 0.04 : -(h.inset ?? 0.35),
      h.kind === 'door' ? 'door' : h.kind === 'blind' ? 'wall' : 'glass',
    );
    if (d >= 2) archBand(face, h, d, 0.32, h.kind === 'door' ? 'trim' : 'wall', 0.07);
  }
}
export function hassanHallFields(d = 3) {
  if (d === 0) return [];
  const list = [];
  for (const [i, e] of edges(plans.hall).entries()) {
    if (e.length < 28) continue;
    const n = Math.floor(e.length / 29);
    for (let j = 0; j < n; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / n);
      if (plans.arcadeLines.some((l) => Math.hypot(...p.map((v, k) => v - l.a[k])) < 13)) continue;
      list.push({
        ...hole(`hall-${i}-${j}`, p, e.axis, e.normal, 10.5, 1, 19, 10.5),
        kind: 'door',
        inset: 0.5,
      });
    }
  }
  for (const [i, e] of edges(plans.upperHall).entries()) {
    const n = Math.floor(e.length / 25);
    for (let j = 0; j < n; j++)
      list.push({
        ...hole(
          `clerestory-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal,
          5.5,
          29,
          8.5,
          4.4,
        ),
        kind: 'glass',
        inset: 0.35,
      });
  }
  return list;
}
export function hassanWingFields(d = 3) {
  if (d === 0) return [];
  const list = [];
  for (const [i, e] of edges(plans.eastWing).entries()) {
    if (e.length < 8 || (e.a[0] < 72 && e.b[0] < 72)) continue;
    const n = Math.max(1, Math.floor(e.length / 14));
    for (let j = 0; j < n; j++)
      list.push({
        ...hole(
          `wing-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal,
          Math.min(6, e.length / n - 2),
          0.8,
          11.8,
          7.2,
        ),
        kind: 'door',
        inset: 0.4,
      });
  }
  return list;
}
export function hassanTowerFields(d = 3) {
  if (d === 0) return [];
  return edges(plans.tower.outline).map((e, i) => ({
    ...hole(`shaft-${i}`, lerp(e.a, e.b, 0.5), e.axis, e.normal, e.length * 0.69, 35, 114, 95),
    kind: 'blind',
    inset: 0.45,
  }));
}
export function hassanUpperFields(d = 3) {
  if (d === 0) return [];
  return edges(plans.tower.upper).map((e, i) => ({
    ...hole(`upper-${i}`, lerp(e.a, e.b, 0.5), e.axis, e.normal, e.length * 0.58, 174.5, 12, 7.7),
    kind: 'glass',
    inset: 0.4,
  }));
}
export function hassanArcades(d = 3) {
  if (d === 0) return [];
  const list = [];
  for (const line of plans.arcadeLines) {
    const axis = unit(line.b.map((v, k) => v - line.a[k])),
      normal = unit(line.normal),
      length = Math.hypot(...line.b.map((v, k) => v - line.a[k])),
      n = Math.round(length / 8);
    for (let i = 0; i < n; i++)
      list.push({
        ...hole(
          `${line.name}-${i}`,
          lerp(line.a, line.b, (i + 0.5) / n),
          axis,
          normal,
          Math.min(5.6, length / n - 2.3),
          0.2,
          11.6,
          7,
          'keyhole',
          line.depth,
        ),
        half: length / n / 2,
        span: line.depth,
      });
  }
  return list;
}
function keyhole(h, d) {
  const w = h.width / 2,
    n = d === 1 ? 4 : d === 2 ? 6 : 12,
    ry = Math.min(h.height * 0.3, h.width * 0.65),
    cy = h.bottom + h.height - ry,
    a = -0.7,
    r = [
      [-w * Math.cos(a), h.bottom],
      [w * Math.cos(a), h.bottom],
    ];
  for (let i = 0; i <= n; i++) {
    const t = a + (i * (Math.PI - 2 * a)) / n;
    r.push([w * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return r;
}
function arcadePanel(face, h, d) {
  const aperture = keyhole(h, d),
    P = ([u, y], v) => [
      h.center[0] + h.axis[0] * u + h.normal[0] * v,
      y,
      h.center[1] + h.axis[1] * u + h.normal[1] * v,
    ];
  for (const [offset, s] of [
    [0, 1],
    [-0.65, -1],
  ]) {
    const box = [
        [-h.half, floor],
        [h.half, floor],
        [h.half, floor + 15],
        [-h.half, floor + 15],
      ],
      points = [...box, ...aperture],
      ids = earcut(points.flat(), [4], 2);
    for (let i = 0; i < ids.length; i += 3)
      face(
        'wall',
        ids.slice(i, i + 3).map((j) => P(points[j], offset)),
        [h.normal[0] * s, 0, h.normal[1] * s],
      );
  }
  for (let i = 0; i < aperture.length; i++) {
    const a = aperture[i],
      b = aperture[(i + 1) % aperture.length],
      du = b[0] - a[0],
      dy = b[1] - a[1],
      s = sign(aperture);
    face(
      'wall',
      [P(a, 0), P(b, 0), P(b, -0.65), P(a, -0.65)],
      [-dy * h.axis[0] * s, du * s, -dy * h.axis[1] * s],
    );
  }
}
function groundwork(face, d) {
  sides(face, plans.outer, footing, 0.04, 'trim');
  cap(face, plans.outer, 0.04, 'trim');
  if (d >= 3) {
    for (let x = -78; x < 12; x += 10)
      for (let z = 22; z < 67; z += 10) {
        if (!inside([x, z], plans.court)) continue;
        face(
          'trim',
          rect(x - 3.1, z - 3.1, x + 3.1, z + 3.1).map((p) => at(p, 0.048)),
          [0, 1, 0],
          colors.wall,
        );
      }
  }
}
function inside(p, r) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      v = !v;
  }
  return v;
}
function recessReveals(face, fields, d) {
  if (d < 2) return;
  for (const h of fields) {
    const ring = openingShape(h, d),
      s = sign(ring),
      P = ([u, y], v) => [
        h.center[0] + h.axis[0] * u + h.normal[0] * v,
        y,
        h.center[1] + h.axis[1] * u + h.normal[1] * v,
      ];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        du = b[0] - a[0],
        dy = b[1] - a[1];
      face(
        'wall',
        [P(a, 0), P(b, 0), P(b, -h.inset), P(a, -h.inset)],
        [-dy * h.axis[0] * s, du * s, -dy * h.axis[1] * s],
      );
    }
  }
}
function hall(out, face, d) {
  const fields = hassanHallFields(d),
    maskedFace = writer(masked(out, d >= 2 ? fields.map((h) => prepareOpening(h, 0, d)) : []), d);
  sides(maskedFace, plans.hall, 0, 27, 'wall');
  cap(maskedFace, plans.hall, 27, 'trim');
  solid(maskedFace, plans.upperHall, 27, 40, 'wall');
  solid(maskedFace, plans.centralRoof, 40, 50, 'wall');
  hip(face, plans.mainRoof, 40, 50, d);
  hip(face, plans.centralRoof, 50, 60, d);
  finish(face, fields, d);
  recessReveals(face, fields, d);
  if (d >= 2) {
    for (const ring of [plans.hall, plans.upperHall]) {
      const y = ring === plans.hall ? 26.2 : 39.4;
      for (const e of edges(ring)) beam(face, at(e.a, y), at(e.b, y), 0.6, 'trim');
    }
    for (const e of edges(plans.hall)) {
      if (e.length < 25) continue;
      const n = Math.floor(e.length / (d === 2 ? 11 : 7));
      for (let i = 1; i < n; i++) {
        const p = lerp(e.a, e.b, i / n);
        pyramid(face, rect(p[0] - 0.35, p[1] - 0.35, p[0] + 0.35, p[1] + 0.35), 27, 28.0);
      }
    }
  }
}
function wing(out, face, d) {
  const fields = hassanWingFields(d),
    w = writer(masked(out, d >= 2 ? fields.map((h) => prepareOpening(h, 0, d)) : []), d);
  solid(w, plans.eastWing, 0, 15, 'wall');
  cap(face, plans.eastWing, 15.05, 'roof');
  finish(face, fields, d);
  recessReveals(face, fields, d);
  for (const m of plans.entrances) {
    solid(face, m.outline, 15, 18, 'wall');
    pyramid(face, hull(m.outline), 18, 20);
  }
  if (d >= 3)
    for (const e of edges(plans.eastWing)) {
      beam(face, at(e.a, 14.4), at(e.b, 14.4), 0.4, 'trim');
    }
}
function gallery(face, d) {
  for (const r of plans.galleryRoofs) {
    cap(face, r.outline, 15, 'trim', r.holes);
    down(face, r.outline, 14.25, 'wall', r.holes);
    sides(face, r.outline, 14.25, 15, 'wall');
    for (const h of r.holes) sides(face, h, 14.25, 15, 'wall', true);
  }
  for (const p of plans.pavilions) {
    solid(face, p.outline, 15, 15.7, 'wall');
    pyramid(face, hull(p.outline), 15.7, p.height);
  }
  if (d === 0) {
    for (const line of plans.arcadeLines) {
      const r = [
        line.a,
        line.b,
        line.b.map((v, k) => v - line.normal[k] * line.depth),
        line.a.map((v, k) => v - line.normal[k] * line.depth),
      ];
      sides(face, r, 0, 15, 'wall');
    }
    return;
  }
  const seen = new Set();
  for (const h of hassanArcades(d)) {
    for (const outer of [false, true]) {
      const f = outer
        ? {
            ...h,
            center: h.center.map((v, k) => v - h.normal[k] * h.span),
            normal: h.normal.map((v) => -v),
          }
        : h;
      if (d === 1) {
        const a = f.center.map((v, k) => v - f.axis[k] * h.half),
          b = f.center.map((v, k) => v + f.axis[k] * h.half);
        face('wall', [at(a, 0), at(b, 0), at(b, 15), at(a, 15)], [f.normal[0], 0, f.normal[1]]);
        face(
          'glass',
          keyhole(f, d).map(([u, y]) => [
            f.center[0] + f.axis[0] * u + f.normal[0] * 0.05,
            y,
            f.center[1] + f.axis[1] * u + f.normal[1] * 0.05,
          ]),
          [f.normal[0], 0, f.normal[1]],
        );
      } else arcadePanel(face, f, d);
      if (d >= 2) {
        const stem = f.width * 0.5 * Math.cos(0.7);
        for (const [lo, hi] of [
          [-h.half, -stem],
          [stem, h.half],
        ])
          for (const [offset, s] of [
            [0.035, 1],
            [-0.685, -1],
          ]) {
            const P = (u, y) => [
              f.center[0] + f.axis[0] * u + f.normal[0] * offset,
              floor + y,
              f.center[1] + f.axis[1] * u + f.normal[1] * offset,
            ];
            face(
              'tile',
              [P(lo, 0), P(hi, 0), P(hi, 2), P(lo, 2)],
              [f.normal[0] * s, 0, f.normal[1] * s],
            );
          }
      }
      for (const edge of [-1, 1]) {
        const p = f.center.map((v, k) => v + f.axis[k] * h.half * edge),
          key = p.map((v) => v.toFixed(2)).join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        if (d >= 2) {
          solid(face, rect(p[0] - 0.82, p[1] - 0.82, p[0] + 0.82, p[1] + 0.82), 6.0, 6.5, 'trim');
        }
        if (d >= 3) {
          const q = p.map((v, k) => v + f.normal[k] * 0.4),
            ring = Array.from({ length: 8 }, (_, i) => {
              const a = (i * Math.PI) / 4;
              return [q[0] + 0.25 * Math.cos(a), q[1] + 0.25 * Math.sin(a)];
            });
          solid(face, ring, 2, 6.1, 'wall');
        }
      }
    }
  }
  if (d >= 3) {
    for (const h of hassanArcades(d)) {
      const p = h.center,
        q = p.map((v, k) => v - h.normal[k] * h.span);
      beam(face, at(p, 14.1), at(q, 14.1), 0.24, 'trim');
    }
  }
}
function tower(face, d) {
  const m = plans.tower,
    ring = m.outline,
    fields = hassanTowerFields(d),
    upper = hassanUpperFields(d);
  if (d <= 1) {
    solid(face, ring, 0, 172, 'wall');
    if (d === 1) finish(face, fields, d);
  } else {
    facetedRecesses(face, ring, 0, 172, fields, d);
    cap(face, ring, 172, 'trim');
    finish(face, fields, d);
  }
  sides(face, scaled(ring, 1.008), 156, 170.8, 'tile');
  solid(face, scaled(ring, 1.025), 170.8, 172, 'trim');
  if (d >= 2) {
    for (const e of edges(ring)) {
      beam(face, at(e.a, 0), at(e.a, 172), 0.46, 'trim');
      const n = d === 2 ? 3 : 5;
      for (let i = 0; i <= n; i++) {
        const p = lerp(e.a, e.b, i / n);
        profile(
          face,
          rect(p[0] - 0.45, p[1] - 0.45, p[0] + 0.45, p[1] + 0.45),
          [
            [172, 1],
            [174.2, 0],
          ],
          'wall',
        );
      }
    }
  }
  if (d >= 2) {
    for (const h of fields) {
      const P = (u, y, offset = -0.37) => [
          h.center[0] + h.axis[0] * u + h.normal[0] * offset,
          floor + y,
          h.center[1] + h.axis[1] * u + h.normal[1] * offset,
        ],
        cols = d === 2 ? 2 : 3,
        rows = d === 2 ? 7 : d === 3 ? 10 : 12,
        w = h.width * 0.42;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const u0 = -w + (2 * w * i) / cols,
            u1 = -w + (2 * w * (i + 1)) / cols,
            y0 = 42 + (87 * j) / rows,
            y1 = 42 + (87 * (j + 1)) / rows;
          beam(face, P(u0, y0), P(u1, y1), d === 2 ? 0.17 : 0.2, 'wall');
          beam(face, P(u0, y1), P(u1, y0), d === 2 ? 0.17 : 0.2, 'wall');
        }
      for (const u of [-4.6, 0, 4.6]) {
        const small = {
          ...hole(
            'shaft-triple',
            h.center.map((v, k) => v + h.axis[k] * u),
            h.axis,
            h.normal,
            2.8,
            136,
            9.5,
            6.0,
            'pointed',
            1,
          ),
          kind: 'glass',
        };
        pane(face, small, d, -0.4, 'glass');
        archBand(face, small, d, 0.23, 'trim', -0.36);
      }
    }
  }
  if (d <= 1) {
    solid(face, m.upper, 172, 190, 'wall');
    finish(face, upper, d);
  } else {
    facetedRecesses(face, m.upper, 172, 190, upper, d);
    cap(face, m.upper, 190, 'trim');
    finish(face, upper, d);
  }
  if (d >= 2) {
    for (const e of edges(m.upper)) beam(face, at(e.a, 189.4), at(e.b, 189.4), 0.5, 'tile');
  }
  const capRing =
    d === 0
      ? m.cap.filter((_, i) => i % 4 === 0)
      : d === 1
        ? m.cap.filter((_, i) => i % 2 === 0)
        : m.cap;
  profile(
    face,
    capRing,
    [
      [190, 1],
      [191.8, 0.9],
      [194, 0.15],
    ],
    'roof',
  );
  const cp = center(m.finial),
    r = d <= 1 ? 0.3 : 0.55,
    n = d <= 1 ? 4 : d === 2 ? 6 : 10,
    finial = Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [cp[0] + Math.cos(a) * r, cp[1] + Math.sin(a) * r];
    });
  profile(
    face,
    finial,
    d <= 1
      ? [
          [194, 0.4],
          [197, 1],
          [201, 0.7],
          [206, 0.5],
          [210, 0],
        ]
      : [
          [194, 0.3],
          [196, 0.45],
          [198, 1.1],
          [200, 0.4],
          [202, 0.85],
          [204, 0.3],
          [206, 0.5],
          [209.6, 0.08],
          [210, 0],
        ],
    'gold',
  );
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let length = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const n = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (n > length) {
              length = n;
              k = i;
            }
          }
          if (length > (d === 0 ? 75 : d === 1 ? 48 : d === 2 ? 30 : 22)) {
            const j = (k + 1) % 3,
              c = (k + 2) % 3,
              m = lerp(p[k], p[j], 0.5).map(Math.fround),
              v = lerp(uv[k], uv[j], 0.5);
            emit([p[k], m, p[c]], [uv[k], v, uv[c]]);
            emit([m, p[j], p[c]], [v, uv[j], uv[c]]);
            return;
          }
          if (
            Math.hypot(
              ...cross(
                p[1].map((v, k) => v - p[0][k]),
                p[2].map((v, k) => v - p[0][k]),
              ),
            ) < 1e-7
          )
            return;
          target.addTriangle(a[0], a[1], p, a[3], uv, a[5]);
        }
        emit(p, a[4]);
      },
    },
    face = writer(out, d);
  groundwork(face, d);
  hall(out, face, d);
  wing(out, face, d);
  gallery(face, d);
  tower(face, d);
}
export const buildHassanSkyline = (o) => build(o, 0),
  buildHassanDistrict = (o) => build(o, 1),
  buildHassanStreet = (o) => build(o, 2),
  buildHassanCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const hassanStudy = {
  id: 'hassan_ii_mosque',
  key: 'hassan_ii_mosque',
  title: 'Hassan II Mosque',
  category: 'mosque',
  wikidataId: 'Q41346',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared256² sandstone,marble,glazed tile,mosaic,wood and bronze graphs;seven merged groups. Green roof tiers share glazed tile;cornice/pier-base bands share a generic mosaic with green tints. Original broad diagonal stone fields simplify observed shallow carving without copying facade artwork. Metric UVs,zero embedded images,baked lighting,unique textures or copied inscriptions.',
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
    'Individual medium-fi exterior from four actually inspected2006/2026 facade,shaft,arcade and sea-silhouette pictures plus standard viewer PMTiles/DEM. Giant diamond-oriented square minaret/green tiled cornice/setback upper stage/rounded cap/gold finial,nested green hall roofs,polygonal open court/thick-pier horseshoe galleries/three small caps,curved east wing and entrance projections. Individual facade/bay counts,hip ridges,green motifs,diagonal fields and canopy/pavilion profiles estimated. Fine zellij,sebka carving,calligraphy,soffit art,interiors,fixtures,unseen faces/current finish and exact seawall/terrain/threshold/street contacts omitted or abstracted. Hall/tower/wing fields close;court/near galleries are exterior voids,no enclosed interior/free traversal claim. Atlantic water,seawall,outer plaza/fountains/roads and separate campus assets remain host content. Synthetic Mediterranean context and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('green-roof-hall-and-square-minaret', [310, 190, 310], [-20, 58, 0]),
    cam('shallow-shaft-field-and-green-band', [95, 125, 155], [-35, 130, 24]),
    cam('polygonal-court-and-horseshoe-arcade', [-32, 11, 56], [-64, 9, 60]),
    cam('nested-green-roofs', [-135, 120, -155], [-30, 45, -40]),
    cam('curved-east-wing', [220, 40, 8], [105, 12, -32]),
    cam('mapped-sea-facing-plan', [0, 520, 0.1], [-5, 35, 0]),
  ],
};

/** St Giles: open stone crown, Gothic fronts, lead-gray church roofs and Thistle Chapel. */
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
  '../../../content/worldgen/source/places/gc/gcv/n0358_st_giles_cathedral/',
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
  wall: '#c7bfa8',
  trim: '#d2c8b0',
  roof: '#b2b9bd',
  stone: '#b0a89a',
  door: '#76563d',
  glass: '#4d6178',
  metal: '#9f906b',
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
const _rect = (p, w, h) => [
  [p[0] - w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] + h / 2],
  [p[0] - w / 2, p[1] + h / 2],
];
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, gilesGround(...p) - 0.35);
export function gilesGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('St Giles footing outside retained terrain');
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
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  _role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline;
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
const _plan = (name) => rec[`${name}Plan`][0].outline;
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
function _onFace(name, r, n, t, w, b, h, s = h, shape = 'pointed', depth = 5) {
  const f = edge(r, n);
  return hole(name, lerp(f.a, f.b, t), f.axis, f.normal, w, b, h, s, shape, depth);
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
const regular = (p, r, n = 8, off = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(off + (i * 2 * Math.PI) / n),
    p[1] + r * Math.sin(off + (i * 2 * Math.PI) / n),
  ]);
const tower = rec.towerPlan,
  ct = center(tower),
  H = rec.heights;
const rooms = rec.rooms.map((room) => ({ ...room, r: coarse(room.raw.outline) }));
const bounds = (r) => [
  Math.min(...r.map((p) => p[0])),
  Math.min(...r.map((p) => p[1])),
  Math.max(...r.map((p) => p[0])),
  Math.max(...r.map((p) => p[1])),
];
function roofHeight(room, p) {
  const b = bounds(room.r);
  if (room.role === 'northAisle')
    return (
      room.wall + (room.top - room.wall) * Math.max(0, Math.min(1, (p[1] - b[1]) / (b[3] - b[1])))
    );
  if (room.role === 'southAisle')
    return (
      room.wall + (room.top - room.wall) * Math.max(0, Math.min(1, (b[3] - p[1]) / (b[3] - b[1])))
    );
  if (room.role === 'chapel') return room.top;
  const k = 1 - room.axis,
    lo = b[k],
    hi = b[k + 2],
    mid = (lo + hi) / 2;
  return (
    room.wall + (room.top - room.wall) * Math.max(0, 1 - Math.abs(p[k] - mid) / ((hi - lo) / 2))
  );
}
function splitPlan(r, k, value, sign) {
  const ps = [];
  let a = r.at(-1),
    av = (a[k] - value) * sign;
  for (const b of r) {
    const bv = (b[k] - value) * sign;
    if (av >= 0 !== bv >= 0) ps.push(lerp(a, b, av / (av - bv)));
    if (bv >= 0) ps.push(b);
    a = b;
    av = bv;
  }
  return ps;
}
function roomRoof(face, room) {
  const r = room.r,
    b = bounds(r),
    k = 1 - room.axis,
    mid = (b[k] + b[k + 2]) / 2,
    y = (p) => floor + roofHeight(room, p);
  if (room.role.endsWith('Aisle') || room.role === 'chapel') cap(face, r, y, 'roof');
  else
    for (const sign of [-1, 1]) {
      const p = splitPlan(r, k, mid, sign);
      if (p.length > 2) cap(face, p, y, 'roof');
    }
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i),
      points = [f.a, f.b];
    if ((f.a[k] - mid) * (f.b[k] - mid) < 0)
      points.splice(1, 0, lerp(f.a, f.b, (mid - f.a[k]) / (f.b[k] - f.a[k])));
    for (let j = 0; j < points.length - 1; j++) {
      const a = points[j],
        b = points[j + 1];
      face(
        'wall',
        [at(a, room.wall), at(b, room.wall), at(b, y), at(a, y)],
        [f.normal[0], 0, f.normal[1]],
      );
    }
  }
}
function exterior(h, owner) {
  const p = h.center.map((v, k) => v + h.normal[k] * 0.4),
    y = h.bottom - floor + h.height * 0.35;
  return (
    !rooms.some((r) => r.name !== owner && inside(p, r.r) && y < roofHeight(r, p) + 0.2) &&
    !(inside(p, tower) && y > H.towerBase)
  );
}
export function gilesFields() {
  const hs = [];
  function add(room, n, count, w, b, h, s, tag = 'window', shape = 'pointed') {
    const f = edge(room.r, n);
    if (!f || f.length < 1.5) return;
    count = Math.min(count, Math.max(1, Math.floor(f.length / (w + 0.8))));
    for (let i = 0; i < count; i++) {
      const q = hole(
        `${room.name}-${n.join(',')}-${tag}-${i}`,
        lerp(f.a, f.b, (i + 0.5) / count),
        f.axis,
        f.normal,
        Math.min(w, (f.length * 0.7) / count),
        b,
        h,
        s,
        shape,
        3.0,
      );
      q.owner = room.name;
      q.kind = tag;
      if (exterior(q, room.name)) hs.push(q);
    }
  }
  for (const room of rooms) {
    if (room.role === 'nave') {
      add(room, [-1, 0], 1, 5.7, 6.0, 9.4, 6.1);
      add(room, [1, 0], 1, 6.2, 3.5, 11.6, 7.7);
      add(room, [-1, 0], 1, 3.0, 0.15, 5.3, 3.6, 'door');
    } else if (room.role === 'transept')
      for (const n of [
        [0, -1],
        [0, 1],
      ])
        add(room, n, 1, 5.7, 3.7, 11.2, 7.5);
    else if (room.role.endsWith('Aisle')) {
      const sign = room.role === 'northAisle' ? -1 : 1;
      add(room, [0, sign], 7, 2.7, 3.4, 7.2, 4.8);
      add(room, [1, 0], 1, 3.6, 3.5, 8.0, 5.4);
      const f = edge(room.r, [-1, 0]);
      if (f) {
        for (const [t, kind] of [
          [0.27, 'window'],
          [0.76, 'blind'],
        ]) {
          const h = hole(
            `${room.name}-west-${kind}`,
            lerp(f.a, f.b, sign < 0 ? 1 - t : t),
            f.axis,
            f.normal,
            Math.min(kind === 'blind' ? 2.4 : 3.4, f.length * 0.36),
            3.5,
            7.4,
            5.2,
            'pointed',
            3,
          );
          h.owner = room.name;
          h.kind = kind;
          if (exterior(h, room.name)) hs.push(h);
        }
      }
    } else if (room.role === 'chapel') {
      for (const n of [
        [1, 0],
        [0, 1],
        [-1, 0],
      ])
        add(room, n, n[0] === 0 ? 3 : 1, 1.7, 3.8, 8.5, 5.9);
    } else {
      const sign = room.role === 'northRange' ? -1 : 1;
      if (room.top <= 7) {
        add(room, [0, sign], 2, 1.8, 1.0, 3.0, 2.1);
        continue;
      }
      add(room, [0, sign], 4, 2.6, 3.2, 7.3, 5.0);
      for (const n of [
        [-1, 0],
        [1, 0],
      ])
        add(room, n, 1, 2.3, 3.7, 6.3, 4.3);
    }
  }
  return hs;
}
export function gilesTowerFields() {
  const hs = [];
  for (const n of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const f = edge(tower, n);
    for (const t of [0.27, 0.5, 0.73]) {
      const h = hole(
        `tower-louver-${n.join(',')}-${t}`,
        lerp(f.a, f.b, t),
        f.axis,
        f.normal,
        1.35,
        20.7,
        5.5,
        4.3,
        'pointed',
        3,
      );
      h.kind = 'louver';
      hs.push(h);
    }
  }
  return hs;
}
function panel(face, h, d) {
  const slot =
      h.kind === 'door'
        ? 'door'
        : h.kind === 'blind'
          ? 'wall'
          : h.kind === 'louver'
            ? 'metal'
            : 'glass',
    depth = h.kind === 'blind' ? 0.55 : 1.0;
  pane(face, h, d, d >= 2 ? -depth : 0.14, slot);
  if (d < 2) return;
  archBand(face, h, d, 0.24, 'trim', 0.12);
  const p = prepareOpening(h, 0, d),
    normalOffset = -0.85 * Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  const pt = (u, y) => p.point(u, y, normalOffset);
  if (h.kind === 'louver') {
    for (let y = h.bottom + 0.3; y < h.bottom + h.spring; y += 0.55)
      beam(face, pt(-h.width * 0.42, y), pt(h.width * 0.42, y), 0.12, 'trim');
  } else if (!['door', 'blind'].includes(h.kind)) {
    const n = h.width > 5 ? 4 : h.width > 3 ? 3 : 2;
    for (let i = 1; i < n; i++)
      beam(
        face,
        pt(-h.width / 2 + (h.width * i) / n, h.bottom),
        pt(-h.width / 2 + (h.width * i) / n, h.bottom + h.spring),
        0.12,
        'trim',
      );
    if (h.height > 6)
      beam(
        face,
        pt(-h.width * 0.46, h.bottom + h.height * 0.42),
        pt(h.width * 0.46, h.bottom + h.height * 0.42),
        0.12,
        'trim',
      );
    // Sparse geometric tracery above the mullions; no per-building stained-glass image.
    if (d >= 3) {
      const rad = h.width * 0.2,
        cy = h.bottom + h.spring + 0.15,
        segments = 12;
      for (let i = 0; i < segments; i++)
        beam(
          face,
          pt(
            Math.cos((i * 2 * Math.PI) / segments) * rad,
            cy + Math.sin((i * 2 * Math.PI) / segments) * rad,
          ),
          pt(
            Math.cos(((i + 1) * 2 * Math.PI) / segments) * rad,
            cy + Math.sin(((i + 1) * 2 * Math.PI) / segments) * rad,
          ),
          0.1,
          'trim',
        );
    }
  } else if (h.kind === 'blind')
    for (const u of [-h.width * 0.22, h.width * 0.22])
      beam(face, pt(u, h.bottom + 0.2), pt(u, h.bottom + h.spring - 0.2), 0.18, 'trim');
}
function cone(face, r, b, t, slot = 'trim') {
  const p = center(r);
  for (let i = 0; i < r.length; i++)
    face(slot, [at(r[i], b), at(r[(i + 1) % r.length], b), at(p, t)], [0, 1, 0]);
}
function pinnacle(face, p, b, height, d, width = 0.7) {
  if (d === 0) {
    cone(
      face,
      R(p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2),
      b,
      b + height,
      'trim',
    );
    return;
  }
  solid(
    face,
    R(p[0] - width * 0.52, p[1] - width * 0.52, p[0] + width * 0.52, p[1] + width * 0.52),
    b,
    b + height * 0.47,
    'trim',
  );
  cone(
    face,
    regular(p, width * 0.56, d >= 3 ? 8 : 4, Math.PI / 4),
    b + height * 0.47,
    b + height,
    'trim',
  );
}
export function gilesCrownRibs(d = 3) {
  const starts = tower.flatMap((p, i) => [p, lerp(p, tower[(i + 1) % tower.length], 0.5)]),
    segments = d === 0 ? 2 : d === 1 ? 5 : d === 2 ? 9 : d === 3 ? 14 : 18;
  return starts.map((p) =>
    Array.from({ length: segments + 1 }, (_, j) => {
      const t = j / segments,
        r = Math.sqrt(Math.max(0, 1 - t * t));
      return [
        ct[0] + (p[0] - ct[0]) * r,
        floor + H.crownBase + (H.crownJoin - H.crownBase) * t,
        ct[1] + (p[1] - ct[1]) * r,
      ];
    }),
  );
}
function crown(face, d) {
  const width = d === 0 ? 0.66 : d === 1 ? 0.58 : 0.48;
  for (const rib of gilesCrownRibs(d))
    for (let j = 0; j < rib.length - 1; j++) beam(face, rib[j], rib[j + 1], width, 'trim');
  const r = scaled(tower, 1.035),
    inner = scaled(tower, 0.88);
  sides(face, r, H.towerWall, H.crownBase, 'trim');
  sides(face, inner, H.towerWall, H.crownBase, 'trim', true);
  cap(face, r, H.crownBase, 'trim', [inner]);
  solid(
    face,
    R(ct[0] - 0.21, ct[1] - 0.21, ct[0] + 0.21, ct[1] + 0.21),
    H.crownBase,
    H.crownJoin,
    'trim',
  );
  for (const p of tower) pinnacle(face, p, H.crownBase, 3.6, d, 0.88);
  const rings = [
    [34.4, 0.62],
    [35.2, 0.62],
    [35.2, 0.46],
    [36.3, 0.38],
    [36.3, 0.62],
    [36.6, 0.62],
    [36.6, 0.37],
    [37.4, 0.24],
  ];
  for (let i = 0; i < rings.length - 1; i++) {
    const [a, ra] = rings[i],
      [b, rb] = rings[i + 1];
    if (b === a) continue;
    const r = regular(ct, ra, d >= 2 ? 8 : 4, Math.PI / 4);
    if (Math.abs(ra - rb) < 0.01) solid(face, r, a, b, 'trim');
    else
      for (let j = 0; j < r.length; j++) {
        const next = regular(ct, rb, r.length, Math.PI / 4),
          k = (j + 1) % r.length;
        face('trim', [at(r[j], a), at(r[k], a), at(next[k], b), at(next[j], b)]);
      }
  }
  cone(face, regular(ct, 0.24, d >= 2 ? 8 : 4), 37.4, 38.2, 'trim');
  beam(
    face,
    [ct[0], floor + 38.1, ct[1]],
    [ct[0], floor + 39, ct[1]],
    d === 0 ? 0.19 : 0.12,
    'metal',
  );
  if (d >= 1)
    beam(
      face,
      [ct[0] - 0.48, floor + 38.7, ct[1]],
      [ct[0] + 0.48, floor + 38.7, ct[1]],
      0.1,
      'metal',
    );
  if (d >= 2) {
    for (let i = 0; i < tower.length; i++) {
      const f = faceFrame(tower, i);
      for (let j = 0; j < 5; j++) {
        const a = lerp(f.a, f.b, (j + 0.12) / 5),
          b = lerp(f.a, f.b, (j + 0.88) / 5);
        beam(face, at(a, H.crownBase + 0.05), at(b, H.crownBase + 1.1), 0.13, 'trim');
        beam(face, at(a, H.crownBase + 1.1), at(b, H.crownBase + 0.05), 0.13, 'trim');
      }
    }
  }
}
function buttresses(face, d) {
  const fields = gilesFields();
  for (const room of rooms)
    for (let i = 0; i < room.r.length; i++) {
      const f = faceFrame(room.r, i);
      if (f.length < 5.5) continue;
      const count = Math.max(1, Math.round(f.length / 6.5));
      for (let j = 0; j <= count; j++) {
        const p = lerp(f.a, f.b, (j + 0.04) / (count + 0.08)),
          outside = p.map((v, k) => v + f.normal[k] * 0.55);
        if (rooms.some((r) => r.name !== room.name && inside(outside, r.r))) continue;
        if (
          d <= 1 &&
          !(room.role === 'nave' && Math.abs(f.normal[0]) > 0.7) &&
          !(d === 1 && room.role === 'chapel' && (j === 0 || j === count))
        )
          continue;
        const high = room.wall + (room.role === 'nave' ? 2.3 : 0),
          q = p.map((v, k) => v + f.normal[k] * 0.35),
          w = d === 0 ? 0.8 : 1.0;
        if (
          fields.some((h) => {
            const delta = q.map((v, k) => v - h.center[k]);
            return (
              h.normal[0] * f.normal[0] + h.normal[1] * f.normal[1] > 0.7 &&
              Math.abs(delta[0] * h.normal[0] + delta[1] * h.normal[1]) < 1.5 &&
              Math.abs(delta[0] * h.axis[0] + delta[1] * h.axis[1]) < h.width / 2 + 0.7
            );
          })
        )
          continue;
        if (d >= 1) {
          solid(
            face,
            R(q[0] - w * 0.55, q[1] - w * 0.55, q[0] + w * 0.55, q[1] + w * 0.55),
            footing,
            high * 0.5,
            'trim',
          );
          solid(
            face,
            R(q[0] - w * 0.43, q[1] - w * 0.43, q[0] + w * 0.43, q[1] + w * 0.43),
            high * 0.5,
            high,
            'trim',
          );
        }
        pinnacle(face, q, high, 2.4, d, 0.65);
      }
    }
}
function entrance(face, d) {
  const h = gilesFields().find((h) => h.kind === 'door'),
    width = 3.7,
    len = 4,
    steps = d === 0 ? 1 : d === 1 ? 3 : 7,
    front = h.center,
    point = (u, v) => front.map((x, k) => x + h.axis[k] * u + h.normal[k] * v),
    lower = Math.min(...[-width, width].map((u) => gilesGround(...point(u, len)))),
    top = 0.15;
  for (let i = 0; i < steps; i++) {
    const a = (i * len) / steps,
      b = ((i + 1) * len) / steps,
      ta = top - ((floor + top - lower) * i) / steps,
      tb = top - ((floor + top - lower) * (i + 1)) / steps,
      r = [point(-width, a), point(width, a), point(width, b), point(-width, b)],
      heights = d === 0 ? [ta, ta, tb, tb] : [ta, ta, ta, ta];
    face(
      'stone',
      r.map((p, i) => at(p, heights[i])),
      [0, 1, 0],
    );
    if (d > 0)
      face(
        'stone',
        [at(r[2], tb), at(r[3], tb), at(r[3], ta), at(r[2], ta)],
        [h.normal[0], 0, h.normal[1]],
      );
    for (const [x, y] of [
      [0, 3],
      [1, 2],
    ])
      face('stone', [
        at(r[x], footing),
        at(r[y], footing),
        at(r[y], heights[y]),
        at(r[x], heights[x]),
      ]);
  }
}
function build(out, d) {
  const makeFace = (base) => (slot, p, n, col) => {
    const max = d === 0 ? 36 : d === 1 ? 22 : 16;
    function split(t) {
      const lengths = t.map((a, i) => Math.hypot(...a.map((v, k) => v - t[(i + 1) % 3][k]))),
        len = Math.max(...lengths),
        i = lengths.indexOf(len);
      if (len <= max) {
        base(slot, t, n, col);
        return;
      }
      const j = (i + 1) % 3,
        k = (i + 2) % 3,
        m = lerp(t[i], t[j], 0.5);
      split([t[i], m, t[k]]);
      split([m, t[j], t[k]]);
    }
    for (let i = 1; i < p.length - 1; i++) split([p[0], p[i], p[i + 1]]);
  };
  const face = makeFace(writer(out, d));
  // The raw foundation cap preserves the map envelope; skyline walls omit tiny buttress notches.
  for (const p of rec.main.polygons) {
    sides(face, d === 0 ? coarse(p.outline) : p.outline, footing, 0, 'stone');
    cap(face, p.outline, 0, 'stone', p.holes);
  }
  const fields = gilesFields(),
    roofFace =
      d >= 2
        ? makeFace(
            writer(
              masked(
                out,
                fields.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
              ),
              d,
            ),
          )
        : face;
  for (const room of rooms) {
    const hs = fields;
    if (d >= 2) shell(out, d, room.r, 0, room.wall, hs);
    else sides(face, room.r, 0, room.wall, 'wall');
    roomRoof(roofFace, room);
    if (d >= 1) {
      band(roofFace, room.r, room.wall - 0.2, 0.35, 'trim', 1.005);
      for (const h of fields.filter((h) => h.owner === room.name)) panel(face, h, d);
    }
  }
  if (d >= 2) shell(out, d, tower, 0, H.towerWall, [...fields, ...gilesTowerFields()]);
  else sides(face, tower, 0, H.towerWall, 'wall');
  cap(face, tower, H.towerWall, 'roof');
  if (d >= 1) {
    for (const h of gilesTowerFields()) panel(face, h, d);
    band(face, tower, 20.2, 0.28, 'trim', 1.015);
  }
  crown(face, d);
  buttresses(face, d);
  const nw = [-31.45, -15.8];
  solid(face, regular(nw, 1.2, d >= 2 ? 8 : 6), footing, 19.2, 'wall');
  cone(face, regular(nw, 1.28, d >= 2 ? 8 : 6), 19.2, 23.3, 'roof');
  const chapel = rooms.find((r) => r.role === 'chapel');
  if (d >= 1) band(face, chapel.r, 13.4, 0.6, 'trim', 1.02);
  entrance(face, d);
}
export const buildGilesSkyline = (o) => build(o, 0),
  buildGilesDistrict = (o) => build(o, 1),
  buildGilesStreet = (o) => build(o, 2),
  buildGilesCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const gilesStudy = {
  id: 'N0358',
  key: 'st_giles_cathedral',
  title: "St Giles' Cathedral",
  category: 'cathedral',
  wikidataId: 'Q1547466',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID main way and thirteen current architectural parts, with unscaled plans and6/14/16/20/39m height tags. West entry, east choir and southeast chapel sign the frame.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked pictures not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared 256² coursed/raw sandstone, standing-seam metal, granite and plain wood graphs. Warm gray sandstone walls, pale trim, silver-gray lead-like roofs, stone foundation and brown door use linear tints and metric UVs. Flat blue-gray glass and restrained metallic finial/louvers. No embedded images, bespoke facade textures or baked weathering/shadows.',
  importReason:
    'Four browser levels retain the individual open eight-rib crown steeple, broad nave/aisles, Gothic fronts and southeast Thistle Chapel in the signed map frame.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from four useful inspected pictures and standard viewer PMTiles/DEM. Main masses use fourteen current controls and recorded aisle subtraction with sparse approximate windows, tracery, buttresses, turret, pinnacles, chapel and steps; body rings simplify map buttress notches within about1.4m while the foundation retains the raw envelope. Exact sculpture, adjacent monument/town buildings, lettering, stained-glass art, full interiors and certified walking excluded. Absolute thresholds and physical device timings pending.',
    'Skyline keeps the open eight-rib crown/finial, central tower, broad church roofs, main gable pinnacles, northwest turret and inclined entrance. District adds shared textures, flat windows/louvers/door and sparse stepped buttresses. Street opens recesses and adds mullions, crown railing and louver slats; closeup/master refine crown curves, pointed heads and sparse geometric tracery. Synthetic Swedish-cottage neighbors are not mapped Edinburgh buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('open-eight-rib-crown', [-31, 34, 33], [ct[0], 31.5, ct[1]]),
    cam('west-gothic-front', [-82, 22, 15], [-31, 11, -3]),
    cam('east-choir-and-thistle-chapel', [76, 30, 41], [28, 11, 3]),
    cam('northern-aisles-and-turret', [-25, 36, -75], [-5, 13, -12]),
    cam('roof-crossing-and-south-ranges', [37, 110, 69], [0, 16, 0]),
    cam('west-entry-and-window-tracery', [-60, 13, -2], [-31, 10, -3]),
  ],
};

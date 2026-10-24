/** Odesa Transfiguration: needle bell tower, three domes and classical porticoes. */
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
  '../../../content/worldgen/source/places/u8/u8m/transfiguration_cathedral/',
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
  wall: '#e4d3b3',
  trim: '#ece6da',
  roof: '#687078',
  spire: '#765b4b',
  stone: '#b0a695',
  door: '#765239',
  glass: '#4d6178',
  metal: '#c2a04f',
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
const footing = (p) => Math.min(floor - 0.3, odesaGround(...p) - 0.35);
export function odesaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Odesa footing outside retained terrain');
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
function gable(face, r, eave, top, slot = 'roof', axis = 0) {
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
    ]),
  control = (id) => rec.controls.find((b) => b.id === id),
  role = (n) => control(rec.roles[n]),
  ring = (n) => role(n).polygons[0].outline,
  bounds = (r) => [
    Math.min(...r.map((p) => p[0])),
    Math.min(...r.map((p) => p[1])),
    Math.max(...r.map((p) => p[0])),
    Math.max(...r.map((p) => p[1])),
  ],
  _H = rec.heights;
const rooms = [
    ...rec.bodyPlan.map((p, i) => ({ name: `body-${i}`, r: coarse(p.outline), wall: 10 })),
    { name: 'low-cross', r: coarse(ring('lowCross')), wall: 10 },
    { name: 'bell-base', r: ring('bellBase'), wall: 20 },
  ],
  tower = ring('belfry'),
  clock = ring('clock'),
  spirePlan = ring('spireBase'),
  _bellCenter = center(tower);
const domeRing = (a, d) =>
  Array.from({ length: d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : d === 3 ? 28 : 36 }, (_, i) => {
    const t = (i * 2 * Math.PI) / (d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : d === 3 ? 28 : 36);
    return [a.center[0] + a.radius[0] * Math.cos(t), a.center[1] + a.radius[1] * Math.sin(t)];
  });
export function odesaBelfryFields() {
  return [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ].map((n) => {
    const f = edge(tower, n),
      h = hole(
        `open-belfry-${n.join(',')}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        3.7,
        21.1,
        7.5,
        5.5,
        'round',
        16,
      );
    h.kind = 'open';
    return h;
  });
}
function outside(h, owner) {
  const p = h.center.map((v, k) => v + h.normal[k] * 0.35),
    y = h.bottom - floor + h.height * 0.4;
  return !rooms.some((r) => r.name !== owner && inside(p, r.r) && y < r.wall + 0.1);
}
export function odesaFields(d = 3) {
  const hs = [];
  for (const room of rooms)
    for (let i = 0; i < room.r.length; i++) {
      const f = faceFrame(room.r, i);
      if (f.length < 4) continue;
      const count = room.name === 'bell-base' ? 1 : Math.max(1, Math.floor(f.length / 5.0));
      for (let j = 0; j < count; j++) {
        const h = hole(
          `${room.name}-window-${i}-${j}`,
          lerp(f.a, f.b, (j + 0.5) / count),
          f.axis,
          f.normal,
          Math.min(room.name === 'bell-base' ? 3.3 : 2.0, (f.length * 0.62) / count),
          room.name === 'bell-base' ? 13.0 : 3.6,
          room.name === 'bell-base' ? 5.6 : 5.2,
          room.name === 'bell-base' ? 3.8 : 5.2,
          room.name === 'bell-base' ? 'round' : 'rect',
          3.2,
        );
        h.owner = room.name;
        h.kind = 'window';
        if (outside(h, room.name)) hs.push(h);
      }
    }
  for (const porch of rec.porches) {
    const back = edge(
        porch.plan.outline,
        porch.normal.map((v) => -v),
      ),
      p = lerp(back.a, back.b, 0.5),
      axis = [-porch.normal[1], porch.normal[0]],
      h = hole(`${porch.name}-entry`, p, axis, porch.normal, 3.1, 3.05, 5.7, 5.7, 'rect', 5);
    h.kind = 'door';
    hs.push(h);
  }
  for (const a of rec.domes) {
    const r = domeRing(a, d),
      count = a.name === 'mainDrum' ? 12 : 8;
    for (let i = 0; i < count; i++) {
      const angle = ((i + 0.2) * 2 * Math.PI) / count,
        n = [Math.cos(angle), Math.sin(angle)],
        f = r
          .map((_, i) => faceFrame(r, i))
          .sort(
            (a, b) =>
              b.normal[0] * n[0] + b.normal[1] * n[1] - (a.normal[0] * n[0] + a.normal[1] * n[1]),
          )[0],
        h = hole(
          `${a.name}-window-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          a.name === 'mainDrum' ? 1.1 : 0.8,
          a.bottom + 0.65,
          a.wall - a.bottom - 1.25,
          a.wall - a.bottom - 2.2,
          'round',
          3.2,
        );
      h.kind = 'window';
      h.owner = a.name;
      hs.push(h);
    }
  }
  const doors = hs.filter((h) => h.kind === 'door');
  return hs.filter(
    (h) =>
      h.kind !== 'window' ||
      !doors.some((door) => {
        const delta = h.center.map((v, k) => v - door.center[k]);
        return (
          h.normal[0] * door.normal[0] + h.normal[1] * door.normal[1] > 0.7 &&
          Math.abs(delta[0] * door.normal[0] + delta[1] * door.normal[1]) < 0.35 &&
          Math.abs(delta[0] * door.axis[0] + delta[1] * door.axis[1]) <
            (h.width + door.width) / 2 &&
          h.bottom < door.bottom + door.height &&
          door.bottom < h.bottom + h.height
        );
      }),
  );
}
function panel(face, h, d) {
  pane(face, h, d, d >= 2 ? -1.05 : 0.13, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, 0.18, 'trim', 0.12);
  if (h.kind === 'door') return;
  const p = prepareOpening(h, 0, d),
    off = -0.88 * Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    point = (u, y) => p.point(u, y, off);
  if (h.width > 1.4) {
    beam(face, point(0, h.bottom), point(0, h.bottom + h.spring), 0.1, 'trim');
    beam(
      face,
      point(-h.width * 0.44, h.bottom + h.height * 0.47),
      point(h.width * 0.44, h.bottom + h.height * 0.47),
      0.1,
      'trim',
    );
  }
}
function _cone(face, r, b, t, slot = 'spire') {
  const p = center(r);
  for (let i = 0; i < r.length; i++)
    face(slot, [at(r[i], b), at(r[(i + 1) % r.length], b), at(p, t)], [0, 1, 0]);
}
function profile(face, p, radii, levels, d, slot = 'spire') {
  const n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : d === 3 ? 20 : 28,
    rings = levels.map(([y, f]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return [p[0] + radii[0] * Math.cos(a) * f, floor + y, p[1] + radii[1] * Math.sin(a) * f];
      }),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(
        slot,
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        [
          rings[j - 1][i][0] + rings[j - 1][k][0] - 2 * p[0],
          0,
          rings[j - 1][i][2] + rings[j - 1][k][2] - 2 * p[1],
        ],
      );
    }
  cap(
    face,
    rings.at(-1).map((p) => [p[0], p[2]]),
    levels.at(-1)[0],
    slot,
  );
}
function crossFinial(face, p, b, top, d) {
  const w = d === 0 ? 0.26 : d === 1 ? 0.2 : 0.12;
  beam(face, [p[0], floor + b, p[1]], [p[0], floor + top, p[1]], w, 'metal');
  if (d === 0) {
    const y = floor + top - (top - b) * 0.32,
      l = (top - b) * 0.2;
    face(
      'metal',
      [
        [p[0] - l, y - w / 2, p[1]],
        [p[0] + l, y - w / 2, p[1]],
        [p[0] + l, y + w / 2, p[1]],
        [p[0] - l, y + w / 2, p[1]],
      ],
      [0, 0, 1],
    );
    return;
  }
  const y = floor + top - (top - b) * 0.32,
    l = (top - b) * 0.22;
  beam(face, [p[0] - l, y, p[1]], [p[0] + l, y, p[1]], w, 'metal');
}
function domes(out, face, roofFace, d) {
  const fields = odesaFields(d);
  for (const a of rec.domes) {
    const r = domeRing(a, d),
      hs = fields.filter((h) => h.owner === a.name);
    // A short support behind the roof intersection prevents a visible floating drum.
    if (d >= 2) shell(out, d, r, 10, a.wall, hs);
    else sides(face, r, 10, a.wall, 'wall');
    if (d >= 1) {
      band(roofFace, r, a.wall - 0.18, 0.36, 'trim', 1.025);
      band(roofFace, r, 12, 0.35, 'trim', 1.02);
      for (const h of hs) panel(face, h, d);
    }
    const levels = d === 0 ? 2 : d === 1 ? 4 : d === 2 ? 7 : d === 3 ? 11 : 15,
      rows = [];
    for (let j = 0; j <= levels; j++) {
      const t = (j * Math.PI) / (2 * levels);
      rows.push([a.wall + a.domeHeight * Math.sin(t), Math.cos(t)]);
    }
    profile(face, a.center, a.radius, rows, d, 'spire');
    const top = a.wall + a.domeHeight;
    profile(
      face,
      a.center,
      [0.48, 0.48],
      [
        [top - 0.1, 0.65],
        [top + 0.4, 1],
        [top + 0.85, 0.65],
      ],
      d,
      'metal',
    );
    crossFinial(face, a.center, top + 0.7, top + a.finialHeight, d);
  }
}
export function odesaColumns(d = 3) {
  const cols = [];
  for (const porch of rec.porches) {
    if (porch.name === 'east') {
      for (const id of rec.columnControls) {
        const r = control(id).polygons[0].outline;
        cols.push({ name: `mapped-column-${id}`, plan: r, center: center(r), bottom: 3, top: 10 });
      }
      continue;
    }
    const f = edge(porch.plan.outline, porch.normal),
      count = d === 0 && ['north', 'south'].includes(porch.name) ? 2 : 4;
    for (let i = 0; i < count; i++) {
      const t = count === 2 ? (i === 0 ? 0.1 : 0.9) : 0.1 + (i * 0.8) / 3,
        p = lerp(f.a, f.b, t).map((v, k) => v - porch.normal[k] * 0.55);
      cols.push({
        name: `${porch.name}-column-${i}`,
        plan: regular(p, 0.85, 8, Math.PI / 8),
        center: p,
        bottom: 3,
        top: 10,
      });
    }
  }
  return cols;
}
function porticoes(face, d) {
  for (const p of rec.porches)
    solid(face, d === 0 ? coarse(p.plan.outline) : p.plan.outline, 0, 3, 'stone');
  for (const c of odesaColumns(d)) {
    if (d === 0) {
      sides(face, scaled(c.plan, 0.62), 3, 10, 'trim');
      continue;
    }
    solid(face, c.plan, 3, 3.4, 'trim');
    solid(face, scaled(c.plan, 0.62), 3.4, 9.35, 'trim');
    solid(face, scaled(c.plan, 1.04), 9.35, 10, 'trim');
  }
}
function clocks(face, d) {
  if (d === 0) return;
  for (const n of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const f = edge(clock, n),
      p = lerp(f.a, f.b, 0.5),
      h = hole('clock', p, f.axis, f.normal, 3.0, 30.85, 3.0, 0, 'round', 3),
      prepared = prepareOpening(h, 0, d),
      sign = Math.sign(-prepared.axis[1] * n[0] + prepared.axis[0] * n[1]),
      pt = (u, v, offset = 0.14) => prepared.point(u, floor + 32.35 + v, offset * sign),
      N = d >= 3 ? 32 : 16,
      points = Array.from({ length: N }, (_, i) =>
        pt(Math.cos((i * 2 * Math.PI) / N) * 1.5, Math.sin((i * 2 * Math.PI) / N) * 1.5),
      );
    face('glass', points, [n[0], 0, n[1]], colors.trim);
    beam(face, pt(0, 0, 0.23), pt(-0.62, 0.65, 0.23), 0.09, 'spire');
    beam(face, pt(0, 0, 0.23), pt(0.83, 0.08, 0.23), 0.08, 'spire');
    if (d >= 3)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        beam(
          face,
          pt(Math.sin(a) * 1.26, Math.cos(a) * 1.26, 0.24),
          pt(Math.sin(a) * 1.4, Math.cos(a) * 1.4, 0.24),
          0.08,
          'spire',
        );
      }
  }
}
function bell(out, face, roofFace, d) {
  const open = odesaBelfryFields();
  if (d >= 1) shell(out, d, tower, 20, 30, open, 'wall', scaled(tower, 0.64));
  else {
    for (const p of tower)
      solid(face, R(p[0] - 0.9, p[1] - 0.9, p[0] + 0.9, p[1] + 0.9), 20, 30, 'trim');
  }
  solid(face, clock, 30, 35, 'wall');
  if (d >= 1) {
    band(roofFace, tower, 20, 0.4, 'trim', 1.055);
    band(roofFace, tower, 29.4, 0.6, 'trim', 1.055);
    band(roofFace, clock, 34.5, 0.5, 'trim', 1.08);
    clocks(face, d);
  }
  const p = center(spirePlan),
    b = bounds(spirePlan),
    rx = (b[2] - b[0]) / 2,
    rz = (b[3] - b[1]) / 2;
  profile(
    face,
    p,
    [rx, rz],
    [
      [35, 0.76],
      [35.55, 1.03],
      [36.2, 1.08],
      [37, 0.86],
    ],
    d,
  );
  profile(
    face,
    p,
    [rx, rz],
    [
      [37, 0.86],
      [67.8, 0.13],
      [69.0, 0.17],
      [69.7, 0.06],
    ],
    d,
  );
  profile(
    face,
    p,
    [0.45, 0.45],
    [
      [69.5, 0.5],
      [69.9, 1],
      [70.2, 0.45],
    ],
    d,
    'metal',
  );
  crossFinial(face, p, 70.0, 72, d);
}
function pilasters(face, d) {
  if (d < 2) return;
  const fields = odesaFields(d);
  for (const room of rooms)
    for (let i = 0; i < room.r.length; i++) {
      const f = faceFrame(room.r, i);
      if (f.length < 5 || room.name === 'bell-base') continue;
      const count = Math.max(1, Math.round(f.length / 5));
      for (let j = 0; j <= count; j++) {
        const p = lerp(f.a, f.b, (j + 0.06) / (count + 0.12)),
          h = { center: p, normal: f.normal, bottom: floor + 3, height: 6 };
        if (!outside(h, room.name)) continue;
        if (
          fields.some(
            (h) =>
              Math.abs((p[0] - h.center[0]) * h.axis[0] + (p[1] - h.center[1]) * h.axis[1]) <
                h.width * 0.5 + 0.3 &&
              Math.abs((p[0] - h.center[0]) * h.normal[0] + (p[1] - h.center[1]) * h.normal[1]) <
                1.2,
          )
        )
          continue;
        const q = p.map((v, k) => v + f.normal[k] * 0.12);
        solid(face, R(q[0] - 0.34, q[1] - 0.34, q[0] + 0.34, q[1] + 0.34), 3.1, 9.55, 'trim');
      }
    }
}
function stairs(face, d) {
  for (const p of rec.porches) {
    const f = edge(p.plan.outline, p.normal),
      mid = lerp(f.a, f.b, 0.5),
      width = Math.min(4.6, f.length * 0.43),
      len = 6,
      point = (u, v) => mid.map((x, k) => x + f.axis[k] * u + p.normal[k] * v),
      lower = Math.min(...[-width, width].map((u) => odesaGround(...point(u, len)))),
      steps = d === 0 ? 1 : d === 1 ? 5 : 15;
    for (let i = 0; i < steps; i++) {
      const a = (i * len) / steps,
        b = ((i + 1) * len) / steps,
        top = 3 - ((floor + 3 - lower) * i) / steps,
        next = 3 - ((floor + 3 - lower) * (i + 1)) / steps,
        r = [point(-width, a), point(width, a), point(width, b), point(-width, b)],
        ys = d === 0 ? [top, top, next, next] : [top, top, top, top];
      face(
        'stone',
        r.map((p, k) => at(p, ys[k])),
        [0, 1, 0],
      );
      if (d > 0)
        face(
          'stone',
          [at(r[2], next), at(r[3], next), at(r[3], top), at(r[2], top)],
          [p.normal[0], 0, p.normal[1]],
        );
      for (const [x, y] of [
        [0, 3],
        [1, 2],
      ])
        face('stone', [at(r[x], footing), at(r[y], footing), at(r[y], ys[y]), at(r[x], ys[x])]);
    }
  }
}
function build(out, d) {
  const makeFace = (base) => (slot, p, n, col) => {
      const max = d === 0 ? 36 : d === 1 ? 24 : 16;
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
    },
    face = makeFace(writer(out, d)),
    fields = odesaFields(d),
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
  for (const p of rec.main.polygons) {
    sides(face, d === 0 ? coarse(p.outline) : p.outline, footing, 0.1, 'stone');
    cap(face, p.outline, 0.1, 'stone', p.holes);
  }
  for (const room of rooms) {
    if (d >= 2) shell(out, d, room.r, 0, room.wall, fields);
    else sides(face, room.r, 0, room.wall, 'wall');
    cap(roofFace, room.r, room.wall, 'roof');
    if (d >= 1) band(roofFace, room.r, room.wall - 0.3, 0.3, 'trim', 1.01);
  }
  if (d >= 1) for (const h of fields.filter((h) => !h.owner?.includes('Drum'))) panel(face, h, d);
  gable(roofFace, ring('longRoof'), 10, 12, 'roof', 0);
  gable(roofFace, ring('crossRoof'), 10, 12, 'roof', 1);
  hip(roofFace, ring('lowCross'), 10, 12, 'roof', 1);
  porticoes(face, d);
  bell(out, face, roofFace, d);
  domes(out, face, roofFace, d);
  pilasters(face, d);
  stairs(face, d);
}
export const buildOdesaSkyline = (o) => build(o, 0),
  buildOdesaDistrict = (o) => build(o, 1),
  buildOdesaStreet = (o) => build(o, 2),
  buildOdesaCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const odesaStudy = {
  id: 'transfiguration_cathedral',
  key: 'transfiguration_cathedral',
  title: 'Transfiguration Cathedral',
  category: 'cathedral',
  wikidataId: 'Q2299324',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Reference coordinate, distinctive cathedral ensemble in two pictures and nineteen current unscaled map controls. Exact mapped QID association unavailable; approximate visualization facing.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256-square lime-plaster, standing-seam metal, cast-bronze, granite and plain-wood graphs. Cream walls/white trim, gray roofs, bronze-brown domes/spire, stone footings/steps and wood doors use linear tints/metric UVs. Blue-gray glazing, cream clock faces and restrained gold finials use flat colors. No embedded images, per-building textures or baked weathering/shadows.',
  importReason:
    'Four browser levels retain the tall needle bell tower, three domes, cruciform low roof and open classical porticoes at the approximate signed map placement.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior visualization from2025 tree-obscured street photo and older2021 aerial arrangement. Exact repair/damage and roof coverage after the2023 attack are not established; roof/ornament is a visual approximation, not a restoration claim. Retained1936 destruction metadata concerns the older structure and does not date the photographed modern rebuilding. Precise monument/pavilion/landscaping, sculpture, text/icons, clock numerals, full interiors and certified walking excluded. Physical device timings pending.',
    'Skyline keeps tall needle, three domes, open belfry/post colonnades, low cross roofs and inclined entries. District adds shared textures, flat glazing/doors/clock faces, actual belfry arches, column bases/capitals and coarse steps. Street opens wall/drum recesses and adds sparse window mullions/pilasters; closeup/master refine curves, profiles, arch facets and clock marks. Western/side columns, dome caps, spire above37m and entry transitions are estimated; eastern column controls and raw height/min_height tags are retained. Synthetic neighbors are not mapped Odesa buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('needle-clock-and-open-belfry', [-99, 52, 59], [-43, 43, 2]),
    cam('west-columned-entry', [-94, 14, 9], [-49, 9, 2]),
    cam('three-domes-and-crossing', [17, 49, 72], [4, 22, 2]),
    cam('eastern-four-column-portico', [83, 24, 34], [37, 10, 3]),
    cam('cream-classical-long-facade', [-9, 20, -73], [-5, 9, -13]),
    cam('roof-arrangement', [0, 139, 56], [-1, 13, 2]),
  ],
};

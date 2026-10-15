/** Ljubljana: twin tiered copper bell towers, green dome and red classical roof ranges. */
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
  '../../../content/worldgen/source/places/u2/u24/n0360_ljubljana_cathedral/',
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
  wall: '#e6d8bc',
  trim: '#dedcd3',
  roof: '#9c6655',
  green: '#819c8b',
  stone: '#b0a695',
  door: '#72533c',
  glass: '#536473',
  accent: '#363d3c',
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
const footing = (p) => Math.min(floor - 0.3, ljubljanaGround(...p) - 0.35);
export function ljubljanaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Ljubljana footing outside retained terrain');
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
const control = (n) => rec.controls.find((b) => b.id === rec.roles[n]),
  ring = (n) => control(n).polygons[0].outline,
  bounds = (r) => [
    Math.min(...r.map((p) => p[0])),
    Math.min(...r.map((p) => p[1])),
    Math.max(...r.map((p) => p[0])),
    Math.max(...r.map((p) => p[1])),
  ],
  mid = (r) => {
    const b = bounds(r);
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  };
const rooms = [
  { name: 'lower-body', r: coarse(rec.main.polygons[0].outline), wall: 6.6 },
  { name: 'nave', r: rec.navePlan, wall: 11 },
  { name: 'cross', r: rec.crossPlan, wall: 11 },
  { name: 'choir', r: rec.eastPlan, wall: 11 },
  ...['northTower', 'southTower'].map((name) => ({ name, r: coarse(ring(name)), wall: 19 })),
];
const towerRoles = ['northTower', 'southTower'],
  gold = [0.521, 0.352, 0.122];
function outside(h, owner) {
  const q = h.center.map((v, k) => v + h.normal[k] * 0.9);
  return !rooms.some((r) => r.name !== owner && r.wall > h.bottom - floor + 0.2 && inside(q, r.r));
}
export function ljubljanaFields(_d = 4) {
  const hs = [];
  for (const room of rooms)
    for (let i = 0; i < room.r.length; i++) {
      const f = faceFrame(room.r, i);
      if (f.length < 3 || (f.normal[0] < -0.8 && !towerRoles.includes(room.name))) continue;
      const tower = towerRoles.includes(room.name),
        count =
          tower || (room.name === 'cross' && Math.abs(f.normal[1]) > 0.8)
            ? 1
            : Math.max(1, Math.round(f.length / 5.2));
      const rows = tower
        ? [{ b: 14.3, h: 3.8, w: 2.65, shape: 'round', kind: 'louver' }]
        : room.name === 'lower-body'
          ? [
              { b: 1, h: 2.1, w: 1.4, shape: 'round' },
              { b: 4, h: 1.25, w: 1.5, shape: 'round' },
            ]
          : room.name === 'cross' && Math.abs(f.normal[1]) > 0.8
            ? [{ b: 6.8, h: 4, w: 3.8, shape: 'round' }]
            : [{ b: 8.6, h: 1.55, w: 2.4, shape: 'round' }];
      for (let j = 0; j < count; j++)
        for (const row of rows) {
          const p = lerp(f.a, f.b, (j + 0.5) / count),
            h = hole(
              `${room.name}-${i}-${j}-${row.b}`,
              p,
              f.axis,
              f.normal,
              Math.min(row.w, (f.length / count) * 0.58),
              row.b,
              row.h,
              row.shape === 'round' ? row.h * 0.65 : row.h,
              row.shape,
              3,
            );
          h.owner = room.name;
          h.kind = row.kind ?? 'glass';
          if (outside(h, room.name)) hs.push(h);
        }
    }
  for (const door of rec.doors) {
    const a = [-door.normal[1], door.normal[0]],
      h = hole(
        door.name,
        door.p,
        a,
        door.normal,
        door.width,
        door.bottom,
        door.height,
        door.height * 0.72,
        'round',
        4,
      );
    h.kind = 'door';
    hs.push(h);
  }
  const drum = ring('domeDrum');
  for (let i = 0; i < drum.length; i++) {
    const f = faceFrame(drum, i),
      h = hole(
        `dome-drum-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        Math.min(1.9, f.length * 0.5),
        12.7,
        3.45,
        2.4,
        'round',
        3,
      );
    h.owner = 'domeDrum';
    h.kind = 'glass';
    hs.push(h);
  }
  return hs.filter(
    (h) =>
      h.kind === 'door' ||
      !hs.some(
        (q) =>
          q.kind === 'door' &&
          Math.abs(h.normal[0] * q.normal[0] + h.normal[1] * q.normal[1]) > 0.9 &&
          Math.abs(
            (h.center[0] - q.center[0]) * h.normal[0] + (h.center[1] - q.center[1]) * h.normal[1],
          ) < 1 &&
          Math.abs(
            (h.center[0] - q.center[0]) * h.axis[0] + (h.center[1] - q.center[1]) * h.axis[1],
          ) <
            (h.width + q.width) / 2 + 0.2 &&
          h.bottom < q.bottom + q.height &&
          q.bottom < h.bottom + h.height,
      ),
  );
}
function panel(face, h, d) {
  pane(
    face,
    h,
    d,
    d >= 2 ? -0.72 : 0.12,
    h.kind === 'door' ? 'door' : h.kind === 'louver' ? 'accent' : 'glass',
  );
  if (d < 2) return;
  archBand(face, h, d, 0.17, 'trim', 0.13);
  const p = prepareOpening(h, 0, d),
    off = -0.56 * Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    point = (u, y) => p.point(u, y, off);
  if (h.kind === 'door') return;
  if (h.kind === 'louver') {
    for (let j = 1; j <= 7; j++) {
      const y = h.bottom + j * 0.41,
        w = h.width * 0.4;
      beam(face, point(-w, y), point(w, y), 0.12, 'accent');
    }
    beam(
      face,
      point(-h.width * 0.43, h.bottom + 0.28),
      point(h.width * 0.43, h.bottom + 0.28),
      0.16,
      'trim',
    );
    return;
  }
  if (h.width > 1.6) {
    beam(face, point(0, h.bottom + 0.05), point(0, h.bottom + h.spring), 0.12, 'trim');
    beam(
      face,
      point(-h.width * 0.44, h.bottom + h.height * 0.5),
      point(h.width * 0.44, h.bottom + h.height * 0.5),
      0.12,
      'trim',
    );
  }
}
function profile(face, p, radii, levels, d, slot = 'green', segments) {
  const n = segments ?? (d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : d === 3 ? 28 : 36),
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
function finial(face, p, b, t, d) {
  const accent = (slot, points, normal) => face(slot, points, normal, gold);
  beam(accent, [p[0], floor + b, p[1]], [p[0], floor + t, p[1]], d === 0 ? 0.18 : 0.12, 'accent');
  if (d > 0) {
    const y = floor + t - 0.35;
    beam(accent, [p[0] - 0.35, y, p[1]], [p[0] + 0.35, y, p[1]], 0.12, 'accent');
  }
}
export function ljubljanaLanterns(d = 4) {
  return [
    ...towerRoles.map((name) => ({
      name: `${name}-lantern`,
      center: mid(ring(`${name}Crown`)),
      r: 1.18,
      b: 25,
      t: 27.5,
      slot: 'accent',
    })),
    {
      name: 'dome-lantern',
      center: mid(ring('domeLantern')),
      r: 1.04,
      b: 21.25,
      t: 23,
      slot: 'trim',
    },
  ].map((a) => ({ ...a, n: d === 0 ? 4 : 8 }));
}
function lantern(face, a, d) {
  const r = regular(a.center, a.r, a.n, Math.PI / a.n),
    w = d === 0 ? 0.18 : 0.15;
  for (const p of r) beam(face, at(p, a.b), at(p, a.t), w, a.slot);
  band(face, regular(a.center, a.r * 1.12, 8), a.b, 0.18, a.slot);
  band(face, regular(a.center, a.r * 1.12, 8), a.t - 0.15, 0.15, a.slot);
  if (a.name === 'dome-lantern') {
    profile(
      face,
      a.center,
      [1.25, 1.25],
      [
        [23, 1],
        [23.35, 0.8],
        [23.7, 0.18],
      ],
      d,
    );
    finial(face, a.center, 23.6, 24.5, d);
  } else {
    profile(
      face,
      a.center,
      [1.6, 1.6],
      d === 0
        ? [
            [27.5, 1],
            [29.6, 0.12],
          ]
        : [
            [27.5, 1],
            [27.85, 1.05],
            [28.45, 0.67],
            [29.1, 0.4],
            [29.6, 0.08],
          ],
      d,
    );
    finial(face, a.center, 29.45, 30.5, d);
  }
}
function disc(face, p, n, axis, y, radius, d, slot = 'accent', offset = 0.12, col) {
  const count = d < 2 ? 8 : 16,
    points = Array.from({ length: count }, (_, i) => {
      const a = (i * 2 * Math.PI) / count;
      return [
        p[0] + n[0] * offset + axis[0] * radius * Math.cos(a),
        floor + y + radius * Math.sin(a),
        p[1] + n[1] * offset + axis[1] * radius * Math.cos(a),
      ];
    });
  face(slot, points, [n[0], 0, n[1]], col);
}
function clock(face, r, d) {
  if (d < 1) return;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 5) continue;
    const p = lerp(f.a, f.b, 0.5),
      y = 12.35;
    disc(face, p, f.normal, f.axis, y, 1.25, d, 'trim', 0.15);
    disc(face, p, f.normal, f.axis, y, 1.06, d, 'accent', 0.17, gold);
    if (d >= 2) {
      for (let j = 0; j < 12; j++) {
        const a = (j * Math.PI) / 6,
          u = Math.cos(a),
          v = Math.sin(a),
          at = (rad, dep) => [
            p[0] + f.normal[0] * dep + f.axis[0] * rad * u,
            floor + y + rad * v,
            p[1] + f.normal[1] * dep + f.axis[1] * rad * u,
          ];
        beam(face, at(0.84, 0.2), at(0.98, 0.2), 0.1, 'accent');
      }
      const point = (u, v) => [
        p[0] + f.normal[0] * 0.22 + f.axis[0] * u,
        floor + y + v,
        p[1] + f.normal[1] * 0.22 + f.axis[1] * u,
      ];
      beam(face, point(0, 0), point(0.38, 0.43), 0.13, 'accent');
      beam(face, point(0, 0), point(-0.7, 0.2), 0.1, 'accent');
    }
  }
}
function towers(face, d) {
  for (const name of towerRoles) {
    const r = coarse(ring(name)),
      crown = ring(`${name}Crown`),
      p = mid(crown);
    clock(face, r, d);
    if (d > 0) {
      band(face, r, 10.7, 0.35);
      band(face, r, 13.6, 0.26);
      band(face, r, 18.7, 0.4, 'trim', 1.07);
      band(face, crown, 19.25, 0.25, 'trim', 1.07);
    }
    solid(face, crown, 19.1, 22.2, 'wall');
    if (d > 0) {
      for (let i = 0; i < crown.length; i++) {
        const f = faceFrame(crown, i);
        if (f.length < 1.6) continue;
        const q = lerp(f.a, f.b, 0.5);
        disc(face, q, f.normal, f.axis, 20.65, 0.56, d, 'trim', 0.13);
        disc(face, q, f.normal, f.axis, 20.65, 0.4, d, 'accent', 0.15);
      }
    }
    profile(
      face,
      p,
      [3.4, 3.4],
      d === 0
        ? [
            [22.2, 1],
            [25, 0.29],
          ]
        : [
            [22.2, 1],
            [22.55, 1.02],
            [23.1, 0.82],
            [24, 0.52],
            [24.7, 0.36],
            [25, 0.31],
          ],
      d,
    );
  }
}
function dome(face, out, d, fields) {
  const r = ring('domeDrum'),
    p = mid(r),
    b = bounds(r);
  if (d >= 2)
    shell(
      out,
      d,
      r,
      11,
      17,
      fields.filter((h) => h.owner === 'domeDrum'),
    );
  else sides(face, r, 11, 17, 'wall');
  cap(face, r, 17, 'green');
  if (d > 0) {
    band(face, r, 11.6, 0.25);
    band(face, r, 16.7, 0.3, 'trim', 1.03);
  }
  const count = d === 0 ? 3 : d === 1 ? 5 : d === 2 ? 7 : 9;
  const levels = Array.from({ length: count }, (_, i) => {
    const f = i / (count - 1),
      angle = f * Math.PI * 0.5;
    return [17 + 4.35 * Math.sin(angle), Math.max(0.15, Math.cos(angle))];
  });
  profile(face, p, [(b[2] - b[0]) / 2, (b[3] - b[1]) / 2], levels, d);
}
function front(face, d) {
  const width = 5.7,
    n = d < 2 ? 6 : 12,
    zs = Array.from({ length: n + 1 }, (_, i) => -width + (i * 2 * width) / n),
    curve = (z) => 11 + 4.2 * Math.sqrt(Math.max(0, 1 - (z / width) ** 2)),
    r = [[-width, 10.9], [width, 10.9], ...zs.toReversed().map((z) => [z, curve(z)])],
    x = -26.92;
  for (const xx of [x, x + 0.25])
    face(
      'wall',
      r.map(([z, y]) => [xx, floor + y, z]),
      [xx === x ? -1 : 1, 0, 0],
    );
  if (d > 0) {
    for (let i = 0; i < zs.length - 1; i++) {
      const a = zs[i],
        b = zs[i + 1];
      face(
        'trim',
        [
          [x - 0.07, floor + curve(a) - 0.2, a],
          [x - 0.07, floor + curve(b) - 0.2, b],
          [x - 0.07, floor + curve(b) + 0.13, b],
          [x - 0.07, floor + curve(a) + 0.13, a],
        ],
        [-1, 0, 0],
      );
    }
    disc(face, [x, 0], [-1, 0], [0, -1], 12.7, 0.75, d, 'trim', 0.12);
    disc(face, [x, 0], [-1, 0], [0, -1], 12.7, 0.55, d, 'glass', 0.14);
  }
}
function pilasters(face, d, fields) {
  if (d < 2) return;
  for (const layer of rec.wallLayers)
    for (const part of layer.polygons) {
      const r = coarse(part.outline);
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (f.length < 4) continue;
        const count = Math.max(1, Math.round(f.length / 5.2));
        for (let j = 0; j <= count; j++) {
          const p = lerp(f.a, f.b, (j + 0.06) / (count + 0.12));
          if (
            fields.some(
              (h) =>
                Math.abs((p[0] - h.center[0]) * h.axis[0] + (p[1] - h.center[1]) * h.axis[1]) <
                  h.width / 2 + 0.35 &&
                Math.abs((p[0] - h.center[0]) * h.normal[0] + (p[1] - h.center[1]) * h.normal[1]) <
                  0.8,
            )
          )
            continue;
          const q = p.map((v, k) => v + f.normal[k] * 0.12),
            b = layer.bottom ?? ljubljanaGround(...p) - floor + 0.2;
          solid(
            face,
            R(q[0] - 0.17, q[1] - 0.17, q[0] + 0.17, q[1] + 0.17),
            b,
            layer.top - 0.38,
            'trim',
          );
        }
      }
    }
}
function steps(face, d) {
  for (const door of rec.doors) {
    const n = door.normal,
      a = [-n[1], n[0]],
      p = door.p,
      w = door.width * 0.7,
      L = 1.3,
      N = d === 0 ? 1 : 3,
      top = door.bottom + 0.02,
      lower = ljubljanaGround(p[0] + n[0] * L, p[1] + n[1] * L) - floor,
      point = (u, v) => p.map((x, k) => x + a[k] * u + n[k] * v);
    for (let i = 0; i < N; i++) {
      const v0 = (i * L) / N,
        v1 = ((i + 1) * L) / N,
        y = top + ((lower - top) * i) / N,
        yn = top + ((lower - top) * (i + 1)) / N,
        r = [point(-w, v0), point(w, v0), point(w, v1), point(-w, v1)];
      face(
        'stone',
        r.map((p, k) => at(p, d === 0 && k > 1 ? yn : y)),
        [0, 1, 0],
      );
      if (d > 0)
        face('stone', [at(r[2], yn), at(r[3], yn), at(r[3], y), at(r[2], y)], [n[0], 0, n[1]]);
    }
  }
}
function build(out, d) {
  const fields = ljubljanaFields(d),
    make = (base) => (slot, p, n, col) => {
      const max = d === 0 ? 24 : d === 1 ? 20 : 16;
      function split(t) {
        const len = t.map((a, i) => Math.hypot(...a.map((v, k) => v - t[(i + 1) % 3][k]))),
          m = Math.max(...len),
          i = len.indexOf(m);
        if (m <= max) {
          base(slot, t, n, col);
          return;
        }
        const j = (i + 1) % 3,
          k = (i + 2) % 3,
          a = lerp(t[i], t[j], 0.5);
        split([t[i], a, t[k]]);
        split([a, t[j], t[k]]);
      }
      for (let i = 1; i < p.length - 1; i++) split([p[0], p[i], p[i + 1]]);
    },
    face = make(writer(out, d)),
    cut =
      d >= 2
        ? make(
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
    sides(cut, coarse(p.outline), footing, (q) => ljubljanaGround(...q) + 0.16, 'stone');
    cap(cut, p.outline, 0.1, 'stone', p.holes);
  }
  for (const layer of rec.wallLayers)
    for (const part of layer.polygons) {
      const bottom = layer.bottom ?? ((q) => ljubljanaGround(...q) + 0.16),
        r = coarse(part.outline);
      if (d >= 2) shell(out, d, r, bottom, layer.top, fields);
      else sides(face, r, bottom, layer.top, 'wall');
      cap(cut, r, layer.top, 'green', part.holes);
      if (d > 0) band(cut, r, layer.top - 0.25, 0.25, 'trim', 1.01);
    }
  for (const part of rec.aislePlans)
    if (
      Math.abs(
        part.outline.reduce((sum, p, i) => {
          const q = part.outline[(i + 1) % part.outline.length];
          return sum + p[0] * q[1] - q[0] * p[1];
        }, 0),
      ) > 1
    )
      hip(cut, coarse(part.outline), 6.6, 8.1, 'green');
  gable(cut, rec.navePlan, 11, 16, 'roof');
  gable(cut, rec.crossPlan, 11, 15.3, 'roof', 1);
  gable(cut, rec.eastPlan, 11, 15, 'roof');
  towers(cut, d);
  dome(cut, out, d, fields);
  for (const a of ljubljanaLanterns(d)) lantern(face, a, d);
  front(cut, d);
  if (d >= 1) for (const h of fields) panel(face, h, d);
  pilasters(face, d, fields);
  steps(face, d);
}
export const buildLjubljanaSkyline = (o) => build(o, 0),
  buildLjubljanaDistrict = (o) => build(o, 1),
  buildLjubljanaStreet = (o) => build(o, 2),
  buildLjubljanaCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const ljubljanaStudy = {
  id: 'N0360',
  key: 'ljubljana_cathedral',
  title: 'Ljubljana Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1236564',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way and eleven current unscaled map controls. Western paired towers sign the current nave-edge frame.',
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
    'Five existing shared256-square plaster, flat tile, copper, granite and plain wood graphs. Cream walls/pale trim, red tile and pale-green copper use linear tints/metric UVs. Glass, dark louvers and gold accents use flat PBR vertex colors. Zero embedded images, bespoke facade textures or baked shadows/weathering.',
  importReason:
    'Four authored browser levels retain the paired western bell towers, open lanterns, broad green dome, red nave/cross roofs and lower green ranges.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two inspected elevated/north pictures and standard viewer PMTiles/DEM. Lower front is partly obscured. Exact profiles, ornaments, doorway positions, bronze reliefs, clock numerals, sundial/text/icons, market/urban neighbors, interiors and certified walking excluded or approximate. Physical laptop/phone timings pending.',
    'Skyline keeps the paired tiered towers, three open lanterns, crossing dome, red gables and low green ranges. District adds shared textures, flat glazing/louvers/clocks and upper ocelli. Street adds facade/drum recesses, sparse mullions/louver bars, pilasters and steps. Closeup/master refine curve/arch facets and clock marks. Ocelli remain flat decorative discs, not interior openings. Synthetic context neighbors are not mapped Ljubljana buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('paired-clock-towers-and-lanterns', [-54, 30, -31], [-22, 20, 0]),
    cam('western-segmental-front', [-65, 14, 0], [-25, 9, 0]),
    cam('green-dome-and-lantern', [36, 32, 33], [8, 17, 1]),
    cam('north-side-entry-and-aisle', [1, 13, -51], [2, 6, -9]),
    cam('red-nave-cross-and-choir-roofs', [0, 66, 20], [0, 9, 0]),
    cam('southern-classical-facade', [0, 13, 48], [0, 7, 10]),
  ],
};

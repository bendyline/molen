/** Liège Cathedral: Gothic nave/transept,clock-spire tower and open cloister garth. */
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
  '../../../content/worldgen/source/places/u1/u15/n0391_liege_cathedral/',
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
  wall: '#c3c6c2',
  trim: '#e2d5ae',
  roof: '#5e666c',
  door: '#75604a',
  glass: '#4a5865',
  accent: '#555653',
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
const footing = (p) => Math.min(floor - 0.3, liegeCathedralGround(...p) - 0.35);
export function liegeCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('LiegeCathedral Cathedral footing outside retained terrain');
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
    if (d < 2) continue;
    // Carved arcade ribs have depth, so their curves remain legible under Earth light.
    face(slot, [
      p.point(...outer[i], 0),
      p.point(...outer[j], 0),
      p.point(...outer[j], offset),
      p.point(...outer[i], offset),
    ]);
    face(slot, [
      p.point(...inner[i], offset),
      p.point(...inner[j], offset),
      p.point(...inner[j], 0),
      p.point(...inner[i], 0),
    ]);
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
const _R = (a, b, x, z) => [
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
function _inside(p, r) {
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
  pane(face, h, d, d >= 2 ? -0.75 : 0.07, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, 0.35, 'trim', 0.09);
  if (h.kind === 'door') archBand(face, h, d, 0.7, 'trim', 0.14);
  const p = prepareOpening(h, 0, d),
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
  for (const u of [-0.22, 0.22])
    beam(
      face,
      p.point(h.width * u, h.bottom, -0.66 * sg),
      p.point(h.width * u, h.bottom + h.spring, -0.66 * sg),
      0.11,
      'trim',
    );
  if (d >= 3) {
    for (const off of [-0.27, 0.27]) {
      const y = h.bottom + h.spring + 0.45;
      beam(
        face,
        p.point(h.width * off, y, -0.64 * sg),
        p.point(0, h.bottom + h.height - 0.35, -0.64 * sg),
        0.11,
        'trim',
      );
    }
  }
}
function footprintAware(out) {
  const target = out;
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const toWorld = (p) => [p[0] * c + p[2] * s, -p[0] * s + p[2] * c];
  const clearanceBounds = est.footprintClearances.map((r) => {
    const points = r.map(([x, z]) => toWorld([x, 0, z]));
    return [0, 1].map((k) => [
      Math.min(...points.map((p) => p[k])) - 2,
      Math.max(...points.map((p) => p[k])) + 2,
    ]);
  });
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
      longest > 8 &&
      clearanceBounds.some((bb) => bb.every((b, k) => b[0] <= bounds[k][1] && b[1] >= bounds[k][0]))
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
  return {
    addTriangle(...args) {
      emit(args);
    },
  };
}
const main = rec.main.polygons[0].outline,
  court = rec.main.polygons[0].holes[0],
  plans = rec.plans,
  est = rec.estimated;
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  circle = (p, r, n = 12, phase = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    }),
  on = (f, u = 0) => [
    (f.a[0] + f.b[0]) * 0.5 + f.axis[0] * u,
    (f.a[1] + f.b[1]) * 0.5 + f.axis[1] * u,
  ];
const tc = est.towerCenter,
  lantern = circle(tc, 1.7, 8, Math.PI / 8);
function fields(d = 4) {
  if (!d) return [];
  const hs = [],
    add = (name, p, a, n, w, b, h, s, kind = 'glass', depth = 4) =>
      hs.push({ ...hole(name, p, a, n, w, b, h, s, 'pointed', depth), kind });
  for (const z of [-37.9, -3]) {
    const n = [0, z < -20 ? -1 : 1];
    for (const x of [-24, -16, -8, 0, 25])
      if (d >= 2 || x === -16 || x === 0 || x === 25)
        add(`aisle-${z}-${x}`, [x, z], [1, 0], n, 3.4, 3.6, 9.4, 6.7);
    add(`transept-${z}`, [12.5, z], [1, 0], n, 7.2, 4.2, 16.8, 10.8);
  }
  if (d >= 2)
    for (const z of [-37.9, -3])
      for (const x of [10.8, 12.5, 14.2])
        add(
          `transept-blind-${z}-${x}`,
          [x, z],
          [1, 0],
          [0, z < -20 ? -1 : 1],
          0.95,
          24.15,
          3.1,
          2.05,
          'niche',
          3,
        );
  if (d >= 2)
    for (const z of [-28.5, -12])
      for (const x of [-24, -16, -8, 0, 25])
        add(`clerestory-${z}-${x}`, [x, z], [1, 0], [0, z < -20 ? -1 : 1], 2.5, 19.3, 3.2, 2.0);
  if (d >= 2)
    for (let i = 1; i < 10; i++) {
      const f = faceFrame(plans.church, i);
      if (f.normal[0] > 0.2 && f.length > 2.7)
        add(`choir-${i}`, on(f), f.axis, f.normal, Math.min(2.8, f.length - 1.2), 4.2, 8.6, 6.0);
    }
  add('west-door', [-43.1, -20.225], [0, 1], [-1, 0], 2.8, 0.2, 5.2, 3.5, 'door', 6);
  if (d >= 2)
    for (const z of [-37.9, -3])
      add(
        `transept-door-${z}`,
        [12.5, z],
        [1, 0],
        [0, z < -20 ? -1 : 1],
        2.4,
        0.2,
        3.5,
        2.3,
        'door',
        5,
      );
  for (let i = 0; i < court.length; i++) {
    const f = faceFrame(court, i);
    if (f.length < 8) continue;
    const normal = f.normal.map((v) => -v),
      count = d === 1 ? 1 : Math.max(2, Math.floor(f.length / 4.7));
    for (let j = 0; j < count; j++) {
      const p = lerp(f.a, f.b, (j + 0.5) / count);
      add(
        `cloister-${i}-${j}`,
        p,
        f.axis,
        normal,
        Math.min(2.5, f.length / count - 1.0),
        1.5,
        4.5,
        2.8,
      );
    }
  }
  for (let i = 0; i < plans.tower.length; i++) {
    const f = faceFrame(plans.tower, i);
    for (const u of [-2.25, 2.25])
      add(`tower-louver-${i}-${u}`, on(f, u), f.axis, f.normal, 2.65, 25.2, 7.9, 5.7, 'louver', 6);
  }
  return hs;
}
export const liegeCathedralFields = fields;
function panel(face, h, d) {
  pane(
    face,
    h,
    d,
    -0.65,
    h.kind === 'door'
      ? 'door'
      : h.kind === 'louver'
        ? 'accent'
        : h.kind === 'niche'
          ? 'wall'
          : 'glass',
  );
  if (d >= 2) archBand(face, h, d, 0.2, 'trim', 0.1);
  if (d >= 3 && h.name.startsWith('transept-')) archBand(face, h, d, 0.43, 'trim', 0.18);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    pt = (u, y, o = -0.52) => p.point(u, y, o * sg);
  if (h.kind === 'louver') {
    if (d >= 2)
      for (let y = h.bottom + 0.45; y < h.bottom + h.spring; y += d >= 3 ? 0.42 : 0.8)
        face(
          'door',
          [
            pt(-h.width * 0.44, y),
            pt(h.width * 0.44, y),
            pt(h.width * 0.44, y + 0.14),
            pt(-h.width * 0.44, y + 0.14),
          ],
          [h.normal[0], 0, h.normal[1]],
        );
    return;
  }
  if (h.kind === 'door') {
    if (d >= 2) beam(face, pt(0, h.bottom + 0.1), pt(0, h.bottom + h.spring), 0.12, 'accent');
    return;
  }
  if (d < 2) return;
  const count = h.width > 5 ? 5 : 3;
  for (let i = 1; i < count; i++) {
    const u = -h.width * 0.5 + (h.width * i) / count;
    beam(face, pt(u, h.bottom + 0.08), pt(u, h.bottom + h.spring - 0.12), 0.11, 'trim');
  }
  if (d >= 3) {
    const y = h.bottom + h.spring + 0.6,
      rad = Math.min(0.68, h.width * 0.18);
    for (const u of h.width > 5 ? [-1.5, 0, 1.5] : [0]) {
      const ring = circle([u, y], rad, 8);
      for (let j = 0; j < ring.length; j++) {
        const a = ring[j],
          b = ring[(j + 1) % ring.length];
        beam(face, pt(a[0], a[1]), pt(b[0], b[1]), 0.095, 'trim');
      }
    }
    for (const f of [0.32, 0.64])
      beam(
        face,
        pt(-h.width * 0.46, h.bottom + h.spring * f),
        pt(h.width * 0.46, h.bottom + h.spring * f),
        0.075,
        'accent',
      );
  }
}
function roofAisles(face) {
  for (const side of [-1, 1]) {
    const z = side < 0 ? -37.9 : -3,
      inner = side < 0 ? -28.5 : -12;
    face(
      'roof',
      [at([-30, z], 14.5), at([33, z], 14.5), at([33, inner], 19), at([-30, inner], 19)],
      [0, 1, 0],
    );
  }
  // Eastern polygonal choir roof rises toward the end of the high nave.
  const rr = plans.church.slice(1, 11),
    p = [32, -20.25];
  for (let i = 0; i < rr.length - 1; i++)
    face('roof', [at(rr[i], 14.5), at(rr[i + 1], 14.5), at(p, 25.6)], [0, 1, 0]);
}
function pinnacle(face, p, b, h, d, r = 0.24) {
  solid(face, circle(p, r, d >= 3 ? 8 : 4), b, b + h * 0.65, 'trim');
  profile(
    face,
    circle(p, r * 1.45, 4, Math.PI / 4),
    [
      [b + h * 0.65, 1],
      [b + h, 0.02],
    ],
    'trim',
  );
}
function buttress(face, p, n, d, t = 17) {
  const a = [-n[1], n[0]],
    point = (u, v) => [p[0] + a[0] * u + n[0] * v, p[1] + a[1] * u + n[1] * v],
    rect = (w, dep) => [
      point(-w / 2, -0.3),
      point(w / 2, -0.3),
      point(w / 2, dep),
      point(-w / 2, dep),
    ];
  if (d <= 1) {
    solid(face, rect(0.95, 1.7), footing, t, 'wall');
    return;
  }
  for (const [b, h, dep] of [
    [0, 5, 2],
    [5, 5, 1.6],
    [10, t - 10, 1.05],
  ]) {
    solid(face, rect(1.1, dep), b, b + h, 'wall');
    cap(face, rect(1.24, dep + 0.08), b + h, 'trim');
  }
  if (d >= 2) pinnacle(face, point(0, 0.55), t, 3.2, d);
}
function tower(out, face, d, hs) {
  const r = plans.tower;
  shell(
    out,
    d,
    r,
    footing,
    34,
    hs.filter((h) => h.name.startsWith('tower-') || h.name === 'west-door'),
    'wall',
  );
  cap(face, r, 34, 'wall');
  band(face, r, 24.4, 0.35, 'trim', 1.06);
  band(face, r, 33.7, 0.45, 'trim', 1.1);
  const oct = circle(tc, 6.8, 8, Math.PI / 8);
  profile(
    face,
    oct,
    [
      [34, 1],
      [36, 0.86],
      [48, 0.26],
    ],
    'roof',
  );
  if (d <= 1) {
    for (let i = 0; i < 4; i++)
      solid(
        face,
        circle(
          [
            tc[0] + Math.cos(Math.PI / 4 + (i * Math.PI) / 2) * 1.15,
            tc[1] + Math.sin(Math.PI / 4 + (i * Math.PI) / 2) * 1.15,
          ],
          0.22,
          4,
        ),
        48,
        51,
        'trim',
      );
  } else {
    const holes = lantern.map((_, i) => {
      const f = faceFrame(lantern, i);
      return hole(`lantern-air-${i}`, on(f), f.axis, f.normal, 0.73, 48.4, 2.2, 1.7, 'round', 3);
    });
    shell(out, d, lantern, 48, 51, holes, 'trim', scaled(lantern, 0.58));
  }
  profile(
    face,
    scaled(lantern, 1.18),
    [
      [51, 1],
      [52, 0.85],
      [d === 0 ? 62 : 61, 0.03],
    ],
    'roof',
  );
  if (d >= 1) beam(face, at(tc, 60.8), at(tc, 62), 0.11, 'accent');
  if (d >= 1) {
    for (const p of r) {
      const q = lerp(tc, p, 0.84);
      solid(face, circle(q, 0.65, 6), 33.9, 38.4, 'wall');
      profile(
        face,
        circle(q, 0.83, 6),
        [
          [38.4, 1],
          [42.5, 0.03],
        ],
        'roof',
      );
    }
    const slope = (6.8 * Math.cos(Math.PI / 8) * (0.86 - 0.26)) / 12,
      apothem = 6.8 * Math.cos(Math.PI / 8) * 0.86;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        point = (u, y, off = 0.045) => [
          tc[0] + f.normal[0] * (apothem - (y - 36) * slope + off) + f.axis[0] * u,
          floor + y,
          tc[1] + f.normal[1] * (apothem - (y - 36) * slope + off) + f.axis[1] * u,
        ],
        n = unit([f.normal[0], slope, f.normal[1]]),
        N = d >= 3 ? 16 : 8,
        rad = 1.2,
        ring = Array.from({ length: N }, (_, j) => {
          const a = (j * Math.PI * 2) / N;
          return [Math.cos(a) * rad, 39.2 + Math.sin(a) * rad];
        });
      for (let j = 0; j < N; j++) {
        const k = (j + 1) % N;
        face('accent', [point(0, 39.2), point(...ring[j]), point(...ring[k])], n);
        if (d >= 2) {
          const outer = ring.map(([u, y]) => [u * 1.12, 39.2 + (y - 39.2) * 1.12]);
          face(
            'trim',
            [
              point(...outer[j], 0.07),
              point(...outer[k], 0.07),
              point(...ring[k], 0.07),
              point(...ring[j], 0.07),
            ],
            n,
          );
        }
      }
      if (d >= 2) {
        beam(face, point(0, 39.2, 0.09), point(0.68, 39.47, 0.09), 0.08, 'trim');
        beam(face, point(0, 39.2, 0.09), point(-0.22, 40.04, 0.09), 0.07, 'trim');
      }
    }
  }
}
function build(out, d) {
  out = footprintAware(out);
  const face = writer(out, d),
    hs = fields(d),
    prepared = hs.map((h) => prepareOpening(h, 0, d)),
    cut = writer(masked(out, prepared), d);
  // The full mapped base is cut around the exact court rather than a solid replacement slab.
  sides(cut, main, footing, 0.18, 'wall');
  sides(cut, court, footing, 0.18, 'wall', true);
  cap(cut, main, 0.18, 'wall', [court]);
  shell(
    out,
    d,
    plans.church,
    0.18,
    14.5,
    hs.filter(
      (h) =>
        h.name.startsWith('aisle-') ||
        h.name.startsWith('choir-') ||
        h.name.startsWith('transept-') ||
        h.name.startsWith('cloister-'),
    ),
    'wall',
  );
  cap(cut, plans.church, 14.5, 'wall');
  roofAisles(cut);
  shell(
    out,
    d,
    plans.nave,
    14.5,
    23,
    hs.filter((h) => h.name.startsWith('clerestory-')),
    'wall',
  );
  gable(cut, plans.nave, 23, 31);
  shell(
    out,
    d,
    plans.transept,
    0.18,
    23,
    hs.filter((h) => h.name.startsWith('transept-')),
    'wall',
  );
  gable(cut, plans.transept, 23, 31, 'roof', 1);
  if (d === 0) {
    for (const r of [plans.westCloister, plans.southCloister, plans.eastCloister])
      solid(cut, r, 0.18, 6.8, 'wall');
  } else
    for (const poly of rec.lower) {
      sides(cut, poly.outline, 0.18, 6.8, 'wall');
      for (const h of poly.holes) sides(cut, h, 0.18, 6.8, 'wall', true);
      cap(cut, poly.outline, 6.8, 'wall', poly.holes);
    }
  // Gallery jambs are separate thin wall surfaces; masked caps and inner walls keep their recesses clear.
  for (const h of hs.filter((h) => h.name.startsWith('cloister-'))) {
    const p = prepareOpening(h, 0, d),
      axis = p.axis,
      normal = h.normal,
      sg = Math.sign(-axis[1] * normal[0] + axis[0] * normal[1]),
      r = openingShape(h, d);
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      face('wall', [
        p.point(...r[i], 0),
        p.point(...r[j], 0),
        p.point(...r[j], -0.65 * sg),
        p.point(...r[i], -0.65 * sg),
      ]);
    }
  }
  hip(face, plans.westCloister, 6.8, 11.2, 'roof', 1);
  hip(face, plans.southCloister, 6.8, 11.2);
  hip(face, plans.eastCloister, 6.8, 10.8, 'roof', 1);
  tower(out, face, d, hs);
  for (const h of hs) panel(face, h, d);
  if (d >= 1)
    for (const z of [-37.9, -3])
      for (const x of d === 0 ? [-25, 7, 30] : [-28, -20, -12, -4, 7, 18, 28.5, 32])
        buttress(face, [x, z], [0, z < -20 ? -1 : 1], d, x === 7 || x === 18 ? 24 : 16);
  if (d >= 1) {
    for (const side of [-1, 1]) {
      const z = side < 0 ? -38 : -2.9;
      beam(face, [-30, floor + 14.3, z], [32, floor + 14.3, z], 0.21, 'trim');
      const upperZ = side < 0 ? -28.5 : -12;
      beam(face, [-30, floor + 22.7, upperZ], [32, floor + 22.7, upperZ], 0.21, 'trim');
      for (const x of [7, 18]) {
        beam(face, [x, floor + 23, z], [12.5, floor + 31, z], 0.24, 'trim');
        pinnacle(face, [x, z], 23, 3.2, d);
      }
    }
    for (const x of [-20, -12, -4, 28.5])
      for (const side of [-1, 1]) {
        const z = side < 0 ? -37.9 : -3,
          inn = side < 0 ? -28.5 : -12;
        beam(face, [x, floor + 16.8, z], [x, floor + 21.2, inn], 0.4, 'wall');
      }
    const sc = [0.5, 0.8];
    solid(face, circle(sc, 1.2, d >= 3 ? 12 : 8), 0.18, 9.8, 'wall');
    profile(
      face,
      circle(sc, 1.4, d >= 3 ? 12 : 8),
      [
        [9.8, 1],
        [13.5, 0.02],
      ],
      'roof',
    );
    if (d >= 2) {
      for (const x of [-22, -12, -2, 8]) {
        const z = 29.5,
          r = R(x - 0.6, z - 0.7, x + 0.6, z + 0.7);
        solid(face, r, 9.1, 10.7, 'wall');
        gable(face, r, 10.7, 12.2, 'roof', 1);
        face(
          'glass',
          [
            [x - 0.38, floor + 9.5, z + 0.72],
            [x + 0.38, floor + 9.5, z + 0.72],
            [x, floor + 10.5, z + 0.72],
          ],
          [0, 0, 1],
        );
      }
      // Parapet rhythm follows visible aisle bays; geometric apertures keep air between ribs.
      for (const z of [-37.9, -3])
        for (let x = -28; x < 32; x += d >= 3 ? 2 : 4) {
          if (x > 6 && x < 19) continue;
          pinnacle(face, [x, z], 14.7, 0.9, d, 0.1);
          if (d >= 3) beam(face, [x, floor + 14.8, z], [x + 1, floor + 15.6, z], 0.1, 'trim');
        }
    }
  }
}
export const buildLiegeCathedralSkyline = (o) => build(o, 0),
  buildLiegeCathedralDistrict = (o) => build(o, 1),
  buildLiegeCathedralStreet = (o) => build(o, 2),
  buildLiegeCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const liegeCathedralStudy = {
  id: 'N0391',
  key: 'liege_cathedral',
  title: 'Liège Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1573417',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact relation/QID,32 current compound outer and6 cloister-hole points without rescale.37/110m facts retained with scope limits.',
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
    'Four existing cached256-square ashlar,continuous limestone,slate and plain wood graphs.Linear gray-stone/cream-tracery/slate tints,metric UVs,flat normals,six merged groups.No embedded images,unique facade maps or baked lighting.',
  importReason:
    'Four authored browser levels preserve Gothic body/transept,west clock-spire tower/open lantern and actual open cloister court.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three actually inspected2013/2023 north and south-cloister photographs plus standard viewer PMTiles/DEM.No bespoke plans/surveys.Masonry/window rhythms,spire proportions and hidden roof partitions approximate.Fine sculpture,crockets,exact stained-glass art/clock lettering,full interiors and engineering accuracy excluded.Physical laptop/phone timing pending.',
    'Skyline preserves roof hierarchy,tower/open lantern and court opening.District adds shared textures,recessed selected Gothic windows/doors,tower louvers,corner turrets and buttress/flying struts.Street adds more choir/clerestory/cloister windows,mullions,louver slats,dormers and parapet rhythms.Closeup/master add simple geometric foils/transoms,nested transept trim and smaller parapet elements.Regional context is a fixture.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('north-transept-windows-and-buttresses', [10, 22, -71], [9, 15, -35]),
    cam('west-louvers-clock-and-spire', [-69, 44, -48], [-38, 39, -20]),
    cam('south-cloister-open-garth', [-12, 20, 34], [-10, 9, 8]),
    cam('cream-tracery-and-aisle-recesses', [-12, 12, -51], [-12, 9, -37.9]),
    cam('east-polygonal-choir-and-roofs', [73, 35, -12], [32, 17, -20]),
    cam('whole-roof-and-open-court', [0, 130, 1], [0, 15, 0]),
  ],
};

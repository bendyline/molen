/** Graz Cathedral: red-tiled Gothic hall,two copper roof lanterns and projecting Baroque chapel. */
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
    : h.shape === 'pointed'
      ? gothicOpening(h, d)
      : baseOpeningShape(h, d);
function gothicOpening(h, d) {
  const w = h.width / 2,
    b = h.bottom ?? 0,
    n = d <= 1 ? 2 : d === 2 ? 3 : 6,
    rise = h.height - h.spring,
    ys = b + h.spring,
    right = Array.from({ length: n }, (_, i) => {
      const a = ((i + 1) * Math.PI) / (3 * n);
      return [-w + 2 * w * Math.cos(a), ys + (rise * Math.sin(a)) / Math.sin(Math.PI / 3)];
    }),
    left = Array.from({ length: n }, (_, i) => {
      const a = ((1 - (i + 1) / n) * Math.PI) / 3;
      return [w - 2 * w * Math.cos(a), ys + (rise * Math.sin(a)) / Math.sin(Math.PI / 3)];
    });
  return [[-w, b], [w, b], [w, ys], ...right, ...left];
}
function prepareOpening(h, b, d) {
  const v = basePrepareOpening(h, b, d);
  if (h.shape !== 'circle' && h.shape !== 'pointed') return v;
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
  '../../../content/worldgen/source/places/u2/u26/graz_cathedral/',
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
  wall: '#e9e1cd',
  trim: '#cfbd9c',
  roof: '#a5644b',
  copper: '#77958a',
  door: '#72573d',
  glass: '#4d6178',
  accent: '#d5b44f',
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
const footing = (p) => Math.min(floor - 0.3, grazCathedralGround(...p) - 0.35);
export function grazCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('GrazCathedral Cathedral footing outside retained terrain');
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
const plans = rec.plans,
  est = rec.estimated,
  tc = est.towerCenter,
  fc = est.flecheCenter;
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  circle = (p, r, n = 12) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    }),
  on = (f) => lerp(f.a, f.b, 0.5);
function fields(d = 4) {
  if (!d) return [];
  const hs = [],
    add = (name, p, a, n, w, b, h, s, kind = 'glass', shape = 'pointed') =>
      hs.push({ ...hole(name, p, a, n, w, b, h, s, shape, 4), kind });
  for (const side of [-1, 1])
    for (const x of d === 1 ? [-23, -4] : [-26, -19, -11, -3, 3])
      add(`nave-${side}-${x}`, [x, side < 0 ? -15.1 : 15.3], [1, 0], [0, side], 2.8, 6, 10.3, 7.7);
  for (let i = 0; i < plans.choir.length; i++) {
    const f = faceFrame(plans.choir, i),
      p = on(f);
    if (f.length < 4 || p[0] < 8 || f.normal[0] < -0.6 || p[1] > 4) continue;
    if (d === 1 && i % 2 === 1) continue;
    const count = d >= 2 ? Math.max(1, Math.floor(f.length / 7)) : 1;
    for (let j = 0; j < count; j++)
      add(
        `choir-${i}-${j}`,
        lerp(f.a, f.b, (j + 0.5) / count),
        f.axis,
        f.normal,
        Math.min(2.6, f.length / count - 1.8),
        6,
        10.2,
        7.7,
      );
  }
  for (const z of [-9.7, 9.7])
    add(`west-lancet-${z}`, [-30.4, z], [0, 1], [-1, 0], 2.6, 7, 9.5, 7.2);
  add('west-round', [-30.4, 0], [0, 1], [-1, 0], 3.2, 11.5, 3.2, 3.2, 'glass', 'circle');
  add('west-portal', [-30.4, 0], [0, 1], [-1, 0], 3.2, 0.15, 5.7, 4.2, 'door', 'round');
  for (const x of [-13.1, -4]) {
    add(
      `chapel-round-${x}`,
      [x, x < -7.8 ? 21.7 : 20.45],
      [1, 0],
      [0, 1],
      1.4,
      7.4,
      1.4,
      1.4,
      'glass',
      'circle',
    );
    if (d >= 2)
      add(
        `chapel-blind-${x}`,
        [x, x < -7.8 ? 21.7 : 20.45],
        [1, 0],
        [0, 1],
        1.4,
        2.5,
        3.1,
        3.1,
        'niche',
        'rect',
      );
  }
  if (d >= 2) {
    add('chapel-door', [-1.1, 18], [0, 1], [1, 0], 1.7, 0.15, 4.5, 4.5, 'door', 'rect');
    for (const x of [-13, -7])
      for (const b of [2, 5.5])
        add(
          `north-annex-${x}-${b}`,
          [x, -20.5],
          [1, 0],
          [0, -1],
          1.3,
          b,
          1.7,
          1.7,
          'glass',
          'rect',
        );
    for (const x of [4, 14, 23])
      add(
        `south-range-${x}`,
        [x, x < 9 ? 18.1 - x / 10.9 : 14.4 - ((x - 9.8) * 1.7) / 18],
        [1, 0],
        [0, 1],
        1.6,
        3,
        2.5,
        2.5,
        'glass',
        'rect',
      );
  }
  return hs;
}
export const grazCathedralFields = fields;
function panel(face, h, d) {
  pane(face, h, d, -0.55, h.kind === 'door' ? 'door' : h.kind === 'niche' ? 'wall' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, h.kind === 'door' ? 0.52 : 0.23, 'trim', 0.12);
  const a = prepareOpening(h, 0, d),
    sg = Math.sign(-a.axis[1] * h.normal[0] + a.axis[0] * h.normal[1]),
    pt = (u, y) => a.point(u, y, -0.4 * sg);
  if (h.kind === 'door') {
    beam(face, pt(0, h.bottom + 0.1), pt(0, h.bottom + h.spring), 0.12, 'accent');
    if (d >= 3) {
      for (const u of [-0.75, 0.75])
        for (const y of [1.4, 3.1]) {
          const w = 0.55,
            b = h.bottom + y;
          for (const [p, q] of [
            [
              [-w / 2, b],
              [w / 2, b],
            ],
            [
              [-w / 2, b + 1],
              [w / 2, b + 1],
            ],
            [
              [-w / 2, b],
              [-w / 2, b + 1],
            ],
            [
              [w / 2, b],
              [w / 2, b + 1],
            ],
          ])
            beam(face, pt(u + p[0], p[1]), pt(u + q[0], q[1]), 0.07, 'trim');
        }
    }
    return;
  }
  if (h.kind === 'niche') return;
  if (h.shape === 'circle') {
    beam(
      face,
      pt(-h.width * 0.45, h.bottom + h.height / 2),
      pt(h.width * 0.45, h.bottom + h.height / 2),
      0.1,
      'trim',
    );
    beam(face, pt(0, h.bottom + 0.05), pt(0, h.bottom + h.height - 0.05), 0.1, 'trim');
    return;
  }
  if (h.shape === 'rect') {
    beam(face, pt(0, h.bottom), pt(0, h.bottom + h.height), 0.1, 'trim');
    return;
  }
  for (const u of [-0.2, 0.2])
    beam(face, pt(h.width * u, h.bottom), pt(h.width * u, h.bottom + h.spring), 0.11, 'trim');
  if (d >= 3) {
    for (const f of [0.33, 0.66])
      beam(
        face,
        pt(-h.width * 0.44, h.bottom + h.spring * f),
        pt(h.width * 0.44, h.bottom + h.spring * f),
        0.1,
        'trim',
      );
    for (const u of [-0.2, 0.2])
      beam(
        face,
        pt(h.width * u, h.bottom + h.spring),
        pt(0, h.bottom + h.height - 0.3),
        0.11,
        'trim',
      );
  }
}
function lantern(out, face, p, r, b, t, d, slot = 'copper') {
  const ring = R(p[0] - r, p[1] - r, p[0] + r, p[1] + r),
    hs = d
      ? ring.map((_, i) => {
          const f = faceFrame(ring, i);
          return {
            ...hole(
              `lantern-${i}`,
              on(f),
              f.axis,
              f.normal,
              r * 1.35,
              b + 0.35,
              t - b - 0.7,
              t - b - 0.7,
              'rect',
              r * 1.4,
            ),
            kind: 'glass',
          };
        })
      : [];
  if (d) {
    shell(out, d, ring, b, t, hs, slot, scaled(ring, 0.78));
    for (const h of hs) {
      pane(face, h, d, -0.36, 'glass');
      if (d >= 2) {
        const f = prepareOpening(h, 0, d),
          sg = Math.sign(-f.axis[1] * h.normal[0] + f.axis[0] * h.normal[1]);
        for (const u of [-0.24, 0.24])
          beam(
            face,
            f.point(h.width * u, h.bottom, -0.26 * sg),
            f.point(h.width * u, h.bottom + h.height, -0.26 * sg),
            0.11,
            'copper',
          );
        if (d >= 3)
          for (let y = h.bottom + 0.45; y < h.bottom + h.height; y += 0.6)
            beam(
              face,
              f.point(-h.width * 0.47, y, -0.25 * sg),
              f.point(h.width * 0.47, y, -0.25 * sg),
              0.1,
              'copper',
            );
      }
    }
  } else {
    solid(face, ring, b, t, 'glass');
    for (const p of ring) beam(face, at(p, b), at(p, t), 0.38, slot);
  }
  band(face, ring, b - 0.25, 0.3, slot, 1.08);
  band(face, ring, t, 0.3, slot, 1.13);
  cap(face, scaled(ring, 1.13), t + 0.3, slot);
  return ring;
}
function finial(face, p, b, h, d) {
  if (d === 0) {
    solid(face, R(p[0] - 0.12, p[1] - 0.12, p[0] + 0.12, p[1] + 0.12), b, b + h, 'accent');
    return;
  }
  beam(face, at(p, b), at(p, b + h), 0.12, 'accent');
  beam(
    face,
    [p[0] - 0.4, floor + b + h * 0.62, p[1]],
    [p[0] + 0.4, floor + b + h * 0.62, p[1]],
    0.12,
    'accent',
  );
}
function build(out, d) {
  out = footprintAware(out);
  const face = writer(out, d),
    hs = fields(d),
    cut = writer(
      masked(
        out,
        hs.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    bodies = [
      ['nave', 18],
      ['choir', 18],
      ['northAnnex', 8],
      ['southRange', 8],
      ['chapel', 10.8],
    ];
  for (const [n, h] of bodies) shell(out, d, plans[n], footing, h, hs, 'wall');
  gable(cut, plans.nave, 18, 26);
  hip(cut, plans.choir, 18, 24.5);
  hip(cut, plans.southRange, 8, 12);
  hip(cut, plans.northAnnex, 8, 11);
  profile(
    cut,
    plans.chapel,
    [
      [10.8, 1.03],
      [11.2, 1.06],
      [12.5, 0.82],
      [13.2, 0.56],
      [13.7, 0.35],
    ],
    'copper',
  );
  // Mapped34m west roof part controls the main stage top;upper onion/finial and small turret are picture estimates.
  const n = d === 0 ? 8 : d === 1 ? 8 : 16;
  // Copper apron follows the nave roof rather than floating above a separate hip.
  const roofY = (z) => 26.035 - (Math.abs(z - 0.1) * 8) / 15.2;
  for (const [z0, z1] of [
    [-6, 0.1],
    [0.1, 6],
  ])
    face(
      'copper',
      [
        [-30.4, floor + roofY(z0), z0],
        [-21.9, floor + roofY(z0), z0],
        [-21.9, floor + roofY(z1), z1],
        [-30.4, floor + roofY(z1), z1],
      ],
      [0, 1, 0],
    );
  solid(
    face,
    R(tc[0] - 3.45, tc[1] - 3.45, tc[0] + 3.45, tc[1] + 3.45),
    (p) => floor + roofY(p[1]) - 0.02,
    26.3,
    'copper',
  );
  lantern(out, face, tc, 3.45, 26.3, 34, d);
  const onion = circle(tc, 3.9, n);
  profile(
    face,
    onion,
    [
      [34.3, 1],
      [34.7, 1.08],
      [35.5, 0.98],
      [36.4, 0.72],
      [37.5, 0.49],
      [38.4, 0.39],
    ],
    'copper',
  );
  const mini = circle(tc, 1.05, n);
  lantern(out, face, tc, 0.78, 38.4, 40.1, d);
  profile(
    face,
    mini,
    [
      [40.4, 1.1],
      [40.7, 1.18],
      [41.15, 0.58],
      [41.5, 0.2],
    ],
    'copper',
  );
  finial(face, tc, 41.5, 0.9, d);
  const small = circle(fc, 1.2, n);
  solid(face, small, 23.2, 25.4, 'wall');
  const sm = lantern(out, face, fc, 0.72, 25.2, 26.6, d);
  profile(
    face,
    sm,
    [
      [26.9, 1.3],
      [27.2, 1.35],
      [27.55, 0.65],
      [27.8, 0.3],
    ],
    'copper',
  );
  finial(face, fc, 27.8, 0.8, d);
  if (d >= 1) {
    for (const h of hs) panel(face, h, d);
    for (const z of [-15.1, 15.3])
      for (const x of [-30, -15.8, -0.5, 6]) {
        solid(face, R(x - 0.5, z - 0.5, x + 0.5, z + 0.5), footing, 13.4, 'trim');
        profile(
          face,
          R(x - 0.6, z - 0.6, x + 0.6, z + 0.6),
          [
            [13.4, 1],
            [17.4, 0.48],
          ],
          'trim',
        );
      }
    for (let i = 0; i < plans.choir.length; i++) {
      const p = plans.choir[i];
      if (p[0] < 17) continue;
      solid(face, R(p[0] - 0.42, p[1] - 0.42, p[0] + 0.42, p[1] + 0.42), footing, 13.5, 'trim');
      profile(
        face,
        R(p[0] - 0.48, p[1] - 0.48, p[0] + 0.48, p[1] + 0.48),
        [
          [13.5, 1],
          [17.4, 0.45],
        ],
        'trim',
      );
    }
    if (d >= 2) {
      band(face, plans.nave, 17.65, 0.3, 'trim', 1.006);
      band(face, plans.choir, 17.65, 0.3, 'trim', 1.008);
      band(face, plans.chapel, 10.3, 0.5, 'trim', 1.025);
      for (const x of [-15.1, -10.1, -2.1]) {
        const z = x < -7.8 ? 21.7 : 20.45;
        solid(face, R(x - 0.3, z - 0.25, x + 0.3, z + 0.3), 0.1, 10.5, 'trim');
      }
      const front = R(-10.8, 21.1, -6.3, 22.05);
      solid(face, front, 9.7, 11.2, 'wall');
      gable(face, front, 11.2, 13.6, 'trim', 1);
      for (const z of [-12.2, 12.2]) {
        solid(face, R(-30.6, z - 0.4, -30.15, z + 0.4), 0.1, 17.4, 'trim');
      }
      // Shallow portal canopy and paired stone columns stay outside the recessed timber door.
      for (const z of [-2.35, 2.35])
        solid(face, R(-31.15, z - 0.25, -30.45, z + 0.25), 0.1, 6.2, 'trim');
      hip(face, R(-31.45, -2.8, -30, 2.8), 6.2, 7.3, 'copper');
      beam(face, [-29.9, floor + 26.06, 0.1], [6.15, floor + 26.06, 0.1], 0.2, 'copper');
      if (d >= 3) {
        for (const side of [-1, 1])
          for (const x of [-20, -8, 4]) {
            const z = side * 6.2,
              y = 26 - (Math.abs(z - 0.1) / 15.2) * 8;
            solid(face, R(x - 0.28, z - 0.3, x + 0.28, z + 0.3), y - 0.1, y + 0.6, 'copper');
            hip(face, R(x - 0.4, z - 0.4, x + 0.4, z + 0.4), y + 0.6, y + 0.85, 'copper');
          }
        // Simplified freestanding chapel finial; no copied fresco/sculpture surface art.
        solid(face, R(-8.7, 21.15, -8.3, 21.55), 13.45, 14.35, 'trim');
        finial(face, [-8.5, 21.35], 14.35, 0.8, d);
      }
    }
  }
}
export const buildGrazCathedralSkyline = (o) => build(o, 0),
  buildGrazCathedralDistrict = (o) => build(o, 1),
  buildGrazCathedralStreet = (o) => build(o, 2),
  buildGrazCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const grazCathedralStudy = {
  id: 'graz_cathedral',
  key: 'graz_cathedral',
  title: 'Graz Cathedral',
  category: 'cathedral',
  wikidataId: 'Q262563',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact way/QID and two current controls,all67 current raw points/height18/34m;earlier72 distinct points and roof:height8m/material/shape tags retained without rescale.',
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
    'Five existing cached256-square lime plaster,continuous limestone,ceramic tile,standing-seam copper and plain wood graphs.Metric UVs,linear pale-render/stone/red-tile/green-copper tints,flat normals,seven merged material groups.No embedded images,bespoke facade maps or baked lighting.',
  importReason:
    'Individual Gothic hall/red roof,large western copper lantern and small eastern turret,projecting southern Baroque chapel and attached ranges remain recognizable in four browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two actually inspected2009/2014 pictures and standard viewer PMTiles/DEM only.No bespoke surveys.The neighboring mausoleum dome/tower are excluded.Fine sculpture,exact fresco art,inscriptions,glass patterns,louvres/hidden bays,full interiors and engineering sections simplified or omitted.Current finish and exact ground joins unverified.Physical phone/laptop timing pending.',
    'Skyline retains main red roof/pale hall,polygonal choir,staged green western lantern,small turret and lower chapel/ranges.District adds selected deep glazing/portals and buttress silhouette.Street adds fuller windows,stone trim/portal canopy and chapel pilasters.Closeup/master add sparse tracery/transoms,door panels,lantern louvres and roof vents.Simplified partitions are estimates;all raw map controls retained.Regional context neighbors are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-gable-round-window-and-portal', [-63, 17, 5], [-30.4, 12, 0]),
    cam('large-copper-roof-lantern', [-47, 34, 25], [tc[0], 29, tc[1]]),
    cam('southern-gothic-bays-and-baroque-chapel', [-1, 19, 52], [-8, 11, 17]),
    cam('polygonal-choir-and-small-turret', [62, 27, -32], [20, 17, -3]),
    cam('lower-ranges-and-northern-bays', [11, 24, -51], [-6, 12, -15]),
    cam('whole-roof-plan', [0, 112, 0.1], [0, 13, 0]),
  ],
};

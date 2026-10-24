/** Linz Mariendom: cruciform copper roofs,staged stone tower/open crown and crossing fleche. */
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
  '../../../content/worldgen/source/places/u2/u2d/new_cathedral_linz/',
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
  wall: '#d7c4a1',
  trim: '#ead9b8',
  roof: '#819491',
  door: '#796049',
  glass: '#4a5f70',
  accent: '#494e4f',
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
const footing = (p) => Math.min(floor - 0.3, linzCathedralGround(...p) - 0.35);
export function linzCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('LinzCathedral Cathedral footing outside retained terrain');
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
const _main = rec.main.polygons[0].outline,
  plans = rec.plans,
  est = rec.estimated,
  tc = est.towerCenter,
  fc = est.flecheCenter;
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
function fields(d = 4) {
  if (!d) return [];
  const hs = [],
    add = (name, p, a, n, w, b, h, s, kind = 'glass', depth = 6, shape = 'pointed') =>
      hs.push({ ...hole(name, p, a, n, w, b, h, s, shape, depth), kind });
  for (const poly of plans.body)
    for (let i = 0; i < poly.outline.length; i++) {
      const f = faceFrame(poly.outline, i),
        p = on(f);
      if (d === 1 && p[0] > 34 && i % 2 === 1) continue;
      if (f.length < (p[0] > 34 ? 3 : 6) || p[0] < -47 || (p[0] > -10 && p[0] < 13)) continue;
      if (Math.abs(f.normal[1]) < 0.35 && p[0] < 40) continue;
      const count = d === 1 ? 1 : Math.max(1, Math.floor(f.length / (d === 2 ? 9 : 6)));
      for (let j = 0; j < count; j++) {
        const q = lerp(f.a, f.b, (j + 0.5) / count);
        add(
          `low-${i}-${j}`,
          q,
          f.axis,
          f.normal,
          Math.min(3.5, f.length / count - (p[0] > 34 ? 1.1 : 1.8)),
          4.5,
          11.9,
          8.4,
        );
      }
    }
  if (d >= 2)
    for (const z of [-8.55, 8.2])
      for (const x of [-41, -30, -19, -9, 20, 30])
        add(`clerestory-${z}-${x}`, [x, z], [1, 0], [0, Math.sign(z)], 4.2, 25, 7.7, 5.0);
  for (const z of [-32.5, 32.6]) {
    const n = [0, Math.sign(z)];
    add(`rose-${z}`, [2.9, z], [1, 0], n, 11.6, 20, 13.7, 7.4);
    add(`transept-door-${z}`, [2.9, z], [1, 0], n, 4.2, 0.2, 10, 6.8, 'door', 9);
    if (d >= 3)
      for (const x of [-0.2, 2.9, 6])
        add(`gable-blind-${z}-${x}`, [x, z], [1, 0], n, 1.6, 35.5, 4.6, 3.1, 'niche');
  }
  const f = edge(plans.tower, [-1, 0]);
  add('tower-door', [-64.2, tc[1]], f.axis, f.normal, 3.7, 0.2, 9, 6.2, 'door', 10);
  if (d >= 2)
    for (let i = 0; i < plans.tower.length; i++) {
      const f = faceFrame(plans.tower, i);
      add(`tower-tall-${i}`, on(f), f.axis, f.normal, 3.2, 16, 20, 16.3);
    }
  return hs;
}
export const linzCathedralFields = fields;
function bellFields(_d = 4) {
  return plans.belfry.map((_, i) => {
    const f = faceFrame(plans.belfry, i);
    return {
      ...hole(
        `bell-air-${i}`,
        on(f),
        f.axis,
        f.normal,
        Math.min(2.6, f.length - 1),
        52,
        13.0,
        9.8,
        'pointed',
        6,
      ),
      kind: 'air',
    };
  });
}
export const linzCathedralBelfryFields = bellFields;
function panel(face, h, d) {
  pane(face, h, d, -0.7, h.kind === 'door' ? 'door' : h.kind === 'niche' ? 'wall' : 'glass');
  if (d >= 2) archBand(face, h, d, 0.27, 'trim', 0.12);
  if (h.kind === 'door' && d >= 1) {
    archBand(face, h, d, 0.5, 'trim', 0.18);
    if (d >= 3) archBand(face, h, d, 0.82, 'trim', 0.23);
  }
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    pt = (u, y, o = -0.57) => p.point(u, y, o * sg);
  if (h.kind === 'door') {
    if (d >= 2) beam(face, pt(0, h.bottom + 0.1), pt(0, h.bottom + h.spring), 0.14, 'accent');
    return;
  }
  if (d < 2) return;
  if (h.name.startsWith('rose-')) {
    const y = h.bottom + 6.0,
      r = 4.45,
      N = d >= 3 ? 12 : 8;
    for (let i = 0; i < N; i++) {
      const a = (i * Math.PI * 2) / N,
        b = ((i + 1) * Math.PI * 2) / N;
      beam(
        face,
        pt(Math.cos(a) * r, y + Math.sin(a) * r),
        pt(Math.cos(b) * r, y + Math.sin(b) * r),
        0.13,
        'trim',
      );
      beam(face, pt(0, y), pt(Math.cos(a) * r, y + Math.sin(a) * r), 0.12, 'trim');
      if (d >= 3) {
        const rr = 0.63,
          cu = Math.cos(a) * r * 0.65,
          cy = y + Math.sin(a) * r * 0.65,
          ring = circle([cu, cy], rr, 6);
        for (let j = 0; j < 6; j++)
          beam(face, pt(...ring[j]), pt(...ring[(j + 1) % 6]), 0.1, 'trim');
      }
    }
    return;
  }
  for (const u of [-0.22, 0.22])
    beam(face, pt(h.width * u, h.bottom + 0.1), pt(h.width * u, h.bottom + h.spring), 0.11, 'trim');
  if (d >= 3) {
    const y = h.bottom + h.spring + 0.6,
      ring = circle([0, y], Math.min(0.7, h.width * 0.2), 8);
    for (let j = 0; j < 8; j++) beam(face, pt(...ring[j]), pt(...ring[(j + 1) % 8]), 0.1, 'trim');
    for (const f of [0.35, 0.7])
      beam(
        face,
        pt(-h.width * 0.45, h.bottom + h.spring * f),
        pt(h.width * 0.45, h.bottom + h.spring * f),
        0.08,
        'accent',
      );
  }
}
function pinnacle(face, p, b, h, d, r = 0.24, slot = 'trim') {
  solid(face, circle(p, r, d >= 3 ? 8 : 4), b, b + h * 0.65, slot);
  profile(
    face,
    circle(p, r * 1.35, 4, Math.PI / 4),
    [
      [b + h * 0.65, 1],
      [b + h, 0.02],
    ],
    slot,
  );
}
function strut(face, p, n, d, h = 20) {
  const a = [-n[1], n[0]],
    q = (u, v) => [p[0] + a[0] * u + n[0] * v, p[1] + a[1] * u + n[1] * v],
    r = (w, dep) => [q(-w / 2, -0.25), q(w / 2, -0.25), q(w / 2, dep), q(-w / 2, dep)];
  if (d === 1) {
    solid(face, r(0.9, 1.4), footing, h, 'wall');
    return;
  }
  for (const [b, t, dep] of [
    [0, 8, 2.1],
    [8, 15, 1.5],
    [15, h, 0.85],
  ]) {
    solid(face, r(1.0, dep), b, t, 'wall');
    cap(face, r(1.2, dep + 0.1), t, 'trim');
  }
  pinnacle(face, q(0, 0.3), h, 3.5, d);
}
function freeStage(face, r, b, t, d, radius = 0.38, slot = 'trim') {
  for (const p of r) solid(face, circle(p, radius, d >= 3 ? 8 : 4), b, t, slot);
}
function clock(face, r, d) {
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i),
      h = hole(`clock-${i}`, on(f), f.axis, f.normal, 3.1, 44.8, 3.1, 1.55, 'circle', 1);
    pane(face, h, d, 0.1, 'accent');
    if (d >= 2) {
      archBand(face, h, d, 0.18, 'trim', 0.15);
      const p = prepareOpening(h, 0, d),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
        pt = (u, y) => p.point(u, floor + 46.35 + y, 0.18 * sg);
      beam(face, pt(0, 0), pt(0.9, 0.3), 0.1, 'trim');
      beam(face, pt(0, 0), pt(-0.25, 1.15), 0.09, 'trim');
    }
  }
}
function tower(out, face, d, hs) {
  shell(
    out,
    d,
    plans.tower,
    footing,
    50,
    hs.filter((h) => h.name.startsWith('tower-')),
    'wall',
  );
  cap(face, plans.tower, 50, 'wall');
  if (d >= 1) {
    clock(face, plans.tower, d);
    for (const y of [14, 38, 49.5]) band(face, plans.tower, y, 0.4, 'trim', 1.05);
    for (const p of plans.tower) {
      solid(face, circle(lerp(tc, p, 0.88), 0.7, d >= 3 ? 8 : 4), footing, 51.8, 'wall');
      if (d >= 2) pinnacle(face, lerp(tc, p, 0.9), 51.8, 8, d, 0.38);
    }
  }
  if (d <= 1) freeStage(face, plans.belfry, 50, 68, d, d === 0 ? 0.6 : 0.45);
  else {
    shell(out, d, plans.belfry, 50, 68, bellFields(d), 'wall', scaled(plans.belfry, 0.56));
    for (const h of bellFields(d)) archBand(face, h, d, 0.27, 'trim', 0.12);
  }
  cap(face, plans.belfry, 68, 'trim');
  band(face, plans.belfry, 67.5, 0.5, 'trim', 1.07);
  const crown = scaled(plans.spire, 0.95);
  freeStage(face, crown, 68, 80, d, d === 0 ? 0.48 : 0.3);
  if (d >= 1)
    for (let i = 0; i < crown.length; i++) {
      const f = faceFrame(crown, i),
        h = hole(
          `crown-gable-${i}`,
          on(f),
          f.axis,
          f.normal,
          Math.max(0.6, f.length - 0.7),
          70,
          9.5,
          4.8,
          'pointed',
          2,
        );
      archBand(face, h, d, 0.32, 'trim', 0.12);
      if (d >= 2) pinnacle(face, crown[i], 68, 12, d, 0.22);
    }
  profile(
    face,
    crown,
    [
      [80, 0.98],
      [131, 0.025],
    ],
    'wall',
  );
  if (d >= 1)
    for (const p of crown)
      beam(
        face,
        at(lerp(tc, p, 0.98), 80),
        at(lerp(tc, p, 0.025), 131),
        d >= 3 ? 0.22 : 0.16,
        'trim',
      );
  if (d >= 3)
    for (const y of [85, 92, 99, 106, 113, 120]) {
      const ratio = 0.98 + ((y - 80) / 51) * (0.025 - 0.98);
      for (let i = 0; i < crown.length; i += d === 3 ? 2 : 1)
        pinnacle(face, lerp(tc, crown[i], ratio), y, 0.9, d, 0.12);
    }
  if (d === 0)
    profile(
      face,
      circle(tc, 0.15, 4),
      [
        [130.8, 1],
        [134.7, 0.03],
      ],
      'trim',
    );
  else {
    beam(face, at(tc, 130.8), at(tc, 134.7), 0.15, 'accent');
    beam(
      face,
      [tc[0] - 0.65, floor + 133.5, tc[1]],
      [tc[0] + 0.65, floor + 133.5, tc[1]],
      0.13,
      'accent',
    );
  }
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
    );
  const bodies = d === 0 ? plans.skylineBody : plans.body;
  for (const poly of bodies) {
    shell(out, d, poly.outline, footing, 19, hs, 'wall');
    for (const h of poly.holes) sides(cut, h, footing, 19, 'wall', true);
    cap(cut, poly.outline, 19, 'roof', poly.holes);
  }
  shell(out, d, plans.nave, 19, 34, hs, 'wall');
  gable(cut, plans.nave, 34, 46);
  shell(out, d, plans.transept, 19, 34, hs, 'wall');
  gable(cut, plans.transept, 34, 46, 'roof', 1);
  shell(out, d, plans.choir, 19, 34, hs, 'wall');
  for (let i = 0; i < plans.choirRoof.length - 1; i++)
    cut(
      'roof',
      [at(plans.choirRoof[i], 34), at(plans.choirRoof[i + 1], 34), at([30, 0], 46)],
      [0, 1, 0],
    );
  for (const z of [-1, 1]) {
    gable(cut, R(-47, z < 0 ? -16.5 : 8.2, 36, z < 0 ? -8.55 : 17), 19, 25);
    hip(cut, R(14, z < 0 ? -27 : 17, 33, z < 0 ? -16.5 : 27), 19, 24);
    hip(cut, R(-61, z < 0 ? -26 : 8.3, -46, z < 0 ? -9 : 25), 19, 25);
  }
  hip(cut, plans.eastLower, 19, 27);
  // The small mapped western part stays a low enclosure,not swallowed by the19m body.
  if (d >= 1) {
    sides(face, plans.canopy, footing, 4, 'glass');
    cap(face, plans.canopy, 4, 'glass');
    for (const p of plans.canopy) beam(face, at(p, 0), at(p, 4), 0.14, 'trim');
    for (let i = 0; i < plans.canopy.length; i++)
      beam(
        face,
        at(plans.canopy[i], 4),
        at(plans.canopy[(i + 1) % plans.canopy.length], 4),
        0.16,
        'trim',
      );
  } else solid(face, plans.canopy, footing, 4, 'glass');
  tower(out, face, d, hs);
  const fr = scaled(plans.fleche, 0.72);
  solid(face, scaled(plans.fleche, 1.1), 44, 47, 'roof');
  freeStage(face, fr, 47, 55, d, d === 0 ? 0.27 : 0.18, 'accent');
  if (d >= 1)
    for (let i = 0; i < fr.length; i++) {
      const j = (i + 1) % fr.length;
      beam(face, at(fr[i], 48.5), at(fr[j], 54.5), 0.13, 'accent');
      beam(face, at(fr[j], 48.5), at(fr[i], 54.5), 0.13, 'accent');
    }
  profile(
    face,
    scaled(plans.fleche, 1.05),
    [
      [55, 1],
      [67, 0.02],
    ],
    'roof',
  );
  for (const h of hs) panel(face, h, d);
  if (d >= 1) {
    for (const z of [-32.5, 32.6]) {
      const n = [0, Math.sign(z)];
      for (const x of [-5.2, 11]) strut(face, [x, z], n, d, 35);
      for (const x of [-5.2, 11]) beam(face, at([x, z], 34), at([2.9, z], 46), 0.3, 'trim');
      const g = R(0.4, z - 1.3, 5.4, z + 1.3);
      for (const x of [0.2, 5.6])
        solid(face, R(x - 0.3, z - 0.4, x + 0.3, z + 0.4), footing, 11.2, 'trim');
      gable(face, g, 11.2, 15.8, 'trim', 1);
    }
    if (d >= 2) {
      for (const h of hs.filter((h) => h.name.startsWith('low-'))) {
        const p = h.center.map((v, k) => v + h.axis[k] * (h.width * 0.5 + 0.85));
        strut(face, p, h.normal, d, 19.7);
      }
      for (const x of [-46, -35.5, -24.5, -14, 15, 25, 35])
        for (const side of [-1, 1]) {
          const z = side < 0 ? -16.5 : 17,
            inn = side < 0 ? -8.55 : 8.2;
          beam(face, [x, floor + 22, z], [x, floor + 30, inn], 0.55, 'wall');
          pinnacle(face, [x, z], 20, 5, d, 0.2);
        }
      for (const x of [-40, -28, -16, 19, 31])
        for (const side of [-1, 1]) {
          const z = side < 0 ? -5.8 : 5.8,
            r = R(x - 0.6, z - 0.6, x + 0.6, z + 0.6);
          solid(face, r, 38.2, 39.8, 'wall');
          gable(face, r, 39.8, 41, 'roof', 1);
        }
      if (d >= 3)
        for (const side of [-1, 1])
          for (let x = -45; x < 35; x += 3.8) {
            const z = side < 0 ? -8.55 : 8.2;
            beam(face, at([x, z], 34.1), at([x + 1.5, z], 34.1), 0.12, 'trim');
            pinnacle(face, [x, z], 34.1, 0.85, d, 0.085);
          }
    }
  }
}
export const buildLinzCathedralSkyline = (o) => build(o, 0),
  buildLinzCathedralDistrict = (o) => build(o, 1),
  buildLinzCathedralStreet = (o) => build(o, 2),
  buildLinzCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const linzCathedralStudy = {
  id: 'new_cathedral_linz',
  key: 'new_cathedral_linz',
  title: 'New Cathedral, Linz',
  category: 'cathedral',
  wikidataId: 'Q257481',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact way/QID and eight current whole/part controls,all637 raw vertices/tags and19/46/20/50/67/68/131/4m heights/min_height fields retained without rescale.',
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
    'Four existing cached256-square ashlar,continuous limestone,standing-seam metal and plain wood graphs.Linear warm stone/cream trim/muted gray-green copper roof tints,metric UVs,flat normals,six merged groups.No embedded images,unique facade maps or baked lighting.',
  importReason:
    'Four browser levels preserve massive cruciform cathedral,northern staged clock/belfry tower with open crown/long stone spire,smaller open crossing fleche and separate low western canopy.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two actually inspected2009 oblique/elevated pictures and standard viewer PMTiles/DEM.No bespoke plans/surveys.Fine sculpture,crockets,exact rose-window lobes/stained-glass art,lettering,hidden bays,full interiors/bells and engineering sections simplified or excluded.The upper stone cone is solid with ribs/sparse geometric crockets;its lower crown and crossing fleche retain genuine air.Current finish and exact hidden western4m canopy shape unverified.Physical laptop/phone timing pending.',
    'Skyline preserves cruciform roof hierarchy,lower chapel envelope,tall open-stage tower/stone spire and crossing fleche.District adds shared textures,selected recessed glazing/portals,clock,crown arches and main buttress silhouette.Street adds more choir/clerestory bays,mullions,rose spokes,dormers/flying struts.Closeup/master add simple foils/transoms,blind gable panels,parapet rhythms and sparse crockets.Body ring simplifies mapped micro projections while raw points remain intact.Regional neighbors are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('transept-pointed-rose-and-portal', [3, 27, -75], [2.9, 23, -32.5]),
    cam('northern-clock-tower-and-open-belfry', [-103, 64, -49], [tc[0], 54, tc[1]]),
    cam('pierced-crown-and-ribbed-stone-spire', [-103, 103, -54], [tc[0], 99, tc[1]]),
    cam('crossing-open-fleche-and-copper-roofs', [44, 67, -43], [fc[0], 53, fc[1]]),
    cam('southern-choir-chapels-and-aisle-bays', [106, 42, -53], [36, 23, 0]),
    cam('whole-roof-plan-and-low-west-canopy', [0, 185, 1], [0, 24, 0]),
  ],
};

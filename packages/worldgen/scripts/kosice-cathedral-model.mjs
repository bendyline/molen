/** Košice St.Elizabeth:patterned Gothic cruciform roof,unequal west towers and crossing fleche. */
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
    ? Array.from({ length: d === 0 ? 6 : d === 1 ? 8 : 16 }, (_, i) => {
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
  '../../../content/worldgen/source/places/u2/u2x/cathedral_of_st_elizabeth/',
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
  wall: '#d9cfba',
  trim: '#c8c2b0',
  roof: '#9a7255',
  metal: '#687078',
  door: '#7a5c3f',
  glass: '#4d6178',
  accent: '#c9ad61',
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
const footing = (p) => Math.min(floor - 0.3, kosiceCathedralGround(...p) - 0.35);
export function kosiceCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('KosiceCathedral Cathedral footing outside retained terrain');
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
  sc = est.southTowerCenter,
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
  on = (f) => lerp(f.a, f.b, 0.5),
  byId = (id) => rec.controls.find((b) => b.id === id),
  roofParts = plans.roofIds.map(byId),
  body = coarse(rec.main.polygons[0].outline);
const linear = (h) =>
    h
      .slice(1)
      .match(/../g)
      .map((s) => {
        const v = parseInt(s, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
  roofColors = ['#a66748', '#b09a63', '#546774', '#bfae8c'].map(linear);
function roofHeight(_id, [x, z]) {
  const nave = Math.max(Math.abs(z + 1.86) / 5.8, Math.max(0, x - 18.3) / 10.8),
    transept = Math.abs(x + 5.2) / 5.8;
  return 29.5 - Math.min(1, Math.min(nave, transept)) * 9.5;
}

function clipAxis(r, k, b, positive) {
  const out = [];
  let a = r.at(-1),
    va = (a[k] - b) * (positive ? 1 : -1);
  for (const p of r) {
    const v = (p[k] - b) * (positive ? 1 : -1);
    if (va >= -1e-8 !== v >= -1e-8) {
      const t = va / (va - v);
      out.push(lerp(a, p, t));
    }
    if (v >= -1e-8) out.push(p);
    a = p;
    va = v;
  }
  return out;
}
function patternedRoof(face, r, y, d) {
  if (d <= 1) {
    cap(face, coarse(r), (p) => floor + y(p), 'roof');
    return;
  }
  // Diamond cells use vertex colors over the common ceramic graph;no private roof bitmap.
  const cell = d === 2 ? 3.6 : 2.6,
    uv = r.map(([x, z]) => [x + z * 1.3, x - z * 1.3]),
    us = uv.map((p) => p[0]),
    vs = uv.map((p) => p[1]);
  for (let i = Math.floor(Math.min(...us) / cell); i < Math.ceil(Math.max(...us) / cell); i++)
    for (let j = Math.floor(Math.min(...vs) / cell); j < Math.ceil(Math.max(...vs) / cell); j++) {
      let q = uv;
      for (const [k, b, sg] of [
        [0, i * cell, true],
        [0, (i + 1) * cell, false],
        [1, j * cell, true],
        [1, (j + 1) * cell, false],
      ]) {
        if (!q.length) break;
        q = clipAxis(q, k, b, sg);
      }
      if (q.length < 3) continue;
      q = q.map(([u, v]) => [(u + v) / 2, (u - v) / 2.6]);
      const mod = (x, n) => ((x % n) + n) % n,
        phase = mod(i + j, 10),
        ci = phase === 0 ? 2 : phase === 1 ? 3 : phase === 5 ? 1 : 0,
        tint = roofColors[ci],
        ids = earcut(q.flat(), null, 2);
      for (let t = 0; t < ids.length; t += 3)
        face(
          'roof',
          ids.slice(t, t + 3).map((k) => at(q[k], (p) => floor + y(p))),
          [0, 1, 0],
          tint,
        );
    }
}

function fields(d = 4) {
  if (!d) return [];
  const hs = [],
    add = (name, p, a, n, w, b, h, s, kind = 'glass', shape = 'pointed', depth = 4) =>
      hs.push({ ...hole(name, p, a, n, w, b, h, s, shape, depth), kind });
  for (let i = 0; i < body.length; i++) {
    const f = faceFrame(body, i),
      p = on(f);
    if (
      f.length < 3.3 ||
      p[0] < -19 ||
      (Math.abs(p[0] + 5.2) < 6 && Math.abs(p[1]) > 14) ||
      (d === 1 && i % 2)
    )
      continue;
    const count = d === 1 ? 1 : Math.max(1, Math.floor(f.length / 5.8));
    for (let j = 0; j < count; j++)
      add(
        `aisle-${i}-${j}`,
        lerp(f.a, f.b, (j + 0.5) / count),
        f.axis,
        f.normal,
        Math.min(2.6, f.length / count - 1.6),
        2,
        7.2,
        5.3,
      );
  }
  for (const poly of plans.high)
    for (let i = 0; i < poly.outline.length; i++) {
      const f = faceFrame(poly.outline, i),
        p = on(f);
      if (
        f.length < 3.5 ||
        p[0] < -20 ||
        (Math.abs(p[0] + 5.2) < 7 && Math.abs(p[1]) > 12) ||
        (d === 1 && i % 3)
      )
        continue;
      const count = d === 1 ? 1 : Math.max(1, Math.floor(f.length / 6));
      for (let j = 0; j < count; j++)
        add(
          `high-${i}-${j}`,
          lerp(f.a, f.b, (j + 0.5) / count),
          f.axis,
          f.normal,
          Math.min(3.4, f.length / count - 1.5),
          13.2,
          5.6,
          3.7,
          p[0] > 17 ? 'glass' : 'niche',
        );
    }
  for (const z of [-17.8, 19.5]) {
    const north = z < 0,
      n = [0, Math.sign(z)];
    add(`transept-window-${z}`, [-5.2, z], [1, 0], n, 5.8, 11.5, 8, 5.5);
    add(`transept-door-${z}`, [-5.2, z], [1, 0], n, 4.4, 0.15, 8.6, 5.8, 'door', 'pointed', 8);
    if (d >= 2) {
      const dia = north ? 3 : 2.4;
      add(
        `gable-round-${z}`,
        [-5.2, z],
        [1, 0],
        n,
        dia,
        north ? 24 : 23.4,
        dia,
        dia,
        'niche',
        'circle',
        5,
      );
      for (const x of north ? [-7.8, -2.6] : [-7.2, -3.6])
        add(
          `gable-blind-${z}-${x}`,
          [x, z],
          [1, 0],
          n,
          1.7,
          20.6,
          north ? 4.4 : 3.5,
          north ? 3.0 : 2.4,
          'niche',
        );
    }
  }
  add('west-door', [-27.5, -1.86], [0, 1], [-1, 0], 4.2, 0.15, 8.2, 5.8, 'door', 'pointed', 6);
  add('west-light', [-27.5, -1.86], [0, 1], [-1, 0], 6.2, 11.5, 8.1, 5.5);
  if (d >= 2) {
    for (const z of [-4.36, -1.86, 0.64])
      add(`west-gable-${z}`, [-27.5, z], [0, 1], [-1, 0], 1.65, 20.4, 4, 2.8, 'niche');
    add('west-gable-round', [-27.5, -1.86], [0, 1], [-1, 0], 2.2, 26, 2.2, 2.2, 'niche', 'circle');
  }
  for (const [n, r, heights] of [
    ['north', plans.northTower, d === 1 ? [34] : [12.5, 23.5, 34]],
    ['south', plans.southTower, d === 1 ? [20] : [9, 20]],
  ])
    for (const normal of [
      [-1, 0],
      [0, -1],
      [1, 0],
      [0, 1],
    ]) {
      const f = edge(r, normal);
      for (const b of heights)
        add(
          `tower-${n}-${normal}-${b}`,
          on(f),
          f.axis,
          f.normal,
          Math.min(2.3, f.length - 1),
          b,
          n === 'north' ? 7.8 : 7,
          n === 'north' ? 5.3 : 4.8,
        );
    }
  return hs;
}
export const kosiceCathedralFields = fields;
function panel(face, h, d) {
  pane(face, h, d, -0.65, h.kind === 'door' ? 'door' : h.kind === 'niche' ? 'wall' : 'glass');
  if (d < 2) return;
  archBand(face, h, d === 2 ? 1 : d, h.kind === 'door' ? 0.6 : 0.23, 'trim', 0.1);
  if (h.kind === 'door' && d >= 3) archBand(face, h, d, 0.95, 'trim', 0.2);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    pt = (u, y) => p.point(u, y, -0.48 * sg);
  if (h.kind === 'door') {
    beam(face, pt(0, h.bottom + 0.1), pt(0, h.bottom + h.spring), 0.16, 'metal');
    return;
  }
  if (h.shape === 'circle') {
    const y = h.bottom + h.height / 2,
      r = h.width * 0.36,
      n = d >= 3 ? 8 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n;
      beam(face, pt(0, y), pt(Math.cos(a) * r, y + Math.sin(a) * r), 0.11, 'trim');
    }
    return;
  }
  for (const u of [-0.22, 0.22])
    beam(face, pt(h.width * u, h.bottom + 0.1), pt(h.width * u, h.bottom + h.spring), 0.12, 'trim');
  if (d >= 3) {
    for (const u of [-0.22, 0.22])
      beam(
        face,
        pt(h.width * u, h.bottom + h.spring),
        pt(0, h.bottom + h.height - 0.25),
        0.1,
        'trim',
      );
    for (const f of [0.35, 0.7])
      beam(
        face,
        pt(-h.width * 0.43, h.bottom + h.spring * f),
        pt(h.width * 0.43, h.bottom + h.spring * f),
        0.1,
        'trim',
      );
  }
}
function pinnacle(face, p, b, h, d, r = 0.3, slot = 'trim') {
  const ring = circle(p, r, d <= 1 ? 4 : 8);
  profile(
    face,
    ring,
    [
      [b, 1],
      [b + h * 0.17, 1.1],
      [b + h * 0.3, 0.65],
      [b + h, 0.02],
    ],
    slot,
  );
}
function openStage(face, r, b, t, d, w = 0.25, slot = 'metal') {
  for (const p of r) beam(face, at(p, b), at(p, t), w, slot);
  band(face, r, b, 0.23, slot, 1.06);
  band(face, r, t, 0.23, slot, 1.1);
  if (d >= 2)
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      beam(face, at(r[i], b + 0.3), at(r[j], t - 0.3), 0.12, slot);
    }
}
function crownScale(y) {
  const levels = [
    [46, 1.06],
    [47, 1.08],
    [49.2, 0.8],
    [51.7, 0.42],
  ];
  for (let i = 1; i < levels.length; i++)
    if (y <= levels[i][0])
      return (
        levels[i - 1][1] +
        ((levels[i][1] - levels[i - 1][1]) * (y - levels[i - 1][0])) /
          (levels[i][0] - levels[i - 1][0])
      );
  return 0.42;
}
function clock(face, d) {
  if (!d) return;
  for (const n of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const axis = [-n[1], n[0]],
      f = edge(plans.northTower, n),
      p = on(f),
      extent = (p[0] - tc[0]) * n[0] + (p[1] - tc[1]) * n[1],
      pt = (u, y, off = 0.08) => [
        tc[0] + axis[0] * u + n[0] * (extent * crownScale(y) + off),
        floor + y,
        tc[1] + axis[1] * u + n[1] * (extent * crownScale(y) + off),
      ],
      ring = circle([0, 48.5], 1.48, d >= 2 ? 16 : 8);
    face(
      'accent',
      ring.map((q) => pt(...q)),
      [n[0], 0, n[1]],
      linear('#e7dfbd'),
    );
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length,
        outer = (q) => [q[0] * 1.1, 48.5 + (q[1] - 48.5) * 1.1];
      face(
        'accent',
        [
          pt(...ring[i], 0.13),
          pt(...ring[j], 0.13),
          pt(...outer(ring[j]), 0.13),
          pt(...outer(ring[i]), 0.13),
        ],
        [n[0], 0, n[1]],
      );
    }
    beam(face, pt(0, 48.5, 0.18), pt(-0.7, 49.15, 0.18), 0.13, 'metal');
    beam(face, pt(0, 48.5, 0.18), pt(0.83, 48.7, 0.18), 0.13, 'metal');
    if (d >= 3)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        beam(
          face,
          pt(Math.cos(a) * 1.14, 48.5 + Math.sin(a) * 1.14, 0.16),
          pt(Math.cos(a) * 1.3, 48.5 + Math.sin(a) * 1.3, 0.16),
          0.08,
          'metal',
        );
      }
  }
}
function towers(out, face, cut, hs, d) {
  for (const [n, r, h] of [
    ['north', plans.northTower, 46],
    ['south', plans.southTower, 30],
  ]) {
    shell(out, d, r, footing, h, hs, 'wall');
    cap(cut, r, h, 'metal');
    if (d >= 1) {
      for (const y of n === 'north' ? [10.8, 21.8, 32.5, 45.4] : [18, 29.5])
        band(cut, r, y, 0.4, 'trim', 1.03);
      if (d >= 3) for (const p of r) pinnacle(cut, p, h - 4, 5, d, 0.22);
    }
  }
  profile(
    face,
    plans.northTower,
    [
      [46, 1.06],
      [47, 1.08],
      [49.2, 0.8],
      [51.7, 0.42],
    ],
    'metal',
  );
  clock(face, d);
  openStage(
    face,
    circle(tc, 1.45, d === 0 ? 4 : d === 1 ? 6 : 8),
    51.7,
    55.3,
    d,
    d <= 1 ? 0.28 : 0.2,
  );
  profile(
    face,
    circle(tc, 1.75, d <= 1 ? 8 : 16),
    [
      [55.6, 1],
      [56.2, 1.08],
      [57.2, 0.52],
      [57.9, 0.12],
    ],
    'metal',
  );
  beam(face, at(tc, 57.9), at(tc, 59), 0.15, 'accent');
  if (d >= 1) {
    beam(
      face,
      [tc[0] - 0.5, floor + 58.6, tc[1]],
      [tc[0] + 0.5, floor + 58.6, tc[1]],
      0.14,
      'accent',
    );
    for (const p of plans.northTower) {
      const q = lerp(tc, p, 1.08);
      for (const [a, b] of [
        [46.3, 47],
        [47, 49.2],
        [49.2, 51.6],
      ]) {
        const v = (y) => [
          tc[0] + (p[0] - tc[0]) * crownScale(y),
          floor + y,
          tc[1] + (p[1] - tc[1]) * crownScale(y),
        ];
        beam(face, v(a), v(b), d === 1 ? 0.2 : 0.14, 'accent');
      }
      if (d >= 2) pinnacle(face, q, 45.4, 2.3, d, 0.25, 'accent');
    }
  }
  profile(
    face,
    plans.southTower,
    [
      [30, 1.05],
      [30.4, 1.08],
      [36.4, 0.03],
    ],
    'metal',
  );
  beam(face, at(sc, 36.4), at(sc, 37), 0.13, 'accent');
  const stair = plans.stairTurret;
  shell(out, d, stair, footing, 42.5, hs, 'wall');
  profile(
    face,
    stair,
    [
      [42.5, 1.02],
      [43.3, 1.08],
      [44.6, 0.1],
    ],
    'metal',
  );
  solid(face, plans.crossing, 29.4, 30.2, 'metal');
  const f = d === 0 ? circle(fc, 1.5, 4) : scaled(plans.fleche, 1.02);
  openStage(face, f, 30.2, 35, d, 0.2);
  profile(
    face,
    scaled(f, 1.13),
    [
      [35, 1],
      [45.4, 0.025],
    ],
    'metal',
  );
  beam(face, at(fc, 45.4), at(fc, 46), 0.11, 'accent');
  if (d >= 2)
    for (const p of f) {
      beam(face, at(p, 35), at(fc, 45.4), 0.1, 'metal');
      for (const h of [36.5, 39, 41.5])
        band(face, scaled(f, (45.4 - h) / 10.4), h, 0.15, 'metal', 1);
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
  shell(out, d, body, footing, 9.5, hs, 'wall');
  cap(cut, body, 9.5, 'roof');
  for (const poly of plans.high)
    shell(out, d, d === 0 ? coarse(poly.outline) : poly.outline, footing, 20, hs, 'wall');
  for (const id of plans.lowIds) {
    const b = byId(id),
      r = b.polygons[0].outline,
      h = b.properties.height;
    shell(out, d, r, footing, h - 2, hs, 'wall');
    hip(cut, r, h - 2, h);
  }
  for (const p of roofParts)
    for (const poly of p.polygons)
      patternedRoof(cut, coarse(poly.outline), (q) => roofHeight(p.id, q), d);
  patternedRoof(
    cut,
    plans.roofJoin,
    (p) => 29.5 - Math.min(1, Math.abs(p[1] + 1.86) / 5.8) * 9.5,
    d,
  );
  for (const [z, x0, x1] of [
    [-17.8, -10.9, 0.5],
    [14.1, -11.1, 0.3],
  ])
    cut(
      'wall',
      [
        [x0, floor + 20, z],
        [x1, floor + 20, z],
        [-5.2, floor + 29.5, z],
      ],
      [0, 0, Math.sign(z)],
    );
  cut(
    'wall',
    [
      [-27.5, floor + 20, -7.4],
      [-27.5, floor + 20, 3.85],
      [-27.5, floor + 29.5, -1.86],
    ],
    [-1, 0, 0],
  );
  // Tall southern portal has its own mapped27.6m projecting gable,not a fabricated transept tower.
  shell(out, d, plans.southPortal, footing, 20, hs, 'wall');
  gable(cut, plans.southPortal, 20, 27.6, 'roof', 1);
  towers(out, face, cut, hs, d);
  if (d >= 1) {
    for (const h of hs) panel(face, h, d);
    const selected = rec.controls.filter(
      (b) =>
        b.properties.kind === 'building_part' &&
        b.properties.height >= 16 &&
        b.properties.height <= 30 &&
        b.polygons.every((p) => {
          const xs = p.outline.map((p) => p[0]),
            zs = p.outline.map((p) => p[1]);
          return Math.max(...xs) - Math.min(...xs) < 3.1 && Math.max(...zs) - Math.min(...zs) < 3.1;
        }),
    );
    for (let i = 0; i < selected.length; i++) {
      const b = selected[i];
      if ((d === 1 && i % 4) || (d === 2 && i % 2)) continue;
      const r = b.polygons[0].outline,
        h = b.properties.height;
      profile(
        cut,
        r,
        [
          [0, 1],
          [h - 4, 1],
          [h - 3, 0.85],
          [h - 2, 0.6],
          [h, 0.03],
        ],
        'trim',
      );
    }
    for (const z of [-17.8, 19.5]) {
      const north = z < 0,
        sg = Math.sign(z),
        a = north ? -10.9 : -9.5,
        b = north ? 0.5 : -1.25,
        top = north ? 29.5 : 27.6;
      for (const x of [a + 0.5, b - 0.5]) pinnacle(cut, [x, z], top - 4, 5, d, 0.35);
      beam(cut, [a, floor + 20, z + sg * 0.2], [-5.2, floor + top, z + sg * 0.2], 0.32, 'trim');
      beam(cut, [b, floor + 20, z + sg * 0.2], [-5.2, floor + top, z + sg * 0.2], 0.32, 'trim');
      pinnacle(face, [-5.2, z], top, 2.7, d, 0.24);
    }
    for (const z of [-7.4, 3.85]) {
      beam(cut, [-27.7, floor + 20, z], [-27.7, floor + 29.5, -1.86], 0.32, 'trim');
      pinnacle(face, [-27.6, z], 20, 9, d, 0.28);
    }
    pinnacle(face, [-27.6, -1.86], 29.5, 3.3, d, 0.28);
    if (d >= 2) {
      for (const r of [body, ...plans.high.map((p) => p.outline)]) {
        const h = r === body ? 12.4 : 20.2;
        band(face, r, h, 0.3, 'trim', 1.008);
        for (let i = 0; i < r.length; i++) {
          const f = faceFrame(r, i);
          if (f.length < 5) continue;
          const count = Math.max(1, Math.floor(f.length / 3.3));
          for (let j = 0; j < count; j++) {
            const p = lerp(f.a, f.b, (j + 0.5) / count);
            beam(face, at(p, h), at(p, h + 1.25), 0.16, 'trim');
            if (d >= 3) {
              const q = p.map((v, k) => v + f.axis[k] * 1.2);
              beam(face, at(p, h + 0.2), at(q, h + 1.1), 0.12, 'trim');
            }
          }
        }
        band(face, r, h + 1.2, 0.16, 'trim', 1.012);
      }
      // Gable tracery is geometric and sparse;sculpted saints and inscriptions are excluded.
      for (const z of [-17.8, 19.5])
        for (const [x, y, r] of [
          [-5.2, z < 0 ? 26 : 24.6, 0.9],
          [-7.1, z < 0 ? 22.3 : 21.8, 0.65],
          [-3.3, z < 0 ? 22.3 : 21.8, 0.65],
        ]) {
          const ring = circle([x, y], r, 8);
          for (let i = 0; i < ring.length; i++) {
            const j = (i + 1) % ring.length;
            beam(
              cut,
              [ring[i][0], floor + ring[i][1], z + Math.sign(z) * 0.15],
              [ring[j][0], floor + ring[j][1], z + Math.sign(z) * 0.15],
              0.11,
              'trim',
            );
          }
        }
      for (const z of [-18, 19.5]) {
        const ring = R(-7.7, z - 0.55, -2.7, z + 0.55);
        for (const x of [-7.7, -2.7])
          solid(cut, R(x - 0.25, z - 0.4, x + 0.25, z + 0.4), footing, 9.5, 'trim');
        gable(cut, ring, 9.5, 12.3, 'trim', 1);
      }
    }
  }
}
export const buildKosiceCathedralSkyline = (o) => build(o, 0),
  buildKosiceCathedralDistrict = (o) => build(o, 1),
  buildKosiceCathedralStreet = (o) => build(o, 2),
  buildKosiceCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const kosiceCathedralStudy = {
  id: 'cathedral_of_st_elizabeth',
  key: 'cathedral_of_st_elizabeth',
  title: 'Cathedral of St. Elizabeth',
  category: 'cathedral',
  wikidataId: 'Q569428',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact way/QID,whole213 current vertices and107 parts/all656 part vertices;all869 current raw points/properties/heights/min_height and earlier274 distinct whole points retained without rescale.',
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
    'Five existing cached256-square ashlar,continuous limestone,ceramic tile,standing-seam metal and plain wood graphs supply seven merged groups.Pale/grey stone,red/ochre/slate/cream roof-pattern colors,dark metal and gold accents use linear tints and metric UVs.Flat architectural normals.No embedded images,unique facade maps,reference-photo textures or baked lighting.Roof pattern is coarse geometry/vertex color over the shared tile graph;its detailed motif sequence is approximate.',
  importReason:
    'Preserve patterned cruciform roof/choir,unequal western towers with northern onion-clock crown and southern dark pyramidal cap,slender crossing fleche and ornamental gable/portal silhouettes in four browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two actually inspected2019/2020 whole oblique/western photographs and standard viewer PMTiles/DEM only.No bespoke plans/surveys.Reference images not redistributed.Roof motif sequence,fine saints/crockets,tracery lobes,inscriptions,glass artwork,gold crown flourishes,hidden elevations,full interiors and engineering sections are approximate or excluded.Separate St. Michael chapel/Urban tower and streets remain host content.Current finish and precise host-ground joins unverified.Physical laptop/phone timing pending.',
    'Skyline retains cruciform/choir roof hierarchy,tall staged onion clock tower,lower southern roof-cap tower,crossing fleche and lower aisle envelope.District adds shared surfaces,selected recesses/clock/portals and principal pinnacles.Street adds coarse multicolor roof pattern,fuller windows/blind tracery,stone trim/parapet rhythms.Closeup/master refine the roof color rhythm,selected tracery/transoms,clock ticks/gold ribs and gable detail.No unique roof texture.Raw micro-projections are simplified;partitions/eaves/roof joins are explicit estimates.Regional neighbors are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('north-clock-onion-crown', [-48, 50, -42], [tc[0], 47, tc[1]]),
    cam('west-portal-and-unequal-towers', [-69, 25, -2], [-26, 20, -1]),
    cam('northern-transept-portal-and-gable', [-2, 25, -52], [-5.2, 17, -17.8]),
    cam('southern-portal-and-aisles', [11, 23, 55], [-4, 14, 15]),
    cam('patterned-choir-roof-and-central-fleche', [63, 40, -32], [17, 24, -2]),
    cam('whole-roof-plan', [0, 130, 0.1], [0, 21, 0]),
  ],
};

/** Ferrara Cathedral: triple marble gables, arcaded protyrus, brick cross roofs and striped campanile. */
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
        const a = (i * Math.PI * 2) / (d === 0 ? 6 : d === 1 ? 8 : 16);
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
  '../../../content/worldgen/source/places/sr/srb/ferrara_cathedral/',
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
  wall: '#bd9072',
  marble: '#e5dace',
  trim: '#e8dfce',
  roof: '#a97a63',
  door: '#775b41',
  glass: '#4d6178',
  accent: '#c2a49a',
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
const footing = (p) => Math.min(floor - 0.3, ferraraGround(...p) - 0.35);
export function ferraraGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Ferrara Cathedral footing outside retained terrain');
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
    const a = r[i],
      z = r[(i + 1) % r.length],
      count = Math.max(1, Math.ceil(Math.hypot(z[0] - a[0], z[1] - a[1]) / 16));
    for (let j = 0; j < count; j++) {
      const p = lerp(a, z, j / count),
        q = lerp(a, z, (j + 1) / count);
      face(
        r === main && p[0] < -59 && q[0] < -59 ? 'marble' : slot,
        [at(p, b), at(q, b), at(q, t), at(p, t)],
        [(q[1] - p[1]) * s, 0, (p[0] - q[0]) * s],
      );
    }
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
        slot === 'marble' ? 'marble' : 'wall',
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
function footprintAware(out) {
  const target = out;
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const toWorld = (p) => [p[0] * c + p[2] * s, -p[0] * s + p[2] * c];
  const clearanceBounds = [
    ...fit.excludedBuildings.flatMap((b) => b.polygons.map((p) => p.outline)),
    R(-81, -13, -71, 13),
    R(-35, 35, 25, 42),
  ].map((r) => {
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
      longest > 16 &&
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
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  plans = rec.plans,
  main = rec.main.polygons[0].outline.map(([x, z]) => [
    z > -4.2 && z < 4.2 ? Math.max(x, -59.82) : x,
    z,
  ]),
  tower = R(45.1, 14.5, 57.9, 28.1),
  inner = R(46.2, 15.6, 56.8, 27),
  circle = (p, r, n = 12) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + r * Math.cos((i * 2 * Math.PI) / n),
      p[1] + r * Math.sin((i * 2 * Math.PI) / n),
    ]);
const aperture = (name, p, n, w, b, h, s, shape = 'round', depth = 4) =>
  hole(name, p, [-n[1], n[0]], n, w, b, h, s, shape, depth);
const roundWindow = (name, p, n, r, y) => ({
  ...aperture(name, p, n, 2 * r, y - r, 2 * r, r, 'round', 7),
  shape: 'circle',
});
export function ferraraFields(d = 3) {
  const hs = [];
  for (const z of [-14.3, 0.2, 14.6]) {
    hs.push(roundWindow(`front-rose-${z}`, [-59.81, z], [-1, 0], 1.5, 26.1));
    if (d >= 2 || z !== 0.2)
      hs.push({
        ...aperture(
          `front-door-${z}`,
          [-59.81, z],
          [-1, 0],
          z === 0.2 ? 3.2 : 2.2,
          0.45,
          z === 0.2 ? 6.4 : 4.8,
          z === 0.2 ? 4.8 : 3.7,
        ),
        kind: 'door',
      });
    if (d >= 1) {
      const n = d >= 3 ? 6 : 3;
      for (let i = 0; i < n; i++)
        hs.push({
          ...aperture(
            `front-low-${z}-${i}`,
            [-59.81, z + (i - (n - 1) / 2) * (12.7 / n)],
            [-1, 0],
            12.7 / n - 0.32,
            10.5,
            2.7,
            1.8,
            'round',
            3,
          ),
          kind: 'blind',
        });
      const nm = d >= 3 ? 7 : d === 2 ? 4 : 3;
      for (let i = 0; i < nm; i++)
        hs.push({
          ...aperture(
            `front-middle-${z}-${i}`,
            [-59.81, z + (i - (nm - 1) / 2) * (13 / nm)],
            [-1, 0],
            13 / nm - 0.3,
            16.7,
            3.1,
            2.2,
            'round',
            3,
          ),
          kind: 'blind',
        });
      for (let i = 0; i < (d >= 3 ? 4 : 3); i++) {
        const count = d >= 3 ? 4 : 3;
        hs.push({
          ...aperture(
            `front-upper-${z}-${i}`,
            [-59.81, z + ((i - (count - 1) / 2) * 12.7) / count],
            [-1, 0],
            12.7 / count - 0.35,
            20.3,
            4.1,
            2.6,
            'pointed',
            3,
          ),
          kind: 'blind',
        });
      }
    }
  }
  if (d >= 1) {
    for (const side of [-1, 1])
      for (const [j, r] of plans.monitors.entries()) {
        const x = (r[0][0] + r[1][0]) / 2,
          z = side < 0 ? r[0][1] : r[2][1];
        hs.push(aperture(`monitor-${side}-${j}`, [x, z], [0, side], 3, 29.4, 2.8, 2.8, 'rect', 3));
      }
    for (const side of [-1, 1])
      for (let i = 0; i < 9; i++) {
        const x = -51 + i * 9.6;
        if (plans.crosses.some((r) => x > r[0][0] - 1 && x < r[1][0] + 1)) continue;
        hs.push(
          aperture(`nave-${side}-${i}`, [x, side < 0 ? -9.2 : 10.9], [0, side], 2.5, 15, 4.3, 3.05),
        );
      }
    for (let i = 0; i < 8; i++) {
      const p = rec.main.polygons[0].outline;
      const r = p.slice(3, 16),
        a = r[i],
        b = r[i + 1];
      if (!b) continue;
      const mid = lerp(a, b, 0.5);
      if (mid[0] < 53) continue;
      const n = unit([mid[0] - 51.5, mid[1] - 0.8]);
      hs.push(aperture(`apse-${i}`, mid, n, 1.5, 16, 5, 4.2));
    }
  }
  return hs;
}
export function ferraraBellFields(d = 3) {
  const hs = [];
  for (let i = 0; i < 4; i++) {
    const f = faceFrame(tower, i),
      count = d === 0 ? 1 : 3;
    for (let j = 0; j < count; j++)
      hs.push(
        aperture(
          `bell-${i}-${j}`,
          lerp(f.a, f.b, 0.5 + ((j - (count - 1) / 2) * 3.4) / f.length),
          f.normal,
          d === 0 ? 8.6 : 2.65,
          33.8,
          8.6,
          7.275,
          'round',
          4,
        ),
      );
  }
  return hs;
}
const portal = R(-62.1, -3.65, -58.85, 4.05),
  portalInner = R(-61.5, -2.95, -59.45, 3.35);
const lowerPorch = [
  aperture('porch-front', [-62.1, 0.2], [-1, 0], 6.1, 0.4, 9.2, 6.15, 'round', 8),
  aperture('porch-side-north', [-60.5, -3.65], [0, -1], 2.3, 0.4, 8.8, 7.65, 'round', 12),
  aperture('porch-side-south', [-60.5, 4.05], [0, 1], 2.3, 0.4, 8.8, 7.65, 'round', 12),
];
const upperPorch = [
  ...[-2.1, 0.2, 2.5].map((z, i) =>
    aperture(`balcony-front-${i}`, [-62.1, z], [-1, 0], 1.85, 12.2, 4.3, 3.38, 'round', 3.5),
  ),
  aperture('balcony-north', [-60.45, -3.65], [0, -1], 2.25, 12.2, 4.3, 3.175, 'round', 10),
  aperture('balcony-south', [-60.45, 4.05], [0, 1], 2.25, 12.2, 4.3, 3.175, 'round', 10),
];
export const ferraraPorchFields = () => [...lowerPorch, ...upperPorch];
function panel(face, h, d) {
  pane(
    face,
    h,
    d,
    d === 1 && h.kind !== 'door' && h.shape !== 'circle' ? 0.03 : -0.6,
    h.kind === 'door' ? 'door' : h.kind === 'blind' ? 'accent' : 'glass',
  );
  if (d >= 2) {
    archBand(face, h, d, 0.2, 'trim', 0.06);
    if (d >= 3 && h.kind !== 'blind') archBand(face, h, d, 0.4, 'trim', 0.11);
    if (h.shape === 'circle') {
      const p = prepareOpening(h, 0, d),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
        y = h.bottom + h.height / 2,
        count = d >= 3 ? 8 : 6,
        radius = h.width * 0.46;
      for (let i = 0; i < count; i++) {
        const a = (i * Math.PI * 2) / count,
          u = Math.cos(a),
          v = Math.sin(a),
          w = 0.055;
        face(
          'trim',
          [
            [u * 0.18 - v * w, y + v * 0.18 + u * w],
            [u * radius - v * w, y + v * radius + u * w],
            [u * radius + v * w, y + v * radius - u * w],
            [u * 0.18 + v * w, y + v * 0.18 - u * w],
          ].map((q) => p.point(...q, -0.56 * sg)),
          [h.normal[0], 0, h.normal[1]],
        );
      }
    }
    if (h.kind === 'door') {
      const p = prepareOpening(h, 0, d),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      beam(
        face,
        p.point(0, h.bottom, -0.58 * sg),
        p.point(0, h.bottom + h.spring, -0.58 * sg),
        0.12,
        'trim',
      );
    }
  }
}
function arcade(face, d, side) {
  const z = side < 0 ? -21.65 : 21.65,
    n = [0, side];
  for (const [b, h, count] of [
    [10, 4, d >= 3 ? 27 : 12],
    [17, 2.7, d >= 3 ? 40 : 18],
  ]) {
    const pitch = 87 / count;
    for (let i = 0; i < count; i++) {
      const x = -58 + (i + 0.5) * pitch,
        opening = aperture(
          'side-blind',
          [x, z],
          n,
          pitch - 0.45,
          b,
          h,
          h - (pitch - 0.45) / 2,
          'round',
          1,
        );
      pane(face, opening, d, 0.02, 'accent');
      archBand(face, opening, d, 0.14, 'trim', 0.1);
      if (d >= 3)
        solid(
          face,
          circle([x - pitch / 2 + 0.16, z + side * 0.14], 0.15, 6),
          b,
          b + h - (pitch - 0.45) / 2,
          'trim',
        );
    }
  }
}
function frontDetails(face, d) {
  for (const z of [-21.5, -7.2, 7.6, 21.5]) {
    solid(face, R(-60.02, z - 0.27, -59.35, z + 0.27), 0, 24, 'trim');
    if (d >= 2)
      for (const y of [10, 16.2, 20.1, 24])
        solid(face, R(-60.15, z - 0.48, -59.25, z + 0.48), y, 0.3 + y, 'trim');
  }
  for (const y of [10, 16, 20, 24]) solid(face, R(-60, -21.6, -59.6, 21.6), y, y + 0.22, 'trim');
  if (d >= 2)
    for (const z of [-14.3, 0.2, 14.6]) {
      for (const off of [-4.3, 0, 4.3]) {
        const h = roundWindow('small-round', [-59.91, z + off], [-1, 0], 0.5, 14.4);
        pane(face, h, d, 0.01, 'accent');
        archBand(face, h, d, 0.13, 'trim', 0.06);
      }
      for (let i = -4; i <= 4; i++) {
        if (Math.abs(i) <= 1) continue;
        const zz = z + i * 1.4,
          top = 29.9 - Math.abs(i) * 0.78;
        const h = aperture(
          'gable-blind',
          [-59.92, zz],
          [-1, 0],
          0.86,
          25.2,
          Math.max(0.5, top - 25.2),
          Math.max(0.3, top - 25.6),
          'pointed',
          1,
        );
        pane(face, h, d, 0.02, 'accent');
        archBand(face, h, d, 0.12, 'trim', 0.06);
      }
      for (const s of [-1, 1])
        beam(face, [-60.02, floor + 24, z + s * 7], [-60.02, floor + 30, z], 0.25, 'trim');
    }
  for (const z of [-7.2, 7.6]) {
    solid(face, R(-60.13, z - 0.48, -59.2, z + 0.48), 24, 27, 'trim');
    if (d >= 2) {
      for (const x of [-60.1, -59.35])
        for (const zz of [z - 0.43, z + 0.43])
          solid(face, R(x - 0.09, zz - 0.09, x + 0.09, zz + 0.09), 27, 29.5, 'trim');
    } else {
      solid(face, R(-60.1, z - 0.45, -59.25, z + 0.45), 27, 29.5, 'trim');
    }
    gable(face, R(-60.3, z - 0.64, -59.05, z + 0.64), 29.5, 31, 'trim', 1);
  }
}
function towerBuild(out, face, d) {
  const fields = ferraraBellFields(d),
    towerFace = writer(
      masked(
        out,
        fields.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  sides(face, tower, footing, 32, 'marble');
  if (d === 0) {
    for (const [x, z] of [
      [45.1, 14.5],
      [56.4, 14.5],
      [45.1, 26.6],
      [56.4, 26.6],
    ])
      solid(face, R(x, z, x + 1.5, z + 1.5), 32, 43.5, 'marble');
    solid(face, tower, 43.5, 45, 'marble');
  } else {
    shell(out, d, tower, 32, 45, fields, 'marble', inner);
    cap(face, tower, 45, 'roof');
    for (const h of fields) if (d >= 2) archBand(face, h, d, 0.22, 'trim', 0.08);
  }
  if (d >= 1) {
    for (const y of [10, 21, 32, 44.3]) {
      band(face, tower, y, 0.3, 'trim', 1.03);
      band(face, tower, y + 0.35, 0.25, 'trim', 1.04);
    }
    for (let f = 0; f < 4; f++) {
      const e = faceFrame(tower, f);
      for (const y of [1.6, 12.5, 23.5])
        for (let j = 0; j < 3; j++) {
          const h = aperture(
            'tower-blind',
            lerp(e.a, e.b, 0.5 + ((j - 1) * 3.4) / e.length),
            e.normal,
            2.55,
            y,
            7,
            5.725,
            'round',
            1,
          );
          pane(face, h, d, 0.03, 'accent');
          if (d >= 2) archBand(face, h, d, 0.18, 'trim', 0.09);
        }
    }
    // Low-frequency pink and cream stone stripes share the ashlar graph.
    for (let y = 1; y < 44; y += d >= 2 ? 1.5 : 3) band(towerFace, tower, y, 0.38, 'accent', 1.001);
    if (d >= 2)
      for (let f = 0; f < 4; f++) {
        const e = faceFrame(tower, f);
        for (const t of [0.04, 0.367, 0.633, 0.96]) {
          const p = lerp(e.a, e.b, t);
          solid(face, R(p[0] - 0.16, p[1] - 0.16, p[0] + 0.16, p[1] + 0.16), 0.5, 44.8, 'trim');
        }
      }
  }
}
function build(out, d) {
  out = footprintAware(out);
  const face = writer(out, d),
    fields = ferraraFields(d),
    holes = fields.filter((h) => d >= 2 || h.kind === 'door' || h.shape === 'circle'),
    all = holes.map((h) => prepareOpening(h, 0, d)),
    cut = writer(masked(out, all), d),
    w = (r, b, t, slot = 'wall') => shell(out, d, r, b, t, holes, slot);
  w(main, footing, 21);
  cap(cut, main, 21, 'roof');
  gable(cut, plans.nave, 21, 28, 'roof');
  for (const r of plans.crosses) gable(cut, r, 21, 29, 'roof', 1);
  for (const [i, r] of plans.monitors.entries()) {
    w(r, 21, 29);
    gable(cut, r, 29, i === 1 ? 35 : 34, 'roof', 1);
  }
  w(plans.northAnnex, footing, 21);
  hip(cut, plans.northAnnex, 21, 24, 'roof');
  const apse = rec.main.polygons[0].outline.slice(2, 17);
  w(apse, 21, 26);
  hip(cut, apse, 26, 29, 'roof');
  for (const [i, z] of [
    [0, -14.35],
    [1, 0.2],
    [2, 14.55],
  ]) {
    const r = R(-59.82, z - 7.15, -56.3, z + 7.15);
    w(r, footing, 24, 'marble');
    gable(cut, r, 24, i === 1 ? 30.2 : 30, 'marble', 0);
  }
  const shopFields = [];
  if (d >= 1)
    for (let i = 0; i < (d === 1 ? 10 : 19); i++)
      shopFields.push({
        ...aperture(
          `shop-${i}`,
          [d === 1 ? -54.3 + i * 10.4 : -57 + i * 5.35, 29.25],
          [0, 1],
          d === 1 ? 8.6 : 3.7,
          0.2,
          3.6,
          3.6,
          'rect',
          2,
        ),
        kind: 'door',
      });
  shell(out, d, plans.shops, footing, 5.3, shopFields, 'wall');
  const shopFace = writer(
    masked(
      out,
      shopFields.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  hip(shopFace, plans.shops, 5.3, 8, 'roof');
  if (d >= 1)
    for (const h of shopFields) {
      pane(face, h, d, -0.35, 'glass');
      if (d >= 2) {
        for (const x of [h.center[0] - h.width / 2, h.center[0] + h.width / 2])
          solid(face, R(x - 0.1, 28.9, x + 0.1, 29.37), 0.1, 4.1, 'trim');
        solid(face, R(h.center[0] - 2, 29.2, h.center[0] + 2, 29.48), 3.8, 4.05, 'trim');
      }
    }
  // The central portal sits behind a genuinely open, two-stage projecting protyrus.
  if (d === 0) {
    for (const z of [-3.65, 3.15])
      solid(face, R(-62.1, z, -58.85, z + 0.9), footing, 18.2, 'marble');
    solid(face, portal, 9.8, 12.2, 'marble');
    solid(face, portal, 16.5, 18.2, 'marble');
  } else {
    shell(out, d, portal, footing, 12, lowerPorch, 'marble', portalInner);
    cap(face, portal, 12, 'marble');
    shell(out, d, portal, 12.2, 18.2, upperPorch, 'marble', portalInner);
    cap(face, portal, 18.2, 'marble');
    for (const h of [...lowerPorch, ...upperPorch])
      if (d >= 2) archBand(face, h, d, 0.2, 'trim', 0.1);
  }
  gable(face, portal, 18.2, 21.3, 'marble', 0);
  if (d >= 1) {
    for (const h of fields) panel(face, h, d);
    frontDetails(face, d);
  }
  if (d >= 2) {
    for (const s of [-1, 1]) arcade(face, d, s);
    for (const y of [1, 4.1, 7.2])
      solid(face, R(-60.01, -21.5, -59.83, 21.5), y, y + 0.15, 'accent');
    for (const r of plans.monitors) {
      const f = edge(r, [0, 1]);
      for (const p of [f.a, f.b])
        solid(face, R(p[0] - 0.22, p[1] - 0.25, p[0] + 0.22, p[1] + 0.25), 21, 29.4, 'trim');
    }
    for (let i = 0; i < 9; i++) {
      const z = -3.2 + i * 0.85;
      solid(face, R(-62.18, z - 0.065, -61.98, z + 0.065), 12.1, 13, 'trim');
    }
    beam(face, [-62.2, floor + 13, -3.4], [-62.2, floor + 13, 3.9], 0.14, 'trim');
  }
  towerBuild(out, face, d);
}
export const buildFerraraCathedralSkyline = (o) => build(o, 0),
  buildFerraraCathedralDistrict = (o) => build(o, 1),
  buildFerraraCathedralStreet = (o) => build(o, 2),
  buildFerraraCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const ferraraCathedralStudy = {
  id: 'ferrara_cathedral',
  key: 'ferrara_cathedral',
  title: 'Ferrara Cathedral',
  category: 'cathedral',
  wikidataId: 'Q671933',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID whole,13 nested parts,separate southeast campanile and western shop;16 controls/all124 current raw points and earlier whole outline retained.',
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
    'Five existing cached256-square brick,ashlar,continuous limestone,ceramic tile and plain wood graphs serve seven merged groups.Linear tints,metric UVs,flat architectural normals.No embedded images,reference-photo textures,unique facade maps or baked lighting.',
  importReason:
    'Retain triple-peaked arcaded facade/roses,deep two-level protyrus,three raised cross roofs,round eastern apse,long shop row and striped45m southeast campanile in four browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two actually inspected western and southern2024/2009 photographs and standard viewer PMTiles/DEM only.Fine sculpture,saints/lions,relief panels,tracery lobes,inscriptions,shop branding,hidden roof partitions,full interiors/bells and engineering are approximate or excluded.Tower top partly cropped in side reference;flat completion follows the visible unfinished square stage.Temporary works omitted.Current finish and exact host-ground joins unverified.Physical laptop/phone timing pending.',
    'Skyline retains triple-gable front,projecting porch,tower air/flat cap,long shop/brick body,raised transverse roofs and round apse.District adds shared surfaces,selected galleries/doors and tower-stage rhythm.Street adds fuller arcades,recessed glazing/doors,actual open protyrus and triple belfry apertures.Closeup/master refine nested surrounds,slender columns and gable arcade rhythm.Regional neighbors are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('triple-gable-west-front', [-112, 29, 1], [-59, 17, 0.2]),
    cam('projecting-two-stage-protyrus', [-87, 15, 18], [-60, 10, 0.2]),
    cam('striped-renaissance-campanile', [88, 42, 63], [51, 27, 21]),
    cam('long-south-shop-and-arcade', [-8, 26, 91], [-4, 13, 23]),
    cam('eastern-round-apse-and-cross-roofs', [102, 49, -48], [33, 23, 0]),
    cam('roof-and-signed-plan', [0, 200, 1], [0, 22, 0]),
  ],
};

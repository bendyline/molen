/** Kocatepe: mapped dome, four minarets, courtyard and raised platform with open road tunnel. */
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
  '../../../content/worldgen/source/places/sx/sxp/kocatepe_mosque/',
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
  paving: '#999d98',
  wall: '#d4d2c6',
  trim: '#e4e0d4',
  roof: '#7c8991',
  door: '#987351',
  gold: '#bca56b',
  glass: '#566b7d',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, kocatepeGround(...p) - 0.35);
export function kocatepeGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Kocatepe footing outside retained terrain');
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
const plans = rec.plans;
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    });
const edges = (ring) =>
  ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(ring), -axis[0] * sign(ring)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
const hole = (
  name,
  center,
  axis,
  normal,
  width,
  bottom,
  height,
  spring,
  shape = 'pointed',
  depth = 2,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
const capDome = (face, p, r, base, height, d, small = false) => {
  const n = small ? [4, 6, 10, 14, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + height * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
};
function finial(face, p, y, d) {
  if (d === 0) {
    solid(face, rect(p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08), y, y + 1.5, 'gold');
    return;
  }
  beam(face, at(p, y), at(p, y + 1.5), d === 0 ? 0.16 : 0.12, 'gold');
  if (d >= 3)
    profile(
      face,
      circle(p, 0.24, 6),
      [
        [y + 0.2, 0.65],
        [y + 0.6, 1],
        [y + 1.0, 0.5],
      ],
      'gold',
    );
}
const trimBand = (face, h, d, w = 0.26) => archBand(face, h, d, w, 'trim', 0.055);
const box = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
function underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function band(face, r, y, h, slot = 'trim', f = 1.015) {
  solid(face, scaled(r, f), y, y + h, slot);
}
function openBand(face, a, b, y, h, slot = 'trim', width = 0.18) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [u[1] * width, -u[0] * width];
  solid(
    face,
    [
      a.map((v, k) => v + n[k]),
      b.map((v, k) => v + n[k]),
      b.map((v, k) => v - n[k]),
      a.map((v, k) => v - n[k]),
    ],
    y,
    y + h,
    slot,
  );
}
function column(face, p, b, t, r, d, slot = 'trim') {
  const ring = circle(p, r, d <= 1 ? 4 : d === 2 ? 8 : 12);
  sides(face, ring, b, t, slot);
  cap(face, ring, t, slot);
  if (d >= 3 && t - b > 2) {
    profile(
      face,
      ring,
      [
        [b, 1.5],
        [b + 0.25, 1.5],
        [b + 0.45, 1],
      ],
      slot,
    );
    profile(
      face,
      ring,
      [
        [t - 0.5, 1],
        [t - 0.25, 1.65],
        [t, 1.65],
      ],
      slot,
    );
  }
}
function halfRing(p, r, direction, n) {
  const a = Math.atan2(direction[1], direction[0]);
  return Array.from({ length: n + 1 }, (_, i) => {
    const q = a - Math.PI / 2 + (i * Math.PI) / n;
    return [p[0] + Math.cos(q) * r, p[1] + Math.sin(q) * r];
  });
}
function halfDome(face, p, r, base, rise, d, direction, small = false) {
  const n = small ? [3, 4, 7, 10, 12][d] : [4, 6, 10, 14, 16][d],
    levels = [1, 2, 3, 5, 6][d];
  let previous = halfRing(p, r, direction, n),
    y = base;
  for (let j = 1; j <= levels; j++) {
    const a = (j * Math.PI) / 2 / levels,
      next = halfRing(p, j === levels ? 0 : Math.cos(a) * r, direction, n),
      top = base + Math.sin(a) * rise;
    for (let i = 0; i < n; i++)
      face(
        'roof',
        [at(previous[i], y), at(previous[i + 1], y), at(next[i + 1], top), at(next[i], top)],
        [0, 1, 0],
      );
    previous = next;
    y = top;
  }
}
function tunnelVolumes() {
  const holes = [];
  for (const road of plans.roads)
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1],
        b = road.points[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.1) continue;
      const n = unit(b.map((v, k) => v - a[k])),
        u = [n[1] * 3.7, -n[0] * 3.7],
        start = a.map((v, k) => v - n[k] * 0.5),
        end = b.map((v, k) => v + n[k] * 0.5),
        r = [
          start.map((v, k) => v + u[k]),
          end.map((v, k) => v + u[k]),
          end.map((v, k) => v - u[k]),
          start.map((v, k) => v - u[k]),
        ],
        sg = sign(r),
        y0 = kocatepeGround(...a) + 0.08,
        y1 = kocatepeGround(...b) + 0.08,
        m = (y1 - y0) / len,
        k = y0 - m * (n[0] * a[0] + n[1] * a[1]);
      const planes = r.map((p, j) => {
        const q = r[(j + 1) % r.length],
          dx = q[0] - p[0],
          dz = q[1] - p[1];
        return [-dz * sg, 0, dx * sg, (dz * p[0] - dx * p[1]) * sg];
      });
      planes.push([-m * n[0], 1, -m * n[1], -k + 0.35], [m * n[0], -1, m * n[1], k + 4.8]);
      holes.push({
        planes,
        bounds: [
          [Math.min(...r.map((p) => p[0])), Math.max(...r.map((p) => p[0]))],
          [Math.min(y0, y1) - 0.4, Math.max(y0, y1) + 4.9],
          [Math.min(...r.map((p) => p[1])), Math.max(...r.map((p) => p[1]))],
        ],
      });
    }
  return holes;
}
function platform(out, face, d) {
  const skin = writer(masked(out, tunnelVolumes()), d);
  sides(skin, plans.platform.outline, footing, 0.08, 'wall');
  cap(face, plans.platform.outline, 0.08, 'trim');
  const floorAt = (p) => kocatepeGround(...p) + 0.08,
    ceilingAt = (p) => floorAt(p) + 4.8;
  function boundary(p) {
    return plans.platform.outline.some((a, i) => {
      const b = plans.platform.outline[(i + 1) % plans.platform.outline.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)),
        );
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < 0.06;
    });
  }
  for (const polygon of plans.tunnelPolygons) {
    cap(face, polygon.outline, floorAt, 'paving', polygon.holes);
    underside(face, polygon.outline, ceilingAt, 'wall', polygon.holes);
    for (const e of edges(polygon.outline))
      if (!boundary(lerp(e.a, e.b, 0.5)))
        face(
          'wall',
          [at(e.a, floorAt), at(e.b, floorAt), at(e.b, ceilingAt), at(e.a, ceilingAt)],
          [-e.normal[0], 0, -e.normal[1]],
        );
  }
  if (d >= 2)
    for (const e of edges(plans.platform.outline))
      if (e.length > 8) {
        // Low terrace coping leaves road portals clear below the platform.
        openBand(face, e.a, e.b, 0.65, 0.2, 'trim', 0.18);
        const n = Math.max(1, Math.round(e.length / (d >= 3 ? 5 : 12)));
        if (d >= 2)
          for (let i = 0; i <= n; i++) column(face, lerp(e.a, e.b, i / n), 0.08, 0.85, 0.2, 1);
      }
}
export function kocatepeHallFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const [ei, e] of edges(plans.hall).entries()) {
    const n = d === 1 ? 3 : Math.round(e.length / (d === 2 ? 8.0 : 6.1));
    for (let i = 0; i < n; i++)
      for (const y of d <= 2 ? [8.0] : [2.0, 8.2]) {
        const p = lerp(e.a, e.b, (i + 0.5) / n);
        if (e.normal[1] > 0.8 && p[0] > 6 && p[0] < 37) continue;
        fields.push(
          hole(
            `hall-${ei}-${i}-${y}`,
            p,
            e.axis,
            e.normal,
            d === 1 ? 1.9 : 1.6,
            y,
            3.6,
            2.5,
            'pointed',
            2.0,
          ),
        );
      }
  }
  fields.push({
    ...hole('court-prayer-door', [-4.1, 0], [0, 1], [-1, 0], 4.2, 0.45, 6.7, 4.5, 'pointed', 2.5),
    kind: 'door',
  });
  for (const x of [1.0, 39.7])
    fields.push({
      ...hole(`side-door-${x}`, [x, 26.35], [1, 0], [0, 1], 3.5, 0.7, 5.5, 3.7, 'pointed', 2.6),
      kind: 'door',
    });
  return fields;
}
const finish = (face, fields, d) => {
  for (const h of fields) {
    pane(face, h, d, -0.2, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) trimBand(face, h, 1, 0.16);
  }
};
export function kocatepeDrumFields(d = 3) {
  if (d === 0) return [];
  const r = circle(plans.dome.center, plans.dome.radius, [8, 12, 20, 28, 32][d]);
  return edges(r)
    .filter((_, i) => (d <= 2 ? i % 2 === 0 : true))
    .map((e, i) =>
      hole(
        `main-drum-${i}`,
        lerp(e.a, e.b, 0.5),
        e.axis,
        e.normal,
        d === 1 ? 1.6 : 1.05,
        32.5,
        3.3,
        2.3,
        'pointed',
        2,
      ),
    );
}
function hall(out, face, d) {
  const fields = kocatepeHallFields(d);
  shell(out, d, plans.hall, 0.2, 15.0, d === 1 ? [] : fields, 'wall');
  cap(face, plans.hall, 15, 'roof');
  if (d === 1)
    for (const h of fields) pane(face, h, 1, 0.035, h.kind === 'door' ? 'door' : 'glass');
  else finish(face, fields, d);
  const p = plans.dome.center,
    radius = plans.dome.radius;
  solid(face, rect(p[0] - 10.8, p[1] - 10.8, p[0] + 10.8, p[1] + 10.8), 15, 32.0, 'wall');
  const drum = circle(p, radius, [8, 12, 20, 28, 32][d]),
    windows = kocatepeDrumFields(d);
  shell(out, d, drum, 31.5, 37, d === 1 ? [] : windows, 'wall');
  if (d === 1) for (const h of windows) pane(face, h, 1, 0.035);
  else finish(face, windows, d);
  capDome(face, p, radius + 0.2, 37, 11.5, d);
  finial(face, p, 48.5, d);
  for (const dir of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ])
    for (const [distance, r, base, rise, lo, small] of [
      [9.5, 11.8, 26, 10, 15, false],
      [18.3, 7.3, 18.2, 7.1, 14.8, true],
    ]) {
      const q = p.map((v, k) => v + dir[k] * distance),
        n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : 12,
        ring = halfRing(q, r, dir, n),
        fields = [];
      if (d >= 1)
        for (const [i, e] of edges(ring).entries()) {
          if (i === ring.length - 1 || (d <= 2 && i % 2)) continue;
          fields.push(
            hole(
              `semi-${distance}-${dir}-${i}`,
              lerp(e.a, e.b, 0.5),
              e.axis,
              e.normal,
              d === 1 ? 1.1 : 1.0,
              base - 4,
              2.7,
              1.9,
              'pointed',
              2,
            ),
          );
        }
      shell(out, d, ring, lo, base, d === 1 || small ? [] : fields, 'wall');
      if (d === 1 || small) for (const h of fields) pane(face, h, Math.min(d, 2), 0.035);
      else if (d === 2) for (const h of fields) pane(face, h, 1, -0.2);
      else finish(face, fields, d);
      halfDome(face, q, r + 0.15, base, rise, d, dir, small);
    }
  if (d >= 1)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const q = [p[0] + sx * 16.7, p[1] + sz * 17.0],
          r = circle(q, 5.4, d <= 1 ? 6 : 12);
        solid(face, r, 15, 20.7, 'wall');
        capDome(face, q, 5.7, 20.7, 3.8, d, true);
        if (d >= 1) finial(face, q, 24.5, d);
        if (d >= 2) {
          const t = [p[0] + sx * 13.7, p[1] + sz * 13.7],
            r2 = circle(t, 1.8, 8);
          solid(face, r2, 15, 30, 'wall');
          capDome(face, t, 2.0, 30, 1.8, d, true);
          finial(face, t, 31.8, d);
        }
      }
  if (d >= 1) {
    band(face, plans.hall, 14.6, 0.4, 'trim', 1.004);
    band(face, drum, 36.5, 0.45, 'trim', 1.015);
  }
  for (const x of [1.0, 39.7]) {
    const h = {
        ...hole(
          `raised-side-entry-${x}`,
          [x, 26.75],
          [1, 0],
          [0, 1],
          3.5,
          0.7,
          5.5,
          3.7,
          'pointed',
          3.4,
        ),
        kind: 'door',
      },
      r = rect(x - 3.0, 25.8, x + 3.0, 27.3);
    shell(out, d, r, 0.2, 8.6, d === 0 ? [] : [h], 'trim');
    pane(face, h, d, d === 0 ? 0.6 : -0.6, 'door');
    if (d >= 1) trimBand(face, h, d, 0.28);
    if (d >= 1)
      for (let j = 0; j < 5; j++)
        solid(
          face,
          rect(x - 3.4, 27.3 + j * 0.55, x + 3.4, 27.9 + j * 0.55),
          0.08,
          0.7 - j * 0.12,
          'trim',
        );
  }
}
function minarets(face, d) {
  for (const tower of plans.minarets) {
    const p = tower.center,
      n = [4, 6, 12, 16, 20][d],
      base = circle(p, 2.95, d === 0 ? 4 : 8),
      shaft = circle(p, 1.55, n);
    profile(
      face,
      base,
      [
        [0.1, 1],
        [8.8, 1],
        [12.5, 0.55],
      ],
      'wall',
    );
    sides(face, shaft, 12.5, 75.8, 'wall');
    cap(face, shaft, 75.8, 'wall');
    for (const y of [39, 53, 66]) {
      const r = circle(p, 2.7, d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : 12);
      if (d === 0) {
        cap(face, r, y + 0.45, 'trim');
        underside(face, r, y + 0.45, 'trim');
      } else {
        profile(
          face,
          shaft,
          d === 1
            ? [
                [y - 1.9, 1],
                [y, 1.75],
              ]
            : [
                [y - 1.9, 1],
                [y - 1.3, 1.25],
                [y - 0.65, 1.5],
                [y, 1.75],
              ],
          'trim',
        );
        cap(face, r, y, 'trim');
        if (d === 1) sides(face, r, y, y + 0.95, 'trim');
        else {
          for (const q of r) column(face, q, y, y + 0.95, 0.085, 1);
          for (const e of edges(r)) openBand(face, e.a, e.b, y + 0.82, 0.14, 'trim', 0.09);
        }
      }
    }
    profile(
      face,
      circle(p, 1.7, n),
      [
        [75.8, 1],
        [76.5, 1],
        [88, 0],
      ],
      'roof',
    );
    if (d === 0) solid(face, circle(p, 0.1, 3), 88, 88.9, 'gold');
    else column(face, p, 88, 88.9, 0.1, 1, 'gold');
  }
}
export function kocatepeCourtArches(d = 3) {
  const fields = [];
  for (const [ei, e] of edges(plans.court).entries()) {
    const n =
      d === 0
        ? Math.max(2, Math.round(e.length / 15))
        : d === 1
          ? Math.max(3, Math.round(e.length / 12))
          : Math.round(e.length / 5.3);
    for (let i = 0; i < n; i++)
      fields.push(
        hole(
          `court-${ei}-${i}`,
          lerp(e.a, e.b, (i + 0.5) / n),
          e.axis,
          e.normal.map((v) => -v),
          e.length / n - (d === 0 ? 0.8 : 0.65),
          0.22,
          8.6,
          6.0,
          d === 0 ? 'rect' : 'pointed',
          2.2,
        ),
      );
  }
  return fields;
}
function courtyard(out, face, d) {
  const outer = plans.courtOuter,
    inner = scaled(outer, 0.97),
    b = box(outer),
    c = box(plans.court);
  const gates = [
    hole(
      'court-axial-gate',
      [-48.54, 0],
      [0, 1],
      [-1, 0],
      4.4,
      0.1,
      6.7,
      4.6,
      d === 0 ? 'rect' : 'pointed',
      3,
    ),
    hole(
      'court-side-gate-north',
      [-26.7, -30.98],
      [1, 0],
      [0, -1],
      3.9,
      0.1,
      5.9,
      4.2,
      d === 0 ? 'rect' : 'pointed',
      3,
    ),
    hole(
      'court-side-gate-south',
      [-26.7, 30.86],
      [1, 0],
      [0, 1],
      3.9,
      0.1,
      5.9,
      4.2,
      d === 0 ? 'rect' : 'pointed',
      3,
    ),
    hole(
      'court-prayer-porch',
      [-4, 0],
      [0, 1],
      [1, 0],
      4.2,
      0.2,
      6.7,
      4.5,
      d === 0 ? 'rect' : 'pointed',
      3,
    ),
  ];
  if (d === 0)
    sides(
      writer(
        masked(
          out,
          gates.map((h) => prepareOpening(h, 0, 0)),
        ),
        0,
      ),
      outer,
      0.1,
      10.2,
      'wall',
    );
  else shell(out, d, outer, 0.1, 10.2, gates, 'wall', inner);
  cap(face, outer, 10.3, 'roof', [plans.court]);
  underside(face, outer, 9.8, 'trim', [plans.court]);
  const arches = kocatepeCourtArches(d);
  for (const e of edges(plans.court)) {
    const n = [e.normal[0] * 0.4, e.normal[1] * 0.4],
      r = [
        e.a.map((v, k) => v + n[k]),
        e.b.map((v, k) => v + n[k]),
        e.b.map((v, k) => v - n[k]),
        e.a.map((v, k) => v - n[k]),
      ];
    const hs = arches.filter(
      (h) =>
        Math.abs((h.center[0] - e.a[0]) * e.normal[0] + (h.center[1] - e.a[1]) * e.normal[1]) <
        0.01,
    );
    if (d === 0) {
      openBand(face, e.a, e.b, 6.1, 4.0, 'trim', 0.4);
      for (let i = 0; i < hs.length; i++) {
        const p = lerp(e.a, e.b, i / hs.length);
        solid(face, rect(p[0] - 0.4, p[1] - 0.4, p[0] + 0.4, p[1] + 0.4), 0.1, 6.1, 'trim');
      }
    } else shell(out, d, r, 0.1, 10.1, hs, 'trim');
    if (d >= 2) for (const h of hs) trimBand(face, h, 1, 0.16);
    if (d >= 2) {
      const num = hs.length;
      for (let i = 0; i <= num; i++) column(face, lerp(e.a, e.b, i / num), 0.1, 6.1, 0.28, d);
    }
  }
  if (d >= 1) {
    const rows = [
      [
        [b[0][0] + c[0][0], b[1][0] + c[1][0]],
        [b[0][0] + c[0][0], b[1][1] + c[1][1]],
      ],
      [
        [b[0][1] + c[0][1], b[1][0] + c[1][0]],
        [b[0][1] + c[0][1], b[1][1] + c[1][1]],
      ],
      [
        [b[0][0] + c[0][0], b[1][0] + c[1][0]],
        [b[0][1] + c[0][1], b[1][0] + c[1][0]],
      ],
      [
        [b[0][0] + c[0][0], b[1][1] + c[1][1]],
        [b[0][1] + c[0][1], b[1][1] + c[1][1]],
      ],
    ];
    for (const pair of rows) {
      const a = pair[0].map((v) => v / 2),
        z = pair[1].map((v) => v / 2),
        length = Math.hypot(z[0] - a[0], z[1] - a[1]),
        n = Math.round(length / 6);
      for (let i = 0; i < n; i++)
        capDome(face, lerp(a, z, (i + 0.5) / n), 3.2, 10.3, 1.8, d === 1 ? 0 : d, true);
    }
  }
  const basin = plans.courtBasin;
  profile(
    face,
    circle(basin.center, basin.radius, d === 0 ? 6 : d === 1 ? 8 : 16),
    [
      [0.08, 1],
      [0.5, 1],
      [0.5, 0.86],
    ],
    'trim',
  );
  capDome(face, basin.center, basin.radius * 0.7, 0.5, 1.3, d, true);
  if (d >= 3)
    for (const a of [0, Math.PI / 3, (Math.PI * 2) / 3]) {
      const q = [Math.cos(a), Math.sin(a)];
      beam(
        face,
        at(
          basin.center.map((v, k) => v - q[k] * 1.7),
          0.7,
        ),
        at(
          basin.center.map((v, k) => v + q[k] * 1.7),
          0.7,
        ),
        0.1,
        'trim',
      );
    }
}
export function kocatepeLoggiaFields(d = 3) {
  const n = d <= 1 ? 3 : 7,
    hs = [];
  for (let i = 0; i < n; i++)
    hs.push(
      hole(
        `loggia-${i}`,
        [7 + ((i + 0.5) * 28) / n, 31.2],
        [1, 0],
        [0, 1],
        28 / n - 0.65,
        0.25,
        5.3,
        3.6,
        d === 0 ? 'rect' : 'pointed',
        2.0,
      ),
    );
  return hs;
}
function sideLoggia(out, face, d) {
  const outer = rect(7, 26.1, 35, 31.8),
    inner = rect(7.6, 26.5, 34.4, 30.6),
    arches = kocatepeLoggiaFields(d);
  if (d === 0) {
    for (let i = 0; i <= 3; i++) {
      const x = 7 + (i * 28) / 3;
      solid(face, rect(x - 0.4, 30.8, x + 0.4, 31.6), 0.1, 6.2, 'trim');
    }
  } else shell(out, d, outer, 0.1, 6.2, arches, 'trim', inner);
  cap(face, outer, 6.2, 'trim');
  const fields =
    d === 0
      ? []
      : Array.from({ length: d === 1 ? 5 : 9 }, (_, i) =>
          hole(
            `upper-loggia-${i}`,
            [7.7 + ((i + 0.5) * 26.6) / (d === 1 ? 5 : 9), 31.8],
            [1, 0],
            [0, 1],
            1.8,
            7.0,
            3.2,
            3.2,
            'rect',
            1.8,
          ),
        );
  shell(out, d, outer, 6.2, 11.3, d === 1 ? [] : fields, 'wall');
  if (d === 1) for (const h of fields) pane(face, h, 1, 0.035);
  else finish(face, fields, d);
  const roof = rect(6.2, 25.8, 35.8, 33.0);
  cap(face, roof, 11.7, 'roof');
  underside(face, roof, 11.55, 'trim');
  if (d >= 2) for (let i = 0; i <= 7; i++) column(face, [7 + i * 4, 31.2], 0.1, 3.6, 0.28, d);
}
function annex(face, d) {
  const r = plans.annex.outline,
    p = plans.annex.center;
  solid(face, r, 0.1, 3.4, 'wall');
  const rings = [r, scaled(r, 0.1)];
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(
      'roof',
      [at(r[i], 3.4), at(r[j], 3.4), at(rings[1][j], 6.2), at(rings[1][i], 6.2)],
      [0, 1, 0],
    );
  }
  cap(face, rings[1], 6.2, 'roof');
  if (d >= 2) finial(face, p, 6.2, d);
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let length = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const v = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (v > length) {
              length = v;
              k = i;
            }
          }
          if (d > 0 && length > (d === 1 ? 55 : 30)) {
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
  platform(out, face, d);
  hall(out, face, d);
  courtyard(out, face, d);
  minarets(face, d);
  sideLoggia(out, face, d);
  annex(face, d);
}
export const buildKocatepeSkyline = (o) => build(o, 0),
  buildKocatepeDistrict = (o) => build(o, 1),
  buildKocatepeStreet = (o) => build(o, 2),
  buildKocatepeCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const kocatepeStudy = {
  id: 'kocatepe_mosque',
  key: 'kocatepe_mosque',
  title: 'Kocatepe Mosque',
  category: 'mosque',
  wikidataId: 'Q853935',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared256² limestone,continuous limestone,standing-seam metal,plain wood,cast bronze and plain concrete graphs;seven merged roles including local opaque glazing. Metric UVs,linear tints,faceted architecture;zero embedded images,unique atlases,copied calligraphy or baked lighting.',
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
    'Current raw whole,court,dome,minaret,platform and tagged tunnel geometries are retained separately from estimated reconstruction. Most height/room/roof partitions,bay counts,window patterns,side stairs,basin lattice,annex function and exact tunnel width/clearance are picture/layout estimates. Fine inscriptions,ornament,temporary construction framing,basement shops and unseen interiors are omitted. Original anchor/heading and map scale retained;exact ground/road/step joins,current finish,engineering and physical-device timings remain unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('dome-cascade-and-four-minarets', [-110, 83, 132], [15, 36, 0]),
    cam('open-courtyard-arcades', [-54, 24, 44], [-25, 6, 0]),
    cam('public-side-loggia-and-doors', [10, 14, 73], [20, 7, 25]),
    cam('three-balcony-minarets', [78, 64, 76], [25, 50, 0]),
    cam('raised-platform-and-tunnel', [-98, 2, 55], [-60, -3, 43]),
    cam('north-up-roof-and-platform', [5, 390, 25.1], [5, 6, 25]),
  ],
};

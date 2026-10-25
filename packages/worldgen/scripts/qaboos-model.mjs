/** Sultan Qaboos Grand Mosque: lattice dome, five mapped minarets and open courtyard colonnades. */
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
  '../../../content/worldgen/source/places/tk/tk1/sultan_qaboos_grand_mosque/',
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
  wall: '#ddd6c4',
  trim: '#e3dcc9',
  roof: '#c7c2b5',
  paving: '#c9c9bf',
  gold: '#bea16b',
  wood: '#9c825e',
  glass: '#52666c',
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
const _lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
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
const footing = (p) => Math.min(-0.35, floor - 0.3, qaboosGround(...p) - 0.35);
export function qaboosGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Qaboos footing outside retained terrain');
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
    if (h.name.startsWith('court-') && (i === 0 || i === 1 || i === inner.length - 1)) continue;
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
function _beam(face, a, b, w, slot = 'trim') {
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
const _edges = (ring) =>
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
export function qaboosInside(p, r) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function down(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function slab(face, r, y, h, slot) {
  sides(face, r, y, y + h, slot);
  cap(face, r, y + h, slot);
  down(face, r, y, slot);
}
export function qaboosFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [i, e] of _edges(plans.main.outline).entries()) {
    if (e.length < 12) continue;
    const n = Math.max(1, Math.floor(e.length / (d === 1 ? 21 : d === 2 ? 12 : 8))),
      step = e.length / n;
    for (let j = 0; j < n; j++) {
      const p = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n),
        h = hole(
          `main-${i}-${j}`,
          p,
          e.axis,
          e.normal,
          Math.min(3.2, step * 0.45),
          5.7,
          8.8,
          5.8,
          'pointed',
          2.4,
        );
      hs.push(h);
    }
  }
  return hs;
}
function fields(face, hs, d) {
  for (const h of hs) {
    pane(face, h, d, d === 1 ? 0.045 : -0.9, 'glass');
    if (d >= 2) archBand(face, h, d, 0.5, 'trim', 0.08);
  }
}
export function qaboosArcades(d = 3) {
  const result = [];
  if (d === 0) return result;
  for (const r of plans.ranges) {
    const es = _edges(r.outline).sort((a, b) => b.length - a.length),
      e = es[0],
      n = Math.max(1, Math.floor(e.length / (d === 1 ? 24 : d === 2 ? 9 : 6))),
      step = e.length / n;
    // Each range uses its actual long edge. The arch ribbon lies on its centerline.
    for (let j = 0; j < n; j++) {
      const center = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n - e.normal[k] * 3),
        column = e.a.map((v, k) => v + ((e.b[k] - v) * j) / n - e.normal[k] * 3);
      result.push({
        range: r.id,
        span: step,
        center,
        column,
        axis: e.axis,
        normal: e.normal,
        index: j,
        count: n,
      });
    }
  }
  return result;
}
function spandrel(face, bay, d, top = 7.2, spring = 4.2, peak = 6.6, slot = 'trim') {
  const { span, center: p, axis, normal } = bay,
    w = span / 2,
    shape = openingShape(
      {
        width: span - 0.8,
        bottom: 0.7,
        height: peak - 0.7,
        spring: spring - 0.7,
        shape: 'pointed',
      },
      d,
    ).slice(2),
    ring = [[-w, spring], [-w, top], [w, top], [w, spring], ...shape],
    ids = earcut(ring.flat(), [], 2),
    P = ([x, y], v) => [
      p[0] + axis[0] * x + normal[0] * v,
      floor + y,
      p[1] + axis[1] * x + normal[1] * v,
    ];
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => ring[k]);
    face(
      slot,
      q.map((q) => P(q, -0.4)),
      [-normal[0], 0, -normal[1]],
    );
    face(
      slot,
      q.map((q) => P(q, 0.4)),
      [normal[0], 0, normal[1]],
    );
  }
  const sg = Math.sign(
    ring.reduce((n, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    face(
      slot,
      [P(a, -0.4), P(b, -0.4), P(b, 0.4), P(a, 0.4)],
      [axis[0] * dy * sg, -dx * sg, axis[1] * dy * sg],
    );
  }
}
function column(face, p, d, b = 0.7, t = 4.2, r = 0.42) {
  solid(face, circle(p, r, d <= 1 ? 4 : d === 2 ? 6 : 8), b, t, 'trim');
  if (d >= 2) {
    solid(face, rect(p[0] - 0.65, p[1] - 0.65, p[0] + 0.65, p[1] + 0.65), b, b + 0.25, 'trim');
    solid(face, rect(p[0] - 0.65, p[1] - 0.65, p[0] + 0.65, p[1] + 0.65), t - 0.35, t, 'trim');
  }
}
function arcades(face, d) {
  for (const r of plans.ranges) {
    slab(face, r.outline, 6.8, 0.4, 'roof');
    if (d === 0) {
      const e = _edges(r.outline).sort((a, b) => b.length - a.length)[0];
      for (const p of [e.a, e.b]) column(face, p, 0, 0.7, 6.8, 0.8);
    }
  }
  for (const b of qaboosArcades(d)) {
    spandrel(face, b, d);
    column(face, b.column, d);
    if (b.index === b.count - 1)
      column(
        face,
        b.column.map((v, k) => v + b.axis[k] * b.span),
        d,
      );
  }
}
export function qaboosGates() {
  return plans.gates.map((g) => {
    const e = _edges(g.outline).sort((a, b) => b.length - a.length)[0],
      center = e.a.map((v, k) => (v + e.b[k]) / 2 - e.normal[k] * 2.7);
    return { range: g.id, span: e.length, center, axis: e.axis, normal: e.normal };
  });
}
function gates(face, d) {
  for (const g of qaboosGates()) {
    spandrel(face, g, d, 13.5, 7.5, 12.1, 'trim');
    for (const v of [-1, 1]) {
      const p = g.center.map((x, k) => x + g.axis[k] * v * (g.span / 2 - 0.55));
      column(face, p, d, 0.7, 7.5, 0.65);
    }
    const p = plans.gates.find((r) => r.id === g.range);
    slab(face, p.outline, 13.5, 0.3, 'trim');
  }
}
function ribbon(face, a, b, w, slot, p) {
  const axis = unit(b.map((v, k) => v - a[k])),
    normal = unit([
      (a[0] + b[0]) / 2 - p[0],
      (a[1] + b[1]) / 2 - floor - 20,
      (a[2] + b[2]) / 2 - p[1],
    ]),
    u = unit(cross(axis, normal)),
    q = (v, s) => v.map((x, k) => x + (u[k] * s * w) / 2);
  face(slot, [q(a, -1), q(b, -1), q(b, 1), q(a, 1)], normal);
}
function dome(face, d) {
  const p = plans.domeCenter,
    r = 14.2,
    n = [8, 12, 20, 28, 32][d],
    m = [2, 3, 5, 7, 8][d],
    levels = Array.from({ length: m + 1 }, (_, i) => {
      const a = ((i / m) * Math.PI) / 2;
      return [20 + r * Math.sin(a), i === m ? 0 : Math.cos(a)];
    });
  profile(face, circle(p, r, n), levels, 'gold');
  if (d > 0) {
    // Match the shell's facets so straight lattice ribbons stay above each face.
    const count = n,
      bands = m,
      R = r + 0.18,
      P = (a, t) => [
        p[0] + R * Math.cos(t) * Math.cos(a),
        floor + 20 + R * Math.sin(t),
        p[1] + R * Math.cos(t) * Math.sin(a),
      ];
    for (let j = 0; j < count; j++)
      for (let i = 0; i < bands; i++) {
        const a = (j * Math.PI * 2) / count,
          b = ((j + 1) * Math.PI * 2) / count,
          t = ((i / bands) * Math.PI) / 2,
          u = (((i + 1) / bands) * Math.PI) / 2;
        ribbon(face, P(a, t), P(a, u), d === 1 ? 0.3 : 0.24, 'trim', p);
        ribbon(face, P(a, t), P(b, u), d === 1 ? 0.28 : 0.19, 'trim', p);
        ribbon(face, P(b, t), P(a, u), d === 1 ? 0.28 : 0.19, 'trim', p);
      }
  }
  profile(
    face,
    circle(p, d === 0 ? 0.2 : 0.14, d === 0 ? 4 : 8),
    [
      [34.2, 1],
      [37, 0],
    ],
    'gold',
  );
}
function minaret(face, q, d) {
  const p = q.center,
    h = q.height,
    box = q.plan.outline,
    rad =
      Math.min(
        ...[0, 1].map((k) => Math.max(...box.map((p) => p[k])) - Math.min(...box.map((p) => p[k]))),
      ) * 0.47,
    n = [4, 6, 8, 12, 16][d];
  solid(face, box, 0.7, h * 0.12, 'wall');
  const ls =
    d === 0
      ? [
          [0.12, 1],
          [0.42, 0.88],
          [0.43, 1.15],
          [0.45, 0.8],
          [0.82, 0.9],
          [0.84, 0.4],
          [0.995, 0],
        ]
      : d === 1
        ? [
            [0.12, 1],
            [0.42, 0.88],
            [0.43, 1.15],
            [0.45, 0.8],
            [0.8, 0.65],
            [0.82, 0.9],
            [0.84, 0.4],
            [0.97, 0.35],
            [0.995, 0],
          ]
        : [
            [0.12, 1],
            [0.4, 0.9],
            [0.42, 0.9],
            [0.43, 1.15],
            [0.45, 1.15],
            [0.45, 0.8],
            [0.63, 0.75],
            [0.65, 1],
            [0.67, 1],
            [0.67, 0.62],
            [0.81, 0.6],
            [0.83, 0.82],
            [0.85, 0.82],
            [0.85, 0.42],
            [0.95, 0.4],
            [0.995, 0],
          ];
  profile(
    face,
    circle(p, rad, n),
    ls.map(([y, r]) => [h * y, r]),
    'wall',
  );
  profile(
    face,
    circle(p, d === 0 ? 0.16 : 0.1, d === 0 ? 4 : 8),
    [
      [h * 0.995, 1],
      [h, 0],
    ],
    'gold',
  );
  if (d > 0) {
    for (const [lo, hi, r] of d === 1
      ? [[0.48, 0.7, 0.77]]
      : [
          [0.18, 0.38, 0.95],
          [0.48, 0.6, 0.78],
          [0.69, 0.79, 0.62],
          [0.87, 0.94, 0.42],
        ])
      for (let i = 0; i < (d === 1 ? 4 : 8); i++) {
        const a = (i * Math.PI * 2) / (d === 1 ? 4 : 8),
          normal = [Math.cos(a), Math.sin(a)],
          axis = [-normal[1], normal[0]],
          P = p.map((v, k) => v + normal[k] * rad * r),
          w = rad * (d === 1 ? 0.45 : 0.33),
          field = hole(
            `tower-${q.id}-${lo}-${i}`,
            P,
            axis,
            normal,
            w,
            h * lo,
            h * (hi - lo),
            h * (hi - lo) * 0.75,
            'pointed',
            1,
          );
        pane(face, field, d, 0.04, 'glass');
        if (d >= 3) archBand(face, field, d, 0.12, 'trim', 0.06);
      }
  }
}
function merlons(face, r, d) {
  if (d < 2) return;
  for (const e of _edges(r)) {
    const n = Math.floor(e.length / (d === 2 ? 8 : 4));
    for (let i = 0; i < n; i++) {
      const p = e.a.map((v, k) => v + ((e.b[k] - v) * (i + 0.5)) / n);
      solid(face, rect(p[0] - 0.5, p[1] - 0.35, p[0] + 0.5, p[1] + 0.35), 20, 20.65, 'trim');
      profile(
        face,
        circle(p, 0.4, d === 2 ? 4 : 6),
        [
          [20.65, 1],
          [21.15, 0],
        ],
        'trim',
      );
    }
  }
}
function innerCourt(face, r, d) {
  sides(face, r, 0.7, 20, 'wall', true);
  if (d > 0)
    for (const [i, e] of _edges(r).entries()) {
      if (e.length < 10) continue;
      const n = d === 1 ? 1 : Math.floor(e.length / 8);
      for (let j = 0; j < n; j++) {
        const p = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n),
          h = hole(
            `inner-court-${i}-${j}`,
            p,
            e.axis,
            e.normal.map((v) => -v),
            3.6,
            5.7,
            8.8,
            5.8,
            'pointed',
            1,
          );
        pane(face, h, d, 0.04, 'glass');
        if (d >= 2) archBand(face, h, d, 0.45, 'trim', 0.06);
      }
      if (e.normal[0] < -0.8) {
        const p = e.a.map((v, k) => (v + e.b[k]) / 2);
        const door = hole(
          'court-entry',
          p,
          e.axis,
          e.normal.map((v) => -v),
          2.7,
          0.7,
          4,
          2.6,
        );
        pane(face, door, d, 0.05, 'wood');
        if (d >= 2) archBand(face, door, d, 0.25, 'trim', 0.075);
      }
    }
}
function build(out, d) {
  const face = writer(out, d),
    main = plans.main,
    hs = qaboosFields(d);
  sides(face, plans.whole.outline, footing, 0.7, 'paving');
  cap(face, plans.whole.outline, 0.7, 'paving');
  if (d <= 1) sides(face, main.outline, 0.7, 20, 'wall');
  else shell(out, d, main.outline, 0.7, 20, hs, 'wall');
  fields(face, hs, d);
  cap(face, main.outline, 20, 'roof', main.holes);
  down(face, main.outline, 19.5, 'roof', main.holes);
  for (const r of main.holes) innerCourt(face, r, d);
  if (d > 0) {
    sides(face, scaled(main.outline, 1.002), 18.8, 19.3, 'trim');
    for (const r of main.holes) sides(face, r, 18.8, 19.3, 'trim', true);
  }
  merlons(face, main.outline, d);
  for (const r of plans.west) {
    sides(face, r.outline, footing, 0.7, 'paving');
    cap(face, r.outline, 0.7, 'paving');
    sides(face, r.outline, 0.7, 6.5, 'wall');
    cap(face, r.outline, 6.5, 'roof');
  }
  arcades(face, d);
  gates(face, d);
  dome(face, d);
  for (const q of plans.minarets) minaret(face, q, d);
}
export const buildQaboosSkyline = (o) => build(o, 0),
  buildQaboosDistrict = (o) => build(o, 1),
  buildQaboosStreet = (o) => build(o, 2),
  buildQaboosCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const qaboosStudy = {
  id: 'sultan_qaboos_grand_mosque',
  key: 'sultan_qaboos_grand_mosque',
  title: 'Sultan Qaboos Grand Mosque',
  category: 'mosque',
  wikidataId: 'Q1548443',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Reference photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared 256² coursed limestone, raw limestone, membrane, marble, cast bronze and plain wood graphs serve seven merged roles including local opaque blue-grey panes. Metric UVs, linear colors and no embedded images. Dome lattice is coarse original geometry, not a photographed texture or exact faience/carving reproduction.',
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
    'Current named map geometry supports the older reference-only identity. Main and minaret totals are tagged; dome top and profiles, internal levels, colonnades, gate heights, facade rhythm, merlons and lattice pattern are estimates. The central podium is an approximate rectangle from corner tower limits, not an exact paved or garden survey. Western auxiliary controls retain thin raw outlines. Two main roof courts stay open. Fine inscriptions/carvings, exact geometric art, ornamented paving, fixtures, trees, visitor entrance/shop and furnished interiors omitted. No collision-certified interior or physical-device timing claim.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('cream-lattice-over-warm-dome', [-20, 45, 55], [-68, 29, 11]),
    cam('pointed-prayer-hall-exterior', [-145, 28, 98], [-70, 14, 47]),
    cam('main-tiered-minaret', [27, 80, -112], [-13, 70, -50]),
    cam('south-open-colonnade', [-83, 4, 65], [-83, 5, 79]),
    cam('first-open-court', [-19, 7, 17], [-27, 22, 9]),
    cam('north-up-map-controls', [-25, 420, 0.1], [-25, 9, 13]),
  ],
};

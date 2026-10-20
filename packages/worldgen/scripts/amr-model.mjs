/** Mosque of Amr ibn al-As: mapped open court, pointed colonnades and domed ablution pavilion. */
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
  '../../../content/worldgen/source/places/st/stq/n0462_mosque_of_amr_ibn_al_as/',
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
  wall: '#d6cebc',
  trim: '#ddd3bd',
  roof: '#bcb6a8',
  paving: '#c8c9c0',
  wood: '#9d825e',
  glass: '#58696d',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, amrGround(...p) - 0.35);
export function amrGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Amr footing outside retained terrain');
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
export function amrInside(p, r) {
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
export function amrFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [i, e] of _edges(plans.whole.outline).entries()) {
    const n = Math.floor(e.length / 6.8);
    if (e.length < 8) continue;
    for (let j = 0; j < n; j++) {
      const p = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n);
      if (plans.minarets.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 4)) continue;
      const h = hole(`outer-${i}-${j}`, p, e.axis, e.normal, 2.65, 5.2, 3, 1.65, 'round', 2);
      h.kind = 'window';
      hs.push(h);
    }
    if (e.length > 90) {
      const p = e.a.map((v, k) => (v + e.b[k]) / 2),
        h = hole(`portal-${i}`, p, e.axis, e.normal, 3, 1, 3.3, 1.8, 'pointed', 2);
      h.kind = 'door';
      hs.push(h);
    }
  }
  return hs;
}
export function amrArcades(d = 3) {
  const bays = [],
    step = d === 0 ? 20 : d === 1 ? 8 : 5.5;
  for (const [side, e] of _edges(plans.court).entries()) {
    const n = Math.max(1, Math.floor(e.length / step));
    for (let j = 0; j < n; j++)
      bays.push({
        side,
        index: j,
        count: n,
        span: e.length / n,
        center: e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n + e.normal[k] * 0.4),
        column: e.a.map((v, k) => v + ((e.b[k] - v) * j) / n + e.normal[k] * 0.4),
        axis: e.axis,
        normal: e.normal,
      });
  }
  return bays;
}
function spandrel(face, bay, d) {
  const { span, center: p, axis, normal } = bay,
    w = span / 2,
    shape = openingShape(
      { width: span - 0.8, bottom: 1, height: 7.8, spring: 4.2, shape: 'pointed' },
      d,
    ).slice(2),
    ring = [[-w, 5.2], [-w, 9.8], [w, 9.8], [w, 5.2], ...shape],
    ids = earcut(ring.flat(), [], 2),
    P = ([x, y], v) => [
      p[0] + axis[0] * x + normal[0] * v,
      floor + y,
      p[1] + axis[1] * x + normal[1] * v,
    ];
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => ring[k]);
    face(
      'trim',
      q.map((q) => P(q, -0.4)),
      [-normal[0], 0, -normal[1]],
    );
    face(
      'trim',
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
      dy = b[1] - a[1],
      nx = dy * sg,
      ny = -dx * sg;
    face('trim', [P(a, -0.4), P(b, -0.4), P(b, 0.4), P(a, 0.4)], [axis[0] * nx, ny, axis[1] * nx]);
  }
}
function column(face, p, b, t, r, d, slot = 'trim') {
  const ring = circle(p, r, d === 0 ? 4 : d === 1 ? 4 : d === 2 ? 8 : 12);
  solid(face, ring, b, t, slot);
  if (d >= 1) {
    solid(face, circle(p, r * 1.5, d === 1 ? 4 : 8), b, b + 0.25, slot);
    solid(
      face,
      rect(p[0] - r * 1.5, p[1] - r * 1.5, p[0] + r * 1.5, p[1] + r * 1.5),
      t - 0.35,
      t,
      slot,
    );
  }
}
function arcades(face, d) {
  for (const b of amrArcades(d)) {
    spandrel(face, b, d);
    column(face, b.column, 1, 5.2, d === 0 ? 0.5 : 0.34, d);
    if (d >= 2) {
      const q = b.column.map((v, k) => v + b.normal[k] * 6.5);
      if (amrInside(q, plans.whole.outline) && !amrInside(q, plans.court))
        column(face, q, 1, 9.8, 0.3, d);
    }
  }
}
function merlons(face, r, d) {
  if (d === 0) return;
  for (const e of _edges(r)) {
    const n = Math.floor(e.length / (d === 1 ? 6 : d === 2 ? 4.5 : 3));
    for (let i = 0; i < n; i++) {
      const p = e.a.map((v, k) => v + ((e.b[k] - v) * (i + 0.5)) / n);
      solid(face, rect(p[0] - 0.4, p[1] - 0.35, p[0] + 0.4, p[1] + 0.35), 10.8, 11.35, 'trim');
      if (d >= 2)
        solid(face, rect(p[0] - 0.25, p[1] - 0.23, p[0] + 0.25, p[1] + 0.23), 11.35, 11.7, 'trim');
      profile(
        face,
        circle(p, 0.32, d === 1 ? 4 : 4),
        [
          [d === 1 ? 11.35 : 11.7, 1],
          [12, 0],
        ],
        'trim',
      );
    }
  }
}
function roof(face, d) {
  const r = plans.whole.outline,
    h = plans.court;
  cap(face, r, 10.8, 'roof', [h]);
  cap((s, p) => face(s, p, [0, -1, 0]), r, 10.3, 'wood', [h]);
  sides(face, r, 10.3, 10.8, 'roof');
  sides(face, h, 10.3, 10.8, 'trim', true);
  if (d >= 1) {
    for (const e of _edges(h)) beam(face, at(e.a, 9.8), at(e.b, 9.8), 0.35, 'trim');
  }
  merlons(face, r, d);
  if (d >= 2) merlons(face, h, d);
}
function dome(face, p, r, b, h, d) {
  const n = [8, 12, 20, 28, 32][d],
    m = [2, 3, 4, 6, 7][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: m + 1 }, (_, i) => {
      const a = ((i / m) * Math.PI) / 2;
      return [b + h * Math.sin(a), i === m ? 0 : Math.cos(a)];
    }),
    'wall',
  );
}
function pavilion(face, d) {
  const p = plans.pavilion,
    r = circle(p, 8.2, 8);
  solid(face, r, 1, 1.3, 'paving');
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      q = [p[0] + Math.cos(a) * 6.9, p[1] + Math.sin(a) * 6.9];
    column(face, q, 1.3, 6.9, d === 0 ? 0.5 : 0.38, d);
  }
  solid(face, r, 6.9, 7.4, 'wood');
  cap((s, p) => face(s, p, [0, -1, 0]), r, 6.9, 'wood');
  if (d >= 1) {
    const inner = circle(p, 7.8, 8);
    sides(face, r, 7.4, 7.9, 'wood');
    sides(face, inner, 7.4, 7.9, 'wood', true);
    cap(face, r, 7.9, 'wood', [inner]);
  }
  solid(face, circle(p, 4.5, [8, 12, 20, 28, 32][d]), 7.4, 8, 'trim');
  dome(face, p, 4.5, 8, 5.2, d);
  profile(
    face,
    circle(p, d === 0 ? 0.14 : 0.1, d === 0 ? 4 : 8),
    [
      [13.2, 1],
      [14.4, 0],
    ],
    'wood',
  );
  profile(
    face,
    circle(p, 2.8, d === 0 ? 8 : 16),
    [
      [1.3, 1],
      [2.5, 1],
      [2.65, 0.85],
    ],
    'trim',
  );
}
function minaret(face, p, d) {
  const n = [6, 8, 12, 16, 20][d];
  solid(face, rect(p[0] - 1.8, p[1] - 1.8, p[0] + 1.8, p[1] + 1.8), 1, 12, 'wall');
  profile(
    face,
    circle(p, 1, n),
    [
      [12, 1.35],
      [18, 1.15],
      [18, 1.9],
      [19.3, 1.9],
      [19.3, 0.85],
      [24, 0.8],
      [24, 1.1],
      [29, 0],
    ],
    'trim',
  );
  profile(
    face,
    circle(p, d === 0 ? 0.12 : 0.09, d === 0 ? 4 : 8),
    [
      [29, 1],
      [30, 0],
    ],
    'wood',
  );
  if (d >= 1)
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        normal = [Math.cos(a), Math.sin(a)],
        axis = [-normal[1], normal[0]],
        q = p.map((v, k) => v + normal[k] * 0.87),
        h = hole(`upper-minaret-${i}`, q, axis, normal, 0.45, 20.2, 2.3, 1.4, 'round', 1);
      pane(face, h, d, 0, 'glass');
    }
}
function build(out, d) {
  const face = writer(out, d),
    hs = amrFields(d);
  sides(face, plans.whole.outline, footing, 1, 'paving');
  cap(face, plans.whole.outline, 1, 'paving');
  const innerWall = scaled(plans.whole.outline, 0.988);
  shell(out, d, plans.whole.outline, 1, 10.3, d === 1 ? [] : hs, 'wall', d >= 3 ? innerWall : null);
  if (d < 3) sides(face, innerWall, 1, 10.3, 'wall', true);
  for (const h of hs) {
    pane(face, h, d, d === 1 ? 0.04 : -0.2, h.kind === 'door' ? 'wood' : 'glass');
    if (d >= 2) archBand(face, h, d, h.kind === 'door' ? 0.4 : 0.25, 'trim', 0.05);
  }
  roof(face, d);
  arcades(face, d);
  pavilion(face, d);
  for (const p of plans.minarets) minaret(face, p, d);
}
export const buildAmrSkyline = (o) => build(o, 0),
  buildAmrDistrict = (o) => build(o, 1),
  buildAmrStreet = (o) => build(o, 2),
  buildAmrCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const amrStudy = {
  id: 'N0462',
  key: 'mosque_of_amr_ibn_al_as',
  title: 'Mosque of Amr ibn al-As',
  category: 'mosque',
  wikidataId: 'Q683511',
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
    'Five existing shared 256² stucco, continuous limestone, membrane, marble and plain wood graphs serve six merged roles including local opaque blue-grey window fields. Metric UVs, linear colors and zero embedded images. Coarse arcades/pavilion are original geometry; fine inscriptions, screen artwork and reference photographs do not ship.',
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
    'Current named polygon/courtyard resolves the older reference-only record without asserting a historical exact way identity. Pavilion/tower positions, bay counts, roof divisions, facades and all heights are estimates. Open court and colonnades are exterior architecture; no furnished-interior or collision/free-walking guarantee. Fine medallions, inscriptions, capitals, gallery lattice, tap furniture, doors/services and current finish/grades omitted. Surrounding fence/gardens/city remain host content. Physical-device timings pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('open-court-and-domed-pavilion', [-30, 11, 14], [-4, 7, 0]),
    cam('pointed-court-arcades', [-15, 6, -8], [-16, 7, -24]),
    cam('round-arched-exterior-windows', [-113, 18, -30], [-65, 7, -15]),
    cam('corner-balcony-minaret', [-85, 35, -88], [-62, 21, -55]),
    cam('four-ranges-and-open-roof', [62, 91, 76], [-5, 7, 0]),
    cam('north-up-named-map-control', [0, 250, 0.1], [-5, 7, 0]),
  ],
};

/** Shah Mosque: turquoise dome, four minarets, angled entrance and four court iwans. */
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
  '../../../content/worldgen/source/places/tj/tju/shah_mosque/',
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
  wall: '#d3ba95',
  roof: '#c1b39b',
  trim: '#ded0ac',
  tile: '#809bc0',
  dome: '#7bbdb8',
  door: '#74634f',
  glass: '#4e7789',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, shahGround(...p) - 0.35);
export function shahGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Shah Mosque footing outside retained terrain');
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
function _solid(face, r, b, t, slot) {
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
const _band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
function beam(face, a, b, w, slot = 'trim', capped = true) {
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
  if (capped) {
    face(
      slot,
      lo,
      axis.map((v) => -v),
    );
    face(slot, hi, axis);
  }
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
function profile(face, ring, levels, slot, origin = center(ring)) {
  const scale = (f) => ring.map((p) => p.map((v, k) => origin[k] + (v - origin[k]) * f));
  let prev = scale(levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const r = scale(levels[i][1]);
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
function iwan(face, h, d) {
  const p = (u, y, t) => point(h, u, floor + y, t),
    front = [
      [-h.frameWidth / 2, 0],
      [h.frameWidth / 2, 0],
      [h.frameWidth / 2, h.top],
      [-h.frameWidth / 2, h.top],
    ];
  panel(face, h, d, h.frameWidth, 0, h.top, 'tile');
  // The deep blind recess is open to the exterior; its back closes before the prayer interior.
  reveal(face, h, d, 0, -h.depth + 0.4, 'tile');
  const ring = openingShape(h, d);
  face(
    'tile',
    ring.map((q) => point(h, ...q, -h.depth + 0.4)),
    [h.normal[0], 0, h.normal[1]],
  );
  face(
    'wall',
    front.map((q) => p(...q, -h.depth)),
    [-h.normal[0], 0, -h.normal[1]],
  );
  for (const side of [-1, 1])
    face(
      'wall',
      [
        p((side * h.frameWidth) / 2, 0, 0),
        p((side * h.frameWidth) / 2, 0, -h.depth),
        p((side * h.frameWidth) / 2, h.top, -h.depth),
        p((side * h.frameWidth) / 2, h.top, 0),
      ],
      [h.axis[0] * side, 0, h.axis[1] * side],
    );
  face(
    'roof',
    [
      p(-h.frameWidth / 2, h.top, 0),
      p(h.frameWidth / 2, h.top, 0),
      p(h.frameWidth / 2, h.top, -h.depth),
      p(-h.frameWidth / 2, h.top, -h.depth),
    ],
    [0, 1, 0],
  );
  if (d > 0) {
    archBand(face, h, d, 0.55, h.name === 'east' ? 'trim' : 'trim', 0.055);
    for (const u of [-h.frameWidth / 2 + 0.65, h.frameWidth / 2 - 0.65]) {
      face(
        'trim',
        [
          p(u - 0.35, 0.5, 0.08),
          p(u + 0.35, 0.5, 0.08),
          p(u + 0.35, h.top - 0.5, 0.08),
          p(u - 0.35, h.top - 0.5, 0.08),
        ],
        [h.normal[0], 0, h.normal[1]],
      );
      if (d > 1)
        for (let j = 0; j < 3; j++) {
          const y = 2.2 + (j * (h.top - 5)) / 3,
            w = 0.42;
          face(
            'tile',
            [p(u - w, y, 0.1), p(u + w, y, 0.1), p(u + w, y + 4.8, 0.1), p(u - w, y + 4.8, 0.1)],
            [h.normal[0], 0, h.normal[1]],
          );
        }
    }
    const door = {
      ...h,
      center: h.center.map((v, k) => v - h.normal[k] * (h.depth - 0.43)),
      width: h.name === 'north' ? 4.2 : 5.0,
      bottom: floor + 0.3,
      height: 5,
      spring: 3,
    };
    pane(face, door, d, 0.02, 'door');
    archBand(face, door, d, 0.35, 'trim', 0.05);
    // Broad original cells abstract the observed muqarnas; no copied tilework or fine ornament.
    if (d > 1 && h.openingHeight > 20)
      for (let row = 0; row < (d === 2 ? 2 : 3); row++) {
        const n = 3 - row,
          w = h.openingWidth / (3.8 + row * 0.6),
          y = 9.1 + row * 3.6,
          dep = -h.depth + 1.0 + row * 0.28;
        for (let j = 0; j < n; j++) {
          const u = (j - (n - 1) / 2) * (w + 0.25),
            r = [
              [u - w / 2, y],
              [u + w / 2, y],
              [u + w * 0.45, y + 1.8],
              [u, y + 3.1],
              [u - w * 0.45, y + 1.8],
            ],
            tip = p(u, y + 1.5, dep + 1.1);
          for (let k = 0; k < r.length; k++)
            face('trim', [p(...r[k], dep), p(...r[(k + 1) % r.length], dep), tip]);
        }
      }
  }
}
const plans = rec.plans;
const rect = (x, z, w, h) => [
    [x - w / 2, z - h / 2],
    [x + w / 2, z - h / 2],
    [x + w / 2, z + h / 2],
    [x - w / 2, z + h / 2],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
      p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
    ]);
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      center: lerp(a, b, 0.5),
      length: Math.hypot(...b.map((v, k) => v - a[k])),
    };
  });
const field = (name, center, axis, normal, width, bottom, height, spring, depth = 1) => ({
  name,
  center,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape: 'pointed',
  depth,
});
const point = (h, u, y, dep = 0) => [
  h.center[0] + h.axis[0] * u + h.normal[0] * dep,
  y,
  h.center[1] + h.axis[1] * u + h.normal[1] * dep,
];
function down(face, r, y, slot, holes = []) {
  const p = [...r, ...holes.flat()],
    starts = [];
  let n = r.length;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(p.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, -1, 0],
    );
}
function panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    p = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
      ...r,
    ],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function reveal(face, h, d, front, back, slot = 'wall') {
  const r = openingShape(h, d),
    sg = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      du = b[0] - a[0],
      dy = b[1] - a[1];
    face(
      slot,
      [point(h, ...a, front), point(h, ...b, front), point(h, ...b, back), point(h, ...a, back)],
      [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
    );
  }
}
export function shahIwans() {
  return plans.iwans.map((p) => ({
    ...p,
    frameWidth: p.width,
    ...field(
      p.name,
      p.center,
      p.axis,
      p.normal,
      p.openingWidth,
      0.18,
      p.openingHeight,
      p.spring,
      p.depth,
    ),
  }));
}
const distance = (p, a, b) => {
  const v = b.map((n, k) => n - a[k]),
    t = Math.max(
      0,
      Math.min(
        1,
        p.map((n, k) => n - a[k]).reduce((n, w, k) => n + w * v[k], 0) /
          (v[0] * v[0] + v[1] * v[1]),
      ),
    );
  return Math.hypot(...p.map((n, k) => n - a[k] - t * v[k]));
};
function sidesExceptCourt(face, r, b, t, slot) {
  for (const e of edges(r)) {
    if (
      plans.courts.some((c) =>
        edges(c).some(
          (q) =>
            distance(e.center, q.a, q.b) < 0.6 &&
            Math.abs(e.axis.reduce((n, v, k) => n + v * q.axis[k], 0)) > 0.99,
        ),
      )
    )
      continue;
    face(slot, [at(e.a, b), at(e.b, b), at(e.b, t), at(e.a, t)], [e.normal[0], 0, e.normal[1]]);
  }
}
function courtSpans(e, index) {
  const iw =
    index === 1
      ? plans.iwans
          .filter((h) => h.name !== 'northeast')
          .find((h) => distance(h.center, e.a, e.b) < 2.2)
      : undefined;
  if (!iw) return [[0, e.length]];
  const u = iw.center.map((v, k) => v - e.a[k]).reduce((n, v, k) => n + v * e.axis[k], 0),
    gap = (iw.width + 0.2) / 2;
  return [
    [0, Math.max(0, u - gap)],
    [Math.min(e.length, u + gap), e.length],
  ].filter(([a, b]) => b - a > 0.3);
}
export function shahCourtFields(d = 3) {
  if (d === 0) return [];
  const result = [];
  for (const [index, r] of plans.courts.entries())
    for (const [edge, e] of edges(r).entries()) {
      const normal = e.normal.map((v) => -v);
      for (const [start, end] of courtSpans(e, index)) {
        const n = Math.max(1, Math.round((end - start) / (d === 1 ? 17.5 : 6.7))),
          step = (end - start) / n;
        for (let i = 0; i < n; i++)
          for (let tier = 0; tier < (index === 1 ? 2 : 1); tier++) {
            const p = lerp(e.a, e.b, (start + (i + 0.5) * step) / e.length);
            result.push({
              ...field(
                `court-${index}-${edge}-${start}-${i}-${tier}`,
                p,
                e.axis,
                normal,
                step * 0.72,
                tier ? 4.85 : 0.3,
                tier ? 3.45 : index === 1 ? 4.0 : 5.1,
                tier ? 1.9 : index === 1 ? 2.3 : 2.9,
                0.9,
              ),
              step,
              index,
              edge,
              tier,
            });
          }
      }
    }
  return result;
}
function gallery(face, d) {
  for (const h of shahCourtFields(d)) {
    const top = h.index === 1 ? (h.tier ? 9 : 4.5) : 6,
      bottom = h.tier ? 4.5 : 0;
    panel(face, h, d, h.step, bottom, top, 'tile', 0.02);
    reveal(face, h, d, 0.02, -0.34, 'trim');
    pane(face, h, d, -0.34, 'wall');
    if (d > 1) {
      archBand(face, h, d, 0.18, 'trim', 0.045);
      if (!h.tier) {
        const q = { ...h, width: h.width * 0.38, height: 2.3, spring: 1.4 };
        pane(face, q, d, -0.29, 'door');
      }
    }
  }
}
export function shahDrumFields(d = 3) {
  if (d === 0) return [];
  const p = plans.domes[0],
    n = d === 1 ? 8 : 12;
  return Array.from({ length: n }, (_, i) => {
    const a = ((i + 0.5) * 2 * Math.PI) / n,
      normal = [Math.cos(a), Math.sin(a)],
      axis = [normal[1], -normal[0]];
    return field(
      `main-drum-${i}`,
      p.center.map((v, k) => v + normal[k] * p.radius * 0.99),
      axis,
      normal,
      d === 1 ? 2.6 : 2.1,
      15.1,
      5.4,
      3.0,
      1.2,
    );
  });
}
function dome(out, face, p, d) {
  if (d === 0 && !p.main) return;
  const n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : d === 3 ? 28 : 32,
    r = circle(p.center, p.radius, n);
  if (p.main) {
    const fields = shahDrumFields(d);
    shell(out, d, r, 12, 25, fields, 'wall');
    for (const h of fields) {
      pane(face, h, d, -0.4);
      if (d > 1) archBand(face, h, d, 0.25, 'trim', 0.045);
    }
    sides(face, r, 25, 30, 'dome');
    if (d > 0) sides(face, circle(p.center, p.radius * 1.008, n), 27.1, 28.1, 'tile');
    profile(
      face,
      r,
      d === 0
        ? [
            [30, 1],
            [37, 1.04],
            [45, 0.7],
            [51, 0.03],
          ]
        : [
            [30, 1],
            [33.5, 1.07],
            [37, 1.04],
            [41, 0.89],
            [45, 0.66],
            [48.5, 0.33],
            [51, 0.03],
          ],
      'dome',
      p.center,
    );
    profile(
      face,
      circle(p.center, 0.22, d === 0 ? 4 : 8),
      d === 0
        ? [
            [51, 1],
            [52, 0.03],
          ]
        : [
            [51, 1],
            [51.4, 1.5],
            [52, 0.03],
          ],
      'trim',
      p.center,
    );
  } else
    profile(
      face,
      d === 0 ? circle(p.center, p.radius, 6) : p.outline,
      d === 0
        ? [
            [12, 1],
            [17, 0.85],
            [22, 0.04],
          ]
        : [
            [12, 1],
            [14, 1.01],
            [17, 0.85],
            [20, 0.5],
            [22, 0.04],
          ],
      'roof',
      p.center,
    );
}
function minaret(face, p, d) {
  const n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : d === 3 ? 16 : 20,
    r = circle(p.center, p.radius, n);
  if (d > 0)
    profile(
      face,
      r,
      [
        [0, 1],
        [42, 0.81],
        [43.1, 1.25],
        [43.5, 1.47],
      ],
      'dome',
      p.center,
    );
  if (d === 0) {
    profile(
      face,
      r,
      [
        [0, 1],
        [42, 0.81],
        [43.5, 1.47],
        [45, 1.47],
        [47.4, 0.08],
      ],
      'dome',
      p.center,
    );
  } else {
    const outer = circle(p.center, p.radius * 1.47, n),
      inner = circle(p.center, p.radius * 0.96, n);
    cap(face, outer, 43.5, 'trim', [inner]);
    sides(face, outer, 45, 45.2, 'trim');
    cap(face, outer, 45.2, 'trim', [inner]);
    down(face, outer, 45, 'trim', [inner]);
    const count = d === 1 ? 4 : d === 2 ? 6 : 8;
    for (let i = 0; i < count; i++) {
      const a = (i * 2 * Math.PI) / count,
        q = p.center.map((v, k) => v + [Math.cos(a), Math.sin(a)][k] * p.radius * 1.34);
      beam(face, at(q, 43.5), at(q, 45), d === 1 ? 0.22 : 0.18, 'trim', false);
    }
    profile(
      face,
      circle(p.center, p.radius * 0.53, n),
      [
        [43.4, 1],
        [46, 1],
        [46.4, 1.05],
        [47.1, 0.55],
        [47.4, 0.04],
      ],
      'dome',
      p.center,
    );
    if (d > 1) sides(face, circle(p.center, p.radius * 0.83, n), 40.7, 41.7, 'tile');
  }
  profile(
    face,
    circle(p.center, 0.13, 4),
    d === 0
      ? [
          [47.4, 1],
          [48, 0],
        ]
      : [
          [47.4, 1],
          [47.7, 1.4],
          [48, 0.02],
        ],
    'trim',
    p.center,
  );
}
function lookout(face, d) {
  if (d === 0) return;
  const h = plans.iwans.find((p) => p.name === 'southeast'),
    p = h.center.map((v, k) => v - h.normal[k] * 2.4),
    r = rect(...p, 4.0, 3.4);
  cap(face, r, 18.35, 'door');
  down(face, r, 18.15, 'door');
  sides(face, r, 18.15, 18.35, 'door');
  for (const q of r) beam(face, at(q, 18.35), at(q, 21.8), d === 0 ? 0.3 : 0.22, 'door', false);
  const roof = rect(...p, 5.1, 4.5),
    tip = at(p, 24);
  for (let i = 0; i < 4; i++)
    face('dome', [at(roof[i], 21.8), at(roof[(i + 1) % 4], 21.8), tip], [0, 1, 0]);
  down(face, roof, 21.8, 'door');
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((p) => p.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-7
        )
          return;
        target.addTriangle(a[0], a[1], p, a[3], a[4], a[5]);
      },
    },
    face = writer(out, d),
    iwans = shahIwans(d),
    cuts = iwans.map((h) =>
      prepareOpening(
        {
          ...h,
          center: h.center.map((v, k) => v - h.normal[k] * (h.depth / 2 - 0.35)),
          depth: h.depth + 1.3,
        },
        0,
        d,
      ),
    ),
    body = writer(masked(out, cuts), d),
    outer = d === 0 ? _coarse(plans.outer) : plans.outer;
  sides(face, outer, footing, 0, 'wall');
  cap(face, outer, 0, 'trim');
  sides(body, outer, 0, 6, 'wall');
  cap(body, outer, 6, 'roof', plans.courts);
  sidesExceptCourt(body, plans.centralRange, 6, 9, 'wall');
  cap(body, plans.centralRange, 9, 'roof');
  sidesExceptCourt(body, plans.mainHall, 6, 12, 'wall');
  cap(body, plans.mainHall, 12, 'roof');
  for (const p of plans.sideHalls) {
    sidesExceptCourt(body, p.outline, 6, 12, 'wall');
    cap(body, p.outline, 12, 'roof');
  }
  if (d === 0)
    for (const [index, r] of plans.courts.entries())
      sides(body, r, 0, index === 1 ? 9 : 6, 'tile', true);
  else gallery(body, d);
  for (const h of iwans) iwan(face, h, d);
  for (const p of plans.domes) dome(masked(out, cuts), body, p, d);
  for (const p of plans.minarets) minaret(face, p, d);
  lookout(face, d);
  const p = plans.basin,
    r = rect(...p.center, p.width, p.length),
    inner = rect(...p.center, p.width - 0.7, p.length - 0.7);
  if (d > 0) {
    sides(face, r, 0, 0.28, 'trim');
    cap(face, r, 0.28, 'trim', [inner]);
    sides(face, inner, 0.04, 0.28, 'tile', true);
  }
  cap(face, inner, 0.05, 'glass');
}
export const buildShahSkyline = (o) => build(o, 0),
  buildShahDistrict = (o) => build(o, 1),
  buildShahStreet = (o) => build(o, 2),
  buildShahCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const shahStudy = {
  id: 'shah_mosque',
  key: 'shah_mosque',
  title: 'Shah Mosque',
  category: 'mosque',
  wikidataId: 'Q643098',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256² longformat brick,sandstone,mosaic and wood graphs;six merged groups. Blue portal frames and turquoise dome/minaret tiles use original vertex tints on the same generic mosaic graph. Metric UVs/linear colors,zero embedded images,baked lighting or copied facade/calligraphy art. Broad original facets abstract muqarnas.',
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
    'Individual medium-fi compound from four inspected2014 entrance/court/madrasa/muqarnas pictures. Large turquoise dome,two smaller side caps,four minarets,five iwans,central two-tier/madrasa single-tier fields,rectangular basin and southeast timber lookout. Angled entrance retains mapped bearing. Iwan/arcade/drum fields close before interiors;minaret/pavilion upper stages open. Skyline uses closed minaret gallery bands;district opens coarse stages and simplifies bays. Smaller cap finish,unseen roofs/terrace/interior plans,planting,current finish/fixtures,precise street/ground contacts and engineering unverified. Coarse standard DEM has a pronounced urban height variation;working floor/foundations are a clearance approximation,not a surveyed podium. Fine tile/calligraphy,flags/scaffolding/fixtures/railings omitted. Adjacent square arcades/streets/city buildings remain host content. Physical-device timing unmeasured.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('main-prayer-iwan', [4, 17, 10], [-34, 19, -3]),
    cam('angled-square-entrance', [89, 24, -61], [51.8, 22, -23.6]),
    cam('turquoise-main-dome', [-112, 51, 17], [-55, 34, -4]),
    cam('two-tier-court-and-basin', [12, 12, -18], [-24, 10, 18]),
    cam('southeast-timber-pavilion', [-2, 21, 9], [-2, 21, 39]),
    cam('mapped-four-court-plan', [0, 320, 0.1], [0, 12, 0]),
  ],
};

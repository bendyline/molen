/** Muhammad Ali Mosque: cascading pale domes, twin pencil minarets and open fountain court. */
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
  '../../../content/worldgen/source/places/st/stq/muhammad_ali_mosque/',
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
  wall: '#c5af87',
  trim: '#d7ccb6',
  roof: '#c7cbc7',
  paving: '#d2cabe',
  wood: '#8d8066',
  gold: '#bca36d',
  glass: '#426171',
  green: '#687b62',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, muhammadAliGround(...p) - 0.35);
export function muhammadAliGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Muhammad Ali Mosque footing outside retained terrain');
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
function _shell(out, d, r, b, t, holes = [], slot = 'wall', inner = null) {
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
        levels[i][0] === levels[i - 1][0]
          ? [0, levels[i - 1][1] > levels[i][1] ? 1 : -1, 0]
          : [
              (prev[k][0] + prev[j][0]) / 2 - origin[0],
              0,
              (prev[k][1] + prev[j][1]) / 2 - origin[1],
            ],
      );
    }
    prev = r;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
const plans = rec.plans;
const _rect = (x, z, w, h) => [
  [x - w / 2, z - h / 2],
  [x + w / 2, z - h / 2],
  [x + w / 2, z + h / 2],
  [x - w / 2, z + h / 2],
];
const circle = (p, r, n) =>
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
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function _slab(face, r, y, h, slot) {
  sides(face, r, y, y + h, slot);
  cap(face, r, y + h, slot);
  down(face, r, y, slot);
}
function panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    outer = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
    ],
    p = [...outer, ...r],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function reveal(face, h, d, front, back, slot) {
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
const dimensions = (r) =>
  [0, 1].map((k) => Math.max(...r.map((p) => p[k])) - Math.min(...r.map((p) => p[k])));
const radius = (p) => Math.min(...dimensions(p.plan.outline)) / 2;
function ringBeam(face, p, y, r, n, width, slot = 'trim') {
  const ring = circle(p, r, n);
  for (let i = 0; i < n; i++) beam(face, at(ring[i], y), at(ring[(i + 1) % n], y), width, slot);
}
function cupola(face, p, r, b, t, d, slot = 'roof', segments) {
  const n = segments ?? [6, 10, 16, 24, 28][d],
    steps = d <= 1 ? 3 : d === 2 ? 4 : 7,
    levels = Array.from({ length: steps }, (_, i) => {
      const u = ((i / (steps - 1)) * Math.PI) / 2;
      return [b + (t - b) * Math.sin(u), Math.cos(u)];
    });
  profile(face, circle(p, r, n), levels, slot);
}
export function muhammadCourtBays(d = 3) {
  const rows = [];
  for (const [i, e] of edges(plans.court).entries()) {
    const n =
        d === 0
          ? 2
          : d === 1
            ? Math.max(3, Math.round(e.length / 13))
            : Math.round(e.length / (d === 2 ? 6.8 : 5.2)),
      step = e.length / n;
    for (let j = 0; j < n; j++)
      rows.push({
        ...field(
          `court-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal.map((v) => -v),
          step * 0.76,
          0.7,
          5.7,
          3.8,
          5.6,
        ),
        shape: 'round',
        step,
        edge: i,
        index: j,
      });
  }
  return rows;
}
export function muhammadHallFields(d = 3) {
  if (d === 0) return [];
  const rows = [];
  for (const [i, e] of edges(plans.hall.plan.outline).entries()) {
    if (e.length < 5) continue;
    const n = Math.max(1, Math.round(e.length / (d === 1 ? 12 : 5.5))),
      step = e.length / n;
    for (let j = 0; j < n; j++)
      for (const tier of [1])
        rows.push({
          ...field(
            `hall-${i}-${j}-${tier}`,
            lerp(e.a, e.b, (j + 0.5) / n),
            e.axis,
            e.normal,
            Math.min(2.4, step * 0.5),
            tier ? 11 : 3.4,
            tier ? 3.4 : 4.4,
            tier ? 2.2 : 3,
            1.2,
          ),
          shape: 'round',
          tier,
        });
  }
  // Lower-storey windows belong on the aggregate outline, outside the inset upper hall.
  if (d >= 2)
    for (const [i, edge] of edges(plans.whole.outline).entries()) {
      let { a, b } = edge;
      if (Math.max(a[0], b[0]) <= 5) continue;
      if (a[0] < 5) a = lerp(a, b, (5 - a[0]) / (b[0] - a[0]));
      if (b[0] < 5) b = lerp(a, b, (5 - a[0]) / (b[0] - a[0]));
      const length = Math.hypot(...b.map((v, k) => v - a[k]));
      if (length < 5) continue;
      const n = Math.max(1, Math.round(length / 6)),
        step = length / n;
      for (let j = 0; j < n; j++)
        rows.push({
          ...field(
            `lower-hall-${i}-${j}`,
            lerp(a, b, (j + 0.5) / n),
            edge.axis,
            edge.normal,
            Math.min(2.4, step * 0.5),
            3.4,
            3.8,
            2.6,
            1.2,
          ),
          shape: 'round',
          tier: 0,
        });
    }
  return rows;
}
function colonnades(face, d) {
  if (d === 0) return;
  for (const h of muhammadCourtBays(d)) {
    // Frames sit ahead of the masonry; no coplanar facade layers.
    panel(face, h, d, h.step, 0.7, 8, 'trim', 0.04);
    reveal(face, h, d, 0.04, -4.8, 'trim');
    if (d >= 1) {
      const back = { ...h, width: h.width * 0.65, height: 4.2, spring: 2.7 };
      pane(face, back, d, -4.85, 'wood');
      archBand(face, h, d, 0.3, 'wall', 0.08);
    }
    const p = h.center.map((v, k) => v - h.normal[k] * 2.7);
    if (d >= 1) {
      cupola(face, p, Math.min(2.0, h.step * 0.39), 8, 10.2, d, 'roof');
      if (d >= 2)
        profile(
          face,
          circle(p, 0.12, 6),
          [
            [10.2, 1],
            [10.5, 0],
          ],
          'gold',
        );
    }
  }
}
export function muhammadDrumFields(d = 3) {
  if (d === 0) return [];
  const n = d === 1 ? 1 : 2;
  return edges(plans.drum.plan.outline).flatMap((e, i) =>
    Array.from({ length: n }, (_, j) => ({
      ...field(
        `drum-${i}-${j}`,
        lerp(e.a, e.b, (j + 0.5) / n),
        e.axis,
        e.normal,
        1.1,
        28.1,
        0.8,
        0.5,
        0.1,
      ),
      shape: 'round',
    })),
  );
}
function minaret(face, q, d) {
  const p = q.center,
    r = radius(q),
    n = [6, 8, 12, 20, 24][d];
  profile(
    face,
    circle(p, r, n),
    d === 0
      ? [
          [0.7, 1],
          [33, 0.62],
          [35, 1],
          [35, 0.5],
          [52, 0.5],
          [54, 0.95],
          [54, 0.4],
          [64, 0.4],
        ]
      : [
          [0.7, 1],
          [8, 0.9],
          [10, 0.64],
          [33, 0.62],
          [34, 0.85],
          [35, 1],
          [35, 0.55],
          [51, 0.52],
          [52, 0.8],
          [54, 0.95],
          [54, 0.45],
          [63, 0.4],
          [64, 0.6],
        ],
    'wall',
  );
  profile(
    face,
    circle(p, r, n),
    [
      [64, 0.6],
      [65, 0.6],
      [81.5, 0],
    ],
    'roof',
  );
  profile(
    face,
    circle(p, 0.12, d === 0 ? 4 : 6),
    [
      [81.5, 1],
      [82, 0],
    ],
    'gold',
  );
  if (d >= 2)
    for (const y of [35, 54]) {
      const rr = r * (y === 35 ? 0.98 : 0.93),
        ring = circle(p, rr, n);
      for (let i = 0; i < n; i++) beam(face, at(ring[i], y), at(ring[i], y + 0.8), 0.2, 'trim');
      ringBeam(face, p, y + 0.8, rr, n, 0.2);
    }
}
function fountain(face, d) {
  const p = plans.fountain.center,
    n = d === 0 ? 4 : 8,
    canopy = plans.fountain.plan.outline;
  solid(face, circle(p, 2.35, d === 0 ? 8 : 16), 0.7, 2.8, 'trim');
  const posts = canopy
    .filter((_, i) => d > 0 || i % 2 === 0)
    .map((q) => q.map((v, k) => p[k] + (v - p[k]) * (4.1 / 5.65)));
  for (const q of posts)
    solid(face, circle(q, d === 0 ? 0.4 : 0.32, d === 0 ? 4 : 8), 0.7, 6.4, 'trim');
  if (d >= 1)
    for (let i = 0; i < n; i++) {
      const a = posts[i],
        b = posts[(i + 1) % n],
        axis = unit(b.map((v, k) => v - a[k])),
        normal = [axis[1] * sign(canopy), -axis[0] * sign(canopy)],
        width = Math.hypot(...b.map((v, k) => v - a[k]));
      const h = {
        ...field(`fountain-${i}`, lerp(a, b, 0.5), axis, normal, width * 0.8, 0.7, 5.6, 3.9, 0.4),
        shape: 'round',
      };
      panel(face, h, d, width, 0.7, 6.5, 'trim', 0.02);
      panel(
        (s, p, n) =>
          face(
            s,
            p,
            n.map((v) => -v),
          ),
        h,
        d,
        width,
        0.7,
        6.5,
        'trim',
        -0.35,
      );
      reveal(face, h, d, 0.02, -0.35, 'trim');
    }
  const green = (s, p, n) => face(s, p, n, colors.green);
  profile(
    green,
    canopy,
    [
      [6.35, 1],
      [6.8, 1],
      [7, 0.96],
    ],
    'wood',
    p,
  );
  profile(
    face,
    canopy,
    [
      [7, 0.96],
      [8, 0.18],
    ],
    'roof',
    p,
  );
  cap(face, canopy, 6.35, 'wood');
  // Visible underside faces down toward the courtyard.
  down(face, canopy, 6.34, 'wood');
  profile(
    face,
    circle(p, 0.17, d === 0 ? 4 : 8),
    [
      [8, 1],
      [8.5, 0],
    ],
    'gold',
  );
}
function clock(face, d) {
  const p = plans.clock.center,
    w = plans.clock.width,
    green = (s, p, n) => face(s, p, n, colors.green);
  solid(face, _rect(...p, w, w), 8, 10, 'trim');
  solid(green, _rect(...p, w * 0.88, w * 0.88), 10, 16.7, 'wood');
  if (d >= 1)
    for (const normal of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const axis = [-normal[1], normal[0]],
        q = p.map((v, k) => v + normal[k] * w * 0.447),
        h = { ...field('clock', q, axis, normal, 1.6, 12.8, 1.6, 0, 0.1), shape: 'circle' };
      pane(face, h, d, 0, 'trim');
      if (d >= 2) {
        const P = (u, y) => [
          q[0] + axis[0] * u + normal[0] * 0.03,
          floor + y,
          q[1] + axis[1] * u + normal[1] * 0.03,
        ];
        beam(face, P(0, 13.6), P(0, 14.15), 0.2, 'glass');
        beam(face, P(0, 13.6), P(0.45, 13.6), 0.2, 'glass');
      }
    }
  if (d >= 1) {
    const corners = _rect(...p, w * 0.75, w * 0.75);
    for (const q of corners) solid(green, circle(q, 0.23, 6), 16.7, 18, 'wood');
  } else solid(green, _rect(...p, w * 0.75, w * 0.75), 16.7, 18, 'wood');
  profile(
    face,
    _rect(...p, w * 1.05, w * 1.05),
    [
      [18, 1],
      [19, 0.2],
    ],
    'roof',
  );
  // The hipped roof needs a horizontal soffit where the inset pavilion posts meet it.
  down(face, _rect(...p, w * 1.05, w * 1.05), 18, 'roof');
}
function build(out, d) {
  const face = writer(out, d),
    bays = muhammadCourtBays(d),
    fields = muhammadHallFields(d),
    r = plans.whole.outline;
  const courtFace =
      d === 0
        ? face
        : writer(
            masked(
              out,
              bays.map((h) => prepareOpening(h, 0, d)),
            ),
            d,
          ),
    hallFace = writer(
      masked(
        out,
        fields.filter((h) => h.tier === 1).map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  sides(face, r, footing, 0.7, 'paving');
  cap(face, r, 0.7, 'paving');
  const lowerFace = writer(
    masked(
      out,
      fields.filter((h) => h.tier === 0).map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  sides(lowerFace, r, 0.7, 8, 'wall');
  sides(courtFace, plans.court, 0.7, 8, 'wall', true);
  cap(face, r, 8, 'roof', [plans.court]);
  down(face, r, 7.8, 'roof', [plans.court]);
  colonnades(face, d);
  const hallRing = d === 0 ? _coarse(plans.hall.plan.outline) : plans.hall.plan.outline;
  sides(hallFace, hallRing, 8, 18, 'wall');
  cap(face, hallRing, 18, 'roof');
  // The mapped aggregate also supplies the hall below the 8 m courtyard eaves.
  for (const h of fields) {
    pane(face, h, d, -0.4, 'glass');
    reveal(face, h, d, 0.02, -0.4, 'trim');
    if (d >= 2) archBand(face, h, d, 0.22, 'trim', 0.05);
  }
  solid(
    face,
    d === 0 ? _coarse(plans.roofTransition.plan.outline) : plans.roofTransition.plan.outline,
    18,
    19,
    'trim',
  );
  solid(face, plans.support.plan.outline, 19, 28, 'wall');
  solid(face, plans.drum.plan.outline, 28, 29, 'wall');
  for (const q of plans.semidomes) cupola(face, q.center, radius(q), 19, 27, d, 'roof');
  if (d >= 1)
    for (const q of plans.cornerDomes) cupola(face, q.center, radius(q), 19, 23, d, 'roof');
  cupola(face, plans.dome.center, radius(plans.dome), 29, 36.5, d, 'roof', d === 0 ? 8 : undefined);
  profile(
    face,
    circle(plans.dome.center, 0.18, d === 0 ? 4 : 8),
    [
      [36.5, 1],
      [37, 0],
    ],
    'gold',
  );
  for (const q of plans.rearTurrets) {
    if (d === 0) {
      solid(face, circle(q.center, radius(q), 4), 18, 26, 'wall');
      profile(
        face,
        circle(q.center, radius(q) * 0.8, 4),
        [
          [26, 1],
          [28, 0],
        ],
        'roof',
      );
      continue;
    }
    const n = [6, 8, 12, 16, 20][d];
    profile(
      face,
      circle(q.center, radius(q), n),
      [
        [18, 1],
        [24, 0.85],
        [25, 1],
        [26, 0.8],
      ],
      'wall',
    );
    cupola(face, q.center, radius(q) * 0.8, 26, 28, d, 'roof');
  }
  for (const q of plans.minarets) minaret(face, q, d);
  if (d >= 1) {
    // The aggregate already supplies this projection below its 8 m eaves.
    solid(face, plans.eastern[2].plan.outline, 8, 9, 'wall');
    solid(face, plans.eastern[1].plan.outline, 9, 10, 'trim');
    cupola(face, plans.eastern[0].center, radius(plans.eastern[0]), 10, 15, d, 'roof');
  }
  for (const h of muhammadDrumFields(d)) pane(face, h, d, 0.04, 'glass');
  fountain(face, d);
  clock(face, d);
}
export const buildMuhammadAliSkyline = (o) => build(o, 0),
  buildMuhammadAliDistrict = (o) => build(o, 1),
  buildMuhammadAliStreet = (o) => build(o, 2),
  buildMuhammadAliCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const muhammadAliStudy = {
  id: 'muhammad_ali_mosque',
  key: 'muhammad_ali_mosque',
  title: 'Muhammad Ali Mosque',
  category: 'mosque',
  wikidataId: 'Q652046',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Pictures viewed only, never redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  sourceNotice:
    'Six existing shared256² limestone, raw limestone, standing-seam metal, marble, plain wood and cast bronze graphs serve seven merged roles. Clock/canopy green reuses the same wood graph with linear vertex tint. Metric UVs, no embedded images or copied art.',
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
    'Two pictures guide the visible exterior; the 1983 court picture is a historical appearance reference. Fine stone carving, painted canopy art, inscriptions, exact clock mechanism, furnishings, hidden interiors, neighboring Citadel buildings and engineering are omitted. No physical phone/tablet/laptop timing or surveyed grade/facing claim.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('cascading-domes-and-paired-spires', [125, 65, 110], [18, 25, 0]),
    cam('open-court-and-fountain', [-18, 16, 17], [-29, 5, -7]),
    cam('octagonal-fountain-canopy', [-15, 4.5, 8], [-27, 6, 0]),
    cam('clock-pavilion-and-cupolas', [-24, 12, 9], [-53, 14, 0]),
    cam('slender-minaret-balconies', [26, 58, 49], [2, 47, 23]),
    cam('north-up-court-and-part-controls', [0, 270, 0.1], [0, 9, 0]),
  ],
  qaLodCameras: scope.qaLodCameras,
};

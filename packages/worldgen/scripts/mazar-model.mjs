/** Mazar-i-Sharif: unequal turquoise domes,projecting portals and blue tiled turrets. */
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
  '../../../content/worldgen/source/places/tq/tqx/blue_mosque_mazar_i_sharif/',
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
  wall: '#a7c2c8',
  panel: '#789bc4',
  trim: '#e5dfcd',
  roof: '#c9c7b9',
  dome: '#72c6d0',
  door: '#76a8c4',
  gold: '#c4b16c',
  glass: '#526a7c',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, mazarGround(...p) - 0.35);
export function mazarGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Blue Mosque (Mazar-i-Sharif) footing outside retained terrain');
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
        [(prev[k][0] + prev[j][0]) / 2 - origin[0], 0, (prev[k][1] + prev[j][1]) / 2 - origin[1]],
      );
    }
    prev = r;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
const _rect = (x, z, w, h) => [
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
function _panel(face, h, d, width, bottom, top, slot, offset = 0) {
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
function _reveal(face, h, d, front, back, slot = 'wall') {
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
const plans = rec.plans;
const rectRing = (h, width, bottom, top, dep = 0) => [
  point(h, -width / 2, floor + bottom, dep),
  point(h, width / 2, floor + bottom, dep),
  point(h, width / 2, floor + top, dep),
  point(h, -width / 2, floor + top, dep),
];
export const mazarPortals = () => plans.portals.map((h) => ({ ...h, bottom: floor + h.bottom }));
export function mazarFacadeFields(d) {
  if (d === 0) return [];
  const hs = [];
  for (const e of edges(plans.outer)) {
    if (e.length < 4) continue;
    const n = Math.max(1, Math.round(e.length / (d === 1 ? 8 : 4.4)));
    for (let k = 0; k < n; k++) {
      const p = lerp(e.a, e.b, (k + 0.5) / n);
      if (
        plans.portals.some((h) => Math.hypot(...p.map((v, i) => v - h.center[i])) < 7) ||
        plans.towers.some((t) => Math.hypot(...p.map((v, i) => v - t.center[i])) < 3.3)
      )
        continue;
      for (const y of [0.8, 7.4])
        hs.push({
          ...field(
            `facade-${hs.length}`,
            p,
            e.axis,
            e.normal,
            Math.min((e.length / n) * 0.65, 2.6),
            y,
            y === 0.8 ? 4.5 : 4.8,
            y === 0.8 ? 2.2 : 2.4,
            1.2,
          ),
          kind: y === 7.4 ? 'panel' : k % 3 === 0 ? 'glass' : 'panel',
        });
    }
  }
  return hs;
}
function diamond(face, h, d) {
  if (d < 2 || (d === 2 && parseInt(h.name.split('-').at(-1), 10) % 3 !== 0)) return;
  const mid = h.bottom + h.height * 0.48,
    w = h.width * 0.27,
    ht = h.height * 0.23,
    p = [
      [0, mid + ht],
      [w, mid],
      [0, mid - ht],
      [-w, mid],
    ].map(([u, y]) => point(h, u, y, -0.18));
  for (let i = 0; i < 4; i++) beam(face, p[i], p[(i + 1) % 4], 0.16, 'trim');
}
function upperBand(face, ring, y, d) {
  sides(face, scaled(ring, 1.006), y, y + 0.42, 'panel');
  if (d >= 2)
    for (const e of edges(ring))
      if (e.length > 3) {
        const n = Math.floor(e.length / 2.5);
        for (let k = 0; k < n; k++) {
          const p = lerp(e.a, e.b, (k + 0.5) / n);
          _solid(face, _rect(...p, 0.27, 0.27), y + 0.42, y + 0.85, 'dome');
        }
      }
}
function body(out, face, d) {
  sides(face, plans.outer, footing, 0, 'wall');
  const fields = mazarFacadeFields(d),
    portals = mazarPortals();
  _shell(out, d, plans.outer, 0, 14.2, [...portals, ...(d >= 2 ? fields : [])], 'wall');
  for (const p of plans.roofParts) cap(face, p.outline, 14.2, 'roof', p.holes);
  cap(face, plans.outer, 0.025, 'trim');
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.035 : -0.28, h.kind);
    if (d >= 2) {
      archBand(face, h, d, 0.22, 'trim');
      if (h.kind === 'panel') diamond(face, h, d);
    }
  }
  upperBand(
    writer(
      masked(
        out,
        portals.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    plans.outer,
    14.2,
    d,
  );
  for (const b of plans.blocks)
    for (const p of b.polygons) {
      const holes = [];
      _shell(out, d, p.outline, 14.2, b.top, [...portals, ...(d >= 2 ? holes : [])], 'wall');
      cap(face, p.outline, b.top, 'roof', p.holes);
      for (const h of holes) {
        pane(face, h, d, d === 1 ? 0.035 : -0.25, 'panel');
        if (d >= 2) archBand(face, h, d, 0.2, 'trim');
      }
      if (d >= 1) upperBand(face, p.outline, b.top, d);
    }
}

function portalSurface(p, h) {
  const u = (p[0] - h.center[0]) * h.axis[0] + (p[2] - h.center[1]) * h.axis[1],
    dep = (p[0] - h.center[0]) * h.normal[0] + (p[2] - h.center[1]) * h.normal[1];
  let best = -Infinity;
  for (let i = 0; i < plans.outer.length; i++) {
    const a = plans.outer[i],
      b = plans.outer[(i + 1) % plans.outer.length],
      ua = (a[0] - h.center[0]) * h.axis[0] + (a[1] - h.center[1]) * h.axis[1],
      ub = (b[0] - h.center[0]) * h.axis[0] + (b[1] - h.center[1]) * h.axis[1];
    if (Math.abs(ub - ua) < 1e-8 || u < Math.min(ua, ub) - 1e-6 || u > Math.max(ua, ub) + 1e-6)
      continue;
    const t = (u - ua) / (ub - ua),
      q = lerp(a, b, t),
      n = (q[0] - h.center[0]) * h.normal[0] + (q[1] - h.center[1]) * h.normal[1];
    best = Math.max(best, n);
  }
  if (!Number.isFinite(best)) throw Error('Portal trim outside mapped facade');
  return [
    h.center[0] + h.axis[0] * u + h.normal[0] * (best + dep),
    p[1],
    h.center[1] + h.axis[1] * u + h.normal[1] * (best + dep),
  ];
}
function portals(out, face, d) {
  for (const h of mazarPortals()) {
    for (const p of h.polygons) {
      _shell(out, d, p.outline, 14.2, h.top, [h], 'wall');
      cap(face, p.outline, h.top, 'roof', p.holes);
      down(face, p.outline, h.top, 'roof', p.holes);
    }
    const back = -3.4;
    face('panel', rectRing(h, h.width + 2, 0, 20.9, back), [h.normal[0], 0, h.normal[1]]);
    const door = {
      ...h,
      name: 'closed-portal-door',
      center: h.center.map((v, k) => v + h.normal[k] * back),
      width: h.width * 0.67,
      bottom: floor + 0.1,
      height: 6,
      spring: 3.7,
      shape: 'rect',
    };
    pane(face, door, d, 0.035, 'door');
    if (d >= 1) {
      archBand(
        (slot, p, n) =>
          face(
            slot,
            p.map((v) => portalSurface(v, h)),
            n,
          ),
        h,
        d,
        0.43,
        'trim',
        0.055,
      );
      const width = h.width * 1.22;
      const cuts = [
        -width / 2,
        width / 2,
        ...plans.outer
          .map((p) => (p[0] - h.center[0]) * h.axis[0] + (p[1] - h.center[1]) * h.axis[1])
          .filter((u) => Math.abs(u) < width / 2),
      ].sort((a, b) => a - b);
      for (let i = 1; i < cuts.length; i++) {
        const a = cuts[i - 1],
          b = cuts[i];
        if (b - a < 1e-6) continue;
        face(
          'panel',
          [
            [a, floor + 18.1],
            [b, floor + 18.1],
            [b, floor + 20.1],
            [a, floor + 20.1],
          ].map(([u, y]) => portalSurface(point(h, u, y, 0.035), h)),
          [h.normal[0], 0, h.normal[1]],
        );
      }
    }
    if (d >= 2) {
      const trans = { ...door, width: door.width * 0.85, bottom: floor + 5.0, height: 0.7 };
      pane(face, trans, d, 0.08, 'glass');
      for (const sign of [-1, 1]) {
        const u = (sign * door.width) / 2;
        beam(
          face,
          point(door, u, floor + 0.1, 0.08),
          point(door, u, floor + 6.1, 0.08),
          0.23,
          'trim',
        );
      }
    }
    if (d >= 2)
      for (let k = 0; k < 5; k++) {
        const p = h.center.map(
          (v, i) => v + h.axis[i] * (k - 2) * h.length * 0.19 - h.normal[i] * 0.05,
        );
        profile(
          face,
          _rect(...p, 0.3, 0.3),
          [
            [h.top, 1],
            [h.top + 0.7, 1],
            [h.top + 0.9, 0.02],
          ],
          'dome',
          p,
        );
      }
  }
}
function finial(face, p, b, t, d) {
  profile(
    face,
    circle(p, d === 0 ? 0.12 : 0.16, d === 0 ? 4 : 8),
    d === 0
      ? [
          [b, 1],
          [t, 0.01],
        ]
      : [
          [b, 1],
          [b + (t - b) * 0.3, 0.6],
          [b + (t - b) * 0.5, 1.5],
          [t, 0.01],
        ],
    'gold',
    p,
  );
}
function domes(face, d) {
  const n = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 24 : d === 3 ? 28 : 32;
  for (const p of plans.domes) {
    const r = circle(p.center, p.radius * 0.95, n),
      bottom = p.name.startsWith('larger') ? 15.2 : 14.8;
    profile(
      face,
      r,
      [
        [bottom, 1],
        [p.base - 0.35, 1],
        [p.base, 0.98],
      ],
      'wall',
      p.center,
    );
    if (d >= 1)
      for (const e of edges(r)) {
        const h = field(
          'drum-closed-field',
          e.center,
          e.axis,
          e.normal,
          Math.min(1.8, e.length * 0.62),
          bottom + 0.55,
          p.base - bottom - 1,
          0.8,
          0.5,
        );
        pane(face, h, d, 0.035, 'panel');
        if (d >= 2) archBand(face, h, d, 0.2, 'trim', 0.06);
      }
    const h = p.top - p.base,
      levels =
        d === 0
          ? [
              [p.base, 1],
              [p.base + h * 0.35, 1.01],
              [p.base + h * 0.72, 0.62],
              [p.top, 0.01],
            ]
          : [
              [p.base, 1],
              [p.base + h * 0.2, 1.04],
              [p.base + h * 0.43, 0.94],
              [p.base + h * 0.67, 0.69],
              [p.base + h * 0.87, 0.34],
              [p.top, 0.01],
            ];
    profile(face, circle(p.center, p.radius, n), levels, 'dome', p.center);
    finial(face, p.center, p.top, p.finial, d);
  }
}
function crown(face, q, r, b, t, d, striped = false) {
  const n = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 12 : 16,
    ring = circle(q, r, n),
    levels =
      d === 0
        ? [
            [b, 0.64],
            [b + (t - b) * 0.5, 1],
            [t, 0.01],
          ]
        : [
            [b, 0.64],
            [b + (t - b) * 0.2, 1],
            [b + (t - b) * 0.52, 0.95],
            [b + (t - b) * 0.8, 0.53],
            [t, 0.01],
          ];
  if (!striped || d < 2) {
    profile(face, ring, levels, 'dome', q);
    return;
  }
  for (let i = 1; i < levels.length; i++)
    for (let k = 0; k < n; k++) {
      const j = (k + 1) % n,
        atLevel = (k, i) =>
          at(
            ring[k].map((v, a) => q[a] + (v - q[a]) * levels[i][1]),
            levels[i][0],
          );
      face(
        k % 4 === 0 ? 'gold' : 'dome',
        [atLevel(k, i - 1), atLevel(j, i - 1), atLevel(j, i), atLevel(k, i)],
        [ring[k][0] + ring[j][0] - 2 * q[0], 0, ring[k][1] + ring[j][1] - 2 * q[1]],
      );
    }
}
export function mazarCornerFields(d) {
  if (d === 0) return [];
  return plans.towers.flatMap((p) =>
    edges(circle(p.center, p.radius, 8))
      .filter((_, i) => i % 2 === 0)
      .map((e) =>
        field(`octagonal-head-${p.name}`, e.center, e.axis, e.normal, 0.73, 14.7, 2.0, 1.0, 0.7),
      ),
  );
}
function cornerTowers(out, face, d) {
  for (const p of plans.towers) {
    const ring = circle(p.center, p.radius, d === 0 ? 4 : 8);
    _solid(face, ring, footing, 14.4, 'wall');
    const holes = mazarCornerFields(d).filter(
      (h) => Math.hypot(...h.center.map((v, k) => v - p.center[k])) < p.radius + 0.1,
    );
    _shell(out, d, ring, 14.4, 17.3, d >= 2 ? holes : [], 'wall');
    cap(face, ring, 17.3, 'wall');
    for (const h of holes) {
      pane(face, h, d, d === 1 ? 0.035 : -0.2, 'glass');
      if (d >= 2) archBand(face, h, d, 0.15, 'trim');
    }
    crown(face, p.center, p.radius * 1.05, 17.3, 19.2, d);
    finial(face, p.center, 19.2, 20.1, d);
    if (d >= 2) {
      const e = edges(ring).find((e) => e.normal[1] > 0.8);
      if (e) {
        const h = field('corner-tall-panel', e.center, e.axis, e.normal, 1.2, 1.1, 11.8, 6.8, 0.6);
        pane(face, h, d, 0.035, 'panel');
        archBand(face, h, d, 0.18, 'trim', 0.065);
      }
    }
  }
}
export function mazarLanternFields(d) {
  if (d === 0) return [];
  return plans.minarets.flatMap((p) =>
    edges(circle(p.center, 0.64, 8))
      .filter((_, i) => d >= 2 || i % 2 === 0)
      .map((e) => ({
        ...field(`lantern-${p.name}`, e.center, e.axis, e.normal, 0.28, 22.35, 2.1, 1.5, 0.8),
        shape: 'rect',
        tower: p,
      })),
  );
}
function minarets(out, face, d) {
  const n = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 12 : 16;
  for (const p of plans.minarets) {
    profile(
      face,
      circle(p.center, p.radius, n),
      d === 0
        ? [
            [footing, 1],
            [22.2, 1.35],
          ]
        : [
            [footing, 1.3],
            [0.7, 1.3],
            [1.2, 1],
            [21.5, 1],
            [21.9, 1.35],
            [22.2, 1.35],
          ],
      'wall',
      p.center,
    );
    const r = circle(p.center, 0.64, d === 0 ? 4 : 8),
      hs = mazarLanternFields(d).filter((h) => h.tower === p);
    _shell(out, d, r, 22.2, 24.7, d >= 2 ? hs : [], 'dome');
    cap(face, r, 24.7, 'dome');
    if (d === 1) for (const h of hs) pane(face, h, d, 0.025, 'glass');
    if (d >= 2) {
      _solid(face, circle(p.center, 0.16, 8), 22.2, 24.7, 'glass');
    }
    crown(face, p.center, 0.85, 24.7, 26.9, d, true);
    finial(face, p.center, 26.9, 27.8, d);
  }
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
    face = writer(out, d);
  body(out, face, d);
  portals(out, face, d);
  domes(face, d);
  cornerTowers(out, face, d);
  minarets(out, face, d);
}
export const buildMazarSkyline = (o) => build(o, 0),
  buildMazarDistrict = (o) => build(o, 1),
  buildMazarStreet = (o) => build(o, 2),
  buildMazarCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const mazarStudy = {
  id: 'blue_mosque_mazar_i_sharif',
  key: 'blue_mosque',
  title: 'Blue Mosque (Mazar-i-Sharif)',
  category: 'mosque',
  wikidataId: 'Q138388',
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
    'Five existing shared256² mosaic,limestone,lime plaster,plain wood and cast bronze graphs;seven merged groups/eight authored roles with metric UVs and linear tints. Turquoise domes/light blue walls/blue blind fields reuse one mosaic graph;glazing is local blue-grey. Broad original pointed frames/diamonds and plain blue inscription bands replace fine tilework/text. Zero embedded pictures,unique atlases,baked lighting or copied calligraphy.',
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
    'Three inspected pictures guide two unequal pointed turquoise domes/tall drums,opposite projecting pointed portal pockets,selected slender minarets/slotted lanterns/striped onion crowns,octagonal capped corner turrets and two-tier pointed tiled facade rhythm. Main low roofs/raised room volumes are approximate and clipped to the mapped outline. Portal pockets close on blue wood doors/mosaic backs;facade/corner fields close on shallow backing and lantern slots look into small dark cores. No navigable rooms/stairs. Skyline retains both domes,portals and selected tower profiles;district uses flat facade/corner/lantern proxies and coarse crowns;near adds selected framed fields,abstract diamonds/trim and denser lantern slots. Intricate mosaic patterns/calligraphy,flags/loudspeakers,temporary objects,exact material/current finish,unseen roofs/rooms and exact thresholds/terrain joins unverified or omitted. Foreground clock tower and surrounding ranges/plaza/fences/garden remain separate context. All heights/doorway handedness and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('unequal-turquoise-domes', [36, 35, 44], [-1, 24, 0]),
    cam('projecting-pointed-portal', [-6, 15, 49], [-6, 13, 18]),
    cam('tiled-fields-and-blue-doors', [35, 9, 30], [21, 6, 15]),
    cam('octagonal-corner-head', [41, 23, 29], [26, 17, 12.8]),
    cam('slotted-lantern-and-onion-crown', [-9, 28, 29], [-10, 23, 17]),
    cam('mapped-connected-roof-plan', [0, 115, 0.1], [0, 10, 0]),
  ],
};

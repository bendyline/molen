/** Grand Mosque of Paris: six minarets,turquoise dome,petal collar and pointed gables. */
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
  if (h.shape === 'horseshoe') {
    const r = h.width / 2,
      ry = (h.height - h.spring) / 1.5,
      n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 10 : d === 3 ? 14 : 18,
      neck = Math.cos(Math.PI / 6) * r,
      cy = h.bottom + h.spring + ry * 0.5;
    return [
      [-neck, h.bottom],
      [neck, h.bottom],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const a = -Math.PI / 6 + ((i / n) * Math.PI * 4) / 3;
        return [r * Math.cos(a), cy + ry * Math.sin(a)];
      }),
    ];
  }
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
  '../../../content/worldgen/source/places/u0/u09/grand_mosque_of_paris/',
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
  wall: '#e8e4d3',
  trim: '#dfd7bf',
  paving: '#d5cdb8',
  roof: '#497c63',
  accent: '#76a99c',
  door: '#8d765d',
  glass: '#526775',
  gold: '#c7ac61',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, parisGround(...p) - 0.35);
export function parisGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Grand Mosque of Paris footing outside retained terrain');
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
function _down(face, r, y, slot, holes = []) {
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
const plans = rec.plans,
  whole = { outline: plans.outer, holes: plans.holes },
  court = plans.court,
  garden = plans.garden;
const rect = (x, z, w, h) => [
  [x - w / 2, z - h / 2],
  [x + w / 2, z - h / 2],
  [x + w / 2, z + h / 2],
  [x - w / 2, z + h / 2],
];
const tRing = plans.tower.polygons[0].outline,
  lRing = plans.lantern.polygons[0].outline,
  tipRing = plans.tip.polygons[0].outline;
const bbox = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
const mid = (r) => bbox(r).map(([a, b]) => (a + b) / 2),
  tc = mid(tRing),
  courtCenter = mid(court),
  gardenCenter = mid(garden);
const linear = (h) =>
  h
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const green = linear('#77956c'),
  leaf = linear('#517b58');
const rectOpening = (h) => ({ ...h, shape: 'rect' });
function closedBlock(face, p, b, t, slot = 'wall', roof = 'roof') {
  sides(face, p.outline, b, t, slot);
  for (const h of p.holes) sides(face, h, b, t, slot, true);
  cap(face, p.outline, t, roof, p.holes);
}
function flatRect(face, c, w, h, b, t, slot = 'trim') {
  closedBlock(face, { outline: rect(c[0], c[1], w, h), holes: [] }, b, t, slot, slot);
}
function lowBands(face, r, y, w = 0.18, slot = 'roof') {
  for (const e of edges(r)) {
    const n = e.normal,
      a = e.a.map((v, k) => v + n[k] * 0.05),
      b = e.b.map((v, k) => v + n[k] * 0.05),
      ring = [a, b, b.map((v, k) => v - n[k] * w), a.map((v, k) => v - n[k] * w)];
    closedBlock(face, { outline: ring, holes: [] }, y - 0.22, y, slot, slot);
  }
}
const gateEdge = edges(plans.outer)[plans.gateEdge];
export function parisGate() {
  return {
    ...field(
      'main-west-portal',
      gateEdge.center,
      gateEdge.axis,
      gateEdge.normal,
      3.8,
      0.7,
      5.2,
      2.35,
      3.8,
    ),
    shape: 'horseshoe',
    frameWidth: gateEdge.length,
    top: 7.9,
  };
}
export function parisArcades(d = 3) {
  if (d === 0) return [];
  return edges(court).flatMap((e, i) => {
    const n =
        d === 1 ? Math.max(2, Math.round(e.length / 6)) : Math.max(3, Math.round(e.length / 3.7)),
      step = e.length / n;
    return Array.from({ length: n }, (_, j) => ({
      ...field(
        `patio-${i}-${j}`,
        lerp(e.a, e.b, (j + 0.5) / n),
        e.axis,
        e.normal.map((v) => -v),
        step * 0.8,
        0.25,
        4.05,
        1.55,
        4.2,
      ),
      shape: 'horseshoe',
      edge: i,
      step,
      center: lerp(e.a, e.b, (j + 0.5) / n),
    }));
  });
}
export function parisWindows(d = 3) {
  if (d < 1) return [];
  return edges(plans.outer).flatMap((e, i) => {
    if (
      e.length < 5 ||
      i === plans.gateEdge ||
      (e.center[0] < tc[0] + 2 && e.center[1] < -34 && e.center[1] > -45)
    )
      return [];
    const n = Math.max(1, Math.floor(e.length / (d === 1 ? 8 : 5.8)));
    return Array.from({ length: n }, (_, j) => ({
      ...field(
        `outer-${i}-${j}`,
        lerp(e.a, e.b, (j + 0.5) / n),
        e.axis,
        e.normal,
        Math.min(1.3, (e.length / n) * 0.48),
        1.5,
        2.3,
        1.0,
        0.7,
      ),
      shape: 'round',
    }));
  });
}
export function parisTowerFields(d = 3) {
  if (d === 0) return [];
  return edges(tRing)
    .filter((e) => e.length > 3)
    .flatMap((e, i) => [
      {
        ...field(
          `tower-pattern-${i}`,
          e.center,
          e.axis,
          e.normal,
          e.length * 0.7,
          11.4,
          11.8,
          0,
          0.8,
        ),
        shape: 'rect',
      },
      ...[-1, 0, 1].map((s) => ({
        ...field(
          `tower-blind-${i}-${s}`,
          e.center.map((v, k) => v + e.axis[k] * s * e.length * 0.23),
          e.axis,
          e.normal,
          e.length * 0.18,
          7.2,
          3.2,
          1.4,
          0.8,
        ),
        shape: 'horseshoe',
      })),
    ]);
}
export function parisLanternFields(d = 3) {
  if (d === 0) return [];
  return edges(lRing).map((e, i) => ({
    ...field(`lantern-${i}`, e.center, e.axis, e.normal, e.length * 0.58, 27.4, 2.1, 0.8, 0.65),
    shape: 'horseshoe',
  }));
}
export function parisPrayerFields(d = 3) {
  if (!d) return [];
  const p = plans.parts.find((b) => b.id === 35184809860262).polygons[0].outline,
    e = edges(p)
      .filter((e) => e.length > 20)
      .sort((a, b) => b.normal[0] + b.normal[1] - (a.normal[0] + a.normal[1]))[0];
  return [-1, 0, 1].map((s) => ({
    ...field(
      `prayer-glazing-${s}`,
      e.center.map((v, k) => v + e.axis[k] * s * 4),
      e.axis,
      e.normal,
      1.8,
      6.4,
      4.5,
      2.2,
      0.8,
    ),
    shape: 'round',
  }));
}
function body(out, face, d) {
  const win = parisWindows(d),
    gate = parisGate(),
    cuts = [
      ...(d > 1 ? win.map((h) => prepareOpening(h, 0, d)) : []),
      prepareOpening(rectOpening({ ...gate, width: gate.width, height: gate.height }), 0, d),
    ];
  // Empty the two-metre aisle behind the mapped patio wall before installing true arcade bays.
  const box = bbox(court),
    aisle = {
      bounds: [
        [box[0][0] - 1.9, box[0][1] + 1.9],
        [floor, floor + 4.85],
        [box[1][0] - 1.9, box[1][1] + 1.9],
      ],
      planes: [
        [1, 0, 0, -(box[0][0] - 1.9)],
        [-1, 0, 0, box[0][1] + 1.9],
        [0, 0, 1, -(box[1][0] - 1.9)],
        [0, 0, -1, box[1][1] + 1.9],
        [0, 1, 0, -floor],
        [0, -1, 0, floor + 4.85],
      ],
    };
  const outer = writer(masked(out, [...cuts, ...(d ? [aisle] : [])]), d),
    ring = d === 0 ? _coarse(whole.outline) : whole.outline,
    holes = d === 0 ? whole.holes.map(_coarse) : whole.holes;
  sides(outer, ring, footing, 5, 'wall');
  for (const h of holes) sides(outer, h, footing, 5, 'wall', true);
  cap(outer, ring, 5, 'paving', holes);
  if (d)
    for (const h of win) {
      if (d > 1) reveal(face, h, d, 0.015, -0.36, 'trim');
      pane(face, h, d, d === 1 ? 0.025 : -0.37, 'glass');
    }
  if (d > 1) {
    lowBands(outer, ring, 5.02, 0.42);
    for (const h of holes) lowBands(outer, h, 5.02, 0.36);
  } else if (d === 1)
    for (const e of edges(ring).filter((e) => e.length > 8))
      outer(
        'roof',
        [at(e.a, 4.78), at(e.b, 4.78), at(e.b, 5), at(e.a, 5)],
        [e.normal[0], 0, e.normal[1]],
      );
}
function mappedParts(out, face, d) {
  const keep = new Set([
    35184809860262, 35184692102007, 35184809862555, 35184809862556, 35184809863129, 35184809865008,
    35184809865852, 35184809881864, 35184809862560, 35184809862561, 35184809862562, 35184809862563,
  ]);
  for (const b of plans.parts) {
    if (d === 0 && !keep.has(b.id)) continue;
    const top = b.properties.height,
      bottom = Math.max(5, b.properties.min_height ?? 0);
    if (top <= bottom) continue;
    for (const raw of b.polygons) {
      const p = { outline: d === 0 ? _coarse(raw.outline) : raw.outline, holes: raw.holes },
        round = raw.outline.length === 8 && [35184692102007, 35184809863129].includes(b.id);
      if (round) {
        const o = mid(p.outline),
          r = scaled(p.outline, 0.98),
          base = Math.max(bottom, top - 2.5),
          n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 16,
          rr = Math.min(...bbox(r).map(([a, b]) => (b - a) / 2));
        sides(face, r, bottom, base, 'wall');
        profile(
          face,
          circle(o, rr, n),
          [
            [base, 1],
            [top - 1.2, 0.88],
            [top - 0.3, 0.45],
            [top, 0.025],
          ],
          'roof',
          o,
        );
        continue;
      }
      const fields = b.id === 35184809860262 ? parisPrayerFields(d) : [],
        partFace =
          d > 1 && fields.length
            ? writer(
                masked(
                  out,
                  fields.map((h) => prepareOpening(h, 0, d)),
                ),
                d,
              )
            : face;
      const wallTop = top > 8 ? top - 1 : top - 0.3;
      closedBlock(partFace, p, bottom, wallTop, 'wall', 'roof');
      for (const h of fields) {
        if (d > 1) reveal(face, h, d, 0.015, -0.36, 'trim');
        pane(face, h, d, d === 1 ? 0.025 : -0.37, 'glass');
      }
      if (p.outline.length === 4 && top >= 11) {
        profile(
          face,
          p.outline,
          [
            [wallTop, 1],
            [top, 0.12],
          ],
          'roof',
          mid(p.outline),
        );
        cap(face, scaled(p.outline, 0.12), top, 'roof');
      } else {
        sides(face, p.outline, wallTop, top, 'wall');
        cap(face, p.outline, top, 'paving', p.holes);
        if (d > 1) lowBands(face, p.outline, top, 0.45);
      }
    }
  }
}
function merlons(face, r, b, t, d) {
  for (const e of edges(r).filter((e) => e.length > 0.8)) {
    const n = d === 0 ? 1 : d === 1 ? 3 : Math.max(3, Math.round(e.length / 1.25));
    for (let i = 0; i < n; i++) {
      const c = lerp(e.a, e.b, (i + 0.5) / n),
        w = (e.length / n) * 0.58,
        norm = e.normal,
        ring = [
          [-w / 2, -0.22],
          [w / 2, -0.22],
          [w / 2, 0.22],
          [-w / 2, 0.22],
        ].map(([u, v]) => c.map((x, k) => x + e.axis[k] * u + norm[k] * v));
      sides(face, ring, b, t - 0.22, 'trim');
      cap(face, ring, t - 0.22, 'trim');
      profile(
        face,
        ring,
        [
          [t - 0.22, 1],
          [t, 0.65],
        ],
        'trim',
        c,
      );
      cap(face, scaled(ring, 0.65), t, 'trim');
    }
  }
}
function lattice(face, h, d) {
  if (d < 2) return;
  const cols = d === 2 ? 2 : 3,
    rows = d === 2 ? 4 : 6,
    dx = h.width / cols,
    dy = h.height / rows,
    dep = -0.27,
    w = 0.18;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const u = -h.width / 2 + (col + 0.5) * dx,
        y = h.bottom + (row + 0.5) * dy,
        diamond = [
          [u - dx * 0.48, y],
          [u, y + dy * 0.48],
          [u + dx * 0.48, y],
          [u, y - dy * 0.48],
        ];
      for (let i = 0; i < 4; i++)
        beam(
          face,
          point(h, ...diamond[i], dep),
          point(h, ...diamond[(i + 1) % 4], dep),
          w,
          'trim',
          false,
        );
    }
}
function minaret(out, face, d) {
  const hs = parisTowerFields(d),
    r = d === 0 ? _coarse(tRing) : tRing,
    body = writer(
      masked(
        out,
        hs.map((h) => prepareOpening(rectOpening(h), 0, d)),
      ),
      d,
    );
  sides(body, r, 5, 24.5, 'trim');
  for (const h of hs) {
    const p = rectOpening(h);
    reveal(face, p, d, 0.015, -0.43, 'trim');
    pane((s, p, n) => face(s, p, n, linear('#bcb8a8')), p, d, -0.44, 'trim');
    if (h.name.includes('pattern')) lattice(face, h, d);
    else if (d > 1) {
      panel(face, h, d, h.width, 7.2, 10.4, 'trim', 0.03);
      reveal(face, h, d, 0.035, -0.4, 'trim');
      pane((s, p, n) => face(s, p, n, linear('#bcb8a8')), h, d, -0.42, 'trim');
    }
  }
  sides(face, r, 24.5, 24.8, 'trim');
  sides(face, r, 24.8, 26.1, 'accent');
  sides(face, r, 26.1, 26.3, 'trim');
  cap(face, r, 26.3, 'paving');
  merlons(face, r, 26.3, 27, d);
  closedBlock(face, { outline: lRing, holes: [] }, 26.3, 27, 'trim', 'trim');
  const ls = parisLanternFields(d),
    lantern = writer(
      masked(
        out,
        ls.map((h) => prepareOpening(rectOpening(h), 0, d)),
      ),
      d,
    );
  sides(lantern, lRing, 27, 30, 'trim');
  for (const h of ls) {
    panel(face, h, d, h.width, 27.4, 29.5, 'trim', 0.02);
    reveal(face, h, d, 0.025, -0.37, 'trim');
    pane(face, h, d, -0.39, 'door');
  }
  profile(
    face,
    lRing,
    [
      [30, 1.06],
      [31, 0.035],
    ],
    'roof',
    mid(lRing),
  );
  const p = mid(tipRing),
    n = d === 0 ? 4 : d === 1 ? 6 : 10;
  profile(
    face,
    circle(p, 0.08, n),
    [
      [31, 1],
      [33, 1],
    ],
    'gold',
    p,
  );
  cap(face, circle(p, 0.08, n), 33, 'gold');
  if (d)
    for (const [y, r] of [
      [31.35, 0.3],
      [31.9, 0.24],
      [32.4, 0.16],
    ])
      profile(
        face,
        circle(p, r, n),
        [
          [y - r, 0.04],
          [y - r * 0.7, 0.72],
          [y, 1],
          [y + r * 0.7, 0.72],
          [y + r, 0.04],
        ],
        'gold',
        p,
      );
}
function patio(face, d) {
  cap(face, court, 0.08, 'paving');
  if (!d) return;
  const hs = parisArcades(d);
  for (const h of hs) {
    const y0 = floor + 0.12,
      y1 = floor + 5;
    panel(face, h, d, h.step, 0.12, 5, 'wall', 0);
    reveal(face, h, d, 0.015, -1.8, 'trim');
    const ends = [-0.5, 0.5].map((v) =>
      h.center.map((x, k) => x + h.axis[k] * h.step * v - h.normal[k] * 0.12),
    );
    if (d > 1)
      for (const q of ends) {
        profile(
          face,
          circle(q, 0.16, 8),
          [
            [0.12, 1],
            [2, 0.85],
            [2.2, 1.25],
          ],
          'trim',
          q,
        );
      }
    face(
      'accent',
      [
        point(h, -h.step / 2, y0, -1.82),
        point(h, h.step / 2, y0, -1.82),
        point(h, h.step / 2, floor + 1.8, -1.82),
        point(h, -h.step / 2, floor + 1.8, -1.82),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
    face(
      'wall',
      [
        point(h, -h.step / 2, floor + 1.8, -1.83),
        point(h, h.step / 2, floor + 1.8, -1.83),
        point(h, h.step / 2, y1, -1.83),
        point(h, -h.step / 2, y1, -1.83),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
    face(
      'roof',
      [
        point(h, -h.step / 2, y1, -1.9),
        point(h, h.step / 2, y1, -1.9),
        point(h, h.step / 2, y1, 0.25),
        point(h, -h.step / 2, y1, 0.25),
      ],
      [0, -1, 0],
    );
    face(
      'door',
      [
        point(h, -h.step / 2, floor + 4.65, 0.015),
        point(h, h.step / 2, floor + 4.65, 0.015),
        point(h, h.step / 2, y1, 0.015),
        point(h, -h.step / 2, y1, 0.015),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
  basin(face, courtCenter, 1.35, d, 0.08);
}
function basin(face, p, r, d, y = 0) {
  const n = d === 0 ? 6 : d === 1 ? 8 : 16;
  profile(
    face,
    circle(p, r, n),
    [
      [y, 0.58],
      [y + 0.18, 0.58],
      [y + 0.3, 0.75],
      [y + 0.64, 1],
    ],
    'trim',
    p,
  );
  cap(face, circle(p, r * 0.88, n), y + 0.51, 'glass');
}
function gardens(face, d) {
  cap(face, garden, 0.06, 'paving');
  if (!d) return;
  for (const s of [-1, 1])
    for (const z of [-1, 1]) {
      const p = [gardenCenter[0] + s * 9, gardenCenter[1] + z * 5.5],
        r = rect(...p, 11.5, 6.5);
      face(
        'wall',
        r.map((p) => at(p, 0.11)),
        [0, 1, 0],
        green,
      );
      if (d > 1)
        for (const sx of [-1, 1]) {
          const q = [p[0] + sx * 3, p[1]],
            n = d === 2 ? 6 : 8;
          profile(
            (slot, p, norm) => face(slot, p, norm, leaf),
            circle(q, 0.85, n),
            [
              [0.11, 1],
              [2.5, 0.65],
              [3.8, 0.05],
            ],
            'wall',
            q,
          );
        }
    }
  const p = [gardenCenter[0], gardenCenter[1]],
    r = rect(...p, 4.8, 1.8);
  sides(face, r, 0.08, 0.35, 'trim');
  cap(face, r, 0.35, 'trim', [rect(...p, 4.3, 1.3)]);
  cap(face, rect(...p, 4.3, 1.3), 0.24, 'glass');
}
function portal(face, d) {
  const h = parisGate(),
    front = 0.06,
    back = -1.8;
  panel(face, h, d, h.frameWidth, 0.05, h.top, 'trim', front);
  reveal(face, h, d, front, back, 'trim');
  pane(face, h, d, back - 0.02, 'door');
  // A rectangular cutter in the low shell is closed by this genuine horseshoe facade.
  for (const s of [-1, 1]) {
    const q = h.center.map((v, k) => v + h.axis[k] * s * (h.frameWidth / 2 - 0.5));
    flatRect(face, q, 0.6, 0.6, 0, 7.9, 'trim');
  }
  const rr = [
    point(h, -h.frameWidth / 2, 0, front),
    point(h, h.frameWidth / 2, 0, front),
    point(h, h.frameWidth / 2, 0, -1.9),
    point(h, -h.frameWidth / 2, 0, -1.9),
  ].map((p) => [p[0], p[2]]);
  cap(face, rr, 7.9, 'paving');
  lowBands(face, rr, 7.6, 0.28, 'accent');
  if (d) merlons(face, rr, 7.9, 8.3, d);
  if (d) {
    archBand(face, h, d, 0.5, 'trim', 0.11);
    const sign = point(h, 0, floor + 8.6, 0.02),
      q = [sign[0], sign[2]];
    profile(
      face,
      circle(q, 0.06, 6),
      [
        [8.1, 1],
        [10, 1],
      ],
      'gold',
      q,
    );
    // Broad original crescent and outlined star avoid copying the carved portal artwork.
    const R = 0.7,
      r = 0.48,
      n = d === 1 ? 6 : 12,
      outer = Array.from({ length: n + 1 }, (_, i) => {
        const a = Math.PI * 0.36 + (i / n) * Math.PI * 1.28;
        return point(h, R * Math.cos(a), floor + 9.25 + R * Math.sin(a), 0.08);
      }),
      inner = Array.from({ length: n + 1 }, (_, i) => {
        const a = Math.PI * 0.36 + (i / n) * Math.PI * 1.28;
        return point(h, 0.2 + r * Math.cos(a), floor + 9.25 + r * Math.sin(a), 0.08);
      });
    for (let i = 0; i < n; i++)
      face('gold', [outer[i], outer[i + 1], inner[i + 1], inner[i]], [h.normal[0], 0, h.normal[1]]);
    const star = Array.from({ length: 10 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        R = i % 2 ? 0.21 : 0.45;
      return point(h, 0.55 + R * Math.cos(a), floor + 9.25 - R * Math.sin(a), 0.08);
    });
    for (let i = 0; i < 10; i++) beam(face, star[i], star[(i + 1) % 10], 0.11, 'gold', false);
  }
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((v) => v.map(Math.fround));
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
  mappedParts(out, face, d);
  minaret(out, face, d);
  patio(face, d);
  gardens(face, d);
  portal(face, d);
}
export const buildParisSkyline = (o) => build(o, 0),
  buildParisDistrict = (o) => build(o, 1),
  buildParisStreet = (o) => build(o, 2),
  buildParisCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 46 });
export const parisMosqueStudy = {
  id: 'grand_mosque_of_paris',
  key: 'grand_mosque_of_paris',
  title: 'Grand Mosque of Paris',
  category: 'mosque',
  wikidataId: 'Q392564',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared256² lime plaster,limestone,ceramic roof,mosaic,wood and bronze graphs;eight merged material groups. Cream walls,green roof edges/mosaic and sparse gold use metric UVs/linear tints. Lower courts and selected planted beds reuse existing groups with vertex tints. No embedded images,baked lighting/weathering or copied inscriptions/carving.',
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
    'Named-POI/location/picture identity only;current building controls do not carry exact Q392564. All raw component plans/properties retained. Garden beds/cypresses,selected windows,roof profiles,gate/arcade positions,lattice/merlon counts and heights are working picture estimates. Skyline simplifies plan jogs,omits tiny overlapping ancillary parts,trees,podium windows/lattice,uses solid courtyard walls and pointed silhouette proxies. District opens coarse true patio bays/recessed tower panels;near levels add selected columns,lattice,blind arches and windows. Arcade aisles close on tiled back walls;glazing/gate close before interiors. Temporary transparent2016 patio canopy omitted;current cover state unverified. Fine inscriptions,carving,exact garden planting/waterworks,unpictured ancillary/bath roofs,interiors,exact thresholds/ramps/terrain contacts,walking,engineering and physical-device timing unverified or omitted. Surrounding streets and independent neighbouring buildings remain host content.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('square-minaret-and-garden', [-58, 42, -80], [4, 16, -45]),
    cam('recessed-minaret-lattice', [-32, 25, -48], [tc[0], 19, tc[1]]),
    cam('horseshoe-west-portal', [-43, 12, -26], [gateEdge.center[0], 6, gateEdge.center[1]]),
    cam(
      'white-patio-arcades',
      [courtCenter[0] + 14, 20, courtCenter[1] + 20],
      [courtCenter[0], 2.5, courtCenter[1]],
    ),
    cam('prayer-roof-and-street', [65, 29, 45], [13, 10, 8]),
    cam('mapped-complex-and-seven-voids', [10, 205, -18], [8, 2, -18]),
  ],
};

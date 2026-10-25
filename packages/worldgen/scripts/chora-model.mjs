/** Chora: mapped domes/apses,buttress,curved chapel gables and southwest minaret. */
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
  '../../../content/worldgen/source/places/sx/sxk/chora_church/',
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
  wall: '#d3c6b0',
  brick: '#bda18b',
  trim: '#e3ddcf',
  roof: '#8c9da8',
  plaster: '#dedbd2',
  door: '#9f866a',
  gold: '#c8b788',
  glass: '#63768b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, choraGround(...p) - 0.35);
export function choraGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Chora Church footing outside retained terrain');
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
const roundField = (...a) => ({ ...field(...a), shape: 'round' });
export function choraFacadeFields(d) {
  if (d === 0) return [];
  const result = [];
  for (const e of edges(plans.outer)) {
    if (e.length < 1.65 || (e.center[0] < -12 && e.center[1] > 10)) continue;
    if (e.center[1] > 13 && e.center[0] > -12 && e.center[0] < 11) {
      for (let i = 0; i < plans.chapelBays.length - 1; i++) {
        const x = (plans.chapelBays[i] + plans.chapelBays[i + 1]) / 2,
          t = (x - e.a[0]) / (e.b[0] - e.a[0]);
        if (t < 0 || t > 1) continue;
        result.push({
          ...roundField(
            `chapel-gable-${i}`,
            lerp(e.a, e.b, t),
            e.axis,
            e.normal,
            1.65,
            4.1,
            3.5,
            2.1,
            1.0,
          ),
          kind: 'glass',
        });
      }
      continue;
    }
    const main = e.center[0] > 10 && e.center[0] < 14 && e.center[1] > -8 && e.center[1] < 3;
    const n = main ? 1 : Math.max(1, Math.floor(e.length / 4.6));
    for (let i = 0; i < n; i++) {
      const center = lerp(e.a, e.b, (i + 0.5) / n);
      if (center[0] > 13.5 || (center[0] < -17 && Math.abs(center[1]) < 3.5)) continue;
      result.push({
        ...roundField(
          `outer-window-${result.length}`,
          center,
          e.axis,
          e.normal,
          Math.min((e.length / n) * 0.5, main ? 1.2 : 1.45),
          main ? 3.5 : 2.6,
          main ? 4.1 : 3.0,
          main ? 3 : 2.1,
          0.85,
        ),
        kind: 'glass',
      });
      if (main && d >= 1)
        result.push({
          ...roundField(
            `apse-blind-${result.length}`,
            center,
            e.axis,
            e.normal,
            Math.min(e.length * 0.5, 1.2),
            8.2,
            2.0,
            1.2,
            0.7,
          ),
          kind: 'wall',
        });
    }
  }
  return result;
}
export function choraDoor() {
  const e = edges(plans.outer).find((e) => e.length > 28 && e.center[0] < -15);
  return {
    ...roundField('estimated-western-door', e.center, e.axis, e.normal, 2.5, 0.15, 4.4, 3.0, 1.15),
    kind: 'door',
  };
}
const shortened = (r, d) => (d === 0 && r.length === 16 ? r.filter((_, i) => i % 2 === 0) : r);
export function choraDrumFields(d) {
  if (d === 0) return [];
  return plans.domes.flatMap((p) =>
    edges(shortened(p.ring, d)).map((e, i) => ({
      ...roundField(
        `${p.name}-drum-${i}`,
        e.center,
        e.axis,
        e.normal,
        Math.min(e.length * 0.6, p.name === 'main-naos' ? 0.9 : 0.58),
        p.base + 0.3,
        p.drum - p.base - 0.52,
        p.drum - p.base - 0.9,
        0.75,
      ),
      kind: 'glass',
      dome: p.name,
    })),
  );
}
function framedBacking(face, h, d) {
  pane(face, h, d, d === 1 ? 0.025 : -0.24, h.kind);
  if (d >= 2) {
    archBand(face, h, d, 0.15, h.kind === 'wall' ? 'brick' : 'trim', 0.035);
  }
  if (d < 2 || h.kind !== 'glass') return;
  const depth = -0.205,
    b = h.bottom + 0.12,
    t = h.bottom + h.spring - 0.1,
    w = h.width * 0.78,
    n = h.width > 1 ? 3 : 2;
  for (let k = 1; k < n; k++) {
    const u = -w / 2 + (w * k) / n;
    beam(face, point(h, u, b, depth), point(h, u, t, depth), 0.055, 'trim');
  }
  const rows = d >= 3 ? 4 : 2;
  for (let j = 1; j < rows; j++) {
    const y = b + ((t - b) * j) / rows;
    beam(face, point(h, -w / 2, y, depth), point(h, w / 2, y, depth), 0.055, 'trim');
  }
}
const chapelY = (x) => {
  if (x >= 10.75) return 8.3;
  const i = plans.chapelBays.findIndex(
    (v, i, a) => i < a.length - 1 && x >= v - 1e-5 && x <= a[i + 1] + 1e-5,
  );
  if (i < 0) return 7.2;
  const t = (x - plans.chapelBays[i]) / (plans.chapelBays[i + 1] - plans.chapelBays[i]);
  return 7.2 + 2 * Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
};
function splitRing(r, xs) {
  const result = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      dx = b[0] - a[0],
      ts = [0];
    if (Math.abs(dx) > 1e-8)
      for (const x of xs) {
        const t = (x - a[0]) / dx;
        if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
      }
    for (const t of ts.sort((a, b) => a - b)) result.push(lerp(a, b, t));
  }
  return result;
}
function band(face, r, y, height = 0.2, slot = 'brick') {
  sides(face, scaled(r, 1.001), y, y + height, slot);
}
function body(out, face, d) {
  const fields = choraFacadeFields(d),
    door = choraDoor(),
    holes = [door, ...(d >= 2 ? fields : [])],
    prepared = holes.map((h) => prepareOpening(h, 0, d)),
    mf = writer(masked(out, prepared), d);
  sides(face, plans.outer, footing, 0, 'wall');
  sides(mf, plans.outer, 0, 7.2, 'wall');
  for (const p of plans.main) sides(mf, p.outline, 7.2, 11.4, 'wall');
  const tier = plans.chapelRoofTiers[d];
  for (const p of plans.south)
    sides(mf, splitRing(p.outline, tier.xs), 7.2, (q) => floor + chapelY(q[0]), 'wall');
  for (const p of plans.lowRoof) cap(face, p.outline, 7.2, 'roof', p.holes);
  const main = plans.domes.find((d) => d.name === 'main-naos'),
    near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-5;
  for (const p of plans.mainRoof)
    cap(
      face,
      p.outline,
      (q) => floor + (main.ring.some((v) => near(v, q)) ? 14 : 11.4),
      'roof',
      p.holes,
    );
  for (const p of tier.polygons)
    cap(face, p.outline, (q) => floor + chapelY(q[0]), 'roof', p.holes);
  // Every recess has one masonry reveal and a closed backing,including the estimated door.
  for (const h of [door, ...fields]) {
    if (d >= 2 || h === door) _reveal(face, h, d, 0, -0.26, h.kind === 'wall' ? 'wall' : 'trim');
    if (h === door) pane(face, h, d, -0.24, 'door');
    else framedBacking(face, h, d);
  }
  if (d >= 2) {
    for (const y of [1.05, 3.15, 5.85]) band(mf, plans.outer, y);
    for (const p of plans.main) for (const y of [8.8, 10.7]) band(mf, p.outline, y);
  }
}
function domeProfiles(face, p, d) {
  const r = shortened(p.ring, d),
    n = [2, 3, 5, 6, 8][d],
    levels = Array.from({ length: n + 1 }, (_, i) => {
      const a = ((i / n) * Math.PI) / 2;
      return [p.drum + (p.crown - p.drum) * Math.sin(a), Math.cos(a)];
    });
  profile(face, r, levels, 'roof', p.center);
  if (d >= 1) {
    band(face, r, p.drum - 0.18, 0.18, 'trim');
    profile(
      face,
      circle(p.center, 0.1, d === 1 ? 4 : 8),
      [
        [p.crown, 0.25],
        [p.crown + 0.12, 1],
        [p.finial, 0.02],
      ],
      'gold',
      p.center,
    );
  }
}
function domes(out, face, d) {
  const fields = choraDrumFields(d);
  for (const p of plans.domes) {
    const r = shortened(p.ring, d),
      hs = fields.filter((h) => h.dome === p.name),
      mf = writer(masked(out, d >= 2 ? hs.map((h) => prepareOpening(h, 0, d)) : []), d);
    sides(mf, r, p.base, p.drum, 'wall');
    for (const h of hs) {
      if (d >= 2) _reveal(face, h, d, 0, -0.26, 'trim');
      framedBacking(face, h, d);
    }
    domeProfiles(face, p, d);
  }
}
function minaret(face, d) {
  const p = plans.minaret,
    n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 16;
  _solid(face, p.ring, 7.2, p.base, 'wall');
  profile(
    face,
    circle(p.center, p.radius, n),
    [
      [p.base, 0.9],
      [20.8, 1],
      [21, 1.13],
      [21.2, 1.45],
      [21.6, 1.85],
      [22.4, 1.85],
      [22.55, 0.9],
      [25.6, 0.82],
    ],
    'plaster',
    p.center,
  );
  profile(
    face,
    circle(p.center, p.coneRadius, n),
    [
      [25.6, 1],
      [31.1, 0.02],
    ],
    'roof',
    p.center,
  );
  profile(
    face,
    circle(p.center, 0.12, d === 0 ? 4 : 8),
    [
      [31.1, 0.1],
      [31.32, 1],
      [31.5, 0.6],
      [31.7, 0],
    ],
    'gold',
    p.center,
  );
  if (d >= 2)
    for (let i = 0; i < 8; i++) {
      const a = (i * 2 * Math.PI) / 8,
        u = [Math.cos(a), Math.sin(a)],
        h = {
          center: p.center.map((v, k) => v + u[k] * (p.radius * 1.85 + 0.012)),
          axis: [-u[1], u[0]],
          normal: u,
        };
      _panel(
        face,
        { ...roundField(`balcony-${i}`, h.center, h.axis, h.normal, 0.4, 21.68, 0.45, 0.2, 0.2) },
        d,
        0.5,
        21.65,
        22.32,
        'trim',
        0.015,
      );
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
  domes(out, face, d);
  minaret(face, d);
}
export const buildChoraSkyline = (o) => build(o, 0),
  buildChoraDistrict = (o) => build(o, 1),
  buildChoraStreet = (o) => build(o, 2),
  buildChoraCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const choraStudy = {
  id: 'chora_church',
  key: 'chora_church',
  title: 'Chora Church',
  category: 'mosque',
  wikidataId: 'Q849489',
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
    'Six existing shared256² limestone,brick,standing-seam metal,lime plaster,plain wood and bronze graphs. Eight merged material groups with metric UVs/linear tints;local blue-grey glazing. Pale masonry and original brick/arch bands abstract the pictured fabric. No embedded images,unique texture atlas,baked light,photographic art or copied mosaics.',
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
    'Individual medium-fi exterior. Four circular map roof boundaries are interpreted as domed roofs;no open courtyard or interior is invented. Main apse/buttress and chapel gables follow the asymmetric map and three southeast/east pictures. Western entrance/northern facade,roof subdivisions,exact stone/brick counts,window layouts,current finish and heights remain estimates. Windows/blind fields close on shallow backing. No navigable interiors,mosaics,terrace/doorway engineering or walking verification. Thin frame/brick bands disappear at distance;skyline retains four domes,eastern apse/buttress and southwest minaret. Physical-device timing remains unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('eastern-apse-and-buttress', [35, 16, -8], [12, 9, -2]),
    cam('chapel-curved-gables', [9, 13, 36], [0, 7, 13.8]),
    cam('windowed-main-drum', [19, 24, 10], [4, 18, -1.4]),
    cam('southwest-minaret-balcony', [-5, 29, 25], [-15.4, 25, 13.8]),
    cam('estimated-western-door', [-38, 7, 0], [-18.2, 5, 0]),
    cam('mapped-four-dome-roof-plan', [0, 100, 0.1], [0, 8, 0]),
  ],
};

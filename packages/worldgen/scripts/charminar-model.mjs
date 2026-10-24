/** Charminar: four-way crossing arch, stacked galleries and four minarets. */
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
  '../../../content/worldgen/source/places/te/tep/charminar/',
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
  wall: '#dfd0b7',
  trim: '#e5d6bb',
  roof: '#c7bdac',
  metal: '#98845f',
  glass: '#52636b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, charminarGround(...p) - 0.35);
export function charminarGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Charminar footing outside retained terrain');
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
const plans = rec.plans;
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
  const points = [...r, ...holes.flat()],
    starts = [];
  let n = r.length;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(points.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, -1, 0],
    );
}
function slab(face, r, y, h, slot, holes = []) {
  sides(face, r, y, y + h, slot);
  cap(face, r, y + h, slot, holes);
  down(face, r, y, slot, holes);
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
export function charminarCrossings() {
  return [
    field('north-south-crossing', [0, 0], [1, 0], [0, -1], 12.0, 0.05, 17.3, 10.4, 36),
    field('east-west-crossing', [0, 0], [0, 1], [1, 0], 12.0, 0.05, 17.3, 10.4, 36),
  ];
}
const facades = edges(plans.upper).filter((e) => e.length > 15);
export function charminarGalleryFields(d = 3) {
  if (d === 0) return [];
  const n = d === 1 ? 3 : d === 2 ? 5 : 7,
    fields = [];
  for (const [i, e] of facades.entries())
    for (let j = 0; j < n; j++) {
      if (j === Math.floor(n / 2)) continue;
      const span = e.length - 2.8,
        p = lerp(e.a, e.b, (1.4 + ((j + 0.5) * span) / n) / e.length);
      fields.push({
        ...field(
          `main-gallery-${i}-${j}`,
          p,
          e.axis,
          e.normal,
          (span / n) * 0.67,
          19.65,
          3.85,
          2.6,
          4.5,
        ),
        step: e.length / n,
        edge: i,
      });
    }
  return fields;
}
export function charminarClosedFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const [i, e] of facades.entries()) {
    for (const side of [-1, 1])
      for (let tier = 0; tier < 2; tier++) {
        const p = e.center.map((v, k) => v + e.axis[k] * side * 8.05);
        fields.push(
          field(
            `lower-field-${i}-${side}-${tier}`,
            p,
            e.axis,
            e.normal,
            1.55,
            4.3 + tier * 6,
            3.2,
            2.0,
            1.2,
          ),
        );
      }
    for (let j = 0; j < (d === 1 ? 5 : d === 2 ? 7 : 9); j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / (d === 1 ? 5 : d === 2 ? 7 : 9));
      fields.push(
        field(
          `clerestory-${i}-${j}`,
          p,
          e.axis,
          e.normal,
          d === 1 ? 1.5 : 1.15,
          25.45,
          2.5,
          1.65,
          1.1,
        ),
      );
    }
  }
  return fields;
}
const stageDefs = [
  [19.5, 21.6, 2.95],
  [22.3, 24.4, 2.95],
  [34.5, 37.1, 2.7],
  [44, 46.7, 2.3],
];
function towerStageFields(p, d, stage, b, t, R) {
  const n = d === 1 ? 6 : d === 2 ? 8 : d === 3 ? 12 : 16,
    r = circle(p.center, R, n);
  return edges(r).map((e, i) => ({
    ...field(
      `tower-${p.id}-${stage}-${i}`,
      e.center,
      e.axis,
      e.normal,
      e.length * 0.68,
      b + 0.24,
      t - b - 0.45,
      (t - b - 0.45) * 0.6,
      0.46,
    ),
    shape: d === 1 ? 'rect' : 'pointed',
    edge: e,
    stage,
    top: t,
    bottomLevel: b,
    R,
  }));
}
export function charminarTowerFields(d = 3) {
  if (d === 0) return [];
  return plans.towers.flatMap((p) =>
    stageDefs.flatMap(([b, t, R], i) => towerStageFields(p, d, i, b, t, R)),
  );
}
function openStage(face, p, d, stage, b, t, R) {
  const n = d === 1 ? 6 : d === 2 ? 8 : d === 3 ? 12 : 16,
    r = circle(p.center, R, n),
    inner = circle(p.center, R - 0.4, n);
  if (d === 1) {
    for (const q of circle(p.center, R, 4)) beam(face, at(q, b), at(q, t), 0.32, 'wall', false);
    cap(face, r, b, 'trim', [inner]);
    sides(face, r, t, t + 0.22, 'trim');
    cap(face, r, t + 0.22, 'trim', [inner]);
    down(face, r, t, 'trim', [inner]);
    return;
  }
  for (const h of towerStageFields(p, d, stage, b, t, R)) {
    panel(face, h, d, h.edge.length, b, t, 'wall');
    const back = { ...h, normal: h.normal.map((v) => -v) };
    panel(face, back, d, h.edge.length, b, t, 'wall', 0.4);
    reveal(face, h, d, 0, -0.4, 'trim');
    if (d > 2) archBand(face, h, d, 0.12, 'trim', 0.03);
  }
  slab(face, r, b - 0.3, 0.3, 'trim', [inner]);
  slab(face, r, t, 0.22, 'trim', [inner]);
}
function tower(face, p, d) {
  const n = d === 0 ? 6 : d === 1 ? 6 : d === 2 ? 12 : d === 3 ? 16 : 20,
    r = circle(p.center, p.radius, n);
  if (d === 0) {
    profile(
      face,
      r,
      [
        [19, 1.35],
        [24.5, 1.35],
        [24.6, 0.85],
        [34, 0.85],
        [34.3, 1.25],
        [37.2, 1.25],
        [37.3, 0.68],
        [44, 0.68],
        [44.3, 1.05],
        [47, 1.05],
        [50.4, 0.7],
        [52.2, 0.03],
      ],
      'wall',
      p.center,
    );
  } else {
    profile(
      face,
      r,
      [
        [0, 1],
        [18.6, 1],
        [19.15, 1.32],
        [19.5, 1.43],
      ],
      'wall',
      p.center,
    );
    profile(
      face,
      r,
      [
        [19.5, 0.78],
        [24.6, 0.78],
        [25, 0.88],
        [33.8, 0.88],
        [34.2, 1.22],
        [34.5, 1.31],
      ],
      'wall',
      p.center,
    );
    profile(
      face,
      r,
      [
        [34.5, 0.65],
        [37.4, 0.65],
        [37.7, 0.73],
        [43.4, 0.73],
        [43.8, 1.0],
        [44, 1.12],
      ],
      'wall',
      p.center,
    );
    profile(
      face,
      r,
      [
        [44, 0.55],
        [46.9, 0.55],
        [47.3, 0.65],
        [49.1, 0.65],
      ],
      'wall',
      p.center,
    );
    for (const [i, [b, t, R]] of stageDefs.entries()) openStage(face, p, d, i, b, t, R);
    profile(
      face,
      circle(p.center, 1.45, n),
      [
        [49.1, 0.92],
        [49.8, 1.1],
        [50.6, 1.03],
        [51.5, 0.72],
        [52.2, 0.06],
      ],
      'trim',
      p.center,
    );
    if (d > 2)
      for (const [b, , R] of stageDefs)
        for (let i = 0; i < n; i++) {
          const a = ((i + 0.5) * 2 * Math.PI) / n,
            q = p.center.map((v, k) => v + [Math.cos(a), Math.sin(a)][k] * R * 0.88),
            u = p.center.map((v, k) => v + [Math.cos(a), Math.sin(a)][k] * R * 0.68);
          beam(face, at(u, b - 0.9), at(q, b - 0.25), d === 2 ? 0.26 : 0.2, 'trim');
        }
  }
  profile(
    face,
    circle(p.center, d === 0 ? 0.16 : 0.2, 4),
    [
      [52.2, 1],
      [52.6, 1.4],
      [53, 0.03],
    ],
    'metal',
    p.center,
  );
}
function clock(face, e, d) {
  const h = {
    center: e.center,
    axis: e.axis,
    normal: e.normal,
    width: 1.45,
    height: 1.45,
    bottom: floor + 20.85,
    shape: d === 0 ? 'rect' : 'circle',
    depth: 0.6,
  };
  pane(face, h, d, 0.05, 'glass');
  if (d > 0) archBand(face, h, d, 0.16, 'trim', 0.075);
  if (d > 1) {
    const origin = point(h, 0, floor + 21.575, 0.1);
    beam(face, origin, point(h, 0.36, floor + 21.75, 0.1), 0.1, 'trim');
    beam(face, origin, point(h, 0, floor + 22.13, 0.1), 0.1, 'trim');
    for (let j = 0; j < 12; j++) {
      const a = (j * Math.PI) / 6;
      beam(
        face,
        point(h, Math.sin(a) * 0.5, floor + 21.575 + Math.cos(a) * 0.5, 0.09),
        point(h, Math.sin(a) * 0.61, floor + 21.575 + Math.cos(a) * 0.61, 0.09),
        0.07,
        'trim',
      );
    }
  }
}
function cupola(face, d) {
  const p = plans.cupola,
    n = d === 0 ? 6 : d === 1 ? 8 : 12,
    r = circle(p.center, p.radius, n);
  if (d === 0)
    profile(
      face,
      r,
      [
        [30.1, 1],
        [33.1, 1],
        [34.8, 1.15],
        [36.4, 0.05],
      ],
      'wall',
      p.center,
    );
  else {
    openStage(face, { id: 'cupola', center: p.center }, d, 'cupola', 30.1, 32.8, 1.6);
    profile(
      face,
      r,
      [
        [32.8, 1],
        [33.3, 1.1],
        [34.1, 1.18],
        [35.3, 0.83],
        [36.4, 0.05],
      ],
      'trim',
      p.center,
    );
  }
  profile(
    face,
    circle(p.center, 0.1, 4),
    [
      [36.4, 1],
      [36.7, 1.5],
      [37, 0.02],
    ],
    'metal',
    p.center,
  );
}
function parapet(face, d) {
  const r = plans.upper,
    inner = scaled(r, 0.96);
  sides(face, r, 29, 30.1, 'wall');
  sides(face, inner, 29, 30.1, 'wall', true);
  cap(face, r, 30.1, 'trim', [inner]);
  if (d > 1)
    for (const e of facades) {
      const n = d === 2 ? 7 : 9;
      for (let j = 0; j < n; j++) {
        const p = lerp(e.a, e.b, (j + 0.5) / n),
          h = {
            ...field(
              'parapet-field',
              p,
              e.axis,
              e.normal,
              (e.length / n) * 0.6,
              29.2,
              0.65,
              0.4,
              0.5,
            ),
            shape: 'rect',
          };
        pane(face, h, d, 0.035, 'glass');
        if (d > 2) {
          beam(
            face,
            point(h, -h.width * 0.4, floor + 29.25, 0.07),
            point(h, h.width * 0.4, floor + 29.8, 0.07),
            0.12,
            'trim',
          );
          beam(
            face,
            point(h, h.width * 0.4, floor + 29.25, 0.07),
            point(h, -h.width * 0.4, floor + 29.8, 0.07),
            0.12,
            'trim',
          );
        }
      }
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
    face = writer(out, d),
    crossings = charminarCrossings(),
    closed = charminarClosedFields(d),
    lower = d > 2 ? closed.filter((h) => h.name.startsWith('lower')) : [],
    upper = d > 1 ? closed.filter((h) => h.name.startsWith('clere')) : [];
  const outer = d === 0 ? _coarse(plans.outer) : plans.outer;
  sides(face, outer, footing, 0, 'roof');
  cap(face, outer, 0, 'roof');
  shell(out, d, outer, 0, 19, [...crossings, ...lower], 'wall');
  cap(face, outer, 19, 'roof');
  if (d === 0) {
    solid(face, plans.upper, 19, 29, 'wall');
    for (const e of facades)
      for (const u of [-0.3, 0.3]) {
        const h = field(
          'far-gallery-field',
          e.center.map((v, k) => v + e.axis[k] * u * e.length),
          e.axis,
          e.normal,
          3.6,
          19.6,
          3.9,
          2.7,
          1,
        );
        pane(face, h, d, 0.035, 'glass');
      }
  } else {
    shell(
      out,
      d,
      plans.upper,
      19,
      24,
      charminarGalleryFields(d),
      'wall',
      scaled(plans.upper, 0.82),
    );
    slab(face, plans.upper, 24, 1, 'trim');
    shell(out, d, plans.upper, 25, 29, upper, 'wall');
    cap(face, plans.upper, 29, 'roof');
    for (const h of closed) {
      if (d === 1 && h.name.startsWith('lower')) continue;
      pane(face, h, d, (h.name.startsWith('lower') && d < 3) || d === 1 ? 0.035 : -0.25);
      if (d > 1) archBand(face, h, d, 0.18, 'trim', 0.04);
    }
    for (const h of charminarGalleryFields(d)) if (d > 1) archBand(face, h, d, 0.16, 'trim', 0.035);
  }
  for (const e of facades) {
    const h = { ...field('grand-arch', e.center, e.axis, e.normal, 12, 0.05, 17.3, 10.4, 36) };
    if (d > 0) archBand(face, h, d, 0.42, 'trim', 0.04);
    clock(face, e, d);
    if (d > 1) {
      const n = d === 2 ? 8 : 12;
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n),
          q = p.map((v, k) => v + e.normal[k] * 0.65);
        beam(face, at(p, 18.1), at(q, 19.0), 0.24, 'trim');
      }
      for (const s of [-1, 1]) {
        const h = {
          ...field(
            'round-medallion',
            e.center.map((v, k) => v + e.axis[k] * s * 4),
            e.axis,
            e.normal,
            1.1,
            16.8,
            1.1,
            0.5,
            0.5,
          ),
          shape: 'circle',
        };
        pane(face, h, d, 0.04, 'trim');
      }
    }
  }
  parapet(face, d);
  for (const p of plans.towers) tower(face, p, d);
  cupola(face, d);
}
export const buildCharminarSkyline = (o) => build(o, 0),
  buildCharminarDistrict = (o) => build(o, 1),
  buildCharminarStreet = (o) => build(o, 2),
  buildCharminarCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const charminarStudy = {
  id: 'charminar',
  key: 'charminar',
  title: 'Charminar',
  category: 'mosque',
  wikidataId: 'Q1771696',
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
    'Four existing shared256² lime-plaster,limestone,sandstone and cast-bronze graphs;five merged groups. Pale stucco/wall,cream trim,sandstone paving/roof and sparse bronze finials;glass local. Metric UVs/linear tints,no embedded images,baked lighting,weathering or copied stucco art.',
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
    'Individual medium-fi exterior from four inspected2012/2013/2026 photographs. Four crossing arches,stacked minaret galleries/caps,open first facade gallery,closed clerestory/side fields,four clock faces,sparse brackets/parapet lattice and western roof cupola. Skyline uses solid minaret balcony bands and closed gallery proxies;district opens galleries with coarse rectangular minaret slots;street/close add pointed arches and selected trim. Fine stucco rosettes/lattice,interior stairs/mosque rooms,precise upper terrace plans,current finish/fixture state,threshold/street joins and engineering omitted or unverified. The48.7m retained fact differs from current53m mapped minaret height;working model follows current map without erasing the conflict. No full enclosed-interior/free walking claim. City market/roads/wires/signs/vehicles remain host content. Physical-device timing unmeasured.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('east-clock-and-grand-arch', [43, 16, 6], [0, 19, 0]),
    cam('four-way-vault', [0, 7, 30], [0, 14, 0]),
    cam('open-minaret-galleries', [29, 36, 31], [11.9, 37, 11.0]),
    cam('main-upper-gallery', [28, 23, 6], [9, 22, 0]),
    cam('western-cupola-and-parapet', [-41, 38, 33], [-8, 31, 0]),
    cam('mapped-corner-tower-plan', [0, 150, 0.1], [0, 15, 0]),
  ],
};

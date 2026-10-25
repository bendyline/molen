/** Polotsk Saint Sophia: white Baroque towers, green roofs and round side chapels. */
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
    ? Array.from({ length: d <= 1 ? 8 : 16 }, (_, i) => {
        const a = (i * Math.PI * 2) / (d <= 1 ? 8 : 16);
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
  '../../../content/worldgen/source/places/u9/u9u/saint_sophia_cathedral_in_polotsk/',
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
  wall: '#ebe8de',
  trim: '#f0ecdf',
  roof: '#4c7f61',
  door: '#74533e',
  glass: '#4d6370',
  accent: '#4c5550',
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
const footing = (p) => Math.min(floor - 0.3, polotskSophiaGround(...p) - 0.35);
export function polotskSophiaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Polotsk Holy Name Cathedral footing outside retained terrain');
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
        'wall',
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
function panel(face, h, d) {
  pane(face, h, d, d >= 2 ? -0.75 : 0.07, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, 0.35, 'trim', 0.09);
  if (h.kind === 'door') archBand(face, h, d, 0.7, 'trim', 0.14);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (h.kind === 'door') {
    beam(
      face,
      p.point(0, h.bottom, -0.68 * sg),
      p.point(0, h.bottom + h.spring, -0.68 * sg),
      0.12,
      'accent',
    );
    return;
  }
  for (const u of [-0.22, 0.22])
    beam(
      face,
      p.point(h.width * u, h.bottom, -0.66 * sg),
      p.point(h.width * u, h.bottom + h.spring, -0.66 * sg),
      0.11,
      'trim',
    );
  if (d >= 3 && h.shape === 'round') {
    for (const a of [Math.PI / 6, Math.PI / 2, (Math.PI * 5) / 6]) {
      const r = h.width / 2;
      beam(
        face,
        p.point(0, h.bottom + h.spring - 0.1, -0.64 * sg),
        p.point(Math.cos(a) * r * 0.85, h.bottom + h.spring + Math.sin(a) * r * 0.85, -0.64 * sg),
        0.11,
        'trim',
      );
    }
  }
}
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  plans = rec.plans,
  main = rec.main.polygons[0].outline;
const circle = (p, r, n = 8) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
  });
const rect = (p, w) => R(p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2);
const front = edge(plans.front[0].outline, [1, 0]),
  frontPoint = lerp(front.a, front.b, 0.5);
const towerKeys = ['towerNorth', 'towerSouth'];
function crossTop(face, p, b, t, d) {
  beam(face, at(p, b), at(p, t), d === 0 ? 0.28 : 0.16, 'accent');
  beam(
    face,
    at([p[0], p[1] - 1.3], t - 2.5),
    at([p[0], p[1] + 1.3], t - 2.5),
    d === 0 ? 0.24 : 0.14,
    'accent',
  );
  if (d >= 2)
    beam(face, at([p[0], p[1] - 0.65], t - 1.1), at([p[0], p[1] + 0.65], t - 1.1), 0.12, 'accent');
}
const F = (name, f, t, width, bottom, height, spring = height, kind = 'glass') => ({
  ...hole(name, lerp(f.a, f.b, t), f.axis, f.normal, width, bottom, height, spring, 'round', 4),
  kind,
});
function fields() {
  const a = [
    F('wood-entry', front, 0.5, 2.8, 0.3, 4.5, 3.1, 'door'),
    F('central-front-glazing', front, 0.5, 4.1, 12.2, 10.5, 8.45),
    F('lower-front-left', front, 0.16, 1.45, 7.1, 2.8, 2.05),
    F('lower-front-right', front, 0.84, 1.45, 7.1, 2.8, 2.05),
  ];
  a.push({
    ...hole(
      'front-gable-window',
      [23.6, frontPoint[1]],
      [0, 1],
      [1, 0],
      1.8,
      29.1,
      3.4,
      2.5,
      'round',
      3,
    ),
    kind: 'glass',
  });
  a.push({
    ...hole('rear-gable-window', [-20.4, -0.1], [0, -1], [-1, 0], 2.9, 26.0, 5.1, 3.65, 'round', 3),
    kind: 'glass',
  });
  for (const sg of [-1, 1]) {
    const f = edge(plans.nave[0].outline, [0, sg]);
    for (const [t, i] of [
      [0.18, 0],
      [0.5, 1],
      [0.82, 2],
    ])
      a.push(F(`nave-${sg}-${i}`, f, t, 3.0, 12.8, 9.4, 7.9));
  }
  for (const key of towerKeys) {
    const r = plans[key][0].outline;
    for (const n of [
      [1, 0],
      [0, key === 'towerNorth' ? -1 : 1],
    ])
      a.push(F(`${key}-lower-${n.join(',')}`, edge(r, n), 0.5, 2.45, 12.1, 10.6, 8.65));
  }
  for (const [key, sg] of [
    ['aisleNorth', -1],
    ['aisleSouth', 1],
  ])
    for (const r of plans[key])
      for (let i = 0; i < r.outline.length; i++) {
        const f = faceFrame(r.outline, i);
        if (f.length < 4 || f.normal[1] * sg < 0.8) continue;
        const n = Math.floor(f.length / 3.1);
        for (let j = 0; j < n; j++)
          for (const y of [2.1, 7.2])
            a.push({
              ...F(`${key}-service-${i}-${j}-${y}`, f, (j + 0.5) / n, 1.15, y, 1.8, 1.8),
              shape: 'rect',
            });
      }
  for (const key of ['sideNorth', 'sideSouth']) {
    const r = plans[key][0].outline,
      sg = key === 'sideNorth' ? -1 : 1;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 1.55 || f.normal[1] * sg < 0.35) continue;
      a.push(F(`${key}-upper-${i}`, f, 0.5, Math.min(1.45, f.length * 0.68), 13.4, 2.65, 1.925));
    }
  }
  const r = plans.apse[0].outline;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.normal[0] > -0.2 || f.length < 1.8) continue;
    a.push(F(`apse-${i}`, f, 0.5, Math.min(2.0, f.length * 0.68), 12.0, 8.4, 7.1));
  }
  return a;
}
export const polotskSophiaFields = fields;
function towerFrames(key) {
  const p = rec.estimated[`${key}Center`];
  return [
    {
      r: rect(p, 8.0),
      inner: rect(p, 5.9),
      b: 25.8,
      t: 35,
      holeBottom: 26.6,
      holeHeight: 7.5,
      width: 4.25,
    },
    {
      r: rect(p, 5.6),
      inner: rect(p, 3.45),
      b: 36,
      t: 44,
      holeBottom: 36.7,
      holeHeight: 6.65,
      width: 3.05,
    },
  ];
}
function belfryFields() {
  return towerKeys.flatMap((key) =>
    towerFrames(key).flatMap((l, j) =>
      l.r.map((_, i) => {
        const f = faceFrame(l.r, i);
        return F(
          `${key}-belfry-${j}-${i}`,
          f,
          0.5,
          l.width,
          l.holeBottom,
          l.holeHeight,
          l.holeHeight - l.width / 2,
        );
      }),
    ),
  );
}
export const polotskSophiaBelfryFields = belfryFields;
function steppedGable(face, key, x, base, top, normal, d) {
  const centerZ = key === 'front' ? frontPoint[1] : -0.1,
    ww = 6.0;
  const rr = [
    [-ww, 0],
    [-ww, 2],
    [-4.8, 2.4],
    [-4.8, 4],
    [-3.7, 4.7],
    [-3.3, 7],
    [-2.2, 7.4],
    [-1, top - base - 0.65],
    [0, top - base],
    [1, top - base - 0.65],
    [2.2, 7.4],
    [3.3, 7],
    [3.7, 4.7],
    [4.8, 4],
    [4.8, 2.4],
    [ww, 2],
    [ww, 0],
  ].map(([u, y]) => [u + centerZ, y + base]);
  const ids = earcut(rr.flat(), [], 2),
    a = x,
    b = x - normal * 0.8;
  for (let i = 0; i < ids.length; i += 3) {
    face(
      'wall',
      ids.slice(i, i + 3).map((k) => [a, floor + rr[k][1], rr[k][0]]),
      [normal, 0, 0],
    );
    face(
      'wall',
      ids.slice(i, i + 3).map((k) => [b, floor + rr[k][1], rr[k][0]]),
      [-normal, 0, 0],
    );
  }
  for (let i = 0; i < rr.length; i++) {
    const j = (i + 1) % rr.length,
      p = rr[i],
      q = rr[j];
    face('trim', [
      [a, floor + p[1], p[0]],
      [a, floor + q[1], q[0]],
      [b, floor + q[1], q[0]],
      [b, floor + p[1], p[0]],
    ]);
    if (d >= 1)
      beam(
        face,
        [a + normal * 0.12, floor + p[1], p[0]],
        [a + normal * 0.12, floor + q[1], q[0]],
        0.18,
        'trim',
      );
  }
  crossTop(face, [x, centerZ], top, top + (key === 'front' ? 2.8 : 2.5), d);
}
function lantern(face, p, b, t, tip, d) {
  const r = circle(p, 0.9, d >= 2 ? 8 : 4);
  solid(face, r, b, t, 'wall');
  profile(
    face,
    r,
    [
      [t, 1.15],
      [t + 0.45, 1],
      [t + 1, 0.08],
    ],
    'roof',
  );
  crossTop(face, p, t + 1, tip, d);
  if (d >= 1)
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        h = F(
          `lantern-${i}`,
          f,
          0.5,
          Math.min(0.55, f.length * 0.7),
          b + 0.35,
          t - b - 0.65,
          t - b - 0.9,
        );
      pane(face, h, d, 0.035);
    }
}
function tower(out, face, d, key, allFields) {
  const p = rec.estimated[`${key}Center`];
  for (const [j, l] of towerFrames(key).entries()) {
    if (d === 0) solid(face, l.r, l.b, l.t, 'wall');
    else {
      const hs = allFields.filter((h) => h.name.startsWith(`${key}-belfry-${j}-`));
      shell(out, d, l.r, l.b, l.t, hs, 'wall', l.inner);
      for (const h of hs) if (d >= 2) archBand(face, h, d, 0.22, 'trim', 0.1);
    }
    solid(face, scaled(l.r, 1.05), l.b - 0.8, l.b, 'trim');
    band(face, l.r, l.t - 0.5, 0.5, 'trim', 1.06);
  }
  const attic = circle(p, 2.0, 8);
  solid(face, attic, 44, 47, 'wall');
  profile(
    face,
    attic,
    [
      [47, 1.18],
      [47.6, 1],
      [48.4, 0.9],
      [49, 0.08],
    ],
    'roof',
  );
  crossTop(face, p, 49, 55, d);
  if (d >= 1)
    for (const n of [
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const f = edge(attic, n),
        h = F(`${key}-attic-${n.join(',')}`, f, 0.5, 1.0, 44.6, 1.45, 1.45);
      pane(face, { ...h, shape: 'circle' }, d, 0.04);
    }
  if (d >= 2) {
    for (const l of towerFrames(key))
      for (const v of l.r) {
        const o = center(l.r),
          a = v.map((x, k) => o[k] + (x - o[k]) * 1.01);
        solid(face, circle(a, 0.18, 4), l.b, l.t - 0.6, 'trim');
      }
    for (const v of rect(p, 8.5)) {
      profile(
        face,
        circle(v, 0.34, 6),
        [
          [35, 0.75],
          [35.4, 1],
          [36, 0.55],
          [36.5, 0.08],
        ],
        'roof',
      );
    }
  }
}

function skyline(target) {
  const face = writer(target, 0);
  solid(face, main, footing, 11, 'wall');
  for (const p of plans.nave) {
    solid(face, coarse(p.outline), 11, 23, 'wall');
    gable(face, p.outline, 23, 29, 'roof', 0);
  }
  for (const p of plans.front) solid(face, coarse(p.outline), 11, 25, 'wall');
  for (const key of towerKeys) {
    const p = rec.estimated[`${key}Center`];
    solid(face, rect(p, 8.0), 11, 35, 'wall');
    solid(face, rect(p, 5.6), 35, 44, 'wall');
    const r = circle(p, 2, 8);
    solid(face, r, 44, 47, 'wall');
    profile(
      face,
      r,
      [
        [47, 1.18],
        [49, 0.08],
      ],
      'roof',
    );
    crossTop(face, p, 49, 55, 0);
  }
  for (const key of ['sideNorth', 'sideSouth']) {
    const p = rec.estimated[`${key}Center`],
      r = circle(p, 4.1, 8);
    solid(face, r, 11, 17, 'wall');
    profile(
      face,
      r,
      [
        [17, 1],
        [20, 0.2],
      ],
      'roof',
    );
    lantern(face, p, 20, 23, 25, 0);
  }
  for (const p of plans.apse) {
    const r = coarse(p.outline);
    solid(face, r, 11, 23, 'wall');
    profile(
      face,
      r,
      [
        [23, 1],
        [24.2, 0.2],
      ],
      'roof',
    );
    lantern(face, center(r), 24.2, 28, 30.5, 0);
  }
  steppedGable(face, 'front', 23.6, 25, 36, 1, 0);
  steppedGable(face, 'rear', -20.4, 23, 33, -1, 0);
}

function build(target, d = 4) {
  if (d === 0) return skyline(target);
  const out = {
    addTriangle(slot, ref, p, n, uv, col) {
      p = p.map((v) => v.map(Math.fround));
      if (
        Math.hypot(
          ...cross(
            p[1].map((v, k) => v - p[0][k]),
            p[2].map((v, k) => v - p[0][k]),
          ),
        ) < 1e-10
      )
        return;
      const spans = p.map((a, i) => {
          const b = p[(i + 1) % 3];
          return Math.hypot(a[0] - b[0], a[2] - b[2]);
        }),
        m = Math.max(...spans);
      if (m > (d === 0 ? 24 : d === 1 ? 16 : 8)) {
        const i = spans.indexOf(m),
          j = (i + 1) % 3,
          k = (i + 2) % 3,
          q = lerp(p[i], p[j], 0.5),
          v = lerp(uv[i], uv[j], 0.5);
        this.addTriangle(slot, ref, [p[i], q, p[k]], n, [uv[i], v, uv[k]], col);
        this.addTriangle(slot, ref, [q, p[j], p[k]], n, [v, uv[j], uv[k]], col);
        return;
      }
      target.addTriangle(slot, ref, p, n, uv, col);
    },
  };
  const face = writer(out, d),
    hs = fields(),
    bells = belfryFields(),
    cut = writer(masked(out, d >= 2 ? hs.map((h) => prepareOpening(h, 0, d)) : []), d),
    wall = (r, b, t) => shell(out, d, r, b, t, d >= 2 ? hs : []);
  wall(main, footing, 5);
  cap(cut, main, 5, 'roof');
  for (const p of plans.nave) {
    wall(p.outline, 5, 23);
    gable(cut, p.outline, 23, 29, 'roof', 0);
  }
  for (const key of ['aisleNorth', 'aisleSouth', 'low'])
    for (const p of plans[key]) {
      wall(p.outline, 5, 11);
      hip(face, p.outline, 11, 12.5, 'roof', 0);
    }
  for (const p of plans.front) {
    wall(p.outline, 5, 25);
    hip(face, p.outline, 25, 28, 'roof', 0);
  }
  for (const key of towerKeys) {
    for (const p of plans[key]) {
      wall(p.outline, 5, 25);
      cap(face, p.outline, 25.8, 'trim');
      sides(face, p.outline, 25, 25.8, 'wall');
    }
    tower(out, face, d, key, bells);
  }
  for (const key of ['sideNorth', 'sideSouth'])
    for (const p of plans[key]) {
      wall(p.outline, 5, 17);
      profile(
        face,
        p.outline,
        [
          [17, 1],
          [18.1, 0.92],
          [19, 0.65],
          [20, 0.2],
        ],
        'roof',
      );
      lantern(face, center(p.outline), 20, 23, 25, d);
    }
  for (const p of plans.apse) {
    wall(p.outline, 5, 23);
    profile(
      face,
      p.outline,
      [
        [23, 1],
        [23.7, 0.85],
        [24.2, 0.2],
      ],
      'roof',
    );
    lantern(face, center(p.outline), 24.2, 28, 30.5, d);
  }
  steppedGable(cut, 'front', 23.6, 25, 36, 1, d);
  steppedGable(cut, 'rear', -20.4, 23, 33, -1, d);
  if (d >= 2)
    for (const [name, r, b, t] of [
      ['front-gable-window', R(22.8, -6, 23.6, 6), 25, 36],
      ['rear-gable-window', R(-20.4, -6, -19.6, 6), 23, 33],
    ])
      openingReveals(
        {
          addTriangle(_s, ref, p, n, uv, col) {
            out.addTriangle('wall', ref, p, n, uv, col);
          },
        },
        r,
        () => floor + b,
        () => floor + t,
        [
          prepareOpening(
            hs.find((h) => h.name === name),
            0,
            d,
          ),
        ],
        colors.wall,
      );
  if (d >= 1) {
    for (const h of hs) panel(face, h, d);
    for (const p of [main, ...towerKeys.map((k) => plans[k][0].outline)])
      band(face, p, p === main ? 9.8 : 24.5, 0.4, 'trim', 1.006);
  }
  if (d >= 2) {
    for (const sg of [-1, 1]) {
      const f = edge(plans.nave[0].outline, [0, sg]);
      for (const t of [0.04, 0.34, 0.67, 0.96]) {
        const p = lerp(f.a, f.b, t),
          r = circle(p, 0.16, 4);
        solid(face, r, 12, 22.5, 'trim');
      }
    }
    for (const key of ['sideNorth', 'sideSouth']) {
      const r = plans[key][0].outline,
        sg = key === 'sideNorth' ? -1 : 1;
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (f.normal[1] * sg < 0.35 || f.length < 1.55) continue;
        const h = F('blind', f, 0.5, Math.min(1.5, f.length * 0.7), 3.4, 4.2, 3.45);
        archBand(face, h, d, 0.15, 'trim', 0.07);
      }
    }
    for (const key of towerKeys) {
      const r = plans[key][0].outline;
      for (const n of [
        [1, 0],
        [0, key === 'towerNorth' ? -1 : 1],
      ]) {
        const f = edge(r, n);
        for (const t of [0.1, 0.9]) {
          const p = lerp(f.a, f.b, t);
          solid(face, circle(p, 0.18, 4), 5.5, 24.2, 'trim');
        }
      }
    }
    const f = front;
    for (let j = 0; j < 3; j++) {
      const p = frontPoint.map((x, k) => x + f.normal[k] * (0.4 + j * 0.45)),
        a = p.map((x, k) => x - f.axis[k] * 2),
        b = p.map((x, k) => x + f.axis[k] * 2),
        q = [b[0] + f.normal[0] * 0.5, b[1] + f.normal[1] * 0.5],
        e = [a[0] + f.normal[0] * 0.5, a[1] + f.normal[1] * 0.5];
      solid(face, [a, b, q, e], footing, 0.25 - j * 0.07, 'trim');
    }
  }
}
export const buildPolotskSophiaSkyline = (o) => build(o, 0),
  buildPolotskSophiaDistrict = (o) => build(o, 1),
  buildPolotskSophiaStreet = (o) => build(o, 2),
  buildPolotskSophiaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const polotskSophiaStudy = {
  id: 'saint_sophia_cathedral_in_polotsk',
  key: 'saint_sophia_cathedral_in_polotsk',
  title: 'Saint Sophia Cathedral in Polotsk',
  category: 'cathedral',
  wikidataId: 'Q2465016',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current51-vertex whole; no separate component controls. Paired front corners at+X oppose rounded-X rear apse.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing cached256-square lime-plaster, limestone, standing-seam metal and plain-wood graphs. Linear off-white/green tints, metric UVs and flat architectural normals; glazing/metal accents use geometric PBR colors. No embedded images, unique facade maps or baked shadows.',
  importReason:
    'Four authored browser levels preserve twin-tier open towers, shaped central gable, green nave/apse/round-chapel roof and mapped whole massing.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two inspected2025 front/2006 reverse-side pictures and standard viewer PMTiles/DEM only. Cartographic5m height is retained but is not a measured cathedral height; all modeled vertical levels and internal partitions are estimated. Fine stucco/iron scrollwork, inscriptions, exact hidden rear/door details, full interiors/bells and surveyed paving/thresholds remain approximate or excluded. Physical phone/laptop timings pending.',
    'Skyline retains white stepped twin towers/green caps/crosses, shaped central gable, nave and rounded apse/side chapels. District adds shared textures, flat arched fields and actual open belfries. Street adds recessed glazing/wood portal, simple pilasters and blind arches; closeup/master refine frames/finials. Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('twin-tier-open-belfries', [67, 53, 62], [19.8, 36, 0]),
    cam('central-gable-and-portal', [72, 26, 6], [23.6, 18, 0]),
    cam('round-chapel-and-nave', [-17, 28, 57], [1, 15, 9]),
    cam('rear-apse-and-shaped-gable', [-64, 35, 28], [-19, 18, 0]),
    cam('green-roofs-and-lanterns', [-32, 67, -55], [-1, 23, 0]),
    cam('roof-and-signed-plan', [0, 150, 1], [0, 22, 0]),
  ],
};

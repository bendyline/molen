/** Minsk Holy Name: pale plaster twin towers, curved gable and projecting entrance balcony. */
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
  '../../../content/worldgen/source/places/u9/u9e/cathedral_of_the_holy_name_of_saint_virgin_mary/',
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
  wall: '#eee6d5',
  spire: '#8e8175',
  trim: '#f0eee5',
  roof: '#747977',
  door: '#71533c',
  glass: '#414844',
  accent: '#434b49',
  clock: '#ad615b',
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
const footing = (p) => Math.min(floor - 0.3, minskMaryGround(...p) - 0.35);
export function minskMaryGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Minsk Holy Name Cathedral footing outside retained terrain');
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
const _R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  _role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline;
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
function _inside(p, r) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      v = !v;
  }
  return v;
}
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
function _panel(face, h, d) {
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
  if (d >= 3) {
    for (const off of [-0.27, 0.27]) {
      const y = h.bottom + h.spring + 0.45;
      beam(
        face,
        p.point(h.width * off, y, -0.64 * sg),
        p.point(0, h.bottom + h.height - 0.35, -0.64 * sg),
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
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline,
  _main = rec.main.polygons[0].outline,
  plans = rec.plans;
const circle = (p, r, n = 8) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    }),
  towerNames = ['towerNorth', 'towerSouth'];
function fields() {
  const a = [
    {
      ...hole('entry-portal', [21.5, 0.8], [0, 1], [1, 0], 2.55, 0.3, 4.5, 3.225, 'round', 4),
      kind: 'door',
    },
    hole('entry-central-window', [21.5, 0.8], [0, 1], [1, 0], 3.4, 6.3, 4.25, 2.55, 'round', 3),
    ...[-1.9, 3.5].map((z) =>
      hole(`entry-flank-${z}`, [21.5, z], [0, 1], [1, 0], 1.5, 6.6, 3.1, 3.1, 'rect', 3),
    ),
    hole('balcony-door', [17.1, 0.8], [0, 1], [1, 0], 3.0, 13.4, 4.8, 3.3, 'round', 3),
    hole('upper-gable-window', [17.3, 0.8], [0, 1], [1, 0], 1.8, 19.5, 2.15, 1.25, 'round', 3),
    {
      ...hole('figure-niche', [17.3, 0.8], [0, 1], [1, 0], 1.65, 22.6, 2.9, 2.075, 'round', 3),
      kind: 'niche',
    },
  ];
  for (const n of towerNames) {
    const r = role(n),
      side = n === 'towerNorth' ? -1 : 1;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.normal[0] < 0.65 && f.normal[1] * side < 0.65) continue;
      a.push(
        hole(
          `${n}-lower-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          2.4,
          13.1,
          5.2,
          4.0,
          'round',
          3,
        ),
      );
    }
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const x = -9 + i * 5.2;
      a.push(
        hole(
          `aisle-${side}-${i}`,
          [x, side < 0 ? -10.94 : 12.25],
          [1, 0],
          [0, side],
          1.65,
          3.9,
          4.2,
          3.1,
          'round',
          3,
        ),
      );
      a.push(
        hole(
          `clerestory-${side}-${i}`,
          [x, side < 0 ? -6.7 : 8.1],
          [1, 0],
          [0, side],
          2.0,
          13.7,
          4.25,
          3.25,
          'round',
          3,
        ),
      );
    }
  }
  const r = role('apse');
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.normal[0] > -0.15 || f.length < 0.8) continue;
    a.push(
      hole(`apse-${i}`, lerp(f.a, f.b, 0.5), f.axis, f.normal, 1.15, 10.8, 4.3, 3.725, 'round', 3),
    );
  }
  return a;
}
export const minskMaryFields = fields;
function bellFields() {
  const a = [];
  for (const n of towerNames)
    for (const part of ['Mid', 'Upper']) {
      const r = role(n + part),
        side = n === 'towerNorth' ? -1 : 1;
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (part === 'Mid' && f.normal[0] < 0.65 && f.normal[1] * side < 0.65) continue;
        a.push({
          ...hole(
            `${n}-${part}-${i}`,
            lerp(f.a, f.b, 0.5),
            f.axis,
            f.normal,
            part === 'Mid' ? 1.85 : 1.1,
            part === 'Mid' ? 20.9 : 26.0,
            part === 'Mid' ? 3.4 : 2.7,
            part === 'Mid' ? 2.475 : 2.15,
            'round',
            3.2,
          ),
          tower: n,
          tier: part,
        });
      }
    }
  return a;
}
export const minskMaryBelfryFields = bellFields;
function panel(face, h, d) {
  pane(
    face,
    h,
    d,
    d >= 2 ? -0.68 : 0.05,
    h.kind === 'door' ? 'door' : h.kind === 'niche' ? 'trim' : 'glass',
  );
  if (d < 2) return;
  archBand(face, h, d, 0.23, 'trim', 0.1);
  if (d >= 3) archBand(face, h, d, 0.42, 'trim', 0.14);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (h.kind === 'niche') return;
  if (h.kind === 'door') {
    beam(
      face,
      p.point(0, h.bottom, -0.65 * sg),
      p.point(0, h.bottom + h.spring, -0.65 * sg),
      0.1,
      'accent',
    );
    return;
  }
  for (const u of [-0.25, 0, 0.25])
    beam(
      face,
      p.point(u * h.width, h.bottom, -0.65 * sg),
      p.point(u * h.width, h.bottom + h.spring, -0.65 * sg),
      0.08,
      'trim',
    );
  if (d >= 3)
    for (const f of [0.25, 0.5, 0.75])
      beam(
        face,
        p.point(-h.width / 2, h.bottom + h.spring * f, -0.65 * sg),
        p.point(h.width / 2, h.bottom + h.spring * f, -0.65 * sg),
        0.075,
        'trim',
      );
}
function finial(face, p, b, t, d) {
  if (d === 0) {
    beam(face, at(p, b), at(p, t), 0.15, 'accent');
    return;
  }
  solid(face, circle(p, 0.15, 6), b, Math.max(b + 0.05, t - 0.5), 'accent');
  beam(face, at(p, t - 0.5), at(p, t), 0.1, 'accent');
  beam(
    face,
    [p[0], floor + t - 0.3, p[1] - 0.25],
    [p[0], floor + t - 0.3, p[1] + 0.25],
    0.1,
    'accent',
  );
}
function urn(face, p, b, d) {
  profile(
    face,
    circle(p, 0.16, d >= 3 ? 8 : 4),
    [
      [b, 1],
      [b + 0.15, 0.75],
      [b + 0.38, 1.25],
      [b + 0.6, 0.7],
      [b + 0.68, 0.05],
    ],
    'trim',
  );
}
function tower(out, face, d, n, hs) {
  const r = role(n),
    mid = role(`${n}Mid`),
    up = role(`${n}Upper`),
    capR = role(`${n}Cap`),
    hat = role(`${n}Hat`),
    tip = center(role(`${n}Tip`));
  const lower = fields().filter((h) => h.name.startsWith(`${n}-lower`));
  if (d >= 2) shell(out, d, r, 5, 20, lower);
  else sides(face, r, 5, 20, 'wall');
  for (const [name, rr, b, t] of [
    ['Mid', mid, 20, 25],
    ['Upper', up, 25, 30],
  ]) {
    const holes = hs.filter((h) => h.tower === n && h.tier === name);
    if (d >= 2) shell(out, d, rr, b, t, holes, 'wall', scaled(rr, 0.55));
    else sides(face, rr, b, t, 'wall');
    cap(face, rr, b, 'roof');
    cap(face, rr, t, 'trim', [scaled(rr, 0.55)]);
    if (d >= 1)
      for (const h of holes) {
        if (d >= 2) archBand(face, h, d, 0.24, 'trim', 0.12);
        else pane(face, h, d, 0.05, 'glass');
      }
  }
  if (d === 0)
    profile(
      face,
      capR,
      [
        [30, 1.25],
        [32, 1.18],
        [34, 0.16],
      ],
      'roof',
    );
  else {
    profile(
      face,
      capR,
      [
        [30, 1.22],
        [30.65, 1.27],
        [31.65, 1.18],
        [32.5, 0.95],
        [33, 0.78],
      ],
      'roof',
    );
    profile(
      face,
      hat,
      [
        [33, 1],
        [33.45, 0.9],
        [34, 0.2],
      ],
      'roof',
    );
  }
  finial(face, tip, 34, 34.95, d);
  if (d >= 1) {
    for (const [rr, y] of [
      [r, 19.6],
      [mid, 24.65],
      [up, 29.6],
    ]) {
      band(face, rr, y, 0.4, 'trim', 1.08);
      if (d >= 2) {
        band(face, rr, y - 0.2, 0.2, 'trim', 1.04);
        for (const p of rr) {
          solid(face, R(p[0] - 0.2, p[1] - 0.2, p[0] + 0.2, p[1] + 0.2), y - 4.1, y - 0.2, 'trim');
          solid(
            face,
            R(p[0] - 0.34, p[1] - 0.34, p[0] + 0.34, p[1] + 0.34),
            y - 0.5,
            y - 0.1,
            'trim',
          );
        }
      }
    }
    if (d >= 2) {
      for (const p of r) urn(face, p, 20.25, d);
      for (const p of up) urn(face, p, 30.2, d);
    }
  }
}
function frontProfile(out, face, d, poly, x, depth, holes = []) {
  const rr = poly.map(([z, y]) => [z, floor + y]),
    ix = earcut(rr.flat(), null, 2),
    f =
      d >= 2
        ? writer(
            masked(
              out,
              holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
            ),
            d,
          )
        : face;
  for (let i = 0; i < ix.length; i += 3) {
    const a = ix.slice(i, i + 3).map((k) => [x, rr[k][1], rr[k][0]]);
    f('wall', a, [1, 0, 0]);
    f(
      'wall',
      a.map((p) => [p[0] - depth, p[1], p[2]]),
      [-1, 0, 0],
    );
  }
  for (let i = 0; i < rr.length; i++) {
    const j = (i + 1) % rr.length;
    f('trim', [
      [x, rr[i][1], rr[i][0]],
      [x, rr[j][1], rr[j][0]],
      [x - depth, rr[j][1], rr[j][0]],
      [x - depth, rr[i][1], rr[i][0]],
    ]);
  }
}
function facade(out, face, d, hs) {
  const top = [
      [-6.7, 20],
      [-5.5, 20.4],
      [-4.4, 21.3],
      [-3.3, 22.7],
      [-2.7, 24.2],
      [-1.8, 25.5],
      [-0.6, 26.3],
      [0.8, 26.5],
      [2.2, 26.3],
      [3.4, 25.5],
      [4.3, 24.2],
      [4.9, 22.7],
      [6, 21.3],
      [7.1, 20.4],
      [8.1, 20],
    ],
    profilePoly = [[-6.7, 19.5], [8.1, 19.5], ...top.toReversed()];
  frontProfile(
    out,
    face,
    d,
    profilePoly,
    17.3,
    1.2,
    hs.filter((h) => ['figure-niche', 'upper-gable-window'].includes(h.name)),
  );
  // The lower segmental front and entry pediment are solid reliefs, including their rear faces.
  const low = [
    [-4.8, 18.8],
    [6.4, 18.8],
    ...Array.from({ length: 9 }, (_, i) => {
      const a = (i * Math.PI) / 8;
      return [0.8 + 5.6 * Math.cos(a), 19.1 + 3.65 * Math.sin(a)];
    }),
  ];
  frontProfile(
    out,
    face,
    d,
    low,
    17.5,
    0.45,
    hs.filter((h) => h.name === 'upper-gable-window'),
  );
  if (d >= 1) {
    for (let i = 1; i < top.length; i++)
      beam(
        face,
        [17.42, floor + top[i - 1][1], top[i - 1][0]],
        [17.42, floor + top[i][1], top[i][0]],
        0.22,
        'trim',
      );
    for (const z of [-2.0, 3.6])
      solid(face, R(17.25, z - 0.22, 17.65, z + 0.22), 21.2, 25.3, 'trim');
  }
  const p = [16.35, 0.8];
  if (d >= 1) {
    const r = circle(p, 0.62, 4);
    solid(face, r, 26.5, 26.7, 'trim');
    for (const q of r) solid(face, circle(q, 0.09, 4), 26.7, 27.35, 'accent');
    solid(face, scaled(r, 1.1), 27.35, 27.55, 'roof');
  } else solid(face, R(p[0] - 0.5, p[1] - 0.5, p[0] + 0.5, p[1] + 0.5), 26.5, 27.55, 'roof');
  finial(face, p, 27.55, 28, d);
  if (d < 1) return;
  const front = plans.front[0].outline;
  for (const y of [0.4, 10.5, 10.9, 11.25]) band(face, front, y, 0.25, 'trim', 1.015);
  for (const z of [-3.2, -0.7, 2.45, 4.95]) {
    const ring = circle([22.3, z], 0.24, d >= 2 ? 8 : 4);
    solid(face, ring, 0.5, 10.3, 'trim');
    if (d >= 2) {
      solid(face, R(21.93, z - 0.4, 22.65, z + 0.4), 0.3, 0.7, 'trim');
      solid(face, R(21.85, z - 0.43, 22.7, z + 0.43), 10.05, 10.45, 'trim');
    }
  }
  frontProfile(
    out,
    face,
    d,
    [
      [-0.95, 5.1],
      [2.55, 5.1],
      [0.8, 6.0],
    ],
    21.73,
    0.5,
  );
  if (d >= 2) {
    for (const [a, b] of [
      [
        [-0.95, 5.1],
        [0.8, 6],
      ],
      [
        [0.8, 6],
        [2.55, 5.1],
      ],
    ])
      beam(face, [21.83, floor + a[1], a[0]], [21.83, floor + b[1], b[0]], 0.16, 'trim');
  }
  // Open balcony only above its mapped deck, never columns down to ground.
  const rail = [
    [23.0, -4.4],
    [23.0, 6.2],
    [17.2, 6.2],
    [17.2, -4.4],
  ];
  for (let i = 0; i < 3; i++) {
    const a = rail[i],
      b = rail[i + 1],
      len = Math.hypot(...a.map((v, k) => v - b[k])),
      count = d >= 2 ? Math.ceil(len / 0.65) : Math.ceil(len / 1.6);
    beam(face, at(a, 12.95), at(b, 12.95), 0.1, 'accent');
    beam(face, at(a, 11.7), at(b, 11.7), 0.08, 'accent');
    for (let j = 0; j <= count; j++) {
      const p = lerp(a, b, j / count);
      beam(face, at(p, 11.7), at(p, 12.95), 0.065, 'accent');
    }
  }
  if (d >= 2) {
    for (const z of [-10.4, -5.7, 7.0, 11.8])
      solid(face, R(17.32, z - 0.22, 17.68, z + 0.22), 0.7, 12.2, 'trim');
    const h = hs.find((h) => h.kind === 'niche'),
      q = prepareOpening(h, 0, d === 2 ? 1 : d),
      ring = q.ring;
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      face('trim', [
        q.point(...ring[i], 0),
        q.point(...ring[j], 0),
        q.point(...ring[j], -0.6),
        q.point(...ring[i], -0.6),
      ]);
    }
    const p = [16.85, 0.8];
    profile(
      face,
      circle(p, 0.24, 6),
      [
        [22.65, 1.1],
        [23.2, 0.9],
        [23.85, 0.65],
        [24.15, 0.45],
      ],
      'trim',
    );
    profile(
      face,
      circle(p, 0.16, 6),
      [
        [24.15, 0.6],
        [24.32, 1],
        [24.5, 0.1],
      ],
      'trim',
    );
  }
  solid(face, R(21.3, -4.5, 23.3, 6.1), footing, 0.3, 'trim');
  for (let i = 0; i < 4; i++)
    solid(face, R(23.0, -5.8, 25.2 - i * 0.45, 7.2), footing, 0.05 + i * 0.08, 'trim');
}
function sideCupola(face, d, n) {
  const r = role(n);
  sides(face, r, 5, 13, 'wall');
  profile(
    face,
    r,
    [
      [13, 1],
      [13.5, 0.95],
      [14, 0.15],
    ],
    'roof',
  );
  const p = center(r),
    small = circle(p, 0.7, d >= 2 ? 8 : 4);
  solid(face, small, 14, 16.5, 'wall');
  profile(
    face,
    small,
    [
      [16.5, 1.05],
      [17, 0.12],
    ],
    'roof',
  );
  finial(face, p, 17, 17.5, d);
}
function build(target, d = 4) {
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
          max = d === 0 ? 16 : 6,
          m = Math.max(...spans);
        if (m > max) {
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
    },
    face = writer(out, d),
    hs = fields(),
    bells = bellFields(),
    wall = (r, b, t) => {
      if (d >= 2) shell(out, d, r, b, t, hs);
      else sides(face, r, b, t, 'wall');
    };
  for (const p of plans.groundBase) {
    wall(p.outline, footing, 5);
    cap(face, p.outline, 5, 'roof');
  }
  for (const p of plans.lowSouth) {
    wall(p.outline, 5, 7);
    cap(face, p.outline, 7, 'roof');
  }
  for (const p of plans.entryWall) wall(p.outline, 5, 11);
  for (const p of plans.front) cap(face, p.outline, 11.5, 'roof');
  const nr = role('nave');
  wall(nr, 5, 20);
  const cut =
    d >= 2
      ? writer(
          masked(
            out,
            hs.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
          ),
          d,
        )
      : face;
  gable(
    (slot, p, n, ...rest) =>
      slot === 'wall' ? cut(slot, p, n, ...rest) : face(slot, p, n, ...rest),
    nr,
    20,
    25,
    'roof',
    0,
  );
  for (const n of ['aisleNorth', 'aisleSouth']) {
    wall(role(n), 5, 9.3);
    hip(face, role(n), 9.3, 10, 'roof', 0);
  }
  wall(role('apse'), 5, 18);
  hip(face, role('apse'), 18, 21, 'roof', 0);
  wall(role('apseLink'), 5, 18);
  cap(face, role('apseLink'), 18, 'roof');
  for (const n of towerNames) tower(out, face, d, n, bells);
  for (const n of ['chapelNorth', 'chapelSouth']) sideCupola(face, d, n);
  facade(out, face, d, hs);
  if (d >= 1) for (const h of hs) panel(face, h, d);
}
export const buildMinskMarySkyline = (o) => build(o, 0),
  buildMinskMaryDistrict = (o) => build(o, 1),
  buildMinskMaryStreet = (o) => build(o, 2),
  buildMinskMaryCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const minskMaryStudy = {
  id: 'cathedral_of_the_holy_name_of_saint_virgin_mary',
  key: 'cathedral_of_the_holy_name_of_saint_virgin_mary',
  title: 'Cathedral of the Holy Name of Saint Virgin Mary',
  category: 'cathedral',
  wikidataId: 'Q1637149',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID whole footprint and78 current intersecting component plans. Paired+X front towers/projection versus-X rounded apse sign retained native frame; raw heights/min_height retained.',
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
    'Four existing cached256-square lime plaster, limestone, standing-seam metal and plain wood graphs. Linear cream/white/gray tints, metric UVs and flat architectural normals. Dark glass/ironwork and sparse accents use geometric PBR colors. No embedded images, unique facade maps or baked shadows.',
  importReason:
    'Four authored browser tiers retain the paired tiered towers/curved gray caps/crosses, shaped front gable/niche/lantern, projecting entry/columns/balcony and full long nave/aisles/rounded apse envelope.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from inspected2018 whole-front and2026 front/tower details plus standard viewer PMTiles/DEM only. Side/rear profiles and windows are inferred from detailed map controls and front architectural character. Fine sculptural capitals/urns/statue detail, text/iron scrollwork, full interior/bells, hidden roof joins and surveyed plaza/thresholds are approximate or excluded. The78 raw component controls include small overlapping decorative plans; their metadata is retained while fine details are simplified rather than mechanically extruded from ground. Physical laptop/phone timing pending.',
    'Skyline keeps all major massing, tiered towers/caps, shaped gable/lantern, projecting entry, round apse and smaller rear cupolas. District adds shared textures, flat glazing, selected pilasters/urns and open balcony. Street adds real recesses and upper belfry voids, columns, figure niche and finer railing. Closeup/master refine capitals, window bars and nested surrounds. Synthetic cottages are review fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('projecting-entry-columns-and-balcony', [61, 15, 1], [20, 7, 0.8]),
    cam('tiered-towers-and-curved-metal-caps', [58, 41, 43], [14, 25, 1]),
    cam('shaped-central-gable-and-figure-niche', [60, 31, -12], [16, 22, 1]),
    cam('south-aisle-and-long-nave', [-3, 31, 61], [0, 15, 6]),
    cam('rounded-rear-apse-and-small-cupolas', [-59, 28, 30], [-18, 15, 1]),
    cam('roof-and-signed-plan', [0, 125, 1], [0, 17, 0]),
  ],
};

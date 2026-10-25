/** Geneva St. Pierre: open classical portico, unequal belfries and green central spire. */
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
  h.shape === 'round' && d === -1
    ? [
        [-h.width / 2, h.bottom],
        [h.width / 2, h.bottom],
        ...Array.from({ length: 4 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          return [
            (Math.cos(a) * h.width) / 2,
            h.bottom + h.spring + Math.sin(a) * (h.height - h.spring),
          ];
        }),
      ]
    : h.shape === 'circle'
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
  if (h.shape !== 'circle' && !(h.shape === 'round' && d === -1)) return v;
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
  '../../../content/worldgen/source/places/u0/u0h/st_pierre_cathedral/',
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
  wall: '#c8c0af',
  trim: '#d7d2c7',
  roof: '#8a7461',
  copper: '#80aaa0',
  gray: '#b1b5b2',
  door: '#6a4831',
  glass: '#4d666a',
  accent: '#73938c',
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
const footing = (p) => Math.min(floor - 0.3, stPierreGround(...p) - 0.35);
export function stPierreGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('St. Pierre footing outside retained terrain');
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
  // Three broad arch facets in district; four in street; eight in close views.
  const hs = holes.map((h) => prepareOpening(h, 0, d === 1 ? -1 : d === 2 ? 1 : d)),
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
const coarse = (r, tolerance = 1.4) => {
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
      if (
        t >= -0.05 &&
        t <= 1.05 &&
        Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz) < tolerance
      ) {
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
  if (h.spring > 0)
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
        p.point(0, h.bottom + Math.max(0, h.spring - 0.1), -0.64 * sg),
        p.point(Math.cos(a) * r * 0.85, h.bottom + h.spring + Math.sin(a) * r * 0.85, -0.64 * sg),
        0.11,
        'trim',
      );
    }
  }
}

const plans = rec.plans,
  _main = rec.main.polygons[0].outline;
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * Math.PI * 2) / n) * r,
      p[1] + Math.sin((i * Math.PI * 2) / n) * r,
    ]);
const F = (name, f, t, w, b, h, s = h, shape = 'round', depth = 3) =>
  hole(name, lerp(f.a, f.b, t), f.axis, f.normal, w, b, h, s, shape, depth);
const frontHole = (name, x, z, w, b, h, s = h, shape = 'rect') =>
  hole(name, [x, z], [0, 1], [-1, 0], w, b, h, s, shape, 3);
const towerR = { north: R(10.2, -20.9, 21.1, -10.8), south: R(10.1, 10.5, 20.8, 20.9) },
  upperR = R(10.9, -20.2, 20.4, -11.5);
const spireRing = () => circle(rec.estimated.spireCenter, 3.25, 8);
function fields() {
  const a = [{ ...frontHole('main-wood-portal', -30.5, -2, 3.0, 0.5, 6.0), kind: 'door' }];
  for (const z of [-9, 5]) {
    a.push({ ...frontHole(`portico-side-door-${z}`, -30.5, z, 1.8, 0.5, 4.7), kind: 'door' });
    a.push(frontHole(`portico-upper-glass-${z}`, -30.5, z, 2.1, 7.8, 2.7));
  }
  for (const sg of [-1, 1]) {
    const f = edge(plans.nave[0].outline, [0, sg]);
    for (const x of [-26, -19, -12, -5, 2.5]) {
      const t = (x - f.a[0]) / (f.b[0] - f.a[0]);
      if (t > 0 && t < 1) a.push(F(`nave-${sg}-${x}`, f, t, 2.0, 12.2, 4.5, 3.5, 'round'));
    }
    const r = plans[sg < 0 ? 'aisleNorth' : 'aisleSouth'][0].outline;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.normal[1] * sg < 0.7 || f.length < 3.1) continue;
      const n = Math.max(1, Math.floor(f.length / 6.5));
      for (let j = 0; j < n; j++)
        a.push(
          F(
            `aisle-${sg}-${i}-${j}`,
            f,
            (j + 0.5) / n,
            Math.min(2.2, (f.length / n) * 0.55),
            3.6,
            5.7,
            3.9,
            'pointed',
          ),
        );
    }
  }
  const chapel = plans.maccabees[0].outline,
    cf = edge(chapel, [-1, 0]);
  a.push(F('maccabees-front', cf, 0.5, 5.2, 5.1, 9.1, 5.7, 'pointed'));
  for (let i = 0; i < chapel.length; i++) {
    const f = faceFrame(chapel, i);
    if (f.normal[1] < 0.7 || f.length < 4) continue;
    const n = Math.max(1, Math.floor(f.length / 6));
    for (let j = 0; j < n; j++)
      a.push(
        F(
          `maccabees-side-${i}-${j}`,
          f,
          (j + 0.5) / n,
          Math.min(2.8, (f.length / n) * 0.65),
          5.1,
          8.2,
          5.8,
          'pointed',
        ),
      );
  }
  const ar = plans.apse[0].outline;
  for (let i = 0; i < ar.length; i++) {
    const f = faceFrame(ar, i);
    if (f.normal[0] < 0.15 || f.length < 2.5) continue;
    a.push(F(`apse-${i}`, f, 0.5, Math.min(2.3, f.length * 0.6), 6.0, 9.0, 7.85, 'round'));
  }
  for (const key of ['north', 'south'])
    for (const n of [
      [1, 0],
      [-1, 0],
      [0, key === 'south' ? 1 : -1],
    ]) {
      const f = edge(plans[key === 'north' ? 'towerNorth' : 'towerSouth'][0].outline, n);
      a.push(
        F(
          `${key}-lower-window-${n.join(',')}`,
          f,
          0.5,
          1.5,
          key === 'south' ? 19 : 17,
          5.0,
          4.25,
          'round',
        ),
      );
    }
  const sr = spireRing();
  for (let i = 0; i < sr.length; i++)
    a.push(F(`spire-shaft-${i}`, faceFrame(sr, i), 0.5, 1.3, 30.5, 6.5, 5.3, 'pointed', 2));
  return a;
}
export const stPierreFields = fields;
function belfryFields() {
  const a = [];
  for (const [key, r, b, t, w] of [
    ['south', towerR.south, 28, 38, 2.05],
    ['north-lower', towerR.north, 26, 34, 2.05],
    ['north-upper', upperR, 36, 41, 1.8],
  ])
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      for (const [j, v] of [0.22, 0.5, 0.78].entries())
        a.push(
          F(
            `${key}-belfry-${i}-${j}`,
            f,
            v,
            w,
            b + 0.65,
            t - b - 1.2,
            t - b - 1.2 - w / 2,
            'round',
            2.6,
          ),
        );
    }
  return a;
}
export const stPierreBelfryFields = belfryFields;
function slab(face, x, depth, pts, slot = 'wall') {
  const ids = earcut(pts.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    for (const [xx, n] of [
      [x, -1],
      [x + depth, 1],
    ])
      face(
        slot,
        ids.slice(i, i + 3).map((k) => [xx, floor + pts[k][1], pts[k][0]]),
        [n, 0, 0],
      );
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      q = pts[(i + 1) % pts.length];
    face(
      slot,
      [
        [x, floor + a[1], a[0]],
        [x + depth, floor + a[1], a[0]],
        [x + depth, floor + q[1], q[0]],
        [x, floor + q[1], q[0]],
      ],
      [0, (a[0] - q[0]) * sign(pts), (q[1] - a[1]) * sign(pts)],
    );
  }
}
function finial(face, p, b, top, d, slot = 'trim') {
  profile(
    face,
    circle(p, d === 0 ? 0.2 : 0.25, d < 2 ? 4 : 6),
    [
      [b, 1.2],
      [b + 0.5, 1],
      [top - 0.5, 0.35],
      [top, 0.02],
    ],
    slot,
  );
}
function crossFinial(face, p, b, top) {
  beam(face, at(p, b), at(p, top), 0.12, 'accent');
  beam(
    face,
    at([p[0], p[1] - 0.55], top - 0.7),
    at([p[0], p[1] + 0.55], top - 0.7),
    0.12,
    'accent',
  );
}
function column(face, p, d) {
  if (d === 0) {
    solid(face, circle(p, 0.5, 4), 0.5, 15.5, 'trim');
    return;
  }
  if (d === 1) {
    profile(
      face,
      circle(p, 0.5, 6),
      [
        [0.5, 1.4],
        [1.15, 1],
        [14.5, 0.86],
        [15.5, 1.45],
      ],
      'trim',
    );
    return;
  }
  profile(
    face,
    circle(p, 0.5, d === 1 ? 6 : 10),
    [
      [0.5, 1.4],
      [0.85, 1.4],
      [1.15, 1],
      [14, 0.86],
      [14.55, 1.15],
      [15.15, 1.45],
      [15.5, 1.45],
    ],
    'trim',
  );
  if (d >= 3)
    for (const s of [-1, 1])
      solid(
        face,
        R(p[0] - 0.25, p[1] + s * 0.49 - 0.14, p[0] + 0.25, p[1] + s * 0.49 + 0.14),
        14.65,
        15.15,
        'trim',
      );
}
function portico(face, out, d, hs) {
  for (const p of plans.porticoCanopy) {
    solid(face, d === 0 ? coarse(p.outline) : p.outline, 15.5, 16.8, 'trim');
    cap((slot, p) => face(slot, p, [0, -1, 0]), p.outline, 15.5, 'trim');
  }
  for (const z of rec.estimated.porticoColumnsZ) column(face, [-35.2, z], d);
  slab(
    face,
    -36.25,
    0.8,
    [
      [-13.5, 16.8],
      [-2, 22.8],
      [9.5, 16.8],
    ],
    'wall',
  );
  const metal = (_s, p, n) => face('copper', p, n, colors.gray),
    n = d === 0 ? 6 : d === 1 ? 8 : 16,
    arc = Array.from({ length: n + 1 }, (_, i) => [
      -2 + 11.5 * Math.cos((i * Math.PI) / n),
      16.8 + 6.6 * Math.sin((i * Math.PI) / n),
    ]);
  for (let i = 0; i < n; i++)
    metal(
      'copper',
      [
        [-35.2, floor + arc[i][1], arc[i][0]],
        [-24.0, floor + arc[i][1], arc[i][0]],
        [-24.0, floor + arc[i + 1][1], arc[i + 1][0]],
        [-35.2, floor + arc[i + 1][1], arc[i + 1][0]],
      ],
      [0, 1, 0],
    );
  for (const [x, normal] of [
    [-35.2, -1],
    [-24, 1],
  ])
    metal(
      'copper',
      arc.map(([z, y]) => [x, floor + y, z]),
      [normal, 0, 0],
    );
  if (d >= 1) {
    const wall = R(-30.5, -12.8, -28.7, 8.8);
    shell(
      out,
      d,
      wall,
      4,
      15.5,
      d >= 2
        ? hs.filter((h) => h.name.startsWith('portico-') || h.name === 'main-wood-portal')
        : [],
    );
  }
  if (d >= 2) {
    beam(face, [-36.33, floor + 16.9, -13.5], [-36.33, floor + 22.9, -2], 0.24, 'trim');
    beam(face, [-36.33, floor + 22.9, -2], [-36.33, floor + 16.9, 9.5], 0.24, 'trim');
    for (let i = 0; i < 22; i++)
      solid(face, R(-36.5, -13.2 + i * 1.04, -36.0, -12.8 + i * 1.04), 16.45, 16.8, 'trim');
    // An abstract shield silhouette deliberately omits the carved historical coat of arms.
    slab(
      face,
      -36.35,
      0.12,
      [
        [-3.1, 19.8],
        [-3.1, 21],
        [-0.9, 21],
        [-0.9, 19.8],
        [-2, 19.0],
      ],
      'accent',
    );
    for (let j = 0; j < 6; j++)
      solid(face, R(-35.8 - j * 0.35, -13, -30.4, 9), footing, 0.5 - j * 0.13, 'trim');
  }
}
function roofPinnacles(face, r, b, top, d) {
  for (const p of r) finial(face, p, b, top, d);
}
function chapelRoof(face) {
  const r = rec.estimated.maccabeesRoof,
    f = edge(plans.maccabees[0].outline, [-1, 0]);
  const z = (f.a[1] + f.b[1]) / 2;
  const ridge = (p) => [Math.min(p[0], -17.5), z];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face('roof', [at(a, 17.8), at(b, 17.8), at(ridge(b), 28.5), at(ridge(a), 28.5)], [0, 1, 0]);
  }
}
function towers(out, face, d, hs, bells) {
  for (const key of ['north', 'south']) {
    const base = key === 'north' ? 26 : 28,
      top = key === 'north' ? 34 : 38,
      r = towerR[key],
      raw = plans[key === 'north' ? 'towerNorth' : 'towerSouth'][0].outline;
    shell(
      out,
      d,
      d === 0 ? coarse(raw) : raw,
      4,
      base,
      d >= 2 ? hs.filter((h) => h.name.startsWith(`${key}-lower`)) : [],
    );
    if (d >= 1)
      shell(
        out,
        d,
        r,
        base,
        top,
        bells.filter((h) =>
          h.name.startsWith(key + (key === 'north' ? '-lower-belfry' : '-belfry')),
        ),
        'wall',
        scaled(r, 0.77),
      );
    else solid(face, r, base, top, 'wall');
    cap(face, r, top, 'trim');
    if (d >= 1) {
      cap((slot, points) => face(slot, points, [0, -1, 0]), r, top - 0.15, 'trim');
      sides(face, r, top - 0.15, top, 'trim');
    }
    if (d >= 1) {
      band(face, r, base - 0.4, 0.4, 'trim', 1.015);
      band(face, r, top - 0.4, 0.4, 'trim', 1.015);
    }
    if (key === 'south') {
      hip(face, scaled(r, 1.06), 38, 47, 'roof', 0);
      finial(face, center(r), 47, 49, d, 'copper');
      if (d >= 2) {
        roofPinnacles(face, r, 38, 40, d);
        for (let i = 0; i < r.length; i++) {
          const f = faceFrame(r, i),
            p = lerp(f.a, f.b, 0.5),
            q = p.map((v, k) => v - f.normal[k] * 1.5);
          solid(face, R(q[0] - 0.45, q[1] - 0.45, q[0] + 0.45, q[1] + 0.45), 40.2, 41.2, 'copper');
          hip(face, R(q[0] - 0.6, q[1] - 0.6, q[0] + 0.6, q[1] + 0.6), 41.2, 42, 'copper', 0);
        }
      }
    } else {
      if (d >= 1)
        shell(
          out,
          d,
          upperR,
          35.2,
          41,
          bells.filter((h) => h.name.startsWith('north-upper-belfry')),
          'wall',
          scaled(upperR, 0.75),
        );
      else solid(face, upperR, 34, 41, 'wall');
      cap(face, upperR, 41, 'trim');
      if (d >= 1) {
        cap((slot, points) => face(slot, points, [0, -1, 0]), upperR, 40.85, 'trim');
        sides(face, upperR, 40.85, 41, 'trim');
      }
      gable(face, scaled(upperR, 1.035), 41, 49, 'roof', 0);
      crossFinial(face, center(upperR), 49, 51);
      if (d >= 2) {
        roofPinnacles(face, scaled(r, 1.02), 34.8, 43, d);
        for (let i = 0; i < r.length; i++) {
          const f = faceFrame(r, i);
          beam(face, at(f.a, 35.2), at(f.b, 35.2), 0.2, 'trim');
          for (let j = 0; j <= 10; j++) {
            const p = lerp(f.a, f.b, j / 10);
            solid(face, circle(p, 0.075, 4), 34, 35.2, 'trim');
          }
        }
      }
    }
    if (d >= 2)
      for (const p of r)
        solid(face, R(p[0] - 0.22, p[1] - 0.22, p[0] + 0.22, p[1] + 0.22), 4.5, base - 0.3, 'trim');
  }
}
function spire(out, face, d, hs) {
  const p = rec.estimated.spireCenter,
    r = spireRing(),
    dark = (_s, ps, n) =>
      face(
        'copper',
        ps,
        n,
        colors.copper.map((v) => v * 0.65),
      );
  if (d >= 2)
    shell(
      out,
      d,
      r,
      24,
      39,
      hs.filter((h) => h.name.startsWith('spire-shaft')),
      'copper',
      scaled(r, 0.7),
    );
  else solid(face, r, 24, 39, 'copper');
  profile(
    face,
    r,
    d < 2
      ? [
          [39, 1],
          [48, 0.6],
          [64, 0.02],
        ]
      : [
          [39, 1],
          [42, 0.9],
          [48, 0.6],
          [56, 0.24],
          [64, 0.02],
        ],
    'copper',
  );
  finial(face, p, 64, 66, d, 'copper');
  if (d >= 1) {
    band(face, r, 28.7, 0.5, 'copper', 1.08);
    band(face, r, 38.6, 0.5, 'copper', 1.1);
  }
  if (d >= 2) {
    for (let i = 0; i < 8; i++) {
      const v = r[i].map((q, k) => q - p[k]);
      beam(face, at(r[i], 24), at(r[i], 39), 0.16, 'copper');
      for (const [a, b] of [
        [39, 42],
        [42, 48],
        [48, 56],
        [56, 64],
      ]) {
        const f = (y) =>
          y <= 42
            ? 1 - ((y - 39) * 0.1) / 3
            : y <= 48
              ? 0.9 - ((y - 42) * 0.3) / 6
              : y <= 56
                ? 0.6 - ((y - 48) * 0.36) / 8
                : 0.24 - ((y - 56) * 0.22) / 8;
        beam(
          face,
          at(
            p.map((q, k) => q + v[k] * (f(a) + 0.008)),
            a,
          ),
          at(
            p.map((q, k) => q + v[k] * (f(b) + 0.008)),
            b,
          ),
          0.12,
          'copper',
        );
      }
      finial(
        face,
        p.map((q, k) => q + v[k] * 1.22),
        33.2,
        40.3,
        d,
        'copper',
      );
      const f = faceFrame(r, i);
      for (let j = 0; j < (d >= 3 ? 5 : 3); j++) {
        const y = 24.5 + j * 0.7,
          pp = lerp(f.a, f.b, 0.5),
          q = pp.map((v, k) => v + f.normal[k] * 0.05);
        beam(
          dark,
          at(q, y),
          at(
            q.map((v, k) => v + f.axis[k] * 0.65),
            y + 0.3,
          ),
          0.1,
          'copper',
        );
        beam(
          dark,
          at(q, y),
          at(
            q.map((v, k) => v - f.axis[k] * 0.65),
            y + 0.3,
          ),
          0.1,
          'copper',
        );
      }
    }
  }
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
          m = Math.max(...spans);
        if (m > (d <= 1 ? 16 : 9)) {
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
    bells = belfryFields(),
    cut = writer(masked(out, d >= 2 ? hs.map((h) => prepareOpening(h, 0, d)) : []), d),
    wall = (r, b, t) =>
      shell(out, d, d <= 1 ? coarse(r, d === 1 ? 0.65 : 1.4) : r, b, t, d >= 2 ? hs : []);
  for (const p of plans.groundBase) {
    wall(p.outline, footing, 4);
    if (d !== 0) cap(cut, d === 1 ? coarse(p.outline, 0.65) : p.outline, 4, 'wall');
  }
  for (const key of ['nave', 'choir', 'apse'])
    for (const p of plans[key]) {
      wall(d === 0 ? coarse(p.outline) : p.outline, 4, 17.8);
      if (key === 'apse') {
        hip(face, rec.estimated.apseRoof, 17.8, 25.5, 'roof', 0);
        if (d >= 2) cap(face, p.outline, 17.8, 'wall');
      } else gable(face, p.outline, 17.8, 25.5, 'roof', 0);
    }
  for (const key of ['aisleNorth', 'aisleSouth', 'southAnnex', 'northAnnex', 'stair', 'low'])
    for (const p of d === 0 && key === 'low' ? [] : plans[key]) {
      wall(d === 0 ? coarse(p.outline) : p.outline, 4, 10.5);
      hip(face, d === 0 ? coarse(p.outline) : p.outline, 10.5, 13.2, 'roof', 0);
    }
  for (const p of plans.maccabees) {
    wall(d === 0 ? coarse(p.outline) : p.outline, 4, 17.8);
    chapelRoof(face);
    if (d >= 2) cap(face, p.outline, 17.8, 'wall');
  }
  // Close the high chapel front as a thick triangular gable, independent of the lower pointed glass.
  const ch = plans.maccabees[0].outline,
    cf = edge(ch, [-1, 0]),
    cm = lerp(cf.a, cf.b, 0.5);
  slab(
    face,
    cm[0] - 0.05,
    0.65,
    [
      [cm[1] - 5.7, 17.8],
      [cm[1], 28.5],
      [cm[1] + 5.7, 17.8],
    ],
    'wall',
  );
  crossFinial(face, [cm[0], cm[1]], 28.5, 30.3);
  portico(face, out, d, hs);
  towers(out, face, d, hs, bells);
  spire(out, face, d, hs);
  if (d >= 1)
    for (const h of hs) {
      if (!h.name.startsWith('spire-shaft')) {
        panel(face, h, d);
        continue;
      }
      pane(face, h, d, d >= 2 ? -0.75 : 0.07, 'glass');
      if (d >= 2) archBand(face, h, d, 0.15, 'copper', 0.08);
    }
  if (d >= 2) {
    for (const key of ['aisleNorth', 'aisleSouth', 'maccabees', 'apse']) {
      const r = plans[key][0].outline;
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (
          (key === 'apse' && f.normal[0] < 0.2) ||
          (key !== 'apse' && Math.abs(f.normal[1]) < 0.65) ||
          f.length < 2.5
        )
          continue;
        const n = Math.max(1, Math.floor(f.length / 6.5));
        for (let j = 0; j <= n; j++) {
          const p = lerp(f.a, f.b, (j + 0.08) / (n + 0.16)),
            z = p.map((v, k) => v + f.normal[k] * 0.65),
            w = 0.5;
          const q = [
            p.map((v, k) => v - f.axis[k] * w),
            p.map((v, k) => v + f.axis[k] * w),
            z.map((v, k) => v + f.axis[k] * w),
            z.map((v, k) => v - f.axis[k] * w),
          ];
          const top = key === 'maccabees' ? 16.5 : key === 'apse' ? 16.8 : 10.1;
          solid(face, q, 4.5, top * 0.55, 'wall');
          solid(face, scaled(q, 0.75), top * 0.55, top, 'wall');
          cap(face, scaled(q, 0.82), top + 0.2, 'copper');
        }
      }
    }
    const p = rec.estimated.spireCenter;
    beam(face, at([-28, 0], 25.55), at([p[0], 0], 25.55), 0.15, 'copper');
    for (const h of hs.filter((h) => h.name.startsWith('maccabees'))) {
      const v = prepareOpening(h, 0, d),
        sg = Math.sign(-v.axis[1] * h.normal[0] + v.axis[0] * h.normal[1]);
      for (const t of [-0.25, 0, 0.25])
        beam(
          face,
          v.point(h.width * t, h.bottom, -0.62 * sg),
          v.point(h.width * t, h.bottom + h.spring, -0.62 * sg),
          0.1,
          'trim',
        );
      if (d >= 3)
        for (const t of [-0.25, 0.25]) {
          const rr = openingShape(
            {
              ...h,
              width: h.width * 0.34,
              height: h.width * 0.34,
              bottom: h.bottom + h.spring - 0.4,
              spring: 0,
              shape: 'circle',
            },
            d,
          );
          face(
            'glass',
            rr.map((q) => v.point(q[0] + h.width * t, q[1], -0.63 * sg)),
            [h.normal[0], 0, h.normal[1]],
          );
        }
    }
  }
}
export const buildStPierreSkyline = (o) => build(o, 0),
  buildStPierreDistrict = (o) => build(o, 1),
  buildStPierreStreet = (o) => build(o, 2),
  buildStPierreCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const stPierreStudy = {
  id: 'st_pierre_cathedral',
  key: 'st_pierre_cathedral',
  title: 'St. Pierre Cathedral',
  category: 'cathedral',
  wikidataId: 'Q666516',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID main and ten component controls;312 current vertices. Western portico/Maccabees chapel versus rounded eastern apse sign facing.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing cached256-square coursed limestone,continuous limestone,flat tile,copper and plain-wood graphs serve seven merged groups. Linear stone/brown/green/wood tints,metric UVs,flat architectural normals; glass/ironwork use geometric PBR colors. No embedded images,unique facade maps or baked shadows.',
  importReason:
    'Four authored browser levels preserve the six-column open portico,Maccabees chapel,long tiled nave/apse,unequal open belfry towers and tall green octagonal central spire.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from inspected2013 front,2014 southwest,2020 elevated and undated older rear-detail pictures plus standard viewer PMTiles/DEM only. Heights/vertical subdivisions,minor annex functions,roof/vault shapes and ornament are estimates. The older rear picture does not establish current finish; the elevated picture crops the central spire tip. Exact coats of arms,statue identity/fine tracery,roof decoration/vanes,full interiors and surveyed paving/thresholds remain approximate or excluded. Physical phone/laptop timings pending.',
    'Skyline retains pale six-column front/crown/rounded vault,tiled roofs,unequal towers and green shaft/tall spire; windows/small balustrades omitted. District adds shared surfaces,flat glazing/portal fields and actual open tower arcades. Street adds real recessed glazing/wood doors,sparse copper ribs/panels,buttresses,balustrade/pinnacles;closeup/master refine column capitals/tracery/dormers. Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('six-column-portico-and-recessed-doors', [-77, 17, 14], [-33, 10, -2]),
    cam('maccabees-gothic-chapel', [-66, 32, 62], [-24, 15, 14]),
    cam('unequal-open-belfry-towers', [65, 48, 66], [15, 32, 0]),
    cam('green-octagonal-shaft-and-spire', [-20, 59, 38], [15.2, 43, 0.2]),
    cam('east-apse-and-tower-roofs', [83, 50, -22], [24, 22, 0]),
    cam('roof-and-signed-map-plan', [0, 170, 1], [0, 25, 0]),
  ],
};

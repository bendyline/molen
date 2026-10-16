/** Saint Gregory the Illuminator Cathedral: warm stone complex, faceted cupolas and deep western entrance. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/sz/szp/n0373_saint_gregory_the_illuminator_cathedral/',
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
  wall: '#e4caa6',
  spire: '#b48c7c',
  trim: '#ead9b8',
  roof: '#b4a28b',
  door: '#765132',
  glass: '#49575a',
  accent: '#514e45',
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
const footing = (p) => Math.min(floor - 0.3, yerevanGregoryGround(...p) - 0.35);
export function yerevanGregoryGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Saint Gregory the Illuminator Cathedral footing outside retained terrain');
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
function _gable(face, r, eave, top, slot = 'roof', axis = 0) {
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
const plans = rec.plans,
  est = rec.estimated,
  point = (f, t = 0.5) => lerp(f.a, f.b, t),
  oct = (p, r) =>
    Array.from({ length: 8 }, (_, i) => [
      p[0] + Math.cos((i / 8) * Math.PI * 2) * r,
      p[1] + Math.sin((i / 8) * Math.PI * 2) * r,
    ]);
const clean = (r) =>
    r.filter((p, i) => i === 0 || Math.hypot(...p.map((v, k) => v - r[i - 1][k])) > 0.001),
  main = clean(rec.main.polygons[0].outline),
  mainDrum = oct(est.mainDrum.center, est.mainDrum.radius),
  chapels = Object.fromEntries(
    Object.entries(est.chapels).map(([n, v]) => [n, oct(v.center, v.radius)]),
  ),
  bellRing = oct(est.bell.center, est.bell.radius),
  front = edge(plans.entry[0].outline, [-1, 0]),
  portalPoint = point(front),
  portalFloor = Math.max(0.3, yerevanGregoryGround(...portalPoint) + 0.22 - floor);
const field = (name, f, p, w, b, h, shape = 'rect', spring = h, kind = 'window', depth = 2.4) => ({
  ...hole(name, p, f.axis, f.normal, w, b, h, spring, shape, depth),
  kind,
});
export function yerevanGregoryFields() {
  const fields = [];
  for (const p of plans.church)
    for (let i = 0; i < p.outline.length; i++) {
      const f = faceFrame(p.outline, i),
        m = point(f);
      if (f.length < 7) continue;
      if (m[0] < -12.9) {
        for (const t of [0.25, 0.5, 0.75])
          fields.push(field(`main-west-upper-${i}-${t}`, f, point(f, t), 1.4, 17, 3.2));
        continue;
      }
      const count = f.length > 16 ? 3 : 2;
      for (let j = 0; j < count; j++) {
        const p = point(f, (j + 0.5) / count),
          w = 1.3;
        for (const [b, h] of [
          [1.8, 6.5],
          [11.1, 7.1],
        ])
          fields.push(field(`main-side-${i}-${j}-${b}`, f, p, w, b, h));
      }
    }
  for (const name of ['chapelNorth', 'chapelSouth'])
    for (const p of plans[name])
      for (let i = 0; i < p.outline.length; i++) {
        const f = faceFrame(p.outline, i),
          m = point(f),
          outer =
            f.normal[0] < -0.15 ||
            (name === 'chapelNorth' ? f.normal[1] < -0.15 : f.normal[1] > 0.15) ||
            (m[0] > -17 && f.normal[0] > 0.15);
        if (f.length < 5 || !outer) continue;
        const count = f.length > 16 ? 2 : 1;
        for (let j = 0; j < count; j++)
          for (const [b, h] of [
            [1.8, 5.5],
            [10, 5.8],
          ])
            fields.push(
              field(`${name}-side-${i}-${j}-${b}`, f, point(f, (j + 0.5) / count), 1.25, b, h),
            );
      }
  fields.push(
    field(
      'west-deep-main-portal',
      front,
      portalPoint,
      6.4,
      portalFloor,
      10.6,
      'round',
      7.4,
      'portal',
      10,
    ),
  );
  for (const t of [0.17, 0.83])
    fields.push(
      field(
        `west-flanking-bay-${t}`,
        front,
        point(front, t),
        4.5,
        0.6,
        14.2,
        'round',
        11.95,
        'bay',
        5,
      ),
    );
  const bf = edge(est.bell.shaft, [-1, 0]);
  for (const off of [-1.2, 1.2])
    fields.push(
      field(
        `entrance-paired-slot-${off}`,
        bf,
        point(bf).map((v, k) => v + bf.axis[k] * off),
        1.15,
        20.5,
        5.6,
        'round',
        5.02,
      ),
    );
  for (let i = 0; i < mainDrum.length; i++) {
    const f = faceFrame(mainDrum, i);
    for (const off of [-1.9, 1.9])
      fields.push(
        field(
          `main-drum-${i}-${off}`,
          f,
          point(f).map((v, k) => v + f.axis[k] * off),
          1.45,
          35,
          5.8,
        ),
      );
  }
  for (const [name, r] of Object.entries(chapels))
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      fields.push(field(`${name}-drum-${i}`, f, point(f), 1.35, 24.2, 4.8));
    }
  for (let i = 0; i < bellRing.length; i++) {
    const f = faceFrame(bellRing, i);
    fields.push(
      field(`open-bell-arcade-${i}`, f, point(f), 1.55, 27.6, 2.8, 'rect', 2.8, 'bell-open', 10),
    );
  }
  return fields;
}
function facade(face, h, d) {
  if (h.kind === 'bell-open') {
    if (d >= 2) archBand(face, h, d, 0.18, 'trim', 0.06);
    return;
  }
  if (h.kind === 'portal') {
    pane(face, h, d, d >= 2 ? -4.1 : 0.04, 'accent');
    pane(
      face,
      { ...h, width: 4.6, height: 4.7, spring: 4.7, shape: 'rect' },
      d,
      d >= 2 ? -3.85 : 0.08,
      'door',
    );
    if (d >= 2)
      for (const [w, off] of [
        [0.3, 0.08],
        [0.65, 0.16],
        [1.0, 0.23],
      ])
        archBand(face, h, d, w, 'trim', off);
    return;
  }
  if (h.kind === 'bay') {
    pane(face, h, d, d >= 2 ? -1.65 : 0.04, 'accent');
    const door = { ...h, width: 2.6, bottom: floor + 0.6, height: 4.3, spring: 3, shape: 'round' },
      glass = { ...h, width: 2.7, bottom: floor + 8.1, height: 6.1, spring: 4.75, shape: 'round' };
    pane(face, door, d, d >= 2 ? -1.5 : 0.08, 'door');
    pane(face, glass, d, d >= 2 ? -1.5 : 0.08, 'glass');
    if (d >= 2) {
      archBand(face, h, d, 0.3, 'trim', 0.06);
      const p = prepareOpening(glass, 0, d),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      beam(
        face,
        p.point(0, glass.bottom, -1.4 * sg),
        p.point(0, glass.bottom + glass.spring, -1.4 * sg),
        0.12,
        'trim',
      );
    }
    return;
  }
  pane(face, h, d, d >= 2 ? -0.65 : 0.045, 'glass');
  if (d >= 3) archBand(face, h, d, 0.17, 'trim', 0.07);
  if (d < 2 || h.width < 1.6) return;
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  beam(
    face,
    p.point(0, h.bottom, -0.57 * sg),
    p.point(0, h.bottom + h.height, -0.57 * sg),
    0.085,
    'trim',
  );
}
function fanRoof(face, r, eave, top, p) {
  for (let i = 0; i < r.length; i++)
    face('roof', [at(r[i], eave), at(r[(i + 1) % r.length], eave), at(p, top)], [0, 1, 0]);
}
function cupola(face, r, b, top, tip, d) {
  profile(
    face,
    r,
    [
      [b, 1.04],
      [top, 0.025],
    ],
    'roof',
  );
  if (d >= 1)
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        p = point(f),
        normal = [f.normal[0], 0, f.normal[1]],
        out = (v) => [v[0] + f.normal[0] * 0.06, v[1], v[2] + f.normal[1] * 0.06],
        front = [out(at(f.a, b)), out(at(f.b, b)), out(at(p, b + (top - b) * 0.23))],
        back = front.map((p) => [p[0] - f.normal[0] * 0.23, p[1], p[2] - f.normal[1] * 0.23]);
      face('trim', front, normal);
      face(
        'trim',
        back,
        normal.map((v) => -v),
      );
      for (let k = 0; k < 3; k++)
        face('trim', [front[k], front[(k + 1) % 3], back[(k + 1) % 3], back[k]]);
      if (d >= 3) {
        beam(face, front[0], front[2], 0.13, 'roof');
        beam(face, front[2], front[1], 0.13, 'roof');
      }
    }
  const p = center(r);
  beam(face, at(p, top - 0.15), at(p, tip), d === 0 ? 0.18 : 0.13, 'accent');
  if (d >= 1) {
    const y = tip - (tip - top) * 0.35,
      w = tip > 50 ? 1.55 : 0.95;
    beam(face, at([p[0] - w / 2, p[1]], y), at([p[0] + w / 2, p[1]], y), 0.13, 'accent');
  }
}
function skylight(face, d) {
  const r = oct(est.skylight.center, est.skylight.radius),
    upper = scaled(r, 0.6);
  sides(face, r, 16, 16.35, 'trim');
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    face(
      'glass',
      [at(r[i], 16.35), at(r[j], 16.35), at(upper[j], 19.3), at(upper[i], 19.3)],
      [0, 1, 0],
    );
    if (d >= 2) beam(face, at(r[i], 16.35), at(upper[i], 19.3), 0.12, 'accent');
  }
  cap(face, upper, 19.3, 'glass');
  if (d >= 1)
    for (let i = 0; i < 8; i++)
      beam(face, at(upper[i], 19.35), at(upper[(i + 1) % 8], 19.35), 0.15, 'accent');
}
function exteriorDetails(face, d) {
  const shaft = est.bell.shaft;
  for (const y of [16, 26.65]) band(face, shaft, y, 0.25, 'trim', 1.025);
  for (const r of [mainDrum, ...Object.values(chapels), bellRing]) {
    const y = r === mainDrum ? 41.55 : r === bellRing ? 30.7 : 29.6;
    band(face, r, y, 0.22, 'trim', 1.025);
  }
  // Four large rectangular outer piers are distinct from the smaller facade mullions.
  for (const [x, z] of [
    [7.2, 31],
    [24.9, 31],
    [6.3, -29.9],
    [22, -29.9],
  ]) {
    const r = _R(x - 0.8, z - 0.65, x + 0.8, z + 0.65);
    solid(face, r, footing, 25, 'wall');
    if (d >= 2) band(face, r, 24.5, 0.35, 'trim', 1.1);
  }
  const f = front,
    p = portalPoint,
    n = f.normal,
    facePoint = (x, y) => [
      p[0] + f.axis[0] * x + n[0] * 0.25,
      floor + y,
      p[1] + f.axis[1] * x + n[1] * 0.25,
    ];
  beam(face, facePoint(0, 14.7), facePoint(0, 19.3), 0.45, 'trim');
  beam(face, facePoint(-1.3, 17.6), facePoint(1.3, 17.6), 0.45, 'trim');
  const top = floor + portalFloor,
    start = yerevanGregoryGround(...p.map((v, k) => v + n[k] * 7)) + 0.1,
    count = Math.max(4, Math.min(30, Math.ceil((top - start) / 0.22))),
    axis = f.axis;
  for (let i = 0; i < count; i++) {
    const depth = (count - i) * 0.32,
      m = p.map((v, k) => v + (n[k] * depth) / 2),
      r = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([u, v]) => [
        m[0] + axis[0] * u * 5 + (n[0] * v * depth) / 2,
        m[1] + axis[1] * u * 5 + (n[1] * v * depth) / 2,
      ]);
    solid(face, r, footing, () => start + ((top - start) * (i + 1)) / count, 'trim');
  }
}
function build(target, d) {
  const limit = d === 0 ? 30 : d === 1 ? 24 : 16,
    out = {
      addTriangle(slot, ref, p, n, uv, col) {
        p = p.map((v) => v.map(Math.fround));
        const lengths = [0, 1, 2].map((i) =>
            Math.hypot(...p[i].map((v, k) => v - p[(i + 1) % 3][k])),
          ),
          i = lengths.indexOf(Math.max(...lengths));
        if (lengths[i] > limit) {
          const j = (i + 1) % 3,
            k = (i + 2) % 3,
            m = lerp(p[i], p[j], 0.5),
            u = lerp(uv[i], uv[j], 0.5);
          out.addTriangle(slot, ref, [p[i], m, p[k]], n, [uv[i], u, uv[k]], col);
          out.addTriangle(slot, ref, [m, p[j], p[k]], n, [u, uv[j], uv[k]], col);
          return;
        }
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-10
        )
          return;
        target.addTriangle(slot, ref, p, n, uv, col);
      },
    },
    face = writer(out, d),
    fields = yerevanGregoryFields(),
    wall = (r, b, t) => {
      if (d >= 2) shell(out, d, r, b, t, fields);
      else sides(face, r, b, t, 'wall');
    };
  wall(main, footing, 12);
  for (const p of plans.church) {
    wall(p.outline, 12, 21);
    fanRoof(face, p.outline, 21, 40, est.mainDrum.center);
  }
  for (const name of ['chapelNorth', 'chapelSouth'])
    for (const p of plans[name]) {
      wall(p.outline, 12, 18);
      hip(face, p.outline, 18, 23, 'roof', 0);
    }
  for (const p of plans.entry) {
    wall(p.outline, 12, 16);
    cap(face, p.outline, 16, 'roof', p.holes);
  }
  wall(mainDrum, 21, 42);
  cupola(face, mainDrum, 42, 52, 54, d);
  for (const r of Object.values(chapels)) {
    wall(r, 18, 30);
    cupola(face, r, 30, 34, 36, d);
  }
  wall(est.bell.shaft, 16, 27);
  cap(face, est.bell.shaft, 27, 'roof', [bellRing]);
  if (d >= 1)
    shell(
      out,
      d,
      bellRing,
      27,
      31,
      fields.filter((h) => h.kind === 'bell-open'),
      'wall',
      scaled(bellRing, 0.68),
    );
  else sides(face, bellRing, 27, 31, 'wall');
  cupola(face, bellRing, 31, 35, 37, d);
  skylight(face, d);
  if (d >= 1) {
    for (const h of fields) facade(face, h, d);
    exteriorDetails(face, d);
  }
}
export const buildYerevanGregorySkyline = (o) => build(o, 0),
  buildYerevanGregoryDistrict = (o) => build(o, 1),
  buildYerevanGregoryStreet = (o) => build(o, 2),
  buildYerevanGregoryCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const yerevanGregoryStudy = {
  id: 'N0373',
  key: 'saint_gregory_the_illuminator_cathedral',
  title: 'Saint Gregory the Illuminator Cathedral',
  category: 'cathedral',
  wikidataId: 'Q2942349',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'One exact-QID current whole footprint. Projecting west portal, two lower western chapels and larger rear church sign retained long axis; all interior partitions/drum centers are picture estimates.',
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
    'Four existing shared256-square ashlar, limestone, granite and plain wood graphs. Linear warm stone/brown roof tints, metric UVs and flat architectural normals. Dark-backed glazing/vaults, blue skylight and metal crosses use geometric PBR colors. No embedded images, bespoke facade maps or baked shadows.',
  importReason:
    'Four authored browser tiers preserve the main54m faceted drum/cone, two lower chapel cupolas, projecting gateway/bell shaft, deep west entrance, polygonal skylight and complete signed mapped envelope.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from inspected2025 west front and2019 aerial plus standard viewer PMTiles/DEM only. Two lower chapel cupolas, entrance belfry, main drum/roof, blue skylight and three deep front bays are individual architectural forms. Exact stone panel seams/carving/inscriptions, glass artwork, bells/interiors, hidden rear fenestration/rooms/roof joins, park/long approach/lamps and surveyed plaza/thresholds remain approximate or excluded. Native belfry openings are real voids; other doors/windows have closed geometric backing. Physical laptop/phone timing pending.',
    'Skyline keeps the complete massing, large/two smaller chapel cupolas, entrance belfry and skylight. District adds shared surfaces, flat slits/bays, relief cross and open small bell arcade. Street adds actual recesses, deep portal/backing and larger mullions. Closeup/master refine nested surrounds and triangular pediment trim. Synthetic cottage context is a review fixture.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-deep-vault-and-flanking-bays', [-101, 24, 17], [-44, 12, 1]),
    cam('main-paired-slit-drum-and-pediment-cone', [68, 62, 59], [16, 41, 0]),
    cam('south-chapel-stacked-fields-and-cupola', [-69, 32, 74], [-25, 19, 22]),
    cam('west-bell-arcade-and-roof-skylight', [-71, 43, 39], [-36, 27, 1]),
    cam('main-south-side-and-rear-altar', [99, 44, 97], [24, 18, 13]),
    cam('roof-and-signed-plan', [0, 178, 1], [0, 25, 0]),
  ],
};

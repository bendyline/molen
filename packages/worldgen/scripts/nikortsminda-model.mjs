/** Nikortsminda: compact stone cross church,12-sided slit drum and western bell/porch partition. */
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
  '../../../content/worldgen/source/places/sz/szw/n0377_nikortsminda_cathedral/',
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
  wall: '#d4c9b5',
  spire: '#8e8175',
  trim: '#e4d7bd',
  roof: '#aebbbd',
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
const footing = (p) => Math.min(floor - 0.3, nikortsmindaGround(...p) - 0.35);
export function nikortsmindaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Nikortsminda Cathedral footing outside retained terrain');
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
  plans = rec.plans,
  main = rec.main.polygons[0].outline,
  est = rec.estimated,
  circle = (p, r, n = 12, phase = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    }),
  drum = circle(est.drumCenter, est.drumRadius, 12, Math.PI / 12);
const bb = plans.bell[0].outline,
  bell = R(
    Math.min(...bb.map((p) => p[0])),
    Math.min(...bb.map((p) => p[1])),
    Math.max(...bb.map((p) => p[0])),
    Math.max(...bb.map((p) => p[1])),
  ),
  bellUpper = scaled(bell, 0.74);
const south = edge(plans.cross[0].outline, [0, 1]),
  east = edge(plans.nave[0].outline, [1, 0]),
  southPoint = lerp(south.a, south.b, 0.5);
function fields() {
  const a = [
    {
      ...hole(
        'south-door',
        southPoint,
        south.axis,
        south.normal,
        1.65,
        0.3,
        2.8,
        1.975,
        'round',
        3,
      ),
      kind: 'door',
    },
  ];
  for (let i = 0; i < 12; i++) {
    const f = faceFrame(drum, i);
    a.push(
      hole(`drum-slit-${i}`, lerp(f.a, f.b, 0.5), f.axis, f.normal, 0.6, 14, 5.3, 5, 'round', 2),
    );
  }
  for (const [side, f] of [
    ['south', south],
    ['east', east],
    ['north', edge(plans.cross[0].outline, [0, -1])],
  ])
    for (const [u, w, b, h] of [
      [-0.28, 0.45, 4.1, 2.6],
      [0, 0.55, 4.5, 3.4],
      [0.28, 0.45, 4.1, 2.6],
    ]) {
      const p = lerp(f.a, f.b, 0.5 + u);
      a.push(hole(`${side}-slit-${u}`, p, f.axis, f.normal, w, b, h, h - w / 2, 'round', 3));
    }
  for (let i = 0; i < bell.length; i++) {
    const f = faceFrame(bell, i);
    if (f.normal[0] > 0.5 || f.normal[1] < -0.5) continue;
    a.push({
      ...hole(
        `bell-lower-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        f.normal[0] < -0.5 ? 1.45 : 1.1,
        f.normal[0] < -0.5 ? 0.3 : 1.3,
        3.4,
        2.675,
        'round',
        3,
      ),
      kind: f.normal[0] < -0.5 ? 'door' : 'window',
    });
  }
  return a;
}
export const nikortsmindaFields = fields;
function bellFields() {
  const a = [];
  for (const [name, r, b, h] of [
    ['middle', bell, 6.5, 4.2],
    ['upper', bellUpper, 12.0, 3.3],
  ])
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (name === 'middle' && f.normal[0] > 0.65) continue;
      a.push({
        ...hole(
          `${name}-bell-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          f.length - (name === 'middle' ? 1.55 : 1.3),
          b,
          h,
          h - (f.length - (name === 'middle' ? 1.55 : 1.3)) / 2,
          'round',
          4,
        ),
        tier: name,
      });
    }
  return a;
}
export const nikortsmindaBelfryFields = bellFields;
function panel(face, h, d) {
  pane(face, h, d, d >= 2 ? -0.55 : 0.05, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, 0.2, 'trim', 0.09);
  if (d >= 3) archBand(face, h, d, 0.38, 'trim', 0.14);
  if (h.kind === 'door') {
    const p = prepareOpening(h, 0, d),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    beam(
      face,
      p.point(0, h.bottom, -0.52 * sg),
      p.point(0, h.bottom + h.spring, -0.52 * sg),
      0.09,
      'accent',
    );
  }
}
function crossTop(face, p, b, t, d) {
  beam(face, at(p, b), at(p, t), d === 0 ? 0.15 : 0.11, 'accent');
  if (d >= 1)
    beam(
      face,
      [p[0], floor + t - 0.35, p[1] - 0.28],
      [p[0], floor + t - 0.35, p[1] + 0.28],
      0.1,
      'accent',
    );
}
function rosette(face, p, axis, n, y, r, d) {
  const N = d >= 3 ? 16 : 8,
    pt = (rad, a, off = 0.16) => [
      p[0] + axis[0] * Math.cos(a) * rad + n[0] * off,
      floor + y + Math.sin(a) * rad,
      p[1] + axis[1] * Math.cos(a) * rad + n[1] * off,
    ];
  for (let i = 0; i < N; i++) {
    const a = (i * Math.PI * 2) / N,
      b = ((i + 1) * Math.PI * 2) / N;
    face('trim', [pt(r, a), pt(r, b), pt(r * 0.57, b), pt(r * 0.57, a)], [n[0], 0, n[1]]);
  }
  if (d >= 3)
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      beam(face, pt(r * 0.12, a), pt(r * 0.5, a), 0.07, 'trim');
    }
}
function relief(face, f, d) {
  if (d < 1) return;
  const p = lerp(f.a, f.b, 0.5),
    scale = Math.min(1, f.length / 12.2),
    pt = (u, y, off = 0.16) => [
      p[0] + f.axis[0] * u + f.normal[0] * off,
      floor + y,
      p[1] + f.axis[1] * u + f.normal[1] * off,
    ];
  beam(face, pt(0, 10.1), pt(0, 12.6), 0.2, 'trim');
  beam(face, pt(-0.85, 11.65), pt(0.85, 11.65), 0.2, 'trim');
  if (d >= 2) {
    for (const u of [-1.8, 1.8])
      rosette(face, [p[0] + f.axis[0] * u, p[1] + f.axis[1] * u], f.axis, f.normal, 11.3, 0.62, d);
    for (const [u, w, h, s] of [
      [0, 5.0, 10.2, 7.7],
      [-4.1, 2.9, 7.4, 5.95],
      [4.1, 2.9, 7.4, 5.95],
    ]) {
      const q = [p[0] + f.axis[0] * u * scale, p[1] + f.axis[1] * u * scale],
        a = hole('blind-facade', q, f.axis, f.normal, w * scale, 0.8, h, s, 'round', 1);
      archBand(face, a, d, 0.18, 'trim', 0.08);
      if (d >= 3) archBand(face, a, d, 0.37, 'trim', 0.12);
    }
  }
}
function campanile(out, face, d, hs, bells) {
  if (d >= 2) shell(out, d, bell, 5, 6, hs);
  else sides(face, bell, 5, 6, 'wall');
  for (const [name, r, b, t] of [
    ['middle', bell, 6, 11.5],
    ['upper', bellUpper, 11.5, 16],
  ]) {
    const holes = bells.filter((h) => h.tier === name);
    if (d >= 1) shell(out, d, r, b, t, holes, 'wall', scaled(r, 0.55));
    else sides(face, r, b, t, 'wall');
    cap(face, r, b, 'roof');
    cap(face, r, t, 'trim', [scaled(r, 0.55)]);
    if (d >= 1) for (const h of holes) archBand(face, h, d, 0.18, 'trim', 0.08);
  }
  hip(face, bellUpper, 16, 18.4, 'roof', 0);
  crossTop(face, center(bellUpper), 18.4, 19.2, d);
  if (d >= 1) {
    for (const [r, y] of [
      [bell, 5.7],
      [bell, 11.2],
      [bellUpper, 15.7],
    ])
      band(face, r, y, 0.3, 'trim', 1.06);
    if (d >= 2)
      for (const p of bellUpper) {
        solid(face, circle(p, 0.17, d >= 3 ? 8 : 4), 11.8, 15.4, 'trim');
        solid(face, R(p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3), 15.3, 15.7, 'trim');
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
        const spans = p.map((a, i) =>
            Math.hypot(a[0] - p[(i + 1) % 3][0], a[2] - p[(i + 1) % 3][2]),
          ),
          m = Math.max(...spans),
          max = d === 0 ? 16 : 7;
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
    cut =
      d >= 2
        ? writer(
            masked(
              out,
              hs.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
            ),
            d,
          )
        : face,
    wall = (r, b, t) => {
      if (d >= 2) shell(out, d, r, b, t, hs);
      else sides(face, r, b, t, 'wall');
    };
  wall(main, footing, 5);
  cap(cut, main, 5, 'roof');
  for (const n of ['nave', 'cross'])
    for (const p of plans[n]) {
      wall(p.outline, 5, 9);
      gable(
        (slot, p, n, ...rest) =>
          slot === 'wall' ? cut(slot, p, n, ...rest) : face(slot, p, n, ...rest),
        p.outline,
        9,
        13.4,
        'roof',
        n === 'cross' ? 1 : 0,
      );
    }
  for (const p of plans.porch) {
    wall(p.outline, 5, 6);
    gable(face, p.outline, 6, 8.4, 'roof', 0);
  }
  for (const p of plans.low) {
    wall(p.outline, 5, 6.5);
    cap(face, p.outline, 7.2, 'roof');
    sides(face, p.outline, 6.5, 7.2, 'wall');
  }
  wall(drum, 9, 21);
  profile(
    face,
    scaled(drum, 1.04),
    [
      [21, 1],
      [24.8, 0.025],
    ],
    'roof',
  );
  crossTop(face, est.drumCenter, 24.8, 25.8, d);
  campanile(out, face, d, hs, bells);
  if (d >= 1) {
    for (const h of hs) panel(face, h, d);
    for (const f of [south, east]) relief(face, f, d);
    band(face, drum, 12.1, 0.3, 'trim', 1.015);
    band(face, drum, 20.4, 0.45, 'trim', 1.035);
    if (d >= 2)
      for (let i = 0; i < drum.length; i++) {
        const f = faceFrame(drum, i),
          h = hole(
            `drum-blind-${i}`,
            lerp(f.a, f.b, 0.5),
            f.axis,
            f.normal,
            1.95,
            13.0,
            7.15,
            6.175,
            'round',
            1,
          );
        archBand(face, h, d, 0.15, 'trim', 0.07);
        if (d >= 3) {
          archBand(face, h, d, 0.3, 'trim', 0.11);
          solid(face, circle(f.a, 0.095, 4), 13.0, 20.25, 'trim');
        }
      }
    if (d >= 2) {
      const f = south,
        p = southPoint;
      for (let i = 0; i < 3; i++) {
        const a = [
            p[0] + f.normal[0] * (0.1 + i * 0.35) - f.axis[0] * 1.5,
            p[1] + f.normal[1] * (0.1 + i * 0.35) - f.axis[1] * 1.5,
          ],
          b = [a[0] + f.axis[0] * 3, a[1] + f.axis[1] * 3],
          c = [b[0] + f.normal[0] * 0.45, b[1] + f.normal[1] * 0.45],
          e = [a[0] + f.normal[0] * 0.45, a[1] + f.normal[1] * 0.45];
        solid(face, [a, b, c, e], footing, 0.25 - i * 0.07, 'trim');
      }
    }
  }
}
export const buildNikortsmindaSkyline = (o) => build(o, 0),
  buildNikortsmindaDistrict = (o) => build(o, 1),
  buildNikortsmindaStreet = (o) => build(o, 2),
  buildNikortsmindaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const nikortsmindaStudy = {
  id: 'N0377',
  key: 'nikortsminda_cathedral',
  title: 'Nikortsminda Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1802388',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID whole current footprint, no separate component controls. Western projection interpreted as approximate campanile/porch; wider east body carries estimated central drum.',
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
    'Four existing cached256-square ashlar, limestone, standing-seam metal and plain wood graphs. Linear gray/tan stone/silver metal tints, metric UVs and flat architectural normals. Glass and metal crosses use geometric PBR colors. No embedded images, unique facade maps or baked shadows.',
  importReason:
    'Four authored browser levels preserve compact stone cross church,12-sided tall slit drum/conical silver roof/cross, western tiered campanile and mapped whole envelope.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three inspected2007 church/drum/campanile pictures and current standard viewer PMTiles/DEM only. Old reference date and exact current roof finish remain limitations. Campanile internal partition/connection is approximate within about3m, with no independent mapped footprint; nearby unverified buildings are preserved. Fine figurative carving/interlace/inscriptions, frescoes/full interior/bells, hidden rear windows/roof joins and surveyed court/thresholds remain approximate or excluded. Physical laptop/phone timing pending.',
    'Skyline keeps complete mapped massing, silver cross gables, polygonal high drum/cone and western campanile. District adds shared textures, flat slits and real open bell tiers. Street adds wall/drum recesses, selected blind arcades/relief crosses/rosettes and bell columns. Closeup/master refine nested stone bands and simple cornice rhythms. Synthetic cottages are review fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('south-portal-and-stone-blind-arcades', [0, 16, 37], [2, 7, 9]),
    cam('twelve-sided-drum-and-silver-cone', [25, 28, 26], [2.5, 19, -0.8]),
    cam('western-bell-arcades', [-37, 21, -25], [-9.3, 10, -3.8]),
    cam('east-gable-relief-and-slit-windows', [37, 17, 14], [10, 9, 0]),
    cam('north-porch-and-roof-joins', [-13, 24, -34], [0, 10, -2]),
    cam('roof-and-signed-plan', [0, 88, 1], [0, 12, 0]),
  ],
};

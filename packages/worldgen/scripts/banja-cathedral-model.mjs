/** Banja Luka: five gilded domes,banded stone church and separate tall clock/bell tower. */
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
  '../../../content/worldgen/source/places/sr/sru/n0389_cathedral_of_christ_the_saviour/',
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
  wall: '#d7ba9b',
  ochre: '#e5c997',
  pink: '#d7ada9',
  base: '#899093',
  trim: '#eeeae0',
  roof: '#66717a',
  spire: '#c3a85e',
  door: '#ab754a',
  glass: '#435663',
  accent: '#42494e',
  clock: '#eeeae0',
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
const footing = (p) => Math.min(floor - 0.3, banjaCathedralGround(...p) - 0.35);
export function banjaCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('BanjaCathedral Cathedral footing outside retained terrain');
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
function clipY(poly, y, above) {
  const result = [];
  let a = poly.at(-1),
    av = (a[1] - y) * (above ? 1 : -1);
  for (const b of poly) {
    const bv = (b[1] - y) * (above ? 1 : -1);
    if (av >= -1e-8 !== bv >= -1e-8) {
      const t = av / (av - bv);
      result.push(lerp(a, b, t));
    }
    if (bv >= -1e-8) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
function writer(out, d) {
  return (slot, poly, direction, colorOverride) => {
    let p = poly.map((v) => v.map(Math.fround));
    if (p.length < 3) return;
    if (direction)
      for (let i = 1; i < p.length - 1; i++) {
        const n = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...n) < 0.5) continue;
        if (n.reduce((sum, v, k) => sum + v * direction[k], 0) < 0) p = p.toReversed();
        break;
      }
    function emit(r, tint) {
      const color = d === 0 ? tint.map((v, k) => v * means[slot][k]) : tint;
      for (let i = 1; i < r.length - 1; i++) {
        const t = [r[0], r[i], r[i + 1]].map((v) => v.map(Math.fround));
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
    }
    if (slot !== 'wall' || colorOverride || d <= 1) {
      emit(p, colorOverride ?? colors[slot]);
      return;
    }
    const low = Math.min(...p.map((v) => v[1])),
      high = Math.max(...p.map((v) => v[1])),
      step = d === 2 ? 1.36 : 0.68;
    if (low < floor + 0.8) {
      const q = clipY(p, floor + 0.8, false);
      if (q.length >= 3) emit(q, colors.base);
    }
    for (
      let k = Math.max(0, Math.floor((low - floor - 0.8) / step));
      floor + 0.8 + k * step <= high + 1e-7;
      k++
    ) {
      const y = floor + 0.8 + k * step,
        q = clipY(clipY(p, y, true), y + step, false);
      if (q.length >= 3) emit(q, k % 2 ? colors.pink : colors.ochre);
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
    // Near carved ribs carry depth; street bands retain only the broad face.
    if (d >= 3)
      face(slot, [
        p.point(...outer[i], 0),
        p.point(...outer[j], 0),
        p.point(...outer[j], offset),
        p.point(...outer[i], offset),
      ]);
    if (d >= 3)
      face(slot, [
        p.point(...inner[i], offset),
        p.point(...inner[j], offset),
        p.point(...inner[j], 0),
        p.point(...inner[i], 0),
      ]);
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
const main = rec.main.polygons[0].outline,
  plans = rec.plans,
  est = rec.estimated,
  bell = rec.controls[1].polygons[0].outline;
// Exterior union of the nave, cross arm and four corner ranges: omit hidden shared walls.
const upperBody = [
  [-5.82, -10.4],
  [12.55, -10.4],
  [12.55, -5.7],
  [13.7, -5.7],
  [13.7, 2.8],
  [12.6, 2.8],
  [12.6, 7.7],
  [7.4, 7.7],
  [7.4, 7.8],
  [-1, 7.8],
  [-1, 7.7],
  [-5.82, 7.7],
  [-5.82, 2.8],
  [-7, 2.8],
  [-7, -5.7],
  [-5.82, -5.7],
];
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  circle = (p, r, n = 12, phase = Math.PI / n) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    });
const core = circle(est.drumCenter, est.drumRadius, 12),
  satellites = est.cornerCenters.map((p) => circle(p, est.cornerRadius, 8)),
  crown = circle(est.bellCenter, 2.53, 8);
const on = (f, u = 0) => {
  const p = lerp(f.a, f.b, 0.5);
  return [p[0] + f.axis[0] * u, p[1] + f.axis[1] * u];
};
function fields(d = 4) {
  const hs = [];
  for (const [name, n] of [
    ['northeast', [1, 0]],
    ['southwest', [-1, 0]],
  ]) {
    const f = edge(plans.cross, n),
      p = on(f);
    hs.push({
      ...hole(`${name}-door`, p, f.axis, f.normal, 1.75, 0.25, 3.4, 2.525, 'round', 3),
      kind: 'door',
    });
    hs.push({
      ...hole(`${name}-rose`, p, f.axis, f.normal, 2.45, 9.2, 2.45, 1.225, 'circle', 3),
      kind: 'rose',
    });
  }
  const front = edge(plans.porch, [0, -1]);
  for (const [u, w] of [
    [-2.55, 1.0],
    [0, 1.7],
    [2.55, 1.0],
  ])
    hs.push({
      ...hole(
        `porch-door-${u}`,
        on(front, u),
        front.axis,
        front.normal,
        w,
        0.25,
        2.85,
        2.2,
        'round',
        3,
      ),
      kind: 'door',
    });
  for (const [i, r] of plans.corners.entries())
    for (const n of [
      [1, 0],
      [-1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const f = edge(r, n);
      if (
        (i % 2 === 0 && n[0] > 0) ||
        (i % 2 === 1 && n[0] < 0) ||
        (i < 2 && n[1] > 0) ||
        (i >= 2 && n[1] < 0)
      )
        continue;
      const p = on(f);
      hs.push({
        ...hole(`corner-${i}-${n}-slit`, p, f.axis, f.normal, 0.65, 6.1, 2.7, 2.375, 'round', 2.6),
        kind: 'window',
      });
      if (Math.abs(n[0]) > 0)
        hs.push({
          ...hole(
            `corner-${i}-${n}-rose`,
            p,
            f.axis,
            f.normal,
            1.35,
            9.6,
            1.35,
            0.675,
            'circle',
            2.6,
          ),
          kind: 'rose',
        });
    }
  for (const [name, r, b, h, w] of [
    ['central', core, 15.5, 3.25, 0.7],
    ...satellites.map((r, i) => [`satellite-${i}`, r, 12.65, 2.6, 0.65]),
  ])
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      hs.push({
        ...hole(`${name}-drum-${i}`, on(f), f.axis, f.normal, w, b, h, h - w / 2, 'round', 2.2),
        kind: 'window',
        drum: true,
      });
    }
  for (let i = 0; i < bell.length; i++) {
    const f = faceFrame(bell, i);
    for (const u of [-0.67, 0.67])
      hs.push({
        ...hole(
          `bell-louver-${i}-${u}`,
          on(f, u),
          f.axis,
          f.normal,
          0.82,
          25.1,
          5.2,
          4.79,
          'round',
          3,
        ),
        kind: 'louver',
      });
    for (const b of [11.3, 20.2])
      hs.push({
        ...hole(`bell-slit-${i}-${b}`, on(f), f.axis, f.normal, 0.55, b, 2.9, 2.625, 'round', 3),
        kind: 'window',
      });
  }
  return d === 0 ? [] : hs;
}
export const banjaCathedralFields = fields;
function bellFields() {
  return crown.map((_, i) => {
    const f = faceFrame(crown, i);
    return {
      ...hole(
        `upper-bell-${i}`,
        on(f),
        f.axis,
        f.normal,
        f.length - 0.65,
        39,
        3.05,
        2.45,
        'round',
        3,
      ),
      kind: 'air',
    };
  });
}
export const banjaCathedralBelfryFields = bellFields;
function panel(face, h, d) {
  pane(
    face,
    h,
    d,
    d >= 2 || h.kind === 'door' ? -0.58 : 0.06,
    h.kind === 'door' ? 'door' : h.kind === 'louver' ? 'accent' : 'glass',
  );
  if (d >= 2) {
    archBand(face, h, d, h.kind === 'rose' ? 0.17 : 0.13, 'trim', 0.09);
    if (d >= 3 && !h.drum) archBand(face, h, d, 0.29, 'trim', 0.15);
  }
  if (d >= 2 && h.kind === 'rose') {
    const p = prepareOpening(h, 0, d),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
      N = d >= 3 ? 12 : 8,
      pt = (u, y) => p.point(u, h.bottom + h.height / 2 + y, -0.49 * sg),
      r = h.width * 0.46;
    for (let i = 0; i < N; i++) {
      const a = (i * Math.PI * 2) / N,
        b = ((i + 1) * Math.PI * 2) / N;
      beam(
        face,
        pt(Math.cos(a) * r, Math.sin(a) * r),
        pt(Math.cos(a + 0.9) * r * 0.43, Math.sin(a + 0.9) * r * 0.43),
        0.07,
        'trim',
      );
      if (d >= 3)
        beam(
          face,
          pt(Math.cos(a) * r * 0.43, Math.sin(a) * r * 0.43),
          pt(Math.cos(b) * r * 0.43, Math.sin(b) * r * 0.43),
          0.065,
          'trim',
        );
    }
  }
  if (d >= 2 && h.kind === 'louver') {
    const p = prepareOpening(h, 0, d),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    for (let y = 0.3; y < h.spring; y += d >= 3 ? 0.3 : 0.6)
      if (d >= 3)
        beam(
          face,
          p.point(-h.width * 0.42, h.bottom + y, -0.47 * sg),
          p.point(h.width * 0.42, h.bottom + y, -0.47 * sg),
          0.09,
          'accent',
        );
      else
        face(
          'accent',
          [
            p.point(-h.width * 0.42, h.bottom + y - 0.045, -0.47 * sg),
            p.point(h.width * 0.42, h.bottom + y - 0.045, -0.47 * sg),
            p.point(h.width * 0.42, h.bottom + y + 0.045, -0.47 * sg),
            p.point(-h.width * 0.42, h.bottom + y + 0.045, -0.47 * sg),
          ],
          [h.normal[0], 0, h.normal[1]],
        );
  }
}
function curvedRoof(face, r, axis, eave, top, d) {
  const other = 1 - axis,
    A = r.map((p) => p[axis]),
    B = r.map((p) => p[other]),
    lo = Math.min(...A),
    hi = Math.max(...A),
    l = Math.min(...B),
    h = Math.max(...B),
    N = d === 0 ? 4 : d === 1 ? 6 : 8;
  const p = (v, u) => (axis === 0 ? [v, u] : [u, v]),
    height = (t) => eave + (top - eave) * (1 - t * t);
  for (let i = 0; i < N; i++) {
    const t1 = -1 + (2 * i) / N,
      t2 = -1 + (2 * (i + 1)) / N,
      u1 = (l + h) / 2 + ((h - l) * t1) / 2,
      u2 = (l + h) / 2 + ((h - l) * t2) / 2;
    face(
      'roof',
      [
        at(p(lo, u1), height(t1)),
        at(p(hi, u1), height(t1)),
        at(p(hi, u2), height(t2)),
        at(p(lo, u2), height(t2)),
      ],
      [0, 1, 0],
    );
    for (const [v, n] of [
      [lo, -1],
      [hi, 1],
    ]) {
      const normal = axis === 0 ? [n, 0, 0] : [0, 0, n];
      face(
        'wall',
        [
          at(p(v, u1), eave),
          at(p(v, u2), eave),
          at(p(v, u2), height(t2)),
          at(p(v, u1), height(t1)),
        ],
        normal,
      );
    }
  }
}
function dome(face, r, b, t, d) {
  const levels =
    d === 0
      ? [
          [b, 1],
          [b + (t - b) * 0.66, 0.72],
          [t, 0.02],
        ]
      : [
          [b, 1],
          [b + (t - b) * 0.25, 0.96],
          [b + (t - b) * 0.55, 0.79],
          [b + (t - b) * 0.81, 0.51],
          [t, 0.02],
        ];
  profile(face, scaled(r, 1.055), levels, 'spire');
}
function crossTop(face, p, b, t, d) {
  beam(face, at(p, b), at(p, t), d === 0 ? 0.14 : 0.1, 'spire');
  if (d >= 1)
    beam(
      face,
      [p[0] - 0.27, floor + t - 0.26, p[1]],
      [p[0] + 0.27, floor + t - 0.26, p[1]],
      0.1,
      'spire',
    );
}
function clock(face, f, d) {
  const h = hole('clock', on(f), f.axis, f.normal, 2.05, 33.1, 2.05, 1.025, 'circle', 1);
  pane(face, h, d, 0.16, 'trim');
  if (d === 0) return;
  archBand(face, h, d, 0.16, 'trim', 0.19);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    pt = (u, y) => p.point(u, floor + 34.125 + y, 0.21 * sg);
  beam(face, pt(0, 0), pt(0.45, 0.35), 0.1, 'accent');
  beam(face, pt(0, 0), pt(-0.2, 0.62), 0.09, 'accent');
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(
        face,
        pt(Math.sin(a) * 0.77, Math.cos(a) * 0.77),
        pt(Math.sin(a) * 0.9, Math.cos(a) * 0.9),
        0.065,
        'accent',
      );
    }
}
function facade(face, f, d) {
  if (d < 1) return;
  const p = on(f),
    h = hole('large-side-arch', p, f.axis, f.normal, 4.7, 3.8, 8.7, 6.35, 'round', 1);
  archBand(face, h, d, 0.22, 'trim', 0.15);
  if (d >= 2) archBand(face, h, d, 0.48, 'trim', 0.24);
  const door = hole('side-portal-arch', p, f.axis, f.normal, 2.35, 0.2, 4.3, 3.125, 'round', 1);
  archBand(face, door, d, 0.22, 'trim', 0.12);
  const pt = (u, y) => [
    p[0] + f.axis[0] * u + f.normal[0] * 0.17,
    floor + y,
    p[1] + f.axis[1] * u + f.normal[1] * 0.17,
  ];
  if (d >= 2)
    for (let row = 0; row < (d === 2 ? 3 : 5); row++)
      for (let col = d === 2 ? -1 : -2; col <= (d === 2 ? 1 : 2); col++) {
        const u = col * (d === 2 ? 1.0 : 0.68) + (row % 2 ? 0.34 : 0),
          y = 4.8 + row * (d === 2 ? 1.1 : 0.67);
        if (Math.abs(u) > 1.7) continue;
        for (const [a, b] of [
          [
            [-0.25, 0],
            [0, 0.27],
          ],
          [
            [0, 0.27],
            [0.25, 0],
          ],
          [
            [0.25, 0],
            [0, -0.27],
          ],
          [
            [0, -0.27],
            [-0.25, 0],
          ],
        ])
          beam(face, pt(u + a[0], y + a[1]), pt(u + b[0], y + b[1]), 0.09, 'trim');
      }
  if (d >= 2)
    for (const u of [-1.35, 1.35]) {
      const q = [
        p[0] + f.axis[0] * u + f.normal[0] * 0.18,
        p[1] + f.axis[1] * u + f.normal[1] * 0.18,
      ];
      solid(face, circle(q, 0.14, 6), 0.3, 3.45, 'trim');
    }
}
function steps(face, f, width, d) {
  const p = on(f),
    N = d === 0 ? 1 : 4;
  for (let i = 0; i < N; i++) {
    const b = 0.2 - i * 0.13,
      dist = 0.12 + i * 0.36,
      w = width + i * 0.42,
      r = [
        [-w / 2, dist],
        [w / 2, dist],
        [w / 2, dist + 0.42],
        [-w / 2, dist + 0.42],
      ].map(([u, n]) => [
        p[0] + f.axis[0] * u + f.normal[0] * n,
        p[1] + f.axis[1] * u + f.normal[1] * n,
      ]);
    solid(face, r, footing, b, 'trim');
  }
}
function build(target, d = 4) {
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
        target.addTriangle(...a);
      },
    },
    hs = fields(d),
    holes = d >= 2 ? hs : hs.filter((h) => h.kind === 'door'),
    face = writer(out, d),
    cut = writer(
      masked(
        out,
        holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
      ),
      d,
    );
  shell(out, d, main, footing, 4.2, holes);
  shell(out, d, upperBody, 4.1, 11.5, holes);
  shell(out, d, plans.apse, 4.1, 8.8, holes);
  hip(cut, plans.apse, 8.8, 10.2, 'roof', 1);
  curvedRoof(cut, plans.nave, 1, 11.5, 14.6, d);
  curvedRoof(cut, plans.cross, 0, 11.5, 14.6, d);
  for (const r of plans.corners) hip(cut, r, 11.5, 12.5, 'roof', 0);
  hip(cut, plans.porch, 4.2, 5.4, 'roof', 0);
  curvedRoof(cut, R(1.4, -11.66, 5.3, -7.2), 1, 4.2, 6.05, d);
  hip(cut, plans.link, 4.2, 5.0, 'roof', 0);
  for (const [name, r, b, t, top, tip] of [
    ['central', core, 14, 19.4, 21.65, 22.37],
    ...satellites.map((r, i) => [`satellite-${i}`, r, 11, 16, 17.7, 18.35]),
  ]) {
    const ss = holes.filter((h) => h.drum && h.name.startsWith(`${name}-`));
    shell(out, d, r, b, t, ss);
    cap(cut, r, t, 'wall');
    dome(face, r, t, top, d);
    crossTop(face, center(r), top, tip, d);
    if (d >= 1) {
      band(face, r, t - 0.2, 0.22, 'trim', 1.05);
      band(face, r, b + 0.3, 0.22, 'trim', 1.04);
    }
    if (d >= 3)
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i),
          hh = hole(
            'drum-band',
            on(f),
            f.axis,
            f.normal,
            f.length - 0.2,
            b + 0.8,
            t - b - 0.95,
            t - b - 1.7,
            'round',
            1,
          );
        archBand(face, hh, d, 0.11, 'trim', 0.08);
      }
  }
  // Separate mapped tower; the low link retains the actual empty west-side court.
  shell(out, d, bell, footing, 36.2, holes);
  for (const y of [8.8, 19.6, 31.1, 35.6]) band(cut, bell, y, 0.26, 'trim', 1.03);
  hip(cut, bell, 36.2, 37.6, 'roof', 0);
  solid(face, scaled(bell, 0.86), 36.15, 38.45, 'wall');
  if (d === 0) {
    const b = R(
      est.bellCenter[0] - 1.55,
      est.bellCenter[1] - 1.55,
      est.bellCenter[0] + 1.55,
      est.bellCenter[1] + 1.55,
    );
    for (const p of b) solid(face, circle(p, 0.42, 4), 38.45, 42.7, 'wall');
  } else {
    const bs = bellFields();
    shell(out, d, crown, 38.4, 42.7, bs, 'wall', scaled(crown, 0.63));
    for (const h of bs) archBand(face, h, d, 0.13, 'trim', 0.08);
    band(face, crown, 38.35, 0.25, 'trim', 1.07);
  }
  cap(face, crown, 42.7, 'wall');
  dome(face, crown, 42.7, 44.2, d);
  crossTop(face, est.bellCenter, 44.2, 44.95, d);
  for (let i = 0; i < bell.length; i++) clock(face, faceFrame(bell, i), d);
  if (d >= 1) {
    for (const h of hs) panel(face, h, d);
    for (const n of [
      [1, 0],
      [-1, 0],
    ])
      facade(face, edge(plans.cross, n), d);
    for (const r of [plans.cross, plans.nave, ...plans.corners])
      band(cut, r, 11.25, 0.23, 'trim', 1.014);
    const f = edge(plans.porch, [0, -1]),
      p = on(f);
    const h = hole('porch-raised-arch', p, f.axis, f.normal, 2.7, 0.2, 5.5, 4.15, 'round', 1);
    archBand(face, h, d, 0.2, 'trim', 0.12);
    if (d >= 2)
      for (const u of [-1.1, 1.1]) {
        const q = on(f, u);
        solid(
          face,
          circle([q[0] + f.normal[0] * 0.2, q[1] + f.normal[1] * 0.2], 0.14, 6),
          0.3,
          3.1,
          'trim',
        );
      }
    for (const f of [
      edge(plans.porch, [0, -1]),
      edge(plans.cross, [1, 0]),
      edge(plans.cross, [-1, 0]),
    ])
      steps(face, f, f.normal[1] < 0 ? 7 : 4, d);
  }
}
export const buildBanjaCathedralSkyline = (o) => build(o, 0),
  buildBanjaCathedralDistrict = (o) => build(o, 1),
  buildBanjaCathedralStreet = (o) => build(o, 2),
  buildBanjaCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const banjaCathedralStudy = {
  id: 'N0389',
  key: 'cathedral_of_christ_the_saviour',
  title: 'Cathedral of Christ the Saviour',
  category: 'cathedral',
  wikidataId: 'Q135271',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current32-vertex whole and separate4-vertex associated clock tower;22.37/44.95m tags retained. Internal roof/drum/porch partitions remain picture estimates.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0.Linked photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing cached256-square ashlar,marble,standing-seam metal,cast bronze and wood graphs. Alternating linear ochre/pink tints share one masonry graph and draw;gold caps share neutral bronze. Metric UVs,flat normals,seven merged groups. No embedded images,unique facade maps,baked shadows or photographic icons.',
  importReason:
    'Four browser levels retain individual five-domed striped church,curved side gables/roses,low northwest porch/link and separate mapped tall clock tower with real open upper crown.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from four actually inspected2018/2019 exterior/porch/carving/tower photographs and standard viewer PMTiles/DEM only. No bespoke plans/surveys. Exact current finish,hidden southwest/rear rhythm,icons/interlace/inscriptions/bells,full interiors and engineering sections simplified or excluded. Upper bell-crown openness and height datums are picture interpretations. Other city buildings and temporary awning/signage excluded. Physical laptop/phone timing pending.',
    'Skyline preserves five domes,curved cross massing,separate clock tower and open upper crown. District adds shared textures,mean masonry color,flat window/rose fields and genuine door recesses. Street adds real window/rose/louver recesses,sparse geometric tracery/diamond relief and broad masonry bands. Closeup/master refine band pitch,nested trim,tracery/louvers. Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('northeast-rose-portal-and-banded-stone', [40, 18, -4], [13, 8, -1.5]),
    cam('northwest-three-door-porch-and-link', [5, 10, -39], [1, 3, -10]),
    cam('clock-louvers-and-open-upper-crown', [-48, 41, -43], [-16.72, 35, -8.59]),
    cam('five-domed-drums-and-curved-roof', [36, 40, -39], [3, 17, -1]),
    cam('southeast-apse-and-estimated-hidden-bays', [27, 23, 43], [3, 8, 7.5]),
    cam('whole-roof-and-signed-plan', [-3, 98, 1], [-3, 16, 0]),
  ],
};

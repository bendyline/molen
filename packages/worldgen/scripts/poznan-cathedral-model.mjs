/** Poznań Cathedral: brick twin-tower front, copper roofs and three open choir lanterns. */
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
  '../../../content/worldgen/source/places/u3/u3k/archcathedral_basilica_of_st_peter_and_st_paul/',
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
  wall: '#b87959',
  trim: '#c6c0a8',
  roof: '#83a598',
  towerMetal: '#4c756b',
  door: '#604a3a',
  glass: '#4e5558',
  accent: '#8c8562',
  stucco: '#e1d2ae',
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
const footing = (p) => Math.min(floor - 0.3, poznanCathedralGround(...p) - 0.35);
export function poznanCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Poznań Cathedral footing outside retained terrain');
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
  const sd = d === 2 ? 1 : d;
  pane(face, h, sd, d >= 2 ? -0.75 : 0.07, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, sd, 0.35, 'trim', 0.09);
  if (h.kind === 'door') archBand(face, h, sd, 0.7, 'trim', 0.14);
  const p = prepareOpening(h, 0, sd),
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
  main = rec.main.polygons[0].outline;
const R = (a, b, x, z) => [
  [a, b],
  [x, b],
  [x, z],
  [a, z],
];
const circle = (p, r, n, off = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos(off + (i * Math.PI * 2) / n) * r,
    p[1] + Math.sin(off + (i * Math.PI * 2) / n) * r,
  ]);
const centerBox = (r) =>
  [0, 1].map((k) => (Math.min(...r.map((p) => p[k])) + Math.max(...r.map((p) => p[k]))) / 2);
const towerCore = (q) =>
  R(q.center[0] - 4.2, q.center[1] - 4.1, q.center[0] + 4.2, q.center[1] + 4.1);
const frontBelfry = (q) =>
  R(q.center[0] - 3.45, q.center[1] - 3.45, q.center[0] + 3.45, q.center[1] + 3.45);
function atEdge(name, r, n, w, b, h, s = h, shape = 'pointed', kind = 'window') {
  const f = edge(r, n);
  return { ...hole(name, lerp(f.a, f.b, 0.5), f.axis, f.normal, w, b, h, s, shape, 3), kind };
}
function fields(_d = 3) {
  const a = [],
    front = rec.estimated.frontPlane,
    z = rec.estimated.naveCenterZ;
  a.push({
    ...hole('front-timber-portal', [front, z], [0, 1], [-1, 0], 3.3, 0.15, 6.8, 4.8, 'pointed', 4),
    kind: 'door',
  });
  a.push({
    ...hole(
      'front-tall-pointed-field',
      [front, z],
      [0, 1],
      [-1, 0],
      4.9,
      9.1,
      15.7,
      11.6,
      'pointed',
      4,
    ),
    kind: 'window',
  });
  for (const [sg, _i] of [
    [-1, 0],
    [1, 1],
  ]) {
    const f = edge(plans.nave[0].outline, [0, sg]);
    for (const x of [-24, -17.5, -11, -4.5, 2, 8.5]) {
      const p = lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0]));
      a.push({
        ...hole(`nave-upper-${sg}-${x}`, p, f.axis, f.normal, 2.25, 22.1, 4.5, 3.4, 'pointed', 3),
        kind: 'window',
      });
    }
    const body = plans.aisles[0].outline,
      outer = edge(body, [0, sg]);
    for (const [x, j] of [-24.7, -18.3, -11.9, -5.5, 1, 7.5].map((x, j) => [x, j])) {
      const p = lerp(outer.a, outer.b, (x - outer.a[0]) / (outer.b[0] - outer.a[0]));
      a.push({
        ...hole(`aisle-${sg}-${j}`, p, outer.axis, outer.normal, 2.4, 4.5, 6.2, 4.7, 'pointed', 3),
        kind: 'window',
      });
    }
  }
  for (const [j, q] of rec.estimated.frontTowers.entries()) {
    const r = towerCore(q),
      br = frontBelfry(q);
    for (const n of [
      [-1, 0],
      [0, j === 0 ? -1 : 1],
    ]) {
      for (const [b, h] of [
        [13, 2.0],
        [22.5, 2.0],
      ])
        a.push(atEdge(`front-tower-slit-${j}-${n}-${b}`, r, n, 0.65, b, h, h, 'rect'));
    }
    if (j === 1)
      a.push(atEdge('south-front-clock', r, [-1, 0], 1.7, 31.2, 1.7, 0, 'circle', 'clock'));
    for (const n of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      a.push(atEdge(`front-green-belfry-${j}-${n}`, br, n, 2.4, 41, 9.0, 7.8, 'round', 'louver'));
  }
  for (const [j, q] of rec.estimated.rearTowers.entries()) {
    const r = coarse(plans[q.key][0].outline);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        p = lerp(f.a, f.b, 0.5);
      if (j > 0 && Math.sign(f.normal[1]) !== Math.sign(q.center[1]) && f.normal[0] < 0.2) continue;
      if (j === 0 && f.normal[0] < 0.05) continue;
      a.push({
        ...hole(
          `choir-tower-${j}-${i}`,
          p,
          f.axis,
          f.normal,
          Math.min(2.2, f.length * 0.65),
          17.5,
          9.0,
          7.2,
          'pointed',
          3,
        ),
        kind: 'window',
      });
    }
  }
  for (const key of [
    'ambulatoryNorth',
    'ambulatorySouth',
    'chapelNorth',
    'chapelSouth',
    'eastChapel',
  ]) {
    const r = coarse(plans[key][0].outline);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 2.8 || f.normal[0] < -0.5) continue;
      if (
        (key === 'ambulatoryNorth' && f.normal[1] > -0.15) ||
        (key === 'ambulatorySouth' && f.normal[1] < 0.15)
      )
        continue;
      const count = f.length > 9 ? Math.floor(f.length / 4) : 1;
      for (let k = 0; k < count; k++)
        a.push({
          ...hole(
            `chapel-${key}-${i}-${k}`,
            lerp(f.a, f.b, (k + 0.5) / count),
            f.axis,
            f.normal,
            Math.min(2.1, (f.length / count) * 0.58),
            4.0,
            key === 'eastChapel' ? 3.9 : 4.7,
            key === 'eastChapel' ? 2.85 : 3.65,
            'round',
            3,
          ),
          kind: 'window',
        });
    }
  }
  return a;
}
export const poznanCathedralFields = fields;
function galleryFields(_d = 3) {
  const result = [];
  for (const [j, q] of rec.estimated.rearTowers.entries()) {
    const r = circle(q.center, 1.85, 8, Math.PI / 8);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      result.push({
        ...hole(
          `open-choir-lantern-${j}-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          0.95,
          35.5,
          5.2,
          4.725,
          'round',
          3,
        ),
        tower: j,
      });
    }
  }
  return result;
}
export const poznanCathedralGalleryFields = galleryFields;
function decoratedPanel(face, h, d) {
  if (
    d === 2 &&
    (h.name.startsWith('chapel-') ||
      (h.name.startsWith('aisle-') && Number(h.name.split('-').at(-1)) % 2 === 1))
  )
    d = 1;
  const sd = d === 2 ? 1 : d;
  if (d === 1 && h.kind === 'door') {
    pane(face, h, sd, -0.75, 'door');
    archBand(face, h, sd, 0.3, 'wall', 0.08);
    return;
  }
  if (h.kind === 'clock') {
    pane(face, h, sd, d >= 2 ? -0.5 : 0.05, 'glass');
    if (d >= 2) {
      archBand(face, h, sd, 0.15, 'trim', 0.05);
      const p = prepareOpening(h, 0, sd),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      for (const [u, v] of [
        [0.4, 0.05],
        [-0.1, 0.53],
      ])
        beam(
          face,
          p.point(0, h.bottom + h.height / 2, -0.43 * sg),
          p.point(u, h.bottom + h.height / 2 + v, -0.43 * sg),
          0.07,
          'accent',
        );
    }
    return;
  }
  if (h.kind === 'louver') {
    pane(face, h, sd, d >= 2 ? -0.75 : 0.06, 'door');
    if (d >= 2) {
      archBand(face, h, sd, 0.18, 'roof', 0.08);
      const p = prepareOpening(h, 0, sd),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      for (let y = 0.3; y < h.spring; y += d === 2 ? 0.65 : 0.4)
        beam(
          face,
          p.point(-h.width * 0.43, h.bottom + y, -0.55 * sg),
          p.point(h.width * 0.43, h.bottom + y, -0.55 * sg),
          0.1,
          'roof',
        );
    }
    return;
  }
  panel(face, h, d);
}
function roundedSquare(p, r, d) {
  if (d === 0) return R(p[0] - r, p[1] - r, p[0] + r, p[1] + r);
  const n = d === 1 ? 8 : d === 2 ? 12 : 20;
  return Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n,
      c = Math.cos(a),
      s = Math.sin(a),
      v = r / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), 0.25);
    return [p[0] + c * v, p[1] + s * v];
  });
}
function crossTop(face, p, b, t, d) {
  beam(face, at(p, b), at(p, t), d === 0 ? 0.1 : 0.075, d === 0 ? 'trim' : 'accent');
  if (d === 0) return;
  const y = t - (t - b) * 0.3;
  beam(
    face,
    [p[0], floor + y, p[1] - (t - b) * 0.25],
    [p[0], floor + y, p[1] + (t - b) * 0.25],
    0.075,
    'accent',
  );
}
function onion(face, r, b, t, d, slot = 'roof') {
  profile(
    face,
    r,
    d === 0
      ? [
          [b, 1],
          [b + (t - b) * 0.5, 0.68],
          [t, 0.03],
        ]
      : [
          [b, 1.08],
          [b + (t - b) * 0.15, 1.08],
          [b + (t - b) * 0.38, 0.8],
          [b + (t - b) * 0.52, 0.63],
          [b + (t - b) * 0.63, 0.78],
          [b + (t - b) * 0.77, 0.48],
          [b + (t - b) * 0.86, 0.45],
          [t, 0.03],
        ],
    slot,
  );
}
function steppedFront(face, d) {
  const x = rec.estimated.frontPlane - 0.5,
    z = rec.estimated.naveCenterZ,
    width = 9.1,
    count = d === 0 ? 5 : 9;
  for (let i = 0; i < count; i++) {
    const a = z - width / 2 + (i * width) / count,
      b = a + width / count,
      t = 24.8 + 10.2 * (1 - Math.abs(i - (count - 1) / 2) / (count / 2 + 0.1));
    if (d === 0) {
      solid(face, R(x, a, x + 1, b), 24.8, t, 'wall');
      continue;
    }
    solid(face, R(x, a, x + 1, a + 0.16), 24.8, t + 0.2, 'wall');
    solid(face, R(x, b - 0.16, x + 1, b), 24.8, t + 0.2, 'wall');
    solid(face, R(x, a + 0.16, x + 1, b - 0.16), t - 0.35, t + 0.2, 'wall');
    face(
      'stucco',
      [
        [x + 0.34, floor + 25.1, a + 0.16],
        [x + 0.34, floor + 25.1, b - 0.16],
        [x + 0.34, floor + t - 0.35, b - 0.16],
        [x + 0.34, floor + t - 0.35, a + 0.16],
      ],
      [-1, 0, 0],
    );
  }
}
function naveRoof(face, r, eave, top) {
  const lo = Math.min(...r.map((p) => p[0])),
    hi = 17.4,
    z = rec.estimated.naveCenterZ;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.normal[0] < -0.7) continue;
    const ridge = (p) => [Math.max(lo, Math.min(hi, p[0])), z];
    face(
      'roof',
      [at(f.a, eave), at(f.b, eave), at(ridge(f.b), top), at(ridge(f.a), top)],
      [0, 1, 0],
    );
  }
}
function dome(face, p, r, b, t, d) {
  const n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 16 : 24,
    steps = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 5 : 7,
    levels = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((i / steps) * Math.PI) / 2;
    levels.push([b + (t - b) * Math.sin(a), Math.max(0.01, Math.cos(a))]);
  }
  profile(face, circle(p, r, n), levels, 'roof');
}
function build(out, d) {
  const target = out;
  out = {
    addTriangle(...args) {
      const p = args[2].map((q) => q.map(Math.fround));
      if (
        Math.hypot(
          ...cross(
            p[1].map((v, k) => v - p[0][k]),
            p[2].map((v, k) => v - p[0][k]),
          ),
        ) < 1e-7
      )
        return;
      target.addTriangle(...args);
    },
  };
  const face = writer(out, d),
    all = fields(d),
    selected =
      d >= 2
        ? all.filter(
            (h) =>
              d !== 2 ||
              !(
                h.name.startsWith('chapel-') ||
                (h.name.startsWith('aisle-') && Number(h.name.split('-').at(-1)) % 2 === 1)
              ),
          )
        : all.filter((h) => h.kind === 'door');
  const low = d === 0 ? coarse(main) : main;
  // The mapped0.1m whole is retained as a low footprint/base,not extruded as the roof.
  solid(face, low, footing, 0.1, 'trim');
  const aisle = coarse(plans.aisles[0].outline);
  shell(out, d, aisle, footing, 13, selected);
  if (d > 0) cap(face, aisle, 13, 'wall');
  hip(face, aisle, 13.3, 24, 'roof');
  for (const p of plans.upperBody) {
    const ring = d === 0 ? coarse(p.outline) : p.outline;
    shell(out, d, ring, 12.8, 27, selected);
    if (d > 0) cap(face, ring, 27, 'wall');
  }
  naveRoof(face, coarse(plans.nave[0].outline), 27, 35);
  hip(face, plans.rearHigh[0].outline, 27, 35, 'roof');
  // A separate frontal field and stepped screen close the nave's western end.
  const nf = rec.estimated.frontPlane,
    z = rec.estimated.naveCenterZ;
  shell(out, d, R(nf, z - 4.55, nf + 1.2, z + 4.55), footing, 28, selected);
  cap(face, R(nf, z - 4.55, nf + 1.2, z + 4.55), 28, 'wall');
  steppedFront(face, d);
  for (const [j, q] of rec.estimated.frontTowers.entries()) {
    const core = towerCore(q),
      upper = frontBelfry(q),
      r = coarse(plans[q.key][0].outline);
    if (d > 0) solid(face, r, footing, 0.35, 'trim');
    shell(out, d, core, footing, 36, selected);
    if (d > 0) cap(face, core, 36, 'trim');
    shell(out, d, upper, 35.8, 52, selected, 'towerMetal');
    if (d > 0) cap(face, upper, 52, 'towerMetal');
    onion(face, roundedSquare(q.center, 3.65, d), 52, 60.5, d, 'towerMetal');
    crossTop(face, q.center, 60.5, 62, d);
    if (d > 0) {
      band(face, core, 35.1, 0.5, 'trim', 1.02);
      for (const y of [36.1, 39.6, 51.0]) band(face, upper, y, 0.4, 'towerMetal', 1.09);
    }
    if (d >= 2) {
      for (const p of upper)
        solid(face, R(p[0] - 0.23, p[1] - 0.23, p[0] + 0.23, p[1] + 0.23), 39.7, 51, 'towerMetal');
      for (const p of core) {
        solid(face, R(p[0] - 0.32, p[1] - 0.32, p[0] + 0.32, p[1] + 0.32), 1.1, 35.0, 'wall');
      }
      for (const n of [
        [-1, 0],
        [0, j === 0 ? -1 : 1],
      ]) {
        const f = edge(core, n),
          p = lerp(f.a, f.b, 0.5);
        for (const sg of [-1, 1]) {
          const q = p.map((v, k) => v + f.axis[k] * 3.1 + f.normal[k] * 0.24 * sg);
          solid(face, R(q[0] - 0.18, q[1] - 0.18, q[0] + 0.18, q[1] + 0.18), 1.2, 35, 'wall');
        }
      }
    }
  }
  const gallery = galleryFields(d);
  for (const [j, q] of rec.estimated.rearTowers.entries()) {
    const r = coarse(plans[q.key][0].outline),
      n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 20;
    shell(out, d, r, 12.5, 29, selected);
    cap(face, r, 29, 'trim');
    profile(
      face,
      circle(q.center, 4.0, n),
      d === 0
        ? [
            [29, 1],
            [32, 1.05],
            [35, 0.45],
          ]
        : [
            [29, 1],
            [29.5, 1.03],
            [30.5, 1.18],
            [32, 1.19],
            [33.2, 0.94],
            [34.4, 0.61],
            [35, 0.46],
          ],
      'roof',
    );
    const ring = circle(q.center, 1.85, d === 0 ? 4 : 8, Math.PI / 8),
      hs = gallery.filter((h) => h.tower === j);
    if (d <= 1) {
      const posts = d === 0 ? 4 : 8;
      for (const p of circle(q.center, 1.7, posts, Math.PI / 8))
        solid(face, R(p[0] - 0.14, p[1] - 0.14, p[0] + 0.14, p[1] + 0.14), 35, 41.2, 'roof');
      sides(face, ring, 40.8, 41.2, 'roof');
      cap(face, ring, 41.2, 'roof', [scaled(ring, 0.76)]);
      cap(face, ring, 35, 'roof');
    } else {
      shell(out, d, ring, 35, 41.2, hs, 'roof', scaled(ring, 0.74));
      cap(face, ring, 35, 'roof');
      for (const h of hs) archBand(face, h, d === 2 ? 1 : d, 0.12, 'roof', 0.03);
    }
    onion(face, circle(q.center, 2.0, n), 41.2, 43.1, d);
    crossTop(face, q.center, 43.1, 44, d);
    if (d > 0) {
      band(face, r, 28.5, 0.5, 'trim', 1.02);
      band(face, ring, 34.85, 0.25, 'roof', 1.08);
      band(face, ring, 41, 0.3, 'roof', 1.08);
    }
  }
  for (const key of [
    'ambulatoryNorth',
    'ambulatorySouth',
    'chapelNorth',
    'chapelSouth',
    'eastChapel',
    'eastPorchNorth',
    'eastPorchSouth',
    'eastFootNorth',
    'eastFootSouth',
  ]) {
    if (d === 0 && (key.startsWith('eastPorch') || key.startsWith('eastFoot'))) continue;
    const r = coarse(plans[key][0].outline),
      height = rec.controls.find((b) => b.id === rec.partKeys[key]).properties.height,
      b = key === 'eastChapel' ? 12 : Math.min(11, height - 2);
    shell(out, d, r, footing, b, selected, 'stucco');
    cap(face, r, b, 'stucco');
    if (key === 'eastChapel') {
      const p = rec.estimated.eastChapelCenter;
      dome(face, p, 4.2, b, 17, d);
      solid(face, circle(p, 0.5, d === 0 ? 4 : 8), 17, 17.5, 'roof');
      crossTop(face, p, 17.5, 18, d);
    } else hip(face, r, b, height, 'roof');
    if (d > 0) {
      band(face, r, b - 0.5, 0.35, 'trim', 1.02);
      if (d >= 2)
        for (const p of r)
          solid(face, R(p[0] - 0.13, p[1] - 0.13, p[0] + 0.13, p[1] + 0.13), 1, b - 0.5, 'trim');
    }
  }
  if (d > 0) for (const h of all) decoratedPanel(face, h, d);
  if (d >= 2) {
    // Buttress strips repeat the four mapped cross-nave controls;no generic invented towers.
    for (const b of rec.controls.filter((b) => b.properties.height === 28))
      for (const sg of [-1, 1]) {
        const r = b.polygons[0].outline,
          p = [centerBox(r)[0], sg < 0 ? -5.1 : 5.3],
          outer = [p[0], sg < 0 ? -17 : 18.8];
        solid(
          face,
          R(outer[0] - 0.45, outer[1] - 0.45, outer[0] + 0.45, outer[1] + 0.45),
          1,
          13,
          'wall',
        );
        beam(face, at([p[0], sg < 0 ? -4.55 : 4.85], 27.2), at(outer, 13.8), 0.65, 'wall');
      }
    const r = coarse(plans.eastChapel[0].outline);
    for (const p of r.filter((p) => p[0] > 31)) {
      solid(face, circle(p, 0.22, 6), 12, 12.5, 'trim');
      solid(face, circle(p, 0.18, 6), 12.5, 13.2, 'trim');
      dome(face, p, 0.21, 13.2, 13.65, d);
    }
  }
  const x = nf - 0.05;
  solid(face, R(x - 1.3, z - 2.5, x + 0.05, z + 2.5), footing, 0.15, 'trim');
  const steps = d === 0 ? 1 : d === 1 ? 2 : 5;
  for (let j = 0; j < steps; j++)
    for (let k = 0; k < 2; k++)
      solid(
        face,
        R(
          x - 1.3 - ((j + 1) * 1.5) / steps,
          z - 2.5 + k * 2.5,
          x - 1.3 - (j * 1.5) / steps,
          z + k * 2.5,
        ),
        footing,
        0.15 - ((j + 1) * 0.75) / steps,
        'trim',
      );
}
export const buildPoznanCathedralSkyline = (o) => build(o, 0),
  buildPoznanCathedralDistrict = (o) => build(o, 1),
  buildPoznanCathedralStreet = (o) => build(o, 2),
  buildPoznanCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const poznanCathedralStudy = {
  id: 'archcathedral_basilica_of_st_peter_and_st_paul',
  key: 'archcathedral_basilica_of_st_peter_and_st_paul',
  title: 'Archcathedral Basilica of St. Peter and St. Paul',
  category: 'cathedral',
  wikidataId: 'Q2064095',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current114-vertex whole and23 components retain337 raw vertices/tags.Nave-wall axis refined+4.542450deg;twin western towers and three smaller eastern choir towers sign it.Existing72m length/36m width retained with scope differences.',
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
    'Five existing cached256-square running-bond brick,continuous limestone,oxidized copper,plain wood and lime-plaster graphs.Linear brick/pale-stone/green-copper/wood/cream tints,metric UVs and flat architectural normals.Glass,clock hands and small metal tips use geometric PBR colors.No embedded images,bespoke facade maps or baked shadows.',
  importReason:
    'Four browser levels preserve twin brick front towers,stepped pale-panel Gothic gable,long green-roof nave,three smaller copper-capped eastern choir towers with actual open lanterns,and low pale chapels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from actually inspected undated front,2006 and2012 eastern exteriors and a distant2026 aerial used only for broad silhouette,plus standard viewer PMTiles/DEM.No bespoke plans/surveys researched or photographs redistributed.Hidden side/nave bay rhythm,stage/eave levels,exact compound roof profiles,upper-body hull,plaster tone and sculpture remain picture estimates.Fine inscriptions,sculptural identity and interiors simplified or excluded.Adjacent buildings,gardens/trees and actual street surfaces remain host content.Physical phone/laptop timing pending.',
    'Skyline preserves five-tower silhouette,stepped front,green roof/chapel family and actual simplified open rear lanterns.District adds shared surfaces,flat fields/cornices and recessed central portal.Street adds recessed selected glazing/louvers,arch frames,pilasters,buttresses and small supported geometric figures;some alternating low aisle/chapel fields remain flat.Closeup/master add all field recesses,finer opening/roof profiles and louver rows.Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('twin-tower-front-and-stepped-gable', [-102, 28, 49], [-33, 23, 0]),
    cam('copper-front-belfries-and-clock', [-80, 65, -53], [-32.6, 45, -1]),
    cam('south-nave-and-lower-chapels', [-3, 37, 105], [-2, 20, 4]),
    cam('three-choir-towers-and-domed-chapel', [96, 36, 62], [22, 20, 1]),
    cam('open-eastern-lanterns-and-green-roof', [65, 59, -61], [19, 34, 0]),
    cam('roof-and-signed-whole-plan', [0, 174, 1], [0, 23, 0]),
  ],
};

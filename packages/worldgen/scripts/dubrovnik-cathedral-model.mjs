/** Dubrovnik Cathedral: colonnaded limestone front, gray roofs and ribbed dark dome. */
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
  '../../../content/worldgen/source/places/sr/srs/n0380_dubrovnik_cathedral/',
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
  wall: '#d7cfbe',
  trim: '#e5ddcb',
  roof: '#8e9292',
  dome: '#686b73',
  door: '#604a3a',
  glass: '#526773',
  accent: '#6f766d',
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
const footing = (p) => Math.min(floor - 0.3, dubrovnikCathedralGround(...p) - 0.35);
export function dubrovnikCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Dubrovnik Cathedral footing outside retained terrain');
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
const R = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos((i * Math.PI * 2) / n) * r,
    p[1] + Math.sin((i * Math.PI * 2) / n) * r,
  ]);
const F = (name, f, t, w, b, h, s = h, shape = 'round') =>
  hole(name, lerp(f.a, f.b, t), f.axis, f.normal, w, b, h, s, shape, 3.0);
const frontHole = (name, x, z, w, b, h, s = h, shape = 'rect') =>
  hole(name, [x, z], [0, 1], [-1, 0], w, b, h, s, shape, 3.2);
const domeCenter = rec.estimated.domeCenter;
function fields(d = 3) {
  const a = [
    { ...frontHole('central-wood-portal', -19, -0.2, 2.8, 0.3, 5.2), kind: 'door' },
    frontHole('upper-front-window', -18.35, -0.2, 2.8, 16.2, 5.4),
  ];
  for (const sg of [-1, 1]) {
    a.push({ ...frontHole(`side-door-${sg}`, -16.5, sg * 6.7, 1.65, 0.3, 3.9), kind: 'door' });
    a.push({
      ...frontHole(`figure-niche-${sg}`, -16.5, sg * 9.8, 1.4, 4.3, 4.0, 3.3, 'round'),
      kind: 'niche',
    });
    const n = edge(plans.nave[0].outline, [0, sg]);
    for (const x of [-12.5, -6.5, 9.2, 16.3]) {
      const t = (x - n.a[0]) / (n.b[0] - n.a[0]);
      if (t > 0 && t < 1) a.push(F(`upper-side-${sg}-${x}`, n, t, 2.0, 14.3, 3.8, 2.8));
    }
    const r = plans[sg < 0 ? 'aisleNorth' : 'aisleSouth'][0].outline;
    for (const x of [-11, -5.5, 8.8, 16]) {
      const f = r
        .map((_, i) => faceFrame(r, i))
        .filter(
          (f) =>
            f.normal[1] * sg > 0.6 &&
            x >= Math.min(f.a[0], f.b[0]) &&
            x <= Math.max(f.a[0], f.b[0]),
        )
        .sort((a, b) => Math.abs(b.a[1]) - Math.abs(a.a[1]))[0];
      if (f)
        a.push(
          F(`aisle-lunette-${sg}-${x}`, f, (x - f.a[0]) / (f.b[0] - f.a[0]), 2.7, 8.5, 1.35, 0),
        );
    }
    const f = edge(plans.cross[0].outline, [0, sg]);
    a.push(F(`transept-lunette-${sg}`, f, 0.5, 5.1, 15.1, 2.55, 0));
    a.push({ ...F(`transept-door-${sg}`, f, 0.5, 1.8, 0.3, 4.5, 4.5, 'rect'), kind: 'door' });
  }
  const dr = circle(domeCenter, 5.5, d >= 2 ? 24 : 16);
  for (let i = 0; i < dr.length; i += d >= 2 ? 3 : 2)
    a.push(F(`drum-window-${i}`, faceFrame(dr, i), 0.5, 1.25, 24.5, 3.55, 2.925));
  return a;
}
export const dubrovnikCathedralFields = fields;
function column(face, p, d, b = 0.3, t = 12.4, r = 0.39) {
  const n = d === 0 ? 4 : d === 1 ? 6 : 10,
    ring = circle(p, r, n);
  profile(
    face,
    ring,
    d < 2
      ? [
          [b, 1.35],
          [b + 0.55, 1],
          [t - 0.7, 0.85],
          [t, 1.4],
        ]
      : [
          [b, 1.5],
          [b + 0.35, 1.5],
          [b + 0.55, 1.05],
          [t - 1.2, 0.86],
          [t - 0.85, 1.05],
          [t - 0.5, 1.35],
          [t, 1.5],
        ],
    'trim',
  );
  if (d >= 3) {
    // Broad leaf-like capital blocks are merged silhouettes, not fine Corinthian carving.
    for (const sg of [-1, 1])
      solid(
        face,
        R(p[0] - 0.24, p[1] + sg * 0.42 - 0.13, p[0] + 0.24, p[1] + sg * 0.42 + 0.13),
        t - 0.7,
        t - 0.28,
        'trim',
      );
  }
}
function statue(face, p, b, d) {
  const ring = circle(p, 0.28, d >= 3 ? 8 : 6);
  solid(face, R(p[0] - 0.4, p[1] - 0.4, p[0] + 0.4, p[1] + 0.4), b, b + 0.35, 'trim');
  profile(
    face,
    ring,
    [
      [b + 0.35, 1.35],
      [b + 1.4, 0.75],
      [b + 1.8, 1.15],
      [b + 2, 0.55],
      [b + 2.45, 0.7],
      [b + 2.65, 0.25],
    ],
    'trim',
  );
}
function slab(face, x, depth, contour, slot = 'wall') {
  const pts = contour.map(([z, y]) => [z, y]),
    ids = earcut(pts.flat(), [], 2);
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
function crossFinial(face, p, b, tip, d) {
  const w = d < 2 ? 0.18 : 0.12;
  beam(face, at(p, b), at(p, tip), w, 'accent');
  beam(face, at([p[0], p[1] - 0.65], tip - 0.85), at([p[0], p[1] + 0.65], tip - 0.85), w, 'accent');
}
function drum(out, face, d, hs) {
  const ring = circle(domeCenter, 5.5, d >= 2 ? 24 : d === 1 ? 16 : 12);
  if (d >= 2)
    shell(
      out,
      d,
      ring,
      19,
      29.5,
      hs.filter((h) => h.name.startsWith('drum-')),
      'wall',
      scaled(ring, 0.84),
    );
  else solid(face, ring, 19, 29.5, 'wall');
  if (d >= 1) {
    band(face, ring, 28.8, 0.7, 'trim', 1.035);
    band(face, ring, 23.7, 0.35, 'trim', 1.025);
  }
  const dome = (_slot, p, n) => face('roof', p, n, colors.dome);
  const levels =
    d < 2
      ? [
          [29.5, 1],
          [32.3, 0.93],
          [35, 0.63],
          [37, 0.16],
        ]
      : [
          [29.5, 1],
          [30.6, 0.985],
          [32.3, 0.93],
          [34, 0.76],
          [35.5, 0.53],
          [36.5, 0.29],
          [37, 0.16],
        ];
  profile(dome, ring, levels, 'roof');
  if (d >= 2)
    for (let i = 0; i < ring.length; i += 2) {
      const v = ring[i].map((q, k) => q - domeCenter[k]);
      for (let j = 1; j < levels.length; j++)
        beam(
          face,
          at(
            domeCenter.map((q, k) => q + v[k] * (levels[j - 1][1] + 0.006)),
            levels[j - 1][0],
          ),
          at(
            domeCenter.map((q, k) => q + v[k] * (levels[j][1] + 0.006)),
            levels[j][0],
          ),
          d >= 3 ? 0.12 : 0.1,
          'accent',
        );
    }
  const lr = circle(domeCenter, 0.96, d >= 2 ? 12 : 8),
    lh = [];
  if (d >= 2)
    for (let i = 0; i < lr.length; i += 2)
      lh.push(F(`lantern-${i}`, faceFrame(lr, i), 0.5, 0.45, 37.7, 2.85, 2.625));
  if (d >= 2) shell(out, d, lr, 37, 41.5, lh, 'trim', scaled(lr, 0.58));
  else solid(face, lr, 37, 41.5, 'trim');
  if (d >= 1) {
    band(face, lr, 37, 0.3, 'trim', 1.2);
    band(face, lr, 41.2, 0.35, 'trim', 1.2);
  }
  profile(
    dome,
    lr,
    [
      [41.5, 1.15],
      [42.2, 0.85],
      [43, 0.15],
    ],
    'roof',
  );
  for (const h of lh) panel(face, h, d);
  crossFinial(face, domeCenter, 43, 45, d);
  return lh;
}
export const dubrovnikCathedralLanternFields = () => {
  const lr = circle(domeCenter, 0.96, 12);
  return lr
    .filter((_, i) => i % 2 === 0)
    .map((_, i) => F(`lantern-${i * 2}`, faceFrame(lr, i * 2), 0.5, 0.45, 37.7, 2.85, 2.625));
};
function front(face, out, d, hs) {
  for (const p of plans.front) {
    solid(face, p.outline, 12.4, 13.4, 'trim');
    cap((slot, points) => face(slot, points, [0, -1, 0]), p.outline, 12.4, 'trim');
  }
  for (const z of rec.estimated.frontColumnsZ) column(face, [-20.3, z], d);
  const up = R(-18.35, -4.55, -15.25, 4.2),
    upper = hs.filter((h) => h.name === 'upper-front-window');
  shell(out, d, up, 13.4, 23.2, d >= 2 ? upper : []);
  cap(face, up, 23.2, 'trim');
  slab(
    face,
    -18.55,
    0.9,
    [
      [-5.2, 23.2],
      [-0.2, 28.2],
      [4.8, 23.2],
    ],
    'wall',
  );
  if (d >= 1) {
    for (const sg of [-1, 1]) {
      const z = sg < 0 ? -4.55 : 4.2;
      // Thick volute shoulders connect the upper front to the lower aisle front.
      slab(
        face,
        -16.7,
        0.7,
        [
          [z, 13.4],
          [z, 22.8],
          [z + sg * 1.0, 21.8],
          [z + sg * 1.35, 18.5],
          [z + sg * 2.5, 16.4],
          [z + sg * 4.5, 14.8],
          [z + sg * 5.9, 14.8],
          [z + sg * 5.9, 13.4],
        ],
        'wall',
      );
      const a = [-16.7, sg * 5.5],
        q = [-16.7, sg * 11.6];
      beam(face, at(a, 14.6), at(q, 14.6), 0.28, 'trim');
      if (d >= 2)
        for (let i = 0; i <= 8; i++) {
          const p = lerp(a, q, i / 8);
          solid(face, circle(p, 0.1, 4), 13.4, 14.6, 'trim');
        }
      if (d >= 2) for (const zz of [sg * 5.7, sg * 10.8]) statue(face, [-16.4, zz], 14.65, d);
    }
    for (const y of [13.15, 22.9]) solid(face, R(-18.55, -4.8, -15.1, 4.45), y, y + 0.3, 'trim');
  }
  if (d >= 2) {
    for (const z of [-4.2, -3.5, 3.2, 3.9])
      solid(face, R(-18.55, z - 0.14, -18.25, z + 0.14), 14.1, 22.7, 'trim');
    for (const sg of [-1, 1]) {
      // Pediment/raking cornice and smaller door/niche heads.
      beam(face, [-18.64, floor + 23.35, -5.2], [-18.64, floor + 28.35, -0.2], 0.28, 'trim');
      beam(face, [-18.64, floor + 28.35, -0.2], [-18.64, floor + 23.35, 4.8], 0.28, 'trim');
      const z = sg * 9.8;
      slab(
        face,
        -16.8,
        0.4,
        [
          [z - 1.05, 9.0],
          [z, 10.1],
          [z + 1.05, 9.0],
        ],
        'trim',
      );
      const zz = sg * 6.7;
      for (let i = 0; i < 6; i++) {
        const a = Math.PI * 0.15 + (i * Math.PI * 0.7) / 6,
          b = Math.PI * 0.15 + ((i + 1) * Math.PI * 0.7) / 6;
        beam(
          face,
          [-16.8, floor + 4.3 + Math.sin(a) * 0.7, zz + Math.cos(a) * 1.05],
          [-16.8, floor + 4.3 + Math.sin(b) * 0.7, zz + Math.cos(b) * 1.05],
          0.18,
          'trim',
        );
      }
    }
    // Shallow balcony with actual air between the rails.
    solid(face, R(-19.05, -1.95, -18.05, 1.55), 15.15, 15.4, 'trim');
    beam(face, [-19.05, floor + 16.1, -1.95], [-19.05, floor + 16.1, 1.55], 0.1, 'accent');
    for (let i = 0; i < 9; i++)
      beam(
        face,
        [-19.05, floor + 15.4, -1.95 + (i * 3.5) / 8],
        [-19.05, floor + 16.1, -1.95 + (i * 3.5) / 8],
        0.075,
        'accent',
      );
    slab(
      face,
      -19.25,
      0.4,
      [
        [-2.1, 6.2],
        [-0.2, 7.5],
        [1.7, 6.2],
      ],
      'trim',
    );
    for (let j = 0; j < 3; j++)
      solid(face, R(-20.5 - j * 0.4, -2, -18.9, 1.6), footing, 0.3 - j * 0.08, 'trim');
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
        if (m > (d === 0 ? 30 : d === 1 ? 16 : 8)) {
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
    hs = fields(d),
    wall = (r, b, t) => shell(out, d, r, b, t, d >= 2 ? hs : []),
    cut = writer(masked(out, d >= 2 ? hs.map((h) => prepareOpening(h, 0, d)) : []), d);
  for (const p of plans.groundBase) {
    wall(p.outline, footing, 5);
    cap(cut, p.outline, 5, 'wall');
  }
  for (const key of ['aisleNorth', 'aisleSouth', 'low'])
    for (const p of plans[key]) {
      wall(p.outline, 5, 11);
      hip(face, d === 0 ? coarse(p.outline) : p.outline, 11, 13.5, 'roof', 0);
    }
  for (const p of plans.nave) {
    wall(p.outline, 5, 19);
    gable(cut, p.outline, 19, 22.5, 'roof', 0);
  }
  for (const p of plans.cross) {
    wall(p.outline, 5, 20.5);
    gable(cut, p.outline, 20.5, 24, 'roof', 1);
  }
  for (const p of plans.entryWall) wall(p.outline, 5, 12.4);
  // Outer front piers are independent from the recessed central entry and columns.
  for (const sg of [-1, 1])
    wall(R(-16.5, sg < 0 ? -11.5 : 4.4, -15.2, sg < 0 ? -5.4 : 10.6), 5, 13.4);
  front(face, out, d, hs);
  drum(out, face, d, hs);
  if (d >= 1)
    for (const h of hs) {
      if (h.kind === 'niche') {
        pane(face, h, d, d >= 2 ? -0.75 : 0.07, 'trim');
        if (d >= 2) {
          archBand(face, h, d, 0.3, 'trim', 0.09);
          statue(face, [h.center[0] + 0.35, h.center[1]], h.bottom - floor + 0.1, d);
        }
      } else panel(face, h, d);
    }
  if (d >= 2) {
    for (const sg of [-1, 1]) {
      const f = edge(plans.nave[0].outline, [0, sg]);
      for (const x of [-15.6, -9.5, -3.5, 6.3, 12.6, 19.3]) {
        const p = lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0]));
        solid(face, R(p[0] - 0.2, p[1] - 0.15, p[0] + 0.2, p[1] + 0.15), 11.2, 18.8, 'trim');
      }
      const cf = edge(plans.cross[0].outline, [0, sg]);
      for (const t of [0.05, 0.95]) {
        const p = lerp(cf.a, cf.b, t);
        solid(face, circle(p, 0.22, 4), 5.3, 20.2, 'trim');
      }
      for (let j = 0; j < 3; j++) {
        const p = lerp(cf.a, cf.b, 0.5),
          n = cf.normal,
          q = p.map((x, k) => x + n[k] * (0.5 + j * 0.4)),
          a = q.map((x, k) => x - cf.axis[k] * 1.45),
          b = q.map((x, k) => x + cf.axis[k] * 1.45);
        solid(
          face,
          [a, b, b.map((x, k) => x + n[k] * 0.45), a.map((x, k) => x + n[k] * 0.45)],
          footing,
          0.3 - j * 0.08,
          'trim',
        );
      }
    }
  }
}
export const buildDubrovnikCathedralSkyline = (o) => build(o, 0),
  buildDubrovnikCathedralDistrict = (o) => build(o, 1),
  buildDubrovnikCathedralStreet = (o) => build(o, 2),
  buildDubrovnikCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const dubrovnikCathedralStudy = {
  id: 'N0380',
  key: 'dubrovnik_cathedral',
  title: 'Dubrovnik Cathedral',
  category: 'cathedral',
  wikidataId: 'Q584428',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current77-vertex main; western central projection signs the-X front. No independent component controls; unrelated northern building_part excluded.',
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
    'Four existing cached256-square coursed limestone, continuous limestone, standing-seam metal and plain-wood graphs. Linear pale-stone/gray/wood tints, metric UVs and flat architectural normals; glazing/metal accents use geometric PBR colors. No embedded images, unique facade maps or baked shadows.',
  importReason:
    'Four authored browser levels preserve mapped body, recessed colonnaded Baroque front, gray nave/aisle/transept roofs, central dark ribbed dome and slender pale lantern/cross.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two inspected2011 front/2016 elevated-side pictures and standard viewer PMTiles/DEM only. All heights and internal partitions are picture estimates. Fine Corinthian carving/statue identity, ironwork, inscriptions, full interiors, exact hidden rear/current finishes and surveyed paving/thresholds remain approximate or excluded. The nearby bell tower and other church are separate buildings. Physical phone/laptop timings pending.',
    'Skyline retains pale front/columns/crown, gray roofs and dome/lantern/cross; small windows and balustrades omitted. District adds shared surfaces and flat fields. Street adds actual recessed glazing/wood portals/figure niches, dome ribs, pilasters, balcony/open balustrades and simplified statues; closeup/master refine frames/capitals. Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('colonnaded-front-and-open-entry', [-59, 16, -9], [-18, 10, -0.2]),
    cam('upper-front-window-volutes-crown', [-63, 35, -14], [-17, 21, 0]),
    cam('north-side-gray-roofs-and-lunettes', [21, 35, -66], [1, 15, -3]),
    cam('south-transept-and-roof', [25, 36, 65], [2, 16, 4]),
    cam('drum-dark-dome-and-pale-lantern', [-22, 51, -41], [1.5, 33, -0.8]),
    cam('roof-and-signed-plan', [0, 135, 1], [0, 18, 0]),
  ],
};

/** Imam Husayn shrine: mapped gold dome, paired minarets and covered courtyard ranges. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingShape as baseOpeningShape,
  prepareOpening as basePrepareOpening,
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
const prepareOpening = (h, b, d) => ({ ...basePrepareOpening(h, b, d), ring: openingShape(h, d) });
const source = new URL(
  '../../../content/worldgen/source/places/sv/svz/n0463_imam_husayn_mausoleum/',
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
  wall: '#d7cebb',
  trim: '#ddd7c6',
  roof: '#bfc4bb',
  paving: '#c9c9bf',
  gold: '#e8bf64',
  tile: '#668fab',
  glass: '#526b70',
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
const _lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
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
const footing = (p) => Math.min(-0.35, floor - 0.3, husaynGround(...p) - 0.35);
export function husaynGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Husayn footing outside retained terrain');
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
    if (h.name.startsWith('court-') && (i === 0 || i === 1 || i === inner.length - 1)) continue;
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
const plans = rec.plans;
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    });
const _edges = (ring) =>
  ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(ring), -axis[0] * sign(ring)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
const hole = (
  name,
  center,
  axis,
  normal,
  width,
  bottom,
  height,
  spring,
  shape = 'pointed',
  depth = 2,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
export function husaynInside(p, r) {
  let yes = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
const mid = (r) =>
  [0, 1].map((k) => (Math.min(...r.map((p) => p[k])) + Math.max(...r.map((p) => p[k]))) / 2);
function down(face, r, y, slot) {
  const ids = earcut(r.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(r[k], y)),
      [0, -1, 0],
    );
}
function slab(face, r, y, h, slot) {
  sides(face, r, y, y + h, slot);
  cap(face, r, y + h, slot);
  down(face, r, y, slot);
}
const coord = (h, u, y, v = 0) => [
  h.center[0] + h.axis[0] * u + h.normal[0] * v,
  y,
  h.center[1] + h.axis[1] * u + h.normal[1] * v,
];
export function husaynFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [k, r, top] of [
    ['gallery', plans.gallery.outline, 12.5],
    ['core', plans.core.outline, 12],
    ...plans.gates.map((g) => [`gate-${g.id}`, g.outline, 11.3]),
  ])
    for (const [i, e] of _edges(r).entries()) {
      if (e.length < 5) continue;
      const n = Math.max(1, Math.floor(e.length / (d === 1 ? 13 : d === 2 ? 8 : 6))),
        step = e.length / n;
      for (let j = 0; j < n; j++)
        for (const tier of d === 1 ? [0] : [0, 1]) {
          const p = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n),
            h = hole(
              `${k}-${i}-${j}-${tier}`,
              p,
              e.axis,
              e.normal,
              Math.min(3.4, step * 0.6),
              tier ? 6.6 : 0.65,
              tier ? 3.5 : 4.6,
              tier ? 2 : 2.9,
              'pointed',
              0.8,
            );
          h.kind = tier ? 'window' : 'door';
          h.tier = tier;
          h.top = top;
          hs.push(h);
        }
    }
  return hs;
}
function field(face, h, d) {
  // Shallow opaque fields describe the exterior; they are not traversable room openings.
  pane(face, h, d, 0.045, h.tier ? 'glass' : 'wall');
  archBand(face, h, d, d === 1 ? 0.28 : 0.4, 'tile', 0.065);
  if (d >= 2) {
    const q = {
      ...h,
      width: h.width * 0.48,
      bottom: h.bottom + 0.15,
      height: h.height * 0.65,
      spring: h.spring * 0.7,
    };
    pane(face, q, d, 0.075, h.tier ? 'glass' : 'glass');
    if (d >= 3) archBand(face, q, d, 0.13, 'trim', 0.095);
  }
}
function pointedSpandrel(face, bay, d) {
  const { span, center: p, axis, normal } = bay,
    w = span / 2,
    shape = openingShape(
      { width: span - 0.7, bottom: 0.7, height: 10.6, spring: 7.4, shape: 'pointed' },
      d,
    ).slice(2),
    ring = [[-w, 8.1], [-w, 12], [w, 12], [w, 8.1], ...shape],
    ids = earcut(ring.flat(), [], 2),
    P = ([x, y], v) => [
      p[0] + axis[0] * x + normal[0] * v,
      floor + y,
      p[1] + axis[1] * x + normal[1] * v,
    ];
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => ring[k]);
    face(
      'gold',
      q.map((q) => P(q, -0.3)),
      [-normal[0], 0, -normal[1]],
    );
    face(
      'tile',
      q.map((q) => P(q, 0.3)),
      [normal[0], 0, normal[1]],
    );
  }
  const sg = Math.sign(
    ring.reduce((n, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dy = b[1] - a[1];
    face(
      'gold',
      [P(a, -0.3), P(b, -0.3), P(b, 0.3), P(a, 0.3)],
      [axis[0] * dy * sg, -dx * sg, axis[1] * dy * sg],
    );
  }
}
export function husaynPortico() {
  const e = _edges(plans.core.outline)[0],
    n = 5;
  return Array.from({ length: n }, (_, j) => ({
    span: e.length / n,
    center: e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n + e.normal[k] * 4.5),
    column: e.a.map((v, k) => v + ((e.b[k] - v) * j) / n + e.normal[k] * 4.5),
    axis: e.axis,
    normal: e.normal,
  }));
}
function portico(face, d) {
  const bays = husaynPortico(),
    e = _edges(plans.core.outline)[0];
  for (const b of bays) {
    pointedSpandrel(face, b, d);
    solid(
      face,
      circle(b.column, d === 0 ? 0.48 : 0.34, d === 0 ? 4 : d === 1 ? 6 : 10),
      0.7,
      8.1,
      'gold',
    );
    if (d >= 2) {
      solid(face, circle(b.column, 0.65, 8), 0.7, 1, 'trim');
      solid(face, circle(b.column, 0.63, 8), 7.7, 8.1, 'gold');
    }
  }
  const end = e.b.map((v, k) => v + e.normal[k] * 4.5);
  solid(face, circle(end, d === 0 ? 0.48 : 0.34, d === 0 ? 4 : d === 1 ? 6 : 10), 0.7, 8.1, 'gold');
  const a = e.a.map((v, k) => v + e.normal[k] * 4.8),
    b = e.b.map((v, k) => v + e.normal[k] * 4.8),
    r = [e.a, e.b, b, a];
  slab(face, r, 12, 0.5, 'gold');
}
function lowCap(face, r, d) {
  const p = mid(r),
    radius = Math.max(...r.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1]))),
    n = [4, 8, 12, 20, 24][d];
  profile(
    face,
    circle(p, radius, n),
    d === 0
      ? [
          [12.5, 1],
          [14.5, 0],
        ]
      : [
          [12.5, 1],
          [13, 0.98],
          [14, 0.64],
          [14.5, 0],
        ],
    'roof',
  );
}
function dome(face, d) {
  const p = plans.domeCenter,
    n = [8, 12, 20, 28, 32][d],
    r = 8.9;
  solid(face, circle(p, r * 0.92, n), 12, 17, 'tile');
  const levels =
    d === 0
      ? [
          [17, 0.92],
          [22, 1],
          [27, 0.65],
          [31.4, 0],
        ]
      : [
          [17, 0.92],
          [18.2, 1],
          [20.2, 1.035],
          [22.5, 1],
          [25, 0.86],
          [27.5, 0.62],
          [29.7, 0.3],
          [31.4, 0],
        ];
  profile(face, circle(p, r, n), levels, 'gold');
  profile(
    face,
    circle(p, d === 0 ? 0.12 : 0.085, d === 0 ? 4 : 8),
    [
      [31.4, 1],
      [32, 0],
    ],
    'gold',
  );
  if (d > 0)
    for (let i = 0; i < (d === 1 ? 6 : 12); i++) {
      const a = (i * Math.PI * 2) / (d === 1 ? 6 : 12),
        normal = [Math.cos(a), Math.sin(a)],
        axis = [-normal[1], normal[0]],
        q = p.map((v, k) => v + normal[k] * r * 0.925),
        h = hole(`drum-${i}`, q, axis, normal, 1.25, 13, 2.9, 1.8, 'pointed', 0.8);
      pane(face, h, d, 0.04, 'glass');
      if (d >= 2) archBand(face, h, d, 0.15, 'trim', 0.06);
    }
}
function minaret(face, p, d) {
  const n = [6, 8, 12, 20, 24][d],
    r = circle(p, 1.7, n);
  if (d === 0)
    profile(
      face,
      r,
      [
        [0.7, 1],
        [32.5, 0.85],
        [34, 1.55],
        [34.5, 1.55],
        [34.5, 0.65],
        [40, 0.65],
        [43.5, 0],
      ],
      'gold',
    );
  else
    profile(
      face,
      r,
      [
        [0.7, 1.1],
        [12, 1.05],
        [30.5, 0.87],
        [32.5, 0.87],
        [33, 1.1],
        [33.5, 1.3],
        [34, 1.55],
        [34.5, 1.55],
        [34.5, 0.65],
        [39.5, 0.65],
        [40, 0.8],
        [41.7, 0.75],
        [43.5, 0],
      ],
      'gold',
    );
  profile(
    face,
    circle(p, d === 0 ? 0.15 : 0.09, d === 0 ? 4 : 8),
    [
      [43.5, 1],
      [44, 0],
    ],
    'gold',
  );
  if (d > 0) {
    sides(face, circle(p, 1.71, n), 13.5, 14.3, 'tile');
    sides(face, circle(p, 1.49, n), 29.7, 30.4, 'tile');
  }
  if (d >= 2) {
    const ring = circle(p, 2.6, n);
    for (let i = 0; i < n; i++) beam(face, at(ring[i], 34.5), at(ring[i], 35.15), 0.07, 'gold');
    for (let i = 0; i < n; i++)
      beam(face, at(ring[i], 35.15), at(ring[(i + 1) % n], 35.15), 0.07, 'gold');
  }
}
function clock(face, d) {
  const p = plans.clock.center;
  solid(face, plans.clock.base.outline, 11.3, 17.3, 'tile');
  solid(face, plans.clock.top.outline, 17.3, 20.5, 'wall');
  profile(
    face,
    circle(p, 1.55, d === 0 ? 4 : 8),
    [
      [20.5, 1],
      [21.3, 0],
    ],
    'gold',
  );
  if (d > 0)
    for (const e of _edges(plans.clock.top.outline)) {
      const p = e.a.map((v, k) => (v + e.b[k]) / 2),
        h = hole('clock', p, e.axis, e.normal, 0.85, 18, 1.1, 0.5, 'circle', 0.5);
      pane(face, h, d, 0.03, 'trim');
      if (d >= 2) {
        beam(
          face,
          coord(h, 0, floor + 18.55, 0.05),
          coord(h, 0, floor + 18.93, 0.05),
          0.04,
          'glass',
        );
        beam(
          face,
          coord(h, 0, floor + 18.55, 0.05),
          coord(h, 0.28, floor + 18.55, 0.05),
          0.04,
          'glass',
        );
      }
    }
}
function build(out, d) {
  const face = writer(out, d),
    main = plans.gallery.outline,
    core = plans.core.outline;
  sides(face, main, footing, 0.7, 'paving');
  cap(face, main, 0.7, 'paving');
  // The currently mapped annulus is roofed; no historical open-court hole is invented.
  sides(face, main, 0.7, 12.5, 'wall');
  sides(face, main, 0.7, 12.15, 'wall', true);
  cap(face, main, 12.5, 'roof', [core]);
  cap((s, p) => face(s, p, [0, -1, 0]), main, 12.15, 'roof', [core]);
  sides(face, core, 0.7, 12, 'wall');
  cap(face, core, 12, 'roof');
  for (const g of plans.gates) {
    sides(face, g.outline, footing, 0.7, 'paving');
    cap(face, g.outline, 0.7, 'paving');
    sides(face, g.outline, 0.7, 11.3, 'wall');
    cap(face, g.outline, 11.3, 'roof');
  }
  for (const h of husaynFields(d)) {
    field(face, h, d);
    if (d >= 3 && h.name.startsWith('gallery-'))
      field(face, { ...h, normal: h.normal.map((v) => -v) }, d);
  }
  if (d > 0)
    for (const r of [main, core]) {
      sides(face, scaled(r, 1.003), 5.9, 6.3, 'tile');
      sides(face, scaled(r, 1.004), 11.1, 11.7, 'tile');
    }
  for (const r of plans.caps) lowCap(face, r.outline, d);
  // Sparse rooflight strips are estimated from the covered-court photograph, not map parts.
  if (d >= 2)
    for (const e of _edges(main)) {
      if (e.length < 15) continue;
      const n = Math.floor(e.length / 10);
      for (let i = 0; i < n; i++) {
        const p = e.a.map((v, k) => v + ((e.b[k] - v) * (i + 0.5)) / n - e.normal[k] * 5);
        if (!husaynInside(p, core))
          solid(face, rect(p[0] - 1.8, p[1] - 1.1, p[0] + 1.8, p[1] + 1.1), 12.5, 12.6, 'glass');
      }
    }
  portico(face, d);
  dome(face, d);
  for (const p of plans.minarets) minaret(face, p.center, d);
  clock(face, d);
}
export const buildHusaynSkyline = (o) => build(o, 0),
  buildHusaynDistrict = (o) => build(o, 1),
  buildHusaynStreet = (o) => build(o, 2),
  buildHusaynCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const husaynStudy = {
  id: 'N0463',
  key: 'imam_husayn_mausoleum',
  title: 'Imam Husayn Mausoleum',
  category: 'mosque',
  wikidataId: 'Q773704',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared 256² stucco, raw limestone, lime plaster, marble, cast bronze and mosaic tile graphs serve seven merged roles. Metric UVs, linear colors, no embedded images or photographs. Fine inscriptions and artwork omitted.',
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
    'Current named map controls resolve the older reference-only record. Total heights and part centers are mapped; detailed vertical profiles, facade facing, portico bays, window rhythm, rooflights, small roof caps and clock division are estimates. The currently roofed annulus follows the map and covered-court photograph; no historic snapshot or furnished interior claim. Festivals, crowds, flags, chandeliers, calligraphy, fine faience art and crypts omitted. External expansion, city and streets remain host content. Physical phone/tablet/laptop timings pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('gold-portico-under-covered-court', [5, 6, 48], [5, 7, 34]),
    cam('main-golden-dome', [32, 36, 30], [5, 23, 3]),
    cam('gold-minaret-balcony', [34, 37, 49], [18, 31, 22]),
    cam('qibla-gate-clock', [5, 27, 110], [6, 16, 70]),
    cam('covered-gallery-and-gate-ranges', [-87, 80, -105], [5, 7, 3]),
    cam('north-up-mapped-control', [0, 280, 0.1], [5, 7, 3]),
  ],
};

/** Esztergom Basilica: colonnaded limestone front, gray roofs and ribbed dark dome. */
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
  '../../../content/worldgen/source/places/u2/u2m/esztergom_basilica/',
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
  roof: '#84b3a8',
  door: '#604a3a',
  glass: '#526773',
  accent: '#9d8a55',
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
const footing = (p) => Math.min(floor - 0.3, esztergomGround(...p) - 0.35);
export function esztergomGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Esztergom Basilica footing outside retained terrain');
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
  _main = rec.main.polygons[0].outline;
const R = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const circle = (p, r, n, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos(offset + (i * Math.PI * 2) / n) * r,
    p[1] + Math.sin(offset + (i * Math.PI * 2) / n) * r,
  ]);
const frontHole = (name, x, z, w, b, h, s = h, shape = 'rect', depth = 3) =>
  hole(name, [x, z], [0, 1], [1, 0], w, b, h, s, shape, depth);
function fields(_d = 3) {
  const a = [
    { ...frontHole('main-timber-portal', 42, 1.0, 4.2, 0.5, 9), kind: 'door' },
    frontHole('portico-upper-field', 42, 1.0, 4.2, 15.0, 7.5),
  ];
  for (const z of [-13.2, 15.0])
    a.push({ ...frontHole(`side-portal-${z}`, 42, z, 2.4, 0.5, 5.6), kind: 'door' });
  const body = plans.body[0].outline;
  for (const sg of [-1, 1]) {
    const f = edge(body, [0, sg]);
    for (const x of [-36, -10, 13]) {
      const t = (x - f.a[0]) / (f.b[0] - f.a[0]);
      a.push(
        hole(
          `side-lunette-${sg}-${x}`,
          lerp(f.a, f.b, t),
          f.axis,
          f.normal,
          x === -36 ? 15 : 11,
          25.2,
          x === -36 ? 7.5 : 5.5,
          0,
          'round',
          3,
        ),
      );
    }
    for (const x of [-44, -36, -9, 0, 9]) {
      const t = (x - f.a[0]) / (f.b[0] - f.a[0]);
      a.push(
        hole(
          `lower-side-${sg}-${x}`,
          lerp(f.a, f.b, t),
          f.axis,
          f.normal,
          3.2,
          14,
          7.5,
          5.9,
          'round',
          3,
        ),
      );
    }
  }
  const rear = edge(body, [-1, 0]);
  for (const t of [0.2, 0.5, 0.8])
    a.push(
      hole(
        `rear-window-${t}`,
        lerp(rear.a, rear.b, t),
        rear.axis,
        rear.normal,
        3.8,
        18,
        8,
        6.1,
        'round',
        3,
      ),
    );
  for (const [j, p] of rec.estimated.towerCenters.entries()) {
    const r = circle(p, 5.4, 8, Math.PI / 8);
    for (let i = 0; i < 8; i++) {
      const f = faceFrame(r, i);
      a.push(
        hole(
          `belfry-louver-${j}-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          2.1,
          37,
          10,
          8.95,
          'round',
          3,
        ),
      );
    }
    const base = plans[j === 0 ? 'towerNorth' : 'towerSouth'][0].outline;
    for (const n of [
      [1, 0],
      [0, j === 0 ? -1 : 1],
    ]) {
      const f = edge(base, n);
      a.push(
        hole(
          `tower-oculus-${j}-${n}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          1.9,
          25,
          1.9,
          0,
          'circle',
          3,
        ),
      );
      a.push({
        ...hole(
          `tower-door-${j}-${n}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          2.2,
          0.4,
          4.6,
          3.5,
          'round',
          3,
        ),
        kind: 'door',
      });
    }
  }
  const dc = rec.estimated.domeCenter,
    dr = circle(dc, 15.75, 24);
  for (let i = 0; i < 24; i++) {
    const f = faceFrame(dr, i);
    a.push(
      hole(
        `drum-window-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        2.0,
        46.0,
        14.8,
        14.8,
        'rect',
        3,
      ),
    );
  }
  return a;
}
export const esztergomFields = fields;
const passages = () =>
  [-1, 1].map((sg) =>
    frontHole(
      `open-wing-arch-${sg}`,
      26.2,
      sg < 0 ? -28.0 : 29.2,
      7.0,
      -3.5,
      19.0,
      15.5,
      'round',
      24,
    ),
  );
export const esztergomPassages = passages;
function column(face, p, b, t, r, d) {
  const n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : 12,
    ring = circle(p, r, n);
  profile(
    face,
    ring,
    d === 0
      ? [
          [b, 1.15],
          [t, 1.05],
        ]
      : d === 1
        ? [
            [b, 1.35],
            [b + 0.6, 1],
            [t - 0.7, 0.85],
            [t, 1.35],
          ]
        : [
            [b, 1.4],
            [b + 0.35, 1.4],
            [b + 0.7, 1],
            [t - 1.1, 0.83],
            [t - 0.7, 1.2],
            [t - 0.3, 1.4],
            [t, 1.4],
          ],
    'trim',
  );
  if (d >= 3) {
    for (const sg of [-1, 1])
      solid(
        face,
        R(p[0] - 0.4, p[1] + sg * r * 0.8 - 0.3, p[0] + 0.4, p[1] + sg * r * 0.8 + 0.3),
        t - 0.8,
        t - 0.3,
        'trim',
      );
  }
}
function dome(face, p, r, b, t, d, slot = 'roof') {
  const n = d === 0 ? 12 : d === 1 ? 16 : d === 2 ? 24 : 32,
    levels = [];
  const steps = d === 0 ? 3 : d === 1 ? 5 : d === 2 ? 8 : 12;
  for (let j = 0; j <= steps; j++) {
    const a = ((j / steps) * Math.PI) / 2;
    levels.push([b + (t - b) * Math.sin(a), Math.max(0.008, Math.cos(a))]);
  }
  const ring = circle(p, r, n);
  profile(face, ring, levels, slot);
  if (d >= 2) {
    const count = d === 2 ? 12 : 24;
    for (let k = 0; k < count; k++) {
      const a = (k * Math.PI * 2) / count;
      for (let j = 1; j <= steps; j++) {
        const point = (q) => [
          p[0] + Math.cos(a) * (r + 0.045) * Math.cos(((q / steps) * Math.PI) / 2),
          floor + b + (t - b) * Math.sin(((q / steps) * Math.PI) / 2) + 0.045,
          p[1] + Math.sin(a) * (r + 0.045) * Math.cos(((q / steps) * Math.PI) / 2),
        ];
        beam(face, point(j - 1), point(j), d === 2 ? 0.14 : 0.11, 'roof');
      }
    }
  }
}
function crossTop(face, p, b, t, d, w = 0.22) {
  beam(face, at(p, b), at(p, t), w, d === 0 ? 'trim' : 'accent');
  const y = t - (t - b) * 0.28;
  beam(
    face,
    [p[0], floor + y, p[1] - (t - b) * 0.23],
    [p[0], floor + y, p[1] + (t - b) * 0.23],
    w,
    d === 0 ? 'trim' : 'accent',
  );
}
function pediment(face, d) {
  const front = 58.0,
    back = 42.0,
    z0 = -21.15,
    z1 = 22.35,
    mid = (z0 + z1) / 2,
    b = 34.3,
    t = 43.0;
  const tri = (x) => [
    [x, floor + b, z0],
    [x, floor + b, z1],
    [x, floor + t, mid],
  ];
  face('wall', tri(front), [1, 0, 0]);
  face('wall', tri(back), [-1, 0, 0]);
  const a = tri(front),
    q = tri(back);
  face('roof', [a[0], q[0], q[2], a[2]], [0, 1, 0]);
  face('roof', [a[2], q[2], q[1], a[1]], [0, 1, 0]);
  if (d >= 2) {
    for (const x of [front + 0.08])
      for (const [z, y] of [
        [z0, b],
        [z1, b],
      ])
        beam(face, [x, floor + y, z], [x, floor + t, mid], 0.5, 'trim');
    // Broad shallow geometric relief; no inscription or sculptural identity claimed.
    solid(face, R(front + 0.03, mid - 2, front + 0.13, mid + 2), 35.6, 36.1, 'trim');
    solid(face, circle([front + 0.1, mid], 0.5, 6), 36.1, 38.2, 'trim');
  }
}
function build(out, d) {
  const face = writer(out, d),
    all = fields(d),
    selected = d >= 2 ? all : [],
    ps = passages();
  const body = plans.body[0].outline;
  shell(out, d, body, footing, 34, selected);
  cap(face, body, 34, 'wall');
  // Portico floor remains below the air lanes and is not a filled building mass.
  for (const p of plans.portico) solid(face, p.outline, footing, 0.6, 'trim');
  for (const key of ['linkNorth', 'linkSouth'])
    for (const p of plans[key]) {
      shell(out, d, p.outline, footing, 34, ps);
      cap(face, p.outline, 34, 'trim');
    }
  for (const [j, p] of rec.estimated.towerCenters.entries()) {
    const key = j === 0 ? 'towerNorth' : 'towerSouth',
      r = plans[key][0].outline;
    shell(
      out,
      d,
      r,
      footing,
      34,
      selected.filter((h) => h.name.startsWith('tower-')),
    );
    cap(face, r, 34, 'trim');
    const upper = circle(p, 5.4, d === 0 ? 8 : 8, Math.PI / 8);
    shell(
      out,
      d,
      upper,
      33,
      49,
      selected.filter((h) => h.name.startsWith(`belfry-louver-${j}`)),
    );
    cap(face, upper, 49, 'trim');
    if (d > 0) {
      band(
        writer(
          masked(
            out,
            selected
              .filter((h) => h.name.startsWith('tower-door-'))
              .map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
          ),
          d,
        ),
        r,
        3,
        0.45,
        'trim',
        1.005,
      );
      band(face, r, 23.5, 0.65, 'trim', 1.01);
      band(face, r, 32.5, 0.85, 'trim', 1.015);
      band(face, upper, 48.5, 0.6, 'trim', 1.08);
    }
    dome(face, p, 5.5, 49.2, 55, d);
    solid(
      face,
      circle(p, d === 0 ? 0.32 : 0.45, d === 0 ? 4 : 8),
      55,
      55.8,
      d === 0 ? 'trim' : 'accent',
    );
    crossTop(face, p, 55.8, 58, d, 0.18);
  }
  // Shallow copper hip around the drum and a separate estimated rear terrace.
  const roof = R(-27, -20.7, 42, 22.1);
  hip(face, roof, 34.5, 40, 'roof');
  const terrace = R(-57.9, -20.7, -27, 22.1);
  solid(face, terrace, 34, 35.5, 'wall');
  if (d > 0) {
    for (const [a, b] of terrace.map((a, i) => [a, terrace[(i + 1) % terrace.length]]))
      beam(face, at(a, 36.5), at(b, 36.5), 0.5, 'trim');
    band(face, body, 32.8, 0.6, 'trim', 1.006);
    band(face, body, 23.2, 0.5, 'trim', 1.005);
  }
  // Full eight-column facade at every level; actual open space to the inset wall.
  for (const z of rec.estimated.frontColumnsZ) column(face, [56.1, z], 0.6, 30.5, 1.1, d);
  const canopy = R(41.9, -21.2, 58.1, 22.4);
  sides(face, canopy, 30.5, 34.3, 'trim');
  cap(face, canopy, 34.3, 'trim');
  // Closed underside points outward down, so upward portico views remain visible.
  face(
    'trim',
    canopy.map((p) => at(p, 30.5)),
    [0, -1, 0],
  );
  pediment(face, d);
  const dc = rec.estimated.domeCenter,
    n = d === 0 ? 12 : d === 1 ? 24 : 24,
    core = circle(dc, 15.75, n);
  shell(
    out,
    d,
    core,
    33,
    63,
    selected.filter((h) => h.name.startsWith('drum-window-')),
  );
  cap(face, core, 63, 'trim');
  if (d === 0) {
    sides(face, circle(dc, 17.7, 12), 62.3, 66, 'trim');
  } else {
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI * 2) / 24;
      column(face, [dc[0] + Math.cos(a) * 17.3, dc[1] + Math.sin(a) * 17.3], 42.0, 62.3, 0.62, d);
    }
    profile(
      face,
      circle(dc, 18.7, d === 1 ? 24 : 32),
      [
        [61.8, 0.96],
        [63.5, 0.96],
        [64.2, 1],
        [65.5, 1],
        [66, 0.94],
      ],
      'trim',
    );
    band(face, circle(dc, 17.9, d === 1 ? 24 : 32), 41.5, 0.8, 'trim', 1);
  }
  dome(face, dc, 17.5, 66, 84, d);
  solid(
    face,
    circle(dc, d === 0 ? 0.6 : 0.8, d === 0 ? 6 : 12),
    84,
    85.8,
    d === 0 ? 'trim' : 'accent',
  );
  crossTop(face, dc, 85.8, 90, d, d === 0 ? 0.4 : 0.3);
  if (d > 0) for (const h of all) panel(face, h, d);
  // Paired pilasters bracket the high lunettes rather than crossing their glazing.
  if (d >= 2)
    for (const sg of [-1, 1]) {
      const f = edge(body, [0, sg]);
      for (const x of [-55, -48, -24, 4, 20, 39]) {
        const p = lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0]));
        solid(face, R(p[0] - 0.4, p[1] - 0.23, p[0] + 0.4, p[1] + 0.23), 4, 32.7, 'trim');
      }
    }
  if (d >= 2) {
    for (const key of ['linkNorth', 'linkSouth']) {
      const r = plans[key][0].outline,
        min = Math.min(...r.map((p) => p[1])),
        max = Math.max(...r.map((p) => p[1]));
      for (const x of [20.6, 30.8]) {
        beam(face, [x, floor + 34.5, min], [x, floor + 34.5, max], 0.5, 'trim');
        beam(face, [x, floor + 36.0, min], [x, floor + 36.0, max], 0.5, 'trim');
        for (let z = min + 0.7; z < max - 0.4; z += 1.25)
          solid(face, circle([x, z], 0.13, 4), 34.5, 36.0, 'trim');
      }
    }
  }
  const steps = d === 0 ? 1 : d === 1 ? 3 : 10;
  for (let j = 0; j < steps; j++) {
    const x0 = 58.1 + (j * 5.8) / steps,
      x1 = 58.1 + ((j + 1) * 5.8) / steps,
      y = 0.6 - ((j + 1) / steps) * 3.5;
    for (let k = 0; k < 6; k++)
      solid(
        face,
        R(x0, -19.6 + (k * 40.4) / 6, x1, -19.6 + ((k + 1) * 40.4) / 6),
        footing,
        y,
        'trim',
      );
  }
}
export const buildEsztergomSkyline = (o) => build(o, 0),
  buildEsztergomDistrict = (o) => build(o, 1),
  buildEsztergomStreet = (o) => build(o, 2),
  buildEsztergomCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const esztergomStudy = {
  id: 'esztergom_basilica',
  key: 'esztergom_basilica',
  title: 'Esztergom Basilica',
  category: 'cathedral',
  wikidataId: 'Q991832',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current24-vertex whole plus20-vertex100m dome control. Eastern eight-column portico signs retained axis. Existing height100m/length120m/width40m facts retained with unspecified datums/scope.',
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
    'Four existing cached256-square coursed limestone, continuous limestone, oxidized copper and plain-wood graphs. Linear pale-stone/green-copper/wood tints, metric UVs and flat architectural normals; glazing/gold accents use geometric PBR colors. No embedded images, unique facade maps or baked shadows.',
  importReason:
    'Four authored browser levels preserve the eight-column deep portico, open wing arches, paired smaller tower domes, tall colonnaded central drum and dominant green dome/cross.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three inspected2012/2013/undated older aerial/front pictures plus standard viewer PMTiles/DEM. Existing dimensions/map height retained; crypt/floor datum and exact measured scopes unverified. Other heights/internal partitions,hidden rear roof and current finishes are approximate. Fine Corinthian sculpture,reliefs,inscriptions,interiors and surveyed thresholds excluded or simplified. Nearby castle/seminary/retaining walls are separate objects. Physical phone/laptop timings pending.',
    'Skyline keeps eight-column portico,open lateral arches,central drum/green dome and paired smaller domes;small glazing/colonnade omitted. District adds shared surfaces,24 simplified drum columns/flat fields and simple cornices. Street adds actual recessed fields and dome ribs/pilasters/balustrades;closeup/master refine columns/opening frames and ribs. Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('eight-column-portico-and-inset-portal', [125, 19, 40], [48, 17, 1]),
    cam('pediment-and-lateral-arch', [108, 50, -71], [34, 30, -15]),
    cam('north-side-lunettes-and-rear', [-78, 45, -109], [-21, 23, -5]),
    cam('south-wing-and-octagonal-tower', [54, 60, 108], [17, 34, 18]),
    cam('colonnaded-drum-and-green-dome', [63, 103, 78], [-2.6, 68, -1.3]),
    cam('roof-and-signed-whole-plan', [0, 225, 1], [0, 28, 0]),
  ],
};

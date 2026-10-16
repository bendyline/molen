/** Havana Cathedral: unequal pierced towers,wavy coral-stone Baroque screen and red rear dome. */
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
  '../../../content/worldgen/source/places/dh/dhj/n0390_havana_cathedral/',
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
  wall: '#dfd0b2',
  trim: '#eee1c3',
  roof: '#b17456',
  door: '#92704e',
  glass: '#414f57',
  accent: '#555a55',
  cap: '#c3a8a0',
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
const footing = (p) => Math.min(floor - 0.3, havanaCathedralGround(...p) - 0.35);
export function havanaCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('HavanaCathedral Cathedral footing outside retained terrain');
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
    // Near ribs carry depth; distant trim retains the broad front face.
    if (d >= 2)
      face(slot, [
        p.point(...outer[i], 0),
        p.point(...outer[j], 0),
        p.point(...outer[j], offset),
        p.point(...outer[i], offset),
      ]);
    if (d >= 2)
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
const main = rec.main.polygons[0].outline,
  plans = rec.plans,
  est = rec.estimated,
  small = rec.controls[1].polygons[0].outline,
  large = rec.controls[2].polygons[0].outline,
  dome = rec.controls[3].polygons[0].outline;
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  circle = (p, r, n = 12, phase = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    }),
  front = {
    a: [est.frontX, -7.4],
    b: [est.frontX, 9.1],
    axis: [0, 1],
    normal: [1, 0],
    length: 16.5,
  },
  on = (f, u = 0) => [
    f.a[0] + (f.b[0] - f.a[0]) * 0.5 + f.axis[0] * u,
    f.a[1] + (f.b[1] - f.a[1]) * 0.5 + f.axis[1] * u,
  ];
const lantern = circle(est.domeCenter, 1.65, 8, Math.PI / 8);
function bevel(r) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[(i + r.length - 1) % r.length],
      b = r[i],
      c = r[(i + 1) % r.length];
    out.push(lerp(b, a, 0.2), lerp(b, c, 0.2));
  }
  return out;
}
const smallCrown = bevel(scaled(small, 0.77)),
  largeCrown = bevel(scaled(large, 0.73));
function fields(d = 4) {
  if (d === 0) return [];
  const hs = [];
  for (const [u, w, h] of [
    [-6.1, 2.2, 4.5],
    [0, 3.2, 5.5],
    [6.1, 2.2, 4.5],
  ])
    hs.push({
      ...hole(`front-door-${u}`, on(front, u), front.axis, front.normal, w, 0.25, h, h, 'rect', 7),
      kind: 'door',
    });
  for (const u of [-6.1, 6.1])
    hs.push({
      ...hole(
        `wing-floral-${u}`,
        on(front, u),
        front.axis,
        front.normal,
        1.25,
        7.5,
        1.35,
        0.675,
        'circle',
        7,
      ),
      kind: 'glass',
    });
  hs.push({
    ...hole(
      'central-floral',
      on(front),
      front.axis,
      front.normal,
      2.05,
      15.6,
      2.1,
      1.05,
      'circle',
      5,
    ),
    kind: 'glass',
  });
  for (const [u, b, h, w] of [
    [-3.5, 0.9, 3.0, 1.0],
    [3.5, 0.9, 3, 1],
    [-3.4, 12.05, 2.8, 0.9],
    [0, 12, 1.65, 0.8],
    [3.4, 12.05, 2.8, 0.9],
  ])
    hs.push({
      ...hole(
        `blind-niche-${u}-${b}`,
        on(front, u),
        front.axis,
        front.normal,
        w,
        b,
        h,
        h - w / 2,
        'round',
        5,
      ),
      kind: 'niche',
    });
  for (const [name, r] of [
    ['small', small],
    ['large', large],
  ])
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (name === 'small') {
        hs.push({
          ...hole(`small-upper-door-${i}`, on(f), f.axis, f.normal, 0.9, 19.3, 3.1, 3.1, 'rect', 3),
          kind: 'door',
          tower: name,
        });
      } else if (d >= 2)
        hs.push({
          ...hole(
            `large-base-slit-${i}`,
            on(f),
            f.axis,
            f.normal,
            0.45,
            5.5,
            0.95,
            0.95,
            'rect',
            3,
          ),
          kind: 'glass',
          tower: name,
        });
    }
  if (d >= 2)
    for (const side of [-1, 1])
      for (const x of [-8, 3, 12])
        hs.push({
          ...hole(
            `aisle-${side}-${x}`,
            [x, side < 0 ? -16.55 : 16.2],
            [1, 0],
            [0, side],
            0.85,
            4.7,
            1.7,
            1.7,
            'rect',
            3,
          ),
          kind: 'glass',
        });
  return hs;
}
export const havanaCathedralFields = fields;
function bellFields(d = 4) {
  const hs = [];
  for (const [name, r, b, h, w] of [
    ['small-lower', small, 12.1, 4.8, 1.6],
    ['large-lower', large, 11.9, 5.1, 2.4],
    ['large-upper', large, 20, 5.05, 2.2],
  ])
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      hs.push({
        ...hole(
          `${name}-${i}`,
          on(f),
          f.axis,
          f.normal,
          Math.min(w, f.length - 1.1),
          b,
          h,
          h - Math.min(w, f.length - 1.1) / 2,
          'round',
          6,
        ),
        kind: 'air',
        tower: name.startsWith('small') ? 'small' : 'large',
      });
    }
  if (d >= 1)
    for (const [name, r, b] of [
      ['small-crown', smallCrown, 26.4],
      ['large-crown', largeCrown, 26.1],
      ['rear-lantern', lantern, 18.0],
    ])
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (i % 2 === 0 && name !== 'rear-lantern') continue;
        hs.push({
          ...hole(
            `${name}-${i}`,
            on(f),
            f.axis,
            f.normal,
            Math.min(0.95, f.length - 0.35),
            b,
            name === 'rear-lantern' ? 2.1 : 1.8,
            name === 'rear-lantern' ? 1.7 : 1.35,
            'round',
            4,
          ),
          kind: 'air',
          tower: name.startsWith('small')
            ? 'small'
            : name.startsWith('large')
              ? 'large'
              : 'lantern',
          crown: true,
        });
      }
  return hs;
}
export const havanaCathedralBelfryFields = bellFields;
function panel(face, h, d) {
  pane(face, h, d, -0.65, h.kind === 'door' ? 'door' : h.kind === 'niche' ? 'wall' : 'glass');
  if (d >= 1) archBand(face, h, d, h.kind === 'niche' ? 0.16 : 0.14, 'trim', 0.1);
  if (d >= 3) archBand(face, h, d, 0.32, 'trim', 0.16);
  if (h.kind === 'glass' && h.name.includes('floral') && d >= 2) {
    const p = prepareOpening(h, 0, d),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
      r = h.width * 0.43,
      N = h.width > 1.5 ? 8 : 6,
      pt = (rad, a) =>
        p.point(Math.cos(a) * rad, h.bottom + h.height / 2 + Math.sin(a) * rad, -0.53 * sg);
    for (let i = 0; i < N; i++) {
      const a = (i * Math.PI * 2) / N,
        b = ((i + 1) * Math.PI * 2) / N;
      beam(face, pt(r, a), pt(r * 0.32, a + 0.45), 0.075, 'trim');
      beam(face, pt(r * 0.32, a + 0.45), pt(r * 0.32, b + 0.45), 0.065, 'trim');
    }
  }
  if (h.kind === 'door' && d >= 2) {
    const p = prepareOpening(h, 0, d),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    for (const u of [-0.28, 0, 0.28])
      beam(
        face,
        p.point(h.width * u, h.bottom + 0.08, -0.56 * sg),
        p.point(h.width * u, h.bottom + h.height - 0.1, -0.56 * sg),
        0.07,
        'door',
      );
    if (d >= 3)
      for (let j = 1; j < 5; j++)
        beam(
          face,
          p.point(-h.width * 0.47, h.bottom + (h.height * j) / 5, -0.56 * sg),
          p.point(h.width * 0.47, h.bottom + (h.height * j) / 5, -0.56 * sg),
          0.06,
          'door',
        );
  }
}
const crownProfile = [
  [-8.25, 13.1],
  [-7.5, 13.5],
  [-6.9, 14.25],
  [-6.3, 14.25],
  [-5.65, 16.75],
  [-4.25, 17.25],
  [-3.1, 18.9],
  [-2.15, 19.1],
  [-1.05, 20.0],
  [0, 21.6],
  [1.05, 20],
  [2.15, 19.1],
  [3.1, 18.9],
  [4.25, 17.25],
  [5.65, 16.75],
  [6.3, 14.25],
  [6.9, 14.25],
  [7.5, 13.5],
  [8.25, 13.1],
];
function screen(face) {
  const outline = [[-8.25, 10.8], [8.25, 10.8], ...crownProfile.toReversed()],
    ids = earcut(outline.flat()),
    point = (q, x) => [x, floor + q[1], est.frontMidZ + q[0]];
  for (const [x, n] of [
    [est.frontX, [1, 0, 0]],
    [est.frontX - 0.9, [-1, 0, 0]],
  ])
    for (let i = 0; i < ids.length; i += 3)
      face(
        'wall',
        ids.slice(i, i + 3).map((j) => point(outline[j], x)),
        n,
      );
  for (let i = 0; i < outline.length; i++) {
    const j = (i + 1) % outline.length;
    face('wall', [
      point(outline[i], est.frontX),
      point(outline[j], est.frontX),
      point(outline[j], est.frontX - 0.9),
      point(outline[i], est.frontX - 0.9),
    ]);
  }
}
function crossTop(face, p, b, t, d) {
  beam(face, at(p, b), at(p, t), d === 0 ? 0.16 : 0.1, 'accent');
  if (d >= 1)
    beam(
      face,
      [p[0], floor + t - 0.27, p[1] - 0.25],
      [p[0], floor + t - 0.27, p[1] + 0.25],
      0.1,
      'accent',
    );
}
function freeStage(face, r, b, t, d) {
  for (const p of r)
    solid(face, circle(lerp(center(r), p, 0.8), d === 0 ? 0.5 : 0.36, 4), b, t, 'wall');
}
function buildTower(out, face, cut, d, name, r, top, crownRing, bells, hs) {
  const towerHs = hs.filter((h) => h.tower === name),
    air = bells.filter((h) => h.tower === name && !h.crown);
  if (d <= 1) {
    solid(face, r, footing, 11.8, 'wall');
    freeStage(face, r, 11.8, 17.1, d);
    if (name === 'small') {
      if (d === 1) shell(out, d, scaled(r, 0.95), 17.1, 25.6, towerHs);
      else solid(face, scaled(r, 0.95), 17.1, 25.6, 'wall');
    } else {
      solid(face, r, 17.1, 19.5, 'wall');
      freeStage(face, r, 19.5, 25.6, d);
    }
  } else {
    shell(out, d, r, footing, 25.6, [...towerHs, ...air], 'wall', scaled(r, 0.54));
    for (const h of air) archBand(face, h, d, 0.19, 'trim', 0.09);
  }
  for (const y of [11.35, 17.25, 25.55]) {
    band(cut, r, y, 0.3, 'trim', 1.08);
    cap(cut, scaled(r, 1.08), y + 0.3, 'trim');
  }
  if (name === 'small') {
    const f = edge(r, [1, 0]),
      h = hole('small-clock', on(f), f.axis, f.normal, 0.85, 23.2, 0.85, 0.425, 'circle', 1);
    pane(face, h, d, 0.12, 'accent');
    if (d >= 1) {
      archBand(face, h, d, 0.09, 'trim', 0.15);
      const p = prepareOpening(h, 0, d),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
        pt = (u, y) => p.point(u, floor + 23.625 + y, 0.16 * sg);
      beam(face, pt(0, 0), pt(0.23, 0.1), 0.055, 'trim');
      beam(face, pt(0, 0), pt(-0.08, 0.28), 0.05, 'trim');
    }
  }
  const crownBase = name === 'small' ? 25.8 : 25.65,
    crownTop = name === 'small' ? 28.9 : 28.6,
    cb = bells.filter((h) => h.tower === name && h.crown);
  if (d >= 2) {
    shell(out, d, crownRing, crownBase, crownTop, cb, 'wall', scaled(crownRing, 0.56));
    for (const h of cb) archBand(face, h, d, 0.12, 'trim', 0.06);
  } else
    freeStage(
      face,
      [crownRing[0], crownRing[2], crownRing[4], crownRing[6]],
      crownBase,
      crownTop,
      d,
    );
  const tinted = (slot, p, n, color) => face(slot, p, n, slot === 'wall' ? colors.cap : color);
  profile(
    tinted,
    scaled(crownRing, 1.02),
    [
      [crownTop, 1],
      [top - 1.0, 0.42],
      [top - 0.65, 0.36],
    ],
    'wall',
  );
  crossTop(face, center(r), top - 0.65, top, d);
  if (d >= 2)
    for (const p of r) solid(face, circle(lerp(center(r), p, 0.88), 0.15, 6), 25.8, 26.3, 'trim');
}
function column(face, p, b, t, d, r = 0.3) {
  if (d === 1) {
    solid(face, R(p[0] - r, p[1] - r, p[0] + r, p[1] + r), b, t, 'trim');
    solid(
      face,
      R(p[0] - r * 1.5, p[1] - r * 1.5, p[0] + r * 1.5, p[1] + r * 1.5),
      t - 0.15,
      t + 0.12,
      'trim',
    );
    return;
  }
  const n = d >= 3 ? 12 : 8;
  solid(face, circle(p, r, n), b, t, 'trim');
  for (const [y, s, h] of [
    [b, 1.4, 0.25],
    [b + 0.25, 1.15, 0.2],
    [t - 0.35, 1.15, 0.18],
    [t - 0.17, 1.5, 0.25],
  ])
    solid(face, circle(p, r * s, n), y, y + h, 'trim');
}
function facadeDecor(face, d) {
  if (d === 0) return;
  const pt = (u, y, off = 0.23) => [est.frontX + off, floor + y, est.frontMidZ + u];
  for (const [u, w, h] of [
    [-6.1, 2.7, 6.2],
    [0, 3.8, 7.2],
    [6.1, 2.7, 6.2],
  ]) {
    beam(face, pt(u - w / 2, h), pt(u, h + 0.75), 0.25, 'trim');
    beam(face, pt(u, h + 0.75), pt(u + w / 2, h), 0.25, 'trim');
    beam(face, pt(u - w / 2, h), pt(u + w / 2, h), 0.2, 'trim');
  }
  for (const [u, h] of [
    [-6.8, 10.5],
    [-4.7, 10.5],
    [-2.7, 10.9],
    [2.7, 10.9],
    [4.7, 10.5],
    [6.8, 10.5],
  ])
    column(face, [est.frontX + 0.28, est.frontMidZ + u], 0.3, h, d, d === 1 ? 0.27 : 0.3);
  for (const [u, h] of [
    [-5.4, 17.6],
    [-2.5, 18.8],
    [2.5, 18.8],
    [5.4, 17.6],
  ])
    column(face, [est.frontX + 0.22, est.frontMidZ + u], 11.2, h, d, 0.28);
  for (const [y, w] of [
    [10.9, 16.9],
    [11.4, 16.6],
    [18.6, 6.3],
  ])
    solid(
      face,
      R(est.frontX - 0.05, est.frontMidZ - w / 2, est.frontX + 0.6, est.frontMidZ + w / 2),
      y,
      y + 0.28,
      'trim',
    );
  for (let i = 0; i < crownProfile.length - 1; i++) {
    const a = crownProfile[i],
      b = crownProfile[i + 1];
    beam(
      face,
      pt(a[0], a[1] + 0.05, 0.06),
      pt(b[0], b[1] + 0.05, 0.06),
      d === 1 ? 0.23 : 0.32,
      'trim',
    );
  }
  if (d >= 2)
    for (const side of [-1, 1]) {
      const N = d >= 3 ? 14 : 8;
      for (let i = 0; i < N; i++) {
        const a = (i * Math.PI * 1.65) / N,
          b = ((i + 1) * Math.PI * 1.65) / N,
          rad = (t) => 0.65 * (1 - 0.55 * t);
        beam(
          face,
          pt(side * (7.1 + Math.cos(a) * rad(i / N)), 14.0 + Math.sin(a) * rad(i / N)),
          pt(side * (7.1 + Math.cos(b) * rad((i + 1) / N)), 14.0 + Math.sin(b) * rad((i + 1) / N)),
          0.13,
          'trim',
        );
      }
    }
  crossTop(face, [est.frontX, est.frontMidZ], 21.6, 22.5, d);
}
function footprintAware(target) {
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const toWorld = (p) => [p[0] * c + p[2] * s, -p[0] * s + p[2] * c];
  const clearance = est.footprintClearance.map(([x, z]) => toWorld([x, 0, z]));
  const clearanceBounds = [0, 1].map((k) => [
    Math.min(...clearance.map((p) => p[k])) - 2,
    Math.max(...clearance.map((p) => p[k])) + 2,
  ]);
  function emit(args) {
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
    const w = p.map(toWorld),
      bounds = [0, 1].map((k) => [
        Math.min(...w.map((p) => p[k])),
        Math.max(...w.map((p) => p[k])),
      ]);
    const lengths = w.map((p, i) => Math.hypot(p[0] - w[(i + 1) % 3][0], p[1] - w[(i + 1) % 3][1]));
    const longest = Math.max(...lengths),
      i = lengths.indexOf(longest);
    // Localize conservative viewer footprint stamps along the retained neighboring-building boundary.
    if (
      longest > 6 &&
      clearanceBounds.every((b, k) => b[0] <= bounds[k][1] && b[1] >= bounds[k][0])
    ) {
      const j = (i + 1) % 3,
        k = (i + 2) % 3,
        mid = p[i].map((v, a) => (v + p[j][a]) / 2),
        uv = args[4],
        uvMid = uv[i].map((v, a) => (v + uv[j][a]) / 2);
      emit([args[0], args[1], [p[i], mid, p[k]], args[3], [uv[i], uvMid, uv[k]], args[5]]);
      emit([args[0], args[1], [mid, p[j], p[k]], args[3], [uvMid, uv[j], uv[k]], args[5]]);
    } else target.addTriangle(...args);
  }
  return {
    addTriangle(...args) {
      emit(args);
    },
  };
}
function build(target, d = 4) {
  const out = footprintAware(target),
    hs = fields(d),
    bells = bellFields(d),
    holes = hs,
    face = writer(out, d),
    cut = writer(
      masked(
        out,
        holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
      ),
      d,
    );
  shell(out, d, main, footing, 11, holes);
  cap(cut, main, 11, 'roof');
  shell(out, d, plans.front, footing, 11.4, holes);
  screen(cut);
  gable(cut, plans.nave, 11, 15.5, 'roof', 0);
  hip(cut, plans.rear, 11, 12.5, 'roof', 0);
  for (const r of [plans.leftAisle, plans.rightAisle]) hip(cut, r, 11, 12.5, 'roof', 0);
  shell(out, d, dome, 10.5, 11.8);
  profile(
    face,
    dome,
    [
      [11.8, 1],
      [13, 0.96],
      [15.0, 0.78],
      [16.45, 0.48],
      [17, 0.15],
    ],
    'roof',
  );
  if (d >= 2) {
    const ls = bells.filter((h) => h.tower === 'lantern');
    shell(out, d, lantern, 17, 20.5, ls, 'wall', scaled(lantern, 0.58));
    for (const h of ls) archBand(face, h, d, 0.11, 'trim', 0.06);
  } else freeStage(face, [lantern[0], lantern[2], lantern[4], lantern[6]], 17, 20.5, d);
  profile(
    face,
    lantern,
    [
      [20.5, 1.1],
      [21.8, 0.03],
    ],
    'roof',
  );
  crossTop(face, est.domeCenter, 21.8, 22.5, d);
  buildTower(out, face, cut, d, 'small', small, 31, smallCrown, bells, hs);
  buildTower(out, face, cut, d, 'large', large, 30.4, largeCrown, bells, hs);
  for (const h of hs) panel(face, h, d);
  facadeDecor(face, d);
  if (d >= 1) {
    for (const [u, w] of [
      [-6.1, 3.3],
      [0, 4.5],
      [6.1, 3.3],
    ]) {
      const end = havanaCathedralGround(est.frontX + 3.8, est.frontMidZ + u) - floor + 0.03;
      const count = Math.max(3, Math.min(10, Math.ceil((0.2 - end) / 0.22) + 1));
      for (let i = 0; i < count; i++) {
        const x = est.frontX + 0.08 + i * 0.38,
          r = R(x, est.frontMidZ + u - w / 2, x + 0.43, est.frontMidZ + u + w / 2);
        solid(face, r, footing, 0.2 + ((end - 0.2) * i) / (count - 1), 'trim');
      }
    }
    if (d >= 2) {
      const p = est.domeCenter;
      for (const n of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const q = [p[0] + n[0] * 6.0, p[1] + n[1] * 6.0],
          a = [-n[1], n[0]],
          point = (u, y, off = 0) => [
            q[0] + a[0] * u + n[0] * off,
            floor + y,
            q[1] + a[1] * u + n[1] * off,
          ];
        cut('wall', [point(-2.1, 11.4), point(2.1, 11.4), point(0, 15.0)], [n[0], 0, n[1]]);
        beam(face, point(-2.1, 11.4, 0.03), point(0, 15.0, 0.03), 0.18, 'trim');
        beam(face, point(0, 15.0, 0.03), point(2.1, 11.4, 0.03), 0.18, 'trim');
      }
    }
  }
}
export const buildHavanaCathedralSkyline = (o) => build(o, 0),
  buildHavanaCathedralDistrict = (o) => build(o, 1),
  buildHavanaCathedralStreet = (o) => build(o, 2),
  buildHavanaCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const havanaCathedralStudy = {
  id: 'N0390',
  key: 'havana_cathedral',
  title: 'Havana Cathedral',
  category: 'cathedral',
  wikidataId: 'Q15043487',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current10-vertex whole,two unequal4-vertex tower controls and19-vertex rear dome roof;all37 vertices/raw tags and11/17m heights retained.No rescale to differently scoped36/34m facts.',
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
    'Four existing cached256-square ashlar,continuous limestone,clay tile and wood graphs.Linear pale stone/tan timber/red roof tints,metric UVs,flat normals,six merged groups.No embedded images,unique facade maps or baked lighting.',
  importReason:
    'Four authored browser levels preserve unequal clock/bell towers,wavy Baroque facade with three portals/two column orders,red roofs and broad rear dome with actual open lantern.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three actually inspected2015/2024 front/plaza and2019 elevated roof pictures plus standard viewer PMTiles/DEM.No bespoke plans/surveys.Fine sculpture/interlace/inscriptions,hidden annex roof/fenestration,full interiors/bells and engineering sections simplified or excluded. Raw17m tower controls do not establish full picture-led31/30.4m crowns;absolute height datum remains uncertain.Entrance steps adapt to retained coarse DEM and do not reproduce surveyed historic plaza grading.Adjacent colonnaded city ranges excluded.Physical phone/laptop timing pending.',
    'Skyline keeps wavy facade,unequal towers with real bell-stage/crown air,rear dome and open lantern. District adds shared textures,recessed doors/floral glazing/blind niches,column orders/cornices and detailed bell apertures. Street adds timber divisions,floral tracery,volutes and selected dome sails. Closeup/master refine nested trim,column facets,wood panels and cornice rhythms.Synthetic regional cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('wavy-baroque-screen-three-portals-and-columns', [57, 15, 3], [26, 10, 0.85]),
    cam('unequal-clock-and-open-bell-towers', [53, 31, 29], [22, 21, 1]),
    cam('blind-niches-floral-glazing-and-cornice', [39, 19, 10], [26.4, 14, 0.85]),
    cam('rear-dome-sails-and-open-lantern', [-37, 29, 24], [-6, 16, 2.7]),
    cam('nave-clay-roofs-and-estimated-rear-annex', [-44, 29, -28], [-4, 11, 0]),
    cam('whole-roof-and-signed-plan', [0, 103, 1], [0, 12, 0]),
  ],
};

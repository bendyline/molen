/** Lausanne Cathedral: tiled cruciform church, southern rose, massive west beffroi and tall slate crossing spire. */
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
  '../../../content/worldgen/source/places/u0/u0k/n0403_lausanne_cathedral/',
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
  wall: '#d4cec0',
  trim: '#e4ddc9',
  roof: '#b17854',
  slate: '#696877',
  door: '#756450',
  metal: '#727b7a',
  glass: '#52677a',
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
const footing = (p) => Math.min(floor - 0.3, lausanneGround(...p) - 0.35);
export function lausanneGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Lausanne Cathedral footing outside retained terrain');
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
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  plans = rec.plans,
  main = rec.main.polygons[0].outline,
  circle = (p, r, n, off = 0) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * Math.PI * 2) / n + off) * r,
      p[1] + Math.sin((i * Math.PI * 2) / n + off) * r,
    ]);
export function lausanneFields(d = 3) {
  const fields = [
    {
      ...hole('west-timber-door', [-47.35, 3.7], [0, 1], [-1, 0], 2.7, 0.5, 4.5, 4.5, 'rect', 5),
      kind: 'door',
    },
    hole(
      'west-pointed-portal-light',
      [-47.35, 3.7],
      [0, 1],
      [-1, 0],
      5.3,
      5.8,
      11,
      7.9,
      'pointed',
      5,
    ),
    hole('south-transept-rose', [25.1, 20.4], [1, 0], [0, 1], 8.7, 10.8, 8.7, 8.7, 'circle', 4),
    {
      ...hole('south-painted-porch', [1.45, 19.4], [1, 0], [0, 1], 4.6, 1, 9.3, 6.6, 'pointed', 4),
      kind: 'door',
    },
  ];
  if (d >= 1) {
    for (const side of [-1, 1])
      for (const x of d === 1 ? [-19, -5, 9] : [-25, -17, -9, -1, 7, 15])
        fields.push(
          hole(
            `nave-clerestory-${side}-${x}`,
            [x, side < 0 ? -3.8 : 7.8],
            [1, 0],
            [0, side],
            1.75,
            17.3,
            4.8,
            3.5,
            'pointed',
            2.4,
          ),
        );
    for (const x of [20, 25.1, 30.2])
      fields.push(
        hole(
          `south-rose-lower-light-${x}`,
          [x, 20.4],
          [1, 0],
          [0, 1],
          2.2,
          3.4,
          5.8,
          4.7,
          'round',
          3,
        ),
      );
    fields.push(
      hole('north-transept-light', [25.1, -16.7], [1, 0], [0, -1], 5.6, 7.7, 13, 9.6, 'pointed', 3),
    );
    const choir = plans.choir;
    for (let i = 1; i < choir.length - 1; i++) {
      const f = faceFrame(choir, i);
      fields.push(
        hole(
          `choir-light-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          1.5,
          17.2,
          4,
          3,
          'pointed',
          2,
        ),
      );
    }
  }
  if (d >= 2) {
    for (let i = 19; i < 27; i++) {
      const f = faceFrame(main, i);
      if (f.length < 4) continue;
      fields.push(
        hole(
          `ambulatory-light-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          2.2,
          3.2,
          6.4,
          5,
          'round',
          3,
        ),
      );
    }
    for (const side of [-1, 1])
      for (const x of side < 0 ? [-16, -8, 0, 8] : [-16, -8, 8])
        fields.push(
          hole(
            `aisle-light-${side}-${x}`,
            [x, side < 0 ? (x < -15.4 ? -14 : x <= 1.8 ? -15.5 : -11) : 14],
            [1, 0],
            [0, side],
            1.8,
            5,
            6.2,
            4.6,
            'pointed',
            2.5,
          ),
        );
    for (const side of [-1, 1]) {
      const r = plans.eastTowers[side < 0 ? 0 : 1],
        f = edge(r, [1, 0]);
      fields.push(
        hole(
          `east-tower-light-${side}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          1.4,
          14,
          5.8,
          4.7,
          'round',
          2,
        ),
      );
    }
  }
  return fields;
}
export function lausanneCrossingFields(d = 3) {
  if (d === 0) return [];
  return plans.crossing.flatMap((_, i) => {
    const f = faceFrame(plans.crossing, i);
    return [0.3, 0.7].map((t) =>
      hole(
        `crossing-light-${i}-${t}`,
        lerp(f.a, f.b, t),
        f.axis,
        f.normal,
        2.1,
        31.2,
        7.4,
        5.6,
        'pointed',
        2.5,
      ),
    );
  });
}
export function lausanneBellFields(d = 3) {
  if (d === 0) return [];
  return plans.bell.flatMap((_, i) => {
    const f = faceFrame(plans.bell, i),
      count = d === 1 ? 1 : f.length > 12 ? 3 : 2;
    return [29, 39.5].flatMap((b) =>
      Array.from({ length: count }, (_, j) =>
        hole(
          `bell-arch-${i}-${b}-${j}`,
          lerp(f.a, f.b, (j + 1) / (count + 1)),
          f.axis,
          f.normal,
          d === 1 ? 3.2 : 2.2,
          b,
          6.8,
          5.4,
          'round',
          7,
        ),
      ),
    );
  });
}
function panel(face, h, d) {
  pane(face, h, d, -0.32, h.kind === 'door' ? 'door' : 'glass');
  if (d >= 1) archBand(face, h, d, h.kind === 'door' ? 0.3 : 0.18, 'trim', 0.08);
  if (d >= 2 && !h.kind && h.shape === 'pointed') {
    const q = prepareOpening(h, 0, d),
      off = 0.06 * Math.sign(-q.axis[1] * h.normal[0] + q.axis[0] * h.normal[1]);
    beam(face, q.point(0, h.bottom, off), q.point(0, h.bottom + h.height - 0.5, off), 0.09, 'trim');
  }
}
function column(face, p, b, t, r, d, slot = 'trim') {
  solid(face, circle(p, r, d <= 1 ? 4 : 6, Math.PI / 4), b, t, slot);
}
function finial(face, p, b, h, d) {
  if (d === 0) return;
  profile(
    face,
    circle(p, 0.35, d === 1 ? 4 : 6),
    [
      [b, 1.3],
      [b + h * 0.3, 0.9],
      [b + h, 0.03],
    ],
    'trim',
  );
}
function annularRoof(face, outer, inner, b, t) {
  const pts = [...outer, ...inner],
    ids = earcut(pts.flat(), [outer.length], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      'roof',
      ids.slice(i, i + 3).map((k) => at(pts[k], k < outer.length ? b : t)),
      [0, 1, 0],
    );
}
function church(out, face, d) {
  const fields = lausanneFields(d),
    mask = writer(
      masked(
        out,
        fields.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    low = d <= 1 ? coarse(main) : main;
  solid(mask, low, footing, 0.08, 'wall');
  shell(out, d, low, footing, 13.2, fields, 'wall');
  cap(mask, low, 13.2, 'roof');
  gable(mask, R(-15.4, -15.4, 1.8, -11), 13.2, 16.2, 'roof', 0);
  for (const [role, eave, top, axis] of [
    ['nave', 23.5, 30.1, 0],
    ['transept', 23.5, 30.1, 1],
    ['narthex', 22.5, 25, 0],
    ['northAisle', 13.2, 16.5, 0],
    ['southAisle', 13.2, 16.5, 0],
    ['westNorthRange', 19, 24, 0],
  ]) {
    const r = plans[role];
    shell(out, d, r, footing, eave, fields, 'wall');
    gable(mask, r, eave, top, 'roof', axis);
    if (d >= 1) band(face, r, eave - 0.25, 0.3, 'trim', 1.015);
  }
  shell(out, d, plans.choir, footing, 22, fields, 'wall');
  hip(mask, plans.choir, 22, 28.4, 'roof', 0);
  const outer = [[31, 14.2], ...main.slice(19, 28), [31, -10.9]];
  annularRoof(mask, outer, scaled(plans.choir, 0.98), 13.2, 16.2);
  for (const r of plans.eastTowers) {
    shell(out, d, r, footing, 22.5, fields, 'wall');
    profile(
      face,
      scaled(r, 1.05),
      [
        [22.5, 1],
        [31.5, 0.03],
      ],
      'roof',
    );
    if (d >= 1) band(face, r, 21.9, 0.5, 'trim', 1.04);
  }
  const porch = plans.paintedPorch;
  shell(out, d, porch, footing, 13.2, fields, 'wall');
  profile(
    mask,
    scaled(porch, 1.04),
    [
      [13.2, 1],
      [23, 0.02],
    ],
    'roof',
  );
  if (d >= 1) {
    const h = fields.find((h) => h.name === 'south-painted-porch');
    archBand(face, { ...h, width: 6.3, height: 11.5, spring: 7.6 }, d, 0.3, 'trim', 0.13);
  }
  for (const h of fields) panel(face, h, d);
  if (d >= 1) {
    for (const side of [-1, 1])
      for (const x of d === 1 ? [-20, -4, 12] : [-20, -12, -4, 4, 12]) {
        const z = side < 0 ? -10.8 : 13.8,
          hi = side < 0 ? -3.7 : 7.7,
          q = [x, z];
        solid(face, R(x - 0.38, z - 0.55, x + 0.38, z + 0.55), footing, 15.8, 'wall');
        const n = d === 1 ? 3 : 6;
        for (let i = 0; i < n; i++) {
          const a = i / n,
            b = (i + 1) / n,
            point = (t) => [x, z + (hi - z) * t],
            y = (t) => 14 + 6.4 * Math.sqrt(t);
          beam(face, at(point(a), y(a)), at(point(b), y(b)), 0.7, 'trim');
        }
        finial(face, q, 15.8, 1.4, d);
      }
    const h = hole(
      'west-grand-portal-band',
      [-47.4, 3.7],
      [0, 1],
      [-1, 0],
      7.8,
      0.5,
      18.2,
      13.4,
      'pointed',
      1,
    );
    archBand(face, h, d, 0.45, 'trim', 0.08);
    if (d >= 2) archBand(face, { ...h, width: 7.0, height: 17.6 }, d, 0.15, 'trim', 0.1);
    band(face, plans.westFacade, 20.7, 0.5, 'trim', 1.05);
    for (const z of [-1.5, 9.15]) column(face, [-47.55, z], 0.5, 22.3, 0.22, d);
    if (d >= 2)
      for (const z of [-0.7, 1.5, 3.7, 5.9, 8.1]) {
        const p = [-47.62, z];
        profile(
          face,
          circle(p, 0.22, 4),
          [
            [18.7, 1.1],
            [19.6, 0.65],
            [20.1, 0.25],
          ],
          'trim',
        );
      }
  }
  // Rose tracery is a sparse geometry abstraction over one recessed glass disk.
  if (d >= 1) {
    const h = fields.find((h) => h.name === 'south-transept-rose'),
      cy = h.bottom + h.height / 2,
      z = 20.46,
      rad = 3.95,
      n = d === 1 ? 6 : 12;
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n;
      beam(
        face,
        [25.1, cy, z],
        [25.1 + Math.cos(a) * rad, cy + Math.sin(a) * rad, z],
        d === 1 ? 0.1 : 0.12,
        'trim',
      );
    }
    if (d >= 2) {
      const r = 1.9;
      for (let i = 0; i < 16; i++) {
        const a = (i * Math.PI) / 8,
          b = ((i + 1) * Math.PI) / 8;
        beam(
          face,
          [25.1 + Math.cos(a) * r, cy + Math.sin(a) * r, z],
          [25.1 + Math.cos(b) * r, cy + Math.sin(b) * r, z],
          0.12,
          'trim',
        );
      }
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        archBand(
          face,
          hole(
            `rose-petal-${i}`,
            [25.1 + Math.cos(a) * 2.75, 20.4],
            [1, 0],
            [0, 1],
            1.2,
            cy + Math.sin(a) * 2.75 - 0.6 - floor,
            1.2,
            1.2,
            'circle',
            1,
          ),
          1,
          0.1,
          'trim',
          0.06,
        );
      }
    }
  }
}
function crossing(out, face, d) {
  const r = plans.crossing,
    holes = lausanneCrossingFields(d);
  shell(out, d, r, 23.5, 40.5, holes, 'wall');
  cap(face, r, 40.5, 'trim');
  for (const h of holes) panel(face, h, d);
  if (d >= 1) band(face, r, 39.9, 0.6, 'trim', 1.035);
  const o = plans.crossingCenter,
    oct = circle(o, plans.crossingRadius, 8, Math.PI / 8);
  profile(
    face,
    oct,
    [
      [40.5, 1],
      [41.4, 1],
    ],
    'trim',
  );
  for (let i = 0; i < 8; i++) {
    const a = oct[i],
      b = oct[(i + 1) % 8],
      m = lerp(a, b, 0.5);
    column(face, a, 41.4, 45, d === 0 ? 0.16 : 0.22, d);
    if (d >= 1) {
      const left = lerp(a, m, 0.12),
        right = lerp(b, m, 0.12);
      beam(face, at(left, 44), at(m, 48), 0.4, 'trim');
      beam(face, at(m, 48), at(right, 44), 0.4, 'trim');
      finial(face, a, 45, 2, d);
      if (d >= 2) {
        const f = faceFrame(oct, i);
        archBand(
          face,
          hole(`crown-arch-${i}`, m, f.axis, f.normal, 3.4, 41.4, 3.7, 2.3, 'pointed', 1),
          d,
          0.28,
          'trim',
          0.02,
        );
      }
    }
  }
  cap(face, oct, 44.8, 'slate');
  profile(
    face,
    scaled(oct, 0.91),
    [
      [44.8, 1],
      [78.3, 0.025],
    ],
    'slate',
  );
  if (d >= 1) {
    const rr = scaled(oct, 0.91);
    for (const a of rr)
      beam(
        face,
        at(a, 44.8),
        at([o[0] + (a[0] - o[0]) * 0.025, o[1] + (a[1] - o[1]) * 0.025], 78.3),
        0.16,
        'trim',
      );
  }
  beam(face, at(o, 78.3), at(o, 79.6), 0.12, 'metal');
}
function bell(out, face, d) {
  const r = plans.bell,
    holes = lausanneBellFields(d);
  solid(face, r, footing, 26.5, 'wall');
  shell(out, d, r, 26.5, 47.5, holes, 'wall', scaled(r, 0.72));
  cap(face, r, 26.5, 'trim');
  cap(face, r, 37.5, 'trim');
  cap(face, r, 47.5, 'trim');
  if (d >= 1) {
    for (const h of holes) archBand(face, h, d, 0.25, 'trim', 0.08);
    for (const y of [26.1, 37.1, 47.1]) {
      band(face, r, y, 0.4, 'trim', 1.035);
      cap(face, scaled(r, 1.035), y + 0.4, 'trim');
    }
    for (const q of r) {
      for (const [b, t, w] of [
        [0, 12, 1.1],
        [12, 20, 0.85],
        [20, 26.5, 0.6],
      ])
        solid(face, R(q[0] - w, q[1] - w, q[0] + w, q[1] + w), b === 0 ? footing : b, t, 'wall');
      column(face, q, 26.5, 47.5, 0.3, d);
      finial(face, q, 47.5, 7, d);
    }
  }
  profile(
    face,
    scaled(r, 0.88),
    [
      [47.5, 1],
      [62.5, 0.04],
    ],
    'roof',
  );
  const o = center(r);
  column(face, o, 62.5, 63.3, 0.22, d, 'metal');
  profile(
    face,
    circle(o, 0.45, d === 0 ? 4 : 8),
    [
      [63.3, 0.2],
      [63.65, 1],
      [64, 0.2],
    ],
    'metal',
  );
  beam(face, at(o, 64), at(o, 65.5), 0.13, 'metal');
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-7
        )
          return;
        target.addTriangle(a[0], a[1], p, a[3], a[4], a[5]);
      },
    },
    face = writer(out, d);
  church(out, face, d);
  crossing(out, face, d);
  bell(out, face, d);
}
export const buildLausanneSkyline = (o) => build(o, 0),
  buildLausanneDistrict = (o) => build(o, 1),
  buildLausanneStreet = (o) => build(o, 2),
  buildLausanneCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const lausanneCathedralStudy = {
  id: 'N0403',
  key: 'lausanne_cathedral',
  title: 'Lausanne Cathedral',
  category: 'cathedral',
  wikidataId: 'Q669544',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared 256-square continuous limestone, sandstone, ceramic tile, slate, plain wood and painted metal graphs serve seven groups including local blue-grey glass. Linear tints, metric UVs, flat architectural normals; no embedded images, unique facade photographs, baked lighting or micro-carving.',
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
    'Individual medium-fi exterior from five inspected photographs and standard viewer PMTiles/DEM. The unqualified retained 79.6 m height controls the overall tip scale; other heights and all detailed component plans are estimates. Fine rose/portal tracery, sculpture, inscriptions, interiors/bells, concealed roofs, current finish, engineering and exact terrace/step/base contact simplified, excluded or unverified. North-west lower range roof is a plan-constrained estimate because reference pictures crop it. Synthetic Swiss chalet neighbors are style fixtures. Physical phone/laptop timing pending.',
    'Skyline retains the long cruciform church, rounded choir, south rose marker/porch, massive west beffroi/red cap and high slate crossing spire/open crown. District adds shared surfaces, clerestory/choir recesses, coarse rose spokes, west portal bands, flying buttresses and two open bell stages. Street adds aisle/tower lights, more arches, mullions, finer rose ring, pinnacle and portal figure abstractions; close-up/master retain the same individual exterior detail.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-montfalcon-portal-and-beffroi', [-91, 29, 39], [-38, 22, 6]),
    cam('south-rose-and-painted-porch', [36, 26, 69], [17, 15, 18]),
    cam('crossing-spire-and-gabled-crown', [62, 67, 42], [25.55, 50, 2]),
    cam('western-two-stage-bell-arcades', [-66, 49, 49], [-37.9, 40, 14]),
    cam('eastern-rounded-choir-and-roof-towers', [91, 33, -12], [35, 16, 2]),
    cam('roof-and-signed-plan', [0, 205, 0.1], [0, 24, 0]),
  ],
};

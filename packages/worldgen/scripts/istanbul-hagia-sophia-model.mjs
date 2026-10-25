/** Istanbul Hagia Sophia: shallow central dome, cascades, giant tympana, buttresses and four minarets. */
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
  '../../../content/worldgen/source/places/sx/sxk/hagia_sophia_istanbul/',
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
  wall: '#d3b4a2',
  brick: '#c49b80',
  trim: '#d9d3c0',
  metal: '#a1afb6',
  door: '#626052',
  glass: '#526572',
  gold: '#c7ad62',
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
const footing = (p) => Math.min(floor - 0.3, istanbulSophiaGround(...p) - 0.35);
export function istanbulSophiaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Istanbul Hagia Sophia footing outside retained terrain');
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
function profile(face, ring, levels, slot, capFinal = true) {
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
  if (capFinal) cap(face, prev, levels.at(-1)[0], slot);
}
const R = (x, z, a, b) => [
    [x, z],
    [a, z],
    [a, b],
    [x, b],
  ],
  N = (d) => [6, 8, 24, 40, 40][d],
  ring = (p, r, n, phase = 0) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + r * Math.cos((i * Math.PI * 2) / n + phase),
      p[1] + r * Math.sin((i * Math.PI * 2) / n + phase),
    ]),
  faces = (r) => r.map((_, i) => ({ ...faceFrame(r, i), i }));
function sideAt(r, x, s) {
  const f = faces(r)
    .filter(
      (f) =>
        f.normal[1] * s > 0.8 &&
        x > Math.min(f.a[0], f.b[0]) + 0.1 &&
        x < Math.max(f.a[0], f.b[0]) - 0.1,
    )
    .sort((a, b) => b.length - a.length)[0];
  return f ? { f, p: lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0])) } : null;
}
function dome(face, p, r, b, t, d, small = false) {
  const n = N(d),
    steps = d === 0 ? (small ? 1 : 2) : d === 1 ? 3 : d === 2 ? 5 : 8;
  profile(
    face,
    ring(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => [
      b + (t - b) * Math.sin(((i / steps) * Math.PI) / 2),
      d === 0 && i === steps ? 0 : Math.max(0.005, Math.cos(((i / steps) * Math.PI) / 2)),
    ]),
    'metal',
  );
}
function finial(face, p, y, d) {
  const w = d === 0 ? 0.24 : 0.14;
  beam(face, at(p, y - 0.2), at(p, y + 2), w, 'gold');
  if (d >= 2)
    profile(
      face,
      ring(p, 0.3, 6),
      [
        [y, 1],
        [y + 0.45, 1.2],
        [y + 0.85, 0.25],
      ],
      'gold',
    );
}
export function istanbulBodyFields(d) {
  if (!d) return [];
  const hs = [];
  for (const side of [-1, 1])
    for (const x of d === 1 ? [-26, 27] : side > 0 ? [-27, -22, 9, 27] : [-26, -22, -2, 28, 34]) {
      const p = sideAt(rec.plans.body, x, side);
      if (!p) continue;
      const w = x === -2 ? 1.1 : 2.3;
      hs.push(
        hole(
          `body-upper-${side}-${x}`,
          p.p,
          p.f.axis,
          p.f.normal,
          w,
          17,
          4.3,
          4.3 - w / 2,
          'round',
          3,
        ),
      );
      if (d >= 2)
        hs.push(
          hole(
            `body-lower-${side}-${x}`,
            p.p,
            p.f.axis,
            p.f.normal,
            w,
            9.6,
            4.4,
            4.4 - w / 2,
            'round',
            3,
          ),
        );
    }
  return hs;
}
export function istanbulNarthexFields(d) {
  if (!d) return [];
  const r = rec.plans.narthex,
    f = edge(r, [-1, 0]),
    er = rec.plans.exonarthex,
    ef = edge(er, [-1, 0]),
    hs = [];
  for (const t of d === 1 ? [0.25, 0.65] : [0.12, 0.27, 0.42, 0.57, 0.72, 0.87]) {
    const p = lerp(f.a, f.b, t);
    hs.push(hole(`narthex-upper-${t}`, p, f.axis, f.normal, 2.8, 14.2, 6, 4.6, 'round', 3));
  }
  if (d >= 2)
    for (const t of [0.2, 0.4, 0.6, 0.8])
      hs.push(
        hole(
          `entry-door-${t}`,
          lerp(ef.a, ef.b, t),
          ef.axis,
          ef.normal,
          2.1,
          0.4,
          4.8,
          3.75,
          'round',
          4,
        ),
      );
  return hs;
}
export function istanbulDrumFields(d) {
  if (!d) return [];
  const p = rec.plans.dome.center,
    r = rec.plans.dome.radius,
    n = N(d),
    rr = ring(p, r, n);
  return faces(rr)
    .filter((f) => d >= 2 || f.i % 2 === 0)
    .map((f) =>
      hole(
        `dome-drum-${f.i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        d === 1 ? 1.8 : 1.2,
        41.3,
        4.1,
        3.5,
        'round',
        3,
      ),
    );
}
export function istanbulSideArches(d) {
  if (!d) return [];
  return [-1, 1].map((side) => {
    const f = edge(rec.plans.cross, [0, side]);
    return hole(
      `giant-arch-${side}`,
      lerp(f.a, f.b, 0.5),
      f.axis,
      f.normal,
      29,
      25,
      14.5,
      0,
      'round',
      6,
    );
  });
}
export function istanbulTympanumFields(d) {
  if (!d) return [];
  const hs = [];
  for (const h of istanbulSideArches(d)) {
    const p = h.center.map((v, k) => v - h.normal[k] * 1.5);
    for (const [row, ys, us] of d === 1
      ? [[0, 27.1, [-7, 0, 7]]]
      : [
          [0, 26.6, [-10, -5, 0, 5, 10]],
          [1, 32.4, [-5, 0, 5]],
        ])
      for (const u of us)
        hs.push(
          hole(
            `tympanum-${h.name}-${row}-${u}`,
            p.map((v, k) => v + h.axis[k] * u),
            h.axis,
            h.normal,
            1.7,
            ys,
            3.8,
            2.95,
            'round',
            2,
          ),
        );
  }
  return hs;
}
export function istanbulWestField(d) {
  if (!d) return [];
  return [
    hole('west-upper-arch', [-34.9, -8.7], [0, 1], [-1, 0], 18.4, 23.7, 9.8, 0.6, 'round', 4),
  ];
}
export function istanbulApseFields(d) {
  if (!d) return [];
  const r = rec.plans.apse.outline;
  return faces(r)
    .filter((f) => f.normal[0] > 0.6)
    .map((f) =>
      hole(`apse-${f.i}`, lerp(f.a, f.b, 0.5), f.axis, f.normal, 1.4, 16.2, 5.2, 4.5, 'round', 3),
    );
}
function finish(face, hs, d, slot = 'glass') {
  for (const h of hs) {
    pane(face, h, d, -0.32, h.name.includes('door') ? 'door' : slot);
    archBand(face, h, d, h.name.includes('west-upper') ? 0.35 : 0.15, 'trim');
    if (d >= 2 && h.name.includes('west-upper')) {
      const p = prepareOpening(h, 0, d),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      for (const u of [-6, -3, 0, 3, 6]) {
        const y =
          h.bottom +
          h.spring +
          (h.width / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(u / (h.width / 2), 2)));
        beam(face, p.point(u, h.bottom, -0.24 * sg), p.point(u, y - 0.1, -0.24 * sg), 0.12, 'trim');
      }
      for (const y of [h.bottom + 2, h.bottom + 4.2, h.bottom + 6.4]) {
        const yy = (y - h.bottom - h.spring) / (h.width / 2),
          w = (h.width / 2) * Math.sqrt(Math.max(0, 1 - Math.pow(yy, 2)));
        beam(face, p.point(-w, y, -0.24 * sg), p.point(w, y, -0.24 * sg), 0.1, 'trim');
      }
    }
  }
}
function screen(out, face, d) {
  const h = istanbulWestField(1)[0],
    outer = { ...h, width: 22, height: 11.8, bottom: floor + 23, spring: 0.8 },
    p = prepareOpening(outer, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    shape = openingShape(outer, d),
    maskedFace = writer(masked(out, d ? [prepareOpening(h, 0, d)] : []), d);
  for (const off of [0, -1])
    maskedFace(
      'brick',
      shape.map((q) => p.point(...q, off * sg)),
      [h.normal[0], 0, h.normal[1]],
    );
  for (let i = 0; i < shape.length; i++) {
    const j = (i + 1) % shape.length;
    face('metal', [
      p.point(...shape[i], 0),
      p.point(...shape[j], 0),
      p.point(...shape[j], -sg),
      p.point(...shape[i], -sg),
    ]);
  }
  if (d) finish(face, [h], d);
}
function tympana(out, face, d) {
  const hs = istanbulSideArches(d),
    windows = istanbulTympanumFields(d);
  for (const h of hs) {
    const p = h.center.map((v, k) => v - h.normal[k] * 1.5),
      a = h.axis,
      n = h.normal,
      w = 15,
      rr = [
        p.map((v, k) => v - a[k] * w),
        p.map((v, k) => v + a[k] * w),
        p.map((v, k) => v + a[k] * w - n[k] * 0.6),
        p.map((v, k) => v - a[k] * w - n[k] * 0.6),
      ];
    shell(out, d, rr, 25, 39.6, windows, 'brick');
    cap(face, rr, 39.6, 'brick');
    archBand(face, h, d, 0.65, 'wall');
  }
  finish(face, windows, d);
}
function church(out, face, d) {
  const P = rec.plans,
    main = rec.main.polygons[0].outline,
    bh = istanbulBodyFields(d),
    nh = istanbulNarthexFields(d);
  shell(out, d, d === 0 ? coarse(main) : main, footing, 8, nh, 'brick');
  cap(face, main, 8, 'metal');
  shell(out, d, P.body, footing, 25, bh, 'brick');
  cap(face, P.body, 25, 'metal');
  finish(face, bh, d);
  shell(out, d, P.narthex, footing, 22.5, nh, 'brick');
  hip(face, P.narthex, 22.5, 25, 'metal', 1);
  shell(out, d, P.exonarthex, footing, 9, nh, 'brick');
  cap(face, P.exonarthex, 9, 'metal');
  finish(face, nh, d);
  const arches = istanbulSideArches(d);
  shell(out, d, P.cross, 24.8, 40, arches, 'wall');
  cap(face, P.cross, 40, 'metal');
  tympana(out, face, d);
  for (const r of P.piers) {
    shell(out, d, r, 24.5, 36, [], 'wall');
    cap(face, r, 36, 'metal');
    if (d >= 1) {
      const f1 = edge(r, [0, -1]),
        f2 = edge(r, [0, 1]);
      for (const f of [f1, f2]) {
        const p = lerp(f.a, f.b, 0.5),
          rr = R(p[0] - 2.1, p[1] - 0.8, p[0] + 2.1, p[1] + 0.8);
        solid(face, rr, 35.8, 41.3, 'wall');
        if (d >= 2) {
          const h = hole('pier-disc', p, f.axis, f.normal, 2.8, 38.2, 2.8, 2.8, 'circle', 2);
          pane(face, h, d, 0.85, 'trim');
        }
      }
    }
  }
  screen(out, face, d);
  for (const t of P.westTurrets) {
    const r = d === 0 ? ring(t.center, 1.65, 6) : t.outline;
    solid(face, r, 28, 32.8, 'brick');
    dome(face, t.center, 1.85, 32.8, 34, d, true);
  }
  for (const r of P.westRibs) {
    solid(face, d === 0 ? coarse(r) : r, footing, 12, 'brick');
    cap(face, r, 12, 'metal');
  }
  for (const [i, b] of P.buttresses.entries()) {
    const r = b.outline;
    if (b.id === 35185148175468) {
      solid(face, r, footing, 9, 'brick');
      dome(face, center(r), 7.4, 9, 15, d, true);
      continue;
    }
    const y = [19, 15, 23, 17, 19, 25, 21, 28, 20, 26, 27][i];
    solid(face, r, footing, y, 'wall');
    const top = scaled(r, 0.87);
    solid(face, top, y, y + 0.55, 'metal');
  }
  const ah = istanbulApseFields(d);
  shell(out, d, P.apse.outline, footing, 25, ah, 'brick');
  dome(face, P.apse.center, P.apse.radius, 25, 31, d, true);
  finish(face, ah, d);
  for (const e of P.exedrae) {
    const rr = d === 0 ? ring(e.center, e.radius, 6) : ring(e.center, e.radius, N(d));
    solid(face, rr, 23, 26, 'brick');
    dome(face, e.center, e.radius, 26, 30, d, true);
  }
  for (const s of P.semidomes) {
    const rr = ring(s.center, s.radius, d === 0 ? 8 : N(d));
    solid(face, rr, 23, 25, 'brick');
    dome(face, s.center, s.radius, 25, 39, d);
  }
  const dh = istanbulDrumFields(d),
    dr = ring(P.dome.center, P.dome.radius, d === 0 ? 8 : N(d));
  shell(out, d, dr, 40, 46, dh, 'metal');
  dome(face, P.dome.center, P.dome.radius, 46, 56, d);
  finial(face, P.dome.center, 56, d);
  finish(face, dh, d);
  if (d >= 1) {
    band(face, P.body, 24.6, 0.3, 'trim', 1.004);
    band(face, P.cross, 39.6, 0.3, 'trim', 1.008);
    band(face, dr, 45.7, 0.25, 'metal', 1.025);
  }
  if (d >= 2) {
    const cnt = d === 2 ? 12 : 20,
      p = P.dome.center;
    for (let i = 0; i < cnt; i++) {
      const a = (i * Math.PI * 2) / cnt,
        r = P.dome.radius,
        n = [Math.cos(a), Math.sin(a)];
      for (let j = 0; j < 4; j++) {
        const u = ((j / 4) * Math.PI) / 2,
          v = (((j + 1) / 4) * Math.PI) / 2;
        beam(
          face,
          [
            p[0] + r * Math.cos(u) * n[0],
            floor + 46 + 10 * Math.sin(u),
            p[1] + r * Math.cos(u) * n[1],
          ],
          [
            p[0] + r * Math.cos(v) * n[0],
            floor + 46 + 10 * Math.sin(v),
            p[1] + r * Math.cos(v) * n[1],
          ],
          0.1,
          'metal',
        );
      }
    }
  }
}
function minarets(_out, face, d) {
  for (const m of rec.plans.minarets) {
    const p = m.center,
      red = m.kind === 'east-red-brick',
      west = m.kind.startsWith('west'),
      slot = red ? 'brick' : 'trim',
      r = m.radius,
      n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 16 : 24;
    if (d === 0) {
      // One tapered plinth and six-sided profile retain each shaft, balcony and pointed crown.
      sides(face, m.base, footing, 0, slot);
      profile(
        face,
        m.base,
        [
          [0, 1],
          [18, 0.55],
        ],
        slot,
      );
      const shape = ring(p, r, 6);
      sides(face, shape, 16, 49.8, slot);
      profile(
        face,
        shape,
        [
          [49.8, 1],
          [51.3, 1.6],
          [59, 0.95],
        ],
        'trim',
        false,
      );
      profile(
        face,
        ring(p, r * 1.02, 6),
        [
          [59, 1],
          [72, 0],
        ],
        'metal',
      );
      continue;
    }
    const base = m.base;
    solid(face, base, footing, 8, slot);
    profile(
      face,
      base,
      [
        [8, 1],
        [west ? 20 : 18, 0.55],
      ],
      slot,
    );
    solid(face, ring(p, r, n), west ? 18 : 16, 50, slot);
    profile(
      face,
      ring(p, r, n),
      d === 0
        ? [
            [49.8, 1],
            [50.6, 1.6],
            [52, 1.55],
          ]
        : [
            [49.5, 1],
            [50.1, 1.15],
            [50.6, 1.6],
            [51.7, 1.65],
            [52, 1.55],
          ],
      'trim',
    );
    solid(face, ring(p, r * 0.95, n), 52, 59, slot);
    profile(
      face,
      ring(p, r * 1.02, n),
      [
        [59, 1],
        [70.5, 0.02],
      ],
      'metal',
    );
    beam(face, at(p, 70.3), at(p, 72), d === 0 ? 0.22 : 0.13, 'gold');
    if (d >= 1) {
      band(face, ring(p, r * 0.95, n), 58.4, 0.2, 'trim', 1.06);
      if (west) band(face, ring(p, r, n), 19, 0.35, 'trim', 1.045);
    }
    if (d >= 2) {
      const inner = ring(p, r * 1.25, n),
        outer = ring(p, r * 1.62, n);
      sides(face, outer, 51.8, 52.8, 'trim');
      sides(face, inner, 51.8, 52.8, 'trim', true);
      cap(face, outer, 52.8, 'trim', [inner]);
      if (west) {
        const flutes = d === 2 ? 8 : 12;
        for (let i = 0; i < flutes; i++) {
          const a = (i * Math.PI * 2) / flutes,
            q = [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
          beam(face, at(q, 20.5), at(q, 49.5), 0.11, 'trim');
        }
      }
      const h = hole(
        'minaret-door',
        p.map((v, k) => v + (k === 1 ? r : 0)),
        [1, 0],
        [0, 1],
        0.8,
        53,
        2.2,
        1.8,
        'round',
        2,
      );
      pane(face, h, d, 0.03, 'door');
      archBand(face, h, d, 0.1, 'trim', 0.05);
    }
  }
}
function skylineChurch(_out, face) {
  const P = rec.plans,
    main = coarse(rec.main.polygons[0].outline);
  solid(face, main, footing, 8, 'brick');
  sides(face, P.body, footing, 25, 'brick');
  cap(face, P.body, 25, 'metal');
  sides(face, P.narthex, footing, 24, 'brick');
  cap(face, P.narthex, 24, 'metal');
  sides(face, P.exonarthex, footing, 9, 'brick');
  cap(face, P.exonarthex, 9, 'metal');
  solid(face, P.cross, 24.5, 40, 'wall');
  for (const r of P.piers) solid(face, r, 24.5, 36, 'wall');
  for (const [i, r] of P.westRibs.entries()) if (i >= 4) solid(face, r, footing, 12, 'brick');
  for (const [i, b] of P.buttresses.entries()) {
    solid(face, b.outline, footing, [19, 9, 23, 17, 19, 25, 21, 28, 20, 26, 27][i], 'wall');
    if (b.id === 35185148175468) dome(face, center(b.outline), 7.4, 9, 15, 0, true);
  }
  solid(face, P.apse.outline, footing, 25, 'brick');
  dome(face, P.apse.center, P.apse.radius, 25, 31, 0, true);
  for (const e of P.exedrae) dome(face, e.center, e.radius, 25, 30, 0, true);
  for (const s of P.semidomes) dome(face, s.center, s.radius, 25, 39, 0);
  sides(face, ring(P.dome.center, P.dome.radius, 6), 40, 46, 'metal');
  dome(face, P.dome.center, P.dome.radius, 46, 56, 0);
}
function build(target, d) {
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading),
    rotate = (p) => [p[0] * c + p[1] * s, -p[0] * s + p[1] * c],
    envelope = rec.main.polygons[0].outline.map(rotate),
    excluded = fit.excludedBuildings.map((b) => {
      const pts = b.polygons.flatMap((p) => p.outline.map(rotate));
      return [0, 1].map((k) => [
        Math.min(...pts.map((p) => p[k])),
        Math.max(...pts.map((p) => p[k])),
      ]);
    });
  function outsideDistance(p) {
    let inside = false,
      distance = Infinity;
    for (let i = 0, j = envelope.length - 1; i < envelope.length; j = i++) {
      const a = envelope[j],
        b = envelope[i];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        inside = !inside;
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz)),
        );
      distance = Math.min(distance, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz));
    }
    return inside ? 0 : distance;
  }
  function nearHost(p) {
    const points = p.map((p) => rotate([p[0], p[2]])),
      box = [0, 1].map((k) => [
        Math.min(...points.map((p) => p[k])),
        Math.max(...points.map((p) => p[k])),
      ]);
    return (
      excluded.some((b) => b.every((v, k) => v[0] <= box[k][1] && v[1] >= box[k][0])) ||
      [
        [box[0][0], box[1][0]],
        [box[0][0], box[1][1]],
        [box[0][1], box[1][0]],
        [box[0][1], box[1][1]],
      ].some((p) => outsideDistance(p) > 6)
    );
  }
  function emit(a, p, uv) {
    let longest = 0,
      k = 0;
    for (let i = 0; i < 3; i++) {
      const l = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
      if (l > longest) {
        longest = l;
        k = i;
      }
    }
    if (longest > (d >= 2 || nearHost(p) ? 20 : d === 0 ? 120 : 70)) {
      const j = (k + 1) % 3,
        c = (k + 2) % 3,
        mid = p[k].map((v, i) => Math.fround((v + p[j][i]) / 2)),
        v = uv[k].map((v, i) => (v + uv[j][i]) / 2);
      emit(a, [p[k], mid, p[c]], [uv[k], v, uv[c]]);
      emit(a, [mid, p[j], p[c]], [v, uv[j], uv[c]]);
      return;
    }
    target.addTriangle(a[0], a[1], p, a[3], uv, a[5]);
  }
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
        emit(a, p, a[4]);
      },
    },
    face = writer(out, d);
  if (d === 0) skylineChurch(out, face);
  else church(out, face, d);
  minarets(out, face, d);
}
export const buildIstanbulSophiaSkyline = (o) => build(o, 0),
  buildIstanbulSophiaDistrict = (o) => build(o, 1),
  buildIstanbulSophiaStreet = (o) => build(o, 2),
  buildIstanbulSophiaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const istanbulHagiaSophiaStudy = {
  id: 'hagia_sophia_istanbul',
  key: 'hagia_sophia',
  title: 'Hagia Sophia — Istanbul',
  category: 'mosque',
  wikidataId: 'Q12506',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256² lime plaster,brick,raw limestone,painted metal and plain wood graphs;local blue-grey glazing/muted gold;seven groups. Shared metal abstracts lead roofs/cones. Linear tints,metric UVs,flat normals;no embedded images,unique facade photographs,bespoke textures or baked lighting.',
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
    'Individual medium-fi exterior from four inspected matching pictures and standard viewer PMTiles/DEM. Exact current whole/parts retained;nominal height tags and unsourced Wikidata dimension hints do not establish surveyed heights. Dome curvature,window/pier/tympanum/narthex/buttress/apse/exedra/minaret/balcony/fluting/finial profiles are estimates or abstractions. Faithful Byzantine/Ottoman carving,masonry chronology,inscriptions,stained-glass artwork,interiors,engineering,current restoration finish,hidden joins and exact court/road/threshold/step/base contact remain simplified,excluded or unverified. Glazing/doors are recessed fields;balconies are simplified solid parapets,with no traversal or open-interior claim. Three separately mapped domed tombs to south,park/courtyards/roads,trees and other town buildings remain host content. Mediterranean neighbors are synthetic;physical phone/laptop timing unverified.',
    'Skyline uses six-sided principal caps,conical small roofs,two outer west ribs and simplified minaret necks;the thin central finial is omitted. Skyline retains main shallow dome,two semidomes,four small exedrae,stepped roofs/narthex/buttresses and four spatially distinct minarets with red/pale shafts and pointed caps. District adds shared surfaces,coarse drum/tympanum/narthex/body windows,giant arch recesses,west arched field,pier end caps and balcony bands. Street adds fuller window rhythm,mullions,main dome ribs,minaret fluting/door and solid balcony parapets;close-up/master refine curves/ribs.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('south-giant-arch-and-four-minarets', [16, 49, 154], [0, 30, -5]),
    cam('west-narthex-arched-window-and-cascade', [-140, 53, 21], [-25, 28, -8]),
    cam('east-apse-and-semidome', [141, 54, -1], [29, 27, -8]),
    cam('north-buttresses-and-drum', [4, 58, -161], [1, 29, -14]),
    cam('central-drum-and-dome-ribs', [72, 91, 91], [4, 47, -9]),
    cam('roof-and-signed-plan', [0, 235, 0.1], [0, 28, -8]),
  ],
};

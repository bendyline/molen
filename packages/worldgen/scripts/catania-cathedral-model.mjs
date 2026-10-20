/** Catania Cathedral: layered baroque front,ribbed dome,clock cap and three lava apses. */
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
  '../../../content/worldgen/source/places/sq/sqd/n0401_catania_cathedral/',
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
  wall: '#b2b8bd',
  trim: '#e0d9c7',
  lava: '#9e9b8d',
  roof: '#a06f55',
  metal: '#85867c',
  door: '#6a5c4c',
  glass: '#566575',
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
const footing = (p) => Math.min(floor - 0.3, cataniaGround(...p) - 0.35);
export function cataniaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Akhtamar Holy Cross footing outside retained terrain');
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
  L = plans.longitudinal,
  T = plans.transverse;
const p = (u, v) => [plans.origin[0] + L[0] * u + T[0] * v, plans.origin[1] + L[1] * u + T[1] * v],
  rect = (a, b, x, z) => [p(a, b), p(x, b), p(x, z), p(a, z)],
  item = (role) => rec.controls.find((b) => b.id === rec.roles[role]),
  ring = (role) => item(role).polygons[0].outline,
  circle = (p, r, n, off = 0) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * Math.PI * 2) / n + off) * r,
      p[1] + Math.sin((i * Math.PI * 2) / n + off) * r,
    ]);
const nSides = (d) => (d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 16 : 24);
export function cataniaFields(d = 3) {
  const f = [];
  for (const v of [-12, 0, 12])
    f.push({
      ...hole(
        `west-door-${v}`,
        p(-0.7, v),
        T,
        L.map((v) => -v),
        v === 0 ? 4.3 : 3.1,
        0.8,
        v === 0 ? 7.3 : 6,
        v === 0 ? 7.3 : 6,
        'rect',
        5,
      ),
      kind: 'door',
    });
  for (const v of [-12, 12])
    f.push(
      hole(
        `west-oculus-${v}`,
        p(-0.7, v),
        T,
        L.map((v) => -v),
        2.6,
        8.6,
        2.6,
        2.6,
        'circle',
        5,
      ),
    );
  f.push({
    ...hole(
      'west-upper-niche',
      p(-1, 0),
      T,
      L.map((v) => -v),
      5.6,
      16,
      8.5,
      5.7,
      'round',
      5,
    ),
    kind: 'niche',
  });
  if (d >= 1) {
    const r = ring('naveRoof');
    for (let i = 0; i < r.length; i++) {
      const e = faceFrame(r, i);
      if (e.length < 50) continue;
      const n = d === 1 ? 2 : 7;
      for (let j = 0; j < n; j++)
        f.push(
          hole(
            `clerestory-${i}-${j}`,
            lerp(e.a, e.b, (j + 0.5) / n),
            e.axis,
            e.normal,
            1.5,
            18.4,
            2.5,
            1.9,
            'round',
            2,
          ),
        );
    }
  }
  if (d >= 2)
    for (const side of [-1, 1])
      for (const u of side < 0 ? [5, 13, 21, 29, 37, 45] : [5, 13, 21, 29])
        f.push(
          hole(
            `aisle-${side}-${u}`,
            p(u, side * 18),
            L,
            T.map((v) => v * side),
            1.9,
            9.2,
            4.2,
            3.5,
            'round',
            2,
          ),
        );
  return f;
}
export function cataniaDrumFields(d = 3) {
  if (d === 0) return [];
  const r = circle(plans.domeCenter, plans.domeRadius, nSides(d)),
    f = [],
    step = d === 1 ? 2 : d === 2 ? 2 : 3;
  for (let i = 0; i < r.length; i += step) {
    const e = faceFrame(r, i);
    f.push(
      hole(
        `drum-light-${i}`,
        lerp(e.a, e.b, 0.5),
        e.axis,
        e.normal,
        1.7,
        27.1,
        6.5,
        5.5,
        'round',
        3,
      ),
    );
  }
  return f;
}
export function cataniaBellFields() {
  const o = plans.bellCenter,
    r = R(o[0] - 4.5, o[1] - 4.5, o[0] + 4.5, o[1] + 4.5);
  return r.map((_, i) => {
    const e = faceFrame(r, i);
    return hole(
      `bell-arch-${i}`,
      lerp(e.a, e.b, 0.5),
      e.axis,
      e.normal,
      3.2,
      22,
      7.6,
      5.9,
      'round',
      11,
    );
  });
}
export function cataniaApseFields(d = 3) {
  if (d < 1) return [];
  const fields = plans.apses.map((a) =>
    hole(
      `${a.name}-lancet`,
      [a.center[0] + a.radius, a.center[1]],
      [0, 1],
      [1, 0],
      1.25,
      6,
      8,
      6.4,
      'pointed',
      4,
    ),
  );
  if (d >= 2)
    for (const a of plans.apses) {
      const r = circle(a.center, a.radius, nSides(d)),
        step = d === 2 ? 2 : 3;
      for (let i = 0; i < r.length; i += step) {
        const e = faceFrame(r, i);
        if (e.normal[0] < 0.4) continue;
        fields.push(
          hole(
            `${a.name}-attic-${i}`,
            lerp(e.a, e.b, 0.5),
            e.axis,
            e.normal,
            1.35,
            a.wall - 1.4,
            0.7,
            0.7,
            'rect',
            2,
          ),
        );
      }
    }
  return fields;
}
function panel(
  face,
  h,
  d,
  slot = h.kind === 'door' ? 'door' : h.kind === 'niche' ? 'lava' : 'glass',
  inset = 0.32,
) {
  pane(face, h, d, -inset, slot);
  if (d >= 1) archBand(face, h, d, h.kind === 'door' ? 0.32 : 0.22, 'trim', 0.09);
}
function column(face, o, b, t, r, d) {
  const q = circle(o, r, d <= 1 ? 4 : 8, Math.PI / 4);
  solid(face, q, b, t, 'trim');
  if (d >= 2) {
    band(face, q, b, 0.3, 'trim', 1.4);
    band(face, q, t - 0.3, 0.3, 'trim', 1.45);
  }
}
function crest(face, o, b, h, d) {
  const q = circle(o, 0.32, d <= 1 ? 4 : 6);
  profile(
    face,
    q,
    [
      [b, 1.3],
      [b + h * 0.25, 1.2],
      [b + h * 0.6, 0.6],
      [b + h, 0.05],
    ],
    'trim',
  );
}
function statue(face, o, b, d) {
  if (d < 2) return;
  solid(face, R(o[0] - 0.4, o[1] - 0.4, o[0] + 0.4, o[1] + 0.4), b, b + 0.4, 'trim');
  profile(
    face,
    circle(o, 0.36, 6),
    [
      [b + 0.4, 1.2],
      [b + 1.4, 0.75],
      [b + 1.8, 0.85],
      [b + 2.1, 0.3],
    ],
    'trim',
  );
  column(face, o, b + 2.1, b + 2.7, 0.25, d);
}
function body(out, face, d) {
  const fields = cataniaFields(d),
    maskedFace = writer(
      masked(
        out,
        [...fields, ...cataniaApseFields(d)].map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  solid(maskedFace, d <= 1 ? coarse(main) : main, footing, 0.08, 'lava');
  for (const [role, eave, top, axis] of [
    ['northAisle', 15.8, 18, 0],
    ['southAisle', 15.8, 18, 0],
    ['northTransept', 19, 23, 1],
    ['southTransept', 18, 22, 1],
    ['choir', 20, 23, 0],
  ]) {
    const r = plans[role],
      holes = fields.filter((h) => h.name.startsWith('aisle'));
    shell(out, d, r, footing, eave, holes, 'wall');
    gable(maskedFace, r, eave, top, 'roof', axis);
    if (d >= 1) band(face, r, eave - 0.2, 0.35, 'trim', 1.015);
  }
  const nave = ring('naveRoof');
  shell(
    out,
    d,
    nave,
    footing,
    21.5,
    fields.filter((h) => h.name.startsWith('clerestory')),
    'wall',
  );
  gable(maskedFace, nave, 21.5, 24, 'roof');
  if (d >= 1) band(face, nave, 21.3, 0.4, 'trim', 1.025);
  for (const h of fields.filter((h) => !h.name.startsWith('west'))) panel(face, h, d);
  if (d >= 1)
    for (const side of [-1, 1]) {
      for (const u of [0, 8, 16, 24, 32, 40, 48]) {
        solid(
          face,
          rect(u - 0.22, side * 18 - 0.22, u + 0.22, side * 18 + 0.22),
          footing,
          15.8,
          'trim',
        );
        if (d >= 2) crest(face, p(u, side * 18), 16.2, 0.85, d);
      }
      beam(face, at(p(0, side * 18), 16.5), at(p(50, side * 18), 16.5), 0.24);
      if (d >= 2)
        for (let u = 1.5; u < 49; u += 2.3) column(face, p(u, side * 18), 15.9, 16.5, 0.12, d);
    }
  for (let i = 0; i < rec.roles.southRanges.length; i++) {
    const b = rec.controls.find((b) => b.id === rec.roles.southRanges[i]),
      r = d <= 1 ? coarse(b.polygons[0].outline) : b.polygons[0].outline,
      top = [14, 17, 16, 12][i];
    solid(face, r, footing, top - 2, 'wall');
    hip(face, r, top - 2, top, 'roof', 0);
    cap(face, r, top - 2, 'roof');
    if (d >= 2) band(face, r, top - 2, 0.25, 'trim', 1.025);
  }
}
function front(out, face, d) {
  const fields = cataniaFields(d).filter((h) => h.name.startsWith('west'));
  const openings = d === 0 ? fields.filter((h) => h.kind === 'door') : fields;
  shell(out, d, plans.facadeLower, footing, 12.5, openings, 'wall');
  cap(face, plans.facadeLower, 12.5, 'trim');
  shell(out, d, plans.facadeMiddle, 12.5, 26, openings, 'wall');
  cap(face, plans.facadeMiddle, 26, 'trim');
  solid(face, plans.facadeTop, 26, 30.5, 'wall');
  gable(face, plans.facadeTop, 30.5, 34, 'trim', 0);
  for (const side of [-1, 1]) {
    const profile = [
      [11.4, 12.5],
      [18, 12.5],
      [18, 13.7],
      [16.8, 13.9],
      [15.4, 14.5],
      [14.2, 15.8],
      [13, 17.3],
      [11.4, 18.8],
    ];
    const points = profile.map(([v, y]) => [...at(p(-0.85, side * v), y)]);
    face('wall', points, [-L[0], 0, -L[1]]);
    const back = profile.map(([v, y]) => [...at(p(1.8, side * v), y)]);
    face('wall', back, [L[0], 0, L[1]]);
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      face('wall', [points[i], points[j], back[j], back[i]]);
      if (d >= 2 && i >= 2 && i < points.length - 1) beam(face, points[i], points[j], 0.23);
    }
  }
  for (const h of fields)
    panel(
      face,
      h,
      d,
      h.kind === 'door' ? 'door' : h.kind === 'niche' ? 'lava' : 'glass',
      d === 0 && h.kind !== 'door' ? -0.05 : 0.32,
    );
  if (d >= 1) {
    for (const [r, y] of [
      [plans.facadeLower, 12.1],
      [plans.facadeMiddle, 25.6],
      [plans.facadeTop, 30.15],
    ]) {
      band(face, r, y, 0.5, 'trim', 1.025);
      cap(face, scaled(r, 1.025), y + 0.5, 'trim');
    }
    for (const v of [-16, -8, 8, 16]) column(face, p(-1.05, v), 0.5, 12.1, 0.5, d);
    for (const v of [-9.5, -4.5, 4.5, 9.5]) column(face, p(-1.35, v), 13, 25.6, 0.43, d);
    for (const v of [-5, 5]) column(face, p(-1.65, v), 26.5, 30.1, 0.34, d);
    for (const v of [-17.5, -11.5, 11.5, 17.5]) crest(face, p(-0.1, v), 12.7, 1.8, d);
    for (const v of [-10.5, -6, 6, 10.5]) crest(face, p(-0.2, v), 26.1, 1.7, d);
    for (const v of [-5.5, 5.5]) crest(face, p(-0.2, v), 30.6, 1.8, d);
    for (const v of [-12, 0, 12]) {
      const h = hole(
        `portal-pediment-${v}`,
        p(-0.85, v),
        T,
        L.map((v) => -v),
        v === 0 ? 6.2 : 4.5,
        v === 0 ? 7.6 : 6.5,
        2.6,
        1.2,
        'round',
        2,
      );
      archBand(face, h, d, 0.25, 'trim', 0.22);
    }
    const a = p(-1.5, -6.5),
      b = p(-1.5, 6.5),
      m = p(-1.5, 0);
    beam(face, at(a, 30.5), at(m, 34), 0.35);
    beam(face, at(m, 34), at(b, 30.5), 0.35);
    if (d >= 2) {
      for (const v of [-8.2, 8.2]) statue(face, p(-1.75, v), 0.6, d);
      statue(face, p(-0.7, 0), 16.4, d);
    }
  }
  const q = p(-0.4, 0);
  beam(face, at(q, 34), at(q, 36), 0.2, 'metal');
  beam(face, at([q[0], q[1] - 0.65], 35.4), at([q[0], q[1] + 0.65], 35.4), 0.18, 'metal');
  for (let i = 0; i < (d === 0 ? 1 : 4); i++) {
    const n = d === 0 ? 1 : 4;
    solid(
      face,
      rect(-3.2 + i * 0.55, -5, -0.6, 5),
      (q) => Math.min(-0.3, cataniaGround(...q) - 0.2),
      (0.8 * (i + 1)) / n,
      'trim',
    );
  }
}
function apses(out, face, d) {
  const holes = cataniaApseFields(d);
  const decoration = writer(
    masked(
      out,
      holes.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  for (const a of plans.apses) {
    const r = circle(a.center, a.radius, nSides(d)),
      hs = holes.filter((h) => h.name.startsWith(a.name));
    shell(out, d, r, footing, a.wall, hs, 'lava');
    cap(face, r, a.wall, 'lava');
    profile(
      face,
      scaled(r, 1.02),
      [
        [a.wall, 1],
        [a.cap, 0.05],
      ],
      'roof',
    );
    for (const h of hs) panel(face, h, d, 'glass');
    if (d >= 1) {
      band(face, r, a.wall - 2.1, 0.25, 'trim', 1.006);
      band(face, r, 1.2, 0.25, 'lava', 1.02);
      const arches = circle(a.center, a.radius, d >= 3 ? 12 : nSides(d));
      for (let i = 0; i < arches.length; i++) {
        const e = faceFrame(arches, i);
        if (e.normal[0] < 0.2) continue;
        if (d >= 2) {
          const h = hole(
            `${a.name}-blind-${i}`,
            lerp(e.a, e.b, 0.5),
            e.axis,
            e.normal,
            Math.min(4.2, e.length - 0.15),
            9,
            5.2,
            3.3,
            'pointed',
            1,
          );
          archBand(decoration, h, d, 0.1, 'trim', d >= 3 ? 0.32 : 0.06);
        }
      }
    }
  }
}
function lantern(face, o, r, b, t, capTop, d) {
  const n = d === 0 ? 4 : 8,
    q = circle(o, r, n, Math.PI / 8);
  profile(
    face,
    q,
    [
      [b, 1.1],
      [b + 0.5, 1.08],
    ],
    'trim',
  );
  for (const p of q) column(face, p, b + 0.5, t, 0.13, d);
  cap(face, scaled(q, 1.1), t, 'trim');
  profile(
    face,
    scaled(q, 1.1),
    [
      [t, 1],
      [capTop, 0.08],
    ],
    'metal',
  );
}
function dome(out, face, d) {
  const o = plans.domeCenter,
    r = circle(o, plans.domeRadius, nSides(d)),
    holes = cataniaDrumFields(d);
  solid(face, r, footing, 24, 'wall');
  shell(out, d, r, 24, 37, holes, 'trim');
  cap((slot, p) => face(slot, p, [0, -1, 0]), scaled(r, 1.07), 37, 'trim');
  band(face, r, 36.6, 0.4, 'trim', 1.07);
  const levels =
    d <= 1
      ? [
          [37, 1.04],
          [42, 0.88],
          [46.4, 0.48],
          [48.5, 0.13],
        ]
      : [
          [37, 1.04],
          [39, 1.0],
          [42, 0.88],
          [45, 0.65],
          [47.2, 0.35],
          [48.5, 0.13],
        ];
  profile(face, r, levels, 'metal');
  for (const h of holes) panel(face, h, d);
  if (d >= 1) {
    const step = d === 1 ? 2 : d === 2 ? 2 : 3;
    for (let i = 0; i < r.length; i += step) {
      const q = r[i];
      if (d >= 2) {
        const radial = unit(q.map((v, k) => v - o[k])),
          tangent = [-radial[1], radial[0]];
        for (const side of [-1, 1])
          column(
            face,
            q.map((v, k) => v + radial[k] * 0.15 + tangent[k] * side * 0.36),
            25,
            36.5,
            0.3,
            d,
          );
      } else column(face, q, 25, 36.5, 0.27, d);
      for (let j = 1; j < levels.length; j++) {
        const atLevel = ([y, s]) => [o[0] + (q[0] - o[0]) * s, floor + y, o[1] + (q[1] - o[1]) * s];
        beam(face, atLevel(levels[j - 1]), atLevel(levels[j]), d === 1 ? 0.16 : 0.22, 'trim');
      }
    }
  }
  lantern(face, o, 1.65, 48.5, 53.5, 55, d);
  beam(face, at(o, 55), at(o, 57.5), 0.2, 'metal');
  beam(face, at([o[0] - 0.7, o[1]], 56.8), at([o[0] + 0.7, o[1]], 56.8), 0.18, 'metal');
}
function bell(out, face, d) {
  const o = plans.bellCenter,
    r = R(o[0] - 4.5, o[1] - 4.5, o[0] + 4.5, o[1] + 4.5),
    holes = d >= 1 ? cataniaBellFields() : [];
  solid(face, r, footing, 20.5, 'wall');
  shell(out, d, r, 20.5, 31.5, holes, 'trim', scaled(r, 0.72));
  cap(face, r, 20.5, 'trim');
  cap(face, r, 31.5, 'trim');
  const upper = R(o[0] - 3.5, o[1] - 3.5, o[0] + 3.5, o[1] + 3.5);
  solid(face, upper, 31.5, 39.5, 'trim');
  for (const y of [20.1, 31.1, 39.1]) {
    band(face, r, y, 0.4, 'trim', 1.04);
    cap(face, scaled(r, 1.04), y + 0.4, 'trim');
  }
  if (d >= 1) {
    for (const h of holes) archBand(face, h, d, 0.3, 'trim', 0.08);
    for (const side of [-1, 1]) {
      const h = hole(
        `clock-${side}`,
        [o[0] + side * 3.5, o[1]],
        [0, 1],
        [side, 0],
        3,
        34,
        3,
        3,
        'circle',
        1,
      );
      pane(face, h, d, 0.08, 'glass');
      archBand(face, h, d, 0.16, 'trim', 0.1);
      const f = prepareOpening(h, 0, d);
      beam(
        face,
        f.point(0, floor + 35.5, -0.14 * side),
        f.point(0.9, floor + 35.8, -0.14 * side),
        0.12,
        'trim',
      );
      beam(
        face,
        f.point(0, floor + 35.5, -0.15 * side),
        f.point(-0.3, floor + 36.6, -0.15 * side),
        0.13,
        'trim',
      );
    }
    for (const x of [o[0] - 4.3, o[0] + 4.3])
      for (const z of [o[1] - 4.3, o[1] + 4.3]) column(face, [x, z], 21, 31.1, 0.28, d);
  }
  const capRing = circle(o, plans.bellRadius, nSides(d));
  profile(
    face,
    capRing,
    [
      [39.5, 1.12],
      [41, 1],
      [43.6, 0.8],
      [45, 0.3],
      [45.3, 0.18],
    ],
    'metal',
  );
  if (d >= 2)
    for (let i = 0; i < capRing.length; i += 3) {
      const q = capRing[i];
      beam(
        face,
        [q[0], floor + 39.5, q[1]],
        [o[0] + (q[0] - o[0]) * 0.6, floor + 44.2, o[1] + (q[1] - o[1]) * 0.6],
        0.17,
        'trim',
      );
    }
  lantern(face, o, 0.72, 45.3, 47.7, 48.4, d);
  beam(face, at(o, 48.4), at(o, 49.5), 0.16, 'metal');
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
  body(out, face, d);
  front(out, face, d);
  apses(out, face, d);
  dome(out, face, d);
  bell(out, face, d);
}
export const buildCataniaSkyline = (o) => build(o, 0),
  buildCataniaDistrict = (o) => build(o, 1),
  buildCataniaStreet = (o) => build(o, 2),
  buildCataniaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const cataniaCathedralStudy = {
  id: 'N0401',
  key: 'catania_cathedral',
  title: 'Catania Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1499188',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0.Linked photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared256-square lime plaster,continuous limestone,basalt ashlar,ceramic roof tile,painted metal and plain wood graphs serve seven groups including local blue-grey glass. Linear tints,metric UVs and flat architectural normals.No embedded images,unique facade photographs,baked lighting or micro-carving.',
  importReason:
    'Preserve individual three-tier baroque west front,large ribbed dome/lantern,north belfry/clock/cap tower,three medieval lava apses,long oblique nave and mapped southern ranges in four browser LODs.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from six inspected pictures and standard viewer map/DEM.All heights and detailed component profiles estimated;no survey dimensions.Fine portal sculpture,figures,inscriptions,exact dome ornament,full interiors/bells,engineering,hidden roof joins,current finish and precise host-ground contact excluded,simplified or unverified.Neighboring Badia/bishop/civic buildings remain separate.Synthetic Italian palazzo neighbors are style fixtures.Physical phone/laptop timing pending.',
    'Skyline retains three-tier front with oculi,main dome/lantern,north small-cap tower and three curved apses.District adds shared surfaces,front columns/portals,recessed windows,drum ribs and open belfry.Street adds side bay rhythm,parapets and blind apse arches.Close-up/master add sparse figure/clock/column-capital abstractions.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-baroque-front-and-portals', [-91, 27, 3], [-49, 15, 7]),
    cam('north-nave-and-bell-tower', [-19, 35, -74], [-4, 17, -7]),
    cam('main-dome-drum-and-lantern', [4, 61, -30], [28.3, 39, 0]),
    cam('bell-arches-clock-and-small-cap', [43, 44, -46], [20.8, 34, -21.6]),
    cam('three-medieval-lava-apses', [85, 29, 3], [40, 12, 0]),
    cam('roof-and-signed-plan', [0, 170, 0.1], [0, 16, 0]),
  ],
};

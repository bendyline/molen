/** Sarajevo Orthodox Cathedral: plaster pilasters, five domes and a tall Baroque bell tower. */
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
  '../../../content/worldgen/source/places/sr/srv/n0385_serbian_orthodox_cathedral_in_sarajevo/',
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
  wall: '#b89580',
  trim: '#edd5a0',
  roof: '#50565b',
  door: '#604a3a',
  glass: '#4e5558',
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
const footing = (p) => Math.min(floor - 0.3, sarajevoOrthodoxGround(...p) - 0.35);
export function sarajevoOrthodoxGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Sarajevo Orthodox Cathedral footing outside retained terrain');
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
const towerRing = (key) => coarse(plans[key][0].outline);
const domeRing = (p, r, n) => circle(p, r, n, Math.PI / n);
function edgeHole(name, r, n, w, b, h, s = h, shape = 'round', kind = 'window') {
  const f = edge(r, n);
  return { ...hole(name, lerp(f.a, f.b, 0.5), f.axis, f.normal, w, b, h, s, shape, 3), kind };
}
function fields(_d = 3) {
  const a = [],
    body = plans.body[0].outline;
  for (const sg of [-1, 1]) {
    const f = edge(body, [0, sg]);
    for (const x of [-10, -3, 4.5, 11.5]) {
      const p = lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0]));
      a.push({
        ...hole(`side-upper-${sg}-${x}`, p, f.axis, f.normal, 1.9, 6.0, 6.0, 5.05, 'round', 3),
        kind: 'window',
      });
      a.push({
        ...hole(`side-lower-${sg}-${x}`, p, f.axis, f.normal, 1.45, 1.7, 2.8, 2.075, 'round', 3),
        kind: 'window',
      });
    }
    a.push({
      ...hole(
        `front-side-upper-${sg}`,
        [-15.6, sg * 7.25],
        [0, 1],
        [-1, 0],
        1.85,
        6.0,
        5.9,
        4.975,
        'round',
        3,
      ),
      kind: 'window',
    });
    a.push({
      ...hole(
        `front-side-door-${sg}`,
        [-15.6, sg * 7.25],
        [0, 1],
        [-1, 0],
        1.65,
        0.1,
        3.8,
        2.975,
        'round',
        3,
      ),
      kind: 'door',
    });
  }
  const base = towerRing('towerBase'),
    mid = towerRing('towerMiddle'),
    bell = towerRing('towerBelfry');
  a.push(edgeHole('front-timber-portal', base, [-1, 0], 3.15, 0.1, 5.0, 3.425, 'round', 'door'));
  for (const n of [
    [-1, 0],
    [0, -1],
    [0, 1],
  ])
    a.push(edgeHole(`tower-middle-${n}`, mid, n, 1.85, 17.1, 2.8, 1.875));
  for (const n of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    a.push(edgeHole(`tower-belfry-${n}`, bell, n, 2.9, 22.6, 6.1, 4.65, 'round', 'louver'));
    a.push(edgeHole(`tower-clock-${n}`, bell, n, 1.35, 29.4, 1.35, 0, 'circle', 'clock'));
  }
  const apse = plans.apse[0].outline;
  for (let i = 0; i < apse.length; i++) {
    const f = faceFrame(apse, i);
    if (f.normal[0] < 0.45) continue;
    a.push({
      ...hole(
        `apse-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        Math.min(1.35, f.length * 0.66),
        6,
        5.7,
        5.7 - Math.min(1.35, f.length * 0.66) / 2,
        'round',
        3,
      ),
      kind: 'window',
    });
  }
  const drums = [
    { name: 'central', p: rec.estimated.domeCenter, r: 4.25, n: 14, b: 24, h: 5.7 },
    ...rec.estimated.satellites.map((q, i) => ({
      name: `satellite-${i}`,
      p: q.center,
      r: 2.05,
      n: 8,
      b: 19.75,
      h: 3.55,
    })),
  ];
  for (const q of drums) {
    const r = domeRing(q.p, q.r, q.n);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        w = q.name === 'central' ? 1.15 : 0.78;
      a.push({
        ...hole(
          `drum-${q.name}-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          w,
          q.b,
          q.h,
          q.h - w / 2,
          'round',
          2,
        ),
        kind: 'window',
      });
    }
  }
  const lantern = R(
    rec.estimated.towerCenter[0] - 1.2,
    rec.estimated.towerCenter[1] - 1.2,
    rec.estimated.towerCenter[0] + 1.2,
    rec.estimated.towerCenter[1] + 1.2,
  );
  for (const n of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ])
    a.push(edgeHole(`cap-lantern-${n}`, lantern, n, 1.35, 39.0, 2.05, 1.375, 'round', 'louver'));
  return a;
}
export const sarajevoOrthodoxFields = fields;
function decoratedPanel(face, h, d) {
  if (d === 2 && h.name.startsWith('drum-satellite-')) d = 1;
  const sd = d === 2 ? 1 : d;
  if (d === 1 && h.kind === 'door') {
    pane(face, h, sd, -0.75, 'door');
    archBand(face, h, sd, 0.25, 'trim', 0.08);
    return;
  }
  if (h.kind === 'clock') {
    pane(face, h, sd, d >= 2 ? -0.5 : 0.06, 'trim');
    if (d >= 2) {
      archBand(face, h, sd, 0.16, 'trim', 0.06);
      const p = prepareOpening(h, 0, sd),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      for (const [u, v] of [
        [0.35, 0.1],
        [-0.1, 0.43],
      ])
        beam(
          face,
          p.point(0, h.bottom + h.height / 2, -0.42 * sg),
          p.point(u, h.bottom + h.height / 2 + v, -0.42 * sg),
          0.065,
          'glass',
        );
    }
    return;
  }
  if (h.kind === 'louver') {
    pane(face, h, sd, d >= 2 ? -0.75 : 0.06, 'door');
    if (d >= 2) {
      archBand(face, h, sd, 0.22, 'trim', 0.07);
      const p = prepareOpening(h, 0, sd),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      for (let y = 0.25; y < h.spring; y += d === 2 ? 0.5 : 0.3)
        beam(
          face,
          p.point(-h.width * 0.44, h.bottom + y, -0.55 * sg),
          p.point(h.width * 0.44, h.bottom + y, -0.55 * sg),
          0.085,
          'door',
        );
    }
    return;
  }
  panel(face, h, d);
  if (d >= 3 && h.kind === 'window') {
    const p = prepareOpening(h, 0, sd),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    for (let y = 0.75; y < h.spring - 0.1; y += 1.0)
      beam(
        face,
        p.point(-h.width * 0.38, h.bottom + y, -0.59 * sg),
        p.point(h.width * 0.38, h.bottom + y, -0.59 * sg),
        0.055,
        'accent',
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
  if (d >= 2)
    for (let i = 0; i < (d === 2 ? 8 : 12); i++) {
      const a = (i * Math.PI * 2) / (d === 2 ? 8 : 12);
      for (let j = 1; j <= steps; j++) {
        const point = (k) => [
          p[0] + Math.cos(a) * (r + 0.025) * Math.cos(((k / steps) * Math.PI) / 2),
          floor + b + (t - b) * Math.sin(((k / steps) * Math.PI) / 2) + 0.025,
          p[1] + Math.sin(a) * (r + 0.025) * Math.cos(((k / steps) * Math.PI) / 2),
        ];
        beam(face, point(j - 1), point(j), 0.055, 'roof');
      }
    }
}
function crossTop(face, p, b, t, d) {
  const slot = d === 0 ? 'trim' : 'accent',
    w = d === 0 ? 0.09 : 0.06;
  beam(face, at(p, b), at(p, t), w, slot);
  const y = t - (t - b) * 0.3;
  beam(
    face,
    [p[0], floor + y, p[1] - (t - b) * 0.28],
    [p[0], floor + y, p[1] + (t - b) * 0.28],
    w,
    slot,
  );
}
function pilaster(face, p, b, t, w = 0.35) {
  solid(face, R(p[0] - w / 2, p[1] - 0.18, p[0] + w / 2, p[1] + 0.18), b, t, 'trim');
}
function shoulder(face, p, _zsg, d) {
  const x = p[0] < 0 ? -15.65 : 17.2,
    z = p[1],
    ys = [15.8, 16.1, 17.1, 18.3, 18.65, 18.3, 17.1, 16.1, 15.8],
    width = 5.0;
  const outline = ys.map((y, i) => [x, floor + y, z - width / 2 + (i * width) / 8]);
  for (let i = 0; i < outline.length - 1; i++)
    face(
      'wall',
      [
        [x, floor + 15.5, outline[i][2]],
        [x, floor + 15.5, outline[i + 1][2]],
        outline[i + 1],
        outline[i],
      ],
      [p[0] < 0 ? -1 : 1, 0, 0],
    );
  if (d >= 2)
    for (let i = 0; i < outline.length - 1; i++)
      beam(face, outline[i], outline[i + 1], 0.22, 'trim');
}
function build(out, d) {
  // Apertures meeting tile-quantized edges can leave submillimetre Float32 slivers.
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
        ? all.filter((h) => d !== 2 || !h.name.startsWith('drum-satellite-'))
        : all.filter((h) => h.kind === 'door'),
    maskedFace = writer(
      masked(
        out,
        selected.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
      ),
      d,
    );
  for (const p of plans.body) {
    shell(out, d, p.outline, footing, 15.5, selected);
    cap(face, p.outline, 15.5, 'wall');
  }
  const base = towerRing('towerBase'),
    mid = towerRing('towerMiddle'),
    bell = towerRing('towerBelfry'),
    tp = rec.estimated.towerCenter;
  shell(out, d, base, footing, 15.39, selected);
  cap(face, base, 15.39, 'trim');
  shell(out, d, mid, 15.2, 21.64, selected);
  cap(face, mid, 21.64, 'trim');
  shell(out, d, bell, 21.4, 31.6, selected);
  cap(face, bell, 31.6, 'trim');
  // The one tall tower has a square bulb, small louvered lantern and upper onion.
  const capRing =
    d === 0
      ? R(tp[0] - 3.25, tp[1] - 3.25, tp[0] + 3.25, tp[1] + 3.25)
      : Array.from({ length: d === 1 ? 8 : d === 2 ? 16 : 24 }, (_, i) => {
          const a = (i * Math.PI * 2) / (d === 1 ? 8 : d === 2 ? 16 : 24),
            c = Math.cos(a),
            s = Math.sin(a),
            r = 3.25 / Math.pow(Math.pow(Math.abs(c), 4) + Math.pow(Math.abs(s), 4), 0.25);
          return [tp[0] + c * r, tp[1] + s * r];
        });
  profile(
    face,
    capRing,
    d === 0
      ? [
          [31.6, 1],
          [35, 1.17],
          [38.65, 0.36],
        ]
      : [
          [31.6, 1],
          [32.11, 1.04],
          [33.4, 0.83],
          [34.5, 1.15],
          [35.7, 1.28],
          [37.0, 1.12],
          [38.3, 0.61],
          [38.65, 0.38],
        ],
    'roof',
  );
  const lantern = R(tp[0] - 1.2, tp[1] - 1.2, tp[0] + 1.2, tp[1] + 1.2);
  shell(out, d, lantern, 38.6, 41.6, selected, 'roof');
  cap(face, lantern, 41.6, 'roof');
  profile(
    face,
    lantern,
    d === 0
      ? [
          [41.6, 1.15],
          [43, 0.55],
          [44.7, 0.04],
        ]
      : [
          [41.6, 1.2],
          [42.0, 1.0],
          [42.6, 0.95],
          [43.3, 0.5],
          [44.1, 0.15],
          [44.35, 0.05],
        ],
    'roof',
  );
  if (d > 0) dome(face, tp, 0.29, 44.32, 44.9, d);
  crossTop(face, tp, d === 0 ? 44.7 : 44.9, 45.62, d);
  // Current roof controls retain the low hipped body and projecting round apses.
  const roof = coarse(plans.roof[0].outline);
  hip(face, roof, 16.73, 21.32, 'roof');
  const _apse = plans.apse[0].outline,
    ap = rec.estimated.domeCenter;
  dome(face, [17.25, -0.045], 3.95, 15.5, 17.79, d);
  for (const k of ['smallApseNorth', 'smallApseSouth']) {
    const r = plans[k][0].outline,
      p = [0, 1].map(
        (i) => (Math.min(...r.map((p) => p[i])) + Math.max(...r.map((p) => p[i]))) / 2,
      );
    dome(face, p, 1.68, 15.5, 16.3, d);
  }
  const plinth = coarse(plans.centralPlinth[0].outline);
  solid(face, plinth, 19.0, 22.94, 'wall');
  const central = domeRing(ap, 4.25, d === 0 ? 8 : 14);
  shell(out, d, central, 22.8, 31, selected);
  cap(face, central, 31, 'trim');
  dome(face, ap, 4.38, 31, 34, d);
  crossTop(face, ap, 34, 35.86, d);
  for (const q of rec.estimated.satellites) {
    const p = q.center,
      r = domeRing(p, 2.05, 8),
      pl = R(p[0] - 2.18, p[1] - 2.18, p[0] + 2.18, p[1] + 2.18);
    solid(face, pl, 15.0, 19.25, 'wall');
    shell(out, d, r, 19.1, 24, selected);
    cap(face, r, 24, 'trim');
    dome(face, p, 2.25, 24, 25, d);
    crossTop(face, p, 25, 25.95, d);
    if (d > 0) {
      band(face, r, 19.25, 0.22, 'trim', 1.05);
      band(face, r, 23.75, 0.25, 'trim', 1.08);
      shoulder(face, p, Math.sign(p[1]), d);
    }
  }
  if (d > 0) {
    for (const h of all) decoratedPanel(face, h, d);
    band(maskedFace, main, 1.1, 0.25, 'trim', 1.003);
    band(face, main, 14.7, 0.38, 'trim', 1.007);
    band(face, main, 15.2, 0.3, 'trim', 1.015);
    for (const [r, y] of [
      [base, 15],
      [mid, 21.25],
      [bell, 31.2],
    ])
      band(face, r, y, 0.3, 'trim', 1.025);
    band(face, central, 22.95, 0.3, 'trim', 1.04);
    band(face, central, 30.65, 0.35, 'trim', 1.06);
    for (const r of [base, mid, bell])
      for (const p of r)
        if (d >= 2)
          pilaster(
            face,
            p,
            r === base ? 1.3 : r === mid ? 15.5 : 21.8,
            r === base ? 14.7 : r === mid ? 21.2 : 31.2,
            0.3,
          );
  }
  if (d >= 2) {
    const body = plans.body[0].outline;
    for (const sg of [-1, 1]) {
      const f = edge(body, [0, sg]);
      for (const x of [-14.4, -6.6, 0.6, 8, 15.7])
        pilaster(face, lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0])), 1.3, 14.7, 0.4);
      // Broad cornice brackets; no bespoke facade image or individual sculptural claim.
      for (let x = -14; x < 16; x += 1.2) {
        const p = lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0]));
        solid(face, R(p[0] - 0.15, p[1] - 0.19, p[0] + 0.15, p[1] + 0.19), 13.9, 14.7, 'trim');
      }
    }
    for (const n of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const f = edge(bell, n),
        a = lerp(f.a, f.b, 0.04),
        b = lerp(f.a, f.b, 0.96),
        p = lerp(a, b, 0.5),
        top = [p[0], floor + 32.11, p[1]];
      face('trim', [at(a, 31.4), at(b, 31.4), top], [n[0], 0, n[1]]);
      beam(face, at(a, 31.4), top, 0.18, 'trim');
      beam(face, top, at(b, 31.4), 0.18, 'trim');
    }
  }
  // Connected entrance landing and short approximate steps, subdivided for local footprints.
  const front = edge(base, [-1, 0]),
    fp = lerp(front.a, front.b, 0.5),
    x = fp[0];
  solid(face, R(x - 1.1, fp[1] - 2.2, x + 0.1, fp[1] + 2.2), footing, 0.1, 'trim');
  const count = d === 0 ? 1 : d === 1 ? 2 : 4;
  for (let j = 0; j < count; j++)
    for (let k = 0; k < 2; k++)
      solid(
        face,
        R(
          x - 1.1 - ((j + 1) * 1.4) / count,
          fp[1] - 2.2 + k * 2.2,
          x - 1.1 - (j * 1.4) / count,
          fp[1] + k * 2.2,
        ),
        footing,
        0.1 - ((j + 1) * 0.6) / count,
        'trim',
      );
}
export const buildSarajevoOrthodoxSkyline = (o) => build(o, 0),
  buildSarajevoOrthodoxDistrict = (o) => build(o, 1),
  buildSarajevoOrthodoxStreet = (o) => build(o, 2),
  buildSarajevoOrthodoxCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const sarajevoOrthodoxStudy = {
  id: 'N0385',
  key: 'serbian_orthodox_cathedral_in_sarajevo',
  title: 'Serbian Orthodox Cathedral in Sarajevo',
  category: 'cathedral',
  wikidataId: 'Q1271286',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current25-vertex whole and35 component controls retain247 raw vertices/tags. West projecting square bell tower versus eastern three-lobe apse signs retained frame.',
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
    'Four existing cached256-square lime-plaster,continuous limestone,standing-seam metal and plain-wood graphs. Linear rose/cream/dark-metal tints,metric UVs and flat architectural normals. Glazing,clock hands and gold crosses use geometric PBR colors. No embedded images,unique facade maps or baked shadows.',
  importReason:
    'Four authored browser levels preserve the single tall projecting Baroque bell tower,central dome,four satellite drums,three rounded apses and creamy articulated plaster body.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from four actually inspected2006/2011/2019/2023 exterior photographs and standard viewer PMTiles/DEM. Whole/component controls retained; hidden side/rear window rhythm,internal eaves/stages,curved roof profiles,plaster tone,small grille details and shoulders are approximate. No bespoke plans/surveys researched or photographs redistributed. Fine iconography,inscriptions,sculpture and interiors are simplified or excluded. Nearby buildings,garden fence/trees and actual street surfaces remain host content. Physical phone/laptop timing pending.',
    'Skyline preserves the projecting single tall bell tower and five domed drums with simplified profiles. District adds shared surfaces,flat framed fields,clocks/cornices and deep door recesses. Street adds actual recessed round-headed window/louver fields,pilasters,roof ribs and pediments. Closeup/master refine glazing grilles,roof facets and louver rows. Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('projecting-tower-entrance-and-front-drums', [-65, 18, 38], [-16, 12, 0]),
    cam('clock-louvers-and-baroque-tower-cap', [-50, 42, -42], [-17.4, 32, 0]),
    cam('north-plaster-bays-and-domes', [7, 28, -67], [0, 15, -3]),
    cam('three-rounded-eastern-apses', [62, 24, 36], [15, 11, 0]),
    cam('five-windowed-drums-and-roof', [47, 59, -45], [0, 24, 0]),
    cam('roof-and-signed-whole-plan', [0, 115, 1], [0, 15, 0]),
  ],
};

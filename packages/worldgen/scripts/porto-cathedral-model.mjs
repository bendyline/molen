/** Porto Cathedral: fortress twin domes, west rose, north loggia and open Gothic cloister. */
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
  '../../../content/worldgen/source/places/ez/ez3/porto_cathedral/',
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
  wall: '#cfc9b9',
  trim: '#d8d1c1',
  roof: '#ad6d53',
  door: '#6f604d',
  metal: '#73776b',
  tile: '#b9d5df',
  glass: '#586878',
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
const footing = (p) => Math.min(floor - 0.3, portoGround(...p) - 0.35);
export function portoGround(x, z) {
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
  main = rec.main.polygons[0].outline;
const item = (role) => rec.controls.find((b) => b.id === rec.roles[role]),
  ring = (role) => item(role).polygons[0].outline;
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos((i * Math.PI * 2) / n) * r,
    p[1] + Math.sin((i * Math.PI * 2) / n) * r,
  ]);
const rectangle = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
const lowRing = (r, d) => (d <= 1 ? coarse(r) : r);
export function portoFields(d = 3) {
  const list = [
    {
      ...hole('west-main-portal', [-33, -0.15], [0, 1], [-1, 0], 3, 0.12, 5.4, 5.4, 'rect', 5),
      kind: 'door',
    },
    hole('west-rose', [-33, -0.15], [0, 1], [-1, 0], 5.2, 15.2, 5.2, 5.2, 'circle', 5),
  ];
  if (d >= 1) {
    if (d >= 2)
      for (const side of [-1, 1])
        for (const x of [-17.3, -11.45, -5.6, 0.25])
          list.push(
            hole(
              `nave-${side}-${x}`,
              [x, side < 0 ? -4.7 : 4.5],
              [1, 0],
              [0, side],
              1.25,
              15.9,
              2.5,
              1.9,
              'round',
              2,
            ),
          );
    for (const side of [-1, 1])
      list.push(
        hole(
          `transept-${side}`,
          [8.3, side * 16.9],
          [1, 0],
          [0, side],
          2.3,
          10,
          7,
          5.4,
          'pointed',
          3,
        ),
      );
    for (const z of [-5.2, 0, 5.2])
      list.push(hole(`choir-east-${z}`, [34.09, z], [0, 1], [1, 0], 1.9, 9, 8, 6.2, 'round', 3));
  }
  return list;
}
export function portoTowerFields(role) {
  const r = ring(role),
    bb = rectangle(r),
    p = [(bb[0][0] + bb[0][1]) / 2, (bb[1][0] + bb[1][1]) / 2];
  return [
    [
      [-1, 0],
      [0, 1],
      [bb[0][0], p[1]],
    ],
    [
      [1, 0],
      [0, 1],
      [bb[0][1], p[1]],
    ],
    [
      [0, -1],
      [1, 0],
      [p[0], bb[1][0]],
    ],
    [
      [0, 1],
      [1, 0],
      [p[0], bb[1][1]],
    ],
  ].map(([n, a, p], i) => hole(`${role}-belfry-${i}`, p, a, n, 1.9, 24, 4.3, 3.35, 'round', 13));
}
export function portoLoggiaFields() {
  return [-21.3, -15.75, -10.2, -4.65, 0.65].map((x, i) =>
    hole(`north-loggia-${i}`, [x, -15.5], [1, 0], [0, -1], 3.7, 1.7, 5.35, 3.7, 'round', 12),
  );
}
export function portoCloisterFields(d = 3) {
  const h = rec.plans.cloisterHole,
    b = rectangle(h),
    f = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const x = b[0][0] + ((i + 0.5) * (b[0][1] - b[0][0])) / 4,
        z = side < 0 ? b[1][0] : b[1][1];
      f.push(
        hole(`cloister-${side}-${i}`, [x, z], [1, 0], [0, -side], 3.1, 0.7, 5.8, 3.7, 'pointed', 3),
      );
      const zz = b[1][0] + ((i + 0.5) * (b[1][1] - b[1][0])) / 4,
        xx = side < 0 ? b[0][0] : b[0][1];
      f.push(
        hole(
          `cloister-side-${side}-${i}`,
          [xx, zz],
          [0, 1],
          [-side, 0],
          3,
          0.7,
          5.8,
          3.7,
          'pointed',
          3,
        ),
      );
    }
  return d >= 2 ? f : [];
}
function panel(face, h, d, slot = 'glass', inset = 0.2) {
  pane(face, h, d, -inset, slot);
  if (d >= 2) archBand(face, h, d, 0.22, 'trim', 0.06);
}
function crenels(face, r, y, d, pitch = 2) {
  if (d === 0) return;
  if (d === 1) pitch *= 1.9;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 3) continue;
    const n = Math.max(1, Math.round(f.length / pitch));
    for (let j = 0; j < n; j++) {
      const p = lerp(f.a, f.b, (j + 0.5) / n),
        w = 0.6;
      solid(face, R(p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2), y, y + 0.7, 'trim');
      if (d >= 2)
        profile(
          face,
          R(p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2),
          [
            [y + 0.7, 1],
            [y + 1.05, 0.08],
          ],
          'trim',
        );
    }
  }
}
function pin(face, p, base, height, d) {
  const r = circle(p, d === 0 ? 0.19 : 0.26, d <= 1 ? 4 : 6);
  profile(
    face,
    r,
    d === 1
      ? [
          [base, 1],
          [base + height, 0.05],
        ]
      : [
          [base, 1],
          [base + height * 0.3, 0.8],
          [base + height * 0.55, 1.2],
          [base + height, 0.05],
        ],
    'trim',
  );
}
function tower(out, face, d, role, capRole) {
  const r = lowRing(ring(role), d),
    p = center(r),
    b = rectangle(r),
    holes = d >= 1 ? portoTowerFields(role) : [],
    inner = scaled(r, 0.74);
  shell(out, d, r, footing, 31, holes, 'wall', d >= 1 ? inner : null);
  cap(face, r, 23.5, 'trim');
  cap(face, r, 31, 'trim');
  if (d >= 1) {
    for (const h of holes) archBand(face, h, d, 0.18, 'trim', 0.07);
    for (const y of [1.1, 21.8, 30.6]) band(face, r, y, 0.25, 'trim', 1.025);
  }
  const dome = ring(capRole),
    cr = circle(center(dome), 3.15, d <= 1 ? 8 : 16);
  profile(
    face,
    cr,
    d <= 1
      ? [
          [31, 1.1],
          [32, 1.07],
          [34, 0.93],
          [35.5, 0.5],
          [36.2, 0.08],
        ]
      : [
          [31, 1.1],
          [31.45, 1.14],
          [32, 1.07],
          [33.3, 1],
          [34.5, 0.8],
          [35.6, 0.42],
          [36.2, 0.06],
        ],
    'trim',
  );
  pin(face, p, 36.2, 0.8, d);
  if (d >= 1) {
    for (const x of [b[0][0] + 0.3, b[0][1] - 0.3])
      for (const z of [b[1][0] + 0.3, b[1][1] - 0.3]) pin(face, [x, z], 31, 3.5, d);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 3) continue;
      beam(face, at(f.a, 32), at(f.b, 32), 0.16);
      const n = d === 1 ? 1 : 6;
      for (let j = 1; j < n; j++) {
        const p = lerp(f.a, f.b, j / n);
        solid(face, R(p[0] - 0.075, p[1] - 0.075, p[0] + 0.075, p[1] + 0.075), 31, 32, 'trim');
      }
    }
    if (d >= 2)
      for (const z of [p[1] - 2, p[1] + 2])
        solid(face, R(b[0][0] - 0.04, z - 0.11, b[0][0] + 0.04, z + 0.11), 11, 12.6, 'trim');
  }
}
function body(out, face, d) {
  const fields = portoFields(d),
    filter = writer(
      masked(
        out,
        fields.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  // The raw low envelope retains the map's fine buttress/projection footprint.
  solid(filter, lowRing(main, d), footing, 0.08, 'wall');
  if (d <= 1)
    solid(
      face,
      rec.controls.find((b) => b.id === 35185840817097).polygons[0].outline,
      footing,
      0.08,
      'wall',
    );
  for (const [role, eave, top, axis] of [
    ['northAisle', 14.7, 16, 0],
    ['southAisle', 14.7, 16, 0],
    ['nave', 19.7, 21, 0],
    ['northTransept', 19.7, 20, 1],
    ['southTransept', 19.7, 20, 1],
    ['choir', 19.5, 23, 0],
    ['crossing', 23.5, 26, 0],
    ['northEastChapel', 10.5, 13, 1],
    ['northEastFlank', 7.5, 9, 0],
  ]) {
    const r =
        role === 'nave'
          ? rec.plans.nave
          : role === 'crossing'
            ? rec.plans.crossing
            : role === 'northEastChapel'
              ? ring(role)
              : lowRing(ring(role), d),
      holes = fields.filter((h) =>
        h.name.startsWith(
          role === 'nave'
            ? 'nave'
            : role === 'choir'
              ? 'choir'
              : role.endsWith('Transept')
                ? 'transept'
                : 'NO',
        ),
      );
    shell(out, d, r, footing, eave, holes);
    if (role === 'nave' || role === 'choir') gable(filter, r, eave, top, 'roof', axis);
    else if (role === 'northEastChapel')
      profile(
        filter,
        r,
        [
          [eave, 1],
          [top, 0.03],
        ],
        'roof',
      );
    else hip(filter, r, eave, top, 'roof', axis);
    if (role.includes('Transept')) {
      band(face, r, 19.7, 0.3, 'trim', 1.025);
      crenels(face, coarse(r), 19.95, d, 2.4);
    }
  }
  const west = rec.plans.westFace;
  shell(
    out,
    d,
    west,
    footing,
    23,
    fields.filter((h) => h.name.startsWith('west')),
  );
  cap(face, west, 23, 'trim');
  crenels(face, west, 23, d, 1.8);
  for (const h of fields) {
    panel(face, h, d, h.kind === 'door' ? 'door' : 'glass');
  }
  const rose = fields.find((h) => h.name === 'west-rose');
  archBand(face, rose, d, 0.42, 'trim', 0.18);
  if (d >= 1) {
    const hood = hole('west-hood', [-33.05, -0.15], [0, 1], [-1, 0], 8, 11.4, 11, 6.9, 'round', 2);
    archBand(face, hood, d, 0.4, 'trim', 0.22);
    const p = prepareOpening(rose, 0, d);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        face,
        p.point(Math.cos(a) * 0.65, rose.bottom + 2.6 + Math.sin(a) * 0.65, 0.26),
        p.point(Math.cos(a) * 2.5, rose.bottom + 2.6 + Math.sin(a) * 2.5, 0.26),
        0.1,
      );
    }
    archBand(
      face,
      { ...rose, width: 1.35, height: 1.35, bottom: floor + 17.125 },
      d,
      0.13,
      'trim',
      0.28,
    );
    for (const z of [-3.45, 3.1])
      solid(face, R(-33.35, z - 0.24, -32.95, z + 0.24), 0, 20.8, 'trim');
    for (const y of [5.6, 7.4, 9.7]) {
      solid(face, R(-33.6, -3, -32.8, 2.7), y, y + 0.35, 'trim');
    }
    for (const z of [-2.1, 1.8])
      solid(face, R(-33.5, z - 0.21, -32.95, z + 0.21), 0.2, 8.9, 'trim');
    pin(face, [-33.25, -0.15], 9.9, 1.1, d);
    for (const b of rec.controls.filter((b) => b.properties.kind_detail === 'buttress'))
      solid(face, lowRing(b.polygons[0].outline, d), footing, b.properties.height, 'wall');
    for (const role of ['nave', 'northAisle', 'southAisle']) {
      const r = coarse(ring(role));
      band(face, r, role === 'nave' ? 19.7 : 14.7, 0.3, 'trim', 1.02);
      if (d >= 2 || role === 'nave') crenels(face, r, role === 'nave' ? 19.95 : 14.95, d, 2.8);
    }
  }
  for (let i = 0; i < (d === 0 ? 1 : 3); i++) {
    const n = d === 0 ? 1 : 3;
    solid(
      face,
      R(-35.5 + i * 0.65, -2.6, -32.85, 2.3),
      (p) => Math.min(-0.25, portoGround(...p) - 0.25),
      (floor * (i + 1)) / n - floor,
      'trim',
    );
  }
}
function loggia(out, face, d) {
  const r = ring('northLoggia'),
    b = rectangle(r),
    outer = d <= 1 ? R(b[0][0], b[1][0], b[0][1], b[1][1]) : r,
    holes = d >= 1 ? portoLoggiaFields() : [];
  // A shallow hollow gallery permits the front arches to read as open air.
  const inner = R(-24.3, -15.8, 2.7, -10.1);
  shell(out, d, outer, footing, 8.1, holes, 'wall', inner);
  cap(face, outer, 1.55, 'trim');
  hip(face, outer, 8.1, 9, 'trim', 0);
  if (d >= 1) {
    for (const h of holes) archBand(face, h, d, 0.25, 'trim', 0.1);
    band(face, outer, 7.8, 0.3, 'trim', 1.02);
    if (d >= 2) for (const x of [-24, -18.5, -13, -7.5, -2, 3]) pin(face, [x, -15.5], 8.3, 0.7, d);
    for (const x of [-21, -15.5, -10, -4.5, 1]) {
      face(
        'tile',
        [
          [x - 1.8, floor + 2, -9.72],
          [x + 1.8, floor + 2, -9.72],
          [x + 1.8, floor + 5.3, -9.72],
          [x - 1.8, floor + 5.3, -9.72],
        ],
        [0, 0, -1],
      );
    }
  }
  for (let i = 0; i < (d === 0 ? 1 : 5); i++) {
    const n = d === 0 ? 1 : 5;
    solid(
      face,
      R(-15, -19 + i * 0.65, -8, -15),
      (p) => Math.min(-0.3, portoGround(...p) - 0.2),
      (1.55 * (i + 1)) / n,
      'trim',
    );
  }
}
function cloister(out, face, d) {
  const cl = item('cloister').polygons[0],
    outer = lowRing(cl.outline, d),
    inside = cl.holes[0],
    holes = portoCloisterFields(d);
  shell(out, d, outer, footing, 9.1, holes, 'wall', inside);
  cap(face, outer, 9.15, 'trim', [inside]);
  // Ring roofs follow the open court; never cap the central courtyard.
  const B = rectangle(outer),
    I = rectangle(inside);
  for (const r of [
    R(B[0][0], B[1][0], B[0][1], I[1][0]),
    R(B[0][0], I[1][1], B[0][1], B[1][1]),
    R(B[0][0], I[1][0], I[0][0], I[1][1]),
    R(I[0][1], I[1][0], B[0][1], I[1][1]),
  ]) {
    const b = rectangle(r);
    hip(face, r, 9.15, 10, 'roof', b[0][1] - b[0][0] > b[1][1] - b[1][0] ? 0 : 1);
  }
  if (d >= 1) {
    band(face, inside, 8.8, 0.27, 'trim', 1);
    for (const r of [ring('eastCloister'), ring('chapter')]) band(face, r, 1, 0.25, 'trim');
  }
  for (const h of holes) {
    archBand(face, h, d, 0.2, 'trim', 0.04);
    if (d >= 3) {
      const small = { ...h, width: 1.15, height: 1.15, bottom: floor + 4.1, shape: 'circle' };
      archBand(face, small, d, 0.16, 'trim', -0.1);
    }
  }
  for (const role of ['eastCloister', 'chapter']) {
    const it = item(role),
      r = lowRing(it.polygons[0].outline, d),
      top = it.properties.height;
    const openings = [];
    if (d >= 2) {
      const b = rectangle(r);
      for (const x of [b[0][0], b[0][1]])
        for (let z = b[1][0] + 3; z < b[1][1] - 2; z += 4.8)
          openings.push(
            hole(
              `${role}-${x}-${z}`,
              [x, z],
              [0, 1],
              [x === b[0][0] ? -1 : 1, 0],
              1.15,
              top - 6,
              2.5,
              2.5,
              'rect',
              1,
            ),
          );
    }
    shell(out, d, r, footing, top - 2, openings);
    hip(face, r, top - 2, top, 'roof', 1);
    for (const h of openings) panel(face, h, d);
  }
  for (const id of rec.roles.southRanges) {
    const it = rec.controls.find((b) => b.id === id),
      r = lowRing(it.polygons[0].outline, d),
      top = it.properties.height;
    solid(face, r, footing, top - 2, 'wall');
    hip(face, r, top - 2, top, 'roof', 0);
  }
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
  tower(out, face, d, 'northTower', 'northCap');
  tower(out, face, d, 'southTower', 'southCap');
  loggia(out, face, d);
  cloister(out, face, d);
}
export const buildPortoSkyline = (o) => build(o, 0),
  buildPortoDistrict = (o) => build(o, 1),
  buildPortoStreet = (o) => build(o, 2),
  buildPortoCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const portoCathedralStudy = {
  id: 'porto_cathedral',
  key: 'porto_cathedral',
  title: 'Porto Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1441255',
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
    'Five existing shared256-square ashlar,granite,ceramic roof tile,plain wood and glazed tile graphs serve six material groups. Metric UVs,linear tints,flat normals,local blue-grey glazing.No embedded images,bespoke photograph textures or baked lighting.Blue-white tile panels are generic surface abstractions,not copies of narrative azulejos.',
  importReason:
    'Preserve Porto fortress twin capped towers,rose/portal facade,crenellated nave/transepts,red choir roofs,north open baroque loggia and immediate Gothic cloister/Casa do Cabido with open court in four browser LODs.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior based on four inspected pictures and standard viewer PMTiles/DEM. Roof and opening divisions,domes,portal sculpture and tile scenes simplified or estimated.Full interior,liturgical sculpture,exact narrative azulejos,engineering,hidden roof joins,current finish,terrace/door/step ground fit and physical phone/laptop timing unverified or excluded.Synthetic Mediterranean neighbors are style fixtures,not reconstructed Porto streets.',
    'Skyline retains twin capped towers,rose facade,long nave/transepts,low north gallery and open cloister court.District adds belfry openings,rose spokes,portal/loggia rhythm and crenellations.Street adds recessed lights and cloister arcades.Close-up/master add selected court tracery and parapet details.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-twin-towers-and-rose', [-74, 25, -12], [-29, 18, 0]),
    cam('north-loggia-and-transept', [-11, 16, -47], [-10, 8, -10]),
    cam('tower-domes-and-pinnacles', [-52, 47, 30], [-28, 30, 0]),
    cam('cloister-court-and-gothic-arcades', [-11, 15, 22], [-10, 5, 15]),
    cam('eastern-choir-and-chapel', [64, 36, -32], [18, 13, -1]),
    cam('roof-and-signed-plan', [0, 130, 0.1], [0, 10, 10]),
  ],
};

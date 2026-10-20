/** Tampere Cathedral: rough-stone rose gables, three unequal red spires and pedestrian gates. */
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
  '../../../content/worldgen/source/places/ud/udb/n0398_tampere_cathedral/',
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
  wall: '#c7c6b9',
  trim: '#d3c9b1',
  roof: '#bd7965',
  copper: '#85aaa0',
  door: '#6e5b43',
  louver: '#615c52',
  glass: '#55676b',
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
const footing = (p) => Math.min(floor - 0.3, tampereCathedralGround(...p) - 0.35);
export function tampereCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Tampere Cathedral footing outside retained terrain');
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
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline,
  plans = rec.plans,
  main = role('main');
const towerData = [
  { role: 'tall', wall: 42, tip: 68, b: 34.2, h: 5.4, s: 3.4, count: 3 },
  { role: 'middle', wall: 28, tip: 52, b: 21.5, h: 4.3, s: 2.7, count: 1 },
  { role: 'small', wall: 19.5, tip: 36, b: 15.2, h: 2.8, s: 1.7, count: 1 },
];
export function tampereTowerFields(d = 3) {
  return towerData.flatMap((t) => {
    const r = role(t.role);
    return r.flatMap((_, i) => {
      const f = faceFrame(r, i),
        count = d === 0 ? 1 : t.count;
      // The west/south faces of the short northeast tower are buried in the church roof.
      if (t.role === 'small' && f.normal[0] < 0.6 && f.normal[1] > -0.6) return [];
      return Array.from({ length: count }, (_, j) => ({
        ...hole(
          `${t.role}-belfry-${i}-${j}`,
          lerp(f.a, f.b, (j + 1) / (count + 1)),
          f.axis,
          f.normal,
          count === 3 ? 1.35 : t.role === 'middle' ? 3.0 : 1.75,
          t.b,
          t.h,
          t.s,
          'pointed',
          3,
        ),
        kind: 'louver',
        tower: t.role,
      }));
    });
  });
}
export function tampereCathedralFields(d = 3) {
  const f = [
    {
      ...hole('west-rose', [-18.62, -1.25], [0, 1], [-1, 0], 8.2, 10.8, 8.2, 8.2, 'circle', 3),
      kind: 'glass',
    },
    {
      ...hole('south-rose', [5.125, 17.3], [1, 0], [0, 1], 7.9, 10.7, 7.9, 7.9, 'circle', 3),
      kind: 'glass',
    },
  ];
  if (d >= 1) {
    for (let i = 0; i < 5; i++)
      f.push({
        ...hole(
          `south-lower-pointed-${i}`,
          [0.0 + i * 2.45, 17.3],
          [1, 0],
          [0, 1],
          1.35,
          1.9,
          3.0,
          1.9,
          'pointed',
          3,
        ),
        kind: 'glass',
      });
    for (const side of [-1, 1]) {
      const z = side < 0 ? -17.32 : 12.9;
      for (const x of side < 0 ? [-10.5, 10.5] : [-10.5, 14.8])
        f.push({
          ...hole(
            `side-light-${side}-${x}`,
            [x, z],
            [1, 0],
            [0, side],
            3.2,
            6.7,
            5.3,
            3.1,
            'pointed',
            3,
          ),
          kind: 'glass',
        });
    }
    for (const side of [-1, 1]) {
      const z = side < 0 ? -17.32 : 12.9;
      for (let i = 0; i < 3; i++)
        f.push({
          ...hole(
            `lower-side-${side}-${i}`,
            [-13 + i * 2.0, z],
            [1, 0],
            [0, side],
            1.05,
            1.9,
            2.3,
            1.5,
            'pointed',
            3,
          ),
          kind: 'glass',
        });
    }
    for (const z of [-7.5, 4.9])
      f.push({
        ...hole(
          `west-low-light-${z}`,
          [-20.15, z],
          [0, 1],
          [-1, 0],
          0.7,
          1.9,
          1.65,
          1.65,
          'rect',
          3,
        ),
        kind: 'glass',
      });
    for (const z of [-4.6, -3, -1.4, 0.2, 1.8])
      f.push({
        ...hole(
          `west-attic-slot-${z}`,
          [-18.62, z],
          [0, 1],
          [-1, 0],
          0.9,
          21.2,
          0.65,
          0.65,
          'rect',
          3,
        ),
        kind: 'louver',
      });
    for (const x of [1.8, 3.4, 5, 6.6, 8.2])
      f.push({
        ...hole(
          `south-attic-slot-${x}`,
          [x, 17.3],
          [1, 0],
          [0, 1],
          0.85,
          21.1,
          0.65,
          0.65,
          'rect',
          3,
        ),
        kind: 'louver',
      });
  }
  return f;
}
export function tamperePortalFields() {
  return [
    {
      ...hole(
        'west-main-portal',
        [-23.15, -1.1],
        [0, 1],
        [-1, 0],
        3.6,
        0.15,
        5.5,
        3.5,
        'pointed',
        3,
      ),
      kind: 'door',
    },
    {
      ...hole('west-gate', [-36.371, -1.96], [0, 1], [-1, 0], 2.65, 0.05, 3.3, 2.1, 'round', 12),
      kind: 'air',
    },
    {
      ...hole('south-gate', [-18.05, 29.2], [1, 0], [0, 1], 2.8, 0.05, 3.3, 2.05, 'pointed', 10),
      kind: 'air',
    },
  ];
}
function panel(face, h, d) {
  pane(
    face,
    h,
    d,
    d === 0 ? 0.06 : -0.27,
    h.kind === 'louver' ? 'louver' : h.kind === 'door' ? 'door' : 'glass',
  );
  if (d < 2) return;
  archBand(face, h, d, h.shape === 'circle' ? 0.25 : 0.24, 'trim', 0.09);
  const p = prepareOpening(h, 0, d),
    sign = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    front = (u, y, o = 0.13) => p.point(u, y, o * sign);
  if (h.shape === 'circle') {
    const r = h.width / 2,
      cy = h.bottom + r,
      lines = d >= 3 ? 7 : 5;
    for (let i = -lines + 1; i < lines; i++) {
      const off = (i * r) / lines,
        half = Math.sqrt(Math.max(0, r * r - off * off)) * 0.985;
      beam(face, front(off, cy - half), front(off, cy + half), 0.07, 'door');
      beam(face, front(-half, cy + off), front(half, cy + off), 0.07, 'door');
    }
  } else if (h.kind === 'louver') {
    for (let y = h.bottom + 0.35; y < h.bottom + h.spring - 0.1; y += d >= 3 ? 0.24 : 0.5)
      beam(face, front(-h.width * 0.43, y, -0.18), front(h.width * 0.43, y, -0.18), 0.06, 'louver');
  } else if (h.kind === 'glass') {
    beam(face, front(0, h.bottom), front(0, h.bottom + h.height * 0.8), 0.09, 'door');
    for (let y = h.bottom + 1; y < h.bottom + h.spring; y += 1.1)
      beam(face, front(-h.width * 0.44, y), front(h.width * 0.44, y), 0.065, 'door');
  } else if (h.kind === 'door') {
    beam(face, front(0, h.bottom, -0.2), front(0, h.bottom + h.spring, -0.2), 0.12, 'door');
  }
}
function spire(face, r, t, d) {
  const y = t.wall,
    top = t.tip,
    p = center(r),
    levels = [
      [y, 1.055],
      [y + (top - y) * 0.42, 0.52],
      [y + (top - y) * 0.445, 0.49],
      [top - 1.4, 0.026],
    ];
  profile(face, r, levels, 'roof');
  profile(
    face,
    r,
    [
      [top - 1.5, 0.045],
      [top, 0.008],
    ],
    'copper',
  );
  if (d >= 1) {
    const bandRing = scaled(r, 0.52);
    sides(face, bandRing, y + (top - y) * 0.42, y + (top - y) * 0.445, 'louver');
    if (t.role === 'tall')
      for (const q of r) {
        const p = lerp(center(r), q, 0.98),
          s = 0.8,
          ring = R(p[0] - s, p[1] - s, p[0] + s, p[1] + s);
        profile(
          face,
          ring,
          [
            [y, 1],
            [y + 5.2, 0.02],
          ],
          'roof',
        );
        profile(
          face,
          ring,
          [
            [y + 4.8, 0.07],
            [y + 5.6, 0.01],
          ],
          'copper',
        );
      }
  }
  if (d >= 2) {
    band(face, r, y - 0.3, 0.3, 'trim', 1.025);
    if (d >= 3)
      for (const q of r) beam(face, at(q, y + 0.05), at(lerp(p, q, 0.03), top - 1.4), 0.06, 'roof');
  }
}
function towers(out, face, d) {
  const fields = tampereTowerFields(d);
  for (const t of towerData) {
    const r = role(t.role),
      hs = fields.filter((h) => h.tower === t.role);
    if (d === 0) {
      solid(face, r, footing, t.wall, 'wall');
      for (const h of hs) panel(face, h, 0);
    } else {
      shell(out, d, r, footing, t.wall, hs, 'wall');
      cap(face, r, t.wall, 'wall');
      for (const h of hs) panel(face, h, d);
    }
    spire(face, r, t, d);
    if (d >= 1) {
      band(face, r, t.role === 'tall' ? 16.1 : 8.4, 0.3, 'trim', 1.014);
      const f = edge(r, [-1, 0]),
        h = {
          ...hole(
            `${t.role}-shaft-slit`,
            lerp(f.a, f.b, 0.5),
            f.axis,
            f.normal,
            0.75,
            t.role === 'tall' ? 18.2 : 10.1,
            3.4,
            3.4,
            'rect',
            1,
          ),
          kind: 'glass',
        };
      pane(face, h, d, 0.08);
      if (d >= 2) archBand(face, h, d, 0.18, 'trim', 0.1);
    }
  }
}
function body(out, face, d) {
  const fields = tampereCathedralFields(d),
    cut = writer(
      masked(
        out,
        fields.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  shell(out, d, role('body'), footing, 17.5, fields, 'wall');
  // Closed lower hip covers the mapped irregular plan beneath the intersecting gabled hall.
  hip(cut, role('body'), 17.5, 19.5, 'roof', 0);
  gable(cut, plans.nave, 17.5, 28, 'roof', 0);
  gable(cut, plans.south, 17.5, 28, 'roof', 1);
  gable(cut, plans.north, 17.5, 28, 'roof', 1);
  shell(out, d, plans.south, footing, 17.5, fields, 'wall');
  shell(out, d, plans.north, footing, 17.5, fields, 'wall');
  shell(out, d, role('sacristy'), footing, 12.5, fields, 'wall');
  gable(cut, role('sacristy'), 12.5, 20, 'roof', 0);
  for (const h of fields) panel(face, h, d);
  if (d >= 2) {
    const capRows = [
      ...[-4.6, -3, -1.4, 0.2, 1.8].map((z) => ({ p: [-18.81, z], normal: [-1, 0], axis: [0, 1] })),
      ...[1.8, 3.4, 5, 6.6, 8.2].map((x) => ({ p: [x, 17.49], normal: [0, 1], axis: [1, 0] })),
    ];
    for (const a of capRows) {
      const h = hole('attic-lintel', a.p, a.axis, a.normal, 1.1, 21.85, 0.24, 0.24, 'rect', 1);
      pane(face, h, d, 0.03, 'trim');
    }
    for (const z of [-9.2, 6.7]) {
      const r = R(-18.83, z - 0.23, -18.4, z + 0.23);
      solid(face, r, 0.2, 18, 'wall');
      profile(
        face,
        r,
        [
          [18, 1],
          [21, 0.1],
        ],
        'trim',
      );
    }
    for (const x of [-2.25, 12.5]) {
      const r = R(x - 0.32, 17.1, x + 0.32, 17.75);
      solid(face, r, footing, 14.5, 'wall');
      profile(
        face,
        r,
        [
          [14.5, 1],
          [18, 0.1],
        ],
        'trim',
      );
    }
    band(face, main, 1.15, 0.24, 'trim', 1.006);
  }
}
function porch(out, face, d) {
  const r = plans.porch,
    h = tamperePortalFields()[0];
  shell(out, d, r, footing, 6.3, [h], 'wall');
  const cut = writer(masked(out, [prepareOpening(h, 0, d)]), d);
  gable(cut, r, 6.3, 10, 'roof', 0);
  panel(face, h, d);
  const canopy = R(-20.15, -9.4, -18.15, 6.8);
  shell(
    out,
    d,
    canopy,
    footing,
    4.5,
    tampereCathedralFields(d).filter((h) => h.name.startsWith('west-low-light')),
    'wall',
  );
  hip(face, canopy, 4.5, 6.3, 'roof', 1);
  const p = plans.roundTurret.center,
    ring = Array.from({ length: d <= 1 ? 8 : 12 }, (_, i) => [
      p[0] + Math.cos((i * Math.PI * 2) / (d <= 1 ? 8 : 12)) * 2.1,
      p[1] + Math.sin((i * Math.PI * 2) / (d <= 1 ? 8 : 12)) * 2.1,
    ]);
  solid(face, ring, footing, 9.4, 'wall');
  profile(
    face,
    ring,
    [
      [9.4, 1.12],
      [14.4, 0.025],
    ],
    'roof',
  );
  profile(
    face,
    ring,
    [
      [14.2, 0.05],
      [14.8, 0.01],
    ],
    'copper',
  );
  if (d >= 2) {
    band(face, ring, 9.05, 0.25, 'trim', 1.08);
    for (let i = 0; i < ring.length; i++) {
      const f = faceFrame(ring, i),
        h = {
          ...hole(
            `stair-turret-slot-${i}`,
            lerp(f.a, f.b, 0.5),
            f.axis,
            f.normal,
            0.3,
            7.1,
            1.65,
            1.65,
            'rect',
            1,
          ),
          kind: 'glass',
        };
      pane(face, h, d, 0.06);
    }
  }
  if (d >= 1) {
    for (const z of [-4.7, 2.5]) {
      beam(face, at([-23.35, z], 6.3), at([-23.35, -1.1], 10), 0.2, 'trim');
    }
  }
  for (let i = 0; i < (d === 0 ? 1 : 3); i++) {
    const n = d === 0 ? 1 : 3;
    solid(
      face,
      R(-24.4 + i * 0.32, -3.25, -22.9, 1.05),
      -0.4,
      (floor * (i + 1)) / n - floor,
      'trim',
    );
  }
}
function gates(out, face, d) {
  const portal = tamperePortalFields(),
    west = role('westGate'),
    south = R(-20.71, 25.42, -15.42, 29.2),
    southWing = R(-15.42, 25.55, -11.23, 28.55);
  for (const [r, h, axis] of [
    [west, portal[1], 0],
    [south, portal[2], 1],
  ]) {
    shell(out, d, r, footing, 3.7, [h], 'wall');
    gable(face, r, 3.7, 5, 'roof', axis);
    if (d >= 1) archBand(face, h, d, 0.3, 'trim', 0.08);
  }
  solid(face, southWing, footing, 1.35, 'wall');
  hip(face, southWing, 1.35, 1.65, 'roof', 0);
  for (const w of plans.wallWings) {
    const r =
      w.axis === 0
        ? R(w.from, w.fixed - 0.3, w.to, w.fixed + 0.3)
        : R(w.fixed - 0.3, w.from, w.fixed + 0.3, w.to);
    solid(face, r, footing, 1.35, 'wall');
    gable(face, r, 1.35, 1.65, 'roof', w.axis);
  }
}
function apron(face, d) {
  const pave = (slot, p, n) =>
      face(
        slot,
        p,
        n,
        colors.trim.map((v) => v * 0.72),
      ),
    outer = plans.groundOuter,
    inner = plans.groundInner;
  cap(pave, inner, -floor, 'trim');
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      count =
        d === 0
          ? 1
          : Math.ceil(Math.hypot(outer[j][0] - outer[i][0], outer[j][1] - outer[i][1]) / 4);
    for (let k = 0; k < count; k++) {
      const a = lerp(inner[i], inner[j], k / count),
        b = lerp(inner[i], inner[j], (k + 1) / count),
        c = lerp(outer[i], outer[j], k / count),
        q = lerp(outer[i], outer[j], (k + 1) / count);
      pave(
        'trim',
        [
          [a[0], 0, a[1]],
          [b[0], 0, b[1]],
          [q[0], tampereCathedralGround(...q), q[1]],
          [c[0], tampereCathedralGround(...c), c[1]],
        ],
        [0, 1, 0],
      );
    }
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
  towers(out, face, d);
  porch(out, face, d);
  gates(out, face, d);
  apron(face, d);
}
export const buildTampereCathedralSkyline = (o) => build(o, 0),
  buildTampereCathedralDistrict = (o) => build(o, 1),
  buildTampereCathedralStreet = (o) => build(o, 2),
  buildTampereCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const tampereCathedralStudy = {
  id: 'N0398',
  key: 'tampere_cathedral',
  title: 'Tampere Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1236638',
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
    'Five existing shared256-square dry-stone,granite,ceramic tile,copper and plain wood graphs serve seven groups.Linear tints,metric UVs and flat architectural normals. Opaque timber louver panels use the trim slot.Local blue-grey PBR glazing;no embedded images,unique facade/photo maps or baked lighting.',
  importReason:
    'Preserve individual rough-stone west/south rose gables,three unequal red tapering spires with green tips,pointed louver panels,projecting portal/round turret,mapped sacristy and two gabled gatehouses in four browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    rec.groundOpeningBasis,
    'Medium-fi exterior from three inspected2017/2007/2012 pictures and standard viewer PMTiles/DEM. Current tower68 m part and retained whole64 m height conflict;both preserved,not independently resolved. Hidden roof/gable joins and lower-window/porch/enclosure divisions remain picture estimates. Glass art,fine stone details,complete park enclosure/paths/trees,interiors/bells and engineering excluded or simplified. Current finish,exact host-ground joins,absolute altitude and physical-device timing unverified.',
    'Skyline keeps three unequal spires,west/south rose gables,irregular red roofs,portal,round turret and two gate tunnels. District adds shared surfaces,front/side light rhythm,louver groups and roof bands. Street adds recessed apertures,lead-grid abstraction,trim and buttress caps. Closeup/master refine louver/lead spacing and sparse roof ribs. Regional Finnish log cabins are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-rose-portal-and-unequal-towers', [-69, 25, -2], [-18, 22, -2]),
    cam('south-rose-gable-and-stone-rhythm', [18, 24, 66], [1, 14, 14]),
    cam('tall-triple-louver-and-red-spire', [-39, 52, 39], [-17.7, 45, 11.3]),
    cam('western-gate-portal-and-round-turret', [-55, 9, 13], [-24, 6, 4]),
    cam('eastern-sacristy-and-third-spire', [61, 28, -35], [15, 17, -5]),
    cam('roof-and-signed-plan', [0, 140, 0.1], [0, 15, 0]),
  ],
};

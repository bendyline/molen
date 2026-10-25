/** Dresden Cathedral: rounded nave, two figure tiers and a single open onion-crowned tower. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/u3/u31/dresden_cathedral/',
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
  wall: '#aaa58d',
  trim: '#bcb59b',
  roof: '#747b7a',
  apron: '#bfc2b7',
  copper: '#68998b',
  door: '#6c513b',
  glass: '#4d6178',
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
const rect = (p, w, h) => [
  [p[0] - w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] + h / 2],
  [p[0] - w / 2, p[1] + h / 2],
];
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, dresdenGround(...p) - 0.35);
export function dresdenGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Dresden cathedral footing outside retained terrain');
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
function profile(face, r, levels, slot) {
  for (let i = 1; i < levels.length; i++) {
    const [b, a] = levels[i - 1],
      [t, c] = levels[i],
      lo = scaled(r, a),
      hi = scaled(r, c),
      s = sign(r);
    for (let j = 0; j < r.length; j++) {
      const k = (j + 1) % r.length;
      face(
        slot,
        [at(lo[j], b), at(lo[k], b), at(hi[k], t), at(hi[j], t)],
        [(r[k][1] - r[j][1]) * s, 0.1, (r[j][0] - r[k][0]) * s],
      );
    }
  }
  const [t, f] = levels.at(-1);
  if (f > 0) cap(face, scaled(r, f), t, slot);
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
        height: h.height + w,
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
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * 2 * Math.PI) / n),
    p[1] + r * Math.sin(offset + (i * 2 * Math.PI) / n),
  ]);
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
const H = rec.heights,
  rawRole = (name) => rec.controls.find((b) => b.id === rec.roles[name]),
  rawRing = (name) => rawRole(name).polygons[0].outline;
function convexEnvelope(r) {
  const points = r.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (p) => {
    const out = [];
    for (const q of p) {
      while (out.length > 1 && turn(out.at(-2), out.at(-1), q) <= 0) out.pop();
      out.push(q);
    }
    return out.slice(0, -1);
  };
  return [...half(points), ...half(points.toReversed())];
}
function outlineLod(r, tolerance) {
  const chain = (points) => {
    if (points.length <= 2) return points;
    const a = points[0],
      b = points.at(-1),
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    const length = Math.hypot(dx, dz) || 1;
    let max = 0,
      at = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const distance = Math.abs(dx * (a[1] - points[i][1]) - dz * (a[0] - points[i][0])) / length;
      if (distance > max) {
        max = distance;
        at = i;
      }
    }
    return max > tolerance
      ? [...chain(points.slice(0, at + 1)).slice(0, -1), ...chain(points.slice(at))]
      : [a, b];
  };
  const a = r.reduce((best, p, i) => (p[0] < r[best][0] ? i : best), 0);
  const b = r.reduce((best, p, i) => (p[0] > r[best][0] ? i : best), 0);
  const loop = [...r.slice(a), ...r.slice(0, a + 1)];
  const split = (b - a + r.length) % r.length;
  return [
    ...chain(loop.slice(0, split + 1)).slice(0, -1),
    ...chain(loop.slice(split)).slice(0, -1),
  ];
}
const ring = (r, d) => outlineLod(r, d >= 3 ? 0.18 : d >= 2 ? 0.4 : d ? 0.75 : 1.25),
  role = (n, d) => ring(n === 'upperBody' ? convexEnvelope(rawRing(n)) : rawRing(n), d),
  bodyRing = (d) =>
    ring(d < 3 ? convexEnvelope(rec.main.polygons[0].outline) : rec.main.polygons[0].outline, d);
const hole = (
  name,
  p,
  a,
  n,
  width,
  bottom,
  height,
  spring = height,
  shape = 'rect',
  depth = 5,
) => ({
  name,
  center: p,
  axis: a,
  normal: n,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape,
  depth,
});
function perimeter(r, n, offset = 0) {
  const fs = r.map((_, i) => faceFrame(r, i)),
    total = fs.reduce((s, f) => s + f.length, 0);
  return Array.from({ length: n }, (_, i) => {
    let t = (((i + 0.35) * total) / n + offset) % total;
    for (const f of fs) {
      if (t <= f.length) return { ...f, center: lerp(f.a, f.b, t / f.length) };
      t -= f.length;
    }
    return { ...fs.at(-1), center: fs.at(-1).b };
  });
}
const baseRing = (d) => scaled(role('towerLower', d), 1.18);
export const dresdenPortal = () =>
  hole('tower-base-closed-portal', [46.15, 0.05], [0, 1], [1, 0], 4.3, 0.1, 9.9, 7.4, 'round', 12);
export function dresdenWindows(d = 3) {
  return [
    ...perimeter(bodyRing(d), 28)
      .filter((f) => !(f.center[0] > 31 && Math.abs(f.center[1]) < 13))
      .map((f, i) =>
        hole(`lower-window-${i}`, f.center, f.axis, f.normal, 2.6, 8.0, 9.0, 7.4, 'round', 5),
      ),
    ...perimeter(role('upperBody', d), 18)
      .filter((f) => f.center[0] < 25)
      .map((f, i) =>
        hole(`upper-window-${i}`, f.center, f.axis, f.normal, 2.3, 31.0, 5.8, 4.7, 'round', 5),
      ),
  ];
}
export function dresdenBelfries() {
  return ['towerLower', 'towerMiddle'].flatMap((name, j) =>
    rawRing(name).flatMap((_, i) => {
      if (i % 2) return [];
      const f = faceFrame(rawRing(name), i);
      return [
        hole(
          `${name}-open-bay-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          Math.min(f.length * 0.7, j ? 2.5 : 3.0),
          j ? 52.0 : 28.5,
          j ? 12.2 : 17.6,
          j ? 10.6 : 15.8,
          'round',
          7,
        ),
      ];
    }),
  );
}
function panel(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.2 : 0.09, slot);
  if (d) archBand(face, h, d, 0.32, 'trim', 0.18);
  if (d >= 2 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -1.0 : 0.23));
    beam(face, [p[0], h.bottom + 0.2, p[1]], [p[0], h.bottom + h.spring - 0.2, p[1]], 0.12);
    if (d >= 3)
      for (const t of [0.35, 0.72])
        beam(
          face,
          [
            p[0] - h.axis[0] * h.width * 0.4,
            h.bottom + h.spring * t,
            p[1] - h.axis[1] * h.width * 0.4,
          ],
          [
            p[0] + h.axis[0] * h.width * 0.4,
            h.bottom + h.spring * t,
            p[1] + h.axis[1] * h.width * 0.4,
          ],
          0.1,
        );
  }
}
function oval(face, h, y, d) {
  const n = d >= 3 ? 20 : d >= 2 ? 12 : 8,
    p = (r, v) => [
      h.center[0] + h.axis[0] * r + h.normal[0] * 0.2,
      floor + y + v,
      h.center[1] + h.axis[1] * r + h.normal[1] * 0.2,
    ],
    inner = Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return p(0.85 * Math.cos(a), 1.1 * Math.sin(a));
    });
  face('glass', inner, [h.normal[0], 0, h.normal[1]]);
  if (d >= 2)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = (i * 2 * Math.PI) / n,
        b = (j * 2 * Math.PI) / n;
      face(
        'trim',
        [
          inner[i],
          inner[j],
          p(1.12 * Math.cos(b), 1.38 * Math.sin(b)),
          p(1.12 * Math.cos(a), 1.38 * Math.sin(a)),
        ],
        [h.normal[0], 0, h.normal[1]],
      );
    }
}
function hipped(face, r, eave, top, slot = 'roof') {
  const zs = r.map((p) => p[1]),
    xs = r.map((p) => p[0]),
    mid = (Math.min(...zs) + Math.max(...zs)) / 2,
    rad = (Math.max(...zs) - Math.min(...zs)) / 2,
    x0 = Math.min(...xs) + rad,
    x1 = Math.max(...xs) - rad;
  const ridge = (p) => [Math.max(x0, Math.min(x1, p[0])), mid];
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(
      slot,
      [at(r[i], eave), at(r[j], eave), at(ridge(r[j]), top), at(ridge(r[i]), top)],
      [0, 1, 0],
    );
  }
}
function pilaster(face, f, b, t, d, w = 0.6) {
  const p = f.center,
    a = f.axis,
    n = f.normal,
    r = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => [
      p[0] + (a[0] * u * w) / 2 + n[0] * (0.12 + v * 0.22),
      p[1] + (a[1] * u * w) / 2 + n[1] * (0.12 + v * 0.22),
    ]);
  solid(face, r, b, t, 'trim');
  if (d >= 3) {
    solid(face, scaled(r, 1.4), b, b + 0.45, 'trim');
    solid(face, scaled(r, 1.5), t - 0.5, t, 'trim');
  }
}
function railing(face, r, y, d, upper = false) {
  const n =
    d >= 3
      ? Math.ceil(
          r.reduce(
            (s, p, i) =>
              s + Math.hypot(p[0] - r[(i + 1) % r.length][0], p[1] - r[(i + 1) % r.length][1]),
            0,
          ) / 1.7,
        )
      : d >= 2
        ? 28
        : d
          ? 8
          : 0;
  if (!n) return;
  if (d === 1) sides(face, r, y + 0.85, y + 1.05, 'trim');
  else
    for (let i = 0; i < r.length; i++) {
      beam(face, at(r[i], y + 1.0), at(r[(i + 1) % r.length], y + 1.0), 0.22);
      if (d >= 2) beam(face, at(r[i], y + 0.1), at(r[(i + 1) % r.length], y + 0.1), 0.2);
    }
  for (const f of perimeter(r, n)) {
    if (!upper && f.center[0] > 33 && Math.abs(f.center[1]) < 10) continue;
    solid(face, rect(f.center, d >= 2 ? 0.17 : 0.26, d >= 2 ? 0.17 : 0.26), y, y + 1.0, 'trim');
  }
}
function figure(face, p, y, d) {
  if (d === 1) {
    solid(face, rect(p, 0.8, 0.8), y, y + 2.7, 'wall');
    solid(face, rect(p, 0.55, 0.55), y + 2.7, y + 3.35, 'wall');
    return;
  }
  if (d === 2) {
    solid(face, rect(p, 1.05, 1.05), y, y + 0.45, 'trim');
    profile(
      face,
      regular(p, 0.48, 4),
      [
        [y + 0.45, 1.15],
        [y + 2.5, 0.65],
      ],
      'wall',
    );
    solid(face, rect(p, 0.5, 0.5), y + 2.5, y + 3.35, 'wall');
    beam(
      face,
      [p[0] - 0.3, floor + y + 2.3, p[1]],
      [p[0] - 0.7, floor + y + 1.4, p[1] + 0.2],
      0.24,
      'wall',
    );
    return;
  }
  const n = 8;
  solid(face, rect(p, 1.05, 1.05), y, y + 0.45, 'trim');
  profile(
    face,
    regular(p, 0.48, n),
    [
      [y + 0.45, 1.15],
      [y + 1.0, 1.1],
      [y + 2.1, 0.65],
      [y + 2.5, 0.72],
    ],
    'wall',
  );
  profile(
    face,
    regular(p, 0.27, n),
    [
      [y + 2.45, 0.8],
      [y + 2.75, 1],
      [y + 3.15, 0.75],
      [y + 3.35, 0.15],
    ],
    'wall',
  );
  if (d >= 2) {
    beam(
      face,
      [p[0] - 0.3, floor + y + 2.3, p[1]],
      [p[0] - 0.7, floor + y + 1.4, p[1] + 0.2],
      0.24,
      'wall',
    );
    beam(
      face,
      [p[0] + 0.3, floor + y + 2.3, p[1]],
      [p[0] + 0.65, floor + y + 1.85, p[1] - 0.2],
      0.24,
      'wall',
    );
  }
}
function body(out, face, d) {
  const r = bodyRing(d),
    up = role('upperBody', d),
    ap = role('apron', d),
    windows = dresdenWindows(d),
    lower = windows.filter((h) => h.name.startsWith('lower')),
    upper = windows.filter((h) => h.name.startsWith('upper'));
  sides(face, r, footing, 0, 'wall');
  if (d) cap(face, r, 0, 'wall');
  if (d >= 2) shell(out, d, r, 0, H.lower, [dresdenPortal(), ...lower], 'wall');
  else solid(face, r, 0, H.lower, 'wall');
  const inside = new Set(ap);
  cap(face, r, (p) => floor + (inside.has(p) ? H.apron : 24.5), 'roof', [ap]);
  cap(face, ap, H.apron, 'apron');
  if (d >= 2) shell(out, d, up, H.apron, H.nave, upper, 'wall');
  else solid(face, up, H.apron, H.nave, 'wall');
  hipped(face, up, H.nave, H.naveRoof);
  const lowerRail = scaled(r, 0.98),
    upperRail = scaled(up, 1.01);
  if (d) {
    for (const [y, t] of d >= 2
      ? [
          [0.25, 0.4],
          [6.5, 0.25],
          [22.8, 0.7],
          [23.8, 0.65],
        ]
      : [
          [0.25, 0.4],
          [23.8, 0.65],
        ])
      band(face, r, y, t, 'trim', 1.01);
    for (const y of d >= 2 ? [H.apron, 39.3, 40.0] : [40.0]) band(face, up, y, 0.38, 'trim', 1.02);
    for (const h of windows) {
      panel(face, h, d, d >= 2);
      if (h.name.startsWith('upper')) oval(face, h, 38.4, d);
    }
    for (const f of perimeter(r, 28, 2.1).filter(
      (f) => !(f.center[0] > 31 && Math.abs(f.center[1]) < 13),
    )) {
      pilaster(face, f, 0.6, 23.5, d, 0.72);
    }
    for (const f of perimeter(up, 18, 2.05).filter((f) => f.center[0] < 25)) {
      pilaster(face, f, 30.1, 39.6, d, 0.55);
    }
    railing(face, lowerRail, 24.5, d);
    railing(face, upperRail, 40.4, d, true);
    const statues = rec.controls.filter(
      (b) =>
        [24, 47].includes(b.properties.min_height) &&
        b.properties.height - b.properties.min_height <= 6.1,
    );
    const chosen = d >= 2 ? statues : statues.filter((_, i) => i % 10 === 0);
    for (const b of chosen) {
      const upper = b.properties.min_height === 47,
        p = center(b.polygons[0].outline),
        r0 = upper ? up : r;
      const nearest = r0
        .map((_, i) => faceFrame(r0, i))
        .map((f) => {
          const e = f.b.map((v, k) => v - f.a[k]),
            len2 = e[0] * e[0] + e[1] * e[1],
            t = Math.max(0, Math.min(1, ((p[0] - f.a[0]) * e[0] + (p[1] - f.a[1]) * e[1]) / len2)),
            q = lerp(f.a, f.b, t);
          return { p: q, dist: Math.hypot(p[0] - q[0], p[1] - q[1]) };
        })
        .sort((a, b) => a.dist - b.dist)[0];
      figure(face, nearest.p, upper ? 41.4 : 25.5, d);
    }
  }
}
function tower(out, face, d) {
  const base = baseRing(d),
    portal = dresdenPortal();
  if (d >= 2) shell(out, d, base, 0, 24, [portal], 'wall');
  else solid(face, base, 0, 24, 'wall');
  panel(face, portal, d, d >= 2, 'door');
  for (const [name, b, t] of [
    ['towerLower', 24, 49.5],
    ['towerMiddle', 49.5, 67.5],
  ]) {
    const r = role(name, d),
      hs = dresdenBelfries(d).filter((h) => h.name.startsWith(name));
    if (d >= 2) shell(out, d, r, b, t, hs, 'wall', scaled(r, 0.55));
    else {
      solid(face, r, b, t, 'wall');
      if (d) for (const h of hs) pane(face, h, d, 0.13);
    }
    cap(face, r, b, 'wall');
    for (const y of [b, t - 0.8]) solid(face, scaled(r, 1.09), y, y + 0.65, 'trim');
    if (d) {
      for (const h of hs) archBand(face, h, d, 0.25, 'trim', 0.18);
      for (const q of r) {
        const rad = d >= 3 ? 0.28 : 0.35;
        solid(face, regular(q, rad, d >= 3 ? 12 : d >= 2 ? 8 : 4), b + 0.65, t - 0.8, 'trim');
      }
      if (d >= 2) railing(face, scaled(r, 1.08), t - 0.2, d, true);
    }
  }
  const up = role('towerUpper', d),
    u = center(up);
  solid(face, up, 67.5, 70.8, 'wall');
  profile(
    face,
    up,
    [
      [70.8, 1.0],
      [72.7, 0.8],
      [73.5, 0.9],
    ],
    'wall',
  );
  if (d) {
    for (const f of up.map((_, i) => faceFrame(up, i))) {
      const h = hole(
        'small-crown',
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        1.1,
        68.1,
        2.0,
        1.35,
        'round',
      );
      pane(face, h, d, 0.1);
      archBand(face, h, d, 0.15, 'trim', 0.2);
    }
    for (const q of scaled(up, 1.05)) {
      solid(face, regular(q, 0.25, d >= 2 ? 8 : 4), 67.5, 72.3, 'copper');
    }
  }
  const n = d >= 3 ? 24 : d >= 2 ? 16 : d ? 12 : 6,
    r = regular(u, 3.2, n);
  profile(
    face,
    r,
    d
      ? [
          [73.3, 0.72],
          [74.1, 1.0],
          [75.3, 1.15],
          [76.6, 1.13],
          [78.2, 0.9],
          [79.5, 0.55],
          [81.3, 0.27],
          [84, 0.18],
          [86, 0.01],
        ]
      : [
          [73.3, 0.72],
          [75.3, 1.15],
          [78.2, 0.9],
          [81.3, 0.27],
          [86, 0.01],
        ],
    'copper',
  );
  beam(face, [u[0], floor + 85.8, u[1]], [u[0], floor + 87.9, u[1]], d ? 0.13 : 0.22, 'trim');
  beam(
    face,
    [u[0] - 0.65, floor + 87.1, u[1]],
    [u[0] + 0.65, floor + 87.1, u[1]],
    d ? 0.12 : 0.2,
    'trim',
  );
  if (d) {
    for (const f of base.map((_, i) => faceFrame(base, i)))
      pilaster(face, { ...f, center: lerp(f.a, f.b, 0.1) }, 0.4, 23.0, d, 0.6);
    for (const y of [0.2, 11.4, 22.8]) band(face, base, y, 0.45, 'trim', 1.035);
    archBand(face, portal, d, 0.65, 'trim', 0.3);
  }
  const entry = [
    [46.0, -4.2],
    [48.1, -4.2],
    [48.1, 4.2],
    [46.0, 4.2],
  ];
  solid(face, entry, footing, 0, 'trim');
}
function build(out, d) {
  const stable = {
      addTriangle(slot, ref, points, _normal, uv, color) {
        const emit = (q, tex, depth = 0) => {
          q = q.map((p) => p.map(Math.fround));
          const spans = [0, 2].map(
            (k) => Math.max(...q.map((p) => p[k])) - Math.min(...q.map((p) => p[k])),
          );
          if (Math.max(...spans) > 16 && depth < 12) {
            const edges = [
                [0, 1, 2],
                [1, 2, 0],
                [2, 0, 1],
              ]
                .map(([i, j, k]) => ({
                  i,
                  j,
                  k,
                  len: Math.hypot(q[i][0] - q[j][0], q[i][2] - q[j][2]),
                }))
                .sort((a, b) => b.len - a.len),
              { i, j, k } = edges[0],
              mid = lerp(q[i], q[j], 0.5).map(Math.fround),
              tuv = lerp(tex[i], tex[j], 0.5);
            emit([q[i], mid, q[k]], [tex[i], tuv, tex[k]], depth + 1);
            emit([mid, q[j], q[k]], [tuv, tex[j], tex[k]], depth + 1);
            return;
          }
          if (
            Math.hypot(
              ...cross(
                q[1].map((v, k) => v - q[0][k]),
                q[2].map((v, k) => v - q[0][k]),
              ),
            ) < 1e-9
          )
            return;
          out.addTriangle(slot, ref, q, normalFor(...q), tex, color);
        };
        emit(points, uv);
      },
    },
    face = writer(stable, d);
  body(stable, face, d);
  tower(stable, face, d);
}
export const buildDresdenSkyline = (o) => build(o, 0),
  buildDresdenDistrict = (o) => build(o, 1),
  buildDresdenStreet = (o) => build(o, 2),
  buildDresdenCloseup = (o) => build(o, 3);
export const dresdenStudy = {
  id: 'dresden_cathedral',
  key: 'dresden_cathedral',
  title: 'Dresden Cathedral',
  category: 'cathedral',
  wikidataId: 'Q666935',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID parent and 86 current cathedral controls retain location, signed axis and raw plans without overall rescaling. The upper nave uses a reconstructed convex envelope; distant lower-body LODs use the parent outer envelope while the detailed master retains its mapped facade relief.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing 256-square sandstone/raw sandstone, standing-seam metal and wood graphs with metric UVs, linear tints, flat architecture normals/glass and no embedded images. Gray roofs, pale apron and green tower crown share one metal graph.',
  importReason:
    'Four browser levels retain the individual rounded nave/two statue tiers and single open onion-crowned tower at its signed Dresden location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Individual medium-fi current exterior from two inspected useful pictures and standard PMTiles/DEM. Upper wall/roof heights adjusted from flagged inconsistent map values. Figure positions project to the nearest reconstructed cornice;selected faceted figures,bands,pilasters,ovals,tower crown profiles and side/rear details are approximate. Exact sculptures/carved crests/inscriptions,full interiors,adjacent castle/covered connection and certified walking excluded. Physical device timings pending.',
    'Skyline preserves rounded lower/upper body envelopes, layered roofs, pale apron and a single stepped tower/onion-spike/cross; figures and glazing are omitted. District adds shared graphs, selected tall/oval glazing, pilasters, balustrades and five coarse figures. Street opens actual tower bays and recesses principal windows/closed portal; closeup refines curved profiles, frames, facade relief and figures. Bounded outline reduction preserves the curved ends. Detail changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'single-tower-and-rounded-two-tier-nave',
      position: [119, 54, 80],
      lookAt: [5, 34, 0],
      fov: 48,
    },
    {
      name: 'closed-portal-and-layered-tower-base',
      position: [72, 14, 21],
      lookAt: [42, 11, 0],
      fov: 48,
    },
    { name: 'stacked-open-tower-bays', position: [78, 61, 45], lookAt: [39, 49, 0], fov: 48 },
    {
      name: 'green-onion-crown-spike-and-cross',
      position: [73, 85, 31],
      lookAt: [39, 76, 0],
      fov: 48,
    },
    {
      name: 'upper-windows-ovals-and-figure-balustrade',
      position: [-2, 49, 52],
      lookAt: [-3, 36, 7],
      fov: 48,
    },
    {
      name: 'rounded-rear-and-layered-aisle-roofs',
      position: [-83, 53, -50],
      lookAt: [-15, 25, -3],
      fov: 48,
    },
  ],
};

/** Pristina: two tiered campaniles, rose and open porch over a mapped basilica. */
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
  '../../../content/worldgen/source/places/sr/srx/cathedral_of_saint_mother_teresa_in_pristina/',
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
  wall: '#e5dcc9',
  trim: '#eee8dc',
  roof: '#b16c4c',
  stone: '#abaaa0',
  door: '#80513b',
  glass: '#4d6178',
  metal: '#8a8d83',
  clock: '#d9ddcf',
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
const _rect = (p, w, h) => [
  [p[0] - w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] + h / 2],
  [p[0] - w / 2, p[1] + h / 2],
];
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, pristinaGround(...p) - 0.35);
export function pristinaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Pristina cathedral footing outside retained terrain');
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
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline;
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
      if (
        t >= -0.05 &&
        t <= 1.05 &&
        Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz) < 0.65
      ) {
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
const plan = (name) => rec[`${name}Plan`][0].outline;
const hole = (name, p, a, n, w, b, h, s = h, shape = 'round', depth = 5) => ({
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
function onFace(name, r, n, t, w, b, h, s = h, shape = 'round', depth = 5) {
  const f = edge(r, n);
  return hole(name, lerp(f.a, f.b, t), f.axis, f.normal, w, b, h, s, shape, depth);
}
function inside(p, r) {
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
const towerNames = ['clockTower', 'secondTower'];
function towerClear(h) {
  return !towerNames.some((name) =>
    [-0.4, 0, 0.4].some((t) =>
      inside(
        h.center.map((v, k) => v + h.normal[k] * 0.3 + h.axis[k] * h.width * t),
        role(name),
      ),
    ),
  );
}
export function pristinaWindows() {
  const holes = [];
  for (const side of [-1, 1]) {
    for (const x of [-2.2, 2.2, 6.6, 11, 15.4, 19.8, 24.2, 28.6])
      for (const a of [-0.83, 0.83])
        holes.push(
          hole(
            `clerestory-${side}-${x}-${a}`,
            [x + a, side === 1 ? 7.9 : -7.1],
            [1, 0],
            [0, side],
            1.22,
            15.4,
            4.2,
            3.45,
          ),
        );
    const f = edge(plan('body'), [0, side]);
    for (let i = 0; i < 8; i++) {
      const h = hole(
        `aisle-${side}-${i}`,
        lerp(f.a, f.b, (i + 0.5) / 8),
        f.axis,
        f.normal,
        1.75,
        2.2,
        4.7,
        3.8,
      );
      if (towerClear(h)) holes.push(h);
    }
    const tr = edge(plan('transept'), [0, side]);
    for (const t of [0.25, 0.5, 0.75])
      holes.push(
        hole(
          `transept-${side}-${t}`,
          lerp(tr.a, tr.b, t),
          tr.axis,
          tr.normal,
          2.1,
          11.5,
          7.5,
          6.25,
        ),
      );
  }
  const r = plan('apse');
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.normal[0] > 0.3 || f.length < 2.4) continue;
    holes.push(hole(`apse-${i}`, lerp(f.a, f.b, 0.5), f.axis, f.normal, 1.35, 9.2, 7.5, 6.3));
  }
  return holes;
}
export function pristinaDoors() {
  const hs = [onFace('main-door', plan('nave'), [1, 0], 0.5, 3.8, 0.1, 9, 7.1)];
  const r = plan('body');
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i),
      p = lerp(f.a, f.b, 0.5);
    if (f.normal[0] > 0.9 && f.length > 4 && f.length < 7 && p[0] > 30 && Math.abs(p[1]) > 8)
      hs.push(hole(`side-front-door-${i}`, p, f.axis, f.normal, 1.9, 0.1, 6, 4.8));
  }
  return hs;
}
export function pristinaPorch() {
  const r = plan('porch');
  return {
    r,
    inner: scaled(r, 0.8),
    holes: [
      onFace('porch-front', r, [1, 0], 0.5, 8.2, 0.1, 13.6, 9.5, 'round', 18),
      ...[-1, 1].map((side) => onFace(`porch-side-${side}`, r, [0, side], 0.5, 3.2, 0.1, 9.2, 7.6)),
    ],
  };
}
export function pristinaRose(d = 3) {
  const f = edge(plan('nave'), [1, 0]),
    center = lerp(f.a, f.b, 0.5),
    cy = floor + 22,
    r = 2.35,
    n = d >= 3 ? 32 : d >= 2 ? 20 : 12,
    axis = f.axis,
    normal = f.normal,
    point = (u, v, off) => [
      center[0] + axis[0] * u + normal[0] * off,
      cy + v,
      center[1] + axis[1] * u + normal[1] * off,
    ],
    ring = Array.from({ length: n }, (_, i) => [
      r * Math.cos((i * 2 * Math.PI) / n),
      r * Math.sin((i * 2 * Math.PI) / n),
    ]),
    dot = (a, b) => a.reduce((n, v, k) => n + v * b[k], 0),
    planes = [
      [normal[0], 0, normal[1], 2 - dot(normal, center)],
      [-normal[0], 0, -normal[1], 2 + dot(normal, center)],
    ];
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n],
      du = b[0] - a[0],
      dv = b[1] - a[1];
    planes.push([
      -dv * axis[0],
      du,
      -dv * axis[1],
      dv * dot(axis, center) - du * cy + dv * a[0] - du * a[1],
    ]);
  }
  return {
    name: 'front-rose',
    center,
    cy,
    r,
    axis,
    normal,
    point,
    ring,
    planes,
    bounds: [
      [center[0] - 3, center[0] + 3],
      [cy - r, cy + r],
      [center[1] - r - 1, center[1] + r + 1],
    ],
  };
}
function panel(face, h, d, slot = 'glass', flat = false) {
  pane(face, h, d, flat ? 0.12 : -1.15, slot);
  if (d >= 2) archBand(face, h, d, 0.19, 'trim', 0.16);
}
function fanRoof(face, r, ct, b, t, slot = 'roof') {
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(slot, [at(r[i], b), at(r[j], b), at(ct, t)], [0, 1, 0]);
  }
}
function roofTrim(face, r, eave, top, axis, d) {
  if (d < 2) return;
  for (const n of [-1, 1]) {
    const f = edge(coarse(r), axis === 0 ? [n, 0] : [0, n]),
      m = lerp(f.a, f.b, 0.5);
    beam(face, at(f.a, eave), at(m, top), 0.33, 'trim');
    beam(face, at(m, top), at(f.b, eave), 0.33, 'trim');
    if (d >= 3)
      for (let i = 1; i < 8; i++) {
        const t = i / 8,
          p = lerp(f.a, f.b, t),
          y = eave + (top - eave) * (1 - Math.abs(t * 2 - 1)) - 0.45;
        solid(face, R(p[0] - 0.12, p[1] - 0.12, p[0] + 0.12, p[1] + 0.12), y - 0.3, y, 'trim');
      }
  }
}
function frontRose(face, d) {
  if (!d) return;
  const h = pristinaRose(d),
    pt = (q, r, off) => h.point((q[0] * r) / h.r, (q[1] * r) / h.r, off);
  face(
    'glass',
    h.ring.map((q) => h.point(...q, d >= 2 ? -1.15 : 0.12)),
    [h.normal[0], 0, h.normal[1]],
  );
  for (let i = 0; i < h.ring.length; i++) {
    const a = h.ring[i],
      b = h.ring[(i + 1) % h.ring.length];
    face(
      'trim',
      [pt(a, h.r + 0.34, 0.19), pt(b, h.r + 0.34, 0.19), pt(b, h.r, 0.19), pt(a, h.r, 0.19)],
      [h.normal[0], 0, h.normal[1]],
    );
    if (d >= 2)
      face('trim', [pt(a, h.r, 0.19), pt(b, h.r, 0.19), pt(b, h.r, -1.1), pt(a, h.r, -1.1)]);
  }
  if (d >= 2) {
    const n = d >= 3 ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      beam(
        face,
        h.point(0.62 * Math.cos(a), 0.62 * Math.sin(a), 0.2),
        h.point((h.r - 0.15) * Math.cos(a), (h.r - 0.15) * Math.sin(a), 0.2),
        0.11,
        'trim',
      );
    }
    for (let i = 0; i < h.ring.length; i++) {
      const a = h.ring[i],
        b = h.ring[(i + 1) % h.ring.length];
      face(
        'trim',
        [pt(a, 0.57, 0.21), pt(b, 0.57, 0.21), pt(b, 0.73, 0.21), pt(a, 0.73, 0.21)],
        [h.normal[0], 0, h.normal[1]],
      );
    }
  }
}
function body(out, face, d) {
  const hs = pristinaWindows(),
    doors = pristinaDoors(),
    rose = pristinaRose(d),
    p = pristinaPorch(),
    base = d === 0 ? footing : 0.1;
  const platform = role('lowerPlatform');
  solid(face, d <= 1 ? coarse(platform) : platform, footing, 0.1, 'stone');
  if (d >= 2) solid(face, role('main'), footing, 0.1, 'stone');
  // The main raw outline has an explicit front porch; it is not filled with a solid aisle mass.
  for (const r0 of rec.bodyPlan) {
    const r = d <= 1 ? coarse(r0.outline) : r0.outline;
    if (d >= 2) shell(out, d, r, 0.1, 11, [...hs, ...doors]);
    else sides(face, r, footing, 11, 'wall');
  }
  const roseOut = d >= 2 ? masked(out, [rose]) : out,
    roseFace = writer(roseOut, d);
  for (const [name, eave, top, axis] of [
    ['nave', 21, 28, 0],
    ['transept', 21, 28, 1],
  ]) {
    const r = d <= 1 ? coarse(plan(name)) : plan(name),
      holes = hs
        .filter((h) => h.name.startsWith(name === 'nave' ? 'clerestory' : 'transept'))
        .concat(name === 'nave' ? [doors[0]] : []);
    if (d >= 2) shell(roseOut, d, r, 0.1, eave, holes);
    else sides(face, r, base, eave, 'wall');
    gable(roseFace, r, eave, top, 'roof', axis);
    if (d) band(face, r, eave - 0.22, 0.3, 'trim', 1.008);
    roofTrim(face, r, eave, top, axis, d);
  }
  const apse = d <= 1 ? coarse(plan('apse')) : plan('apse');
  if (d >= 2)
    shell(
      out,
      d,
      apse,
      0.1,
      20,
      hs.filter((h) => h.name.startsWith('apse')),
    );
  else sides(face, apse, base, 20, 'wall');
  fanRoof(face, apse, [-30.9, 0.35], 20, 26);
  if (d) band(face, apse, 19.8, 0.3, 'trim', 1.02);
  for (const q of rec.lowerRoofs) {
    const r = d <= 1 ? coarse(q.outline) : q.outline,
      ys = r.map((p) => Math.abs(p[1])),
      max = Math.max(...ys),
      y = (pt) =>
        floor +
        11 +
        4 * (1 - Math.min(1, Math.max(0, (Math.abs(pt[1] - 0.4) - 7.5) / Math.max(1, max - 7.5))));
    cap(face, r, y, 'roof', q.holes);
  }
  const porch = d <= 1 ? coarse(p.r) : p.r;
  if (d >= 1) shell(out, d, porch, 0.1, 14, p.holes, 'trim', p.inner);
  else {
    for (const q of porch) {
      sides(face, R(q[0] - 0.35, q[1] - 0.35, q[0] + 0.35, q[1] + 0.35), footing, 14, 'trim');
    }
    band(face, porch, 13.5, 0.5, 'trim', 1.01);
  }
  // Front arch removes the wall at the back of the porch; the separate nave door is closed wood.
  const porchFace =
    d >= 1
      ? writer(
          masked(
            out,
            p.holes.map((h) => prepareOpening(h, 0, d)),
          ),
          d,
        )
      : face;
  gable(porchFace, porch, 14, 21, 'roof');
  roofTrim(face, porch, 14, 21, 0, d);
  if (d) {
    for (const h of hs) panel(face, h, d, 'glass', d === 1);
    for (const h of doors) panel(face, h, d, 'door', d === 1);
    frontRose(face, d);
  }
  if (d >= 2) {
    for (const side of [-1, 1])
      for (const x of [0, 4.4, 8.8, 13.2, 17.6, 22, 26.4, 30.2]) {
        const z = side === 1 ? 8.05 : -7.25;
        beam(face, at([x, z], 14.9), at([x, z], 21), 0.25, 'trim');
      }
    for (const side of [-1, 1]) {
      const f = edge(porch, [1, 0]),
        q = lerp(f.a, f.b, side === 1 ? 0.13 : 0.87);
      solid(face, R(q[0] - 0.35, q[1] - 0.35, q[0] + 0.35, q[1] + 0.35), 0.1, 9.7, 'trim');
      solid(face, R(q[0] - 0.52, q[1] - 0.52, q[0] + 0.52, q[1] + 0.52), 9.7, 10.1, 'trim');
    }
  }
  stairs(face, d);
}
export function pristinaStages(d = 3) {
  return towerNames.map((name) => {
    const r = d <= 1 ? coarse(role(name)) : role(name),
      holes = [],
      covered = [];
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 4) continue;
      for (const [b, h, w] of [
        [12.5, 10, 0.47],
        [25.8, 9, 0.47],
        [47, 8.9, 0.47],
        [58, 8.4, 0.34],
      ]) {
        for (const t of [b === 58 ? 0.28 : 0.5, ...(b === 58 ? [0.72] : [])]) {
          const aperture = hole(
            `${name}-${i}-${b}-${t}`,
            lerp(f.a, f.b, t),
            f.axis,
            f.normal,
            f.length * w,
            b,
            h,
            h - f.length * w * 0.5,
            'round',
            5,
          );
          // The rear face of the lower tier meets the tall transept wall.
          const meetsTransept = [-0.4, 0, 0.4].some((t) =>
            inside(
              aperture.center.map(
                (v, k) => v + aperture.normal[k] * 0.35 + aperture.axis[k] * aperture.width * t,
              ),
              plan('transept'),
            ),
          );
          (b === 12.5 && meetsTransept ? covered : holes).push(aperture);
        }
      }
    }
    return { name, r, center: center(r), holes, covered };
  });
}
function cornice(face, r, y, d) {
  const outer = scaled(r, 1.1),
    inner = r;
  sides(face, outer, y, y + 0.55, 'trim');
  cap(face, outer, y + 0.55, 'trim', [inner]);
  if (d >= 2) sides(face, scaled(r, 1.04), y - 0.25, y, 'trim');
}
/** Low-detail wall panels retain solid piers and real arches without prism booleans. */
function districtTowerWalls(face, g) {
  const inner = scaled(g.r, 0.86);
  for (let i = 0; i < g.r.length; i++) {
    const f = faceFrame(g.r, i),
      back = faceFrame(inner, i),
      hs = g.holes.filter((h) => h.name.startsWith(`${g.name}-${i}-`)),
      project = (h, q, plane) => {
        const p = h.center.map((v, k) => v + h.axis[k] * q[0]);
        return [p.reduce((n, v, k) => n + (v - plane.a[k]) * plane.axis[k], 0), q[1]];
      };
    for (const [plane, inward] of [
      [f, false],
      [back, true],
    ]) {
      const points = [
          [0, floor + 0.1],
          [plane.length, floor + 0.1],
          [plane.length, floor + 67.2],
          [0, floor + 67.2],
        ],
        starts = [];
      for (const h of hs) {
        starts.push(points.length);
        points.push(...openingShape(h, 1).map((q) => project(h, q, plane)));
      }
      const ids = earcut(points.flat(), starts, 2),
        normal = plane.normal.map((v) => v * (inward ? -1 : 1));
      for (let j = 0; j < ids.length; j += 3)
        face(
          'wall',
          ids
            .slice(j, j + 3)
            .map((k) => [
              plane.a[0] + plane.axis[0] * points[k][0],
              points[k][1],
              plane.a[1] + plane.axis[1] * points[k][0],
            ]),
          [normal[0], 0, normal[1]],
        );
    }
    for (const h of hs) {
      const ring = openingShape(h, 1),
        offset = back.a.reduce((n, v, k) => n + (v - h.center[k]) * h.normal[k], 0),
        point = (q, off) => [
          h.center[0] + h.axis[0] * q[0] + h.normal[0] * off,
          q[1],
          h.center[1] + h.axis[1] * q[0] + h.normal[1] * off,
        ];
      for (let j = 0; j < ring.length; j++) {
        const a = ring[j],
          b = ring[(j + 1) % ring.length];
        face('wall', [point(a, 0), point(b, 0), point(b, offset), point(a, offset)]);
      }
    }
  }
}
function towers(out, face, d) {
  for (const g of pristinaStages(d)) {
    const r = g.r,
      inner = scaled(r, 0.68);
    solid(face, r, footing, 0.1, 'stone');
    if (d === 0) {
      for (const q of coarse(r))
        sides(face, R(q[0] - 0.52, q[1] - 0.52, q[0] + 0.52, q[1] + 0.52), footing, 67.2, 'wall');
      sides(face, r, footing, 12.5, 'wall');
      solid(face, r, 36.5, 46.5, 'wall');
    } else if (d === 1) {
      districtTowerWalls(face, g);
    } else {
      shell(
        out,
        d,
        r,
        0.1,
        57.6,
        g.holes.filter((h) => h.bottom < floor + 58),
        'wall',
        inner,
      );
      shell(
        out,
        d,
        r,
        57.6,
        67.2,
        g.holes.filter((h) => h.bottom >= floor + 58),
        'wall',
        scaled(r, 0.86),
      );
    }
    for (const y of [12, 24, 35.9, 46.1, 57.4, 67.0]) {
      if (d) cornice(face, r, y, d);
      else band(face, r, y, 0.55, 'trim', 1.1);
      if (d || y === 67) cap(face, r, y + 0.1, 'trim');
    }
    const top = scaled(r, 1.1);
    hip(face, top, 67.6, 68.5, 'roof');
    beam(face, at(g.center, 68.5), at(g.center, 70), d >= 2 ? 0.11 : 0.16, 'metal');
    beam(
      face,
      [g.center[0] - 0.55, floor + 69.4, g.center[1]],
      [g.center[0] + 0.55, floor + 69.4, g.center[1]],
      0.11,
      'metal',
    );
    if (d >= 2) {
      const y = floor + 58.7,
        rr = scaled(r, 1.15);
      for (let i = 0; i < rr.length; i++) {
        const a = rr[i],
          b = rr[(i + 1) % rr.length];
        beam(face, at(a, 57.95), at(a, 59.05), 0.06, 'metal');
        beam(face, at(a, 59.05), at(b, 59.05), 0.06, 'metal');
        if (d >= 3) {
          const q = lerp(a, b, 0.5);
          beam(face, [q[0], y - 0.75, q[1]], [q[0], y + 0.35, q[1]], 0.05, 'metal');
        }
      }
    }
    if (d) clockFields(face, g, d);
  }
}
function clockFields(face, g, d) {
  const r = coarse(g.r);
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i),
      p = lerp(f.a, f.b, 0.5),
      cy = floor + 41.2,
      n = d >= 3 ? 24 : 12,
      rad = 1.28,
      pt = (u, v, off) => [
        p[0] + f.axis[0] * u + f.normal[0] * off,
        cy + v,
        p[1] + f.axis[1] * u + f.normal[1] * off,
      ],
      ring = Array.from({ length: n }, (_, k) => [
        Math.cos((k * 2 * Math.PI) / n),
        Math.sin((k * 2 * Math.PI) / n),
      ]);
    face(
      'clock',
      ring.map((q) => pt(q[0] * rad, q[1] * rad, 0.08)),
      [f.normal[0], 0, f.normal[1]],
      g.name === 'secondTower' ? colors.stone : colors.clock,
    );
    for (let k = 0; k < n; k++) {
      const a = ring[k],
        b = ring[(k + 1) % n];
      face(
        'trim',
        [
          pt(a[0] * (rad + 0.22), a[1] * (rad + 0.22), 0.15),
          pt(b[0] * (rad + 0.22), b[1] * (rad + 0.22), 0.15),
          pt(b[0] * rad, b[1] * rad, 0.15),
          pt(a[0] * rad, a[1] * rad, 0.15),
        ],
        [f.normal[0], 0, f.normal[1]],
      );
    }
    if (g.name !== 'clockTower') continue;
    beam(face, pt(0, 0, 0.2), pt(0.1, 1.0, 0.2), 0.09, 'metal');
    beam(face, pt(0, 0, 0.2), pt(-0.7, 0.3, 0.2), 0.1, 'metal');
    if (d >= 3)
      for (let k = 0; k < 12; k++) {
        const a = (k * 2 * Math.PI) / 12;
        beam(
          face,
          pt(0.98 * Math.sin(a), 0.98 * Math.cos(a), 0.18),
          pt(1.15 * Math.sin(a), 1.15 * Math.cos(a), 0.18),
          0.055,
          'metal',
        );
      }
  }
}
function stairs(face, d) {
  const f = edge(plan('porch'), [1, 0]),
    mid = lerp(f.a, f.b, 0.5),
    w = 7.5,
    len = 7,
    steps = d === 0 ? 1 : d === 1 ? 5 : 10,
    point = (u, v) => mid.map((x, k) => x + f.axis[k] * u + f.normal[k] * v),
    lower = Math.min(...[-w, w].map((u) => pristinaGround(...point(u, len))));
  for (let i = 0; i < steps; i++) {
    const a = (i * len) / steps,
      b = ((i + 1) * len) / steps,
      top = 0.1 - ((floor + 0.1 - lower) * i) / steps,
      r = [point(-w, a), point(w, a), point(w, b), point(-w, b)];
    cap(face, r, top, 'stone');
    const ends = [r[2], r[3]],
      next = i + 1 === steps ? lower - floor : 0.1 - ((floor + 0.1 - lower) * (i + 1)) / steps;
    face(
      'stone',
      [at(ends[0], next), at(ends[1], next), at(ends[1], top), at(ends[0], top)],
      [f.normal[0], 0, f.normal[1]],
    );
    for (const k of [0, 1]) {
      const a = r[k],
        b = r[k === 0 ? 3 : 2];
      face('stone', [at(a, footing), at(b, footing), at(b, top), at(a, top)]);
    }
  }
}
function build(out, d) {
  const base = writer(out, d),
    face = (slot, p, n, col) => {
      const max = d === 0 ? 40 : d === 1 ? 24 : 16;
      function split(t) {
        const edges = t.map((a, i) => Math.hypot(...a.map((v, k) => v - t[(i + 1) % 3][k]))),
          len = Math.max(...edges),
          i = edges.indexOf(len);
        if (len <= max) {
          base(slot, t, n, col);
          return;
        }
        const j = (i + 1) % 3,
          k = (i + 2) % 3,
          m = lerp(t[i], t[j], 0.5);
        split([t[i], m, t[k]]);
        split([m, t[j], t[k]]);
      }
      for (let i = 1; i < p.length - 1; i++) split([p[0], p[i], p[i + 1]]);
    };
  body(out, face, d);
  towers(out, face, d);
}
export const buildPristinaSkyline = (o) => build(o, 0),
  buildPristinaDistrict = (o) => build(o, 1),
  buildPristinaStreet = (o) => build(o, 2),
  buildPristinaCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const pristinaStudy = {
  id: 'cathedral_of_saint_mother_teresa_in_pristina',
  key: 'cathedral_of_saint_mother_teresa_in_pristina',
  title: 'Cathedral of Saint Mother Teresa in Pristina',
  category: 'cathedral',
  wikidataId: 'Q1115637',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way and four current unscaled building controls; signed front porch/rose, rear apse and two tower plans.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing256-square ashlar,raw limestone,ceramic tile,granite and plain wood graphs. Pale coursed stone,light trim,terracotta roof,brown doors and flat blue-gray glazing use linear tints and metric UVs. Clock fields/metal are flat PBR colors;no embedded images or baked shading.',
  importReason:
    'Four browser levels retain the two tiered open campaniles,front rose/open porch,red-roofed basilica and mapped rear/low platform at the signed Pristina location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three useful pictures and standard viewer PMTiles/DEM. August2025 two-tower state supersedes older single-tower construction images. Nave/transept/apse/aisle/porch proportions,stage divisions,paired windows,rose,corbels and steps are picture-led estimates. Rear apse and low platform/basement facades/functions are map-led approximations. Exact lettering,sculpture,clock numerals,stained-glass pictures,full interiors and certified walking excluded. Absolute thresholds/altitude and physical device timings pending.',
    'Skyline retains two open tiered four-post towers,clock body,shallow caps/crosses,red-roofed basilica/apse/transept,coarse porch piers and inclined entry. District adds shared surfaces,flat windows/doors,front rose and clock fields,real open porch and solid-pier arched tower panels. Street cuts actual paired windows,rose and tower walls,adds sparse pilasters/cornices/railings and stepped entry. Paired top openings use wider bays and thinner upper masonry than the single-bay lower stages. All tower feet follow the coarse terrain. Closeup/master refine curves,rose spokes/corbels/clock marks/rail uprights. Openings,ornament and small roof profiles change visibly. Synthetic Swedish-cottage neighbors are not local mapped buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('two-completed-campaniles', [75, 57, 90], [-4, 48, -2]),
    cam('front-rose-and-open-porch', [96, 24, 14], [32, 16, 0]),
    cam('paired-clerestory-and-red-aisle-roof', [26, 24, 62], [12, 16, 7]),
    cam('rear-apse-and-transept', [-81, 32, 50], [-22, 16, 0]),
    cam('low-platform-and-second-tower', [47, 20, -88], [8, 10, -15]),
    cam('entry-stairs-and-porch-tunnel', [65, 9, 14], [34, 5, 0]),
  ],
};

/** Monza Cathedral: striped stepped front, six pinnacles, brick campanile and green crossing. */
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
  '../../../content/worldgen/source/places/u0/u0n/monza_cathedral/',
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
  wall: '#b48b76',
  facade: '#e1e1d5',
  stripe: '#66756f',
  trim: '#d3d2c3',
  roof: '#a87760',
  metal: '#799a8a',
  door: '#745a41',
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
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, monzaCathedralGround(...p) - 0.35);
export function monzaCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Monza Cathedral footing outside retained terrain');
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
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline;
const main = role('main'),
  plans = rec.plans,
  frontX = -23.5,
  backX = -20.3;
const ridge = [
  [-18.4, 23.7],
  [-17.32, 24.5],
  [-11.77, 28],
  [-6.91, 32],
  [-1.67, 36],
  [3.56, 32],
  [8.84, 28],
  [15.28, 24.5],
  [16.65, 23.7],
];
export function monzaFacadeHeight(z) {
  for (let i = 1; i < ridge.length; i++)
    if (z <= ridge[i][0]) {
      const a = ridge[i - 1],
        b = ridge[i];
      return a[1] + ((b[1] - a[1]) * (z - a[0])) / (b[0] - a[0]);
    }
  return ridge.at(-1)[1];
}
export function monzaCathedralFields(d = 3) {
  const fields = [],
    f = (name, z, w, b, h, s, shape = 'pointed', kind = 'glass') =>
      fields.push({ ...hole(name, [frontX, z], [0, 1], [-1, 0], w, b, h, s, shape, 5), kind });
  f('central-portal', -1.67, 4.3, 0.2, 7.1, 5.1, 'round', 'door');
  f('central-spoke-rose', -1.67, 6.9, 14, 6.9, 6.9, 'circle');
  if (d >= 1) {
    for (const [i, z] of [-14.5, -9.35, 6.2, 12.5].entries())
      f(
        `small-oculus-${i}`,
        z,
        i === 1 || i === 2 ? 2.55 : 2.4,
        i === 1 || i === 2 ? 23 : 12.8,
        i === 1 || i === 2 ? 2.55 : 2.4,
        2.4,
        'circle',
      );
    for (const [i, z] of [-9.35, 6.2].entries())
      f(`pointed-front-light-${i}`, z, 2.7, 5.4, 7.6, 5.3);
    for (const [i, z] of [-14.5, 12.5].entries())
      f(`outer-front-light-${i}`, z, 2.35, 4.5, 5.5, 3.8);
  }
  return fields;
}
export function monzaBelfryFields() {
  return role('tower').map((_, i) => {
    const f = faceFrame(role('tower'), i);
    return hole(
      `campanile-belfry-${i}`,
      lerp(f.a, f.b, 0.5),
      f.axis,
      f.normal,
      4.65,
      52,
      8.25,
      5.9,
      'round',
      7,
    );
  });
}
export function monzaCrossingFields(d = 3) {
  return role('crossing').flatMap((_, i) => {
    const f = faceFrame(role('crossing'), i),
      count = d >= 2 ? 3 : 1;
    return Array.from({ length: count }, (_, j) =>
      hole(
        `crossing-loggia-${i}-${j}`,
        lerp(f.a, f.b, (j + 1) / (count + 1)),
        f.axis,
        f.normal,
        count === 1 ? f.length * 0.58 : 0.95,
        28.2,
        2.2,
        1.65,
        'round',
        5,
      ),
    );
  });
}
function clipY(poly, y, above) {
  const a = [];
  let p = poly.at(-1),
    v = (p[1] - y) * (above ? 1 : -1);
  for (const q of poly) {
    const w = (q[1] - y) * (above ? 1 : -1);
    if (v >= -1e-9 !== w >= -1e-9) a.push(lerp(p, q, v / (v - w)));
    if (w >= -1e-9) a.push(q);
    p = q;
    v = w;
  }
  return a;
}
function facade(_out, face, d) {
  const hs = monzaCathedralFields(d),
    outer = [
      [-18.4, floor - 1],
      [16.65, floor - 1],
      ...ridge.toReversed().map(([z, y]) => [z, floor + y]),
    ],
    rings = hs.map((h) => openingShape(h, d).map(([u, y]) => [h.center[1] + u, y])),
    all = [...outer, ...rings.flat()],
    starts = [];
  let k = outer.length;
  for (const r of rings) {
    starts.push(k);
    k += r.length;
  }
  const ids = earcut(all.flat(), starts, 2),
    tris = [];
  for (let i = 0; i < ids.length; i += 3) tris.push(ids.slice(i, i + 3).map((k) => all[k]));
  // The stripe courses subdivide the actual aperture mesh; they do not cover its holes.
  const step = d === 1 ? 3.6 : 1.45,
    width = d === 1 ? 0.9 : 0.36;
  for (const tri of tris) {
    face(
      'facade',
      tri.map(([z, y]) => [backX, y, z]),
      [1, 0, 0],
    );
    if (d === 0) {
      const tint = colors.facade.map((v, k) => v * 0.75 + colors.stripe[k] * 0.25);
      face(
        'facade',
        tri.map(([z, y]) => [frontX, y, z]),
        [-1, 0, 0],
        tint,
      );
      continue;
    }
    for (let b = floor - 1; b < floor + 36; b += step) {
      for (const [lo, hi, slot] of [
        [b, b + width, 'stripe'],
        [b + width, b + step, 'facade'],
      ]) {
        let p = clipY(tri, lo, true);
        if (p.length >= 3) p = clipY(p, hi, false);
        if (p.length >= 3)
          face(
            slot,
            p.map(([z, y]) => [frontX, y, z]),
            [-1, 0, 0],
          );
      }
    }
  }
  for (let i = 0; i < outer.length; i++) {
    const a = outer[i],
      b = outer[(i + 1) % outer.length];
    face('facade', [
      [frontX, a[1], a[0]],
      [backX, a[1], a[0]],
      [backX, b[1], b[0]],
      [frontX, b[1], b[0]],
    ]);
  }
  for (let j = 0; j < rings.length; j++) {
    const r = rings[j];
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      face('facade', [
        [frontX, a[1], a[0]],
        [frontX, b[1], b[0]],
        [backX, b[1], b[0]],
        [backX, a[1], a[0]],
      ]);
    }
    const h = hs[j];
    pane(face, h, d, d === 0 ? 0.06 : -0.5, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 1) archBand(face, h, d, h.shape === 'circle' ? 0.28 : 0.34, 'trim', 0.1);
  }
  if (d >= 2) {
    // A sparse spoke pattern and paired lancets establish scale without reproducing glass artwork.
    for (const h of hs) {
      if (h.shape === 'circle') {
        const r = h.width * 0.5,
          cy = h.bottom + r,
          n = h.name === 'central-spoke-rose' ? (d >= 3 ? 20 : 12) : 4;
        for (let i = 0; i < n; i++) {
          const a = (i * Math.PI * 2) / n,
            p = [frontX - 0.13, cy + Math.sin(a) * r * 0.18, h.center[1] + Math.cos(a) * r * 0.18],
            q = [frontX - 0.13, cy + Math.sin(a) * r * 0.94, h.center[1] + Math.cos(a) * r * 0.94];
          beam(face, p, q, h.name === 'central-spoke-rose' ? 0.085 : 0.065, 'trim');
        }
        if (h.name === 'central-spoke-rose') {
          const inner = { ...h, width: 1.2, height: 1.2, bottom: cy - 0.6 };
          archBand(face, inner, d, 0.1, 'trim', 0.16);
        }
      } else if (h.kind === 'glass') {
        beam(
          face,
          [frontX - 0.12, h.bottom, h.center[1]],
          [frontX - 0.12, h.bottom + h.height * 0.75, h.center[1]],
          0.14,
        );
      }
    }
    for (let i = 1; i < ridge.length; i++) {
      const a = at([frontX - 0.18, ridge[i - 1][0]], ridge[i - 1][1]),
        b = at([frontX - 0.18, ridge[i][0]], ridge[i][1]);
      beam(face, a, b, 0.24, 'trim');
    }
    for (const z of [-17.32, -11.77, -6.91, 3.56, 8.84, 15.28]) {
      solid(
        face,
        R(frontX - 0.22, z - 0.2, frontX + 0.18, z + 0.2),
        0.4,
        monzaFacadeHeight(z) - 0.6,
        'trim',
      );
    }
    if (d >= 3) {
      for (let z = -16.4; z < 15; z += 1.42) {
        const t = monzaFacadeHeight(z) - 1.25,
          h = hole(
            'blind-front-arcade',
            [frontX - 0.05, z],
            [0, 1],
            [-1, 0],
            1,
            Math.max(21.8, t - 3.0),
            2.4,
            1.55,
            'pointed',
            1,
          );
        archBand(face, h, d, 0.12, 'trim', 0.22);
      }
    }
  }
}
function pinnacle(_out, face, d, b) {
  const r = b.polygons[0].outline,
    p = b.center,
    tip = b.properties.height,
    low = monzaFacadeHeight(p[1]);
  if (d >= 1) solid(face, scaled(r, 0.82), low - 0.35, low + 0.65, 'facade');
  const a = scaled(r, d === 0 ? 0.6 : 0.7),
    stage = Math.max(low + 1.2, tip - 2.15);
  for (const q of a) {
    const post = R(q[0] - 0.14, q[1] - 0.14, q[0] + 0.14, q[1] + 0.14);
    if (d === 0) sides(face, post, low, stage, 'trim');
    else solid(face, post, low + 0.6, stage, 'trim');
  }
  profile(
    face,
    scaled(r, 0.86),
    [
      [stage, 1],
      [stage + 0.25, 1],
      [d === 0 ? tip : tip - 0.22, 0.04],
    ],
    'trim',
  );
  if (d >= 2) {
    band(face, r, low + 0.58, 0.18, 'trim', 0.91);
    for (const q of a) {
      const tiny = R(q[0] - 0.17, q[1] - 0.17, q[0] + 0.17, q[1] + 0.17);
      profile(
        face,
        tiny,
        [
          [stage - 0.6, 1],
          [stage + 0.65, 0.03],
        ],
        'trim',
      );
    }
  }
  const top = R(p[0] - 0.11, p[1] - 0.11, p[0] + 0.11, p[1] + 0.11);
  if (d >= 1) solid(face, top, tip - 0.25, tip, 'metal');
}
function openStage(face, r, b, t, post, slot) {
  const inner = scaled(r, 0.76);
  for (const q of r)
    solid(face, R(q[0] - post / 2, q[1] - post / 2, q[0] + post / 2, q[1] + post / 2), b, t, slot);
  cap(face, r, t, slot, [inner]);
}
function campanile(out, face, d) {
  const r = role('tower'),
    p = plans.towerCenter,
    crown = role('crown'),
    lantern = role('lantern');
  solid(face, r, footing, 50, 'wall');
  if (d === 0) openStage(face, scaled(r, 0.93), 50, 62, 1.28, 'wall');
  else shell(out, d, r, 50, 62, monzaBelfryFields(), 'wall', scaled(r, 0.74));
  if (d >= 1) band(face, r, 49.7, 0.5, 'trim', 1.015);
  band(face, r, 61.8, 0.6, 'trim', 1.035);
  // Four pale pediments frame the dark cap. Their inferred partitions retain mapped62/72/75m stages.
  if (d >= 1) {
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        a = f.a,
        b = f.b,
        q = lerp(a, b, 0.5),
        offset = f.normal.map((v) => v * 0.14);
      face('trim', [at(a, 62.4), at(b, 62.4), at(q, 66.4)], [f.normal[0], 0, f.normal[1]]);
      beam(face, at(a, 62.4), at(q, 66.4), 0.25);
      beam(face, at(b, 62.4), at(q, 66.4), 0.25);
      if (d >= 2)
        face(
          'wall',
          [at(lerp(a, b, 0.16), 62.8), at(lerp(a, b, 0.84), 62.8), at(q, 65.5)].map((v) => [
            v[0] + offset[0],
            v[1],
            v[2] + offset[1],
          ]),
          [f.normal[0], 0, f.normal[1]],
        );
    }
  }
  const dark = (slot, p, n) =>
    face(
      slot,
      p,
      n,
      colors.metal.map((v) => v * 0.28),
    );
  profile(
    dark,
    crown,
    [
      [d === 0 ? 62.3 : 63.1, 1],
      [67.6, 0.78],
      [70, 0.55],
      [72, 0.3],
    ],
    'metal',
  );
  const l = scaled(lantern, 1.06);
  if (d === 0) solid(face, l, 72, 74.4, 'trim');
  else openStage(face, l, 72, 74.4, 0.23, 'trim');
  profile(
    face,
    l,
    [
      [74.4, 1.18],
      [75, 0.05],
    ],
    'metal',
  );
  solid(face, R(p[0] - 0.13, p[1] - 0.13, p[0] + 0.13, p[1] + 0.13), 74.85, 79, 'metal');
  if (d >= 1) {
    beam(face, at([p[0] - 0.75, p[1]], 77.1), at([p[0] + 0.75, p[1]], 77.1), 0.12, 'metal');
    const west = edge(r, [-1, 0]),
      clock = {
        ...hole(
          'west-clock',
          lerp(west.a, west.b, 0.5),
          west.axis,
          west.normal,
          5.1,
          35,
          5.1,
          5.1,
          'circle',
          1,
        ),
      };
    const centerX = clock.center[0] - 0.27,
      z = clock.center[1],
      bottom = clock.bottom;
    face(
      'trim',
      [
        [frontX - 0.06, floor + 29, z - 3.45],
        [frontX - 0.06, floor + 29, z + 3.45],
        [frontX - 0.06, floor + 46, z + 3.45],
        [frontX - 0.06, floor + 46, z - 3.45],
      ],
      [-1, 0, 0],
    );
    pane(face, clock, d, 0.18, 'facade');
    archBand(face, clock, d, 0.2, 'trim', 0.2);
    beam(face, [centerX, bottom + 2.55, z], [centerX, bottom + 4.2, z - 0.4], 0.13, 'metal');
    beam(face, [centerX, bottom + 2.55, z], [centerX, bottom + 2.3, z + 1.5], 0.13, 'metal');
    if (d >= 2)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        beam(
          face,
          [centerX, bottom + 2.55 + Math.sin(a) * 2.12, z + Math.cos(a) * 2.12],
          [centerX, bottom + 2.55 + Math.sin(a) * 2.33, z + Math.cos(a) * 2.33],
          0.09,
          'metal',
        );
      }
    for (const y of [7, 21, 28.5, 46.3]) band(face, r, y, 0.22, 'trim', 1.01);
    if (d >= 2) {
      for (const h of monzaBelfryFields()) archBand(face, h, d, 0.28, 'trim', 0.12);
      for (const q of r) {
        const a = lerp(p, q, 0.97);
        solid(face, R(a[0] - 0.2, a[1] - 0.2, a[0] + 0.2, a[1] + 0.2), 0.4, 49.5, 'wall');
      }
    }
  }
}
function crossing(out, face, d) {
  const r = role('crossing'),
    p = plans.crossingCenter;
  solid(face, r, 20, 28, 'wall');
  if (d === 0) openStage(face, scaled(r, 0.93), 28, 30.8, 0.55, 'wall');
  else shell(out, d, r, 28, 30.8, monzaCrossingFields(d), 'wall', scaled(r, 0.76));
  if (d >= 1) band(face, r, 27.7, 0.35, 'trim', 1.02);
  band(face, r, 30.7, 0.35, 'trim', 1.03);
  profile(
    face,
    r,
    [
      [31, 1.035],
      [35, 0.07],
    ],
    'metal',
  );
  const n = 4,
    small = Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * Math.PI * 2) / n) * 0.55,
      p[1] + Math.sin((i * Math.PI * 2) / n) * 0.55,
    ]);
  solid(face, small, 35, 36.7, 'trim');
  profile(
    face,
    small,
    [
      [36.6, 1.18],
      [37.5, 0.02],
    ],
    'metal',
  );
  if (d >= 2) for (const h of monzaCrossingFields(d)) archBand(face, h, d, 0.12, 'trim', 0.08);
}
function protyrus(_out, face, d) {
  const r = R(-26.2, -4.1, -23.2, 0.76); // Projecting central porch opens onto the west square.
  for (const z of [-3.85, 0.51])
    solid(face, R(-25.95, z - 0.17, -25.61, z + 0.17), 0.2, 7.6, 'trim');
  for (const z of [-4.1, 0.76])
    solid(face, R(-26.15, z - 0.18, -23.21, z + 0.18), 7.45, 8.35, 'trim');
  solid(face, R(-26.2, -4.1, -25.8, 0.76), 7.45, 8.35, 'trim');
  gable(face, r, 8.35, 10.1, 'roof', 0);
  if (d >= 2) {
    const h = hole('porch-front', [-26, -1.67], [0, 1], [-1, 0], 3.95, 0.4, 7.7, 5.8, 'round', 1);
    archBand(face, h, d, 0.23, 'trim', 0.2);
    for (const z of [-3.85, 0.51]) {
      band(face, R(-26.09, z - 0.3, -25.47, z + 0.3), 0.4, 0.25, 'trim');
      band(face, R(-26.09, z - 0.3, -25.47, z + 0.3), 7.1, 0.28, 'trim');
    }
  }
  for (let i = 0; i < (d === 0 ? 1 : 3); i++) {
    const n = d === 0 ? 1 : 3;
    solid(
      face,
      R(-27.4 + i * 0.45, -4.7, -23.45, 1.36),
      (p) => Math.min(-0.35, monzaCathedralGround(...p) - 0.35),
      (floor * (i + 1)) / n - floor,
      'trim',
    );
  }
}
export function monzaSideFields() {
  return [-1, 1].flatMap((side) => {
    const f = edge(main, [0, side]);
    return Array.from({ length: 6 }, (_, i) => ({
      ...hole(
        `aisle-light-${side}-${i}`,
        lerp(f.a, f.b, 0.13 + i * 0.145),
        f.axis,
        f.normal,
        1.9,
        8.3,
        5.7,
        4.1,
        'round',
        2,
      ),
      kind: 'glass',
    })).filter((h) => side > 0 || h.center[0] > -14);
  });
}
function body(out, face, d) {
  const fields = [];
  if (d >= 2) {
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++) {
        const x = -15 + i * 7.9,
          z = side < 0 ? -7.9 : 6;
        fields.push({
          ...hole(
            `nave-light-${side}-${i}`,
            [x, z],
            [1, 0],
            [0, side],
            1.5,
            20.3,
            2.35,
            1.6,
            'round',
            2,
          ),
          kind: 'glass',
        });
      }
  }
  const cut = writer(
    masked(
      out,
      fields.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  shell(
    out,
    d,
    main,
    footing,
    18,
    d === 0 ? [] : [...monzaCathedralFields(d), ...(d >= 2 ? monzaSideFields() : [])],
    'wall',
  );
  // A closed outer hip remains beneath the raised nave and crossing, including the mapped rounded east end.
  const frontCut = writer(
    masked(
      out,
      (d === 0 ? [] : monzaCathedralFields(d)).map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  hip(frontCut, main, 18, 22, 'roof', 0);
  shell(out, d, plans.nave, 17.9, 23, fields, 'wall');
  gable(cut, plans.nave, 23, 27, 'roof', 0);
  if (d >= 1)
    for (const h of monzaSideFields()) {
      pane(face, h, d, d === 1 ? 0.06 : -0.22);
      if (d >= 2) archBand(face, h, d, 0.2, 'trim', 0.08);
    }
  if (d >= 2) {
    for (const h of fields) {
      pane(face, h, d, -0.22);
      archBand(face, h, d, 0.2, 'trim', 0.08);
    }
    for (const side of [-1, 1]) {
      for (let i = 0; i < 7; i++) {
        const x = -17 + i * 7.7,
          z = side < 0 ? -17.2 : 16.1;
        solid(face, R(x - 0.22, z - 0.26, x + 0.22, z + 0.26), footing, 18.2, 'wall');
      }
    }
    band(face, main, 17.7, 0.25, 'trim', 1.006);
    band(face, plans.nave, 22.8, 0.22, 'trim', 1.007);
  }
}
function footprintAware(out) {
  const target = out;
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  const toWorld = (p) => [p[0] * c + p[2] * s, -p[0] * s + p[2] * c];
  const clearanceBounds = fit.excludedBuildings
    .filter((b) => b.id === 35184578513414)
    .map((b) => b.polygons[0].outline)
    .map((r) => {
      const points = r.map(([x, z]) => toWorld([x, 0, z]));
      return [0, 1].map((k) => [
        Math.min(...points.map((p) => p[k])) - 2,
        Math.max(...points.map((p) => p[k])) + 2,
      ]);
    });
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
    // Localize conservative viewer footprint stamps around the real gap between components.
    if (
      longest > 24 &&
      clearanceBounds.some((bb) => bb.every((b, k) => b[0] <= bounds[k][1] && b[1] >= bounds[k][0]))
    ) {
      const j = (i + 1) % 3,
        k = (i + 2) % 3,
        mid = p[i].map((v, a) => (v + p[j][a]) / 2),
        uv = args[4],
        uvMid = uv[i].map((v, a) => (v + uv[j][a]) / 2);
      emit([args[0], args[1], [p[i], mid, p[k]], args[3], [uv[i], uvMid, uv[k]], args[5]]);
      emit([args[0], args[1], [mid, p[j], p[k]], args[3], [uvMid, uv[j], uv[k]], args[5]]);
    } else target.addTriangle(args[0], args[1], p, args[3], args[4], args[5]);
  }
  return {
    addTriangle(...args) {
      emit(args);
    },
  };
}
function build(target, d) {
  target = footprintAware(target);
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
  facade(out, face, d);
  for (const b of plans.pinnacleCenters) pinnacle(out, face, d, b);
  campanile(out, face, d);
  crossing(out, face, d);
  protyrus(out, face, d);
}
export const buildMonzaCathedralSkyline = (o) => build(o, 0),
  buildMonzaCathedralDistrict = (o) => build(o, 1),
  buildMonzaCathedralStreet = (o) => build(o, 2),
  buildMonzaCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const monzaCathedralStudy = {
  id: 'monza_cathedral',
  key: 'monza_cathedral',
  title: 'Monza Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1236608',
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
    'Six existing256-square brick,ashlar,continuous limestone,ceramic tile,standing-seam metal and plain wood graphs serve seven merged groups.The white/gray-green facade stripes share the same ashlar graph and differ by linear vertex tint.Metric UVs,flat architectural normals,no embedded images,private facade maps,photo textures or baked lighting.',
  importReason:
    'Preserve the striped stepped marble front,six open pinnacles,rose and pointed lights,northwest tall brick campanile,green-roofed octagonal crossing and long red-roofed church in four browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two inspected Commons pictures and standard viewer PMTiles/DEM only.Hidden roof/chapel partitions and all internal stage datums remain approximate.Fine carved figures,tracery detail,inscriptions,glass art,freestanding plaza column,full interiors/bells and engineering excluded or simplified.Neighboring museum/sacristy and town blocks remain host content.No exact Wikidata-way identity,ground joins,absolute altitude,current finish or physical-device timing approval.',
    'Skyline retains stepped front and six pinnacles,tall open-belfry campanile,green crossing cap and red-roofed irregular body with averaged facade courses.District adds shared texture courses,front apertures,clock and framed belfry/loggia.Street adds rose spokes,pointed tracery,reveals,pilasters,cornices and clerestory.Closeup/master refine sparse upper blind arcades,clock ticks and trim;sculpture remains abstract.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('whole-striped-west-front', [-85, 26, -1.67], [-23, 20, -1.67]),
    cam('central-protyrus-and-spoke-rose', [-49, 14, 7], [-23.5, 11, -1.67]),
    cam('six-pinnacles-and-stepped-parapet', [-51, 43, 28], [-22, 31, -1.5]),
    cam('campanile-clock-belfry-and-cap', [-52, 62, -51], [-19.1, 57, -23.1]),
    cam('crossing-loggia-and-green-hip', [51, 42, 35], [26.6, 30, -1.26]),
    cam('roof-and-signed-plan', [8, 155, 0.1], [8, 16, 0]),
  ],
};

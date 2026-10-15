/** Lucca Cathedral: asymmetric arcaded marble front, tiled cross nave and southwest campanile. */
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
  '../../../content/worldgen/source/places/sp/spz/n0374_lucca_cathedral/',
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
  wall: '#e4e1d5',
  spire: '#cfb293',
  trim: '#eee9dc',
  roof: '#b2816b',
  door: '#71533c',
  glass: '#414844',
  accent: '#454a47',
  clock: '#ad615b',
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
const footing = (p) => Math.min(floor - 0.3, luccaGround(...p) - 0.35);
export function luccaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Lucca Cathedral footing outside retained terrain');
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
function _profile(face, ring, levels, slot) {
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
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline,
  main = rec.main.polygons[0].outline,
  tower = coarse(role('tower')),
  towerInner = scaled(tower, 0.65),
  plans = rec.plans;
const circle = (p, r, n = 16) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n;
    return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
  });
const portico = [
  hole('portico-north', [-45.95, -9.5], [0, 1], [-1, 0], 9.3, 0.3, 13.5, 8.85, 'round', 23),
  hole('portico-middle', [-45.95, 1.1], [0, 1], [-1, 0], 9.3, 0.3, 13.5, 8.85, 'round', 23),
  hole('portico-south-small', [-45.95, 7.8], [0, 1], [-1, 0], 3.9, 0.3, 10.6, 8.65, 'round', 23),
];
function _circular(name, p, n, r, y, depth = 1.5) {
  return {
    ...hole(name, p, [-n[1], n[0]], n, r * 2, y - r, r * 2, r, 'round', depth),
    shape: 'circle',
  };
}
// Full circles use an explicit convex aperture ring; round doors retain straight jambs.
function roundWindow(name, p, n, r, y) {
  return {
    ...hole(name, p, [-n[1], n[0]], n, r * 2, y - r, r * 2, r, 'round', 3),
    shape: 'circle',
  };
}
function fields() {
  const a = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const x = -31 + i * 7.1;
      a.push(
        roundWindow(`clerestory-${side}-${i}`, [x, side < 0 ? -7.2 : 6.3], [0, side], 1.1, 28.3),
      );
    }
    for (let i = 0; i < 6; i++) {
      if ((side < 0 && i === 5) || (side > 0 && i >= 4)) continue;
      const x = -30 + i * 8.1;
      a.push(
        hole(
          `aisle-${side}-${i}`,
          [x, side < 0 ? -14.93 : 16.76],
          [1, 0],
          [0, side],
          2.1,
          5.2,
          8.2,
          6.3,
          'pointed',
          3,
        ),
      );
    }
    for (let i = 0; i < 3; i++)
      a.push(
        roundWindow(
          `transept-${side}-${i}`,
          [20 + i * 6.2, side < 0 ? -23.85 : 23.87],
          [0, side],
          1.25,
          26.8,
        ),
      );
  }
  for (const side of [-1, 1]) {
    a.push(
      hole(
        `transept-tall-${side}`,
        [26.2, side < 0 ? -23.88 : 23.87],
        [1, 0],
        [0, side],
        3.2,
        11,
        12,
        10.4,
        'pointed',
        3,
      ),
    );
    a.push({
      ...hole(
        `transept-door-${side}`,
        [26.2, side < 0 ? -23.88 : 23.87],
        [1, 0],
        [0, side],
        3.5,
        0.3,
        7.5,
        5.75,
        'round',
        3,
      ),
      kind: 'door',
    });
  }
  for (const z of [-9.5, 1.1, 7.8])
    a.push({
      ...hole(
        `portal-${z}`,
        [-35.45, z],
        [0, 1],
        [-1, 0],
        z > 7 ? 2.6 : 3.6,
        0.35,
        z > 7 ? 5.4 : 7.5,
        z > 7 ? 4.1 : 5.7,
        'round',
        3,
      ),
      kind: 'door',
    });
  for (let i = 1; i < 9; i++) {
    const f = faceFrame(role('apse'), i);
    if (f.normal[0] > 0.05)
      a.push(
        hole(`apse-${i}`, lerp(f.a, f.b, 0.5), f.axis, f.normal, 1.65, 9, 7.5, 6.4, 'round', 3),
      );
  }
  return a;
}
export const luccaFields = fields;
const towerLevels = [
  { y: 28.5, n: 1, h: 5.3 },
  { y: 38, n: 2, h: 5.1 },
  { y: 47.5, n: 3, h: 5.3 },
  { y: 57, n: 4, h: 5.3 },
];
export function luccaBelfryFields() {
  const a = [];
  for (let f = 0; f < tower.length; f++) {
    const e = faceFrame(tower, f);
    if (e.length < 4) continue;
    for (const t of towerLevels) {
      const pitch = Math.min(1.85, (e.length - 1.5) / t.n);
      for (let k = 0; k < t.n; k++)
        a.push(
          hole(
            `tower-${f}-${t.n}-${k}`,
            lerp(e.a, e.b, 0.5 + ((k - (t.n - 1) / 2) * pitch) / e.length),
            e.axis,
            e.normal,
            t.n === 1 ? 1.8 : 1.45,
            t.y,
            t.h,
            t.h - (t.n === 1 ? 0.9 : 0.725),
            'round',
            4,
          ),
        );
    }
  }
  return a;
}
function panel(face, h, d) {
  pane(face, h, d, d >= 2 ? -0.52 : 0.05, h.kind === 'door' ? 'door' : 'glass');
  if (d >= 2) {
    archBand(face, h, d, 0.25, 'trim', 0.09);
    if (d >= 3) archBand(face, h, d, 0.48, 'trim', 0.13);
    if (h.kind === 'door') {
      const p = prepareOpening(h, 0, d),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      beam(
        face,
        p.point(0, h.bottom, -0.5 * sg),
        p.point(0, h.bottom + h.spring, -0.5 * sg),
        0.12,
        'accent',
      );
    }
  }
}
function gallery(out, face, d, z1, z2, b, t, count) {
  const x = -46.38,
    rr = R(x, z1, x + 0.85, z2),
    holes = Array.from({ length: count }, (_, i) =>
      hole(
        `gallery-${b}-${i}`,
        [x, z1 + ((i + 0.5) * (z2 - z1)) / count],
        [0, 1],
        [-1, 0],
        (z2 - z1) / count - 0.48,
        b + 0.5,
        t - b - 1.05,
        t - b - 1.05 - ((z2 - z1) / count - 0.48) / 2,
        'round',
        2.1,
      ),
    );
  if (d >= 2) shell(out, d, rr, b, t, holes, 'trim');
  else sides(face, rr, b, t, 'trim');
  if (d >= 1)
    for (const h of holes) {
      pane(face, h, d, d >= 2 ? -0.79 : 0.05, d >= 2 ? 'wall' : 'glass');
      if (d >= 2) {
        archBand(face, h, d, 0.17, 'trim', 0.04);
        const zz = h.center[1] - h.width / 2 - 0.15;
        solid(
          face,
          circle([x - 0.13, zz], 0.19, d >= 3 ? 8 : 4),
          b + 0.55,
          b + h.spring + 0.5,
          'trim',
        );
        if (d >= 3) {
          solid(face, R(x - 0.36, zz - 0.3, x + 0.25, zz + 0.3), b + 0.3, b + 0.65, 'trim');
          solid(
            face,
            R(x - 0.38, zz - 0.32, x + 0.28, zz + 0.32),
            b + h.spring + 0.28,
            b + h.spring + 0.7,
            'trim',
          );
        }
      }
    }
  cap(face, rr, t, 'trim');
  if (d >= 1) {
    band(face, rr, b, 0.28, 'accent', 1.005);
    band(face, rr, t - 0.3, 0.3, 'trim', 1.016);
  }
}
function lean(face, r, eave, join, side) {
  const zs = r.map((p) => p[1]),
    lo = Math.min(...zs),
    hi = Math.max(...zs);
  const yy = (p) =>
    floor + eave + (join - eave) * (side < 0 ? (p[1] - lo) / (hi - lo) : (hi - p[1]) / (hi - lo));
  cap(face, r, yy, 'roof');
}
function naveRoof(face) {
  gable(face, R(-45.5, -7.2, 41.45, 6.76), 30, 36, 'roof', 0);
  gable(face, R(16.1, -23.88, 35.6, 23.88), 30, 36, 'roof', 1);
}
function details(face, d) {
  if (d < 1) return;
  for (const side of [-1, 1]) {
    const z = side < 0 ? -14.94 : 16.75;
    for (const y of d >= 2 ? [1, 4.5, 10, 14, 19.3] : [19.3])
      solid(face, R(-35.5, z - 0.08, 16.15, z + 0.08), y, y + 0.16, 'accent');
    for (let i = 0; i < 7; i++) {
      const x = -34.5 + i * 8.2;
      if (d >= 2) {
        solid(face, R(x - 0.34, z - 0.6, x + 0.34, z + 0.6), footing, 20.2, 'trim');
        const inner = side < 0 ? -7.15 : 6.3;
        face(
          'trim',
          [
            [x - 0.2, floor + 20, z],
            [x + 0.2, floor + 20, z],
            [x + 0.2, floor + 27, inner],
            [x - 0.2, floor + 27, inner],
          ],
          [0, 1, 0],
        );
      }
      if (d >= 3) {
        const h = hole(
          'blind-side',
          [x + 3.6, z],
          [1, 0],
          [0, side],
          6.2,
          4.5,
          11.2,
          8.1,
          'pointed',
          1,
        );
        archBand(face, h, d, 0.18, 'trim', 0.11);
      }
    }
    for (let i = 0; i < 7; i++) {
      const x = -31 + i * 7.1,
        inner = side < 0 ? -7.22 : 6.35;
      const h = hole(
        'blind-clerestory',
        [x, inner],
        [1, 0],
        [0, side],
        5.8,
        23.5,
        6.2,
        3.3,
        'round',
        1,
      );
      if (d >= 2) archBand(face, h, d, 0.16, 'trim', 0.12);
    }
  }
  for (const y of [36.2, 45.5, 55, 65.2]) {
    band(face, tower, y, 0.34, 'trim', 1.03);
    if (d >= 3)
      for (let i = 0; i < tower.length; i++) {
        const f = faceFrame(tower, i);
        if (f.length < 4) continue;
        for (let j = 0; j < 6; j++) {
          const p = lerp(f.a, f.b, (j + 0.5) / 6),
            h = hole('tower-blind', p, f.axis, f.normal, 1.05, y - 1.55, 1.15, 0.62, 'round', 0.8);
          archBand(face, h, d, 0.15, 'trim', 0.08);
        }
      }
  }
  for (let i = 0; i < tower.length; i++) {
    const f = faceFrame(tower, i);
    if (f.length < 4) continue;
    for (let j = 0; j < 4; j++) {
      const p = lerp(f.a, f.b, (j + 0.5) / 4),
        rr = R(p[0] - 0.48, p[1] - 0.48, p[0] + 0.48, p[1] + 0.48);
      solid(face, rr, 67, 69, 'trim');
    }
  }
  if (d >= 2) {
    for (const h of portico) {
      archBand(face, h, d, 0.48, 'trim', 0.16);
      if (d >= 3) archBand(face, h, d, 0.82, 'trim', 0.24);
    }
    for (let i = 0; i < 3; i++) {
      const rr = R(-47.7 - i * 0.45, -14.7, -45.4, 9.5);
      solid(face, rr, footing, 0.13 + i * 0.08, 'trim');
    }
  }
  // Small finial above the central front gallery, below the main nave ridge.
  beam(face, [-46.0, floor + 35, -0.35], [-46.0, floor + 37, -0.35], 0.16, 'accent');
  beam(face, [-46.0, floor + 36.45, -0.9], [-46.0, floor + 36.45, 0.2], 0.16, 'accent');
}
function build(target, d = 4) {
  const out = {
      addTriangle(slot, ref, p, n, uv, col) {
        p = p.map((v) => v.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-10
        )
          return;
        target.addTriangle(slot, ref, p, n, uv, col);
      },
    },
    face = writer(out, d),
    hs = fields(),
    bell = luccaBelfryFields(),
    all = [...hs, ...portico],
    wall = (r, b, t, holes = all, slot = 'wall') => {
      if (d >= 2) shell(out, d, r, b, t, holes, slot);
      else if (holes.some((h) => h.name.startsWith('portico')))
        shell(out, d, r, b, t, portico, slot);
      else sides(face, r, b, t, slot);
    };
  for (const p of plans.base) wall(p.outline, footing, 10, all);
  cap(face, main, 0.2, 'wall');
  wall(role('portico'), 10, 14.5, portico);
  cap(face, role('portico'), 14.5, 'roof');
  wall(
    role('frontNave').map((p) => [Math.max(-44.8, p[0]), p[1]]),
    10,
    30,
    portico,
  );
  wall(role('nave'), 10, 30, hs);
  for (const side of [-1, 1]) {
    const r = role(side < 0 ? 'northAisle' : 'southAisle');
    wall(r, 10, 19.8, hs);
    lean(face, r, 19.8, 26.5, side);
  }
  for (const n of ['northEast', 'southEast']) {
    wall(role(n), 10, 22, hs);
    hip(face, role(n), 22, 26);
  }
  for (const n of ['northChapel', 'southChapel']) {
    wall(role(n), 10, 13, hs);
    hip(face, role(n), 13, 17);
  }
  wall(role('apse'), 10, 30, hs);
  hip(face, role('apse'), 30, 35.8);
  naveRoof(face);
  // Portico rear doors stand behind the deep vaulted openings, never on the outer facade plane.
  if (d >= 1) {
    const rr = R(-35.5, -14.9, -35.15, 16.8);
    if (d >= 2)
      shell(
        out,
        d,
        rr,
        0.3,
        14.5,
        hs.filter((h) => h.kind === 'door'),
      );
    else sides(face, rr, 0.3, 14.5, 'wall');
    for (const h of hs) panel(face, h, d);
  }
  const twall = (b, t, slot) => {
    if (d >= 2) shell(out, d, tower, b, t, bell, slot, towerInner);
    else sides(face, tower, b, t, slot);
  };
  twall(footing, 47, 'spire');
  twall(47, 67, 'trim');
  cap(face, tower, 67, 'roof', [towerInner]);
  if (d === 0) {
    solid(face, tower, 67, 69, 'trim');
  }
  if (d >= 1)
    for (const h of bell) {
      if (d >= 2) archBand(face, h, d, 0.22, 'trim', 0.1);
      else pane(face, h, d, 0.05, 'glass');
    }
  if (d === 0) {
    solid(face, R(-46.3, -14.9, -45.5, 16.8), 14.5, 28, 'trim');
    solid(face, R(-46.3, -7.2, -45.5, 6.8), 28, 35, 'trim');
  } else {
    gallery(out, face, d, -14.9, 9.75, 15, 21.5, 9);
    gallery(out, face, d, -14.9, 9.75, 22, 28, 9);
    gallery(out, face, d, -7.2, 6.8, 28.5, 35, 6);
  }
  details(face, d);
}
export const buildLuccaSkyline = (o) => build(o, 0),
  buildLuccaDistrict = (o) => build(o, 1),
  buildLuccaStreet = (o) => build(o, 2),
  buildLuccaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const luccaStudy = {
  id: 'N0374',
  key: 'lucca_cathedral',
  title: 'Lucca Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1282278',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID whole main plus11 current mapped parts. Western portico/southwest campanile and eastern apse sign the axis; raw plans retained.',
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
    'Five existing cached256-square ashlar, limestone, tile, brick and plain wood graphs. Linear ivory/tan/terracotta tints, metric UVs and flat architectural normals. Glazing, shaded gallery backing and sparse stone inlays use geometric PBR colors. No embedded images or bespoke facade maps.',
  importReason:
    'Four authored browser tiers preserve the unequal deep portico, three stepped arcade tiers, long tiled cross nave/aisles, round apse and southwest69m campanile.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three inspected2023 pictures and standard viewer PMTiles/DEM only. Exact carved columns, figures, marble mosaic, inscriptions, interior rooms/bells, hidden roof joins and surveyed plaza/thresholds remain approximate or excluded. Most heights are picture estimates;69m campanile is mapped. Physical phone/laptop timing pending.',
    'Skyline retains mapped massing/tower/stepped front and red cross roof. District adds shared textures, flat gallery/belfry bays and tower merlons. Street adds real gallery recesses, deep portico and doors, hollow belfry openings and recessed glazing. Closeup/master add capitals, nested surrounds and side blind arcades. Synthetic cottages are a review fixture.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-unequal-portico', [-105, 23, -3], [-42, 13, 0]),
    cam('west-three-arcaded-tiers', [-99, 43, -29], [-44, 24, 0]),
    cam('campanile-belfry-and-merlons', [-91, 71, 65], [-45, 51, 15]),
    cam('north-aisle-and-tiled-roof', [-18, 38, -83], [0, 21, -9]),
    cam('east-transept-and-round-apse', [103, 49, 72], [32, 23, 0]),
    cam('roof-and-signed-plan', [0, 180, 1], [0, 25, 0]),
  ],
};

/** São Paulo Cathedral: twin Gothic spires, rose facade, buttressed nave and green copper dome. */
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
  '../../../content/worldgen/source/places/6g/6gy/sao_paulo_cathedral/',
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
  wall: '#c9c8bd',
  trim: '#deddd2',
  roof: '#9bbdaf',
  door: '#604a3a',
  glass: '#526773',
  accent: '#b7bbb0',
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
const footing = (p) => Math.min(floor - 0.3, saoPauloCathedralGround(...p) - 0.35);
export function saoPauloCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('São Paulo Cathedral footing outside retained terrain');
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
function _panel(face, h, d) {
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
  main = rec.main.polygons[0].outline,
  dc = rec.estimated.domeCenter;
const R = (a, b, c, d) => [
    [a, b],
    [c, b],
    [c, d],
    [a, d],
  ],
  circle = (p, r, n, offset = 0) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos(offset + (i * Math.PI * 2) / n) * r,
      p[1] + Math.sin(offset + (i * Math.PI * 2) / n) * r,
    ]);
const F = (name, f, t, w, b, h, s = h, shape = 'pointed', depth = 3) =>
  hole(name, lerp(f.a, f.b, t), f.axis, f.normal, w, b, h, s, shape, depth);
const front = (name, x, z, w, b, h, s = h, shape = 'pointed', depth = 3) =>
  hole(name, [x, z], [0, 1], [1, 0], w, b, h, s, shape, depth);
function fields(d = 3) {
  const a = [
    { ...front('central-portal', 52.7, 0.05, 6.8, 0.8, 13.8, 8.2), kind: 'portal' },
    front('front-rose', 52.7, 0.05, 10.8, 20.5, 10.8, 0, 'circle'),
  ];
  for (const z of [-7.4, 7.5])
    a.push(front(`front-small-lancet-${z}`, 52.7, z, 1.15, 17, 3.7, 2.4));
  for (const [key, j] of [
    ['towerNorth', 0],
    ['towerSouth', 1],
  ]) {
    const r = plans[key][0].outline;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        isFront = f.normal[0] > 0.7,
        isRear = f.normal[0] < -0.7,
        isInner = f.normal[1] * (j === 0 ? 1 : -1) > 0.7;
      // Lower rear/inner faces meet the body or nave rather than open exterior space.
      if (!isRear && !isInner)
        a.push({
          ...F(`${key}-lower-${i}`, f, 0.5, 3.9, 0.8, 15.5, 10.5),
          kind: isFront ? 'portal' : 'glass',
        });
      if (!isInner)
        a.push(
          F(
            `${key}-middle-${i}`,
            f,
            0.5,
            4.2,
            isRear ? 27 : 20.5,
            isRear ? 3.4 : 10,
            isRear ? 2.2 : 6.5,
          ),
        );
      a.push({ ...F(`${key}-upper-${i}`, f, 0.5, 4.4, 38, 20.5, 15.8), kind: 'louver' });
    }
  }
  const nave = plans.nave[0].outline;
  for (const sg of [-1, 1]) {
    for (const x of [-30, -20, -10, 14, 25, 36]) {
      const f = nave
        .map((_, i) => faceFrame(nave, i))
        .filter(
          (f) =>
            f.normal[1] * sg > 0.7 &&
            x >= Math.min(f.a[0], f.b[0]) &&
            x <= Math.max(f.a[0], f.b[0]),
        )
        .sort((a, b) => b.length - a.length)[0];
      if (f)
        a.push(
          F(`clerestory-${sg}-${x}`, f, (x - f.a[0]) / (f.b[0] - f.a[0]), 3.2, 26.4, 3.3, 2.1),
        );
      a.push(
        hole(
          `aisle-${sg}-${x}`,
          [x, sg < 0 ? -22.95 : 23.1],
          [1, 0],
          [0, sg],
          3.3,
          5,
          11.5,
          8.2,
          'pointed',
          3,
        ),
      );
    }
    const f = edge(plans.cross[0].outline, [0, sg]);
    a.push({ ...F(`transept-portal-${sg}`, f, 0.5, 3.1, 0.8, 9, 6.1), kind: 'portal' });
    a.push(F(`transept-window-${sg}`, f, 0.5, 6.7, 17.5, 11.4, 7));
  }
  for (const [i, f] of plans.apseRoof[0].outline
    .map((_, i) => faceFrame(plans.apseRoof[0].outline, i))
    .entries()) {
    if (f.normal[0] > 0.2 || f.length < 2) continue;
    a.push(F(`apse-${i}`, f, 0.5, Math.min(3.0, f.length * 0.48), 26.4, 3.3, 2.1));
  }
  for (const f of main.map((_, i) => faceFrame(main, i))) {
    if (f.normal[0] > -0.1 || f.length < 4) continue;
    a.push(F(`lower-apse-${f.a[0]}`, f, 0.5, Math.min(3.3, f.length * 0.42), 5.5, 11, 7.6));
  }
  const drum = circle(dc, 13.8, d >= 2 ? 32 : 16);
  for (let i = 0; i < drum.length; i += d >= 2 ? 2 : 1)
    a.push(F(`drum-${i}`, faceFrame(drum, i), 0.5, 1.85, 41.5, 4.9, 3.2));
  return a;
}
export const saoPauloCathedralFields = fields;
const lanternRing = () => circle(dc, 1.8, 8, Math.PI / 8);
function lanternFields() {
  return lanternRing().map((_, i) =>
    F(`lantern-open-${i}`, faceFrame(lanternRing(), i), 0.5, 0.84, 65.2, 2.6, 1.8, 'pointed', 2.0),
  );
}
export const saoPauloCathedralLanternFields = lanternFields;
function feature(face, h, d) {
  const sd = d === 2 ? 1 : d,
    recessed = d >= 2 || h.kind === 'portal';
  pane(face, h, sd, recessed ? -0.75 : 0.07, h.kind === 'louver' ? 'accent' : 'glass');
  if (h.kind === 'portal') {
    const door = {
      ...h,
      shape: 'rect',
      height: Math.min(7.1, h.spring * 0.84),
      spring: Math.min(7.1, h.spring * 0.84),
    };
    pane(face, door, sd, recessed ? -0.73 : 0.08, 'door');
  }
  if (d >= 2) {
    archBand(face, h, sd, 0.36, 'trim', 0.09);
    if (h.kind === 'portal') archBand(face, h, sd, 0.9, 'trim', 0.16);
    const p = prepareOpening(h, 0, sd),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    if (h.name === 'front-rose') {
      const cy = h.bottom + h.height / 2,
        r = h.width / 2;
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        beam(
          face,
          p.point(Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18, -0.64 * sg),
          p.point(Math.cos(a) * r * 0.94, cy + Math.sin(a) * r * 0.94, -0.64 * sg),
          d === 2 ? 0.18 : 0.14,
          'trim',
        );
      }
      for (const rr of [d === 2 ? r * 0.2 : r * 0.19, r * 0.77])
        for (let i = 0; i < 24; i++) {
          const a = (i * Math.PI) / 12,
            b = ((i + 1) * Math.PI) / 12;
          beam(
            face,
            p.point(Math.cos(a) * rr, cy + Math.sin(a) * rr, -0.63 * sg),
            p.point(Math.cos(b) * rr, cy + Math.sin(b) * rr, -0.63 * sg),
            0.13,
            'trim',
          );
        }
      if (d >= 3)
        for (let i = 0; i < 12; i++) {
          const a = ((i + 0.5) * Math.PI) / 6,
            xc = Math.cos(a) * r * 0.55,
            yc = cy + Math.sin(a) * r * 0.55;
          for (let j = 0; j < 8; j++) {
            const v = (j * Math.PI) / 4,
              w = ((j + 1) * Math.PI) / 4;
            beam(
              face,
              p.point(xc + Math.cos(v) * r * 0.17, yc + Math.sin(v) * r * 0.17, -0.61 * sg),
              p.point(xc + Math.cos(w) * r * 0.17, yc + Math.sin(w) * r * 0.17, -0.61 * sg),
              0.11,
              'trim',
            );
          }
        }
    } else if (h.kind === 'louver') {
      const count = d === 2 ? 5 : 12;
      for (let i = 1; i <= count; i++) {
        const y = h.bottom + (h.spring * i) / (count + 1);
        beam(
          face,
          p.point(-h.width * 0.44, y, -0.65 * sg),
          p.point(h.width * 0.44, y, -0.65 * sg),
          0.17,
          'trim',
        );
      }
      // Two dark open-looking lancet heads above the pale shutter field.
      for (const t of [-0.23, 0.23])
        beam(
          face,
          p.point(t * h.width, h.bottom, -0.64 * sg),
          p.point(t * h.width, h.bottom + h.spring, -0.64 * sg),
          0.17,
          'trim',
        );
    } else {
      const top = h.bottom + (h.spring || h.height);
      for (const t of h.width > 4 ? [-0.23, 0, 0.23] : [0])
        beam(
          face,
          p.point(t * h.width, h.bottom, -0.64 * sg),
          p.point(t * h.width, top, -0.64 * sg),
          0.13,
          'trim',
        );
      if (h.kind === 'portal')
        beam(
          face,
          p.point(-h.width * 0.45, h.bottom + Math.min(7.1, h.spring * 0.84), -0.63 * sg),
          p.point(h.width * 0.45, h.bottom + Math.min(7.1, h.spring * 0.84), -0.63 * sg),
          0.18,
          'trim',
        );
    }
  }
}
function peak(face, p, b, t, r, d, slot = 'roof') {
  const ring = circle(p, r, d === 0 ? 4 : d === 1 ? 6 : 8, Math.PI / 8);
  profile(
    face,
    ring,
    [
      [b, 1],
      [t - 0.4, 0.03],
      [t, 0.015],
    ],
    slot,
  );
}
function crossTop(face, p, b, t, d, w = 0.18) {
  beam(face, at(p, b), at(p, t), w, d === 0 ? 'trim' : 'accent');
  const y = t - (t - b) * 0.28;
  beam(
    face,
    [p[0], floor + y, p[1] - (t - b) * 0.23],
    [p[0], floor + y, p[1] + (t - b) * 0.23],
    w,
    d === 0 ? 'trim' : 'accent',
  );
}
function dome(face, d) {
  const n = d === 0 ? 12 : d === 1 ? 16 : d === 2 ? 24 : 32,
    r = 14.45,
    steps = d === 0 ? 3 : d === 1 ? 5 : d === 2 ? 8 : 12,
    levels = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((i / steps) * Math.PI) / 2;
    levels.push([48 + 17 * Math.sin(a), Math.max(0.015, Math.cos(a))]);
  }
  profile(face, circle(dc, r, n), levels, 'roof');
  if (d >= 2)
    for (let k = 0; k < (d === 2 ? 8 : 16); k++) {
      const a = (k * Math.PI * 2) / (d === 2 ? 8 : 16),
        point = (j) => [
          dc[0] + Math.cos(a) * (r + 0.07) * Math.cos(((j / steps) * Math.PI) / 2),
          floor + 48 + 17 * Math.sin(((j / steps) * Math.PI) / 2) + 0.03,
          dc[1] + Math.sin(a) * (r + 0.07) * Math.cos(((j / steps) * Math.PI) / 2),
        ];
      for (let j = 1; j <= steps; j++) beam(face, point(j - 1), point(j), 0.14, 'roof');
    }
}
function gableFront(face, x, depth, z0, z1, b, t) {
  const p0 = [
      [z0, b],
      [z1, b],
      [(z0 + z1) / 2, t],
    ],
    ids = earcut(p0.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    for (const [xx, n] of [
      [x, -1],
      [x + depth, 1],
    ])
      face(
        'wall',
        ids.slice(i, i + 3).map((k) => [xx, floor + p0[k][1], p0[k][0]]),
        [n, 0, 0],
      );
  for (let i = 0; i < 3; i++) {
    const a = p0[i],
      q = p0[(i + 1) % 3];
    face(
      i === 2 || i === 1 ? 'roof' : 'trim',
      [
        [x, floor + a[1], a[0]],
        [x + depth, floor + a[1], a[0]],
        [x + depth, floor + q[1], q[0]],
        [x, floor + q[1], q[0]],
      ],
      [0, i === 0 ? -1 : 1, 0],
    );
  }
}
function flying(face, x, sg, d) {
  const z0 = sg * 21.9,
    z1 = sg * 13.55,
    w = 0.48,
    n = d === 2 ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const point = (j, dy) => {
        const t = j / n;
        return [z0 + (z1 - z0) * t, 20 + 8.2 * t + 1.6 * Math.sin(t * Math.PI) + dy];
      },
      a = point(i, 0),
      b = point(i + 1, 0),
      aa = point(i, 1.1),
      bb = point(i + 1, 1.1);
    for (const [xx, nx] of [
      [x - w, -1],
      [x + w, 1],
    ])
      face(
        'trim',
        [
          [xx, floor + a[1], a[0]],
          [xx, floor + b[1], b[0]],
          [xx, floor + bb[1], bb[0]],
          [xx, floor + aa[1], aa[0]],
        ],
        [nx, 0, 0],
      );
    face(
      'trim',
      [
        [x - w, floor + aa[1], aa[0]],
        [x + w, floor + aa[1], aa[0]],
        [x + w, floor + bb[1], bb[0]],
        [x - w, floor + bb[1], bb[0]],
      ],
      [0, 1, 0],
    );
    face(
      'trim',
      [
        [x - w, floor + a[1], a[0]],
        [x + w, floor + a[1], a[0]],
        [x + w, floor + b[1], b[0]],
        [x - w, floor + b[1], b[0]],
      ],
      [0, -1, 0],
    );
  }
}
function build(out, d) {
  const face = writer(out, d),
    all = fields(d),
    selected = d >= 2 ? all : d === 1 ? all.filter((h) => h.kind === 'portal') : [];
  for (const p of plans.low) {
    shell(out, d, p.outline, footing, 19, selected, 'wall');
    cap(face, p.outline, 19, 'wall', p.holes);
    const top = (p) => 26 - Math.min(7, (Math.max(0, Math.abs(p[1]) - 13.4) * 7) / 9.6);
    sides(face, p.outline, 19, (p) => floor + top(p), 'roof');
    cap(face, p.outline, (p) => floor + top(p), 'roof', p.holes);
  }
  for (const p of plans.nave) {
    shell(out, d, p.outline, footing, 30, selected);
    cap(face, p.outline, 30, 'wall');
  }
  for (const p of plans.naveRoof) gable(face, p.outline, 30, 40, 'roof');
  for (const p of plans.apseRoof) hip(face, p.outline, 30, 40, 'roof');
  for (const p of plans.front) {
    shell(out, d, p.outline, footing, 32, selected);
    cap(face, p.outline, 32, 'wall');
  }
  for (const p of plans.frontRoof) gable(face, p.outline, 32, 40, 'roof');
  gableFront(face, 52.65, 0.28, -8.95, 8.95, 32, 40);
  for (const p of plans.cross) {
    shell(out, d, p.outline, footing, 30, selected);
    cap(face, p.outline, 30, 'wall');
    gable(face, p.outline, 30, 40, 'roof', 1);
  }
  for (const [key, j] of [
    ['towerNorth', 0],
    ['towerSouth', 1],
  ]) {
    const r = plans[key][0].outline,
      p = rec.estimated.towerCenters[j];
    shell(
      out,
      d,
      r,
      footing,
      62,
      selected.filter((h) => h.name.startsWith(key)),
    );
    cap(face, r, 62, 'trim');
    if (d > 0) {
      band(face, r, 17.8, 0.5, 'trim', 1.015);
      band(face, r, 31.7, 0.65, 'trim', 1.04);
      band(face, r, 36, 0.3, 'trim', 1.01);
      band(face, r, 61.4, 0.6, 'trim', 1.04);
      for (const q of r) {
        solid(face, R(q[0] - 0.42, q[1] - 0.42, q[0] + 0.42, q[1] + 0.42), footing, 62, 'trim');
        peak(face, q, 62, 68, 0.65, d, 'trim');
        if (d >= 2) {
          solid(face, circle(q, 0.6, 6), 32.4, 37.5, 'trim');
          peak(face, q, 37.5, 43, 0.8, d, 'trim');
        }
      }
    }
    const roof = circle(p, 5.8, d === 0 ? 4 : 8, Math.PI / 8);
    profile(
      face,
      roof,
      [
        [62, 1],
        [88.6, 0.045],
        [89, 0.025],
      ],
      'roof',
    );
    crossTop(face, p, 89, 92, d, d === 0 ? 0.24 : 0.18);
    if (d >= 2)
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + Math.PI / 8;
        beam(
          face,
          [p[0] + Math.cos(a) * 5.82, floor + 62, p[1] + Math.sin(a) * 5.82],
          [p[0], floor + 89, p[1]],
          0.14,
          'roof',
        );
      }
  }
  const drum = circle(dc, 13.8, d === 0 ? 12 : d === 1 ? 16 : 32),
    dh = selected.filter((h) => h.name.startsWith('drum-'));
  shell(out, d, drum, 30, 48, dh);
  cap(face, drum, 48, 'trim');
  if (d > 0) {
    band(face, drum, 47.4, 0.6, 'trim', 1.035);
    band(face, drum, 40, 0.5, 'trim', 1.02);
  }
  dome(face, d);
  if (d > 0) {
    const lr = lanternRing(),
      lh = lanternFields(),
      inner = circle(dc, 1.15, 8, Math.PI / 8);
    shell(out, d, lr, 64.8, 68.0, lh, 'trim', inner);
    peak(face, dc, 68, 68.7, 2.0, d, 'roof');
  } else solid(face, circle(dc, 1.6, 6), 65, 68.7, 'roof');
  crossTop(face, dc, 68.7, 70, d, 0.15);
  if (d > 0) for (const h of all) feature(face, h, d);
  if (d > 0)
    for (const sg of [-1, 1])
      for (const x of [-34.8, -24.8, -14.8, 12, 21, 31, 41]) {
        const z = sg < 0 ? -22.95 : 23.1;
        solid(face, R(x - 0.6, z - 0.45, x + 0.6, z + 0.45), footing, 24.0, 'trim');
        peak(face, [x, z], 24, 28.4, 0.68, d, 'trim');
        if (d >= 2 && x < 40 && x > -34) flying(face, x, sg, d);
      }
  if (d >= 2) {
    for (const sg of [-1, 1]) {
      const f = edge(plans.cross[0].outline, [0, sg]);
      for (const p of [f.a, f.b]) {
        solid(face, R(p[0] - 0.45, p[1] - 0.35, p[0] + 0.45, p[1] + 0.35), footing, 32, 'trim');
        peak(face, p, 32, 37, 0.65, d, 'trim');
      }
    }
    // Broad front stone figures are simplified exterior accents, not named sculpture.
    for (const z of [-6.1, 6.2]) {
      solid(face, R(52.82, z - 0.45, 53.18, z + 0.45), 15.7, 16.1, 'trim');
      solid(face, R(52.86, z - 0.35, 53.12, z + 0.35), 16.1, 17.7, 'trim');
      solid(face, circle([53.0, z], 0.27, 6), 17.7, 18.2, 'trim');
    }
  }
  // A continuous landing connects the inset central portal to the broad front stairs.
  for (let k = 0; k < 6; k++)
    solid(
      face,
      R(52.6, -20.2 + (k * 40.4) / 6, 55.8, -20.2 + ((k + 1) * 40.4) / 6),
      footing,
      0.6,
      'trim',
    );
  const steps = d === 0 ? 1 : d === 1 ? 3 : 12;
  for (let i = 0; i < steps; i++)
    for (let k = 0; k < 6; k++) {
      const x0 = 55.8 + (i * 9) / steps,
        x1 = 55.8 + ((i + 1) * 9) / steps,
        z0 = -20.2 + (k * 40.4) / 6,
        z1 = -20.2 + ((k + 1) * 40.4) / 6;
      solid(face, R(x0, z0, x1, z1), footing, 0.6 - ((i + 1) * 4.2) / steps, 'trim');
    }
}
export const buildSaoPauloCathedralSkyline = (o) => build(o, 0),
  buildSaoPauloCathedralDistrict = (o) => build(o, 1),
  buildSaoPauloCathedralStreet = (o) => build(o, 2),
  buildSaoPauloCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const saoPauloCathedralStudy = {
  id: 'sao_paulo_cathedral',
  key: 'sao_paulo_cathedral',
  title: 'São Paulo Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1050668',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current16-vertex whole plus five component controls,56 vertices total. Twin-tower north-northeast front signs retained axis. Existing111m length/46m width agree closely; raw26/40/70/92m height tags retained.',
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
    'Four existing cached256-square coursed limestone,continuous limestone,oxidized copper and plain-wood graphs. Metric UVs,linear pale-stone/green-copper/wood tints and flat architectural normals; glazing/louver/metal accents use local PBR colors. No embedded images,unique facade maps or baked shadows.',
  importReason:
    'Four authored browser levels preserve mapped Gothic cathedral body,twin92m green spires,rose/pointed portals,40m roofs and70m broad dome/open lantern.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from inspected2025 full front,2026 low-angle front detail and older undated elevated city overview plus standard viewer PMTiles/DEM. An interior picture with a misleading lateral title was excluded. Raw height controls and existing dimension facts retained; measurement datum and internal eave/stage levels remain approximate. Hidden side/rear window rhythm,buttresses/flying arches,apse roofs/chapel functions,current finish,fine sculpture/tracery,inscriptions and interiors are estimated,simplified or excluded. Physical phone/laptop timings pending.',
    'Skyline retains twin green spires,central pointed facade,gabled nave/transepts,faceted apse and broad green dome/lantern;small fields/ornament omitted. District adds shared surfaces,flat fields and actual deep main portal recesses/open lantern. Street adds recessed glazing,geometric rose,shutter rows,buttresses/flying arches and broad stone figures;closeup/master refine profiles,tracery and ribs. Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('pointed-portals-rose-and-front-tiers', [121, 27, 48], [51, 20, 0]),
    cam('twin-upper-towers-and-green-spires', [103, 83, 85], [48, 61, 0]),
    cam('west-aisle-and-flying-buttresses', [-60, 45, -109], [-15, 23, -9]),
    cam('east-transept-and-faceted-apse', [-91, 46, 96], [-18, 23, 7]),
    cam('green-dome-and-open-lantern', [48, 91, 70], [1.82, 52, 0.88]),
    cam('roof-and-signed-map-frame', [0, 222, 1], [0, 27, 0]),
  ],
};

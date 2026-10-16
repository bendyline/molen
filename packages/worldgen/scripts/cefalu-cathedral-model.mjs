/** Cefalù: unequal crowns, blind-arcaded porch front, barrel crossing and triple apses. */
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
  '../../../content/worldgen/source/places/sq/sqc/n0357_cefalu_cathedral/',
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
  wall: '#cbb38b',
  trim: '#e0cfae',
  apse: '#e3d9bf',
  roof: '#aa7454',
  stone: '#b0a58e',
  door: '#78543a',
  glass: '#4d6178',
  vault: '#9a978a',
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
const footing = (p) => Math.min(floor - 0.3, cefaluGround(...p) - 0.35);
export function cefaluGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Cefalu cathedral footing outside retained terrain');
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
function onFace(name, r, n, t, w, b, h, s = h, shape = 'pointed', depth = 5) {
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
const towerNames = ['northTower', 'southTower'];
const regular = (p, r, n = 8, off = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(off + (i * 2 * Math.PI) / n),
    p[1] + r * Math.sin(off + (i * 2 * Math.PI) / n),
  ]);
const arcPlan = (a, d) => {
  const n = d === 0 ? 5 : d === 1 ? 8 : d === 2 ? 16 : 32;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = -Math.PI / 2 + (i * Math.PI) / n;
    return [a.center[0] + a.radius[0] * Math.cos(t), a.center[1] + a.radius[1] * Math.sin(t)];
  });
};
export function cefaluApseWindows(d = 3) {
  const hs = [];
  for (const a of rec.apses) {
    const r = arcPlan(a, d);
    for (const angle of a.name === 'central' ? [-Math.PI / 3, 0, Math.PI / 3] : [0]) {
      const n = [Math.cos(angle), Math.sin(angle)],
        f = r
          .map((_, i) => faceFrame(r, i))
          .sort(
            (a, b) =>
              b.normal[0] * n[0] + b.normal[1] * n[1] - (a.normal[0] * n[0] + a.normal[1] * n[1]),
          )[0];
      hs.push(
        hole(
          `apse-${a.name}-${angle}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          a.name === 'central' ? 2.6 : 1.7,
          a.name === 'central' ? 12 : 11.3,
          a.name === 'central' ? 12 : 6.5,
          a.name === 'central' ? 9.5 : 4.9,
        ),
      );
    }
  }
  return hs;
}
export function cefaluWindows() {
  const hs = [];
  for (const side of [-1, 1]) {
    const r = plan('nave'),
      f = edge(r, [0, side]);
    for (let i = 0; i < 7; i++)
      hs.push(
        hole(
          `nave-${side}-${i}`,
          lerp(f.a, f.b, (i + 0.5) / 7),
          f.axis,
          f.normal,
          1.6,
          16.1,
          4.7,
          3.5,
          'round',
        ),
      );
    const r0 = plan('lower'),
      f0 = edge(r0, [0, side]);
    for (let i = 0; i < 7; i++)
      hs.push(
        hole(
          `aisle-${side}-${i}`,
          lerp(f0.a, f0.b, (i + 0.5) / 7),
          f0.axis,
          f0.normal,
          2,
          6.2,
          5.8,
          4.6,
        ),
      );
    const v = edge(plan('vault'), [0, side]);
    hs.push(hole(`transept-${side}`, lerp(v.a, v.b, 0.5), v.axis, v.normal, 3.6, 14.5, 10.3, 7.5));
    const ch = edge(plan('choir'), [0, side]);
    for (const t of [0.24, 0.72])
      hs.push(
        hole(`choir-${side}-${t}`, lerp(ch.a, ch.b, t), ch.axis, ch.normal, 2.2, 19, 9.3, 7.0),
      );
  }
  hs.push(onFace('central-front-window', plan('front'), [-1, 0], 0.5, 3.7, 12.2, 5, 3.2, 'round'));
  return hs;
}
export function cefaluBlindFields() {
  const f = edge(plan('front'), [-1, 0]),
    hs = [];
  for (let i = 0; i < 8; i++) {
    const t = (i + 0.5) / 8;
    if (Math.abs(t - 0.5) < 0.2) continue;
    hs.push(
      hole(
        `front-blind-lower-${i}`,
        lerp(f.a, f.b, t),
        f.axis,
        f.normal,
        1.85,
        10.9,
        3.0,
        2.1,
        'pointed',
        2,
      ),
    );
  }
  for (let i = 0; i < 10; i++)
    hs.push(
      hole(
        `front-blind-upper-${i}`,
        lerp(f.a, f.b, (i + 0.5) / 10),
        f.axis,
        f.normal,
        1.15,
        17.5,
        3.5,
        2.65,
        'round',
        2,
      ),
    );
  return hs;
}
export function cefaluDoor() {
  return onFace('main-wood-door', plan('front'), [-1, 0], 0.5, 3.4, 0.1, 6.3, 4.6, 'round');
}
export function cefaluPorch() {
  const r = plan('porch'),
    f = edge(r, [-1, 0]);
  return {
    r,
    inner: scaled(r, 0.8),
    holes: [
      hole(
        'porch-middle',
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        6.0,
        0.1,
        8.6,
        6.2,
        'pointed',
        15,
      ),
      hole(
        'porch-north',
        lerp(f.a, f.b, 0.17),
        f.axis,
        f.normal,
        4.6,
        0.1,
        7.3,
        5.3,
        'pointed',
        15,
      ),
      hole(
        'porch-south',
        lerp(f.a, f.b, 0.83),
        f.axis,
        f.normal,
        4.6,
        0.1,
        7.3,
        5.3,
        'pointed',
        15,
      ),
    ],
  };
}
function panel(face, h, d, slot = 'glass', depth = 1.15) {
  pane(face, h, d, d >= 2 ? -depth : 0.12, slot);
  if (d >= 2) archBand(face, h, d, 0.25, 'trim', 0.17);
  if (d >= 2 && h.name.includes('pair')) {
    const p = h.center.map((v, k) => v - h.normal[k] * 0.94);
    beam(face, [p[0], h.bottom, p[1]], [p[0], h.bottom + h.spring, p[1]], 0.16, 'trim');
    for (const sign of [-1, 1]) {
      const child = hole(
        'paired-round-head',
        h.center.map((v, k) => v + h.axis[k] * h.width * 0.25 * sign),
        h.axis,
        h.normal,
        h.width * 0.42,
        h.bottom - floor,
        h.height * 0.83,
        h.height * 0.65,
        'round',
      );
      archBand(face, child, d, 0.11, 'trim', -0.9);
    }
  }
}
function cone(face, r, b, t, slot = 'trim') {
  const p = center(r);
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(slot, [at(r[i], b), at(r[j], b), at(p, t)], [0, 1, 0]);
  }
}
function fanRoof(face, r, ct, b, t, slot = 'roof') {
  for (let i = 0; i < r.length - 1; i++)
    face(slot, [at(r[i], b), at(r[i + 1], b), at(ct, t)], [0, 1, 0]);
  face(slot, [at(r.at(-1), b), at(r[0], b), at(ct, t)], [0, 1, 0]);
}
function clipX(r, lo, hi) {
  let ps = r;
  for (const [x, sign] of [
    [lo, 1],
    [hi, -1],
  ]) {
    const out = [];
    let a = ps.at(-1),
      av = (a[0] - x) * sign;
    for (const b of ps) {
      const bv = (b[0] - x) * sign;
      if (av >= 0 !== bv >= 0) {
        const t = av / (av - bv);
        out.push(lerp(a, b, t));
      }
      if (bv >= 0) out.push(b);
      a = b;
      av = bv;
    }
    ps = out;
    if (ps.length < 3) return [];
  }
  return ps;
}
function vaultRoof(face, d) {
  const r = plan('vault'),
    n = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 12 : 24,
    lo = Math.min(...r.map((p) => p[0])),
    hi = Math.max(...r.map((p) => p[0])),
    y = (p) => floor + 27.2 + 5.8 * Math.sqrt(Math.max(0, 1 - ((p[0] - 9.65) / 5.8) ** 2));
  for (let i = 0; i < n; i++) {
    const a = lo + ((hi - lo) * i) / n,
      b = lo + ((hi - lo) * (i + 1)) / n,
      q = clipX(r, a, b);
    if (q.length < 3) continue;
    cap(face, q, y, 'vault');
    for (let j = 0; j < q.length; j++) {
      const f = faceFrame(q, j);
      if (Math.abs(f.normal[1]) < 0.7) continue;
      face(
        'wall',
        [at(f.a, 27.2), at(f.b, 27.2), at(f.b, y), at(f.a, y)],
        [f.normal[0], 0, f.normal[1]],
      );
    }
  }
}
function body(out, face, d) {
  const windows = cefaluWindows(),
    blinds = cefaluBlindFields(),
    door = cefaluDoor();
  if (d >= 1)
    solid(
      face,
      d === 1 ? coarse(rec.main.polygons[0].outline) : rec.main.polygons[0].outline,
      footing,
      0.1,
      'stone',
    );
  for (const p of rec.lowerPlan) {
    const r = d <= 1 ? coarse(p.outline) : p.outline,
      hs = windows.filter((h) => h.name.startsWith('aisle'));
    if (d >= 2) shell(out, d, r, footing, 13.5, hs);
    else sides(face, r, footing, 13.5, 'wall');
  }
  for (const p of rec.lowerRoofs) {
    const r = d <= 1 ? coarse(p.outline) : p.outline,
      y = (q) =>
        floor + 13.5 + 3 * (1 - Math.min(1, Math.max(0, (Math.abs(q[1] - 0.25) - 7.3) / 10.5)));
    cap(face, r, y, 'roof', p.holes);
  }
  for (const [name, wall, top, axis] of [
    ['front', 22, 22, 0],
    ['nave', 22, 25.5, 0],
    ['vault', 27.2, 33, 1],
    ['choir', 31, 36.5, 0],
    ['northRange', 20, 24, 0],
    ['southRange', 20, 24, 0],
  ]) {
    const r = d <= 1 ? coarse(plan(name)) : plan(name),
      hs =
        name === 'front'
          ? [windows.find((h) => h.name === 'central-front-window'), door, ...blinds]
          : windows.filter((h) => h.name.startsWith(name === 'vault' ? 'transept' : name));
    if (d >= 2) shell(out, d, r, footing, wall, hs);
    else sides(face, r, footing, wall, 'wall');
    if (name === 'vault') vaultRoof(face, d);
    else if (top === wall) cap(face, r, top, 'stone');
    else gable(face, r, wall, top, 'roof', axis);
    if (d) band(face, r, wall - 0.18, 0.32, 'trim', 1.01);
  }
  const porch = cefaluPorch(),
    r = d <= 1 ? coarse(porch.r) : porch.r;
  if (d >= 1) shell(out, d, r, 0.1, 9.2, porch.holes, 'wall', porch.inner);
  else {
    for (const u of [0, 0.33, 0.67, 1]) {
      const f = edge(r, [-1, 0]),
        p = lerp(f.a, f.b, u);
      solid(face, R(p[0] - 0.48, p[1] - 0.48, p[0] + 0.48, p[1] + 0.48), footing, 9.2, 'wall');
    }
  }
  cap(face, r, 9.25, 'stone');
  if (d) band(face, r, 9.2, 0.45, 'trim', 1.025);
  if (d >= 2) {
    for (const h of porch.holes) archBand(face, h, d, 0.34, 'trim', 0.16);
    const front = edge(r, [-1, 0]);
    for (const t of [0, 0.33, 0.67, 1]) {
      const p = lerp(front.a, front.b, t);
      solid(face, R(p[0] - 0.35, p[1] - 0.35, p[0] + 0.35, p[1] + 0.35), 0.1, 6.0, 'trim');
      solid(face, R(p[0] - 0.53, p[1] - 0.53, p[0] + 0.53, p[1] + 0.53), 5.9, 6.25, 'trim');
    }
  }
  if (d) {
    for (const h of windows) panel(face, h, d);
    panel(face, door, d, 'door');
    for (const h of blinds) panel(face, h, d, 'wall', 0.46);
    if (d >= 2) {
      const h = windows.find((h) => h.name === 'central-front-window');
      for (const w of [0.47, 0.75]) archBand(face, h, d, w, 'trim', 0.05 + w * 0.3);
    }
  }
  if (d >= 2)
    for (const side of [-1, 1]) {
      const f = edge(plan('nave'), [0, side]);
      for (let i = 0; i < 8; i++) {
        const p = lerp(f.a, f.b, i / 7);
        beam(face, at(p, 15.4), at(p, 22), 0.2, 'trim');
      }
    }
  stairs(face, d);
}
export function cefaluTowerWindows() {
  const hs = [];
  for (const name of towerNames) {
    const r = plan(name);
    for (const n of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      for (const [b, h, w, pair] of [
        [9.2, 4.8, 2.5, false],
        [16.5, 4.8, 3.3, true],
        [23.3, 5.1, 3.4, true],
      ]) {
        const q = onFace(
          `${name}-${n.join(',')}-${b}-${pair ? 'pair' : 'single'}`,
          r,
          n,
          0.5,
          w,
          b,
          h,
          h * 0.72,
        );
        const covered = [
          { rings: [plan('front')], top: 22 },
          { rings: rec.lowerPlan.map((p) => p.outline), top: 16.5 },
        ].some(
          (v) =>
            v.top > b + h * 0.4 &&
            [-0.4, 0, 0.4].some((t) =>
              v.rings.some((r) =>
                inside(
                  q.center.map((x, k) => x + q.normal[k] * 0.4 + q.axis[k] * q.width * t),
                  r,
                ),
              ),
            ),
        );
        if (!covered) hs.push(q);
      }
  }
  return hs;
}
export function cefaluBelfries() {
  return towerNames.map((name, i) => {
    const r = scaled(coarse(plan(name)), 0.68),
      ct = center(r),
      holes = r.map((_, j) => {
        const f = faceFrame(r, j);
        return hole(
          `${name}-belfry-${j}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          i === 0 ? 2.4 : 3.2,
          32.2,
          i === 0 ? 3.8 : 4.6,
          i === 0 ? 2.7 : 3.5,
          'pointed',
          5,
        );
      });
    return { name, r, center: ct, holes, top: i === 0 ? 37.8 : 38.6 };
  });
}
function merlons(face, r, y, d) {
  const rr = coarse(r);
  for (let i = 0; i < rr.length; i++) {
    const f = faceFrame(rr, i),
      count = d === 0 ? 2 : 4;
    for (let k = 0; k < count; k++) {
      const p = lerp(f.a, f.b, k / count);
      solid(face, R(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25), y, y + 0.85, 'trim');
    }
  }
}
function towers(out, face, d) {
  const ws = cefaluTowerWindows();
  for (const g of cefaluBelfries(d)) {
    const r = d <= 1 ? coarse(plan(g.name)) : plan(g.name),
      hs = ws.filter((h) => h.name.startsWith(g.name));
    solid(face, r, footing, 0.1, 'stone');
    if (d >= 2) shell(out, d, r, 0.1, 30, hs);
    else solid(face, r, footing, 30, 'wall');
    if (d) for (const y of [8.8, 15.9, 22.8, 29.8]) band(face, r, y, 0.35, 'trim', 1.025);
    if (d) for (const h of hs) panel(face, h, d);
    if (d >= 1) shell(out, d, g.r, 30.3, g.top, g.holes, 'wall', scaled(g.r, 0.74));
    else {
      for (const q of coarse(g.r))
        sides(face, R(q[0] - 0.45, q[1] - 0.45, q[0] + 0.45, q[1] + 0.45), 30.3, g.top, 'wall');
    }
    cap(face, r, 30.05, 'stone');
    band(face, g.r, g.top - 0.1, 0.35, 'trim', 1.05);
    cap(face, g.r, g.top, 'trim');
    if (g.name === 'northTower')
      cone(face, regular(g.center, 3.25, d === 0 ? 6 : 8, Math.PI / 8), g.top, 44);
    else cone(face, scaled(coarse(g.r), 0.96), g.top, 44);
    if (d >= 2) {
      if (g.name === 'southTower') merlons(face, r, 30, d);
      merlons(face, g.r, g.top - 0.15, d);
      if (g.name === 'northTower')
        for (let j = 0; j < g.r.length; j++) {
          const f = faceFrame(g.r, j);
          for (const t of [0.2, 0.5, 0.8]) {
            const h = hole(
              'crown-blind',
              lerp(f.a, f.b, t),
              f.axis,
              f.normal,
              1.05,
              36.3,
              1.25,
              0.6,
            );
            archBand(face, h, d, 0.15, 'trim', 0.12);
          }
        }
      for (const h of g.holes) {
        if (g.name === 'southTower') {
          const p = h.center.map((v, k) => v - h.normal[k] * 0.8);
          beam(face, [p[0], h.bottom, p[1]], [p[0], h.bottom + 3.2, p[1]], 0.16, 'trim');
        }
      }
    }
  }
}
function apses(out, face, d) {
  const windows = cefaluApseWindows(d);
  for (const a of rec.apses) {
    const r = arcPlan(a, d),
      hs = windows.filter((h) => h.name.startsWith(`apse-${a.name}-`));
    if (d >= 2) shell(out, d, r, footing, a.wall, hs, a.slot);
    else sides(face, r, footing, a.wall, a.slot);
    fanRoof(face, r, a.center, a.wall, a.top, a.name === 'central' ? 'vault' : 'roof');
    if (d) {
      band(face, r, a.wall - 0.25, 0.4, 'trim', 1.015);
      for (const h of hs) panel(face, h, d);
    }
    if (d >= 2) {
      const n = a.name === 'central' ? 9 : 5,
        b = a.name === 'central' ? 3.2 : 5.8,
        t = a.name === 'central' ? 27.1 : 16.6;
      for (let i = 0; i <= n; i++) {
        const angle = -Math.PI / 2 + (i * Math.PI) / n,
          p = [
            a.center[0] + a.radius[0] * Math.cos(angle),
            a.center[1] + a.radius[1] * Math.sin(angle),
          ];
        solid(face, regular(p, a.name === 'central' ? 0.19 : 0.14, d >= 3 ? 8 : 6), b, t, 'trim');
        solid(
          face,
          R(p[0] - 0.36, p[1] - 0.36, p[0] + 0.36, p[1] + 0.36),
          t - 0.15,
          t + 0.35,
          'trim',
        );
      }
      for (let i = 0; i < n; i++) {
        const theta = -Math.PI / 2 + ((i + 0.5) * Math.PI) / n,
          p = [
            a.center[0] + a.radius[0] * Math.cos(theta),
            a.center[1] + a.radius[1] * Math.sin(theta),
          ],
          normal = unit([Math.cos(theta) / a.radius[0], Math.sin(theta) / a.radius[1]]),
          axis = [-normal[1], normal[0]],
          h = hole(
            'apse-blind',
            p,
            axis,
            normal,
            ((Math.PI * Math.min(...a.radius)) / n) * 0.86,
            t,
            a.wall - t - 0.65,
            (a.wall - t - 0.65) * 0.6,
          );
        archBand(face, h, d, 0.15, 'trim', 0.15);
      }
    }
    if (a.name === 'central')
      for (const z of [-9.4, 8.2])
        solid(face, R(29.6, z - 0.65, 31.2, z + 0.65), footing, 33.1, 'wall');
  }
}
function stairs(face, d) {
  const f = edge(plan('porch'), [-1, 0]),
    mid = lerp(f.a, f.b, 0.5),
    w = 7.8,
    len = 16,
    steps = d === 0 ? 1 : d === 1 ? 10 : 28,
    point = (u, v) => mid.map((x, k) => x + f.axis[k] * u + f.normal[k] * v),
    lower = Math.min(...[-w, w].map((u) => cefaluGround(...point(u, len))));
  if (d === 0) {
    const r = [point(-w, 0), point(w, 0), point(w, len), point(-w, len)],
      top = [0.1, 0.1, lower - floor, lower - floor];
    face(
      'stone',
      r.map((p, i) => at(p, top[i])),
    );
    face('stone', [at(r[2], footing), at(r[3], footing), at(r[3], top[3]), at(r[2], top[2])]);
    for (const [a, b] of [
      [0, 3],
      [1, 2],
    ])
      face('stone', [at(r[a], footing), at(r[b], footing), at(r[b], top[b]), at(r[a], top[a])]);
    return;
  }
  for (let i = 0; i < steps; i++) {
    const a = (i * len) / steps,
      b = ((i + 1) * len) / steps,
      top = 0.1 - ((floor + 0.1 - lower) * i) / steps,
      r = [point(-w, a), point(w, a), point(w, b), point(-w, b)],
      next = i + 1 === steps ? lower - floor : 0.1 - ((floor + 0.1 - lower) * (i + 1)) / steps;
    cap(face, r, top, 'stone');
    face(
      'stone',
      [at(r[2], next), at(r[3], next), at(r[3], top), at(r[2], top)],
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
      const max = d === 0 ? 36 : d === 1 ? 24 : 16;
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
  apses(out, face, d);
}
export const buildCefaluSkyline = (o) => build(o, 0),
  buildCefaluDistrict = (o) => build(o, 1),
  buildCefaluStreet = (o) => build(o, 2),
  buildCefaluCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const cefaluStudy = {
  id: 'N0357',
  key: 'cefalu_cathedral',
  title: 'Cefalù Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1354756',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way and current unscaled main cathedral outline. West twin tower corners, triple eastern apses and neighboring northern cloister sign the frame.',
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
    'Five existing256-square raw limestone,lime plaster,ceramic tile,granite and plain wood graphs. Warm stone/pale trim,uniform pale central apse,terracotta roofs and gray barrel/apse roof use linear tints and metric UVs. Flat blue-gray glazing. No embedded images or baked weather/soot/shadows; exact marble texture/sculpture is not bespoke.',
  importReason:
    'Four browser levels retain individual unequal-crowned twin towers,blind-arcaded west facade/open porch,raised nave,barrel crossing and tall triple eastern apses at signed Cefalù placement.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from2017 front/east and1997 elevated pictures plus standard viewer PMTiles/DEM only. All heights,wall/eave/roof/stage partitions,apse curves,windows/columns/cornices,biforia and steps are estimates. Later restoration/roof-state changes not independently verified. Separate northern cloister and urban buildings remain host content. Exact statues,gate ironwork,inscriptions,mosaics,full interiors and certified walking excluded. Physical device timings and exact terrain thresholds pending.',
    'Skyline retains major masses,coarse unequal crowns,open four-post upper belfries,barrel/three apse silhouettes and inclined front entry. District adds shared graphs,flat windows/closed door/blind fields and actual open porch/upper belfries. Street opens facade/apse/window recesses and adds columns,cornices,mullions,crenels and steps. Closeup/master refine curve facets,blind arcades and crown detail. Curvature,openings,ornament and step profiles change visibly. Synthetic Swedish-cottage neighbors are not local map buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('unequal-tower-crowns', [-91, 42, 27], [-35, 32, 0]),
    cam('three-arch-porch-and-blind-facade', [-82, 16, -1], [-36, 11, 0]),
    cam('raised-nave-and-aisles', [-5, 30, -62], [-5, 17, -3]),
    cam('tall-triple-eastern-apses', [86, 62, -48], [28, 22, 0]),
    cam('barrel-crossing-and-high-choir', [35, 125, 64], [13, 29, 1]),
    cam('entry-stairs-and-open-portico', [-69, 10, 18], [-42, 4, 1]),
  ],
};

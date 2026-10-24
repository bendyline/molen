/** San Thome Basilica: offset Gothic needle, crossing spire, red roofs and pointed galleries. */
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
  '../../../content/worldgen/source/places/tf/tf3/san_thome_basilica/',
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
  wall: '#ece9df',
  spire: '#b48c7c',
  trim: '#f4f0e5',
  roof: '#a85f48',
  door: '#71533c',
  glass: '#4c6069',
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
const footing = (p) => Math.min(floor - 0.3, sanThomeGround(...p) - 0.35);
export function sanThomeGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('San Thome Basilica footing outside retained terrain');
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

const plans = rec.plans,
  main = rec.main.polygons[0].outline,
  tower = plans.tower,
  back = faceFrame(plans.porch, 1),
  west = { ...back, normal: back.normal.map((v) => -v) },
  point = (f, t = 0.5) => lerp(f.a, f.b, t),
  along = (f, x, k = 0) => point(f, (x - f.a[k]) / (f.b[k] - f.a[k])),
  mid = (r) =>
    [0, 1].map((k) => (Math.min(...r.map((p) => p[k])) + Math.max(...r.map((p) => p[k]))) / 2),
  nave = plans.naveRoof.map((p, i) => (i === 0 || i === 3 ? along(west, p[1], 1) : p)),
  tc = mid(tower),
  crossing = [9.1, 0];
const window = (
  name,
  f,
  p,
  w,
  b,
  h,
  s = h * 0.7,
  kind = 'window',
  shape = 'pointed',
  depth = 5,
) => ({ ...hole(name, p, f.axis, f.normal, w, b, h, s, shape, depth), kind });
const side = (name) => ({
  a: [-20.7, name === 'south' ? 9.784363780166943 : -8.695671721114243],
  b: [3.25, name === 'south' ? 9.784363780166943 : -8.695671721114243],
  axis: [1, 0],
  normal: [0, name === 'south' ? 1 : -1],
  length: 23.95,
});
function radial(p, r, n = 8, angle = Math.PI / 8) {
  return Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos(angle + (i * 2 * Math.PI) / n) * r,
    p[1] + Math.sin(angle + (i * 2 * Math.PI) / n) * r,
  ]);
}
export function sanThomeOctagon() {
  return radial(tc, 3.05);
}
export function sanThomeFields() {
  const fields = [];
  for (const [j, z] of [-4.5, 0, 4.5].entries()) {
    fields.push(window(`west-door-${j}`, west, along(west, z, 1), 2.6, 0.2, 5, 3.4, 'door'));
    fields.push(window(`west-high-${j}`, west, along(west, z, 1), 2.25, 8.5, 6.2, 4.4));
  }
  const westO = window('west-oculus', west, along(west, 0, 1), 1.4, 16.4, 1.4, 0.7);
  westO.shape = 'circle';
  fields.push(westO);
  const pf = edge(plans.porch, [-1, 0]);
  for (const [j, z] of [-4.5, 0, 4.5].entries())
    fields.push(
      window(`west-porch-arch-${j}`, pf, along(pf, z, 1), 3.2, 0, 4.8, 3.2, 'porch', 'pointed', 10),
    );
  for (const name of ['north', 'south']) {
    const f = side(name);
    for (const [i, x] of [-18, -13.4, -8.8, -4.2, 0.4].entries()) {
      fields.push(
        window(
          `${name}-lower-${i}`,
          f,
          [x, f.a[1]],
          2.65,
          i === 4 ? 0.2 : 1.6,
          i === 4 ? 6.2 : 4.8,
          i === 4 ? 4.6 : 3.2,
          i === 4 ? 'door' : 'window',
        ),
      );
      fields.push(window(`${name}-upper-${i}`, f, [x, f.a[1]], 2.35, 8.8, 3.7, 2.5));
    }
    const r = plans[name === 'south' ? 'southChapel' : 'northChapel'];
    for (let i = 0; i < r.length; i++) {
      const q = faceFrame(r, i);
      if (q.length < 4 || q.normal[0] < -0.5 || q.normal[1] * (name === 'south' ? 1 : -1) < -0.2)
        continue;
      const count = Math.max(1, Math.floor(q.length / 6));
      for (let j = 0; j < count; j++)
        if (point(q, (j + 0.5) / count)[0] > 16)
          fields.push(
            window(
              `${name}-chapel-${i}-${j}`,
              q,
              point(q, (j + 0.5) / count),
              Math.min(2.7, (q.length / count) * 0.5),
              1.5,
              5.1,
              3.5,
            ),
          );
    }
    const tr = edge(plans.transept, [0, name === 'south' ? 1 : -1]);
    fields.push(window(`${name}-transept-door`, tr, point(tr), 2.7, 0.2, 5.5, 3.8, 'door'));
    fields.push(window(`${name}-transept-high`, tr, point(tr), 4, 8.1, 5.7, 3.9));
    const o = window(`${name}-transept-oculus`, tr, point(tr), 1.7, 16.5, 1.7, 0.85);
    o.shape = 'circle';
    fields.push(o);
  }
  for (let i = 0; i < plans.choir.length; i++) {
    const f = faceFrame(plans.choir, i);
    if (f.normal[0] < -0.6 || f.length < 3) continue;
    const count = Math.max(1, Math.floor(f.length / 6));
    for (let j = 0; j < count; j++)
      fields.push(
        window(
          `choir-${i}-${j}`,
          f,
          point(f, (j + 0.5) / count),
          Math.min(2.7, (f.length / count) * 0.52),
          6,
          6.9,
          4.7,
        ),
      );
  }
  for (let i = 0; i < tower.length; i++) {
    const f = faceFrame(tower, i);
    if (f.normal[1] < -0.4 || f.length < 5) continue;
    const c = point(f);
    if (f.normal[0] < -0.7) fields.push(window('tower-entrance', f, c, 2.7, 0.2, 5.8, 4, 'door'));
    for (const u of [-1.25, 0, 1.25])
      fields.push(
        window(
          `tower-triple-${i}-${u}`,
          f,
          c.map((v, k) => v + f.axis[k] * u),
          0.86,
          8,
          4,
          2.7,
        ),
      );
    for (const u of [-0.63, 0.63])
      fields.push(
        window(
          `tower-pair-${i}-${u}`,
          f,
          c.map((v, k) => v + f.axis[k] * u),
          0.93,
          14.0,
          4.5,
          3.2,
        ),
      );
  }
  const oct = sanThomeOctagon();
  for (let i = 0; i < oct.length; i++) {
    const f = faceFrame(oct, i);
    fields.push(window(`tower-oct-lancet-${i}`, f, point(f), 1.02, 21.1, 4.2, 3.0));
    const o = window(`tower-oct-oculus-${i}`, f, point(f), 0.73, 26.3, 0.73, 0.365);
    o.shape = 'circle';
    fields.push(o);
  }
  return fields;
}
function disk(face, h, d) {
  const n = d >= 3 ? 12 : 8,
    cy = h.bottom + h.width / 2,
    rad = h.width / 2,
    p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    ring = Array.from({ length: n }, (_, i) => [
      Math.cos((i * 2 * Math.PI) / n) * rad,
      cy + Math.sin((i * 2 * Math.PI) / n) * rad,
    ]);
  face(
    'glass',
    ring.map((q) => p.point(...q, 0.1 * sg)),
    [h.normal[0], 0, h.normal[1]],
  );
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      outer = (q) => [(q[0] * (rad + 0.18)) / rad, cy + ((q[1] - cy) * (rad + 0.18)) / rad];
    face(
      'trim',
      [
        p.point(...ring[i], 0.13 * sg),
        p.point(...ring[j], 0.13 * sg),
        p.point(...outer(ring[j]), 0.13 * sg),
        p.point(...outer(ring[i]), 0.13 * sg),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
}
function facade(face, h, d) {
  if (h.kind === 'porch') return;
  if (h.shape === 'circle') {
    disk(face, h, d);
    return;
  }
  pane(face, h, d, d >= 2 ? -0.75 : 0.06, h.kind === 'door' ? 'door' : 'glass');
  if (d >= 2) {
    archBand(face, h, d, 0.25, 'trim', 0.08);
    if (h.kind === 'door') return;
    const p = prepareOpening(h, 0, d),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    if (h.width > 2.0)
      beam(
        face,
        p.point(0, h.bottom, -0.64 * sg),
        p.point(0, h.bottom + h.spring, -0.64 * sg),
        0.13,
        'trim',
      );
    if (d >= 3 && h.width > 2.5)
      for (const u of [-0.22, 0.22])
        beam(
          face,
          p.point(h.width * u, h.bottom + h.spring, -0.62 * sg),
          p.point(0, h.bottom + h.height - 0.35, -0.62 * sg),
          0.12,
          'trim',
        );
  }
}
function pinnacle(face, p, b, top, d, r = 0.42) {
  const n = d === 0 ? 4 : 8,
    r0 = radial(p, r, n, Math.PI / 4);
  if (d >= 1) {
    solid(face, r0, b, b + (top - b) * 0.28, 'trim');
    band(face, r0, b + (top - b) * 0.24, 0.18, 'trim', 1.14);
  }
  profile(
    face,
    r0,
    [
      [d === 0 ? b : b + (top - b) * 0.29, 1],
      [top - 0.18, 0.1],
    ],
    'trim',
  );
}
function crossTop(face, p, b, top, d) {
  if (d === 0) {
    beam(face, at(p, b), at(p, top), 0.2, 'trim');
    return;
  }
  beam(face, at(p, b), at(p, top), 0.16, 'trim');
  beam(face, at([p[0] - 0.5, p[1]], top - 0.5), at([p[0] + 0.5, p[1]], top - 0.5), 0.14, 'trim');
}
function buttresses(face, d) {
  if (d < 1) return;
  for (const name of ['north', 'south']) {
    const f = side(name);
    for (const x of [-20.5, -15.7, -11.1, -6.5, -1.9, 2.8]) {
      const p = [x, f.a[1] + f.normal[1] * 0.3],
        r = _R(x - 0.34, p[1] - 0.5, x + 0.34, p[1] + 0.5);
      profile(
        face,
        r,
        [
          [0, 1.35],
          [5.9, 1.1],
          [6.3, 0.85],
          [12.7, 0.8],
          [14.5, 0.6],
        ],
        'wall',
      );
      pinnacle(face, p, 14.5, 17.8, d, 0.32);
    }
    const r = plans[name === 'south' ? 'southChapel' : 'northChapel'];
    for (const p of r.filter((p) => p[0] > 15)) {
      solid(face, _R(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25), 0, 8.4, 'wall');
      pinnacle(face, p, 8.4, 11.6, d, 0.32);
    }
  }
  for (const p of plans.choir.slice(1)) pinnacle(face, p, 14.5, 17.6, d, 0.34);
  for (const name of ['north', 'south']) {
    const f = edge(plans.transept, [0, name === 'south' ? 1 : -1]);
    for (const p of [f.a, f.b]) pinnacle(face, p, 14.5, 20.3, d, 0.42);
  }
}
function build(target, d) {
  const limit = d === 0 ? 30 : d === 1 ? 20 : 14,
    out = {
      addTriangle(slot, ref, p, n, uv, col) {
        const lengths = [0, 1, 2].map((i) =>
            Math.hypot(...p[i].map((v, k) => v - p[(i + 1) % 3][k])),
          ),
          i = lengths.indexOf(Math.max(...lengths));
        if (lengths[i] > limit) {
          const j = (i + 1) % 3,
            k = (i + 2) % 3,
            m = lerp(p[i], p[j], 0.5),
            um = lerp(uv[i], uv[j], 0.5);
          out.addTriangle(slot, ref, [p[i], m, p[k]], n, [uv[i], um, uv[k]], col);
          out.addTriangle(slot, ref, [m, p[j], p[k]], n, [um, uv[j], uv[k]], col);
          return;
        }
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
    fields = sanThomeFields(),
    architectural = fields.filter((h) => h.shape !== 'circle' && h.kind !== 'porch'),
    allCuts =
      d >= 2
        ? [...architectural, ...fields.filter((h) => h.kind === 'porch')]
        : fields.filter((h) => h.kind === 'porch'),
    cut = writer(
      masked(
        out,
        allCuts.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
      ),
      d,
    );
  for (const l of rec.wallLayers)
    for (const p of l.polygons) {
      if (d >= 2) shell(out, d, p.outline, l.bottom ?? footing, l.top, architectural);
      else sides(cut, p.outline, l.bottom ?? footing, l.top, 'wall');
    }
  // Porch roof and three through arches stay open in every browser tier.
  shell(out, d, plans.porch, footing, 5.6, allCuts);
  for (const z of [-4.5, 0, 4.5]) {
    const a = along(edge(plans.porch, [-1, 0]), z - 2.15, 1),
      b = along(edge(plans.porch, [-1, 0]), z + 2.15, 1),
      c = along(west, z - 2.15, 1),
      e = along(west, z + 2.15, 1);
    gable(cut, [a, c, e, b], 5.6, 7, 'trim');
  }
  if (d >= 2) sides(cut, main, footing, 0.35, 'wall');
  gable(cut, nave, 14.5, 19.5);
  gable(cut, plans.transeptRoof, 14.5, 19.5, 'roof', 1);
  hip(cut, plans.choir, 14.5, 18.5);
  for (const p of rec.lowRoofPlans) {
    if (
      Math.abs(
        p.outline.reduce((s, q, i) => {
          const r = p.outline[(i + 1) % p.outline.length];
          return s + q[0] * r[1] - r[0] * q[1];
        }, 0),
      ) < 2
    )
      cap(cut, p.outline, 8, 'roof');
    else hip(cut, p.outline, 8, 10.5);
  }
  shell(out, d, tower, 14.5, 20, d >= 2 ? architectural : []);
  cap(face, tower, 20, 'trim');
  const oct = sanThomeOctagon();
  shell(
    out,
    d,
    oct,
    20,
    29,
    d >= 2 ? architectural.filter((h) => h.name.startsWith('tower-oct')) : [],
  );
  profile(
    face,
    oct,
    [
      [29, 1.02],
      [29.8, 0.9],
      [44.4, 0.025],
    ],
    'wall',
  );
  crossTop(face, tc, 44.4, 45.5, d);
  const cr = radial(crossing, 1.3, 8);
  solid(face, cr, 19.3, 22, 'wall');
  profile(
    face,
    cr,
    [
      [22, 1.05],
      [26.4, 0.04],
    ],
    'trim',
  );
  crossTop(face, crossing, 26.4, 27.4, d);
  // Front gable pinnacles and the four tall-tower corner pinnacles survive distant views.
  for (const z of [-7.6, 7.8]) {
    const p = along(west, z, 1);
    if (d >= 1)
      solid(face, _R(p[0] - 0.45, p[1] - 0.45, p[0] + 0.45, p[1] + 0.45), 0, 14.6, 'wall');
    pinnacle(face, p, 14.5, 20, d, 0.52);
  }
  for (const p of scaled(tower, 0.86)) pinnacle(face, p, 20, 26, d, 0.43);
  if (d >= 1) {
    for (const h of fields) facade(face, h, d);
    buttresses(face, d);
    band(face, tower, 6.5, 0.25);
    band(face, tower, 12.7, 0.25);
    band(face, tower, 19.4, 0.35);
    for (const name of ['north', 'south']) {
      const f = side(name);
      for (const y of [6.5, 13.7])
        band(face, _R(-20.6, f.a[1] - 0.08, 3.25, f.a[1] + 0.08), y, 0.2, 'trim', 1);
    }
  }
}
export const buildSanThomeSkyline = (o) => build(o, 0),
  buildSanThomeDistrict = (o) => build(o, 1),
  buildSanThomeStreet = (o) => build(o, 2),
  buildSanThomeCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const sanThomeStudy = {
  id: 'san_thome_basilica',
  key: 'san_thome_basilica',
  title: 'San Thome Basilica',
  category: 'cathedral',
  wikidataId: 'Q733577',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID raw main footprint; western entrance/south offset tower and eastern choir/fingers sign long nave edge.',
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
    'Four existing shared256-square lime plaster/limestone/flat tile/plain wood graphs. Off-white/red linear tints, metric UVs and flat normals; window/louvre/oculus fields use flat geometric PBR colors. No embedded images, bespoke facade textures or baked shadows.',
  importReason:
    'Four authored browser tiers preserve offset main needle, small crossing spire, triple west facade, red roofs and Gothic side/chapel rhythm at the signed current map site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three inspected front/reverse-side/elevated pictures and standard viewer PMTiles/DEM only. Heights, internal subplans/roof joins, north facade and thresholds are approximate. Exact statues/reliefs/text, tiny tracery/parapets, stained-glass art, liturgical column, full interiors/crypt, flags/fences/palms/parking/town and surveyed paving/steps/walking excluded. Oculi are framed flat geometric disks; upper tower fields use closed dark backing rather than verified bell-room interiors. Physical device timing pending.',
    'Skyline keeps the offset main tower/needle, smaller crossing spire, west pinnacles and roof/chapel form with open porch. District adds shared surfaces, flat pointed facade fields and coarser buttress/pinnacle rhythm. Street opens door/window/porch recesses and adds large mullions; closeup/master refine arch surrounds/tracery and pinnacle facets. Synthetic neighbors are review fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-triple-facade-and-offset-tower', [-83, 25, 33], [-25, 19, 3]),
    cam('main-octagon-and-white-needle', [-64, 47, 54], [-24, 29, 11]),
    cam('south-two-tier-pointed-bays', [-7, 15, 52], [-8, 9, 10]),
    cam('crossing-spire-and-transept', [21, 35, 48], [9, 20, 0]),
    cam('eastern-choir-and-low-chapels', [78, 24, 43], [23, 11, 0]),
    cam('roof-and-signed-plan', [0, 115, 1], [0, 16, 1]),
  ],
};

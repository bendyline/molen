/** Uspenski Cathedral: brick cross church, copper helmet, gold caps and open western porch. */
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
  '../../../content/worldgen/source/places/ud/ud9/n0372_uspenski_cathedral/',
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
  wall: '#b9785d',
  spire: '#b48c7c',
  trim: '#c2bcb0',
  roof: '#71968a',
  door: '#8b6240',
  glass: '#52676f',
  accent: '#e9ba51',
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
const footing = (p) => Math.min(floor - 0.3, uspenskiGround(...p) - 0.35);
export function uspenskiGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Uspenski Cathedral footing outside retained terrain');
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
const control = (n) => rec.controls.find((b) => b.id === rec.roles[n]),
  ring = (n) => control(n).polygons[0].outline,
  mid = (r) => {
    const b = [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
    return b.map((v) => (v[0] + v[1]) / 2);
  },
  point = (f, t = 0.5) => lerp(f.a, f.b, t);
const arms = [
    ['armWest', [-1, 0], 0],
    ['armEast', [1, 0], 0],
    ['armNorth', [0, -1], 1],
    ['armSouth', [0, 1], 1],
  ],
  medium = ['turretNorth', 'turretWest', 'turretSouth', 'turretEast'],
  small = ['smallNW', 'smallNN', 'smallNE', 'smallEE', 'smallSE', 'smallSS', 'smallWN', 'smallWW'];
const roundRing = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos((i / n) * Math.PI * 2) * r,
    p[1] + Math.sin((i / n) * Math.PI * 2) * r,
  ]);
function radialRing(name, d) {
  const r = ring(name);
  if (d !== 0 || r.length <= 8) return r;
  const p = mid(r),
    rad = r.reduce((s, q) => s + Math.hypot(...q.map((v, k) => v - p[k])), 0) / r.length;
  return roundRing(p, rad, 8);
}
const window = (name, f, p, w, b, h, s = h - w / 2, kind = 'window', depth = 2) => ({
  ...hole(name, p, f.axis, f.normal, w, b, h, s, 'round', depth),
  kind,
});
const porchRing = ring('westPorch'),
  porchFront = edge(porchRing, [-1, 0]),
  porchRear = edge(porchRing, [1, 0]),
  porchFloor = 1.05;
export function uspenskiFields() {
  const fields = [];
  for (const [role, n] of arms) {
    const f = edge(ring(role), n),
      p = point(f);
    if (role === 'armWest')
      fields.push(
        window('west-main-wood-door', f, point(porchRear), 2.7, porchFloor, 4.3, 2.95, 'door', 2.4),
      );
    for (const t of [0.22, 0.78]) {
      if (role === 'armEast') continue;
      for (const u of [-0.65, 0.65])
        fields.push(
          window(
            `${role}-lower-${t}-${u}`,
            f,
            point(f, t).map((v, k) => v + f.axis[k] * u),
            1.0,
            1.9,
            5.5,
            5.0,
          ),
        );
    }
    fields.push(
      window(
        `${role}-upper-round`,
        f,
        p,
        role === 'armEast' ? 3.5 : 4.7,
        role === 'armEast' ? 16.5 : 10.2,
        role === 'armEast' ? 3.2 : 9.1,
        role === 'armEast' ? 1.45 : 6.75,
      ),
    );
  }
  for (const [pi, p] of rec.cornerPlans.entries())
    for (let i = 0; i < p.outline.length; i++) {
      const f = faceFrame(p.outline, i),
        m = point(f),
        outside = m.map((v, k) => v + f.normal[k] * 0.35);
      if (f.length < 4 || rec.highPlans.some((p) => _inside(outside, p.outline))) continue;
      fields.push(window(`corner-${pi}-${i}`, f, m, Math.min(1.8, f.length * 0.5), 1.9, 5.6, 4.7));
    }
  for (const [role, ps, b, h] of [
    ['main-apse', rec.apsePlans, 2, 7.4],
    ['north-apse', control('apseNorth').polygons, 1.7, 3.7],
    ['south-apse', control('apseSouth').polygons, 1.7, 3.7],
  ])
    for (const p of ps)
      for (let i = 0; i < p.outline.length; i++) {
        const f = faceFrame(p.outline, i);
        if (f.normal[0] < 0.1 || f.length < 1.5) continue;
        fields.push(
          window(`${role}-${i}`, f, point(f), Math.min(1.55, f.length * 0.64), b, h, h - 0.78),
        );
      }
  const drum = ring('mainDome');
  for (let i = 0; i < drum.length; i++) {
    const f = faceFrame(drum, i);
    fields.push(window(`drum-${i}`, f, point(f), f.length * 0.65, 24, 7.2, 5.9));
  }
  for (const name of medium) {
    const r = ring(name);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      fields.push(window(`${name}-${i}`, f, point(f), f.length * 0.55, 21.6, 2.0, 1.4));
    }
  }
  for (const name of small) {
    const r = ring(name);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 1.6) continue;
      fields.push(window(`${name}-${i}`, f, point(f), f.length * 0.42, 17, 2.35, 1.85));
    }
  }
  const upper = ring('bellUpper');
  for (let i = 0; i < upper.length; i++) {
    const f = faceFrame(upper, i);
    fields.push(
      window(`bell-upper-${i}`, f, point(f), Math.min(2, f.length * 0.55), 11.1, 3.9, 2.9),
    );
  }
  const south = edge(ring('bellLower'), [0, 1]);
  fields.push(window('south-vestibule-door', south, point(south), 2, 0.2, 4, 3, 'door'));
  const left = edge(porchRing, [0, -1]),
    right = edge(porchRing, [0, 1]);
  fields.push(
    window(
      'porch-open-front',
      porchFront,
      point(porchFront),
      porchFront.length - 0.85,
      porchFloor,
      4.35,
      3.05,
      'open',
      5,
    ),
  );
  for (const [name, f] of [
    ['north', left],
    ['south', right],
  ])
    fields.push(
      window(
        `porch-open-${name}`,
        f,
        point(f),
        f.length - 0.9,
        porchFloor,
        4.35,
        3.05,
        'open',
        4.5,
      ),
    );
  // This inward face meets the east-arm copper roof; its lower field would be buried.
  return fields.filter((h) => h.name !== 'smallEE-3');
}
function panel(face, h, d) {
  if (h.kind === 'open') {
    if (d >= 1) archBand(face, h, d, 0.35, 'wall', 0.1);
    return;
  }
  pane(face, h, d, d >= 2 ? -0.65 : 0.045, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  // Small bars fall below a pixel at street range; retain the recessed field itself.
  if (d === 2 && h.width < 1.9 && h.kind !== 'door') return;
  archBand(face, h, d, 0.25, 'wall', 0.1);
  if (d >= 3) archBand(face, h, d, 0.48, 'wall', 0.035);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (h.kind === 'door') {
    beam(
      face,
      p.point(0, h.bottom, -0.58 * sg),
      p.point(0, h.bottom + h.spring, -0.58 * sg),
      0.06,
      'door',
    );
    return;
  }
  for (const u of h.width > 3 ? [-0.25, 0, 0.25] : [0])
    beam(
      face,
      p.point(h.width * u, h.bottom, -0.56 * sg),
      p.point(h.width * u, h.bottom + h.spring, -0.56 * sg),
      0.075,
      'door',
    );
  for (let y = h.bottom + 2.1; y < h.bottom + h.spring - 0.4; y += 2.1)
    beam(
      face,
      p.point(-h.width * 0.47, y, -0.55 * sg),
      p.point(h.width * 0.47, y, -0.55 * sg),
      0.07,
      'door',
    );
}
function gabled(face, wall, r, eave, top, axis) {
  const caps = [edge(r, axis === 0 ? [-1, 0] : [0, -1]), edge(r, axis === 0 ? [1, 0] : [0, 1])],
    ridge = caps.map((f) => point(f)),
    near = (p) => (p === caps[0].a || p === caps[0].b ? ridge[0] : ridge[1]);
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (Math.abs(f.normal[axis]) > 0.65) continue;
    face('roof', [at(f.a, eave), at(f.b, eave), at(near(f.b), top), at(near(f.a), top)], [0, 1, 0]);
  }
  for (let i = 0; i < 2; i++) {
    const f = caps[i];
    wall('wall', [at(f.a, eave), at(f.b, eave), at(ridge[i], top)], [f.normal[0], 0, f.normal[1]]);
  }
}
function goldTop(face, name, base, top, d, large = false) {
  // At skyline range the gold cap and thin cross share one solid silhouette.
  if (d === 0 || (d === 1 && !large)) top = control(name).properties.height;
  const p = mid(ring(name)),
    rad = large ? 1.6 : 0.72,
    r = roundRing(p, rad, d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 12 : 16),
    h = top - base;
  profile(
    face,
    r,
    d === 0
      ? [
          [base, 0.7],
          [base + h * 0.43, 1],
          [top, 0.04],
        ]
      : [
          [base, 0.6],
          [base + h * 0.17, 0.9],
          [base + h * 0.42, 1],
          [base + h * 0.64, 0.84],
          [base + h * 0.86, 0.3],
          [top, 0.04],
        ],
    'accent',
  );
}
function crossTip(face, name, base, top, d, large = false) {
  const p = mid(ring(name)),
    w = large ? 0.09 : 0.055;
  if (d === 0 || (d === 1 && !large)) return;
  beam(face, at(p, base), at(p, top), w, 'accent');
  const y = base + (top - base) * 0.65,
    len = large ? 1.15 : 0.6;
  beam(face, at([p[0] - len / 2, p[1]], y), at([p[0] + len / 2, p[1]], y), w, 'accent');
  if (d >= 2 && large) {
    beam(
      face,
      at([p[0] - 0.32, p[1]], top - 0.17),
      at([p[0] + 0.32, p[1]], top - 0.17),
      w,
      'accent',
    );
    beam(
      face,
      at([p[0] - 0.5, p[1]], base + 0.32),
      at([p[0] + 0.5, p[1]], base + 0.17),
      w,
      'accent',
    );
  }
}
function pilasters(face, d) {
  for (const [role, n] of arms) {
    const f = edge(ring(role), n);
    for (const t of [0.03, 0.97]) {
      const p = point(f, t).map((v, k) => v + f.normal[k] * 0.12),
        r = _R(p[0] - 0.38, p[1] - 0.38, p[0] + 0.38, p[1] + 0.38);
      solid(face, r, 0.6, 16.5, 'wall');
      if (d >= 2) for (const y of [1.15, 8.9, 15.95]) band(face, r, y, 0.25, 'wall', 1.15);
    }
  }
  for (const p of rec.highPlans)
    for (const y of [8.7, 15.85]) band(face, coarse(p.outline), y, 0.22, 'wall', 1.012);
  if (d >= 2)
    for (const [name, n] of [
      ['armWest', [-1, 0]],
      ['armNorth', [0, -1]],
      ['armSouth', [0, 1]],
    ]) {
      const f = edge(ring(name), n),
        m = point(f);
      for (const s of [-1, 1]) {
        const p = m.map((v, k) => v + f.axis[k] * s * 4.3 + f.normal[k] * 0.12);
        const shape = Array.from({ length: 17 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2;
          return [
            p[0] + f.axis[0] * Math.cos(a) * 1.02,
            floor + 14.3 + Math.sin(a) * 1.02,
            p[1] + f.axis[1] * Math.cos(a) * 1.02,
          ];
        });
        face(
          'wall',
          shape,
          [f.normal[0], 0, f.normal[1]],
          colors.wall.map((v) => v * 0.75),
        );
        if (d >= 3) for (let i = 0; i < 16; i++) beam(face, shape[i], shape[i + 1], 0.16, 'wall');
      }
    }
}
function porch(face, out, d, fields) {
  const r = porchRing,
    open = fields.filter((h) => h.kind === 'open' || h.name === 'west-main-wood-door');
  if (d >= 1) shell(out, d, r, porchFloor, 5.7, open);
  else sides(face, r, porchFloor, 5.7, 'wall');
  gabled(
    face,
    d >= 1
      ? writer(
          masked(
            out,
            open.map((h) => prepareOpening(h, 0, d)),
          ),
          d,
        )
      : face,
    r,
    5.7,
    7.5,
    0,
  );
  // A declared raised porch floor, with visual steps to the coarse viewer terrain.
  solid(face, r, footing, porchFloor, 'trim');
  if (d >= 1) {
    for (const t of [0.07, 0.93]) {
      const p = point(porchFront, t),
        col = roundRing(p, 0.34, d >= 3 ? 12 : 6);
      profile(
        face,
        col,
        [
          [porchFloor, 1.2],
          [porchFloor + 0.25, 1.25],
          [porchFloor + 0.45, 1],
          [4.05, 1],
          [4.25, 1.3],
          [4.45, 1.25],
        ],
        'trim',
      );
    }
    const n = porchFront.normal,
      p = point(porchFront),
      axis = porchFront.axis;
    const start = uspenskiGround(...p.map((v, k) => v + n[k] * 2)) + 0.12 - floor,
      count = 5;
    for (let i = 0; i < count; i++) {
      const depth = (count - i) * 0.38,
        pp = p.map((v, k) => v + (n[k] * depth) / 2),
        rr = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([u, v]) => [
          pp[0] + axis[0] * u * 1.7 + (n[0] * v * depth) / 2,
          pp[1] + axis[1] * u * 1.7 + (n[1] * v * depth) / 2,
        ]);
      solid(face, rr, footing, start + ((porchFloor - start) * (i + 1)) / count, 'trim');
    }
  }
}
function build(target, d) {
  const limit = d === 0 ? 28 : d === 1 ? 24 : 16,
    out = {
      addTriangle(slot, ref, p, n, uv, col) {
        p = p.map((v) => v.map(Math.fround));
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
    fields = uspenskiFields(),
    cut =
      d >= 2
        ? writer(
            masked(
              out,
              fields.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
            ),
            d,
          )
        : face;
  const wall = (r, b, t) => {
    if (d >= 2) shell(out, d, r, b, t, fields);
    else sides(face, r, b, t, 'wall');
  };
  wall(d === 0 ? coarse(rec.main.polygons[0].outline) : rec.main.polygons[0].outline, footing, 5.2);
  // Mapped pilaster notches extend beyond the upper volumes: close their exposed ledges.
  if (d === 0) cap(face, coarse(rec.main.polygons[0].outline), 5.2, 'wall');
  else for (const p of rec.baseCaps) cap(cut, p.outline, 5.2, 'wall', p.holes);
  for (const p of rec.highPlans) wall(d === 0 ? coarse(p.outline) : p.outline, 5.2, 16.4);
  for (const [role, , axis] of arms) gabled(face, cut, ring(role), 16.4, 21, axis);
  hip(face, ring('core'), 16.4, 23);
  for (const p of rec.cornerPlans) {
    const outline = d === 0 ? coarse(p.outline) : p.outline;
    wall(outline, 5.2, 12.2);
    hip(face, outline, 12.2, 14.7);
  }
  for (const p of rec.apsePlans) {
    wall(p.outline, 5.2, 12);
    hip(face, p.outline, 12, 16);
  }
  for (const role of ['apseNorth', 'apseSouth']) {
    wall(ring(role), 5.2, 6.4);
    hip(face, ring(role), 6.4, 8.8);
  }
  for (const p of rec.linkPlans) {
    wall(p.outline, footing, 5.9);
    hip(face, p.outline, 5.9, 7.7, 'roof', 1);
  }
  const low = d === 0 ? coarse(ring('bellLower')) : ring('bellLower');
  wall(low, 5.2, 10.4);
  cap(face, low, 10.4, 'roof', [ring('bellUpper')]);
  wall(ring('bellUpper'), 10.4, 16.4);
  profile(
    face,
    ring('bellUpper'),
    [
      [16.4, 1.08],
      [20.5, 0.12],
    ],
    'roof',
  );
  goldTop(face, 'bellTip', 20.5, 21, d);
  crossTip(face, 'bellTip', 21, 22, d);
  const drum = radialRing('mainDome', d);
  wall(drum, 16.4, 31.8);
  profile(
    face,
    drum,
    d === 0
      ? [
          [31.8, 1],
          [36, 0.58],
          [39, 0.2],
        ]
      : [
          [31.8, 1.05],
          [32.4, 0.99],
          [35.4, 0.7],
          [35.7, 0.71],
          [36.1, 0.56],
          [38.4, 0.3],
          [39, 0.2],
        ],
    'roof',
  );
  goldTop(face, 'mainTip', 39, 42.5, d, true);
  crossTip(face, 'mainTip', 42.5, 44, d, true);
  for (const name of medium) {
    const r = ring(name);
    wall(r, 16.4, 24);
    profile(
      face,
      r,
      [
        [24, 1.04],
        [25, 0.45],
      ],
      'roof',
    );
    goldTop(face, `${name}Tip`, 25, 26.3, d);
    crossTip(face, `${name}Tip`, 26.3, 27, d);
  }
  for (const name of small) {
    const r = ring(name);
    wall(r, footing, 20);
    profile(
      face,
      r,
      [
        [20, 1.1],
        [22, 0.09],
      ],
      'roof',
    );
    goldTop(face, `${name}Tip`, 22, 22.55, d);
    crossTip(face, `${name}Tip`, 22.55, 23, d);
  }
  porch(face, out, d, fields);
  if (d >= 1) {
    for (const h of fields) panel(face, h, d);
    pilasters(face, d);
    for (const y of [23.2, 31.5]) band(face, drum, y, 0.22, 'wall', 1.02);
    if (d >= 2) for (const name of medium) band(face, ring(name), 23.7, 0.22, 'wall', 1.08);
  }
  if (d >= 2) {
    sides(cut, rec.main.polygons[0].outline, footing, 0.2, 'trim');
    cap(cut, rec.main.polygons[0].outline, 0.2, 'trim');
  }
}
export const buildUspenskiSkyline = (o) => build(o, 0),
  buildUspenskiDistrict = (o) => build(o, 1),
  buildUspenskiStreet = (o) => build(o, 2),
  buildUspenskiCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const uspenskiStudy = {
  id: 'N0372',
  key: 'uspenski_cathedral',
  title: 'Uspenski Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1355001',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID main,50 mapped parts and separate layer1 western porch. East round apses, west open porch and south lower bell tower sign central-core edge.',
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
    'Four existing cached256-square brick, granite, copper and plain wood graphs. Linear brick/green copper tints, metric UVs and flat architectural normals. Gold caps/crosses and closed glazing use geometric PBR colors. No embedded images, bespoke facade maps or baked shadows.',
  importReason:
    'Four authored browser tiers preserve red-brick cross church, three east apses, high44m central drum/helmet/gold tip, four27m roof turrets, eight23m corner tips, south22m lower tower and open west porch at the signed map site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three inspected2019/2022/2025 entrance/exterior pictures and standard viewer PMTiles/DEM only. Flat faceted architecture, stylized brick relief, green copper profiles, gold caps/crosses and geometric closed glazing preserve principal features. Exact ornamental brick/sculpture/inscriptions, stained glass, roof joints/furniture, hidden room/interior plans, surveyed hill/plaza paving/doorway levels and certified walking excluded or approximate. Physical laptop/phone timings pending.',
    'Skyline keeps mapped massing, high drum/helmet, roof turrets, apses, lower tower and porch. District adds cached surfaces and flat round fields. Street opens wall/porch recesses with closed glazing/wood and coarse mullions/pilasters. Closeup/master refine arch surrounds, columns, gold profiles and crosses. Synthetic cottage context is a review fixture.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-open-porch-and-main-wood-door', [-45, 12, 1], [-15, 4, -5]),
    cam('central-round-drum-copper-helmet-gold-tip', [-42, 43, 28], [-3, 31, -7]),
    cam('west-gable-and-brick-window-tiers', [-51, 22, -21], [-13, 13, -7]),
    cam('round-east-apses-and-small-roof-tips', [51, 25, 24], [7, 12, -7]),
    cam('south-low-bell-tower-and-link', [17, 25, 61], [-2, 12, 13]),
    cam('roof-and-signed-plan', [0, 117, 1], [-2, 15, -2]),
  ],
};

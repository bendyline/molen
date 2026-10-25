/** Surviving Utrecht Domkerk, south cloister and separate Dom Tower across the open square. */
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
  '../../../content/worldgen/source/places/u1/u17/st_martins_cathedral_utrecht/',
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
  wall: '#bda69b',
  stone: '#bdb4a5',
  trim: '#d4c9b4',
  roof: '#687780',
  metal: '#8ca79c',
  door: '#77563e',
  glass: '#43546b',
  accent: '#43494d',
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
const footing = (p) => Math.min(floor - 0.3, utrechtDomGround(...p) - 0.35);
export function utrechtDomGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Utrecht Domkerk footing outside retained terrain');
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
function panel(face, h, d) {
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
const control = (n) => rec.controls.find((b) => b.id === rec.roles[n]),
  ring = (n) => control(n).polygons[0].outline,
  main = coarse(rec.mainBodyPlans[0].outline),
  high = rec.highPlan,
  cloister = coarse(ring('cloister')),
  tb = ring('towerBase'),
  tm = ring('towerMiddle'),
  to = ring('towerOctagon'),
  bounds = (r) => [
    Math.min(...r.map((p) => p[0])),
    Math.min(...r.map((p) => p[1])),
    Math.max(...r.map((p) => p[0])),
    Math.max(...r.map((p) => p[1])),
  ],
  mid = (r) => {
    const b = bounds(r);
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  },
  tc = mid(tb),
  point = (f, t = 0.5) => lerp(f.a, f.b, t),
  regular = (p, r, n = 8) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + r * Math.cos((i * Math.PI * 2) / n),
      p[1] + r * Math.sin((i * Math.PI * 2) / n),
    ]);
const west = edge(high, [-1, 0]),
  _hf = (r, n) => edge(r, n),
  along = (f, x, k = 0) => point(f, (x - f.a[k]) / (f.b[k] - f.a[k]));
export function utrechtDomFields() {
  const hs = [];
  for (const z of [-22, -15, -8, 4, 11, 18])
    hs.push({
      ...hole(
        `west-transept-${z}`,
        along(west, z, 1),
        west.axis,
        west.normal,
        4.0,
        8.1,
        15.4,
        11.2,
      ),
      kind: 'window',
    });
  const p = along(west, -2, 1),
    bottom = utrechtDomGround(...p) + 0.22 - floor;
  hs.push({
    ...hole('west-entry', p, west.axis, west.normal, 3.4, bottom, 5.6, 3.6),
    kind: 'door',
  });
  hs.push({
    ...hole('west-central-arch', p, west.axis, west.normal, 7.5, 7.1, 18.5, 14.8),
    kind: 'window',
  });
  for (const [name, n] of [
    ['north', [0, -1]],
    ['south', [0, 1]],
  ]) {
    const f = edge(rec.transeptPlans[0].outline, n);
    hs.push({
      ...hole(`transept-${name}`, point(f), f.axis, f.normal, 7.2, 5.2, 19.1, 14.4),
      kind: 'window',
    });
  }
  const choir = rec.choirPlans[0].outline;
  for (let i = 0; i < choir.length; i++) {
    const f = faceFrame(choir, i);
    if (f.normal[0] < -0.6) continue;
    const count = Math.max(1, Math.round(f.length / 7));
    for (let j = 0; j < count; j++) {
      const p = point(f, (j + 0.5) / count);
      if (p[0] < -5) continue;
      hs.push({
        ...hole(
          `upper-choir-${i}-${j}`,
          p,
          f.axis,
          f.normal,
          Math.min(3.6, (f.length / count) * 0.68),
          17.1,
          7.1,
          5.25,
        ),
        kind: 'window',
      });
    }
  }
  for (let i = 0; i < main.length; i++) {
    const f = faceFrame(main, i),
      p = point(f);
    if (
      f.length < 4.5 ||
      p[0] < -3 ||
      p[1] > 18 ||
      inside(p, ring('vestry')) ||
      inside(p, ring('porch'))
    )
      continue;
    const count = Math.max(1, Math.round(f.length / 6));
    for (let j = 0; j < count; j++) {
      const q = point(f, (j + 0.5) / count);
      hs.push({
        ...hole(
          `lower-choir-${i}-${j}`,
          q,
          f.axis,
          f.normal,
          Math.min(3.1, (f.length / count) * 0.62),
          2.8,
          9.3,
          6.8,
        ),
        kind: 'window',
      });
    }
  }
  for (let i = 0; i < tb.length; i++) {
    const f = faceFrame(tb, i);
    for (const t of [0.26, 0.74])
      hs.push({
        ...hole(`base-blind-${i}-${t}`, point(f, t), f.axis, f.normal, 3.1, 15.1, 15.0, 11.5),
        kind: 'window',
      });
  }
  return hs;
}
export function utrechtDomPassages() {
  const f = edge(tb, [-1, 0]),
    p = point(f),
    b = utrechtDomGround(...p) + 0.22 - floor;
  return [hole('tower-through-passage', p, f.axis, f.normal, 4.4, b, 8.8, 6.1, 'pointed', 52)];
}
export function utrechtDomBelfry(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (let i = 0; i < tm.length; i++) {
    const f = faceFrame(tm, i);
    for (const t of [0.29, 0.71])
      hs.push(
        hole(
          `middle-belfry-${i}-${t}`,
          point(f, t),
          f.axis,
          f.normal,
          4.5,
          43.0,
          21.5,
          16.2,
          'pointed',
          5,
        ),
      );
  }
  for (let i = 0; i < to.length; i++) {
    const f = faceFrame(to, i);
    hs.push(
      hole(
        `octagon-belfry-${i}`,
        point(f),
        f.axis,
        f.normal,
        Math.min(3.8, f.length * 0.68),
        72.2,
        25.2,
        19.6,
        'pointed',
        5,
      ),
    );
  }
  return hs;
}
export function utrechtDomArcades(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (let i = 0; i < cloister.length; i++) {
    const f = faceFrame(cloister, i),
      p = point(f),
      inner =
        (Math.abs(p[0] + 11.6) < 2 && p[1] > 27) ||
        (Math.abs(p[0] - 12.9) < 2 && p[1] > 27) ||
        (Math.abs(p[1] - 45.2) < 1.2 && Math.abs(p[0]) < 14);
    if (!inner || f.length < 5) continue;
    const count = Math.max(1, Math.round(f.length / 3.3));
    for (let j = 0; j < count; j++) {
      // The north ends join the church annexes, outside the open garden arcade.
      if (point(f, (j + 0.5) / count)[1] < 27) continue;
      hs.push(
        hole(
          `cloister-open-${i}-${j}`,
          point(f, (j + 0.5) / count),
          f.axis,
          f.normal,
          2.4,
          0.2,
          3.8,
          2.7,
          'pointed',
          2.5,
        ),
      );
    }
  }
  return hs;
}
function lowRoof(face, r, holes = []) {
  const near = (p) => {
    let best = Infinity;
    for (let i = 0; i < high.length; i++) {
      const a = high[i],
        b = high[(i + 1) % high.length],
        v = b.map((n, k) => n - a[k]),
        t = Math.max(
          0,
          Math.min(
            1,
            v.reduce((s, n, k) => s + n * (p[k] - a[k]), 0) / (v[0] * v[0] + v[1] * v[1]),
          ),
        );
      best = Math.min(best, Math.hypot(...p.map((n, k) => n - a[k] - v[k] * t)));
    }
    return Math.max(13.3, 20 - best * 0.7);
  };
  cap(face, r, (p) => floor + near(p), 'roof', holes);
}
function pier(face, p, n, d, top = 18) {
  const a = [-n[1], n[0]],
    r = (depth, w) =>
      [
        [-w / 2, -0.2],
        [w / 2, -0.2],
        [w / 2, depth],
        [-w / 2, depth],
      ].map(([u, v]) => [p[0] + a[0] * u + n[0] * v, p[1] + a[1] * u + n[1] * v]);
  for (const [b, t, depth, w] of d <= 1
    ? [[0, top, 1.4, 1.1]]
    : [
        [0, top * 0.43, 1.6, 1.3],
        [top * 0.43, top, 1.0, 1.05],
      ]) {
    const rr = r(depth, w);
    solid(face, rr, b === 0 ? footing : b, t, 'stone');
    if (d >= 1) band(face, rr, t - 0.2, 0.2, 'trim', 1.06);
  }
  if (d >= 2)
    profile(
      face,
      r(0.65, 0.7),
      [
        [top, 1],
        [top + 1, 1],
        [top + 3, 0.05],
      ],
      'trim',
    );
}
function flying(face, d) {
  const choir = rec.choirPlans[0].outline;
  for (let i = 0; i < choir.length; i++) {
    const f = faceFrame(choir, i);
    if (f.normal[0] < -0.6) continue;
    const count = Math.max(1, Math.round(f.length / 7));
    for (let j = 0; j < count; j++) {
      const p = point(f, j / count);
      if (p[0] < -5) continue;
      const outer = p.map((v, k) => v + f.normal[k] * 6.8);
      pier(face, outer, f.normal, d, 17.2);
      if (d >= 1) {
        const count = d >= 3 ? 8 : d === 2 ? 4 : 1;
        let a = at(outer, 15.6);
        for (let k = 1; k <= count; k++) {
          const t = k / count,
            q = outer.map((v, j) => v + (p[j] - v) * t),
            b = at(q, 15.6 + 7.1 * Math.sin((t * Math.PI) / 2));
          beam(face, a, b, d === 1 ? 0.75 : 0.58, 'trim');
          a = b;
        }
      }
    }
  }
  for (const f of [
    west,
    edge(rec.transeptPlans[0].outline, [0, -1]),
    edge(rec.transeptPlans[0].outline, [0, 1]),
  ]) {
    const count = Math.max(1, Math.round(f.length / 7));
    for (let j = 0; j <= count; j++) {
      const p = point(f, j / count);
      pier(face, p, f.normal, d, 25.1);
    }
  }
}
function tower(out, face, cut, d, fields) {
  const passages = utrechtDomPassages(),
    all = [...passages, ...(d >= 2 ? fields : [])];
  shell(out, d, tb, footing, 38.6, all, 'stone');
  cap(face, tb, 38.6, 'stone');
  for (const y of [12.8, 32.8, 38.25]) band(cut, tb, y, 0.35, 'trim', 1.025);
  const openings = utrechtDomBelfry(d),
    middle = openings.filter((h) => h.name.startsWith('middle')),
    oct = openings.filter((h) => h.name.startsWith('octagon'));
  if (d >= 1) {
    shell(out, d, tm, 38.6, 68.08, middle, 'stone', scaled(tm, 0.69));
    shell(out, d, to, 68.08, 99.1, oct, 'stone', scaled(to, 0.69));
    for (const h of openings)
      if (d >= 2) {
        archBand(face, h, d, 0.35, 'trim', 0.1);
        const p = prepareOpening(h, 0, d),
          sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
        beam(
          face,
          p.point(0, h.bottom, -0.05 * sg),
          p.point(0, h.bottom + h.spring, -0.05 * sg),
          0.19,
          'trim',
        );
      }
  } else {
    sides(face, tm, 38.6, 68.08, 'stone');
    sides(face, to, 68.08, 99.1, 'stone');
  }
  cap(face, tm, 68.08, 'stone', [scaled(to, 0.8)]);
  band(face, tm, 67.4, 0.68, 'trim', 1.04);
  band(face, to, 98.6, 0.5, 'trim', 1.05);
  profile(
    face,
    to,
    [
      [99.1, 1.03],
      [106.75, 0.12],
    ],
    'roof',
  );
  const tip = control('towerTip').polygons[0].outline;
  profile(
    face,
    tip,
    [
      [106.75, 0.85],
      [111.6, 0.08],
    ],
    'metal',
  );
  beam(face, at(tc, 111.5), at(tc, 112.32), 0.2, 'accent');
  if (d >= 1) {
    for (const b of rec.controls.filter((b) => b.id >= 35185826506126 && b.id <= 35185826506137)) {
      const r = b.polygons[0].outline;
      solid(face, r, 38.6, 41.6, 'trim');
      profile(
        face,
        r,
        [
          [41.6, 1.1],
          [43, 0.06],
        ],
        'trim',
      );
    }
    for (const r of d >= 2 ? [tm, to] : [])
      for (const p of r) {
        const pp = regular(p, d === 1 ? 0.26 : 0.32, 4);
        solid(face, pp, r === tm ? 38.6 : 68.08, r === tm ? 67.5 : 99.3, 'trim');
        if (d >= 2)
          profile(
            face,
            pp,
            [
              [r === tm ? 67.5 : 99.3, 1.5],
              [r === tm ? 70.2 : 102.3, 0.05],
            ],
            'trim',
          );
      }
  }
}
function cloisterModel(out, face, d) {
  const hs = utrechtDomArcades(d);
  if (d >= 1) shell(out, d, cloister, footing, 5, hs, 'wall');
  else sides(face, cloister, footing, 5, 'wall');
  cap(face, cloister, 5, 'wall');
  for (let i = 0; i < cloister.length; i++) {
    const f = faceFrame(cloister, i);
    if (d >= 2 && f.length > 5)
      for (const h of hs.filter((h) => h.name.startsWith(`cloister-open-${i}-`)))
        archBand(face, h, d, 0.18, 'trim', 0.05);
  }
  const wings = [R(-16, 23, -11.8, 49), R(12.9, 24, 18.5, 50), R(-17.5, 45.2, 18.5, 50)];
  for (const r of wings)
    hip(face, r, 5, 8, 'roof', Math.abs(r[1][0] - r[0][0]) > Math.abs(r[2][1] - r[1][1]) ? 0 : 1);
}
function build(out, d) {
  const target = out;
  out = {
    addTriangle(slot, ref, points, normal, uv, color) {
      const p = points.map((v) => v.map(Math.fround)),
        lens = p.map((a, i) => Math.hypot(...a.map((v, k) => v - p[(i + 1) % 3][k]))),
        longest = Math.max(...lens),
        max = d === 0 ? 32 : d === 1 ? 26 : 16;
      if (longest > max) {
        const i = lens.indexOf(longest),
          j = (i + 1) % 3,
          k = (i + 2) % 3,
          m = lerp(p[i], p[j], 0.5),
          um = lerp(uv[i], uv[j], 0.5);
        out.addTriangle(slot, ref, [p[i], m, p[k]], normal, [uv[i], um, uv[k]], color);
        out.addTriangle(slot, ref, [m, p[j], p[k]], normal, [um, uv[j], uv[k]], color);
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
      target.addTriangle(slot, ref, p, normal, uv, color);
    },
  };
  const face = writer(out, d),
    fields = utrechtDomFields(),
    cut =
      d >= 2
        ? writer(
            masked(
              out,
              fields.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
            ),
            d,
          )
        : face,
    churchFields = fields.filter((h) => !h.name.startsWith('base-'));
  for (const p of rec.mainBodyPlans) {
    const r = coarse(p.outline);
    if (d >= 2) shell(out, d, r, footing, 13, churchFields, 'wall');
    else sides(face, r, footing, 13, 'wall');
    cap(cut, r, 13, 'wall', p.holes.map(coarse));
  }
  if (d >= 1)
    for (const p of rec.main.polygons) {
      const r = d === 1 ? coarse(p.outline) : p.outline;
      sides(face, r, footing, 0.45, 'stone');
      cap(face, r, 0.45, 'stone');
    }
  if (d >= 2) shell(out, d, high, 13, 25, churchFields, 'stone');
  else sides(face, high, 13, 25, 'stone');
  cap(cut, high, 25, 'stone');
  band(cut, high, 24.6, 0.4, 'trim', 1.015);
  for (const p of rec.transeptPlans) gable(cut, p.outline, 25, 33.5, 'roof', 1);
  gable(cut, R(-18.75, -8.23, -12.7, 3.03), 25, 33.5, 'roof', 0);
  for (const p of rec.choirPlans) hip(cut, p.outline, 25, 33.5);
  for (const p of rec.lowRoofPlans) lowRoof(cut, coarse(p.outline), p.holes.map(coarse));
  const vr = coarse(ring('vestry'));
  sides(cut, vr, footing, 8.5, 'wall');
  hip(cut, vr, 8.5, 11.5);
  const pr = coarse(ring('porch'));
  sides(cut, pr, footing, 3, 'wall');
  hip(cut, pr, 3, 4);
  flying(cut, d);
  tower(
    out,
    face,
    cut,
    d,
    fields.filter((h) => h.name.startsWith('base-')),
  );
  cloisterModel(out, face, d);
  if (d >= 1) for (const h of fields) panel(face, h, d);
  for (const p of [
    [-12.6, -26.0],
    [-12.6, 20.7],
    [16.5, -2.5],
  ]) {
    beam(face, at(p, 33.4), at(p, 35.0), 0.18, 'metal');
    if (d >= 1)
      beam(face, [p[0] - 0.4, floor + 34.4, p[1]], [p[0] + 0.4, floor + 34.4, p[1]], 0.15, 'metal');
  }
}
export const buildUtrechtDomSkyline = (o) => build(o, 0),
  buildUtrechtDomDistrict = (o) => build(o, 1),
  buildUtrechtDomStreet = (o) => build(o, 2),
  buildUtrechtDomCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const utrechtDomStudy = {
  id: 'st_martins_cathedral_utrecht',
  key: 'st_martin_s_cathedral_utrecht',
  title: 'St. Martin’s Cathedral, Utrecht',
  category: 'cathedral',
  wikidataId: 'Q936545',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way1159618262 matches current church;24 unscaled church/cloister/tower controls. Tower across western open square and southern cloister sign frame.',
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
    'Six existing shared256-square brick, ashlar, limestone, slate, plain wood and standing-seam metal graphs. Warm gray-pink masonry, pale trim and blue-gray slate use linear tints/metric UVs. Glass and accents use flat PBR colors. No embedded images, unique facade textures, temporary artwork or baked weathering/shadows.',
  importReason:
    'Four authored browser levels retain the surviving church, separate stage-controlled Dom Tower and south cloister, preserving the open square and courtyard.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi surviving exterior from four useful pictures and standard PMTiles/DEM only. Current stage heights are map controls; church eaves/roofs, lower annexes/cloister, flying buttress curves, pinnacle/tracery/window rhythm, threshold and small ornament are estimates. Exact sculpture/text, temporary trompe-l’oeil west artwork, bells/inner staircases, gardens/fountain/trees, full interiors and certified walking excluded. Physical device timing pending.',
    'Skyline preserves cross roof, polygonal choir, coarse buttresses, separate square/octagonal tower and U-shaped cloister. District adds shared textures, flat glazing/doors and open tower/arcade apertures. Street adds facade recesses, window/mullion tracery, flying buttress curves and pinnacles. Closeup/master refine facets. Synthetic context neighbors are not mapped Utrecht buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('surviving-west-transept-and-open-square', [-64, 27, 2], [-12, 18, -2]),
    cam('east-choir-and-flying-buttresses', [58, 31, 4], [9, 17, -2]),
    cam('south-cloister-and-open-garden', [0, 26, 78], [-1, 7, 35]),
    cam('tower-middle-and-open-octagonal-crown', [-132, 85, 55], [-78, 74, -4]),
    cam('tower-ground-through-passage', [-112, 7, -4], [-79, 5, -4]),
    cam('church-cross-roof-and-lower-aisles', [4, 80, -5], [0, 15, -2]),
  ],
};

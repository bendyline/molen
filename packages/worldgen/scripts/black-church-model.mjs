/** Black Church in Brasov: Gothic hall, tall clock tower, steep tile roofs and polygonal choir. */
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
  '../../../content/worldgen/source/places/u8/u84/black_church/',
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
  wall: '#bcb09b',
  trim: '#d4c9b4',
  roof: '#a16b52',
  metal: '#8e9c92',
  door: '#76583f',
  glass: '#47576b',
  accent: '#41464b',
  clock: '#efe1bf',
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
const footing = (p) => Math.min(floor - 0.3, blackChurchGround(...p) - 0.35);
export function blackChurchGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Black Church footing outside retained terrain');
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
const main = rec.main.polygons[0].outline,
  _body = rec.bodyPlans[0].outline,
  choir = rec.choirPlans[0].outline,
  tower = rec.towerPlan,
  _stub = rec.stubPlan;
const bounds = (r) => [
    Math.min(...r.map((p) => p[0])),
    Math.min(...r.map((p) => p[1])),
    Math.max(...r.map((p) => p[0])),
    Math.max(...r.map((p) => p[1])),
  ],
  mid = (r) => {
    const b = bounds(r);
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  },
  regular = (p, r, n = 8) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + r * Math.cos((i * Math.PI * 2) / n + Math.PI / 8),
      p[1] + r * Math.sin((i * Math.PI * 2) / n + Math.PI / 8),
    ]),
  point = (f, t = 0.5) => lerp(f.a, f.b, t);
const west = edge(main, [-1, 0]),
  south = edge(main, [0, 1]),
  north = edge(main, [0, -1]),
  tf = [edge(tower, [-1, 0]), edge(tower, [0, 1])],
  towerCenter = mid(tower);
function on(f, x) {
  const t = (x - f.a[0]) / (f.b[0] - f.a[0]);
  return point(f, t);
}
export function blackChurchFields() {
  const hs = [];
  for (const [name, f] of [
    ['south', south],
    ['north', north],
  ])
    for (const x of [-25, -17, -9, -1, 7])
      hs.push({
        ...hole(`nave-${name}-${x}`, on(f, x), f.axis, f.normal, 3.1, 7, 15, 11.1),
        kind: 'window',
      });
  for (let i = 0; i < choir.length; i++) {
    const f = faceFrame(choir, i);
    if (f.normal[0] < -0.5) continue;
    const count = Math.max(1, Math.round(f.length / 7));
    for (let j = 0; j < count; j++) {
      const q = point(f, (j + 0.5) / count);
      if (q[0] < 12) continue;
      hs.push({
        ...hole(
          `choir-${i}-${j}`,
          q,
          f.axis,
          f.normal,
          Math.min(3.0, (f.length / count) * 0.55),
          5.3,
          17.3,
          13,
        ),
        kind: 'window',
      });
    }
  }
  for (const [i, f] of tf.entries()) {
    hs.push({
      ...hole(`tower-upper-slit-${i}`, point(f), f.axis, f.normal, 0.85, 37, 6, 5.2),
      kind: 'window',
    });
    hs.push({
      ...hole(`tower-lower-window-${i}`, point(f), f.axis, f.normal, 2.4, 7, 15, 11.4),
      kind: 'window',
    });
  }
  const centerWest = point(west, 0.5);
  hs.push({
    ...hole(
      'west-main-door',
      centerWest,
      west.axis,
      west.normal,
      3.7,
      blackChurchGround(...centerWest) + 0.22 - floor,
      6.3,
      3.6,
    ),
    kind: 'door',
  });
  hs.push({
    ...hole('west-upper-window', centerWest, west.axis, west.normal, 3.1, 11.2, 10.6, 7.3),
    kind: 'window',
  });
  const sd = on(south, -13);
  hs.push({
    ...hole(
      'south-door',
      sd,
      south.axis,
      south.normal,
      3.0,
      blackChurchGround(...sd) + 0.22 - floor,
      4.7,
      2.6,
    ),
    kind: 'door',
  });
  return hs;
}
export function blackChurchGalleryFields(d = 3) {
  if (d === 0) return [];
  const r = regular(towerCenter, 3.35);
  return r.map((_, i) => {
    const f = faceFrame(r, i);
    return hole(
      `crown-open-arch-${i}`,
      point(f),
      f.axis,
      f.normal,
      1.5,
      48.25,
      2.4,
      1.65,
      'round',
      3,
    );
  });
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
function buttress(face, p, n, d) {
  const a = [-n[1], n[0]],
    r = (depth, width) =>
      [
        [-width / 2, -0.12],
        [width / 2, -0.12],
        [width / 2, depth],
        [-width / 2, depth],
      ].map(([u, v]) => [p[0] + a[0] * u + n[0] * v, p[1] + a[1] * u + n[1] * v]);
  const stages =
    d === 0
      ? [[0, 20, 2.0, 1.2]]
      : d === 1
        ? [
            [0, 13, 2, 1.3],
            [13, 24.4, 0.8, 0.8],
          ]
        : [
            [0, 6, 2.2, 1.5],
            [6, 13, 1.65, 1.25],
            [13, 20.4, 1.15, 1.0],
            [20.4, 24.4, 0.65, 0.8],
          ];
  for (const [b, t, depth, w] of stages) {
    const rr = r(depth, w);
    solid(face, rr, b === 0 ? footing : b, t, 'wall');
    if (d >= 1) {
      cap(face, scaled(rr, 1.05), t + 0.15, 'trim');
      band(face, rr, t - 0.18, 0.18, 'trim', 1.04);
    }
  }
  if (d >= 2) {
    const rr = r(0.6, 0.65),
      pinnacle = rr.map((q) => q.map((v, k) => v + (k === 0 ? n[0] : n[1]) * 0.12));
    profile(
      face,
      pinnacle,
      [
        [24.4, 1],
        [25.1, 1],
        [26.5, 0.06],
      ],
      'trim',
    );
  }
}
function buttresses(face, d) {
  for (const f of [south, north])
    for (const x of [-29, -21, -13, -5, 3, 10]) buttress(face, on(f, x), f.normal, d);
  for (let i = 0; i < choir.length; i++) {
    const f = faceFrame(choir, i);
    if (f.normal[0] < -0.5) continue;
    const count = Math.max(1, Math.round(f.length / 7));
    for (let j = 0; j < count; j++) {
      const p = point(f, j / count);
      if (p[0] > 11.3) buttress(face, p, f.normal, d);
    }
  }
  if (d >= 1)
    for (const f of tf) {
      const p = point(f, 0.08);
      buttress(face, p, f.normal, d);
    }
}
function clocks(face, d) {
  if (d === 0) return;
  for (const f of tf) {
    const p = prepareOpening(hole('clock', point(f), f.axis, f.normal, 5, 30.1, 5), 0, d),
      sg = Math.sign(-p.axis[1] * f.normal[0] + p.axis[0] * f.normal[1]),
      q = (u, v, o = 0.12) => p.point(u, v, o * sg);
    face(
      'clock',
      [q(-2.6, floor + 30), q(2.6, floor + 30), q(2.6, floor + 35.2), q(-2.6, floor + 35.2)],
      [f.normal[0], 0, f.normal[1]],
    );
    const n = d === 1 ? 12 : 24,
      cy = floor + 32.6,
      outer = Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n;
        return q(2.15 * Math.cos(a), cy + 2.15 * Math.sin(a), 0.15);
      });
    face('accent', outer, [f.normal[0], 0, f.normal[1]]);
    const inner = Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return q(1.93 * Math.cos(a), cy + 1.93 * Math.sin(a), 0.18);
    });
    face('clock', inner, [f.normal[0], 0, f.normal[1]]);
    beam(face, q(0, cy, 0.22), q(0.15, cy + 1.6, 0.22), 0.14, 'accent');
    beam(face, q(0, cy, 0.22), q(-1.1, cy - 0.5, 0.22), 0.17, 'accent');
    if (d >= 2)
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        beam(
          face,
          q(1.64 * Math.cos(a), cy + 1.64 * Math.sin(a), 0.21),
          q(1.83 * Math.cos(a), cy + 1.83 * Math.sin(a), 0.21),
          0.11,
          'accent',
        );
      }
  }
}
function steps(face, d) {
  for (const h of blackChurchFields().filter((h) => h.kind === 'door')) {
    const y = h.bottom - floor,
      p = h.center,
      a = h.axis,
      n = h.normal;
    for (let i = 0; i < (d === 0 ? 1 : 3); i++) {
      const q = p.map((v, k) => v + n[k] * (0.3 + i * 0.38)),
        r = [
          [-h.width * 0.6, 0],
          [h.width * 0.6, 0],
          [h.width * 0.6, 0.42],
          [-h.width * 0.6, 0.42],
        ].map(([u, v]) => q.map((w, k) => w + a[k] * u + n[k] * v));
      solid(face, r, footing, y - 0.08 - i * 0.11, 'trim');
    }
  }
}
function turret(face, d) {
  const p = [-29.8, 12.4],
    r = regular(p, 1.35, d >= 3 ? 12 : 8);
  solid(face, r, 0, 28.3, 'wall');
  profile(
    face,
    r,
    [
      [28.3, 1.13],
      [29.1, 1.13],
      [32.3, 0.05],
    ],
    'trim',
  );
  if (d >= 2)
    for (const k of [0, 2, 4, 6]) {
      const f = faceFrame(r, k),
        h = hole(`turret-slit-${k}`, point(f), f.axis, f.normal, 0.32, 25.4, 1.2, 0.85);
      pane(face, h, d, 0.035);
    }
}
function build(out, d) {
  const target = out;
  out = {
    addTriangle(slot, ref, points, normal, uv, color) {
      const p = points.map((v) => v.map(Math.fround));
      const lengths = p.map((a, i) => Math.hypot(...a.map((v, k) => v - p[(i + 1) % 3][k]))),
        max = d === 0 ? 28 : d === 1 ? 22 : 16,
        longest = Math.max(...lengths);
      if (longest > max) {
        const i = lengths.indexOf(longest),
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
    fields = blackChurchFields(),
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
  if (d >= 2) shell(out, d, main, footing, 24, fields, 'wall');
  else sides(face, d === 0 ? coarse(main) : main, footing, 24, 'wall');
  cap(cut, main, 24, 'wall');
  band(cut, main, 23.45, 0.55, 'trim', 1.012);
  gable(cut, rec.controls.find((b) => b.id === rec.roles.nave).polygons[0].outline, 24, 41);
  hip(cut, choir, 24, 37);
  hip(cut, rec.westPlans[0].outline, 24, 31);
  if (d >= 2) shell(out, d, tower, 24, 44.5, fields, 'wall');
  else sides(face, tower, 24, 44.5, 'wall');
  cap(cut, tower, 44.5, 'wall');
  band(cut, tower, 35.45, 0.25, 'trim', 1.02);
  band(cut, tower, 44.1, 0.4, 'trim', 1.035);
  profile(
    face,
    tower,
    [
      [44.5, 1.07],
      [48, 0.66],
    ],
    'roof',
  );
  const crown = regular(towerCenter, 3.35),
    gallery = blackChurchGalleryFields(d);
  if (d >= 1) {
    shell(out, d, crown, 48, 51, gallery, 'wall', scaled(crown, 0.7));
    band(face, crown, 47.9, 0.28, 'trim', 1.05);
    band(face, crown, 50.8, 0.25, 'trim', 1.05);
  } else sides(face, crown, 48, 51, 'wall');
  profile(
    face,
    crown,
    [
      [51, 1.17],
      [57.4, 0.35],
      [60.5, 0.13],
    ],
    'roof',
  );
  profile(
    face,
    crown,
    [
      [60.5, 0.13],
      [64.2, 0.015],
    ],
    'metal',
  );
  beam(face, at(towerCenter, 64.1), at(towerCenter, 65), d === 0 ? 0.25 : 0.15, 'accent');
  if (d >= 1) {
    for (const h of fields) panel(face, h, d);
    clocks(face, d);
  }
  buttresses(cut, d);
  turret(face, d);
  const fleche = regular([-2, 0], 0.8, d >= 3 ? 12 : 8);
  sides(face, fleche, 40.1, 41.7, 'metal');
  profile(
    face,
    fleche,
    [
      [41.7, 1.2],
      [44.2, 0.04],
    ],
    'metal',
  );
  beam(face, [-2, floor + 44.1, 0], [-2, floor + 45, 0], 0.12, 'accent');
  steps(face, d);
  if (d >= 2) {
    for (const f of [south, north]) {
      beam(face, at(f.a, 24.05), at(f.b, 24.05), 0.22, 'accent');
    }
    for (let i = 0; i < choir.length; i++) {
      const f = faceFrame(choir, i);
      if (f.normal[0] < -0.5) continue;
      const n = Math.max(1, Math.floor(f.length / 1.3));
      for (let j = 0; j < n; j++) {
        const p = point(f, (j + 0.5) / n),
          a = f.axis,
          normal = f.normal,
          rr = Array.from({ length: d >= 3 ? 12 : 8 }, (_, i) => {
            const t = (i * Math.PI * 2) / (d >= 3 ? 12 : 8);
            return [
              p[0] + a[0] * 0.36 * Math.cos(t) + normal[0] * 0.1,
              floor + 24.4 + 0.36 * Math.sin(t),
              p[1] + a[1] * 0.36 * Math.cos(t) + normal[1] * 0.1,
            ];
          });
        for (let k = 0; k < rr.length; k++) beam(face, rr[k], rr[(k + 1) % rr.length], 0.1, 'trim');
      }
      beam(face, at(f.a, 24.85), at(f.b, 24.85), 0.16, 'trim');
    }
  }
}
export const buildBlackChurchSkyline = (o) => build(o, 0),
  buildBlackChurchDistrict = (o) => build(o, 1),
  buildBlackChurchStreet = (o) => build(o, 2),
  buildBlackChurchCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const blackChurchStudy = {
  id: 'black_church',
  key: 'black_church',
  title: 'Black Church',
  category: 'cathedral',
  wikidataId: 'Q910124',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way866090450 matches current four unscaled main/nave/choir/apse plans. Western clock tower and eastern choir sign the frame.',
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
    'Five existing shared256-square ashlar, limestone, flat tile, plain wood and standing-seam metal graphs; linear gray-tan stone/red-brown tile tints and metric UVs. Glass, metal accents and a simplified clock use flat PBR vertex colors. Zero embedded images or bespoke facade textures, no baked soot/weathering/shadows.',
  importReason:
    'Four authored browser levels retain the long Gothic hall, steep main/choir roofs, southwest clock tower/crown and eastern polygonal choir at the signed mapped location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three useful pictures and standard viewer PMTiles/DEM. Exact clock mural/numerals, stone sculpture/inscriptions, tiny tracery/portal details, surrounding trees/town, interiors and certified walking excluded. Tower/stair/fleche divisions, facade rhythm and buttress widths are approximate; physical device timing pending.',
    'Skyline preserves the individual roof/tower profile and coarse buttresses. District adds shared textures, flat pointed glazing/doors, clocks and genuinely open crown gallery. Street adds facade/door recesses, stepped buttresses/pinnacles, restrained mullions/tracery and parapet rings. Closeup/master refine arch/ring facets. Synthetic context neighbors are not mapped Brasov buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-clock-tower-and-lower-corner', [-78, 30, 28], [-32, 25, 3]),
    cam('layered-tower-clock-gallery-spire', [-70, 60, 48], [-35, 47, 8]),
    cam('east-polygonal-choir-and-buttresses', [77, 33, 35], [26, 20, 0]),
    cam('south-pointed-windows-and-entry', [-1, 18, 67], [-1, 13, 12]),
    cam('north-steep-nave-roof', [3, 40, -76], [0, 26, 0]),
    cam('steep-tile-roofs-and-ridge-fleche', [3, 105, 18], [0, 20, 0]),
  ],
};

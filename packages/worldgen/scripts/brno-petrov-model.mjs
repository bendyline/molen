/** Brno Petrov: junction twin spires, broad nave, lower choir and Gothic western portal. */
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
  '../../../content/worldgen/source/places/u2/u2e/n0364_cathedral_of_st_peter_and_paul/',
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
  wall: '#c1b299',
  trim: '#d6c8ad',
  roof: '#80988e',
  metal: '#6d9b8e',
  door: '#75533d',
  glass: '#48596b',
  accent: '#45494a',
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
const footing = (p) => Math.min(floor - 0.3, brnoPetrovGround(...p) - 0.35);
export function brnoPetrovGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Brno Petrov footing outside retained terrain');
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
  nave = ring('nave'),
  choir = coarse(rec.choirPlans[0].outline),
  towerNames = ['northTower', 'southTower'],
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
  point = (f, t = 0.5) => lerp(f.a, f.b, t),
  along = (f, x) => point(f, (x - f.a[0]) / (f.b[0] - f.a[0])),
  regular = (p, r, n = 8) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + r * Math.cos((i * Math.PI * 2) / n + Math.PI / 8),
      p[1] + r * Math.sin((i * Math.PI * 2) / n + Math.PI / 8),
    ]),
  west = edge(nave, [-1, 0]),
  porch = R(-36, -2.5, -31.2, 6.2);
export function brnoPetrovFields() {
  const hs = [];
  for (const [name, n] of [
    ['north', [0, -1]],
    ['south', [0, 1]],
  ]) {
    const f = edge(nave, n);
    for (const x of [-26, -18, -10, -2]) {
      const short = name === 'north' && x >= -10;
      hs.push({
        ...hole(
          `nave-${name}-${x}`,
          along(f, x),
          f.axis,
          f.normal,
          3.4,
          short ? 16 : 8.3,
          short ? 10 : 17.7,
          short ? 7.2 : 13.1,
        ),
        kind: 'window',
      });
    }
  }
  for (let i = 0; i < choir.length; i++) {
    const f = faceFrame(choir, i);
    if (f.normal[0] < -0.6 || f.length < 3.3) continue;
    const count = Math.max(1, Math.round(f.length / 6.4));
    for (let j = 0; j < count; j++) {
      const p = point(f, (j + 0.5) / count),
        short = p[0] < 27 && (f.normal[1] < -0.5 || f.normal[1] > 0.5),
        b = short ? 15.8 : 6.2;
      hs.push({
        ...hole(
          `choir-${i}-${j}`,
          p,
          f.axis,
          f.normal,
          Math.min(3.0, (f.length / count) * 0.64),
          b,
          22.3 - b,
          (22.3 - b) * 0.75,
        ),
        kind: 'window',
      });
    }
  }
  const cp = point(west),
    threshold = brnoPetrovGround(...cp) + 0.22 - floor;
  hs.push({
    ...hole('west-wood-entry', cp, west.axis, west.normal, 3.4, threshold, 5.9, 3.7),
    kind: 'door',
  });
  hs.push({
    ...hole('west-grand-window', cp, west.axis, west.normal, 6.5, 13.8, 12.2, 8.9),
    kind: 'window',
  });
  for (const t of [0.13, 0.87])
    hs.push({
      ...hole(
        `west-side-window-${t}`,
        point(west, t),
        west.axis,
        west.normal,
        2.7,
        10.2,
        14.5,
        10.6,
      ),
      kind: 'window',
    });
  for (const [n, plans] of [
    ['chapel-west', rec.chapelWestPlans],
    ['chapel-east', rec.chapelEastPlans],
  ])
    for (const p of plans) {
      const r = coarse(p.outline),
        f = edge(r, [0, -1]);
      if (!f) continue;
      for (const t of [0.35, 0.65])
        hs.push({
          ...hole(
            `${n}-${t}`,
            point(f, t),
            f.axis,
            f.normal,
            1.1,
            n === 'chapel-west' ? 6.7 : 3.2,
            n === 'chapel-west' ? 2.7 : 3.3,
            n === 'chapel-west' ? 1.8 : 2.2,
          ),
          kind: 'window',
        });
    }
  return hs;
}
export function brnoPetrovBelfry(d = 3) {
  if (d === 0) return [];
  return towerNames.flatMap((name) => {
    const r = ring(name),
      crown = regular(mid(r), 2.85),
      hs = r.map((_, i) => {
        const f = faceFrame(r, i);
        return hole(
          `${name}-square-belfry-${i}`,
          point(f),
          f.axis,
          f.normal,
          2.6,
          43.0,
          10.8,
          8.1,
          'pointed',
          3.5,
        );
      });
    for (let i = 0; i < crown.length; i++) {
      const f = faceFrame(crown, i);
      hs.push(
        hole(
          `${name}-crown-${i}`,
          point(f),
          f.axis,
          f.normal,
          1.15,
          55.5,
          4.1,
          3.0,
          'pointed',
          2.4,
        ),
      );
    }
    return hs;
  });
}
export function brnoPetrovPorchFields() {
  const r = porch,
    hs = [];
  for (const n of [
    [-1, 0],
    [0, -1],
    [0, 1],
  ]) {
    const f = edge(r, n),
      p = point(f),
      b = brnoPetrovGround(...p) + 0.22 - floor;
    hs.push(
      hole(
        `porch-open-${n.join(',')}`,
        p,
        f.axis,
        f.normal,
        n[0] ? 4.8 : 3.1,
        b,
        9.0,
        6.3,
        'pointed',
        3,
      ),
    );
  }
  return hs;
}
function pier(face, p, n, d, top = 27.7) {
  const a = [-n[1], n[0]],
    r = (depth, w) =>
      [
        [-w / 2, -0.15],
        [w / 2, -0.15],
        [w / 2, depth],
        [-w / 2, depth],
      ].map(([u, v]) => [p[0] + a[0] * u + n[0] * v, p[1] + a[1] * u + n[1] * v]);
  const stages =
    d <= 1
      ? [[0, top, 1.3, 0.95]]
      : [
          [0, top * 0.45, 1.6, 1.2],
          [top * 0.45, top * 0.8, 1.1, 0.9],
          [top * 0.8, top, 0.65, 0.7],
        ];
  for (const [b, t, dep, w] of stages) {
    const rr = r(dep, w);
    solid(face, rr, b === 0 ? footing : b, t, 'wall');
    if (d >= 2) band(face, rr, t - 0.16, 0.16, 'trim', 1.05);
  }
  if (d >= 2)
    profile(
      face,
      r(0.6, 0.65),
      [
        [top, 1],
        [top + 0.6, 1],
        [top + 2.3, 0.05],
      ],
      'trim',
    );
}
function buttresses(face, d) {
  for (const n of [
    [0, -1],
    [0, 1],
  ]) {
    const f = edge(nave, n);
    for (const x of [-30, -22, -14, -6, 4]) pier(face, along(f, x), f.normal, d);
  }
  for (let i = 0; i < choir.length; i++) {
    const f = faceFrame(choir, i);
    if (f.normal[0] < -0.6 || f.length < 3.3) continue;
    const count = Math.max(1, Math.round(f.length / 6.4));
    for (let j = 0; j < count; j++) pier(face, point(f, j / count), f.normal, d, 22.7);
  }
  for (const t of [0.03, 0.35, 0.65, 0.97])
    pier(face, point(west, t), west.normal, d, t === 0.03 || t === 0.97 ? 28 : 27);
}
function towers(out, face, d) {
  for (const name of towerNames) {
    const r = ring(name),
      p = mid(r),
      fields = brnoPetrovBelfry(d).filter((h) => h.name.startsWith(name)),
      square = fields.filter((h) => h.name.includes('square')),
      oct = fields.filter((h) => h.name.includes('crown')),
      rr = regular(p, 2.85);
    if (d >= 1) {
      shell(out, d, r, 42, 55, square, 'wall', scaled(r, 0.7));
      shell(out, d, rr, 55, 60.5, oct, 'trim', scaled(rr, 0.68));
      if (d >= 2) for (const h of fields) archBand(face, h, d, 0.24, 'trim', 0.07);
    } else {
      sides(face, r, 42, 55, 'wall');
      sides(face, rr, 55, 60.5, 'trim');
    }
    cap(face, r, 55, 'trim', [scaled(rr, 0.75)]);
    if (d >= 1) {
      band(face, r, 41.6, 0.4, 'trim', 1.035);
      band(face, r, 54.7, 0.3, 'trim', 1.04);
      band(face, rr, 60.2, 0.3, 'trim', 1.06);
    }
    profile(
      face,
      rr,
      [
        [60.5, 1.05],
        [80.8, 0.12],
        [83.2, 0.025],
      ],
      'metal',
    );
    beam(face, at(p, 83.1), at(p, 84), 0.15, 'accent');
    if (d >= 1) {
      for (const v of d >= 2 ? r : []) {
        const q = regular(v, 0.3, 4);
        solid(face, q, 42, 54.6, 'trim');
        profile(
          face,
          q,
          [
            [54.6, 1.25],
            [58, 0.05],
          ],
          'trim',
        );
      }
      const f = edge(r, name === 'northTower' ? [0, -1] : [0, 1]),
        q = point(f),
        a = f.axis,
        n = f.normal,
        N = d === 1 ? 12 : 24,
        cy = floor + 38.3,
        point3 = (u, v, o = 0.08) => [q[0] + a[0] * u + n[0] * o, v, q[1] + a[1] * u + n[1] * o],
        disk = Array.from({ length: N }, (_, i) => {
          const t = (i * Math.PI * 2) / N;
          return point3(1.1 * Math.cos(t), cy + 1.1 * Math.sin(t));
        });
      face('accent', disk, [n[0], 0, n[1]], colors.trim);
      beam(face, point3(0, cy, 0.1), point3(0.1, cy + 0.8, 0.1), 0.12, 'accent');
      beam(face, point3(0, cy, 0.1), point3(-0.65, cy - 0.3, 0.1), 0.14, 'accent');
    }
  }
}
function fleche(face, d) {
  const p = mid(ring('fleche')),
    r = regular(p, 1.1, d >= 3 ? 12 : 8);
  solid(face, r, 29.7, 33.4, 'metal');
  profile(
    face,
    r,
    [
      [33.4, 1.18],
      [44.4, 0.035],
    ],
    'metal',
  );
  beam(face, at(p, 44.3), at(p, 45), 0.12, 'accent');
  if (d >= 2)
    for (let i = 0; i < r.length; i += 2) {
      const f = faceFrame(r, i),
        h = hole(`fleche-small-window-${i}`, point(f), f.axis, f.normal, 0.42, 31, 1.5, 1);
      pane(face, h, d, 0.03);
    }
}
function dormers(face, d) {
  if (d === 0) return;
  for (const z of [-4.8, 8.3])
    for (const x of [-26, -18, -10, -2]) {
      const r = R(x - 0.75, z - 0.55, x + 0.75, z + 0.55),
        wrapped = (slot, p, n, col) => face(slot === 'wall' ? 'roof' : slot, p, n, col);
      sides(wrapped, r, 33.5, 34.5, 'roof');
      gable(wrapped, r, 34.5, 35.35, 'roof', 1);
      const f = edge(r, [0, z < 0 ? -1 : 1]),
        h = hole('dormer', point(f), f.axis, f.normal, 0.85, 33.8, 0.8, 0.6, 'rect');
      pane(face, h, d, 0.03);
    }
}
function porchModel(out, face, d) {
  const hs = [
    ...brnoPetrovPorchFields(),
    ...(d >= 2 ? brnoPetrovFields().filter((h) => h.kind === 'door') : []),
  ];
  shell(out, d, porch, footing, 10.3, hs, 'trim', scaled(porch, 0.76));
  hip(face, porch, 10.3, 12.7);
  if (d >= 2) for (const h of hs) archBand(face, h, d, 0.55, 'trim', 0.08);
}
function build(out, d) {
  const target = out;
  out = {
    addTriangle(slot, ref, points, normal, uv, color) {
      const p = points.map((v) => v.map(Math.fround)),
        lens = p.map((a, i) => Math.hypot(...a.map((v, k) => v - p[(i + 1) % 3][k]))),
        longest = Math.max(...lens),
        max = d === 0 ? 36 : d === 1 ? 24 : 16;
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
    fields = brnoPetrovFields(),
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
  for (const layer of rec.wallLayers)
    for (const p of layer.polygons) {
      const r = d === 0 ? coarse(p.outline) : p.outline;
      if (d >= 2) shell(out, d, r, layer.bottom ?? footing, layer.top, fields, 'wall');
      else sides(face, r, layer.bottom ?? footing, layer.top, 'wall');
      cap(cut, r, layer.top, 'wall', p.holes);
    }
  if (d >= 2)
    for (const p of rec.main.polygons) {
      sides(face, p.outline, footing, 0.35, 'wall');
    }
  gable(cut, nave, 28, 40);
  gable(cut, ring('crossing'), 28, 40);
  hip(cut, choir, 23, 30);
  for (const [_name, plans, e, t] of [
    ['west', rec.chapelWestPlans, 10, 15],
    ['east', rec.chapelEastPlans, 7.5, 12],
    ['south', rec.southAnnexPlans, 10, 14],
  ])
    for (const p of plans) {
      hip(cut, coarse(p.outline), e, t);
      band(cut, coarse(p.outline), e - 0.2, 0.2, 'trim', 1.02);
    }
  band(cut, nave, 27.6, 0.4, 'trim', 1.015);
  band(cut, choir, 22.65, 0.35, 'trim', 1.018);
  towers(out, face, d);
  fleche(face, d);
  buttresses(cut, d);
  dormers(face, d);
  porchModel(out, face, d);
  if (d >= 1) for (const h of fields) panel(face, h, d);
  const a = point(west),
    left = west.a,
    right = west.b;
  if (d >= 1) {
    beam(face, at(left, 28.1), at(a, 40.2), 0.23, 'trim');
    beam(face, at(a, 40.2), at(right, 28.1), 0.23, 'trim');
  }
  if (d >= 1) beam(face, at(a, 40), at(a, 42), 0.18, 'accent');
}
export const buildBrnoPetrovSkyline = (o) => build(o, 0),
  buildBrnoPetrovDistrict = (o) => build(o, 1),
  buildBrnoPetrovStreet = (o) => build(o, 2),
  buildBrnoPetrovCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const brnoPetrovStudy = {
  id: 'N0364',
  key: 'cathedral_of_st_peter_and_paul',
  title: 'Cathedral of St. Peter and Paul, Brno',
  category: 'cathedral',
  wikidataId: 'Q45033',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID way32877797 matches current main and six part controls. West gabled portal, lower east choir and junction twin spires sign frame.',
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
    'Four existing shared256-square rubble stone, limestone, standing-seam metal and plain wood graphs. Roof and spires reuse the same metal graph with distinct gray-green tints; warm stone/pale trim use linear colors and metric UVs. Glass/clocks/accents are flat PBR vertex colors. No embedded images, bespoke textures or baked snow/soot/shadows.',
  importReason:
    'Four authored browser levels retain the central-junction twin spires, broad nave, lower polygonal choir, small fleche and western Gothic portal at the signed mapped site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior based on four useful pictures and standard viewer PMTiles/DEM only. Eaves/roof slopes, tower subdivisions/crowns, small annex clipping, porch dimensions, dormers, facade rhythm, buttress widths and thresholds are estimates. Exact sculpture/inscriptions, stained-glass art, bells/interiors, Petrov terrace retaining walls, surrounding town/landscaping and certified walking excluded. Physical device timing pending.',
    'Skyline keeps twin needle spires at the junction, broad high nave, lower choir, fleche, open porch and coarse buttresses. District adds textures, flat glazing/doors, clocks/dormers and open belfries/crowns. Street adds recesses, stepped buttresses/pinnacles, portal bands and sparse tracery. Closeup/master refine facets. Synthetic context neighbors are not mapped Brno buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-gabled-window-and-open-portal', [-76, 22, 7], [-30, 16, 1]),
    cam('paired-junction-belfries-and-needle-spires', [-23, 72, -54], [8, 59, 1]),
    cam('east-polygonal-choir-and-ridge-fleche', [68, 31, -10], [25, 20, 1]),
    cam('north-stone-windows-and-low-chapels', [-8, 20, -64], [-6, 15, -10]),
    cam('south-tower-and-vestry', [16, 28, 67], [10, 19, 11]),
    cam('metal-roof-dormers-and-height-tiers', [-8, 104, 7], [0, 23, 1]),
  ],
};

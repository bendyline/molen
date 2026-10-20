/** Rebuilt al-Nuri mosque: green dome, pointed galleries and northwest Al-Hadba minaret. */
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

const openingShape = (h, d) => {
  if (h.shape === 'pointed') {
    const w = h.width / 2,
      n = d <= 0 ? 1 : d === 1 ? 2 : d === 2 ? 3 : d === 3 ? 5 : 6,
      points = [
        [-w, h.bottom],
        [w, h.bottom],
        [w, h.bottom + h.spring],
      ];
    for (let i = 1; i <= n; i++) {
      const a = ((i / n) * Math.PI) / 3;
      points.push([
        -w + 2 * w * Math.cos(a),
        h.bottom + h.spring + ((h.height - h.spring) * Math.sin(a)) / Math.sin(Math.PI / 3),
      ]);
    }
    for (let i = 1; i <= n; i++) {
      const a = (Math.PI * 2) / 3 + ((i / n) * Math.PI) / 3;
      points.push([
        w + 2 * w * Math.cos(a),
        h.bottom + h.spring + ((h.height - h.spring) * Math.sin(a)) / Math.sin(Math.PI / 3),
      ]);
    }
    return points;
  }
  if (h.shape === 'circle')
    return Array.from({ length: d <= 1 ? 8 : 16 }, (_, i) => {
      const a = (i * Math.PI * 2) / (d <= 1 ? 8 : 16);
      return [(Math.cos(a) * h.width) / 2, h.bottom + h.height / 2 + (Math.sin(a) * h.height) / 2];
    });
  return baseOpeningShape(h, d);
};
function prepareOpening(h, b, d) {
  const v = basePrepareOpening(h, b, d);
  if (!['circle', 'pointed'].includes(h.shape)) return v;
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
  '../../../content/worldgen/source/places/sy/syq/n0469_great_mosque_of_al_nuri/',
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
  wall: '#ded4bc',
  trim: '#e7ddc8',
  roof: '#c6c2b4',
  brick: '#c0b093',
  metal: '#679384',
  wood: '#947e5e',
  glass: '#4c626f',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, nuriGround(...p) - 0.35);
export function nuriGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('al-Nuri Mosque footing outside retained terrain');
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
function _faceFrame(r, i) {
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
function _shell(out, d, r, b, t, holes = [], slot = 'wall', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
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
const _band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
function beam(face, a, b, w, slot = 'trim', capped = true) {
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
  if (capped) {
    face(
      slot,
      lo,
      axis.map((v) => -v),
    );
    face(slot, hi, axis);
  }
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
const _coarse = (r) => {
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
      // Far rings drop small map kinks; the source foundation retains every current vertex.
      if (t >= -0.05 && t <= 1.05 && Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz) < 1.4) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
};
function profile(face, ring, levels, slot, origin = center(ring)) {
  const scale = (f) => ring.map((p) => p.map((v, k) => origin[k] + (v - origin[k]) * f));
  let prev = scale(levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const r = scale(levels[i][1]);
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
        levels[i][0] === levels[i - 1][0]
          ? [0, levels[i - 1][1] > levels[i][1] ? 1 : -1, 0]
          : [
              (prev[k][0] + prev[j][0]) / 2 - origin[0],
              0,
              (prev[k][1] + prev[j][1]) / 2 - origin[1],
            ],
      );
    }
    prev = r;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
const plans = rec.plans;
const _rect = (x, z, w, h) => [
  [x - w / 2, z - h / 2],
  [x + w / 2, z - h / 2],
  [x + w / 2, z + h / 2],
  [x - w / 2, z + h / 2],
];
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
    p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
  ]);
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      center: lerp(a, b, 0.5),
      length: Math.hypot(...b.map((v, k) => v - a[k])),
    };
  });
const field = (name, center, axis, normal, width, bottom, height, spring, depth = 1) => ({
  name,
  center,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape: 'pointed',
  depth,
});
const point = (h, u, y, dep = 0) => [
  h.center[0] + h.axis[0] * u + h.normal[0] * dep,
  y,
  h.center[1] + h.axis[1] * u + h.normal[1] * dep,
];
function down(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function _slab(face, r, y, h, slot) {
  sides(face, r, y, y + h, slot);
  cap(face, r, y + h, slot);
  down(face, r, y, slot);
}
function _panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    outer = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
    ],
    p = [...outer, ...r],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function reveal(face, h, d, front, back, slot) {
  const r = openingShape(h, d),
    sg = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      du = b[0] - a[0],
      dy = b[1] - a[1];
    if (h.openBottom && a[1] === h.bottom && b[1] === h.bottom) continue;
    face(
      slot,
      [point(h, ...a, front), point(h, ...b, front), point(h, ...b, back), point(h, ...a, back)],
      [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
    );
  }
}
const dimensions = (r) =>
  [0, 1].map((k) => Math.max(...r.map((p) => p[k])) - Math.min(...r.map((p) => p[k])));
const _radius = (p) => Math.min(...dimensions(p.plan.outline)) / 2;
function _cupola(face, p, r, b, t, d, slot = 'roof', segments) {
  const n = segments ?? [6, 10, 16, 24, 28][d],
    steps = d <= 1 ? 3 : d === 2 ? 4 : 7,
    levels = Array.from({ length: steps }, (_, i) => {
      const u = ((i / (steps - 1)) * Math.PI) / 2;
      return [b + (t - b) * Math.sin(u), Math.cos(u)];
    });
  profile(face, circle(p, r, n), levels, slot);
}
export function nuriOpenings(d = 3) {
  const hall = Array.from({ length: 10 }, (_, i) => ({
    ...field(`hall-arch-${i}`, [-20.25 + i * 4.5, -12.55], [1, 0], [0, -1], 3.4, 0.6, 5, 3.1, 10),
    openBottom: true,
  }));
  const sides = [];
  for (const [name, r, front, normal] of [
    ['west', plans.westArcade, -32.5, [1, 0]],
    ['east', plans.eastArcade, 38.8, [-1, 0]],
  ]) {
    const low = Math.min(...r.map((p) => p[1])),
      high = Math.max(...r.map((p) => p[1])),
      count = d === 0 ? 3 : 9,
      step = (high - low) / count;
    for (let i = 0; i < count; i++)
      sides.push({
        ...field(
          `${name}-gallery-${i}`,
          [front, low + (i + 0.5) * step],
          [0, 1],
          normal,
          Math.min(step - 1.1, d === 0 ? 7 : 4.8),
          0.6,
          4.9,
          3,
          2,
        ),
        openBottom: true,
        range: name,
      });
  }
  return { hall, sides };
}
function foundation(face, r, d) {
  const dense = edges(r).flatMap((e) =>
      Array.from({ length: Math.ceil(e.length / 2.5) }, (_, i) =>
        lerp(e.a, e.b, i / Math.ceil(e.length / 2.5)),
      ),
    ),
    lo = Math.min(...dense.map(footing));
  sides(face, d === 0 ? r : dense, d === 0 ? () => lo : footing, 0.6, 'trim');
  cap(face, r, 0.6, 'trim');
}
function gallery(face, out, r, holes, d, height = 7) {
  const clip = writer(
    masked(
      out,
      holes.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  // Only the inward wall is opened; outer boundary walls stay closed.
  for (const e of edges(r)) {
    const inward = holes.some(
      (h) =>
        Math.hypot(h.center[0] - e.center[0], h.center[1] - e.center[1]) <= e.length / 2 + 0.1 &&
        h.normal[0] * e.normal[0] + h.normal[1] * e.normal[1] > 0.99,
    );
    const emit = inward ? clip : face;
    emit(
      'wall',
      [at(e.a, 0.6), at(e.b, 0.6), at(e.b, height), at(e.a, height)],
      [e.normal[0], 0, e.normal[1]],
    );
    if (!inward)
      emit(
        'wall',
        [at(e.a, 0.6), at(e.b, 0.6), at(e.b, height), at(e.a, height)],
        [-e.normal[0], 0, -e.normal[1]],
      );
  }
  cap(face, r, height, 'roof');
  down(face, r, height - 0.35, 'roof');
  for (const h of holes) {
    reveal(face, h, d, 0.02, -0.55, 'trim');
    archBand(face, h, d, d === 0 ? 0.25 : 0.3, 'trim', 0.04);
  }
}
function hall(face, out, d, hs) {
  const r = plans.whole.outline,
    cut = writer(
      masked(
        out,
        hs.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  sides(cut, r, 0.6, 8.5, 'wall');
  cap(face, r, 8.5, 'roof');
  down(face, r, 8.15, 'roof');
  // A continuous rear screen closes the estimated gallery; no furnished hall is implied.
  const back = {
    ...field('hall-rear-screen', [0, -7.8], [1, 0], [0, -1], 48, 0.6, 7.9, 0, 0.1),
    shape: 'rect',
  };
  pane(face, back, d, 0, 'wall');
  for (const h of hs) {
    reveal(face, h, d, 0.04, -0.6, 'trim');
    if (d >= 1) archBand(face, h, d, 0.22, 'trim', 0.07);
  }
  if (d >= 1) {
    for (const x of [-18, -9, 0, 9, 18]) {
      const door = {
        ...field('hall-door', [x, -7.85], [1, 0], [0, -1], 2.3, 0.6, 3.2, 2.1, 0.1),
        shape: 'rect',
      };
      pane(face, door, d, 0.03, 'wood');
      if (d >= 2) archBand(face, door, d, 0.2, 'trim', 0.06);
    }
    const cornice = scaled(r, 1.005);
    sides(face, cornice, 8.15, 8.5, 'trim');
    for (const e of edges(r)) {
      if (e.normal[1] < -0.6 || e.length < 9) continue;
      const n = Math.floor(e.length / 7);
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n),
          h = field('outer-window', p, e.axis, e.normal, 1.4, 2.2, 2.6, 1.8, 0.1);
        pane(face, h, d, 0.04, 'glass');
        if (d >= 2) archBand(face, h, d, 0.2, 'trim', 0.07);
      }
    }
  }
}
function dome(face, d) {
  const p = plans.dome,
    n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : 28,
    r = circle(p.center, p.radius, n);
  solid(face, r, 8.5, p.drum, 'trim');
  const levels =
    d === 0
      ? [
          [p.drum, 1],
          [15.1, 0.8],
          [p.top, 0],
        ]
      : d === 1
        ? [
            [p.drum, 1],
            [12.4, 1],
            [15.1, 0.8],
            [17.5, 0.42],
            [p.top, 0],
          ]
        : [
            [p.drum, 1],
            [12, 1.02],
            [13.7, 0.95],
            [15.5, 0.77],
            [17.2, 0.5],
            [18.4, 0.22],
            [p.top, 0],
          ];
  profile(face, r, levels, 'metal', p.center);
  solid(face, circle(p.center, 0.18, d === 0 ? 4 : 8), 18.8, p.finial, 'metal');
  if (d >= 2)
    for (let i = 0; i < 8; i++) {
      const a = (i * 2 * Math.PI) / 8;
      for (let j = 1; j < levels.length - 1; j++) {
        const A = levels[j - 1],
          B = levels[j],
          point = (q) => [
            p.center[0] + Math.cos(a) * p.radius * q[1],
            floor + q[0] + 0.06,
            p.center[1] + Math.sin(a) * p.radius * q[1],
          ];
        beam(face, point(A), point(B), 0.2, 'metal');
      }
    }
}
function shortTurret(face, p, d) {
  const n = d === 0 ? 6 : d === 1 ? 8 : 16,
    r = circle(p, 1.05, n);
  profile(
    face,
    r,
    [
      [8.5, 1],
      [13.8, 0.88],
      [14.05, 1.25],
      [14.3, 1.25],
    ],
    'wall',
    p,
  );
  if (d === 0) {
    profile(
      face,
      r,
      [
        [14.3, 0.86],
        [15.6, 0.86],
        [16.4, 0],
      ],
      'trim',
      p,
    );
  } else {
    for (const q of circle(p, 0.87, 6)) beam(face, at(q, 14.3), at(q, 15.65), 0.22, 'trim');
    profile(
      face,
      r,
      [
        [15.65, 1.1],
        [15.85, 1.1],
        [16.4, 0],
      ],
      'trim',
      p,
    );
  }
  if (d >= 1) solid(face, circle(p, 0.14, d >= 2 ? 6 : 4), 16.3, 16.8, 'metal');
}
function leaningShaft(face, d) {
  const p = plans.tallMinaret,
    center = p.center,
    r = p.outline;
  const b = r,
    s = scaled(r, 0.85);
  sides(face, b, 0.6, 5.5, 'trim');
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(
      'brick',
      [at(b[i], 5.5), at(b[j], 5.5), at(s[j], 13), at(s[i], 13)],
      [(b[i][0] + b[j][0]) / 2 - center[0], 0, (b[i][1] + b[j][1]) / 2 - center[1]],
    );
  }
  cap(face, s, 13, 'brick');
  const n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : 28,
    levels =
      d === 0
        ? [
            [13, 2.85],
            [39.6, 1.85],
            [40, 2.4],
            [40.5, 2.4],
          ]
        : [
            [13, 2.85],
            [18, 2.72],
            [24, 2.5],
            [30, 2.28],
            [36, 2.04],
            [39.6, 1.85],
            [40, 2.4],
            [40.5, 2.4],
          ];
  const pos = (y) => center.map((v, k) => v + (p.lean[k] * (y - 13)) / 32);
  const ring = ([y, rad]) => circle(pos(y), rad, n).map((q) => at(q, y));
  for (let j = 1; j < levels.length; j++) {
    const lo = ring(levels[j - 1]),
      hi = ring(levels[j]);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(
        'brick',
        [lo[i], lo[k], hi[k], hi[i]],
        levels[j - 1][0] === levels[j][0]
          ? [0, 1, 0]
          : [lo[i][0] - pos(levels[j - 1][0])[0], 0, lo[i][2] - pos(levels[j - 1][0])[1]],
      );
    }
  }
  const top = pos(40.5),
    roof = pos(44.3);
  cap(face, circle(top, 2.4, n), 40.5, 'trim');
  profile(
    face,
    circle(top, 1.4, n),
    [
      [40.5, 1],
      [43.1, 1],
      [44.3, 0],
    ],
    'roof',
    top,
  );
  solid(face, circle(roof, 0.18, 4), 44.1, 45, 'metal');
  if (d >= 1) {
    for (const y of [18.4, 23.7, 29.1, 34.5, 39.1]) {
      const q = pos(y),
        rad = 2.85 - (y - 13) * (1 / 26.6) + 0.04;
      profile(
        face,
        circle(q, rad, n),
        [
          [y, 1],
          [y + 0.23, 1],
        ],
        'trim',
        q,
      );
    }
    // Broad original relief diamonds suggest patterned brick without tracing historic artwork.
    if (d >= 2)
      for (const e of edges(r)) {
        const onBatter = (u, y) => {
          const scale = 1 - (0.15 * (y - 5.5)) / 7.5;
          return [
            center[0] + (e.center[0] + e.axis[0] * u - center[0]) * scale + e.normal[0] * 0.08,
            floor + y,
            center[1] + (e.center[1] + e.axis[1] * u - center[1]) * scale + e.normal[1] * 0.08,
          ];
        };
        for (const y of [8.3, 10.7])
          for (const u of [-1.5, 1.5])
            face(
              'trim',
              [
                onBatter(u, y + 0.55),
                onBatter(u + 0.5, y),
                onBatter(u, y - 0.55),
                onBatter(u - 0.5, y),
              ],
              [e.normal[0], 0, e.normal[1]],
            );
      }
  }
}
function fountain(face, d) {
  const p = plans.pavilion,
    r = circle(p.center, p.radius, 8);
  solid(face, r, 0.6, 0.85, 'trim');
  down(face, circle(p.center, p.radius * 1.2, 8), 3.9, 'roof');
  for (const [i, q] of r.entries()) {
    if (d === 0 && i % 2) continue;
    beam(face, at(q, 0.85), at(q, 3.9), d === 0 ? 0.35 : 0.3, 'trim');
  }
  profile(
    (slot, p, n) => face(slot, p, n, colors.roof),
    circle(p.center, p.radius * 1.2, 8),
    [
      [3.9, 1],
      [4.15, 1],
      [6.8, 0],
    ],
    'metal',
    p.center,
  );
  solid(face, circle(p.center, 1.1, d === 0 ? 6 : 16), 0.85, 1.6, 'trim');
}
function build(out, d) {
  const face = writer(out, d),
    openings = nuriOpenings(d);
  for (const r of rec.masks) foundation(face, r, d);
  hall(face, out, d, openings.hall);
  dome(face, d);
  for (const p of plans.turrets) shortTurret(face, p, d);
  gallery(
    face,
    out,
    plans.westArcade,
    openings.sides.filter((h) => h.range === 'west'),
    d,
  );
  gallery(
    face,
    out,
    plans.eastArcade,
    openings.sides.filter((h) => h.range === 'east'),
    d,
  );
  leaningShaft(face, d);
  fountain(face, d);
}
export const buildNuriSkyline = (o) => build(o, 0),
  buildNuriDistrict = (o) => build(o, 1),
  buildNuriStreet = (o) => build(o, 2),
  buildNuriCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const nuriStudy = {
  id: 'N0469',
  key: 'great_mosque_of_al_nuri',
  title: 'Great Mosque of al-Nuri',
  category: 'mosque',
  wikidataId: 'Q5599605',
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
    'Original geometry under repository license; retained/current map controls ©OpenStreetMap contributors, ODbL-1.0. Reference pictures viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  sourceNotice:
    'Six existing shared256² coursed/raw limestone, lime plaster, brick, painted metal and plain wood graphs serve seven roles including palette glazing. Metric UVs and linear tints; no embedded images. Original coarse brick relief, no copied photographs, inscriptions or unique texture atlas.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Current map still labels the mosque ruins and supplies no building polygon. The hall uses the retained rounded six-vertex plan; the site extension, garden-side arcades and minaret base are approximations guided by named points and pictures. The duplicate central minaret marker is not modeled as another tower. Exact restored interiors, decorative brickwork, hidden roof construction, inscriptions, engineering and physical-device performance are unverified. Neighborhood buildings and visitor/museum facilities remain host content.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('rebuilt-hall-gallery', [48, 20, -55], [0, 6, -8]),
    cam('green-dome-and-four-turrets', [40, 29, -25], [0, 12, 2]),
    cam(
      'northwest-al-hadba',
      [-12, 29, -121],
      [plans.tallMinaret.center[0], 23, plans.tallMinaret.center[1]],
    ),
    cam('courtyard-arcade', [-15, 10, -28], [-35, 4, -43]),
    cam('octagonal-fountain', [20, 12, -60], [2.5, 3, -43]),
    cam('north-up-plan', [0, 240, -30.1], [0, 3, -30]),
  ],
};

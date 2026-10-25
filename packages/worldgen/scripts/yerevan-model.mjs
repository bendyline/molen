/** Yerevan Blue Mosque: narrow prayer hall,turquoise pointed dome,brick cupolas and east minaret. */
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
  '../../../content/worldgen/source/places/sz/szp/blue_mosque_yerevan/',
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
  wall: '#bd9a7b',
  trim: '#ded3bd',
  roof: '#ad5955',
  blue: '#4ca7ac',
  accent: '#dfc87b',
  door: '#9f866a',
  gold: '#c8b56f',
  glass: '#63768b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, yerevanGround(...p) - 0.35);
export function yerevanGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Yerevan Blue Mosque footing outside retained terrain');
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
function _solid(face, r, b, t, slot) {
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
        [(prev[k][0] + prev[j][0]) / 2 - origin[0], 0, (prev[k][1] + prev[j][1]) / 2 - origin[1]],
      );
    }
    prev = r;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
const _rect = (x, z, w, h) => [
    [x - w / 2, z - h / 2],
    [x + w / 2, z - h / 2],
    [x + w / 2, z + h / 2],
    [x - w / 2, z + h / 2],
  ],
  circle = (p, r, n) =>
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
function _down(face, r, y, slot, holes = []) {
  const p = [...r, ...holes.flat()],
    starts = [];
  let n = r.length;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(p.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, -1, 0],
    );
}
function _panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    p = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
      ...r,
    ],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function _reveal(face, h, d, front, back, slot = 'wall') {
  const r = openingShape(h, d),
    sg = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      du = b[0] - a[0],
      dy = b[1] - a[1];
    face(
      slot,
      [point(h, ...a, front), point(h, ...b, front), point(h, ...b, back), point(h, ...a, back)],
      [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
    );
  }
}
const plans = rec.plans;
function wallField(name, x, north, width, bottom, height, spring, kind = 'glass') {
  const e = edges(plans.outer).find(
    (e) =>
      Math.abs(e.normal[1]) > 0.8 &&
      e.normal[1] < 0 === north &&
      x >= Math.min(e.a[0], e.b[0]) &&
      x <= Math.max(e.a[0], e.b[0]),
  );
  if (!e) throw Error(`No mapped wall at ${x}`);
  const p = lerp(e.a, e.b, (x - e.a[0]) / (e.b[0] - e.a[0]));
  return { ...field(name, p, e.axis, e.normal, width, bottom, height, spring, 1.1), kind };
}
export function yerevanDoor() {
  return wallField('estimated-courtyard-door', -2.5, true, 3.1, 0.15, 5.0, 3.6, 'door');
}
export function yerevanFields(d) {
  if (d === 0) return [];
  const hs = [];
  for (const north of [false, true]) {
    for (const x of [-8, -2.5, 3]) {
      if (north && x === -2.5) continue;
      hs.push(wallField(`raised-hall-${north}-${x}`, x, north, 2.0, 3.5, 3.0, 2.15));
    }
    for (const x of [-29, -18, 14, 23])
      hs.push(wallField(`low-wing-${north}-${x}`, x, north, 1.5, 1.7, 2.7, 1.9));
  }
  return hs;
}
function backing(face, h, d) {
  pane(face, h, d, d <= 1 ? 0.025 : -0.24, h.kind);
  if (d >= 2) {
    archBand(face, h, d, 0.16, h.kind === 'door' ? 'blue' : 'trim', 0.025);
    if (h.kind === 'glass') {
      beam(
        face,
        point(h, 0, h.bottom + 0.12, -0.21),
        point(h, 0, h.bottom + h.spring - 0.1, -0.21),
        0.065,
        'trim',
      );
      beam(
        face,
        point(h, -h.width * 0.4, h.bottom + h.spring * 0.5, -0.21),
        point(h, h.width * 0.4, h.bottom + h.spring * 0.5, -0.21),
        0.065,
        'trim',
      );
    }
  }
}
function body(out, face, d) {
  const door = yerevanDoor(),
    hs = yerevanFields(d),
    prepared = [door, ...(d >= 2 ? hs : [])].map((h) => prepareOpening(h, 0, d)),
    mf = writer(masked(out, prepared), d);
  sides(face, plans.outer, footing, 0, 'wall');
  sides(mf, plans.outer, 0, 5.8, 'wall');
  const splitAtRidge = (r) =>
    r.flatMap((a, i) => {
      const b = r[(i + 1) % r.length];
      return a[1] * b[1] < 0 ? [a, lerp(a, b, -a[1] / (b[1] - a[1]))] : [a];
    });
  const lowY = (p) => floor + 5.8 + 0.8 * (1 - Math.min(1, Math.abs(p[1]) / 7.4));
  const mainY = (p) => floor + 10 + 0.6 * (1 - Math.min(1, Math.abs(p[1]) / 7.4));
  for (const p of plans.main) sides(mf, splitAtRidge(p.outline), 5.8, mainY, 'wall');
  for (const e of edges(splitAtRidge(plans.outer))) {
    if (Math.abs(e.normal[0]) < 0.8) continue;
    face(
      'wall',
      [at(e.a, 5.8), at(e.b, 5.8), at(e.b, lowY), at(e.a, lowY)],
      [e.normal[0], 0, e.normal[1]],
    );
  }
  for (const h of [door, ...hs]) {
    if (h === door || d >= 2) _reveal(face, h, d, 0, -0.26, 'trim');
    backing(face, h, d);
  }
  const tier = plans.roofTiers[d];
  for (const p of tier.low) cap(face, p.outline, lowY, 'roof', p.holes);
  for (const p of tier.high) cap(face, p.outline, mainY, 'roof', p.holes);
  if (d >= 2) {
    for (const p of plans.main) {
      sides(face, scaled(p.outline, 1.001), 9.75, 10, 'wall');
    }
    const h = yerevanDoor();
    archBand(face, h, d, 0.44, 'blue', 0.045);
  }
}
const domeLevels = [
  [12.4, 1],
  [13.4, 0.99],
  [15, 0.9],
  [16.8, 0.72],
  [18.2, 0.5],
  [19.5, 0.24],
  [20.5, 0.015],
];
function radiusAt(y) {
  for (let i = 1; i < domeLevels.length; i++) {
    const a = domeLevels[i - 1],
      b = domeLevels[i];
    if (y <= b[0]) return plans.dome.radius * (a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]));
  }
  return 0.02;
}
function domePoint(i, t, y, n) {
  const mid = ((i + 0.5) * 2 * Math.PI) / n,
    a = ((i + t) * 2 * Math.PI) / n,
    r = (radiusAt(y) * Math.cos(Math.PI / n)) / Math.cos(a - mid) + 0.018;
  return [
    plans.dome.center[0] + r * Math.cos(a),
    floor + y,
    plans.dome.center[1] + r * Math.sin(a),
  ];
}
function dome(face, d) {
  const p = plans.dome,
    ring = plans.roofTiers[d].domeRing,
    n = ring.length;
  // Extend below the sloping roof edge so the drum has no open collar.
  sides(face, ring, 9.9, p.drum, 'wall');
  profile(face, ring, domeLevels, 'blue', p.center);
  if (d >= 1) {
    for (let i = 0; i < n; i++) {
      const normal = [
        Math.cos(((i + 0.5) * 2 * Math.PI) / n),
        0,
        Math.sin(((i + 0.5) * 2 * Math.PI) / n),
      ];
      face(
        'accent',
        [
          domePoint(i, 0, 13.35, n),
          domePoint(i, 1, 13.35, n),
          domePoint(i, 1, 13.75, n),
          domePoint(i, 0, 13.75, n),
        ],
        normal,
      );
      if (d >= 2) {
        for (const [t0, t1, y] of [
          [0, 0.5, 12.55],
          [0.5, 1, 12.87],
        ])
          face(
            'trim',
            [
              domePoint(i, t0, y, n),
              domePoint(i, t1, y + 0.3, n),
              domePoint(i, t1, y + 0.48, n),
              domePoint(i, t0, y + 0.18, n),
            ],
            normal,
          );
        if (i % 2 === 0)
          face(
            'accent',
            [
              domePoint(i, 0.5, 14.55, n),
              domePoint(i, 0.8, 15.65, n),
              domePoint(i, 0.5, 16.75, n),
              domePoint(i, 0.2, 15.65, n),
            ],
            normal,
          );
        if (i % 2 === 1 && d >= 3)
          face(
            'trim',
            [
              domePoint(i, 0.5, 17.1, n),
              domePoint(i, 0.83, 17.7, n),
              domePoint(i, 0.5, 18.3, n),
              domePoint(i, 0.17, 17.7, n),
            ],
            normal,
          );
      }
    }
  }
  profile(
    face,
    circle(p.center, 0.12, d <= 1 ? 4 : 8),
    [
      [p.crown, 0.2],
      [p.crown + 0.25, 1],
      [p.finial, 0.01],
    ],
    'gold',
    p.center,
  );
}
function cupolas(face, d) {
  for (const [i, p] of plans.cupolas.entries()) {
    const r = plans.roofTiers[d].cupolaRings[i],
      levels =
        d <= 1
          ? [
              [p.base, 1],
              [p.base + 1.7, 0.84],
              [p.crown, 0.06],
            ]
          : [
              [p.base, 1],
              [p.base + 1, 0.95],
              [p.base + 2.4, 0.7],
              [p.crown - 0.4, 0.27],
              [p.crown, 0.04],
            ];
    sides(face, r, 5.7, p.base, 'wall');
    profile(face, r, levels, 'wall', p.center);
    if (d >= 1)
      _solid(
        face,
        _rect(p.center[0], p.center[1], 1.2, 1.2),
        p.crown - 0.25,
        p.crown + 0.75,
        'wall',
      );
  }
}
function minaret(face, d) {
  const p = plans.minaret,
    n = d <= 1 ? 8 : 16,
    r = circle(p.center, p.radius, n);
  _solid(face, _rect(...p.center, 3.2, 3.2), 0, p.base, 'wall');
  profile(
    face,
    r,
    [
      [p.base, 0.95],
      [p.base + 0.6, 1],
      [p.shaft, 1],
      [p.balcony, 1.5],
      [p.balcony + 0.2, 1.55],
    ],
    'wall',
    p.center,
  );
  const balcony = circle(p.center, p.radius * 1.6, n);
  sides(face, balcony, p.balcony + 0.2, p.balcony + 0.24, 'trim');
  cap(face, balcony, p.balcony + 0.24, 'trim');
  const roof = circle(p.center, p.radius * 1.8, n);
  _down(face, roof, p.neck - 0.25, 'roof');
  profile(
    face,
    roof,
    [
      [p.neck - 0.25, 1],
      [p.neck, 0.95],
    ],
    'roof',
    p.center,
  );
  profile(
    face,
    r,
    [
      [p.balcony + 0.24, 0.65],
      [p.neck, 0.65],
      [p.neck + 0.1, 0.86],
      [22.7, 0.83],
      [p.cap, 0.03],
    ],
    'blue',
    p.center,
  );
  if (d >= 1) {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        offset = [Math.cos(a) * p.radius * 1.25, Math.sin(a) * p.radius * 1.25];
      beam(
        face,
        at(
          p.center.map((v, k) => v + offset[k]),
          p.balcony + 0.24,
        ),
        at(
          p.center.map((v, k) => v + offset[k]),
          p.neck - 0.25,
        ),
        0.13,
        'trim',
      );
    }
    profile(
      face,
      r,
      [
        [21.8, 0.87],
        [22.1, 0.86],
      ],
      'accent',
      p.center,
    );
  }
  profile(
    face,
    circle(p.center, 0.1, d <= 1 ? 4 : 8),
    [
      [p.cap, 0.3],
      [p.cap + 0.1, 1],
      [p.top, 0.01],
    ],
    'gold',
    p.center,
  );
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((p) => p.map(Math.fround));
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
  dome(face, d);
  cupolas(face, d);
  minaret(face, d);
}
export const buildYerevanSkyline = (o) => build(o, 0),
  buildYerevanDistrict = (o) => build(o, 1),
  buildYerevanStreet = (o) => build(o, 2),
  buildYerevanCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const yerevanStudy = {
  id: 'blue_mosque_yerevan',
  key: 'blue_mosque',
  title: 'Blue Mosque',
  category: 'mosque',
  wikidataId: 'Q1979112',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six shared256² brick,limestone,standing-seam metal,mosaic tile,plain wood and bronze graphs;eight merged material roles with metric UVs/linear tints;local blue-grey glazing. Sparse original geometric dome bands abstract the pictured blue/yellow motifs. Zero embedded images,unique atlases,baked light or copied calligraphy.',
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
    'Medium-fi prayer-hall exterior only. Exact source way controls the seven-point outline. Separate courtyard ranges remain map-host context. Main dome/cupola/minaret subdivisions,roof joins,window counts,northern entrance,exact current finish and thresholds remain approximate;no navigable interiors. Retained unqualified24 m fact is used as approximate minaret-tip height,not independently confirmed. Dome bands/medallions are sparse original geometry without copied calligraphy. Physical-device timing remains unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('south-hall-pointed-windows', [-4, 11, 29], [-3, 7, 7]),
    cam('turquoise-pointed-dome', [-3, 25, 21], [-2.5, 16, 0]),
    cam('eastern-open-minaret-balcony', [43, 24, 18], [29, 20, 3.5]),
    cam('western-brick-cupola', [-31, 14, 17], [-23, 9, 0]),
    cam('estimated-courtyard-door', [-3, 8, -23], [-2.5, 4, -7.3]),
    cam('narrow-prayer-hall-roof-plan', [0, 105, 0.1], [0, 8, 0]),
  ],
};

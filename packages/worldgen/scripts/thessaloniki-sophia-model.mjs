/** Thessaloniki Hagia Sophia: ochre west front, apses, brick drum and low metal dome. */
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
  '../../../content/worldgen/source/places/sx/sx0/n0361_hagia_sophia/',
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
  wall: '#c8a16b',
  brick: '#b9907b',
  roof: '#906d58',
  metal: '#92978a',
  stone: '#c3b8a2',
  door: '#71533a',
  glass: '#39444a',
  accent: '#373c3c',
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
const footing = (p) => Math.min(floor - 0.3, thessSophiaGround(...p) - 0.35);
export function thessSophiaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Thessaloniki footing outside retained terrain');
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
    const normal = direction ?? normalFor(p[0], p[1], p[2]);
    if (
      slot === 'brick' &&
      normal[0] < -0.85 &&
      p.every((q) => q[1] >= floor + 4.2 - 1e-5) &&
      p.every(
        (q) =>
          Math.abs(
            (q[0] - rec.westFace.a[0]) * rec.westFace.normal[0] +
              (q[2] - rec.westFace.a[1]) * rec.westFace.normal[1],
          ) < 0.22,
      )
    )
      slot = 'wall';
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
const control = (n) => rec.controls.find((b) => b.id === rec.roles[n]),
  ring = (n) => control(n).polygons[0].outline,
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
  _regular = (p, r, n = 16) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + r[0] * Math.cos((i * 2 * Math.PI) / n),
      p[1] + r[1] * Math.sin((i * 2 * Math.PI) / n),
    ]),
  bellBounds = bounds(ring('bell')),
  bell = R(...bellBounds),
  drum = ring('squareDrum'),
  crown = ring('roundDrum'),
  domeCenter = mid(crown),
  domeBounds = bounds(crown),
  domeRadius = [(domeBounds[2] - domeBounds[0]) / 2, (domeBounds[3] - domeBounds[1]) / 2],
  _bellCenter = mid(bell);
const wallLayers = rec.wallLayers.flatMap((l) =>
  l.name === 'low-body'
    ? [
        { ...l, top: 4.2 },
        { ...l, bottom: 4.2 },
      ]
    : [l],
);
export function thessSophiaFields() {
  const hs = [],
    west = rec.westFace,
    at = (t) => lerp(west.a, west.b, t);
  for (const d of rec.doors) {
    const h = hole(
      d.name,
      d.p,
      d.axis,
      d.normal,
      d.width,
      d.bottom,
      d.height,
      d.height * 0.72,
      'round',
      4,
    );
    h.kind = 'door';
    h.central = d.central;
    hs.push(h);
  }
  for (const t of [0.225, 0.355, 0.645, 0.775]) {
    const p = at(t),
      h = hole(
        `west-lower-${t}`,
        p,
        west.axis,
        west.normal,
        2.15,
        Math.max(0.5, thessSophiaGround(...p) - floor + 0.7),
        3.0,
        2.05,
        'round',
        3,
      );
    h.kind = 'glass';
    hs.push(h);
  }
  for (let i = 0; i < 10; i++) {
    const h = hole(
      `west-clerestory-${i}`,
      at(0.28 + i * 0.049),
      west.axis,
      west.normal,
      0.68,
      9,
      1.45,
      1.08,
      'round',
      3,
    );
    h.kind = 'glass';
    hs.push(h);
  }
  for (const part of rec.bodyPlans)
    for (let i = 0; i < part.outline.length; i++) {
      const f = faceFrame(part.outline, i);
      if (f.length < 4 || f.normal[0] < -0.65) continue;
      const count = Math.max(1, Math.round(f.length / 6));
      for (let j = 0; j < count; j++) {
        const p = lerp(f.a, f.b, (j + 0.5) / count);
        const outward = p.map((v, k) => v + f.normal[k] * 0.7);
        if (outward.every((v, k) => v > bellBounds[k] && v < bellBounds[k + 2])) continue;
        if (f.normal[0] > 0.65 && p[1] > -6.2 && p[1] < 4.3) continue;
        const h = hole(
          `body-${i}-${j}`,
          p,
          f.axis,
          f.normal,
          Math.min(1.9, (f.length / count) * 0.5),
          6.7,
          3.0,
          2.05,
          'round',
          3,
        );
        h.kind = 'glass';
        hs.push(h);
      }
    }
  for (const part of rec.centralApsePlans)
    for (let i = 0; i < part.outline.length; i++) {
      const f = faceFrame(part.outline, i),
        p = lerp(f.a, f.b, 0.5);
      if (f.length < 2.8 || p[0] < 17.3) continue;
      const h = hole(
        `east-apse-${i}`,
        p,
        f.axis,
        f.normal,
        Math.min(2.1, f.length * 0.58),
        Math.max(0.8, thessSophiaGround(...p) - floor + 0.7),
        4.8,
        3.7,
        'round',
        3,
      );
      h.kind = 'glass';
      hs.push(h);
    }
  for (let i = 0; i < drum.length; i++) {
    const f = faceFrame(drum, i);
    for (let j = 0; j < 3; j++) {
      const h = hole(
        `square-drum-${i}-${j}`,
        lerp(f.a, f.b, (j + 1) / 4),
        f.axis,
        f.normal,
        2.15,
        13.1,
        3.3,
        2.35,
        'round',
        3,
      );
      h.kind = 'glass';
      hs.push(h);
    }
  }
  return hs;
}
export function thessSophiaBellFields(d = 4) {
  return bell.flatMap((_, i) => {
    const f = faceFrame(bell, i),
      count = d === 0 ? 1 : 2;
    return Array.from({ length: count }, (_, j) => {
      const h = hole(
        `bell-arch-${i}-${j}`,
        lerp(f.a, f.b, count === 1 ? 0.5 : j === 0 ? 0.27 : 0.73),
        f.axis,
        f.normal,
        d === 0 ? 1.85 : 0.62,
        11.65,
        1.95,
        1.3,
        'round',
        6,
      );
      h.kind = 'open';
      return h;
    });
  });
}
function panel(face, h, d) {
  pane(face, h, d, d >= 2 ? -0.72 : 0.14, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, h.central ? 0.3 : 0.14, 'stone', 0.12);
  if (h.central)
    archBand(
      face,
      {
        ...h,
        width: h.width + 1.4,
        height: h.height + 0.65,
        spring: h.spring + 0.45,
        bottom: h.bottom - 0.1,
      },
      d,
      0.26,
      'stone',
      0.22,
    );
  if (h.kind === 'door') return;
  const p = prepareOpening(h, 0, d),
    off = -0.55 * Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    point = (u, y) => p.point(u, y, off);
  if (h.width > 1.6) {
    beam(face, point(0, h.bottom), point(0, h.bottom + h.spring), 0.11, 'accent');
    beam(
      face,
      point(-h.width * 0.42, h.bottom + h.height * 0.44),
      point(h.width * 0.42, h.bottom + h.height * 0.44),
      0.11,
      'accent',
    );
  }
}
function profile(face, p, radii, levels, d, slot = 'metal') {
  const n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : d === 3 ? 28 : 36,
    rings = levels.map(([y, f]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return [p[0] + radii[0] * Math.cos(a) * f, floor + y, p[1] + radii[1] * Math.sin(a) * f];
      }),
    );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      face(
        slot,
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        [
          rings[j - 1][i][0] + rings[j - 1][k][0] - 2 * p[0],
          0,
          rings[j - 1][i][2] + rings[j - 1][k][2] - 2 * p[1],
        ],
      );
    }
  cap(
    face,
    rings.at(-1).map((p) => [p[0], p[2]]),
    levels.at(-1)[0],
    slot,
  );
}
export function thessSophiaDomeLevels(d = 4) {
  const n = d === 0 ? 3 : d === 1 ? 5 : 9;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1),
      a = t * Math.PI * 0.5;
    return [17.35 + 2.65 * Math.sin(a), Math.max(0.045, Math.cos(a))];
  });
}
function dome(out, face, cut, d, fields) {
  if (d >= 2)
    shell(
      out,
      d,
      drum,
      11.6,
      17,
      fields.filter((h) => h.name.startsWith('square-drum')),
      'brick',
    );
  else sides(face, drum, 11.6, 17, 'brick');
  cap(cut, drum, 17, 'brick');
  band(cut, drum, 16.8, 0.22, 'brick', 1.025);
  sides(face, crown, 17, 17.35, 'brick');
  const levels = thessSophiaDomeLevels(d);
  profile(face, domeCenter, domeRadius, levels, d);
  if (d >= 2) {
    const n = d === 2 ? 16 : d === 3 ? 20 : 24;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        point = ([y, f]) => [
          domeCenter[0] + (domeRadius[0] * f + 0.025) * Math.cos(a),
          floor + y + 0.04,
          domeCenter[1] + (domeRadius[1] * f + 0.025) * Math.sin(a),
        ];
      for (let j = 1; j < levels.length; j++)
        beam(face, point(levels[j - 1]), point(levels[j]), 0.1, 'metal');
    }
  }
  const gold = [0.52, 0.36, 0.15],
    accent = (s, p, n) => face(s, p, n, gold);
  beam(
    accent,
    [domeCenter[0], floor + 19.95, domeCenter[1]],
    [domeCenter[0], floor + 21, domeCenter[1]],
    d === 0 ? 0.17 : 0.12,
    'accent',
  );
  if (d > 0)
    beam(
      accent,
      [domeCenter[0] - 0.32, floor + 20.65, domeCenter[1]],
      [domeCenter[0] + 0.32, floor + 20.65, domeCenter[1]],
      0.12,
      'accent',
    );
}
function bellTower(out, face, cut, d) {
  sides(face, bell, footing, 11.2, 'brick');
  cap(face, bell, 11.2, 'brick');
  const holes = thessSophiaBellFields(d);
  shell(out, d, bell, 11.2, 14, holes, 'brick', scaled(bell, 0.68));
  if (d > 0) {
    band(face, bell, 10.9, 0.25, 'brick', 1.04);
    band(face, bell, 13.85, 0.18, 'brick', 1.05);
  }
  hip(cut, scaled(bell, 1.15), 14, 14.75, 'roof');
}
function steps(face, d) {
  for (const door of rec.doors) {
    const n = door.normal,
      a = door.axis,
      p = door.p,
      w = door.width * 0.62,
      L = 0.95,
      N = d === 0 ? 1 : 3,
      top = door.bottom + 0.015,
      lower = thessSophiaGround(p[0] + n[0] * L, p[1] + n[1] * L) - floor,
      point = (u, v) => p.map((x, k) => x + a[k] * u + n[k] * v);
    for (let i = 0; i < N; i++) {
      const v0 = (i * L) / N,
        v1 = ((i + 1) * L) / N,
        y = top + ((lower - top) * i) / N,
        yn = top + ((lower - top) * (i + 1)) / N,
        r = [point(-w, v0), point(w, v0), point(w, v1), point(-w, v1)];
      face(
        'stone',
        r.map((p, k) => at(p, d === 0 && k > 1 ? yn : y)),
        [0, 1, 0],
      );
      if (d > 0)
        face('stone', [at(r[2], yn), at(r[3], yn), at(r[3], y), at(r[2], y)], [n[0], 0, n[1]]);
    }
  }
}
function build(out, d) {
  const target = out;
  out = {
    addTriangle(slot, ref, points, normal, uv, color) {
      const p = points.map((v) => v.map(Math.fround));
      if (d >= 2) {
        const lengths = p.map((a, i) => Math.hypot(...a.map((v, k) => v - p[(i + 1) % 3][k])));
        const longest = Math.max(...lengths);
        if (longest > 16) {
          const i = lengths.indexOf(longest),
            j = (i + 1) % 3,
            k = (i + 2) % 3;
          const m = lerp(p[i], p[j], 0.5),
            um = lerp(uv[i], uv[j], 0.5);
          out.addTriangle(slot, ref, [p[i], m, p[k]], normal, [uv[i], um, uv[k]], color);
          out.addTriangle(slot, ref, [m, p[j], p[k]], normal, [um, uv[j], uv[k]], color);
          return;
        }
      }
      const area = cross(
        p[1].map((v, k) => v - p[0][k]),
        p[2].map((v, k) => v - p[0][k]),
      );
      if (Math.hypot(...area) < 1e-10) return;
      target.addTriangle(slot, ref, p, normal, uv, color);
    },
  };
  const fields = thessSophiaFields(),
    make = (base) => (slot, p, n, col) => {
      const max = d === 0 ? 24 : d === 1 ? 20 : 16;
      function split(t) {
        const lens = t.map((a, i) => Math.hypot(...a.map((v, k) => v - t[(i + 1) % 3][k]))),
          m = Math.max(...lens),
          i = lens.indexOf(m);
        if (m <= max) {
          base(slot, t, n, col);
          return;
        }
        const j = (i + 1) % 3,
          k = (i + 2) % 3,
          a = lerp(t[i], t[j], 0.5);
        split([t[i], a, t[k]]);
        split([a, t[j], t[k]]);
      }
      for (let i = 1; i < p.length - 1; i++) split([p[0], p[i], p[i + 1]]);
    },
    face = make(writer(out, d)),
    cut =
      d >= 2
        ? make(
            writer(
              masked(
                out,
                fields.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
              ),
              d,
            ),
          )
        : face;
  for (const part of rec.main.polygons) {
    sides(
      cut,
      d === 0 ? coarse(part.outline) : part.outline,
      footing,
      (p) => thessSophiaGround(...p) + 0.16,
      'stone',
    );
  }
  for (const layer of wallLayers)
    for (const part of layer.polygons) {
      const r = d === 0 ? coarse(part.outline) : part.outline,
        bottom = layer.bottom ?? ((q) => thessSophiaGround(...q) + 0.16);
      if (d >= 2) shell(out, d, r, bottom, layer.top, fields, 'brick');
      else sides(face, r, bottom, layer.top, 'brick');
      cap(cut, r, layer.top, 'brick', part.holes);
    }
  for (const part of rec.bodyPlans) {
    hip(cut, part.outline, 11, 12.1, 'roof');
    band(cut, part.outline, 10.75, 0.25, 'brick', 1.015);
  }
  for (const part of rec.centralApsePlans) {
    hip(cut, part.outline, 8.8, 11.2, 'roof');
    band(cut, part.outline, 8.55, 0.25, 'brick', 1.015);
  }
  for (const part of rec.sideApsePlans) {
    hip(cut, d === 0 ? coarse(part.outline) : part.outline, 5.7, 7, 'roof');
    band(cut, part.outline, 5.5, 0.2, 'brick', 1.015);
  }
  dome(out, face, cut, d, fields);
  bellTower(out, face, cut, d);
  if (d >= 1) for (const h of fields) panel(face, h, d);
  steps(face, d);
}
export const buildThessSophiaSkyline = (o) => build(o, 0),
  buildThessSophiaDistrict = (o) => build(o, 1),
  buildThessSophiaStreet = (o) => build(o, 2),
  buildThessSophiaCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const thessSophiaStudy = {
  id: 'N0361',
  key: 'hagia_sophia',
  title: 'Hagia Sophia',
  category: 'cathedral',
  wikidataId: 'Q1568660',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way27715355 and six current unscaled map controls. Western three-door facade, northwest bell and eastern apses sign the frame.',
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
    'Six existing shared256-square lime plaster, running-bond brick, flat tile, standing-seam metal, limestone and plain wood graphs. Ochre front, warm masonry, red tile and gray-green metal use linear tints/metric UVs. Dark glass/grille and gold accents are flat PBR vertex colors. Zero embedded images, bespoke facade textures or baked weathering/shadows.',
  importReason:
    'Four authored browser levels retain the broad dome/drum, small northwest bell, eastern apses and individual ochre west facade at the signed mapped location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from two clear west/east photographs plus an older street context and standard viewer PMTiles/DEM. Exact carved portal reliefs/icons, inscriptions, door/grille finework, separate unmapped courtyard gateway/retaining wall/fence, surrounding town/landscaping, full interiors and certified walking excluded. Physical laptop/phone timings pending.',
    'Skyline retains the low dome/cross, square drum, small open bell, three eastern apses and roof tiers. District adds shared textures, flat glazing/doors and paired open bell arches. Street adds recessed windows/entries, portal arch bands, sparse mullions/grilles and dome ribs. Closeup/master refine arch/dome facets and ribs. Foundations and local entry steps approximate coarse standard terrain; synthetic context neighbors are not mapped Thessaloniki buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-three-door-ochre-facade', [-63, 12, 1], [-23, 5, 0]),
    cam('square-drum-and-low-ribbed-dome', [-13, 31, 33], [2, 15, 0]),
    cam('east-central-and-side-apses', [56, 17, 12], [16, 7, 0]),
    cam('northwest-open-bell-tower', [-38, 19, -34], [-21, 12, -18]),
    cam('tiered-red-roofs', [0, 61, 21], [0, 7, 0]),
    cam('south-masonry-elevation', [0, 13, 52], [0, 7, 12]),
  ],
};

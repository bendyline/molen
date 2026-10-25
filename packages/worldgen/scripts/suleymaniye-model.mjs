/** Süleymaniye: opposed semi-domes, four minarets and a domed pointed court. */
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
  '../../../content/worldgen/source/places/sx/sxk/suleymaniye_mosque/',
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
  wall: '#c6bdad',
  trim: '#e2d9c8',
  roof: '#899095',
  door: '#987351',
  gold: '#bca56b',
  glass: '#566b7d',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, suleymaniyeGround(...p) - 0.35);
export function suleymaniyeGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Süleymaniye Mosque footing outside retained terrain');
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
const plans = rec.plans;
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    });
const edges = (ring) =>
  ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(ring), -axis[0] * sign(ring)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
const hole = (
  name,
  center,
  axis,
  normal,
  width,
  bottom,
  height,
  spring,
  shape = 'pointed',
  depth = 2,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
const capDome = (face, p, r, base, height, d, small = false) => {
  const n = small ? [4, 6, 10, 14, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + height * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
};
function finial(face, p, y, d) {
  if (d === 0) {
    sides(face, rect(p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08), y, y + 1.5, 'gold');
    return;
  }
  beam(face, at(p, y), at(p, y + 1.5), d === 0 ? 0.16 : 0.12, 'gold');
  if (d >= 3)
    profile(
      face,
      circle(p, 0.24, 6),
      [
        [y + 0.2, 0.65],
        [y + 0.6, 1],
        [y + 1.0, 0.5],
      ],
      'gold',
    );
}
const trimBand = (face, h, d, w = 0.26) => archBand(face, h, d, w, 'trim', 0.055);
function stripedArch(face, h, d, w = 0.35) {
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
    p = prepareOpening(h, 0, d),
    ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    face(
      'trim',
      [
        p.point(...outer[i], 0.06 * ns),
        p.point(...outer[j], 0.06 * ns),
        p.point(...inner[j], 0.06 * ns),
        p.point(...inner[i], 0.06 * ns),
      ],
      [h.normal[0], 0, h.normal[1]],
      i > 1 && i % 2 ? [0.37, 0.28, 0.23] : colors.trim,
    );
  }
}
export function suleymaniyeHallFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const z of [-25.1, 25.2]) {
    const normal = [0, Math.sign(z)],
      axis = [1, 0];
    for (const x of [7.5, 28.3, 49.0])
      for (const u of d === 1 ? [0] : [-3.2, 0, 3.2])
        out.push(hole(`side-upper-${z}-${x}-${u}`, [x + u, z], axis, normal, 2.4, 16.1, 7.7, 4.7));
  }
  for (const x of [-2.65, 57.12]) {
    const normal = [x < 0 ? -1 : 1, 0],
      axis = [0, 1];
    for (const z of [-18, -9, 2, 11, 20]) {
      out.push(hole(`end-upper-${x}-${z}`, [x, z], axis, normal, 2.7, 16.1, 6.0, 3.7));
      if (d >= 2 && z !== 2)
        out.push(hole(`end-lower-${x}-${z}`, [x, z], axis, normal, 2.1, 2.2, 3.3, 3.3, 'rect'));
    }
    out.push({
      ...hole(`hall-door-${x}`, [x, 2], axis, normal, x < 0 ? 4.1 : 3.0, 0.15, 6.2, 4.0),
      kind: 'door',
    });
  }
  const p = plans.dome.center;
  for (const z of [p[1] - 14.5, p[1] + 14.5]) {
    const normal = [0, Math.sign(z - p[1])],
      axis = [1, 0],
      n = d === 1 ? 3 : 7;
    for (let i = 0; i < n; i++)
      out.push(
        hole(
          `high-tympanum-${z}-${i}`,
          [p[0] + (i - (n - 1) / 2) * (d === 1 ? 5 : 2.6), z],
          axis,
          normal,
          d === 1 ? 1.5 : 1.3,
          29.4,
          5.3 - Math.abs(i - (n - 1) / 2) * 0.36,
          3.0,
        ),
      );
  }
  return out;
}
export function suleymaniyeDrumFields(d = 3) {
  if (d < 2) return [];
  const out = [],
    r = circle(plans.dome.center, 14.45, [8, 12, 20, 28, 32][d]);
  for (const [i, e] of edges(r).entries()) {
    if (i % 2) continue;
    out.push(
      hole(
        `drum-${i}`,
        lerp(e.a, e.b, 0.5),
        e.axis,
        e.normal,
        1.1,
        38.85,
        1.85,
        1.0,
        'pointed',
        1.6,
      ),
    );
  }
  return out;
}
export function suleymaniyeCourtArches(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [i, e] of edges(plans.court).entries()) {
    const n = Math.round(e.length / (d === 1 ? 10 : 6.4));
    for (let j = 0; j < n; j++)
      out.push(
        hole(
          `court-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal.map((v) => -v),
          e.length / n - 0.8,
          0.05,
          7.0,
          4.3,
          'pointed',
          1.7,
        ),
      );
  }
  return out;
}
export function suleymaniyeSideArches(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const z of [-32.35, 32.35]) {
    const normal = [0, Math.sign(z)],
      axis = [1, 0],
      n = d === 1 ? 6 : 12;
    for (let i = 0; i < n; i++) {
      const x = 4 + ((i + 0.5) * 47) / n;
      out.push(
        hole(
          `side-lower-${z}-${i}`,
          [x, z],
          axis,
          normal,
          47 / n - 0.65,
          0.06,
          6.7,
          4.8,
          'round',
          1.6,
        ),
      );
      out.push(
        hole(
          `side-gallery-upper-${z}-${i}`,
          [x, z],
          axis,
          normal,
          47 / n - 0.7,
          8.25,
          3.9,
          2.7,
          'round',
          1.6,
        ),
      );
    }
  }
  return out;
}
export function suleymaniyeFountainFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [i, e] of edges(plans.fountain.outline).entries()) {
    const n = e.length > 5 ? 3 : 1;
    for (let j = 0; j < n; j++)
      out.push(
        hole(
          `fountain-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal,
          e.length / n - 0.5,
          0.6,
          2.3,
          1.3,
          'round',
          1.4,
        ),
      );
  }
  return out;
}
export function suleymaniyeCourtBackFields(d = 3) {
  if (d < 2) return [];
  const out = [];
  for (const [i, e] of edges(scaled(plans.courtOuter, 0.98)).entries()) {
    if (i === 1) continue;
    const count = Math.round(e.length / 10);
    for (let j = 0; j < count; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / count),
        normal = e.normal.map((v) => -v);
      out.push({
        ...hole(`court-back-door-${i}-${j}`, p, e.axis, normal, 1.5, 0.15, 2.6, 2.6, 'rect'),
        kind: 'door',
      });
      out.push(hole(`court-back-light-${i}-${j}`, p, e.axis, normal, 1.3, 4.3, 2.0, 1.2));
    }
  }
  return out;
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(face, h, d, -0.24, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) trimBand(face, h, d === 2 ? 1 : d);
  }
}
function hall(out, face, d) {
  const fields = suleymaniyeHallFields(d),
    p = plans.dome.center;
  shell(
    out,
    d,
    plans.hall,
    footing,
    26,
    fields.filter((h) => !h.name.startsWith('high-')),
    'wall',
  );
  cap(face, plans.hall, 26, 'roof');
  const core = rect(p[0] - 13.9, p[1] - 14.5, p[0] + 13.9, p[1] + 14.5);
  shell(
    out,
    d,
    core,
    26,
    38.5,
    fields.filter((h) => h.name.startsWith('high-')),
    'wall',
  );
  cap(face, core, 38.5, 'roof');
  finish(face, fields, d);
  if (d >= 1) {
    for (const z of [-25.1, 25.2])
      for (const x of [7.5, 28.3, 49]) {
        const h = hole(
          `side-monumental-${z}-${x}`,
          [x, z],
          [1, 0],
          [0, Math.sign(z)],
          11.5,
          14.3,
          10.3,
          6.2,
        );
        trimBand(face, h, d === 2 ? 1 : d, 0.45);
      }
    for (const x of [13.8, 42.8])
      for (const side of [-1, 1]) {
        const r = rect(
          x - 1.25,
          side < 0 ? -28 : p[1] + 14.5,
          x + 1.25,
          side < 0 ? p[1] - 14.5 : 28,
        );
        solid(face, r, footing, 35.5, 'trim');
      }
    for (const x of [-1.0, 55.5])
      for (const side of [-1, 1]) {
        const z = side * 27,
          r = rect(x - 1.8, z - 3.0, x + 1.8, z + 3.0);
        solid(face, r, footing, 27.0, 'wall');
        const top = rect(x - 1.4, z - 1.5, x + 1.4, z + 1.5);
        solid(face, top, 27, 29, 'trim');
        capDome(face, [x, z], 1.6, 29, 1.4, d, true);
      }
  }
  if (d >= 2) {
    band(face, plans.hall, 25.4, 0.6, 'trim', 1.002);
    for (const x of [-1.0, 55.5])
      for (const side of [-1, 1]) {
        const p = [x, side * 27],
          n = [x < 0 ? -1 : 1, 0],
          h = hole(
            `corner-turret-${x}-${side}`,
            [p[0] + n[0] * 1.4, p[1]],
            [0, 1],
            n,
            0.7,
            27.4,
            1.1,
            0.7,
          );
        pane(face, h, d, 0.045, 'glass');
      }
  }
}
function domes(out, face, d) {
  const p = plans.dome.center,
    fields = suleymaniyeDrumFields(d),
    ring = circle(p, 14.45, [8, 12, 20, 28, 32][d]);
  for (const q of plans.semidomes) {
    const r = circle(q.center, q.radius, [6, 8, 14, 20, 24][d]);
    solid(face, r, 24.5, 26, 'wall');
    capDome(face, q.center, q.radius, 26, q.height, d, true);
  }
  shell(out, d, ring, 38.5, 41, fields, 'wall');
  finish(face, fields, d);
  capDome(face, p, 14.45, 41, 10.5, d);
  finial(face, p, 51.5, d);
  for (const side of [-1, 1])
    for (const [i, x] of [5.5, 17.0, 28.3, 40, 51.5].entries()) {
      const z = side * 20.2,
        r = i % 2 === 0 ? 4.9 : 3.6,
        base = 26;
      capDome(face, [x, z], r, base, i % 2 === 0 ? 4.0 : 2.8, d, true);
    }
  if (d >= 2) band(face, ring, 40.55, 0.45, 'trim', 1.01);
}
function minaret(face, p, d) {
  const n = [4, 6, 10, 16, 20][d],
    r = circle(p.center, p.radius, n),
    h = p.height,
    ys = p.balconies === 3 ? [34, 47, 59] : [26, 37],
    levels = [
      [6, 1.03],
      [8, 1],
    ];
  solid(face, p.base, footing, 6, 'wall');
  for (const y of ys) {
    if (d <= 1) levels.push([y - 1, 0.9], [y, 1.5], [y + 1, 0.85]);
    else levels.push([y - 1, 0.9], [y - 0.15, 1.5], [y + 0.8, 1.5], [y + 1, 0.85]);
  }
  levels.push([h - 11, 0.72]);
  profile(face, r, levels, 'wall');
  profile(
    face,
    r,
    [
      [h - 11, 0.86],
      [h - 1, 0.08],
      [h, 0],
    ],
    'roof',
  );
  if (d >= 2)
    for (const y of ys) {
      profile(
        face,
        r,
        [
          [y + 0.35, 1.48],
          [y + 0.85, 1.48],
        ],
        'trim',
      );
      if (d >= 3)
        for (let i = 0; i < n; i++) {
          const a = (i * Math.PI * 2) / n,
            q = [
              p.center[0] + p.radius * 1.45 * Math.cos(a),
              p.center[1] + p.radius * 1.45 * Math.sin(a),
            ];
          beam(face, at(q, y), at(q, y + 0.75), 0.13, 'trim');
        }
    }
}
function archFront(out, face, r, fields, d, top) {
  if (d >= 2) {
    shell(out, d, r, 0, top, fields, 'wall');
    cap(face, r, top, 'roof');
    for (const h of fields) stripedArch(face, h, d === 2 ? 1 : d, 0.28);
    return;
  }
  const e = edges(r)[0],
    n = fields.length || 2;
  for (let i = 0; i <= n; i++) {
    const p = lerp(e.a, e.b, i / n);
    beam(face, at(p, 0), at(p, top), 0.85, 'wall');
  }
  if (d === 0) {
    face(
      'wall',
      [at(e.a, top - 0.8), at(e.b, top - 0.8), at(e.b, top), at(e.a, top)],
      [e.normal[0], 0, e.normal[1]],
    );
    return;
  }
  for (const h of fields) {
    const p = prepareOpening(h, 0, 1),
      ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
      arc = openingShape(h, 1).slice(2),
      A = (q, o) => p.point(q[0], q[1], o * ns);
    for (let i = 0; i < arc.length - 1; i++) {
      const a = arc[i],
        b = arc[i + 1];
      for (const o of [0, -0.7])
        face(
          'wall',
          [A(a, o), A(b, o), A([b[0], floor + top], o), A([a[0], floor + top], o)],
          [h.normal[0] * (o === 0 ? 1 : -1), 0, h.normal[1] * (o === 0 ? 1 : -1)],
        );
      face('trim', [A(a, 0), A(b, 0), A(b, -0.7), A(a, -0.7)], [0, -1, 0]);
    }
  }
}
function court(out, face, d) {
  const inner = plans.court,
    outer = plans.courtOuter,
    arches = suleymaniyeCourtArches(d);
  cap(face, inner, 0.035, 'trim');
  sides(face, outer, footing, 7.8, 'wall');
  // The court sees the inside of its three perimeter walls; the hall closes the fourth side.
  const back = scaled(outer, 0.98);
  for (const [i, e] of edges(back).entries()) {
    if (i === 1) continue;
    face(
      'wall',
      [at(e.a, footing), at(e.b, footing), at(e.b, 7.8), at(e.a, 7.8)],
      [-e.normal[0], 0, -e.normal[1]],
    );
  }
  // Simplified closed fields on the perimeter back wall; these are applied panes.
  for (const h of suleymaniyeCourtBackFields(d)) {
    pane(face, h, d, 0.035, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 3) trimBand(face, h, d, 0.18);
  }
  cap(face, outer, 7.8, 'roof', [inner]);
  for (const [i, e] of edges(inner).entries()) {
    const n = e.normal,
      backA = e.a.map((v, k) => v + n[k] * 0.8),
      backB = e.b.map((v, k) => v + n[k] * 0.8),
      r = [e.a, e.b, backB, backA],
      fs = arches.filter((h) => h.name.startsWith(`court-${i}-`));
    // Orient the inexpensive far front toward the court as well as the detailed shell.
    const proxy = { ...e, normal: n.map((v) => -v) };
    if (d === 0) {
      const count = 2;
      for (let j = 0; j <= count; j++) {
        const p = lerp(e.a, e.b, j / count);
        beam(face, at(p, 0), at(p, 7.8), 0.9, 'wall');
      }
      face(
        'wall',
        [at(e.a, 7.0), at(e.b, 7.0), at(e.b, 7.8), at(e.a, 7.8)],
        [proxy.normal[0], 0, proxy.normal[1]],
      );
    } else archFront(out, face, r, fs, d, 7.8);
    const count = Math.round(e.length / 6.4);
    for (let j = 0; j < count; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / count).map((v, k) => v + n[k] * 3.25);
      capDome(face, p, 3.0, 7.8, 2.5, d === 0 ? 0 : Math.max(0, d - 1), true);
      if (d >= 3) finial(face, p, 10.3, d);
    }
  }
  // Raised northwest gate breaks the outer low silhouette.
  const z = (Math.min(...inner.map((p) => p[1])) + Math.max(...inner.map((p) => p[1]))) / 2,
    r = rect(-57.08, z - 4, -49.5, z + 4);
  solid(face, r, 7.8, 11.8, 'wall');
  capDome(face, [-53.3, z], 3.5, 11.8, 1.7, d, true);
  if (d >= 1) {
    const f = hole('northwest-gate-field', [-57.08, z], [0, 1], [-1, 0], 4.2, 0.1, 6.6, 4.3),
      top = hole('northwest-gate-upper', [-57.08, z], [0, 1], [-1, 0], 4.6, 8.7, 2.2, 2.2, 'rect');
    pane(face, f, d, 0.04, 'door');
    trimBand(face, f, d, 0.48);
    pane(face, top, d, 0.04, 'gold');
  }
}
function sideGalleries(out, face, d) {
  const arches = suleymaniyeSideArches(d);
  for (const side of [-1, 1]) {
    const z = side * 32.35,
      inside = side * 25.1,
      r = rect(4, Math.min(z, inside), 51, Math.max(z, inside)),
      front = side < 0 ? [r[0], r[1]] : [r[2], r[3]],
      fs = arches.filter((h) => h.name.includes(String(z))),
      thin = [
        front[0],
        front[1],
        front[1].map((v, k) => v + (k === 1 ? -side * 0.75 : 0)),
        front[0].map((v, k) => v + (k === 1 ? -side * 0.75 : 0)),
      ];
    cap(face, r, 0.03, 'trim');
    cap(face, r, 8.0, 'trim');
    cap(face, r, 13.0, 'roof');
    if (d === 0) {
      for (let i = 0; i <= 2; i++) {
        const x = 4 + (i * 47) / 2;
        beam(face, at([x, z], 0), at([x, z], 13), 0.8, 'wall');
      }
    } else if (d === 1) {
      for (const tier of [0, 1]) {
        const hs = fs.filter((h) =>
          tier === 0 ? h.name.startsWith('side-lower') : h.name.startsWith('side-gallery'),
        );
        const top = tier === 0 ? 8 : 13;
        for (const h of hs) {
          const p = prepareOpening(h, 0, 1),
            ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
            arc = openingShape(h, 1).slice(2),
            A = (q, o) => p.point(q[0], q[1], o * ns);
          for (let i = 0; i < arc.length - 1; i++) {
            const a = arc[i],
              b = arc[i + 1];
            face(
              'wall',
              [A(a, 0), A(b, 0), A([b[0], floor + top], 0), A([a[0], floor + top], 0)],
              [0, 0, side],
            );
          }
        }
        for (let i = 0; i <= 6; i++)
          beam(
            face,
            at([4 + (i * 47) / 6, z], tier === 0 ? 0 : 8),
            at([4 + (i * 47) / 6, z], top),
            0.65,
            'wall',
          );
      }
    } else {
      shell(out, d, thin, 0, 13, fs, 'wall');
      for (const h of fs) trimBand(face, h, d === 2 ? 1 : d, 0.18);
    }
    if (d >= 1) band(face, r, 12.7, 0.4, 'door', 1.015);
  }
}
function fountain(out, face, d) {
  const r = plans.fountain.outline,
    fields = suleymaniyeFountainFields(d);
  if (d <= 1) {
    solid(face, r, 0.1, 3.8, 'trim');
    if (d === 1) for (const h of fields) pane(face, h, d, 0.04, 'glass');
    return;
  }
  shell(out, d, r, 0.1, 3.8, fields, 'trim');
  cap(face, r, 3.8, 'trim');
  cap(face, scaled(r, 1.08), 0.12, 'trim');
  finish(face, fields, d);
  if (d >= 1) {
    band(face, r, 3.4, 0.4, 'trim', 1.08);
    for (const e of edges(r)) {
      const n = Math.round(e.length / 0.8);
      if (d >= 3)
        for (let i = 0; i < n; i++) {
          const p = lerp(e.a, e.b, (i + 0.5) / n);
          solid(face, rect(p[0] - 0.18, p[1] - 0.18, p[0] + 0.18, p[1] + 0.18), 3.8, 4.1, 'trim');
        }
    }
  }
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let longest = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const len = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (len > longest) {
              longest = len;
              k = i;
            }
          }
          if (longest > (d === 0 ? 50 : d === 1 ? 30 : 18)) {
            const j = (k + 1) % 3,
              c = (k + 2) % 3,
              m = lerp(p[k], p[j], 0.5).map(Math.fround),
              v = lerp(uv[k], uv[j], 0.5);
            emit([p[k], m, p[c]], [uv[k], v, uv[c]]);
            emit([m, p[j], p[c]], [v, uv[j], uv[c]]);
            return;
          }
          if (
            Math.hypot(
              ...cross(
                p[1].map((v, k) => v - p[0][k]),
                p[2].map((v, k) => v - p[0][k]),
              ),
            ) < 1e-7
          )
            return;
          target.addTriangle(a[0], a[1], p, a[3], uv, a[5]);
        }
        emit(p, a[4]);
      },
    },
    face = writer(out, d);
  hall(out, face, d);
  domes(out, face, d);
  court(out, face, d);
  sideGalleries(out, face, d);
  fountain(out, face, d);
  for (const m of plans.minarets) minaret(face, m, d);
}
export const buildSuleymaniyeSkyline = (o) => build(o, 0),
  buildSuleymaniyeDistrict = (o) => build(o, 1),
  buildSuleymaniyeStreet = (o) => build(o, 2),
  buildSuleymaniyeCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const suleymaniyeStudy = {
  id: 'suleymaniye_mosque',
  key: 'suleymaniye_mosque',
  title: 'Süleymaniye Mosque',
  category: 'mosque',
  wikidataId: 'Q178643',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256² limestone,raw limestone,standing-seam metal,plain wood and bronze graphs;six groups including local glazing. Standing-seam abstracts lead roofing. Linear tints,metric UVs and faceted architecture;zero embedded images,unique facade bitmaps,baked lighting or invented inscriptions.',
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
    'Individual medium-fi exterior from three actually inspected2012/2023 courtyard/exterior photographs and standard viewer PMTiles/DEM. Dominant central dome,two opposed semi-domes,four minarets with different height/balcony counts,domed pointed court arcades/raised northwest gate,rectangular grille-fronted fountain and two-tier side galleries. Fine carved muqarnas,calligraphy,leaded/glazed lattice patterns,clock/tap fixtures,interior,engineering,current finish and exact site joins excluded or unverified. Simplified side arch/roof partitions and unseen faces estimated. Main hall fields close shallow recesses;court and side galleries have open exterior voids,no prayer-hall interior/free traversal claim. Separate tombs,madrasas,outer garden/walls,Sinan mausoleum,streets and other complex/city content excluded. Synthetic context and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('northwest-court-and-four-minarets', [-143, 82, 108], [-9, 25, 0]),
    cam('open-pointed-court-arcade', [-27, 15, 13], [-51, 7, -5]),
    cam('rectangular-marble-fountain', [-39, 12, -12], [-29.3, 7, -1.3]),
    cam('northeast-side-galleries', [30, 32, -88], [28, 22, -23]),
    cam('tall-minaret-balconies', [-53, 57, -77], [-5, 49, -34.5]),
    cam('roof-and-signed-plan', [0, 265, 0.1], [0, 25, 0]),
  ],
};

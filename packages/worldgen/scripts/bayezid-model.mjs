/** Bayezid II Mosque: open arcaded court,lead dome with paired semi-domes and separated minarets. */
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
  '../../../content/worldgen/source/places/sx/sxk/bayezid_ii_mosque/',
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
  wall: '#cdc7b8',
  trim: '#e3dccb',
  red: '#a76a56',
  paving: '#aaa89d',
  roof: '#818d8e',
  gold: '#c6ad70',
  glass: '#353b36',
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
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
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
const footing = (p) => Math.min(-0.35, floor - 0.3, bayezidGround(...p) - 0.35);
export function bayezidGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Bayezid footing outside retained terrain');
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
    if (h.name.startsWith('court-') && (i === 0 || i === 1 || i === inner.length - 1)) continue;
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
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
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
  depth = 1,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    return { a, b, length, axis, normal: [axis[1] * sign(r), -axis[0] * sign(r)] };
  });
const subdivide = (r, max) =>
  r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => a.map((v, k) => v + ((b[k] - v) * j) / n));
  });
function box(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function band(face, r, y, h, slot = 'trim', scale = 1.012) {
  const outside = scaled(r, scale);
  sides(face, outside, y, y + h, slot);
  cap(face, outside, y + h, slot, [r]);
}
const outerGate = () =>
    hole(
      'outer-passage',
      plans.outerGate.center,
      [1, 0],
      [0, -1],
      4.4,
      0.35,
      8.1,
      5.5,
      'pointed',
      24,
    ),
  innerPortal = () =>
    hole(
      'inner-portal',
      plans.innerPortal.center,
      [1, 0],
      [0, -1],
      5,
      0.35,
      10.8,
      6.9,
      'pointed',
      14,
    );
export function bayezidArcades(d = 3) {
  const hs = [],
    n = d === 0 ? 1 : 4;
  for (const [i, e] of edges(plans.courtCorners).entries())
    for (let j = 0; j < n; j++) {
      const q = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n),
        rear = q[1] > -10;
      if (rear && Math.abs(q[0] - 3.5) < 5.6) continue;
      hs.push(
        hole(
          `court-${i}-${j}`,
          q,
          e.axis,
          e.normal.map((v) => -v),
          (e.length / n) * (d === 0 ? 0.78 : 0.93),
          0.35,
          7.4,
          4.65,
          'pointed',
          1.5,
        ),
      );
    }
  return hs;
}
export function bayezidFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [i, e] of edges(plans.whole.outline).entries()) {
    if (e.length < 7) continue;
    const n = Math.max(1, Math.floor(e.length / (d === 1 ? 13 : 9)));
    for (let j = 0; j < n; j++) {
      const q = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n);
      if (q[1] < -40 && Math.abs(q[0] - 3.5) < 6) continue;
      const hall = q[1] > 19;
      hs.push(hole(`lower-${i}-${j}`, q, e.axis, e.normal, 2, 1.45, 3.6, 3.6, 'rect', 0.9));
      hs.push(
        hole(
          `upper-${i}-${j}`,
          q,
          e.axis,
          e.normal,
          1.6,
          hall ? 10.7 : 6.1,
          hall ? 3.5 : 2.1,
          hall ? 2.5 : 1.35,
          'pointed',
          0.9,
        ),
      );
    }
  }
  return hs;
}
function grid(face, h, d, offset = -0.15) {
  if (d < 2) return;
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    P = (u, y) => p.point(u, y, offset * sg),
    normal = [h.normal[0], 0, h.normal[1]],
    width = 0.07,
    cols = h.shape === 'rect' ? 3 : 2,
    rows = h.shape === 'rect' ? 4 : 3;
  for (let i = 1; i < cols; i++) {
    const u = -h.width / 2 + (h.width * i) / cols;
    face(
      'trim',
      [
        P(u - width, h.bottom + 0.03),
        P(u + width, h.bottom + 0.03),
        P(u + width, h.bottom + h.spring - 0.03),
        P(u - width, h.bottom + h.spring - 0.03),
      ],
      normal,
    );
  }
  for (let i = 1; i < rows; i++) {
    const y = h.bottom + (h.spring * i) / rows;
    face(
      'trim',
      [
        P(-h.width / 2 + 0.03, y - width),
        P(h.width / 2 - 0.03, y - width),
        P(h.width / 2 - 0.03, y + width),
        P(-h.width / 2 + 0.03, y + width),
      ],
      normal,
    );
  }
}
function stripedArch(face, h, d, w = 0.32) {
  const outer = openingShape(
      {
        ...h,
        width: h.width + 2 * w,
        height: h.height + 2 * w,
        bottom: h.bottom - w,
        spring: h.spring + w,
      },
      d,
    ),
    inner = openingShape(h, d),
    p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  for (let i = 2; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    face(
      d >= 2 && i % 2 ? 'red' : 'trim',
      [
        p.point(...outer[i], 0.04 * sg),
        p.point(...outer[j], 0.04 * sg),
        p.point(...inner[j], 0.04 * sg),
        p.point(...inner[i], 0.04 * sg),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
}
function column(face, p, b, t, r, d) {
  const n = d <= 1 ? 4 : 8;
  profile(
    face,
    circle(p, r, n),
    d >= 2
      ? [
          [b, 1.4],
          [b + 0.22, 1.4],
          [b + 0.42, 1],
          [t - 0.45, 1],
          [t - 0.22, 1.5],
          [t, 1.5],
        ]
      : [
          [b, 1],
          [t, 1],
        ],
    'trim',
  );
}
function finial(face, p, b, t, d) {
  profile(
    face,
    circle(p, d === 0 ? 0.12 : 0.1, d === 0 ? 4 : 6),
    d <= 1
      ? [
          [b, 1],
          [t, 0],
        ]
      : [
          [b, 1],
          [t - 0.55, 1.6],
          [t - 0.42, 0.7],
          [t - 0.28, 1.1],
          [t, 0],
        ],
    'gold',
  );
}
function dome(face, p, r, base, rise, d, small = false, normal = null) {
  const n = small ? [4, 6, 10, 14, 16][d] : [6, 12, 20, 28, 32][d],
    steps = small ? [1, 1, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  if (!normal) {
    profile(
      face,
      circle(p, r, n),
      Array.from({ length: steps + 1 }, (_, i) => {
        const a = ((i / steps) * Math.PI) / 2;
        return [base + rise * Math.sin(a), i === steps ? 0 : Math.cos(a)];
      }),
      'roof',
    );
    return;
  }
  // The half shell sits on a curved masonry support and closes above the lower square core.
  const start = Math.atan2(normal[1], normal[0]) - Math.PI / 2,
    N = Math.max(4, n / 2),
    P = (t, a) => [
      p[0] + r * Math.cos(t) * Math.cos(a),
      floor + base + rise * Math.sin(t),
      p[1] + r * Math.cos(t) * Math.sin(a),
    ];
  for (let i = 0; i < N; i++) {
    const a = start + (i / N) * Math.PI,
      b = start + ((i + 1) / N) * Math.PI,
      A = P(0, a),
      B = P(0, b);
    face(
      'wall',
      [[A[0], floor + plans.hallTop, A[2]], [B[0], floor + plans.hallTop, B[2]], B, A],
      [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
    );
  }
  const a0 = Math.asin((plans.coreTop - base) / rise),
    tangent = [-normal[1], normal[0]];
  face(
    'wall',
    Array.from({ length: N + 1 }, (_, i) => {
      const a = a0 + (i / N) * (Math.PI - a0 * 2);
      return [
        p[0] + tangent[0] * r * Math.cos(a),
        floor + base + rise * Math.sin(a),
        p[1] + tangent[1] * r * Math.cos(a),
      ];
    }),
    [-normal[0], 0, -normal[1]],
  );
  for (let j = 0; j < steps; j++)
    for (let i = 0; i < N; i++) {
      const t = ((j / steps) * Math.PI) / 2,
        u = (((j + 1) / steps) * Math.PI) / 2,
        a = start + (i / N) * Math.PI,
        b = start + ((i + 1) / N) * Math.PI;
      face(
        'roof',
        [P(t, a), P(t, b), P(u, b), P(u, a)],
        [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
      );
    }
}
function ribbedDome(face, d) {
  const p = plans.dome;
  dome(face, p.center, p.radius, p.base, p.shellTop - p.base, d);
  finial(face, p.center, p.shellTop, p.totalHeight, d);
  if (d < 2) return;
  const ribs = d === 2 ? 12 : d === 3 ? 20 : 24,
    steps = d === 2 ? 4 : 6,
    P = (t, a) => [
      p.center[0] + (p.radius * Math.cos(t) + 0.035) * Math.cos(a),
      floor + p.base + (p.shellTop - p.base) * Math.sin(t) + 0.035,
      p.center[1] + (p.radius * Math.cos(t) + 0.035) * Math.sin(a),
    ];
  for (let i = 0; i < ribs; i++)
    for (let j = 0; j < steps; j++) {
      const a = (i * Math.PI * 2) / ribs,
        t = (j / steps) * 1.47,
        u = ((j + 1) / steps) * 1.47;
      face(
        'trim',
        [P(t, a - 0.006), P(t, a + 0.006), P(u, a + 0.006), P(u, a - 0.006)],
        [Math.cos(a), 1, Math.sin(a)],
      );
    }
}
function roofs(face, d) {
  const p = plans.dome;
  for (const s of plans.semiDomes) {
    const r = p.radius;
    dome(face, s.center, r, 22, 10, d, false, s.normal);
  }
  for (const x of [-13.3, 21])
    for (const z of [8.5, 20, 32]) {
      dome(face, [x, z], 4.9, plans.hallTop, 3.7, d, true);
      if (d >= 2) finial(face, [x, z], 20.9, 21.6, d);
    }
  for (const p of [
    [-40, 10],
    [-29, 10],
    [31.8, 7],
    [42, 7],
  ]) {
    dome(face, p, 4.7, plans.wingTop, 3.4, d, true);
    if (d >= 1) finial(face, p, 14, 14.7, d);
  }
  for (const e of edges(plans.courtCorners))
    for (let j = 0; j < (d === 0 ? 1 : 4); j++) {
      const q = e.a.map(
        (v, k) => v + ((e.b[k] - v) * (j + 0.5)) / (d === 0 ? 1 : 4) + e.normal[k] * 3.65,
      );
      if (q[1] > -10 && Math.abs(q[0] - 3.5) < 6) continue;
      dome(face, q, 3.1, plans.galleryTop, 2.7, d, true);
      if (d >= 2) finial(face, q, 11.7, 12.3, d);
    }
  if (d >= 1)
    for (const q of plans.core) {
      const r = circle(q, 1.02, d === 1 ? 6 : 8);
      profile(
        face,
        r,
        [
          [plans.hallTop, 1],
          [35, 1],
        ],
        'wall',
      );
      dome(face, q, 1.12, 35, 1, d, true);
      finial(face, q, 36, 36.7, d);
    }
}
function tower(face, p, d) {
  box(face, p.outline, footing, p.baseTop, 'wall');
  const n = d === 0 ? 4 : d === 1 ? 8 : 12,
    r = circle(p.center, p.radius, n);
  profile(
    face,
    r,
    [
      [p.baseTop, 1.05],
      [p.baseTop + 1, 0.85],
      [p.shaftTop, 0.85],
      [p.shaftTop + 0.4, 1.4],
    ],
    'wall',
  );
  const outer = circle(p.center, p.radius * 1.4, n),
    inner = circle(p.center, p.radius * 0.65, n),
    y = p.shaftTop + 0.4;
  cap(face, outer, y, 'trim', [inner]);
  sides(face, inner, y, p.lanternTop, 'wall');
  cap(face, inner, p.lanternTop, 'wall');
  if (d === 0) {
    sides(face, outer, p.balconyTop - 0.45, p.balconyTop, 'trim');
  } else {
    for (const q of outer) column(face, q, y, p.balconyTop, 0.055, d);
    sides(face, outer, p.balconyTop - 0.14, p.balconyTop, 'trim');
    const inset = scaled(outer, 0.96);
    sides(face, inset, p.balconyTop - 0.14, p.balconyTop, 'trim', true);
    cap(face, outer, p.balconyTop, 'trim', [inset]);
    underside(face, outer, y - 0.04, 'trim', [inner]);
  }
  profile(
    face,
    circle(p.center, p.radius * 0.76, n),
    [
      [p.lanternTop, 1],
      [p.coneTop, 0],
    ],
    'roof',
  );
  finial(face, p.center, p.coneTop, p.totalHeight, d);
  if (d >= 2) {
    for (const e of edges(inner)) {
      const q = e.a.map((v, k) => (v + e.b[k]) / 2 + e.normal[k] * 0.025),
        h = hole('tower-slit', q, e.axis, e.normal, 0.25, 42, 2.2, 1.9, 'pointed', 0.2);
      pane(face, h, d, 0);
    }
  }
}
function fountain(face, d) {
  const p = plans.fountain;
  box(face, p.outline, 0.3, 1.45, 'trim');
  const n = d === 0 ? 4 : 8,
    r = circle(p.center, p.radius * 0.77, n);
  sides(face, r, 1.45, 4.6, 'glass');
  if (d >= 1)
    for (const q of circle(p.center, p.radius * 0.96, n)) column(face, q, 0.35, 4.65, 0.25, d);
  const roof = circle(p.center, p.radius * 1.18, n);
  profile(
    face,
    roof,
    [
      [4.65, 1],
      [p.roofBase, 1],
    ],
    'trim',
  );
  if (d >= 1) underside(face, roof, 4.65, 'trim', [r]);
  dome(face, p.center, p.radius * 1.16, p.roofBase, p.shellTop - p.roofBase, d, true);
  finial(face, p.center, p.shellTop, p.totalHeight, d);
}
function core(out, d) {
  const face = writer(out, d),
    p = plans.dome,
    n = d <= 1 ? 8 : 16,
    r = circle(p.center, p.radius, n),
    fields = [];
  box(face, plans.core, plans.hallTop, plans.coreTop, 'wall');
  if (d > 0)
    for (const [i, e] of edges(r).entries()) {
      if (d === 1 && i % 2) continue;
      const q = e.a.map((v, k) => (v + e.b[k]) / 2);
      fields.push(
        hole(`drum-${i}`, q, e.axis, e.normal, d === 1 ? 1.5 : 1.15, 29.1, 4, 2.8, 'pointed', 0.8),
      );
    }
  shell(out, d, r, plans.coreTop, p.base, d >= 2 ? fields : [], 'wall');
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.05 : -0.15);
    stripedArch(face, h, d, 0.13);
    grid(face, h, d);
  }
  ribbedDome(face, d);
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
    face = writer(out, d),
    r = plans.whole.outline,
    inner = plans.court,
    arcades = bayezidArcades(d),
    fields = bayezidFields(d),
    gate = outerGate(),
    portal = innerPortal(),
    holes = [...arcades, gate, portal, ...(d >= 2 ? fields : [])],
    mask = writer(
      masked(
        out,
        holes.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    bottom =
      d === 0 ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...r.map(footing)) : footing;
  sides(face, d === 0 ? r : subdivide(r, 3), bottom, 0.35, 'paving');
  sides(face, inner, bottom, 0.3, 'paving', true);
  cap(face, r, 0.3, 'paving');
  shell(out, d, r, 0.35, plans.galleryTop, holes, 'wall', inner);
  cap(mask, r, plans.galleryTop, 'wall', [inner]);
  if (d >= 1) underside(mask, r, plans.galleryTop - 0.04, 'wall', [inner]);
  for (const p of plans.hall) {
    shell(out, d, p.outline, plans.galleryTop, plans.hallTop, d >= 2 ? fields : [], 'wall');
    cap(face, p.outline, plans.hallTop, 'wall');
  }
  for (const p of plans.wings) {
    shell(out, d, p.outline, plans.galleryTop, plans.wingTop, d >= 2 ? fields : [], 'wall');
    cap(face, p.outline, plans.wingTop, 'wall');
  }
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.05 : -0.15);
    if (h.name.startsWith('upper')) stripedArch(face, h, d, 0.25);
    else archBand(face, h, d, 0.16, 'trim', 0.04);
    grid(face, h, d);
  }
  if (d >= 1) for (const h of arcades) stripedArch(face, h, d, 0.25);
  if (d >= 1) {
    const seen = new Set();
    for (const e of edges(plans.courtCorners))
      for (let j = 0; j <= 4; j++) {
        const q = e.a.map((v, k) => v + ((e.b[k] - v) * j) / 4),
          key = q.map((v) => v.toFixed(2)).join(',');
        if (seen.has(key) || (q[1] > -10 && Math.abs(q[0] - 3.5) < 6)) continue;
        seen.add(key);
        column(face, q, 0.35, 4.98, 0.29, d);
      }
  }
  for (const [p, h] of [
    [plans.outerGate, gate],
    [plans.innerPortal, portal],
  ]) {
    shell(out, d, p.outline, 0.35, p.top, [h], 'wall');
    cap(face, p.outline, p.top, 'wall');
    stripedArch(face, h, d, 0.5);
    if (d >= 1) band(face, p.outline, p.top - 0.4, 0.45, 'trim');
  }
  pane(face, portal, d, -6.3);
  core(out, d);
  roofs(face, d);
  for (const p of plans.towers) tower(face, p, d);
  fountain(face, d);
  if (d >= 1)
    for (const e of edges(r)) {
      const a = e.a.map((v, k) => v + e.normal[k] * 0.025),
        b = e.b.map((v, k) => v + e.normal[k] * 0.025);
      face(
        'trim',
        [at(a, 8.65), at(b, 8.65), at(b, 8.95), at(a, 8.95)],
        [e.normal[0], 0, e.normal[1]],
      );
    }
}
export const buildBayezidSkyline = (o) => build(o, 0),
  buildBayezidDistrict = (o) => build(o, 1),
  buildBayezidStreet = (o) => build(o, 2),
  buildBayezidCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const bayezidStudy = {
  id: 'bayezid_ii_mosque',
  key: 'bayezid_ii_mosque',
  title: 'Bayezid II Mosque',
  category: 'mosque',
  wikidataId: 'Q853064',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Six existing shared256² raw/coursed/weathered limestone,brick,standing-seam metal and bronze graphs;seven merged roles include local opaque glazing. Metric UVs and linear tints,no embedded images or unique atlas. Coarse grids,bands,ribs and capitals are original abstractions;no historic artwork or inscriptions are copied.',
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
    'Two pictures guide exterior vocabulary. Complete current condition,fine ornament,interior layout,precise levels,steps,thresholds,engineering and physical-device/full-city performance remain unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('court-arcades-and-fountain', [3, 7, -31], [3, 19, 12]),
    cam('eastern-stone-window-fields', [75, 14, -30], [25, 7, -17]),
    cam('main-lead-dome-and-semi-domes', [55, 48, 64], [4, 31, 20]),
    cam('western-minaret-balcony', [-57, 43, -20], [-37, 39, 0.5]),
    cam('northwestern-open-gate', [3, 9, -62], [3, 5, -34]),
    cam('retained-court-and-wing-plan', [0, 230, 0.1], [0, 0, 0]),
  ],
};

/** Putra Mosque: component-aware podium,hall,pink dome group,arcades and separate tiered minaret. */
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
  '../../../content/worldgen/source/places/w2/w28/n0478_putra_mosque/',
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
  wall: '#dfc7bf',
  trim: '#e4d7c5',
  roof: '#e5a9bf',
  paving: '#d3c9bc',
  screen: '#dfd3bf',
  gold: '#c9ac6b',
  glass: '#71817d',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, putraGround(...p) - 0.35);
export function putraGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Putra footing outside retained terrain');
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
function _underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function band(face, r, y, h, slot = 'trim', f = 1.015) {
  const outer = scaled(r, f);
  sides(face, outer, y, y + h, slot);
  cap(face, outer, y + h, slot, [r]);
  _underside(face, outer, y, slot, [r]);
}
function _column(face, p, b, t, r, d, slot = 'trim') {
  const ring = circle(p, r, d <= 1 ? 4 : d === 2 ? 8 : 12);
  sides(face, ring, b, t, slot);
  cap(face, ring, t, slot);
  if (d >= 3 && t - b > 2) {
    profile(
      face,
      ring,
      [
        [b, 1.5],
        [b + 0.25, 1.5],
        [b + 0.45, 1],
      ],
      slot,
    );
    profile(
      face,
      ring,
      [
        [t - 0.5, 1],
        [t - 0.25, 1.65],
        [t, 1.65],
      ],
      slot,
    );
  }
}

const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
const subdivide = (r, max) =>
  r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => a.map((v, k) => v + ((b[k] - v) * j) / n));
  });
export function putraArcades(d = 3) {
  const r = plans.whole.outline,
    box = rect(
      Math.min(...r.map((p) => p[0])),
      Math.min(...r.map((p) => p[1])),
      Math.max(...r.map((p) => p[0])),
      Math.max(...r.map((p) => p[1])),
    ),
    hs = [];
  for (const [i, e] of edges(box).entries()) {
    const n = d <= 1 ? 3 : 7,
      span = e.length - 13,
      step = span / n;
    for (let j = 0; j < n; j++) {
      const q = e.a.map((v, k) => v + e.axis[k] * (6.5 + (j + 0.5) * step));
      hs.push(
        hole(`arcade-${i}-${j}`, q, e.axis, e.normal, step * 0.77, 0.35, 16, 10.4, 'pointed', 1.5),
      );
    }
  }
  return hs;
}
export function putraHallFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [i, e] of edges(plans.hall.outline).entries()) {
    if (e.length < 10) continue;
    const n = d === 1 ? 2 : Math.max(2, Math.floor(e.length / 12));
    for (let j = 0; j < n; j++) {
      const q = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n);
      hs.push(hole(`hall-${i}-${j}`, q, e.axis, e.normal, 6.0, 2.5, 13.5, 9.0, 'pointed', 1.0));
    }
  }
  return hs;
}
function lattice(face, h, d) {
  if (d === 0) return;
  const ring = openingShape(h, d),
    pitch = d === 1 ? 3.2 : d === 2 ? 2.3 : 1.8,
    P = (u, y) => [
      h.center[0] + h.axis[0] * u + h.normal[0] * 0.04,
      y,
      h.center[1] + h.axis[1] * u + h.normal[1] * 0.04,
    ],
    normal = [h.normal[0], 0, h.normal[1]];
  const intersections = (v, k) =>
    ring.flatMap((a, i) => {
      const b = ring[(i + 1) % ring.length],
        j = 1 - k;
      if (Math.abs(b[k] - a[k]) < 1e-8) return [];
      const t = (v - a[k]) / (b[k] - a[k]);
      return t >= 0 && t <= 1 ? [a[j] + t * (b[j] - a[j])] : [];
    });
  const bottom = floor + 6.6;
  for (let u = -h.width / 2 + pitch / 2; u < h.width / 2; u += pitch) {
    const y = Math.max(...intersections(u, 0));
    if (y <= bottom) continue;
    face(
      'screen',
      [P(u - 0.12, bottom), P(u + 0.12, bottom), P(u + 0.12, y - 0.08), P(u - 0.12, y - 0.08)],
      normal,
    );
  }
  for (let y = bottom; y < h.bottom + h.height - 0.3; y += pitch) {
    const us = intersections(y, 1);
    if (us.length < 2) continue;
    const a = Math.min(...us),
      b = Math.max(...us);
    face('screen', [P(a, y - 0.12), P(b, y - 0.12), P(b, y + 0.12), P(a, y + 0.12)], normal);
  }
}
function domePoint(p, t, a, extra = 0) {
  const r = p.radius * Math.cos(t) + extra;
  return [
    p.center[0] + r * Math.cos(a),
    floor + p.base + (p.shellTop - p.base) * Math.sin(t) + extra,
    p.center[1] + r * Math.sin(a),
  ];
}
function dome(face, p, d, small = false) {
  const n = small ? [4, 8, 12, 16, 20][d] : [8, 12, 24, 32, 40][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 9][d];
  for (let j = 0; j < steps; j++)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2,
        b = ((i + 1) / n) * Math.PI * 2,
        t = ((j / steps) * Math.PI) / 2,
        u = (((j + 1) / steps) * Math.PI) / 2;
      face(
        'roof',
        [domePoint(p, t, a), domePoint(p, t, b), domePoint(p, u, b), domePoint(p, u, a)],
        [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
      );
    }
  const patterned = (!small && d >= 2) || (small && d >= 3);
  if (!patterned) return;
  const rows = small ? 1 : d === 2 ? 2 : d === 3 ? 3 : 4,
    count = small ? 8 : d === 2 ? 12 : 16;
  for (let row = 0; row < rows; row++)
    for (let i = 0; i < count; i++) {
      const t = 0.14 + ((row + 0.5) / rows) * 0.9,
        a = ((i + (row % 2) * 0.5) / count) * Math.PI * 2,
        dt = 0.42 / rows,
        da = (Math.PI / count) * 0.8,
        v = [
          [t - dt, a],
          [t, a + da],
          [t + dt, a],
          [t, a - da],
        ],
        w = small ? 0.035 : 0.016;
      for (let k = 0; k < 4; k++) {
        const x = v[k],
          y = v[(k + 1) % 4];
        face(
          'trim',
          [
            domePoint(p, x[0], x[1] - w, 0.035),
            domePoint(p, y[0], y[1] - w, 0.035),
            domePoint(p, y[0], y[1] + w, 0.035),
            domePoint(p, x[0], x[1] + w, 0.035),
          ],
          [Math.cos(a), 1, Math.sin(a)],
        );
      }
    }
}
function finial(face, p, base, top, d) {
  if (d === 0) {
    const r = circle(p, 0.25, 4);
    for (let i = 0; i < r.length; i++)
      face(
        'gold',
        [at(r[i], base), at(r[(i + 1) % r.length], base), at(p, top)],
        [r[i][0] - p[0], 0.1, r[i][1] - p[1]],
      );
    return;
  }
  profile(
    face,
    circle(p, d === 0 ? 0.25 : 0.2, d <= 1 ? 4 : 8),
    [
      [base, 1],
      [base + (top - base) * 0.25, 1.8],
      [base + (top - base) * 0.5, 0.7],
      [top, 0],
    ],
    'gold',
  );
}
function drum(face, p, base, top, d, main = false) {
  const n = main ? [8, 8, 16, 24, 32][d] : d <= 1 ? 8 : d === 2 ? 12 : 16,
    ring = circle(p.center, p.radius, n);
  profile(
    face,
    ring,
    [
      [base, 1],
      [top, 1],
    ],
    'trim',
  );
  if (d >= 1)
    for (let i = 0; i < n; i++) {
      if (d === 1 && !main && i % 2) continue;
      const a = (-(i + 0.5) / n) * Math.PI * 2,
        normal = [Math.cos(a), Math.sin(a)],
        q = p.center.map((v, k) => v + normal[k] * p.radius * Math.cos(Math.PI / n)),
        axis = [-normal[1], normal[0]],
        height = top - base - 1,
        h = hole(
          `drum-${p.center}-${i}`,
          q,
          axis,
          normal,
          main ? 2.9 : 1.8,
          base + 0.4,
          height,
          height * 0.65,
          'pointed',
          0.5,
        );
      pane(face, h, d, 0.06);
      archBand(face, h, d, 0.22, 'wall', 0.1);
      if (d >= 2) {
        const P = (u, y, v) => [
          q[0] + axis[0] * u + normal[0] * v,
          floor + y,
          q[1] + axis[1] * u + normal[1] * v,
        ];
        face(
          'trim',
          [
            P(-h.width * 0.8, top - 0.1, 0.15),
            P(h.width * 0.8, top - 0.1, 0.15),
            P(0, top + 1.1, 1.5),
          ],
          [normal[0], 0.3, normal[1]],
        );
      }
    }
  if (d >= 1) band(face, ring, base, 0.5, 'trim', 1.025);
}
function minaret(face, d) {
  const p = plans.minaret,
    q = p.center,
    n = [5, 8, 12, 16, 20][d];
  const baseRing = p.outline;
  sides(face, d === 0 ? baseRing : subdivide(baseRing, 3), footing, 0.35, 'paving');
  cap(face, baseRing, 0.35, 'paving');
  profile(
    face,
    circle(q, p.coreRadius, n),
    d === 0
      ? [
          [0.35, 1.8],
          [35, 1.8],
          [36, 1.1],
          [60, 1.1],
          [61, 0.9],
          [80, 0.9],
          [93, 0.65],
        ]
      : [
          [0.35, 1.8],
          [34.5, 1.8],
          [35.5, 1.25],
          [59.5, 1.15],
          [60.5, 0.95],
          [79.5, 0.85],
          [80.5, 0.72],
          [93, 0.6],
        ],
    'wall',
  );
  for (const [y, r] of [
    [35, 5.1],
    [60, 4.2],
    [80, 3.4],
    [93, 2.7],
  ]) {
    const ring = circle(q, r, n);
    sides(face, ring, y - 0.35, y + 0.35, 'trim');
    cap(face, ring, y + 0.35, 'trim', [circle(q, r * 0.8, n)]);
    if (d >= 2) _underside(face, ring, y - 0.35, 'trim', [circle(q, r * 0.8, n)]);
  }
  profile(
    face,
    circle(q, 2.3, n),
    [
      [93, 1],
      [98.5, 0],
    ],
    'roof',
  );
  finial(face, q, 98.5, 100, d);
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
    hs = putraArcades(d),
    fields = putraHallFields(d);
  const base =
    d === 0 ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...r.map(footing)) : footing;
  sides(face, d === 0 ? r : subdivide(r, 3), base, 0.35, 'paving');
  cap(face, r, 0.35, 'paving');
  shell(out, d, r, 0.35, 19, hs, 'wall');
  if (d >= 1)
    sides(
      writer(
        masked(
          out,
          hs.map((h) => prepareOpening(h, 0, d)),
        ),
        d,
      ),
      r,
      0.35,
      19,
      'wall',
      true,
    );
  const holes = [
    plans.hall.outline,
    ...plans.pavilions
      .slice(0, 4)
      .map((p) => circle(p.center, p.radius * 0.98, d === 0 ? 4 : d === 1 ? 8 : 16)),
  ];
  cap(face, r, 19, 'trim', holes);
  if (d >= 1) _underside(face, r, 18.75, 'trim', holes);
  for (const h of hs) {
    if (d >= 1) archBand(face, h, d, 0.3, 'trim', 0.08);
    lattice(face, h, d);
  }
  const wall = writer(
    masked(
      out,
      hs.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  band(wall, r, 17.8, 0.8, 'trim', 1.003);
  shell(out, d, plans.hall.outline, 0.35, 25, d === 1 ? [] : fields, 'wall');
  cap(face, plans.hall.outline, 25, 'trim');
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.06 : -0.22);
    if (d >= 1) archBand(face, h, d, 0.3, 'trim', 0.08);
  }
  const hallFace = writer(
    masked(
      out,
      fields.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  for (const y of [19.3, 24.1]) band(hallFace, plans.hall.outline, y, 0.75, 'trim', 1.005);
  drum(face, plans.drum, 25, 33, d, true);
  dome(face, plans.dome, d);
  finial(face, plans.dome.center, 63, 67, d);
  for (const p of plans.pavilions) {
    drum(face, p, p.base, p.wallTop, d);
    dome(face, { ...p, base: p.wallTop }, d, true);
    finial(face, p.center, p.shellTop, p.totalHeight, d);
  }
  minaret(face, d);
}
export const buildPutraSkyline = (o) => build(o, 0),
  buildPutraDistrict = (o) => build(o, 1),
  buildPutraStreet = (o) => build(o, 2),
  buildPutraCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const putraStudy = {
  id: 'N0478',
  key: 'putra_mosque',
  title: 'Putra Mosque',
  category: 'mosque',
  wikidataId: 'Q2344561',
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
    'Six existing shared256² sandstone,raw limestone,ceramic tile,marble,painted metal and bronze graphs;seven merged roles including local opaque glazing. Metric UVs,linear tints,no embedded images or unique atlas. Coarse diamond/grid rhythm is original abstraction and does not copy historic tile/calligraphy artwork.',
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
    'Front and overview pictures guide color,roof,turret,arcade and minaret vocabulary. Fine lattice,arabesques,inscriptions,interiors,current condition,exact waterfront level,foundation engineering and physical-device/full-city performance are unverified or abstracted.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('pink-main-dome-and-pavilions', [90, 63, 95], [0, 37, 0]),
    cam('pointed-arcade-and-upper-lattice', [70, 12, 2], [43, 10, 0]),
    cam('cream-diamond-dome-rhythm', [48, 62, 47], [1, 47, -1]),
    cam('outer-domed-pavilion', [64, 32, 57], [37.5, 25, 34]),
    cam('tiered-minaret', [124, 71, 63], [79, 65, 23]),
    cam('mapped-hall-podium-and-minaret', [16, 280, 0.1], [16, 12, 0]),
  ],
};

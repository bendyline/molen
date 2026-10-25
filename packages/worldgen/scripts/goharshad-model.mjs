/** Goharshad Mosque: turquoise dome, twin tiled minarets and four courtyard iwans. */
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
  '../../../content/worldgen/source/places/tq/tq6/goharshad_mosque/',
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
  wall: '#c3ac8b',
  trim: '#dfd5bc',
  tile: '#7d9bb0',
  roof: '#c5bba7',
  paving: '#c9c9bf',
  wood: '#8c785a',
  glass: '#45606b',
  dome: '#62b7c3',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, goharshadGround(...p) - 0.35);
export function goharshadGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Imam Ali Mosque footing outside retained terrain');
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
function panel(face, h, d, width, bottom, top, slot, offset = 0) {
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
    face(
      slot,
      [point(h, ...a, front), point(h, ...b, front), point(h, ...b, back), point(h, ...a, back)],
      [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
    );
  }
}
export function goharshadPortals(d = 3) {
  return plans.portals.map((p) => ({
    ...p,
    frameWidth: p.width,
    ...field(
      p.name,
      p.center,
      p.axis,
      p.normal,
      p.openingWidth,
      0.7,
      p.openingHeight,
      p.spring,
      p.depth,
    ),
    detail: d,
  }));
}
export function goharshadCourtFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [i, e] of edges(plans.court).entries()) {
    const portal = plans.portals[i],
      u = e.length / 2,
      spans = [
        [0, u - portal.width / 2],
        [u + portal.width / 2, e.length],
      ];
    for (const [start, end] of spans) {
      const n = Math.max(1, Math.floor((end - start) / (d === 1 ? 13 : 5.5))),
        step = (end - start) / n;
      for (let j = 0; j < n; j++)
        for (const tier of d === 1 ? [0] : [0, 1]) {
          const p = lerp(e.a, e.b, (start + (j + 0.5) * step) / e.length),
            h = field(
              `gallery-${i}-${j}-${start}-${tier}`,
              p,
              e.axis,
              e.normal.map((v) => -v),
              step * 0.68,
              tier ? 7 : 0.8,
              tier ? 4.5 : 4.9,
              tier ? 2.8 : 3,
              0.7,
            );
          hs.push({ ...h, step, tier });
        }
    }
  }
  return hs;
}
function portal(face, h, d) {
  const front = 0.04,
    back = -h.depth,
    P = (u, y, v) => point(h, u, floor + y, v);
  panel(face, h, d, h.frameWidth, 0.7, h.top, 'tile', front);
  reveal(face, h, d, front, back, 'trim');
  pane(face, h, d, back, 'glass');
  for (const s of [-1, 1])
    face(
      'tile',
      [
        P((s * h.frameWidth) / 2, 0.7, front),
        P((s * h.frameWidth) / 2, 0.7, back),
        P((s * h.frameWidth) / 2, h.top, back),
        P((s * h.frameWidth) / 2, h.top, front),
      ],
      [h.axis[0] * s, 0, h.axis[1] * s],
    );
  face(
    'roof',
    [
      P(-h.frameWidth / 2, h.top, front),
      P(h.frameWidth / 2, h.top, front),
      P(h.frameWidth / 2, h.top, back),
      P(-h.frameWidth / 2, h.top, back),
    ],
    [0, 1, 0],
  );
  if (d > 0) {
    archBand(face, h, d, d === 1 ? 0.55 : 0.7, 'trim', 0.06);
    const door = {
      ...h,
      width: Math.min(4, h.width / 3),
      bottom: floor + 0.7,
      height: 5,
      spring: 3,
    };
    pane(face, door, d, back + 0.05, 'wood');
    if (d >= 2) archBand(face, door, d, 0.25, 'trim', back + 0.075);
  }
}
function gallery(face, d) {
  for (const h of goharshadCourtFields(d)) {
    panel(face, h, d, h.step, h.tier ? 6.5 : 0.7, h.tier ? 13 : 6.5, 'tile', 0.02);
    reveal(face, h, d, 0.02, -0.35, 'trim');
    pane(face, h, d, -0.35, h.tier ? 'glass' : 'wood');
    if (d >= 2) archBand(face, h, d, 0.22, 'trim', 0.05);
  }
  if (d > 0)
    for (const [i, e] of edges(plans.court).entries()) {
      const h = { center: e.a, axis: e.axis, normal: e.normal.map((v) => -v) };
      const half = plans.portals[i].width / 2;
      for (const [start, end] of [
        [0, e.length / 2 - half],
        [e.length / 2 + half, e.length],
      ])
        for (const y of [6.3, 12.5])
          face(
            'trim',
            [
              point(h, start, floor + y, 0.04),
              point(h, end, floor + y, 0.04),
              point(h, end, floor + y + 0.25, 0.04),
              point(h, start, floor + y + 0.25, 0.04),
            ],
            [h.normal[0], 0, h.normal[1]],
          );
    }
}
function dome(face, d) {
  const p = plans.domeCenter,
    r = plans.radius,
    n = [8, 12, 20, 28, 32][d],
    cyan = (slot, p, n) => face(slot, p, n, colors.dome);
  solid(face, circle(p, r * 0.88, n), 13, 22, 'tile');
  profile(
    cyan,
    circle(p, r, n),
    d === 0
      ? [
          [22, 0.9],
          [29, 1],
          [36, 0.7],
          [42, 0],
        ]
      : [
          [22, 0.9],
          [26, 1],
          [30, 0.98],
          [34, 0.78],
          [38, 0.45],
          [41, 0.15],
          [42, 0],
        ],
    'tile',
  );
  profile(
    face,
    circle(p, d === 0 ? 0.14 : 0.09, d === 0 ? 4 : 8),
    [
      [42, 1],
      [43, 0],
    ],
    'wood',
  );
  if (d > 0)
    for (let i = 0; i < (d === 1 ? 6 : 12); i++) {
      const a = (i * Math.PI * 2) / (d === 1 ? 6 : 12),
        normal = [Math.cos(a), Math.sin(a)],
        axis = [-normal[1], normal[0]],
        q = p.map((v, k) => v + normal[k] * r * 0.885),
        h = field(`drum-${i}`, q, axis, normal, 1.35, 16.3, 3.4, 2.2, 0.7);
      pane(face, h, d, 0.04, 'glass');
      if (d >= 2) archBand(face, h, d, 0.18, 'trim', 0.06);
    }
}
function minaret(face, p, d) {
  const n = [6, 8, 12, 20, 24][d],
    r = circle(p, 1.7, n),
    pale = (s, p, n) => face(s, p, n, colors.trim);
  profile(
    pale,
    r,
    d === 0
      ? [
          [0.7, 1.2],
          [31, 1],
          [32, 1.4],
          [34, 1.8],
          [34, 0.65],
          [40, 0.6],
          [42.6, 0],
        ]
      : [
          [0.7, 1.3],
          [6, 1.15],
          [31, 1],
          [31.7, 1.2],
          [32.5, 1.45],
          [33, 1.8],
          [34, 1.8],
          [34, 0.65],
          [40, 0.6],
          [40.7, 0.7],
          [42.6, 0],
        ],
    'tile',
  );
  profile(
    face,
    circle(p, d === 0 ? 0.14 : 0.09, d === 0 ? 4 : 8),
    [
      [42.6, 1],
      [43, 0],
    ],
    'wood',
  );
  if (d >= 1) {
    sides(face, circle(p, 1.73, n), 6, 6.7, 'tile');
    sides(face, circle(p, 1.73, n), 27.8, 28.5, 'tile');
  }
  if (d >= 2) {
    const ring = circle(p, 3.02, n);
    for (let i = 0; i < n; i++) {
      beam(face, at(ring[i], 34), at(ring[i], 34.8), 0.2, 'trim');
      beam(face, at(ring[i], 34.8), at(ring[(i + 1) % n], 34.8), 0.2, 'trim');
    }
  }
}
function build(out, d) {
  const face = writer(out, d),
    hs = goharshadPortals(d),
    courtFace = writer(
      masked(
        out,
        [...hs, ...goharshadCourtFields(d)].map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    r = plans.whole.outline;
  sides(face, r, footing, 0.7, 'paving');
  cap(face, r, 0.7, 'paving');
  sides(face, r, 0.7, 13, 'wall');
  sides(courtFace, plans.court, 0.7, 13, 'wall', true);
  cap(face, r, 13, 'roof', [plans.roofOpening]);
  down(face, r, 12.6, 'roof', [plans.roofOpening]);
  gallery(face, d);
  for (const h of hs) portal(face, h, d);
  dome(face, d);
  for (const p of plans.minarets) minaret(face, p, d);
}
export const buildGoharshadSkyline = (o) => build(o, 0),
  buildGoharshadDistrict = (o) => build(o, 1),
  buildGoharshadStreet = (o) => build(o, 2),
  buildGoharshadCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const goharshadStudy = {
  id: 'goharshad_mosque',
  key: 'goharshad_mosque',
  title: 'Goharshad Mosque',
  category: 'mosque',
  wikidataId: 'Q2393680',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared 256² brick, raw limestone, mosaic tile, lime plaster, marble and plain wood graphs serve seven merged roles. Cyan dome and pale tiled minarets use vertex tint on the same mosaic graph as blue facades. Metric UVs, linear colors and no embedded images or copied artwork.',
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
    'The mosque lacks an independent complete outer way in this map. Its campus is an explicit clipped portion of merged shrine polygons, with estimated range widths and envelope. Partial building replacement preserves the host remainder. The exact courtyard and dome define scale/axis; tower positions, profiles, iwan recesses, facade rhythm and component height allocations are estimates. Fine floral/diamond art, calligraphy, exact muqarnas, fixtures, crowds, fountain and furnished interiors omitted. Golden shrine dome, Quds court/pavilion and adjacent halls remain host content. No surveyed engineering, collision-certified interior or physical-device timing claim.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('maqsura-iwan-and-paired-minarets', [56, 11, 2], [9, 16, 2]),
    cam('turquoise-dome-and-tiled-drum', [-46, 43, 35], [-16, 27, 0]),
    cam('two-tier-courtyard-fields', [31, 8, 9], [33, 7, 29]),
    cam('pointed-iwan-vault', [14, 5, 2], [3, 18, 2]),
    cam('rear-brick-and-shrine-scope', [-76, 59, -70], [-1, 9, 0]),
    cam('north-up-clipped-map-control', [25, 270, 0.1], [25, 9, 0]),
  ],
};

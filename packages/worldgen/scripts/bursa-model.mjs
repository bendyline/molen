/** Bursa Grand Mosque: repeated dome grid,paired upper screens and twin double-bulb minarets. */
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
  '../../../content/worldgen/source/places/sx/sxh/bursa_grand_mosque/',
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
  wall: '#c1ac91',
  trim: '#daceb5',
  paving: '#aaa698',
  roof: '#9ca7a6',
  gold: '#c2aa71',
  glass: '#464d40',
  shaft: '#b19876',
  shoulder: '#c4b17f',
  glazed: '#7e9b9b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, bursaGround(...p) - 0.35);
export function bursaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Bursa footing outside retained terrain');
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
  rect = (x0, z0, x1, z1) => [
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
function box(face, r, b, t, slot, color) {
  sides((s, p, n) => face(s, p, n, color), r, b, t, slot);
  cap((s, p, n) => face(s, p, n, color), r, t, slot);
}
function underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
const facades = [
  {
    name: 'north',
    a: [-35.225, -30.339],
    b: [35.226, -30.339],
    axis: [1, 0],
    normal: [0, -1],
    count: 5,
  },
  {
    name: 'south',
    a: [35.225, 30.339],
    b: [-35.225, 30.339],
    axis: [-1, 0],
    normal: [0, 1],
    count: 5,
  },
  {
    name: 'east',
    a: [35.226, -30.339],
    b: [35.226, 30.339],
    axis: [0, 1],
    normal: [1, 0],
    count: 4,
  },
  {
    name: 'west',
    a: [-35.2, 30.339],
    b: [-35.2, -30.339],
    axis: [0, -1],
    normal: [-1, 0],
    count: 4,
  },
];
const gateways = () =>
  [plans.portal, plans.westPortal].map((p, i) =>
    hole(
      i ? 'west-door' : 'north-door',
      p.center,
      p.axis,
      p.normal,
      4.0,
      0.35,
      i ? 7.8 : 8.7,
      i ? 5.2 : 5.8,
      'pointed',
      10,
    ),
  );
export function bursaFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const e of facades)
    for (let j = 0; j < e.count; j++) {
      const q = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / e.count);
      if (e.name === 'north' && Math.abs(q[0]) < 6) continue;
      for (const sg of [-1, 1]) {
        const p = q.map((v, k) => v + e.axis[k] * sg * 1.65);
        hs.push(
          hole(`upper-${e.name}-${j}-${sg}`, p, e.axis, e.normal, 1.35, 7.2, 4.0, 3.3, 'round', 1),
        );
        if (d >= 2 || sg === -1)
          hs.push(
            hole(
              `lower-${e.name}-${j}-${sg}`,
              p,
              e.axis,
              e.normal,
              1.25,
              1.3,
              2.5,
              1.6,
              'pointed',
              1,
            ),
          );
      }
    }
  return hs;
}
function grids(face, h, d, offset = -0.16) {
  if (d < 2) return;
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    P = (u, y) => p.point(u, y, offset * sg),
    normal = [h.normal[0], 0, h.normal[1]],
    n = h.shape === 'round' ? 4 : 2;
  for (let j = 1; j < n; j++) {
    const y = h.bottom + (h.spring * j) / n;
    face(
      'trim',
      [
        P(-h.width / 2 + 0.04, y - 0.045),
        P(h.width / 2 - 0.04, y - 0.045),
        P(h.width / 2 - 0.04, y + 0.045),
        P(-h.width / 2 + 0.04, y + 0.045),
      ],
      normal,
    );
  }
  for (const u of h.shape === 'round' ? [-0.22, 0.22] : [0])
    face(
      'trim',
      [
        P(u - 0.04, h.bottom + 0.04),
        P(u + 0.04, h.bottom + 0.04),
        P(u + 0.04, h.bottom + h.spring - 0.04),
        P(u - 0.04, h.bottom + h.spring - 0.04),
      ],
      normal,
    );
}
function finial(face, p, b, t, d) {
  profile(
    face,
    circle(p, d === 0 ? 0.12 : 0.09, d === 0 ? 4 : 6),
    d <= 1
      ? [
          [b, 1],
          [t, 0],
        ]
      : [
          [b, 1],
          [t - 0.35, 1.6],
          [t - 0.22, 0.6],
          [t, 0],
        ],
    'gold',
  );
}
function roofDome(face, p, d) {
  const n = [6, 8, 16, 24, 28][d],
    steps = [1, 2, 3, 6, 7][d],
    slot = p.glazed ? 'glass' : 'roof',
    col = p.glazed ? colors.glazed : undefined,
    faceTint = (s, points, n) => face(s, points, n, col);
  const shoulder = rect(
    p.center[0] - 6.65,
    p.center[1] - 6.7,
    p.center[0] + 6.65,
    p.center[1] + 6.7,
  );
  box(face, shoulder, plans.wallTop, p.base, 'wall', colors.shoulder);
  profile(
    faceTint,
    circle(p.center, p.radius, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [p.base + (p.shellTop - p.base) * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    slot,
  );
  finial(face, p.center, p.shellTop, p.totalHeight, d);
  if (d >= 2) {
    const ribs = p.glazed ? 12 : d === 2 ? 8 : 12,
      segments = d === 2 ? 3 : 5,
      P = (t, a) => [
        p.center[0] + (p.radius * Math.cos(t) + 0.025) * Math.cos(a),
        floor + p.base + (p.shellTop - p.base) * Math.sin(t) + 0.025,
        p.center[1] + (p.radius * Math.cos(t) + 0.025) * Math.sin(a),
      ];
    for (let i = 0; i < ribs; i++)
      for (let j = 0; j < segments; j++) {
        const a = (i * Math.PI * 2) / ribs,
          t = (j / segments) * 1.45,
          u = ((j + 1) / segments) * 1.45;
        face(
          'trim',
          [P(t, a - 0.005), P(t, a + 0.005), P(u, a + 0.005), P(u, a - 0.005)],
          [Math.cos(a), 1, Math.sin(a)],
        );
      }
  }
  if (d >= 1)
    for (const [axis, normal, center] of [
      [
        [0, 1],
        [-1, 0],
        [p.center[0] - 6.68, p.center[1]],
      ],
      [
        [0, 1],
        [1, 0],
        [p.center[0] + 6.68, p.center[1]],
      ],
      [
        [1, 0],
        [0, -1],
        [p.center[0], p.center[1] - 6.73],
      ],
      [
        [1, 0],
        [0, 1],
        [p.center[0], p.center[1] + 6.73],
      ],
    ]) {
      if ((normal[0] && Math.abs(p.center[0]) < 27) || (normal[1] && Math.abs(p.center[1]) < 22))
        continue;
      const h = hole('shoulder-round', center, axis, normal, 1.0, 15.1, 1, 0, 'circle', 0.2);
      pane(face, h, d, 0);
      if (d >= 2) archBand(face, h, d, 0.1, 'trim', 0.02);
    }
}
function tower(face, p, d) {
  const n = d === 0 ? 4 : d === 1 ? 8 : 12,
    r = circle(p.center, p.radius, n),
    tint = (s, points, n) => face(s, points, n, s === 'wall' ? colors.shaft : undefined);
  box(face, p.outline, footing, 8, 'wall', colors.shaft);
  profile(
    tint,
    r,
    [
      [8, 1.2],
      [10, 1],
      [31.5, 1],
      [32.2, 1.15],
      [33.4, 1.6],
    ],
    'wall',
  );
  const outer = circle(p.center, p.radius * 1.6, n),
    core = circle(p.center, p.radius * 0.9, n),
    floorY = 33.4;
  cap(face, outer, floorY, 'trim', [core]);
  sides(tint, core, floorY, 41, 'wall');
  cap(tint, core, 41, 'wall');
  const rail = scaled(outer, 0.96);
  sides(face, outer, 34.85, 35, 'trim');
  sides(face, rail, 34.85, 35, 'trim', true);
  cap(face, outer, 35, 'trim', [rail]);
  if (d >= 1) {
    underside(face, outer, 33.35, 'trim', [core]);
    for (const q of outer) {
      const rr = circle(q, 0.07, 4);
      sides(face, rr, 33.4, 35, 'trim');
    }
  }
  const capRing = circle(p.center, p.radius * 0.98, n);
  profile(
    face,
    capRing,
    d <= 1
      ? [
          [41, 1],
          [41.6, 1.15],
          [42.3, 0.85],
          [43.1, 1.05],
          [44.5, 0.65],
          [45.2, 0.88],
          [46.3, 0.46],
          [47.2, 0.64],
          [48.2, 0.25],
          [49.2, 0],
        ]
      : [
          [41, 1],
          [41.45, 1.02],
          [41.65, 0.82],
          [42.2, 1.06],
          [42.95, 1.13],
          [43.6, 0.9],
          [44.25, 0.52],
          [44.8, 0.79],
          [45.4, 0.91],
          [46, 0.68],
          [46.5, 0.35],
          [47.05, 0.57],
          [47.6, 0.64],
          [48.15, 0.4],
          [48.65, 0.16],
          [49.2, 0],
        ],
    'trim',
  );
  finial(face, p.center, 49.2, 50, d);
  if (d >= 2)
    for (const e of edges(core)) {
      const q = e.a.map((v, k) => (v + e.b[k]) / 2 + e.normal[k] * 0.03);
      pane(face, hole('tower-slit', q, e.axis, e.normal, 0.22, 37, 2.3, 2.0, 'pointed', 0.2), d, 0);
    }
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
    fields = bursaFields(d),
    doors = gateways(),
    all = [...doors, ...(d >= 2 ? fields : [])],
    bottom =
      d === 0 ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...r.map(footing)) : footing;
  sides(face, d === 0 ? r : subdivide(r, 3), bottom, 0.35, 'paving');
  cap(face, r, 0.35, 'paving');
  shell(out, d, r, 0.35, plans.wallTop, all, 'wall');
  cap(face, r, plans.wallTop, 'wall');
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.055 : -0.18);
    archBand(face, h, d, h.name.startsWith('upper') ? 0.14 : 0.2, 'trim', 0.04);
    grids(face, h, d);
  }
  for (const [i, p] of [plans.portal, plans.westPortal].entries()) {
    shell(out, d, p.outline, footing, p.top, [doors[i]], 'wall');
    cap(face, p.outline, p.top, 'wall');
    cap(face, p.outline, 0.35, 'paving');
    pane(face, doors[i], d, -3.8);
    archBand(face, doors[i], d, 0.5, 'trim', 1.9);
  }
  if (d >= 1)
    for (const e of facades) {
      for (let j = 0; j < e.count; j++) {
        const q = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / e.count);
        if (e.name === 'north' && Math.abs(q[0]) < 6) continue;
        archBand(
          face,
          hole(
            `blind-${e.name}-${j}`,
            q,
            e.axis,
            e.normal,
            e.name === 'east' || e.name === 'west' ? 13 : 12.4,
            1.3,
            11.2,
            5.8,
            'pointed',
            0.1,
          ),
          d,
          0.12,
          'trim',
          0.06,
        );
      }
      for (let j = 0; j <= e.count; j++) {
        const p = e.a.map((v, k) => v + ((e.b[k] - v) * j) / e.count + e.normal[k] * 0.3);
        box(face, rect(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25), 12.7, 14.15, 'trim');
      }
    }
  if (d >= 1)
    for (const e of edges(r)) {
      const a = e.a.map((v, k) => v + e.normal[k] * 0.03),
        b = e.b.map((v, k) => v + e.normal[k] * 0.03);
      face(
        'trim',
        [at(a, 13.9), at(b, 13.9), at(b, 14.35), at(a, 14.35)],
        [e.normal[0], 0, e.normal[1]],
      );
    }
  for (const p of plans.domes) roofDome(face, p, d);
  for (const p of plans.towers) tower(face, p, d);
}
export const buildBursaSkyline = (o) => build(o, 0),
  buildBursaDistrict = (o) => build(o, 1),
  buildBursaStreet = (o) => build(o, 2),
  buildBursaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const bursaStudy = {
  id: 'bursa_grand_mosque',
  key: 'bursa_grand_mosque',
  title: 'Bursa Grand Mosque',
  category: 'mosque',
  wikidataId: 'Q32339',
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
    'Five existing shared256² raw/coursed/weathered limestone,standing-seam metal and bronze graphs;six merged roles include local opaque glazing. Metric UVs and linear tints,no embedded images or unique atlas. Original coarse bands,brackets,grids and ribs;no historic artwork or inscriptions are copied.',
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
    'Two useful exterior pictures guide the reconstruction. Exact signed facing,tower association/opposite tower location,roof grid and glazed-bay position,complete current condition,interiors,finish,engineering and physical-device/full-city performance remain unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('twenty-domes-and-glazed-bay', [55, 60, -60], [0, 16, 0]),
    cam('paired-round-screens-and-blind-arches', [62, 13, 26], [35, 7, 10]),
    cam('north-pointed-portal', [0, 9, -61], [0, 6, -29]),
    cam('west-portal-and-brackets', [-62, 12, 13], [-35, 7, 0]),
    cam('open-balcony-and-double-bulb-cap', [-59, 44, -45], [-38, 40, -26]),
    cam('retained-hall-and-contact-pads', [0, 195, 0.1], [0, 0, 0]),
  ],
};

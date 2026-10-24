/** Ibrahim-al-Ibrahim Mosque: stepped white complex,ribbed green-accent dome and faceted gallery minaret. */
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
  '../../../content/worldgen/source/places/ey/eyk/ibrahim_al_ibrahim_mosque/',
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
  wall: '#edece3',
  trim: '#f3f1e5',
  roof: '#e7ede3',
  tile: '#88a99b',
  paving: '#c2c3b8',
  glass: '#586c68',
  gold: '#ad9870',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, ibrahimGround(...p) - 0.35);
export function ibrahimGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Ibrahim footing outside retained terrain');
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
function underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function box(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
const subdivide = (r, max) =>
  r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => a.map((v, k) => v + ((b[k] - v) * j) / n));
  });
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = [(b[0] - a[0]) / n, (b[1] - a[1]) / n];
    return { a, b, axis, normal: [axis[1] * sign(r), -axis[0] * sign(r)], length: n };
  });
export function ibrahimFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [k, r] of [
    ['low', plans.whole.outline],
    ['hall', plans.hall.outline],
  ])
    for (const [i, e] of edges(r).entries()) {
      if (e.length < 5) continue;
      const n =
        k === 'hall' ? (d === 1 ? 2 : 3) : Math.max(1, Math.floor(e.length / (d === 1 ? 10 : 7)));
      for (let j = 0; j < n; j++) {
        const q = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n),
          door = k === 'low' && e.normal[1] > 0.9 && q[0] < 7 && j === Math.floor(n / 2);
        hs.push(
          hole(
            `${k}-${i}-${j}`,
            q,
            e.axis,
            e.normal,
            k === 'hall' ? 2.25 : door ? 1.4 : 1.15,
            k === 'hall' ? 5.5 : door ? 0.35 : 1.35,
            k === 'hall' ? 6.1 : door ? 3.1 : 1.8,
            k === 'hall' ? 4.05 : door ? 3.1 : 1.8,
            k === 'hall' ? 'pointed' : 'rect',
            0.9,
          ),
        );
      }
    }
  return hs;
}
function panelGrid(face, h, d) {
  if (d < 2 || !h.name.startsWith('hall')) return;
  const p = prepareOpening(h, 0, d),
    normal = [h.normal[0], 0, h.normal[1]],
    offset = -0.14 * Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    P = (u, y) => p.point(u, y, offset),
    pitch = d === 2 ? 0.9 : 0.65;
  for (let u = -h.width / 2 + 0.4; u < h.width / 2 - 0.1; u += pitch)
    face(
      'trim',
      [
        P(u - 0.055, h.bottom + 0.1),
        P(u + 0.055, h.bottom + 0.1),
        P(u + 0.055, h.bottom + h.spring - 0.1),
        P(u - 0.055, h.bottom + h.spring - 0.1),
      ],
      normal,
    );
  for (let y = h.bottom + 0.55; y < h.bottom + h.spring; y += pitch)
    face(
      'trim',
      [
        P(-h.width / 2 + 0.1, y - 0.055),
        P(h.width / 2 - 0.1, y - 0.055),
        P(h.width / 2 - 0.1, y + 0.055),
        P(-h.width / 2 + 0.1, y + 0.055),
      ],
      normal,
    );
}
function pilasters(face, d) {
  if (d === 0) return;
  for (const e of edges(plans.hall.outline)) {
    for (const j of d === 1 ? [0.07, 0.5, 0.93] : [0.06, 0.36, 0.65, 0.94]) {
      const p = e.a.map((v, k) => v + (e.b[k] - v) * j + e.normal[k] * 0.1),
        half = 0.23,
        depth = 0.2,
        r = rect(p[0] - half, p[1] - depth, p[0] + half, p[1] + depth);
      box(face, r, 5.15, 12.6, 'trim');
      box(face, rect(p[0] - 0.55, p[1] - 0.36, p[0] + 0.55, p[1] + 0.36), 12.45, 12.8, 'tile');
      if (d >= 3)
        for (const k of [-1, 1])
          box(
            face,
            rect(p[0] + k * 0.16 - 0.035, p[1] - 0.22, p[0] + k * 0.16 + 0.035, p[1] + 0.22),
            5.4,
            12.3,
            'trim',
          );
    }
  }
}
function domePoint(t, a, extra = 0) {
  const p = plans.dome,
    r = p.radius * Math.cos(t) + extra;
  return [
    p.center[0] + r * Math.cos(a),
    floor + p.base + (p.shellTop - p.base) * Math.sin(t) + extra,
    p.center[1] + r * Math.sin(a),
  ];
}
function dome(face, d) {
  const p = plans.dome,
    n = [8, 12, 24, 32, 40][d],
    steps = [2, 3, 5, 7, 9][d];
  profile(
    face,
    circle(p.center, p.radius, n),
    [
      [14.2, 1],
      [15.2, 1],
    ],
    'wall',
  );
  for (let j = 0; j < steps; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n,
        t = ((j / steps) * Math.PI) / 2,
        u = (((j + 1) / steps) * Math.PI) / 2;
      face(
        'roof',
        [domePoint(t, a), domePoint(t, b), domePoint(u, b), domePoint(u, a)],
        [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
      );
    }
  const leaves = d === 0 ? 8 : d === 1 ? 12 : 24;
  for (let i = 0; i < leaves; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / leaves,
      w = (Math.PI / leaves) * 0.6,
      ts = [
        [0.025, a - w],
        [0.025, a + w],
        [0.22, a + w * 0.8],
        [0.43, a],
        [0.22, a - w * 0.8],
      ];
    face(
      'tile',
      ts.map(([t, a]) => domePoint(t, a, 0.026)),
      [Math.cos(a), 1, Math.sin(a)],
    );
  }
  if (d >= 2) {
    const ribs = d === 2 ? 16 : d === 3 ? 24 : 32,
      segments = d === 2 ? 4 : 6;
    for (let i = 0; i < ribs; i++)
      for (let j = 0; j < segments; j++) {
        const a = (i * Math.PI * 2) / ribs,
          t = 0.43 + (j / segments) * 1.08,
          u = 0.43 + ((j + 1) / segments) * 1.08;
        face(
          'trim',
          [
            domePoint(t, a - 0.009, 0.035),
            domePoint(t, a + 0.009, 0.035),
            domePoint(u, a + 0.009, 0.035),
            domePoint(u, a - 0.009, 0.035),
          ],
          [Math.cos(a), 1, Math.sin(a)],
        );
      }
  }
  finial(face, p.center, 21.9, 23, d);
}
function finial(face, p, b, t, d) {
  if (d === 0) {
    profile(
      face,
      circle(p, 0.12, 4),
      [
        [b, 1],
        [t, 0],
      ],
      'gold',
    );
    return;
  }
  const split = t - 0.8;
  profile(
    face,
    circle(p, 0.12, 6),
    [
      [b, 1],
      [split, 1.3],
      [split + 0.1, 0.55],
    ],
    'gold',
  );
  const n = d === 1 ? 8 : d === 2 ? 16 : 24,
    r = 0.4,
    cy = t - r,
    thick = 0.05,
    P = (a, rr, z) => [p[0] + Math.cos(a) * rr, floor + cy + Math.sin(a) * rr, p[1] + z];
  for (let i = 0; i < n; i++) {
    const a = ((60 + (i * 240) / n) * Math.PI) / 180,
      q = ((60 + ((i + 1) * 240) / n) * Math.PI) / 180,
      ra = r - 0.15 * Math.sin((i * Math.PI) / n),
      rb = r - 0.15 * Math.sin(((i + 1) * Math.PI) / n);
    for (const sg of [-1, 1])
      face(
        'gold',
        [P(a, r, sg * thick), P(q, r, sg * thick), P(q, rb, sg * thick), P(a, ra, sg * thick)],
        [0, 0, sg],
      );
    face(
      'gold',
      [P(a, r, -thick), P(q, r, -thick), P(q, r, thick), P(a, r, thick)],
      [Math.cos((a + q) / 2), Math.sin((a + q) / 2), 0],
    );
    face(
      'gold',
      [P(a, ra, -thick), P(q, rb, -thick), P(q, rb, thick), P(a, ra, thick)],
      [-Math.cos((a + q) / 2), -Math.sin((a + q) / 2), 0],
    );
  }
}
function lantern(face, p, base, top, r, d, label) {
  const n = d <= 1 ? 4 : 8,
    core = circle(p, 0.5, n);
  box(face, core, base, top, 'wall');
  for (let i = 0; i < n; i++) {
    const a = (-i * Math.PI * 2) / n,
      q = [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r],
      rr = circle(q, d <= 1 ? 0.22 : 0.17, 4);
    sides(face, rr, base, top, 'trim');
    if (d >= 3) cap(face, rr, top, 'trim');
  }
  const roof = circle(p, r * 1.25, d === 0 ? 4 : 8);
  profile(
    face,
    roof,
    [
      [top, 1],
      [top + 0.35, 1],
      [top + 0.95, 0.6],
    ],
    'roof',
  );
  if (d >= 1) underside(face, roof, top, 'roof', [core]);
  void label;
}
function minaret(face, d) {
  const p = plans.tower,
    q = p.center,
    n = d === 0 ? 4 : 8,
    r = circle(q, p.radius, n);
  profile(
    face,
    r,
    [
      [0.35, 1],
      [22.8, 1],
      [23.2, 1.35],
      [24.3, 1.35],
    ],
    'wall',
  );
  lantern(face, q, 24.3, 26.7, 1.8, d, 'middle');
  profile(
    face,
    r,
    [
      [27.65, 0.83],
      [46.7, 0.73],
      [47.1, 1.1],
      [47.5, 1.1],
    ],
    'wall',
  );
  lantern(face, q, 47.5, 50.6, 1.45, d, 'upper');
  finial(face, q, 51.55, 54, d);
  if (d >= 2)
    for (const y of [23.35, 46.85]) {
      const rr = circle(q, y < 30 ? 2.42 : 2.0, 8);
      sides(face, rr, y, y + 0.18, 'trim');
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
    hs = ibrahimFields(d),
    low = hs.filter((h) => h.name.startsWith('low')),
    high = hs.filter((h) => h.name.startsWith('hall'));
  const bottom =
    d === 0 ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...r.map(footing)) : footing;
  sides(face, d === 0 ? r : subdivide(r, 2), bottom, 0.35, 'paving');
  cap(face, r, 0.35, 'paving');
  shell(out, d, r, 0.35, 4.7, d === 1 ? [] : low, 'wall');
  cap(face, r, 4.7, 'wall');
  shell(out, d, plans.hall.outline, 4.7, 14.2, d === 1 ? [] : high, 'wall');
  cap(face, plans.hall.outline, 14.2, 'wall');
  for (const h of hs) {
    pane(face, h, d, d === 1 ? 0.06 : -0.18);
    if (d >= 1) archBand(face, h, d, h.name.startsWith('hall') ? 0.15 : 0.09, 'trim', 0.04);
    panelGrid(face, h, d);
  }
  pilasters(face, d);
  dome(face, d);
  minaret(face, d);
  if (d >= 1) {
    const edge = scaled(plans.hall.outline, 1.012);
    sides(face, edge, 14.1, 14.45, 'trim');
    cap(face, edge, 14.45, 'trim', [plans.hall.outline]);
  }
}
export const buildIbrahimSkyline = (o) => build(o, 0),
  buildIbrahimDistrict = (o) => build(o, 1),
  buildIbrahimStreet = (o) => build(o, 2),
  buildIbrahimCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const ibrahimStudy = {
  id: 'ibrahim_al_ibrahim_mosque',
  key: 'ibrahim_al_ibrahim_mosque',
  title: 'Ibrahim-al-Ibrahim Mosque',
  category: 'mosque',
  wikidataId: 'Q1356809',
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
    'Six existing shared256² lime plaster,raw/coursed limestone,painted metal,ceramic tile and cast bronze graphs;seven merged roles include local opaque glazing. Metric UVs and linear tints,no embedded images or unique atlas. Coarse green fields,ribs and screen grids are original abstractions;no historic artwork or inscriptions are copied.',
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
    'Two exterior pictures guide vocabulary only. Interior layout,precise levels,stairs,thresholds,current finish,structural engineering and physical-device/full-city performance remain unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('white-stepped-hall-and-wing', [62, 26, 52], [0, 8, 0]),
    cam('pointed-screen-fields-and-pilasters', [49, 13, 29], [19, 9, 8]),
    cam('ribbed-dome-green-fields', [36, 28, 30], [15.75, 18, 0.5]),
    cam('middle-gallery-and-hood', [38, 31, 8], [14.67, 25, -15.3]),
    cam('upper-lantern-and-crescent', [33, 55, 9], [14.67, 50, -15.3]),
    cam('retained-stepped-plan', [0, 150, 0.1], [0, 0, 0]),
  ],
};

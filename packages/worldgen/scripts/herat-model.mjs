/** Herat Friday Mosque: exact courtyard/envelope,five portal frames and eight estimated capped towers. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingShape as baseOpeningShape,
  prepareOpening as basePrepareOpening,
  openingBuilder,
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
  '../../../content/worldgen/source/places/tq/tqh/friday_mosque_of_herat/',
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
  wall: '#ccb99a',
  trim: '#d9ccb3',
  roof: '#c9c0ac',
  wood: '#887052',
  glass: '#66777a',
  tile: '#b4ced0',
  paving: '#cec6b5',
  caps: '#69b1b1',
  motif: '#a6c6c3',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, heratGround(...p) - 0.35);
export function heratGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Herat Mosque footing outside retained terrain');
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

const _band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);

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
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos((i * Math.PI * 2) / n) * r,
    p[1] + Math.sin((i * Math.PI * 2) / n) * r,
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
function panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const ring = openingShape(h, d),
    outer = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
    ],
    p = [...outer, ...ring],
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
export function heratPortals(d = 3) {
  return plans.portals.map((p) => ({
    ...p,
    frameWidth: p.width,
    ...field(
      p.name,
      p.center,
      p.axis,
      p.normal,
      p.openingWidth,
      0.3,
      p.openingHeight,
      p.spring,
      p.depth,
    ),
    detail: d,
  }));
}
export function heratFields(d = 3) {
  const hs = [];
  if (d === 0) return hs;
  for (const [i, e] of edges(plans.court).entries()) {
    const portal = plans.portals[i],
      u = e.length / 2,
      spans = [
        [0, u - portal.width / 2],
        [u + portal.width / 2, e.length],
      ];
    for (const [start, end] of spans) {
      const n = Math.max(1, Math.floor((end - start) / (d === 1 ? 14 : 6))),
        step = (end - start) / n;
      for (let j = 0; j < n; j++)
        for (const tier of d === 1 ? [0] : [0, 1]) {
          const p = lerp(e.a, e.b, (start + (j + 0.5) * step) / e.length);
          hs.push({
            ...field(
              `court-field-${i}-${start}-${j}-${tier}`,
              p,
              e.axis,
              e.normal.map((v) => -v),
              step * 0.65,
              tier ? 5.4 : 0.55,
              tier ? 3.15 : 4.1,
              tier ? 2 : 2.65,
              0.8,
            ),
            step,
            tier,
            span: step,
            bottomTier: tier ? 5.0 : 0.3,
            topTier: tier ? 9.5 : 5.0,
          });
        }
    }
  }
  for (const [i, e] of edges(plans.whole.outline).entries()) {
    if (e.length < 20) continue;
    const n = Math.max(1, Math.floor(e.length / (d === 1 ? 32 : 9))),
      step = e.length / n;
    for (let j = 0; j < n; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / n);
      if (
        plans.portals.some((g) => Math.hypot(...p.map((v, k) => v - g.center[k])) < g.width / 2 + 2)
      )
        continue;
      hs.push({
        ...field(
          `outer-field-${i}-${j}`,
          p,
          e.axis,
          e.normal,
          Math.min(step * 0.65, 7.5),
          0.8,
          6.8,
          4.5,
          0.8,
        ),
        step,
        tier: 0,
        span: Math.min(step, 10),
        bottomTier: 0.3,
        topTier: 9.5,
      });
    }
  }
  return hs;
}
function portal(face, h, d) {
  const front = 0.04,
    back = -h.depth,
    P = (u, y, v) => point(h, u, floor + y, v);
  panel(face, h, d, h.frameWidth, 0.3, h.top, 'tile', front);
  reveal(face, h, d, front, back, 'roof');
  pane(face, h, d, back, 'glass');
  for (const side of [-1, 1])
    face(
      'tile',
      [
        P((side * h.frameWidth) / 2, 0.3, front),
        P((side * h.frameWidth) / 2, 0.3, back),
        P((side * h.frameWidth) / 2, h.top, back),
        P((side * h.frameWidth) / 2, h.top, front),
      ],
      [h.axis[0] * side, 0, h.axis[1] * side],
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
  if (d >= 1) {
    archBand(face, h, d, 0.6, 'trim', 0.08);
    for (const u of [-h.frameWidth / 2 + 0.65, h.frameWidth / 2 - 0.65])
      face(
        'trim',
        [
          P(u - 0.18, 1, 0.1),
          P(u + 0.18, 1, 0.1),
          P(u + 0.18, h.top - 0.4, 0.1),
          P(u - 0.18, h.top - 0.4, 0.1),
        ],
        [h.normal[0], 0, h.normal[1]],
      );
    face(
      'trim',
      [
        P(-h.frameWidth / 2 + 0.47, h.top - 0.9, 0.1),
        P(h.frameWidth / 2 - 0.47, h.top - 0.9, 0.1),
        P(h.frameWidth / 2 - 0.47, h.top - 0.4, 0.1),
        P(-h.frameWidth / 2 + 0.47, h.top - 0.4, 0.1),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
    const door = { ...h, width: 3.5, height: 4.6, spring: 3.0 };
    pane(face, door, d, back + 0.06, 'wood');
    if (d >= 2) {
      for (const dep of [back * 0.25, back * 0.5, back * 0.75])
        archBand(
          face,
          { ...h, width: h.width * 0.99, height: h.height * 0.99 },
          d,
          0.28,
          'trim',
          dep,
        );
    }
  }
}
function niche(face, h, d) {
  panel(face, h, d, h.span, h.bottomTier, h.topTier, 'tile', 0.025);
  reveal(face, h, d, 0.025, -0.4, 'trim');
  pane(face, h, d, -0.4, 'roof');
  if (d >= 2) archBand(face, h, d, 0.28, 'trim', 0.06);
  if (d >= 3) {
    const y = h.bottom + h.height * 0.45,
      w = Math.min(0.8, h.width * 0.16),
      P = (u, v) => point(h, u, y + v, -0.375);
    face(
      'tile',
      [P(-w, 0), P(0, w * 1.3), P(w, 0), P(0, -w * 1.3)],
      [h.normal[0], 0, h.normal[1]],
      colors.motif,
    );
  }
}
function minaret(face, p, d) {
  const h = p.height,
    r = p.radius,
    n = d === 1 && h <= 22 ? 6 : [6, 8, 12, 16, 20][d],
    ring = circle(p.center, r, n);
  const shaftFace =
    d === 0
      ? (slot, points, normal) =>
          face(
            slot,
            points,
            normal,
            points.every((p) => p[1] >= floor + h * 0.94 - 1e-5) ? colors.caps : undefined,
          )
      : face;
  profile(
    shaftFace,
    ring,
    d === 0
      ? [
          [0.3, 1.15],
          [h * 0.66, 1],
          [h * 0.69, 1.5],
          [h * 0.73, 0.72],
          [h * 0.94, 0.72],
          [h, 0],
        ]
      : [
          [0.3, 1.25],
          [4, 1.1],
          [h * 0.66, 1],
          [h * 0.68, 1.2],
          [h * 0.69, 1.5],
          [h * 0.72, 1.5],
          [h * 0.725, 0.72],
          [h * 0.89, 0.72],
          [h * 0.91, 0.9],
          [h * 0.94, 0.9],
        ],
    'tile',
  );
  if (d >= 1) {
    for (const y of [4, h * 0.58]) sides(face, circle(p.center, r * 1.12, n), y, y + 0.5, 'trim');
    const cyan = (s, p, n) => face(s, p, n, colors.caps);
    profile(
      cyan,
      circle(p.center, r * 0.9, n),
      [
        [h * 0.94, 1],
        [h * 0.97, 0.82],
        [h * 0.995, 0.3],
        [h, 0],
      ],
      'tile',
    );
  }
  if (d >= 2) {
    const rail = circle(p.center, r * 1.51, n);
    sides(face, rail, h * 0.72, h * 0.74, 'trim');
    cap(face, rail, h * 0.74, 'trim', [circle(p.center, r * 1.3, n)]);
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        normal = [Math.cos(a), Math.sin(a)],
        axis = [-normal[1], normal[0]],
        q = p.center.map((v, k) => v + normal[k] * r * 0.73),
        v = field(`tower-upper-${i}`, q, axis, normal, 0.55, h * 0.8, h * 0.07, h * 0.045, 0.3);
      pane(face, v, d, 0.06, 'glass');
    }
  }
}
function subdivide(r, max) {
  return r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(...b.map((v, k) => v - a[k])) / max);
    return Array.from({ length: n }, (_, j) => lerp(a, b, j / n));
  });
}
function build(out, d) {
  const face = writer(out, d),
    portals = heratPortals(d),
    fields = heratFields(d),
    wall = writer(
      masked(
        out,
        [...portals, ...fields].map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    r = plans.whole.outline,
    court = plans.court;
  // A distant edge has no terrain subdivisions. Seat that coarse ribbon below the
  // whole sampled range so linear interpolation cannot leave gaps over low ground.
  const base =
    d === 0
      ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...r.map(footing), ...court.map(footing))
      : footing;
  sides(face, d === 0 ? r : subdivide(r, 3), base, 0.3, 'paving');
  sides(face, d === 0 ? court : subdivide(court, 3), base, 0.3, 'paving', true);
  cap(face, r, 0.3, 'paving', [court]);
  sides(wall, r, 0.3, 9.5, 'wall');
  sides(wall, court, 0.3, 9.5, 'wall', true);
  cap(face, plans.roof.outline, 9.5, 'roof', plans.roof.holes);
  down(face, plans.roof.outline, 9.2, 'roof', plans.roof.holes);
  for (const h of fields) niche(face, h, d);
  for (const h of portals) portal(face, h, d);
  for (const p of plans.minarets) minaret(face, p, d);
  if (d >= 1)
    for (const e of edges(court)) {
      const normal = e.normal.map((v) => -v),
        h = { center: e.a, axis: e.axis, normal };
      // The same aperture masks clip these horizontal bands at every niche and iwan.
      const P = (u, y) => point(h, u, floor + y, 0.04);
      for (const y of [4.95, 9.1])
        wall(
          'trim',
          [P(0, y), P(e.length, y), P(e.length, y + 0.3), P(0, y + 0.3)],
          [normal[0], 0, normal[1]],
        );
    }
}
export const buildHeratSkyline = (o) => build(o, 0),
  buildHeratDistrict = (o) => build(o, 1),
  buildHeratStreet = (o) => build(o, 2),
  buildHeratCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const heratStudy = {
  id: 'friday_mosque_of_herat',
  key: 'friday_mosque_of_herat',
  title: 'Friday Mosque of Herat',
  category: 'mosque',
  wikidataId: 'Q1291612',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference images viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Six shared256² brick,raw limestone,mosaic tile,lime plaster,marble and plain wood graphs;seven merged roles including local opaque glazing. Metric UVs,linear tints,no embedded images or unique atlas. Turquoise caps and coarse original tile motifs use vertex colors;historic artwork and inscriptions are not copied.',
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
    'Two inspected pictures guide the exterior entry and deep pointed iwan vocabulary. The retained outer/court rings control horizontal scope. Internal masses,four court iwans,outer entry,tower count/positions/heights and tiled niche arrangement remain estimates. The court stays open to host ground. No large hall dome is added without a control. Fine muqarnas,calligraphy,murals,exact ornament,paving,fixtures,furnished interiors,current whole-site condition and engineering are unverified. Physical-device/full-city timing remains pending.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('western-prayer-iwan', [-8, 14, 2], [-39, 15, 2]),
    cam('eastern-outer-entry', [144, 22, 3], [78, 14, 1]),
    cam('two-tier-court-niches', [24, 7, 12], [25, 5, 31]),
    cam('pointed-iwan-vault', [-24, 4, 1], [-47, 15, 1]),
    cam('turquoise-capped-entry-minarets', [135, 32, 52], [78, 24, 1]),
    cam('retained-outer-and-open-court', [0, 350, 0.1], [0, 6, 0]),
  ],
};

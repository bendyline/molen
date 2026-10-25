/** Omar Ali Saifuddien: gold dome, square minaret and the mapped lagoon barge/bridge. */
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
  '../../../content/worldgen/source/places/w8/w8c/omar_ali_saifuddien_mosque/',
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
  wall: '#e1dfd6',
  trim: '#eae6dc',
  roof: '#95a294',
  gold: '#d3b756',
  wood: '#8a7458',
  paving: '#b8b6aa',
  glass: '#53697d',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, omarGround(...p) - 0.35);
export function omarGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Omar footing outside retained terrain');
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
const _capDome = (face, p, r, base, height, d, small = false) => {
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
function _finial(face, p, y, d) {
  if (d === 0) {
    solid(face, rect(p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08), y, y + 1.5, 'gold');
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
const _box = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
function underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function band(face, r, y, h, slot = 'trim', f = 1.015) {
  solid(face, scaled(r, f), y, y + h, slot);
}
function openBand(face, a, b, y, h, slot = 'trim', width = 0.18) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [u[1] * width, -u[0] * width];
  solid(
    face,
    [
      a.map((v, k) => v + n[k]),
      b.map((v, k) => v + n[k]),
      b.map((v, k) => v - n[k]),
      a.map((v, k) => v - n[k]),
    ],
    y,
    y + h,
    slot,
  );
}
function column(face, p, b, t, r, d, slot = 'trim') {
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

const deck = plans.deckY,
  waterBase = rec.waterY - floor;
const turrets = [
  [-32.3, -13.9, 17.8],
  [-32.3, 12.2, 17.8],
  [-6.9, -13.5, 17.8],
  [-6.9, 12.0, 17.8],
  [-18.0, -20.2, 18.3],
  [-6.7, -20.2, 18.3],
  [-18.0, 20.1, 18.3],
  [-6.7, 20.1, 18.3],
  [21.0, -13.3, 12.9],
  [21.0, 11.8, 12.9],
];
function bulb(face, p, r, base, h, d, slot = 'gold') {
  if (d === 1 && r < 2) {
    profile(
      face,
      circle(p, r, 6),
      [
        [base, 0.83],
        [base + h * 0.3, 1],
        [base + h, 0],
      ],
      slot,
    );
    return;
  }
  const shape =
    d === 0
      ? [
          [0, 0.85],
          [0.3, 1],
          [0.7, 0.65],
          [1, 0],
        ]
      : [
          [0, 0.83],
          [0.1, 0.94],
          [0.3, 1],
          [0.55, 0.87],
          [0.78, 0.5],
          [0.92, 0.22],
          [1, 0],
        ];
  profile(
    face,
    circle(p, r, [6, 8, 12, 18, 24][d]),
    shape.map(([y, r]) => [base + y * h, r]),
    slot,
  );
}
function spear(face, p, base, h, d, slot = 'trim') {
  if (d === 0) {
    profile(
      face,
      circle(p, 0.28, 4),
      [
        [base, 1],
        [base + h, 0],
      ],
      slot,
    );
    return;
  }
  const r = 0.2;
  profile(
    face,
    circle(p, r, d <= 1 ? 4 : 8),
    [
      [base, 1.4],
      [base + h * 0.15, 1.4],
      [base + h * 0.3, 2.1],
      [base + h * 0.62, 0.6],
      [base + h, 0.02],
    ],
    slot,
  );
  cap(face, circle(p, r * 0.02, d <= 1 ? 4 : 8), base + h, slot);
}
function flatBox(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function trimEdges(face, r, y, d, slot = 'trim') {
  for (const e of edges(r)) {
    openBand(face, e.a, e.b, y, 0.32, slot, 0.16);
    if (d >= 2) {
      const n = Math.round(e.length / 2.6);
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n);
        if (turrets.some(([x, z]) => Math.hypot(p[0] - x, p[1] - z) < 1.5)) continue;
        flatBox(
          face,
          rect(p[0] - 0.16, p[1] - 0.16, p[0] + 0.16, p[1] + 0.16),
          y + 0.32,
          y + 0.65,
          slot,
        );
      }
    }
  }
}
export function omarWallFields(d = 3) {
  if (!d) return [];
  const fields = [];
  for (const [key, r] of [
    ['prayer', plans.prayer],
    ['wing', plans.wing],
  ])
    for (const [ei, e] of edges(r).entries()) {
      if (e.length < 6) continue;
      const n = d === 1 ? Math.max(2, Math.round(e.length / 7)) : Math.round(e.length / 4.1);
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n);
        if (key === 'prayer' && Math.abs(e.normal[1]) > 0.8 && p[0] > -19 && p[0] < -6) continue;
        if (turrets.some(([x, z]) => Math.hypot(p[0] - x, p[1] - z) < 1.5)) continue;
        if (key === 'wing' && Math.abs(e.normal[0]) > 0.8) continue;
        fields.push({
          ...hole(
            `${key}-${ei}-${i}`,
            p,
            e.axis,
            e.normal,
            d === 1 ? 1.8 : 1.5,
            1.5,
            key === 'prayer' ? 8.1 : 6.3,
            key === 'prayer' ? 6.4 : 4.7,
            'pointed',
            1.8,
          ),
          mass: key,
        });
      }
    }
  for (const normal of [-1, 1])
    for (let i = 0; i < 3; i++)
      fields.push({
        ...hole(
          `portico-door-${normal}-${i}`,
          [-16.7 + i * 3.45, normal * (normal > 0 ? 12.9 : 14.0)],
          [1, 0],
          [0, normal],
          2.1,
          0.35,
          7.9,
          6.0,
          'pointed',
          2,
        ),
        kind: 'wood',
        mass: 'prayer',
      });
  return fields;
}
export function omarPorticoArches(d = 3) {
  const fields = [];
  for (const normal of [-1, 1])
    for (let i = 0; i < 3; i++)
      fields.push(
        hole(
          `portico-${normal}-${i}`,
          [-16.7 + i * 3.45, normal * 20.6],
          [1, 0],
          [0, normal],
          d === 0 ? 2.8 : 3.0,
          0.2,
          11.3,
          8.0,
          d === 0 ? 'rect' : 'pointed',
          2.5,
        ),
      );
  return fields;
}
export function omarDrumFields(d = 3) {
  if (!d) return [];
  return edges(circle(plans.dome.center, 11.15, [8, 12, 20, 32, 40][d]))
    .filter((_, i) => d !== 1 || i % 2 === 0)
    .map((e, i) =>
      hole(
        `drum-${i}`,
        lerp(e.a, e.b, 0.5),
        e.axis,
        e.normal,
        d === 1 ? 1.0 : 0.65,
        20.1,
        4.9,
        4.5,
        'round',
        1.2,
      ),
    );
}
function finishFields(face, fields, d, applied = false) {
  for (const h of fields) {
    pane(face, h, d === 2 ? 1 : d, applied ? 0.04 : -0.18, h.kind === 'wood' ? 'wood' : 'glass');
    if (d >= 2 && !applied) trimBand(face, h, 1, 0.16);
  }
}
function mosque(out, face, d) {
  sides(face, plans.whole.outline, footing, 0.12, 'paving');
  cap(face, plans.whole.outline, 0.12, 'paving');
  const fields = omarWallFields(d);
  for (const [key, r, top] of [
    ['prayer', plans.prayer, 15.5],
    ['wing', plans.wing, 12.0],
  ]) {
    const hs = fields.filter((h) => h.mass === key);
    shell(out, d, r, 0.12, top, d <= 1 ? [] : hs, 'wall');
    cap(face, r, top, 'paving');
    finishFields(face, hs, d, d <= 1);
    if (d >= 1) trimEdges(face, r, top, d);
  }
  // Upper eastern clerestory is one pane band with continuous shared trim strips.
  if (d >= 1)
    for (const normal of [-1, 1]) {
      const z = normal * (normal > 0 ? 12.5 : 14.0),
        h = hole(
          `upper-east-${normal}`,
          [7.4, z],
          [1, 0],
          [0, normal],
          24,
          9.2,
          1.7,
          1.7,
          'rect',
          1,
        );
      pane(face, h, d, 0.07);
      openBand(face, [-4.5, z], [19.5, z], 9.1, 0.18, 'trim', 0.16);
      openBand(face, [-4.5, z], [19.5, z], 10.9, 0.2, 'trim', 0.16);
      if (d >= 2)
        for (let i = 0; i <= 16; i++) {
          const x = -4.5 + i * 1.5;
          flatBox(face, rect(x - 0.08, z - 0.12, x + 0.08, z + 0.12), 9.2, 10.9, 'trim');
        }
    }
  for (const porch of plans.porches) {
    const hs = omarPorticoArches(d).filter((h) => h.normal[1] === porch.normal[1]),
      outer = porch.outline;
    if (d === 0) {
      const z = porch.normal[1] * 20.6;
      for (let i = 0; i <= 3; i++) {
        const x = -18.4 + i * 3.45;
        flatBox(face, rect(x - 0.3, z - 0.35, x + 0.3, z + 0.35), 0.12, 8.3, 'trim');
      }
      openBand(face, [-18.4, z], [-6.05, z], 8.3, 4, 'trim', 0.35);
    } else {
      const n = porch.normal[1],
        back = hole(
          'open-portico-rear',
          [-12.3, n > 0 ? 13.0 : -14.5],
          [1, 0],
          [0, -n],
          14,
          0,
          13,
          13,
          'rect',
          4.0,
        );
      shell(out, d, outer, 0.12, 12.5, [...hs, back], 'trim', scaled(outer, 0.87));
    }
    cap(face, outer, 12.6, 'paving');
    underside(face, outer, 12.3, 'trim');
    if (d >= 2) for (const h of hs) trimBand(face, h, 1, 0.2);
  }
  const entry = plans.entry;
  if (d === 0) {
    flatBox(face, entry, 0.12, 7.9, 'wall');
  } else {
    const hs = [];
    for (const [ei, e] of edges(entry).entries()) {
      if (e.normal[0] < -0.8) continue;
      const n = d === 1 ? 3 : Math.max(3, Math.round(e.length / 1.9));
      for (let i = 0; i < n; i++)
        hs.push(
          hole(
            `entry-${ei}-${i}`,
            lerp(e.a, e.b, (i + 0.5) / n),
            e.axis,
            e.normal,
            e.length / n - 0.3,
            1.1,
            4.9,
            3.9,
            'round',
            2,
          ),
        );
    }
    if (d === 1) {
      const posts = new Map();
      for (const e of edges(entry)) {
        if (e.normal[0] < -0.8) continue;
        openBand(face, e.a, e.b, 6.0, 1.9, 'wall', 0.3);
        for (let i = 0; i <= 3; i++) {
          const p = lerp(e.a, e.b, i / 3);
          posts.set(p.map((n) => Math.round(n * 100)).join(','), p);
        }
      }
      for (const p of posts.values()) column(face, p, 0.12, 6.0, 0.2, 1);
      for (const h of hs) archBand(face, h, 0, 0.18, 'trim', 0.04);
    } else shell(out, d, entry, 0.12, 7.9, hs, 'wall', scaled(entry, 0.86));
  }
  cap(face, entry, 8.0, 'paving');
  underside(face, entry, 7.7, 'trim');
  if (d >= 1) trimEdges(face, entry, 8.0, d);
  const p = plans.dome.center;
  profile(
    face,
    circle(p, 12.3, d === 0 ? 6 : d === 1 ? 8 : 16),
    [
      [15.5, 1],
      [16.1, 1],
      [19, 0.88],
    ],
    'trim',
  );
  const drum = circle(p, 11.15, [8, 12, 20, 32, 40][d]),
    windows = omarDrumFields(d);
  shell(out, d, drum, 19, 26, d <= 1 ? [] : windows, 'wall');
  finishFields(face, windows, d, d <= 1);
  bulb(face, p, 11.5, 26, 9.5, d);
  spear(face, p, 35.5, 2.5, d);
  if (d >= 1) {
    band(face, drum, 19.2, 0.35, 'trim', 1.01);
    band(face, drum, 25.6, 0.4, 'trim', 1.025);
  }
  for (const [i, [x, z, base]] of turrets.entries()) {
    if (d === 0 && i >= 8) continue;
    chattri(face, [x, z], base, d);
  }
}
function chattri(face, p, y, d) {
  const shaft = rect(p[0] - 0.6, p[1] - 0.6, p[0] + 0.6, p[1] + 0.6);
  if (d === 0) {
    flatBox(face, shaft, 0.12, y + 1.3, 'trim');
    profile(
      face,
      circle(p, 1.15, 4),
      [
        [y + 1.3, 1],
        [y + 2.4, 0],
      ],
      'gold',
    );
    return;
  }
  profile(
    face,
    rect(p[0] - 1.0, p[1] - 1.0, p[0] + 1.0, p[1] + 1.0),
    d === 1
      ? [
          [0.12, 1],
          [y, 0.6],
        ]
      : [
          [0.12, 1],
          [3.6, 1],
          [5, 0.6],
          [y, 0.6],
        ],
    'trim',
  );
  const ring = circle(p, 1.35, d === 1 ? 6 : 8);
  cap(face, ring, y, 'trim');
  underside(face, ring, y - 0.18, 'trim');
  for (const q of circle(p, 1.0, d === 1 ? 4 : 6)) column(face, q, y, y + 2.0, 0.12, 1);
  cap(face, ring, y + 2.0, 'trim');
  bulb(face, p, 1.35, y + 2.0, 1.15, d);
  if (d >= 2) spear(face, p, y + 3.15, 0.6, d, 'gold');
  if (d >= 2)
    for (const yy of [7, 11, 15])
      if (yy < y) {
        for (const normal of [-1, 1])
          pane(
            face,
            hole(
              'turret-slot',
              [p[0], p[1] + normal * 0.6],
              [1, 0],
              [0, normal],
              0.16,
              yy,
              1.1,
              1.1,
              'rect',
              0.2,
            ),
            1,
            0.025,
          );
      }
}
function minaret(out, face, d) {
  const p = plans.minaret.center,
    base = rect(p[0] - 2.6, p[1] - 2.6, p[0] + 2.6, p[1] + 2.6),
    shaft = rect(p[0] - 1.8, p[1] - 1.8, p[0] + 1.8, p[1] + 1.8);
  profile(
    face,
    base,
    [
      [0.12, 1],
      [10.0, 1],
      [13.5, 0.7],
    ],
    'wall',
  );
  const fields = [];
  if (d >= 1)
    for (const [i, e] of edges(shaft).entries())
      for (const y of d <= 2 ? [17] : [17, 26, 35])
        fields.push(
          hole(
            `minaret-slot-${i}-${y}`,
            lerp(e.a, e.b, 0.5),
            e.axis,
            e.normal,
            0.4,
            y,
            d <= 2 ? 24 : 7.0,
            d <= 2 ? 24 : 7.0,
            'rect',
            1,
          ),
        );
  shell(out, d, shaft, 13.5, 43.5, d <= 1 ? [] : fields, 'wall');
  finishFields(face, fields, d, d <= 1);
  const crown = circle(p, 3.1, d === 0 ? 4 : d === 1 ? 6 : 8);
  profile(
    face,
    crown,
    [
      [42.4, 0.65],
      [43.5, 1],
      [43.8, 1],
    ],
    'trim',
  );
  cap(face, crown, 43.8, 'trim');
  for (const q of circle(p, 2.1, d === 0 ? 4 : d === 1 ? 6 : 8))
    column(face, q, 43.8, 48.0, d === 0 ? 0.35 : 0.24, 1);
  cap(face, crown, 48.0, 'trim');
  bulb(face, p, 2.7, 48.0, 2.7, d);
  spear(face, p, 50.7, 1.3, d, 'gold');
}
function hip(face, p, rx, rz, y, rise, d) {
  const rings =
      d <= 1
        ? [
            [1, 0],
            [0.52, rise],
          ]
        : [
            [1, 0.35],
            [0.82, 0.18],
            [0.58, rise],
          ],
    r = rect(-rx, -rz, rx, rz),
    topScale = rings.at(-1)[0];
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < 4; i++) {
      const n = (i + 1) % 4,
        a = r[i],
        b = r[n],
        lo = rings[j - 1],
        hi = rings[j];
      const point = (q, level) =>
        at([p[0] + q[0] * level[0], p[1] + q[1] * level[0]], y + level[1]);
      face('roof', [point(a, lo), point(b, lo), point(b, hi), point(a, hi)], [0, 1, 0]);
      if (d >= 2)
        face(
          'trim',
          [point(a, lo), point(b, lo), point(b, hi), point(a, hi)].map((p) => [
            p[0],
            p[1] - 0.12,
            p[2],
          ]),
          [0, -1, 0],
        );
    }
  cap(
    face,
    rect(p[0] - rx * topScale, p[1] - rz * topScale, p[0] + rx * topScale, p[1] + rz * topScale),
    y + rise,
    'roof',
  );
  if (d <= 1) underside(face, rect(p[0] - rx, p[1] - rz, p[0] + rx, p[1] + rz), y, 'trim');
  else {
    underside(
      face,
      rect(p[0] - rx * topScale, p[1] - rz * topScale, p[0] + rx * topScale, p[1] + rz * topScale),
      y + rise - 0.12,
      'trim',
    );
    for (const e of edges(rect(p[0] - rx, p[1] - rz, p[0] + rx, p[1] + rz)))
      face(
        'gold',
        [at(e.a, y + 0.23), at(e.b, y + 0.23), at(e.b, y + 0.35), at(e.a, y + 0.35)],
        [e.normal[0], 0, e.normal[1]],
      );
  }
  if (d >= 1)
    for (const e of edges(rect(p[0] - rx, p[1] - rz, p[0] + rx, p[1] + rz)))
      openBand(face, e.a, e.b, y + 0.28, 0.15, 'gold', 0.08);
}
function gable(face, p, d) {
  const rx = 3.8,
    rz = 3.8,
    y = deck + 2.9,
    rise = 3.3;
  for (const sx of [-1, 1])
    face(
      'roof',
      [
        at([p[0] + sx * rx, p[1] - rz], y),
        at([p[0] + sx * rx, p[1] + rz], y),
        at([p[0], p[1] + rz * 0.72], y + rise),
        at([p[0], p[1] - rz * 0.72], y + rise),
      ],
      [sx, 1, 0],
    );
  for (const sz of [-1, 1]) {
    face(
      'glass',
      [
        at([p[0] - rx, p[1] + sz * rz], y),
        at([p[0] + rx, p[1] + sz * rz], y),
        at([p[0], p[1] + sz * rz * 0.72], y + rise),
      ],
      [0, 0, sz],
    );
    if (d >= 1)
      for (const sx of [-1, 1])
        beam(
          face,
          at([p[0] + sx * rx, p[1] + sz * rz], y),
          at([p[0], p[1] + sz * rz * 0.72], y + rise),
          0.15,
          'gold',
        );
  }
  underside(face, rect(p[0] - rx, p[1] - rz, p[0] + rx, p[1] + rz), y, 'trim');
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      column(face, [p[0] + sx * 2.8, p[1] + sz * 2.8], deck, deck + 2.9, 0.16, 1);
  if (d >= 2)
    for (const sz of [-1, 1])
      for (const sx of [-1, 1])
        openBand(
          face,
          [p[0] + sx * 2.8, p[1] + sz * 2.8],
          [p[0], p[1] + sz * 2.8],
          deck + 2.7,
          0.18,
          'trim',
          0.12,
        );
}
function barge(face, d) {
  const r = plans.barge.outline,
    p = plans.barge.center;
  profile(
    face,
    r,
    [
      [waterBase - 0.4, 0.82],
      [waterBase + 0.15, 0.95],
      [deck, 1],
    ],
    'gold',
  );
  cap(face, r, deck, 'paving');
  const xmin = Math.min(...r.map((q) => q[0])),
    xmax = Math.max(...r.map((q) => q[0])),
    half = (xmax - xmin) / 2;
  const inner = scaled(r, 0.985),
    winding = sign(r);
  for (const [i, a] of r.entries()) {
    const b = r[(i + 1) % r.length],
      height = (q) => deck + 4.7 * Math.pow(Math.abs((q[0] - p[0]) / half), 8);
    face(
      'gold',
      [at(a, deck), at(b, deck), at(b, height(b)), at(a, height(a))],
      [(b[1] - a[1]) * winding, 0, (a[0] - b[0]) * winding],
    );
    const j = (i + 1) % r.length;
    face(
      'gold',
      [at(inner[i], deck), at(inner[j], deck), at(inner[j], height(b)), at(inner[i], height(a))],
      [-(b[1] - a[1]) * winding, 0, -(a[0] - b[0]) * winding],
    );
    face(
      'trim',
      [at(a, height(a)), at(b, height(b)), at(inner[j], height(b)), at(inner[i], height(a))],
      [0, 1, 0],
    );
    if (d >= 2) beam(face, at(a, height(a)), at(b, height(b)), 0.18, 'trim');
  }
  for (const x of [p[0] - 11.2, p[0] + 11.2]) gable(face, [x, p[1]], d);
  const supports = d <= 1 ? [-1, 1] : [-1, 0, 1];
  for (const sx of supports)
    for (const sz of [-1, 1])
      column(face, [p[0] + sx * 3.6, p[1] + sz * 3.4], deck, deck + 5.4, 0.2, 1, 'trim');
  for (const [rx, rz, y, rise] of [
    [5.0, 4.6, deck + 5.3, 1.5],
    [3.5, 3.2, deck + 6.7, 1.2],
    [2.35, 2.15, deck + 7.8, 1.2],
  ])
    hip(face, p, rx, rz, y, rise, d);
  spear(face, p, deck + 9.0, 1.5, d, 'gold');
  if (d >= 1)
    for (const sz of [-1, 1])
      openBand(
        face,
        [p[0] - 7.5, p[1] + sz * 4.5],
        [p[0] + 7.5, p[1] + sz * 4.5],
        deck + 0.9,
        0.18,
        'trim',
        0.1,
      );
}
function footbridge(face, d) {
  const points = plans.bridge,
    width = 1.4;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      v = unit(b.map((n, k) => n - a[k])),
      n = [v[1] * width, -v[0] * width],
      r = [
        a.map((v, k) => v + n[k]),
        b.map((v, k) => v + n[k]),
        b.map((v, k) => v - n[k]),
        a.map((v, k) => v - n[k]),
      ];
    if (d === 0) {
      cap(face, r, deck, 'paving');
      underside(face, r, deck - 0.15, 'paving');
    } else flatBox(face, r, deck - 0.32, deck, 'paving');
    if (d >= 1)
      for (const sg of [-1, 1])
        openBand(
          face,
          a.map((v, k) => v + sg * n[k]),
          b.map((v, k) => v + sg * n[k]),
          deck + 1.0,
          0.2,
          'trim',
          0.12,
        );
  }
  for (let i = 0; i < points.length; i++) {
    if (d === 0 && ![0, 4, points.length - 1].includes(i)) continue;
    const p = points[i];
    column(face, p, waterBase - 0.4, deck - 0.3, d === 0 ? 0.4 : 0.35, 1, 'wall');
    if (d >= 1 && (d >= 2 || i % 2 === 0 || i === points.length - 1)) {
      const a = points[Math.max(0, i - 1)],
        b = points[Math.min(i + 1, points.length - 1)],
        v = unit(b.map((n, k) => n - a[k])),
        n = [v[1] * width, -v[0] * width];
      for (const sg of [-1, 1])
        column(
          face,
          p.map((v, k) => v + sg * n[k]),
          deck,
          deck + 1.15,
          0.18,
          1,
        );
    }
  }
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let length = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const v = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (v > length) {
              length = v;
              k = i;
            }
          }
          if (d > 0 && length > (d === 1 ? 45 : 25)) {
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
  mosque(out, face, d);
  minaret(out, face, d);
  barge(face, d);
  footbridge(face, d);
}
export const buildOmarSkyline = (o) => build(o, 0),
  buildOmarDistrict = (o) => build(o, 1),
  buildOmarStreet = (o) => build(o, 2),
  buildOmarCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const omarStudy = {
  id: 'omar_ali_saifuddien_mosque',
  key: 'omar_ali_saifuddien_mosque',
  title: 'Omar Ali Saifuddien Mosque',
  category: 'mosque',
  wikidataId: 'Q842921',
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
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing256² limestone,continuous limestone,standing-seam metal,cast bronze,plain wood and concrete graphs;seven merged roles including local opaque glazing. Metric UVs,linear tints,zero embedded images,unique atlases,copied calligraphy or baked light.',
  importReason: rec.scope,
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  previewEntities: scope.previewEntities,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Exact raw mosque footprint,lagoon hole,barge POI and selected tagged bridge geometry are retained;the barge has no resolved exact-QID building polygon. Qualified52m tip used without rescaling the current footprint. Other architectural heights,partitions,bay counts,boat hull/pavilions,bridge width,shore steps,current finish,engineering and exact ground/water contact are approximations. Fine inscriptions,scrollwork,heraldry and unseen interiors are omitted. Preview water is absent from the runtime asset;host water supplies the lagoon. Physical laptop/phone timings remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('gold-dome-and-square-minaret', [75, 49, 77], [-4, 22, 0]),
    cam('three-open-portal-arches', [-10, 10, 53], [-12, 7, 19]),
    cam('slotted-drum-and-gold-bulb', [-57, 36, 44], [-20, 27, 0]),
    cam('square-minaret-open-belfry', [52, 53, 32], [18, 43, -10]),
    cam('mahligai-three-roof-barge', [44, 16, 126], [-8, 5, 91]),
    cam('curved-bridge-and-north-up-plan', [0, 245, 45.1], [0, 2, 45]),
  ],
};

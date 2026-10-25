/** Ortakoy: curved waterfront facades, twin minarets and pink U-shaped entrance wings. */
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
  '../../../content/worldgen/source/places/sx/sxk/ortakoy_mosque/',
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
  wall: '#d8d3c6',
  trim: '#e9e3d4',
  plaster: '#d7b49e',
  roof: '#87939e',
  gold: '#c7ab62',
  wood: '#8b765d',
  glass: '#566c7d',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, ortakoyGround(...p) - 0.35);
export function ortakoyGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Ortakoy footing outside retained terrain');
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
function _underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function band(face, r, y, h, slot = 'trim', f = 1.015) {
  solid(face, scaled(r, f), y, y + h, slot);
}
function _openBand(face, a, b, y, h, slot = 'trim', width = 0.18) {
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

const domePoint = plans.dome.center;
const facades = [
  { name: 'sea', center: [20.2, 0], axis: [0, 1], normal: [1, 0] },
  { name: 'southwest', center: [9.65, 10.6], axis: [1, 0], normal: [0, 1] },
  { name: 'northeast', center: [9.65, -10.6], axis: [1, 0], normal: [0, -1] },
  { name: 'rear', center: [-0.8, 0], axis: [0, 1], normal: [-1, 0] },
];
function slab(face, r, b, t, slot = 'trim') {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function spire(face, p, base, h, d, slot = 'gold') {
  const n = d <= 1 ? 4 : 8;
  profile(
    face,
    circle(p, 0.2, n),
    d === 0
      ? [
          [base, 1],
          [base + h, 0],
        ]
      : [
          [base, 1.2],
          [base + h * 0.25, 1.6],
          [base + h * 0.5, 0.8],
          [base + h * 0.7, 1.0],
          [base + h, 0.02],
        ],
    slot,
  );
  if (d > 0) cap(face, circle(p, 0.004, n), base + h, slot);
}
export function ortakoyHallFields(d = 3) {
  if (!d) return [];
  const fields = [];
  for (const f of facades.slice(0, 3))
    for (const [tier, bottom, height, spring] of [
      ['lower', 1.4, 4.8, 3.3],
      ['upper', 9.0, 7.0, 5.4],
    ])
      for (let i = 0; i < 3; i++) {
        const p = f.center.map((v, k) => v + f.axis[k] * (i - 1) * 5.4);
        fields.push({
          ...hole(
            `${f.name}-${tier}-${i}`,
            p,
            f.axis,
            f.normal,
            tier === 'upper' ? 3.2 : 3.0,
            bottom,
            height,
            spring,
            'round',
            2,
          ),
          kind: f.name === 'sea' && tier === 'lower' && i === 1 ? 'blind' : 'glass',
        });
      }
  return fields;
}
export function ortakoyLobbyFields(d = 3) {
  if (!d) return [];
  const fields = [];
  for (let i = 0; i < 3; i++) {
    const p = [-10.3, (i - 1) * 4.65];
    fields.push({
      ...hole(`entry-door-${i}`, p, [0, 1], [-1, 0], 2.6, 0.25, 4.0, 4.0, 'rect', 1.8),
      kind: i === 1 ? 'wood' : 'glass',
    });
    fields.push(hole(`entry-transom-${i}`, p, [0, 1], [-1, 0], 3.8, 5.0, 3.1, 1.2, 'round', 1.8));
  }
  return fields;
}
export function ortakoyWingFields(d = 3) {
  if (!d) return [];
  const fields = [];
  for (const [key, r] of [
    ['north', plans.north],
    ['south', plans.south],
  ])
    for (const [ei, e] of edges(r).entries()) {
      if (e.length < 4) continue;
      const n =
        d === 1 ? Math.max(1, Math.round(e.length / 5.0)) : Math.max(1, Math.round(e.length / 3.5));
      for (let i = 0; i < n; i++)
        for (const y of [1.3, 5.2]) {
          const p = lerp(e.a, e.b, (i + 0.5) / n);
          if (plans.minarets.some((t) => Math.hypot(t.center[0] - p[0], t.center[1] - p[1]) < 2.3))
            continue;
          fields.push({
            ...hole(`${key}-${ei}-${i}-${y}`, p, e.axis, e.normal, 1.6, y, 2.5, 1.7, 'round', 1.4),
            wing: key,
          });
        }
    }
  return fields;
}
function finish(face, fields, d, applied = false) {
  for (const h of fields) {
    const slot = h.kind === 'blind' ? 'wall' : h.kind === 'wood' ? 'wood' : 'glass';
    pane(face, h, d === 2 ? 1 : d, applied ? 0.18 : -0.18, slot);
    if (d >= 2) trimBand(face, h, 1, h.kind === 'wood' ? 0.28 : 0.18);
    if (d >= 2 && h.kind !== 'blind') {
      const n = h.width > 2.8 ? 3 : 1;
      for (let i = 1; i <= n; i++) {
        const u = -h.width / 2 + (h.width * i) / (n + 1),
          p = h.center.map((v, k) => v + h.axis[k] * u + h.normal[k] * 0.04);
        beam(
          face,
          [p[0], h.bottom + 0.1, p[1]],
          [p[0], h.bottom + h.spring - 0.1, p[1]],
          0.085,
          'trim',
        );
      }
      for (const y of [h.bottom + h.spring * 0.45, h.bottom + h.spring * 0.85]) {
        const a = h.center.map((v, k) => v - h.axis[k] * h.width * 0.47 + h.normal[k] * 0.04),
          b = h.center.map((v, k) => v + h.axis[k] * h.width * 0.47 + h.normal[k] * 0.04);
        beam(face, [a[0], y, a[1]], [b[0], y, b[1]], 0.085, 'trim');
      }
    }
  }
}
function pediment(face, f, d) {
  const width = 9.5,
    segments = [4, 6, 10, 16, 20][d],
    base = 17.8,
    ring = [
      [-width, base],
      [width, base],
    ];
  for (let i = 0; i <= segments; i++) {
    const u = width - (2 * width * i) / segments;
    ring.push([u, base + 3.0 * Math.sqrt(Math.max(0, 1 - (u * u) / (width * width)))]);
  }
  const world = (q, offset) => [
    f.center[0] + f.axis[0] * q[0] + f.normal[0] * offset,
    floor + q[1],
    f.center[1] + f.axis[1] * q[0] + f.normal[1] * offset,
  ];
  face(
    'wall',
    ring.map((q) => world(q, 0.35)),
    [f.normal[0], 0, f.normal[1]],
  );
  face(
    'wall',
    ring.map((q) => world(q, -0.65)),
    [-f.normal[0], 0, -f.normal[1]],
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      i >= 2 ? 'roof' : 'trim',
      [world(a, 0.35), world(b, 0.35), world(b, -0.65), world(a, -0.65)],
      i >= 2 ? [0, 1, 0] : undefined,
    );
  }
  if (d >= 1)
    for (let i = 2; i < ring.length - 1; i++)
      beam(face, world(ring[i], 0.45), world(ring[i + 1], 0.45), d >= 2 ? 0.32 : 0.24, 'trim');
  if (d >= 2) {
    const h = hole(
      'pediment-medallion',
      f.center,
      f.axis,
      f.normal,
      2.3,
      18.1,
      2.3,
      1.15,
      'circle',
      1,
    );
    pane(face, h, 2, 0.42, 'trim');
    archBand(face, h, 2, 0.18, 'trim', 0.49);
  }
}
function pinnacle(face, p, d) {
  const r = rect(p[0] - 0.9, p[1] - 0.9, p[0] + 0.9, p[1] + 0.9);
  slab(face, r, 0.12, 18.6, 'trim');
  if (d === 0) {
    slab(face, scaled(r, 1.3), 18.6, 21.5, 'trim');
    spire(face, p, 21.5, 1.0, 0);
    return;
  }
  profile(
    face,
    r,
    [
      [18.1, 1.3],
      [18.6, 1.3],
      [19.0, 1.0],
      [21.0, 1.0],
      [21.8, 0.55],
    ],
    'trim',
  );
  cap(face, scaled(r, 0.55), 21.8, 'trim');
  for (const normal of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ]) {
    const axis = [-normal[1], normal[0]],
      center = p.map((v, k) => v + normal[k] * 0.92),
      h = hole('corner-medallion', center, axis, normal, 1.15, 19.4, 1.15, 0.575, 'circle', 1);
    pane(face, h, 1, 0.06, 'wall');
    archBand(face, h, 1, 0.16, 'trim', 0.1);
  }
  spire(face, p, 21.8, 1.0, d);
}
function pilasters(face, d) {
  for (const x of [-0.6, 20.0])
    for (const z of [-10.4, 10.4]) {
      const r = rect(x - 0.85, z - 0.85, x + 0.85, z + 0.85);
      slab(face, scaled(r, 1.5), 0.12, 1.0, 'trim');
      if (d >= 1) for (const y of [7.2, 16.9]) slab(face, scaled(r, 1.35), y, y + 0.45, 'trim');
      pinnacle(face, [x, z], d);
    }
  if (d >= 1)
    for (const f of facades.slice(0, 3))
      for (const u of [-8.2, -2.7, 2.7, 8.2]) {
        const p = f.center.map((v, k) => v + f.axis[k] * u + f.normal[k] * 0.13),
          r = rect(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25);
        slab(face, r, 7.6, 17.5, 'trim');
        if (d >= 2) {
          slab(face, scaled(r, 1.65), 7.6, 8.1, 'trim');
          slab(face, scaled(r, 1.65), 16.6, 17.1, 'trim');
        }
      }
}
function wingRoof(face, r, d) {
  const inner = scaled(r, 0.72);
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face('roof', [at(r[i], 9.0), at(r[j], 9.0), at(inner[j], 10.2), at(inner[i], 10.2)], [0, 1, 0]);
  }
  cap(face, inner, 10.2, 'roof');
  if (d >= 1) band(face, r, 8.65, 0.35, 'trim', 1.01);
}
function wings(out, face, d) {
  const fields = ortakoyWingFields(d);
  for (const [key, r] of [
    ['north', plans.north],
    ['south', plans.south],
  ]) {
    const hs = fields.filter((h) => h.wing === key);
    shell(out, d, r, 0.12, 9.0, d <= 1 ? [] : hs, 'wall');
    // Only the courtyard-facing original wall plane gets the warm plaster field.
    for (const e of edges(r))
      if (
        e.length > 4 &&
        e.a[0] < -9 &&
        e.b[0] < -9 &&
        (key === 'north' ? e.normal[1] > 0.8 : e.normal[1] < -0.8)
      ) {
        const a = e.a.map((v, k) => v + e.normal[k] * 0.025),
          b = e.b.map((v, k) => v + e.normal[k] * 0.025),
          skin = writer(
            masked(
              out,
              (d <= 1 ? [] : hs).map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
            ),
            d,
          );
        skin(
          'plaster',
          [at(a, 0.12), at(b, 0.12), at(b, 9), at(a, 9)],
          [e.normal[0], 0, e.normal[1]],
        );
      }
    finish(face, hs, d, d <= 1);
    wingRoof(face, r, d);
  }
  const hs = ortakoyLobbyFields(d);
  shell(out, d, plans.lobby, 0.12, 9.0, d <= 1 ? [] : hs, 'plaster');
  finish(face, hs, d, d <= 1);
  cap(face, plans.lobby, 9.05, 'roof');
  for (const y of [0.3, 4.65, 8.6]) band(face, plans.lobby, y, 0.25, 'trim', 1.012);
  if (d >= 1)
    for (const z of [-7.2, -2.32, 2.32, 7.2])
      slab(face, rect(-10.55, z - 0.15, -10.15, z + 0.15), 0.12, 9.0, 'trim');
  if (d >= 2)
    for (let i = 0; i < 5; i++)
      slab(face, rect(-13.1 + i * 0.55, -2, -12.5 + i * 0.55, 2), 0.08, 0.6 - i * 0.1, 'trim');
}
function prayer(out, face, d) {
  const fields = ortakoyHallFields(d);
  shell(out, d, plans.prayer, 0.12, 17.8, d <= 1 ? [] : fields, 'wall');
  finish(face, fields, d, d <= 1);
  cap(face, plans.prayer, 17.8, 'roof');
  if (d >= 1)
    for (const [y, h] of [
      [0.25, 0.45],
      [7.1, 0.45],
      [17.25, 0.5],
    ])
      band(face, plans.prayer, y, h, 'trim', 1.02);
  for (const f of facades) pediment(face, f, d);
  pilasters(face, d);
  const drum = circle(domePoint, 9.2, d <= 1 ? 12 : d === 2 ? 20 : 32);
  slab(face, drum, 18.7, 20.3, 'wall');
  if (d >= 1) band(face, drum, 20.05, 0.25, 'trim', 1.02);
  if (d >= 2)
    for (const e of edges(drum)) {
      const p = lerp(e.a, e.b, 0.5);
      slab(face, rect(p[0] - 0.18, p[1] - 0.18, p[0] + 0.18, p[1] + 0.18), 18.8, 20.3, 'trim');
    }
  _capDome(face, domePoint, 9.35, 20.3, 6.4, d);
  spire(face, domePoint, 26.7, 1.8, d);
}
function minarets(face, d) {
  for (const t of plans.minarets) {
    const p = t.center,
      n = [6, 8, 12, 16, 20][d],
      base = circle(p, 2.0, d <= 1 ? 6 : 8),
      shaft = circle(p, 0.85, n);
    profile(
      face,
      base,
      [
        [0.12, 1],
        [8.8, 1],
        [10.4, 0.48],
      ],
      'wall',
    );
    cap(face, scaled(base, 0.48), 10.4, 'wall');
    sides(face, shaft, 10.4, 27.8, 'wall');
    const ring = circle(p, 2.1, d <= 1 ? 6 : d === 2 ? 10 : 14),
      inner = scaled(ring, 0.78);
    profile(
      face,
      shaft,
      d <= 1
        ? [
            [26.0, 1],
            [27.8, 2.45],
          ]
        : [
            [26, 1],
            [26.5, 1.35],
            [27.2, 1.9],
            [27.8, 2.45],
          ],
      'trim',
    );
    cap(face, ring, 27.8, 'trim');
    sides(face, ring, 27.8, 29.0, 'trim');
    sides(face, inner, 27.8, 29.0, 'trim', true);
    cap(face, ring, 29.0, 'trim', [inner]);
    sides(face, circle(p, 0.7, n), 27.8, 38.4, 'wall');
    cap(face, circle(p, 0.7, n), 38.4, 'wall');
    profile(
      face,
      circle(p, 0.75, n),
      d <= 1
        ? [
            [38.4, 1.5],
            [39.4, 1],
            [42.7, 0],
          ]
        : [
            [38.4, 1.0],
            [38.8, 1.5],
            [39.3, 1.5],
            [39.8, 0.85],
            [40.4, 1.15],
            [41.1, 0.6],
            [42.0, 0.45],
            [42.7, 0],
          ],
      'roof',
    );
    spire(face, p, 42.7, 0.8, d);
    if (d >= 2)
      for (const e of edges(ring)) {
        const q = lerp(e.a, e.b, 0.5),
          h = hole(
            'balcony-medallion',
            q,
            e.axis,
            e.normal,
            0.55,
            28.0,
            0.55,
            0.275,
            'circle',
            0.5,
          );
        pane(face, h, 1, 0.03, 'wall');
      }
  }
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
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
  sides(face, plans.whole.outline, footing, 0.12, 'trim');
  cap(face, plans.whole.outline, 0.12, 'trim');
  wings(out, face, d);
  prayer(out, face, d);
  minarets(face, d);
}
export const buildOrtakoySkyline = (o) => build(o, 0),
  buildOrtakoyDistrict = (o) => build(o, 1),
  buildOrtakoyStreet = (o) => build(o, 2),
  buildOrtakoyCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const ortakoyStudy = {
  id: 'ortakoy_mosque',
  key: 'ortakoy_mosque',
  title: 'Ortaköy Mosque',
  category: 'mosque',
  wikidataId: 'Q176380',
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
    'Six existing256² limestone,continuous limestone,lime plaster,standing-seam metal,cast bronze and plain wood graphs;seven merged roles including local opaque glazing. Metric UVs,linear tints,zero embedded images or unique atlases. Original simplified medallion/pediment masses;no copied carving,calligraphy or baked lighting.',
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
    'No retained dimension facts. Every vertical height,roof/pediment profile,window/door/wing partition,small ornament and current finish is picture-proportioned. Exact raw16-point footprint and original anchor/heading are retained. Fine relief,calligraphy,grille patterns,sculpture and unseen interiors are omitted. Boats,piers,nearby businesses,bridges and cityscape remain host content. Runtime GLB contains no review water or terrain. Exact shore/quay/courtyard/stair/tidal contact,engineering and physical-device timings remain unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('waterfront-three-bay-facade', [61, 21, 24], [19, 10, 0]),
    cam('pink-entry-courtyard', [-35, 8, 0], [-10, 4, 0]),
    cam('curved-pediment-and-dome', [42, 30, 40], [10, 20, 0]),
    cam('corner-medallions-and-upper-windows', [39, 18, 29], [19, 16, 9]),
    cam('single-balcony-twin-minarets', [-24, 30, 44], [-3, 27, 0]),
    cam('north-up-footprint-and-rear-wings', [0, 175, 0.1], [0, 3, 0]),
  ],
};

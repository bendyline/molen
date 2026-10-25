/** Al Askari: mapped shrine core, gold bulb dome, twin minarets and marble iwan portico. */
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
  '../../../content/worldgen/source/places/sy/syp/al_askari_shrine/',
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
  wall: '#d0be99',
  trim: '#e0ddd2',
  gold: '#d6b766',
  tile: '#547c92',
  roof: '#bfb9aa',
  door: '#8f704c',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, askariGround(...p) - 0.35);
export function askariGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Al Askari footing outside retained terrain');
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
const _trimBand = (face, h, d, w = 0.26) => archBand(face, h, d, w, 'trim', 0.055);
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
function slab(face, r, b, t, slot = 'trim') {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
  _underside(face, r, b, slot);
}
function spire(face, p, base, h, d) {
  profile(
    face,
    circle(p, 0.19, d ? 8 : 4),
    d
      ? [
          [base, 1],
          [base + h * 0.25, 1.7],
          [base + h * 0.5, 0.7],
          [base + h * 0.65, 1.15],
          [base + h, 0.015],
        ]
      : [
          [base, 1],
          [base + h, 0],
        ],
    'gold',
  );
}
export function askariWallFields(d = 3) {
  if (!d) return [];
  const hs = [];
  for (const f of [
    { name: 'east', center: [28.1, -8], axis: [0, 1], normal: [1, 0] },
    { name: 'west', center: [-28.1, -8], axis: [0, 1], normal: [-1, 0] },
    { name: 'north', center: [0, -27.4], axis: [1, 0], normal: [0, -1] },
  ]) {
    const count = d === 1 ? 4 : 6,
      span = f.name === 'north' ? 49 : 32;
    for (let i = 0; i < count; i++) {
      const p = f.center.map((v, k) => v + f.axis[k] * (((i + 0.5) * span) / count - span / 2));
      hs.push({
        ...hole(
          `${f.name}-${i}`,
          p,
          f.axis,
          f.normal,
          d === 1 ? 3.6 : 2.8,
          2.3,
          5.8,
          3.6,
          'pointed',
          1.5,
        ),
        kind: 'glass',
      });
    }
  }
  for (let i = -1; i <= 1; i++)
    hs.push({
      ...hole(
        `portico-rear-door-${i}`,
        [i * 10, 12],
        [1, 0],
        [0, 1],
        4.5,
        0.2,
        7.7,
        4.7,
        'pointed',
        2.2,
      ),
      kind: 'door',
    });
  return hs;
}
export function askariPortal(_d = 3) {
  return hole(
    'front-gilded-iwan',
    [0, 25.45],
    [1, 0],
    [0, 1],
    12.2,
    0.2,
    16.2,
    9.8,
    'pointed',
    3.6,
  );
}
function finish(face, h, d) {
  pane(face, h, d, d === 1 ? 0.18 : -0.16, h.kind ?? 'glass');
  archBand(face, h, d, d === 1 ? 0.2 : 0.32, h.kind === 'door' ? 'tile' : 'trim', 0.07);
  if (d < 2) return;
  const q = prepareOpening(h, 0, d),
    offset = Math.sign(-q.axis[1] * h.normal[0] + q.axis[0] * h.normal[1]) * 0.07;
  for (const u of [-h.width * 0.23, h.width * 0.23])
    beam(
      face,
      q.point(u, h.bottom + 0.15, offset),
      q.point(u, h.bottom + h.spring - 0.1, offset),
      0.09,
      'trim',
    );
  beam(
    face,
    q.point(-h.width * 0.48, h.bottom + h.spring * 0.55, offset),
    q.point(h.width * 0.48, h.bottom + h.spring * 0.55, offset),
    0.09,
    'trim',
  );
}
function mainBody(out, face, d) {
  const hs = askariWallFields(d),
    r = plans.body;
  if (d >= 2) shell(out, d, r, 0.12, 12, hs);
  else sides(face, r, 0.12, 12, 'wall');
  cap(face, r, 12, 'roof');
  for (const h of hs) finish(face, h, d);
  band(face, r, 0.18, 0.22, 'trim', 1.005);
  band(face, r, 10.7, 0.45, 'trim', 1.005);
  band(face, r, 11.65, 0.35, 'trim', 1.008);
  if (d >= 2) {
    for (const e of edges(r)) {
      if (e.length < 20) continue;
      const n = Math.round(e.length / 8);
      for (let i = 1; i < n; i++) {
        const p = lerp(e.a, e.b, i / n);
        beam(face, at(p, 0.35), at(p, 10.6), 0.3, 'trim');
      }
    }
  }
}
function portico(out, face, d) {
  for (const r of plans.canopy) slab(face, r, 11.7, 12, 'trim');
  const h = askariPortal(d),
    r = rect(-8.8, 23.9, 8.8, 25.5);
  shell(out, d, r, 0.12, 18, [h], 'trim');
  cap(face, r, 18, 'trim');
  if (d > 0) {
    archBand(face, h, d, 0.6, 'tile', 0.12);
    archBand(
      face,
      {
        ...h,
        width: h.width + 1.8,
        height: h.height + 1.3,
        spring: h.spring + 0.8,
        bottom: h.bottom - 0.1,
      },
      d,
      0.25,
      'tile',
      0.13,
    );
  }
  for (let j = 0; j < (d === 0 ? 1 : d === 1 ? 2 : 4); j++) {
    const q = {
      ...h,
      width: h.width - j * 0.7,
      height: h.height - j * 0.45,
      bottom: h.bottom + 0.1,
      spring: h.spring - j * 0.2,
    };
    archBand(face, q, d, d === 0 ? 0.65 : 0.5, 'gold', -0.25 - j * 0.43);
  }
  if (d > 0) {
    pane(face, { ...h, width: 10.2, height: 14.3, spring: 8.7 }, d, -1.55, 'gold');
    for (let i = -1; i <= 1; i++)
      finish(
        face,
        {
          ...hole(
            `iwan-wood-door-${i}`,
            [i * 2.8, 24.2],
            [1, 0],
            [0, 1],
            2.1,
            0.3,
            4.5,
            3.2,
            'pointed',
            0.6,
          ),
          kind: 'door',
        },
        d,
      );
  }
  const columns = [
    [-25.5, 19.3],
    [-16.1, 26.3],
    [-10, 24.8],
    [10, 24.8],
    [16.1, 26.3],
    [25.4, 19.3],
  ];
  for (const p of columns) _column(face, p, 0.15, 11.7, d === 0 ? 0.6 : 0.5, d, 'trim');
  if (d > 0) {
    for (const r of plans.canopy) {
      for (const e of edges(r)) {
        if (e.length > 3) _openBand(face, e.a, e.b, 11.2, 0.5, 'trim', 0.18);
      }
    }
  }
  // The portico floor is the retained footprint; the forecourt remains host terrain.
}
function dome(_out, face, d) {
  const n = [8, 12, 20, 28, 32][d],
    r = circle(domePoint, 9.6, n);
  sides(face, r, 12, 17.2, 'tile');
  cap(face, r, 17.2, 'gold');
  if (d > 0) {
    band(face, r, 12.1, 0.3, 'gold');
    band(face, r, 16.7, 0.5, 'gold');
  }
  const profileLevels =
    d === 0
      ? [
          [17.2, 0.75],
          [22, 1],
          [28, 0.72],
          [33, 0],
        ]
      : d === 1
        ? [
            [17.2, 0.75],
            [20, 0.94],
            [23, 1],
            [27, 0.8],
            [30, 0.48],
            [33, 0],
          ]
        : [
            [17.2, 0.75],
            [18.8, 0.89],
            [20.7, 0.98],
            [22.6, 1],
            [24.7, 0.93],
            [27, 0.78],
            [29, 0.57],
            [30.7, 0.36],
            [32, 0.16],
            [33, 0.015],
          ];
  profile(face, circle(domePoint, 11.6, n), profileLevels, 'gold');
  spire(face, domePoint, 33, 2.5, d);
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI * 2) / 12,
        p = [domePoint[0] + 9.65 * Math.cos(a), domePoint[1] + 9.65 * Math.sin(a)],
        normal = [Math.cos(a), Math.sin(a)],
        axis = [-normal[1], normal[0]],
        h = hole(`drum-panel-${i}`, p, axis, normal, 1.5, 13.1, 2.9, 1.7, 'pointed', 0.5);
      pane(face, h, d, 0.08, 'tile');
      archBand(face, h, d, 0.15, 'gold', 0.12);
    }
}
function minarets(face, d) {
  const n = [6, 10, 16, 24, 28][d];
  for (const { center: p } of plans.minarets) {
    const r = circle(p, 2.35, n);
    solid(face, r, 0.12, 12, 'gold');
    profile(
      face,
      r,
      d === 0
        ? [
            [12, 1],
            [26.5, 0.83],
            [28.2, 1.45],
            [28.55, 1.45],
          ]
        : [
            [12, 1],
            [13.2, 0.85],
            [25.7, 0.85],
            [26.4, 0.94],
            [27.5, 1.35],
            [28.1, 1.5],
            [28.55, 1.5],
          ],
      'gold',
    );
    if (d > 0) {
      for (const y of [12.1, 25.6]) band(face, scaled(r, 0.86), y, 0.28, 'tile', 1.01);
    }
    const upper = circle(p, 1.42, n);
    sides(face, upper, 28.1, 34.55, 'gold');
    cap(face, upper, 34.55, 'gold');
    profile(
      face,
      upper,
      [
        [34.55, 1],
        [35.3, 0.8],
        [35.8, 0.4],
        [36, 0],
      ],
      'gold',
    );
    const outer = circle(p, 3.52, n),
      inner = circle(p, 3.16, n);
    if (d <= 1) {
      sides(face, outer, 28.5, 29.35, 'gold');
      sides(face, inner, 28.5, 29.35, 'gold', true);
      cap(face, outer, 29.35, 'gold', [inner]);
    } else {
      const rails = d === 2 ? 10 : 14;
      for (let i = 0; i < rails; i++) {
        const a = (i * Math.PI * 2) / rails,
          q = [p[0] + 3.35 * Math.cos(a), p[1] + 3.35 * Math.sin(a)];
        _column(face, q, 28.55, 29.35, 0.1, d, 'gold');
      }
      profile(
        face,
        outer,
        [
          [29.2, 1],
          [29.35, 1],
        ],
        'gold',
      );
      sides(face, inner, 29.2, 29.35, 'gold', true);
      cap(face, outer, 29.35, 'gold', [inner]);
    }
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
    whole = plans.whole.outline;
  sides(face, whole, footing, 0.12, 'wall');
  cap(face, whole, 0.12, 'trim');
  mainBody(out, face, d);
  portico(out, face, d);
  dome(out, face, d);
  minarets(face, d);
}
export const buildAskariSkyline = (o) => build(o, 0),
  buildAskariDistrict = (o) => build(o, 1),
  buildAskariStreet = (o) => build(o, 2),
  buildAskariCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const askariStudy = {
  id: 'al_askari_shrine',
  key: 'al_askari_shrine',
  title: 'Al-Askari Shrine',
  category: 'mosque',
  wikidataId: 'Q309484',
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
    'Six existing shared256² sandstone,marble,cast-bronze,mosaic,lime-plaster and wood graphs serve seven merged roles. Metric UVs,linear tints,no embedded images or unique facade art. Gold leaf uses a warm tint on shared neutral cast bronze. Simple nested facets abstract the gilded iwan;fine tile/calligraphy and temporary construction are omitted.',
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
    'Individual core only. Rear expansion,other domes and surrounding court buildings remain host content. Main mapped12m body and36m minaret heights retained;68m dome tag remains unresolved and is not represented as a surveyed height. Visualized dome35.5m is a picture estimate. No fine artwork,current construction-phase fidelity,furnished interiors,exact thresholds or engineering claim. Physical-device timings pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('gold-dome-and-blue-drum', [40, 32, 33], [0, 23, -5.6]),
    cam('gilded-iwan-and-marble-portico', [0, 10, 61], [0, 9, 24]),
    cam('single-balcony-gold-minarets', [39, 32, 51], [14.4, 29, 15.2]),
    cam('open-portico-and-rear-doors', [-31, 7, 43], [-14, 5, 16]),
    cam('north-and-side-window-rhythm', [-72, 27, -65], [-5, 7, -12]),
    cam('north-up-core-footprint', [0, 190, 0.1], [0, 7, 0]),
  ],
};

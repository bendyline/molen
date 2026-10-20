/** Moscow: golden onion dome, twin stepped minarets and turquoise lancet façades. */
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
  '../../../content/worldgen/source/places/uc/ucf/n0457_moscow_cathedral_mosque/',
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
  wall: '#dedbd1',
  trim: '#ece7da',
  stone: '#c8c3b7',
  roof: '#62a3a1',
  gold: '#f0d584',
  door: '#796b58',
  glass: '#3b999a',
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
const _lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
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
const footing = (p) => Math.min(-0.35, floor - 0.3, moscowGround(...p) - 0.35);
export function moscowGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Moscow footing outside retained terrain');
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
const _edges = (ring) =>
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

function onion(face, p, r, b, t, d, slot = 'gold') {
  const n = [8, 12, 20, 28, 32][d],
    levels =
      d <= 1
        ? [
            [0, 0.78],
            [0.25, 1],
            [0.62, 0.95],
            [0.86, 0.5],
            [1, 0],
          ]
        : [
            [0, 0.78],
            [0.12, 0.92],
            [0.3, 1],
            [0.5, 0.99],
            [0.68, 0.84],
            [0.82, 0.6],
            [0.94, 0.28],
            [1, 0],
          ];
  profile(
    face,
    circle(p, r, n),
    levels.map(([h, f]) => [b + (t - b) * h, f]),
    slot,
  );
}
function finial(face, p, b, top, d) {
  if (d <= 1) {
    profile(
      face,
      circle(p, 0.16, 4),
      [
        [b, 1],
        [top, 0],
      ],
      'gold',
    );
    return;
  }
  const y = top - 0.7,
    n = d === 2 ? 8 : d === 3 ? 16 : 24,
    outer = [],
    inner = [];
  for (let i = 0; i <= n; i++) {
    const a = ((60 + (i * 240) / n) * Math.PI) / 180;
    outer.push([p[0] + 0.7 * Math.cos(a), floor + y + 0.7 * Math.sin(a)]);
    inner.push([p[0] + 0.16 + 0.56 * Math.cos(a), floor + y + 0.56 * Math.sin(a)]);
  }
  beam(face, at(p, b), at(p, top - 1.0), 0.12, 'gold');
  const q = (p, z) => [p[0], p[1], z];
  for (let i = 0; i < n; i++) {
    for (const s of [-1, 1])
      face(
        'gold',
        [
          q(outer[i], p[1] + s * 0.09),
          q(outer[i + 1], p[1] + s * 0.09),
          q(inner[i + 1], p[1] + s * 0.09),
          q(inner[i], p[1] + s * 0.09),
        ],
        [0, 0, s],
      );
    face('gold', [
      q(outer[i], p[1] - 0.09),
      q(outer[i + 1], p[1] - 0.09),
      q(outer[i + 1], p[1] + 0.09),
      q(outer[i], p[1] + 0.09),
    ]);
    face('gold', [
      q(inner[i], p[1] - 0.09),
      q(inner[i + 1], p[1] - 0.09),
      q(inner[i + 1], p[1] + 0.09),
      q(inner[i], p[1] + 0.09),
    ]);
  }
  for (const i of [0, n])
    face('gold', [
      q(outer[i], p[1] - 0.09),
      q(inner[i], p[1] - 0.09),
      q(inner[i], p[1] + 0.09),
      q(outer[i], p[1] + 0.09),
    ]);
}
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return { a, b, axis, normal: [axis[1] * sign(r), -axis[0] * sign(r)] };
  });
function finish(face, h, d) {
  pane(face, h, d, d === 1 ? 0.16 : -0.15, h.kind ?? 'glass');
  if (d >= 2) {
    archBand(face, h, d, 0.38, 'trim', 0.05);
    archBand(
      face,
      {
        ...h,
        width: h.width + 0.8,
        height: h.height + 0.55,
        bottom: h.bottom - 0.18,
        spring: h.spring + 0.18,
      },
      d,
      0.18,
      'stone',
      0.06,
    );
    if (h.width > 3) {
      const q = prepareOpening(h, 0, d),
        off = 0.06 * Math.sign(-q.axis[1] * h.normal[0] + q.axis[0] * h.normal[1]);
      beam(
        face,
        q.point(0, h.bottom + 0.15, off),
        q.point(0, h.bottom + h.spring, off),
        0.12,
        'trim',
      );
    }
  }
}
export function moscowHallFields(d = 3) {
  if (d === 0) return [];
  const hs = [],
    n = d === 1 ? 3 : 5;
  for (const z of [-12.8, 25.25])
    for (let i = 0; i < n; i++) {
      let x = -19 + ((i + 0.5) * 39) / n;
      if (z > 0) {
        if (i === Math.floor(n / 2)) continue;
        x = d === 1 ? [-15, 1, 16][i] : [-16, -9, 1, 11, 18][i];
      }
      hs.push({
        ...hole(
          `hall-end-${z}-${i}`,
          [x, z],
          [1, 0],
          [0, z < 0 ? -1 : 1],
          d === 1 ? 3.2 : 4.5,
          3.4,
          15.6,
          11.3,
          'pointed',
          2,
        ),
        kind: z < 0 && i === Math.floor(n / 2) ? 'door' : 'glass',
      });
    }
  for (const x of [-33.3, 33.3])
    for (let i = 0; i < n; i++) {
      const z = -9 + ((i + 0.5) * 30) / n;
      hs.push({
        ...hole(
          `hall-side-${x}-${i}`,
          [x, z],
          [0, 1],
          [x < 0 ? -1 : 1, 0],
          d === 1 ? 3.1 : 4.0,
          3.5,
          15.4,
          11.3,
          'pointed',
          2,
        ),
        kind: 'glass',
      });
    }
  return hs;
}
export function moscowDrumFields(d = 3) {
  if (d < 1) return [];
  const n = d === 1 ? 8 : 12,
    p = plans.mainCenter,
    r = 12.5;
  return Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n,
      N = [Math.cos(a), Math.sin(a)];
    return hole(
      `main-drum-${i}`,
      [p[0] + r * N[0], p[1] + r * N[1]],
      [-N[1], N[0]],
      N,
      1.5,
      29,
      4.2,
      3,
      'round',
      1.4,
    );
  });
}
function parapet(face, r, b, h, d) {
  for (const e of edges(r)) {
    const width = 0.18,
      offset = (p) => p.map((v, k) => e.normal[k] * width + v),
      inset = (p) => p.map((v, k) => v - e.normal[k] * width);
    solid(face, [offset(e.a), offset(e.b), inset(e.b), inset(e.a)], b, b + h, 'trim');
    if (d >= 3) {
      const len = Math.hypot(...e.b.map((v, k) => v - e.a[k])),
        n = Math.max(1, Math.round(len / 1.5));
      for (let i = 0; i <= n; i++) {
        const q = e.a.map((v, k) => v + ((e.b[k] - v) * i) / n);
        solid(
          face,
          rect(q[0] - 0.14, q[1] - 0.14, q[0] + 0.14, q[1] + 0.14),
          b,
          b + h + 0.25,
          'trim',
        );
      }
    }
  }
}
function hall(out, face, d) {
  const hs = moscowHallFields(d),
    r = plans.whole.outline;
  if (d >= 2) shell(out, d, r, 0.12, 22, hs, 'wall');
  else solid(face, r, 0.12, 22, 'wall');
  for (const h of hs) finish(face, h, d);
  cap(face, r, 22, 'roof');
  if (d >= 1) {
    band(face, r, 1.3, 0.45, 'stone');
    band(face, r, 20.4, 0.55);
    band(face, r, 21.5, 0.55);
    parapet(face, scaled(r, 1.01), 22, 0.75, d);
  }
  const p = plans.mainCenter,
    podium = rect(-18, -12.5, 20, 24.7);
  solid(face, podium, 22, 26, 'wall');
  cap(face, podium, 26, 'roof');
  if (d >= 1) {
    band(face, podium, 25.4, 0.55);
    parapet(face, podium, 26, 0.65, d);
  }
  const drum = circle(p, 12.5, [8, 12, 20, 28, 32][d]),
    windows = moscowDrumFields(d);
  solid(face, circle(p, 14.2, d <= 1 ? 8 : 16), 26, 28, 'stone');
  if (d >= 2) shell(out, d, drum, 28, 35, windows);
  else solid(face, drum, 28, 35, 'wall');
  for (const h of windows) finish(face, h, d);
  if (d >= 1) band(face, drum, 34.5, 0.45, 'trim', 1.03);
  onion(face, p, 12, 35, 47, d);
  finial(face, p, 47, 50, d);
  if (d >= 1)
    for (const z of [-8, 22]) {
      const q = [1, z];
      solid(face, circle(q, 2.2, d === 1 ? 6 : 12), 26, 28, 'trim');
      onion(face, q, 2.4, 28, 30.6, d, 'roof');
      if (d >= 2) finial(face, q, 30.6, 31.8, d);
    }
  // The projecting bay keeps its glazing in front of the continuous rear cornices.
  if (d >= 1) {
    const z = 26.3,
      back = 24.4,
      r = rect(-5, back, 7, z),
      h = moscowGableField();
    if (d >= 2) shell(out, d, r, footing, 24.5, [h]);
    else solid(face, r, footing, 24.5, 'wall');
    finish(face, h, d);
    cap(face, r, 24.5, 'roof');
    face('wall', [at([-5, z], 24.5), at([7, z], 24.5), at([1, z], 30)], [0, 0, 1]);
    face('wall', [at([-5, back], 24.5), at([7, back], 24.5), at([1, back], 30)], [0, 0, -1]);
    face('roof', [at([-5, z], 24.5), at([1, z], 30), at([1, back], 30), at([-5, back], 24.5)]);
    face('roof', [at([1, z], 30), at([7, z], 24.5), at([7, back], 24.5), at([1, back], 30)]);
  }
}
export const moscowGableField = () => ({
  ...hole('south-gable-lancet', [1, 26.3], [1, 0], [0, 1], 4.8, 3.5, 21, 16, 'pointed', 2.8),
  kind: 'glass',
});
export function moscowTowerFields(d = 3) {
  if (d < 1) return [];
  const hs = [];
  for (const [i, p] of plans.towers.entries()) {
    const base = rect(p[0] - 4.3, p[1] - 4.7, p[0] + 4.3, p[1] + 4.7);
    for (const [eid, e] of edges(base).entries()) {
      const q = e.a.map((v, k) => (v + e.b[k]) / 2);
      hs.push({
        ...hole(`tower-base-${i}-${eid}`, q, e.axis, e.normal, 3.1, 3, 22, 17, 'pointed', 1.8),
        kind: 'glass',
      });
    }
    for (const [j, [r, b, t]] of [
      [3.7, 33, 48],
      [2.8, 50, 61],
      [2.0, 63, 69],
    ].entries()) {
      const ring = circle(p, r, 8);
      for (const [k, e] of edges(ring).entries())
        hs.push({
          ...hole(
            `tower-tier-${i}-${j}-${k}`,
            e.a.map((v, k) => (v + e.b[k]) / 2),
            e.axis,
            e.normal,
            r * 0.66,
            b + 1,
            t - b - 2,
            t - b - 4,
            'pointed',
            1.2,
          ),
          kind: 'glass',
          tower: i,
          tier: j,
        });
    }
  }
  return hs;
}
function towers(out, face, d) {
  const all = moscowTowerFields(d);
  for (const [i, p] of plans.towers.entries()) {
    const base = rect(p[0] - 4.3, p[1] - 4.7, p[0] + 4.3, p[1] + 4.7),
      hs = all.filter((h) => h.name.startsWith(`tower-base-${i}-`));
    if (d >= 2) shell(out, d, base, 0.12, 31, hs, 'stone');
    else solid(face, base, 0.12, 31, 'stone');
    for (const h of hs) finish(face, h, d);
    if (d >= 1) {
      band(face, base, 26.5, 0.55);
      band(face, base, 29.5, 0.55);
      parapet(face, scaled(base, 1.12), 31, 1.05, d);
    }
    for (const [j, [r, b, t]] of [
      [3.7, 33, 48],
      [2.8, 50, 61],
      [2.0, 63, 69],
    ].entries()) {
      const ring = circle(p, r, 8),
        windows = all.filter((h) => h.tower === i && h.tier === j);
      profile(
        face,
        ring,
        [
          [b - 2, 1.18],
          [b, 1],
        ],
        'trim',
      );
      if (d >= 2) shell(out, d, ring, b, t, windows, 'stone');
      else solid(face, ring, b, t, 'stone');
      for (const h of windows) finish(face, h, d);
      profile(
        face,
        ring,
        [
          [t, 1],
          [t + 0.6, 1.18],
          [t + 1.1, 1.18],
        ],
        'trim',
      );
    }
    profile(
      face,
      circle(p, 2.45, d <= 1 ? 6 : 12),
      [
        [70.1, 1],
        [78, 0],
      ],
      'gold',
    );
    finial(face, p, 78, 80, d);
  }
}
function turrets(_out, face, d) {
  for (const q of plans.turrets) {
    const p = q.center,
      b = q.gold ? 35 : 29,
      r = circle(p, 3.4, d <= 1 ? 8 : 16);
    solid(face, r, 0.12, b, 'stone');
    if (d >= 1) {
      for (const e of edges(circle(p, 3.4, 8))) {
        const h = hole(
          'corner-turret',
          e.a.map((v, k) => (v + e.b[k]) / 2),
          e.axis,
          e.normal,
          1.5,
          b - 9,
          7.5,
          5.6,
          'pointed',
          1.2,
        );
        pane(face, h, d, 0.08);
        if (d >= 2) archBand(face, h, d, 0.2, 'trim', 0.14);
      }
      band(face, r, b - 1, 0.5, 'trim', 1.08);
    }
    onion(face, p, 3.8, b, q.top - 1.5, d, q.gold ? 'gold' : 'roof');
    finial(face, p, q.top - 1.5, q.top, d);
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
    r = plans.whole.outline;
  sides(face, r, footing, 0.12, 'stone');
  cap(face, r, 0.12, 'stone');
  hall(out, face, d);
  towers(out, face, d);
  turrets(out, face, d);
}
export const buildMoscowSkyline = (o) => build(o, 0),
  buildMoscowDistrict = (o) => build(o, 1),
  buildMoscowStreet = (o) => build(o, 2),
  buildMoscowCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const moscowStudy = {
  id: 'N0457',
  key: 'moscow_cathedral_mosque',
  title: 'Moscow Cathedral Mosque',
  category: 'mosque',
  wikidataId: 'Q3679864',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Reference photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared 256² stucco, marble, continuous limestone, standing-seam metal, cast bronze and wood graphs serve seven merged roles including opaque turquoise window fields. Metric UVs, linear tints, no embedded images, unique facade atlases or copied calligraphy.',
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
    'Individual modern main mosque; the separate northern low building stays host content. All heights, tower/cap positions, roof subdivisions and facade rhythms are estimates. Opaque turquoise panes and shallow door fields stop before unseen interiors. Fine calligraphy, lattice/art, actual baluster patterns, detailed crescents, current finish, engineering and physical-device timings remain unverified. Near finials use original chunky crescent silhouettes; far levels use spikes.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('broad-golden-onion-and-drum', [45, 62, 58], [1, 37, 7]),
    cam('two-stacked-western-minarets', [-78, 58, 70], [-28, 54, 0]),
    cam('turquoise-lancets-and-south-gable', [9, 13, 58], [1, 16, 25.3]),
    cam('smaller-gold-and-teal-turrets', [68, 40, 5], [28, 27, 0]),
    cam('cornices-and-window-tiers', [-48, 47, 43], [-28, 43, 20]),
    cam('north-up-main-outline-and-indent', [0, 255, 0.1], [0, 8, 0]),
  ],
};

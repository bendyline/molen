/** Sheikh Zayed Mosque: mapped white domes, keyhole colonnades and four staged minarets. */
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
  '../../../content/worldgen/source/places/th/thq/n0424_sheikh_zayed_mosque/',
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
  wall: '#eeeae3',
  trim: '#b7c4c6',
  roof: '#e5e4dc',
  door: '#705d4c',
  gold: '#bda46a',
  glass: '#52636b',
  water: '#4a8897',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, zayedGround(...p) - 0.35);
export function zayedGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Sheikh Zayed Mosque footing outside retained terrain');
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
function facetedRecesses(face, ring, bottom, top, fields, d) {
  for (const e of edges(ring)) {
    const midpoint = lerp(e.a, e.b, 0.5);
    const h = fields.find((h) => Math.hypot(...h.center.map((v, k) => v - midpoint[k])) < 1e-5);
    if (!h) {
      face(
        'wall',
        [at(e.a, bottom), at(e.b, bottom), at(e.b, top), at(e.a, top)],
        [e.normal[0], 0, e.normal[1]],
      );
      continue;
    }
    const outer = [
      [-e.length / 2, floor + bottom],
      [e.length / 2, floor + bottom],
      [e.length / 2, floor + top],
      [-e.length / 2, floor + top],
    ];
    const aperture = openingShape(h, d),
      points = [...outer, ...aperture];
    const indices = earcut(points.flat(), [outer.length], 2);
    const point = ([u, y], depth = 0) => [
      h.center[0] + h.axis[0] * u + h.normal[0] * depth,
      y,
      h.center[1] + h.axis[1] * u + h.normal[1] * depth,
    ];
    for (let i = 0; i < indices.length; i += 3)
      face(
        'wall',
        indices.slice(i, i + 3).map((j) => point(points[j])),
        [h.normal[0], 0, h.normal[1]],
      );
    const orientation = sign(aperture);
    for (let i = 0; i < aperture.length; i++) {
      const a = aperture[i],
        b = aperture[(i + 1) % aperture.length],
        du = b[0] - a[0],
        dy = b[1] - a[1];
      face(
        'wall',
        [point(a), point(b), point(b, -(h.inset ?? 0.24)), point(a, -(h.inset ?? 0.24))],
        [-dy * h.axis[0] * orientation, du * orientation, -dy * h.axis[1] * orientation],
      );
    }
  }
}
function openLantern(face, ring, inside, fields, d) {
  const innerEdges = edges(inside);
  for (const [i, e] of edges(ring).entries()) {
    const mid = lerp(e.a, e.b, 0.5),
      h = fields.find((h) => Math.hypot(...h.center.map((v, k) => v - mid[k])) < 1e-5);
    const aperture = openingShape(h, d),
      inner = innerEdges[i],
      innerMid = lerp(inner.a, inner.b, 0.5);
    const depth = mid.reduce((n, v, k) => n + (v - innerMid[k]) * e.normal[k], 0);
    const P = ([u, y], offset) => [
      mid[0] + e.axis[0] * u + e.normal[0] * offset,
      y,
      mid[1] + e.axis[1] * u + e.normal[1] * offset,
    ];
    for (const [length, offset, side] of [
      [e.length, 0, 1],
      [inner.length, -depth, -1],
    ]) {
      const rectangle = [
        [-length / 2, floor + 94.4],
        [length / 2, floor + 94.4],
        [length / 2, floor + 101],
        [-length / 2, floor + 101],
      ];
      const points = [...rectangle, ...aperture],
        indices = earcut(points.flat(), [4], 2);
      for (let j = 0; j < indices.length; j += 3)
        face(
          'wall',
          indices.slice(j, j + 3).map((k) => P(points[k], offset)),
          [e.normal[0] * side, 0, e.normal[1] * side],
        );
    }
    const orientation = sign(aperture);
    for (let j = 0; j < aperture.length; j++) {
      const a = aperture[j],
        b = aperture[(j + 1) % aperture.length],
        du = b[0] - a[0],
        dy = b[1] - a[1];
      face(
        'wall',
        [P(a, 0), P(b, 0), P(b, -depth), P(a, -depth)],
        [-dy * e.axis[0] * orientation, du * orientation, -dy * e.axis[1] * orientation],
      );
    }
  }
  cap(face, ring, 101, 'wall', [inside]);
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
      return [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
    });
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      length: Math.hypot(...b.map((v, k) => v - a[k])),
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
function keyhole(h, d) {
  const w = h.width / 2,
    n = d === 1 ? 4 : d === 2 ? 4 : 12,
    cy = h.bottom + h.height - w * 0.75,
    ry = w * 0.75,
    a = -0.7,
    points = [
      [-w * Math.cos(a), h.bottom],
      [w * Math.cos(a), h.bottom],
    ];
  for (let i = 0; i <= n; i++) {
    const t = a + (i * (Math.PI - 2 * a)) / n;
    points.push([w * Math.cos(t), cy + ry * Math.sin(t)]);
  }
  return points;
}
function panel(face, h, half, bottom, top, depth, d, slot = 'wall') {
  const aperture = h.shape === 'keyhole' ? keyhole(h, d) : openingShape(h, d),
    P = ([u, y], v) => [
      h.center[0] + h.axis[0] * u + h.normal[0] * v,
      y,
      h.center[1] + h.axis[1] * u + h.normal[1] * v,
    ];
  for (const [offset, s] of [
    [0, 1],
    [-depth, -1],
  ]) {
    const bounds = [
        [-half, floor + bottom],
        [half, floor + bottom],
        [half, floor + top],
        [-half, floor + top],
      ],
      points = [...bounds, ...aperture],
      ids = earcut(points.flat(), [4], 2);
    for (let i = 0; i < ids.length; i += 3)
      face(
        slot,
        ids.slice(i, i + 3).map((j) => P(points[j], offset)),
        [h.normal[0] * s, 0, h.normal[1] * s],
      );
  }
  for (let i = 0; i < aperture.length; i++) {
    const a = aperture[i],
      b = aperture[(i + 1) % aperture.length],
      du = b[0] - a[0],
      dy = b[1] - a[1],
      s = sign(aperture);
    face(
      slot,
      [P(a, 0), P(b, 0), P(b, -depth), P(a, -depth)],
      [-dy * h.axis[0] * s, du * s, -dy * h.axis[1] * s],
    );
  }
}
function finial(face, p, y, h, d) {
  profile(
    face,
    circle(p, d === 0 ? 0.16 : 0.28, d <= 1 ? 4 : 6),
    d <= 2
      ? [
          [y, 0.4],
          [y + h * 0.35, 1],
          [y + h, 0],
        ]
      : [
          [y, 0.45],
          [y + h * 0.15, 1],
          [y + h * 0.3, 0.5],
          [y + h * 0.47, 0.85],
          [y + h * 0.65, 0.3],
          [y + h, 0],
        ],
    'gold',
  );
}
function onion(face, p, r, base, height, d, small = false) {
  const levels = [
      [0, 0.72],
      [0.18, 0.94],
      [0.4, 1.04],
      [0.63, 0.91],
      [0.84, 0.59],
      [1, 0],
    ],
    n =
      d === 0
        ? 6
        : d === 1
          ? 4
          : d === 2
            ? small
              ? 6
              : 12
            : d === 3
              ? small
                ? 12
                : 24
              : small
                ? 16
                : 28,
    ls =
      d === 0
        ? [levels[0], levels[2], levels[5]]
        : d === 1 || (d === 2 && small)
          ? [levels[0], levels[2], levels[4], levels[5]]
          : levels;
  profile(
    face,
    circle(p, r, n),
    ls.map(([y, s]) => [base + y * height, s]),
    'roof',
  );
}
export function zayedHallFields(d = 3) {
  if (d === 0) return [];
  const h = [hole('hall-main', [-14.3, -0.3], [0, 1], [1, 0], 12, 0, 23, 14, 'pointed', 12)];
  for (const z of [-59, -43, -27, 27, 43, 59])
    h.push(hole(`hall-side-${z}`, [-17.5, z], [0, 1], [1, 0], 6.5, 1.0, 15, 9, 'pointed', 3));
  for (const v of h) {
    v.kind = 'door';
    v.inset = 0.6;
  }
  return h;
}
export function zayedGateFields(d = 3) {
  if (d === 0) return [];
  return [
    hole('east-gate', [120.7, -0.55], [0, 1], [1, 0], 10.8, 0, 24, 15, 'pointed', 20),
    hole('east-gate-court', [102.1, -0.55], [0, 1], [-1, 0], 10.8, 0, 24, 15, 'pointed', 20),
  ].map((h) => ({ ...h, kind: 'door', inset: 0.6 }));
}
export function zayedCourtArches(d = 3) {
  if (d === 0) return [];
  const list = [];
  for (const line of plans.arcadeLines) {
    const axis = unit(line.b.map((v, k) => v - line.a[k])),
      length = Math.hypot(...line.b.map((v, k) => v - line.a[k])),
      n = Math.round(length / 6.8);
    for (let i = 0; i < n; i++) {
      const center = lerp(line.a, line.b, (i + 0.5) / n);
      list.push({
        ...hole(
          `${line.name}-${i}`,
          center,
          axis,
          line.normal,
          Math.min(5.2, length / n - 1.3),
          7.2,
          5.4,
          8,
          'keyhole',
          line.depth,
        ),
        half: length / n / 2,
        span: line.depth,
      });
    }
  }
  return list;
}
export function zayedLanternArches(d = 3) {
  if (d < 2) return [];
  return plans.minarets.flatMap((m, j) =>
    edges(circle(m.center, 2.5, 8)).map((e, i) => ({
      ...hole(
        `lantern-${j}-${i}`,
        lerp(e.a, e.b, 0.5),
        e.axis,
        e.normal,
        e.length * 0.65,
        94.4,
        6.2,
        3.4,
        'pointed',
        1.2,
      ),
      half: e.length / 2,
    })),
  );
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.04 : -(h.inset ?? 0.3), h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) archBand(face, h, d, 0.28, 'trim', 0.07);
  }
}
function hall(out, face, d) {
  const fields = zayedHallFields(d),
    hs = d >= 2 ? fields.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)) : [],
    maskedFace = writer(masked(out, hs), d);
  sides(maskedFace, plans.hall, footing, 33, 'wall');
  cap(maskedFace, plans.hall, 33, 'roof');
  solid(maskedFace, plans.portal, 0, 33, 'wall');
  solid(face, rect(-15.4, -15.4, -12.9, -12.6), 0, 34.8, 'wall');
  solid(face, rect(-15.4, 12.0, -12.9, 14.8), 0, 34.8, 'wall');
  solid(face, rect(-15.4, -15.4, -12.9, 14.8), 32.2, 34.8, 'wall');
  solid(maskedFace, rect(-118.4, -10.1, -104.9, 13), footing, 33, 'wall');
  if (d) finish(face, fields, d);
  if (d >= 2) {
    for (const z of [-70, -54, -38, 38, 54, 70])
      for (const x of [-105, -17.5]) {
        const normal = x === -105 ? [-1, 0] : [1, 0],
          h = hole('side-light', [x, z], [0, 1], normal, 3.8, 22, 7.5, 4, 'pointed', 1);
        pane(face, h, d, 0.04, 'glass');
        archBand(face, h, d, 0.22, 'wall', 0.06);
      }
    solid(face, rect(-24.9, -15.4, -13.95, -14.8), 33, 34.3, 'trim');
    solid(face, rect(-24.9, 14.2, -13.95, 14.8), 33, 34.3, 'trim');
  }
}
function roofDomes(_out, face, d) {
  for (const m of plans.domes) {
    if (d === 0 && m.nominalMapHeight < 50) continue;
    const base = m.base,
      top = m.top;
    const h = top - base - m.finial,
      n = d <= 1 ? 4 : d === 2 ? 8 : d === 3 ? 20 : 24,
      ring = circle(m.center, m.radius * 0.72, n),
      roofBase = m.center[0] < -17.5 ? 33 : 17;
    if (d >= 2 && m.radius > 7) {
      const fields = edges(ring)
        .map((e, i) => ({
          ...hole(
            `drum-${m.id}-${i}`,
            lerp(e.a, e.b, 0.5),
            e.axis,
            e.normal,
            e.length * 0.5,
            Math.max(roofBase + 0.6, base - 6.8),
            Math.min(5.4, base - roofBase - 1.2),
            2.8,
            'pointed',
            0.6,
          ),
          inset: 0.2,
        }))
        .filter((h) => h.height > 1);
      facetedRecesses(face, ring, roofBase, base, fields, d);
      for (const h of fields) {
        pane(face, h, d, -0.2, 'glass');
      }
      cap(face, ring, base, 'roof');
    } else solid(face, ring, roofBase, base, 'wall');
    onion(face, m.center, m.radius, base, h, d, m.radius < 9);
    if (d) finial(face, m.center, top - m.finial, m.finial, d);
  }
  if (d >= 2)
    for (const m of plans.unmappedCaps) {
      onion(face, m.center, m.radius, m.base, m.height, d, true);
      if (d >= 3) finial(face, m.center, m.base + m.height, m.finial, d);
    }
}
function capitals(face, p, y, d) {
  profile(
    face,
    circle(p, 0.5, d <= 2 ? 4 : 6),
    d === 2
      ? [
          [y, 0.55],
          [y + 1, 1.7],
        ]
      : [
          [y, 0.55],
          [y + 0.5, 1.25],
          [y + 1, 1.7],
        ],
    'gold',
  );
  if (d >= 3)
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        q = [p[0] + Math.cos(a) * 0.52, p[1] + Math.sin(a) * 0.52];
      face(
        'gold',
        [
          at(p, y + 0.2),
          at([q[0] - 0.16 * Math.sin(a), q[1] + 0.16 * Math.cos(a)], y + 0.9),
          at([q[0] + 0.16 * Math.sin(a), q[1] - 0.16 * Math.cos(a)], y + 0.9),
        ],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
}
function colonnades(face, d) {
  const columnKeys = new Set();
  const fields = zayedCourtArches(d);
  if (d === 0) {
    for (const line of plans.arcadeLines) {
      const _axis = unit(line.b.map((v, k) => v - line.a[k])),
        r = [
          line.a,
          line.b,
          line.b.map((v, k) => v - line.normal[k] * line.depth),
          line.a.map((v, k) => v - line.normal[k] * line.depth),
        ];
      solid(face, r, 0, 17, 'wall');
    }
    return;
  }
  for (const h of fields) {
    if (d === 1) {
      const r = [
        h.center.map((v, k) => v - h.axis[k] * h.half),
        h.center.map((v, k) => v + h.axis[k] * h.half),
        h.center.map((v, k) => v + h.axis[k] * h.half - h.normal[k] * h.span),
        h.center.map((v, k) => v - h.axis[k] * h.half - h.normal[k] * h.span),
      ];
      solid(face, r, 0, 17, 'wall');
      face(
        'glass',
        keyhole(h, d).map(([u, y]) => [
          h.center[0] + h.axis[0] * u + h.normal[0] * 0.05,
          y,
          h.center[1] + h.axis[1] * u + h.normal[1] * 0.05,
        ]),
        [h.normal[0], 0, h.normal[1]],
      );
      continue;
    }
    for (const outer of [false, true]) {
      const current = outer
        ? {
            ...h,
            center: h.center.map((v, k) => v - h.normal[k] * h.span),
            normal: h.normal.map((v) => -v),
          }
        : h;
      panel(face, current, h.half, 7.2, 17, 0.6, d);
    }
    const a = h.center.map((v, k) => v - h.axis[k] * h.half),
      b = h.center.map((v, k) => v + h.axis[k] * h.half),
      r = [
        a,
        b,
        b.map((v, k) => v - h.normal[k] * h.span),
        a.map((v, k) => v - h.normal[k] * h.span),
      ];
    cap(face, r, 17, 'roof');
    face(
      'wall',
      r.map((p) => at(p, 14.7)),
      [0, -1, 0],
    );
    for (const edge of [-1, 1])
      for (const row of [0, 1]) {
        const axisOffset = edge * h.half,
          depth = row * (h.span - 0.9) + 0.45,
          p = h.center.map((v, k) => v + h.axis[k] * axisOffset - h.normal[k] * depth);
        const ck = p.map((v) => v.toFixed(3)).join(',');
        if (columnKeys.has(ck)) continue;
        columnKeys.add(ck);
        const columns = d >= 3 ? [-0.28, 0.28] : [0];
        for (const delta of columns) {
          const q = p.map((v, k) => v + h.axis[k] * delta);
          solid(face, circle(q, d >= 3 ? 0.24 : 0.36, d >= 3 ? 8 : 4), 0, 6.2, 'wall');
          capitals(face, q, 6.2, d);
        }
        if (d >= 3)
          solid(face, rect(p[0] - 0.66, p[1] - 0.55, p[0] + 0.66, p[1] + 0.55), 0, 0.28, 'trim');
      }
  }
  if (d >= 2)
    for (const line of plans.arcadeLines) {
      const length = Math.hypot(...line.b.map((v, k) => v - line.a[k])),
        n = Math.round(length / (d === 2 ? 8 : 2));
      for (let i = 0; i <= n; i++) {
        const p = lerp(line.a, line.b, i / n);
        profile(
          face,
          circle(p, 0.4, 4),
          [
            [17, 0.9],
            [17.7, 1],
            [18.6, 0],
          ],
          'wall',
        );
      }
    }
}
function gate(out, face, d) {
  const fields = zayedGateFields(d),
    f = writer(
      masked(out, d >= 2 ? fields.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)) : []),
      d,
    );
  solid(f, plans.eastGate, footing, 33, 'wall');
  if (d) finish(face, fields, d);
  if (d >= 2)
    for (const x of [102.05, 120.75])
      for (const z of [-12, 11]) {
        const h = hole(
          'gate-panel',
          [x, z],
          [0, 1],
          x < 110 ? [-1, 0] : [1, 0],
          3.1,
          4,
          19,
          12,
          'pointed',
          1,
        );
        pane(face, h, d, 0.04, 'glass');
        archBand(face, h, d, 0.25, 'trim', 0.06);
      }
}
function minaret(face, m, j, d) {
  const p = m.center;
  if (d === 0) {
    profile(
      face,
      circle(p, 3.1, 4),
      [
        [0, 1],
        [49, 1],
        [68, 0.8],
        [72, 1.8],
        [74, 0.64],
        [91, 0.64],
        [94, 1.25],
        [101, 0.65],
        [107, 0],
      ],
      'wall',
    );
    return;
  }
  const square = rect(p[0] - 3.1, p[1] - 3.1, p[0] + 3.1, p[1] + 3.1);
  solid(face, square, footing, 49, 'wall');
  if (d >= 3)
    for (const e of edges(square)) {
      const h = hole(
        'tower-panel',
        lerp(e.a, e.b, 0.5),
        e.axis,
        e.normal,
        3.5,
        7,
        34,
        31,
        'pointed',
        1,
      );
      pane(face, h, d, 0.035, 'trim');
      archBand(face, h, d, 0.18, 'wall', 0.05);
    }
  profile(
    face,
    circle(p, 3.4, 8),
    [
      [49, 1],
      [51, 1],
      [65, 0.77],
      [68, 0.77],
    ],
    'wall',
  );
  profile(
    face,
    circle(p, 5.6, d === 1 ? 4 : 8),
    [
      [68, 0.46],
      [70, 0.75],
      [72, 1],
      [73, 1],
    ],
    'wall',
  );
  solid(face, circle(p, 2.05, d === 1 ? 6 : 12), 73, 91, 'wall');
  profile(
    face,
    circle(p, 4, d === 1 ? 4 : 12),
    [
      [91, 0.5],
      [92, 1],
      [94, 1],
    ],
    'wall',
  );
  if (d >= 2) {
    const fields = zayedLanternArches(d).filter((h) => h.name.startsWith(`lantern-${j}-`)),
      ring = circle(p, 2.5, 8),
      inner = circle(p, 1.8, 8);
    openLantern(face, ring, inner, fields, d);
    cap(face, ring, 94.4, 'wall');
    if (d >= 3) {
      for (const y of [25, 41])
        for (const e of edges(square)) {
          const center = lerp(e.a, e.b, 0.5).map((v, k) => v + e.normal[k] * 0.38),
            axis = e.axis;
          solid(
            face,
            [
              center.map((v, k) => v - axis[k] * 1.4),
              center.map((v, k) => v + axis[k] * 1.4),
              center.map((v, k) => v + axis[k] * 1.4 + e.normal[k] * 0.7),
              center.map((v, k) => v - axis[k] * 1.4 + e.normal[k] * 0.7),
            ],
            y,
            y + 0.35,
            'wall',
          );
          for (const u of [-1.2, 0, 1.2]) {
            const q = center.map((v, k) => v + axis[k] * u + e.normal[k] * 0.7);
            beam(face, at(q, y + 0.35), at(q, y + 1.6), 0.13, 'gold');
          }
        }
      for (const y of [72.8, 93.9]) {
        const r = y < 80 ? 5.15 : 3.65,
          n = y < 80 ? 16 : 12;
        for (let i = 0; i < n; i++) {
          const a = (i * Math.PI * 2) / n,
            q = [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
          beam(face, at(q, y), at(q, y + 1), 0.12, 'gold');
        }
        const outer = circle(p, r + 0.1, n),
          inside = circle(p, r - 0.1, n);
        sides(face, outer, y + 0.85, y + 1.05, 'gold');
        sides(face, inside, y + 0.85, y + 1.05, 'gold', true);
        cap(face, outer, y + 1.05, 'gold', [inside]);
      }
    }
  } else solid(face, circle(p, 2.5, 4), 94, 101, 'wall');
  onion(face, p, 2.8, 101, 4.5, d, true);
  finial(face, p, 105.5, 1.5, d);
}
function groundwork(face, d) {
  sides(face, plans.site, footing, 0.02, 'trim');
  cap(face, plans.site, 0.02, 'trim', d <= 1 ? [] : rec.pools.map((p) => p.outline));
  for (const pool of rec.pools) {
    if (d >= 2) sides(face, pool.outline, -0.8, 0.04, 'wall', true);
    cap(face, pool.outline, d <= 1 ? 0.04 : -0.35, 'water', pool.holes);
  }
  if (d >= 2) {
    for (let x = -10; x < 95; x += 14)
      for (let z = -62; z < 70; z += 14) {
        const tint = Math.round(x + z) % 3 === 0 ? colors.roof : colors.wall;
        face(
          'trim',
          rect(x - 0.07, z - 6.6, x + 0.07, z + 6.6).map((p) => at(p, 0.028)),
          [0, 1, 0],
          tint,
        );
        face(
          'trim',
          rect(x - 6.6, z - 0.07, x + 6.6, z + 0.07).map((p) => at(p, 0.028)),
          [0, 1, 0],
          tint,
        );
      }
    if (d >= 3)
      for (const p of [
        [10, 0],
        [42, 0],
        [74, 0],
      ])
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4,
            q = [p[0] + Math.cos(a) * 3.8, p[1] + Math.sin(a) * 3.8],
            axis = [Math.cos(a), Math.sin(a)];
          face(
            'trim',
            [
              at(p, 0.032),
              at([q[0] - axis[1] * 0.8, q[1] + axis[0] * 0.8], 0.032),
              at([q[0] + axis[0] * 1.4, q[1] + axis[1] * 1.4], 0.032),
              at([q[0] + axis[1] * 0.8, q[1] - axis[0] * 0.8], 0.032),
            ],
            [0, 1, 0],
            colors.glass,
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
            const n = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (n > length) {
              length = n;
              k = i;
            }
          }
          // The viewer rasterizes triangle bounds. Keep the separate west pavilion outside them.
          const nearWestPavilion =
            Math.min(...p.map((q) => q[0])) < -125 &&
            Math.max(...p.map((q) => q[0])) > -145 &&
            Math.min(...p.map((q) => q[2])) < -35 &&
            Math.max(...p.map((q) => q[2])) > -51;
          if (length > (nearWestPavilion ? 16 : d === 0 ? 90 : d === 1 ? 70 : d === 2 ? 40 : 28)) {
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
  groundwork(face, d);
  hall(out, face, d);
  colonnades(face, d);
  gate(out, face, d);
  roofDomes(out, face, d);
  for (const [j, m] of plans.minarets.entries()) minaret(face, m, j, d);
}
export const buildZayedSkyline = (o) => build(o, 0),
  buildZayedDistrict = (o) => build(o, 1),
  buildZayedStreet = (o) => build(o, 2),
  buildZayedCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const zayedStudy = {
  id: 'N0424',
  key: 'sheikh_zayed_mosque',
  title: 'Sheikh Zayed Mosque',
  category: 'mosque',
  wikidataId: 'Q695604',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Three existing shared256² marble,wood and bronze graphs;six merged groups including local glazing and pool water. Walls,domes and paving share marble with original linear tints. Gold palm capitals/finials share bronze. Metric UVs;zero embedded images,baked lighting,unique facade art or copied lettering/floral artwork.',
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
    'Individual medium-fi exterior from four actually inspected2013/2018 facade/court/colonnade/minaret pictures and standard viewer PMTiles/DEM. Dome centers/radii and pool components follow retained controls;4minarets,cadence,heights and smaller unmapped caps estimated. Keyhole galleries/open lanterns are exterior voids;main-hall/gate fields terminate closed,no enclosed interior/free traversal claim. Fine carving,calligraphy,floral artwork,inlay,grilles,exact82dome inventory and current finish omitted or approximate. Synthetic Mediterranean-style context and physical-device timing unverified. Adjacent visitor buildings,roads,car parks,landscape and remote Wahat Al Karama excluded.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('three-large-onions-and-four-minarets', [280, 160, 260], [-20, 35, 0]),
    cam('main-hall-and-keyhole-court', [65, 36, -3], [-25, 25, 0]),
    cam('gold-capital-colonnade', [15, 7, -55], [22, 8, -72]),
    cam('east-gateway-and-pools', [230, 70, -65], [110, 22, -5]),
    cam('open-staged-minaret', [155, 89, -137], [109, 88, -80]),
    cam('mapped-dome-and-pool-plan', [0, 480, 0.1], [0, 20, 0]),
  ],
};

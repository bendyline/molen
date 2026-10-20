/** Quba: six mapped white domes, staged minarets and a shaded court. */
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
  '../../../content/worldgen/source/places/su/suk/n0421_quba_mosque/',
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
  wall: '#f0ede2',
  trim: '#aaa99b',
  roof: '#ede9db',
  door: '#987351',
  gold: '#a6a17f',
  glass: '#4d6178',
  canopy: '#e4e0d2',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, qubaGround(...p) - 0.35);
export function qubaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Quba Mosque footing outside retained terrain');
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
const band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
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
  shape = 'round',
  depth = 2,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
function dome(face, p, r, base, height, d, slot = 'roof', small = false) {
  const n = small ? [4, 6, 10, 12, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + height * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    slot,
  );
}
function finial(face, p, y, d, h = 1.1) {
  if (d === 0) {
    profile(
      face,
      circle(p, 0.1, 4),
      [
        [y, 1],
        [y + h, 0],
      ],
      'gold',
    );
    return;
  }
  beam(face, at(p, y), at(p, y + h), 0.1, 'gold');
  if (d >= 3)
    profile(
      face,
      circle(p, 0.16, 6),
      [
        [y + 0.15, 0.6],
        [y + 0.45, 1],
        [y + 0.7, 0.3],
      ],
      'gold',
    );
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(
      face,
      h,
      d,
      d === 1 ? 0.035 : -(h.inset ?? 0.24),
      h.kind === 'door' ? 'door' : h.kind === 'blind' ? 'wall' : 'glass',
    );
    if (d >= 2) archBand(face, h, d, 0.18, h.kind === 'door' ? 'trim' : 'wall', 0.06);
  }
}
/** One opening per planar facet: triangulate the face once, then add its shallow reveals. */
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
        [-length / 2, floor + 34.8],
        [length / 2, floor + 34.8],
        [length / 2, floor + 38.5],
        [-length / 2, floor + 38.5],
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
  cap(face, ring, 38.5, 'wall', [inside]);
}
export function qubaOuterFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const [i, e] of edges(plans.outer).entries()) {
    const n = d === 1 ? Math.max(3, Math.round(e.length / 20)) : Math.round(e.length / 7.5);
    for (let j = 0; j < n; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / n);
      if (
        plans.minarets.some(
          (m) => Math.abs(p[0] - m.center[0]) < 3.5 && Math.abs(p[1] - m.center[1]) < 3.5,
        )
      )
        continue;
      if (plans.entranceCenters.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 4)) continue;
      fields.push(hole(`outer-light-${i}-${j}`, p, e.axis, e.normal, 1.15, 5.25, 2.35, 1.65));
    }
  }
  for (const [i, p] of plans.entranceCenters.entries()) {
    const side = Math.abs(p[1]) > 20,
      axis = side ? [1, 0] : [0, 1],
      normal = side ? [0, Math.sign(p[1])] : [1, 0];
    let center = p;
    if (side) {
      const e = edges(plans.outer)
        .filter((e) => Math.abs(e.normal[1]) > 0.9)
        .find((e) => Math.sign(e.normal[1]) === Math.sign(p[1]));
      const t = (p[0] - e.a[0]) / (e.b[0] - e.a[0]);
      center = lerp(e.a, e.b, t);
    } else {
      const e = edges(plans.outer).find((e) => e.normal[0] > 0.9);
      center = lerp(e.a, e.b, (p[1] - e.a[1]) / (e.b[1] - e.a[1]));
    }
    fields.push({
      ...hole(`outer-door-${i}`, center, axis, normal, 3.0, 0.05, 4.1, 4.1, 'rect', 2),
      kind: 'door',
    });
  }
  return fields;
}
export function qubaDrumFields(d = 3) {
  if (d < 1) return [];
  const fields = [];
  for (const [i, p] of plans.domes.entries()) {
    const r = circle(p.center, p.radius, [8, 12, 20, 28, 32][d]);
    for (const [j, e] of edges(r).entries()) {
      if (j % (d === 1 ? 3 : d === 2 ? 4 : 2)) continue;
      fields.push(
        hole(
          `dome-drum-${i}-${j}`,
          lerp(e.a, e.b, 0.5),
          e.axis,
          e.normal,
          1.1,
          10.05,
          p.base > 12 ? 2.45 : 1.25,
          p.base > 12 ? 1.7 : 0.7,
          'round',
          1.4,
        ),
      );
    }
  }
  return fields;
}
export function qubaCourtArches(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const [i, e] of edges(plans.court).entries()) {
    const n = d === 1 ? 3 : 5;
    for (let j = 0; j < n; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / n),
        portal = i === 3 && j === Math.floor(n / 2);
      fields.push({
        ...hole(
          `court-${i}-${j}`,
          p,
          e.axis,
          e.normal.map((v) => -v),
          e.length / n - 0.85,
          0.04,
          portal ? 8.45 : 7.1,
          portal ? 4.8 : 4.5,
          'pointed',
          1.7,
        ),
        ...(portal ? { kind: 'door', inset: 0.65 } : {}),
      });
    }
  }
  return fields;
}
export function qubaMinaretFields(d = 3) {
  if (d < 2) return [];
  const fields = [];
  for (const [i, m] of plans.minarets.entries())
    for (const [stage, r, bottom, height] of [
      ['shaft', 1.85, 17, 5.5],
      ['upper', 1.3, 29, 3.2],
    ])
      for (const [j, e] of edges(circle(m.center, r, 8)).entries()) {
        if (d === 2 && j % 2) continue;
        fields.push({
          ...hole(
            `minaret-${i}-${stage}-${j}`,
            lerp(e.a, e.b, 0.5),
            e.axis,
            e.normal,
            stage === 'shaft' ? 0.72 : 0.52,
            bottom,
            height,
            height * 0.68,
            'pointed',
            1.4,
          ),
          kind: 'blind',
          inset: 0.16,
        });
      }
  return fields;
}
export function qubaLanternArches(d = 3) {
  if (d < 2) return [];
  const fields = [];
  for (const [i, m] of plans.minarets.entries())
    for (const [j, e] of edges(circle(m.center, 1.18, 8)).entries())
      fields.push(
        hole(
          `lantern-${i}-${j}`,
          lerp(e.a, e.b, 0.5),
          e.axis,
          e.normal,
          0.55,
          35.15,
          2.75,
          2.25,
          'round',
          1.3,
        ),
      );
  return fields;
}
function ornament(face, center, axis, normal, width, height, y, d, slot = 'wall', open = false) {
  const outline =
      d <= 2
        ? [
            [-width * 0.5, 0],
            [0, height],
            [width * 0.5, 0],
          ]
        : [
            [-width * 0.38, 0],
            [-width * 0.5, height * 0.5],
            [0, height],
            [width * 0.5, height * 0.5],
            [width * 0.38, 0],
          ],
    inner = [
      [-width * 0.13, height * 0.43],
      [0, height * 0.23],
      [width * 0.13, height * 0.43],
      [0, height * 0.64],
    ],
    points = open ? [...outline, ...inner] : outline,
    ids = earcut(points.flat(), open ? [outline.length] : [], 2),
    P = (p, z) => [
      center[0] + axis[0] * p[0] + normal[0] * z,
      floor + y + p[1],
      center[1] + axis[1] * p[0] + normal[1] * z,
    ];
  for (let i = 0; i < ids.length; i += 3)
    for (const side of [-1, 1])
      face(
        slot,
        ids.slice(i, i + 3).map((j) => P(points[j], side * 0.12)),
        [normal[0] * side, 0, normal[1] * side],
      );
  for (const r of open ? [outline, inner] : [outline])
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      face(slot, [P(a, -0.12), P(b, -0.12), P(b, 0.12), P(a, 0.12)]);
    }
}
function crowns(face, d) {
  if (d < 1) return;
  for (const [ring, y] of [
    [plans.outer, 9.8],
    [plans.court, 9.5],
  ])
    for (const e of edges(ring)) {
      const n = Math.round(e.length / (d === 1 ? 5 : d === 2 ? 2.6 : 1.6));
      for (let j = 0; j < n; j++)
        ornament(
          face,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal,
          d === 1 ? 0.75 : 0.85,
          0.9,
          y,
          d,
          'wall',
          d >= 3,
        );
    }
}
function trefoilHood(face, h, d) {
  const p = prepareOpening(h, 0, d),
    ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  for (const [c, r] of [
    [[-1.25, floor + 5.8], 0.9],
    [[0, floor + 6.3], 1.3],
    [[1.25, floor + 5.8], 0.9],
  ])
    for (let i = 0; i < 6; i++) {
      const a = Math.PI - (i * Math.PI) / 6,
        b = Math.PI - ((i + 1) * Math.PI) / 6,
        P = (t, r) => p.point(c[0] + Math.cos(t) * r, c[1] + Math.sin(t) * r, 0.14 * ns);
      face(
        'trim',
        [P(a, r - 0.14), P(b, r - 0.14), P(b, r + 0.14), P(a, r + 0.14)],
        [h.normal[0], 0, h.normal[1]],
      );
    }
}
function enclosure(out, face, d) {
  const fields = qubaOuterFields(d);
  shell(out, d, plans.outer, footing, 4.2, d >= 2 ? fields : [], 'trim');
  shell(out, d, plans.outer, 4.2, 9.8, d >= 2 ? fields : [], 'wall');
  cap(face, plans.outer, 9.8, 'roof', [plans.court]);
  cap(face, plans.outer, 0.035, 'trim');
  finish(face, fields, d);
  if (d >= 2) {
    band(face, plans.outer, 9.5, 0.3, 'wall', 1.001);
    for (const h of fields.filter((h) => h.kind === 'door')) trefoilHood(face, h, d);
  }
}
function roofDomes(out, face, d) {
  const fields = qubaDrumFields(d);
  for (const [i, p] of plans.domes.entries()) {
    const r = circle(p.center, p.radius, [8, 12, 20, 28, 32][d]),
      fs = fields.filter((h) => h.name.startsWith(`dome-drum-${i}-`));
    if (d >= 2) facetedRecesses(face, r, 9.8, p.base, fs, d);
    else shell(out, d, r, 9.8, p.base, [], 'wall');
    finish(face, fs, d);
    dome(face, p.center, p.radius, p.base, p.height, d);
    finial(face, p.center, p.base + p.height, d);
  }
}
function court(out, face, d) {
  const arches = qubaCourtArches(d);
  for (const [i, e] of edges(plans.court).entries()) {
    const a = e.a.map((v, k) => v + e.normal[k] * 0.8),
      b = e.b.map((v, k) => v + e.normal[k] * 0.8),
      r = [e.a, e.b, b, a],
      fs = arches.filter((h) => h.name.startsWith(`court-${i}-`));
    if (d === 0) {
      sides(face, r, 0, 3.5, 'trim');
      sides(face, r, 3.5, 9.5, 'wall');
    } else if (d === 1) {
      for (let j = 0; j <= fs.length; j++) {
        const p = lerp(e.a, e.b, j / fs.length);
        beam(face, at(p, 0), at(p, 3.5), 0.8, 'trim');
        beam(face, at(p, 3.5), at(p, 9.5), 0.8, 'wall');
      }
      for (const h of fs) {
        const p = prepareOpening(h, 0, 1),
          ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
          arc = openingShape(h, 1).slice(2);
        for (let j = 0; j < arc.length - 1; j++) {
          const a = arc[j],
            b = arc[j + 1];
          for (const z of [0, -0.7])
            face(
              'wall',
              [
                p.point(a[0], a[1], z * ns),
                p.point(b[0], b[1], z * ns),
                p.point(b[0], floor + 9.5, z * ns),
                p.point(a[0], floor + 9.5, z * ns),
              ],
              [h.normal[0] * (z === 0 ? 1 : -1), 0, h.normal[1] * (z === 0 ? 1 : -1)],
            );
        }
      }
    } else {
      shell(out, d, r, 0, 3.5, fs, 'trim');
      shell(out, d, r, 3.5, 9.5, fs, 'wall');
      for (const h of fs) archBand(face, h, d, 0.22, 'wall', 0.06);
    }
    if (d >= 1)
      for (const h of fs.filter((h) => h.kind === 'door'))
        pane(face, h, d, d === 1 ? 0.035 : -0.65, 'door');
    cap(face, r, 9.5, 'roof');
  }
}
function shade(face, d) {
  const r = plans.court,
    n = d === 0 ? 1 : 5,
    segments = d <= 1 ? 1 : d === 2 ? 4 : 8;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < segments; j++) {
      const u0 = i / n,
        u1 = (i + 1) / n,
        t0 = j / segments,
        t1 = (j + 1) / segments,
        P = (u, t) => {
          const p = lerp(lerp(r[0], r[1], u), lerp(r[3], r[2], u), t);
          return at(p, 10.2 - 0.45 * Math.sin(t * Math.PI));
        };
      const a = P(u0, t0),
        b = P(u1, t0),
        c = P(u1, t1),
        e = P(u0, t1);
      face('canopy', [a, b, c, e], [0, 1, 0]);
      face('canopy', [a, b, c, e], [0, -1, 0]);
    }
  if (d >= 2)
    for (let i = 0; i <= 5; i++)
      beam(
        face,
        at(lerp(r[0], r[1], i / 5), 10.18),
        at(lerp(r[3], r[2], i / 5), 10.18),
        0.1,
        'gold',
      );
}
function tower(_out, face, m, index, d) {
  const p = m.center,
    square = rect(p[0] - 2.6, p[1] - 2.6, p[0] + 2.6, p[1] + 2.6),
    r = circle(p, 1.85, d === 0 ? 4 : 8),
    fields = qubaMinaretFields(d).filter((h) => h.name.startsWith(`minaret-${index}-`));
  solid(face, square, footing, 10.5, 'wall');
  profile(
    face,
    square,
    [
      [10.5, 1],
      [13, 0.72],
    ],
    'wall',
  );
  facetedRecesses(
    face,
    r,
    13,
    27,
    fields.filter((h) => h.name.includes('-shaft-')),
    d,
  );
  cap(face, r, 27, 'wall');
  const upper = circle(p, 1.3, d === 0 ? 4 : 8);
  facetedRecesses(
    face,
    upper,
    27.8,
    34,
    fields.filter((h) => h.name.includes('-upper-')),
    d,
  );
  cap(face, upper, 34, 'wall');
  finish(face, fields, d);
  for (const [y, radius] of [
    [27, 2.55],
    [34, 2.0],
  ]) {
    const ring = circle(p, radius, d === 0 ? 4 : 8);
    profile(
      face,
      ring,
      [
        [y, 0.72],
        [y + 0.25, 1],
        [y + 0.8, 1],
      ],
      'wall',
    );
    if (d >= 2) {
      band(face, ring, y + 0.55, 0.25, 'wall', 1.01);
      if (d >= 3)
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4,
            q = [p[0] + Math.cos(a) * radius * 0.94, p[1] + Math.sin(a) * radius * 0.94];
          beam(face, at(q, y + 0.8), at(q, y + 1.6), 0.14, 'wall');
        }
      const railInside = scaled(ring, 0.94);
      sides(face, ring, y + 1.55, y + 1.68, 'wall');
      sides(face, railInside, y + 1.55, y + 1.68, 'wall', true);
      cap(face, ring, y + 1.68, 'wall', [railInside]);
    }
  }
  const lantern = circle(p, 1.18, d === 0 ? 4 : 8),
    inner = circle(p, 0.8, d === 0 ? 4 : 8),
    arches = qubaLanternArches(d).filter((h) => h.name.startsWith(`lantern-${index}-`));
  if (d >= 2) openLantern(face, lantern, inner, arches, d);
  else if (d === 1) {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        q = [p[0] + Math.cos(a) * 1.08, p[1] + Math.sin(a) * 1.08];
      beam(face, at(q, 34.8), at(q, 38.5), 0.25, 'wall');
    }
  } else solid(face, lantern, 34.8, 38.5, 'wall');
  profile(
    face,
    lantern,
    [
      [38.5, 1],
      [40, 0.9],
    ],
    'wall',
  );
  dome(face, p, 1.12, 40, 4, d, 'gold', true);
  finial(face, p, 44, d, 1);
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let longest = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const length = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (length > longest) {
              longest = length;
              k = i;
            }
          }
          if (longest > (d === 0 ? 40 : d === 1 ? 30 : 18)) {
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
  enclosure(out, face, d);
  roofDomes(out, face, d);
  court(out, face, d);
  shade(face, d);
  crowns(face, d);
  for (const [i, m] of plans.minarets.entries()) tower(out, face, m, i, d);
}
export const buildQubaSkyline = (o) => build(o, 0),
  buildQubaDistrict = (o) => build(o, 1),
  buildQubaStreet = (o) => build(o, 2),
  buildQubaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const qubaStudy = {
  id: 'N0421',
  key: 'quba_mosque',
  title: 'Quba Mosque',
  category: 'mosque',
  wikidataId: 'Q276569',
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
    'Five existing shared256² lime plaster,granite,plain wood,bronze and canvas graphs;seven groups including local blue-grey glazing. Roof/walls reuse plaster with distinct finishes. Shared textures,metric UVs,linear tints;no embedded images,unique facade maps,baked lighting or copied lettering.',
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
    'Individual medium-fi exterior from five actually inspected Kaliper1 December2024 exterior/minaret/entrance/court pictures and standard viewer PMTiles/DEM. Six domes,grey-plinth/white enclosure,crown parapets,four two-balcony minarets/open lanterns and bronze caps,shallow rectangular entrance recesses/trefoil hoods,pointed court arcades and static deployed fabric shade. Fine carved lattice/muqarnas,inscriptions,actual room plans,engineering,fixtures,carpets and current site finish excluded or abstracted. Court arcade voids are exterior circulation;main prayer-hall portal terminates closed and no enclosed interior/free traversal claim is made. Canopy is the observed covered state,not animated machinery;plaza umbrellas and outer expansion remain separate host content. Exact ground/door/stair/plaza contact,altitude/walking and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('six-domes-and-four-minarets', [-116, 61, 99], [-10, 17, 0]),
    cam('east-entrance-and-trefoil-hood', [-27.5, 12, 51], [-27.5, 8, 26.5]),
    cam('shaded-pointed-courtyard', [7, 9, 0], [-9, 10, -1.5]),
    cam('two-balcony-minaret', [-78, 32, 51], [-44.4, 31, 23.8]),
    cam('white-dome-and-drum', [-66, 29, 16], [-35, 19, 0]),
    cam('roof-and-signed-plan', [0, 225, 0.1], [0, 19, 0]),
  ],
};

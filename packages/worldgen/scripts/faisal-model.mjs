/** Faisal Mosque: eight white folds, four pencil minarets and open raised court. */
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
  '../../../content/worldgen/source/places/tt/ttg/faisal_mosque/',
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
  wall: '#ebe5da',
  trim: '#c9c2b3',
  roof: '#eee9dc',
  door: '#705d4c',
  gold: '#bda46a',
  glass: '#52636b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, faisalGround(...p) - 0.35);
export function faisalGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Faisal Mosque footing outside retained terrain');
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
function _archBand(face, h, d, w = 0.45, slot = 'trim', offset = 0.08) {
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
function squareLantern(face, ring, inside, fields, d) {
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
        [-length / 2, floor + 70],
        [length / 2, floor + 70],
        [length / 2, floor + 73],
        [-length / 2, floor + 73],
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
  cap(face, ring, 73, 'wall', [inside]);
}
const plans = rec.plans;
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  edges = (r) =>
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
const hole = (name, center, axis, normal, width, bottom, height, depth = 1.5) => ({
  name,
  center,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring: height,
  shape: 'rect',
  depth,
});
function frameRect(face, h, w = 0.2) {
  const bottom = h.bottom - floor,
    top = bottom + h.height,
    P = (u, y, v = 0.07) => [
      h.center[0] + h.axis[0] * u + h.normal[0] * v,
      floor + y,
      h.center[1] + h.axis[1] * u + h.normal[1] * v,
    ];
  for (const u of [-h.width / 2 - w / 2, h.width / 2 + w / 2])
    beam(face, P(u, bottom - w), P(u, top + w), w, 'wall');
  beam(face, P(-h.width / 2 - w, top + w / 2), P(h.width / 2 + w, top + w / 2), w, 'wall');
}
const frontRoofRing = () => {
  const r = plans.hall,
    [a, b, c, d] = r;
  return [a, lerp(a, b, 0.5), b, lerp(b, c, 0.5), c, lerp(c, d, 0.5), d, lerp(d, a, 0.5)];
};
export function faisalHallFields(d = 3) {
  if (d === 0) return [];
  const list = [];
  for (const [eIndex, e] of edges(plans.hall).entries()) {
    const n = d === 1 ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const center = lerp(e.a, e.b, (i + 0.5) / n);
      list.push({
        ...hole(
          `hall-${eIndex}-${i}`,
          center,
          e.axis,
          e.normal,
          i === Math.floor(n / 2) ? 4 : 3.0,
          0.25,
          4.7,
          2,
        ),
        kind: i === Math.floor(n / 2) ? 'door' : 'glass',
        inset: 0.4,
      });
    }
  }
  return list;
}
export function faisalMinaretFields(d = 3) {
  if (d === 0) return [];
  return plans.minarets.flatMap((m, j) =>
    edges(scaled(m.outline, 0.68)).map((e, i) => ({
      ...hole(`shaft-${j}-${i}`, lerp(e.a, e.b, 0.5), e.axis, e.normal, e.length * 0.52, 10, 57, 1),
      inset: 0.3,
    })),
  );
}
export function faisalLanternFields(d = 3) {
  if (d < 2) return [];
  return plans.minarets.flatMap((m, j) =>
    edges(scaled(m.outline, 0.68 * 1.06)).map((e, i) =>
      hole(
        `collar-${j}-${i}`,
        lerp(e.a, e.b, 0.5),
        e.axis,
        e.normal,
        e.length * 0.55,
        70.25,
        2.25,
        2,
      ),
    ),
  );
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.04 : -(h.inset ?? 0.3), h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) frameRect(face, h, 0.16);
  }
}
function podium(out, face, d) {
  sides(face, plans.outer, footing, 0, 'wall');
  if (d > 0) sides(face, plans.outer, 0, 0.1, 'trim');
  cap(face, plans.outer, 0.1, 'trim', d === 0 ? [plans.courtBasin] : plans.holes);
  for (const h of d === 0 ? [] : plans.lightwells) {
    sides(face, h, -4, 0.1, 'wall', true);
    cap(face, h, -4, 'trim');
    if (d >= 2) {
      for (const e of edges(h)) {
        beam(face, at(e.a, 0.25), at(e.b, 0.25), 0.22, 'wall');
        beam(face, at(e.a, 1.0), at(e.b, 1.0), 0.12, 'wall');
        for (const p of [e.a, lerp(e.a, e.b, 0.5)])
          beam(face, at(p, 0.2), at(p, 1.0), 0.12, 'wall');
      }
    }
  }
  if (d >= 1) {
    const fields = [];
    for (const e of edges(plans.outer)) {
      if (e.length < 14) continue;
      const n = Math.floor(e.length / (d === 1 ? 18 : 8));
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n),
          h = hole(
            'podium-window',
            p,
            e.axis,
            e.normal,
            Math.min(4.2, e.length / n - 2),
            -5.5,
            2.0,
            1,
          );
        fields.push(h);
      }
    }
    for (const h of fields) {
      pane(face, h, d, 0.035, 'glass');
      if (d >= 3) frameRect(face, h, 0.17);
    }
  }
  if (d >= 2) {
    for (let x = -20; x < 110; x += 12)
      for (let z = -64; z < 70; z += 12) {
        if (plans.holes.some((h) => inside([x, z], h))) continue;
        face(
          'trim',
          rect(x - 0.05, z - 5.8, x + 0.05, z + 5.8).map((p) => at(p, 0.108)),
          [0, 1, 0],
          colors.wall,
        );
        face(
          'trim',
          rect(x - 5.8, z - 0.05, x + 5.8, z + 0.05).map((p) => at(p, 0.108)),
          [0, 1, 0],
          colors.wall,
        );
      }
  }
  void out;
}
function inside(p, r) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      v = !v;
  }
  return v;
}
function hall(out, face, d) {
  const fields = faisalHallFields(d),
    h = writer(masked(out, d >= 2 ? fields.map((f) => prepareOpening(f, 0, d)) : []), d);
  sides(h, plans.hall, 0, 7.5, 'wall');
  finish(face, fields, d);
  const ring = frontRoofRing(),
    heights = ring.map((_, i) => (i % 2 ? 42 : 8)),
    C = at(plans.roofCenter, 55);
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    face('roof', [at(ring[i], heights[i]), at(ring[j], heights[j]), C], [0, 1, 0]);
    if (d >= 2) {
      const pts = [
        at(ring[i], heights[i] - 0.7),
        at(ring[j], heights[j] - 0.7),
        [C[0], C[1] - 0.7, C[2]],
      ];
      face('roof', pts, [0, -1, 0]);
    }
    if (d >= 1)
      beam(face, at(ring[i], heights[i]), at(ring[j], heights[j]), d === 1 ? 0.8 : 1.3, 'roof');
  }
  for (const e of edges(plans.hall)) {
    const mid = lerp(e.a, e.b, 0.5),
      axis = e.axis,
      normal = e.normal,
      P = (u, y, depth = 0) =>
        at(
          mid.map((v, k) => v + axis[k] * u + normal[k] * depth),
          y,
        ),
      top = (u) => Math.max(7.6, 42 - (34 * Math.abs(u)) / (e.length / 2));
    if (d === 0) {
      face('wall', [at(e.a, 7.5), P(0, 42), at(e.b, 7.5)], [normal[0], 0, normal[1]]);
      continue;
    }
    face(
      'glass',
      [P(-e.length / 2 + 1, 7.55, -0.35), P(0, 40.9, -0.35), P(e.length / 2 - 1, 7.55, -0.35)],
      [normal[0], 0, normal[1]],
    );
    const n = d === 1 ? 8 : d === 2 ? 16 : d === 3 ? 24 : 28;
    for (let i = 1; i < n; i++) {
      const u = -e.length / 2 + (e.length * i) / n,
        y = top(u) - 0.8;
      if (y < 8) continue;
      beam(face, P(u, 7.5, 0.1), P(u, y, 0.1), d === 1 ? 0.5 : d === 2 ? 0.7 : 0.85, 'wall');
      if (d >= 3) {
        const count = Math.floor((y - 8) / 2.6);
        for (let j = 0; j < count; j++) {
          const y0 = 8 + j * 2.6;
          beam(
            face,
            P(u - (e.length / n) * 0.32, y0, 0.12),
            P(u + (e.length / n) * 0.32, y0, 0.12),
            0.18,
            'wall',
          );
        }
      }
    }
    if (d >= 2) {
      for (const a of [-1, 1])
        beam(face, P(a * e.length * 0.49, 8, 0.07), P(0, 42, 0.07), 0.8, 'roof');
    }
  }
  if (d >= 2)
    for (let i = 0; i < 4; i++) {
      const p = ring[i * 2],
        R = ring[i * 2 + 1];
      beam(face, at(p, 8.03), [C[0], C[1] + 0.035, C[2]], 0.32, 'glass');
      beam(face, at(R, 42.06), [C[0], C[1] + 0.06, C[2]], 0.45, 'roof');
    }
  for (const c of plans.crest) {
    const base = scaled(c.outline, 0.55);
    profile(
      face,
      base,
      [
        [53, 1],
        [57, 0.8],
        [59.2, 0],
      ],
      'roof',
    );
  }
  if (d >= 1) {
    const p = plans.roofCenter;
    beam(face, at(p, 55.2), at(p, 58.8), 0.16, 'gold');
    const n = d === 1 ? 4 : 12;
    for (let i = 0; i < n; i++) {
      const a = ((30 - (i * 240) / n) * Math.PI) / 180,
        b = ((30 - ((i + 1) * 240) / n) * Math.PI) / 180;
      beam(
        face,
        [p[0], floor + 58.8 + 1.2 * Math.sin(a), p[1] + 1.2 * Math.cos(a)],
        [p[0], floor + 58.8 + 1.2 * Math.sin(b), p[1] + 1.2 * Math.cos(b)],
        0.13,
        'gold',
      );
    }
  }
}
function minaret(face, m, j, d) {
  const ring = scaled(m.outline, 0.68),
    base = controlsBase(m);
  if (d === 0) {
    profile(
      face,
      base,
      [
        [0, 1],
        [7, 0.4],
        [70, 0.4],
        [73, 0.46],
        [90, 0],
      ],
      'wall',
      m.center,
    );
    return;
  }
  profile(
    face,
    base,
    [
      [0, 1],
      [1, 1],
      [7, 0.4],
    ],
    'wall',
  );
  const fields = faisalMinaretFields(d).filter((h) => h.name.startsWith(`shaft-${j}-`));
  if (d >= 2) {
    facetedRecesses(face, ring, 7, 70, fields, d);
    for (const h of fields) {
      pane(face, h, d, -0.3, 'trim');
      if (d >= 3) {
        frameRect(face, h, 0.12);
        const p = h.center;
        for (let y = 14; y < 66; y += 7)
          beam(
            face,
            [
              p[0] - h.axis[0] * h.width * 0.5 + h.normal[0] * 0.02,
              floor + y,
              p[1] - h.axis[1] * h.width * 0.5 + h.normal[1] * 0.02,
            ],
            [
              p[0] + h.axis[0] * h.width * 0.5 + h.normal[0] * 0.02,
              floor + y,
              p[1] + h.axis[1] * h.width * 0.5 + h.normal[1] * 0.02,
            ],
            0.13,
            'wall',
          );
      }
    }
  } else {
    solid(face, ring, 7, 70, 'wall');
    for (const h of fields) pane(face, h, d, 0.035, 'trim');
  }
  const collar = scaled(ring, 1.06);
  cap(face, collar, 70, 'wall');
  if (d >= 2) {
    const inner = scaled(collar, 0.64),
      holes = faisalLanternFields(d).filter((h) => h.name.startsWith(`collar-${j}-`));
    squareLantern(face, collar, inner, holes, d);
  } else solid(face, collar, 70, 73, 'wall');
  profile(
    face,
    collar,
    [
      [73, 1],
      [89.8, 0.02],
      [90, 0],
    ],
    'roof',
    m.center,
  );
  if (d >= 3) {
    for (const p of collar) beam(face, at(p, 73), at(m.center, 89.65), 0.13, 'trim');
  }
}
function controlsBase(m) {
  const candidates = rec.controls.filter((b) => b.properties.height === 50),
    b = candidates.sort(
      (a, b) =>
        Math.hypot(...center(a.polygons[0].outline).map((v, k) => v - m.center[k])) -
        Math.hypot(...center(b.polygons[0].outline).map((v, k) => v - m.center[k])),
    )[0];
  return b.polygons[0].outline;
}
function colonnades(face, d) {
  for (const [lineIndex, line] of plans.arcadeLines.entries()) {
    const axis = unit(line.b.map((v, k) => v - line.a[k])),
      normal = line.normal,
      depth = line.depth ?? 5.5,
      r = [
        line.a,
        line.b,
        line.b.map((v, k) => v - normal[k] * depth),
        line.a.map((v, k) => v - normal[k] * depth),
      ],
      n = Math.round(
        Math.hypot(...line.b.map((v, k) => v - line.a[k])) / (d === 0 ? 42 : d === 1 ? 12 : 7),
      );
    solid(face, r, 5.5, 6.0, 'roof');
    face(
      'roof',
      r.map((p) => at(p, 5.5)),
      [0, -1, 0],
    );
    for (let i = 0; i <= n; i++) {
      const p = lerp(line.a, line.b, i / n);
      for (const t of d >= 3 ? [0, depth - 0.3] : [0]) {
        const q = p.map((v, k) => v - normal[k] * t);
        solid(face, rect(q[0] - 0.3, q[1] - 0.3, q[0] + 0.3, q[1] + 0.3), 0, 5.5, 'wall');
        if (d >= 2) {
          for (const sign of [-1, 1])
            beam(
              face,
              at(q, 4.1),
              at(
                q.map((v, k) => v + axis[k] * sign * 1.5),
                5.5,
              ),
              0.22,
              'wall',
            );
        }
      }
    }
    if (d >= 3) {
      const count = Math.round(Math.hypot(...line.b.map((v, k) => v - line.a[k])) / 1.8);
      for (let i = 0; i < count; i++) {
        const p = lerp(line.a, line.b, (i + 0.5) / count),
          q = p.map((v, k) => v - normal[k] * depth);
        beam(face, at(p, 5.2), at(q, 5.2), 0.14, 'trim');
      }
    }
    void lineIndex;
  }
}
function awning(face, d) {
  solid(face, plans.hallAwning, 6.5, 7.2, 'roof');
  face(
    'roof',
    plans.hallAwning.map((p) => at(p, 6.5)),
    [0, -1, 0],
  );
  const n = d === 0 ? 4 : d === 1 ? 6 : 10;
  for (let i = 0; i <= n; i++) {
    const z = -35.0 + (70 * i) / n,
      p = [-36.5, z];
    solid(face, rect(p[0] - 0.24, z - 0.24, p[0] + 0.24, z + 0.24), 0, 6.5, 'wall');
    if (d >= 2) {
      face(
        'wall',
        [at([-49, z - 0.18], 6.5), at([-36.5, z - 0.18], 4.6), at([-36.5, z - 0.18], 6.5)],
        [0, 0, -1],
      );
      face(
        'wall',
        [at([-49, z + 0.18], 6.5), at([-36.5, z + 0.18], 6.5), at([-36.5, z + 0.18], 4.6)],
        [0, 0, 1],
      );
    }
  }
}
function canopy(face, d) {
  const r = plans.eastCanopy.outline;
  solid(face, r, 10, 10.65, 'roof');
  face(
    'roof',
    r.map((p) => at(p, 10)),
    [0, -1, 0],
  );
  for (const p of plans.eastCanopy.columns) {
    solid(face, rect(p[0] - 0.9, p[1] - 0.9, p[0] + 0.9, p[1] + 0.9), 0, 10, 'wall');
    if (d >= 2) solid(face, rect(p[0] - 1.1, p[1] - 1.1, p[0] + 1.1, p[1] + 1.1), 0, 0.3, 'trim');
  }
  if (d >= 1)
    for (const p of r) {
      const q = lerp(p, center(r), 0.15);
      face('roof', [at(p, 10.65), at(q, 10.65), at(p, 13)], [0, 0, 1]);
      face('roof', [at(p, 10.65), at(p, 13), at(q, 10.65)], [0, 0, -1]);
    }
  if (d >= 3) {
    const C = center(r);
    for (let x = 114; x < 135; x += 4)
      for (let z = -12; z < 14; z += 4) {
        beam(face, at([x - 1.5, z - 1.5], 9.96), at([x + 1.5, z + 1.5], 9.96), 0.12, 'trim');
        beam(face, at([x - 1.5, z + 1.5], 9.96), at([x + 1.5, z - 1.5], 9.96), 0.12, 'trim');
      }
    void C;
  }
}
function pools(face, d) {
  const waterColor = [0.028, 0.2, 0.26];
  for (const p of rec.pool.polygons) {
    const box = [0, 1].map((k) => [
        Math.min(...p.outline.map((v) => v[k])),
        Math.max(...p.outline.map((v) => v[k])),
      ]),
      r = rect(box[0][0] - 1, box[1][0] - 1, box[0][1] + 1, box[1][1] + 1);
    sides(face, r, footing, 0, 'wall');
    cap(face, r, 0.1, 'trim', [p.outline]);
    sides(face, p.outline, -0.7, 0.1, 'trim', true);
    faceWater(face, p.outline, -0.6, waterColor);
  }
  const ring = plans.courtBasin;
  sides(face, ring, -1, 0.1, 'trim', true);
  faceWater(face, ring, -0.75, waterColor);
  if (d >= 1) {
    const C = center(ring),
      n = 8,
      star = Array.from({ length: n * 2 }, (_, i) => {
        const a = (i * Math.PI) / n,
          r = i % 2 ? 3.8 : 12;
        return [C[0] + r * Math.cos(a), C[1] + r * Math.sin(a)];
      });
    solid(face, star, -0.7, -0.5, 'trim');
    if (d >= 2) {
      for (const e of edges(ring)) {
        beam(face, at(e.a, 0.35), at(e.b, 0.35), 0.3, 'trim');
        beam(face, at(e.a, 0.9), at(e.b, 0.9), 0.1, 'wall');
        for (const p of [e.a, lerp(e.a, e.b, 0.5)])
          beam(face, at(p, 0.35), at(p, 0.9), 0.1, 'wall');
      }
      solid(face, rect(C[0] - 1.4, C[1] - 1.4, C[0] + 1.4, C[1] + 1.4), -0.5, 0.05, 'trim');
      profile(
        face,
        rect(C[0] - 0.5, C[1] - 0.5, C[0] + 0.5, C[1] + 0.5),
        [
          [0.05, 1],
          [1, 0.35],
        ],
        'trim',
      );
    }
  }
}
function faceWater(face, r, y, color) {
  const ids = earcut(r.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      'glass',
      ids.slice(i, i + 3).map((j) => at(r[j], y)),
      [0, 1, 0],
      color,
    );
}
function stairs(face, d) {
  for (const s of plans.stairs) {
    const run = Math.hypot(...s.bottom.map((v, k) => v - s.top[k])),
      axis = s.bottom.map((v, k) => (v - s.top[k]) / run),
      across = [-axis[1], axis[0]],
      bottom = faisalGround(...s.bottom) + 0.12,
      count =
        d === 0 ? 1 : d === 1 ? 5 : d === 2 ? 16 : Math.min(70, Math.ceil((floor - bottom) / 0.2));
    for (let i = 0; i < count; i++) {
      const a = lerp(s.top, s.bottom, i / count),
        b = lerp(s.top, s.bottom, (i + 1) / count),
        r = [
          a.map((v, k) => v - (across[k] * s.width) / 2),
          a.map((v, k) => v + (across[k] * s.width) / 2),
          b.map((v, k) => v + (across[k] * s.width) / 2),
          b.map((v, k) => v - (across[k] * s.width) / 2),
        ];
      if (d === 0) {
        const top = (p) => {
          const t = Math.max(
            0,
            Math.min(1, ((p[0] - s.top[0]) * axis[0] + (p[1] - s.top[1]) * axis[1]) / run),
          );
          return Math.max(floor + (bottom - floor) * t, faisalGround(...p) + 0.12);
        };
        solid(face, r, (p) => Math.min(faisalGround(...p) - 0.2, top(p) - 0.2), top, 'wall');
      } else {
        const y = floor + ((bottom - floor) * (i + 1)) / count;
        solid(face, r, (p) => Math.min(faisalGround(...p) - 0.2, y - 0.2), y - floor, 'trim');
      }
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
          if (length > (d === 0 ? 105 : d === 1 ? 50 : d === 2 ? 28 : 20)) {
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
  podium(out, face, d);
  hall(out, face, d);
  for (const [j, m] of plans.minarets.entries()) minaret(face, m, j, d);
  colonnades(face, d);
  awning(face, d);
  canopy(face, d);
  pools(face, d);
  stairs(face, d);
}
export const buildFaisalSkyline = (o) => build(o, 0),
  buildFaisalDistrict = (o) => build(o, 1),
  buildFaisalStreet = (o) => build(o, 2),
  buildFaisalCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const faisalStudy = {
  id: 'faisal_mosque',
  key: 'faisal_mosque',
  title: 'Faisal Mosque',
  category: 'mosque',
  wikidataId: 'Q500983',
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
    'Four existing shared256² plain concrete,marble,wood and bronze graphs;six merged groups. Pale folded roof and paving share marble,structural shafts/fins/platform walls share concrete. Gold crescent reuses bronze,doors plain wood;glazing/pool water are local vertex-colored surfaces. Metric UVs,zero embedded images,baked lighting,unique facade art or copied inscriptions.',
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
    'Individual medium-fi exterior from four actually inspected2014/2017/2021 front,entry,court and aerial pictures plus standard viewer PMTiles/DEM. Reconstructed eight folded white planes/triangular fin gables/central angular crown and gold crescent,four mapped pencil minarets with flared feet/slit collars/pyramidal tips,flat colonnades/awning,estimated east canopy and stairs,mapped podium/lightwells/two basins. Fine screen carving,floral/soffit artwork,calligraphy,fixtures,unseen faces/current finish and actual interiors omitted or abstracted. Gable/lower hall fields close;upper collars/colonnades/canopy are exterior voids,no enclosed interior/free traversal claim. Synthetic South Asian context and physical-device timing unverified. Original DEM retained;exact altitude,base/threshold/stair/pool/street contact unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('eight-fold-tent-and-four-pencils', [155, 130, 180], [-55, 25, 0]),
    cam('triangular-fins-and-entry-awning', [15, 30, 12], [-70, 28, 0]),
    cam('slit-collar-and-pyramidal-tip', [-5, 78, 96], [-40.5, 78, 47]),
    cam('open-east-canopy', [165, 21, 38], [121, 14, 0]),
    cam('octagonal-court-basin', [71, 29, 32], [37, 8, 0]),
    cam('mapped-platform-and-roof-plan', [0, 490, 0.1], [-10, 15, 0]),
  ],
};

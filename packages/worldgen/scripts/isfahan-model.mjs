/** Jameh Mosque of Isfahan: four iwans, brick domes and twin south minarets. */
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
  '../../../content/worldgen/source/places/tj/tju/n0427_jameh_mosque_of_isfahan/',
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
  wall: '#d0b590',
  trim: '#d8cbb0',
  roof: '#c3b59d',
  door: '#705d4c',
  glass: '#52636b',
  tile: '#76aaa8',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, isfahanGround(...p) - 0.35);
export function isfahanGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Jameh Mosque of Isfahan footing outside retained terrain');
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
const plans = rec.plans;
const rect = (x, z, w, h) => [
  [x - w / 2, z - h / 2],
  [x + w / 2, z - h / 2],
  [x + w / 2, z + h / 2],
  [x - w / 2, z + h / 2],
];
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
    p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
  ]);
const point = (h, u, y, depth = 0) => [
  h.center[0] + h.axis[0] * u + h.normal[0] * depth,
  y,
  h.center[1] + h.axis[1] * u + h.normal[1] * depth,
];
const inRing = (p, r) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
};
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [-axis[1], axis[0]],
      length: Math.hypot(...b.map((v, k) => v - a[k])),
      center: lerp(a, b, 0.5),
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
export function isfahanIwans(_d = 3) {
  return plans.iwans.map((p) => ({
    ...p,
    frameWidth: p.width,
    ...field(
      p.name,
      p.center,
      p.axis,
      p.normal,
      p.openingWidth,
      0.18,
      p.openingHeight,
      p.spring,
      p.depth,
    ),
  }));
}
function down(face, r, y, slot, holes = []) {
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
      [0, -1, 0],
    );
}
function panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    outer = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
    ],
    pts = [...outer, ...r],
    ids = earcut(pts.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...pts[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function reveal(face, h, d, front, back, slot = 'wall') {
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
export function isfahanArcadeFields(d = 3) {
  const fields = [];
  for (const [edge, e] of edges(plans.court).entries()) {
    const portal =
      plans.iwans.find((p) => p.a === e.a) ||
      plans.iwans.find((p) => Math.hypot(...p.center.map((v, k) => v - e.center[k])) < 0.1);
    const gap = (portal.width + 0.4) / 2;
    for (const [lo, hi] of [
      [-e.length / 2, -gap],
      [gap, e.length / 2],
    ]) {
      const count = Math.max(1, Math.round((hi - lo) / (d === 1 ? 8.5 : 5.3))),
        step = (hi - lo) / count;
      for (let i = 0; i < count; i++)
        for (let tier = 0; tier < 2; tier++) {
          const u = lo + (i + 0.5) * step,
            center = e.center.map((v, k) => v + e.axis[k] * u);
          fields.push({
            ...field(
              `court-${edge}-${i}-${tier}`,
              center,
              e.axis,
              e.normal,
              step * 0.7,
              tier ? 6.25 : 0.45,
              tier ? 3.8 : 4.85,
              tier ? 2.0 : 2.8,
              0.8,
            ),
            step,
            tier,
            edge,
          });
        }
    }
  }
  return fields;
}
function iwan(face, h, d) {
  const p = (u, y, t) => point(h, u, floor + y, t),
    front = [
      [-h.frameWidth / 2, 0],
      [h.frameWidth / 2, 0],
      [h.frameWidth / 2, h.top],
      [-h.frameWidth / 2, h.top],
    ];
  panel(face, h, d, h.frameWidth, 0, h.top, h.name === 'east' ? 'wall' : 'tile');
  // The deep blind recess is open to the exterior; its back closes before the prayer interior.
  reveal(face, h, d, 0, -h.depth + 0.4);
  const ring = openingShape(h, d);
  face(
    'wall',
    ring.map((q) => point(h, ...q, -h.depth + 0.4)),
    [h.normal[0], 0, h.normal[1]],
  );
  face(
    'wall',
    front.map((q) => p(...q, -h.depth)),
    [-h.normal[0], 0, -h.normal[1]],
  );
  for (const side of [-1, 1])
    face(
      'wall',
      [
        p((side * h.frameWidth) / 2, 0, 0),
        p((side * h.frameWidth) / 2, 0, -h.depth),
        p((side * h.frameWidth) / 2, h.top, -h.depth),
        p((side * h.frameWidth) / 2, h.top, 0),
      ],
      [h.axis[0] * side, 0, h.axis[1] * side],
    );
  face(
    'roof',
    [
      p(-h.frameWidth / 2, h.top, 0),
      p(h.frameWidth / 2, h.top, 0),
      p(h.frameWidth / 2, h.top, -h.depth),
      p(-h.frameWidth / 2, h.top, -h.depth),
    ],
    [0, 1, 0],
  );
  if (d > 0) {
    archBand(face, h, d, 0.55, h.name === 'east' ? 'trim' : 'trim', 0.055);
    for (const u of [-h.frameWidth / 2 + 0.65, h.frameWidth / 2 - 0.65]) {
      face(
        'trim',
        [
          p(u - 0.35, 0.5, 0.08),
          p(u + 0.35, 0.5, 0.08),
          p(u + 0.35, h.top - 0.5, 0.08),
          p(u - 0.35, h.top - 0.5, 0.08),
        ],
        [h.normal[0], 0, h.normal[1]],
      );
      if (d > 1)
        for (let j = 0; j < 3; j++) {
          const y = 2.2 + (j * (h.top - 5)) / 3,
            w = 0.42;
          face(
            'tile',
            [p(u - w, y, 0.1), p(u + w, y, 0.1), p(u + w, y + 4.8, 0.1), p(u - w, y + 4.8, 0.1)],
            [h.normal[0], 0, h.normal[1]],
          );
        }
    }
    const door = {
      ...h,
      center: h.center.map((v, k) => v - h.normal[k] * (h.depth - 0.43)),
      width: h.name === 'north' ? 4.2 : 5.0,
      bottom: floor + 0.3,
      height: 5,
      spring: 3,
    };
    pane(face, door, d, 0.02, 'door');
    archBand(face, door, d, 0.35, 'trim', 0.05);
    // Broad original cells abstract the observed muqarnas; no copied tilework or fine ornament.
    if (d > 1 && h.name !== 'north')
      for (let row = 0; row < (d === 2 ? 2 : 3); row++) {
        const n = 3 - row,
          w = h.openingWidth / (3.8 + row * 0.6),
          y = 9.1 + row * 3.6,
          dep = -h.depth + 1.0 + row * 0.28;
        for (let j = 0; j < n; j++) {
          const u = (j - (n - 1) / 2) * (w + 0.25),
            r = [
              [u - w / 2, y],
              [u + w / 2, y],
              [u + w * 0.45, y + 1.8],
              [u, y + 3.1],
              [u - w * 0.45, y + 1.8],
            ],
            tip = p(u, y + 1.5, dep + 1.1);
          for (let k = 0; k < r.length; k++)
            face('trim', [p(...r[k], dep), p(...r[(k + 1) % r.length], dep), tip]);
        }
      }
  }
}
function gallery(face, d) {
  if (d === 0) return;
  const fields = isfahanArcadeFields(d);
  for (const h of fields) {
    panel(face, h, d, h.step, h.tier ? 5.8 : 0, h.tier ? 11 : 5.8, 'tile', 0.04);
    reveal(face, h, d, 0.04, -0.34, 'wall');
    pane(face, h, d, -0.34, 'wall');
    if (d > 1) {
      archBand(face, h, d, 0.2, 'trim', 0.07);
      if (!h.tier) {
        const door = { ...h, width: h.width * 0.55, height: 2.5, spring: 1.6 };
        pane(face, door, d, -0.28, 'door');
      }
    }
  }
  for (const e of edges(plans.court)) {
    const h = { ...e, center: e.center };
    for (const y of [5.75, 10.95])
      face(
        'trim',
        [
          point(h, -e.length / 2, floor + y, 0.09),
          point(h, e.length / 2, floor + y, 0.09),
          point(h, e.length / 2, floor + y + 0.16, 0.09),
          point(h, -e.length / 2, floor + y + 0.16, 0.09),
        ],
        [e.normal[0], 0, e.normal[1]],
      );
  }
}
function dome(face, part, d) {
  const n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 16 : 24,
    r = circle(part.center, part.radius, n),
    base = part.base,
    height = part.top - base;
  solid(face, rect(...part.center, part.radius * 2.06, part.radius * 2.06), 9.7, base, 'wall');
  const rings = d === 0 ? 3 : d === 1 ? 4 : d === 2 ? 6 : 8,
    levels = [[base, 1]];
  for (let i = 1; i <= rings; i++) {
    const a = ((i / rings) * Math.PI) / 2;
    levels.push([base + height * Math.sin(a), Math.max(0.01, Math.cos(a))]);
  }
  profile(face, r, levels, 'wall', part.center);
  if (d > 1) {
    // Sparse shallow brick drum fields retain the north dome's exposed masonry transition.
    for (const e of edges(rect(...part.center, part.radius * 2.06, part.radius * 2.06))) {
      const count = 3;
      for (let j = 0; j < count; j++) {
        const q = lerp(e.a, e.b, (j + 0.5) / count),
          h = field(
            `${part.name}-drum-${j}`,
            q,
            e.axis,
            [e.axis[1], -e.axis[0]],
            part.radius * 0.43,
            10.2,
            Math.max(1.0, base - 10.45),
            0.9,
          );
        pane(face, h, d, 0.035, 'trim');
      }
    }
  }
}
function minaret(face, p, d) {
  const n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 16,
    r = circle(p.center, p.radius, n);
  profile(
    face,
    r,
    [
      [0, 1.7],
      [23.9, 1],
      [31.8, 0.82],
      [32.4, 1.45],
      [34.4, 1.28],
      [35.3, 0.6],
      [36, 0.05],
    ],
    'wall',
    p.center,
  );
  if (d > 0) {
    sides(face, circle(p.center, p.radius * 1.5, n), 32.2, 32.6, 'trim');
    sides(face, circle(p.center, p.radius * 0.86, n), 30.3, 31.7, 'tile');
    if (d > 1) {
      const rr = circle(p.center, p.radius * 1.38, n);
      for (let i = 0; i < n; i++) {
        const a = rr[i],
          b = rr[(i + 1) % n];
        beam(face, at(a, 32.6), at(a, 34.4), 0.13, 'trim');
        beam(face, at(a, 34.0), at(b, 34.0), 0.12, 'trim');
      }
    }
  }
}
function lookout(face, d) {
  const h = plans.iwans.find((h) => h.name === 'west'),
    p = h.center.map((v, k) => v - h.normal[k] * 1.8),
    r = rect(...p, 4.4, 3.8);
  cap(face, r, 24.35, 'door');
  down(face, r, 24.15, 'door');
  sides(face, r, 24.15, 24.35, 'door');
  if (d === 0) {
    solid(face, rect(...p, 2.3, 2.1), 24.35, 26.4, 'door');
  } else for (const q of r) beam(face, at(q, 24.35), at(q, 26.7), 0.22, 'door');
  const roof = rect(...p, 5.5, 4.9),
    top = at(p, 28.5);
  for (let i = 0; i < 4; i++) face('tile', [at(roof[i], 26.7), at(roof[(i + 1) % 4], 26.7), top]);
  down(face, roof, 26.7, 'door');
}
function pavilion(face, d) {
  const p = plans.pavilion,
    _n = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 3 : 5;
  for (const e of edges(rect(...p.center, p.width, p.depth))) {
    const h = field(
      'court-pavilion',
      e.center,
      e.axis,
      [e.axis[1], -e.axis[0]],
      p.width - 1.4,
      0.25,
      2.8,
      1.0,
      0.6,
    );
    panel(face, h, Math.min(d, 2), e.length, 0, 3.8, 'wall');
    reveal(face, h, Math.min(d, 2), 0, -0.5, 'trim');
  }
  const r = rect(...p.center, p.width + 0.2, p.depth + 0.2);
  cap(face, r, 4.05, 'trim');
  down(face, r, 3.8, 'wall');
  sides(face, r, 3.8, 4.05, 'trim');
}
function roofVaults(face, d) {
  if (d === 0) return;
  const spacing = d === 1 ? 17 : 11.5;
  for (let x = -76; x < 75; x += spacing)
    for (let z = -64; z < 65; z += spacing) {
      const p = [x, z];
      if (!inRing(p, plans.outer)) continue;
      if ([plans.court, plans.secondaryCourt].some((r) => inRing(p, r))) continue;
      if (plans.domes.some((a) => Math.hypot(x - a.center[0], z - a.center[1]) < a.radius + 6))
        continue;
      if (
        plans.iwans.some((a) => {
          const q = p.map((v, k) => v - a.center[k]),
            u = q[0] * a.axis[0] + q[1] * a.axis[1],
            v = q[0] * a.normal[0] + q[1] * a.normal[1];
          return Math.abs(u) < a.width / 2 + 5 && v < 5 && v > -a.depth - 5;
        })
      )
        continue;
      const r = circle(p, Math.min(3.3, spacing / 3), d === 1 ? 6 : d === 2 ? 8 : 12);
      profile(
        face,
        r,
        [
          [9.8, 1],
          [10.7, 0.8],
          [11.4, 0.05],
        ],
        'roof',
        p,
      );
    }
}
export function isfahanExteriorFields(d = 3) {
  if (d < 1) return [];
  const result = [];
  for (const [i, e] of edges(plans.outer).entries()) {
    const normal = [e.axis[1] * sign(plans.outer), -e.axis[0] * sign(plans.outer)];
    if (e.center[0] < 57 || normal[0] < 0.45 || e.length < 8) continue;
    const count = Math.max(1, Math.floor(e.length / 6));
    for (let j = 0; j < count; j++) {
      result.push(
        field(
          `north-exterior-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / count),
          e.axis,
          normal,
          Math.min(2.5, (e.length / count) * 0.52),
          3.6,
          3.2,
          1.8,
        ),
      );
    }
  }
  return result;
}
function exteriorFields(face, d) {
  for (const h of isfahanExteriorFields(d)) {
    pane(face, h, d, 0.025, 'glass');
    archBand(face, h, d, 0.2, 'wall', 0.05);
    if (d > 1) {
      for (const u of [-0.25, 0.25]) {
        const a = point(h, u * h.width, h.bottom + 0.12, 0.065);
        const b = point(h, u * h.width, h.bottom + 2.2, 0.065);
        beam(face, a, b, 0.16, 'wall');
      }
      for (const y of [0.85, 1.55]) {
        beam(
          face,
          point(h, -h.width * 0.45, h.bottom + y, 0.065),
          point(h, h.width * 0.45, h.bottom + y, 0.065),
          0.16,
          'wall',
        );
      }
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
    iwans = isfahanIwans(d);
  // All low range faces share the same cavity mask, avoiding hidden walls across the four iwans.
  const cuts = iwans.map((h) =>
    prepareOpening(
      {
        ...h,
        center: h.center.map((v, k) => v - h.normal[k] * (h.depth / 2 - 0.35)),
        depth: h.depth + 1.3,
      },
      0,
      d,
    ),
  );
  const body = writer(masked(out, cuts), d);
  sides(face, plans.outer, footing, 0, 'wall');
  cap(face, plans.outer, 0, 'trim');
  sides(body, plans.outer, 0, 9.8, 'wall');
  if (d === 0) sides(body, plans.court, 0, 9.8, 'wall', true);
  sides(body, plans.secondaryCourt, 0, 9.8, 'wall', true);
  cap(body, plans.outer, 9.8, 'roof', [plans.court, plans.secondaryCourt]);
  // Secondary mapped court remains open; its floor is the common paved attachment plane.
  gallery(face, d);
  exteriorFields(face, d);
  for (const h of iwans) iwan(face, h, d);
  for (const p of plans.domes) dome(face, p, d);
  for (const p of plans.minarets) minaret(face, p, d);
  lookout(face, d);
  roofVaults(face, d);
  const basin = plans.basin,
    r = circle(basin.center, basin.radius, d === 0 ? 8 : 16),
    inner = circle(basin.center, basin.radius - 0.45, d === 0 ? 8 : 16);
  sides(face, r, 0, 0.38, 'trim');
  cap(face, r, 0.38, 'trim', [inner]);
  sides(face, inner, 0.07, 0.38, 'tile', true);
  cap(face, inner, 0.08, 'glass');
  const smallBasin = rect(...plans.pavilion.center, 7.4, 7.4);
  const smallRim = rect(...plans.pavilion.center, 8, 8);
  cap(face, smallBasin, 0.06, 'glass');
  sides(face, smallRim, 0, 0.18, 'trim');
  cap(face, smallRim, 0.18, 'trim', [smallBasin]);
  pavilion(face, d);
}
export const buildIsfahanSkyline = (o) => build(o, 0),
  buildIsfahanDistrict = (o) => build(o, 1),
  buildIsfahanStreet = (o) => build(o, 2),
  buildIsfahanCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const isfahanStudy = {
  id: 'N0427',
  key: 'jameh_mosque_of_isfahan',
  title: 'Jameh Mosque of Isfahan',
  category: 'mosque',
  wikidataId: 'Q1256501',
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
    'Five existing shared256² longformat brick,sandstone,lime plaster,mosaic and wood graphs;six merged groups. Untiled domes share brick;cyan facade bands share generic mosaic. Metric UVs,zero embedded images,baked lighting or unique facade art. Muqarnas abstracted as a few original broad facets.',
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
    'Individual medium-fi exterior from five inspected courtyard/iwan/north-dome photographs. Exact main outline/two courtyard holes retained;four vaulted iwans have closed rear walls,shallow gallery bays are closed external fields. South/north dome footprints,all heights,minaret spacing,roof vault grid and secondary court elevations are picture-led estimates. Fine tile/calligraphic/brick lattice artwork,portraits/banners/fixtures,interiors,unseen roofs,current finish and exact terrain/threshold/street joins omitted or unverified. No enclosed-interior/free walking claim. Surrounding bazaar/streets/landscaping remain host content. Synthetic regional context and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('four-iwan-courtyard', [-14, 17, 18], [-42, 14, 0]),
    cam('south-twin-minarets', [-14, 20, -3], [-54, 22, 2]),
    cam('north-brick-barrel', [-12, 8, 0], [22, 12, -2]),
    cam('west-lookout-and-muqarnas', [-12, 8, 13], [-16, 15, -34]),
    cam('exterior-north-brick-dome', [145, 33, -65], [64, 17, -6]),
    cam('mapped-two-court-plan', [0, 280, 0.1], [0, 5, 0]),
  ],
};

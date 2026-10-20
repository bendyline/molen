/** Ibn Tulun: open arcaded court,domed fountain and independent square-ramp minaret. */
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
  '../../../content/worldgen/source/places/st/stq/n0435_mosque_of_ibn_tulun/',
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
  wall: '#c0a17f',
  trim: '#d0b997',
  paving: '#cabea5',
  roof: '#c8b99e',
  dome: '#cfb68e',
  door: '#8c7154',
  glass: '#53616d',
  gold: '#b8aa7c',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, tulunGround(...p) - 0.35);
export function tulunGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Mosque of Ibn Tulun footing outside retained terrain');
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
function _solid(face, r, b, t, slot) {
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
function _beam(face, a, b, w, slot = 'trim', capped = true) {
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
const _rect = (x, z, w, h) => [
    [x - w / 2, z - h / 2],
    [x + w / 2, z - h / 2],
    [x + w / 2, z + h / 2],
    [x - w / 2, z + h / 2],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
      p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
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
  const p = [...r, ...holes.flat()],
    starts = [];
  let n = r.length;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(p.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, -1, 0],
    );
}
function panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    p = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
      ...r,
    ],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], offset)),
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
const plans = rec.plans;
function courtArcades(_out, face, d) {
  const bays = d === 0 ? 4 : d === 1 ? 9 : 18;
  for (const e of edges(plans.court)) {
    const normal = e.normal.map((v) => -v),
      pitch = e.length / bays;
    for (let k = 0; k < bays; k++) {
      const p = lerp(e.a, e.b, (k + 0.5) / bays),
        h = field(
          'court-pointed-bay',
          p,
          e.axis,
          normal,
          pitch * (d === 0 ? 0.73 : 0.72),
          0,
          6.4,
          3.05,
          0.95,
        );
      panel(face, h, d, pitch, 0, 9.2, 'wall');
      reveal(face, h, d, 0, -0.9, 'wall');
      if (d >= 2) {
        const reverse = (s, p, n) =>
          face(
            s,
            p,
            n.map((v) => -v),
          );
        panel(reverse, h, d, pitch, 0, 9.2, 'wall', -0.9);
      }
      const back = p.map((v, i) => v - normal[i] * 5.8),
        a = back.map((v, i) => v - (e.axis[i] * pitch) / 2),
        b = back.map((v, i) => v + (e.axis[i] * pitch) / 2);
      face('wall', [at(a, 0), at(b, 0), at(b, 8.9), at(a, 8.9)], [normal[0], 0, normal[1]]);
      if (d >= 2) {
        archBand(face, h, d, 0.23, 'trim', 0.04);
        if (k % 3 === 1) {
          const door = field('closed-aisle-door', back, e.axis, normal, 1.5, 0, 2.8, 1.7, 0.3);
          pane(face, door, d, 0.025, 'door');
        }
      }
    }
    if (d >= 1)
      for (let k = 1; k < bays; k++) {
        const p = lerp(e.a, e.b, k / bays),
          h = field('upper-spandrel-field', p, e.axis, normal, 0.9, 6.7, 1.4, 0.6, 0.6);
        // The shallow upper recess closes on masonry; no invented navigable room.
        pane(face, h, d, 0.035, 'trim');
      }
  }
  const back = plans.court.map((p, i) => {
    const a = edges(plans.court)[(i + 3) % 4].normal,
      b = edges(plans.court)[i].normal;
    return [p[0] + (a[0] + b[0]) * 5.8, p[1] + (a[1] + b[1]) * 5.8];
  });
  down(face, back, 8.9, 'roof', [plans.court]);
}
function enclosure(out, face, d) {
  sides(face, plans.outer, footing, 0, 'wall');
  const holes = [];
  if (d >= 1)
    for (const e of edges(plans.outer))
      if (e.length > 50) {
        const n = Math.round(e.length / 22);
        for (let k = 0; k < n; k++)
          holes.push({
            ...field(
              'outer-closed-door',
              lerp(e.a, e.b, (k + 0.5) / n),
              e.axis,
              e.normal,
              2.1,
              0.35,
              4,
              2.2,
              2.2,
            ),
          });
      }
  _shell(out, d, plans.outer, 0, 9.2, holes);
  for (const h of holes) {
    pane(face, h, d, -0.3, 'door');
    if (d >= 2) archBand(face, h, d, 0.3);
  }
  cap(face, plans.outer, 9.2, 'roof', [plans.court]);
  cap(face, plans.outer, 0.025, 'paving');
  courtArcades(out, face, d);
  // Outer crest only: photographed inner court roof edges remain plain.
  const spacing = d === 1 ? 14 : 2.8;
  for (const e of d === 0 ? [] : edges(plans.outer)) {
    const n = Math.max(1, Math.floor(e.length / spacing));
    for (let k = 0; k < n; k++) {
      const p = lerp(e.a, e.b, (k + 0.5) / n),
        w = d === 0 ? 2.5 : d === 1 ? 1.7 : 1.25;
      const r = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([u, v]) => p.map((x, i) => x + (e.axis[i] * u * w) / 2 + e.normal[i] * v * 0.32));
      profile(
        face,
        r,
        [
          [9.2, 1],
          [9.65, 1],
          [10.1, 0.3],
        ],
        'wall',
        p,
      );
    }
  }
  const q = [60, 1],
    ring = circle(q, 3.2, d === 0 ? 6 : d === 1 ? 8 : 16);
  profile(
    face,
    ring,
    [
      [9.2, 1],
      [10.3, 1],
      [11.5, 0.87],
      [12.5, 0.48],
      [13, 0.02],
    ],
    'roof',
    q,
  );
}
function fountain(out, face, d) {
  const r = plans.pavilion,
    q = center(r),
    inner = scaled(r, 0.81),
    holes = edges(r).map((e) =>
      field('fountain-open-arch', e.center, e.axis, e.normal, 4.8, 0, 6.1, 2.9, 4),
    );
  _shell(out, d, r, 0, 7.2, holes, 'trim', inner);
  down(face, r, 7.2, 'trim', [inner]);
  // An explicit ceiling closes the dome from below through all four real arches.
  down(face, inner, 7.2, 'roof');
  if (d >= 1) for (const h of holes) archBand(face, h, d, 0.35, 'wall');
  const basin = circle(q, 2.3, d === 0 ? 6 : 8);
  sides(face, basin, 0.03, 0.65, 'trim');
  cap(face, basin, 0.65, 'paving', [scaled(basin, 0.78)]);
  sides(face, scaled(basin, 0.78), 0.2, 0.65, 'trim', true);
  cap(face, scaled(basin, 0.78), 0.2, 'trim');
  const drum = circle(q, 5.8, 8);
  profile(
    face,
    drum,
    [
      [7.2, 1.07],
      [7.75, 1.07],
      [7.75, 1],
      [11.3, 1],
      [11.7, 0.96],
    ],
    'trim',
    q,
  );
  if (d >= 1)
    for (const e of edges(drum)) {
      const main = Math.abs(e.normal[0]) < 0.9 && Math.abs(e.normal[1]) < 0.9,
        h = field(
          'closed-drum-niche',
          e.center,
          e.axis,
          e.normal,
          main ? 1.6 : 1.2,
          main ? 8 : 8.8,
          main ? 2.9 : 1.7,
          main ? 1.6 : 0.8,
          0.5,
        );
      pane(face, h, d, 0.035, main ? 'door' : 'wall');
      if (d >= 2) archBand(face, h, d, 0.2, 'wall', 0.06);
    }
  const n = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 20 : d === 3 ? 28 : 32;
  const dome = circle(q, 5.65, n),
    levels =
      d <= 1
        ? [
            [11.7, 1],
            [14.6, 0.98],
            [17.7, 0.65],
            [19.6, 0.02],
          ]
        : [
            [11.7, 1],
            [13.3, 1.035],
            [15.3, 0.95],
            [17.2, 0.75],
            [18.7, 0.4],
            [19.6, 0.02],
          ];
  profile(face, dome, levels, 'dome', q);
  profile(
    face,
    circle(q, 0.22, d === 0 ? 4 : 8),
    d === 0
      ? [
          [19.6, 1],
          [20.6, 0.01],
        ]
      : [
          [19.6, 1],
          [19.9, 1],
          [20, 0.5],
          [20.12, 1.5],
          [20.3, 0.65],
          [20.6, 0.01],
        ],
    'gold',
    q,
  );
}
function minaret(_out, face, d) {
  const r = plans.tower,
    q = center(r),
    core = scaled(r, 0.67);
  sides(face, r, footing, 0, 'trim');
  _solid(face, core, 0, 18, 'trim');
  const es = edges(r),
    count = d === 0 ? 8 : d === 1 ? 24 : d === 2 ? 64 : d === 3 ? 96 : 128;
  for (let k = 0; k < count; k++) {
    const u = (k / count) * 4,
      v = ((k + 1) / count) * 4,
      i = Math.min(3, Math.floor(u)),
      t = u - i,
      t1 = Math.min(1, v - i),
      a = lerp(es[i].a, es[i].b, t),
      b = lerp(es[i].a, es[i].b, t1),
      ai = a.map((x, j) => q[j] + (x - q[j]) * 0.67),
      bi = b.map((x, j) => q[j] + (x - q[j]) * 0.67),
      y = ((k + 1) / count) * 18,
      prev = (k / count) * 18;
    cap(face, [a, b, bi, ai], y, 'trim');
    face(
      'trim',
      [at(a, 0), at(b, 0), at(b, y + 0.85), at(a, y + 0.85)],
      [es[i].normal[0], 0, es[i].normal[1]],
    );
    const ain = a.map((x, j) => q[j] + (x - q[j]) * 0.95),
      bin = b.map((x, j) => q[j] + (x - q[j]) * 0.95);
    cap(face, [a, b, bin, ain], y + 0.85, 'trim');
    face(
      'trim',
      [at(ain, y), at(bin, y), at(bin, y + 0.85), at(ain, y + 0.85)],
      [-es[i].normal[0], 0, -es[i].normal[1]],
    );
    face('trim', [at(a, prev), at(ai, prev), at(ai, y), at(a, y)]);
  }
  if (d >= 1) {
    const e = edges(core)[0];
    for (const u of [-1, 1]) {
      const p = e.center.map((x, i) => x + e.axis[i] * u * 1.1),
        h = field('paired-ramp-base-recess', p, e.axis, e.normal, 1.15, 6.4, 3.2, 1.8, 0.4);
      pane(face, h, d, 0.025, 'door');
    }
  }
  const n = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 20 : d === 3 ? 28 : 32;
  profile(
    face,
    circle(q, 4.2, n),
    [
      [18, 1],
      [30.3, 1],
      [30.8, 0.95],
    ],
    'trim',
    q,
  );
  profile(
    face,
    circle(q, 2.35, 8),
    [
      [30.8, 1],
      [34.7, 0.72],
      [35.2, 1.25],
      [35.6, 1.25],
    ],
    'trim',
    q,
  );
  const lantern = circle(q, 1.7, 8);
  profile(
    face,
    lantern,
    [
      [35.6, 1],
      [38.6, 1],
    ],
    'trim',
    q,
  );
  if (d >= 1)
    for (const e of edges(lantern)) {
      const h = field('upper-lantern-recess', e.center, e.axis, e.normal, 0.65, 36, 2, 0.9, 0.5);
      pane(face, h, d, 0.025, 'door');
      if (d >= 2) archBand(face, h, d, 0.17);
    }
  profile(
    face,
    circle(q, 1.75, n),
    [
      [38.6, 1],
      [39.1, 0.95],
      [39.6, 0.65],
      [40, 0.03],
    ],
    'trim',
    q,
  );
  profile(
    face,
    circle(q, 0.16, d === 0 ? 4 : 8),
    d === 0
      ? [
          [40, 1],
          [40.44, 0.01],
        ]
      : [
          [40, 1],
          [40.2, 1],
          [40.3, 0.5],
          [40.44, 0.01],
        ],
    'gold',
    q,
  );
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
    face = writer(out, d);
  enclosure(out, face, d);
  fountain(out, face, d);
  minaret(out, face, d);
}
export const buildTulunSkyline = (o) => build(o, 0),
  buildTulunDistrict = (o) => build(o, 1),
  buildTulunStreet = (o) => build(o, 2),
  buildTulunCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const tulunStudy = {
  id: 'N0435',
  key: 'mosque_of_ibn_tulun',
  title: 'Mosque of Ibn Tulun',
  category: 'mosque',
  wikidataId: 'Q915413',
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
    'Six existing shared256² brick,sandstone,limestone,lime plaster,plain wood and cast bronze graphs,seven merged groups with metric UVs/linear tints. Zero embedded pictures,unique texture atlases,baked lighting or copied inscriptions.',
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
    'Three mapped controls preserve the mosque court,offset fountain pavilion and separate minaret. Pictures guide pointed court arcades,small upper fields,outer crest,pale roofs,open fountain arches/octagonal drum/ochre dome and square wrapping ramp/plain cylindrical drum/two upper minaret stages/round cap. Skyline merges court bays to4per side,omits crest and coarsens ramp/drums;district uses9court bays per side;near uses18. Small upper fields,drum/base/lantern recesses close on backing surfaces and do not establish interiors. Square lower ramp is a coarse visualization,not a traversable surveyed stair. Fine carving/calligraphy,exact spandrel motifs,handrails,unseen roofs/rooms/stairs and outer ziyada enclosure omitted or unverified. Standard DEM establishes an approximate flat working floor;exact terrace/threshold contacts and physical-device performance unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('square-ramp-and-upper-minaret', [-117, 40, 17], [-84, 27, -15]),
    cam('open-fountain-and-ochre-dome', [-42, 20, 35], [-15.5, 18, 0]),
    cam('pointed-court-bays', [0, 11, 26], [0, 12, 46]),
    cam('deep-prayer-range', [65, 65, 95], [35, 12, 0]),
    cam('offset-pavilion-and-court', [-10, 155, 0.1], [-10, 10, 0]),
    cam('minaret-round-upper-stages', [-101, 46, 6], [-84, 42, -15]),
  ],
};

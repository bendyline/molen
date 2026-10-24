/** Saint Petersburg Mosque: granite shell,twin tapered minarets,blue ribbed dome and tiled portals. */
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
  '../../../content/worldgen/source/places/ud/udt/saint_petersburg_mosque/',
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
  wall: '#b7bdb9',
  trim: '#deddd0',
  blue: '#57a7bc',
  pale: '#dddcc5',
  roof: '#9ba5a4',
  door: '#957760',
  window: '#697e86',
  gold: '#c6aa62',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, petersburgGround(...p) - 0.35);
export function petersburgGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Saint Petersburg Mosque footing outside retained terrain');
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
  _circle = (p, r, n) =>
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
function _down(face, r, y, slot, holes = []) {
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
function _panel(face, h, d, width, bottom, top, slot, offset = 0) {
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
function _reveal(face, h, d, front, back, slot = 'wall') {
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
export function petersburgPortals() {
  return [
    {
      ...field(
        'main-tower-end-portal',
        [-23.35, -1.7],
        [0, 1],
        [-1, 0],
        8.4,
        0.45,
        17.8,
        10.4,
        6.2,
      ),
      kind: 'portal',
      back: -3,
      frameWidth: 11.4,
      frameHeight: 21.7,
    },
    {
      ...field('projecting-side-portal', [-12.75, 17.75], [1, 0], [0, 1], 5.6, 0.45, 11.7, 7.0, 4),
      kind: 'portal',
      back: -1.8,
      frameWidth: 8.1,
      frameHeight: 15.3,
    },
  ].map((h) => {
    const e = facadeEdge(h.normal, h.center),
      u = (h.center[0] - e.a[0]) * e.axis[0] + (h.center[1] - e.a[1]) * e.axis[1];
    return { ...h, center: e.a.map((v, k) => v + e.axis[k] * u), axis: e.axis, normal: e.normal };
  });
}
function facadeEdge(normal, p) {
  return edges(plans.whole.outline)
    .filter((e) => e.normal[0] * normal[0] + e.normal[1] * normal[1] > 0.9)
    .sort((a, b) => {
      const dist = (e) =>
        Math.abs((p[0] - e.center[0]) * e.normal[0] + (p[1] - e.center[1]) * e.normal[1]);
      return dist(a) - dist(b);
    })[0];
}
export function petersburgWindows(d = 4) {
  const hs = [];
  for (const [normal, centers] of [
    [[0, 1], [0, 7, 14, 20].map((x) => [x, 14.4])],
    [[0, -1], [-9, -1, 7, 15, 20].map((x) => [x, -17.89])],
    [[1, 0], [-11, -4, 4, 10].map((z) => [23.4, z])],
  ])
    for (const [i, p] of centers.entries()) {
      if (d === 0 && i % 2) continue;
      const e = facadeEdge(normal, p),
        t = (p[0] - e.a[0]) * e.axis[0] + (p[1] - e.a[1]) * e.axis[1],
        q = e.a.map((v, k) => v + e.axis[k] * t);
      hs.push({
        ...field(`pointed-window-${hs.length}`, q, e.axis, e.normal, 2.3, 3.6, 10.2, 7.2, 1.1),
        kind: 'window',
        back: -0.48,
      });
      if (d >= 1)
        hs.push({
          ...field(`oculus-${hs.length}`, q, e.axis, e.normal, 1.45, 16.5, 1.45, 0, 1.1),
          shape: 'circle',
          kind: 'window',
          back: -0.48,
        });
    }
  return hs;
}
export function petersburgTowerFields(d = 4) {
  const hs = [];
  for (const t of plans.towers) {
    const ring = scaled(
        d === 0
          ? Array.from({ length: 8 }, (_, i) => t.ring[Math.floor((i * t.ring.length) / 8)])
          : t.ring,
        1.1,
      ),
      es = edges(ring),
      n = d >= 3 ? 8 : 4,
      used = new Set();
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        normal = [Math.cos(a), Math.sin(a)],
        e = es.toSorted(
          (a, b) =>
            b.normal[0] * normal[0] +
            b.normal[1] * normal[1] -
            (a.normal[0] * normal[0] + a.normal[1] * normal[1]),
        )[0];
      if (used.has(e)) continue;
      used.add(e);
      hs.push({
        ...field(`tower-${t.id}-${i}`, e.center, e.axis, e.normal, 0.75, 36.4, 3.6, 2.7, 0.85),
        body: t.id,
        kind: 'window',
        back: -0.36,
      });
    }
  }
  return hs;
}
function strip(face, h, u0, u1, y0, y1, slot, dep = 0.06) {
  face(
    slot,
    [
      point(h, u0, floor + y0, dep),
      point(h, u1, floor + y0, dep),
      point(h, u1, floor + y1, dep),
      point(h, u0, floor + y1, dep),
    ],
    [h.normal[0], 0, h.normal[1]],
  );
}
function portalPanel(face, h, d) {
  const open = openingShape(h, d),
    p = [
      [-h.frameWidth / 2, floor],
      [h.frameWidth / 2, floor],
      [h.frameWidth / 2, floor + h.frameHeight],
      [-h.frameWidth / 2, floor + h.frameHeight],
      ...open,
    ],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      'blue',
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], 0.04)),
      [h.normal[0], 0, h.normal[1]],
    );
  if (d < 1) return;
  archBand(face, h, d, 0.32, 'pale', 0.07);
  const w = h.frameWidth / 2;
  strip(face, h, -w + 0.24, -w + 0.55, 0.3, h.frameHeight - 0.3, 'pale');
  strip(face, h, w - 0.55, w - 0.24, 0.3, h.frameHeight - 0.3, 'pale');
  strip(face, h, -w + 0.25, w - 0.25, h.frameHeight - 0.68, h.frameHeight - 0.35, 'pale');
  strip(face, h, -w + 0.7, w - 0.7, h.height + 1.4, h.height + 1.8, 'pale');
  if (d >= 2)
    for (const u of [-w + 0.9, w - 0.9])
      for (const y of [h.frameHeight * 0.3, h.frameHeight * 0.6])
        face(
          'pale',
          [
            point(h, u, floor + y - 0.7, 0.085),
            point(h, u + 0.45, floor + y, 0.085),
            point(h, u, floor + y + 0.7, 0.085),
            point(h, u - 0.45, floor + y, 0.085),
          ],
          [h.normal[0], 0, h.normal[1]],
        );
}
function recess(face, h, d) {
  if ((d === 0 || (d === 1 && h.shape === 'circle')) && h.kind === 'window') {
    pane(face, h, d, 0.02, 'window');
    if (d === 1) archBand(face, h, d, 0.18, 'trim', 0.04);
    return;
  }
  _reveal(face, h, d, 0, h.back, h.kind === 'portal' ? 'blue' : 'wall');
  pane(face, h, d, h.back, h.kind === 'portal' ? 'pale' : 'window');
  if (h.kind === 'portal') {
    const door = {
      ...h,
      width: h.frameWidth > 10 ? 3.2 : 2.4,
      height: 4.8,
      spring: 3.5,
      bottom: floor + 0.45,
    };
    pane(face, door, d, h.back + 0.035, 'door');
    if (d >= 1) archBand(face, door, d, 0.18, 'blue', h.back + 0.06);
    if (d >= 2)
      for (let k = 0; k < 3; k++) {
        const t = (k + 1) / 4,
          band = {
            ...h,
            width: h.width * (1 - 0.13 * t),
            height: h.height - 0.45 * t,
            spring: h.spring - 0.1 * t,
            bottom: h.bottom + 0.05,
          };
        archBand(face, band, d, 0.18, 'blue', h.back * t);
      }
  } else if (d >= 1) archBand(face, h, d, 0.18, 'trim', 0.04);
}
function hall(out, face, d) {
  const hs = [...petersburgPortals(), ...petersburgWindows(d)],
    mask = hs
      .filter((h) => d > 1 || (d === 1 && h.shape !== 'circle') || h.kind === 'portal')
      .map((h) => prepareOpening(h, 0, d)),
    mf = writer(masked(out, mask), d);
  for (const p of plans.mass) {
    sides(mf, p.outline, footing, 22, 'wall');
    for (const h of p.holes) sides(mf, h, footing, 22, 'wall', true);
  }
  for (const p of plans.roofTiers[d].roof) cap(mf, p.outline, 22, 'roof', p.holes);
  for (const h of hs) {
    recess(face, h, d);
    if (h.kind === 'portal') portalPanel(face, h, d);
  }
  if (d >= 1) {
    sides(mf, scaled(plans.whole.outline, 1.003), 21.5, 21.9, 'trim');
    sides(mf, scaled(plans.whole.outline, 1.001), 5.6, 5.8, 'trim');
  }
  cap(face, plans.whole.outline, 0.1, 'roof');
}
function moon(face, d, q, y, r) {
  const polys = plans.unitCrescents[d],
    th = 0.09;
  for (const p of polys) {
    const pts = [...p.outline, ...p.holes.flat()],
      starts = [];
    let n = p.outline.length;
    for (const h of p.holes) {
      starts.push(n);
      n += h.length;
    }
    const ids = earcut(pts.flat(), starts, 2),
      map = (p, z) => [q[0] + p[0] * r, floor + y + p[1] * r, q[1] + z];
    for (const z of [-th / 2, th / 2])
      for (let i = 0; i < ids.length; i += 3)
        face(
          'gold',
          ids.slice(i, i + 3).map((k) => map(pts[k], z)),
          [0, 0, Math.sign(z)],
        );
    for (const ring of [p.outline, ...p.holes])
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length];
        face('gold', [map(a, -th / 2), map(b, -th / 2), map(b, th / 2), map(a, th / 2)]);
      }
  }
}
function diamond(face, e, y, u = 0, scale = 1) {
  const h = { center: e.center, axis: e.axis, normal: e.normal };
  face(
    'pale',
    [
      point(h, u, floor + y - scale, 0.025),
      point(h, u + scale * 0.55, floor + y, 0.025),
      point(h, u, floor + y + scale, 0.025),
      point(h, u - scale * 0.55, floor + y, 0.025),
    ],
    [e.normal[0], 0, e.normal[1]],
  );
}
function minarets(out, face, d) {
  for (const t of plans.towers) {
    const r = t.ring,
      q = t.center;
    profile(
      face,
      r,
      [
        [0, 1],
        [22, 1],
        [33.2, 0.76],
        [34.5, 1.1],
      ],
      'wall',
      q,
    );
    const coarse = Array.from({ length: 8 }, (_, i) => r[Math.floor((i * r.length) / 8)]),
      ring = scaled(d === 0 ? coarse : r, 1.1),
      hs = petersburgTowerFields(d).filter((h) => h.body === t.id),
      mf =
        d === 0
          ? face
          : writer(
              masked(
                out,
                hs.map((h) => prepareOpening(h, 0, d)),
              ),
              d,
            );
    sides(mf, ring, 34.45, 41.5, 'wall');
    cap(face, ring, 41.5, 'wall');
    for (const h of hs) recess(face, h, d);
    if (d >= 1) {
      sides(face, scaled(r, 1.12), 34.7, 35.1, 'trim');
      const es = edges(ring),
        stride = d === 1 ? 4 : 2;
      for (let i = 0; i < es.length; i += stride) {
        const e = es[i],
          p = e.center,
          rr = _rect(p[0], p[1], 0.55, 0.55);
        profile(
          face,
          rr,
          [
            [41.5, 1],
            [41.8, 1],
            [42.15, 0.05],
          ],
          'wall',
          p,
        );
      }
    }
    const pr = scaled(d === 0 ? coarse : r, 0.5);
    sides(face, pr, 41.45, 45.85, 'blue');
    cap(face, pr, 45.85, 'blue');
    if (d >= 1) {
      sides(face, scaled(pr, 1.02), 42.15, 42.4, 'pale');
      sides(face, scaled(pr, 1.02), 45.1, 45.35, 'pale');
      const es = edges(pr);
      for (let i = 0; i < es.length; i += d === 1 ? 4 : 2) diamond(face, es[i], 43.7, 0, 0.65);
    }
    const capRing =
      d >= 2
        ? scaled(r, 0.58).flatMap((a, i, rs) => {
            const b = rs[(i + 1) % rs.length],
              m = lerp(a, b, 0.5);
            return [a, m.map((v, k) => q[k] + (v - q[k]) * 0.97)];
          })
        : scaled(coarse, 0.58);
    profile(
      face,
      capRing,
      [
        [45.8, 0.8],
        [46.15, 1],
        [46.85, 0.77],
        [47.4, 0.05],
      ],
      'blue',
      q,
    );
    profile(
      face,
      _rect(...q, 0.11, 0.11),
      [
        [47.3, 1],
        [47.8, 1],
      ],
      'gold',
      q,
    );
    moon(face, d, q, 47.65, 0.35);
  }
}
function dome(face, d) {
  const r = plans.roofTiers[d].ring,
    q = plans.domeCenter;
  profile(
    face,
    r,
    [
      [21.95, 1],
      [25.8, 1],
    ],
    'wall',
    q,
  );
  sides(face, scaled(r, 1.015), 25.5, 25.85, 'trim');
  const levels =
    d === 0
      ? [
          [25.8, 1],
          [33.5, 1],
          [36.7, 0.65],
          [37.8, 0.008],
        ]
      : [
          [25.8, 1],
          [32.8, 1],
          [35.2, 0.91],
          [36.8, 0.6],
          [37.65, 0.17],
          [37.8, 0.008],
        ];
  profile(face, r, levels, 'blue', q);
  if (d >= 1) {
    sides(face, scaled(r, 1.003), 26.4, 26.75, 'pale');
    sides(face, scaled(r, 1.003), 27.25, 27.5, 'pale');
    const es = edges(r);
    for (let i = 0; i < es.length; i += d === 1 ? 2 : 4) diamond(face, es[i], 30.3, 0, 0.75);
  }
  profile(
    face,
    _rect(...q, 0.14, 0.14),
    [
      [37.7, 1],
      [38.55, 1],
    ],
    'gold',
    q,
  );
  moon(face, d, q, 38.5, 0.5);
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
  hall(out, face, d);
  minarets(out, face, d);
  dome(face, d);
}
export const buildPetersburgSkyline = (o) => build(o, 0),
  buildPetersburgDistrict = (o) => build(o, 1),
  buildPetersburgStreet = (o) => build(o, 2),
  buildPetersburgCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const petersburgStudy = {
  id: 'saint_petersburg_mosque',
  key: 'saint_petersburg_mosque',
  title: 'Saint Petersburg Mosque',
  category: 'mosque',
  wikidataId: 'Q281900',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared256² granite,limestone,mosaic tile,standing-seam metal,plain wood and bronze graphs;eight merged roles including opaque local window glass. Metric UVs and linear tints. Broad stepped portal vaults and sparse original geometric tile accents;no embedded images,unique atlas,baked lighting or copied motifs/calligraphy.',
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
    'Medium-fi exterior. Portals close on tile backings and wood door proxies;façade/chamber windows close on opaque glass. Three broad stepped arch bands abstract the portal vault;no detailed copied muqarnas or calligraphy. Exact rear/roof elevations,window counts,corbel/lobe/rib profiles,current condition,interior rooms/stairs,finial orientation,street/paving joins and walking remain unverified. Raw DEM is retained;visible-model base cutout prevents interior terrain burial. Skyline coarsens dome/crescent and uses flat window proxies. Physical-device performance remains unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('tiled-main-portal', [-62, 20, 0], [-23, 12, -1.7]),
    cam('projecting-side-portal', [-18, 16, 51], [-12.75, 9, 17.7]),
    cam('blue-ribbed-dome', [41, 44, 36], [6.7, 29, -1.3]),
    cam('twin-tapered-minarets', [-55, 39, 32], [-18, 31, -2]),
    cam('arched-stone-windows', [44, 17, 37], [14, 11, 14]),
    cam('mapped-body-and-three-caps', [0, 170, 0.1], [0, 15, 0]),
  ],
};

/** Al-Azhar: open decorated court,five distinct minarets and paired western portals. */
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
  if (h.shape === 'horseshoe') {
    const r = h.width / 2,
      ry = (h.height - h.spring) / 1.5,
      n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 10 : d === 3 ? 14 : 18,
      neck = Math.cos(Math.PI / 6) * r,
      cy = h.bottom + h.spring + ry * 0.5;
    return [
      [-neck, h.bottom],
      [neck, h.bottom],
      ...Array.from({ length: n + 1 }, (_, i) => {
        const a = -Math.PI / 6 + ((i / n) * Math.PI * 4) / 3;
        return [r * Math.cos(a), cy + ry * Math.sin(a)];
      }),
    ];
  }
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
  '../../../content/worldgen/source/places/st/stq/n0445_al_azhar_mosque/',
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
  wall: '#cbb99a',
  trim: '#e3dcc7',
  paving: '#ddd9cb',
  roof: '#e2ded1',
  dome: '#c9bfaa',
  door: '#8b785d',
  gold: '#ae9666',
  glass: '#536575',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, azharGround(...p) - 0.35);
export function azharGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('al-Azhar Mosque footing outside retained terrain');
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
export function azharArcades(d) {
  const holes = [];
  for (const e of edges(plans.court)) {
    const n = d === 0 ? 3 : Math.round(e.length / 4.4),
      pitch = e.length / n,
      normal = e.normal.map((v) => -v);
    for (let k = 0; k < n; k++)
      holes.push({
        ...field(
          `court-${holes.length}`,
          lerp(e.a, e.b, (k + 0.5) / n),
          e.axis,
          normal,
          pitch * 0.76,
          0.025,
          5.2,
          3.3,
          1,
        ),
        pitch,
        edge: e,
      });
  }
  return holes;
}
function arcade(_out, face, d) {
  for (const h of azharArcades(d)) {
    panel(face, h, d, h.pitch, 0, 8.2, 'roof');
    if (d >= 1) reveal(face, h, d, 0, -0.6, 'roof');
    if (d >= 2)
      panel(
        (s, p, n) =>
          face(
            s,
            p,
            n.map((v) => -v),
          ),
        h,
        d,
        h.pitch,
        0,
        8.2,
        'roof',
        -0.6,
      );
    const a = h.center.map((v, k) => v - h.normal[k] * 5 - (h.axis[k] * h.pitch) / 2),
      b = h.center.map((v, k) => v - h.normal[k] * 5 + (h.axis[k] * h.pitch) / 2);
    face('wall', [at(a, 0), at(b, 0), at(b, 8), at(a, 8)], [h.normal[0], 0, h.normal[1]]);
    if (d >= 2) {
      archBand(face, h, d, 0.16, 'trim', 0.035);
      const q = h.center.map((v, k) => v - (h.axis[k] * h.pitch) / 2);
      for (const u of [-0.19, 0.19]) {
        const p = q.map((v, k) => v + h.axis[k] * u + h.normal[k] * 0.1);
        profile(
          face,
          circle(p, 0.18, d === 2 ? 6 : 8),
          d === 2
            ? [
                [0.025, 1.2],
                [3.1, 1],
                [3.3, 1.4],
              ]
            : [
                [0.025, 1.5],
                [0.24, 1.5],
                [0.34, 1],
                [3.05, 0.9],
                [3.18, 1.5],
                [3.3, 1.5],
              ],
          'trim',
          p,
        );
      }
      const med = {
        ...field('round-medallion', q, h.axis, h.normal, 1.05, 6.25, 1.05, 0.5, 0.3),
        shape: 'circle',
      };
      pane(face, med, d === 2 ? 1 : d, 0.025, 'trim');
      const blind = {
        ...h,
        name: 'blind-upper-field',
        width: 1.25,
        bottom: floor + 5.9,
        height: 1.9,
        spring: 1.15,
      };
      archBand(face, blind, d, 0.13, 'trim', 0.04);
    }
  }
  down(face, plans.galleryBack, 7.98, 'roof', [plans.court]);
  if (d >= 1)
    for (const e of edges(plans.court)) {
      const n = Math.round(e.length / (d === 1 ? 12 : d === 2 ? 5.8 : 3.8));
      for (let k = 0; k < n; k++) {
        const p = lerp(e.a, e.b, (k + 0.5) / n);
        profile(
          face,
          _rect(...p, 0.55, 0.55),
          d <= 2
            ? [
                [8.2, 1],
                [9.05, 0.35],
              ]
            : [
                [8.2, 1],
                [8.55, 1],
                [8.85, 0.55],
                [9.05, 0.35],
              ],
          'trim',
          p,
        );
      }
    }
}
export function azharGates() {
  const e = edges(plans.outer).find((e) => e.normal[0] < -0.95 && e.length > 50),
    t = (0 - e.a[1]) / (e.b[1] - e.a[1]),
    q = lerp(e.a, e.b, t);
  return [-2.5, 2.5].map((z, i) => ({
    ...field(`west-paired-gate-${i}`, [q[0], z], [0, -1], [-1, 0], 3.6, 0.025, 4.8, 3, 1),
    shape: 'round',
  }));
}
function ranges(out, face, d) {
  sides(face, plans.outer, footing, 0, 'wall');
  const gates = azharGates();
  _shell(out, d, plans.outer, 0, 8.2, gates, 'wall');
  cap(face, plans.outer, 8.2, 'roof', [plans.court]);
  cap(face, plans.outer, 0.025, 'paving');
  for (const h of gates) {
    const back = { ...h, center: h.center.map((v, k) => v - h.normal[k] * 3.5) };
    pane(face, back, d, 0.04, 'door');
    if (d >= 1) {
      archBand(face, h, d, 0.28, 'trim', 0.035);
      archBand(face, { ...h, width: 4.65, height: 7.3, spring: 4.9 }, d, 0.24, 'trim', 0.04);
    }
  }
  for (const [polys, top] of [
    [plans.upperHall, 11.4],
    [plans.northRange, 13.3],
  ])
    for (const p of polys) {
      sides(face, p.outline, 8.2, top, 'wall');
      // Small domes rise on drums;the flat roof is their closed backing,not an open interior.
      cap(face, p.outline, top, 'roof', p.holes);
      if (d >= 1)
        for (const e of edges(p.outline))
          if (e.length > 8) {
            const n = Math.floor(e.length / (d === 1 ? 12 : 5.4));
            for (let k = 0; k < n; k++)
              for (const y of d >= 2 ? [3.5, 9.1] : [9.1]) {
                const h = {
                  ...field(
                    'raised-range-opaque-window',
                    lerp(e.a, e.b, (k + 0.5) / n),
                    e.axis,
                    e.normal,
                    1,
                    y,
                    1.8,
                    1,
                    0.4,
                  ),
                  shape: 'rect',
                };
                // Only the raised row belongs on this upper shell;lower row is on the whole perimeter.
                if (y < 8.2) continue;
                pane(face, h, d, 0.035, 'glass');
                if (d >= 2) archBand(face, h, d, 0.12, 'trim', 0.05);
              }
          }
    }
  if (d >= 2)
    for (const e of edges(plans.outer))
      if (e.length > 12) {
        const n = Math.floor(e.length / 7);
        for (let k = 0; k < n; k++) {
          const q = lerp(e.a, e.b, (k + 0.5) / n);
          if (e.normal[0] < -0.95 && Math.abs(q[1]) < 8) continue;
          const h = {
            ...field('outer-opaque-window', q, e.axis, e.normal, 0.9, 3.5, 1.7, 1, 0.4),
            shape: 'rect',
          };
          pane(face, h, d, 0.035, 'glass');
        }
      }
  arcade(out, face, d);
  if (d >= 1) {
    const q = [-34.8, -10];
    _solid(face, _rect(...q, 1.8, 2.6), 4.7, 6.7, 'door');
    _solid(face, _rect(...q, 2.4, 3.1), 6.7, 6.9, 'door');
    for (const p of [
      [-35.6, -11.1],
      [-35.6, -8.9],
      [-34, -11.1],
      [-34, -8.9],
    ])
      profile(
        face,
        circle(p, 0.09, 4),
        [
          [6.9, 1],
          [8, 1],
        ],
        'door',
        p,
      );
    _solid(face, _rect(...q, 2.8, 3.3), 8, 8.15, 'door');
  }
}
function dome(face, q, r, b, t, d, slot = 'dome') {
  const n = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 24 : 32,
    ring = circle(q, r, n);
  profile(
    face,
    ring,
    d === 0
      ? [
          [b, slot === 'wall' ? 0.58 : 1],
          [b + (t - b) * 0.6, slot === 'wall' ? 1 : 0.8],
          [t, 0.015],
        ]
      : slot === 'wall'
        ? [
            [b, 0.58],
            [b + (t - b) * 0.22, 0.93],
            [b + (t - b) * 0.5, 1],
            [b + (t - b) * 0.8, 0.65],
            [t, 0.015],
          ]
        : [
            [b, 1],
            [b + (t - b) * 0.25, 1],
            [b + (t - b) * 0.62, 0.8],
            [b + (t - b) * 0.87, 0.43],
            [t, 0.015],
          ],
    slot,
    q,
  );
  if (d >= 1)
    profile(
      face,
      circle(q, 0.1, d === 0 ? 4 : 6),
      [
        [t, 1],
        [t + 0.7, 0.01],
      ],
      'gold',
      q,
    );
  if (d >= 3)
    for (let k = 0; k < n; k += 2) {
      const a = (k * 2 * Math.PI) / n,
        pts = [
          [b, 1],
          [b + (t - b) * 0.25, 1],
          [b + (t - b) * 0.62, 0.8],
          [b + (t - b) * 0.87, 0.43],
          [t, 0.015],
        ];
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i - 1],
          z = pts[i],
          w = 0.035;
        face(
          'trim',
          [
            [
              q[0] + Math.cos(a - w) * r * p[1] * 1.006,
              floor + p[0],
              q[1] + Math.sin(a - w) * r * p[1] * 1.006,
            ],
            [
              q[0] + Math.cos(a + w) * r * p[1] * 1.006,
              floor + p[0],
              q[1] + Math.sin(a + w) * r * p[1] * 1.006,
            ],
            [
              q[0] + Math.cos(a + w) * r * z[1] * 1.006,
              floor + z[0],
              q[1] + Math.sin(a + w) * r * z[1] * 1.006,
            ],
            [
              q[0] + Math.cos(a - w) * r * z[1] * 1.006,
              floor + z[0],
              q[1] + Math.sin(a - w) * r * z[1] * 1.006,
            ],
          ],
          [Math.cos(a), 0.3, Math.sin(a)],
        );
      }
    }
}
export function azharTowerFields(t, d) {
  if (d <= 1 || t.kind === 'pencil') return [];
  const hs = [],
    ring = circle(t.center, t.radius, 8),
    top = t.height * 0.53;
  for (const [i, e] of edges(ring).entries()) {
    if (d === 1 && i % 2) continue;
    for (const y of d === 1 ? [top - 4.6] : [12, top - 5])
      hs.push({
        ...field(
          `${t.name}-shaft-recess-${hs.length}`,
          e.center,
          e.axis,
          e.normal,
          t.radius * 0.4,
          y,
          2.5,
          1.7,
          0.8,
        ),
        ring,
      });
  }
  return hs;
}
function pavilion(face, q, r, b, t, d) {
  const n = d === 0 ? 4 : 8;
  if (d === 0) {
    profile(
      face,
      circle(q, r, n),
      [
        [b, 1],
        [t, 1],
      ],
      'wall',
      q,
    );
    return;
  }
  for (let k = 0; k < 6; k++) {
    const a = (k * Math.PI) / 3,
      p = [q[0] + Math.cos(a) * r * 0.8, q[1] + Math.sin(a) * r * 0.8];
    profile(
      face,
      circle(p, r * 0.13, d === 1 ? 4 : 6),
      [
        [b, 1],
        [t, 1],
      ],
      'wall',
      p,
    );
  }
  profile(
    face,
    circle(q, r * 1.06, n),
    [
      [t - 0.2, 1],
      [t + 0.05, 1],
    ],
    'trim',
    q,
  );
}
function minaret(out, face, t, d) {
  const q = t.center,
    r = t.radius,
    h = t.height,
    n = d === 0 ? 4 : 8;
  if (t.kind === 'pencil') {
    profile(
      face,
      circle(q, r, n),
      [
        [0, 1.15],
        [h * 0.6, 1],
        [h * 0.63, 1.45],
        [h * 0.67, 1.45],
        [h * 0.69, 0.9],
        [h * 0.86, 0.8],
        [h * 0.995, 0.015],
      ],
      'wall',
      q,
    );
    profile(
      face,
      circle(q, 0.1, 4),
      [
        [h * 0.995, 1],
        [h, 0.01],
      ],
      'gold',
      q,
    );
    return;
  }
  const first = h * 0.53,
    second = h * 0.73,
    upper = h * 0.9,
    fields = azharTowerFields(t, d),
    ring = circle(q, r, n);
  _shell(out, d, ring, 0, first, fields, 'wall');
  cap(face, ring, first, 'wall');
  for (const f of fields) {
    pane(face, f, d, -0.25, 'door');
    if (d >= 2) archBand(face, f, d, 0.13, 'trim', 0.025);
  }
  profile(
    face,
    circle(q, r, n),
    [
      [first - 0.3, 1],
      [first + 0.5, 1.4],
      [first + 1.4, 1.4],
      [first + 1.5, 0.82],
      [second - 0.5, 0.78],
      [second + 0.25, 1.18],
      [second + 1, 1.18],
    ],
    'wall',
    q,
  );
  if (t.kind === 'double') {
    for (const u of [-1, 1]) {
      const p = [q[0], q[1] + u * r * 0.48];
      pavilion(face, p, r * 0.53, second + 1, upper, d);
      dome(face, p, r * 0.59, upper, h - 0.7, d, 'wall');
    }
  } else {
    pavilion(face, q, r * 0.77, second + 1, upper, d);
    dome(face, q, r * 0.85, upper, h - 0.7, d, 'wall');
  }
  if (d >= 2) {
    // Balcony rails are merged opaque low walls;fine pierced carving is intentionally abstract.
    for (const y of [first + 1.25, second + 0.85])
      sides(face, circle(q, r * (y < second ? 1.4 : 1.18), 12), y, y + 0.35, 'trim');
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
    face = writer(out, d);
  ranges(out, face, d);
  for (const v of rec.domes) {
    profile(
      face,
      circle(v.center, v.radius * 0.91, d === 0 ? 6 : 12),
      [
        [8.2, 1],
        [v.base, 1],
      ],
      'wall',
      v.center,
    );
    dome(face, v.center, v.radius, v.base, v.top, d);
  }
  for (const t of rec.towers) minaret(out, face, t, d);
}
export const buildAzharSkyline = (o) => build(o, 0),
  buildAzharDistrict = (o) => build(o, 1),
  buildAzharStreet = (o) => build(o, 2),
  buildAzharCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const azharStudy = {
  id: 'N0445',
  key: 'al_azhar_mosque',
  title: 'al-Azhar Mosque',
  category: 'mosque',
  wikidataId: 'Q312342',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures inspected only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five shared256² sandstone,limestone,lime plaster,plain wood and cast bronze graphs;eight merged roles including the opaque untextured glass exception. Metric UVs and linear tints,no embedded images,unique atlases,baked lighting or copied artwork.',
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
    'Three inspected pictures guide the open pointed court arcades,paired columns,medallion/blind field cadence,flat and raised windowed ranges,pale domes,five unequal minarets including paired al-Ghuri bulbs,and paired western gate. Court,galleries,individual towers,domes and raised ranges have picture-proportioned positions,not mapped sub-footprints. Portals close on wood backings;galleries close on masonry backs;minaret shaft recesses close on wood proxies,pavilions are open near;no navigable interiors. Rectangular outer windows are opaque surface proxies. Fine carved motifs,inscriptions,exact spolia,window cadence,unseen rooms/roofs,current finish,precise access/thresholds/street joins,engineering and physical-device performance remain unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('paired-bulb-and-single-bulb-minarets', [-80, 43, 35], [-43, 36, -5]),
    cam('pointed-arcades-and-medallions', [-10, 8, 7], [-10, 6, 22]),
    cam('paired-western-portals', [-84, 9, 8], [-63, 5, 0]),
    cam('pale-domes-and-raised-roof', [83, 36, 37], [40, 14, 2]),
    cam('whole-courtyard-and-five-minarets', [0, 180, 0.1], [0, 5, 0]),
    cam('slender-pointed-minaret', [55, 37, 72], [55, 26, 42]),
  ],
};

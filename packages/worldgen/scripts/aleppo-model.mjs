/** Great Mosque of Aleppo: square minaret, arcaded court and paired domed pavilions. */
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
  '../../../content/worldgen/source/places/sy/sy6/great_mosque_of_aleppo/',
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
  wall: '#d7cfba',
  roof: '#bcb7a8',
  trim: '#e7dfcc',
  dome: '#a5adb0',
  door: '#ab8760',
  accent: '#727b83',
  glass: '#5e7182',
  stripe: '#777f86',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, aleppoGround(...p) - 0.35);
export function aleppoGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Great Mosque of Aleppo footing outside retained terrain');
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
function shell(out, d, r, b, t, holes = [], slot = 'wall', inner = null) {
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
const rect = (x, z, w, h) => [
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
const galleryEdges = edges(plans.court)
    .filter((_, i) => i !== 2)
    .map((e) => ({ ...e, normal: e.normal.map((v) => -v) })),
  prayerEdge = { ...edges(plans.court)[2], normal: edges(plans.court)[2].normal.map((v) => -v) };
const rectangleOn = (h, width, back) =>
  [
    point(h, -width / 2, 0, 0),
    point(h, width / 2, 0, 0),
    point(h, width / 2, 0, back),
    point(h, -width / 2, 0, back),
  ].map((p) => [p[0], p[2]]);
export function aleppoArcades(d = 3) {
  return galleryEdges.flatMap((e, i) => {
    const n = Math.max(2, Math.round(e.length / (d === 0 ? 15 : d === 1 ? 6.5 : 5.2))),
      step = e.length / n;
    return Array.from({ length: n }, (_, j) => ({
      ...field(
        `arcade-${i}-${j}`,
        lerp(e.a, e.b, (j + 0.5) / n),
        e.axis,
        e.normal,
        step * 0.72,
        0.12,
        6.25,
        3.8,
        0.75,
      ),
      step,
      edge: i,
    }));
  });
}
export function aleppoPrayerFields(d = 3) {
  if (d === 0) return [];
  const e = prayerEdge,
    fields = [];
  for (const sign of [-1, 1]) {
    const lo = 4.65,
      hi = e.length / 2,
      n = Math.max(1, Math.floor((hi - lo) / (d === 1 ? 7 : 4.6))),
      step = (hi - lo) / n;
    for (let j = 0; j < n; j++) {
      const u = sign * (lo + (j + 0.5) * step),
        p = e.center.map((v, k) => v + e.axis[k] * u);
      fields.push({
        ...field(
          `prayer-field-${sign}-${j}`,
          p,
          e.axis,
          e.normal,
          Math.min(3.0, step * 0.7),
          0.45,
          6.1,
          3.65,
          0.8,
        ),
        step,
      });
    }
  }
  return fields;
}
export function aleppoTowerFields(d = 3) {
  if (d < 2) return [];
  const r = rect(...plans.minaret.center, plans.minaret.width, plans.minaret.width),
    fields = [];
  for (const [i, e] of edges(r).entries())
    for (const [y, height, spring, n] of [
      [22.3, 3.9, 2.4, 2],
      [30.6, 3.6, 2.2, 2],
      [35.8, 2.0, 1.2, 1],
    ])
      for (let j = 0; j < n; j++) {
        const u = n === 1 ? 0 : j === 0 ? -1.2 : 1.2;
        fields.push(
          field(
            `tower-${i}-${y}-${j}`,
            e.center.map((v, k) => v + e.axis[k] * u),
            e.axis,
            e.normal,
            n === 1 ? 1.1 : 0.85,
            y,
            height,
            spring,
            0.9,
          ),
        );
      }
  return fields;
}
export function aleppoPortal() {
  return {
    ...field(
      'raised-prayer-portal',
      prayerEdge.center,
      prayerEdge.axis,
      prayerEdge.normal,
      5.2,
      0,
      8.55,
      5.0,
      2.7,
    ),
    frameWidth: 9.3,
    top: 10.5,
  };
}
function gallery(face, d) {
  for (const h of aleppoArcades(d)) {
    panel(face, h, d, h.step, 0, 7.8, 'wall');
    reveal(face, h, d, 0, -0.65, 'wall');
    if (d > 1) archBand(face, h, d, 0.23, 'trim', 0.04);
  }
  for (const e of galleryEdges) {
    const back = e.center.map((v, k) => v - e.normal[k] * 3.3),
      a = back.map((v, k) => v - (e.axis[k] * e.length) / 2),
      b = back.map((v, k) => v + (e.axis[k] * e.length) / 2);
    face('wall', [at(a, 0), at(b, 0), at(b, 7.4), at(a, 7.4)], [e.normal[0], 0, e.normal[1]]);
    const soffit = rectangleOn(e, e.length, -3.3);
    down(face, soffit, 7.4, 'roof');
  }
}
function prayerFacade(face, d) {
  const e = prayerEdge,
    h = aleppoPortal();
  if (d === 0) {
    face(
      'wall',
      [
        point(e, -e.length / 2, floor, 0),
        point(e, e.length / 2, floor, 0),
        point(e, e.length / 2, floor + 9.2, 0),
        point(e, -e.length / 2, floor + 9.2, 0),
      ],
      [e.normal[0], 0, e.normal[1]],
    );
    for (const u of [-0.32, -0.17, 0.17, 0.32]) {
      const q = field(
        'far-prayer',
        e.center.map((v, k) => v + e.axis[k] * e.length * u),
        e.axis,
        e.normal,
        4.5,
        0.6,
        5.7,
        3.4,
        0.4,
      );
      pane(face, q, d, 0.04, 'door');
    }
  } else {
    for (const q of aleppoPrayerFields(d)) {
      panel(face, q, d, q.step, 0, 9.2, 'wall');
      reveal(face, q, d, 0, -0.42, 'trim');
      pane(face, q, d, -0.44, 'door');
      const glazingWidth = q.width * 0.42;
      face(
        'glass',
        [
          point(q, -glazingWidth, floor + 2.85, -0.4),
          point(q, glazingWidth, floor + 2.85, -0.4),
          point(q, glazingWidth, floor + 4, -0.4),
          point(q, -glazingWidth, floor + 4, -0.4),
        ],
        [q.normal[0], 0, q.normal[1]],
      );
      if (d > 1) {
        archBand(face, q, d, 0.2, 'door', -0.15);
        const w = q.width / 2;
        face(
          'door',
          [
            point(q, -w, floor + 0.5, -0.41),
            point(q, w, floor + 0.5, -0.41),
            point(q, w, floor + 2.7, -0.41),
            point(q, -w, floor + 2.7, -0.41),
          ],
          [q.normal[0], 0, q.normal[1]],
        );
        for (const u of [-0.25, 0.25])
          beam(
            face,
            point(q, q.width * u, floor + 2.7, -0.35),
            point(q, q.width * u, floor + 4.3, -0.35),
            0.18,
            'door',
          );
        for (const sign of [-1, 1])
          beam(
            face,
            point(q, -0.65 * sign, floor + 4.4, -0.33),
            point(q, 0.65 * sign, floor + 5.35, -0.33),
            0.18,
            'door',
          );
      }
    }
  }
  // The central bay is built independently so its taller frame does not block the recess.
  panel(face, h, d, h.frameWidth, 0, h.top, 'accent', 0.09);
  reveal(face, h, d, 0.09, -2.35, 'wall');
  pane(face, h, d, d === 0 ? 0.12 : -2.37, 'door');
  archBand(face, h, d, d === 0 ? 0.38 : 0.45, 'trim', 0.13);
  for (const u of [-1, 1]) {
    const a = e.center.map((v, k) => v + e.axis[k] * u * 4.65),
      b = a.map((v, k) => v - e.normal[k] * 2.8);
    face('wall', [at(a, 0), at(b, 0), at(b, 10.5), at(a, 10.5)], [e.axis[0] * u, 0, e.axis[1] * u]);
  }
  cap(face, rectangleOn(h, h.frameWidth, -2.8), 10.5, 'trim');
  if (d > 1)
    for (const q of aleppoPrayerFields(d)) {
      const r = { ...q, shape: 'circle', width: 0.52, height: 0.52, bottom: floor + 7.55 };
      pane(face, r, d, 0.04, 'door');
      if (d > 2) archBand(face, r, d, 0.1, 'trim', 0.06);
    }
}
function dome(face, p, d) {
  const n = d === 0 ? 6 : d === 1 ? 10 : d === 2 ? 16 : d === 3 ? 24 : 28,
    r = circle(p.center, p.radius, n);
  profile(
    face,
    r,
    d === 0
      ? [
          [p.base, 1],
          [p.base + (p.top - p.base) * 0.5, 0.87],
          [p.top, 0.015],
        ]
      : [
          [p.base, 1],
          [p.base + (p.top - p.base) * 0.2, 0.98],
          [p.base + (p.top - p.base) * 0.55, 0.8],
          [p.base + (p.top - p.base) * 0.83, 0.48],
          [p.top, 0.015],
        ],
    'dome',
    p.center,
  );
}
function pavilion(face, p, d) {
  const n = d === 0 ? 4 : p.posts,
    postRadius = p.radius * 0.86,
    ring = circle(p.center, p.radius * (d === 0 ? 1 : 1.04), d === 0 ? 6 : p.posts),
    roof = { ...p, base: p.base + 0.12, radius: p.radius * 0.98 };
  if (d > 0) {
    sides(face, ring, 0, 0.22, 'trim');
    cap(face, ring, 0.22, 'trim');
  }
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) * 2 * Math.PI) / n,
      q = p.center.map((v, k) => v + postRadius * (k === 0 ? Math.cos(a) : Math.sin(a)));
    if (d < 2) beam(face, at(q, d === 0 ? 0 : 0.22), at(q, p.base), d === 0 ? 0.48 : 0.4, 'trim');
    else {
      const col = circle(q, 0.23, d === 2 ? 8 : 12);
      profile(
        face,
        col,
        [
          [0.22, 1.55],
          [0.55, 1.25],
          [0.65, 1],
          [p.base - 0.45, 1],
          [p.base - 0.2, 1.5],
          [p.base, 1.6],
        ],
        'trim',
        q,
      );
    }
  }
  sides(face, ring, p.base - 0.12, p.base + 0.12, 'trim');
  cap(face, ring, p.base + 0.12, 'trim');
  down(face, ring, p.base - 0.12, 'trim');
  dome(face, roof, d);
  if (d > 0) {
    const basin = circle(p.center, p.radius * 0.44, d === 1 ? 8 : 16),
      inner = circle(p.center, p.radius * 0.37, d === 1 ? 8 : 16);
    sides(face, basin, 0.22, 0.8, 'trim');
    cap(face, basin, 0.8, 'trim', [inner]);
    sides(face, inner, 0.35, 0.8, 'trim', true);
    cap(face, inner, 0.38, 'glass');
  }
}
function minaret(out, face, d) {
  const p = plans.minaret,
    r = rect(...p.center, p.width, p.width),
    fields = aleppoTowerFields(d);
  shell(out, d, r, 0, 39, fields, 'wall');
  cap(face, r, 39, 'wall');
  for (const h of fields) {
    pane(face, h, d, -0.4, 'door');
    archBand(face, h, d, 0.15, 'trim', 0.035);
  }
  for (const y of d === 0 ? [20.5, 29.5, 38.6] : [10.5, 20.5, 29.5, 35.0, 38.6]) {
    const ring = rect(...p.center, p.width + 0.32, p.width + 0.32);
    sides(face, ring, y, y + 0.27, 'trim');
    cap(face, ring, y + 0.27, 'trim', [r]);
  }
  const gallery = rect(...p.center, 6.5, 6.5);
  sides(face, gallery, 39, 39.45, 'trim');
  cap(face, gallery, 39.45, 'trim');
  down(face, gallery, 39, 'trim');
  const columns =
    d < 2
      ? [-1, 1].flatMap((x) => [-1, 1].map((z) => [x * 2.9, z * 2.9]))
      : [
          [-2.9, -2.9],
          [0, -2.9],
          [2.9, -2.9],
          [2.9, 0],
          [2.9, 2.9],
          [0, 2.9],
          [-2.9, 2.9],
          [-2.9, 0],
        ];
  for (const q of columns) {
    const xz = q.map((v, k) => v + p.center[k]);
    beam(face, at(xz, 39.45), at(xz, 42.15), d === 0 ? 0.38 : 0.3, 'door');
  }
  sides(face, rect(...p.center, 6.1, 6.1), 39.55, 40.05, 'door');
  const roof = rect(...p.center, 7.1, 7.1);
  down(face, roof, 42.15, 'door');
  profile(
    face,
    roof,
    [
      [42.15, 1],
      [42.4, 1],
      [44.5, 0.025],
    ],
    'dome',
    p.center,
  );
  profile(
    face,
    circle(p.center, 0.15, 4),
    [
      [44.5, 1],
      [45, 0.015],
    ],
    'trim',
    p.center,
  );
  if (d > 1)
    for (const e of edges(r))
      for (const u of [-1.6, 0, 1.6]) {
        const a = e.center.map((v, k) => v + e.axis[k] * u);
        beam(
          face,
          at(a, 37.9),
          [a[0] + e.normal[0] * 0.65, floor + 39, a[1] + e.normal[1] * 0.65],
          0.3,
          'trim',
        );
      }
}
function paving(face, d) {
  if (d === 0) return;
  const [nw, ne, se, sw] = plans.court,
    quad = (u, v) => lerp(lerp(nw, ne, u), lerp(sw, se, u), v),
    col = colors.stripe;
  for (const u of [0.1, 0.5, 0.9])
    face(
      'roof',
      [
        quad(u - 0.005, 0.03),
        quad(u + 0.005, 0.03),
        quad(u + 0.005, 0.97),
        quad(u - 0.005, 0.97),
      ].map((p) => at(p, 0.025)),
      [0, 1, 0],
      col,
    );
  for (const v of [0.1, 0.5, 0.9])
    face(
      'roof',
      [
        quad(0.03, v - 0.008),
        quad(0.97, v - 0.008),
        quad(0.97, v + 0.008),
        quad(0.03, v + 0.008),
      ].map((p) => at(p, 0.028)),
      [0, 1, 0],
      col,
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
  sides(face, plans.outer, footing, 0, 'wall');
  cap(face, plans.outer, 0, 'trim');
  sides(face, plans.outer, 0, 7.8, 'wall');
  cap(face, plans.outer, 7.8, 'roof', [plans.court]);
  const prayer = plans.prayerRange;
  for (let i = 1; i < prayer.length; i++) {
    const a = prayer[i],
      b = prayer[(i + 1) % prayer.length],
      sg = sign(prayer);
    face(
      'wall',
      [at(a, 7.8), at(b, 7.8), at(b, 9.2), at(a, 9.2)],
      [(b[1] - a[1]) * sg, 0, (a[0] - b[0]) * sg],
    );
  }
  cap(face, prayer, 9.2, 'roof');
  gallery(face, d);
  prayerFacade(face, d);
  dome(face, plans.mainDome, d);
  for (const p of plans.pavilions) pavilion(face, p, d);
  minaret(out, face, d);
  paving(face, d);
  if (d > 0) {
    const inner = scaled(plans.outer, 0.994);
    sides(face, plans.outer, 7.8, 8.15, 'trim');
    cap(face, plans.outer, 8.15, 'trim', [inner]);
  }
}
export const buildAleppoSkyline = (o) => build(o, 0),
  buildAleppoDistrict = (o) => build(o, 1),
  buildAleppoStreet = (o) => build(o, 2),
  buildAleppoCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const aleppoStudy = {
  id: 'great_mosque_of_aleppo',
  key: 'great_mosque_of_aleppo',
  title: 'Great Mosque of Aleppo',
  category: 'mosque',
  wikidataId: 'Q1481968',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256² ashlar,limestone,standing-seam metal,plain wood and mosaic graphs;seven or fewer merged groups. Pale stone,grey domes,warm timber and sparse dark portal bands use linear vertex tints/metric UVs. Zero embedded images,baked lighting/weathering or copied calligraphy/carvings. Court stripes are a broad original abstraction.',
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
    'Historical2009 exterior approximation. Current damage/reconstruction/finish state unverified. Main/minaret/pavilion heights and placements are picture estimates;no current map component heights or surveyed component plans. Three courtyard arcades and pavilion/top-minaret stages are exterior voids;main timber fields and minaret niches close before interiors. Skyline opens eleven coarse arcade bays and uses closed prayer-facade proxies/four pavilion posts;district opens26 bays,near levels restore33-bay rhythm/selected trim/brackets. Fine inscriptions,carved stone screens,paving motifs,rails/wires/signage/fixtures and unseen rooms/stairs omitted or unverified. Adjacent souks/city/streets remain host content. Exact altitude/street/threshold/terrain contact,free walking,engineering and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('square-banded-minaret', [-80, 32, -66], [-45, 29, -29]),
    cam('closed-prayer-facade', [21, 11, -7], [-3, 8, 19]),
    cam('deep-north-arcade', [21, 6, 3], [15, 6, -26]),
    cam('paired-dome-pavilions', [26, 15, -27], [-3, 5, -3]),
    cam('prayer-roof-dome', [27, 29, 56], [-3, 14, 30]),
    cam('mapped-court-plan', [0, 220, 0.1], [0, 8, 0]),
  ],
};

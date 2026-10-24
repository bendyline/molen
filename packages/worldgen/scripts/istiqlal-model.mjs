/** Istiqlal: mapped halls/courts,two domes,monumental fins and grid/lattice minaret. */
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
  '../../../content/worldgen/source/places/qq/qqg/istiqlal_mosque/',
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
  wall: '#dbd8cd',
  trim: '#d0cec5',
  roof: '#bfbeb6',
  dome: '#d6dcdb',
  screen: '#87938d',
  paving: '#b18a75',
  metal: '#bac3c4',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, istiqlalGround(...p) - 0.35);
export function istiqlalGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Istiqlal Mosque footing outside retained terrain');
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
const plans = rec.plans,
  origin = rec.centers;
const around = (p, e, w, t) =>
  [-1, 1].flatMap((n, i) =>
    (i ? [1, -1] : [-1, 1]).map((u) =>
      p.map((v, k) => v + (e.axis[k] * u * w) / 2 + (e.normal[k] * n * t) / 2),
    ),
  );
const ringAt = (r, d) =>
  d === 0 ? r.filter((_, i) => i % 4 === 0) : d === 1 ? r.filter((_, i) => i % 2 === 0) : r;
const galleryPlans = (d) =>
  plans.gallery.map((p) => ({
    outline: d === 0 ? _coarse(p.outline) : p.outline,
    holes: p.holes.map((h) => (d === 0 ? _coarse(h) : h)),
  }));
export function istiqlalGalleryFields(d) {
  const fields = [];
  for (const [pi, p] of galleryPlans(d).entries())
    for (const [ri, r] of [p.outline, ...p.holes].entries())
      for (const [ei, e] of edges(r).entries()) {
        const normal = e.normal.map((v) => v * (ri > 0 ? -1 : 1));
        const n = Math.max(
            1,
            Math.round(e.length / (d === 0 ? 40 : d === 1 ? 11 : d === 2 ? 7 : 4.7)),
          ),
          pitch = e.length / n;
        if (e.length < 5) continue;
        for (let k = 0; k < n; k++)
          for (const [row, b, t] of d === 0
            ? [[0, 5, 15.4]]
            : [
                [0, 5, 10.2],
                [1, 10.2, 15.4],
              ]) {
            const h = {
              ...field(
                `gallery-${pi}-${ri}-${ei}-${k}-${row}`,
                lerp(e.a, e.b, (k + 0.5) / n),
                e.axis,
                normal,
                pitch * 0.76,
                b + 0.22,
                t - b - 0.62,
                0,
                0.6,
              ),
              shape: 'rect',
              pitch,
              base: b,
              top: t,
              edge: e,
            };
            fields.push(h);
          }
      }
  return fields;
}
function galleries(face, d) {
  const ps = galleryPlans(d);
  for (const p of ps) {
    cap(face, p.outline, 15.4, 'roof', p.holes);
    down(face, p.outline, 15.15, 'trim', p.holes);
    if (d >= 1) {
      cap(face, p.outline, 10.2, 'trim', p.holes);
      down(face, p.outline, 10, 'trim', p.holes);
    }
  }
  const fields = istiqlalGalleryFields(d);
  for (const h of fields) {
    panel(face, h, d, h.pitch, h.base, h.top, 'wall');
    if (d >= 2) {
      reveal(face, h, d, 0, -0.55, 'wall');
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
        h.base,
        h.top,
        'wall',
        -0.55,
      );
    }
  }
  for (const p of ps)
    for (const [ri, r] of [p.outline, ...p.holes].entries())
      for (const e of edges(r)) if (e.length < 5) sides(face, [e.a, e.b], 5, 15.4, 'wall', ri > 0);
}
function mainHall(face, d) {
  const r = d === 0 ? _coarse(plans.mass.outline) : plans.mass.outline,
    drum = _rect(...origin.small, 10.5, 10.5),
    big = ringAt(plans.dome, d),
    overhang = scaled(_coarse(plans.mass.outline), 1.025);
  sides(face, r, 5, 32.4, 'screen');
  cap(face, overhang, 32.65, 'roof', [big, drum]);
  down(face, overhang, 32.4, 'roof', [big, drum]);
  sides(face, overhang, 32.4, 32.65, 'roof');
  const backing = (slot, points, normal) =>
    face(
      slot,
      points,
      normal,
      colors.screen.map((value) => value * 0.55),
    );
  if (d >= 1) sides(backing, scaled(r, 0.982), 5, 32.3, 'roof');
  profile(
    face,
    big,
    [
      [32.65, 1],
      [34, 1],
    ],
    'wall',
    origin.dome,
  );
  if (d >= 1)
    for (const e of edges(r)) {
      const n = Math.floor(e.length / (d === 1 ? 12 : 3.8));
      for (let k = 0; k < n; k++) {
        const q = lerp(e.a, e.b, (k + 0.5) / n).map((v, i) => v + e.normal[i] * 0.45);
        _solid(face, around(q, e, 0.75, 1.1), 5, 32.45, 'wall');
      }
      if (d >= 2 && e.length < 40)
        for (const y of [10.4, 15.8, 21.2, 26.6, 31.65])
          _solid(face, around(e.center, e, e.length, 0.7), y, y + 0.28, 'trim');
    }
  const smallFields = edges(drum).map((e) => ({
    ...field('small-drum-opaque-window', e.center, e.axis, e.normal, 6, 32.5, 4.8, 0, 0.8),
    shape: 'rect',
    edge: e,
  }));
  for (const h of smallFields) {
    panel(face, h, d, 10.5, 32, 38, 'wall');
    reveal(face, h, d, 0, -0.3, 'wall');
    pane(face, h, d, -0.3, 'screen');
    if (d >= 1) pane(backing, h, d, -0.5, 'roof');
    if (d >= 1)
      for (const y of [34.2, 36])
        _solid(
          face,
          around([h.center[0] + h.normal[0] * 0.04, h.center[1] + h.normal[1] * 0.04], h, 6, 0.15),
          y,
          y + 0.2,
          'trim',
        );
  }
  cap(face, drum, 38, 'roof', [ringAt(plans.small, d)]);
  down(face, drum, 32.1, 'trim');
}
function dome(face, r, q, b, t, d, bulb = false) {
  const levels =
    d === 0
      ? [
          [b, bulb ? 0.7 : 1],
          [b + (t - b) * 0.55, bulb ? 1 : 0.83],
          [t, 0.015],
        ]
      : bulb
        ? [
            [b, 0.7],
            [b + (t - b) * 0.25, 1],
            [b + (t - b) * 0.55, 0.95],
            [b + (t - b) * 0.83, 0.6],
            [t, 0.015],
          ]
        : [
            [b, 1],
            [b + (t - b) * 0.2, 0.99],
            [b + (t - b) * 0.5, 0.87],
            [b + (t - b) * 0.8, 0.57],
            [t, 0.015],
          ];
  profile(face, r, levels, 'dome', q);
  if (d >= 2)
    for (let k = 0; k < r.length; k += d === 2 ? 4 : 2) {
      const p = r[k],
        a = Math.atan2(p[1] - q[1], p[0] - q[0]),
        radius = Math.hypot(p[0] - q[0], p[1] - q[1]);
      for (let i = 1; i < levels.length; i++) {
        const v = levels[i - 1],
          w = levels[i],
          eps = 0.002;
        face(
          'metal',
          [
            [
              q[0] + Math.cos(a - eps) * radius * v[1] * 1.002,
              floor + v[0],
              q[1] + Math.sin(a - eps) * radius * v[1] * 1.002,
            ],
            [
              q[0] + Math.cos(a + eps) * radius * v[1] * 1.002,
              floor + v[0],
              q[1] + Math.sin(a + eps) * radius * v[1] * 1.002,
            ],
            [
              q[0] + Math.cos(a + eps) * radius * w[1] * 1.002,
              floor + w[0],
              q[1] + Math.sin(a + eps) * radius * w[1] * 1.002,
            ],
            [
              q[0] + Math.cos(a - eps) * radius * w[1] * 1.002,
              floor + w[0],
              q[1] + Math.sin(a - eps) * radius * w[1] * 1.002,
            ],
          ],
          [Math.cos(a), 0.2, Math.sin(a)],
        );
      }
    }
}
function finial(face, q, b, top, d) {
  profile(
    face,
    circle(q, 0.12, d === 0 ? 4 : 8),
    [
      [b, 1],
      [top - 0.5, 1],
    ],
    'metal',
    q,
  );
  if (d === 0) return;
  const n = d === 1 ? 8 : 16,
    cy = top - 0.8,
    R = 0.8,
    r = 0.6;
  for (let k = 0; k < n; k++) {
    const a = (k * 2 * Math.PI) / n,
      b = ((k + 1) * 2 * Math.PI) / n;
    for (const z of [-0.07, 0.07])
      face(
        'metal',
        [
          [q[0] + R * Math.cos(a), floor + cy + R * Math.sin(a), q[1] + z],
          [q[0] + R * Math.cos(b), floor + cy + R * Math.sin(b), q[1] + z],
          [q[0] + r * Math.cos(b), floor + cy + r * Math.sin(b), q[1] + z],
          [q[0] + r * Math.cos(a), floor + cy + r * Math.sin(a), q[1] + z],
        ],
        [0, 0, Math.sign(z)],
      );
    for (const radius of [R, r]) {
      const sign = radius === R ? 1 : -1;
      face(
        'metal',
        [
          [q[0] + radius * Math.cos(a), floor + cy + radius * Math.sin(a), q[1] - 0.07],
          [q[0] + radius * Math.cos(b), floor + cy + radius * Math.sin(b), q[1] - 0.07],
          [q[0] + radius * Math.cos(b), floor + cy + radius * Math.sin(b), q[1] + 0.07],
          [q[0] + radius * Math.cos(a), floor + cy + radius * Math.sin(a), q[1] + 0.07],
        ],
        [Math.cos((a + b) / 2) * sign, Math.sin((a + b) / 2) * sign, 0],
      );
    }
  }
}
function beam(face, a, b, width, slot = 'metal') {
  const v = unit(b.map((x, i) => x - a[i])),
    u = unit(cross(v, Math.abs(v[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
    w = unit(cross(v, u)),
    points = [-1, 1].flatMap((sg, i) =>
      (i ? [1, -1] : [-1, 1]).map((t) => a.map((x, k) => x + ((u[k] * sg + w[k] * t) * width) / 2)),
    ),
    end = points.map((p) => p.map((v, k) => v + b[k] - a[k]));
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [points[i], points[j], end[j], end[i]], normalFor(points[i], points[j], end[j]));
  }
  face(
    slot,
    points,
    v.map((x) => -x),
  );
  face(slot, end, v);
}
function minaret(face, d) {
  const q = origin.tower,
    r = 3.25,
    n = d === 0 ? 8 : d === 1 ? 12 : 24,
    ring = d === 0 ? plans.tower : circle(q, r, n);
  if (d === 0)
    profile(
      face,
      ring,
      [
        [0, 1],
        [61.4, 1],
      ],
      'wall',
      q,
    );
  else {
    const backing = (slot, points, normal) =>
      face(
        slot,
        points,
        normal,
        colors.screen.map((value) => value * 0.55),
      );
    sides(backing, circle(q, r * 0.75, n), 0, 61.4, 'roof');
    profile(
      face,
      circle(q, r * 0.86, n),
      [
        [0, 1],
        [61.4, 1],
      ],
      'screen',
      q,
    );
    for (let k = 0; k < n; k++) {
      const a = (k * 2 * Math.PI) / n,
        p = [q[0] + Math.cos(a) * r, q[1] + Math.sin(a) * r];
      _solid(face, _rect(...p, d === 1 ? 0.35 : 0.22, d === 1 ? 0.35 : 0.22), 0, 61.4, 'wall');
    }
    const count = d === 1 ? 9 : 22;
    for (let k = 0; k <= count; k++)
      profile(
        face,
        circle(q, r, n),
        [
          [(k * 61.4) / count, 1],
          [(k * 61.4) / count + 0.18, 1],
        ],
        'wall',
        q,
      );
  }
  profile(
    face,
    circle(q, r, n),
    [
      [61.4, 1],
      [62.4, 1.6],
      [63, 1.6],
    ],
    'wall',
    q,
  );
  if (d === 0)
    profile(
      face,
      circle(q, r * 1.4, 8),
      [
        [63, 1],
        [66, 1],
      ],
      'screen',
      q,
    );
  else {
    profile(
      face,
      circle(q, r * 1.12, n),
      [
        [63, 1],
        [66, 1],
      ],
      'screen',
      q,
    );
    for (let k = 0; k < n; k++) {
      const a = (k * 2 * Math.PI) / n,
        p = [q[0] + Math.cos(a) * r * 1.4, q[1] + Math.sin(a) * r * 1.4];
      _solid(face, _rect(...p, 0.24, 0.24), 63, 66, 'wall');
    }
  }
  profile(
    face,
    circle(q, r * 1.6, n),
    [
      [66, 1],
      [66.3, 1],
      [66.66, 0.97],
    ],
    'roof',
    q,
  );
  if (d <= 1)
    profile(
      face,
      circle(q, 1.2, d === 0 ? 4 : 8),
      [
        [66.66, 1],
        [96.66, 0.01],
      ],
      'metal',
      q,
    );
  else {
    const levels = d === 2 ? 9 : 15,
      point = (k, y) => {
        const a = (k * Math.PI) / 2 + 0.2,
          rr = (1.25 * (96.66 - y)) / 30;
        return [q[0] + Math.cos(a) * rr, floor + y, q[1] + Math.sin(a) * rr];
      };
    for (let k = 0; k < 4; k++) beam(face, point(k, 66.66), point(k, 96.66), 0.13);
    for (let j = 0; j < levels; j++) {
      const y = 66.66 + (j * 30) / levels,
        top = 66.66 + ((j + 1) * 30) / levels;
      for (let k = 0; k < 4; k++) {
        beam(face, point(k, y), point((k + 1) % 4, y), 0.08);
        if (j < levels - 1) beam(face, point(k, y), point((k + 1) % 4, top), 0.07);
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
    whole = d === 0 ? _coarse(plans.whole.outline) : plans.whole.outline;
  sides(face, whole, footing, 5, 'wall');
  cap(face, whole, 5, 'paving');
  galleries(face, d);
  mainHall(face, d);
  dome(face, ringAt(plans.dome, d), origin.dome, 34, 54, d);
  finial(face, origin.dome, 54, 58.8, d);
  dome(face, ringAt(plans.small, d), origin.small, 38, 43, d, true);
  finial(face, origin.small, 43, 44.5, d);
  minaret(face, d);
}
export const buildIstiqlalSkyline = (o) => build(o, 0),
  buildIstiqlalDistrict = (o) => build(o, 1),
  buildIstiqlalStreet = (o) => build(o, 2),
  buildIstiqlalCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const istiqlalStudy = {
  id: 'istiqlal_mosque',
  key: 'istiqlal_mosque',
  title: 'Istiqlal Mosque',
  category: 'mosque',
  wikidataId: 'Q475379',
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
    'Original generated geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Pictures inspected only,not redistributed;photograph and underlying architecture rights remain separate.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256² marble,concrete,beadblasted stainless,perforated square metal and clay graphs;seven merged roles. Metric UVs,linear tints,no embedded images,unique atlases,copied artwork or baked lighting.',
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
    'Three useful exterior pictures guide vertical fins/five-storey screen rhythm,flat overhanging roof,large shallow dome and pole/ring finial,small bulb dome on square windowed drum,two-storey rectangular open colonnades and long grid-sided minaret with flared balcony/open lattice pinnacle. Large and small dome map rings and all court openings retained;distant rings coarsen with matching roof holes. Main hall/small drum windows close on opaque perforated-metal proxies;galleries remain spatially open,not a furnished/navigable interior. Minaret screen core and merged pale grid ribs abstract the many actual openings;skyline/district pinnacle is a solid tapered proxy,near is open lattice. Current vines,exact facade/pier cadence,stairs,fine artwork,precise vertical datum/thresholds,unseen rooms/roof details,engineering and physical-device performance unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('large-shallow-dome-and-facade-fins', [-125, 65, 68], [-53, 34, -18]),
    cam('smaller-dome-and-square-drum', [55, 53, -16], [21.5, 38, -43]),
    cam('two-storey-courtyard-colonnade', [65, 14, 10], [94, 11, 10]),
    cam('marble-grid-minaret-shaft', [142, 43, 89], [111, 36, 58]),
    cam('open-steel-pinnacle', [136, 82, 89], [111, 82, 58]),
    cam('angled-hall-and-two-courts', [0, 290, 0.1], [0, 14, 0]),
  ],
};

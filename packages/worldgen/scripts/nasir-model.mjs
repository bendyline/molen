/** Nasir-ol-Molk: mapped court,pink iwans,twin open pavilions and timber galleries. */
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
  '../../../content/worldgen/source/places/tj/tjm/nasir_ol_molk_mosque/',
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
  wall: '#c7af8d',
  panel: '#d4b8c3',
  accent: '#7c9fb8',
  trim: '#e2d8bf',
  roof: '#c7bfad',
  door: '#b08c61',
  gold: '#c4b16c',
  glass: '#6c879d',
  water: '#467e87',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, nasirGround(...p) - 0.35);
export function nasirGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Nasir-ol-Molk Mosque footing outside retained terrain');
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
const _curveDepth = (d) => (d <= 0 ? 0 : d === 1 ? 1 : d === 2 ? 2 : 3);
const iwanHole = (p) =>
  field(
    p.name,
    p.center,
    p.axis,
    p.normal,
    p.southern ? 7.1 : 7.8,
    0.18,
    p.southern ? 9.7 : 9.5,
    5.1,
    p.southern ? 2.7 : 6.2,
  );
export const nasirIwans = () => plans.iwans.map(iwanHole);
export function nasirFields(d) {
  if (d === 0) return [];
  const hs = [];
  for (const e0 of edges(plans.court)) {
    const e = { ...e0, normal: e0.normal.map((v) => -v) };
    if (e.length > 28) {
      const n = 7;
      for (let i = 0; i < n; i++)
        hs.push({
          ...field(
            `gallery-${hs.length}`,
            lerp(e.a, e.b, (i + 0.5) / n),
            e.axis,
            e.normal,
            Math.min(3.35, (e.length / n) * 0.76),
            0.55,
            5.65,
            2.7,
            4.5,
          ),
          kind: e.center[0] < -5 ? 'door' : 'panel',
          backDepth: 1.5,
        });
    } else {
      for (const sg of [-1, 1])
        hs.push({
          ...field(
            `side-field-${hs.length}`,
            e.center.map((v, k) => v + e.axis[k] * sg * 8.7),
            e.axis,
            e.normal,
            2.7,
            0.7,
            4.9,
            2.4,
            2.1,
          ),
          kind: 'panel',
          backDepth: 0.8,
        });
    }
  }
  return hs;
}
function band(face, ring, y, h, slot = 'accent', inner = false) {
  sides(face, scaled(ring, inner ? 0.997 : 1.002), y, y + h, slot, inner);
}
function quad(face, h, u0, u1, y0, y1, dep, slot = 'trim', col) {
  face(
    slot,
    [point(h, u0, y0, dep), point(h, u1, y0, dep), point(h, u1, y1, dep), point(h, u0, y1, dep)],
    [h.normal[0], 0, h.normal[1]],
    col,
  );
}
function frameRect(face, h, w, b, t, dep, slot = 'accent', th = 0.18) {
  quad(face, h, -w / 2, w / 2, floor + b, floor + b + th, dep, slot);
  quad(face, h, -w / 2, w / 2, floor + t - th, floor + t, dep, slot);
  quad(face, h, -w / 2, -w / 2 + th, floor + b, floor + t, dep, slot);
  quad(face, h, w / 2 - th, w / 2, floor + b, floor + t, dep, slot);
}
function diamond(face, h, d, dep) {
  if (d < 2) return;
  const y = h.bottom + h.height * 0.48,
    w = h.width * 0.21,
    ht = h.height * 0.18,
    pp = [
      [0, y + ht],
      [w, y],
      [0, y - ht],
      [-w, y],
    ].map(([u, y]) => point(h, u, y, dep));
  for (let i = 0; i < 4; i++) beam(face, pp[i], pp[(i + 1) % 4], 0.15, 'trim');
}
function decoratedBack(face, h, d, dep, kind = 'panel') {
  pane(face, h, d, dep, kind);
  if (d === 0) return;
  const w = h.width * 0.72,
    b = h.bottom - floor + 0.45,
    t = b + h.height * 0.58;
  if (kind === 'door') {
    frameRect(face, h, w, b, t, dep + 0.025, 'trim', 0.14);
    if (d >= 2) {
      const cols = d === 2 ? 2 : 3,
        rows = 3;
      for (let i = 0; i < cols; i++)
        for (let j = 0; j < rows; j++) {
          const tones = [
              [0.18, 0.35, 0.44],
              [0.5, 0.16, 0.14],
              [0.47, 0.36, 0.14],
              [0.15, 0.38, 0.27],
            ],
            col = tones[(i + j) % tones.length];
          quad(
            face,
            h,
            -w * 0.42 + (i * w * 0.84) / cols,
            -w * 0.42 + ((i + 1) * w * 0.84) / cols - 0.12,
            floor + b + 0.18 + (j * (t - b) * 0.72) / rows,
            floor + b + 0.18 + ((j + 1) * (t - b) * 0.72) / rows - 0.13,
            dep + 0.04,
            'glass',
            col,
          );
        }
      beam(
        face,
        point(h, 0, floor + b, dep + 0.07),
        point(h, 0, floor + t, dep + 0.07),
        0.16,
        'door',
      );
    }
  } else diamond(face, h, d, dep + 0.06);
}
function body(out, face, d) {
  sides(face, plans.outer, footing, 0, 'wall');
  sides(face, plans.outer, 0, 7.2, 'wall');
  const fields = nasirFields(d),
    blockCuts = plans.iwans.map((p) => ({
      ...iwanHole(p),
      shape: 'rect',
      width: p.width + 0.02,
      bottom: floor - 0.02,
      height: 7.3,
      depth: 0.3,
    }));
  const holes = [...blockCuts, ...(d >= 2 ? fields : [])],
    mf = writer(
      masked(
        out,
        holes.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  sides(mf, plans.court, 0, 7.2, 'panel', true);
  for (const p of plans.roofParts) cap(face, p.outline, 7.2, 'roof', p.holes);
  // A court is open overhead but still has a paved,closed bottom.
  cap(face, plans.court, 0, 'trim');
  if (d >= 1) band(face, plans.outer, 7.2, 0.22, 'trim');
  band(mf, plans.court, 6.7, 0.35, 'accent', true);
  for (const h of fields) {
    if (d >= 2) _reveal(face, h, d, 0, -h.backDepth, 'panel');
    const dep = d === 1 ? 0.028 : -h.backDepth + 0.02;
    decoratedBack(face, h, d, dep, h.kind);
    if (d >= 2 || h.name.startsWith('side-field')) archBand(face, h, d, 0.19, 'trim', 0.045);
    if (d >= 2) frameRect(face, h, h.width + 0.45, 0.25, 6.5, 0.035, 'accent', 0.12);
  }
}
function vaultCells(face, h, d) {
  if (d < 2) return;
  const depth = h.name.startsWith('southern') ? 1.3 : 2.55;
  const head = openingShape(h, d).slice(2),
    tiers = d === 2 ? 3 : 5;
  const ring = (t) =>
    head.map(([u, y]) =>
      point(h, u * (1 - 0.3 * t), y + (h.bottom + h.spring + 1.7 - y) * t * 0.5, -depth * t),
    );
  let previous = ring(0);
  for (let j = 1; j <= tiers; j++) {
    const next = ring(j / tiers);
    for (let i = 0; i < head.length - 1; i++)
      face(
        j % 2 ? 'panel' : 'accent',
        [previous[i], previous[i + 1], next[i + 1], next[i]],
        [h.normal[0] * 0.7, -0.7, h.normal[1] * 0.7],
      );
    previous = next;
  }
}
function iwans(out, face, d) {
  for (const p of plans.iwans) {
    const h = iwanHole(p),
      backDepth = p.southern ? 1.3 : 2.55;
    for (const poly of p.polygons) {
      const upper = writer(masked(out, [prepareOpening(h, 0, d)]), d);
      sides(upper, poly.outline, 7.2, p.top, 'panel');
      cap(face, poly.outline, p.top, 'roof', poly.holes);
    }
    const lower = writer(masked(out, [prepareOpening(h, 0, d)]), d);
    quad(lower, h, -p.width / 2, p.width / 2, floor, floor + 7.2, 0, 'panel');
    _reveal(face, h, d, 0, -backDepth, 'panel');
    // The deep pointed recess closes on a patterned back,not an invented open hall.
    pane(face, h, d, -backDepth, 'panel');
    archBand(face, h, d, 0.3, 'accent', 0.055);
    if (d >= 1) frameRect(face, h, p.width - 0.45, 0.25, p.top - 0.35, 0.04, 'trim', 0.22);
    quad(
      face,
      h,
      -p.width / 2 + 0.3,
      p.width / 2 - 0.3,
      floor + p.top - 1.0,
      floor + p.top - 0.5,
      0.06,
      'accent',
    );
    if (d >= 1)
      for (const sg of [-1, 1]) {
        const side = {
          ...field(
            `${p.name}-side-${sg}`,
            p.center.map((v, k) => v + p.axis[k] * sg * 5.1),
            p.axis,
            p.normal,
            1.65,
            0.65,
            4.2,
            2.2,
            1,
          ),
          bottom: floor + 0.65,
        };
        pane(face, side, d, 0.075, 'accent');
        archBand(face, side, d, 0.12, 'trim', 0.09);
        const upper = { ...side, bottom: floor + 6.7, height: 3.35, spring: 1.7 };
        pane(face, upper, d, 0.075, 'door');
        archBand(face, upper, d, 0.12, 'trim', 0.09);
      }
    if (d >= 2) {
      for (const sg of [-1, 0, 1]) {
        const q = {
          ...h,
          center: h.center.map((v, k) => v + h.axis[k] * sg * h.width * 0.27),
          width: h.width * 0.24,
          bottom: floor + 0.55,
          height: 3.7,
          spring: 2,
        };
        pane(face, q, d, -backDepth + 0.06, 'accent');
        archBand(face, q, d, 0.13, 'trim', -backDepth + 0.09);
      }
      vaultCells(face, h, d);
    }
  }
}
export function nasirPavilionFields(_d) {
  return plans.pavilions.flatMap((p) => {
    const ns = [p.normal, p.normal.map((v) => -v), p.axis, p.axis.map((v) => -v)];
    return ns.map((normal, i) =>
      field(
        `${p.name}-opening-${i}`,
        p.center.map((v, k) => v + (normal[k] * p.width) / 2),
        [-normal[1], normal[0]],
        normal,
        0.92,
        12.25,
        2.55,
        1.7,
        p.width + 0.5,
      ),
    );
  });
}
function pavilions(out, face, d) {
  for (const p of plans.pavilions) {
    const r = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) =>
      p.center.map((x, k) => x + ((p.axis[k] * u + p.normal[k] * v) * p.width) / 2),
    );
    const hs = nasirPavilionFields(d).filter((h) => h.name.startsWith(`${p.name}-`));
    _shell(out, d, r, 11.7, 15.1, hs, 'panel');
    // Open heads have a real floor and cap. No opaque central core is added.
    cap(face, r, 12.27, 'trim');
    down(face, r, 15.1, 'roof');
    if (d >= 1) for (const h of hs) archBand(face, h, d, 0.13, 'trim', 0.03);
    profile(
      face,
      scaled(r, 1.14),
      [
        [15.1, 1],
        [15.35, 1.1],
        [15.5, 0.87],
      ],
      'trim',
      p.center,
    );
    const n = d === 0 ? 4 : d === 1 ? 6 : 8;
    profile(
      face,
      circle(p.center, 0.24, n),
      [
        [15.5, 0.3],
        [15.9, 1],
        [16.3, 0.8],
        [16.55, 0.1],
      ],
      'gold',
      p.center,
    );
    if (d >= 1) beam(face, at(p.center, 16.55), at(p.center, 17), 0.055, 'gold');
    else
      profile(
        face,
        circle(p.center, 0.05, 4),
        [
          [16.55, 1],
          [17, 0.05],
        ],
        'gold',
        p.center,
      );
  }
}
const poolRing = (w, l) => {
  const p = plans.pool;
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([u, v]) =>
    p.center.map((x, k) => x + (p.normal[k] * u * w) / 2 + (p.axis[k] * v * l) / 2),
  );
};
function pool(face, d) {
  const outer = poolRing(plans.pool.width + 0.48, plans.pool.length + 0.48),
    inner = poolRing(plans.pool.width, plans.pool.length);
  sides(face, outer, 0, 0.32, 'trim');
  sides(face, inner, 0, 0.32, 'trim', true);
  cap(face, outer, 0.32, 'trim', [inner]);
  cap(face, inner, 0.13, 'water');
  if (d >= 1) _solid(face, circle(plans.pool.center, 0.35, d === 1 ? 6 : 10), 0.13, 0.38, 'trim');
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
  body(out, face, d);
  iwans(out, face, d);
  pavilions(out, face, d);
  pool(face, d);
}
export const buildNasirSkyline = (o) => build(o, 0),
  buildNasirDistrict = (o) => build(o, 1),
  buildNasirStreet = (o) => build(o, 2),
  buildNasirCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const nasirStudy = {
  id: 'nasir_ol_molk_mosque',
  key: 'nasir_ol_molk_mosque',
  title: 'Nasir-ol-Molk Mosque',
  category: 'mosque',
  wikidataId: 'Q1962312',
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
    'Six existing shared256² brick,mosaic,limestone,lime plaster,wood and bronze graphs. Pink and blue mosaic fields share one graph and vertex tints. Glass and pool are local palette fallbacks. Seven merged groups,metric UVs,linear colours;no unique atlases,embedded images,baked lighting or copied floral art/calligraphy.',
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
    'Individual medium-fi courtyard exterior. Central iwans and side gallery fields are shallow closed pockets;selected timber doors/colour panes abstract the winter hall façade. Southern square pavilion heads have four true openings,floors and roofs. Connected faceted vault bands stand in for intricate muqarnas;no copied tile art or calligraphy. Pool is a simple static surface. No navigable rooms/stairs or invented interior. Unseen outside walls,roof fabric,whole north-façade profile,current finish,precise doorway/terrain contact and physical-device performance unverified. Three useful inspected pictures establish south court and a minor north niche;exact façade handedness retains180° uncertainty.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('southern-twin-pavilion-iwan', [-4, 12, 2], [-6, 8, 23]),
    cam('opposite-stepped-iwan', [-5, 10, 14], [-4, 7, -10]),
    cam('pointed-gallery-and-timber-doors', [-3, 6, 6], [-16, 3, 5]),
    cam('open-square-pavilion', [-4, 19, 16], [-1.7, 17, 24.0]),
    cam('reflecting-pool-and-court', [8, 14, 17], [-5, 3.5, 6]),
    cam('mapped-courtyard-roof-plan', [0, 110, 0.1], [-2, 4, 0]),
  ],
};

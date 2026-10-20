/** Bibi-Khanym: mapped open court,two great portals,paired tiled towers and three distinct blue domes. */
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
  '../../../content/worldgen/source/places/tr/trp/n0442_bibi_khanym_mosque/',
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
  wall: '#c5ad88',
  blue: '#61afb5',
  accent: '#d6caa7',
  trim: '#e1d5bf',
  roof: '#bfa98c',
  door: '#9f866a',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, bibiGround(...p) - 0.35);
export function bibiGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Bibi-Khanym Mosque footing outside retained terrain');
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
const _atHeight = (p, y, base = floor) => [p[0], base + y, p[1]];
function volume(name) {
  return plans.volumes.find((v) => v.name === name);
}
function front(r, normal) {
  return edges(r)
    .filter((e) => e.normal[0] * normal[0] + e.normal[1] * normal[1] > 0.8)
    .sort((a, b) => b.length - a.length)[0];
}
function located(name, r, normal, base, width, height, spring, depth) {
  const e = front(r, normal);
  return {
    ...field(name, e.center, e.axis, e.normal, width, 0.15, height, spring, depth),
    bottom: base + 0.15,
    frameWidth: e.length - 0.4,
    baseY: base,
  };
}
export function bibiFields() {
  return [
    {
      ...located(
        'western-prayer-iwan',
        plans.westernRaw,
        [1, 0],
        volume('western-screen').floorY,
        21.5,
        32,
        22,
        20,
      ),
      kind: 'recess',
      back: -9,
      body: 'western-screen',
    },
    {
      ...located(
        'eastern-monumental-passage',
        plans.easternRaw,
        [1, 0],
        volume('eastern-gateway').floorY,
        18.5,
        30,
        21,
        48,
      ),
      kind: 'passage',
      back: -14,
      body: 'eastern-gateway',
    },
    ...[
      ['northern-pavilion', [0, 1]],
      ['southern-pavilion', [0, -1]],
    ].map(([name, normal]) => {
      const v = volume(name);
      return {
        ...located(`${name}-iwan`, v.polygons[0].outline, normal, v.floorY, 7.2, 11.5, 7.5, 6),
        kind: 'recess',
        back: -2.5,
        body: name,
      };
    }),
  ];
}
export function bibiPorchDoor() {
  const v = volume('entry-porch'),
    e = front(v.polygons[0].outline, [1, 0]);
  return {
    ...field('inner-entry-porch-passage', e.center, e.axis, e.normal, 6.2, 0.15, 7.8, 5.0, 42),
    bottom: v.floorY + 0.15,
    baseY: v.floorY,
  };
}
function panelFrame(face, h, d, offset = 0.035) {
  const opening = openingShape(h, d),
    points = [
      [-h.frameWidth / 2, h.baseY],
      [h.frameWidth / 2, h.baseY],
      [h.frameWidth / 2, h.baseY + (h.body.includes('pavilion') ? 15 : 40)],
      [-h.frameWidth / 2, h.baseY + (h.body.includes('pavilion') ? 15 : 40)],
      ...opening,
    ],
    ids = earcut(points.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      'accent',
      ids.slice(i, i + 3).map((k) => point(h, ...points[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function strip(face, h, u0, u1, y0, y1, slot = 'blue', offset = 0.06) {
  face(
    slot,
    [
      point(h, u0, y0, offset),
      point(h, u1, y0, offset),
      point(h, u1, y1, offset),
      point(h, u0, y1, offset),
    ],
    [h.normal[0], 0, h.normal[1]],
  );
}
function decorate(face, h, d) {
  if (d < 1) return;
  panelFrame(face, h, d);
  archBand(face, h, d, h.body.includes('pavilion') ? 0.28 : 0.65, 'blue', 0.065);
  const max = h.baseY + (h.body.includes('pavilion') ? 15 : 40),
    w = h.frameWidth / 2,
    th = h.body.includes('pavilion') ? 0.25 : 0.65;
  strip(face, h, -w, -w + th, h.baseY, max);
  strip(face, h, w - th, w, h.baseY, max);
  strip(face, h, -w, w, max - th, max);
  if (d >= 2) {
    for (const sign of [-1, 1]) {
      const u = sign * (w - th - 1.15),
        span = h.body.includes('pavilion') ? 2 : 3.4,
        n = h.body.includes('pavilion') ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const y = h.baseY + 3 + ((i + 0.5) * (max - h.baseY - 6)) / n;
        face(
          'blue',
          [
            point(h, u, y - span / 2, 0.085),
            point(h, u + span * 0.25, y, 0.085),
            point(h, u, y + span / 2, 0.085),
            point(h, u - span * 0.25, y, 0.085),
          ],
          [h.normal[0], 0, h.normal[1]],
        );
      }
    }
  }
}
function backing(face, h, d) {
  if (h.kind === 'passage') return;
  _reveal(face, h, d, 0, h.back, 'wall');
  pane(face, h, d, h.back, 'accent');
  const door = {
    ...h,
    name: `${h.name}-closed-door`,
    width: h.body.includes('pavilion') ? 2.3 : 3.8,
    bottom: h.baseY + 0.2,
    height: h.body.includes('pavilion') ? 4.2 : 6.2,
    spring: h.body.includes('pavilion') ? 3.1 : 4.5,
  };
  pane(face, door, d, h.back + 0.03, 'door');
  if (d >= 2) archBand(face, door, d, 0.2, 'blue', h.back + 0.05);
}
function body(out, face, d) {
  const hs = bibiFields(),
    porchDoor = bibiPorchDoor();
  for (const p of plans.low) {
    sides(face, p.outline, footing, (q) => bibiGround(...q) + 9.25, 'wall');
    for (const h of p.holes) sides(face, h, footing, (q) => bibiGround(...q) + 9.25, 'wall', true);
    cap(face, p.outline, (q) => bibiGround(...q) + 9.25, 'roof', p.holes);
  }
  for (const v of plans.volumes) {
    const own = hs.filter((h) => h.body === v.name),
      cut = v.name === 'entry-porch' ? [porchDoor] : own,
      prepared = cut.map((h) => prepareOpening(h, 0, d)),
      mf = writer(masked(out, prepared), d);
    for (const p of v.polygons) {
      sides(mf, p.outline, footing, () => v.floorY + v.height, 'wall');
      for (const h of p.holes) sides(mf, h, footing, () => v.floorY + v.height, 'wall', true);
    }
    for (const p of plans.roofTiers[d].roofs[v.name])
      cap(mf, p.outline, () => v.floorY + v.height, 'roof', p.holes);
    for (const h of own) {
      if (h.kind !== 'passage') backing(face, h, d);
      decorate(face, h, d);
    }
    if (v.name === 'entry-porch' || own.some((h) => h.kind === 'passage')) {
      for (const p of v.polygons)
        openingReveals(
          {
            addTriangle(_slot, ref, points, normal, uv, color) {
              out.addTriangle('wall', ref, points, normal, uv, color);
            },
          },
          p.outline,
          footing,
          () => v.floorY + v.height,
          prepared,
          d === 0 ? colors.wall.map((v, k) => v * means.wall[k]) : colors.wall,
        );
    }
  }
}
function towers(face, d) {
  for (const p of plans.towers) {
    const r = p.ring;
    sides(face, r, footing, 3, 'trim');
    sides(face, r, 3, p.height, 'accent');
    cap(face, r, p.height, 'roof');
    if (d >= 1)
      for (const y of [4.2, 13.8, 28.5, 39.8]) sides(face, scaled(r, 1.003), y, y + 0.4, 'blue');
    if (d >= 2)
      for (const e of edges(r))
        for (const y of [10, 21, 33]) {
          const h = { center: e.center, axis: e.axis, normal: e.normal },
            w = e.length * 0.7;
          face(
            'blue',
            [
              point(h, 0, floor + y - 2.7, 0.045),
              point(h, w / 2, floor + y, 0.045),
              point(h, 0, floor + y + 2.7, 0.045),
              point(h, -w / 2, floor + y, 0.045),
            ],
            [e.normal[0], 0, e.normal[1]],
          );
        }
  }
}
function domes(face, d) {
  for (const p of plans.domes) {
    const ring = plans.roofTiers[d].rings[p.name],
      shift = p.floorY - floor,
      df = (slot, q, n, col) =>
        face(
          slot,
          q.map((q) => [q[0], q[1] + shift, q[2]]),
          n,
          col,
        );
    sides(df, ring, p.base, p.drum, 'accent');
    const levels = p.ribbed
      ? [
          [p.drum, 1],
          [22, 0.95],
          [23.5, 0.75],
          [24.4, 0.42],
          [p.crown, 0.015],
        ]
      : [
          [p.drum, 1],
          [24.5, 0.92],
          [27, 0.65],
          [29.3, 0.25],
          [p.crown, 0.005],
        ];
    const selected = d === 0 ? [levels[0], levels[2], levels.at(-1)] : levels;
    profile(df, ring, selected, 'blue', p.center);
    if (d >= 1)
      for (const y of [p.base + 0.3, p.drum - 0.75])
        sides(df, scaled(ring, 1.003), y, y + 0.35, 'blue');
    if (d >= 2)
      for (const e of edges(ring).filter((_, i) => !p.ribbed || i % 2 === 0)) {
        const h = { center: e.center, axis: e.axis, normal: e.normal };
        strip(
          df,
          h,
          -e.length * 0.25,
          e.length * 0.25,
          floor + p.base + 1.1,
          floor + p.drum - 1.0,
          'blue',
          0.035,
        );
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
    face = writer(out, d);
  body(out, face, d);
  towers(face, d);
  domes(face, d);
}
export const buildBibiSkyline = (o) => build(o, 0),
  buildBibiDistrict = (o) => build(o, 1),
  buildBibiStreet = (o) => build(o, 2),
  buildBibiCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const bibiStudy = {
  id: 'N0442',
  key: 'bibi_khanym_mosque',
  title: 'Bibi-Khanym Mosque',
  category: 'mosque',
  wikidataId: 'Q679218',
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
    'Five shared256² brick,mosaic tile,limestone,fired-clay and plain-wood graphs;six merged material roles,metric UVs and linear tints. Original sparse blue/cream bands and geometric fields abstract the photographed fabric. No embedded images,unique atlas,baked light or copied tile art/calligraphy.',
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
    'Individual medium-fi compound exterior. Current named POI/reference/layout supports approximate identity;no exact current map QID tag is claimed. Western deep prayer niche closes on tiled backing and a small wooden door proxy. Eastern gateway and lower porch retain estimated through passages. Side-pavilion niches close on shallow backing. Exact doorway sizes,unseen backs,damage,restoration,interior ceilings/foundations and walking remain unverified. Smooth main cap and fluted side caps follow map roof boundaries/heights. Low connecting walls follow standard DEM;major masses use local working planes. No historical roof reconstruction,courtyard slab,photographic textures or copied calligraphy. Physical-device timing remains unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('western-prayer-iwan-and-towers', [44, 29, 20], [-6, 21, -12]),
    cam('eastern-monumental-passage', [151, 41, -10], [88, 29, -12]),
    cam('smooth-western-dome', [-89, 43, -19], [-27, 23, -13]),
    cam('ribbed-northern-pavilion', [33, 34, -9], [29, 19, -54]),
    cam('open-courtyard', [33, 110, 80], [25, 8, -12]),
    cam('three-dome-compound-plan', [23, 290, -11.9], [23, 10, -12]),
  ],
};

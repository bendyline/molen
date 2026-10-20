/** Kairouan: three-stage square minaret,horseshoe court arcades and two ribbed domes. */
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
  '../../../content/worldgen/source/places/sn/snr/n0436_great_mosque_of_kairouan/',
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
  wall: '#c6b58e',
  trim: '#ddd7c4',
  paving: '#c8c3b1',
  roof: '#d2cdbf',
  dome: '#bda272',
  door: '#7c705b',
  gold: '#b4a079',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, kairouanGround(...p) - 0.35);
export function kairouanGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Great Mosque of Kairouan footing outside retained terrain');
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
  shape: 'horseshoe',
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
  court = _coarse(plans.court),
  towerOrigin = center(plans.tower),
  portalZ = -0.8;
export function kairouanArcades(d) {
  const hs = [];
  for (const e of edges(court)) {
    const n = d === 0 ? 6 : d === 1 ? 7 : Math.round(e.length / 3.8),
      pitch = e.length / n,
      normal = e.normal.map((v) => -v);
    for (let k = 0; k < n; k++) {
      const p = lerp(e.a, e.b, (k + 0.5) / n),
        tower = normal[0] > 0.8 && p[1] > -13 && p[1] < 2,
        gate = normal[0] < -0.8 && Math.abs(p[1] - portalZ) < 7;
      if (tower || gate) continue;
      hs.push({
        ...field(`court-${hs.length}`, p, e.axis, normal, pitch * 0.81, 0, 4.8, 3.05, 1),
        pitch,
        edge: e,
      });
    }
  }
  return hs;
}
function columns(face, p, e, d) {
  const y = 3.05,
    n = d === 2 ? 6 : 8;
  for (const u of [-0.27, 0.27]) {
    const q = p.map((x, i) => x + e.axis[i] * u + e.normal[i] * 0.17),
      r = circle(q, 0.22, n);
    const levels =
      d === 2
        ? [
            [0.025, 1.4],
            [0.4, 1],
            [y - 0.2, 0.9],
            [y, 1.4],
          ]
        : [
            [0.025, 1.5],
            [0.3, 1.5],
            [0.4, 1],
            [y - 0.25, 0.87],
            [y - 0.15, 1.5],
            [y, 1.5],
          ];
    profile(face, r, levels, 'trim', q);
  }
}
function arcades(face, d) {
  for (const h of kairouanArcades(d)) {
    panel(face, h, d, h.pitch, 0, 6.8, 'wall');
    reveal(face, h, d, 0, -0.8, 'wall');
    if (d >= 1) {
      const reverse = (s, p, n) =>
        face(
          s,
          p,
          n.map((v) => -v),
        );
      panel(reverse, h, d, h.pitch, 0, 6.8, 'wall', -0.8);
    }
    if (d >= 2) {
      archBand(face, h, d, 0.22, 'trim', 0.035);
      const p = h.center.map((v, k) => v - (h.axis[k] * h.pitch) / 2);
      columns(face, p, { axis: h.axis, normal: h.normal }, d);
    }
    const a = h.center.map((v, k) => v - h.normal[k] * 5.4 - (h.axis[k] * h.pitch) / 2),
      b = h.center.map((v, k) => v - h.normal[k] * 5.4 + (h.axis[k] * h.pitch) / 2);
    face('wall', [at(a, 0), at(b, 0), at(b, 6.55), at(a, 6.55)], [h.normal[0], 0, h.normal[1]]);
  }
  const back = scaled(court, 1.22);
  down(face, back, 6.55, 'roof', [court]);
}
function hall(out, face, d) {
  sides(face, plans.outer, footing, 0, 'wall');
  const doors = [];
  if (d >= 1)
    for (const e of edges(plans.outer))
      if (e.length > 60)
        for (const t of [0.23, 0.74])
          doors.push({
            ...field(
              'outer-closed-door',
              lerp(e.a, e.b, t),
              e.axis,
              e.normal,
              1.9,
              0.15,
              3.5,
              2,
              2,
            ),
            shape: 'round',
          });
  _shell(out, d, plans.outer, 0, 6.8, doors, 'wall');
  for (const h of doors) {
    pane(face, h, d, -0.25, 'door');
    if (d >= 2) archBand(face, h, d, 0.25);
  }
  cap(face, plans.outer, 6.8, 'roof', [plans.court]);
  cap(face, plans.outer, 0.025, 'paving');
  arcades(face, d);
  // Low prayer-hall roof strips are an explicitly estimated fallback for unseen roof fabric.
  for (let k = 0; k < 7; k++) {
    const z = -31.05 + k * 10.35,
      w = 10.2,
      a = 12.7,
      b = 62.7;
    face(
      'roof',
      [
        [a, floor + 6.8, z - w / 2],
        [b, floor + 6.8, z - w / 2],
        [b, floor + 9.3, z],
        [a, floor + 9.3, z],
      ],
      [0, 1, -0.5],
    );
    face(
      'roof',
      [
        [a, floor + 9.3, z],
        [b, floor + 9.3, z],
        [b, floor + 6.8, z + w / 2],
        [a, floor + 6.8, z + w / 2],
      ],
      [0, 1, 0.5],
    );
    face(
      'roof',
      [
        [a, floor + 6.8, z - w / 2],
        [a, floor + 9.3, z],
        [a, floor + 6.8, z + w / 2],
      ],
      [-1, 0, 0],
    );
    face(
      'roof',
      [
        [b, floor + 6.8, z - w / 2],
        [b, floor + 9.3, z],
        [b, floor + 6.8, z + w / 2],
      ],
      [1, 0, 0],
    );
  }
  // Sparse roof-edge blocks represent the photographed cadence without reproducing carvings.
  if (d >= 1)
    for (const e of edges(court)) {
      const n = Math.floor(e.length / (d === 1 ? 12 : 5));
      for (let k = 0; k < n; k++) {
        const p = lerp(e.a, e.b, (k + 0.5) / n);
        _solid(face, _rect(...p, 0.55, 0.55), 6.8, 7.15, 'trim');
      }
    }
  for (const q of [
    [-25, 7],
    [-8, -12],
  ]) {
    const r = circle(q, 1.1, d === 0 ? 4 : 8);
    profile(
      face,
      r,
      [
        [0.025, 1.2],
        [0.3, 1.2],
        [0.3, 0.85],
        [0.65, 0.85],
      ],
      'trim',
      q,
    );
    if (d >= 2) {
      cap(face, circle(q, 0.62, 8), 0.665, 'door');
    }
  }
}
export function kairouanGate() {
  return field('larger-prayer-entry', [8.48, portalZ], [0, -1], [-1, 0], 5.4, 0, 6.3, 3.8, 1);
}
function dome(face, q, r, b, t, d, slot, tipExtension = 0.4) {
  const n = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 24 : 32,
    ring = circle(q, r, n).map((p, i) =>
      d >= 2 ? p.map((v, k) => q[k] + (v - q[k]) * (i % 2 ? 1.025 : 0.975)) : p,
    );
  profile(
    face,
    ring,
    [
      [b, 1],
      [b + (t - b) * 0.25, 0.98],
      [b + (t - b) * 0.57, 0.81],
      [b + (t - b) * 0.82, 0.5],
      [t, 0.015],
    ],
    slot,
    q,
  );
  const top = t + tipExtension;
  profile(
    face,
    circle(q, 0.15, d === 0 ? 4 : 8),
    [
      [t, 1],
      [top, 0.01],
    ],
    'gold',
    q,
  );
}
function prayerGate(face, d) {
  const h = kairouanGate(),
    left = h.center.map((v, k) => v - h.axis[k] * 5.7),
    right = h.center.map((v, k) => v + h.axis[k] * 5.7);
  panel(face, h, d, 11.4, 0, 9.2, 'wall');
  reveal(face, h, d, 0, -0.9, 'trim');
  const back = h.center.map((v, k) => v - h.normal[k] * 5.5),
    a = back.map((v, k) => v - h.axis[k] * 5.7),
    b = back.map((v, k) => v + h.axis[k] * 5.7);
  face('wall', [at(a, 0), at(b, 0), at(b, 9.2), at(a, 9.2)], [-1, 0, 0]);
  for (const pair of [
    [left, a],
    [right, b],
  ])
    face(
      'wall',
      [at(pair[0], 0), at(pair[1], 0), at(pair[1], 9.2), at(pair[0], 9.2)],
      [0, 0, pair[0][1] < portalZ ? -1 : 1],
    );
  const r = [left, right, b, a];
  cap(face, r, 9.2, 'wall');
  down(face, r, 6.55, 'roof');
  const door = {
    ...field('closed-main-door', back, [0, -1], [-1, 0], 2.4, 0, 4.6, 2.8, 0.4),
    shape: 'round',
  };
  pane(face, door, d, 0.035, 'door');
  if (d >= 1) archBand(face, h, d, 0.5, 'trim');
  if (d >= 1)
    for (let k = 0; k < 9; k++) {
      const q = h.center.map((v, i) => v + h.axis[i] * (k - 4) * 1.14);
      profile(
        face,
        _rect(...q, 0.52, 0.55),
        [
          [9.2, 1],
          [9.65, 1],
          [9.95, 0.35],
        ],
        'wall',
        q,
      );
    }
  const q = [13.9, portalZ],
    base = _rect(...q, 8, 8);
  _solid(face, base, 9.2, 10.5, 'wall');
  const drum = circle(q, 3.8, d === 0 ? 6 : 12);
  profile(
    face,
    drum,
    [
      [10.5, 1],
      [12, 1],
    ],
    'wall',
    q,
  );
  if (d >= 1)
    for (const e of edges(drum)) {
      const h = {
        ...field('front-drum-window', e.center, e.axis, e.normal, 0.7, 10.7, 1, 0.55, 0.4),
        shape: 'round',
      };
      pane(face, h, d, 0.035, 'door');
    }
  dome(face, q, 3.9, 12, 15.2, d, 'dome');
  const rear = [56.5, portalZ],
    rr = _rect(...rear, 8.8, 8.8);
  _solid(face, rr, 6.8, 11.7, 'wall');
  profile(
    face,
    circle(rear, 4.3, d === 0 ? 6 : 12),
    [
      [11.7, 1],
      [13.2, 1],
    ],
    'trim',
    rear,
  );
  dome(face, rear, 4.5, 13.2, 17, d, 'roof');
}
export function kairouanTowerFields(d) {
  if (d === 0) return [];
  const rows = [];
  for (const [stage, b, t, scale] of [
    [0, 0, 20.2, 1],
    [1, 20.2, 25.5, 0.68],
    [2, 25.5, 29.5, 0.46],
  ]) {
    const ring = scaled(plans.tower, scale);
    for (const e of edges(ring)) {
      const make = (name, u, width, bottom, height, spring, shape = 'round', slot = 'wall') =>
        rows.push({
          ...field(
            name,
            e.center.map((v, k) => v + e.axis[k] * u),
            e.axis,
            e.normal,
            width,
            bottom,
            height,
            spring,
            0.8,
          ),
          shape,
          slot,
          stage,
          base: b,
          top: t,
          ring,
          edge: e,
        });
      if (stage === 0 && e.normal[0] > 0.8) {
        for (const y of [5.5, 11.1, 16.5])
          make('lower-narrow-window', 0, 0.9, y, 1.7, 1.2, 'rect', 'door');
        make('minaret-door', 0, 1.3, 0, 2.5, 1.6, 'round', 'door');
      }
      if (stage === 1)
        for (const u of [-2.1, 0, 2.1]) make('middle-blind-arch', u, 1.4, 21.2, 2.9, 1.9);
      if (stage === 2) {
        make('upper-closed-arch', 0, 2.2, 26, 2.3, 1.3, 'horseshoe', 'door');
        if (d >= 2)
          for (const u of [-1.8, -0.6, 0.6, 1.8])
            make('upper-small-field', u, 0.32, 28.8, 0.4, 0.2, 'round', 'door');
      }
    }
  }
  return rows;
}
function stageFace(face, ring, b, t, taper) {
  const q = center(ring);
  return (slot, points, n) =>
    face(
      slot,
      points.map((p) => {
        const f = 1 - (taper * (p[1] - floor - b)) / (t - b);
        return [q[0] + (p[0] - q[0]) * f, p[1], q[1] + (p[2] - q[1]) * f];
      }),
      n,
    );
}
function towerStage(face, ring, b, t, hs, d, taper) {
  const draw = stageFace(face, ring, b, t, taper);
  for (const e of edges(ring)) {
    const holes = hs.filter(
        (h) =>
          h.edge.a === e.a ||
          Math.hypot(h.edge.center[0] - e.center[0], h.edge.center[1] - e.center[1]) < 0.01,
      ),
      p = [
        [-e.length / 2, floor + b],
        [e.length / 2, floor + b],
        [e.length / 2, floor + t],
        [-e.length / 2, floor + t],
      ],
      starts = [];
    for (const h of holes) {
      starts.push(p.length);
      const u = (h.center[0] - e.center[0]) * e.axis[0] + (h.center[1] - e.center[1]) * e.axis[1];
      p.push(...openingShape(h, d).map(([x, y]) => [x + u, y]));
    }
    const ids = earcut(p.flat(), starts, 2);
    for (let i = 0; i < ids.length; i += 3)
      draw(
        'wall',
        ids
          .slice(i, i + 3)
          .map((k) => [
            e.center[0] + e.axis[0] * p[k][0],
            p[k][1],
            e.center[1] + e.axis[1] * p[k][0],
          ]),
        [e.normal[0], 0, e.normal[1]],
      );
    for (const h of holes) {
      reveal(draw, h, d, 0, -0.45, 'wall');
      pane(draw, h, d, -0.45, h.slot);
      if (d >= 2 && h.shape !== 'rect') archBand(draw, h, d, 0.18, 'trim');
    }
  }
  cap(face, scaled(ring, 1 - taper), t, 'wall');
}
function crest(face, ring, y, d) {
  if (d === 0) return;
  sides(face, scaled(ring, 1.02), y, y + 0.35, 'wall');
  for (const e of edges(ring)) {
    const n = Math.floor(e.length / (d === 1 ? 2.4 : 0.95));
    for (let k = 0; k < n; k++) {
      const p = lerp(e.a, e.b, (k + 0.5) / n),
        r = _rect(...p, 0.55, 0.55);
      profile(
        face,
        r,
        [
          [y + 0.35, 1],
          [y + 0.8, 1],
          [y + 1, 0.3],
        ],
        'wall',
        p,
      );
    }
  }
}
function minaret(face, d) {
  sides(face, plans.tower, footing, 0, 'wall');
  const fields = kairouanTowerFields(d);
  for (const [stage, b, t, scale, taper] of [
    [0, 0, 20.2, 1, 0.1],
    [1, 20.2, 25.5, 0.68, 0.045],
    [2, 25.5, 29.5, 0.46, 0.03],
  ]) {
    const ring = scaled(plans.tower, scale);
    towerStage(
      face,
      ring,
      b,
      t,
      fields.filter((h) => h.stage === stage),
      d,
      taper,
    );
    if (stage < 2) crest(face, scaled(ring, 1 - taper), t, d);
    else if (d >= 1) sides(face, scaled(ring, 1.01 - taper), t - 0.2, t, 'wall');
  }
  dome(face, towerOrigin, 2.8, 29.5, 31.2, d, 'dome', 0.3);
  // The cap finial shares the declared31.5 m mapped top,not the generic dome tip offset.
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
  prayerGate(face, d);
  minaret(face, d);
}
export const buildKairouanSkyline = (o) => build(o, 0),
  buildKairouanDistrict = (o) => build(o, 1),
  buildKairouanStreet = (o) => build(o, 2),
  buildKairouanCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const kairouanStudy = {
  id: 'N0436',
  key: 'great_mosque_of_kairouan',
  title: 'Great Mosque of Kairouan',
  category: 'mosque',
  wikidataId: 'Q1255269',
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
    'Five existing shared256² sandstone,limestone,lime plaster,plain wood and cast bronze graphs;seven merged groups with metric UVs/linear tints. Warm stone court ranges,pale column/paving tints,ochre ribbed entrance/minaret domes and pale rear dome. No embedded images,baked lighting/weathering or copied calligraphy.',
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
    'Two inspected pictures guide the tapered three-stage square minaret,vertical shaft windows,blind/upper fields,parapet crest and ribbed cap;horseshoe court arcades on selected paired columns;larger prayer portal/stepped drum/ochre ribbed dome and pale rear dome. Main roof/gables and low court well mouths are visualization estimates;small distant ancillary cap is omitted. Skyline retains the low roof ridges,coarsens arcade cadence/domes and omits crest/columns/recesses;district adds coarse fields/crest;near adds selected paired columns/arch bands/ribs. Gallery bays close on masonry backs,portal on wood doors,and minaret fields close on shallow backing;no navigable interiors. Fine carvings/inscriptions,exact spolia/cadence/rib/merlon profiles,current finish,unseen roofs/rooms/stairs and precise threshold/terrain joins,walking,engineering and physical-device performance unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('three-stage-square-minaret', [-26, 23, 22], [-56, 18, -5.6]),
    cam('prayer-portal-and-ribbed-dome', [-13, 15, 13], [11, 12, -0.8]),
    cam('horseshoe-bays-and-paired-columns', [-10, 7, 11], [-10, 7, 25]),
    cam('pale-rear-mihrab-dome', [82, 27, 19], [56.5, 15, -0.8]),
    cam('mapped-court-and-prayer-range', [0, 150, 0.1], [0, 8, 0]),
    cam('minaret-upper-arches-and-cap', [-40, 33, 11], [-56, 29, -5.6]),
  ],
};

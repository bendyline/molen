/** Xi’an: mapped courtyard compound,green prayer roofs,Phoenix Pavilion and octagonal tower. */
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
  '../../../content/worldgen/source/places/wq/wqj/great_mosque_of_xi_an/',
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
  wall: '#a19c8e',
  plaster: '#c9c8b8',
  trim: '#c6c3b2',
  wood: '#91634e',
  roof: '#90968d',
  green: '#729388',
  glass: '#53615a',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, xianGround(...p) - 0.35);
export function xianGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error("Great Mosque of Xi'an footing outside retained terrain");
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
function beam(face, a, b, w, slot = 'trim') {
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
  face(
    slot,
    lo,
    axis.map((v) => -v),
  );
  face(slot, hi, axis);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
function profile(face, ring, levels, slot) {
  const origin = center(ring);
  let prev = scaled(ring, levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const r = scaled(ring, levels[i][1]);
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
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    });
const edges = (ring) =>
  ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(ring), -axis[0] * sign(ring)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
const hole = (
  name,
  center,
  axis,
  normal,
  width,
  bottom,
  height,
  spring,
  shape = 'pointed',
  depth = 2,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
const trimBand = (face, h, d, w = 0.26) => archBand(face, h, d, w, 'trim', 0.055);
const box = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
function underside(face, r, y, slot = 'wood') {
  const ids = earcut(r.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(r[k], y)),
      [0, -1, 0],
    );
}
function post(face, p, b, t, r, d, slot = 'wood') {
  const ring = circle(p, r, d === 0 ? 4 : d === 1 ? 4 : d === 2 ? 6 : 8);
  sides(face, ring, b, t, slot);
  if (slot === 'trim') cap(face, ring, t, slot);
  if (d >= 3) {
    profile(
      face,
      ring,
      [
        [b, 1.45],
        [b + 0.3, 1.45],
        [b + 0.5, 1],
      ],
      'trim',
    );
    profile(
      face,
      ring,
      [
        [t - 0.5, 1],
        [t - 0.2, 1.7],
        [t, 1.7],
      ],
      slot,
    );
  }
}
// Surface rings describe curved eaves;edge midpoints dip while the corners turn upward.
function curvedRoof(face, r, base, rise, d, slot = 'roof', ridgeAxis = null, overhang = 0.5) {
  const p = center(r),
    bounds = box(r),
    eave = (q) =>
      q.map(
        (v, k) =>
          p[k] + (v - p[k]) * (1 + Math.min(0.2, overhang / ((bounds[k][1] - bounds[k][0]) / 2))),
      ),
    parts = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 3 : 4;
  const rings = [0, 1, 2].slice(0, d === 0 ? 1 : d === 1 ? 2 : 3).map((level) =>
    r.flatMap((a, i) => {
      const b = r[(i + 1) % r.length];
      return Array.from({ length: parts }, (_, j) => {
        const t = j / parts,
          q = lerp(a, b, t),
          scale = [1.2, 1.0, 0.62][level],
          corner = Math.pow(Math.abs(2 * t - 1), 2),
          y = base + [0.35, 0.0, rise * 0.36][level] + (level === 0 ? corner * 0.45 : 0);
        const v =
          level === 0 ? eave(q) : [p[0] + (q[0] - p[0]) * scale, p[1] + (q[1] - p[1]) * scale];
        return [v[0], y, v[1]];
      });
    }),
  );
  const B = box(r),
    last = rings.at(-1),
    top =
      ridgeAxis === 'z'
        ? r.flatMap((a, i) =>
            Array.from({ length: parts }, (_, j) => {
              const q = lerp(a, r[(i + 1) % r.length], j / parts);
              return [p[0] + (q[0] - p[0]) * 0.015, base + rise, p[1] + (q[1] - p[1]) * 0.7];
            }),
          )
        : ridgeAxis === 'x'
          ? r.flatMap((a, i) =>
              Array.from({ length: parts }, (_, j) => {
                const q = lerp(a, r[(i + 1) % r.length], j / parts);
                return [p[0] + (q[0] - p[0]) * 0.7, base + rise, p[1] + (q[1] - p[1]) * 0.015];
              }),
            )
          : last.map(() => [p[0], base + rise, p[1]]);
  rings.push(top);
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < last.length; i++) {
      const k = (i + 1) % last.length;
      face(
        slot,
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]].map((q) => [
          q[0],
          floor + q[1],
          q[2],
        ]),
        [0, 1, 0],
      );
    }
  if (ridgeAxis) {
    face(
      slot,
      top.map((q) => [q[0], floor + q[1], q[2]]),
      [0, 1, 0],
    );
    const a =
        ridgeAxis === 'z'
          ? [p[0], B[1][0] + (B[1][1] - B[1][0]) * 0.15]
          : [B[0][0] + (B[0][1] - B[0][0]) * 0.15, p[1]],
      b =
        ridgeAxis === 'z'
          ? [p[0], B[1][1] - (B[1][1] - B[1][0]) * 0.15]
          : [B[0][1] - (B[0][1] - B[0][0]) * 0.15, p[1]];
    if (d >= 2) beam(face, at(a, base + rise + 0.1), at(b, base + rise + 0.1), 0.2, slot);
  }
  underside(face, r.map(eave), base + 0.02, 'wood');
}
const openBand = (face, a, b, y, h, slot = 'wood') => {
  const q = unit(b.map((v, k) => v - a[k])),
    n = [q[1], -q[0]],
    w = 0.16,
    r = [
      a.map((v, k) => v + n[k] * w),
      b.map((v, k) => v + n[k] * w),
      b.map((v, k) => v - n[k] * w),
      a.map((v, k) => v - n[k] * w),
    ];
  solid(face, r, y, y + h, slot);
};
function postFrame(_out, face, r, b, t, d, columns = 1, slot = 'wood') {
  const es = edges(r);
  for (const e of es) {
    const n = columns === 1 ? 1 : Math.max(1, Math.round(e.length / columns));
    for (let i = 0; i < n; i++)
      post(face, lerp(e.a, e.b, i / n), b, t, d === 0 ? 0.22 : 0.2, d, slot);
    if (d >= 1) openBand(face, e.a, e.b, t - 0.5, 0.35, slot);
  }
  if (d >= 2)
    for (const e of es) {
      const n = Math.max(1, Math.round(e.length / 2));
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n);
        solid(
          face,
          rect(p[0] - 0.3, p[1] - 0.24, p[0] + 0.3, p[1] + 0.24),
          t - 0.25,
          t + 0.22,
          slot,
        );
      }
    }
}
export function xianWingFields(d = 3) {
  if (d === 0) return [];
  const list = [];
  for (const w of plans.wings) {
    if (w.small) continue;
    for (const e of edges(w.outline)) {
      if (e.length < 5) continue;
      const n = d === 1 ? 1 : Math.max(1, Math.round(e.length / 6));
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n);
        list.push({
          ...hole(
            `wing-${w.id}-${list.length}`,
            p,
            e.axis,
            e.normal,
            1.3,
            1.2,
            1.8,
            1.8,
            'rect',
            1.4,
          ),
          wing: w.id,
        });
      }
    }
  }
  return list;
}
function wings(out, face, d) {
  const fields = xianWingFields(d);
  function distantOutline(raw) {
    const ring = raw.map((p) => [...p]);
    let changed = true;
    while (changed && ring.length > 4) {
      changed = false;
      for (let i = 0; i < ring.length && ring.length > 4; i++) {
        const a = ring[(i + ring.length - 1) % ring.length],
          b = ring[(i + 1) % ring.length],
          p = ring[i],
          dx = b[0] - a[0],
          dz = b[1] - a[1],
          length2 = dx * dx + dz * dz,
          t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length2));
        if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < 0.55) {
          ring.splice(i, 1);
          changed = true;
          i--;
        }
      }
    }
    return ring;
  }
  for (const w of plans.wings) {
    if (w.small) {
      const b = box(w.outline),
        r = rect(b[0][0], b[1][0], b[0][1], b[1][1]);
      cap(face, r, 0.15, 'trim');
      if (d === 0) for (const p of [r[0], r[2]]) post(face, p, 0.15, 3.6, 0.2, d);
      else postFrame(out, face, r, 0.15, 3.6, d);
      curvedRoof(face, r, 3.6, 1.5, d, 'roof', b[0][1] - b[0][0] > b[1][1] - b[1][0] ? 'x' : 'z');
      if (d >= 1) solid(face, scaled(r, 0.35), 0.15, 2.8, 'trim');
      continue;
    }
    const fs = fields.filter((h) => h.wing === w.id),
      b = box(w.outline),
      outline = d === 0 ? distantOutline(w.outline) : w.outline;
    shell(
      out,
      d,
      outline,
      footing,
      d === 0 ? 5.3 : 4.4,
      d <= 1 ? [] : fs,
      w.id % 2 === 0 ? 'plaster' : 'wall',
    );
    if (d === 0) {
      // Distant courtyard ranges keep their notches and a single grey roof plane.
      cap(face, outline, 5.3, 'roof');
      continue;
    }
    for (const h of fs) {
      pane(face, h, d, d === 1 ? 0.035 : -0.15, 'glass');
      if (d >= 2) trimBand(face, h, 1, 0.12);
    }
    curvedRoof(
      face,
      outline,
      4.4,
      1.8,
      d,
      'roof',
      b[0][1] - b[0][0] > b[1][1] - b[1][0] ? 'x' : 'z',
      0,
    );
  }
}
export function xianHallDoors() {
  const x = -75,
    z0 = -20.8,
    z1 = 14.3;
  return Array.from({ length: 7 }, (_, i) => ({
    ...hole(
      `prayer-screen-${i}`,
      [x, z0 + ((i + 0.5) * (z1 - z0)) / 7],
      [0, 1],
      [1, 0],
      3.6,
      1.0,
      4.4,
      4.4,
      'rect',
      1.3,
    ),
    kind: 'wood',
  }));
}
function hall(out, face, d) {
  const raw = plans.hall.outline,
    body = rect(-103.2, -22.48, -75, 16.01),
    rear = rect(-114.99, -10.14, -102.65, 4.17),
    fields = d === 0 ? [] : xianHallDoors();
  sides(face, raw, footing, 0.8, 'trim');
  cap(face, raw, 0.8, 'trim');
  shell(out, d, body, 0.8, 7.8, fields, 'wood');
  solid(face, rear, 0.8, 6.8, 'wall');
  for (const h of fields) {
    pane(face, h, d, -0.2, 'wood');
    if (d >= 2) {
      trimBand(face, h, 1, 0.12);
      for (const u of [-1.2, 0, 1.2])
        beam(
          face,
          at([h.center[0] + 0.015, h.center[1] + u], 1.0),
          at([h.center[0] + 0.015, h.center[1] + u], 5.4),
          0.12,
          'wood',
        );
    }
  }
  for (const [a, b] of [
    [-104, -92],
    [-93, -81],
    [-82, -69.8],
  ])
    curvedRoof(face, rect(a, -23, b, 16.8), 7.8, 3.4, d, 'green', 'z', 2.2);
  curvedRoof(face, rear, 6.8, 2.5, d, 'green', 'x');
  const n = d === 0 ? 4 : 8;
  for (let i = 0; i < n; i++) post(face, [-71.2, -21.2 + (i * 36.0) / (n - 1)], 0.8, 7.8, 0.3, d);
  if (d >= 1) {
    openBand(face, [-71.2, -21.2], [-71.2, 14.8], 6.65, 0.45, 'wood');
    for (const z of [-18.5, -9, 0.5, 10])
      openBand(face, [-69.8, z], [-69.8, z + 2.8], 1.5, 0.15, 'wood');
  }
  if (d >= 2)
    for (let i = 0; i < 7; i++) {
      const z = -21.2 + ((i + 0.5) * 36) / 7;
      solid(face, rect(-72.0, z - 0.6, -70.2, z + 0.6), 7.0, 7.65, 'wood');
    }
}
function pavilion(out, face, p, radius, base, rise, d, sidesCount = 6, slot = 'roof') {
  const angle = Math.PI / sidesCount,
    r = circle([0, 0], radius, sidesCount).map(([x, z]) => [
      p[0] + x * Math.cos(angle) - z * Math.sin(angle),
      p[1] + x * Math.sin(angle) + z * Math.cos(angle),
    ]);
  cap(face, r, 0.15, 'trim');
  postFrame(out, face, scaled(r, 0.8), 0.15, base, d);
  curvedRoof(face, r, base, rise, d, slot);
  if (d >= 1) post(face, p, base + rise, base + rise + 0.8, 0.14, d, 'trim');
}
function phoenix(out, face, d) {
  const p = plans.phoenix.center;
  pavilion(out, face, p, 3.8, 6.7, 4.3, d, 6, 'roof');
  for (const s of [-1, 1]) {
    const q = [p[0], p[1] + s * 9.0];
    pavilion(out, face, q, 2.6, 4.4, 2.5, d, 4, 'roof');
    const link = rect(
      p[0] - 1.6,
      Math.min(p[1] + s * 3, p[1] + s * 7),
      p[0] + 1.6,
      Math.max(p[1] + s * 3, p[1] + s * 7),
    );
    curvedRoof(face, link, 4.1, 1.4, d, 'roof', 'z');
    if (d >= 1)
      for (const z of [link[0][1], link[2][1]])
        for (const x of [p[0] - 1.3, p[0] + 1.3]) post(face, [x, z], 0.15, 4.1, 0.17, d);
  }
  if (d >= 1) {
    const plaque = rect(p[0] + 2.9, p[1] - 1.7, p[0] + 3.1, p[1] + 1.7);
    solid(face, plaque, 4.4, 5.5, 'wood');
  }
  if (d >= 2)
    for (const s of [-1, 1]) {
      const z = p[1] + s * 13.0;
      openBand(face, [p[0] - 6, z], [p[0] + 6, z], 1.0, 0.2, 'trim');
      for (let j = 0; j < 5; j++) post(face, [p[0] - 6 + j * 3, z], 0.1, 1.2, 0.18, d, 'trim');
    }
}
const oct = (p, r) =>
  Array.from({ length: 8 }, (_, i) => {
    const a = ((i + 0.5) * Math.PI) / 4;
    return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
  });
export function xianTowerOpenings() {
  const p = plans.tower.center,
    off = 2.8 * Math.cos(Math.PI / 8);
  return [-1, 1].map((s) =>
    hole(
      `tower-through-${s}`,
      [p[0] + s * off, p[1]],
      [0, 1],
      [s, 0],
      1.65,
      0.1,
      3.4,
      2.4,
      'round',
      2.3,
    ),
  );
}
function tower(out, face, d) {
  const p = plans.tower.center,
    r = oct(p, 2.8),
    inner = oct(p, 1.7),
    openings = xianTowerOpenings();
  if (d === 0) {
    solid(face, rect(p[0] - 2.6, p[1] - 2.6, p[0] + 2.6, p[1] - 1.2), 0.1, 4.2, 'wall');
    solid(face, rect(p[0] - 2.6, p[1] + 1.2, p[0] + 2.6, p[1] + 2.6), 0.1, 4.2, 'wall');
    cap(face, r, 4.2, 'wood');
  } else shell(out, d, r, 0.1, 4.2, openings, 'wall', inner);
  const columns = d === 0 ? 4 : 8;
  for (let i = 0; i < columns; i++) {
    const a = ((i + 0.5) * Math.PI * 2) / columns;
    post(face, [p[0] + Math.cos(a) * 3.7, p[1] + Math.sin(a) * 3.7], 0.1, 4.6, 0.22, d);
  }
  curvedRoof(face, oct(p, 4.6), 4.6, 1.5, d, 'green');
  for (const [lo, hi, rad] of [
    [6.1, 9.4, 3.1],
    [10.7, 13.6, 2.5],
  ]) {
    const r = oct(p, rad);
    solid(face, r, lo, hi, 'wood');
    if (d >= 1)
      for (const e of edges(r)) {
        const h = hole(
          `tower-screen-${lo}-${e.a}`,
          lerp(e.a, e.b, 0.5),
          e.axis,
          e.normal,
          rad * 0.55,
          lo + 0.55,
          1.6,
          1.6,
          'rect',
        );
        pane(face, h, d, 0.035, 'glass');
      }
    if (d >= 2)
      for (const e of edges(scaled(r, 1.18))) {
        openBand(face, e.a, e.b, lo + 0.8, 0.12, 'wood');
        for (const q of [e.a, lerp(e.a, e.b, 0.5)]) post(face, q, lo, lo + 0.95, 0.09, d);
      }
  }
  curvedRoof(face, oct(p, 4.1), 9.4, 1.3, d, 'green');
  curvedRoof(face, oct(p, 3.8), 13.6, 2.6, d, 'green');
  post(face, p, 16.2, 17.0, 0.14, d, 'trim');
}
function gates(_out, face, d) {
  for (const p of plans.gates) {
    const r = p.outline,
      b = box(r),
      n = d === 0 ? 2 : p.bays,
      xc = p.center[0];
    cap(face, r, 0.1, 'trim');
    for (let i = 0; i <= n; i++)
      for (const x of d === 0 ? [xc] : [xc - 1.8, xc + 1.8])
        post(face, [x, b[1][0] + ((b[1][1] - b[1][0]) * i) / n], 0.1, 4.5, 0.22, d);
    curvedRoof(face, r, 4.5, 2.1, d, 'roof', 'z');
    if (d >= 1)
      for (const x of [xc - 1.8, xc + 1.8])
        openBand(face, [x, b[1][0]], [x, b[1][1]], 3.6, 0.4, 'wood');
  }
  const p = plans.unmappedArchway.center,
    n = d === 0 ? 2 : 4;
  for (let i = 0; i <= n; i++)
    post(face, [p[0], p[1] - 7.5 + (15 * i) / n], 0.1, i > 0 && i < n ? 6.6 : 5.0, 0.22, d);
  for (const [lo, hi, y] of [
    [-7.5, -2.7, 4.9],
    [-3, 3, 6.5],
    [2.7, 7.5, 4.9],
  ]) {
    const r = rect(p[0] - 1.3, p[1] + lo, p[0] + 1.3, p[1] + hi);
    curvedRoof(face, r, y, 1.5, d, 'roof', 'z');
    if (d >= 1) openBand(face, [p[0], p[1] + lo], [p[0], p[1] + hi], y - 0.8, 0.6, 'wood');
  }
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let longest = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const l = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (l > longest) {
              longest = l;
              k = i;
            }
          }
          if (longest > (d === 0 ? 60 : d === 1 ? 38 : 22)) {
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
  const court = d === 0 ? rect(-72, -16, 109, 22) : plans.whole.outline;
  sides(face, court, footing, 0.08, 'trim');
  cap(face, court, 0.08, 'trim', d === 0 ? [] : plans.whole.holes);
  hall(out, face, d);
  wings(out, face, d);
  phoenix(out, face, d);
  tower(out, face, d);
  gates(out, face, d);
}
export const buildXianSkyline = (o) => build(o, 0),
  buildXianDistrict = (o) => build(o, 1),
  buildXianStreet = (o) => build(o, 2),
  buildXianCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const xianStudy = {
  id: 'great_mosque_of_xi_an',
  key: 'great_mosque_of_xi_an',
  title: "Great Mosque of Xi'an",
  category: 'mosque',
  wikidataId: 'Q820842',
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
    'Six existing shared256² brick,lime plaster,continuous limestone,plain wood,barrel ceramic and glazed tile graphs;seven roles including local opaque glazing. Painted timber and green roofs use shared texture/tint variants. Metric UVs,linear tints,faceted architecture;no embedded images,unique facade atlas,copied calligraphy or baked lighting.',
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
    'Three inspected pictures and normal viewer PMTiles/DEM guide the individual compound.21 current footprints retained;no exact-QID polygon resolved. Functional labels,membership,paving boundary,unmapped Phoenix wings/paifang,roof/room partitions and all heights are reviewed estimates. Grey/red timber and green/grey curved tile roofs distinguish the Chinese exterior;fine dougong,roof-end sculpture,plaques,calligraphy,planting and precise lattice/bay counts remain abstracted or omitted. The central tower has an open base passage;upper screens and prayer doors close opaque exterior fields. No furnished or freely traversable interior. Current finish,exact ground/step/street joins,engineering and physical-device measurements remain unverified. Surrounding town buildings and other mosques are excluded;synthetic East Asian neighbors are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('whole-east-west-courtyard-sequence', [160, 115, 155], [-5, 5, 0]),
    cam('green-prayer-hall-and-open-portico', [-33, 15, 33], [-78, 6, -2]),
    cam('phoenix-three-roof-open-pavilion', [-13, 15, 23], [-33, 6, 0]),
    cam('three-eave-octagonal-tower', [25, 17, 26], [4.2, 8, 2.2]),
    cam('axial-gates-and-paifang', [116, 15, 29], [62, 5, 3]),
    cam('roof-and-signed-plan', [0, 310, 0.1], [0, 5, 0]),
  ],
};

/** Sheikh Lotfollah: warm pointed dome, blue drum and recessed square-facing portal. */
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
  '../../../content/worldgen/source/places/tj/tju/n0458_sheikh_lotfollah_mosque/',
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
  wall: '#ceb18b',
  trim: '#dbcfb6',
  roof: '#c5b79e',
  dome: '#d5bd8e',
  tile: '#638eac',
  door: '#79624f',
  glass: '#546773',
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
const _lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
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
const footing = (p) => Math.min(-0.35, floor - 0.3, lotfGround(...p) - 0.35);
export function lotfGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Lotfollah footing outside retained terrain');
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
    if (h.name.startsWith('court-') && (i === 0 || i === 1 || i === inner.length - 1)) continue;
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
const _edges = (ring) =>
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
const _capDome = (face, p, r, base, height, d, small = false) => {
  const n = small ? [4, 6, 10, 14, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + height * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
};
function _finial(face, p, y, d) {
  if (d === 0) {
    solid(face, rect(p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08), y, y + 1.5, 'gold');
    return;
  }
  beam(face, at(p, y), at(p, y + 1.5), d === 0 ? 0.16 : 0.12, 'gold');
  if (d >= 3)
    profile(
      face,
      circle(p, 0.24, 6),
      [
        [y + 0.2, 0.65],
        [y + 0.6, 1],
        [y + 1.0, 0.5],
      ],
      'gold',
    );
}
const _trimBand = (face, h, d, w = 0.26) => archBand(face, h, d, w, 'trim', 0.055);
const _box = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
function _underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function band(face, r, y, h, slot = 'trim', f = 1.015) {
  solid(face, scaled(r, f), y, y + h, slot);
}
function _openBand(face, a, b, y, h, slot = 'trim', width = 0.18) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [u[1] * width, -u[0] * width];
  solid(
    face,
    [
      a.map((v, k) => v + n[k]),
      b.map((v, k) => v + n[k]),
      b.map((v, k) => v - n[k]),
      a.map((v, k) => v - n[k]),
    ],
    y,
    y + h,
    slot,
  );
}
function _column(face, p, b, t, r, d, slot = 'trim') {
  const ring = circle(p, r, d <= 1 ? 4 : d === 2 ? 8 : 12);
  sides(face, ring, b, t, slot);
  cap(face, ring, t, slot);
  if (d >= 3 && t - b > 2) {
    profile(
      face,
      ring,
      [
        [b, 1.5],
        [b + 0.25, 1.5],
        [b + 0.45, 1],
      ],
      slot,
    );
    profile(
      face,
      ring,
      [
        [t - 0.5, 1],
        [t - 0.25, 1.65],
        [t, 1.65],
      ],
      slot,
    );
  }
}

const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
export const lotfIwan = () =>
  hole('tall-pointed-iwan', plans.portal.center, [1, 0], [0, 1], 7.4, 0.5, 14.2, 8.9, 'pointed', 9);
export function lotfWallFields(d = 3) {
  if (d === 0) return [];
  const all = [];
  for (const [i, e] of edges(plans.whole.outline).entries()) {
    if (e.length < 8) continue;
    const count = Math.max(1, Math.floor(e.length / (d === 1 ? 10 : 5.4)));
    for (let k = 0; k < count; k++) {
      const t = (k + 0.5) / count,
        p = e.a.map((v, j) => v + (e.b[j] - v) * t);
      if (e.normal[1] > 0.8 && Math.abs(p[0] - plans.portal.center[0]) < 8) continue;
      all.push(
        hole(
          `wall-field-${i}-${k}`,
          p,
          e.axis,
          e.normal,
          Math.min(3.2, (e.length / count) * 0.65),
          3.1,
          6.8,
          4.6,
          'pointed',
          1.1,
        ),
      );
    }
  }
  return all;
}
export function lotfDrumFields(d = 3) {
  if (d < 1) return [];
  return edges(plans.dome.outline)
    .filter((_, i) => d >= 2 || i % 3 === 0)
    .filter((e) => {
      const p = e.a.map((v, k) => (v + e.b[k]) / 2);
      return !(p[1] > 17 && Math.abs(p[0] - plans.portal.center[0]) < 4);
    })
    .map((e, i) => ({
      ...hole(
        `drum-field-${i}`,
        e.a.map((v, k) => (v + e.b[k]) / 2),
        e.axis,
        e.normal,
        1.5,
        12.7,
        2.8,
        1.7,
        'pointed',
        1,
      ),
      kind: i % 3 === 0 ? 'glass' : 'tile',
    }));
}
function fields(face, hs, d, slot = 'glass') {
  for (const h of hs) {
    pane(face, h, d, d === 1 ? 0.12 : -0.12, h.kind ?? slot);
    if (d >= 2) archBand(face, h, d, 0.18, 'trim', 0.04);
  }
}
function hall(out, face, d) {
  const r = plans.whole.outline,
    iwan = lotfIwan(),
    hs = lotfWallFields(d),
    openings = [iwan, ...(d >= 2 ? hs : [])];
  // The portal supplies the iwan's reveal once; clipping the hall must not add a second skin.
  shell(masked(out, [prepareOpening(iwan, 0, d)]), d, r, 0.12, 11.8, d >= 2 ? hs : [], 'wall');
  cap(
    writer(
      masked(
        out,
        openings.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    r,
    11.8,
    'roof',
  );
  fields(face, hs, d, 'roof');
  if (d >= 1) {
    for (const e of edges(r)) {
      const limits = [0, 1],
        low = plans.portal.center[0] - plans.portal.width / 2 - 0.2,
        high = plans.portal.center[0] + plans.portal.width / 2 + 0.2;
      if (e.normal[1] > 0.8 && Math.abs(e.b[0] - e.a[0]) > 0.1)
        for (const x of [low, high]) {
          const t = (x - e.a[0]) / (e.b[0] - e.a[0]);
          if (t > 0 && t < 1) limits.push(t);
        }
      limits.sort((a, b) => a - b);
      for (let i = 0; i < limits.length - 1; i++) {
        const point = (t) => e.a.map((v, k) => v + (e.b[k] - v) * t),
          mid = point((limits[i] + limits[i + 1]) / 2);
        if (e.normal[1] > 0.8 && mid[0] > low && mid[0] < high) continue;
        const a = point(limits[i]),
          b = point(limits[i + 1]);
        _openBand(face, a, b, 11.5, 0.5, 'wall', 0.23);
        _openBand(face, a, b, 0.45, 0.6, 'trim', 0.2);
      }
    }
  }
}
function dome(out, face, d) {
  // The drum overlaps the portal in plan; its masonry and bands stop at the recessed vault.
  out = masked(out, [prepareOpening(lotfIwan(), 0, d)]);
  face = writer(out, d);
  const r = plans.dome.outline,
    p = center(r),
    hs = lotfDrumFields(d);
  if (d >= 2) shell(out, d, r, 11.8, 16.8, hs, 'tile');
  else solid(face, r, 11.8, 16.8, 'tile');
  fields(face, hs, d, 'tile');
  if (d >= 1) {
    band(face, r, 11.8, 0.35, 'trim', 1.02);
    band(face, r, 16.2, 0.42, 'tile', 1.025);
    band(face, r, 16.62, 0.18, 'trim', 1.025);
  }
  const levels =
    d === 0
      ? [
          [16.8, 1],
          [22, 0.88],
          [27, 0.5],
          [30.8, 0],
        ]
      : d === 1
        ? [
            [16.8, 1],
            [19.2, 0.99],
            [23, 0.82],
            [26.5, 0.56],
            [29, 0.28],
            [30.8, 0],
          ]
        : [
            [16.8, 1],
            [18, 0.998],
            [20, 0.96],
            [22, 0.88],
            [24, 0.75],
            [26, 0.6],
            [28, 0.4],
            [29.5, 0.19],
            [30.8, 0],
          ];
  profile(face, r, levels, 'dome');
  profile(
    face,
    circle(p, d <= 1 ? 0.12 : 0.09, d <= 1 ? 4 : 8),
    [
      [30.8, 1],
      [32, 0],
    ],
    'trim',
  );
  if (d >= 2)
    for (const [y, rad] of [
      [31, 0.19],
      [31.35, 0.14],
      [31.65, 0.1],
    ])
      profile(
        face,
        circle(p, rad, 8),
        [
          [y - 0.12, 0],
          [y, 1],
          [y + 0.12, 0],
        ],
        'trim',
      );
}
function portal(out, face, d) {
  const p = plans.portal.center,
    w = plans.portal.width / 2,
    z = p[1],
    r = rect(p[0] - w, z - plans.portal.depth, p[0] + w, z),
    h = lotfIwan();
  shell(out, d, r, 0.12, 16.5, [h], 'tile');
  cap(writer(masked(out, [prepareOpening(h, 0, d)]), d), r, 16.5, 'tile');
  // Recess has a closed rear face and a shallow wooden door, not an unmodeled walk-through interior.
  const rear = { ...h, center: [p[0], z - 3.75], depth: 1 };
  pane(face, rear, d, 0.03, 'tile');
  const door = hole(
    'wooden-entry-door',
    [p[0], z - 3.69],
    [1, 0],
    [0, 1],
    2.8,
    0.5,
    5,
    3.4,
    'pointed',
    0.8,
  );
  pane(face, door, d, 0.04, 'door');
  if (d >= 1) {
    archBand(face, h, d, 0.42, 'trim', 0.06);
    archBand(
      face,
      { ...h, width: 8.7, height: 15.2, bottom: floor + 0.18, spring: 9.1 },
      d,
      0.16,
      'tile',
      0.09,
    );
  }
  if (d >= 2) {
    archBand(face, door, d, 0.28, 'trim', 0.08);
    for (const x of [p[0] - 5.2, p[0] + 5.2]) {
      const q = hole(
        'portal-side-field',
        [x, z + 0.02],
        [1, 0],
        [0, 1],
        1.35,
        3,
        9.8,
        7.9,
        'pointed',
        0.8,
      );
      pane(face, q, d, 0.03, 'tile');
      archBand(face, q, d, 0.14, 'trim', 0.07);
      solid(face, rect(x - 0.65, z - 0.12, x + 0.65, z + 0.06), 1.3, 1.7, 'trim');
    }
    beam(face, at([p[0], z - 3.56], 0.6), at([p[0], z - 3.56], 4), 0.1, 'trim');
  }
  if (d >= 3) {
    for (let row = 0; row < 3; row++) {
      const count = 5 - row,
        wid = 5.8 / count,
        y = 9.7 + row * 1.3;
      for (let i = 0; i < count; i++) {
        const x = p[0] + (i - (count - 1) / 2) * wid,
          q = (u, v, zz) => [x + u, floor + y + v, z - 3.65 + zz];
        face('trim', [q(-wid * 0.47, 0, 0), q(wid * 0.47, 0, 0), q(0, 0.8, 0.65)], [0, 0, 1]);
        face('tile', [q(-wid * 0.47, 0, 0), q(0, 0.8, 0.65), q(0, 0.95, 0)], [-1, 0, 1]);
        face('tile', [q(wid * 0.47, 0, 0), q(0, 0.95, 0), q(0, 0.8, 0.65)], [1, 0, 1]);
      }
    }
  }
  solid(face, rect(p[0] - w - 0.15, z - 0.3, p[0] + w + 0.15, z + 0.15), 16.1, 16.5, 'tile');
  // Pale low plinth stops at the opening on both sides.
  for (const [a, b] of [
    [p[0] - w, p[0] - 3.7],
    [p[0] + 3.7, p[0] + w],
  ])
    solid(face, rect(a, z - 0.22, b, z + 0.08), 0.12, 1.35, 'trim');
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
    r = plans.whole.outline;
  sides(face, r, footing, 0.12, 'trim');
  cap(face, r, 0.12, 'trim');
  hall(out, face, d);
  dome(out, face, d);
  portal(out, face, d);
}
export const buildLotfSkyline = (o) => build(o, 0),
  buildLotfDistrict = (o) => build(o, 1),
  buildLotfStreet = (o) => build(o, 2),
  buildLotfCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const lotfStudy = {
  id: 'N0458',
  key: 'sheikh_lotfollah_mosque',
  title: 'Sheikh Lotfollah Mosque',
  category: 'mosque',
  wikidataId: 'Q856356',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Reference photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared 256² longformat brick, sandstone, lime plaster, generic mosaic and wood graphs serve seven merged roles including opaque blue-grey fields. Dome and blue facade reuse the same generic mosaic graph with different linear tints. Metric UVs; zero embedded images, baked lighting, copied calligraphy or unique facade atlases.',
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
    'Individual mosque exterior; long bazaar arcade remains separate host content. Mapped total height is 32 m and rounded roof part guides the dome. Detailed portal dimensions, roof subdivisions, low side/rear bays, drum fields and finial beads are estimates. Generic shared mosaic broadly suggests warm/blue tile rhythm; fine floral/calligraphic artwork is not reproduced. Recessed iwan has a closed rear wall and door; no hidden corridor, furnished-interior or free-walking claim. Exact current finish, entrance steps, terrain joins and physical-device timings remain unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('warm-pointed-dome-and-blue-drum', [29, 32, 38], [-2.6, 22, 8]),
    cam('recessed-blue-entrance', [-2.55, 10, 47], [-2.55, 8, 19.5]),
    cam('original-broad-vault-cells', [-0.5, 10, 28], [-2.55, 10.5, 17.8]),
    cam('mapped-rounded-roof-part', [39, 26, -25], [-2.6, 16, 8]),
    cam('brick-side-bays-and-low-roof', [56, 19, 11], [15, 7, 7]),
    cam('north-up-mosque-and-bazaar-boundary', [0, 180, 0.1], [0, 8, 0]),
  ],
};

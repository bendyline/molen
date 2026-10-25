/** Baitul: cubic banded prayer hall, open pointed galleries and octagonal minaret. */
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
  '../../../content/worldgen/source/places/wh/wh0/baitul_mukarram_national_mosque/',
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
  wall: '#e5dfcf',
  trim: '#ded5c0',
  roof: '#bbb7aa',
  band: '#66686b',
  door: '#806b54',
  gold: '#b69c64',
  glass: '#526573',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, baitulGround(...p) - 0.35);
export function baitulGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Baitul footing outside retained terrain');
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
    return { a, b, axis, normal: [axis[1] * sign(r), -axis[0] * sign(r)] };
  });
function finish(face, h, d) {
  pane(face, h, d, d === 1 ? 0.2 : -0.18, h.kind ?? 'glass');
  if (d >= 2) archBand(face, h, d, 0.25, 'trim', 0.06);
}
export function baitulHallFields(d = 3) {
  const hs = [
    ...[-10, 1.5, 13].map((z, i) => ({
      ...hole(
        `hall-front-${i}`,
        [-22.5, z],
        [0, 1],
        [1, 0],
        i === 1 ? 8.4 : 4.6,
        0.12,
        i === 1 ? 15.5 : 10.8,
        i === 1 ? 10 : 6.8,
        'pointed',
        3,
      ),
      kind: 'door',
    })),
  ];
  if (d === 0) return hs;
  const n = d === 1 ? 3 : 5;
  for (const z of [-17.3, 20.3])
    for (let i = 0; i < n; i++)
      hs.push({
        ...hole(
          `hall-side-${z}-${i}`,
          [-50 + ((i + 0.5) * 25) / n, z],
          [1, 0],
          [0, z < 0 ? -1 : 1],
          2.2,
          3,
          6.3,
          4.2,
          'pointed',
          1.8,
        ),
        kind: 'glass',
      });
  return hs;
}
const bayXs = [-16, -8, 0, 8, 16, 24, 32, 40];
export function baitulArcades() {
  const hs = [];
  for (const z of [-31, 31])
    for (const x of bayXs)
      hs.push(
        hole(
          `court-side-${x}-${z}`,
          [x, z],
          [1, 0],
          [0, z < 0 ? 1 : -1],
          5.7,
          0.12,
          6.8,
          4.3,
          'pointed',
          2,
        ),
      );
  for (const z of [-35, -26, -17, 17, 26, 35])
    hs.push(hole(`court-east-${z}`, [46.5, z], [0, 1], [-1, 0], 5.7, 0.12, 6.8, 4.3, 'pointed', 2));
  return hs;
}
export const baitulGate = () =>
  hole('east-through-gate', [49.6, 1.5], [0, 1], [1, 0], 10.8, 0.12, 15.8, 9.8, 'pointed', 12);
function hall(out, face, d) {
  const hs = baitulHallFields(d),
    r = plans.hall;
  if (d >= 1) shell(out, d, r, 0.12, 33.5, hs);
  else
    shell(
      out,
      d,
      r,
      0.12,
      33.5,
      hs.filter((h) => h.name.startsWith('hall-front')),
    );
  cap(face, r, 33.5, 'roof');
  for (const h of hs) finish(face, h, d);
  for (const y of [27.6, 29.3, 31]) band(face, r, y, 0.5, 'band', 1.006);
  if (d >= 1) band(face, r, 33.2, 0.3, 'trim', 1.012);
  const portal = rect(-24, -15.5, -16, 18.5),
    openings = hs
      .filter((h) => h.name.startsWith('hall-front'))
      .map((h) => ({ ...h, center: [-18.7, h.center[1]], depth: 11 }));
  shell(out, d, portal, 0.12, 22, openings);
  cap(face, portal, 22, 'roof');
  if (d >= 1)
    for (const h of openings)
      archBand(face, { ...h, center: [-16, h.center[1]] }, d, 0.5, 'trim', 0.05);
  if (d >= 2) {
    for (const z of [-15, 18]) solid(face, rect(-16.4, z - 0.3, -15.5, z + 0.3), 0.12, 23, 'trim');
    band(face, portal, 21.5, 0.4, 'trim', 1.01);
  }
}
function roofBar(face, r, d) {
  cap(face, r, 9, 'roof');
  _underside(face, r, 8.5, 'trim');
  sides(face, r, 8.5, 9, 'wall');
  if (d >= 2) for (const e of edges(r)) _openBand(face, e.a, e.b, 8.9, 0.35, 'trim', 0.18);
}
function galleries(out, face, d) {
  const arches = baitulArcades();
  for (const z of [-31, 31]) {
    const outer = z < 0 ? rect(-22, -41.8, 53.4, -31) : rect(-22, 31, 53.4, 41.7),
      inner = rect(-21.8, z - 0.45, 46.8, z + 0.45),
      hs = arches.filter((h) => h.center[1] === z);
    roofBar(face, outer, d);
    if (d === 0) {
      for (const x of [-20, -12, -4, 4, 12, 20, 28, 36, 44])
        solid(face, rect(x - 0.5, z - 0.5, x + 0.5, z + 0.5), 0.12, 8.5, 'wall');
    } else {
      shell(out, d, inner, 0.12, 8.5, hs);
      for (const h of hs) archBand(face, h, d, 0.35, 'trim', 0.52);
    }
    const outside = z < 0 ? -41.3 : 41.2,
      outerWall = rect(-22, outside - 0.4, 53.4, outside + 0.4);
    const panes =
      d < 2
        ? []
        : bayXs.map((x, i) => ({
            ...hole(
              `outer-window-${z}-${i}`,
              [x, z < 0 ? outside - 0.4 : outside + 0.4],
              [1, 0],
              [0, z < 0 ? -1 : 1],
              3.6,
              1.8,
              4.6,
              3,
              'pointed',
              1.4,
            ),
            kind: 'glass',
          }));
    if (d >= 2) {
      shell(out, d, outerWall, 0.12, 8.5, panes);
      for (const h of panes) finish(face, h, d);
    } else solid(face, outerWall, 0.12, 8.5, 'wall');
    if (d >= 2)
      for (const x of [-20, -12, -4, 4, 12, 20, 28, 36, 44])
        solid(face, rect(x - 0.35, z - 0.55, x + 0.35, z + 0.55), 9, 9.9, 'trim');
  }
  for (const side of [-1, 1]) {
    const r = side < 0 ? rect(46, -41.8, 53.4, -11.5) : rect(46, 12.0, 53.4, 41.7),
      hs = arches.filter((h) => h.name.startsWith('court-east') && Math.sign(h.center[1]) === side);
    roofBar(face, r, d);
    if (d === 0) {
      for (const z of side < 0 ? [-39.5, -30.5, -21.5, -12.5] : [12.5, 21.5, 30.5, 39.5])
        solid(face, rect(46.1, z - 0.5, 47.1, z + 0.5), 0.12, 8.5, 'wall');
    } else {
      shell(
        out,
        d,
        rect(46.05, side < 0 ? -41.8 : 12, 46.95, side < 0 ? -11.5 : 41.7),
        0.12,
        8.5,
        hs,
      );
      for (const h of hs) archBand(face, h, d, 0.35, 'trim', 0.52);
    }
  }
  const gate = baitulGate(),
    r = rect(46, -11.5, 53.4, 12.0);
  shell(out, d, r, 0.12, 19.5, [gate]);
  cap(face, r, 19.5, 'roof');
  if (d >= 1) {
    archBand(face, { ...gate, center: [53.4, 1.5] }, d, 0.65, 'trim', 0.05);
    archBand(face, { ...gate, center: [46, 1.5], normal: [-1, 0] }, d, 0.65, 'trim', 0.05);
    band(face, r, 18.6, 0.6, 'trim', 1.016);
  }
}
function tower(out, face, d) {
  const p = plans.towerCenter,
    n = 8;
  solid(face, rect(p[0] - 4.8, p[1] - 4.8, p[0] + 4.8, p[1] + 4.8), 0.12, 6.5, 'trim');
  const base = rect(p[0] - 3.8, p[1] - 3.8, p[0] + 3.8, p[1] + 3.8);
  const fields =
    d < 1
      ? []
      : edges(base).map((e, i) => ({
          ...hole(
            `tower-base-${i}`,
            e.a.map((v, k) => (v + e.b[k]) / 2),
            e.axis,
            e.normal,
            2.5,
            7.1,
            4.7,
            2.8,
            'pointed',
            1.6,
          ),
          kind: 'glass',
        }));
  if (d >= 2) shell(out, d, base, 6.5, 13, fields);
  else solid(face, base, 6.5, 13, 'wall');
  for (const h of fields) finish(face, h, d);
  const ring = circle(p, 2.4, n);
  profile(
    face,
    ring,
    [
      [13, 1.1],
      [15, 1],
      [45.5, 1],
      [49, 1.65],
    ],
    'wall',
  );
  const lantern = circle(p, 3.65, n);
  solid(face, lantern, 49, 53.2, 'trim');
  if (d >= 1)
    for (const e of edges(lantern)) {
      const q = e.a.map((v, k) => (v + e.b[k]) / 2 + 0.03 * e.normal[k]);
      const h = hole(
        `lantern-${e.a.join(',')}`,
        q,
        e.axis,
        e.normal,
        1.7,
        49.8,
        2.5,
        2.5,
        'rect',
        1.2,
      );
      pane(face, h, d, 0.03, 'glass');
      if (d >= 2) archBand(face, h, d, 0.15, 'trim', 0.07);
    }
  profile(
    face,
    circle(p, 3.85, n),
    [
      [53.2, 1],
      [53.5, 1.02],
    ],
    'trim',
  );
  const levels = [0, 0.25, 0.5, 0.75, 1]
    .filter((_, i) => d >= 2 || i % 2 === 0)
    .map((t) => [
      53.5 + 2.7 * Math.sin((t * Math.PI) / 2),
      t === 1 ? 0 : Math.cos((t * Math.PI) / 2),
    ]);
  profile(face, circle(p, 2.8, n), levels, 'trim');
  profile(
    face,
    circle(p, 0.15, d === 0 ? 4 : 8),
    [
      [56.2, 1],
      [57.4, 0],
    ],
    'gold',
  );
  if (d >= 2) {
    for (const e of edges(circle(p, 2.4, n)).filter((_, i) => i % 2 === 0)) {
      const q = e.a.map((v, k) => (v + e.b[k]) / 2 + 0.02 * e.normal[k]);
      pane(
        face,
        hole('shaft-slit', q, e.axis, e.normal, 0.45, 42, 2.1, 1.7, 'pointed', 1),
        d,
        0.03,
        'glass',
      );
    }
    for (const y of [6.25, 12.6])
      band(face, rect(p[0] - 3.9, p[1] - 3.9, p[0] + 3.9, p[1] + 3.9), y, 0.3, 'trim', 1);
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
    r = plans.whole.outline;
  sides(face, r, footing, 0.12, 'wall');
  cap(face, r, 0.12, 'trim');
  hall(out, face, d);
  galleries(out, face, d);
  tower(out, face, d);
}
export const buildBaitulSkyline = (o) => build(o, 0),
  buildBaitulDistrict = (o) => build(o, 1),
  buildBaitulStreet = (o) => build(o, 2),
  buildBaitulCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const baitulStudy = {
  id: 'baitul_mukarram_national_mosque',
  key: 'baitul_mukarram_national_mosque',
  title: 'Baitul Mukarram National Mosque',
  category: 'mosque',
  wikidataId: 'Q804009',
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
    'Six existing shared 256² stucco, continuous limestone, membrane, painted metal, wood and cast-bronze graphs serve seven merged roles, including opaque panes. Metric UVs, linear palette tints, zero embedded images. No unique facade atlas, copied calligraphy or baked night lighting.',
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
    'Individual approximate compound exterior. Internal court/hall/gate/tower plans and all heights are picture estimates. Closed door/pane fields stop before unmodeled interiors. Minor parapet patterns, lattice/art, precise stairs, elevated deck/shop construction, furnishings, current finish, engineering and physical-device timings remain unverified. Nearby streets, shops and city stay host content.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('cubic-hall-and-three-dark-bands', [48, 43, 65], [-35, 23, 1.5]),
    cam('triple-pointed-hall-entrance', [8, 9, 13], [-19, 9, 1.5]),
    cam('east-through-gate', [27, 8, -7], [49, 10, 1.5]),
    cam('pointed-court-galleries', [8, 5, -10], [12, 5.5, -31]),
    cam('octagonal-minaret-and-lantern', [86, 48, 72], [47.5, 44, 28]),
    cam('north-up-compound-plan', [0, 245, 0.1], [0, 8, 0]),
  ],
};

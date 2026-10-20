/** Kadyrov: four triple-balcony minarets, stepped domes and open court arcades. */
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
  '../../../content/worldgen/source/places/tp/tp8/n0454_akhmad_kadyrov_mosque/',
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
  wall: '#e1c9b1',
  trim: '#e8ded0',
  accent: '#b99890',
  roof: '#75818a',
  gold: '#ac9254',
  door: '#7a644e',
  glass: '#566c7d',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, kadyrovGround(...p) - 0.35);
export function kadyrovGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Kadyrov footing outside retained terrain');
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

const bayX = [3.5, 10.2, 18.95, 27.6, 34.4];
const slab = (face, r, b, t, slot = 'trim', holes = []) => {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot, holes);
  _underside(face, r, b, slot, holes);
};
function finial(face, p, y, h, d) {
  profile(
    face,
    circle(p, 0.18, d <= 1 ? 4 : 8),
    d <= 1
      ? [
          [y, 1],
          [y + h, 0],
        ]
      : [
          [y, 1],
          [y + h * 0.3, 1.65],
          [y + h * 0.58, 0.7],
          [y + h * 0.72, 1.1],
          [y + h, 0.015],
        ],
    'gold',
  );
}
function capDome(face, p, r, b, t, d, small = false) {
  const n = small ? [4, 6, 10, 14, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [b + (t - b) * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
}
function stoneArch(face, h, d, w = 0.3) {
  if (d < 2) {
    archBand(face, h, d, w, 'trim', 0.08);
    return;
  }
  const outer = openingShape(
      {
        ...h,
        width: h.width + 2 * w,
        height: h.height + 2 * w,
        bottom: h.bottom - w,
        spring: h.spring + w,
      },
      d,
    ),
    inner = openingShape(h, d),
    q = prepareOpening(h, 0, d),
    offset = 0.09 * Math.sign(-q.axis[1] * h.normal[0] + q.axis[0] * h.normal[1]);
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    face(
      i % 2 ? 'accent' : 'trim',
      [
        q.point(...outer[i], offset),
        q.point(...outer[j], offset),
        q.point(...inner[j], offset),
        q.point(...inner[i], offset),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
}
export function kadyrovWallFields(d = 3) {
  if (!d) return [];
  const hs = [];
  for (const side of [-1, 1])
    for (let i = 0; i < (d === 1 ? 3 : 5); i++)
      for (const y of [2, 8]) {
        const n = d === 1 ? 3 : 5,
          x = -42 + ((i + 0.5) * 32) / n;
        hs.push({
          ...hole(
            `hall-side-${side}-${i}-${y}`,
            [x, side * 22.3],
            [1, 0],
            [0, side],
            2.7,
            y,
            3.3,
            2.1,
            'pointed',
            1.8,
          ),
          kind: 'glass',
        });
      }
  for (const x of [-44.3, -7.15])
    for (const z of [-13, 0, 13])
      hs.push({
        ...hole(
          `hall-end-${x}-${z}`,
          [x, z],
          [0, 1],
          [x < -40 ? -1 : 1, 0],
          z === 0 ? 4.4 : 2.8,
          0.25,
          z === 0 ? 7.5 : 5.7,
          z === 0 ? 4.7 : 3.5,
          'pointed',
          1.8,
        ),
        kind: z === 0 ? 'door' : 'glass',
      });
  return hs;
}
export function kadyrovDrumFields(d = 3) {
  if (d < 1) return [];
  const n = d === 1 ? 8 : 12;
  return Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n,
      p = plans.drum.center,
      normal = [Math.cos(a), Math.sin(a)];
    return hole(
      `drum-${i}`,
      [p[0] + 9.0 * normal[0], p[1] + 9.0 * normal[1]],
      [-normal[1], normal[0]],
      normal,
      1.5,
      19.0,
      3.1,
      2.1,
      'round',
      1.2,
    );
  });
}
function finish(face, h, d) {
  pane(face, h, d, d === 1 ? 0.18 : -0.17, h.kind ?? 'glass');
  if (d >= 2) stoneArch(face, h, d, 0.24);
  if (d >= 2) {
    const q = prepareOpening(h, 0, d),
      a = 0.055 * Math.sign(-q.axis[1] * h.normal[0] + q.axis[0] * h.normal[1]);
    beam(face, q.point(0, h.bottom + 0.12, a), q.point(0, h.bottom + h.spring, a), 0.1, 'trim');
    beam(
      face,
      q.point(-h.width * 0.48, h.bottom + h.spring * 0.5, a),
      q.point(h.width * 0.48, h.bottom + h.spring * 0.5, a),
      0.1,
      'trim',
    );
  }
}
export function kadyrovArcades(_d = 3) {
  const hs = [];
  for (const side of [-1, 1])
    for (const [i, x] of bayX.entries())
      hs.push(
        hole(
          `court-side-${side}-${i}`,
          [x, side * 19.0],
          [1, 0],
          [0, side],
          4.7,
          0.12,
          6.8,
          4.3,
          'pointed',
          9,
        ),
      );
  for (const z of [-12.1, 12.1])
    hs.push(
      hole(`court-front-${z}`, [42.3, z], [0, 1], [1, 0], 4.6, 0.12, 6.8, 4.3, 'pointed', 12),
    );
  for (const z of [-12.5, -6.2, 0, 6.2, 12.5])
    hs.push(
      hole(`hall-entry-portico-${z}`, [-4.1, z], [0, 1], [1, 0], 4.9, 0.12, 8.5, 5.5, 'pointed', 9),
    );
  for (const side of [-1, 1])
    for (const x of [-33.5, -25.0, -16.5])
      hs.push(
        hole(
          `side-porch-${side}-${x}`,
          [x, side * 25.2],
          [1, 0],
          [0, side],
          5.7,
          1.5,
          7.7,
          4.9,
          'pointed',
          9.5,
        ),
      );
  return hs;
}
export const kadyrovGate = () =>
  hole('axial-court-gate', [42.2, 0.15], [0, 1], [1, 0], 5.4, 0.12, 7.7, 5.1, 'pointed', 20);
function hall(out, face, d) {
  const hs = kadyrovWallFields(d),
    r = plans.body;
  if (d >= 2) shell(out, d, r, 0.12, 13, hs);
  else sides(face, r, 0.12, 13, 'wall');
  cap(face, r, 13, 'roof');
  for (const h of hs) finish(face, h, d);
  if (d > 0) {
    band(face, r, 0.2, 0.25, 'trim', 1.005);
    band(face, r, 7.1, 0.28, 'trim', 1.005);
    band(face, r, 12.55, 0.45, 'trim', 1.01);
  }
  for (const [r, b, t] of [
    [plans.lowerPodium, 13, 15],
    [plans.upperPodium, 15, 18],
  ]) {
    const q = d <= 1 ? _coarse(r) : r;
    solid(face, q, b, t, 'wall');
    if (d > 0) band(face, q, t - 0.25, 0.25, 'trim', 1.01);
  }
  const drum = circle(plans.drum.center, 9.0, [8, 12, 20, 28, 32][d]),
    fields = kadyrovDrumFields(d);
  if (d >= 2) shell(out, d, drum, 18, 23, fields);
  else sides(face, drum, 18, 23, 'wall');
  cap(face, drum, 23, 'roof');
  for (const h of fields) finish(face, h, d);
  profile(
    face,
    circle(plans.neck.center, 8.36, [8, 12, 20, 28, 32][d]),
    [
      [23, 1.1],
      [23.5, 1],
      [25, 0.94],
    ],
    'trim',
  );
  capDome(face, plans.dome.center, plans.dome.radius, 25, 31, d);
  finial(face, plans.dome.center, 31, 1.5, d);
  for (const p of plans.semis) {
    if (d === 0) {
      capDome(face, p.center, p.radius, 19.5, 23, 0, true);
      continue;
    }
    solid(face, circle(p.center, p.radius * 1.05, [6, 8, 12, 16, 20][d]), 18, 19.5, 'wall');
    capDome(face, p.center, p.radius, 19.5, 23, d, true);
  }
  if (d > 0) {
    for (const p of d >= 2 ? plans.lowDomes : []) {
      solid(face, circle(p.center, p.radius * 1.02, [4, 6, 8, 12, 16][d]), 13, p.base, 'wall');
      capDome(face, p.center, p.radius, p.base, p.top, d, true);
      if (d >= 2) finial(face, p.center, p.top, 0.65, d);
    }
    for (const p of d >= 2 ? plans.cornerDomes : []) {
      solid(face, circle(p.center, p.radius, [4, 6, 8, 12, 16][d]), 13, p.base, 'wall');
      capDome(face, p.center, p.radius, p.base, p.top, d, true);
    }
    if (d >= 2)
      for (const x of [-40.5, -16.5])
        for (const z of [-12, 12]) {
          const p = [x, z];
          solid(face, circle(p, 0.65, 8), 15, 20.7, 'trim');
          profile(
            face,
            circle(p, 0.85, 8),
            [
              [20.7, 1],
              [23, 0],
            ],
            'roof',
          );
          finial(face, p, 23, 0.45, d);
        }
  }
}
function towers(face, d) {
  for (const t of plans.towers) {
    const p = t.center;
    solid(face, rect(p[0] - 2.2, p[1] - 2.2, p[0] + 2.2, p[1] + 2.2), 0.12, 13, 'wall');
    const n = [6, 8, 16, 24, 28][d],
      r = circle(p, 1.29, n),
      levels =
        d <= 1
          ? [
              [13, 1],
              [34, 1.5],
              [34.4, 0.85],
              [39, 1.5],
              [39.4, 0.8],
              [44, 1.5],
              [44.4, 0.72],
              [54, 0.58],
            ]
          : [
              [13, 1],
              [15, 0.92],
              [33.5, 0.85],
              [34, 1.5],
              [34.5, 1.5],
              [34.8, 0.84],
              [38.5, 0.8],
              [39, 1.5],
              [39.5, 1.5],
              [39.8, 0.78],
              [43.5, 0.74],
              [44, 1.5],
              [44.5, 1.5],
              [44.8, 0.7],
              [49.7, 0.65],
              [50, 0.85],
              [50.3, 0.65],
              [54, 0.58],
            ];
    profile(face, r, levels, 'trim');
    profile(
      face,
      circle(p, 1.29 * 0.58, n),
      [
        [54, 1],
        [60, 0],
      ],
      'roof',
    );
    if (d >= 2)
      for (const y of [34.5, 39.5, 44.5]) {
        const outer = circle(p, 1.98, n),
          inner = circle(p, 1.73, n);
        sides(face, outer, y, y + 0.65, 'trim');
        sides(face, inner, y, y + 0.65, 'trim', true);
        cap(face, outer, y + 0.65, 'trim', [inner]);
      }
  }
}
function arcadeRoof(face, d, r, y = 8) {
  slab(face, r.outline, y - 0.3, y, 'roof', r.holes);
  if (d >= 2)
    for (const e of edges(r.outline)) _openBand(face, e.a, e.b, y - 0.35, 0.35, 'trim', 0.2);
}
function court(out, face, d) {
  const hs = kadyrovArcades(d),
    courtFields = hs.filter((h) => h.name.startsWith('court-')),
    entryFields = hs.filter(
      (h) =>
        h.name.startsWith('hall-entry') &&
        (d !== 1 || Math.abs(h.center[1]) < 1 || Math.abs(h.center[1]) > 10),
    ),
    sideFields = hs.filter((h) => h.name.startsWith('side-porch'));
  if (d === 0) {
    for (const side of [-1, 1]) {
      slab(face, rect(-1.5, side > 0 ? 16 : -22.4, 45.4, side > 0 ? 22.4 : -16), 7.7, 8, 'roof');
      for (const x of [1, 16.5, 31, 44])
        solid(face, rect(x - 0.3, side * 19 - 0.3, x + 0.3, side * 19 + 0.3), 0.12, 7.7, 'trim');
    }
    slab(face, rect(39, -16, 45.4, 16), 7.7, 8, 'roof');
  } else {
    for (const raw of plans.gallery) {
      const r = d === 1 ? { outline: _coarse(raw.outline), holes: raw.holes.map(_coarse) } : raw;
      shell(
        out,
        d,
        r.outline,
        0.12,
        8,
        [...courtFields, ...entryFields, kadyrovGate()],
        'wall',
        r.holes[0],
      );
      arcadeRoof(face, d, r);
    }
    for (const h of courtFields) {
      if (d >= 2)
        stoneArch(face, { ...h, center: h.center.map((v, k) => v + h.normal[k] * 3.4) }, d, 0.32);
      stoneArch(
        face,
        {
          ...h,
          center: h.center.map((v, k) => v - h.normal[k] * 3.1),
          normal: h.normal.map((v) => -v),
        },
        d,
        0.32,
      );
    }
  }
  const entry = rect(-7.13, -16.1, -1.0, 16.2);
  if (d === 0) {
    slab(face, entry, 9.7, 10, 'roof');
    for (const z of [-12, 12]) solid(face, rect(-3.6, z - 0.35, -2.9, z + 0.35), 0.12, 9.7, 'trim');
  } else {
    shell(out, d, entry, 0.12, 10, entryFields);
    slab(face, entry, 9.7, 10, 'roof');
    for (const h of entryFields) stoneArch(face, { ...h, center: [-0.95, h.center[1]] }, d, 0.32);
    for (const z of d >= 2 ? [-12.5, -6.2, 0, 6.2, 12.5] : [])
      capDome(face, [-4.1, z], 2.8, 10, 12.5, d, true);
  }
  for (const [i, r] of plans.sidePorches.entries()) {
    if (d === 0) {
      slab(face, r, 9.4, 9.7, 'roof');
      continue;
    }
    slab(face, r, 1.2, 1.5, 'trim');
    shell(out, d, r, 1.5, 9.7, sideFields);
    profile(
      face,
      r,
      [
        [9.7, 1],
        [11, 0.83],
      ],
      'roof',
    );
    for (const h of sideFields.filter((h) => h.normal[1] === (i === 0 ? 1 : -1)))
      stoneArch(face, { ...h, center: [h.center[0], i === 0 ? 28.4 : -28.2] }, d, 0.3);
  }
  const gate = kadyrovGate(),
    gateRing = plans.gate;
  shell(out, d, gateRing, 0.12, 9.5, [gate]);
  cap(face, gateRing, 9.5, 'roof');
  if (d > 0) {
    for (const side of [-1, 1])
      stoneArch(
        face,
        { ...gate, center: [side > 0 ? 50.2 : 34.0, 0.15], normal: [side, 0] },
        d,
        0.45,
      );
    for (const p of plans.courtDomes) {
      if (p.center[0] < 30) solid(face, circle(p.center, p.radius * 1.02, 8), 8, p.base, 'wall');
      capDome(face, p.center, p.radius, p.base, p.top, d, true);
      finial(face, p.center, p.top, 0.7, d);
    }
    for (const side of [-1, 1])
      for (const x of bayX.filter((x) => Math.abs(x - 19) > 2)) {
        capDome(face, [x, side * 19.0], 2.9, 8, 10.3, d, true);
        if (d >= 2) finial(face, [x, side * 19], 10.3, 0.6, d);
      }
    for (const x of d >= 2 ? [36.1, 48.1] : [])
      for (const z of [-6.1, 6.4]) {
        const p = [x, z];
        solid(face, circle(p, 0.6, d === 1 ? 4 : 8), 9.5, 12.7, 'trim');
        profile(
          face,
          circle(p, 0.8, d === 1 ? 4 : 8),
          [
            [12.7, 1],
            [14.8, 0],
          ],
          'roof',
        );
        if (d >= 2) finial(face, p, 14.8, 0.5, d);
      }
  } else capDome(face, [42.18, 0.15], 4.85, 8.5, 13, 0, true);
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
  towers(face, d);
  court(out, face, d);
}
export const buildKadyrovSkyline = (o) => build(o, 0),
  buildKadyrovDistrict = (o) => build(o, 1),
  buildKadyrovStreet = (o) => build(o, 2),
  buildKadyrovCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const kadyrovStudy = {
  id: 'N0454',
  key: 'akhmad_kadyrov_mosque',
  title: 'Akhmad Kadyrov Mosque',
  category: 'mosque',
  wikidataId: 'Q340549',
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
    'Six existing shared 256² sandstone, marble, continuous sandstone, standing-seam metal, cast bronze and wood graphs serve seven merged roles. Metric UVs, linear tints, no embedded images or unique facade atlases. Alternating original arch facets abstract pink/cream masonry; no copied calligraphy or tile art.',
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
    'Principal mapped compound with consolidated repeated details. Open paved court and gate passage are modeled; gallery/door recesses stop before unseen interiors. Small dome count/spacing, arches, windows, pinnacles, railing patterns and current finish remain approximate. No copied artwork, furnished interior, precise engineering or physical-device performance claim.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('stepped-central-domes', [-69, 46, 55], [-28.4, 22, 0]),
    cam('four-triple-balcony-minarets', [-82, 47, 76], [-25, 38, 0]),
    cam('courtyard-arcades-and-roof-caps', [16, 5.5, 0], [20, 6, 19]),
    cam('through-gate-and-turrets', [63, 9, 20], [42, 7, 0]),
    cam('side-porch-and-pink-arches', [-25, 7, 48], [-25, 6, 25]),
    cam('north-up-compound-and-court', [0, 240, 0.1], [-1, 9, 0]),
  ],
};

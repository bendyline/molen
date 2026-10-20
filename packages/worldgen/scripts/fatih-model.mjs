/** Fatih: twin double-balcony minarets, stepped domes, arcaded court and fountain canopy. */
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
  '../../../content/worldgen/source/places/sx/sxk/n0455_fatih_istanbul_mosque/',
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
  wall: '#d5cebd',
  trim: '#e7dfcf',
  accent: '#a67261',
  roof: '#777e82',
  gold: '#b19758',
  door: '#806950',
  glass: '#536a7b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, fatihGround(...p) - 0.35);
export function fatihGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Fatih footing outside retained terrain');
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

const dome = (face, p, r, b, t, d, small = false) => _capDome(face, p, r, b, t - b, d, small);
function finial(face, p, y, d) {
  if (d === 0) return;
  _finial(face, p, y, d);
}
function stoneArch(face, h, d, w = 0.24) {
  if (d < 2) {
    archBand(face, h, d, w, 'trim', h.name.startsWith('court-') ? 0.45 : 0.4);
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
    offset =
      (h.name.startsWith('court-') ? 0.45 : h.name === 'axial-court-gate' ? 0.4 : 0.08) *
      Math.sign(-q.axis[1] * h.normal[0] + q.axis[0] * h.normal[1]);
  for (let i = 0; i < inner.length; i++) {
    if (h.name.startsWith('court-') && (i === 0 || i === 1 || i === inner.length - 1)) continue;
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
export function fatihWallFields(d = 3) {
  if (!d) return [];
  const hs = [],
    n = d === 1 ? 3 : 5;
  for (const side of [-1, 1])
    for (let i = 0; i < n; i++)
      for (const y of d === 1 ? [4.5] : [2.8, 10.2])
        hs.push({
          ...hole(
            `hall-side-${side}-${i}-${y}`,
            [2 + ((i + 0.5) * 43) / n, side * 26.4],
            [1, 0],
            [0, side],
            2.6,
            y,
            3.6,
            2.3,
            'pointed',
            1.8,
          ),
          kind: 'glass',
        });
  for (const x of [-7.1, 48.2])
    for (const z of [-17, -8.5, 0, 8.5, 17])
      hs.push({
        ...hole(
          `hall-end-${x}-${z}`,
          [x, z],
          [0, 1],
          [x < 0 ? -1 : 1, 0],
          z === 0 ? 4.6 : 2.6,
          0.3,
          z === 0 ? 8 : 5.4,
          z === 0 ? 5.2 : 3.4,
          'pointed',
          1.8,
        ),
        kind: z === 0 ? 'door' : 'glass',
      });
  return hs;
}
function finish(face, h, d) {
  pane(face, h, d, d === 1 ? 0.2 : -0.18, h.kind ?? 'glass');
  if (d >= 2) {
    stoneArch(face, h, d);
    const q = prepareOpening(h, 0, d),
      off = 0.06 * Math.sign(-q.axis[1] * h.normal[0] + q.axis[0] * h.normal[1]);
    beam(face, q.point(0, h.bottom + 0.1, off), q.point(0, h.bottom + h.spring, off), 0.09);
  }
}
export function fatihDrumFields(d = 3) {
  if (d < 1) return [];
  const n = d === 1 ? 8 : 12,
    p = plans.mainCenter;
  return Array.from({ length: n }, (_, i) => {
    const a = (i * Math.PI * 2) / n,
      N = [Math.cos(a), Math.sin(a)];
    return hole(
      `central-drum-${i}`,
      [p[0] + 12.5 * N[0], p[1] + 12.5 * N[1]],
      [-N[1], N[0]],
      N,
      1.6,
      27,
      3.2,
      2.1,
      'round',
      1.4,
    );
  });
}
function hall(out, face, d) {
  const hs = fatihWallFields(d);
  if (d >= 2) shell(out, d, plans.hall, 0.12, 16, hs);
  else solid(face, plans.hall, 0.12, 16, 'wall');
  for (const h of hs) finish(face, h, d);
  if (d >= 1) {
    band(face, plans.hall, 15.8, 0.35);
    if (d >= 2) band(face, plans.hall, 1.2, 0.25);
  }
  const p = plans.mainCenter,
    n = [8, 12, 20, 28, 32][d];
  solid(face, circle(p, 14.4, d === 0 ? 4 : 8), 16, 26, 'wall');
  const drum = circle(p, 12.5, n),
    windows = fatihDrumFields(d);
  if (d >= 2) shell(out, d, drum, 26, 31, windows, 'wall');
  else solid(face, drum, 26, 31, 'wall');
  for (const h of windows) finish(face, h, d);
  dome(face, p, 12.65, 31, 41, d);
  finial(face, p, 41, d);
  const rear = plans.rearCap;
  const semis = [rear.center, [p[0] - 15, p[1]], [p[0], p[1] - 14.5], [p[0], p[1] + 14.5]];
  for (const q of semis) {
    solid(face, circle(q, rear.radius, [4, 8, 12, 16, 20][d]), 16, 22, 'wall');
    dome(face, q, rear.radius, 22, 30.8, d, true);
    if (d >= 2) finial(face, q, 30.8, d);
  }
  if (d >= 1)
    for (const x of [p[0] - 14, p[0] + 14])
      for (const z of [p[1] - 16, p[1] + 16]) {
        const q = [x, z];
        solid(face, circle(q, 5.5, [4, 6, 10, 14, 16][d]), 16, 17.6, 'wall');
        dome(face, q, 5.55, 17.6, 22, d, true);
        if (d >= 2) finial(face, q, 22, d);
      }
  if (d >= 2)
    for (const x of [p[0] - 12, p[0] + 12])
      for (const z of [p[1] - 12, p[1] + 12]) {
        const q = [x, z];
        solid(face, circle(q, 0.7, d === 2 ? 6 : 8), 22, 28, 'trim');
        profile(
          face,
          circle(q, 0.85, d === 2 ? 6 : 8),
          [
            [28, 1],
            [31, 0],
          ],
          'roof',
        );
      }
}
function towers(face, d) {
  for (const p of plans.towerCenters) {
    solid(face, rect(p[0] - 2.2, p[1] - 2.2, p[0] + 2.2, p[1] + 2.2), 0.12, 13, 'wall');
    const n = [6, 8, 12, 20, 24][d],
      r = circle(p, 1.65, n);
    const levels =
      d <= 1
        ? [
            [13, 1],
            [39.6, 0.83],
            [40, 1.6],
            [40.6, 0.8],
            [48.6, 0.73],
            [49, 1.5],
            [49.6, 0.7],
            [57, 0.61],
          ]
        : [
            [13, 1],
            [15, 0.96],
            [39, 0.84],
            [40, 1.6],
            [40.5, 1.6],
            [40.8, 0.81],
            [48, 0.75],
            [49, 1.5],
            [49.5, 1.5],
            [49.8, 0.72],
            [56.5, 0.65],
            [57, 0.76],
            [57.2, 0.61],
          ];
    profile(face, r, levels, 'wall');
    profile(
      face,
      circle(p, 1.65 * 0.61, n),
      [
        [57.2, 1],
        [64, 0],
      ],
      'roof',
    );
    if (d >= 2)
      for (const y of [40.5, 49.5]) {
        const outer = circle(p, 2.7, n),
          inner = circle(p, 2.4, n);
        sides(face, outer, y, y + 0.8, 'trim');
        sides(face, inner, y, y + 0.8, 'trim', true);
        cap(face, outer, y + 0.8, 'trim', [inner]);
      }
  }
}
const sideXs = [-35.5, -28.6, -21.7, -14.8],
  endZs = [-12.2, -4.9, 2.4, 9.7, 17];
export function fatihArcades() {
  const hs = [];
  for (const z of [-16.5, 20.9])
    for (const x of sideXs)
      hs.push(
        hole(
          `court-side-${x}-${z}`,
          [x, z],
          [1, 0],
          [0, z < 0 ? 1 : -1],
          5.8,
          0.15,
          7.9,
          5.3,
          'pointed',
          1.8,
        ),
      );
  for (const x of [-39, -11.5])
    for (const z of endZs)
      hs.push(
        hole(
          `court-end-${x}-${z}`,
          [x, z],
          [0, 1],
          [x < -20 ? 1 : -1, 0],
          5.9,
          0.15,
          x > -20 ? 9.2 : 7.9,
          x > -20 ? 6.2 : 5.3,
          'pointed',
          1.8,
        ),
      );
  return hs;
}
export const fatihGate = () =>
  hole('axial-court-gate', [-48.2, 2.3], [0, 1], [-1, 0], 5.0, 0.15, 7.7, 5.1, 'pointed', 2.4);
function arcades(out, face, d) {
  const court = plans.court,
    outer = rect(-48.3, -28, -7.1, 28),
    front = rect(-12.0, -21.8, -7.1, 26.5);
  cap(face, outer, 9, 'roof', [court]);
  sides(face, outer, 8.5, 9, 'trim');
  sides(face, court, 8.5, 9, 'trim', true);
  const gate = fatihGate(),
    walls = [
      { r: rect(-48.45, -28, -47.5, 28), holes: [gate] },
      { r: rect(-48, -28, -7.1, -27.1), holes: [] },
      { r: rect(-48, 27.1, -7.1, 28.0), holes: [] },
    ];
  for (const w of walls) shell(out, d, w.r, 0.12, 8.5, w.holes);
  if (d >= 1) stoneArch(face, gate, d, 0.4);
  const arches = fatihArcades();
  for (const z of [-16.5, 20.9]) {
    const ring = rect(-39.3, z - 0.35, -11.3, z + 0.35),
      hs = arches.filter((h) => h.center[1] === z);
    if (d === 0) {
      for (const x of [-38.9, -32.05, -25.15, -18.25, -11.45])
        solid(face, rect(x - 0.32, z - 0.32, x + 0.32, z + 0.32), 0.12, 8.5, 'trim');
    } else {
      shell(out, d, ring, 5.1, 8.5, hs);
      for (const x of [-39, -32.05, -25.15, -18.25, -11.5])
        _column(face, [x, z], 0.12, 5.3, 0.43, d);
      for (const h of hs) stoneArch(face, h, d, 0.28);
    }
  }
  for (const x of [-39, -11.5]) {
    const ring = rect(x - 0.35, -16.8, x + 0.35, 21.2),
      hs = arches.filter((h) => h.center[0] === x),
      height = x > -20 ? 10.5 : 8.5;
    if (d === 0) {
      for (const z of [-15.8, -8.55, -1.25, 6.05, 13.35, 20.65])
        solid(face, rect(x - 0.35, z - 0.35, x + 0.35, z + 0.35), 0.12, height, 'trim');
    } else {
      shell(out, d, ring, x > -20 ? 6.0 : 5.1, height, hs);
      for (const z of [-8.55, -1.25, 6.05, 13.35])
        _column(face, [x, z], 0.12, x > -20 ? 6.2 : 5.3, 0.43, d);
      for (const h of hs) stoneArch(face, h, d, 0.3);
    }
  }
  cap(face, front, 10.5, 'roof');
  sides(face, front, 9, 10.5, 'wall');
  if (d >= 1) {
    const roofPoints = [];
    for (const x of [-43, -35.2, -27.4, -19.6])
      for (const z of [-23.2, 24.6]) roofPoints.push([x, z]);
    for (const z of [-12.2, -4.9, 2.4, 9.7, 17]) roofPoints.push([-43.8, z]);
    for (const z of [-17, -8.5, 0, 8.5, 17]) roofPoints.push([-8.8, z]);
    for (const p of roofPoints) {
      const h = p[0] > -12 ? 10.5 : 9;
      dome(face, p, p[0] > -12 ? 3.55 : 3.1, h, h + 2.6, d, true);
      if (d >= 3) finial(face, p, h + 2.6, d);
    }
    // Taller middle bay over the court-facing hall entrance.
    solid(face, rect(-11.8, -3.7, -7.2, 3.7), 10.5, 13.3, 'wall');
    dome(face, [-9.5, 0], 3.4, 13.3, 17, d, true);
  }
}
function fountain(face, d) {
  const p = plans.courtCenter,
    n = d === 0 ? 4 : 8;
  solid(face, circle(p, 2.35, n), 0.15, 1.6, 'trim');
  const roof = circle(p, 5.75, n);
  for (const q of circle(p, 4.2, n)) _column(face, q, 0.15, 3.6, d === 0 ? 0.22 : 0.18, d, 'trim');
  profile(
    face,
    roof,
    [
      [3.6, 1],
      [3.95, 1.03],
      [4.7, 0.69],
      [5.2, 0.68],
      [8, 0.03],
    ],
    'roof',
  );
  _underside(face, roof, 3.6, 'trim');
  if (d >= 1) {
    band(face, circle(p, 5.75, 8), 3.45, 0.2, 'trim');
    finial(face, p, 8, d);
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
  towers(face, d);
  arcades(out, face, d);
  fountain(face, d);
}
export const buildFatihSkyline = (o) => build(o, 0),
  buildFatihDistrict = (o) => build(o, 1),
  buildFatihStreet = (o) => build(o, 2),
  buildFatihCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const fatihStudy = {
  id: 'N0455',
  key: 'fatih_istanbul_mosque',
  title: 'Fatih Istanbul Mosque',
  category: 'mosque',
  wikidataId: 'Q756189',
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
    'Six existing shared 256² limestone, marble, continuous sandstone, standing-seam metal, cast bronze and wood graphs serve seven merged roles. Metric UVs, linear tints and zero embedded images. Alternating original arch wedges abstract muted red/cream masonry; no copied carving or calligraphy.',
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
    'Compound exterior with open arcades and fountain canopy; hall recesses stop at closed doors/panes. All heights and internal roof partitions are picture estimates. Fine carving, artwork, exact fountain fixtures, engineering, furnished interiors, current restoration state and physical-device timings remain unverified. Adjacent medreses, tombs and gardens remain host content.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('central-dome-and-four-semidomes', [79, 54, 72], [20, 26, 0]),
    cam('twin-double-balcony-minarets', [-56, 51, 70], [-7.5, 43, 0]),
    cam('courtyard-pointed-arcades', [-25, 4.8, 2.3], [-11.5, 6.6, 8.5]),
    cam('fountain-polygonal-canopy', [-37, 5, 12], [-25, 4.2, 2.25]),
    cam('main-gate-and-cap-rows', [-66, 14, 16], [-43, 7, 2.3]),
    cam('north-up-compound-plan', [0, 235, 0.1], [0, 8, 0]),
  ],
};

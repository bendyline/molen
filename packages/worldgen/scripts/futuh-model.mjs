/** Baitul Futuh Mosque: contemporary arched frontage,silver dome and closed glazed roof turrets. */
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
  '../../../content/worldgen/source/places/gc/gcp/baitul_futuh_mosque/',
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
  wall: '#e7e5db',
  trim: '#f0ece1',
  panel: '#a7aaa5',
  paving: '#a5aaa1',
  roof: '#b3b9b6',
  gold: '#b99e61',
  glass: '#365d50',
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
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
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
const footing = (p) => Math.min(-0.35, floor - 0.3, futuhGround(...p) - 0.35);
export function futuhGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Futuh footing outside retained terrain');
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
const plans = rec.plans,
  rect = (x0, z0, x1, z1) => [
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
const hole = (
  name,
  center,
  axis,
  normal,
  width,
  bottom,
  height,
  spring,
  shape = 'rect',
  depth = 1,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
function box(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
const subdivide = (r, max) =>
  r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => a.map((v, k) => v + ((b[k] - v) * j) / n));
  });
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    return { a, b, length, axis, normal: [axis[1] * sign(r), -axis[0] * sign(r)] };
  });
const portal = () =>
  hole('front-portal', [-78, plans.frameZ], [0, 1], [-1, 0], 20.2, 0.35, 23.5, 23.5, 'rect', 12);
export function futuhFields(d = 3) {
  const hs = [];
  if (d === 0) return hs;
  for (const [i, e] of edges(plans.whole.outline).entries()) {
    const x = (e.a[0] + e.b[0]) / 2,
      near = x < -74 && e.normal[0] < -0.9,
      hall = x > 35;
    if (e.length < 4 || (!near && !hall && x > -44)) continue;
    const n = Math.max(1, Math.floor(e.length / (d === 1 ? 11 : 7)));
    for (let j = 0; j < n; j++) {
      const q = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n);
      if (near && q[1] > -15.4 && q[1] < 7.9) continue;
      if (near) {
        hs.push(
          hole(
            `front-upper-${i}-${j}`,
            q,
            e.axis,
            e.normal,
            Math.min(3.1, (e.length / n) * 0.55),
            5,
            15,
            7.6,
            'round',
            1.2,
          ),
        );
        hs.push(hole(`front-bay-${i}-${j}`, q, e.axis, e.normal, 2.5, 0.35, 3.7, 2, 'round', 3.5));
      } else if (hall) {
        hs.push(
          hole(
            `hall-upper-${i}-${j}`,
            q,
            e.axis,
            e.normal,
            Math.min(1.9, (e.length / n) * 0.48),
            4.6,
            7.3,
            7.3,
            'rect',
            1,
          ),
        );
        if (e.length > 6)
          hs.push(
            hole(`hall-bay-${i}-${j}`, q, e.axis, e.normal, 2.3, 0.35, 3.5, 1.9, 'round', 3.5),
          );
      } else if (d >= 2) {
        hs.push(hole(`front-side-${i}-${j}`, q, e.axis, e.normal, 2.5, 6, 13.2, 13.2, 'rect', 1));
      }
    }
  }
  return hs;
}
function grid(face, h, d, slot = 'trim', offset = -0.16) {
  if (d < 2) return;
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    P = (u, y) => p.point(u, y, offset * sg),
    normal = [h.normal[0], 0, h.normal[1]],
    w = h.width / 2 - 0.08;
  for (const u of [-0.03, 0.03])
    face(
      slot,
      [
        P(u - 0.055, h.bottom + 0.05),
        P(u + 0.055, h.bottom + 0.05),
        P(u + 0.055, h.bottom + h.spring - 0.05),
        P(u - 0.055, h.bottom + h.spring - 0.05),
      ],
      normal,
    );
  for (let j = 1; j < 4; j++) {
    const y = h.bottom + (h.spring * j) / 4;
    face(slot, [P(-w, y - 0.065), P(w, y - 0.065), P(w, y + 0.065), P(-w, y + 0.065)], normal);
  }
}
function rod(face, a, b, width, slot, normal) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    dz = b[2] - a[2],
    n = Math.hypot(dx, dy, dz),
    off = [-normal[2] * dy, normal[2] * dx - normal[0] * dz, normal[0] * dy],
    l = Math.hypot(...off);
  if (n < 1e-6 || l < 1e-6) return;
  const v = off.map((x) => (x * width) / (2 * l));
  face(
    slot,
    [
      a.map((x, k) => x - v[k]),
      b.map((x, k) => x - v[k]),
      b.map((x, k) => x + v[k]),
      a.map((x, k) => x + v[k]),
    ],
    normal,
  );
}
function grandFront(out, d) {
  const face = writer(out, d),
    h = portal(),
    rectHole = prepareOpening(h, 0, d),
    frameFace = writer(masked(out, [rectHole]), d);
  sides(frameFace, plans.frame, 0.35, plans.frameTop, 'trim');
  cap(frameFace, plans.frame, plans.frameTop, 'trim');
  openingReveals(
    {
      addTriangle(_s, r, p, n, uv, col) {
        out.addTriangle('trim', r, p, n, uv, col);
      },
    },
    plans.frame,
    () => floor + 0.35,
    () => floor + 26,
    [rectHole],
    d === 0 ? colors.trim.map((v, k) => v * means.trim[k]) : colors.trim,
  );
  const arch = hole(
      'gold-broad-round-arch',
      [plans.frameX - 0.06, plans.frameZ],
      [0, 1],
      [-1, 0],
      19.4,
      0.35,
      21.65,
      12.1,
      'round',
      2,
    ),
    goldFace = writer(masked(out, [prepareOpening(arch, 0, d)]), d),
    x = plans.frameX - 0.09,
    z = plans.frameZ;
  goldFace(
    'gold',
    [
      [x, floor + 0.36, z - 10.08],
      [x, floor + 0.36, z + 10.08],
      [x, floor + 23.84, z + 10.08],
      [x, floor + 23.84, z - 10.08],
    ],
    [-1, 0, 0],
  );
  pane(face, { ...h, center: [-74, plans.frameZ], depth: 1 }, d, 0, 'glass');
  const count = d === 0 ? 4 : 6;
  for (let j = 0; j < count; j++) {
    const zz = z - 9.25 + (j * 18.5) / (count - 1);
    box(face, rect(x - 0.04, zz - 0.2, x + 0.55, zz + 0.2), 0.35, 24.15, 'trim');
  }
  if (d >= 2) {
    // Original large diamonds imply a gold screen without copying inscriptions or historic artwork.
    const maskedFace = writer(masked(out, [prepareOpening(arch, 0, d)]), d),
      pitch = d === 2 ? 2.7 : d === 3 ? 1.9 : 1.5;
    for (let yy = 0.7; yy < 23; yy += pitch)
      for (let zz = -9.5; zz < 9.5; zz += pitch) {
        const y = Math.min(yy + pitch, 23.7),
          z1 = Math.min(zz + pitch, 9.95),
          P = (a, b) => [x - 0.025, floor + a, z + b];
        rod(maskedFace, P(yy, zz), P(y, z1), 0.14, 'trim', [-1, 0, 0]);
        rod(maskedFace, P(yy, z1), P(y, zz), 0.14, 'trim', [-1, 0, 0]);
      }
  }
}
function domePoint(p, t, a, extra = 0) {
  const r = p.radius * Math.cos(t) + extra;
  return [
    p.center[0] + r * Math.cos(a),
    floor + p.base + (p.shellTop - p.base) * Math.sin(t) + extra,
    p.center[1] + r * Math.sin(a),
  ];
}
function spindle(face, p, b, t, d) {
  const n = d === 0 ? 4 : 6;
  profile(
    face,
    circle(p, 0.14, n),
    [
      [b, 1],
      [t - 0.65, 1.2],
      [t - 0.45, 0.5],
      [t, 0],
    ],
    'roof',
  );
}
function silverDome(face, p, d, small = false) {
  const n = small ? (d === 0 ? 4 : 8) : [8, 12, 24, 32, 40][d],
    steps = small ? (d <= 1 ? 2 : 3) : [2, 3, 5, 7, 9][d];
  for (let j = 0; j < steps; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n,
        t = ((j / steps) * Math.PI) / 2,
        u = (((j + 1) / steps) * Math.PI) / 2;
      face(
        'roof',
        [domePoint(p, t, a), domePoint(p, t, b), domePoint(p, u, b), domePoint(p, u, a)],
        [Math.cos((a + b) / 2), 1, Math.sin((a + b) / 2)],
      );
    }
  if (!small && d >= 2) {
    const n = d === 2 ? 16 : d === 3 ? 24 : 32,
      steps = d === 2 ? 4 : 6;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < steps; j++) {
        const a = (i * Math.PI * 2) / n,
          t = (j / steps) * 1.48,
          u = ((j + 1) / steps) * 1.48;
        face(
          'trim',
          [
            domePoint(p, t, a - 0.006, 0.035),
            domePoint(p, t, a + 0.006, 0.035),
            domePoint(p, u, a + 0.006, 0.035),
            domePoint(p, u, a - 0.006, 0.035),
          ],
          [Math.cos(a), 1, Math.sin(a)],
        );
      }
  }
  spindle(face, p.center, p.shellTop, p.totalHeight, d);
}
function glazedTurret(face, p, d) {
  const n = d === 0 ? 4 : 8,
    r = circle(p.center, p.radius, n),
    base = p.base ?? 0.35;
  profile(
    face,
    r,
    [
      [base, 1],
      [p.wallTop, 1],
    ],
    'wall',
  );
  profile(
    face,
    r,
    [
      [p.wallTop, 1.08],
      [p.lanternBase ?? p.wallTop + 0.3, 1.08],
    ],
    'panel',
  );
  const lo = p.lanternBase ?? p.wallTop + 0.3,
    hi = p.lanternTop ?? p.wallTop + 1.1,
    glass = circle(p.center, p.radius * 0.88, n);
  sides(face, glass, lo, hi, 'glass');
  for (const e of edges(r)) {
    const q = e.a,
      rr = rect(q[0] - 0.1, q[1] - 0.1, q[0] + 0.1, q[1] + 0.1);
    box(face, rr, lo, hi, 'trim');
    if (d >= 2) {
      const y = lo + (hi - lo) * 0.57;
      face(
        'trim',
        [at(e.a, y - 0.06), at(e.b, y - 0.06), at(e.b, y + 0.06), at(e.a, y + 0.06)],
        [e.normal[0], 0, e.normal[1]],
      );
    }
  }
  profile(
    face,
    r,
    [
      [hi, 1.05],
      [hi + 0.16, 1.05],
    ],
    'trim',
  );
  silverDome(face, { ...p, radius: p.radius * 1.12, base: hi + 0.16 }, d, true);
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
    r = plans.whole.outline,
    hs = futuhFields(d),
    portalHole = portal(),
    all = [portalHole, ...(d >= 2 ? hs : [])],
    mask = writer(
      masked(
        out,
        all.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  const bottom =
    d === 0 ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...r.map(footing)) : footing;
  sides(face, d === 0 ? r : subdivide(r, 3), bottom, 0.35, 'paving');
  cap(face, r, 0.35, 'paving');
  shell(out, d, r, 0.35, plans.lowTop, all, 'wall');
  cap(mask, r, plans.lowTop, 'wall');
  for (const p of plans.front) {
    shell(out, d, p.outline, plans.lowTop, plans.frontTop, all, 'wall');
    cap(mask, p.outline, plans.frontTop, 'wall');
  }
  for (const p of plans.hall) {
    shell(out, d, p.outline, plans.lowTop, plans.hallTop, all, 'wall');
    cap(mask, p.outline, plans.hallTop, 'wall');
  }
  for (const h of hs) {
    const bay = h.name.includes('bay'),
      offset = d === 1 ? 0.055 : bay ? -1.55 : -0.22;
    pane(face, h, d, offset);
    archBand(face, h, d, bay ? 0.2 : 0.16, 'trim', 0.045);
    grid(face, h, d, h.name.startsWith('front-upper') ? 'gold' : 'trim', offset + 0.035);
    if (d >= 2 && h.name.startsWith('hall-upper')) {
      const p = prepareOpening(h, 0, d),
        normal = [h.normal[0], 0, h.normal[1]],
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
        u = h.width / 2 + 0.5,
        w = 0.35;
      for (const a of [-u, u])
        face(
          'panel',
          [
            p.point(a - w, h.bottom, 0.025 * sg),
            p.point(a + w, h.bottom, 0.025 * sg),
            p.point(a + w, h.bottom + h.height, 0.025 * sg),
            p.point(a - w, h.bottom + h.height, 0.025 * sg),
          ],
          normal,
        );
    }
  }
  grandFront(out, d);
  silverDome(face, plans.dome, d);
  for (const p of plans.towers) glazedTurret(face, p, d);
  glazedTurret(
    face,
    {
      ...plans.frontCupola,
      lanternBase: plans.frontCupola.base,
      lanternTop: plans.frontCupola.wallTop,
      wallTop: plans.frontCupola.base,
    },
    d,
  );
}
export const buildFutuhSkyline = (o) => build(o, 0),
  buildFutuhDistrict = (o) => build(o, 1),
  buildFutuhStreet = (o) => build(o, 2),
  buildFutuhCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const futuhStudy = {
  id: 'baitul_futuh_mosque',
  key: 'baitul_futuh_mosque',
  title: 'Baitul Futuh Mosque',
  category: 'mosque',
  wikidataId: 'Q788652',
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
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Five existing shared256² raw/coursed/weathered limestone,standing-seam metal and bronze graphs;seven merged roles include local opaque glazing. Metric UVs and linear tints,no embedded images or unique atlas. Coarse gold diamonds and wall fields are original abstractions;no historic artwork or inscriptions are copied.',
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
    'The2023 street frontage and older hall/dome pictures differ in date. Exact current condition,roof subdivisions,window rhythm,internal layout,thresholds,stairs,structural engineering and physical-device/full-city performance remain unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('new-arched-frontage', [-124, 25, 8], [-76, 12, -3.75]),
    cam('gold-screen-and-pale-ribs', [-108, 16, -16], [-79.8, 15, -3.75]),
    cam('southern-prayer-hall', [104, 24, 53], [58, 8, -11]),
    cam('silver-ribbed-dome', [83, 33, 20], [59, 19, -13]),
    cam('closed-glazed-roof-turrets', [64, 28, 35], [50, 18, 4]),
    cam('retained-long-compound-plan', [0, 235, 0.1], [0, 0, 0]),
  ],
};

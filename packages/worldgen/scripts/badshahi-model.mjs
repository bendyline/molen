/** Lahore Badshahi Mosque: three marble bulbs, four corner towers and red court. */
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
  '../../../content/worldgen/source/places/tt/tts/badshahi_mosque/',
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
  wall: '#b46651',
  trim: '#dcccb6',
  roof: '#e0d7c4',
  door: '#705d4c',
  gold: '#bda46a',
  glass: '#52636b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, badshahiGround(...p) - 0.35);
export function badshahiGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Badshahi Mosque footing outside retained terrain');
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
const band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
function _beam(face, a, b, w, slot = 'trim') {
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
const coarse = (r) => {
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
      return [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
    }),
  edges = (r) =>
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
export function badshahiHallFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) {
      if (d === 1 && i % 2) continue;
      out.push({
        ...hole(
          `hall-wing-${side}-${i}`,
          [-63.2, 1.7 + side * (13 + i * 6.2)],
          [0, 1],
          [1, 0],
          4.7,
          0.12,
          8.0,
          4.9,
        ),
        kind: 'door',
      });
    }
  out.push({
    ...hole('main-iwan', [-60.8, 1.7], [0, 1], [1, 0], 12.0, 0.1, 21.0, 14, 'pointed', 8),
    kind: 'door',
    inset: 2.6,
  });
  for (let i = 0; i < 7; i++) {
    if (d === 1 && i % 2) continue;
    const z = -34 + i * 12;
    out.push(hole(`rear-light-${i}`, [-90.5, z], [0, 1], [-1, 0], 2.4, 9.3, 4.2, 2.6));
  }
  return out;
}
export function badshahiGateFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [x, normal] of [
    [95.43, [1, 0]],
    [75.83, [-1, 0]],
  ]) {
    out.push({
      ...hole(`gate-door-${x}`, [x, 0.1], [0, 1], normal, 9.0, 0.1, 14.0, 9.0, 'pointed', 3),
      kind: 'door',
      inset: 0.65,
    });
    for (const side of [-1, 1])
      for (const y of [3.0, 11.4])
        out.push(
          hole(`gate-light-${x}-${side}-${y}`, [x, side * 7.8], [0, 1], normal, 1.6, y, 3.0, 1.8),
        );
  }
  return out;
}
export function badshahiGateGallery(d = 3) {
  if (d === 0) return [];
  const count = d === 1 ? 5 : 9,
    out = [];
  for (let i = 0; i < count; i++)
    out.push(
      hole(
        `gate-open-upper-${i}`,
        [95.43, -8.8 + ((i + 0.5) * 17.6) / count],
        [0, 1],
        [1, 0],
        17.6 / count - 0.55,
        18.5,
        2.7,
        1.7,
        'round',
        2.4,
      ),
    );
  return out;
}
export function badshahiCourtArches(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [i, e] of plans.arcadeLines.entries()) {
    const length = Math.hypot(e.b[0] - e.a[0], e.b[1] - e.a[1]),
      axis = unit(e.b.map((v, k) => v - e.a[k])),
      n = Math.round(length / (d === 1 ? 20 : d === 2 ? 12 : 6.4));
    for (let j = 0; j < n; j++)
      out.push(
        hole(
          `court-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          axis,
          e.normal,
          length / n - 0.9,
          0.08,
          4.65,
          2.9,
          'pointed',
          1.6,
        ),
      );
  }
  return out;
}
function trimArch(face, h, d, w = 0.42) {
  archBand(face, h, d === 2 ? 1 : d, w, 'trim', 0.065);
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(face, h, d, -(h.inset ?? 0.5), h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) trimArch(face, h, d, h.name === 'main-iwan' ? 0.55 : 0.35);
  }
}
function frameRect(face, x, z, y, width, height, _d, w = 0.35) {
  const n = [1, 0, 0],
    r = (a, b, c, e) =>
      face(
        'trim',
        [
          [x, floor + b, z + a],
          [x, floor + b, z + c],
          [x, floor + e, z + c],
          [x, floor + e, z + a],
        ],
        n,
      );
  r(-width / 2, y, width / 2, y + w);
  r(-width / 2, y + height - w, width / 2, y + height);
  r(-width / 2, y, -width / 2 + w, y + height);
  r(width / 2 - w, y, width / 2, y + height);
}
function onion(face, p, r, base, height, d) {
  const raw = [
      [0, 0.66],
      [0.18, 0.92],
      [0.4, 1.04],
      [0.61, 0.94],
      [0.79, 0.68],
      [0.92, 0.35],
      [1, 0],
    ],
    levels =
      d === 0
        ? [raw[0], raw[2], raw[4], raw[6]]
        : d === 1
          ? [raw[0], raw[1], raw[2], raw[4], raw[6]]
          : Array.from({ length: d === 2 ? 9 : d === 3 ? 13 : 17 }, (_, i) => {
              const t = i / (d === 2 ? 8 : d === 3 ? 12 : 16);
              return [t, t === 1 ? 0 : (0.66 + 0.72 * Math.sin(Math.PI * t)) * Math.sqrt(1 - t)];
            });
  profile(
    face,
    circle(p, r, [6, 8, 16, 24, 28][d]),
    levels.map(([y, s]) => [base + y * height, s]),
    'roof',
  );
}
function finial(face, p, base, height, d) {
  if (d === 0) {
    sides(face, rect(p[0] - 0.1, p[1] - 0.1, p[0] + 0.1, p[1] + 0.1), base, base + height, 'gold');
    return;
  }
  profile(
    face,
    circle(p, 0.3, d === 1 ? 4 : 6),
    [
      [base, 0.5],
      [base + height * 0.2, 1],
      [base + height * 0.45, 0.55],
      [base + height, 0],
    ],
    'gold',
  );
}
function chhatri(face, p, r, base, top, d, square = false) {
  const n = d <= 1 ? 4 : 8,
    ring = square ? rect(p[0] - r, p[1] - r, p[0] + r, p[1] + r) : circle(p, r, n),
    floorY = top - 3.5;
  if (d <= 1) {
    profile(
      face,
      ring,
      [
        [base, 1],
        [top - 1.2, 1],
      ],
      'wall',
    );
    profile(
      face,
      scaled(ring, 1.22),
      [
        [top - 1.2, 1],
        [top, 0],
      ],
      'roof',
    );
    return;
  }
  solid(face, ring, base, floorY, 'wall');
  band(face, ring, floorY - 0.4, 0.5, 'trim', 1.18);
  cap(face, scaled(ring, 1.15), floorY, 'wall');
  const posts = d === 1 ? 4 : 8;
  for (let i = 0; i < posts; i++) {
    const a = (i * Math.PI * 2) / posts,
      q = [p[0] + r * 0.83 * Math.cos(a), p[1] + r * 0.83 * Math.sin(a)];
    sides(
      face,
      rect(q[0] - 0.18, q[1] - 0.18, q[0] + 0.18, q[1] + 0.18),
      floorY,
      top - 1.2,
      'wall',
    );
  }
  cap(face, scaled(ring, 1.22), top - 1.2, 'trim');
  onion(face, p, r * 1.1, top - 1.2, 1.2, d);
  finial(face, p, top, 0.6, d);
}
function hall(out, face, d) {
  const fs = badshahiHallFields(d);
  if (d === 1) solid(face, plans.hall, footing, 17.5, 'wall');
  else shell(out, d, plans.hall, footing, 17.5, fs, 'wall');
  cap(face, plans.hall, 17.5, 'wall');
  if (d === 1) solid(face, plans.portal, 0, 27, 'wall');
  else
    shell(
      out,
      d,
      plans.portal,
      0,
      27,
      fs.filter((h) => h.name === 'main-iwan'),
      'wall',
    );
  cap(face, plans.portal, 27, 'wall');
  if (d === 1) for (const h of fs) pane(face, h, d, 0.035, h.kind === 'door' ? 'door' : 'glass');
  else finish(face, fs, d);
  for (const p of plans.domes) {
    const n = [6, 8, 16, 24, 28][d];
    solid(face, circle(p.center, p.radius * 0.66, n), 17.5, p.base, 'wall');
    onion(face, p.center, p.radius, p.base, p.height, d);
    if (d > 0 || p.radius > 10) finial(face, p.center, p.base + p.height, 2, d);
  }
  for (const p of plans.hallTurrets) chhatri(face, p.center, p.radius, 16.5, p.height, d);
  if (d >= 1) {
    band(face, plans.hall, 16.5, 0.6, 'trim', 1.005);
    band(face, plans.portal, 26.2, 0.8, 'trim', 1.012);
  }
  if (d >= 2) {
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const z = 1.7 + side * (13 + i * 6.2);
        frameRect(face, -63.125, z, 0.15, 6.0, 14.8, d, 0.3);
        frameRect(face, -63.12, z, 10.8, 4.4, 2.3, d, 0.3);
      }
    frameRect(face, -60.72, 1.7, 0.1, 16.1, 25.6, d, 0.4);
    frameRect(face, -60.71, 1.7, 22.9, 12.5, 2.2, d, 0.35);
    for (const z of [-7, 10.4]) {
      profile(
        face,
        circle([-60.8, z], 0.45, 6),
        [
          [26.2, 1],
          [28.0, 0.8],
          [29.4, 0],
        ],
        'wall',
      );
    }
  }
  if (d >= 3) {
    for (const e of edges(plans.hall)) {
      const n = Math.round(e.length / 1.4);
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n);
        profile(
          face,
          circle(p, 0.4, 4),
          [
            [17.5, 1],
            [18.2, 0.65],
            [18.65, 0],
          ],
          'wall',
        );
      }
    }
  }
}
function mainMinaret(face, p, d) {
  if (d === 0) {
    const ring = circle(p.center, p.radius, 4);
    profile(
      face,
      ring,
      [
        [0.1, 1.08],
        [3, 1],
        [47.7, 0.72],
      ],
      'wall',
    );
    for (const y of [13, 26, 39])
      profile(
        face,
        ring,
        [
          [y - 0.1, 0.85],
          [y + 0.3, 1.1],
        ],
        'wall',
      );
    profile(
      face,
      ring,
      [
        [47.7, 0.85],
        [50.3, 0.8],
      ],
      'wall',
    );
    onion(face, p.center, p.radius * 0.83, 50.3, 3.45, 0);
    return;
  }
  const n = [4, 4, 8, 8, 8][d],
    ring = circle(p.center, p.radius, n),
    levels = [
      [0.1, 1.08],
      [3.0, 1],
      [11.8, 0.94],
    ];
  for (const y of [13, 26, 39])
    levels.push(
      [y - 0.6, 0.92 - (y / 100) * 0.35],
      [y, 1.12 - (y / 100) * 0.25],
      [y + 0.6, 0.88 - (y / 100) * 0.3],
    );
  levels.push([45, 0.72], [47.7, 0.8]);
  profile(face, ring, levels, 'wall');
  if (d === 0) {
    profile(
      face,
      ring,
      [
        [47.7, 0.85],
        [50.3, 0.8],
      ],
      'wall',
    );
    onion(face, p.center, p.radius * 0.83, 50.3, 3.0, 0);
    return;
  }
  cap(face, scaled(ring, 0.83), 47.7, 'trim');
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3,
      q = [
        p.center[0] + p.radius * 0.63 * Math.cos(a),
        p.center[1] + p.radius * 0.63 * Math.sin(a),
      ];
    sides(face, rect(q[0] - 0.25, q[1] - 0.25, q[0] + 0.25, q[1] + 0.25), 47.7, 50.5, 'wall');
  }
  cap(face, scaled(ring, 0.98), 50.5, 'trim');
  onion(face, p.center, p.radius * 0.83, 50.5, 2.8, d);
  finial(face, p.center, 53.3, 0.45, d);
  if (d >= 2)
    for (const y of [13, 26, 39]) band(face, ring, y, 0.35, 'trim', 1.1 - (y / 100) * 0.25);
}
function court(out, face, d) {
  const compoundOpenings =
    d >= 2
      ? badshahiGateFields(d)
          .concat(badshahiHallFields(d))
          .map((h) => prepareOpening(h, 0, d === 2 ? 1 : d))
      : [];
  // The mapped compound wall and low roof cross the hall and gate; keep their recesses clear.
  const perimeterFace = compoundOpenings.length ? writer(masked(out, compoundOpenings), d) : face;
  const outer =
      d === 0 ? rect(-90.3, -86.4, 83.0, 87.4) : d === 1 ? coarse(plans.outer) : plans.outer,
    inner = d === 0 ? rect(-84.7, -80.6, 77, 82.5) : d === 1 ? coarse(plans.court) : plans.court;
  if (d === 0) {
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        cap(
          face,
          rect(
            -84.7 + (i * 161.7) / 4,
            -80.6 + (j * 163.1) / 4,
            -84.7 + ((i + 1) * 161.7) / 4,
            -80.6 + ((j + 1) * 163.1) / 4,
          ),
          0.025,
          'wall',
        );
  } else cap(face, plans.court, 0.025, 'wall');
  sides(perimeterFace, outer, footing, 6.3, 'wall');
  cap(perimeterFace, outer, 6.3, 'wall', [inner]);
  if (d === 0) {
    sides(face, inner, 0, 6.3, 'wall', true);
    return;
  }
  // Both sides of the outer wall remain present behind the open arcade.
  const back = scaled(outer, 0.991);
  sides(perimeterFace, back, footing, 6.3, 'wall', true);
  const fields = badshahiCourtArches(d);
  for (const [i, e] of plans.arcadeLines.entries()) {
    const n = e.normal,
      backA = e.a.map((v, k) => v - n[k] * 0.7),
      backB = e.b.map((v, k) => v - n[k] * 0.7),
      r = [e.a, e.b, backB, backA],
      hs = fields.filter((h) => h.name.startsWith(`court-${i}-`));
    if (d === 0) {
      for (const t of [0, 1]) {
        const p = lerp(e.a, e.b, t);
        sides(face, rect(p[0] - 0.45, p[1] - 0.45, p[0] + 0.45, p[1] + 0.45), 0, 6.3, 'wall');
      }
      face('wall', [at(e.a, 5.4), at(e.b, 5.4), at(e.b, 6.3), at(e.a, 6.3)], [n[0], 0, n[1]]);
    } else if (d === 1) {
      for (let j = 0; j <= hs.length; j++) {
        const p = lerp(e.a, e.b, j / hs.length);
        sides(face, rect(p[0] - 0.4, p[1] - 0.4, p[0] + 0.4, p[1] + 0.4), 0, 6.3, 'wall');
      }
      for (const h of hs) {
        const p = prepareOpening(h, 0, 1),
          sgn = Math.sign(-p.axis[1] * n[0] + p.axis[0] * n[1]),
          arc = openingShape(h, 1).slice(2),
          A = (q, o) => p.point(q[0], q[1], o * sgn);
        for (let j = 0; j < arc.length - 1; j++) {
          const a = arc[j],
            b = arc[j + 1];
          for (const o of [0, -0.7])
            face(
              'wall',
              [A(a, o), A(b, o), A([b[0], floor + 6.3], o), A([a[0], floor + 6.3], o)],
              [n[0] * (o === 0 ? 1 : -1), 0, n[1] * (o === 0 ? 1 : -1)],
            );
          face('wall', [A(a, 0), A(b, 0), A(b, -0.7), A(a, -0.7)], [0, -1, 0]);
        }
      }
    } else {
      shell(out, d, r, 0, 6.3, hs, 'wall');
      for (const h of hs) archBand(face, h, d === 2 ? 1 : d, 0.25, 'wall', 0.06);
    }
  }
  if (d >= 2) band(perimeterFace, outer, 6.0, 0.3, 'trim', 1.001);
}
function gate(out, face, d) {
  const fields = badshahiGateFields(d),
    open = badshahiGateGallery(d);
  if (d === 1) solid(face, plans.gate, footing, 22, 'wall');
  else shell(out, d, plans.gate, footing, 22, fields.concat(open), 'wall');
  cap(face, plans.gate, 22, 'wall');
  if (d === 1)
    for (const h of fields.concat(open))
      pane(face, h, d, 0.035, h.kind === 'door' ? 'door' : 'glass');
  else finish(face, fields, d);
  if (d >= 2) {
    for (const h of open) trimArch(face, h, d, 0.24);
    frameRect(face, 95.51, 0.1, 0.1, 13.0, 17.5, d, 0.42);
    frameRect(face, 95.52, 0.1, 15.6, 10.7, 2.0, d, 0.35);
  }
  for (const p of plans.gateTurrets) chhatri(face, p.center, p.radius, 20.8, p.height, d, true);
  const steps = d <= 1 ? 3 : 8;
  for (let i = 0; i < steps; i++) {
    const x = 95.4 + (i * 8) / steps;
    solid(face, rect(x, -11.7, x + 8 / steps, 11.7), footing, (-i * 3) / steps, 'wall');
  }
  if (d >= 2) band(face, plans.gate, 21.5, 0.5, 'trim', 1.01);
}
function pool(face, d) {
  const r = plans.pool.outline,
    inner = scaled(r, 0.88);
  cap(face, inner, 0.1, 'glass');
  sides(face, inner, 0.1, 0.8, 'trim', true);
  sides(face, r, 0.1, 0.8, 'trim');
  cap(face, r, 0.8, 'trim', [inner]);
  if (d >= 3)
    for (const e of edges(r)) {
      const n = Math.round(e.length / 1.1);
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n);
        solid(face, rect(p[0] - 0.18, p[1] - 0.18, p[0] + 0.18, p[1] + 0.18), 0.8, 1.05, 'trim');
      }
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
            const len = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (len > longest) {
              longest = len;
              k = i;
            }
          }
          if (longest > (d === 0 ? 55 : d === 1 ? 35 : 22)) {
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
  court(out, face, d);
  hall(out, face, d);
  gate(out, face, d);
  pool(face, d);
  for (const m of plans.minarets) mainMinaret(face, m, d);
}
export const buildBadshahiSkyline = (o) => build(o, 0),
  buildBadshahiDistrict = (o) => build(o, 1),
  buildBadshahiStreet = (o) => build(o, 2),
  buildBadshahiCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const badshahiStudy = {
  id: 'badshahi_mosque',
  key: 'badshahi_mosque',
  title: 'Badshahi Mosque',
  category: 'mosque',
  wikidataId: 'Q330872',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256² sandstone,marble,plain wood and bronze graphs;six groups including local glazing/water. Dome roofs and pale trim share one canonical marble graph. Linear tints,metric UVs and faceted architecture;no embedded images,unique facade maps,baked lighting or invented inscriptions.',
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
    'Individual medium-fi familiar exterior from three actually inspected2005/2011/2014 prayer-hall/gateway photographs and standard viewer PMTiles/DEM. Three pale bulbous domes,long red hall/central iwan/ten bays,four tall minarets with pale cupolas and small chhatris,low arcaded court,rectangular ablution enclosure,east gatehouse and approach steps. No independently mapped roof/tower parts;subplans and profiles are picture-led estimates. Broad pale borders abstract inlay;fine floral art,cusped/scalloped carving,calligraphy,leaded/lattice patterns,fixtures,engineering,interior and current finish excluded or unverified. Hall and gateway fields terminate at closed shallow recesses;gallery/chhatri voids are exterior only,no prayer-hall interior/free traversal claim. Rear and unseen faces simplify estimated repeats. Separate Hazuri Bagh,Lahore Fort/Alamgiri Gate,outer garden,roads and adjacent content remain host assets. Synthetic context and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('court-three-domes-and-four-minarets', [185, 78, 160], [-16, 23, 0]),
    cam('central-iwan-and-ten-bays', [9, 30, 22], [-71, 26, 1.7]),
    cam('red-court-arcades', [23, 19, -60], [18, 14, -82]),
    cam('east-gateway-and-steps', [148, 40, -48], [84, 23, 0]),
    cam('open-minaret-cupola', [-32, 66, 132], [-87.9, 52, 87.5]),
    cam('roof-and-signed-plan', [0, 345, 0.1], [0, 20, 0]),
  ],
};

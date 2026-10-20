/** Masjid al-Qiblatain: pale domes, paired tiered minarets and open geometric parapets. */
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
  '../../../content/worldgen/source/places/su/suk/n0461_masjid_al_qiblatain/',
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
  wall: '#d8d4c4',
  trim: '#dedaca',
  roof: '#d0cebf',
  door: '#786d5c',
  gold: '#b5a270',
  glass: '#566b75',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, qiblatainGround(...p) - 0.35);
export function qiblatainGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Qiblatain footing outside retained terrain');
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
export function qiblatainFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const [name, plan, y] of [
    ['main', plans.main, 10.8],
    ['wing', plans.wing, 8],
  ])
    for (const [i, e] of _edges(plan.outline).entries()) {
      if (Math.abs(e.a[0] + 14) < 1e-5 && Math.abs(e.b[0] + 14) < 1e-5) continue;
      const n = Math.floor(e.length / 5);
      for (let j = 0; j < n; j++) {
        const p = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n);
        if (plans.minarets.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 4.3)) continue;
        const door = name === 'main' && e.normal[1] > 0.7 && j === Math.floor(n / 2);
        const h = hole(
          `${name}-${i}-${j}`,
          p,
          e.axis,
          e.normal,
          door ? 2.8 : 1.45,
          door ? 1 : 3.4,
          door ? 6.1 : 2.6,
          door ? 3.7 : 1.5,
          'pointed',
          2,
        );
        h.kind = door ? 'door' : 'window';
        h.roofY = y;
        fields.push(h);
      }
    }
  return fields;
}
function fields(face, hs, d) {
  for (const h of hs) {
    pane(face, h, d, -0.22, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) archBand(face, h, d, h.kind === 'door' ? 0.55 : 0.2, 'trim', 0.04);
  }
}
function diamondParapet(face, r, y, d) {
  for (const e of _edges(r)) {
    if (Math.abs(e.a[0] + 14) < 1e-5 && Math.abs(e.b[0] + 14) < 1e-5) continue;
    if (d === 0) {
      face(
        'trim',
        [at(e.a, y), at(e.b, y), at(e.b, y + 0.65), at(e.a, y + 0.65)],
        [e.normal[0], 0, e.normal[1]],
      );
      continue;
    }
    const n = Math.max(1, Math.floor(e.length / 1.8));
    for (let j = 0; j < n; j++) {
      const p = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n),
        w = (e.length / n) * 0.5;
      const q = (u, h) => [p[0] + e.axis[0] * u, floor + y + h, p[1] + e.axis[1] * u],
        ring = [q(-w, 0.65), q(0, 1.4), q(w, 0.65), q(0, 0)];
      if (d === 1) {
        const mid = ring.reduce((v, p) => v.map((n, k) => n + p[k] / 4), [0, 0, 0]),
          inner = ring.map((p) => p.map((v, k) => mid[k] + (v - mid[k]) * 0.68));
        for (let i = 0; i < 4; i++) {
          const k = (i + 1) % 4;
          face('trim', [ring[i], ring[k], inner[k], inner[i]], [e.normal[0], 0, e.normal[1]]);
        }
      } else for (let i = 0; i < 4; i++) beam(face, ring[i], ring[(i + 1) % 4], 0.18, 'trim');
    }
  }
}
function roofs(face, d) {
  for (const [plan, y] of [
    [plans.main, 10.8],
    [plans.wing, 8],
  ]) {
    solid(face, plan.outline, y, y + 0.4, 'roof');
    if (d >= 1)
      for (const e of _edges(plan.outline)) {
        if (Math.abs(e.a[0] + 14) < 1e-5 && Math.abs(e.b[0] + 14) < 1e-5) continue;
        beam(face, at(e.a, y + 0.05), at(e.b, y + 0.05), 0.45, 'trim');
      }
    diamondParapet(face, plan.outline, y + 0.4, d);
  }
}
function dome(face, p, r, b, h, d) {
  const n = [8, 12, 20, 28, 32][d];
  profile(
    face,
    circle(p, r, n),
    [
      [b, 1],
      [b + h * 0.2, 0.98],
      [b + h * 0.5, 0.84],
      [b + h * 0.8, 0.5],
      [b + h, 0],
    ],
    'roof',
  );
}
function domes(face, d) {
  const p = plans.central,
    n = [8, 12, 20, 28, 32][d];
  solid(face, circle(p, 9, n), 11.2, 13, 'wall');
  dome(face, p, 9, 13, 8.4, d);
  profile(
    face,
    circle(p, d === 0 ? 0.11 : 0.09, d === 0 ? 4 : 8),
    [
      [21.4, 1],
      [23, 0],
    ],
    'gold',
  );
  const q = plans.side;
  solid(face, circle(q, 4, n), 8.2, 8.5, 'wall');
  dome(face, q, 4, 8.5, 3.7, d);
  profile(
    face,
    circle(q, d === 0 ? 0.1 : 0.08, d === 0 ? 4 : 8),
    [
      [12.2, 1],
      [13.5, 0],
    ],
    'gold',
  );
  if (d >= 2)
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8,
        normal = [Math.cos(a), Math.sin(a)],
        axis = [-normal[1], normal[0]],
        q = p.map((v, k) => v + normal[k] * 9.04),
        h = hole(`drum-${i}`, q, axis, normal, 0.7, 11.65, 0.8, 0.4, 'round', 1);
      pane(face, h, d, 0, 'glass');
    }
}
function towerFields(face, p, r, b, t, d) {
  if (d === 0) return;
  for (const [i, e] of _edges(circle(p, r, 8)).entries()) {
    const q = e.a.map((v, k) => (v + e.b[k]) / 2 + e.normal[k] * 0.025),
      h = hole(
        `tower-${b}-${i}`,
        q,
        e.axis,
        e.normal,
        d === 1 ? 0.6 : 0.55,
        b,
        t - b,
        (t - b) * 0.65,
        'round',
        1,
      );
    pane(face, h, d, 0, 'glass');
    if (d >= 3) archBand(face, h, d, 0.16, 'trim', 0.06);
  }
}
function minaret(face, p, d) {
  solid(face, rect(p[0] - 2.9, p[1] - 2.9, p[0] + 2.9, p[1] + 2.9), 1, 12, 'wall');
  const r = circle(p, 1, 8);
  if (d === 0) {
    profile(
      face,
      r,
      [
        [12, 2.25],
        [24.5, 1.85],
        [24.5, 3.1],
        [26.8, 3.1],
        [26.8, 1.5],
        [33.5, 1.4],
        [33.5, 2.15],
        [34.7, 2.15],
        [34.7, 0.95],
        [38.4, 0.95],
        [38.4, 1.28],
        [41.1, 0],
      ],
      'trim',
    );
  } else {
    profile(
      face,
      r,
      [
        [12, 2.25],
        [24.5, 1.85],
      ],
      'wall',
    );
    profile(
      face,
      r,
      [
        [24.5, 2.4],
        [25.2, 3.1],
        [26, 3.1],
      ],
      'trim',
    );
    sides(face, circle(p, 3.1, 8), 26, 26.8, 'trim');
    cap(face, circle(p, 3.1, 8), 26.8, 'trim', [circle(p, 2.8, 8)]);
    profile(
      face,
      r,
      [
        [26, 1.5],
        [33.5, 1.4],
      ],
      'wall',
    );
    profile(
      face,
      r,
      [
        [33.5, 1.65],
        [34, 2.15],
        [34.7, 2.15],
      ],
      'trim',
    );
    sides(face, circle(p, 2.15, 8), 34.7, 35.3, 'trim');
    cap(face, circle(p, 2.15, 8), 35.3, 'trim', [circle(p, 1.9, 8)]);
    profile(
      face,
      r,
      [
        [34.7, 0.95],
        [38.4, 0.95],
      ],
      'wall',
    );
    profile(
      face,
      circle(p, 1.28, d >= 2 ? 16 : 8),
      [
        [38.4, 1],
        [41.1, 0],
      ],
      'roof',
    );
    towerFields(face, p, 2.05, 20, 23.4, d);
    towerFields(face, p, 1.5, 28, 32.5, d);
    towerFields(face, p, 1, 35.7, 37.6, d);
    if (d >= 2) {
      diamondParapet(face, rect(p[0] - 2.9, p[1] - 2.9, p[0] + 2.9, p[1] + 2.9), 12, d);
      for (const e of _edges(r)) {
        const a = e.a.map((v, k) => (v - p[k]) * 2.3),
          b = e.b.map((v, k) => (v - p[k]) * 2.3);
        beam(
          face,
          [p[0] + a[0], floor + 24.2, p[1] + a[1]],
          [p[0] + b[0], floor + 24.2, p[1] + b[1]],
          0.25,
          'trim',
        );
      }
    }
  }
  profile(
    face,
    circle(p, d === 0 ? 0.12 : 0.09, d === 0 ? 4 : 8),
    [
      [41.1, 1],
      [42, 0],
    ],
    'gold',
  );
}
function build(out, d) {
  const face = writer(out, d),
    hs = qiblatainFields(d);
  sides(face, plans.whole.outline, footing, 1, 'trim');
  cap(face, plans.whole.outline, 1, 'trim');
  shell(
    out,
    d,
    plans.main.outline,
    1,
    10.8,
    hs.filter((h) => h.name.startsWith('main-')),
    'wall',
  );
  shell(
    out,
    d,
    plans.wing.outline,
    1,
    8,
    hs.filter((h) => h.name.startsWith('wing-')),
    'wall',
  );
  fields(face, hs, d);
  roofs(face, d);
  domes(face, d);
  for (const p of plans.minarets) minaret(face, p, d);
}
export const buildQiblatainSkyline = (o) => build(o, 0),
  buildQiblatainDistrict = (o) => build(o, 1),
  buildQiblatainStreet = (o) => build(o, 2),
  buildQiblatainCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const qiblatainStudy = {
  id: 'N0461',
  key: 'masjid_al_qiblatain',
  title: 'Masjid al-Qiblatain',
  category: 'mosque',
  wikidataId: 'Q2334553',
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
    'Five existing shared 256² stucco, raw limestone, lime plaster, plain wood and cast bronze graphs serve six merged roles including local opaque blue-grey fields. Metric UVs, linear colors and zero embedded images, copied photographs, facade atlases or baked lighting. Parapet diamonds are original coarse geometry, not copied historic screen artwork.',
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
    'Individual medium-fi mosque exterior. No independent roof/tower controls or height tags. Exact raw footprint retained; internal hall/wing division, two dome centers, tower positions, facade facing, bays, ornament rhythm and every height are estimates. Pointed doors/panes close recesses; no furnished or free-walking interior claim. Fine calligraphy, exact historic interlacing, fixtures, palms, gardens, newer surrounding parking/decks and shade sails remain omitted. Coarse DEM fixture does not establish current thresholds, road grade or engineering. Physical-device timings remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('paired-stepped-minarets', [-45, 36, -51], [10, 25, -10]),
    cam('pale-main-dome-and-drum', [36, 34, 29], [11, 16, 1]),
    cam('small-western-side-dome', [-51, 20, 35], [-20, 9, 1]),
    cam('pointed-doors-and-pane-recesses', [18, 7, 45], [12, 4, 19]),
    cam('open-geometric-parapets', [-30, 18, -32], [-17, 9, -4]),
    cam('north-up-exact-footprint', [0, 180, 0.1], [0, 9, 0]),
  ],
};

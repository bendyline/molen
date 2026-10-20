/** Kotor Cathedral: unequal square crowns, open vaulted porch and red-roofed basilica/apses. */
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

const openingShape = (h, d) =>
  h.shape === 'circle'
    ? Array.from({ length: d <= 1 ? 8 : 16 }, (_, i) => {
        const a = (i * Math.PI * 2) / (d <= 1 ? 8 : 16);
        return [
          (Math.cos(a) * h.width) / 2,
          h.bottom + h.height / 2 + (Math.sin(a) * h.height) / 2,
        ];
      })
    : baseOpeningShape(h, d);
function prepareOpening(h, b, d) {
  const v = basePrepareOpening(h, b, d);
  if (h.shape !== 'circle') return v;
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
  '../../../content/worldgen/source/places/sr/srt/n0405_kotor_cathedral/',
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
  wall: '#d6d0bd',
  trim: '#e4dbc6',
  roof: '#a66950',
  cap: '#777d7a',
  door: '#75614e',
  glass: '#526775',
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
const footing = (p) => Math.min(floor - 0.3, kotorGround(...p) - 0.35);
export function kotorGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Kotor Cathedral footing outside retained terrain');
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
function faceFrame(r, i) {
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
function gable(face, r, eave, top, slot = 'roof', axis = 0) {
  const rr = coarse(r);
  if (rr.length === 4) {
    const caps = [edge(rr, axis === 0 ? [-1, 0] : [0, -1]), edge(rr, axis === 0 ? [1, 0] : [0, 1])],
      ridge = caps.map((f) => lerp(f.a, f.b, 0.5)),
      nearest = (p) => (p === caps[0].a || p === caps[0].b ? ridge[0] : ridge[1]);
    for (let i = 0; i < rr.length; i++) {
      const f = faceFrame(rr, i);
      if (Math.abs(f.normal[axis]) > 0.65) continue;
      face(
        slot,
        [at(f.a, eave), at(f.b, eave), at(nearest(f.b), top), at(nearest(f.a), top)],
        [0, 1, 0],
      );
    }
    for (let i = 0; i < 2; i++) {
      const f = caps[i];
      face(
        'wall',
        [at(f.a, eave), at(f.b, eave), at(ridge[i], top)],
        [f.normal[0], 0, f.normal[1]],
      );
    }
    return;
  }
  hip(face, r, eave, top, slot, axis);
}
function hip(face, r, eave, top, slot = 'roof', axis = 0) {
  const k = 1 - axis,
    vs = r.map((p) => p[k]),
    xs = r.map((p) => p[axis]),
    mid = (Math.min(...vs) + Math.max(...vs)) / 2,
    rad = (Math.max(...vs) - Math.min(...vs)) / 2,
    lo = Math.min(...xs) + rad,
    hi = Math.max(...xs) - rad,
    point = (p) => {
      const q = [...p];
      q[k] = mid;
      q[axis] = lo <= hi ? Math.max(lo, Math.min(hi, p[axis])) : (lo + hi) / 2;
      return q;
    };
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(
      slot,
      [at(r[i], eave), at(r[j], eave), at(point(r[j]), top), at(point(r[i]), top)],
      [0, 1, 0],
    );
  }
}
const hole = (name, p, a, n, w, b, h, s = h, shape = 'pointed', depth = 5) => ({
  name,
  center: p,
  axis: a,
  normal: n,
  width: w,
  bottom: floor + b,
  height: h,
  spring: s,
  shape,
  depth,
});
const edge = (r, n) =>
  r
    .map((_, i) => faceFrame(r, i))
    .filter((f) => f.normal[0] * n[0] + f.normal[1] * n[1] > 0.65)
    .sort((a, b) => b.length - a.length)[0];
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
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  plans = rec.plans;
const circle = (o, r, n) =>
  Array.from({ length: n }, (_, i) => [
    o[0] + Math.cos((i * Math.PI * 2) / n) * r,
    o[1] + Math.sin((i * Math.PI * 2) / n) * r,
  ]);
const segments = (d) => (d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : 28);
function clipX(r, x) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      inside = a[0] >= x,
      next = b[0] >= x;
    if (inside) out.push(a);
    if (inside !== next) {
      const t = (x - a[0]) / (b[0] - a[0]);
      out.push([x, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
export const kotorPorch = () => ({
  ...hole('open-west-vault', [-13.75, 0.15], [0, 1], [-1, 0], 6.6, 0, 7.7, 4.4, 'round', 8),
  kind: 'air',
});
export function kotorFields(d = 3) {
  const f = [
    {
      ...hole(
        'west-door-under-porch',
        [-10.9, 0.15],
        [0, 1],
        [-1, 0],
        2.6,
        0.15,
        4.5,
        3.2,
        'round',
        2,
      ),
      kind: 'door',
    },
  ];
  if (d >= 1) {
    f.push(hole('west-rose', [-10.9, 0.15], [0, 1], [-1, 0], 3.7, 10.1, 3.7, 3.7, 'circle', 2));
    for (const side of [-1, 1])
      for (const x of d === 1 ? [-4, 7] : [-6, -0.5, 5, 10.5])
        f.push(
          hole(
            `clerestory-${side}-${x}`,
            [x, side < 0 ? -3.35 : 3.45],
            [1, 0],
            [0, side],
            0.8,
            12.5,
            1.6,
            1.2,
            'round',
            1.5,
          ),
        );
  }
  if (d >= 2) {
    for (const side of [-1, 1])
      for (const x of [-6, 1, 8])
        f.push(
          hole(
            `aisle-light-${side}-${x}`,
            [x, side < 0 ? (x > 5.3 ? -7.3 : -8.65) : 8.65],
            [1, 0],
            [0, side],
            0.75,
            5.5,
            2.2,
            1.825,
            'round',
            2,
          ),
        );
    f.push({
      ...hole('south-entry', [2, 8.65], [1, 0], [0, 1], 1.3, 0.15, 3.1, 2.45, 'round', 2),
      kind: 'door',
    });
  }
  return f;
}
export function kotorTowerFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const t of plans.towers)
    for (let i = 0; i < 4; i++) {
      const e = faceFrame(t.ring, i),
        west = e.normal[0] < -0.65;
      if (west || d >= 2) {
        for (const b of [10.1, 18.0]) {
          if (e.normal[0] > 0.65 && b < 14) continue;
          fields.push({
            ...hole(
              `${t.name}-stage-${i}-${b}`,
              lerp(e.a, e.b, 0.5),
              e.axis,
              e.normal,
              1.6,
              b,
              3.8,
              3,
              'round',
              2,
            ),
            kind: 'window-balcony',
          });
        }
      }
      const topBase = t.name === 'north' ? 26.6 : 29.1;
      fields.push({
        ...hole(
          `${t.name}-crown-${i}`,
          lerp(e.a, e.b, 0.5).map((v, k) => t.center[k] + (v - t.center[k]) * 0.88),
          e.axis,
          e.normal,
          t.name === 'north' ? 2.6 : 2.8,
          topBase,
          t.name === 'north' ? 3.25 : 4.1,
          t.name === 'north' ? 3.25 : 2.7,
          t.name === 'north' ? 'rect' : 'round',
          3,
        ),
        kind: 'louver',
      });
    }
  return fields;
}
export function kotorApseFields(d = 3) {
  if (d === 0) return [];
  return plans.apses.flatMap((a) => {
    const y = a.name === 'central' ? 4.3 : 3.2,
      w = a.name === 'central' ? 1 : 0.65,
      h = a.name === 'central' ? 3.5 : 2.5,
      z = a.center[1];
    return (a.name === 'central' && d >= 2 ? [-0.65, 0.65] : [0]).map((u, i) =>
      hole(
        `${a.name}-apse-light-${i}`,
        [a.center[0] + Math.sqrt(a.radius * a.radius - u * u), z + u],
        [0, 1],
        [1, 0],
        w,
        y,
        h,
        h - w / 2,
        'round',
        2,
      ),
    );
  });
}
function panel(_out, face, h, d) {
  pane(face, h, d, -0.32, h.kind === 'door' || h.kind === 'louver' ? 'door' : 'glass');
  if (d >= 1) archBand(face, h, d, h.kind === 'louver' ? 0.16 : 0.21, 'trim');
  if (h.kind === 'louver' && d >= 2) {
    const p = prepareOpening(h, 0, d),
      normal = [-p.axis[1], p.axis[0]],
      sign = Math.sign(normal[0] * h.normal[0] + normal[1] * h.normal[1]);
    for (let y = h.bottom + 0.45; y < h.bottom + h.spring - 0.15; y += 0.6) {
      const a = p.point(-h.width * 0.45, y, -0.25 * sign),
        b = p.point(h.width * 0.45, y, -0.25 * sign);
      beam(face, a, b, 0.13, 'door');
    }
  }
  if (h.kind === 'window-balcony' && d >= 2) {
    const p = prepareOpening(h, 0, d),
      sign = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    for (const y of [h.bottom + 0.05, h.bottom + 0.7])
      beam(face, p.point(-1, y, 0.32 * sign), p.point(1, y, 0.32 * sign), 0.15, 'trim');
    for (const u of [-0.7, 0, 0.7])
      beam(
        face,
        p.point(u, h.bottom + 0.05, 0.32 * sign),
        p.point(u, h.bottom + 0.7, 0.32 * sign),
        0.13,
        'trim',
      );
    const top = h.bottom + h.height + 0.4;
    beam(face, p.point(-1.15, top, 0.15 * sign), p.point(0, top + 0.55, 0.15 * sign), 0.2, 'trim');
    beam(face, p.point(0, top + 0.55, 0.15 * sign), p.point(1.15, top, 0.15 * sign), 0.2, 'trim');
  }
}
function church(out, face, d) {
  const fields = kotorFields(d),
    envelopeFields = fields.concat(kotorApseFields(d)),
    mask = masked(
      out,
      fields.map((h) => prepareOpening(h, 0, d)),
    ),
    roofFace = writer(mask, d);
  shell(out, d, clipX(rec.main.polygons[0].outline, -10.5), footing, 8, envelopeFields);
  for (const [r, e, t] of [
    [plans.nave, 14.8, 18.9],
    [plans.northAisle, 9.5, 12.3],
    [plans.northChoir, 9.5, 12.3],
    [plans.southAisle, 9.5, 12.3],
  ]) {
    shell(out, d, r, footing, e, envelopeFields);
    gable(roofFace, r, e, t);
    if (d >= 1) band(face, r, e - 0.25, 0.25, 'trim', 1.01);
  }
  for (const h of fields) {
    panel(out, face, h, d);
    if (h.name === 'west-rose' && d >= 1) {
      const n = d === 1 ? 8 : 16,
        p = prepareOpening(h, 0, d);
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          sign = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
        beam(
          face,
          p.point(Math.cos(a) * 0.32, h.bottom + h.height / 2 + Math.sin(a) * 0.32, -0.13 * sign),
          p.point(
            Math.cos(a) * h.width * 0.46,
            h.bottom + h.height / 2 + Math.sin(a) * h.height * 0.46,
            -0.13 * sign,
          ),
          d === 1 ? 0.12 : 0.09,
          'trim',
        );
      }
      pane(
        face,
        { ...h, width: 0.65, height: 0.65, bottom: h.bottom + (h.height - 0.65) / 2 },
        d,
        -0.1,
        'trim',
      );
    }
  }
  if (d >= 2)
    for (const side of [-1, 1])
      for (const x of [-8, -5, -2, 1, 4, 7, 10, 12.5]) {
        const h = hole(
          'aisle-blind-arcade',
          [x, side < 0 ? (x > 5.3 ? -7.35 : -8.7) : 8.7],
          [1, 0],
          [0, side],
          1.4,
          8.5,
          0.8,
          0.1,
          'round',
          0.3,
        );
        archBand(face, h, d, 0.12, 'trim');
      }
}
function porch(out, face, d) {
  const h = kotorPorch();
  shell(out, d, plans.porch, footing, 8.3, [h]);
  cap(face, plans.porch, 8.3, 'trim');
  const front = { ...h, center: [-16.6, 0.15], depth: 1 };
  archBand(face, front, d, 0.3, 'trim');
  // A real vaulted passage, backed by the separately modeled recessed church door.
  if (d >= 1) {
    for (const x of [-16.65, -10.92]) {
      beam(face, [x, floor + 8.4, -3.1], [x, floor + 8.4, 3.4], 0.22, 'trim');
      beam(face, [x, floor + 9.45, -3.1], [x, floor + 9.45, 3.4], 0.22, 'trim');
      for (const z of d === 1
        ? [-2.8, -1.4, 0, 1.4, 2.8]
        : [-2.9, -2.15, -1.4, -0.65, 0.1, 0.85, 1.6, 2.35, 3.1]) {
        const r = R(x - 0.13, z - 0.15, x + 0.13, z + 0.15);
        profile(
          face,
          r,
          [
            [8.4, 1],
            [8.6, 0.65],
            [8.9, 0.9],
            [9.2, 0.6],
            [9.45, 1],
          ],
          'trim',
        );
      }
    }
  }
  if (d >= 2)
    for (let i = 0; i < 3; i++)
      solid(
        face,
        R(-17.4 + i * 0.23, -3.1, -16.3, 3.4),
        () => floor - 0.05 + i * 0.18,
        0.12 + i * 0.18,
        'trim',
      );
}
function clock(face, t, d) {
  const e = edge(t.ring, [-1, 0]),
    h = hole(
      `${t.name}-clock`,
      lerp(e.a, e.b, 0.5),
      e.axis,
      e.normal,
      1.9,
      t.name === 'north' ? 23.0 : 25.1,
      1.9,
      1.9,
      'circle',
      1,
    );
  pane(face, h, d, 0.06, 'trim');
  const p = prepareOpening(h, 0, d),
    sgn = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    cy = h.bottom + 0.95;
  for (const [u, v] of [
    [0, 0.6],
    [0.47, -0.25],
  ])
    beam(face, p.point(0, cy, 0.1 * sgn), p.point(u, cy + v, 0.1 * sgn), 0.08, 'cap');
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(
        face,
        p.point(Math.cos(a) * 0.73, cy + Math.sin(a) * 0.73, 0.1 * sgn),
        p.point(Math.cos(a) * 0.82, cy + Math.sin(a) * 0.82, 0.1 * sgn),
        0.06,
        'cap',
      );
    }
}
function towers(out, face, d) {
  const all = kotorTowerFields(d);
  for (const t of plans.towers) {
    const fields = all.filter((h) => h.name.startsWith(t.name)),
      main = fields.filter((h) => !h.name.includes('-crown-')),
      top = fields.filter((h) => h.name.includes('-crown-'));
    shell(out, d, t.ring, footing, t.main, main);
    const upper = scaled(t.ring, 0.88),
      roofTop = t.top - 1.2;
    shell(out, d, upper, t.main, roofTop, top);
    cap(face, scaled(upper, 1.03), roofTop, 'cap');
    solid(face, scaled(upper, 1.07), roofTop - 0.2, roofTop + 0.05, 'trim');
    for (const y of d === 0 ? [t.main] : [8.3, 15.6, t.main])
      band(face, t.ring, y, 0.28, 'trim', 1.07);
    if (d >= 2) {
      for (const p of upper)
        solid(
          face,
          R(p[0] - 0.12, p[1] - 0.12, p[0] + 0.12, p[1] + 0.12),
          t.main + 0.3,
          roofTop,
          'trim',
        );
      for (const p of t.ring)
        for (const y of [2, 5, 9, 12, 17, 20, 23])
          if (y < t.main)
            solid(face, R(p[0] - 0.15, p[1] - 0.15, p[0] + 0.15, p[1] + 0.15), y, y + 0.45, 'trim');
    }
    for (const h of main) panel(out, face, h, d);
    for (const h of top) panel(out, face, h, d);
    if (d === 0)
      for (let i = 0; i < upper.length; i++) {
        const e = faceFrame(upper, i);
        const simple = hole(
          `${t.name}-distant-belfry-${i}`,
          lerp(e.a, e.b, 0.5),
          e.axis,
          e.normal,
          t.name === 'north' ? 2.6 : 2.8,
          t.name === 'north' ? 26.6 : 29.1,
          t.name === 'north' ? 3.25 : 4.1,
          t.name === 'north' ? 3.25 : 2.7,
          t.name === 'north' ? 'rect' : 'round',
          1,
        );
        // At skyline distance the louver-backed fields are one colored surface.
        pane(face, simple, d, 0.015, 'door');
      }
    if (d >= 1) clock(face, t, d);
    const o = t.center;
    beam(
      face,
      [o[0], floor + roofTop + 0.05, o[1]],
      [o[0], floor + t.top, o[1]],
      d === 0 ? 0.2 : 0.13,
      'cap',
    );
    beam(
      face,
      [o[0] - 0.38, floor + t.top - 0.37, o[1]],
      [o[0] + 0.38, floor + t.top - 0.37, o[1]],
      d === 0 ? 0.2 : 0.13,
      'cap',
    );
  }
}
function apses(out, face, d) {
  for (const a of plans.apses) {
    const r = circle(a.center, a.radius, segments(d)),
      fields = kotorApseFields(d).filter((h) => h.name.startsWith(a.name));
    shell(out, d, r, footing, a.wall, fields);
    profile(
      face,
      r,
      [
        [a.wall, 1.04],
        [a.cap, 0.08],
      ],
      'roof',
    );
    for (const h of fields) panel(out, face, h, d);
    if (d >= 1) {
      band(face, r, a.wall - 0.3, 0.22, 'trim', 1.02);
      const n = a.name === 'central' ? (d === 1 ? 4 : 8) : d === 1 ? 2 : 4;
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI * 0.43 + ((i + 0.5) / n) * Math.PI * 0.86,
          norm = [Math.cos(ang), Math.sin(ang)],
          w = a.radius * (d === 1 ? 0.62 : 0.36),
          height = w * 0.6,
          h = hole(
            `${a.name}-blind-arcade`,
            [a.center[0] + norm[0] * a.radius, a.center[1] + norm[1] * a.radius],
            [-norm[1], norm[0]],
            norm,
            w,
            a.wall - height - 0.35,
            height,
            height - w / 2,
            'round',
            0.3,
          );
        const curved = (slot, p, normal, col) =>
          face(
            slot,
            p.map((q) => {
              const dx = q[0] - a.center[0],
                dz = q[2] - a.center[1],
                l = Math.hypot(dx, dz);
              return [
                a.center[0] + (dx / l) * (a.radius + 0.05),
                q[1],
                a.center[1] + (dz / l) * (a.radius + 0.05),
              ];
            }),
            normal,
            col,
          );
        archBand(curved, h, d, 0.12, 'trim');
      }
    }
  }
}
function build(target, d) {
  // The viewer rasterizes triangle bounds for replacement. Split broad faces so
  // rotating this compact church cannot mask adjoining host buildings or narrow lanes.
  function emit(args, points, uvs) {
    let edge = 0;
    let longest = 0;
    for (let i = 0; i < 3; i++) {
      const a = points[i];
      const b = points[(i + 1) % 3];
      const length = Math.hypot(a[0] - b[0], a[2] - b[2]);
      if (length > longest) {
        longest = length;
        edge = i;
      }
    }
    if (longest > 8) {
      const a = edge,
        b = (edge + 1) % 3,
        c = (edge + 2) % 3;
      const mid = points[a].map((v, k) => Math.fround((v + points[b][k]) / 2));
      const uv = uvs[a].map((v, k) => (v + uvs[b][k]) / 2);
      emit(args, [points[a], mid, points[c]], [uvs[a], uv, uvs[c]]);
      emit(args, [mid, points[b], points[c]], [uv, uvs[b], uvs[c]]);
      return;
    }
    target.addTriangle(args[0], args[1], points, args[3], uvs, args[5]);
  }
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-7
        )
          return;
        emit(a, p, a[4]);
      },
    },
    face = writer(out, d);
  church(out, face, d);
  porch(out, face, d);
  apses(out, face, d);
  towers(out, face, d);
}
export const buildKotorSkyline = (o) => build(o, 0),
  buildKotorDistrict = (o) => build(o, 1),
  buildKotorStreet = (o) => build(o, 2),
  buildKotorCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const kotorCathedralStudy = {
  id: 'N0405',
  key: 'kotor_cathedral',
  title: 'Kotor Cathedral',
  category: 'cathedral',
  wikidataId: 'Q966429',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared 256-square ashlar, raw limestone, ceramic tile, painted metal and plain wood graphs serve six groups including local blue-grey glass. Linear tints, metric UVs and flat normals; no embedded images, unique facade photographs, bespoke textures or baked lighting.',
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
    'Individual medium-fi exterior from four inspected exterior/detail pictures and standard viewer PMTiles/DEM. Tower crown/roof heights and detailed partitions are estimates beyond retained map8/14m blocks. Porch is actual open air; windows are recessed blue-grey panes and belfry fields are louver-backed. Balusters, rose spokes, clocks, pediments, blind cornice arcades and stone relief are abstractions. Fine sculpture, faithful carved ornament, interiors/bells, hidden adjoining walls, current finish, engineering, exact lane/square/threshold/base joins and physical phone/laptop timing remain simplified, excluded or unverified. Adjacent buildings, cafes/canopies and town walls remain host content. Mediterranean neighbors are synthetic fixtures.',
    'Skyline retains unequal square towers, simpler north and arched south crowns, open porch, red basilica roofs and unequal rounded apses. District adds shared surfaces, rose/window rhythm, clocks and balcony. Street adds aisle/clerestory recesses, balusters/pediments/quoins and apse bifora/arcades. Close-up/master add finer curved sampling.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-unequal-towers-rose-and-porch', [-55, 20, 5], [-12, 17, 0]),
    cam('north-plain-south-arched-crowns', [-33, 34, 24], [-13.8, 28, 0.2]),
    cam('south-aisle-and-tile-roof', [0, 21, 45], [1, 9, 4]),
    cam('east-three-round-apses', [45, 24, 2], [13, 8, 0]),
    cam('north-aisle-and-adjoining-host-edge', [0, 26, -45], [1, 12, -3]),
    cam('roof-plan-and-open-porch', [0, 65, 0.1], [0, 10, 0]),
  ],
};

/** Saigon Notre-Dame: red brick basilica, twin pale spires, rose transept and stepped rear apses. */
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
  '../../../content/worldgen/source/places/w3/w3g/saigon_notre_dame_basilica/',
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
  wall: '#bf8f78',
  trim: '#e6dfce',
  roof: '#a57d65',
  metal: '#ced4d1',
  door: '#575a51',
  glass: '#526572',
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
const footing = (p) => Math.min(floor - 0.3, saigonGround(...p) - 0.35);
export function saigonGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Saigon Notre-Dame footing outside retained terrain');
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
const R = (x, z, a, b) => [
    [x, z],
    [a, z],
    [a, b],
    [x, b],
  ],
  _segments = (d) => [8, 12, 20, 32, 32][d];
const _circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos((i * Math.PI * 2) / n),
    p[1] + r * Math.sin((i * Math.PI * 2) / n),
  ]);
const allFaces = (r) => r.map((_, i) => ({ ...faceFrame(r, i), index: i }));
function onSide(r, x, side) {
  const fs = allFaces(r)
      .filter(
        (f) =>
          f.normal[1] * side > 0.85 &&
          x > Math.min(f.a[0], f.b[0]) + 0.8 &&
          x < Math.max(f.a[0], f.b[0]) - 0.8,
      )
      .sort((a, b) => b.length - a.length),
    f = fs[0];
  if (!f) return null;
  return { f, p: lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0])) };
}
export function saigonLowFields(d) {
  if (!d) return [];
  const hs = [],
    main = rec.main.polygons[0].outline;
  for (const side of [-1, 1])
    for (const x of d === 1 ? [9, 25, -22] : [5, 10, 15, 20, 25, 30, -16, -22, -27]) {
      const at = onSide(main, x, side);
      if (at)
        hs.push(
          hole(
            `aisle-${side}-${x}`,
            at.p,
            at.f.axis,
            at.f.normal,
            1.65,
            2.6,
            4.5,
            3.675,
            'round',
            3,
          ),
        );
    }
  if (d >= 2)
    for (const [k, r] of rec.plans.rearChapels.entries())
      for (const f of allFaces(r)) {
        if (f.length < 2.5 || f.normal[0] > 0.7) continue;
        const p = lerp(f.a, f.b, 0.5);
        if (Math.hypot(p[0] + 34, p[1]) < 5) continue;
        hs.push(
          hole(`rear-chapel-${k}-${f.index}`, p, f.axis, f.normal, 1.6, 2.1, 4.6, 3.8, 'round', 3),
        );
      }
  return hs;
}
export function saigonNaveFields(d) {
  if (!d) return [];
  const hs = [];
  for (const side of [-1, 1])
    for (const x of d === 1 ? [-22, 10, 26] : [-25, -20, -15, 5, 9, 13, 17, 21, 25, 29, 33])
      hs.push(
        hole(
          `clerestory-${side}-${x}`,
          [x, side < 0 ? -7.25 : 6.95],
          [1, 0],
          [0, side],
          1.75,
          16.2,
          3.8,
          2.925,
          'round',
          3,
        ),
      );
  return hs;
}
export function saigonChoirFields(d) {
  if (!d) return [];
  return allFaces(rec.plans.choir)
    .filter((f) => f.normal[0] < 0.5 && f.length > 3)
    .map((f) =>
      hole(
        `choir-${f.index}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        2.1,
        14.9,
        5,
        3.95,
        'round',
        3,
      ),
    );
}
export function saigonTranseptFields(d) {
  if (!d) return [];
  const hs = [];
  for (const side of [-1, 1]) {
    const p = [-4.35, side * 16.9];
    hs.push(hole(`transept-rose-${side}`, p, [1, 0], [0, side], 7, 14.3, 7, 7, 'circle', 4));
    if (d >= 2) {
      for (const x of [-6.1, -2.6])
        hs.push(
          hole(
            `transept-pair-${side}-${x}`,
            [x, p[1]],
            [1, 0],
            [0, side],
            1.65,
            8.7,
            3.5,
            2.675,
            'round',
            4,
          ),
        );
      hs.push(hole(`transept-door-${side}`, p, [1, 0], [0, side], 2.2, 0.45, 4.8, 3.7, 'round', 4));
    }
  }
  return hs;
}
export function saigonFrontFields(d) {
  if (!d) return [];
  const x = 44.4,
    hs = [
      hole('front-main-door', [x, -0.75], [0, 1], [1, 0], 4.2, 0.4, 6.9, 4.8, 'round', 5),
      hole('front-rose', [x, -0.75], [0, 1], [1, 0], 7.3, 14.5, 7.3, 7.3, 'circle', 5),
    ];
  if (d >= 2) {
    for (const z of [-2.6, 1.1])
      hs.push(
        hole(`front-upper-pair-${z}`, [x, z], [0, 1], [1, 0], 1.5, 9.2, 3.4, 2.65, 'round', 4),
      );
  }
  return hs;
}
export function saigonTowerFields(d) {
  if (!d) return [];
  const hs = [];
  for (const [k, r] of rec.plans.towers.entries())
    for (const f of allFaces(r)) {
      if (d === 1 && !(f.normal[0] > 0.8 || f.normal[1] * (k === 0 ? -1 : 1) > 0.8)) continue;
      const front = f.normal[0] > 0.8,
        p = lerp(f.a, f.b, 0.5);
      for (const u of [-1.13, 1.13]) {
        const q = p.map((v, j) => v + f.axis[j] * u);
        hs.push(
          hole(`belfry-${k}-${f.index}-${u}`, q, f.axis, f.normal, 1.8, 27.3, 6.3, 5.4, 'round', 3),
        );
        if (d >= 2 && (front || f.normal[1] * (k === 0 ? -1 : 1) > 0.8)) {
          hs.push(
            hole(
              `tower-tall-${k}-${f.index}-${u}`,
              q,
              f.axis,
              f.normal,
              1.8,
              16,
              5.3,
              4.4,
              'round',
              3,
            ),
          );
          if (front || f.normal[1] * (k === 0 ? -1 : 1) > 0.8)
            hs.push(
              hole(
                `tower-small-${k}-${f.index}-${u}`,
                q,
                f.axis,
                f.normal,
                1.6,
                9.4,
                3.5,
                2.7,
                'round',
                3,
              ),
            );
        }
      }
      if (front) {
        hs.push(hole(`tower-door-${k}`, p, f.axis, f.normal, 3.6, 0.4, 6.8, 5, 'round', 5));
        if (d >= 2)
          hs.push(hole(`tower-oculus-${k}`, p, f.axis, f.normal, 1.8, 22, 1.8, 1.8, 'circle', 3));
      }
    }
  return hs;
}
function finish(face, hs, d) {
  for (const h of hs) {
    const door = h.name.includes('door'),
      belfry = h.name.startsWith('belfry');
    pane(face, h, d, -0.32, door ? 'door' : 'glass');
    archBand(face, h, d, h.name.includes('rose') ? 0.36 : 0.18);
    if (belfry && d >= 2) {
      const v = prepareOpening(h, 0, d),
        sg = Math.sign(-v.axis[1] * h.normal[0] + v.axis[0] * h.normal[1]);
      for (let i = 0; i < (d === 2 ? 7 : 11); i++) {
        const y = h.bottom + 0.25 + (i * (h.spring - 0.35)) / (d === 2 ? 7 : 11);
        beam(
          face,
          v.point(-h.width * 0.43, y, -0.24 * sg),
          v.point(h.width * 0.43, y, -0.24 * sg),
          0.13,
          'trim',
        );
      }
    }
    if (h.name.includes('rose') && d >= 2) {
      const v = prepareOpening(h, 0, d),
        sg = Math.sign(-v.axis[1] * h.normal[0] + v.axis[0] * h.normal[1]),
        y = h.bottom + h.height / 2;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        beam(
          face,
          v.point(Math.cos(a) * 0.65, y + Math.sin(a) * 0.65, -0.21 * sg),
          v.point(Math.cos(a) * h.width * 0.47, y + Math.sin(a) * h.width * 0.47, -0.21 * sg),
          0.14,
        );
      }
    }
  }
}
function leanRoof(face, r, side) {
  const top = (p) =>
    floor + 9.65 + (13.7 - 9.65) * Math.max(0, Math.min(1, (13.7 - Math.abs(p[1])) / 6.7));
  cap(face, r, top, 'roof');
  for (let i = 0; i < r.length; i++) {
    const p = r[i],
      q = r[(i + 1) % r.length];
    face('wall', [at(p, 9.6), at(q, 9.6), at(q, top), at(p, top)], [0, 0, side]);
  }
}
function choirRoof(face, r) {
  // Continue the nave ridge into the apsidal fan; a fully hipped front creates a false valley.
  const ridge = (p) => [Math.max(-34, p[0]), -0.15];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    face('roof', [at(a, 21.3), at(b, 21.3), at(ridge(b), 28), at(ridge(a), 28)], [0, 1, 0]);
  }
}
function church(out, face, d) {
  const lows = [
      ...saigonLowFields(d),
      ...saigonTranseptFields(d),
      ...saigonFrontFields(d),
      ...saigonTowerFields(d),
    ],
    main = rec.main.polygons[0].outline;
  shell(out, d, d === 0 ? coarse(main) : main, footing, 9.6, lows);
  cap(face, main, 9.6, 'roof');
  for (const side of [-1, 1]) {
    for (const [a, b] of [
      [2.35, 35.7],
      [-29.7, -11.05],
    ]) {
      const z = side < 0 ? -13.55 : 13.25,
        r = side < 0 ? R(a, z, b, -7.15) : R(a, 6.85, b, z);
      leanRoof(face, r, side);
    }
  }
  for (const r of rec.plans.rearChapels) hip(face, r, 9.65, 12.9);
  const nr = rec.plans.nave,
    nh = saigonNaveFields(d);
  shell(out, d, nr, 9.5, 21.3, nh);
  gable(face, nr, 21.3, 28);
  finish(face, nh, d);
  const cr = rec.plans.choir,
    ch = saigonChoirFields(d);
  shell(out, d, cr, 9.5, 21.3, ch);
  choirRoof(face, cr);
  finish(face, ch, d);
  const tr = rec.plans.transept,
    th = saigonTranseptFields(d);
  shell(out, d, tr, footing, 22.1, th);
  gable(
    writer(
      masked(
        out,
        th.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    tr,
    22.1,
    29,
    'roof',
    1,
  );
  finish(face, th, d);
  finish(face, saigonLowFields(d), d);
  if (d >= 1) {
    for (const [r, y] of [
      [nr, 21],
      [cr, 21],
      [tr, 21.8],
      [main, 9.25],
    ])
      band(
        writer(
          masked(
            out,
            lows.map((h) => prepareOpening(h, 0, d)),
          ),
          d,
        ),
        r,
        y,
        0.25,
        'trim',
        1.004,
      );
  }
  if (d >= 2) {
    for (const side of [-1, 1]) {
      for (const x of [3, 7, 11, 15, 19, 23, 27, 31, 35]) {
        const p = [x, side < 0 ? -7.27 : 6.97];
        solid(face, R(p[0] - 0.18, p[1] - 0.15, p[0] + 0.18, p[1] + 0.15), 13.1, 21, 'trim');
      }
      for (const x of [2.9, 7.5, 12.5, 17.5, 22.5, 27.5, 32.5]) {
        const p = onSide(main, x, side)?.p;
        if (p)
          solid(face, R(p[0] - 0.19, p[1] - 0.19, p[0] + 0.19, p[1] + 0.19), 0.15, 9.3, 'trim');
      }
      const z = side * 16.92;
      for (const x of [-10.9, 2.2])
        solid(face, R(x - 0.22, z - 0.22, x + 0.22, z + 0.22), 0.2, 22.1, 'trim');
      beam(face, [-11.2, floor + 22.2, z], [-4.35, floor + 29.2, z], 0.3, 'trim');
      beam(face, [-4.35, floor + 29.2, z], [2.5, floor + 22.2, z], 0.3, 'trim');
    }
    for (const r of rec.plans.rearChapels)
      for (const p of r.filter((p) => p[0] < -31)) {
        solid(face, R(p[0] - 0.18, p[1] - 0.18, p[0] + 0.18, p[1] + 0.18), 0.15, 9.5, 'trim');
      }
    for (const p of rec.plans.choir.filter((p) => p[0] < -28))
      solid(face, R(p[0] - 0.16, p[1] - 0.16, p[0] + 0.16, p[1] + 0.16), 12.7, 21.1, 'trim');
  }
}
function front(out, face, d) {
  const hs = saigonFrontFields(d),
    r = R(43.7, -5.5, 44.4, 4),
    f = writer(
      masked(
        out,
        hs.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  shell(out, d, r, footing, 23.5, hs);
  gable(f, r, 23.5, 29.6);
  finish(face, hs, d);
  if (d >= 1) {
    const h = hole('clock', [44.45, -0.75], [0, 1], [1, 0], 2.7, 25, 2.7, 2.7, 'circle', 1);
    pane(face, h, d, 0.04, 'trim');
    archBand(face, h, d, 0.17);
    if (d >= 2) {
      const v = prepareOpening(h, 0, d);
      beam(
        face,
        v.point(0, h.bottom + 1.35, -0.14),
        v.point(0.15, h.bottom + 2.35, -0.14),
        0.1,
        'door',
      );
      beam(
        face,
        v.point(0, h.bottom + 1.35, -0.14),
        v.point(-0.85, h.bottom + 1.55, -0.14),
        0.12,
        'door',
      );
    }
  }
  if (d >= 2) {
    const x = 44.53;
    for (const z of [-5.45, 3.95])
      solid(face, R(44.4, z - 0.17, 44.68, z + 0.17), 0.2, 23.5, 'trim');
    for (const y of [8, 23.2])
      band(
        writer(
          masked(
            out,
            hs.map((h) => prepareOpening(h, 0, d)),
          ),
          d,
        ),
        r,
        y,
        0.23,
        'trim',
        1.005,
      );
    for (const side of [-1, 1])
      for (let i = 0; i < 8; i++) {
        const z = -0.75 + side * (0.59 + i * 0.59),
          y = 29.6 - (i + 1) * 0.76;
        beam(face, [x, floor + y, z], [x, floor + y, z + side * 0.6], 0.23, 'trim');
        beam(face, [x, floor + y, z], [x, floor + y + 0.76, z], 0.23, 'trim');
      }
    for (let i = 0; i < 3; i++)
      solid(face, R(44.4, -3.2, 45.3 - i * 0.22, 1.7), i * 0.14, 0.14 + i * 0.14, 'trim');
  }
}
function towers(out, face, d) {
  const hs = saigonTowerFields(d);
  for (const [k, r] of rec.plans.towers.entries()) {
    const fields = hs.filter(
      (h) =>
        h.name.split('-')[1] === String(k) ||
        (h.name.startsWith('tower-') && h.name.split('-')[2] === String(k)),
    );
    shell(out, d, r, footing, 35.5, fields);
    cap(face, r, 35.5, 'metal');
    const p = center(r);
    profile(
      face,
      scaled(r, 1.03),
      [
        [35.5, 1],
        [36.2, 1.03],
        [57, 0.015],
      ],
      'metal',
    );
    beam(
      face,
      [p[0], floor + 56.7, p[1]],
      [p[0], floor + 59.5, p[1]],
      d === 0 ? 0.24 : 0.15,
      'metal',
    );
    beam(
      face,
      [p[0], floor + 58.7, p[1] - 0.65],
      [p[0], floor + 58.7, p[1] + 0.65],
      d === 0 ? 0.24 : 0.15,
      'metal',
    );
    if (d >= 1) {
      finish(face, fields, d);
      for (const y of [8.2, 13.5, 24.6, 35.1])
        band(
          writer(
            masked(
              out,
              fields.map((h) => prepareOpening(h, 0, d)),
            ),
            d,
          ),
          r,
          y,
          0.3,
          'trim',
          1.025,
        );
    }
    if (d >= 2) {
      for (const q of r)
        solid(face, R(q[0] - 0.21, q[1] - 0.21, q[0] + 0.21, q[1] + 0.21), 0.3, 35.1, 'trim');
      for (const f of allFaces(r)) {
        const mid = lerp(f.a, f.b, 0.5),
          axis = f.axis,
          n = f.normal,
          back = mid.map((v, j) => v - n[j] * 1.2),
          u = 1.7,
          frontX = mid.map((v, j) => v + n[j] * 0.15),
          A = frontX.map((v, j) => v - axis[j] * u),
          B = frontX.map((v, j) => v + axis[j] * u);
        face('metal', [at(A, 35.8), at(B, 35.8), at(frontX, 43.5)], [n[0], 0, n[1]]);
        for (const a of [A, B])
          face('metal', [at(a, 35.8), at(frontX, 43.5), at(back, 38)], [0, 1, 0]);
        beam(face, at(A, 35.8), at(frontX, 43.5), 0.16, 'trim');
        beam(face, at(frontX, 43.5), at(B, 35.8), 0.16, 'trim');
        const h = hole('dormer', frontX, axis, n, 0.7, 37, 2.3, 1.95, 'round', 2);
        pane(face, h, d, 0.03, 'glass');
        archBand(face, h, d, 0.16, 'trim', 0.06);
      }
      if (d >= 3)
        for (const f of allFaces(r)) {
          for (const u of [-0.95, 0.95]) {
            const q = lerp(f.a, f.b, (u + 1) / 2);
            beam(
              face,
              at(q, 36.6),
              at(
                p.map((v, j) => v + (q[j] - v) * 0.06),
                55.7,
              ),
              0.07,
              'trim',
            );
          }
        }
    }
  }
}
function build(target, d) {
  function emit(a, p, uv) {
    let longest = 0,
      k = 0;
    for (let i = 0; i < 3; i++) {
      const l = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
      if (l > longest) {
        longest = l;
        k = i;
      }
    }
    if (longest > 14) {
      const j = (k + 1) % 3,
        c = (k + 2) % 3,
        mid = p[k].map((v, i) => Math.fround((v + p[j][i]) / 2)),
        v = uv[k].map((v, i) => (v + uv[j][i]) / 2);
      emit(a, [p[k], mid, p[c]], [uv[k], v, uv[c]]);
      emit(a, [mid, p[j], p[c]], [v, uv[j], uv[c]]);
      return;
    }
    target.addTriangle(a[0], a[1], p, a[3], uv, a[5]);
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
  front(out, face, d);
  towers(out, face, d);
}
export const buildSaigonSkyline = (o) => build(o, 0),
  buildSaigonDistrict = (o) => build(o, 1),
  buildSaigonStreet = (o) => build(o, 2),
  buildSaigonCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const saigonNotreDameStudy = {
  id: 'saigon_notre_dame_basilica',
  key: 'saigon_notre_dame_basilica',
  title: 'Saigon Notre-Dame Basilica',
  category: 'cathedral',
  wikidataId: 'Q428129',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256² running-bond brick,raw limestone,flat tile,painted metal and plain wood graphs;local blue-grey glazing;six groups. Pale shared painted metal abstracts spire cladding. Linear tints,metric UVs and flat normals;no embedded images,bespoke textures or baked lighting.',
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
    'Individual medium-fi exterior from three inspected matching pictures and standard viewer PMTiles/DEM. All heights,roof/bay/portal/cornice/clock/step/spire/dormer profiles are estimated or abstracted. Fine carving,clock numerals,window artwork,iron ridge fencing,interiors/bells,engineering,current restoration finish and exact surrounding roads/square/threshold/step/base contact remain simplified,excluded or unverified. Windows,doors and louvred belfry fields are recessed panes/timber;no open-interior or open-belfry claim. Square/statue,trees and separate town buildings remain host content. Synthetic Paris-mansard neighbors do not reproduce Saigon;physical phone/laptop timing unverified.',
    'Skyline retains twin pale square spires/crosses,brick tower pair,central gabled front,long tile nave,projecting transept and stepped rear apses. District adds shared textures,front rose/portals/clock,coarse round-window rhythm and paired belfry fields. Street adds full window rhythm,rose spokes,louvres,cornices/corner pilasters,dormer profiles and simple entry steps. Close-up/master refine arches and add restrained spire seam ribs.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('southeast-front-rose-clock-and-spires', [115, 37, 0], [40, 25, -0.75]),
    cam('southwest-nave-and-transept', [3, 36, 85], [0, 17, 3]),
    cam('northwest-rear-apses', [-100, 31, 34], [-33, 16, 0]),
    cam('twin-belfries-and-metal-spires', [87, 56, 62], [40, 40, 0]),
    cam('northeast-aisle-and-choir', [-8, 39, -91], [-6, 17, -5]),
    cam('roof-and-signed-plan', [0, 180, 0.1], [0, 22, 0]),
  ],
};

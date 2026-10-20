/** Padua Cathedral: unfinished brick front, rounded apses, crossing dome and northwest campanile. */
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
  '../../../content/worldgen/source/places/u2/u20/n0407_padua_cathedral/',
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
  wall: '#c29a7e',
  body: '#d6cbb5',
  trim: '#e0dfd2',
  drum: '#e6dbb5',
  roof: '#ddb59d',
  metal: '#c8ceca',
  door: '#74533e',
  glass: '#596b74',
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
const footing = (p) => Math.min(floor - 0.3, paduaGround(...p) - 0.35);
export function paduaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Padua Cathedral footing outside retained terrain');
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
];
const seg = (d) => [8, 12, 32, 48, 48][d];
const circle = (p, r, n, phase = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(phase + (i * Math.PI * 2) / n),
    p[1] + r * Math.sin(phase + (i * Math.PI * 2) / n),
  ]);
const apses = [
  { name: 'west-apse', center: [-37.4, 0], radius: 10.15, angle: Math.PI },
  { name: 'north-apse', center: [-13, -25.25], radius: 8.55, angle: -Math.PI / 2 },
  { name: 'south-apse', center: [-13, 25.3], radius: 8.5, angle: Math.PI / 2 },
];
export const paduaApsePlans = apses;
function apseRing(a, d) {
  return circle(a.center, a.radius, seg(d), Math.PI / seg(d));
}
function openingsOnCircle(a, d, bottom, height, width, tag, shape = 'round') {
  if (d === 0) return [];
  const r = apseRing(a, d),
    pick = d === 1 ? [-0.75, 0.75] : [-1.12, -0.56, 0, 0.56, 1.12];
  return pick.map((v, k) => {
    const desired = a.angle + v;
    let best;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        mid = lerp(f.a, f.b, 0.5),
        angle = Math.atan2(mid[1] - a.center[1], mid[0] - a.center[0]),
        dist = Math.abs(Math.atan2(Math.sin(angle - desired), Math.cos(angle - desired)));
      if (!best || dist < best.dist) best = { ...f, mid, dist };
    }
    return hole(
      `${a.name}-${tag}-${k}`,
      best.mid,
      best.axis,
      best.normal,
      width,
      bottom,
      height,
      shape === 'circle' ? height : height - width / 2,
      shape,
      3,
    );
  });
}
export function paduaFields(d) {
  if (d === 0) return [];
  const h = [
    hole('east-middle-door', [47.6, 0], [0, 1], [1, 0], 3.1, 0.55, 5.5, 5.5, 'rect'),
    hole('east-north-door', [47.6, -11.9], [0, 1], [1, 0], 1.9, 0.55, 3.65, 3.65, 'rect'),
    hole('east-south-door', [47.6, 11.05], [0, 1], [1, 0], 1.9, 0.55, 3.65, 3.65, 'rect'),
    hole('east-round-light', [47.6, 0], [0, 1], [1, 0], 2, 13.2, 2, 2, 'circle'),
    hole('east-high-oculus', [47.6, 0], [0, 1], [1, 0], 1.15, 26.9, 1.15, 1.15, 'circle'),
  ];
  for (const z of [-8.7, 8.6])
    for (const x of d === 1 ? [6, 33] : [0, 12, 24, 36])
      h.push(
        hole(
          `clerestory-${x}-${z}`,
          [x, z],
          [1, 0],
          [0, Math.sign(z)],
          2.1,
          18.4,
          4.0,
          2.95,
          'round',
          3,
        ),
      );
  return h;
}
export function paduaApseFields(d) {
  return apses.flatMap((a) => [
    ...openingsOnCircle(a, d, 4.5, 8.6, 2.2, 'long-light'),
    ...openingsOnCircle(a, d, 19.7, 2.5, 2.5, 'oculus', 'circle'),
  ]);
}
export function paduaDrumFields(d) {
  if (d === 0) return [];
  const a = rec.plans.drum,
    r = circle(a.center, a.radius, 12, Math.PI / 12),
    hs = [];
  for (let i = 0; i < r.length; i++) {
    if (d === 1 && i % 2) continue;
    const f = faceFrame(r, i);
    hs.push(
      hole(
        `drum-arched-light-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        1.85,
        30.2,
        5.8,
        4.875,
        'round',
        3,
      ),
    );
  }
  return hs;
}
export function paduaTowerFields(d) {
  if (d === 0) return [];
  const r = rec.tower.polygons[0].outline,
    hs = [];
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i),
      p = lerp(f.a, f.b, 0.5);
    hs.push(hole(`belfry-${i}`, p, f.axis, f.normal, 3.5, 42, 4.75, 3, 'round', 3));
    if (d >= 2)
      for (const y of [8, 24, 37])
        for (const u of [-1.55, 1.55]) {
          const q = p.map((v, k) => v + f.axis[k] * u);
          // Lower shaft apertures concealed by an adjoining apse are omitted.
          if (
            y < 25 &&
            apses.some((a) => Math.hypot(q[0] - a.center[0], q[1] - a.center[1]) < a.radius + 0.2)
          )
            continue;
          hs.push(
            hole(
              `tower-slit-${i}-${y}-${u}`,
              p.map((v, k) => v + f.axis[k] * u),
              f.axis,
              f.normal,
              0.42,
              y,
              1.4,
              1.19,
              'round',
              2,
            ),
          );
        }
  }
  return hs;
}
function finishFields(face, hs, d) {
  for (const h of hs) {
    pane(
      face,
      h,
      d,
      -0.32,
      h.name.includes('door') ? 'door' : h.name.includes('belfry') ? 'door' : 'glass',
    );
    if (!(d === 1 && h.name.includes('-apse-oculus')))
      archBand(
        face,
        h,
        d,
        h.name.includes('door') ? 0.28 : h.name.includes('oculus') ? 0.24 : 0.17,
        'trim',
        0.07,
      );
    if (d >= 2 && h.name.includes('door')) {
      beam(
        face,
        [h.center[0] + h.normal[0] * 0.075, floor + 0.55, h.center[1] + h.normal[1] * 0.075],
        [
          h.center[0] + h.normal[0] * 0.075,
          h.bottom + h.height - 0.1,
          h.center[1] + h.normal[1] * 0.075,
        ],
        0.07,
        'door',
      );
    }
    if (
      d >= 2 &&
      (h.name.includes('long-light') || h.name.includes('drum-arched') || h.name.includes('belfry'))
    ) {
      const p = prepareOpening(h, 0, d),
        normal = [-p.axis[1], p.axis[0]],
        sg = Math.sign(normal[0] * h.normal[0] + normal[1] * h.normal[1]);
      beam(
        face,
        p.point(0, h.bottom + 0.15, -0.29 * sg),
        p.point(0, h.bottom + h.height - 0.25, -0.29 * sg),
        0.075,
        'metal',
      );
      for (let k = 1; k < 4; k++) {
        const y = h.bottom + (h.spring * 0.85 * k) / 4;
        beam(
          face,
          p.point(-h.width * 0.45, y, -0.29 * sg),
          p.point(h.width * 0.45, y, -0.29 * sg),
          0.065,
          'metal',
        );
      }
    }
  }
}
function apse(out, face, d, a) {
  const r = apseRing(a, d),
    hs = paduaApseFields(d).filter((h) => h.name.startsWith(`${a.name}-`));
  shell(out, d, r, footing, 24.2, hs, 'body');
  cap(face, r, 24.2, 'body');
  profile(
    face,
    r,
    [
      [24.2, 1.02],
      [24.6, 1.04],
      [27.5, 0.06],
    ],
    'roof',
  );
  if (d >= 1) {
    if (d >= 2) band(face, r, 23.5, 0.35, 'trim', 1.025);
    band(face, r, 24, 0.3, 'trim', 1.04);
    finishFields(face, hs, d);
    for (const offset of d >= 2 ? [-1.4, -0.84, -0.28, 0.28, 0.84, 1.4] : []) {
      const ang = a.angle + offset,
        p = [a.center[0] + a.radius * Math.cos(ang), a.center[1] + a.radius * Math.sin(ang)],
        w = 0.22;
      solid(face, R(p[0] - w, p[1] - w, p[0] + w, p[1] + w), 0.3, 23.5, 'trim');
      if (d >= 2) {
        solid(face, R(p[0] - 0.31, p[1] - 0.31, p[0] + 0.31, p[1] + 0.31), 23.4, 23.85, 'trim');
      }
    }
  }
}
function church(out, face, d) {
  const hs = paduaFields(d),
    whole = d === 0 ? coarse(rec.main.polygons[0].outline) : rec.main.polygons[0].outline;
  shell(
    out,
    d,
    whole,
    footing,
    13.2,
    [...hs, ...paduaApseFields(d), ...paduaTowerFields(d)],
    'body',
  );
  cap(face, whole, 13.25, 'roof');
  for (const r of [
    rec.plans.nave,
    rec.plans.choir,
    rec.plans.northTransept,
    rec.plans.southTransept,
  ]) {
    shell(out, d, r, 0, 24.2, hs, 'body');
    gable(
      writer(
        masked(
          out,
          hs.map((h) => prepareOpening(h, 0, d)),
        ),
        d,
      ),
      r,
      24.2,
      29.8,
      'roof',
      r === rec.plans.northTransept || r === rec.plans.southTransept ? 1 : 0,
    );
    if (d >= 1) {
      // Stop the nave cornice behind the unfinished entrance screen.
      const cornice = r === rec.plans.nave ? R(-13, -8.7, 47.05, 8.6) : r;
      if (d >= 2) band(face, cornice, 23.6, 0.3, 'trim', 1.006);
      band(face, cornice, 24, 0.28, 'trim', 1.012);
    }
  }
  for (const a of apses) apse(out, face, d, a);
  for (const z of [-11.35, 11.4]) {
    const r = circle([-35.6, z], 5.15, seg(d), Math.PI / seg(d));
    solid(face, r, footing, 13.2, 'body');
    profile(
      face,
      r,
      [
        [13.2, 1.02],
        [15.2, 0.04],
      ],
      'roof',
    );
    if (d >= 2) band(face, r, 12.75, 0.35, 'trim', 1.025);
  }
  for (const side of [-1, 1]) {
    const outer = side < 0 ? -17.3 : 16.1,
      inner = side < 0 ? -8.7 : 8.6,
      lo = Math.min(outer, inner),
      hi = Math.max(outer, inner),
      r = R(-4, lo, 47.5, hi);
    shell(out, d, r, 0, 15.2, hs, 'body');
    face(
      'roof',
      [
        [-4, floor + 15.3, outer],
        [47.5, floor + 15.3, outer],
        [47.5, floor + 18.8, inner],
        [-4, floor + 18.8, inner],
      ],
      [0, 1, 0],
    );
    for (const x of [-4, 47.5])
      face(
        'body',
        [
          [x, floor + 15.2, outer],
          [x, floor + 15.2, inner],
          [x, floor + 18.8, inner],
        ],
        [x < 0 ? -1 : 1, 0, 0],
      );
  }
  for (const r of [R(3, 25.7, 24.8, 29.5), R(11.6, -30.05, 23.7, -17.7), R(25, 16.5, 44.3, 20.4)]) {
    solid(face, r, footing, 13.2, 'body');
    hip(face, r, 13.2, 15.1);
  }
  finishFields(
    face,
    hs.filter((h) => !h.name.startsWith('east-')),
    d,
  );
  if (d >= 2)
    for (const side of [-1, 1])
      for (const x of [-1, 11, 23, 35, 46]) {
        const z = side < 0 ? -17.3 : 16.1;
        solid(face, R(x - 0.18, z - 0.22, x + 0.18, z + 0.22), 0.2, 15.1, 'trim');
      }
}
function facade(out, face, d) {
  const profile = [
      [-17.4, 0],
      [-17.4, 15.8],
      [-8.7, 18.8],
      [-8.7, 25.8],
      [-7.5, 26.2],
      [-7.5, 27.1],
      [0, 31.3],
      [7.5, 27.1],
      [7.5, 26.2],
      [8.6, 25.8],
      [8.6, 18.8],
      [14.4, 15.8],
      [14.4, 0],
    ],
    hs = paduaFields(d).filter((h) => h.name.startsWith('east-')),
    ps = hs.map((h) => prepareOpening(h, 0, d)),
    cut = writer(masked(out, ps), d),
    idx = earcut(profile.flat(), [], 2);
  for (let i = 0; i < idx.length; i += 3)
    for (const x of [47.48, 47.72])
      cut(
        'wall',
        idx.slice(i, i + 3).map((k) => [x, floor + profile[k][1], profile[k][0]]),
        [x > 47.6 ? 1 : -1, 0, 0],
      );
  for (let i = 0; i < profile.length; i++) {
    const j = (i + 1) % profile.length;
    face('wall', [
      [47.48, floor + profile[i][1], profile[i][0]],
      [47.72, floor + profile[i][1], profile[i][0]],
      [47.72, floor + profile[j][1], profile[j][0]],
      [47.48, floor + profile[j][1], profile[j][0]],
    ]);
  }
  finishFields(face, hs, d);
  if (d >= 1) {
    for (const h of hs.filter((h) => h.name.includes('door')))
      solid(
        face,
        R(47.65, h.center[1] - h.width / 2 - 0.48, 48.05, h.center[1] + h.width / 2 + 0.48),
        h.bottom - floor + h.height + 0.12,
        h.bottom - floor + h.height + 0.42,
        'trim',
      );
  }
  if (d >= 2) {
    for (const h of hs.filter((h) => h.name.includes('door')))
      for (let i = 0; i < 2; i++)
        solid(
          face,
          R(
            47.7,
            h.center[1] - h.width / 2 - 0.35,
            48.4 + i * 0.24,
            h.center[1] + h.width / 2 + 0.35,
          ),
          0.12 + i * 0.16,
          0.28 + i * 0.16,
          'trim',
        );
    solid(face, R(47.73, -0.4, 47.93, 0.4), 7, 8.2, 'trim');
  }
}
function drum(out, face, d) {
  const a = rec.plans.drum,
    r = circle(a.center, a.radius, d === 0 ? 8 : 12, Math.PI / (d === 0 ? 8 : 12)),
    hs = paduaDrumFields(d);
  shell(out, d, r, a.bottom, a.wall, hs, 'drum');
  cap(face, r, a.wall, 'drum');
  if (d >= 1) {
    band(face, r, a.bottom, 0.25, 'trim', 1.015);
    band(face, r, a.wall - 0.6, 0.25, 'trim', 1.02);
    band(face, r, a.wall - 0.16, 0.28, 'trim', 1.04);
    finishFields(face, hs, d);
    if (d >= 2)
      for (const p of r)
        solid(
          face,
          R(p[0] - 0.13, p[1] - 0.13, p[0] + 0.13, p[1] + 0.13),
          a.bottom + 0.3,
          a.wall - 0.4,
          'trim',
        );
  }
  const rr = circle(a.center, a.radius, seg(d) * (d >= 2 ? 1 : 1), Math.PI / seg(d)),
    levels =
      d === 0
        ? [
            [38.8, 1.04],
            [43.8, 0.94],
            [47.3, 0.67],
            [49.7, 0.14],
          ]
        : [
            [38.8, 1.04],
            [40.7, 1.04],
            [43.7, 0.96],
            [46.3, 0.79],
            [48.3, 0.54],
            [49.7, 0.2],
          ];
  profile(face, rr, levels, 'metal');
  const lr = circle(a.center, 1.92, d === 0 ? 6 : 8, Math.PI / 8);
  solid(face, lr, 49.4, 54.8, 'metal');
  profile(
    face,
    lr,
    [
      [54.7, 1.13],
      [55.1, 1.07],
      [55.6, 0.7],
      [55.8, 0.1],
    ],
    'metal',
  );
  if (d >= 1) {
    for (let i = 0; i < lr.length; i++) {
      const f = faceFrame(lr, i),
        p = lerp(f.a, f.b, 0.5),
        h = hole(`lantern-dark-${i}`, p, f.axis, f.normal, 0.76, 50.3, 3.65, 3.65, 'rect', 2);
      pane(face, h, d, 0.025, 'door');
      if (d >= 2)
        for (const p of [f.a])
          solid(face, R(p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08), 49.6, 54.8, 'trim');
    }
  }
  if (d >= 2) {
    for (let i = 0; i < 16; i++) {
      const angle = (i * Math.PI) / 8,
        n = [Math.cos(angle), Math.sin(angle)];
      for (let j = 1; j < levels.length; j++) {
        const [y, f] = levels[j - 1],
          [v, g] = levels[j];
        beam(
          face,
          [
            a.center[0] + n[0] * a.radius * (f + 0.005),
            floor + y,
            a.center[1] + n[1] * a.radius * (f + 0.005),
          ],
          [
            a.center[0] + n[0] * a.radius * (g + 0.005),
            floor + v,
            a.center[1] + n[1] * a.radius * (g + 0.005),
          ],
          0.09,
          'metal',
        );
      }
    }
  }
  beam(
    face,
    [a.center[0], floor + 55.5, a.center[1]],
    [a.center[0], floor + a.tip, a.center[1]],
    d === 0 ? 0.22 : 0.13,
    'metal',
  );
  beam(
    face,
    [a.center[0] - 0.6, floor + 57.15, a.center[1]],
    [a.center[0] + 0.6, floor + 57.15, a.center[1]],
    d === 0 ? 0.22 : 0.13,
    'metal',
  );
}
function tower(out, face, d) {
  const r = rec.tower.polygons[0].outline,
    hs = paduaTowerFields(d);
  shell(out, d, r, footing, 47.4, hs, 'wall');
  cap(face, r, 47.4, 'wall');
  hip(face, scaled(r, 1.06), 47.4, 48.2, 'metal');
  if (d >= 1) {
    for (const y of [15.9, 29.5, 40.3, 41.2, 47.2]) {
      band(face, r, y, 0.3, 'trim', y === 41.2 ? 1.12 : 1.04);
    }
    finishFields(face, hs, d);
  }
  if (d >= 2) {
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      for (const u of [0.09, 0.91]) {
        const p = lerp(f.a, f.b, u);
        solid(face, R(p[0] - 0.12, p[1] - 0.12, p[0] + 0.12, p[1] + 0.12), 16.2, 40.3, 'wall');
      }
      for (const u of [0.15, 0.38, 0.62, 0.85]) {
        const p = lerp(f.a, f.b, u);
        solid(face, R(p[0] - 0.17, p[1] - 0.17, p[0] + 0.17, p[1] + 0.17), 40.6, 41.3, 'trim');
      }
    }
  }
  const p = center(r);
  beam(face, [p[0], floor + 48, p[1]], [p[0], floor + 49.3, p[1]], 0.1, 'metal');
  if (d >= 1)
    face(
      'metal',
      [
        [p[0], floor + 48.7, p[1]],
        [p[0] + 0.95, floor + 49.1, p[1]],
        [p[0], floor + 49.1, p[1]],
      ],
      [0, 0, 1],
    );
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
    if (longest > (d === 0 ? 24 : 22)) {
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
  facade(out, face, d);
  drum(out, face, d);
  tower(out, face, d);
}
export const buildPaduaSkyline = (o) => build(o, 0),
  buildPaduaDistrict = (o) => build(o, 1),
  buildPaduaStreet = (o) => build(o, 2),
  buildPaduaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const paduaCathedralStudy = {
  id: 'N0407',
  key: 'padua_cathedral',
  title: 'Padua Cathedral',
  category: 'cathedral',
  wikidataId: 'Q2407092',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared256² brick,raw limestone,lime plaster,flat tile,painted metal and plain wood graphs with local blue-grey glazing. Linear tints,metric UVs,flat architectural normals. No embedded images,unique facade photographs,bespoke textures or baked lighting.',
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
    'Individual medium-fi exterior from four inspected pictures and standard viewer PMTiles/DEM. All heights,roof/apse/lantern partitions and details are estimates. Unfinished front,crest/pilasters,cornices,dentils,lead roof ribs and vane are abstractions. Faithful sculpture/inscriptions,window artwork,interiors/bells,hidden adjoining walls,current finish,engineering,exact plaza/threshold/step/base contact and physical phone/laptop timing remain simplified,excluded or unverified. Doors and belfry fields are recessed timber;glazing is blue-grey. No navigable interior or open-belfry claim. Baptistery,canonical houses,palaces,trees and town remain host content. Italian palazzo neighbors are synthetic fixtures.',
    'Skyline retains stepped brick east front,three major round apses,long terracotta nave/aisles,crossing dome/lantern/cross and square northwest campanile. District adds shared materials,front portals/oculi,coarser apse and clerestory windows,drum lights and belfry. Street adds full apse/window rhythm,pilasters,cornices,steps,slits/mullions and dome ribs. Close-up/master refine curved sampling.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('unfinished-east-front-three-portals', [109, 25, 4], [47, 16, 0]),
    cam('west-apse-and-crossing-dome', [-100, 52, 29], [-27, 27, 0]),
    cam('north-apse-and-campanile', [-41, 39, -95], [-18, 26, -14]),
    cam('south-apse-and-tile-roofs', [0, 40, 105], [-8, 23, 15]),
    cam('dome-lantern-and-recessed-drum', [-39, 65, 49], [-13, 40, 0]),
    cam('roof-and-signed-plan', [0, 170, 0.1], [0, 20, 0]),
  ],
};

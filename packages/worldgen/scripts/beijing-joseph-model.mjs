/** Beijing St.Joseph: three domed western towers, gray-brick facade and long arched hall. */
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
  '../../../content/worldgen/source/places/wx/wx4/st_josephs_church_beijing/',
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
  wall: '#b0b2ad',
  trim: '#c7c8bd',
  roof: '#7c8387',
  door: '#75634e',
  glass: '#4d6178',
  louver: '#5b6767',
  accent: '#d8d4c8',
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
const footing = (p) => Math.min(floor - 0.3, beijingJosephGround(...p) - 0.35);
export function beijingJosephGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Beijing St.Joseph footing outside retained terrain');
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
  plans = rec.plans,
  main = rec.main.polygons[0].outline;
const circle = (p, r, n = 12, rotation = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos((i * 2 * Math.PI) / n + rotation),
    p[1] + r * Math.sin((i * 2 * Math.PI) / n + rotation),
  ]);
const octagon = (p, r) => circle(p, r, 8, Math.PI / 8),
  aperture = (name, p, n, w, b, h, s, shape = 'round', depth = 5) =>
    hole(name, p, [-n[1], n[0]], n, w, b, h, s, shape, depth);
const roundWindow = (name, p, n, r, y) => ({
  ...aperture(name, p, n, 2 * r, y - r, 2 * r, r, 'round', 10),
  shape: 'circle',
});
const towers = plans.towerCenters.map((p, i) => ({
  p,
  central: i === 1,
  ring: i === 1 ? plans.centerTower : octagon(p, 2.65),
  drum: octagon(p, i === 1 ? 3.35 : 2.7),
  bellBase: i === 1 ? 16.4 : 15.6,
  bellTop: i === 1 ? 20.1 : 18.6,
  drumTop: i === 1 ? 22.4 : 20,
  domeTop: i === 1 ? 24.4 : 21.4,
  lanternTop: i === 1 ? 25.7 : 22.45,
  capTop: i === 1 ? 26.1 : 22.8,
  crossTop: i === 1 ? 27.3 : 23.6,
}));
export function beijingJosephFields(d = 3) {
  const hs = [];
  for (const z of [-7.12, 0, 7.12])
    hs.push({
      ...aperture(`portal-${z}`, [-32.35, z], [-1, 0], 2.7, 0.1, 5.8, 4.45, 'round', 12),
      kind: 'door',
    });
  hs.push(roundWindow('main-rose', [-32.35, 0], [-1, 0], 1.62, 11.85));
  if (d >= 1) {
    for (const z of [-7.12, 7.12])
      for (const off of [-0.66, 0.66])
        hs.push(
          aperture(
            `paired-front-${z}-${off}`,
            [-32.35, z + off],
            [-1, 0],
            1.02,
            9.7,
            3.7,
            3.19,
            'round',
            12,
          ),
        );
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++)
        hs.push(
          aperture(
            `hall-${side}-${i}`,
            [-22.6 + i * 5.2, side * 10.53],
            [0, side],
            2.1,
            3.2,
            7.4,
            6.35,
            'round',
            4,
          ),
        );
    for (const [i, _p] of main.entries()) {
      if (i < 2 || i === main.length - 1) continue;
      const f = faceFrame(main, i);
      if (f.length < 4.8 || f.normal[0] < 0.15) continue;
      hs.push(aperture(`rear-${i}`, lerp(f.a, f.b, 0.5), f.normal, 1.6, 3.6, 5.8, 5, 'round', 4));
    }
  }
  return hs;
}
export function beijingJosephTowerFields(d = 3) {
  const hs = [];
  if (d === 0) return hs;
  for (const [k, t] of towers.entries()) {
    for (let i = 0; i < t.ring.length; i++) {
      const f = faceFrame(t.ring, i);
      if (d === 1 && f.normal[0] > 0.1) continue;
      const count = t.central && Math.abs(f.normal[0]) > 0.6 ? 2 : 1;
      for (let j = 0; j < count; j++) {
        const w = t.central ? 1.12 : 1.15,
          b = t.central ? 16.95 : 16.2,
          h = t.central ? 2.65 : 1.95;
        hs.push({
          ...aperture(
            `tower-louver-${k}-${i}-${j}`,
            lerp(f.a, f.b, 0.5 + ((j - (count - 1) / 2) * 1.65) / f.length),
            f.normal,
            w,
            b,
            h,
            h - w / 2,
            'round',
            3,
          ),
          kind: 'louver',
        });
      }
    }
    if (d >= 3 || (d >= 2 && t.central))
      for (let i = d >= 3 ? 1 : 3; i < 8; i += d >= 3 ? 2 : 8) {
        const f = faceFrame(t.drum, i);
        hs.push(
          roundWindow(
            `drum-oculus-${k}-${i}`,
            lerp(f.a, f.b, 0.5),
            f.normal,
            t.central ? 0.47 : 0.28,
            t.central ? 21.25 : 19.35,
          ),
        );
      }
    if (d >= 3) {
      const r = octagon(t.p, t.central ? 0.72 : 0.54);
      for (let i = 0; i < 8; i++) {
        const f = faceFrame(r, i),
          h = t.central ? 0.86 : 0.65;
        hs.push({
          ...aperture(
            `lantern-light-${k}-${i}`,
            lerp(f.a, f.b, 0.5),
            f.normal,
            t.central ? 0.28 : 0.2,
            t.domeTop + 0.1,
            h,
            h - 0.1,
            'rect',
            1.1,
          ),
          kind: 'lantern',
        });
      }
    }
  }
  return hs;
}
function panel(face, h, d) {
  // Louvers bind opaque shared wood through trim; the window slot draws textured glass untinted.
  const slot = h.kind === 'door' ? 'door' : h.kind === 'louver' ? 'louver' : 'glass',
    depth =
      d === 1 && h.kind !== 'door' && h.shape !== 'circle'
        ? 0.12
        : h.kind === 'door'
          ? -1.15
          : h.kind === 'louver'
            ? -0.28
            : -0.55;
  pane(face, h, d, depth, slot);
  if (d < 2) return;
  archBand(face, h, d, h.kind === 'door' ? 0.25 : 0.16, 'trim', 0.08);
  if (d >= 3 && h.kind !== 'lantern')
    archBand(face, h, d, h.kind === 'door' ? 0.48 : 0.3, 'trim', 0.12);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    line = (a, b, w, slot = 'trim', off = -0.52) =>
      beam(face, p.point(...a, off * sg), p.point(...b, off * sg), w, slot);
  if (h.kind === 'door') {
    line([0, h.bottom], [0, h.bottom + 4.1], 0.1, 'trim', -1.11);
    if (d >= 3)
      for (const y of [1.1, 2.8])
        for (const u of [-0.64, 0.64]) {
          line([u - 0.48, h.bottom + y], [u + 0.48, h.bottom + y], 0.07, 'accent', -1.1);
        }
  } else if (h.shape === 'circle') {
    const y = h.bottom + h.height / 2,
      r = h.width * 0.46;
    line([-r, y], [r, y], 0.13, 'accent');
    line([0, y - r], [0, y + r], 0.13, 'accent');
    if (d >= 3)
      for (const off of [-1, 1]) {
        const q = roundWindow('rose-medallion', h.center, h.normal, 0.15, y + off * r * 0.86);
        pane(face, q, d, -0.49, 'accent');
      }
  } else if (h.kind === 'louver') {
    if (d >= 3)
      for (let y = h.bottom + 0.16; y < h.bottom + h.spring; y += 0.24)
        line([-h.width * 0.45, y], [h.width * 0.45, y], 0.055, 'louver', -0.22);
  } else if (h.kind !== 'lantern') {
    for (const frac of [1 / 3, 2 / 3])
      line(
        [-h.width * 0.46, h.bottom + h.spring * frac],
        [h.width * 0.46, h.bottom + h.spring * frac],
        0.085,
      );
    line([0, h.bottom], [0, h.bottom + h.spring], 0.08);
  }
}
function frontDetails(face, d) {
  const front = plans.front;
  for (const y of [1.2, 1.6, 7.9, 8.2, 15.9, 16.2])
    band(face, front, y, y < 2 ? 0.18 : 0.22, 'trim', 1.015);
  for (const z of [-10.35, -4.3, -2.8, 2.8, 4.3, 10.35]) {
    solid(face, R(-32.7, z - 0.24, -31.98, z + 0.24), footing, 16.35, 'trim');
    if (d >= 2) {
      for (const [b, t, w] of [
        [0, 0.8, 0.48],
        [0.8, 1.5, 0.39],
        [7.6, 8.35, 0.41],
        [15.6, 16.35, 0.39],
      ])
        solid(face, R(-32.85, z - w, -31.95, z + w), b, t, 'accent');
      if (d >= 3)
        for (const off of [-0.13, 0.13])
          beam(
            face,
            [-32.76, floor + 8.7, z + off],
            [-32.76, floor + 15.25, z + off],
            0.07,
            'accent',
          );
    }
  }
  if (d >= 2) {
    for (const z of [-7.12, 7.12]) {
      const h = aperture('paired-surround', [-32.39, z], [-1, 0], 2.9, 9.55, 4.7, 3.25, 'round', 1);
      archBand(face, h, d, 0.18, 'trim', 0.05);
      const eye = roundWindow('paired-eye', [-32.46, z], [-1, 0], 0.32, 13.1);
      pane(face, eye, d, 0.03, 'glass');
      archBand(face, eye, d, 0.1, 'accent', 0.09);
    }
    for (const z of [-3.55, 3.55])
      for (const y of [3.8, 11.8]) {
        solid(face, R(-32.48, z - 0.19, -32.35, z + 0.19), y - 1.7, y + 1.7, 'accent');
        gable(face, R(-32.5, z - 0.28, -32.31, z + 0.28), y + 1.7, y + 2, 'accent', 0);
      }
    for (const z of [-7.12, 0, 7.12])
      for (const side of [-1, 1]) {
        const h = roundWindow(
          'facade-disc',
          [-32.44, z + side * 1.75],
          [-1, 0],
          0.28,
          z === 0 ? 14.15 : 6.4,
        );
        pane(face, h, d, 0.03, 'accent');
        if (d >= 3) archBand(face, h, d, 0.07, 'trim', 0.07);
      }
    // Coarse balustrade rhythm, with no sub-pixel pierced dentils.
    for (const z of [-9.7, -4.8, 4.8, 9.7]) {
      solid(face, R(-32.5, z - 0.24, -31.95, z + 0.24), 16.4, 17, 'trim');
      gable(face, R(-32.63, z - 0.36, -31.82, z + 0.36), 17, 17.4, 'trim', 0);
    }
    if (d >= 3)
      for (const [lo, hi] of [
        [-4.6, -3.25],
        [3.25, 4.6],
      ])
        for (let z = lo; z < hi; z += 0.4) {
          beam(face, [-32.2, floor + 16.45, z], [-32.2, floor + 16.9, z], 0.12, 'trim');
        }
  }
}
function buildTowers(out, face, d) {
  const fields = beijingJosephTowerFields(d),
    holes = d >= 2 ? fields : [],
    cut = writer(
      masked(
        out,
        holes.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  for (const t of towers) {
    shell(out, d, t.ring, t.bellBase, t.bellTop, holes, 'wall');
    cap(cut, t.ring, t.bellTop, 'trim');
    if (d >= 1) {
      band(cut, t.ring, t.bellBase, 0.22, 'trim', 1.035);
      band(cut, t.ring, t.bellTop - 0.3, 0.3, 'trim', 1.075);
    }
    const _mid = t.central ? 21.25 : 19.35;
    shell(out, d, t.drum, t.bellTop, t.drumTop, holes, 'wall');
    cap(cut, t.drum, t.drumTop, 'roof');
    if (d >= 1) {
      for (const y of [t.bellTop, t.drumTop - 0.25]) band(cut, t.drum, y, 0.2, 'trim', 1.045);
    }
    if (d >= 2)
      for (let i = 0; i < t.drum.length; i++) {
        const f = faceFrame(t.drum, i),
          p = f.a;
        solid(cut, circle(p, 0.13, 6), t.bellTop + 0.1, t.drumTop, 'trim');
      }
    const base = octagon(t.p, t.central ? 3.35 : 2.7),
      levels =
        d === 0
          ? [
              [t.drumTop, 1],
              [t.domeTop - 0.5, 0.55],
              [t.domeTop, 0.21],
            ]
          : [
              [t.drumTop, 1],
              [t.drumTop + 0.3, 0.96],
              [(t.drumTop + t.domeTop) / 2, 0.76],
              [t.domeTop - 0.3, 0.35],
              [t.domeTop, 0.21],
            ];
    profile(cut, base, levels, 'roof');
    const lantern = octagon(t.p, t.central ? 0.72 : 0.54);
    shell(out, d, lantern, t.domeTop, t.lanternTop, holes, 'trim');
    cap(cut, lantern, t.lanternTop, 'roof');
    profile(
      cut,
      lantern,
      [
        [t.lanternTop, 1.07],
        [t.capTop, 0.2],
      ],
      'roof',
    );
    const y = t.crossTop;
    beam(face, at(t.p, t.capTop), at(t.p, y), d === 0 ? 0.13 : 0.1, 'trim');
    beam(
      face,
      at([t.p[0], t.p[1] - 0.38], y - 0.43),
      at([t.p[0], t.p[1] + 0.38], y - 0.43),
      d === 0 ? 0.13 : 0.1,
      'trim',
    );
    if (d >= 2) {
      for (const r of [t.ring])
        for (let i = 0; i < r.length; i++) {
          const f = faceFrame(r, i);
          if (f.length < 1.5) continue;
          for (const p of [f.a])
            solid(
              face,
              R(p[0] - 0.17, p[1] - 0.17, p[0] + 0.17, p[1] + 0.17),
              t.bellBase,
              t.bellTop + 0.2,
              'trim',
            );
        }
    }
    if (d >= 3) {
      for (let i = 0; i < 8; i++) {
        for (let j = 1; j < levels.length; j++) {
          const a = levels[j - 1],
            b = levels[j],
            p = scaled(base, a[1] * 1.012)[i],
            q = scaled(base, b[1] * 1.012)[i];
          beam(face, at(p, a[0] + 0.04), at(q, b[0] + 0.04), 0.065, 'trim');
        }
      }
    }
  }
  if (d >= 1) for (const h of fields) panel(face, h, d);
}
function build(out, d) {
  const target = out;
  out = {
    addTriangle(...args) {
      const p = args[2].map((q) => q.map(Math.fround));
      // Aperture clipping can collapse tiny slivers at the final Float32 boundary.
      if (
        Math.hypot(
          ...cross(
            p[1].map((v, k) => v - p[0][k]),
            p[2].map((v, k) => v - p[0][k]),
          ),
        ) < 1e-7
      )
        return;
      target.addTriangle(args[0], args[1], p, args[3], args[4], args[5]);
    },
  };
  const face = writer(out, d),
    fields = beijingJosephFields(d),
    holes = fields.filter((h) =>
      d === 0 ? h.shape === 'circle' : d >= 2 || h.kind === 'door' || h.shape === 'circle',
    ),
    cut = writer(
      masked(
        out,
        holes.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  shell(out, d, main, footing, 12.7, holes, 'wall');
  cap(cut, main, 12.7, 'roof');
  gable(cut, plans.nave, 12.7, 17.2, 'roof', 0);
  hip(cut, plans.rear, 12.7, 15.3, 'roof', 0);
  shell(out, d, plans.front, footing, 16.4, holes, 'wall');
  cap(cut, plans.front, 16.4, 'roof');
  if (d >= 1) {
    for (const h of fields) panel(face, h, d);
    frontDetails(face, d);
  }
  if (d >= 2) {
    band(face, plans.nave, 12.5, 0.23, 'trim', 1.018);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const x = -25.2 + i * 5.2,
          r = R(x - 0.25, side > 0 ? 10.4 : -11.02, x + 0.25, side > 0 ? 11.02 : -10.4);
        solid(face, r, footing, 12.7, 'wall');
        for (const y of [1.4, 12.2, 12.65]) band(face, r, y, 0.18, 'trim', 1.15);
      }
    }
  }
  // Broad entrance steps follow the picture-led floor; exact host pavement joins remain unverified.
  const count = d === 0 ? 1 : 3;
  for (let i = 0; i < count; i++) {
    const x = -34.5 + i * 0.7,
      top = (floor * (i + 1)) / count;
    solid(
      face,
      R(x, -11.1, -32.1, 11.1),
      (p) => Math.min(-0.25, beijingJosephGround(...p) - 0.25),
      top - floor,
      'accent',
    );
  }
  buildTowers(out, face, d);
  // Cover the reversible viewer ground opening and fit its perimeter to retained DEM samples.
  const paving = '#aaa59a'
      .slice(1)
      .match(/../g)
      .map((n) => {
        const v = parseInt(n, 16) / 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      }),
    pave = (slot, p, n) => face(slot, p, n, paving),
    outer = plans.groundOuter,
    inner = plans.groundInner;
  cap(pave, inner, -floor, 'accent');
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      count = Math.ceil(Math.hypot(outer[j][0] - outer[i][0], outer[j][1] - outer[i][1]) / 3);
    for (let k = 0; k < count; k++) {
      const a = lerp(inner[i], inner[j], k / count),
        b = lerp(inner[i], inner[j], (k + 1) / count),
        c = lerp(outer[i], outer[j], k / count),
        z = lerp(outer[i], outer[j], (k + 1) / count);
      pave(
        'accent',
        [
          [a[0], 0, a[1]],
          [b[0], 0, b[1]],
          [z[0], beijingJosephGround(...z), z[1]],
          [c[0], beijingJosephGround(...c), c[1]],
        ],
        [0, 1, 0],
      );
    }
  }
}
export const buildBeijingJosephSkyline = (o) => build(o, 0),
  buildBeijingJosephDistrict = (o) => build(o, 1),
  buildBeijingJosephStreet = (o) => build(o, 2),
  buildBeijingJosephCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const beijingJosephStudy = {
  id: 'st_josephs_church_beijing',
  key: 'st_joseph_s_church_beijing',
  title: "St. Joseph's Church, Beijing",
  category: 'cathedral',
  wikidataId: 'Q1064185',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID whole11 current raw points and earlier12 distinct whole points/multilingual identity retained.No height tags/parts or dimension facts.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0.Linked photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing cached256-square brick,continuous limestone,standing-seam metal,plain wood and ashlar graphs serve seven merged groups.Gray brick and pale trim,gray faceted caps,subdued wood/louver panels and blue-grey glazing use linear tints and metric UVs.Flat architectural normals.No embedded images,reference-photo textures,unique facade maps or baked lighting.',
  importReason:
    'Preserve three domed/crossed west towers,raised central paired-louver stage,two-tier brick facade/rose/three portals,long arched hall and mapped irregular rear in four browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    rec.groundOpeningBasis,
    'Medium-fi exterior from three inspected2007/2016 front/side pictures and standard viewer PMTiles/DEM only.Hidden roof/rear partitions and all heights are estimates.Fine carved figures,scrollwork,inscriptions,stained-glass art,small dentils,drains,complete interiors/bells and engineering are approximate or excluded.Dark belfry/lantern panels are louver/glass backing,not claims of open air.Current finish,exact terrain joins and physical-device timing unverified.',
    'Skyline retains three domed towers/crosses,raised central stage,two-tier front,long hall and irregular rear.District adds shared surfaces and simplified facade/window/louver rhythm.Street adds actual portal/window recesses,paired side lights,rose cross,buttress-pilasters,drum oculi and trim.Closeup/master refine dome ribs,selected column/capital/plaque/medallion and louver rhythms.Regional neighboring shophouses are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('whole-western-three-tower-front', [-70, 22, 0], [-30, 13, 0]),
    cam('three-portals-and-central-rose', [-51, 11, 9], [-32, 8, 0]),
    cam('central-drum-dome-and-cross', [-47, 29, 17], [-29, 22, 0]),
    cam('southern-arched-hall-and-buttresses', [-4, 19, 48], [-3, 8, 10.5]),
    cam('irregular-eastern-rear-and-roof', [67, 34, -37], [16, 11, 0]),
    cam('roof-and-signed-plan', [0, 125, 0.1], [0, 12, 0]),
  ],
};

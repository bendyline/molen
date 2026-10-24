/** Mdina Cathedral: asymmetric arcaded marble front, tiled cross nave and southwest campanile. */
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
  '../../../content/worldgen/source/places/sq/sq6/st_pauls_cathedral_mdina/',
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
  wall: '#d9c49e',
  spire: '#8e8175',
  trim: '#e9d7b2',
  roof: '#bcb39e',
  door: '#71533c',
  glass: '#414844',
  accent: '#454a47',
  clock: '#ad615b',
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
const footing = (p) => Math.min(floor - 0.3, mdinaGround(...p) - 0.35);
export function mdinaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Mdina Cathedral footing outside retained terrain');
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
const _R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  _role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline;
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
function _gable(face, r, eave, top, slot = 'roof', axis = 0) {
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
function _inside(p, r) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      v = !v;
  }
  return v;
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
function _panel(face, h, d) {
  pane(face, h, d, d >= 2 ? -0.75 : 0.07, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, 0.35, 'trim', 0.09);
  if (h.kind === 'door') archBand(face, h, d, 0.7, 'trim', 0.14);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (h.kind === 'door') {
    beam(
      face,
      p.point(0, h.bottom, -0.68 * sg),
      p.point(0, h.bottom + h.spring, -0.68 * sg),
      0.12,
      'accent',
    );
    return;
  }
  for (const u of [-0.22, 0.22])
    beam(
      face,
      p.point(h.width * u, h.bottom, -0.66 * sg),
      p.point(h.width * u, h.bottom + h.spring, -0.66 * sg),
      0.11,
      'trim',
    );
  if (d >= 3) {
    for (const off of [-0.27, 0.27]) {
      const y = h.bottom + h.spring + 0.45;
      beam(
        face,
        p.point(h.width * off, y, -0.64 * sg),
        p.point(0, h.bottom + h.height - 0.35, -0.64 * sg),
        0.11,
        'trim',
      );
    }
  }
}
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline,
  main = role('main'),
  plans = rec.plans,
  est = rec.estimated;
const circle = (p, r, n = 8, phase = 0) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * 2 * Math.PI) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    }),
  drum = circle(est.domeCenter, est.domeRadius, 8, est.domePhase),
  towers = ['towerNorth', 'towerSouth'].map((name) => ({ name, ring: role(name) }));
function towerFields() {
  return towers.flatMap(({ name, ring }) =>
    ring.map((_, i) => {
      const f = faceFrame(ring, i);
      return hole(
        `${name}-bell-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        2.6,
        20.8,
        3.8,
        2.5,
        'round',
        4.2,
      );
    }),
  );
}
export const mdinaBelfryFields = towerFields;
function fields() {
  const a = [
    {
      ...hole('front-central-door', [-28.15, 0], [0, 1], [-1, 0], 3.25, 0.3, 6, 6, 'rect', 3),
      kind: 'door',
    },
    ...[-12.65, 12.65].map((z) => ({
      ...hole(`front-side-door-${z}`, [-28.15, z], [0, 1], [-1, 0], 2.1, 0.3, 4.5, 4.5, 'rect', 3),
      kind: 'door',
    })),
    hole('front-upper-window', [-28.15, 0], [0, 1], [-1, 0], 3.4, 12, 5.7, 4, 'round', 3),
  ];
  for (let i = 0; i < 8; i++) {
    const f = faceFrame(drum, i);
    a.push(
      hole(`drum-${i}`, lerp(f.a, f.b, 0.5), f.axis, f.normal, 3.4, 20.55, 3.75, 2.05, 'round', 3),
    );
  }
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const x = -17 + i * 11.2;
      const z = side < 0 ? (x > 15 ? -10.36 : -16.66) : 16.68;
      a.push(hole(`side-${side}-${i}`, [x, z], [1, 0], [0, side], 2.1, 5, 4.2, 3.15, 'round', 3));
      if (i !== 0 && i !== 2)
        a.push(
          hole(
            `upper-side-${side}-${i}`,
            [x, side * 6.4],
            [1, 0],
            [0, side],
            2.6,
            14.1,
            2.85,
            1.55,
            'round',
            3,
          ),
        );
    }
  for (const z of [-3.9, 3.9])
    a.push(hole(`east-upper-${z}`, [28.19, z], [0, 1], [1, 0], 2.0, 13.2, 3.3, 2.3, 'round', 3));
  return a;
}
export const mdinaFields = fields;
function panel(face, h, d) {
  pane(face, h, d, d >= 2 ? -0.6 : 0.06, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, 0.24, 'trim', 0.09);
  if (d >= 3) archBand(face, h, d, 0.44, 'trim', 0.14);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (h.kind === 'door') {
    beam(
      face,
      p.point(0, h.bottom, -0.58 * sg),
      p.point(0, h.bottom + h.height, -0.58 * sg),
      0.1,
      'accent',
    );
    return;
  }
  for (const u of [-0.23, 0.23])
    beam(
      face,
      p.point(u * h.width, h.bottom, -0.57 * sg),
      p.point(u * h.width, h.bottom + h.spring, -0.57 * sg),
      0.1,
      'trim',
    );
  if (d >= 3)
    for (const f of [0.25, 0.5, 0.75])
      beam(
        face,
        p.point(-h.width / 2, h.bottom + h.spring * f, -0.57 * sg),
        p.point(h.width / 2, h.bottom + h.spring * f, -0.57 * sg),
        0.09,
        'trim',
      );
}
function pediment(face, p, n, axis, y, width, height, d) {
  const pt = (u, v, off = 0.15) => [
    p[0] + axis[0] * u + n[0] * off,
    floor + v,
    p[1] + axis[1] * u + n[1] * off,
  ];
  const front = [pt(-width / 2, y), pt(width / 2, y), pt(0, y + height)],
    back = front.map((p) => [p[0] - n[0] * 0.5, p[1], p[2] - n[1] * 0.5]);
  face('wall', front, [n[0], 0, n[1]]);
  face('wall', back, [-n[0], 0, -n[1]]);
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    face('trim', [front[i], front[j], back[j], back[i]]);
  }
  if (d >= 1) {
    for (const [a, b] of [
      [pt(-width / 2, y), pt(0, y + height)],
      [pt(0, y + height), pt(width / 2, y)],
      [pt(-width / 2, y), pt(width / 2, y)],
    ])
      beam(face, a, b, d >= 2 ? 0.24 : 0.28, 'trim');
  }
}
function finial(face, p, b, t, d) {
  const r = circle(p, 0.27, d >= 2 ? 8 : 4);
  solid(face, r, b, t - 0.5, 'trim');
  beam(face, at(p, t - 0.5), at(p, t), 0.1, 'accent');
  beam(
    face,
    [p[0], floor + t - 0.32, p[1] - 0.25],
    [p[0], floor + t - 0.32, p[1] + 0.25],
    0.1,
    'accent',
  );
}
function knob(face, p, b, d) {
  profile(
    face,
    circle(p, 0.22, d >= 3 ? 8 : 4),
    [
      [b, 0.6],
      [b + 0.16, 1],
      [b + 0.42, 0.8],
      [b + 0.55, 0.05],
    ],
    'trim',
  );
}
function clock(face, p, axis, n, y, r, d) {
  const count = d >= 3 ? 24 : d >= 2 ? 16 : 8,
    pt = (u, v, off = 0.12) => [
      p[0] + axis[0] * u + n[0] * off,
      floor + y + v,
      p[1] + axis[1] * u + n[1] * off,
    ];
  face(
    'glass',
    Array.from({ length: count }, (_, i) => {
      const a = (i * Math.PI * 2) / count;
      return pt(r * Math.cos(a), r * Math.sin(a));
    }),
    [n[0], 0, n[1]],
    [0.78, 0.75, 0.64],
  );
  beam(face, pt(0, 0, 0.16), pt(0, r * 0.72, 0.16), 0.08, 'accent');
  beam(face, pt(0, 0, 0.16), pt(-r * 0.6, r * 0.12, 0.16), 0.08, 'accent');
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      beam(
        face,
        pt(r * 0.78 * Math.cos(a), r * 0.78 * Math.sin(a), 0.17),
        pt(r * 0.92 * Math.cos(a), r * 0.92 * Math.sin(a), 0.17),
        0.055,
        'accent',
      );
    }
}
function facade(face, d) {
  const front = [-28.2, 0],
    n = [-1, 0],
    axis = [0, 1];
  pediment(face, front, n, axis, 20, 18.8, 3.3, d);
  finial(face, [-28.35, 0], 23.3, 24.3, d);
  if (d === 0) return;
  for (const y of [0.4, 10.6, 11.25, 19.6])
    solid(face, R(-28.48, -16.7, -27.95, 16.7), y, y + 0.28, 'trim');
  for (const z of [-16.1, -9.4, -7.7, -5.9, 5.9, 7.7, 9.4, 16.1])
    for (const [b, t] of [
      [0.6, 10.5],
      [11.6, 19.5],
    ]) {
      solid(face, R(-28.57, z - 0.25, -28.0, z + 0.25), b, t, 'trim');
      if (d >= 2) {
        solid(face, R(-28.7, z - 0.44, -27.98, z + 0.44), b, b + 0.4, 'trim');
        solid(face, R(-28.78, z - 0.5, -27.98, z + 0.5), t - 0.4, t, 'trim');
      }
    }
  for (const h of fields().filter((h) => h.name.startsWith('front'))) {
    const y = h.bottom - floor + h.height + 0.65;
    pediment(face, h.center, h.normal, h.axis, y, h.width + 1.55, h.kind === 'door' ? 1.2 : 0.9, d);
  }
  for (const t of towers) {
    const f = edge(t.ring, [-1, 0]),
      p = lerp(f.a, f.b, 0.5);
    clock(face, p, f.axis, f.normal, 18.1, 1.12, d);
  }
  // Oval relief and heraldic shield are simplified stone forms, without invented inscriptions.
  if (d >= 2) {
    const h = hole('front-crest', [-28.34, 0], [0, 1], [-1, 0], 1.45, 8.5, 1.9, 0.95, 'round', 1);
    pane(face, h, d, 0.2, 'trim');
    archBand(face, h, d, 0.2, 'trim', 0.24);
  }
  for (let i = 0; i < 4; i++)
    solid(face, R(-30.9 + i * 0.6, -16.45, -27.9, 16.45), footing, 0.08 + i * 0.08, 'trim');
}
function towerTop(face, out, d, t, holes) {
  const r = t.ring;
  if (d >= 2) shell(out, d, r, 20, 25.2, holes, 'wall', scaled(r, 0.56));
  else sides(face, r, 20, 25.2, 'wall');
  cap(face, r, 20, 'roof');
  cap(face, r, 25.2, 'trim', [scaled(r, 0.56)]);
  if (d >= 1)
    for (const h of holes) {
      if (d >= 2) archBand(face, h, d, 0.3, 'trim', 0.12);
      else pane(face, h, d, 0.06, 'glass');
    }
  profile(
    face,
    r,
    [
      [25.2, 1.04],
      [25.55, 1.04],
      [26.05, 0.83],
      [26.3, 0.8],
    ],
    'trim',
  );
  profile(
    face,
    r,
    [
      [26.3, 0.8],
      [26.8, 0.63],
      [27.5, 0.45],
      [28.2, 0.29],
      [28.85, 0.1],
      [29, 0.07],
    ],
    'trim',
  );
  finial(face, center(r), 29, 30, d);
  if (d >= 1) {
    for (const y of [10.6, 11.25, 19.6]) band(face, r, y, 0.28, 'trim', 1.025);
    for (const p of r) {
      solid(face, R(p[0] - 0.2, p[1] - 0.2, p[0] + 0.2, p[1] + 0.2), 20, 24.8, 'trim');
      knob(face, p, 25.2, d);
    }
  }
  if (d >= 3) {
    for (let i = 0; i < r.length; i++) {
      const p = lerp(center(r), r[i], 0.7),
        q = lerp(center(r), r[i], 0.35);
      beam(face, at(p, 26.3), at(q, 27.7), 0.22, 'trim');
    }
  }
}
function dome(face, out, d, holes) {
  if (d >= 2) shell(out, d, drum, 18, 25, holes);
  else sides(face, drum, 18, 25, 'wall');
  const domeRing = scaled(drum, 1.04);
  profile(
    face,
    domeRing,
    [
      [25, 1],
      [25.45, 0.98],
      [26.15, 0.88],
      [26.8, 0.72],
      [27.5, 0.45],
      [27.9, 0.18],
    ],
    'spire',
  );
  if (d >= 1) {
    band(face, drum, 24.6, 0.4, 'trim', 1.07);
    band(face, drum, 19.9, 0.3, 'trim', 1.02);
    for (const p of drum) {
      const r = R(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25);
      solid(face, r, 20, 24.6, 'trim');
      if (d >= 2) {
        solid(face, scaled(r, 1.5), 24.25, 24.6, 'trim');
        const path = [
          [25.2, 1],
          [25.8, 0.92],
          [26.5, 0.8],
          [27.15, 0.59],
          [27.8, 0.25],
        ];
        for (let i = 1; i < path.length; i++) {
          const a = lerp(est.domeCenter, p, path[i - 1][1]),
            b = lerp(est.domeCenter, p, path[i][1]);
          beam(face, at(a, path[i - 1][0]), at(b, path[i][0]), 0.22, 'trim');
        }
      }
    }
  }
  const lr = circle(est.domeCenter, 1.2, 8, Math.PI / 8);
  solid(face, lr, 27.8, 29.05, 'trim');
  profile(
    face,
    lr,
    [
      [29.05, 1.06],
      [29.2, 0.92],
      [29.4, 0.18],
    ],
    'spire',
  );
  finial(face, est.domeCenter, 29.4, 30, d);
  if (d >= 1)
    for (let i = 0; i < lr.length; i += d >= 2 ? 1 : 2) {
      const f = faceFrame(lr, i),
        h = hole(
          `lantern-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          0.55,
          28.0,
          0.85,
          0.85,
          'rect',
          1,
        );
      pane(face, h, d, 0.05, 'glass');
    }
}
function build(target, d = 4) {
  const out = {
      addTriangle(slot, ref, p, n, uv, col) {
        p = p.map((v) => v.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-10
        )
          return;
        target.addTriangle(slot, ref, p, n, uv, col);
      },
    },
    face = writer(out, d),
    hs = fields(),
    bell = towerFields(),
    wall = (r, b, t) => {
      if (d >= 2) shell(out, d, r, b, t, hs);
      else sides(face, r, b, t, 'wall');
    };
  for (const p of plans.base) wall(p.outline, footing, 12);
  cap(face, main, 0.2, 'wall');
  for (const p of plans.aisles) {
    cap(face, p.outline, 12.7, 'roof', p.holes);
    sides(face, p.outline, 12, 13.2, 'wall');
  }
  for (const p of [...plans.nave, ...plans.transept]) {
    wall(p.outline, 12, 17.8);
    cap(face, p.outline, 17.8, 'roof');
    hip(face, p.outline, 17.8, 20, 'roof', 0);
  }
  for (const p of plans.front) {
    wall(p.outline, 12, 20);
    cap(face, p.outline, 20, 'roof');
  }
  for (const t of towers) {
    wall(t.ring, footing, 20);
    towerTop(
      face,
      out,
      d,
      t,
      bell.filter((h) => h.name.startsWith(t.name)),
    );
  }
  dome(
    face,
    out,
    d,
    hs.filter((h) => h.name.startsWith('drum')),
  );
  facade(face, d);
  if (d >= 1) {
    for (const h of hs) panel(face, h, d);
    for (const n of ['towerNorth', 'towerSouth']) band(face, role(n), 0.5, 0.35, 'trim', 1.015);
    if (d >= 2)
      for (const side of [-1, 1])
        for (let i = 0; i < 5; i++) {
          const x = -20 + i * 10.5,
            z = side < 0 ? (x > 15 ? -10.36 : -16.65) : 16.68;
          solid(face, R(x - 0.25, z - 0.25, x + 0.25, z + 0.25), 0.4, 12.7, 'trim');
        }
  }
}
export const buildMdinaSkyline = (o) => build(o, 0),
  buildMdinaDistrict = (o) => build(o, 1),
  buildMdinaStreet = (o) => build(o, 2),
  buildMdinaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const mdinaStudy = {
  id: 'st_pauls_cathedral_mdina',
  key: 'st_paul_s_cathedral_mdina',
  title: "St. Paul's Cathedral, Mdina",
  category: 'cathedral',
  wikidataId: 'Q1630170',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID whole main, circular dome and two front towers. Western twin facade towers sign the retained axis; raw plans/tags retained.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing cached256-square ashlar, limestone, granite, standing-seam metal and plain wood graphs. Warm Maltese limestone, pale stone trim, muted weathered metal dome and flat roof use linear tints/metric UVs/flat architectural normals. Clock faces/hands, dark glass and sparse accents use geometric PBR colors. Zero embedded images or bespoke facade maps.',
  importReason:
    'Four authored browser tiers retain paired curved clock/bell towers, central Baroque pediment, three portals, windowed octagonal drum/low dome/lantern and full signed mapped envelope.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from inspected2005 facade,2024 dome/drum and2021 rear plus standard viewer PMTiles/DEM only. Exact carving/heraldry/inscriptions, full clock numerals, statues, sculptural spire scrolls, bells/interiors, hidden rear windows/roof joins and surveyed plaza/thresholds remain approximate or excluded. Physical phone/laptop timings pending.',
    'Skyline keeps paired curved stone tower spires, central pediment, octagonal drum/dome/lantern and low nave/aisle forms. District adds shared surfaces, clock faces, flat glazing/belfry bays and selected trim. Street adds actual recesses/open belfries, capitals/pilasters, larger mullions and dome ribs. Closeup/master refine surrounds, window bars, spire ribs and clock marks. Small lantern windows remain flat fields. Synthetic cottages are a review fixture.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-three-portals-and-pilasters', [-66, 16, -2], [-27, 13, 0]),
    cam('paired-clocks-belfries-and-stone-spires', [-61, 39, -30], [-25, 24, 0]),
    cam('octagonal-drum-dome-and-lantern', [35, 42, 31], [7, 27, -1]),
    cam('north-side-and-aisle', [-4, 24, -60], [0, 13, -9]),
    cam('east-roof-and-plateau-footings', [67, 34, 41], [17, 15, 0]),
    cam('roof-and-signed-plan', [0, 111, 1], [0, 15, 0]),
  ],
};

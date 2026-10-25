/** Samtavisi: stepped ashlar body,conical slit drum and deeply recessed eastern cross facade. */
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
  '../../../content/worldgen/source/places/sz/szr/samtavisi_cathedral/',
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
  wall: '#e5d7b9',
  spire: '#9a8b70',
  trim: '#e4d7bd',
  roof: '#a96b51',
  door: '#71533c',
  glass: '#414844',
  accent: '#434b49',
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
const footing = (p) => Math.min(floor - 0.3, samtavisiGround(...p) - 0.35);
export function samtavisiGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Samtavisi Cathedral footing outside retained terrain');
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
    // Carved arcade ribs have depth, so their curves remain legible under Earth light.
    face(slot, [
      p.point(...outer[i], 0),
      p.point(...outer[j], 0),
      p.point(...outer[j], offset),
      p.point(...outer[i], offset),
    ]);
    face(slot, [
      p.point(...inner[i], offset),
      p.point(...inner[j], offset),
      p.point(...inner[j], 0),
      p.point(...inner[i], 0),
    ]);
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
const main = rec.main.polygons[0].outline,
  plans = rec.plans,
  est = rec.estimated;
const circle = (p, r, n = 12, phase = Math.PI / 12) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    }),
  drum = circle(est.drumCenter, est.drumRadius);
const east = edge(main, [1, 0]),
  west = edge(main, [-1, 0]),
  south = edge(main, [0, 1]),
  north = edge(main, [0, -1]);
const on = (f, u) => {
  const p = lerp(f.a, f.b, 0.5);
  return [p[0] + f.axis[0] * u, p[1] + f.axis[1] * u];
};
function fields(d = 4) {
  const hs = [];
  for (const z of est.eastNiches) {
    const p = [(east.a[0] + east.b[0]) / 2, z];
    hs.push({
      ...hole(`east-V-niche-${z}`, p, [0, 1], [1, 0], 1.65, 0.15, 10.65, 9.7, 'pointed', 3.5),
      kind: 'niche',
    });
  }
  if (d >= 1) {
    hs.push({
      ...hole('east-slit', on(east, 0), east.axis, east.normal, 0.58, 3.35, 4.5, 4.21, 'round', 3),
      kind: 'window',
    });
    const sr = edge(plans.cross, [0, 1]),
      nr = edge(plans.cross, [0, -1]);
    for (const [name, f] of [
      ['south', sr],
      ['north', nr],
    ])
      hs.push({
        ...hole(`${name}-high-slit`, on(f, 0), f.axis, f.normal, 0.67, 7.2, 5.0, 4.665, 'round', 3),
        kind: 'window',
      });
    hs.push({
      ...hole(
        'south-door',
        [est.southDoorX, (south.a[1] + south.b[1]) / 2],
        [1, 0],
        [0, 1],
        1.25,
        0.25,
        2.55,
        1.925,
        'round',
        3,
      ),
      kind: 'door',
    });
    hs.push({
      ...hole('west-door', on(west, 0), west.axis, west.normal, 1.5, 0.25, 2.8, 2.05, 'round', 3),
      kind: 'door',
    });
    hs.push({
      ...hole(
        'west-high-slit',
        on(west, 0),
        west.axis,
        west.normal,
        0.68,
        8.6,
        3.8,
        3.46,
        'round',
        3,
      ),
      kind: 'window',
    });
    for (let i = 0; i < 12; i++) {
      const f = faceFrame(drum, i);
      hs.push({
        ...hole(`drum-slit-${i}`, on(f, 0), f.axis, f.normal, 0.4, 18.1, 4.2, 4, 'round', 2),
        kind: 'window',
        drum: true,
      });
    }
  }
  return hs;
}
export const samtavisiFields = fields;
function panel(face, h, d) {
  if (h.kind === 'niche') {
    const q = prepareOpening(h, 0, d),
      sg = Math.sign(-q.axis[1] * h.normal[0] + q.axis[0] * h.normal[1]);
    // V-section masonry recess: shallow sides meet at the deeper center line.
    const half = h.width / 2,
      y0 = h.bottom,
      ys = y0 + h.spring,
      yt = y0 + h.height;
    const P = (u, y, depth) => q.point(u, y, -depth * sg);
    face(
      'wall',
      [P(-half, y0, 0.03), P(0, y0, 1.15), P(0, yt, 1.15), P(-half, ys, 0.03)],
      [h.normal[0], 0, h.normal[1]],
    );
    face(
      'wall',
      [P(0, y0, 1.15), P(half, y0, 0.03), P(half, ys, 0.03), P(0, yt, 1.15)],
      [h.normal[0], 0, h.normal[1]],
    );
    face('wall', [P(-half, y0, 0.03), P(half, y0, 0.03), P(0, y0, 1.15)], [0, 1, 0]);
    if (d >= 1) archBand(face, h, d, 0.18, 'trim', 0.09);
    return;
  }
  pane(face, h, d, -0.58, h.kind === 'door' ? 'door' : 'glass');
  if (d >= 2) {
    archBand(face, h, d, 0.16, 'trim', 0.075);
    if (d >= 3 && !h.drum) archBand(face, h, d, 0.31, 'trim', 0.12);
  }
}
function rosette(face, p, axis, n, y, r, d) {
  const N = d >= 3 ? 16 : 8,
    pt = (rad, a) => [
      p[0] + axis[0] * Math.cos(a) * rad + n[0] * 0.14,
      floor + y + Math.sin(a) * rad,
      p[1] + axis[1] * Math.cos(a) * rad + n[1] * 0.14,
    ];
  for (let i = 0; i < N; i++) {
    const a = (i * Math.PI * 2) / N,
      b = ((i + 1) * Math.PI * 2) / N;
    face('trim', [pt(r, a), pt(r, b), pt(r * 0.63, b), pt(r * 0.63, a)], [n[0], 0, n[1]]);
  }
  if (d >= 2)
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      beam(face, pt(r * 0.17, a), pt(r * 0.55, a), 0.08, 'trim');
    }
}
function facadeDecor(face, d) {
  const pt = (u, y, off = 0.16) => [
    on(east, u)[0] + east.normal[0] * off,
    floor + y,
    on(east, u)[1] + east.normal[1] * off,
  ];
  beam(face, pt(0, 8.7), pt(0, 14.5), d === 0 ? 0.28 : 0.23, 'trim');
  beam(face, pt(-1.55, 12.25), pt(1.55, 12.25), d === 0 ? 0.28 : 0.23, 'trim');
  if (d === 0) return;
  for (const u of [-3.1, 3.1]) rosette(face, on(east, u), east.axis, east.normal, 10.3, 0.54, d);
  rosette(face, on(east, 0), east.axis, east.normal, 8.7, 0.39, d);
  for (const u of [-0.65, 0.65]) {
    const yy = 1.65,
      w = 0.64,
      h = 0.83;
    for (const [a, b] of [
      [
        [-w, 0],
        [0, h],
      ],
      [
        [0, h],
        [w, 0],
      ],
      [
        [w, 0],
        [0, -h],
      ],
      [
        [0, -h],
        [-w, 0],
      ],
    ])
      beam(face, pt(u + a[0], yy + a[1]), pt(u + b[0], yy + b[1]), 0.17, 'trim');
  }
  for (const [u, w, b, h, s] of [
    [0, 7.5, 0.45, 14.6, 10.85],
    [-8, 2.45, 0.4, 6.6, 5.375],
    [8, 2.45, 0.4, 6.6, 5.375],
  ]) {
    const a = hole('east-blind', on(east, u), east.axis, east.normal, w, b, h, s, 'round', 1);
    archBand(face, a, d, 0.16, 'trim', 0.1);
    if (d >= 3) archBand(face, a, d, 0.3, 'trim', 0.14);
  }
  // Slit field and cross have an individual geometric frame, not a facade photograph.
  for (const u of [-0.74, 0.74]) beam(face, pt(u, 3.0), pt(u, 8.1), 0.15, 'trim');
  beam(face, pt(-0.74, 3), pt(0.74, 3), 0.15, 'trim');
  beam(face, pt(-0.74, 8.1), pt(0.74, 8.1), 0.15, 'trim');
  for (const f of [edge(plans.cross, [0, 1]), edge(plans.cross, [0, -1])]) {
    const p = on(f, 0);
    rosette(face, p, f.axis, f.normal, 14.1, 0.66, d);
    for (const u of [-2.35, 2.35]) {
      const h = hole(
        'cross-blind',
        on(f, u),
        f.axis,
        f.normal,
        2.05,
        0.5,
        12.7,
        11.675,
        'round',
        1,
      );
      archBand(face, h, d, 0.13, 'trim', 0.085);
    }
  }
  if (d >= 2)
    for (const f of [south, north])
      for (const x of [-10.7, -7.9, -5.1, 7.9, 10.7]) {
        const p = [x, (f.a[1] + f.b[1]) / 2],
          h = hole(`lower-blind-${x}`, p, [1, 0], f.normal, 2.45, 0.25, 6.65, 5.425, 'round', 1);
        archBand(face, h, d, 0.13, 'trim', 0.09);
        if (d >= 3) {
          archBand(face, h, d, 0.26, 'trim', 0.14);
          for (const u of [-1.31, 1.31]) {
            const q = [p[0] + u, p[1] + f.normal[1] * 0.15];
            solid(face, circle(q, 0.095, 4, 0), 0.4, 5.6, 'trim');
          }
        }
      }
  if (d >= 2)
    for (const f of [edge(plans.nave, [0, 1]), edge(plans.nave, [0, -1])])
      for (const x of [-10.5, -8.3, -6.1, 7.8, 10]) {
        const h = hole(
          'upper-blind',
          [x, (f.a[1] + f.b[1]) / 2],
          [1, 0],
          f.normal,
          1.8,
          11.7,
          1.65,
          0.75,
          'round',
          1,
        );
        archBand(face, h, d, 0.095, 'trim', 0.08);
      }
}
function build(target, d = 4) {
  const out = {
      addTriangle(...args) {
        const p = args[2].map((q) => q.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-7
        )
          return;
        target.addTriangle(...args);
      },
    },
    hs = fields(d),
    whole = hs.filter((h) => !h.drum),
    face = writer(out, d),
    cut = writer(
      masked(
        out,
        whole.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
      ),
      d,
    );
  shell(out, d, main, footing, 8.8, whole);
  // Roof shoulders have their own triangular end faces. All roof and trim triangles
  // are clipped by the same niches, so no hidden cap fills an apparent opening.
  const X = [Math.min(...main.map((p) => p[0])), Math.max(...main.map((p) => p[0]))],
    Z = [Math.min(...main.map((p) => p[1])), Math.max(...main.map((p) => p[1]))];
  for (const side of [-1, 1]) {
    const zi = side * 4.4,
      zo = side < 0 ? Z[0] : Z[1];
    cut(
      'roof',
      [at([X[0], zo], 8.8), at([X[1], zo], 8.8), at([X[1], zi], 11.6), at([X[0], zi], 11.6)],
      [0, 1, 0],
    );
    for (const [x, n] of [
      [X[0], [-1, 0, 0]],
      [X[1], [1, 0, 0]],
    ])
      cut('wall', [at([x, zo], 8.8), at([x, zi], 8.8), at([x, zi], 11.6)], n);
  }
  shell(out, d, plans.nave, 8.7, 13.8, whole);
  gable(cut, plans.nave, 13.8, 16.5);
  shell(out, d, plans.cross, 8.7, 13.8, whole);
  gable(cut, plans.cross, 13.8, 16.5, 'roof', 1);
  const dh = hs.filter((h) => h.drum);
  shell(out, d, drum, 15.8, 24.3, dh);
  cap(face, drum, 24.3, 'wall');
  profile(
    face,
    scaled(drum, 1.08),
    [
      [24.25, 1],
      [24.6, 1],
      [30.5, 0.018],
    ],
    'spire',
  );
  beam(face, at(est.drumCenter, 30.45), at(est.drumCenter, 31.4), d === 0 ? 0.14 : 0.1, 'accent');
  if (d >= 1)
    beam(
      face,
      [est.drumCenter[0], floor + 31.07, -0.3],
      [est.drumCenter[0], floor + 31.07, 0.3],
      0.1,
      'accent',
    );
  for (const h of hs) panel(face, h, d);
  facadeDecor(face, d);
  if (d >= 1) {
    band(cut, drum, 23.9, 0.3, 'trim', 1.05);
    band(cut, drum, 16.45, 0.22, 'trim', 1.025);
    for (const r of [plans.nave, plans.cross]) band(cut, r, 13.5, 0.28, 'trim', 1.014);
    if (d >= 2)
      for (let i = 0; i < drum.length; i++) {
        const f = faceFrame(drum, i),
          h = hole(
            `drum-blind-${i}`,
            on(f, 0),
            f.axis,
            f.normal,
            f.length - 0.26,
            17.25,
            6.15,
            5.25,
            'round',
            1,
          );
        archBand(face, h, d, 0.105, 'trim', 0.08);
        if (d >= 3) solid(face, circle(f.a, 0.085, 4, 0), 17.35, 23.6, 'trim');
      }
    // Small entrance landing with two grounded outer steps. Exact threshold/grade is estimated.
    for (const [x, z, n, w] of [
      [est.southDoorX, (south.a[1] + south.b[1]) / 2, [0, 1], 2.1],
      [(west.a[0] + west.b[0]) / 2, 0, [-1, 0], 2.2],
    ])
      for (let i = 0; i < 3; i++) {
        const a = [x + n[0] * (0.1 + i * 0.43), z + n[1] * (0.1 + i * 0.43)],
          u = [-n[1], n[0]],
          r = [
            [-w / 2, 0],
            [w / 2, 0],
            [w / 2, 0.49],
            [-w / 2, 0.49],
          ].map(([q, t]) => [a[0] + u[0] * q + n[0] * t, a[1] + u[1] * q + n[1] * t]);
        solid(face, r, footing, 0.21 - i * 0.14, 'trim');
      }
  }
}
export const buildSamtavisiSkyline = (o) => build(o, 0),
  buildSamtavisiDistrict = (o) => build(o, 1),
  buildSamtavisiStreet = (o) => build(o, 2),
  buildSamtavisiCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const samtavisiStudy = {
  id: 'samtavisi_cathedral',
  key: 'samtavisi_cathedral',
  title: 'Samtavisi Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1269808',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID current four-vertex whole only,no separate component controls;all roof/drum/facade partitions are picture estimates.',
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
    'Five existing cached256-square ashlar,limestone,flat tile,standing-seam metal and plain wood graphs.Linear tints,metric UVs,flat normals.Seven groups with local geometric glass/cross PBR.No embedded images,unique facade maps,baked shadows or reflections.',
  importReason:
    'Four browser levels preserve stepped stone body,red cross-gabled roofs,12-sided slit drum/pointed cone and individual carved eastern facade with real V-section niches.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from inspected2010/2019 photographs and2024 distant east context plus standard viewer PMTiles/DEM only.2019 red tile controls lower roof finish over older gray roofs;current finish remains approximate. Separate bell tower,ruins and compound walls remain host content. Fine sculpted interlace/inscriptions/figures,full interiors and exact engineering/thresholds excluded or simplified. Physical phone/laptop measurements pending.',
    'Skyline retains whole body,cross gables,cone and genuine eastern V niches. District adds shared materials,drum slits,door/window recesses,principal eastern cross/blind arches and small landings. Street adds side blind arcades and drum ribs. Closeup/master refine nested shallow stone ribs/rosettes. Synthetic cottages and generic detail crops are QA fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('east-cross-deep-niches-and-diamonds', [37, 16, 8], [13, 8, 0]),
    cam('south-gable-and-blind-arcades', [7, 18, 37], [0, 8, 9]),
    cam('faceted-slit-drum-and-cone', [22, 29, 24], [1.35, 23, 0]),
    cam('southern-western-door-and-steps', [-20, 9, 28], [-8, 2.5, 9.8]),
    cam('estimated-west-north-and-roof-joins', [-37, 26, -28], [0, 11, 0]),
    cam('whole-roof-and-signed-plan', [0, 76, 1], [0, 12, 0]),
  ],
};

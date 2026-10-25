/** St Bavo's Cathedral: stepped west tower, four corner pinnacles and long slate-roofed choir. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/u1/u14/st_bavos_cathedral/',
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
  wall: '#c3baab',
  spire: '#b48c7c',
  trim: '#d9cbb3',
  roof: '#626a70',
  door: '#71533c',
  glass: '#43586d',
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
const footing = (p) => Math.min(floor - 0.3, stBavoGround(...p) - 0.35);
export function stBavoGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error("St Bavo's Cathedral footing outside retained terrain");
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
const control = (n) => rec.controls.find((b) => b.id === rec.roles[n]),
  ring = (n) => control(n).polygons[0].outline,
  point = (f, t = 0.5) => lerp(f.a, f.b, t),
  along = (f, x, k = 0) => point(f, (x - f.a[k]) / (f.b[k] - f.a[k])),
  bounds = (r) => [
    Math.min(...r.map((p) => p[0])),
    Math.min(...r.map((p) => p[1])),
    Math.max(...r.map((p) => p[0])),
    Math.max(...r.map((p) => p[1])),
  ],
  mid = (r) => {
    const b = bounds(r);
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  },
  pins = ['towerSW', 'towerNW', 'towerNE', 'towerSE'],
  pinBounds = bounds(pins.flatMap(ring)),
  base = ring('towerBase'),
  tc = mid(ring('towerUpper')),
  shaft = _R(
    pinBounds[0] - 0.35,
    pinBounds[1] - 0.25,
    Math.max(
      ...ring('nave')
        .filter((p) => p[0] < 0)
        .map((p) => p[0]),
    ),
    pinBounds[3] + 0.25,
  ),
  west = edge(shaft, [-1, 0]),
  portalPoint = [Math.min(...base.map((p) => p[0])) - 0.05, tc[1]],
  nave = ring('nave'),
  transept = ring('transept');
const window = (
  name,
  f,
  p,
  w,
  b,
  h,
  s = h * 0.7,
  kind = 'window',
  shape = 'pointed',
  depth = 6,
) => ({ ...hole(name, p, f.axis, f.normal, w, b, h, s, shape, depth), kind });
export function stBavoShaft() {
  return shaft;
}
export function stBavoFields() {
  const fields = [],
    portalFloor = stBavoGround(...portalPoint) + 0.22 - floor;
  fields.push(
    window(
      'west-vaulted-portal',
      { axis: [0, 1], normal: [-1, 0] },
      portalPoint,
      5.5,
      portalFloor,
      10,
      6.7,
      'portal',
      'pointed',
      11,
    ),
  );
  fields.push(window('west-large-window', west, point(west), 5.8, 13.5, 12.1, 8.6));
  for (let i = 0; i < shaft.length; i++) {
    const f = faceFrame(shaft, i),
      p = point(f);
    for (const [b, h] of [
      [31, 11],
      [47, 11],
    ])
      for (const off of [-1.15, 1.15])
        fields.push(
          window(
            `tower-pair-${i}-${b}-${off}`,
            f,
            p.map((v, k) => v + f.axis[k] * off),
            1.8,
            b,
            h,
            h * 0.72,
          ),
        );
  }
  const upper = ring('towerUpper');
  for (let i = 0; i < upper.length; i++) {
    const f = faceFrame(upper, i);
    if (f.length < 4) continue;
    fields.push(window(`tower-upper-${i}`, f, point(f), 4.1, 64, 12, 8.6));
  }
  for (const name of ['north', 'south']) {
    const normal = [0, name === 'south' ? 1 : -1],
      f = edge(nave, normal);
    for (const x of [-38, -30, -22, -14, 7, 15, 23])
      fields.push(window(`clerestory-${name}-${x}`, f, along(f, x), 3.8, 26.4, 6.5, 4.6));
    for (const [role, xs] of [
      [name === 'north' ? 'aisleNW' : 'aisleSW', [-38, -30, -22, -14]],
      [name === 'north' ? 'aisleNE' : 'aisleSE', [7, 15, 23]],
    ]) {
      const a = edge(ring(role), normal);
      // Low projecting chapels occupy the outer lower wall; aisle fields sit above their roofs.
      for (const x of xs)
        fields.push(window(`aisle-${name}-${x}`, a, along(a, x), 3.2, 14.6, 2.5, 1.65));
    }
    const tr = edge(transept, normal);
    fields.push(window(`transept-${name}-great`, tr, point(tr), 7.0, 10, 21.0, 14.7));
    fields.push(window(`transept-${name}-door`, tr, point(tr), 3.1, 0.2, 6.6, 4.5, 'door'));
  }
  const ap = ring('apse');
  for (let i = 0; i < ap.length; i++) {
    const f = faceFrame(ap, i);
    if (f.normal[0] < 0.15 || point(f)[0] < 32) continue;
    fields.push(
      window(
        `eastern-clerestory-${i}`,
        f,
        point(f),
        Math.min(2.9, f.length * 0.65),
        26.4,
        6.5,
        4.6,
      ),
    );
  }
  const low = coarse(rec.main.polygons[0].outline);
  for (let i = 0; i < low.length; i++) {
    const f = faceFrame(low, i),
      p = point(f);
    if (p[0] < -44 || f.length < 4 || (p[0] < 35 && Math.abs(p[1]) < 18)) continue;
    const count = Math.max(1, Math.floor(f.length / 6));
    for (let j = 0; j < count; j++)
      fields.push(
        window(
          `low-chapel-${i}-${j}`,
          f,
          point(f, (j + 0.5) / count),
          Math.min(3, (f.length / count) * 0.6),
          1.7,
          6.2,
          4.4,
        ),
      );
  }
  // The westmost north-chapel bay is occupied by the first nave buttress.
  return fields.filter((h) => h.name !== 'low-chapel-26-4');
}
function facade(face, h, d) {
  if (h.kind === 'portal') {
    pane(face, h, d, d >= 2 ? -3.3 : 0.06, 'accent');
    const door = { ...h, width: 3.3, height: 5.4, spring: 5.4, shape: 'rect' };
    pane(face, door, d, d >= 2 ? -3.16 : 0.07, 'door');
    if (d >= 2)
      for (const [w, off] of [
        [0.4, 0.05],
        [0.8, 0.13],
        [1.15, 0.2],
      ])
        archBand(face, h, d, w, 'trim', off);
    return;
  }
  pane(face, h, d, d >= 2 ? -0.75 : 0.06, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, 0.32, 'trim', 0.08);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (h.kind === 'door') return;
  const bars = h.width > 5 ? [-0.26, 0, 0.26] : h.width > 3 ? [0] : [];
  for (const u of bars)
    beam(
      face,
      p.point(h.width * u, h.bottom, -0.64 * sg),
      p.point(h.width * u, h.bottom + h.spring, -0.64 * sg),
      0.16,
      'trim',
    );
  if (d >= 3 && h.width > 3)
    for (const u of [-0.26, 0.26])
      beam(
        face,
        p.point(h.width * u, h.bottom + h.spring, -0.62 * sg),
        p.point(0, h.bottom + h.height - 0.5, -0.62 * sg),
        0.15,
        'trim',
      );
}
function turret(face, r, b, body, top, d, slot = 'trim') {
  r = d === 0 ? r.filter((_, i) => i % 2 === 0) : r;
  solid(face, r, b, body, slot);
  if (d >= 1) {
    band(face, r, body - 0.35, 0.28, slot, 1.15);
    band(face, r, body - 4, 0.22, slot, 1.08);
  }
  profile(
    face,
    r,
    [
      [body, 1],
      [body + 0.7, 1.14],
      [top, 0.05],
    ],
    slot,
  );
  if (d >= 3)
    for (const y of [body + 1.5, body + 3.3, body + 5.0]) {
      if (y > top - 1) continue;
      const f = 1 - (y - body) / (top - body);
      band(face, scaled(r, f), y, 0.13, slot, 1.15);
    }
}
function supports(face, d) {
  if (d < 1) return;
  for (const name of ['north', 'south']) {
    const normal = [0, name === 'south' ? 1 : -1];
    for (const [role, xs] of [
      [name === 'north' ? 'aisleNW' : 'aisleSW', [-41.5, -34, -26, -18, -10.9]],
      [name === 'north' ? 'aisleNE' : 'aisleSE', [3.4, 11, 19, 27, 32]],
    ]) {
      const f = edge(ring(role), normal),
        h = edge(nave, normal);
      for (const x of xs) {
        const p = along(f, x),
          r = _R(p[0] - 0.45, p[1] - 0.65, p[0] + 0.45, p[1] + 0.65);
        profile(
          face,
          r,
          [
            [0, 1.3],
            [11, 1.1],
            [13, 0.85],
            [21, 0.6],
          ],
          'wall',
        );
        if (d >= 2) beam(face, at([p[0], p[1]], 20), at(along(h, x), 27), 0.65, 'trim');
      }
    }
  }
}
function leanRoof(face, p, role) {
  const r = ring(role),
    b = bounds(r),
    north = role.includes('N'),
    outer = north ? b[1] : b[3],
    inner = north ? b[3] : b[1],
    y = (q) => floor + 18 + 8 * Math.max(0, Math.min(1, (q[1] - outer) / (inner - outer)));
  cap(face, p.outline, y, 'roof', p.holes ?? []);
}
function build(target, d) {
  const limit = d === 0 ? 36 : d === 1 ? 24 : 16,
    out = {
      addTriangle(slot, ref, p, n, uv, col) {
        const lengths = [0, 1, 2].map((i) =>
            Math.hypot(...p[i].map((v, k) => v - p[(i + 1) % 3][k])),
          ),
          i = lengths.indexOf(Math.max(...lengths));
        if (lengths[i] > limit) {
          const j = (i + 1) % 3,
            k = (i + 2) % 3,
            m = lerp(p[i], p[j], 0.5),
            um = lerp(uv[i], uv[j], 0.5);
          out.addTriangle(slot, ref, [p[i], m, p[k]], n, [uv[i], um, uv[k]], col);
          out.addTriangle(slot, ref, [m, p[j], p[k]], n, [um, uv[j], uv[k]], col);
          return;
        }
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
    fields = stBavoFields(),
    cut =
      d >= 2
        ? writer(
            masked(
              out,
              fields.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
            ),
            d,
          )
        : face;
  for (const l of rec.wallLayers)
    for (const p of l.polygons) {
      const r = coarse(p.outline);
      if (d >= 2) shell(out, d, r, l.bottom ?? footing, l.top, fields);
      else sides(face, r, l.bottom ?? footing, l.top, 'wall');
    }
  for (const p of rec.highPlans) {
    if (d >= 2) shell(out, d, coarse(p.outline), 18, 34, fields);
    else sides(face, coarse(p.outline), 18, 34, 'wall');
  }
  if (d >= 2) shell(out, d, coarse(transept), 18, 34, fields);
  else sides(face, coarse(transept), 18, 34, 'wall');
  hip(face, coarse(rec.highPlans[0].outline), 34, 43);
  gable(face, transept, 34, 43, 'roof', 1);
  for (const p of rec.lowRoofPlans) hip(face, coarse(p.outline), 10, 14);
  for (const [role, ps] of Object.entries(rec.aisleRoofs))
    for (const p of ps) {
      if (role === 'westChapels') hip(face, coarse(p.outline), 18, 26, 'roof', 1);
      else leanRoof(face, p, role);
    }
  if (d >= 2) sides(cut, rec.main.polygons[0].outline, footing, 0.35, 'wall');
  shell(out, d, shaft, 18, 60, d >= 2 ? fields : []);
  shell(out, d, ring('towerUpper'), 60, 78, d >= 2 ? fields : []);
  cap(face, ring('towerUpper'), 78, 'trim');
  profile(
    face,
    ring('towerCrown'),
    [
      [78, 1],
      [79.2, 1.1],
      [83, 0.12],
    ],
    'roof',
  );
  for (const name of pins) turret(face, ring(name), d === 0 ? 60 : 18, 78, 89, d);
  for (const name of ['frontNorthTurret', 'frontSouthTurret'])
    turret(face, ring(name), footing, 22, 29, d);
  for (const name of ['transeptNW', 'transeptNE', 'transeptSE', 'transeptSW'])
    turret(face, ring(name), 18, 38, 46, d);
  if (d >= 1) {
    for (const h of fields) facade(face, h, d);
    for (const y of [18, 29.8, 45.6, 60]) band(face, shaft, y, 0.3, 'trim', 1.025);
    band(face, ring('towerUpper'), 77, 0.35, 'trim', 1.08);
    supports(face, d);
  }
}
export const buildStBavoSkyline = (o) => build(o, 0),
  buildStBavoDistrict = (o) => build(o, 1),
  buildStBavoStreet = (o) => build(o, 2),
  buildStBavoCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const stBavoStudy = {
  id: 'st_bavos_cathedral',
  key: 'st_bavo_s_cathedral',
  title: "St Bavo's Cathedral",
  category: 'cathedral',
  wikidataId: 'Q938154',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID main and21 current parts. Western tower/portal and round eastern choir sign southern high-nave edge.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256-square ashlar/limestone/slate/plain wood graphs, pale stone/slate linear tints, metric UVs and flat normals. Window/vault fields use flat geometric PBR colors. No embedded images, bespoke facade textures or baked shadows.',
  importReason:
    'Four authored browser tiers preserve the stepped western tower/four89m pinnacles, lower83m crown, tall glazed nave/choir, transept/turrets and low chapel ring at the signed map site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from June2025 western picture, one undated historical southeast architectural picture and current standard PMTiles/DEM only. The old picture is used solely for visible building proportions; modern hidden roofs/chapels, north fenestration and doorway/paving levels remain approximate. Fine stone carving/sculpture/inscriptions, exact stained glass/tracery/parapets, town/roof furniture, full interiors/crypt and certified walking excluded. Tower glazing uses closed dark panels; the entrance has a dark vault backing and lower wood door. Physical device timing pending.',
    'Skyline preserves roof/chapel forms, stepped tower/four corner pinnacles, smaller central crown and front/transept turrets. District adds shared surfaces, flat pointed fields and support rhythm. Street opens facade/portal recesses with mullions and coarse flying supports; closeup/master refine nested entrance surrounds, tracery and pinnacle bands. Synthetic cottage context is a review fixture.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-vaulted-portal-and-lancet-tiers', [-123, 31, 13], [-54, 31, 0]),
    cam('tower-four-pinnacles-and-central-crown', [-120, 94, 73], [-51, 73, 0]),
    cam('south-nave-and-pointed-glazing', [-28, 35, 77], [-24, 24, 9]),
    cam('south-transept-and-46m-turrets', [-4, 37, 83], [-5, 27, 15]),
    cam('round-choir-and-low-chapel-ring', [113, 51, 67], [36, 25, 0]),
    cam('roof-and-signed-plan', [0, 184, 1], [0, 34, 0]),
  ],
};

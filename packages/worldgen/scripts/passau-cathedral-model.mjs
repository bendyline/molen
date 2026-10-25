/** Passau Cathedral: twin west clock towers, long red nave, Gothic choir and crossing onion tower. */
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
  '../../../content/worldgen/source/places/u2/u29/st_stephans_cathedral_passau/',
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
  wall: '#efece0',
  trim: '#e6e1d4',
  roof: '#bd957f',
  metal: '#83b4a3',
  door: '#535852',
  glass: '#526572',
  gold: '#c6ae68',
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
const footing = (p) => Math.min(floor - 0.3, passauGround(...p) - 0.35);
export function passauGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Passau Cathedral footing outside retained terrain');
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
  segments = (d) => [8, 16, 24, 40, 40][d];
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos((i * Math.PI * 2) / n),
    p[1] + r * Math.sin((i * Math.PI * 2) / n),
  ]);
const polygonFields = (r, selector, make) =>
  r.flatMap((_, i) => {
    const f = faceFrame(r, i);
    return selector(f, i) ? make(f, i) : [];
  });
export function passauFields(d) {
  if (!d) return [];
  const x = -55.4,
    hs = [
      hole('west-middle-door', [x, 1.45], [0, 1], [-1, 0], 4, 0.45, 7.6, 5.6, 'round', 6),
      ...[-9, 11.5].map((z) =>
        hole(`west-side-door-${z}`, [x, z], [0, 1], [-1, 0], 1.8, 0.45, 4.1, 4.1, 'rect', 6),
      ),
      hole('west-tall-light', [x, 1.45], [0, 1], [-1, 0], 4.5, 23, 8.8, 6.55, 'round', 6),
    ];
  if (d >= 2) {
    for (const z of [-9, 11.5])
      hs.push(hole(`west-mezzanine-${z}`, [x, z], [0, 1], [-1, 0], 1.8, 12, 4.8, 4.8, 'rect', 6));
    for (const z of [-0.1, 2.9])
      hs.push(hole(`west-attic-${z}`, [x, z], [0, 1], [-1, 0], 1.5, 36.4, 2.2, 2.2, 'rect', 6));
  }
  for (const side of [-1, 1]) {
    const z = side < 0 ? -4.78 : 7.72;
    for (const u of d === 1 ? [-27, -6] : [-33, -21, -9, 3])
      hs.push(
        hole(
          `nave-clerestory-${u}-${side}`,
          [u, z],
          [1, 0],
          [0, side],
          4.2,
          26.6,
          3.4,
          1.3,
          'round',
          3,
        ),
      );
    const a = side < 0 ? -16.73 : 20.02;
    for (const u of d === 1 ? [-24, -3] : [-31, -18, -5])
      hs.push(
        hole(`aisle-light-${u}-${side}`, [u, a], [1, 0], [0, side], 4.4, 12.8, 4.2, 2, 'round', 3),
      );
  }
  return hs;
}
export function passauTowerFields(d) {
  if (!d) return [];
  const hs = [];
  for (const [k, r] of rec.plans.towerBases.entries()) {
    hs.push(
      ...polygonFields(
        r,
        (f) =>
          f.length > 5 && (d >= 2 || f.normal[0] < -0.6 || f.normal[1] * (k === 0 ? 1 : -1) > 0.6),
        (f, i) => [
          hole(
            `square-belfry-${k}-${i}`,
            lerp(f.a, f.b, 0.5),
            f.axis,
            f.normal,
            2.7,
            29,
            6.5,
            5.15,
            'round',
            4,
          ),
        ],
      ),
    );
    const cr = rec.plans.towerCrowns[k];
    hs.push(
      ...polygonFields(
        cr,
        (_f, i) => d >= 2 || i % 4 === 0,
        (f, i) => {
          const p = lerp(f.a, f.b, 0.5),
            a = [
              hole(`upper-belfry-${k}-${i}`, p, f.axis, f.normal, 2.3, 47.2, 5.8, 4.65, 'round', 4),
            ];
          if (d >= 2)
            a.push(
              hole(`upper-oval-${k}-${i}`, p, f.axis, f.normal, 2, 53.6, 1.25, 1.25, 'circle', 4),
            );
          return a;
        },
      ),
    );
  }
  return hs;
}
export function passauCrossingFields(d) {
  if (!d) return [];
  return polygonFields(
    rec.plans.crossing,
    (_f, i) => d >= 2 || i % 2 === 0,
    (f, i) => [
      hole(
        `crossing-light-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        3.6,
        45.6,
        7.5,
        5.7,
        'round',
        4,
      ),
    ],
  );
}
export function passauChoirFields(d) {
  if (!d) return [];
  return polygonFields(
    rec.plans.choir,
    (f) => f.normal[0] > -0.6,
    (f, i) => {
      const hs = [];
      for (const u of d >= 2 && f.length > 15 ? [0.28, 0.72] : [0.5]) {
        const p = lerp(f.a, f.b, u);
        hs.push(
          hole(`choir-long-${i}-${u}`, p, f.axis, f.normal, 2.8, 5.5, 12.8, 11.4, 'round', 4),
        );
        if (d >= 2)
          hs.push(
            hole(`choir-oval-${i}-${u}`, p, f.axis, f.normal, 2.7, 25, 4.8, 4.8, 'circle', 4),
          );
      }
      return hs;
    },
  );
}
export function passauTranseptFields(d) {
  if (!d) return [];
  const hs = [];
  for (const side of [-1, 1]) {
    const z = side < 0 ? -16.664 : 19.974;
    hs.push(
      hole(
        `transept-pointed-${side}`,
        [18.1, z],
        [1, 0],
        [0, side],
        6.8,
        19,
        11.7,
        8.4,
        'pointed',
        4,
      ),
    );
    if (d >= 2)
      hs.push(
        hole(
          `transept-rose-${side}`,
          [18.1, z],
          [1, 0],
          [0, side],
          4.2,
          33.1,
          4.2,
          4.2,
          'circle',
          4,
        ),
      );
  }
  return hs;
}
function finish(face, hs, d) {
  for (const h of hs) {
    const door = h.name.includes('door') || h.name.includes('belfry');
    pane(face, h, d, -0.32, door ? 'door' : 'glass');
    if (!(d === 1 && h.name.startsWith('choir-')))
      archBand(face, h, d, h.name.includes('door') ? 0.3 : 0.18);
    if (d >= 2 && h.height > 4 && !h.name.includes('door')) {
      const p = prepareOpening(h, 0, d),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      beam(
        face,
        p.point(0, h.bottom + 0.1, -0.29 * sg),
        p.point(0, h.bottom + h.height - 0.2, -0.29 * sg),
        0.08,
        door ? 'door' : 'metal',
      );
      for (let k = 1; k < (d === 2 ? 2 : 4); k++) {
        const y = h.bottom + (h.spring * k) / 4;
        beam(
          face,
          p.point(-h.width * 0.44, y, -0.29 * sg),
          p.point(h.width * 0.44, y, -0.29 * sg),
          0.065,
          door ? 'door' : 'metal',
        );
      }
    }
  }
}
function figure(face, p, y, d) {
  if (d < 2) return;
  solid(face, R(p[0] - 0.35, p[1] - 0.35, p[0] + 0.35, p[1] + 0.35), y, y + 0.3, 'trim');
  profile(
    face,
    circle(p, 0.3, 6),
    [
      [y + 0.3, 1],
      [y + 1.35, 0.65],
      [y + 1.6, 0.9],
    ],
    'trim',
  );
  solid(face, circle(p, 0.18, 6), y + 1.6, y + 1.9, 'trim');
}
function church(out, face, d) {
  const all = [...passauFields(d), ...passauChoirFields(d), ...passauTranseptFields(d)],
    r = d === 0 ? coarse(rec.main.polygons[0].outline) : rec.main.polygons[0].outline;
  shell(out, d, r, footing, 18.5, all);
  cap(face, r, 18.55, 'roof');
  const nave = rec.plans.nave,
    nh = passauFields(d);
  shell(out, d, nave, 0, 30.8, nh);
  gable(
    writer(
      masked(
        out,
        nh.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    nave,
    30.8,
    38,
  );
  for (const ar of rec.plans.aisles) {
    shell(out, d, ar, 0, 18.5, all);
    // A single planar slope also fits the western footprint step without folded hips.
    const north = center(ar)[1] < 0,
      outer = north ? -16.78 : 20.1,
      inner = north ? -4.78 : 7.68,
      roofHeight = (p) => floor + 18.5 + ((p[1] - outer) / (inner - outer)) * 6.5;
    sides(face, ar, 18.5, roofHeight, 'wall');
    cap(face, ar, roofHeight, 'roof');
  }
  const tr = rec.plans.transept,
    th = passauTranseptFields(d);
  shell(out, d, tr, 0, 31, th);
  gable(
    writer(
      masked(
        out,
        th.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    tr,
    31,
    42,
    'roof',
    1,
  );
  finish(face, nh, d);
  finish(face, th, d);
  const cr = rec.plans.choir,
    ch = passauChoirFields(d);
  shell(out, d, cr, footing, 31, ch);
  hip(face, cr, 31, 38);
  finish(face, ch, d);
  if (d >= 1) {
    for (const rr of [nave, ...rec.plans.aisles, tr, cr]) {
      const y = rr === nave ? 30.4 : rr === tr || rr === cr ? 30.65 : 18.1;
      band(face, rr, y, 0.3, 'trim', 1.003);
    }
  }
  if (d >= 2) {
    for (const side of [-1, 1])
      for (const x of [-37, -25, -13, -1, 7]) {
        const z = side < 0 ? -16.75 : 20;
        solid(face, R(x - 0.24, z - 0.24, x + 0.24, z + 0.24), 0.3, 18.1, 'trim');
      }
    for (const p of cr) {
      const c = center(cr),
        n = unit(p.map((v, k) => v - c[k])),
        q = p.map((v, k) => v + n[k] * 0.7),
        rr = R(q[0] - 0.4, q[1] - 0.4, q[0] + 0.4, q[1] + 0.4);
      solid(face, scaled(rr, 1.5), footing, 7.8, 'trim');
      solid(face, rr, 7.8, 25.5, 'trim');
      solid(face, scaled(rr, 0.65), 25.5, 31.4, 'trim');
      profile(
        face,
        circle(q, 0.38, 4),
        [
          [31.4, 1],
          [34.8, 0.02],
        ],
        'trim',
      );
    }
    for (const side of [-1, 1])
      for (const x of [9, 27]) {
        const z = side < 0 ? -16.85 : 20.15;
        solid(face, R(x - 0.3, z - 0.3, x + 0.3, z + 0.3), 18.5, 35.4, 'trim');
        profile(
          face,
          circle([x, z], 0.45, 4),
          [
            [35.4, 1],
            [39, 0.02],
          ],
          'trim',
        );
      }
  }
}
function facade(out, face, d) {
  const hs = passauFields(d).filter((h) => h.name.startsWith('west-')),
    r = R(-55.45, -13.15, -54.65, 13.35);
  shell(out, d, r, footing, 35.5, hs);
  cap(face, r, 35.5, 'wall');
  const attic = R(-55.45, -7.5, -54.65, 10.4);
  shell(out, d, attic, 35.5, 39.2, hs);
  cap(face, attic, 39.2, 'wall');
  for (const x of [-55.45, -54.65])
    face(
      'wall',
      [
        [x, floor + 39.2, -7.5],
        [x, floor + 39.2, 10.4],
        [x, floor + 41.5, 1.45],
      ],
      [x < -55 ? -1 : 1, 0, 0],
    );
  face(
    'roof',
    [
      [-55.45, floor + 39.2, -7.5],
      [-54.65, floor + 39.2, -7.5],
      [-54.65, floor + 41.5, 1.45],
      [-55.45, floor + 41.5, 1.45],
    ],
    [0, 1, 0],
  );
  face(
    'roof',
    [
      [-55.45, floor + 41.5, 1.45],
      [-54.65, floor + 41.5, 1.45],
      [-54.65, floor + 39.2, 10.4],
      [-55.45, floor + 39.2, 10.4],
    ],
    [0, 1, 0],
  );
  if (d >= 1) {
    finish(face, hs, d);
    for (const z of [-11.3, -7.2, 7.8, 12.3])
      solid(face, R(-55.8, z - 0.22, -55.4, z + 0.22), 1, 34.9, 'trim');
    for (const y of [18.1, 34.9])
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
        0.35,
        'trim',
        1.005,
      );
    beam(face, [-55.6, floor + 39.2, -7.6], [-55.6, floor + 41.65, 1.45], 0.3);
    beam(face, [-55.6, floor + 41.65, 1.45], [-55.6, floor + 39.2, 10.5], 0.3);
  }
  if (d >= 2) {
    for (const z of [-12.3, 12.5]) {
      const sg = z < 0 ? -1 : 1,
        poly = [
          [sg * 6.6, 35.2],
          [sg * 7.2, 33.8],
          [sg * 8, 29.5],
          [sg * 9.3, 25.2],
          [sg * 11, 22.3],
          [sg * 13.1, 21.3],
          [sg * 13.1, 18.5],
          [sg * 6.6, 18.5],
        ],
        ids = earcut(poly.flat(), [], 2);
      for (let i = 0; i < ids.length; i += 3)
        face(
          'wall',
          ids.slice(i, i + 3).map((k) => [-55.85, floor + poly[k][1], poly[k][0] + 1.45]),
          [-1, 0, 0],
        );
    }
    for (const z of [-9, 11.5]) {
      const h = hs.find((h) => h.name === `west-side-door-${z}`);
      solid(
        face,
        R(-56.1, z - 1.35, -55.4, z + 1.35),
        h.bottom - floor + h.height + 0.1,
        h.bottom - floor + h.height + 0.4,
        'trim',
      );
    }
    for (const [z, y] of [
      [-7.8, 39.3],
      [10.5, 39.3],
      [1.45, 41.5],
    ])
      figure(face, [-55.65, z], y, d);
    for (let k = 0; k < 3; k++)
      solid(
        face,
        R(-56.6 - (2 - k) * 0.35, -1.1, -55.4, 4),
        0.02 + k * 0.14,
        0.16 + k * 0.14,
        'trim',
      );
  }
}
function clock(face, f, k, d) {
  const p = lerp(f.a, f.b, 0.5),
    h = hole(`clock-${k}`, p, f.axis, f.normal, 4.1, 37.6, 4.1, 4.1, 'circle', 2);
  pane(face, h, d, 0.06, 'gold');
  archBand(face, h, d, 0.18, 'trim', 0.1);
  if (d >= 2) {
    const v = prepareOpening(h, 0, d),
      sg = Math.sign(-v.axis[1] * h.normal[0] + v.axis[0] * h.normal[1]),
      y = h.bottom + h.height / 2;
    beam(face, v.point(0, y, 0.13 * sg), v.point(0.35, y + 1.5, 0.13 * sg), 0.1, 'door');
    beam(face, v.point(0, y, 0.14 * sg), v.point(-1.2, y - 0.15, 0.14 * sg), 0.12, 'door');
    if (d >= 3)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        beam(
          face,
          v.point(Math.cos(a) * 1.55, y + Math.sin(a) * 1.55, 0.14 * sg),
          v.point(Math.cos(a) * 1.83, y + Math.sin(a) * 1.83, 0.14 * sg),
          0.06,
          'door',
        );
      }
  }
}
function onion(face, p, r, bottom, d) {
  const rr = circle(p, r, segments(d)),
    levels =
      d === 0
        ? [
            [bottom, 1.02],
            [bottom + 3.5, 1.13],
            [bottom + 7, 0.92],
            [65.6, 0.12],
          ]
        : [
            [bottom, 1.02],
            [bottom + 1.7, 1.1],
            [bottom + 4.5, 1.15],
            [bottom + 7.2, 0.93],
            [64.9, 0.38],
            [65.6, 0.1],
          ];
  profile(face, rr, levels, 'metal');
  beam(face, [p[0], floor + 65.3, p[1]], [p[0], floor + 68, p[1]], d === 0 ? 0.22 : 0.13, 'gold');
  beam(
    face,
    [p[0] - 0.55, floor + 67.2, p[1]],
    [p[0] + 0.55, floor + 67.2, p[1]],
    d === 0 ? 0.22 : 0.13,
    'gold',
  );
  if (d >= 2)
    for (let i = 0; i < (d === 2 ? 8 : 16); i++) {
      const a = (i * Math.PI * 2) / (d === 2 ? 8 : 16),
        n = [Math.cos(a), Math.sin(a)];
      for (let j = 1; j < levels.length; j++) {
        const [y, f] = levels[j - 1],
          [v, g] = levels[j];
        beam(
          face,
          [p[0] + n[0] * r * (f + 0.005), floor + y, p[1] + n[1] * r * (f + 0.005)],
          [p[0] + n[0] * r * (g + 0.005), floor + v, p[1] + n[1] * r * (g + 0.005)],
          0.08,
          'metal',
        );
      }
    }
}
function towers(out, face, d) {
  const all = passauTowerFields(d);
  for (const [k, r] of rec.plans.towerBases.entries()) {
    const hs = all.filter((h) => h.name.startsWith(`square-belfry-${k}-`));
    shell(out, d, r, footing, 45, hs);
    cap(face, r, 45, 'wall');
    const cr = rec.plans.towerCrowns[k],
      ch = all.filter(
        (h) => h.name.startsWith(`upper-belfry-${k}-`) || h.name.startsWith(`upper-oval-${k}-`),
      );
    shell(out, d, cr, 45, 56, ch);
    cap(face, cr, 56, 'wall');
    onion(face, center(cr), 5.7, 56, d);
    if (d >= 1) {
      for (const y of [24.8, 44.5]) band(face, r, y, 0.4, 'trim', 1.04);
      band(face, cr, 55.55, 0.3, 'trim', 1.025);
      finish(face, [...hs, ...ch], d);
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (f.length < 5) continue;
        if (d >= 2 || f.normal[0] < -0.6) clock(face, f, `${k}-${i}`, d);
      }
    }
    if (d >= 2) {
      for (const p of r)
        solid(face, R(p[0] - 0.25, p[1] - 0.25, p[0] + 0.25, p[1] + 0.25), 25.2, 44.2, 'trim');
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (f.length < 5) continue;
        for (let j = 0; j < 5; j++) {
          const p = lerp(f.a, f.b, j / 4);
          solid(face, R(p[0] - 0.17, p[1] - 0.17, p[0] + 0.17, p[1] + 0.17), 45, 46.1, 'trim');
        }
        beam(face, at(f.a, 46.1), at(f.b, 46.1), 0.25);
      }
      for (const p of [r[0], r[1], r[3]]) figure(face, p, 45.7, d);
    }
  }
  const r = rec.plans.crossing,
    hs = passauCrossingFields(d);
  // The supporting octagon continues beneath the sloping transept roof.
  shell(out, d, r, 31, 54.5, hs);
  cap(face, r, 54.5, 'wall');
  onion(face, center(r), 7.7, 54.5, d);
  if (d >= 1) {
    band(face, r, 54.1, 0.35, 'trim', 1.025);
    finish(face, hs, d);
  }
  if (d >= 2)
    for (const p of r)
      solid(face, R(p[0] - 0.17, p[1] - 0.17, p[0] + 0.17, p[1] + 0.17), 42.3, 54, 'trim');
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
    if (longest > 22) {
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
  towers(out, face, d);
}
export const buildPassauSkyline = (o) => build(o, 0),
  buildPassauDistrict = (o) => build(o, 1),
  buildPassauStreet = (o) => build(o, 2),
  buildPassauCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const passauCathedralStudy = {
  id: 'st_stephans_cathedral_passau',
  key: 'st_stephan_s_cathedral_passau',
  title: "St. Stephan's Cathedral, Passau",
  category: 'cathedral',
  wikidataId: 'Q267182',
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
    'Five existing shared256² lime plaster,raw limestone,flat tile,painted metal and plain wood graphs;local blue-grey glazing/muted gold;seven groups. Green shared metal abstracts patinated copper. Linear tints,metric UVs and flat normals;no embedded images,bespoke textures or baked lighting.',
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
    'Individual medium-fi exterior from four inspected matching pictures and standard PMTiles/DEM. Map component height tags are nominal;roof/clock/bay/buttress/portal/step and fine onion/cornice/balustrade/statue profiles are estimated or abstracted. Faithful Gothic/Baroque carving,sculpture/gold relief,inscriptions,clock numerals,window artwork,interiors/bells,engineering,current finish,hidden attached walls and exact Domplatz/Residenzplatz/threshold/step/base contact remain simplified,excluded or unverified. Glazing/doors/belfry fields are recessed panes/timber;no open-interior/belfry claim. Adjoining Domhof/chapel ranges,Residenz/houses,plazas,trees and monuments remain host content. Italian palazzo context is synthetic;physical phone/laptop timing unverified.',
    'Skyline retains twin west towers/green crowns,central Baroque front,long red nave/aisles,polygonal choir,transept and large crossing onion tower. District adds shared surfaces,portals/upper front window,coarse side-window rhythm,clock discs and belfry/drum/choir openings. Street adds upper/lower choir lights,roses,full window/pilaster rhythm,clock hands/marks,balustrades,stepped buttresses/pinnacles,curved facade shoulders and statue/step abstractions;close-up/master refine circles.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-twin-clock-towers-and-front', [-137, 39, 10], [-51, 30, 0]),
    cam('north-nave-clerestory-and-aisle', [-6, 42, -100], [-8, 22, -7]),
    cam('east-polygonal-choir-and-buttresses', [110, 34, 38], [42, 21, 2]),
    cam('crossing-onion-and-gothic-transept', [61, 68, 65], [18, 45, 2]),
    cam('west-clocks-balustrades-and-onions', [-92, 61, 58], [-46, 48, 8]),
    cam('roof-and-signed-plan', [0, 195, 0.1], [0, 24, 0]),
  ],
};

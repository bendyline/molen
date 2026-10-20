/** Prague Old Town Saint Nicholas: paired open lantern towers, central bell dome and Baroque south front. */
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
  '../../../content/worldgen/source/places/u2/u2f/n0408_church_of_saint_nicholas/',
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
  wall: '#efe4d4',
  trim: '#eee9dc',
  roof: '#c5a797',
  metal: '#85b4a2',
  door: '#555752',
  glass: '#4e6171',
  gold: '#b39d57',
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
const footing = (p) => Math.min(floor - 0.3, pragueNicholasGround(...p) - 0.35);
export function pragueNicholasGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Old Town Saint Nicholas footing outside retained terrain');
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
  segments = (d) => [8, 12, 24, 40, 40][d];
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos((i * Math.PI * 2) / n),
    p[1] + r * Math.sin((i * Math.PI * 2) / n),
  ]);
export function pragueNicholasFields(d) {
  if (!d) return [];
  const hs = [
    hole('south-main-door', [-2.6, 12.7], [1, 0], [0, 1], 2.2, 0.5, 4.0, 2.9, 'round', 4),
    hole('south-main-light', [-2.6, 12.7], [1, 0], [0, 1], 2.3, 9.1, 6, 4.85, 'round', 4),
    hole('west-secondary-door', [-20.35, -0.3], [0, 1], [-1, 0], 1.8, 0.9, 3.4, 3.4, 'rect', 4),
  ];
  for (const x of [-5.2, 0]) {
    hs.push(
      hole(`south-upper-oval-${x}`, [x, 12.7], [1, 0], [0, 1], 1.25, 9.8, 2.3, 2.3, 'circle', 4),
    );
    if (d >= 2)
      hs.push(
        hole(`south-lower-light-${x}`, [x, 12.7], [1, 0], [0, 1], 1.1, 1.8, 2.5, 1.95, 'round', 4),
      );
  }
  for (const x of [-15.1, 10.1]) {
    hs.push(hole(`south-wing-light-${x}`, [x, 12.4], [1, 0], [0, 1], 1.45, 7.1, 4.0, 4, 'rect', 4));
    hs.push(hole(`south-wing-oval-${x}`, [x, 12.4], [1, 0], [0, 1], 1.6, 13.4, 2, 2, 'circle', 4));
  }
  return hs;
}
export function pragueNicholasTowerFields(d) {
  if (!d) return [];
  const hs = [];
  for (const [k, r] of rec.plans.towerBases.entries())
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.normal[1] < -0.65) continue;
      hs.push(
        hole(
          `tower-arched-${k}-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          1.75,
          20.4,
          5.3,
          4.425,
          'round',
          3,
        ),
      );
    }
  return hs;
}
export function pragueNicholasDrumFields(d) {
  if (!d) return [];
  const r = rec.plans.drum,
    hs = [];
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 3) continue;
    hs.push(
      hole(
        `drum-light-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        1.9,
        21.2,
        3.5,
        2.55,
        'round',
        3,
      ),
    );
  }
  return hs;
}
export function pragueNicholasApseFields(d) {
  if (!d) return [];
  const a = rec.plans.apse,
    r = circle(a.center, a.radius, segments(d)),
    hs = [];
  for (const angle of [-0.75, 0.75]) {
    let chosen;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        p = lerp(f.a, f.b, 0.5),
        v = Math.atan2(p[1] - a.center[1], p[0] - a.center[0]),
        dist = Math.abs(Math.atan2(Math.sin(v - angle), Math.cos(v - angle)));
      if (!chosen || dist < chosen.dist) chosen = { ...f, p, dist };
    }
    hs.push(
      hole(
        `east-apse-light-${angle}`,
        chosen.p,
        chosen.axis,
        chosen.normal,
        1.65,
        5,
        6.3,
        5.475,
        'round',
        4,
      ),
    );
  }
  return hs;
}
function finish(face, hs, d) {
  for (const h of hs) {
    pane(face, h, d, -0.32, h.name.includes('door') ? 'door' : 'glass');
    archBand(face, h, d, h.name.includes('door') ? 0.3 : 0.18);
    if (d >= 2 && h.height > 3.5 && !h.name.includes('door')) {
      const p = prepareOpening(h, 0, d),
        sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
      beam(
        face,
        p.point(0, h.bottom + 0.1, -0.29 * sg),
        p.point(0, h.bottom + h.height - 0.2, -0.29 * sg),
        0.065,
        'metal',
      );
      for (let k = 1; k < 4; k++) {
        const y = h.bottom + (h.spring * k) / 4;
        beam(
          face,
          p.point(-h.width * 0.43, y, -0.29 * sg),
          p.point(h.width * 0.43, y, -0.29 * sg),
          0.055,
          'metal',
        );
      }
    }
  }
}
function statue(face, p, y, d) {
  if (d < 2) return;
  solid(face, R(p[0] - 0.35, p[1] - 0.35, p[0] + 0.35, p[1] + 0.35), y, y + 0.35, 'trim');
  profile(
    face,
    circle(p, 0.27, 6),
    [
      [y + 0.35, 1],
      [y + 1.25, 0.65],
      [y + 1.55, 0.9],
    ],
    'door',
  );
  solid(face, circle(p, 0.18, 6), y + 1.55, y + 1.9, 'door');
}
function main(out, face, d) {
  const hs = [...pragueNicholasFields(d), ...pragueNicholasApseFields(d)],
    r = d === 0 ? coarse(rec.main.polygons[0].outline) : rec.main.polygons[0].outline;
  shell(out, d, r, footing, 18, hs, 'wall');
  cap(face, r, 18.1, 'roof');
  hip(face, R(-20, -12.2, 16, 12.25), 18.1, 22.6);
  if (d >= 1) {
    band(face, r, 17.55, 0.3, 'trim', 1.005);
    if (d >= 2) {
      band(
        writer(
          masked(
            out,
            hs.map((h) => prepareOpening(h, 0, d)),
          ),
          d,
        ),
        r,
        2.8,
        0.23,
        'trim',
        1.008,
      );
      band(face, r, 16.95, 0.28, 'trim', 1.008);
    }
    finish(face, pragueNicholasFields(d), d);
  }
  const a = rec.plans.apse,
    ar = circle(a.center, a.radius, segments(d)),
    ah = pragueNicholasApseFields(d);
  shell(out, d, ar, footing, 18, ah, 'wall');
  cap(face, ar, 18, 'wall');
  profile(
    face,
    ar,
    [
      [18, 1.01],
      [18.35, 1.03],
      [22.5, 0.025],
    ],
    'roof',
  );
  if (d >= 1) {
    band(face, ar, 17.5, 0.32, 'trim', 1.025);
    finish(face, ah, d);
  }
  if (d >= 2) {
    for (const ang of [-1.15, 0, 1.15]) {
      const p = [a.center[0] + a.radius * Math.cos(ang), a.center[1] + a.radius * Math.sin(ang)];
      solid(face, R(p[0] - 0.18, p[1] - 0.18, p[0] + 0.18, p[1] + 0.18), 3.1, 16.9, 'trim');
    }
    statue(face, [21.35, -0.65], 5.1, d);
  }
}
function front(out, face, d) {
  const hs = pragueNicholasFields(d).filter((h) => h.name.startsWith('south-')),
    r = R(-9.1, 12.45, 3.6, 12.85);
  shell(out, d, r, footing, 18.4, hs);
  cap(face, r, 18.4, 'wall');
  const path = [
      [-9.1, 18.4],
      [-8.8, 19.4],
      [-8, 20.1],
      [-6.8, 20.45],
      [-5.8, 20.3],
      [-4.8, 21.4],
      [-2.6, 23.2],
      [-0.4, 21.4],
      [0.6, 20.3],
      [1.6, 20.45],
      [2.8, 20.1],
      [3.6, 18.4],
    ],
    poly = [[-9.1, 18], ...path, [3.6, 18]],
    ids = earcut(poly.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    for (const z of [12.46, 12.86])
      face(
        'wall',
        ids.slice(i, i + 3).map((k) => [poly[k][0], floor + poly[k][1], z]),
        [0, 0, z > 12.7 ? 1 : -1],
      );
  for (let i = 0; i < path.length - 1; i++)
    if (d >= 1)
      beam(
        face,
        [path[i][0], floor + path[i][1], 12.92],
        [path[i + 1][0], floor + path[i + 1][1], 12.92],
        d === 1 ? 0.19 : 0.26,
        'trim',
      );
  if (d >= 1) {
    finish(
      face,
      hs.filter((h) => h.center[0] > -9.1 && h.center[0] < 3.6),
      d,
    );
    for (const x of [-8.6, -6.8, 1.6, 3.4]) {
      const r = circle([x, 13.1], d === 1 ? 0.22 : 0.3, d === 1 ? 4 : 8);
      solid(face, r, 3.4, 17.3, 'trim');
      if (d >= 2) {
        solid(face, scaled(r, 1.5), 3.2, 3.6, 'trim');
        solid(face, scaled(r, 1.45), 17, 17.6, 'trim');
      }
    }
  }
  if (d >= 2) {
    for (const x of [-18.5, -11.5, 6.4, 13.8])
      solid(face, R(x - 0.24, 12.4, x + 0.24, 12.9), 3.3, 17.1, 'trim');
    for (const p of [
      [-8.4, 12.9],
      [3, 12.9],
      [-13, 11.9],
      [7.8, 11.9],
    ])
      statue(face, p, 18.45, d);
    for (const x of [-15.1, 10.1]) {
      beam(face, [x - 1.1, floor + 11.7, 12.7], [x, floor + 12.45, 12.7], 0.2);
      beam(face, [x, floor + 12.45, 12.7], [x + 1.1, floor + 11.7, 12.7], 0.2);
    }
    for (let k = 0; k < 3; k++)
      solid(
        face,
        R(-4.2, 12.8, -1.0, 13.5 + (2 - k) * 0.22),
        0.04 + k * 0.15,
        0.19 + k * 0.15,
        'trim',
      );
  }
}
export function pragueNicholasTowerCenters() {
  return rec.plans.towerCrowns.map(center);
}
function towers(out, face, d) {
  for (const [k, r] of rec.plans.towerBases.entries()) {
    const hs = pragueNicholasTowerFields(d).filter((h) => h.name.startsWith(`tower-arched-${k}-`));
    shell(out, d, r, 18, 28, hs);
    cap(face, r, 28, 'wall');
    profile(
      face,
      r,
      d === 0
        ? [
            [28, 1.04],
            [30.7, 0.45],
          ]
        : [
            [28, 1.08],
            [28.45, 1.03],
            [29.2, 0.88],
            [30.3, 0.49],
            [30.7, 0.46],
          ],
      'metal',
    );
    if (d >= 1) {
      band(face, r, 18.2, 0.35, 'trim', 1.04);
      band(face, r, 27.6, 0.3, 'trim', 1.04);
      finish(face, hs, d);
    }
    if (d >= 2)
      for (const p of r)
        solid(face, R(p[0] - 0.16, p[1] - 0.16, p[0] + 0.16, p[1] + 0.16), 18.5, 27.5, 'trim');
    const p = center(rec.plans.towerCrowns[k]),
      lr = circle(p, 2.05, d === 0 ? 4 : 8);
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 4 + (i * Math.PI) / 2,
        q = [p[0] + 1.6 * Math.cos(ang), p[1] + 1.6 * Math.sin(ang)];
      solid(face, R(q[0] - 0.15, q[1] - 0.15, q[0] + 0.15, q[1] + 0.15), 30.65, 34.2, 'metal');
    }
    band(face, lr, 30.65, 0.23, 'metal', 1.02);
    band(face, lr, 34, 0.24, 'metal', 1.08);
    cap(face, lr, 34.2, 'metal');
    profile(
      face,
      lr,
      [
        [34.2, 1.08],
        [34.85, 1.13],
        [35.6, 0.69],
        [36, 0.28],
        [38.3, 0.07],
      ],
      'metal',
    );
    beam(face, [p[0], floor + 38, p[1]], [p[0], floor + 40.8, p[1]], d === 0 ? 0.18 : 0.1, 'gold');
    beam(
      face,
      [p[0] - 0.4, floor + 40.1, p[1]],
      [p[0] + 0.4, floor + 40.1, p[1]],
      d === 0 ? 0.18 : 0.1,
      'gold',
    );
  }
}
export function pragueNicholasLanternFields(d) {
  if (!d) return [];
  const p = center(rec.plans.lantern),
    r = circle(p, 2.05, 8),
    hs = [];
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (d === 1 && i % 2) continue;
    hs.push(
      hole(
        `central-lantern-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        0.8,
        33.2,
        3.2,
        2.8,
        'round',
        2,
      ),
    );
  }
  return hs;
}
function dome(out, face, d) {
  const r = rec.plans.drum,
    hs = pragueNicholasDrumFields(d);
  shell(out, d, r, 18, 25.5, hs);
  cap(face, r, 25.5, 'wall');
  profile(
    face,
    r,
    d === 0
      ? [
          [25.5, 1.05],
          [28.4, 0.8],
          [29, 0.88],
          [32, 0.28],
        ]
      : [
          [25.5, 1.05],
          [26.4, 0.98],
          [27.8, 0.91],
          [28.4, 0.8],
          [28.6, 0.77],
          [29.1, 0.88],
          [30.7, 0.65],
          [32, 0.28],
        ],
    'metal',
  );
  if (d >= 1) {
    band(face, r, 25.15, 0.28, 'trim', 1.04);
    finish(face, hs, d);
  }
  if (d >= 2)
    for (const p of r)
      solid(face, R(p[0] - 0.13, p[1] - 0.13, p[0] + 0.13, p[1] + 0.13), 18.4, 25, 'trim');
  const p = center(rec.plans.lantern),
    lr = circle(p, 2.05, 8),
    lh = pragueNicholasLanternFields(d);
  shell(out, d, lr, 31.9, 37.2, lh);
  cap(face, lr, 37.2, 'wall');
  if (d >= 1) {
    finish(face, lh, d);
    band(face, lr, 37, 0.25, 'trim', 1.09);
  }
  profile(
    face,
    lr,
    [
      [37.2, 1.12],
      [38, 0.88],
      [38.6, 0.57],
      [39.2, 0.2],
      [40, 0.05],
    ],
    'metal',
  );
  beam(face, [p[0], floor + 39.5, p[1]], [p[0], floor + 41, p[1]], d === 0 ? 0.18 : 0.1, 'gold');
  beam(
    face,
    [p[0] - 0.35, floor + 40.45, p[1]],
    [p[0] + 0.35, floor + 40.45, p[1]],
    d === 0 ? 0.18 : 0.1,
    'gold',
  );
  if (d >= 2)
    for (const q of r) {
      const n = unit(q.map((v, k) => v - center(r)[k]));
      const levels = [
        [25.5, 1.05],
        [28.4, 0.8],
        [29.1, 0.88],
        [32, 0.28],
      ];
      for (let j = 1; j < levels.length; j++) {
        const [y, f] = levels[j - 1],
          [v, g] = levels[j];
        beam(
          face,
          [
            center(r)[0] + n[0] * Math.hypot(q[0] - center(r)[0], q[1] - center(r)[1]) * f,
            floor + y,
            center(r)[1] + n[1] * Math.hypot(q[0] - center(r)[0], q[1] - center(r)[1]) * f,
          ],
          [
            center(r)[0] + n[0] * Math.hypot(q[0] - center(r)[0], q[1] - center(r)[1]) * g,
            floor + v,
            center(r)[1] + n[1] * Math.hypot(q[0] - center(r)[0], q[1] - center(r)[1]) * g,
          ],
          0.075,
          'metal',
        );
      }
    }
}
function westPortal(face, d) {
  if (d < 2) return;
  const p = [-20.35, -0.3];
  for (let k = 0; k < 7; k++) {
    const radius = 3.6 - k * 0.25,
      n = 12,
      ring = [
        [p[0], p[1] - radius],
        ...Array.from({ length: n + 1 }, (_, i) => [
          p[0] - Math.sin((i * Math.PI) / n) * radius,
          p[1] - Math.cos((i * Math.PI) / n) * radius,
        ]),
        [p[0], p[1] + radius],
      ];
    solid(face, ring, -0.05 + k * 0.12, 0.07 + k * 0.12, 'trim');
  }
  const h = hole('west-pediment', p, [0, 1], [-1, 0], 2.3, 5.1, 1.2, 0, 'round');
  archBand(face, h, d, 0.19);
  const figure = [-20.55, -0.3];
  solid(face, R(-20.7, -0.55, -20.4, -0.05), 4.95, 5.1, 'trim');
  profile(
    face,
    circle(figure, 0.16, 6),
    [
      [5.1, 1],
      [5.75, 0.65],
    ],
    'door',
  );
  solid(face, circle(figure, 0.11, 6), 5.75, 6, 'door');
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
  main(out, face, d);
  front(out, face, d);
  towers(out, face, d);
  dome(out, face, d);
  westPortal(face, d);
}
export const buildPragueNicholasSkyline = (o) => build(o, 0),
  buildPragueNicholasDistrict = (o) => build(o, 1),
  buildPragueNicholasStreet = (o) => build(o, 2),
  buildPragueNicholasCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const pragueNicholasStudy = {
  id: 'N0408',
  key: 'church_of_saint_nicholas',
  title: 'Church of Saint Nicholas',
  category: 'cathedral',
  wikidataId: 'Q2595999',
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
    'Five existing shared256² lime plaster,raw limestone,flat tile,painted metal and plain wood graphs,with local blue-grey glazing and muted gold accents;seven groups. Green metal tints abstract patinated copper. Linear tints,metric UVs,flat normals,no embedded images,bespoke textures or baked lighting.',
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
    'Individual medium-fi exterior from three matching pictures and standard PMTiles/DEM. A mislabeled reference was excluded after actual inspection. Whole/part height tags are nominal controls;finials,roof/bay profiles,columns,curved pediments,statues and west semicircular stairs are estimated or abstracted. No faithful sculpture/inscriptions,door studs,window artwork,interior/bells,engineering,current finish,concealed northern joins or exact street/square/threshold/step/base contact. Glazing/doors are recessed panes/timber;the two upper tower lantern cores are open geometry. Italian palazzo neighbors are synthetic fixtures;physical phone/laptop timing unverified.',
    'Skyline retains south twin-tower front,green bell/onion crowns and open tower lanterns,central octagonal bell dome/white lantern,east apse and red tile roof. District adds shared surfaces,main portal/arched/oval lights,columns and tower/drum openings. Street adds full bay rhythm,mullions,pilasters,curved step fan,pediment/statue abstractions and roof ribs. Close-up/master refine circles.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('south-square-twin-towers-and-front', [0, 23, 66], [-2, 18, 9]),
    cam('east-rounded-apse-and-side', [52, 22, 23], [15, 11, 0]),
    cam('west-secondary-portal-and-curved-stairs', [-47, 11, 1], [-20, 4, 0]),
    cam('open-tower-lanterns-and-copper-crowns', [30, 39, 42], [4, 31, 5]),
    cam('central-bell-dome-and-white-lantern', [-25, 45, 27], [-2.4, 30, -1]),
    cam('roof-and-signed-plan', [0, 110, 0.1], [0, 15, 0]),
  ],
};

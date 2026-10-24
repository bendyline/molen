/** Sarlat Cathedral: oblique Gothic choir, flying buttresses and Romanesque bulb-roof porch tower. */
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
  '../../../content/worldgen/source/places/sp/spb/sarlat_cathedral/',
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
  wall: '#d1b98d',
  trim: '#dac49b',
  roof: '#64696b',
  door: '#786c5d',
  metal: '#6e7474',
  glass: '#566575',
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
const footing = (p) => Math.min(floor - 0.3, sarlatGround(...p) - 0.35);
export function sarlatGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Sarlat Cathedral footing outside retained terrain');
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
const plans = rec.plans,
  main = rec.main.polygons[0].outline,
  nave = rec.controls.find((b) => b.id === rec.roles.naveRoof).polygons[0].outline,
  L = plans.longitudinal,
  T = plans.transverse;
const p = (u, v) => [plans.origin[0] + L[0] * u + T[0] * v, plans.origin[1] + L[1] * u + T[1] * v],
  uv = (q) => [
    (q[0] - plans.origin[0]) * L[0] + (q[1] - plans.origin[1]) * L[1],
    (q[0] - plans.origin[0]) * T[0] + (q[1] - plans.origin[1]) * T[1],
  ],
  rect = (a, b, x, z) => [p(a, b), p(x, b), p(x, z), p(a, z)],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * Math.PI * 2) / n) * r,
      p[1] + Math.sin((i * Math.PI * 2) / n) * r,
    ]);
export function sarlatFields(d = 3) {
  const fields = [
    {
      ...hole(
        'west-timber-portal',
        p(-5, 0),
        T,
        L.map((v) => -v),
        2.8,
        0.15,
        5.1,
        5.1,
        'rect',
        5,
      ),
      kind: 'door',
    },
    hole(
      'west-porch-oculus',
      p(-4.3, 0),
      T,
      L.map((v) => -v),
      1.25,
      8.7,
      1.25,
      1.25,
      'circle',
      5,
    ),
  ];
  if (d >= 1) {
    for (let i = 0; i < 4; i++) {
      const f = faceFrame(plans.tower, i);
      for (let j = 0; j < 3; j++)
        fields.push({
          ...hole(
            `triple-light-${i}-${j}`,
            lerp(f.a, f.b, (j + 1) / 4),
            f.axis,
            f.normal,
            0.95,
            19.1,
            3.6,
            2.95,
            'round',
            2.5,
          ),
          kind: 'louver',
        });
      for (const t of [0.29, 0.71])
        fields.push({
          ...hole(
            `paired-belfry-${i}-${t}`,
            lerp(f.a, f.b, t),
            f.axis,
            f.normal,
            1.7,
            25,
            4.1,
            3.2,
            'round',
            2.5,
          ),
          kind: 'louver',
        });
    }
    for (let i = 0; i < nave.length; i++) {
      const f = faceFrame(nave, i);
      if (f.length > 25) {
        for (let j = 0; j < (d === 1 ? 3 : 6); j++)
          fields.push(
            hole(
              `nave-lancet-${i}-${j}`,
              lerp(f.a, f.b, (j + 0.5) / (d === 1 ? 3 : 6)),
              f.axis,
              f.normal,
              1.8,
              13.7,
              6,
              4.7,
              'pointed',
              2.5,
            ),
          );
      } else if (f.length > 4 && uv(lerp(f.a, f.b, 0.5))[0] > 40)
        fields.push(
          hole(
            `choir-lancet-${i}`,
            lerp(f.a, f.b, 0.5),
            f.axis,
            f.normal,
            2,
            11.6,
            7.6,
            6.3,
            'pointed',
            2.5,
          ),
        );
    }
  }
  if (d >= 2) {
    const r = coarse(main);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        q = uv(lerp(f.a, f.b, 0.5));
      if (f.length < 3.6 || q[0] < 5 || q[1] > 23) continue;
      fields.push(
        hole(
          `chapel-lancet-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          Math.min(1.8, f.length * 0.42),
          3.2,
          5.8,
          4.5,
          'pointed',
          2.2,
        ),
      );
    }
    for (const [edgeIndex, count] of [
      [26, 2],
      [27, 2],
      [28, 2],
    ]) {
      const f = faceFrame(main, edgeIndex);
      for (let j = 0; j < count; j++) {
        fields.push(
          hole(
            `south-range-light-${edgeIndex}-${j}`,
            lerp(f.a, f.b, (j + 1) / (count + 1)),
            f.axis,
            f.normal,
            1.25,
            4.1,
            3.3,
            3.3,
            'rect',
            2.5,
          ),
        );
      }
    }
  }
  return fields;
}
function panel(face, h, d) {
  pane(face, h, d, -0.32, h.kind === 'door' || h.kind === 'louver' ? 'door' : 'glass');
  if (d >= 1) archBand(face, h, d, h.kind === 'door' ? 0.36 : 0.18, 'trim', 0.08);
  if (d >= 2 && h.kind === 'louver') {
    const v = prepareOpening(h, 0, d),
      off = -0.2 * Math.sign(-v.axis[1] * h.normal[0] + v.axis[0] * h.normal[1]);
    for (let y = h.bottom + 0.45; y < h.bottom + h.spring - 0.1; y += 0.48)
      beam(face, v.point(-h.width * 0.4, y, off), v.point(h.width * 0.4, y, off), 0.12, 'door');
  } else if (d >= 2 && !h.kind && h.shape === 'pointed') {
    const v = prepareOpening(h, 0, d),
      off = 0.07 * Math.sign(-v.axis[1] * h.normal[0] + v.axis[0] * h.normal[1]);
    beam(
      face,
      v.point(0, h.bottom, off),
      v.point(0, h.bottom + h.height - 0.45, off),
      0.09,
      'trim',
    );
  }
}
function slopingRoof(face, r, eave, top) {
  const q = r.map(uv),
    lo = Math.min(...q.map((p) => p[0])),
    hi = Math.max(...q.map((p) => p[0])),
    vs = q.map((p) => p[1]),
    mid = (Math.min(...vs) + Math.max(...vs)) / 2,
    rad = (Math.max(...vs) - Math.min(...vs)) / 2;
  const ridges = r.map((v) => {
    const a = uv(v);
    return p(Math.max(lo + rad * 0.35, Math.min(hi - rad * 0.5, a[0])), mid);
  });
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(
      'roof',
      [at(r[i], eave), at(r[j], eave), at(ridges[j], top), at(ridges[i], top)],
      [0, 1, 0],
    );
  }
}
function lowerRoof(face, r, inner) {
  const rings = [r, scaled(inner, 0.97)],
    pts = rings.flat(),
    ids = earcut(pts.flat(), [r.length], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      'roof',
      ids.slice(i, i + 3).map((k) => at(pts[k], k < r.length ? 10.5 : 13.5)),
      [0, 1, 0],
    );
}
function church(out, face, d) {
  const fields = sarlatFields(d),
    bodyFields = fields.filter((h) => !h.name.startsWith('triple') && !h.name.startsWith('paired')),
    low = d <= 1 ? coarse(main) : main,
    roof = d === 0 ? coarse(nave) : nave;
  for (const id of rec.roles.northProjections) {
    const ring = rec.controls.find((b) => b.id === id).polygons[0].outline;
    solid(face, ring, footing, id === rec.roles.northProjections[0] ? 13 : 11.5, 'wall');
  }
  solid(face, low, footing, 0.08, 'wall');
  shell(out, d, low, footing, 10.5, bodyFields, 'wall');
  lowerRoof(face, low, roof);
  shell(
    out,
    d,
    roof,
    footing,
    21,
    fields.filter((h) => /nave-|choir-/.test(h.name)),
    'wall',
  );
  slopingRoof(face, roof, 21, 26);
  if (d >= 1) {
    band(face, roof, 20.6, 0.4, 'trim', 1.015);
    band(face, low, 10.1, 0.35, 'trim', 1.005);
  }
  for (const h of fields.filter(
    (h) =>
      !h.name.startsWith('west') && !h.name.startsWith('triple') && !h.name.startsWith('paired'),
  ))
    panel(face, h, d);
  // The long attached south range is a mapped projection, not another detached church.
  if (d >= 1) {
    slopingRoof(face, plans.southRange, 10.5, 14);
  }
  if (d >= 1) {
    const positions = d === 1 ? [13, 29, 40] : [8, 16, 24, 32, 40];
    for (const side of [-1, 1])
      for (const u of positions) {
        const v = side < 0 ? -17.7 : 17.7,
          q = p(u, v),
          hi = p(u, side < 0 ? -6.5 : 9.5);
        solid(face, rect(u - 0.46, v - 0.55, u + 0.46, v + 0.55), footing, 13.1, 'wall');
        solid(face, rect(u - 0.35, v - 0.4, u + 0.35, v + 0.4), 13.1, 16, 'trim');
        // Faceted rising arch band; the opening below remains genuine air.
        const steps = d === 1 ? 3 : 6;
        for (let i = 0; i < steps; i++) {
          const a = i / steps,
            b = (i + 1) / steps,
            curve = (t) => lerp(q, hi, t),
            y = (t) => 12.2 + 5.7 * Math.sqrt(Math.max(0, t)),
            pa = curve(a),
            pb = curve(b);
          beam(face, at(pa, y(a)), at(pb, y(b)), 0.55, 'wall');
        }
        if (d >= 2)
          profile(
            face,
            circle(q, 0.32, 4),
            [
              [16, 1],
              [17.4, 0.05],
            ],
            'trim',
          );
      }
  }
  const stair = circle(plans.turretCenter, plans.turretRadius, d === 0 ? 6 : d === 1 ? 8 : 12);
  solid(face, stair, footing, 23, 'wall');
  profile(
    face,
    scaled(stair, 1.12),
    [
      [23, 1],
      [26.7, 0.04],
    ],
    'roof',
  );
  if (d >= 2) {
    for (const y of [7, 14, 20]) {
      band(face, stair, y, 0.18, 'trim', 1.1);
      const f = faceFrame(stair, 1),
        q = lerp(f.a, f.b, 0.5),
        h = hole(`stair-turret-slit-${y}`, q, f.axis, f.normal, 0.25, y + 0.7, 1.2, 1.2, 'rect', 1);
      pane(face, h, d, 0.03, 'glass');
    }
  }
}
function clock(face, d) {
  if (d < 1) return;
  const h = hole(
    'small-west-clock',
    p(-4.31, 0),
    T,
    L.map((v) => -v),
    1.65,
    13.4,
    1.65,
    1.65,
    'circle',
    1,
  );
  pane(face, h, d, 0.05, 'trim');
  archBand(face, h, d, 0.12, 'trim', 0.08);
  const f = prepareOpening(h, 0, d),
    off = 0.12 * Math.sign(-f.axis[1] * h.normal[0] + f.axis[0] * h.normal[1]),
    mid = h.bottom + h.height / 2;
  beam(face, f.point(0, mid, off), f.point(0.55, mid + 0.1, off), 0.08, 'metal');
  beam(face, f.point(0, mid, off), f.point(-0.2, mid + 0.61, off), 0.09, 'metal');
}
function tower(out, face, d) {
  const r = plans.tower,
    fields = sarlatFields(d).filter((h) => /west-|triple|paired/.test(h.name));
  shell(out, d, r, footing, 30, fields, 'wall');
  cap(face, r, 30, 'wall');
  shell(
    out,
    d,
    plans.porch,
    footing,
    7.1,
    fields.filter((h) => h.kind === 'door'),
    'wall',
  );
  cap(face, plans.porch, 7.1, 'trim');
  for (const h of fields) panel(face, h, d);
  if (d >= 1) {
    for (const y of [17.7, 24, 29.6]) {
      band(face, r, y, 0.35, 'trim', 1.025);
      cap(face, scaled(r, 1.025), y + 0.35, 'trim');
    }
    for (const i of [0, 1, 3]) {
      const f = faceFrame(r, i),
        h = hole(
          `blind-lower-arch-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          6,
          5.6,
          10.6,
          7.6,
          'round',
          1,
        );
      archBand(face, h, d, 0.32, 'trim', 0.08);
    }
    for (const corner of r) solid(face, circle(corner, 0.3, 4), footing, 17.7, 'trim');
  }
  clock(face, d);
  const capRing = scaled(r, 1.13),
    levels =
      d === 0
        ? [
            [30, 1],
            [36.2, 0.62],
            [37.1, 0.74],
            [40.5, 0.45],
            [44.3, 0.15],
          ]
        : [
            [30, 1],
            [30.8, 0.95],
            [34.8, 0.72],
            [36.2, 0.62],
            [36.5, 0.74],
            [37.5, 0.72],
            [39.2, 0.57],
            [42, 0.3],
            [44.3, 0.15],
          ];
  profile(face, capRing, levels, 'roof');
  const o = plans.origin,
    lantern = circle(o, 0.65, d === 0 ? 4 : 8);
  solid(face, lantern, 44.3, 44.6, 'metal');
  for (const q of lantern) solid(face, circle(q, 0.1, 4), 44.6, 47.5, 'metal');
  cap(face, scaled(lantern, 1.15), 47.5, 'roof');
  profile(
    face,
    scaled(lantern, 1.2),
    [
      [47.5, 1],
      [49.2, 0.25],
      [49.6, 0.04],
    ],
    'roof',
  );
  beam(face, at(o, 49.6), at(o, 51), 0.13, 'metal');
  beam(face, at(p(-0.5, 0), 50.6), at(p(0.5, 0), 50.6), 0.12, 'metal');
  if (d >= 2) {
    const q = p(-5.35, 0);
    beam(
      face,
      at([q[0] - T[0] * 1.9, q[1] - T[1] * 1.9], 5.4),
      at([q[0] + T[0] * 1.9, q[1] + T[1] * 1.9], 5.4),
      0.4,
      'trim',
    );
    for (const side of [-1, 1]) {
      const a = p(-4.65, side * 3.5);
      profile(
        face,
        circle(a, 0.29, 6),
        [
          [5.7, 1.2],
          [7.1, 0.7],
          [7.8, 0.3],
        ],
        'trim',
      );
      solid(face, circle(a, 0.2, 6), 7.8, 8.2, 'trim');
    }
  }
}
function build(target, d) {
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
        target.addTriangle(a[0], a[1], p, a[3], a[4], a[5]);
      },
    },
    face = writer(out, d);
  church(out, face, d);
  tower(out, face, d);
}
export const buildSarlatSkyline = (o) => build(o, 0),
  buildSarlatDistrict = (o) => build(o, 1),
  buildSarlatStreet = (o) => build(o, 2),
  buildSarlatCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const sarlatCathedralStudy = {
  id: 'sarlat_cathedral',
  key: 'sarlat_cathedral',
  title: 'Sarlat Cathedral',
  category: 'cathedral',
  wikidataId: 'Q2942447',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: { horizontalBasis: rec.identityBasis, architecturalHeights: rec.heightBasis },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  build: buildSarlatCloseup,
  sourceDocuments: scope.sourceDocuments,
  sourceUrl: 'https://www.wikidata.org/wiki/Q2942447',
  sourceLicense:
    'Original deterministic medium-fi exterior; retained/current OSM outline controls ODbL-1.0, ©OpenStreetMap contributors. Reference photograph metadata retained; photographs not redistributed. Standard viewer terrain tiles.',
  sourceNotice:
    'Five existing shared 256-square ashlar, sandstone, slate, plain wood and painted metal graphs serve six groups including local blue-grey glass. Linear tints, metric UVs and flat architectural normals. No embedded images, unique facade photographs, baked lighting or micro-carving.',
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
    'Four inspected photographs and standard viewer PMTiles guide an approximate medium-fi exterior. All heights and detailed component partitions estimated. Fine tracery, sculpture, current finish, bells/interiors, engineering and exact host-ground contact simplified or unverified. Stair slits are shallow surface marks. Paired belfry lights retain dark louver panels; only the little top lantern is open. Synthetic Cotswold cottages are style fixtures, not a reconstruction of Sarlat. Physical phone/laptop timing pending.',
    'Skyline retains the oblique high choir, irregular low chapel envelope, porch tower, two-stage bulb roof/open lantern and round stair turret. District adds shared surfaces, paired/triple belfry lights, clerestory/choir recesses, blind tower arches and flying buttresses. Street adds chapel lancets, mullions, louvers and buttress finials. Close-up/master retain sparse portal sculpture abstractions and the small clock.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-tower-porch-and-small-clock', [-76, 27, 38], [-25.6, 16, 10.9]),
    cam('layered-slate-bulb-and-open-lantern', [-49, 48, 41], [-25.6, 38, 10.9]),
    cam('north-nave-flying-buttresses', [-22, 30, -68], [-1, 15, -5]),
    cam('east-choir-and-chapels', [74, 30, -29], [22, 15, -12]),
    cam('south-wing-and-stair-turret', [49, 38, 54], [9, 14, 3]),
    cam('roof-and-signed-plan', [0, 150, 0.1], [0, 16, 0]),
  ],
};

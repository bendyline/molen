/** Beijing Nantang: grey-brick scroll front, long oculus hall and northern octagonal dome. */
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
  '../../../content/worldgen/source/places/wx/wx4/cathedral_of_the_immaculate_conception/',
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
  wall: '#c3c3bb',
  trim: '#d2d0c2',
  roof: '#727c7f',
  cap: '#c0c2b8',
  door: '#815d4c',
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
const footing = (p) => Math.min(floor - 0.3, beijingImmaculateGround(...p) - 0.35);
export function beijingImmaculateGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Beijing Nantang footing outside retained terrain');
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
const circle = (o, r, n) =>
  Array.from({ length: n }, (_, i) => [
    o[0] + Math.cos((i * Math.PI * 2) / n) * r,
    o[1] + Math.sin((i * Math.PI * 2) / n) * r,
  ]);
const segments = (d) => (d === 0 ? 8 : d === 1 ? 8 : d === 2 ? 16 : 24);
function section(r, value, axis = 1) {
  const hits = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if ((a[axis] <= value && b[axis] > value) || (b[axis] <= value && a[axis] > value)) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      hits.push(a[1 - axis] + t * (b[1 - axis] - a[1 - axis]));
    }
  }
  return hits;
}
export const nantangFrontX = (z) => Math.max(...section(main, Math.max(-10.5, Math.min(10.5, z))));
export const nantangRearX = (z) => Math.min(...section(main, z));
const sideZ = (x, side) => {
  const hits = section(main, x, 0);
  return side < 0 ? Math.min(...hits) : Math.max(...hits);
};
function clipRear(r, x) {
  const out = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      inside = a[0] <= x,
      next = b[0] <= x;
    if (inside) out.push(a);
    if (inside !== next) {
      const t = (x - a[0]) / (b[0] - a[0]);
      out.push([x, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}
export function nantangFields(d = 3) {
  const fields = [];
  for (const z of d === 0 ? [0] : [-7, 0, 7])
    fields.push({
      ...hole(
        `south-portal-${z}`,
        [nantangFrontX(z), z],
        [0, 1],
        [1, 0],
        z === 0 ? 3.3 : 2.0,
        0.15,
        z === 0 ? 5.3 : 4.2,
        z === 0 ? 3.65 : 3.2,
        'round',
        5,
      ),
      kind: 'door',
      curved: true,
    });
  if (d >= 1) {
    for (const z of [-7, 0, 7])
      fields.push({
        ...hole(
          `south-upper-light-${z}`,
          [nantangFrontX(z), z],
          [0, 1],
          [1, 0],
          z === 0 ? 3.2 : 1.8,
          z === 0 ? 10.2 : 9.9,
          z === 0 ? 4.2 : 3.2,
          z === 0 ? 2.6 : 2.3,
          'round',
          5,
        ),
        curved: true,
      });
    for (const side of [-1, 1])
      for (const x of d === 1 ? [-12, -3, 6, 15, 24] : [-14, -9.5, -5, -0.5, 4, 8.5, 13, 17.5, 22])
        fields.push(
          hole(
            `nave-oculus-${side}-${x}`,
            [x, sideZ(x, side)],
            [1, 0],
            [0, side],
            1.65,
            11.0,
            1.65,
            1.65,
            'circle',
            2,
          ),
        );
  }
  if (d >= 2) {
    for (const side of [-1, 1])
      for (const x of [-14, -0.5, 13])
        fields.push(
          hole(
            `nave-lower-light-${side}-${x}`,
            [x, sideZ(x, side)],
            [1, 0],
            [0, side],
            1.4,
            3.6,
            4.0,
            3.3,
            'round',
            2,
          ),
        );
    for (const z of [-5, 0, 5])
      fields.push(
        hole(
          `rear-arched-light-${z}`,
          [nantangRearX(z), z],
          [0, 1],
          [-1, 0],
          1.1,
          8.6,
          2.9,
          2.35,
          'round',
          7,
        ),
      );
  }
  return fields;
}
export function nantangDrumFields(d = 3) {
  if (d === 0) return [];
  const drum = plans.drum,
    r = circle(drum.center, drum.radius, 8);
  return r.map((_, i) => {
    const e = faceFrame(r, i);
    return hole(
      `drum-light-${i}`,
      lerp(e.a, e.b, 0.5),
      e.axis,
      e.normal,
      1.5,
      18.5,
      4.3,
      3.55,
      'round',
      2,
    );
  });
}
function warpedFace(face, h, d = 3) {
  return (slot, points, n, col) => {
    function emit(p, depth = 0) {
      let error = 0;
      let edge = 0;
      for (let i = 0; i < 3; i++) {
        const a = p[i][2],
          b = p[(i + 1) % 3][2];
        const e = Math.abs(nantangFrontX((a + b) / 2) - (nantangFrontX(a) + nantangFrontX(b)) / 2);
        if (e > error) {
          error = e;
          edge = i;
        }
      }
      const tolerance = d === 1 && slot === 'trim' ? 0.1 : 0.0075;
      if (error > tolerance && depth < 14) {
        const a = edge,
          b = (edge + 1) % 3,
          c = (edge + 2) % 3;
        const mid = lerp(p[a], p[b], 0.5);
        emit([p[a], mid, p[c]], depth + 1);
        emit([mid, p[b], p[c]], depth + 1);
        return;
      }
      face(
        slot,
        p.map((q) => [nantangFrontX(q[2]) + q[0] - h.center[0], q[1], q[2]]),
        n,
        col,
      );
    }
    for (let i = 1; i < points.length - 1; i++) emit([points[0], points[i], points[i + 1]]);
  };
}
function panel(face, h, d) {
  const emit = h.curved
    ? warpedFace(face, h, d)
    : h.name.startsWith('rear-arched-')
      ? (slot, p, n, col) =>
          face(
            slot,
            p.map((q) => [nantangRearX(q[2]) + q[0] - h.center[0], q[1], q[2]]),
            n,
            col,
          )
      : face;
  pane(emit, h, d, -0.32, h.kind === 'door' ? 'door' : 'glass');
  if (d >= 1) archBand(emit, h, d, h.kind === 'door' ? 0.35 : 0.19, 'trim');
  if (d >= 2 && h.kind !== 'door' && h.shape !== 'circle') {
    const p = prepareOpening(h, 0, d),
      sgn = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    beam(
      emit,
      p.point(0, h.bottom + 0.1, -0.15 * sgn),
      p.point(0, h.bottom + h.spring, -0.15 * sgn),
      0.1,
      'door',
    );
  }
}
function church(out, face, d) {
  const fields = nantangFields(d);
  shell(out, d, main, footing, 15.2, fields);
  cap(face, main, 15.2, 'cap');
  const maskedFace = writer(
    masked(
      out,
      fields.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  gable(maskedFace, plans.nave, 15.8, 18.4);
  sides(face, plans.nave, 15.2, 15.8, 'wall');
  const rear = clipRear(main, -17);
  cap(face, rear, 16.3, 'cap');
  sides(face, rear, 15.2, 16.3, 'wall');
  if (d >= 1) {
    band(face, main, 14.65, 0.25, 'trim', 1.004);
    band(face, main, 15.15, 0.35, 'trim', 1.01);
    band(face, rear, 16.3, 0.4, 'trim', 1.003);
  }
  if (d >= 2) {
    for (const side of [-1, 1])
      for (const x of [-16.25, -11.75, -7.25, -2.75, 1.75, 6.25, 10.75, 15.25, 19.75, 25.3]) {
        const z = sideZ(x, side);
        solid(face, R(x - 0.22, z - 0.18, x + 0.22, z + 0.18), 0.3, 14.5, 'trim');
        solid(face, R(x - 0.43, z - 0.25, x + 0.43, z + 0.25), 13.8, 14.5, 'trim');
      }
    // Sparse rear attic balusters; the long nave keeps its broad horizontal cornice.
    for (let i = 0; i < rear.length; i++) {
      const a = rear[i],
        b = rear[(i + 1) % rear.length];
      if (Math.abs(a[0] + 17) < 0.01 && Math.abs(b[0] + 17) < 0.01) continue;
      const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 2.4);
      for (let j = 0; j <= count; j++) {
        const p = lerp(a, b, j / count);
        solid(face, R(p[0] - 0.12, p[1] - 0.12, p[0] + 0.12, p[1] + 0.12), 16.7, 17.3, 'trim');
      }
      beam(face, at(a, 17.3), at(b, 17.3), 0.16, 'trim');
    }
  }
  for (const h of fields) panel(face, h, d);
}
function frontScreen(_out, face, d) {
  let profile = plans.facadeProfile;
  if (d === 0) profile = profile.filter((_, i) => [0, 2, 5, 8, 10, 12, 14, 15].includes(i));
  const right = profile.map(([z, y]) => [Math.min(z, 10.5), y]),
    left = right
      .slice(1)
      .map(([z, y]) => [-z, y])
      .toReversed(),
    outline = [...left, ...right, [10.5, 15.2], [-10.5, 15.2]],
    front = ([z, y], offset = 0) => [nantangFrontX(z) + offset, floor + y, z],
    ids = earcut(outline.flat(), [], 2);
  // Each strip follows one straight mapped facade segment. Its faces remain
  // vertical, so the shared brick's metric courses cannot tilt across triangles.
  const cuts = [
    -10.5,
    ...main.filter((p) => p[0] > 28 && Math.abs(p[1]) < 10.5).map((p) => p[1]),
    10.5,
  ].sort((a, b) => a - b);
  function clipZ(points, boundary, sign) {
    const result = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      const inside = (a[0] - boundary) * sign >= 0,
        next = (b[0] - boundary) * sign >= 0;
      if (inside) result.push(a);
      if (inside !== next) result.push(lerp(a, b, (boundary - a[0]) / (b[0] - a[0])));
    }
    return result;
  }
  function screenTriangle(points) {
    for (let i = 1; i < cuts.length; i++) {
      const strip = clipZ(clipZ(points, cuts[i - 1], 1), cuts[i], -1);
      if (strip.length < 3) continue;
      face(
        'wall',
        strip.map((p) => front(p)),
        [1, 0, 0],
      );
      face(
        'wall',
        strip.map((p) => front(p, -1)),
        [-1, 0, 0],
      );
    }
  }
  for (let i = 0; i < ids.length; i += 3)
    screenTriangle(ids.slice(i, i + 3).map((k) => outline[k]));
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    face('trim', [front(a), front(b), front(b, -1), front(a, -1)]);
  }
  if (d >= 1) {
    for (const z of [-5.0, -4.45, 4.45, 5.0]) {
      const x = nantangFrontX(z);
      solid(face, R(x - 0.02, z - 0.22, x + 0.28, z + 0.22), 0.25, 22.4, 'trim');
      for (const y of d === 1 ? [0.25, 14.7, 22.05] : [0.25, 8.2, 14.7, 21.6, 22.05])
        solid(face, R(x - 0.02, z - 0.4, x + 0.44, z + 0.4), y, y + 0.3, 'trim');
    }
    for (const [y, width] of [
      [8.2, 21],
      [15.2, 21],
      [22.4, 10.6],
      [26.6, 5.4],
    ]) {
      const count = Math.ceil(width / (d === 1 ? 4 : 2));
      for (let i = 0; i < count; i++) {
        const a = -width / 2 + (i * width) / count,
          b = a + width / count;
        beam(
          face,
          [nantangFrontX(a) + 0.17, floor + y, a],
          [nantangFrontX(b) + 0.17, floor + y, b],
          0.25,
          'trim',
        );
      }
    }
    for (const [z, y, w, h] of [
      [0, 19.4, 2.3, 2.5],
      [0, 24.6, 1.6, 1.6],
    ]) {
      const med = hole(
          'stone-medallion',
          [nantangFrontX(z), z],
          [0, 1],
          [1, 0],
          w,
          y,
          h,
          h,
          'circle',
          1,
        ),
        emit = warpedFace(face, med, d);
      pane(emit, med, d, 0.12, 'trim');
      archBand(emit, med, d, 0.16, 'trim');
      const p = prepareOpening(med, 0, d);
      beam(
        emit,
        p.point(0, med.bottom + 0.3, -0.24),
        p.point(0, med.bottom + h - 0.3, -0.24),
        0.13,
        'wall',
      );
      beam(
        emit,
        p.point(-w * 0.3, med.bottom + h * 0.57, -0.24),
        p.point(w * 0.3, med.bottom + h * 0.57, -0.24),
        0.13,
        'wall',
      );
    }
  }
  if (d >= 2) {
    for (const side of [-1, 1]) {
      const z = side * 7.5,
        h = hole(
          'large-shoulder-volute',
          [nantangFrontX(z), z],
          [0, 1],
          [1, 0],
          2.3,
          15.1,
          2.3,
          2.3,
          'circle',
          1,
        ),
        emit = warpedFace(face, h);
      for (const w of [0.2, 0.65])
        archBand(
          emit,
          { ...h, width: h.width - w, height: h.height - w, bottom: h.bottom + w / 2 },
          d,
          0.15,
          'trim',
        );
    }
    for (const z of [-10.05, 10.05]) {
      const x = nantangFrontX(z);
      solid(face, R(x - 0.3, z - 0.35, x + 0.3, z + 0.35), 15.5, 16.4, 'trim');
      profileCap(face, [x, z], 16.4, 17.5, 0.52, d);
    }
    const x = nantangFrontX(0);
    for (let i = 0; i < 3; i++)
      solid(
        face,
        R(x - 0.15, -2.5, x + 0.9 - i * 0.2, 2.5),
        0.02 + i * 0.15,
        0.15 + i * 0.15,
        'trim',
      );
  }
  const x = nantangFrontX(0);
  beam(face, [x, floor + 27.7, 0], [x, floor + 29.6, 0], d === 0 ? 0.22 : 0.16, 'trim');
  beam(face, [x, floor + 28.95, -0.6], [x, floor + 28.95, 0.6], d === 0 ? 0.22 : 0.16, 'trim');
}
function profileCap(face, o, b, t, r, d) {
  profile(
    face,
    circle(o, r, d === 0 ? 4 : 8),
    [
      [b, 1],
      [b + 0.15, 1.1],
      [t, 0.12],
    ],
    'cap',
  );
}
function drum(out, face, d) {
  const a = plans.drum,
    r = circle(a.center, a.radius, 8),
    fields = nantangDrumFields(d);
  shell(out, d, r, a.bottom, a.wall, fields);
  cap(face, r, a.wall, 'trim');
  for (const y of d === 0 ? [a.wall] : [a.bottom, a.bottom + 0.7, a.wall - 0.65, a.wall])
    band(face, r, y, 0.25, 'trim', 1.08);
  for (const h of fields) panel(face, h, d);
  if (d >= 1)
    for (const p of r) {
      solid(
        face,
        R(p[0] - 0.15, p[1] - 0.15, p[0] + 0.15, p[1] + 0.15),
        a.bottom + 0.8,
        a.wall - 0.4,
        'trim',
      );
      if (d >= 2)
        solid(
          face,
          R(p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3),
          a.wall - 0.9,
          a.wall - 0.4,
          'trim',
        );
    }
  const ring = circle(a.center, a.radius, segments(d)),
    levels =
      d === 0
        ? [
            [24.5, 1.08],
            [26.2, 0.94],
            [28.4, 0.4],
            [29, 0.08],
          ]
        : [
            [24.5, 1.08],
            [25, 1.04],
            [26.2, 0.94],
            [27.5, 0.7],
            [28.4, 0.4],
            [29, 0.08],
          ];
  profile(face, ring, levels, 'cap');
  if (d >= 2) {
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4,
        n = [Math.cos(ang), Math.sin(ang)];
      for (let k = 1; k < levels.length; k++) {
        const [y, f] = levels[k - 1],
          [v, g] = levels[k];
        beam(
          face,
          [
            a.center[0] + n[0] * a.radius * (f + 0.012),
            floor + y,
            a.center[1] + n[1] * a.radius * (f + 0.012),
          ],
          [
            a.center[0] + n[0] * a.radius * (g + 0.012),
            floor + v,
            a.center[1] + n[1] * a.radius * (g + 0.012),
          ],
          0.1,
          'trim',
        );
      }
    }
  }
  beam(
    face,
    [a.center[0], floor + 28.9, a.center[1]],
    [a.center[0], floor + a.tip, a.center[1]],
    d === 0 ? 0.24 : 0.16,
    'trim',
  );
  beam(
    face,
    [a.center[0] - 0.5, floor + a.tip - 0.5, a.center[1]],
    [a.center[0] + 0.5, floor + a.tip - 0.5, a.center[1]],
    d === 0 ? 0.24 : 0.16,
    'trim',
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
    if (longest > 20) {
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
  frontScreen(out, face, d);
  drum(out, face, d);
}
export const buildBeijingImmaculateSkyline = (o) => build(o, 0),
  buildBeijingImmaculateDistrict = (o) => build(o, 1),
  buildBeijingImmaculateStreet = (o) => build(o, 2),
  buildBeijingImmaculateCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const beijingImmaculateStudy = {
  id: 'cathedral_of_the_immaculate_conception',
  key: 'cathedral_of_the_immaculate_conception',
  title: 'Cathedral of the Immaculate Conception',
  category: 'cathedral',
  wikidataId: 'Q1188864',
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
    'Five existing shared256² brick,raw limestone,flat tile,painted metal and plain wood graphs serve six merged groups including local blue-grey glass. Grey brick/pale trim,low grey roof and pale dome use linear tints,metric UVs and flat architectural normals. No embedded images,unique facade photographs,bespoke textures or baked lighting.',
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
    'Individual medium-fi exterior from four inspected2003/2005/2010 pictures and standard viewer PMTiles/DEM. All heights and detailed partitions are estimates. Curved Baroque screen,volutes,medallions,capitals,cornices,balustrades,roof and dome/ribs are abstractions. Hidden lower/side/rear doors,faithful coat of arms,inscriptions,stained-glass art,fine sculpture,interiors/bells,current finish,engineering and exact courtyard/street/threshold/base contact remain simplified,excluded or unverified. Glazing fields are recessed blue-grey panes; no claim of open interior passage. Courtyard building,gate/shrine,trees/wires,street and neighboring town remain host content. East Asian attached neighbors are synthetic fixtures;physical phone/laptop timing unverified.',
    'Skyline retains the curved high south screen/cross,long low nave roof and northern octagonal drum/dome/cross. District adds shared materials,simplified front portals/lights,medallions,paired pilasters,round nave oculi and drum lights. Street adds full bay rhythm,lower lights,volutes,pedestals/steps,rear attic balusters and dome ribs. Close-up/master refine curved sampling.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('south-baroque-screen-and-three-portals', [78, 18, 0], [29, 14, 0]),
    cam('scrolls-paired-pilasters-and-crown', [55, 29, 20], [30, 22, 0]),
    cam('long-west-oculi-and-cornice', [0, 24, 65], [0, 10, 8]),
    cam('north-drum-dome-and-rear', [-62, 32, 28], [-23, 22, 0]),
    cam('east-side-and-quiet-host-boundary', [-2, 29, -65], [0, 11, -7]),
    cam('roof-and-signed-plan', [0, 125, 0.1], [0, 12, 0]),
  ],
};

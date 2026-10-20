/** Cavern of the Patriarchs: pilastered ashlar enclosure and square corner minarets. */
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

const openingShape = (h, d) => {
  if (h.shape === 'pointed') {
    const w = h.width / 2,
      n = d <= 0 ? 1 : d === 1 ? 2 : d === 2 ? 3 : d === 3 ? 5 : 6,
      points = [
        [-w, h.bottom],
        [w, h.bottom],
        [w, h.bottom + h.spring],
      ];
    for (let i = 1; i <= n; i++) {
      const a = ((i / n) * Math.PI) / 3;
      points.push([
        -w + 2 * w * Math.cos(a),
        h.bottom + h.spring + ((h.height - h.spring) * Math.sin(a)) / Math.sin(Math.PI / 3),
      ]);
    }
    for (let i = 1; i <= n; i++) {
      const a = (Math.PI * 2) / 3 + ((i / n) * Math.PI) / 3;
      points.push([
        w + 2 * w * Math.cos(a),
        h.bottom + h.spring + ((h.height - h.spring) * Math.sin(a)) / Math.sin(Math.PI / 3),
      ]);
    }
    return points;
  }
  if (h.shape === 'circle')
    return Array.from({ length: d <= 1 ? 8 : 16 }, (_, i) => {
      const a = (i * Math.PI * 2) / (d <= 1 ? 8 : 16);
      return [(Math.cos(a) * h.width) / 2, h.bottom + h.height / 2 + (Math.sin(a) * h.height) / 2];
    });
  return baseOpeningShape(h, d);
};
function prepareOpening(h, b, d) {
  const v = basePrepareOpening(h, b, d);
  if (!['circle', 'pointed'].includes(h.shape)) return v;
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
  '../../../content/worldgen/source/places/sv/sv8/n0428_cavern_of_the_patriarchs/',
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
  wall: '#d2b996',
  trim: '#ddceb1',
  roof: '#6b7177',
  door: '#735b49',
  glass: '#52636b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, patriarchsGround(...p) - 0.35);
export function patriarchsGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Cavern of the Patriarchs footing outside retained terrain');
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
function _faceFrame(r, i) {
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
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
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
const _band = (face, r, y, h = 0.25, slot = 'trim', factor = 1.02) =>
  sides(face, scaled(r, factor), y, y + h, slot);
function beam(face, a, b, w, slot = 'trim', capped = true) {
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
  if (capped) {
    face(
      slot,
      lo,
      axis.map((v) => -v),
    );
    face(slot, hi, axis);
  }
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(slot, [lo[i], lo[j], hi[j], hi[i]]);
  }
}
const _coarse = (r) => {
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
function profile(face, ring, levels, slot, origin = center(ring)) {
  const scale = (f) => ring.map((p) => p.map((v, k) => origin[k] + (v - origin[k]) * f));
  let prev = scale(levels[0][1]);
  for (let i = 1; i < levels.length; i++) {
    const r = scale(levels[i][1]);
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
const plans = rec.plans;
const rect = (x, z, w, h) => [
  [x - w / 2, z - h / 2],
  [x + w / 2, z - h / 2],
  [x + w / 2, z + h / 2],
  [x - w / 2, z + h / 2],
];
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
    p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
  ]);
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      center: lerp(a, b, 0.5),
      length: Math.hypot(...b.map((v, k) => v - a[k])),
    };
  });
const field = (name, center, axis, normal, width, bottom, height, spring, depth = 1) => ({
  name,
  center,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape: 'pointed',
  depth,
});
const point = (h, u, y, dep = 0) => [
  h.center[0] + h.axis[0] * u + h.normal[0] * dep,
  y,
  h.center[1] + h.axis[1] * u + h.normal[1] * dep,
];
function down(face, r, y, slot, holes = []) {
  const pts = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(pts.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(pts[k], y)),
      [0, -1, 0],
    );
}
function inset(r, amount) {
  const es = edges(r).map((e) => ({ ...e, a: e.a.map((v, k) => v - e.normal[k] * amount) }));
  return es.map((e, i) => {
    const p = es[(i + es.length - 1) % es.length],
      d = p.axis[0] * e.axis[1] - p.axis[1] * e.axis[0],
      q = e.a.map((v, k) => v - p.a[k]),
      t = (q[0] * e.axis[1] - q[1] * e.axis[0]) / d;
    return p.a.map((v, k) => v + p.axis[k] * t);
  });
}
export function patriarchsEntryFields(d = 3) {
  if (d === 0) return [];
  return ['sidePortal', 'westPortal'].map((key) => {
    const p = plans[key],
      axis = unit(p.axis),
      normal = unit(p.normal);
    return field(key, p.center, axis, normal, p.width, p.bottom, p.height, p.spring, 2.2);
  });
}
export function patriarchsTowerFields(d = 3) {
  if (d === 0) return [];
  const result = [];
  for (const p of plans.towers)
    for (const [i, e] of edges(rect(...p.center, p.width, p.width)).entries())
      for (const y of [18.0, 20.2])
        for (const u of [-0.23, 0.23])
          result.push(
            field(
              `${p.name}-${i}-${y}-${u}`,
              e.center.map((v, k) => v + e.axis[k] * u * p.width),
              e.axis,
              e.normal,
              0.32,
              y,
              1.1,
              0.76,
              1.3,
            ),
          );
  return result;
}
function finishFields(face, fields, d) {
  for (const h of fields) {
    pane(face, h, d, -0.25, h.name.includes('Portal') ? 'door' : 'glass');
    if (d > 1) archBand(face, h, d, h.name.includes('Portal') ? 0.24 : 0.11, 'trim', 0.025);
  }
}
function gable(face, r, eave, ridge) {
  let [A, B, C, D] = r;
  if (Math.hypot(...A.map((v, k) => v - B[k])) < Math.hypot(...B.map((v, k) => v - C[k])))
    [A, B, C, D] = [B, C, D, A];
  const p = lerp(A, D, 0.5),
    q = lerp(B, C, 0.5);
  face('wall', [at(A, eave), at(D, eave), at(p, ridge)]);
  face('wall', [at(B, eave), at(C, eave), at(q, ridge)]);
  face('trim', [at(A, eave), at(B, eave), at(q, ridge), at(p, ridge)], [0, 1, 0]);
  face('trim', [at(C, eave), at(D, eave), at(p, ridge), at(q, ridge)], [0, 1, 0]);
}
function merlon(face, e, u, width, d) {
  const h = { ...e, center: e.center.map((v, k) => v + e.axis[k] * u) },
    bottom = 16.45,
    top = 17.6,
    thick = 0.85;
  if (d === 0) {
    const p = [
      [-width / 2, bottom],
      [width / 2, bottom],
      [width / 2, top],
      [-width / 2, top],
    ];
    for (const dep of [0, -thick])
      face(
        'wall',
        p.map((v) => point(h, v[0], floor + v[1], dep)),
        [h.normal[0] * (dep === 0 ? 1 : -1), 0, h.normal[1] * (dep === 0 ? 1 : -1)],
      );
    for (let i = 0; i < 4; i++) {
      const a = p[i],
        b = p[(i + 1) % 4];
      face('wall', [
        point(h, a[0], floor + a[1], 0),
        point(h, b[0], floor + b[1], 0),
        point(h, b[0], floor + b[1], -thick),
        point(h, a[0], floor + a[1], -thick),
      ]);
    }
    return;
  }
  const n = d === 1 ? 3 : d === 2 ? 4 : 6,
    p = [
      [-width / 2, bottom],
      [width / 2, bottom],
      [width / 2, top - width / 2],
    ];
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI;
    p.push([(Math.cos(a) * width) / 2, top - width / 2 + (Math.sin(a) * width) / 2]);
  }
  for (const dep of [0, -thick])
    face(
      'wall',
      p.map((v) => point(h, v[0], floor + v[1], dep)),
      [h.normal[0] * (dep === 0 ? 1 : -1), 0, h.normal[1] * (dep === 0 ? 1 : -1)],
    );
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face('wall', [
      point(h, a[0], floor + a[1], 0),
      point(h, b[0], floor + b[1], 0),
      point(h, b[0], floor + b[1], -thick),
      point(h, a[0], floor + a[1], -thick),
    ]);
  }
}
function enclosure(out, face, d) {
  const fields = patriarchsEntryFields(d),
    inner = inset(plans.enclosure, 1.4);
  shell(out, d, plans.enclosure, 0, 16.2, fields, 'wall', inner);
  const coping = inset(plans.enclosure, -0.1),
    inside = inset(plans.enclosure, 1.48);
  sides(face, coping, 16.2, 16.45, 'trim');
  cap(face, coping, 16.45, 'trim', [inside]);
  down(face, coping, 16.2, 'trim', [plans.enclosure]);
  for (const e of edges(plans.enclosure)) {
    const count = Math.max(2, Math.floor(e.length / (d === 0 ? 8 : d === 1 ? 2.8 : 1.9))),
      step = e.length / count;
    for (let i = 0; i < count; i++)
      merlon(
        face,
        e,
        -e.length / 2 + (i + 0.5) * step,
        d === 0 ? 2.1 : Math.min(0.88, step * 0.48),
        d,
      );
    const pilasters =
      d === 0 ? Math.max(2, Math.floor(e.length / 14)) : Math.max(3, Math.round(e.length / 3.7));
    for (let i = 0; i < pilasters; i++) {
      const u = -e.length / 2 + ((i + 0.5) * e.length) / pilasters,
        w = d === 0 ? 0.85 : 0.68,
        dep = 0.24,
        h = { ...e, center: e.center.map((v, k) => v + e.axis[k] * u) },
        ring = [
          [-w / 2, 0],
          [w / 2, 0],
          [w / 2, dep],
          [-w / 2, dep],
        ].map(([u, t]) => [
          h.center[0] + e.axis[0] * u + e.normal[0] * t,
          h.center[1] + e.axis[1] * u + e.normal[1] * t,
        ]);
      solid(face, ring, 7.2, 16.1, 'wall');
      if (d > 1) {
        cap(face, ring, 16.12, 'trim');
        solid(face, ring, 7.0, 7.35, 'trim');
      }
    }
  }
  finishFields(face, fields, d);
  if (d > 1) {
    const h = fields[0],
      ring = openingShape(h, d),
      outer = openingShape(
        {
          ...h,
          width: h.width + 0.78,
          height: h.height + 0.78,
          bottom: h.bottom - 0.39,
          spring: h.spring + 0.39,
        },
        d,
      ),
      sg = [0.49, 0.32, 0.23].map((v) => v);
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length;
      face(
        'trim',
        [
          point(h, ...ring[i], 0.06),
          point(h, ...ring[j], 0.06),
          point(h, ...outer[j], 0.06),
          point(h, ...outer[i], 0.06),
        ],
        [h.normal[0], 0, h.normal[1]],
        i % 2 ? undefined : sg,
      );
    }
  }
}
function dome(face, p, d) {
  const centerP = center(p.outline),
    r =
      d === 0
        ? circle(
            centerP,
            Math.max(...p.outline.map((v) => Math.hypot(...v.map((n, k) => n - centerP[k])))),
            6,
          )
        : p.outline;
  const n = d === 0 ? 2 : d === 1 ? 3 : d === 2 ? 5 : 7,
    levels = [[p.base, 1]];
  for (let i = 1; i <= n; i++) {
    const a = ((i / n) * Math.PI) / 2;
    levels.push([p.base + (p.top - p.base) * Math.sin(a), Math.max(0.015, Math.cos(a))]);
  }
  profile(face, r, levels, 'roof', centerP);
  if (d > 1)
    for (const e of edges(r))
      beam(face, at(e.a, p.base + 0.2), at(centerP, p.top - 0.2), 0.075, 'roof');
}
function minaret(out, face, p, d) {
  const r = rect(...p.center, p.width, p.width),
    fields = patriarchsTowerFields(d).filter((h) => h.name.startsWith(p.name));
  shell(out, d, r, 0, 22, fields, 'wall');
  cap(face, r, 22, 'wall');
  finishFields(face, fields, d);
  const g = rect(...p.center, p.width * 1.32, p.width * 1.32);
  profile(
    face,
    r,
    [
      [22, 1],
      [22.35, 1.12],
      [23.3, 1.32],
    ],
    'trim',
    p.center,
  );
  down(face, g, 23.3, 'trim');
  for (const q of g) {
    const post = rect(...q, 0.34, 0.34);
    solid(face, post, 23.3, 25.8, 'wall');
  }
  const capRing = rect(...p.center, p.width * 1.52, p.width * 1.52);
  cap(face, capRing, 25.8, 'roof');
  down(face, capRing, 25.66, 'roof');
  sides(face, capRing, 25.66, 25.8, 'roof');
  const rr = circle(p.center, p.width * 0.4, d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 16);
  profile(
    face,
    rr,
    [
      [25.8, 1],
      [26.3, 1],
      [27.1, 0.58],
      [27.6, 0.01],
    ],
    'roof',
    p.center,
  );
  if (d > 0) {
    const tip = circle(p.center, 0.12, d === 1 ? 6 : 8);
    profile(
      face,
      tip,
      [
        [27.55, 1],
        [28, 0.04],
      ],
      'trim',
      p.center,
    );
  } else solid(face, rect(...p.center, 0.12, 0.12), 27.55, 28, 'trim');
  if (d > 1) {
    for (const e of edges(g)) {
      const n = 3;
      for (let j = 0; j < n; j++) {
        const q = lerp(e.a, e.b, (j + 0.5) / n),
          base = q.map((v, k) => v - e.normal[k] * 0.3);
        beam(face, at(base, 22.15), at(q, 23.22), 0.24, 'trim');
      }
    }
  }
}
function ranges(face, d) {
  for (const [ring, h] of [
    [plans.annex, 10.4 + rec.annexFloorOffset],
    [plans.westRange, 11],
    [plans.westEntry, 9.8],
    [plans.innerRoom, 10.5],
    [plans.rearHall, 16.2],
  ])
    solid(face, ring, footing, h, 'wall');
  sides(face, plans.mainHall, footing, 19, 'wall');
  gable(face, plans.mainHall, 19, 22);
  for (const p of plans.domes) dome(face, p, d);
  if (d > 0) {
    // Shallow closed fields on the northeast annex retain its low street-facing range.
    for (const [i, e] of edges(plans.annex).entries()) {
      if (e.normal[1] > -0.5) continue;
      const n = Math.max(2, Math.floor(e.length / 5.5));
      for (let j = 0; j < n; j++) {
        const h = field(
          `annex-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal,
          1.35,
          4.6,
          2.4,
          1.5,
        );
        pane(face, h, d, 0.025, 'glass');
        if (d > 1) archBand(face, h, d, 0.18, 'trim', 0.045);
      }
    }
  }
}
function thresholds(face, d) {
  if (d === 0) return;
  for (const h of patriarchsEntryFields(d)) {
    const w = h.width + 0.9,
      ring = [
        [-w / 2, -0.3],
        [w / 2, -0.3],
        [w / 2, 1.2],
        [-w / 2, 1.2],
      ].map(([u, v]) => [
        h.center[0] + h.axis[0] * u + h.normal[0] * v,
        h.center[1] + h.axis[1] * u + h.normal[1] * v,
      ]);
    solid(face, ring, 0, h.bottom - floor, 'trim');
  }
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((p) => p.map(Math.fround));
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
  sides(face, plans.enclosure, footing, 0, 'wall');
  cap(face, plans.enclosure, 0, 'trim');
  const entryCuts = patriarchsEntryFields(d).map((h) => prepareOpening(h, 0, d));
  ranges(writer(masked(out, entryCuts), d), d);
  enclosure(out, face, d);
  for (const p of plans.towers) minaret(out, face, p, d);
  thresholds(face, d);
}
export const buildPatriarchsSkyline = (o) => build(o, 0),
  buildPatriarchsDistrict = (o) => build(o, 1),
  buildPatriarchsStreet = (o) => build(o, 2),
  buildPatriarchsCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const patriarchsStudy = {
  id: 'N0428',
  key: 'cavern_of_the_patriarchs',
  title: 'Cavern of the Patriarchs',
  category: 'mosque',
  wikidataId: 'Q204200',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256² ashlar,sandstone,painted-metal and wood graphs;five merged groups. Pale wall courses and pilasters share ashlar;cornices/arch trim share sandstone;small caps share dark painted metal,doors wood and panes local. Alternating portal stones are vertex tints on the same shared trim graph. Metric UVs,zero embedded images,baked lighting or unique facade art.',
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
    'Individual medium-fi exterior from four inspected2010/2014/2024 pictures and standard viewer PMTiles/DEM. Current exact identity is a POI;retained older aggregate outline and nine current building/part controls remain distinct. Enclosure subdivision,twin minarets,upper pilasters,rounded merlons,cornices,open pavilions,all heights/unseen roofs and selected door positions are working picture estimates. Fine stone wear,inscriptions,lattice/fixtures,cables,flags/modern furniture,current finish,interiors/subterranean caves and engineering omitted or unverified. Door and shaft fields close;upper pavilions and uncovered court are exterior voids,no cave/interior/free walking claim. Public garden/approach steps,roads and neighboring city buildings remain host content. Exact altitude,terrain/threshold/stair/street joins and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('southwest-pilasters-and-corner-minarets', [73, 31, 89], [0, 18, 12]),
    cam('rounded-stone-crenellations', [10, 34, 55], [0, 23, 25]),
    cam('northwest-open-minaret', [-41, 32, 37], [-27.1, 31, 24.2]),
    cam('northeast-annex-and-side-entry', [35, 24, -56], [0, 13, -13]),
    cam('mapped-range-roofs', [0, 115, 0.1], [0, 12, 0]),
    cam('southeast-corner-shaft-lights', [44, 30, -27], [27, 27, -4.8]),
  ],
};

/** Tallinn St. Mary: mapped basilica/chapels and two-bulb western open-lantern spire. */
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
  '../../../content/worldgen/source/places/ud/ud9/n0354_st_mary_s_cathedral/',
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
  wall: '#e4deca',
  trim: '#d5cfb8',
  roof: '#66676b',
  copper: '#846467',
  stone: '#b4ac96',
  door: '#78533e',
  glass: '#4d6178',
  gold: '#c1a35d',
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
const _rect = (p, w, h) => [
  [p[0] - w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] + h / 2],
  [p[0] - w / 2, p[1] + h / 2],
];
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, tallinnMaryGround(...p) - 0.35);
export function tallinnMaryGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Tallinn cathedral footing outside retained terrain');
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
function profile(face, r, levels, slot) {
  for (let i = 1; i < levels.length; i++) {
    const [b, a] = levels[i - 1],
      [t, c] = levels[i],
      lo = scaled(r, a),
      hi = scaled(r, c),
      s = sign(r);
    for (let j = 0; j < r.length; j++) {
      const k = (j + 1) % r.length;
      face(
        slot,
        [at(lo[j], b), at(lo[k], b), at(hi[k], t), at(hi[j], t)],
        [(r[k][1] - r[j][1]) * s, 0.1, (r[j][0] - r[k][0]) * s],
      );
    }
  }
  const [t, f] = levels.at(-1);
  if (f > 0) cap(face, scaled(r, f), t, slot);
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
        height: h.height + w,
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
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * 2 * Math.PI) / n),
    p[1] + r * Math.sin(offset + (i * 2 * Math.PI) / n),
  ]);
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
const R = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline,
  tower = role('tower'),
  _towerCenter = center(tower),
  lanternCenter = center(role('spire'));
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
function edge(r, n) {
  return r
    .map((_, i) => faceFrame(r, i))
    .filter((f) => f.normal[0] * n[0] + f.normal[1] * n[1] > 0.65)
    .sort((a, b) => b.length - a.length)[0];
}
function onFace(name, r, n, t, w, b, h, s = h, shape = 'pointed') {
  const f = edge(r, n);
  return hole(name, lerp(f.a, f.b, t), f.axis, f.normal, w, b, h, s, shape);
}
function exposedChoirPoint(f, width) {
  const projections = rec.controls
    .filter((b) => !Object.values(rec.roles).includes(b.id))
    .map((b) => b.polygons[0].outline);
  const inside = (p, r) => {
    let yes = false;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const a = r[i],
        b = r[j];
      if (
        a[1] > p[1] !== b[1] > p[1] &&
        p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
      )
        yes = !yes;
    }
    return yes;
  };
  for (const t of [0.5, 0.25, 0.75, 0.35, 0.65]) {
    if (Math.min(t, 1 - t) * f.length < width / 2 + 0.2) continue;
    const p = lerp(f.a, f.b, t);
    const blocked = [-width / 2 - 0.2, 0, width / 2 + 0.2].some((u) =>
      [0.2, 0.8, 1.4].some((v) =>
        projections.some((r) =>
          inside(
            p.map((n, k) => n + f.axis[k] * u + f.normal[k] * v),
            r,
          ),
        ),
      ),
    );
    if (!blocked) return p;
  }
}
export function tallinnMaryWindows() {
  const hs = [];
  for (const side of [-1, 1])
    for (const t of [0.18, 0.5, 0.82])
      hs.push(
        onFace(`clerestory-${side}-${t}`, role('clerestory'), [0, side], t, 1.55, 20.15, 2.1, 1.5),
      );
  for (const t of [0.12, 0.58, 0.88])
    hs.push(onFace(`north-aisle-${t}`, role('aisles'), [0, -1], t, 2.05, 5.5, 7.7, 5.6));
  hs.push(onFace('south-aisle-upper', role('aisles'), [0, 1], 0.87, 1.4, 10.2, 3.6, 2.6));
  const cr = rec.choirPlan[0].outline;
  for (let i = 0; i < cr.length; i++) {
    const f = faceFrame(cr, i);
    if (f.normal[0] < -0.45 || f.length < 3.4) continue;
    if (f.normal[1] < -0.6 && f.a[0] < 20 && f.b[0] < 20) continue;
    const n = 1,
      exposed = exposedChoirPoint(f, 1.75);
    if (!exposed) continue;
    for (let j = 0; j < n; j++)
      hs.push(hole(`choir-${i}-${j}`, exposed, f.axis, f.normal, 1.75, 4.7, 7.3, 5.5));
  }
  for (const n of [
    [-1, 0],
    [0, -1],
    [0, 1],
    [1, 0],
  ])
    hs.push(onFace(`tower-upper-${n.join(',')}`, tower, n, 0.5, 1.1, 31.2, 2.8, 2.1, 'round'));
  for (const n of [
    [-1, 0],
    [0, -1],
    [0, 1],
  ])
    hs.push(onFace(`tower-middle-${n.join(',')}`, tower, n, 0.5, 1.55, 21.2, 4.1, 3.1, 'round'));
  return hs;
}
export function tallinnMaryFrontOpenings() {
  const hs = [],
    r = role('southPediment');
  hs.push(onFace('south-main-door', r, [0, 1], 0.5, 2.55, 0.1, 4.4, 2.8));
  for (const t of [0.14, 0.86])
    hs.push(onFace(`south-flank-${t}`, r, [0, 1], t, 0.65, 0.25, 3.9, 2.6));
  for (const t of [0.26, 0.74])
    hs.push(onFace(`south-upper-${t}`, r, [0, 1], t, 1.15, 7.1, 1.3, 1.3, 'rect'));
  hs.push(onFace('south-blind-field', r, [0, 1], 0.5, 0.8, 5.3, 0.85, 0.6));
  for (const [name, plan, h] of [
    ['south-west', role('southWest'), 3.8],
    ['south-middle', role('southMiddle'), 3.3],
    ['south-east', rec.exposedEastFront[0].outline, 3.8],
  ])
    for (const t of [0.28, 0.72])
      hs.push(onFace(`${name}-window-${t}`, plan, [0, 1], t, 0.95, 1.6, h, h, 'rect'));
  for (const t of [0.25, 0.75])
    hs.push(onFace(`sacristy-window-${t}`, role('sacristy'), [0, -1], t, 1.2, 2.4, 3.7, 2.7));
  for (const t of [0.26, 0.74])
    hs.push(
      onFace(`north-chapel-window-${t}`, role('northChapel'), [0, -1], t, 1.15, 2.6, 2.9, 2.1),
    );
  return hs;
}
function panel(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.15 : 0.14, slot);
  if (d) archBand(face, h, d, 0.18, 'trim', 0.16);
  if (d >= 2 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -0.99 : 0.21));
    beam(face, [p[0], h.bottom + 0.1, p[1]], [p[0], h.bottom + h.spring - 0.1, p[1]], 0.08, 'trim');
    if (d >= 3) {
      const a = h.axis.map((v) => v * h.width * 0.43),
        y = h.bottom + h.spring * 0.49;
      beam(face, [p[0] - a[0], y, p[1] - a[1]], [p[0] + a[0], y, p[1] + a[1]], 0.065, 'trim');
    }
  }
}
function gable(face, r, eave, top, slot = 'roof', axis = 0) {
  if (r.length === 4) {
    const caps = [edge(r, axis === 0 ? [-1, 0] : [0, -1]), edge(r, axis === 0 ? [1, 0] : [0, 1])];
    const ridge = caps.map((f) => lerp(f.a, f.b, 0.5));
    const nearest = (p) => (p === caps[0].a || p === caps[0].b ? ridge[0] : ridge[1]);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (Math.abs(f.normal[axis]) > 0.65) continue;
      face(
        slot,
        [at(f.a, eave), at(f.b, eave), at(nearest(f.b), top), at(nearest(f.a), top)],
        [0, 1, 0],
      );
    }
    for (let i = 0; i < caps.length; i++) {
      const f = caps[i];
      face(
        'wall',
        [at(f.a, eave), at(f.b, eave), at(ridge[i], top)],
        [f.normal[0], 0, f.normal[1]],
      );
    }
    return;
  }
  const k = 1 - axis,
    xs = r.map((p) => p[axis]),
    zs = r.map((p) => p[k]),
    lo = Math.min(...xs),
    hi = Math.max(...xs),
    z0 = Math.min(...zs),
    z1 = Math.max(...zs),
    mid = (z0 + z1) / 2,
    point = (x, z) => (axis === 0 ? [x, z] : [z, x]);
  for (const z of [z0, z1])
    face(
      slot,
      [
        at(point(lo, z), eave),
        at(point(hi, z), eave),
        at(point(hi, mid), top),
        at(point(lo, mid), top),
      ],
      [0, 1, 0],
    );
  for (const [x, n] of [
    [lo, -1],
    [hi, 1],
  ])
    face(
      'wall',
      [at(point(x, z0), eave), at(point(x, z1), eave), at(point(x, mid), top)],
      axis === 0 ? [n, 0, 0] : [0, 0, n],
    );
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
function clock(face, p, n, d) {
  const a = [-n[1], n[0]],
    r = 1.3,
    segments = d >= 3 ? 24 : 12,
    points = Array.from({ length: segments }, (_, i) => {
      const q = (i * 2 * Math.PI) / segments;
      return [p[0] + a[0] * r * Math.cos(q), p[1] + r * Math.sin(q), p[2] + a[1] * r * Math.cos(q)];
    });
  face('glass', points, [n[0], 0, n[1]], colors.roof);
  for (let i = 0; i < segments; i++) {
    const j = (i + 1) % segments,
      outer = (k) => [
        p[0] + (points[k][0] - p[0]) * 1.1,
        p[1] + (points[k][1] - p[1]) * 1.1,
        p[2] + (points[k][2] - p[2]) * 1.1,
      ];
    face('gold', [outer(i), outer(j), points[j], points[i]], [n[0], 0, n[1]]);
  }
  const pt = (angle, r) => [
    p[0] + a[0] * r * Math.sin(angle) + n[0] * 0.05,
    p[1] + r * Math.cos(angle),
    p[2] + a[1] * r * Math.sin(angle) + n[1] * 0.05,
  ];
  for (const [q, len] of [
    [0.3, 1.02],
    [2.2, 0.75],
  ])
    beam(face, pt(q, 0), pt(q, len), 0.08, 'gold');
  if (d >= 3)
    for (let i = 0; i < 12; i++) {
      const q = (i * 2 * Math.PI) / 12;
      beam(face, pt(q, 1.01), pt(q, 1.18), 0.065, 'trim');
    }
}
function body(out, face, d) {
  if (d === 0) sides(face, rec.main.polygons[0].outline, footing, 0.1, 'stone');
  else solid(face, rec.main.polygons[0].outline, footing, 0.1, 'stone');
  const windows = tallinnMaryWindows(),
    rooms = tallinnMaryFrontOpenings();
  const groups = [
    ['aisles', role('aisles'), 14.8, windows.filter((h) => h.name.includes('aisle'))],
    [
      'clerestory',
      role('clerestory'),
      22.5,
      windows.filter((h) => h.name.startsWith('clerestory')),
    ],
    ['choir', rec.choirPlan[0].outline, 13.5, windows.filter((h) => h.name.startsWith('choir'))],
  ];
  for (const [name, r, height, hs] of groups) {
    if (d >= 2) shell(out, d, r, 0.1, height, hs);
    else sides(face, r, 0.1, height, 'wall');
    if (d) band(face, r, height - 0.18, 0.22, 'trim', 1.006);
    if (name === 'aisles') {
      for (const roof of rec.aisleRoofs)
        for (const p of roof.polygons) {
          const y = (q) =>
            floor + 20 - 5.2 * Math.max(0, Math.min(1, (Math.abs(q[1] + 0.1) - 5.8) / 9.3));
          cap(face, p.outline, y, 'roof', p.holes);
          sides(face, p.outline, 14.8, y, 'wall');
        }
    } else if (name === 'clerestory') gable(face, r, 22.5, 28);
    else hip(face, r, 13.5, 20);
  }
  if (d)
    for (const h of windows.filter((h) => !h.name.startsWith('tower'))) panel(face, h, d, d >= 2);
  for (const [name, r, eave, top, roofKind, axis, prefix] of [
    ['northChapel', role('northChapel'), 7.6, 11, 'gable', 1, 'north-chapel'],
    ['sacristy', role('sacristy'), 8.4, 12, 'gable', 0, 'sacristy'],
    ['southWest', role('southWest'), 8.2, 11, 'hip', 0, 'south-west'],
    ['southMiddle', role('southMiddle'), 7.2, 9, 'gable', 0, 'south-middle'],
    ['southPediment', role('southPediment'), 8.65, 11, 'gable', 1, 'south'],
    ['southEast', rec.exposedEastFront[0].outline, 7.3, 10, 'hip', 1, 'south-east'],
  ]) {
    const hs = rooms.filter((h) =>
      name === 'southPediment'
        ? h.name.startsWith('south-main') ||
          h.name.startsWith('south-flank') ||
          h.name.startsWith('south-upper') ||
          h.name === 'south-blind-field'
        : h.name.startsWith(prefix),
    );
    if (d >= 2) shell(out, d, r, 0.1, eave, hs);
    else sides(face, r, 0.1, eave, 'wall');
    (roofKind === 'hip' ? hip : gable)(face, r, eave, top, 'roof', axis);
    if (d) {
      band(face, r, eave - 0.1, 0.22, 'trim', 1.006);
      for (const h of hs)
        panel(
          face,
          h,
          d,
          d >= 2,
          h.name.includes('door') ? 'door' : h.name.includes('blind') ? 'trim' : 'glass',
        );
    }
  }
  if (d) {
    const r = role('southPediment'),
      f = edge(r, [0, 1]),
      p = lerp(f.a, f.b, 0.5),
      top = 11.15;
    for (const q of [f.a, f.b]) beam(face, at(q, 8.65), at([p[0], p[1]], top), 0.22, 'trim');
    beam(face, at(f.a, 8.75), at(f.b, 8.75), 0.23, 'trim');
    for (const t of [0.4, 0.6]) {
      const q = lerp(f.a, f.b, t);
      beam(face, at([q[0], q[1] + 0.08], 6.2), at([q[0], q[1] + 0.08], 6.65), 0.08, 'trim');
    }
  }
  // Small raw projections are individually retained as stepped buttresses.
  for (const b of rec.controls.filter((b) => !Object.values(rec.roles).includes(b.id))) {
    const r = b.polygons[0].outline,
      top = b.properties.height ?? 10;
    if (d === 0) {
      sides(face, r, 0.1, top * 0.8, 'wall');
      cap(face, r, top * 0.8, 'wall');
      continue;
    }
    solid(face, r, 0.1, top * 0.6, 'wall');
    const q = scaled(r, 0.7);
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      face('trim', [
        at(r[i], top * 0.6),
        at(r[j], top * 0.6),
        at(q[j], top * 0.67),
        at(q[i], top * 0.67),
      ]);
    }
    solid(face, q, top * 0.67, top, 'wall');
    cap(face, q, top, 'roof');
  }
}
export function tallinnMaryLantern(d = 3) {
  const r =
    d === 0
      ? R(
          lanternCenter[0] - 2.45,
          lanternCenter[1] - 2.45,
          lanternCenter[0] + 2.45,
          lanternCenter[1] + 2.45,
        )
      : scaled(role('spire'), 1.08);
  return {
    ring: r,
    bottom: 43.7,
    top: 51.2,
    holes: r.map((_, i) => {
      const f = faceFrame(r, i);
      return hole(
        `lantern-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        f.length * 0.64,
        44,
        6.2,
        4.9,
        'round',
        2,
      );
    }),
  };
}
function towerAndSpire(out, face, d) {
  const hs = tallinnMaryWindows().filter((h) => h.name.startsWith('tower'));
  if (d >= 2) shell(out, d, tower, 0.1, 37, hs);
  else sides(face, tower, 0.1, 37, 'wall');
  cap(face, tower, 37, 'wall');
  if (d) {
    for (const h of hs) panel(face, h, d, d >= 2);
    for (const y of [28.8, 36.3, 36.75]) band(face, tower, y, 0.2, 'trim', 1.025);
    for (const n of [
      [-1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const f = edge(tower, n),
        p = lerp(f.a, f.b, 0.5);
      clock(face, [p[0] + f.normal[0] * 0.2, floor + 35.3, p[1] + f.normal[1] * 0.2], f.normal, d);
      const band = hole('clock-cornice', p, f.axis, f.normal, 3.5, 35.3, 2.3, 0.1, 'round');
      archBand(face, band, d, 0.25, 'trim', 0.23);
    }
  }
  const n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 16 : 24,
    lower = regular(lanternCenter, 4.8, n, Math.PI / 8),
    upper = regular(lanternCenter, 3.2, n, Math.PI / 8);
  profile(
    face,
    lower,
    [
      [37, 0.85],
      [37.5, 1],
      [38.4, 1.14],
      [39.7, 1.21],
      [40.8, 1.15],
      [42, 0.83],
      [43, 0.59],
    ],
    'copper',
  );
  const stage = tallinnMaryLantern(d),
    r = stage.ring;
  if (d === 0) {
    for (const p of r)
      solid(face, R(p[0] - 0.32, p[1] - 0.32, p[0] + 0.32, p[1] + 0.32), 43.7, 50.7, 'copper');
    band(face, r, 43, 0.7, 'copper', 1.04);
    band(face, r, 50.7, 0.5, 'copper', 1.04);
  } else {
    shell(out, d, r, 43.7, 51.2, stage.holes, 'copper', scaled(r, 0.77));
    band(face, r, 43, 0.7, 'copper', 1.06);
    band(face, r, 50.7, 0.5, 'copper', 1.06);
  }
  if (d >= 2)
    for (const h of stage.holes) {
      const p = h.center,
        a = h.axis.map((v) => v * h.width * 0.44),
        y = floor + 45.1;
      beam(face, [p[0] - a[0], y, p[1] - a[1]], [p[0] + a[0], y, p[1] + a[1]], 0.065, 'copper');
    }
  profile(
    face,
    upper,
    [
      [51.2, 0.94],
      [51.5, 1.03],
      [51.8, 0.98],
      [52.1, 0.88],
      [52.7, 0.86],
      [53.6, 1.1],
      [54.5, 1.05],
      [55.5, 0.75],
      [56.5, 0.5],
      [57, 0.41],
      [67.9, 0.015],
    ],
    'copper',
  );
  if (d >= 3)
    for (const p of stage.ring)
      profile(
        face,
        regular(p, 0.28, 8),
        [
          [51.3, 0.5],
          [51.55, 1],
          [51.9, 0.7],
          [52, 0.1],
        ],
        'copper',
      );
  const fin = regular(lanternCenter, 0.38, d >= 2 ? 12 : 6);
  profile(
    face,
    fin,
    [
      [68.05, 0.15],
      [68.25, 1],
      [68.58, 0.85],
      [68.72, 0.2],
    ],
    'gold',
  );
  beam(face, at(lanternCenter, 67.8), at(lanternCenter, 69), d >= 2 ? 0.07 : 0.12, 'gold');
  if (d) {
    const p = at(lanternCenter, 68.85);
    beam(face, [p[0] - 0.5, p[1], p[2]], [p[0] + 0.8, p[1], p[2]], 0.07, 'gold');
  }
}
function minorTurret(_out, face, d) {
  const p = [18, 0.45],
    r = regular(p, d === 0 ? 0.8 : 1, d >= 2 ? 8 : 6);
  solid(face, r, 19.6, 20.35, 'wall');
  // This small roof lantern reads as slender posts at the intended viewing scale.
  for (const q of r)
    solid(face, R(q[0] - 0.13, q[1] - 0.13, q[0] + 0.13, q[1] + 0.13), 20.35, 21.85, 'copper');
  band(face, r, 21.7, 0.15, 'copper', 1.05);
  profile(
    face,
    scaled(r, 1.15),
    [
      [21.85, 1],
      [22.3, 1.02],
      [22.7, 0.6],
      [23.1, 0.02],
    ],
    'copper',
  );
}
function entranceSteps(face, d) {
  const h = tallinnMaryFrontOpenings().find((h) => h.name === 'south-main-door');
  const far = h.center.map((v, k) => v + h.normal[k] * 2.5);
  const rise = Math.max(0.1, floor + 0.1 - tallinnMaryGround(...far));
  const count = Math.ceil(rise / 0.27),
    run = count * 0.32;
  const ring = (a, b) =>
    [
      [-1.5, a],
      [1.5, a],
      [1.5, b],
      [-1.5, b],
    ].map(([u, v]) => h.center.map((n, k) => n + h.axis[k] * u + h.normal[k] * v));
  const base = (p) => tallinnMaryGround(...p) - 0.1;
  if (d === 0) {
    const r = ring(0, run),
      y = (p) =>
        floor +
        0.1 -
        (rise * ((p[0] - h.center[0]) * h.normal[0] + (p[1] - h.center[1]) * h.normal[1])) / run;
    solid(face, r, base, y, 'stone');
  } else
    for (let i = 0; i < count; i++)
      solid(face, ring(i * 0.32, (i + 1) * 0.32), base, 0.1 - (i * rise) / count, 'stone');
}
function build(out, d) {
  const base = writer(out, d),
    face = (slot, p, n, col) => {
      const max = d === 0 ? 48 : d === 1 ? 24 : 16;
      function split(t) {
        const edges = t.map((a, i) => Math.hypot(...a.map((v, k) => v - t[(i + 1) % 3][k]))),
          length = Math.max(...edges),
          i = edges.indexOf(length);
        if (length <= max) {
          base(slot, t, n, col);
          return;
        }
        const j = (i + 1) % 3,
          k = (i + 2) % 3,
          mid = lerp(t[i], t[j], 0.5);
        split([t[i], mid, t[k]]);
        split([mid, t[j], t[k]]);
      }
      for (let i = 1; i < p.length - 1; i++) split([p[0], p[i], p[i + 1]]);
    };
  body(out, face, d);
  towerAndSpire(out, face, d);
  minorTurret(out, face, d);
  entranceSteps(face, d);
}
export const buildTallinnMarySkyline = (o) => build(o, 0),
  buildTallinnMaryDistrict = (o) => build(o, 1),
  buildTallinnMaryStreet = (o) => build(o, 2),
  buildTallinnMaryCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const tallinnMaryStudy = {
  id: 'N0354',
  key: 'st_mary_s_cathedral',
  title: "St. Mary's Cathedral",
  category: 'cathedral',
  wikidataId: 'Q937320',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID OSM way26902813 matches current main PMTiles identity;main/21 part plans retain geographic position/scale. Western tower/eastern choir/south pediment resolve signed orientation from useful pictures.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing 256-square lime plaster,raw limestone,standing-seam metal,copper and plain wood graphs. Off-white walls/pale stone frames,gray-brown main roofs,brown/burgundy two-bulb spire,restrained gold clocks/finial and flat blue-gray glazing. Metric UVs,hard architectural normals,no embedded images.',
  importReason:
    'Four browser levels preserve the individual western baroque spire/open lantern,stepped basilica,polygonal choir and mapped irregular chapel/entrance frontage at reviewed approximate fit.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Exterior approximation from three useful ground/aerial pictures and standard PMTiles/DEM. Main/part height tags conflict and do not specify eaves:all lower wall/roof subdivisions,clock cornice,two bulb/lantern profiles,window and annex facade rhythms,minor choir turret, estimated entry steps/ramp over the coarse DEM and exact thresholds are picture-led estimates. Palette reflects inspected 2013/2015 and labeled 2023 images;later roof-restoration appearance is not independently verified. Exact inscriptions,clock numerals,tracery,sculpture and full interiors excluded. Certified walking and physical device timings pending.',
    'Skyline keeps mapped masses,main two-bulb spire,open four-post rectangular lantern and coarse small roof turret/buttresses. District adds shared graphs,flat windows/closed doors,clocks/cornices and octagonal round-arched lantern. Street opens real facade recesses and adds sparse mullions/lantern rails. Closeup/master refine curved facets,clock marks,frames and upper lantern ornament. Curvature,openings and ornament change visibly. Swedish-cottage neighbors are synthetic context,not local map buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('southern-pedimented-entry', [-15, 14, 43], [-6, 6.2, 22]),
    cam('clock-tower-and-two-bulb-spire', [-53, 47, 33], [-23, 42, 0]),
    cam('open-baroque-lantern', [-39, 49, 19], [-23, 47, 0]),
    cam('clerestory-and-aisle-roofs', [9, 32, 35], [-4, 21, 0]),
    cam('polygonal-choir-and-small-lantern', [48, 23, 21], [19, 13, 0]),
    cam('north-rooms-and-pointed-windows', [10, 23, -48], [-1, 11, -13]),
  ],
};

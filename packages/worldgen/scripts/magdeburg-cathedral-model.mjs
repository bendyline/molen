/** Magdeburg Cathedral: twin open belfries,high church and mapped cloister. */
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
  '../../../content/worldgen/source/places/u3/u32/n0355_cathedral_of_magdeburg/',
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
  wall: '#c7b18b',
  trim: '#d9c7a5',
  roof: '#687075',
  copper: '#71857b',
  stone: '#aba38f',
  door: '#6e543e',
  glass: '#4d6178',
  gold: '#bba56a',
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
const footing = (p) => Math.min(floor - 0.3, magdeburgGround(...p) - 0.35);
export function magdeburgGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Magdeburg cathedral footing outside retained terrain');
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
function profile(face, r, levels, slot, tint) {
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
        tint,
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
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline;
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
      if (t >= 0 && t <= 1 && Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz) < 0.65) {
        r.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return r;
};
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
function onFace(name, r, n, t, w, b, h, s = h, shape = 'pointed') {
  const f = edge(r, n);
  return hole(name, lerp(f.a, f.b, t), f.axis, f.normal, w, b, h, s, shape);
}
function inside(p, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
}
const chapelIds = [35184707436384, 35184707436385, 35184707436386, 35184707436392, 35184707436393];
const volumes = () =>
  [
    ['northTower', 68],
    ['southTower', 68],
    // Include the central gable when excluding obscured inward tower windows.
    ['west', 66],
    ['nave', 35],
    ['aisles', 17],
    ['transept', 33],
    ['ambulatory', 17],
    ['upperChoir', 35],
    ['northEastTower', 30],
    ['southEastTower', 30],
    ['northPorch', 10],
    ...[
      'westNorthRange',
      'westSouthRange',
      'southRange',
      'eastRange',
      'eastRoom',
      'eastChapelBody',
      'eastChapelApse',
    ].map((n) => [
      n,
      (rec.controls.find((b) => b.id === rec.roles[n]).properties.height ?? 12) * 0.7,
    ]),
  ]
    .map(([name, height]) => ({ name, r: role(name), height }))
    .concat(
      chapelIds.map((id) => ({
        name: String(id),
        r: rec.controls.find((b) => b.id === id).polygons[0].outline,
        height: 7.5,
      })),
    );
function exposed(h, owner) {
  return !volumes().some(
    (v) =>
      v.name !== owner &&
      floor + v.height > h.bottom + h.height * 0.4 &&
      [-0.38, 0, 0.38].some((t) =>
        inside(
          h.center.map((x, k) => x + h.normal[k] * 0.65 + h.axis[k] * h.width * t),
          v.r,
        ),
      ),
  );
}
export function magdeburgWindows() {
  const hs = [];
  for (const side of [-1, 1])
    for (const t of [1 / 12, 3 / 12, 5 / 12, 7 / 12, 9 / 12, 11 / 12]) {
      const h = onFace(`nave-${side}-${t}`, role('nave'), [0, side], t, 3.2, 25, 8.7, 6.6);
      if (exposed(h, 'nave')) hs.push(h);
    }
  for (const side of [-1, 1])
    for (const t of [0.08, 0.23, 0.38, 0.53, 0.68, 0.83]) {
      const h = onFace(`aisle-${side}-${t}`, role('aisles'), [0, side], t, 2.7, 7, 8.3, 6.3);
      if (exposed(h, 'aisles')) hs.push(h);
    }
  for (const [name, r, b, h, w] of [
    ['upperChoir', role('upperChoir'), 24, 9, 2.8],
    ['ambulatory', role('ambulatory'), 8.2, 7.1, 2.1],
  ])
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 3.8 || f.normal[0] < -0.55) continue;
      const q = hole(`${name}-${i}`, lerp(f.a, f.b, 0.5), f.axis, f.normal, w, b, h, h * 0.76);
      if (exposed(q, name)) hs.push(q);
    }
  for (const side of [-1, 1])
    hs.push(onFace(`transept-${side}`, role('transept'), [0, side], 0.5, 4.7, 20, 11, 8));
  for (const name of ['northTower', 'southTower'])
    for (const n of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ])
      for (const [b, h, w] of [
        [9, 13, 2.7],
        [49, 12, 3.5],
      ]) {
        const q = onFace(`${name}-${n.join(',')}-${b}`, role(name), n, 0.5, w, b, h, h * 0.76);
        if (exposed(q, name)) hs.push(q);
      }
  hs.push(onFace('west-central-lancet', role('west'), [-1, 0], 0.5, 4.5, 26, 23, 18));
  return hs;
}
export function magdeburgDoors() {
  return [
    onFace('west-main-door', role('westPorch'), [-1, 0], 0.5, 3.1, 0.1, 7.7, 5.3),
    onFace('north-porch-door', role('northPorch'), [0, -1], 0.5, 2.2, 0.1, 5.3, 3.6),
  ];
}
function panel(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.15 : 0.14, slot);
  if (d >= 2) archBand(face, h, d, 0.25, 'trim', 0.18);
  if (d >= 2 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -0.99 : 0.22));
    beam(
      face,
      [p[0], h.bottom + 0.15, p[1]],
      [p[0], h.bottom + h.spring - 0.1, p[1]],
      0.11,
      'trim',
    );
    if (d >= 3) {
      const a = h.axis.map((v) => v * h.width * 0.43),
        y = h.bottom + h.spring * 0.53;
      beam(face, [p[0] - a[0], y, p[1] - a[1]], [p[0] + a[0], y, p[1] + a[1]], 0.075, 'trim');
    }
  }
}
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
function smallPinnacle(face, p, b, t, d) {
  const r = regular(p, d === 0 ? 0.32 : 0.45, d >= 3 ? 8 : 4, Math.PI / 4);
  solid(face, r, b, t - 1.7, 'trim');
  profile(
    face,
    scaled(r, 1.2),
    [
      [t - 1.7, 1],
      [t, 0.01],
    ],
    'trim',
  );
}
function buttress(face, p, axis, n, b, t, d) {
  const r = [
    [-0.45, 0],
    [0.45, 0],
    [0.45, 1.5],
    [-0.45, 1.5],
  ].map(([u, v]) => p.map((x, k) => x + axis[k] * u + n[k] * v));
  if (d <= 1) {
    sides(face, r, b, t * 0.88, 'wall');
    cap(face, r, t * 0.88, 'wall');
    return;
  }
  solid(face, r, b, t * 0.65, 'wall');
  const q = scaled(r, 0.68);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face('trim', [at(r[i], t * 0.65), at(r[j], t * 0.65), at(q[j], t * 0.72), at(q[i], t * 0.72)]);
  }
  solid(face, q, t * 0.72, t, 'wall');
  if (d >= 2) smallPinnacle(face, center(q), t, t + 2, d);
}
function body(out, face, d) {
  for (const name of ['main', 'cloister']) {
    if (d === 0) continue;
    const r = d === 1 ? coarse(role(name)) : role(name);
    if (d === 1) sides(face, r, footing, 0.1, 'stone');
    else solid(face, r, footing, 0.1, 'stone');
  }
  const hs = magdeburgWindows(),
    doors = magdeburgDoors(),
    groups = [
      ['aisles', 17],
      ['nave', 35],
      ['transept', 33],
      ['ambulatory', 17],
      ['upperChoir', 35],
      ['west', 53],
      ['northEastTower', 30],
      ['southEastTower', 30],
      ['northPorch', 10],
      ['westPorch', 12],
    ];
  for (const [name, height] of groups) {
    const r = d <= 1 ? coarse(role(name)) : role(name),
      holes = hs
        .filter((h) =>
          name === 'aisles'
            ? h.name.startsWith('aisle')
            : name === 'west'
              ? h.name.startsWith('west-central')
              : name === 'nave'
                ? h.name.startsWith('nave')
                : name === 'transept'
                  ? h.name.startsWith('transept')
                  : h.name.startsWith(name),
        )
        .concat(name === 'westPorch' ? [doors[0]] : name === 'northPorch' ? [doors[1]] : []);
    if (d >= 2) shell(out, d, r, 0.1, height, holes);
    else sides(face, r, d === 0 ? footing : 0.1, height, 'wall');
    if (name === 'nave') gable(face, r, 35, 42);
    else if (name === 'transept') gable(face, r, 33, 42, 'roof', 1);
    else if (name === 'upperChoir') hip(face, r, 35, 42);
    else if (name === 'west') gable(face, r, 53, 66, 'wall');
    else if (name === 'northPorch') gable(face, r, 10, 15, 'roof', 1);
    else if (name === 'westPorch') gable(face, r, 12, 21, 'wall');
    else if (name.includes('EastTower')) {
      cap(face, r, 30, 'roof');
      band(face, r, 30, 0.7, 'trim', 1.025);
      if (d) for (const p of coarse(r)) smallPinnacle(face, p, 30, 32, d);
    } else if (name === 'ambulatory') {
      const ct = center(role('upperChoir')),
        y = (p) =>
          floor +
          20 -
          3 * Math.max(0, Math.min(1, (Math.hypot(p[0] - ct[0], p[1] - ct[1]) - 7) / 8));
      for (const q of rec.ambulatoryRoof) cap(face, q.outline, y, 'copper', q.holes);
    } else if (name === 'aisles') {
      if (d === 0) {
        for (const side of [-1, 1]) {
          const r = R(-44, side < 0 ? -20.5 : 4, 14, side < 0 ? -8 : 17.2),
            y = (p) => floor + 23 - 6 * Math.max(0, Math.min(1, (Math.abs(p[1] + 1.5) - 7) / 13));
          cap(face, r, y, 'roof');
          sides(face, r, 17, y, 'wall');
        }
      } else
        for (const side of [-1, 1])
          for (let i = 0; i < 6; i++) {
            const x = -44 + i * 9.65,
              r = R(x, side < 0 ? -20.5 : 4, x + 9.65, side < 0 ? -8 : 17.25);
            gable(face, r, 17, 23, 'roof', 1);
            if (d >= 2) {
              const p = [x + 4.825, side < 0 ? -20.6 : 17.35];
              smallPinnacle(face, p, 22.8, 25.3, d);
            }
          }
    }
    if (d) band(face, r, height - 0.22, 0.26, 'trim', 1.006);
  }
  if (d) {
    for (const h of hs) panel(face, h, d, d >= 2);
    for (const h of doors) panel(face, h, d, d >= 2, 'door');
  }
  for (const id of chapelIds) {
    const b = rec.controls.find((b) => b.id === id),
      r = d <= 1 ? coarse(b.polygons[0].outline) : b.polygons[0].outline,
      holes = [];
    if (d)
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (f.length < 2.8) continue;
        const h = hole(
          `chapel-${id}-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          1.25,
          1.3,
          5.3,
          4,
        );
        if (exposed(h, String(id))) holes.push(h);
      }
    if (d >= 2) shell(out, d, r, 0.1, 7.5, holes);
    else sides(face, r, 0.1, 7.5, 'wall');
    if (d === 0) cap(face, r, 10, 'copper');
    else hip(face, r, 7.5, 10, 'copper');
    if (d) for (const h of holes) panel(face, h, d, d >= 2);
  }
  if (d)
    for (const side of [-1, 1])
      for (let i = 1; i < 6; i++) {
        const f = edge(role('nave'), [0, side]),
          p = lerp(f.a, f.b, i / 6);
        buttress(face, p, f.axis, f.normal, 17, 35, d);
        if (d >= 3) smallPinnacle(face, p, 35, 38, d);
      }
  const r = role('crossingTurret');
  if (d === 0)
    profile(
      face,
      scaled(r, 1.2),
      [
        [40, 1],
        [54, 0.01],
      ],
      'copper',
    );
  else {
    solid(face, r, 40, 46, 'copper');
    profile(
      face,
      scaled(r, 1.2),
      [
        [46, 1],
        [48, 0.8],
        [54, 0.01],
      ],
      'copper',
    );
  }
  for (const name of ['westNorthPinnacle', 'westSouthPinnacle']) {
    if (d === 0) continue;
    const r = role(name);
    solid(face, r, 0.1, 24, 'wall');
    profile(
      face,
      scaled(r, 1.02),
      [
        [24, 1],
        [30, 0.02],
      ],
      'trim',
    );
  }
}
export function magdeburgBelfries(d = 3) {
  return ['northUpper', 'southUpper'].map((name) => {
    const raw = role(name),
      ct = center(raw),
      r = d === 0 ? R(ct[0] - 4.4, ct[1] - 4.4, ct[0] + 4.4, ct[1] + 4.4) : raw;
    return {
      name,
      r,
      center: ct,
      holes: r.map((_, i) => {
        const f = faceFrame(r, i);
        return hole(
          `${name}-open-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          f.length * 0.66,
          70,
          13.8,
          10.8,
          'round',
          4,
        );
      }),
    };
  });
}
function towers(out, face, d) {
  const windows = magdeburgWindows();
  for (const stage of magdeburgBelfries(d)) {
    const name = stage.name === 'northUpper' ? 'northTower' : 'southTower',
      r = d <= 1 ? coarse(role(name)) : role(name),
      holes = windows.filter((h) => h.name.startsWith(name));
    if (d >= 2) shell(out, d, r, 0.1, 68, holes);
    else sides(face, r, d === 0 ? footing : 0.1, 68, 'wall');
    cap(face, r, 68, 'wall');
    if (d) for (const y of [24, 44, 67.6]) band(face, r, y, 0.35, 'trim', 1.025);
    if (d === 0) {
      for (const p of stage.r)
        sides(face, R(p[0] - 0.45, p[1] - 0.45, p[0] + 0.45, p[1] + 0.45), 68, 85, 'wall');
      band(face, stage.r, 68, 1, 'trim', 1.04);
      band(face, stage.r, 84.4, 0.6, 'trim', 1.04);
    } else if (d === 1) {
      for (const p of stage.r)
        solid(face, R(p[0] - 0.45, p[1] - 0.45, p[0] + 0.45, p[1] + 0.45), 68, 85, 'wall');
      for (const h of stage.holes) archBand(face, h, d, 0.4, 'wall', 0.02);
      band(face, stage.r, 68, 0.55, 'trim', 1.045);
      band(face, stage.r, 84.4, 0.6, 'trim', 1.045);
    } else {
      shell(out, d, stage.r, 68, 85, stage.holes, 'wall', scaled(stage.r, 0.77));
      band(face, stage.r, 68, 0.55, 'trim', 1.045);
      band(face, stage.r, 84.4, 0.6, 'trim', 1.045);
    }
    const cone = regular(stage.center, 6.3, d === 0 ? 6 : d === 1 ? 8 : 16, Math.PI / 8);
    profile(
      face,
      cone,
      d === 0
        ? [
            [85, 1],
            [97.4, 0.02],
          ]
        : [
            [85, 1],
            [86, 0.98],
            [96, 0.16],
            [97.4, 0.02],
          ],
      'wall',
      colors.roof,
    );
    beam(face, at(stage.center, 97.2), at(stage.center, 99), d >= 2 ? 0.1 : 0.15, 'trim');
    if (stage.name === 'northUpper' && d)
      beam(
        face,
        [stage.center[0] - 0.65, floor + 98.25, stage.center[1]],
        [stage.center[0] + 0.65, floor + 98.25, stage.center[1]],
        0.12,
        'trim',
      );
    if (d >= 2) for (const p of stage.r) smallPinnacle(face, p, 84.8, 88, d);
    if (d >= 3)
      for (let i = 0; i < 8; i++) {
        const angle = (i * 2 * Math.PI) / 8;
        for (const y of [88, 91, 94]) {
          const radius = (6.3 * (97.4 - y)) / 12.4,
            p = [
              stage.center[0] + Math.cos(angle) * radius,
              stage.center[1] + Math.sin(angle) * radius,
            ];
          smallPinnacle(face, p, y, y + 0.65, d);
        }
      }
  }
}
const galleryDefs = [
  [
    'southGallery',
    [
      [-12.86, 23.53],
      [43.59, 24.1],
    ],
    4.5,
    6,
  ],
  [
    'westGallery',
    [
      [-12.34, 52.64],
      [-6.89, 17.11],
    ],
    4.5,
    6,
  ],
  [
    'southCloisterGallery',
    [
      [-17.68, 51.88],
      [33.53, 59.85],
    ],
    6.5,
    9,
  ],
  [
    'eastGallery',
    [
      [38.92, 23.97],
      [33.53, 59.85],
    ],
    6.5,
    9,
  ],
];
export function magdeburgArcades(d = 3) {
  return galleryDefs.map(([name, line, eave, top]) => {
    const [a, b] = line,
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = b.map((v, k) => (v - a[k]) / len),
      normal = unit([13 - (a[0] + b[0]) / 2, 40 - (a[1] + b[1]) / 2]),
      side = [-axis[1], axis[0]],
      sign = side[0] * normal[0] + side[1] * normal[1] > 0 ? 1 : -1,
      n = [side[0] * sign, side[1] * sign],
      count = Math.ceil(len / (d === 0 ? 22 : d === 1 ? 6.5 : 5)),
      width = len / count;
    return {
      name,
      line,
      axis,
      normal: n,
      eave,
      top,
      count,
      width,
      bays: Array.from({ length: count }, (_, i) => ({
        center: lerp(a, b, (i + 0.5) / count),
        spring: eave * 0.68,
        tip: eave - 0.55,
      })),
    };
  });
}
function cloister(face, d) {
  for (const g of magdeburgArcades(d)) {
    const r = d <= 1 ? coarse(role(g.name)) : role(g.name);
    const depth = Math.max(
      ...r.map((p) => -g.normal.reduce((n, v, k) => n + v * (p[k] - g.line[0][k]), 0)),
    );
    const roofY = (p) =>
      floor +
      g.eave +
      (g.top - g.eave) *
        Math.max(
          0,
          Math.min(1, -g.normal.reduce((n, v, k) => n + v * (p[k] - g.line[0][k]), 0) / depth),
        );
    cap(face, r, roofY, 'roof');
    if (d === 1) cap(face, r, 0.1, 'stone');
    for (let i = 0; i <= g.count; i++) {
      const p = lerp(g.line[0], g.line[1], i / g.count);
      (d <= 1 ? sides : solid)(
        face,
        R(p[0] - 0.32, p[1] - 0.32, p[0] + 0.32, p[1] + 0.32),
        d === 0 ? footing : 0.1,
        g.eave,
        'wall',
      );
    }
    beam(face, at(g.line[0], g.eave), at(g.line[1], g.eave), 0.55, 'wall');
    if (d)
      for (const bay of g.bays) {
        const half = g.width * 0.38,
          a = bay.center.map((v, k) => v - g.axis[k] * half),
          b = bay.center.map((v, k) => v + g.axis[k] * half);
        if (d === 1) {
          const h = hole(
            'distant-arcade',
            bay.center,
            g.axis,
            g.normal,
            g.width * 0.76,
            0.1,
            bay.tip - 0.1,
            bay.spring - 0.1,
          );
          archBand(face, h, d, 0.18, 'trim', 0.03);
        } else {
          beam(face, at(a, bay.spring), at(bay.center, bay.tip), 0.2, 'trim');
          beam(face, at(bay.center, bay.tip), at(b, bay.spring), 0.2, 'trim');
        }
      }
    // The outer backing belongs to the cloister range; the court-facing bays stay open.
    const back = g.line.map((p) => p.map((v, k) => v - g.normal[k] * 3.6));
    if (d)
      face(
        'wall',
        [at(back[0], 0.1), at(back[1], 0.1), at(back[1], roofY), at(back[0], roofY)],
        [-g.normal[0], 0, -g.normal[1]],
      );
  }
  for (const [name, top, axis] of [
    ['westNorthRange', 5, 1],
    ['westSouthRange', 8, 1],
    ['southRange', 16, 0],
    ['eastRange', 21, 1],
    ['eastRoom', 16, 1],
    ['eastChapelBody', 20, 0],
    ['eastChapelApse', 20, 0],
    ['southTranseptChapel', 7, 1],
  ]) {
    if (d === 0 && (name === 'eastRoom' || name === 'southTranseptChapel')) continue;
    const r = d <= 1 ? coarse(role(name)) : role(name),
      eave = d === 0 ? top : top * 0.7;
    sides(face, r, d === 0 ? footing : 0.1, eave, 'wall');
    if (d === 0) cap(face, r, top, 'roof');
    else hip(face, r, eave, top, 'roof', axis);
    if (d)
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (f.length < 4) continue;
        const count = Math.min(8, Math.floor(f.length / 5));
        for (let j = 0; j < count; j++) {
          const h = hole(
            `${name}-field-${i}-${j}`,
            lerp(f.a, f.b, (j + 0.5) / count),
            f.axis,
            f.normal,
            1.1,
            Math.min(2, eave * 0.25),
            Math.min(3.4, eave * 0.52),
            Math.min(2.7, eave * 0.4),
            'pointed',
          );
          if (exposed(h, name)) panel(face, h, d, false);
        }
      }
  }
}
function clockField(face, d) {
  if (!d) return;
  const f = edge(role('west'), [-1, 0]),
    p = lerp(f.a, f.b, 0.5),
    n = f.normal,
    a = f.axis,
    y = 58,
    r = 2.0,
    pts = Array.from({ length: d >= 3 ? 24 : 12 }, (_, i) => {
      const angle = (i * 2 * Math.PI) / (d >= 3 ? 24 : 12);
      return [
        p[0] + n[0] * 0.16 + a[0] * r * Math.cos(angle),
        floor + y + r * Math.sin(angle),
        p[1] + n[1] * 0.16 + a[1] * r * Math.cos(angle),
      ];
    });
  face('copper', pts, [n[0], 0, n[1]]);
  beam(
    face,
    [p[0] + n[0] * 0.2, floor + y, p[1] + n[1] * 0.2],
    [p[0] + n[0] * 0.2, floor + y + 1.5, p[1] + n[1] * 0.2],
    0.1,
    'gold',
  );
  for (const z of [-1, 1])
    beam(
      face,
      [p[0] + n[0] * 0.2, floor + y, p[1] + n[1] * 0.2],
      [p[0] + n[0] * 0.2 + a[0] * z * 1.1, floor + y + 0.6, p[1] + n[1] * 0.2 + a[1] * z * 1.1],
      0.08,
      'gold',
    );
}
function build(out, d) {
  const base = writer(out, d),
    face = (slot, p, n, col) => {
      const max = d === 0 ? 48 : d === 1 ? 24 : 16;
      function split(t) {
        const edges = t.map((a, i) => Math.hypot(...a.map((v, k) => v - t[(i + 1) % 3][k]))),
          len = Math.max(...edges),
          i = edges.indexOf(len);
        if (len <= max) {
          base(slot, t, n, col);
          return;
        }
        const j = (i + 1) % 3,
          k = (i + 2) % 3,
          m = lerp(t[i], t[j], 0.5);
        split([t[i], m, t[k]]);
        split([m, t[j], t[k]]);
      }
      for (let i = 1; i < p.length - 1; i++) split([p[0], p[i], p[i + 1]]);
    };
  body(out, face, d);
  towers(out, face, d);
  cloister(face, d);
  clockField(face, d);
}
export const buildMagdeburgSkyline = (o) => build(o, 0),
  buildMagdeburgDistrict = (o) => build(o, 1),
  buildMagdeburgStreet = (o) => build(o, 2),
  buildMagdeburgCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const magdeburgStudy = {
  id: 'N0355',
  key: 'cathedral_of_magdeburg',
  title: 'Cathedral of Magdeburg',
  category: 'cathedral',
  wikidataId: 'Q668341',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID main way and current cathedral/cloister/35 part plans. Western twin towers,eastern choir and southern courtyard sign the old axis;peripheral facade/function details approximate.',
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
    'Five existing 256-square raw limestone,slate,copper,granite and plain wood graphs. Warm stone walls/pale trim,gray slate roofs,restrained green-gray copper ledges and flat blue-gray glazing. Metric UVs,hard architectural normals,no embedded images. Stone spire cones use limestone with a muted gray tint;no baked age/soot.',
  importReason:
    'Four browser levels preserve individual twin open-belfry western towers,high basilica/transept/choir,radiating chapels and mapped cloister with its open courtyard.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three useful exterior pictures and standard PMTiles/DEM. Exact twin-tower height inequality,wall/eave/roof/belfry/cone subdivisions,windows/doors/tracery,pinnacles,clock and arcade rhythm are estimated. Current 99m tower parts differ from retained unqualified 104m fact. Adjacent cloister/chapter massing retains current plans;peripheral facades/functions are not independently verified. Exact statues,inscriptions,clock numerals,full interiors and certified walking excluded. Absolute altitude/thresholds and physical device timings pending.',
    'Skyline keeps individual primary masses,coarse stone cones,four-post rectangular open western belfries and sparse gallery posts;aisle roofs use simple slopes and cloister ranges use flat roof masses. Two small overlapping peripheral masses are omitted;gallery floors use terrain. Its 6.5m error allowance reflects these roof/secondary-mass changes. District adds shared surfaces,flat facade fields,octagonal round-arched belfries,aisle gable rhythm,clock and pointed court arcades. Street opens major facade recesses and adds sparse mullions/pinnacles;closeup/master refine curved aperture/cone/trim detail and abstract crockets. Peripheral range fields remain shallow. Curvature,openings,aisle roof silhouette and ornament change visibly. Swedish-cottage context is synthetic,not local map buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('twin-open-western-belfries', [-106, 82, 33], [-51, 78, -3]),
    cam('western-portal-clock-and-gable', [-143, 40, -3], [-58, 33, -3]),
    cam('nave-aisle-gables-and-buttresses', [-6, 40, 62], [-10, 27, 7]),
    cam('polygonal-choir-and-radiating-chapels', [92, 35, 14], [45, 24, -1]),
    cam('open-cloister-courtyard', [12, 45, 90], [12, 4, 40]),
    cam('north-transept-and-eastern-tower', [57, 35, -63], [24, 24, -16]),
  ],
};

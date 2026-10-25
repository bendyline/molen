/** Monaco Cathedral: Romanesque arcades, three deep porches and red tiled roofs. */
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
  h.shape === 'round' && d === -1
    ? [
        [-h.width / 2, h.bottom],
        [h.width / 2, h.bottom],
        ...Array.from({ length: 4 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          return [
            (Math.cos(a) * h.width) / 2,
            h.bottom + h.spring + Math.sin(a) * (h.height - h.spring),
          ];
        }),
      ]
    : h.shape === 'circle'
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
  if (h.shape !== 'circle' && !(h.shape === 'round' && d === -1)) return v;
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
  '../../../content/worldgen/source/places/sp/spv/cathedral_of_our_lady_immaculate/',
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
  wall: '#e1ddd1',
  trim: '#e9e3d7',
  roof: '#af7660',
  gray: '#abaeaa',
  door: '#584135',
  glass: '#4e6266',
  accent: '#b4afa1',
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
const footing = (p) => Math.min(floor - 0.3, monacoCathedralGround(...p) - 0.35);
export function monacoCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Monaco Cathedral footing outside retained terrain');
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
  // Three broad arch facets in district; four in street; eight in close views.
  const hs = holes.map((h) => prepareOpening(h, 0, d === 1 ? -1 : d === 2 ? 1 : d)),
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
const coarse = (r, tolerance = 1.4) => {
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
      if (
        t >= -0.05 &&
        t <= 1.05 &&
        Math.hypot(b[0] - a[0] - t * dx, b[1] - a[1] - t * dz) < tolerance
      ) {
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
function panel(face, h, d) {
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
  if (h.spring > 0)
    for (const u of [-0.22, 0.22])
      beam(
        face,
        p.point(h.width * u, h.bottom, -0.66 * sg),
        p.point(h.width * u, h.bottom + h.spring, -0.66 * sg),
        0.11,
        'trim',
      );
  if (d >= 3 && h.shape === 'round') {
    for (const a of [Math.PI / 6, Math.PI / 2, (Math.PI * 5) / 6]) {
      const r = h.width / 2;
      beam(
        face,
        p.point(0, h.bottom + Math.max(0, h.spring - 0.1), -0.64 * sg),
        p.point(Math.cos(a) * r * 0.85, h.bottom + h.spring + Math.sin(a) * r * 0.85, -0.64 * sg),
        0.11,
        'trim',
      );
    }
  }
}

const plans = rec.plans,
  main = rec.main.polygons[0].outline;
const R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * Math.PI * 2) / n) * r,
      p[1] + Math.sin((i * Math.PI * 2) / n) * r,
    ]);
const F = (name, f, t, w, b, h, s = h, shape = 'round', depth = 3) =>
  hole(name, lerp(f.a, f.b, t), f.axis, f.normal, w, b, h, s, shape, depth);
function frontFrame(z) {
  return main
    .map((_, i) => faceFrame(main, i))
    .filter(
      (f) => f.normal[0] < -0.8 && Math.min(f.a[1], f.b[1]) <= z && Math.max(f.a[1], f.b[1]) >= z,
    )
    .sort((a, b) => a.a[0] + a.b[0] - (b.a[0] + b.b[0]))[0];
}
function frontField(name, z, w, b, h, s = h, shape = 'round', depth = 3) {
  const f = frontFrame(z);
  return F(name, f, (z - f.a[1]) / (f.b[1] - f.a[1]), w, b, h, s, shape, depth);
}
const towers = ['towerWest', 'towerEast'];
const towerRing = (key) => {
  const p = rec.estimated[`${key}Center`],
    r = rec.estimated.towerWidth / 2;
  return R(p[0] - r, p[1] - r, p[0] + r, p[1] + r);
};
const porchFields = () => [
  {
    ...hole(
      'central-porch',
      [-39.0, 0.65],
      [0, 1],
      [-1, 0],
      6.0,
      floor + 0.4,
      9.6,
      6.6,
      'round',
      9,
    ),
    kind: 'door',
    backOffset: 3.8,
  },
  ...[-8.0, 8.1].map((z, i) => ({
    ...hole(`side-porch-${i}`, [-37.3, z], [0, 1], [-1, 0], 4.4, floor + 0.4, 8.1, 5.9, 'round', 7),
    kind: 'door',
    backOffset: 2.1,
  })),
];
function fields(d = 3) {
  const a = porchFields();
  a.push(frontField('central-wheel-rose', 0.65, 5.4, 19.3, 5.4, 0, 'circle', 4));
  for (const z of [-0.9, 0.65, 2.2])
    a.push(frontField(`three-central-lights-${z}`, z, 1.1, 15.2, 3.5, 2.95));
  for (const z of [-10, -7.5, -5, 5.0, 7.5, 9.5]) {
    a.push(frontField(`front-upper-${z}`, z, 1.75, 17.3, 3.9, 3.025));
    for (const dz of [-0.35, 0.35])
      a.push(frontField(`front-small-pair-${z}-${dz}`, z + dz, 0.58, 12.2, 1.7, 1.41));
  }
  // This side of the upper front is an inferred setback above the mapped low round corner.
  for (const x of [-34.5, -31.2, -27.9]) {
    for (const y of [12.2, 17.3])
      a.push(
        hole(
          `front-west-${x}-${y}`,
          [x, -11.5],
          [1, 0],
          [0, -1],
          y < 15 ? 1.2 : 1.75,
          floor + y,
          y < 15 ? 2.1 : 3.9,
          y < 15 ? 1.5 : 3.025,
          'round',
          3,
        ),
      );
  }
  for (const sg of [-1, 1]) {
    const f = edge(plans.nave[0].outline, [0, sg]);
    for (const x of [-21, -15.4, -9.8, -4.2, 1.4])
      a.push(F(`nave-${sg}-${x}`, f, (x - f.a[0]) / (f.b[0] - f.a[0]), 1.8, 13.0, 3.8, 2.9));
    const r = plans[sg < 0 ? 'aisleWest' : 'aisleEast'][0].outline,
      f2 = edge(r, [0, sg]);
    for (const x of [-21, -14, -7, 0])
      for (const dx of [-0.7, 0.7])
        a.push(
          F(
            `aisle-pair-${sg}-${x}-${dx}`,
            f2,
            (x + dx - f2.a[0]) / (f2.b[0] - f2.a[0]),
            0.9,
            5.0,
            3.8,
            3.35,
          ),
        );
    const tr = plans[sg < 0 ? 'transeptWest' : 'transeptEast'][0].outline,
      tf = edge(tr, [0, sg]);
    for (const j of [-1, 0, 1]) {
      const t = 0.5 + j * 0.26;
      a.push(F(`transept-lower-${sg}-${j}`, tf, t, 1.8, 11.4, 3.9, 3.0));
      a.push(
        F(
          `transept-upper-${sg}-${j}`,
          tf,
          t,
          1.8,
          j === 0 ? 18.0 : 17.2,
          j === 0 ? 4.5 : 3.9,
          j === 0 ? 3.6 : 3.0,
        ),
      );
    }
    a.push({ ...F(`transept-wood-door-${sg}`, tf, 0.5, 3.1, 0.4, 6.2, 4.65), kind: 'door' });
  }
  for (const key of towers) {
    const r = towerRing(key);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      for (const t of [0.31, 0.69])
        a.push(F(`${key}-paired-${i}-${t}`, f, t, 1.35, 24.8, 3.2, 2.525));
    }
  }
  const lr = circle(rec.estimated.crossingCenter, rec.estimated.crossingRadius, 8);
  for (let i = 0; i < lr.length; i++)
    a.push(F(`octagonal-lantern-${i}`, faceFrame(lr, i), 0.5, 1.2, 25.0, 2.8, 2.2));
  for (const [key, _sg, b, h] of [
    ['apse', 0, 13.8, 3.5],
    ['eastChapel', 1, 9.6, 4.3],
  ]) {
    const r = plans[key][0].outline;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 1.4 || (key === 'apse' ? f.normal[0] < 0.2 : f.normal[1] < 0.2)) continue;
      if (key === 'apse' && i % 2 === 1) continue;
      a.push(F(`${key}-window-${i}`, f, 0.5, Math.min(1.2, f.length * 0.6), b, h, h - 0.6));
    }
  }
  const rr = circle(rec.estimated.frontRoundCenter, rec.estimated.frontRoundRadius, d < 2 ? 8 : 12);
  for (let i = 0; i < rr.length; i++) {
    const f = faceFrame(rr, i);
    if (f.normal[1] > -0.2) continue;
    a.push(F(`round-front-corner-${i}`, f, 0.5, Math.min(0.9, f.length * 0.68), 4.3, 2.4, 1.95));
  }
  if (d >= 3) {
    a.push({
      ...hole(
        'central-stone-relief',
        [-38.6, 0.65],
        [0, 1],
        [-1, 0],
        3.3,
        floor + 28.0,
        3.3,
        0,
        'circle',
        4,
      ),
      kind: 'relief',
    });
    for (const z of [-10.1, -8.9, -7.7, -6.5, -5.3, 4.7, 5.9, 7.1, 8.3, 9.5])
      a.push({
        ...frontField(`blind-front-arcade-${z}`, z, 0.65, 24.3, 1.4, 1.075, 'round', 0.9),
        kind: 'blind',
      });
    for (const sg of [-1, 1]) {
      const f = edge(plans[sg < 0 ? 'transeptWest' : 'transeptEast'][0].outline, [0, sg]);
      for (let j = 0; j < 9; j++) {
        const t = (j + 0.5) / 9,
          raise = 3.4 * (1 - Math.abs(t - 0.5) * 2);
        a.push({
          ...F(
            `blind-transept-gable-${sg}-${j}`,
            f,
            t,
            0.6,
            22.6 + raise * (3.2 / 3.4),
            1.1,
            0.8,
            'round',
            0.9,
          ),
          kind: 'blind',
        });
      }
    }
  }
  return a.map((h) => ({ ...h, surfaceOnly: d === 2 && h.width < 1.5 && h.kind !== 'door' }));
}
export const monacoCathedralFields = fields;
function belfryFields() {
  return towers.flatMap((key) =>
    towerRing(key).flatMap((_, i) => {
      const f = faceFrame(towerRing(key), i);
      return [0.16, 0.39, 0.61, 0.84].map((t, j) =>
        F(`${key}-open-belfry-${i}-${j}`, f, t, 0.95, 30.4, 3.2, 2.725, 'round', 1.8),
      );
    }),
  );
}
export const monacoCathedralBelfryFields = belfryFields;
function slab(face, x, depth, pts, slot = 'wall') {
  const ids = earcut(pts.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    for (const [xx, n] of [
      [x, -1],
      [x + depth, 1],
    ])
      face(
        slot,
        ids.slice(i, i + 3).map((k) => [xx, floor + pts[k][1], pts[k][0]]),
        [n, 0, 0],
      );
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      q = pts[(i + 1) % pts.length];
    face(
      slot,
      [
        [x, floor + a[1], a[0]],
        [x + depth, floor + a[1], a[0]],
        [x + depth, floor + q[1], q[0]],
        [x, floor + q[1], q[0]],
      ],
      [0, (a[0] - q[0]) * sign(pts), (q[1] - a[1]) * sign(pts)],
    );
  }
}
function column(face, p, b, t, r, d) {
  if (d === 1) {
    solid(face, circle(p, r, 4), b, t, 'trim');
    return;
  }
  profile(
    face,
    circle(p, r, d < 2 ? 4 : d === 2 ? 6 : 8),
    d < 2
      ? [
          [b, 1.35],
          [t - 0.4, 0.85],
          [t, 1.35],
        ]
      : [
          [b, 1.4],
          [b + 0.25, 1.4],
          [b + 0.45, 1],
          [t - 0.5, 0.9],
          [t - 0.25, 1.4],
          [t, 1.4],
        ],
    'trim',
  );
}
function figure(face, p, b, h, d) {
  const r = circle(p, 0.22, d >= 3 ? 6 : 4);
  solid(face, R(p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3), b, b + 0.2, 'trim');
  profile(
    face,
    r,
    [
      [b + 0.2, 1.3],
      [b + h * 0.65, 0.7],
      [b + h * 0.78, 1],
      [b + h * 0.87, 0.5],
      [b + h, 0.55],
    ],
    'trim',
  );
}
function crossFinial(face, p, b, t) {
  beam(face, at(p, b), at(p, t), 0.12, 'accent');
  beam(face, at([p[0], p[1] - 0.4], t - 0.5), at([p[0], p[1] + 0.4], t - 0.5), 0.12, 'accent');
}
function porches(out, face, d, hs) {
  for (const h of hs.filter((h) => h.name.includes('porch'))) {
    const x = h.center[0],
      z = h.center[1],
      r = R(x - 0.15, z - h.width / 2 - 0.7, x + 2.3, z + h.width / 2 + 0.7),
      top = h.height + 0.65,
      cut = writer(
        masked(out, d >= 1 ? [prepareOpening(h, 0, d === 1 ? -1 : d === 2 ? 1 : d)] : []),
        d,
      );
    solid(cut, r, 0.4, top, 'wall');
    slab(
      cut,
      x - 0.2,
      1.8,
      [
        [z - h.width / 2 - 0.75, top],
        [z, top + 1.7],
        [z + h.width / 2 + 0.75, top],
      ],
      'wall',
    );
    if (d === 0) {
      pane(face, h, d, 0.03, 'door');
      continue;
    }
    // Reveal thickness comes from the same porch prism that was cut above.
    openingReveals(
      {
        addTriangle(_s, ref, p, n, uv, col) {
          out.addTriangle('wall', ref, p, n, uv, col);
        },
      },
      r,
      () => floor + 0.4,
      () => floor + top,
      [prepareOpening(h, 0, d === 1 ? -1 : d === 2 ? 1 : d)],
      colors.wall,
    );
    archBand(face, h, d, 0.32, 'trim', 0.06);
    for (const sg of [-1, 1]) {
      for (const offset of [0.25, 0.65]) {
        const p = [x - 0.5, z + sg * (h.width / 2 + offset)];
        if (d === 1) {
          column(face, p, 0.4, h.spring + 0.4, 0.16, d);
          continue;
        }
        column(face, p, 0.4, 4.4, 0.17, d);
        column(face, p, 4.65, h.spring + 0.4, 0.15, d);
      }
      if (d >= 2)
        solid(
          face,
          R(
            x - 0.8,
            z + sg * (h.width / 2 + 0.45) - 0.6,
            x - 0.15,
            z + sg * (h.width / 2 + 0.45) + 0.6,
          ),
          4.35,
          4.8,
          'trim',
        );
    }
    const stepCount = d === 1 ? 3 : 12;
    for (let j = 0; j < stepCount; j++)
      solid(
        face,
        R(
          x - 0.3 - j * (d === 1 ? 1.35 : 0.25),
          z - h.width / 2 - 0.4,
          x + 1.8,
          z + h.width / 2 + 0.4,
        ),
        footing,
        0.4 - (j * 1.375) / (stepCount - 1),
        'trim',
      );
  }
}
function towersBuild(out, face, d, hs, bells) {
  for (const key of towers) {
    const r = towerRing(key);
    shell(
      out,
      d,
      r,
      14,
      30,
      d >= 2 ? hs.filter((h) => !h.surfaceOnly && h.name.startsWith(`${key}-paired`)) : [],
    );
    cap(face, r, 30, 'trim');
    if (d >= 1)
      shell(
        out,
        d,
        r,
        30,
        34.5,
        bells.filter((h) => h.name.startsWith(`${key}-open`)),
        'wall',
        scaled(r, 0.76),
      );
    else solid(face, r, 30, 34.5, 'wall');
    solid(face, scaled(r, 1.08), 34.5, 35, 'trim');
    cap(face, r, 35.05, 'roof');
    if (d >= 1) {
      cap((s, p) => face(s, p, [0, -1, 0]), r, 34.4, 'trim');
      band(face, r, 23.8, 0.35, 'trim', 1.04);
      band(face, r, 29.4, 0.6, 'trim', 1.08);
    }
    if (d >= 2) {
      crossFinial(face, center(r), 35.05, 36);
      for (const p of r)
        solid(face, R(p[0] - 0.15, p[1] - 0.15, p[0] + 0.15, p[1] + 0.15), 14.4, 29.7, 'trim');
    }
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
        const spans = p.map((a, i) => {
            const b = p[(i + 1) % 3];
            return Math.hypot(a[0] - b[0], a[2] - b[2]);
          }),
          m = Math.max(...spans);
        if (m > (d === 0 ? 24 : d === 1 ? 16 : 8)) {
          const i = spans.indexOf(m),
            j = (i + 1) % 3,
            k = (i + 2) % 3,
            q = lerp(p[i], p[j], 0.5),
            v = lerp(uv[i], uv[j], 0.5);
          this.addTriangle(slot, ref, [p[i], q, p[k]], n, [uv[i], v, uv[k]], col);
          this.addTriangle(slot, ref, [q, p[j], p[k]], n, [v, uv[j], uv[k]], col);
          return;
        }
        target.addTriangle(slot, ref, p, n, uv, col);
      },
    },
    face = writer(out, d),
    hs = fields(d),
    bells = belfryFields(),
    cut = writer(
      masked(
        out,
        d >= 2
          ? hs.filter((h) => !h.surfaceOnly).map((h) => prepareOpening(h, 0, d === 2 ? 1 : d))
          : d === 1
            ? hs.filter((h) => h.name.includes('porch')).map((h) => prepareOpening(h, 0, -1))
            : [],
      ),
      d,
    ),
    wall = (r, b, t) =>
      shell(
        out,
        d,
        d <= 1 ? coarse(r, d === 0 ? 1.4 : 0.65) : r,
        b,
        t,
        d >= 2
          ? hs.filter((h) => !h.surfaceOnly)
          : d === 1
            ? hs.filter((h) => h.name.includes('porch'))
            : [],
      );
  wall(main, footing, 4);
  if (d !== 1) cap(cut, d === 0 ? coarse(main, 1.4) : main, 4, 'wall');
  for (const p of plans.frontHigh) {
    wall(p.outline, 4, 26.5);
    gable(cut, rec.estimated.frontRoof, 26.5, 32.5, 'roof', 0);
  }
  for (const p of plans.frontLow) {
    wall(p.outline, 4, 8.5);
    hip(face, p.outline, 8.5, 9.0, 'roof', 0);
  }
  const central = R(-38.6, -3.5, -35, 4.8);
  wall(central, 26.5, 32.5);
  slab(
    cut,
    -38.65,
    1.2,
    [
      [-3.5, 32.5],
      [0.65, 34.5],
      [4.8, 32.5],
    ],
    'wall',
  );
  for (const p of plans.nave) {
    wall(p.outline, 4, 18);
    gable(face, p.outline, 18, 24, 'roof', 0);
  }
  for (const key of ['aisleWest', 'aisleEast', 'low', 'ambulatory'])
    for (const p of plans[key]) {
      wall(p.outline, 4, 10.5);
      hip(face, d <= 1 ? coarse(p.outline) : p.outline, 10.5, 13, 'roof', 0);
    }
  for (const key of ['transeptWest', 'transeptEast'])
    for (const p of plans[key]) {
      wall(p.outline, 4, 24);
      gable(cut, p.outline, 24, 28.5, 'roof', 1);
    }
  for (const p of plans.choir) {
    wall(p.outline, 4, 18);
    gable(face, p.outline, 18, 24, 'roof', 0);
  }
  for (const p of plans.apse) {
    wall(p.outline, 4, 18);
    hip(face, d === 0 ? coarse(p.outline) : p.outline, 18, 24, 'roof', 0);
  }
  for (const p of plans.eastChapel) {
    wall(p.outline, 4, 15.2);
    hip(face, d === 0 ? coarse(p.outline) : p.outline, 15.2, 18.5, 'roof', 1);
  }
  for (const p of plans.frontStair) {
    wall(p.outline, 4, 8.5);
    hip(face, d === 0 ? coarse(p.outline) : p.outline, 8.5, 9.1, 'roof', 0);
  }
  const rr = circle(rec.estimated.frontRoundCenter, rec.estimated.frontRoundRadius, d < 2 ? 8 : 12);
  shell(
    out,
    d,
    rr,
    0.4,
    8.5,
    d >= 2 ? hs.filter((h) => !h.surfaceOnly && h.name.startsWith('round-front')) : [],
  );
  cap(face, rr, 8.5, 'trim');
  const tur = circle(rec.estimated.smallTurretCenter, rec.estimated.smallTurretRadius, 8);
  solid(face, tur, 8.0, 11.5, 'wall');
  profile(
    (_s, p, n) => face('roof', p, n, colors.gray),
    tur,
    [
      [11.5, 1.1],
      [14, 0.06],
    ],
    'roof',
  );
  const lr = circle(rec.estimated.crossingCenter, rec.estimated.crossingRadius, 8);
  shell(
    out,
    d,
    lr,
    20,
    29,
    d >= 2 ? hs.filter((h) => !h.surfaceOnly && h.name.startsWith('octagonal-lantern')) : [],
  );
  profile(
    face,
    lr,
    [
      [29, 1.05],
      [31, 0.15],
    ],
    'roof',
  );
  porches(out, face, d, hs);
  towersBuild(out, face, d, hs, bells);
  if (d >= 1)
    for (const h of hs) {
      if (h.surfaceOnly) {
        pane(face, h, d, 0.07, 'glass');
        continue;
      }
      if (h.name.includes('porch')) {
        pane(face, h, d, -h.backOffset, 'trim');
        pane(
          face,
          {
            ...h,
            width: h.width * 0.75,
            height: h.name === 'central-porch' ? 5.3 : 4.7,
            spring: h.name === 'central-porch' ? 5.3 : 4.7,
            shape: 'rect',
          },
          d,
          -h.backOffset + 0.035,
          'door',
        );
        continue;
      }
      if (h.kind === 'blind' || h.kind === 'relief') {
        pane(
          face,
          h,
          d,
          h.kind === 'relief' ? -0.75 : -0.25,
          h.kind === 'relief' ? 'trim' : 'accent',
        );
        if (h.kind === 'relief' && d >= 3)
          figure(face, [h.center[0] + 0.4, h.center[1]], 28.3, 2.2, d);
        continue;
      }
      if (h.shape === 'circle') {
        pane(face, h, d, d >= 2 ? -0.75 : 0.07, 'glass');
        if (d >= 2) {
          archBand(face, h, d, 0.25, 'trim', 0.07);
          const p = prepareOpening(h, 0, d),
            sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
            cy = h.bottom + h.height / 2;
          for (let i = 0; i < 12; i++) {
            const a = (i * Math.PI) / 6;
            beam(
              face,
              p.point(0, cy, -0.64 * sg),
              p.point(Math.cos(a) * h.width * 0.46, cy + Math.sin(a) * h.height * 0.46, -0.64 * sg),
              0.14,
              'trim',
            );
          }
        }
      } else panel(face, h, d);
    }
  if (d >= 1) {
    band(face, lr, 28.5, 0.5, 'trim', 1.04);
    band(face, rr, 8.15, 0.35, 'trim', 1.06);
  }
  if (d <= 1) beam(face, at([-38.4, 0.65], 34.5), at([-38.4, 0.65], 36.5), 0.18, 'trim');
  if (d >= 2) {
    for (const y of [10.9, 23.6, 26.1])
      for (const p of plans.frontHigh) band(face, p.outline, y, 0.35, 'trim', 1.004);
    for (const sg of [-1, 1]) {
      const f = edge(plans[sg < 0 ? 'aisleWest' : 'aisleEast'][0].outline, [0, sg]);
      for (const x of [-24, -17.5, -10.5, -3.5, 3.6]) {
        const p = lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0]));
        solid(face, R(p[0] - 0.25, p[1] - 0.2, p[0] + 0.25, p[1] + 0.2), 4.2, 10.2, 'trim');
      }
      for (const p of plans[sg < 0 ? 'transeptWest' : 'transeptEast'])
        band(face, p.outline, 10.7, 0.4, 'trim', 1.01);
    }
    for (const z of [-11.0, 10.0]) {
      solid(face, R(-36.8, z - 0.25, -36.2, z + 0.25), 10.5, 26.8, 'trim');
      solid(face, R(-36.3, z - 0.35, -35.7, z + 0.35), 26.4, 27.2, 'trim');
      figure(face, [-36.0, z], 27.2, 1.6, d);
    }
    figure(face, [-38.4, 0.65], 34.5, 2, d);
  }
}
export const buildMonacoCathedralSkyline = (o) => build(o, 0),
  buildMonacoCathedralDistrict = (o) => build(o, 1),
  buildMonacoCathedralStreet = (o) => build(o, 2),
  buildMonacoCathedralCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const monacoCathedralStudy = {
  id: 'cathedral_of_our_lady_immaculate',
  key: 'cathedral_of_our_lady_immaculate',
  title: 'Cathedral of Our Lady Immaculate',
  category: 'cathedral',
  wikidataId: 'Q667450',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID current71-vertex whole;no independent components. Signed current nave-wall axis corrects earlier minimum rectangle by6.887668degrees. All architecture partitions/height estimates retain source limits.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing cached256-square coursed limestone,continuous limestone,flat tile and plain-wood graphs serve six merged groups. Linear pale stone/red tile/wood tints,metric UVs,flat architectural normals and geometric PBR glass/stone accents. No embedded images,unique facade maps or baked shadows.',
  importReason:
    'Four authored browser levels preserve the individual three-porch Romanesque front,central rose/clustered round fields,gabled transepts,red roofs,scalloped rear/rounded side chapel,paired flat-capped open belfries and octagonal crossing lantern.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three inspected2015/2021 front and west-transept pictures plus standard viewer PMTiles/DEM only. All heights/internal partitions,opposite/hidden rear/roof/tower details and minor chapel functions are estimates. Wheel rose/tracery,abstract relief/figures,porch carving,roof decoration,full interiors and exact paving/street thresholds are simplified or excluded. Physical phone/laptop timings pending.',
    'Source preview includes a bounded estimated plaza grade to show the exterior on noisy coarse coastal terrain;it does not alter host DEM. Runtime front skirt exposure/rear clipping and exact terrain/door contact remain unverified.',
    'Skyline retains three-porch front silhouette,red roofs,rounded rear/side forms,paired low tower caps and octagonal lantern;small windows/recesses omitted. District adds shared surfaces,flat glazing/doors,actual porch recesses/open belfries. Street adds major recessed body glazing/deep portals,flat small fields,rose spokes and columns/cornices;closeup/master add the small recesses,shallow blind arcades,abstract relief/figures and finer frames. Synthetic cottages are fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('three-deep-porches-and-paired-columns', [-82, 16, -16], [-36, 8, 0.65]),
    cam('rose-clustered-windows-and-raised-gable', [-81, 35, 2], [-36, 22, 0.65]),
    cam('west-transept-and-round-window-tiers', [11, 28, -61], [8, 16, -15]),
    cam('paired-open-belfries-and-octagonal-lantern', [47, 43, -43], [16, 26, 0]),
    cam('scalloped-apse-and-rounded-east-chapel', [83, 42, 34], [28, 13, 4]),
    cam('roof-and-corrected-map-axis', [0, 165, 1], [0, 16, 0]),
  ],
};

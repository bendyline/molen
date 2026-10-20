/** Gurk Cathedral: twin pale bulb towers, blue-grey basilica roofs and three unequal Romanesque apses. */
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
  '../../../content/worldgen/source/places/u2/u26/n0404_gurk_cathedral/',
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
  wall: '#d2c5a4',
  plaster: '#e5ddcf',
  trim: '#dbcead',
  roof: '#78888e',
  cap: '#60757a',
  door: '#71614f',
  glass: '#526775',
  gold: '#c7a44b',
  apseRoof: '#626d69',
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
const footing = (p) => Math.min(floor - 0.3, gurkGround(...p) - 0.35);
export function gurkGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Gurk Cathedral footing outside retained terrain');
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
  main = rec.main.polygons[0].outline,
  circle = (p, r, n, off = 0) =>
    Array.from({ length: n }, (_, i) => [
      p[0] + Math.cos((i * Math.PI * 2) / n + off) * r,
      p[1] + Math.sin((i * Math.PI * 2) / n + off) * r,
    ]),
  segments = (d) => (d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 16 : 24);
export function gurkFields(d = 3) {
  const f = [
    {
      ...hole('west-round-portal', [-34.2, 0], [0, 1], [-1, 0], 3.3, 0.15, 6, 4.3, 'round', 5),
      kind: 'door',
    },
  ];
  if (d >= 1) {
    for (const z of [-2.7, 2.7])
      f.push(
        hole(`west-upper-light-${z}`, [-34.2, z], [0, 1], [-1, 0], 0.7, 8.7, 2.7, 2.2, 'round', 3),
      );
    f.push(hole('west-oculus', [-34.2, 0], [0, 1], [-1, 0], 1.05, 11.8, 1.05, 1.05, 'circle', 3));
    for (const side of [-1, 1])
      for (const x of d === 1 ? [-16, -2, 12] : [-20, -13, -6, 1, 8, 15])
        f.push(
          hole(
            `clerestory-${side}-${x}`,
            [x, side < 0 ? -5.2 : 5.5],
            [1, 0],
            [0, side],
            0.9,
            16.8,
            2.0,
            1.55,
            'round',
            2,
          ),
        );
  }
  if (d >= 2) {
    for (const side of [-1, 1])
      for (const x of [-19, -10, -1, 8])
        f.push(
          hole(
            `aisle-light-${side}-${x}`,
            [x, side < 0 ? -11.05 : 12],
            [1, 0],
            [0, side],
            0.85,
            6.4,
            2.3,
            1.8,
            'round',
            2.3,
          ),
        );
    f.push({
      ...hole('south-aisle-door', [6, 12], [1, 0], [0, 1], 1.7, 0.3, 3.8, 2.8, 'round', 3),
      kind: 'door',
    });
    for (const z of [-7.2, 7.6])
      f.push(
        hole(`east-choir-upper-${z}`, [28.3, z], [0, 1], [1, 0], 1.2, 18, 3.0, 2.3, 'round', 2),
      );
  }
  return f;
}
export function gurkTowerFields(d = 3) {
  if (d === 0) return [];
  const fields = [];
  for (const t of plans.towers)
    for (let i = 0; i < 4; i++) {
      const f = faceFrame(t.ring, i);
      for (const a of [0.39, 0.61])
        fields.push({
          ...hole(
            `${t.name}-paired-belfry-${i}-${a}`,
            lerp(f.a, f.b, a),
            f.axis,
            f.normal,
            1.1,
            30,
            4.5,
            3.8,
            'round',
            3,
          ),
          kind: 'louver',
        });
      if (d >= 2)
        fields.push(
          hole(
            `${t.name}-shaft-slit-${i}`,
            lerp(f.a, f.b, 0.5),
            f.axis,
            f.normal,
            0.65,
            20.1,
            1.6,
            1.6,
            'rect',
            3,
          ),
        );
    }
  return fields;
}
export function gurkApseFields(d = 3) {
  if (d === 0) return [];
  return plans.apses.flatMap((a) => {
    const r = circle(a.center, a.radius, segments(d));
    return r.flatMap((_, i) => {
      const f = faceFrame(r, i);
      if (f.normal[0] < 0.45 || i % (d <= 1 ? 3 : 4) !== 0) return [];
      return [
        hole(
          `${a.name}-apse-light-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          a.name === 'central' ? 1.3 : 0.9,
          a.name === 'central' ? 10.2 : 7,
          3.1,
          2.4,
          'round',
          4,
        ),
      ];
    });
  });
}
function panel(face, h, d) {
  pane(face, h, d, -0.32, h.kind === 'door' || h.kind === 'louver' ? 'door' : 'glass');
  if (d >= 1) archBand(face, h, d, h.kind === 'door' ? 0.3 : 0.17, 'trim', 0.08);
  if (d >= 2 && h.kind === 'louver') {
    const v = prepareOpening(h, 0, d),
      off = -0.2 * Math.sign(-v.axis[1] * h.normal[0] + v.axis[0] * h.normal[1]);
    for (let y = h.bottom + 0.4; y < h.bottom + h.spring - 0.15; y += 0.46)
      beam(face, v.point(-h.width * 0.42, y, off), v.point(h.width * 0.42, y, off), 0.1, 'door');
  }
}
function church(out, face, d) {
  const fields = gurkFields(d),
    all = [...fields, ...gurkApseFields(d)],
    mask = writer(
      masked(
        out,
        all.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    ),
    r = d <= 1 ? coarse(main) : main;
  if (d === 0) sides(mask, r, footing, 0.08, 'wall');
  else solid(mask, r, footing, 0.08, 'wall');
  shell(out, d, r, footing, 11.8, all, 'wall');
  if (d > 0) cap(mask, r, 11.8, 'roof');
  for (const [role, eave, top] of [
    ['nave', 20, 27],
    ['northAisle', 11.8, 16],
    ['southAisle', 11.8, 16],
    ['choir', 22, 27.8],
    ['entrance', 14, 19.3],
  ]) {
    const ring = plans[role];
    shell(out, d, ring, footing, eave, fields, 'wall');
    if (role === 'entrance') hip(mask, ring, eave, top, 'cap', 0);
    else gable(mask, ring, eave, top, 'roof', 0);
    if (d >= 1) band(face, ring, eave - 0.25, 0.3, 'trim', 1.01);
  }
  for (const h of fields) panel(face, h, d);
  if (d >= 2) {
    gable(face, R(-32.7, -0.9, -31.1, 0.9), 16, 18, 'cap', 0);
    const q = [-32.71, 0];
    face(
      'cap',
      [
        [q[0], floor + 16.2, q[1] - 0.7],
        [q[0], floor + 17.6, q[1]],
        [q[0], floor + 16.2, q[1] + 0.7],
      ],
      [-1, 0, 0],
      colors.apseRoof,
    );
    for (let i = 0; i < 3; i++)
      solid(
        face,
        R(-36 + i * 0.55, -2.5, -34.1, 2.5),
        (p) => Math.min(gurkGround(...p) - 0.15, 0.1),
        0.15 + (i + 1) * 0.14,
        'trim',
      );
  }
}
function apses(out, face, d) {
  const fields = gurkApseFields(d),
    darkFace = (_slot, p, n) => face('cap', p, n, colors.apseRoof);
  for (const a of plans.apses) {
    const r = circle(a.center, a.radius, segments(d)),
      hs = fields.filter((h) => h.name.startsWith(a.name));
    shell(out, d, r, footing, a.wall, hs, 'wall');
    cap(face, r, a.wall, 'wall');
    profile(
      darkFace,
      scaled(r, 1.03),
      [
        [a.wall, 1],
        [a.cap, 0.04],
      ],
      'cap',
    );
    for (const h of hs) panel(face, h, d);
    if (d >= 1) {
      band(face, r, a.wall - 0.65, 0.3, 'trim', 1.02);
      const arcade = circle(a.center, a.radius, d === 1 ? 8 : 12);
      const curvedFace = (slot, points, normal) =>
        face(
          slot,
          points.map((q) => {
            const dx = q[0] - a.center[0],
              dz = q[2] - a.center[1];
            const radius = Math.hypot(dx, dz);
            return [
              a.center[0] + (dx * (a.radius + 0.065)) / radius,
              q[1],
              a.center[1] + (dz * (a.radius + 0.065)) / radius,
            ];
          }),
          normal,
        );
      for (let i = 0; i < arcade.length; i++) {
        const f = faceFrame(arcade, i);
        if (f.normal[0] < 0.1) continue;
        const width = Math.min(4.9, f.length - 0.25);
        const height = a.name === 'central' ? 13.4 : 9.5;
        const h = hole(
          `${a.name}-blind-arch-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          width,
          1.6,
          height,
          height - width / 2,
          'round',
          1,
        );
        archBand(curvedFace, h, d, 0.2, 'trim', 0.045);
        if (d >= 2) solid(face, circle(lerp(f.a, f.b, 0.04), 0.18, 4), 1.6, a.wall - 0.65, 'trim');
      }
    }
  }
}
function clock(face, t, d) {
  if (d < 1 || t.name !== 'north') return;
  const h = hole(
    'north-west-clock',
    [-33.91, t.center[1]],
    [0, 1],
    [-1, 0],
    2.7,
    36.1,
    2.7,
    2.7,
    'circle',
    1,
  );
  pane(face, h, d, 0.05, 'plaster');
  archBand(face, h, d, 0.12, 'trim', 0.07);
  const f = prepareOpening(h, 0, d),
    off = 0.13 * Math.sign(-f.axis[1] * h.normal[0] + f.axis[0] * h.normal[1]),
    y = h.bottom + h.height / 2;
  beam(face, f.point(0, y, off), f.point(0.85, y + 0.25, off), 0.11, 'cap');
  beam(face, f.point(0, y, off), f.point(-0.3, y + 1.03, off), 0.12, 'cap');
}
function goldTip(face, o, d) {
  const goldFace = (_slot, p, n) => face('cap', p, n, colors.gold);
  profile(
    goldFace,
    circle(o, 0.25, d === 0 ? 4 : 8),
    [
      [57.8, 0.2],
      [58.4, 1],
      [58.8, 0.4],
    ],
    'cap',
  );
  beam(goldFace, at(o, 58.8), at(o, 60.6), 0.09, 'cap');
  if (d >= 2) {
    const cy = floor + 60.05,
      r = 0.55;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        goldFace,
        [o[0], cy, o[1]],
        [o[0], cy + Math.sin(a) * r, o[1] + Math.cos(a) * r],
        0.04,
        'cap',
      );
    }
  }
}
function towers(out, face, d) {
  const fields = gurkTowerFields(d);
  for (const t of plans.towers) {
    const r = t.ring,
      o = t.center,
      holes = fields.filter((h) => h.name.startsWith(t.name));
    solid(face, r, footing, 14, 'wall');
    shell(out, d, r, 14, 40.2, holes, 'plaster');
    cap(face, r, 40.2, 'plaster');
    for (const h of holes) panel(face, h, d);
    clock(face, t, d);
    if (d >= 1) {
      band(face, r, 39.65, 0.55, 'trim', 1.075);
      cap(face, scaled(r, 1.075), 40.2, 'trim');
      for (const p of r)
        solid(face, R(p[0] - 0.18, p[1] - 0.18, p[0] + 0.18, p[1] + 0.18), 14, 39.65, 'trim');
      if (d >= 2)
        for (const y of [16, 20, 24, 28, 32, 36])
          for (const p of r)
            solid(face, R(p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3), y, y + 0.55, 'trim');
    }
    profile(
      face,
      scaled(r, 1.12),
      [
        [40.2, 1],
        [41.2, 0.82],
        [43.3, 0.58],
      ],
      'cap',
    );
    const bulb = circle(o, 4, segments(d), Math.PI / 8),
      levels =
        d === 0
          ? [
              [43.3, 0.6],
              [45.4, 1.1],
              [47.7, 0.55],
              [49, 0.3],
            ]
          : [
              [43.3, 0.6],
              [43.8, 0.88],
              [44.5, 1.05],
              [45.7, 1.1],
              [46.8, 0.85],
              [48.2, 0.5],
              [49, 0.3],
            ];
    profile(face, bulb, levels, 'cap');
    const lantern = circle(o, 1.2, d === 0 ? 4 : 8, Math.PI / 8);
    solid(face, scaled(lantern, 1.08), 49, 49.35, 'cap');
    for (const p of lantern) solid(face, circle(p, 0.14, 4), 49.35, 53.2, 'cap');
    cap(face, scaled(lantern, 1.18), 53.2, 'cap');
    if (d >= 1)
      for (let i = 0; i < lantern.length; i++)
        beam(face, at(lantern[i], 51.7), at(lantern[(i + 1) % lantern.length], 51.7), 0.12, 'cap');
    profile(
      face,
      circle(o, 1.65, d === 0 ? 6 : segments(d), Math.PI / 8),
      [
        [53.2, 0.9],
        [53.8, 0.65],
        [54.7, 1],
        [55.5, 0.8],
        [57.1, 0.2],
        [57.8, 0.05],
      ],
      'cap',
    );
    goldTip(face, o, d);
  }
}
function build(target, d) {
  // The viewer rasterizes triangle bounds for replacement. Split broad faces so
  // rotating this long basilica cannot mask unrelated cemetery or court space.
  function emit(args, points, uvs) {
    let edge = 0;
    let longest = 0;
    for (let i = 0; i < 3; i++) {
      const a = points[i];
      const b = points[(i + 1) % 3];
      const length = Math.hypot(a[0] - b[0], a[2] - b[2]);
      if (length > longest) {
        longest = length;
        edge = i;
      }
    }
    if (longest > 20) {
      const a = edge,
        b = (edge + 1) % 3,
        c = (edge + 2) % 3;
      const mid = points[a].map((v, k) => Math.fround((v + points[b][k]) / 2));
      const uv = uvs[a].map((v, k) => (v + uvs[b][k]) / 2);
      emit(args, [points[a], mid, points[c]], [uvs[a], uv, uvs[c]]);
      emit(args, [mid, points[b], points[c]], [uv, uvs[b], uvs[c]]);
      return;
    }
    target.addTriangle(args[0], args[1], points, args[3], uvs, args[5]);
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
  apses(out, face, d);
  towers(out, face, d);
}
export const buildGurkSkyline = (o) => build(o, 0),
  buildGurkDistrict = (o) => build(o, 1),
  buildGurkStreet = (o) => build(o, 2),
  buildGurkCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const gurkCathedralStudy = {
  id: 'N0404',
  key: 'gurk_cathedral',
  title: 'Gurk Cathedral',
  category: 'cathedral',
  wikidataId: 'Q701301',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared 256-square ashlar, lime plaster, sandstone, standing-seam metal, painted metal and plain wood graphs serve seven groups including local blue-grey glass. Gilded finials use vertex tint over the shared metal group. Linear tints, metric UVs and flat normals; no embedded images, unique facade photos, baked lighting or micro-carving.',
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
    'Individual medium-fi cathedral from three inspected exterior pictures and standard viewer PMTiles/DEM. All heights, detailed sub-plans, openings and cap profiles are estimates. Belfry lights are recessed louver-backed panels; octagonal lanterns retain actual open air. Clock, blind arcades, quoins and finials are abstractions. Fine sculpture, faithful masonry ornament, crypt/interiors/bells, hidden monastery joins, current finish, engineering and exact west parvis/cemetery/threshold/base contact simplified, excluded or unverified. Monastery relation, courtyard, detached chapel, cemetery/walls/monument and town buildings remain host content. Synthetic Swiss chalet neighbors are style fixtures. Physical phone/laptop timing pending.',
    'Skyline retains twin pale shafts and double-bulb/open-lantern caps, long basilica roofs and three unequal rounded apses. District adds shared surfaces, paired belfry panels, clerestory/portal fields, clock and coarse blind apse arcades. Street adds aisle/choir lights, shaft slits, corner courses, finer arcade columns, dormer/steps and gilded sunburst abstractions. Close-up/master add finer bulb/apse sampling.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-twin-towers-and-round-portal', [-91, 28, 12], [-29, 22, 0]),
    cam('double-bulbs-open-lanterns-and-clock', [-55, 52, 25], [-29.5, 45, 0]),
    cam('long-south-nave-and-metal-roofs', [2, 30, 69], [0, 13, 4]),
    cam('three-unequal-romanesque-apses', [74, 24, 2], [29, 11, 1]),
    cam('north-aisle-and-separated-monastery', [3, 34, -64], [0, 14, -4]),
    cam('roof-and-signed-plan', [0, 165, 0.1], [0, 20, 0]),
  ],
};

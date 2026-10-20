/** Akhtamar Holy Cross: warm cross gables, conical drum, low narthex and stacked bell entrance. */
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
  '../../../content/worldgen/source/places/sy/syy/n0399_armenian_cathedral_of_the_holy_cross/',
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
  wall: '#d3ba94',
  trim: '#d7bf95',
  roof: '#c4ad86',
  dark: '#8e8d7b',
  door: '#6a5b46',
  metal: '#686d62',
  glass: '#59666b',
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
const footing = (p) => Math.min(floor - 0.3, akhtamarGround(...p) - 0.35);
export function akhtamarGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Akhtamar Holy Cross footing outside retained terrain');
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
const circle = (p, r, n, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos(((i + 0.5) * Math.PI * 2) / n + offset) * r,
    p[1] + Math.sin(((i + 0.5) * Math.PI * 2) / n + offset) * r,
  ]);
export function akhtamarFields(d = 3) {
  const f = [
    {
      ...hole('west-narthex-door', [-16.2, 2.1], [0, 1], [-1, 0], 1.9, 0.1, 3.4, 2.45, 'round', 3),
      kind: 'door',
    },
  ];
  if (d >= 1) {
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++)
        f.push({
          ...hole(
            `narthex-slit-${side}-${i}`,
            [-13.2 + i * 3.55, side < 0 ? -4.3 : 8.65],
            [1, 0],
            [0, side],
            0.33,
            2.2,
            1.0,
            1.0,
            'rect',
            2,
          ),
          kind: 'glass',
        });
    for (const [p, a, n, name] of [
      [[0.48, 0], [0, 1], [-1, 0], 'west-gable'],
      [[12.45, 0], [0, 1], [1, 0], 'east-gable'],
      [[6.475, -8.65], [1, 0], [0, -1], 'north-gable'],
    ])
      f.push({
        ...hole(`${name}-light`, p, a, n, 0.72, 7.8, 2.3, 1.82, 'round', 3),
        kind: 'glass',
      });
    for (const [x, z, a, n, name] of [
      [1.9, 6.7, [1, 0], [0, 1], 'south-west'],
      [10.85, 6.7, [1, 0], [0, 1], 'south-east'],
      [12.45, 2, [0, 1], [1, 0], 'east-low'],
      [2, -6.7, [1, 0], [0, -1], 'north-west'],
      [10.85, -6.7, [1, 0], [0, -1], 'north-east'],
    ])
      f.push({
        ...hole(`${name}-slit`, [x, z], a, n, 0.42, 3.6, 1.85, 1.5, 'round', 3),
        kind: 'glass',
      });
  }
  return f;
}
export function akhtamarDrumFields(d = 3) {
  const r = circle(plans.drumCenter, plans.drumRadius, d === 0 ? 8 : d === 1 ? 12 : 16);
  return r.flatMap((_, i) => {
    if (i % (d <= 1 ? 3 : 2) !== 0) return [];
    const f = faceFrame(r, i);
    return [
      {
        ...hole(
          `drum-light-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          0.64,
          14,
          2.2,
          1.75,
          'round',
          2,
        ),
        kind: 'glass',
      },
    ];
  });
}
export function akhtamarBellFields() {
  const r = plans.bell;
  return r.flatMap((_, i) => {
    const f = faceFrame(r, i);
    if (f.normal[1] < -0.6) return [];
    const front = f.normal[1] > 0.6;
    return [
      hole(
        `bell-upper-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        front ? 3.6 : 1.6,
        5.3,
        3.65,
        2.45,
        'round',
        8,
      ),
    ];
  });
}
export const akhtamarBellDoor = () => ({
  ...hole('south-bell-door', [6.5, 8.75], [1, 0], [0, 1], 2.25, 0.15, 3.8, 2.6, 'round', 8),
  kind: 'door',
});
function panel(face, h, d, depth = 0.25) {
  pane(face, h, d, d === 0 ? 0.055 : -depth, h.kind === 'door' ? 'door' : 'glass');
  if (d < 1) return;
  archBand(face, h, d, h.kind === 'door' ? 0.27 : 0.14, 'trim', 0.08);
  if (d < 2 || h.kind === 'door') return;
  const p = prepareOpening(h, 0, d),
    s = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    point = (u, y) => p.point(u, y, 0.1 * s);
  beam(face, point(0, h.bottom), point(0, h.bottom + h.height - 0.13), 0.055, 'trim');
  for (let y = h.bottom + 0.55; y < h.bottom + h.spring; y += 0.65)
    beam(face, point(-h.width * 0.42, y), point(h.width * 0.42, y), 0.045, 'trim');
}
function alternatingArch(face, h, d, width = 0.28, offset = 0.13) {
  const a = openingShape(h, d),
    b = openingShape(
      {
        ...h,
        width: h.width + width * 2,
        height: h.height + width * 2,
        bottom: h.bottom - width,
        spring: h.spring + width,
      },
      d,
    ),
    p = prepareOpening(h, 0, d),
    s = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  for (let i = 1; i < a.length - 1; i++) {
    const j = (i + 1) % a.length;
    face(
      i % 2 ? 'trim' : 'dark',
      [
        p.point(...a[i], offset * s),
        p.point(...a[j], offset * s),
        p.point(...b[j], offset * s),
        p.point(...b[i], offset * s),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
  }
}
function buildNarthex(out, face, d) {
  const fields = akhtamarFields(d).filter((h) => h.name.startsWith('narthex') || h.kind === 'door'),
    cut = writer(
      masked(
        out,
        fields.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  shell(out, d, plans.narthex, footing, 5.5, fields, 'wall');
  gable(cut, plans.narthex, 5.5, 7.4, 'roof', 0);
  for (const h of fields) panel(face, h, d);
  shell(out, d, plans.northEast, footing, 5.4, [], 'wall');
  gable(face, plans.northEast, 5.4, 7.2, 'roof', 0);
  if (d >= 1) {
    band(face, plans.narthex, 5.35, 0.22, 'trim', 1.012);
    band(face, plans.northEast, 5.2, 0.23, 'trim', 1.02);
  }
}
function buildChurch(out, face, d) {
  const fields = akhtamarFields(d).filter(
      (h) => h.kind !== 'door' && !h.name.startsWith('narthex'),
    ),
    holes = d === 0 ? [] : fields,
    cut = writer(
      masked(
        out,
        holes.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
  shell(out, d, plans.core, footing, 11.4, holes, 'wall');
  hip(cut, plans.core, 11.4, 12.6, 'roof', 0);
  for (const [r, axis] of [
    [plans.eastWest, 0],
    [plans.north, 1],
    [plans.south, 1],
  ]) {
    const south = r === plans.south,
      eave = south ? plans.southRoof.eave : 11.4,
      ridge = south ? plans.southRoof.ridge : 14;
    shell(out, d, r, footing, eave, holes, 'wall');
    gable(cut, r, eave, ridge, 'roof', axis);
  }
  // Shallow polygonal corner projections keep the Armenian cross-body rhythm; their plans are estimated.
  const cornerRing = [];
  for (const p of plans.cornerCenters) {
    const r = circle(p, 1.85, d <= 1 ? 6 : 8);
    cornerRing.push(r);
    shell(out, d, r, footing, 10.4, holes, 'wall');
    profile(
      cut,
      r,
      [
        [10.4, 1.03],
        [11.15, 0.05],
      ],
      'roof',
    );
  }
  for (const h of fields) panel(face, h, d);
  if (d >= 1) {
    for (const r of [plans.eastWest, plans.north, plans.south, ...cornerRing])
      band(face, r, 9.15, 0.22, 'trim', 1.018);
  }
  if (d >= 2) {
    for (const r of [plans.eastWest, plans.north, plans.south])
      band(face, r, 1.3, 0.18, 'trim', 1.012);
    for (const r of cornerRing) {
      band(face, r, 9.15, 0.25, 'trim', 1.035);
      band(face, r, 10.15, 0.2, 'trim', 1.035);
    }
    for (const r of [plans.eastWest, plans.north, plans.south])
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i),
          count = Math.max(2, Math.round(f.length / 1.1));
        for (let j = 0; j < count; j++) {
          const p = lerp(f.a, f.b, (j + 0.5) / count),
            h = hole('frieze-arc', p, f.axis, f.normal, 0.82, 9.35, 0.4, 0.04, 'round', 1);
          archBand(face, h, d, 0.075, 'trim', 0.15);
        }
      }
    for (const z of [-1.2, 1.2]) {
      const h = hole(
        'east-blind-arch',
        [12.49, z],
        [0, 1],
        [1, 0],
        1.3,
        6.5,
        1.7,
        0.95,
        'round',
        1,
      );
      archBand(face, h, d, 0.17, 'trim', 0.16);
    }
    for (const x of [1.9, 10.8]) {
      const h = hole(
        'south-blind-arch',
        [x, 6.63],
        [1, 0],
        [0, 1],
        1.25,
        7.3,
        1.7,
        1.0,
        'round',
        1,
      );
      archBand(face, h, d, 0.18, 'trim', 0.16);
    }
    if (d >= 3) {
      for (const [x, z] of [
        [1.7, 6.6],
        [10.9, 6.6],
      ]) {
        const h = hole(
          'abstract-medallion',
          [x, z],
          [1, 0],
          [0, 1],
          0.85,
          5.4,
          0.85,
          0.85,
          'circle',
          1,
        );
        archBand(face, h, d, 0.11, 'trim', 0.18);
        const p = prepareOpening(h, 0, d),
          cy = h.bottom + 0.425;
        beam(face, p.point(-0.2, cy, 0.18), p.point(0.2, cy, 0.18), 0.1, 'trim');
        beam(face, p.point(0, cy - 0.22, 0.18), p.point(0, cy + 0.22, 0.18), 0.1, 'trim');
      }
    }
  }
}
function buildDrum(out, face, d) {
  const r = circle(plans.drumCenter, plans.drumRadius, d === 0 ? 8 : d === 1 ? 12 : 16),
    fields = akhtamarDrumFields(d);
  shell(out, d, r, 12.4, 18, d === 0 ? [] : fields, 'wall');
  for (const h of fields) panel(face, h, d);
  cap((slot, p) => face(slot, p, [0, -1, 0]), scaled(r, 1.055), 18, 'trim', [r]);
  profile(
    face,
    r,
    [
      [18, 1.055],
      [22.1, 0.015],
    ],
    'roof',
  );
  const p = plans.drumCenter;
  solid(face, R(p[0] - 0.075, p[1] - 0.075, p[0] + 0.075, p[1] + 0.075), 22.0, 23.5, 'metal');
  beam(face, at([p[0] - 0.6, p[1]], 22.95), at([p[0] + 0.6, p[1]], 22.95), 0.09, 'metal');
  if (d >= 1) {
    band(face, r, 17.65, 0.25, 'trim', 1.045);
    band(face, r, 12.55, 0.2, 'trim', 1.03);
  }
  if (d >= 2) {
    for (const q of r)
      beam(face, at(lerp(p, q, 1.055), 18.04), at(lerp(p, q, 0.015), 22.14), 0.065, 'trim');
    for (const h of fields) {
      const eyebrow = {
        ...h,
        width: h.width + 1,
        height: h.height + 0.35,
        bottom: h.bottom - 0.12,
        spring: h.spring,
      };
      archBand(face, eyebrow, d, 0.11, 'trim', 0.16);
    }
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        h = hole(
          'drum-cornice',
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          f.length * 0.8,
          17.45,
          0.3,
          0.03,
          'round',
          1,
        );
      archBand(face, h, d, 0.09, 'trim', 0.14);
    }
  }
}
function buildBell(out, face, d) {
  const r = plans.bell,
    door = akhtamarBellDoor(),
    upper = akhtamarBellFields(),
    lower = writer(masked(out, [prepareOpening(door, 0, d)]), d);
  shell(out, d, r, footing, 4.5, [door], 'wall');
  cap(lower, r, 4.5, 'trim');
  panel(face, door, d, 1.85);
  shell(out, d, r, 4.9, 9.4, upper, 'wall', scaled(r, 0.72));
  cap(face, r, 4.9, 'trim');
  gable(face, r, 9.4, 10.6, 'roof', 1);
  if (d >= 1) {
    for (const h of [door, ...upper]) alternatingArch(face, h, d, 0.31, 0.13);
    for (const y of [4.5, 9.2]) band(face, r, y, 0.24, 'trim', 1.035);
  }
  const p = plans.bellCenter,
    ring = circle(p, 1.16, 6);
  profile(
    face,
    ring,
    [
      [10, 1.08],
      [10.6, 1.03],
    ],
    'trim',
  );
  for (const q of ring) {
    const n = d <= 1 ? 4 : 6,
      post = circle(q, d <= 1 ? 0.15 : 0.18, n);
    solid(face, post, 10.6, 12.7, 'trim');
    if (d >= 2) {
      band(face, post, 10.6, 0.15, 'trim', 1.5);
      band(face, post, 12.5, 0.18, 'trim', 1.5);
    }
  }
  cap(face, ring, 12.7, 'trim');
  profile(
    face,
    scaled(ring, 1.26),
    [
      [12.7, 1],
      [14.2, 0.025],
    ],
    'roof',
  );
  if (d >= 1) band(face, ring, 12.6, 0.22, 'trim', 1.2);
  for (let i = 0; i < (d === 0 ? 1 : 3); i++) {
    const n = d === 0 ? 1 : 3;
    solid(
      face,
      R(4.8, 8.7, 8.2, 10.4 - i * 0.45),
      (q) => Math.min(-0.25, akhtamarGround(...q) - 0.25),
      (floor * (n - i)) / n - floor,
      'trim',
    );
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
  solid(face, main, footing, 0.08, 'wall');
  buildNarthex(out, face, d);
  buildChurch(out, face, d);
  buildDrum(out, face, d);
  buildBell(out, face, d);
}
export const buildAkhtamarSkyline = (o) => build(o, 0),
  buildAkhtamarDistrict = (o) => build(o, 1),
  buildAkhtamarStreet = (o) => build(o, 2),
  buildAkhtamarCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const akhtamarStudy = {
  id: 'N0399',
  key: 'armenian_cathedral_of_the_holy_cross',
  title: 'Armenian Cathedral of the Holy Cross',
  category: 'cathedral',
  wikidataId: 'Q1281985',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0.Linked photographs viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256-square ashlar,continuous sandstone,basalt,plain wood and bronze graphs serve seven material groups. Warm linear tints,metric UVs and flat architectural normals;local blue-grey glazing. Broad relief bands,medallion/cross abstractions and stone roof ribs are geometry.No embedded images,unique facade maps,photo textures or baked lighting.',
  importReason:
    'Preserve individual Armenian cross gables,faceted drum/stone cone/cross,low western narthex,northeast annex,polygonal corner projections and two-stage south bell porch with columned pavilion in four browser LODs.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.identityBasis,
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three inspected western/southern photographs and standard viewer PMTiles/DEM. All heights and architectural sub-plans are estimates;single mapped whole provides conservative base coverage. Famous narrative reliefs and inscriptions are represented only by sparse band/medallion/cross abstractions,not exact carvings. Frescoes,full interiors/bells,monastery ruins,island paths/planting,current finish,engineering and exact ground joins excluded or unverified. Regional Anatolian neighbors are synthetic style fixtures. Physical laptop/phone timing pending.',
    'Skyline retains the main conical drum/cross,cross-gabled body,low narthex/annex,south two-stage bell porch and open six-post pavilion. District adds shared materials,slit/drum lights and alternating portal stone. Street adds recessed openings,roof ribs,frieze/eyebrow rhythm and detailed porch air. Close-up/master add sparse medallions,refined jambs and pavilion capitals;fine narrative sculpture remains abstract.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('south-stacked-bell-entrance', [6.5, 10, 34], [6.5, 8, 5]),
    cam('western-narthex-and-cross-body', [-39, 17, 21], [-1, 9, 1]),
    cam('faceted-drum-and-ribbed-stone-cone', [-11, 25, 23], [6.45, 17, -0.1]),
    cam('bell-arches-and-open-pavilion', [16, 15, 25], [6.5, 9.5, 7.5]),
    cam('northern-annex-and-cross-roofs', [31, 24, -29], [7, 9, -3]),
    cam('roof-and-signed-plan', [0, 80, 0.1], [0, 8, 0]),
  ],
};

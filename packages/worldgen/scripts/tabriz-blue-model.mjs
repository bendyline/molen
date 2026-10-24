/** Tabriz Blue Mosque: warm brick domes, surviving tiled portal and short corner stumps. */
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
  '../../../content/worldgen/source/places/tn/tnb/blue_mosque_tabriz/',
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
  wall: '#c7a27d',
  roof: '#b99a7c',
  trim: '#d1c4af',
  tile: '#547aa6',
  plaster: '#d9d0bd',
  wood: '#8b795f',
  glass: '#4c626f',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, tabrizBlueGround(...p) - 0.35);
export function tabrizBlueGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Muhammad Ali Mosque footing outside retained terrain');
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
function _shell(out, d, r, b, t, holes = [], slot = 'wall', inner = null) {
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
      // Far rings drop small map kinks; the source foundation retains every current vertex.
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
        levels[i][0] === levels[i - 1][0]
          ? [0, levels[i - 1][1] > levels[i][1] ? 1 : -1, 0]
          : [
              (prev[k][0] + prev[j][0]) / 2 - origin[0],
              0,
              (prev[k][1] + prev[j][1]) / 2 - origin[1],
            ],
      );
    }
    prev = r;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
const plans = rec.plans;
const _rect = (x, z, w, h) => [
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
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function _slab(face, r, y, h, slot) {
  sides(face, r, y, y + h, slot);
  cap(face, r, y + h, slot);
  down(face, r, y, slot);
}
function panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    outer = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
    ],
    p = [...outer, ...r],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function reveal(face, h, d, front, back, slot) {
  const r = openingShape(h, d),
    sg = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      du = b[0] - a[0],
      dy = b[1] - a[1];
    if (h.openBottom && a[1] === h.bottom && b[1] === h.bottom) continue;
    face(
      slot,
      [point(h, ...a, front), point(h, ...b, front), point(h, ...b, back), point(h, ...a, back)],
      [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
    );
  }
}
const dimensions = (r) =>
  [0, 1].map((k) => Math.max(...r.map((p) => p[k])) - Math.min(...r.map((p) => p[k])));
const radius = (p) => Math.min(...dimensions(p.plan.outline)) / 2;
function cupola(face, p, r, b, t, d, slot = 'roof', segments) {
  const n = segments ?? [6, 10, 16, 24, 28][d],
    steps = d <= 1 ? 3 : d === 2 ? 4 : 7,
    levels = Array.from({ length: steps }, (_, i) => {
      const u = ((i / (steps - 1)) * Math.PI) / 2;
      return [b + (t - b) * Math.sin(u), Math.cos(u)];
    });
  profile(face, circle(p, r, n), levels, slot);
}
export function tabrizPortal(d = 3) {
  const p = plans.portal;
  return {
    ...field('north-entrance', p.center, p.axis, p.normal, p.openingWidth, 0.7, 12.2, 7.7, 10),
    frameWidth: p.width,
    depth: 12,
    openBottom: true,
    detail: d,
  };
}
export function tabrizDrumFields(d = 3) {
  if (d === 0) return [];
  const chosen = d === 1 ? [1, 7] : [1, 5, 10, 15],
    ring = d === 1 ? circle(plans.dome.center, radius(plans.dome), 12) : plans.dome.plan.outline;
  return edges(ring)
    .filter((_, i) => chosen.includes(i))
    .map((e, i) => ({
      ...field(`drum-field-${i}`, e.center, e.axis, e.normal, 0.65, 8.85, 0.7, 0.4, 0.1),
      shape: 'round',
    }));
}
function brickDome(face, part, base, top, d) {
  const ring = d <= 1 ? circle(part.center, radius(part), d === 0 ? 8 : 12) : part.plan.outline;
  const levels =
    d === 0
      ? [
          [base, 1],
          [base + (top - base) * 0.62, 0.82],
          [top, 0],
        ]
      : d === 1
        ? [
            [base, 1],
            [base + (top - base) * 0.38, 0.98],
            [base + (top - base) * 0.8, 0.62],
            [top, 0],
          ]
        : [
            [base, 1],
            [base + (top - base) * 0.22, 0.99],
            [base + (top - base) * 0.5, 0.89],
            [base + (top - base) * 0.76, 0.66],
            [base + (top - base) * 0.93, 0.34],
            [top, 0],
          ];
  profile(face, ring, levels, 'roof', part.center);
}
function portal(face, out, d) {
  const h = tabrizPortal(d),
    p = plans.portal,
    w = p.width,
    front = p.center[0],
    back = front - p.depth - 0.1;
  const cut = writer(masked(out, [prepareOpening(h, 0, d)]), d);
  solid(cut, _rect((front + back) / 2, 0, front - back, w), 0.7, 14.5, 'wall');
  // A shallow pointed crest keeps the surviving portal profile, without tall minarets.
  const lo = [
      [-w / 2, 14.5],
      [-w / 2, 14.8],
      [-1.2, 14.8],
      [0, 15.4],
      [1.2, 14.8],
      [w / 2, 14.8],
      [w / 2, 14.5],
    ],
    F = (x) => lo.map(([z, y]) => [x, floor + y, z]);
  const crestIds = earcut(lo.flat(), [], 2),
    crestSign = sign(lo);
  for (let i = 0; i < crestIds.length; i += 3) {
    const indices = crestIds.slice(i, i + 3);
    face(
      'wall',
      indices.map((k) => F(front)[k]),
      [1, 0, 0],
    );
    face(
      'wall',
      indices.map((k) => F(back)[k]),
      [-1, 0, 0],
    );
  }
  for (let i = 0; i < lo.length; i++) {
    const j = (i + 1) % lo.length;
    face(
      'wall',
      [F(back)[i], F(front)[i], F(front)[j], F(back)[j]],
      [0, -(lo[j][0] - lo[i][0]) * crestSign, (lo[j][1] - lo[i][1]) * crestSign],
    );
  }
  reveal(face, h, d, 0.04, -p.depth, 'plaster');
  pane(face, h, d, -p.depth, 'plaster');
  pane(
    (s, p, n) =>
      face(
        s,
        p,
        n.map((v) => -v),
      ),
    h,
    d,
    -p.depth - 0.1,
    'wall',
  );
  // Both arch faces are closed; the recessed screen remains visible above the low roof.
  panel(face, h, d, w, 0.7, 14.5, 'wall', 0.04);
  panel(
    (s, p, n) =>
      face(
        s,
        p,
        n.map((v) => -v),
      ),
    h,
    d,
    w,
    0.7,
    14.5,
    'wall',
    -p.depth,
  );
  archBand(face, h, d, d === 0 ? 0.65 : 0.5, 'tile', 0.09);
  const frontRect = (z, width, bottom, top, slot, offset = 0.1) =>
    face(
      slot,
      [
        [front + offset, floor + bottom, z - width / 2],
        [front + offset, floor + bottom, z + width / 2],
        [front + offset, floor + top, z + width / 2],
        [front + offset, floor + top, z - width / 2],
      ],
      [1, 0, 0],
    );
  for (const z of [-4.7, 4.7]) {
    frontRect(z, 1.05, 1.3, 12.6, 'tile');
    if (d >= 1) {
      frontRect(z, 1.08, 4.1, 5.6, 'plaster', 0.115);
      frontRect(z, 1.08, 10.1, 10.8, 'plaster', 0.115);
    }
  }
  const door = {
    ...field('entry-door', [23.39, 0], [0, 1], [1, 0], 2.7, 0.7, 4.8, 0, 0.1),
    shape: 'rect',
  };
  pane(face, door, d, 0.03, 'wood');
  if (d >= 2) {
    // Broad remnants suggest the surviving finish; no copied pattern or invented lettering.
    const backX = front - p.depth + 0.04;
    const remnants = [
      [
        [-1.9, 6.2],
        [-0.7, 6.2],
        [-0.7, 7.5],
        [-1.25, 7.5],
        [-1.25, 9.9],
        [-1.9, 9.9],
      ],
      [
        [0.6, 7.1],
        [1.5, 7.1],
        [1.5, 8.5],
        [0.6, 8.5],
      ],
    ];
    for (const remnant of remnants) {
      const ids = earcut(remnant.flat(), [], 2);
      for (let i = 0; i < ids.length; i += 3)
        face(
          'tile',
          ids.slice(i, i + 3).map((k) => [backX, floor + remnant[k][1], remnant[k][0]]),
          [1, 0, 0],
        );
    }
    beam(face, [23.45, floor + 0.7, 0], [23.45, floor + 5.5, 0], 0.15, 'trim');
  }
}
function build(out, d) {
  const face = writer(out, d),
    r = plans.whole.outline,
    body = d === 0 ? _coarse(r) : r;
  const footingRing = edges(r).flatMap((e) => {
    const n = Math.ceil(e.length / 2.5);
    return Array.from({ length: n }, (_, i) => lerp(e.a, e.b, i / n));
  });
  sides(face, footingRing, footing, 0.7, 'trim');
  cap(face, r, 0.7, 'trim');
  sides(face, body, 0.7, 1.3, 'trim');
  sides(face, body, 1.3, 8, 'wall');
  cap(face, body, 8, 'roof');
  for (let i = 0; i < 7; i++)
    solid(face, _rect(27.7 - ((i + 0.5) * 4.7) / 7, 0, 4.7 / 7, 6.2), -0.2, 0.1 * (i + 1), 'trim');
  const ring =
    d <= 1
      ? circle(plans.dome.center, radius(plans.dome), d === 0 ? 8 : 12)
      : plans.dome.plan.outline;
  solid(face, ring, 8, 9.8, 'wall');
  brickDome(face, plans.dome, 9.8, 18, d);
  brickDome(face, plans.rearDome, 8, 11.5, d);
  if (d >= 1)
    for (const p of plans.cupolas) cupola(face, p, 3.2, 8, 10.2, d, 'roof', d === 1 ? 8 : 16);
  for (const p of plans.stumps) {
    const n = [6, 10, 16, 20, 24][d];
    profile(
      face,
      circle(p, 1.3, n),
      [
        [0.7, 1],
        [9.6, 1],
        [10, 1.04],
      ],
      'wall',
      p,
    );
  }
  portal(face, out, d);
  for (const h of tabrizDrumFields(d)) pane(face, h, d, 0.04, 'glass');
  if (d >= 2) {
    // Sparse plinth panels stay below the window/door field, never crossing an opening.
    for (const e of edges(r)) {
      if (e.length < 8 || e.normal[0] > 0.5) continue;
      const n = Math.floor(e.length / 3.2),
        step = e.length / n;
      for (let j = 0; j < n; j++) {
        const p = lerp(e.a, e.b, (j + 0.5) / n),
          u = Math.min(1.25, step * 0.4),
          at = (x, y) => [
            p[0] + e.axis[0] * x + e.normal[0] * 0.04,
            floor + y,
            p[1] + e.axis[1] * x + e.normal[1] * 0.04,
          ];
        face(
          'trim',
          [at(-u, 0.85), at(u, 0.85), at(u, 1.15), at(-u, 1.15)],
          [e.normal[0], 0, e.normal[1]],
          colors.plaster,
        );
      }
    }
  }
}
export const buildTabrizBlueSkyline = (o) => build(o, 0),
  buildTabrizBlueDistrict = (o) => build(o, 1),
  buildTabrizBlueStreet = (o) => build(o, 2),
  buildTabrizBlueCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const tabrizBlueStudy = {
  id: 'blue_mosque_tabriz',
  key: 'blue_mosque',
  title: 'Blue Mosque (Tabriz)',
  category: 'mosque',
  wikidataId: 'Q1519733',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Pictures viewed only, never redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain.',
  sourceNotice:
    'Five existing shared256² brick, raw limestone, mosaic tile, lime plaster and plain wood graphs serve seven merged roles. Brick dome and wall share one graph with different linear vertex tints; UVs use physical metres. Blue portal remnants are coarse original geometry/tints, not copied photographs or tile artwork. Zero embedded images.',
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
    'Two inspected pictures guide appearance. Exact tile motifs, muqarnas, epigraphy, broken-edge archaeology, temporary scaffold/snow, forecourt furniture and hidden/furnished interiors are omitted. The source image year is a file-page statement, not independent dating. No surveyed grade, engineering or physical phone/tablet/laptop performance claim.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('blue-remnant-portal', [65, 18, 25], [26, 7, 0]),
    cam('recessed-pointed-entrance', [37, 4, 0], [23.3, 7, 0]),
    cam('brick-domes-and-drum', [-37, 24, 36], [-4, 10, 0]),
    cam('short-corner-stumps', [37, 13, 33], [26, 7, 20]),
    cam('stone-plinth-and-brick-wall', [-15, 7, 35], [-2, 3, 19]),
    cam('north-up-plan', [0, 175, 0.1], [0, 5, 0]),
  ],
};

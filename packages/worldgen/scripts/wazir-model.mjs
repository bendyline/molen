/** Wazir Khan Mosque: four octagonal minarets, five prayer-hall domes and tiled courtyard iwans. */
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
  '../../../content/worldgen/source/places/tt/tts/wazir_khan_mosque/',
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
  wall: '#df9a86',
  roof: '#d3c49d',
  trim: '#e3d4b6',
  tile: '#7293a8',
  paving: '#c68f73',
  wood: '#9d8464',
  water: '#7fa279',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, wazirGround(...p) - 0.35);
export function wazirGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Wazir Khan Mosque footing outside retained terrain');
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
function _cupola(face, p, r, b, t, d, slot = 'roof', segments) {
  const n = segments ?? [6, 10, 16, 24, 28][d],
    steps = d <= 1 ? 3 : d === 2 ? 4 : 7,
    levels = Array.from({ length: steps }, (_, i) => {
      const u = ((i / (steps - 1)) * Math.PI) / 2;
      return [b + (t - b) * Math.sin(u), Math.cos(u)];
    });
  profile(face, circle(p, r, n), levels, slot);
}
export function wazirOpenings(d = 3) {
  const west = {
    ...field(
      'west-iwan',
      plans.westIwan.center,
      [0, 1],
      [1, 0],
      7.2,
      0.7,
      10.6,
      6,
      plans.westIwan.depth * 2 + 0.1,
    ),
    openBottom: true,
  };
  const east = {
    ...field('east-passage', [33.35, -0.3], [0, 1], [1, 0], 6, 0.7, 7.8, 5.1, 22),
    openBottom: true,
  };
  const bays = [];
  if (d >= 1) {
    for (const z of [-17, -9, 9, 17])
      bays.push({
        ...field(`prayer-bay-${z}`, [-27.2, z], [0, 1], [1, 0], 4.3, 0.7, 5.6, 3.7, 3),
        openBottom: true,
      });
    for (const [i, e] of edges(plans.whole.holes[0]).entries()) {
      if (e.length < 20 || Math.abs(e.axis[0]) < 0.9) continue;
      const normal = e.normal.map((v) => -v),
        n = Math.floor(e.length / 5.8);
      for (let j = 0; j < n; j++)
        bays.push({
          ...field(
            `court-bay-${i}-${j}`,
            lerp(e.a, e.b, (j + 0.5) / n),
            e.axis,
            normal,
            3.3,
            0.7,
            4.7,
            3.1,
            1.6,
          ),
          openBottom: true,
        });
    }
  }
  return { west, east, bays };
}
function quad(face, h, u0, u1, b, t, slot, offset = 0.08, tint) {
  face(
    slot,
    [
      point(h, u0, floor + b, offset),
      point(h, u1, floor + b, offset),
      point(h, u1, floor + t, offset),
      point(h, u0, floor + t, offset),
    ],
    [h.normal[0], 0, h.normal[1]],
    tint,
  );
}
function recessed(face, h, d, depth, frameWidth, top) {
  // Deliberate solid back, with an open threshold and a smaller door in a taller blind recess.
  reveal(face, h, d, 0.04, -depth, 'trim');
  pane(face, h, d, -depth, 'tile');
  panel(face, h, d, frameWidth, 0.7, top, 'tile', 0.06);
  archBand(face, h, d, 0.45, 'trim', 0.1);
  const door = {
    ...h,
    width: h.width * 0.58,
    height: Math.min(4, h.height * 0.7),
    spring: 2.6,
    depth: 0.1,
  };
  pane(face, door, d, -depth + 0.03, 'wood');
  if (d >= 2) {
    archBand(face, door, d, 0.2, 'trim', -depth + 0.06);
    quad(
      face,
      h,
      -frameWidth / 2,
      frameWidth / 2,
      top - 0.65,
      top - 0.25,
      'tile',
      0.13,
      colors.trim,
    );
  }
}
function westPortal(face, out, d, h) {
  const f = plans.westIwan.center[0],
    back = f - plans.westIwan.depth,
    w = plans.westIwan.width;
  solid(
    writer(masked(out, [prepareOpening(h, 0, d)]), d),
    _rect((f + back) / 2, -0.3, f - back, w),
    0.7,
    13.5,
    'wall',
  );
  recessed(face, h, d, plans.westIwan.depth, w, 13.5);
  pane(
    (s, p, n) =>
      face(
        s,
        p,
        n.map((v) => -v),
      ),
    h,
    d,
    -plans.westIwan.depth - 0.01,
    'wall',
  );
  // Back and top are closed by the portal mass; the recess is not a promised interior.
  if (d >= 1) {
    for (const u of [-5.4, 5.4]) quad(face, h, u - 0.45, u + 0.45, 1.4, 12.5, 'trim', 0.13);
    quad(face, h, -6.4, 6.4, 12.65, 13.15, 'tile', 0.11);
  }
}
function eastPortal(face, out, d, h) {
  const cut = writer(masked(out, [prepareOpening(h, 0, d)]), d);
  solid(cut, _rect(33.35, -0.3, 18.9, 8.2), 0.7, 9.3, 'wall');
  for (const x of [42.8, 23.9]) {
    const front = { ...h, center: [x, -0.3], normal: [x > 30 ? 1 : -1, 0] };
    solid(cut, _rect(x > 30 ? 40.6 : 26.1, -0.3, 4.4, 12.4), 0.7, 10, 'wall');
    panel(face, front, d, 12.4, 0.7, 10, 'tile', 0.07);
    archBand(face, front, d, 0.5, 'trim', 0.12);
    if (d >= 1)
      for (const u of [-5.2, 5.2]) quad(face, front, u - 0.5, u + 0.5, 1.4, 8.9, 'trim', 0.13);
  }
  const liner = { ...h, center: [42.86, -0.3] };
  reveal(face, liner, d, 0, -19.02, 'trim');
}
function minaret(face, p, d) {
  const r = p.plan.outline;
  // Always octagonal: changing radial segmentation would erase this mosque's tower identity.
  if (d === 0) {
    profile(
      (slot, points, normal) =>
        face(points.every((q) => q[1] >= floor + 27.1 - 0.001) ? 'roof' : slot, points, normal),
      r,
      [
        [0.7, 1],
        [25, 0.69],
        [25.6, 0.9],
        [27.1, 0.65],
        [30.7, 0.65],
        [32.5, 0],
      ],
      'wall',
      p.center,
    );
    // Broad blue shaft fields and pale caps retain the identity palette at the far level.
    for (const [i, e] of edges(r).entries()) {
      if (i % 2) continue;
      const station = (t, y) => {
        const q = lerp(e.a, e.b, t),
          scale = 1 - (0.31 * (y - 0.7)) / 24.3;
        return [
          p.center[0] + (q[0] - p.center[0]) * scale + e.normal[0] * 0.02,
          floor + y,
          p.center[1] + (q[1] - p.center[1]) * scale + e.normal[1] * 0.02,
        ];
      };
      face(
        'tile',
        [station(0.2, 7.8), station(0.8, 7.8), station(0.8, 23.7), station(0.2, 23.7)],
        [e.normal[0], 0, e.normal[1]],
      );
    }
    solid(face, circle(p.center, 0.18, 4), 32.4, 33, 'trim');
    return;
  }
  profile(
    face,
    r,
    [
      [0.7, 1],
      [7, 0.93],
      [7.35, 0.83],
      [24.8, 0.83],
      [25.2, 0.96],
      [25.8, 0.96],
      [26.15, 0.69],
    ],
    'wall',
    p.center,
  );
  // Balcony underside, floor and rail form a single broad continuous band.
  const balcony = scaled(r, 0.96);
  down(face, balcony, 25.2, 'trim');
  sides(face, balcony, 25.8, 26.4, 'trim');
  cap(face, balcony, 26.4, 'trim', [scaled(r, 0.72)]);
  const postRing = scaled(r, 0.58);
  for (const q of postRing) beam(face, at(q, 26.3), at(q, 29.6), d === 1 ? 0.32 : 0.28, 'trim');
  const roof = scaled(r, 0.86);
  down(face, roof, 29.6, 'trim');
  profile(
    face,
    r,
    [
      [29.6, 0.86],
      [29.95, 0.86],
      [30.25, 0.69],
      [31, 0.66],
      [31.8, 0.48],
      [32.5, 0],
    ],
    'roof',
    p.center,
  );
  solid(face, circle(p.center, 0.17, d >= 2 ? 6 : 4), 32.4, 33, 'trim');
  const shaft = scaled(r, 0.83),
    start = 7.8,
    top = 23.7;
  for (const [i, e] of edges(shaft).entries()) {
    if (d === 1 && i % 2) continue;
    const h = field(
      `minaret-panel-${p.id}-${i}`,
      e.center,
      e.axis,
      e.normal,
      e.length * 0.58,
      start,
      top - start,
      top - start - 1,
      0.1,
    );
    pane(face, h, d, 0.03, 'tile');
    if (d >= 2) {
      archBand(face, h, d, 0.2, 'trim', 0.06);
      quad(face, h, -h.width / 2, h.width / 2, 14.1, 14.55, 'tile', 0.07, colors.roof);
    }
  }
}
function prayerDome(face, p, d) {
  const top = p.properties.height,
    base = p.id === 35185903247365 ? 9 : 7.4;
  const r = d <= 1 ? circle(p.center, radius(p), d === 0 ? 6 : 10) : p.plan.outline;
  sides(face, r, 7, base, 'wall');
  const levels =
    d === 0
      ? [
          [base, 1],
          [base + (top - base) * 0.65, 0.85],
          [top, 0],
        ]
      : d === 1
        ? [
            [base, 1],
            [base + (top - base) * 0.4, 0.98],
            [base + (top - base) * 0.8, 0.65],
            [top, 0],
          ]
        : [
            [base, 1],
            [base + (top - base) * 0.25, 1.02],
            [base + (top - base) * 0.55, 0.91],
            [base + (top - base) * 0.8, 0.64],
            [base + (top - base) * 0.94, 0.29],
            [top, 0],
          ];
  profile(face, r, levels, 'roof', p.center);
}
function courtyardPool(face, d) {
  const r = plans.pool;
  cap(face, r, 0.24, 'water');
  sides(face, r, 0.24, 0.72, 'trim', true);
  if (d >= 1) {
    const outer = scaled(r, 1.13);
    sides(face, outer, 0.7, 0.98, 'trim');
    cap(face, outer, 0.98, 'trim', [r]);
    sides(face, r, 0.7, 0.98, 'trim', true);
  }
}
function pavilion(face, d) {
  const r = plans.pavilion.plan.outline;
  if (d === 0) {
    solid(face, r, 0.7, 3, 'roof');
    return;
  }
  // Mapped small pavilion, not an invented named saint's monument.
  for (const p of r) beam(face, at(p, 0.7), at(p, 2.6), 0.3, 'trim');
  sides(face, r, 2.6, 3, 'roof');
  cap(face, r, 3, 'roof');
  down(face, r, 2.6, 'roof');
  if (d >= 2) {
    const s = scaled(r, 0.8);
    solid(face, s, 0.7, 1.4, 'trim');
  }
}
function build(out, d) {
  const face = writer(out, d),
    r = plans.whole.outline,
    holes = plans.whole.holes,
    body = d === 0 ? _coarse(r) : r,
    inner = d === 0 ? holes.map(_coarse) : holes;
  const stations = edges(r).flatMap((e) =>
      Array.from({ length: Math.ceil(e.length / 2.5) }, (_, i) =>
        lerp(e.a, e.b, i / Math.ceil(e.length / 2.5)),
      ),
    ),
    footingRing = d === 0 ? r : stations;
  const low = Math.min(...stations.map(footing));
  sides(face, footingRing, d === 0 ? () => low : footing, 0.7, 'trim');
  cap(face, r, 0.7, 'paving', [plans.pool]);
  courtyardPool(face, d);
  const openings = wazirOpenings(d),
    hs = [openings.west, openings.east, ...openings.bays].map((h) => prepareOpening(h, 0, d));
  const cut = writer(masked(out, hs), d);
  sides(cut, body, 0.7, 7, 'wall');
  for (const h of inner) sides(cut, h, 0.7, 7, 'wall', true);
  cap(cut, body, 7, 'roof', inner);
  westPortal(face, out, d, openings.west);
  eastPortal(face, out, d, openings.east);
  for (const h of openings.bays)
    recessed(
      face,
      h,
      d,
      h.name.startsWith('prayer') ? 1.4 : 0.7,
      h.width + 0.9,
      h.name.startsWith('prayer') ? 6.8 : 6.4,
    );
  for (const p of plans.minarets) minaret(face, p, d);
  for (const p of plans.domes) prayerDome(face, p, d);
  pavilion(face, d);
  if (d >= 1) {
    // Continuous broad friezes, sparse colored fields; no copied calligraphy or floral motifs.
    for (const e of edges(holes[0])) {
      if (e.length < 8) continue;
      const h = field(
        'frieze',
        e.center,
        e.axis,
        e.normal.map((v) => -v),
        e.length,
        0,
        1,
        0,
        0.1,
      );
      quad(cut, h, -e.length / 2, e.length / 2, 6.35, 6.85, 'tile', 0.09);
    }
    if (d >= 2)
      for (const e of edges(r)) {
        if (e.length < 10) continue;
        const h = field('outer-frieze', e.center, e.axis, e.normal, e.length, 0, 1, 0, 0.1);
        quad(cut, h, -e.length / 2, e.length / 2, 6.2, 6.75, 'tile', 0.06);
      }
  }
}
export const buildWazirSkyline = (o) => build(o, 0),
  buildWazirDistrict = (o) => build(o, 1),
  buildWazirStreet = (o) => build(o, 2),
  buildWazirCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const wazirStudy = {
  id: 'wazir_khan_mosque',
  key: 'wazir_khan_mosque',
  title: 'Wazir Khan Mosque',
  category: 'mosque',
  wikidataId: 'Q2352054',
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
    'Six existing shared256² stucco, lime plaster, raw limestone, mosaic tile, brick and plain wood graphs serve seven merged roles. Metric UVs and linear vertex tints; graph read once per shared material cache. Static opaque basin water uses a small palette material. No embedded images, copied photographs, inscriptions or bespoke tile artwork.',
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
    'Two2015/2016 picture pages guide approximate appearance, not independently verified current restoration details. Pool, shaft tiers, iwan profiles and hidden roof construction are visualization estimates. No archaeological, engineering, navigable/furnished interior or physical-device performance certification. City, neighboring shrines and plaza remain host content.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('west-prayer-hall-and-pool', [15, 16, 22], [-30, 7, 0]),
    cam('tiled-iwan-and-door', [-10, 8, 4], [-29, 6, 0]),
    cam('eastern-through-passage', [67, 8, 4], [31, 5, -0.3]),
    cam('octagonal-minaret-chhatri', [45, 34, 40], [27, 26, 23]),
    cam('five-domes-and-lightwells', [-64, 48, 45], [-14, 8, 0]),
    cam('north-up-plan', [0, 215, 0.1], [0, 3, 0]),
  ],
};

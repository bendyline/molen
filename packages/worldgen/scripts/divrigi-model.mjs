/** Divriği: adjoining mosque/hospital,pointed stone roofs and distinct carved portals. */
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
  '../../../content/worldgen/source/places/sy/syg/n0448_divrigi_great_mosque_and_hospital/',
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
  wall: '#c7b99c',
  trim: '#d8c9ac',
  roof: '#9a9fa2',
  door: '#76604a',
  glass: '#4e6068',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, divrigiGround(...p) - 0.35);
export function divrigiGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Divriği Great Mosque and Hospital footing outside retained terrain');
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
const plans = rec.plans;
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
    });
const edges = (ring) =>
  ring.map((a, i) => {
    const b = ring[(i + 1) % ring.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(ring), -axis[0] * sign(ring)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
const hole = (
  name,
  center,
  axis,
  normal,
  width,
  bottom,
  height,
  spring,
  shape = 'pointed',
  depth = 2,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
const trimBand = (face, h, d, w = 0.26) => archBand(face, h, d, w, 'trim', 0.055);
const project = (p, u, y, offset = 0) => [
  p.center[0] + p.axis[0] * u + p.normal[0] * offset,
  floor + y,
  p.center[1] + p.axis[1] * u + p.normal[1] * offset,
];
const portalPlan = (p) =>
  [
    [-p.width / 2, 0],
    [p.width / 2, 0],
    [p.width / 2, -2],
    [-p.width / 2, -2],
  ].map(([u, n]) => [
    p.center[0] + p.axis[0] * u + p.normal[0] * n,
    p.center[1] + p.axis[1] * u + p.normal[1] * n,
  ]);
export const divrigiPortalFields = (_d = 3) =>
  plans.portals.map((p) => ({
    ...hole(
      p.name,
      p.center,
      p.axis,
      p.normal,
      p.openingWidth,
      p.bottom ?? 0.25,
      p.openingHeight,
      p.spring,
      'pointed',
      5,
    ),
    portal: p,
  }));
export function divrigiWallFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const e of edges(plans.body)) {
    const n = d === 1 ? 3 : Math.round(e.length / 9);
    for (let j = 0; j < n; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / n);
      if (
        plans.portals.some(
          (g) => Math.hypot(g.center[0] - p[0], g.center[1] - p[1]) < g.width * 0.6,
        )
      )
        continue;
      out.push(
        hole(
          `wall-light-${out.length}`,
          p,
          e.axis,
          e.normal,
          0.95,
          d === 1 ? 4.5 : 3.1,
          2.0,
          2.0,
          'rect',
          2,
        ),
      );
    }
  }
  return out;
}
export function divrigiLanternFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const p of plans.lanterns) {
    const ring = circle(p.center, p.radius, p.sides);
    for (const [i, e] of edges(ring).entries())
      out.push(
        hole(
          `lantern-${p.name}-${i}`,
          lerp(e.a, e.b, 0.5),
          e.axis,
          e.normal,
          p.name === 'mosque' ? 1.4 : 2.0,
          p.base + 0.25,
          0.75,
          0.75,
          'rect',
          1.5,
        ),
      );
  }
  return out;
}
function relief(face, p, points, offset = 0.15, depth = 0.15, slot = 'trim') {
  const ids = earcut(points.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3) {
    const q = ids.slice(i, i + 3).map((k) => points[k]);
    face(
      slot,
      q.map((v) => project(p, v[0], v[1], offset)),
      [p.normal[0], 0, p.normal[1]],
    );
    face(
      slot,
      q.map((v) => project(p, v[0], v[1], offset - depth)),
      [-p.normal[0], 0, -p.normal[1]],
    );
  }
  for (let i = 0; i < points.length; i++) {
    const a = points[i],
      b = points[(i + 1) % points.length];
    face(slot, [
      project(p, ...a, offset),
      project(p, ...b, offset),
      project(p, ...b, offset - depth),
      project(p, ...a, offset - depth),
    ]);
  }
}
const rectangle = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];
function rosette(face, p, u, y, r, d, offset = 0.2) {
  const n = d >= 3 ? 16 : 8,
    points = Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        R = r * (i % 2 ? 0.58 : 1);
      return [u + Math.cos(a) * R, y + Math.sin(a) * R];
    });
  relief(face, p, points, offset, 0.15);
  if (d >= 3)
    relief(
      face,
      p,
      Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        return [u + Math.cos(a) * r * 0.24, y + Math.sin(a) * r * 0.24];
      }),
      offset + 0.09,
      0.1,
    );
}
function hip(face, ring, eaves, top, slot = 'roof', factor = 0.22) {
  profile(
    face,
    ring,
    [
      [eaves, 1],
      [top, factor],
    ],
    slot,
  );
}
function body(out, face, d) {
  const fields = divrigiWallFields(d);
  sides(face, plans.whole.outline, footing, 0.1, 'wall');
  cap(face, plans.whole.outline, 0.1, 'trim');
  shell(out, d, plans.body, 0, 10.2, fields, 'wall');
  for (const h of fields) {
    pane(face, h, d, -0.2, 'glass');
    if (d >= 2) trimBand(face, h, 1, 0.22);
  }
  // Two adjoining ranges share a wall;their hipped coverings remain visibly separate.
  hip(face, scaled(plans.mosque, 1.025), 10.2, 12.8, 'roof', 0.26);
  hip(face, scaled(plans.hospital, 1.025), 10.8, 12.6, 'roof', 0.34);
  sides(face, plans.hospital, 10.2, 10.8, 'wall');
  if (d >= 1)
    for (const [r, y] of [
      [plans.mosque, 10.0],
      [plans.hospital, 10.6],
    ])
      band(face, r, y, 0.2, 'trim', 1.02);
}
function roofs(out, face, d) {
  for (const p of plans.cones) {
    const r = circle(p.center, p.radius, p.sides);
    sides(face, r, 10.5, p.base, 'wall');
    profile(
      face,
      r,
      [
        [p.base, 1],
        [p.top, 0],
      ],
      'wall',
    );
    if (d >= 2) band(face, r, p.base - 0.25, 0.25, 'trim', 1.025);
  }
  const fields = divrigiLanternFields(d);
  for (const p of plans.lanterns) {
    const r = circle(p.center, p.radius, p.sides),
      fs = fields.filter((h) => h.name.startsWith(`lantern-${p.name}-`));
    shell(out, d, r, p.base, p.wallTop, fs, 'wall');
    for (const h of fs) {
      pane(face, h, d, -0.18, 'glass');
      if (d >= 3) trimBand(face, h, 1, 0.12);
    }
    hip(face, scaled(r, 1.13), p.wallTop, p.top, 'roof', 0.1);
  }
}
function minaret(face, d) {
  const p = plans.minaret,
    r = circle(p.center, p.radius, [4, 6, 10, 16, 20][d]),
    abut = circle(plans.roundButtress.center, plans.roundButtress.radius, [8, 12, 16, 24, 32][d]);
  solid(face, abut, footing, 5.5, 'wall');
  hip(face, scaled(abut, 1.03), 5.5, 6.2, 'roof', 0.4);
  solid(
    face,
    rect(p.center[0] - 1.7, p.center[1] - 1.7, p.center[0] + 1.7, p.center[1] + 1.7),
    5.5,
    9.1,
    'wall',
  );
  profile(
    face,
    r,
    [
      [9.1, 1.15],
      [10.7, 1],
      [22.8, 0.92],
      [23.8, 1.5],
      [24.7, 1.5],
      [25, 0.75],
    ],
    'wall',
  );
  profile(
    face,
    r,
    [
      [25, 0.85],
      [31.5, 0],
    ],
    'roof',
  );
  if (d >= 2) {
    band(face, r, 23.9, 0.7, 'trim', 1.52);
    for (let i = 0; i < (d >= 3 ? 12 : 6); i++) {
      const a = (i * Math.PI * 2) / (d >= 3 ? 12 : 6),
        q = [
          p.center[0] + Math.cos(a) * p.radius * 1.45,
          p.center[1] + Math.sin(a) * p.radius * 1.45,
        ];
      beam(face, at(q, 23.9), at(q, 24.65), 0.16, 'trim');
    }
  }
}
function portals(out, face, d) {
  for (const h of divrigiPortalFields(d)) {
    const p = h.portal,
      r = portalPlan(p);
    shell(out, d, r, 0, p.top, [h], 'wall');
    cap(face, r, p.top, 'trim');
    pane(face, h, d, -1.05, 'trim');
    // The carved recess closes on stone;small opaque doors/windows sit within it.
    const back = p.center.map((v, k) => v - p.normal[k] * 1.0),
      isHospital = p.name === 'hospital-pointed',
      doorBottom = p.bottom ?? 0.25;
    const door = hole(
      `door-${p.name}`,
      back,
      p.axis,
      p.normal,
      isHospital ? 1.45 : p.name === 'north-vegetal' ? 2.8 : p.name === 'west-textile' ? 2.2 : 1.6,
      doorBottom,
      isHospital ? 2.8 : p.name === 'eastern-royal' ? 3.4 : 4.2,
      isHospital ? 2.1 : 3.1,
      'pointed',
      1,
    );
    pane(face, door, d, 0.035, 'door');
    if (d >= 1) {
      archBand(face, h, d === 1 ? 1 : 2, 0.4, 'trim', 0.06);
      const canopy = portalPlan({
        ...p,
        width: p.width + 1.0,
        center: p.center.map((v, k) => v + p.normal[k] * 0.7),
      });
      hip(face, canopy, p.top, p.top + 0.35, 'roof', 0.8);
    }
    if (d >= 2) {
      archBand(
        face,
        { ...h, width: h.width + 1.25, height: h.height + 0.65 },
        d === 2 ? 1 : 3,
        0.22,
        'trim',
        0.12,
      );
      for (const side of [-1, 1]) {
        const u = side * (p.width / 2 - 0.65),
          q = p.center.map((v, k) => v + p.axis[k] * u + p.normal[k] * 0.15),
          ring = circle(q, 0.36, d === 2 ? 6 : 8);
        profile(
          face,
          ring,
          [
            [0.2, 1.8],
            [1.0, 1.6],
            [1.6, 1],
            [p.top * 0.57, 1],
            [p.top * 0.61, 2.2],
            [p.top * 0.69, 2.7],
            [p.top * 0.76, 1.5],
            [p.top - 0.5, 1.1],
          ],
          'trim',
        );
        relief(face, p, rectangle(u - 0.16, 1.6, u + 0.16, p.top - 1), 0.45, 0.16);
      }
      // Original broad relief approximations distinguish the portal families.
      if (p.name === 'north-vegetal') {
        for (const side of [-1, 1])
          for (let i = 0; i < (d >= 3 ? 5 : 3); i++) {
            const u = side * (h.width / 2 + 0.55),
              y = 2 + i * (d >= 3 ? 1.65 : 2.8);
            rosette(face, p, u, y, 0.8, d, 0.55);
            if (d >= 2)
              relief(
                face,
                p,
                [
                  [u, y + 0.4],
                  [u + side * 0.55, y + 1.0],
                  [u + side * 0.35, y + 1.6],
                  [u - side * 0.1, y + 1.1],
                ],
                0.65,
                0.3,
              );
          }
        for (const side of [-1, 1])
          relief(
            face,
            p,
            [
              [side * 1.5, 12.1],
              [side * 2.8, 11.4],
              [side * 3.5, 12.3],
              [side * 3.1, 13.3],
              [side * 2.1, 13.1],
            ],
            0.5,
            0.35,
          );
      } else if (isHospital) {
        const win = hole(
          'hospital-upper-window',
          back,
          p.axis,
          p.normal,
          2.7,
          7.0,
          2.7,
          2.7,
          'rect',
          1,
        );
        pane(face, win, d, 0.045, 'glass');
        const a = project({ ...p, center: back }, 0, 7.0, 0.12),
          b = project({ ...p, center: back }, 0, 9.7, 0.12);
        beam(face, a, b, 0.27, 'trim');
        for (const side of [-1, 1]) rosette(face, p, side * 2.3, 8.1, 0.62, d, -0.85);
        if (d >= 3) for (const u of [-1.4, 0, 1.4]) rosette(face, p, u, 11.0, 0.45, d, -0.85);
      } else if (p.name === 'west-textile') {
        for (const side of [-1, 1])
          for (let i = 0; i < (d >= 3 ? 7 : 4); i++) {
            const u = side * (p.width / 2 - 0.95),
              y = 1.8 + i * (d >= 3 ? 1.3 : 2.3);
            relief(
              face,
              p,
              [
                [u, y + 0.4],
                [u + 0.3, y],
                [u, y - 0.4],
                [u - 0.3, y],
              ],
              0.28,
              0.15,
            );
          }
      }
      trimBand(face, door, 1, 0.18);
    }
  }
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
        function emit(p, uv) {
          let longest = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const l = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (l > longest) {
              longest = l;
              k = i;
            }
          }
          if (longest > (d === 0 ? 45 : d === 1 ? 30 : 18)) {
            const j = (k + 1) % 3,
              c = (k + 2) % 3,
              m = lerp(p[k], p[j], 0.5).map(Math.fround),
              v = lerp(uv[k], uv[j], 0.5);
            emit([p[k], m, p[c]], [uv[k], v, uv[c]]);
            emit([m, p[j], p[c]], [v, uv[j], uv[c]]);
            return;
          }
          if (
            Math.hypot(
              ...cross(
                p[1].map((v, k) => v - p[0][k]),
                p[2].map((v, k) => v - p[0][k]),
              ),
            ) < 1e-7
          )
            return;
          target.addTriangle(a[0], a[1], p, a[3], uv, a[5]);
        }
        emit(p, a[4]);
      },
    },
    face = writer(out, d);
  body(out, face, d);
  roofs(out, face, d);
  minaret(face, d);
  portals(out, face, d);
}
export const buildDivrigiSkyline = (o) => build(o, 0),
  buildDivrigiDistrict = (o) => build(o, 1),
  buildDivrigiStreet = (o) => build(o, 2),
  buildDivrigiCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const divrigiStudy = {
  id: 'N0448',
  key: 'divrigi_great_mosque_and_hospital',
  title: 'Divriği Great Mosque and Hospital',
  category: 'mosque',
  wikidataId: 'Q581641',
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
    'Four existing shared256² coursed sandstone,continuous sandstone,standing-seam metal and plain wood graphs;five merged roles including local opaque glazing. Original broad relief geometry,metric UVs,linear tints and faceted roofs. No embedded images,unique facade atlas,copied calligraphy or baked light.',
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
    'Three principal overall/north/hospital photographs and one extra capital detail inspected. No bespoke surveys or redistributed images. Individual medium-fi adjoining exterior retains the combined map footprint;internal mosque/hospital boundary,cones,lanterns,round buttress,minaret and all height/relief values are picture estimates. Broad north vegetal relief,west geometric band and hospital pointed portal/upper divided window distinguish the entries;fine stone carving/calligraphy is abstracted,not a facsimile. Portals/windows close on opaque recessed faces;unseen interiors,vaults,medical rooms and tomb contents are not modeled. Present restoration state,exact roof/ground joins,stairs,retaining walls,engineering and physical-device timing remain unverified. Nearby castle/city are excluded;synthetic context buildings are review fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('northwest-two-roofs-and-minaret', [100, 62, -100], [0, 10, 0]),
    cam('north-vegetal-portal', [63, 14, -13], [34.4, 7, 1]),
    cam('hospital-pointed-portal', [-13, 14, -47], [-20.4, 7, -19.4]),
    cam('western-textile-portal', [17, 13, -41], [11.8, 6, -19.4]),
    cam('two-stone-roofs-and-lanterns', [-35, 36, 44], [-7, 16, 6]),
    cam('roof-and-signed-plan', [0, 170, 0.1], [0, 10, 0]),
  ],
};

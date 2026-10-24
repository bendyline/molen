/** Gazi Husrev-beg Mosque: five-cupola open porch,stepped domed hall and western minaret. */
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
  '../../../content/worldgen/source/places/sr/srv/gazi_husrev_beg_mosque/',
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
  wall: '#e5d6c1',
  trim: '#d5d1c4',
  paving: '#b9b6a8',
  roof: '#7e8b94',
  gold: '#bdab7a',
  wood: '#5f4933',
  glass: '#3e4b46',
  column: '#a7aca4',
  green: '#39615c',
  blue: '#718797',
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
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : floor + y, p[1]];
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
const footing = (p) => Math.min(-0.35, floor - 0.3, gaziGround(...p) - 0.35);
export function gaziGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Gazi footing outside retained terrain');
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
    if (h.name.startsWith('court-') && (i === 0 || i === 1 || i === inner.length - 1)) continue;
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
const plans = rec.plans,
  rect = (x0, z0, x1, z1) => [
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
  depth = 1,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]),
      axis = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    return { a, b, length, axis, normal: [axis[1] * sign(r), -axis[0] * sign(r)] };
  });
const subdivide = (r, max) =>
  r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => a.map((v, k) => v + ((b[k] - v) * j) / n));
  });
function box(face, r, b, t, slot, color) {
  sides((s, p, n) => face(s, p, n, color), r, b, t, slot);
  cap((s, p, n) => face(s, p, n, color), r, t, slot);
}
function underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
export const gaziArcades = () =>
  plans.porch.map((p, i) =>
    hole(
      `porch-${i}`,
      [p.center[0], plans.porchFrontZ],
      [1, 0],
      [0, -1],
      5.25,
      0.35,
      7.1,
      4.8,
      'pointed',
      1.6,
    ),
  );
export function gaziFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [i, e] of edges(plans.whole.outline).entries()) {
    if (e.length < 6 || (e.a[1] < -14.8 && e.b[1] < -14.8)) continue;
    const q = e.a.map((v, k) => (v + e.b[k]) / 2);
    if (q[0] < -13.5) continue;
    hs.push(hole(`low-${i}`, q, e.axis, e.normal, 1.55, 2.0, 3.6, 2.6, 'pointed', 0.8));
  }
  for (const [i, e] of edges(plans.hall.outline).entries())
    for (const t of [0.28, 0.72]) {
      const q = e.a.map((v, k) => v + (e.b[k] - v) * t);
      hs.push(
        hole(`hall-oculus-${i}-${t}`, q, e.axis, e.normal, 1.15, 16.1, 1.15, 0, 'circle', 0.8),
      );
    }
  return hs;
}
const rearWall = () => rect(-14.4, plans.porchBackZ - 0.1, 18.69, plans.porchBackZ + 0.1);
export const gaziBackFields = () =>
  [-9.7, -3.8, 2.1, 8.0, 13.9].map((x, i) =>
    hole(
      i === 2 ? 'main-timber-door' : `back-field-${i}`,
      [x, plans.porchBackZ - 0.1],
      [1, 0],
      [0, -1],
      i === 2 ? 2.5 : 1.1,
      0.35,
      i === 2 ? 3.5 : 3.3,
      i === 2 ? 2.5 : 2.4,
      i === 2 ? 'round' : 'pointed',
      0.8,
    ),
  );
function grid(face, h, d, offset = -0.15) {
  if (d < 2) return;
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    P = (u, y) => p.point(u, y, offset * sg),
    normal = [h.normal[0], 0, h.normal[1]];
  if (h.shape === 'circle') {
    for (const u of [-0.22, 0.22])
      face(
        'trim',
        [
          P(u - 0.04, h.bottom + 0.15),
          P(u + 0.04, h.bottom + 0.15),
          P(u + 0.04, h.bottom + h.height - 0.15),
          P(u - 0.04, h.bottom + h.height - 0.15),
        ],
        normal,
      );
    return;
  }
  for (let j = 1; j < 4; j++) {
    const y = h.bottom + (h.spring * j) / 4;
    face(
      'trim',
      [
        P(-h.width / 2 + 0.05, y - 0.045),
        P(h.width / 2 - 0.05, y - 0.045),
        P(h.width / 2 - 0.05, y + 0.045),
        P(-h.width / 2 + 0.05, y + 0.045),
      ],
      normal,
    );
  }
  face(
    'trim',
    [
      P(-0.045, h.bottom),
      P(0.045, h.bottom),
      P(0.045, h.bottom + h.spring),
      P(-0.045, h.bottom + h.spring),
    ],
    normal,
  );
}
function finial(face, p, b, t, d) {
  profile(
    face,
    circle(p, d === 0 ? 0.1 : 0.075, d === 0 ? 4 : 6),
    d <= 1
      ? [
          [b, 1],
          [t, 0],
        ]
      : [
          [b, 1],
          [t - 0.22, 1.5],
          [t - 0.14, 0.6],
          [t, 0],
        ],
    'gold',
  );
}
function dome(face, p, d, small = false) {
  const n = small ? [6, 8, 12, 16, 20][d] : [8, 12, 24, 32, 40][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 9][d];
  profile(
    face,
    circle(p.center, p.radius, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [p.base + (p.shellTop - p.base) * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
  finial(face, p.center, p.shellTop, p.totalHeight, d);
  if (d >= 2) {
    const ribs = small ? 8 : d === 2 ? 12 : d === 3 ? 20 : 24,
      segments = small ? 3 : d === 2 ? 4 : 6,
      P = (t, a) => [
        p.center[0] + (p.radius * Math.cos(t) + 0.028) * Math.cos(a),
        floor + p.base + (p.shellTop - p.base) * Math.sin(t) + 0.028,
        p.center[1] + (p.radius * Math.cos(t) + 0.028) * Math.sin(a),
      ];
    for (let i = 0; i < ribs; i++)
      for (let j = 0; j < segments; j++) {
        const a = (i * Math.PI * 2) / ribs,
          t = (j / segments) * 1.45,
          u = ((j + 1) / segments) * 1.45;
        face(
          'trim',
          [P(t, a - 0.005), P(t, a + 0.005), P(u, a + 0.005), P(u, a - 0.005)],
          [Math.cos(a), 1, Math.sin(a)],
        );
      }
  }
}
function column(face, p, d) {
  const r = circle(p, 0.32, d === 0 ? 4 : d === 1 ? 6 : 10),
    tint = (s, p, n) => face(s, p, n, colors.column);
  profile(
    tint,
    r,
    d <= 1
      ? [
          [0.35, 1.3],
          [4.8, 1.3],
        ]
      : [
          [0.35, 1.7],
          [0.58, 1.7],
          [0.75, 1],
          [4.35, 1],
          [4.55, 1.5],
          [4.8, 1.5],
        ],
    'wall',
  );
  if (d >= 1)
    for (const y of [0.8, 4.2]) {
      const band = circle(p, 0.36, d === 1 ? 6 : 10);
      sides((s, p, n) => face(s, p, n, colors.green), band, y, y + 0.12, 'glass');
    }
}
function porch(out, d) {
  const face = writer(out, d),
    fields = gaziBackFields();
  shell(out, d, rearWall(), 0.35, 8.95, fields, 'wall');
  cap(face, rearWall(), 8.95, 'wall');
  for (const h of fields) {
    pane(face, h, d, -0.16, 'wood');
    archBand(face, h, d, h.name === 'main-timber-door' ? 0.23 : 0.15, 'trim', 0.04);
    if (h.name !== 'main-timber-door') grid(face, h, d);
  }
  if (d >= 1) {
    const xs = [
      plans.porch[0].center[0] - 3,
      ...plans.porch.slice(0, -1).map((p, i) => (p.center[0] + plans.porch[i + 1].center[0]) / 2),
      plans.porch.at(-1).center[0] + 3,
    ];
    for (const x of xs) column(face, [x, plans.porchFrontZ], d);
  }
  const x = fields[2].center[0],
    z = plans.porchBackZ - 0.145;
  if (d >= 1) {
    for (const sg of [-1, 1])
      face(
        'glass',
        [
          [x + sg * 2.1 - 0.13, floor + 0.55, z],
          [x + sg * 2.1 + 0.13, floor + 0.55, z],
          [x + sg * 2.1 + 0.13, floor + 7.8, z],
          [x + sg * 2.1 - 0.13, floor + 7.8, z],
        ],
        [0, 0, -1],
        colors.blue,
      );
    face(
      'glass',
      [
        [x - 2.23, floor + 7.5, z],
        [x + 2.23, floor + 7.5, z],
        [x + 2.23, floor + 7.8, z],
        [x - 2.23, floor + 7.8, z],
      ],
      [0, 0, -1],
      colors.blue,
    );
  }
  if (d >= 2)
    for (const [i, w] of [2.0, 2.7, 3.4].entries())
      box(
        face,
        rect(x - w / 2, z - 0.22 - i * 0.14, x + w / 2, z + 0.04),
        4.0 + i * 0.65,
        4.55 + i * 0.65,
        'trim',
      );
  for (const p of plans.porch) dome(face, p, d, true);
}
function tower(face, d) {
  const p = plans.tower,
    n = d === 0 ? 4 : d === 1 ? 8 : 12,
    r = circle(p.center, p.radius, n);
  box(face, p.outline, footing, p.baseTop, 'trim');
  profile(
    face,
    r,
    [
      [p.baseTop, 1],
      [p.balconyBottom, 1],
      [p.balconyFloor, p.balconyRadius / p.radius],
    ],
    'trim',
  );
  const outer = circle(p.center, p.balconyRadius, n),
    core = circle(p.center, p.upperRadius, n);
  cap(face, outer, p.balconyFloor, 'trim', [core]);
  sides(face, core, p.balconyFloor, p.coneBase, 'trim');
  cap(face, core, p.coneBase, 'trim');
  const rail = scaled(outer, 0.96);
  sides(face, outer, p.balconyTop - 0.15, p.balconyTop, 'trim');
  sides(face, rail, p.balconyTop - 0.15, p.balconyTop, 'trim', true);
  cap(face, outer, p.balconyTop, 'trim', [rail]);
  if (d >= 1) {
    underside(face, outer, p.balconyFloor - 0.04, 'trim', [core]);
    for (const q of outer) sides(face, circle(q, 0.06, 4), p.balconyFloor, p.balconyTop, 'trim');
  }
  profile(
    face,
    circle(p.center, p.upperRadius * 1.07, n),
    [
      [p.coneBase, 1],
      [p.coneTop, 0],
    ],
    'roof',
  );
  finial(face, p.center, p.coneTop, p.totalHeight, d);
  if (d >= 2)
    for (const e of edges(core)) {
      const q = e.a.map((v, k) => (v + e.b[k]) / 2 + e.normal[k] * 0.03);
      pane(face, hole('tower-slit', q, e.axis, e.normal, 0.22, 37, 2.1, 1.8, 'pointed', 0.2), d, 0);
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
    face = writer(out, d),
    r = plans.whole.outline,
    arcades = gaziArcades(),
    fields = gaziFields(d),
    all = [...arcades, ...(d >= 2 ? fields : [])],
    bottom =
      d === 0 ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...r.map(footing)) : footing;
  sides(face, d === 0 ? r : subdivide(r, 2), bottom, 0.35, 'paving');
  cap(face, r, 0.35, 'paving');
  for (const p of plans.lowParts) {
    shell(out, d, p.outline, 0.35, plans.lowTop, all, 'wall');
    cap(face, p.outline, plans.lowTop, 'wall');
    if (d >= 1) underside(face, p.outline, plans.lowTop - 0.04, 'wall');
  }
  shell(out, d, plans.hall.outline, plans.lowTop, plans.hall.top, d >= 2 ? fields : [], 'wall');
  cap(face, plans.hall.outline, plans.hall.top, 'wall');
  for (const h of fields) {
    pane(face, h, d, d === 1 ? 0.05 : -0.18);
    archBand(face, h, d, 0.12, 'trim', 0.04);
    grid(face, h, d);
  }
  for (const h of arcades) archBand(face, h, d, 0.23, 'trim', 0.04);
  for (const p of [...plans.sideDomes, plans.rear]) {
    const ring = circle(p.center, p.radius, d === 0 ? 6 : d === 1 ? 8 : 16);
    sides(face, ring, plans.lowTop, p.base, 'wall');
    dome(face, p, d, true);
  }
  const dr = circle(plans.dome.center, plans.dome.radius, d === 0 ? 8 : d === 1 ? 12 : 24);
  sides(face, dr, plans.hall.top, plans.dome.base, 'wall');
  dome(face, plans.dome, d);
  porch(out, d);
  tower(face, d);
  for (const [i, y] of [0.12, 0.24, 0.35].entries())
    box(
      face,
      rect(-14.4, -17.18 + i * 0.5, 18.69, -15.68),
      i === 0 ? footing : y - 0.12,
      y,
      'paving',
    );
  if (d >= 1)
    for (const e of edges(plans.hall.outline)) {
      const a = e.a.map((v, k) => v + e.normal[k] * 0.04),
        b = e.b.map((v, k) => v + e.normal[k] * 0.04);
      face(
        'trim',
        [at(a, 18.7), at(b, 18.7), at(b, 19.05), at(a, 19.05)],
        [e.normal[0], 0, e.normal[1]],
      );
    }
}
export const buildGaziSkyline = (o) => build(o, 0),
  buildGaziDistrict = (o) => build(o, 1),
  buildGaziStreet = (o) => build(o, 2),
  buildGaziCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const gaziStudy = {
  id: 'gazi_husrev_beg_mosque',
  key: 'gazi_husrev_beg_mosque',
  title: 'Gazi Husrev-beg Mosque',
  category: 'mosque',
  wikidataId: 'Q1255835',
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
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Reference pictures viewed only,not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain.',
  sourceNotice:
    'Six existing shared256² lime plaster,coursed/weathered limestone,standing-seam metal,bronze and plain wood graphs;seven merged roles include local opaque glazing. Metric UVs and linear tints,no embedded images or unique atlas. Portal fields,canopy tiers,grids and ribs are original abstractions;no historic artwork or inscriptions are copied.',
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
    'Two porch/minaret pictures and one supplemental portal close-up guide vocabulary. Roof spring levels,column/arch rhythm,tower stage transitions,portal ornament,tread heights and complete current condition remain approximate. Furnished interiors,engineering and physical-device/full-city performance are unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('five-bay-open-porch', [25, 9, -36], [2, 5, -12]),
    cam('coarse-original-portal', [2, 4, -14], [2, 4.4, -8.8]),
    cam('central-side-and-rear-domes', [30, 29, 36], [1, 16, 0]),
    cam('stone-minaret-and-open-balcony', [-35, 34, -24], [-16.5, 30, -7.5]),
    cam('gray-cone-and-finial', [-30, 47, -22], [-16.5, 43, -7.5]),
    cam('retained-stepped-envelope', [0, 150, 0.1], [0, 0, 0]),
  ],
};

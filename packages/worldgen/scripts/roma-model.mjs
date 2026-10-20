/** Mosque of Rome: retained folded envelope,branching colonnades,ribbed dome and open minaret. */
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
  '../../../content/worldgen/source/places/sr/sr2/n0477_moschea_di_roma/',
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
  wall: '#d3c3a3',
  trim: '#e0d9c7',
  roof: '#9caaab',
  paving: '#d3d0bf',
  metal: '#708c7e',
  glass: '#657c7a',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, romaGround(...p) - 0.35);
export function romaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Rome mosque footing outside retained terrain');
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
function _underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function band(face, r, y, h, slot = 'trim', f = 1.015) {
  const outer = scaled(r, f);
  sides(face, outer, y, y + h, slot);
  cap(face, outer, y + h, slot, [r]);
  _underside(face, outer, y, slot, [r]);
}
function _column(face, p, b, t, r, d, slot = 'trim') {
  const ring = circle(p, r, d <= 1 ? 4 : d === 2 ? 8 : 12);
  sides(face, ring, b, t, slot);
  cap(face, ring, t, slot);
  if (d >= 3 && t - b > 2) {
    profile(
      face,
      ring,
      [
        [b, 1.5],
        [b + 0.25, 1.5],
        [b + 0.45, 1],
      ],
      slot,
    );
    profile(
      face,
      ring,
      [
        [t - 0.5, 1],
        [t - 0.25, 1.65],
        [t, 1.65],
      ],
      slot,
    );
  }
}

const edges = (r) =>
  r.map((a, i) => {
    const b = r[(i + 1) % r.length],
      axis = unit(b.map((v, k) => v - a[k]));
    return {
      a,
      b,
      axis,
      normal: [axis[1] * sign(r), -axis[0] * sign(r)],
      length: Math.hypot(b[0] - a[0], b[1] - a[1]),
    };
  });
const subdivide = (r, max) =>
  r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / max);
    return Array.from({ length: n }, (_, j) => a.map((v, k) => v + ((b[k] - v) * j) / n));
  });
export function romaColumns(d = 3) {
  return plans.columns.filter((_, i) => (d === 0 ? i % 3 === 0 : d === 1 ? i % 2 === 0 : true));
}
export function romaHallFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [i, e] of edges(plans.hall.outline).entries()) {
    const n = d === 1 ? 3 : Math.max(3, Math.floor(e.length / 7));
    for (let j = 0; j < n; j++) {
      const q = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n),
        door = i === 3 && j === Math.floor(n / 2);
      hs.push({
        ...hole(
          `hall-${i}-${j}`,
          q,
          e.axis,
          e.normal,
          door ? 3.2 : 1.05,
          door ? 0.4 : 2,
          door ? 4.7 : 3.8,
          0,
          'rect',
          0.8,
        ),
        kind: door ? 'metal' : 'glass',
      });
    }
  }
  return hs;
}
function beam(face, a, b, w, slot = 'trim', caps = false) {
  const dir = unit(b.map((v, k) => v - a[k])),
    s = unit(Math.abs(dir[1]) > 0.99 ? [1, 0, 0] : cross(dir, [0, 1, 0])),
    t = cross(dir, s),
    ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) => p.map((v, k) => v + ((s[k] * x + t[k] * y) * w) / 2)),
    ra = ring(a),
    rb = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      slot,
      [ra[i], ra[j], rb[j], rb[i]],
      ra[i].map((v, k) => (v + ra[j][k]) / 2 - a[k]),
    );
  }
  if (caps) {
    face(
      slot,
      ra,
      dir.map((v) => -v),
    );
    face(slot, rb, dir);
  }
}
function branch(face, p, dir, base, top, spread, d, width = 0.42) {
  const n = d <= 1 ? 1 : d === 2 ? 2 : d === 3 ? 4 : 6,
    point = (t) => {
      const v = t * t * (3 - 2 * t),
        h = base + (top - base) * t;
      return [p[0] + dir[0] * spread * v, floor + h, p[1] + dir[1] * spread * v];
    };
  for (let i = 0; i < n; i++) beam(face, point(i / n), point((i + 1) / n), width);
}
function column(face, p, d) {
  solid(face, rect(p[0] - 0.23, p[1] - 0.23, p[0] + 0.23, p[1] + 0.23), 0.35, 3.4, 'trim');
  for (const dir of d === 0
    ? [
        [1, 0],
        [-1, 0],
      ]
    : [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
    branch(face, p, dir, 3.4, d === 0 ? 6.6 : 6.35, 1.65, d, d === 0 ? 0.55 : 0.42);
}
function dome(face, p, d, small = false) {
  const n = small ? [4, 8, 12, 16, 20][d] : [8, 16, 32, 48, 64][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 9][d];
  const point = (i, j) => {
    const t = ((j / steps) * Math.PI) / 2,
      a = (i / n) * Math.PI * 2,
      r =
        p.radius *
        Math.cos(t) *
        (d >= 2 && !small ? 1 + 0.035 * Math.cos(a * 16) * Math.cos(t) : 1);
    return [
      p.center[0] + r * Math.cos(a),
      floor + p.base + p.rise * Math.sin(t),
      p.center[1] + r * Math.sin(a),
    ];
  };
  for (let j = 0; j < steps; j++)
    for (let i = 0; i < n; i++)
      face(
        'roof',
        [point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)],
        [Math.cos(((i + 0.5) / n) * Math.PI * 2), 1, Math.sin(((i + 0.5) / n) * Math.PI * 2)],
      );
  if (!small && d >= 2)
    for (let k = 0; k < 16; k++)
      for (let j = 0; j < steps; j++)
        beam(face, point((k * n) / 16, j), point((k * n) / 16, j + 1), 0.42, 'trim');
}
function minaret(face, d) {
  const p = plans.minaret.center,
    n = [6, 8, 12, 16, 20][d];
  solid(face, rect(p[0] - 0.8, p[1] - 0.8, p[0] + 0.8, p[1] + 0.8), 0.3, 36.1, 'trim');
  for (const y of [27, 35]) {
    const outer = circle(p, 2.6, n),
      inner = circle(p, 1.45, n);
    sides(face, outer, y, y + 1.1, 'trim');
    sides(face, inner, y, y + 1.1, 'trim', true);
    cap(face, outer, y + 1.1, 'trim', [inner]);
    _underside(face, outer, y, 'trim', [inner]);
    for (const dir of d === 0
      ? [
          [1, 0],
          [-1, 0],
        ]
      : [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
      branch(face, p, dir, y - 3.5, y, 2.2, Math.min(d, 2), 0.35);
  }
  for (const dir of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const a = [p[0] + dir[0] * 1.1, floor + 36.1, p[1] + dir[1] * 1.1],
      b = [p[0] + dir[0] * 0.85, floor + 39.5, p[1] + dir[1] * 0.85],
      c = [p[0], floor + 41.1, p[1]];
    beam(face, a, b, 0.35);
    beam(face, b, c, 0.35);
  }
  solid(face, rect(p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08), 41.1, 42, 'metal');
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
    r = plans.whole.outline;
  const base =
    d === 0 ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...r.map(footing)) : footing;
  sides(face, d === 0 ? r : subdivide(r, 3), base, 0.35, 'paving');
  cap(face, r, 0.35, 'paving');
  for (const p of plans.canopy) {
    cap(face, p.outline, plans.canopyTop, 'trim', p.holes);
    if (d >= 1) {
      _underside(face, p.outline, plans.canopyTop - 0.25, 'trim', p.holes);
      sides(face, p.outline, plans.canopyTop - 0.25, plans.canopyTop, 'trim');
      for (const h of p.holes)
        sides(face, h, plans.canopyTop - 0.25, plans.canopyTop, 'trim', true);
    }
  }
  for (const p of romaColumns(d)) column(face, p, d);
  const hs = romaHallFields(d);
  shell(out, d, plans.hall.outline, 0.35, 15, hs, 'wall');
  cap(face, plans.hall.outline, 15, 'roof');
  for (const h of hs) {
    pane(face, h, d, -0.22, h.kind);
    if (d >= 1) archBand(face, h, d, 0.22, 'trim', 0.07);
  }
  const trimFace = writer(
    masked(
      out,
      hs.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  for (const [y, h] of [
    [0.4, 0.45],
    [7.2, 1.0],
    [14.1, 0.9],
  ])
    band(trimFace, plans.hall.outline, y, h, 'trim', 1.006);
  if (d >= 2)
    for (const e of edges(plans.hall.outline))
      for (let j = 1; j < Math.floor(e.length / 12); j++) {
        const q = e.a.map((v, k) => v + ((e.b[k] - v) * j) / Math.floor(e.length / 12));
        solid(face, rect(q[0] - 0.3, q[1] - 0.3, q[0] + 0.3, q[1] + 0.3), 0.35, 14.1, 'trim');
      }
  dome(face, plans.dome, d);
  for (const p of plans.smallDomes) dome(face, p, d, true);
  solid(face, rect(16.9, 19.9, 17.1, 20.1), 20.1, 21, 'metal');
  minaret(face, d);
  if (d >= 1) {
    const step = d === 1 ? 8 : d === 2 ? 4 : 2.5;
    for (let x = -24; x < 21; x += step)
      for (let z = -24; z < -8; z += step)
        if ((Math.round((x + 24) / step) + Math.round((z + 24) / step)) % 2 === 0)
          cap(face, rect(x, z, Math.min(22, x + step), Math.min(-8, z + step)), 0.37, 'wall');
  }
}
export const buildRomaSkyline = (o) => build(o, 0),
  buildRomaDistrict = (o) => build(o, 1),
  buildRomaStreet = (o) => build(o, 2),
  buildRomaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const romaStudy = {
  id: 'N0477',
  key: 'moschea_di_roma',
  title: 'Moschea di Roma',
  category: 'mosque',
  wikidataId: 'Q1789776',
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
    'Five existing shared256² brick,raw/coursed limestone,standing-seam metal and painted metal graphs;six merged roles including local opaque glazing. Metric UVs and linear tints,no embedded images,unique atlas,copied artwork or baked light.',
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
    'The two inspected pictures guide roof,material and branching-support vocabulary. The canopy and atrium are approximate roof partitions inside the retained no-hole envelope. Fine screen perforations,roof coffering,inscriptions,interiors,engineering,exact current condition and physical-device/full-city performance remain unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('ribbed-main-dome-and-brick-hall', [73, 34, 79], [17, 13, 20]),
    cam('branching-colonnade', [-46, 5, -18], [-30, 4, -30]),
    cam('open-atrium-and-geometric-paving', [8, 12, -2], [-4, 3, -17]),
    cam('two-gallery-open-minaret', [72, 30, -20], [53, 27, -4.5]),
    cam('folded-low-canopy-ranges', [-115, 24, -65], [-45, 5, -23]),
    cam('retained-complex-envelope', [0, 250, 0.1], [0, 8, 0]),
  ],
};

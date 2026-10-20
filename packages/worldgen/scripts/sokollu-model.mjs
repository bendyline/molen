/** Sokollu at Kadirga: retained courtyard,domed medrese ranges,three-bay porch and one minaret. */
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
  '../../../content/worldgen/source/places/sx/sxk/n0476_sokollu_mehmed_pasha_i_mosque/',
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
  wall: '#c9c5b9',
  trim: '#dfd8c8',
  roof: '#92999a',
  wood: '#8c7156',
  tile: '#80aeb7',
  gold: '#cfb86d',
  glass: '#526775',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, sokolluGround(...p) - 0.35);
export function sokolluGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Sokollu footing outside retained terrain');
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
export function sokolluArcades(d = 3) {
  const hs = [];
  const principalCourt = [
    [-17.5, -12.57],
    [-17.5, 9.68],
    [-3.175, 9.68],
    [-3.175, -12.57],
  ];
  for (const [i, e] of edges(principalCourt).entries()) {
    const main = e.a[0] > -4 && e.b[0] > -4,
      n = main ? 3 : Math.abs(e.axis[0]) > 0.8 ? 3 : 5;
    // The retained hole contains collinear seam points. Only its four principal sides define bays.
    if (e.length < 12) continue;
    for (let j = 0; j < n; j++) {
      const p = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / n),
        normal = e.normal.map((v) => -v);
      hs.push({
        ...hole(
          `court-${i}-${j}`,
          p,
          e.axis,
          normal,
          (e.length / n) * (d === 0 ? 0.7 : 0.76),
          0.3,
          main ? 5.7 : 4.7,
          main ? 3.9 : 3.1,
          'pointed',
          1.4,
        ),
        main,
      });
    }
  }
  return hs;
}
export function sokolluHallFields(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (const [i, e] of edges(plans.hall.outline).entries()) {
    for (let j = 0; j < (d === 1 ? 2 : 3); j++)
      for (const tier of d === 1 ? [1] : [0, 1]) {
        if (i === 3 && j === 1 && tier === 0) continue;
        const q = e.a.map((v, k) => v + ((e.b[k] - v) * (j + 0.5)) / (d === 1 ? 2 : 3));
        hs.push({
          ...hole(
            `hall-${i}-${j}-${tier}`,
            q,
            e.axis,
            e.normal,
            1.4,
            tier ? 7.0 : 1.4,
            tier ? 3.0 : 2.8,
            1.9,
            'pointed',
            0.7,
          ),
          kind: 'glass',
        });
      }
  }
  // A timber entrance faces the court; upper windows remain separate.
  hs.push({
    ...hole('main-door', [4.296, -2.1], [0, 1], [-1, 0], 2.5, 0.3, 4.6, 3.1, 'pointed', 0.8),
    kind: 'wood',
  });
  return hs;
}
function dome(face, p, r, base, rise, d, small = false) {
  const n = small ? [4, 6, 10, 14, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + rise * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
}
function finial(face, p, y, d, h = 0.8) {
  profile(
    face,
    circle(p, d === 0 ? 0.17 : 0.12, d === 0 ? 4 : 6),
    [
      [y, 1],
      [y + h * 0.4, 0.65],
      [y + h, 0.03],
    ],
    'gold',
  );
}
function central(face, d) {
  const p = plans.dome,
    n = [8, 12, 20, 28, 32][d],
    r = circle(p.center, p.radius, n);
  profile(
    face,
    r,
    [
      [plans.hallTop, 1],
      [p.base, 1],
    ],
    'wall',
  );
  if (d >= 1) {
    band(face, r, p.base - 0.25, 0.25, 'trim', 1.025);
    const count = d === 1 ? 8 : 16;
    for (let i = 0; i < count; i++) {
      const a = ((i + 0.5) * Math.PI * 2) / count,
        normal = [Math.cos(a), Math.sin(a)],
        q = p.center.map((v, k) => v + normal[k] * p.radius),
        h = hole(
          `drum-${i}`,
          q,
          [-normal[1], normal[0]],
          normal,
          0.85,
          12.6,
          2.7,
          1.8,
          'pointed',
          0.4,
        );
      pane(face, h, d, 0.12);
      archBand(face, h, d, 0.2, 'trim', 0.15);
    }
  }
  dome(face, p.center, p.radius, p.base, p.rise, d);
  finial(face, p.center, p.base + p.rise, d, 0.9);
}
function minaret(face, d) {
  const p = plans.minaret,
    q = p.center,
    n = [6, 8, 12, 16, 20][d];
  solid(face, rect(q[0] - 1.35, q[1] - 1.35, q[0] + 1.35, q[1] + 1.35), 0.3, 8.5, 'wall');
  profile(
    face,
    circle(q, p.radius, n),
    d === 0
      ? [
          [8.5, 1.2],
          [25, 1],
          [26, 1.65],
          [27, 0.9],
          [31, 0.85],
          [31, 0.85],
        ]
      : [
          [8.5, 1.3],
          [10, 1],
          [24.8, 1],
          [25.6, 1.65],
          [26.3, 1.65],
          [26.35, 0.88],
          [31, 0.85],
        ],
    'trim',
  );
  if (d >= 1) {
    sides(face, circle(q, p.radius * 1.65, n), 26.25, 27.1, 'trim');
    cap(face, circle(q, p.radius * 1.65, n), 27.1, 'trim', [circle(q, p.radius * 1.4, n)]);
  }
  profile(
    face,
    circle(q, p.radius * 0.92, n),
    [
      [31, 1],
      [35.5, 0],
    ],
    'roof',
  );
  finial(face, q, 35.5, d, 0.5);
}
function fountain(face, d) {
  const p = plans.fountain,
    q = p.center,
    b = p.base,
    n = d === 0 ? 4 : 8,
    ring = circle(q, p.radius, n);
  // Its own sampled foundation sits inside the open court without replacing courtyard terrain.
  sides(face, ring, (v) => sokolluGround(...v) - 0.3, b, 'trim');
  cap(face, ring, b, 'trim');
  if (d >= 1) {
    profile(
      face,
      circle(q, 1.05, n),
      [
        [b, 1],
        [b + 0.8, 1],
        [b + 1.35, 0.8],
      ],
      'trim',
    );
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n;
      _column(
        face,
        [q[0] + Math.cos(a) * 1.6, q[1] + Math.sin(a) * 1.6],
        b,
        b + 3.0,
        0.17,
        Math.min(d, 2),
        'trim',
      );
    }
  } else for (const v of circle(q, 1.5, 4)) _column(face, v, b, b + 3, 0.22, 0, 'trim');
  dome(face, q, 2.2, b + 3, 1.55, d, true);
  finial(face, q, b + 4.55, d, 0.5);
}
function galleryPanels(face, d, arcades) {
  if (d === 0) return;
  for (const h of arcades.filter((h) => !h.main)) {
    const q = h.center.slice(),
      n = h.normal,
      width = h.width / 2;
    if (Math.abs(n[0]) > 0.8) q[0] = -24.96;
    else q[1] = n[1] > 0 ? -22.5 : 22.1;
    const P = (u, y, dep = 0) => [
      q[0] + h.axis[0] * u + n[0] * dep,
      floor + y,
      q[1] + h.axis[1] * u + n[1] * dep,
    ];
    face('wood', [P(-width, 0.6), P(width, 0.6), P(width, 4.3), P(-width, 4.3)], [n[0], 0, n[1]]);
    face(
      'glass',
      [
        P(-width + 0.25, 1.2, 0.03),
        P(width - 0.25, 1.2, 0.03),
        P(width - 0.25, 3.95, 0.03),
        P(-width + 0.25, 3.95, 0.03),
      ],
      [n[0], 0, n[1]],
    );
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
    court = plans.court,
    arcs = sokolluArcades(d),
    fields = sokolluHallFields(d);
  const base =
    d === 0
      ? () => Math.min(rec.terrainFloorControl.min - 0.35, ...r.map(footing), ...court.map(footing))
      : footing;
  sides(face, d === 0 ? r : subdivide(r, 2), base, 0.3, 'wall');
  sides(face, d === 0 ? court : subdivide(court, 2), base, 0.3, 'wall', true);
  cap(face, r, 0.3, 'trim', [court]);
  const hallBox = {
      planes: [
        [1, 0, 0, -4.27],
        [-1, 0, 0, 27.38],
        [0, 0, 1, 14.42],
        [0, 0, -1, 10.18],
      ],
    },
    porchBox = {
      planes: [
        [1, 0, 0, 3.22],
        [-1, 0, 0, 4.32],
        [0, 0, 1, 12.6],
        [0, 0, -1, 9.72],
      ],
    };
  const low = writer(
    masked(
      openingBuilder(out, [hallBox, porchBox]),
      arcs.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  sides(low, r, 0.3, plans.lowTop, 'wall');
  sides(low, r, 0.3, plans.lowTop, 'wall', true);
  sides(low, court, 0.3, plans.lowTop, 'wall', true);
  for (const p of plans.lowRoofs) {
    cap(face, p.outline, plans.lowTop, 'roof', p.holes);
    _underside(face, p.outline, plans.lowTop - 0.15, 'trim', p.holes);
  }
  shell(out, d, plans.hall.outline, 0.3, plans.hallTop, fields, 'wall');
  cap(face, plans.hall.outline, plans.hallTop, 'roof');
  for (const h of fields) {
    pane(face, h, d, -0.22, h.kind);
    if (d >= 2) archBand(face, h, d, 0.2, 'trim', 0.06);
  }
  if (d >= 1) {
    const tiled = writer(
      masked(
        out,
        fields.map((h) => prepareOpening(h, 0, d)),
      ),
      d,
    );
    tiled(
      'tile',
      [
        [4.27, floor + 0.6, -5.1],
        [4.27, floor + 0.6, 0.9],
        [4.27, floor + 6.1, 0.9],
        [4.27, floor + 6.1, -5.1],
      ],
      [-1, 0, 0],
    );
  }
  const porch = plans.porch.outline;
  cap(face, porch, plans.porchTop, 'roof');
  _underside(face, porch, plans.porchTop - 0.15, 'trim');
  const main = arcs.filter((h) => h.main);
  shell(out, d, rect(-3.19, -12.56, -2.74, 9.68), 0.3, plans.porchTop, main, 'wall');
  for (const h of arcs) {
    if (!h.main) {
      const ring = openingShape(h, d),
        sg = sign(ring);
      const point = (q, dep) => [
        h.center[0] + h.axis[0] * q[0] + h.normal[0] * dep,
        q[1],
        h.center[1] + h.axis[1] * q[0] + h.normal[1] * dep,
      ];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          b = ring[(i + 1) % ring.length],
          du = b[0] - a[0],
          dy = b[1] - a[1];
        face(
          'trim',
          [point(a, 0), point(b, 0), point(b, -0.25), point(a, -0.25)],
          [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
        );
      }
    }
    if (d >= 1) archBand(face, h, d, 0.22, 'trim', 0.08);
    if (d >= 2) {
      const u = h.axis,
        half = h.width / 2 + 0.28;
      for (const sign of [-1, 1])
        _column(
          face,
          h.center.map((v, k) => v + u[k] * half * sign),
          0.3,
          h.main ? 4.1 : 3.3,
          0.22,
          Math.min(d, 2),
          'trim',
        );
    }
  }
  galleryPanels(face, d, arcs);
  central(face, d);
  for (const p of plans.smallDomes) dome(face, p.center, p.radius, p.base, p.rise, d, true);
  if (d >= 2)
    for (const p of plans.smallDomes.slice(9, 12)) finial(face, p.center, p.base + p.rise, d, 0.4);
  minaret(face, d);
  fountain(face, d);
}
export const buildSokolluSkyline = (o) => build(o, 0),
  buildSokolluDistrict = (o) => build(o, 1),
  buildSokolluStreet = (o) => build(o, 2),
  buildSokolluCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const sokolluStudy = {
  id: 'N0476',
  key: 'sokollu_mehmed_pasha_i_mosque',
  title: 'Sokollu Mehmed Pasha I Mosque',
  category: 'mosque',
  wikidataId: 'Q1572472',
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
    'Six existing shared256² limestone,raw limestone,standing-seam metal,plain wood,ceramic tile and bronze graphs;seven merged roles including local opaque glazing. Metric UVs,linear tints,no embedded images,unique atlas,copied historic artwork or baked light.',
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
    'Two inspected2008 pictures guide the exterior vocabulary. All internal divisions and vertical dimensions remain estimates. Historic tiles,calligraphy,fountain carving,interiors,engineering,exact grade joins and current condition are unverified. Physical-device/full-city timing remains pending.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('main-dome-and-single-minaret', [49, 29, 40], [14, 16, 0]),
    cam('three-domed-court-porch', [-19, 10, 16], [0, 6, -1.5]),
    cam('courtyard-stone-arcades', [-8, 5, -10], [-20, 3, -2]),
    cam('domed-fountain-canopy', [-19, 7, 7], [-10.5, 3, -1.45]),
    cam('small-domed-medrese-ranges', [-48, 20, -34], [-16, 6, -10]),
    cam('retained-envelope-and-court', [0, 125, 0.1], [0, 6, 0]),
  ],
};

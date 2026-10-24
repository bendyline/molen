/** Šarena: painted panel rhythm,columned gallery,tiled hip roof and stone minaret. */
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
  '../../../content/worldgen/source/places/sr/srq/sarena_mosque/',
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
  wall: '#ded9c2',
  stone: '#c9c7b7',
  trim: '#e1ddc9',
  roof: '#978373',
  wood: '#96735f',
  metal: '#89998d',
  glass: '#526764',
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
const _lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
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
const footing = (p) => Math.min(-0.35, floor - 0.3, sarenaGround(...p) - 0.35);
export function sarenaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Sarena footing outside retained terrain');
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
const linear = (h) =>
  h
    .slice(1)
    .match(/../g)
    .map((n) => {
      const v = parseInt(n, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const paints = ['#d7cc9e', '#c5d3b7', '#d8bfa4', '#c0d0cc'].map(linear),
  accents = ['#bf927a', '#c8b66d', '#8ea78b', '#b6a28e'].map(linear),
  cream = linear('#e4ddc7'),
  green = linear('#829681');
export function sarenaFields(d = 3) {
  if (d === 0) return { hall: [], upper: [] };
  const hall = [],
    upper = [];
  for (const z of [-7.95, 7.95])
    for (const x of [-2.9, 1.1, 5.1, 9.1])
      hall.push(
        hole(
          `low-side-${x}-${z}`,
          [x, z],
          [1, 0],
          [0, Math.sign(z)],
          1.15,
          0.65,
          2.05,
          2.05,
          'rect',
          1.4,
        ),
      );
  for (const z of [-5.3, -1.8, 1.8, 5.3])
    hall.push(
      hole(`low-back-${z}`, [10.31, z], [0, 1], [1, 0], 1.15, 0.65, 2.05, 2.05, 'rect', 1.4),
    );
  for (const z of [-4.6, 0, 4.6])
    hall.push({
      ...hole(
        `porch-back-${z}`,
        [-5.6, z],
        [0, 1],
        [-1, 0],
        z === 0 ? 2.1 : 1.2,
        0.15,
        z === 0 ? 3.15 : 2.4,
        2.4,
        'rect',
        1.4,
      ),
      kind: z === 0 ? 'wood' : 'glass',
    });
  for (const z of [-5.3, 0, 5.3])
    upper.push(
      hole(`gallery-${z}`, [-10.31, z], [0, 1], [-1, 0], 1.65, 5.1, 3.3, 3.3, 'rect', 1.4),
    );
  for (const z of [-7.95, 7.95])
    for (const x of [-7.1, -2.3, 2.5, 7.3])
      upper.push(
        hole(
          `upper-side-${x}-${z}`,
          [x, z],
          [1, 0],
          [0, Math.sign(z)],
          1.25,
          6.1,
          2.8,
          2,
          'pointed',
          1.4,
        ),
      );
  for (const z of [-5.3, -1.8, 1.8, 5.3])
    upper.push(
      hole(`upper-back-${z}`, [10.31, z], [0, 1], [1, 0], 1.25, 6.1, 2.8, 2, 'pointed', 1.4),
    );
  return { hall, upper };
}
export function sarenaPorchArches(d = 3) {
  const p = plans.porchEdge,
    hs = p.bays.map((q, i) =>
      hole(`porch-front-${i}`, q, p.axis, p.normal, 4.7, -0.1, 3.65, 2.8, 'round', 12),
    );
  if (d >= 1)
    for (const z of [-7.95, 7.95])
      hs.push(
        hole(
          `porch-side-${z}`,
          [-8, z],
          [1, 0],
          [0, Math.sign(z)],
          3.45,
          -0.1,
          3.65,
          2.8,
          'round',
          20,
        ),
      );
  return hs;
}
function fields(face, hs, d) {
  for (const h of hs) {
    pane(face, h, d, -0.23, h.kind ?? 'glass');
    if (d >= 1) archBand(face, h, d, 0.16, 'wood', 0.05);
    if (d >= 3 && h.kind !== 'wood') {
      const p = prepareOpening(h, 0, d),
        offset = -0.17 * Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
        lo = h.bottom + 0.15,
        hi = h.bottom + (h.shape === 'rect' ? h.height - 0.15 : h.spring - 0.1),
        width = h.width - 0.24,
        grid = (x0, y0, x1, y1) =>
          face(
            'wood',
            [
              [x0, y0],
              [x1, y0],
              [x1, y1],
              [x0, y1],
            ].map(([x, y]) => p.point(x, y, offset)),
            [h.normal[0], 0, h.normal[1]],
          ),
        count = Math.max(2, Math.round(width / 0.45));
      for (let i = 1; i < count; i++) {
        const u = -width / 2 + (width * i) / count;
        grid(u - 0.06, lo, u + 0.06, hi);
      }
      for (let i = 1; i <= 2; i++) {
        const y = lo + ((hi - lo) * i) / 3;
        grid(-width / 2, y - 0.06, width / 2, y + 0.06);
      }
    }
  }
}
function surfacePoint(e, u, y, offset = 0.055) {
  return [
    e.a[0] + e.axis[0] * u + e.normal[0] * offset,
    floor + y,
    e.a[1] + e.axis[1] * u + e.normal[1] * offset,
  ];
}
function paintedQuad(face, e, u0, u1, y0, y1, col, offset = 0.055, slot = 'wall') {
  face(
    slot,
    [
      surfacePoint(e, u0, y0, offset),
      surfacePoint(e, u1, y0, offset),
      surfacePoint(e, u1, y1, offset),
      surfacePoint(e, u0, y1, offset),
    ],
    [e.normal[0], 0, e.normal[1]],
    col,
  );
}
function facadePaint(out, d, r, rows, openings) {
  const face = writer(
    masked(
      out,
      openings.map((h) => prepareOpening(h, 0, d)),
    ),
    d,
  );
  for (const [side, e] of edges(r).entries()) {
    if (d === 0) {
      for (const [i, [lo, hi]] of rows.entries())
        paintedQuad(face, e, 0, e.length, lo, hi, paints[(i + side) % 4]);
      continue;
    }
    const count = Math.max(1, Math.round(e.length / 2.05)),
      width = e.length / count;
    for (const [row, [lo, hi]] of rows.entries())
      for (let i = 0; i < count; i++) {
        const u = i * width + 0.13,
          v = (i + 1) * width - 0.13,
          col = paints[(row + i + side) % 4],
          accent = accents[(i + side) % 4];
        paintedQuad(face, e, u, v, lo, hi, col);
        if (d >= 2) {
          const w = 0.12;
          paintedQuad(face, e, u, u + w, lo, hi, cream, 0.065);
          paintedQuad(face, e, v - w, v, lo, hi, cream, 0.065);
          paintedQuad(face, e, u, v, lo, lo + w, cream, 0.065);
          paintedQuad(face, e, u, v, hi - w, hi, cream, 0.065);
        }
        const centerU = (u + v) / 2,
          centerY = (lo + hi) / 2,
          radius = Math.min((v - u) * 0.29, (hi - lo) * 0.28),
          n = d === 1 ? 4 : d === 2 ? 8 : d === 3 ? 12 : 16;
        if (radius < 0.22) continue;
        const ring = Array.from({ length: n }, (_, j) => {
          const angle = (j * Math.PI * 2) / n,
            scale = d >= 3 && j % 2 ? 0.55 : 1;
          return [
            centerU + Math.cos(angle) * radius * scale,
            centerY + Math.sin(angle) * radius * scale,
          ];
        });
        for (let j = 0; j < n; j++)
          face(
            'wall',
            [
              surfacePoint(e, centerU, centerY, 0.075),
              surfacePoint(e, ...ring[j], 0.075),
              surfacePoint(e, ...ring[(j + 1) % n], 0.075),
            ],
            [e.normal[0], 0, e.normal[1]],
            accent,
          );
        if (d >= 3)
          paintedQuad(
            face,
            e,
            centerU - 0.1,
            centerU + 0.1,
            centerY - 0.1,
            centerY + 0.1,
            cream,
            0.085,
          );
      }
  }
}
function porch(out, face, d) {
  const hs = sarenaPorchArches(d),
    r = plans.porch.outline,
    arcade = {
      addTriangle(...a) {
        if (a[2].every((p) => Math.abs(p[0] + 5.6) < 1e-4)) return;
        out.addTriangle(...a);
      },
    };
  shell(arcade, d, r, 0.15, 4.1, hs, 'trim');
  cap(face, r, 4.1, 'wood');
  _underside(face, r, 4.1, 'wood');
  for (const h of hs) if (d >= 1) archBand(face, h, d, 0.2, 'trim', 0.08);
  for (let i = 0; i <= 3; i++)
    _column(face, [-10.31, -7.95 + (15.9 * i) / 3], 0.15, 2.8, d === 0 ? 0.34 : 0.27, d, 'trim');
}
function hipRoof(face, d) {
  const r = rect(-10.96, -8.6, 10.96, 8.6),
    p = center(r),
    top = r.map((q) => [p[0] + (q[0] - p[0]) * 0.28, p[1] + (q[1] - p[1]) * 0.01]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face('roof', [at(r[i], 10.35), at(r[j], 10.35), at(top[j], 12.5), at(top[i], 12.5)], [0, 1, 0]);
  }
  cap(face, top, 12.5, 'roof');
  sides(face, r, 9.85, 10.35, 'wood');
  _underside(face, r, 9.85, 'wood');
  if (d >= 1) {
    for (const e of edges(r)) {
      paintedQuad(face, e, 0, e.length, 10.0, 10.17, green, 0.01, 'wood');
      paintedQuad(face, e, 0, e.length, 9.85, 10.0, accents[0], 0.01, 'wood');
    }
  }
}
function minaret(face, d) {
  const p = plans.minaret.center,
    n = [6, 8, 12, 16, 20][d];
  profile(
    face,
    circle(p, 1.1, n),
    [
      [0.15, 1.1],
      [4.8, 1.1],
      [6, 1],
      [19.2, 0.82],
    ],
    'stone',
  );
  profile(
    face,
    circle(p, 1.1, n),
    [
      [19.2, 0.82],
      [19.55, 1.45],
      [20.1, 1.55],
    ],
    'trim',
  );
  profile(
    face,
    circle(p, 0.82, n),
    [
      [20, 1],
      [24, 0.86],
    ],
    'stone',
  );
  if (d >= 1) {
    sides(face, circle(p, 1.7, n), 20.08, 20.85, 'trim');
    cap(face, circle(p, 1.7, n), 20.85, 'trim', [circle(p, 1.44, n)]);
  }
  profile(
    face,
    circle(p, 0.96, n),
    [
      [24, 1],
      [27, 0],
    ],
    'metal',
  );
  profile(
    face,
    circle(p, 0.12, d === 0 ? 4 : 8),
    [
      [27, 1],
      [27.5, 0],
    ],
    'metal',
  );
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
    hs = sarenaFields(d);
  sides(
    face,
    d === 0 ? plans.whole.outline : subdivide(plans.whole.outline, 2),
    footing,
    0.15,
    'trim',
  );
  cap(face, plans.whole.outline, 0.15, 'trim');
  shell(out, d, plans.hall.outline, 0.15, 4.1, hs.hall, 'wall');
  shell(out, d, plans.whole.outline, 4.1, 10.1, hs.upper, 'wall');
  cap(face, plans.whole.outline, 10.1, 'wall');
  facadePaint(
    out,
    d,
    plans.hall.outline,
    [
      [0.45, 2.85],
      [3.05, 4],
    ],
    hs.hall,
  );
  facadePaint(
    out,
    d,
    plans.whole.outline,
    [
      [4.35, 6.6],
      [6.8, 9.7],
    ],
    hs.upper,
  );
  fields(face, [...hs.hall, ...hs.upper], d);
  porch(out, face, d);
  hipRoof(face, d);
  minaret(face, d);
}
export const buildSarenaSkyline = (o) => build(o, 0),
  buildSarenaDistrict = (o) => build(o, 1),
  buildSarenaStreet = (o) => build(o, 2),
  buildSarenaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const sarenaStudy = {
  id: 'sarena_mosque',
  key: 'sarena_mosque',
  title: 'Šarena Mosque',
  category: 'mosque',
  wikidataId: 'Q1009896',
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
    'Six existing shared256² lime plaster,coursed/raw limestone,ceramic tile,plain wood and painted metal graphs;seven merged roles with local opaque glazing. Colored facade panels,frames and coarse rosettes use original geometry and linear vertex tints over the shared plaster graph. Meter-scaled UVs,no embedded images,unique atlas,copied historic paintings or baked lighting.',
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
    'Two inspected exterior pictures guide the painted facade grid,columned lower porch,enclosed upper gallery,brown tiled hip roof,broad red/green eaves and pale minaret. Coarse original geometric rosettes suggest painted rhythm;the historic floral imagery,calligraphy,lattice pattern and exact colors are not reproduced. Porch facing,interior wall partition,tower attachment and all heights remain estimated. Opaque window/door fields close the exterior shell;porch bays are shallow and unfurnished. Detached tomb,courtyard wall,fountain,planting and town remain host content. Current finish,engineering,ground joins and physical-device timing are unverified.',
  ],
  camera: scope.camera,
  qaLodCameras: scope.qaLodCameras,
  qaCameras: [
    cam('columned-porch-and-upper-gallery', [-32, 12, -22], [-8, 5, 0]),
    cam('four-rows-painted-side-panels', [2, 13, -34], [0, 5, -7]),
    cam('hip-roof-and-colored-eaves', [-22, 23, -21], [0, 10, 0]),
    cam('single-stone-minaret', [27, 22, 26], [7.8, 14, 6.5]),
    cam('rear-panels-and-grilled-windows', [35, 12, 4], [9, 5, 0]),
    cam('retained-rectangle-plan', [0, 105, 0.1], [0, 5, 0]),
  ],
};

/** Little Hagia Sophia: shallow lead dome, buttressed brick drum and five-bay western portico. */
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
  '../../../content/worldgen/source/places/sx/sxk/little_hagia_sophia/',
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
  wall: '#bf9d87',
  masonry: '#b7aea0',
  trim: '#d2cbbb',
  roof: '#8d949a',
  door: '#55796b',
  gold: '#cbb47d',
  glass: '#53646c',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, littleHagiaGround(...p) - 0.35);
export function littleHagiaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Little Hagia footing outside retained terrain');
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
const _edges = (ring) =>
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
const _capDome = (face, p, r, base, height, d, small = false) => {
  const n = small ? [4, 6, 10, 14, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d];
  profile(
    face,
    circle(p, r, n),
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + height * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
};
function _finial(face, p, y, d) {
  if (d === 0) {
    solid(face, rect(p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08), y, y + 1.5, 'gold');
    return;
  }
  beam(face, at(p, y), at(p, y + 1.5), d === 0 ? 0.16 : 0.12, 'gold');
  if (d >= 3)
    profile(
      face,
      circle(p, 0.24, 6),
      [
        [y + 0.2, 0.65],
        [y + 0.6, 1],
        [y + 1.0, 0.5],
      ],
      'gold',
    );
}
const _trimBand = (face, h, d, w = 0.26) => archBand(face, h, d, w, 'trim', 0.055);
const _box = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
function _underside(face, r, y, slot, holes = []) {
  cap((s, p) => face(s, p, [0, -1, 0]), r, y, slot, holes);
}
function band(face, r, y, h, slot = 'trim', f = 1.015) {
  solid(face, scaled(r, f), y, y + h, slot);
}
function _openBand(face, a, b, y, h, slot = 'trim', width = 0.18) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [u[1] * width, -u[0] * width];
  solid(
    face,
    [
      a.map((v, k) => v + n[k]),
      b.map((v, k) => v + n[k]),
      b.map((v, k) => v - n[k]),
      a.map((v, k) => v - n[k]),
    ],
    y,
    y + h,
    slot,
  );
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
export function littleHallFields(d = 3) {
  const hs = [
    {
      ...hole('portico-rear-door', [-17, 0], [0, 1], [-1, 0], 2.1, 0.3, 3.8, 2.8, 'round', 1.2),
      kind: 'door',
    },
    {
      ...hole('south-green-door', [-13, 12], [1, 0], [0, 1], 1.9, 0.3, 3.8, 3.8, 'rect', 1.2),
      kind: 'door',
    },
  ];
  if (d === 0) return hs;
  for (const [i, e] of edges(plans.main.outline).entries()) {
    if (e.normal[0] < -0.9) continue;
    const n = Math.floor(e.length / 5.6);
    if (!n) continue;
    for (let k = 0; k < n; k++) {
      const p = e.a.map((v, j) => v + ((e.b[j] - v) * (k + 0.5)) / n),
        round = e.normal[0] > 0.65 && e.length < 9;
      hs.push(
        hole(
          `upper-wall-${i}-${k}`,
          p,
          e.axis,
          e.normal,
          round ? 2.4 : 1.5,
          6.1,
          3.5,
          round ? 2.25 : 3.5,
          round ? 'round' : 'rect',
          1.2,
        ),
      );
      if (d >= 2 && k % 2 === 0 && !(e.normal[1] > 0.7 && Math.abs(p[0] + 13) < 3))
        hs.push(hole(`lower-wall-${i}-${k}`, p, e.axis, e.normal, 1.3, 1.6, 2.7, 2.7, 'rect', 1.2));
    }
  }
  for (const z of [-6, 6])
    hs.push(
      hole(`portico-rear-window-${z}`, [-17, z], [0, 1], [-1, 0], 1.3, 1.4, 2.6, 2.6, 'rect', 1.2),
    );
  return hs;
}
export function littleDrumFields(d = 3) {
  if (d < 1) return [];
  const ring = circle(plans.central, 10, [8, 16, 16, 16, 16][d]);
  return edges(ring)
    .filter((_, i) => (d === 1 ? i % 2 === 0 : i % 2 === 0))
    .map((e, i) =>
      hole(
        `drum-arched-window-${i}`,
        e.a.map((v, k) => (v + e.b[k]) / 2),
        e.axis,
        e.normal,
        1.35,
        15.25,
        2.8,
        2.1,
        'round',
        1.3,
      ),
    );
}
export function littlePorticoArches() {
  const p = plans.porchEdge,
    hs = p.bays.map((q, i) =>
      hole(
        `portico-front-${i}`,
        q,
        p.axis,
        p.normal,
        p.length / 5 - 0.65,
        -0.1,
        6.9,
        4.8,
        'round',
        10,
      ),
    );
  const r = plans.porch.outline;
  for (const [i, e] of edges(r).entries())
    if (Math.abs(e.normal[1]) > 0.7 && e.length > 3)
      hs.push(
        hole(
          `portico-side-${i}`,
          e.a.map((v, k) => (v + e.b[k]) / 2),
          e.axis,
          e.normal,
          Math.min(3.5, e.length - 0.6),
          -0.1,
          6.9,
          4.8,
          'round',
          8,
        ),
      );
  return hs;
}
function fields(face, hs, d) {
  for (const h of hs) {
    pane(face, h, d, d === 0 ? 0.04 : d === 1 ? 0.1 : -0.12, h.kind ?? 'glass');
    if (d >= 1) archBand(face, h, d, h.kind === 'door' ? 0.24 : 0.15, 'trim', 0.045);
  }
}
function hall(out, face, d) {
  const hs = littleHallFields(d),
    mixed = {
      addTriangle(slot, ref, p, n, uv, col) {
        const role = slot === 'wall' && (n[0] > 0.5 || n[2] < -0.5) ? 'masonry' : slot;
        out.addTriangle(
          role,
          ref,
          p,
          n,
          uv,
          role !== slot
            ? d === 0
              ? colors[role].map((v, k) => v * means[role][k])
              : colors[role]
            : col,
        );
      },
    };
  shell(mixed, d, plans.main.outline, 0.12, 11.8, hs, 'wall');
  cap(face, plans.main.outline, 11.8, 'roof');
  fields(face, hs, d);
  if (d >= 1)
    for (const e of edges(plans.main.outline)) _openBand(face, e.a, e.b, 11.45, 0.4, 'wall', 0.18);
  // Small dark green south door canopy; simplified broad slab, no thin brackets.
  if (d >= 1) solid(face, rect(-14.7, 12.02, -11.3, 13.5), 4.4, 4.62, 'roof');
  const apse = plans.apse;
  _capDome(face, apse, 4.25, 11.8, 2.4, d, true);
}
function central(out, face, d) {
  const p = plans.central,
    n = [8, 16, 16, 16, 16][d],
    r = circle(p, 10, n),
    hs = littleDrumFields(d);
  profile(
    face,
    circle(p, 11.4, n),
    [
      [11.8, 1],
      [13.2, 1],
      [14.1, 0.88],
    ],
    'wall',
  );
  if (d >= 2) shell(out, d, r, 14.1, 19.2, hs, 'wall');
  else solid(face, r, 14.1, 19.2, 'wall');
  fields(face, hs, d);
  if (d >= 1) band(face, r, 18.9, 0.35, 'wall', 1.025);
  // Eight broad stepped brick buttresses around the raised drum.
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      radial = [Math.cos(a), Math.sin(a)],
      tangent = [-radial[1], radial[0]],
      plan = (r0, r1, w) =>
        [
          [-1, r0],
          [1, r0],
          [1, r1],
          [-1, r1],
        ].map(([s, r]) => p.map((v, k) => v + radial[k] * r + (tangent[k] * s * w) / 2));
    solid(face, plan(9.7, 11.5, 0.8), 11.8, 14.3, 'wall');
    if (d >= 1) solid(face, plan(9.7, 10.8, 0.7), 14.3, 18.6, 'wall');
  }
  _capDome(face, p, 10.25, 19.2, 4.2, d);
  _finial(face, p, 23.3, d);
}
function portico(out, face, d) {
  const hs = littlePorticoArches(),
    p = plans.porchEdge,
    r = plans.porch.outline;
  const arcade = {
    addTriangle(...args) {
      // The church already supplies the porch's rear wall at the estimated partition.
      if (args[2].every((p) => Math.abs(p[0] + 17) < 1e-5)) return;
      out.addTriangle(...args);
    },
  };
  shell(arcade, d, r, 4.9, 7.8, hs, 'trim');
  cap(face, r, 7.8, 'roof');
  _underside(face, r, 7.8, 'trim');
  const supports = Array.from({ length: 6 }, (_, i) =>
    p.a.map((v, k) => v + ((p.b[k] - v) * i) / 5),
  );
  for (const q of supports) {
    _column(face, q, 0.12, 4.9, 0.32, d);
    if (d >= 1) {
      solid(face, rect(q[0] - 0.45, q[1] - 0.45, q[0] + 0.45, q[1] + 0.45), 4.6, 4.95, 'trim');
      solid(face, rect(q[0] - 0.5, q[1] - 0.5, q[0] + 0.5, q[1] + 0.5), 0.12, 0.35, 'trim');
    }
  }
  if (d >= 1) for (const e of edges(r)) _openBand(face, e.a, e.b, 7.4, 0.5, 'trim', 0.2);
  for (const q of p.bays) {
    const c = q.map((v, k) => v - p.normal[k] * 2.15);
    _capDome(face, c, 2.0, 7.8, 1.6, d, true);
  }
}
function minaret(face, d) {
  const p = plans.minaret,
    n = [6, 8, 12, 16, 20][d];
  solid(face, rect(p[0] - 1.45, p[1] - 1.45, p[0] + 1.45, p[1] + 1.45), 0.12, 7, 'trim');
  if (d === 0) {
    profile(
      face,
      circle(p, 1.3, n),
      [
        [7, 1.15],
        [9, 1],
        [22.3, 0.8],
        [23.3, 1.35],
        [24.1, 1.1],
        [24.1, 0.65],
        [28, 0.55],
      ],
      'trim',
    );
  } else {
    profile(
      face,
      circle(p, 1.3, n),
      [
        [7, 1.15],
        [9, 1],
        [22.3, 0.8],
        [23, 0.82],
      ],
      'trim',
    );
    profile(
      face,
      circle(p, 1.3, n),
      [
        [22.3, 0.8],
        [22.7, 1],
        [23.3, 1.35],
        [23.7, 1.35],
        [24.1, 1.1],
      ],
      'trim',
    );
    profile(
      face,
      circle(p, 0.85, n),
      [
        [23.7, 1],
        [28, 0.85],
      ],
      'trim',
    );
  }
  if (d >= 1) {
    sides(face, circle(p, 1.7, n), 23.35, 24.1, 'trim');
    cap(face, circle(p, 1.7, n), 24.1, 'trim', [circle(p, 1.45, n)]);
  }
  if (d >= 3)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6;
      _column(
        face,
        [p[0] + Math.cos(a) * 1.55, p[1] + Math.sin(a) * 1.55],
        23.35,
        24.1,
        0.08,
        0,
        'trim',
      );
    }
  profile(
    face,
    circle(p, 1.05, n),
    [
      [28, 1],
      [31.4, 0],
    ],
    'roof',
  );
  profile(
    face,
    circle(p, d === 0 ? 0.12 : 0.08, d === 0 ? 4 : 8),
    [
      [31.4, 1],
      [32, 0],
    ],
    'gold',
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
    face = writer(out, d);
  sides(face, plans.whole.outline, footing, 0.12, 'trim');
  cap(face, plans.whole.outline, 0.12, 'trim');
  hall(out, face, d);
  central(out, face, d);
  portico(out, face, d);
  minaret(face, d);
}
export const buildLittleHagiaSkyline = (o) => build(o, 0),
  buildLittleHagiaDistrict = (o) => build(o, 1),
  buildLittleHagiaStreet = (o) => build(o, 2),
  buildLittleHagiaCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const littleHagiaStudy = {
  id: 'little_hagia_sophia',
  key: 'little_hagia_sophia',
  title: 'Little Hagia Sophia',
  category: 'mosque',
  wikidataId: 'Q1144576',
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
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Reference photographs viewed only, not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared 256² longformat brick, dry stone, continuous limestone, standing-seam metal, plain wood and cast bronze graphs serve seven merged roles including local opaque blue-grey fields. Metric UVs, linear tints and zero embedded images. No unique facade texture, copied photography, inscriptions, grille artwork or baked lighting.',
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
    'Individual mosque exterior; separate round tomb and cemetery remain host content. Exact main outline and original anchor/heading retained, with estimated western portico partition, central roof plan and tower position. All heights, detailed roof subdivisions, shallow apse cap, facade bay rhythm, minaret/balcony and finials are picture-led estimates. Round arcade openings lead to a shallow exterior porch with a closed church wall/door behind; no furnished-interior/free-walking claim. Fine historic capitals, brick lattice, calligraphy, window grilles, exact roof ribs, current finish, steps/paving and physical-device timings remain unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('five-bay-open-western-portico', [-50, 12, 24], [-20, 4, 0]),
    cam('buttressed-brick-drum-and-lead-dome', [37, 35, -32], [3.5, 18, 0]),
    cam('mixed-masonry-and-eastern-apse', [53, 18, -19], [18, 8, 0]),
    cam('single-balcony-minaret', [-36, 27, -36], [-13, 23, -9.8]),
    cam('green-side-door-and-canopy', [-20, 8, 34], [-13, 4, 12]),
    cam('north-up-raw-main-outline', [0, 180, 0.1], [0, 8, 0]),
  ],
};

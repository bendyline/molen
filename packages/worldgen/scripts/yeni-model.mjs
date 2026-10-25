/** Yeni Camii: four semi-domes,two three-balcony minarets and a domed court. */
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
  '../../../content/worldgen/source/places/sx/sxk/new_mosque/',
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
  wall: '#cbbfa8',
  trim: '#e3d9c4',
  roof: '#899095',
  door: '#987351',
  gold: '#bca56b',
  glass: '#566b7d',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, yeniGround(...p) - 0.35);
export function yeniGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('New Mosque footing outside retained terrain');
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
const capDome = (face, p, r, base, height, d, small = false) => {
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
function finial(face, p, y, d) {
  if (d === 0) {
    sides(face, rect(p[0] - 0.08, p[1] - 0.08, p[0] + 0.08, p[1] + 0.08), y, y + 1.5, 'gold');
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
const trimBand = (face, h, d, w = 0.26) => archBand(face, h, d, w, 'trim', 0.055);
function stripedArch(face, h, d, w = 0.35) {
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
    p = prepareOpening(h, 0, d),
    ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  for (let i = 0; i < inner.length; i++) {
    const j = (i + 1) % inner.length;
    face(
      'trim',
      [
        p.point(...outer[i], 0.06 * ns),
        p.point(...outer[j], 0.06 * ns),
        p.point(...inner[j], 0.06 * ns),
        p.point(...inner[i], 0.06 * ns),
      ],
      [h.normal[0], 0, h.normal[1]],
      i > 1 && i % 2 ? [0.37, 0.28, 0.23] : colors.trim,
    );
  }
}
export function yeniHallFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const e of edges(plans.hall)) {
    const n = d === 1 ? 3 : Math.round(e.length / 5.2);
    for (let i = 0; i < n; i++)
      for (const y of d === 1 ? [10.0] : [2.8, 10.0])
        out.push(
          hole(
            `hall-${out.length}`,
            lerp(e.a, e.b, (i + 0.5) / n),
            e.axis,
            e.normal,
            d === 1 ? 2.1 : 1.9,
            y,
            3.9,
            2.5,
            'pointed',
            1.8,
          ),
        );
  }
  out.push({
    ...hole('main-court-door', [-7.4, 1.0], [0, 1], [-1, 0], 3.6, 1.25, 6.0, 3.9, 'pointed', 2),
    kind: 'door',
  });
  return out;
}
export function yeniDrumFields(d = 3) {
  if (d < 1) return [];
  const r = circle(plans.dome.center, 9, [8, 12, 20, 28, 32][d]);
  return edges(r)
    .filter((_, i) => (d === 1 ? i % 3 === 0 : i % 2 === 0))
    .map((e, i) =>
      hole(
        `drum-${i}`,
        lerp(e.a, e.b, 0.5),
        e.axis,
        e.normal,
        d === 1 ? 1.1 : 0.9,
        24.9,
        1.8,
        1.0,
        'pointed',
        1.6,
      ),
    );
}
export function yeniCourtArches(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [i, e] of edges(plans.court).entries()) {
    const n = d === 1 ? 2 : Math.round(e.length / 4.8);
    for (let j = 0; j < n; j++)
      out.push(
        hole(
          `court-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal.map((v) => -v),
          e.length / n - 0.65,
          1.25,
          6.1,
          3.8,
          'pointed',
          1.5,
        ),
      );
  }
  return out;
}
export function yeniSideArches(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const side of [-1, 1]) {
    const z = side < 0 ? -23.8 : 26.5,
      n = d === 1 ? 3 : 7;
    for (let j = 0; j < n; j++)
      for (const tier of [0, 1])
        out.push(
          hole(
            `side-${side}-${tier}-${j}`,
            [0.2 + ((j + 0.5) * 36.8) / n, z],
            [1, 0],
            [0, side],
            36.8 / n - 0.65,
            tier === 0 ? 1.25 : 7.25,
            tier === 0 ? 5.3 : 5.0,
            tier === 0 ? 3.7 : 3.4,
            'round',
            1.5,
          ),
        );
  }
  return out;
}
export function yeniFountainFields(d = 3) {
  if (d < 1) return [];
  return edges(circle(plans.fountain.center, 2.3, 8)).map((e, i) =>
    hole(
      `fountain-${i}`,
      lerp(e.a, e.b, 0.5),
      e.axis,
      e.normal,
      e.length - 0.5,
      1.65,
      2.5,
      1.6,
      'pointed',
      1.3,
    ),
  );
}
const finish = (face, fields, d) => {
  for (const h of fields) {
    pane(face, h, d, -0.2, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) trimBand(face, h, d === 2 ? 1 : d, 0.2);
  }
};
function hall(out, face, d) {
  const fields = yeniHallFields(d);
  sides(face, plans.whole.outline, footing, 1.2, 'wall');
  cap(face, plans.whole.outline, 1.2, 'trim');
  shell(out, d, plans.hall, 1.2, 16.2, fields, 'wall');
  cap(face, plans.hall, 16.2, 'roof');
  finish(face, fields, d);
  const p = plans.dome.center,
    core = rect(p[0] - 8.3, p[1] - 8.3, p[0] + 8.3, p[1] + 8.3);
  solid(face, core, 16.2, 24.5, 'wall');
  if (d >= 1) band(face, plans.hall, 15.7, 0.5, 'trim', 1.006);
  // Octagonal capped buttress piers interrupt the four dome springing corners.
  for (const dx of [-1, 1])
    for (const dz of [-1, 1]) {
      const q = [p[0] + dx * 10.5, p[1] + dz * 10.5],
        r = circle(q, 1.75, d === 0 ? 4 : 8);
      solid(face, r, 16.2, 28.6, 'wall');
      capDome(face, q, 1.9, 28.6, 1.4, d, true);
      if (d >= 2) {
        band(face, r, 27.8, 0.45, 'trim', 1.13);
        finial(face, q, 30, d);
      }
    }
  for (const x of [1.0, 33.5])
    for (const side of [-1, 1]) {
      const z = side < 0 ? -20.0 : 22.8,
        r = rect(x - 1.3, z - 2, x + 1.3, z + 2);
      solid(face, r, 1.2, 18.5, 'wall');
      for (let k = 0; k < (d >= 2 ? 3 : 1); k++) {
        const q = [x + (k - 1) * 0.9, z],
          y = 18.5 - k * 0.9;
        solid(face, circle(q, 1.3, d === 0 ? 4 : 8), y - 2, y, 'wall');
        capDome(face, q, 1.4, y, 1.0, d, true);
      }
    }
  // Raised court-facing portal is shallow and remains outside the open courtyard.
  const gate = rect(-8.0, -2.5, -6.7, 4.5),
    door = {
      ...hole('raised-portal', [-8, 1], [0, 1], [-1, 0], 3.5, 1.25, 6, 3.9, 'pointed', 2),
      kind: 'door',
    };
  if (d < 2) solid(face, gate, 8.2, 12.8, 'wall');
  else {
    shell(out, d, gate, 1.2, 12.8, [door], 'wall');
    cap(face, gate, 12.8, 'trim');
    pane(face, door, d, -0.18, 'door');
    stripedArch(face, door, d, 0.45);
  }
  if (d >= 2) {
    band(face, gate, 11.9, 0.7, 'trim', 1.08);
    const h = hole('portal-plaque', [-8.0, 1], [0, 1], [-1, 0], 4.3, 9.4, 1.3, 1.3, 'rect');
    pane(face, h, d, 0.04, 'gold');
  }
}
function domes(out, face, d) {
  const p = plans.dome.center,
    drum = circle(p, 9, [8, 12, 20, 28, 32][d]),
    fields = yeniDrumFields(d);
  for (const q of plans.semidomes) {
    const ring = circle(q, 9.4, [6, 8, 14, 20, 24][d]);
    sides(face, ring, 14.9, 16.2, 'wall');
    capDome(face, q, 9.4, 16.2, 9, d, true);
    if (d >= 2) {
      const n = unit(q.map((v, k) => v - p[k])),
        a = [-n[1], n[0]];
      for (const t of [-0.45, 0, 0.45]) {
        const angle = Math.atan2(n[1], n[0]) + t,
          normal = [Math.cos(angle), Math.sin(angle)],
          pt = q.map((v, k) => v + normal[k] * 9.38),
          h = hole(
            `semi-light-${q}-${t}`,
            pt,
            [-normal[1], normal[0]],
            normal,
            1.2,
            16.8,
            3.3,
            2.0,
          );
        pane(face, h, d, 0.06, 'glass');
        trimBand(face, h, d, 0.18);
      }
      void a;
    }
  }
  shell(out, d, drum, 24.5, 27, fields, 'wall');
  finish(face, fields, d);
  capDome(face, p, 9, 27, 8.7, d);
  finial(face, p, 35.7, d);
  for (const dx of [-1, 1])
    for (const dz of [-1, 1]) {
      const q = [p[0] + dx * 13, p[1] + dz * 13];
      capDome(face, q, 4.2, 16.2, 3.2, d, true);
    }
  if (d >= 2) {
    band(face, drum, 26.55, 0.45, 'trim', 1.025);
  }
}
function minaret(face, m, d) {
  const r = circle(m.center, m.radius, [4, 6, 10, 16, 20][d]),
    ys = [24, 33, 41],
    levels = [
      [5, 1.06],
      [8, 1],
    ];
  solid(face, m.base, 1.2, 5, 'wall');
  for (const y of ys) levels.push([y - 1, 0.88], [y, 1.45], [y + 0.7, 1.45], [y + 0.95, 0.82]);
  levels.push([44, 0.72]);
  profile(face, r, levels, 'wall');
  profile(
    face,
    r,
    [
      [44, 0.85],
      [51.3, 0.06],
      [52, 0],
    ],
    'roof',
  );
  if (d >= 2)
    for (const y of ys) {
      band(face, r, y + 0.1, 0.65, 'trim', 1.48);
      if (d >= 3)
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4,
            q = [
              m.center[0] + m.radius * 1.42 * Math.cos(a),
              m.center[1] + m.radius * 1.42 * Math.sin(a),
            ];
          beam(face, at(q, y + 0.05), at(q, y + 0.75), 0.14, 'trim');
        }
    }
}
function openFront(out, face, r, fields, d, bottom, top) {
  if (d >= 2) {
    shell(out, d, r, bottom, top, fields, 'wall');
    for (const h of fields) stripedArch(face, h, d === 2 ? 1 : d, 0.24);
    return;
  }
  const e = edges(r)[0],
    n = fields.length || 2;
  for (let i = 0; i <= n; i++) {
    const q = lerp(e.a, e.b, i / n);
    beam(face, at(q, bottom), at(q, top), 0.65, 'wall');
  }
  if (d === 0) {
    face(
      'wall',
      [at(e.a, top - 0.6), at(e.b, top - 0.6), at(e.b, top), at(e.a, top)],
      [e.normal[0], 0, e.normal[1]],
    );
    return;
  }
  for (const h of fields) {
    const p = prepareOpening(h, 0, 1),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
      arc = openingShape(h, 1).slice(2),
      A = (q, o) => p.point(q[0], q[1], o * sg);
    for (let i = 0; i < arc.length - 1; i++) {
      const a = arc[i],
        b = arc[i + 1];
      for (const o of [0, -0.65])
        face(
          'wall',
          [A(a, o), A(b, o), A([b[0], floor + top], o), A([a[0], floor + top], o)],
          [h.normal[0] * (o === 0 ? 1 : -1), 0, h.normal[1] * (o === 0 ? 1 : -1)],
        );
      face('trim', [A(a, 0), A(b, 0), A(b, -0.65), A(a, -0.65)], [0, -1, 0]);
    }
  }
}
function court(out, face, d) {
  const inner = plans.court,
    outer = plans.courtOuter,
    fields = yeniCourtArches(d);
  sides(face, outer, 1.2, 8.2, 'wall');
  cap(face, outer, 8.2, 'roof', [inner]);
  // Solid perimeter back walls show inward faces under the open gallery roof.
  for (const [i, e] of edges(scaled(outer, 0.985)).entries()) {
    const mid = lerp(e.a, e.b, 0.5);
    if (mid[0] > -8) continue;
    face(
      'wall',
      [at(e.a, 1.2), at(e.b, 1.2), at(e.b, 8.2), at(e.a, 8.2)],
      [-e.normal[0], 0, -e.normal[1]],
    );
    if (d >= 1) {
      const n = Math.max(1, Math.round(e.length / 7));
      for (let j = 0; j < n; j++) {
        const h = hole(
          `court-back-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal.map((v) => -v),
          1.25,
          2.2,
          2.3,
          2.3,
          'rect',
        );
        pane(face, h, d, 0.04, 'door');
      }
    }
  }
  for (const [i, e] of edges(inner).entries()) {
    const r = [
        e.a,
        e.b,
        e.b.map((v, k) => v + e.normal[k] * 0.7),
        e.a.map((v, k) => v + e.normal[k] * 0.7),
      ],
      fs = fields.filter((h) => h.name.startsWith(`court-${i}-`));
    openFront(out, face, r, fs, d, 1.2, 8.2);
    const n = d === 0 ? 2 : Math.round(e.length / 5);
    for (let j = 0; j < n; j++) {
      const q = lerp(e.a, e.b, (j + 0.5) / n).map((v, k) => v + e.normal[k] * 2.75);
      capDome(face, q, 2.75, 8.2, 2.2, d === 0 ? 0 : d - 1, true);
    }
  }
}
function sideGalleries(out, face, d) {
  const fields = yeniSideArches(d);
  for (const side of [-1, 1]) {
    const z = side < 0 ? -23.8 : 26.5,
      back = side < 0 ? -16.8 : 18.7,
      r = rect(0.2, Math.min(z, back), 37, Math.max(z, back)),
      e = side < 0 ? [r[0], r[1]] : [r[2], r[3]],
      thin = [
        e[0],
        e[1],
        e[1].map((v, k) => v + (k === 1 ? -side * 0.7 : 0)),
        e[0].map((v, k) => v + (k === 1 ? -side * 0.7 : 0)),
      ];
    cap(face, r, 7, 'trim');
    cap(face, r, 13, 'roof');
    const fs = fields.filter((h) => h.name.startsWith(`side-${side}-`));
    if (d === 0) openFront(out, face, thin, [], d, 1.2, 13);
    else if (d === 1)
      for (const tier of [0, 1])
        openFront(
          out,
          face,
          thin,
          fs.filter((h) => h.name.startsWith(`side-${side}-${tier}-`)),
          d,
          tier === 0 ? 1.2 : 7,
          tier === 0 ? 7 : 13,
        );
    else {
      shell(out, d, thin, 1.2, 13, fs, 'wall');
      for (const h of fs) trimBand(face, h, 1, 0.18);
    }
    // Slab undersides close both floors from the street-facing view.
    for (const y of [6.8, 12.8])
      face(
        'trim',
        r.map((q) => at(q, y)),
        [0, -1, 0],
      );
    if (d >= 1) {
      band(face, r, 12.75, 0.25, 'door', 1.015);
      band(face, r, 6.75, 0.25, 'trim', 1.01);
    }
  }
}
function fountain(out, face, d) {
  const p = plans.fountain.center,
    r = circle(p, 2.3, 8),
    fields = yeniFountainFields(d);
  if (d < 2) {
    solid(face, r, 1.2, 5.0, 'trim');
    if (d === 1) for (const h of fields) pane(face, h, d, 0.04, 'glass');
  } else {
    shell(out, d, r, 1.2, 5, fields, 'trim');
    cap(face, r, 5, 'trim');
    finish(face, fields, d);
  }
  capDome(face, p, 2.55, 5, 1.9, d, true);
  if (d >= 1) finial(face, p, 6.9, d);
  if (d >= 2) {
    band(face, r, 4.65, 0.35, 'trim', 1.14);
    for (const e of edges(r)) beam(face, at(e.a, 1.2), at(e.a, 4.8), 0.2, 'trim');
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
  hall(out, face, d);
  domes(out, face, d);
  court(out, face, d);
  sideGalleries(out, face, d);
  fountain(out, face, d);
  for (const m of plans.minarets) minaret(face, m, d);
}
export const buildYeniSkyline = (o) => build(o, 0),
  buildYeniDistrict = (o) => build(o, 1),
  buildYeniStreet = (o) => build(o, 2),
  buildYeniCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const yeniStudy = {
  id: 'new_mosque',
  key: 'new_mosque',
  title: 'New Mosque',
  category: 'mosque',
  wikidataId: 'Q911720',
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
    'Five existing shared256² limestone,raw limestone,standing-seam metal,plain wood and bronze graphs;six material groups including local opaque glazing. Standing-seam abstracts lead roofing. Linear tints,metric UVs and faceted architecture;zero embedded images,unique facade bitmaps,baked lighting or copied inscriptions.',
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
    'Medium-fi exterior from three actually inspected2003/2009/2024 roof/courtyard/exterior pictures and standard viewer PMTiles/DEM. Internal dome/minaret/hall positions and all heights are picture estimates;whole,court and fountain retain current map controls. Four cascading semi-domes,two three-balcony towers,domed court/pointed arcade,domed octagonal grille fountain and two-storey side gallery are reconstructed. Fine muqarnas,calligraphy,grilles and carving abstracted or omitted. Opaque shallow glazing closes fields;no full interior/free-traversal claim. Separate royal pavilion,mausoleum,bazaar,streets,city and vegetation excluded. Precise stairs/approach/threshold/ground joins,current finish and physical-device timing remain unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('northwest-court-two-minarets', [-95, 65, 95], [-3, 18, 0]),
    cam('open-pointed-court', [-20, 11, 5], [-31, 6, -7]),
    cam('octagonal-domed-fountain', [-29, 10, -5], [-20.7, 5, 3]),
    cam('southwest-two-storey-gallery', [19, 18, 70], [16, 9, 24]),
    cam('three-balcony-minaret', [-35, 34, 66], [-5.2, 31, 23.3]),
    cam('roof-and-signed-plan', [0, 190, 0.1], [0, 17, 0]),
  ],
};

/** Djenné Great Mosque: three earth towers,toron and pointed buttresses. */
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
  '../../../content/worldgen/source/places/ef/efk/great_mosque_of_djenne/',
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
  wall: '#c3a078',
  wood: '#66513b',
  roof: '#bca17c',
  door: '#70533b',
  egg: '#e4dcc6',
  dark: '#44433e',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, djenneGround(...p) - 0.35);
export function djenneGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Djenné mosque footing outside retained terrain');
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
function _archBand(face, h, d, w = 0.45, slot = 'trim', offset = 0.08) {
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
  if (inner) cap(face, r, t, 'roof', [inner]);
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
const plans = rec.plans,
  roofY = plans.roofHeight;
const rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ],
  circle = (p, r, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (-i * Math.PI * 2) / n;
      return [p[0] + r * Math.cos(a), p[1] + r * Math.sin(a)];
    });
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
function chamfer(p, dx, dz, d) {
  if (d <= 1) return rect(p[0] - dx / 2, p[1] - dz / 2, p[0] + dx / 2, p[1] + dz / 2);
  const r = Math.min(dx, dz) * 0.15;
  return [
    [p[0] - dx / 2 + r, p[1] - dz / 2],
    [p[0] + dx / 2 - r, p[1] - dz / 2],
    [p[0] + dx / 2, p[1] - dz / 2 + r],
    [p[0] + dx / 2, p[1] + dz / 2 - r],
    [p[0] + dx / 2 - r, p[1] + dz / 2],
    [p[0] - dx / 2 + r, p[1] + dz / 2],
    [p[0] - dx / 2, p[1] + dz / 2 - r],
    [p[0] - dx / 2, p[1] - dz / 2 + r],
  ];
}
const hole = (name, center, axis, normal, width, bottom, height, kind = 'dark') => ({
  name,
  center,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring: height,
  shape: 'rect',
  depth: 2.8,
  kind,
  inset: 0.4,
});
function nearest(p, normal) {
  return edges(plans.outer)
    .filter((e) => e.normal[0] * normal[0] + e.normal[1] * normal[1] > 0.85)
    .sort(
      (a, b) =>
        Math.hypot(...lerp(a.a, a.b, 0.5).map((v, k) => v - p[k])) -
        Math.hypot(...lerp(b.a, b.b, 0.5).map((v, k) => v - p[k])),
    )[0];
}
const entrances = plans.entries.map((e) => {
  const edge = nearest(e.center, e.normal);
  return { ...e, center: lerp(edge.a, edge.b, 0.5), axis: edge.axis, normal: edge.normal };
});
export function djenneFields(d = 3) {
  if (!d) return [];
  const hs = [];
  for (const e of entrances)
    for (const j of e.paired ? [-1, 1] : [0])
      hs.push({
        ...hole(
          `entry-${e.name}-${j}`,
          e.center.map((v, k) => v + e.axis[k] * j * 0.9 + e.normal[k] * (d === 1 ? 0.1 : 0)),
          e.axis,
          e.normal,
          e.paired ? 1.25 : 1.8,
          0.05,
          6.6,
          'door',
        ),
        tall: true,
      });
  for (const [i, e] of edges(plans.outer).entries()) {
    if (e.length < 6) continue;
    const n = Math.max(1, Math.round(e.length / (d === 1 ? 10 : 4.4)));
    for (let j = 0; j < n; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / n);
      if (entrances.some((q) => Math.hypot(q.center[0] - p[0], q.center[1] - p[1]) < 3.3)) continue;
      // Air holes sit between structural piers, never inside their solid earth masses.
      if (
        buttresses.some(
          (b) =>
            Math.abs(p[0] - b.center[0]) < b.depth / 2 + 0.4 &&
            Math.abs(p[1] - b.center[1]) < b.width / 2 + 0.4,
        ) ||
        plans.towers.some(
          (t) =>
            Math.abs(p[0] - t.center[0]) < t.depth / 2 + 0.4 &&
            Math.abs(p[1] - t.center[1]) < t.width / 2 + 0.4,
        ) ||
        plans.cornerSpires.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1.1)
      )
        continue;
      for (const y of d === 1 ? [5.4] : [2.6, 5.4])
        hs.push(hole(`outer-vent-${i}-${j}-${y}`, p, e.axis, e.normal, 0.55, y, 0.75));
    }
  }
  for (const [i, e] of edges(plans.court).entries()) {
    const n = d === 1 ? 2 : Math.max(2, Math.round(e.length / 8));
    for (let j = 0; j < n; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / n);
      hs.push(
        hole(
          `court-field-${i}-${j}`,
          p,
          e.axis,
          e.normal.map((v) => -v),
          1.7,
          0.08,
          4.1,
          'door',
        ),
      );
    }
  }
  return hs;
}
function finish(face, fields, d) {
  for (const h of fields) {
    const offset = d === 1 ? 0.035 : -h.inset;
    pane(face, h, d, offset, h.tall ? 'dark' : h.kind === 'door' ? 'door' : 'dark');
    if (h.tall) pane(face, { ...h, height: 2.65, spring: 2.65 }, d, offset + 0.003, 'door');
  }
}
function spike(face, p, r, y, h, d, slot = 'wall') {
  profile(
    face,
    circle(p, r, d <= 1 ? 3 : d === 2 ? 4 : 6),
    d <= 1
      ? [
          [y, 1],
          [y + h, 0],
        ]
      : [
          [y, 1],
          [y + h * 0.65, 0.58],
          [y + h * 0.93, 0.22],
          [y + h, 0],
        ],
    slot,
  );
}
function towerLevels(t, d) {
  return d === 0
    ? [
        [0, 1],
        [t.height * 0.62, 0.76],
        [t.height * 0.77, 0.55],
        [t.height - 0.3, 0],
      ]
    : [
        [0, 1],
        [t.height * 0.58, 0.78],
        [t.height * 0.65, 0.76],
        [t.height * 0.69, 0.57],
        [t.height * 0.78, 0.57],
        [t.height * 0.81, 0.24],
        [t.height - 0.3, 0],
      ];
}
function towerRing(t, y, d) {
  const levels = towerLevels(t, d);
  let i = 1;
  while (i < levels.length - 1 && levels[i][0] < y) i++;
  const a = levels[i - 1],
    b = levels[i],
    f = a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
  return scaled(chamfer(t.center, t.depth, t.width, d), f);
}
export function djenneTowerFields(d = 3) {
  if (d < 2) return [];
  return plans.towers.flatMap((t) => {
    const y = roofY + 0.12,
      ring = towerRing(t, y + 1.1, d),
      e = edges(ring).find((e) => e.normal[0] < -0.9);
    return [
      {
        ...hole(
          `roof-tower-${t.name}`,
          lerp(e.a, e.b, 0.5),
          e.axis,
          e.normal,
          1.05,
          y,
          2.1,
          'door',
        ),
        inset: 0.36,
      },
    ];
  });
}
function clippedTower(out, face, t, d) {
  const fields = djenneTowerFields(d).filter((h) => h.name.endsWith(t.name)),
    hs = fields.map((h) => prepareOpening(h, 0, d)),
    cut = hs.length ? writer(masked(out, hs), d) : face;
  profile(cut, chamfer(t.center, t.depth, t.width, d), towerLevels(t, d), 'wall');
  for (const h of fields) {
    const r = openingShape(h, d),
      lo = r.map((q) => {
        const y = q[1] - floor,
          e = edges(towerRing(t, y, d)).find((e) => e.normal[0] < -0.9),
          x = (e.a[0] + e.b[0]) / 2;
        return [x, q[1], h.center[1] + q[0]];
      }),
      hi = lo.map((p) => [h.center[0] + h.inset, p[1], p[2]]);
    for (let i = 0; i < r.length; i++) {
      const j = (i + 1) % r.length;
      face('wall', [lo[i], lo[j], hi[j], hi[i]]);
    }
    face('door', hi, [-1, 0, 0]);
  }
  profile(
    face,
    circle(t.center, 0.14, d <= 1 ? 3 : 6),
    [
      [t.height - 0.3, 0.55],
      [t.height - 0.18, 1],
      [t.height - 0.05, 0.6],
      [t.height, 0],
    ],
    'egg',
  );
  if (d >= 1)
    for (const side of [-1, 1])
      spike(
        face,
        [t.center[0] - t.depth * 0.19, t.center[1] + side * t.width * 0.33],
        0.33,
        t.height * 0.7,
        t.height * 0.115,
        d,
      );
}
function peg(face, p, n, y, w, d) {
  const a = at(
      p.map((v, k) => v + n[k] * 0.02),
      y,
    ),
    b = at(
      p.map((v, k) => v + n[k] * (d === 1 ? 0.65 : 0.95)),
      y,
    );
  beam(face, a, b, w, 'wood', true);
}
function clearPeg(p, y, fields) {
  return !fields.some((h) => {
    const q = p.map((v, k) => v - h.center[k]);
    return (
      Math.abs(q[0] * h.axis[0] + q[1] * h.axis[1]) < h.width / 2 + 0.3 &&
      Math.abs(q[0] * h.normal[0] + q[1] * h.normal[1]) < 1.8 &&
      floor + y > h.bottom - 0.2 &&
      floor + y < h.bottom + h.height + 0.2
    );
  });
}
function toron(face, d) {
  if (!d) return;
  const fields = djenneFields(d);
  for (const e of edges(plans.outer)) {
    if (e.length < 2.2) continue;
    const n = Math.max(1, Math.floor(e.length / (d === 1 ? 5 : d === 2 ? 2.5 : 1.5)));
    for (let j = 0; j < n; j++) {
      const p = lerp(e.a, e.b, (j + 0.5) / n);
      for (const y of d === 1 ? [5.3] : d === 2 ? [4.2, 6.2] : [3.8, 5.0, 6.2, 7.0])
        if (clearPeg(p, y, fields)) peg(face, p, e.normal, y, 0.16, d);
    }
  }
  for (const t of plans.towers) {
    const ys =
      d === 1
        ? [6, 9, 11]
        : d === 2
          ? [3.7, 5.2, 6.7, 8.2, 9.7, 11.1]
          : [2.5, 3.65, 4.8, 5.95, 7.1, 8.25, 9.4, 10.5, 11.4];
    for (const y of ys) {
      if (y > t.height * 0.79) continue;
      for (const e of edges(towerRing(t, y, d))) {
        if (e.length < 1.2) continue;
        const n = d === 1 ? 2 : d === 2 ? 3 : Math.max(2, Math.round(e.length / 0.95));
        for (let j = 0; j < n; j++) {
          const p = lerp(e.a, e.b, (j + 0.5) / n);
          if (clearPeg(p, y, djenneTowerFields(d))) peg(face, p, e.normal, y, 0.15, d);
        }
      }
    }
  }
}
function frontX(z) {
  const xs = [];
  for (const e of edges(plans.outer)) {
    if (e.a[1] > z !== e.b[1] > z) {
      const t = (z - e.a[1]) / (e.b[1] - e.a[1]);
      xs.push(e.a[0] + (e.b[0] - e.a[0]) * t);
    }
  }
  return Math.max(...xs);
}
const buttresses = [];
for (const z of plans.frontButtresses) {
  const x = frontX(z);
  buttresses.push({ center: [x + 0.18, z], depth: 1.65, width: 1.5, height: 9.55, front: true });
}
for (const [i, e] of edges(plans.outer).entries()) {
  if (e.normal[0] > 0.4 || e.length < 7) continue;
  const n = Math.max(1, Math.round(e.length / 3.1));
  for (let j = 0; j < n; j++) {
    const p = lerp(e.a, e.b, (j + 0.5) / n);
    if (entrances.some((q) => Math.hypot(q.center[0] - p[0], q.center[1] - p[1]) < 3.4)) continue;
    buttresses.push({
      center: p.map((v, k) => v + e.normal[k] * 0.2),
      depth: Math.abs(e.normal[0]) > 0.8 ? 1.3 : 1.5,
      width: Math.abs(e.normal[0]) > 0.8 ? 1.5 : 1.3,
      height: 8.8,
      edge: i,
    });
  }
}
function supports(face, d) {
  for (const [i, b] of buttresses.entries()) {
    if (d === 0 && !b.front && i % 3) continue;
    const ring = chamfer(b.center, b.depth, b.width, d);
    profile(
      face,
      ring,
      d <= 1
        ? [
            [0, 1],
            [7.3, 0.72],
            [b.height, 0],
          ]
        : [
            [0, 1],
            [6.8, 0.74],
            [7.8, 0.7],
            [b.height - 0.35, 0.23],
            [b.height, 0],
          ],
      'wall',
    );
  }
  for (const p of plans.cornerSpires) spike(face, p, 0.72, 0, 11.2, d);
}
function parapets(face, d) {
  for (const [inner, r] of [
    [false, plans.outer],
    [true, plans.court],
  ])
    for (const [i, e] of edges(r).entries()) {
      if (!inner && e.normal[0] > 0.4) continue;
      const n = Math.max(1, Math.round(e.length / (d === 0 ? 6.6 : d === 1 ? 3.7 : 2.2)));
      for (let j = 0; j < n; j++) {
        const p = lerp(e.a, e.b, (j + 0.5) / n);
        if (
          !inner &&
          plans.towers.some((t) => Math.hypot(t.center[0] - p[0], t.center[1] - p[1]) < 5)
        )
          continue;
        spike(face, p, d <= 1 ? 0.42 : 0.48, roofY, 1.45 + ((i + j) % 3) * 0.12, d);
      }
    }
}
function roofVents(face, d) {
  if (!d) return;
  let k = 0;
  for (const x of plans.ventGrid.xs)
    for (const z of plans.ventGrid.zs) {
      if (d === 1 && k++ % 4) continue;
      const p = [x, z],
        n = d === 1 ? 4 : 6;
      profile(
        face,
        circle(p, 0.45, n),
        [
          [roofY, 1],
          [roofY + 0.32, 0.45],
          [roofY + 0.34, 0.4],
        ],
        'roof',
      );
      profile(
        face,
        circle(p, 0.24, n),
        [
          [roofY + 0.34, 1],
          [roofY + 0.45, 0],
        ],
        'roof',
      );
    }
}
function gates(out, face, d) {
  for (const e of entrances) {
    const p = e.center,
      r = [
        [-e.width / 2, 0.1],
        [e.width / 2, 0.1],
        [e.width / 2, -0.95],
        [-e.width / 2, -0.95],
      ].map(([u, n]) => p.map((v, k) => v + e.axis[k] * u + e.normal[k] * n)),
      fields = djenneFields(d).filter((h) => h.name.startsWith(`entry-${e.name}`));
    shell(out, d, r, 0, 8.7, d >= 2 ? fields : [], 'wall');
    cap(face, r, 8.7, 'wall');
    for (let j = 0; j < (d === 0 ? 2 : 5); j++) {
      const q = p.map((v, k) => v + e.axis[k] * ((j / ((d === 0 ? 2 : 5) - 1) - 0.5) * e.width));
      spike(face, q, 0.35, 8.7, 1.0, d);
    }
  }
}
function stairs(face, d) {
  for (const e of entrances) {
    const top = e.center.map((v, k) => v + e.normal[k] * 0.12),
      bottom = top.map((v, k) => v + e.normal[k] * 5.3),
      low = djenneGround(...bottom) + 0.12,
      count =
        d === 0 ? 1 : d === 1 ? 3 : d === 2 ? 7 : Math.max(7, Math.ceil((floor - low) / 0.21)),
      width = e.width + 1.1;
    for (let i = 0; i < count; i++) {
      const a = lerp(top, bottom, i / count),
        b = lerp(top, bottom, (i + 1) / count),
        r = [
          a.map((v, k) => v - (e.axis[k] * width) / 2),
          a.map((v, k) => v + (e.axis[k] * width) / 2),
          b.map((v, k) => v + (e.axis[k] * width) / 2),
          b.map((v, k) => v - (e.axis[k] * width) / 2),
        ],
        y = floor + ((low - floor) * (i + 1)) / count;
      solid(face, r, (p) => Math.min(djenneGround(...p) - 0.2, y - 0.2), y - floor, 'wall');
    }
    if (d >= 1)
      for (const side of [-1, 1]) {
        const a = top.map((v, k) => v + e.axis[k] * side * (width / 2 + 0.3)),
          b = bottom.map((v, k) => v + e.axis[k] * side * (width / 2 + 0.3)),
          r = [
            a.map((v, k) => v - e.axis[k] * 0.3),
            a.map((v, k) => v + e.axis[k] * 0.3),
            b.map((v, k) => v + e.axis[k] * 0.3),
            b.map((v, k) => v - e.axis[k] * 0.3),
          ];
        solid(
          face,
          r,
          (p) => djenneGround(...p) - 0.2,
          (p) => {
            const t = ((p[0] - top[0]) * e.normal[0] + (p[1] - top[1]) * e.normal[1]) / 5.3;
            return floor + (low - floor) * t + 0.85;
          },
          'wall',
        );
        spike(face, a, 0.3, 0, 1.65, d);
      }
  }
}
function body(out, face, d) {
  const fields = djenneFields(d);
  // The observed raised plinth supports projecting earth piers outside the mapped wall line.
  const middle = [0, 1].map(
    (k) =>
      (Math.min(...plans.outer.map((p) => p[k])) + Math.max(...plans.outer.map((p) => p[k]))) / 2,
  );
  const plinth = plans.outer.map((p) => p.map((v, k) => middle[k] + (v - middle[k]) * 1.05));
  solid(face, plinth, footing, 0.035, 'wall');
  shell(out, d, plans.outer, 0, roofY, d >= 2 ? fields : [], 'wall', plans.court);
  finish(face, fields, d);
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const points = a[2].map((p) => p.map(Math.fround));
        function emit(p, uv) {
          let longest = 0,
            k = 0;
          for (let i = 0; i < 3; i++) {
            const length = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (length > longest) {
              longest = length;
              k = i;
            }
          }
          if (longest > (d === 0 ? 25 : d === 1 ? 18 : 12)) {
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
        emit(points, a[4]);
      },
    },
    face = writer(out, d);
  body(out, face, d);
  supports(face, d);
  gates(out, face, d);
  parapets(face, d);
  roofVents(face, d);
  stairs(face, d);
  for (const t of plans.towers) clippedTower(out, face, t, d);
  toron(face, d);
}
export const buildDjenneSkyline = (o) => build(o, 0),
  buildDjenneDistrict = (o) => build(o, 1),
  buildDjenneStreet = (o) => build(o, 2),
  buildDjenneCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const djenneStudy = {
  id: 'great_mosque_of_djenne',
  key: 'great_mosque_of_djenne',
  title: 'Great Mosque of Djenné',
  category: 'mosque',
  wikidataId: 'Q683632',
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
    'Two existing shared256² plaster and plain timber graphs;six semantic groups. Earth-colored walls/roof and pale egg-like finials share neutral plaster;timber pegs and doors share wood. Smooth plaster represents the observed coating without exposed brick joints. Metric UVs,linear tints,no embedded images,baked lighting,unique artwork or copied inscriptions.',
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
    'Individual medium-fi exterior from four inspected1972/1990/2005/2007 facade,roof and entrance pictures plus standard viewer PMTiles/DEM. Three tapered stepped towers/conical tips/pale finials,pointed buttresses and parapets,timber toron,flat roof vent lids,mapped open courtyard and selected paired rectangular entry fields/cheek-walled stairs. Exact peg/vent count,current annual plaster finish,courtyard elevations,unseen faces,fine ornament and actual interiors simplified or unverified. Door/vent fields terminate closed;courtyard is exterior open space,no enclosed-interior or free traversal claim. Nominal75m dimensions do not rescale60m map footprint. Ground/stair/threshold joins,altitude,walking and physical-device timing unverified. Neighboring city/market assets excluded.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('three-qibla-towers', [96, 29, -62], [20, 7, 0]),
    cam('paired-gate-and-earthen-stairs', [1.5, 9, -49], [1.5, 7, -27]),
    cam('roof-toron-and-vent-lids', [29, 23, 22], [17, 10, 0]),
    cam('mapped-open-west-courtyard', [-15, 75, 0], [-15, 2, 0]),
    cam('stepped-tower-shoulders', [45, 23, -6], [24, 12, -2]),
    cam('signed-plan-and-roof', [0, 145, 0.1], [0, 5, 0]),
  ],
};

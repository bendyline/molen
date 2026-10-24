/** Qol Şärif Mosque: six minarets,turquoise dome,petal collar and pointed gables. */
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
  '../../../content/worldgen/source/places/v1/v1f/qol_sarif_mosque/',
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
  wall: '#e6e4db',
  trim: '#ece7db',
  podiumroof: '#7c5a51',
  roof: '#79bdcf',
  dome: '#72b7cb',
  gold: '#d9ba66',
  door: '#83715c',
  glass: '#51677b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, qolGround(...p) - 0.35);
export function qolGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Qol Şärif Mosque footing outside retained terrain');
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
function _solid(face, r, b, t, slot) {
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
        [(prev[k][0] + prev[j][0]) / 2 - origin[0], 0, (prev[k][1] + prev[j][1]) / 2 - origin[1]],
      );
    }
    prev = r;
  }
  cap(face, prev, levels.at(-1)[0], slot);
}
const _rect = (x, z, w, h) => [
    [x - w / 2, z - h / 2],
    [x + w / 2, z - h / 2],
    [x + w / 2, z + h / 2],
    [x - w / 2, z + h / 2],
  ],
  circle = (p, r, n) =>
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
  const p = [...r, ...holes.flat()],
    starts = [];
  let n = r.length;
  for (const h of holes) {
    starts.push(n);
    n += h.length;
  }
  const ids = earcut(p.flat(), starts, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(p[k], y)),
      [0, -1, 0],
    );
}
function panel(face, h, d, width, bottom, top, slot, offset = 0) {
  const r = openingShape(h, d),
    p = [
      [-width / 2, floor + bottom],
      [width / 2, floor + bottom],
      [width / 2, floor + top],
      [-width / 2, floor + top],
      ...r,
    ],
    ids = earcut(p.flat(), [4], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], offset)),
      [h.normal[0], 0, h.normal[1]],
    );
}
function reveal(face, h, d, front, back, slot = 'wall') {
  const r = openingShape(h, d),
    sg = sign(r);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      du = b[0] - a[0],
      dy = b[1] - a[1];
    face(
      slot,
      [point(h, ...a, front), point(h, ...b, front), point(h, ...b, back), point(h, ...a, back)],
      [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
    );
  }
}
const plans = rec.plans,
  mainEdges = edges(plans.corners),
  front = mainEdges[0];
export function qolMainFields(d = 3) {
  if (d === 0) return [];
  return mainEdges.flatMap((e, i) =>
    [-1, 1].map((s) => ({
      ...field(
        `main-${i}-${s}`,
        e.center.map((v, k) => v + e.axis[k] * s * e.length * 0.23),
        e.axis,
        e.normal,
        4.5,
        10.2,
        17.2,
        9.6,
        0.95,
      ),
      edge: i,
    })),
  );
}
export function qolBaseFields(d = 3) {
  if (d === 0) return [];
  return edges(plans.outer).flatMap((e, i) => {
    if (e.length < 2.5) return [];
    const n = Math.max(1, Math.floor(e.length / (d === 1 ? 5.5 : 3.5))),
      step = e.length / n;
    return [1.0, 5.0].flatMap((y, row) =>
      Array.from({ length: n }, (_, j) => ({
        ...field(
          `podium-${i}-${row}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / n),
          e.axis,
          e.normal,
          Math.min(1.7, step * 0.55),
          y,
          row === 0 ? 2 : 1.5,
          0,
          0.65,
        ),
        shape: 'rect',
      })),
    );
  });
}
export function qolPortico() {
  const center = front.center.map((v, k) => v + front.normal[k] * 3.5);
  return {
    ...field('upper-entry', center, front.axis, front.normal, 5.4, 8, 10.2, 6.0, 5.0),
    frameWidth: 9,
    back: 5.0,
  };
}
const quad = (h, u0, u1, y0, y1, dep, face, slot) =>
  face(
    slot,
    [point(h, u0, y0, dep), point(h, u1, y0, dep), point(h, u1, y1, dep), point(h, u0, y1, dep)],
    [h.normal[0], 0, h.normal[1]],
  );
function mainBody(out, face, d) {
  const fields = qolMainFields(d),
    door = qolPortico(),
    cuts = [...fields, door].map((h) =>
      prepareOpening(
        {
          ...h,
          center:
            h.name === 'upper-entry' ? h.center.map((v, k) => v - h.normal[k] * 2.5) : h.center,
          depth: h.name === 'upper-entry' ? 6 : 1.1,
        },
        0,
        d,
      ),
    ),
    body = writer(masked(out, cuts), d);
  sides(body, plans.core, 8, 22.5, 'wall');
  const inner = [];
  for (const e of mainEdges) {
    const h = { ...field('gable', e.center, e.axis, e.normal, e.length, 0, 31, 22.5, 1) },
      ring = openingShape(h, d).slice(2),
      p = [point(e, -e.length / 2, floor + 22.5), ...ring.map((q) => point(e, ...q))];
    body('wall', p, [e.normal[0], 0, e.normal[1]]);
    const roof = ring.map((q) => {
      const p = point(e, ...q),
        dx = p[0] - plans.mainDome.center[0],
        dz = p[2] - plans.mainDome.center[1],
        r = Math.hypot(dx, dz);
      return {
        outer: p,
        inner: [
          plans.mainDome.center[0] + (dx / r) * 8.4,
          floor + 31,
          plans.mainDome.center[1] + (dz / r) * 8.4,
        ],
      };
    });
    for (let i = 0; i < roof.length - 1; i++) {
      face('roof', [roof[i].outer, roof[i + 1].outer, roof[i + 1].inner, roof[i].inner], [0, 1, 0]);
    }
    inner.push(
      ...roof
        .toReversed()
        .slice(0, -1)
        .map((q) => [q.inner[0], q.inner[2]]),
    );
  }
  cap(face, inner, 31, 'roof');
  if (d === 0) {
    for (const [i, e] of mainEdges.entries())
      for (const s of [-1, 1]) {
        const h = field(
          `far-main-${i}-${s}`,
          e.center.map((v, k) => v + e.axis[k] * s * e.length * 0.23),
          e.axis,
          e.normal,
          4.5,
          10.2,
          17.2,
          9.6,
          0.5,
        );
        pane(face, h, d, 0.035, 'glass');
      }
  } else
    for (const h of fields) {
      reveal(face, h, d, 0, -0.46, 'trim');
      pane(face, h, d, -0.47, 'glass');
      if (d > 1) {
        archBand(face, h, d, 0.45, 'trim', 0.07);
        beam(
          face,
          point(h, 0, h.bottom + 0.2, -0.35),
          point(h, 0, h.bottom + h.height - 0.6, -0.35),
          0.18,
          'door',
        );
        for (const y of [15.5, 19, 22.8])
          quad(h, -1.85, 1.85, floor + y - 0.08, floor + y + 0.08, -0.32, face, 'door');
      }
    }
}
function podium(out, face, d) {
  const fields = qolBaseFields(d),
    body = writer(masked(out, d === 1 ? [] : fields.map((h) => prepareOpening(h, 0, d))), d);
  sides(face, plans.outer, footing, 0, 'wall');
  cap(face, plans.outer, 0, 'trim');
  sides(body, plans.outer, 0, 8, 'wall');
  cap(face, plans.outer, 8, 'podiumroof');
  for (const h of fields) {
    if (d === 1) {
      pane(face, h, d, 0.025, 'glass');
      continue;
    }
    reveal(face, h, d, 0, -0.25, 'trim');
    pane(face, h, d, -0.27, 'glass');
    if (d > 1) archBand(face, h, d, 0.13, 'trim', 0.025);
  }
  if (d > 0) {
    for (const y of [0.25, 4.2, 7.5]) {
      const r = scaled(plans.outer, 1.004);
      sides(face, r, y, y + 0.22, 'trim');
      cap(face, r, y + 0.22, 'trim', [plans.outer]);
    }
  }
}
function crescent(face, p, top, r, d) {
  const stem = circle(p, 0.08, d === 0 ? 4 : 6);
  profile(
    face,
    stem,
    d < 2
      ? [
          [top - r * 2, 1],
          [top, 0.015],
        ]
      : [
          [top - r * 2, 1],
          [top - r, 1],
          [top - r, 0.015],
        ],
    'gold',
    p,
  );
  if (d < 2) return;
  const n = d === 2 ? 6 : 10,
    angles = Array.from({ length: n + 1 }, (_, i) => Math.PI / 3 + ((i / n) * Math.PI * 4) / 3)
      .concat([Math.PI / 2, Math.PI * 1.5])
      .sort((a, b) => a - b),
    P = (a, R, t) => [
      p[0] + plans.u[0] * Math.cos(a) * R + plans.v[0] * t,
      floor + top - r + Math.sin(a) * R,
      p[1] + plans.u[1] * Math.cos(a) * R + plans.v[1] * t,
    ],
    half = 0.07;
  for (let i = 0; i < angles.length - 1; i++) {
    const a = angles[i],
      b = angles[i + 1];
    if (b - a < 1e-8) continue;
    for (const t of [-half, half])
      face(
        'gold',
        [P(a, r, t), P(b, r, t), P(b, r * 0.65, t), P(a, r * 0.65, t)],
        [plans.v[0] * Math.sign(t), 0, plans.v[1] * Math.sign(t)],
      );
    face('gold', [P(a, r, -half), P(b, r, -half), P(b, r, half), P(a, r, half)]);
    face('gold', [
      P(a, r * 0.65, half),
      P(b, r * 0.65, half),
      P(b, r * 0.65, -half),
      P(a, r * 0.65, -half),
    ]);
  }
  for (const a of [angles[0], angles.at(-1)])
    face(
      'gold',
      [P(a, r, -half), P(a, r, half), P(a, r * 0.65, half), P(a, r * 0.65, -half)],
      [
        -plans.u[0] * Math.sin(a) * (a === angles[0] ? -1 : 1),
        Math.cos(a) * (a === angles[0] ? -1 : 1),
        -plans.u[1] * Math.sin(a) * (a === angles[0] ? -1 : 1),
      ],
    );
}
export function qolGalleryFields(p, d = 3) {
  if (d === 0) return [];
  const base = p.small ? 29.2 : 45.1,
    height = p.small ? 2.4 : 4.5,
    N = d === 1 ? 4 : 8,
    r = circle(p.center, p.radius * 1.08, N);
  return edges(r).map((e, i) => ({
    ...field(
      `gallery-${p.id}-${i}`,
      e.center,
      e.axis,
      e.normal,
      e.length * 0.65,
      base + 0.12,
      height - 0.35,
      (height - 0.35) * 0.61,
      0.55,
    ),
    step: e.length,
    base,
    top: base + height,
  }));
}
function tower(face, p, d) {
  const n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : d === 3 ? 16 : 20,
    r = circle(p.center, p.radius, n),
    base = p.small ? 29.2 : 45.1;
  profile(
    face,
    r,
    p.small
      ? [
          [8, 0.78],
          [27, 0.78],
          [28.6, 0.94],
          [base, 1.12],
        ]
      : [
          [8, 0.78],
          [42.5, 0.78],
          [43.8, 0.94],
          [44.4, 1.18],
          [base, 1.12],
        ],
    'wall',
    p.center,
  );
  if (d === 0) {
    sides(face, circle(p.center, p.radius * 0.94, n), base, p.small ? 31.6 : 49.6, 'wall');
  } else {
    const fs = qolGalleryFields(p, d);
    for (const h of fs) {
      panel(face, h, d, h.step, h.base, h.top, 'wall');
      reveal(face, h, d, 0, -0.28, 'wall');
      if (d > 1) archBand(face, h, d, 0.12, 'trim', 0.04);
    }
    profile(
      face,
      circle(p.center, p.radius * 0.48, n),
      [
        [base, 1],
        [p.small ? 31.6 : 49.6, 1],
      ],
      'door',
      p.center,
    );
    const floorRing = circle(p.center, p.radius * 1.14, n);
    cap(face, floorRing, base, 'trim');
    down(face, floorRing, base - 0.15, 'trim');
  }
  const topGallery = p.small ? 31.6 : 49.6,
    capRing = circle(p.center, p.radius * 1.2, n);
  down(face, capRing, topGallery, 'roof');
  if (d === 0)
    profile(
      face,
      capRing,
      p.small
        ? [
            [31.6, 1],
            [34.45, 0.025],
          ]
        : [
            [49.6, 1],
            [51.3, 0.7],
            [57.2, 0.035],
          ],
      'roof',
      p.center,
    );
  else if (p.small)
    profile(
      face,
      capRing,
      [
        [31.6, 1],
        [32, 0.74],
        [32.8, 0.7],
        [33.8, 0.4],
        [34.45, 0.04],
      ],
      'roof',
      p.center,
    );
  else
    profile(
      face,
      capRing,
      [
        [49.6, 1],
        [50.0, 0.73],
        [51.3, 0.7],
        [51.6, 0.81],
        [57.2, 0.035],
      ],
      'roof',
      p.center,
    );
  crescent(face, p.center, p.top, p.small ? 0.25 : 0.4, d);
  if (d > 1) {
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        q = p.center.map((v, k) => v + (k === 0 ? Math.cos(a) : Math.sin(a)) * p.radius * 0.78);
      beam(face, at(q, 8.3), at(q, p.small ? 27 : 42.5), 0.15, 'trim');
    }
  }
}
function petal(face, h, d) {
  const w = 0.6;
  archBand(face, h, d, w, 'trim', 0.12);
  archBand(
    (s, p, n) =>
      face(
        s,
        p,
        n.map((v) => -v),
      ),
    h,
    d,
    w,
    'trim',
    -0.12,
  );
  reveal(face, h, d, 0.12, -0.12, 'trim');
  reveal(
    (s, p, n) =>
      face(
        s,
        p,
        n.map((v) => -v),
      ),
    {
      ...h,
      width: h.width + w * 2,
      height: h.height + w * 2,
      bottom: h.bottom - w,
      spring: h.spring + w,
    },
    d,
    0.12,
    -0.12,
    'trim',
  );
}
function dome(face, d) {
  const p = plans.mainDome,
    n = d === 0 ? 8 : d === 1 ? 12 : d === 2 ? 20 : d === 3 ? 28 : 32,
    r = circle(p.center, p.radius, n);
  profile(
    face,
    r,
    d === 0
      ? [
          [31, 1],
          [35, 0.9],
          [38.4, 0.025],
        ]
      : [
          [31, 1],
          [32.5, 1.02],
          [34.5, 0.95],
          [36.5, 0.72],
          [38, 0.33],
          [38.4, 0.025],
        ],
    'dome',
    p.center,
  );
  if (d === 0) {
    const inner = circle(p.center, p.radius * 1.04, 8);
    sides(face, inner, 31, 32, 'trim');
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        h = {
          center: p.center.map((v, k) => v + (k === 0 ? Math.cos(a) : Math.sin(a)) * 8.5),
          axis: [-Math.sin(a), Math.cos(a)],
          normal: [Math.cos(a), Math.sin(a)],
        };
      face(
        'trim',
        [point(h, -1.1, floor + 31.7), point(h, 1.1, floor + 31.7), point(h, 0, floor + 34)],
        [h.normal[0], 0, h.normal[1]],
      );
    }
  } else
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        h = field(
          `petal-${i}`,
          p.center.map((v, k) => v + (k === 0 ? Math.cos(a) : Math.sin(a)) * 8.5),
          [-Math.sin(a), Math.cos(a)],
          [Math.cos(a), Math.sin(a)],
          3.2,
          31.4,
          2.5,
          1.0,
          0.5,
        );
      petal(face, h, d);
    }
  crescent(face, p.center, 39, 0.3, d);
}
function portico(face, d) {
  const h = qolPortico(),
    outer = [
      [-4.5, 8],
      [4.5, 8],
      [4.5, 19.1],
      [-4.5, 19.1],
    ],
    opening = openingShape(h, d),
    p = [...outer.map(([u, y]) => [u, floor + y]), ...opening],
    ids = earcut(p.flat(), [outer.length], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      'trim',
      ids.slice(i, i + 3).map((k) => point(h, ...p[k], 0.05)),
      [h.normal[0], 0, h.normal[1]],
    );
  reveal(face, h, d, 0.05, -5, 'trim');
  pane(face, h, d, -5.02, 'door');
  if (d > 0) archBand(face, h, d, 0.4, 'trim', 0.1);
  for (const s of [-1, 1])
    face(
      'wall',
      [
        point(h, s * 4.5, floor + 8, 0.05),
        point(h, s * 4.5, floor + 8, -5),
        point(h, s * 4.5, floor + 19.1, -5),
        point(h, s * 4.5, floor + 19.1, 0.05),
      ],
      [h.axis[0] * s, 0, h.axis[1] * s],
    );
  face(
    'roof',
    [
      point(h, -4.5, floor + 19.1, 0.05),
      point(h, -4.5, floor + 19.1, -5),
      point(h, 4.5, floor + 19.1, -5),
      point(h, 4.5, floor + 19.1, 0.05),
    ],
    [0, 1, 0],
  );
  if (d > 0)
    for (const s of [-1, 1]) {
      const p = point(h, s * 4.3, 0, 0.1),
        q = [p[0], p[2]];
      profile(
        face,
        circle(q, 0.45, d === 1 ? 4 : 8),
        [
          [19.1, 1],
          [20, 1],
          [21.1, 0.45],
          [22.7, 0.04],
        ],
        'gold',
        q,
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
    face = writer(out, d);
  podium(out, face, d);
  mainBody(out, face, d);
  for (const p of [...plans.towers, ...plans.turrets]) tower(face, p, d);
  dome(face, d);
  portico(face, d);
}
export const buildQolSkyline = (o) => build(o, 0),
  buildQolDistrict = (o) => build(o, 1),
  buildQolStreet = (o) => build(o, 2),
  buildQolCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const qolStudy = {
  id: 'qol_sarif_mosque',
  key: 'qol_sarif_mosque',
  title: 'Qol Şärif Mosque',
  category: 'mosque',
  wikidataId: 'Q121198',
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
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256² limestone,standing-seam metal,mosaic,plain wood and bronze graphs;eight material groups. Pale walls/trim,turquoise-blue roofs/dome and sparse gold finials use metric UVs/linear tints. Retained whole roof colour#7C5A51 used on low podium roof only;upper blue follows pictures. Zero embedded images,baked lighting/weathering or copied inscriptions/carvings.',
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
    'Nine tagged controls locate the8m podium,31m main body,31–39m dome,four58m minarets and two35m turrets. Four inspected2014/2017 pictures guide pointed gables,paired tall lancets,blue folded roof/white petal collar,faceted shafts/pointed gallery heads,lanterns/spires/crescents and upper entry portico/gold pinnacles. Untagged profiles,portico/facade facing,subdivisions and roof material/current finish are estimates. Gallery apertures look into closed dark central cores;windows and entry doors close before interiors. Skyline uses solid gallery heads,closed glazing proxies,simple petal teeth,coarse blue caps and finial rods;district opens coarse heads and uses flat podium glazing proxies,near levels add recessed podium windows,selected mullions/flutes/trim and crescents. Fine inscriptions/carvings,exact motifs,railings and unseen roofs/rooms/stairs unverified or omitted. Detached blue pavilion,curved approaches and neighbouring Kremlin ranges remain host context. Exact datum/podium/ramp/threshold contacts,walking,engineering and physical-device performance unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('four-minarets-and-blue-dome', [52, 36, 65], [0, 32, 0]),
    cam('pointed-glazing-and-portico', [27, 18, 45], [3, 18, 8]),
    cam('white-petal-collar', [25, 41, 31], [0, 34, 0]),
    cam('pointed-minaret-head', [-30, 50, -27], [-15.7, 49, -7]),
    cam('rounded-podium-windows', [37, 9, 33], [13, 7, 12]),
    cam('mapped-nine-part-plan', [0, 180, 0.1], [0, 20, 0]),
  ],
};

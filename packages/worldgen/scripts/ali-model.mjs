/** Imam Ali Shrine: gold dome, twin minarets, gilded iwan and mapped historic court. */
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
  '../../../content/worldgen/source/places/sv/svx/imam_ali_mosque/',
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
  wall: '#d3c19e',
  trim: '#ddd6c6',
  roof: '#c4c0b6',
  gold: '#e6bb58',
  tile: '#789bb4',
  door: '#746650',
  glass: '#52636b',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, aliGround(...p) - 0.35);
export function aliGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Imam Ali Mosque footing outside retained terrain');
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
const plans = rec.plans;
const rect = (x, z, w, h) => [
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
function down(face, r, y, slot) {
  const ids = earcut(r.flat(), [], 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      slot,
      ids.slice(i, i + 3).map((k) => at(r[k], y)),
      [0, -1, 0],
    );
}
function slab(face, r, y, h, slot) {
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
    face(
      slot,
      [point(h, ...a, front), point(h, ...b, front), point(h, ...b, back), point(h, ...a, back)],
      [-dy * h.axis[0] * sg, du * sg, -dy * h.axis[1] * sg],
    );
  }
}
export function aliPortals(_d = 3) {
  return ['iwan', 'gate'].map((k) => {
    const p = plans[k];
    return {
      ...p,
      frameWidth: p.width,
      ...field(
        p.name,
        p.center,
        p.axis,
        p.normal,
        p.openingWidth,
        0.15,
        p.openingHeight,
        p.spring,
        p.depth,
      ),
      passage: k === 'gate',
    };
  });
}
function portal(face, h, d) {
  const main = !h.passage,
    slot = main ? 'gold' : 'tile',
    front = 0,
    back = -h.depth;
  panel(face, h, d, h.frameWidth, 0, h.top, slot, front);
  reveal(face, h, d, front, back, main ? 'gold' : 'wall');
  if (main)
    face(
      'gold',
      openingShape(h, d).map((p) => point(h, ...p, back)),
      [h.normal[0], 0, h.normal[1]],
    );
  else {
    const rear = {
      ...h,
      center: h.center.map((v, k) => v - h.normal[k] * h.depth),
      normal: h.normal.map((v) => -v),
    };
    panel(face, rear, d, h.frameWidth, 0, h.top, 'tile');
  }
  const p = (u, y, t) => point(h, u, floor + y, t);
  if (main) {
    face(
      'wall',
      [
        p(-h.frameWidth / 2, 0, back - 0.35),
        p(h.frameWidth / 2, 0, back - 0.35),
        p(h.frameWidth / 2, h.top, back - 0.35),
        p(-h.frameWidth / 2, h.top, back - 0.35),
      ],
      [0, 0, 1],
    );
  }
  for (const s of [-1, 1])
    face(
      slot,
      [
        p((s * h.frameWidth) / 2, 0, front),
        p((s * h.frameWidth) / 2, 0, back),
        p((s * h.frameWidth) / 2, h.top, back),
        p((s * h.frameWidth) / 2, h.top, front),
      ],
      [h.axis[0] * s, 0, h.axis[1] * s],
    );
  face(
    main ? 'gold' : 'roof',
    [
      p(-h.frameWidth / 2, h.top, front),
      p(h.frameWidth / 2, h.top, front),
      p(h.frameWidth / 2, h.top, back - 0.35),
      p(-h.frameWidth / 2, h.top, back - 0.35),
    ],
    [0, 1, 0],
  );
  if (d > 0) {
    archBand(face, h, d, main ? 0.48 : 0.38, 'trim', 0.07);
    const r = rect(
      h.center[0],
      h.center[1] + h.normal[1] * (main ? 0.6 : 0.1),
      h.frameWidth + (main ? 1.1 : 0.5),
      main ? 1.6 : 0.8,
    );
    slab(face, r, h.top - 0.15, 0.32, main ? 'gold' : 'trim');
    if (main) {
      const door = {
        ...h,
        center: h.center.map((v, k) => v - h.normal[k] * (h.depth - 0.025)),
        width: 3.8,
        bottom: floor + 0.35,
        height: 5.2,
        spring: 3.1,
      };
      pane(face, door, d, 0.02, 'door');
      archBand(face, door, d, 0.3, 'trim', 0.05);
      for (const u of [-8.7, 8.7])
        for (const y of [2.2, 10.2]) {
          const q = {
            ...h,
            center: h.center.map((v, k) => v + h.axis[k] * u),
            width: 1.1,
            bottom: floor + y,
            height: 2.2,
            spring: 1.2,
          };
          pane(face, q, d, 0.045);
          archBand(face, q, d, 0.18, 'tile', 0.06);
        }
      if (d > 1)
        for (let row = 0; row < (d === 2 ? 2 : 3); row++) {
          const n = 3 - row,
            y = 7.8 + row * 2.4,
            w = 2.4 - row * 0.3;
          for (let j = 0; j < n; j++) {
            const u = (j - (n - 1) / 2) * (w + 0.3),
              r = [
                [u - w / 2, y],
                [u + w / 2, y],
                [u + w * 0.45, y + 1.1],
                [u, y + 2.2],
                [u - w * 0.45, y + 1.1],
              ],
              tip = p(u, y + 0.7, back + 0.8 + row * 0.16);
            for (let k = 0; k < r.length; k++)
              face('gold', [
                p(...r[k], back + 0.06),
                p(...r[(k + 1) % r.length], back + 0.06),
                tip,
              ]);
          }
        }
    }
  }
}
const courtEdges = new Set([0, 1, 2, 3, 22]);
export function aliCourtFields(d = 3) {
  if (d === 0) return [];
  const result = [];
  for (const [i, e] of edges(plans.court).entries()) {
    if (!courtEdges.has(i) || e.length < 6) continue;
    const normal = e.normal.map((v) => -v);
    const gateU = plans.gate.center
      .map((v, k) => v - e.a[k])
      .reduce((s, v, k) => s + v * e.axis[k], 0);
    const spans =
      i === 1
        ? [
            [0, gateU - plans.gate.width / 2],
            [gateU + plans.gate.width / 2, e.length],
          ]
        : [[0, e.length]];
    for (const [start, end] of spans) {
      const n = Math.max(1, Math.round((end - start) / (d === 1 ? 12.5 : 6.2))),
        step = (end - start) / n;
      for (let j = 0; j < n; j++) {
        const p = lerp(e.a, e.b, (start + (j + 0.5) * step) / e.length);
        for (let t = 0; t < 2; t++)
          result.push({
            ...field(
              `court-${i}-${j}-${t}`,
              p,
              e.axis,
              normal,
              step * 0.72,
              t ? 6.75 : 0.4,
              t ? 4.6 : 5.0,
              t ? 2.6 : 2.8,
              0.8,
            ),
            edge: i,
            tier: t,
            step,
          });
      }
    }
  }
  return result;
}
function gallery(face, d) {
  for (const h of aliCourtFields(d)) {
    panel(face, h, d, h.step, h.tier ? 6.3 : 0, h.tier ? 12.5 : 6.3, 'tile', 0.015);
    reveal(face, h, d, 0.015, -0.4, 'wall');
    pane(face, h, d, -0.4, 'wall');
    if (d > 1) {
      archBand(face, h, d, 0.2, 'trim', 0.045);
      if (!h.tier) {
        const q = { ...h, width: h.width * 0.5, bottom: floor + 0.4, height: 2.6, spring: 1.65 };
        pane(face, q, d, -0.35, 'door');
      }
    }
  }
  if (d > 0)
    for (const i of courtEdges) {
      const e = edges(plans.court)[i],
        n = e.normal.map((v) => -v);
      for (const [y, h] of [
        [6.1, 0.35],
        [11.8, 0.45],
      ])
        face(
          'tile',
          [
            point({ center: e.a, axis: e.axis, normal: n }, 0, floor + y, 0.04),
            point({ center: e.b, axis: e.axis, normal: n }, 0, floor + y, 0.04),
            point({ center: e.b, axis: e.axis, normal: n }, 0, floor + y + h, 0.04),
            point({ center: e.a, axis: e.axis, normal: n }, 0, floor + y + h, 0.04),
          ],
          [n[0], 0, n[1]],
        );
    }
}
export function aliDrumFields(d = 3) {
  if (d === 0) return [];
  const n = d === 1 ? 6 : 12,
    p = plans.dome;
  return Array.from({ length: n }, (_, i) => {
    const a = ((i + 0.5) * 2 * Math.PI) / n,
      normal = [Math.cos(a), Math.sin(a)],
      axis = [normal[1], -normal[0]],
      center = p.center.map((v, k) => v + normal[k] * p.radius * 0.988);
    return field(`drum-${i}`, center, axis, normal, d === 1 ? 1.65 : 1.25, 13.0, 3.9, 2.4, 1.15);
  });
}
function dome(out, face, d) {
  const p = plans.dome,
    n = [8, 12, 20, 28, 32][d],
    r = circle(p.center, p.radius, n),
    fields = aliDrumFields(d);
  shell(out, d, r, 12.5, 18.5, fields, 'gold');
  for (const h of fields) {
    pane(face, h, d, -0.45);
    if (d > 1) archBand(face, h, d, 0.2, 'gold', 0.035);
  }
  sides(face, circle(p.center, p.radius * 1.014, n), 17.75, 18.5, 'tile');
  profile(
    face,
    r,
    d === 0
      ? [
          [18.5, 1],
          [23.5, 1.02],
          [28, 0.65],
          [31, 0.06],
        ]
      : [
          [18.5, 1],
          [20.5, 1.055],
          [23.5, 1.015],
          [26, 0.82],
          [28.1, 0.58],
          [30, 0.25],
          [31, 0.05],
        ],
    'gold',
    p.center,
  );
  profile(
    face,
    circle(p.center, d === 0 ? 0.25 : 0.32, d === 0 ? 4 : 8),
    [
      [31, 1],
      [31.35, 1.5],
      [31.6, 0.8],
      [32, 0.12],
    ],
    'gold',
    p.center,
  );
}
function minaret(face, p, d) {
  const n = [6, 12, 16, 24, 28][d],
    r = circle(p.center, p.radius, n);
  profile(
    face,
    r,
    d === 0
      ? [
          [0, 1],
          [21.7, 0.83],
          [22.7, 1.17],
          [23.2, 1.17],
        ]
      : d === 1
        ? [
            [0, 1],
            [21.6, 0.84],
            [22.2, 1.04],
            [22.7, 1.17],
            [23.2, 1.17],
          ]
        : [
            [0, 1],
            [0.6, 1.03],
            [1.0, 0.94],
            [20.8, 0.83],
            [21.6, 0.84],
            [21.9, 0.96],
            [22.2, 1.04],
            [22.7, 1.17],
            [23.2, 1.17],
          ],
    'gold',
    p.center,
  );
  if (d > 0) sides(face, circle(p.center, p.radius * 0.852, n), 20.7, 21.6, 'tile');
  const N = d === 0 ? 4 : d === 1 ? 6 : 8,
    R = p.radius * 1.1;
  for (let i = 0; i < N; i++) {
    const a = (i * 2 * Math.PI) / N,
      center = p.center.map((v, k) => v + [Math.cos(a), Math.sin(a)][k] * R);
    beam(face, at(center, 23.2), at(center, 24.5), d === 0 ? 0.34 : 0.24, 'gold', d > 0);
  }
  const upper = circle(p.center, p.radius * 1.2, n),
    inner = circle(p.center, p.radius * 0.88, n);
  sides(face, upper, 24.5, 24.75, 'gold');
  cap(face, upper, 24.75, 'gold', [inner]);
  if (d > 1)
    for (let i = 0; i < N; i++) {
      const a = ((i + 0.5) * 2 * Math.PI) / N,
        normal = [Math.cos(a), Math.sin(a)],
        axis = [normal[1], -normal[0]],
        h = field(
          'gallery-arch',
          p.center.map((v, k) => v + normal[k] * R),
          axis,
          normal,
          1.4,
          23.2,
          1.32,
          0.6,
          0.45,
        );
      archBand(face, h, d, 0.16, 'gold', 0.05);
    }
  profile(
    face,
    circle(p.center, p.radius * 0.46, n),
    d === 0
      ? [
          [23.15, 1],
          [27, 1],
          [28.6, 0.08],
        ]
      : [
          [23.15, 1],
          [27, 1],
          [27.25, 1.15],
          [27.8, 1.12],
          [28.35, 0.7],
          [28.6, 0.08],
        ],
    'gold',
    p.center,
  );
  profile(
    face,
    circle(p.center, 0.15, d === 0 ? 4 : 8),
    d === 0
      ? [
          [28.6, 1],
          [29, 0.12],
        ]
      : [
          [28.6, 1],
          [28.8, 1.5],
          [29, 0.12],
        ],
    'gold',
    p.center,
  );
}
function clock(face, d) {
  const p = plans.clock,
    center = p.center,
    w = 4.65,
    h = 3.3;
  solid(face, p.outline, 12.5, 18.2, 'tile');
  slab(face, rect(...center, w + 0.55, h + 0.55), 12.5, 0.3, 'trim');
  slab(face, rect(...center, w + 0.5, h + 0.5), 17.9, 0.3, 'trim');
  if (d > 0)
    for (const e of edges(rect(...center, w, h))) {
      const C = e.center.map((v, k) => v + e.normal[k] * 0.045),
        a = {
          center: C,
          axis: e.axis,
          normal: e.normal,
          width: 2.35,
          height: 2.35,
          bottom: floor + 14.5,
          shape: 'circle',
          depth: 0.5,
        };
      pane(face, a, d, 0, 'glass');
      archBand(face, a, d, 0.16, 'trim', 0.02);
      if (d > 1) {
        for (let j = 0; j < 12; j++) {
          const angle = (j * Math.PI) / 6,
            u = Math.sin(angle),
            v = Math.cos(angle),
            b = point(a, u * 0.82, floor + 15.675 + v * 0.82, 0.04),
            t = point(a, u * 0.98, floor + 15.675 + v * 0.98, 0.04);
          beam(face, b, t, 0.1, 'trim');
        }
        beam(
          face,
          point(a, 0, floor + 15.675, 0.06),
          point(a, 0.52, floor + 15.98, 0.06),
          0.13,
          'trim',
        );
        beam(
          face,
          point(a, 0, floor + 15.675, 0.06),
          point(a, 0, floor + 16.45, 0.06),
          0.12,
          'trim',
        );
      }
    }
  for (const e of rect(...center, w - 0.5, h - 0.5))
    beam(face, at(e, 18.2), at(e, 20), 0.32, 'gold', d > 0);
  const r = circle(center, 1.55, d === 0 ? 6 : d === 1 ? 8 : 16);
  profile(
    face,
    r,
    d === 0
      ? [
          [20, 1],
          [21, 0.5],
          [21.5, 0.08],
        ]
      : [
          [20, 1],
          [20.45, 0.9],
          [21, 0.5],
          [21.5, 0.08],
        ],
    'gold',
    center,
  );
  profile(
    face,
    circle(center, 0.12, 4),
    d === 0
      ? [
          [21.5, 1],
          [22, 0.12],
        ]
      : [
          [21.5, 1],
          [21.75, 1.4],
          [22, 0.12],
        ],
    'gold',
    center,
  );
}
function shade(face, p, d) {
  const r = p.outline,
    y = 11.3,
    peak = at(p.center, 12.5),
    under = at(p.center, 12.32);
  beam(face, at(p.center, 0), at(p.center, 12.3), d === 0 ? 0.55 : 0.45, 'trim');
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face('roof', [at(r[i], y), at(r[j], y), peak], [0, 1, 0]);
    if (d > 0) face('roof', [at(r[j], y - 0.12), at(r[i], y - 0.12), under], [0, -1, 0]);
    if (d > 0) face('trim', [at(r[i], y - 0.12), at(r[j], y - 0.12), at(r[j], y), at(r[i], y)]);
  }
}
export function aliSideFields(d = 3) {
  if (d === 0) return [];
  const r = [];
  for (const side of [-1, 1])
    for (let i = 0; i < (d === 1 ? 4 : 6); i++) {
      const z = -0.3 + ((i + 0.5) * 30) / (d === 1 ? 4 : 6),
        center = [side < 0 ? -12.57 : 29.02, z],
        normal = [side, 0],
        axis = [0, 1];
      r.push(
        field(
          `shrine-side-${side}-${i}`,
          center,
          axis,
          normal,
          d === 1 ? 4.8 : 3.3,
          1.2,
          8.6,
          5.2,
          0.8,
        ),
      );
    }
  return r;
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
    portals = aliPortals(d),
    cuts = portals.map((h) =>
      prepareOpening(
        {
          ...h,
          center: h.center.map((v, k) => v - h.normal[k] * (h.depth / 2 - 0.05)),
          depth: h.depth + 1.5,
        },
        0,
        d,
      ),
    ),
    body = writer(masked(out, cuts), d),
    outer = d === 0 ? _coarse(plans.outer) : plans.outer,
    court = d === 0 ? _coarse(plans.court) : plans.court;
  sides(face, outer, footing, 0, 'wall');
  cap(face, outer, 0, 'trim');
  sides(body, outer, 0, 12.5, 'wall');
  cap(body, outer, 12.5, 'roof', [court]);
  const fields = aliCourtFields(d),
    sideFields = aliSideFields(d);
  for (const [i, e] of edges(court).entries()) {
    if (d > 0 && courtEdges.has(i) && fields.some((h) => h.edge === i)) {
      continue;
    }
    body(
      'tile',
      [at(e.a, 0), at(e.b, 0), at(e.b, 12.5), at(e.a, 12.5)],
      [-e.normal[0], 0, -e.normal[1]],
    );
  }
  gallery(body, d);
  // Raised shallow facade fields do not pretend to be traversable interiors.
  for (const h of sideFields) {
    pane(face, h, d, 0.035, 'wall');
    archBand(face, h, d, 0.24, 'tile', 0.06);
    if (d > 1) {
      const q = { ...h, width: h.width * 0.34, bottom: floor + 2.0, height: 3.3, spring: 2 };
      pane(face, q, d, 0.065);
    }
  }
  for (const h of portals) portal(face, h, d);
  for (const p of plans.annexes) solid(face, p.outline, 0, 6, 'tile');
  dome(out, face, d);
  for (const p of plans.minarets) minaret(face, p, d);
  clock(face, d);
  if (d > 0)
    for (const p of plans.smallDomes) {
      const r = d === 1 ? circle(p.center, 2.35, 4) : p.outline;
      profile(
        face,
        r,
        d === 1
          ? [
              [12.5, 1],
              [14.5, 0],
            ]
          : [
              [12.5, 1],
              [13.2, 0.84],
              [14.1, 0.46],
              [14.5, 0.06],
            ],
        'roof',
        p.center,
      );
    }
  for (const p of plans.shades) shade(face, p, d);
}
export const buildAliSkyline = (o) => build(o, 0),
  buildAliDistrict = (o) => build(o, 1),
  buildAliStreet = (o) => build(o, 2),
  buildAliCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const aliStudy = {
  id: 'imam_ali_mosque',
  key: 'imam_ali_mosque',
  title: 'Imam Ali Mosque',
  category: 'mosque',
  wikidataId: 'Q838359',
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
    'Six existing shared256² sandstone,marble,cast-bronze,mosaic,lime-plaster and wood graphs;seven merged groups. Gold leaf uses a warm tint on shared neutral cast bronze,not a unique texture. Metric UVs,linear tints,zero embedded images,baked lighting or copied tile/calligraphy art. Broad original facets abstract the gilded muqarnas.',
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
    'Individual historic shrine exterior from five inspected2003/2014/2023/2025 photographs. Gold/blue dome,twin minarets,deep gilded iwan,east clock gate,two-tier tiled courtyard,small rear caps and eight mapped open shade pavilions. Shared mosaic approximates facade color;fine tile/calligraphic art,flags,banners,strings,scaffolding,fixtures and furnishings omitted. Gallery/iwan fields close before interiors;clock gate is an exterior passage. Unseen roofs,current finish/canopy state,exact terrain/threshold joins,interiors and engineering unverified. The large western expansion and city buildings remain host content. No enclosed-interior/free walking claim. Physical-device performance remains unmeasured.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('gilded-pointed-iwan', [8.1, 9, -36], [8.1, 11, -9]),
    cam('dome-and-open-minarets', [52, 41, -48], [9, 22, 7]),
    cam('clock-gate-and-four-faces', [32, 25, -83], [8.6, 15, -44]),
    cam('two-tier-tiled-court', [-19, 8, -28], [-35, 7, -9]),
    cam('rear-roof-caps-and-shades', [83, 45, 84], [4, 12, 38]),
    cam('historic-core-map-plan', [0, 275, 0.1], [0, 7, 0]),
  ],
};

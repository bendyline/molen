/** Sultan Ahmed Mosque: six minarets, four-way dome cascade and open domed courtyard. */
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
  '../../../content/worldgen/source/places/sx/sxk/sultan_ahmed_mosque/',
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
  wall: '#d7d3c6',
  trim: '#e3dfd2',
  roof: '#83888b',
  door: '#71604c',
  glass: '#526779',
  gold: '#c5b177',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, sultanAhmedGround(...p) - 0.35);
export function sultanAhmedGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Sultan Ahmed Mosque footing outside retained terrain');
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
const coarse = (r) => {
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
const circle = (p, r, n, offset = 0) =>
  Array.from({ length: n }, (_, i) => {
    const a = offset - (i * Math.PI * 2) / n;
    return [p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r];
  });
const rectangle = (x0, z0, x1, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
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
const hall = coarse(plans.hall),
  court = plans.courtHole;
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
export function sultanAhmedCourtArches(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [e, edge] of edges(court).entries()) {
    const n = Math.round(edge.length / 6.6);
    for (let i = 0; i < n; i++) {
      const p = lerp(edge.a, edge.b, (i + 0.5) / n),
        normal = edge.normal.map((v) => -v);
      out.push(
        hole(
          `court-${e}-${i}`,
          p,
          edge.axis,
          normal,
          edge.length / n - 1.0,
          0.04,
          6.9,
          4.15,
          'pointed',
          1.9,
        ),
      );
    }
  }
  return out;
}
export function sultanAhmedWallFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [e, edge] of edges(hall).entries()) {
    const n = Math.max(1, Math.round(edge.length / 7.8));
    for (let i = 0; i < n; i++) {
      if (d === 1 && i % 2) continue;
      const p = lerp(edge.a, edge.b, (i + 0.5) / n);
      out.push(
        hole(`hall-upper-${e}-${i}`, p, edge.axis, edge.normal, 2.7, 10.3, 4.1, 2.4, 'pointed', 2),
      );
      if (d >= 2 && !(p[0] < 1 && Math.abs(p[1]) < 3))
        out.push(
          hole(`hall-lower-${e}-${i}`, p, edge.axis, edge.normal, 1.8, 2.0, 3.0, 3.0, 'rect', 2),
        );
    }
  }
  const edge = edges(hall).find((e) => e.a[0] < 1 && e.b[0] < 1),
    p = lerp(edge.a, edge.b, 0.5);
  out.push({
    ...hole('main-court-door', p, edge.axis, edge.normal, 3.4, 0.12, 5.3, 3.9, 'pointed', 2),
    kind: 'door',
  });
  return out;
}
export function sultanAhmedDrumFields(d = 3) {
  if (d < 2) return [];
  const out = [];
  for (const [k, p] of [
    { ...plans.mainDome, radius: 15.3, base: 30.5, height: 2 },
    ...plans.semidomes.map((p) => ({ ...p, base: 23.8, height: 2.3 })),
  ].entries()) {
    const n = k === 0 ? [8, 12, 20, 28, 32][d] : [6, 8, 14, 20, 24][d],
      r = circle(p.center, p.radius, n);
    for (let i = 0; i < n; i += 2) {
      const a = lerp(r[i], r[(i + 1) % n], 0.5),
        normal = unit(a.map((v, k) => v - p.center[k]));
      if (
        k &&
        normal.reduce((sum, v, j) => sum + v * (p.center[j] - plans.mainDome.center[j]), 0) < 2
      )
        continue;
      if (
        !k &&
        plans.semidomes.some((q) => {
          const t = Math.hypot(a[0] - q.center[0], a[1] - q.center[1]) / q.radius;
          return t < 1 && 26.1 + 7.6 * Math.sqrt(1 - t * t) > p.base + 0.15;
        })
      )
        continue;
      out.push(
        hole(
          `drum-${k}-${i}`,
          a,
          [-normal[1], normal[0]],
          normal,
          k === 0 ? 1.0 : 0.9,
          p.base + 0.3,
          p.height - 0.6,
          0.65,
          'pointed',
          1.6,
        ),
      );
    }
  }
  return out;
}
function finish(face, fields, d) {
  for (const h of fields) {
    pane(face, h, d, -0.23, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) archBand(face, h, d, 0.21, 'trim', 0.055);
  }
}
function capDome(face, p, r, base, height, d, kind = 'roof', small = false) {
  const n = small ? [4, 6, 10, 14, 16][d] : [8, 12, 20, 28, 32][d],
    steps = small ? [1, 2, 3, 4, 5][d] : [2, 3, 5, 7, 8][d],
    ring = circle(p, r, n);
  profile(
    face,
    ring,
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [base + height * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    kind,
  );
}
function finial(face, p, y, d) {
  beam(face, at(p, y - 0.08), at(p, y + 1.5), d === 0 ? 0.15 : 0.12, 'gold');
  if (d >= 2)
    profile(
      face,
      circle(p, 0.23, 6),
      [
        [y + 0.25, 0.7],
        [y + 0.55, 1],
        [y + 0.85, 0.5],
      ],
      'gold',
    );
}
function domes(out, face, d) {
  const center = plans.mainDome.center,
    fields = sultanAhmedDrumFields(d),
    dr = circle(center, 15.3, [8, 12, 20, 28, 32][d]);
  // The central pier mass covers the inward halves of the four lower caps.
  solid(face, plans.mainDrum, 17.5, 30.5, 'wall');
  for (const [k, p] of plans.semidomes.entries()) {
    const ring = circle(p.center, p.radius, [6, 8, 14, 20, 24][d]);
    shell(
      out,
      d,
      ring,
      17.5,
      26.1,
      fields.filter((h) => h.name.startsWith(`drum-${k + 1}-`)),
      'wall',
    );
    capDome(face, p.center, p.radius, 26.1, 7.6, d, 'roof', true);
    if (d >= 2) band(face, ring, 25.7, 0.4, 'trim', 1.025);
  }
  shell(
    out,
    d,
    dr,
    30.5,
    32.5,
    fields.filter((h) => h.name.startsWith('drum-0-')),
    'wall',
  );
  finish(face, fields, d);
  capDome(face, center, 15.3, 32.5, 10.5, d);
  if (d >= 2) band(face, dr, 32.1, 0.4, 'trim', 1.015);
  finial(face, center, 43, d);
  for (const p of plans.smallDomes) {
    const ring = circle(p.center, p.radius, [4, 6, 10, 14, 16][d]);
    solid(face, ring, 17.5, 19.5, 'wall');
    capDome(face, p.center, p.radius, 19.5, 3.3, d, 'roof', true);
    if (d >= 2) finial(face, p.center, 22.8, d);
  }
  if (d >= 3) {
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8;
      for (let j = 0; j < 6; j++) {
        const u = ((j / 6) * Math.PI) / 2,
          v = (((j + 1) / 6) * Math.PI) / 2;
        beam(
          face,
          [
            center[0] + 15.33 * Math.cos(u) * Math.cos(a),
            floor + 32.5 + 10.52 * Math.sin(u),
            center[1] + 15.33 * Math.cos(u) * Math.sin(a),
          ],
          [
            center[0] + 15.33 * Math.cos(v) * Math.cos(a),
            floor + 32.5 + 10.52 * Math.sin(v),
            center[1] + 15.33 * Math.cos(v) * Math.sin(a),
          ],
          0.07,
          'roof',
        );
      }
    }
  }
}
function minaret(face, p, d) {
  const n = [4, 6, 10, 16, 20][d],
    ring = circle(p.center, p.radius, n),
    h = p.height;
  solid(face, p.base, footing, 5.2, 'wall');
  profile(
    face,
    ring,
    [
      [5.2, 1.05],
      [7.1, 1],
      [h - 9, 0.8],
    ],
    'wall',
  );
  profile(
    face,
    ring,
    [
      [h - 9, 0.88],
      [d <= 1 ? h : h - 0.65, 0],
    ],
    'roof',
  );
  if (d >= 2) beam(face, at(p.center, h - 0.8), at(p.center, h), 0.13, 'gold');
  if (d >= 1) {
    const ys = p.balconies === 3 ? [24.5, 37, 48] : [24, 37];
    for (const y of ys) {
      profile(
        face,
        ring,
        [
          [y - 1, 1],
          [y - 0.35, 1.55],
          [y + 0.65, 1.55],
        ],
        'trim',
      );
      if (d >= 2)
        profile(
          face,
          ring,
          [
            [y + 0.65, 1.45],
            [y + 0.95, 1.45],
          ],
          'trim',
        );
      if (d >= 3)
        for (let i = 0; i < n; i++) {
          const a = (i * Math.PI * 2) / n,
            r = p.radius * 1.48;
          beam(
            face,
            at([p.center[0] + r * Math.cos(a), p.center[1] + r * Math.sin(a)], y),
            at([p.center[0] + r * Math.cos(a), p.center[1] + r * Math.sin(a)], y + 0.8),
            0.1,
            'trim',
          );
        }
    }
  }
}
function courtyard(out, face, d) {
  // Court paving belongs to this asset; the retained courtyard hole stays open above it.
  cap(face, court, 0.045, 'trim');
  const arches = sultanAhmedCourtArches(d);
  for (const [e, edge] of edges(court).entries()) {
    const outward = edge.normal,
      backA = edge.a.map((v, k) => v + outward[k] * 7.7),
      backB = edge.b.map((v, k) => v + outward[k] * 7.7),
      strip = [edge.a, edge.b, backB, backA];
    const back = [
      backA,
      backB,
      backB.map((v, k) => v + outward[k] * 0.6),
      backA.map((v, k) => v + outward[k] * 0.6),
    ];
    if (d >= 1 && e === 0) {
      const p = lerp(backA, backB, 0.5),
        h = {
          ...hole(
            'west-entrance-door',
            p,
            edge.axis,
            outward.map((v) => -v),
            3.8,
            0.1,
            5.5,
            3.8,
            'pointed',
            1.8,
          ),
          kind: 'door',
        };
      shell(out, d, back, footing, 7.65, [h], 'wall');
      finish(face, [h], d);
      // This gateway is visible from both the courtyard and the outside approach.
      pane(face, { ...h, normal: h.normal.map((v) => -v) }, d, 0.23, 'door');
      cap(face, back, 7.65, 'trim');
    } else solid(face, back, footing, 7.65, 'wall');
    cap(face, strip, 7.55, 'roof');
    if (d === 0) {
      const n = 3;
      for (let i = 0; i <= n; i++) {
        const p = lerp(edge.a, edge.b, i / n);
        solid(face, rectangle(p[0] - 0.55, p[1] - 0.55, p[0] + 0.55, p[1] + 0.55), 0, 7.55, 'wall');
      }
      const a = edge.a.map((v, k) => v + outward[k] * 0.35),
        b = edge.b.map((v, k) => v + outward[k] * 0.35);
      sides(face, [edge.a, edge.b, b, a], 6.9, 7.55, 'trim');
    } else if (d === 1) {
      const hs = arches.filter((h) => h.name.startsWith(`court-${e}-`));
      for (let i = 0; i <= hs.length; i++) {
        const p = lerp(edge.a, edge.b, i / hs.length);
        solid(face, rectangle(p[0] - 0.48, p[1] - 0.48, p[0] + 0.48, p[1] + 0.48), 0, 7.55, 'wall');
      }
      for (const h of hs) {
        const p = prepareOpening(h, 0, d),
          ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
          arc = openingShape(h, d).slice(2);
        for (let i = 0; i < arc.length - 1; i++) {
          const a = arc[i],
            b = arc[i + 1],
            atSide = (q, o) => p.point(q[0], q[1], o * ns);
          for (const o of [0, -0.8])
            face(
              'wall',
              [
                atSide(a, o),
                atSide(b, o),
                atSide([b[0], floor + 7.55], o),
                atSide([a[0], floor + 7.55], o),
              ],
              [h.normal[0] * (o === 0 ? 1 : -1), 0, h.normal[1] * (o === 0 ? 1 : -1)],
            );
          face('wall', [atSide(a, 0), atSide(b, 0), atSide(b, -0.8), atSide(a, -0.8)], [0, -1, 0]);
        }
      }
    } else {
      const a = edge.a.map((v, k) => v + outward[k] * 0.8),
        b = edge.b.map((v, k) => v + outward[k] * 0.8),
        r = [edge.a, edge.b, b, a];
      shell(
        out,
        d,
        r,
        0,
        7.55,
        arches.filter((h) => h.name.startsWith(`court-${e}-`)),
        'wall',
      );
      cap(face, r, 7.55, 'trim');
    }
    if (d >= 2) {
      const n = Math.round(edge.length / 6.6);
      for (let i = 0; i < n; i++) {
        const p = lerp(backA, backB, (i + 0.5) / n),
          normal = outward.map((v) => -v),
          lo = hole(`gallery-door-${e}-${i}`, p, edge.axis, normal, 1.5, 0.18, 2.6, 2.6, 'rect', 1);
        pane(face, lo, d, 0.05, 'door');
        const hi = hole(
          `gallery-upper-${e}-${i}`,
          p,
          edge.axis,
          normal,
          1.4,
          3.7,
          2.0,
          1.2,
          'pointed',
          1,
        );
        pane(face, hi, d, 0.05, 'glass');
        archBand(face, hi, d, 0.18, 'trim', 0.08);
      }
    }
  }
  if (d >= 2) for (const h of arches) archBand(face, h, d, 0.32, 'trim', 0.06);
  for (const p of plans.galleryDomes) {
    const dd = d === 0 ? 0 : d === 1 ? 0 : d - 1;
    capDome(face, p.center, p.radius, 7.55, 2.35, dd, 'roof', true);
    if (d >= 3) finial(face, p.center, 9.9, d);
  }
  // The central western entrance breaks the low back wall, with a raised portal/dome.
  const west = edges(court)[0],
    mid = lerp(west.a, west.b, 0.5),
    p = mid.map((v, k) => v + west.normal[k] * 3.8);
  if (d >= 1) {
    const r = rectangle(p[0] - 4.1, p[1] - 4.3, p[0] + 4.1, p[1] + 4.3);
    solid(face, r, 7.55, 9.3, 'wall');
    capDome(face, p, 4.1, 9.3, 2.0, d, 'roof', true);
  }
}
export function sultanAhmedFountainArches(d = 3) {
  if (d === 0) return [];
  return edges(plans.fountain.outline).map((e, i) =>
    hole(
      `fountain-${i}`,
      lerp(e.a, e.b, 0.5),
      e.axis,
      e.normal,
      e.length - 0.55,
      0.5,
      3.45,
      1.8,
      'pointed',
      1.1,
    ),
  );
}
function fountain(out, face, d) {
  const p = plans.fountain.center,
    r = plans.fountain.outline,
    fields = sultanAhmedFountainArches(d);
  if (d === 0) {
    for (const q of r) beam(face, at(q, 0.05), at(q, 4.2), 0.28, 'trim');
  } else {
    shell(out, d, r, 0.2, 4.4, fields, 'trim', scaled(r, 0.82));
    for (const h of fields) archBand(face, h, d, 0.18, 'trim', 0.06);
  }
  cap(face, scaled(r, 1.08), 0.25, 'trim');
  cap(face, scaled(r, 1.1), 4.4, 'trim');
  capDome(face, p, 2.5, 4.4, 2.0, d, 'roof', true);
  if (d >= 1) finial(face, p, 6.4, d);
}
function build(target, d) {
  const out = {
      addTriangle(...a) {
        const p = a[2].map((q) => q.map(Math.fround));
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
          if (longest > (d === 0 ? 35 : 20)) {
            const j = (k + 1) % 3,
              c = (k + 2) % 3,
              mid = lerp(p[k], p[j], 0.5).map(Math.fround),
              v = lerp(uv[k], uv[j], 0.5);
            emit([p[k], mid, p[c]], [uv[k], v, uv[c]]);
            emit([mid, p[j], p[c]], [v, uv[j], uv[c]]);
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
    face = writer(out, d),
    fields = sultanAhmedWallFields(d);
  shell(out, d, hall, footing, 17.5, fields, 'wall');
  cap(face, hall, 17.5, 'roof');
  finish(face, fields, d);
  courtyard(out, face, d);
  fountain(out, face, d);
  domes(out, face, d);
  for (const p of plans.minarets) minaret(face, p, d);
  if (d >= 2) {
    band(face, hall, 16.9, 0.6, 'trim', 1.006);
    for (const e of edges(hall)) {
      const n = Math.max(1, Math.round(e.length / 7.8));
      for (let i = 0; i <= n; i++) {
        const p = lerp(e.a, e.b, i / n);
        solid(
          face,
          rectangle(p[0] - 0.55, p[1] - 0.55, p[0] + 0.55, p[1] + 0.55),
          footing,
          18.2,
          'trim',
        );
      }
    }
  }
}
export const buildSultanAhmedSkyline = (o) => build(o, 0),
  buildSultanAhmedDistrict = (o) => build(o, 1),
  buildSultanAhmedStreet = (o) => build(o, 2),
  buildSultanAhmedCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const sultanAhmedStudy = {
  id: 'sultan_ahmed_mosque',
  key: 'sultan_ahmed_mosque',
  title: 'Sultan Ahmed Mosque',
  category: 'mosque',
  wikidataId: 'Q80541',
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
    'Five existing shared256² limestone,raw limestone,standing-seam metal,plain wood and bronze graphs;six merged groups including local glazing. Standing seam abstracts lead roofs. Linear tints,metric UVs and faceted architecture;zero embedded images,bespoke facade bitmaps,baked lighting or invented inscriptions.',
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
    'Medium-fi exterior reconstructed from three inspected pictures and standard PMTiles/DEM. Four-way dome cascade,six minarets/open court and gallery/fountain silhouette are individually authored. Roof elevations are picture estimates because layered map tags conflict with visible proportions;all tags retained. Open court arcades and fountain arches in district/street/close-up;skyline keeps open court with fewer square posts and coarser domes. Shallow facade recesses and simplified doors/lattice stand for exterior openings only;no prayer-hall interior or free traversal claim. Fine carved muqarnas,calligraphy,leaded art,tiled interior,engineering,current finish and exact site joins excluded or unverified. Separate mausoleum,outer enclosure/park,Hagia Sophia and other city buildings remain host content. Synthetic neighborhood context and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('northwest-court-and-six-minarets', [-154, 56, 116], [-17, 18, 0]),
    cam('open-courtyard-arcades', [-33, 11, 15], [-35, 6, -23]),
    cam('six-sided-fountain', [-29, 6, -0.5], [-23, 4, -6.5]),
    cam('southeast-four-way-cascade', [150, 68, 85], [26, 25, 0]),
    cam('minaret-balconies', [95, 41, 62], [55, 35, 31]),
    cam('roof-and-signed-plan', [0, 245, 0.1], [0, 20, 0]),
  ],
};

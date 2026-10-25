/** Dome of the Rock: octagonal marble/mosaic walls, gold cap and individual portals. */
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
  '../../../content/worldgen/source/places/sv/sv9/dome_of_the_rock/',
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
  wall: '#dedbd1',
  tile: '#7296bc',
  trim: '#e3dbc7',
  roof: '#848b91',
  gold: '#dbb354',
  door: '#8e714c',
  glass: '#53766f',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, domeRockGround(...p) - 0.35);
export function domeRockGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Dome of the Rock footing outside retained terrain');
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
const plans = rec.plans,
  octagon = coarse(plans.octagon),
  dp = plans.dome.center,
  radius = plans.dome.radius;
const circle = (p, r, n) =>
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
const facets = edges(octagon),
  point = (e, u, v = 0) => lerp(e.a, e.b, u).map((x, k) => x + e.normal[k] * v);
const localRect = (e, u0, u1, v0, v1) => [
  point(e, u0, v0),
  point(e, u1, v0),
  point(e, u1, v1),
  point(e, u0, v1),
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
  shape = 'round',
  depth = 2,
) => ({ name, center, axis, normal, width, bottom: floor + bottom, height, spring, shape, depth });
const tint = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((n) => {
      const v = parseInt(n, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const accents = {
  cream: tint('#daddc8'),
  green: tint('#739a8f'),
  cobalt: tint('#5275aa'),
  pink: tint('#c8b3a9'),
};
export function domeRockUpperFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [e, f] of facets.entries()) {
    const indices = d === 1 ? [1, 3, 5] : [0, 1, 2, 3, 4, 5, 6];
    for (const i of indices) {
      if (plans.entranceEdges.includes(e) && i === 3) continue;
      out.push({
        ...hole(
          `upper-${e}-${i}`,
          point(f, (i + 0.5) / 7),
          f.axis,
          f.normal,
          2.2,
          6.8,
          6.2,
          4.7,
          'round',
          1.8,
        ),
        kind: i === 0 || i === 6 ? 'blind' : 'glass',
      });
    }
  }
  return out;
}
export function domeRockLowerFields(d = 3) {
  if (d === 0) return [];
  return facets.map((f, i) =>
    plans.entranceEdges.includes(i)
      ? {
          ...hole(
            `door-${i}`,
            point(f, 0.5),
            f.axis,
            f.normal,
            i === 2 ? 3.8 : 2.7,
            0.1,
            5.1,
            5.1,
            'rect',
            2,
          ),
          kind: 'door',
        }
      : {
          ...hole(
            `lower-vent-${i}`,
            point(f, 0.5),
            f.axis,
            f.normal,
            1.4,
            2.0,
            2.4,
            2.4,
            'rect',
            1.8,
          ),
          kind: 'glass',
        },
  );
}
export function domeRockDrumFields(d = 3) {
  if (d === 0) return [];
  const ring = circle(dp, radius, [8, 12, 16, 24, 32][d]),
    out = [];
  for (const [i, e] of edges(ring).entries()) {
    if (d === 1 && i % 2) continue;
    const p = point(e, 0.5);
    out.push({
      ...hole(`drum-${i}`, p, e.axis, e.normal, d === 1 ? 1.5 : 1.0, 18.65, 2.4, 2.4, 'rect', 1.6),
      kind: i % 2 ? 'blind' : 'glass',
    });
  }
  return out;
}
function inset(face, h, d, slot, offset = -0.22, color) {
  const p = prepareOpening(h, 0, d),
    s = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  face(
    slot,
    openingShape(h, d).map((q) => p.point(...q, offset * s)),
    [h.normal[0], 0, h.normal[1]],
    color,
  );
}
function fields(face, list, d) {
  for (const h of list) {
    inset(
      face,
      h,
      d,
      h.kind === 'door' ? 'door' : h.kind === 'blind' ? 'tile' : 'glass',
      -0.22,
      h.kind === 'blind' ? accents.green : undefined,
    );
    if (d >= 2) {
      const outer = (slot, p, n) => face(slot, p, n, accents.cream);
      archBand(outer, h, d, 0.24, 'tile', 0.05);
      if (d >= 3)
        archBand(
          face,
          {
            ...h,
            width: h.width + 0.65,
            height: h.height + 0.65,
            bottom: h.bottom - 0.325,
            spring: h.spring + 0.325,
          },
          d,
          0.14,
          'tile',
          0.04,
        );
    }
  }
}
function plate(face, h, d, slot, thickness = 0.25) {
  const p = prepareOpening(h, 0, d),
    ring = openingShape(h, d),
    s = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    atSide = (q, z) => p.point(...q, z * s);
  face(
    slot,
    ring.map((q) => atSide(q, 0)),
    [h.normal[0], 0, h.normal[1]],
  );
  face(
    slot,
    ring.map((q) => atSide(q, -thickness)),
    [-h.normal[0], 0, -h.normal[1]],
  );
  for (let i = 0; i < ring.length; i++) {
    const j = (i + 1) % ring.length;
    face(slot, [
      atSide(ring[i], 0),
      atSide(ring[j], 0),
      atSide(ring[j], -thickness),
      atSide(ring[i], -thickness),
    ]);
  }
}
function bandBetween(face, r, b, t, slot, factor = 1.002, color) {
  const a = scaled(r, factor),
    f = color ? (s, p, n) => face(s, p, n, color) : face;
  sides(f, a, b, t, slot);
}
function walls(out, face, d) {
  const lower = domeRockLowerFields(d),
    upper = domeRockUpperFields(d);
  shell(out, d, octagon, footing, 6.1, lower, 'wall');
  fields(face, lower, d);
  shell(out, d, octagon, 6.1, 17, upper, 'tile');
  fields(face, upper, d);
  for (const [b, t, color] of [
    [6.05, 6.35, accents.cream],
    [13.5, 13.85, accents.cream],
    [14.1, 14.8, accents.green],
    [15.0, 16.05, accents.cobalt],
    [16.1, 16.65, accents.cream],
  ])
    bandBetween(face, octagon, b, t, 'tile', 1.002, color);
  if (d >= 2) {
    for (const [_e, f] of facets.entries()) {
      for (let i = 1; i < 7; i++) {
        const p = point(f, i / 7, 0.04);
        beam(face, at(p, 0.4), at(p, 5.7), 0.11, 'wall');
      }
      for (const i of [0, 1, 2, 4, 5, 6]) {
        const r = localRect(f, (i + 0.13) / 7, (i + 0.87) / 7, 0.035, 0.045);
        const panel = (slot, p, n) => face(slot, p, n, accents.cream);
        sides(panel, r, 0.7, 5.5, 'wall');
      }
      if (d >= 3)
        for (let i = 0; i < 4; i++) {
          const p = point(f, (i + 0.5) / 4, 0.055),
            size = 0.47,
            q = (u, v) => [p[0] + f.axis[0] * u, floor + 14.45 + v, p[1] + f.axis[1] * u];
          face(
            'tile',
            [q(0, size), q(size, 0), q(0, -size), q(-size, 0)],
            [f.normal[0], 0, f.normal[1]],
            accents.cream,
          );
        }
    }
  }
  const inner = circle(dp, radius * 1.025, [8, 12, 16, 24, 32][d]),
    set = new Set(inner);
  cap(face, octagon, (p) => floor + (set.has(p) ? 17.8 : 17), 'roof', [inner]);
  if (d >= 1) bandBetween(face, octagon, 16.75, 17.05, 'trim', 1.008);
}
function drum(out, face, d) {
  const r = circle(dp, radius, [8, 12, 16, 24, 32][d]),
    fs = domeRockDrumFields(d);
  shell(out, d, r, 17.75, 22, fs, 'tile');
  fields(face, fs, d);
  if (d >= 1) {
    bandBetween(face, r, 17.8, 18.25, 'tile', 1.01, accents.cream);
    bandBetween(face, r, 21.35, 21.75, 'tile', 1.01, accents.cobalt);
  }
}
function goldCap(face, d) {
  const ring = circle(dp, radius * 1.04, [8, 12, 20, 28, 32][d]),
    steps = [3, 4, 6, 8, 10][d],
    levels = Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [22 + 12 * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    });
  profile(face, ring, levels, 'gold');
  if (d >= 3) {
    const count = d === 3 ? 16 : 20;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count;
      for (let j = 0; j < 6; j++) {
        const u = ((j / 6) * Math.PI) / 2,
          v = (((j + 1) / 6) * Math.PI) / 2;
        beam(
          face,
          [
            dp[0] + (radius * 1.04 + 0.035) * Math.cos(u) * Math.cos(a),
            floor + 22 + 12.03 * Math.sin(u),
            dp[1] + (radius * 1.04 + 0.035) * Math.cos(u) * Math.sin(a),
          ],
          [
            dp[0] + (radius * 1.04 + 0.035) * Math.cos(v) * Math.cos(a),
            floor + 22 + 12.03 * Math.sin(v),
            dp[1] + (radius * 1.04 + 0.035) * Math.cos(v) * Math.sin(a),
          ],
          0.1,
          'gold',
        );
      }
    }
    for (const a of [0.22, 0.45, 0.68, 0.91]) {
      const r = radius * 1.04 * Math.cos(a) * 1.004,
        y = 22 + 12 * Math.sin(a);
      profile(
        face,
        circle(dp, r, d === 3 ? 28 : 32),
        [
          [y, 1],
          [y + 0.1, 1],
        ],
        'gold',
      );
    }
  }
  beam(face, at(dp, 33.95), at(dp, d === 0 ? 36.4 : 35.6), 0.16, 'gold');
  if (d >= 1) {
    profile(
      face,
      circle(dp, 0.32, 8),
      [
        [34.35, 0.6],
        [34.6, 1],
        [34.9, 0.6],
      ],
      'gold',
    );
    const n = d === 1 ? 8 : 16,
      outer = 0.48,
      inner = 0.31,
      cy = 35.92;
    for (const z of [-0.045, 0.045])
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n,
          b = ((i + 1) * Math.PI * 2) / n;
        face(
          'gold',
          [
            [dp[0] + outer * Math.cos(a), floor + cy + outer * Math.sin(a), dp[1] + z],
            [dp[0] + outer * Math.cos(b), floor + cy + outer * Math.sin(b), dp[1] + z],
            [dp[0] + inner * Math.cos(b), floor + cy + inner * Math.sin(b), dp[1] + z],
            [dp[0] + inner * Math.cos(a), floor + cy + inner * Math.sin(a), dp[1] + z],
          ],
          [0, 0, z < 0 ? -1 : 1],
        );
      }
  }
}
export function domeRockPortals() {
  return plans.entranceEdges.map((i) => ({
    edge: i,
    ...facets[i],
    width: i === plans.southEdge ? 10.4 : 4.5,
    depth: i === plans.southEdge ? 3.6 : 1.8,
  }));
}
function portals(face, d) {
  for (const e of domeRockPortals()) {
    const w = e.width / e.length,
      r = localRect(e, 0.5 - w / 2, 0.5 + w / 2, 0, e.depth + 0.2),
      stone = (slot, p, n) => face(slot, p, n, accents.pink);
    cap(face, r, 0.08, 'wall');
    const columns = e.edge === 2 ? [-0.42, -0.17, 0.17, 0.42] : [-0.42, 0.42];
    for (const u of columns) {
      const p = point(e, 0.5 + w * u, e.depth - 0.22),
        ring = circle(p, d === 0 ? 0.28 : 0.32, [4, 6, 10, 14, 16][d]),
        base = localRect(
          e,
          0.5 + w * u - 0.55 / e.length,
          0.5 + w * u + 0.55 / e.length,
          e.depth - 0.77,
          e.depth + 0.33,
        );
      solid(face, base, 0, 0.42, 'trim');
      profile(
        stone,
        ring,
        [
          [0.42, 1.18],
          [0.7, 1],
          [5.5, 1],
          [5.8, 1.4],
        ],
        'wall',
      );
      if (d >= 2) solid(face, base, 5.8, 6.1, 'trim');
    }
    solid(face, r, 5.85, 6.2, 'trim');
    if (e.edge === 2) {
      const n = [3, 4, 6, 8, 10][d],
        width = e.width / 2,
        curve = Array.from({ length: n + 1 }, (_, i) => {
          const u = -width + (2 * width * i) / n,
            y = 6.2 + 2.6 * Math.sqrt(Math.max(0, 1 - (u * u) / (width * width)));
          return [u, y];
        }),
        P = (q, v, delta = 0) => at(point(e, 0.5 + q[0] / e.length, v), q[1] + delta);
      for (let i = 0; i < n; i++) {
        const a = curve[i],
          b = curve[i + 1];
        face('roof', [P(a, 0), P(b, 0), P(b, e.depth + 0.2), P(a, e.depth + 0.2)], [0, 1, 0]);
        face(
          'trim',
          [P(a, 0, -0.22), P(b, 0, -0.22), P(b, e.depth + 0.2, -0.22), P(a, e.depth + 0.2, -0.22)],
          [0, -1, 0],
        );
        face(
          'tile',
          [P(a, 0), P(b, 0), P(b, 0, -0.22), P(a, 0, -0.22)],
          [-e.normal[0], 0, -e.normal[1]],
        );
        // The photographed south canopy has a closed decorative tympanum above the lintel.
        face(
          'tile',
          [
            P(a, e.depth + 0.2),
            P(b, e.depth + 0.2),
            P([b[0], 6.2], e.depth + 0.2),
            P([a[0], 6.2], e.depth + 0.2),
          ],
          [e.normal[0], 0, e.normal[1]],
        );
        if (d >= 2)
          face(
            'tile',
            [
              P(a, e.depth + 0.24),
              P(b, e.depth + 0.24),
              P([b[0], Math.max(6.2, b[1] - 0.2)], e.depth + 0.24),
              P([a[0], Math.max(6.2, a[1] - 0.2)], e.depth + 0.24),
            ],
            [e.normal[0], 0, e.normal[1]],
            accents.cream,
          );
      }
    } else {
      const h = hole(
        `portal-tympanum-${e.edge}`,
        point(e, 0.5, e.depth + 0.2),
        e.axis,
        e.normal,
        e.width,
        6.2,
        2.4,
        0,
        'round',
        1,
      );
      plate(face, h, d, 'tile');
      if (d >= 2)
        archBand((slot, p, n) => face(slot, p, n, accents.cream), h, d, 0.22, 'tile', 0.05);
    }
    if (d >= 1)
      for (let j = 0; j < 2; j++) {
        const r = localRect(
          e,
          0.5 - w / 2,
          0.5 + w / 2,
          e.depth + 0.2 + j * 0.6,
          e.depth + 0.8 + j * 0.6,
        );
        solid(face, r, (p) => Math.min(floor - 0.4, domeRockGround(...p) - 0.25), -0.2 * j, 'wall');
      }
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
            const length = Math.hypot(p[i][0] - p[(i + 1) % 3][0], p[i][2] - p[(i + 1) % 3][2]);
            if (length > longest) {
              longest = length;
              k = i;
            }
          }
          if (longest > (d === 0 ? 20 : 14)) {
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
    face = writer(out, d);
  walls(out, face, d);
  drum(out, face, d);
  goldCap(face, d);
  portals(face, d);
}
export const buildDomeRockSkyline = (o) => build(o, 0),
  buildDomeRockDistrict = (o) => build(o, 1),
  buildDomeRockStreet = (o) => build(o, 2),
  buildDomeRockCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const domeRockStudy = {
  id: 'dome_of_the_rock',
  key: 'dome_of_the_rock',
  title: 'Dome of the Rock',
  category: 'mosque',
  wikidataId: 'Q172077',
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
    'Five existing shared256² marble,mosaic,raw limestone,standing-seam metal and bronze graphs;seven merged groups including local green-blue glazing. Bronze tinted gold abstracts gold sheeting;shared mosaic/vertex-tint bands suggest ceramic rather than replicate unique artwork. Linear tints,metric UVs and faceted architecture;zero embedded images,unique facade bitmaps,baked light or invented lettering.',
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
    'Individual medium-fi exterior from three inspected2008/2013 pictures plus standard viewer PMTiles/DEM. Octagonal wall/dome plan retained;nominal17/34m tags and estimated architectural partitions. Four portals align to alternating facets;visible south/east pictures guide the broad/paired-column distinction,unseen north/west details are estimates. Shared mosaic and blue/green/cream bands are an abstraction of patterned ceramic,not a replica of calligraphy or historic artwork. Gold metal graph abstracts gold-clad sheets;bronze doors have simplified flat fields. Fine carved capitals,door studs,leaded art,tile motifs,engineering,current finish and precise platform/step/base joins excluded or unverified. Facade/drum recesses and shallow open columned porches terminate at closed doors;no prayer-hall interior or free traversal claim. Dome of the Chain,Ascension,Prophet,platform/arcades,Al-Qibli and other compound buildings remain host content. Synthetic neighbors and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('southeast-gold-dome-and-octagon', [78, 39, 90], [0, 16, 0]),
    cam('south-columned-porch', [6, 10, 52], [1, 6, 26]),
    cam('east-paired-column-door', [46, 9, 3], [25, 6, 0]),
    cam('blue-mosaic-arched-fields', [-26, 12, 36], [-7, 11, 24]),
    cam('gold-cap-and-drum', [36, 33, 45], [0, 25, 0]),
    cam('roof-and-signed-plan', [0, 148, 0.1], [0, 15, 0]),
  ],
};

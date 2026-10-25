/** Damascus Umayyad Mosque: Eagle transept, six roof ranges, three minarets and court pavilions. */
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
  '../../../content/worldgen/source/places/sv/svc/umayyad_mosque/',
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
  wall: '#d4c7af',
  trim: '#e5ddcb',
  roof: '#848b90',
  door: '#a17c58',
  mosaic: '#afa875',
  gold: '#c4ad6b',
  glass: '#536b72',
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
const footing = (p) => Math.min(-0.35, floor - 0.3, umayyadGround(...p) - 0.35);
export function umayyadGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Umayyad Mosque footing outside retained terrain');
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
const plans = rec.plans,
  core = plans.transept,
  P = (u, v) => lerp(lerp(core[0], core[1], u), lerp(core[3], core[2], u), v),
  Q = (a, b, c, d) => [P(a, b), P(c, b), P(c, d), P(a, d)],
  _width = Math.hypot(core[1][0] - core[0][0], core[1][1] - core[0][1]),
  depth = Math.hypot(core[3][0] - core[0][0], core[3][1] - core[0][1]);
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
const quad = (r) => {
  const byZ = [...r].sort((a, b) => a[1] - b[1]),
    top = byZ.slice(0, 2).sort((a, b) => a[0] - b[0]),
    bottom = byZ.slice(2).sort((a, b) => a[0] - b[0]);
  return [top[0], top[1], bottom[1], bottom[0]];
};
const green = [0.19, 0.29, 0.2],
  fr = edges(core)[0];
export function umayyadHallFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [i, a] of plans.aisles.entries()) {
    if (![0, 3].includes(i)) continue;
    const r = quad(a.outline),
      e = edges(r)[0],
      n = 8;
    for (let j = 0; j < n; j++) {
      if (d === 1 && j % 2) continue;
      const p = lerp(e.a, e.b, (j + 0.5) / n);
      if (p[0] < -56.4 || p[0] > 62.6) continue;
      out.push({
        ...hole(`hall-door-${i}-${j}`, p, e.axis, e.normal, 4.2, 0.08, 8.2, 5.4, 'round', 1.8),
        kind: 'door',
      });
      if (d >= 2)
        out.push(
          hole(`hall-upper-${i}-${j}`, p, e.axis, e.normal, 2.5, 9.5, 3.1, 2.0, 'round', 1.8),
        );
    }
  }
  for (let i = 0; i < 3; i++) {
    out.push({
      ...hole(
        `transept-door-${i}`,
        P((i + 0.5) / 3, 0),
        fr.axis,
        fr.normal,
        5.2,
        0.08,
        10.2,
        6.6,
        'round',
        2,
      ),
      kind: 'door',
    });
    if (d >= 1)
      out.push(
        hole(
          `transept-upper-${i}`,
          P((i + 0.5) / 3, 0),
          fr.axis,
          fr.normal,
          4.6,
          13.0,
          6.4,
          4.1,
          'round',
          2,
        ),
      );
  }
  // The mapped rear strip is a five-point polygon; retain its long south face.
  const e = edges(plans.rear)[1];
  for (let i = 0; i < 14; i++) {
    if (d === 1 && i % 3) continue;
    const p = lerp(e.a, e.b, (i + 0.5) / 14);
    out.push(hole(`rear-upper-${i}`, p, e.axis, e.normal, 2.3, 9.0, 3.1, 1.9, 'round', 2));
  }
  return out;
}
export function umayyadGalleryArches(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const group of plans.galleryEdges)
    for (const id of group.indices) {
      const e = edges(plans[group.ring])[id],
        n = Math.round(e.length / (d === 1 ? 12 : 6.8));
      for (let i = 0; i < n; i++) {
        const p = lerp(e.a, e.b, (i + 0.5) / n);
        for (const tier of [0, 1])
          out.push(
            hole(
              `gallery-${group.ring}-${id}-${tier}-${i}`,
              p,
              e.axis,
              e.normal,
              e.length / n - 1.05,
              tier === 0 ? 0.04 : 7.4,
              tier === 0 ? 6.5 : 4.8,
              tier === 0 ? 4.1 : 2.7,
              'round',
              2,
            ),
          );
      }
    }
  return out;
}
export function umayyadDrumFields(d = 3) {
  if (d === 0) return [];
  const out = [];
  for (const [i, e] of edges(plans.dome.drum).entries()) {
    if (d === 1 && i % 2) continue;
    const count = d === 1 ? 1 : 2;
    for (let j = 0; j < count; j++)
      out.push(
        hole(
          `eagle-drum-${i}-${j}`,
          lerp(e.a, e.b, (j + 0.5) / count),
          e.axis,
          e.normal,
          d === 1 ? 1.25 : 1.0,
          25.6,
          3.8,
          2.3,
          'pointed',
          1.8,
        ),
      );
  }
  return out;
}
function finish(face, fs, d) {
  for (const h of fs) {
    pane(face, h, d, -0.24, h.kind === 'door' ? 'door' : 'glass');
    if (d >= 2) archBand(face, h, d, 0.28, 'trim', 0.055);
  }
}
function pitchedX(face, r, eave, ridge) {
  r = quad(r);
  const a = lerp(r[0], r[3], 0.5),
    b = lerp(r[1], r[2], 0.5);
  for (const [lo, hi] of [
    [r[0], r[1]],
    [r[3], r[2]],
  ])
    face('roof', [at(lo, eave), at(hi, eave), at(b, ridge), at(a, ridge)], [0, 1, 0]);
  for (const side of [0, 1]) {
    const p = r[side],
      q = r[3 - side],
      m = side === 0 ? a : b;
    face('wall', [at(p, eave), at(q, eave), at(m, ridge)], [side === 0 ? -1 : 1, 0, 0]);
  }
}
function gallery(out, face, d) {
  const openings = umayyadGalleryArches(d);
  for (const group of plans.galleryEdges) {
    const r = plans[group.ring],
      es = edges(r),
      inner = new Set(group.indices),
      hs = openings.filter((h) => h.name.startsWith(`gallery-${group.ring}-`));
    if (d >= 2) {
      shell(out, d, r, footing, 13, hs, 'wall');
      for (const h of hs) archBand(face, h, d === 2 ? 1 : d, 0.24, 'trim', 0.06);
    } else {
      for (const [i, e] of es.entries()) {
        if (!inner.has(i)) {
          face(
            'wall',
            [at(e.a, footing), at(e.b, footing), at(e.b, 13), at(e.a, 13)],
            [e.normal[0], 0, e.normal[1]],
          );
          continue;
        }
        const n = d === 0 ? Math.max(2, Math.round(e.length / 22)) : Math.round(e.length / 12);
        for (let j = 0; j <= n; j++) {
          const p = lerp(e.a, e.b, j / n);
          beam(face, at(p, 0), at(p, 13), d === 0 ? 1.05 : 0.95, 'wall');
        }
        if (d === 0) {
          for (const [y, h] of [
            [6.5, 0.65],
            [12.3, 0.7],
          ])
            face(
              'trim',
              [at(e.a, y), at(e.b, y), at(e.b, y + h), at(e.a, y + h)],
              [e.normal[0], 0, e.normal[1]],
            );
        } else
          for (const h of hs.filter((h) => h.name.startsWith(`gallery-${group.ring}-${i}-`))) {
            const p = prepareOpening(h, 0, 1),
              ns = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
              arc = openingShape(h, 1).slice(2),
              top = floor + (h.bottom < floor + 1 ? 7.1 : 13),
              A = (q, o) => p.point(q[0], q[1], o * ns);
            for (let k = 0; k < arc.length - 1; k++) {
              const a = arc[k],
                b = arc[k + 1];
              for (const o of [0, -0.8])
                face(
                  'wall',
                  [A(a, o), A(b, o), A([b[0], top], o), A([a[0], top], o)],
                  [h.normal[0] * (o === 0 ? 1 : -1), 0, h.normal[1] * (o === 0 ? 1 : -1)],
                );
              face('trim', [A(a, 0), A(b, 0), A(b, -0.8), A(a, -0.8)], [0, -1, 0]);
            }
          }
      }
    }
    cap(face, r, 0.03, 'trim');
    if (d >= 1) cap(face, r, 7.1, 'trim');
    cap(face, r, 13, 'roof');
    if (d >= 1) band(face, r, 12.7, 0.4, 'trim', 1.002);
  }
}
function hall(out, face, d) {
  const fields = umayyadHallFields(d);
  for (const [i, a] of plans.aisles.entries()) {
    shell(
      out,
      d,
      a.outline,
      footing,
      14,
      fields.filter((h) => h.name.startsWith('hall-') && h.name.split('-')[2] === String(i)),
      'wall',
    );
    pitchedX(face, a.outline, 14, 20);
  }
  shell(
    out,
    d,
    plans.rear,
    footing,
    14,
    fields.filter((h) => h.name.startsWith('rear-')),
    'wall',
  );
  cap(face, plans.rear, 14, 'roof');
  const transept = fields.filter((h) => h.name.startsWith('transept-'));
  shell(out, d, core, footing, 10.5, transept, 'wall');
  const sideOut = {
    addTriangle(...a) {
      if (a[0] === 'wall' && a[3][0] * fr.normal[0] + a[3][2] * fr.normal[1] > 0.99999) return;
      out.addTriangle(...a);
    },
  };
  shell(sideOut, d, core, 10.5, 22, transept, 'wall');
  finish(face, fields, d);
  const fa = writer(
    masked(
      out,
      transept.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
    ),
    d,
  );
  fa(
    'mosaic',
    [at(P(0, 0), 10.5), at(P(1, 0), 10.5), at(P(1, 0), 22), at(P(0, 0), 22)],
    [fr.normal[0], 0, fr.normal[1]],
  );
  const lo = P(0.5, 0),
    hi = P(0.5, 1);
  for (const [_u, p, q] of [
    [0, P(0, 0), P(0, 1)],
    [1, P(1, 0), P(1, 1)],
  ])
    face('roof', [at(p, 22), at(q, 22), at(hi, 28), at(lo, 28)], [0, 1, 0]);
  for (const v of [0, 1])
    face(
      v === 0 ? 'mosaic' : 'wall',
      [at(P(0, v), 22), at(P(1, v), 22), at(P(0.5, v), 28)],
      [fr.normal[0] * (v === 0 ? 1 : -1), 0, fr.normal[1] * (v === 0 ? 1 : -1)],
    );
  if (d >= 1) {
    for (const u of [0, 1]) {
      const r = Q(u - 0.025, 0, u + 0.025, 1.4 / depth);
      solid(face, r, footing, 22.5, 'trim');
    }
    beam(face, at(P(0, 0), 22), at(P(0.5, 0), 28), 0.45, 'trim');
    beam(face, at(P(0.5, 0), 28), at(P(1, 0), 22), 0.45, 'trim');
  }
  if (d >= 2) {
    for (const h of transept.filter((h) => h.name.startsWith('transept-door')))
      archBand(face, h, d, 0.45, 'trim', 0.065);
    for (const u of [0.23, 0.5, 0.77]) {
      const h = hole(
        `gable-relief-${u}`,
        P(u, 0),
        fr.axis,
        fr.normal,
        1.0,
        23.1 + (u === 0.5 ? 1 : 0),
        1.0,
        0.5,
        'circle',
        1,
      );
      pane(face, h, d, 0.065, 'trim');
    }
    for (const u of [0.13, 0.87]) {
      const p = P(u, 0);
      face(
        'mosaic',
        [
          [p[0] - 1.2, floor + 20, p[1] - 0.05],
          [p[0], floor + 21, p[1] - 0.05],
          [p[0] + 1.2, floor + 20, p[1] - 0.05],
          [p[0], floor + 19, p[1] - 0.05],
        ],
        [fr.normal[0], 0, fr.normal[1]],
        green,
      );
    }
  }
}
function eagle(out, face, d) {
  const dr = d === 0 ? coarse(plans.dome.drum) : plans.dome.drum,
    fields = umayyadDrumFields(d);
  shell(out, d, dr, 24, 30, fields, 'wall');
  finish(face, fields, d);
  cap(face, dr, 30, 'trim');
  const p = plans.dome.center,
    ring = circle(p, plans.dome.radius, [8, 12, 20, 28, 32][d]),
    steps = [2, 3, 5, 7, 9][d];
  profile(
    face,
    ring,
    Array.from({ length: steps + 1 }, (_, i) => {
      const a = ((i / steps) * Math.PI) / 2;
      return [30 + 10 * Math.sin(a), i === steps ? 0 : Math.cos(a)];
    }),
    'roof',
  );
  beam(face, at(p, 39.9), at(p, 42), 0.16, 'gold');
  if (d >= 2) band(face, dr, 29.6, 0.4, 'trim', 1.03);
}
function minaret(face, m, d) {
  const p = m.center,
    n = [4, 6, 10, 16, 20][d];
  if (d === 0) {
    if (m.kind === 'bride') {
      solid(face, m.base, footing, 14, 'wall');
      solid(face, m.upper, 14, 28, 'wall');
      solid(face, m.canopy, 28, 28.5, 'roof');
      solid(face, m.pavilion, 28.5, 31.5, 'trim');
      profile(
        face,
        circle(p, 1.1, 4),
        [
          [31.5, 1],
          [40, 0],
        ],
        'trim',
      );
    } else if (m.kind === 'qaitbay') {
      solid(face, m.base, footing, 19, 'wall');
      profile(
        face,
        circle(p, 1.95, 4),
        [
          [19, 1],
          [26, 1],
          [27, 1.5],
          [31, 0.6],
          [34, 0.7],
          [39, 0],
        ],
        'trim',
      );
    } else {
      solid(face, m.base, footing, 30, 'wall');
      profile(
        face,
        circle(p, 0.65, 4),
        [
          [30, 1],
          [31.3, 1.6],
          [40, 0.8],
          [42, 0],
        ],
        'trim',
      );
    }
    return;
  }
  if (m.kind === 'bride') {
    solid(face, m.base, footing, 14, 'wall');
    solid(face, m.upper, 14, 28, 'wall');
    solid(face, m.canopy, 28, 28.5, 'roof');
    solid(face, m.pavilion, 28.5, 31.5, 'trim');
    profile(
      face,
      m.shaft,
      [
        [31.5, 1],
        [37.7, 0.82],
        [40, 0],
      ],
      'trim',
    );
    if (d >= 2) {
      for (const [e, f] of edges(m.upper).entries())
        for (const u of [0.28, 0.72]) {
          const h = hole(
            `bride-light-${e}-${u}`,
            lerp(f.a, f.b, u),
            f.axis,
            f.normal,
            1.1,
            23.4,
            3.2,
            1.8,
            'round',
            1,
          );
          pane(face, h, d, 0.035, 'glass');
          archBand(face, h, d, 0.18, 'trim', 0.055);
        }
    }
  } else if (m.kind === 'qaitbay') {
    solid(face, m.base, footing, 19, 'wall');
    const r = circle(p, 1.95, n);
    profile(
      face,
      r,
      [
        [19, 1],
        [26, 1],
        [27, 1.55],
        [27.4, 0.62],
        [30.8, 0.6],
        [31.6, 1.15],
        [32, 1.15],
        [32.3, 0.5],
        [33.0, 0.72],
        [34, 0.5],
        [34.3, 0.3],
        [39, 0],
      ],
      'trim',
    );
  } else {
    solid(face, m.base, footing, 30, 'wall');
    const r = circle(p, 0.65, n);
    profile(
      face,
      r,
      [
        [30, 1.2],
        [31, 1.9],
        [31.6, 1.9],
        [32, 1],
        [36, 1],
        [36.8, 1.65],
        [37.3, 1.65],
        [40, 0.8],
        [42, 0],
      ],
      'trim',
    );
  }
  if (d >= 1)
    band(
      face,
      m.base,
      Math.min(m.kind === 'bride' ? 13.4 : m.kind === 'qaitbay' ? 18.4 : 29.4, 29.4),
      0.6,
      'trim',
      1.015,
    );
}
function pavilion(face, p, d) {
  const n = d === 0 ? 4 : 8,
    ring = circle(p.center, p.radius, n),
    cols = d <= 1 ? 4 : 8,
    base = p.kind === 'treasury' ? 5.2 : p.kind === 'clock' ? 5.4 : 4.7;
  for (let i = 0; i < cols; i++) {
    const a = (i * Math.PI * 2) / cols,
      q = [
        p.center[0] + p.radius * 0.77 * Math.cos(a),
        p.center[1] + p.radius * 0.77 * Math.sin(a),
      ],
      r = circle(q, d === 0 ? 0.3 : 0.28, d === 0 ? 4 : d === 1 ? 6 : 10);
    if (d <= 1) sides(face, r, 0.08, base, 'trim');
    else
      profile(
        face,
        r,
        [
          [0.1, 1.25],
          [0.45, 1],
          [base - 0.3, 1],
          [base, 1.4],
        ],
        'trim',
      );
  }
  cap(face, scaled(ring, 1.04), 0.08, 'trim');
  if (p.kind === 'treasury') {
    solid(face, ring, base, 8.8, 'mosaic');
    const steps = [1, 2, 3, 4, 5][d];
    profile(
      face,
      scaled(ring, 1.04),
      Array.from({ length: steps + 1 }, (_, i) => [
        8.8 + 2.0 * Math.sin(((i / steps) * Math.PI) / 2),
        i === steps ? 0 : Math.cos(((i / steps) * Math.PI) / 2),
      ]),
      'roof',
    );
  } else if (p.kind === 'clock') {
    solid(face, ring, base, 6.4, 'trim');
    profile(
      face,
      scaled(ring, 1.06),
      Array.from({ length: [1, 2, 3, 4, 5][d] + 1 }, (_, i) => {
        const a = ((i / [1, 2, 3, 4, 5][d]) * Math.PI) / 2;
        return [6.4 + 2.3 * Math.sin(a), Math.cos(a) < 1e-8 ? 0 : Math.cos(a)];
      }),
      'roof',
    );
  } else {
    cap(face, scaled(ring, 1.06), 4.9, 'door');
    band(face, ring, 4.9, 0.55, 'door', 1.03);
    const top = scaled(ring, 0.83);
    for (const q of top) beam(face, at(q, 4.9), at(q, 7.6), d === 0 ? 0.3 : 0.22, 'door');
    band(face, top, 7.3, 0.3, 'door', 1);
    profile(
      face,
      scaled(ring, 1.1),
      [
        [7.6, 1],
        [9.4, 0.25],
      ],
      'roof',
    );
    // Close the shoulder around the narrower cupola, including its exposed annulus.
    cap(face, scaled(ring, 0.275), 9.4, 'roof');
    profile(
      face,
      circle(p.center, 1.1, d === 0 ? 4 : 8),
      [
        [9.4, 1],
        [10.2, 1],
        [11.3, 0.65],
        [12, 0],
      ],
      'roof',
    );
  }
  if (d >= 2) beam(face, at(p.center, p.height - 0.4), at(p.center, p.height + 0.8), 0.12, 'gold');
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
          if (longest > (d === 0 ? 50 : d === 1 ? 35 : 20)) {
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
  cap(face, plans.court, 0.025, 'trim');
  gallery(out, face, d);
  hall(out, face, d);
  eagle(out, face, d);
  for (const m of plans.minarets) minaret(face, m, d);
  for (const p of plans.pavilions) pavilion(face, p, d);
}
export const buildUmayyadSkyline = (o) => build(o, 0),
  buildUmayyadDistrict = (o) => build(o, 1),
  buildUmayyadStreet = (o) => build(o, 2),
  buildUmayyadCloseup = (o) => build(o, 3);
const cam = (name, position, lookAt) => ({ name, position, lookAt, fov: 48 });
export const umayyadStudy = {
  id: 'umayyad_mosque',
  key: 'umayyad_mosque',
  title: 'Umayyad Mosque — Damascus',
  category: 'mosque',
  wikidataId: 'Q183562',
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
    'Six existing shared256² limestone,raw limestone,standing-seam metal,plain wood,mosaic and bronze graphs;seven merged groups including local glazing. Muted green/gold fields abstract mosaics without copied artwork or invented inscriptions. Linear tints,metric UVs and faceted architecture;zero embedded images,baked lighting or unique facade bitmaps.',
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
    'Individual medium-fi familiar exterior from three actually inspected2001–2009 courtyard/prayer-hall/minaret photographs and standard viewer PMTiles/DEM. This is not a verified current restoration/construction state. Mapped hall/gallery/minaret controls retained;nominal map stages and picture-led roofs,windows,canopies,bays and ornament. Treasury,Clock and fountain plans/placements are approximate photo reconstructions inside mapped court,about8m horizontal working uncertainty. Mosaics are shared-tile/color abstractions;fine historic artwork,carving,inscriptions,clock mechanisms,engineering,interior and exact site joins excluded or unverified. Main hall openings terminate at closed shallow door/window fields;galleries and pavilion columns have open exterior voids,no prayer-hall interior/free traversal claim. Eagle drum lights meet the pitched roof at their lower edges;visible upper parts retained. Separate Saladin mausoleum/tomb,neighboring markets,streets,Roman propylaeum and people/fixtures remain host content. Synthetic context and physical-device timing unverified.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('courtyard-and-eagle-transept', [-34, 22, -48], [3, 20, 24]),
    cam('two-level-gallery-and-clock', [44, 15, -7], [56, 8, -34]),
    cam('treasury-and-wood-fountain', [-17, 38, -84], [-17, 8, -14]),
    cam('north-bride-minaret', [39, 34, -95], [5, 28, -49]),
    cam('south-qaitbay-jesus-and-six-roofs', [151, 88, 139], [0, 23, 26]),
    cam('roof-and-signed-plan', [0, 275, 0.1], [0, 14, 0]),
  ],
};

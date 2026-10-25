/** Freiburg Minster: open western lattice spire, tiled nave/choir and twin eastern cock turrets. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import {
  openingBuilder,
  openingReveals,
  openingShape,
  prepareOpening,
} from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/u0/u0t/freiburg_minster/',
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
  wall: '#c39581',
  spire: '#b48c7c',
  trim: '#d7b39a',
  roof: '#ad7353',
  door: '#71533c',
  glass: '#43586d',
  accent: '#454a47',
  clock: '#ad615b',
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
const footing = (p) => Math.min(floor - 0.3, freiburgMinsterGround(...p) - 0.35);
export function freiburgMinsterGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Freiburg Minster footing outside retained terrain');
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
function faceFrame(r, i) {
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
        height: h.height + w,
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
const _R = (a, b, x, z) => [
    [a, b],
    [x, b],
    [x, z],
    [a, z],
  ],
  _role = (n) => rec.controls.find((b) => b.id === rec.roles[n]).polygons[0].outline;
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
function gable(face, r, eave, top, slot = 'roof', axis = 0) {
  const rr = coarse(r);
  if (rr.length === 4) {
    const caps = [edge(rr, axis === 0 ? [-1, 0] : [0, -1]), edge(rr, axis === 0 ? [1, 0] : [0, 1])],
      ridge = caps.map((f) => lerp(f.a, f.b, 0.5)),
      nearest = (p) => (p === caps[0].a || p === caps[0].b ? ridge[0] : ridge[1]);
    for (let i = 0; i < rr.length; i++) {
      const f = faceFrame(rr, i);
      if (Math.abs(f.normal[axis]) > 0.65) continue;
      face(
        slot,
        [at(f.a, eave), at(f.b, eave), at(nearest(f.b), top), at(nearest(f.a), top)],
        [0, 1, 0],
      );
    }
    for (let i = 0; i < 2; i++) {
      const f = caps[i];
      face(
        'wall',
        [at(f.a, eave), at(f.b, eave), at(ridge[i], top)],
        [f.normal[0], 0, f.normal[1]],
      );
    }
    return;
  }
  hip(face, r, eave, top, slot, axis);
}
function hip(face, r, eave, top, slot = 'roof', axis = 0) {
  const k = 1 - axis,
    vs = r.map((p) => p[k]),
    xs = r.map((p) => p[axis]),
    mid = (Math.min(...vs) + Math.max(...vs)) / 2,
    rad = (Math.max(...vs) - Math.min(...vs)) / 2,
    lo = Math.min(...xs) + rad,
    hi = Math.max(...xs) - rad,
    point = (p) => {
      const q = [...p];
      q[k] = mid;
      q[axis] = lo <= hi ? Math.max(lo, Math.min(hi, p[axis])) : (lo + hi) / 2;
      return q;
    };
  for (let i = 0; i < r.length; i++) {
    const j = (i + 1) % r.length;
    face(
      slot,
      [at(r[i], eave), at(r[j], eave), at(point(r[j]), top), at(point(r[i]), top)],
      [0, 1, 0],
    );
  }
}
const hole = (name, p, a, n, w, b, h, s = h, shape = 'pointed', depth = 5) => ({
  name,
  center: p,
  axis: a,
  normal: n,
  width: w,
  bottom: floor + b,
  height: h,
  spring: s,
  shape,
  depth,
});
const edge = (r, n) =>
  r
    .map((_, i) => faceFrame(r, i))
    .filter((f) => f.normal[0] * n[0] + f.normal[1] * n[1] > 0.65)
    .sort((a, b) => b.length - a.length)[0];
function _inside(p, r) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      v = !v;
  }
  return v;
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
function panel(face, h, d) {
  pane(face, h, d, d >= 2 ? -0.75 : 0.07, h.kind === 'door' ? 'door' : 'glass');
  if (d < 2) return;
  archBand(face, h, d, 0.35, 'trim', 0.09);
  if (h.kind === 'door') archBand(face, h, d, 0.7, 'trim', 0.14);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  if (h.kind === 'door') {
    beam(
      face,
      p.point(0, h.bottom, -0.68 * sg),
      p.point(0, h.bottom + h.spring, -0.68 * sg),
      0.12,
      'accent',
    );
    return;
  }
  for (const u of [-0.22, 0.22])
    beam(
      face,
      p.point(h.width * u, h.bottom, -0.66 * sg),
      p.point(h.width * u, h.bottom + h.spring, -0.66 * sg),
      0.11,
      'trim',
    );
  if (d >= 3) {
    for (const off of [-0.27, 0.27]) {
      const y = h.bottom + h.spring + 0.45;
      beam(
        face,
        p.point(h.width * off, y, -0.64 * sg),
        p.point(0, h.bottom + h.height - 0.35, -0.64 * sg),
        0.11,
        'trim',
      );
    }
  }
}
const control = (n) => rec.controls.find((b) => b.id === rec.roles[n]),
  ring = (n) => control(n).polygons[0].outline,
  bounds = (r) => [
    Math.min(...r.map((p) => p[0])),
    Math.min(...r.map((p) => p[1])),
    Math.max(...r.map((p) => p[0])),
    Math.max(...r.map((p) => p[1])),
  ],
  mid = (r) => {
    const b = bounds(r);
    return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  },
  point = (f, t = 0.5) => lerp(f.a, f.b, t),
  along = (f, x) => point(f, (x - f.a[0]) / (f.b[0] - f.a[0])),
  nave = ring('nave'),
  aisles = ring('aisles'),
  transept = ring('transept'),
  oct = ring('westOct'),
  oc = mid(oct),
  west = edge(coarse(ring('westBase')), [-1, 0]);
export function freiburgMinsterFields() {
  const hs = [];
  for (const [name, n] of [
    ['north', [0, -1]],
    ['south', [0, 1]],
  ]) {
    const f = edge(nave, n),
      a = edge(aisles, n);
    for (const x of [-38.5, -31.9, -24.9, -17.9, -10.9, -3.7]) {
      hs.push({
        ...hole(`nave-clerestory-${name}${x}`, along(f, x), f.axis, f.normal, 3.3, 21.0, 4.3, 2.7),
        kind: 'window',
      });
      const b = name === 'north' && (x === -17.9 || x === -3.7) ? 4.8 : 2.4;
      hs.push({
        ...hole(`nave-aisle-${name}${x}`, along(a, x), a.axis, a.normal, 4.0, b, 11.9 - b, 9.6 - b),
        kind: 'window',
      });
    }
  }
  const choir = rec.choirHighPlans[0].outline;
  for (const [name, n] of [
    ['north', [0, -1]],
    ['south', [0, 1]],
  ]) {
    const f = edge(choir, n);
    for (const x of [26, 32.7, 39.2])
      hs.push({
        ...hole(`choir-clerestory-${name}${x}`, along(f, x), f.axis, f.normal, 3.3, 18.8, 8.0, 5.8),
        kind: 'window',
      });
  }
  for (const [i, f] of choir
    .map((_, i) => faceFrame(choir, i))
    .filter((f) => f.normal[0] > 0.4)
    .entries())
    hs.push({
      ...hole(
        `choir-apse-high-${i}`,
        point(f),
        f.axis,
        f.normal,
        Math.min(3.1, f.length * 0.6),
        18.8,
        8.0,
        5.8,
      ),
      kind: 'window',
    });
  const cr = coarse(ring('choirRing'));
  for (let i = 0; i < cr.length; i++) {
    const f = faceFrame(cr, i),
      p = point(f);
    if (p[0] > 20 && f.length > 2.6 && (Math.abs(f.normal[1]) > 0.35 || f.normal[0] > 0.3)) {
      const bays = Math.max(1, Math.floor(f.length / 6));
      for (let j = 0; j < bays; j++)
        hs.push({
          ...hole(
            `chapel-ring-${i}-${j}`,
            point(f, (j + 0.5) / bays),
            f.axis,
            f.normal,
            Math.min(3.0, (f.length / bays) * 0.55),
            2.5,
            9.5,
            6.9,
          ),
          kind: 'window',
        });
    }
  }
  const p = point(west),
    b = freiburgMinsterGround(...p) + 0.22 - floor;
  hs.push({
    ...hole('west-vaulted-portal', p, west.axis, west.normal, 6.2, b, 15.0, 9.8, 'pointed', 9),
    kind: 'portal',
  });
  hs.push({
    ...hole('west-upper-window', p, west.axis, west.normal, 3.1, 20.0, 7.7, 5.1),
    kind: 'window',
  });
  for (const [name, n] of [
    ['north', [0, -1]],
    ['south', [0, 1]],
  ]) {
    const f = edge(transept, n);
    for (const t of [0.24, 0.5, 0.76])
      hs.push({
        ...hole(
          `transept-round-${name}${t}`,
          point(f, t),
          f.axis,
          f.normal,
          1.6,
          7.2,
          2.6,
          1.8,
          'round',
          4,
        ),
        kind: 'window',
      });
  }
  for (const name of ['northTurret', 'southTurret']) {
    const r = ring(name);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      hs.push({
        ...hole(
          `${name}-lancet-${i}`,
          point(f),
          f.axis,
          f.normal,
          1.05,
          35.2,
          6.0,
          4.1,
          'round',
          4,
        ),
        kind: 'window',
      });
    }
  }
  const pf = edge(coarse(ring('southPorch')), [0, 1]);
  for (const t of [0.17, 0.5, 0.83]) {
    const q = point(pf, t),
      base = freiburgMinsterGround(...q) + 0.22 - floor;
    hs.push({
      ...hole(
        `renaissance-arcade-${t}`,
        q,
        pf.axis,
        pf.normal,
        2.8,
        base,
        4.8 - base,
        3.3 - base,
        'round',
        6,
      ),
      kind: 'arcade',
    });
  }
  const tf = edge(transept, [0, 1]),
    q = point(tf),
    base = freiburgMinsterGround(...q) + 0.22 - floor;
  hs.push({
    ...hole('south-transept-inner-entry', q, tf.axis, tf.normal, 2.2, base, 4.3, 3.0, 'round', 5),
    kind: 'door',
  });
  const nf = edge(coarse(ring('northEntry')), [0, -1]),
    np = point(nf);
  hs.push({
    ...hole(
      'north-small-entry',
      np,
      nf.axis,
      nf.normal,
      1.7,
      freiburgMinsterGround(...np) + 0.22 - floor,
      3.0,
      2.0,
      'round',
      5,
    ),
    kind: 'door',
  });
  return hs;
}
export function freiburgMinsterBelfry() {
  return oct.map((_, i) => {
    const f = faceFrame(oct, i);
    return hole(`west-belfry-${i}`, point(f), f.axis, f.normal, 2.9, 55, 18, 13.5, 'pointed', 5);
  });
}
function facade(face, h, d) {
  if (h.kind === 'arcade') {
    if (d === 1) pane(face, h, d, 0.06, 'glass');
    return;
  }
  if (h.kind === 'portal') {
    pane(face, h, d, d >= 2 ? -3.2 : 0.06, 'accent');
    if (d >= 2) {
      for (const w of [0.28, 0.64, 1.02]) archBand(face, h, d, w, 'trim', 0.1 + w * 0.08);
      const door = { ...h, width: 3.8, height: 5.8, spring: 5.8, shape: 'rect' };
      pane(face, door, d, -3.12, 'door');
    }
    return;
  }
  panel(face, h, d);
}
function rose(face, d, f) {
  if (d === 0) return;
  const p = point(f),
    N = d >= 3 ? 24 : 12,
    r = 2.6,
    Q = (u, y, off = 0.055) => [
      p[0] + f.axis[0] * u + f.normal[0] * off,
      floor + y,
      p[1] + f.axis[1] * u + f.normal[1] * off,
    ],
    circle = (rad) =>
      Array.from({ length: N }, (_, i) => {
        const a = (i * Math.PI * 2) / N;
        return Q(rad * Math.cos(a), 13 + rad * Math.sin(a));
      }),
    r0 = circle(r);
  face('glass', r0, [f.normal[0], 0, f.normal[1]]);
  if (d >= 2) {
    const r1 = circle(r + 0.25);
    for (let i = 0; i < N; i++)
      face('trim', [r0[i], r0[(i + 1) % N], r1[(i + 1) % N], r1[i]], [f.normal[0], 0, f.normal[1]]);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        face,
        Q(0.4 * Math.cos(a), 13 + 0.4 * Math.sin(a), 0.08),
        Q(2.5 * Math.cos(a), 13 + 2.5 * Math.sin(a), 0.08),
        0.11,
        'trim',
      );
    }
  }
}
function distanceTo(p, r) {
  return Math.min(
    ...r.map((a, i) => {
      const b = r[(i + 1) % r.length],
        v = b.map((x, k) => x - a[k]),
        l = v.reduce((s, x) => s + x * x, 0),
        t = Math.max(
          0,
          Math.min(1, p.map((x, k) => x - a[k]).reduce((s, x, k) => s + x * v[k], 0) / l),
        );
      return Math.hypot(...p.map((x, k) => x - a[k] - v[k] * t));
    }),
  );
}
function roofs(face, d) {
  gable(face, nave, 26, 35);
  gable(face, transept, 18, 26, 'roof', 1);
  hip(face, rec.choirHighPlans[0].outline, 28, 38);
  for (const p of rec.naveLowRoofPlans)
    cap(
      face,
      d <= 1 ? coarse(p.outline) : p.outline,
      (q) => floor + Math.max(13.1, 20 - distanceTo(q, nave) * 0.82),
      'roof',
      d <= 1 ? p.holes.map(coarse) : p.holes,
    );
  for (const p of rec.choirLowRoofPlans)
    cap(
      face,
      coarse(p.outline),
      (q) => floor + Math.max(14.1, 18 - distanceTo(q, rec.choirHighPlans[0].outline) * 0.45),
      'roof',
      p.holes.map(coarse),
    );
  hip(face, coarse(ring('southPorch')), 5.6, 6.5);
  hip(face, coarse(ring('northEntry')), 6.5, 7);
  for (const n of ['northLittle1', 'northLittle2']) cap(face, ring(n), 4, 'roof');
  if (d >= 1) {
    band(face, nave, 25.6, 0.4, 'trim', 1.012);
    band(face, rec.choirHighPlans[0].outline, 27.6, 0.4, 'trim', 1.012);
  }
}
function annulus(face, r, y, w = 0.2, h = 0.35) {
  const c = center(r),
    outer = r.map((p) => {
      const v = p.map((v, k) => v - c[k]),
        l = Math.hypot(...v);
      return p.map((p, k) => p + (v[k] * w) / l);
    }),
    inner = r.map((p) => {
      const v = p.map((v, k) => v - c[k]),
        l = Math.hypot(...v);
      return p.map((p, k) => p - (v[k] * w) / l);
    });
  sides(face, outer, y, y + h, 'trim');
  sides(face, inner, y, y + h, 'trim', true);
  cap(face, outer, y + h, 'trim', [inner]);
}
function openOctagon(face, d, holes) {
  const inner = scaled(oct, 0.78);
  if (d === 0) {
    for (const p of oct) beam(face, at(p, 54), at(p, 75), 0.65, 'wall');
    cap(face, oct, 75, 'wall', [inner]);
    return;
  }
  for (let i = 0; i < oct.length; i++) {
    const f = faceFrame(oct, i),
      fi = faceFrame(inner, i),
      h = holes[i],
      shape = openingShape(h, d),
      Q = (u, y, inside = false) => {
        const p = point(inside ? fi : f);
        return [p[0] + f.axis[0] * u, y, p[1] + f.axis[1] * u];
      };
    for (const inside of [false, true]) {
      const len = (inside ? fi : f).length,
        polygon = [
          [-len / 2, floor + 54],
          [len / 2, floor + 54],
          [len / 2, floor + 75],
          [-len / 2, floor + 75],
          ...shape,
        ],
        ids = earcut(polygon.flat(), [4], 2),
        sg = inside ? -1 : 1;
      for (let k = 0; k < ids.length; k += 3)
        face(
          'wall',
          ids.slice(k, k + 3).map((j) => Q(...polygon[j], inside)),
          [f.normal[0] * sg, 0, f.normal[1] * sg],
        );
    }
    for (let j = 0; j < shape.length; j++) {
      const a = shape[j],
        q = shape[(j + 1) % shape.length],
        u = -(a[0] + q[0]) / 2,
        y = h.bottom + h.height / 2 - (a[1] + q[1]) / 2;
      face(
        'wall',
        [Q(...a), Q(...q), Q(...q, true), Q(...a, true)],
        [f.axis[0] * u, y, f.axis[1] * u],
      );
    }
  }
  cap(face, oct, 75, 'wall', [inner]);
}
function clock(face, d, f) {
  if (d === 0) return;
  const p = point(f),
    Q = (u, y, off = 0.08) => [
      p[0] + f.axis[0] * u + f.normal[0] * off,
      floor + y,
      p[1] + f.axis[1] * u + f.normal[1] * off,
    ],
    N = d >= 2 ? 24 : 12,
    r = 2.05,
    pts = Array.from({ length: N }, (_, i) => {
      const a = (i * Math.PI * 2) / N;
      return Q(r * Math.cos(a), 45 + r * Math.sin(a));
    });
  face('accent', pts, [f.normal[0], 0, f.normal[1]], colors.clock);
  if (d >= 2) {
    const spokes = d >= 3 ? 12 : 6;
    for (let i = 0; i < spokes; i++) {
      const a = (i * Math.PI * 2) / spokes;
      beam(
        face,
        Q(0.2 * Math.cos(a), 45 + 0.2 * Math.sin(a), 0.105),
        Q(1.95 * Math.cos(a), 45 + 1.95 * Math.sin(a), 0.105),
        0.07,
        'trim',
      );
    }
    beam(face, Q(0, 45, 0.15), Q(-1.3, 45.8, 0.15), 0.14, 'accent');
    beam(face, Q(0, 45, 0.15), Q(0.2, 46.6, 0.15), 0.1, 'accent');
  }
}
export function freiburgMinsterSpireRing(y) {
  return scaled(oct, Math.max(0.025, (114.8 - y) / (114.8 - 75)));
}
function lattice(face, d) {
  const levels =
    d === 0
      ? [75, 91, 105, 114.8]
      : d <= 2
        ? [75, 85, 95, 105, 114.8]
        : [75, 81, 87, 93, 99, 105, 110, 114.8];
  for (let i = 0; i < oct.length; i++)
    beam(
      face,
      at(oct[i], 75),
      at(freiburgMinsterSpireRing(114.8)[i], 114.8),
      d === 0 ? 0.48 : 0.42,
      'spire',
    );
  for (const y of levels.slice(0, -1))
    annulus(face, freiburgMinsterSpireRing(y), y, d === 0 ? 0.15 : 0.11, d === 0 ? 0.32 : 0.22);
  if (d >= 1)
    for (let j = 0; j < levels.length - 1; j++) {
      const lo = levels[j],
        hi = levels[j + 1],
        r0 = freiburgMinsterSpireRing(lo),
        r1 = freiburgMinsterSpireRing(hi);
      for (let i = 0; i < 8; i++) {
        const n = (i + 1) % 8;
        beam(face, at(r0[i], lo + 0.2), at(r1[n], hi), 0.26, 'spire');
        beam(face, at(r0[n], lo + 0.2), at(r1[i], hi), 0.26, 'spire');
      }
    }
  if (d >= 3)
    for (const y of [78, 84, 90, 96, 102, 108])
      for (const p of freiburgMinsterSpireRing(y)) {
        const v = unit(p.map((v, k) => v - oc[k])),
          q = p.map((p, k) => p + v[k] * 0.38);
        beam(face, at(p, y), at(q, y + 0.65), 0.22, 'trim');
      }
  beam(face, at(oc, 114.6), at(oc, 116), 0.14, 'accent');
}
function westTower(_out, face, d) {
  const trans = coarse(ring('westTransition'));
  sides(face, trans, 30, 37, 'wall');
  cap(face, trans, 37, 'wall', [scaled(oct, 0.95)]);
  sides(face, oct, 37, 54, 'wall');
  cap(face, oct, 54, 'wall', [scaled(oct, 0.78)]);
  openOctagon(face, d, freiburgMinsterBelfry());
  if (d >= 1) {
    band(face, trans, 36.5, 0.5, 'trim', 1.03);
    annulus(face, oct, 53.6, 0.25, 0.4);
    annulus(face, oct, 74.5, 0.32, 0.5);
    for (const n of [
      [-1, 0],
      [0, 1],
      [1, 0],
      [0, -1],
    ])
      clock(face, d, edge(oct, n));
  }
  lattice(face, d);
  if (d >= 1)
    for (const offset of [-6.0, 6.0]) {
      const p = point(west).map((v, k) => v + west.axis[k] * offset),
        rect = (width, depth) =>
          [
            [-width / 2, -0.25],
            [width / 2, -0.25],
            [width / 2, depth],
            [-width / 2, depth],
          ].map(([u, v]) => p.map((q, k) => q + west.axis[k] * u + west.normal[k] * v));
      for (const [b, t, width, depth] of [
        [footing, 8, 2.7, 3.0],
        [8, 18, 2.3, 2.3],
        [18, 27, 1.8, 1.5],
        [27, 29, 1.2, 0.8],
      ])
        solid(face, rect(width, depth), b, t, 'wall');
      profile(
        face,
        rect(0.8, 0.6),
        [
          [29, 1],
          [30, 0.03],
        ],
        'trim',
      );
    }
  if (d >= 2) {
    for (const p of scaled(trans, 0.95).filter((_, i) => i % 2 === 0)) {
      const r = [
        [p[0] - 0.4, p[1] - 0.4],
        [p[0] + 0.4, p[1] - 0.4],
        [p[0] + 0.4, p[1] + 0.4],
        [p[0] - 0.4, p[1] + 0.4],
      ];
      solid(face, r, 36.4, 38, 'trim');
      profile(
        face,
        r,
        [
          [38, 1],
          [43, 0.02],
        ],
        'spire',
      );
    }
  }
}
function turrets(out, face, d, fields) {
  for (const name of ['northTurret', 'southTurret']) {
    const r = ring(name),
      hs = fields.filter((h) => h.name.startsWith(`${name}-`));
    if (d >= 2) shell(out, d, r, 30, 43, hs);
    else sides(face, r, 30, 43, 'wall');
    profile(
      face,
      scaled(r, 1.05),
      [
        [43, 1],
        [52.3, 0.03],
      ],
      'spire',
    );
    beam(face, at(mid(r), 52.2), at(mid(r), 53), 0.12, 'accent');
    if (d >= 1) for (const y of [31, 34.6, 42.6]) band(face, r, y, 0.3, 'trim', 1.04);
    if (d >= 2)
      for (const p of r) {
        beam(face, at(p, 43), at(mid(r), 52.3), 0.14, 'trim');
      }
  }
}
function support(face, p, n, d, top = 23, tip = 29) {
  const a = [-n[1], n[0]],
    rect = (w, dep) =>
      [
        [-w / 2, -0.3],
        [w / 2, -0.3],
        [w / 2, dep],
        [-w / 2, dep],
      ].map(([u, v]) => p.map((q, k) => q + a[k] * u + n[k] * v)),
    r = rect(d === 0 ? 1.4 : 1.1, 1.6);
  solid(face, r, footing, top, 'wall');
  if (d >= 2) {
    band(face, r, top - 0.2, 0.2, 'trim', 1.04);
    profile(
      face,
      rect(0.75, 0.95),
      [
        [top, 1],
        [top + 1, 1],
        [tip, 0.03],
      ],
      'trim',
    );
  }
}
function flying(face, d) {
  for (const [_name, n] of [
    ['north', [0, -1]],
    ['south', [0, 1]],
  ])
    for (const [which, r, xs, top, innerY] of [
      ['nave', aisles, [-35, -28.4, -21.5, -14.3, -7.3], 23, 25.5],
      ['choir', ring('choirRing'), [22.8, 29.5, 35.9, 42.5], 25.8, 27.5],
    ]) {
      const f = edge(r, n),
        hf = edge(which === 'nave' ? nave : rec.choirHighPlans[0].outline, n);
      for (const x of xs) {
        const p = along(f, x);
        support(face, p, n, d, top, 29);
        if (d >= 1) {
          const q = along(hf, x),
            start = at(p, top - 3),
            end = at(q, innerY),
            N = d >= 3 ? 8 : d >= 2 ? 3 : 2;
          let prev = start;
          for (let i = 1; i <= N; i++) {
            const t = i / N,
              a = lerp(start, end, t);
            a[1] += Math.sin(t * Math.PI) * 1.0;
            beam(face, prev, a, d >= 2 ? 0.44 : 0.65, 'trim');
            prev = a;
          }
        }
      }
    }
}
function build(out, d) {
  const target = out;
  out = {
    addTriangle(slot, ref, points, normal, uv, color) {
      const p = points.map((v) => v.map(Math.fround)),
        lens = p.map((a, i) => Math.hypot(...a.map((v, k) => v - p[(i + 1) % 3][k]))),
        longest = Math.max(...lens),
        max = d === 0 ? 36 : d === 1 ? 24 : 16;
      if (longest > max) {
        const i = lens.indexOf(longest),
          j = (i + 1) % 3,
          k = (i + 2) % 3,
          m = lerp(p[i], p[j], 0.5),
          um = lerp(uv[i], uv[j], 0.5);
        out.addTriangle(slot, ref, [p[i], m, p[k]], normal, [uv[i], um, uv[k]], color);
        out.addTriangle(slot, ref, [m, p[j], p[k]], normal, [um, uv[j], uv[k]], color);
        return;
      }
      if (
        Math.hypot(
          ...cross(
            p[1].map((v, k) => v - p[0][k]),
            p[2].map((v, k) => v - p[0][k]),
          ),
        ) < 1e-10
      )
        return;
      target.addTriangle(slot, ref, p, normal, uv, color);
    },
  };
  const face = writer(out, d),
    fields = freiburgMinsterFields(),
    cut =
      d >= 2
        ? writer(
            masked(
              out,
              fields.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
            ),
            d,
          )
        : face;
  if (d <= 1) {
    for (const [n, b, t] of [
      ['westBase', footing, 30],
      ['aisles', footing, 13],
      ['nave', 13, 26],
      ['transept', footing, 18],
      ['choirRing', footing, 14],
      ['northTurret', footing, 30],
      ['southTurret', footing, 30],
      ['southPorch', footing, 5.6],
      ['northEntry', footing, 6.5],
      ['northLittle1', footing, 4],
      ['northLittle2', footing, 4],
    ])
      solid(face, coarse(ring(n)), b, t, 'wall');
    for (const p of rec.choirHighPlans) solid(face, coarse(p.outline), 14, 28, 'wall');
  } else
    for (const l of rec.wallLayers)
      for (const p of l.polygons) {
        const r = coarse(p.outline);
        shell(out, d, r, l.bottom ?? footing, l.top, fields);
      }
  if (d >= 2)
    for (const l of rec.wallLayers)
      for (const p of l.capPlans) cap(cut, coarse(p.outline), l.top, 'wall', p.holes.map(coarse));
  if (d >= 2) for (const p of rec.main.polygons) sides(cut, p.outline, footing, 0.35, 'wall');
  roofs(cut, d);
  westTower(out, face, d);
  turrets(out, face, d, fields);
  if (d >= 1) flying(cut, d);
  if (d >= 1) for (const h of fields) facade(face, h, d);
  for (const n of [
    [0, 1],
    [0, -1],
  ])
    rose(face, d, edge(transept, n));
}
export const buildFreiburgMinsterSkyline = (o) => build(o, 0),
  buildFreiburgMinsterDistrict = (o) => build(o, 1),
  buildFreiburgMinsterStreet = (o) => build(o, 2),
  buildFreiburgMinsterCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const freiburgMinsterStudy = {
  id: 'freiburg_minster',
  key: 'freiburg_minster',
  title: 'Freiburg Minster',
  category: 'cathedral',
  wikidataId: 'Q250212',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID main and35 current parts; western stepped tower and eastern choir sign the high-nave axis.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis: rec.heightBasis,
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map geometry ©OpenStreetMap contributors, ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256-square sandstone/ashlar/flat tile/wood graphs. Stone lattice spire and walls share sandstone; linear tints, metric UVs and flat normals. Glazing, clocks and accents use geometric flat PBR colors. No embedded images, bespoke textures or baked shadows.',
  importReason:
    'Four authored browser levels retain the specific porous west spire, Romanesque transept, tiled nave, higher choir/chapel ring and twin eastern cock turrets at the signed map site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three inspected useful pictures and standard PMTiles/DEM only. Exact sculpture, reliefs/inscriptions, stained-glass art, smallest tracery/crockets, temporary scaffolding, market stalls/town, surveyed paving/ramps/steps, full interiors and certified walking excluded. Rose windows are geometric flat disks/tracery rather than accurate stained glass. Physical device timing pending.',
    'Skyline retains the porous main spire, open coarse belfry, stepped tower, nave/choir/low ranges and twin turrets. District adds shared surfaces, flat facade fields, clocks and coarse flying arches. Street adds real facade recesses, portal/arcade cavities, supports/pinnacles, rose tracery and denser lattice. Closeup/master refine arch facets, lattice/roof trim and window bars. Synthetic cottage neighbors are review fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-vaulted-entry-and-upper-window', [-117, 21, 7], [-60, 15, -1]),
    cam('open-octagon-and-lattice-spire', [-110, 101, 73], [-50, 86, -2]),
    cam('nave-pointed-glazing-and-flying-arches', [-24, 29, 70], [-24, 20, 3]),
    cam('romanesque-transept-rose-and-arcade', [6, 24, 67], [6, 15, 15]),
    cam('polygonal-choir-and-cock-turrets', [102, 49, 50], [33, 28, -2]),
    cam('minster-roof-and-map-plan', [0, 178, 1], [0, 23, -2]),
  ],
};

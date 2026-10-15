/** Glasgow Cathedral: long copper roofs, Gothic west window and central tiered stone spire. */
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
  '../../../content/worldgen/source/places/gc/gcu/n0365_glasgow_cathedral/',
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
  wall: '#afad9e',
  spire: '#93998f',
  trim: '#c8c3ae',
  roof: '#a3c6b0',
  door: '#71533c',
  glass: '#43586d',
  accent: '#454a47',
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
const footing = (p) => Math.min(floor - 0.3, glasgowCathedralGround(...p) - 0.35);
export function glasgowCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Glasgow Cathedral footing outside retained terrain');
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
  high = coarse(ring('high')),
  aisles = coarse(ring('aisles')),
  transept = coarse(ring('transept')),
  tower = ring('tower'),
  spire = ring('spire'),
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
  along = (f, x, k = 0) => point(f, (x - f.a[k]) / (f.b[k] - f.a[k])),
  west = edge(high, [-1, 0]),
  _tc = mid(tower);
export function glasgowCathedralFields() {
  const hs = [];
  for (const [name, n] of [
    ['north', [0, -1]],
    ['south', [0, 1]],
  ]) {
    const hf = edge(high, n),
      af = edge(aisles, n);
    for (const x of [-43, -36, -29, -22, -15, 8, 15, 22, 29]) {
      for (const dx of [-1.0, 1.0])
        hs.push({
          ...hole(
            `clerestory-${name}-${x}-${dx}`,
            along(hf, x + dx),
            hf.axis,
            hf.normal,
            1.15,
            16.3,
            4.1,
            2.9,
          ),
          kind: 'window',
        });
      hs.push({
        ...hole(`aisle-${name}-${x}`, along(af, x), af.axis, af.normal, 2.9, 3.2, 8.5, 6.2),
        kind: 'window',
      });
    }
  }
  const p = point(west),
    b = glasgowCathedralGround(...p) + 0.22 - floor;
  hs.push({
    ...hole('west-entry', p, west.axis, west.normal, 3.2, b, 4.2, 2.8, 'pointed', 6),
    kind: 'door',
  });
  hs.push({
    ...hole('west-great-window', p, west.axis, west.normal, 7.0, 7.3, 13.2, 8.8, 'pointed', 5),
    kind: 'window',
  });
  const aw = edge(aisles, [-1, 0]);
  for (const t of [0.11, 0.89])
    hs.push({
      ...hole(
        `west-aisle-window-${t}`,
        point(aw, t),
        aw.axis,
        aw.normal,
        2.4,
        3.4,
        7.4,
        5.4,
        'pointed',
        5,
      ),
      kind: 'window',
    });
  for (const [name, n] of [
    ['north', [0, -1]],
    ['south', [0, 1]],
  ]) {
    const f = edge(transept, n);
    hs.push({
      ...hole(`transept-${name}`, point(f), f.axis, f.normal, 5.2, 5.7, 14.5, 10.6),
      kind: 'window',
    });
  }
  const east = edge(high, [1, 0]);
  for (const t of [0.28, 0.72])
    hs.push({
      ...hole(`east-upper-${t}`, point(east, t), east.axis, east.normal, 2.8, 17.5, 5.1, 3.4),
      kind: 'window',
    });
  for (const [name, n] of [
    ['north', [0, -1]],
    ['south', [0, 1]],
    ['east', [1, 0]],
  ]) {
    const f = edge(name === 'east' ? coarse(ring('chapter')) : aisles, n),
      xs = name === 'east' ? [0.2, 0.5, 0.8] : [0.87, 0.96];
    for (const t of xs) {
      const p = point(f, t);
      if (p[0] < 20) continue;
      const bottom = Math.max(-2.4, glasgowCathedralGround(...p) + 0.8 - floor);
      hs.push({
        ...hole(
          `lower-church-${name}-${t}`,
          p,
          f.axis,
          f.normal,
          1.25,
          bottom,
          2.2,
          1.5,
          'pointed',
          4,
        ),
        kind: 'window',
      });
    }
  }
  for (const name of ['chapter', 'sacristy']) {
    const r = coarse(ring(name));
    for (const n of [
      [1, 0],
      [0, name === 'chapter' ? 1 : -1],
    ]) {
      const f = edge(r, n);
      if (!f) continue;
      for (const t of [0.3, 0.7])
        hs.push({
          ...hole(
            `${name}-${n.join(',')}-${t}`,
            point(f, t),
            f.axis,
            f.normal,
            1.55,
            name === 'chapter' ? 4 : 6.2,
            name === 'chapter' ? 6.8 : 7.2,
            name === 'chapter' ? 5.1 : 5.4,
            'pointed',
            4,
          ),
          kind: 'window',
        });
    }
  }
  const entry = edge(coarse(ring('porch')), [0, -1]),
    entryPoint = point(entry),
    entryBase = glasgowCathedralGround(...entryPoint) + 0.22 - floor;
  hs.push({
    ...hole(
      'north-low-entry',
      entryPoint,
      entry.axis,
      entry.normal,
      1.25,
      entryBase,
      Math.min(2.35, 3.0 - entryBase),
      Math.min(1.55, (3.0 - entryBase) * 0.66),
      'pointed',
      4,
    ),
    kind: 'door',
  });
  const southRange = edge(coarse(ring('south')), [0, 1]);
  hs.push({
    ...hole(
      'south-range-end-window',
      point(southRange),
      southRange.axis,
      southRange.normal,
      2.4,
      2.1,
      2.0,
      1.35,
      'pointed',
      4,
    ),
    kind: 'window',
  });
  return hs;
}
export function glasgowCathedralBelfry(d = 3) {
  if (d === 0) return [];
  const hs = [];
  for (let i = 0; i < tower.length; i++) {
    const f = faceFrame(tower, i);
    for (const t of [0.3, 0.7])
      hs.push(
        hole(
          `crossing-belfry-${i}-${t}`,
          point(f, t),
          f.axis,
          f.normal,
          2.25,
          29.0,
          5.4,
          3.9,
          'pointed',
          4.5,
        ),
      );
  }
  return hs;
}
function panelWithRose(face, h, d) {
  if (h.name !== 'west-great-window' || d < 2) {
    panel(face, h, d);
    return;
  }
  pane(face, h, d, -0.75);
  archBand(face, h, d, 0.42, 'trim', 0.08);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    q = (u, y, o = -0.61) => p.point(u, floor + y, o * sg),
    N = d >= 3 ? 24 : 12,
    circle = (cx, cy, r, n = N) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n;
        return q(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }),
    r = circle(0, 18.05, 1.85);
  for (let i = 0; i < r.length; i++) beam(face, r[i], r[(i + 1) % r.length], 0.13, 'trim');
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    beam(
      face,
      q(0.35 * Math.cos(a), 18.05 + 0.35 * Math.sin(a)),
      q(1.75 * Math.cos(a), 18.05 + 1.75 * Math.sin(a)),
      0.11,
      'trim',
    );
    if (d >= 3) {
      const rr = circle(1.08 * Math.cos(a), 18.05 + 1.08 * Math.sin(a), 0.63, 8);
      for (let j = 0; j < rr.length; j++) beam(face, rr[j], rr[(j + 1) % rr.length], 0.1, 'trim');
    }
  }
  for (const off of [-1.55, 1.55]) {
    const hh = {
      ...h,
      center: h.center.map((v, k) => v + h.axis[k] * off),
      width: 2.65,
      bottom: floor + 7.5,
      height: 8.55,
      spring: 6.4,
    };
    archBand(face, hh, d, 0.13, 'trim', -0.59);
    beam(face, q(off, 7.5), q(off, 14.3), 0.13, 'trim');
  }
}
function oculus(face, d) {
  if (d === 0) return;
  const p = point(west),
    n = west.normal,
    a = west.axis,
    N = d >= 3 ? 20 : 12,
    ring = Array.from({ length: N }, (_, i) => {
      const t = (i * Math.PI * 2) / N;
      return [
        p[0] + a[0] * 0.63 * Math.cos(t) + n[0] * 0.035,
        floor + 23.1 + 0.63 * Math.sin(t),
        p[1] + a[1] * 0.63 * Math.cos(t) + n[1] * 0.035,
      ];
    });
  face('glass', ring, [n[0], 0, n[1]]);
  if (d >= 2) for (let i = 0; i < N; i++) beam(face, ring[i], ring[(i + 1) % N], 0.12, 'trim');
}
function pier(face, p, n, d, top = 13) {
  const a = [-n[1], n[0]],
    r = (dep, w) =>
      [
        [-w / 2, -0.12],
        [w / 2, -0.12],
        [w / 2, dep],
        [-w / 2, dep],
      ].map(([u, v]) => p.map((q, k) => q + a[k] * u + n[k] * v));
  for (const [b, t, dep, w] of d <= 1
    ? [[0, top, 1.25, 1.0]]
    : [
        [0, top * 0.5, 1.5, 1.25],
        [top * 0.5, top, 1, 0.9],
      ]) {
    const rr = r(dep, w);
    solid(face, rr, b === 0 ? footing : b, t, 'wall');
    if (d >= 2) band(face, rr, t - 0.18, 0.18, 'trim', 1.05);
  }
  if (d >= 2)
    profile(
      face,
      r(0.7, 0.75),
      [
        [top, 1],
        [top + 0.5, 1],
        [top + 2.6, 0.03],
      ],
      'trim',
    );
}
function buttresses(face, d) {
  for (const n of [
    [0, -1],
    [0, 1],
  ]) {
    const f = edge(aisles, n);
    for (const x of [-47, -39.5, -32.5, -25.5, -18.5, -11.5, 5, 11.5, 18.5, 25.5, 31.5])
      pier(face, along(f, x), f.normal, d, 13);
  }
  for (const f of [west, edge(high, [1, 0]), edge(transept, [0, -1]), edge(transept, [0, 1])])
    for (const t of [0.04, 0.96]) pier(face, point(f, t), f.normal, d, 21.1);
}
function mainRoof(face, d) {
  const hf = high,
    mb = bounds(hf),
    midZ = (mb[1] + mb[3]) / 2,
    rad = (mb[3] - mb[1]) / 2;
  gable(face, hf, 21, 27);
  gable(face, transept, 21, 27, 'roof', 1);
  for (const p of rec.lowRoofPlans) {
    const r = coarse(p.outline);
    cap(
      face,
      r,
      (q) => floor + Math.max(12.6, 15.3 - Math.max(0, Math.abs(q[1] - midZ) - rad) * 0.5),
      'roof',
      p.holes.map(coarse),
    );
  }
  if (d >= 1) {
    band(face, hf, 20.65, 0.35, 'trim', 1.012);
    band(face, aisles, 12.3, 0.2, 'trim', 1.012);
  }
  for (const [name, e, t, axis] of [
    ['chapter', 12.5, 17, 1],
    ['sacristy', 15, 21, 1],
    ['south', 4.7, 7, 1],
  ])
    gable(face, coarse(ring(name)), e, t, 'roof', axis);
  hip(face, coarse(ring('porch')), 3.2, 4);
}
function crossing(out, face, d) {
  const hs = glasgowCathedralBelfry(d);
  if (d >= 1) {
    shell(out, d, tower, 28.5, 35, hs, 'wall', scaled(tower, 0.72));
    if (d >= 2) for (const h of hs) archBand(face, h, d, 0.24, 'trim', 0.06);
  } else sides(face, tower, 28.5, 35, 'wall');
  cap(face, tower, 35, 'wall', [scaled(spire, 0.8)]);
  if (d >= 1) band(face, tower, 34.5, 0.5, 'trim', 1.04);
  profile(
    face,
    spire,
    [
      [35, 1],
      [44.9, 0.67],
      [45.7, 0.67],
      [60.9, 0.03],
    ],
    'spire',
  );
  if (d >= 1) band(face, scaled(spire, 0.69), 44.9, 0.4, 'trim', 1.03);
  beam(face, at(mid(spire), 60.8), at(mid(spire), 62), 0.15, 'accent');
  if (d >= 2) {
    for (const p of spire) {
      const c = center(spire),
        q = p.map((v, k) => c[k] + (v - c[k]) * 0.67),
        tip = p.map((v, k) => c[k] + (v - c[k]) * 0.03);
      beam(face, at(p, 35), at(q, 45.7), 0.14, 'trim');
      beam(face, at(q, 45.7), at(tip, 60.9), 0.12, 'trim');
    }
    for (const p of tower) {
      const r = [
        [p[0] - 0.35, p[1] - 0.35],
        [p[0] + 0.35, p[1] - 0.35],
        [p[0] + 0.35, p[1] + 0.35],
        [p[0] - 0.35, p[1] + 0.35],
      ];
      solid(face, r, 34.5, 35.2, 'trim');
      profile(
        face,
        r,
        [
          [35.2, 1.2],
          [38, 0.03],
        ],
        'spire',
      );
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
    fields = glasgowCathedralFields(),
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
  for (const layer of rec.wallLayers)
    for (const p of layer.polygons) {
      const r = d === 0 ? coarse(p.outline) : p.outline;
      if (d >= 2) shell(out, d, r, layer.bottom ?? footing, layer.top, fields, 'wall');
      else sides(face, r, layer.bottom ?? footing, layer.top, 'wall');
      cap(cut, r, layer.top, 'wall', p.holes);
    }
  if (d >= 2) for (const p of rec.main.polygons) sides(cut, p.outline, footing, 0.35, 'wall');
  mainRoof(cut, d);
  crossing(out, face, d);
  buttresses(cut, d);
  if (d >= 1) for (const h of fields) panelWithRose(face, h, d);
  oculus(face, d);
}
export const buildGlasgowCathedralSkyline = (o) => build(o, 0),
  buildGlasgowCathedralDistrict = (o) => build(o, 1),
  buildGlasgowCathedralStreet = (o) => build(o, 2),
  buildGlasgowCathedralCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const glasgowCathedralStudy = {
  id: 'N0365',
  key: 'glasgow_cathedral',
  title: 'Glasgow Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1473348',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID way102152591 matches current main and nine part controls; west great window, central stone spire and northern eastern ranges sign the frame.',
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
    'Four existing shared256-square ashlar, limestone, copper and plain wood graphs. Darker stone spire reuses the ashlar graph; gray stone/pale trim and copper-green roof tints use linear colors and metric UVs. Glass/accents are flat PBR vertex colors. No embedded images, bespoke facade textures or baked soot/shadows. Temporary scaffold not modeled.',
  importReason:
    'Four authored browser levels retain the long nave/choir, lean-to roofs, crossing stone spire, northern ranges and western Gothic window/portal at the signed site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three useful pictures and standard PMTiles/DEM. Current heights are approximate map envelopes; roof slopes, window/rose geometry, buttress rhythm, crypt windows/floor levels and thresholds are estimates. Exact stained-glass art, carvings/text, scaffolding, graveyard/retaining terraces, landscaping, full interiors and certified walking excluded. Physical device timing pending.',
    'Skyline preserves the long roofs, aisles/transepts, northern ranges and square/octagonal stone spire. District adds shared textures, flat glazing/doors, gable oculus and open belfry. Street adds recesses, paired lancets, stepped buttresses/pinnacles, portal bands, great-window circular tracery and spire ribs; closeup/master refine facets/petals. Synthetic context neighbors are not mapped Glasgow buildings.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-great-window-and-rose-tracery', [-88, 15, -1], [-48, 14, -4]),
    cam('crossing-belfry-and-tiered-stone-spire', [-37, 54, 47], [-3, 43, -4]),
    cam('east-choir-and-lower-church', [77, 24, -5], [33, 12, -4]),
    cam('south-paired-lancets-and-lean-to-aisle', [-22, 20, 57], [-22, 13, 2]),
    cam('north-chapter-sacristy-and-low-entry', [35, 28, -68], [26, 12, -18]),
    cam('copper-roofs-transepts-and-height-tiers', [0, 94, 2], [0, 15, -4]),
  ],
};

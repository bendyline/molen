/** Basilica of Saint Nicholas: unequal west towers, Romanesque arcades and flat eastern wall. */
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
  '../../../content/worldgen/source/places/sr/sr7/n0368_basilica_of_saint_nicholas/',
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
  wall: '#e7deca',
  spire: '#b48c7c',
  trim: '#eee5d3',
  roof: '#aa8b69',
  door: '#71533c',
  glass: '#414844',
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
const footing = (p) => Math.min(floor - 0.3, sanNicolaBariGround(...p) - 0.35);
export function sanNicolaBariGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Basilica of Saint Nicholas footing outside retained terrain');
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
function _profile(face, ring, levels, slot) {
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
function _panel(face, h, d) {
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
const plans = rec.plans,
  body = plans.body,
  west = faceFrame(body, body.length - 1),
  point = (f, t = 0.5) => lerp(f.a, f.b, t),
  along = (f, x, k = 0) => point(f, (x - f.a[k]) / (f.b[k] - f.a[k]));
// Keep the upper facade in the same slanted plane as the raw western outline.
const nave = plans.nave.map((p, i) => (i === 0 || i === 3 ? along(west, p[1], 1) : p)),
  transept = plans.transept;
const nZ = plans.aisleNorth[0][1],
  sZ = plans.aisleSouth[2][1],
  bayX = [-17.7, -11.8, -5.9, 0, 5.9, 11.8];
const side = (name) => ({
  a: [-25, name === 'south' ? sZ : nZ],
  b: [14, name === 'south' ? sZ : nZ],
  axis: [1, 0],
  normal: [0, name === 'south' ? 1 : -1],
  length: 39,
});
const window = (
  name,
  f,
  p,
  w,
  b,
  h,
  s = h - w / 2,
  kind = 'window',
  shape = 'round',
  depth = 5,
) => ({ ...hole(name, p, f.axis, f.normal, w, b, h, s, shape, depth), kind });
export function sanNicolaBariFields() {
  const fields = [];
  for (const [j, z] of [-9, 0, 10].entries()) {
    fields.push(
      window(
        `west-door-${j}`,
        west,
        along(west, z, 1),
        j === 1 ? 3.8 : 2.7,
        0.2,
        j === 1 ? 7.1 : 4.5,
        j === 1 ? 5.2 : 4.5,
        'door',
        j === 1 ? 'round' : 'rect',
        6,
      ),
    );
    fields.push(window(`west-lower-window-${j}`, west, along(west, z, 1), 1.7, 12, 3.5, 2.65));
  }
  for (const z of [-5.2, 0, 5.2])
    for (const off of [-0.52, 0.52])
      fields.push(
        window(`west-paired-${z}-${off}`, west, along(west, z + off, 1), 0.76, 19.2, 3.0, 2.62),
      );
  for (const off of [-0.5, 0.5])
    fields.push(window(`west-upper-pair-${off}`, west, along(west, off, 1), 0.72, 23.1, 2.7, 2.34));
  const oc = window('west-oculus', west, along(west, 0, 1), 1.85, 26.7, 1.85, 0.925);
  oc.bottom = floor + 26.7;
  oc.shape = 'circle';
  fields.push(oc);
  for (const name of ['north', 'south']) {
    const f = side(name);
    for (const [i, x] of bayX.entries()) {
      fields.push(
        window(
          `${name}-lower-arcade-${i}`,
          f,
          [x, f.a[1]],
          4.7,
          0,
          10.8,
          8.45,
          'arcade',
          'round',
          6,
        ),
      );
      const inner = { ...f, a: [f.a[0], f.a[1] - f.normal[1] * 2.4] };
      fields.push(
        window(
          `${name}-inner-${i}`,
          inner,
          [x, inner.a[1]],
          i === 1 ? 2.4 : 1.15,
          i === 1 ? 0.2 : 7.1,
          i === 1 ? 5.0 : 3.0,
          i === 1 ? 3.8 : 2.42,
          i === 1 ? 'door' : 'window',
        ),
      );
    }
    for (let g = 0; g < 5; g++)
      for (let j = 0; j < 3; j++)
        fields.push(
          window(
            `${name}-gallery-${g}-${j}`,
            f,
            [-17.2 + g * 6.8 + (j - 1) * 1.55, f.a[1]],
            1.22,
            15.0,
            3.4,
            2.79,
            'gallery',
            'round',
            5,
          ),
        );
  }
  const east = edge(body, [1, 0]);
  fields.push(window('east-central-barred', east, point(east), 3.8, 8.8, 7.5, 5.6));
  for (const z of [-10, 10]) {
    for (const off of [-0.56, 0.56])
      fields.push(
        window(`east-pair-${z}-${off}`, east, along(east, z + off, 1), 0.82, 10.1, 4.1, 3.69),
      );
  }
  for (const z of [-11, -5.5, 5.5, 11])
    for (const off of [-0.5, 0.5])
      fields.push(
        window(`east-upper-${z}-${off}`, east, along(east, z + off, 1), 0.74, 19.2, 3.6, 3.23),
      );
  for (const z of [-12, -7, 7, 12])
    fields.push(window(`east-slit-${z}`, east, along(east, z, 1), 0.9, 2.5, 2.2, 1.75));
  for (const name of ['north', 'south']) {
    const f = edge(transept, [0, name === 'south' ? 1 : -1]),
      p = point(f);
    for (const off of [-3.7, 3.7])
      for (const u of [-0.5, 0.5])
        fields.push(
          window(
            `${name}-transept-pair-${off}-${u}`,
            f,
            [p[0] + off + u, p[1]],
            0.73,
            15.0,
            4,
            3.635,
          ),
        );
    fields.push(window(`${name}-transept-centre`, f, p, 2.3, 9.1, 5.0, 3.85));
    const o = window(`${name}-transept-oculus`, f, p, 1.6, 25.1, 1.6, 0.8);
    o.shape = 'circle';
    fields.push(o);
  }
  for (const name of ['northTower', 'southTower']) {
    const r = plans[name];
    if (name === 'southTower')
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        if (f.length < 5) continue;
        fields.push(
          window(`south-belfry-${i}`, f, point(f), 3.4, 20.5, 4.8, 3.1, 'belfry', 'round', 15),
        );
      }
    const f = edge(r, [-1, 0]);
    fields.push(
      window(
        `${name}-west-slit`,
        f,
        point(f),
        0.65,
        name === 'southTower' ? 11.5 : 8.5,
        2.5,
        2.175,
      ),
    );
    if (name === 'northTower')
      fields.push(window('north-tower-door', f, point(f), 2.5, 0.2, 5.6, 4.35, 'door', 'round', 6));
  }
  return fields;
}
// A small circular field is represented by two matching semicircles, without a bespoke image.
function circleField(face, h, d) {
  const f = prepareOpening(h, 0, d),
    sg = Math.sign(-f.axis[1] * h.normal[0] + f.axis[0] * h.normal[1]),
    n = d >= 3 ? 16 : 8,
    r = h.width / 2,
    cy = h.bottom + r,
    outer = Array.from({ length: n }, (_, i) => [
      Math.cos((i * 2 * Math.PI) / n) * r,
      cy + Math.sin((i * 2 * Math.PI) / n) * r,
    ]);
  face(
    'glass',
    outer.map((p) => f.point(...p, 0.1 * sg)),
    [h.normal[0], 0, h.normal[1]],
  );
  if (d >= 1)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        ext = (p) => [(p[0] * (r + 0.28)) / r, cy + ((p[1] - cy) * (r + 0.28)) / r];
      face(
        'trim',
        [
          f.point(...outer[i], 0.14 * sg),
          f.point(...outer[j], 0.14 * sg),
          f.point(...ext(outer[j]), 0.14 * sg),
          f.point(...ext(outer[i]), 0.14 * sg),
        ],
        [h.normal[0], 0, h.normal[1]],
      );
    }
}
function facade(face, h, d) {
  if (h.kind === 'arcade' || h.kind === 'belfry') return;
  if (h.shape === 'circle') {
    circleField(face, h, d);
    return;
  }
  const offset = d < 2 ? 0.06 : h.kind === 'gallery' ? -1.75 : -0.75;
  pane(face, h, d, offset, h.kind === 'door' ? 'door' : h.kind === 'gallery' ? 'accent' : 'glass');
  if (d >= 2) archBand(face, h, d, h.kind === 'gallery' ? 0.18 : 0.3);
  if (d >= 2 && h.kind === 'window' && h.name.includes('east-central')) {
    const p = prepareOpening(h, 0, d),
      sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
    for (let u = -1.5; u <= 1.5; u += 0.6)
      beam(
        face,
        p.point(u, h.bottom, -0.68 * sg),
        p.point(u, h.bottom + h.spring, -0.68 * sg),
        0.07,
        'accent',
      );
    for (let y = 0.8; y < h.spring; y += 0.9)
      beam(
        face,
        p.point(-1.7, h.bottom + y, -0.65 * sg),
        p.point(1.7, h.bottom + y, -0.65 * sg),
        0.07,
        'accent',
      );
  }
}
function blind(face, f, from, to, y, w, d) {
  const count = Math.max(1, Math.round(Math.abs(to - from) / w)),
    segments = d >= 3 ? 8 : 4;
  for (let i = 0; i < count; i++) {
    const x = from + ((to - from) * (i + 0.5)) / count,
      p = along(f, x, Math.abs(f.axis[0]) > 0.5 ? 0 : 1),
      r = (Math.abs(to - from) / count) * 0.44;
    const point = (a, rad) => [
      p[0] + f.axis[0] * Math.cos(a) * rad + f.normal[0] * 0.12,
      floor + y + Math.sin(a) * rad,
      p[1] + f.axis[1] * Math.cos(a) * rad + f.normal[1] * 0.12,
    ];
    for (let j = 0; j < segments; j++) {
      const a = (j * Math.PI) / segments,
        b = ((j + 1) * Math.PI) / segments;
      face(
        'trim',
        [point(a, r), point(b, r), point(b, r + 0.16), point(a, r + 0.16)],
        [f.normal[0], 0, f.normal[1]],
      );
    }
  }
}
function portal(face, d) {
  const p = along(west, 0, 1),
    n = west.normal,
    a = west.axis,
    atP = (u, y, o) => [p[0] + a[0] * u + n[0] * o, floor + y, p[1] + a[1] * u + n[1] * o];
  for (const u of [-2.6, 2.6]) {
    beam(face, atP(u, 0.2, 0.7), atP(u, 6.4, 0.7), 0.38);
    solid(
      face,
      _R(
        p[0] + a[0] * u - 0.3,
        p[1] + a[1] * u - 0.3,
        p[0] + a[0] * u + 0.3,
        p[1] + a[1] * u + 0.3,
      ),
      0.2,
      0.55,
      'trim',
    );
  }
  for (const sg of [-1, 1]) beam(face, atP(sg * 2.9, 6.5, 0.9), atP(0, 9.9, 0.9), 0.42);
  face('wall', [atP(-2.8, 6.6, 0.6), atP(2.8, 6.6, 0.6), atP(0, 9.75, 0.6)], [n[0], 0, n[1]]);
  face(
    'roof',
    [atP(-3, 6.55, 0), atP(-3, 6.55, 1.4), atP(0, 10.0, 1.4), atP(0, 10.0, 0)],
    [0, 1, 0],
  );
  face('roof', [atP(3, 6.55, 0), atP(0, 10.0, 0), atP(0, 10.0, 1.4), atP(3, 6.55, 1.4)], [0, 1, 0]);
  if (d >= 3)
    archBand(face, window('portal-mould', west, p, 4.3, 0.2, 7.7, 5.55), d, 0.35, 'trim', 0.25);
}
function build(target, d) {
  const limit = d === 0 ? 30 : d === 1 ? 20 : 14,
    out = {
      addTriangle(slot, ref, p, n, uv, col) {
        const lengths = [0, 1, 2].map((i) =>
            Math.hypot(...p[i].map((v, k) => v - p[(i + 1) % 3][k])),
          ),
          idx = lengths.indexOf(Math.max(...lengths));
        if (lengths[idx] > limit) {
          const j = (idx + 1) % 3,
            k = (idx + 2) % 3,
            m = lerp(p[idx], p[j], 0.5),
            um = lerp(uv[idx], uv[j], 0.5);
          out.addTriangle(slot, ref, [p[idx], m, p[k]], n, [uv[idx], um, uv[k]], col);
          out.addTriangle(slot, ref, [m, p[j], p[k]], n, [um, uv[j], uv[k]], col);
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
        target.addTriangle(slot, ref, p, n, uv, col);
      },
    },
    face = writer(out, d),
    fields = sanNicolaBariFields(),
    detail = d === 2 ? 1 : d,
    hs = fields.filter((h) => h.shape !== 'circle').map((h) => prepareOpening(h, 0, detail)),
    cut = d >= 2 ? writer(masked(out, hs), d) : face;
  if (d >= 2) {
    shell(
      out,
      d,
      body,
      footing,
      20.5,
      fields.filter((h) => h.shape !== 'circle'),
    );
    // Side recess backing walls are separate, set2.4m behind the arcade face.
    for (const name of ['north', 'south']) {
      const f = side(name),
        z = f.a[1] - f.normal[1] * 2.4,
        r = _R(-25, Math.min(z, z - f.normal[1] * 0.45), 14, Math.max(z, z - f.normal[1] * 0.45));
      shell(
        out,
        d,
        r,
        footing,
        13.5,
        fields.filter((h) => h.name.startsWith(`${name}-inner`)),
      );
      cap(face, r, 13.5, 'wall');
    }
  } else sides(face, body, footing, 20.5, 'wall');
  if (d >= 2) sides(cut, rec.main.polygons[0].outline, footing, 0.35, 'wall');
  shell(out, d, nave, 20.5, 25, d >= 2 ? fields.filter((h) => h.shape !== 'circle') : []);
  gable(cut, nave, 25, 29.8);
  // The low north tower ends below the side shoulder; the raw main bevel needs an upper infill.
  const nr = rec.main.polygons[0].outline,
    np = along(west, nZ, 1),
    shoulder = [np, nr[10], nr[1]];
  sides(cut, shoulder, 18.8, 20.5, 'wall');
  cap(cut, shoulder, 20.5, 'wall');
  shell(out, d, transept, 20.5, 24, d >= 2 ? fields.filter((h) => h.shape !== 'circle') : []);
  gable(cut, transept, 24, 29, 'roof', 1);
  for (const name of ['north', 'south']) {
    const r = plans[name === 'north' ? 'aisleNorth' : 'aisleSouth'],
      outer = name === 'south' ? sZ : nZ,
      inner = name === 'south' ? 8.2 : -7.8;
    face(
      'roof',
      [
        at([r[0][0], outer], 20.5),
        at([14, outer], 20.5),
        at([14, inner], 24),
        at([r[0][0], inner], 24),
      ],
      [0, 1, 0],
    );
    const f = { ...west },
      a = along(west, outer, 1),
      b = along(west, inner, 1);
    cut('wall', [at(a, 20.5), at(b, 20.5), at(b, 24)], [f.normal[0], 0, f.normal[1]]);
  }
  for (const [name, top] of [
    ['northTower', 18.8],
    ['southTower', 27.5],
  ]) {
    const r = plans[name],
      towerHoles = fields.filter(
        (h) =>
          h.name.startsWith(name === 'southTower' ? 'south-belfry' : 'north-tower') ||
          h.name.startsWith(name),
      );
    // Preserve belfry through-openings even at skyline/district.
    shell(
      out,
      d,
      r,
      footing,
      top,
      d >= 2 ? towerHoles : towerHoles.filter((h) => h.kind === 'belfry'),
    );
    cap(face, r, top, 'trim');
    if (d >= 1) {
      band(face, r, top - 0.45, 0.3);
      if (name === 'northTower') band(face, r, 7.8, 0.22);
    }
  }
  if (d >= 1) {
    for (const h of fields) facade(face, h, d);
    portal(face, d);
    if (d >= 2) {
      blind(face, west, -13.5, -6, 6.2, 7.5, d);
      blind(face, west, 6.5, 14, 6.2, 7.5, d);
      blind(face, west, -7.2, 7.8, 24.5, 1.4, d);
    }
    for (const name of ['north', 'south']) {
      const f = side(name);
      band(face, _R(-25, f.a[1] - 0.08, 14, f.a[1] + 0.08), 19.7, 0.22, 'trim', 1);
      if (d >= 2) {
        for (const h of fields.filter((h) => h.name.startsWith(`${name}-lower-arcade`)))
          archBand(face, h, d, 0.32, 'trim', 0.1);
        blind(face, f, -24, 14, 19.1, 1.3, d);
      }
    }
    // Wide western pilasters and eastern blind-arcade divisions.
    for (const z of [-7.6, 7.8]) {
      const p = along(west, z, 1);
      beam(face, at(p, 0.2), at(p, 24.8), 0.4);
    }
    if (d >= 2) {
      const f = edge(body, [1, 0]);
      for (const z of [-13, -6, 6, 13]) {
        const p = along(f, z, 1);
        beam(face, at(p, 0.2), at(p, 5.2), 0.3);
      }
      blind(face, f, -14, 15, 5.2, 5.8, d);
    }
  }
}
export const buildSanNicolaBariSkyline = (o) => build(o, 0),
  buildSanNicolaBariDistrict = (o) => build(o, 1),
  buildSanNicolaBariStreet = (o) => build(o, 2),
  buildSanNicolaBariCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const sanNicolaBariStudy = {
  id: 'N0368',
  key: 'basilica_of_saint_nicholas',
  title: 'Basilica of Saint Nicholas',
  category: 'cathedral',
  wikidataId: 'Q550514',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID raw main envelope, western triple portals/unequal towers and flat east wall sign the long southern edge.',
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
    'Four existing shared256-square ashlar/limestone/flat tile/plain wood graphs. Cream linear tints, metric UVs and flat normals; glazing/recesses use flat geometric PBR colors. No embedded images, bespoke textures or baked shadows.',
  importReason:
    'Four authored browser tiers retain unequal towers, triple portal/gabled canopy, round side arcades/grouped galleries and flat eastern wall at the signed map site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior from three inspected west/south/east pictures and standard viewer PMTiles/DEM only. North side rhythm inferred. Exact reliefs/statues/inscriptions, tiny carving, interiors, neighboring town fabric, parking/railings and surveyed paving/thresholds/walking excluded. Oculi are framed geometric dark disks. Physical device timing pending.',
    'Skyline retains stepped roof/tower silhouette and open south belfry. District adds shared surfaces and flat doors/windows/gallery fields. Street opens lower side recesses, upper gallery cavities and door/window recesses; closeup/master refine rounded arch bands, window bars and canopy moulds. Synthetic neighbors are review fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-triple-portal-and-gable', [-76, 20, -2], [-28, 14, 1]),
    cam('unequal-western-towers', [-65, 36, 47], [-27, 16, 1]),
    cam('south-lower-arcade-and-upper-gallery', [-4, 15, 53], [-5, 12, 17]),
    cam('eastern-flat-wall-and-barred-window', [72, 19, 5], [31, 13, 1]),
    cam('south-transept-gable', [25, 25, 63], [22, 18, 17]),
    cam('roof-and-signed-plan', [0, 102, 1], [0, 12, 1]),
  ],
};

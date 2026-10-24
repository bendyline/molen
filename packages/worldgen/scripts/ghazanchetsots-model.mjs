/** Ghazanchetsots Cathedral: faceted central drum/cone, three porches and detached arcaded belfry. */
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
  '../../../content/worldgen/source/places/tp/tp1/ghazanchetsots_cathedral/',
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
  wall: '#e4dbc6',
  spire: '#a9a497',
  trim: '#f0e4cf',
  roof: '#9ca6b0',
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
const footing = (p) => Math.min(floor - 0.3, ghazanchetsotsGround(...p) - 0.35);
export function ghazanchetsotsGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Ghazanchetsots Cathedral footing outside retained terrain');
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
function _gable(face, r, eave, top, slot = 'roof', axis = 0) {
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
  bc = mid(ring('bell')),
  bellY = rec.bellDatumOffset,
  regular = (c, r, n = 8) =>
    Array.from({ length: n }, (_, i) => {
      const a = Math.PI / 8 + (i * Math.PI * 2) / n;
      return [c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)];
    }),
  drum = (d) => regular(rec.roofCenter, 5.9, d === 0 ? 8 : 16),
  bellMiddle = regular(bc, 3.35),
  bellUpper = regular(bc, 3.05),
  backFace = (name) => {
    const f = faceFrame(
      [rec.porchPlans[name][0], rec.porchPlans[name].at(-1), rec.porchPlans[name][2]],
      0,
    );
    return { ...f, normal: f.normal.map((v) => -v) };
  };
function exteriorPorchFaces(name) {
  const r = rec.porchPlans[name],
    back = point(backFace(name));
  return r
    .map((_, i) => faceFrame(r, i))
    .filter(
      (f, i) => i !== r.length - 1 && Math.hypot(...point(f).map((v, k) => v - back[k])) > 4.2,
    )
    .sort(
      (a, b) =>
        b.normal[0] * (name === 'west' ? -1 : 0) +
        b.normal[1] * (name === 'north' ? -1 : name === 'south' ? 1 : 0) -
        (a.normal[0] * (name === 'west' ? -1 : 0) +
          a.normal[1] * (name === 'north' ? -1 : name === 'south' ? 1 : 0)),
    )
    .slice(0, 2);
}
export function ghazanchetsotsFields(d = 3) {
  const hs = [];
  for (const name of ['west', 'north', 'south']) {
    for (const [fno, f] of exteriorPorchFaces(name).entries()) {
      const p = point(f),
        base = 0.2;
      hs.push({
        ...hole(
          `${name}-porch-door-${fno}`,
          p,
          f.axis,
          f.normal,
          Math.min(2.1, f.length * 0.38),
          base,
          7.65 - base,
          6.2 - base,
          'round',
          6,
        ),
        kind: 'door',
      });
    }
    const f = backFace(name),
      p = point(f);
    for (const [part, w, b, h] of [
      ['horizontal', 1.8, 12.05, 0.48],
      ['vertical', 0.48, 11.15, 2.35],
    ])
      hs.push({
        ...hole(`${name}-cross-${part}`, p, f.axis, f.normal, w, b, h, h, 'rect', 5),
        kind: 'cross',
      });
  }
  for (const name of ['north', 'south']) {
    const n = [0, name === 'north' ? -1 : 1],
      core = rec.corePlans[0].outline;
    for (const x of [-12.5, 12.5]) {
      const candidates = core
          .map((_, i) => faceFrame(core, i))
          .filter(
            (f) =>
              f.normal[1] * n[1] > 0.85 &&
              Math.min(f.a[0], f.b[0]) < x &&
              Math.max(f.a[0], f.b[0]) > x,
          ),
        f = candidates[0];
      if (!f) throw Error(`Missing exposed side wall ${name}${x}`);
      const p = lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0]));
      hs.push({
        ...hole(`${name}-tall-window-${x}`, p, f.axis, f.normal, 1.7, 2.1, 7.6, 6.7, 'round', 5),
        kind: 'window',
      });
    }
  }
  for (const f of rec.corePlans[0].outline
    .map((_, i) => faceFrame(rec.corePlans[0].outline, i))
    .filter((f) => Math.abs(f.normal[0]) > 0.85 && f.length > 4.5 && Math.abs(point(f)[1]) > 6))
    hs.push({
      ...hole(
        `end-flank-${f.a.join(',')}`,
        point(f),
        f.axis,
        f.normal,
        1.6,
        2.2,
        7.3,
        6.5,
        'round',
        5,
      ),
      kind: 'window',
    });
  const apse = rec.porchPlans.east;
  for (const [fno, f] of apse
    .map((_, i) => faceFrame(apse, i))
    .filter((f) => f.normal[0] > 0.65)
    .entries())
    hs.push({
      ...hole(`east-apse-${fno}`, point(f), f.axis, f.normal, 1.2, 2.4, 6.7, 5.9, 'round', 5),
      kind: 'window',
    });
  const dr = drum(d);
  for (let i = 0; i < dr.length; i++) {
    const f = faceFrame(dr, i);
    hs.push({
      ...hole(
        `drum-${i}`,
        point(f),
        f.axis,
        f.normal,
        d === 0 ? 1.3 : 1.15,
        15.6,
        6.1,
        5.3,
        'round',
        4,
      ),
      kind: 'window',
    });
  }
  return hs;
}
export function ghazanchetsotsBelfry(d = 3) {
  const hs = [],
    base = ring('bell');
  for (const [n, i] of [
    [[-1, 0], 0],
    [[1, 0], 1],
    [[0, -1], 2],
    [[0, 1], 3],
  ]) {
    if (d === 0 && i > 1) continue;
    const f = edge(base, n),
      p = point(f),
      b = ghazanchetsotsGround(...p) + 0.22 - floor;
    hs.push(
      hole(
        `bell-base-${i}`,
        p,
        f.axis,
        f.normal,
        2.0,
        b,
        bellY + 3.1 - b,
        bellY + 2.2 - b,
        'round',
        6,
      ),
    );
  }
  for (const [name, r, b, h, s, w] of [
    ['middle', bellMiddle, 3.85, 2.15, 1.4, 1.5],
    ['upper', bellUpper, 6.85, 2.6, 1.85, 1.55],
  ]) {
    if (d === 0 && name === 'middle') continue;
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      hs.push(
        hole(`bell-${name}-${i}`, point(f), f.axis, f.normal, w, bellY + b, h, s, 'round', 5),
      );
    }
  }
  return hs;
}
function glazed(face, h, d) {
  const slot = h.kind === 'door' ? 'door' : 'glass';
  pane(face, h, d, d >= 2 ? -0.75 : 0.065, slot);
  if (d < 2 || h.kind === 'cross') return;
  archBand(face, h, d, h.kind === 'door' ? 0.28 : 0.18, 'trim', 0.08);
  const p = prepareOpening(h, 0, d),
    sg = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]),
    Q = (u, y) => p.point(u, y, -0.62 * sg);
  if (h.kind === 'door') {
    beam(face, Q(0, h.bottom), Q(0, h.bottom + h.spring), 0.1, 'accent');
    return;
  }
  beam(face, Q(0, h.bottom), Q(0, h.bottom + h.spring), 0.08, 'accent');
  if (d >= 3)
    for (const f of [0.28, 0.58])
      beam(
        face,
        Q(-h.width * 0.43, h.bottom + h.spring * f),
        Q(h.width * 0.43, h.bottom + h.spring * f),
        0.075,
        'accent',
      );
}
const roofY = (p) =>
  10.8 +
  3.5 *
    Math.max(
      0,
      1 -
        Math.min(Math.abs(p[0] - rec.roofCenter[0]) / 6.8, Math.abs(p[1] - rec.roofCenter[1]) / 11),
    );
function onCore(p) {
  return rec.corePlans.some((poly) =>
    poly.outline.some((a, i) => {
      const b = poly.outline[(i + 1) % poly.outline.length],
        v = b.map((v, k) => v - a[k]),
        len = Math.hypot(...v),
        t = p.map((v, k) => v - a[k]).reduce((s, v, k) => s + v * (b[k] - a[k]), 0) / (len * len);
      return (
        t > -0.001 &&
        t < 1.001 &&
        Math.hypot(...p.map((v, k) => v - a[k] - (b[k] - a[k]) * t)) < 0.001
      );
    }),
  );
}
function roofs(face, d) {
  for (const p of rec.roofPlans) {
    cap(face, p.outline, (q) => floor + roofY(q), 'roof', p.holes);
    for (let i = 0; i < p.outline.length; i++) {
      const f = faceFrame(p.outline, i);
      if (onCore(point(f)))
        face(
          'wall',
          [at(f.a, 10.8), at(f.b, 10.8), at(f.b, roofY(f.b)), at(f.a, roofY(f.a))],
          [f.normal[0], 0, f.normal[1]],
        );
    }
  }
  for (const name of ['west', 'north', 'south']) {
    const r = rec.porchPlans[name];
    hip(face, r, 8.2, 10.1);
    if (d >= 1)
      for (const f of exteriorPorchFaces(name)) {
        const p = point(f);
        face('wall', [at(f.a, 8.2), at(f.b, 8.2), at(p, 9.75)], [f.normal[0], 0, f.normal[1]]);
        if (d >= 2) {
          beam(face, at(f.a, 8.25), at(p, 9.8), 0.17, 'trim');
          beam(face, at(p, 9.8), at(f.b, 8.25), 0.17, 'trim');
        }
      }
  }
  hip(face, rec.porchPlans.east, 10.8, 13);
}
function crosses(face, c, y, h = 1.2, w = 0.12) {
  beam(face, at(c, y), at(c, y + h), w, 'accent');
  beam(
    face,
    at([c[0] - 0.32, c[1]], y + h * 0.67),
    at([c[0] + 0.32, c[1]], y + h * 0.67),
    w,
    'accent',
  );
}
function entranceSteps(face, d, fields) {
  for (const h of fields.filter((h) => h.kind === 'door')) {
    const near = h.center.map((v, k) => v + h.normal[k] * 0.25),
      top = h.bottom,
      run = Math.max(1.5, (top - ghazanchetsotsGround(...near)) * 1.4),
      end = near.map((v, k) => v + h.normal[k] * run),
      low = Math.min(top - 0.15, ghazanchetsotsGround(...end) + 0.22),
      rise = top - low,
      width = h.width + 0.7,
      rect = (a, b) =>
        [
          [-width / 2, a],
          [width / 2, a],
          [width / 2, b],
          [-width / 2, b],
        ].map(([u, v]) => near.map((q, k) => q + h.axis[k] * u + h.normal[k] * v));
    if (d <= 1) {
      const r = rect(0, run),
        height = (p) =>
          top -
          rise *
            Math.max(
              0,
              Math.min(
                1,
                p.map((v, k) => v - near[k]).reduce((s, v, k) => s + v * h.normal[k], 0) / run,
              ),
            );
      sides(face, r, footing, height, 'wall');
      cap(face, r, height, 'wall');
    } else {
      const steps = Math.min(18, Math.max(2, Math.ceil(rise / 0.3)));
      for (let i = 0; i < steps; i++)
        solid(
          face,
          rect((run * i) / steps, (run * (i + 1)) / steps),
          footing,
          top - floor - (rise * i) / steps,
          'wall',
        );
    }
  }
}
function mainDrum(out, face, d, fields) {
  const r = drum(d),
    holes = fields.filter((h) => h.name.startsWith('drum-'));
  if (d >= 2) shell(out, d, r, 14.3, 22.5, holes);
  else sides(face, r, 14.3, 22.5, 'wall');
  cap(face, r, 22.5, 'wall');
  if (d >= 1) {
    band(face, r, 14.9, 0.4, 'trim', 1.035);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        p = point(f);
      face('wall', [at(f.a, 22.5), at(f.b, 22.5), at(p, 23.3)], [f.normal[0], 0, f.normal[1]]);
      if (d >= 2) {
        beam(face, at(f.a, 22.53), at(p, 23.38), 0.14, 'trim');
        beam(face, at(p, 23.38), at(f.b, 22.53), 0.14, 'trim');
        beam(face, at(f.a, 15.4), at(f.a, 22.5), 0.19, 'trim');
      }
    }
  }
  profile(
    face,
    scaled(r, 1.06),
    [
      [22.5, 1],
      [33.5, 0.025],
    ],
    'roof',
  );
  crosses(face, rec.roofCenter, 33.5, 1.2, d === 0 ? 0.18 : 0.12);
}
function arcade(face, d, r, b, t, holes) {
  const inner = scaled(r, 0.78);
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i),
      fi = faceFrame(inner, i),
      h = holes.find((h) => h.name.endsWith(`-${i}`)),
      shape = openingShape(h, d),
      Q = (u, y, inside = false) => {
        const p = point(inside ? fi : f);
        return [p[0] + f.axis[0] * u, y, p[1] + f.axis[1] * u];
      };
    for (const inside of [false, true]) {
      const len = (inside ? fi : f).length,
        polygon = [
          [-len / 2, floor + b],
          [len / 2, floor + b],
          [len / 2, floor + t],
          [-len / 2, floor + t],
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
  cap(face, r, t, 'wall', [inner]);
}
function bell(out, face, d, openings) {
  const base = ring('bell'),
    levels = [
      [base, footing, bellY + 3.5, 'base', 0.55],
      [bellMiddle, bellY + 3.5, bellY + 6.5, 'middle', 0.78],
      [bellUpper, bellY + 6.5, bellY + 10.0, 'upper', 0.78],
    ];
  for (const [r, b, t, name, scale] of levels) {
    const hs = openings.filter((h) => h.name.startsWith(`bell-${name}-`));
    if (d === 0 && name === 'base') {
      for (const p of r) {
        const c = p.map((v, k) => v * 0.8 + bc[k] * 0.2);
        solid(
          face,
          [
            [c[0] - 0.48, c[1] - 0.48],
            [c[0] + 0.48, c[1] - 0.48],
            [c[0] + 0.48, c[1] + 0.48],
            [c[0] - 0.48, c[1] + 0.48],
          ],
          footing,
          bellY + 3.3,
          'wall',
        );
      }
      solid(face, r, bellY + 3.3, t, 'wall');
    } else if (d <= 1 && hs.length && name !== 'base') arcade(face, d, r, b, t, hs);
    else if (hs.length) shell(out, d, r, b, t, hs, 'wall', scaled(r, scale));
    else solid(face, r, b, t, 'wall');
    if (d >= 1) band(face, r, t - 0.2, 0.22, 'trim', 1.04);
  }
  if (d >= 2) for (const h of openings) archBand(face, h, d, 0.16, 'trim', 0.04);
  profile(
    face,
    scaled(bellUpper, 1.09),
    [
      [bellY + 10.0, 1],
      [bellY + 14.3, 0.025],
    ],
    'spire',
  );
  if (d >= 1)
    for (let i = 0; i < bellUpper.length; i++) {
      const f = faceFrame(bellUpper, i),
        p = point(f);
      face(
        'wall',
        [at(f.a, bellY + 10.0), at(f.b, bellY + 10.0), at(p, bellY + 10.7)],
        [f.normal[0], 0, f.normal[1]],
      );
      if (d >= 2) {
        beam(face, at(f.a, bellY + 10.05), at(p, bellY + 10.75), 0.14, 'trim');
        beam(face, at(p, bellY + 10.75), at(f.b, bellY + 10.05), 0.14, 'trim');
      }
    }
  crosses(face, bc, bellY + 14.3, 0.7, d === 0 ? 0.15 : 0.1);
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
    fields = ghazanchetsotsFields(d),
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
  for (const [p, b, t] of [
    [rec.main.polygons[0], footing, 8.2],
    ...rec.upperPlans.map((p) => [p, 8.2, 10.8]),
  ]) {
    if (d >= 2) shell(out, d, p.outline, b, t, fields);
    else sides(face, p.outline, b, t, 'wall');
    cap(cut, p.outline, t, 'wall', p.holes);
  }
  roofs(cut, d);
  entranceSteps(face, d, fields);
  mainDrum(out, face, d, fields);
  bell(out, face, d, ghazanchetsotsBelfry(d));
  if (d >= 1) {
    for (const h of fields) glazed(face, h, d);
    band(cut, rec.main.polygons[0].outline, 0.2, 0.3, 'trim', 1.012);
    band(cut, rec.main.polygons[0].outline, 1.15, 0.18, 'trim', 1.008);
  }
  if (d >= 2) {
    for (const p of rec.corePlans[0].outline) {
      beam(cut, at(p, 0.3), at(p, 10.7), 0.27, 'trim');
    }
  }
}
export const buildGhazanchetsotsSkyline = (o) => build(o, 0),
  buildGhazanchetsotsDistrict = (o) => build(o, 1),
  buildGhazanchetsotsStreet = (o) => build(o, 2),
  buildGhazanchetsotsCloseup = (o) => build(o, 3);
const cam = (name, p, look) => ({
  name,
  position: [p[0], floor + p[1], p[2]],
  lookAt: [look[0], floor + look[1], look[2]],
  fov: 48,
});
export const ghazanchetsotsStudy = {
  id: 'ghazanchetsots_cathedral',
  key: 'ghazanchetsots_cathedral',
  title: 'Ghazanchetsots Cathedral',
  category: 'cathedral',
  wikidataId: 'Q2001493',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Exact-QID main and separate western bell plans. Long southern wall defines axis; western bell/portal sign it.',
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
    'Four existing shared256-square ashlar/limestone/standing-seam metal/wood graphs. Main walls and bell cone share ashlar with linear tints; metric UVs. Glazing/accents are flat PBR colors. No embedded images, bespoke facade textures or baked shadows.',
  importReason:
    'Four authored browser levels preserve the individual drum/cone, three faceted porches and detached western arcaded bell tower at the signed mapped site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Medium-fi exterior based on three inspected2018–2019 pictures and standard PMTiles/DEM only. Later restoration changes unverified. Exact carving/statues/inscriptions, small stained-glass designs, surveyed paved terraces/stairs, landscaping, full interiors and certified walking excluded. Physical device timing pending.',
    'Skyline keeps body/porches, faceted drum/cone and separate bell with open base/upper stage. District adds shared textures, flat glazing/doors and open middle arcade. Street adds true facade recesses, roof/gable trim, narrow windows/cross lights and structural bands. Closeup/master refine facets and window bars. Synthetic cottage neighbors are review fixtures.',
  ],
  camera: scope.camera,
  qaCameras: [
    cam('west-porches-and-cross-light', [-69, 16, 16], [-16, 9, 1]),
    cam('detached-three-stage-bell', [-57, 18, 23], [-35, rec.bellDatumOffset + 8, -1]),
    cam('faceted-drum-metal-cone', [30, 37, 38], [0, 24, 0]),
    cam('north-porch-and-main-glazing', [2, 18, -63], [0, 10, -11]),
    cam('east-apse-and-folded-roofs', [63, 31, -26], [10, 12, -1]),
    cam('main-and-bell-map-plan', [-8, 77, 0.3], [-8, 8, 0]),
  ],
};

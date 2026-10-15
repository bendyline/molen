/** Vilnius Cathedral and detached bell tower: open classical portico and mapped colonnades. */
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
  '../../../content/worldgen/source/places/u9/u99/n0346_vilnius_cathedral/',
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
  wall: '#e7e5d9',
  trim: '#e3e1d5',
  roof: '#555e5a',
  foundation: '#aaa995',
  door: '#6c513b',
  glass: '#4d6178',
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
const rect = (p, w, h) => [
  [p[0] - w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] - h / 2],
  [p[0] + w / 2, p[1] + h / 2],
  [p[0] - w / 2, p[1] + h / 2],
];
const scaled = (r, f) => {
  const p = center(r);
  return r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * f));
};
const footing = (p) => Math.min(floor - 0.3, vilniusGround(...p) - 0.35);
export function vilniusGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Vilnius Cathedral footing outside retained terrain');
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
function profile(face, r, levels, slot) {
  for (let i = 1; i < levels.length; i++) {
    const [b, a] = levels[i - 1],
      [t, c] = levels[i],
      lo = scaled(r, a),
      hi = scaled(r, c),
      s = sign(r);
    for (let j = 0; j < r.length; j++) {
      const k = (j + 1) % r.length;
      face(
        slot,
        [at(lo[j], b), at(lo[k], b), at(hi[k], t), at(hi[j], t)],
        [(r[k][1] - r[j][1]) * s, 0.1, (r[j][0] - r[k][0]) * s],
      );
    }
  }
  const [t, f] = levels.at(-1);
  if (f > 0) cap(face, scaled(r, f), t, slot);
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
function simplify(r, tolerance) {
  let changed = true,
    p = [...r];
  while (changed && p.length > 4) {
    changed = false;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        c = p[(i + 1) % p.length],
        u = c.map((v, k) => v - a[k]),
        len = Math.hypot(...u),
        t = Math.max(
          0,
          Math.min(1, ((b[0] - a[0]) * u[0] + (b[1] - a[1]) * u[1]) / (len * len || 1)),
        ),
        q = lerp(a, c, t);
      if (Math.hypot(b[0] - q[0], b[1] - q[1]) < tolerance) {
        p.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return p;
}
const regular = (p, r, n = 8, offset = 0) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + r * Math.cos(offset + (i * 2 * Math.PI) / n),
    p[1] + r * Math.sin(offset + (i * 2 * Math.PI) / n),
  ]);
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
const H = rec.heights,
  rawRole = (name) => rec.controls.find((b) => b.id === rec.roles[name]),
  rawRing = (name) => rawRole(name).polygons[0].outline,
  ring = (r, d) => simplify(r, d >= 2 ? 0.04 : d ? 0.16 : 0.5),
  role = (name, d) => ring(rawRing(name), d),
  bounds = (r) =>
    [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
const hole = (
  name,
  p,
  axis,
  normal,
  width,
  bottom,
  height,
  spring = height,
  shape = 'rect',
  depth = 4,
) => ({
  name,
  center: p,
  axis,
  normal,
  width,
  bottom: floor + bottom,
  height,
  spring,
  shape,
  depth,
});
export const vilniusDoor = () =>
  hole('west-central-door', [-27.46, 0.3], [0, 1], [-1, 0], 3.25, 0.15, 7.3, 7.3, 'rect', 5);
export const vilniusNiches = () =>
  [-21, -11.2, -6.2, 6.8, 11.6, 21].map((z, i) =>
    hole(`west-niche-${i}`, [-27.46, z], [0, 1], [-1, 0], 2.2, 2.0, 5.1, 4.0, 'round', 4),
  );
export const vilniusBelfries = () =>
  rawRing('bellBelfry').map((_, i) => {
    const f = faceFrame(rawRing('bellBelfry'), i);
    return hole(
      `bell-arch-${i}`,
      lerp(f.a, f.b, 0.5),
      f.axis,
      f.normal,
      1.65,
      26.0,
      8.3,
      7.2,
      'round',
      8,
    );
  });
export const vilniusLanterns = () =>
  ['northLantern', 'southLantern'].flatMap((name) =>
    rawRing(name).map((_, i) => {
      const f = faceFrame(rawRing(name), i);
      return hole(
        `${name}-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        0.54,
        20.4,
        2.3,
        1.95,
        'round',
        2.5,
      );
    }),
  );
function clip(r, axis, value, greater) {
  const result = [],
    dot = (p) => p[0] * axis[0] + p[1] * axis[1];
  let a = r.at(-1),
    av = dot(a) - value;
  for (const b of r) {
    const bv = dot(b) - value;
    if (av >= 0 !== bv >= 0) result.push(lerp(a, b, av / (av - bv)));
    if (greater ? bv >= 0 : bv <= 0) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
function roof(face, r, eave, top) {
  const zs = r.map((p) => p[1]),
    lo = Math.min(...zs),
    hi = Math.max(...zs),
    mid = (lo + hi) / 2,
    height = (p) => eave + (top - eave) * (1 - Math.abs((p[1] - mid) / ((hi - lo) / 2)));
  for (const gt of [true, false]) {
    const q = clip(r, [0, 1], mid, gt);
    if (q.length >= 3) cap(face, q, (p) => floor + height(p), 'roof');
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      q = [
        a,
        ...((a[1] - mid) * (b[1] - mid) < 0 ? [lerp(a, b, (mid - a[1]) / (b[1] - a[1]))] : []),
        b,
      ];
    for (let j = 1; j < q.length; j++)
      face(
        'wall',
        [
          at(q[j - 1], eave),
          at(q[j], eave),
          at(q[j], height(q[j])),
          at(q[j - 1], height(q[j - 1])),
        ],
        [(b[1] - a[1]) * sign(r), 0, (a[0] - b[0]) * sign(r)],
      );
  }
}
function window(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.3 : 0.08, slot);
  if (d) archBand(face, h, d, 0.17, 'trim', 0.13);
  if (d >= 2 && slot === 'glass') {
    const p = h.center.map((v, k) => v + h.normal[k] * (recess ? -1.1 : 0.16));
    beam(face, [p[0], h.bottom + 0.15, p[1]], [p[0], h.bottom + h.spring - 0.15, p[1]], 0.1);
    if (d >= 3)
      for (const t of [0.35, 0.7]) {
        const y = h.bottom + h.spring * t;
        beam(
          face,
          [p[0] - h.axis[0] * h.width * 0.42, y, p[1] - h.axis[1] * h.width * 0.42],
          [p[0] + h.axis[0] * h.width * 0.42, y, p[1] + h.axis[1] * h.width * 0.42],
          0.1,
        );
      }
  }
}
function column(face, b, top, d, front = false) {
  const r0 = b.polygons[0].outline,
    p = center(r0),
    bb = bounds(r0),
    radius = Math.min(bb[0][1] - bb[0][0], bb[1][1] - bb[1][0]) / 2,
    n = d >= 3 ? (front ? 20 : 16) : d >= 2 ? (front ? 12 : 10) : d ? (front ? 8 : 6) : 4,
    r = regular(p, radius, n);
  const levels = d
    ? [
        [d >= 2 ? 0.1 : 0, 1.06],
        [0.55, 1.06],
        [0.9, 1],
        [top - 0.7, 0.84],
        [top - 0.35, 1.05],
        [top, 1.05],
      ]
    : [
        [0, 1],
        [top, 0.88],
      ];
  profile(face, r, levels, 'trim');
  if (d >= 2) solid(face, rect(p, radius * 2.14, radius * 2.14), 0, 0.28, 'trim');
}
function figure(face, p, b, h, d) {
  const n = d >= 3 ? 8 : d >= 2 ? 6 : 4;
  profile(
    face,
    regular(p, h * 0.14, n),
    [
      [b, 1],
      [b + h * 0.64, 0.55],
      [b + h * 0.74, 0.5],
    ],
    'trim',
  );
  profile(
    face,
    regular(p, h * 0.09, n),
    [
      [b + h * 0.75, 0.6],
      [b + h * 0.88, 1],
      [b + h, 0.05],
    ],
    'trim',
  );
  if (d >= 2) {
    beam(
      face,
      [p[0], floor + b + h * 0.62, p[1]],
      [p[0] - h * 0.21, floor + b + h * 0.55, p[1] + h * 0.15],
      h * 0.07,
    );
    beam(
      face,
      [p[0], floor + b + h * 0.62, p[1]],
      [p[0], floor + b + h * 0.78, p[1] + h * 0.3],
      h * 0.07,
    );
  }
}
function pediment(face, h, d) {
  const p = h.center,
    axis = h.axis,
    n = h.normal,
    w = h.width * 0.7,
    y = h.bottom - floor + h.height + 0.4,
    pt = (z, y) => [p[0] + axis[0] * z + n[0] * 0.16, floor + y, p[1] + axis[1] * z + n[1] * 0.16];
  face('trim', [pt(-w, y), pt(w, y), pt(0, y + 0.8)], [n[0], 0, n[1]]);
  if (d >= 2) {
    beam(face, pt(-w, y), pt(0, y + 0.8), 0.16);
    beam(face, pt(0, y + 0.8), pt(w, y), 0.16);
  }
}
function cathedral(out, face, d) {
  const r = ring(rec.main.polygons[0].outline, d),
    nave = role('nave', d),
    door = vilniusDoor(),
    niches = vilniusNiches();
  sides(face, r, footing, 0, 'foundation');
  cap(face, r, 0, 'foundation');
  shell(out, d, nave, 0, H.naveEave, d ? [door, ...(d >= 2 ? niches : [])] : [], 'wall');
  cap(face, nave, H.naveEave, 'wall');
  roof(face, nave, H.naveEave, H.naveRidge);
  const fr = role('frontWings', d);
  for (const side of [-1, 1]) {
    const q = clip(fr, [0, 1], side * 16.2, side > 0);
    shell(out, d, q, 0, 13, d >= 2 ? niches : [], 'wall');
    cap(face, q, 13, 'wall');
  }
  if (d) {
    window(face, door, d, true, 'door');
    pediment(face, door, d);
    for (const h of niches) {
      window(face, h, d, d >= 2, 'foundation');
      figure(
        face,
        h.center.map((v, k) => v - h.normal[k] * (d >= 2 ? 1.1 : -0.15)),
        2.4,
        3.5,
        d,
      );
      if (Math.abs(h.center[1]) > 18) pediment(face, h, d);
    }
  } else pane(face, door, d, 0.05, 'door');
  const portico = clip(role('frontRoof', d), [1, 0], -27.1, false);
  solid(face, portico, 16.0, 17, 'trim');
  roof(face, portico, 17, H.pedimentTop);
  for (const id of rec.roles.frontColumns)
    column(
      face,
      rec.controls.find((b) => b.id === id),
      16,
      d,
      true,
    );
  // Pediment face is a pale relief field. Selected faceted figures carry the roofline silhouette.
  const bb = bounds(portico),
    x = bb[0][0] - 0.04,
    z0 = bb[1][0],
    z1 = bb[1][1],
    zm = (z0 + z1) / 2;
  for (const [a, b] of [
    [
      [x, floor + 17, z0],
      [x, floor + 20, zm],
    ],
    [
      [x, floor + 20, zm],
      [x, floor + 17, z1],
    ],
  ])
    beam(face, a, b, d ? 0.25 : 0.4, 'trim');
  if (d >= 2) {
    const light = [0.63, 0.64, 0.59];
    for (let i = 0; i < 7; i++) {
      const z = zm + (i - 3) * 2.5,
        maxY = 20 - Math.abs((z - zm) / ((z1 - z0) / 2)) * 3;
      face(
        'wall',
        [
          [x - 0.05, floor + 17.3, z - 0.65],
          [x - 0.05, floor + 17.3, z + 0.65],
          [x - 0.05, floor + Math.min(maxY - 0.2, 18.4 + (i % 2) * 0.5), z],
        ],
        [-1, 0, 0],
        light,
      );
    }
  }
  for (const z of [z0 + 0.8, zm, z1 - 0.8]) {
    const y = z === zm ? 20 : 17.4,
      h = z === zm ? 3.2 : 3.3;
    solid(face, rect([x + 0.9, z], 1.1, 1.1), y, y + 0.3, 'trim');
    if (d) figure(face, [x + 0.9, z], y + 0.3, h, d);
    else solid(face, rect([x + 0.9, z], 0.55, 0.55), y + 0.3, y + h, 'trim');
  }
  const gold = [0.58, 0.43, 0.14];
  beam(face, [x + 0.85, floor + 21.8, zm], [x + 0.85, floor + 25, zm], d ? 0.13 : 0.22, 'trim');
  beam(
    face,
    [x + 0.85, floor + 24.1, zm - 0.8],
    [x + 0.85, floor + 24.1, zm + 0.8],
    d ? 0.13 : 0.22,
    'trim',
  );
  // The gilded cross uses a linear tint on the shared trim graph.
  face(
    'trim',
    [
      [x + 0.7, floor + 23.9, zm - 0.8],
      [x + 0.7, floor + 24.15, zm - 0.8],
      [x + 0.7, floor + 24.15, zm + 0.8],
      [x + 0.7, floor + 23.9, zm + 0.8],
    ],
    [-1, 0, 0],
    gold,
  );
  for (const side of [-1, 1]) {
    let slab = clip(role('sideRoof', d), [0, 1], side * 16.0, side > 0);
    slab = clip(slab, [1, 0], 20.8, false);
    solid(face, slab, 13, 14, 'trim');
    for (const id of rec.roles[side > 0 ? 'southColumns' : 'northColumns'])
      column(
        face,
        rec.controls.find((b) => b.id === id),
        13.2,
        d,
      );
    if (d) {
      for (const x of [-20, -10, 0, 10, 19])
        window(
          face,
          hole(
            'clerestory',
            [x, side * (side > 0 ? 16.43 : 15.87)],
            [1, 0],
            [0, side],
            1.65,
            14.3,
            2.0,
            1.2,
            'round',
          ),
          d,
        );
    }
  }
  if (d) {
    for (const z of [-10, 0, 10])
      window(face, hole('rear-window', [36.68, z], [0, 1], [1, 0], 2.2, 5.5, 5.3, 4.4, 'round'), d);
    for (const side of [-1, 1])
      for (const x of [-23, -12, -1, 10, 21, 33])
        solid(face, rect([x, side * 16.25], 0.45, 0.55), 0.6, 16.65, 'trim');
    for (let i = 0; i < 4; i++)
      solid(face, rect([-37.1 - i * 0.45, zm], 0.5, 33.1), footing, -i * 0.13, 'foundation');
  }
}
function chapels(out, face, d) {
  for (const name of ['north', 'south']) {
    const body = role(`${name}Chapel`, d),
      dome = role(`${name}Dome`, d),
      lantern = role(`${name}Lantern`, d),
      p = center(rawRing(`${name}Dome`));
    solid(face, body, 0, H.chapelBody, 'wall');
    if (d) {
      band(face, body, 16.5, 0.5, 'trim', 1.02);
      for (let i = 0; i < body.length; i++) {
        const f = faceFrame(body, i);
        if ((name === 'north' ? f.normal[1] < -0.6 : f.normal[1] > 0.6) || f.normal[0] > 0.6)
          window(
            face,
            hole(
              `${name}-chapel-window`,
              lerp(f.a, f.b, 0.5),
              f.axis,
              f.normal,
              2.0,
              6.5,
              6.0,
              4.9,
              'round',
            ),
            d,
          );
      }
    }
    profile(
      face,
      dome,
      d >= 2
        ? [
            [17, 1.02],
            [17.8, 0.98],
            [18.8, 0.77],
            [19.6, 0.47],
            [20, 0.24],
          ]
        : [
            [17, 1.02],
            [19, 0.72],
            [20, 0.24],
          ],
      'roof',
    );
    solid(face, scaled(lantern, 1.12), 19.8, 20.15, 'trim');
    const hs = vilniusLanterns().filter((h) => h.name.startsWith(name));
    if (d >= 2) shell(out, d, lantern, 20.15, 23.1, hs, 'trim', scaled(lantern, 0.5));
    else {
      solid(face, lantern, 20.15, 23.1, 'trim');
      if (d) for (const h of hs) pane(face, h, d, 0.04);
    }
    cap(face, lantern, 20.15, 'roof');
    profile(
      face,
      lantern,
      [
        [23.1, 1.15],
        [23.5, 0.7],
        [23.7, 0.08],
      ],
      'roof',
    );
    beam(face, [p[0], floor + 23.5, p[1]], [p[0], floor + 24, p[1]], 0.09, 'trim');
  }
}
function clock(face, p, axis, normal, d) {
  const n = d >= 3 ? 24 : d >= 2 ? 16 : 10,
    point = (u, y, off = 0.055) => [
      p[0] + axis[0] * u + normal[0] * off,
      floor + y,
      p[1] + axis[1] * u + normal[1] * off,
    ],
    cy = 39.5,
    r = 1.25;
  face(
    'trim',
    Array.from({ length: n }, (_, i) => {
      const a = (i * 2 * Math.PI) / n;
      return point(r * Math.cos(a), cy + r * Math.sin(a));
    }),
    [normal[0], 0, normal[1]],
  );
  const dark = [0.055, 0.06, 0.05];
  face(
    'glass',
    [
      point(-0.08, cy - 0.12, 0.09),
      point(0.08, cy - 0.12, 0.09),
      point(0.08, cy + r * 0.76, 0.09),
      point(-0.08, cy + r * 0.76, 0.09),
    ],
    [normal[0], 0, normal[1]],
    dark,
  );
  beam(face, point(0, cy, 0.1), point(-r * 0.65, cy + 0.15, 0.1), 0.13, 'glass');
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * 2 * Math.PI) / 12;
      beam(
        face,
        point(r * 0.82 * Math.cos(a), cy + r * 0.82 * Math.sin(a), 0.1),
        point(r * 0.94 * Math.cos(a), cy + r * 0.94 * Math.sin(a), 0.1),
        0.055,
        'glass',
      );
    }
}
function bellTower(out, face, d) {
  const base = role('bellBase', d),
    r = role('bellLower', d),
    p = center(rawRing('bellLower')),
    hs = vilniusBelfries();
  sides(face, base, footing, 0, 'foundation');
  solid(face, base, 0, 15, 'wall');
  solid(face, r, 15, 24, 'wall');
  cap(face, r, 24, 'wall');
  if (d >= 2) shell(out, d, r, 24, 36, hs, 'wall', scaled(r, 0.53));
  else {
    solid(face, r, 24, 36, 'wall');
    if (d) for (const h of hs) window(face, h, d);
  }
  solid(face, r, 36, 43, 'wall');
  if (d) {
    for (const y of [15, 24, 36, 42.6])
      profile(
        face,
        r,
        [
          [y - 0.1, 1.01],
          [y + 0.15, 1.04],
          [y + 0.4, 1.04],
        ],
        'trim',
      );
    for (const h of hs) archBand(face, h, d, 0.2, 'trim', 0.08);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i),
        mid = lerp(f.a, f.b, 0.5);
      clock(face, mid, f.axis, f.normal, d);
      window(
        face,
        hole('lower-tower-window', mid, f.axis, f.normal, 0.95, 18, 3.3, 2.7, 'round'),
        d,
      );
    }
    const b = rec.bell.polygons[0].outline;
    for (let i = 0; i < b.length; i += d >= 2 ? 3 : 6) {
      const f = faceFrame(b, i);
      window(face, hole('bell-base-slit', lerp(f.a, f.b, 0.5), f.axis, f.normal, 0.35, 8, 1.1), d);
    }
  }
  profile(
    face,
    r,
    d >= 2
      ? [
          [43, 1.05],
          [44.8, 0.93],
          [47.4, 0.45],
          [50, 0.31],
          [51.3, 0.25],
          [57, 0.012],
        ]
      : [
          [43, 1.05],
          [47.4, 0.45],
          [50, 0.31],
          [57, 0.012],
        ],
    'roof',
  );
  beam(face, [p[0], floor + 56.8, p[1]], [p[0], floor + 59, p[1]], d ? 0.12 : 0.2, 'trim');
  beam(
    face,
    [p[0], floor + 58.2, p[1] - 0.48],
    [p[0], floor + 58.2, p[1] + 0.48],
    d ? 0.12 : 0.2,
    'trim',
  );
}
function build(out, d) {
  const stable = {
      addTriangle(slot, ref, points, _n, uv, color) {
        const p = points.map((v) => v.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) < 1e-9
        )
          return;
        out.addTriangle(slot, ref, p, normalFor(...p), uv, color);
      },
    },
    face = writer(stable, d);
  cathedral(stable, face, d);
  chapels(stable, face, d);
  bellTower(stable, face, d);
}
export const buildVilniusSkyline = (o) => build(o, 0),
  buildVilniusDistrict = (o) => build(o, 1),
  buildVilniusStreet = (o) => build(o, 2),
  buildVilniusCloseup = (o) => build(o, 3);
export const vilniusStudy = {
  id: 'N0346',
  key: 'vilnius_cathedral',
  title: 'Vilnius Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1281237',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way4870323 and 74 current cathedral/bell controls, including individual columns. Mapped spacing and signed west portico retained without overall rescaling.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Approximately 73x60m cathedral/gallery plan and detached mapped 14.3m bell base southwest. Mapped parts control principal stages; roof/eave roles, column profiles, openings, selected figures and thresholds remain approximate.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing 256-square lime plaster, raw/weathered limestone, standing-seam metal and wood graphs. Metric UVs, linear vertex tints, flat architecture normals and flat glazing. No embedded images.',
  importReason:
    'Four authored browser levels retain Vilnius six-column portico,open lateral galleries,two domed chapels and detached mapped staged bell tower.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Two useful exterior pictures and standard map/terrain guide this individual medium-fi cathedral/bell exterior. Column taper/capitals,selected figures/relief fields,niches and clocks are simplified. Upper bell uses the approximate mapped faceted plan. Side/rear glazing is selected surface detail;full interiors,exact sculpture/carvings,adjacent palace/square monuments and certified walking excluded. Physical phone/laptop timings pending.',
    'Skyline preserves six-column open portico,open side galleries,long nave,two domed chapels and detached staged bell tower/spire. District adds shared graphs,closed recessed central door,selected niche fields/figures,frames,flat bell/lantern openings and clocks. Street opens actual belfry/lantern arches and recesses niches;closeup refines columns,curves,mullions and selected figures. Detail changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'six-column-open-west-portico-and-pediment',
      position: [-84, 24, -25],
      lookAt: [-31, 12, 0],
      fov: 48,
    },
    {
      name: 'recessed-central-door-and-column-bases',
      position: [-45, 8, 6],
      lookAt: [-28, 5, 0],
      fov: 52,
    },
    {
      name: 'open-south-gallery-and-main-roof',
      position: [-4, 22, 68],
      lookAt: [1, 10, 18],
      fov: 48,
    },
    {
      name: 'paired-rear-domed-chapels-and-lanterns',
      position: [66, 35, 40],
      lookAt: [28, 17, 0],
      fov: 48,
    },
    {
      name: 'detached-staged-bell-tower-clock-and-spire',
      position: [-111, 51, 72],
      lookAt: [-70.9, 31, 21],
      fov: 48,
    },
    {
      name: 'bell-tower-to-cathedral-spacing',
      position: [-111, 45, -58],
      lookAt: [-28, 15, 2],
      fov: 48,
    },
  ],
};

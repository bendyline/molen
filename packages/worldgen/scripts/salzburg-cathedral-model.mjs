/** Salzburg Cathedral: twin staged towers, three rounded arms and central dome. */
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
  '../../../content/worldgen/source/places/u2/u23/n0345_salzburg_cathedral/',
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
  wall: '#c2baa0',
  trim: '#e3dfcf',
  roof: '#464e4c',
  copper: '#77a99b',
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
const footing = (p) => Math.min(floor - 0.3, salzburgGround(...p) - 0.35);
export function salzburgGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Salzburg Cathedral footing outside retained terrain');
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
  rawRing = (name) => rawRole(name).polygons[0].outline;
const ring = (r, d) => simplify(r, d >= 2 ? 0.06 : d ? 0.25 : 0.85),
  role = (name, d) => ring(rawRing(name), d),
  front = -49.6;
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
export const salzburgPortals = () =>
  [-8.8, 0, 8.8].map((z, i) =>
    hole(`west-portal-${i}`, [front, z], [0, 1], [-1, 0], 4.65, 0.1, 9.8, 7.0, 'round', 7),
  );
export const salzburgFrontWindows = () =>
  [-8.8, 0, 8.8].map((z, i) =>
    hole(
      `west-upper-window-${i}`,
      [front, z],
      [0, 1],
      [-1, 0],
      3.0,
      25.8,
      6.0,
      i === 1 ? 4.6 : 6,
      i === 1 ? 'round' : 'rect',
      7,
    ),
  );
const towerNames = ['northTower', 'southTower'];
export function salzburgBelfries() {
  return towerNames.flatMap((name) => {
    const r = rawRing(name),
      p = center(r),
      x0 = Math.min(...r.map((p) => p[0])),
      x1 = Math.max(...r.map((p) => p[0])),
      z0 = Math.min(...r.map((p) => p[1])),
      z1 = Math.max(...r.map((p) => p[1]));
    return [
      hole(`${name}-west-bell`, [x0, p[1]], [0, 1], [-1, 0], 3.5, 42.2, 8.1, 6.3, 'round', 9),
      hole(`${name}-east-bell`, [x1, p[1]], [0, 1], [1, 0], 3.5, 42.2, 8.1, 6.3, 'round', 9),
      hole(`${name}-north-bell`, [p[0], z0], [1, 0], [0, -1], 3.5, 42.2, 8.1, 6.3, 'round', 9),
      hole(`${name}-south-bell`, [p[0], z1], [1, 0], [0, 1], 3.5, 42.2, 8.1, 6.3, 'round', 9),
    ];
  });
}
export const salzburgDrumWindows = () =>
  rawRing('centralDome').map((_, i) => {
    const f = faceFrame(rawRing('centralDome'), i);
    return hole(
      `central-drum-${i}`,
      lerp(f.a, f.b, 0.5),
      f.axis,
      f.normal,
      2.5,
      43.8,
      6.8,
      6.8,
      'rect',
      5,
    );
  });
const lanternRing = (name) => rawRing(name);
export function salzburgLanternWindows() {
  return ['northLantern', 'southLantern', 'centralLantern'].flatMap((name) =>
    lanternRing(name).map((_, i) => {
      const f = faceFrame(lanternRing(name), i),
        central = name === 'centralLantern';
      return hole(
        `${name}-${i}`,
        lerp(f.a, f.b, 0.5),
        f.axis,
        f.normal,
        central ? 1.6 : 0.72,
        central ? 64.2 : 70.3,
        central ? 7.6 : 4.4,
        central ? 6.8 : 3.75,
        'round',
        central ? 4.8 : 2.3,
      );
    }),
  );
}
function window(face, h, d, recess = false, slot = 'glass') {
  pane(face, h, d, recess ? -1.45 : 0.18, slot);
  if (d >= 2) archBand(face, h, d, 0.25, 'trim', recess ? 0.12 : 0.26);
  if (d >= 2 && slot === 'glass') {
    const p = h.center.map((v, k) => v - h.normal[k] * (recess ? 1.25 : -0.32)),
      y = h.bottom + 0.2,
      t = h.bottom + h.spring - 0.2;
    beam(face, [p[0], y, p[1]], [p[0], t, p[1]], 0.12);
    if (d >= 3)
      for (const yy of [y + (t - y) * 0.45, y + (t - y) * 0.78])
        beam(
          face,
          [p[0] - h.axis[0] * h.width * 0.42, yy, p[1] - h.axis[1] * h.width * 0.42],
          [p[0] + h.axis[0] * h.width * 0.42, yy, p[1] + h.axis[1] * h.width * 0.42],
          0.12,
        );
  }
}
function oval(face, p, axis, normal, cy, rx, ry, d, clock = false, patchSlot = 'glass') {
  const n = d >= 3 ? 20 : d >= 2 ? 16 : d ? 10 : 6,
    v = [];
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    v.push([
      p[0] + axis[0] * rx * Math.cos(a) + normal[0] * 0.055,
      floor + cy + ry * Math.sin(a),
      p[1] + axis[1] * rx * Math.cos(a) + normal[1] * 0.055,
    ]);
  }
  face(clock ? 'trim' : patchSlot, v, [normal[0], 0, normal[1]]);
  if (d) {
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n;
      face(
        'trim',
        [
          [
            p[0] + axis[0] * rx * Math.cos(a) + normal[0] * 0.12,
            floor + cy + ry * Math.sin(a),
            p[1] + axis[1] * rx * Math.cos(a) + normal[1] * 0.12,
          ],
          [
            p[0] + axis[0] * rx * Math.cos(b) + normal[0] * 0.12,
            floor + cy + ry * Math.sin(b),
            p[1] + axis[1] * rx * Math.cos(b) + normal[1] * 0.12,
          ],
          [
            p[0] + axis[0] * (rx + 0.2) * Math.cos(b) + normal[0] * 0.12,
            floor + cy + (ry + 0.2) * Math.sin(b),
            p[1] + axis[1] * (rx + 0.2) * Math.cos(b) + normal[1] * 0.12,
          ],
          [
            p[0] + axis[0] * (rx + 0.2) * Math.cos(a) + normal[0] * 0.12,
            floor + cy + (ry + 0.2) * Math.sin(a),
            p[1] + axis[1] * (rx + 0.2) * Math.cos(a) + normal[1] * 0.12,
          ],
        ],
        [normal[0], 0, normal[1]],
      );
    }
  }
  if (clock) {
    const dark = [0.07, 0.075, 0.06],
      point = (u, y) => [
        p[0] + axis[0] * u + normal[0] * 0.2,
        floor + y,
        p[1] + axis[1] * u + normal[1] * 0.2,
      ];
    face(
      'glass',
      [
        point(-0.09, cy - 0.16),
        point(0.09, cy - 0.16),
        point(0.09, cy + ry * 0.72),
        point(-0.09, cy + ry * 0.72),
      ],
      [normal[0], 0, normal[1]],
      dark,
    );
    const c = point(0, cy),
      e = point(-rx * 0.6, cy + ry * 0.15);
    beam(face, c, e, 0.15, 'glass');
    if (d >= 2)
      for (let i = 0; i < 12; i++) {
        const a = (i * 2 * Math.PI) / 12,
          cc = point(rx * 0.82 * Math.cos(a), cy + ry * 0.82 * Math.sin(a));
        beam(
          face,
          cc,
          point(rx * 0.94 * Math.cos(a), cy + ry * 0.94 * Math.sin(a)),
          0.085,
          'glass',
        );
      }
  }
}
function roof(face, r, axis, eave, top, lean = false) {
  const side = [-axis[1], axis[0]],
    proj = (p) => p[0] * side[0] + p[1] * side[1],
    vals = r.map(proj),
    lo = Math.min(...vals),
    hi = Math.max(...vals),
    mid = lean === 'lo' ? lo : lean === 'hi' ? hi : (lo + hi) / 2,
    span = (hi - lo) / (lean ? 1 : 2),
    height = (p) => eave + (top - eave) * (1 - Math.abs((proj(p) - mid) / span));
  for (const k of lean ? [1] : [-1, 1]) {
    let a = r.at(-1),
      av = (proj(a) - mid) * k;
    const q = [];
    for (const b of r) {
      const bv = (proj(b) - mid) * k;
      if (av >= 0 !== bv >= 0) q.push(lerp(a, b, av / (av - bv)));
      if (bv >= 0) q.push(b);
      a = b;
      av = bv;
    }
    if ((lean ? r : q).length >= 3) cap(face, lean ? r : q, (p) => floor + height(p), 'roof');
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      av = proj(a) - mid,
      bv = proj(b) - mid,
      q = [a, ...(av * bv < 0 ? [lerp(a, b, av / (av - bv))] : []), b];
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
function figure(face, p, b, h, d) {
  const r = regular(p, h * 0.13, d >= 3 ? 8 : d ? 6 : 4);
  profile(
    face,
    r,
    [
      [b, 1.05],
      [b + h * 0.65, 0.55],
      [b + h * 0.74, 0.5],
    ],
    'trim',
  );
  profile(
    face,
    regular(p, h * 0.09, d >= 3 ? 8 : 4),
    [
      [b + h * 0.75, 0.6],
      [b + h * 0.88, 1],
      [b + h, 0],
    ],
    'trim',
  );
  if (d >= 2) {
    beam(
      face,
      [p[0], floor + b + h * 0.62, p[1]],
      [p[0], floor + b + h * 0.8, p[1] + h * 0.3],
      h * 0.075,
    );
    beam(
      face,
      [p[0], floor + b + h * 0.62, p[1]],
      [p[0] - h * 0.25, floor + b + h * 0.5, p[1]],
      h * 0.075,
    );
  }
}
function pedestal(face, p, b, h) {
  solid(face, rect(p, 1.2, 1.2), b, b + h, 'trim');
}
function pediment(face, h, d) {
  if (!d) return;
  const y = h.bottom - floor + h.height + 0.6,
    p = h.center,
    a = h.axis,
    n = h.normal,
    pt = (u, y) => [p[0] + a[0] * u + n[0] * 0.26, floor + y, p[1] + a[1] * u + n[1] * 0.26],
    w = h.width * 0.7;
  face('trim', [pt(-w, y), pt(w, y), pt(0, y + 1.2)], [n[0], 0, n[1]]);
  beam(face, pt(-w, y), pt(0, y + 1.2), 0.22);
  beam(face, pt(0, y + 1.2), pt(w, y), 0.22);
}
function onEnvelope(p, n) {
  const r = rec.main.polygons[0].outline,
    hits = [],
    cross2 = (a, b) => a[0] * b[1] - a[1] * b[0];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      e = b.map((v, k) => v - a[k]),
      v = a.map((v, k) => v - p[k]),
      den = cross2(n, e);
    if (Math.abs(den) < 1e-8) continue;
    const t = cross2(v, e) / den,
      u = cross2(v, n) / den;
    if (u >= 0 && u <= 1) hits.push(t);
  }
  if (!hits.length) throw Error('No mapped masonry envelope intersection');
  const t = hits.sort((a, b) => Math.abs(a) - Math.abs(b))[0];
  return p.map((v, k) => v + n[k] * t);
}
function clipFront(r, x) {
  const result = [];
  let a = r.at(-1),
    av = a[0] - x;
  for (const b of r) {
    const bv = b[0] - x;
    if (av >= 0 !== bv >= 0) result.push(lerp(a, b, av / (av - bv)));
    if (bv >= 0) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
function sidePoint(name, x, side) {
  const r = rawRing(name);
  const f = r
    .map((_, i) => faceFrame(r, i))
    .filter((f) => f.normal[1] * side > 0.85)
    .sort((a, b) => b.length - a.length)[0];
  return lerp(f.a, f.b, (x - f.a[0]) / (f.b[0] - f.a[0]));
}
const lowerSideWindows = () =>
  [-1, 1].flatMap((s) =>
    [-29, -18, -7].flatMap((x) => [
      hole(
        `aisle-paired-${s}-${x}`,
        onEnvelope(sidePoint(s > 0 ? 'southAisle' : 'northAisle', x, s), [0, s]),
        [1, 0],
        [0, s],
        2.8,
        15,
        4.3,
        4.3,
        'rect',
        3,
      ),
      hole(
        `aisle-lunette-${s}-${x}`,
        onEnvelope(sidePoint(s > 0 ? 'southAisle' : 'northAisle', x, s), [0, s]),
        [1, 0],
        [0, s],
        3.0,
        7.2,
        2.4,
        0.7,
        'round',
        3,
      ),
    ]),
  );
function lowerBody(out, face, d) {
  const r = ring(rec.main.polygons[0].outline, d);
  sides(face, r, footing, 0, 'wall');
  cap(face, r, 0, 'wall');
  shell(out, d, clipFront(r, -47), 0, H.lowerEave, d ? salzburgPortals() : [], 'wall');
  cap(face, r, H.lowerEave, 'wall');
  for (const name of ['northAisle', 'southAisle', 'northService', 'southService']) {
    const r = role(name, d);
    sides(face, r, H.lowerEave, H.lowerEave, 'wall');
    const north = name.startsWith('north');
    roof(face, r, [1, 0], H.lowerEave, H.aisleRoof, north ? 'hi' : 'lo');
  }
  const nave = role('nave', d),
    crossing = role('crossing', d);
  for (const r of [nave, crossing]) {
    sides(face, r, H.lowerEave, H.naveEave, 'wall');
    roof(face, r, r === nave ? [1, 0] : [0, 1], H.naveEave, H.naveRidge);
  }
  if (d) {
    for (const h of lowerSideWindows()) {
      window(face, h, d, false);
      if (d >= 2 && h.name.startsWith('aisle-paired')) {
        const p = h.center,
          n = h.normal;
        for (const dx of [-0.8, 0.8])
          beam(
            face,
            [p[0] + dx, floor + 15.1, p[1] + n[1] * 0.17],
            [p[0] + dx, floor + 19.1, p[1] + n[1] * 0.17],
            0.11,
          );
      }
    }
    for (const s of [-1, 1])
      for (const x of [-29, -18, -7])
        oval(face, sidePoint('nave', x, s), [1, 0], [0, s], 33.0, 1.6, 0.9, d);
    band(face, r, 1, 0.3, 'trim', 1.008);
  }
}
function roundedArms(_out, face, d) {
  for (const name of ['northApse', 'southApse', 'eastApse']) {
    const r = role(name, d),
      p = center(rawRing(name));
    sides(face, r, H.lowerEave, H.apseEave, 'wall');
    for (let i = 0; i < r.length; i++)
      face(
        'copper',
        [at(r[i], H.apseEave), at(r[(i + 1) % r.length], H.apseEave), at(p, H.apseRoof)],
        [0, 1, 0],
      );
    if (d) {
      band(face, r, 22, 0.65, 'trim', 1.015);
      band(face, r, 35.9, 0.6, 'trim', 1.02);
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i),
          mid = lerp(f.a, f.b, 0.5),
          outward =
            name === 'northApse'
              ? f.normal[1] < -0.25
              : name === 'southApse'
                ? f.normal[1] > 0.25
                : f.normal[0] > 0.25;
        if (!outward || i % (d >= 2 ? 2 : 4) !== 0) continue;
        if (d >= 2)
          window(
            face,
            hole(
              `${name}-lower-${i}`,
              onEnvelope(mid, f.normal),
              f.axis,
              f.normal,
              2.0,
              15,
              4.3,
              4.3,
            ),
            d,
          );
        window(face, hole(`${name}-upper-${i}`, mid, f.axis, f.normal, 2.5, 25.4, 5.7, 5.7), d);
        if (d >= 2) oval(face, mid, f.axis, f.normal, 33.3, 1.1, 0.75, d);
        if (d >= 2)
          window(
            face,
            hole(
              `${name}-lunette-${i}`,
              onEnvelope(mid, f.normal),
              f.axis,
              f.normal,
              2.8,
              7.2,
              2.4,
              0.8,
              'round',
            ),
            d,
          );
      }
    }
  }
}
function frontFacade(out, face, d) {
  const _r = role('facade', d),
    flat = rect([-48.45, 0], 2.2, 28.1),
    holes = [...salzburgPortals(), ...(d >= 2 ? salzburgFrontWindows() : [])];
  shell(out, d, flat, 0, 39, d ? holes : [], 'trim');
  cap(face, flat, 39, 'trim');
  if (d) {
    for (const y of [0.3, 22, 22.6, 38.9, 39.6])
      solid(face, rect([-48.4, 0], 2.8, 28.6), y, y + 0.3, 'trim');
    for (const z of [-13, -10.9, -5.5, -3.2, 3.2, 5.5, 10.9, 13]) {
      solid(face, rect([-49.65, z], 0.7, 0.58), 0.7, 21.8, 'trim');
      solid(face, rect([-49.65, z], 0.7, 0.58), 23.2, 38.4, 'trim');
      if (d >= 2) {
        solid(face, rect([-49.7, z], 1.1, 0.95), 21.2, 22, 'trim');
        solid(face, rect([-49.7, z], 1.1, 0.95), 37.7, 38.6, 'trim');
      }
    }
    for (const h of salzburgPortals()) {
      window(face, h, d, true, 'door');
      archBand(face, h, d, 0.4, 'trim', 0.18);
    }
    for (const h of salzburgFrontWindows()) {
      window(face, h, d, d >= 2);
      pediment(face, h, d);
    }
    for (const z of [-8.8, 0, 8.8])
      window(face, hole('front-lower-window', [-49.65, z], [0, 1], [-1, 0], 2.6, 15.7, 4.0), d);
  } else
    for (const h of [...salzburgPortals(), salzburgFrontWindows()[1]])
      pane(face, h, d, 0.05, h.name.includes('portal') ? 'door' : 'glass');
  // Curved shoulders, central gable and selected faceted roofline figures.
  const edge = [
      [-14, 40],
      [-11, 40.6],
      [-8, 41.8],
      [-6.2, 44],
      [-6, 46.3],
      [6, 46.3],
      [6.2, 44],
      [8, 41.8],
      [11, 40.6],
      [14, 40],
    ],
    a = -49.35,
    b = -47.2;
  const poly = [[-14, 39.8], ...edge, [14, 39.8]];
  for (const x of [a, b])
    face(
      'trim',
      poly.map(([z, y]) => [x, floor + y, z]),
      [x === a ? -1 : 1, 0, 0],
    );
  for (let i = 1; i < edge.length; i++) {
    const [z, y] = edge[i - 1],
      [v, t] = edge[i];
    face('trim', [
      [a, floor + y, z],
      [b, floor + y, z],
      [b, floor + t, v],
      [a, floor + t, v],
    ]);
    if (d) beam(face, [a - 0.1, floor + y, z], [a - 0.1, floor + t, v], 0.35);
  }
  const tri = [
    [a, floor + 46.2, -6.1],
    [a, floor + 49.5, 0],
    [a, floor + 46.2, 6.1],
  ];
  face('trim', tri, [-1, 0, 0]);
  face(
    'trim',
    tri.map((p) => [b, p[1], p[2]]),
    [1, 0, 0],
  );
  for (let i = 1; i < tri.length; i++) {
    face('trim', [
      tri[i - 1],
      tri[i],
      [b, tri[i][1], tri[i][2]],
      [b, tri[i - 1][1], tri[i - 1][2]],
    ]);
    if (d) beam(face, tri[i - 1], tri[i], 0.38);
  }
  if (d) {
    for (const z of [-11.8, 11.8]) {
      pedestal(face, [-48, z], 40.5, 0.7);
      figure(face, [-48, z], 41.2, 2.5, d);
    }
    pedestal(face, [-48, 0], 49.4, 0.4);
    figure(face, [-48, 0], 49.8, 1.2, d);
    for (const z of [-13, -4.5, 4.5, 13]) {
      pedestal(face, [-51.0, z], 0, 1.2);
      figure(face, [-51, z], 1.2, 2.5, d);
    }
    if (d >= 2) {
      for (const z of [-2.5, 2.5])
        oval(face, [a - 0.1, z], [0, 1], [-1, 0], 43.5, 1.2, 1.5, d, false, 'wall');
    }
  }
}
function towers(out, face, d) {
  for (const [k, name] of towerNames.entries()) {
    const r = simplify(rawRing(name), d >= 3 ? 0.06 : d ? 0.65 : 0.85),
      p = center(rawRing(name)),
      hs = salzburgBelfries().filter((h) => h.name.startsWith(name));
    sides(face, r, 0, 39, 'trim');
    cap(face, r, 39, 'trim');
    if (d >= 2) shell(out, d, r, 39, 52, hs, 'trim', rect(p, 7.2, 7.2));
    else {
      solid(face, r, 39, 52, 'trim');
      if (d) for (const h of hs) pane(face, h, d, 0.07);
    }
    const bands = rec.roles[k ? 'southTowerBands' : 'northTowerBands'];
    for (const id of d ? bands : [bands.at(-1)]) {
      const b = rec.controls.find((c) => c.id === id),
        q = ring(b.polygons[0].outline, d >= 2 ? d : 0);
      solid(face, q, b.properties.min_height, b.properties.height, 'trim');
    }
    const cupolaName = k ? 'southCupola' : 'northCupola',
      q = role(cupolaName, d);
    solid(face, q, 52.6, 61, 'trim');
    profile(
      face,
      q,
      d >= 2
        ? [
            [61, 1.06],
            [62.5, 1.03],
            [65.5, 0.92],
            [67.5, 0.62],
            [69, 0.39],
          ]
        : [
            [61, 1.06],
            [65.8, 0.86],
            [69, 0.39],
          ],
      'copper',
    );
    if (d) {
      if (d >= 2)
        for (const h of hs) {
          archBand(face, h, d, 0.28, 'trim', 0.1);
          pediment(face, h, d);
        }
      if (d >= 2)
        for (const pp of r.filter((_, i) => i % 3 === 0)) {
          solid(face, rect(pp, 0.4, 0.4), 0.8, 21.7, 'trim');
          solid(face, rect(pp, 0.4, 0.4), 23.4, 38.5, 'trim');
          solid(face, rect(pp, 0.4, 0.4), 40.4, 51.2, 'trim');
        }
      const x = Math.min(...r.map((p) => p[0]));
      oval(face, [x - 0.04, p[1]], [0, 1], [-1, 0], 34.6, 2.0, 2.0, d, true);
      for (const y of [9.3, 17.5, 27.2])
        window(
          face,
          hole('tower-window', [x, p[1]], [0, 1], [-1, 0], 2.4, y, y > 20 ? 4.4 : 3.1),
          d,
        );
      if (d >= 2)
        for (let i = 0; i < q.length; i += 2) {
          const f = faceFrame(q, i);
          oval(face, lerp(f.a, f.b, 0.5), f.axis, f.normal, 57.2, 1.25, 0.7, d);
        }
    }
    const lname = k ? 'southLantern' : 'northLantern',
      l = role(lname, d),
      lh = salzburgLanternWindows().filter((h) => h.name.startsWith(lname));
    solid(face, scaled(l, 1.15), 68.8, 69.6, 'copper');
    if (d >= 2) shell(out, d, l, 69.6, 75.3, lh, 'trim', scaled(l, 0.48));
    else solid(face, l, 69.6, 75.3, 'trim');
    cap(face, l, 69.6, 'copper');
    profile(
      face,
      l,
      [
        [75.3, 1.15],
        [76.8, 0.7],
        [78, 0.15],
      ],
      'copper',
    );
    beam(face, [p[0], floor + 77.8, p[1]], [p[0], floor + 79, p[1]], d ? 0.16 : 0.25, 'trim');
    beam(
      face,
      [p[0], floor + 78.6, p[1] - 0.42],
      [p[0], floor + 78.6, p[1] + 0.42],
      d ? 0.16 : 0.25,
      'trim',
    );
  }
}
function centralDome(out, face, d) {
  const r = role('centralDome', d),
    p = center(rawRing('centralDome')),
    hs = salzburgDrumWindows();
  if (d >= 2) shell(out, d, r, 40.9, H.drumTop, hs, 'wall');
  else solid(face, r, 40.9, H.drumTop, 'wall');
  if (d) {
    for (const h of hs) {
      window(face, h, d, d >= 2);
      if (d >= 2) pediment(face, h, d);
    }
    band(face, r, 51.3, 0.7, 'trim', 1.045);
    if (d >= 2) for (const pp of r) solid(face, rect(pp, 0.45, 0.45), 41.4, 51.3, 'trim');
  }
  const levels =
    d >= 2
      ? [
          [52, 1.04],
          [53.8, 1.02],
          [57.5, 0.91],
          [60.5, 0.64],
          [63, 0.32],
        ]
      : [
          [52, 1.04],
          [58, 0.88],
          [63, 0.32],
        ];
  profile(face, r, levels, 'copper');
  if (d >= 2)
    for (const q of r)
      for (let i = 1; i < levels.length; i++) {
        const [y, a] = levels[i - 1],
          [z, b] = levels[i];
        beam(
          face,
          [p[0] + (q[0] - p[0]) * a, floor + y, p[1] + (q[1] - p[1]) * a],
          [p[0] + (q[0] - p[0]) * b, floor + z, p[1] + (q[1] - p[1]) * b],
          0.16,
          'copper',
        );
      }
  const l = role('centralLantern', d),
    lh = salzburgLanternWindows().filter((h) => h.name.startsWith('centralLantern'));
  solid(face, scaled(l, 1.15), 62.8, 63.7, 'trim');
  if (d >= 2) shell(out, d, l, 63.7, 73, lh, 'trim', scaled(l, 0.52));
  else {
    solid(face, l, 63.7, 73, 'trim');
    if (d) for (const h of lh) pane(face, h, d, 0.045);
  }
  cap(face, l, 63.7, 'copper');
  profile(
    face,
    l,
    [
      [73, 1.13],
      [74.5, 0.75],
      [75.5, 0.15],
    ],
    'copper',
  );
  beam(face, [p[0], floor + 75.3, p[1]], [p[0], floor + 79, p[1]], d ? 0.2 : 0.3, 'trim');
  beam(face, [p[0], floor + 77.8, p[1] - 1], [p[0], floor + 77.8, p[1] + 1], d ? 0.2 : 0.3, 'trim');
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
  lowerBody(stable, face, d);
  roundedArms(stable, face, d);
  frontFacade(stable, face, d);
  towers(stable, face, d);
  centralDome(stable, face, d);
  if (d) {
    for (let i = 0; i < 4; i++)
      solid(face, rect([-51.5 - i * 0.6, 0], 0.65, 28.5), footing, -i * 0.12, 'trim');
  }
}
export const buildSalzburgSkyline = (o) => build(o, 0),
  buildSalzburgDistrict = (o) => build(o, 1),
  buildSalzburgStreet = (o) => build(o, 2),
  buildSalzburgCloseup = (o) => build(o, 3);
export const salzburgStudy = {
  id: 'N0345',
  key: 'salzburg_cathedral',
  title: 'Salzburg Cathedral',
  category: 'cathedral',
  wikidataId: 'Q258908',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief: rec.scope,
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID way239345806 and 35 current map controls, without rescaling. West twin towers resolve the facade at native-X.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Approximately 103x69m mapped cathedral. Individual raw part plans and height relationships control the twin towers, three rounded arms, nave/aisles and dome/lantern; internal profile/opening stages are picture-led estimates.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license;map geometry ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors;Protomaps;Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing 256-square graphs: weathered/raw limestone, standing-seam metal and wood. Dark roofs and copper cupolas share the metal graph with linear tints. Metric UVs, flat normals and glazing; clocks are simple geometry. No embedded images.',
  importReason:
    'Four authored browser levels preserve the individual twin-tower/three-apse/dome silhouette and signed Salzburg placement.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Individual exterior approximation from two useful inspected pictures and standard map/terrain. Selected figures/crest fields and clocks are simple geometry;exact sculpture,reliefs,inscriptions,full interiors,adjacent arcades/palace wings and plaza monuments excluded. Side/rear and oval glazing uses selected surface panels;certified walking and physical phone/laptop timings pending.',
    'Skyline retains stepped twin towers, green cupolas/lanterns, three rounded arms, high nave, dome and curved central facade. District adds shared graphs, recessed closed front portals, flat upper windows, selected frames/pilasters/clocks/figures and side glazing. Street opens actual belfry/lantern arches and recesses upper facade/central drum glazing; closeup refines curved profiles, mullions and trim. Visible detail changes remain.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'twin-tower-front-and-three-portals',
      position: [-126, 45, 18],
      lookAt: [-47, 31, 0],
      fov: 48,
    },
    {
      name: 'deep-portals-and-lower-figures',
      position: [-76, 12, 14],
      lookAt: [-49, 7, 1],
      fov: 48,
    },
    {
      name: 'clock-stages-open-belfries-and-copper-cupolas',
      position: [-90, 69, 53],
      lookAt: [-44, 52, 20],
      fov: 48,
    },
    {
      name: 'octagonal-drum-dome-and-lantern',
      position: [-11, 87, 65],
      lookAt: [16.5, 58, 0],
      fov: 48,
    },
    {
      name: 'rounded-transverse-arm-and-aisle-roofs',
      position: [16, 41, 100],
      lookAt: [12, 23, 20],
      fov: 48,
    },
    {
      name: 'eastern-rounded-sanctuary-and-roof-joins',
      position: [102, 48, -36],
      lookAt: [33, 24, 0],
      fov: 48,
    },
  ],
};

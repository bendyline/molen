/** Wawel Cathedral: mapped nave/chapels and individually interpreted three bell towers. */
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
  '../../../content/worldgen/source/places/u2/u2y/n0332_wawel_cathedral/',
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
  stone: '#d9d5c2',
  trim: '#e8e3ce',
  brick: '#a06b50',
  slate: '#515650',
  patina: '#74a993',
  gold: '#e9bd60',
  foundation: '#b5b0a0',
  glass: '#42505b',
  door: '#70553a',
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
const footing = (p) => Math.min(floor - 0.3, wawelCathedralGround(...p) - 0.35);
export function wawelCathedralGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Wawel Cathedral footing outside retained terrain');
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
  return (slot, p, direction) => {
    p = p.map((v) => v.map(Math.fround));
    if (direction) {
      for (let i = 1; i < p.length - 1; i++) {
        const n = normalFor(p[0], p[i], p[i + 1]);
        if (Math.hypot(...n) < 0.5) continue;
        if (n.reduce((sum, v, k) => sum + v * direction[k], 0) < 0) p = p.toReversed();
        break;
      }
    }
    const color = d === 0 ? colors[slot].map((v, k) => v * means[slot][k]) : colors[slot];
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
        slot === 'gold' ? 'patina' : slot,
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
const box = (face, p, w, d, b, t, slot) => solid(face, rect(p, w, d), b, t, slot);
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
export const wawelCathedralOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !wawelCathedralOpenings.some((q) => q.name === h.name))
    wawelCathedralOpenings.push(h);
  return h;
};
function shell(out, d, r, b, t, holes = [], slot = 'stone', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d === 2 ? 1 : d)),
    face = writer(openingBuilder(out, hs), d);
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
function crossTop(face, p, base, top, d) {
  box(face, p, 0.13, 0.13, base - 0.1, top, 'gold');
  if (d) box(face, p, 0.95, 0.13, top - 0.65, top - 0.48, 'gold');
}
function _cone(face, r, base, top, d) {
  profile(
    face,
    r,
    d === 0
      ? [
          [base, 1.06],
          [top, 0.025],
        ]
      : [
          [base, 1.05],
          [base + 0.2, 1.06],
          [top, 0.025],
        ],
    'slate',
  );
  if (d >= 3) {
    const p = center(r);
    for (let i = 0; i < r.length; i++) beam(face, at(r[i], base), at(p, top - 0.1), 0.065, 'trim');
  }
}
function subtractConvex(polygon, mask) {
  const pieces = [];
  let remaining = polygon;
  const clip = (p, a, b, positive) => {
    const result = [],
      value = (q) =>
        ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0])) *
        sign(mask) *
        (positive ? 1 : -1);
    if (!p.length) return result;
    let previous = p.at(-1),
      v = value(previous);
    for (const q of p) {
      const w = value(q);
      if (v >= 0 !== w >= 0) result.push(lerp(previous, q, v / (v - w)));
      if (w >= 0) result.push(q);
      previous = q;
      v = w;
    }
    return result;
  };
  for (let i = 0; i < mask.length && remaining.length > 2; i++) {
    const a = mask[i],
      b = mask[(i + 1) % mask.length],
      outside = clip(remaining, a, b, false);
    if (outside.length > 2) pieces.push(outside);
    remaining = clip(remaining, a, b, true);
  }
  return pieces;
}
function roof(face, r, short, base, top, slot = 'metal', masks = []) {
  const lo = Math.min(...r.map((p) => p[short])),
    hi = Math.max(...r.map((p) => p[short])),
    mid = (lo + hi) / 2,
    half = (hi - lo) / 2,
    y = (p) => floor + base + (top - base) * (1 - Math.min(1, Math.abs(p[short] - mid) / half));
  const polys = [];
  for (const sign of [-1, 1]) {
    const out = [];
    let a = r.at(-1),
      av = (a[short] - mid) * sign;
    for (const b of r) {
      const v = (b[short] - mid) * sign;
      if (av >= 0 !== v >= 0) out.push(lerp(a, b, av / (av - v)));
      if (v >= 0) out.push(b);
      a = b;
      av = v;
    }
    if (out.length > 2) polys.push(out);
  }
  for (const p of masks.reduce((ps, m) => ps.flatMap((p) => subtractConvex(p, m)), polys))
    cap(face, p, y, slot);
  const outline = r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      ts = [0];
    if (Math.abs(b[short] - a[short]) > 1e-8) {
      const t = (mid - a[short]) / (b[short] - a[short]);
      if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
    }
    return ts.sort((a, b) => a - b).map((t) => lerp(a, b, t));
  });
  sides(face, outline, base, y, 'stone');
}
function windows(face, r, d, bottom = 2.7, height = 3.1, name = 'body', spacing = 5) {
  if (!d) return;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < (d === 1 ? 4 : 1.1)) continue;
    const count = Math.max(1, Math.floor(f.length / (spacing * (d === 1 ? 1.8 : 1))));
    for (let k = 0; k < count; k++) {
      const p = lerp(f.a, f.b, (k + 0.5) / count);
      if (name === 'body' && p[0] < -14 && Math.abs(p[1] - rec.front.z) < 3.5) continue;
      const h = {
        center: p,
        axis: f.axis,
        normal: f.normal,
        width: Math.min(name === 'drum' ? 1.05 : 1.3, (f.length / count) * 0.65),
        bottom: floor + bottom,
        height,
        spring: height * 0.67,
        shape: 'pointed',
        depth: 1,
      };
      pane(face, h, d, 0.2);
      if (d >= 3) archBand(face, h, d, 0.18, 'trim', 0.12);
    }
  }
}
const _component = (id) => rec.components.find((c) => c.id === id);
const ring = (r, d) => simplify(r, d === 0 ? 0.55 : 0.04);
const holesFor = (r, b, t, d, name, count = 1) => {
  if (!d) return [];
  return r.flatMap((_p, i) => {
    const f = faceFrame(r, i);
    if (f.length < 1.2) return [];
    return Array.from({ length: count }, (_, k) =>
      remember(
        {
          name: `${name}-${i}-${k}`,
          center: lerp(f.a, f.b, (k + 0.5) / count),
          axis: f.axis,
          normal: f.normal,
          width: Math.min(1.35, (f.length / count) * 0.5),
          bottom: floor + b,
          height: t - b,
          spring: (t - b) * 0.7,
          shape: 'round',
          depth: 3.0,
        },
        d,
      ),
    );
  });
};
function stage(out, d, r, b, t, name, slot = 'patina') {
  const face = writer(out, d),
    open = holesFor(r, b + 0.5, t - 0.45, d, name);
  if (!d) {
    solid(face, r, b, t, slot);
    return;
  }
  const selected =
    d === 1
      ? name.includes('chapel') || name === 'vasa-lantern'
        ? []
        : open.toSorted((a, b) => a.normal[0] - b.normal[0]).slice(0, 1)
      : open;
  const inner = scaled(r, 0.68);
  shell(out, d, r, b, t, selected, slot, inner);
  for (const h of open) if (!selected.includes(h)) pane(face, h, d, 0.1);
  for (const h of open) {
    if (d >= 2) archBand(face, h, d === 2 ? 1 : d, 0.12, 'trim', 0.1);
  }
  if (d >= 2) {
    const p = center(r);
    box(face, p, 1.15, 1.15, b + 0.55, b + 1.35, 'gold');
    beam(face, at([p[0] - 0.9, p[1]], t - 0.3), at([p[0] + 0.9, p[1]], t - 0.3), 0.15, 'door');
    beam(face, at(p, b + 1.35), at(p, t - 0.3), 0.07, 'gold');
  }
  if (d >= 2) {
    band(face, r, b, 0.2, 'trim', 1.05);
    band(face, r, t - 0.18, 0.22, 'trim', 1.06);
  }
}
function tower(out, d, t) {
  const face = writer(out, d),
    r = ring(t.outline, d),
    p = t.center;
  if (!d) solid(face, r, footing, t.shaft, 'brick');
  else {
    solid(face, r, footing, 0, 'foundation');
    solid(face, r, 0, 9, 'stone');
    solid(face, r, 9, t.shaft, 'brick');
  }
  if (d) {
    for (const y of [9, t.shaft - 1]) band(face, r, y, 0.28);
    windows(face, r, d, 13, 4.3, `${t.name}-shaft`, 6);
  }
  if (t.name === 'silver') {
    const oct = regular(p, 4.15, 8, Math.PI / 8);
    stage(out, d, oct, t.shaft, t.lantern, `${t.name}-bell`, 'brick');
    profile(
      face,
      oct,
      [
        [t.lantern, 1.05],
        [t.top - 0.25, 0.03],
      ],
      'slate',
    );
    crossTop(face, p, t.top - 0.3, t.top, d);
  } else if (t.name === 'clock') {
    const lower = scaled(r, 0.78),
      upper = regular(p, 2.8, d <= 1 ? 8 : 12, Math.PI / 8);
    profile(
      face,
      r,
      [
        [27, 1.08],
        [28.4, 0.76],
      ],
      'patina',
    );
    stage(out, d, lower, 28.4, 36.2, 'clock-lower');
    profile(
      face,
      lower,
      d <= 1
        ? [
            [36.2, 1.13],
            [37.6, 0.48],
          ]
        : [
            [36.2, 1.13],
            [36.8, 1.18],
            [37.6, 0.48],
          ],
      'patina',
    );
    stage(out, d, upper, 37.6, 41.4, 'clock-lantern');
    profile(
      face,
      upper,
      d <= 1
        ? [
            [41.4, 1.12],
            [43.6, 0.02],
          ]
        : [
            [41.4, 1.12],
            [42.0, 1.1],
            [42.8, 0.6],
            [43.6, 0.03],
          ],
      'patina',
    );
    crossTop(face, p, 43.55, 45, d);
    if (d >= 2)
      for (const q of scaled(r, 1.03)) {
        const arm = [q[0], q[1]];
        profile(
          face,
          regular(arm, 0.4, 4),
          [
            [27.2, 1],
            [28.8, 0.7],
            [29.4, 0.05],
          ],
          'trim',
        );
      }
    if (d) clockDial(face, r, d);
  } else {
    const oct = regular(p, 5.0, 8, Math.PI / 8);
    profile(
      face,
      r,
      d <= 1
        ? [
            [27, 1.05],
            [32, 0.7],
            [36, 0.08],
          ]
        : [
            [27, 1.05],
            [28.3, 1.08],
            [30.5, 0.88],
            [33, 0.5],
            [34.7, 0.53],
            [36, 0.07],
          ],
      'patina',
    );
    stage(out, d, scaled(oct, 0.32), 36, 38.5, 'sigismund-lantern');
    profile(
      face,
      scaled(oct, 0.32),
      [
        [38.5, 1.15],
        [39.6, 0.04],
      ],
      'patina',
    );
    crossTop(face, p, 39.55, 41, d);
  }
}
function clockDial(face, r, d) {
  const f = r.map((_, i) => faceFrame(r, i)).sort((a, b) => a.normal[0] - b.normal[0])[0];
  const p = lerp(f.a, f.b, 0.5),
    radius = 2.1,
    atDial = (u, v) => [
      p[0] + f.normal[0] * 0.13 + f.axis[0] * u,
      floor + 20.9 + v,
      p[1] + f.normal[1] * 0.13 + f.axis[1] * u,
    ];
  const n = d === 1 ? 12 : 24,
    inner = Array.from({ length: n }, (_, i) =>
      atDial(radius * Math.cos((i * 2 * Math.PI) / n), radius * Math.sin((i * 2 * Math.PI) / n)),
    );
  face('patina', inner, [f.normal[0], 0, f.normal[1]]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      a = (i * 2 * Math.PI) / n,
      b = (j * 2 * Math.PI) / n;
    face(
      'gold',
      [
        atDial(radius * Math.cos(a), radius * Math.sin(a)),
        atDial((radius + 0.15) * Math.cos(a), (radius + 0.15) * Math.sin(a)),
        atDial((radius + 0.15) * Math.cos(b), (radius + 0.15) * Math.sin(b)),
        atDial(radius * Math.cos(b), radius * Math.sin(b)),
      ],
      [f.normal[0], 0, f.normal[1]],
    );
  }
  beam(face, atDial(0, 0), atDial(-0.8, 0.95), 0.1, 'gold');
  beam(face, atDial(0, 0), atDial(0.55, 0.5), 0.1, 'gold');
  if (d >= 2)
    for (let i = 0; i < 12; i++) {
      const a = (i * 2 * Math.PI) / 12;
      beam(
        face,
        atDial(1.65 * Math.cos(a), 1.65 * Math.sin(a)),
        atDial(1.94 * Math.cos(a), 1.94 * Math.sin(a)),
        0.07,
        'gold',
      );
    }
}
function chapel(out, d, t) {
  const face = writer(out, d),
    r = ring(t.outline, d),
    p = t.center,
    rr =
      Math.min(
        ...[0, 1].map((k) => Math.max(...r.map((q) => q[k])) - Math.min(...r.map((q) => q[k]))),
      ) * 0.43;
  if (d) solid(face, r, footing, 0, 'foundation');
  solid(face, r, d ? 0 : footing, t.eave, 'stone');
  const n = d <= 1 ? 8 : d === 2 ? 12 : d === 3 ? 16 : 24,
    drum = regular(p, rr, n, Math.PI / 8);
  solid(face, drum, t.eave, t.drum, 'stone');
  profile(
    face,
    drum,
    d <= 1
      ? [
          [t.drum, 1],
          [t.roof, 0.16],
        ]
      : [
          [t.drum, 1],
          [t.drum + (t.roof - t.drum) * 0.32, 0.95],
          [t.drum + (t.roof - t.drum) * 0.7, 0.7],
          [t.roof, 0.16],
        ],
    t.slot,
  );
  const upper = regular(p, rr * 0.24, 8, Math.PI / 8);
  stage(out, d, upper, t.roof, t.lantern, `${t.name}-lantern`, 'stone');
  profile(
    face,
    upper,
    [
      [t.lantern, 1.12],
      [t.top - 0.55, 0.04],
    ],
    t.slot,
  );
  if (d) crossTop(face, p, t.top - 0.55, t.top, d);
  if (d) {
    band(face, r, t.eave - 0.25, 0.25);
    windows(face, r, d, 2.5, 3.7, `${t.name}-chapel`, 5);
  }
  if (d >= 2) {
    for (const q of r) box(face, q, 0.34, 0.34, 0.3, t.eave - 0.2, 'trim');
    for (let i = 0; i < 8; i++) {
      const a = (i * 2 * Math.PI) / 8,
        start = [p[0] + rr * Math.cos(a), p[1] + rr * Math.sin(a)],
        end = [p[0] + rr * 0.2 * Math.cos(a), p[1] + rr * 0.2 * Math.sin(a)];
      beam(face, at(start, t.drum + 0.15), at(end, t.roof - 0.1), 0.08, t.slot);
    }
  }
}
function entrance(out, d) {
  const face = writer(out, d),
    h = remember(
      {
        name: 'west-entry-recess',
        center: [-36, rec.front.z],
        axis: [0, 1],
        normal: [-1, 0],
        width: 3.5,
        bottom: floor + 0.02,
        height: 5.7,
        spring: 4.8,
        shape: 'round',
        depth: 11,
      },
      d,
    );
  const pp = rect([-39.55, rec.front.z], 2.9, 5.0);
  shell(out, d, pp, 0, 6.25, d ? [h] : [], 'stone');
  roof(face, scaled(pp, 1.1), 1, 6.25, 7.75, 'slate');
  if (d) archBand(face, { ...h, center: [-41, rec.front.z] }, d, 0.3, 'trim', 0.15);
  pane(
    face,
    { ...h, center: [-31.7, rec.front.z], width: 3.0, height: 5.15, spring: 4.2 },
    d,
    0.05,
    'door',
  );
  const stairN = d === 0 ? 1 : d === 1 ? 3 : 6,
    x0 = rec.front.stepOutline[0][0],
    x1 = -41.0;
  for (let i = 0; i < stairN; i++) {
    const a = x0 + ((x1 - x0) * i) / stairN,
      top = floor - 0.05 - (stairN - 1 - i) * 0.17;
    solid(
      face,
      rect([(a + x1) / 2, rec.front.z], x1 - a, 4.2),
      (p) => Math.min(top - 0.15, wawelCathedralGround(...p) - 0.12),
      () => top,
      'foundation',
    );
  }
  return h;
}
function rose(face, h, d) {
  const radius = 1.85,
    n = d === 1 ? 12 : d === 2 ? 16 : 24,
    p = prepareOpening(h, 0, d),
    offset = 0.15;
  const point = (r, a) => p.point(r * Math.cos(a), floor + 16.0 + r * Math.sin(a), offset);
  face(
    'glass',
    Array.from({ length: n }, (_, i) => point(radius, (i * 2 * Math.PI) / n)),
    [-1, 0, 0],
  );
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    face(
      'trim',
      [point(radius, a), point(radius + 0.22, a), point(radius + 0.22, b), point(radius, b)],
      [-1, 0, 0],
    );
  }
  if (d >= 2)
    for (let i = 0; i < 8; i++)
      beam(face, point(0.25, (i * Math.PI) / 4), point(radius, (i * Math.PI) / 4), 0.08, 'trim');
}
function cathedral(out, d) {
  const entry = entrance(out, d),
    hs = d ? [prepareOpening(entry, 0, d)] : [],
    face = writer(openingBuilder(out, hs), d);
  for (const p of rec.main.polygons) {
    const r = ring(p.outline, d);
    if (!d) solid(face, r, footing, 9, 'stone');
    else {
      solid(face, r, footing, 0, 'foundation');
      shell(out, d, r, 0, 6, [entry], 'stone');
    }
  }
  for (const p of d ? rec.flatRoofs : []) {
    solid(face, ring(p.outline, d), 6, 9, 'stone');
    cap(face, ring(p.outline, d), 9, 'slate', p.holes);
  }
  // Lower roof surfaces may continue under higher masses; supporting wall volumes remain full.
  for (const t of rec.roofs) {
    const r = ring(t.outline, d);
    solid(face, r, footing, t.base, t.wall);
    roof(face, r, t.short, t.base, t.top, t.roof, d ? [rec.silver.outline] : []);
    if (d) {
      band(face, r, t.base - 0.3, 0.3);
      windows(face, r, d, t.base >= 20 ? 17 : 3, t.base >= 20 ? 5.8 : 3.8, t.name, 5.5);
    }
  }
  if (d) {
    const t = rec.roofs.find((r) => r.name === 'west-nave'),
      r = t.outline,
      w = r.map((_, i) => faceFrame(r, i)).sort((a, b) => a.normal[0] - b.normal[0])[0],
      mid = lerp(w.a, w.b, 0.5);
    // Pale west gable overlays the mapped red nave wall; no photographed sculpture is copied.
    face(
      'stone',
      [at(w.a, 9), at(w.b, 9), at(w.b, t.base), at(mid, t.top), at(w.a, t.base)].map((p) => [
        p[0] + w.normal[0] * 0.09,
        p[1],
        p[2] + w.normal[1] * 0.09,
      ]),
      [w.normal[0], 0, w.normal[1]],
    );
    rose(
      face,
      {
        center: [mid[0] + w.normal[0] * 0.06, mid[1] + w.normal[1] * 0.06],
        axis: w.axis,
        normal: w.normal,
        width: 3.7,
        height: 3.7,
        shape: 'rect',
        bottom: 0,
        depth: 1,
      },
      d,
    );
    if (d >= 2) {
      for (const t of rec.roofs.filter((t) => t.base >= 20))
        for (const p of t.outline) {
          const q = center(t.outline),
            v = unit(p.map((n, k) => n - q[k])),
            outer = p.map((n, k) => n + v[k] * 0.75);
          solid(face, rect(outer, 1.0, 1.0), 0, t.base - 1.0, 'trim');
          beam(face, at(outer, t.base - 1.0), at(p, t.base), 0.45, 'trim');
        }
    }
  }
  for (const t of [rec.clock, rec.silver, rec.sigismund]) tower(out, d, t);
  for (const t of rec.chapels) chapel(out, d, t);
}
function build(out, d) {
  const destination = out;
  out = {
    addTriangle(slot, ref, p, n, uv, col) {
      p = p.map((q) => q.map(Math.fround));
      if (
        Math.hypot(
          ...cross(
            p[1].map((v, k) => v - p[0][k]),
            p[2].map((v, k) => v - p[0][k]),
          ),
        ) < 1e-8
      )
        return;
      destination.addTriangle(slot === 'gold' ? 'patina' : slot, ref, p, n, uv, col);
    },
  };
  cathedral(out, d);
}
export const buildWawelCathedralSkyline = (out) => build(out, 0);
export const buildWawelCathedralDistrict = (out) => build(out, 1);
export const buildWawelCathedralStreet = (out) => build(out, 2);
export const buildWawelCathedralCloseup = (out) => build(out, 3);
export const wawelCathedralStudy = {
  id: 'N0332',
  key: 'wawel_cathedral',
  title: 'Wawel Cathedral',
  category: 'cathedral',
  wikidataId: 'Q638519',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Wawel cathedral exterior with pale west gable/rose and portico, separate green clock/Sigismund and brick Silver Bells towers, steep nave/transept/choir roofs, dark Vasa/gold Sigismund domed chapels and connected northern treasury/chapterhouse. The existing royal palace remains a separate asset.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID retained outline and28 current PMTiles controls with named northern Sigismund/clock and southern Silver Bells crypt POIs.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Mapped cathedral/connected northern footprints; nominal tagged primary heights and picture-led stage profiles. Disputed55m southern cap is retained without being imposed on the photographed shorter tower.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Six existing shared256-square limestone/brick/slate/copper/raw-stone/wood graphs, metric UVs and linear tints. Green patina and gold chapel use one copper graph/material with different vertex tints; glazing uses vertex colors. No embedded image.',
  importReason:
    'Four individually authored browser levels preserve the separate cathedral towers, west façade and southern domes beside the existing palace.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Exact sculpture, tracery, inscriptions, interiors and monastic/royal compound are excluded. Green/gold roof material shares one metallic compromise. Neighboring palace thresholds and physical phone/laptop timing are unverified.',
    'Skyline preserves primary tower/gable/dome silhouettes; district restores selected openings/shared textures, street restores complete stages and buttresses, closeup refines domes, rose/clock trim and stone surrounds. Detail/profile changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'west-gable-portico-and-clock',
      position: [-88, 30, -5],
      lookAt: [-28, 22, -1],
      fov: 43,
    },
    { name: 'clock-open-copper-stages', position: [-47, 54, -36], lookAt: [-24, 36, -14], fov: 43 },
    {
      name: 'silver-bells-and-southern-domes',
      position: [-38, 35, 52],
      lookAt: [-13, 17, 14],
      fov: 43,
    },
    {
      name: 'sigismund-north-tower-and-treasury',
      position: [9, 49, -72],
      lookAt: [1, 22, -26],
      fov: 43,
    },
    { name: 'choir-and-transept-roofs', position: [64, 49, 48], lookAt: [12, 23, 5], fov: 43 },
    { name: 'west-entry-and-plaza-contact', position: [-54, 10, 13], lookAt: [-37, 7, 0], fov: 43 },
  ],
};

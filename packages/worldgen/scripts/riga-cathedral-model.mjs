/** Riga Cathedral: mapped brick basilica, arcaded western shaft and copper clock/bulb tower. */
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
  '../../../content/worldgen/source/places/ud/ud1/n0334_riga_cathedral/',
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
  brick: '#b17c65',
  trim: '#d5bd8d',
  slate: '#6b686a',
  copper: '#b89b86',
  foundation: '#aaa28f',
  bronze: '#c9aa60',
  glass: '#39433e',
  door: '#70533a',
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
const footing = (p) => Math.min(floor - 0.3, rigaGround(...p) - 0.35);
export function rigaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Riga Cathedral footing outside retained terrain');
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
export const rigaOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !rigaOpenings.some((q) => q.name === h.name)) rigaOpenings.push(h);
  return h;
};
function shell(out, d, r, b, t, holes = [], slot = 'brick', inner = null) {
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
function _crossTop(face, p, base, top, d) {
  box(face, p, 0.13, 0.13, base - 0.1, top, 'bronze');
  if (d) box(face, p, 0.95, 0.13, top - 0.65, top - 0.48, 'bronze');
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
function roof(face, r, short, base, top, slot = 'metal', masks = [], sections = null) {
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
  if (sections) for (const p of sections) cap(face, p.outline, y, slot, p.holes);
  else
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
  sides(face, outline, base, y, 'brick');
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
      if (name === 'western-shoulders' && p[0] < -29 && Math.abs(p[1] - rec.tower.center[1]) < 8)
        continue;
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
const ring = (r, d) => simplify(r, d === 0 ? 0.65 : 0.04);
function panels(r, b, h, d, count = 2, shape = 'round', material = 'glass') {
  if (!d) return [];
  return r.flatMap((_p, i) => {
    const f = faceFrame(r, i);
    if (f.length < 6) return [];
    return Array.from({ length: count }, (_, k) => ({
      name: `tower-${b}-${i}-${k}`,
      center: lerp(f.a, f.b, (k + 0.5) / count),
      axis: f.axis,
      normal: f.normal,
      width: Math.min(count === 4 ? 2.0 : 2.15, (f.length / count) * 0.7),
      bottom: floor + b,
      height: h,
      spring: h * 0.72,
      shape,
      depth: 3,
      material,
    }));
  });
}
function entry(d) {
  return remember(
    {
      name: 'west-entry-recess',
      center: [-42, rec.front.z],
      axis: [0, 1],
      normal: [-1, 0],
      width: 3.4,
      bottom: floor + 0.03,
      height: 6.4,
      spring: 4.2,
      shape: 'pointed',
      depth: 11,
    },
    d,
  );
}
function tower(out, d, door) {
  const t = rec.tower,
    r = ring(t.outline, d),
    face = writer(out, d),
    upper = panels(r, 37.5, 5.5, d, 4)
      .filter((h) => h.name.endsWith('-1') || h.name.endsWith('-2'))
      .map((h) => remember(h, d)),
    open =
      d === 1
        ? upper
            .filter((h) => h.name.endsWith('-1'))
            .sort((a, b) => a.normal[0] - b.normal[0])
            .slice(0, 1)
        : upper;
  if (!d) solid(face, r, footing, t.shaft, 'brick');
  else shell(out, d, r, footing, t.shaft, [door, ...open], 'brick', scaled(r, 0.86));
  for (const row of [
    [12.5, 6.4, 2, 'pointed'],
    [23.1, 7.2, 2, 'pointed'],
    [32, 4.8, 4, 'round'],
    [37.5, 5.5, 4, 'round'],
  ]) {
    if (!d) continue;
    for (const h of panels(r, ...row.slice(0, 2), d, row[2], row[3])) {
      const match = upper.find((q) => q.name === h.name);
      const blind = row[2] === 4 && (h.name.endsWith('-0') || h.name.endsWith('-3'));
      if (!match || !open.some((q) => q.name === h.name))
        pane(face, h, d, 0.13, blind ? 'trim' : 'glass');
      if (d >= 2) archBand(face, h, d, 0.23, 'trim', 0.19);
    }
  }
  if (d)
    for (const y of [12, 22.4, 31.4, 36.8, 44.6]) {
      band(face, r, y, 0.26, 'trim', 1.015);
      if (d >= 3)
        for (let i = 0; i < r.length; i++) {
          const f = faceFrame(r, i);
          if (f.length < 6) continue;
          const count = Math.floor(f.length / 1.3);
          for (let j = 0; j < count; j++) {
            const p = lerp(f.a, f.b, (j + 0.5) / count),
              h = {
                center: p,
                axis: f.axis,
                normal: f.normal,
                width: 0.8,
                bottom: floor + y - 0.9,
                height: 0.7,
                spring: 0.35,
                shape: 'round',
                depth: 1,
              };
            pane(face, h, d, 0.1, 'trim');
          }
        }
    }
  profile(
    face,
    r,
    d <= 1
      ? [
          [45, 1.06],
          [51, 0.88],
          [59.6, 0.39],
          [61, 0.4],
        ]
      : [
          [45, 1.06],
          [46.5, 1.06],
          [50, 0.92],
          [54, 0.7],
          [58.4, 0.43],
          [59.6, 0.39],
          [61, 0.4],
        ],
    'copper',
  );
  const lantern = regular(t.center, 3.0, d <= 1 ? 8 : 12, Math.PI / 8),
    lanternOpen = d
      ? lantern.flatMap((_p, i) => {
          const f = faceFrame(lantern, i);
          return [
            remember(
              {
                name: `lantern-${i}`,
                center: lerp(f.a, f.b, 0.5),
                axis: f.axis,
                normal: f.normal,
                width: 1.1,
                bottom: floor + 62.0,
                height: 5.45,
                spring: 4.1,
                shape: 'round',
                depth: 2.2,
              },
              d,
            ),
          ];
        })
      : [],
    selected = d === 1 ? lanternOpen.filter((_, i) => i % 2 === 0) : lanternOpen;
  if (!d) solid(face, lantern, 61, 69, 'copper');
  else shell(out, d, lantern, 61, 69, selected, 'copper', scaled(lantern, 0.68));
  for (const h of lanternOpen) {
    if (d === 1 && !selected.includes(h)) pane(face, h, d, 0.1);
    if (d >= 2) archBand(face, h, d === 2 ? 1 : d, 0.13, 'trim', 0.13);
  }
  if (d >= 2) {
    const p = t.center;
    box(face, p, 1.0, 1.0, 62, 63.5, 'bronze');
    beam(face, at([p[0] - 1, p[1]], 68), at([p[0] + 1, p[1]], 68), 0.18, 'door');
    beam(face, at(p, 63.5), at(p, 68), 0.08, 'bronze');
  }
  if (d) {
    band(face, lantern, 61.2, 0.22, 'trim', 1.03);
    band(face, lantern, 68.7, 0.3, 'trim', 1.06);
  }
  const bulb = regular(
    t.center,
    d === 0 ? 4.0 : 4.1,
    d <= 1 ? 8 : d === 2 ? 12 : d === 3 ? 16 : 24,
    Math.PI / 8,
  );
  profile(
    face,
    bulb,
    d <= 1
      ? [
          [69, 0.68],
          [72, 0.94],
          [75, 1],
          [77, 0.65],
          [79, 0.16],
        ]
      : [
          [69, 0.68],
          [70.8, 0.86],
          [73, 1],
          [75, 0.96],
          [76.8, 0.69],
          [78.1, 0.33],
          [79, 0.16],
        ],
    'copper',
  );
  const mast = regular(t.center, 0.9, d <= 1 ? 6 : 10);
  profile(
    face,
    mast,
    [
      [79, 1.05],
      [80.2, 0.82],
      [81, 0.72],
      [82.3, 0.52],
      [83, 0.15],
    ],
    'copper',
  );
  box(face, t.center, 0.13, 0.13, 82.9, 90, 'bronze');
  if (d) {
    const p = t.center;
    beam(face, at([p[0] - 1.6, p[1]], 88.35), at([p[0] + 1.6, p[1]], 88.35), 0.1, 'bronze');
    solid(face, rect([p[0] + 1.1, p[1]], 0.9, 0.13), 88.3, 88.8, 'bronze');
  }
  if (d) clockFaces(face, r, d);
}
function clockFaces(face, r, d) {
  const p = rec.tower.center;
  const frames = r.map((_p, i) => faceFrame(r, i)).filter((f) => f.length > 8);
  for (const f of frames) {
    const radius = 1.65,
      cp = [p[0] + f.normal[0] * 6.15, p[1] + f.normal[1] * 6.15],
      position = (u, v) => [cp[0] + f.axis[0] * u, floor + 53.7 + v, cp[1] + f.axis[1] * u],
      n = d === 1 ? 12 : 24;
    const backing = [
      [-2.0, -1.95],
      [2.0, -1.95],
      [2.0, 1.95],
      [-2.0, 1.95],
    ].map((q) => position(...q));
    const back = backing.map((q) => [q[0] - f.normal[0] * 2.1, q[1], q[2] - f.normal[1] * 2.1]);
    face(
      'copper',
      backing.map((q) => [q[0] - f.normal[0] * 0.06, q[1], q[2] - f.normal[1] * 0.06]),
      [f.normal[0], 0, f.normal[1]],
    );
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      face('copper', [back[i], back[j], backing[j], backing[i]]);
    }
    face(
      'glass',
      Array.from({ length: n }, (_, i) =>
        position(
          radius * Math.cos((i * 2 * Math.PI) / n),
          radius * Math.sin((i * 2 * Math.PI) / n),
        ),
      ),
      [f.normal[0], 0, f.normal[1]],
    );
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n;
      face(
        'bronze',
        [
          position(radius * Math.cos(a), radius * Math.sin(a)),
          position((radius + 0.14) * Math.cos(a), (radius + 0.14) * Math.sin(a)),
          position((radius + 0.14) * Math.cos(b), (radius + 0.14) * Math.sin(b)),
          position(radius * Math.cos(b), radius * Math.sin(b)),
        ],
        [f.normal[0], 0, f.normal[1]],
      );
    }
    beam(face, position(0, 0), position(-0.85, 0.8), 0.1, 'bronze');
    beam(face, position(0, 0), position(0.6, 0.8), 0.1, 'bronze');
    if (d >= 2)
      for (let i = 0; i < 12; i++) {
        const a = (i * 2 * Math.PI) / 12;
        beam(
          face,
          position(1.3 * Math.cos(a), 1.3 * Math.sin(a)),
          position(1.55 * Math.cos(a), 1.55 * Math.sin(a)),
          0.07,
          'bronze',
        );
      }
  }
}
function rosette(face, d) {
  if (!d) return;
  const z = rec.front.z,
    x = -43.92,
    y = floor + 8.7,
    r = 1.5,
    n = d === 1 ? 12 : 24,
    p = (radius, a) => [x, y + radius * Math.sin(a), z + radius * Math.cos(a)];
  face(
    'glass',
    Array.from({ length: n }, (_, i) => p(r, (i * 2 * Math.PI) / n)),
    [-1, 0, 0],
  );
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n,
      b = ((i + 1) * 2 * Math.PI) / n;
    face('trim', [p(r, a), p(r + 0.24, a), p(r + 0.24, b), p(r, b)], [-1, 0, 0]);
  }
  if (d >= 2)
    for (let i = 0; i < 6; i++)
      beam(face, p(0.25, (i * Math.PI) / 3), p(r, (i * Math.PI) / 3), 0.1, 'trim');
}
function roofY(_x, z) {
  const t = rec.roofs.find((r) => r.name === 'nave'),
    lo = Math.min(...t.outline.map((p) => p[1])),
    hi = Math.max(...t.outline.map((p) => p[1]));
  return (
    t.base + (t.top - t.base) * (1 - Math.min(1, Math.abs(z - (hi + lo) / 2) / ((hi - lo) / 2)))
  );
}
function dormers(face, d) {
  if (!d) return;
  for (const t of rec.dormers.filter((t) => d > 1 || t.top === 31)) {
    const r = t.outline,
      bottom = Math.min(...r.map((q) => roofY(...q))) - 0.12,
      top = t.top;
    solid(face, r, bottom, top - 0.55, 'copper');
    profile(
      face,
      r,
      [
        [top - 0.55, 1.1],
        [top, 0.05],
      ],
      'copper',
    );
    if (d >= 2) windows(face, r, d, bottom + 0.35, Math.max(0.4, top - bottom - 1), 'roof-vent', 3);
  }
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
      destination.addTriangle(slot, ref, p, n, uv, col);
    },
  };
  const door = entry(d),
    face = writer(openingBuilder(out, [prepareOpening(door, 0, d)]), d);
  for (const p of rec.main.polygons) {
    const r = ring(p.outline, d);
    solid(face, r, footing, 0, 'foundation');
    shell(out, d, r, 0, 2.5, [door], 'brick');
    cap(face, r, 2.5, 'slate', p.holes);
  }
  for (const p of rec.flatRoofs) {
    const r = ring(p.outline, d);
    solid(face, r, 2.5, 3.8, 'brick');
    cap(face, r, 3.8, 'slate', p.holes);
  }
  for (const t of rec.roofs) {
    const r = ring(t.outline, d);
    solid(face, r, footing, t.base, 'brick');
    roof(face, r, t.short, t.base, t.top, 'slate', [], d ? t.roofSections : null);
    if (d) {
      band(face, r, t.base - 0.24, 0.25, 'trim');
      windows(
        writer(out, d),
        r,
        d,
        t.name === 'nave' ? 20.5 : t.base > 12 ? 7 : 1.5,
        t.name === 'nave' ? 3.1 : t.base > 12 ? 5.3 : 2.2,
        t.name,
        5.6,
      );
    }
  }
  for (const t of rec.apses) {
    const r = ring(t.outline, d);
    solid(face, r, footing, t.base, 'brick');
    profile(
      face,
      r,
      [
        [t.base, 1.02],
        [t.top, 0.05],
      ],
      'slate',
    );
    if (d) windows(writer(out, d), r, d, 1.1, Math.max(1, t.base - 2), 'apse', 3.3);
  }
  tower(out, d, door);
  dormers(writer(out, d), d);
  rosette(writer(out, d), d);
  pane(
    writer(out, d),
    { ...door, center: [rec.front.doorX, rec.front.z], width: 3.05, height: 5.9, spring: 4.0 },
    d,
    0.05,
    'door',
  );
  if (d) archBand(writer(out, d), { ...door, center: [-43.95, rec.front.z] }, d, 0.4, 'trim', 0.09);
  const n = d === 0 ? 1 : d === 1 ? 3 : 5,
    x0 = rec.front.steps[0][0],
    x1 = rec.front.x;
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n,
      b = x0 + ((x1 - x0) * (i + 1)) / n,
      y = floor - 0.05 - (n - 1 - i) * 0.19;
    solid(
      writer(out, d),
      rect([(a + b) / 2, rec.front.z], b - a, 5.3),
      (p) => Math.min(y - 0.15, rigaGround(...p) - 0.1),
      () => y,
      'foundation',
    );
  }
}
export const buildRigaSkyline = (out) => build(out, 0);
export const buildRigaDistrict = (out) => build(out, 1);
export const buildRigaStreet = (out) => build(out, 2);
export const buildRigaCloseup = (out) => build(out, 3);
export const rigaStudy = {
  id: 'N0334',
  key: 'riga_cathedral',
  title: 'Riga Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1133059',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Riga cathedral exterior: arcaded brick western shaft, brown copper clock roof/open lantern/bulb cap, long gray nave/aisle/transept roofs, lower eastern choir/apses/ranges, mapped roof dormers, circular west window, closed portal and approximate steps.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID outline and30 unioned current PMTiles main/part controls distinguish western tower, nave, aisles, transept and lower eastern ranges.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Full mapped87x45m envelope, nominal roof/cap heights and retained90m overall crown; intermediate architectural profiles and exact ground levels remain picture-led estimates.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Seven existing shared 256-square brick/limestone/slate/copper/raw-stone/bronze/wood graphs, metric UVs and linear tints. Glass uses vertex colors; no embedded images.',
  importReason:
    'Four independently authored browser levels preserve the western clock/bulb silhouette and stepped mapped cathedral roofs at the correct location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Exact brick tracery, blind arcade patterns, clock numerals, sculpture/weathercock shape, full interiors and surrounding cloister/museum block excluded. Western door design is an estimate; closed portal and simplified vane do not certify walking surfaces. Low eastern5/8m tags are retained without survey verification. Physical laptop/phone timing pending.',
    'Skyline simplifies closed stages/window surfaces and omits roof dormers; district restores selected belfry/lantern cuts and shared textures; street restores full large cuts, mapped dormers and clock/rose detail; closeup refines bulb/arch facets, friezes and trim. Detail/profile changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'western-brick-arcades-and-portal',
      position: [-89, 35, -4],
      lookAt: [-36, 26, -0.3],
      fov: 43,
    },
    {
      name: 'copper-clock-and-open-lantern',
      position: [-66, 74, -42],
      lookAt: [-36, 62, -0.3],
      fov: 43,
    },
    {
      name: 'bulb-mast-and-simple-vane',
      position: [-48, 94, -23],
      lookAt: [-36, 80, -0.3],
      fov: 43,
    },
    { name: 'north-nave-aisle-and-transept', position: [0, 45, -72], lookAt: [3, 21, -8], fov: 43 },
    {
      name: 'eastern-choir-apses-and-roofs',
      position: [69, 30, -40],
      lookAt: [24, 12, 0],
      fov: 43,
    },
    {
      name: 'south-aisle-and-mapped-roof-dormers',
      position: [4, 45, 70],
      lookAt: [-2, 24, 9],
      fov: 43,
    },
  ],
};

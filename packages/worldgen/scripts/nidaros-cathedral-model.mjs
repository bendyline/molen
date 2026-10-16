/** Nidaros Cathedral: mapped brick basilica, arcaded western shaft and copper clock/bulb tower. */
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
  '../../../content/worldgen/source/places/u5/u5r/n0336_nidaros_cathedral/',
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
  stone: '#a0aaa0',
  trim: '#bdc3b6',
  copper: '#8caa98',
  slate: '#716963',
  foundation: '#aaa89c',
  glass: '#4d6178',
  door: '#725743',
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
const footing = (p) => Math.min(floor - 0.3, nidarosGround(...p) - 0.35);
export function nidarosGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Nidaros Cathedral footing outside retained terrain');
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
const _regular = (p, r, n = 8, offset = 0) =>
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
function roof(face, r, short, base, top, slot = 'roof', masks = [], sections = null) {
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
  sides(face, outline, base, y, 'stone');
}
const ring = (r, d) => simplify(r, d <= 1 ? 1.05 : 0.06);
const bounds = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
export const nidarosOpenings = [];
function surfaceFrame(h, d) {
  const p = prepareOpening(h, 0, d),
    s = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  return { ...p, point: (x, y, z) => p.point(x, y, z * s) };
}
function window(face, h, d, bars = 0, closed = false) {
  pane(face, h, d, 0.15, closed ? 'door' : 'glass');
  if (d >= 2) {
    archBand(face, h, d, 0.3, 'trim', 0.21);
    const p = surfaceFrame(h, d);
    for (let i = 1; i <= bars; i++) {
      const x = -h.width / 2 + (h.width * i) / (bars + 1);
      beam(face, p.point(x, h.bottom, 0.25), p.point(x, h.bottom + h.spring, 0.25), 0.23, 'trim');
    }
  }
}
function windows(face, r, d, bottom, height, name, spacing = 4.8) {
  if (!d) return;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 2.8) continue;
    const n = Math.max(1, Math.floor(f.length / (spacing * (d === 1 ? 1.7 : 1))));
    for (let j = 0; j < n; j++) {
      const p = lerp(f.a, f.b, (j + 0.5) / n);
      if (name === 'nave' && p[0] < -40) continue;
      window(
        face,
        {
          name: `${name}-${i}-${j}`,
          center: p,
          axis: f.axis,
          normal: f.normal,
          width: Math.min(2.7, (f.length / n) * 0.58),
          bottom: floor + bottom,
          height,
          spring: height * 0.72,
          shape: name.includes('chapel') ? 'round' : 'pointed',
          depth: 1,
        },
        d,
        d >= 3 ? 1 : 0,
      );
    }
  }
}
function pinnacle(face, p, b, top, d, width = 1.1) {
  if (!d) {
    profile(
      face,
      rect(p, width, width),
      [
        [b, 1],
        [top, 0.02],
      ],
      'trim',
    );
    return;
  }
  box(face, p, width, width, b, top - 4.0, 'trim');
  profile(
    face,
    rect(p, width * 1.18, width * 1.18),
    [
      [top - 4, 1],
      [top, 0.02],
    ],
    'trim',
  );
}
function tower(out, t, d) {
  const face = writer(out, d),
    r = ring(t.outline, d),
    crossing = t.name === 'crossing',
    upper = crossing ? 28 : 23,
    holes = [];
  if (d)
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 4) continue;
      const count = crossing ? (d === 1 ? 3 : 4) : 1;
      for (let j = 0; j < count; j++) {
        const h = {
          name: `${t.name}-belfry-${i}-${j}`,
          center: lerp(f.a, f.b, (j + 0.5) / count),
          axis: f.axis,
          normal: f.normal,
          width: crossing ? 1.45 : 2.65,
          bottom: floor + (crossing ? 29.0 : 25),
          height: crossing ? 7.1 : 9.0,
          spring: crossing ? 5.5 : 6.9,
          shape: crossing ? 'round' : 'pointed',
          depth: 3.0,
        };
        if (d >= 3 && !nidarosOpenings.some((p) => p.name === h.name)) nidarosOpenings.push(h);
        holes.push(h);
      }
    }
  solid(face, r, footing, upper, 'stone');
  if (d >= 2)
    shell(out, d, r, upper, t.top - 0.6, holes, 'stone', scaled(r, crossing ? 0.83 : 0.73));
  else solid(face, r, upper, t.top - 0.6, 'stone');
  cap(face, r, t.top, 'slate');
  sides(face, r, t.top - 0.6, t.top, 'trim');
  if (d) {
    band(face, r, upper - 0.4, 0.4);
    band(face, r, t.top - 1.0, 0.35);
    for (const h of holes) {
      pane(face, h, d, d === 1 ? 0.15 : -0.55);
      if (d >= 2) archBand(face, h, d, 0.32, 'trim', 0.16);
      if (d >= 3 && !crossing) {
        const f = surfaceFrame(h, d);
        for (let y = h.bottom + 0.8; y < h.bottom + h.spring; y += 1.6)
          beam(
            face,
            f.point(-h.width * 0.45, y, -0.3),
            f.point(h.width * 0.45, y, -0.3),
            0.3,
            'door',
          );
      }
    }
  }
  if (d >= 2) {
    const B = bounds(r);
    for (const x of B[0])
      for (const z of B[1]) box(face, [x, z], 0.85, 0.85, footing, t.top, 'trim');
  }
}
function copperSpire(face, d) {
  const t = rec.spire,
    r = ring(t.outline, d);
  profile(
    face,
    r,
    d
      ? [
          [t.base, 1],
          [t.base + 0.6, 1.02],
          [t.top, 0.012],
        ]
      : [
          [t.base, 1],
          [t.top, 0.012],
        ],
    'copper',
  );
}
function turrets(face, d) {
  for (const t of rec.turrets) {
    if (!d && t.top < 40) continue;
    const r = ring(t.outline, d);
    if (d) {
      solid(face, r, t.top < 40 || t.base === 0 ? footing : t.base, t.shoulder, 'stone');
      if (d >= 2) {
        band(face, r, t.shoulder - 2, 0.28);
        windows(face, r, d, t.shoulder - 4.2, 2.8, 'turret', 3.1);
      }
    }
    profile(
      face,
      r,
      [
        [d ? t.shoulder : t.base, 1.04],
        [t.top, 0.025],
      ],
      'slate',
    );
  }
}
function pinnacles(face, d) {
  for (const t of rec.pinnacles) {
    if (!d && t.top < 43) continue;
    const _p = center(t.outline),
      B = bounds(t.outline),
      _w = Math.max(B[0][1] - B[0][0], B[1][1] - B[1][0]);
    if (d) {
      solid(face, ring(t.outline, d), t.base, t.shoulder, 'stone');
      band(face, ring(t.outline, d), t.shoulder - 0.3, 0.3);
    }
    profile(
      face,
      ring(t.outline, d),
      [
        [d ? t.shoulder : t.top - 5, 1],
        [t.top, 0.02],
      ],
      'trim',
    );
  }
}
function rose(face, p, normal, base, radius, d) {
  if (!d) return;
  const axis = normal[1] ? [1, 0] : [0, 1],
    point = (x, y, depth) => [
      p[0] + axis[0] * x + normal[0] * depth,
      floor + base + y,
      p[1] + axis[1] * x + normal[1] * depth,
    ],
    n = d >= 3 ? 20 : 12,
    R = (r) =>
      Array.from({ length: n }, (_, i) =>
        point(Math.cos((i * 2 * Math.PI) / n) * r, Math.sin((i * 2 * Math.PI) / n) * r, 0.23),
      ),
    inner = R(radius),
    outer = R(radius + 0.4);
  face('glass', inner, [normal[0], 0, normal[1]]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face('trim', [outer[i], outer[j], inner[j], inner[i]], [normal[0], 0, normal[1]]);
  }
  if (d >= 2) {
    const n = d >= 3 ? 16 : 10;
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      beam(
        face,
        point(0, 0, 0.36),
        point(Math.cos(a) * radius * 0.93, Math.sin(a) * radius * 0.93, 0.36),
        0.22,
      );
    }
    if (d >= 3) {
      const a = R(radius * 0.34),
        b = R(radius * 0.4);
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length;
        face('trim', [b[i], b[j], a[j], a[i]], [normal[0], 0, normal[1]]);
      }
    }
  }
}
function westScreen(face, d) {
  const z = rec.naveZ,
    x = -49.72;
  solid(face, rect([-48.6, z], 2.15, 37.3), 0, 23, 'stone');
  // The central pointed gable rises above the sculpture screen to the nave ridge.
  face(
    'stone',
    [
      [x, floor + 23, z - 7.1],
      [x, floor + 23, z + 7.1],
      [x, floor + 35, z],
    ],
    [-1, 0, 0],
  );
  if (d) {
    for (const y of [4.3, 9.2, 14.2, 23]) box(face, [x - 0.08, z], 0.45, 37.4, y, y + 0.35, 'trim');
    rose(face, [x - 0.1, z], [-1, 0], 18.3, 4.1, d);
    for (const a of [-2.6, 0, 2.6])
      window(
        face,
        {
          name: `west-upper-gable-${a}`,
          center: [x - 0.15, z + a],
          axis: [0, 1],
          normal: [-1, 0],
          width: 1.6,
          bottom: floor + 24,
          height: a === 0 ? 7 : 5,
          spring: a === 0 ? 5.5 : 3.9,
          shape: 'pointed',
          depth: 1,
        },
        d,
        d >= 3 ? 1 : 0,
      );
    const q = {
      center: [x - 0.12, z],
      axis: [0, 1],
      normal: [-1, 0],
      width: 10.8,
      bottom: floor + 10.0,
      height: 14.2,
      spring: 8.5,
      shape: 'pointed',
      depth: 1,
    };
    archBand(face, q, d, 0.48, 'trim', 0.38);
    for (let i = -2; i <= 2; i++)
      window(
        face,
        {
          center: [x - 0.15, z + i * 1.4],
          axis: [0, 1],
          normal: [-1, 0],
          width: 1.05,
          bottom: floor + 10.2,
          height: 2.7,
          spring: 2.0,
          shape: 'pointed',
          depth: 1,
        },
        d,
      );
    if (d >= 2) {
      for (let i = 0; i < 15; i++)
        window(
          face,
          {
            name: `west-lower-arcade-${i}`,
            center: [x - 0.14, z - 16.6 + (i * 33.2) / 14],
            axis: [0, 1],
            normal: [-1, 0],
            width: 1.55,
            bottom: floor + 5.8,
            height: 3.1,
            spring: 2.35,
            shape: 'pointed',
            depth: 1,
          },
          d,
        );
      for (const row of [
        { base: 10.0, height: 3.6 },
        { base: 15.0, height: 5.8 },
      ])
        for (let i = 0; i < 16; i++) {
          const a = -17.2 + (34.4 * i) / 15;
          if (Math.abs(a) < 6) continue;
          const h = {
            center: [x - 0.14, z + a],
            axis: [0, 1],
            normal: [-1, 0],
            width: 1.55,
            bottom: floor + row.base,
            height: row.height,
            spring: row.height * 0.76,
            shape: 'pointed',
            depth: 1,
          };
          window(face, h, d);
          if (d >= 3) {
            const p = surfaceFrame(h, d),
              bodyTop = h.bottom + row.height * 0.58;
            beam(face, p.point(0, h.bottom + 0.2, 0.38), p.point(0, bodyTop, 0.38), 0.48, 'stone');
            solid(
              face,
              rect([x - 0.55, z + a], 0.48, 0.48),
              bodyTop - floor,
              bodyTop - floor + 0.65,
              'trim',
            );
          }
        }
      for (const a of [-16.0, -11.2, -6.3, 6.3, 11.2, 16.0])
        pinnacle(face, [x - 0.2, z + a], 23.2, 26.3, d, 0.6);
    }
    for (const a of [-8.7, 0, 8.7]) {
      const h = {
        name: `west-closed-portal-${a}`,
        center: [x - 0.22, z + a],
        axis: [0, 1],
        normal: [-1, 0],
        width: a === 0 ? 3.1 : 2.8,
        bottom: floor,
        height: 5.2,
        spring: 3.6,
        shape: 'pointed',
        depth: 1,
      };
      window(face, h, d, 0, true);
      if (d >= 2) {
        archBand(
          face,
          { ...h, width: h.width + 1.4, height: h.height + 1, spring: h.spring + 0.6 },
          d,
          0.4,
          'trim',
          0.15,
        );
      }
    }
    if (d >= 2) {
      beam(face, [x - 0.14, floor + 23, z - 7.1], [x - 0.14, floor + 35, z], 0.55);
      beam(face, [x - 0.14, floor + 23, z + 7.1], [x - 0.14, floor + 35, z], 0.55);
    }
  }
  const n = d ? 3 : 1;
  for (let i = 0; i < n; i++) {
    const a = -53.2 + (i * 3.4) / n,
      b = -53.2 + ((i + 1) * 3.4) / n,
      y = floor - 0.03 - (n - 1 - i) * 0.13;
    solid(
      face,
      rect([(a + b) / 2, z], b - a, 8.2),
      (p) => Math.min(y - 0.1, nidarosGround(...p) - 0.1),
      () => y,
      'foundation',
    );
  }
}
function eastOctagon(face, d) {
  const t = rec.octagon,
    r = ring(t.outline, d);
  solid(face, r, footing, t.base, 'stone');
  profile(
    face,
    r,
    [
      [t.base, 1.01],
      [t.top, 0.02],
    ],
    'copper',
  );
  if (d) {
    band(face, r, t.base - 0.4, 0.4);
    windows(face, r, d, 12.0, 8.0, 'east-octagon', 4.4);
    if (d >= 2) for (const p of r) box(face, p, 0.8, 0.8, footing, 24.5, 'trim');
  }
  const a = rec.ambulatory,
    q = ring(a.outline, d);
  solid(face, q, footing, a.base, 'stone');
  profile(
    face,
    q,
    [
      [a.base, 1],
      [a.top, 0.65],
    ],
    'slate',
  );
  if (d) windows(face, q, d, 3.2, 4.8, 'ambulatory', 4.5);
}
function transepts(face, d) {
  if (!d) return;
  for (const t of rec.roofs.filter((t) => t.name.endsWith('transept'))) {
    const B = bounds(t.outline),
      north = t.name.startsWith('north'),
      z = north ? B[1][0] - 0.2 : B[1][1] + 0.2,
      x = (B[0][0] + B[0][1]) / 2,
      normal = [0, north ? -1 : 1];
    rose(face, [x, z], normal, 21.5, 2.0, d);
    for (let i = -1; i <= 1; i++)
      window(
        face,
        {
          center: [x + i * 3.0, z],
          axis: [1, 0],
          normal,
          width: 1.8,
          bottom: floor + 8,
          height: 7.2,
          spring: 5.7,
          shape: 'round',
          depth: 1,
        },
        d,
        d >= 3 ? 1 : 0,
      );
  }
}
function buttresses(face, d) {
  if (!d) return;
  for (const x of [-38.4, -33.2, -28, -22.8, -17.5, -12.2])
    for (const side of [-1, 1]) {
      const outer = rec.naveZ + side * 12.4,
        inner = rec.naveZ + side * 6.4;
      box(face, [x, outer], 1.0, 1.35, footing, 12, 'trim');
      box(face, [x, outer - side * 0.5], 0.85, 1.35, 12, 18, 'trim');
      if (d >= 2) {
        const A = [x, floor + 17.7, outer - side * 0.5],
          B = [x, floor + 22.5, inner],
          n = d >= 3 ? 4 : 2;
        const p = (t) => [
          x,
          A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * 0.9,
          A[2] + (B[2] - A[2]) * t,
        ];
        for (let i = 0; i < n; i++) beam(face, p(i / n), p((i + 1) / n), 0.65, 'trim');
        box(face, [x, inner], 0.6, 0.7, 17, 24.7, 'trim');
      }
    }
}
function build(raw, d) {
  const out = {
      addTriangle(slot, ref, p, _n, uv, col) {
        p = p.map((v) => v.map(Math.fround));
        if (
          Math.hypot(
            ...cross(
              p[1].map((v, k) => v - p[0][k]),
              p[2].map((v, k) => v - p[0][k]),
            ),
          ) > 1e-7
        )
          raw.addTriangle(slot, ref, p, normalFor(...p), uv, col);
      },
    },
    face = writer(out, d);
  for (const p of rec.main.polygons) {
    const r = ring(p.outline, d);
    sides(face, r, footing, 0, 'foundation');
    if (d) solid(face, r, 0, 2.6, 'stone');
    else cap(face, r, 0, 'foundation');
  }
  for (const t of rec.roofs) {
    const r = ring(t.outline, d);
    solid(face, r, footing, t.base, 'stone');
    roof(face, r, t.short, t.base, t.top, 'copper', [], t.roofSections);
    if (d) {
      band(face, r, t.base - 0.25, 0.25);
      const high = t.name === 'nave' || t.name === 'choir';
      windows(
        face,
        r,
        d,
        high ? 16.2 : t.base > 15 ? 7.5 : 3.2,
        high ? 5.8 : t.base > 15 ? 7 : 4.5,
        t.name,
        4.7,
      );
    }
  }
  for (const p of d <= 1 ? [] : rec.flatRoofs) {
    const r = ring(p.outline, d);
    solid(face, r, 0, 3.6, 'stone');
    cap(face, r, 3.6, 'slate', p.holes);
  }
  eastOctagon(face, d);
  for (const t of rec.towers) tower(out, t, d);
  copperSpire(face, d);
  turrets(face, d);
  pinnacles(face, d);
  westScreen(face, d);
  transepts(face, d);
  buttresses(face, d);
}
export const buildNidarosSkyline = (o) => build(o, 0);
export const buildNidarosDistrict = (o) => build(o, 1);
export const buildNidarosStreet = (o) => build(o, 2);
export const buildNidarosCloseup = (o) => build(o, 3);
export const nidarosStudy = {
  id: 'N0336',
  key: 'nidaros_cathedral',
  title: 'Nidaros Cathedral',
  category: 'cathedral',
  wikidataId: 'Q215023',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Nidaros exterior: broad twin-tower west sculpture screen/rose/three closed portals, high green crossing spire/four conical turrets, green pitched nave/choir, lower aisles and flying buttresses, transepts and eastern octagon/ambulatory.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID outline and157 unioned current PMTiles main/part controls; major roofs, towers, pinnacles, octagon and repeated buttress rhythm interpreted from the useful pictures.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Full mapped approximately101x51m cathedral envelope and nominal height controls retained, including82m central spire. Intermediate architectural profiles and exact ground levels remain picture-led estimates.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256-square limestone/raw-stone/standing-seam/slate/wood graphs, metric UVs and linear tints; flat blue-gray glass. No embedded images or photograph textures.',
  importReason:
    'Four authored levels retain the broad western screen, dominant central copper spire and octagonal east end at the signed mapped cathedral site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Statue reliefs and niche/tracery rows are selected faceted approximations, not identified individual figures or exact sculpture. Spire finial/weathercock, full interiors, graves/trees and surrounding Archbishop’s Palace excluded. Closed doors and selected belfry reveals do not certify walking surfaces. Physical laptop/phone timing pending.',
    'Skyline retains central spire, twin western masses/outer pinnacles and eastern octagon with closed stages and mean surface tint. District restores shared textures, broad windows and turrets; street restores actual belfry cuts, flying arches, west niche/rose rhythm and trim; closeup refines arch/rose facets, selected reliefs, louvers and mullions. Detail changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'west-screen-rose-and-three-portals',
      position: [-116, 26, 1],
      lookAt: [-48, 19, 1],
      fov: 43,
    },
    {
      name: 'west-square-towers-and-pinnacles',
      position: [-91, 51, -44],
      lookAt: [-46, 30, 0],
      fov: 43,
    },
    {
      name: 'crossing-copper-spire-and-turrets',
      position: [-32, 64, -62],
      lookAt: [0, 49, 1],
      fov: 43,
    },
    {
      name: 'north-transept-and-rounded-chapel',
      position: [28, 34, -72],
      lookAt: [13, 15, -11],
      fov: 43,
    },
    {
      name: 'eastern-octagon-and-ambulatory',
      position: [93, 39, 40],
      lookAt: [37, 18, 1],
      fov: 43,
    },
    {
      name: 'south-nave-and-flying-buttresses',
      position: [-19, 37, 67],
      lookAt: [-22, 17, 10],
      fov: 43,
    },
  ],
};

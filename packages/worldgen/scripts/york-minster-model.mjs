/** York Minster: mapped brick basilica, arcaded western shaft and copper clock/bulb tower. */
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
  '../../../content/worldgen/source/places/gc/gcx/york_minster/',
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
  stone: '#d6c79f',
  trim: '#e3d5b4',
  roof: '#a6a8a7',
  foundation: '#b5ad98',
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
const footing = (p) => Math.min(floor - 0.3, yorkGround(...p) - 0.35);
export function yorkGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('York Minster footing outside retained terrain');
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
const ring = (r, d) => simplify(r, d === 0 ? 0.65 : 0.05);
const bounds = (r) =>
  [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
export const yorkOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !yorkOpenings.some((q) => q.name === h.name)) yorkOpenings.push(h);
  return h;
};
function surfaceFrame(h, d) {
  const p = prepareOpening(h, 0, d);
  const sign = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  return { ...p, point: (x, y, depth) => p.point(x, y, depth * sign) };
}
function window(face, h, d, { bars = 0, closed = false } = {}) {
  pane(face, h, d, 0.14, closed ? 'door' : 'glass');
  if (d >= 2) {
    archBand(face, h, d, 0.32, 'trim', 0.21);
    const p = surfaceFrame(h, d);
    for (let i = 1; i <= bars; i++) {
      const x = -h.width / 2 + (h.width * i) / (bars + 1);
      beam(
        face,
        p.point(x, h.bottom, 0.26),
        p.point(x, h.bottom + h.spring, 0.26),
        d >= 3 ? 0.23 : 0.3,
        'trim',
      );
    }
  }
}
function windows(face, r, d, bottom, height, name, spacing = 6) {
  if (!d) return;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 4) continue;
    const n = Math.max(1, Math.floor(f.length / (spacing * (d === 1 ? 1.7 : 1))));
    for (let j = 0; j < n; j++) {
      const p = lerp(f.a, f.b, (j + 0.5) / n);
      if (
        !name.includes('west-') &&
        (p[0] < -65 || (Math.abs(p[0] + 3) < 12 && Math.abs(p[1] - rec.naveZ) < 12))
      )
        continue;
      window(
        face,
        {
          name: `${name}-${i}-${j}`,
          center: p,
          axis: f.axis,
          normal: f.normal,
          width: Math.min(3.9, (f.length / n) * 0.6),
          bottom: floor + bottom,
          height,
          spring: height * 0.65,
          shape: 'pointed',
          depth: 1,
        },
        d,
        { bars: d >= 3 ? 1 : 0 },
      );
    }
  }
}
function pinnacle(face, p, b, t, d, width = 1.2) {
  if (!d) {
    profile(
      face,
      rect(p, width * 1.15, width * 1.15),
      [
        [b, 1],
        [t, 0.025],
      ],
      'trim',
    );
    return;
  }
  box(face, p, width, width, b, b + (t - b) * 0.4, 'trim');
  profile(
    face,
    rect(p, width * 1.15, width * 1.15),
    [
      [b + (t - b) * 0.4, 1],
      [t, 0.025],
    ],
    'trim',
  );
  if (d >= 3) band(face, rect(p, width, width), b + (t - b) * 0.37, 0.25, 'trim', 1.35);
}
function tower(out, t, d) {
  const r = ring(t.outline, d),
    face = writer(out, d),
    crossing = t.name === 'crossing',
    _b = crossing ? 30 : 0,
    upper = crossing ? 34 : 34,
    holes = [];
  if (d >= 1) {
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < (crossing ? 12 : 7)) continue;
      const count = 2;
      for (let j = 0; j < count; j++) {
        const p = lerp(f.a, f.b, (j + 0.5) / count),
          h = remember(
            {
              name: `${t.name}-belfry-${i}-${j}`,
              center: p,
              axis: f.axis,
              normal: f.normal,
              width: crossing ? 4.6 : 2.9,
              bottom: floor + 36,
              height: 14,
              spring: 11.2,
              shape: 'pointed',
              depth: 3.8,
            },
            d,
          );
        holes.push(h);
      }
    }
  }
  solid(face, r, footing, upper, 'stone');
  if (d >= 2)
    shell(out, d, r, upper, t.top - 0.9, holes, 'stone', scaled(r, crossing ? 0.86 : 0.78));
  else solid(face, r, upper, t.top - 0.9, 'stone');
  cap(face, scaled(r, 0.97), t.top - 1, 'roof');
  sides(face, r, t.top - 0.9, t.top, 'trim');
  if (d) {
    band(face, r, 17, 0.4);
    band(face, r, 33, 0.45);
    band(face, r, t.top - 1.4, 0.45);
  }
  for (const h of holes) {
    pane(face, h, d, d === 1 ? 0.15 : -0.65);
    archBand(face, h, d, 0.43, 'trim', 0.16);
    if (d >= 3) {
      const p = surfaceFrame(h, d);
      for (let y = h.bottom + 0.65; y < h.bottom + h.spring; y += 1.4)
        beam(
          face,
          p.point(-h.width * 0.46, y, -0.36),
          p.point(h.width * 0.46, y, -0.36),
          0.3,
          'door',
        );
    }
  }
  if (!crossing) {
    const B = bounds(r);
    for (const x of B[0])
      for (const z of B[1]) {
        const p = [x, z];
        if (d) {
          box(face, p, 1.55, 1.55, footing, 33, 'trim');
          box(face, p, 1.25, 1.25, 33, 54, 'trim');
        }
        pinnacle(face, p, 54, t.pinnacle, d, d ? 1.45 : 1.8);
      }
    if (d >= 2) {
      for (const x of B[0]) pinnacle(face, [x, t.center[1]], 54, 59, d, 1.0);
      for (const z of B[1]) pinnacle(face, [t.center[0], z], 54, 59, d, 1.0);
    }
    if (d) {
      windows(face, r, d, 7, 9, `${t.name}-lower`, 11);
      windows(face, r, d, 22, 9, `${t.name}-middle`, 11);
    }
  } else if (d) {
    const B = bounds(r);
    for (const x of B[0]) for (const z of B[1]) box(face, [x, z], 1.7, 1.7, 31, 54, 'trim');
  }
}
function facade(face, d) {
  const z = rec.naveZ,
    x = -78.38,
    h = {
      name: 'great-west-window',
      center: [x - 0.15, z],
      axis: [0, -1],
      normal: [-1, 0],
      width: 11.6,
      bottom: floor + 13.1,
      height: 16.4,
      spring: 10.8,
      shape: 'pointed',
      depth: 2,
    };
  if (d) {
    window(face, h, d, { bars: d >= 2 ? 5 : 0 });
    if (d >= 2) archBand(face, h, d, 0.72, 'trim', 0.38);
  }
  const door = {
    name: 'west-main-closed-door',
    center: [x - 0.2, z],
    axis: [0, -1],
    normal: [-1, 0],
    width: 6.1,
    bottom: floor,
    height: 8.2,
    spring: 5.2,
    shape: 'pointed',
    depth: 2,
  };
  window(face, door, d, { closed: true });
  if (d >= 2) {
    const p = surfaceFrame(door, d);
    beam(face, p.point(0, door.bottom, 0.32), p.point(0, door.bottom + 5.2, 0.32), 0.32);
  }
  for (const t of rec.towers.filter((t) => t.name !== 'crossing'))
    window(
      face,
      {
        ...door,
        name: `${t.name}-closed-portal`,
        center: [x - 0.24, t.center[1]],
        width: 3.6,
        height: 6.2,
        spring: 4.4,
      },
      d,
      { closed: true },
    );
  if (d) {
    const _gable = prepareOpening(h, 0, d),
      side = rec.roofs[0].base,
      top = rec.roofs[0].top;
    for (const a of [-1, 1])
      beam(face, [x - 0.28, floor + side, z + a * 9.0], [x - 0.28, floor + top, z], 0.55);
    if (d >= 3)
      for (let i = 0; i < 5; i++)
        pinnacle(face, [x - 0.25, z + (i - 2) * 3.0], 30.5, 33.2, d, 0.48);
  }
  const n = d ? 4 : 1;
  for (let i = 0; i < n; i++) {
    const a = -82.1 + (i * 3.45) / n,
      b = -82.1 + ((i + 1) * 3.45) / n,
      top = floor - 0.03 - (n - 1 - i) * 0.12;
    solid(
      face,
      rect([(a + b) / 2, z], b - a, 8.7),
      (p) => Math.min(top - 0.12, yorkGround(...p) - 0.1),
      () => top,
      'foundation',
    );
  }
}
function rose(face, p, normal, d) {
  if (!d) return;
  const axis = normal[1] ? [1, 0] : [0, 1];
  const point = (x, y, depth) => [
    p[0] + axis[0] * x + normal[0] * depth,
    floor + 28.55 + y,
    p[1] + axis[1] * x + normal[1] * depth,
  ];
  const n = d >= 3 ? 16 : 12;
  const ring = (radius) =>
    Array.from({ length: n }, (_, i) =>
      point(
        Math.cos((i * 2 * Math.PI) / n) * radius,
        Math.sin((i * 2 * Math.PI) / n) * radius,
        0.24,
      ),
    );
  const inner = ring(2.35),
    outer = ring(2.75);
  face('glass', inner, [normal[0], 0, normal[1]]);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    face('trim', [outer[i], outer[j], inner[j], inner[i]], [normal[0], 0, normal[1]]);
  }
  if (d >= 2)
    for (let i = 0; i < (d >= 3 ? 12 : 8); i++) {
      const a = (i * 2 * Math.PI) / (d >= 3 ? 12 : 8);
      beam(face, point(0, 0, 0.36), point(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0.36), 0.24);
    }
}
function transeptFaces(face, d) {
  if (!d) return;
  const t = rec.roofs.find((t) => t.name === 'transept'),
    B = bounds(t.outline),
    x = (B[0][0] + B[0][1]) / 2;
  for (const sign of [-1, 1]) {
    const z = sign < 0 ? B[1][0] - 0.2 : B[1][1] + 0.2,
      normal = [0, sign];
    rose(face, [x, z], normal, d);
    for (let i = -1; i <= 1; i++)
      window(
        face,
        {
          name: `transept-${sign}-${i}`,
          center: [x + i * 4.4, z],
          axis: [1, 0],
          normal,
          width: 3.2,
          bottom: floor + 9,
          height: 13.7,
          spring: 11.0,
          shape: 'pointed',
          depth: 1,
        },
        d,
        { bars: d >= 3 ? 1 : 0 },
      );
    window(
      face,
      {
        name: `transept-${sign}-door`,
        center: [x, z + 0.1 * sign],
        axis: [1, 0],
        normal,
        width: 2.8,
        bottom: floor,
        height: 6.5,
        spring: 4.4,
        shape: 'pointed',
        depth: 1,
      },
      d,
      { closed: true },
    );
  }
}
function buttresses(face, d) {
  if (!d) return;
  const z = rec.naveZ;
  for (const x of [-62, -53, -44, -35, -26, 18, 27, 51, 60, 69])
    for (const side of [-1, 1]) {
      const outer = z + side * 19.0,
        inner = z + side * 9.0;
      box(face, [x, outer], 1.25, 2.1, footing, 15.8, 'trim');
      box(face, [x, outer - side * 0.3], 0.95, 1.55, 15.8, 21.8, 'trim');
      if (d >= 2) {
        pinnacle(face, [x, outer], 21.8, 26.0, d, 0.8);
        const A = [x, floor + 20.7, outer - side * 0.1],
          B = [x, floor + 28.1, inner];
        const n = d >= 3 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const point = (t) => [
            A[0],
            A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * 1.15,
            A[2] + (B[2] - A[2]) * t,
          ];
          beam(face, point(i / n), point((i + 1) / n), 0.65);
        }
        box(face, [x, inner], 0.65, 0.9, 22, 30.5, 'trim');
        pinnacle(face, [x, inner], 30.5, 33.8, d, 0.65);
      }
    }
}
function chapterHouse(face, d) {
  const t = rec.chapter,
    r = ring(t.outline, d);
  solid(face, r, footing, t.base, 'stone');
  profile(
    face,
    r,
    [
      [t.base, 1.02],
      [t.top, 0.02],
    ],
    'roof',
  );
  if (d) {
    band(face, r, t.base - 0.5, 0.45);
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.length < 3.5) continue;
      const p = lerp(f.a, f.b, 0.5);
      window(
        face,
        {
          name: `chapter-window-${i}`,
          center: p,
          axis: f.axis,
          normal: f.normal,
          width: f.length * 0.62,
          bottom: floor + 4.0,
          height: 10.5,
          spring: 7.4,
          shape: 'pointed',
          depth: 1,
        },
        d,
        { bars: d >= 3 ? 2 : 0 },
      );
      if (d >= 2) {
        box(face, r[i], 0.95, 0.95, footing, 17.8, 'trim');
        pinnacle(face, r[i], 17.8, 20.9, d, 0.72);
      }
    }
  }
}
function eastWindow(face, d) {
  if (!d) return;
  const r = rec.roofs[0].outline,
    x = bounds(r)[0][1] + 0.23;
  const h = {
    name: 'great-east-window',
    center: [x, rec.naveZ],
    axis: [0, 1],
    normal: [1, 0],
    width: 13.2,
    bottom: floor + 4.2,
    height: 24.6,
    spring: 19.0,
    shape: 'pointed',
    depth: 1,
  };
  window(face, h, d, { bars: d >= 2 ? 6 : 0 });
  if (d >= 2) {
    const p = surfaceFrame(h, d);
    for (const y of [12, 19])
      beam(
        face,
        p.point(-h.width * 0.49, floor + y, 0.31),
        p.point(h.width * 0.49, floor + y, 0.31),
        0.3,
      );
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
    solid(face, r, footing, 0, 'foundation');
    solid(face, r, 0, 3.4, 'stone');
  }
  for (const t of rec.roofs) {
    const r = ring(t.outline, d);
    solid(face, r, footing, t.base, 'stone');
    roof(face, r, t.short, t.base, t.top, 'roof', [], t.roofSections);
    if (d) {
      band(face, r, t.base - 0.3, 0.32);
      windows(
        face,
        r,
        d,
        t.name === 'nave-choir' ? 20.4 : t.base > 15 ? 5 : 1.6,
        t.name === 'nave-choir' ? 6.8 : t.base > 15 ? 9 : 4.0,
        t.name,
        6,
      );
    }
  }
  for (const p of rec.flatRoofs) {
    const r = ring(p.outline, d);
    solid(face, r, 0, 7.5, 'stone');
    cap(face, r, 7.5, 'roof', p.holes);
  }
  chapterHouse(face, d);
  for (const t of rec.towers) tower(out, t, d);
  facade(face, d);
  transeptFaces(face, d);
  eastWindow(face, d);
  buttresses(face, d);
}
export const buildYorkSkyline = (o) => build(o, 0);
export const buildYorkDistrict = (o) => build(o, 1);
export const buildYorkStreet = (o) => build(o, 2);
export const buildYorkCloseup = (o) => build(o, 3);
export const yorkStudy = {
  id: 'york_minster',
  key: 'york_minster',
  title: 'York Minster',
  category: 'cathedral',
  wikidataId: 'Q252575',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual York Minster exterior: pinnacled twin western towers, great west window/three closed portals, broad flat crossing tower, long lead-gray nave/choir, stepped aisles/flying buttresses, gabled transepts/rose and northeast octagonal chapter house with its steep pyramid roof.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID footprint and23 unioned current PMTiles main/part controls, rigidly reframed along the mapped nave edge.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Full mapped site including chapter house and annexes retained. Published160x76m facts describe the core and do not rescale this larger site envelope. Nominal heights retained; eaves/detail profiles estimated.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing shared256-square limestone/raw-stone/standing-seam/wood graphs, metric UVs and linear tints; flat vertex-colored glass and no embedded images.',
  importReason:
    'Four authored levels retain signed west twin towers/crossing/northeast chapter-house silhouette at the mapped cathedral site.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Exact sculpted figures, rose/heart tracery, inscriptions, gargoyles, complete interiors and temporary east scaffolding excluded. Closed panels/doors and selected tower reveals are exterior approximations; no certified walking surfaces. Physical laptop/phone timing pending.',
    'Skyline retains three towers, west corner pinnacles and chapter-house pyramid with closed stages and mean-tinted surfaces. District restores shared textures and broad windows/buttresses; street restores selected belfry cuts, flying arches and west/transept window rhythms; closeup refines curves, louvers, mullions and trim. Detail changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'west-twin-towers-and-great-window',
      position: [-165, 39, 4],
      lookAt: [-74, 31, 5],
      fov: 43,
    },
    {
      name: 'west-belfries-and-pinnacles',
      position: [-111, 75, 51],
      lookAt: [-71, 47, 6],
      fov: 43,
    },
    {
      name: 'south-nave-and-flying-buttresses',
      position: [-35, 46, 76],
      lookAt: [-30, 20, 10],
      fov: 43,
    },
    { name: 'crossing-and-south-transept', position: [8, 61, 96], lookAt: [-2, 31, 18], fov: 43 },
    {
      name: 'chapter-house-and-north-passage',
      position: [54, 41, -94],
      lookAt: [28, 14, -32],
      fov: 43,
    },
    { name: 'east-choir-and-lower-annexes', position: [121, 41, 63], lookAt: [47, 18, 9], fov: 43 },
  ],
};

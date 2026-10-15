/** Saint Sophia / Selimiye, Nicosia: asymmetric Gothic porch, low vault and twin minarets. */
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
  '../../../content/worldgen/source/places/sw/swr/n0337_saint_sophia_cathedral/',
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
  stone: '#dbc79f',
  trim: '#eadbbb',
  roofstone: '#d0bd98',
  lead: '#99a6a7',
  foundation: '#b8ad94',
  glass: '#4d6178',
  door: '#705139',
  screen: '#f0eadc',
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
const footing = (p) => Math.min(floor - 0.3, sophiaGround(...p) - 0.35);
export function sophiaGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Saint Sophia Cathedral footing outside retained terrain');
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
function _roof(face, r, short, base, top, slot = 'roof', masks = [], sections = null) {
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
const ring = (r, d) => simplify(r, d <= 1 ? 0.38 : 0.035);
export const sophiaPortals = [];
const frontAxis = unit(rec.front.b.map((v, k) => v - rec.front.a[k])),
  frontNormal = [-frontAxis[1], frontAxis[0]];
export const sophiaFront = (z) => [
  rec.front.a[0] +
    ((rec.front.b[0] - rec.front.a[0]) * (z - rec.front.a[1])) / (rec.front.b[1] - rec.front.a[1]),
  z,
];
function surfaceFrame(h, d) {
  const p = prepareOpening(h, 0, d),
    s = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  return { ...p, point: (x, y, z) => p.point(x, y, z * s) };
}
function window(face, h, d, bars = 0, closed = false) {
  pane(face, h, d, 0.15, closed ? 'door' : 'glass');
  if (d >= 2) {
    archBand(face, h, d, 0.32, 'trim', 0.23);
    const p = surfaceFrame(h, d);
    for (let i = 1; i <= bars; i++) {
      const x = -h.width / 2 + (h.width * i) / (bars + 1);
      beam(face, p.point(x, h.bottom, 0.31), p.point(x, h.bottom + h.spring, 0.31), 0.24, 'trim');
    }
  }
}
function entry(d) {
  return [-7.7, 0.4, 6.9].map((z, i) => {
    const p = sophiaFront(z),
      h = {
        name: `west-porch-${i}`,
        center: p.map((v, k) => v - frontNormal[k] * 2.6),
        axis: frontAxis,
        normal: frontNormal,
        width: i === 1 ? 5.4 : i === 2 ? 3.9 : 4.2,
        bottom: floor + 0.03,
        height: i === 1 ? 8.7 : 6.9,
        spring: i === 1 ? 6.2 : 4.9,
        shape: 'pointed',
        depth: 7.6,
      };
    if (d >= 3 && !sophiaPortals.some((p) => p.name === h.name))
      sophiaPortals.push({ ...h, front: p });
    return h;
  });
}
function minaret(face, m, d) {
  const n = d === 0 ? 8 : d === 1 ? 10 : d === 2 ? 14 : d === 3 ? 18 : 22,
    r = regular(m.center, m.radius, n, Math.PI / 8);
  if (m.lowerRadius) {
    const lo = regular(m.center, m.lowerRadius, n, Math.PI / 8);
    solid(face, lo, footing, m.base, 'stone');
    if (d) {
      band(face, lo, 8, 0.3);
      band(face, lo, 14.4, 0.28);
    }
  }
  profile(
    face,
    r,
    d === 0
      ? [
          [m.base, 1.65],
          [m.base + 3, 1],
          [m.shoulder, 1],
        ]
      : [
          [m.base, 1.65],
          [m.base + 1, 1.65],
          [m.base + 4.0, 1],
          [m.shoulder, 1],
        ],
    'stone',
  );
  profile(
    face,
    r,
    [
      [m.shoulder, 1],
      [m.balcony, 1.65],
      [m.balcony + 0.45, 1.65],
    ],
    'trim',
  );
  solid(face, scaled(r, 0.78), m.balcony + 0.45, m.eave, 'stone');
  profile(
    face,
    scaled(r, 0.88),
    [
      [m.eave, 1.05],
      [m.top, 0.025],
    ],
    'lead',
  );
  if (d) {
    const count = d === 1 ? 5 : d === 2 ? 8 : 12;
    for (let i = 0; i < count; i++) {
      const a = (i * Math.PI * 2) / count,
        p = [
          m.center[0] + m.radius * 1.52 * Math.cos(a),
          m.center[1] + m.radius * 1.52 * Math.sin(a),
        ];
      box(
        face,
        p,
        d === 1 ? 0.28 : 0.2,
        d === 1 ? 0.28 : 0.2,
        m.balcony + 0.5,
        m.balcony + 1.7,
        'trim',
      );
    }
    profile(
      face,
      r,
      [
        [m.balcony + 1.7, 1.63],
        [m.balcony + 1.94, 1.63],
      ],
      'trim',
    );
    if (d >= 2) {
      const a = regular(m.center, m.radius * 0.86, n);
      band(face, a, m.eave - 0.4, 0.4, 'trim');
      for (const i of [0, Math.floor(n / 2)]) {
        const p = r[i],
          normal = unit(p.map((v, k) => v - m.center[k]));
        window(
          face,
          {
            center: p,
            axis: [normal[1], -normal[0]],
            normal,
            width: 0.6,
            bottom: floor + m.base + 7,
            height: 1.7,
            spring: 1.25,
            shape: 'pointed',
            depth: 1,
          },
          d,
        );
      }
    }
  }
}
function facade(_out, face, d, portals) {
  const Z = rec.front.centerZ,
    P = sophiaFront(Z),
    h = {
      center: P,
      axis: frontAxis,
      normal: frontNormal,
      width: 10.4,
      bottom: floor + 9.4,
      height: 8.3,
      spring: 4.8,
      shape: 'pointed',
      depth: 1,
    };
  if (d) {
    pane(face, h, d, 0.26, 'screen');
    archBand(face, h, d, 0.5, 'trim', 0.4);
    if (d >= 2) {
      const f = surfaceFrame(h, d),
        disc = (x, y, r, slot) => {
          const n = d >= 3 ? 12 : 6,
            points = Array.from({ length: n }, (_, i) =>
              f.point(
                x + r * Math.cos((i * Math.PI * 2) / n),
                y + r * Math.sin((i * Math.PI * 2) / n),
                0.34,
              ),
            );
          face(slot, points, [frontNormal[0], 0, frontNormal[1]]);
        };
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 1.25,
          q = {
            ...h,
            center: P.map((v, k) => v + frontAxis[k] * x),
            width: 0.85,
            bottom: floor + 9.6,
            height: 2.15,
            spring: 1.5,
          };
        pane(face, q, d, 0.35);
        archBand(face, q, d, 0.13, 'screen', 0.4);
      }
      for (const [y, xs] of [
        [12.9, [-3.7, -1.85, 0, 1.85, 3.7]],
        [14.65, [-2.3, 0, 2.3]],
        [16.2, [0]],
      ])
        for (const x of xs) {
          disc(x, floor + y, 0.57, 'glass');
          if (d >= 3)
            for (let i = 0; i < 6; i++) {
              const a = (i * Math.PI) / 3;
              beam(
                face,
                f.point(x, floor + y, 0.4),
                f.point(x + Math.cos(a) * 0.53, floor + y + Math.sin(a) * 0.53, 0.4),
                0.12,
                'screen',
              );
            }
        }
    }
    const north = {
      center: sophiaFront(-10.0),
      axis: frontAxis,
      normal: frontNormal,
      width: 4.5,
      bottom: floor + 11.4,
      height: 10.6,
      spring: 7.4,
      shape: 'pointed',
      depth: 1,
    };
    window(face, north, d, d >= 2 ? 1 : 0);
    if (d >= 2) archBand(face, north, d, 0.6, 'trim', 0.37);
  }
  for (const [i, hole] of portals.entries()) {
    const p = sophiaFront([-7.7, 0.4, 6.9][i]),
      hood = { ...hole, center: p, bottom: floor, height: hole.height + 0.4, spring: hole.spring };
    if (d) {
      archBand(face, hood, d, 0.5, 'trim', 0.25);
      if (d >= 2)
        archBand(
          face,
          {
            ...hood,
            width: hood.width + 1.5,
            height: hood.height + 1.1,
            spring: hood.spring + 0.7,
          },
          d,
          0.32,
          'trim',
          0.19,
        );
      const f = surfaceFrame(hood, d),
        a = f.point(-hood.width * 0.66, floor + hood.spring + 0.15, 0.3),
        b = f.point(0, floor + hood.height + 2.4, 0.3),
        c = f.point(hood.width * 0.66, floor + hood.spring + 0.15, 0.3);
      beam(face, a, b, 0.45);
      beam(face, b, c, 0.45);
    }
    const doorCenter = p.map((v, k) => v - frontNormal[k] * rec.front.doorRecess);
    pane(
      face,
      { ...hood, center: doorCenter, width: hole.width - 0.15, height: hole.height - 0.1 },
      d,
      0.03,
      'door',
    );
  }
  if (d) {
    band(face, ring(rec.tower.outline, d), 25.4, 0.5, 'trim');
    for (const r of rec.porch) band(face, ring(r.outline, d), 18.1, 0.35, 'trim');
  }
}
function vaultedRoof(face, p, d) {
  const r = ring(p.outline, d),
    n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : d === 3 ? 12 : 16,
    lo = -6,
    hi = 6.5,
    mid = (lo + hi) / 2,
    h = (z) =>
      rec.heights.nave +
      (rec.heights.vaultTop - rec.heights.nave) *
        Math.sqrt(Math.max(0, 1 - Math.pow((z - mid) / ((hi - lo) / 2), 2)));
  const clip = (r, z, greater) => {
    const q = [];
    let a = r.at(-1),
      v = (a[1] - z) * (greater ? 1 : -1);
    for (const b of r) {
      const w = (b[1] - z) * (greater ? 1 : -1);
      if (v >= 0 !== w >= 0) q.push(lerp(a, b, v / (v - w)));
      if (w >= 0) q.push(b);
      a = b;
      v = w;
    }
    return q;
  };
  const Y = (p) => {
    const u = Math.max(0, Math.min(n - 1.000001, ((p[1] - lo) / (hi - lo)) * n)),
      i = Math.floor(u),
      t = u - i,
      a = lo + ((hi - lo) * i) / n,
      b = lo + ((hi - lo) * (i + 1)) / n;
    return floor + h(a) * (1 - t) + h(b) * t;
  };
  for (let i = 0; i < n; i++) {
    const a = lo + ((hi - lo) * i) / n,
      b = lo + ((hi - lo) * (i + 1)) / n,
      part = clip(clip(r, a, true), b, false);
    if (part.length > 2) cap(face, part, Y, 'lead');
  }
  const outline = r.flatMap((a, i) => {
    const b = r[(i + 1) % r.length],
      ts = [0];
    for (let k = 1; k < n; k++) {
      const z = lo + ((hi - lo) * k) / n,
        t = (z - a[1]) / (b[1] - a[1]);
      if (t > 1e-7 && t < 1 - 1e-7) ts.push(t);
    }
    return ts.sort((a, b) => a - b).map((t) => lerp(a, b, t));
  });
  sides(face, outline, rec.heights.nave, Y, 'roofstone');
}
function windows(face, r, d, bottom, height, name, spacing = 5.6) {
  if (!d) return;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 3) continue;
    const n = Math.max(1, Math.floor(f.length / (spacing * (d === 1 ? 1.6 : 1))));
    for (let j = 0; j < n; j++) {
      const p = lerp(f.a, f.b, (j + 0.5) / n);
      if (name === 'nave' && p[0] < -22) continue;
      window(
        face,
        {
          name: `${name}-${i}-${j}`,
          center: p,
          axis: f.axis,
          normal: f.normal,
          width: Math.min(3.2, (f.length / n) * 0.65),
          bottom: floor + bottom,
          height,
          spring: height * 0.66,
          shape: 'pointed',
          depth: 1,
        },
        d,
        d >= 3 ? 1 : 0,
      );
    }
  }
}
function buttresses(face, d) {
  if (!d) return;
  for (const x of [-18, -10, -2, 6, 14, 22])
    for (const side of [-1, 1]) {
      const outer = rec.naveZ + side * 11.7,
        inner = rec.naveZ + side * 6.25;
      box(face, [x, outer], 1.3, 2.5, footing, 14.5, 'stone');
      if (d >= 2) {
        const A = [x, floor + 14.0, outer - side * 0.5],
          B = [x, floor + 22.2, inner],
          n = d >= 3 ? 5 : 3,
          p = (t) => [
            x,
            A[1] + (B[1] - A[1]) * t + Math.sin(t * Math.PI) * 1.2,
            A[2] + (B[2] - A[2]) * t,
          ];
        for (let i = 0; i < n; i++) beam(face, p(i / n), p((i + 1) / n), 0.75, 'trim');
        box(face, [x, inner], 0.65, 0.8, 14, 24.4, 'trim');
        const z = rec.naveZ + side * 6.28;
        face(
          'stone',
          [
            [x - 2.4, floor + 23, z],
            [x + 2.4, floor + 23, z],
            [x, floor + 25.6, z],
          ],
          [0, 0, side],
        );
        beam(face, [x - 2.4, floor + 23, z], [x, floor + 25.6, z], 0.38);
        beam(face, [x + 2.4, floor + 23, z], [x, floor + 25.6, z], 0.38);
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
    face = writer(out, d),
    portals = entry(d);
  for (const p of rec.main.polygons) {
    const r = ring(p.outline, d);
    solid(face, r, footing, 0, 'foundation');
    shell(out, d, r, 0, 2.6, d ? portals : [], 'stone');
    cap(
      writer(
        d
          ? openingBuilder(
              out,
              portals.map((h) => prepareOpening(h, 0, d)),
            )
          : out,
        d,
      ),
      r,
      2.6,
      'stone',
      p.holes,
    );
  }
  for (const p of rec.body) {
    const r = ring(p.outline, d);
    solid(face, r, 0, rec.heights.aisle, 'stone');
    if (d) windows(face, r, d, 3.2, 6.1, 'aisle');
  }
  for (const p of rec.lowRoofs) cap(face, ring(p.outline, d), rec.heights.aisle, 'lead', p.holes);
  for (const p of rec.nave) {
    const r = ring(p.outline, d);
    solid(face, r, 0, rec.heights.nave, 'stone');
    vaultedRoof(face, p, d);
    if (d) {
      windows(face, r, d, 15.0, 6.3, 'nave');
      band(face, r, 22.6, 0.4);
    }
  }
  for (const p of rec.northAnnex) {
    const r = ring(p.outline, d);
    solid(face, r, 0, rec.heights.northAnnex, 'stone');
    cap(face, r, rec.heights.northAnnex, 'lead', p.holes);
    if (d) windows(face, r, d, 2.2, 4.3, 'north-annex');
  }
  for (const p of rec.southAnnex) {
    const r = ring(p.outline, d);
    solid(face, r, 0, rec.heights.southAnnex, 'stone');
    profile(
      face,
      r,
      [
        [rec.heights.southAnnex, 1],
        [rec.heights.southDome, 0.15],
      ],
      'roofstone',
    );
    if (d) windows(face, r, d, 2.2, 4.3, 'south-annex');
  }
  for (const p of rec.porch) {
    const r = ring(p.outline, d);
    shell(out, d, r, 0, rec.heights.porch, d ? portals : [], 'stone');
    cap(face, r, rec.heights.porch, 'roofstone', p.holes);
  }
  shell(out, d, ring(rec.tower.outline, d), 0, rec.tower.top, d ? portals : [], 'stone');
  cap(face, ring(rec.tower.outline, d), rec.tower.top, 'roofstone');
  for (const m of rec.minarets) minaret(face, m, d);
  facade(out, face, d, portals);
  buttresses(face, d);
  const n = d ? 4 : 1;
  for (let i = 0; i < n; i++) {
    const a = -42.6 + (i * 3.3) / n,
      b = -42.6 + ((i + 1) * 3.3) / n,
      y = floor - 0.03 - (n - 1 - i) * 0.14;
    solid(
      face,
      rect([(a + b) / 2, rec.front.centerZ], b - a, 8.5),
      (p) => Math.min(y - 0.1, sophiaGround(...p) - 0.1),
      () => y,
      'foundation',
    );
  }
}
export const buildSophiaSkyline = (o) => build(o, 0);
export const buildSophiaDistrict = (o) => build(o, 1);
export const buildSophiaStreet = (o) => build(o, 2);
export const buildSophiaCloseup = (o) => build(o, 3);
export const sophiaStudy = {
  id: 'N0337',
  key: 'saint_sophia_cathedral',
  title: 'Saint Sophia Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1476251',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Current Selimiye Mosque, Nicosia (former Saint Sophia Cathedral): twin minarets/single balconies, asymmetric northern square bay and southern round base, three recessed Gothic porch arches, pale pointed fretwork screen, low vaulted nave/aisles, small gable crests/flying buttresses and mapped polygonal east/annex envelope.',
  sourceFacts: {
    currentIdentity:
      'Q1476251 / Selimiye Mosque, Nicosia; retained planned Saint Sophia Cathedral asset identity.',
    horizontalBasis:
      'Retained exact-QID outline and one unioned current PMTiles parent; approximate architectural zones are clipped from the full mapped envelope.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Full mapped approximately79x41m envelope controls scale. Parent11m is a generic three-level value, not a measured cathedral height. Nave,minarets,porch/annex roles and exact ground joins remain documented picture-led estimates.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256-square sandstone/raw-stone/standing-seam/wood/plaster graphs, metric UVs and linear tints; flat blue-gray glass. No embedded images or copied photograph textures.',
  importReason:
    'Four authored browser levels retain both western minarets, asymmetric Gothic front and low nave at the signed planned Nicosia identity.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Current Selimiye mosque exterior is represented under its stable former-cathedral candidate ID. Screen rosettes,lancets,portal hoods and balcony profiles are selected approximations; no exact fretwork,sculpture,flags,loudspeakers,finials/crescents,full interiors,market stalls or neighboring buildings. Roof subdivision and annex functions remain unverified. Closed recessed doors and open porch cuts do not certify walking surfaces. Physical laptop/phone timing pending.',
    'Skyline uses closed porch masses,mean-tinted materials and coarser minaret/vault facets. District restores actual porch arches,shared textures and balcony outlines; street restores flying arches,small gables and selected screen pattern; closeup refines shafts,vault/arch facets,balcony bars and rosette spokes. Detail/profile changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'asymmetric-west-front-and-pale-screen',
      position: [-107, 25, 1],
      lookAt: [-34, 17, 0],
      fov: 43,
    },
    { name: 'three-recessed-porch-arches', position: [-64, 8, 1], lookAt: [-34, 5, 1], fov: 47 },
    { name: 'twin-minarets-and-balconies', position: [-67, 59, 50], lookAt: [-29, 44, 0], fov: 43 },
    {
      name: 'south-clerestory-and-flying-buttresses',
      position: [5, 38, 62],
      lookAt: [1, 17, 8],
      fov: 43,
    },
    {
      name: 'polygonal-east-and-lower-annexes',
      position: [91, 37, 43],
      lookAt: [24, 15, 2],
      fov: 43,
    },
    {
      name: 'north-square-bay-and-low-vault',
      position: [-9, 42, -72],
      lookAt: [-7, 19, -8],
      fov: 43,
    },
  ],
};

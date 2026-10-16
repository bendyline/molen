/** Matthias Church: unequal Gothic towers, patterned cross-gables and polygonal eastern apse. */
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
  '../../../content/worldgen/source/places/u2/u2m/n0340_matthias_church/',
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
  stone: '#e1d9c7',
  trim: '#eee5d1',
  roof: '#b5774b',
  copper: '#607a71',
  foundation: '#b2a68c',
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
const footing = (p) => Math.min(floor - 0.3, matthiasGround(...p) - 0.35);
export function matthiasGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Matthias Church footing outside retained terrain');
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
const ring = (r, d) => simplify(r, d ? 0.025 : 0.24),
  dot2 = (p, a) => p[0] * a[0] + p[1] * a[1],
  bounds = (r) =>
    [0, 1].map((k) => [Math.min(...r.map((p) => p[k])), Math.max(...r.map((p) => p[k]))]);
const frontAxis = unit(rec.front.b.map((v, k) => v - rec.front.a[k])),
  frontNormal = [-frontAxis[1], frontAxis[0]];
export const matthiasFront = (z) => [
  rec.front.a[0] +
    ((rec.front.b[0] - rec.front.a[0]) * (z - rec.front.a[1])) / (rec.front.b[1] - rec.front.a[1]),
  z,
];
export const matthiasPortals = () => [
  {
    name: 'west-main-portal',
    center: matthiasFront(0.5),
    axis: frontAxis,
    normal: frontNormal,
    width: 3.2,
    bottom: floor + 0.1,
    height: 6.6,
    spring: 4.6,
    shape: 'pointed',
    depth: 3.2,
  },
  {
    name: 'south-porch-portal',
    center: [-17.8, 20.1],
    axis: [1, 0],
    normal: [0, 1],
    width: 3.1,
    bottom: floor + 0.1,
    height: 5.8,
    spring: 4.1,
    shape: 'pointed',
    depth: 3.2,
  },
  {
    name: 'north-porch-portal',
    center: [6.7, -20.25],
    axis: [-1, 0],
    normal: [0, -1],
    width: 3.0,
    bottom: floor + 0.1,
    height: 6.3,
    spring: 4.4,
    shape: 'pointed',
    depth: 3.2,
  },
];
function prism(r, b = -1e5, t = 1e5) {
  const s = sign(r),
    B = bounds(r);
  return {
    planes: [
      ...r.map((a, i) => {
        const q = r[(i + 1) % r.length],
          dx = q[0] - a[0],
          dz = q[1] - a[1];
        return [-dz * s, 0, dx * s, (dz * a[0] - dx * a[1]) * s];
      }),
      [0, 1, 0, -b],
      [0, -1, 0, t],
    ],
    bounds: [B[0], [b, t], B[1]],
  };
}
function masked(out, holes) {
  return {
    addTriangle(...args) {
      const p = args[2],
        B = [0, 1, 2].map((k) => [
          Math.min(...p.map((p) => p[k])),
          Math.max(...p.map((p) => p[k])),
        ]),
        near = holes.filter((h) =>
          h.bounds.every((b, k) => b[0] <= B[k][1] + 1e-6 && b[1] >= B[k][0] - 1e-6),
        );
      if (near.length) openingBuilder(out, near).addTriangle(...args);
      else out.addTriangle(...args);
    },
  };
}
function clip(r, axis, value, greater) {
  const out = [];
  let a = r.at(-1),
    v = (dot2(a, axis) - value) * (greater ? 1 : -1);
  for (const b of r) {
    const w = (dot2(b, axis) - value) * (greater ? 1 : -1);
    if (v >= 0 !== w >= 0) out.push(lerp(a, b, v / (v - w)));
    if (w >= 0) out.push(b);
    a = b;
    v = w;
  }
  return out;
}
function inside(p, r) {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      c = !c;
  }
  return c;
}
const toLinear = (h) =>
  h
    .slice(1)
    .match(/../g)
    .map((n) => {
      const v = parseInt(n, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const cream = toLinear('#e2d4ad'),
  green = toLinear('#506c58'),
  roofMean = colors.roof.map((v, k) => v * 0.8 + cream[k] * 0.12 + green[k] * 0.08);
function roofPlane(face, r, y, slot, d) {
  cap((s, p, n) => face(s, p, n, !d && slot === 'roof' ? roofMean : undefined), r, y, slot);
}
function splitAt(r, axis, cuts) {
  let sections = [r];
  for (const q of cuts)
    sections = sections.flatMap((r) =>
      [clip(r, axis, q, false), clip(r, axis, q, true)].filter((r) => r.length > 2),
    );
  return sections;
}
function pattern(face, t, y, d, limitX = 1e5) {
  if (!d || t.slot !== 'roof') return;
  const step = d === 1 ? 3.2 : d === 2 ? 2.0 : 1.45,
    B = bounds(t.outline),
    width = step * 0.75;
  for (let z = Math.ceil(B[1][0] / step) * step; z < B[1][1]; z += step)
    for (let x = Math.ceil(B[0][0] / step) * step; x < Math.min(B[0][1], limitX); x += step) {
      const diamond = [
        [x - width / 2, z],
        [x, z - width / 2],
        [x + width / 2, z],
        [x, z + width / 2],
      ];
      if (!diamond.every((p) => p[0] < limitX && inside(p, t.outline))) continue;
      const tint = (Math.round(x / step) + Math.round(z / step)) % 3 === 0 ? green : cream;
      const axis = t.cross,
        cuts = t.mainProfile
          ? [(t.mainProfile.coreRange[0] + t.mainProfile.coreRange[1]) / 2]
          : [(t.shortRange[0] + t.shortRange[1]) / 2];
      for (const r of splitAt(diamond, axis, cuts))
        cap(
          (s, p, n) => face(s, p, n, tint),
          r,
          (p) => y(p) + 0.025,
          'roof',
        );
    }
}
function gable(face, t, d) {
  const [lo, hi] = t.shortRange,
    mid = (lo + hi) / 2,
    half = (hi - lo) / 2,
    y = (p) =>
      floor +
      t.base +
      (t.top - t.base) * (1 - Math.min(1, Math.abs(dot2(p, t.cross) - mid) / half));
  for (const r of splitAt(t.outline, t.cross, [mid])) roofPlane(face, r, y, t.slot, d);
  const outline = t.outline.flatMap((a, i) => {
    const b = t.outline[(i + 1) % t.outline.length],
      av = dot2(a, t.cross),
      bv = dot2(b, t.cross),
      ts = [0];
    if (Math.abs(bv - av) > 1e-8) {
      const u = (mid - av) / (bv - av);
      if (u > 1e-7 && u < 1 - 1e-7) ts.push(u);
    }
    return ts.map((u) => lerp(a, b, u));
  });
  sides(face, outline, t.base, y, 'stone');
  pattern(face, t, y, d);
}
function mainRoof(face, t, d) {
  const [lo, hi] = t.mainProfile.coreRange,
    mid = (lo + hi) / 2,
    half = (hi - lo) / 2,
    x = t.mainProfile.apseStartX,
    y = (p) => floor + t.base + (t.top - t.base) * Math.max(0, 1 - Math.abs(p[1] - mid) / half),
    west = clip(t.outline, [1, 0], x, false),
    east = clip(t.outline, [1, 0], x, true);
  for (const r of splitAt(west, [0, 1], [lo, mid, hi])) roofPlane(face, r, y, 'roof', d);
  const apex = [x, mid];
  for (let i = 0; i < east.length; i++) {
    const a = east[i],
      b = east[(i + 1) % east.length];
    if (Math.abs(a[0] - x) < 1e-5 && Math.abs(b[0] - x) < 1e-5) continue;
    face(
      'roof',
      [at(a, t.base), at(b, t.base), at(apex, t.top)],
      [0, 1, 0],
      !d ? roofMean : d >= 2 && i % 3 === 0 ? green : undefined,
    );
  }
  const outline = west.flatMap((a, i) => {
    const b = west[(i + 1) % west.length],
      ts = [0];
    for (const q of [lo, mid, hi])
      if (Math.abs(b[1] - a[1]) > 1e-8) {
        const u = (q - a[1]) / (b[1] - a[1]);
        if (u > 1e-7 && u < 1 - 1e-7) ts.push(u);
      }
    return ts.sort((a, b) => a - b).map((u) => lerp(a, b, u));
  });
  // The east edge joins the conical apse; it needs no exposed gable wall.
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    if (Math.abs(a[0] - x) < 1e-5 && Math.abs(b[0] - x) < 1e-5) continue;
    face(
      'stone',
      [at(a, t.base), at(b, t.base), at(b, y), at(a, y)],
      [(b[1] - a[1]) * sign(west), 0, (a[0] - b[0]) * sign(west)],
    );
  }
  pattern(face, t, y, d, x - 0.1);
}
function surfaceFrame(h, d) {
  const p = prepareOpening(h, 0, d),
    s = Math.sign(-p.axis[1] * h.normal[0] + p.axis[0] * h.normal[1]);
  return { ...p, point: (x, y, z) => p.point(x, y, z * s) };
}
function window(face, h, d, closed = false) {
  pane(face, h, d, 0.11, closed ? 'door' : 'glass');
  if (d >= 2) {
    archBand(face, h, d, 0.23, 'trim', 0.19);
    if (d >= 3 && !closed) {
      const p = surfaceFrame(h, d);
      beam(face, p.point(0, h.bottom, 0.26), p.point(0, h.bottom + h.spring, 0.26), 0.11, 'trim');
    }
  }
}
function rose(d) {
  const p = matthiasFront(0.5),
    cy = floor + 12.6,
    r = 1.65,
    n = d >= 3 ? 24 : d >= 2 ? 16 : 12,
    axis = frontAxis,
    normal = frontNormal,
    point = (u, v, off) => [
      p[0] + axis[0] * u + normal[0] * off,
      cy + v,
      p[1] + axis[1] * u + normal[1] * off,
    ],
    ring = Array.from({ length: n }, (_, i) => [
      r * Math.cos((i * 2 * Math.PI) / n),
      r * Math.sin((i * 2 * Math.PI) / n),
    ]),
    planes = [
      [normal[0], 0, normal[1], 1.6 - normal[0] * p[0] - normal[1] * p[1]],
      [-normal[0], 0, -normal[1], 1.6 + normal[0] * p[0] + normal[1] * p[1]],
    ];
  for (let i = 0; i < n; i++) {
    const a = ring[i],
      b = ring[(i + 1) % n],
      du = b[0] - a[0],
      dv = b[1] - a[1],
      A = -dv * axis[0],
      C = -dv * axis[1];
    planes.push([A, du, C, dv * a[0] - du * a[1] - A * p[0] - du * cy - C * p[1]]);
  }
  return {
    planes,
    bounds: [
      [p[0] - 2, p[0] + 2],
      [cy - r, cy + r],
      [p[1] - r - 2, p[1] + r + 2],
    ],
    point,
    ring,
    r,
    normal,
  };
}
function rosette(face, h, d) {
  face(
    'glass',
    h.ring.map((q) => h.point(...q, d ? -0.75 : 0.1)),
    [h.normal[0], 0, h.normal[1]],
  );
  if (!d) return;
  for (let i = 0; i < h.ring.length; i++) {
    const j = (i + 1) % h.ring.length,
      a = h.ring[i],
      b = h.ring[j],
      outer = (q) => q.map((v) => (v * (h.r + 0.3)) / h.r);
    face(
      'trim',
      [
        h.point(...a, 0.15),
        h.point(...b, 0.15),
        h.point(...outer(b), 0.15),
        h.point(...outer(a), 0.15),
      ],
      [h.normal[0], 0, h.normal[1]],
    );
    face('trim', [
      h.point(...a, 0.15),
      h.point(...b, 0.15),
      h.point(...b, -0.7),
      h.point(...a, -0.7),
    ]);
  }
  const count = d >= 3 ? 16 : 8;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    beam(
      face,
      h.point(0.22 * Math.cos(a), 0.22 * Math.sin(a), 0.2),
      h.point((h.r - 0.05) * Math.cos(a), (h.r - 0.05) * Math.sin(a), 0.2),
      0.11,
      'trim',
    );
  }
}
export function matthiasBelfry(d = 3) {
  const result = [],
    r = rec.tall.outline;
  if (!d) return result;
  for (let i = 0; i < r.length; i++) {
    if (d === 1 && i % 2) continue;
    const f = faceFrame(r, i);
    for (const y of d === 1 ? [25, 47] : [23, 36, 48])
      result.push({
        name: `south-belfry-${i}-${y}`,
        center: lerp(f.a, f.b, 0.5),
        axis: f.axis,
        normal: f.normal,
        width: d === 1 ? 1.7 : 2.05,
        bottom: floor + y,
        height: 8.4,
        spring: 6.4,
        shape: 'pointed',
        depth: 3.2,
      });
  }
  return result;
}
function cone(face, p, r, b, t, _d, slot = 'trim', n = 8) {
  profile(
    face,
    regular(p, r, n),
    [
      [b, 1],
      [t, 0.01],
    ],
    slot,
  );
}
function tallTower(out, face, d) {
  const t = rec.tall,
    r = ring(t.outline, d),
    hs = matthiasBelfry(d);
  sides(face, r, 0, t.lower, 'stone');
  shell(out, d, r, t.lower, t.top, d >= 2 ? hs : [], 'stone', d >= 2 ? scaled(r, 0.76) : null);
  cap(face, r, t.top, 'trim');
  if (d) {
    for (const h of hs) {
      pane(face, h, d, d >= 2 ? -0.6 : 0.12, 'glass');
      if (d >= 2) archBand(face, h, d, 0.28, 'trim', 0.2);
      if (d >= 3) {
        const p = surfaceFrame(h, d);
        beam(face, p.point(0, h.bottom, 0.25), p.point(0, h.bottom + h.spring, 0.25), 0.13, 'trim');
      }
    }
    for (const y of [17.5, 33, 45.5, 58.8]) band(face, r, y, 0.48, 'trim', 1.045);
    for (let i = 0; i < r.length; i++) {
      const p = r[i];
      if (d >= 2) box(face, p, 0.38, 0.38, 18, 58, 'trim');
    }
    for (let i = 0; i < r.length; i += 2) {
      const f = faceFrame(r, i),
        p = lerp(f.a, f.b, 0.5),
        n = f.normal,
        a = f.axis,
        cy = floor + 57.6,
        point = (u, v, off) => [p[0] + a[0] * u + n[0] * off, cy + v, p[1] + a[1] * u + n[1] * off];
      face(
        'trim',
        Array.from({ length: 12 }, (_, j) =>
          point(0.9 * Math.cos((j * Math.PI) / 6), 0.9 * Math.sin((j * Math.PI) / 6), 0.13),
        ),
        [n[0], 0, n[1]],
      );
      beam(face, point(0, 0, 0.21), point(0.1, 0.65, 0.21), 0.1, 'door');
      beam(face, point(0, 0, 0.22), point(-0.5, 0.16, 0.22), 0.12, 'door');
    }
  }
  const gallery = ring(t.galleryOutline, d),
    centerGallery = center(gallery),
    spire = ring(t.spireOutline, d),
    centerSpire = center(spire);
  solid(face, gallery, 59.6, 60, 'trim');
  if (d >= 2) {
    sides(face, regular(centerGallery, 0.7, 8), 60, 65, 'stone');
    for (const p of gallery) {
      sides(face, regular(p, 0.18, 4), 60, 65, 'trim');
      cone(face, p, 0.43, 64.8, 66.7, d);
    }
    solid(face, scaled(gallery, 1.04), 64.65, 65, 'trim');
  } else sides(face, gallery, 60, 65, 'stone');
  if (d >= 2) {
    cone(face, centerSpire, 0.58, 65, t.spireTop, d, 'trim', 8);
    for (const p of spire) beam(face, at(p, 65), at(centerSpire, t.spireTop - 0.12), 0.17, 'trim');
    for (const y of [67.2, 70.5, 73.5, 75.2]) {
      const f = (t.spireTop - y) / (t.spireTop - 65),
        r = scaled(spire, f);
      sides(face, r, y, y + 0.15, 'trim');
    }
  } else
    profile(
      face,
      spire,
      [
        [65, 1],
        [t.spireTop, 0.01],
      ],
      'trim',
    );
  if (d >= 2)
    for (let i = 0; i < r.length; i += 2) {
      const p = r[i];
      sides(face, regular(p, 0.34, 4), 58.7, 61.7, 'trim');
      cone(face, p, 0.55, 61.7, 64.7, d);
    }
}
function belaTower(face, d) {
  const t = rec.bela,
    r = ring(t.outline, d),
    roof = ring(t.roofOutline, d),
    p = t.center;
  solid(face, r, 0, t.bodyTop, 'stone');
  profile(
    face,
    r,
    [
      [t.bodyTop, 1],
      [t.roofBase, 0.68],
    ],
    'roof',
  );
  profile(
    face,
    roof,
    [
      [t.roofBase, 1],
      [t.roofTop, 0.04],
    ],
    'roof',
  );
  if (d) {
    const rows = d === 1 ? [0.45] : [0.23, 0.5, 0.75],
      columns = d === 1 ? [0.3, 0.7] : [0.2, 0.5, 0.8],
      p = center(roof);
    for (let i = 0; i < roof.length; i++) {
      const a = roof[i],
        b = roof[(i + 1) % roof.length],
        rawNormal = normalFor(at(a, t.roofBase), at(b, t.roofBase), at(p, t.roofTop)),
        normal = rawNormal[1] < 0 ? rawNormal.map((v) => -v) : rawNormal;
      const point = (u, v) => {
        const q = lerp(a, b, u),
          f = 1 - 0.96 * v;
        return [
          p[0] + (q[0] - p[0]) * f + normal[0] * 0.025,
          floor + t.roofBase + (t.roofTop - t.roofBase) * v + normal[1] * 0.025,
          p[1] + (q[1] - p[1]) * f + normal[2] * 0.025,
        ];
      };
      for (const [v, j] of rows.map((v, j) => [v, j]))
        for (const [u, k] of columns.map((u, k) => [u, k]))
          face(
            'roof',
            [point(u - 0.1, v), point(u, v - 0.09), point(u + 0.1, v), point(u, v + 0.09)],
            normal,
            (i + j + k) % 3 ? cream : green,
          );
    }
  }
  box(face, p, 0.12, 0.12, t.roofTop, t.tip, 'trim');
  for (const c of t.cornerOutlines) {
    const p = center(c);
    sides(face, ring(c, d), 19, 22, 'trim');
    cone(face, p, 0.68, 22, t.cornerTop, d, 'roof', 4);
  }
  if (d) {
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      window(
        face,
        {
          center: lerp(f.a, f.b, 0.5),
          axis: f.axis,
          normal: f.normal,
          width: 1.35,
          bottom: floor + 9.2,
          height: 5.8,
          spring: 4.6,
          shape: 'pointed',
          depth: 1,
        },
        d,
      );
    }
    band(face, r, 18.5, 0.45, 'trim', 1.025);
  }
  if (d >= 2) {
    const B = bounds(roof);
    for (const x of [-0.9, 0.9])
      for (const z of [-0.9, 0.9]) {
        const q = [p[0] + x, p[1] + z];
        cone(face, q, 0.24, 24, 26, d, 'trim', 4);
      }
    if (B[0][1] - B[0][0] < 1) throw Error('Degenerate Bela roof');
  }
}
function ridgeSpire(face, d) {
  const t = rec.ridge,
    r = ring(t.outline, d);
  solid(face, r, t.base, t.bodyTop, 'copper');
  profile(
    face,
    r,
    [
      [t.bodyTop, 1],
      [t.top, 0.02],
    ],
    'copper',
  );
  if (d >= 2) {
    band(face, r, 28.4, 0.3, 'trim', 1.1);
    for (const p of r) cone(face, p, 0.25, 28.7, 30.5, d, 'trim', 4);
  }
}
function facades(face, d) {
  if (!d) return;
  for (const t of rec.roofs.filter((t) => t.name.startsWith('transverse-chapel'))) {
    const B = bounds(t.outline),
      x = (B[0][0] + B[0][1]) / 2;
    for (const side of [-1, 1]) {
      const z = side < 0 ? B[1][0] : B[1][1],
        axis = [-side, 0],
        normal = [0, side];
      window(
        face,
        {
          center: [x, z],
          axis,
          normal,
          width: 1.3,
          bottom: floor + 18.3,
          height: 2.7,
          spring: 1.8,
          shape: 'pointed',
          depth: 1,
        },
        d,
      );
      window(
        face,
        {
          center: [x, z],
          axis,
          normal,
          width: 2.0,
          bottom: floor + 6,
          height: 8.7,
          spring: 6.4,
          shape: 'pointed',
          depth: 1,
        },
        d,
      );
      if (d >= 2) {
        for (const dx of [-2.6, 2.6]) {
          const q = [x + dx, z + side * 0.35];
          box(face, q, 0.68, 1.1, 0, 15.5, 'stone');
          profile(
            face,
            rect(q, 0.68, 1.1),
            [
              [15.5, 1],
              [18.2, 0.55],
            ],
            'trim',
          );
          cone(face, q, 0.38, 18.2, 21.2, d);
        }
      }
    }
  }
  const r = rec.body.polygons[0].outline;
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.a[0] < 23 || f.b[0] < 23 || f.normal[0] < 0.25) continue;
    const p = lerp(f.a, f.b, 0.5);
    window(
      face,
      {
        center: p,
        axis: f.axis,
        normal: f.normal,
        width: 1.6,
        bottom: floor + 6.8,
        height: 8.3,
        spring: 6.2,
        shape: 'pointed',
        depth: 1,
      },
      d,
    );
    if (d >= 2) {
      const q = f.a.map((v, k) => v + f.normal[k] * 0.45);
      box(face, q, 0.7, 0.9, 0, 15.6, 'stone');
      cone(face, q, 0.46, 15.6, 20.5, d);
    }
  }
  const F = matthiasFront(0.5);
  for (const z of [-2.9, 3.7]) {
    const p = matthiasFront(z).map((v, k) => v + frontNormal[k] * 0.2);
    box(face, p, 0.48, 0.6, 0, 18.3, 'trim');
    if (d >= 2) cone(face, p, 0.45, 18.3, 24.3, d);
  }
  if (d >= 2)
    for (const z of [-1.2, 0.5, 2.2])
      window(
        face,
        {
          center: matthiasFront(z),
          axis: frontAxis,
          normal: frontNormal,
          width: 0.65,
          bottom: floor + 18.3,
          height: 2.9,
          spring: 2,
          shape: 'pointed',
          depth: 1,
        },
        d,
      );
  if (d >= 3) {
    band(face, ring(r, d), 17.5, 0.3, 'trim', 1.012);
    if (F[0] > -25) throw Error('Western facade lost signed frame');
  }
}
function build(out, d) {
  const baseFace = writer(out, d),
    face = (s, p, n, color) => baseFace(s, p, n, !d && s === 'roof' && !color ? roofMean : color),
    roseHole = rose(d),
    baseMasks = [
      prism(scaled(rec.tall.outline, 1.02), floor - 0.1),
      prism(scaled(rec.bela.outline, 1.02), floor - 0.1),
      prism(rec.ridge.outline, floor + rec.ridge.base),
    ],
    cuts = [...baseMasks, ...(d ? [roseHole] : [])],
    roofOut = masked(out, cuts),
    roofFace = writer(roofOut, d),
    portals = matthiasPortals(),
    r = ring(rec.main.polygons[0].outline, d);
  sides(face, r, footing, 0, 'foundation');
  if (d) cap(face, r, 0, 'foundation');
  shell(roofOut, d, r, 0, 9, d ? portals : [], 'stone');
  cap(roofFace, r, 9, 'copper');
  shell(roofOut, d, ring(rec.body.polygons[0].outline, d), 0, 18, d ? [portals[0]] : [], 'stone');
  for (const t of rec.roofs) {
    if (!t.mainProfile) {
      if (t.name === 'south-entrance-gable')
        shell(roofOut, d, ring(t.outline, d), 0, t.base, d ? [portals[1]] : [], 'stone');
      else if (t.name === 'north-entrance-gable')
        shell(roofOut, d, ring(t.outline, d), 0, t.base, d ? [portals[2]] : [], 'stone');
      else sides(roofFace, ring(t.outline, d), 0, t.base, 'stone');
      gable(roofFace, t, d);
    } else mainRoof(roofFace, t, d);
  }
  tallTower(out, face, d);
  belaTower(face, d);
  ridgeSpire(face, d);
  const t = rec.turret;
  solid(face, ring(t.outline, d), 0, t.base, 'stone');
  cone(face, t.center, 1.8, t.base, t.top, d, 'roof', 6);
  facades(roofFace, d);
  rosette(face, roseHole, d);
  for (const h of portals) {
    pane(face, h, d, d ? -1.2 : 0.12, 'door');
    if (d) {
      archBand(face, h, d, 0.55, 'trim', 0.15);
      if (d >= 2) archBand(face, h, d, 0.27, 'trim', 0.35);
    }
  }
  for (const h of portals) {
    const p = h.center,
      n = h.normal,
      axis = h.axis;
    if (!d) continue;
    for (let i = 0; i < 3; i++) {
      const count = d ? 3 : 1,
        off = 0.8 - i * 0.3,
        y = -(count - 1 - i) * 0.13,
        q = p.map((v, k) => v + n[k] * off),
        r = [
          [-1, -1],
          [1, -1],
          [1, 1],
          [-1, 1],
        ].map(([u, v]) => q.map((a, k) => a + axis[k] * u * 2.6 + n[k] * v * (d ? 0.155 : 0.6)));
      solid(face, r, footing, y, 'foundation');
    }
  }
}
export const buildMatthiasSkyline = (o) => build(o, 0),
  buildMatthiasDistrict = (o) => build(o, 1),
  buildMatthiasStreet = (o) => build(o, 2),
  buildMatthiasCloseup = (o) => build(o, 3);
export const matthiasStudy = {
  id: 'N0340',
  key: 'matthias_church',
  title: 'Matthias Church',
  category: 'cathedral',
  wikidataId: 'Q493133',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Matthias Church: unequal western towers with tall octagonal pointed belfry/open white spire and lower patterned Bela crown; repeated tiled cross-gables, long orange/green/cream patterned nave/apse roof, west rose/portal, projecting south/north entrance porches, dark ridge spire and buttressed polygonal east end.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID way37135081 and37 current parent/part controls; signed western unequal towers/eastern apse without rescaling.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Full approximately61x40.5m mapped church/attached-chapel envelope. Current map heights constrain76.57m spire and named roof/tower stages; eaves, connected roof profiles and selected details remain picture-led interpretations.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing256-square raw/weathered limestone,glazed tile,standing-seam metal and wood graphs. Roof motifs use palette vertex tints in one shared tile material; metric UVs,linear colors and flat blue-gray glass. No bespoke or embedded images.',
  importReason:
    'Four authored levels retain unequal western towers, repeated patterned gables and eastern apse at signed Budapest placement.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Selected rosette spokes,pointed belfry/portal hoods,open spire ribs,pinnacles and tile motifs are medium-fi approximations. Main central roof/conical apse and transverse eave extension to mapped outer walls are picture-led interpretations of nested map parts. Exact sculpture/fretwork,full interiors,Fisherman’s Bastion,Holy Trinity column,town/plaza and certified walking surfaces excluded. Physical phone/laptop timings remain pending.',
    'Skyline uses closed portals/coarse tower and spire masses,unpatterned mean-tinted roofs. District adds shared graphs,coarse colored roof motifs,west rose/portals and selected belfry panes. Street adds actual belfry apertures/open upper gallery/spire ribs,buttresses and gable details. Closeup refines roof motifs,window frames and selected pinnacles. Detail/profile changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'unequal-western-towers-and-rose',
      position: [-143, 71, 23],
      lookAt: [-27, 38, 1],
      fov: 43,
    },
    {
      name: 'west-rose-and-recessed-portal',
      position: [-56, 17, 0.5],
      lookAt: [-29, 10, 0.5],
      fov: 43,
    },
    {
      name: 'southern-octagonal-belfry-and-open-spire',
      position: [-70, 75, 57],
      lookAt: [-25, 54, 10],
      fov: 43,
    },
    {
      name: 'patterned-cross-gables-and-south-porch',
      position: [-7, 42, 74],
      lookAt: [-4, 15, 5],
      fov: 43,
    },
    {
      name: 'eastern-apse-and-central-ridge-spire',
      position: [77, 44, 34],
      lookAt: [16, 16, 1],
      fov: 43,
    },
    {
      name: 'lower-bela-crown-and-northern-chapels',
      position: [-47, 42, -72],
      lookAt: [-9, 17, -8],
      fov: 43,
    },
  ],
};

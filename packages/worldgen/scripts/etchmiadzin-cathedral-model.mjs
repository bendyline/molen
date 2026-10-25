/** Etchmiadzin: mapped church compound, conical drum and open western/roof bell stages. */
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
  '../../../content/worldgen/source/places/sz/szp/etchmiadzin_cathedral/',
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
  stone: '#bea887',
  trim: '#d3c1a2',
  roofstone: '#b8a47f',
  metal: '#a4a6a2',
  foundation: '#b8ab98',
  bronze: '#87704c',
  glass: '#43556a',
  door: '#725b41',
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
const footing = (p) => Math.min(floor - 0.3, etchmiadzinGround(...p) - 0.35);
export function etchmiadzinGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Etchmiadzin footing outside retained terrain');
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
    if (direction && normalFor(...p.slice(0, 3)).reduce((n, v, k) => n + v * direction[k], 0) < 0)
      p = p.toReversed();
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
export const etchmiadzinOpenings = [];
const remember = (h, d) => {
  if (d >= 3 && !etchmiadzinOpenings.some((q) => q.name === h.name)) etchmiadzinOpenings.push(h);
  return h;
};
function shell(out, d, r, b, t, holes = [], slot = 'stone', inner = null) {
  const hs = holes.map((h) => prepareOpening(h, 0, d)),
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
  box(face, p, 0.13, 0.13, base - 0.1, top, 'bronze');
  if (d) box(face, p, 0.95, 0.13, top - 0.65, top - 0.48, 'bronze');
}
function cone(face, r, base, top, d) {
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
    'roofstone',
  );
  if (d >= 3) {
    const p = center(r);
    for (let i = 0; i < r.length; i++) beam(face, at(r[i], base), at(p, top - 0.1), 0.065, 'trim');
  }
}
function roof(face, r, short, base, top, slot = 'metal') {
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
  for (const p of polys)
    face(
      slot,
      p.map((p) => at(p, y)),
      [0, 1, 0],
    );
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
        shape: 'round',
        depth: 1,
      };
      pane(face, h, d, 0.09);
      if (d >= 3) archBand(face, h, d, 0.18, 'trim', 0.12);
    }
  }
}
function lowerPortal(d) {
  return remember(
    {
      name: 'west-entry-passage',
      center: [-22, rec.front.z],
      axis: [0, 1],
      normal: [-1, 0],
      width: 3.8,
      bottom: floor + 0.05,
      height: 5.95,
      spring: 4.0,
      depth: 22,
      shape: 'round',
    },
    d,
  );
}
export const etchmiadzinBelfryOpenings = [];
function rememberBelfry(h, d) {
  if (d >= 3 && !etchmiadzinBelfryOpenings.some((q) => q.name === h.name))
    etchmiadzinBelfryOpenings.push(h);
  return h;
}
function bell(face, p, y, r, d) {
  const ring = regular(p, r, d >= 2 ? 12 : 6);
  profile(
    face,
    ring,
    [
      [y - 1.0, 1.0],
      [y - 0.7, 0.72],
      [y - 0.3, 0.64],
      [y, 0.3],
    ],
    'bronze',
  );
  box(face, p, 0.11, 0.11, y - 1.25, y - 0.85, 'bronze');
}
function pavilion(out, d, b, large = false) {
  const face = writer(out, d),
    r = regular(b.center, b.radius, 8, Math.PI / 8),
    inner = scaled(r, 0.7),
    holes = [];
  if (!large) solid(face, r, 9.0, b.base, 'stone');
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i),
      h = rememberBelfry(
        {
          name: `${b.name ?? 'west'}-belfry-${i}`,
          center: lerp(f.a, f.b, 0.5),
          axis: f.axis,
          normal: f.normal,
          width: large ? 1.35 : 0.8,
          bottom: floor + (large ? 16 : 12.55),
          height: large ? 2.75 : 2.9,
          spring: large ? 1.9 : 1.9,
          depth: large ? 2.0 : 1.8,
          shape: 'round',
        },
        d,
      );
    if (d === 0 || (d === 1 && i % 4)) pane(face, h, d, 0.06);
    else holes.push(h);
  }
  if (d === 0) sides(face, r, b.base, b.eave, 'stone');
  else {
    shell(out, d === 2 ? 1 : d, r, b.base, b.eave, holes, 'stone', inner);
    for (const h of holes) if (d >= 2) archBand(face, h, d === 2 ? 1 : d, 0.18, 'trim', 0.07);
    band(face, r, b.eave - 0.25, 0.22);
  }
  cone(face, r, b.eave, b.top, d);
  crossTop(face, b.center, b.top, b.cross, d);
  if (d >= 2) {
    if (large) {
      for (const z of [-0.8, 0, 0.8]) {
        bell(face, [b.center[0], b.center[1] + z], 18.65, 0.42, d);
        beam(
          face,
          [b.center[0] - b.radius * 1.02, floor + b.eave - 0.15, b.center[1] + z],
          [b.center[0] + b.radius * 1.02, floor + b.eave - 0.15, b.center[1] + z],
          0.13,
          'bronze',
        );
        box(face, [b.center[0], b.center[1] + z], 0.1, 0.1, 18.6, b.eave - 0.1, 'bronze');
      }
    } else {
      bell(face, b.center, b.eave - 0.5, 0.3, d);
      beam(
        face,
        [b.center[0] - b.radius * 1.02, floor + b.eave - 0.15, b.center[1]],
        [b.center[0] + b.radius * 1.02, floor + b.eave - 0.15, b.center[1]],
        0.1,
        'bronze',
      );
      box(face, b.center, 0.085, 0.085, b.eave - 0.5, b.eave - 0.1, 'bronze');
    }
  }
}
function dome(out, d) {
  const face = writer(out, d),
    b = rec.dome,
    r = regular(b.center, b.radius, d === 0 ? 8 : 12, Math.PI / 12);
  sides(face, r, b.base, b.eave, 'stone');
  cone(face, r, b.eave, b.top, d);
  crossTop(face, b.center, b.top, b.cross, d);
  if (d) {
    band(face, r, 13.1, 0.28);
    band(face, r, b.eave - 0.25, 0.22);
    windows(face, r, d, 14.0, 4.2, 'drum', 3.0);
    if (d >= 3) {
      for (let i = 0; i < r.length; i++) {
        const f = faceFrame(r, i);
        for (const t of [0.06, 0.94]) {
          const p = lerp(f.a, f.b, t);
          box(face, p, 0.15, 0.15, 13.6, 19.6, 'trim');
        }
      }
    }
  }
}
function galleryHoles(d) {
  const r = rec.gallery;
  return r.map((_, i) => {
    const f = faceFrame(r, i);
    return remember(
      {
        name: `west-upper-gallery-${i}`,
        center: lerp(f.a, f.b, 0.5),
        axis: f.axis,
        normal: f.normal,
        width: 4.85,
        bottom: floor + 7.25,
        height: 6.15,
        spring: 4.05,
        depth: 3.8,
        shape: 'round',
      },
      d,
    );
  });
}
function west(out, d, entry) {
  const face = writer(out, d),
    r = rec.gallery,
    inner = scaled(r, 0.8),
    holes = galleryHoles(d);
  shell(out, d, rec.portico, 0, 6.9, d ? [entry] : []);
  cap(face, rec.portico, 6.9, 'trim');
  if (d) {
    shell(out, d === 2 ? 1 : d, r, 7.0, 14.1, holes, 'stone', inner);
    for (const h of holes) archBand(face, h, d === 2 ? 1 : d, 0.42, 'trim', 0.12);
    band(face, r, 6.9, 0.32);
    band(face, r, 13.85, 0.3);
  } else {
    sides(face, r, 7.0, 14.1, 'stone');
    for (const h of holes) pane(face, h, d, 0.06);
  }
  roof(face, r, 1, 14.1, 15.7, 'roofstone');
  pavilion(out, d, { ...rec.westBell, name: 'west' }, true);
  const f = { a: [rec.front.x, -3.7], b: [rec.front.x, 3.5], axis: [0, 1], normal: [-1, 0] },
    front = { ...entry, center: [rec.front.x, rec.front.z] };
  if (d) {
    archBand(face, front, d, 0.65, 'trim', 0.16);
    if (d >= 3)
      archBand(
        face,
        { ...front, width: 5.1, bottom: floor - 0.55, height: 7.1, spring: 4.5 },
        d,
        0.35,
        'trim',
        0.18,
      );
  }
  if (d >= 2) {
    for (const h of holes) {
      const p = h.center,
        u = h.axis,
        n = h.normal;
      for (const t of [-0.34, 0.34]) {
        const q = p.map((v, k) => v + u[k] * h.width * t + n[k] * 0.2);
        box(face, q, 0.24, 0.24, 7.6, 8.4, 'bronze');
      }
      const a = [p[0] - u[0] * 2.15 + n[0] * 0.2, floor + 8.4, p[1] - u[1] * 2.15 + n[1] * 0.2],
        b = [p[0] + u[0] * 2.15 + n[0] * 0.2, floor + 8.4, p[1] + u[1] * 2.15 + n[1] * 0.2];
      beam(face, a, b, 0.13, 'bronze');
    }
    for (const t of [0.1, 0.9]) {
      const p = lerp(f.a, f.b, t);
      box(face, p, 0.32, 0.35, 1.5, 6.4, 'trim');
    }
  }
  if (d >= 3) {
    for (const t of [0.12, 0.32, 0.52, 0.72, 0.9]) {
      const p = lerp(f.a, f.b, t);
      const disc = Array.from({ length: 8 }, (_, i) => [
        p[0] - 0.07,
        floor + 6.25 + 0.19 * Math.sin((i * Math.PI) / 4),
        p[1] + 0.19 * Math.cos((i * Math.PI) / 4),
      ]);
      face('trim', disc, [-1, 0, 0]);
    }
  }
}
function body(out, d, entry) {
  const face = writer(out, d);
  for (const p of rec.bodyPolygons) {
    const r = simplify(p.outline, d === 0 ? 0.25 : 0.015);
    shell(out, d, r, 0, 9.0, d ? [entry] : []);
    if (d >= 1) {
      band(face, r, 8.7, 0.25);
      windows(face, r, d);
    }
  }
  for (const p of rec.flatRoofs) cap(face, p.outline, 9.0, 'metal', p.holes);
  for (const b of rec.roofs) {
    sides(face, b.outline, 8.6, b.base, 'stone');
    roof(face, b.outline, b.short, b.base, b.top);
  }
  for (const b of rec.apsides) {
    const r = regular(b.center, b.radius, d === 0 ? 8 : 12);
    sides(face, r, 0, 10.35, 'stone');
    profile(
      face,
      r,
      [
        [10.35, 1.02],
        [11.7, 0.06],
      ],
      'roofstone',
    );
    if (d) {
      band(face, r, 10.1, 0.25);
      windows(face, r, d, 3.6, 3.3, 'apse', 4.0);
    }
  }
  const door = {
    ...entry,
    center: [rec.front.doorX, rec.front.z],
    width: 3.25,
    height: 5.6,
    spring: 3.8,
  };
  pane(face, door, d, 0, 'door');
  for (const b of rec.pavilions) pavilion(out, d, b);
  if (d) {
    const r = rec.main.polygons[0].outline;
    sides(face, r, footing, 0, 'foundation');
    cap(face, r, 0, 'foundation');
  }
  const count = d === 0 ? 1 : d === 1 ? 3 : 5,
    x0 = rec.front.stepOutline[0][0],
    x1 = rec.front.x;
  for (let i = 0; i < count; i++) {
    const x = x0 + ((x1 - x0) * i) / count,
      top = floor - 0.06 - (count - 1 - i) * 0.13;
    solid(
      face,
      rect([(x + x1) / 2, rec.front.z], x1 - x, 5.8),
      (p) => Math.min(top - 0.2, etchmiadzinGround(...p) - 0.1),
      () => top,
      'foundation',
    );
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
  const entry = lowerPortal(d);
  body(out, d, entry);
  west(out, d, entry);
  dome(out, d);
}
export const buildEtchmiadzinSkyline = (out) => build(out, 0);
export const buildEtchmiadzinDistrict = (out) => build(out, 1);
export const buildEtchmiadzinStreet = (out) => build(out, 2);
export const buildEtchmiadzinCloseup = (out) => build(out, 3);
export const etchmiadzinStudy = {
  id: 'etchmiadzin_cathedral',
  key: 'etchmiadzin_cathedral',
  title: 'Etchmiadzin Cathedral',
  category: 'cathedral',
  wikidataId: 'Q1294648',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual Etchmiadzin cathedral exterior with faceted main drum/conical stone roof, gray metal crossing roofs, open western bell portico/gallery/belfry, three smaller roof belfries, connected eastern range, arched windows, simplified stone motifs, plinth and steps.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID outline and current parent35184505997951 preserve west projection, side apses and connected lower east range. There are no height-tagged roof parts.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Full mapped envelope and retained27m overall height, with picture-led roof/drum/portico subdivisions. Core29x23m facts do not resize the55m mapped compound.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing shared256-square graphs supply sandstone walls/trim/cones, gray standing-seam roofs, raw stone foundations, bronze bells/crosses/rails and wood doors. Linear tints and metric UVs; glazing uses vertex colors. No unique embedded image.',
  importReason:
    'Four independently authored browser levels preserve the church dome, open west bell stages, side roof belfries and connected eastern range at their mapped location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'The retained exact-QID/current parent is the only mapped building control.27m overall/core29x23m facts and two pictures guide the architecture; all drum/eave/portico/belfry splits and eastern-range roof roles are estimates. The full55m mapped envelope is retained. East roof-belfry location is picture-led, without a separate map part.',
    'NativeY0 follows standardDEM874.764015m. Estimated0.65m common floor clears coarse perimeter−0.73..0.47m; foundation/plaza/doorstep joins remain approximate. Surveyed levels, interiors and certified walking/collision surfaces are excluded.',
    'Skyline retains the main cone, western bell silhouette, three roof pavilions and eastern range with simple surfaces. District restores principal openings/shared textures; street/closeup restore complete galleries, bells, cornices, drum windows, rails and simplified stone motifs. Intermediate detail/profile changes remain visible.',
    'Exact reliefs, sculpture, lettering, structural plans and interiors are not reconstructed. The surrounding monastic compound, gates, vegetation and separate churches remain host content. Physical laptop/phone measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'west-entry-and-two-open-bell-stages',
      position: [-62, 16, 3],
      lookAt: [-23, 11, 0],
      fov: 43,
    },
    {
      name: 'main-faceted-drum-and-stone-cone',
      position: [12, 31, 37],
      lookAt: [-3.5, 19, 0.3],
      fov: 43,
    },
    { name: 'south-apse-and-roof-belfry', position: [-5, 22, 47], lookAt: [-2, 11, 14], fov: 43 },
    {
      name: 'north-crossing-roofs-and-belfry',
      position: [-8, 29, -49],
      lookAt: [-3.5, 13, -8],
      fov: 43,
    },
    { name: 'eastern-range-and-roof-belfry', position: [57, 25, 26], lookAt: [16, 10, 1], fov: 43 },
    {
      name: 'western-open-belfry-and-bells',
      position: [-39, 24, 16],
      lookAt: [-23.7, 18, 0],
      fov: 43,
    },
  ],
};

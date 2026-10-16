/** Euphrasian Basilica: atrium, basilica, baptistery and campanile. */
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
  '../../../content/worldgen/source/places/u2/u21/n0341_euphrasian_basilica/',
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
  stone: '#c8bda3',
  plaster: '#e1ddc9',
  trim: '#eee5d1',
  roof: '#b67d59',
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
const footing = (p) => Math.min(floor - 0.3, euphrasianGround(...p) - 0.35);
export function euphrasianGround(x, z) {
  const c = Math.cos(fit.heading),
    s = Math.sin(fit.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Euphrasian Basilica footing outside retained terrain');
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
const ring = (r, d) => simplify(r, d ? 0.025 : 0.22),
  dot2 = (p, a) => p[0] * a[0] + p[1] * a[1];
function clip(r, axis, value, greater) {
  const result = [];
  let a = r.at(-1),
    av = dot2(a, axis) - value;
  for (const b of r) {
    const bv = dot2(b, axis) - value;
    if (av >= 0 !== bv >= 0) {
      const t = av / (av - bv);
      result.push(lerp(a, b, t));
    }
    if (greater ? bv >= 0 : bv <= 0) result.push(b);
    a = b;
    av = bv;
  }
  return result;
}
function roof(face, r, axis, eave, ridge, slot = 'roof') {
  const cross = [-axis[1], axis[0]],
    range = r.map((p) => dot2(p, cross)),
    lo = Math.min(...range),
    hi = Math.max(...range),
    mid = (lo + hi) / 2,
    y = (p) => eave + (ridge - eave) * (1 - Math.abs((dot2(p, cross) - mid) / ((hi - lo) / 2)));
  for (const greater of [false, true]) {
    const q = clip(r, cross, mid, greater);
    if (q.length >= 3) cap(face, q, (p) => floor + y(p), slot);
  }
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      pts = [
        a,
        ...((dot2(a, cross) - mid) * (dot2(b, cross) - mid) < 0
          ? [lerp(a, b, (mid - dot2(a, cross)) / (dot2(b, cross) - dot2(a, cross)))]
          : []),
        b,
      ];
    for (let j = 1; j < pts.length; j++) {
      const p = pts[j - 1],
        q = pts[j];
      face(
        'plaster',
        [at(p, eave), at(q, eave), at(q, y(q)), at(p, y(p))],
        [(b[1] - a[1]) * sign(r), 0, (a[0] - b[0]) * sign(r)],
      );
    }
  }
}
function roundColumn(face, p, r, b, t, d) {
  const q = regular(p, r, d >= 3 ? 12 : 8);
  solid(face, q, b, t, 'trim');
  if (d >= 2) {
    solid(face, rect(p, r * 2.8, r * 2.8), b - 0.1, b + 0.2, 'trim');
    profile(
      face,
      rect(p, r * 2, r * 2),
      [
        [t - 0.05, 1],
        [t + 0.28, 1.7],
        [t + 0.43, 1.7],
      ],
      'trim',
    );
  }
}
const H = rec.heights,
  main = rec.main.polygons[0],
  body = main.outline,
  west = -19.55,
  churchCore = rect([-3.165, 0.15], 32.77, 9.3),
  baptCenter = [-38.85, -0.27],
  baptRing = Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    return [baptCenter[0] + 5.2 * Math.cos(a), baptCenter[1] + 5 * Math.sin(a)];
  }),
  court = rec.compound.polygons[0].holes[0],
  atrialRing = rect([-29.925, 0.25], 20.95, 19.1);
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
  depth = 1.2,
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
export const euphrasianPortal = () =>
  hole(
    'western-recessed-portal',
    [west, 0.15],
    [0, 1],
    [-1, 0],
    2.3,
    0.05,
    3.6,
    2.45,
    'round',
    2.4,
  );
export function euphrasianWindows(d = 3) {
  const a = [];
  for (const z of [-2.8, 0.15, 3.1])
    a.push(
      hole(
        `west-upper-window-${z}`,
        [west, z],
        [0, 1],
        [-1, 0],
        1.7,
        10.1,
        2.8,
        1.95,
        'round',
        1.3,
      ),
    );
  for (const side of [-1, 1])
    for (const x of d === 1 ? [-14, -4, 6] : [-16, -12, -8, -4, 0, 4, 8])
      a.push(
        hole(
          `clerestory-${side}-${x}`,
          [x, side < 0 ? -4.5 : 4.8],
          [1, 0],
          [0, side],
          1.25,
          10.35,
          2.55,
          1.92,
          'round',
          1.3,
        ),
      );
  return a;
}
export function euphrasianBelfry() {
  const r = ring(rec.tower.polygons[0].outline, 0),
    a = [];
  for (let i = 0; i < r.length; i++) {
    const f = faceFrame(r, i);
    if (f.length < 7) continue;
    for (const t of [0.32, 0.68])
      a.push(
        hole(
          `belfry-${i}-${t}`,
          lerp(f.a, f.b, t),
          f.axis,
          f.normal,
          2.25,
          28.75,
          3.5,
          2.35,
          'round',
          3.5,
        ),
      );
  }
  return a;
}
export function euphrasianArcades() {
  const out = [],
    n = 4;
  for (let i = 0; i < n; i++) {
    const f = faceFrame(court, i);
    for (const t of [1 / 6, 0.5, 5 / 6])
      out.push(
        hole(
          `atrium-arcade-${i}-${t}`,
          lerp(f.a, f.b, t),
          f.axis,
          f.normal,
          Math.min(1.75, f.length / 3 - 0.3),
          0.15,
          3.5,
          2.45,
          'round',
          1.4,
        ),
      );
  }
  return out;
}
function window(face, h, d, actual = false) {
  pane(face, h, d, actual ? -0.24 : 0.035);
  if (d >= 2) {
    archBand(face, h, d, 0.13, 'trim', 0.04);
    if (d >= 3) {
      const p = prepareOpening(h, 0, d);
      const n = [-p.axis[1], p.axis[0]],
        offset = 0.025 * Math.sign(dot2(n, h.normal));
      beam(
        face,
        p.point(0, h.bottom + 0.1, offset),
        p.point(0, h.bottom + h.height - 0.13, offset),
        0.055,
        'door',
      );
      if (h.height > 2.4)
        beam(
          face,
          p.point(-h.width / 2 + 0.08, h.bottom + 1.05, offset),
          p.point(h.width / 2 - 0.08, h.bottom + 1.05, offset),
          0.055,
          'door',
        );
    }
  }
}
function apse(face, d) {
  const r = clip(body, [1, 0], 13.17, true),
    p = [13.2, 0.15];
  sides(face, r, 0, H.apseEave, 'plaster');
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if (a[0] < 13.3 && b[0] < 13.3) continue;
    face('stone', [at(a, H.apseEave), at(b, H.apseEave), at(p, H.apseTop)], [0, 1, 0]);
  }
  if (d)
    for (let i = 0; i < r.length; i++) {
      const f = faceFrame(r, i);
      if (f.normal[0] < 0.2 || f.length < 2.2) continue;
      window(
        face,
        hole(`apse-window-${i}`, lerp(f.a, f.b, 0.5), f.axis, f.normal, 1.35, 5, 4.7, 3.9, 'round'),
        d,
      );
      if (d >= 2) band(face, [f.a, f.b], H.apseEave - 0.3, 0.25, 'trim', 1);
    }
}
function church(out, face, d) {
  const windows = euphrasianWindows(d),
    portal = euphrasianPortal(),
    r = ring(body, d),
    low = clip(r, [1, 0], 13.25, false);
  sides(face, r, footing, 0, 'foundation');
  cap(face, r, 0, 'foundation');
  shell(out, d, low, 0, H.aisleEave, d ? [portal] : [], 'plaster');
  for (const side of [-1, 1]) {
    const r = clip(low, [0, 1], side < 0 ? -4.5 : 4.8, side > 0);
    if (r.length >= 3) {
      const y = (p) =>
        H.aisleHigh -
        (H.aisleHigh - H.aisleEave) * Math.min(1, Math.abs(p[1] - (side < 0 ? -4.5 : 4.8)) / 4.6);
      cap(face, r, (p) => floor + y(p), 'roof');
    }
  }
  shell(out, d, churchCore, H.aisleEave, H.naveEave, d >= 2 ? [...windows] : [], 'plaster');
  roof(face, churchCore, [1, 0], H.naveEave, H.naveRidge);
  apse(face, d);
  if (d) {
    for (const h of windows) window(face, h, d, d >= 2);
    pane(face, portal, d, -0.95, 'door');
    archBand(face, portal, d, 0.32, 'trim', 0.08);
    for (const side of [-1, 1])
      for (const x of [-16, -12, -8, -4, 0, 4, 8])
        window(
          face,
          hole(
            'aisle-window',
            [x, side < 0 ? -9.3 : 9.27],
            [1, 0],
            [0, side],
            0.9,
            3.9,
            2.5,
            1.8,
            'round',
          ),
          d,
        );
    // Broad colored mosaic fields suggest the west front without copying figures or tesserae.
    const tint = (h) => {
      const v = h.match(/../g).map((n) => parseInt(n, 16) / 255);
      return v.map((x) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)));
    };
    for (const [y0, y1, col] of [
      [9.15, 9.45, 'be9a66'],
      [9.45, 9.8, '536b78'],
      [12.95, 13.15, 'be9a66'],
    ])
      face(
        'trim',
        [
          [west - 0.05, floor + y0, -4.4],
          [west - 0.05, floor + y1, -4.4],
          [west - 0.05, floor + y1, 4.65],
          [west - 0.05, floor + y0, 4.65],
        ],
        [-1, 0, 0],
        tint(col),
      );
    if (d >= 2)
      for (const z of [-4, -1.4, 1.55, 4.35])
        for (let j = 0; j < 3; j++) {
          const w = 0.17,
            z0 = z + (j - 1) * 0.24;
          face(
            'trim',
            [
              [west - 0.06, floor + 10, z0 - w / 2],
              [west - 0.06, floor + 12.7, z0 - w / 2],
              [west - 0.06, floor + 12.7, z0 + w / 2],
              [west - 0.06, floor + 10, z0 + w / 2],
            ],
            [-1, 0, 0],
            tint(j === 1 ? 'aa6f4e' : 'b59869'),
          );
        }
  }
  if (d >= 2) {
    band(face, churchCore, H.naveEave - 0.2, 0.22, 'trim', 1.012);
    for (const x of [-19.55, 13.22])
      beam(face, [x, floor + H.naveEave, -4.65], [x, floor + H.naveRidge, 0.15], 0.16, 'trim');
    beam(
      face,
      [-19.55, floor + H.naveRidge, 0.15],
      [13.22, floor + H.naveRidge, 0.15],
      0.18,
      'roof',
    );
  }
}
function tower(out, face, d) {
  const r = ring(rec.tower.polygons[0].outline, d),
    p = center(r),
    inset = r.map((q) => q.map((v, k) => p[k] + (v - p[k]) * 0.73));
  sides(face, r, footing, 0, 'foundation');
  shell(
    out,
    d,
    r,
    0,
    H.towerBelfry,
    d >= 2 ? euphrasianBelfry() : [],
    'stone',
    d >= 2 ? inset : null,
  );
  cap(face, r, H.towerShaft, 'stone');
  if (d === 1) for (const h of euphrasianBelfry()) pane(face, h, d, 0.035, 'glass');
  profile(
    face,
    r,
    [
      [H.towerBelfry, 1.025],
      [H.towerBelfry + 0.3, 1.08],
      [H.towerBelfry + 0.5, 1.08],
    ],
    'trim',
  );
  const rr = rect(p, 7.8, 7.8);
  for (let i = 0; i < 4; i++)
    face(
      'stone',
      [at(rr[i], H.towerBelfry + 0.5), at(rr[(i + 1) % 4], H.towerBelfry + 0.5), at(p, H.towerTop)],
      [0, 1, 0],
    );
  if (d) {
    band(face, r, H.towerShaft, 0.22, 'trim', 1.025);
    for (const z of [7, 17, 24]) {
      const f = faceFrame(r, 0);
      window(face, hole('tower-slit', lerp(f.a, f.b, 0.5), f.axis, f.normal, 0.42, z, 1.2), d);
    }
  }
  if (d >= 2) {
    for (const h of euphrasianBelfry()) archBand(face, h, d, 0.18, 'trim', 0.05);
    beam(face, at(p, H.towerTop - 0.1), at(p, H.crossTop - 0.08), 0.1, 'door');
    beam(
      face,
      [p[0] - 0.3, floor + H.crossTop - 0.4, p[1]],
      [p[0] + 0.3, floor + H.crossTop - 0.4, p[1]],
      0.09,
      'door',
    );
  }
}
function baptistery(face, d) {
  solid(face, baptRing, footing, H.baptisteryEave, 'plaster');
  profile(
    face,
    baptRing,
    [
      [H.baptisteryEave, 1.04],
      [H.baptisteryTop, 0],
    ],
    'roof',
  );
  if (d) {
    for (let i = 0; i < 8; i++) {
      const f = faceFrame(baptRing, i);
      window(
        face,
        hole(
          `baptistery-window-${i}`,
          lerp(f.a, f.b, 0.5),
          f.axis,
          f.normal,
          0.85,
          4.9,
          2.6,
          1.9,
          'round',
        ),
        d,
      );
    }
    band(face, baptRing, H.baptisteryEave - 0.25, 0.2, 'trim', 1.015);
  }
}
function atrium(out, face, d) {
  const r = atrialRing,
    inner = court;
  sides(face, r, footing, 0, 'foundation');
  cap(face, r, 0, 'foundation', [inner]);
  cap(face, inner, 0, 'stone');
  // Open court and actual inner arcade wall ribbons; covered galleries remain open behind them.
  for (let i = 0; i < 4; i++) {
    const f = faceFrame(inner, i),
      a = f.a,
      b = f.b,
      n = f.normal,
      w = 0.5,
      r = [a, b, b.map((v, k) => v + n[k] * w), a.map((v, k) => v + n[k] * w)];
    if (d) {
      shell(
        out,
        d,
        r,
        0,
        H.atriumEave,
        euphrasianArcades().filter((h) => h.name.startsWith(`atrium-arcade-${i}-`)),
        'stone',
      );
      cap(face, r, H.atriumEave, 'stone');
    } else sides(face, r, 0, H.atriumEave, 'stone');
    if (d >= 2)
      for (const t of [0, 1 / 3, 2 / 3])
        roundColumn(
          face,
          lerp(a, b, t).map((v, k) => v + n[k] * 0.24),
          0.19,
          0.2,
          2.52,
          d,
        );
  }
  // Roof opening follows the exact map court, with all four gallery roofs sloping inward.
  const h = [inner[1], inner[2], inner[3], inner[0]];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    face(
      'roof',
      [
        at(r[i], H.atriumRoof),
        at(r[j], H.atriumRoof),
        at(h[j], H.atriumEave),
        at(h[i], H.atriumEave),
      ],
      [0, 1, 0],
    );
  }
  // Western/southern outside wall, with the northern palace connection left attached.
  const p = rect([-37.0, 9.55], 6.8, 0.45);
  solid(face, p, 0, H.atriumRoof, 'plaster');
}
function palace(face, d) {
  // Preserve mapped connecting galleries between the taller palace ranges and atrium.
  for (const p of rec.connections) {
    const r = ring(p.outline, d);
    sides(face, r, footing, 0, 'foundation');
    sides(face, r, 0, H.atriumEave, 'plaster');
    cap(face, r, H.atriumRoof, 'roof', p.holes);
    sides(face, r, H.atriumEave, H.atriumRoof, 'plaster');
  }
  for (const range of rec.ranges)
    for (const poly of range.polygons) {
      const r = ring(poly.outline, d);
      sides(face, r, footing, 0, 'foundation');
      sides(face, r, 0, range.eave, 'plaster');
      roof(face, r, range.axis, range.eave, range.ridge);
      if (d)
        for (let i = 0; i < r.length; i++) {
          const f = faceFrame(r, i);
          if (f.length < 5) continue;
          const n = Math.floor(f.length / 4);
          for (let j = 0; j < n; j++)
            for (const y of [2.5, 6])
              window(
                face,
                hole('palace-window', lerp(f.a, f.b, (j + 0.5) / n), f.axis, f.normal, 0.9, y, 1.6),
                d,
              );
        }
    }
  for (const [i, b] of rec.chapels.entries()) {
    const r = ring(b.polygons[0].outline, d),
      eave = i ? 6.3 : 7.2,
      top = i ? 8.6 : 9.4;
    sides(face, r, footing, 0, 'foundation');
    sides(face, r, 0, eave, 'plaster');
    if (i) {
      profile(
        face,
        r,
        [
          [eave, 1],
          [top, 0],
        ],
        'roof',
      );
    } else roof(face, r, [1, 0], eave, top);
    if (d)
      for (let j = 0; j < r.length; j++) {
        const f = faceFrame(r, j);
        if (f.length > 3)
          window(face, hole('chapel-window', lerp(f.a, f.b, 0.5), f.axis, f.normal, 0.85, 3, 2), d);
      }
  }
}
function build(out, d) {
  // Aperture clipping can leave submillimeter wedges that collapse at Float32 precision.
  const stable = {
    addTriangle(slot, ref, points, normal, uv, color) {
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
      out.addTriangle(slot, ref, p, normal, uv, color);
    },
  };
  const face = writer(stable, d);
  church(stable, face, d);
  atrium(stable, face, d);
  baptistery(face, d);
  palace(face, d);
  tower(stable, face, d);
}
export const buildEuphrasianSkyline = (o) => build(o, 0),
  buildEuphrasianDistrict = (o) => build(o, 1),
  buildEuphrasianStreet = (o) => build(o, 2),
  buildEuphrasianCloseup = (o) => build(o, 3);
export const euphrasianStudy = {
  id: 'N0341',
  key: 'euphrasian_basilica',
  title: 'Euphrasian Basilica',
  category: 'cathedral',
  wikidataId: 'Q645105',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => build(o, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Euphrasian Basilica complex: raised red-tiled nave/clerestory and lower aisles,polygonal east apse,west triple windows/selected mosaic bands,open atrium arcades/courtyard,octagonal baptistery,separate square bifora belfry/steep stone spire and northern episcopal ranges/chapels.',
  sourceFacts: {
    horizontalBasis:
      'Exact-QID way298139426 and seven current PMTiles controls with original courtyard hole; signed east apse versus western tower.',
    architecturalHeights: rec.heightBasis,
  },
  reconstruction: rec,
  scaleBasis:
    'Approximately39x19m main church within mapped northern/western complex. All vertical dimensions,octagonal baptistery plan and roof roles are picture-led estimates.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; mapped controls ©OpenStreetMap contributors,ODbL-1.0. Linked photographs not redistributed.',
  dataAttribution: '©OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing256-square raw/weathered limestone,plaster,tile and wood graphs shared across seven roles; selected mosaic bands use linear vertex tints in the common stone material. Metric UVs,flat glass,no embedded images.',
  importReason:
    'Four authored levels retain main nave/apse,western tower/baptistery and actual open atrium at signed Porec location.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    rec.heightBasis,
    scope.geographicNote,
    'Octagonal baptistery inferred within the mapped rectangular joining envelope. Arcade piers,windows,selected mosaic bands/capitals,roofs and palace range roles approximate. Exact mosaic figures/tesserae,sculpture,full interiors,excavations,seawall/town and certified walking excluded. Physical phone/laptop timings pending.',
    'Skyline retains compound/atrium void,coarse nave/apse,baptistery and closed belfry/mean roofs. District adds textures,flat windows,mosaic bands,recessed closed door and actual atrium arches. Street adds actual belfry/clerestory apertures,columns,selected roof bands and cross. Closeup refines capitals/window frames and arch segmentation; detail changes remain visible.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'nave-apse-and-northern-ranges',
      position: [70, 38, -61],
      lookAt: [-4, 10, -9],
      fov: 43,
    },
    {
      name: 'western-atrial-facade-and-mosaic-bands',
      position: [-31, 6.4, 0.1],
      lookAt: [-19.55, 9, 0.1],
      fov: 63,
    },
    {
      name: 'open-atrium-arcades-and-baptistery',
      position: [-33, 19, 24],
      lookAt: [-29, 3, -0.2],
      fov: 48,
    },
    {
      name: 'bifora-belfry-and-stone-spire',
      position: [-79, 49, 29],
      lookAt: [-48, 33, -1],
      fov: 43,
    },
    { name: 'polygonal-apse-and-side-aisle', position: [46, 22, 23], lookAt: [9, 9, 0], fov: 43 },
    { name: 'northern-episcopal-palace', position: [-75, 29, -74], lookAt: [-39, 8, -28], fov: 43 },
  ],
};

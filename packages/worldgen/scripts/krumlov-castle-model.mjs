/** Český Krumlov: courtyard plans, decorated tower, theater and stacked Cloak Bridge. */
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
  '../../../content/worldgen/source/places/u2/u2d/n0321_cesky_krumlov_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const palette = {
  plaster: '#e3d4b7',
  accent: '#c68979',
  stone: '#bfb28c',
  paving: '#b4ada0',
  tile: '#b47758',
  slate: '#69737b',
  copper: '#758a7b',
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
const parts = frame.reconstruction.components;
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const unit = (v) => {
  const n = Math.hypot(...v);
  return v.map((x) => x / n);
};
const center = (r) =>
  [0, 1].map((k) => (Math.min(...r.map((p) => p[k])) + Math.max(...r.map((p) => p[k]))) / 2);
const area = (r) =>
  Math.abs(
    r.reduce((n, a, i) => {
      const b = r[(i + 1) % r.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0),
  ) / 2;
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
const circle = (p, r, n) =>
  Array.from({ length: n }, (_, i) => [
    p[0] + Math.cos((i * 2 * Math.PI) / n) * r,
    p[1] + Math.sin((i * 2 * Math.PI) / n) * r,
  ]);
export function krumlovGround(x, z) {
  const c = Math.cos(frame.heading),
    s = Math.sin(frame.heading);
  [x, z] = [x * c + z * s, -x * s + z * c];
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Krumlov footing outside retained DEM');
  const i = Math.floor(u),
    j = Math.floor(v),
    a = u - i,
    b = v - j,
    k = j * g.width + i,
    h = g.heights;
  return (
    (h[k] * (1 - a) + h[k + 1] * a) * (1 - b) +
    (h[k + g.width] * (1 - a) + h[k + g.width + 1] * a) * b -
    fit.datumMeters
  );
}
function writer(out, d) {
  return (slot, polygon, direction) => {
    let p = polygon.map((v) => v.map(Math.fround));
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
function simplify(r, tol) {
  if (!tol) return r;
  const p = [...r];
  for (let pass = 0; pass < 3; pass++)
    for (let i = 0; i < p.length && p.length > 4; i++) {
      const a = p[(i + p.length - 1) % p.length],
        b = p[i],
        q = p[(i + 1) % p.length];
      const dx = q[0] - a[0],
        dz = q[1] - a[1],
        length = Math.hypot(dx, dz);
      const along = length ? ((b[0] - a[0]) * dx + (b[1] - a[1]) * dz) / (length * length) : 0;
      const distance = length ? Math.abs((b[0] - a[0]) * dz - (b[1] - a[1]) * dx) / length : 0;
      if (distance <= tol && along >= 0 && along <= 1) {
        p.splice(i, 1);
        i--;
      }
    }
  return p;
}
function triangles(r, holes = []) {
  const p = [...r, ...holes.flat()],
    starts = [];
  let offset = r.length;
  for (const h of holes) {
    starts.push(offset);
    offset += h.length;
  }
  const ids = earcut(p.flat(), starts, 2),
    out = [];
  for (let i = 0; i < ids.length; i += 3) out.push(ids.slice(i, i + 3).map((k) => p[k]));
  return out;
}
function cap(face, r, y, slot, holes = []) {
  for (const t of triangles(r, holes))
    face(
      slot,
      t.map((p) => at(p, y)),
      [0, 1, 0],
    );
}
function sides(face, r, b, t, slot, inward = false) {
  const sign =
    Math.sign(
      r.reduce((n, a, i) => {
        const q = r[(i + 1) % r.length];
        return n + a[0] * q[1] - q[0] * a[1];
      }, 0),
    ) * (inward ? -1 : 1);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      q = r[(i + 1) % r.length];
    face(
      slot,
      [at(a, b), at(q, b), at(q, t), at(a, t)],
      [(q[1] - a[1]) * sign, 0, (a[0] - q[0]) * sign],
    );
  }
}
function solid(face, r, b, t, slot) {
  sides(face, r, b, t, slot);
  cap(face, r, t, slot);
}
function clip(r, axis, value, positive = true) {
  if (!r.length) return [];
  const f = (p) => (p[0] * axis[0] + p[1] * axis[1] - value) * (positive ? 1 : -1),
    out = [];
  let a = r.at(-1),
    av = f(a);
  for (const b of r) {
    const bv = f(b);
    if (av >= 0 !== bv >= 0) out.push(lerp(a, b, av / (av - bv)));
    if (bv >= 0) out.push(b);
    a = b;
    av = bv;
  }
  return out;
}
function roof(face, r, holes, eave, profile, axis, slot) {
  for (const t of triangles(r, holes))
    for (let j = 1; j < profile.length; j++) {
      let p = t;
      const [a, ya] = profile[j - 1],
        [b, yb] = profile[j];
      if (Number.isFinite(a)) p = clip(p, axis, a);
      if (p.length && Number.isFinite(b)) p = clip(p, axis, b, false);
      if (p.length < 3) continue;
      const y = (q) =>
        eave +
        (!Number.isFinite(a)
          ? yb
          : !Number.isFinite(b)
            ? ya
            : ya + ((yb - ya) * (q[0] * axis[0] + q[1] * axis[1] - a)) / (b - a));
      cap(face, p, y, slot);
    }
}
function pitched(face, r, holes, eave, rise, slot) {
  let longest = 0,
    axis = [1, 0];
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      v = b.map((x, k) => x - a[k]),
      len = Math.hypot(...v);
    if (len > longest) {
      longest = len;
      const u = unit(v);
      axis = [-u[1], u[0]];
    }
  }
  const vals = r.map((p) => p[0] * axis[0] + p[1] * axis[1]),
    a = Math.min(...vals),
    b = Math.max(...vals),
    m = (a + b) / 2;
  roof(
    face,
    r,
    holes,
    eave,
    [
      [-Infinity, 0],
      [a, 0],
      [m, rise],
      [b, 0],
      [Infinity, 0],
    ],
    axis,
    slot,
  );
}
function band(face, a, b, w, y, slot, depth = 0) {
  const u = unit(b.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    r = [
      a.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v - (n[k] * w) / 2),
      b.map((v, k) => v + (n[k] * w) / 2),
      a.map((v, k) => v + (n[k] * w) / 2),
    ];
  if (depth) solid(face, r, (p) => (typeof y === 'function' ? y(p) : y) - depth, y, slot);
  else cap(face, r, y, slot);
}
function window(face, d, a, b, u, y, w, h, slot = 'glass', arched = false) {
  const v = unit(b.map((q, k) => q - a[k])),
    n = [v[1], -v[0]],
    m = lerp(a, b, u),
    shape = openingShape(
      { shape: arched ? 'round' : 'rectangle', width: w, height: h, spring: h * 0.7, bottom: y },
      d,
    ),
    point = (p, o) => [m[0] + v[0] * p[0] + n[0] * o, p[1], m[1] + v[1] * p[0] + n[1] * o];
  face(
    slot,
    shape.map((p) => point(p, 0.12)),
    [n[0], 0, n[1]],
  );
  if (d >= 2) {
    const rim = shape.map((p) => [(p[0] * (w + 1.4)) / w, y - 0.7 + ((p[1] - y) * (h + 1.4)) / h]);
    for (let i = 0; i < shape.length; i++) {
      const k = (i + 1) % shape.length;
      face(
        'plaster',
        [point(shape[i], 0.15), point(shape[k], 0.15), point(rim[k], 0.15), point(rim[i], 0.15)],
        [n[0], 0, n[1]],
      );
    }
  }
}
function facade(face, d, r, base, height, rows) {
  if (!d) return;
  let p = r;
  if (
    p.reduce((n, a, i) => {
      const b = p[(i + 1) % p.length];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0) < 0
  )
    p = p.toReversed();
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length],
      len = Math.hypot(...b.map((v, k) => v - a[k]));
    if (len < 5) continue;
    const count = Math.max(1, Math.floor(len / (d === 1 ? 9 : 5.8)));
    for (let j = 0; j < count; j++)
      for (let k = 0; k < rows; k++)
        window(
          face,
          d,
          a,
          b,
          (j + 0.5) / count,
          base + 2.0 + (k * (height - 4)) / Math.max(1, rows - 1),
          1.7,
          2.4,
        );
  }
}
function foundations(face, r, floor) {
  sides(face, r, (p) => Math.min(floor - 0.3, krumlovGround(...p) - 0.3), floor, 'stone');
}
function footprintBox(r) {
  let length = 0,
    u = [1, 0];
  for (let i = 0; i < r.length; i++) {
    const v = r[(i + 1) % r.length].map((x, k) => x - r[i][k]),
      n = Math.hypot(...v);
    if (n > length) {
      length = n;
      u = unit(v);
    }
  }
  const v = [-u[1], u[0]],
    p = r.map((p) => [p[0] * u[0] + p[1] * u[1], p[0] * v[0] + p[1] * v[1]]);
  const a = Math.min(...p.map((p) => p[0])),
    b = Math.max(...p.map((p) => p[0])),
    c = Math.min(...p.map((p) => p[1])),
    d = Math.max(...p.map((p) => p[1]));
  return [
    [a, c],
    [b, c],
    [b, d],
    [a, d],
  ].map((p) => [p[0] * u[0] + p[1] * v[0], p[0] * u[1] + p[1] * v[1]]);
}
function range(face, d, f) {
  const original = f.polygons[0],
    r =
      d === 0 && f.role === 'service-range' && !original.holes.length
        ? footprintBox(original.outline)
        : simplify(original.outline, d === 0 ? 2.8 : d === 1 ? 0.55 : 0),
    holes = original.holes.map((h) => simplify(h, d === 0 ? 1 : 0.1)),
    m = center(r),
    floor = f.role === 'upper-palace' ? 3 : m[0] < -135 ? 15 : 0;
  const height = f.properties.height ?? (area(r) > 180 ? 11 : 7),
    rise = Math.min(4.3, height * 0.3),
    eave = floor + height - rise,
    slot = f.role === 'theatre' ? 'slate' : 'tile';
  if (f.role === 'upper-palace') foundations(face, r, floor);
  sides(face, r, floor, eave, 'plaster');
  for (const h of holes) sides(face, h, floor, eave, 'plaster', true);
  if (f.role === 'upper-palace')
    roof(
      face,
      r,
      holes,
      eave,
      [
        [-Infinity, 0],
        [-55, 0],
        [-46, rise],
        [-37, 0],
        [-26, 0],
        [-17, rise],
        [-10, 0],
        [Infinity, 0],
      ],
      [0, 1],
      slot,
    );
  else if (f.role === 'theatre') {
    const west = clip(r, [1, 0], -178, false),
      east = clip(r, [1, 0], -178);
    if (west.length >= 3)
      roof(
        face,
        west,
        [],
        eave,
        [
          [-Infinity, 0],
          [-203, 0],
          [-191, rise],
          [-178, 0],
          [Infinity, 0],
        ],
        [1, 0],
        slot,
      );
    if (east.length >= 3)
      roof(
        face,
        east,
        [],
        eave,
        [
          [-Infinity, 0],
          [-53, 0],
          [-42, rise],
          [-30, 0],
          [Infinity, 0],
        ],
        [0, 1],
        slot,
      );
  } else pitched(face, r, holes, eave, rise, slot);
  facade(
    face,
    d,
    r,
    floor,
    Math.max(5, height - rise),
    height > 17 ? 3 : d === 1 ? 1 : height > 8 ? 2 : 1,
  );
  if (d >= 2)
    for (const h of holes)
      facade(face, d, h.toReversed(), floor, height - rise, height > 17 ? 3 : 1);
  if (d >= 2 && area(r) > 150) {
    const pos = r[Math.floor(r.length / 3)],
      q = lerp(pos, m, 0.2);
    solid(face, rect(...q, 1.5, 1.5), eave + rise * 0.4, eave + rise + 1.4, 'plaster');
  }
}
function platforms(face, d) {
  // Clip the two independent terraces before simplifying; the bridge neck stays open.
  const lower = simplify(clip(frame.geometry.outline, [1, 0], 26), d === 0 ? 6 : d === 1 ? 2 : 0.2),
    west = simplify(
      clip(frame.geometry.outline, [1, 0], -137, false),
      d === 0 ? 6 : d === 1 ? 2 : 0.2,
    );
  for (const [r, y] of [
    [lower, 0],
    [west, 15],
  ]) {
    foundations(face, r, y);
    cap(face, r, y + 0.08, 'paving');
  }
  const upper = parts.find((f) => f.role === 'upper-palace').polygons[0];
  for (const h of upper.holes) cap(face, h, 3.07, 'paving');
  const hradek = parts.find((f) => f.role === 'hradek').polygons[0];
  for (const h of hradek.holes) cap(face, h, 0.07, 'paving');
  if (d >= 1) {
    band(face, [30, -2], [88, 18], 4.2, 0.11, 'paving');
    band(face, [88, 18], [156, 0], 4.2, 0.11, 'paving');
  }
}
function cylinder(face, p, r, b, t, n, slot) {
  solid(face, circle(p, r, n), b, t, slot);
}
function lathe(face, p, profile, n, slot) {
  for (let j = 1; j < profile.length; j++) {
    const [ra, ya] = profile[j - 1],
      [rb, yb] = profile[j];
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n,
        b = ((i + 1) * 2 * Math.PI) / n;
      face(
        slot,
        [
          [p[0] + ra * Math.cos(a), ya, p[1] + ra * Math.sin(a)],
          [p[0] + ra * Math.cos(b), ya, p[1] + ra * Math.sin(b)],
          [p[0] + rb * Math.cos(b), yb, p[1] + rb * Math.sin(b)],
          [p[0] + rb * Math.cos(a), yb, p[1] + rb * Math.sin(a)],
        ],
        [Math.cos((a + b) / 2), 0.25, Math.sin((a + b) / 2)],
      );
    }
  }
}
export const krumlovGalleryOpenings = [];
function tower(out, d) {
  const face = writer(out, d),
    { center: p, radius: r, height } = frame.reconstruction.tower,
    n = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 16 : 24;
  const main = circle(p, r, n);
  if (d >= 2) foundations(face, main, 0);
  cylinder(face, p, r, 0, 15.5, n, 'stone');
  cylinder(face, p, r, 15.5, 31, n, 'accent');
  if (d >= 2) {
    for (let row = 0; row < 8; row++)
      for (let i = 0; i < n; i++) {
        const a = ((i + (row % 2) * 0.5) * 2 * Math.PI) / n,
          b = a + Math.PI / n;
        face(
          row % 2 ? 'plaster' : 'stone',
          [
            [p[0] + (r + 0.04) * Math.cos(a), row * 1.9 + 0.2, p[1] + (r + 0.04) * Math.sin(a)],
            [p[0] + (r + 0.04) * Math.cos(b), row * 1.9 + 0.2, p[1] + (r + 0.04) * Math.sin(b)],
            [p[0] + (r + 0.04) * Math.cos(b), row * 1.9 + 1.4, p[1] + (r + 0.04) * Math.sin(b)],
            [p[0] + (r + 0.04) * Math.cos(a), row * 1.9 + 1.4, p[1] + (r + 0.04) * Math.sin(a)],
          ],
          [Math.cos((a + b) / 2), 0, Math.sin((a + b) / 2)],
        );
      }
    for (let i = 0; i < n; i += 2) {
      const a = (i * 2 * Math.PI) / n,
        u = [Math.cos(a), Math.sin(a)],
        v = [-u[1], u[0]],
        m = p.map((q, k) => q + u[k] * (r + 0.09));
      const strip = [m.map((q, k) => q - v[k] * 0.43), m.map((q, k) => q + v[k] * 0.43)];
      face(
        'plaster',
        [at(strip[0], 16), at(strip[1], 16), at(strip[1], 30.5), at(strip[0], 30.5)],
        [u[0], 0, u[1]],
      );
    }
  }
  cylinder(face, p, r + 0.25, 30.8, 32, n, 'plaster');
  const gn = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 12 : 16,
    outer = circle(p, 6.5, gn),
    inner = circle(p, 5.5, gn);
  cap(face, outer, 32, 'plaster', [inner]);
  for (let i = 0; i < gn; i++) {
    const a = outer[i],
      b = outer[(i + 1) % gn],
      m = lerp(a, b, 0.5),
      axis = unit(b.map((v, k) => v - a[k])),
      len = Math.hypot(...b.map((v, k) => v - a[k]));
    const hole = {
      name: `tower-gallery-${i}`,
      center: m,
      axis,
      width: Math.max(1.4, len - 1.15),
      height: 3.85,
      spring: 2.6,
      bottom: 32.2,
      depth: 3,
      shape: 'round',
    };
    const face2 = writer(openingBuilder(out, d ? [prepareOpening(hole, 0, d)] : []), d),
      panel = [a, b, inner[(i + 1) % gn], inner[i]];
    if (d === 1) {
      solid(face, rect(...a, 1.15, 1.15), 32, 36.6, 'plaster');
      const normal = unit(m.map((v, k) => v - p[k]));
      const arc = openingShape(hole, 1).slice(2);
      const point = (q, offset) => [
        m[0] + axis[0] * q[0] + normal[0] * offset,
        q[1],
        m[1] + axis[1] * q[0] + normal[1] * offset,
      ];
      for (let j = 1; j < arc.length; j++) {
        const aa = arc[j - 1],
          bb = arc[j];
        for (const offset of [0, -0.8])
          face(
            'plaster',
            [
              point(aa, offset),
              point(bb, offset),
              point([bb[0], 36.6], offset),
              point([aa[0], 36.6], offset),
            ],
            [normal[0] * (offset ? -1 : 1), 0, normal[1] * (offset ? -1 : 1)],
          );
        face('plaster', [point(aa, 0), point(bb, 0), point(bb, -0.8), point(aa, -0.8)], [0, -1, 0]);
      }
    } else if (d >= 2) {
      sides(face2, panel, 32, 36.6, 'plaster');
      const target = {
        addTriangle(slot, ref, p, n, uv, c) {
          out.addTriangle(slot === 'rubble' ? 'plaster' : slot, ref, p, n, uv, c);
        },
      };
      openingReveals(
        target,
        panel,
        () => 32,
        () => 36.6,
        [prepareOpening(hole, 0, d)],
        colors.plaster,
      );
    } else {
      solid(face, rect(...a, 1.2, 1.2), 32, 36.6, 'plaster');
    }
    if (d >= 3 && !krumlovGalleryOpenings.some((h) => h.name === hole.name))
      krumlovGalleryOpenings.push(hole);
  }
  cylinder(face, p, 3.5, 32, 36.6, n, 'accent');
  lathe(
    face,
    p,
    [
      [7, 36.6],
      [6.4, 37.8],
      [5.2, 39.6],
      [4.65, 40.5],
    ],
    n,
    'copper',
  );
  cylinder(face, p, 4.65, 40.5, 43.4, n, 'plaster');
  if (d >= 1)
    for (let i = 0; i < n; i += d === 1 ? 3 : 2) {
      const a = (i * 2 * Math.PI) / n,
        u = [Math.cos(a), Math.sin(a)],
        v = [-u[1], u[0]],
        m = p.map((q, k) => q + u[k] * 4.7);
      window(
        face,
        d,
        m.map((q, k) => q - v[k]),
        m.map((q, k) => q + v[k]),
        0.5,
        41.2,
        0.9,
        1.3,
      );
    }
  lathe(
    face,
    p,
    [
      [5.2, 43.4],
      [4.7, 44.5],
      [3.6, 46.3],
      [2.2, 48.8],
    ],
    n,
    'copper',
  );
  cylinder(face, p, 2.2, 48.8, 49.3, n, 'plaster');
  if (d === 0) cylinder(face, p, 2, 49.3, 52.1, 4, 'accent');
  else
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        q = [p[0] + 1.7 * Math.cos(a), p[1] + 1.7 * Math.sin(a)];
      solid(face, rect(...q, 0.85, 0.85), 49.3, 52.1, 'accent');
    }
  lathe(
    face,
    p,
    [
      [2.65, 52.1],
      [1.8, 53],
      [0.35, height],
    ],
    n,
    'copper',
  );
}
export const krumlovBridgeOpenings = [];
function bridge(out, d) {
  const face = writer(out, d),
    b = frame.reconstruction.bridges[0],
    [a, z] = b.centerline,
    u = unit(z.map((v, k) => v - a[k])),
    n = [-u[1], u[0]],
    length = Math.hypot(...z.map((v, k) => v - a[k]));
  const count = 4,
    walk = b.walkY;
  for (let i = 0; i <= count; i++) {
    const p = lerp(a, z, i / count),
      w = i === 0 || i === count ? 2.6 : 2.2,
      r = [
        p.map((q, k) => q - (u[k] * w) / 2 - n[k] * 3.2),
        p.map((q, k) => q + (u[k] * w) / 2 - n[k] * 3.2),
        p.map((q, k) => q + (u[k] * w) / 2 + n[k] * 3.2),
        p.map((q, k) => q - (u[k] * w) / 2 + n[k] * 3.2),
      ];
    solid(
      face,
      r,
      (q) => Math.min(walk - 1, krumlovGround(...q) - 0.3),
      b.coveredFloors[0],
      'plaster',
    );
  }
  if (d >= 1)
    for (let i = 0; i < count; i++) {
      const x = lerp(a, z, i / count),
        y = lerp(a, z, (i + 1) / count),
        m = lerp(x, y, 0.5),
        bottom = Math.min(5, Math.max(-2, krumlovGround(...m))),
        hole = {
          name: `cloak-arch-${i}`,
          center: m,
          axis: u,
          width: length / count - 2.3,
          height: walk - bottom - 0.7,
          spring: Math.max(1, walk - bottom - 4.6),
          bottom,
          depth: 9,
          shape: 'round',
        },
        h = prepareOpening(hole, 0, d),
        f = writer(openingBuilder(out, [h]), d);
      for (const side of [-1, 1]) {
        const p = x.map((q, k) => q + n[k] * side * 3.2),
          q = y.map((v, k) => v + n[k] * side * 3.2),
          r = [
            p,
            q,
            q.map((v, k) => v - n[k] * side * 0.8),
            p.map((v, k) => v - n[k] * side * 0.8),
          ];
        sides(f, r, (v) => Math.min(bottom - 0.4, krumlovGround(...v) - 0.3), walk, 'plaster');
        const target = {
          addTriangle(slot, ref, p, n, uv, c) {
            out.addTriangle(slot === 'rubble' ? 'plaster' : slot, ref, p, n, uv, c);
          },
        };
        openingReveals(
          target,
          r,
          () => bottom - 0.4,
          () => walk,
          [h],
          colors.plaster,
        );
      }
      if (d >= 3 && !krumlovBridgeOpenings.some((h) => h.name === hole.name))
        krumlovBridgeOpenings.push(hole);
    }
  band(face, a, z, b.width, walk, 'paving', 0.9);
  for (const side of [-1, 1])
    band(
      face,
      a.map((v, k) => v + n[k] * side * 3.05),
      z.map((v, k) => v + n[k] * side * 3.05),
      0.65,
      walk + 1.15,
      'plaster',
      1.15,
    );
  for (const floor of b.coveredFloors) {
    band(face, a, z, b.width, floor + 4.15, 'plaster', 4.15);
    if (d >= 1)
      for (const side of [-1, 1]) {
        const aa = side > 0 ? z : a,
          zz = side > 0 ? a : z,
          pa = aa.map((v, k) => v + n[k] * side * 3.24),
          pz = zz.map((v, k) => v + n[k] * side * 3.24);
        for (let i = 0; i < 8; i++) window(face, d, pa, pz, (i + 0.5) / 8, floor + 1.0, 1.35, 1.85);
      }
  }
  band(face, a, z, b.width, b.coveredFloors[1], 'plaster', 0.85);
  const r = [
    a.map((v, k) => v - n[k] * 3.3),
    z.map((v, k) => v - n[k] * 3.3),
    z.map((v, k) => v + n[k] * 3.3),
    a.map((v, k) => v + n[k] * 3.3),
  ];
  pitched(face, r, [], b.roofY - 1.65, 1.65, 'slate');
}
function westernGallery(face, d, f) {
  const r = simplify(f.polygons[0].outline, d === 0 ? 0.7 : 0.1),
    m = center(r);
  sides(face, r, 22, 25.1, 'plaster');
  pitched(face, r, [], 25.1, 1.7, 'slate');
  if (d >= 1) facade(face, d, r, 22, 4, 1);
  const a = r[0],
    b = r[1];
  for (let i = 0; i < 4; i++) {
    const p = lerp(a, b, (i + 0.1) / 3.2);
    solid(
      face,
      rect(...p, 1.4, 2.2),
      (q) => Math.min(21, krumlovGround(...q) - 0.2),
      22,
      'plaster',
    );
  }
  void m;
}
function build(out, d) {
  const face = writer(out, d);
  platforms(face, d);
  for (const f of parts) {
    if (f.role === 'tower') continue;
    if (f.role === 'western-gallery') {
      westernGallery(face, d, f);
      continue;
    }
    const p = f.polygons[0],
      size = area(p.outline);
    if (d === 0 && f.role === 'service-range' && size < 250) continue;
    range(face, d, f);
  }
  tower(out, d);
  bridge(out, d);
}
export const buildKrumlovSkyline = (out) => build(out, 0);
export const buildKrumlovDistrict = (out) => build(out, 1);
export const buildKrumlovStreet = (out) => build(out, 2);
export const buildKrumlovCloseup = (out) => build(out, 3);
export const krumlovStudy = {
  id: 'N0321',
  key: 'cesky_krumlov_castle',
  title: 'Český Krumlov Castle',
  category: 'castle',
  wikidataId: 'Q2164919',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Individual ridge castle: open double-courtyard upper palace, lower Hradek and54.5m decorated round tower with a real open arcade, flared copper roofs/lantern, mapped service ranges, western theater/elevated gallery and stacked arched Cloak Bridge. Shared pale plaster, salmon accents and red ceramic roofs.',
  sourceFacts: {
    horizontalBasis:
      'Retained exact-QID enclosure, selected current PMTiles component polygons with courtyard holes and named Cloak Bridge path. Nearby town buildings and overlapping building-part overlays are excluded.',
    architecturalHeights:
      'Mapped overall54.5m tower,23m upper palace,11m theater and5–14m selected ranges retained. Untagged heights, court levels, arch/roof/window profiles and bridge stories are picture-led estimates.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Actual selected plans and signed tower/theater locations establish approximate compound scale and facing; all courtyard holes remain open.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures.map((p) => p.page),
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license; map controls © OpenStreetMap contributors, ODbL-1.0. Linked photographs are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five existing256-square shared graphs provide lime plaster, weathered limestone, ceramic tile, slate and painted metal. Linear palette tints and metric UVs; no unique photograph/bitmap. Sparse colored bands approximate the tower decoration.',
  importReason:
    'Preserve decorated tower/open gallery, connected red-roofed courtyard palace and stacked Cloak Bridge in independently authored browser levels.',
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Selected current PMTiles polygons guide approximate compound fit; overlapping building-part overlays and nearby town polygons are excluded. Heights with tags are retained; untagged ranges and facade/window/roof profiles are exterior estimates.',
    'Standard viewer DEM supplies a working497.6021m anchor datum. Upper/lower/theater court levels, foundations and bridge story/arch/approach joins are estimates; no bare-earth survey, terrain carving or navigable collision guarantee.',
    'Tower decoration uses a sparse shared-material/palette rhythm rather than exact painted frescoes. Gallery arches are real openings; detailed stairs, rooms, museum exhibits, gardens, trees and neighboring village are excluded.',
    'The western elevated gallery is mapped outside the main enclosure; its support and roof profile are approximate. Cloak Bridge path fixes its axis; theater-end continuation and stacked corridors are photo-led.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: scope.camera,
  qaCameras: [
    {
      name: 'decorated-tower-and-open-gallery',
      position: [138, 44, 112],
      lookAt: [81.7, 31, 59],
      fov: 43,
    },
    {
      name: 'upper-palace-and-two-courtyards',
      position: [-42, 91, 78],
      lookAt: [-35, 17, -33],
      fov: 43,
    },
    {
      name: 'cloak-bridge-arches-and-corridors',
      position: [-119, 18, 33],
      lookAt: [-115, 12, -35],
      fov: 43,
    },
    {
      name: 'theater-and-western-gallery',
      position: [-263, 60, 45],
      lookAt: [-187, 24, -30],
      fov: 43,
    },
    {
      name: 'lower-castle-and-first-court',
      position: [227, 65, 118],
      lookAt: [123, 7, 0],
      fov: 43,
    },
    {
      name: 'whole-castle-and-courtyard-plan',
      position: [-25, 375, 0.1],
      lookAt: [-25, 0, 0],
      fov: 49,
    },
  ],
};

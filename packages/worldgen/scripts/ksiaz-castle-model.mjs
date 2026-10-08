/** Książ castle core:domed main tower,twin west spires,pink Baroque wing and terraces. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';

const root = '../../../content/worldgen/source/places/u3/u35/n0291_ksiaz_castle_and_park_complex/';
const read = (n) => JSON.parse(readFileSync(new URL(root + n, import.meta.url)));
const frame = read('map-frame.json'),
  refs = read('reference-metadata.json'),
  c = frame.controls;
export const ksiazPalette = {
  stone: '#c9b392',
  wall: '#dec4a4',
  pink: '#dda799',
  trim: '#eee5cd',
  roof: '#b3684c',
  wood: '#967556',
  recess: '#4d6178',
  paving: '#aaa59a',
  grass: '#8aa065',
  bronze: '#877966',
  clock: '#e6d3ab',
};
const colors = Object.fromEntries(
  Object.entries(ksiazPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const s = parseInt(v, 16) / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      }),
  ]),
);
function face(o, p, col = 'wall', slot = 'sandstone', target) {
  p = p.map((v) => v.map(Math.fround));
  if (target && normalFor(...p.slice(0, 3)).reduce((s, v, i) => s + v * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    const a = Math.abs(n[1]) > 0.7 ? 1 : Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => (a === 1 ? [v[0], v[2]] : a === 0 ? [v[2], v[1]] : [v[0], v[1]])),
      colors[col],
    );
  }
}
function box(o, x, y, z, w, h, depth, col = 'stone', slot = 'sandstone') {
  const a = x - w / 2,
    b = x + w / 2,
    u = z - depth / 2,
    v = z + depth / 2,
    t = y + h;
  for (const [p, n] of [
    [
      [
        [a, y, v],
        [b, y, v],
        [b, t, v],
        [a, t, v],
      ],
      [0, 0, 1],
    ],
    [
      [
        [b, y, u],
        [a, y, u],
        [a, t, u],
        [b, t, u],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, u],
        [a, y, v],
        [a, t, v],
        [a, t, u],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, v],
        [b, y, u],
        [b, t, u],
        [b, t, v],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, t, u],
        [b, t, u],
        [b, t, v],
        [a, t, v],
      ],
      [0, 1, 0],
    ],
  ])
    face(o, p, col, slot, n);
}
function local(o, center, y = 0, a = 0) {
  const rot = ([x, h, z]) => [
    Math.cos(a) * x + Math.sin(a) * z,
    h,
    -Math.sin(a) * x + Math.cos(a) * z,
  ];
  return Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, uv, col) =>
        o[k](
          s,
          r,
          p.map((v) => {
            const q = rot(v);
            return [q[0] + center[0], q[1] + y, q[2] + center[1]];
          }),
          rot(n),
          uv,
          col,
        ),
    ]),
  );
}
function lineFrame(o, a, b, y = 0) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  return {
    length: Math.hypot(dx, dz),
    q: local(o, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], y, -Math.atan2(dz, dx)),
  };
}
function polygon(o, loop, y, col, slot = 'sandstone') {
  const ix = earcut(loop.flat());
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [loop[k][0], y, loop[k][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function rings(o, center, levels, n, col = 'stone', slot = 'sandstone', phase = 0, cap = true) {
  const circle = ([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = phase + (i * Math.PI * 2) / n;
      return [center[0] + Math.cos(a) * r, y, center[1] + Math.sin(a) * r];
    });
  for (let j = 1; j < levels.length; j++) {
    const a = circle(levels[j - 1]),
      b = circle(levels[j]);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n,
        p = [a[i], a[k], b[k], b[i]],
        target = [(a[i][0] + a[k][0]) / 2 - center[0], 0, (a[i][2] + a[k][2]) / 2 - center[1]];
      face(o, p, col, slot, target);
    }
  }
  if (cap) {
    const r = circle(levels.at(-1));
    polygon(
      o,
      r.map((p) => [p[0], p[2]]),
      r[0][1],
      col,
      slot,
    );
  }
}
/** A real opening: pier masses, spandrels and soffits leave the arch empty. */
function arcade(
  o,
  length,
  depth,
  bottom,
  top,
  bays,
  span,
  spring,
  rise,
  d,
  col = 'stone',
  slot = 'sandstone',
  pointed = false,
) {
  const pitch = length / bays,
    pier = pitch - span;
  box(o, -length / 2 + pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  box(o, length / 2 - pier / 4, bottom, 0, pier / 2, top - bottom, depth, col, slot);
  for (let i = 1; i < bays; i++)
    box(o, -length / 2 + i * pitch, bottom, 0, pier, top - bottom, depth, col, slot);
  for (let j = 0; j < bays; j++) {
    const mid = -length / 2 + (j + 0.5) * pitch,
      steps = d >= 2 ? 6 : 4;
    const curve = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const half = span / 2,
        radius = (half * half + rise * rise) / (2 * half),
        offset = Math.min(t, 1 - t) * span - radius;
      return [
        mid + (t - 0.5) * span,
        spring +
          (pointed
            ? Math.sqrt(Math.max(0, radius * radius - offset * offset))
            : rise * Math.sin(Math.PI * t)),
      ];
    });
    for (let i = 0; i < steps; i++) {
      const a = curve[i],
        b = curve[i + 1];
      for (const s of [-1, 1])
        face(
          o,
          [
            [a[0], a[1], (s * depth) / 2],
            [b[0], b[1], (s * depth) / 2],
            [b[0], top, (s * depth) / 2],
            [a[0], top, (s * depth) / 2],
          ],
          col,
          slot,
          [0, 0, s],
        );
      face(
        o,
        [
          [a[0], a[1], -depth / 2],
          [b[0], b[1], -depth / 2],
          [b[0], b[1], depth / 2],
          [a[0], a[1], depth / 2],
        ],
        col,
        slot,
        [0, -1, 0],
      );
    }
  }
  face(
    o,
    [
      [-length / 2, top, -depth / 2],
      [length / 2, top, -depth / 2],
      [length / 2, top, depth / 2],
      [-length / 2, top, depth / 2],
    ],
    col,
    slot,
    [0, 1, 0],
  );
}
function pane(o, x, y, z, w, h, d, pointed = false, outward) {
  const p = pointed
    ? [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h * 0.65, z],
        [x, y + h, z],
        [x - w / 2, y + h * 0.65, z],
      ]
    : [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x + w / 2, y + h, z],
        [x - w / 2, y + h, z],
      ];
  face(o, p, 'recess', 'glass', [0, 0, outward ?? (z < 0 ? -1 : 1)]);
  if (d >= 3) {
    box(o, x, y - 0.3, z, w + 0.6, 0.3, 0.3, 'trim');
    if (!pointed) box(o, x, y + h, z, w + 0.6, 0.3, 0.3, 'trim');
    box(o, x, y, z, 0.3, h, 0.3, 'trim');
  }
}

function hip(o, x, y, z, length, depth, rise, col = 'roof', slot = 'tile', pyramid = false) {
  const a = x - length / 2,
    b = x + length / 2,
    u = z - depth / 2,
    v = z + depth / 2;
  const inset = pyramid ? length / 2 : Math.min(depth / 2, length * 0.28),
    r0 = [a + inset, y + rise, z],
    r1 = [b - inset, y + rise, z];
  for (const p of [
    [[a, y, u], [b, y, u], r1, r0],
    [[b, y, v], [a, y, v], r0, r1],
    [[a, y, v], [a, y, u], r0],
    [[b, y, u], [b, y, v], r1],
  ])
    face(o, p, col, slot, [0, 1, 0]);
}
function winding(loop) {
  return Math.sign(
    loop.reduce((s, p, i) => {
      const q = loop[(i + 1) % loop.length];
      return s + p[0] * q[1] - q[0] * p[1];
    }, 0),
  );
}
// Remove only small plan deviations at far levels; the master retains all mapped vertices.
function simple(loop, tolerance) {
  const out = loop.map((p) => [...p]);
  for (let pass = 0; pass < 4; pass++) {
    let removed = false;
    for (let i = out.length - 1; i >= 0 && out.length > 4; i--) {
      const p = out[i],
        a = out[(i + out.length - 1) % out.length],
        b = out[(i + 1) % out.length],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        l2 = dx * dx + dz * dz;
      const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
      if (Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz) < tolerance) {
        out.splice(i, 1);
        removed = true;
      }
    }
    if (!removed) break;
  }
  return out;
}
const outer = frame.geometry.outline.slice(0, -1),
  courts = frame.geometry.holes.map((h) => h.slice(0, -1));
const flatMeans = read('surface-means.json');
function cap(o, ring, holes, y, col = 'wall', slot = 'sandstone') {
  const points = [...ring, ...holes.flat()],
    starts = holes.map((_, i) => ring.length + holes.slice(0, i).reduce((n, h) => n + h.length, 0));
  const ix = earcut(points.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix.slice(i, i + 3).map((k) => [points[k][0], y, points[k][1]]),
      col,
      slot,
      [0, 1, 0],
    );
}
function wallRing(o, loop, inner, d) {
  const sign = winding(loop) * (inner ? -1 : 1);
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i],
      b = loop[(i + 1) % loop.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 0.1) continue;
    const pink = (a[0] + b[0]) / 2 > 22,
      slot = pink ? 'plaster' : 'sandstone',
      col = pink ? 'pink' : 'wall',
      low = c.courtY;
    face(
      o,
      [
        [a[0], low, a[1]],
        [b[0], low, b[1]],
        [b[0], 33, b[1]],
        [a[0], 33, a[1]],
      ],
      col,
      slot,
      [(sign * dz) / length, 0, (-sign * dx) / length],
    );
    if (d === 0 || length < 4 || (a[0] + b[0]) / 2 > 48) continue;
    const { q } = lineFrame(o, a, b),
      z = -sign * 0.08,
      count = Math.max(1, Math.floor(length / (d === 1 ? 9 : 4.8)));
    for (let j = 0; j < count; j++)
      for (const y of d === 1 ? [22] : [15, 22, 28]) {
        const x = ((j + 0.5) * length) / count - length / 2;
        pane(q, x, y, z, pink ? 1.5 : 1.3, y === 28 ? 2.8 : 3.2, 0, false, -sign);
        if (d >= 2) {
          box(q, x, y - 0.35, z, 2, 0.35, 0.3, 'trim', 'plaster');
          if (pink && d === 3) {
            box(q, x - 1, 14, z, 0.45, 18, 0.35, 'trim', 'plaster');
            box(q, x + 1, 14, z, 0.45, 18, 0.35, 'trim', 'plaster');
          }
        }
      }
    if (d >= 2) box(q, 0, 32, z, length, 0.6, 0.5, 'trim', 'plaster');
  }
}
function onion(o, center, base, top, r, d, waist = 0.04) {
  const h = top - base,
    n = d === 0 ? 6 : d === 1 ? 8 : 12;
  const levels =
    d === 0
      ? [
          [base, r],
          [base + h * 0.5, r * 0.7],
          [top, r * waist],
        ]
      : [
          [base, r],
          [base + h * 0.22, r * 1.05],
          [base + h * 0.5, r * 0.7],
          [base + h * 0.78, r * Math.max(0.3, waist)],
          [top, r * waist],
        ];
  rings(o, center, levels, n, 'bronze', 'bronze', 0, false);
}
function mainTower(o, d) {
  const t = c.mainTower,
    p = t.center,
    q = local(o, p);
  box(q, 0, t.base, 0, t.width, 23, t.depth, 'stone', 'sandstone');
  hip(q, 0, 36, 0, 11.8, 12.8, 3, 'roof', 'tile', true);
  rings(
    o,
    p,
    [
      [38.3, 5.1],
      [44, 5.1],
    ],
    d === 0 ? 6 : 8,
    'stone',
    'sandstone',
    Math.PI / 8,
  );
  onion(o, p, 44, 51.5, 5.2, d, 2 / 5.2);
  rings(
    o,
    p,
    [
      [51.5, 2.0],
      [55.2, 2.0],
    ],
    d === 0 ? 6 : 8,
    'stone',
    'sandstone',
    Math.PI / 8,
  );
  onion(o, p, 55.2, 59.5, 2.1, d);
  rings(
    o,
    p,
    [
      [59.5, 0.25],
      [60, 0.08],
    ],
    6,
    'bronze',
    'bronze',
    0,
    false,
  );
  if (d >= 1) {
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const v = local(o, p, 0, a);
      const r = a === 0 || a === Math.PI ? t.depth / 2 : t.width / 2;
      for (const y of d === 1 ? [28] : [17, 24, 31]) pane(v, 0, y, r + 0.07, 1.2, 2.2, 0, false, 1);
      face(
        v,
        [
          [-1, 40.2, 5.15],
          [1, 40.2, 5.15],
          [1, 42.2, 5.15],
          [-1, 42.2, 5.15],
        ],
        'clock',
        'plaster',
        [0, 0, 1],
      );
      pane(v, 0, 52, 2.04, 0.9, 2.4, 0, false, 1);
      if (d >= 2) {
        box(v, 0, 40.45, 5.22, 0.28, 1.4, 0.12, 'wood', 'wood');
        box(v, 0.35, 41.2, 5.23, 1, 0.28, 0.12, 'wood', 'wood');
      }
    }
  }
}
function roofTowers(o, d) {
  for (const t of c.westTowers) {
    const n = d === 0 ? 6 : d === 1 ? 8 : 16,
      p = t.center,
      r = t.radius;
    rings(
      o,
      p,
      [
        [2, r],
        [33, r],
      ],
      n,
      'stone',
      'sandstone',
    );
    rings(
      o,
      p,
      [
        [33, r * 1.16],
        [45, r * 0.22],
      ],
      n,
      'roof',
      'tile',
    );
    onion(o, p, 45, 49.5, r * 0.26, d);
    rings(
      o,
      p,
      [
        [49.5, 0.2],
        [50, 0.04],
      ],
      6,
      'bronze',
      'bronze',
      0,
      false,
    );
    if (d >= 1)
      for (let i = 0; i < (d === 1 ? 4 : 8); i++) {
        const a = (i * Math.PI * 2) / (d === 1 ? 4 : 8),
          q = local(o, p, 0, a);
        for (const y of d === 1 ? [23] : [7, 15, 23, 29])
          pane(q, 0, y, r + 0.08, 1.2, 2.7, 0, false, 1);
        if (d >= 2) box(q, 0, 32, r, 2.1, 0.7, 0.6, 'trim', 'plaster');
      }
  }
  const t = c.powderTower;
  rings(
    o,
    t.center,
    [
      [13, t.radius],
      [31, t.radius],
    ],
    d === 0 ? 6 : 8,
    'stone',
    'sandstone',
  );
  rings(
    o,
    t.center,
    [
      [31, t.radius * 1.1],
      [t.top, 0.05],
    ],
    d === 0 ? 6 : 8,
    'roof',
    'tile',
  );
  const e = c.eastTurret;
  rings(
    o,
    e.center,
    [
      [13, e.radius],
      [34, e.radius],
    ],
    d === 0 ? 6 : 12,
    'stone',
    'sandstone',
  );
  rings(
    o,
    e.center,
    [
      [34, e.radius * 1.1],
      [40, 0.65],
    ],
    d === 0 ? 6 : 12,
    'roof',
    'tile',
  );
  onion(o, e.center, 40, 43, 0.8, d);
}
// A closed west risalit replaces the inward-facing, roof-occluded triangle.
// Its stepped profile and projecting bay are photo interpretations, not surveyed details.
function westGable(o, d) {
  const q = local(o, [-47.15, -8], 0, -Math.PI / 2);
  box(q, 0, 0, -2.5, 12, 13, 5.3, 'stone', 'sandstone');
  box(q, 0, 13, -2.5, 12, 19.8, 5.3, 'wall', 'sandstone');
  const profile = [
    [-6, 32],
    [6, 32],
    [6, 33.5],
    [5.2, 33.5],
    [5.2, 35],
    [4.5, 35],
    [3.2, 38],
    [1.4, 40.2],
    [0, 41],
    [-1.4, 40.2],
    [-3.2, 38],
    [-4.5, 35],
    [-5.2, 35],
    [-5.2, 33.5],
    [-6, 33.5],
  ];
  const ix = earcut(profile.flat());
  for (const z of [0.15, -5.15])
    for (let i = 0; i < ix.length; i += 3)
      face(
        q,
        ix.slice(i, i + 3).map((k) => [profile[k][0], profile[k][1], z]),
        'wall',
        'sandstone',
        [0, 0, z > 0 ? 1 : -1],
      );
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i],
      b = profile[(i + 1) % profile.length];
    face(
      q,
      [
        [a[0], a[1], 0.15],
        [b[0], b[1], 0.15],
        [b[0], b[1], -5.15],
        [a[0], a[1], -5.15],
      ],
      'roof',
      'tile',
      [b[1] - a[1], a[0] - b[0], 0],
    );
  }
  if (d === 0) return;
  for (const y of [13, 21.5, 27.6, 32.5]) box(q, 0, y, 0.28, 12.2, 0.4, 0.35, 'pink', 'plaster');
  for (const y of d === 1 ? [22, 28] : [15, 22, 28])
    for (const x of [-3.6, 0, 3.6]) pane(q, x, y, 0.22, 1.5, 2.5, 0, false, 1);
  if (d >= 2) {
    for (const x of [-2.5, 2.5]) pane(q, x, 34.3, 0.22, 1.3, 2.1, 0, false, 1);
    pane(q, 0, 37.8, 0.22, 1.1, 1.6, 0, false, 1);
    for (const x of [-5.5, 5.5]) box(q, x, 13, 0.3, 0.45, 19.5, 0.4, 'pink', 'plaster');
  }
}
// Compose the upper envelope of planar hips before emitting the roof.
// Convex clipping removes overlaps and follows the mapped outline/court voids.
function roofInfill(o, ring, holes, d) {
  const epsilon = 1e-7;
  function clip(poly, signed) {
    const result = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i],
        b = poly[(i + 1) % poly.length],
        da = signed(a),
        db = signed(b);
      if (da >= -epsilon) result.push(a);
      if ((da > epsilon && db < -epsilon) || (da < -epsilon && db > epsilon)) {
        const t = da / (da - db);
        result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    return result;
  }
  function lines(poly) {
    const sign = winding(poly);
    return poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length];
      return (p) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
    });
  }
  function intersection(poly, cut) {
    for (const line of lines(cut)) poly = clip(poly, line);
    return poly;
  }
  function subtract(poly, cut) {
    const result = [];
    let inside = poly;
    for (const line of lines(cut)) {
      const outside = clip(inside, (p) => -line(p));
      if (outside.length >= 3) result.push(outside);
      inside = clip(inside, line);
      if (inside.length < 3) break;
    }
    return result;
  }
  function area(poly) {
    return (
      Math.abs(
        poly.reduce((n, a, i) => {
          const b = poly[(i + 1) % poly.length];
          return n + a[0] * b[1] - b[0] * a[1];
        }, 0),
      ) / 2
    );
  }
  const surfaces = [];
  function surface(vertices) {
    const [a, b, c] = vertices,
      n = normalFor(a, b, c);
    if (Math.abs(n[1]) < epsilon) return;
    const height = (p) => a[1] - (n[0] * (p[0] - a[0]) + n[2] * (p[1] - a[2])) / n[1],
      poly = vertices.map((p) => [p[0], p[2]]);
    if (area(poly) > epsilon) surfaces.push({ poly, height });
  }
  const capture = { addTriangle: (_s, _r, p) => surface(p) };
  for (const [x, z, w, depth, rise, angle] of d === 0
    ? c.roofPatches.filter((_, i) => [0, 1, 2, 4, 8].includes(i))
    : c.roofPatches)
    hip(local(capture, [x, z], 0, angle), 0, 33, 0, w, depth, rise, 'roof', 'tile');
  const points = [...ring, ...holes.flat()],
    starts = holes.map((_, i) => ring.length + holes.slice(0, i).reduce((n, h) => n + h.length, 0)),
    ix = earcut(points.flat(), starts),
    plan = [];
  for (let i = 0; i < ix.length; i += 3) plan.push(ix.slice(i, i + 3).map((k) => points[k]));
  // The low tile plane closes tiny deviations in the mapped footprint.
  for (const poly of plan) surfaces.push({ poly, height: () => 33 });
  for (let i = 0; i < surfaces.length; i++) {
    const current = surfaces[i];
    let pieces = [current.poly];
    for (let j = 0; j < surfaces.length && pieces.length; j++) {
      if (i === j) continue;
      const other = surfaces[j],
        delta = (p) => other.height(p) - current.height(p) - (j < i ? -epsilon : epsilon),
        cut = clip(other.poly, delta);
      if (cut.length < 3 || area(cut) < epsilon) continue;
      pieces = pieces.flatMap((p) => {
        if (area(intersection(p, cut)) < epsilon) return [p];
        return subtract(p, cut).filter((v) => area(v) > epsilon);
      });
    }
    for (const piece of pieces)
      for (const triangle of plan) {
        const p = intersection(piece, triangle);
        if (p.length < 3 || area(p) < epsilon) continue;
        face(
          o,
          p.map((v) => [v[0], current.height(v), v[1]]),
          'roof',
          'tile',
          [0, 1, 0],
        );
        // Small clipped eave walls are below skyline resolution.
        if (d === 0) continue;
        // Close clipped eaves against the body, including the two courtyard sides.
        for (let k = 0; k < p.length; k++) {
          const a = p[k],
            b = p[(k + 1) % p.length];
          for (const loop of [ring, ...holes])
            for (let m = 0; m < loop.length; m++) {
              const u = loop[m],
                v = loop[(m + 1) % loop.length],
                dx = v[0] - u[0],
                dz = v[1] - u[1],
                l2 = dx * dx + dz * dz;
              if (l2 < epsilon) continue;
              const on = (q) =>
                Math.abs(dx * (q[1] - u[1]) - dz * (q[0] - u[0])) / Math.sqrt(l2) < 1e-5 &&
                (q[0] - u[0]) * dx + (q[1] - u[1]) * dz >= -epsilon &&
                (q[0] - u[0]) * dx + (q[1] - u[1]) * dz <= l2 + epsilon;
              if (
                !on(a) ||
                !on(b) ||
                Math.max(current.height(a), current.height(b)) <= 33 + epsilon
              )
                continue;
              const sign = winding(loop) * (holes.includes(loop) ? -1 : 1),
                pink = (a[0] + b[0]) / 2 > 22;
              face(
                o,
                [
                  [a[0], 33, a[1]],
                  [b[0], 33, b[1]],
                  [b[0], current.height(b), b[1]],
                  [a[0], current.height(a), a[1]],
                ],
                pink ? 'pink' : 'wall',
                pink ? 'plaster' : 'sandstone',
                [sign * dz, 0, -sign * dx],
              );
            }
        }
      }
  }
}
function roofRanges(o, d) {
  if (d >= 1) {
    // Broad dormers stay on the north/west pitches,clear of both court voids.
    for (const x of d === 1 ? [-29, -12] : [-31, -20, -9]) {
      const q = local(o, [x, -24]);
      box(q, 0, 34.5, 0, 3.2, 2.8, 2.7, 'wall', 'plaster');
      hip(q, 0, 37.3, 0, 3.6, 3, 1.8, 'roof', 'tile');
      pane(q, 0, 35.2, -1.42, 1.4, 1.6, 0, false, -1);
    }
    if (d >= 2) {
      // Attach short merged gallery bays to each mapped facade segment.
      const sign = winding(outer);
      for (let i = 0; i < outer.length; i++) {
        const a = outer[i],
          b = outer[(i + 1) % outer.length];
        if (Math.min(a[0], b[0]) < -20 || Math.max(a[0], b[0]) > 15 || Math.min(a[1], b[1]) < 19)
          continue;
        const { q: gallery, length } = lineFrame(o, a, b);
        if (length < 3) continue;
        box(gallery, 0, 27, -sign * 0.5, length, 5, 0.8, 'trim', 'plaster');
        for (const y of [27, 31.6])
          box(gallery, 0, y, -sign * 0.96, length, 0.4, 0.35, 'wood', 'wood');
        const count = Math.max(1, Math.floor(length / 3.8));
        for (let j = 0; j < count; j++) {
          const x = -length / 2 + ((j + 0.5) * length) / count;
          pane(
            gallery,
            x,
            28,
            -sign * 1.02,
            Math.min(2.4, length / count - 0.6),
            2.6,
            0,
            false,
            -sign,
          );
          box(gallery, x - length / count / 2, 27, -sign * 0.96, 0.4, 5, 0.35, 'wood', 'wood');
        }
      }
    }
  }
  if (d >= 2)
    for (const p of [
      [-33, -17],
      [-21, 21],
      [5, 24],
      [37, -3],
    ]) {
      box(o, p[0], 38, p[1], 1.6, 3.4, 1.5, 'stone', 'sandstone');
      box(o, p[0], 41.4, p[1], 2, 0.4, 1.9, 'trim', 'plaster');
    }
}
function hallFront(o, d) {
  if (d === 0) return;
  const q = local(o, [49.2, 9.8], 0, Math.PI / 2);
  // Three signature tall hall windows on the projecting Baroque east front.
  for (const x of [-4.4, 0, 4.4]) {
    const steps = d >= 2 ? 6 : 4,
      curve = Array.from({ length: steps + 1 }, (_, i) => [
        x - 1.65 + (i * 3.3) / steps,
        29 + 1.65 * Math.sin((i * Math.PI) / steps),
        0.08,
      ]);
    face(
      q,
      [[x - 1.65, 21, 0.08], [x + 1.65, 21, 0.08], ...curve.reverse()],
      'recess',
      'glass',
      [0, 0, 1],
    );
    if (d >= 2) {
      for (const a of [-2, 2]) box(q, x + a, 20, 0.2, 0.5, 12.5, 0.5, 'trim', 'plaster');
      box(q, x, 20.4, 0.2, 4.5, 0.5, 0.5, 'trim', 'plaster');
      box(q, x, 27.5, 0.22, 3.2, 0.35, 0.25, 'trim', 'plaster');
    }
  }
  if (d >= 1) {
    box(q, 0, 32, 0.2, 15, 0.7, 0.5, 'trim', 'plaster');
    box(q, 0, 13, 0.2, 15, 1, 0.5, 'stone', 'sandstone');
  }
}
function stair(o, center, width, depth, y0, y1, angle = 0, d = 3) {
  const q = local(o, center, 0, angle),
    n = d < 2 ? 2 : 5;
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * (i + 1)) / n;
    box(
      q,
      0,
      y0,
      ((i + 0.5) * depth) / n - depth / 2,
      width,
      y - y0,
      depth / n + 0.04,
      'paving',
      'sandstone',
    );
  }
}
function gardens(o, d) {
  const all = [...c.terraces.south, ...c.terraces.west, ...c.terraces.north];
  for (const t of all) {
    const [x, z] = t.center;
    box(o, x, 0, z, t.width, t.y + 0.15, t.depth, 'stone', 'sandstone');
    face(
      o,
      [
        [x - t.width / 2 + 0.7, t.y + 0.17, z - t.depth / 2 + 0.7],
        [x + t.width / 2 - 0.7, t.y + 0.17, z - t.depth / 2 + 0.7],
        [x + t.width / 2 - 0.7, t.y + 0.17, z + t.depth / 2 - 0.7],
        [x - t.width / 2 + 0.7, t.y + 0.17, z + t.depth / 2 - 0.7],
      ],
      'grass',
      'foliage',
      [0, 1, 0],
    );
    if (d >= 1) {
      box(o, x, t.y + 0.2, z, t.width - 1, 0.08, 1.5, 'paving', 'sandstone');
      box(o, x, t.y + 0.2, z, 1.5, 0.08, t.depth - 1, 'paving', 'sandstone');
    }
  }
  if (d >= 1) {
    for (const [z, y0, y1] of [
      [40, 10, 13],
      [50, 6, 10],
      [60, 2, 6],
    ])
      stair(o, [-17, z], 4.5, 4, y0, y1, 0, d);
    // Water-terrace fountain rhythm is merged basins;no spray/individual jets.
    const fountainCount = d === 1 ? 3 : 9;
    for (let i = 0; i < fountainCount; i++) {
      const x = -39 + (i % 3) * 20,
        z = 43 + Math.floor(i / 3) * 2.2;
      rings(
        o,
        [x, z],
        [
          [10.22, 1.35],
          [10.55, 1.35],
        ],
        d === 1 ? 6 : 8,
        'trim',
        'sandstone',
      );
      polygon(
        o,
        Array.from({ length: 8 }, (_, j) => [
          x + Math.cos((j * Math.PI) / 4) * 1.05,
          z + Math.sin((j * Math.PI) / 4) * 1.05,
        ]),
        10.58,
        'recess',
        'glass',
      );
    }
    for (const p of c.terraces.pavilions) {
      box(o, p[0], 2, p[1], 5.5, 5.5, 5.5, 'wall', 'plaster');
      hip(o, p[0], 7.5, p[1], 6.4, 6.4, 3.2, 'roof', 'tile', true);
      if (d >= 2)
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5])
          pane(local(o, p, 0, a), 0, 3, 2.8, 1.6, 2.8, 0, false, 1);
    }
    if (d >= 2) {
      const q = local(o, [-8, 31], 0, 0);
      arcade(q, 28, 3, 2, 12.8, 3, 6.5, 7, 3.1, d, 'stone', 'sandstone');
    }
  }
  // Courtyard floors share a physical13m attachment plane;no upper cap closes them.
  for (const court of courts) polygon(o, court, 13.05, 'paving', 'sandstone');
}
function build(o, d) {
  const ring = d < 2 ? simple(outer, d === 0 ? 3.5 : 0.35) : outer,
    holes = courts.map((h) => (d < 2 ? simple(h, d === 0 ? 0.4 : 0.1) : h));
  wallRing(o, ring, false, d);
  for (const h of holes) wallRing(o, h, true, d);
  roofInfill(o, ring, holes, d);
  cap(o, ring, holes, 13);
  // Original rock/retaining proxy seats the raised castle on its declared attachment.
  const sign = winding(ring);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz);
    if (length < 0.1) continue;
    face(
      o,
      [
        [a[0], 0, a[1]],
        [b[0], 0, b[1]],
        [b[0], 13, b[1]],
        [a[0], 13, a[1]],
      ],
      'stone',
      'sandstone',
      [(sign * dz) / length, 0, (-sign * dx) / length],
    );
  }
  polygon(o, ring, 13, 'stone', 'sandstone');
  gardens(o, d);
  roofRanges(o, d);
  westGable(o, d);
  roofTowers(o, d);
  mainTower(o, d);
  hallFront(o, d);
}
export const buildKsiazRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildKsiazSkyline = (o) =>
  build(
    Object.fromEntries(
      ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
        k,
        (s, r, p, n, uv, col) =>
          o[k](
            'silhouette',
            r,
            p,
            n,
            uv,
            col.map((v, i) => v * (flatMeans[s]?.[i] ?? 1)),
          ),
      ]),
    ),
    0,
  );
export const ksiazStudy = {
  id: 'N0291',
  key: 'ksiaz_castle_and_park_complex',
  title: 'Książ Castle and park complex',
  previewImage: 'shots/shared/angle-0.png',
  category: 'castle',
  wikidataId: 'Q738109',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (o) => buildKsiazRuntime(o),
  brief:
    'Castle/terrace core:coral-pink Baroque entrance wing,tall domed central lantern tower,paired western steep red roof towers,buff neoRenaissance stone ranges,open courts,half-timber gallery and stepped gardens. Wider heritage ensemble remains incomplete.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: ksiazPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: flatMeans,
    materialBudget: 7,
    identityFeatures: [
      'Tall square/octagonal main tower with onion dome and lantern',
      'Paired western steep red roof towers with bronze finials',
      'Pink Baroque eastwing above stone garden terraces',
    ],
  },
  sourceFacts: {
    mapIdentity: 'relation/9821066 exactQ738109',
    mappedCastleEnvelopeMeters: [98.17, 61.243],
    operatorMainTowerLocalHeightMeters: 47,
    publishedOriginalTowerPlanMeters: [10.5, 11.5],
    measuredCommonDatumAvailable: false,
    maximumModelY: 60,
    siteCoverage:
      'Castle and approximate terrace core only;full site scope pending in site-parts.json',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Exact cached castle/court rings;operator47m main tower and academic original10.5×11.5m tower plan. Other height/roof/site controls are original estimates.',
  refs: refs.references.map((r) => r.url),
  sourceDocuments: [
    'map-frame.json',
    'reference-metadata.json',
    'surface-means.json',
    'site-parts.json',
  ],
  nativeAxes: frame.nativeAxes,
  sourceNotice:
    'Mapped castle/court rings reproduce attributed OSM data underODbL. Other geometry is original approximate authoring. Research photographs/maps remain private evidence;no downloaded geometry or unique textures embedded.',
  sourceLicense:
    'Original geometry under repository license. Mapped rings © OpenStreetMap contributors,ODbL-1.0. Private research photographs not redistributed.',
  dataAttribution:
    '© OpenStreetMap contributors;Książ Castle operator;Polish official heritage designation;Chorowska/Mruczek;primary photographers.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: 0,
    reviewStatus: 'Inactive geographic draft;full site and placement review pending',
    notes:
      'Cached undirected axis;true facing,47m tower datum,terrace extent and actual terrain alignment pending.',
  }),
  geographicNote:
    'Castle/terrace core only;inactive until full site coverage and geographic review.',
  limitations: refs.limitations,
  importReason:
    'Represent castle-core identity within medium-fi budgets while preserving explicit full-site incompleteness.',
  mediumFiContext: { scale: '1.7', neighborStyle: 'molen.worldgen.catalog.german_fachwerk' },
  camera: { position: [140, 90, 125], lookAt: [-10, 24, 4], fov: 43 },
  qaCameras: [
    {
      name: 'baroque-east-front-and-central-lantern',
      position: [117, 39, 17],
      lookAt: [35, 33, 8],
    },
    { name: 'west-towers-and-gable', position: [-124, 41, -7], lookAt: [-35, 26, -8] },
    { name: 'courtyard-and-roof-layout', position: [5, 155, 45], lookAt: [0, 25, 2] },
    { name: 'south-gallery-and-terraces', position: [-35, 35, 107], lookAt: [-9, 26, 23] },
    { name: 'main-tower-dome-and-lantern', position: [64, 58, -31], lookAt: [19, 45, 4] },
    { name: 'terrace-levels-and-pavilion', position: [-41, 16, 99], lookAt: [-17, 9, 49] },
  ],
};

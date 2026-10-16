/** Hever's mapped moated castle, reconstructed from exterior and courtyard pictures. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/u1/u10/n0312_hever_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const { across, front } = frame.reconstruction.facade;
const palette = {
  stone: '#c8bd9e',
  roof: '#615c51',
  brick: '#a86e52',
  wood: '#665344',
  plaster: '#eee3c7',
  glass: '#586a75',
};
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(
  Object.entries(palette).map(([key, value]) => [key, linear(value)]),
);
const world = ([x, z]) => [x * across[0] + z * front[0], x * across[1] + z * front[1]];
const castle = ([x, z]) => [x * across[0] + z * across[1], x * front[0] + z * front[1]];
const outer = frame.geometry.outline.map(castle),
  court = frame.geometry.holes[0].map(castle);
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
const length = (v) => Math.hypot(...v);
const unit = (v) => v.map((n) => n / length(v));
export function heverGround(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw new Error('Hever footing outside retained terrain');
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
const base = (p) => heverGround(...world(p)) - 0.32;
function localTarget(target) {
  return {
    addTriangle(surface, ref, points, _n, uv, color) {
      const p = points.map(([x, y, z]) => {
        const q = world([x, z]);
        return [q[0], y, q[1]].map(Math.fround);
      });
      target.addTriangle(
        surface === 'rubble' ? 'stone' : surface,
        ref,
        p,
        normalFor(...p),
        uv,
        color,
      );
    },
  };
}
function writer(target, detail) {
  return (surface, polygon, direction, tint = colors[surface]) => {
    let points = polygon.map((p) => p.map(Math.fround));
    if (
      direction &&
      normalFor(...points.slice(0, 3)).reduce((s, v, i) => s + v * direction[i], 0) < 0
    )
      points = points.reverse();
    const color = detail === 0 ? tint.map((v, i) => v * means[surface][i]) : tint;
    for (let i = 1; i < points.length - 1; i++) {
      const tri = [points[0], points[i], points[i + 1]];
      if (
        length(
          cross(
            tri[1].map((v, j) => v - tri[0][j]),
            tri[2].map((v, j) => v - tri[0][j]),
          ),
        ) < 1e-8
      )
        continue;
      target.addTriangle(
        surface,
        'palette:#ffffff',
        tri,
        normalFor(...tri),
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
function cap(face, outline, y, surface = 'stone', holes = [], down = false) {
  const rings = [outline, ...holes],
    points = rings.flat(),
    indices = earcut(points.flat(), holes.length ? [outline.length] : null, 2);
  for (let i = 0; i < indices.length; i += 3)
    face(
      surface,
      indices.slice(i, i + 3).map((k) => at(points[k], y)),
      [0, down ? -1 : 1, 0],
    );
}
function sides(face, outline, bottom, top, surface = 'stone', inward = false) {
  const area = outline.reduce((s, a, i) => {
    const b = outline[(i + 1) % outline.length];
    return s + a[0] * b[1] - a[1] * b[0];
  }, 0);
  const p = area < 0 ? [...outline].reverse() : outline,
    sign = inward ? -1 : 1;
  for (let i = 0; i < p.length; i++) {
    const a = p[i],
      b = p[(i + 1) % p.length];
    face(
      surface,
      [at(a, bottom), at(b, bottom), at(b, top), at(a, top)],
      [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
    );
  }
}
function solid(face, outline, bottom, top, surface = 'stone') {
  sides(face, outline, bottom, top, surface);
  cap(face, outline, top, surface);
  cap(face, outline, bottom, surface, [], true);
}
const box = (face, x, z, w, d, b, t, s = 'stone') => solid(face, rect(x, z, w, d), b, t, s);
function beam(face, a, b, width, depth, surface = 'wood') {
  const d = unit(b.map((v, i) => v - a[i])),
    u = unit(cross(d, Math.abs(d[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(d, u);
  const ring = (p) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, z]) => p.map((n, i) => n + (u[i] * x * width + v[i] * z * depth) / 2));
  const pa = ring(a),
    pb = ring(b);
  for (let i = 0; i < 4; i++)
    face(
      surface,
      [pa[i], pa[(i + 1) % 4], pb[(i + 1) % 4], pb[i]],
      pa[i].map((n, j) => n - a[j]),
    );
  face(
    surface,
    pa,
    d.map((n) => -n),
  );
  face(surface, pb, d);
}
function pitched(face, x, z, w, d, eaves, ridge, alongZ = true) {
  const p = rect(x, z, w, d),
    a = alongZ ? [x, ridge, z - d / 2] : [x - w / 2, ridge, z],
    b = alongZ ? [x, ridge, z + d / 2] : [x + w / 2, ridge, z];
  if (alongZ) {
    face('roof', [at(p[0], eaves), a, b, at(p[3], eaves)], [-1, 1, 0]);
    face('roof', [a, at(p[1], eaves), at(p[2], eaves), b], [1, 1, 0]);
    face('stone', [at(p[0], eaves), at(p[1], eaves), a], [0, 0, -1]);
    face('stone', [at(p[2], eaves), at(p[3], eaves), b], [0, 0, 1]);
  } else {
    face('roof', [at(p[0], eaves), at(p[1], eaves), b, a], [0, 1, -1]);
    face('roof', [a, b, at(p[2], eaves), at(p[3], eaves)], [0, 1, 1]);
    face('stone', [at(p[3], eaves), at(p[0], eaves), a], [-1, 0, 0]);
    face('stone', [at(p[1], eaves), at(p[2], eaves), b], [1, 0, 0]);
  }
}
function battlement(face, x, z, w, d, y, detail) {
  if (detail === 0 && w < 4) {
    box(face, x, z, w, d, y - 0.15, y + 0.9);
    return;
  }
  box(face, x, z, w, d, y - 0.65, y - 0.05);
  const thickness = 0.38;
  for (const [cx, cz, ew, ed] of [
    [x, z - d / 2, w, thickness],
    [x, z + d / 2, w, thickness],
    [x - w / 2, z, thickness, d],
    [x + w / 2, z, thickness, d],
  ]) {
    box(face, cx, cz, ew, ed, y - 0.15, y + 0.15);
    const span = Math.max(ew, ed),
      n = detail <= 1 ? 2 : Math.max(2, Math.round(span / 1.5));
    for (let i = 0; i < n; i++) {
      const t = -span / 2 + ((i + 0.5) * span) / n;
      box(
        face,
        cx + (ew > ed ? t : 0),
        cz + (ed > ew ? t : 0),
        ew > ed ? (span / n) * 0.55 : ew,
        ed > ew ? (span / n) * 0.55 : ed,
        y + 0.12,
        y + 0.9,
      );
    }
  }
}
function roundTower(face, x, z, r, top, detail) {
  const n = detail === 0 ? 8 : detail === 1 ? 12 : 16;
  const ring = Array.from({ length: n }, (_, i) => [
    x + Math.cos((i * 2 * Math.PI) / n) * r,
    z + Math.sin((i * 2 * Math.PI) / n) * r,
  ]);
  solid(face, ring, base, top - 0.8);
  cap(face, ring, top - 0.8);
  for (let i = 0; i < n; i++) {
    const a = (i * 2 * Math.PI) / n;
    if (detail === 0 && i % 2) continue;
    const t = 0.45,
      center = [x + Math.cos(a) * (r - 0.2), z + Math.sin(a) * (r - 0.2)];
    const da = [(Math.cos(a) * t) / 2, (Math.sin(a) * t) / 2],
      db = [-Math.sin(a) * r * 0.25, Math.cos(a) * r * 0.25];
    solid(
      face,
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([u, v]) => center.map((q, j) => q + u * da[j] + v * db[j])),
      top - 0.83,
      top,
    );
  }
}
function window(face, x, y, z, w, h, normal, detail, timber = false) {
  const dir = normal,
    axis = [dir[2], 0, -dir[0]],
    center = [x, y, z];
  const point = (a, b, offset = 0.025) =>
    center.map((v, i) => v + axis[i] * a + dir[i] * offset + (i === 1 ? b : 0));
  face(
    'glass',
    [point(-w / 2, -h / 2), point(w / 2, -h / 2), point(w / 2, h / 2), point(-w / 2, h / 2)],
    dir,
  );
  if (detail === 0) return;
  const s = timber ? 'wood' : 'stone',
    t = detail >= 2 ? 0.13 : 0.19;
  const border = (a, b, c, d) => {
    if (detail === 1) {
      const dx = c - a,
        dy = d - b,
        len = Math.hypot(dx, dy),
        nx = ((-dy / len) * t) / 2,
        ny = ((dx / len) * t) / 2;
      face(
        s,
        [
          point(a + nx, b + ny, 0.075),
          point(c + nx, d + ny, 0.075),
          point(c - nx, d - ny, 0.075),
          point(a - nx, b - ny, 0.075),
        ],
        dir,
      );
    } else beam(face, point(a, b, 0.075), point(c, d, 0.075), t, t, s);
  };
  border(-w / 2, -h / 2, w / 2, -h / 2);
  border(-w / 2, h / 2, w / 2, h / 2);
  border(-w / 2, -h / 2, -w / 2, h / 2);
  border(w / 2, -h / 2, w / 2, h / 2);
  if (detail >= 2) {
    border(0, -h / 2, 0, h / 2);
    border(-w / 2, 0, w / 2, 0);
  }
  if (detail >= 3 && w > 1.2) {
    border(-w / 4, -h / 2, -w / 4, h / 2);
    border(w / 4, -h / 2, w / 4, h / 2);
  }
}
function timberFacade(face, a, b, bottom, top, detail) {
  const d = unit([b[0] - a[0], 0, b[1] - a[1]]),
    n = [-d[2], 0, d[0]],
    span = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const point = (s, y, offset = 0.04) => [
    a[0] + d[0] * s + n[0] * offset,
    y,
    a[1] + d[2] * s + n[2] * offset,
  ];
  face('plaster', [point(0, bottom), point(span, bottom), point(span, top), point(0, top)], n);
  const rows = [bottom + 0.12, 4.0, top - 0.12];
  const timber = (a, b) => {
    if (detail <= 1) {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy),
        nx = (-dy / len) * 0.11,
        ny = (dx / len) * 0.11;
      face(
        'wood',
        [
          point(a[0] + nx, a[1] + ny, 0.1),
          point(b[0] + nx, b[1] + ny, 0.1),
          point(b[0] - nx, b[1] - ny, 0.1),
          point(a[0] - nx, a[1] - ny, 0.1),
        ],
        n,
      );
    } else beam(face, point(a[0], a[1], 0.1), point(b[0], b[1], 0.1), 0.19, 0.19);
  };
  for (const y of rows) timber([0, y], [span, y]);
  const count = Math.round(span / (detail >= 2 ? 1.0 : 2.1));
  for (let i = 0; i <= count; i++) timber([(i * span) / count, bottom], [(i * span) / count, top]);
  if (detail >= 2)
    for (let i = 0; i < count; i += 2) {
      const x = (i * span) / count,
        end = ((i + 1) * span) / count;
      beam(face, point(x, 4.15, 0.11), point(end, 5.0, 0.11), 0.15, 0.17);
    }
  for (const y of [2.45, 6.05])
    for (let s = 1.5; s < span - 0.5; s += 3.35) {
      const p = point(s, y, 0.15);
      window(face, ...p, 1.65, 1.55, n, detail, true);
    }
}
function build(target, detail) {
  const local = localTarget(target);
  const portal = prepareOpening(
    {
      center: [1.66, 11.8],
      axis: [1, 0],
      width: 2.65,
      height: 4.2,
      spring: 2.6,
      bottom: -0.7,
      depth: 12.5,
      shape: 'round',
    },
    0,
    detail,
  );
  const cut = writer(openingBuilder(local, [portal]), detail),
    face = writer(local, detail);
  // The source retains the real irregular envelope and its open courtyard, including projecting stairs.
  sides(cut, outer, base, 8.4);
  sides(cut, court, 0.24, 8.4, 'stone', true);
  cap(cut, outer, 8.4, 'stone', [court]);
  cap(cut, outer, base, 'stone', [court], true);
  const gate = rect(-0.45, 11.32, 15.3, 7.8);
  solid(cut, gate, base, 13.55);
  const reveal = {
    addTriangle(slot, ref, p, n, uv, color) {
      local.addTriangle(
        slot,
        ref,
        p,
        n,
        uv,
        detail === 0 ? color.map((v, i) => v * means.stone[i]) : color,
      );
    },
  };
  openingReveals(reveal, gate, base, () => 13.55, [portal], colors.stone);
  battlement(face, -0.45, 11.32, 15.3, 7.8, 13.7, detail);
  for (const x of [-7.0, 6.1])
    for (const z of [8.35, 14.15]) {
      box(face, x, z, 2.35, 2.35, 8.2, 14.75);
      battlement(face, x, z, 2.55, 2.55, 14.8, detail);
    }
  roundTower(face, -13.35, 13.05, 2.45, 10.9, detail);
  roundTower(face, 13.3, 13.05, 2.45, 10.9, detail);
  // Four roofed ranges surround, rather than fill, the map's courtyard hole.
  pitched(face, -10.95, -3.9, 8.3, 22.6, 8.55, 12.55);
  pitched(face, 9.28, -3.8, 11.65, 22.4, 8.55, 12.8);
  pitched(face, -0.3, -8.25, 29.1, 13.4, 8.55, 12.8, false);
  pitched(face, -11.65, 11.3, 6.9, 7.4, 8.55, 10.9, false);
  pitched(face, 11.1, 11.3, 8.0, 7.4, 8.55, 10.9, false);
  // Painted Tudor courtyard fronts and the three distinctive adjacent gables remain at skyline.
  timberFacade(face, [-6.7, -1.47], [3.37, -1.47], 0.45, 8.2, detail);
  timberFacade(face, [3.39, -1.45], [3.43, 7.43], 0.45, 8.2, detail);
  timberFacade(face, [-6.78, 7.4], [-6.72, -1.45], 0.45, 8.2, detail);
  for (const x of [-5.03, -1.67, 1.69]) {
    const z = -1.39,
      w = 3.24,
      y = 8.2,
      top = 11.2;
    face(
      'plaster',
      [
        [x - w / 2, y, z],
        [x + w / 2, y, z],
        [x, top, z],
      ],
      [0, 0, 1],
    );
    face(
      'roof',
      [
        [x - w / 2, y, z],
        [x, top, z],
        [x, top, z - 3.6],
        [x - w / 2, y, z - 3.6],
      ],
      [-1, 1, 0],
    );
    face(
      'roof',
      [
        [x, top, z],
        [x + w / 2, y, z],
        [x + w / 2, y, z - 3.6],
        [x, top, z - 3.6],
      ],
      [1, 1, 0],
    );
    for (const [a, b] of [
      [
        [x - w / 2, y, z + 0.04],
        [x, top, z + 0.04],
      ],
      [
        [x, top, z + 0.04],
        [x + w / 2, y, z + 0.04],
      ],
      [
        [x, y, z + 0.06],
        [x, top - 0.15, z + 0.06],
      ],
    ]) {
      if (detail === 0) {
        const dx = b[0] - a[0],
          dy = b[1] - a[1],
          len = Math.hypot(dx, dy),
          nx = (-dy / len) * 0.095,
          ny = (dx / len) * 0.095;
        face(
          'wood',
          [
            [a[0] + nx, a[1] + ny, a[2]],
            [b[0] + nx, b[1] + ny, b[2]],
            [b[0] - nx, b[1] - ny, b[2]],
            [a[0] - nx, a[1] - ny, a[2]],
          ],
          [0, 0, 1],
        );
      } else beam(face, a, b, 0.19, 0.17);
    }
    if (detail >= 1) window(face, x, 9.15, z + 0.09, 1.2, 1.05, [0, 0, 1], detail, true);
  }
  cap(face, court, 0.27, 'stone');
  // Thin supported deck uses the actual PMTiles entrance centerline, not a hand-aimed crossing.
  const [start, end] = frame.reconstruction.bridge.points.map(castle),
    delta = end.map((v, i) => v - start[i]),
    len = Math.hypot(...delta),
    n = [-delta[1] / len, delta[0] / len];
  const p = (t, side, y) => [
    start[0] + delta[0] * t + n[0] * side,
    y,
    start[1] + delta[1] * t + n[1] * side,
  ];
  const deck = [p(0, -1.2, 0), p(1, -1.2, 0), p(1, 1.2, 0), p(0, 1.2, 0)].map((v) => [v[0], v[2]]);
  solid(face, deck, -0.22, 0.34, 'wood');
  for (const sign of [-1, 1]) {
    beam(face, p(0, sign * 1.18, 0.53), p(1, sign * 1.18, 0.53), 0.25, 0.23, 'stone');
    beam(face, p(0, sign * 1.18, 1.24), p(1, sign * 1.18, 1.24), 0.16, 0.18);
    const posts = detail >= 2 ? 5 : 2;
    for (let i = 0; i <= posts; i++)
      beam(face, p(i / posts, sign * 1.18, 0.38), p(i / posts, sign * 1.18, 1.3), 0.18, 0.18);
  }
  if (detail >= 1) {
    for (const [x, z, top] of [
      [-10.5, -11.7, 14.3],
      [10.8, -10.5, 14.6],
      [-11.4, 4.3, 13.7],
      [12.1, 3.2, 14.0],
    ]) {
      box(face, x, z, 1.25, 1.05, 8.25, top - 0.45, 'brick');
      box(face, x, z, 1.55, 1.32, top - 0.57, top - 0.32, 'stone');
      for (const dx of [-0.32, 0.32]) box(face, x + dx, z, 0.43, 0.55, top - 0.36, top, 'brick');
    }
    for (const y of [5.65, 9.6])
      for (const x of [-4.7, -1.5, 1.65, 4.5])
        window(face, x, y, 15.24, 1.65, 2.0, [0, 0, 1], detail);
    for (const y of [3.2, 6.65])
      for (const z of [-11, -5, 1, 6]) {
        window(face, -15.14, y, z, 1.65, 1.75, [-1, 0, 0], detail);
        window(face, 15.24, y, z, 1.65, 1.75, [1, 0, 0], detail);
      }
    for (const x of [-12, -7, -2, 4, 10])
      window(face, x, 6.2, -15.3, 1.65, 1.75, [0, 0, -1], detail);
    box(face, -10.35, -18.0, 3.25, 2.8, base, 10.65);
    battlement(face, -10.35, -18.0, 3.25, 2.8, 10.55, detail);
    box(face, 15.6, -6.0, 2.0, 6.0, base, 9.25);
    battlement(face, 15.6, -6.0, 2.0, 6.0, 9.15, detail);
  }
  if (detail >= 2) {
    // Broad dressed-stone bands and projecting window hoods, not tiny mortar geometry.
    for (const y of [4.1, 8.3, 12.8]) box(face, -0.45, 15.29, 15.35, 0.26, y, y + 0.18);
    for (const x of [-4.7, -1.5, 1.65, 4.5])
      for (const y of [5.65, 9.6]) box(face, x, 15.38, 2.0, 0.35, y + 1.0, y + 1.18);
    for (const x of [-7, 6.1]) window(face, x, 12.7, 15.34, 0.8, 1.05, [0, 0, 1], detail);
    for (const x of [-13.35, 13.3]) window(face, x, 6.8, 15.53, 0.8, 1.4, [0, 0, 1], detail);
    // Selected original side gable in the picture; approximate its position, retain a clear roof profile.
    face(
      'stone',
      [
        [-15.16, 8.4, -2.2],
        [-15.16, 8.4, 2.2],
        [-15.16, 11.1, 0],
      ],
      [-1, 0, 0],
    );
    face(
      'roof',
      [
        [-15.16, 8.4, -2.2],
        [-15.16, 11.1, 0],
        [-12.8, 11.1, 0],
        [-12.8, 8.4, -2.2],
      ],
      [0, 1, -1],
    );
    face(
      'roof',
      [
        [-15.16, 11.1, 0],
        [-15.16, 8.4, 2.2],
        [-12.8, 8.4, 2.2],
        [-12.8, 11.1, 0],
      ],
      [0, 1, 1],
    );
    window(face, -15.19, 8.9, 0, 1.1, 1.3, [-1, 0, 0], detail);
  }
}
export const buildHeverSkyline = (out) => build(out, 0);
export const buildHeverDistrict = (out) => build(out, 1);
export const buildHeverStreet = (out) => build(out, 2);
export const buildHeverCloseup = (out) => build(out, 3);
export const heverStudy = {
  id: 'N0312',
  key: 'hever_castle',
  title: 'Hever Castle',
  category: 'castle',
  wikidataId: 'Q1132683',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  importReason:
    'Preserve the actual courtyard and gate passage, rotated mapped envelope, Tudor gables and narrow entrance bridge; four authored material-merged browser levels are separate outputs.',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Moated Hever Castle: crenellated gatehouse with four square angle turrets, lower rounded front towers, roofed courtyard ranges, cream/dark Tudor inner façades with three gables, selected chimney stacks and the mapped south entrance bridge.',
  sourceFacts: {
    horizontalBasis:
      'Standard viewer PMTiles named castle and same-ID building envelope with courtyard hole, separate northwest hotel footprint and entrance bridge centerline.',
    architecturalHeights:
      'Picture-led estimates scaled to the 30.327 m mapped front; no surveyed elevations.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'The 30.327 m mapped south façade and 7.963 m mapped entrance crossing control the individual reconstruction.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license. Map controls © OpenStreetMap contributors, ODbL-1.0; linked photographs remain external references and are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Five canonical shared graphs provide stone, slate, brick, wood and lime plaster. Glazing uses a tinted untextured PBR slot. No unique bitmap or embedded photograph.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: palette,
    colorEncoding: 'sRGB converted to linear COLOR_0',
    identityFeatures: [
      'Tall turreted crenellated gatehouse and lower front corner towers',
      'Open courtyard with three cream/dark Tudor gables',
      'Pitched stone ranges, paired chimney stacks and narrow moat crossing',
    ],
  },
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  previewEntities: scope.previewEntities,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Roof, turret, chimney and window heights and cadence are picture-led approximations against the retained standard viewer footprint; not surveyed architecture.',
    'Terrain and moat banks are coarse. Blue preview moat bands are approximate context only; the asset relies on host mapped water. Exact bank/deck joins and underwater footings remain approximate.',
    'The separate northwest hotel/Tudor village, gardens, seasonal ivy, interior furnishings and certified walkable collision are excluded.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: { position: [53, 38, 69], lookAt: [0, 6, 0], fov: 43 },
  qaCameras: [
    { name: 'gatehouse-and-entrance', position: [27, 18, 44], lookAt: [7, 7, 10], fov: 44 },
    {
      name: 'courtyard-tudor-gables',
      position: [1.344484, 7.5, 7.064223],
      lookAt: [-2.07774, 6.8, -0.60666],
      fov: 65,
    },
    { name: 'western-range-and-chimneys', position: [-42, 23, 16], lookAt: [-6, 7, -2], fov: 43 },
    { name: 'rear-ranges', position: [-27, 24, -41], lookAt: [-3, 7, -3], fov: 43 },
    { name: 'mapped-plan', position: [0, 64, 0.1], lookAt: [0, 0, 0], fov: 43 },
    { name: 'gate-passage-and-bridge', position: [14, 5, 25], lookAt: [7, 2, 12], fov: 46 },
  ],
};

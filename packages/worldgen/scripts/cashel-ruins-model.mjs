/** Individual Cashel compound: mapped components, picture-led roofless church and roofed chapel. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const source = new URL(
  '../../../content/worldgen/source/places/gc/gc6/rock_of_cashel/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, source)));
const frame = read('map-frame.json'),
  fit = read('pmtiles-fit.json'),
  scope = read('review-scope.json'),
  means = read('surface-means.json');
const parts = frame.reconstruction.parts;
const palette = { stone: '#c5c2af', chapel: '#ccb692', roof: '#64615a', wood: '#74634e' };
const linear = (hex) =>
  hex
    .slice(1)
    .match(/../g)
    .map((s) => {
      const v = parseInt(s, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
const colors = Object.fromEntries(Object.entries(palette).map(([k, v]) => [k, linear(v)]));
const norm = (v) => {
  const m = Math.hypot(...v);
  return v.map((n) => n / m);
};
const at = (p, y) => [p[0], typeof y === 'function' ? y(p) : y, p[1]];
const rect = (x, z, w, d) => [
  [x - w / 2, z - d / 2],
  [x + w / 2, z - d / 2],
  [x + w / 2, z + d / 2],
  [x - w / 2, z + d / 2],
];
export function cashelGround(x, z) {
  const g = fit.grid,
    u = (x - g.origin[0]) / g.stepMeters,
    v = (z - g.origin[1]) / g.stepMeters;
  if (u < 0 || v < 0 || u >= g.width - 1 || v >= g.height - 1)
    throw Error('Cashel footing outside retained terrain');
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
const base = (p) => cashelGround(...p) - 0.3;
function adapter(out, surface = 'stone') {
  return {
    addTriangle(s, ref, p, n, uv, c) {
      out.addTriangle(s === 'rubble' ? surface : s, ref, p, n, uv, c);
    },
  };
}
function writer(out, detail) {
  return (s, poly, direction, tint = colors[s]) => {
    let p = poly.map((p) => p.map(Math.fround));
    if (direction && normalFor(...p.slice(0, 3)).reduce((v, n, i) => v + n * direction[i], 0) < 0)
      p = p.reverse();
    const color = detail === 0 ? tint.map((v, i) => v * means[s][i]) : tint;
    for (let i = 1; i < p.length - 1; i++) {
      const tri = [p[0], p[i], p[i + 1]],
        n = normalFor(...tri);
      if (
        Math.hypot(
          ...cross(
            tri[1].map((v, k) => v - tri[0][k]),
            tri[2].map((v, k) => v - tri[0][k]),
          ),
        ) < 1e-8
      )
        continue;
      out.addTriangle(
        s,
        'palette:#ffffff',
        tri,
        n,
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
function cap(face, ring, y, s = 'stone') {
  const ids = earcut(ring.flat(), null, 2);
  for (let i = 0; i < ids.length; i += 3)
    face(
      s,
      ids.slice(i, i + 3).map((k) => at(ring[k], y)),
      [0, 1, 0],
    );
}
function solid(face, ring, b, t, s = 'stone') {
  const sign = Math.sign(
    ring.reduce((n, a, i) => {
      const c = ring[(i + 1) % ring.length];
      return n + a[0] * c[1] - c[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      c = ring[(i + 1) % ring.length];
    face(
      s,
      [at(a, b), at(c, b), at(c, t), at(a, t)],
      [(c[1] - a[1]) * sign, 0, (a[0] - c[0]) * sign],
    );
  }
  cap(face, ring, t, s);
}
const box = (face, x, z, w, d, b, t, s = 'stone') => solid(face, rect(x, z, w, d), b, t, s);
function beam(face, a, b, w, d, s = 'stone') {
  const n = norm(b.map((v, i) => v - a[i])),
    u = norm(cross(n, Math.abs(n[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    v = cross(n, u);
  const ring = (p) =>
    [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, z]) => p.map((q, i) => q + (u[i] * x * w + v[i] * z * d) / 2));
  const ra = ring(a),
    rb = ring(b);
  for (let i = 0; i < 4; i++)
    face(
      s,
      [ra[i], ra[(i + 1) % 4], rb[(i + 1) % 4], rb[i]],
      ra[i].map((q, j) => q - a[j]),
    );
  face(
    s,
    ra,
    n.map((v) => -v),
  );
  face(s, rb, n);
}
function aperture(h, detail) {
  const p = prepareOpening(h, 0, detail);
  if (h.shape !== 'circle') return p;
  p.ring = Array.from({ length: detail <= 1 ? 8 : 12 }, (_, i) => {
    const a = (i * Math.PI * 2) / (detail <= 1 ? 8 : 12);
    return [(Math.cos(a) * h.width) / 2, h.bottom + h.height / 2 + (Math.sin(a) * h.height) / 2];
  });
  p.planes = p.planes.slice(0, 2);
  for (let i = 0; i < p.ring.length; i++) {
    const a = p.ring[i],
      b = p.ring[(i + 1) % p.ring.length],
      du = b[0] - a[0],
      dv = b[1] - a[1];
    p.planes.push([
      -dv * p.axis[0],
      du,
      -dv * p.axis[1],
      dv * (h.center[0] * p.axis[0] + h.center[1] * p.axis[1] + a[0]) - du * a[1],
    ]);
  }
  return p;
}
/** A thick wall segment with genuine apertures and exposed jambs, not painted dark windows. */
function wall(out, detail, a, b, thickness, bottom, top, s = 'stone', holes = []) {
  const u = norm([b[0] - a[0], b[1] - a[1]]),
    n = [-u[1], u[0]],
    ring = [
      a.map((v, i) => v + (n[i] * thickness) / 2),
      b.map((v, i) => v + (n[i] * thickness) / 2),
      b.map((v, i) => v - (n[i] * thickness) / 2),
      a.map((v, i) => v - (n[i] * thickness) / 2),
    ];
  if (typeof top === 'function' && typeof bottom !== 'function') {
    for (const i of [2, 0]) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      ring.splice(
        i + 1,
        0,
        a.map((v, k) => (v + b[k]) / 2),
      );
    }
  }
  const prepared = holes.map((h) =>
    aperture({ axis: u, depth: thickness + 1, shape: 'pointed', ...h }, detail),
  );
  const target = adapter(out, s),
    face = writer(openingBuilder(target, prepared), detail);
  solid(face, ring, bottom, top, s);
  openingReveals(
    target,
    ring,
    (p) => (typeof bottom === 'function' ? bottom(p) : bottom),
    (p) => (typeof top === 'function' ? top(p) : top),
    prepared,
    detail === 0 ? colors[s].map((v, i) => v * means[s][i]) : colors[s],
  );
  if (detail >= 2) {
    const trim = writer(target, detail);
    for (const h of prepared)
      for (let i = 0; i < h.ring.length; i++) {
        if (h.shape === 'circle' || i > 0) {
          const r = h.ring[i],
            q = h.ring[(i + 1) % h.ring.length];
          for (const sign of [-1, 1]) {
            if (detail === 2) {
              const du = q[0] - r[0],
                dv = q[1] - r[1],
                m = Math.hypot(du, dv),
                u = (-dv * 0.1) / m,
                v = (du * 0.1) / m,
                d = sign * (thickness / 2 + 0.12);
              trim(
                s,
                [
                  h.point(r[0] + u, r[1] + v, d),
                  h.point(q[0] + u, q[1] + v, d),
                  h.point(q[0] - u, q[1] - v, d),
                  h.point(r[0] - u, r[1] - v, d),
                ],
                [h.normal[0] * sign, 0, h.normal[1] * sign],
              );
            } else
              beam(
                trim,
                h.point(...r, sign * (thickness / 2 + 0.1)),
                h.point(...q, sign * (thickness / 2 + 0.1)),
                0.2,
                0.23,
                s,
              );
          }
        }
      }
  }
}
function roof(face, ring, eaves, ridge, s = 'roof', wallSurface = 'stone') {
  const a = ring[0],
    b = ring[1],
    c = ring[2],
    d = ring[3],
    r0 = [(a[0] + d[0]) / 2, ridge, (a[1] + d[1]) / 2],
    r1 = [(b[0] + c[0]) / 2, ridge, (b[1] + c[1]) / 2];
  face(s, [at(a, eaves), at(b, eaves), r1, r0], [0, 1, 0]);
  face(s, [r0, r1, at(c, eaves), at(d, eaves)], [0, 1, 0]);
  const u = norm([b[0] - a[0], b[1] - a[1]]);
  face(wallSurface, [at(d, eaves), at(a, eaves), r0], [-u[0], 0, -u[1]]);
  face(wallSurface, [at(b, eaves), at(c, eaves), r1], [u[0], 0, u[1]]);
}
function pyramid(face, x, z, w, d, y, top, s = 'chapel') {
  const p = rect(x, z, w, d);
  for (let i = 0; i < 4; i++)
    face(s, [at(p[i], y), at(p[(i + 1) % 4], y), [x, top, z]], [p[i][0] - x, 1, p[i][1] - z]);
}
function mainChurch(out, detail) {
  const face = writer(out, detail),
    ring = parts.cathedral.outline;
  // Real footprint supplies the hollow cruciform envelope. Only the west tower-house is tall.
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length],
      cut = [];
    if ((a[0] + 7.5) * (b[0] + 7.5) < 0) {
      const t = (-7.5 - a[0]) / (b[0] - a[0]);
      cut.push(
        [a, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]],
        [[-7.5, a[1] + (b[1] - a[1]) * t], b],
      );
    } else cut.push([a, b]);
    for (const [p, q] of cut) {
      const mid = p.map((v, j) => (v + q[j]) / 2),
        len = Math.hypot(q[0] - p[0], q[1] - p[1]),
        west = mid[0] < -7.5,
        top = west ? 23 : 13.7;
      const holes = [];
      if (detail >= 1 && len > 5.5) {
        const count =
          detail === 1
            ? west
              ? 1
              : Math.min(2, Math.max(1, Math.round(len / 7)))
            : west
              ? len > 8
                ? 2
                : 1
              : Math.max(1, Math.round(len / 4.5));
        for (let j = 0; j < count; j++) {
          const t = (j + 0.5) / count;
          holes.push({
            center: p.map((v, k) => v + (q[k] - v) * t),
            width: west ? 1.1 : 1.45,
            bottom: west ? 8.0 : 3.0,
            height: west ? 4.3 : 7.9,
            spring: west ? 3.6 : 6.6,
          });
        }
      }
      // District keeps triplets; skyline merges the tiny separated lights into one real void.
      const north = p[1] < -10 && q[1] < -10,
        south = p[1] > 27 && q[1] > 27;
      if (north || south) {
        holes.length = 0;
        for (const t of detail === 0 ? [0.5] : [0.22, 0.5, 0.78])
          holes.push({
            center: p.map((v, k) => v + (q[k] - v) * t),
            width: detail === 0 ? 3.4 : 1.35,
            bottom: 3,
            height: 8.1,
            spring: 6.7,
          });
      }
      wall(out, detail, p, q, 1.18, base, top, 'stone', holes);
      if (detail >= 2 && len > 5) {
        const u = norm([q[0] - p[0], q[1] - p[1]]),
          n = [u[1], -u[0]];
        const cadence =
          north || south
            ? [0, 0.36, 0.64, 1]
            : Array.from(
                { length: Math.max(1, Math.floor(len / 6)) },
                (_, j) => (j + 0.2) / Math.max(1, Math.floor(len / 6)),
              );
        for (const t of cadence) {
          const c = p.map((v, k) => v + (q[k] - v) * t + n[k] * 0.85);
          if (
            holes.some(
              (h) =>
                Math.abs((h.center[0] - c[0]) * u[0] + (h.center[1] - c[1]) * u[1]) <
                h.width / 2 + 0.7,
            )
          )
            continue;
          box(face, c[0], c[1], 0.9, 1.0, base, top - 0.9);
        }
      }
    }
  }
  // Western tower-house stays roofless: an internal east wall defines its large open room.
  wall(
    out,
    detail,
    [-7.5, 1.67],
    [-7.5, 14.18],
    1.1,
    base,
    23,
    'stone',
    detail >= 1 ? [{ center: [-7.5, 8], width: 3.6, bottom: 0.8, height: 6.6, spring: 4.7 }] : [],
  );
  for (const z of [2.0, 13.9])
    wall(
      out,
      detail,
      [-19.1, z],
      [-8.0, z],
      1.18,
      23,
      (p) => 23 + Math.max(0, 1 - Math.abs(p[0] + 13.6) / 5.6) * 4.3,
      'stone',
      detail >= 2
        ? [{ center: [-13.6, z], width: 1.4, bottom: 23.5, height: 2.0, spring: 1.6 }]
        : [],
    );
  // Open square crossing tower. Four pointed arch openings connect the transept and nave.
  const crossRing = rect(7.1, 9.1, 11.5, 11.7);
  for (let i = 0; i < 4; i++) {
    const a = crossRing[i],
      b = crossRing[(i + 1) % 4],
      mid = a.map((v, k) => (v + b[k]) / 2);
    wall(out, detail, a, b, 1.15, base, 22.3, 'stone', [
      { center: mid, width: 6.5, bottom: 0.4, height: 11.5, spring: 7.6 },
      ...(detail >= 2 ? [{ center: mid, width: 1.15, bottom: 16, height: 3.5, spring: 2.7 }] : []),
    ]);
  }
  // Surviving central gables have open air between them; no invented full Gothic roof.
  for (const z of [3.25, 14.95])
    wall(
      out,
      detail,
      [1.35, z],
      [12.85, z],
      1.12,
      22.3,
      (p) => 22.3 + Math.max(0, 1 - Math.abs(p[0] - 7.1) / 5.75) * 4.2,
      'stone',
      detail >= 2 ? [{ center: [7.1, z], width: 1.4, bottom: 22.6, height: 2.1, spring: 1.5 }] : [],
    );
  // Triangular north/south transept gables and circular upper openings.
  for (const [a, b] of [
    [ring[2], ring[3]],
    [ring[12], ring[13]],
  ]) {
    const u = norm([b[0] - a[0], b[1] - a[1]]),
      mid = a.map((v, k) => (v + b[k]) / 2),
      half = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
    wall(
      out,
      detail,
      a,
      b,
      1.18,
      13.7,
      (p) =>
        13.7 +
        Math.max(0, 1 - Math.abs((p[0] - mid[0]) * u[0] + (p[1] - mid[1]) * u[1]) / half) * 6.0,
      'stone',
      detail >= 1 ? [{ center: mid, shape: 'circle', width: 1.7, bottom: 15.7, height: 1.7 }] : [],
    );
  }
  if (detail >= 1) {
    // Sparse uneven crest blocks capture damage without a fabricated battlement pattern.
    for (const [x, z, w, y] of [
      [23.3, 4.05, 2.5, 13.7],
      [34.2, 4.15, 1.8, 13.7],
      [40.4, 15.0, 1.5, 13.7],
      [26.5, 15.4, 2.8, 13.7],
      [-18.9, 6.4, 1.7, 23],
      [-12.2, 1.7, 2.1, 23],
      [-9.7, 13.9, 1.3, 23],
    ])
      box(face, x, z, w, 0.75, y, y + 0.75);
  }
  // Floors remain gently terrain-following and contain no reconstructed furnishings.
  if (detail >= 1) cap(face, ring, (p) => cashelGround(...p) + 0.12);
}
function roundTower(out, detail) {
  const face = writer(out, detail),
    center = [17.86, -11.91],
    n = [6, 12, 16, 24, 24][detail],
    ring = (radius) =>
      Array.from({ length: n }, (_, i) => [
        center[0] + Math.cos((i * Math.PI * 2) / n) * radius,
        center[1] + Math.sin((i * Math.PI * 2) / n) * radius,
      ]);
  const lower = ring(2.27),
    upper = ring(2.07),
    y = 24.1;
  for (let i = 0; i < n; i++) {
    const a = lower[i],
      b = lower[(i + 1) % n],
      c = upper[(i + 1) % n],
      d = upper[i];
    const h = [];
    if (detail >= 2 && i % Math.floor(n / 4) === 0) {
      const u = norm([b[0] - a[0], b[1] - a[1]]),
        mid = d.map((v, k) => (v + c[k]) / 2);
      h.push(
        aperture(
          {
            axis: u,
            depth: 1.5,
            center: mid,
            shape: 'rect',
            width: 0.5,
            bottom: 21.8,
            height: 1.4,
          },
          detail,
        ),
      );
    }
    const sf = writer(openingBuilder(out, h), detail);
    sf(
      'stone',
      [at(a, base), at(b, base), at(c, y), at(d, y)],
      [a[0] - center[0], 0, a[1] - center[1]],
    );
    // The cap belongs to the real tower, not a generic slate spire.
    face(
      'stone',
      [at(d, y), at(c, y), [center[0], 29.2, center[1]]],
      [a[0] - center[0], 1, a[1] - center[1]],
    );
  }
  if (detail >= 2) {
    box(face, 17.86, -14.19, 0.78, 0.14, 5.5, 7.2, 'wood');
    beam(face, [17.86, 7.3, -14.32], [17.86, 7.3, -14.0], 1.2, 0.35);
  }
}
function chapel(out, detail) {
  const face = writer(out, detail),
    raw = parts.chapel.outline;
  // Romanesque nave follows the rotated chapel envelope; two projecting belfries are separate.
  const nave = [raw[0], raw[5], raw[6], raw[11]];
  for (let i = 0; i < 4; i++) {
    const a = nave[i],
      b = nave[(i + 1) % 4],
      len = Math.hypot(b[0] - a[0], b[1] - a[1]),
      holes = [];
    if (detail >= 1 && len > 8)
      for (const t of detail === 1 ? [0.55] : [0.25, 0.55, 0.8])
        holes.push({
          center: a.map((v, k) => v + (b[k] - v) * t),
          shape: 'round',
          width: 0.9,
          bottom: 4.7,
          height: 1.8,
          spring: 1.3,
        });
    wall(out, detail, a, b, 0.85, base, 8.4, 'chapel', holes);
  }
  if (detail >= 1) cap(face, nave, 1.8, 'chapel');
  roof(face, nave, 8.4, 11.8, 'chapel', 'chapel');
  const towers = [
    { ring: [raw[2], raw[3], raw[4], [22.85, 20.93]], top: 15.7, cap: true },
    { ring: [[23.85, 24.6], [26.15, 24.15], raw[8], raw[9]], top: 14.4, cap: false },
  ];
  for (const [_t, tower] of towers.entries()) {
    const r = tower.ring;
    for (let i = 0; i < 4; i++) {
      const a = r[i],
        b = r[(i + 1) % 4],
        mid = a.map((v, k) => (v + b[k]) / 2);
      wall(
        out,
        detail,
        a,
        b,
        0.55,
        base,
        tower.top,
        'chapel',
        detail >= 1 && (detail > 1 || i % 2 === 0)
          ? [
              {
                center: mid,
                shape: 'round',
                width: 0.68,
                bottom: tower.top - 2.8,
                height: 1.5,
                spring: 0.95,
              },
            ]
          : [],
      );
    }
    const x = r.reduce((n, p) => n + p[0], 0) / 4,
      z = r.reduce((n, p) => n + p[1], 0) / 4;
    if (tower.cap) pyramid(face, x, z, 3.3, 3.5, tower.top, tower.top + 3.8);
    else {
      cap(face, r, tower.top - 0.45, 'chapel');
      if (detail >= 1)
        for (const p of r) box(face, p[0], p[1], 0.75, 0.7, tower.top, tower.top + 0.75, 'chapel');
    }
  }
  if (detail >= 2) {
    const a = nave[3],
      b = nave[2],
      u = norm([b[0] - a[0], b[1] - a[1]]),
      n = [-u[1], u[0]],
      c = a.map((v, k) => v + (b[k] - v) * 0.35);
    wall(
      out,
      detail,
      c.map((v, k) => v - u[k] * 1.3),
      c.map((v, k) => v + u[k] * 1.3),
      0.4,
      1.4,
      4.5,
      'chapel',
      [{ center: c, shape: 'round', width: 1.45, bottom: 1.5, height: 2.55, spring: 1.8 }],
    );
    beam(
      face,
      [c[0], 4.55, c[1]],
      [c[0] + n[0] * 0.45, 4.55, c[1] + n[1] * 0.45],
      3.0,
      0.4,
      'chapel',
    );
  }
}
function lowerRanges(out, detail) {
  const face = writer(out, detail);
  for (const [name, eaves, ridge] of [
    ['vicarsWest', 7.9, 11.1],
    ['vicarsEast', 6.6, 9.2],
  ]) {
    const r = parts[name].outline;
    for (let i = 0; i < 4; i++) {
      const a = r[i],
        b = r[(i + 1) % 4],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]),
        holes = [];
      if (detail >= 1 && len > 9)
        for (const t of detail === 1 ? [0.3, 0.75] : [0.2, 0.45, 0.7, 0.9])
          holes.push({
            center: a.map((v, k) => v + (b[k] - v) * t),
            shape: 'rect',
            width: 0.9,
            bottom: 3.0,
            height: 1.65,
          });
      wall(out, detail, a, b, 0.8, base, eaves, 'stone', holes);
    }
    roof(face, r, eaves, ridge);
    if (detail >= 1) {
      const a = r[3],
        b = r[2];
      for (const t of [0.18, 0.44, 0.7]) {
        const c = a.map((v, k) => v + (b[k] - v) * t);
        box(face, c[0], c[1], 1.0, 1.0, eaves - 0.1, eaves + 1.7);
        pyramid(face, c[0], c[1], 1.0, 1.0, eaves + 1.7, eaves + 2.4, 'roof');
      }
    }
    if (detail >= 2) {
      const p = r[0],
        q = r[1],
        c = p.map((v, k) => v + (q[k] - v) * 0.33);
      box(face, c[0], c[1], 1.2, 0.14, 1.2, 3.5, 'wood');
      box(face, q[0] - 0.7, q[1] + 1.0, 0.65, 0.65, eaves, ridge + 1.1);
    }
  }
}
function enclosure(out, detail) {
  const face = writer(out, detail),
    raw = frame.geometry.outline;
  // Distant boundary uses selected corners; closer levels retain the full mapped enclosure.
  const r = detail === 0 ? raw.filter((_, i) => i % 6 === 0) : raw;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length],
      mid = a.map((v, k) => (v + b[k]) / 2);
    // South entrance remains open; model is a boundary wall, not a filled hill platform.
    if (mid[1] > 51 && mid[0] > -6 && mid[0] < 23) continue;
    wall(out, detail, a, b, 0.9, base, (p) => cashelGround(...p) + 1.5);
  }
  if (detail >= 1) {
    const [x, z] = frame.reconstruction.highCross.point,
      b = cashelGround(x, z);
    box(face, x, z, 1.1, 1.0, b - 0.1, b + 0.6);
    box(face, x, z, 0.6, 0.45, b + 0.55, b + 3.2);
    box(face, x, z, 1.9, 0.45, b + 2.0, b + 2.55);
  }
}
function build(out, detail) {
  mainChurch(out, detail);
  roundTower(out, detail);
  chapel(out, detail);
  lowerRanges(out, detail);
  enclosure(out, detail);
}
export const buildCashelSkyline = (out) => build(out, 0);
export const buildCashelDistrict = (out) => build(out, 1);
export const buildCashelStreet = (out) => build(out, 2);
export const buildCashelCloseup = (out) => build(out, 3);
export const cashelStudy = {
  id: 'rock_of_cashel',
  key: 'rock_of_cashel',
  title: 'Rock of Cashel',
  category: 'castle',
  wikidataId: 'Q1255597',
  generationCommand: 'node packages/worldgen/scripts/generate-additional-landmarks.mjs',
  importReason:
    'Retain the actual roofless cruciform cathedral, hollow crossing/west towers, mapped round tower, roofed Romanesque chapel and lower ranges; four authored shared-material browser levels preserve their individual arrangement.',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  build: (out) => build(out, 4),
  surfaceOverrides: scope.surfaceOverrides,
  brief:
    'Rock of Cashel compound: Gothic cathedral ruins with real open lancets and roofless interiors, taller ruined west tower-house, open crossing tower/gables, narrow round tower with stone conical cap, rotated Cormac chapel with unequal paired belfries, roofed Vicars ranges and low site boundary.',
  sourceFacts: {
    horizontalBasis:
      'Current standard viewer PMTiles component polygons and named points; already retained identity-matched OSM enclosure.',
    architecturalHeights:
      'Picture-led estimates scaled to the mapped component dimensions. No survey or bespoke elevation sources.',
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Cathedral 61.4 m east/west mapped extent, 42 m transept extent and separate 4.5 m round-tower diameter control picture-led heights.',
  refs: read('reference-metadata.json').currentRoundInspection.pictures,
  nativeAxes: frame.nativeAxes,
  sourceDocuments: scope.sourceDocuments,
  sourceLicense:
    'Original geometry under repository license. Map controls © OpenStreetMap contributors, ODbL-1.0; photographs remain linked external references and are not redistributed.',
  dataAttribution: '© OpenStreetMap contributors; Protomaps; Mapzen/USGS terrain tiles.',
  sourceNotice:
    'Four existing canonical shared graphs supply weathered limestone, sandstone, slate and plain wood. No unique bitmap or embedded image.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: palette,
    colorEncoding: 'sRGB converted to linear COLOR_0',
    identityFeatures: [
      'Roofless cruciform cathedral with open Gothic lancets, transept gables and hollow ruined towers',
      'Adjacent narrow round tower with stone conical cap',
      'Warm roofed Romanesque chapel with two unequal belfries and two mapped lower ranges',
    ],
  },
  previewGround: false,
  previewTerrain: scope.previewTerrain,
  mediumFiContext: scope.mediumFiContext,
  geographic: () => scope.geographic,
  geographicNote: scope.geographicNote,
  limitations: [
    'Heights, ruined crest shapes, wall thickness, window cadence, portal detail and roof sections are picture-led approximations, not a measured conservation reconstruction.',
    'The retained terrain is coarse and smooths the limestone hill. Footings and low enclosure walls follow it; exact terrace, floor and visitor-path joins remain unverified.',
    'Selected cross is schematic. Cemetery inventories, individual carvings, frescoes, scaffolding, visitor/service huts, furnishings and certified walkable collision are excluded.',
    'Physical laptop and phone frame-rate measurements remain pending.',
  ],
  camera: { position: [95, 65, 108], lookAt: [0, 9, 5], fov: 43 },
  qaCameras: [
    {
      name: 'north-transept-and-round-tower',
      position: [44, 19, -54],
      lookAt: [10, 11, -5],
      fov: 45,
    },
    {
      name: 'south-chapel-and-vicars-ranges',
      position: [62, 31, 73],
      lookAt: [11, 10, 23],
      fov: 47,
    },
    { name: 'west-tower-house', position: [-58, 34, 18], lookAt: [-6, 13, 8], fov: 43 },
    { name: 'roofless-crossing-and-nave', position: [8, 35, 5], lookAt: [18, 0.8, 9], fov: 63 },
    { name: 'mapped-compound-plan', position: [0, 176, 0.1], lookAt: [0, 0, 0], fov: 43 },
    { name: 'cormac-chapel-belfries', position: [38, 17, 35], lookAt: [23, 10, 22], fov: 48 },
  ],
};

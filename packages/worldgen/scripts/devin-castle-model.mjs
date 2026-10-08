/** Devín’s present roofless masonry: own wall polygons, exposed cliff and isolated Maiden Tower. */
import './install-deterministic-math.mjs';
import { readFileSync } from 'node:fs';
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { openingBuilder, openingReveals, prepareOpening } from './authored-wall-openings.mjs';

const dir = new URL(
  '../../../content/worldgen/source/places/u2/u2s/n0292_devin_castle/',
  import.meta.url,
);
const read = (name) => JSON.parse(readFileSync(new URL(name, dir)));
const frame = read('map-frame.json'),
  relief = read('relief-grid.json'),
  means = read('surface-means.json'),
  references = read('reference-metadata.json'),
  apertures = read('openings.json');
export const devinPalette = {
  wall: '#dfcfb3',
  rock: '#d2d0c5',
  brick: '#ce9b7b',
  grass: '#8aa065',
  paving: '#b7b0a3',
};
export const devinSurfaces = {
  rubble: { slot: 'wall', graph: 'stone_drywall', roughness: 0.94, metallic: 0 },
  weathered: {
    slot: 'foundation',
    graph: 'stone_limestone_weathered',
    roughness: 0.9,
    metallic: 0,
  },
  brick: { slot: 'wall', graph: 'brick', roughness: 0.9, metallic: 0 },
  aggregate: { slot: 'foundation', graph: 'gravel', roughness: 0.98, metallic: 0 },
  foliage: { slot: 'wall', roughness: 0.94, metallic: 0 },
};
const colors = Object.fromEntries(
  Object.entries(devinPalette).map(([k, h]) => [
    k,
    h
      .slice(1)
      .match(/../g)
      .map((v) => {
        const x = parseInt(v, 16) / 255;
        return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      }),
  ]),
);
function face(o, p, color = 'wall', slot = 'rubble', target) {
  p = p.map((v) => v.map(Math.fround));
  if (target && normalFor(...p.slice(0, 3)).reduce((v, n, i) => v + n * target[i], 0) < 0)
    p = [...p].reverse();
  for (let i = 1; i < p.length - 1; i++) {
    const t = [p[0], p[i], p[i + 1]],
      n = normalFor(...t);
    if (Math.hypot(...n) < 0.5) continue;
    o.addTriangle(
      slot,
      'palette:#ffffff',
      t,
      n,
      t.map((v) => [v[0], v[2]]),
      colors[color],
    );
  }
}
const area = (p) =>
  p.reduce((s, a, i) => {
    const b = p[(i + 1) % p.length];
    return s + a[0] * b[1] - b[0] * a[1];
  }, 0);
function simplify(p, eps) {
  if (p.length < 3) return p;
  const a = p[0],
    b = p.at(-1),
    dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = dx * dx + dz * dz;
  let max = 0,
    j = 0;
  for (let i = 1; i < p.length - 1; i++) {
    const u = l ? Math.max(0, Math.min(1, ((p[i][0] - a[0]) * dx + (p[i][1] - a[1]) * dz) / l)) : 0,
      d = Math.hypot(p[i][0] - a[0] - dx * u, p[i][1] - a[1] - dz * u);
    if (d > max) {
      max = d;
      j = i;
    }
  }
  return max > eps
    ? [...simplify(p.slice(0, j + 1), eps).slice(0, -1), ...simplify(p.slice(j), eps)]
    : [a, b];
}
function clean(p, eps) {
  const ring =
    p.length > 2 && Math.hypot(...p[0].map((v, i) => v - p.at(-1)[i])) < 0.002 ? p.slice(0, -1) : p;
  const q = simplify([...ring, ring[0]], eps).slice(0, -1);
  return q.length >= 3 ? q : ring;
}
function cap(o, ring, height, color = 'wall', slot = 'rubble') {
  const ix = earcut(ring.flat(), null, 2);
  for (let i = 0; i < ix.length; i += 3)
    face(
      o,
      ix
        .slice(i, i + 3)
        .map((k) => [
          ring[k][0],
          typeof height === 'function' ? height(ring[k]) : height,
          ring[k][1],
        ]),
      color,
      slot,
      [0, 1, 0],
    );
}
export function devinDemHeight(x, z) {
  const ix = Math.max(0, Math.min(relief.xs.length - 2, Math.floor((x - relief.xs[0]) / 20))),
    iz = Math.max(0, Math.min(relief.zs.length - 2, Math.floor((z - relief.zs[0]) / 20))),
    u = Math.max(0, Math.min(1, (x - relief.xs[ix]) / 20)),
    v = Math.max(0, Math.min(1, (z - relief.zs[iz]) / 20)),
    a = relief.elevationsMeters;
  return (
    (1 - u) * (1 - v) * a[iz][ix] +
    u * (1 - v) * a[iz][ix + 1] +
    (1 - u) * v * a[iz + 1][ix] +
    u * v * a[iz + 1][ix + 1] -
    relief.datumMeters
  );
}
function inside(p, ring) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
const cliffCenter = [-195, -132],
  sourceTop = clean(frame.geometry.upperEnvelope, 0),
  sourceFeet = frame.controls.upperRock.outline;
function rayRing(a, ring) {
  const dx = a[0] - cliffCenter[0],
    dz = a[1] - cliffCenter[1];
  let best = Infinity,
    result;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i],
      q = ring[(i + 1) % ring.length],
      ex = q[0] - p[0],
      ez = q[1] - p[1],
      den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-9) continue;
    const ax = p[0] - cliffCenter[0],
      az = p[1] - cliffCenter[1],
      t = (ax * ez - az * ex) / den,
      u = (ax * dz - az * dx) / den;
    if (t > 0 && u >= -1e-9 && u <= 1.000000001 && t < best) {
      best = t;
      result = {
        point: [cliffCenter[0] + dx * t, cliffCenter[1] + dz * t],
        edge: i,
        u: Math.max(0, Math.min(1, u)),
      };
    }
  }
  if (!result) throw Error('Upper cliff ray misses source boundary');
  return result;
}
// Include every mapped top vertex and the original foot corners in one matching side ring.
// Joining only nine sampled top points left unsupported cap edges and a dropped doorway.
const inserts = sourceFeet.map((p) => rayRing(p, sourceTop));
const cliffUpper = sourceTop.flatMap((p, i) => [
  p,
  ...inserts
    .filter((q) => q.edge === i && q.u > 0.00001 && q.u < 0.99999)
    .sort((a, b) => a.u - b.u)
    .map((q) => q.point),
]);
const cliffTop = cliffUpper,
  cliffFeet = cliffTop.map((p) => rayRing(p, sourceFeet).point),
  cliffLevels = [0, 0.46, 0.77, 1];
function onTopEdge(x, z) {
  for (let i = 0; i < cliffUpper.length; i++) {
    const a = cliffUpper[i],
      b = cliffUpper[(i + 1) % cliffUpper.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      l = dx * dx + dz * dz;
    const u = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)) : 0;
    if (Math.hypot(x - a[0] - dx * u, z - a[1] - dz * u) < 0.002) return true;
  }
  return false;
}
function cliffPoint(i, j) {
  const f = cliffFeet[i],
    t = cliffTop[i],
    u = cliffLevels[j],
    bend = j === 1 ? ((i % 3) - 1) * 2.3 : 0;
  return [
    f[0] + (t[0] - f[0]) * u + bend,
    devinDemHeight(...f) * (1 - u) +
      frame.controls.upperRock.top * u +
      (j > 0 && j < 3 ? ((i % 3) - 1) * 2.5 : 0),
    f[1] + (t[1] - f[1]) * u,
  ];
}
const cliffTriangles = [];
for (let j = 1; j < cliffLevels.length; j++)
  for (let i = 0; i < cliffFeet.length; i++) {
    const k = (i + 1) % cliffFeet.length,
      a = cliffPoint(i, j - 1),
      b = cliffPoint(k, j - 1),
      c = cliffPoint(k, j),
      d = cliffPoint(i, j);
    cliffTriangles.push([a, b, c], [a, c, d]);
  }
export function devinGroundHeight(x, z) {
  let y = devinDemHeight(x, z);
  if (inside([x, z], cliffUpper) || onTopEdge(x, z)) y = Math.max(y, frame.controls.upperRock.top);
  for (const [a, b, c] of cliffTriangles) {
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(den) < 1e-9) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den,
      v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
    if (u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001)
      y = Math.max(y, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return y;
}
function slab(o, a, b, ya, yb, ha, hb, w, color = 'wall', slot = 'rubble', ends = true) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    l = Math.hypot(dx, dz);
  if (l < 0.002) return;
  const nx = ((-dz / l) * w) / 2,
    nz = ((dx / l) * w) / 2,
    p = (q, y, sign) => [q[0] + nx * sign, y, q[1] + nz * sign];
  for (const sign of [-1, 1])
    face(
      o,
      [p(a, ya, sign), p(b, yb, sign), p(b, yb + hb, sign), p(a, ya + ha, sign)],
      color,
      slot,
      [-dz * sign, 0, dx * sign],
    );
  face(
    o,
    [p(a, ya + ha, -1), p(b, yb + hb, -1), p(b, yb + hb, 1), p(a, ya + ha, 1)],
    color,
    slot,
    [0, 1, 0],
  );
  if (ends) {
    face(o, [p(a, ya, -1), p(a, ya, 1), p(a, ya + ha, 1), p(a, ya + ha, -1)], color, slot, [
      -dx,
      0,
      -dz,
    ]);
    face(o, [p(b, yb, 1), p(b, yb, -1), p(b, yb + hb, -1), p(b, yb + hb, 1)], color, slot, [
      dx,
      0,
      dz,
    ]);
  }
}
function heightFor(f, p) {
  let h = f.height;
  for (const a of apertures.wallAdjustments.filter((a) => a.way === f.way)) {
    if (!a.center) h = a.height;
    else {
      const t = Math.max(
        0,
        Math.min(1, (a.radius - Math.hypot(p[0] - a.center[0], p[1] - a.center[1])) / 3),
      );
      h = Math.max(h, h + (a.height - h) * t);
    }
  }
  return h;
}
function openingsFor(f, d) {
  return apertures.openings
    .filter((h) => h.ways.includes(f.way) && d >= h.minDetail)
    .map((h) => prepareOpening(h, devinGroundHeight(...h.center), d));
}
function wallArea(o, f, d) {
  const ring = clean(f.points, d === 1 ? 0.45 : 0),
    base = (p) => devinGroundHeight(...p);
  const top = (p) =>
    base(p) +
    heightFor(f, p) +
    (f.way === 114806630
      ? Math.max(0, Math.min(1, (p[1] + 28) / 30)) * (5.5 + 2 * Math.sin((p[0] + 123) * 0.6))
      : 0);
  const holes = openingsFor(f, d),
    sink = openingBuilder(o, holes),
    winding = Math.sign(area(ring));
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    face(
      sink,
      [
        [a[0], base(a), a[1]],
        [b[0], base(b), b[1]],
        [b[0], top(b), b[1]],
        [a[0], top(a), a[1]],
      ],
      'wall',
      'rubble',
      [winding * (b[1] - a[1]), 0, -winding * (b[0] - a[0])],
    );
  }
  cap(sink, ring, top);
  openingReveals(o, ring, base, top, holes, colors.wall);
}
function wallCourse(o, f, d) {
  const p = f.closed
    ? [...clean(f.points, d === 0 ? 2 : d === 1 ? 0.35 : 0), f.points[0]]
    : simplify(f.points, d === 0 ? 2 : d === 1 ? 0.35 : 0);
  const holes = openingsFor(f, d),
    sink = openingBuilder(o, holes);
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1],
      b = p[i],
      ya = devinGroundHeight(...a),
      yb = devinGroundHeight(...b),
      ha = heightFor(f, a),
      hb = heightFor(f, b);
    slab(sink, a, b, ya, yb, ha, hb, f.width, 'wall', 'rubble', i === 1 || i === p.length - 1);
    if (holes.length) {
      const dx = b[0] - a[0],
        dz = b[1] - a[1],
        l2 = dx * dx + dz * dz,
        l = Math.sqrt(l2),
        nx = ((-dz / l) * f.width) / 2,
        nz = ((dx / l) * f.width) / 2;
      if (l < 0.002) continue;
      const ring = [
          [a[0] + nx, a[1] + nz],
          [b[0] + nx, b[1] + nz],
          [b[0] - nx, b[1] - nz],
          [a[0] - nx, a[1] - nz],
        ],
        t = (q) => ((q[0] - a[0]) * dx + (q[1] - a[1]) * dz) / l2;
      openingReveals(
        o,
        ring,
        (q) => ya + (yb - ya) * t(q),
        (q) => ya + ha + (yb + hb - ya - ha) * t(q),
        holes,
        colors.wall,
      );
    }
  }
}
function terrain(o, d) {
  // Keep the original attributed site edge; no grass rectangle extending over the rivers.
  const ring = clean(frame.geometry.outline, d === 0 ? 2 : d === 1 ? 1 : 0.35),
    indices = earcut(ring.flat(), null, 2),
    spacing = d === 0 ? 80 : d === 1 ? 40 : 20;
  function triangle(p) {
    const lengths = p.map((a, i) => Math.hypot(a[0] - p[(i + 1) % 3][0], a[1] - p[(i + 1) % 3][1]));
    const longest = Math.max(...lengths);
    if (longest > spacing) {
      const i = lengths.indexOf(longest),
        a = p[i],
        b = p[(i + 1) % 3],
        c = p[(i + 2) % 3],
        m = a.map((v, k) => (v + b[k]) / 2);
      triangle([a, m, c]);
      triangle([m, b, c]);
      return;
    }
    face(
      o,
      p.map((q) => [q[0], devinDemHeight(...q), q[1]]),
      'grass',
      'foliage',
      [0, 1, 0],
    );
  }
  for (let i = 0; i < indices.length; i += 3) triangle(indices.slice(i, i + 3).map((k) => ring[k]));
}
function upperRock(o) {
  for (const t of cliffTriangles)
    face(o, t, 'rock', 'weathered', [t[1][2] - t[0][2], 0, t[0][0] - t[1][0]]);
  cap(o, cliffUpper, frame.controls.upperRock.top, 'rock', 'weathered');
}
function maiden(o, d) {
  const c = frame.controls.maiden,
    [x, z] = c.center,
    N = 8,
    angle = 0.2,
    ring = (r) =>
      Array.from({ length: N }, (_, i) => [
        x + Math.cos(angle + (i * 2 * Math.PI) / N) * r,
        z + Math.sin(angle + (i * 2 * Math.PI) / N) * r,
      ]);
  const root = ring(d === 0 ? 3.6 : 4.3),
    shoulder = ring(2.6),
    top = ring(1.6);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    face(
      o,
      [
        [...root[i].slice(0, 1), 0, root[i][1]],
        [root[j][0], 0, root[j][1]],
        [shoulder[j][0], c.base * 0.62, shoulder[j][1]],
        [shoulder[i][0], c.base * 0.62, shoulder[i][1]],
      ],
      'rock',
      'weathered',
    );
    face(
      o,
      [
        [shoulder[i][0], c.base * 0.62, shoulder[i][1]],
        [shoulder[j][0], c.base * 0.62, shoulder[j][1]],
        [top[j][0], c.base, top[j][1]],
        [top[i][0], c.base, top[i][1]],
      ],
      'rock',
      'weathered',
    );
  }
  cap(o, top, c.base, 'rock', 'weathered');
  const outer = ring(c.diameter / 2),
    inner = ring(c.diameter / 2 - c.wallThickness),
    body = c.height - 0.72;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    face(
      o,
      [
        [outer[i][0], c.base, outer[i][1]],
        [outer[j][0], c.base, outer[j][1]],
        [outer[j][0], c.base + body, outer[j][1]],
        [outer[i][0], c.base + body, outer[i][1]],
      ],
      'brick',
      'brick',
    );
    face(
      o,
      [
        [inner[j][0], c.base, inner[j][1]],
        [inner[i][0], c.base, inner[i][1]],
        [inner[i][0], c.base + body, inner[i][1]],
        [inner[j][0], c.base + body, inner[j][1]],
      ],
      'brick',
      'brick',
    );
    face(
      o,
      [
        [outer[i][0], c.base + body, outer[i][1]],
        [outer[j][0], c.base + body, outer[j][1]],
        [inner[j][0], c.base + body, inner[j][1]],
        [inner[i][0], c.base + body, inner[i][1]],
      ],
      'brick',
      'brick',
      [0, 1, 0],
    );
    const a = outer[i].map((v, k) => (v + inner[i][k]) / 2),
      b = outer[j].map((v, k) => (v + inner[j][k]) / 2),
      a1 = a.map((v, k) => v * 0.78 + b[k] * 0.22),
      b1 = a.map((v, k) => v * 0.22 + b[k] * 0.78);
    slab(o, a1, b1, c.base + body, c.base + body, 0.72, 0.72, c.wallThickness, 'brick', 'brick');
  }
}
function attic(o, d) {
  if (d === 0) return;
  for (const way of [1504263175, 1504263177]) {
    const f = frame.geometry.wallFeatures.find((f) => f.way === way),
      ring = clean(f.points, 0);
    const edges = ring
      .map((a, i) => {
        const b = ring[(i + 1) % ring.length],
          length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        return { a, b, length };
      })
      .filter((e) => e.length > 10)
      .sort((a, b) => b.length - a.length);
    const e = edges[0];
    if (!e) continue;
    const axis = e.a.map((v, k) => (e.b[k] - v) / e.length),
      project = (p) => p[0] * axis[0] + p[1] * axis[1];
    const other = edges
      .slice(1)
      .find(
        (q) =>
          Math.abs(((q.b[0] - q.a[0]) * axis[0] + (q.b[1] - q.a[1]) * axis[1]) / q.length) > 0.95,
      );
    if (!other) throw Error('Bathory attic needs paired mapped wall faces');
    const limits = (q) => [
      Math.min(project(q.a), project(q.b)),
      Math.max(project(q.a), project(q.b)),
    ];
    const [a0, a1] = limits(e),
      [b0, b1] = limits(other),
      lo = Math.max(a0, b0),
      hi = Math.min(a1, b1),
      N = Math.floor((hi - lo) / 2.5);
    const at = (q, u) =>
      q.a.map((v, k) => v + ((q.b[k] - v) * (u - project(q.a))) / (project(q.b) - project(q.a)));
    // One scalloped masonry profile spans the two actual wall faces. Emitting a
    // separate narrow row on each boundary had produced four unsupported rows.
    for (let i = 0; i < N; i++) {
      const from = lo + ((hi - lo) * (i + 0.06)) / N,
        to = lo + ((hi - lo) * (i + 0.94)) / N,
        count = d === 1 ? 2 : 4;
      for (let j = 0; j < count; j++) {
        const u = j / count,
          v = (j + 1) / count,
          x0 = from + (to - from) * u,
          x1 = from + (to - from) * v;
        const a = at(e, x0),
          b = at(e, x1),
          q = at(other, x1),
          p = at(other, x0),
          foot = [a, b, q, p],
          winding = Math.sign(area(foot));
        const base = (r) => devinGroundHeight(...r) + f.height,
          h0 = Math.sqrt(Math.max(0, 1 - (2 * u - 1) ** 2)) * 1.2,
          h1 = Math.sqrt(Math.max(0, 1 - (2 * v - 1) ** 2)) * 1.2;
        const point = (r, h) => [r[0], base(r) + h, r[1]];
        face(o, [point(a, 0), point(b, 0), point(b, h1), point(a, h0)], 'wall', 'rubble', [
          winding * (b[1] - a[1]),
          0,
          -winding * (b[0] - a[0]),
        ]);
        face(o, [point(q, 0), point(p, 0), point(p, h0), point(q, h1)], 'wall', 'rubble', [
          winding * (p[1] - q[1]),
          0,
          -winding * (p[0] - q[0]),
        ]);
        face(
          o,
          [point(a, h0), point(b, h1), point(q, h1), point(p, h0)],
          'wall',
          'rubble',
          [0, 1, 0],
        );
        if (j === 0)
          face(o, [point(p, 0), point(a, 0), point(a, h0), point(p, h0)], 'wall', 'rubble', [
            -axis[0],
            0,
            -axis[1],
          ]);
        if (j === count - 1)
          face(o, [point(b, 0), point(q, 0), point(q, h1), point(b, h1)], 'wall', 'rubble', [
            axis[0],
            0,
            axis[1],
          ]);
      }
    }
  }
}
function details(o, d) {
  if (d < 1) return;
  const w = frame.controls.well,
    ring = Array.from({ length: 12 }, (_, i) => [
      w.center[0] + (Math.cos((i * Math.PI) / 6) * w.diameter) / 2,
      w.center[1] + (Math.sin((i * Math.PI) / 6) * w.diameter) / 2,
    ]);
  wallCourse(o, { points: ring, closed: true, height: w.height, width: 0.45 }, d);
  for (const route of apertures.approachRoutes) {
    for (let j = 1; j < route.points.length; j++) {
      const p = route.points[j - 1],
        q = route.points[j],
        length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const count =
        route.kind === 'steps'
          ? d === 1
            ? 3
            : Math.max(2, Math.min(20, Math.ceil(length / 0.8)))
          : 1;
      for (let i = 0; i < count; i++) {
        const a = p.map((v, k) => v + ((q[k] - v) * i) / count),
          b = p.map((v, k) => v + ((q[k] - v) * (i + 1)) / count);
        const ya = devinGroundHeight(...a),
          yb = devinGroundHeight(...b),
          y = Math.max(ya, yb) + 0.13;
        slab(
          o,
          a,
          b,
          ya,
          yb,
          Math.max(0.13, y - ya),
          Math.max(0.13, y - yb),
          route.width,
          'paving',
          'aggregate',
        );
      }
    }
  }
  // Courtyard floor is below all ruin walls, never at the roof plane.
  cap(
    o,
    clean(frame.geometry.middleEnvelope, 0.3),
    (p) => devinGroundHeight(...p) + 0.08,
    'paving',
    'aggregate',
  );
}
function build(o, d) {
  terrain(o, d);
  upperRock(o, d);
  maiden(o, d);
  if (d === 0) {
    const env = clean(frame.geometry.upperEnvelope, 1.9);
    wallCourse(
      o,
      { points: env, closed: true, base: frame.controls.upperRock.top, height: 7.8, width: 1.8 },
      d,
    );
    const major = [60846906, 60846886, 1504263179, 1504263178, 114806630];
    for (const id of major) {
      const f = frame.geometry.wallFeatures.find((f) => f.way === id),
        p = f.points;
      const halfway = Math.floor((p.length - 1) / 2);
      wallCourse(
        o,
        { ...f, closed: false, points: simplify(p.slice(0, halfway + 1), 4), width: 2.2 },
        d,
      );
    }
  } else
    for (const f of frame.geometry.wallFeatures) {
      if (d === 1 && f.group === 'archaeology' && !['60846888', '60846894'].includes(String(f.way)))
        continue;
      if (f.area) wallArea(o, f, d);
      else wallCourse(o, f, d);
    }
  attic(o, d);
  details(o, d);
}
export const buildDevinRuntime = (o, level = 'closeup') =>
  build(o, { skyline: 0, district: 1, street: 2, closeup: 3 }[level] ?? 3);
export const buildDevinSkyline = (o) =>
  build(
    {
      addTriangle: (s, r, p, n, uv, c) =>
        o.addTriangle(
          'silhouette',
          r,
          p,
          n,
          uv,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    },
    0,
  );
export const devinStudy = {
  id: 'N0292',
  key: 'devin_castle',
  title: 'Devín Castle',
  category: 'castle',
  wikidataId: 'Q830976',
  mapFrame: 'map-frame.json',
  fidelityTarget: 'medium-fi',
  previewImage: 'shots/shared/angle-0.png',
  build: (o) => buildDevinRuntime(o),
  brief:
    'Roofless upper ruins raised on a faceted pale cliff, lower terrain-following curtains, Garay palace remnants, Bathory scalloped attic, open middle courtyard and the separate tiny octagonal Maiden Tower on a slender rock spur.',
  appearance: {
    standard: 'docs-src/guide/medium-fi.md',
    paletteSrgb: devinPalette,
    colorEncoding: 'sRGB decoded to linear COLOR_0',
    flatSurfaceMeansLinear: means,
    materialBudget: 5,
    identityFeatures: [
      'Tall pale cliff with roofless upper fortress',
      'Lower irregular fortified enclosure and ruined palaces',
      'Tiny isolated octagonal Maiden Tower on a narrow rock spur',
    ],
  },
  sourceFacts: {
    mapIdentity: 'way/722938329 exact Q830976 site, not building footprint',
    independentWallFeatures: 41,
    authoredApertures: apertures.openings.length,
    mappedEntranceNodes: apertures.openings.filter((h) => h.mapNode).map((h) => h.mapNode),
    maidenTowerDiameterMeters: 2.8,
    maidenTowerHeightMeters: 4.88,
    castleRockHeightMuseum: 'more than70m',
    terrainGridSpacingMeters: 20,
    terrainSourceResolutionApproxMeters: 30,
  },
  reconstruction: frame.reconstruction,
  scaleBasis:
    'Own mapped masonry areas and centerlines; primary museum tower dimensions and photograph-informed ruin heights. Relative coarse DEM plus explicit approximate cliff/terraces.',
  refs: references.references.map((r) => r.url),
  sourceDocuments: [
    'map-frame.json',
    'openings.json',
    'relief-grid.json',
    'surface-means.json',
    'reference-metadata.json',
  ],
  nativeAxes: frame.nativeAxes,
  sourceLicense:
    'Original model geometry under repository license. Mapped wall traces © OpenStreetMap contributors,ODbL-1.0. Terrain produced using Copernicus data and information funded by the European Union - EU-DEM layers,via Mapzen. Research photographs remain private.',
  sourceNotice:
    'No downloaded meshes or photo textures. Own attributed map traces are interpreted with original height controls. Detailed relative terrain is a source study,not a real-site height certification.',
  dataAttribution:
    '© OpenStreetMap contributors;Bratislava City Museum;Mapzen Terrain Tiles;Copernicus/EU-DEM.',
  geographic: () => ({
    status: 'research-only',
    replaceFootprint: false,
    groundModelY: devinDemHeight(0, 0),
    notes:
      'Own East/South signed frame and relative134.99m terrain minimum. Subtract source DEM anchor35.04m relative height for terrain attachment. Main cliff,terraces and footings still need host-terrain blending and vertical datum/current-state review before activation.',
    reviewStatus: 'Inactive draft;real geographic fit pending',
  }),
  geographicNote:
    'Site boundary is not a building replacement. Terrain/cliff interpretation requires real-site placement and vertical datum review;inactive draft.',
  limitations: references.limitations,
  importReason:
    'Preserve individual surviving masonry and Devín identity with shared surfaces and four separate source-derived detail levels.',
  mediumFiContext: { scale: '6', neighborStyle: 'molen.worldgen.catalog.german_fachwerk' },
  camera: { position: [320, 320, 360], lookAt: [-85, 33, -15], fov: 43 },
  qaCameras: [
    { name: 'upper-cliff-and-maiden', position: [-410, 145, -270], lookAt: [-198, 52, -115] },
    { name: 'garay-and-bathory-courts', position: [-30, 100, 60], lookAt: [-135, 44, -65] },
    { name: 'own-wall-plan', position: [-55, 780, 1], lookAt: [-55, 20, 0] },
    { name: 'maiden-open-crenellation', position: [-267, 36, -67], lookAt: [-245, 27.4, -87] },
    { name: 'upper-roofless-courtyard', position: [-150, 125, -180], lookAt: [-195, 72, -130] },
    { name: 'moravian-gate-passage', position: [-68, 25, -161], lookAt: [-50.1, 20.2, -143.8] },
    { name: 'bathory-west-openings', position: [-153, 64, -91], lookAt: [-111, 49, -63] },
  ],
};

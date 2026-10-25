/** Whole native defensive ensemble; independent source terrain supplies the natural monolith. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { loft, normalFor, normalize } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';
import { box } from './structure-mesh.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/te/tet/daulatabad_fort/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  g = JSON.parse(fs.readFileSync(new URL('terrain-grid.json', dir))),
  ref = 'palette:#ffffff';
const C = {
  stone: rgb('77766c'),
  roof: rgb('77756a'),
  lime: rgb('bebcb0'),
  red: rgb('b17d65'),
  wood: rgb('665a43'),
  tile: rgb('879ba0'),
};
const surfaces = {
  stone: { slot: 'wall', graph: 'stone_basalt', roughness: 0.96, metallic: 0 },
  roof: { slot: 'roof', graph: 'stone_basalt_raw', roughness: 0.97, metallic: 0 },
  lime: { slot: 'trim', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
  red: { slot: 'wall', graph: 'plaster_tadelakt', roughness: 0.94, metallic: 0 },
  wood: { slot: 'door', graph: 'wood_plain', roughness: 0.95, metallic: 0 },
  tile: { slot: 'trim', graph: 'tile_ceramic', roughness: 0.75, metallic: 0 },
};
export function daulatabadHeight([x, z]) {
  const a = (x - g.origin[0]) / g.stepMeters,
    b = (z - g.origin[1]) / g.stepMeters,
    i = Math.floor(a),
    j = Math.floor(b),
    u = a - i,
    v = b - j;
  if (i < 0 || j < 0 || i >= g.size[0] - 1 || j >= g.size[1] - 1)
    throw Error('Fort escapes frozen terrain');
  return (
    (g.heightsMeters[j][i] * (1 - u) + g.heightsMeters[j][i + 1] * u) * (1 - v) +
    (g.heightsMeters[j + 1][i] * (1 - u) + g.heightsMeters[j + 1][i + 1] * u) * v -
    g.modelDatumElevationMeters
  );
}
const H = daulatabadHeight,
  mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
  mid = (a, b) => mix(a, b, 0.5);
function T(o, s, q, n) {
  q = q.map((p) => p.map(Math.fround));
  const nn = normalFor(...q);
  if (nn.every((v) => v === 0)) return;
  if (n && nn.reduce((v, x, i) => v + x * n[i], 0) < 0) q = [q[0], q[2], q[1]];
  o.addTriangle(
    s,
    ref,
    q,
    normalFor(...q),
    q.map((p) => [p[0], p[1]]),
    C[s],
  );
}
function Q(o, s, q, n) {
  T(o, s, q.slice(0, 3), n);
  T(o, s, [q[0], q[2], q[3]], n);
}
function frame(center, heading) {
  const c = Math.cos(heading),
    s = Math.sin(heading);
  return {
    P: (x, y, z = 0) => [center[0] + c * x + s * z, y, center[1] - s * x + c * z],
    V: ([x, y, z]) => [c * x + s * z, y, -s * x + c * z],
  };
}
function local(o, F) {
  return {
    addTriangle: (s, r, q, n, u, c) =>
      o.addTriangle(
        s,
        r,
        q.map((q) => F.P(...q)),
        F.V(n),
        u,
        c,
      ),
    addQuad: (s, r, q, n, u, c) =>
      o.addQuad(
        s,
        r,
        q.map((q) => F.P(...q)),
        F.V(n),
        u,
        c,
      ),
    addConvexPolygon: (s, r, q, n, _u, c) =>
      o.addConvexPolygon(
        s,
        r,
        q.map((q) => F.P(...q)),
        F.V(n),
        (q) => [q[0], q[2]],
        c,
      ),
  };
}
function prism(o, s, ring, y0, y1) {
  const ix = earcut(ring.flat());
  for (let i = 0; i < ix.length; i += 3) {
    T(
      o,
      s,
      ix.slice(i, i + 3).map((i) => [ring[i][0], y1, ring[i][1]]),
      [0, 1, 0],
    );
    T(
      o,
      s,
      ix.slice(i, i + 3).map((i) => [ring[i][0], y0, ring[i][1]]),
      [0, -1, 0],
    );
  }
  const winding = Math.sign(
    ring.reduce((v, a, i) => {
      const b = ring[(i + 1) % ring.length];
      return v + a[0] * b[1] - b[0] * a[1];
    }, 0),
  );
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [winding * (b[1] - a[1]), 0, winding * (a[0] - b[0])],
    );
  }
}
function arch(w, bottom, spring, rise, N) {
  const q = [
    [-w / 2, bottom],
    [w / 2, bottom],
    [w / 2, spring],
  ];
  for (let i = 1; i <= N; i++) {
    const x = w / 2 - (w * i) / N,
      t = Math.abs(x) / (w / 2),
      y =
        spring +
        (rise * Math.sqrt(Math.max(0, 1.7 * 1.7 - (0.7 + t) * (0.7 + t)))) / Math.sqrt(2.4);
    q.push([x, y]);
  }
  return q;
}
function panel(o, s, F, w, y0, y1, holes, depth = 0.7, z = 0, profile) {
  const outer = profile ?? [
      [-w / 2, y0],
      [w / 2, y0],
      [w / 2, y1],
      [-w / 2, y1],
    ],
    qs = [outer, ...holes],
    points = qs.flat(),
    starts = holes.map(
      (_, i) => outer.length + holes.slice(0, i).reduce((s, r) => s + r.length, 0),
    ),
    ix = earcut(points.flat(), starts);
  for (let i = 0; i < ix.length; i += 3)
    for (const side of [-1, 1])
      T(
        o,
        s,
        ix.slice(i, i + 3).map((i) => F.P(points[i][0], points[i][1], z + (side * depth) / 2)),
        F.V([0, 0, side]),
      );
  for (let k = 0; k < qs.length; k++)
    for (let i = 0; i < qs[k].length; i++) {
      const a = qs[k][i],
        b = qs[k][(i + 1) % qs[k].length],
        sign = k ? -1 : 1,
        n = F.V([sign * (b[1] - a[1]), sign * (a[0] - b[0]), 0]);
      Q(
        o,
        s,
        [
          F.P(a[0], a[1], z - depth / 2),
          F.P(b[0], b[1], z - depth / 2),
          F.P(b[0], b[1], z + depth / 2),
          F.P(a[0], a[1], z + depth / 2),
        ],
        n,
      );
    }
}
function distance(q, a, b) {
  const u = b.map((v, i) => v - a[i]),
    l = u[0] * u[0] + u[1] * u[1],
    t = l === 0 ? 0 : Math.max(0, Math.min(1, q.reduce((s, v, i) => s + (v - a[i]) * u[i], 0) / l)),
    point = mix(a, b, t);
  return { distance: Math.hypot(...q.map((v, i) => v - point[i])), t, point };
}
function simplify(q, tol) {
  if (!tol || q.length < 3) return q;
  let at = 0,
    d = 0;
  for (let i = 1; i < q.length - 1; i++) {
    const v = distance(q[i], q[0], q.at(-1)).distance;
    if (v > d) {
      d = v;
      at = i;
    }
  }
  return d > tol
    ? [...simplify(q.slice(0, at + 1), tol).slice(0, -1), ...simplify(q.slice(at), tol)]
    : [q[0], q.at(-1)];
}
function ringSamples(q, N) {
  const closed = [...q, q[0]],
    segments = q.map((a, i) => Math.hypot(...closed[i + 1].map((v, j) => v - a[j]))),
    total = segments.reduce((s, v) => s + v, 0);
  return Array.from({ length: N }, (_, i) => {
    let target = (total * i) / N,
      k = 0;
    while (target > segments[k]) target -= segments[k++];
    return mix(closed[k], closed[k + 1], target / segments[k]);
  });
}
function nearest(q, ring) {
  let best = { distance: Infinity };
  for (let i = 0; i < ring.length; i++) {
    const v = distance(q, ring[i], ring[(i + 1) % ring.length]);
    if (v.distance < best.distance) best = v;
  }
  return best.point;
}
const moatInner = ringSamples(p.moat.inner, 32),
  moatOuter = moatInner.map((q) => nearest(q, p.moat.outer)),
  moatOpenings = moatInner.map((q, i) => [
    q,
    moatInner[(i + 1) % 32],
    moatOuter[(i + 1) % 32],
    moatOuter[i],
  ]);
const palaceGate = {
  id: p.palace.id,
  center: p.palace.center,
  heading: p.palace.heading,
  openingWidth: 2.2,
  openingHeight: 3.8,
};
function gateFrames() {
  return p.gates.map((g) => {
    let best = { distance: Infinity };
    for (const w of p.walls)
      for (let i = 1; i < w.points.length; i++) {
        const d = distance(g.center, w.points[i - 1], w.points[i]);
        if (d.distance < best.distance) best = { ...d, a: w.points[i - 1], b: w.points[i] };
      }
    const heading = Math.atan2(-(best.b[1] - best.a[1]), best.b[0] - best.a[0]);
    return { ...g, heading };
  });
}
const gates = gateFrames(),
  allGatePoints = [...gates, palaceGate];
function wallPoints(wall, d, tolerance) {
  if (d === 0 || tolerance === 0) return simplify(wall.points, tolerance);
  const pins = new Set([0, wall.points.length - 1]);
  for (const gate of allGatePoints) {
    for (let i = 1; i < wall.points.length; i++) {
      if (distance(gate.center, wall.points[i - 1], wall.points[i]).distance >= 4) continue;
      for (let j = Math.max(0, i - 2); j <= Math.min(wall.points.length - 1, i + 1); j++)
        pins.add(j);
    }
  }
  const indices = [...pins].sort((a, b) => a - b),
    result = [];
  for (let i = 1; i < indices.length; i++) {
    const part = simplify(wall.points.slice(indices[i - 1], indices[i] + 1), tolerance);
    result.push(...(i === 1 ? part : part.slice(1)));
  }
  return result;
}
function wallSegment(o, a, b, y0, y1, height, width) {
  const u = normalize([b[0] - a[0], 0, b[1] - a[1]]),
    n = [(u[2] * width) / 2, 0, (-u[0] * width) / 2],
    A = [a[0], y0, a[1]],
    B = [b[0], y1, b[1]],
    P = (q, side, top) => q.map((v, i) => v + side * n[i] + (i === 1 && top ? height : 0));
  for (const side of [-1, 1])
    Q(
      o,
      'stone',
      [P(A, side, 0), P(B, side, 0), P(B, side, 1), P(A, side, 1)],
      n.map((v) => v * side),
    );
  Q(o, 'roof', [P(A, -1, 1), P(B, -1, 1), P(B, 1, 1), P(A, 1, 1)], [0, 1, 0]);
}
function defenses(o, d) {
  const tolerance = [85, 14, 3, 0][d];
  for (const wall of [
    ...p.walls,
    {
      id: 'upper-citadel-perimeter',
      points: [...p.citadel, p.citadel[0]],
      family: 'upper-citadel',
    },
  ]) {
    const q = wallPoints(wall, d, tolerance),
      height =
        wall.family === 'outer-city-defense' ? 5.4 : wall.family === 'upper-citadel' ? 2.2 : 7.5,
      width = wall.family === 'outer-city-defense' ? 1.9 : 2.4;
    for (let i = 1; i < q.length; i++) {
      const a = q[i - 1],
        b = q[i],
        len = Math.hypot(...b.map((v, k) => v - a[k]));
      if (len < 0.01) continue;
      const cuts = [];
      for (const gate of allGatePoints) {
        const t = distance(gate.center, a, b);
        if (t.distance < 3.2)
          cuts.push([
            Math.max(0, t.t - (gate.openingWidth / 2 + 0.15) / len),
            Math.min(1, t.t + (gate.openingWidth / 2 + 0.15) / len),
          ]);
      }
      cuts.sort((a, b) => a[0] - b[0]);
      let start = 0;
      for (const [l, r] of [...cuts, [1, 1]]) {
        if (l > start) {
          const A = mix(a, b, start),
            B = mix(a, b, l);
          wallSegment(o, A, B, H(A) - 0.5, H(B) - 0.5, height, width);
        }
        start = Math.max(start, r);
      }
      if (d) {
        const pitch = [0, 140, 26, 4.5][d],
          count = Math.floor(len / pitch);
        for (let k = 0; k < count; k++) {
          const t = (k + 0.5) / count,
            x = mix(a, b, t);
          if (
            allGatePoints.some(
              (g) => Math.hypot(...x.map((v, i) => v - g.center[i])) < g.openingWidth / 2 + 0.5,
            )
          )
            continue;
          const F = frame(x, Math.atan2(-(b[1] - a[1]), b[0] - a[0])),
            y = H(x) + height - 0.5,
            w = d === 1 ? 1.4 : 1.1;
          const bld = local(o, F);
          box(bld, 'stone', [-w / 2, y, -width / 2], [w / 2, y + 0.85, width / 2], C.stone);
          if (d > 1) {
            const cap = [
              [-w / 2, y + 0.85],
              [w / 2, y + 0.85],
              [0.3, y + 1.35],
              [-0.3, y + 1.35],
            ];
            panel(o, 'stone', F, w, y + 0.85, y + 1.35, [], width, 0, cap);
          }
        }
      }
    }
  }
}
function round(o, s, c, y, profile, N) {
  loft(
    o,
    s,
    profile.map(([h, r]) =>
      Array.from({ length: N }, (_, i) => [
        c[0] + r * Math.sin((i * 2 * Math.PI) / N),
        y + h,
        c[1] + r * Math.cos((i * 2 * Math.PI) / N),
      ]),
    ),
    C[s],
  );
}
function minaret(o, d) {
  const N = [4, 12, 24, 48][d],
    base = H([0, 0]);
  round(
    o,
    'red',
    [0, 0],
    base,
    [
      [0, 3.4],
      [16, 3.25],
      [18, 4.8],
      [20, 5.4],
      [21.2, 3.05],
      [37.4, 2.75],
      [39, 3.65],
      [40, 2.5],
      [52.6, 2.3],
      [54, 2.95],
      [55.2, 1.95],
      [59.8, 1.8],
      ...(d === 0 ? [] : [[61, 1.55]]),
      [62.6, 0.8],
      [63.2, 0.22],
      [64, 0.15],
    ],
    N,
  );
  if (d)
    for (const [h, r] of [
      [20, 5.4],
      [39, 3.65],
      [54, 2.95],
    ]) {
      round(
        o,
        'red',
        [0, 0],
        base,
        [
          [h - 0.25, r],
          [h + 0.35, r],
          [h + 0.35, r - 0.35],
          [h - 0.25, r - 0.35],
        ],
        N,
      );
      const count = [0, 8, 16, 28][d];
      for (let k = 0; k < count; k++) {
        const a = (k * 2 * Math.PI) / count,
          F = frame([Math.sin(a) * (r - 0.2), Math.cos(a) * (r - 0.2)], a),
          b = local(o, F);
        box(b, 'red', [-0.23, base + h + 0.3, -0.23], [0.23, base + h + 1.05, 0.23], C.red);
      }
      if (d > 1)
        for (let k = 0; k < 24; k++) {
          const a = (k * 2 * Math.PI) / 24,
            F = frame([Math.sin(a) * (r - 0.65), Math.cos(a) * (r - 0.65)], a);
          const b = local(o, F);
          box(b, 'red', [-0.13, base + h - 1.8, -0.3], [0.13, base + h - 0.3, 0.5], C.red);
        }
    }
}
function gateways(o, d) {
  for (const g of gates) {
    const F = frame(g.center, g.heading),
      b = local(o, F),
      y = H(g.center),
      w = g.openingWidth,
      hi = g.id === 'node/13256186785' ? 6.5 : 9;
    panel(
      o,
      'stone',
      F,
      w + 4,
      y,
      y + hi,
      [arch(w, y, y + g.openingHeight - 1.6, 1.6, [2, 4, 8, 12][d])],
      2.5,
    );
    if (d > 0) {
      box(
        b,
        'lime',
        [-w / 2 - 0.25, y + hi - 1.1, 1.3],
        [w / 2 + 0.25, y + hi - 0.85, 1.6],
        C.lime,
      );
      for (const x of [-w / 2 - 2.6, w / 2 + 2.6])
        round(
          o,
          'stone',
          F.P(x, 0, 0).filter((_, i) => i !== 1),
          y,
          [
            [0, 2.4],
            [hi, 2.4],
          ],
          d === 1 ? 6 : 12,
        );
    }
  }
}
function palace(o, d) {
  const a = p.palace,
    F = frame(a.center, a.heading),
    b = local(o, F),
    y = H(a.center),
    N = [2, 4, 8, 12][d],
    lower = arch(2.2, y, y + 2.6, 1.2, N);
  panel(o, 'stone', F, a.width, y, y + 8.8, [lower], a.depth);
  if (d) {
    for (const side of [-1, 1]) {
      box(
        b,
        'stone',
        [side < 0 ? -3.75 : 2.45, y + 8.5, -a.depth / 2],
        [side < 0 ? -2.45 : 3.75, y + (side < 0 ? 10 : 12.2), a.depth / 2],
        C.stone,
      );
      box(
        b,
        'lime',
        [side * 3 - 0.32, y + 0.8, a.depth / 2 + 0.04],
        [side * 3 + 0.32, y + 8.6, a.depth / 2 + 0.16],
        C.lime,
      );
      box(
        b,
        'tile',
        [side * 3 - 0.24, y + 4.2, a.depth / 2 + 0.17],
        [side * 3 + 0.24, y + 7.9, a.depth / 2 + 0.21],
        C.tile,
      );
    }
    const niche = arch(3.9, y + 4.1, y + 6.3, 1.8, N);
    panel(o, 'lime', F, 4.5, y + 3.8, y + 8.5, [niche], 0.18, a.depth / 2 + 0.08);
    panel(o, 'stone', F, 3.9, y + 4.1, y + 8.1, [], 0.15, a.depth / 2 - 0.25);
  }
}
function baradari(o, d) {
  const a = p.pavilion,
    F = frame(a.center, a.heading),
    b = local(o, F),
    y = H(a.center),
    r = [
      [-12, -7],
      [12, -7],
      [12, 4],
      [9, 7],
      [-9, 7],
      [-12, 4],
    ];
  prism(b, 'stone', r, y - 0.8, y + 4.9);
  prism(b, 'roof', r, y + 9.5, y + 9.9);
  prism(b, 'stone', r, y + 9.9, y + 11.5);
  for (let i = 1; i < r.length; i++) {
    const A = r[i],
      B = r[(i + 1) % r.length],
      length = Math.hypot(B[0] - A[0], B[1] - A[1]),
      worldA = F.P(A[0], 0, A[1]),
      worldB = F.P(B[0], 0, B[1]),
      c = [(worldA[0] + worldB[0]) / 2, (worldA[2] + worldB[2]) / 2],
      W = frame(c, Math.atan2(-(worldB[2] - worldA[2]), worldB[0] - worldA[0])),
      count = d === 0 ? 1 : Math.max(1, Math.round(length / 3)),
      pitch = length / count,
      holes = Array.from({ length: count }, (_, k) =>
        arch(Math.max(0.6, pitch - 0.48), y + 5, y + 7.5, 1.4, [2, 4, 8, 12][d]).map(([x, yy]) => [
          x + (k + 0.5) * pitch - length / 2,
          yy,
        ]),
      );
    panel(o, 'lime', W, length, y + 5, y + 9.5, holes, 0.6);
    if (d > 1)
      for (let k = 0; k < count; k++) {
        const x = (k + 0.5) * pitch - length / 2,
          bb = local(o, W);
        box(bb, 'stone', [x - 0.14, y + 4.1, -0.2], [x + 0.14, y + 4.9, 1.1], C.stone);
      }
  }
  for (const x of [-10, 10]) box(b, 'stone', [x - 3, y, -7], [x + 3, y + 9.5, -1], C.stone);
}
function court(o, d) {
  const r = p.temple.ring,
    y = H(r.reduce((s, q) => s.map((v, i) => v + q[i] / r.length), [0, 0]));
  for (let i = 0; i < r.length; i++) {
    const A = r[i],
      B = r[(i + 1) % r.length],
      len = Math.hypot(...B.map((v, k) => v - A[k])),
      F = frame(mid(A, B), Math.atan2(-(B[1] - A[1]), B[0] - A[0])),
      b = local(o, F),
      count = [1, 4, Math.max(4, Math.round(len / 6)), Math.max(4, Math.round(len / 3.8))][d];
    box(b, 'roof', [-len / 2, y + 4.3, -3], [len / 2, y + 4.8, 3], C.roof);
    for (let k = 0; k <= count; k++) {
      const x = -len / 2 + (len * k) / count;
      box(b, 'lime', [x - 0.32, y, -0.4], [x + 0.32, y + 4.4, 0.4], C.lime);
    }
    box(b, 'stone', [-len / 2, y - 0.2, -3], [len / 2, y + 0.1, 3], C.stone);
  }
}
function voids(o, d) {
  const N = [12, 20, 32, 64][d],
    inner = ringSamples(p.moat.inner, N),
    outer = inner.map((q) => nearest(q, p.moat.outer));
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N,
      A = inner[i],
      B = inner[j],
      C0 = outer[i],
      D = outer[j],
      ya = H(A),
      yb = H(B),
      yc = H(C0),
      yd = H(D),
      ba = Math.min(ya, yc) - 10,
      bb = Math.min(yb, yd) - 10;
    Q(o, 'stone', [
      [A[0], ba, A[1]],
      [B[0], bb, B[1]],
      [B[0], yb + 1, B[1]],
      [A[0], ya + 1, A[1]],
    ]);
    Q(o, 'stone', [
      [C0[0], yc + 1, C0[1]],
      [D[0], yd + 1, D[1]],
      [D[0], bb, D[1]],
      [C0[0], ba, C0[1]],
    ]);
    Q(
      o,
      'roof',
      [
        [A[0], ba, A[1]],
        [C0[0], ba, C0[1]],
        [D[0], bb, D[1]],
        [B[0], bb, B[1]],
      ],
      [0, 1, 0],
    );
  }
  const r = p.tank.ring,
    top = H(r[0]),
    floor = top - 5;
  prism(o, 'roof', r, floor - 0.3, floor);
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    wallSegment(o, a, b, floor, floor, 5, 1.1);
  }
  const [a, b] = p.shortCrossing,
    F = frame(mid(a, b), Math.atan2(-(b[1] - a[1]), b[0] - a[0])),
    len = Math.hypot(...b.map((v, i) => v - a[i])),
    yy = Math.max(H(a), H(b)) + 0.4,
    bb = local(o, F);
  box(bb, 'stone', [-len / 2, yy - 0.8, -1.6], [len / 2, yy, 1.6], C.stone);
}
function build(o, _frame, d = 3) {
  defenses(o, d);
  voids(o, d);
  minaret(o, d);
  gateways(o, d);
  palace(o, d);
  baradari(o, d);
  court(o, d);
}
export const daulatabadSkyline = (o, f) => build(o, f, 0),
  daulatabadDistrict = (o, f) => build(o, f, 1),
  daulatabadStreet = (o, f) => build(o, f, 2),
  daulatabadCloseup = (o, f) => build(o, f, 3);
const by = H(p.pavilion.center),
  cy = H(p.palace.center),
  my = H([0, 0]),
  bridge = mid(...p.shortCrossing),
  temple = p.temple.ring.reduce((s, q) => s.map((v, i) => v + q[i] / p.temple.ring.length), [0, 0]),
  tank = p.tank.ring.reduce((s, q) => s.map((v, i) => v + q[i] / p.tank.ring.length), [0, 0]);
export const daulatabadFortModel = {
  id: 'daulatabad_fort',
  key: 'daulatabad_fort',
  recipe: 'structure-daulatabad-fort.mjs',
  cell: 'te/tet',
  title: 'Daulatabad Fort',
  category: 'fortress',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [380, 260, 540],
  lookAt: [-200, 70, 130],
  mediumFiContext: {
    scale: 8,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  qaCameras: [
    {
      name: 'whole-surviving-fort-defenses-and-real-monolith',
      position: [1500, 1100, 1800],
      lookAt: [-100, 70, 150],
    },
    {
      name: 'chand-minar-three-flared-balconies-and-domed-crown',
      position: [85, my + 45, 115],
      lookAt: [0, my + 32, 0],
    },
    {
      name: 'summit-baradari-open-white-pointed-arch-gallery',
      position: [p.pavilion.center[0] + 50, by + 14, p.pavilion.center[1] + 65],
      lookAt: [p.pavilion.center[0], by + 7, p.pavilion.center[1]],
    },
    {
      name: 'chini-mahal-palace-prison-open-passage-and-asymmetric-crown',
      position: [p.palace.center[0] + 35, cy + 10, p.palace.center[1] + 18],
      lookAt: [p.palace.center[0], cy + 5, p.palace.center[1]],
    },
    {
      name: 'native-mapped-lower-bastioned-gates-and-ramparts',
      position: [p.approach[0] + 55, H(p.approach) + 18, p.approach[1] + 40],
      lookAt: [p.approach[0], H(p.approach) + 4, p.approach[1]],
    },
    {
      name: 'native-artificial-moat-cut-rock-edges-and-short-crossing',
      position: [bridge[0] + 45, H(bridge) + 65, bridge[1] + 35],
      lookAt: [bridge[0], H(bridge) - 4, bridge[1]],
    },
    {
      name: 'open-bharat-mata-courtyard-colonnades',
      position: [temple[0] + 90, H(temple) + 60, temple[1] + 110],
      lookAt: [temple[0], H(temple) + 2, temple[1]],
    },
    {
      name: 'hathi-houz-intrinsic-masonry-tank',
      position: [tank[0] + 45, H(tank) + 28, tank[1] + 55],
      lookAt: [tank[0], H(tank) - 2, tank[1]],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis:
    p.geometryBasis +
    ' Independent2800m129x129 field/16641 samples frozen before geometry. All building/wall bases sample that unchanged field; urban returns/hidden foundations and live compatible host contact remain approximate.',
  groundCutout: {
    outline: moatOpenings[0],
    additionalOutlines: [...moatOpenings.slice(1), p.tank.ring],
    basis:
      'Only the authored native moat strips and named Hathi Houz tank open the source terrain for their intrinsic retaining walls and pit floor. Original independent grid/heightmap values are unchanged.32strip approximation does not certify exact cut-rock/water levels; no hill/whole-fort parcel opening.',
  },
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-daulatabad-fort.mjs',
    level: 'skyline',
    export: 'daulatabadSkyline',
    errorMeters: 110,
    surfaces,
    authoredLevels: {
      district: { export: 'daulatabadDistrict', errorMeters: 22, surfaces },
      street: { export: 'daulatabadStreet', errorMeters: 4, surfaces },
      closeup: { export: 'daulatabadCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Ten exact published Qualla public-domain originals individually inspected and native-SHA1 matched. Two omitted PD categories recovered by exact existing primary-grant binding. No attribution photo pixels, engineering diagram, AI image or photographic texture used.',
    'Full selected native defensive traces/upper citadel, named minaret, temple courtyard/tank and moat retained. Source plans do not measure vertical wall/census/corbel sections. Gate surrounds and bastion drums, crenellation/column counts, hidden rooms, roofs/ruin edges and current cosmetic changes are bounded photo reconstructions.',
    'Chini Mahal facade is a small estimated registration on actual palace enclosure wall1028089778; unnamed building670314739 is not misidentified as the palace. Baradari footprint is an explicit estimated registration beside native summit path within upper citadel, not a falsely exact building polygon.',
    'Minaret64m is a chosen approximate interpretation from native/current official63/64m statements; other tourism text gives30m or30ft. Shape and three flared balcony/dome proportions follow the cleared full-height photograph; no surveyed engineering height claim. Natural hill shape/height comes only from the independent raw field, never a generic cone fitted to the200m tourism statement.',
    'Source/runtime GLBs contain architecture and intrinsic moat/tank/crossing only. Natural hill is supplied by the independent terrain review descriptor, not embedded landscape. No modern town/standalone cannon/vegetation/people/signs or interiors. Source portable terrain does not apply Earth-owned openings; shared/context terrain cutout views must establish visible intrinsic moat/tank voids.',
    'Independent2800m129x129 field/16641samples/12rawTerrariumtiles unchanged. Output pixels4.49m and21.875m grid do not imply native survey resolution; urban/vegetation returns and deep cut-rock/moat depth are approximate. Preview replaceFootprint=false; actual compatible live host terrain and threshold contact unverified.',
  ],
};

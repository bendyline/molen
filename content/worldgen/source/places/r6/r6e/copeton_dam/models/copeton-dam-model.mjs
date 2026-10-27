/** Whole main Copeton Dam and nine-gate western spillway, dated 2006. */
import '../../../../../../../../packages/worldgen/scripts/install-deterministic-math.mjs';
import fs from 'node:fs';
import { ShapeUtils, Vector2 } from 'three';
import {
  beam,
  cross,
  normalFor,
} from '../../../../../../../../packages/worldgen/scripts/authored-structure-mesh.mjs';
import { rgb } from '../../../../../../../../packages/worldgen/scripts/landmark-model-helpers.mjs';

const P = JSON.parse(fs.readFileSync(new URL('../plan-controls.json', import.meta.url))),
  D = P.dimensions,
  N = P.native,
  Y = P.floors.crest.y,
  GY = P.floors.spillway.y;
export const surfaces = {
  rock: { slot: 'wall', graph: 'gravel', roughness: 0.98, metallic: 0 },
  road: { slot: 'foundation', graph: 'concrete_panel', roughness: 0.97, metallic: 0 },
  concrete: { slot: 'wall', graph: 'concrete_boardformed', roughness: 0.94, metallic: 0 },
  gate: { slot: 'trim', graph: 'metal_painted', roughness: 0.78, metallic: 0.16 },
  steel: { slot: 'trim', graph: 'metal_stainless', roughness: 0.72, metallic: 0.55 },
};
const C = {
    rock: rgb('8a8b7c'),
    road: rgb('7f8782'),
    concrete: rgb('a9afa5'),
    gate: rgb('a9b6b9'),
    steel: rgb('929f9b'),
  },
  sub = (a, b) => a.map((x, k) => x - b[k]),
  dot = (a, b) => a.reduce((s, x, k) => s + x * b[k], 0),
  mix = (a, b, t) => a.map((x, k) => x + (b[k] - x) * t),
  cross2 = (a, b) => a[0] * b[1] - a[1] * b[0],
  fract = (x) => x - Math.floor(x),
  noise = (i, j = 0) => fract(Math.sin(i * 127.1 + j * 311.7) * 43758.5453);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const c = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...c) < 1e-7) return;
  if (n && dot(c, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  o.addTriangle(
    k,
    'palette:#ffffff',
    q,
    normalFor(...q),
    [
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    col,
  );
}
function Q(o, k, q, n, col) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function B(o, k, a, b, w, d, col = C[k]) {
  if (Math.hypot(...sub(b, a)) > 1e-5) beam(o, k, a, b, w, d, col);
}
const tri = (r) =>
    ShapeUtils.triangulateShape(
      r.map((q) => new Vector2(...q)),
      [],
    ),
  arc = [0];
for (let i = 1; i < N.crest.length; i++)
  arc.push(arc.at(-1) + Math.hypot(...sub(N.crest[i], N.crest[i - 1])));
export const crestLength = arc.at(-1);
export function station(s) {
  s = Math.max(0, Math.min(crestLength, s));
  let i = 0;
  while (i < arc.length - 2 && arc[i + 1] < s) i++;
  const a = N.crest[i],
    b = N.crest[i + 1],
    v = sub(b, a),
    l = Math.hypot(...v),
    u = v.map((x) => x / l);
  return { q: mix(a, b, (s - arc[i]) / l), u, n: [-u[1], u[0]], s, t: s / crestLength };
}
function closest(q) {
  let best;
  for (let i = 1; i < N.crest.length; i++) {
    const a = N.crest[i - 1],
      b = N.crest[i],
      v = sub(b, a),
      l2 = dot(v, v),
      t = Math.max(0, Math.min(1, dot(sub(q, a), v) / l2)),
      p = mix(a, b, t),
      dist = Math.hypot(...sub(q, p));
    if (!best || dist < best.dist) {
      const f = station(arc[i - 1] + Math.sqrt(l2) * t);
      best = { ...f, dist, d: dot(sub(q, p), f.n) };
    }
  }
  return best;
}
const taper = (t) => Math.pow(Math.max(0, Math.sin(Math.PI * t)), 0.7),
  depth = (s) => D.maximumWallHeight * taper(s / crestLength);
function downWidth(s) {
  const f = station(Math.max(0.01, Math.min(crestLength - 0.01, s))),
    hits = [];
  for (let i = 0; i < N.main.length; i++) {
    const a = N.main[i],
      b = N.main[(i + 1) % N.main.length],
      e = sub(b, a),
      den = cross2(f.n, e);
    if (Math.abs(den) < 1e-8) continue;
    const aq = sub(a, f.q),
      r = cross2(aq, e) / den,
      u = cross2(aq, f.n) / den;
    if (r > 2 && u >= -1e-6 && u <= 1 + 1e-6) hits.push(r);
  }
  return hits.length ? Math.max(8, Math.max(...hits)) : 8;
}
function distanceToToe(q) {
  let distance = Infinity;
  for (let i = 19; i < N.main.length; i++) {
    const a = N.main[i - 1],
      b = N.main[i],
      v = sub(b, a),
      t = Math.max(0, Math.min(1, dot(sub(q, a), v) / dot(v, v)));
    distance = Math.min(distance, Math.hypot(...sub(q, mix(a, b, t))));
  }
  return distance;
}
function surfaceHeight(q) {
  const f = closest(q),
    h = depth(f.s),
    d = Math.max(0, f.dist - D.crestWidthEstimate / 2),
    toe = distanceToToe(q);
  return (
    Y -
    (f.d > 0
      ? (h * d) / Math.max(0.0001, d + toe)
      : Math.min(12 * taper(f.t), Math.abs(f.d) * 0.35))
  );
}
function inside(q, r = N.main) {
  let v = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > q[1] !== b[1] > q[1] &&
      q[0] < ((b[0] - a[0]) * (q[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      v = !v;
  }
  return v;
}
function bary(q, a, b, c) {
  const v = sub(b, a),
    w = sub(c, a),
    p = sub(q, a),
    d = cross2(v, w);
  return [1 - (cross2(p, w) + cross2(v, p)) / d, cross2(p, w) / d, cross2(v, p) / d];
}
// Insert interior source crest/section points into the native perimeter triangulation.
function improveTriangulation(points, faces) {
  for (let pass = 0; pass < 120; pass++) {
    const edges = new Map(),
      touched = new Set();
    let changes = 0;
    for (let i = 0; i < faces.length; i++)
      for (let k = 0; k < 3; k++) {
        const a = faces[i][k],
          b = faces[i][(k + 1) % 3],
          c = faces[i][(k + 2) % 3],
          key = a < b ? `${a}/${b}` : `${b}/${a}`;
        if (!edges.has(key)) edges.set(key, []);
        edges.get(key).push({ i, a, b, c });
      }
    for (const pairs of edges.values()) {
      if (pairs.length !== 2) continue;
      const [A, B] = pairs;
      if (touched.has(A.i) || touched.has(B.i)) continue;
      const a = points[A.a],
        b = points[A.b],
        c = points[A.c],
        d = points[B.c];
      if (cross2(sub(c, a), sub(d, a)) * cross2(sub(c, b), sub(d, b)) >= -1e-8) continue;
      const x = sub(a, d),
        y = sub(b, d),
        z = sub(c, d),
        det = dot(x, x) * cross2(y, z) - dot(y, y) * cross2(x, z) + dot(z, z) * cross2(x, y),
        orientation = cross2(sub(b, a), sub(c, a));
      if (det * Math.sign(orientation) <= 1e-5) continue;
      faces[A.i] = [A.c, B.c, A.a];
      faces[B.i] = [B.c, A.c, A.b];
      touched.add(A.i);
      touched.add(B.i);
      changes++;
    }
    if (!changes) break;
  }
}
function topMesh(lod) {
  const points = N.main.map((q) => [...q]),
    faces = tri(points);
  function insert(q) {
    if (!inside(q) || points.some((p) => Math.hypot(...sub(p, q)) < 0.00001)) return;
    const found = [];
    for (let i = 0; i < faces.length; i++) {
      const b = bary(q, ...faces[i].map((k) => points[k]));
      if (b.every((v) => v >= -1e-9)) found.push({ i, b });
    }
    if (!found.length) return;
    const k = points.length;
    points.push(q);
    for (const { i, b } of found.reverse()) {
      const f = faces[i],
        edge = b.findIndex((v) => Math.abs(v) < 1e-8),
        next =
          edge < 0
            ? [
                [f[0], f[1], k],
                [f[1], f[2], k],
                [f[2], f[0], k],
              ]
            : [
                [f[edge], f[(edge + 1) % 3], k],
                [f[edge], k, f[(edge + 2) % 3]],
              ];
      faces.splice(i, 1, ...next);
    }
  }
  for (const s of arc) {
    const f = station(s);
    for (const d of [-5.9, 0, 5.9]) insert(f.q.map((v, k) => v + f.n[k] * d));
  }
  const sections = [0, 20, 44, 80][lod],
    crossCount = [0, 2, 4, 7][lod];
  for (let i = 1; i < sections; i++) {
    const s = (crestLength * i) / sections,
      f = station(s),
      w = downWidth(s);
    for (let j = 1; j <= crossCount; j++)
      insert(f.q.map((v, k) => v + f.n[k] * (6 + ((w - 7) * j) / (crossCount + 1))));
  }
  improveTriangulation(points, faces);
  return { points, faces };
}
export const partEvidence = [],
  gateEvidence = [],
  nativeEvidence = [];
function embankment(o, lod) {
  const m = topMesh(lod);
  for (let i = 0; i < m.faces.length; i++) {
    const ix = m.faces[i],
      q = ix.map((k) => [m.points[k][0], surfaceHeight(m.points[k]), m.points[k][1]]),
      v = (noise(i, 1) - 0.5) * 0.045;
    T(
      o,
      'rock',
      q,
      [0, 1, 0],
      C.rock.map((x) => x + v),
    );
  }
  // Closed variable-depth foundation; no site floor or natural terrain is part of this mesh.
  const bottom = (q) => Y - depth(closest(q).s) - 1;
  for (const ix of tri(N.main))
    T(
      o,
      'rock',
      ix.map((i) => [N.main[i][0], bottom(N.main[i]), N.main[i][1]]),
      [0, -1, 0],
    );
  const area = N.main.reduce((s, a, i) => s + cross2(a, N.main[(i + 1) % N.main.length]), 0),
    sign = area > 0 ? 1 : -1;
  for (let i = 0; i < N.main.length; i++) {
    const a = N.main[i],
      b = N.main[(i + 1) % N.main.length];
    Q(
      o,
      'rock',
      [
        [...a.slice(0, 1), bottom(a), a[1]],
        [b[0], bottom(b), b[1]],
        [b[0], surfaceHeight(b), b[1]],
        [a[0], surfaceHeight(a), a[1]],
      ],
      [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
    );
    nativeEvidence.push([a[0], surfaceHeight(a), a[1]]);
  }
  // Estimated submerged upstream slope begins at the original mapped upstream edge.
  const upper = N.main.slice(0, 18),
    toe = (q) => {
      const f = closest(q),
        run = D.submergedUpstreamSlopeRunEstimate * taper(f.t);
      return [
        f.q[0] - f.n[0] * Math.max(Math.abs(f.d), run),
        Y - depth(f.s),
        f.q[1] - f.n[1] * Math.max(Math.abs(f.d), run),
      ];
    };
  for (let i = 1; i < upper.length; i++) {
    const a = upper[i - 1],
      b = upper[i],
      A = [a[0], surfaceHeight(a), a[1]],
      Z = [b[0], surfaceHeight(b), b[1]],
      u = toe(a),
      v = toe(b);
    Q(o, 'rock', [A, Z, v, u], [0, 1, 0]);
    Q(o, 'rock', [[a[0], bottom(a), a[1]], u, v, [b[0], bottom(b), b[1]]], [0, -1, 0]);
  }
  for (const i of [0, upper.length - 1]) {
    const a = upper[i],
      v = toe(a);
    T(o, 'rock', [[a[0], bottom(a), a[1]], [a[0], surfaceHeight(a), a[1]], v], null);
    T(o, 'rock', [[a[0], bottom(a), a[1]], v, [a[0], surfaceHeight(a), a[1]]], null);
  }
  const count = [0, 0, 100, 520][lod];
  for (let i = 0; i < count; i++) {
    const f = station(crestLength * (0.035 + 0.93 * noise(i + 4, 2))),
      w = downWidth(f.s),
      d = 8 + (w - 10) * noise(i + 4, 3),
      q = f.q.map((v, k) => v + f.n[k] * d);
    if (!inside(q)) continue;
    let h;
    for (const ix of m.faces) {
      const bc = bary(q, ...ix.map((j) => m.points[j]));
      if (bc.every((v) => v >= -1e-8)) {
        h = ix.reduce((s, j, k) => s + bc[k] * surfaceHeight(m.points[j]), 0);
        break;
      }
    }
    if (h === undefined) continue;
    const r = 0.5 + 1.1 * noise(i, 7),
      P = [q[0], h + 0.02, q[1]],
      c = C.rock.map((x) => x + (noise(i, 8) - 0.5) * 0.16);
    for (let j = 0; j < 4; j++) {
      const a = (j * Math.PI) / 2,
        b = ((j + 1) * Math.PI) / 2,
        A = [P[0] + r * Math.cos(a), P[1], P[2] + r * 0.8 * Math.sin(a)],
        Z = [P[0] + r * Math.cos(b), P[1], P[2] + r * 0.8 * Math.sin(b)];
      T(o, 'rock', [A, Z, [P[0] + r * 0.1, P[1] + r * 0.7, P[2]]], [0, 1, 0], c);
    }
  }
}
function ribbon(o, k, path, width, y, depth = 0.35, flat = false) {
  const normals = path.map((p, i) => {
      const a = path[Math.max(0, i - 1)],
        b = path[Math.min(path.length - 1, i + 1)],
        v = sub(b, a),
        l = Math.hypot(...v);
      return [-v[1] / l, v[0] / l];
    }),
    at = (i, s, h) => [
      path[i][0] + (normals[i][0] * s * width) / 2,
      y(i) + h,
      path[i][1] + (normals[i][1] * s * width) / 2,
    ];
  for (let i = 1; i < path.length; i++) {
    Q(o, k, [at(i - 1, -1, 0), at(i - 1, 1, 0), at(i, 1, 0), at(i, -1, 0)], [0, 1, 0]);
    if (flat) continue;
    Q(
      o,
      k,
      [at(i - 1, -1, -depth), at(i, -1, -depth), at(i, 1, -depth), at(i - 1, 1, -depth)],
      [0, -1, 0],
    );
    for (const s of [-1, 1])
      Q(
        o,
        k,
        [at(i - 1, s, -depth), at(i, s, -depth), at(i, s, 0), at(i - 1, s, 0)],
        [normals[i][0] * s, 0, normals[i][1] * s],
      );
  }
  if (!flat)
    for (const i of [0, path.length - 1]) {
      const q = [at(i, -1, -depth), at(i, 1, -depth), at(i, 1, 0), at(i, -1, 0)];
      Q(o, k, q);
      Q(o, k, [...q].reverse());
    }
}
const a = N.bridge[0],
  b = N.bridge.at(-1),
  length = Math.hypot(...sub(b, a)),
  u = sub(b, a).map((v) => v / length),
  n = [u[1], -u[0]],
  margin = (length - D.spillwayWeirWidth) / 2;
export const gatePoint = (s, d, y) => [
  a[0] + u[0] * (margin + s) + n[0] * d,
  GY + y,
  a[1] + u[1] * (margin + s) + n[1] * d,
];
const gateBottom = -D.gateTopBelowDeckEstimate - D.gateHeight,
  pier = (D.spillwayWeirWidth - D.gateCount * D.gateWidth) / (D.gateCount + 1);
export const gateParameters = {
  count: D.gateCount,
  width: D.gateWidth,
  height: D.gateHeight,
  pierWidth: pier,
  bridgeLength: length,
  gateBottom,
};
function gp(o, k, s0, d0, y0, s1, d1, y1) {
  const q0 = gatePoint(s0, d0, y0),
    q1 = gatePoint(s1, d0, y0),
    q2 = gatePoint(s1, d1, y0),
    q3 = gatePoint(s0, d1, y0),
    up = (q) => [q[0], GY + y1, q[2]];
  Q(o, k, [q0, q3, q2, q1], [0, -1, 0]);
  Q(o, k, [up(q0), up(q1), up(q2), up(q3)], [0, 1, 0]);
  for (const [A, B] of [
    [q0, q1],
    [q1, q2],
    [q2, q3],
    [q3, q0],
  ])
    Q(o, k, [A, B, up(B), up(A)]);
}
function support(o, s, lod) {
  const count = [1, 2, 3, 5][lod],
    ring = (back, front, radius, y) => {
      const ps = [gatePoint(s - pier / 2, back, y), gatePoint(s + pier / 2, back, y)];
      for (let j = 0; j <= count; j++) {
        const theta = (j * Math.PI) / count;
        ps.push(gatePoint(s + Math.cos(theta) * radius, front + Math.sin(theta) * radius, y));
      }
      return ps;
    },
    rings = [
      ring(-6, 6.6, pier / 2, gateBottom - 2),
      ring(-6, 4, pier / 2, gateBottom + 4),
      ring(-6, 1.4, pier / 2, -0.35),
    ];
  for (let j = 1; j < rings.length; j++)
    for (let k = 0; k < rings[j].length; k++)
      Q(o, 'concrete', [
        rings[j - 1][k],
        rings[j - 1][(k + 1) % rings[j].length],
        rings[j][(k + 1) % rings[j].length],
        rings[j][k],
      ]);
  for (const [r, up] of [
    [rings[0], false],
    [rings.at(-1), true],
  ])
    for (let k = 1; k < r.length - 1; k++)
      T(o, 'concrete', [r[0], r[k], r[k + 1]], [0, up ? 1 : -1, 0]);
}
function gates(o, lod) {
  for (let i = 0; i <= D.gateCount; i++) support(o, pier / 2 + i * (pier + D.gateWidth), lod);
  for (let i = 0; i < D.gateCount; i++) {
    const left = pier + i * (D.gateWidth + pier),
      right = left + D.gateWidth,
      curve = [1, 3, 6, 12][lod],
      path = (t) => {
        const y = gateBottom + D.gateHeight * t,
          d = 1.9 * Math.sin(Math.PI * t);
        return [d, y];
      };
    for (let j = 0; j < curve; j++) {
      const A = path(j / curve),
        Z = path((j + 1) / curve);
      for (const offset of [0, -0.16])
        Q(
          o,
          'gate',
          [
            gatePoint(left, A[0] + offset, A[1]),
            gatePoint(right, A[0] + offset, A[1]),
            gatePoint(right, Z[0] + offset, Z[1]),
            gatePoint(left, Z[0] + offset, Z[1]),
          ],
          offset === 0 ? [n[0], 0, n[1]] : [-n[0], 0, -n[1]],
        );
      for (const s of [left, right])
        Q(o, 'gate', [
          gatePoint(s, A[0] - 0.16, A[1]),
          gatePoint(s, A[0], A[1]),
          gatePoint(s, Z[0], Z[1]),
          gatePoint(s, Z[0] - 0.16, Z[1]),
        ]);
    }
    for (const t of [0, 1]) {
      const [d, y] = path(t);
      Q(
        o,
        'gate',
        [
          gatePoint(left, d - 0.16, y),
          gatePoint(right, d - 0.16, y),
          gatePoint(right, d, y),
          gatePoint(left, d, y),
        ],
        [0, t ? 1 : -1, 0],
      );
    }
    if (lod >= 2) {
      for (const s of [left + 0.5, right - 0.5])
        B(o, 'steel', gatePoint(s, 1.3, gateBottom + 4), gatePoint(s, -2, 0.9), 0.055, 0.055);
      gp(o, 'steel', (left + right) / 2 - 0.8, -2.5, 0.6, (left + right) / 2 + 0.8, -1.2, 1.35);
      for (const h of [0.25, 0.55, 0.8]) {
        const [d, y] = path(h);
        B(
          o,
          'gate',
          gatePoint(left + 0.2, d - 0.25, y),
          gatePoint(right - 0.2, d - 0.25, y),
          0.18,
          0.2,
        );
      }
    }
    gateEvidence.push({
      index: i,
      left,
      right,
      width: right - left,
      height: D.gateHeight,
      leafCenter: gatePoint((left + right) / 2, 1.9, gateBottom + D.gateHeight / 2),
    });
  }
  // The full original eleven-control spillway floor, with an open downstream mouth.
  const floor = (d) =>
      gateBottom -
      0.5 -
      D.downstreamApronDropEstimate * Math.max(0, (d - 6) / D.downstreamApronLengthEstimate),
    run = (q) => dot(sub(q, a), n),
    at = (q, y) => [q[0], GY + y, q[1]],
    heights = N.spillway.map((q) => floor(run(q)));
  for (const ix of tri(N.spillway)) {
    T(
      o,
      'concrete',
      ix.map((i) => at(N.spillway[i], heights[i])),
      [0, 1, 0],
    );
    T(
      o,
      'concrete',
      ix.map((i) => at(N.spillway[i], heights[i] - 0.6)),
      [0, -1, 0],
    );
  }
  for (let i = 0; i < N.spillway.length; i++) {
    const j = (i + 1) % N.spillway.length,
      A = N.spillway[i],
      Z = N.spillway[j];
    Q(o, 'concrete', [
      at(A, heights[i] - 0.6),
      at(Z, heights[j] - 0.6),
      at(Z, heights[j]),
      at(A, heights[i]),
    ]);
  }
  for (const [i, j] of [
    [0, 1],
    [1, 2],
    [2, 3],
    [5, 6],
    [6, 7],
  ]) {
    const A = N.spillway[i],
      Z = N.spillway[j],
      v = sub(Z, A),
      l = Math.hypot(...v),
      side = [-v[1] / l, v[0] / l],
      AA = A.map((v, k) => v + side[k] * 2),
      ZZ = Z.map((v, k) => v + side[k] * 2),
      ha = heights[i],
      hz = heights[j],
      top = (q) => Math.max(floor(run(q)) + 2, -2 - (run(q) + 6) * 0.45),
      ta = top(A),
      tz = top(Z);
    Q(o, 'concrete', [at(A, ha - 0.6), at(Z, hz - 0.6), at(Z, tz), at(A, ta)]);
    Q(o, 'concrete', [at(AA, ha - 0.6), at(AA, ta), at(ZZ, tz), at(ZZ, hz - 0.6)]);
    Q(o, 'concrete', [at(A, ta), at(Z, tz), at(ZZ, tz), at(AA, ta)], [0, 1, 0]);
    for (const [q, qq, h, t] of [
      [A, AA, ha, ta],
      [Z, ZZ, hz, tz],
    ])
      Q(o, 'concrete', [at(q, h - 0.6), at(q, t), at(qq, t), at(qq, h - 0.6)]);
  }
}

function roads(o, lod) {
  ribbon(o, 'road', N.crest, D.crestWidthEstimate, () => Y + 0.12, 0.35, lod === 0);
  ribbon(o, 'road', N.link, 8, (i) => GY + ((Y - GY) * i) / (N.link.length - 1), 0.35, lod === 0);
  ribbon(o, 'concrete', N.bridge, 8, () => GY, 0.35, lod === 0);
  // Separate fascia beams and pier webs retain the photographed horizontal openings.
  gp(o, 'concrete', 0, 3.7, -2.7, 156, 4.1, -1.9);
  gp(o, 'concrete', 0, -4.1, -2.7, 156, -3.7, -1.9);
  for (const side of [-1, 1]) {
    for (const y of [0.55, 1.15])
      B(
        o,
        'steel',
        gatePoint(-margin, side * 3.7, y),
        gatePoint(156 + margin, side * 3.7, y),
        0.085,
        0.085,
      );
    if (lod) {
      const count = Math.ceil(length / [1, 12, 3.5, 1.8][lod]);
      for (let i = 0; i <= count; i++)
        B(
          o,
          'steel',
          gatePoint(-margin + (length * i) / count, side * 3.7, 0),
          gatePoint(-margin + (length * i) / count, side * 3.7, 1.3),
          0.08,
          0.08,
        );
    }
  }
  if (lod >= 2)
    for (let i = 0; i < 8; i++) {
      const s = 5 + i * 21,
        ds = -3.6;
      B(o, 'steel', gatePoint(s, ds, 0), gatePoint(s, ds, 6.8), 0.13, 0.13);
      const ps = [
        [ds, 6.8],
        [ds + 0.25, 7.6],
        [ds + 0.9, 8],
        [ds + 1.8, 8.05],
      ];
      for (let j = 1; j < ps.length; j++)
        B(o, 'steel', gatePoint(s, ...ps[j - 1]), gatePoint(s, ...ps[j]), 0.11, 0.11);
      gp(o, 'steel', s - 0.35, ds + 1.5, 7.85, s + 0.35, ds + 2.1, 8.08);
    }
}
export function buildCopeton(target, _frame, lod = 3) {
  partEvidence.length = 0;
  gateEvidence.length = 0;
  nativeEvidence.length = 0;
  let count = 0;
  const o = {
      addTriangle(...a) {
        count++;
        target.addTriangle(...a);
      },
      addQuad(slot, _ref, points, normal, _uv, color) {
        Q(o, slot, points, normal, color);
      },
      addConvexPolygon(slot, _ref, points, normal, _uv, color) {
        for (let i = 1; i < points.length - 1; i++)
          T(o, slot, [points[0], points[i], points[i + 1]], normal, color);
      },
    },
    part = (id, fn) => {
      const n = count;
      fn();
      partEvidence.push({ id, triangles: count - n });
    };
  part('whole-main-native-rockfill-body-and-estimated-submerged-section', () => embankment(o, lod));
  part('all-nine-curved-leaves-ten-rounded-piers-and-complete-main-chute', () => gates(o, lod));
  part('entire-native-crest-connecting-road-and-spillway-bridge', () => roads(o, lod));
}
export const copetonSkyline = (o) => buildCopeton(o, null, 0),
  copetonDistrict = (o) => buildCopeton(o, null, 1),
  copetonStreet = (o) => buildCopeton(o, null, 2),
  copetonCloseup = (o) => buildCopeton(o, null, 3);
const root = 'content/worldgen/source/places/r6/r6e/copeton_dam',
  look = [25, Y - 36, -40],
  gateCamera = gatePoint(82, 110, 38),
  gateLook = gatePoint(78, 0, -9);
export const copetonModel = {
  id: 'copeton_dam',
  key: 'copeton_dam',
  cell: 'r6/r6e',
  title: 'Copeton Dam, New South Wales (2006)',
  wikidataId: 'Q5168547',
  category: 'dam',
  recipe: 'copeton-dam-model.mjs',
  progressLedger: 'qualla-002.PROGRESS.md',
  surfaces,
  build: buildCopeton,
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'historical-proposal',
  orientationPolicy: 'approximate-visualization',
  groundContactBasis: P.sectionBasis,
  brief: P.geometryBasis,
  appearance: {
    kind: 'historical',
    representedDate: '2006-10-11',
    validFrom: '1976-01-01',
    validUntil: '2012-12-31',
    currentWorldEligible: false,
  },
  camera: [-900, 1000, 1700],
  lookAt: look,
  portableGroundY: Y - 118,
  mediumFiContext: {
    scale: 1.12,
    groundY: Y - 118,
    far: 6500,
    terrain: { descriptor: 'terrain-review.terrain.json', heightmap: 'terrain-review.height.png' },
  },
  embeddedCanonicalGraphs: [
    'gravel',
    'concrete_panel',
    'concrete_boardformed',
    'metal_painted',
    'metal_stainless',
  ],
  groundCutout: {
    minHeight: Y - D.maximumWallHeight - 1,
    outline: N.main,
    additionalOutlines: [N.spillway],
    basis:
      'Only mapped physical main-dam and original spillway footprints; no broad site pad. Unmasked original source field retained. Submerged upstream estimates can overlap source reservoir relief; no historic bathymetry or exact host contact claim.',
  },
  qaCameras: [
    { name: 'whole-main-wall-and-western-gates', position: [-850, 700, 1600], lookAt: look },
    { name: 'all-nine-recessed-radial-gates-and-crossing', position: gateCamera, lookAt: gateLook },
    {
      name: 'rounded-pier-toes-curved-leaves-and-fascia-openings',
      position: gatePoint(120, 24, -1),
      lookAt: gatePoint(108, 0, -11),
    },
    {
      name: 'whole-rockfill-face-and-original-crest',
      position: [160, 110, 420],
      lookAt: [130, Y - 52, 30],
    },
  ],
  qaLodCameras: ['skyline', 'district', 'street', 'closeup'].map((reviewLod) => ({
    name: 'whole-dam-' + reviewLod,
    position: [-1000, 900, 1500],
    lookAt: look,
    reviewLod,
  })),
  runtimeLodOverlay: {
    module: root + '/models/copeton-dam-model.mjs',
    level: 'skyline',
    export: 'copetonSkyline',
    errorMeters: 12,
    surfaces,
    authoredLevels: {
      district: { export: 'copetonDistrict', errorMeters: 7, surfaces },
      street: { export: 'copetonStreet', errorMeters: 2.5, surfaces },
      closeup: { export: 'copetonCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [P.geometryBasis, P.sectionBasis, ...P.limits],
  sourceLicense:
    'Original authored geometry under repository license. One exact Qualla-published Userid42 creator-public-domain photograph for the 2006 main spillway, no baked photographs. OSM ODbL plan controls and primary engineering factual dimensions; hidden sections and terrain contact explicitly approximate.',
};

/** Tokuyama Dam: whole mapped earthwork, four spillway bays and intake exterior. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/xn/xn3/tokuyama_dam/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  A = p.parameters.architecturalSections,
  P = p.outline.slice(0, -1),
  R = p.crestRoad,
  ref = 'palette:#ffffff',
  C = {
    rock: rgb('77797a'),
    concrete: rgb('c9c7bd'),
    road: rgb('777b79'),
    metal: rgb('8b9498'),
    glass: rgb('3c4949'),
  },
  surfaces = {
    rock: { slot: 'wall', graph: 'stone_drywall', roughness: 0.98, metallic: 0 },
    concrete: { slot: 'wall', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    road: { slot: 'roof', localRef: ref, roughness: 0.98, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.82, metallic: 0.18 },
    glass: { slot: 'window', localRef: ref, roughness: 0.68, metallic: 0.03 },
  },
  sub = (a, b) => a.map((v, i) => v - b[i]),
  dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0),
  unit = (v) => v.map((q) => q / Math.hypot(...v)),
  rect = (x0, x1, y0, y1) => [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && dot(cr, n) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, k, q, n, col = C[k]) {
  T(o, k, q.slice(0, 3), n, col);
  T(o, k, [q[0], q[2], q[3]], n, col);
}
function flat(o, k, R, height, up = true) {
  const I = earcut(R.flat());
  for (let i = 0; i < I.length; i += 3)
    T(
      o,
      k,
      I.slice(i, i + 3).map((j) => [
        R[j][0],
        typeof height === 'function' ? height(...R[j]) : height,
        R[j][1],
      ]),
      [0, up ? 1 : -1, 0],
    );
}
function faces(R) {
  R = R.filter((q, i) => Math.hypot(...sub(q, R[(i + R.length - 1) % R.length])) > 1e-7);
  if (
    R.reduce(
      (a, q, i) => a + q[0] * R[(i + 1) % R.length][1] - R[(i + 1) % R.length][0] * q[1],
      0,
    ) < 0
  )
    R = R.toReversed();
  return R.map((a, i) => {
    const b = R[(i + 1) % R.length],
      len = Math.hypot(...sub(b, a)),
      u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
      n = [u[2], 0, -u[0]];
    return {
      len,
      u,
      n,
      a,
      b,
      point: (x, y, z = 0) => [a[0] + u[0] * x + n[0] * z, y, a[1] + u[2] * x + n[2] * z],
    };
  });
}
function prism(o, k, R, y0, y1) {
  for (const f of faces(R))
    Q(o, k, [f.point(0, y0), f.point(f.len, y0), f.point(f.len, y1), f.point(0, y1)], f.n);
  flat(o, k, R, y0, false);
  flat(o, k, R, y1);
}
function beam(o, k, a, b, w, depth = w) {
  if (Math.hypot(...sub(b, a)) < 1e-6) return;
  const u = unit(sub(b, a)),
    v = unit(cross(u, Math.abs(u[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0])),
    n = unit(cross(u, v)),
    at = (c, s, t) => c.map((q, i) => q + (v[i] * s * w) / 2 + (n[i] * t * depth) / 2),
    r = (c) => [at(c, -1, -1), at(c, 1, -1), at(c, 1, 1), at(c, -1, 1)],
    R = r(a),
    S = r(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, k, [R[i], R[j], S[j], S[i]], sub(at(a, i === 0 || i === 3 ? -1 : 1, i < 2 ? -1 : 1), a));
  }
  Q(
    o,
    k,
    R,
    u.map((q) => -q),
  );
  Q(o, k, S, u);
}
const segments = [];
let roadLength = 0;
for (let i = 0; i < R.length - 1; i++) {
  const a = R[i],
    b = R[i + 1],
    l = Math.hypot(...sub(b, a)),
    u = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  segments.push({ a, b, l, u, s: roadLength });
  roadLength += l;
}
const U = segments[0].u,
  V = [-U[1], U[0]],
  O = R[0],
  toUV = (q) => [dot(sub(q, O), U), dot(sub(q, O), V)],
  fromUV = (u, v) => [O[0] + U[0] * u + V[0] * v, O[1] + U[1] * u + V[1] * v],
  Puv = P.map(toUV);
function inside(q, R) {
  let yes = false;
  for (let i = 0, j = R.length - 1; i < R.length; j = i++)
    if (
      R[i][1] > q[1] !== R[j][1] > q[1] &&
      q[0] < ((R[j][0] - R[i][0]) * (q[1] - R[i][1])) / (R[j][1] - R[i][1]) + R[i][0]
    )
      yes = !yes;
  return yes;
}
function clip(R, fn, greater) {
  const out = [];
  for (let i = 0; i < R.length; i++) {
    const a = R[i],
      b = R[(i + 1) % R.length],
      da = fn(a) * (greater ? 1 : -1),
      db = fn(b) * (greater ? 1 : -1);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      out.push(a.map((q, k) => q + (b[k] - q) * t));
    }
  }
  return out.filter((q, i) => Math.hypot(...sub(q, out[(i + out.length - 1) % out.length])) > 1e-7);
}
const seam = (q) => q[0] - A.spillwaySeamAtCrest - A.spillwaySeamFlare * q[1],
  earthUV = clip(Puv, seam, true),
  spillUV = clip(Puv, seam, false),
  earth = earthUV.map((q) => fromUV(...q)),
  spill = spillUV.map((q) => fromUV(...q));
const vertexNormals = R.map((_, i) => {
  const a = segments[Math.max(0, i - 1)],
    b = segments[Math.min(i, segments.length - 1)],
    n0 = [-a.u[1], a.u[0]],
    n1 = [-b.u[1], b.u[0]],
    den = 1 + dot(n0, n1);
  return [(n0[0] + n1[0]) / den, (n0[1] + n1[1]) / den];
});
export function tokuyamaRoad(s, v = 0) {
  s = Math.max(0, Math.min(roadLength, s));
  const f = segments.find((f) => s <= f.s + f.l + 1e-8) ?? segments.at(-1),
    i = segments.indexOf(f),
    t = (s - f.s) / f.l,
    n = vertexNormals[i].map((q, k) => q + (vertexNormals[i + 1][k] - q) * t);
  return [f.a[0] + (f.b[0] - f.a[0]) * t + n[0] * v, f.a[1] + (f.b[1] - f.a[1]) * t + n[1] * v];
}
function nearest(q) {
  let best;
  for (const f of segments) {
    const t = Math.max(0, Math.min(f.l, dot(sub(q, f.a), f.u))),
      c = [f.a[0] + f.u[0] * t, f.a[1] + f.u[1] * t],
      v = dot(sub(q, c), [-f.u[1], f.u[0]]),
      dist = Math.hypot(...sub(q, c));
    if (!best || dist < best.dist) best = { s: f.s + t, v, dist };
  }
  return best;
}
export function tokuyamaRockHeight(q) {
  const n = nearest(q),
    v = n.v;
  return Math.max(
    A.foundationY,
    A.crestY -
      Math.max(0, Math.abs(v) - A.roadWidth / 2) * (v > 0 ? A.downstreamSlope : A.upstreamSlope),
  );
}
export function tokuyamaChannelHeight(v) {
  return Math.max(A.foundationY + 3, A.gateFloor - Math.max(0, v - 15) * 0.45);
}
function surface(o, k, poly, height, step) {
  const ids = earcut(poly.flat());
  for (let i = 0; i < ids.length; i += 3) {
    const tri = ids.slice(i, i + 3).map((j) => poly[j]),
      x0 = Math.floor(Math.min(...tri.map((q) => q[0])) / step),
      x1 = Math.floor(Math.max(...tri.map((q) => q[0])) / step),
      z0 = Math.floor(Math.min(...tri.map((q) => q[1])) / step),
      z1 = Math.floor(Math.max(...tri.map((q) => q[1])) / step);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        let R = clip(tri, (q) => q[0] - x * step, true);
        R = clip(R, (q) => q[0] - (x + 1) * step, false);
        R = clip(R, (q) => q[1] - z * step, true);
        R = clip(R, (q) => q[1] - (z + 1) * step, false);
        for (let j = 1; j < R.length - 1; j++)
          T(
            o,
            k,
            [R[0], R[j], R[j + 1]].map((q) => [q[0], height(q), q[1]]),
            [0, 1, 0],
          );
      }
  }
}
function splitAlongPath(poly, path) {
  const cross2 = (a, b) => a[0] * b[1] - a[1] * b[0],
    hits = [];
  for (let i = 0; i < path.length - 1; i++)
    for (let j = 0; j < poly.length; j++) {
      const a = path[i],
        b = path[i + 1],
        c = poly[j],
        d = poly[(j + 1) % poly.length],
        u = sub(b, a),
        v = sub(d, c),
        den = cross2(u, v);
      if (Math.abs(den) < 1e-8) continue;
      const t = cross2(sub(c, a), v) / den,
        z = cross2(sub(c, a), u) / den;
      if (t >= -1e-8 && t <= 1 + 1e-8 && z >= -1e-8 && z <= 1 + 1e-8) {
        const q = a.map((x, k) => x + u[k] * t);
        if (!hits.some((h) => Math.hypot(...sub(h.q, q)) < 0.001)) hits.push({ i, j, t, q });
      }
    }
  hits.sort((a, b) => a.i + a.t - b.i - b.t);
  if (hits.length !== 2) throw Error('Expected two native bank/crest intersections');
  const [a, b] = hits,
    walk = (from, to) => {
      const out = [];
      let i = (from + 1) % poly.length;
      for (let n = 0; n < poly.length; n++) {
        out.push(poly[i]);
        if (i === to) break;
        i = (i + 1) % poly.length;
      }
      return out;
    },
    inner = path.slice(a.i + 1, b.i + 1);
  return [
    [a.q, ...walk(a.j, b.j), b.q, ...inner.toReversed()],
    [b.q, ...walk(b.j, a.j), a.q, ...inner],
  ];
}
function earthwork(o, d) {
  const stations = [0, ...segments.slice(1).map((f) => f.s), roadLength],
    path = (v) => stations.map((s) => tokuyamaRoad(s, v)),
    parts = splitAlongPath(earth, path(-A.roadWidth / 2)),
    middle = parts.findIndex((R) => inside(tokuyamaRoad(300, 0), R)),
    banks = [parts[1 - middle], ...splitAlongPath(parts[middle], path(A.roadWidth / 2))];
  for (const bank of banks) {
    if (d === 0) flat(o, 'rock', bank, (x, z) => tokuyamaRockHeight([x, z]));
    else surface(o, 'rock', bank, tokuyamaRockHeight, [240, 125, 50, 25][d]);
  }
  for (const f of faces(earth))
    Q(
      o,
      'rock',
      [
        f.point(0, A.foundationY),
        f.point(f.len, A.foundationY),
        f.point(f.len, tokuyamaRockHeight(f.b)),
        f.point(0, tokuyamaRockHeight(f.a)),
      ],
      f.n,
    );
  flat(o, 'rock', earth, A.foundationY, false);
  if (d > 1) {
    const N = d === 2 ? 90 : 290;
    for (let i = 0; i < N; i++) {
      const s = A.embankmentStart + (((i * 193) % 997) / 997) * (roadLength - A.embankmentStart),
        v = -55 + (((i * 277) % 991) / 991) * 315,
        q = tokuyamaRoad(s, v);
      if (!inside(q, earth) || Math.abs(v) < 9) continue;
      const y = tokuyamaRockHeight(q),
        r = 0.65 + (i % 7) * 0.1,
        col = rgb(['858684', '797b79', '8b8b86', '6f7577'][i % 4]),
        top = [q[0] + 0.12, y + 0.48, q[1] - 0.1],
        base = Array.from({ length: 4 }, (_, j) => {
          const a = ((j + 0.1) * Math.PI) / 2,
            x = q[0] + r * Math.cos(a),
            z = q[1] + r * 0.76 * Math.sin(a);
          return [x, tokuyamaRockHeight([x, z]) + 0.04, z];
        });
      for (let j = 0; j < 4; j++) T(o, 'rock', [base[j], base[(j + 1) % 4], top], [0, 1, 0], col);
    }
  }
}
function localBox(o, k, s, y, v, w, h, l) {
  prism(
    o,
    k,
    [
      [s - w / 2, v - l / 2],
      [s + w / 2, v - l / 2],
      [s + w / 2, v + l / 2],
      [s - w / 2, v + l / 2],
    ].map((q) => fromUV(...q)),
    y,
    y + h,
  );
}
function strip(o, k, stations, width, y, thickness = 0) {
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i],
      b = stations[i + 1],
      R = [
        tokuyamaRoad(a, -width / 2),
        tokuyamaRoad(b, -width / 2),
        tokuyamaRoad(b, width / 2),
        tokuyamaRoad(a, width / 2),
      ];
    prism(o, k, R, y - thickness, y);
  }
}
function railing(o, a, b, y, d, k = 'metal') {
  if (d === 0) {
    const n = unit([b[1] - a[1], 0, a[0] - b[0]]),
      q = [
        [a[0], y + 0.86, a[1]],
        [b[0], y + 0.86, b[1]],
        [b[0], y + 1.04, b[1]],
        [a[0], y + 1.04, a[1]],
      ];
    Q(o, k, q, n);
    Q(
      o,
      k,
      q,
      n.map((v) => -v),
    );
    return;
  }
  beam(o, k, [a[0], y + 0.95, a[1]], [b[0], y + 0.95, b[1]], d === 0 ? 0.18 : 0.12);
  if (d) {
    beam(o, k, [a[0], y + 0.45, a[1]], [b[0], y + 0.45, b[1]], 0.09);
    const N = Math.max(1, Math.ceil(Math.hypot(...sub(b, a)) / (d === 1 ? 24 : 4)));
    for (let i = 0; i <= N; i++) {
      const t = i / N,
        x = a[0] + (b[0] - a[0]) * t,
        z = a[1] + (b[1] - a[1]) * t;
      beam(o, k, [x, y, z], [x, y + 1.01, z], 0.11);
    }
  }
}
function crest(o, d) {
  const ss = [0, ...segments.slice(1).map((f) => f.s), roadLength];
  strip(o, 'road', ss, A.roadWidth, A.crestY + 0.05, A.roadThickness);
  for (let i = 0; i < ss.length - 1; i++)
    for (const v of [-A.roadWidth / 2 - 0.25, A.roadWidth / 2 + 0.25]) {
      const a = tokuyamaRoad(ss[i], v),
        b = tokuyamaRoad(ss[i + 1], v),
        n = unit([b[1] - a[1], 0, a[0] - b[0]]);
      const R = [
        [a[0] - n[0] * 0.28, a[1] - n[2] * 0.28],
        [b[0] - n[0] * 0.28, b[1] - n[2] * 0.28],
        [b[0] + n[0] * 0.28, b[1] + n[2] * 0.28],
        [a[0] + n[0] * 0.28, a[1] + n[2] * 0.28],
      ];
      prism(o, 'concrete', R, A.crestY, A.crestY + 0.65);
      railing(o, a, b, A.crestY + 0.42, d);
    }
}
function wallFace(o, k, f, R, z = 0, holes = []) {
  const all = [R, ...holes].flat(),
    H = holes.map((_, i) => R.length + holes.slice(0, i).reduce((s, h) => s + h.length, 0)),
    I = earcut(all.flat(), H);
  for (let i = 0; i < I.length; i += 3)
    T(
      o,
      k,
      I.slice(i, i + 3).map((j) => f.point(...all[j], z)),
      f.n,
    );
}
function room(o, poly, y0, y1, d) {
  for (const f of faces(poly)) {
    const N = Math.max(1, Math.floor(f.len / (d === 0 ? 8 : d === 1 ? 7.5 : 4.8))),
      holes = [];
    if (f.len > 2.5)
      for (let i = 0; i < N; i++) {
        const x = (f.len * (i + 0.5)) / N;
        holes.push(rect(x - 0.3, x + 0.3, y0 + 1.25, y0 + 3.7));
      }
    wallFace(o, 'concrete', f, rect(0, f.len, y0, y1), 0, d ? holes : []);
    for (const h of holes) {
      wallFace(o, 'glass', f, h, d ? -A.windowRecess : 0.015);
      if (d)
        for (let i = 0; i < 4; i++) {
          const j = (i + 1) % 4,
            a = h[i],
            b = h[j];
          Q(
            o,
            'concrete',
            [
              f.point(...a),
              f.point(...b),
              f.point(...b, -A.windowRecess),
              f.point(...a, -A.windowRecess),
            ],
            [-f.u[0] * (b[1] - a[1]), b[0] - a[0], -f.u[2] * (b[1] - a[1])],
          );
        }
      if (d > 1) {
        const x = (h[0][0] + h[1][0]) / 2;
        for (const y of [y0 + 4.2, y0 + 4.45, y0 + 4.7])
          wallFace(o, 'metal', f, rect(x - 0.37, x + 0.37, y, y + 0.09), 0.025);
      }
    }
  }
  flat(o, 'concrete', poly, y0, false);
  flat(o, 'concrete', poly, y1);
}
const channelU = (u, v) => u * (1 + (A.spillwaySeamFlare * Math.max(v, 0)) / 103);
function divider(o, u, width, d) {
  const vv =
      d === 0
        ? [14, 170, 320]
        : d === 1
          ? [14, 70, 150, 240, 320]
          : Array.from(
              { length: d === 2 ? 13 : 25 },
              (_, i) => 14 + (i * 306) / (d === 2 ? 12 : 24),
            ),
    up = (v) => tokuyamaChannelHeight(v) + 1.2 + 14 * Math.pow(1 - v / 330, 1.4),
    w = (v) => Math.max(1.35, width * (1 - Math.min(1, v / 110)));
  for (let i = 0; i < vv.length - 1; i++) {
    const a = vv[i],
      b = vv[i + 1],
      R = [
        [channelU(u, a) - w(a) / 2, a],
        [channelU(u, b) - w(b) / 2, b],
        [channelU(u, b) + w(b) / 2, b],
        [channelU(u, a) + w(a) / 2, a],
      ],
      q = R.map((z) => fromUV(...z)),
      ys = [a, b, b, a];
    Q(
      o,
      'concrete',
      q.map((z, j) => [z[0], up(ys[j]), z[1]]),
      [0, 1, 0],
    );
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4,
        a0 = q[j],
        a1 = q[k],
        n = [a1[1] - a0[1], 0, a0[0] - a1[0]];
      Q(
        o,
        'concrete',
        [
          [a0[0], tokuyamaChannelHeight(ys[j]) - 0.2, a0[1]],
          [a1[0], tokuyamaChannelHeight(ys[k]) - 0.2, a1[1]],
          [a1[0], up(ys[k]), a1[1]],
          [a0[0], up(ys[j]), a0[1]],
        ],
        n,
      );
    }
  }
}
function gate(o, s, d) {
  const width = A.gateClearWidth,
    N = [1, 2, 6, 10][d],
    point = (x, t, back = false) => {
      const q = fromUV(x, A.gateV + 2.8 * Math.sin(t * Math.PI) + (back ? -0.24 : 0));
      return [q[0], A.gateFloor + A.gateHeight * t, q[1]];
    };
  for (let j = 0; j < N; j++) {
    const a = j / N,
      b = (j + 1) / N;
    for (const back of [false, true])
      Q(
        o,
        'metal',
        [
          point(s - width / 2, a, back),
          point(s + width / 2, a, back),
          point(s + width / 2, b, back),
          point(s - width / 2, b, back),
        ],
        [V[0] * (back ? -1 : 1), 0, V[1] * (back ? -1 : 1)],
      );
  }
  for (const t of [0, 1])
    Q(
      o,
      'metal',
      [
        point(s - width / 2, t),
        point(s + width / 2, t),
        point(s + width / 2, t, true),
        point(s - width / 2, t, true),
      ],
      [0, t === 0 ? -1 : 1, 0],
    );
  for (const x of [s - width / 2, s + width / 2])
    for (let j = 0; j < N; j++)
      Q(
        o,
        'metal',
        [
          point(x, j / N),
          point(x, (j + 1) / N),
          point(x, (j + 1) / N, true),
          point(x, j / N, true),
        ],
        [U[0] * (x < s ? -1 : 1), 0, U[1] * (x < s ? -1 : 1)],
      );
  if (d) {
    for (let i = 1; i <= [2, 3, 5][d - 1]; i++) {
      const t = i / ([2, 3, 5][d - 1] + 1);
      beam(o, 'metal', point(s - width / 2, t), point(s + width / 2, t), d === 1 ? 0.26 : 0.18);
    }
    if (d > 1) {
      for (const dx of [-width * 0.3, 0, width * 0.3])
        for (let j = 0; j < N; j++)
          beam(o, 'metal', point(s + dx, j / N), point(s + dx, (j + 1) / N), 0.16);
      for (const dx of [-width * 0.42, width * 0.42]) {
        const q = fromUV(s + dx, 23),
          pivot = [q[0], A.gateFloor + 7, q[1]];
        beam(o, 'metal', point(s + dx, 0.08), pivot, 0.35);
        beam(o, 'metal', point(s + dx, 0.9), pivot, 0.35);
      }
    }
  }
}
function spillway(o, d) {
  for (const greater of [false, true]) {
    const part = clip(spill, (q) => toUV(q)[1] - 15, greater);
    flat(o, 'concrete', part, (x, z) => tokuyamaChannelHeight(toUV([x, z])[1]));
  }
  // Four open flow channels remain uncovered beyond the actual gated bridge.
  for (let i = 0; i < 5; i++) divider(o, A.pierCenters[i], A.pierWidths[i], d);
  for (let i = 0; i < 5; i++) {
    const u = A.pierCenters[i],
      w = A.pierWidths[i];
    localBox(o, 'concrete', u, A.gateFloor - 4, 13, w, A.crestY - A.gateFloor + 4.5, 20);
    const roofPoly = [
      [u - w / 2 - 1, 8],
      [u + w / 2 + 1, 8],
      [u + w / 2 + 1, 23],
      [u - w / 2 - 1, 23],
    ].map((q) => fromUV(...q));
    room(o, roofPoly, A.crestY + 0.3, A.controlRoomTop, d);
    if (i === 1 || i === 2 || i === 3) {
      localBox(o, 'concrete', u, A.gateFloor - 4, -12, w, A.crestY - A.gateFloor + 4.5, 10);
      const q = [
        [u - w / 2 - 1, -18],
        [u + w / 2 + 1, -18],
        [u + w / 2 + 1, -7],
        [u - w / 2 - 1, -7],
      ].map((q) => fromUV(...q));
      room(o, q, A.crestY + 0.3, A.controlRoomTop, d);
    }
  }
  for (const s of A.gateCenters) gate(o, s, d);
}
function intake(o, d) {
  const c = tokuyamaRoad(A.intakeStation, A.intakeV),
    f = segments.find((f) => A.intakeStation <= f.s + f.l),
    u = f.u,
    v = [-u[1], u[0]],
    q = (x, z) => [c[0] + u[0] * x + v[0] * z, c[1] + u[1] * x + v[1] * z],
    poly = (w, l) =>
      [
        [-w / 2, -l / 2],
        [w / 2, -l / 2],
        [w / 2, l / 2],
        [-w / 2, l / 2],
      ].map((z) => q(...z));
  prism(o, 'concrete', poly(22, 16), A.intakeBase - 1, A.intakeBase);
  for (const x of [-6, 6])
    prism(
      o,
      'concrete',
      [
        [x - 1.1, -5],
        [x + 1.1, -5],
        [x + 1.1, 5],
        [x - 1.1, 5],
      ].map((z) => q(...z)),
      A.intakeBase,
      A.intakeFloor,
    );
  room(o, poly(18, 12), A.intakeFloor, A.intakeTop, d);
  const a = tokuyamaRoad(A.intakeBridgeShoreStation, A.intakeBridgeShoreV),
    b = c,
    n = unit([b[1] - a[1], 0, a[0] - b[0]]),
    bridge = [
      [a[0] - n[0] * 2, a[1] - n[2] * 2],
      [b[0] - n[0] * 2, b[1] - n[2] * 2],
      [b[0] + n[0] * 2, b[1] + n[2] * 2],
      [a[0] + n[0] * 2, a[1] + n[2] * 2],
    ];
  prism(o, 'metal', bridge, A.crestY - 0.6, A.crestY + 0.2);
  for (const side of [-1, 1]) {
    const x = [a[0] + n[0] * 2 * side, a[1] + n[2] * 2 * side],
      z = [b[0] + n[0] * 2 * side, b[1] + n[2] * 2 * side];
    railing(o, x, z, A.crestY + 0.2, d);
  }
}
function build(o, _f, d = 3) {
  earthwork(o, d);
  spillway(o, d);
  crest(o, d);
  intake(o, d);
}
export function tokuyamaPlan() {
  return { earth, spill, earthUV, spillUV, U, V, O, roadLength };
}
export const tokuyamaSkyline = (o, f) => build(o, f, 0);
export const tokuyamaDistrict = (o, f) => build(o, f, 1);
export const tokuyamaStreet = (o, f) => build(o, f, 2);
export const tokuyamaCloseup = (o, f) => build(o, f, 3);
export const tokuyamaDamModel = {
  id: 'tokuyama_dam',
  key: 'tokuyama_dam',
  cell: 'xn/xn3',
  recipe: 'structure-tokuyama-dam.mjs',
  title: 'Tokuyama Dam',
  category: 'dam',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [850, 475, 1000],
  lookAt: [0, -20, -20],
  portableGroundY: A.foundationY - 0.2,
  mediumFiContext: { scale: 2.3, groundY: A.foundationY - 0.2 },
  qaCameras: [
    {
      name: 'whole-embankment-four-surface-gates-open-channels-and-intake',
      position: [750, 420, 880],
      lookAt: [0, -20, -25],
      reviewLod: 'skyline',
    },
    {
      name: 'whole-upstream-face-curved-native-crest-and-intake',
      position: [-690, 220, -740],
      lookAt: [0, 12, -80],
    },
    {
      name: 'four-radial-gate-backs-control-boxes-and-real-open-channels',
      position: [-80, 100, 175],
      lookAt: [-170, 28, 7],
    },
    {
      name: 'intrinsic-intake-tower-open-supports-and-service-bridge',
      position: [-90, 105, -490],
      lookAt: [90, 22, -335],
    },
    {
      name: 'whole-native-plan-rockfill-slope-and-curved-channel-dividers',
      position: [760, 650, 450],
      lookAt: [0, -5, -10],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-tokuyama-dam.mjs',
    level: 'skyline',
    export: 'tokuyamaSkyline',
    errorMeters: 20,
    surfaces,
    authoredLevels: {
      district: { export: 'tokuyamaDistrict', errorMeters: 8, surfaces },
      street: { export: 'tokuyamaStreet', errorMeters: 3, surfaces },
      closeup: { export: 'tokuyamaCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Wholeactualdam architecture, not4kmdownstreamplant: fullmapped21controlenvelope partitioned intoslopingrockfill andopenconcretespillway, nativecurvedcrest/gatebridge/parapets, foursurfaceradialgatebacks/stiffeners/arms/widecentralmonolith/palecontrolrooms, realopenlongchannelstaperingdividers, intrinsicintake/stiltlegs/servicebridge. Naturalhill/reservoir/forest/upstreamreservoirbridge/administrationcampus/vehicles/interiors/text excluded. Two lowerorificegates are concealedmechanisms recordedasfacts, not inventedvisibleoutlets.',
    'OnlyfiveexactpublishedQualla先従隗始Own/selfCC0 originals individuallyinspected/nativeSHA1matched. Ownernumerictextfacts only, no protectedsectiondrawing/damcard/photo pixels. No sourcearticle/media/rightsmetadata repairs or supplementalphotographs/phototextures. Componentboundary/channelplan/gate/roomdimensions/intakeplacement/structuralprofile/hiddenfaces are original bounded mediumfi estimates.',
    'Independent1600m129x129field/16641samples/sixoriginalrawtiles frozen before allfloors/sections/geometry. Primarycrest406m/foundation245m remain independentstructural references relativefixed371.0968m provider datum; no terrainfit. Exactabutment/footing/waterline/thresholdcontact unresolved, originalfield immutable/geographicpreview/replaceFootprintfalse. Diagnosticflatground cannot seat allslopingdamsections, originalsourcefield inspectedseparately.',
  ],
};

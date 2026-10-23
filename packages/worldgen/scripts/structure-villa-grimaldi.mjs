/** Whole current Villa Grimaldi memorial architecture and open courts. Original medium-fi exterior. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/66/66j/villa_grimaldi/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters.architecturalSections,
  c = Math.cos(A.workingHeading),
  s = Math.sin(A.workingHeading),
  local = (q) => [c * q[0] - s * q[1], s * q[0] + c * q[1]],
  world = (q) => [c * q[0] + s * q[2], q[1], -s * q[0] + c * q[2]],
  ring = (P) =>
    Math.hypot(P[0][0] - P.at(-1)[0], P[0][1] - P.at(-1)[1]) < 1e-6 ? P.slice(0, -1) : P,
  C = {
    wall: rgb('c4c0b0'),
    stone: rgb('8c8b7c'),
    wood: rgb('78604c'),
    metal: rgb('48514e'),
    roof: rgb('ecebe1'),
    glass: rgb('555e5b'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.96, metallic: 0 },
    stone: { slot: 'foundation', graph: 'stone_ashlar', roughness: 0.97, metallic: 0 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.94, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.87, metallic: 0.15 },
    roof: { slot: 'roof', localRef: 'palette:#fffffe', roughness: 0.96, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#fffffd', roughness: 0.65, metallic: 0.05 },
  },
  sub = (a, b) => a.map((v, k) => v - b[k]);
function T(o, k, q, n, col = C[k]) {
  q = q.map((v) => world(v).map(Math.fround));
  if (n) n = [c * n[0] + s * n[2], n[1], -s * n[0] + c * n[2]];
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((sum, v, k) => sum + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    k,
    'palette:#ffffff',
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
function faces(P, inside = false) {
  P = ring(P);
  const area = P.reduce(
    (s, v, k) => s + v[0] * P[(k + 1) % P.length][1] - P[(k + 1) % P.length][0] * v[1],
    0,
  );
  if (area < 0) P = P.toReversed();
  return P.map((a, k) => {
    const b = P[(k + 1) % P.length],
      v = sub(b, a),
      w = Math.hypot(...v),
      u = v.map((x) => x / w),
      n = [u[1], 0, -u[0]].map((x) => x * (inside ? -1 : 1));
    return { a, b, w, u, n };
  }).filter((f) => f.w > 0.005);
}
const pt = (f, x, y, depth = 0) => [
  f.a[0] + x * f.u[0] + depth * f.n[0],
  y,
  f.a[1] + x * f.u[1] + depth * f.n[2],
];
function patch(o, k, f, x0, x1, y0, y1, off = 0) {
  Q(
    o,
    k,
    [
      pt(f, x0, typeof y0 === 'function' ? y0(x0) : y0, off),
      pt(f, x1, typeof y0 === 'function' ? y0(x1) : y0, off),
      pt(f, x1, typeof y1 === 'function' ? y1(x1) : y1, off),
      pt(f, x0, typeof y1 === 'function' ? y1(x0) : y1, off),
    ],
    f.n,
  );
}
function flat(o, k, P, y, col = C[k], down = false) {
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      k,
      ids.slice(i, i + 3).map((j) => [P[j][0], typeof y === 'function' ? y(...P[j]) : y, P[j][1]]),
      [0, down ? -1 : 1, 0],
      col,
    );
}
function prism(o, k, P, y0, y1, col = C[k]) {
  for (const f of faces(P))
    Q(o, k, [pt(f, 0, y0), pt(f, f.w, y0), pt(f, f.w, y1), pt(f, 0, y1)], f.n, col);
  flat(o, k, P, y1, col);
  flat(o, k, P, y0, col, true);
}
function beam(o, k, a, b, r, d = 0, col = C[k]) {
  const v = sub(b, a),
    L = Math.hypot(...v);
  if (L < 1e-5) return;
  const u = v.map((x) => x / L),
    a0 = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0],
    e = cross(u, a0),
    n = Math.hypot(...e),
    e1 = e.map((x) => x / n),
    e2 = cross(u, e1),
    N = d === 3 ? 6 : d < 2 ? 3 : 4;
  const R = [a, b].map((p) =>
    Array.from({ length: N }, (_, i) =>
      p.map(
        (v, k) =>
          v +
          r * (e1[k] * Math.cos((2 * Math.PI * i) / N) + e2[k] * Math.sin((2 * Math.PI * i) / N)),
      ),
    ),
  );
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N,
      nn = R[0][i].map((v, k) => v - a[k]);
    Q(o, k, [R[0][i], R[0][j], R[1][j], R[1][i]], nn, col);
  }
  for (let i = 1; i < N - 1; i++) {
    T(
      o,
      k,
      [R[0][0], R[0][i], R[0][i + 1]],
      u.map((x) => -x),
      col,
    );
    T(o, k, [R[1][0], R[1][i], R[1][i + 1]], u, col);
  }
}
function strip(o, k, f, a, b, y0, y1, inside = -0.1, out = 0.16) {
  prism(
    o,
    k,
    [pt(f, a, 0, inside), pt(f, b, 0, inside), pt(f, b, 0, out), pt(f, a, 0, out)].map((q) => [
      q[0],
      q[2],
    ]),
    y0,
    y1,
  );
}
const F = p.parameters.floorY,
  feature = (id) => p.features.find((f) => f.id === id),
  plan = (id) => ring(feature(`way/${id}`).outline).map(local),
  point = (id) => local(feature(`node/${id}`).outline[0]),
  center = (P) => P.reduce((a, q) => [a[0] + q[0] / P.length, a[1] + q[1] / P.length], [0, 0]);
function box(o, k, x, y, z, w, h, l, col = C[k]) {
  prism(
    o,
    k,
    [
      [x - w / 2, z - l / 2],
      [x + w / 2, z - l / 2],
      [x + w / 2, z + l / 2],
      [x - w / 2, z + l / 2],
    ],
    y,
    y + h,
    col,
  );
}
function wallLine(o, k, P, w, y0, y1, d = 3, col = C[k]) {
  const R = P.map((q, i) => {
    const a = P[Math.max(0, i - 1)],
      b = P[Math.min(P.length - 1, i + 1)],
      v = sub(b, a),
      L = Math.hypot(...v),
      n = [v[1] / L, -v[0] / L];
    return [q.map((v, k) => v + (n[k] * w) / 2), q.map((v, k) => v - (n[k] * w) / 2)];
  });
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i],
      b = R[i + 1],
      v = sub(P[i + 1], P[i]),
      n = [v[1], 0, -v[0]],
      lo = typeof y0 === 'function' ? y0(P[i], i) : y0,
      lb = typeof y0 === 'function' ? y0(P[i + 1], i + 1) : y0,
      hi = typeof y1 === 'function' ? y1(P[i], i) : y1,
      hb = typeof y1 === 'function' ? y1(P[i + 1], i + 1) : y1,
      q = (p, y) => [p[0], y, p[1]];
    Q(o, k, [q(a[0], lo), q(b[0], lb), q(b[0], hb), q(a[0], hi)], n, col);
    Q(
      o,
      k,
      [q(a[1], lo), q(a[1], hi), q(b[1], hb), q(b[1], lb)],
      n.map((x) => -x),
      col,
    );
    Q(o, k, [q(a[0], hi), q(b[0], hb), q(b[1], hb), q(a[1], hi)], [0, 1, 0], col);
    if (d > 0) Q(o, k, [q(a[0], lo), q(a[1], lo), q(b[1], lb), q(b[0], lb)], [0, -1, 0], col);
  }
  for (const [i, sg] of [
    [0, -1],
    [R.length - 1, 1],
  ]) {
    const a = R[i],
      v = sub(P.at(-1), P[0]),
      y = typeof y0 === 'function' ? y0(P[i], i) : y0,
      h = typeof y1 === 'function' ? y1(P[i], i) : y1;
    Q(
      o,
      k,
      [
        [a[0][0], y, a[0][1]],
        [a[1][0], y, a[1][1]],
        [a[1][0], h, a[1][1]],
        [a[0][0], h, a[0][1]],
      ],
      [sg * v[0], 0, sg * v[1]],
      col,
    );
  }
}
function outlineRing(o, k, P, width, y0, y1, d = 3, col = C[k]) {
  const area = P.reduce(
    (sum, q, i) => sum + q[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * q[1],
    0,
  );
  if (area < 0) P = P.toReversed();
  const c = center(P),
    I = P.map((q) => {
      const v = sub(q, c),
        L = Math.hypot(...v);
      return q.map((x, k) => x - (v[k] * width) / L);
    });
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length,
      a = P[i],
      b = P[j],
      u = I[i],
      v = I[j],
      n = [b[1] - a[1], 0, a[0] - b[0]];
    Q(
      o,
      k,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      n,
      col,
    );
    Q(
      o,
      k,
      [
        [u[0], y0, u[1]],
        [u[0], y1, u[1]],
        [v[0], y1, v[1]],
        [v[0], y0, v[1]],
      ],
      n.map((x) => -x),
      col,
    );
    Q(
      o,
      k,
      [
        [a[0], y1, a[1]],
        [b[0], y1, b[1]],
        [v[0], y1, v[1]],
        [u[0], y1, u[1]],
      ],
      [0, 1, 0],
      col,
    );
    if (d > 0)
      Q(
        o,
        k,
        [
          [a[0], y0, a[1]],
          [u[0], y0, u[1]],
          [v[0], y0, v[1]],
          [b[0], y0, b[1]],
        ],
        [0, -1, 0],
        col,
      );
  }
  return I;
}
function roofGable(o, P, eaves, rise, d, color = rgb('87847a'), openRoof = false) {
  const a = P[0],
    b = P[1],
    v = sub(b, a),
    L = Math.hypot(...v),
    u = v.map((x) => x / L),
    depth = P[2].map((x, k) => x - b[k]),
    q = (x, z, y) => [a[0] + u[0] * x + depth[0] * z, y, a[1] + u[1] * x + depth[1] * z],
    top = [
      q(0, 0, eaves),
      q(L / 2, 0, eaves + rise),
      q(L, 0, eaves),
      q(0, 1, eaves),
      q(L / 2, 1, eaves + rise),
      q(L, 1, eaves),
    ];
  Q(o, 'roof', [top[0], top[3], top[4], top[1]], [0, 1, 0], color);
  Q(o, 'roof', [top[1], top[4], top[5], top[2]], [0, 1, 0], color);
  T(o, 'wall', [top[0], top[1], top[2]], [-depth[0], 0, -depth[1]]);
  T(o, 'wall', [top[3], top[5], top[4]], [depth[0], 0, depth[1]]);
  if (d > 1 || openRoof) Q(o, 'roof', [top[0], top[2], top[5], top[3]], [0, -1, 0], rgb('c7c5b8'));
  if (d > 1) beam(o, 'metal', top[1], top[4], 0.045, d);
}
function holesWall(o, k, f, y0, y1, H) {
  const xs = [...new Set([0, f.w, ...H.flatMap((h) => [h.a, h.b])])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i],
      b = xs[i + 1],
      m = (a + b) / 2,
      hs = H.filter((h) => m > h.a - 1e-6 && m < h.b + 1e-6).sort((a, b) => a.y - b.y);
    let low = y0;
    for (const h of hs) {
      patch(o, k, f, a, b, low, h.y);
      low = h.top;
    }
    patch(o, k, f, a, b, low, y1);
  }
}
function window(o, f, h, d) {
  const dep = d > 1 ? -0.16 : 0.018;
  patch(o, 'glass', f, h.a, h.b, h.y, h.top, dep);
  if (d < 2) return;
  for (const [x, sg] of [
    [h.a, 1],
    [h.b, -1],
  ])
    Q(
      o,
      'wall',
      [pt(f, x, h.y), pt(f, x, h.top), pt(f, x, h.top, dep), pt(f, x, h.y, dep)],
      [sg * f.u[0], 0, sg * f.u[1]],
    );
  Q(
    o,
    'wall',
    [pt(f, h.a, h.y), pt(f, h.a, h.y, dep), pt(f, h.b, h.y, dep), pt(f, h.b, h.y)],
    [0, 1, 0],
  );
  Q(
    o,
    'wall',
    [pt(f, h.a, h.top), pt(f, h.b, h.top), pt(f, h.b, h.top, dep), pt(f, h.a, h.top, dep)],
    [0, -1, 0],
  );
  if (d === 3) {
    patch(o, 'metal', f, (h.a + h.b) / 2 - 0.025, (h.a + h.b) / 2 + 0.025, h.y, h.top, dep + 0.025);
    if (!h.door)
      patch(
        o,
        'metal',
        f,
        h.a,
        h.b,
        (h.y + h.top) / 2 - 0.025,
        (h.y + h.top) / 2 + 0.025,
        dep + 0.025,
      );
  }
}
function buildings(o, d) {
  for (const [id, h] of Object.entries(A.serviceHeights)) {
    const P = plan(+id);
    for (const f of faces(P)) {
      const count = d === 0 ? 1 : Math.max(1, Math.round(f.w / 3.5)),
        H = [];
      for (let j = 0; j < count; j++) {
        const x = (f.w * (j + 0.5)) / count,
          w = Math.min(1.0, (f.w / count) * 0.55),
          door = f.n[0] < -0.8 && j === Math.floor(count / 2);
        H.push({
          a: x - w / 2,
          b: x + w / 2,
          y: door ? F : F + 0.95,
          top: F + (door ? 2.25 : 2.1),
          door,
        });
      }
      holesWall(o, 'wall', f, A.baseY, F + h, d > 1 ? H : []);
      for (const h of H) window(o, f, h, d);
      if (d > 1) strip(o, 'stone', f, 0, f.w, F, F + 0.18, -0.03, 0.1);
    }
    flat(o, 'wall', P, A.baseY, C.wall, true);
    roofGable(o, P, F + h, A.serviceRoofRise, d);
  }
  const P = plan(1211121812);
  if (d > 0) flat(o, 'stone', P, F);
  for (const q of P) beam(o, 'metal', [q[0], F, q[1]], [q[0], F + A.shelterEaves, q[1]], 0.055, d);
  roofGable(o, P, F + A.shelterEaves, A.shelterRoofRise, d, C.roof, true);
  if (d > 1) {
    const c = center(P);
    box(o, 'wood', c[0], F, c[1], 1.2, 0.85, 2.5);
    box(o, 'glass', c[0], F + 0.85, c[1], 1.3, 0.05, 2.6);
  }
  const R = plan(1205370100),
    c = center(R);
  for (const f of faces(R)) {
    const H =
      d > 0
        ? [
            {
              a: f.w * 0.28,
              b: f.w * 0.72,
              y: F + A.towerLookoutBottom,
              top: F + A.towerLookoutTop,
            },
          ]
        : [];
    if (f.n[0] < -0.5) H.push({ a: f.w * 0.35, b: f.w * 0.65, y: F, top: F + 1.95, door: true });
    holesWall(o, 'wood', f, A.baseY, F + A.towerHeight, d > 1 ? H : []);
    for (const h of H) window(o, f, h, d);
    if (d > 0) {
      for (const y of [2.6, 5.1, 6.7])
        strip(o, 'wood', f, 0, f.w, F + y, F + y + 0.1, -0.03, 0.075);
      if (d > 1) {
        const N = Math.round(f.w / [1, 1, 0.45, 0.2][d]);
        for (let j = 1; j < N; j++)
          patch(
            o,
            'metal',
            f,
            (f.w * j) / N - 0.008,
            (f.w * j) / N + 0.008,
            F + 0.1,
            F + A.towerHeight - 0.1,
            0.004,
          );
      }
    }
  }
  flat(o, 'wood', R, A.baseY, C.wood, true);
  for (let i = 0; i < R.length; i++) {
    const j = (i + 1) % R.length;
    T(
      o,
      'roof',
      [
        [R[i][0], F + A.towerHeight, R[i][1]],
        [R[j][0], F + A.towerHeight, R[j][1]],
        [c[0], F + A.towerHeight + A.towerRoofRise, c[1]],
      ],
      [0, 1, 0],
      rgb('74766d'),
    );
  }
}
const PV = plan(1205370102),
  pa = PV[0],
  u = sub(PV[1], pa).map((x) => x / Math.hypot(...sub(PV[1], pa))),
  v = sub(PV[3], pa).map((x) => x / Math.hypot(...sub(PV[3], pa))),
  PW = Math.hypot(...sub(PV[1], pa)),
  PL = Math.hypot(...sub(PV[3], pa)),
  pav = (x, y, z) => [pa[0] + u[0] * x + v[0] * z, y, pa[1] + u[1] * x + v[1] * z];
function pavilion(o, d) {
  const B = A.pavilion,
    x0 = B.sideSetback,
    x1 = PW - B.sideSetback,
    z0 = B.frontSetback,
    z1 = PL - B.backSetback,
    apex = [PW / 2, z0 + (z1 - z0) * B.peakLongFraction],
    N = [1, 4, 8, 16][d],
    R = [2, 4, 7, 14][d],
    E = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ],
    surface = (edge, t, r) => {
      const a = E[edge],
        b = E[(edge + 1) % 4],
        q = a.map((x, k) => x + (b[k] - x) * t),
        edgeY = F + B.eavesHeight - B.cornerSag * 4 * (t - 0.5) * (t - 0.5),
        y = edgeY + (F + B.peakHeight - edgeY) * (1 - r) * (1 - r);
      return pav(apex[0] + (q[0] - apex[0]) * r, y, apex[1] + (q[1] - apex[1]) * r);
    };
  for (let k = 0; k < 4; k++)
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < R; i++) {
        const q = [
          surface(k, j / N, i / R),
          surface(k, (j + 1) / N, i / R),
          surface(k, (j + 1) / N, (i + 1) / R),
          surface(k, j / N, (i + 1) / R),
        ];
        Q(o, 'roof', q, [0, 1, 0]);
        Q(
          o,
          'roof',
          q.map((q) => [q[0], q[1] - B.skinThickness, q[2]]),
          [0, -1, 0],
          rgb('d6d4c8'),
        );
      }
      const a = surface(k, j / N, 1),
        b = surface(k, (j + 1) / N, 1);
      Q(
        o,
        'roof',
        [a, b, [b[0], b[1] - B.skinThickness, b[2]], [a[0], a[1] - B.skinThickness, a[2]]],
        [a[0] - pav(...[apex[0], 0, apex[1]])[0], 0, a[2] - pav(apex[0], 0, apex[1])[2]],
      );
    }
  const peak = pav(apex[0], F + B.peakHeight + 0.12, apex[1]);
  for (const [x, z] of [
    [1.1, z0 - 0.6],
    [PW - 1.1, z0 - 0.6],
    [1.1, z1 + 0.6],
    [PW - 1.1, z1 + 0.6],
  ]) {
    const foot = pav(x, F, z);
    beam(o, 'metal', foot, peak, 0.105, d, C.roof);
    if (d > 0) beam(o, 'metal', pav(x < PW / 2 ? 0 : PW, F, z), peak, 0.022, d);
  }
  if (d > 1) {
    for (let k = 0; k < 4; k++) {
      let prev;
      for (let i = 0; i <= R; i++) {
        const q = surface(k, 0, i / R);
        if (prev) beam(o, 'metal', prev, q, 0.018, d);
        prev = q;
      }
    }
  }
  const stage = PV.map((_q, i) => {
    const xx =
        i === 0 || i === 3
          ? (PW * (1 - B.stageWidthFraction)) / 2
          : (PW * (1 + B.stageWidthFraction)) / 2,
      zz = i < 2 ? PL * (1 - B.stageLengthFraction) - 1 : PL - 1;
    const a = pav(xx, 0, zz);
    return [a[0], a[2]];
  });
  prism(o, 'wall', stage, F - 0.05, F + B.stageTop, rgb('8f7560'));
  for (const x of [B.flankingPierOffset, PW - B.flankingPierOffset]) {
    const z = B.frontSetback - 2.2,
      heights = d === 0 ? [0.53, 1] : [0.4, 0.64, 1, 0.55],
      pitch = 0.38;
    for (let j = 0; j < heights.length; j++) {
      const xx = x + (j - (heights.length - 1) / 2) * pitch,
        P = [
          pav(xx - 0.145, 0, z - 0.3),
          pav(xx + 0.145, 0, z - 0.3),
          pav(xx + 0.145, 0, z + 0.3),
          pav(xx - 0.145, 0, z + 0.3),
        ].map((q) => [q[0], q[2]]);
      prism(o, 'stone', P, F, F + B.flankingPierHeight * heights[j]);
      if (j === 2 && d > 0) {
        const face = faces(P).find((f) => f.n[0] * v[0] + f.n[2] * v[1] < -0.8),
          H = F + B.flankingPierHeight;
        patch(o, 'glass', face, 0.065, face.w - 0.065, F + 0.3, H - 0.2, 0.006);
        if (d > 1) {
          const n = d === 3 ? 22 : 12;
          for (let k = 1; k < n; k++) {
            const y = F + 0.3 + ((H - F - 0.5) * k) / n;
            patch(o, 'stone', face, 0.03, face.w - 0.03, y - 0.025, y + 0.025, 0.012);
          }
        }
        if (d > 1) {
          const Pbase = [
            pav(xx - 0.17, 0, z - 0.33),
            pav(xx + 0.17, 0, z - 0.33),
            pav(xx + 0.17, 0, z + 0.33),
            pav(xx - 0.17, 0, z + 0.33),
          ].map((q) => [q[0], q[2]]);
          for (let y = F + 0.4; y < F + B.flankingPierHeight * heights[j]; y += 0.55)
            prism(o, 'stone', Pbase, y, y + 0.035);
        }
      }
    }
  }
}
function sparse(P, n) {
  if (P.length <= n) return P;
  return Array.from({ length: n }, (_, i) => P[Math.floor((i * P.length) / n)]);
}
function basin(o, P, rim, bottom, width, d, spout = false) {
  P = sparse(P, d === 0 ? 6 : P.length);
  const I = outlineRing(o, 'stone', P, width, F - 0.035, rim, d);
  flat(o, 'stone', I, bottom, rgb('aaa79b'));
  if (d > 1) {
    const Cc = center(I);
    for (const q of I)
      beam(o, 'stone', [Cc[0], bottom + 0.005, Cc[1]], [q[0], bottom + 0.005, q[1]], 0.008, d);
  }
  if (spout) {
    const c = center(I),
      N = [4, 6, 10, 14][d],
      R = Array.from({ length: N }, (_, i) => [
        c[0] + 0.55 * Math.cos((2 * Math.PI * i) / N),
        c[1] + 0.55 * Math.sin((2 * Math.PI * i) / N),
      ]);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      T(
        o,
        'wall',
        [
          [R[i][0], bottom, R[i][1]],
          [R[j][0], bottom, R[j][1]],
          [c[0], bottom + 0.6, c[1]],
        ],
        [R[i][0] - c[0], 0.4, R[i][1] - c[1]],
        rgb('ac8c7f'),
      );
    }
  }
}
function fountains(o, d) {
  basin(o, plan(1204054446), A.poolRimTop, A.poolFloor, A.poolWidth, d);
  basin(o, plan(1211121811), A.fountainRimTop, A.fountainFloor, 0.18, d, true);
  basin(o, plan(1211121816), 0.23, 0.055, 0.16, d);
  for (const id of [11170906051, 11170906061]) {
    const c = point(id),
      r = id === 11170906051 ? 1.0 : 0.7,
      P = Array.from({ length: [4, 8, 12, 18][d] }, (_, i) => [
        c[0] + r * Math.cos((2 * Math.PI * i) / [4, 8, 12, 18][d]),
        c[1] + r * Math.sin((2 * Math.PI * i) / [4, 8, 12, 18][d]),
      ]);
    basin(o, P, 0.26, 0.065, 0.14, d, d > 0);
  }
}
function paths(o, d) {
  const brick = rgb('9b9076');
  for (const f of p.features.filter((f) => f.tags?.highway === 'footway')) {
    const P = f.outline.map(local);
    if (d === 0) {
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i],
          b = P[i + 1],
          v = sub(b, a),
          L = Math.hypot(...v),
          n = [((v[1] / L) * A.pathWidth) / 2, ((-v[0] / L) * A.pathWidth) / 2];
        Q(
          o,
          'stone',
          [
            [a[0] + n[0], A.pathTop, a[1] + n[1]],
            [b[0] + n[0], A.pathTop, b[1] + n[1]],
            [b[0] - n[0], A.pathTop, b[1] - n[1]],
            [a[0] - n[0], A.pathTop, a[1] - n[1]],
          ],
          [0, 1, 0],
          brick,
        );
      }
    } else {
      wallLine(o, 'stone', P, A.pathWidth, A.baseY, A.pathTop, d, brick);
      if (d > 1) {
        for (let i = 0; i < P.length - 1; i++) {
          const a = P[i],
            b = P[i + 1],
            v = sub(b, a),
            L = Math.hypot(...v),
            n = [v[1] / L, -v[0] / L];
          for (const sg of [-1, 1])
            wallLine(
              o,
              'stone',
              [a, b].map((q) => q.map((x, k) => x + sg * n[k] * (A.pathWidth / 2 - 0.05))),
              0.09,
              A.pathTop,
              A.pathTop + 0.075,
              d,
              rgb('acaaa0'),
            );
        }
      }
    }
  }
  const patio = plan(1211121817);
  if (d > 0) {
    const a = patio[0],
      b = patio[1],
      c = patio[3],
      point = (u, v) => a.map((x, k) => x + (b[k] - x) * u + (c[k] - x) * v);
    for (let i = 1; i < (d === 1 ? 2 : 4); i++)
      wallLine(
        o,
        'stone',
        [point(i / (d === 1 ? 2 : 4), 0), point(i / (d === 1 ? 2 : 4), 1)],
        A.courtGridWidth,
        A.baseY,
        A.pathTop + 0.01,
        d,
        brick,
      );
    if (d > 1)
      for (let j = 1; j < 5; j++)
        wallLine(
          o,
          'stone',
          [point(0, j / 5), point(1, j / 5)],
          A.courtGridWidth,
          A.baseY,
          A.pathTop + 0.01,
          d,
          brick,
        );
  }
  const rose = plan(1205370101);
  outlineRing(o, 'stone', sparse(rose, d === 0 ? 6 : rose.length), 0.16, 0.05, 0.18, d);
  for (const f of p.features.filter((f) => f.tags?.highway === 'steps')) {
    const P = f.outline.map(local),
      a = P[0],
      b = P[1],
      v = sub(b, a),
      L = Math.hypot(...v),
      n = [v[1] / L, -v[0] / L],
      N = d === 0 ? 2 : 6;
    for (let i = 0; i < N; i++) {
      const t0 = i / N,
        t1 = (i + 1) / N,
        lo = a.map((x, k) => x + v[k] * t0),
        hi = a.map((x, k) => x + v[k] * t1),
        P = [
          lo.map((x, k) => x + n[k] * 0.65),
          hi.map((x, k) => x + n[k] * 0.65),
          hi.map((x, k) => x - n[k] * 0.65),
          lo.map((x, k) => x - n[k] * 0.65),
        ];
      prism(o, 'stone', P, 0.025, 0.05 + (A.roseTerraceTop - 0.05) * t1);
    }
  }
}
function fence(o, P, d, gate = false) {
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i],
      b = P[i + 1],
      L = Math.hypot(...sub(b, a));
    if (d === 0 && gate) {
      const v = sub(b, a),
        n = [v[1], 0, -v[0]],
        q = [
          [a[0], F, a[1]],
          [b[0], F, b[1]],
          [b[0], F + 1.9, b[1]],
          [a[0], F + 1.9, a[1]],
        ];
      Q(o, 'metal', q, n);
      Q(
        o,
        'metal',
        q,
        n.map((v) => -v),
      );
      continue;
    }
    for (const y of d === 0 ? [F + 1.95] : [F + 1.05, F + 1.95])
      beam(o, 'metal', [a[0], y, a[1]], [b[0], y, b[1]], 0.035, d);
    const N = d === 0 ? 1 : Math.ceil(L / [18, 3, 1.1, 0.3][d]);
    for (let j = 0; j <= N; j++) {
      const q = a.map((x, k) => x + ((b[k] - x) * j) / N);
      beam(o, 'metal', [q[0], F, q[1]], [q[0], F + 2.0, q[1]], gate ? 0.035 : 0.02, d);
    }
  }
}
function memorials(o, d) {
  const c = point(11170906082),
    B = A.memorialWall,
    u = [Math.SQRT1_2, Math.SQRT1_2],
    n = [Math.SQRT1_2, -Math.SQRT1_2],
    N = [4, 8, 16, 24][d],
    curve = (t) => [
      c[0] + u[0] * t + n[0] * B.curve * (t / (B.width / 2)) * (t / (B.width / 2)),
      c[1] + u[1] * t + n[1] * B.curve * (t / (B.width / 2)) * (t / (B.width / 2)),
    ],
    P = Array.from({ length: N + 1 }, (_, i) => curve(-B.width / 2 + (B.width * i) / N));
  wallLine(o, 'stone', P, B.thickness + 0.25, F - 0.08, F + B.plinth, d);
  wallLine(o, 'stone', P, B.thickness, F + B.plinth, F + B.height, d);
  const count = d === 0 ? 3 : B.plaques;
  for (let j = 0; j < count; j++) {
    const a = curve(-B.width / 2 + (B.width * (j + 0.07)) / count),
      b = curve(-B.width / 2 + (B.width * (j + 0.93)) / count),
      v = sub(b, a),
      L = Math.hypot(...v),
      nn = [v[1] / L, -v[0] / L],
      q = (p, dep) => p.map((x, k) => x + nn[k] * dep),
      R = [
        q(a, B.thickness / 2 + 0.025),
        q(b, B.thickness / 2 + 0.025),
        q(b, B.thickness / 2 + 0.065),
        q(a, B.thickness / 2 + 0.065),
      ];
    if (d === 0)
      Q(
        o,
        'glass',
        [
          [R[0][0], F + 0.54, R[0][1]],
          [R[1][0], F + 0.54, R[1][1]],
          [R[1][0], F + 2.1, R[1][1]],
          [R[0][0], F + 2.1, R[0][1]],
        ],
        [nn[0], 0, nn[1]],
        rgb('6c706b'),
      );
    else prism(o, 'glass', R, F + 0.54, F + 2.1, rgb('6c706b'));
  }
  if (d > 1)
    for (let i = 0; i < N; i++) {
      const a = P[i],
        b = P[i + 1],
        mid = a.map((x, k) => (x + b[k]) / 2),
        v = sub(b, a),
        L = Math.hypot(...v),
        u = v.map((x) => x / L),
        nn = [u[1], -u[0]];
      for (let j = 0; j < (d === 3 ? 5 : 3); j++) {
        const y = F + 0.45 + (j * (B.height - 0.55)) / (d === 3 ? 5 : 3),
          w = L * 0.85,
          dep = B.thickness / 2 + 0.018,
          Qp = [-1, 1].map((sg) => mid.map((x, k) => x + (sg * u[k] * w) / 2 + nn[k] * dep));
        wallLine(o, 'stone', Qp, 0.025, y, y + 0.035, d, rgb('aaa99c'));
      }
    }
  const s = point(11221386298),
    S = A.solidarityWall,
    R = Array.from({ length: [3, 5, 9, 14][d] }, (_, i) => {
      const t = -1 + (2 * i) / ([3, 5, 9, 14][d] - 1);
      return [s[0] + 1.2 * (1 - Math.cos(t)), s[1] + S.radius * Math.sin(t)];
    });
  wallLine(o, 'stone', R, S.width, F, F + S.height, d);
  wallLine(o, 'stone', R, S.width + 0.1, F + S.height - 0.1, F + S.height, d, rgb('ada99b'));
  for (const f of p.features.filter(
    (f) => f.tags?.barrier === 'wall' || f.tags?.barrier === 'retaining_wall',
  )) {
    const P = f.outline.map(local),
      boundary = f.tags.barrier === 'wall',
      h = boundary ? A.boundaryHeight : 0.55;
    wallLine(
      o,
      'stone',
      P,
      boundary ? A.boundaryWidth : 0.32,
      A.baseY,
      F + h,
      d,
      boundary ? rgb('b2b2a6') : C.stone,
    );
    if (d > 1 && !boundary) wallLine(o, 'stone', P, 0.4, F + h - 0.1, F + h, d, rgb('aca99b'));
  }
  fence(o, feature('way/1211121815').outline.map(local), d);
  const old = point(11221386261),
    v0 = [0.905, -0.425],
    P0 = [-1, 1].map((sg) => old.map((x, k) => x + sg * 1.8 * v0[k]));
  for (const a of P0) box(o, 'stone', a[0], F, a[1], 0.3, 2.2, 0.3);
  fence(o, P0, d, true);
  if (d > 0) wallLine(o, 'metal', P0, 0.035, F + 0.2, F + 1.65, d, rgb('53625b'));
  const entry = feature('way/1211121813').outline.map(local);
  for (const a of [entry[0], entry.at(-1)]) {
    box(o, 'stone', a[0], F, a[1], 0.34, 2.35, 0.34);
    const inward = [0, 2.3],
      b = a.map((x, k) => x + inward[k]);
    fence(o, [a, b], d, true);
  }
}
function build(o, _f, d = 3) {
  paths(o, d);
  buildings(o, d);
  pavilion(o, d);
  fountains(o, d);
  memorials(o, d);
}
export const grimaldiSkyline = (o, f) => build(o, f, 0),
  grimaldiDistrict = (o, f) => build(o, f, 1),
  grimaldiStreet = (o, f) => build(o, f, 2),
  grimaldiCloseup = (o, f) => build(o, f, 3);
const camera = (name, pos, look) => ({ name, position: world(pos), lookAt: world(look) });
export const villaGrimaldiModel = {
  id: 'villa_grimaldi',
  key: 'villa_grimaldi',
  cell: '66/66j',
  recipe: 'structure-villa-grimaldi.mjs',
  title: 'Villa Grimaldi',
  category: 'landmark',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: world([-135, 115, -160]),
  lookAt: world([0, 3, 0]),
  portableGroundY: -0.24,
  mediumFiContext: { scale: 1.15, groundY: -0.2 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    camera(
      'whole-current-memory-park-open-courts-and-all-native-components',
      [-135, 115, -160],
      [0, 3, 0],
    ),
    camera('opposite-pavilion-tower-pool-and-whole-perimeter', [140, 95, 145], [0, 4, 0]),
    camera(
      'tensile-pavilion-open-soffit-aframe-and-flanking-stepped-piers',
      [-14, 7, 9],
      [16, 6, 41],
    ),
    camera('pavilion-white-membrane-and-visible-open-underside', [10, 1.5, 28], [17, 6, 44]),
    camera('reconstructed-timber-tower-and-surviving-memory-room', [52, 12, 73], [33, 4, 60]),
    camera('curved-grey-name-wall-abstract-plaques-and-low-plinth', [-18, 4, 29], [-37, 1.5, 44]),
    camera('central-dry-fountain-and-native-retaining-terraces', [-18, 9, -13], [-7, 1, 6]),
    camera('native-garden-grid-old-gate-and-modern-service-buildings', [-55, 35, -63], [4, 2, -38]),
    camera(
      'whole-native-open-site-and-separate-building-pavilion-pool-footprints',
      [4, 185, 3],
      [0, 0, 0],
    ),
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-villa-grimaldi.mjs',
    level: 'skyline',
    export: 'grimaldiSkyline',
    errorMeters: 1.2,
    surfaces,
    authoredLevels: {
      district: { export: 'grimaldiDistrict', errorMeters: 0.6, surfaces },
      street: { export: 'grimaldiStreet', errorMeters: 0.1, surfaces },
      closeup: { export: 'grimaldiCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole current memory-park architectural ensemble/Q2301496 uses actual7-corner open siteway111293916, five native building/roof footprints including reconstructed timber tower/SalaMemoria/service buildings/display shelter, separate Teatro por la Vida tensile pavilion/open underside/A-frame/stays/tall flanking stepped piers/platform, actual pool/fountain/court/wall/gate/retaining and bounded path/stair controls. No destroyed original villa presented as surviving, facade-only panel or whole-site solid slab.',
    'Exact cleared Qualla LionHirth2006 Own/PD-self2048x1536 wall original plus three exact same-creatorPD court/garden/pavilion originals individually inspected/nativeSHA1matched. Primary owner/CMN text only resolves demolition and tower reconstruction/restoration; no protected gallery/plan pixels. Abstract plaque/neutral pier tile/basin divisions only; no copied names/lettering/portraits/pictorial mosaic/murals/independent sculpture/photo textures/borrowed meshes/generated bitmaps/policy-verifier changes.',
    'Cleared photographs are partial2006 views and do not show current tower/modern service rear roofs or2019 tower changes. Tower height/cap/lookout/board census, service gables/window rhythm/current finishes, tensile roof extent/shape/supports/stepped pier/terrace and wall/plaques/fountain/bench sections are bounded original medium-fi estimates using actual native component plans and primary text; no as-built/private or torture interior reconstruction claimed. Pool/fountain dry linings remain visible in genuine open bowls above appearance-stage height; vertical excavation/water state/thresholds estimated.',
    'Original400m/129x129/16641-value independent field/two raw tiles/PNG frozen before geometry/floor/component choices unchanged. Independent flat appearance floors/paths/component levels; source urban relief may bury/raise structures or disagree with foundations/terraces. Separate unchanged original-field evidence; exact source/host terrain contact unresolved/replacementfalse. No source flattening/fitting/reacquisition, full-site floor/vegetation/neighborhood/people/vehicles/private rooms.',
  ],
};

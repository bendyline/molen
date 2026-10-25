/** Whole Trindade basilica and its native elevated entrance approach. Original medium-fi exterior. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/6v/6vh/basilica_of_the_eternal_father_trindade/',
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
  outer = ring(p.outline).map(local),
  C = {
    wall: rgb('c19d88'),
    trim: rgb('dfc6a5'),
    roof: rgb('b79e8b'),
    metal: rgb('34464a'),
    glass: rgb('6d7774'),
    deck: rgb('d4bb99'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
    trim: { slot: 'trim', graph: 'stucco', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.35 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.4, metallic: 0.14 },
    deck: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
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
function clip(P, axis, value, less = true) {
  const R = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      b = P[(i + 1) % P.length],
      ia = less ? a[axis] <= value : a[axis] >= value,
      ib = less ? b[axis] <= value : b[axis] >= value;
    if (ia) R.push(a);
    if (ia !== ib) {
      const t = (value - a[axis]) / (b[axis] - a[axis]);
      R.push(a.map((v, k) => v + t * (b[k] - v)));
    }
  }
  return R;
}
function beam(o, k, a, b, r, d = 0) {
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
    Q(o, k, [R[0][i], R[0][j], R[1][j], R[1][i]], nn);
  }
  for (let i = 1; i < N - 1; i++) {
    T(
      o,
      k,
      [R[0][0], R[0][i], R[0][i + 1]],
      u.map((x) => -x),
    );
    T(o, k, [R[1][0], R[1][i], R[1][i + 1]], u);
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
  gold = rgb('b7984e'),
  roofY = (_x, z) =>
    A.naveEaves +
    A.naveRise *
      Math.max(
        0,
        1 - ((z - A.naveCenterZ) / A.naveHalfWidth) * ((z - A.naveCenterZ) / A.naveHalfWidth),
      ),
  ramp = p.features.find((f) => f.id === 'way/486368471').outline.map(local),
  rampY = (x) => F - (F - A.rampToe) * Math.max(0, Math.min(1, (-80 - x) / 77)),
  frontAxis = (() => {
    const a = outer[7],
      b = outer[5],
      v = sub(b, a),
      w = Math.hypot(...v),
      u = v.map((x) => x / w);
    return { a, b, w, u, n: [u[1], 0, -u[0]] };
  })();
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
function roof(o, P, Y, d) {
  const ids = earcut(P.flat()),
    mid = (a, b) => a.map((v, k) => (v + b[k]) / 2);
  function divide(q, n) {
    if (!n) {
      T(
        o,
        'roof',
        q.map(([x, z]) => [x, Y(x, z), z]),
        [0, 1, 0],
      );
      return;
    }
    const [a, b, c] = q,
      ab = mid(a, b),
      bc = mid(b, c),
      ca = mid(c, a);
    for (const r of [
      [a, ab, ca],
      [ab, b, bc],
      [ca, bc, c],
      [ab, bc, ca],
    ])
      divide(r, n - 1);
  }
  for (let i = 0; i < ids.length; i += 3)
    divide(
      ids.slice(i, i + 3).map((j) => P[j]),
      d,
    );
}
function wall(o, f, y0, y1, H) {
  const xs = [...new Set([0, f.w, ...H.flatMap((h) => [h.a, h.b])])].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i],
      b = xs[i + 1],
      m = (a + b) / 2,
      hs = H.filter((h) => m > h.a - 1e-6 && m < h.b + 1e-6).sort((a, b) => a.y - b.y);
    let lo = y0;
    for (const h of hs) {
      patch(o, 'wall', f, a, b, lo, h.y);
      lo = h.top;
    }
    patch(o, 'wall', f, a, b, lo, y1);
  }
}
function pane(o, f, h, d) {
  const dep = d > 1 ? -A.reveal : 0.025;
  patch(o, 'glass', f, h.a, h.b, h.y, h.top, dep);
  if (d < 2) return;
  for (const [x, sg] of [
    [h.a, 1],
    [h.b, -1],
  ])
    Q(
      o,
      'trim',
      [pt(f, x, h.y), pt(f, x, h.top), pt(f, x, h.top, dep), pt(f, x, h.y, dep)],
      [sg * f.u[0], 0, sg * f.u[1]],
    );
  Q(
    o,
    'trim',
    [pt(f, h.a, h.y), pt(f, h.a, h.y, dep), pt(f, h.b, h.y, dep), pt(f, h.b, h.y)],
    [0, 1, 0],
  );
  Q(
    o,
    'trim',
    [pt(f, h.a, h.top), pt(f, h.b, h.top), pt(f, h.b, h.top, dep), pt(f, h.a, h.top, dep)],
    [0, -1, 0],
  );
  for (const y of [h.y, h.top])
    strip(o, 'trim', f, h.a - 0.07, h.b + 0.07, y - 0.055, y + 0.055, -0.08, 0.1);
  const count = d === 3 ? 7 : 3;
  for (let j = 1; j < count; j++) {
    const y = h.y + ((h.top - h.y) * j) / count;
    patch(o, 'metal', f, h.a, h.b, y - 0.025, y + 0.025, dep + 0.035);
  }
  if (d === 3) {
    for (let j = 1; j < 3; j++) {
      const x = h.a + ((h.b - h.a) * j) / 3;
      patch(o, 'metal', f, x - 0.02, x + 0.02, h.y, h.top, dep + 0.035);
    } // Abstract subdued panes only: no reproduced religious figures or pictorial panels.
    for (let j = 0; j < 3; j++) {
      const a = h.a + ((h.b - h.a) * j) / 3,
        b = h.a + ((h.b - h.a) * (j + 1)) / 3;
      Q(
        o,
        'glass',
        [
          pt(f, a, h.y + 0.5, dep + 0.007),
          pt(f, b, h.y + 0.5, dep + 0.007),
          pt(f, b, h.top - 0.4, dep + 0.007),
          pt(f, a, h.top - 0.4, dep + 0.007),
        ],
        f.n,
        rgb(['767763', '7a7167', '697471'][j]),
      );
    }
  }
}
function openings(f, d) {
  const H = [],
    front = f.n[0] < -0.95 && (f.a[0] + f.b[0]) / 2 < -37,
    back = f.n[0] > 0.95 && (f.a[0] + f.b[0]) / 2 > 37;
  if (front) {
    for (let j = 0; j < 5; j++) {
      const q = pt(frontAxis, (frontAxis.w * (j + 0.5)) / 5, 0),
        x = (q[0] - f.a[0]) * f.u[0] + (q[2] - f.a[1]) * f.u[1],
        w = 3.55,
        a = Math.max(0, x - w / 2),
        b = Math.min(f.w, x + w / 2);
      if (b > a + 0.01) H.push({ a, b, y: A.windowBottom, top: A.windowTop });
    }
    const q = outer[6],
      x = (q[0] - f.a[0]) * f.u[0] + (q[1] - f.a[1]) * f.u[1],
      a = Math.max(0, x - 1.65),
      b = Math.min(f.w, x + 1.65);
    if (b > a + 0.01) H.push({ a, b, y: F, top: F + 4.05, door: true });
    return H;
  }
  if (!d) return H;
  const count = Math.max(1, Math.round(f.w / (back ? 5 : 3.7)));
  for (let j = 0; j < count; j++) {
    const x = (f.w * (j + 0.5)) / count,
      w = Math.min(2.6, (f.w / count) * 0.73);
    H.push({ a: x - w / 2, b: x + w / 2, y: A.windowBottom, top: A.windowTop });
    if (d > 1 && j % 2 === 0)
      H.push({ a: x - w * 0.24, b: x + w * 0.24, y: F + 1.2, top: F + 2.7 });
  }
  return H;
}
function body(o, d) {
  for (const f of faces(outer)) {
    const H = openings(f, d);
    wall(o, f, A.baseY, A.bodyTop, d > 1 ? H : []);
    for (const h of H) pane(o, f, h, d);
    if (d > 0) {
      strip(o, 'trim', f, 0, f.w, F - 0.18, F + 0.04, -0.08, 0.18);
      strip(o, 'trim', f, 0, f.w, A.bodyTop - 0.28, A.bodyTop, -0.08, 0.16);
      const count = Math.max(1, Math.round(f.w / 3.7));
      if (f.n[0] > -0.95)
        for (let j = 0; j <= count; j++) {
          const x = (f.w * j) / count;
          strip(o, 'trim', f, x - 0.16, x + 0.16, F, A.bodyTop, -0.05, 0.16);
        }
      if (d > 1) {
        for (const y of [1.5, 4.2]) patch(o, 'wall', f, 0, f.w, y, y + 0.035, 0.025);
      }
    }
  }
  flat(o, 'deck', outer, A.baseY, C.deck, true);
  const north = clip(outer, 1, A.naveNorthZ),
    south = clip(outer, 1, A.naveSouthZ, false),
    nave = clip(clip(outer, 1, A.naveNorthZ, false), 1, A.naveSouthZ);
  // Triangulate each non-convex transept domain: a centre fan would bridge its open recesses.
  for (const R of [north, south])
    roof(
      o,
      R,
      (x, z) => {
        const distance = Math.min(
          ...R.map((a, k) => {
            const b = R[(k + 1) % R.length],
              v = sub(b, a),
              len = v[0] * v[0] + v[1] * v[1],
              t = Math.max(0, Math.min(1, ((x - a[0]) * v[0] + (z - a[1]) * v[1]) / len));
            return Math.hypot(x - a[0] - t * v[0], z - a[1] - t * v[1]);
          }),
        );
        return A.bodyTop + Math.min(A.wingRoofRise, distance * 0.16);
      },
      [0, 1, 2, 3][d],
    );
  const subdivisions = [1, 2, 3, 4][d];
  roof(o, nave, roofY, subdivisions);
  for (const f of faces(nave)) {
    const segments = Math.pow(2, subdivisions);
    for (let j = 0; j < segments; j++)
      patch(o, 'wall', f, (f.w * j) / segments, (f.w * (j + 1)) / segments, A.bodyTop, (u) =>
        roofY(pt(f, u, 0)[0], pt(f, u, 0)[2]),
      );
    if (d > 1) {
      strip(o, 'trim', f, 0, f.w, A.bodyTop - 0.1, A.bodyTop + 0.06, -0.04, 0.14);
    }
  }
}
function cylinder(o, k, c, y, h, r, N, col = C[k]) {
  prism(
    o,
    k,
    Array.from({ length: N }, (_, i) => [
      c[0] + r * Math.cos((i * 2 * Math.PI) / N),
      c[1] + r * Math.sin((i * 2 * Math.PI) / N),
    ]),
    y,
    y + h,
    col,
  );
}
function dome(o, d) {
  const c = A.drumCenter,
    N = [8, 12, 20, 32][d],
    P = Array.from({ length: N }, (_, i) => [
      c[0] + A.drumRadius * Math.cos((i * 2 * Math.PI) / N),
      c[1] + A.drumRadius * Math.sin((i * 2 * Math.PI) / N),
    ]);
  for (const f of faces(P)) {
    const w = f.w * 0.4,
      h = { a: f.w / 2 - w / 2, b: f.w / 2 + w / 2, y: A.drumBase + 0.7, top: A.drumTop - 0.45 };
    wallDrum(o, f, h, d);
    if (d > 0) pane(o, f, h, d);
  }
  cylinder(o, 'trim', c, A.drumTop - 0.2, 0.27, A.drumRadius + 0.13, N);
  const K = [3, 5, 8, 12][d],
    rings = Array.from({ length: K + 1 }, (_, j) => {
      const t = ((Math.PI / 2) * j) / K,
        r = A.drumRadius * Math.cos(t),
        y = A.drumTop + A.domeRise * Math.sin(t);
      return Array.from({ length: N }, (_, i) => [
        c[0] + r * Math.cos((i * 2 * Math.PI) / N),
        y,
        c[1] + r * Math.sin((i * 2 * Math.PI) / N),
      ]);
    });
  for (let j = 0; j < K; j++)
    for (let i = 0; i < N; i++) {
      const n = [rings[j][i][0] - c[0], (rings[j][i][1] - A.drumTop) * 1.4, rings[j][i][2] - c[1]];
      Q(
        o,
        'metal',
        [rings[j][i], rings[j][(i + 1) % N], rings[j + 1][(i + 1) % N], rings[j + 1][i]],
        n,
        gold,
      );
    }
  if (d > 1)
    for (let i = 0; i < N; i += 2)
      for (let j = 0; j < K - 1; j++) beam(o, 'metal', rings[j][i], rings[j + 1][i], 0.022, d);
  box(o, 'trim', c[0], A.crossBase, c[1], 0.19, A.crossHeight, 0.19);
  box(o, 'trim', c[0] - 0.65, A.crossBase + 1.28, c[1], 1.3, 0.18, 0.18);
}
function wallDrum(o, f, h, d) {
  const y0 = A.drumBase,
    y1 = A.drumTop;
  if (d < 2) {
    patch(o, 'wall', f, 0, f.w, y0, y1);
    return;
  }
  wallDrumPatch(o, f, h, y0, y1);
}
function wallDrumPatch(o, f, h, y0, y1) {
  patch(o, 'wall', f, 0, h.a, y0, y1);
  patch(o, 'wall', f, h.b, f.w, y0, y1);
  patch(o, 'wall', f, h.a, h.b, y0, h.y);
  patch(o, 'wall', f, h.a, h.b, h.top, y1);
}
function pathSections(P, w, Y) {
  return P.map((p, i) => {
    const a = P[Math.max(0, i - 1)],
      b = P[Math.min(P.length - 1, i + 1)],
      v = sub(b, a),
      L = Math.hypot(...v),
      n = [v[1] / L, -v[0] / L],
      y = Y(p, i);
    return {
      p,
      y,
      n,
      left: [p[0] + (n[0] * w) / 2, y, p[1] + (n[1] * w) / 2],
      right: [p[0] - (n[0] * w) / 2, y, p[1] - (n[1] * w) / 2],
    };
  });
}
function deck(o, P, w, Y, d, rail = true) {
  const R = pathSections(P, w, Y),
    h = A.rampSlab,
    below = (q) => [q[0], q[1] - h, q[2]];
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i],
      b = R[i + 1];
    Q(o, 'deck', [a.left, b.left, b.right, a.right], [0, 1, 0]);
    Q(o, 'deck', [below(a.left), below(a.right), below(b.right), below(b.left)], [0, -1, 0]);
    for (const side of ['left', 'right']) {
      const q = a[side],
        r = b[side],
        sg = side === 'left' ? 1 : -1;
      Q(o, 'wall', [q, below(q), below(r), r], [sg * a.n[0], 0, sg * a.n[1]]);
      if (d > 0) {
        const v = (q) => [q[0], q[1] - 0.1, q[2]];
        Q(o, 'trim', [q, r, v(r), v(q)], [sg * a.n[0], 0, sg * a.n[1]]);
      }
      if (rail && d > 0)
        for (const dy of [A.railingHeight, ...(d > 1 ? [0.5] : [])])
          beam(
            o,
            'metal',
            [q[0], q[1] + dy, q[2]],
            [r[0], r[1] + dy, r[2]],
            d === 3 ? 0.035 : 0.045,
            d,
          );
    }
  }
  for (const [end, sg] of [
    [R[0], -1],
    [R.at(-1), 1],
  ])
    Q(
      o,
      'wall',
      [end.left, end.right, below(end.right), below(end.left)],
      [sg * (R[1].p[0] - R[0].p[0]), 0, sg * (R[1].p[1] - R[0].p[1])],
    );
  if (rail && d > 1)
    for (let i = 0; i < R.length - 1; i++) {
      const a = R[i],
        b = R[i + 1],
        L = Math.hypot(...sub(b.p, a.p)),
        count = Math.ceil(L / (d === 3 ? 3 : 6));
      for (let j = 1; j < count; j++)
        for (const side of ['left', 'right']) {
          const t = j / count,
            q = a[side].map((v, k) => v + (b[side][k] - v) * t);
          beam(o, 'metal', q, [q[0], q[1] + A.railingHeight, q[2]], 0.03, d);
        }
    }
  if (rail && d > 0) {
    for (let i = 0; i < R.length; i++) {
      const a = R[i];
      if (d === 1 && i % 2 && i !== R.length - 1) continue;
      for (const side of ['left', 'right']) {
        const q = a[side];
        beam(o, 'metal', q, [q[0], q[1] + A.railingHeight, q[2]], 0.035, d);
      }
    }
  }
  return R;
}
function flaredPier(o, a, d) {
  if (a.y < 1) return;
  const n = a.n,
    center = a.p,
    profiles =
      d < 2
        ? [
            [2.2, 0.1],
            [0.5, a.y * 0.5],
            [2.5, a.y - A.rampSlab],
          ]
        : [
            [2.4, 0.05],
            [1.5, 0.8],
            [0.48, a.y * 0.48],
            [0.75, a.y * 0.72],
            [2.8, a.y - A.rampSlab],
          ],
    R = profiles.map(([w, y]) => {
      const u = [-n[1], n[0]];
      return [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([side, end]) => [
        center[0] + (side * n[0] * w) / 2 + end * u[0] * 0.38,
        y,
        center[1] + (side * n[1] * w) / 2 + end * u[1] * 0.38,
      ]);
    });
  for (let j = 0; j < R.length - 1; j++)
    for (let k = 0; k < 4; k++) {
      const kk = (k + 1) % 4,
        n = [R[j][k][0] - center[0], 0, R[j][k][2] - center[1]];
      Q(o, 'deck', [R[j][k], R[j][kk], R[j + 1][kk], R[j + 1][k]], n);
    }
  flat(
    o,
    'deck',
    R[0].map((q) => [q[0], q[2]]),
    profiles[0][1],
    C.deck,
    true,
  );
  flat(
    o,
    'deck',
    R.at(-1).map((q) => [q[0], q[2]]),
    profiles.at(-1)[1],
  );
}
function stairs(o, P, width, highAtEnd, d) {
  const D = [0];
  for (let i = 1; i < P.length; i++) D.push(D.at(-1) + Math.hypot(...sub(P[i], P[i - 1])));
  const total = D.at(-1),
    Y = (_q, i) => 0.12 + (F - 0.12) * (highAtEnd ? D[i] / total : 1 - D[i] / total);
  deck(o, P, width, Y, d, false);
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i],
      b = P[i + 1],
      v = sub(b, a),
      L = Math.hypot(...v),
      u = v.map((x) => x / L),
      n = [u[1], -u[0]],
      count = Math.max(2, Math.round(L / [9, 3.6, 0.65, 0.5][d])),
      y0 = Y(a, i),
      y1 = Y(b, i + 1);
    for (let j = 0; j < count; j++) {
      const t0 = j / count,
        t1 = (j + 1) / count,
        y = y0 + (y1 - y0) * (highAtEnd ? t1 : t0),
        a0 = a.map((x, k) => x + v[k] * t0),
        b0 = a.map((x, k) => x + v[k] * t1),
        q = (p, y, sg) => [p[0] + (sg * n[0] * width) / 2, y, p[1] + (sg * n[1] * width) / 2];
      Q(o, 'deck', [q(a0, y, 1), q(b0, y, 1), q(b0, y, -1), q(a0, y, -1)], [0, 1, 0]);
      const prev = y0 + (y1 - y0) * (highAtEnd ? t0 : t1),
        p = highAtEnd ? a0 : b0;
      Q(
        o,
        'wall',
        [q(p, prev, 1), q(p, prev, -1), q(p, y, -1), q(p, y, 1)],
        [highAtEnd ? -u[0] : u[0], 0, highAtEnd ? -u[1] : u[1]],
      );
    }
    if (d > 0)
      for (const sg of [-1, 1]) {
        const q = (p) => [
          p[0] + sg * n[0] * (width / 2 - 0.08),
          0,
          p[1] + sg * n[1] * (width / 2 - 0.08),
        ];
        const aa = q(a),
          bb = q(b);
        beam(o, 'metal', [aa[0], y0 + 1.0, aa[2]], [bb[0], y1 + 1.0, bb[2]], 0.04, d);
        for (let j = 0; j <= (d > 1 ? 4 : 1); j++) {
          const t = j / (d > 1 ? 4 : 1),
            x = aa[0] + (bb[0] - aa[0]) * t,
            z = aa[2] + (bb[2] - aa[2]) * t,
            y = y0 + (y1 - y0) * t;
          beam(o, 'metal', [x, y, z], [x, y + 1, z], 0.03, d);
        }
      }
  }
  const top = highAtEnd ? P.at(-1) : P[0];
  box(o, 'deck', top[0], F - 0.34, top[1], width, 0.34, width);
  return top;
}
function access(o, d) {
  const R = deck(o, ramp, A.rampWidth, (q) => rampY(q[0]), d);
  let distance = 0,
    next = [40, 26, 16, 13][d];
  for (let i = 0; i < R.length - 1; i++) {
    const a = R[i],
      b = R[i + 1],
      L = Math.hypot(...sub(b.p, a.p));
    while (next <= distance + L) {
      const t = (next - distance) / L,
        p = a.p.map((v, k) => v + (b.p[k] - v) * t),
        v = sub(b.p, a.p),
        n = [v[1] / L, -v[0] / L];
      flaredPier(o, { p, n, y: rampY(p[0]) }, d);
      next += [40, 26, 16, 13][d];
    }
    distance += L;
  }
  const connector = p.features.find((f) => f.id === 'way/998582092').outline.map(local);
  deck(o, connector, 2.8, () => F, d, true);
  for (const f of p.features.filter((f) => /stair/.test(f.role))) {
    const P = f.outline.map(local),
      main = ['way/706063599', 'way/998582085'].includes(f.id),
      end = f.id === 'way/998582085' || f.id === 'way/708237483',
      top = stairs(o, P, main ? A.mainStairWidth : A.flankingStairWidth, end, d);
    if (!main) {
      let closest = null,
        dist = Infinity;
      for (const face of faces(outer)) {
        const v = sub(top, face.a),
          t = Math.max(0, Math.min(face.w, v[0] * face.u[0] + v[1] * face.u[1])),
          q = [face.a[0] + face.u[0] * t, face.a[1] + face.u[1] * t],
          l = Math.hypot(...sub(q, top));
        if (l < dist) {
          dist = l;
          closest = q;
        }
      }
      deck(o, [top, closest], A.flankingStairWidth, () => F, d, true);
    }
  }
}
function build(o, _f, d = 3) {
  body(o, d);
  dome(o, d);
  access(o, d);
}
export const eternalFatherSkyline = (o, f) => build(o, f, 0),
  eternalFatherDistrict = (o, f) => build(o, f, 1),
  eternalFatherStreet = (o, f) => build(o, f, 2),
  eternalFatherCloseup = (o, f) => build(o, f, 3);
const camera = (name, pos, look) => ({ name, position: world(pos), lookAt: world(look) });
export const eternalFatherTrindadeModel = {
  id: 'basilica_of_the_eternal_father_trindade',
  key: 'basilica_of_the_eternal_father_trindade',
  cell: '6v/6vh',
  recipe: 'structure-basilica-eternal-father-trindade.mjs',
  title: 'Basilica of the Eternal Father, Trindade',
  category: 'landmark',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: world([-190, 105, 150]),
  lookAt: world([-48, 10, 0]),
  portableGroundY: -0.23,
  mediumFiContext: { scale: 1.25, groundY: -0.2 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    camera(
      'whole-cruciform-basilica-dome-and-full-native-branching-ramp',
      [-190, 105, 150],
      [-48, 10, 0],
    ),
    camera(
      'opposite-whole-basilica-transepts-and-branching-entrance',
      [-150, 95, -165],
      [-45, 10, 0],
    ),
    camera('front-barrel-end-five-upper-panes-and-raised-entrance', [-95, 21, 16], [-31, 13, 0]),
    camera('gilded-dome-drum-cross-and-whole-rear-cross-wings', [70, 48, 65], [10, 16, 0]),
    camera('long-elevated-approach-railing-and-open-undersides', [-114, 10, 65], [-65, 5, 25]),
    camera('flared-concrete-piers-and-visible-ramp-soffit', [-71, 2, 51], [-58, 4, 38]),
    camera('paired-native-main-stairs-and-short-door-connector', [-94, 13, 22], [-55, 5, 0]),
    camera('upper-glazing-pier-bays-and-shallow-barrel-roof', [-46, 23, -38], [-18, 15, -11]),
    camera('whole-native-cruciform-and-access-centerline-footprints', [-45, 180, 8], [-45, 7, 0]),
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-basilica-eternal-father-trindade.mjs',
    level: 'skyline',
    export: 'eternalFatherSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'eternalFatherDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'eternalFatherStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'eternalFatherCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole named surviving1974/1994 basilica/Q10368270 uses actual13-corner cruciform bodyway131382347 plus complete26-control branching elevated west ramp486368471, short entry bridge998582092 and all four bounded mapped stair centerlines with original short side landing links. Nave shallow barrel/vertical upper window-pier bays/transept roofs/gilded central dome-drum/cross and concrete approach with real undersides/open flared pier supports/rails; no facade-only or plain cross box.',
    'Exact3216x2280 AdelanoLazaro2010 Own/PD-self published Qualla exterior individually inspected/nativeSHA1matched. Unrelated duplicate attribution-only path/interiors/ambiguous creator exterior/uncertain unknown-author historical photographs excluded without pixels/metadata repair. Abstract muted glazing only, no copied religious pictorial artwork. No supplemental imagery/borrowed mesh/generated bitmap/photo texture/policy-verifier changes.',
    'All dimensions/roof/rear facade sections/dome placement-opening census/access widths/independent grades/piers/rail census/short side landing links are original bounded medium-fi estimates from one west-approach photo and current whole native outline/centerlines; current hidden finishes/private interior/structural survey/as-built stair thresholds unverified. Native arch shallow roof/gilded dome/cross and full entrance system retained at all four detail levels.',
    'Original400m/129x129/16641-value independent field/one raw tile/PNG frozen before geometry/floor/architectural sections unchanged. Main floor+6.2/outer ramp+.18 independent; urban field artifacts/grade disagree with foundations/thresholds/pier footings. Isolated/shared-flat appearance with separate unchanged source-field evidence; exact source/host contact unresolved/replacementfalse. No source flattening/fitting/reacquisition/full-plaza pad, separate old sanctuary/new temple/kiosks/city/trees/people/cars/text/interior sacred sculptures.',
  ],
};

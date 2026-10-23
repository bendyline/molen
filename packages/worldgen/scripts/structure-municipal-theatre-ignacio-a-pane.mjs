/** Whole mapped Asunción theatre, historic arched front and steel-glazed canopy. Original medium-fi exterior. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/6e/6ex/municipal_theatre_ignacio_a_pane/',
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
    wall: rgb('cfa598'),
    trim: rgb('dfb9a7'),
    roof: rgb('977e69'),
    metal: rgb('34464a'),
    glass: rgb('8bafb7'),
    wood: rgb('967749'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'stucco', roughness: 0.95, metallic: 0 },
    trim: { slot: 'trim', graph: 'stucco', roughness: 0.94, metallic: 0 },
    roof: { slot: 'roof', graph: 'clay_fired', roughness: 0.96, metallic: 0 },
    metal: { slot: 'trim', graph: 'metal_painted', roughness: 0.75, metallic: 0.35 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.4, metallic: 0.14 },
    wood: { slot: 'door', graph: 'wood_plain', roughness: 0.92, metallic: 0 },
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
    N = d === 3 ? 6 : d === 0 ? 3 : 4;
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
function roof(o, P, Y, detail) {
  const idx = earcut(P.flat()),
    mid = (a, b) => a.map((x, k) => (x + b[k]) / 2);
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
  for (let i = 0; i < idx.length; i += 3)
    divide(
      idx.slice(i, i + 3).map((j) => P[j]),
      detail,
    );
}
function distance(q, P) {
  return Math.min(
    ...P.map((a, k) => {
      const b = P[(k + 1) % P.length],
        v = sub(b, a),
        L = v[0] * v[0] + v[1] * v[1],
        t = Math.max(0, Math.min(1, ((q[0] - a[0]) * v[0] + (q[1] - a[1]) * v[1]) / L));
      return Math.hypot(q[0] - a[0] - t * v[0], q[1] - a[1] - t * v[1]);
    }),
  );
}
const central = (() => {
  const aa = outer[15],
    bb = outer[16],
    v = sub(bb, aa),
    w = Math.hypot(...v),
    u = v.map((x) => x / w);
  let n = [u[1], 0, -u[0]];
  if (n[2] > 0) {
    n = n.map((x) => -x);
    return { a: bb, b: aa, w, u: u.map((x) => -x), n };
  }
  return { a: aa, b: bb, w, u, n };
})();
function wall(o, f, holes, d) {
  const X = [0, f.w];
  for (const h of holes) {
    X.push(h.a, h.b);
    for (let j = 1; j < [3, 5, 8, 12][d]; j++) X.push(h.a + ((h.b - h.a) * j) / [3, 5, 8, 12][d]);
  }
  const xs = [...new Set(X)].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i],
      b = xs[i + 1],
      m = (a + b) / 2,
      H = holes.filter((h) => m > h.a - 1e-6 && m < h.b + 1e-6).sort((a, b) => a.y - b.y);
    let y = A.baseY;
    for (const h of H) {
      patch(o, 'wall', f, a, b, y, h.y);
      y = h.top;
    }
    patch(o, 'wall', f, a, b, y, A.bodyTop);
  }
}
function archedWindow(o, f, h, d) {
  const N = [3, 5, 8, 12][d],
    points = Array.from({ length: N + 1 }, (_, j) => {
      const x = h.a + ((h.b - h.a) * j) / N;
      return [x, h.top(x)];
    }),
    depth = -A.reveal;
  for (let i = 0; i < N; i++) {
    const [x, y] = points[i],
      [u, v] = points[i + 1];
    patch(
      o,
      h.door ? 'wood' : 'glass',
      f,
      x,
      u,
      h.y,
      (t) => y + ((v - y) * (t - x)) / (u - x),
      depth,
    );
    Q(o, 'trim', [pt(f, x, y), pt(f, u, v), pt(f, u, v, depth), pt(f, x, y, depth)], [0, -1, 0]);
    if (d > 0) {
      Q(
        o,
        'trim',
        [pt(f, x, y, 0.06), pt(f, u, v, 0.06), pt(f, u, v + 0.16, 0.08), pt(f, x, y + 0.16, 0.08)],
        f.n,
      );
    }
  }
  for (const [x, sgn] of [
    [h.a, 1],
    [h.b, -1],
  ]) {
    Q(
      o,
      'trim',
      [pt(f, x, h.y), pt(f, x, h.top(x)), pt(f, x, h.top(x), depth), pt(f, x, h.y, depth)],
      [sgn * f.u[0], 0, sgn * f.u[1]],
    );
    if (d > 0) patch(o, 'wood', f, x - 0.045, x + 0.045, h.y, h.spring, depth + 0.04);
  }
  Q(
    o,
    'trim',
    [pt(f, h.a, h.y), pt(f, h.a, h.y, depth), pt(f, h.b, h.y, depth), pt(f, h.b, h.y)],
    [0, 1, 0],
  );
  if (d === 0) return;
  const cx = (h.a + h.b) / 2;
  patch(o, 'wood', f, h.a, h.b, h.spring - 0.045, h.spring + 0.045, depth + 0.07);
  patch(o, 'wood', f, cx - 0.035, cx + 0.035, h.y, h.spring, depth + 0.07);
  const transoms = h.door ? 2 : d === 1 ? 1 : 4;
  for (let i = 1; i <= transoms; i++) {
    const y = h.y + ((h.spring - h.y) * i) / (transoms + 1);
    patch(o, 'wood', f, h.a, h.b, y - 0.028, y + 0.028, depth + 0.07);
  }
  if (d > 1) {
    for (let j = 1; j < (d === 3 ? 6 : 4); j++) {
      const t = (Math.PI * j) / (d === 3 ? 6 : 4),
        a = pt(f, cx, h.spring, depth + 0.08),
        b = pt(
          f,
          cx + ((h.b - h.a) / 2) * Math.cos(t),
          h.spring + h.rise * Math.sin(t),
          depth + 0.08,
        );
      beam(o, 'wood', a, b, 0.022, d);
    }
    strip(o, 'trim', f, h.a - 0.13, h.b + 0.13, h.y - 0.13, h.y - 0.02, -0.1, 0.13);
    if (h.guard) {
      for (const y of [h.y + 0.15, h.y + 0.9])
        beam(o, 'metal', pt(f, h.a - 0.08, y, 0.22), pt(f, h.b + 0.08, y, 0.22), 0.025, d);
      for (let j = 0; j <= (d === 3 ? 5 : 2); j++) {
        const x = h.a + ((h.b - h.a) * j) / (d === 3 ? 5 : 2);
        beam(o, 'metal', pt(f, x, h.y + 0.12, 0.22), pt(f, x, h.y + 0.94, 0.22), 0.019, d);
      }
    }
  }
}
function makeWindows(f, d) {
  const historic = (f.a[1] + f.b[1]) / 2 < -8,
    front = historic && f.n[2] < -0.75,
    side = historic && !front && f.w > 4;
  const ctr =
    Math.hypot(
      (f.a[0] + f.b[0]) / 2 - (central.a[0] + central.b[0]) / 2,
      (f.a[1] + f.b[1]) / 2 - (central.a[1] + central.b[1]) / 2,
    ) < 0.1;
  if (!front && !(d > 1 && side)) return [];
  if (d === 0 && !ctr) return [];
  const count = ctr ? 3 : Math.max(1, Math.round(f.w / (side ? 4.4 : 3.4))),
    H = [];
  for (let i = 0; i < count; i++) {
    const x = (f.w * (i + 0.5)) / count,
      w = Math.min(A.windowWidth, (f.w / count) * 0.6);
    for (const upper of [false, true]) {
      const y = upper ? A.upperSill : A.lowerSill,
        spring = upper ? A.upperSpring : A.lowerSpring,
        rise = upper ? A.upperRise : ctr ? 0.9 : A.lowerRise;
      H.push({
        a: x - w / 2,
        b: x + w / 2,
        y,
        spring,
        rise,
        door: !upper && ctr,
        guard: !ctr,
        top: (u) =>
          spring + rise * Math.sqrt(Math.max(0, 1 - ((u - x) / (w / 2)) * ((u - x) / (w / 2)))),
      });
    }
  }
  return H;
}
function pier(o, f, x, d, capital = false) {
  const a = x - 0.19,
    b = x + 0.19;
  strip(o, 'trim', f, a, b, 5.35, 10.0, -0.05, 0.18);
  strip(o, 'trim', f, x - 0.28, x + 0.28, 5.25, 5.45, -0.05, 0.25);
  strip(o, 'trim', f, x - 0.31, x + 0.31, 9.95, 10.17, -0.05, 0.25);
  if (capital && d > 1) {
    for (const sg of [-1, 1]) {
      const cx = x + sg * 0.2;
      let prev;
      for (let j = 0; j < 12; j++) {
        const t = (j / 11) * 1.8 * Math.PI,
          r = 0.13 * (1 - j / 15),
          q = pt(f, cx + r * Math.cos(t), 10.04 + r * Math.sin(t), 0.28);
        if (prev) beam(o, 'trim', prev, q, 0.026, d);
        prev = q;
      }
    }
  }
}
function balustrade(o, f, d) {
  const y = A.corniceTop;
  strip(o, 'trim', f, 0, f.w, y, y + 0.16, -0.1, 0.15);
  strip(o, 'trim', f, 0, f.w, A.parapetTop - 0.17, A.parapetTop, -0.1, 0.15);
  const count = Math.max(1, Math.floor(f.w / [100, 2.8, 1.3, 0.62][d]));
  for (let i = 0; i <= count; i++) {
    const x = (f.w * i) / count;
    if (d < 3)
      strip(o, 'trim', f, x - 0.055, x + 0.055, y + 0.16, A.parapetTop - 0.17, -0.03, 0.09);
    else {
      const a = pt(f, x, y + 0.16, 0.04);
      const levels = [
        [0.065, 0],
        [0.045, 0.1],
        [0.1, 0.29],
        [0.06, 0.45],
        [0.05, 0.55],
      ];
      const rings = levels.map(([r, dy]) =>
        Array.from({ length: 6 }, (_, k) => [
          a[0] + r * Math.cos((2 * Math.PI * k) / 6),
          a[1] + dy,
          a[2] + r * Math.sin((2 * Math.PI * k) / 6),
        ]),
      );
      for (let j = 0; j < rings.length - 1; j++)
        for (let k = 0; k < 6; k++)
          Q(
            o,
            'trim',
            [rings[j][k], rings[j][(k + 1) % 6], rings[j + 1][(k + 1) % 6], rings[j + 1][k]],
            [rings[j][k][0] - a[0], 0, rings[j][k][2] - a[2]],
          );
    }
  }
}
function pediment(o, d) {
  const f = central,
    N = [6, 10, 18, 28][d],
    top = (x) =>
      11.25 +
      1.65 * Math.sqrt(Math.max(0, 1 - ((x - f.w / 2) / (f.w / 2)) * ((x - f.w / 2) / (f.w / 2))));
  for (let i = 0; i < N; i++) {
    const a = (f.w * i) / N,
      b = (f.w * (i + 1)) / N;
    patch(o, 'wall', f, a, b, 10.65, top);
    Q(
      o,
      'wall',
      [
        pt(f, a, 10.65, -0.35),
        pt(f, b, 10.65, -0.35),
        pt(f, b, top(b), -0.35),
        pt(f, a, top(a), -0.35),
      ],
      f.n.map((v) => -v),
    );
    Q(
      o,
      'roof',
      [
        pt(f, a, top(a), -0.35),
        pt(f, b, top(b), -0.35),
        pt(f, b, top(b), 0.1),
        pt(f, a, top(a), 0.1),
      ],
      [0, 1, 0],
    );
    for (let j = 0; j < (d > 1 ? 3 : 1); j++)
      Q(
        o,
        'trim',
        [
          pt(f, a, top(a) - 0.1 - j * 0.12, 0.12 + j * 0.02),
          pt(f, b, top(b) - 0.1 - j * 0.12, 0.12 + j * 0.02),
          pt(f, b, top(b) - j * 0.12, 0.12 + j * 0.02),
          pt(f, a, top(a) - j * 0.12, 0.12 + j * 0.02),
        ],
        f.n,
      );
  }
  strip(o, 'trim', f, 0, f.w, 10.5, 10.7, -0.1, 0.24);
  const x = f.w / 2;
  strip(o, 'trim', f, x - 0.13, x + 0.13, 12.85, 13.38, -0.15, 0.12);
  if (d > 0) {
    for (const sg of [-1, 1]) {
      let prev;
      for (let j = 0; j < 8; j++) {
        const t = (j / 7) * Math.PI * 1.35,
          q = pt(f, x + sg * (0.18 + 0.16 * Math.cos(t)), 13.1 + 0.2 * Math.sin(t), 0.02);
        if (prev) beam(o, 'trim', prev, q, 0.06, d);
        prev = q;
      }
    }
  }
}
function canopy(o, d) {
  const f = central,
    L = A.canopyProjection,
    x0 = -A.canopyMargin,
    x1 = f.w + A.canopyMargin,
    Y = (t) => A.canopyWallY + ((A.canopyFrontY - A.canopyWallY) * t) / L,
    N = [2, 4, 7, 10][d],
    q = (x, t) => pt(f, x, Y(t), t);
  for (let i = 0; i < N; i++) {
    const a = x0 + ((x1 - x0) * i) / N,
      b = x0 + ((x1 - x0) * (i + 1)) / N;
    Q(o, 'glass', [q(a, 0), q(b, 0), q(b, L), q(a, L)], [0, 1, 0]);
    Q(
      o,
      'glass',
      [
        q(a, 0).map((v, k) => (k === 1 ? v - 0.055 : v)),
        q(a, L).map((v, k) => (k === 1 ? v - 0.055 : v)),
        q(b, L).map((v, k) => (k === 1 ? v - 0.055 : v)),
        q(b, 0).map((v, k) => (k === 1 ? v - 0.055 : v)),
      ],
      [0, -1, 0],
    );
  }
  const ribs = [0, 1, 2].map((i) => x0 + ((x1 - x0) * i) / 2);
  for (const x of ribs) {
    beam(o, 'metal', q(x, 0), q(x, L), d > 1 ? 0.065 : 0.09, d);
    const a = q(x, 0),
      b = q(x, L);
    beam(o, 'metal', [a[0], a[1] - 0.65, a[2]], [b[0], b[1] - 0.65, b[2]], 0.055, d);
    const pieces = d > 0 ? 4 : 2;
    for (let j = 0; j <= pieces; j++) {
      const t = (L * j) / pieces,
        v = q(x, t);
      beam(o, 'metal', v, [v[0], v[1] - 0.65, v[2]], 0.035, d);
      if (j < pieces) {
        const b = q(x, (L * (j + 1)) / pieces);
        beam(
          o,
          'metal',
          j % 2 ? v : [v[0], v[1] - 0.65, v[2]],
          j % 2 ? [b[0], b[1] - 0.65, b[2]] : b,
          0.035,
          d,
        );
      }
    }
    if (d > 1) {
      let prev;
      for (let i = 0; i <= 9; i++) {
        const t = (i / 9) * 2.4,
          v = pt(f, x, A.canopyWallY - 1.8 + 1.1 * Math.sqrt(t / 2.4), t);
        if (prev) beam(o, 'metal', prev, v, 0.04, d);
        prev = v;
      }
      beam(o, 'metal', pt(f, x, A.canopyWallY - 1.8, 0), q(x, 0), 0.045, d);
    }
  }
  for (let j = 0; j <= N; j++) {
    const t = (L * j) / N;
    beam(o, 'metal', q(x0, t), q(x1, t), 0.05, d);
  }
  if (d > 0) {
    for (let j = 0; j < 2; j++)
      beam(o, 'metal', q(x0, (j * L) / 2), q(x1, ((j + 1) * L) / 2), 0.03, d);
  }
}
function build(o, _f, d = 3) {
  const P = outer,
    front = clip(P, 1, A.hallStartZ),
    hall = clip(clip(P, 1, A.hallStartZ, false), 1, A.hallEndZ),
    stage = clip(P, 1, A.hallEndZ, false);
  for (const f of faces(P)) {
    const H = makeWindows(f, d);
    wall(o, f, H, d);
    for (const h of H) archedWindow(o, f, h, d);
    const historic = (f.a[1] + f.b[1]) / 2 < -8;
    if (historic && (d > 0 || f.n[2] < -0.75)) {
      strip(o, 'trim', f, 0, f.w, 5.05, 5.24, -0.1, 0.18);
      strip(o, 'trim', f, 0, f.w, 10.6, A.corniceTop, -0.12, 0.24);
      if (d > 1)
        for (const y of [10.38, 10.6, 11.1]) strip(o, 'trim', f, 0, f.w, y, y + 0.1, -0.1, 0.29);
      const centralFace = Math.abs(f.w - central.w) < 0.01 && f.n[2] < -0.75;
      if (d > 0 && f.n[2] < -0.75) {
        for (let i = 0; i <= (centralFace ? 3 : Math.round(f.w / 3.4)); i++)
          pier(
            o,
            f,
            (f.w * i) / (centralFace ? 3 : Math.max(1, Math.round(f.w / 3.4))),
            d,
            centralFace,
          );
      }
      if (!centralFace && f.w > 2 && (d > 0 || f.n[2] < -0.75)) balustrade(o, f, d);
      if (d > 1 && f.n[2] < -0.75)
        for (let y = 0.7; y < 4.8; y += 0.75) patch(o, 'trim', f, 0, f.w, y, y + 0.025, 0.025);
    }
  }
  flat(o, 'wall', P, A.baseY, C.wall, true);
  roof(
    o,
    front,
    (x, z) => A.frontRoofEaves + Math.min(A.frontRoofRise, distance([x, z], front) * 0.25),
    Math.max(0, d - 1),
  );
  for (const [R, eaves, Y] of [
    [
      hall,
      A.hallEaves,
      (x) =>
        A.hallEaves +
        A.hallRoofRise * Math.sin(Math.PI * Math.max(0, Math.min(1, (x + 17.4) / 36))),
    ],
    [
      stage,
      A.stageEaves,
      (x) => A.stageEaves + A.stageRoofRise * (1 - Math.min(1, Math.abs((x + 2.5) / 15))),
    ],
  ]) {
    // Match boundary tessellation to the roof, closing the curved/gabled end-wall profile.
    for (const f of faces(R)) {
      const segments = Math.pow(2, d);
      for (let j = 0; j < segments; j++)
        patch(o, 'wall', f, (f.w * j) / segments, (f.w * (j + 1)) / segments, A.bodyTop, (u) =>
          Y(pt(f, u, 0)[0], pt(f, u, 0)[2]),
        );
    }
    roof(o, R, Y, [0, 1, 2, 3][d]);
    if (d > 1)
      for (const f of faces(R)) {
        strip(o, 'trim', f, 0, f.w, eaves - 0.15, eaves + 0.03, -0.1, 0.12);
      }
  }
  pediment(o, d);
  canopy(o, d);
}
export const paneSkyline = (o, f) => build(o, f, 0),
  paneDistrict = (o, f) => build(o, f, 1),
  paneStreet = (o, f) => build(o, f, 2),
  paneCloseup = (o, f) => build(o, f, 3);
const camera = (name, pos, look) => ({ name, position: world(pos), lookAt: world(look) });
export const municipalTheatrePaneModel = {
  id: 'municipal_theatre_ignacio_a_pane',
  key: 'municipal_theatre_ignacio_a_pane',
  cell: '6e/6ex',
  recipe: 'structure-municipal-theatre-ignacio-a-pane.mjs',
  title: 'Municipal Theatre Ignacio A. Pane',
  category: 'landmark',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: world([72, 55, -88]),
  lookAt: world([0, 7, 0]),
  portableGroundY: -0.22,
  mediumFiContext: { scale: 1.2, groundY: -0.2 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: p.sectionBasis,
  qaCameras: [
    camera('whole-historic-front-canopy-and-full-theatre-hall', [72, 55, -88], [0, 7, 0]),
    camera('opposite-whole-auditorium-and-rear-stage', [-65, 40, 75], [0, 8, 0]),
    camera('pink-arched-front-and-recessed-central-pediment', [3, 13, -66], [1, 7, -22]),
    camera('left-historic-wing-and-included-sala-baudilio-alio', [44, 16, -37], [13, 6, -20]),
    camera('right-historic-wing-and-native-side-envelope', [-47, 18, -35], [-13, 7, -12]),
    camera('canopy-glazing-steel-diagonals-and-visible-underside', [0, 2.2, -34], [0, 5.4, -22]),
    camera('arched-timber-fanlights-and-pilaster-capitals', [7, 8, -34], [1, 8, -18]),
    camera('pierced-parapet-and-curved-central-pediment', [17, 20, -39], [4, 11, -22]),
    camera('whole-native-envelope-roof-partitions-and-front-recess', [5, 76, 15], [0, 7, 0]),
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-municipal-theatre-ignacio-a-pane.mjs',
    level: 'skyline',
    export: 'paneSkyline',
    errorMeters: 1.4,
    surfaces,
    authoredLevels: {
      district: { export: 'paneDistrict', errorMeters: 0.65, surfaces },
      street: { export: 'paneStreet', errorMeters: 0.15, surfaces },
      closeup: { export: 'paneCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    'Whole named17-corner theatre envelopeway277951940/Q9082167 includes intrinsic auditorium/stage/service body and SalaBaudilioAlio identity position; pink historic two-storey front/wings/real arched window reveals/wood fanlights/lower doors/guards, curved central pediment/pilaster-capital scrolls/pierced parapets and projecting closed-glazed steel-truss canopy with actual underside/braces. No facade-only panel or separate neighboring theatre.',
    'Qualla-first exact sole local candidate was indoor ballet and excluded without pixels. One2048x1360 PattyP own/PD-self exact native exterior original individually inspected/SHA1matched; preserved native grant. No questionable sources, borrowed meshes/photo textures/generated bitmaps or policy/verifier changes.',
    'Photograph is undated/cropped. Heights, opening/rail census, original capital/crest ornament and especially hidden whole auditorium/barrel/rear-stage roof partition/sections/materials are bounded original medium-fi estimates from photo/native perimeter, not surveyed construction/private interior. Native whole-building4levels does not impose four repeated historic facade storeys.',
    'Original200m/129x129/16641-value independent source field/two raw tiles/PNG frozen before geometry/architectural sections unchanged. Floor+.06 independent; urban source artifacts/grade disagree with foundations/thresholds. Isolated/shared-flat appearance accepted only after current views plus separate unchanged original-field image; precise source/host terrain contact unverified/replacementfalse. No source flattening/fitting/reacquisition/full street or city pad, offices/cables/trees/people/performance rooms/text.',
  ],
};

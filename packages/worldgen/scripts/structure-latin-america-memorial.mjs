/** Whole Niemeyer memorial ensemble in its native compound frame. Original medium-fi exteriors. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/6g/6gy/latin_america_memorial/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters.architecturalSections,
  F = A.floorY,
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('d4d5cb'),
    trim: rgb('e4e5dc'),
    roof: rgb('c7cbc4'),
    glass: rgb('283e3d'),
    iron: rgb('3e4846'),
    red: rgb('b53a2d'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'concrete_plain', roughness: 0.94, metallic: 0 },
    trim: { slot: 'trim', graph: 'concrete_plain', roughness: 0.93, metallic: 0 },
    roof: { slot: 'roof', graph: 'concrete_plain', roughness: 0.96, metallic: 0 },
    glass: { slot: 'window', localRef: 'palette:#fffffe', roughness: 0.3, metallic: 0.22 },
    iron: { slot: 'foundation', graph: 'metal_painted', roughness: 0.82, metallic: 0.45 },
    red: { slot: 'door', localRef: 'palette:#fffffd', roughness: 0.78, metallic: 0.2 },
  },
  sub = (a, b) => a.map((v, k) => v - b[k]),
  ring = (P) =>
    Math.hypot(P[0][0] - P.at(-1)[0], P[0][1] - P.at(-1)[1]) < 1e-6 ? P.slice(0, -1) : P,
  feature = (id) => p.features.find((f) => f.id === id),
  plan = (id) => ring(feature(id).outline);
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(sub(q[1], q[0]), sub(q[2], q[0]));
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.65 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.65 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function area(P) {
  return P.reduce(
    (n, v, i) => n + v[0] * P[(i + 1) % P.length][1] - P[(i + 1) % P.length][0] * v[1],
    0,
  );
}
function faces(P) {
  P = ring(P);
  if (area(P) < 0) P = P.toReversed();
  return P.map((a, i) => {
    const b = P[(i + 1) % P.length],
      x = b[0] - a[0],
      z = b[1] - a[1],
      w = Math.hypot(x, z);
    return { a, b, w, n: [z / w, 0, -x / w], u: [x / w, z / w] };
  }).filter((f) => f.w > 0.004);
}
function small(P, d) {
  P = ring(P).map((v) => [...v]);
  const tol = [3.5, 0.75, 0.12, 0][d];
  if (!tol) return P;
  const dist = (q, a, b) => {
      const v = sub(b, a),
        t = Math.max(
          0,
          Math.min(1, ((q[0] - a[0]) * v[0] + (q[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1])),
        );
      return Math.hypot(q[0] - a[0] - v[0] * t, q[1] - a[1] - v[1] * t);
    },
    rdp = (P) => {
      if (P.length <= 2) return P;
      let k = 0,
        max = 0;
      for (let i = 1; i < P.length - 1; i++) {
        const v = dist(P[i], P[0], P.at(-1));
        if (v > max) {
          max = v;
          k = i;
        }
      }
      return max > tol
        ? [...rdp(P.slice(0, k + 1)).slice(0, -1), ...rdp(P.slice(k))]
        : [P[0], P.at(-1)];
    };
  let k = 1;
  for (let i = 2; i < P.length; i++)
    if (Math.hypot(...sub(P[i], P[0])) > Math.hypot(...sub(P[k], P[0]))) k = i;
  return [...rdp(P.slice(0, k + 1)).slice(0, -1), ...rdp([...P.slice(k), P[0]]).slice(0, -1)];
}
function clip(P, k, b, above) {
  const out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i],
      q = P[(i + 1) % P.length],
      fa = (a[k] - b) * (above ? 1 : -1),
      fb = (q[k] - b) * (above ? 1 : -1);
    if (fa >= -1e-7) out.push(a);
    if (fa < 0 !== fb < 0) {
      const t = fa / (fa - fb);
      out.push(a.map((v, j) => v + t * (q[j] - v)));
    }
  }
  return out;
}
function flat(o, s, P, y, col = C[s], down = false) {
  P = ring(P);
  if (P.length < 3) return;
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3)
    T(
      o,
      s,
      ids.slice(i, i + 3).map((k) => [P[k][0], typeof y === 'function' ? y(...P[k]) : y, P[k][1]]),
      [0, down ? -1 : 1, 0],
      col,
    );
}
function prism(o, s, P, y, top, col = C[s]) {
  P = ring(P);
  for (const f of faces(P))
    Q(
      o,
      s,
      [
        [f.a[0], y, f.a[1]],
        [f.b[0], y, f.b[1]],
        [f.b[0], top, f.b[1]],
        [f.a[0], top, f.a[1]],
      ],
      f.n,
      col,
    );
  flat(o, s, P, top, col);
}
const rectangle = (x0, x1, z0, z1) => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  prism(o, s, rectangle(x - w / 2, x + w / 2, z - l / 2, z + l / 2), y, y + h, col);
}
function beam(o, s, a, b, w, h) {
  const v = sub(b, a),
    L = Math.hypot(...v),
    W = v.map((x) => x / L),
    q = cross(W, Math.abs(W[1]) > 0.95 ? [1, 0, 0] : [0, 1, 0]),
    V = q.map((x) => x / Math.hypot(...q)),
    U = cross(W, V),
    ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => p.map((x, k) => x + (i * V[k] * w) / 2 + (j * U[k] * h) / 2)),
    aa = ring(a),
    bb = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [aa[i], aa[j], bb[j], bb[i]], null);
  }
  Q(
    o,
    s,
    aa.toReversed(),
    W.map((x) => -x),
  );
  Q(o, s, bb, W);
}
function frame(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    u = [dx / L, dz / L],
    v = [-u[1], u[0]],
    center = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  return {
    L,
    u,
    v,
    center,
    world: (x, z) => [center[0] + x * u[0] + z * v[0], center[1] + x * u[1] + z * v[1]],
    local: (q) => [
      (q[0] - center[0]) * u[0] + (q[1] - center[1]) * u[1],
      (q[0] - center[0]) * v[0] + (q[1] - center[1]) * v[1],
    ],
  };
}
function localFrame(P, heading) {
  P = ring(P);
  const c = Math.cos(heading),
    s = Math.sin(heading),
    center = [
      (Math.min(...P.map((v) => v[0])) + Math.max(...P.map((v) => v[0]))) / 2,
      (Math.min(...P.map((v) => v[1])) + Math.max(...P.map((v) => v[1]))) / 2,
    ];
  return frame([center[0] - c, center[1] + s], [center[0] + c, center[1] - s]);
}
function proxy(o, f) {
  return {
    addTriangle(s, _r, q, n, _uv, col) {
      const ps = q.map((v) => {
        const w = f.world(v[0], v[2]);
        return [w[0], v[1], w[1]];
      });
      T(o, s, ps, [f.u[0] * n[0] + f.v[0] * n[2], n[1], f.u[1] * n[0] + f.v[1] * n[2]], col);
    },
  };
}
function roofField(o, P, Y, d, axis = 1) {
  const lo = Math.min(...P.map((v) => v[axis])),
    hi = Math.max(...P.map((v) => v[axis])),
    N = [5, 12, 28, 56][d];
  for (let i = 0; i < N; i++) {
    const a = lo + ((hi - lo) * i) / N,
      b = lo + ((hi - lo) * (i + 1)) / N,
      R = clip(clip(P, axis, a, true), axis, b, false);
    if (R.length < 3) continue;
    flat(o, 'wall', R, Y);
    if (d > 0) flat(o, 'roof', R, (x, z) => Y(x, z) - 0.28, C.roof, true);
  }
  if (d === 0) return;
  for (const f of faces(P)) {
    const cuts = [0, 1];
    for (let i = 1; i < N; i++) {
      const edge = f.b[axis] - f.a[axis];
      if (Math.abs(edge) < 1e-8) continue;
      const t = (lo + ((hi - lo) * i) / N - f.a[axis]) / edge;
      if (t > 0 && t < 1) cuts.push(t);
    }
    cuts.sort((a, b) => a - b);
    for (let k = 0; k < cuts.length - 1; k++) {
      const a = f.a.map((v, j) => v + (f.b[j] - v) * cuts[k]);
      const b = f.a.map((v, j) => v + (f.b[j] - v) * cuts[k + 1]);
      const ya = Y(...a),
        yb = Y(...b);
      Q(
        o,
        'roof',
        [
          [a[0], ya, a[1]],
          [b[0], yb, b[1]],
          [b[0], yb - 0.28, b[1]],
          [a[0], ya - 0.28, a[1]],
        ],
        f.n,
      );
    }
  }
}
function body(o, P, top, d, { bottom = F, glass = true, inset = 0, bands = 0 } = {}) {
  P = ring(P);
  if (inset) {
    const c = P.reduce((a, v) => [a[0] + v[0] / P.length, a[1] + v[1] / P.length], [0, 0]);
    P = P.map((v) => {
      const t = Math.max(0.4, 1 - inset / Math.hypot(v[0] - c[0], v[1] - c[1]));
      return [c[0] + (v[0] - c[0]) * t, c[1] + (v[1] - c[1]) * t];
    });
  }
  for (const f of faces(P)) {
    const ya = typeof top === 'function' ? top(...f.a) : top,
      yb = typeof top === 'function' ? top(...f.b) : top;
    const curveN = typeof top === 'function' ? Math.max(1, Math.ceil(f.w / [18, 8, 3, 1.4][d])) : 1;
    for (let j = 0; j < curveN; j++) {
      const a = [
          f.a[0] + ((f.b[0] - f.a[0]) * j) / curveN,
          f.a[1] + ((f.b[1] - f.a[1]) * j) / curveN,
        ],
        b = [
          f.a[0] + ((f.b[0] - f.a[0]) * (j + 1)) / curveN,
          f.a[1] + ((f.b[1] - f.a[1]) * (j + 1)) / curveN,
        ],
        h0 = typeof top === 'function' ? top(...a) : top,
        h1 = typeof top === 'function' ? top(...b) : top;
      Q(
        o,
        glass ? 'glass' : 'wall',
        [
          [a[0], bottom, a[1]],
          [b[0], bottom, b[1]],
          [b[0], h1, b[1]],
          [a[0], h0, a[1]],
        ],
        f.n,
      );
    }
    if (d > 1 && glass) {
      const N = Math.max(1, Math.floor(f.w / [0, 0, 6, 3][d]));
      for (let k = 0; k <= N; k++) {
        const t = k / N,
          x = f.a[0] + (f.b[0] - f.a[0]) * t,
          z = f.a[1] + (f.b[1] - f.a[1]) * t,
          h = (typeof top === 'function' ? top(x, z) : ya + (yb - ya) * t) - bottom;
        box(o, 'iron', x, bottom, z, 0.055, h, 0.055);
      }
    }
    if (bands && d > 0)
      for (let k = 1; k <= bands; k++) {
        const y = bottom + ((Math.min(ya, yb) - bottom) * k) / (bands + 1),
          w = 0.12;
        Q(
          o,
          'trim',
          [
            [f.a[0] + f.n[0] * 0.03, y, f.a[1] + f.n[2] * 0.03],
            [f.b[0] + f.n[0] * 0.03, y, f.b[1] + f.n[2] * 0.03],
            [f.b[0] + f.n[0] * 0.03, y + w, f.b[1] + f.n[2] * 0.03],
            [f.a[0] + f.n[0] * 0.03, y + w, f.a[1] + f.n[2] * 0.03],
          ],
          f.n,
        );
      }
  }
}
function disc(o, id, top, d, crown = false) {
  const P = small(plan(id), d);
  body(o, P, top - 0.22, d, { bottom: F + 0.2, glass: true });
  flat(o, 'roof', P, top);
  if (d > 0) {
    prism(o, 'trim', P, top - 0.2, top + 0.1);
    const cen = P.reduce((a, v) => [a[0] + v[0] / P.length, a[1] + v[1] / P.length], [0, 0]);
    if (crown) {
      const N = d === 1 ? 6 : 12,
        r = 18.5,
        R = Array.from({ length: N * 2 }, (_, i) => [
          cen[0] + r * Math.cos((i * Math.PI) / N),
          cen[1] + r * Math.sin((i * Math.PI) / N),
        ]);
      for (let i = 0; i < R.length; i++) {
        const j = (i + 1) % R.length,
          a = R[i],
          b = R[j],
          h = i % 2 ? A.parlatino.crownLow : A.parlatino.crownTop;
        T(
          o,
          'wall',
          [
            [cen[0], top + 1, cen[1]],
            [a[0], h, a[1]],
            [b[0], i % 2 ? A.parlatino.crownTop : A.parlatino.crownLow, b[1]],
          ],
          [0, 1, 0],
        );
        Q(
          o,
          'trim',
          [
            [a[0], top, a[1]],
            [b[0], top, b[1]],
            [b[0], i % 2 ? A.parlatino.crownTop : A.parlatino.crownLow, b[1]],
            [a[0], h, a[1]],
          ],
          null,
        );
      }
    }
  } else if (crown) {
    const cen = P.reduce((a, v) => [a[0] + v[0] / P.length, a[1] + v[1] / P.length], [0, 0]);
    for (let i = 0; i < 6; i++) {
      const a = (i * 2 * Math.PI) / 6,
        b = ((i + 1) * 2 * Math.PI) / 6;
      T(
        o,
        'wall',
        [
          [cen[0], A.parlatino.crownTop, cen[1]],
          [cen[0] + 16 * Math.cos(a), top, cen[1] + 16 * Math.sin(a)],
          [cen[0] + 16 * Math.cos(b), top, cen[1] + 16 * Math.sin(b)],
        ],
        [0, 1, 0],
      );
    }
  }
}
function pylon(o, f, u, top, d) {
  const out = proxy(o, f);
  if (d === 0) {
    const poly = [
      [-0.75, F],
      [0.75, F],
      [0.55, top - 1],
      [-0.2, top],
    ];
    for (const z of [-0.7, 0.7]) {
      const ids = earcut(poly.flat());
      for (let i = 0; i < ids.length; i += 3)
        T(
          out,
          'wall',
          ids.slice(i, i + 3).map((k) => [u + poly[k][0], poly[k][1], z]),
          [0, 0, z < 0 ? -1 : 1],
        );
    }
    Q(
      out,
      'wall',
      [
        [u - 0.75, F, -0.7],
        [u - 0.75, F, 0.7],
        [u - 0.2, top, 0.7],
        [u - 0.2, top, -0.7],
      ],
      [-1, 0, 0],
    );
    for (const [a, b] of [
      [
        [0.75, F],
        [0.55, top - 1],
      ],
      [
        [0.55, top - 1],
        [-0.2, top],
      ],
    ])
      Q(
        out,
        'wall',
        [
          [u + a[0], a[1], -0.7],
          [u + a[0], a[1], 0.7],
          [u + b[0], b[1], 0.7],
          [u + b[0], b[1], -0.7],
        ],
        null,
      );
    return;
  }
  const N = [0, 8, 12, 20][d],
    levels = [
      [F, 1.2],
      [2, 1.2],
      [8, 0.9],
      [top - 4, 0.55],
      [top - 1, 0.4],
      [top, 0.12],
    ];
  for (let j = 0; j < levels.length - 1; j++)
    for (let i = 0; i < N; i++) {
      const V = (pr, k) => {
        const a = (k * 2 * Math.PI) / N;
        return [u + pr[1] * Math.cos(a), pr[0], 0.58 * pr[1] * Math.sin(a)];
      };
      Q(
        out,
        'wall',
        [V(levels[j], i), V(levels[j], i + 1), V(levels[j + 1], i + 1), V(levels[j + 1], i)],
        null,
      );
    }
  flat(
    out,
    'wall',
    Array.from({ length: N }, (_, k) => [
      u + 0.12 * Math.cos((k * 2 * Math.PI) / N),
      0.58 * 0.12 * Math.sin((k * 2 * Math.PI) / N),
    ]),
    top,
  );
}
function libraryAndHall(o, d) {
  for (const [kind, S] of [
    ['library', A.library],
    ['hall', A.hall],
  ]) {
    const f = frame(...S.axisEndpoints),
      out = proxy(o, f),
      P = small(plan(S.id).map(f.local), d);
    pylon(o, f, -f.L / 2, S.pylonTop, d);
    pylon(o, f, f.L / 2, S.pylonTop, d);
    box(out, 'wall', 0, S.beamBottom, 0, f.L, S.beamTop - S.beamBottom, 2.1);
    if (kind === 'library') {
      const R = clip(clip(P, 0, S.roofBodyU[0], true), 0, S.roofBodyU[1], false),
        lo = Math.min(...R.map((v) => v[1])),
        hi = Math.max(...R.map((v) => v[1])),
        Y = (_x, z) =>
          S.roofOuterY +
          (S.beamTop - 0.3 - S.roofOuterY) *
            Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(z) / (z < 0 ? Math.abs(lo) : hi), 2)));
      roofField(out, R, Y, d);
      body(out, R, (x, z) => Y(x, z) - 0.35, d, { glass: true, bottom: F + 0.12, inset: 0.35 });
    } else {
      const R = S.roofIndices.map((i) => plan(S.id)[i]).map(f.local),
        lo = Math.min(...R.map((v) => v[0])),
        hi = Math.max(...R.map((v) => v[0])),
        v0 = Math.min(...R.map((v) => v[1])),
        v1 = Math.max(...R.map((v) => v[1])),
        Y = (x, z) =>
          S.beamTop +
          (S.roofPeak - S.beamTop) * Math.sin((Math.PI * (x - lo)) / (hi - lo)) -
          (S.rearRoofDrop * Math.abs(z)) / Math.max(Math.abs(v0), Math.abs(v1));
      roofField(out, R, Y, d, 0);
      body(out, R, (x, z) => Y(x, z) - 0.35, d, { glass: true, bottom: F + 0.15, inset: 0.4 });
    }
  }
}
function auditorium(o, d) {
  const S = A.auditorium,
    f = localFrame(plan(S.id), S.rotation),
    out = proxy(o, f),
    full = plan(S.id).map(f.local),
    P = small([...full.slice(0, 7), ...full.slice(39, 45)], d),
    lo = Math.min(...P.map((v) => v[1])),
    hi = Math.max(...P.map((v) => v[1])),
    split = lo + (hi - lo) * 0.45,
    Y = (_x, z) => {
      if (z <= split) {
        const t = (z - lo) / (split - lo);
        return S.outerY + (S.valleyY - S.outerY) * t + 12.4 * Math.sin(Math.PI * t);
      }
      const t = (z - split) / (hi - split);
      return S.valleyY + (S.outerY - S.valleyY) * t + 16 * Math.sin(Math.PI * t);
    };
  roofField(out, P, Y, d);
  body(out, P, (x, z) => Y(x, z) - 0.4, d, { glass: true, bottom: F + 0.1, inset: 0.7 });
  // Intrinsic eastern rounded foyer and western service projection retain the full native outline.
  // Their obscured low roof sections are bounded estimates, separate from the twin main vaults.
  for (const wing of [full.slice(6, 40), [...full.slice(44), full[0]]]) {
    const W = small(wing, d);
    body(out, W, 5.2, d, { glass: true });
    flat(out, 'roof', W, 5.3);
  }
  if (d > 1) {
    const x = Math.min(...P.map((v) => v[0])) + 0.8;
    for (const z of [-8, 0, 8]) box(out, 'trim', x, F + 0.1, z, 1.8, 3.3, 0.18);
  }
}
function pavilionAndOffices(o, d) {
  const S = A.pavilion,
    P = small(plan(S.id), d),
    h = S.bodyTop;
  flat(o, 'roof', P, h);
  for (const f of faces(P))
    Q(
      o,
      'wall',
      [
        [f.a[0], h - 0.25, f.a[1]],
        [f.b[0], h - 0.25, f.b[1]],
        [f.b[0], h, f.b[1]],
        [f.a[0], h, f.a[1]],
      ],
      f.n,
    );
  if (d > 0) flat(o, 'trim', P, h - 0.25, C.trim, true);
  body(o, P, h - 0.25, d, { inset: S.arcadeDepth, glass: true, bottom: F + 0.1 });
  const ff = faces(P),
    step = [30, 16, 8, 5][d];
  for (const f of ff) {
    if (d === 0 && f.w < 12) continue;
    const n = Math.max(1, Math.floor(f.w / step));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n,
        x = f.a[0] + (f.b[0] - f.a[0]) * t,
        z = f.a[1] + (f.b[1] - f.a[1]) * t;
      box(o, 'wall', x, F, z, 0.42, h - F, 0.42);
    }
  }
  const adm = A.administration,
    R = small(plan(adm.id), d);
  body(o, R, adm.bodyTop, d, { bottom: adm.pilotiTop, glass: true, bands: 2 });
  flat(o, 'roof', R, adm.bodyTop);
  flat(o, 'roof', R, adm.pilotiTop, C.roof, true);
  const c = R.reduce((a, v) => [a[0] + v[0] / R.length, a[1] + v[1] / R.length], [0, 0]);
  for (const x of [-14, 14])
    for (const z of [-4, 4]) box(o, 'wall', c[0] + x, F, c[1] + z, 0.8, adm.pilotiTop - F, 0.8);
  if (d > 0) {
    box(o, 'wall', c[0], adm.bodyTop, c[1], 50, 1.3, 1.2);
    for (const x of [-20, 20]) box(o, 'wall', c[0] + x, adm.bodyTop - 1.6, c[1], 0.8, 3.4, 13);
  }
  for (const s of [A.annex, ...A.services]) {
    const q = small(plan(s.id), d);
    body(o, q, s.bodyTop, d, { glass: d > 0, bottom: F + 0.05, bands: 1 });
    flat(o, 'roof', q, s.bodyTop);
    if (d > 1)
      for (const f of faces(q)) {
        const n = Math.max(1, Math.floor(f.w / 6));
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n,
            x = f.a[0] + (f.b[0] - f.a[0]) * t,
            z = f.a[1] + (f.b[1] - f.a[1]) * t;
          box(o, 'wall', x, F, z, 0.16, s.bodyTop - F, 0.16);
        }
      }
  }
}
function axisPoints(id, d) {
  const P = feature(id).outline;
  if (d > 0) return P;
  const out = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const a = out.at(-1),
      b = P[i],
      c = P[i + 1],
      v = sub(c, a),
      t = ((b[0] - a[0]) * v[0] + (b[1] - a[1]) * v[1]) / (v[0] * v[0] + v[1] * v[1]);
    if (Math.hypot(b[0] - a[0] - v[0] * t, b[1] - a[1] - v[1] * t) > 2.0) out.push(b);
  }
  out.push(P.at(-1));
  return out;
}
function bridge(o, id, S, d, main) {
  const P = axisPoints(id, d),
    lengths = [0];
  for (let i = 1; i < P.length; i++)
    lengths.push(lengths.at(-1) + Math.hypot(...sub(P[i], P[i - 1])));
  const total = lengths.at(-1),
    Y = (t) =>
      main
        ? S.startY + (S.crownY - S.startY) * Math.sin(Math.PI * t)
        : S.startY + (S.endY - S.startY) * t,
    edges = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)],
      b = P[Math.min(P.length - 1, i + 1)],
      v = sub(b, a),
      L = Math.hypot(...v),
      n = [-v[1] / L, v[0] / L],
      y = Y(lengths[i] / total);
    edges.push(
      [-1, 1].map((side) => [
        P[i][0] + (side * n[0] * S.width) / 2,
        y,
        P[i][1] + (side * n[1] * S.width) / 2,
      ]),
    );
  }
  for (let i = 0; i < edges.length - 1; i++) {
    const [a, b] = edges[i],
      [c, e] = edges[i + 1];
    Q(o, 'roof', [a, b, e, c], [0, 1, 0]);
    if (d > 0)
      Q(
        o,
        'roof',
        [a, b, e, c].map((v) => [v[0], v[1] - S.slabDepth, v[2]]),
        [0, -1, 0],
      );
    for (const side of [0, 1]) {
      const q = edges[i][side],
        r = edges[i + 1][side];
      Q(
        o,
        'wall',
        [[q[0], q[1] - S.slabDepth, q[2]], [r[0], r[1] - S.slabDepth, r[2]], r, q],
        null,
      );
      beam(
        o,
        'iron',
        [q[0], q[1] + S.railHeight - 0.04, q[2]],
        [r[0], r[1] + S.railHeight - 0.04, r[2]],
        0.075,
        0.08,
      );
      if (d > 0) {
        beam(o, 'iron', [q[0], q[1] + 0.475, q[2]], [r[0], r[1] + 0.475, r[2]], 0.055, 0.05);
        const N = d === 1 ? 1 : Math.max(1, Math.ceil(Math.hypot(...sub(q, r)) / 2));
        for (let k = 0; k < N; k++) {
          if (d === 1) continue;
          const t = (k + 0.5) / N,
            x = q[0] + (r[0] - q[0]) * t,
            z = q[2] + (r[2] - q[2]) * t,
            y = q[1] + (r[1] - q[1]) * t;
          box(o, 'iron', x, y, z, 0.065, S.railHeight, 0.065);
        }
      }
    }
  }
  for (const t of d === 0 ? [0.5] : [0.24, 0.5, 0.76]) {
    let i = 1;
    while (i < lengths.length - 1 && lengths[i] / total < t) i++;
    const a = P[i - 1],
      b = P[i],
      v = (t * total - lengths[i - 1]) / (lengths[i] - lengths[i - 1]),
      x = a[0] + (b[0] - a[0]) * v,
      z = a[1] + (b[1] - a[1]) * v,
      h = Y(t) - S.slabDepth;
    if (h > F) box(o, 'wall', x, F, z, 0.75, h - F, 0.75);
  }
}
function entryCanopy(o) {
  const P = feature(A.parlatinoRamp.id).outline,
    a = P[0],
    b = P[1],
    v = sub(b, a),
    L = Math.hypot(...v),
    u = v.map((x) => x / L),
    n = [-u[1], u[0]],
    R = [
      [-3.6, 0],
      [3.6, 0],
      [3.6, 8],
      [-3.6, 8],
    ].map(([w, t]) => [a[0] + w * n[0] + t * u[0], 8.6 + t * 0.0625, a[1] + w * n[1] + t * u[1]]),
    B = R.map((v) => [v[0], v[1] - 0.18, v[2]]);
  Q(o, 'wall', R, [0, 1, 0]);
  Q(o, 'trim', B, [0, -1, 0]);
  for (let k = 0; k < 4; k++) {
    const j = (k + 1) % 4;
    Q(o, 'wall', [R[k], R[j], B[j], B[k]], null);
  }
}
function profile(o, P, z, depth, _d, s = 'wall') {
  const ids = earcut(P.flat());
  for (let i = 0; i < ids.length; i += 3) {
    T(
      o,
      s,
      ids.slice(i, i + 3).map((k) => [P[k][0], P[k][1], z]),
      [0, 0, -1],
    );
    T(
      o,
      s,
      ids.slice(i, i + 3).map((k) => [P[k][0], P[k][1], z + depth]),
      [0, 0, 1],
    );
  }
  for (let i = 0; i < P.length; i++) {
    const j = (i + 1) % P.length;
    Q(
      o,
      s,
      [
        [P[i][0], P[i][1], z],
        [P[j][0], P[j][1], z],
        [P[j][0], P[j][1], z + depth],
        [P[i][0], P[i][1], z + depth],
      ],
      null,
    );
  }
}
function artworks(o, d) {
  const H = A.hand,
    pt = feature(H.id).outline[0],
    f = frame(
      [pt[0] - Math.cos(H.heading), pt[1] + Math.sin(H.heading)],
      [pt[0] + Math.cos(H.heading), pt[1] - Math.sin(H.heading)],
    ),
    out = proxy(o, f),
    P = [
      [-1.0, 0.05],
      [0.8, 0.05],
      [1.0, 2.5],
      [2.3, 4.1],
      [2.5, 4.7],
      [2.2, 4.9],
      [1.6, 4.3],
      [0.95, 3.8],
      [1.0, 6.2],
      [0.88, 6.5],
      [0.64, 6.45],
      [0.48, 4.6],
      [0.32, 7.0],
      [0.16, 7.4],
      [-0.08, 7.35],
      [-0.1, 4.8],
      [-0.36, 6.95],
      [-0.56, 7.2],
      [-0.78, 7.1],
      [-0.64, 4.6],
      [-1.0, 6.0],
      [-1.25, 6.15],
      [-1.45, 5.95],
      [-1.15, 3.8],
    ];
  profile(out, P, -H.depth / 2, H.depth, d);
  if (d > 0) {
    const red = [
      [-0.45, 3.8],
      [0.2, 3.6],
      [0.65, 3.2],
      [0.28, 2.8],
      [0.3, 2.2],
      [-0.1, 1.1],
      [-0.36, 2.0],
      [-0.55, 2.8],
    ];
    const ids = earcut(red.flat());
    for (let k = 0; k < ids.length; k += 3)
      T(
        out,
        'red',
        ids.slice(k, k + 3).map((j) => [red[j][0], red[j][1], -H.depth / 2 - 0.014]),
        [0, 0, -1],
      );
  }
  const S = A.flower,
    [x, z] = S.position;
  for (const k of [0, 1, 2, 3]) {
    const a = k * 1.5,
      x0 = x + (k % 2 ? 1 : -1) * 2.4,
      z0 = z + (k - 1.5) * 1.15,
      top = S.height - (k % 2) * 1.7,
      q = [
        [x0, F, z0],
        [x0 + Math.cos(a) * 3.2, F + 0.6, z0 + Math.sin(a) * 3.2],
        [x0 + Math.cos(a) * 1.3, top, z0 + Math.sin(a) * 1.3],
        [x0 - 1.3, top - 1.6, z0 + 1.0],
      ];
    Q(o, 'red', q, null);
    Q(o, 'red', q.toReversed(), null);
  }
}
function build(o, _frame, d = 3) {
  disc(o, A.gallery.id, A.gallery.bodyTop, d);
  disc(o, A.parlatino.id, A.parlatino.bodyTop, d, true);
  disc(o, A.reception.id, A.reception.bodyTop, d);
  libraryAndHall(o, d);
  auditorium(o, d);
  pavilionAndOffices(o, d);
  bridge(o, A.bridge.id, A.bridge, d, true);
  bridge(o, A.parlatinoRamp.id, A.parlatinoRamp, d, false);
  entryCanopy(o);
  artworks(o, d);
}
export function memorialCounts(d) {
  const out = {};
  for (const fn of [libraryAndHall, auditorium, pavilionAndOffices, artworks]) {
    let n = 0;
    fn(
      {
        addTriangle() {
          n++;
        },
      },
      d,
    );
    out[fn.name] = n;
  }
  return out;
}
export const memorialSkyline = (o, f) => build(o, f, 0),
  memorialDistrict = (o, f) => build(o, f, 1),
  memorialStreet = (o, f) => build(o, f, 2),
  memorialCloseup = (o, f) => build(o, f, 3);
export const latinAmericaMemorialModel = {
  id: 'latin_america_memorial',
  key: 'latin_america_memorial',
  cell: '6g/6gy',
  recipe: 'structure-latin-america-memorial.mjs',
  title: 'Latin America Memorial',
  category: 'landmark',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [430, 290, 470],
  lookAt: [0, 12, 0],
  portableGroundY: -0.16,
  mediumFiContext: { scale: 2 },
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.sectionBasis}`,
  qaCameras: [
    {
      name: 'whole-eight-principal-buildings-reception-service-bridge-and-artworks',
      position: [430, 290, 470],
      lookAt: [0, 12, 0],
    },
    {
      name: 'opposite-whole-compound-and-both-mapped-parcels',
      position: [-470, 260, -380],
      lookAt: [0, 10, 0],
    },
    {
      name: 'civic-salao-single-sided-vault-beam-pylons-and-hand',
      position: [-20, 25, 135],
      lookAt: [-92, 14, 50],
    },
    {
      name: 'library-two-curved-wings-long-beam-and-pylon-ends',
      position: [-165, 20, 168],
      lookAt: [-178, 10, 94],
    },
    {
      name: 'circular-dark-glazed-gallery-and-low-roof-rim',
      position: [-255, 14, 32],
      lookAt: [-217, 3, 3],
    },
    {
      name: 'whole-twin-wave-auditorium-shells-glazed-ends-and-recessed-eaves',
      position: [315, 28, 45],
      lookAt: [202, 10, -25],
    },
    {
      name: 'former-parlatino-cylinder-folded-white-crown-and-entry-ramp',
      position: [100, 38, 10],
      lookAt: [44, 14, -36],
    },
    {
      name: 'whole-long-creativity-pavilion-open-arcade-and-curved-footprint',
      position: [8, 27, -160],
      lookAt: [20, 3, -90],
    },
    {
      name: 'administration-open-piloti-and-congressist-service-wings',
      position: [-85, 22, -139],
      lookAt: [-125, 6, -68],
    },
    {
      name: 'complete-curved-interparcel-bridge-thickness-piers-and-open-rails',
      position: [-95, 19, 15],
      lookAt: [-110, 4, -23],
    },
    {
      name: 'intrinsic-open-hand-fingers-and-bounded-red-palm-inlay',
      position: [feature(A.hand.id).outline[0][0] - 10, 7, feature(A.hand.id).outline[0][1] - 12],
      lookAt: [feature(A.hand.id).outline[0][0], 3.7, feature(A.hand.id).outline[0][1]],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-latin-america-memorial.mjs',
    level: 'skyline',
    export: 'memorialSkyline',
    errorMeters: 3.5,
    surfaces,
    authoredLevels: {
      district: { export: 'memorialDistrict', errorMeters: 1.1, surfaces },
      street: { export: 'memorialStreet', errorMeters: 0.3, surfaces },
      closeup: { export: 'memorialCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.sectionBasis,
    'Whole eleven-building native architectural ensemble: Salão beam/end pylons/high one-sided shell, library long beam/two curved roof wings/end pylons, circular glazed gallery/reception, twin-wave auditorium, formerParlatino glazed cylinder/folded white crown, long curved CreativityPavilion/open arcade, administration/open piloti, congressist annex/two service blocks, complete mapped interparcel bridge/formerParlatino curved entry ramp, intrinsic hand and bounded red folded-plate flower. Native compound boundary is identity only; no full plaza/parking/site floor, city buildings/trees/poles/events/people/text/interiors.',
    'Four exact cleared published Qualla Dornicke own/PD-self originals first, then two exact native own/PD-self creator supplements. All six originals individually inspected/native-byte matched and inventory passed. No attribution-only or uncertain images, protected PDF/photo-gallery pixels, generated bitmap, borrowed model or license-policy changes. Photographs2008/2010 predate later auditorium restorations; current hidden finish/fixtures not claimed surveyed.',
    'Whole mapped component footprints/positions and bridge/ramp routes retained. LODs simplify minor outline corners, roof subdivisions, glazing/column census and curves without dropping principal structures. Native low/average height tags do not certify high shell/pylon peaks. Roof/pylon/beam sections, hidden low auditorium foyer/service projection roofs and nondefining facade detail, ramp slope/road clearance, hand/flower art silhouette and red palm inlay are original bounded medium-fi interpretations, not measured engineering or copied protected murals/insignia.',
    'Six canonical slots/two shared graphs plus two opaque local accents: white/pale concrete wall/trim/roof, dark reflective opaque glass, painted metal rail/frame and muted red art. Near levels retain roof undersides/eaves, folded crown, glazing mullions/columns/bridge posts; no transparent interiors or active illumination.',
    'Independent1000m16641value field/two original tiles/PNG frozen before geometry and unchanged. Architectural+.05m common floor/bridge estimates chosen independently, coarse urban composite may contain building/canopy artifacts and cannot certify local foundation or traffic clearances. Isolated/flat appearance accepted with separate unchanged-field evidence. Approximate geographic preview/replacementfalse; no flattening/fitting/reacquisition or full-campus ground pad.',
  ],
};

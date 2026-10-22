/** Full eleven-span crossing, restored fixed steel center and paired gilded entrance groups. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const p = JSON.parse(
    fs.readFileSync(
      new URL(
        '../../../content/worldgen/source/places/dq/dqc/arlington_memorial_bridge/plan-controls.json',
        import.meta.url,
      ),
    ),
  ),
  P = p.parameters,
  ref = 'palette:#ffffff',
  C = {
    stone: rgb('b9b4a6'),
    trim: rgb('c3bdad'),
    road: rgb('858780'),
    metal: rgb('b4b3a7'),
    gold: rgb('c29d51'),
    glass: rgb('dddcc5'),
  },
  surfaces = {
    stone: { slot: 'wall', graph: 'stone_ashlar', roughness: 0.96, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_granite', roughness: 0.96, metallic: 0 },
    road: { slot: 'foundation', graph: 'concrete_plain', roughness: 0.98, metallic: 0 },
    metal: { slot: 'roof', graph: 'metal_painted', roughness: 0.8, metallic: 0.22 },
    gold: { slot: 'trim', graph: 'metal_bronze_cast', roughness: 0.43, metallic: 0.78 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.4, metallic: 0.01 },
  };
const mix = (a, b, t) => a + (b - a) * t,
  deckY = (x) => P.deckEnd + (P.deckCrown - P.deckEnd) * Math.max(0, 1 - (x / 330) ** 2),
  line = (r, x) => r[1] + (x - r[0]) * r[2],
  north = (x) => line(P.northBaseline, x),
  south = (x) => line(P.southBaseline, x),
  axis = (x) => line(P.roadAxis, x),
  rect = (x0, z0, x1, z1) => [
    [x0, z0],
    [x1, z0],
    [x1, z1],
    [x0, z1],
  ];
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((a, v, k) => a + v * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
  const N = normalFor(...q);
  o.addTriangle(
    s,
    ref,
    q,
    N,
    q.map((v) =>
      Math.abs(N[1]) > 0.8 ? [v[0], v[2]] : [Math.abs(N[0]) > 0.7 ? v[2] : v[0], v[1]],
    ),
    col,
  );
}
function Q(o, s, q, n, col = C[s]) {
  T(o, s, q.slice(0, 3), n, col);
  T(o, s, [q[0], q[2], q[3]], n, col);
}
function cap(o, s, r, y, up = true, col = C[s]) {
  const ix = earcut(r.flat());
  for (let i = 0; i < ix.length; i += 3)
    T(
      o,
      s,
      ix.slice(i, i + 3).map((k) => [r[k][0], typeof y === 'function' ? y(...r[k]) : y, r[k][1]]),
      [0, up ? 1 : -1, 0],
      col,
    );
}
function prism(o, s, r, y0, y1, d = 3, col = C[s]) {
  if (d) cap(o, s, r, y0, false, col);
  cap(o, s, r, y1, true, col);
  const sg = Math.sign(
    r.reduce((n, a, i) => n + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], y0, a[1]],
        [b[0], y0, b[1]],
        [b[0], y1, b[1]],
        [a[0], y1, a[1]],
      ],
      [sg * (b[1] - a[1]), 0, sg * (a[0] - b[0])],
      col,
    );
  }
}
function box(o, s, x, y, z, w, h, l, d = 3, col = C[s]) {
  prism(o, s, rect(x - w / 2, z - l / 2, x + w / 2, z + l / 2), y, y + h, d, col);
}
function beam(o, s, a, b, w, d = 3, col = C[s]) {
  const v = b.map((x, k) => x - a[k]),
    L = Math.hypot(...v),
    axis = v.map((x) => x / L),
    u0 = cross(axis, Math.abs(axis[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0]),
    u = u0.map((x) => x / Math.hypot(...u0)),
    v2 = cross(axis, u);
  if (d < 2) {
    for (const n of [u, v2])
      Q(
        o,
        s,
        [
          a.map((x, k) => x - (n[k] * w) / 2),
          a.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x + (n[k] * w) / 2),
          b.map((x, k) => x - (n[k] * w) / 2),
        ],
        cross(n, axis),
        col,
      );
    return;
  }
  const ring = (c) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([i, j]) => c.map((x, k) => x + ((u[k] * i + v2[k] * j) * w) / 2)),
    A = ring(a),
    B = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(
      o,
      s,
      [A[i], A[j], B[j], B[i]],
      A[i].map((x, k) => x - a[k]),
      col,
    );
  }
  Q(
    o,
    s,
    [...A].reverse(),
    axis.map((x) => -x),
    col,
  );
  Q(o, s, B, axis, col);
}
function ellipsoid(o, s, c, r, d, col = C[s]) {
  const n = [4, 6, 8, 10][d],
    rows = [2, 3, 4, 6][d],
    point = (i, j) => {
      const a = (i * 2 * Math.PI) / n,
        b = -Math.PI / 2 + (j * Math.PI) / rows;
      return [
        c[0] + r[0] * Math.cos(a) * Math.cos(b),
        c[1] + r[1] * Math.sin(b),
        c[2] + r[2] * Math.sin(a) * Math.cos(b),
      ];
    };
  for (let i = 0; i < n; i++)
    for (let j = 0; j < rows; j++) {
      const q = [point(i, j), point(i + 1, j), point(i + 1, j + 1), point(i, j + 1)];
      Q(
        o,
        s,
        q,
        q.reduce((a, v) => a.map((x, k) => x + (v[k] - c[k]) / 4), [0, 0, 0]),
        col,
      );
    }
}
function lathe(o, s, x, z, y, profile, n, d, col = C[s]) {
  const ring = (r, h) =>
    Array.from({ length: n }, (_, i) => [
      x + Math.cos((i * 2 * Math.PI) / n) * r,
      y + h,
      z + Math.sin((i * 2 * Math.PI) / n) * r,
    ]);
  for (let j = 0; j < profile.length - 1; j++) {
    const A = ring(...profile[j]),
      B = ring(...profile[j + 1]);
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      Q(o, s, [A[i], A[k], B[k], B[i]], [A[i][0] - x, 0, A[i][2] - z], col);
    }
  }
  if (d > 2) {
    cap(
      o,
      s,
      ring(...profile[0]).map((q) => [q[0], q[2]]),
      y + profile[0][1],
      false,
      col,
    );
    cap(
      o,
      s,
      ring(...profile.at(-1)).map((q) => [q[0], q[2]]),
      y + profile.at(-1)[1],
      true,
      col,
    );
  }
}
function archCurve(a, b, spring, crown, n) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = Math.PI - (i * Math.PI) / n;
    return [(a + b) / 2 + ((b - a) / 2) * Math.cos(t), spring + (crown - spring) * Math.sin(t)];
  });
}
function extrusion(o, s, r, z0, z1, col = C[s]) {
  const ix = earcut(r.flat()),
    Z = (f, x) => (typeof f === 'function' ? f(x) : f);
  for (const [f, n] of [
    [z0, [0, 0, -1]],
    [z1, [0, 0, 1]],
  ])
    for (let j = 0; j < ix.length; j += 3)
      T(
        o,
        s,
        ix.slice(j, j + 3).map((k) => [r[k][0], r[k][1], Z(f, r[k][0])]),
        n,
        col,
      );
  const sg = Math.sign(
    r.reduce((n, a, i) => n + a[0] * r[(i + 1) % r.length][1] - r[(i + 1) % r.length][0] * a[1], 0),
  );
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    Q(
      o,
      s,
      [
        [a[0], a[1], Z(z0, a[0])],
        [b[0], b[1], Z(z0, b[0])],
        [b[0], b[1], Z(z1, b[0])],
        [a[0], a[1], Z(z1, a[0])],
      ],
      [sg * (b[1] - a[1]), sg * (a[0] - b[0]), 0],
      col,
    );
  }
}
function sideProfile(start, end, openings, d) {
  const r = [[start, 0]],
    n = [4, 8, 16, 28][d];
  for (const [a, b, road] of openings) {
    const cx = (a + b) / 2,
      crown = road ? deckY(cx) - 2.4 : deckY(cx) - 1.95,
      spring = road ? 3.2 : 2.1;
    r.push([a, 0], ...archCurve(a, b, spring, crown, n), [b, 0]);
  }
  r.push([end, 0], [end, deckY(end) - 0.35]);
  for (let x = end - (d ? 20 : 50); x > start; x -= d ? 20 : 50) r.push([x, deckY(x) - 0.35]);
  r.push([start, deckY(start) - 0.35]);
  return r;
}
const openings = [
  ...P.roadOpenings.map((x) => [...x, true]),
  ...P.waterOpenings.map((x) => [...x, false]),
].sort((a, b) => a[0] - b[0]);
function masonry(o, d) {
  extrusion(
    o,
    'stone',
    sideProfile(
      P.bridgeStart,
      P.centralOpening[0],
      openings.filter((a) => a[0] < P.centralOpening[0]),
      d,
    ),
    north,
    south,
  );
  extrusion(
    o,
    'stone',
    sideProfile(
      P.centralOpening[1],
      P.bridgeEnd,
      openings.filter((a) => a[0] > P.centralOpening[1]),
      d,
    ),
    north,
    south,
  );
  for (const pier of p.piers) {
    let r = d === 1 ? pier.outline.filter((_, i) => i % 2 === 0) : pier.outline;
    if (d === 0) {
      const x0 = Math.min(...r.map((v) => v[0])),
        x1 = Math.max(...r.map((v) => v[0])),
        n = Math.min(...r.map((v) => v[1])),
        s = Math.max(...r.map((v) => v[1])),
        x = (x0 + x1) / 2;
      r = [
        [x0, north(x)],
        [x, n],
        [x1, north(x)],
        [x1, south(x)],
        [x, s],
        [x0, south(x)],
      ];
    }
    prism(o, 'trim', r, 0, 1.55, d);
    if (d > 0) {
      const c = r.reduce((a, v) => a.map((x, k) => x + v[k] / r.length), [0, 0]),
        R = r.map((v) => v.map((x, k) => c[k] + (x - c[k]) * 1.025));
      prism(o, 'trim', R, 1.55, 1.8, d);
    }
  }
}
function centralSteel(o, d) {
  const [a, b] = P.centralOpening,
    cx = (a + b) / 2,
    c = archCurve(a, b, 3.3, P.centralCrown, [4, 8, 18, 30][d]),
    r = [...c, [b, deckY(b) - 0.35], [a, deckY(a) - 0.35]];
  extrusion(o, 'metal', r, north, (x) => north(x) + 0.3);
  extrusion(o, 'metal', r, (x) => south(x) - 0.3, south);
  const zs = d > 1 ? [-11.4, -6.8, -2.3, 2.3, 6.8, 11.4] : [-10.5, 10.5];
  for (const z of zs) beam(o, 'metal', [a, 9.65, axis(a) + z], [b, 9.65, axis(b) + z], 0.36, d);
  if (d) {
    for (let j = 0; j <= 5; j++) {
      const x = mix(a, b, j / 5);
      beam(o, 'metal', [x, 9.6, north(x) + 0.35], [x, 9.6, south(x) - 0.35], 0.3, d);
    }
    for (const side of [-1, 1])
      for (let j = 0; j < 5; j++) {
        const x = mix(a, b, j / 5),
          u = mix(a, b, (j + 1) / 5),
          z = side * 10.5;
        beam(o, 'metal', [x, 8.98, axis(x) + z], [u, 10.2, axis(u) + z], 0.18, d);
        beam(o, 'metal', [x, 10.2, axis(x) + z], [u, 8.98, axis(u) + z], 0.18, d);
      }
  }
  if (d > 1) {
    for (const side of [-1, 1])
      Q(
        o,
        'metal',
        [
          [cx - 0.3, 9.5, side < 0 ? north(cx) - 0.01 : south(cx) + 0.01],
          [cx + 0.3, 9.5, side < 0 ? north(cx) - 0.01 : south(cx) + 0.01],
          [cx + 0.3, deckY(cx) - 0.4, side < 0 ? north(cx) - 0.01 : south(cx) + 0.01],
          [cx - 0.3, deckY(cx) - 0.4, side < 0 ? north(cx) - 0.01 : south(cx) + 0.01],
        ],
        [0, 0, side],
        C.trim,
      );
  }
}
function boundsAt(x) {
  const zz = [],
    r = p.deckOutline;
  for (let i = 0; i < r.length; i++) {
    const a = r[i],
      b = r[(i + 1) % r.length];
    if ((a[0] <= x && b[0] > x) || (b[0] <= x && a[0] > x))
      zz.push(a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]));
  }
  return [Math.min(...zz), Math.max(...zz)];
}
function deck(o, d) {
  const r = p.deckOutline,
    min = Math.min(...r.map((v) => v[0])),
    max = Math.max(...r.map((v) => v[0])),
    xs = [
      min + 0.002,
      max - 0.002,
      ...(d > 1 ? r.map((v) => v[0]).filter((x) => x > min + 0.002 && x < max - 0.002) : []),
    ];
  for (
    let x = Math.ceil(min / [40, 40, 15, 12][d]) * [40, 40, 15, 12][d];
    x < max;
    x += [40, 40, 15, 12][d]
  )
    xs.push(x);
  xs.sort((a, b) => a - b);
  const X = xs.filter((v, i) => !i || v - xs[i - 1] > 0.001);
  for (let i = 0; i < X.length - 1; i++) {
    const x = X[i],
      u = X[i + 1],
      a = boundsAt(x),
      b = boundsAt(u),
      y = deckY(x),
      h = deckY(u);
    Q(
      o,
      'trim',
      [
        [x, y, a[0]],
        [u, h, b[0]],
        [u, h, b[1]],
        [x, y, a[1]],
      ],
      [0, 1, 0],
    );
    if (d)
      Q(
        o,
        'trim',
        [
          [x, y - 0.35, a[0]],
          [x, y - 0.35, a[1]],
          [u, h - 0.35, b[1]],
          [u, h - 0.35, b[0]],
        ],
        [0, -1, 0],
      );
    for (const side of [0, 1])
      Q(
        o,
        'trim',
        [
          [x, y - 0.35, a[side]],
          [u, h - 0.35, b[side]],
          [u, h, b[side]],
          [x, y, a[side]],
        ],
        [0, 0, side ? 1 : -1],
      );
    const z = axis(x),
      w = axis(u),
      half = P.roadWidth / 2;
    Q(
      o,
      'road',
      [
        [x, y + 0.025, z - half],
        [u, h + 0.025, w - half],
        [u, h + 0.025, w + half],
        [x, y + 0.025, z + half],
      ],
      [0, 1, 0],
    );
    for (const side of [-1, 1]) {
      const A = z + side * half,
        B = w + side * half,
        E = z + side * (half + P.walkWidth),
        F = w + side * (half + P.walkWidth);
      Q(
        o,
        'trim',
        [
          [x, y + 0.18, A],
          [u, h + 0.18, B],
          [u, h + 0.18, F],
          [x, y + 0.18, E],
        ],
        [0, 1, 0],
      );
      if (d)
        Q(
          o,
          'trim',
          [
            [x, y + 0.03, A],
            [u, h + 0.03, B],
            [u, h + 0.18, B],
            [x, y + 0.18, A],
          ],
          [0, 0, -side],
        );
    }
    if (d > 1)
      for (const lane of [-6, -3, 0, 3, 6]) {
        if (i % 2 === 0)
          Q(
            o,
            'trim',
            [
              [x, y + 0.03, z + lane - 0.045],
              [
                Math.min(u, x + 4),
                deckY(Math.min(u, x + 4)) + 0.03,
                axis(Math.min(u, x + 4)) + lane - 0.045,
              ],
              [
                Math.min(u, x + 4),
                deckY(Math.min(u, x + 4)) + 0.03,
                axis(Math.min(u, x + 4)) + lane + 0.045,
              ],
              [x, y + 0.03, z + lane + 0.045],
            ],
            [0, 1, 0],
            rgb(lane === 0 ? 'b9aa71' : 'c4c1af'),
          );
      }
  }
  if (d > 1)
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      if ((a[0] > 317 && b[0] > 317) || (a[0] < -328 && b[0] < -328))
        Q(
          o,
          'trim',
          [
            [a[0], deckY(a[0]) - 0.35, a[1]],
            [b[0], deckY(b[0]) - 0.35, b[1]],
            [b[0], deckY(b[0]), b[1]],
            [a[0], deckY(a[0]), a[1]],
          ],
          [a[0] > 0 ? 1 : -1, 0, 0],
        );
    }
}
function rails(o, d) {
  for (const side of [-1, 1]) {
    const z = (x) => (side < 0 ? north(x) + 0.4 : south(x) - 0.4);
    for (let x = -329; x < 329; x += d > 1 ? 20 : d ? 40 : 55) {
      const b = Math.min(329, x + (d > 1 ? 20 : d ? 40 : 55));
      if (d)
        for (const [y, h, w] of [
          [0.18, 0.25, 0.64],
          [1.28, 0.22, 0.68],
        ]) {
          const a = z(x),
            c = z(b);
          Q(
            o,
            'trim',
            [
              [x, deckY(x) + y, a - w / 2],
              [b, deckY(b) + y, c - w / 2],
              [b, deckY(b) + y, c + w / 2],
              [x, deckY(x) + y, a + w / 2],
            ],
            [0, 1, 0],
          );
          if (d)
            for (const sign of [-1, 1])
              Q(
                o,
                'trim',
                [
                  [x, deckY(x) + y, a + (sign * w) / 2],
                  [b, deckY(b) + y, c + (sign * w) / 2],
                  [b, deckY(b) + y + h, c + (sign * w) / 2],
                  [x, deckY(x) + y + h, a + (sign * w) / 2],
                ],
                [0, 0, sign],
              );
        }
      if (!d)
        Q(
          o,
          'trim',
          [
            [x, deckY(x) + 0.28, z(x)],
            [b, deckY(b) + 0.28, z(b)],
            [b, deckY(b) + 1.5, z(b)],
            [x, deckY(x) + 1.5, z(x)],
          ],
          [0, 0, side],
          rgb('aaa89d'),
        );
    }
    if (d) {
      const gap = d === 1 ? 20 : d === 2 ? 5.2 : 1.15;
      for (let x = -327; x < 327; x += gap) {
        const y = deckY(x) + 0.4;
        if (d === 1) beam(o, 'trim', [x, y, z(x)], [x, y + 0.88, z(x)], 0.18, 1);
        else
          lathe(
            o,
            'trim',
            x,
            z(x),
            y,
            [
              [0.14, 0],
              [0.065, 0.42],
              [0.13, 0.88],
            ],
            d === 2 ? 4 : 6,
            d,
          );
      }
      for (let x = -327; x < 328; x += d === 1 ? 66 : 22)
        box(o, 'trim', x, deckY(x) + 0.18, z(x), 0.6, 1.3, 0.7, d);
    }
  }
}
function lamps(o, d) {
  if (!d) return;
  const all = [...P.waterOpenings, P.centralOpening],
    rows = [];
  for (const [a, b] of all)
    for (const t of [0.26, 0.74]) for (const side of [-1, 1]) rows.push([mix(a, b, t), side]);
  for (const [a, b] of P.roadOpenings) for (const side of [-1, 1]) rows.push([(a + b) / 2, side]);
  for (const [x, side] of rows) {
    const z = (side < 0 ? north(x) : south(x)) - side * 0.9,
      y = deckY(x) + 0.18;
    beam(o, 'metal', [x, y, z], [x, y + 3.3, z], 0.085, d, rgb('434c46'));
    if (d === 1) {
      Q(
        o,
        'glass',
        [
          [x - 0.2, y + 3.2, z],
          [x + 0.2, y + 3.2, z],
          [x + 0.2, y + 3.7, z],
          [x - 0.2, y + 3.7, z],
        ],
        [0, 0, side],
      );
    } else if (d === 2) {
      ellipsoid(o, 'glass', [x, y + 3.43, z], [0.19, 0.3, 0.19], 1);
    } else {
      lathe(
        o,
        'metal',
        x,
        z,
        y,
        [
          [0.18, 0],
          [0.13, 0.28],
          [0.055, 3.2],
        ],
        6,
        d,
        rgb('434c46'),
      );
      ellipsoid(o, 'glass', [x, y + 3.43, z], [0.19, 0.3, 0.19], d);
      ellipsoid(o, 'metal', [x, y + 3.76, z], [0.055, 0.08, 0.055], 0, rgb('434c46'));
    }
  }
}
function ringRelief(o, x, y, z, side, d) {
  const n = d > 2 ? 16 : 10;
  for (let j = 0; j < n; j++) {
    const a = (j * 2 * Math.PI) / n,
      b = ((j + 1) * 2 * Math.PI) / n;
    Q(
      o,
      'trim',
      [
        [x + 1.25 * Math.cos(a), y + 1.85 * Math.sin(a), z],
        [x + 1.25 * Math.cos(b), y + 1.85 * Math.sin(b), z],
        [x + 1.12 * Math.cos(b), y + 1.68 * Math.sin(b), z + side * 0.11],
        [x + 1.12 * Math.cos(a), y + 1.68 * Math.sin(a), z + side * 0.11],
      ],
      [0, 0, side],
    );
  }
  ellipsoid(
    o,
    'trim',
    [x, y + 0.2, z + side * 0.12],
    [0.27, 0.69, 0.18],
    d === 2 ? 1 : Math.min(d, 2),
  );
  for (const sign of [-1, 1]) {
    T(
      o,
      'trim',
      [
        [x, y + 0.55, z + side * 0.15],
        [x + sign * 0.95, y + 0.95, z + side * 0.1],
        [x + sign * 0.58, y - 0.25, z + side * 0.13],
      ],
      [0, 0, side],
    );
    T(
      o,
      'trim',
      [
        [x, y + 0.5, z + side * 0.17],
        [x + sign * 0.58, y - 0.25, z + side * 0.13],
        [x, y - 0.3, z + side * 0.17],
      ],
      [0, 0, side],
    );
  }
  if (d > 1)
    beam(o, 'trim', [x, y - 1.5, z + side * 0.12], [x, y - 0.55, z + side * 0.12], 0.13, d);
}
function ornaments(o, d) {
  if (!d) return;
  if (d === 1) {
    for (const pier of p.piers) {
      const x =
        (Math.min(...pier.outline.map((v) => v[0])) + Math.max(...pier.outline.map((v) => v[0]))) /
        2;
      for (const side of [-1, 1]) {
        const z = side < 0 ? north(x) - 0.02 : south(x) + 0.02;
        Q(
          o,
          'trim',
          [
            [x - 1, 4.2, z],
            [x + 1, 4.2, z],
            [x + 1, 7.2, z],
            [x - 1, 7.2, z],
          ],
          [0, 0, side],
        );
      }
    }
    return;
  }
  for (const pier of p.piers) {
    const x =
      (Math.min(...pier.outline.map((v) => v[0])) + Math.max(...pier.outline.map((v) => v[0]))) / 2;
    for (const side of [-1, 1])
      ringRelief(o, x, 5.65, side < 0 ? north(x) - 0.035 : south(x) + 0.035, side, d);
  }
  for (const [a, b, road] of openings) {
    const x = (a + b) / 2,
      y = deckY(x) - 1.15;
    for (const side of [-1, 1]) {
      const z = (side < 0 ? north(x) : south(x)) + side * 0.04;
      ellipsoid(o, 'trim', [x, y, z], [0.42, 0.64, 0.2], d === 2 ? 1 : Math.min(d, 2));
      if (d > 1) {
        for (const s of [-1, 1])
          beam(
            o,
            'trim',
            [x + s * 0.26, y + 0.16, z + side * 0.12],
            [x + s * 0.6, y + 0.35, z + side * 0.16],
            0.12,
            d,
          );
        box(o, 'trim', x, y - 0.62, z, 0.45, 0.3, 0.35, d);
      }
    }
    if (d > 1) {
      const curve = archCurve(
        a,
        b,
        road ? 3.2 : 2.1,
        road ? deckY(x) - 2.4 : deckY(x) - 1.95,
        d === 2 ? 12 : 24,
      );
      for (const side of [-1, 1])
        for (let i = 0; i < curve.length - 1; i++) {
          const A = curve[i],
            B = curve[i + 1],
            Z = (t) => (side < 0 ? north(t) : south(t)) + side * 0.025;
          Q(
            o,
            'trim',
            [
              [A[0], A[1], Z(A[0])],
              [B[0], B[1], Z(B[0])],
              [B[0], B[1] + 0.5, Z(B[0])],
              [A[0], A[1] + 0.5, Z(A[0])],
            ],
            [0, 0, side],
          );
        }
    }
  }
}
function smallHorse(o, x, y, z, pose) {
  const r = [
      [-1.7, 0.1],
      [-1.25, 0.1],
      [-1, 1.8],
      [0.4, 1.75],
      [0.5, 0.1],
      [0.95, 0.1],
      [1.25, 1.9],
      [1.8, 2.1],
      [2.05, 3.6],
      [1.7, 4.25],
      [1.15, 4.15],
      [0.8, 2.8],
      [-1.45, 2.65],
      [-1.8, 2.1],
    ],
    R = r.map((q) => [q[0] + x, q[1] + y]);
  extrusion(o, 'gold', R, z - 0.45, z + 0.45);
  box(o, 'gold', x + 0.1, y + 2.6, z + pose * 0.75, 0.65, 1.55, 0.5, 0);
  ellipsoid(o, 'gold', [x + 0.1, y + 4.4, z + pose * 0.75], [0.3, 0.35, 0.3], 0);
}
function human(o, x, y, z, standing, d) {
  const s = standing ? 1 : 0.87;
  ellipsoid(o, 'gold', [x, y + 2.65 * s, z], [0.47, 0.75 * s, 0.3], d);
  ellipsoid(o, 'gold', [x, y + 3.65 * s, z], [0.23, 0.31, 0.24], d);
  for (const side of [-1, 1]) {
    const hip = [x + side * 0.2, y + 2.1 * s, z],
      knee = [
        x + side * 0.26 + (standing ? 0 : 0.35),
        y + (standing ? 1.1 : 1.45) * s,
        z + (standing ? 0 : side * 0.5),
      ],
      foot = [
        x + side * 0.3 + (standing ? 0 : 0.45),
        y + (standing ? 0.05 : 0.65) * s,
        z + (standing ? 0 : side * 0.75),
      ];
    beam(o, 'gold', hip, knee, 0.24, d);
    beam(o, 'gold', knee, foot, 0.19, d);
    ellipsoid(o, 'gold', foot, [0.28, 0.12, 0.17], Math.min(d, 2));
    const shoulder = [x + side * 0.4, y + 3.1 * s, z],
      elbow = [x + side * 0.65, y + 2.55 * s, z + 0.12],
      hand = [x + side * 0.45, y + 2.25 * s, z + 0.38];
    beam(o, 'gold', shoulder, elbow, 0.19, d);
    beam(o, 'gold', elbow, hand, 0.16, d);
  }
}
function entranceGroups(o, d) {
  for (const [k, g] of p.statues.entries()) {
    const [x, z] = g.centre,
      y = deckY(x) + 0.18;
    box(o, 'trim', x, y, z, 4.8, 0.5, 4.4, d);
    box(o, 'stone', x, y + 0.5, z, 4.05, 3.8, 3.65, d);
    box(o, 'trim', x, y + 4.3, z, 4.35, 0.25, 3.9, d);
    const h = y + 4.55;
    if (d === 0) {
      smallHorse(o, x, h, z, k ? -1 : 1);
      continue;
    }
    const detail = Math.max(0, d - 1);
    ellipsoid(o, 'gold', [x - 0.2, h + 2.1, z], [1.4, 0.78, 0.62], detail);
    ellipsoid(o, 'gold', [x + 1.0, h + 3.0, z], [0.55, 1.0, 0.43], detail);
    ellipsoid(o, 'gold', [x + 1.65, h + 3.85, z], [0.5, 0.65, 0.33], detail);
    ellipsoid(o, 'gold', [x + 1.87, h + 3.45, z], [0.43, 0.25, 0.29], detail);
    for (const side of [-1, 1]) {
      beam(
        o,
        'gold',
        [x + 1.55, h + 4.25, z + side * 0.2],
        [x + 1.4, h + 4.65, z + side * 0.23],
        0.16,
        d,
      );
      for (const front of [false, true]) {
        const A = [x + (front ? 0.8 : -1.05), h + 1.9, z + side * 0.43],
          B = [
            x + (front ? 1 : -1.25),
            h + (front && side === (k ? 1 : -1) ? 1.5 : 0.95),
            z + side * 0.48,
          ],
          D = [
            x + (front ? 1.55 : -1.35),
            h + (front && side === (k ? 1 : -1) ? 0.9 : 0.07),
            z + side * 0.52,
          ];
        beam(o, 'gold', A, B, 0.24, d);
        beam(o, 'gold', B, D, 0.18, d);
        ellipsoid(o, 'gold', D, [0.28, 0.13, 0.2], detail);
      }
    }
    beam(o, 'gold', [x - 1.4, h + 2.4, z], [x - 1.9, h + 0.7, z + 0.15], 0.17, d);
    human(o, x + 0.05, h, z + (k ? -1.0 : 1.0), true, detail);
    human(o, x - 0.55, h + 1.45, z, false, detail);
    if (k) ellipsoid(o, 'gold', [x + 0.4, h + 2.7, z - 1.0], [0.37, 0.5, 0.22], detail);
    if (d > 1)
      for (const side of [-1, 1]) {
        const zz = z + side * 1.84;
        for (const off of [-1.25, -0.6, 0, 0.6, 1.25])
          T(
            o,
            'gold',
            [
              [x + off - 0.08, y + 3.95, zz],
              [x + off + 0.08, y + 3.95, zz],
              [x + off, y + 4.12, zz],
            ],
            [0, 0, side],
          );
      }
  }
}
function build(o, _f, d = 3) {
  masonry(o, d);
  centralSteel(o, d);
  deck(o, d);
  rails(o, d);
  lamps(o, d);
  ornaments(o, d);
  entranceGroups(o, d);
}
export const arlingtonMemorialBridgeSkyline = (o, f) => build(o, f, 0),
  arlingtonMemorialBridgeDistrict = (o, f) => build(o, f, 1),
  arlingtonMemorialBridgeStreet = (o, f) => build(o, f, 2),
  arlingtonMemorialBridgeCloseup = (o, f) => build(o, f, 3);
export const arlingtonMemorialBridgeModel = {
  id: 'arlington_memorial_bridge',
  key: 'arlington_memorial_bridge',
  cell: 'dq/dqc',
  recipe: 'structure-arlington-memorial-bridge.mjs',
  title: 'Arlington Memorial Bridge',
  category: 'bridge',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-440, 205, 630],
  lookAt: [0, 6, 0],
  portableGroundY: -0.08,
  mediumFiContext: { scale: 1.1, groundY: -0.08 },
  qaCameras: [
    {
      name: 'full-eleven-span-crossing-two-road-arches-and-fixed-center',
      position: [-410, 170, 590],
      lookAt: [0, 6, 0],
      reviewLod: 'skyline',
    },
    {
      name: 'granite-vault-cutwaters-eagle-piers-balustrades-and-lamps',
      position: [120, 28, 82],
      lookAt: [125, 6, 1],
    },
    {
      name: 'fixed-steel-central-fascia-and-open-under-truss',
      position: [-9, 3, 55],
      lookAt: [-9, 7, 0],
    },
    {
      name: 'washington-entry-paired-gilded-horse-groups-and-ohio-road-arch',
      position: [376, 30, 64],
      lookAt: [306, 13, 2],
    },
    {
      name: 'west-end-gw-parkway-through-arch-and-continuous-sidewalks',
      position: [-365, 24, 65],
      lookAt: [-305, 6, 0],
    },
  ],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'proposal',
  groundContactBasis: `${p.geometryBasis} Independent1024m129square8mfield frozen beforegeometry, openPotomacproviderdatum1.1719m is not a surveyedwater/bridge threshold. Architecturalpier toeY0/roadgrade/camber/submergedembedment and actualhostcontact approximate.`,
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-arlington-memorial-bridge.mjs',
    level: 'skyline',
    export: 'arlingtonMemorialBridgeSkyline',
    errorMeters: 0.8,
    surfaces,
    authoredLevels: {
      district: { export: 'arlingtonMemorialBridgeDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'arlingtonMemorialBridgeStreet', errorMeters: 0.2, surfaces },
      closeup: { export: 'arlingtonMemorialBridgeCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    'Full11span bridge:8concrete river arches/2smaller road arches/currentfixedsteelcenter, sixlane road/twowalks/openrails/40globelamps, native8cutwaterpairs andbothgildedentrygroups. Native173point envelope represents ground/cutwater/terminal controls, not a single solid extruded deck. Roadmouthprofiles/archcrown/springs/gradecamber/railspindle and decorativeprofile census/hidden underside/figurative anatomical andfacialdetail approximate. Skyline omits lamps/relief anduses coarser solidrail masks; detailedlevels preserve openbalustrades andall40lamps.',
    'Two exactpublishedBenoitPrieur2012ownCC0bridgeoriginals plusone exactsupplementalownCC02012entrancepair individuallyinspected/nativeSHA1bound; Qualla-first39families/0ownershipconflicts, existinginventory/helperpasses. PublishedstatuephotoCC-BY-SAphotography/PDunderlyingsculpture mislabelnotused; DuaneLempkenon-owncredit andunrelatedgalleryphotos notadopted. No metadata/category/articlebody/imagery-policy changes, protectedofficialphoto/plan/video/3Dmodel, phototexture/generatedbitmap/downloadedmesh.',
    'PrimaryNPS2016EAtext gives2163ftwhole94ftwide/10concrete+centersteel/40lamps/60ftroad14ftwalks/eagleandbisonrelief/pairedentrygroups;2020NPStextconfirmsfixedsteel/retainedfascia. Fineornament/equestrianfigures simplified, no claim tosculptorlikeness or measuredsurfacecondition. No workingbascule, 2019construction, naturalriver/banks/nearbyroads/independentBoundaryChannelorHumpbackbridges/MemorialCircle/Avenue/LincolnMemorial/Watergatesteps/ArtsOfPeace/vehicles/people/interiors.',
    'Independent1024m129square8mfield/all16641values/PNG/sixoriginalTerrariumtiles frozenbeforegeometry unchanged. Providerdatum1.1719m/absolute-5.8242..10.8714m/sourcepixel3.7185732624479058m do not implysurveyaccuracy/bathymetry/threshold contact. No terrainfitting/flattening/reacquisition; actualhostcontactunverified, ordinarygeographicpreview/replacementdisabled. Flatreviewfixtures are not actualPotomac/banks/roads.',
  ],
};

/** Whole connected Fernberg mansion in its measured native frame. */
import './install-deterministic-math.mjs';
import fs from 'node:fs';
import earcut from 'earcut';
import { cross, normalFor } from './authored-structure-mesh.mjs';
import { rgb } from './landmark-model-helpers.mjs';

const dir = new URL(
    '../../../content/worldgen/source/places/r7/r7h/government_house_brisbane/',
    import.meta.url,
  ),
  p = JSON.parse(fs.readFileSync(new URL('plan-controls.json', dir))),
  A = p.parameters,
  F = A.floorY,
  O = p.outline.slice(0, -1),
  ref = 'palette:#ffffff',
  C = {
    wall: rgb('deded2'),
    trim: rgb('e5e3d8'),
    roof: rgb('434b50'),
    base: rgb('96968a'),
    iron: rgb('535851'),
    glass: rgb('455a57'),
  },
  surfaces = {
    wall: { slot: 'wall', graph: 'plaster_lime', roughness: 0.94, metallic: 0 },
    trim: { slot: 'trim', graph: 'stone_ashlar', roughness: 0.9, metallic: 0 },
    roof: { slot: 'roof', graph: 'slate', roughness: 0.84, metallic: 0 },
    base: { slot: 'foundation', graph: 'stone_sandstone_raw', roughness: 0.97, metallic: 0 },
    iron: { slot: 'door', graph: 'metal_painted', roughness: 0.72, metallic: 0.2 },
    glass: { slot: 'window', localRef: 'palette:#feffff', roughness: 0.35, metallic: 0.05 },
  };
function T(o, s, q, n, col = C[s]) {
  q = q.map((v) => v.map(Math.fround));
  const cr = cross(
    q[1].map((v, k) => v - q[0][k]),
    q[2].map((v, k) => v - q[0][k]),
  );
  if (Math.hypot(...cr) < 1e-8) return;
  if (n && cr.reduce((v, x, k) => v + x * n[k], 0) < 0) [q[1], q[2]] = [q[2], q[1]];
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
function flat(o, s, poly, y, holes = [], col = C[s]) {
  const pts = [...poly, ...holes.flat()],
    indices = [],
    starts = [];
  let k = poly.length;
  for (const h of holes) {
    starts.push(k);
    k += h.length;
  }
  indices.push(...earcut(pts.flat(), starts));
  for (let i = 0; i < indices.length; i += 3)
    T(
      o,
      s,
      indices.slice(i, i + 3).map((j) => [pts[j][0], y, pts[j][1]]),
      [0, 1, 0],
      col,
    );
}
function box(o, s, x, y, z, w, h, l, col = C[s]) {
  const v = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([i, j]) => [x + (i * w) / 2, y, z + (j * l) / 2]),
    u = v.map((q) => [q[0], y + h, q[2]]);
  Q(o, s, v.toReversed(), [0, -1, 0], col);
  Q(o, s, u, [0, 1, 0], col);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    Q(o, s, [v[i], v[j], u[j], u[i]], [v[j][2] - v[i][2], 0, v[i][0] - v[j][0]], col);
  }
}
function face(a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    L = Math.hypot(dx, dz),
    n = [dz / L, 0, -dx / L];
  return {
    L,
    n,
    P: (u, y, dep = 0) => [
      a[0] + (dx * u) / L + n[0] * dep,
      F + y,
      a[1] + (dz * u) / L + n[2] * dep,
    ],
  };
}
function patch(o, s, f, l, r, lo, hi, dep = 0, col = C[s]) {
  Q(o, s, [f.P(l, lo, dep), f.P(r, lo, dep), f.P(r, hi, dep), f.P(l, hi, dep)], f.n, col);
}
function arch(o, f, l, r, lo, hi, H, d, { open = false, s = 'wall' } = {}) {
  const c = (l + r) / 2,
    R = (r - l) / 2,
    spring = hi - R,
    N = [2, 4, 7, 12][d],
    a = Array.from({ length: N + 1 }, (_, i) => {
      const t = Math.PI - (i * Math.PI) / N;
      return [c + R * Math.cos(t), spring + R * Math.sin(t)];
    });
  patch(o, s, f, l, r, hi, H);
  for (let i = 0; i < N; i++)
    Q(
      o,
      s,
      [
        f.P(a[i][0], a[i][1]),
        f.P(a[i + 1][0], a[i + 1][1]),
        f.P(a[i + 1][0], hi),
        f.P(a[i][0], hi),
      ],
      f.n,
    );
  if (!open) {
    const P = [[l, lo], [r, lo], ...a.toReversed()],
      ids = earcut(P.flat());
    for (let i = 0; i < ids.length; i += 3)
      T(
        o,
        'glass',
        ids.slice(i, i + 3).map((k) => f.P(...P[k], -0.2)),
        f.n,
      );
  }
  if (d > 0) {
    for (let i = 0; i < N; i++) {
      Q(
        o,
        'trim',
        [
          f.P(...a[i], 0.045),
          f.P(...a[i + 1], 0.045),
          f.P(a[i + 1][0], a[i + 1][1] + 0.12, 0.045),
          f.P(a[i][0], a[i][1] + 0.12, 0.045),
        ],
        f.n,
      );
      if (d > 1)
        Q(
          o,
          'trim',
          [f.P(...a[i]), f.P(...a[i + 1]), f.P(...a[i + 1], -0.22), f.P(...a[i], -0.22)],
          null,
        );
    }
    for (const x of [l, r]) {
      patch(o, 'trim', f, x - 0.055, x + 0.055, lo, spring, 0.05);
      if (d > 1)
        Q(o, 'trim', [f.P(x, lo), f.P(x, spring), f.P(x, spring, -0.22), f.P(x, lo, -0.22)], null);
    }
    patch(o, 'trim', f, l - 0.12, r + 0.12, lo - 0.1, lo, 0.07);
    if (!open && d > 1) {
      patch(o, 'trim', f, c - 0.025, c + 0.025, lo, hi - 0.05, -0.16);
      for (let i = 1; i < (d === 3 ? 5 : 3); i++) {
        const y = lo + ((spring - lo) * i) / (d === 3 ? 5 : 3);
        patch(o, 'trim', f, l, r, y - 0.018, y + 0.018, -0.16);
      }
    }
  }
}
function facade(
  o,
  a,
  b,
  H,
  d,
  rows = [
    [0.85, 3.6],
    [5.5, 8.3],
  ],
) {
  const f = face(a, b),
    N = Math.max(1, Math.round(f.L / 3.3));
  if (f.L < 1.28) {
    patch(o, 'wall', f, 0, f.L, 0, H);
    return;
  }
  const w = Math.min(1.28, (f.L / N) * 0.57);
  if (d === 0) {
    patch(o, 'wall', f, 0, f.L, 0, H);
    for (let i = 0; i < N; i += 2)
      for (const [lo, hi] of rows)
        patch(
          o,
          'glass',
          f,
          ((i + 0.5) * f.L) / N - w / 2,
          ((i + 0.5) * f.L) / N + w / 2,
          lo,
          hi,
          0.018,
        );
    return;
  }
  if (d === 1) {
    patch(o, 'wall', f, 0, f.L, 0, H);
    for (let i = 0; i < N; i++)
      for (const [lo, hi] of rows) {
        const c = ((i + 0.5) * f.L) / N,
          l = c - w / 2,
          r = c + w / 2,
          arc = Array.from({ length: 5 }, (_, k) => {
            const t = Math.PI - (k * Math.PI) / 4;
            return [c + (w / 2) * Math.cos(t), hi - w / 2 + (w / 2) * Math.sin(t)];
          }),
          P = [[l, lo], [r, lo], ...arc.toReversed()],
          ids = earcut(P.flat());
        for (let k = 0; k < ids.length; k += 3)
          T(
            o,
            'glass',
            ids.slice(k, k + 3).map((j) => f.P(...P[j], 0.02)),
            f.n,
          );
        patch(o, 'trim', f, l - 0.1, r + 0.1, lo - 0.1, lo, 0.04);
        patch(o, 'trim', f, l - 0.08, r + 0.08, hi, hi + 0.12, 0.04);
      }
    return;
  }
  for (let i = 0; i < N; i++) {
    const c = ((i + 0.5) * f.L) / N,
      l = c - w / 2,
      r = c + w / 2;
    patch(o, 'wall', f, (i * f.L) / N, l, 0, H);
    patch(o, 'wall', f, r, ((i + 1) * f.L) / N, 0, H);
    let last = 0;
    for (const [lo, hi] of rows) {
      patch(o, 'wall', f, l, r, last, lo);
      arch(o, f, l, r, lo, hi, Math.min(H, hi + 0.15), d);
      last = hi + 0.15;
    }
    patch(o, 'wall', f, l, r, last, H);
  }
}
const body = [...O.slice(0, 32), [0, 14.45], [0, 6.85], O[40]],
  court = A.court;
function strip(o, s, a, b, y, h, w = 0.14, col = C[s]) {
  const f = face(a, b);
  Q(
    o,
    s,
    [f.P(0, y, w / 2), f.P(f.L, y, w / 2), f.P(f.L, y + h, w / 2), f.P(0, y + h, w / 2)],
    f.n,
    col,
  );
  Q(
    o,
    s,
    [f.P(f.L, y, -w / 2), f.P(0, y, -w / 2), f.P(0, y + h, -w / 2), f.P(f.L, y + h, -w / 2)],
    f.n.map((x) => -x),
    col,
  );
  Q(
    o,
    s,
    [f.P(0, y + h, -w / 2), f.P(f.L, y + h, -w / 2), f.P(f.L, y + h, w / 2), f.P(0, y + h, w / 2)],
    [0, 1, 0],
    col,
  );
}
function balustrade(o, a, b, y, d) {
  if (d > 0) strip(o, 'trim', a, b, y, 0.13, 0.22);
  strip(o, 'trim', a, b, y + 0.9, 0.13, 0.23);
  if (d === 0) return;
  const f = face(a, b),
    N = Math.max(2, Math.round(f.L / (d === 1 ? 1.1 : 0.48)));
  for (let i = 0; i <= N; i++) {
    const q = f.P((i * f.L) / N, y + 0.12);
    if (d === 1)
      Q(
        o,
        'trim',
        [
          [q[0] - 0.055, q[1], q[2]],
          [q[0] + 0.055, q[1], q[2]],
          [q[0] + 0.055, q[1] + 0.8, q[2]],
          [q[0] - 0.055, q[1] + 0.8, q[2]],
        ],
        null,
      );
    else {
      box(o, 'trim', q[0], q[1], q[2], 0.13, 0.77, 0.13);
      if (d === 3) box(o, 'trim', q[0], q[1] + 0.3, q[2], 0.2, 0.2, 0.2);
    }
  }
}
function band(o, a, b, y, d) {
  const f = face(a, b);
  patch(o, 'trim', f, 0, f.L, y, y + 0.22, 0.09);
  if (d > 1) patch(o, 'trim', f, 0, f.L, y - 0.07, y, 0.15);
}
function walls(o, d) {
  flat(o, 'base', body, F, [court]);
  for (let i = 0; i < body.length; i++) {
    const a = body[i],
      b = body[(i + 1) % body.length],
      f = face(a, b);
    patch(o, 'base', f, 0, f.L, A.foundationBottom - F, 0, 0.005);
    const H = Math.min(a[1], b[1]) > 20.9 ? A.originalWingEave : A.mainEave;
    facade(o, a, b, H, d);
    if (d > 0) band(o, a, b, A.upperFloor - 0.25, d);
    band(o, a, b, H - 0.1, d);
    if (d > 1 && f.L > 3) {
      for (const u of [0, f.L - 0.3])
        for (let y = 0.3; y < H - 0.4; y += 0.68)
          patch(o, 'trim', f, u, u + 0.3, y, y + 0.33, 0.045);
    }
  }
  for (let i = 0; i < court.length; i++) {
    const a = court[i],
      b = court[(i + 1) % court.length];
    facade(o, b, a, A.originalWingEave, d, [
      [0.9, 3.4],
      [5.35, 7.85],
    ]);
  }
  flat(o, 'base', court, F - 0.12);
}
function hip(o, x0, x1, z0, z1, eave, rise, d) {
  const dx = x1 - x0,
    dz = z1 - z0,
    inset = Math.min(dx, dz) * 0.36,
    v = [
      [x0, eave, z0],
      [x1, eave, z0],
      [x1, eave, z1],
      [x0, eave, z1],
    ],
    r =
      dx > dz
        ? [
            [x0 + inset, eave + rise, (z0 + z1) / 2],
            [x1 - inset, eave + rise, (z0 + z1) / 2],
          ]
        : [
            [(x0 + x1) / 2, eave + rise, z0 + inset],
            [(x0 + x1) / 2, eave + rise, z1 - inset],
          ],
    P =
      dx > dz
        ? [
            [v[0], v[1], r[1], r[0]],
            [v[1], v[2], r[1]],
            [v[2], v[3], r[0], r[1]],
            [v[3], v[0], r[0]],
          ]
        : [
            [v[0], v[1], r[0]],
            [v[1], v[2], r[1], r[0]],
            [v[2], v[3], r[1]],
            [v[3], v[0], r[0]],
          ];
  for (const q of P) {
    if (q.length === 3) T(o, 'roof', q, [0, 1, 0]);
    else Q(o, 'roof', q, [0, 1, 0]);
  }
  if (d > 1) {
    const K = d === 3 ? 10 : 5;
    for (const q of P) {
      if (q.length !== 4) continue;
      for (let k = 1; k < K; k++) {
        const t = k / K,
          a = q[0].map((v, i) => v + (q[3][i] - v) * t),
          b = q[1].map((v, i) => v + (q[2][i] - v) * t);
        Q(
          o,
          'roof',
          [
            [a[0], a[1] + 0.01, a[2]],
            [b[0], b[1] + 0.01, b[2]],
            [b[0], b[1] + 0.013, b[2] + 0.025],
            [a[0], a[1] + 0.013, a[2] + 0.025],
          ],
          [0, 1, 0],
          rgb('545c60'),
        );
      }
    }
  }
}
function roofs(o, d) {
  flat(
    o,
    'roof',
    [
      [0, 0],
      [15.2, 0],
      [15.2, 14.6],
      [0, 14.6],
    ],
    F + 9.15,
  );
  hip(o, 1, 14, 2.0, 13.5, F + 9.15, 0.5, d);
  hip(o, 15, 32, 0, 12.7, F + 9.2, 2.0, d);
  hip(o, 15, 27.2, 12.6, 16.2, F + 8.6, 1.1, d);
  hip(o, 12, 21.6, 16, 21.2, F + 8.6, 1.4, d);
  // Four roof strips preserve the documented open rear court instead of bridging it.
  hip(o, 1.2, 5.3, 14.4, 33, F + A.originalWingEave, 1.15, d);
  hip(o, 12, 15.8, 14.4, 33, F + A.originalWingEave, 1.1, d);
  hip(o, 5.3, 12, 14.4, 18, F + A.originalWingEave, 1.2, d);
  hip(o, 5.3, 12, 27, 33, F + A.originalWingEave, 1.4, d);
  // The raised slate roof/paired arched clerestory of the old guest wing.
  if (d === 0) box(o, 'wall', 7.4, F + 9.45, 29.9, 3.5, 2.2, 2.7);
  hip(o, 5.5, 9.3, 28.4, 31.4, F + 11.65, 0.75, d);
  if (d > 0) {
    for (const [a, b] of [
      [
        [5.65, 28.54],
        [9.15, 28.54],
      ],
      [
        [9.15, 31.26],
        [5.65, 31.26],
      ],
    ]) {
      const f = face(a, b);
      patch(o, 'wall', f, 0, f.L, 9.45, 9.75);
      for (const [l, r] of [
        [0, 0.25],
        [1.55, 1.9],
        [3.2, 3.5],
      ])
        patch(o, 'wall', f, l, r, 9.75, 11.65);
      for (let i = 0; i < 2; i++)
        arch(o, f, 0.25 + i * 1.65, 1.55 + i * 1.65, 9.75, 11.4, 11.65, d);
    }
    for (const [a, b] of [
      [
        [5.65, 31.26],
        [5.65, 28.54],
      ],
      [
        [9.15, 28.54],
        [9.15, 31.26],
      ],
    ])
      patch(o, 'wall', face(a, b), 0, 2.72, 9.45, 11.65);
  }
  for (const [a, b] of [
    [
      [0, 0],
      [5.6, 0],
    ],
    [
      [10.5, 0],
      [15.2, 0],
    ],
    [
      [0, 14.45],
      [0, 0],
    ],
    [
      [15.2, 0],
      [15.2, 14.4],
    ],
  ]) {
    band(o, a, b, 9.15, d);
    balustrade(o, a, b, 9.35, d);
    if (d > 1) {
      const f = face(a, b),
        N = Math.round(f.L / 0.5);
      for (let i = 0; i < N; i++) {
        const q = f.P(((i + 0.5) * f.L) / N, 8.98, 0.08);
        box(o, 'trim', q[0], q[1], q[2], 0.12, 0.2, 0.25);
      }
    }
  }
  for (const [x, z] of [
    [2, 5],
    [13.7, 8],
    [17, 10],
    [2.8, 27],
  ]) {
    box(o, 'wall', x, F + 9.3, z, 0.68, 1.4, 0.8);
    if (d > 0) box(o, 'trim', x, F + 10.65, z, 0.86, 0.18, 1.0);
  }
}
function tower(o, d) {
  const x0 = 5.65,
    x1 = 10.46,
    z0 = -3.26,
    z1 = 1.5,
    ring = [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
    ];
  for (let i = 0; i < 4; i++) {
    const a = ring[i],
      b = ring[(i + 1) % 4],
      f = face(a, b),
      mid = f.L / 2;
    if (d === 0) {
      patch(o, 'wall', f, 0, f.L, 9.2, 12.25);
      for (const u of [1.2, f.L - 1.2]) patch(o, 'glass', f, u - 0.38, u + 0.38, 9.8, 11.7, 0.02);
    } else {
      patch(o, 'wall', f, 0, f.L, 9.2, 9.55);
      patch(o, 'wall', f, 0, 0.45, 9.55, 12.25);
      patch(o, 'wall', f, f.L - 0.45, f.L, 9.55, 12.25);
      patch(o, 'wall', f, mid - 0.25, mid + 0.25, 9.55, 12.25);
      for (const [l, r] of [
        [0.55, mid - 0.35],
        [mid + 0.35, f.L - 0.55],
      ]) {
        patch(o, 'wall', f, l, r, 9.55, 9.8);
        arch(o, f, l, r, 9.8, 11.7, 12.25, d);
      }
    }
    band(o, a, b, 12.25, d);
    patch(o, 'trim', f, 0, f.L, 12.25, 12.6);
    const N = 2,
      space = 0.4,
      w = (f.L - 3 * space) / N;
    for (let k = 0; k < N; k++) {
      const l = space + (w + space) * k,
        r = l + w;
      patch(o, 'wall', f, l - space, l, 12.5, 15.1);
      arch(o, f, l, r, 12.6, 14.75, 15.1, d, { open: true });
      balustrade(
        o,
        f.P(l, 0).filter((_, k) => k !== 1),
        f.P(r, 0).filter((_, k) => k !== 1),
        12.55,
        d,
      );
    }
    patch(o, 'wall', f, f.L - space, f.L, 12.5, 15.1);
    band(o, a, b, 15.1, d);
    patch(o, 'trim', f, 0, f.L, 15.1, 15.42);
    if (d > 1)
      for (const u of [0.05, f.L - 0.22]) patch(o, 'trim', f, u, u + 0.17, 12.55, 15.1, 0.05);
  }
  flat(o, 'base', ring, F + 12.55);
  hip(o, x0 - 0.4, x1 + 0.4, z0 - 0.4, z1 + 0.4, F + 15.42, 1.1, d);
  box(o, 'iron', 8.055, F + 16.52, -0.88, 0.08, 2.3, 0.08);
}
function veranda(o, d) {
  const x0 = -3.45,
    x1 = 0.05,
    z0 = 6.8,
    z1 = 20.8;
  box(o, 'base', (x0 + x1) / 2, F - 0.16, (z0 + z1) / 2, x1 - x0, 0.16, z1 - z0);
  Q(
    o,
    'roof',
    [
      [x0, F + 3.93, z0],
      [x1, F + 4.38, z0],
      [x1, F + 4.38, z1],
      [x0, F + 3.93, z1],
    ],
    [0, 1, 0],
  );
  for (let i = 0; i < 5; i++) {
    const z = z0 + (i * (z1 - z0)) / 4;
    for (const x of d > 0 ? [x0 + 0.1, x0 + 0.33] : [x0 + 0.15]) {
      box(o, 'trim', x, F, z, 0.1, 3.93, 0.1);
      if (d > 1) {
        box(o, 'trim', x, F + 3.6, z, 0.2, 0.15, 0.2);
        box(o, 'base', x, F, z, 0.2, 0.28, 0.2);
      }
    }
  }
  strip(o, 'trim', [x0, z0], [x0, z1], 3.85, 0.2, 0.22);
  const cp = [O[32], O[33], O[34], O[35], O[36], O[37], O[38], O[31]],
    top = F + 3.45;
  flat(o, 'roof', cp, top);
  for (let i = 0; i < cp.length; i++)
    strip(o, 'trim', cp[i], cp[(i + 1) % cp.length], 3.25, 0.23, 0.15);
  for (const q of [O[34], O[36], O[37], O[38]])
    box(o, 'trim', q[0], -0.6, q[1], 0.18, top + 0.6, 0.18);
  if (d > 0) {
    const p0 = O[37],
      p1 = O[36];
    for (let k = 1; k <= 5; k++) {
      const t = k / 6;
      box(o, 'base', p0[0] - 0.5, F - k * 0.18, p0[1] + (p1[1] - p0[1]) * t, 0.9, 0.18, 0.9);
    }
  }
}
function bayBalconies(o, d) {
  if (d === 0) return;
  for (const ids of [
    [1, 2, 3, 4],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
  ]) {
    const poly = ids.map((i) => O[i]);
    flat(o, 'base', poly, F + A.upperFloor);
    for (let j = 0; j < poly.length - 1; j++)
      balustrade(o, poly[j], poly[j + 1], A.upperFloor + 0.05, d);
    const a = poly[0],
      b = poly.at(-1),
      f = face(a, b);
    Q(
      o,
      'iron',
      [f.P(0, 7.95, 0.05), f.P(f.L, 7.95, 0.05), f.P(f.L, 8.18, -0.65), f.P(0, 8.18, -0.65)],
      [0, 1, 0],
      rgb('73504c'),
    );
  }
}
function build(o, _frame, d = 3) {
  walls(o, d);
  roofs(o, d);
  tower(o, d);
  veranda(o, d);
  bayBalconies(o, d);
}
export function brisbaneGovernmentHouseCounts(d) {
  const counts = {};
  for (const fn of [walls, roofs, tower, veranda, bayBalconies]) {
    let n = 0;
    fn(
      {
        addTriangle() {
          n++;
        },
      },
      d,
    );
    counts[fn.name] = n;
  }
  return counts;
}
export const brisbaneGovernmentHouseSkyline = (o, f) => build(o, f, 0),
  brisbaneGovernmentHouseDistrict = (o, f) => build(o, f, 1),
  brisbaneGovernmentHouseStreet = (o, f) => build(o, f, 2),
  brisbaneGovernmentHouseCloseup = (o, f) => build(o, f, 3);
export const brisbaneGovernmentHouseModel = {
  id: 'government_house_brisbane',
  key: 'government_house_brisbane',
  cell: 'r7/r7h',
  recipe: 'structure-government-house-brisbane.mjs',
  title: 'Government House, Brisbane',
  category: 'residence',
  progressLedger: 'qualla-002.PROGRESS.md',
  build,
  surfaces,
  brief: p.authoringDirection,
  camera: [-44, 27, -43],
  lookAt: [8, 6, 14],
  quality: 'medium-fi-exterior',
  reviewStatus: 'review-in-qa.json',
  geographicStatus: 'preview-proposal',
  groundContactBasis: `${p.geometryBasis} ${p.baseDecision}`,
  qaCameras: [
    {
      name: 'whole-connected-mansion-north-tower-verandahs-bays-and-rear-wings',
      position: [-44, 27, -43],
      lookAt: [8, 6, 14],
      reviewLod: 'skyline',
    },
    {
      name: 'north-faceted-bays-classical-tower-loggia-and-balustraded-parapet',
      position: [18, 11, -24],
      lookAt: [10, 7, 0],
    },
    {
      name: 'western-open-veranda-and-covered-porte-cochere',
      position: [-24, 7, 5],
      lookAt: [-2, 3, 12],
    },
    {
      name: 'southern-original-wing-slate-hip-clerestory-and-open-court',
      position: [15, 27, 49],
      lookAt: [10, 7, 23],
    },
    {
      name: 'eastern-1937-wing-bay-and-bracketed-white-stucco',
      position: [47, 13, -8],
      lookAt: [23, 5, 7],
    },
    {
      name: 'open-upper-tower-loggia-arched-openings-and-shallow-hip',
      position: [17, 17, -13],
      lookAt: [8, 14, -1],
    },
  ],
  runtimeLodOverlay: {
    module: 'packages/worldgen/scripts/structure-government-house-brisbane.mjs',
    level: 'skyline',
    export: 'brisbaneGovernmentHouseSkyline',
    errorMeters: 0.85,
    surfaces,
    authoredLevels: {
      district: { export: 'brisbaneGovernmentHouseDistrict', errorMeters: 0.4, surfaces },
      street: { export: 'brisbaneGovernmentHouseStreet', errorMeters: 0.12, surfaces },
      closeup: { export: 'brisbaneGovernmentHouseCloseup', errorMeters: 0, surfaces },
    },
  },
  limitations: [
    p.geometryBasis,
    p.baseDecision,
    'Whole connected native mansion perimeter, with original southern wing/1888 north reception block and prominent square tower/1937 east wing/integral western covered connection. Separate estate buildings, grounds/gates/statues/fountain/pool/vegetation, interiors, flags and figured crests/stained-glass imagery excluded.',
    'Four exact cleared published exterior originals (Figaro2005 named public-domain release and McPherson2022 ownCC0), plus two exact native circa1940 QueenslandStateArchives government architectural drawings/explicit PD-AustraliaGov grant. Missing local plan-category evidence is bound independently to exact native archive items without changing article/media metadata. No generated bitmap, doubtful photograph, licensed pixel or borrowed mesh.',
    'White stucco/quoins/cornice/balustraded parapet, faceted bays/awning balcony ends, segmental sash openings, genuine open upper tower loggia and veranda/porte-cochere supports; six actual canonical slots/five shared graphs. Slate roof topology/fine pitches, exact sash/baluster/vent census and hidden facade details are bounded medium-fi interpretations, not measured survey.',
    'Historic plans establish an open rear court, retained instead of inventing a solid roof across it. Current mapped perimeter has no court ring; exact current inner court dimensions/later covering/roof joins remain unverified. Roof strips and raised paired-arched guest-wing clerestory follow photographs and historical topology with estimated dimensions.',
    'Fixed independent16641value field/raw tile/heightPNG frozen before geometry and unchanged. Floor/basement contacts estimated, geographic preview only/replacementfalse; no flattening/fitting of source terrain or certified construction contact. Full architecture/four LODs/current material/context/native-outline views reviewed in same pass.',
  ],
};

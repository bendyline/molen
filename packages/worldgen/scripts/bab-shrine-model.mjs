/** shrine_of_the_bab: ribbed gold dome, eighteen-window drum and open stone arcade. */
import earcut from 'earcut';
export const babCandidateId = 'shrine_of_the_bab';
function prism(f, role, p, lo, hi) {
  const rings = [p.outline, ...(p.holes ?? [])],
    flat = rings.flat(),
    holes = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(k);
    k += h.length;
  }
  const ix = earcut(flat.flat(), holes),
    low = flat.map(([x, z]) => [x, lo, z]),
    high = flat.map(([x, z]) => [x, hi, z]);
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((k) => low[k]),
      [0, -1, 0],
    );
    f(
      role,
      ix.slice(i, i + 3).map((k) => high[k]),
      [0, 1, 0],
    );
  }
  let o = 0;
  for (let r = 0; r < rings.length; r++) {
    const p = rings[r],
      a = p.reduce((n, a, i) => {
        const b = p[(i + 1) % p.length];
        return n + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sgn = Math.sign(a) * (r ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      f(
        role,
        [low[o + i], low[o + j], high[o + j], high[o + i]],
        [(p[j][1] - p[i][1]) * sgn, 0, (p[i][0] - p[j][0]) * sgn],
      );
    }
    o += p.length;
  }
}
const rect = (x, z, w, d) => ({
  outline: [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  holes: [],
});
function lathe(f, role, x, z, profile, n, flutes = 0) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        rr = r * (1 - (flutes ? (0.028 * (1 + Math.cos(a * flutes))) / 2 : 0));
      return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
    }),
  );
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      f(
        role,
        [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  f(role, rings[0], [0, -1, 0]);
  f(role, rings.at(-1), [0, 1, 0]);
}
function beam(f, role, a, b, w, h = w) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    len = Math.hypot(dx, dz),
    u = [((-dz / len) * w) / 2, 0, ((dx / len) * w) / 2],
    p = [
      a.map((v, i) => v + u[i]),
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
    ],
    q = p.map((p) => [p[0], p[1] + h, p[2]]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [p[i], p[j], q[j], q[i]], [p[j][2] - p[i][2], 0, p[i][0] - p[j][0]]);
  }
  f(role, p, [0, -1, 0]);
  f(role, q, [0, 1, 0]);
}
function leaf(f, x, z, y, a, tier) {
  const c = Math.cos(a),
    s = Math.sin(a),
    shape = [
      [-0.13, 0, 0.42],
      [0.13, 0, 0.42],
      [-0.17, 0.28, 0.63],
      [0.17, 0.28, 0.63],
      [0, 0.5, 0.76],
      [0, 0.3, 0.72],
    ],
    p = shape.map(([u, v, r]) => [x + c * r - s * u, y + v, z + s * r + c * u]);
  for (const ids of [
    [0, 1, 5],
    [1, 3, 5],
    [3, 4, 5],
    [4, 2, 5],
    [2, 0, 5],
    [0, 2, 4, 3, 1],
  ])
    f(
      'stone',
      ids.map((i) => p[i]),
      [c, 0.25 + 2 * tier, s],
    );
}
export function buildBabShrine(face, detail, r) {
  const a = r.architecturalAngleRadians,
    c = Math.cos(a),
    s = Math.sin(a),
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, r.floorY + y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    B = (g, role, x, y, z, w, h, d) => prism(g, role, rect(x, z, w, d), y, y + h),
    box = (role, x, y, z, w, h, d) => B(f, role, x, y, z, w, h, d),
    w = r.width,
    d = r.depth,
    n = [4, 4, 8, 12][detail],
    segments = [1, 2, 5, 8][detail],
    base = r.foundationBase - r.floorY;
  // Closed level floor and buried terrace support, kept just outside the mapped arcade.
  prism(f, 'stone', rect(0, 0, w + 2.6, d + 2.6), base, 0);
  box('stone', 0, 0, 0, w + 2.9, 0.16, d + 2.9);
  box('stone', 0, 0.16, 0, w - 6, 6.12, d - 6);
  box('stone', 0, 6.25, 0, w + 0.2, 0.48, d + 0.2);
  if (detail === 0) box('stone', 0, 6.73, 0, w + 0.5, 0.8, d + 0.5);
  else for (const y of [6.73, 7.0, 7.27]) box('stone', 0, y, 0, w + 0.5, 0.28, d + 0.5);
  const rows = [
    { count: 14, length: w, span: d, rotation: 0 },
    { count: 12, length: d, span: w, rotation: Math.PI / 2 },
  ];
  for (const row of rows)
    for (const side of [-1, 1]) {
      const co = Math.cos(row.rotation),
        si = Math.sin(row.rotation),
        P = ([u, y, v]) => [co * u - si * v, y, si * u + co * v],
        N = ([u, y, v]) => [co * u - si * v, y, si * u + co * v],
        G = (role, ps, n) => f(role, ps.map(P), N(n)),
        z = side * (row.span / 2 - 0.42),
        step = (row.length - 0.84) / row.count;
      for (let k = 1; k < row.count; k++) {
        const x = -row.length / 2 + 0.42 + k * step;
        if (detail === 0) {
          const p = rect(x, z, 0.48, 0.48).outline;
          for (let i = 0; i < 4; i++) {
            const q = p[(i + 1) % 4],
              t = p[i];
            G(
              'pink',
              [
                [t[0], 0.08, t[1]],
                [q[0], 0.08, q[1]],
                [q[0], 5.8, q[1]],
                [t[0], 5.8, t[1]],
              ],
              [q[1] - t[1], 0, t[0] - q[0]],
            );
          }
        } else
          lathe(
            G,
            'pink',
            x,
            z,
            detail === 1
              ? [
                  [0.08, 0.39],
                  [5.1, 0.25],
                  [5.8, 0.43],
                ]
              : [
                  [0.08, 0.4],
                  [0.2, 0.45],
                  [0.35, 0.33],
                  [0.45, 0.26],
                  [4.9, 0.24],
                  [5.1, 0.36],
                  [5.35, 0.42],
                  [5.8, 0.44],
                ],
            n,
          );
        if (detail >= 2)
          for (let tier = 0; tier < (detail === 3 ? 2 : 1); tier++)
            for (let j = 0; j < 8; j++)
              leaf(G, x, z, 5.12 + tier * 0.22, (j * Math.PI) / 4 + (tier * Math.PI) / 8, tier);
      }
      if (detail > 0)
        for (let k = 0; k < row.count; k++) {
          const x0 = -row.length / 2 + 0.42 + k * step,
            archY = (t) => 5.15 + 0.95 * (1 - 0.6 * Math.abs(t) - 0.4 * t * t);
          for (let i = 0; i < segments; i++) {
            const t0 = -1 + (2 * i) / segments,
              t1 = -1 + (2 * (i + 1)) / segments,
              u = x0 + ((t0 + 1) * step) / 2,
              v = x0 + ((t1 + 1) * step) / 2,
              lo = archY(t0),
              hi = archY(t1);
            for (const zz of [z - 0.3, z + 0.3])
              G(
                'stone',
                [
                  [u, lo, zz],
                  [v, hi, zz],
                  [v, 6.28, zz],
                  [u, 6.28, zz],
                ],
                [0, 0, Math.sign(zz - z)],
              );
            G(
              'stone',
              [
                [u, lo, z - 0.3],
                [v, hi, z - 0.3],
                [v, hi, z + 0.3],
                [u, lo, z + 0.3],
              ],
              [0, -1, 0],
            );
            G(
              'stone',
              [
                [u, 6.28, z - 0.3],
                [v, 6.28, z - 0.3],
                [v, 6.28, z + 0.3],
                [u, 6.28, z + 0.3],
              ],
              [0, 1, 0],
            );
          }
        }
    }
  for (const x of [-w / 2 + 0.42, w / 2 - 0.42])
    for (const z of [-d / 2 + 0.42, d / 2 - 0.42]) box('stone', x, 0.16, z, 0.85, 6.1, 0.85);
  // Small opaque shrine doors behind the deep covered walk; no furnished sanctuary.
  if (detail >= 1)
    for (const z of [-(d - 6) / 2 - 0.01, (d - 6) / 2 + 0.01])
      for (const x of [-7, 0, 7]) {
        box('blue', x, 0.3, z, 1.55, 3.7, 0.04);
        for (const side of [-1, 1]) box('stone', x + side * 0.86, 0.2, z, 0.16, 4, 0.15);
        box('stone', x, 4.05, z, 2, 0.18, 0.2);
      }
  // Open flat roof terrace, octagonal middle stage and its corner pinnacles.
  lathe(
    f,
    'stone',
    0,
    0,
    [
      [7.5, 9.3],
      [7.8, 9.5],
      [8.1, 9.15],
      [11.8, 9.15],
      [12.1, 9.55],
    ],
    8,
  );
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4 + Math.PI / 8,
      cc = Math.cos(ang),
      ss = Math.sin(ang),
      G = (role, ps, n) =>
        f(
          role,
          ps.map(([u, y, v]) => [cc * v - ss * u, y, ss * v + cc * u]),
          [cc * n[2] - ss * n[0], n[1], ss * n[2] + cc * n[0]],
        );
    if (detail >= 1) {
      B(G, 'turquoise', 0, 10.65, 8.54, 5.5, 0.55, 0.14);
      G(
        'blue',
        [
          [-0.7, 8.5, 8.54],
          [0.7, 8.5, 8.54],
          [0.7, 10.6, 8.54],
          [0, 11.15, 8.54],
          [-0.7, 10.6, 8.54],
        ],
        [0, 0, 1],
      );
    }
    lathe(
      f,
      'stone',
      cc * 9.25,
      ss * 9.25,
      detail <= 1
        ? [
            [12.1, 0.32],
            [15, 0.01],
          ]
        : [
            [12.1, 0.33],
            [12.45, 0.46],
            [13.3, 0.3],
            [14.5, 0.15],
            [15, 0.015],
          ],
      detail <= 1 ? 4 : 8,
    );
  }
  lathe(
    f,
    'stone',
    0,
    0,
    [
      [12.1, 6.65],
      [20.45, 6.65],
      [20.85, 7.1],
    ],
    detail === 0 ? 12 : 36,
  );
  if (detail >= 1)
    for (let k = 0; k < 18; k++) {
      const ang = (k * Math.PI * 2) / 18,
        cc = Math.cos(ang),
        ss = Math.sin(ang),
        G = (role, ps, n) =>
          f(
            role,
            ps.map(([u, y, v]) => [cc * v - ss * u, y, ss * v + cc * u]),
            [cc * n[2] - ss * n[0], n[1], ss * n[2] + cc * n[0]],
          ),
        p = [
          [-0.6, 13.15],
          [0.6, 13.15],
          [0.6, 18.9],
          [0, 19.55],
          [-0.6, 18.9],
        ];
      G(
        'blue',
        p.map(([u, y]) => [u, y, 6.68]),
        [0, 0, 1],
      );
      if (detail === 1) {
        for (const u of [-0.75, 0.75])
          G(
            'stone',
            [
              [u - 0.075, 13, 6.87],
              [u + 0.075, 13, 6.87],
              [u + 0.075, 19.1, 6.87],
              [u - 0.075, 19.1, 6.87],
            ],
            [0, 0, 1],
          );
        for (const side of [-1, 1])
          G(
            'stone',
            [
              [side * 0.75, 19.1, 6.87],
              [0, 19.8, 6.87],
              [0, 19.96, 6.87],
              [side * 0.75, 19.26, 6.87],
            ],
            [0, 0, 1],
          );
      } else {
        for (const u of [-0.75, 0.75]) B(G, 'stone', u, 13, 6.87, 0.15, 6.4, 0.35);
        beam(G, 'stone', [-0.75, 19.1, 6.87], [0, 19.8, 6.87], 0.14, 0.16);
        beam(G, 'stone', [0, 19.8, 6.87], [0.75, 19.1, 6.87], 0.14, 0.16);
      }
      if (detail >= 2) {
        for (const y of detail === 2 ? [14.7, 16.3, 18] : [14.4, 15.7, 17, 18.3])
          B(G, 'stone', 0, y, 6.71, 1.18, 0.045, 0.035);
        B(G, 'stone', 0, 13.2, 6.72, 0.045, 6, 0.035);
      }
    }
  const domeR = 7.35,
    domeH = 7.65,
    spring = 20.75,
    bands = [4, 6, 10, 14][detail],
    radial = [12, 24, 36, 48][detail],
    profile = Array.from({ length: bands + 1 }, (_, i) => {
      const t = (i * Math.PI) / 2 / bands;
      return [spring + domeH * Math.sin(t), Math.max(0.025, domeR * Math.cos(t))];
    });
  lathe(f, 'gold', 0, 0, profile, radial);
  if (detail >= 2)
    for (let k = 0; k < 18; k++) {
      const a = (k * Math.PI * 2) / 18;
      for (let j = 0; j < bands; j++) {
        const p = [j, j + 1].map((i) => {
          const t = (i * Math.PI) / 2 / bands;
          return { y: spring + domeH * Math.sin(t), r: domeR * Math.cos(t) + 0.045 };
        });
        const points = p.flatMap((q) =>
          [-0.005, 0.005].map((da) => [q.r * Math.cos(a + da), q.y, q.r * Math.sin(a + da)]),
        );
        f('stone', [points[0], points[1], points[3], points[2]], [Math.cos(a), 0.3, Math.sin(a)]);
      }
    }
  if (detail >= 1)
    for (let k = 0; k < 18; k++) {
      const a = (k * Math.PI * 2) / 18,
        P = (t, dy) => {
          const r = domeR * Math.cos(t) + 0.065;
          return [r * Math.cos(a + dy), spring + domeH * Math.sin(t), r * Math.sin(a + dy)];
        };
      f('stone', [P(0.13, -0.035), P(0.13, 0.035), P(0.28, 0)], [Math.cos(a), 0.25, Math.sin(a)]);
    }
  lathe(
    f,
    'stone',
    0,
    0,
    [
      [28.4, 0.25],
      [28.65, 0.4],
      [28.8, 0.25],
    ],
    detail <= 1 ? 4 : 8,
  );
  if (detail === 0)
    lathe(
      f,
      'stone',
      0,
      0,
      [
        [28.8, 0.22],
        [30.8, 0.01],
      ],
      4,
    );
  else {
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      lathe(
        f,
        'stone',
        0.25 * Math.cos(a),
        0.25 * Math.sin(a),
        [
          [28.8, 0.045],
          [30, 0.045],
        ],
        6,
      );
    }
    lathe(
      f,
      'gold',
      0,
      0,
      [
        [30, 0.45],
        [30.15, 0.25],
        [30.8, 0.025],
      ],
      12,
    );
  }
  const steps = detail === 0 ? 6 : 12,
    run = 6.1,
    rise = r.approachRise;
  for (let k = 0; k < steps; k++)
    box(
      'stone',
      0,
      base,
      -d / 2 - 1.3 - ((k + 0.5) * run) / steps,
      5.4,
      -base - (rise * (k + 1)) / steps,
      run / steps + 0.03,
    );
}

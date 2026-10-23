/** Iftar bower: six slender posts, gilded curved canopy and low stone baluster guards. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiIftar(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    Y = r.floorY,
    p = r.parent.outline,
    lathe = (role, x, z, profile, N) => {
      const rings = profile.map(([y, R]) =>
        Array.from({ length: N }, (_, i) => [
          x + R * Math.cos((i * 2 * Math.PI) / N),
          y,
          z + R * Math.sin((i * 2 * Math.PI) / N),
        ]),
      );
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < N; i++) {
          const k = (i + 1) % N;
          f(
            role,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - x, 0.001, rings[j][i][2] - z],
          );
        }
      for (const [ring, s] of [
        [rings[0], -1],
        [rings.at(-1), 1],
      ])
        for (let i = 1; i < N - 1; i++) f(role, [ring[0], ring[i], ring[i + 1]], [0, s, 0]);
    },
    line = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        tx = (b[0] - a[0]) / L,
        tz = (b[1] - a[1]) / L,
        nx = tz,
        nz = -tx;
      return {
        L,
        emit: (role, ps, n) =>
          f(
            role,
            ps.map(([u, y, d]) => [a[0] + tx * u + nx * d, y, a[1] + tz * u + nz * d]),
            [tx * n[0] + nx * n[2], n[1], tz * n[0] + nz * n[2]],
          ),
      };
    },
    strip = (G, A, B, w, d) => {
      const dx = B[0] - A[0],
        dy = B[1] - A[1],
        L = Math.hypot(dx, dy),
        nx = ((-dy / L) * w) / 2,
        ny = ((dx / L) * w) / 2,
        q = [
          [A[0] + nx, A[1] + ny],
          [B[0] + nx, B[1] + ny],
          [B[0] - nx, B[1] - ny],
          [A[0] - nx, A[1] - ny],
        ];
      for (const [z, s] of [
        [-d / 2, -1],
        [d / 2, 1],
      ])
        G.emit(
          'gold',
          q.map(([x, y]) => [x, y, z]),
          [0, 0, s],
        );
      if (detail === 3)
        for (let i = 0; i < 4; i++) {
          const a = q[i],
            b = q[(i + 1) % 4];
          G.emit(
            'gold',
            [
              [...a, -d / 2],
              [...b, -d / 2],
              [...b, d / 2],
              [...a, d / 2],
            ],
            [b[1] - a[1], a[0] - b[0], 0],
          );
        }
    },
    bilinear = (u, v) => {
      const a = p[0].map((x, k) => x * (1 - u) + p[1][k] * u),
        b = p[3].map((x, k) => x * (1 - u) + p[2][k] * u);
      return a.map((x, k) => x * (1 - v) + b[k] * v);
    };
  prism(f, 'stone', r.body, r.basementY, Y - 0.12);
  prism(f, 'floor', r.body, Y - 0.12, Y);
  for (const c of r.columns) {
    const profile =
      detail === 0
        ? [
            [Y, 0.055],
            [Y + 2.4, 0.04],
            [Y + 2.5, 0.07],
          ]
        : [
            [Y, 0.075],
            [Y + 0.09, 0.075],
            [Y + 0.13, 0.043],
            [Y + 2.32, 0.034],
            [Y + 2.38, 0.06],
            [Y + 2.45, 0.075],
            [Y + 2.5, 0.075],
          ];
    lathe('column', c.x, c.z, profile, [5, 8, 12, 16][detail]);
    if (detail >= 2)
      for (const y of [Y + 0.1, Y + 2.35])
        lathe(
          'gold',
          c.x,
          c.z,
          [
            [y, 0.046],
            [y + 0.035, 0.046],
          ],
          8,
        );
  }
  prism(f, 'soffit', r.parent, Y + 2.43, Y + 2.49);
  prism(f, 'gold', r.parent, Y + 2.49, Y + 2.53);
  const profile = [
      [2.53, 0.79],
      [2.7, 0.81],
      [2.98, 0.79],
      [3.2, 0.73],
      [3.3, 0.62],
      [3.43, 0.37],
      [3.62, 0.15],
      [3.72, 0.055],
    ],
    steps = [1, 1, 3, 5][detail],
    N = [8, 12, 24, 32][detail],
    rings = [];
  for (let j = 0; j < profile.length - 1; j++)
    for (let k = 0; k < steps; k++) {
      const t = k / steps,
        t2 = t * t,
        t3 = Math.pow(t, 3),
        slope = (i) => {
          const a = profile[Math.max(0, i - 1)],
            b = profile[Math.min(profile.length - 1, i + 1)];
          return (b[1] - a[1]) / (b[0] - a[0]);
        },
        dy = profile[j + 1][0] - profile[j][0],
        y = profile[j][0] * (1 - t) + profile[j + 1][0] * t,
        R =
          (2 * t3 - 3 * t2 + 1) * profile[j][1] +
          (t3 - 2 * t2 + t) * dy * slope(j) +
          (-2 * t3 + 3 * t2) * profile[j + 1][1] +
          (t3 - t2) * dy * slope(j + 1);
      rings.push(
        Array.from({ length: N }, (_, i) => {
          const a = (i * 2 * Math.PI) / N,
            cs = Math.cos(a),
            sn = Math.sin(a),
            u = 0.5 + 0.5 * R * Math.sign(cs) * Math.sqrt(Math.abs(cs)),
            v = 0.5 + 0.5 * R * Math.sign(sn) * Math.sqrt(Math.abs(sn)),
            q = bilinear(u, v);
          return [q[0], Y + y, q[1]];
        }),
      );
    }
  const last = profile.at(-1);
  rings.push(
    Array.from({ length: N }, (_, i) => {
      const a = (i * 2 * Math.PI) / N,
        q = bilinear(0.5 + 0.5 * last[1] * Math.cos(a), 0.5 + 0.5 * last[1] * Math.sin(a));
      return [q[0], Y + last[0], q[1]];
    }),
  );
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < N; i++) {
      const k = (i + 1) % N,
        q = rings[j][i];
      f('roof', [rings[j - 1][i], rings[j - 1][k], rings[j][k], q], [q[0], 0.5, q[2]]);
    }
  for (let i = 1; i < N - 1; i++)
    f('roof', [rings.at(-1)[0], rings.at(-1)[i], rings.at(-1)[i + 1]], [0, 1, 0]);
  const finial = (x, z, y, h) =>
    lathe(
      'gold',
      x,
      z,
      (detail === 0
        ? [
            [0, 0.06],
            [0.4, 0.11],
            [1, 0.01],
          ]
        : [
            [0, 0.07],
            [0.12, 0.09],
            [0.25, 0.055],
            [0.42, 0.12],
            [0.6, 0.14],
            [0.78, 0.07],
            [1, 0.018],
          ]
      ).map(([u, R]) => [Y + y + u * h, R * (h / 0.42)]),
      [5, 8, 12, 16][detail],
    );
  for (const [u, v] of [
    [0.12, 0.12],
    [0.12, 0.88],
    [0.88, 0.12],
    [0.88, 0.88],
  ]) {
    const q = bilinear(u, v);
    finial(q[0], q[1], 2.53, 0.35);
  }
  finial(0, 0, 3.7, 0.68);
  if (detail >= 2) {
    const G = { emit: (role, ps, n) => f(role, ps, n) },
      cy = Y + 4.58,
      crest = [
        [-0.14, cy - 0.12],
        [0, cy + 0.18],
        [0.14, cy - 0.12],
        [0, cy - 0.19],
      ];
    for (let i = 0; i < 4; i++) strip(G, crest[i], crest[(i + 1) % 4], 0.022, 0.035);
    for (const x of [-0.07, 0, 0.07]) strip(G, [x, cy - 0.1], [x, cy + 0.06], 0.014, 0.035);
  }
  const b = r.body.outline;
  for (const e of [0, 1, 2, 3]) {
    const a = b[e],
      c = b[(e + 1) % 4];
    if (e === 1) continue;
    const G = line(a, c);
    box(G.emit, 'trim', G.L / 2, Y + 0.08, 0, G.L, 0.1, 0.15);
    box(G.emit, 'trim', G.L / 2, Y + 0.72, 0, G.L, 0.12, 0.17);
    const count = Math.max(2, Math.round(G.L / 0.34));
    if (detail === 0) {
      box(G.emit, 'trim', G.L / 2, Y + 0.18, 0, G.L, 0.5, 0.07);
      continue;
    }
    for (let i = 0; i < count; i++) {
      const u = ((i + 0.5) * G.L) / count,
        q = [a[0] + ((c[0] - a[0]) * u) / G.L, a[1] + ((c[1] - a[1]) * u) / G.L];
      lathe(
        'trim',
        q[0],
        q[1],
        (detail === 1
          ? [
              [0.18, 0.045],
              [0.35, 0.055],
              [0.5, 0.025],
              [0.72, 0.045],
            ]
          : [
              [0.18, 0.05],
              [0.24, 0.035],
              [0.32, 0.064],
              [0.4, 0.06],
              [0.48, 0.026],
              [0.6, 0.035],
              [0.72, 0.05],
            ]
        ).map(([y, R]) => [Y + y, R]),
        [5, 6, 8, 10][detail],
      );
    }
  }
  for (const [x, z] of b) {
    box(f, 'trim', x, Y, z, 0.13, 0.83, 0.13);
    box(f, 'trim', x, Y + 0.83, z, 0.17, 0.06, 0.17);
  }
  if (detail)
    for (let e = 0; e < p.length; e++) {
      const G = line(p[e], p[(e + 1) % p.length]);
      box(G.emit, 'gold', G.L / 2, Y + 2.42, 0, G.L, 0.04, 0.035);
      const count = Math.ceil(G.L / (detail === 3 ? 0.075 : detail === 2 ? 0.13 : 0.24));
      for (let i = 0; i < count; i++) {
        const u = ((i + 0.5) * G.L) / count;
        if (detail === 1) {
          box(G.emit, 'gold', u, Y + 2.39, 0, 0.035, 0.05, 0.035);
          continue;
        }
        const cy = Y + 2.41,
          q = [
            [u - 0.026, cy],
            [u, cy - 0.04],
            [u + 0.026, cy],
            [u, cy + 0.01],
          ];
        for (let j = 0; j < 4; j++) strip(G, q[j], q[(j + 1) % 4], 0.012, 0.018);
      }
    }
}

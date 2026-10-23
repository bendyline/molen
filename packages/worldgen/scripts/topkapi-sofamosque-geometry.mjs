/** Sofa Mosque: pointed hall, shallow cushion roof and short pierced-balcony minaret. */
import { box as fullBox, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiSofaMosque(face, detail, r) {
  const box = (emit, role, x, y, z, w, h, d) => {
    if (detail !== 1 || (role !== 'wood' && !(role === 'trim' && h > 0.2)))
      return fullBox(emit, role, x, y, z, w, h, d);
    for (const [depth, s] of [
      [z + d / 2, 1],
      [z - d / 2, -1],
    ])
      emit(
        role,
        [
          [x - w / 2, y, depth],
          [x + w / 2, y, depth],
          [x + w / 2, y + h, depth],
          [x - w / 2, y + h, depth],
        ],
        [0, 0, s],
      );
  };
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    Y = r.floorY,
    p = r.body.outline,
    sign = Math.sign(
      p.reduce(
        (n, a, i) => n + a[0] * p[(i + 1) % p.length][1] - a[1] * p[(i + 1) % p.length][0],
        0,
      ),
    ),
    line = (a, b) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        tx = (b[0] - a[0]) / L,
        tz = (b[1] - a[1]) / L,
        nx = tz * sign,
        nz = -tx * sign;
      return {
        L,
        nx,
        nz,
        point: (u, d = 0) => [a[0] + tx * u + nx * d, a[1] + tz * u + nz * d],
        emit: (role, ps, n) =>
          f(
            role,
            ps.map(([u, y, d]) => [a[0] + tx * u + nx * d, y, a[1] + tz * u + nz * d]),
            [tx * n[0] + nx * n[2], n[1], tz * n[0] + nz * n[2]],
          ),
      };
    },
    panel = (G, role, a, b, lo, hi, d, back = false) => {
      const ps = [
        [a, lo, d],
        [b, lo, d],
        [b, hi, d],
        [a, hi, d],
      ];
      G.emit(role, ps, [0, 0, 1]);
      if (back) G.emit(role, ps.toReversed(), [0, 0, -1]);
    },
    pointArc = (x, w, spring, h, N) => {
      const half = Array.from({ length: N + 1 }, (_, i) => {
        const t = i / N;
        return [
          x - (w / 2) * (1 - t) * (1 - t) - w * 0.45 * 2 * (1 - t) * t,
          spring + h * (1.5 * (1 - t) * t + t * t),
        ];
      });
      return [
        ...half,
        ...half
          .slice(0, -1)
          .toReversed()
          .map(([u, y]) => [2 * x - u, y]),
      ];
    },
    strip = (G, role, A, B, w, d0, d1) => {
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
      for (const [d, s] of [
        [d0, -1],
        [d1, 1],
      ])
        G.emit(
          role,
          q.map(([x, y]) => [x, y, d]),
          [0, 0, s],
        );
      if (detail >= 2)
        for (let i = 0; i < 4; i++) {
          const a = q[i],
            b = q[(i + 1) % 4];
          G.emit(
            role,
            [
              [...a, d0],
              [...b, d0],
              [...b, d1],
              [...a, d1],
            ],
            [b[1] - a[1], a[0] - b[0], 0],
          );
        }
    },
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
    };
  prism(f, 'stone', r.body, r.basementY, Y - 0.15);
  prism(f, 'floor', r.body, Y - 0.15, Y);
  prism(f, 'roof', r.parent, Y + 4.98, Y + 5.1);
  const openings = [];
  for (let e = 0; e < 4; e++) {
    const G = line(p[e], p[(e + 1) % 4]),
      N = e === 1 ? 3 : e === 3 ? 2 : 4,
      bays = Array.from({ length: N }, (_, i) => ({
        x: (G.L * (i + 0.5)) / N,
        w: e === 1 ? 1.5 : 1.55,
        door: e === 1 && i === 1,
      }));
    let edge = 0;
    for (const o of bays) {
      const a = o.x - o.w / 2,
        b = o.x + o.w / 2,
        lo = Y + (o.door ? 0 : 0.42),
        spring = Y + 2.95,
        A = pointArc(
          o.x,
          o.w,
          spring,
          0.78,
          detail === 0 ? 2 : detail === 1 ? 3 : detail === 2 ? 6 : 10,
        );
      openings.push({ edge: e, point: G.point(o.x), ...o, lo, spring, top: spring + 0.78 });
      if (detail === 0 && !o.door) {
        const end = o.x + G.L / (2 * N);
        fullBox(G.emit, 'wall', (edge + end) / 2, Y, -0.16, end - edge, 5.1, 0.32);
        panel(G, 'dark', a, b, lo, spring + 0.78, 0.014, true);
        edge = end;
        continue;
      }
      if (a > edge) box(G.emit, 'wall', (a + edge) / 2, Y, -0.16, a - edge, 5.1, 0.32);
      if (lo > Y) box(G.emit, 'wall', o.x, Y, -0.16, o.w, lo - Y, 0.32);
      for (let i = 1; i < A.length; i++) {
        const a = A[i - 1],
          b = A[i];
        for (const [d, s] of [
          [0, 1],
          [-0.32, -1],
        ])
          G.emit(
            'wall',
            [
              [...a, d],
              [...b, d],
              [b[0], Y + 5.1, d],
              [a[0], Y + 5.1, d],
            ],
            [0, 0, s],
          );
        G.emit(
          'trim',
          [
            [...a, 0],
            [...b, 0],
            [...b, -0.32],
            [...a, -0.32],
          ],
          [0, -1, 0],
        );
        if (detail) strip(G, 'trim', a, b, 0.105, 0.005, 0.09);
      }
      for (const [u, n] of [
        [a, 1],
        [b, -1],
      ])
        G.emit(
          'trim',
          [
            [u, lo, 0],
            [u, spring, 0],
            [u, spring, -0.32],
            [u, lo, -0.32],
          ],
          [n, 0, 0],
        );
      panel(G, 'dark', a, b, o.door ? spring - 0.22 : lo, spring, -0.35, true);
      for (let i = 1; i < A.length; i++)
        for (const s of [-1, 1])
          G.emit(
            'dark',
            [
              [o.x, spring, -0.35],
              [...A[i - 1], -0.35],
              [...A[i], -0.35],
            ],
            [0, 0, s],
          );
      if (detail) {
        for (const u of [a, b]) box(G.emit, 'wood', u, lo, -0.24, 0.065, spring - lo, 0.07);
        box(G.emit, 'wood', o.x, spring - 0.06, -0.24, o.w, 0.065, 0.07);
        if (!o.door) {
          for (const h of [lo + 0.1, Y + 1.15, Y + 2.03])
            box(G.emit, 'wood', o.x, h, -0.24, o.w, 0.065, 0.07);
          box(G.emit, 'wood', o.x, lo, -0.24, 0.055, spring - lo, 0.07);
        } else box(G.emit, 'wood', o.x, spring - 0.24, -0.24, o.w, 0.065, 0.07);
        if (detail >= 2) box(G.emit, 'wood', o.x, spring, -0.24, 0.055, 0.72, 0.07);
        for (const u of [a - 0.08, b + 0.08]) {
          box(G.emit, 'trim', u, Y + 0.3, 0.015, 0.115, spring - Y - 0.3, 0.1);
          box(G.emit, 'trim', u, spring - 0.08, 0.025, 0.23, 0.12, 0.14);
        }
      }
      if (o.door) {
        const S = r.stairs,
          N = detail ? S.count : 2,
          depth = (S.count * S.stepDepth) / N;
        for (let i = 0; i < N; i++)
          fullBox(
            G.emit,
            'trim',
            o.x,
            S.lo - 0.06,
            (N - i - 0.5) * depth,
            o.w + 0.35,
            0.06 + ((Y - S.lo) * (i + 1)) / N,
            depth,
          );
      }
      edge = b;
    }
    if (edge < G.L) box(G.emit, 'wall', (edge + G.L) / 2, Y, -0.16, G.L - edge, 5.1, 0.32);
    if (detail) {
      for (const [y, h, d] of [
        [Y + 0.08, 0.12, 0.06],
        [Y + 3.98, 0.12, 0.08],
        [Y + 4.14, 0.06, 0.04],
        [Y + 5.0, 0.12, 0.14],
      ])
        box(G.emit, 'trim', G.L / 2, y, d / 2, G.L + 0.01, h, d + 0.08);
      for (let i = 0; i <= N; i++) {
        const x = (G.L * i) / N;
        box(G.emit, 'trim', x, Y + 4.28, 0.025, 0.07, 0.54, 0.07);
      }
      for (const y of [Y + 4.28, Y + 4.82]) box(G.emit, 'trim', G.L / 2, y, 0.025, G.L, 0.05, 0.07);
      if (e === 1) {
        box(G.emit, 'dark', G.L / 2, Y + 4.32, 0.045, 1.45, 0.49, 0.08);
        for (const x of [G.L / 2 - 0.76, G.L / 2 + 0.76])
          box(G.emit, 'gold', x, Y + 4.28, 0.1, 0.035, 0.57, 0.035);
        for (const y of [Y + 4.28, Y + 4.85])
          box(G.emit, 'gold', G.L / 2, y, 0.1, 1.55, 0.035, 0.035);
      }
    }
  }
  const roofPoint = (u, v) => {
      const q = r.parent.outline,
        a = q[0].map((x, k) => x * (1 - u) + q[1][k] * u),
        b = q[3].map((x, k) => x * (1 - u) + q[2][k] * u);
      return [
        a[0] * (1 - v) + b[0] * v,
        Y +
          5.1 +
          1.1 *
            Math.sqrt(
              Math.max(0, (1 - (2 * u - 1) * (2 * u - 1)) * (1 - (2 * v - 1) * (2 * v - 1))),
            ),
        a[1] * (1 - v) + b[1] * v,
      ];
    },
    nx = [4, 8, 24, 36][detail],
    nz = [2, 4, 12, 18][detail];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++)
      f(
        'roof',
        [
          roofPoint(i / nx, j / nz),
          roofPoint((i + 1) / nx, j / nz),
          roofPoint((i + 1) / nx, (j + 1) / nz),
          roofPoint(i / nx, (j + 1) / nz),
        ],
        [0, 1, 0],
      );
  const M = r.minaret,
    sides = [8, 12, 24, 32][detail];
  lathe(
    'trim',
    M.x,
    M.z,
    [
      [r.basementY, 0.65],
      [Y + 6.35, 0.55],
      [Y + 6.55, 0.65],
      [Y + 6.85, 0.98],
      [Y + 7.04, 1.03],
      [Y + 7.18, 1.03],
      [Y + 7.2, 0.55],
      [Y + 8.62, 0.55],
      [Y + 8.7, 0.65],
      [Y + 8.83, 0.7],
      [Y + 9.08, 0.69],
      [Y + 9.3, 0.52],
      [Y + 9.48, 0.2],
    ].filter((_, i) => detail !== 0 || [0, 1, 4, 6, 7, 9, 11, 12].includes(i)),
    sides,
  );
  if (detail === 0)
    lathe(
      'trim',
      M.x,
      M.z,
      [
        [Y + 7.2, 0.98],
        [Y + 8.02, 0.98],
      ],
      8,
    );
  else {
    for (const y of [Y + 7.18, Y + 7.95])
      lathe(
        'trim',
        M.x,
        M.z,
        [
          [y, 0.99],
          [y + 0.1, 0.99],
        ],
        sides,
      );
    const N = detail === 1 ? 8 : detail === 2 ? 12 : 16;
    for (let i = 0; i < N; i++) {
      const a = [
          M.x + 0.94 * Math.cos((i * 2 * Math.PI) / N),
          M.z + 0.94 * Math.sin((i * 2 * Math.PI) / N),
        ],
        b = [
          M.x + 0.94 * Math.cos(((i + 1) * 2 * Math.PI) / N),
          M.z + 0.94 * Math.sin(((i + 1) * 2 * Math.PI) / N),
        ],
        G = line(a, b),
        cx = G.L / 2,
        cy = Y + 7.6,
        ps = [
          [cx - 0.18, cy],
          [cx, cy + 0.28],
          [cx + 0.18, cy],
          [cx, cy - 0.28],
        ];
      for (let j = 0; j < 4; j++) strip(G, 'trim', ps[j], ps[(j + 1) % 4], 0.045, -0.035, 0.035);
      box(G.emit, 'trim', 0, Y + 7.2, 0, 0.055, 0.8, 0.07);
    }
  }
  for (const [x, z, base, h] of [
    [0, 0, Y + 6.2, 0.48],
    [M.x, M.z, Y + 9.48, 0.63],
  ])
    lathe(
      'gold',
      x,
      z,
      [
        [base, 0.09],
        [base + h * 0.2, 0.14],
        [base + h * 0.45, 0.07],
        [base + h * 0.6, 0.11],
        [base + h, 0.035],
      ],
      detail === 0 ? 5 : detail === 1 ? 8 : 12,
    );
  if (detail >= 2) {
    const cx = M.x,
      cy = Y + 10.3,
      cz = M.z,
      N = detail === 3 ? 16 : 10;
    for (let i = 0; i < N; i++) {
      const a = 0.3 * Math.PI + (i * 1.4 * Math.PI) / N,
        b = 0.3 * Math.PI + ((i + 1) * 1.4 * Math.PI) / N;
      for (const [d, s] of [
        [-0.018, -1],
        [0.018, 1],
      ])
        f(
          'gold',
          [
            [cx + 0.16 * Math.cos(a), cy + 0.24 * Math.sin(a), cz + d],
            [cx + 0.16 * Math.cos(b), cy + 0.24 * Math.sin(b), cz + d],
            [cx + 0.105 * Math.cos(b), cy + 0.19 * Math.sin(b), cz + d],
            [cx + 0.105 * Math.cos(a), cy + 0.19 * Math.sin(a), cz + d],
          ],
          [0, 0, s],
        );
    }
  }
  return openings;
}

/** Grand Kiosk: long plaster hall, round openings, carved cornice and lead parapet. */
import { box as fullBox, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiGrand(face, detail, r) {
  const box = (emit, role, x, y, z, w, h, d) => {
    if (detail !== 1 || !['trim', 'wood'].includes(role)) {
      fullBox(emit, role, x, y, z, w, h, d);
      return;
    }
    for (const [depth, sign] of [
      [z + d / 2, 1],
      [z - d / 2, -1],
    ]) {
      emit(
        role,
        [
          [x - w / 2, y, depth],
          [x + w / 2, y, depth],
          [x + w / 2, y + h, depth],
          [x - w / 2, y + h, depth],
        ],
        [0, 0, sign],
      );
    }
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
    panel = (G, role, x0, x1, lo, hi, d, back = false) => {
      const ps = [
        [x0, lo, d],
        [x1, lo, d],
        [x1, hi, d],
        [x0, hi, d],
      ];
      G.emit(role, ps, [0, 0, 1]);
      if (back) G.emit(role, ps.toReversed(), [0, 0, -1]);
    },
    arc = (x, w, spring, N) =>
      Array.from({ length: N + 1 }, (_, i) => {
        const a = Math.PI - (i * Math.PI) / N;
        return [x + (w / 2) * Math.cos(a), spring + (w / 2) * Math.sin(a)];
      }),
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
    scroll = (G, x, y, mirror) => {
      const N = detail === 3 ? 10 : 6;
      for (let i = 0; i < N; i++) {
        const point = (t) => {
          const a = -Math.PI / 2 + t * Math.PI * 2.1,
            R = 0.3 * (1 - 0.65 * t);
          return [x + mirror * R * Math.cos(a), y + 0.6 * R * Math.sin(a)];
        };
        strip(G, 'trim', point(i / N), point((i + 1) / N), 0.055, 0.13, 0.18);
      }
    };
  prism(f, 'stone', r.body, r.basementY, Y - 0.16);
  prism(f, 'floor', r.body, Y - 0.16, Y);
  prism(f, 'roof', r.parent, Y + 6.25, Y + 6.48);
  const openings = [];
  for (let e = 0; e < p.length; e++) {
    const G = line(p[e], p[(e + 1) % p.length]),
      garden = e === 11,
      end = e === 0,
      N = G.L < 3 ? 0 : garden ? 9 : end ? 3 : Math.max(1, Math.floor(G.L / 4.2)),
      bays = Array.from({ length: N }, (_, i) => ({
        x: (G.L * (i + 0.5)) / N,
        w: garden && (i === 2 || i === 6) ? 2.05 : 1.8,
        door: garden && (i === 2 || i === 6),
        niche: end && i === 1,
      }));
    let edge = 0;
    for (const o of bays) {
      const a = o.x - o.w / 2,
        b = o.x + o.w / 2,
        lo = Y + (o.door ? 0 : 0.38),
        spring = Y + (o.door ? 3.8 : 3.6),
        top = spring + o.w / 2;
      openings.push({ edge: e, point: G.point(o.x), ...o, lo, spring, top });
      if (detail === 0 && !o.door) {
        box(G.emit, 'wall', o.x, Y, -0.2, G.L / N, 6.25, 0.4);
        panel(G, 'dark', a, b, lo, top, 0.012, true);
        continue;
      }
      if (detail === 1 && !o.door) {
        box(G.emit, 'wall', o.x, Y, -0.2, G.L / N, 6.25, 0.4);
        panel(G, o.niche ? 'wall' : 'dark', a, b, lo, spring, 0.015, true);
        const A = arc(o.x, o.w, spring, 4);
        for (let i = 1; i < A.length; i++) {
          G.emit(
            o.niche ? 'wall' : 'dark',
            [
              [o.x, spring, 0.015],
              [...A[i - 1], 0.015],
              [...A[i], 0.015],
            ],
            [0, 0, 1],
          );
          strip(G, 'trim', A[i - 1], A[i], 0.16, 0.035, 0.09);
        }
        for (const u of [a - 0.13, b + 0.13])
          box(G.emit, 'trim', u, Y + 0.3, 0.025, 0.18, spring - Y - 0.3, 0.18);
        continue;
      }
      if (a > edge) box(G.emit, 'wall', (edge + a) / 2, Y, -0.2, a - edge, 6.25, 0.4);
      if (lo > Y) box(G.emit, 'wall', o.x, Y, -0.2, o.w, lo - Y, 0.4);
      const A = arc(o.x, o.w, spring, detail === 0 ? 4 : detail === 1 ? 6 : detail === 2 ? 10 : 16);
      for (let i = 1; i < A.length; i++) {
        const q = [A[i - 1], A[i]];
        for (const [d, s] of [
          [0, 1],
          [-0.4, -1],
        ])
          G.emit(
            'wall',
            [
              [q[0][0], q[0][1], d],
              [q[1][0], q[1][1], d],
              [q[1][0], Y + 6.25, d],
              [q[0][0], Y + 6.25, d],
            ],
            [0, 0, s],
          );
        G.emit(
          'trim',
          [
            [q[0][0], q[0][1], 0],
            [q[1][0], q[1][1], 0],
            [q[1][0], q[1][1], -0.4],
            [q[0][0], q[0][1], -0.4],
          ],
          [0, -1, 0],
        );
        if (detail) strip(G, 'trim', q[0], q[1], 0.16, 0.01, 0.13);
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
            [u, spring, -0.4],
            [u, lo, -0.4],
          ],
          [n, 0, 0],
        );
      if (!o.door) {
        panel(G, o.niche ? 'wall' : 'dark', a, b, lo, spring, -0.43, true);
        for (let i = 1; i < A.length; i++)
          for (const s of [-1, 1])
            G.emit(
              o.niche ? 'wall' : 'dark',
              [
                [o.x, spring, -0.43],
                [...A[i - 1], -0.43],
                [...A[i], -0.43],
              ],
              [0, 0, s],
            );
      }
      if (detail) {
        for (const u of [a - 0.13, b + 0.13]) {
          box(G.emit, 'trim', u, Y + 0.3, 0.025, 0.18, spring - Y - 0.3, 0.18);
          for (const [base, w, h] of [
            [Y + 0.3, 0.32, 0.15],
            [spring - 0.13, 0.38, 0.18],
          ])
            box(G.emit, 'trim', u, base, 0.05, w, h, 0.25);
        }
        if (!o.niche && !o.door) {
          for (const u of [a + 0.07, b - 0.07])
            box(G.emit, 'wood', u, lo, -0.27, 0.07, spring - lo, 0.06);
          for (const h of [lo + 0.08, lo + (spring - lo) * 0.52, spring])
            box(G.emit, 'wood', o.x, h, -0.27, o.w, 0.07, 0.06);
        } else if (o.niche) {
          box(G.emit, 'trim', o.x, Y + 0.5, -0.15, 0.55, 0.3, 0.35);
          const profile = [
              [0.8, 0.14],
              [1, 0.12],
              [1.16, 0.22],
              [1.45, 0.32],
              [1.7, 0.34],
              [1.78, 0.2],
              [1.94, 0.12],
              [2.03, 0.23],
            ],
            sides = detail === 3 ? 12 : 8,
            rings = profile.map(([y, R]) =>
              Array.from({ length: sides }, (_, i) => [
                o.x + R * Math.cos((i * 2 * Math.PI) / sides),
                Y + y,
                -0.22 + R * Math.sin((i * 2 * Math.PI) / sides),
              ]),
            );
          for (let j = 1; j < rings.length; j++)
            for (let i = 0; i < sides; i++) {
              const k = (i + 1) % sides;
              G.emit(
                'trim',
                [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
                [rings[j][i][0] - o.x, 0.001, rings[j][i][2] + 0.22],
              );
            }
          for (const [ring, s] of [
            [rings[0], -1],
            [rings.at(-1), 1],
          ])
            for (let i = 1; i < sides - 1; i++)
              G.emit('trim', [ring[0], ring[i], ring[i + 1]], [0, s, 0]);
          if (detail >= 2)
            for (let i = 0; i < 9; i++) {
              const a = (i * Math.PI) / 8;
              strip(
                G,
                'trim',
                [o.x, Y + 3.25],
                [o.x + 0.65 * Math.cos(a), Y + 3.25 + 0.55 * Math.sin(a)],
                0.045,
                -0.31,
                -0.27,
              );
            }
        }
        if (detail >= 2) {
          for (const u of [o.x - 0.58, o.x + 0.58])
            scroll(G, u, Y + top - Y + 0.38, u < o.x ? 1 : -1);
          strip(G, 'trim', [a - 0.35, top + 0.18], [o.x, top + 0.42], 0.08, 0.06, 0.15);
          strip(G, 'trim', [o.x, top + 0.42], [b + 0.35, top + 0.18], 0.08, 0.06, 0.15);
        }
      }
      if (o.door) {
        const stair = r.entryStairs.find(
            (s) => Math.abs(o.x - (G.L * (s.bayIndex + 0.5)) / 9) < 0.01,
          ),
          lo = stair.lo,
          count = detail === 0 ? 2 : stair.count,
          depth = (stair.count * stair.stepDepth) / count;
        for (let i = 0; i < count; i++)
          fullBox(
            G.emit,
            'trim',
            o.x,
            lo - 0.08,
            (count - i - 0.5) * depth,
            o.w + 0.5,
            0.08 + ((Y - lo) * (i + 1)) / count,
            depth,
          );
        if (detail >= 2) {
          box(G.emit, 'wood', a + 0.12, Y, -0.55, 0.16, 3.65, 0.06);
          box(G.emit, 'wood', b - 0.12, Y, -0.55, 0.16, 3.65, 0.06);
        }
      }
      edge = b;
    }
    if ((detail || bays.some((o) => o.door)) && edge < G.L)
      box(G.emit, 'wall', (edge + G.L) / 2, Y, -0.2, G.L - edge, 6.25, 0.4);
    if (!N) box(G.emit, 'wall', G.L / 2, Y, -0.2, G.L, 6.25, 0.4);
    if (detail) {
      for (const [y, h, d] of [
        [Y + 0.08, 0.12, 0.05],
        [Y + 0.3, 0.12, 0.08],
        [Y + 5.35, 0.16, 0.11],
        [Y + 6.0, 0.18, 0.2],
        [Y + 6.21, 0.19, 0.29],
      ])
        box(G.emit, 'trim', G.L / 2, y, d / 2, G.L + 0.01, h, d + 0.1);
      for (let i = 0; i <= N; i++)
        if (N) {
          const u = (G.L * i) / N;
          box(G.emit, 'trim', u, Y + 0.3, 0.02, 0.32, 5.6, 0.13);
          box(G.emit, 'trim', u, Y + 5.85, 0.05, 0.55, 0.3, 0.25);
        }
      for (const o of bays) {
        box(G.emit, 'trim', o.x, Y + 5.45, 0.04, G.L / N - 0.45, 0.45, 0.08);
        if (detail === 3)
          for (const dx of [-0.45, 0, 0.45]) {
            scroll(G, o.x + dx, Y + 5.68, dx < 0 ? -1 : 1);
          }
      }
      if (detail >= 2)
        for (let u = 0.18; u < G.L; u += detail === 3 ? 0.28 : 1)
          box(G.emit, 'trim', u, Y + 6.03, 0.2, 0.12, 0.13, 0.25);
    }
    box(G.emit, 'roof', G.L / 2, Y + 6.48, -0.02, G.L + 0.025, 0.32, 0.18);
  }
  for (const [x, z, h] of [
    [-3, -14, 1.5],
    [3, -14, 1.7],
    [-3, 0, 1.1],
    [3, 0, 1.35],
    [-3, 13, 1.5],
    [3, 13, 1.7],
  ]) {
    box(f, 'wall', x, Y + 6.48, z, 0.52, h, 0.65);
    fullBox(f, 'trim', x, Y + 6.48 + h - 0.15, z, 0.68, 0.15, 0.82);
    box(f, 'roof', x, Y + 6.48 + h, z, 0.65, 0.07, 0.79);
  }
  if (detail >= 2) for (const z of [-7.5, 7.5]) box(f, 'wall', 0, Y, z, 13.8, 6.2, 0.15);
  return openings;
}

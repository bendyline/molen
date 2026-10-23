/** Yerevan Kiosk: faceted projecting room, long open portico and descending garden stair. */
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiYerevan(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    Y = r.floorY,
    line = (a, b, sign = 1) => {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        tx = (b[0] - a[0]) / L,
        tz = (b[1] - a[1]) / L,
        nx = tz * sign,
        nz = -tx * sign;
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
    panel = (emit, role, x0, x1, lo, hi, d) => {
      const p = [
        [x0, lo, d],
        [x1, lo, d],
        [x1, hi, d],
        [x0, hi, d],
      ];
      emit(role, p, [0, 0, 1]);
      if (role === 'dark') emit(role, p.toReversed(), [0, 0, -1]);
    },
    pointed = (u, rise) =>
      (rise * Math.sqrt(Math.max(0, 1 - ((Math.abs(u) + 1) / 2) ** 2))) / Math.sqrt(0.75),
    arch = (emit, role, x, R, bottom, spring, rise, d) => {
      const ps = [
          [x - R, bottom, d],
          [x + R, bottom, d],
        ],
        n = [2, 4, 8, 12][detail];
      for (let i = 0; i <= n; i++) {
        const u = 1 - (2 * i) / n;
        ps.push([x + R * u, spring + pointed(u, rise), d]);
      }
      for (let i = 1; i < ps.length - 1; i++) {
        emit(role, [ps[0], ps[i], ps[i + 1]], [0, 0, 1]);
        if (role === 'dark') emit(role, [ps[0], ps[i + 1], ps[i]], [0, 0, -1]);
      }
    },
    header = (emit, role, x, R, spring, rise, top, depth) => {
      const n = [1, 3, 7, 11][detail];
      for (let i = 0; i < n; i++) {
        const a = -1 + (2 * i) / n,
          b = -1 + (2 * (i + 1)) / n,
          xa = x + R * a,
          xb = x + R * b,
          ya = spring + pointed(a, rise),
          yb = spring + pointed(b, rise);
        for (const [d, sign] of [
          [depth / 2, 1],
          [-depth / 2, -1],
        ])
          emit(
            role,
            [
              [xa, ya, d],
              [xb, yb, d],
              [xb, top, d],
              [xa, top, d],
            ],
            [0, 0, sign],
          );
        emit(
          'trim',
          [
            [xa, ya, -depth / 2],
            [xb, yb, -depth / 2],
            [xb, yb, depth / 2],
            [xa, ya, depth / 2],
          ],
          [0, -1, 0],
        );
        if (detail >= 2)
          emit(
            'trim',
            [
              [xa, ya, depth / 2 + 0.015],
              [xb, yb, depth / 2 + 0.015],
              [x + (R + 0.13) * b, yb + 0.13, depth / 2 + 0.015],
              [x + (R + 0.13) * a, ya + 0.13, depth / 2 + 0.015],
            ],
            [0, 0, 1],
          );
      }
      for (const [u, sign] of [
        [x - R, -1],
        [x + R, 1],
      ])
        emit(
          role,
          [
            [u, spring, -depth / 2],
            [u, spring, depth / 2],
            [u, top, depth / 2],
            [u, top, -depth / 2],
          ],
          [sign, 0, 0],
        );
    },
    cylinder = (role, x, z, profile, N) => {
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
      for (const [ring, sign] of [
        [rings[0], -1],
        [rings.at(-1), 1],
      ])
        for (let i = 1; i < N - 1; i++) f(role, [ring[0], ring[i], ring[i + 1]], [0, sign, 0]);
    },
    wall = (G, role, low, high, openings, thickness = 0.42) => {
      const block = (emit, role, x, y, z, w, h, d) => {
        if (detail) box(emit, role, x, y, z, w, h, d);
        else {
          panel(emit, role, x - w / 2, x + w / 2, y, y + h, 0);
          emit(
            role,
            [
              [x - w / 2, y, -d],
              [x - w / 2, y + h, -d],
              [x + w / 2, y + h, -d],
              [x + w / 2, y, -d],
            ],
            [0, 0, -1],
          );
        }
      };
      let edge = 0;
      for (const o of openings) {
        const a = o.x - o.w / 2,
          b = o.x + o.w / 2;
        if (a > edge)
          block(G.emit, role, (a + edge) / 2, low, -thickness / 2, a - edge, high - low, thickness);
        if (o.lo > low) block(G.emit, role, o.x, low, -thickness / 2, o.w, o.lo - low, thickness);
        if (o.hi < high)
          block(G.emit, role, o.x, o.hi, -thickness / 2, o.w, high - o.hi, thickness);
        if (o.kind !== 'door') panel(G.emit, 'dark', a, b, o.lo, o.hi, -thickness - 0.015);
        if (detail >= 2 && o.kind !== 'door' && o.kind !== 'upper') {
          for (const u of [a, b]) box(G.emit, 'trim', u, o.lo, 0.015, 0.08, o.hi - o.lo, 0.08);
          for (const y of [o.lo, o.hi]) box(G.emit, 'trim', o.x, y, 0.015, o.w + 0.1, 0.08, 0.08);
          const upper = o.kind === 'upper',
            N = detail === 3 ? 4 : 2;
          for (let i = 1; i <= N; i++)
            box(
              G.emit,
              upper ? 'trim' : 'gold',
              a + (o.w * i) / (N + 1),
              o.lo,
              -0.17,
              0.035,
              o.hi - o.lo,
              0.035,
            );
          for (let i = 1; i <= (detail === 3 ? 4 : 2); i++)
            box(
              G.emit,
              upper ? 'trim' : 'gold',
              o.x,
              o.lo + ((o.hi - o.lo) * i) / (detail === 3 ? 5 : 3),
              -0.17,
              o.w,
              0.035,
              0.035,
            );
        }
        edge = b;
      }
      if (edge < G.L)
        block(
          G.emit,
          role,
          (edge + G.L) / 2,
          low,
          -thickness / 2,
          G.L - edge,
          high - low,
          thickness,
        );
    };

  // A raised floor covers the exact mapped canopy; the garden flight remains separate.
  prism(f, 'trim', r.parent, r.foundationBottom, Y - 0.18);
  prism(f, 'floor', r.parent, Y - 0.18, Y);
  for (const body of r.body) {
    const ps = body.outline,
      sign = Math.sign(
        ps.reduce(
          (n, p, i) => n + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
          0,
        ),
      );
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i],
        b = ps[(i + 1) % ps.length],
        G = line(a, b, sign),
        door = a[0] < 0.15 && b[0] < 0.15,
        N = Math.max(1, Math.floor(G.L / 2.15)),
        lower = [],
        upper = [];
      if (door) lower.push({ x: G.L / 2, w: 1.35, lo: Y, hi: Y + 2.8, kind: 'door' });
      else if (detail >= 2)
        for (let j = 0; j < N; j++)
          lower.push({
            x: (G.L * (j + 0.5)) / N,
            w: Math.min(1.05, (G.L / N) * 0.5),
            lo: Y + 0.6,
            hi: Y + 2.55,
            kind: 'lower',
          });
      if (detail >= 2)
        for (let j = 0; j < (door ? 1 : N); j++)
          upper.push({
            x: (G.L * (j + 0.5)) / (door ? 1 : N),
            w: Math.min(0.95, (G.L / N) * 0.48),
            lo: Y + 3.3,
            hi: r.roofY - 0.08,
            kind: 'upper',
          });
      wall(G, 'trim', Y, Y + 3.05, lower);
      wall(G, 'tile', Y + 3.05, r.roofY - 0.08, upper);
      if (detail < 2 && !door)
        for (let j = 0; j < N; j++) {
          const x = (G.L * (j + 0.5)) / N,
            R = Math.min(0.5, (G.L / N) * 0.24);
          panel(G.emit, 'dark', x - R, x + R, Y + 0.6, Y + 2.55, 0.012);
          arch(G.emit, 'dark', x, R, Y + 3.3, Y + 4.75, 0.55, 0.012);
        }
      if (detail >= 2)
        for (const o of upper) {
          const R = o.w / 2,
            emit = (role, ps, n) =>
              G.emit(
                role,
                ps.map(([u, y, d]) => [u, y, d - 0.21]),
                n,
              );
          header(emit, 'tile', o.x, R, Y + 4.75, 0.55, r.roofY - 0.08, 0.42);
          const n = detail === 3 ? 12 : 8;
          for (let j = 0; j < n; j++) {
            const a = -1 + (2 * j) / n,
              b = -1 + (2 * (j + 1)) / n,
              ya = Y + 4.75 + pointed(a, 0.55),
              yb = Y + 4.75 + pointed(b, 0.55);
            G.emit(
              'trim',
              [
                [o.x + R * a, ya, 0.015],
                [o.x + R * b, yb, 0.015],
                [o.x + (R + 0.065) * b, yb + 0.065, 0.015],
                [o.x + (R + 0.065) * a, ya + 0.065, 0.015],
              ],
              [0, 0, 1],
            );
          }
          for (const u of [-R, R]) box(G.emit, 'trim', o.x + u, Y + 3.3, 0.015, 0.07, 1.45, 0.07);
          for (const u of detail === 3 ? [-R * 0.55, 0, R * 0.55] : [-R * 0.36, R * 0.36])
            box(G.emit, 'trim', o.x + u, Y + 3.3, -0.17, 0.035, 1.45 + pointed(u / R, 0.55), 0.035);
          for (const h of [3.75, 4.25, 4.7])
            box(G.emit, 'trim', o.x, Y + h, -0.17, R * 2, 0.035, 0.035);
        }
      if (detail) {
        box(G.emit, 'trim', G.L / 2, Y + 2.98, 0.025, G.L, 0.13, 0.12);
        box(G.emit, 'wall', G.L / 2, Y + 0.24, 0.025, G.L, 0.1, 0.1);
      }
    }
  }

  const columns = new Map();
  for (const run of r.arcades) {
    const G = line(run.a, run.b),
      step = G.L / run.bays;
    for (let i = 0; i <= run.bays; i++) {
      const t = i / run.bays,
        x = run.a[0] + (run.b[0] - run.a[0]) * t,
        z = run.a[1] + (run.b[1] - run.a[1]) * t;
      columns.set(`${x.toFixed(2)}/${z.toFixed(2)}`, [x, z]);
    }
    for (let i = 0; i < run.bays; i++) {
      const x = step * (i + 0.5),
        R = step / 2;
      if (detail) header(G.emit, 'wall', x, R, Y + 3.9, 1.65, r.roofY - 0.08, 0.36);
      else panel(G.emit, 'wall', x - R, x + R, Y + 5.55, r.roofY - 0.08, 0);
      if (detail >= 2) {
        box(G.emit, 'dark', x, Y + 3.84, 0, step, 0.045, 0.045);
        const n = detail === 3 ? 14 : 8;
        for (let j = 0; j < n; j++) {
          const a = -1 + (2 * j) / n,
            b = -1 + (2 * (j + 1)) / n,
            ya = Y + 3.9 + pointed(a, 1.65),
            yb = Y + 3.9 + pointed(b, 1.65);
          for (const [d, sgn] of [
            [0.195, 1],
            [-0.195, -1],
          ])
            G.emit(
              j % 2 ? 'brick' : 'trim',
              [
                [x + R * a, ya, d],
                [x + R * b, yb, d],
                [x + (R + 0.13) * b, yb + 0.13, d],
                [x + (R + 0.13) * a, ya + 0.13, d],
              ],
              [0, 0, sgn],
            );
        }
      }
      // A real low rail; the center northwest bay is the terrace approach.
      if (!(run === r.arcades[0] && i === 1)) {
        for (const h of [0.05, 0.86]) box(G.emit, 'trim', x, Y + h, 0, step - 0.43, 0.12, 0.2);
        const count = Math.max(
          1,
          Math.ceil((step - 0.5) / (detail === 3 ? 0.5 : detail === 2 ? 0.7 : 1.8)),
        );
        if (detail >= 2)
          for (let j = 1; j <= count; j++) {
            const u = step * i + 0.25 + ((step - 0.5) * j) / (count + 1),
              p = [
                run.a[0] + ((run.b[0] - run.a[0]) * u) / G.L,
                run.a[1] + ((run.b[1] - run.a[1]) * u) / G.L,
              ];
            cylinder(
              'trim',
              p[0],
              p[1],
              [
                [Y + 0.17, 0.055],
                [Y + 0.28, 0.075],
                [Y + 0.6, 0.045],
                [Y + 0.83, 0.06],
              ],
              [0, 0, 5, 7][detail],
            );
          }
        else
          for (let j = 1; j <= count; j++)
            box(G.emit, 'trim', step * i + (step * j) / (count + 1), Y + 0.17, 0, 0.085, 0.69, 0.1);
      }
    }
  }
  for (const [x, z] of columns.values()) {
    cylinder(
      'column',
      x,
      z,
      detail === 0
        ? [
            [Y, 0.25],
            [Y + 3.9, 0.25],
          ]
        : detail === 1
          ? [
              [Y, 0.3],
              [Y + 3.6, 0.22],
              [Y + 3.9, 0.39],
            ]
          : [
              [Y, 0.31],
              [Y + 0.2, 0.32],
              [Y + 0.3, 0.23],
              [Y + 3.48, 0.22],
              [Y + 3.6, 0.3],
              [Y + 3.9, 0.39],
            ],
      [4, 6, 10, 14][detail],
    );
    if (detail)
      for (const h of [0.29, 3.46])
        cylinder(
          'gold',
          x,
          z,
          [
            [Y + h, 0.245],
            [Y + h + 0.075, 0.245],
          ],
          detail === 1 ? 6 : 10,
        );
  }

  prism(f, 'wood', r.parent, r.roofY - 0.08, r.roofY);
  for (const p of r.roofShards) {
    const ix = earcut(p.flatMap((q) => [q[0], q[2]]));
    for (let i = 0; i < ix.length; i += 3)
      f(
        'roof',
        ix.slice(i, i + 3).map((k) => p[k]),
        [0, 1, 0],
      );
  }
  if (detail)
    for (let i = 0; i < r.parent.outline.length; i++) {
      const G = line(r.parent.outline[i], r.parent.outline[(i + 1) % r.parent.outline.length]);
      box(G.emit, 'edge', G.L / 2, r.roofY - 0.1, 0, G.L, 0.14, 0.14);
    }
  const d = r.dome,
    profile = [],
    rings = [2, 3, 5, 8][detail];
  cylinder(
    'wall',
    d.x,
    d.z,
    [
      [r.roofY - 0.01, d.radius * 0.94],
      [d.base, d.radius * 0.94],
    ],
    8,
  );
  for (let i = 0; i <= rings; i++) {
    const a = (i * Math.PI) / 2 / rings;
    profile.push([d.base + d.rise * Math.sin(a), Math.max(0.035, d.radius * Math.cos(a))]);
  }
  cylinder('roof', d.x, d.z, profile, [6, 10, 18, 26][detail]);
  cylinder(
    'gold',
    d.x,
    d.z,
    [
      [d.base + d.rise, 0.13],
      [d.base + d.rise + 0.13, 0.18],
      [d.base + d.rise + 0.28, 0.07],
      [d.base + d.rise + 0.65, 0.025],
    ],
    detail ? 6 : 4,
  );

  // Thin curved pale canopy braces stand clear of the blue window bays.
  if (detail >= 2)
    for (const x of [1.4, 7.2])
      for (const side of [-1, 1]) {
        const count = detail === 3 ? 7 : 4,
          points = Array.from({ length: count }, (_, i) => {
            const t = i / (count - 1);
            return [x, Y + 4.7 + 1.5 * t, side * (4.6 + 1.2 * t - 0.18 * Math.sin(Math.PI * t))];
          });
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1],
            b = points[i],
            G = line([a[0], a[2]], [b[0], b[2]]),
            v = 0.028;
          for (const [dep, sign] of [
            [v, 1],
            [-v, -1],
          ])
            G.emit(
              'trim',
              [
                [0, a[1] - v, dep],
                [G.L, b[1] - v, dep],
                [G.L, b[1] + v, dep],
                [0, a[1] + v, dep],
              ],
              [0, 0, sign],
            );
          for (const [dy, sign] of [
            [v, 1],
            [-v, -1],
          ])
            G.emit(
              'trim',
              [
                [0, a[1] + dy, -v],
                [G.L, b[1] + dy, -v],
                [G.L, b[1] + dy, v],
                [0, a[1] + dy, v],
              ],
              [0, sign, 0],
            );
        }
      }
  const s = r.stairs,
    N = detail ? s.count : 3,
    step = (s.x1 - s.x0) / N;
  for (let i = 0; i < N; i++)
    box(
      f,
      'trim',
      s.x1 - (i + 0.5) * step,
      s.lo - 0.15,
      s.z,
      step + 0.002,
      s.lo + ((s.hi - s.lo) * (i + 1)) / N - (s.lo - 0.15),
      s.width,
    );
  prism(f, 'trim', r.landing, Y - 0.18, Y);
  if (detail) {
    const G = line([s.x1, s.z - s.width / 2], [s.x0, s.z - s.width / 2]);
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N,
        y = s.lo + (Y - s.lo) * t;
      box(G.emit, 'trim', G.L * t, y, 0, 0.08, 0.85, 0.1);
      const u0 = (G.L * i) / N,
        u1 = (G.L * (i + 1)) / N,
        y0 = s.lo + ((Y - s.lo) * i) / N,
        y1 = s.lo + ((Y - s.lo) * (i + 1)) / N;
      for (const [d, sign] of [
        [-0.08, -1],
        [0.08, 1],
      ])
        G.emit(
          'trim',
          [
            [u0, y0 + 0.82, d],
            [u1, y1 + 0.82, d],
            [u1, y1 + 0.95, d],
            [u0, y0 + 0.95, d],
          ],
          [0, 0, sign],
        );
      for (const [dy, sign] of [
        [0.82, -1],
        [0.95, 1],
      ])
        G.emit(
          'trim',
          [
            [u0, y0 + dy, -0.08],
            [u1, y1 + dy, -0.08],
            [u1, y1 + dy, 0.08],
            [u0, y0 + dy, 0.08],
          ],
          [0, sign, 0],
        );
      for (const [u, y, sign] of [
        [u0, y0, -1],
        [u1, y1, 1],
      ])
        G.emit(
          'trim',
          [
            [u, y + 0.82, -0.08],
            [u, y + 0.95, -0.08],
            [u, y + 0.95, 0.08],
            [u, y + 0.82, 0.08],
          ],
          [sign, 0, 0],
        );
    }
  }
}

/** Baghdad Kiosk: mapped canopy, open arcade, tiled cross-room and garden undercroft. */
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiBaghdad(face, detail, r) {
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
        if (detail >= 2 && o.kind !== 'door') {
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
    },
    railing = (a, b, entry = false) => {
      const G = line(a, b),
        emit = G.emit;
      if (entry) return;
      if (!detail) {
        panel(emit, 'trim', 0, G.L, Y + 0.02, Y + 0.15, 0);
        panel(emit, 'trim', 0, G.L, Y + 0.89, Y + 1.02, 0);
        return;
      }
      box(emit, 'trim', G.L / 2, Y + 0.02, 0, G.L, 0.13, 0.19);
      box(emit, 'trim', G.L / 2, Y + 0.89, 0, G.L, 0.13, 0.22);
      const N = Math.ceil(G.L / (detail === 3 ? 0.68 : detail === 2 ? 0.9 : 2.4));
      for (let i = 0; i <= N; i++)
        box(emit, 'trim', (G.L * i) / N, Y + 0.15, 0, detail ? 0.09 : 0.15, 0.74, 0.12);
      if (detail >= 2)
        for (let i = 0; i < N; i++) {
          const x = (G.L * (i + 0.5)) / N,
            w = (G.L / N) * 0.45,
            cy = Y + 0.52;
          for (const [d, sign] of [
            [0.065, 1],
            [-0.065, -1],
          ])
            for (let j = 0; j < 4; j++) {
              const a = (j * Math.PI) / 2,
                b = ((j + 1) * Math.PI) / 2;
              emit(
                'trim',
                [
                  [x + w * Math.cos(a), cy + 0.29 * Math.sin(a), d],
                  [x + w * Math.cos(b), cy + 0.29 * Math.sin(b), d],
                  [x + (w - 0.055) * Math.cos(b), cy + 0.235 * Math.sin(b), d],
                  [x + (w - 0.055) * Math.cos(a), cy + 0.235 * Math.sin(a), d],
                ],
                [0, 0, sign],
              );
            }
        }
    };

  // The complete mapped raised terrace seals the opening, including its open galleries.
  prism(f, 'floor', r.parent, Y - 0.2, Y);
  const base = r.parent.outline,
    sign = Math.sign(
      base.reduce(
        (s, p, i) =>
          s + p[0] * base[(i + 1) % base.length][1] - p[1] * base[(i + 1) % base.length][0],
        0,
      ),
    );
  for (let i = 0; i < base.length; i++) {
    const a = base[i],
      b = base[(i + 1) % base.length],
      G = line(a, b, sign),
      N = G.L > 8 ? Math.max(1, Math.floor(G.L / 6.5)) : 0;
    if (detail >= 2 && N) {
      const step = G.L / N,
        R = Math.min(1.5, step * 0.35),
        spring = Y - 1.45;
      let edge = 0;
      for (let j = 0; j < N; j++) {
        const x = step * (j + 0.5);
        box(
          G.emit,
          'wall',
          (edge + x - R) / 2,
          r.foundationBottom,
          -0.23,
          x - R - edge,
          Y - r.foundationBottom - 0.2,
          0.46,
        );
        header(G.emit, 'wall', x, R, spring, 0.95, Y - 0.2, 0.46);
        arch(G.emit, 'dark', x, R, r.foundationBottom, spring, 0.95, -0.5);
        edge = x + R;
      }
      if (edge < G.L)
        box(
          G.emit,
          'wall',
          (edge + G.L) / 2,
          r.foundationBottom,
          -0.23,
          G.L - edge,
          Y - r.foundationBottom - 0.2,
          0.46,
        );
    } else {
      box(
        G.emit,
        'wall',
        G.L / 2,
        r.foundationBottom,
        -0.23,
        G.L,
        Y - r.foundationBottom - 0.2,
        0.46,
      );
      if (detail)
        for (let j = 0; j < N; j++)
          arch(
            G.emit,
            'dark',
            (G.L * (j + 0.5)) / N,
            Math.min(1.4, (G.L / N) * 0.32),
            r.foundationBottom + 0.2,
            Y - 1.45,
            0.95,
            0.015,
          );
    }
    if (i !== 0 && i !== 7) railing(a, b);
  }
  // Roofed blue room cross; one genuine northwest entrance remains open at every level.
  for (const body of r.body) {
    const ps = body.outline,
      s = Math.sign(
        ps.reduce(
          (n, p, i) => n + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
          0,
        ),
      );
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i],
        b = ps[(i + 1) % ps.length],
        G = line(a, b, s),
        door = a[0] < -9.4 && b[0] < -9.4,
        garden = a[0] > 10 && b[0] > 10,
        N = garden ? 3 : Math.floor(G.L / 3.4),
        lower = [],
        upper = [];
      if (garden) {
        const step = G.L / 3,
          R = step * 0.415;
        for (let k = 0; k < 3; k++) {
          const x = step * (k + 0.5),
            left = x - R,
            right = x + R;
          if (k === 0) box(G.emit, 'trim', left / 2, Y, -0.21, left, r.roofY - Y - 0.08, 0.42);
          if (k > 0)
            box(G.emit, 'trim', k * step, Y, -0.21, step - 2 * R, r.roofY - Y - 0.08, 0.42);
          if (k === 2)
            box(G.emit, 'trim', (right + G.L) / 2, Y, -0.21, G.L - right, r.roofY - Y - 0.08, 0.42);
          box(G.emit, 'trim', x, Y, -0.21, R * 2, 0.45, 0.42);
          header(
            (role, ps, n) =>
              G.emit(
                role,
                ps.map(([u, y, d]) => [u, y, d - 0.21]),
                n,
              ),
            'trim',
            x,
            R,
            Y + 4.3,
            1.1,
            r.roofY - 0.08,
            0.42,
          );
          arch(G.emit, 'dark', x, R, Y + 0.45, Y + 4.3, 1.1, -0.46);
          if (detail)
            for (const yy of [Y + 0.5, Y + 1.1, Y + 2.7, Y + 3.3, Y + 4.25])
              box(G.emit, 'trim', x, yy, -0.1, R * 2, 0.09, 0.08);
          if (detail)
            for (let j = 1; j <= (detail >= 2 ? 5 : 2); j++)
              box(
                G.emit,
                'trim',
                left + (R * 2 * j) / (detail >= 2 ? 6 : 3),
                Y + 0.45,
                -0.1,
                0.075,
                3.85,
                0.075,
              );
          if (detail >= 2) {
            for (const u of [left, right]) box(G.emit, 'trim', u, Y + 0.45, 0.02, 0.13, 3.85, 0.13);
          }
        }
        continue;
      }
      if (door) lower.push({ x: G.L / 2, w: 1.4, lo: Y, hi: Y + 2.9, kind: 'door' });
      else if (detail >= 2)
        for (let j = 0; j < N; j++)
          lower.push({
            x: (G.L * (j + 0.5)) / N,
            w: garden ? 2.1 : 1.05,
            lo: Y + 0.55,
            hi: Y + 2.6,
            kind: 'lower',
          });
      if (detail >= 2 && !door)
        for (let j = 0; j < N; j++)
          upper.push({
            x: (G.L * (j + 0.5)) / N,
            w: garden ? 2.1 : 0.95,
            lo: Y + 3.35,
            hi: Y + 5.2,
            kind: 'upper',
          });
      wall(G, 'trim', Y, Y + 3.1, lower);
      wall(G, 'tile', Y + 3.1, r.roofY - 0.08, upper);
      if (detail < 2 && !door)
        for (let j = 0; j < (detail ? N : Math.min(N, 2)); j++) {
          const count = detail ? N : Math.min(N, 2),
            x = (G.L * (j + 0.5)) / count;
          panel(G.emit, 'dark', x - 0.52, x + 0.52, Y + 0.55, Y + 2.6, 0.015);
          panel(G.emit, 'dark', x - 0.46, x + 0.46, Y + 3.35, Y + 5.2, 0.015);
        }
      if (detail >= 2) {
        box(G.emit, 'trim', G.L / 2, Y + 3.02, 0.025, G.L, 0.13, 0.12);
        for (const o of upper) {
          const n = detail === 3 ? 12 : 6,
            R = o.w / 2;
          for (let j = 0; j < n; j++) {
            const a = -1 + (2 * j) / n,
              b = -1 + (2 * (j + 1)) / n,
              y0 = Y + 4.65 + pointed(a, 0.52),
              y1 = Y + 4.65 + pointed(b, 0.52);
            G.emit(
              'trim',
              [
                [o.x + R * a, y0, 0.04],
                [o.x + R * b, y1, 0.04],
                [o.x + (R + 0.055) * b, y1 + 0.065, 0.04],
                [o.x + (R + 0.055) * a, y0 + 0.065, 0.04],
              ],
              [0, 0, 1],
            );
          }
        }
      }
    }
  }
  // Galleries track the canopy's outside edges; shafts and arches stay open.
  const columns = new Map();
  for (const i of [0, 1, 2, 4, 5, 6, 7]) {
    const a = base[i],
      b = base[(i + 1) % base.length],
      G = line(a, b, sign),
      N = Math.max(1, Math.round(G.L / 5));
    for (let j = 0; j <= N; j++) {
      const x = a[0] + ((b[0] - a[0]) * j) / N,
        z = a[1] + ((b[1] - a[1]) * j) / N;
      columns.set(`${x.toFixed(3)}/${z.toFixed(3)}`, [x, z]);
    }
    for (let j = 0; j < N; j++) {
      const x = (G.L * (j + 0.5)) / N,
        R = G.L / N / 2;
      if (detail) header(G.emit, 'wall', x, R, Y + 4.3, 1.35, r.roofY - 0.08, 0.32);
      else panel(G.emit, 'wall', x - R, x + R, Y + 5.6, Y + 6.18, 0);
      if (detail >= 2) box(G.emit, 'dark', x, Y + 4.26, 0, R * 2, 0.045, 0.045);
    }
  }
  for (const [x, z] of columns.values()) {
    cylinder(
      'column',
      x,
      z,
      detail === 1
        ? [
            [Y, 0.31],
            [Y + 3.95, 0.24],
            [Y + 4.3, 0.43],
          ]
        : detail
          ? [
              [Y, 0.33],
              [Y + 0.15, 0.34],
              [Y + 0.27, 0.24],
              [Y + 3.8, 0.23],
              [Y + 3.95, 0.36],
              [Y + 4.3, 0.43],
            ]
          : [
              [Y, 0.27],
              [Y + 4.3, 0.27],
            ],
      [4, 6, 10, 14][detail],
    );
    if (detail)
      for (const y of [Y + 0.25, Y + 3.78])
        cylinder(
          'gold',
          x,
          z,
          [
            [y, 0.25],
            [y + 0.075, 0.25],
          ],
          detail === 1 ? 6 : 10,
        );
  }
  // Closed broad hip and warm soffit, with a shallow lead dome and a modest pointed stack.
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
  if (detail >= 2)
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7]) {
      const G = line(base[i], base[(i + 1) % base.length], sign);
      box(G.emit, 'wood', G.L / 2, r.roofY - 0.12, 0.01, G.L, 0.18, 0.16);
    }
  const d = r.dome,
    profile = [],
    rings = [2, 3, 5, 7][detail];
  for (let i = 0; i <= rings; i++) {
    const a = (i * Math.PI) / 2 / rings;
    profile.push([d.base + d.rise * Math.sin(a), Math.max(0.04, d.radius * Math.cos(a))]);
  }
  cylinder('roof', d.x, d.z, profile, [6, 10, 16, 24][detail]);
  cylinder(
    'gold',
    d.x,
    d.z,
    [
      [d.base + d.rise, 0.13],
      [d.base + d.rise + 0.15, 0.18],
      [d.base + d.rise + 0.3, 0.06],
      [d.base + d.rise + 0.65, 0.025],
    ],
    detail ? 6 : 4,
  );
  const ch = r.chimney;
  box(f, 'wall', ch.x, r.roofY + 0.3, ch.z, 0.85, 2, 0.85);
  cylinder(
    'roof',
    ch.x,
    ch.z,
    [
      [r.roofY + 2.25, 0.72],
      [r.roofY + 3.75, 0.035],
    ],
    4,
  );
  if (detail)
    for (const dz of [-0.435, 0.435])
      panel(
        line([ch.x - 0.3, ch.z + dz], [ch.x + 0.3, ch.z + dz]).emit,
        'dark',
        0,
        0.6,
        r.roofY + 1.8,
        r.roofY + 2.15,
        dz > 0 ? 0.01 : -0.01,
      );
  const stair = r.stairs,
    N = detail ? stair.count : 2,
    step = (stair.z1 - stair.z0) / N;
  for (let i = 0; i < N; i++)
    box(
      f,
      'floor',
      stair.x,
      Math.min(stair.lo, Y) - 0.25,
      stair.z1 - (i + 0.5) * step,
      stair.width,
      stair.lo + ((Y - stair.lo) * (i + 1)) / N - (Math.min(stair.lo, Y) - 0.25),
      step + 0.003,
    );
}

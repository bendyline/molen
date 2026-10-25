/** Sofa Kiosk: faceted projecting room, long open portico and descending garden stair. */
import earcut from 'earcut';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiSofa(face, detail, r) {
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
    };

  const ellipse = (emit, x, y, rx, ry) => {
    const N = [0, 6, 10, 16][detail];
    for (let i = 0; i < N; i++) {
      const a = (i * 2 * Math.PI) / N,
        b = ((i + 1) * 2 * Math.PI) / N,
        outer = (t) => [x + rx * Math.cos(t), y + ry * Math.sin(t)],
        inner = (t) => [x + (rx - 0.055) * Math.cos(t), y + (ry - 0.055) * Math.sin(t)],
        A = outer(a),
        B = outer(b),
        C = inner(b),
        D = inner(a);
      for (const [d, sgn] of [
        [0.04, 1],
        [0.005, -1],
      ])
        emit(
          'trim',
          [
            [...A, d],
            [...B, d],
            [...C, d],
            [...D, d],
          ],
          [0, 0, sgn],
        );
      if (detail >= 2) {
        emit(
          'trim',
          [
            [...A, 0.005],
            [...B, 0.005],
            [...B, 0.04],
            [...A, 0.04],
          ],
          [Math.cos(a), Math.sin(a), 0],
        );
        emit(
          'trim',
          [
            [...D, 0.005],
            [...C, 0.005],
            [...C, 0.04],
            [...D, 0.04],
          ],
          [-Math.cos(a), -Math.sin(a), 0],
        );
      }
    }
  };
  for (const room of r.rooms) {
    const ps = room.body.outline,
      x0 = Math.min(...ps.map((p) => p[0])),
      x1 = Math.max(...ps.map((p) => p[0])),
      z0 = Math.min(...ps.map((p) => p[1])),
      z1 = Math.max(...ps.map((p) => p[1])),
      sign = Math.sign(
        ps.reduce(
          (s, p, i) => s + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
          0,
        ),
      );
    prism(f, 'floor', room.body, Y - 0.25, Y);
    // Moulded perimeter beams sit directly on the stone capitals.
    if (detail)
      for (let i = 0; i < ps.length; i++) {
        const G = line(ps[i], ps[(i + 1) % ps.length], sign);
        for (const [h, w] of [
          [-0.3, 0.26],
          [-0.12, 0.34],
          [0.09, 0.22],
        ])
          box(G.emit, 'trim', G.L / 2, Y + h, 0, G.L, 0.12, w);
      }
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i],
        b = ps[(i + 1) % ps.length],
        G = line(a, b, sign),
        mx = (a[0] + b[0]) / 2,
        mz = (a[1] + b[1]) / 2,
        front = mz < z0 + 0.6,
        outer = room.glazed ? mx < x0 + 0.6 : mx > x1 - 0.6,
        back = mz > z1 - 0.6,
        inner = room.glazed ? mx > x1 - 0.6 : mx < x0 + 0.6,
        door = inner && mz > -3 && mz < 2.5,
        glazed = room.glazed && (front || outer),
        blank = !room.glazed && outer,
        N = door
          ? 1
          : glazed
            ? Math.max(1, Math.round(G.L / 2.1))
            : front
              ? 3
              : Math.max(1, Math.floor(G.L / 4)),
        count = detail ? N : Math.min(N, 2),
        low = Y + (glazed ? 0.65 : 0.7),
        mid = Y + (room.glazed ? 3.1 : 2.8),
        upperLow = Y + (room.glazed ? 3.35 : 3.45),
        upperHi = Y + (room.glazed ? 4.05 : 4.65),
        opens = [];
      if (door) opens.push({ x: G.L / 2, w: 1.15, lo: Y, hi: Y + 2.6, kind: 'door' });
      else if (detail >= 2)
        for (let j = 0; j < (blank || back ? 1 : count); j++) {
          const n = blank || back ? 1 : count,
            x = (G.L * (j + 0.5)) / n,
            w = blank || back ? 0.62 : glazed ? G.L / n - 0.16 : 0.95;
          opens.push({ x, w, lo: low, hi: blank || back ? Y + 1.8 : mid, kind: 'lower' });
        }
      const role = blank ? 'render' : 'wall';
      wall(G, role, Y, Y + (room.glazed ? 3.25 : 3.1), opens);
      const upper = [];
      if (detail >= 2 && !blank && !back)
        for (let j = 0; j < count; j++)
          upper.push({
            x: (G.L * (j + 0.5)) / count,
            w: glazed ? G.L / count - 0.2 : 0.9,
            lo: upperLow,
            hi: upperHi,
            kind: 'upper',
          });
      wall(G, role, Y + (room.glazed ? 3.25 : 3.1), Y + room.eaves - 0.08, upper);
      if (detail < 2 && !door)
        for (let j = 0; j < (blank || back ? 1 : count); j++) {
          const n = blank || back ? 1 : count,
            x = (G.L * (j + 0.5)) / n,
            w = blank || back ? 0.62 : glazed ? G.L / n - 0.16 : 0.95;
          panel(G.emit, 'dark', x - w / 2, x + w / 2, low, blank || back ? Y + 1.8 : mid, 0.015);
          if (!blank && !back)
            panel(G.emit, 'dark', x - w / 2, x + w / 2, upperLow, upperHi, 0.015);
        }
      if (detail && !blank && !back) {
        for (let j = 0; j < count; j++) {
          const x = (G.L * (j + 0.5)) / count,
            w = glazed ? G.L / count - 0.2 : 0.9;
          if (room.glazed)
            ellipse(G.emit, x, (upperLow + upperHi) / 2, w * 0.37, (upperHi - upperLow) * 0.4);
          else if (detail >= 2) {
            const n = detail === 3 ? 12 : 8,
              R = w * 0.6;
            for (let k = 0; k < n; k++) {
              const a = -1 + (2 * k) / n,
                b = -1 + (2 * (k + 1)) / n,
                ya = upperHi + 0.06 + 0.3 * Math.sqrt(Math.max(0, 1 - a * a)),
                yb = upperHi + 0.06 + 0.3 * Math.sqrt(Math.max(0, 1 - b * b));
              G.emit(
                'trim',
                [
                  [x + R * a, ya, 0.04],
                  [x + R * b, yb, 0.04],
                  [x + (R + 0.06) * b, yb + 0.06, 0.04],
                  [x + (R + 0.06) * a, ya + 0.06, 0.04],
                ],
                [0, 0, 1],
              );
            }
            for (const dx of [-w * 0.53, w * 0.53])
              box(
                G.emit,
                'trim',
                x + dx,
                upperLow - 0.08,
                0.025,
                0.085,
                upperHi - upperLow + 0.16,
                0.1,
              );
            if (detail === 3)
              for (const dx of [-w * 0.56, w * 0.56])
                ellipse(G.emit, x + dx, upperHi + 0.08, 0.105, 0.135);
            for (const h of [0.18, 0.52]) {
              box(G.emit, 'trim', x, Y + h, 0.025, w + 0.12, 0.045, 0.06);
            }
          }
          if (detail >= 2 && !glazed) {
            for (const dx of [-w * 0.58, w * 0.58])
              box(G.emit, 'trim', x + dx, Y + 0.65, 0.025, 0.12, 2.2, 0.12);
          }
        }
        for (const y of room.glazed
          ? [Y + 0.24, Y + 3.15, Y + 4.16]
          : [Y + 0.2, Y + 0.55, Y + 3.0, Y + 4.95])
          box(G.emit, 'trim', G.L / 2, y, 0.02, G.L, 0.095, 0.12);
        if (front)
          for (let j = 0; j <= count; j++) {
            const x = (G.L * j) / count;
            box(G.emit, 'trim', x, Y + 0.12, 0.025, 0.18, room.eaves - 0.3, 0.14);
            if (detail === 3)
              for (const h of [0.7, 1.2, 1.7, 2.2, 2.7, 3.2, 3.7, 4.2])
                if (h < room.eaves - 0.4) box(G.emit, 'wall', x, Y + h, 0.105, 0.2, 0.035, 0.035);
          }
      }
    }
    // The original rear support line is represented inside the model's own footprint.
    const back = room.back;
    box(
      f,
      'stone',
      (back.x0 + back.x1) / 2,
      back.bottomY,
      back.z,
      back.x1 - back.x0 + 0.4,
      Y - 0.25 - back.bottomY,
      0.35,
    );
    for (const c of room.columns) {
      cylinder(
        'column',
        c.x,
        c.z,
        detail === 0
          ? [
              [c.baseY, 0.28],
              [Y - 0.25, 0.27],
            ]
          : detail === 1
            ? [
                [c.baseY, 0.34],
                [c.baseY + 0.25, 0.2],
                [Y - 0.6, 0.18],
                [Y - 0.25, 0.38],
              ]
            : [
                [c.baseY, 0.34],
                [c.baseY + 0.15, 0.35],
                [c.baseY + 0.3, 0.25],
                [c.baseY + 0.4, 0.18],
                [Y - 0.75, 0.16],
                [Y - 0.63, 0.25],
                [Y - 0.46, 0.31],
                [Y - 0.25, 0.4],
              ],
        [4, 6, 10, 14][detail],
      );
    }
    prism(f, 'trim', room.roof, Y + room.eaves - 0.08, Y + room.eaves);
    for (const p of room.roofShards) {
      const ix = earcut(p.flatMap((q) => [q[0], q[2]]));
      for (let j = 0; j < ix.length; j += 3)
        f(
          'roof',
          ix.slice(j, j + 3).map((k) => p[k]),
          [0, 1, 0],
        );
    }
    const cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2,
      top = Y + room.eaves + room.rise;
    cylinder(
      'gold',
      cx,
      cz,
      detail
        ? [
            [top, 0.15],
            [top + 0.12, 0.19],
            [top + 0.27, 0.07],
            [top + 0.41, 0.14],
            [top + 0.56, 0.045],
            [top + 0.75, 0.025],
          ]
        : [
            [top, 0.12],
            [top + 0.7, 0.025],
          ],
      detail ? 6 : 4,
    );
  }
  // Shared upper corridor and real round arched entrance above the central stair.
  prism(f, 'floor', r.core, Y - 0.25, Y);
  box(f, 'floor', -1.4, Y - 0.25, -0.3, 5.2, 0.25, 4.3);
  const ps = r.core.outline,
    sign = Math.sign(
      ps.reduce(
        (s, p, i) => s + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
        0,
      ),
    );
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i],
      b = ps[(i + 1) % ps.length],
      G = line(a, b, sign),
      front = (a[1] + b[1]) / 2 < -3,
      sides = Math.abs(a[0] - b[0]) < 0.1,
      top = Y + 3.45;
    if (front) {
      const x = G.L / 2,
        R = 1.05;
      box(G.emit, 'stone', (x - R) / 2, -0.6, -0.22, x - R, top + 0.6, 0.44);
      box(G.emit, 'stone', (x + R + G.L) / 2, -0.6, -0.22, G.L - x - R, top + 0.6, 0.44);
      box(G.emit, 'stone', x, -0.6, -0.22, R * 2, Y + 0.6, 0.44);
      const n = [2, 4, 8, 14][detail];
      for (let j = 0; j < n; j++) {
        const u = -1 + (2 * j) / n,
          v = -1 + (2 * (j + 1)) / n,
          ya = Y + 1.5 + 1.05 * Math.sqrt(Math.max(0, 1 - u * u)),
          yb = Y + 1.5 + 1.05 * Math.sqrt(Math.max(0, 1 - v * v));
        for (const [d, sgn] of [
          [0, 1],
          [-0.44, -1],
        ])
          G.emit(
            'stone',
            [
              [x + R * u, ya, d],
              [x + R * v, yb, d],
              [x + R * v, top, d],
              [x + R * u, top, d],
            ],
            [0, 0, sgn],
          );
        G.emit(
          'column',
          [
            [x + R * u, ya, 0],
            [x + R * v, yb, 0],
            [x + R * v, yb, -0.44],
            [x + R * u, ya, -0.44],
          ],
          [0, -1, 0],
        );
        if (detail >= 2)
          G.emit(
            'column',
            [
              [x + R * u, ya, 0.025],
              [x + R * v, yb, 0.025],
              [x + (R + 0.18) * v, yb + 0.18, 0.025],
              [x + (R + 0.18) * u, ya + 0.18, 0.025],
            ],
            [0, 0, 1],
          );
      }
    } else if (sides) {
      wall(G, 'stone', Y, top, [{ x: G.L / 2, w: 1.25, lo: Y, hi: Y + 2.65, kind: 'door' }]);
      box(G.emit, 'stone', G.L / 2, -0.6, -0.22, G.L, Y + 0.6, 0.44);
    } else box(G.emit, 'stone', G.L / 2, -0.6, -0.22, G.L, top + 0.6, 0.44);
  }
  prism(f, 'roof', r.core, Y + 3.45, Y + 3.55);
  const s = r.stairs,
    N = detail ? s.count : 3,
    step = (s.z1 - s.z0) / N,
    bottom = s.lo - 0.15;
  for (let i = 0; i < N; i++)
    box(
      f,
      'column',
      s.x,
      bottom,
      s.z0 + (i + 0.5) * step,
      s.width,
      s.lo + ((Y - s.lo) * (i + 1)) / N - bottom,
      step + 0.003,
    );
  for (const x of [s.x - s.width / 2 - 0.1, s.x + s.width / 2 + 0.1]) {
    for (const [dx, sgn] of [
      [-0.1, -1],
      [0.1, 1],
    ])
      f(
        'stone',
        [
          [x + dx, bottom, s.z0],
          [x + dx, bottom, s.z1],
          [x + dx, Y + 0.85, s.z1],
          [x + dx, s.lo + 0.85, s.z0],
        ],
        [sgn, 0, 0],
      );
    f(
      'column',
      [
        [x - 0.13, s.lo + 0.85, s.z0],
        [x + 0.13, s.lo + 0.85, s.z0],
        [x + 0.13, Y + 0.85, s.z1],
        [x - 0.13, Y + 0.85, s.z1],
      ],
      [0, 1, 0],
    );
    for (const [z, h, sgn] of [
      [s.z0, s.lo, -1],
      [s.z1, Y, 1],
    ])
      f(
        'stone',
        [
          [x - 0.1, bottom, z],
          [x + 0.1, bottom, z],
          [x + 0.1, h + 0.85, z],
          [x - 0.1, h + 0.85, z],
        ],
        [0, 0, sgn],
      );
  }
}

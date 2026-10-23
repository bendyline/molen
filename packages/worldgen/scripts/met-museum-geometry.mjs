/** 'N0740': Met Fifth Avenue arches, paired columns, mapped wings and park glazing. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildMetMuseum(face, detail, r) {
  const P = ([x, y, z]) => [
      x * r.xAxis[0] + z * r.zAxis[0],
      r.floorY + y,
      x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, N) => face(role, ps.map(P), D(N)),
    adapter = {
      addQuad: (role, _ref, ps, N) => f(role, ps, N),
      addConvexPolygon: (role, _ref, ps, N) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], N);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    bottom = r.minGround - r.floorY - 0.5,
    ring = (x, y, z, R, n) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n,
          radius = R * (detail === 3 && i % 2 ? 0.96 : 1);
        return [x + radius * Math.cos(a), y, z + radius * Math.sin(a)];
      }),
    loft = (role, rings, caps = true) => {
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < rings[j].length; i++) {
          const k = (i + 1) % rings[j].length,
            a = rings[j - 1][i],
            b = rings[j - 1][k],
            c = rings[j].reduce((s, p) => s.map((v, k) => v + p[k] / rings[j].length), [0, 0, 0]);
          f(
            role,
            [a, b, rings[j][k], rings[j][i]],
            [(a[0] + b[0]) / 2 - c[0], 0, (a[2] + b[2]) / 2 - c[2]],
          );
        }
      if (caps)
        for (const [ps, dy] of [
          [rings[0], -1],
          [rings.at(-1), 1],
        ]) {
          const c = ps.reduce((s, p) => s.map((v, k) => v + p[k] / ps.length), [0, 0, 0]);
          for (let i = 0; i < ps.length; i++)
            f(role, [c, ps[i], ps[(i + 1) % ps.length]], [0, dy, 0]);
        }
    },
    skin = (role, ps, thickness = 0.15) => {
      const lows = ps.map((p) => [p[0], p[1] - thickness, p[2]]),
        center = ps.reduce((s, p) => s.map((v, k) => v + p[k] / ps.length), [0, 0, 0]);
      // Top and underside use the same diagonal, including non-planar roof corners.
      for (const ids of [
        [0, 1, 2],
        [0, 2, 3],
      ]) {
        f(
          role,
          ids.map((i) => ps[i]),
          [0, 1, 0],
        );
        f(
          role,
          ids.map((i) => lows[i]),
          [0, -1, 0],
        );
      }
      for (let i = 0; i < ps.length; i++) {
        const j = (i + 1) % ps.length;
        f(
          role,
          [ps[i], lows[i], lows[j], ps[j]],
          [(ps[i][0] + ps[j][0]) / 2 - center[0], 0, (ps[i][2] + ps[j][2]) / 2 - center[2]],
        );
      }
    },
    arch = (x, y0, spring, R, z, role = 'glass', n = [4, 6, 12, 20][detail]) => {
      const p = [
        [x - R, y0, z],
        [x + R, y0, z],
        ...Array.from({ length: n + 1 }, (_, i) => {
          const a = (i * Math.PI) / n;
          return [x + R * Math.cos(a), spring + R * Math.sin(a), z];
        }),
      ];
      // Convex arched infill, closed against the occupied gallery wall behind it.
      for (let i = 1; i < p.length - 1; i++) f(role, [p[0], p[i], p[i + 1]], [0, 0, 1]);
    };

  for (const b of r.bodyLevels[detail])
    prism(
      (role, ps, N) => f(N[1] > 0.5 && b.name !== 'entrance-recess' ? 'roof' : role, ps, N),
      b.role,
      b.geometry,
      bottom,
      b.height,
      detail > 1,
    );

  const stair = r.stairs,
    ns = [1, 4, 12, 20][detail];
  for (let i = 0; i < ns; i++) {
    const za = stair.z0 + ((stair.z1 - stair.z0) * i) / ns,
      zb = stair.z0 + ((stair.z1 - stair.z0) * (i + 1)) / ns,
      y = 3 * (1 - i / ns);
    box(f, 'paving', 0, bottom, (za + zb) / 2, stair.x1 - stair.x0, y - bottom, zb - za);
  }

  // The three entrance arches are recessed, with glazing at the back of each bay.
  if (detail) {
    for (const [a, b] of [
      [-31.25, -24.5],
      [-11.5, -6.5],
      [6.5, 11.5],
      [24.5, 31.25],
    ])
      box(f, 'stone', (a + b) / 2, 3, 83.35, b - a, 21, 5.9);
    for (const x of [-18, 0, 18]) {
      const n = [0, 6, 12, 20][detail],
        R = 6.5,
        spring = 13.5;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * i) / n,
          b = (Math.PI * (i + 1)) / n,
          A = [x + R * Math.cos(a), spring + R * Math.sin(a)],
          B = [x + R * Math.cos(b), spring + R * Math.sin(b)];
        for (const [z, sign] of [
          [86.3, 1],
          [80.4, -1],
        ])
          f(
            'stone',
            [
              [A[0], A[1], z],
              [B[0], B[1], z],
              [B[0], 24, z],
              [A[0], 24, z],
            ],
            [0, 0, sign],
          );
        f(
          'trim',
          [
            [A[0], A[1], 80.4],
            [A[0], A[1], 86.3],
            [B[0], B[1], 86.3],
            [B[0], B[1], 80.4],
          ],
          [-Math.cos((a + b) / 2), -Math.sin((a + b) / 2), 0],
        );
        if (detail >= 2) {
          const Q = (t) => [x + (R + 0.55) * Math.cos(t), spring + (R + 0.55) * Math.sin(t), 86.39];
          f('trim', [[A[0], A[1], 86.39], [B[0], B[1], 86.39], Q(b), Q(a)], [0, 0, 1]);
        }
      }
      arch(x, 3, spring, R, 80.52);
      if (detail >= 2) {
        for (const dx of [-2.5, 2.5]) box(f, 'trim', x + dx, 3, 80.7, 0.45, 10.9, 0.35);
        box(f, 'trim', x, 7.2, 80.7, 12.7, 0.5, 0.35);
        if (x === 0) for (const dx of [-4, 0, 4]) box(f, 'metal', dx, 3.1, 80.9, 0.16, 4, 0.12);
      }
    }
  } else {
    box(f, 'stone', 0, 3, 83.35, 62.5, 21, 5.9);
    for (const x of [-18, 0, 18]) arch(x, 3.1, 13.5, 6.5, 86.32);
  }

  // Deep entablature and attic continue across the entrance; projecting sections sit over the paired columns.
  box(f, 'trim', 0, 21.7, 83.8, 64, 1.1, 7);
  box(f, 'stone', 0, 24, 83.4, 62.6, 2.8, 6.1);
  box(f, 'trim', 0, 23.25, 83.8, 65, 0.75, 7.3);
  if (detail) {
    const nc = [4, 6, 12, 24][detail];
    for (const x0 of [-28.4, -9, 9, 28.4]) {
      box(f, 'trim', x0, 22.2, 86.1, 5.5, 1.8, 3.1);
      for (const x of [x0 - 1.05, x0 + 1.05]) {
        box(f, 'trim', x, 3, 87.1, 2, 0.55, 2);
        loft('trim', [
          ring(x, 3.55, 87.1, 0.96, nc),
          ring(x, 3.9, 87.1, 0.84, nc),
          ring(x, 19.8, 87.1, 0.68, nc),
        ]);
        loft('trim', [
          ring(x, 19.8, 87.1, 0.68, nc),
          ring(x, 21, 87.1, 1.08, nc),
          ring(x, 21.6, 87.1, 1.02, nc),
        ]);
        box(f, 'trim', x, 21.6, 87.1, 2.3, 0.35, 2.3);
        if (detail === 3) {
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4,
              c = [x + 0.78 * Math.cos(a), 20.4, 87.1 + 0.78 * Math.sin(a)];
            loft('trim', [
              ring(c[0], 20.05, c[2], 0.19, 4),
              ring(c[0], 20.7, c[2], 0.32, 4),
              ring(c[0], 21.05, c[2], 0.12, 4),
            ]);
          }
        }
      }
      if (detail >= 2) {
        box(f, 'stone', x0, 26.8, 85.8, 3.2, 0.8, 2.7);
        loft('trim', [ring(x0, 27.6, 85.8, 0.7, 8), ring(x0, 28.15, 85.8, 0.45, 8)]);
      }
    }
    if (detail >= 2) {
      for (let x = -30; x <= 30; x += 1.5) box(f, 'trim', x, 22.65, 87.1, 0.35, 0.45, 0.6);
      for (const x of [-28.5, 28.5]) {
        bar('metal', [x, 1, 103], [x, 4, 87], 0.11);
        for (let i = 0; i <= 4; i++)
          bar(
            'metal',
            [x, (3 * i) / 4, 103 - (16 * i) / 4],
            [x, 1 + (3 * i) / 4, 103 - (16 * i) / 4],
            0.09,
          );
      }
    }
  }

  // Pale cornices and shallow roof parapets define the classical front wings and end pavilions.
  if (detail)
    for (const b of r.bodyLevels[detail].filter((b) => /front-pavilion|front-wing/.test(b.name))) {
      const p = b.geometry.outline;
      for (let i = 0; i < p.length; i++) {
        const a = p[i],
          q = p[(i + 1) % p.length];
        if (Math.hypot(q[0] - a[0], q[1] - a[1]) < 1) continue;
        bar('trim', [a[0], b.height - 0.35, a[1]], [q[0], b.height - 0.35, q[1]], 0.65, 0.85);
        if (detail >= 2)
          bar('stone', [a[0], b.height + 0.65, a[1]], [q[0], b.height + 0.65, q[1]], 1, 0.6);
      }
    }

  for (const w of r.glassWings) {
    const xm = (w.x0 + w.x1) / 2,
      ridge = w.ridge,
      wall = w.wall,
      y = (x) => wall + (ridge - wall) * (1 - Math.abs(x - xm) / (w.x1 - xm));
    skin('glass', [
      [w.x0, wall, w.z0],
      [xm, ridge, w.z0],
      [xm, ridge, w.z1],
      [w.x0, wall, w.z1],
    ]);
    skin('glass', [
      [xm, ridge, w.z0],
      [w.x1, wall, w.z0],
      [w.x1, wall, w.z1],
      [xm, ridge, w.z1],
    ]);
    for (const [z, sign] of [
      [w.z0 - 0.04, -1],
      [w.z1 + 0.04, 1],
    ]) {
      f(
        'glass',
        [
          [w.x0, 2, z],
          [w.x1, 2, z],
          [w.x1, wall, z],
          [w.x0, wall, z],
        ],
        [0, 0, sign],
      );
      f(
        'glass',
        [
          [w.x0, wall, z],
          [w.x1, wall, z],
          [xm, ridge, z],
        ],
        [0, 0, sign],
      );
      if (detail) {
        const n = [0, 4, 10, 22][detail];
        for (let i = 0; i <= n; i++) {
          const x = w.x0 + ((w.x1 - w.x0) * i) / n;
          bar(
            'metal',
            [x, 2, z + sign * 0.07],
            [x, y(x), z + sign * 0.07],
            detail === 1 ? 0.35 : 0.13,
          );
        }
        for (let v = 5; v < wall; v += detail === 1 ? 6 : 3.4)
          bar('metal', [w.x0, v, z + sign * 0.07], [w.x1, v, z + sign * 0.07], 0.13);
      }
    }
    if (detail) {
      const n = [0, 3, 7, 20][detail];
      for (let i = 0; i <= n; i++) {
        const z = w.z0 + ((w.z1 - w.z0) * i) / n;
        bar('metal', [w.x0, wall + 0.05, z], [xm, ridge + 0.05, z], 0.13);
        bar('metal', [xm, ridge + 0.05, z], [w.x1, wall + 0.05, z], 0.13);
      }
      for (let i = 0; i <= n; i++) {
        const x = w.x0 + ((w.x1 - w.x0) * i) / n;
        bar('metal', [x, y(x) + 0.05, w.z0], [x, y(x) + 0.05, w.z1], 0.13);
      }
    }
  }

  // Rear Lehman hip follows its actual polygonal projection rather than an unrelated octagonal proxy.
  for (const b of r.bodyLevels[detail].filter((b) => b.name === 'lehman')) {
    const p = b.geometry.outline,
      c = p.reduce((s, p) => s.map((v, k) => v + p[k] / b.geometry.outline.length), [0, 0]),
      lower = p.map((p) => [p[0], 17, p[1]]),
      upper = p.map((p) => [c[0] + (p[0] - c[0]) * 0.5, 23, c[1] + (p[1] - c[1]) * 0.5]);
    loft('roof', [lower, upper]);
    if (detail) for (let i = 0; i < p.length; i++) bar('metal', lower[i], upper[i], 0.22);
  }
  skin(
    'roof',
    [
      [-22, 26.8, -53.2],
      [0, 30, -53.2],
      [0, 30, 41.9],
      [-22, 26.8, 41.9],
    ],
    0.2,
  );
  skin(
    'roof',
    [
      [0, 30, -53.2],
      [22, 26.8, -53.2],
      [22, 26.8, 41.9],
      [0, 30, 41.9],
    ],
    0.2,
  );
  for (const z of [-53.2, 41.9])
    f(
      'brick',
      [
        [-22, 26.8, z],
        [22, 26.8, z],
        [0, 30, z],
      ],
      [0, 0, Math.sign(z)],
    );

  if (detail)
    for (const [i, w] of r.windows.entries()) {
      if (detail === 1 && i % 3) continue;
      const point = (u, y, offset = 0.055) => [
          w.x + w.T[0] * u + w.N[0] * offset,
          y,
          w.z + w.T[2] * u + w.N[2] * offset,
        ],
        spring = w.arched ? w.y1 - w.w : w.y1,
        ps = [
          point(-w.w, w.y0),
          point(w.w, w.y0),
          ...Array.from({ length: w.arched ? [0, 4, 8, 12][detail] + 1 : 2 }, (_, i) => {
            if (!w.arched) return point(i ? -w.w : w.w, w.y1);
            const angle = (Math.PI * i) / [0, 4, 8, 12][detail];
            return point(w.w * Math.cos(angle), spring + w.w * Math.sin(angle));
          }),
        ];
      for (let j = 1; j < ps.length - 1; j++) f('glass', [ps[0], ps[j], ps[j + 1]], w.N);
      if (detail >= 2) {
        bar('trim', point(-w.w - 0.2, w.y0), point(-w.w - 0.2, spring), 0.32, 0.24);
        bar('trim', point(w.w + 0.2, w.y0), point(w.w + 0.2, spring), 0.32, 0.24);
        bar('trim', point(-w.w - 0.4, w.y0), point(w.w + 0.4, w.y0), 0.4, 0.5);
        if (w.arched) for (let j = 2; j < ps.length - 1; j++) bar('trim', ps[j], ps[j + 1], 0.25);
        else bar('trim', point(-w.w - 0.2, w.y1), point(w.w + 0.2, w.y1), 0.35);
        if (detail === 3) bar('metal', point(0, w.y0, 0.1), point(0, w.y1, 0.1), 0.1);
      }
    }
  if (detail >= 2)
    for (const q of r.rooflights) {
      const { x, z, width: w, depth: d, height: h } = q;
      box(f, 'trim', x, h, z, w, 0.5, d);
      skin('glass', [
        [x - w / 2, h + 0.5, z - d / 2],
        [x, h + 2, z - d / 2],
        [x, h + 2, z + d / 2],
        [x - w / 2, h + 0.5, z + d / 2],
      ]);
      skin('glass', [
        [x, h + 2, z - d / 2],
        [x + w / 2, h + 0.5, z - d / 2],
        [x + w / 2, h + 0.5, z + d / 2],
        [x, h + 2, z + d / 2],
      ]);
      for (const t of [-d / 2, d / 2])
        f(
          'glass',
          [
            [x - w / 2, h + 0.5, z + t],
            [x + w / 2, h + 0.5, z + t],
            [x, h + 2, z + t],
          ],
          [0, 0, Math.sign(t)],
        );
      for (const t of [-d / 2, 0, d / 2]) {
        bar('metal', [x - w / 2, h + 0.55, z + t], [x, h + 2.05, z + t], 0.13);
        bar('metal', [x, h + 2.05, z + t], [x + w / 2, h + 0.55, z + t], 0.13);
      }
    }
  // Roof machinery is represented only by a few merged neutral service housings at close range.
  if (detail === 3)
    for (const x of [-126, -105, -73]) {
      box(f, 'metal', x, 19.05, -43, 8, 2.6, 5);
      for (const z of [-44.8, -43.6, -42.4, -41.2]) box(f, 'roof', x, 21.65, z, 6.5, 0.15, 0.18);
    }
}

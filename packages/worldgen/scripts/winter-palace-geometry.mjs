/** 'N0894': Native Winter Palace courts, Baroque bays, open passages and two cupolas. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildWinterPalace(face, detail, r) {
  const P = ([x, y, z]) => [
      x * r.xAxis[0] + z * r.zAxis[0],
      y + r.floorY,
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
    bar = (role, a, b, width, depth = width) => beam(adapter, role, a, b, width, depth, [1, 1, 1]),
    bottom = r.minGround - r.floorY - 0.5,
    ring = (x, y, z, radius, n) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n;
        return [x + radius * Math.cos(a), y, z + radius * Math.sin(a)];
      }),
    loft = (role, rings) => {
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
      for (const [ps, sign] of [
        [rings[0], -1],
        [rings.at(-1), 1],
      ]) {
        const c = ps.reduce((s, p) => s.map((v, k) => v + p[k] / ps.length), [0, 0, 0]);
        for (let i = 0; i < ps.length; i++)
          f(role, [c, ps[i], ps[(i + 1) % ps.length]], [0, sign, 0]);
      }
    };
  // Occupied floors preserve every courtyard. Only the actual passage corridors are opened above them.
  for (const p of detail ? r.body : []) prism(f, 'floor', p, bottom, 0.2, detail > 1);
  for (const p of r.bodyLevels[detail])
    prism(
      (role, ps, N) => {
        if (N[1] < 0.5) f(role, ps, N);
      },
      'wall',
      p,
      detail ? 0.2 : bottom,
      22,
      false,
    );
  for (const t of r.roofPanels[detail]) f('roof', t, [0, 1, 0]);
  for (const b of r.portalBands[detail])
    prism(
      (role, ps, N) =>
        f(
          role,
          ps.map(([x, y, z]) => [
            x,
            y === 0 ? b.y0 + ((b.y1 - b.y0) * (x - b.x0)) / (b.x1 - b.x0) : 22,
            z,
          ]),
          N,
        ),
      'wall',
      b.geometry,
      0,
      22,
    );

  for (const edge of r.edges) {
    const { a, b, N, L } = edge;
    if (!detail || (detail === 1 && L < 15)) continue;
    bar('trim', [a[0], 22.25, a[1]], [b[0], 22.25, b[1]], detail ? 0.75 : 1.2, 0.9);
    if (!detail) continue;
    if (detail >= 2) bar('trim', [a[0], 7.2, a[1]], [b[0], 7.2, b[1]], 0.45, 0.55);
    if (detail >= 2) bar('trim', [a[0], 23.4, a[1]], [b[0], 23.4, b[1]], 0.32, 0.5);
    if (detail === 3) {
      const n = Math.max(1, Math.floor(L / (detail === 3 ? 1.8 : 5)));
      for (let i = 0; i <= n; i++) {
        const t = i / n,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        // Turned balusters become coarse closed posts at street distance.
        if (detail === 3) box(f, 'trim', x, 22.6, z, 0.25, 0.7, 0.25);
        else box(f, 'trim', x, 22.6, z, 0.25, 0.7, 0.25);
      }
    }
    if (detail === 3 && L > 8) {
      const n = Math.max(1, Math.floor(L / 22));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n,
          x = a[0] + (b[0] - a[0]) * t,
          z = a[1] + (b[1] - a[1]) * t;
        box(f, 'trim', x, 23.4, z, 1, 0.6, 1);
        loft('trim', [
          ring(x, 24, z, 0.32, 4),
          ring(x + N[0] * 0.1, 25.3, z + N[2] * 0.1, 0.39, 4),
          ring(x, 25.8, z, 0.2, 4),
        ]);
        loft('trim', [ring(x, 25.8, z, 0.25, 6), ring(x, 26.2, z, 0.1, 6)]);
      }
    }
  }

  const archPoints = (w, y0, spring, radius, offset = 0.065) => {
      const n = [2, 3, 5, 8][detail],
        point = (u, y) => [
          w.x + w.T[0] * u + w.N[0] * offset,
          y,
          w.z + w.T[2] * u + w.N[2] * offset,
        ];
      return [
        point(-radius, y0),
        point(radius, y0),
        ...Array.from({ length: n + 1 }, (_, i) =>
          point(
            radius * Math.cos((i * Math.PI) / n),
            spring + radius * Math.sin((i * Math.PI) / n),
          ),
        ),
      ];
    },
    plane = (role, ps, N) => {
      for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], N);
    };
  if (detail)
    for (const [index, w] of r.windows.entries()) {
      if ((detail === 1 && index % 3) || (detail === 2 && w.court && index % 2)) continue;
      const point = (u, y, offset = 0.075) => [
          w.x + w.T[0] * u + w.N[0] * offset,
          y,
          w.z + w.T[2] * u + w.N[2] * offset,
        ],
        width = w.width,
        rows = [
          [1.1, 6.2],
          [8.2, 15.4],
          [17.1, 20.4],
        ];
      for (const [j, [lo, hi]] of rows.entries()) {
        if (w.gate && j === 0) continue;
        const ps =
          j === 0
            ? archPoints(w, lo, hi - width, width)
            : [point(-width, lo), point(width, lo), point(width, hi), point(-width, hi)];
        plane('glass', ps, w.N);
        if (detail < 2 || (detail === 2 && j !== 1)) continue;
        if (detail === 3 && j === 1) {
          for (const u of [-width - 0.2, width])
            f('trim', [point(u, lo), point(u + 0.2, lo), point(u + 0.2, hi), point(u, hi)], w.N);
          f(
            'trim',
            [
              point(-width - 0.2, hi),
              point(width + 0.2, hi),
              point(width + 0.2, hi + 0.25),
              point(-width - 0.2, hi + 0.25),
            ],
            w.N,
          );
          bar('trim', point(-width - 0.3, lo - 0.15), point(width + 0.3, lo - 0.15), 0.3, 0.5);
          f(
            'trim',
            [
              point(-0.05, lo, 0.12),
              point(0.05, lo, 0.12),
              point(0.05, hi, 0.12),
              point(-0.05, hi, 0.12),
            ],
            w.N,
          );
          f(
            'trim',
            [
              point(-width, lo + 3.25, 0.12),
              point(width, lo + 3.25, 0.12),
              point(width, lo + 3.35, 0.12),
              point(-width, lo + 3.35, 0.12),
            ],
            w.N,
          );
        } else {
          const offset = 0.09,
            t = 0.2;
          for (const u of [-width - t, width])
            plane(
              'trim',
              [
                point(u, lo, offset),
                point(u + t, lo, offset),
                point(u + t, hi, offset),
                point(u, hi, offset),
              ],
              w.N,
            );
          for (const y of [lo - t, hi])
            plane(
              'trim',
              [
                point(-width - t, y, offset),
                point(width + t, y, offset),
                point(width + t, y + t, offset),
                point(-width - t, y + t, offset),
              ],
              w.N,
            );
          if (j === 0) {
            const outer = archPoints(w, lo, hi - width, width + t, offset);
            for (let i = 2; i < ps.length - 1; i++)
              f('trim', [ps[i], ps[i + 1], outer[i + 1], outer[i]], w.N);
          }
        }
        if (detail === 3 && j > 0) {
          const peak = j === 1 ? 1.05 : 0.6,
            base = hi + 0.45;
          f(
            'trim',
            [
              point(-width - 0.4, base, 0.12),
              point(width + 0.4, base, 0.12),
              point(0, base + peak, 0.12),
            ],
            w.N,
          );
          f(
            'gold',
            [
              point(-0.18, base, 0.2),
              point(0.18, base, 0.2),
              point(0.18, base + 0.35, 0.2),
              point(-0.18, base + 0.35, 0.2),
            ],
            w.N,
          );
        }
      }
      if (detail >= 2) {
        const u = width + 0.8,
          a = point(u, 7.5, 0.16),
          b = point(u, 21.5, 0.16);
        if (detail === 2)
          f(
            'trim',
            [
              point(u - 0.22, 7.5, 0.16),
              point(u + 0.22, 7.5, 0.16),
              point(u + 0.22, 21.5, 0.16),
              point(u - 0.22, 21.5, 0.16),
            ],
            w.N,
          );
        else bar('trim', a, b, 0.43, 0.4);
        if (detail === 3)
          for (const y of [7.5, 21.4])
            f(
              'trim',
              [
                point(u - 0.4, y, 0.2),
                point(u + 0.4, y, 0.2),
                point(u + 0.4, y + 0.4, 0.2),
                point(u - 0.4, y + 0.4, 0.2),
              ],
              w.N,
            );
      }
    }
  // Main/side porticoes remain open in both directions; distant levels use simple dark arched infills.
  for (const p of r.portals) {
    if (!detail)
      plane(
        'glass',
        archPoints({ x: p.x, z: p.z1, T: [1, 0, 0], N: [0, 0, 1] }, 0.3, p.spring, p.R, 0.1),
        [0, 0, 1],
      );
    if (detail >= 2) {
      const w = { x: p.x, z: p.z1, T: [1, 0, 0], N: [0, 0, 1] },
        ps = archPoints(w, 0.2, p.spring, p.R, 0.12),
        outer = archPoints(w, 0.2, p.spring, p.R + 0.35, 0.13);
      for (let i = 2; i < ps.length - 1; i++)
        f('trim', [ps[i], ps[i + 1], outer[i + 1], outer[i]], [0, 0, 1]);
      for (const x of [p.x - p.R - 0.7, p.x + p.R + 0.7]) {
        loft('trim', [ring(x, 0.2, p.z1 + 0.35, 0.55, 8), ring(x, 6.4, p.z1 + 0.35, 0.42, 8)]);
        box(f, 'trim', x, 6.4, p.z1 + 0.35, 1.2, 0.5, 1.1);
      }
    }
  }

  // Separate closed triangular pediments on the two principal facades.
  for (const sign of [-1, 1])
    for (const [x, width, height] of [
      [-5, 20, 27.5],
      [-78, 12, 26],
      [73, 12, 26],
    ]) {
      const z = sign > 0 ? (x === -5 ? 87.9 : x < 0 ? 84.7 : 83.8) : x === -5 ? -89.5 : -91.1,
        a = [x - width / 2, 23.5, z],
        b = [x + width / 2, 23.5, z],
        c = [x, height, z];
      f('wall', [a, b, c], [0, 0, sign]);
      f(
        'wall',
        [
          a.map((v, i) => (i === 2 ? v - sign * 1.5 : v)),
          b.map((v, i) => (i === 2 ? v - sign * 1.5 : v)),
          c.map((v, i) => (i === 2 ? v - sign * 1.5 : v)),
        ],
        [0, 0, -sign],
      );
      for (const [u, v] of [
        [a, b],
        [b, c],
        [c, a],
      ]) {
        f(
          'trim',
          [
            u,
            v,
            v.map((q, i) => (i === 2 ? q - sign * 1.5 : q)),
            u.map((q, i) => (i === 2 ? q - sign * 1.5 : q)),
          ],
          [u[0] - x, 1, u[2] - z],
        );
        if (detail) bar('trim', u, v, 0.55);
      }
      if (detail >= 2)
        loft('gold', [ring(x, 24.1, z + sign * 0.2, 1, 8), ring(x, 25.8, z + sign * 0.2, 0.35, 8)]);
    }
  for (const c of r.cupolas) {
    const n = [6, 8, 12, 20][detail],
      role = c.gold ? 'gold' : 'roof',
      R = c.radius;
    loft('wall', [ring(c.x, 22, c.z, R * 1.15, n), ring(c.x, 27, c.z, R, n)]);
    loft('trim', [ring(c.x, 26.8, c.z, R * 1.12, n), ring(c.x, 27.3, c.z, R * 1.12, n)]);
    loft(
      role,
      [
        [27.3, 0.85],
        [28.5, 1.05],
        [30.2, 0.86],
        [31.4, 0.42],
        [32, 0.12],
      ].map(([y, k]) => ring(c.x, y + (c.height - 34), c.z, R * k, n)),
    );
    bar('gold', [c.x, 31.8 + (c.height - 34), c.z], [c.x, c.height, c.z], detail ? 0.2 : 0.4);
    if (detail)
      bar('gold', [c.x - 0.65, c.height - 0.65, c.z], [c.x + 0.65, c.height - 0.65, c.z], 0.18);
  }
  if (detail >= 2) {
    for (const x of [-96, -68, -40, 30, 58, 86])
      for (const z of [-76, 72]) {
        box(f, 'wall', x, 24.2, z, 1, 2.5, 1.3);
        box(f, 'trim', x, 26.7, z, 1.3, 0.35, 1.6);
      }
    // A neutral supported pole carries no copied heraldry or event graphics.
    bar('metal', [-5, 27.5, 82], [-5, 35, 82], 0.16);
  }
}

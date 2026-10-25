/** 'small_hermitage': Two distinct pavilions, raised garden, galleries and six mapped passages. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildSmallHermitage(face, detail, r) {
  const P = ([x, y, z]) => [
      x * r.xAxis[0] + z * r.zAxis[0],
      y + r.floorY,
      x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    bottom = r.minGround - r.floorY - 0.4,
    cylinder = (role, x, z, profile, sides = detail === 3 ? 12 : 6) => {
      const rings = profile.map(([y, radius]) =>
        Array.from({ length: sides }, (_, i) => {
          const a = (i * 2 * Math.PI) / sides;
          return [x + Math.cos(a) * radius, y, z + Math.sin(a) * radius];
        }),
      );
      for (let j = 1; j < rings.length; j++)
        for (let i = 0; i < sides; i++) {
          const k = (i + 1) % sides;
          f(
            role,
            [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
            [rings[j][i][0] - x, 0, rings[j][i][2] - z],
          );
        }
      for (const [ring, normal] of [
        [rings[0], -1],
        [rings.at(-1), 1],
      ])
        for (let i = 0; i < sides; i++)
          f(role, [[x, ring[0][1], z], ring[i], ring[(i + 1) % sides]], [0, normal, 0]);
    },
    window = (x, z, t, n, width, y0, height, arched) => {
      const point = (u, y, v = 0.055) => [x + t[0] * u + n[0] * v, y, z + t[2] * u + n[2] * v],
        radius = width / 2,
        spring = y0 + height - (arched ? radius : 0),
        profile = [
          [-radius, y0],
          [radius, y0],
        ];
      if (arched)
        for (let i = 0, count = detail === 3 ? 8 : 4; i <= count; i++) {
          const a = (i * Math.PI) / count;
          profile.push([radius * Math.cos(a), spring + radius * Math.sin(a)]);
        }
      else profile.push([radius, y0 + height], [-radius, y0 + height]);
      const ps = profile.map(([u, y]) => point(u, y));
      for (let i = 1; i < ps.length - 1; i++) f('glass', [ps[0], ps[i], ps[i + 1]], n);
      if (detail < 2) return;
      for (let i = 0; i < profile.length; i++) {
        const a = profile[i],
          b = profile[(i + 1) % profile.length];
        if (detail === 2) {
          const dx = b[0] - a[0],
            dy = b[1] - a[1],
            length = Math.hypot(dx, dy),
            offset = [(-dy / length) * 0.1, (dx / length) * 0.1];
          f(
            'trim',
            [
              point(a[0] - offset[0], a[1] - offset[1], 0.12),
              point(b[0] - offset[0], b[1] - offset[1], 0.12),
              point(b[0] + offset[0], b[1] + offset[1], 0.12),
              point(a[0] + offset[0], a[1] + offset[1], 0.12),
            ],
            n,
          );
        } else bar('trim', point(...a, 0.12), point(...b, 0.12), 0.15);
      }
      if (detail === 3) {
        bar('trim', point(0, y0, 0.14), point(0, spring, 0.14), 0.08);
        bar(
          'trim',
          point(-radius, y0 + height * 0.48, 0.14),
          point(radius, y0 + height * 0.48, 0.14),
          0.08,
        );
      }
    };

  // The mapped garden hole is above occupied rooms, rather than an at-grade courtyard.
  for (const p of r.foundation) prism(f, 'wall', p, bottom, 8.2);
  for (const p of r.masses) {
    prism(
      (role, ps, n) => {
        if (n[1] < 0.5) f(role, ps, n);
      },
      'wall',
      p,
      8.2,
      p.height,
      false,
    );
  }
  for (const triangle of r.roofPanels[detail]) f('roof', triangle, [0, 1, 0]);
  for (const p of r.garden) prism(f, 'floor', p, 8.2, 8.35);
  if (detail) {
    for (const p of r.beds) prism(f, 'garden', p, 8.35, 8.6);
    for (const edge of r.edges) {
      if (detail === 1 && edge.L < 12) continue;
      const { a, b, height } = edge;
      bar('trim', [a[0], height + 0.12, a[1]], [b[0], height + 0.12, b[1]], 0.65, 0.7);
      if (detail >= 2) {
        for (const y of edge.court ? [8.6, 11.9] : height > 20 ? [0.8, 8.2, 15.9] : [0.8, 8.2])
          bar('trim', [a[0], y, a[1]], [b[0], y, b[1]], 0.24, 0.38);
      }
    }
    for (const w of r.windows) {
      if (detail === 1 && (w.court || w.index % 2)) continue;
      const levels =
        w.height > 20
          ? [
              [1.4, 5.2, true],
              [9.1, 5.3, true],
              [17.1, 3.8, false],
            ]
          : w.court
            ? [[9.2, 3.7, false]]
            : [
                [1.4, 4.8, true],
                [9.2, 3.7, false],
              ];
      for (const [y, height, arched] of levels)
        window(w.x, w.z, w.T, w.N, w.width, y, height, arched);
    }
  }

  // River pavilion: six giant-order round columns, strong entablature and central roof group.
  if (detail) {
    for (const x of [-12, -7.2, -2.4, 2.4, 7.2, 12]) {
      box(f, 'trim', x, 8.2, -77.6, 1.3, 0.6, 1.25);
      cylinder('trim', x, -77.6, [
        [8.8, 0.57],
        [9.2, 0.52],
        [20.6, 0.43],
        [20.9, 0.66],
        [21.3, 0.68],
      ]);
      box(f, 'trim', x, 21.3, -77.6, 1.45, 0.35, 1.4);
    }
    box(f, 'trim', 0, 21.65, -77.6, 36.4, 0.65, 0.85);
    box(f, 'wall', 0, 23.15, -76.9, 9.5, 0.8, 0.7);
    box(f, 'trim', 0, 23.95, -76.9, 10, 0.22, 1.1);
    if (detail >= 2) {
      // Original coarse seated/reclining figures retain the roof-group silhouette.
      box(f, 'trim', 0, 24.17, -76.9, 1.6, 0.45, 1.1);
      cylinder(
        'trim',
        0,
        -76.9,
        [
          [24.62, 0.62],
          [25.5, 0.48],
          [26.0, 0.36],
        ],
        6,
      );
      cylinder(
        'trim',
        0,
        -76.9,
        [
          [26.0, 0.27],
          [26.3, 0.34],
          [26.62, 0.12],
        ],
        6,
      );
      for (const sign of [-1, 1]) {
        bar('trim', [sign * 0.35, 25.4, -77.1], [sign * 1.4, 24.7, -77.3], 0.23);
        bar('trim', [sign * 2.2, 24.75, -76.9], [sign * 3.8, 24.4, -77], 0.65);
        cylinder(
          'trim',
          sign * 2.1,
          -76.9,
          [
            [24.95, 0.27],
            [25.25, 0.31],
            [25.5, 0.12],
          ],
          6,
        );
        bar('trim', [sign * 3.6, 24.4, -77], [sign * 4.6, 24.25, -77.25], 0.3);
      }
      if (detail === 3) {
        bar('metal', [-15.6, 8.6, -78.2], [15.6, 8.6, -78.2], 0.09);
        for (let x = -15.6; x <= 15.6; x += 1.2)
          bar('metal', [x, 8.25, -78.2], [x, 9.2, -78.2], 0.07);
        bar('metal', [-15.6, 9.2, -78.2], [15.6, 9.2, -78.2], 0.09);
      }
    }
  }

  // South pavilion: paired ground columns, pilasters and a low curved metal roof/attic.
  if (detail) {
    for (const x of [-13.5, -12, -4, -2.5, 2.5, 4, 12, 13.5]) {
      box(f, 'trim', x, 0.3, 79.6, 1.1, 0.6, 1.1);
      cylinder('trim', x, 79.6, [
        [0.9, 0.47],
        [1.2, 0.4],
        [7.4, 0.34],
        [7.8, 0.56],
        [8.2, 0.58],
      ]);
    }
    for (const x of [-14.2, -9.5, -4.8, 0, 4.8, 9.5, 14.2]) {
      box(f, 'trim', x, 9.1, 79.48, 0.62, 6.3, 0.3);
      box(f, 'trim', x, 17, 79.48, 0.45, 4.5, 0.28);
    }
    box(f, 'wall', 0.6, 23.1, 78.8, 12, 1.4, 0.75);
    box(f, 'trim', 0.6, 24.5, 78.8, 12.6, 0.25, 1.05);
    box(f, 'trim', 0.6, 24.75, 78.8, 2.7, 0.8, 0.75);
    if (detail >= 2) {
      for (const x of [-11.9, -2.4, 7.1]) {
        box(f, 'trim', x, 8.15, 80, 3.8, 0.32, 1.3);
        bar('metal', [x - 1.9, 9.35, 80.6], [x + 1.9, 9.35, 80.6], 0.1);
        for (let i = 0; i <= 6; i++)
          bar(
            'metal',
            [x - 1.9 + (i * 3.8) / 6, 8.45, 80.6],
            [x - 1.9 + (i * 3.8) / 6, 9.35, 80.6],
            0.065,
          );
      }
    }
  }

  // Mapped connecting wings cross the narrow streets; their ground-level passages stay open.
  for (const b of r.connectors) {
    const { x0, x1, z0, z1 } = b,
      width = x1 - x0,
      center = (x0 + x1) / 2,
      pier = 0.55,
      radius = (width - pier * 2) / 2,
      spring = 4.7,
      crown = spring + radius,
      segments = [2, 4, 8, 12][detail];
    box(f, 'wall', x0 + pier / 2, bottom, (z0 + z1) / 2, pier, spring - bottom, z1 - z0);
    box(f, 'wall', x1 - pier / 2, bottom, (z0 + z1) / 2, pier, spring - bottom, z1 - z0);
    for (let i = 0; i < segments; i++) {
      const a = (i * Math.PI) / segments,
        c = ((i + 1) * Math.PI) / segments,
        xa = center + radius * Math.cos(c),
        xb = center + radius * Math.cos(a),
        ya = spring + radius * Math.sin(c),
        yb = spring + radius * Math.sin(a),
        top = Math.max(12.3, crown + 1);
      const ps = [
        [xa, ya, z0],
        [xb, yb, z0],
        [xb, top, z0],
        [xa, top, z0],
      ];
      f('wall', ps, [0, 0, -1]);
      f(
        'wall',
        ps.map(([x, y]) => [x, y, z1]),
        [0, 0, 1],
      );
      f(
        'trim',
        [
          [xa, ya, z0],
          [xb, yb, z0],
          [xb, yb, z1],
          [xa, ya, z1],
        ],
        [0, -1, 0],
      );
    }
    box(f, 'wall', center, Math.max(12.3, crown + 1), (z0 + z1) / 2, width, 0.4, z1 - z0);
    box(f, 'roof', center, Math.max(12.3, crown + 1) + 0.4, (z0 + z1) / 2, width, 0.25, z1 - z0);
    // End faces close the upper corridor where it meets the neighboring walls.
    for (const x of [x0, x1])
      f(
        'wall',
        [
          [x, spring, z0],
          [x, 12.7, z0],
          [x, 12.7, z1],
          [x, spring, z1],
        ],
        [x === x0 ? -1 : 1, 0, 0],
      );
    if (detail)
      for (const z of [z0, z1])
        for (const x of [center - width * 0.23, center + width * 0.23])
          window(
            x,
            z,
            [1, 0, 0],
            [0, 0, z === z0 ? -1 : 1],
            1.1,
            Math.max(9.3, crown + 0.2),
            2.3,
            false,
          );
  }
}

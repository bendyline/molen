/** 'gate_of_salutation_topkapi_palace': Two octagonal towers, true gate passage and open rear arcade. */
import { beam } from './authored-structure-mesh.mjs';
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildTopkapiSalutation(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    floor = (z) => (r.frontControlZ - z) * r.floorSlope,
    f = (role, ps, n) =>
      face(
        role,
        ps.map((p) => P(role === 'floor' ? [p[0], p[1] + floor(p[2]), p[2]] : p)),
        D(n),
      ),
    adapter = {
      addQuad: (role, _ref, ps, n) => f(role, ps, n),
      addConvexPolygon: (role, _ref, ps, n) => {
        for (let i = 1; i < ps.length - 1; i++) f(role, [ps[0], ps[i], ps[i + 1]], n);
      },
    },
    bar = (role, a, b, w, d = w) => beam(adapter, role, a, b, w, d, [1, 1, 1]),
    cylinder = (role, x, z, profile, sides = 8) => {
      const rings = profile.map(([y, radius]) =>
        Array.from({ length: sides }, (_, i) => {
          const a = ((i + 0.5) * 2 * Math.PI) / sides;
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
    arch = (x, radius, spring, rise) => {
      const a = (rise * rise - radius * radius) / (2 * radius);
      return (
        spring +
        Math.sqrt(Math.max(0, (radius + a) * (radius + a) - (Math.abs(x) + a) * (Math.abs(x) + a)))
      );
    },
    wallWithPassage = (role, x0, x1, z0, z1, top, center, radius, spring, rise, n) => {
      box(
        f,
        role,
        (x0 + center - radius) / 2,
        -0.6,
        (z0 + z1) / 2,
        center - radius - x0,
        top + 0.6,
        z1 - z0,
      );
      box(
        f,
        role,
        (x1 + center + radius) / 2,
        -0.6,
        (z0 + z1) / 2,
        x1 - center - radius,
        top + 0.6,
        z1 - z0,
      );
      for (let i = 0; i < n; i++) {
        const a = -radius + (2 * radius * i) / n,
          b = -radius + (2 * radius * (i + 1)) / n,
          ya = arch(a, radius, spring, rise),
          yb = arch(b, radius, spring, rise);
        for (const [z, sign] of [
          [z0, -1],
          [z1, 1],
        ])
          f(
            role,
            [
              [center + a, ya, z],
              [center + b, yb, z],
              [center + b, top, z],
              [center + a, top, z],
            ],
            [0, 0, sign],
          );
        f(
          role,
          [
            [center + a, ya, z0],
            [center + b, yb, z0],
            [center + b, yb, z1],
            [center + a, ya, z1],
          ],
          [0, -1, 0],
        );
        f(
          role,
          [
            [center + a, top, z0],
            [center + b, top, z0],
            [center + b, top, z1],
            [center + a, top, z1],
          ],
          [0, 1, 0],
        );
      }
    },
    archBand = (role, cx, z, radius, spring, rise, width, depth, normal = 1, n = 8) => {
      const inner = [],
        outer = [];
      for (let i = 0; i <= n; i++) {
        const u = -radius + (2 * radius * i) / n;
        inner.push([cx + u, arch(u, radius, spring, rise), z]);
        outer.push([
          cx + (u * (radius + width)) / radius,
          arch(u, radius, spring, rise) + width,
          z,
        ]);
      }
      for (let i = 0; i < n; i++) {
        f(role, [inner[i], inner[i + 1], outer[i + 1], outer[i]], [0, 0, normal]);
        if (detail >= 2) {
          const a = inner[i].map((v, k) => (k === 2 ? v - normal * depth : v)),
            b = inner[i + 1].map((v, k) => (k === 2 ? v - normal * depth : v));
          f(role, [inner[i], inner[i + 1], b, a], [0, -1, 0]);
        }
      }
      for (const sign of [-1, 1])
        box(
          f,
          role,
          cx + sign * (radius + width / 2),
          0.5,
          z - (normal * depth) / 2,
          width,
          spring - 0.5,
          depth,
        );
    },
    window = (cx, z, normal, y, width, height, radius = 0) => {
      const profile = [
        [-width / 2, y],
        [width / 2, y],
      ];
      if (radius) {
        const spring = y + height - radius;
        for (let i = 0, n = detail === 3 ? 8 : 4; i <= n; i++) {
          const a = (Math.PI * i) / n;
          profile.push([Math.cos(a) * radius, spring + Math.sin(a) * radius]);
        }
      } else profile.push([width / 2, y + height], [-width / 2, y + height]);
      for (let i = 1; i < profile.length - 1; i++)
        f(
          'glass',
          [
            [cx + profile[0][0], profile[0][1], z],
            [cx + profile[i][0], profile[i][1], z],
            [cx + profile[i + 1][0], profile[i + 1][1], z],
          ],
          [0, 0, normal],
        );
      if (detail >= 2)
        for (let i = 0; i < profile.length; i++) {
          const a = profile[i],
            b = profile[(i + 1) % profile.length];
          bar(
            'trim',
            [cx + a[0], a[1], z + normal * 0.04],
            [cx + b[0], b[1], z + normal * 0.04],
            0.09,
          );
        }
    };

  for (const p of r.body) prism(f, 'floor', p, r.foundationBottom, 0);
  // The recessed outer gate arch reveals a smaller continuous passage, not a painted door.
  wallWithPassage(
    'wall',
    -20.7,
    21.2,
    3.2,
    11.15,
    11.9,
    r.portalX,
    2.2,
    4.0,
    2.5,
    [6, 8, 12, 20][detail],
  );
  wallWithPassage(
    'wall',
    -20.7,
    21.2,
    11.15,
    12.42,
    11.9,
    r.portalX,
    4.65,
    5.25,
    4.65,
    [8, 10, 16, 24][detail],
  );
  // Brick rear elevation flanks the open central portal under the court-facing canopy.
  wallWithPassage(
    'rear',
    -23.1,
    21.2,
    2.94,
    3.18,
    9.3,
    r.portalX,
    2.2,
    4.0,
    2.5,
    [6, 8, 12, 20][detail],
  );
  for (const [x, z] of r.towers) {
    cylinder(
      'wall',
      x,
      z,
      detail === 0
        ? [
            [-0.6, 2.9],
            [13.7, 2.9],
            [14.25, 3.25],
            [16.3, 3.25],
          ]
        : [
            [-0.6, 3.1],
            [0.3, 3.1],
            [0.6, 2.9],
            [6.7, 2.9],
            [7.05, 3.05],
            [7.3, 2.9],
            [13.7, 2.9],
            [14.25, 3.25],
            [16.3, 3.25],
          ],
    );
    cylinder('roof', x, z, [
      [16.3, 3.5],
      [16.52, 3.5],
      [24.4, 0.1],
    ]);
    if (detail) {
      cylinder('trim', x, z, [
        [16.1, 3.35],
        [16.35, 3.45],
      ]);
      cylinder(
        'metal',
        x,
        z,
        [
          [24.35, 0.1],
          [24.65, 0.22],
          [24.95, 0.1],
          [25.2, 0.03],
        ],
        6,
      );
      for (let i = 0; i < 8; i++) {
        const a = (i * 2 * Math.PI) / 8,
          N = [Math.cos(a), 0, Math.sin(a)],
          T = [-N[2], 0, N[0]],
          at = (u, y, distance) => [
            x + N[0] * distance + T[0] * u,
            y,
            z + N[2] * distance + T[2] * u,
          ],
          plane = (u, y, w, h, distance) =>
            f(
              'glass',
              [
                at(u - w / 2, y, distance),
                at(u + w / 2, y, distance),
                at(u + w / 2, y + h, distance),
                at(u - w / 2, y + h, distance),
              ],
              N,
            );
        plane(0, 14.55, 0.62, 0.85, 3.02);
        for (let j = 0, n = detail === 3 ? 8 : 4; j < n; j++) {
          const a = (Math.PI * j) / n,
            b = (Math.PI * (j + 1)) / n;
          f(
            'glass',
            [
              at(0, 15.4, 3.02),
              at(Math.cos(a) * 0.31, 15.4 + Math.sin(a) * 0.31, 3.02),
              at(Math.cos(b) * 0.31, 15.4 + Math.sin(b) * 0.31, 3.02),
            ],
            N,
          );
        }
        if (detail >= 2) {
          for (const y of [3.8, 8.4, 11.3]) plane(0, y, 0.12, 0.72, 2.69);
          for (const y of [13.55, 13.9])
            bar('trim', at(-0.22, y, 2.85), at(0.22, y, 2.85), 0.16, 0.32);
          if (detail === 3)
            bar(
              'roof',
              [x + N[0] * 3.53, 16.55, z + N[2] * 3.53],
              [x + N[0] * 0.15, 24.35, z + N[2] * 0.15],
              0.035,
            );
        }
      }
    }
  }
  box(f, 'trim', -1.0, 11.8, 11.8, 42, 0.3, 1.6);
  for (let i = 0; i < 9; i++) {
    const x = -9.4 + i * 1.45;
    box(f, 'wall', x, 12.05, 11.8, 0.85, 1.8, 1.2);
    if (detail) {
      box(f, 'trim', x, 13.8, 11.8, 1.0, 0.18, 1.4);
      if (detail >= 2) window(x, 12.42, 1, 12.5, 0.12, 0.7);
    }
  }
  if (detail) {
    archBand('trim', r.portalX, 12.5, 4.65, 5.25, 4.65, 0.26, 0.18, 1, [0, 10, 16, 24][detail]);
    archBand('trim', r.portalX, 11.18, 2.2, 4, 2.5, 0.18, 0.2, 1, [0, 8, 12, 20][detail]);
    for (const x of [r.portalX - 3.0, r.portalX + 3.0])
      box(f, 'metal', x, 3.8, 11.28, 0.8, 1.15, 0.05);
    // Neutral architectural panels replace fine calligraphy, tughra artwork and modern banners.
    box(f, 'metal', r.portalX, 7.15, 11.23, 3.6, 0.95, 0.05);
    box(f, 'trim', r.portalX, 6.65, 11.21, 1.8, 0.35, 0.12);
    for (let i = 0; i < 22; i++) {
      const x = -18.9 + i * 1.7;
      if (r.towers.some((t) => Math.abs(x - t[0]) < 3.2)) continue;
      box(f, 'trim', x, 10.9, 12.5, 0.25, 0.75, 0.45);
    }
  }

  // Open eight-bay court portico: actual shafts, pointed arcades, roof and timber soffit.
  const xs = Array.from({ length: 9 }, (_, i) => -22.0 + i * 5.25),
    row = -10.65;
  for (const x of xs) {
    const base = floor(row);
    cylinder(
      'trim',
      x,
      row,
      detail === 0
        ? [
            [base, 0.24],
            [6.28, 0.24],
          ]
        : [
            [base, 0.38],
            [base + 0.18, 0.38],
            [base + 0.4, 0.24],
            [6.0, 0.24],
            [6.28, 0.42],
          ],
      detail === 0 ? 4 : 8,
    );
  }
  if (detail)
    for (let i = 0; i < xs.length - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2,
        R = (xs[i + 1] - xs[i]) / 2 - 0.24,
        n = [0, 4, 8, 14][detail];
      for (let j = 0; j < n; j++) {
        const x0 = -R + (2 * R * j) / n,
          x1 = -R + (2 * R * (j + 1)) / n,
          y0 = arch(x0, R, 6.15, 3.0),
          y1 = arch(x1, R, 6.15, 3.0);
        for (const [z, sign] of [
          [row - 0.3, -1],
          [row + 0.3, 1],
        ])
          f(
            'trim',
            [
              [cx + x0, y0, z],
              [cx + x1, y1, z],
              [cx + x1, 9.5, z],
              [cx + x0, 9.5, z],
            ],
            [0, 0, sign],
          );
        f(
          'trim',
          [
            [cx + x0, y0, row - 0.3],
            [cx + x1, y1, row - 0.3],
            [cx + x1, y1, row + 0.3],
            [cx + x0, y0, row + 0.3],
          ],
          [0, -1, 0],
        );
      }
    }
  for (const x of [-22, 20])
    for (const z of [-4.0, 2.4])
      cylinder(
        'trim',
        x,
        z,
        [
          [floor(z), 0.3],
          [6.25, 0.3],
        ],
        detail === 0 ? 4 : 8,
      );
  box(f, 'wood', -1, 9.45, -3.9, 45.2, 0.22, 15.4);
  const corners = [
      [-23.6, -11.8],
      [21.6, -11.8],
      [21.6, 4.0],
      [-23.6, 4.0],
    ],
    ridge = [
      [-15.7, -3.9],
      [13.7, -3.9],
    ];
  for (const ps of [
    [[...corners[0]], [...corners[1]], ridge[1], ridge[0]],
    [[...corners[1]], [...corners[2]], ridge[1]],
    [[...corners[2]], [...corners[3]], ridge[0], ridge[1]],
    [[...corners[3]], [...corners[0]], ridge[0]],
  ])
    f(
      'roof',
      ps.map(([x, z]) => [x, z === -3.9 ? 11.15 : 9.85, z]),
      [0, 1, 0],
    );
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4];
    f(
      'roof',
      [
        [a[0], 9.65, a[1]],
        [b[0], 9.65, b[1]],
        [b[0], 9.85, b[1]],
        [a[0], 9.85, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
  }
  if (detail) {
    for (const x of [-19.3, -14.2, -8.9, 1.6, 6.9, 12.2, 17.5])
      window(x, 2.91, -1, 4.6, 0.8, 1.4, 0.4);
    if (detail >= 2) for (const x of xs) bar('wood', [x, 9.39, -11.3], [x, 9.39, 2.8], 0.14);
    if (detail === 3) {
      for (let i = 0; i < 16; i++) {
        const z = -11.5 + i * 0.95;
        bar('roof', [-23.5, 9.9, z], [-15.7, 11.18, -3.9], 0.026);
        bar('roof', [21.5, 9.9, z], [13.7, 11.18, -3.9], 0.026);
      }
      for (const x of [-22, -15, -8, 0, 7, 14, 21]) box(f, 'trim', x, 1.5, 12.46, 0.16, 7.5, 0.06);
    }
  }
}

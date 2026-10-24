/** Specific Edfu exterior, with independently mapped hall and southern column controls. */
export const edfuCandidateId = 'temple_of_edfu';

export function edfuGrade(z, r) {
  const a = r.grade;
  if (z <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++)
    if (z <= a[i][0])
      return a[i - 1][1] + ((z - a[i - 1][0]) / (a[i][0] - a[i - 1][0])) * (a[i][1] - a[i - 1][1]);
  return a.at(-1)[1];
}
function box(f, role, x, y, z, w, h, d) {
  const a = x - w / 2,
    b = x + w / 2,
    c = z - d / 2,
    e = z + d / 2,
    t = y + h;
  for (const [ps, n] of [
    [
      [
        [a, y, c],
        [a, t, c],
        [a, t, e],
        [a, y, e],
      ],
      [-1, 0, 0],
    ],
    [
      [
        [b, y, c],
        [b, t, c],
        [b, t, e],
        [b, y, e],
      ],
      [1, 0, 0],
    ],
    [
      [
        [a, y, c],
        [b, y, c],
        [b, t, c],
        [a, t, c],
      ],
      [0, 0, -1],
    ],
    [
      [
        [a, y, e],
        [b, y, e],
        [b, t, e],
        [a, t, e],
      ],
      [0, 0, 1],
    ],
    [
      [
        [a, t, c],
        [b, t, c],
        [b, t, e],
        [a, t, e],
      ],
      [0, 1, 0],
    ],
    [
      [
        [a, y, c],
        [b, y, c],
        [b, y, e],
        [a, y, e],
      ],
      [0, -1, 0],
    ],
  ])
    f(role, ps, n);
}
function extrusion(f, role, part, bottom, top) {
  for (const t of part.triangles) {
    f(
      role,
      t.map(([x, z]) => [x, top(x, z), z]),
      [0, 1, 0],
    );
    f(
      role,
      t.map(([x, z]) => [x, bottom(x, z), z]),
      [0, -1, 0],
    );
  }
  for (const [ri, closed] of part.polygon.entries()) {
    const ring = closed.slice(0, -1),
      area = ring.reduce((n, a, i) => {
        const b = ring[(i + 1) % ring.length];
        return n + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sign = Math.sign(area) * (ri ? -1 : 1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      f(
        role,
        [
          [a[0], bottom(...a), a[1]],
          [b[0], bottom(...b), b[1]],
          [b[0], top(...b), b[1]],
          [a[0], top(...a), a[1]],
        ],
        [sign * (b[1] - a[1]), 0, -sign * (b[0] - a[0])],
      );
    }
  }
}
function column(f, x, z, height, radius, d, floor = 0) {
  const n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : d === 3 ? 12 : 16,
    profile =
      d === 0
        ? [
            [0, radius],
            [height, radius],
          ]
        : d === 1
          ? [
              [0, radius],
              [height * 0.84, radius * 0.8],
              [height, radius * 1.45],
            ]
          : [
              [0, radius * 1.1],
              [0.35, radius * 1.1],
              [0.6, radius],
              [height * 0.77, radius * 0.77],
              [height * 0.9, radius * 1.2],
              [height - 0.3, radius * 1.65],
              [height, radius * 1.65],
            ],
    p = (j, i) => [
      x + Math.cos((i * 2 * Math.PI) / n) * profile[j][1],
      floor + profile[j][0],
      z + Math.sin((i * 2 * Math.PI) / n) * profile[j][1],
    ];
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++)
      f(
        'stone',
        [p(j - 1, i), p(j - 1, i + 1), p(j, i + 1), p(j, i)],
        [Math.cos(((i + 0.5) * 2 * Math.PI) / n), 0, Math.sin(((i + 0.5) * 2 * Math.PI) / n)],
      );
  for (let i = 1; i < n - 1; i++)
    f(
      'stone',
      [p(profile.length - 1, 0), p(profile.length - 1, i), p(profile.length - 1, i + 1)],
      [0, 1, 0],
    );
  if (d >= 2) box(f, 'stone', x, floor + height, z, radius * 2.3, 0.4, radius * 2.3);
}
function pylon(f, center, d) {
  const left = center - 16,
    right = center + 16,
    height = 35.1,
    p = (x, y, side, depth = 0) => [
      center + (x - center) * (1 - ((2.8 / 16) * Math.max(0, y)) / height),
      y,
      side * (6 - (2.4 * Math.max(0, y)) / height) - depth,
    ];
  for (const side of [-1, 1]) {
    const apertures =
        side === 1 && d >= 2
          ? [
              { x0: center - 8.7, x1: center - 7.1, y0: 2.2, y1: 26 },
              { x0: center + 7.1, x1: center + 8.7, y0: 2.2, y1: 26 },
              { x0: center - 1.2, x1: center + 1.2, y0: 27.6, y1: 29.4 },
            ]
          : [],
      xs = [...new Set([left, right, ...apertures.flatMap((a) => [a.x0, a.x1])])].sort(
        (a, b) => a - b,
      ),
      ys = [...new Set([-0.8, height, ...apertures.flatMap((a) => [a.y0, a.y1])])].sort(
        (a, b) => a - b,
      );
    for (let i = 1; i < xs.length; i++)
      for (let j = 1; j < ys.length; j++) {
        const x = (xs[i - 1] + xs[i]) / 2,
          y = (ys[j - 1] + ys[j]) / 2;
        if (apertures.some((a) => x > a.x0 && x < a.x1 && y > a.y0 && y < a.y1)) continue;
        f(
          'wall',
          [
            p(xs[i - 1], ys[j - 1], side),
            p(xs[i], ys[j - 1], side),
            p(xs[i], ys[j], side),
            p(xs[i - 1], ys[j], side),
          ],
          [0, 0, side],
        );
      }
    for (const a of apertures) {
      const q = [
        [a.x0, a.y0],
        [a.x1, a.y0],
        [a.x1, a.y1],
        [a.x0, a.y1],
      ];
      f(
        'wall',
        q.map(([x, y]) => p(x, y, side, 0.8)),
        [0, 0, 1],
      );
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        f(
          'stone',
          [p(...q[i], side), p(...q[j], side), p(...q[j], side, 0.8), p(...q[i], side, 0.8)],
          [q[j][1] - q[i][1], q[i][0] - q[j][0], 0],
        );
      }
    }
  }
  for (const [x, n] of [
    [left, [-1, 0, 0]],
    [right, [1, 0, 0]],
  ])
    f('wall', [p(x, -0.8, -1), p(x, -0.8, 1), p(x, height, 1), p(x, height, -1)], n);
  for (const [y, n] of [
    [-0.8, [0, -1, 0]],
    [height, [0, 1, 0]],
  ])
    f('wall', [p(left, y, -1), p(right, y, -1), p(right, y, 1), p(left, y, 1)], n);
  // A broad concave cornice is silhouette geometry, not a micro bevel.
  const profiles =
    d === 0
      ? [
          [34.5, 26.9, 7.2],
          [36, 28.7, 8.6],
        ]
      : [
          [34.5, 26.9, 7.2],
          [34.8, 27.0, 7.3],
          [35.3, 27.6, 7.8],
          [36, 28.7, 8.6],
        ];
  for (let i = 1; i < profiles.length; i++) {
    const ring = ([y, w, t]) => [
        [center - w / 2, y, -t / 2],
        [center + w / 2, y, -t / 2],
        [center + w / 2, y, t / 2],
        [center - w / 2, y, t / 2],
      ],
      a = ring(profiles[i - 1]),
      b = ring(profiles[i]);
    for (let k = 0; k < 4; k++) {
      const j = (k + 1) % 4;
      f('stone', [a[k], a[j], b[j], b[k]], [a[j][2] - a[k][2], 0.1, a[k][0] - a[j][0]]);
    }
  }
  const [y, w, t] = profiles.at(-1);
  f(
    'stone',
    [
      [center - w / 2, y, -t / 2],
      [center + w / 2, y, -t / 2],
      [center + w / 2, y, t / 2],
      [center - w / 2, y, t / 2],
    ],
    [0, 1, 0],
  );
}
function falcon(f, x, z, d) {
  box(f, 'granite', x, 0, z, 1.7, 0.7, 1.8);
  // Deliberately faceted seated bird, crown and projecting beak.
  box(f, 'granite', x, 0.7, z, 1.0, 1.8, 1.1);
  box(f, 'granite', x, 2.4, z + 0.15, 0.85, 0.75, 0.9);
  if (d >= 2) {
    box(f, 'granite', x, 3.0, z + 0.1, 0.55, 0.65, 0.55);
    box(f, 'granite', x, 2.6, z + 0.72, 0.48, 0.3, 0.42);
  }
}
export function buildEdfu(f, d, r) {
  const c = Math.cos(r.mainAxisRadians),
    s = Math.sin(r.mainAxisRadians),
    o = r.mainAxisOrigin,
    main = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [o[0] + x * c - z * s, y + edfuGrade(z, r), o[1] + x * s + z * c]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      ),
    localZ = (x, z) => -(x - o[0]) * s + (z - o[1]) * c,
    grade = (x, z) => edfuGrade(localZ(x, z), r),
    base = (x, z) => grade(x, z) - 0.6;
  for (const t of r.groundTriangles) f('ground', t, [0, 1, 0]);
  for (const j of d === 0 ? r.farGroundJoins : r.groundJoins) {
    f('ground', j.points, j.normal);
    f(
      'ground',
      j.points,
      j.normal.map((v) => -v),
    );
  }
  for (const part of r.shellPolygons)
    extrusion(f, 'wall', part, base, (x, z) => grade(x, z) + 10.8);
  pylon(main, -20.2, d);
  pylon(main, 20.2, d);
  // The central gateway remains open through both jambs at every level.
  box(main, 'stone', -3.65, -0.5, 1, 1.1, 18.5, 8);
  box(main, 'stone', 3.65, -0.5, 1, 1.1, 18.5, 8);
  box(main, 'stone', 0, 12.3, 1, 6.3, 5.7, 8);
  box(main, 'stone', 0, 18, 1, 9.2, 0.9, 8.9);
  if (d >= 1) {
    falcon(main, -5.7, 8.5, d);
    falcon(main, 5.7, 8.5, d);
  }
  // Open court: thirty-two estimated column positions, with broad roofed side galleries.
  const columnStep = d === 0 ? 3 : 1;
  for (const side of [-1, 1]) {
    box(main, 'wall', side * 18.2, 10.2, -32, 7.0, 1.15, 48);
    for (let i = 0; i < 12; i += columnStep)
      column(main, side * 15.5, -12 - i * 3.75, 9.8, 0.72, d);
  }
  box(main, 'wall', 0, 10.2, -8.7, 34, 1.15, 5.4);
  for (let i = 0; i < 8; i += columnStep) column(main, -14 + i * 4, -10.7, 9.8, 0.72, d);
  // Exact mapped pronaos roof, with a columned southern facade rather than a solid box.
  extrusion(
    f,
    'wall',
    r.hall,
    (x, z) => grade(x, z) + 18.4,
    (x, z) => grade(x, z) + 19.5,
  );
  const hallRing = r.hall.polygon[0].slice(0, -1);
  for (let i = 1; i < hallRing.length; i++) {
    const a = hallRing[i],
      b = hallRing[(i + 1) % hallRing.length];
    f(
      'wall',
      [
        [a[0], base(...a), a[1]],
        [b[0], base(...b), b[1]],
        [b[0], grade(...b) + 18.4, b[1]],
        [a[0], grade(...a) + 18.4, a[1]],
      ],
      [b[1] - a[1], 0, a[0] - b[0]],
    );
    f(
      'wall',
      [
        [a[0], base(...a), a[1]],
        [b[0], base(...b), b[1]],
        [b[0], grade(...b) + 18.4, b[1]],
        [a[0], grade(...a) + 18.4, a[1]],
      ],
      [a[1] - b[1], 0, b[0] - a[0]],
    );
  }
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 6; i += columnStep) column(main, -15 + i * 6, -57 - row * 10, 18.2, 1.1, d);
  box(main, 'wall', -10.8, 0, -57, 15.3, 5.4, 1.5);
  box(main, 'wall', 10.8, 0, -57, 15.3, 5.4, 1.5);
  box(main, 'stone', 0, 12.8, -57, 5.8, 5.6, 2.0);
  for (const roof of r.roofParts)
    for (const part of roof.parts)
      extrusion(f, 'wall', part, base, (x, z) => grade(x, z) + roof.height);
  // Southern component is separate and follows its own independently mapped column centers.
  const southern = r.southernFloor,
    outline = r.southernBuilding.polygons[0].outline,
    part = { polygon: [[...outline, outline[0]]], triangles: r.southernRoofTriangles };
  extrusion(
    f,
    'wall',
    part,
    () => southern - 0.65,
    () => southern + 0.25,
  );
  extrusion(
    f,
    'wall',
    part,
    () => southern + 5.2,
    () => southern + 5.8,
  );
  const columns = r.southernParts.filter((b) => b.id !== 35185626007089);
  for (const [i, b] of columns.entries()) {
    if (d === 0 && i % 2) continue;
    const ps = b.polygons[0].outline,
      x = ps.reduce((n, p) => n + p[0], 0) / ps.length,
      z = ps.reduce((n, p) => n + p[1], 0) / ps.length;
    column(f, x, z, 4.8, 0.55, d, southern + 0.25);
  }
  for (const part of r.southernRearPolygons)
    extrusion(
      f,
      'wall',
      part,
      () => southern - 0.6,
      () => southern + 5.2,
    );
}

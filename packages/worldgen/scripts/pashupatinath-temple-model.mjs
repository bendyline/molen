/** Principal Pashupatinath pagoda, not the surrounding multi-temple precinct. */
export const pashupatinathCandidateId = 'N0496';
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
function beam(f, role, a, b, width) {
  const u = b.map((v, i) => v - a[i]),
    len = Math.hypot(...u),
    axis = u.map((v) => v / len),
    side = [axis[2], 0, -axis[0]],
    sl = Math.hypot(...side) || 1,
    across = side.map((v) => v / sl),
    other = [axis[1] * across[2], axis[2] * across[0] - axis[0] * across[2], -axis[1] * across[0]],
    ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, y]) => p.map((v, i) => v + ((across[i] * x + other[i] * y) * width) / 2)),
    low = ring(a),
    high = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(
      role,
      [low[i], low[j], high[j], high[i]],
      low[i].map((v, k) => v - a[k]),
    );
  }
  f(
    role,
    low,
    axis.map((v) => -v),
  );
  f(role, high, axis);
}
function lathe(f, profile, n) {
  const p = (j, i) => [
    Math.cos((i * 2 * Math.PI) / n) * profile[j][1],
    profile[j][0],
    Math.sin((i * 2 * Math.PI) / n) * profile[j][1],
  ];
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++)
      f(
        'gold',
        [p(j - 1, i), p(j - 1, i + 1), p(j, i + 1), p(j, i)],
        [Math.cos(((i + 0.5) * 2 * Math.PI) / n), 0, Math.sin(((i + 0.5) * 2 * Math.PI) / n)],
      );
  for (const [j, norm] of [
    [0, [0, -1, 0]],
    [profile.length - 1, [0, 1, 0]],
  ])
    for (let i = 1; i < n - 1; i++) f('gold', [p(j, 0), p(j, i), p(j, i + 1)], norm);
}
function roof(f, roof, d) {
  const sides = d === 0 ? 1 : d === 1 ? 2 : 4,
    outline = roof.outline,
    ring = (scale, y, lift) =>
      outline.flatMap((a, k) => {
        const b = outline[(k + 1) % 4];
        return Array.from({ length: sides }, (_, i) => {
          const t = i / sides,
            curve = lift * Math.pow(Math.abs(t - 0.5) * 2, 2);
          return [
            (a[0] + (b[0] - a[0]) * t) * scale,
            y + curve,
            (a[1] + (b[1] - a[1]) * t) * scale,
          ];
        });
      }),
    profiles =
      d === 0
        ? [
            [1, roof.eave, 0.12],
            [roof.innerScale, roof.crest, 0],
          ]
        : [
            [1, roof.eave - 0.18, 0.18],
            [1, roof.eave, 0.18],
            [0.86, roof.eave + 0.34, 0.08],
            [roof.innerScale, roof.crest, 0],
          ],
    rings = profiles.map((p) => ring(...p));
  for (let j = 1; j < rings.length; j++)
    for (let i = 0; i < rings[j].length; i++) {
      const k = (i + 1) % rings[j].length;
      f(
        'gold',
        [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]],
        j === 1 && d > 0 ? [rings[j - 1][i][0], 0, rings[j - 1][i][2]] : [0, 1, 0],
      );
    }
  for (let i = 1; i < rings[0].length - 1; i++)
    f('timber', [rings[0][0], rings[0][i], rings[0][i + 1]], [0, -1, 0]);
  const top = rings.at(-1);
  for (let i = 1; i < top.length - 1; i++) f('gold', [top[0], top[i], top[i + 1]], [0, 1, 0]);
}
export function buildPashupatinath(f, d, r) {
  const o = r.mainAxisOrigin,
    c = Math.cos(r.mainAxisRadians),
    s = Math.sin(r.mainAxisRadians),
    floor = r.floorY,
    main = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [o[0] + x * c - z * s, y + floor, o[1] + x * s + z * c]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      );
  const ring = r.baseControls,
    sign = Math.sign(
      ring.reduce((n, a, i) => {
        const b = ring[(i + 1) % ring.length];
        return n + a.point[0] * b.point[1] - b.point[0] * a.point[1];
      }, 0),
    );
  for (const ids of r.baseTriangles) {
    f(
      'stone',
      ids.map((i) => [ring[i].point[0], floor, ring[i].point[1]]),
      [0, 1, 0],
    );
    f(
      'stone',
      ids.map((i) => [ring[i].point[0], ring[i].bottomY, ring[i].point[1]]),
      [0, -1, 0],
    );
  }
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i],
      b = ring[(i + 1) % ring.length];
    f(
      'stone',
      [
        [a.point[0], a.bottomY, a.point[1]],
        [b.point[0], b.bottomY, b.point[1]],
        [b.point[0], floor, b.point[1]],
        [a.point[0], floor, a.point[1]],
      ],
      [sign * (b.point[1] - a.point[1]), 0, -sign * (b.point[0] - a.point[0])],
    );
  }
  box(main, 'timber', 0, 0.4, 0, 12.4, 7.2, 12.4);
  // The independently mapped upper-storey outline is retained, including its slight skew.
  const upper = r.upperBody,
    area = upper.reduce((n, a, i) => {
      const b = upper[(i + 1) % 4];
      return n + a[0] * b[1] - b[0] * a[1];
    }, 0);
  for (let i = 0; i < 4; i++) {
    const a = upper[i],
      b = upper[(i + 1) % 4];
    main(
      'timber',
      [
        [a[0], 11.5, a[1]],
        [b[0], 11.5, b[1]],
        [b[0], 14.5, b[1]],
        [a[0], 14.5, a[1]],
      ],
      [Math.sign(area) * (b[1] - a[1]), 0, -Math.sign(area) * (b[0] - a[0])],
    );
  }
  for (let i = 1; i < 3; i++)
    main(
      'timber',
      [
        [upper[0][0], 14.5, upper[0][1]],
        [upper[i][0], 14.5, upper[i][1]],
        [upper[i + 1][0], 14.5, upper[i + 1][1]],
      ],
      [0, 1, 0],
    );
  for (const a of r.roofs) roof(main, a, d);
  // Rotate one door/strut treatment to all four cardinal faces of the pagoda grid.
  for (let face = 0; face < 4; face++) {
    const a = (face * Math.PI) / 2,
      co = Math.cos(a),
      si = Math.sin(a),
      side = (role, ps, n) =>
        main(
          role,
          ps.map(([x, y, z]) => [co * x - si * z, y, si * x + co * z]),
          [co * n[0] - si * n[2], n[1], si * n[0] + co * n[2]],
        );
    box(side, 'silver', 0, 0.48, 6.25, 1.65, 3.25, 0.14);
    if (d >= 1) {
      box(side, 'gold', -1.0, 0.42, 6.37, 0.25, 3.65, 0.22);
      box(side, 'gold', 1.0, 0.42, 6.37, 0.25, 3.65, 0.22);
      box(side, 'gold', 0, 3.85, 6.37, 2.6, 0.38, 0.28);
      box(side, 'gold', 0, 4.28, 6.35, 1.5, 0.4, 0.27);
      for (let i = 0; i < 3; i++)
        box(side, 'stone', 0, i * 0.14, 7.35 - i * 0.35, 2.8, 0.14 * (i + 1), 2.15 - i * 0.7);
    }
    if (d >= 2) {
      box(side, 'timber', 0, 0.45, 6.36, 0.13, 3.15, 0.18);
      for (const x of [-4.5, -2.6, 2.6, 4.5]) {
        box(side, 'gold', x, 1.1, 6.25, 0.13, 5.8, 0.14);
        box(side, 'timber', x, 1.3, 6.28, 1.2, 3.9, 0.1);
      }
      for (const y of [0.7, 5.5, 6.8, 7.3]) box(side, 'gold', 0, y, 6.25, 12.4, 0.12, 0.16);
      const n = d === 2 ? 5 : 9;
      for (let i = 0; i < n; i++)
        box(side, 'gold', -3.65 + (i * 7.3) / (n - 1), 11.9, 4.3, 0.12, 2.2, 0.12);
      for (const y of [11.8, 14.05]) box(side, 'gold', 0, y, 4.3, 8.5, 0.13, 0.15);
    }
    const count = d === 0 ? 1 : d === 1 ? 2 : d === 2 ? 4 : 6;
    for (let i = 0; i < count; i++) {
      const x = count === 1 ? 0 : -4.8 + (i * 9.6) / (count - 1);
      beam(side, 'timber', [x, 6.3, 6.1], [x, 8.8, 8.6], d === 0 ? 0.45 : 0.23);
      beam(side, 'timber', [x * 0.66, 12.5, 4.05], [x * 0.66, 14.25, 5.9], d === 0 ? 0.35 : 0.18);
    }
  }
  // Large square finial base and a faceted spire retain the full23.07m silhouette at every level.
  box(main, 'gold', 0, 17.42, 0, 1.8, 0.55, 1.8);
  box(main, 'gold', 0, 17.97, 0, 1.25, 0.55, 1.25);
  const profile =
    d === 0
      ? [
          [19.9, 0.43],
          [20.7, 0.3],
          [21.9, 0.14],
          [23.07, 0],
        ]
      : d === 1
        ? [
            [19.9, 0.43],
            [20.2, 0.43],
            [20.7, 0.26],
            [21.1, 0.34],
            [21.4, 0.15],
            [22, 0.2],
            [22.2, 0.1],
            [23.07, 0],
          ]
        : [
            [19.9, 0.43],
            [20.15, 0.43],
            [20.45, 0.24],
            [20.66, 0.36],
            [20.9, 0.24],
            [21.1, 0.3],
            [21.35, 0.12],
            [21.56, 0.22],
            [21.8, 0.12],
            [22.02, 0.18],
            [22.23, 0.085],
            [22.45, 0.12],
            [22.65, 0.045],
            [23.07, 0],
          ];
  const pinnacle = profile.map(([y, radius]) => [18.4 + ((y - 19.9) * 4.67) / 3.17, radius]);
  lathe(main, pinnacle, d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : d === 3 ? 12 : 16);
}

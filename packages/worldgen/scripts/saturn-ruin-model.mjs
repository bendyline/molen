/** The surviving eight-column Temple of Saturn ruin, not the missing Roman temple. */
export const saturnCandidateId = 'N0503';
function box(f, role, x, y, z, width, height, depth, skipFront = false) {
  const p = [
    [-width / 2, 0, -depth / 2],
    [width / 2, 0, -depth / 2],
    [width / 2, 0, depth / 2],
    [-width / 2, 0, depth / 2],
  ].map(([a, b, c]) => [a + x, b + y, c + z]);
  const q = p.map(([a, b, c]) => [a, b + height, c]);
  const normals = [
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ];
  for (let i = skipFront ? 1 : 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [p[i], p[j], q[j], q[i]], normals[i]);
  }
  f(role, q, [0, 1, 0]);
  f(role, p, [0, -1, 0]);
}
function lathe(f, role, point, levels, n) {
  const rings = levels.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [point[0] + Math.cos(a) * r, y, point[1] + Math.sin(a) * r];
    }),
  );
  for (let k = 1; k < rings.length; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      f(
        role,
        [rings[k - 1][i], rings[k - 1][j], rings[k][j], rings[k][i]],
        [
          (levels[k][0] - levels[k - 1][0]) * Math.cos(a),
          levels[k - 1][1] - levels[k][1],
          (levels[k][0] - levels[k - 1][0]) * Math.sin(a),
        ],
      );
    }
  f(role, rings[0], [0, -1, 0]);
  f(role, rings.at(-1), [0, 1, 0]);
}
function prism(f, role, poly, triangles, bottom, top) {
  for (const t of triangles)
    f(
      role,
      t.map(([x, z]) => [x, top, z]),
      [0, 1, 0],
    );
  for (const [ringIndex, ring] of poly.entries())
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i],
        b = ring[i + 1],
        area = ring.slice(0, -1).reduce((n, p, k) => {
          const q = ring[k + 1];
          return n + p[0] * q[1] - q[0] * p[1];
        }, 0),
        sign = (area >= 0 ? 1 : -1) * (ringIndex === 0 ? 1 : -1);
      f(
        role,
        [
          [a[0], bottom, a[1]],
          [b[0], bottom, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
      );
    }
}
function column(f, p, d, Y) {
  const [x, z] = p.localPoint,
    n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 12 : 16,
    bottom = 4.1,
    top = 14.7;
  if (d === 0) {
    box(f, 'marble', x, Y(bottom), z, 1.9, 0.45, 1.9);
    lathe(
      f,
      'granite',
      [x, z],
      [
        [Y(bottom + 0.45), 0.8],
        [Y(top), 0.68],
      ],
      n,
    );
    box(f, 'marble', x, Y(top), z, 2.05, 0.75, 2.05);
    return;
  }
  lathe(
    f,
    'marble',
    [x, z],
    d === 1
      ? [
          [Y(bottom), 1.04],
          [Y(bottom + 0.25), 1.04],
          [Y(bottom + 0.45), 0.87],
          [Y(bottom + 0.65), 0.84],
        ]
      : [
          [Y(bottom), 1.06],
          [Y(bottom + 0.13), 1.06],
          [Y(bottom + 0.22), 0.94],
          [Y(bottom + 0.32), 1.01],
          [Y(bottom + 0.43), 0.88],
          [Y(bottom + 0.52), 0.94],
          [Y(bottom + 0.65), 0.84],
        ],
    n,
  );
  const repaired = [35184503646433, 35184503646438, 35185372618770].includes(p.id);
  const shaft = [
    [Y(bottom + 0.6), 0.8],
    [Y(bottom + 3.8), 0.79],
    [Y(top - 2.8), 0.72],
    [Y(top), 0.68],
  ];
  if (d >= 3 && repaired)
    shaft.splice(
      2,
      0,
      [Y(bottom + 5.0), 0.77],
      [Y(bottom + 5.03), 0.745],
      [Y(bottom + 5.06), 0.77],
    );
  lathe(f, 'granite', [x, z], shaft, n);
  lathe(
    f,
    'marble',
    [x, z],
    [
      [Y(top - 0.07), 0.71],
      [Y(top + 0.17), 0.86],
      [Y(top + 0.4), 0.94],
    ],
    n,
  );
  for (const side of [-1, 1]) {
    const roll = (role, ps, normal) =>
      f(
        role,
        ps.map(([a, b, c]) => [x + side * 0.76 + a, Y(15.08) + c, z + b]),
        [normal[0], normal[2], normal[1]],
      );
    lathe(
      roll,
      'marble',
      [0, 0],
      d >= 2
        ? [
            [-0.44, 0.25],
            [-0.36, 0.3],
            [0.36, 0.3],
            [0.44, 0.25],
          ]
        : [
            [-0.38, 0.28],
            [0.38, 0.28],
          ],
      d === 1 ? 6 : d === 2 ? 10 : 14,
    );
  }
  box(f, 'marble', x, Y(15.28), z, 2.12, 0.17, 1.95);
}
function podium(f, r, d) {
  for (const floor of r.floors)
    for (const t of floor.triangles)
      f(
        'ground',
        t.map(([x, z]) => [x, floor.height, z]),
        [0, 1, 0],
      );
  for (const e of r.wallEdges) {
    const dx = (e.b[0] - e.a[0]) / e.length,
      dz = (e.b[1] - e.a[1]) / e.length,
      n = [dz, 0, -dx],
      point = ([x, y], depth = 0) => [
        e.a[0] + x * dx - dz * depth,
        y,
        e.a[1] + x * dz + dx * depth,
      ];
    if (d < 2 || !e.portal) {
      f(
        'rubble',
        [
          point([0, r.foundationBase]),
          point([e.length, r.foundationBase]),
          point([e.length, r.podiumTop]),
          point([0, r.podiumTop]),
        ],
        n,
      );
      continue;
    }
    const p = e.portal;
    for (const panel of p.panels)
      for (const t of panel.triangles)
        f(
          'rubble',
          t.map((v) => point(v)),
          n,
        );
    // An actual recessed chamber opening, with a closed back and physical intrados.
    for (let i = 0; i < p.cavity.length - 1; i++) {
      const a = p.cavity[i],
        b = p.cavity[i + 1],
        tx = a[1] - b[1],
        ty = b[0] - a[0];
      f(
        'brick',
        [point(a), point(b), point(b, p.depth), point(a, p.depth)],
        [dx * tx, ty, dz * tx],
      );
    }
    const cavity = p.cavity.slice(0, -1);
    // The opening is convex; fan triangles close its back without filling the front.
    for (let i = 1; i < cavity.length - 1; i++)
      f(
        'brick',
        [point(cavity[0], p.depth), point(cavity[i], p.depth), point(cavity[i + 1], p.depth)],
        n,
      );
  }
}
function inscription(f, r, Y) {
  const p = r.inscription,
    z = p.frontZ;
  for (const panel of p.panels)
    for (const t of panel.triangles)
      f(
        'marble',
        t.map(([x, y]) => [x, Y(y), z]),
        [0, 0, -1],
      );
  for (const glyph of p.glyphs) {
    for (const t of glyph.triangles)
      f(
        'granite',
        t.map(([x, y]) => [x, Y(y), z + p.depth]),
        [0, 0, -1],
      );
    for (const ring of glyph.polygons)
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i],
          b = ring[i + 1];
        f(
          'marble',
          [
            [a[0], Y(a[1]), z],
            [b[0], Y(b[1]), z],
            [b[0], Y(b[1]), z + p.depth],
            [a[0], Y(a[1]), z + p.depth],
          ],
          [a[1] - b[1], b[0] - a[0], 0],
        );
      }
  }
}
export function buildSaturn(f, d, r) {
  const c = Math.cos(r.mainAxisRadians),
    s = Math.sin(r.mainAxisRadians),
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x * c - z * s, y, x * s + z * c]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      ),
    Y = (y) => r.floorY + y;
  podium(f, r, d);
  for (const p of r.walls)
    for (const poly of p.polygons)
      prism(
        f,
        'brick',
        [[...poly.outline, poly.outline[0]], ...poly.holes.map((h) => [...h, h[0]])],
        poly.triangles,
        r.podiumTop - 0.02,
        r.podiumTop + p.height,
      );
  for (const p of r.columns) column(at, p, d, Y);
  // Six front columns support the inscribed beam; only the two short side returns survive.
  for (const [bottom, height, width, depth] of d === 0
    ? [[15.45, 2.05, 22.6, 2.1]]
    : [
        [15.45, 0.35, 22.1, 1.9],
        [15.8, 1.35, 22.6, 2.1],
        [17.15, 0.35, 23.0, 2.45],
      ]) {
    const letterFace = d >= 3 && bottom === 15.8;
    box(at, 'marble', 1.6, Y(bottom), -13.1, width, height, depth, letterFace);
    for (const x of [-7.9, 11.16]) box(at, 'marble', x, Y(bottom), -10.125, depth, height, 3.85);
  }
  if (d >= 3) inscription(at, r, Y);
  // Broken low core above the entablature; the vanished triangular roof stays absent.
  for (const p of r.pedimentParts) {
    for (const t of p.triangles) {
      at(
        'brick',
        t.map(([x, y]) => [x, Y(y), p.frontZ]),
        [0, 0, -1],
      );
      at(
        'brick',
        t.map(([x, y]) => [x, Y(y), p.backZ]),
        [0, 0, 1],
      );
    }
    for (let i = 0; i < p.outline.length - 1; i++) {
      const a = p.outline[i],
        b = p.outline[i + 1];
      at(
        'brick',
        [
          [a[0], Y(a[1]), p.frontZ],
          [b[0], Y(b[1]), p.frontZ],
          [b[0], Y(b[1]), p.backZ],
          [a[0], Y(a[1]), p.backZ],
        ],
        [b[1] - a[1], a[0] - b[0], 0],
      );
    }
  }
  if (d >= 2) {
    for (let i = 0; i < 23; i++) {
      const x = -9.6 + i,
        broken = i % 7 === 0;
      box(at, 'marble', x, Y(17.46), -13.05, 0.85, broken ? 0.28 : 0.14, 1.9);
    }
    for (let i = 0; i < 18; i++) {
      const x = -9.05 + i * 1.25;
      box(at, 'marble', x, Y(15.53), -12.11, 0.35, 0.25, 0.21);
      // Selected acanthus-like lobes on the reused rear band are coarse geometry.
      if (d >= 3)
        for (const side of [-1, 1])
          lathe(
            at,
            'marble',
            [x + side * 0.2, -11.99],
            [
              [Y(16.0), 0.1],
              [Y(16.27), 0.19],
              [Y(16.56), 0.05],
            ],
            6,
          );
    }
    for (let i = 0; i < 16; i++) {
      const x = -6 + (i % 4) * 3.0,
        z = -4 + Math.floor(i / 4) * 4.1;
      box(at, 'rubble', x, r.podiumTop + 0.02, z, 0.7 + (i % 3) * 0.2, 0.24 + (i % 4) * 0.1, 0.55);
    }
  }
}

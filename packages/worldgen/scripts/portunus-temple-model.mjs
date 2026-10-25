/** Temple of Portunus: mapped podium/stairs, six free and twelve engaged Ionic columns. */
export const portunusCandidateId = 'temple_of_portunus';
function box(f, role, x, y, z, w, h, depth) {
  const a = [
      [-w / 2, 0, -depth / 2],
      [w / 2, 0, -depth / 2],
      [w / 2, 0, depth / 2],
      [-w / 2, 0, depth / 2],
    ].map(([u, v, t]) => [x + u, y + v, z + t]),
    b = a.map(([u, v, t]) => [u, v + h, t]),
    ns = [
      [0, 0, -1],
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
    ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [a[i], a[j], b[j], b[i]], ns[i]);
  }
  f(role, a, [0, -1, 0]);
  f(role, b, [0, 1, 0]);
}
function prism(f, role, poly, triangles, bottom, top) {
  for (const t of triangles)
    f(
      role,
      t.map(([x, z]) => [x, top, z]),
      [0, 1, 0],
    );
  for (const [k, ring] of poly.entries()) {
    const area = ring.slice(0, -1).reduce((n, p, i) => {
        const q = ring[i + 1];
        return n + p[0] * q[1] - q[0] * p[1];
      }, 0),
      sign = (area >= 0 ? 1 : -1) * (k === 0 ? 1 : -1);
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i],
        b = ring[i + 1];
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
}
function lathe(f, role, x, z, levels, n, flutes = 0) {
  const rings = levels.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        rad = r - (flutes ? 0.025 * (1 - Math.cos(a * flutes)) : 0);
      return [x + Math.cos(a) * rad, y, z + Math.sin(a) * rad];
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
function column(f, p, d, Y) {
  const [x, z] = p.localPoint;
  if (d === 0) {
    lathe(
      f,
      'stone',
      x,
      z,
      [
        [Y(3.2), 0.47],
        [Y(10.05), 0.4],
      ],
      6,
    );
    box(f, 'stone', x, Y(10.05), z, 1.05, 0.2, 1.05);
    return;
  }
  lathe(
    f,
    'stone',
    x,
    z,
    d === 1
      ? [
          [Y(3.2), 0.61],
          [Y(3.35), 0.61],
          [Y(3.5), 0.48],
        ]
      : [
          [Y(3.2), 0.62],
          [Y(3.27), 0.62],
          [Y(3.34), 0.55],
          [Y(3.42), 0.59],
          [Y(3.49), 0.48],
          [Y(3.56), 0.52],
          [Y(3.62), 0.46],
        ],
    d === 1 ? 6 : d === 2 ? 12 : 24,
  );
  lathe(
    f,
    'stone',
    x,
    z,
    [
      [Y(3.5), 0.46],
      [Y(6.4), 0.455],
      [Y(9.65), 0.385],
    ],
    d === 1 ? 8 : d === 2 ? 48 : 96,
    d === 1 ? 0 : 24,
  );
  box(f, 'stone', x, Y(9.65), z, 1.03, 0.22, 0.92);
  if (d === 1) {
    for (const side of [-1, 1]) box(f, 'stone', x + side * 0.43, Y(9.81), z, 0.32, 0.3, 0.7);
  } else {
    const a = p.corner ? Math.PI / 4 : 0,
      co = Math.cos(a),
      si = Math.sin(a);
    for (const side of [-1, 1]) {
      const roll = (role, ps, n) => {
        const rotated = ps.map(([u, v, t]) => [side * 0.43 + u, t, v]);
        f(
          role,
          rotated.map(([u, v, t]) => [x + u * co - t * si, Y(9.91) + v, z + u * si + t * co]),
          [n[0] * co - n[1] * si, n[2], n[0] * si + n[1] * co],
        );
      };
      lathe(
        roll,
        'stone',
        0,
        0,
        [
          [-0.57, 0.19],
          [-0.27, 0.245],
          [0.27, 0.245],
          [0.57, 0.19],
        ],
        d === 2 ? 12 : 20,
      );
      const segments = d === 2 ? 12 : 20;
      for (const face of [-1, 1])
        for (let i = 0; i < segments; i++) {
          const at = (t, offset) => {
            const a = -Math.PI / 3 + t * Math.PI * 3.3,
              rad = 0.165 * (1 - 0.78 * t) + offset;
            return [side * Math.cos(a) * rad, face * 0.59, Math.sin(a) * rad];
          };
          roll(
            'wall',
            [
              at(i / segments, -0.009),
              at(i / segments, 0.009),
              at((i + 1) / segments, 0.009),
              at((i + 1) / segments, -0.009),
            ],
            [0, face, 0],
          );
        }
    }
  }
  box(f, 'stone', x, Y(10.12), z, 1.19, 0.13, 1.02);
}
function gableBand(f, a, b, z, depth, width) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    len = Math.hypot(dx, dy),
    nx = ((-dy / len) * width) / 2,
    ny = ((dx / len) * width) / 2,
    p = [
      [a[0] + nx, a[1] + ny],
      [b[0] + nx, b[1] + ny],
      [b[0] - nx, b[1] - ny],
      [a[0] - nx, a[1] - ny],
    ],
    front = p.map(([x, y]) => [x, y, z + depth / 2]),
    back = p.map(([x, y]) => [x, y, z - depth / 2]);
  f('stone', front, [0, 0, 1]);
  f('stone', back, [0, 0, -1]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f('stone', [front[i], front[j], back[j], back[i]], [p[j][1] - p[i][1], p[i][0] - p[j][0], 0]);
  }
}
export function buildPortunus(emit, d, r) {
  const c = Math.cos(r.mainAxisRadians),
    s = Math.sin(r.mainAxisRadians),
    Y = (y) => r.floorY + y;
  const f = (role, ps, n) =>
    emit(
      role,
      ps.map(([x, y, z]) => [x * c - z * s, y, x * s + z * c]),
      [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
    );
  for (const floor of r.floors) {
    for (const t of floor.triangles)
      emit(
        'stone',
        t.map(([x, z]) => [x, floor.height, z]),
        [0, 1, 0],
      );
    const ring = floor.outline,
      area = ring.reduce((v, p, i) => {
        const q = ring[(i + 1) % ring.length];
        return v + p[0] * q[1] - q[0] * p[1];
      }, 0),
      sign = area >= 0 ? 1 : -1;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      emit(
        'wall',
        [
          [a[0], r.foundationBase, a[1]],
          [b[0], r.foundationBase, b[1]],
          [b[0], floor.height, b[1]],
          [a[0], floor.height, a[1]],
        ],
        [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
      );
    }
  }
  for (const b of r.bodyPolygons) prism(f, 'wall', b.polygons, b.triangles, Y(3), Y(r.bodyTop));
  box(f, 'wall', 0.02, Y(10), -4.55, 9.1, 0.25, 11.7);
  if (d >= 1) {
    for (const b of r.basePolygons) prism(f, 'stone', b.polygons, b.triangles, Y(3), Y(3.2));
    for (const side of [-1, 1])
      for (const [y, h, w] of [
        [2.5, 0.1, 0.2],
        [2.8, 0.2, 0.25],
      ])
        box(f, 'stone', side * 5.48, Y(y), -1.55, w, h, 19.4);
    box(f, 'stone', 0, Y(2.8), -11.35, 10.95, 0.2, 0.25);
  }
  for (const p of r.columns) column(f, p, d, Y);
  const q = r.roof,
    cx = (q.left + q.right) / 2,
    cz = (q.front + q.back) / 2,
    w = q.right - q.left,
    dep = q.front - q.back;
  const bands =
    d === 0
      ? [[10.25, 1.25, w, dep]]
      : [
          [10.25, 0.08, w - 0.6, dep - 0.6],
          [10.33, 0.12, w - 0.45, dep - 0.45],
          [10.45, 0.54, w - 0.35, dep - 0.35],
          [10.99, 0.26, w - 0.12, dep - 0.12],
          [11.25, 0.25, w, dep],
        ];
  for (const [y, h, width, depth] of bands) box(f, 'stone', cx, Y(y), cz, width, h, depth);
  f(
    'roof',
    [
      [q.left, Y(q.eave), q.front],
      [cx, Y(q.ridge), q.front],
      [cx, Y(q.ridge), q.back],
      [q.left, Y(q.eave), q.back],
    ],
    [-(q.ridge - q.eave), cx - q.left, 0],
  );
  f(
    'roof',
    [
      [cx, Y(q.ridge), q.front],
      [q.right, Y(q.eave), q.front],
      [q.right, Y(q.eave), q.back],
      [cx, Y(q.ridge), q.back],
    ],
    [q.ridge - q.eave, q.right - cx, 0],
  );
  for (const side of [-1, 1]) {
    const z = side === 1 ? q.front : q.back;
    f(
      'stone',
      [
        [q.left, Y(q.eave), z],
        [q.right, Y(q.eave), z],
        [cx, Y(q.ridge), z],
      ],
      [0, 0, side],
    );
    if (d >= 1) {
      gableBand(f, [q.left, Y(q.eave)], [cx, Y(q.ridge)], z + side * 0.08, 0.25, 0.22);
      gableBand(f, [cx, Y(q.ridge)], [q.right, Y(q.eave)], z + side * 0.08, 0.25, 0.22);
      box(f, 'stone', cx, Y(q.eave - 0.12), z + side * 0.09, w, 0.2, 0.25);
    }
  }
  const door = r.door;
  box(f, 'door', door.centerX, Y(door.bottom), door.planeZ, door.width, door.height, 0.16);
  box(
    f,
    'wall',
    door.centerX,
    Y(door.bottom + door.height),
    1.0,
    door.width + 0.2,
    10.25 - door.bottom - door.height,
    1.0,
  );
  if (d >= 1) {
    for (const side of [-1, 1])
      box(
        f,
        'stone',
        door.centerX + side * (door.width / 2 + 0.1),
        Y(door.bottom),
        1.15,
        0.22,
        door.height + 0.1,
        0.25,
      );
    box(f, 'stone', door.centerX, Y(door.bottom + door.height), 1.15, door.width + 0.42, 0.2, 0.25);
  }
  if (d >= 2) {
    for (const side of [-1, 1])
      for (let i = 0; i < 22; i++) {
        const z = q.back + 0.5 + ((dep - 1) * i) / 21;
        box(f, 'stone', side * (w / 2 - 0.09), Y(11.02), z, 0.25, 0.2, 0.22);
      }
    for (const z of [q.front, q.back])
      for (let i = 0; i < 14; i++)
        box(
          f,
          'stone',
          q.left + 0.45 + ((w - 0.9) * i) / 13,
          Y(11.02),
          z - 0.06 * Math.sign(z),
          0.21,
          0.2,
          0.26,
        );
    box(
      f,
      'door',
      door.centerX,
      Y(door.bottom + 0.15),
      door.planeZ + 0.1,
      0.08,
      door.height - 0.3,
      0.08,
    );
    for (let i = 1; i < 5; i++)
      box(
        f,
        'door',
        door.centerX,
        Y(door.bottom + (i * door.height) / 5),
        door.planeZ + 0.1,
        door.width - 0.1,
        0.06,
        0.08,
      );
  }
}

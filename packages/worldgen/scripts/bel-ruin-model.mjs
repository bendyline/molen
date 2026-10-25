/** Surviving Temple of Bel precinct and doorway; the destroyed cella is not restored. */
export const belCandidateId = 'temple_of_bel';
function box(f, role, x, y, z, w, h, depth) {
  const a = [
    [-w / 2, 0, -depth / 2],
    [w / 2, 0, -depth / 2],
    [w / 2, 0, depth / 2],
    [-w / 2, 0, depth / 2],
  ].map(([u, v, t]) => [x + u, y + v, z + t]);
  const b = a.map(([u, v, t]) => [u, v + h, t]);
  const ns = [
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
function lathe(f, role, x, z, levels, n) {
  const rings = levels.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [x + Math.cos(a) * r, y, z + Math.sin(a) * r];
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
function fragment(f, p) {
  const a = [
    [-p.width / 2, p.base, -p.depth / 2],
    [p.width / 2, p.base, -p.depth / 2],
    [p.width / 2, p.base, p.depth / 2],
    [-p.width / 2, p.base, p.depth / 2],
  ];
  const b = a.map(([x, y, z], i) => [x, y + p.height * [0.72, 0.96, 0.52, 0.86][i], z]);
  const ns = [
    [0, 0, -1],
    [1, 0, 0],
    [0, 0, 1],
    [-1, 0, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f('stone', [a[i], a[j], b[j], b[i]], ns[i]);
  }
  f('stone', a, [0, -1, 0]);
  f('stone', b, [0, 1, 0]);
}
function bar(f, role, a, b, bottom, top, width) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    len = Math.hypot(dx, dz),
    nx = ((dz / len) * width) / 2,
    nz = ((-dx / len) * width) / 2;
  const p = [
      [a[0] + nx, bottom, a[1] + nz],
      [b[0] + nx, bottom, b[1] + nz],
      [b[0] - nx, bottom, b[1] - nz],
      [a[0] - nx, bottom, a[1] - nz],
    ],
    q = p.map(([x, , z]) => [x, top, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [p[i], p[j], q[j], q[i]], [q[j][2] - q[i][2], 0, q[i][0] - q[j][0]]);
  }
  f(role, p, [0, -1, 0]);
  f(role, q, [0, 1, 0]);
}
function portal(f, r, d) {
  const p = r.portal,
    z = p.point[1],
    x = p.point[0],
    Y = (y) => r.floorY + y,
    n = d === 0 ? 1 : d === 1 ? 2 : 3;
  for (const side of [-1, 1]) {
    const q = z + side * (p.opening / 2 + p.jambWidth / 2);
    box(f, 'stone', x, Y(0), q, p.depth, p.lintelBottom, p.jambWidth);
    if (d >= 1) {
      box(f, 'stone', x - 0.15, Y(0.0), q, p.depth + 0.4, 0.38, p.jambWidth + 0.35);
      for (let j = 0; j < n; j++)
        box(
          f,
          'stone',
          x - p.depth / 2 - 0.05 - j * 0.055,
          Y(0.45),
          q + side * (0.15 + j * 0.13),
          0.12,
          p.lintelBottom - 0.65,
          0.13,
        );
    }
  }
  const width = p.opening + 2 * p.jambWidth;
  const bands =
    d === 0
      ? [[p.lintelBottom, p.corniceTop - p.lintelBottom, width, p.depth]]
      : [
          [p.lintelBottom, 0.42, width + 0.2, p.depth + 0.2],
          [p.lintelBottom + 0.42, 0.28, width + 0.45, p.depth + 0.32],
          [p.lintelBottom + 0.7, 0.35, width + 0.68, p.depth + 0.44],
          [p.lintelBottom + 1.05, 1.05, width + 0.3, p.depth + 0.2],
          [p.lintelBottom + 2.1, 0.32, width + 0.6, p.depth + 0.48],
          [
            p.lintelBottom + 2.42,
            p.corniceTop - p.lintelBottom - 2.42,
            width + 0.92,
            p.depth + 0.75,
          ],
        ];
  for (const [y, h, w, dep] of bands) box(f, 'stone', x, Y(y), z, dep, h, w);
  for (const side of [-1, 1])
    box(
      f,
      'stone',
      x,
      Y(p.corniceTop),
      z + side * (width / 2 - 0.25),
      p.depth + 0.12,
      p.hornTop - p.corniceTop,
      0.55,
    );
  if (d >= 2) {
    for (const side of [-1, 1])
      for (let j = 0; j < 5; j++)
        box(
          f,
          'stone',
          x - p.depth / 2 - 0.06,
          Y(0.75 + j * 1.42),
          z + side * (p.opening / 2 + 0.14),
          0.15,
          0.15,
          0.3,
        );
    for (let i = 0; i < 9; i++)
      box(
        f,
        'stone',
        x - p.depth / 2 - 0.15,
        Y(p.lintelBottom + 0.84),
        z - width * 0.4 + i * width * 0.1,
        0.2,
        0.18,
        0.22,
      );
  }
}
function gate(f, r, d) {
  const q = r.gate,
    z = q.point[1],
    x = q.point[0],
    base = q.base,
    width = q.width,
    opening = q.opening,
    half = opening / 2,
    top = q.top - base;
  for (const side of [-1, 1])
    box(
      f,
      'wall',
      x,
      base,
      z + side * (half + (width - opening) / 4),
      q.depth,
      top,
      (width - opening) / 2,
    );
  const n = d === 0 ? 4 : d === 1 ? 6 : 10;
  for (let i = 0; i < n; i++) {
    const a = -half + (opening * i) / n,
      b = -half + (opening * (i + 1)) / n,
      ya = q.spring + q.rise * Math.sqrt(Math.max(0, 1 - (a / half) ** 2)),
      yb = q.spring + q.rise * Math.sqrt(Math.max(0, 1 - (b / half) ** 2));
    for (const side of [-1, 1])
      f(
        'wall',
        [
          [x + (side * q.depth) / 2, base + ya, z + a],
          [x + (side * q.depth) / 2, base + yb, z + b],
          [x + (side * q.depth) / 2, base + top, z + b],
          [x + (side * q.depth) / 2, base + top, z + a],
        ],
        [side, 0, 0],
      );
    f(
      'stone',
      [
        [x - q.depth / 2, base + ya, z + a],
        [x + q.depth / 2, base + ya, z + a],
        [x + q.depth / 2, base + yb, z + b],
        [x - q.depth / 2, base + yb, z + b],
      ],
      [0, -1, 0],
    );
  }
  box(f, 'stone', x, base + top - 0.2, z, q.depth + 0.08, 0.2, opening);
  if (d >= 1) {
    for (const side of [-1, 1])
      box(
        f,
        'stone',
        x - q.depth / 2 - 0.08,
        base + 0.2,
        z + side * (half + 0.2),
        0.22,
        q.spring + 0.1,
        0.38,
      );
    const n = d >= 2 ? 12 : 6;
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * i) / n,
        b = (Math.PI * (i + 1)) / n,
        inner = (t) => [z + Math.cos(t) * half, base + q.spring + Math.sin(t) * q.rise],
        outer = (t) => [
          z + Math.cos(t) * (half + 0.35),
          base + q.spring + Math.sin(t) * (q.rise + 0.35),
        ],
        p = inner(a),
        q1 = inner(b),
        u = outer(b),
        v = outer(a);
      f(
        'stone',
        [
          [x - r.gate.depth / 2 - 0.04, p[1], p[0]],
          [x - r.gate.depth / 2 - 0.04, q1[1], q1[0]],
          [x - r.gate.depth / 2 - 0.04, u[1], u[0]],
          [x - r.gate.depth / 2 - 0.04, v[1], v[0]],
        ],
        [-1, 0, 0],
      );
    }
    // A shallow upper niche is bounded by geometry; it is not a dark painted doorway.
    const y = base + top - 2.5,
      front = x - q.depth / 2 - 0.32;
    box(f, 'stone', front, y, z, 0.22, 0.18, 1.5);
    for (const side of [-1, 1]) box(f, 'stone', front, y, z + side * 0.68, 0.22, 2.35, 0.18);
    box(f, 'stone', front, y + 2.22, z, 0.22, 0.18, 1.5);
  }
}
export function buildBel(emit, d, r) {
  const c = Math.cos(r.mainAxisRadians),
    s = Math.sin(r.mainAxisRadians);
  const outer = (role, ps, normal) =>
    emit(
      role,
      ps.map(([x, y, z]) => [x * c - z * s, y, x * s + z * c]),
      [normal[0] * c - normal[2] * s, normal[1], normal[0] * s + normal[2] * c],
    );
  const { center, ax, az } = r.cellaFrame;
  const cella = (role, ps, normal) =>
    emit(
      role,
      ps.map(([x, y, z]) => [
        center[0] + x * ax[0] + z * az[0],
        y,
        center[1] + x * ax[1] + z * az[1],
      ]),
      [normal[0] * ax[0] + normal[2] * az[0], normal[1], normal[0] * ax[1] + normal[2] * az[1]],
    );
  let walls = r.walls;
  if (d === 0) {
    const groups = new Map();
    for (const w of walls) {
      const p = groups.get(w.edge);
      if (p) {
        p.b = w.b;
        p.bottom = Math.min(p.bottom, w.bottom);
        p.top = Math.max(p.top, w.top);
      } else groups.set(w.edge, { ...w });
    }
    walls = [...groups.values()];
  }
  for (const w of walls) {
    bar(outer, 'wall', w.a, w.b, w.bottom, w.top, w.width);
    if (d >= 2) {
      const dx = w.b[0] - w.a[0],
        dz = w.b[1] - w.a[1],
        n = Math.max(1, Math.floor(Math.hypot(dx, dz) / 3));
      for (let i = 0; i < n; i++) {
        if ((i + w.edge) % 3 === 0) continue;
        const a = w.a.map((v, k) => v + ((w.b[k] - v) * i) / n),
          b = w.a.map((v, k) => v + (w.b[k] - v) * Math.min(1, (i + 0.7) / n));
        bar(outer, 'stone', a, b, w.top, w.top + 0.18 + ((i + w.edge) % 3) * 0.12, w.width * 0.92);
      }
    }
  }
  gate(outer, r, d);
  for (const floor of r.floors) {
    for (const t of floor.triangles)
      emit(
        'ground',
        t.map(([x, z]) => [x, floor.height, z]),
        [0, 1, 0],
      );
    for (let i = 0; i < floor.outline.length; i++) {
      const a = floor.outline[i],
        b = floor.outline[(i + 1) % floor.outline.length];
      bar(emit, 'wall', a, b, r.foundationBase, floor.height, 0.3);
    }
  }
  portal(cella, r, d);
  const moundRing = [
    [-6, r.floorY, 0],
    [0, r.floorY, 17],
    [6, r.floorY, 0],
    [0, r.floorY, -17],
  ];
  for (let i = 0; i < 4; i++)
    cella('ground', [[0, r.floorY + 1.2, 0], moundRing[i], moundRing[(i + 1) % 4]], [0, 1, 0]);
  const columns = d === 0 ? r.columns.filter((q) => q.standing) : r.columns;
  for (const p of columns) {
    const f = p.rawPoint ? emit : outer,
      [x, z] = p.rawPoint ?? p.point,
      y = p.base,
      h = p.height,
      n = d <= 1 ? 6 : 12;
    const levels =
      d === 0
        ? [
            [y, 0.52],
            [y + h, 0.45],
          ]
        : p.standing
          ? [
              [y, 0.86],
              [y + 0.25, 0.86],
              [y + 0.42, 0.62],
              [y + h - 0.65, 0.47],
              [y + h - 0.4, 0.67],
              [y + h - 0.2, 0.73],
            ]
          : [
              [y, 0.8],
              [y + 0.25, 0.8],
              [y + 0.42, 0.58],
              [y + h, 0.5],
            ];
    lathe(f, 'stone', x, z, levels, n);
    if (p.standing && d >= 1) {
      box(f, 'stone', x, y + h - 0.2, z, 1.62, 0.22, 1.62);
      if (d >= 2)
        for (const side of [-1, 1])
          box(f, 'stone', x + side * 0.6, y + h - 0.65, z, 0.25, 0.36, 0.85);
    }
  }
  // Only the picture-supported central rubble field is populated; positions are schematic.
  const stride = d === 0 ? 31 : d === 1 ? 6 : d === 2 ? 2 : 1;
  for (let i = 0; i < r.rubble.length; i += stride) {
    const p = r.rubble[i],
      co = Math.cos(p.angle),
      si = Math.sin(p.angle),
      f = (role, ps, n) =>
        emit(
          role,
          ps.map(([x, y, z]) => [p.point[0] + x * co - z * si, y, p.point[1] + x * si + z * co]),
          [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
        );
    if (p.drum && d >= 1) {
      const horizontal = (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [x, z + p.base + p.height / 2, y - p.depth / 2]),
          [n[0], n[2], n[1]],
        );
      lathe(
        horizontal,
        'stone',
        0,
        0,
        [
          [0, p.width / 2],
          [p.depth, p.width * 0.46],
        ],
        d === 1 ? 6 : 10,
      );
    } else if (d >= 2 && i % 3 !== 0) fragment(f, p);
    else box(f, 'stone', 0, p.base, 0, p.width, p.height, p.depth);
  }
  if (d >= 1) {
    const q = r.columns.filter((p) => p.standing && !p.rawPoint && p.point[1] === 87);
    if (q.length >= 3) {
      const a = q[1],
        b = q[3];
      bar(outer, 'stone', a.point, b.point, a.base + a.height, a.base + a.height + 0.5, 1.3);
    }
  }
}

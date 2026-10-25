/** Present temple porch and the church/cella of San Lorenzo in Miranda. */
export const antoninusCandidateId = 'temple_of_antoninus_and_faustina';
function box(f, role, x, y, z, w, h, depth, skipFront = false) {
  const p = [
      [-w / 2, 0, -depth / 2],
      [w / 2, 0, -depth / 2],
      [w / 2, 0, depth / 2],
      [-w / 2, 0, depth / 2],
    ].map(([a, b, c]) => [a + x, b + y, c + z]),
    q = p.map(([a, b, c]) => [a, b + h, c]),
    normals = [
      [0, 0, -1],
      [1, 0, 0],
      [0, 0, 1],
      [-1, 0, 0],
    ];
  for (let i = 0; i < 4; i++) {
    if (skipFront && i === 2) continue;
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
function prism(f, role, p, bottom, top) {
  for (const t of p.triangles)
    f(
      role,
      t.map(([x, z]) => [x, top, z]),
      [0, 1, 0],
    );
  for (const [index, ring] of p.polygons.entries()) {
    const sign =
      (ring.slice(0, -1).reduce((n, a, i) => {
        const b = ring[i + 1];
        return n + a[0] * b[1] - b[0] * a[1];
      }, 0) >= 0
        ? 1
        : -1) * (index === 0 ? 1 : -1);
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
function profile(f, role, p, z0, z1, Y) {
  for (const t of p.triangles) {
    f(
      role,
      t.map(([x, y]) => [x, Y(y), z1]),
      [0, 0, 1],
    );
    f(
      role,
      t.map(([x, y]) => [x, Y(y), z0]),
      [0, 0, -1],
    );
  }
  for (const ring of p.polygons) {
    const sign =
      ring.slice(0, -1).reduce((n, a, i) => {
        const b = ring[i + 1];
        return n + a[0] * b[1] - b[0] * a[1];
      }, 0) >= 0
        ? 1
        : -1;
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i],
        b = ring[i + 1];
      f(
        role,
        [
          [a[0], Y(a[1]), z0],
          [b[0], Y(b[1]), z0],
          [b[0], Y(b[1]), z1],
          [a[0], Y(a[1]), z1],
        ],
        [(b[1] - a[1]) * sign, (a[0] - b[0]) * sign, 0],
      );
    }
  }
}
function columns(f, r, d, Y) {
  for (const [index, p] of r.columns.entries()) {
    const [x, z] = p.point,
      n = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 12 : 20;
    if (d === 0) {
      lathe(
        f,
        'stone',
        [x, z],
        [
          [Y(3.2), 0.78],
          [Y(18.3), 0.66],
        ],
        n,
      );
      box(f, 'stone', x, Y(17.8), z, 1.8, 0.5, 1.8);
      continue;
    }
    lathe(
      f,
      'stone',
      [x, z],
      d === 1
        ? [
            [Y(3.2), 0.94],
            [Y(3.5), 0.94],
            [Y(3.8), 0.73],
          ]
        : [
            [Y(3.2), 0.98],
            [Y(3.35), 0.98],
            [Y(3.48), 0.83],
            [Y(3.6), 0.92],
            [Y(3.72), 0.76],
            [Y(3.85), 0.73],
          ],
      n,
    );
    const shaft = [
      [Y(3.8), 0.71],
      [Y(7), 0.71],
      [Y(13), 0.66],
      [Y(17), 0.59],
    ];
    if (d >= 3 && index % 3 === 0)
      shaft.splice(3, 0, [Y(15.4), 0.62], [Y(15.43), 0.59], [Y(15.47), 0.62]);
    lathe(f, 'stone', [x, z], shaft, n);
    lathe(
      f,
      'stone',
      [x, z],
      d === 1
        ? [
            [Y(17), 0.64],
            [Y(18.1), 0.92],
          ]
        : [
            [Y(17), 0.64],
            [Y(17.35), 0.8],
            [Y(17.8), 0.85],
            [Y(18.1), 1.0],
          ],
      n,
    );
    const leaves = d === 1 ? 4 : d === 2 ? 6 : 8,
      layers = d >= 3 ? 2 : 1;
    for (let row = 0; row < layers; row++)
      for (let i = 0; i < leaves; i++) {
        const a = ((i + row * 0.5) * Math.PI * 2) / leaves,
          c = Math.cos(a),
          s = Math.sin(a),
          radius = 0.78 + row * 0.08,
          tx = -s * 0.19,
          tz = c * 0.19,
          y = 17.2 + row * 0.35;
        f(
          'stone',
          [
            [x + c * radius + tx, Y(y), z + s * radius + tz],
            [x + c * radius - tx, Y(y), z + s * radius - tz],
            [x + c * (radius + 0.2), Y(y + 0.55), z + s * (radius + 0.2)],
          ],
          [c, 0, s],
        );
      }
    if (d >= 2)
      for (const a of [0.25, 0.75, 1.25, 1.75].map((v) => v * Math.PI)) {
        const px = x + Math.cos(a) * 0.72,
          pz = z + Math.sin(a) * 0.72;
        lathe(
          f,
          'stone',
          [px, pz],
          [
            [Y(17.7), 0.13],
            [Y(18.03), 0.26],
            [Y(18.18), 0.15],
          ],
          d === 2 ? 4 : 8,
        );
      }
    box(f, 'stone', x, Y(18.1), z, 1.95, 0.2, 1.95);
  }
}
function letterFace(f, r, Y) {
  const p = r.inscription,
    z = p.frontZ;
  for (const panel of p.panels)
    for (const t of panel.triangles)
      f(
        'stone',
        t.map(([x, y]) => [x, Y(y), z]),
        [0, 0, 1],
      );
  for (const glyph of p.glyphs) {
    for (const t of glyph.triangles)
      f(
        'body',
        t.map(([x, y]) => [x, Y(y), z - p.depth]),
        [0, 0, 1],
      );
    for (const ring of glyph.polygons)
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i],
          b = ring[i + 1];
        f(
          'stone',
          [
            [a[0], Y(a[1]), z],
            [b[0], Y(b[1]), z],
            [b[0], Y(b[1]), z - p.depth],
            [a[0], Y(a[1]), z - p.depth],
          ],
          [a[1] - b[1], b[0] - a[0], 0],
        );
      }
  }
}
function pediment(f, x, y, z, width, height) {
  f(
    'stone',
    [
      [x - width / 2, y, z - 0.12],
      [x + width / 2, y, z - 0.12],
      [x, y + height, z - 0.12],
    ],
    [0, 0, 1],
  );
  for (const side of [-1, 1]) {
    const a = [x + (side * width) / 2, y, z],
      b = [x, y + height, z];
    f(
      'stone',
      [
        [a[0], a[1] - 0.15, z - 0.2],
        [b[0], b[1] - 0.15, z - 0.2],
        [b[0], b[1] + 0.08, z + 0.15],
        [a[0], a[1] + 0.08, z + 0.15],
      ],
      [side, 1, 0],
    );
  }
}
function facade(f, r, d, Y) {
  box(f, 'brick', -0.2, Y(3.2), -8.1, 19.4, 25.3, 0.8);
  if (d > 0) {
    for (const y of [7, 17.7, 18.3, 27.6, 28.2])
      box(f, 'stone', -0.2, Y(y), -7.57, 19.8, 0.22, 0.38);
    for (const x of [-8, -3.6, 3.6, 7.6]) {
      box(f, 'brick', x, Y(7.0), -7.5, 0.7, 11.1, 0.35);
      box(f, 'stone', x, Y(17.5), -7.4, 1.1, 0.48, 0.5);
      box(f, 'brick', x, Y(20.7), -7.5, 0.6, 6.8, 0.35);
      box(f, 'stone', x, Y(27.25), -7.4, 1.0, 0.45, 0.5);
    }
  }
  // The visible bronze entrance is deliberately high above the porch floor.
  box(f, 'metal', -0.2, Y(8.8), -7.57, 2.8, 3.8, 0.3);
  if (d > 0) {
    for (const x of [-1.8, 1.4]) box(f, 'stone', x, Y(8.55), -7.3, 0.3, 4.45, 0.4);
    box(f, 'stone', -0.2, Y(12.8), -7.25, 3.9, 0.32, 0.55);
    profile(f, 'stone', r.doorCanopy, -7.5, -7.05, Y);
    box(f, 'stone', -0.2, Y(8.5), -7.3, 3.8, 0.2, 0.5);
    if (d >= 2)
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 4; j++)
          box(f, 'metal', -0.92 + i * 1.42, Y(9.0 + j * 0.86), -7.36, 1.1, 0.66, 0.12);
  }
  box(f, 'glass', -0.2, Y(21.0), -7.54, 3.1, 4.4, 0.25);
  if (d > 0) {
    for (const x of [-2.0, 1.6]) {
      box(f, 'stone', x, Y(20.7), -7.25, 0.34, 5.1, 0.55);
      box(f, 'stone', x, Y(25.5), -7.2, 0.65, 0.24, 0.6);
    }
    box(f, 'stone', -0.2, Y(20.7), -7.22, 4.3, 0.22, 0.6);
    box(f, 'stone', -0.2, Y(25.75), -7.22, 4.3, 0.25, 0.6);
    pediment(f, -0.2, Y(26.0), -7.08, 4.8, 0.95);
    for (const x of [-1.05, -0.2, 0.65]) box(f, 'metal', x, Y(21.05), -7.34, 0.055, 4.25, 0.08);
    for (const y of [22.05, 23.15, 24.25]) box(f, 'metal', -0.2, Y(y), -7.34, 3.05, 0.055, 0.08);
  }
  box(f, 'stone', -0.2, Y(28.3), -7.85, 20.2, 0.35, 1.4);
  for (const p of r.pedimentWings) profile(f, 'brick', p, -8.7, -7.6, Y);
  if (d > 0)
    for (const p of r.pedimentWings)
      for (const ring of p.polygons) {
        for (let i = 0; i < 6; i++) {
          const a = ring[i],
            b = ring[i + 1];
          if (!b) continue;
          f(
            'stone',
            [
              [a[0], Y(a[1]), -7.47],
              [b[0], Y(b[1]), -7.47],
              [b[0], Y(b[1] + 0.16), -7.47],
              [a[0], Y(a[1] + 0.16), -7.47],
            ],
            [0, 0, 1],
          );
        }
      }
  lathe(
    f,
    'stone',
    [0, -7.9],
    [
      [Y(28.65), 1.15],
      [Y(29.3), 0.55],
      [Y(30.5), 0.45],
      [Y(30.75), 0.75],
      [Y(31.15), 0.28],
    ],
    d === 0 ? 4 : 8,
  );
  box(f, 'metal', 0, Y(31.2), -7.9, 0.1, 2.3, 0.12);
  box(f, 'metal', 0, Y(32.45), -7.9, 1.2, 0.1, 0.12);
}
function roof(f, r, d, Y) {
  const q = r.bodyRoof,
    front = q.frontZ,
    back = q.backZ,
    left = q.leftX - 0.25,
    right = q.rightX + 0.25,
    ridge = (left + right) / 2;
  for (const side of [-1, 1]) {
    const x = side < 0 ? left : right;
    f(
      'roof',
      [
        [x, Y(q.eaveY), front],
        [x, Y(q.eaveY), back],
        [ridge, Y(q.ridgeY), back],
        [ridge, Y(q.ridgeY), front],
      ],
      [side, 1, 0],
    );
  }
  for (const [z, normal] of [
    [front, [0, 0, 1]],
    [back, [0, 0, -1]],
  ])
    f(
      'body',
      [
        [left, Y(q.eaveY), z],
        [right, Y(q.eaveY), z],
        [ridge, Y(q.ridgeY), z],
      ],
      normal,
    );
  if (d > 0) {
    box(f, 'roof', ridge, Y(q.ridgeY - 0.08), (front + back) / 2, 0.3, 0.15, front - back + 0.3);
    for (const x of [left, right])
      box(f, 'stone', x, Y(q.eaveY - 0.18), (front + back) / 2, 0.3, 0.2, front - back + 0.35);
  }
}
function buttresses(f, d, Y) {
  if (d === 0) return;
  for (const side of [-1, 1])
    for (const z of [-14.5, -23, -31.5]) {
      const x0 = side * (side < 0 ? 10.5 : 9.8),
        x1 = x0 + side * 2,
        lower = Y(3.2),
        top = Y(22),
        shoulder = Y(18.5),
        p = [
          [x0, lower, z - 0.5],
          [x1, lower, z - 0.5],
          [x1, shoulder, z - 0.5],
          [x0, top, z - 0.5],
        ],
        q = p.map(([x, y, z]) => [x, y, z + 1]);
      f('body', p, [0, 0, -1]);
      f('body', q, [0, 0, 1]);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        f(
          'body',
          [p[i], p[j], q[j], q[i]],
          i === 1 ? [side, 0, 0] : i === 2 ? [side, 1, 0] : i === 0 ? [0, -1, 0] : [-side, 0, 0],
        );
      }
      if (d >= 2) box(f, 'stone', (x0 + x1) / 2, Y(18.4), z, 2.1, 0.2, 1.1);
    }
  for (const side of [-1, 1])
    for (const z of [-17.7, -27.0]) {
      const x = side * (side < 0 ? 10.56 : 9.9);
      box(f, 'glass', x, Y(19.7), z, 0.15, 1.45, 1.25);
      if (d >= 2)
        for (const zz of [z - 0.7, z + 0.7])
          box(f, 'stone', x + side * 0.05, Y(19.5), zz, 0.2, 1.8, 0.16);
    }
}
export function buildAntoninus(f, d, r) {
  const c = Math.cos(r.mainAxisRadians),
    s = Math.sin(r.mainAxisRadians),
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [x * c - z * s, y, x * s + z * c]),
        [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
      ),
    Y = (y) => r.floorY + y;
  for (const floor of r.floors) {
    for (const t of floor.triangles)
      f(
        'body',
        t.map(([x, z]) => [x, floor.height, z]),
        [0, 1, 0],
      );
    const ring = floor.outline;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      f(
        'body',
        [
          [a[0], r.foundationBase, a[1]],
          [b[0], r.foundationBase, b[1]],
          [b[0], floor.height, b[1]],
          [a[0], floor.height, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
  for (const p of r.bodyPolygons) prism(at, 'body', p, r.podiumTop, Y(24.2));
  columns(at, r, d, Y);
  for (const [bottom, height, width, depth] of d === 0
    ? [[18.3, 2.3, 20.3, 1.9]]
    : [
        [18.3, 0.35, 19.9, 1.7],
        [18.65, 1.75, 20.3, 1.9],
        [20.4, 0.2, 20.8, 2.2],
      ]) {
    box(at, 'stone', 0, Y(bottom), -0.9, width, height, depth, d >= 3 && bottom === 18.65);
    for (const x of [-9.05, 9.05]) box(at, 'stone', x, Y(bottom), -5.2, depth, height, 6.7);
  }
  if (d >= 3) letterFace(at, r, Y);
  const st = r.mainStair,
    n = d === 0 ? 1 : d === 1 ? 4 : d === 2 ? 10 : st.treads;
  for (let i = 0; i < n; i++) {
    const z0 = st.start + ((st.end - st.start) * i) / n,
      z1 = st.start + ((st.end - st.start) * (i + 1)) / n,
      y0 = Y(st.top - ((st.top - st.bottom) * i) / n),
      y1 = Y(st.top - ((st.top - st.bottom) * (i + 1)) / n),
      w = st.width / 2,
      x = st.centerX;
    at(
      'brick',
      [
        [x - w, y0, z0],
        [x + w, y0, z0],
        [x + w, d === 0 ? y1 : y0, z1],
        [x - w, d === 0 ? y1 : y0, z1],
      ],
      [0, 1, 0],
    );
    if (d > 0)
      at(
        'brick',
        [
          [x - w, y0, z1],
          [x + w, y0, z1],
          [x + w, y1, z1],
          [x - w, y1, z1],
        ],
        [0, 0, 1],
      );
    for (const side of [-1, 1])
      at(
        'body',
        [
          [x + side * w, r.stairFloor, z0],
          [x + side * w, r.stairFloor, z1],
          [x + side * w, d === 0 ? y1 : y0, z1],
          [x + side * w, y0, z0],
        ],
        [side, 0, 0],
      );
  }
  facade(at, r, d, Y);
  roof(at, r, d, Y);
  buttresses(at, d, Y);
  if (d >= 2) {
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++) {
        const x = side * 10.05,
          z = -2.3 - i;
        lathe(
          at,
          'stone',
          [x, z],
          [
            [Y(19.05), 0.14],
            [Y(19.4), 0.25],
            [Y(19.9), 0.06],
          ],
          6,
        );
      }
    if (d >= 3)
      for (const x of [-8, -3.6, 3.6, 7.6])
        for (const y of [17.5, 27.25]) {
          for (const k of [-1, 0, 1])
            lathe(
              at,
              'stone',
              [x + k * 0.25, -7.14],
              [
                [Y(y), 0.1],
                [Y(y + 0.28), 0.18],
                [Y(y + 0.45), 0.05],
              ],
              6,
            );
        }
  }
}

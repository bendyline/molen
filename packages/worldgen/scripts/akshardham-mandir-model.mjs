/** Akshardham Delhi mandir, sculpted plinth and flanking forecourt pavilions. */
export const akshardhamCandidateId = 'akshardham';
function box(f, role, x, y, z, w, h, depth, angle = 0) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    at = (p) => [x + p[0] * c - p[2] * s, y + p[1], z + p[0] * s + p[2] * c],
    ps = [
      [-w / 2, 0, -depth / 2],
      [w / 2, 0, -depth / 2],
      [w / 2, 0, depth / 2],
      [-w / 2, 0, depth / 2],
    ],
    qs = ps.map((p) => [p[0], h, p[2]]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4,
      n = [
        [0, 0, -1],
        [1, 0, 0],
        [0, 0, 1],
        [-1, 0, 0],
      ][i];
    f(role, [ps[i], ps[j], qs[j], qs[i]].map(at), [n[0] * c - n[2] * s, 0, n[0] * s + n[2] * c]);
  }
  f(role, qs.map(at), [0, 1, 0]);
  f(role, ps.map(at), [0, -1, 0]);
}
function lathe(f, role, point, levels, n, { flutes = false, cap = true } = {}) {
  const ring = ([y, r]) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * Math.PI * 2) / n,
          rr = r * (flutes && i % 3 === 1 ? 0.9 : 1);
        return [point[0] + Math.cos(a) * rr, y, point[1] + Math.sin(a) * rr];
      }),
    rings = levels.map(ring);
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
  if (cap) {
    f(role, rings[0], [0, -1, 0]);
    f(role, rings.at(-1), [0, 1, 0]);
  }
}

function polygon(f, role, poly, triangles, bottom, top, scale = 1) {
  const p = ([x, z], y) => [x * scale, y, z * scale];
  for (const t of triangles)
    f(
      role,
      t.map((v) => p(v, top)),
      [0, 1, 0],
    );
  for (const ring of poly)
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i],
        b = ring[i + 1];
      f(role, [p(a, bottom), p(b, bottom), p(b, top), p(a, top)], [b[1] - a[1], 0, a[0] - b[0]]);
    }
}
function squareRoof(f, x, z, y, width, height, d) {
  const n = d <= 1 ? 1 : d === 2 ? 3 : 5;
  for (let k = 0; k < n; k++) {
    const w = width * (1 - k / n) * 0.93 + 0.25,
      next = width * (1 - (k + 1) / n) * 0.93 + 0.25,
      lo = y + (height * k) / n,
      hi = y + (height * (k + 1)) / n;
    const ring = (size, Y) =>
        [
          [-size / 2, Y, -size / 2],
          [size / 2, Y, -size / 2],
          [size / 2, Y, size / 2],
          [-size / 2, Y, size / 2],
        ].map((p) => [p[0] + x, p[1], p[2] + z]),
      a = ring(w, lo),
      b = ring(next, hi);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      f(
        'roof',
        [a[i], a[j], b[j], b[i]],
        [
          [0, 1, -1],
          [1, 1, 0],
          [0, 1, 1],
          [-1, 1, 0],
        ][i],
      );
    }
    if (d >= 2) box(f, 'roof', x, lo - 0.1, z, w + 0.3, 0.17, w + 0.3);
  }
  f(
    'roof',
    [
      [x - 0.125, y + height, z - 0.125],
      [x + 0.125, y + height, z - 0.125],
      [x + 0.125, y + height, z + 0.125],
      [x - 0.125, y + height, z + 0.125],
    ],
    [0, 1, 0],
  );
}
function column(f, x, z, bottom, top, d, radius = 0.65) {
  const n = d === 0 ? 4 : d === 1 ? 4 : d === 2 ? 6 : 8;
  lathe(
    f,
    'stone',
    [x, z],
    d <= 1
      ? [
          [bottom, radius],
          [top, radius * 0.85],
        ]
      : d === 2
        ? [
            [bottom, radius * 1.2],
            [bottom + 0.35, radius],
            [top - 0.4, radius * 0.8],
            [top, radius * 1.35],
          ]
        : [
            [bottom, radius * 1.3],
            [bottom + 0.2, radius * 1.3],
            [bottom + 0.45, radius],
            [top - 0.85, radius * 0.8],
            [top - 0.4, radius * 1.05],
            [top, radius * 1.45],
          ],
    n,
  );
}
function dome(f, p, d, Y) {
  const h = p.top - p.base,
    n = d === 0 ? 6 : d === 1 ? 8 : d === 2 ? 16 : 24;
  if (d === 0) {
    lathe(
      f,
      'roof',
      p.point,
      [
        [Y(15.5), p.radius * 0.75],
        [Y(p.base + h * 0.3), p.radius],
        [Y(p.top), p.radius * 0.08],
        [Y(p.tip), 0.025],
      ],
      n,
    );
    return;
  }
  // Terraced masonry supports the open upper drum, rather than a floating dome.
  const lower = Y(15.5),
    drum = Y(p.base - 3);
  lathe(
    f,
    'stone',
    p.point,
    d === 1
      ? [
          [lower, p.radius * 0.86],
          [drum, p.radius * 1.03],
        ]
      : [
          [lower, p.radius * 0.86],
          [drum - 0.6, p.radius * 0.86],
          [drum, p.radius * 1.03],
        ],
    d === 1 ? 6 : 12,
  );
  if (d >= 2)
    for (let y = lower + 2.4; y < drum - 0.4; y += 2.8)
      lathe(
        f,
        'stone',
        p.point,
        [
          [y, p.radius * 0.93],
          [y + 0.28, p.radius * 0.93],
        ],
        d === 2 ? 6 : 12,
      );
  if (d >= 3)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      box(
        f,
        'stone',
        p.point[0] + Math.cos(a) * p.radius * 0.84,
        lower + 0.4,
        p.point[1] + Math.sin(a) * p.radius * 0.84,
        0.48,
        drum - lower - 0.6,
        0.4,
        a,
      );
    }
  const cols = d === 1 ? 4 : d === 2 ? 6 : 8;
  for (let i = 0; i < cols; i++) {
    const a = (i * Math.PI * 2) / cols;
    column(
      f,
      p.point[0] + Math.cos(a) * p.radius * 0.8,
      p.point[1] + Math.sin(a) * p.radius * 0.8,
      drum,
      Y(p.base - 0.35),
      d,
      p.rank === 'central' ? 0.48 : 0.34,
    );
  }
  lathe(
    f,
    'roof',
    p.point,
    [
      [Y(p.base - 0.4), p.radius * 1.05],
      [Y(p.base), p.radius * 1.05],
    ],
    n,
  );
  const levels = [
    [p.base, p.radius * 0.94],
    [p.base + h * 0.13, p.radius * 1.02],
    [p.base + h * 0.4, p.radius * 0.94],
    [p.base + h * 0.66, p.radius * 0.7],
    [p.base + h * 0.85, p.radius * 0.36],
    [p.top, p.radius * 0.05],
  ];
  lathe(
    f,
    'roof',
    p.point,
    levels.map(([y, r]) => [Y(y), r]),
    n,
    { flutes: d >= 2 },
  );
  lathe(
    f,
    'metal',
    p.point,
    d === 1
      ? [
          [Y(p.top), 0.18],
          [Y(p.tip), 0.02],
        ]
      : [
          [Y(p.top), 0.18],
          [Y(p.top + 0.35), 0.42],
          [Y(p.top + 0.8), 0.23],
          [Y(p.tip - (p.rank === 'central' ? 1.8 : 0.4)), 0.08],
          [Y(p.tip), 0.02],
        ],
    d === 1 ? 4 : 8,
  );
  if (p.rank === 'central')
    f(
      'metal',
      [
        [p.point[0], Y(p.tip - 0.1), p.point[1]],
        [p.point[0] + 3, Y(p.tip - 0.7), p.point[1]],
        [p.point[0], Y(p.tip - 1.5), p.point[1]],
      ],
      [0, 0, 1],
    );
}
function porch(f, cx, cz, width, depth, angle, d, Y) {
  const co = Math.cos(angle),
    si = Math.sin(angle),
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([x, y, z]) => [cx + x * co - z * si, y, cz + x * si + z * co]),
        [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
      );
  box(at, 'plinth', 0, Y(3.8), 0, width + 0.6, 1.7, depth + 0.5);
  const bays = d === 1 ? 2 : d === 2 ? 3 : 4;
  for (const x of [-width / 2 + 1, width / 2 - 1])
    for (let i = 0; i <= bays; i++)
      column(at, x, -depth / 2 + 1 + ((depth - 2) * i) / bays, Y(5.5), Y(15.5), d);
  for (const z of [-depth / 2 + 1, depth / 2 - 1])
    for (const x of [-width * 0.15, width * 0.15]) column(at, x, z, Y(5.5), Y(15.5), d);
  box(at, 'stone', 0, Y(15.2), 0, width + 0.8, 0.8, depth + 0.8);
  squareRoof(at, 0, 0, Y(16), Math.min(width, depth) + 1, 5.5, d);
}
function elephant(f, x, z, angle, Y, d) {
  const co = Math.cos(angle),
    si = Math.sin(angle),
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([a, y, b]) => [x + a * co - b * si, y, z + a * si + b * co]),
        [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
      );
  box(at, 'plinth', 0, Y(0.92), 0, 1.55, 0.95, 0.78);
  if (d === 2) {
    for (const a of [-0.52, 0.52]) box(at, 'plinth', a, Y(0.25), 0, 0.24, 0.7, 0.65);
  } else
    for (const a of [-0.52, 0.52])
      for (const b of [-0.25, 0.25]) box(at, 'plinth', a, Y(0.25), b, 0.24, 0.7, 0.24);
  box(at, 'plinth', 0.84, Y(1.35), 0, 0.6, 0.65, 0.65);
  if (d === 2) {
    for (const b of [-0.42, 0.42])
      at(
        'plinth',
        [
          [0.43, Y(1.28), b],
          [0.91, Y(1.28), b],
          [0.91, Y(1.9), b],
          [0.43, Y(1.9), b],
        ],
        [0, 0, Math.sign(b)],
      );
    box(at, 'plinth', 1.15, Y(0.55), 0, 0.23, 0.95, 0.25);
  } else {
    for (const b of [-0.42, 0.42]) box(at, 'plinth', 0.67, Y(1.28), b, 0.47, 0.62, 0.11);
    box(at, 'plinth', 1.15, Y(0.85), 0, 0.23, 0.65, 0.25);
    box(at, 'plinth', 1.3, Y(0.55), 0, 0.45, 0.27, 0.22);
    box(at, 'plinth', -0.85, Y(0.8), 0, 0.1, 0.65, 0.12);
  }
}
function pavilion(f, p, d) {
  const Y = (y) => p.baseY + y,
    x = p.origin[0],
    z = p.origin[1],
    w = p.width * 0.92,
    depth = p.depth * 0.92;
  if (d === 0) {
    box(f, 'stone', x, Y(0.1), z, w, 12, depth);
    for (const a of [-0.27, 0, 0.27]) squareRoof(f, x + w * a, z + depth * 0.2, Y(12.1), 4, 6.4, 0);
    return;
  }
  box(f, 'plinth', x, Y(0.15), z, w + 1, 1.6, depth + 1);
  for (const side of [-1, 1])
    box(f, 'stone', x + side * (w / 4 + 2), Y(1.75), z, w / 2 - 4, 10.5, depth);
  box(f, 'stone', x, Y(10.5), z, 8, 2, depth);
  box(f, 'roof', x, Y(12.25), z, w + 1, 0.8, depth + 1);
  const n = d === 1 ? 1 : d === 2 ? 7 : 10;
  for (const s of [-1, 1])
    for (let i = 0; i <= n; i++) {
      const px = x - w / 2 + (w * i) / n,
        pz = z + s * (depth / 2 + 0.2);
      box(f, 'stone', px, Y(13.1), pz, 0.24, 0.9, 0.24);
    }
  for (const s of [-1, 1])
    box(f, 'stone', x, Y(13.8), z + s * (depth / 2 + 0.2), w + 0.3, 0.2, 0.28);
  for (const a of [-0.27, 0, 0.27]) {
    const px = x + w * a,
      pz = z + depth * 0.2;
    for (const bx of [-1, 1])
      for (const bz of [-1, 1]) column(f, px + bx * 1.3, pz + bz * 1.3, Y(13.1), Y(15.7), d, 0.23);
    lathe(
      f,
      'roof',
      [px, pz],
      [
        [Y(15.7), 2.2],
        [Y(16.5), 1.9],
        [Y(17.6), 0.15],
      ],
      d === 1 ? 6 : 12,
    );
    lathe(
      f,
      'metal',
      [px, pz],
      [
        [Y(17.6), 0.18],
        [Y(18.5), 0.03],
      ],
      4,
    );
  }
}
export function buildAkshardham(f, d, r) {
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
        'plinth',
        t.map((p) => [p[0], floor.height, p[1]]),
        [0, 1, 0],
      );
    for (const e of floor.edges) {
      f(
        'plinth',
        [
          [e.a[0], floor.height, e.a[1]],
          [e.b[0], floor.height, e.b[1]],
          [e.b[0], r.foundationBase, e.b[1]],
          [e.a[0], r.foundationBase, e.a[1]],
        ],
        [e.b[1] - e.a[1], 0, e.a[0] - e.b[0]],
      );
      f(
        'plinth',
        [
          [e.a[0], floor.height, e.a[1]],
          [e.b[0], floor.height, e.b[1]],
          [e.b[0], e.topB, e.b[1]],
          [e.a[0], e.topA, e.a[1]],
        ],
        [e.a[1] - e.b[1], 0, e.b[0] - e.a[0]],
      );
    }
  }
  for (const p of r.platformUpper) polygon(at, 'plinth', p.polygons, p.triangles, Y(0.05), Y(3.8));
  // The complete lower footprint survives even after the open upper porch bays drop away.
  const sourcePoly = r.mainLocal[0],
    sourceTriangles = r.mainTriangles;
  if (d > 0) polygon(at, 'stone', sourcePoly, sourceTriangles, Y(3.8), Y(5.5), 1.02);
  if (d === 0) polygon(at, 'stone', sourcePoly, sourceTriangles, Y(3.8), Y(16));
  else {
    for (const p of r.solids) polygon(at, 'stone', p.polygons, p.triangles, Y(5.5), Y(15.5));
    porch(at, 0, 30, 19.3, 12, 0, d, Y);
    porch(at, 0, -30.3, 19.3, 12.5, 0, d, Y);
    porch(at, 25, 4.7, 19.5, 13.2, Math.PI / 2, d, Y);
    porch(at, -25, 4.7, 19.5, 13.2, Math.PI / 2, d, Y);
  }
  for (const p of r.domes) dome(at, p, d, Y);
  for (const p of r.spires)
    if (d > 0 || p.large) squareRoof(at, ...p.point, Y(p.base), p.width, p.height, d);
  if (d >= 2) {
    for (const p of r.solids)
      for (const ring of p.polygons)
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i],
            b = ring[i + 1],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            length = Math.hypot(dx, dz);
          if (length < 2.6) continue;
          const nx = dz / length,
            nz = -dx / length,
            angle = Math.atan2(dz, dx),
            bays = Math.max(1, Math.floor(length / (d === 1 ? 6 : 3.5)));
          for (let j = 0; j < bays; j++) {
            const t = (j + 0.5) / bays,
              x = a[0] + dx * t,
              z = a[1] + dz * t;
            box(at, 'stone', x + nx * 0.22, Y(6), z + nz * 0.22, 0.55, 8, 0.4, angle);
            if (d >= 2) {
              box(
                at,
                'stone',
                x + nx * 0.38,
                Y(8),
                z + nz * 0.38,
                Math.min(1.5, (length / bays) * 0.55),
                3.6,
                0.25,
                angle,
              );
              if (d >= 3) {
                lathe(
                  at,
                  'stone',
                  [x + nx * 0.65, z + nz * 0.65],
                  [
                    [Y(8.1), 0.23],
                    [Y(9.2), 0.34],
                    [Y(10.1), 0.12],
                  ],
                  6,
                );
                lathe(
                  at,
                  'stone',
                  [x + nx * 0.65, z + nz * 0.65],
                  [
                    [Y(10.1), 0.18],
                    [Y(10.5), 0.18],
                  ],
                  6,
                );
              }
            }
          }
        }
  }
  if (d >= 2)
    for (let i = 0; i < r.elephants.length; i++)
      if (d >= 3 || i % 5 === 0) {
        const p = r.elephants[i];
        elephant(at, ...p.point, p.angle, Y, d);
      }
  const stair = r.mainStair,
    count = d === 0 ? 1 : d === 1 ? 4 : d === 2 ? 10 : stair.treads;
  for (let i = 0; i < count; i++) {
    const z0 = stair.start + ((stair.end - stair.start) * i) / count,
      z1 = stair.start + ((stair.end - stair.start) * (i + 1)) / count,
      y0 = Y(stair.top - ((stair.top - stair.bottom) * i) / count),
      y1 = Y(stair.top - ((stair.top - stair.bottom) * (i + 1)) / count),
      w = stair.width / 2;
    at(
      'plinth',
      [
        [-w, y0, z0],
        [w, y0, z0],
        [w, d === 0 ? y1 : y0, z1],
        [-w, d === 0 ? y1 : y0, z1],
      ],
      [0, 1, 0],
    );
    if (d > 0)
      at(
        'plinth',
        [
          [-w, y0, z1],
          [w, y0, z1],
          [w, y1, z1],
          [-w, y1, z1],
        ],
        [0, 0, 1],
      );
    for (const side of [-1, 1])
      at(
        'plinth',
        [
          [side * w, Y(0.05), z0],
          [side * w, Y(0.05), z1],
          [side * w, d === 0 ? y1 : y0, z1],
          [side * w, y0, z0],
        ],
        [side, 0, 0],
      );
  }
  // A narrow stone approach crosses the mapped moat without removing its water.
  box(at, 'plinth', 0, Y(0.2), 61.3, 10, 1.0, 12.5);
  if (d > 0)
    for (const side of [-1, 1]) {
      box(at, 'stone', side * 4.8, Y(1.2), 61.3, 0.28, 0.75, 12.5);
    }
  for (const p of r.gates) pavilion(at, p, d);
}

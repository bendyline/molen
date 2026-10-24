/** Specific Luxor exterior; parameters retain the independently mapped temple parts. */
export const luxorCandidateId = 'luxor_temple';

function box(f, role, x, y, z, w, h, d, tint) {
  const a = x - w / 2,
    b = x + w / 2,
    c = z - d / 2,
    e = z + d / 2,
    t = y + h;
  for (const [p, n] of [
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
    f(role, p, n, tint);
}
function polygon(f, role, data, y, height, tint) {
  for (const t of data.triangles) {
    f(
      role,
      t.map(([x, z]) => [x, y + height, z]),
      [0, 1, 0],
      tint,
    );
    f(
      role,
      t.map(([x, z]) => [x, y, z]),
      [0, -1, 0],
      tint,
    );
  }
  for (const [ri, closed] of data.polygon.entries()) {
    const ring = closed.slice(0, -1),
      area = ring.reduce(
        (n, p, i) =>
          n + p[0] * ring[(i + 1) % ring.length][1] - p[1] * ring[(i + 1) % ring.length][0],
        0,
      ),
      sign = (area > 0 ? 1 : -1) * (ri === 0 ? 1 : -1);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      f(
        role,
        [
          [a[0], y, a[1]],
          [b[0], y, b[1]],
          [b[0], y + height, b[1]],
          [a[0], y + height, a[1]],
        ],
        [(sign * (b[1] - a[1])) / l, 0, (-sign * (b[0] - a[0])) / l],
        tint,
      );
    }
  }
}
function lathe(f, role, x, z, y, profile, n, tint) {
  const p = (j, i) => [
    x + Math.cos((i * 2 * Math.PI) / n) * profile[j][1],
    y + profile[j][0],
    z + Math.sin((i * 2 * Math.PI) / n) * profile[j][1],
  ];
  for (let j = 1; j < profile.length; j++)
    for (let i = 0; i < n; i++) {
      const a = ((i + 0.5) * 2 * Math.PI) / n;
      f(
        role,
        [p(j - 1, i), p(j - 1, i + 1), p(j, i + 1), p(j, i)],
        [Math.cos(a), 0, Math.sin(a)],
        tint,
      );
    }
  for (const [j, normal] of [
    [0, [0, -1, 0]],
    [profile.length - 1, [0, 1, 0]],
  ])
    for (let i = 1; i < n - 1; i++) f(role, [p(j, 0), p(j, i), p(j, i + 1)], normal, tint);
}
function column(f, x, z, height, radius, d, floor, kind = 'bud') {
  const n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : d === 3 ? 16 : 24;
  const profile =
    d === 0
      ? [
          [0, radius],
          [height, radius * 0.83],
        ]
      : d === 1
        ? [
            [0, radius],
            [height * 0.82, radius * 0.76],
            [height, radius * 1.2],
          ]
        : kind === 'open'
          ? [
              [0, radius * 1.13],
              [0.35, radius * 1.13],
              [0.65, radius],
              [height * 0.83, radius * 0.76],
              [height * 0.91, radius * 1.15],
              [height - 0.25, radius * 1.8],
              [height, radius * 1.8],
            ]
          : [
              [0, radius * 1.1],
              [0.25, radius * 1.1],
              [0.5, radius],
              [height * 0.83, radius * 0.72],
              [height * 0.94, radius * 1.1],
              [height, radius * 0.88],
            ];
  lathe(f, 'stone', x, z, floor, profile, n);
  if (d >= 2) box(f, 'stone', x, floor + height, z, radius * 2.05, 0.35, radius * 2.05);
}
function pylon(f, z0, z1, center, depth, height, d, floor) {
  const aperture = d >= 2,
    az = z0 + (z1 - z0) * (z0 < -10 ? 0.7 : 0.3),
    ys = aperture
      ? [floor - 0.6, floor + height * 0.68, floor + height * 0.76, floor + height]
      : [floor - 0.6, floor + height],
    zs = aperture ? [z0, az - 1.3, az + 1.3, z1] : [z0, z1];
  const point = (z, y, side) => [center - 0.08 * z + side * (depth / 2 - (y - floor) * 0.05), y, z];
  for (const side of [-1, 1])
    for (let i = 1; i < zs.length; i++)
      for (let j = 1; j < ys.length; j++) {
        if (aperture && i === 2 && j === 2) continue;
        f(
          'wall',
          [
            point(zs[i - 1], ys[j - 1], side),
            point(zs[i], ys[j - 1], side),
            point(zs[i], ys[j], side),
            point(zs[i - 1], ys[j], side),
          ],
          [side, 0, 0],
        );
      }
  for (const [z, n] of [
    [z0, [0, 0, -1]],
    [z1, [0, 0, 1]],
  ])
    f(
      'wall',
      [point(z, ys[0], -1), point(z, ys[0], 1), point(z, ys.at(-1), 1), point(z, ys.at(-1), -1)],
      n,
    );
  for (const [y, n] of [
    [ys[0], [0, -1, 0]],
    [ys.at(-1), [0, 1, 0]],
  ])
    f('stone', [point(z0, y, -1), point(z1, y, -1), point(z1, y, 1), point(z0, y, 1)], n);
  if (aperture) {
    for (const [z, n] of [
      [zs[1], [0, 0, 1]],
      [zs[2], [0, 0, -1]],
    ])
      f(
        'stone',
        [point(z, ys[1], -1), point(z, ys[1], 1), point(z, ys[2], 1), point(z, ys[2], -1)],
        n,
      );
    for (const [y, n] of [
      [ys[1], [0, 1, 0]],
      [ys[2], [0, -1, 0]],
    ])
      f(
        'stone',
        [point(zs[1], y, -1), point(zs[2], y, -1), point(zs[2], y, 1), point(zs[1], y, 1)],
        n,
      );
  }
  if (d > 0)
    for (const sign of [-1, 1]) {
      const a = point(z0, floor + height - 0.35, sign),
        b = point(z1, floor + height - 0.35, sign),
        upper = [a[0] + sign * 0.45, a[1] + 0.65, a[2]],
        upperB = [b[0] + sign * 0.45, b[1] + 0.65, b[2]];
      f('stone', [a, b, upperB, upper], [sign, 0, 0]);
    }
}
function statue(f, x, z, d, floor) {
  const gray = [0.21, 0.18, 0.155];
  box(f, 'granite', x, floor - 0.2, z, 2.6, 0.5, 3.5, gray);
  if (d === 0) {
    box(f, 'granite', x, floor + 0.3, z, 1.5, 6.5, 1.8, gray);
    return;
  }
  box(f, 'granite', x + 0.55, floor + 0.3, z, 1.1, 4.4, 2.2, gray);
  box(f, 'granite', x - 0.3, floor + 0.3, z, 1.8, 2.35, 2.1, gray);
  box(f, 'granite', x - 0.7, floor + 2.55, z, 2.15, 0.65, 2.4, gray);
  box(f, 'granite', x + 0.1, floor + 3.1, z, 1.35, 2.65, 1.9, gray);
  lathe(
    f,
    'granite',
    x + 0.05,
    z,
    floor + 5.65,
    [
      [0, 0.7],
      [1.1, 0.75],
      [1.65, 0.52],
    ],
    d === 1 ? 4 : 8,
    gray,
  );
  if (d >= 2) {
    box(f, 'granite', x - 0.32, floor + 6.1, z, 1.3, 1.05, 2.25, gray);
    for (const s of [-1, 1])
      box(f, 'granite', x - 0.57, floor + 0.1, z + s * 0.7, 1.8, 0.35, 0.65, gray);
  }
}
function inside(p, ring) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i],
      b = ring[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      yes = !yes;
  }
  return yes;
}
function mosque(f, d, r) {
  const a = r.mosqueExterior;
  if (!a) return;
  const n = d === 0 ? 4 : d === 1 ? 6 : d === 2 ? 8 : 16;
  // The independent mapped L-shaped mosque sits above the ancient court.
  for (const p of a.ranges) {
    polygon(f, 'wall', p, r.floorY - 0.5, a.raisedFloor + 0.5);
    polygon(f, 'plaster', p, a.raisedFloor, a.wallHeight);
  }
  const roof = a.raisedFloor + a.wallHeight;
  const [dx, dz] = a.domeCenter;
  box(f, 'plaster', dx, roof, dz, 10.5, 2.1, 10.5);
  lathe(
    f,
    'plaster',
    dx,
    dz,
    roof + 2.1,
    [
      [0, 4.15],
      [1.5, 4.15],
      [3.5, 3.0],
      [5.1, 0.2],
    ],
    n,
  );
  if (d > 0)
    lathe(
      f,
      'granite',
      dx,
      dz,
      roof + 7.2,
      [
        [0, 0.15],
        [1.1, 0.1],
        [1.7, 0],
      ],
      6,
    );
  const [wx, wz] = a.whiteMinaret;
  lathe(
    f,
    'plaster',
    wx,
    wz,
    a.raisedFloor,
    d === 0
      ? [
          [0, 1.65],
          [15, 1.2],
          [24, 0],
        ]
      : [
          [0, 1.8],
          [9.5, 1.5],
          [12, 1.5],
          [13, 2.35],
          [13.7, 2.35],
          [13.8, 1.3],
          [18.5, 1.0],
          [20.0, 1.0],
        ],
    n,
  );
  if (d > 0) {
    // Sparse open lantern supports retain actual sky gaps instead of dark painted windows.
    for (let i = 0; i < 4; i++) {
      const t = (i * Math.PI) / 2;
      box(
        f,
        'plaster',
        wx + Math.cos(t) * 0.82,
        a.raisedFloor + 20,
        wz + Math.sin(t) * 0.82,
        0.42,
        2.5,
        0.42,
      );
    }
    lathe(
      f,
      'plaster',
      wx,
      wz,
      a.raisedFloor + 22.5,
      [
        [0, 1.2],
        [0.5, 1.2],
        [2.0, 0.15],
      ],
      n,
    );
    lathe(
      f,
      'granite',
      wx,
      wz,
      a.raisedFloor + 24.5,
      [
        [0, 0.12],
        [1.2, 0],
      ],
      6,
    );
  }
  const [ox, oz] = a.oldMinaret;
  box(f, 'wall', ox, a.raisedFloor, oz, 4.7, 7.5, 4.7);
  lathe(
    f,
    'stone',
    ox,
    oz,
    a.raisedFloor + 7.5,
    d === 0
      ? [
          [0, 1.8],
          [11, 1.2],
          [12, 0],
        ]
      : [
          [0, 1.85],
          [7.2, 1.5],
          [9.8, 1.2],
          [11, 0.8],
          [11.6, 0],
        ],
    n,
  );
  if (d >= 2) {
    // A few large pointed facade panels and a crenellated parapet establish rhythm.
    const brown = [0.24, 0.12, 0.055];
    for (const [x, z] of a.frontWindows) {
      f(
        'granite',
        [
          [x - 0.6, a.raisedFloor + 2.2, z],
          [x + 0.6, a.raisedFloor + 2.2, z],
          [x + 0.6, a.raisedFloor + 4.0, z],
          [x, a.raisedFloor + 4.7, z],
          [x - 0.6, a.raisedFloor + 4.0, z],
        ],
        [0, 0, 1],
        brown,
      );
    }
    for (let i = 0; i < 9; i++) {
      const x = -58 + i * 2.7;
      box(f, 'plaster', x, roof - 0.05, -8.0599155 + (x + 61.0544634) * 0.11121, 1.0, 0.7, 0.65);
    }
  }
}
export function buildLuxorTemple(f, d, r) {
  const y = r.floorY;
  for (const t of r.floorTriangles)
    f(
      'flat',
      t.map(([x, z]) => [x, y, z]),
      [0, 1, 0],
    );
  // The two independently mapped wings retain the offset entrance and unequal depths.
  pylon(f, -3.3, 24, -65.45, 10.5, 22.4, d, y);
  pylon(f, -38.8, -8.5, -68.3, 6.6, 22.0, d, y);
  const [ox, oz] = r.obelisk;
  box(f, 'granite', ox, y - 0.35, oz, 4.5, 1.6, 4.5);
  const point = (h, radius, i) => [
    ox + [-1, 1, 1, -1][i] * radius,
    y + 1.25 + h,
    oz + [-1, -1, 1, 1][i] * radius,
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(
      'granite',
      [point(0, 1.12, i), point(0, 1.12, j), point(22.3, 0.66, j), point(22.3, 0.66, i)],
      [Math.cos(((i - 0.5) * Math.PI) / 2), 0, Math.sin(((i - 0.5) * Math.PI) / 2)],
    );
    f(
      'granite',
      [point(22.3, 0.66, i), point(22.3, 0.66, j), [ox, y + 26.1, oz]],
      [Math.cos(((i - 0.5) * Math.PI) / 2), 0.3, Math.sin(((i - 0.5) * Math.PI) / 2)],
    );
  }
  for (const z of [-14.3, 2.4]) statue(f, -76, z, d, y);
  if (d >= 2) for (const z of [-29, 15]) statue(f, -76, z, d, y);
  // First court: the map's roof bands surround an open floor and the separate mosque.
  for (const range of r.ranges) {
    if (d === 0 && range.name === 'rear-sanctuaries' && r.originalRearMappedRanges) continue;
    if (range.type === 'portico') {
      if (d > 0) polygon(f, 'stone', range, y - 0.35, 0.45);
      polygon(f, 'stone', range, y + 6.65, 0.65);
    } else if (range.type === 'wall') polygon(f, 'wall', range, y - 0.35, 5.0);
    else polygon(f, 'wall', range, y - 0.35, d === 0 ? 6.2 : 5.6);
  }
  if (d === 0 && r.originalRearMappedRanges)
    for (const range of r.originalRearMappedRanges)
      for (const ring of range.polygon)
        for (let i = 1; i < ring.length; i++) {
          const a = ring[i - 1],
            b = ring[i];
          if (a[0] < 168 && b[0] < 168 && a[1] * b[1] < 0) continue;
          const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
          if (length < 0.01) continue;
          const points = [
            [a[0], y - 0.35, a[1]],
            [b[0], y - 0.35, b[1]],
            [b[0], y + 5.25, b[1]],
            [a[0], y + 5.25, a[1]],
          ];
          for (const sign of [-1, 1])
            f('wall', points, [
              (sign * (b[1] - a[1])) / length,
              0,
              (-sign * (b[0] - a[0])) / length,
            ]);
        }
  const blocked = (p) =>
    r.independentMosque.polygons.some(
      (poly) => inside(p, poly.outline) && !poly.holes.some((h) => inside(p, h)),
    );
  if (d > 0) {
    const n = d === 1 ? 4 : 8;
    for (const z of [-22, 20])
      for (let i = 0; i < n; i++) {
        const x = -56 + (i * 38) / (n - 1);
        if (!blocked([x, z])) column(f, x, z, 6.25, 0.78, d, y);
      }
    for (let i = 0; i < (d === 1 ? 3 : 7); i++) {
      const z = -13 + (i * 28) / (d === 1 ? 2 : 6);
      if (!blocked([-16, z])) column(f, -16, z, 6.25, 0.78, d, y);
    }
  }
  // Exactly seven pairs carry the pictured tall colonnade and its open upper beams.
  const tall = d === 0 ? 4 : 7;
  for (const z of [-3.15, 5.9]) {
    for (let i = 0; i < tall; i++)
      column(f, 3.1 + (i * 46.3) / (tall - 1), z, 14.8, 1.26, d, y, 'open');
    box(f, 'stone', 26.25, y + 15.15, z, 49.5, 1.25, 2.8);
  }
  if (d >= 2) for (const x of [3.1, 49.4]) box(f, 'stone', x, y + 15.15, 1.4, 2.8, 1.25, 11.8);
  // The second court keeps its open center and double peristyle rather than a solid roof.
  if (d > 0) {
    const along = d === 1 ? 5 : 10,
      across = d === 1 ? 3 : 6,
      rows = d === 1 ? 1 : 2;
    for (const sign of [-1, 1])
      for (let row = 0; row < rows; row++)
        for (let i = 0; i < along; i++)
          column(f, 62 + (i * 45) / (along - 1), sign * (14.5 + row * 5), 6.3, 0.82, d, y);
    for (const sign of [-1, 1])
      for (let row = 0; row < rows; row++)
        for (let i = 0; i < across; i++)
          column(
            f,
            sign < 0 ? 61.5 + row * 5 : 107.5 - row * 5,
            -11.5 + (i * 23) / (across - 1),
            6.3,
            0.82,
            d,
            y,
          );
  }
  // Rear shrine ranges follow the actual irregular mapped outline. Open axial gates remain.
  for (const x of [114, 126, 137, 164])
    for (const sign of [-1, 1]) box(f, 'wall', x, y, sign * 8.5, 1.3, 6.0, 14.3);
  for (const x of [114, 126, 137, 164]) box(f, 'stone', x, y + 4.75, 0, 1.5, 1.25, 4.8);
  if (d > 0) {
    for (const z of [-10, -3.5, 3.5, 10])
      for (const x of [115.5, 121]) column(f, x, z, 6.8, 0.68, d, y);
    box(f, 'stone', 151, y + 6.0, 0, 25, 1.0, 11);
  }
  if (d >= 2) {
    for (const x of [145, 157, 171])
      for (const sign of [-1, 1]) box(f, 'wall', x, y, sign * 11.5, 1.0, 3.3, 6.0);
    for (const z of [-15.5, 15.5]) box(f, 'stone', 145, y + 5.6, z, 18, 0.55, 5);
  }
  // The mapped L-shaped Serapis range stays low and open.
  for (const a of r.serapisRanges) polygon(f, 'wall', a, y - 0.25, d === 0 ? 2.3 : 3.1);
  if (d > 0)
    for (let i = 0; i < (d === 1 ? 3 : 7); i++)
      column(f, -136 + (i * 26) / (d === 1 ? 2 : 6), 6.8, 4.15, 0.55, d, y, 'open');
  // Small point-derived forms have explicitly approximate envelopes, never survey claims.
  const [tx, tz] = r.tetrastyl;
  for (const a of [-1, 1])
    for (const b of [-1, 1]) column(f, tx + a * 3.7, tz + b * 3.7, 4.8, 0.62, d, y, 'open');
  if (d > 0) for (const s of [-1, 1]) box(f, 'stone', tx, y + 5.15, tz + s * 3.7, 9, 0.65, 1.5);
  const [sx, sz] = r.tripartiteShrine;
  if (d === 0) box(f, 'stone', sx, y, sz, 6.5, 4.4, 10);
  else {
    for (const z of [-4, -1.4, 1.4, 4]) box(f, 'wall', sx + 1, y, sz + z, 7, 4.2, 0.7);
    box(f, 'wall', sx + 4.5, y, sz, 0.8, 4.2, 8.7);
    box(f, 'stone', sx + 1, y + 4.2, sz, 8, 0.65, 9);
  }
  mosque(f, d, r);
}

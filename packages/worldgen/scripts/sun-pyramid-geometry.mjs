/** N0493: mapped Teotihuacan terrace profiles and the west stair/platform. */
export const sunPyramidCandidateId = 'N0493';

function ring(b, y) {
  return [
    [b[0], y, b[1]],
    [b[2], y, b[1]],
    [b[2], y, b[3]],
    [b[0], y, b[3]],
  ];
}
function band(f, role, a, b) {
  const targets = [
    [0, 0.5, -1],
    [1, 0.5, 0],
    [0, 0.5, 1],
    [-1, 0.5, 0],
  ];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [a[i], a[j], b[j], b[i]], targets[i]);
  }
}
function block(f, role, bounds, bottom, top) {
  const a = ring(bounds, bottom),
    b = ring(bounds, top);
  band(f, role, a, b);
  f(role, b, [0, 1, 0]);
}
function wedge(f, role, x0, x1, z0, z1, y0, y1, thickness = 0.5) {
  const p = [
      [x0, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
      [x0, y0, z1],
    ],
    q = p.map((v) => [v[0], v[1] - thickness, v[2]]);
  f(role, p, [0, 1, 0]);
  f(role, [p[0], p[1], q[1], q[0]], [0, 0, -1]);
  f(role, [p[3], p[2], q[2], q[3]], [0, 0, 1]);
  f(role, [p[0], p[3], q[3], q[0]], [-1, 0, 0]);
  f(role, [p[1], p[2], q[2], q[1]], [1, 0, 0]);
}
function stair(f, d, a) {
  const { x0, x1, y0, y1, width } = a,
    z0 = -width / 2,
    z1 = width / 2;
  if (d === 0) wedge(f, 'steps', x0, x1, z0, z1, y0, y1);
  else {
    const count = Math.max(2, Math.ceil((y1 - y0) / [0, 1.5, 0.65, 0.36, 0.29][d])),
      dx = (x1 - x0) / count,
      dy = (y1 - y0) / count;
    for (let i = 0; i < count; i++) {
      const x = x0 + dx * i,
        y = y0 + dy * i;
      f(
        'steps',
        [
          [x, y + dy, z0],
          [x + dx, y + dy, z0],
          [x + dx, y + dy, z1],
          [x, y + dy, z1],
        ],
        [0, 1, 0],
      );
      f(
        'steps',
        [
          [x, y, z0],
          [x, y + dy, z0],
          [x, y + dy, z1],
          [x, y, z1],
        ],
        [-1, 0, 0],
      );
      for (const [z, nz] of [
        [z0, -1],
        [z1, 1],
      ])
        f(
          'steps',
          [
            [x, y - 0.25, z],
            [x, y + dy, z],
            [x + dx, y + dy, z],
            [x + dx, y - 0.25, z],
          ],
          [0, 0, nz],
        );
    }
  }
  if (d > 0)
    for (const side of [-1, 1]) {
      const z = side * (width / 2 + 0.6);
      wedge(f, 'coping', x0, x1, z - 0.6, z + 0.6, y0 + 0.5, y1 + 0.5, 0.7);
    }
}

/** Every level retains the whole bounded replacement floor and terrain-edge joins. */
export function buildSunPyramid(f, detail, r) {
  for (const triangle of r.floorTriangles)
    f(
      'ground',
      triangle.map((p) => [p[0], r.floorY, p[1]]),
      [0, 1, 0],
    );
  for (const triangle of r.floorTriangles)
    f(
      'ground',
      triangle.map((p) => [p[0], 0, p[1]]),
      [0, 1, 0],
    );
  for (const edge of r.groundEdges) {
    const { a, b, heightA, heightB } = edge,
      dx = b[0] - a[0],
      dz = b[1] - a[1];
    f(
      'ground',
      [
        [a[0], r.floorY, a[1]],
        [b[0], r.floorY, b[1]],
        [b[0], heightB, b[1]],
        [a[0], heightA, a[1]],
      ],
      [dz, 0, -dx],
    );
  }
  // Each broad slope and horizontal terrace is individually retained from the mapped profile.
  for (const [i, p] of r.profile.entries()) {
    const a = ring(p.bounds, p.height),
      next = r.profile[i + 1];
    if (next)
      band(f, next.height === p.height ? 'coping' : 'masonry', a, ring(next.bounds, next.height));
    else f('coping', a, [0, 1, 0]);
  }
  // Low fore-platform cheeks follow independently mapped U-shaped 4m and 8m parts.
  for (const p of r.platforms) {
    for (const triangle of p.triangles)
      f(
        'masonry',
        triangle.map((v) => [v[0], p.height, v[1]]),
        [0, 1, 0],
      );
    for (const poly of p.polygons)
      for (const boundary of [poly.outline, ...poly.holes])
        for (let i = 0; i < boundary.length; i++) {
          const a = boundary[i],
            b = boundary[(i + 1) % boundary.length],
            dx = b[0] - a[0],
            dz = b[1] - a[1];
          f(
            'masonry',
            [
              [a[0], 0, a[1]],
              [b[0], 0, b[1]],
              [b[0], p.height, b[1]],
              [a[0], p.height, a[1]],
            ],
            [dz, 0, -dx],
          );
        }
  }
  // Broad outer platform steps and the uninterrupted principal west stair.
  stair(f, detail, { x0: -118.1, x1: -111.05, y0: 0, y1: 8, width: 36.7 });
  stair(f, detail, { x0: -111.05, x1: -84, y0: 8, y1: 16.45, width: 25.9 });
  for (const flight of r.stairs) stair(f, detail, flight);
  for (const landing of r.landings)
    block(f, 'steps', landing.bounds, landing.height - 0.4, landing.height);
}

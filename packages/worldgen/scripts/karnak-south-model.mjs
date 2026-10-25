/** Sacred lake and independently mapped southern processional pylons. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
export const karnakSouthCandidateId = 'karnak_temple_complex';

function surface(f, role, polygons, y, up = true) {
  for (const poly of polygons) {
    const points = poly.flat(),
      holes = [];
    let offset = poly[0].length;
    for (const ring of poly.slice(1)) {
      holes.push(offset);
      offset += ring.length;
    }
    const indices = earcut(points.flat(), holes, 2);
    for (let i = 0; i < indices.length; i += 3)
      f(
        role,
        indices.slice(i, i + 3).map((k) => [points[k][0], y, points[k][1]]),
        [0, up ? 1 : -1, 0],
      );
  }
}

function withoutStairs(a, b, stairs) {
  let ranges = [[0, 1]];
  for (const stair of stairs) {
    const n = stair.inward,
      u = [n[1], -n[0]],
      q = [a[0] - stair.center[0], a[1] - stair.center[1]],
      delta = [b[0] - a[0], b[1] - a[1]];
    let lo = 0,
      hi = 1,
      outside = false;
    for (const [axis, min, max] of [
      [u, -stair.width / 2, stair.width / 2],
      [n, stair.start, stair.end],
    ]) {
      const p = q[0] * axis[0] + q[1] * axis[1],
        d = delta[0] * axis[0] + delta[1] * axis[1];
      if (Math.abs(d) < 1e-9) {
        if (p < min || p > max) outside = true;
        continue;
      }
      const t0 = (min - p) / d,
        t1 = (max - p) / d;
      lo = Math.max(lo, Math.min(t0, t1));
      hi = Math.min(hi, Math.max(t0, t1));
    }
    if (outside || hi <= lo) continue;
    ranges = ranges.flatMap(([x, z]) =>
      hi <= x || lo >= z
        ? [[x, z]]
        : [
            [x, Math.max(x, lo)],
            [Math.min(z, hi), z],
          ].filter((r) => r[1] - r[0] > 1e-7),
    );
  }
  return ranges.map(([u, v]) =>
    [u, v].map((t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]),
  );
}

function lake(f, detail, data, floor) {
  const water = detail === 0 ? data.corners : data.outline,
    caps = detail === 0 ? [[data.outer, data.corners]] : data.bankPolygons;
  surface(f, 'water', [[water]], floor + data.waterY);
  if (detail > 0) surface(f, 'flat', [[data.outer]], floor + data.baseY);
  surface(f, 'stone', caps, floor);
  surface(f, 'stone', [[data.outer, water]], floor + data.baseY, false);
  for (const [ring, inward] of [
    [data.outer, false],
    [water, true],
  ])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length],
        l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const normal = [
        ((b[1] - a[1]) / l) * (inward ? -1 : 1),
        0,
        (-(b[0] - a[0]) / l) * (inward ? -1 : 1),
      ];
      for (const [p, q] of inward && detail > 0 ? withoutStairs(a, b, data.stairs) : [[a, b]])
        f(
          'wall',
          [
            [p[0], floor + data.baseY, p[1]],
            [q[0], floor + data.baseY, q[1]],
            [q[0], floor, q[1]],
            [p[0], floor, p[1]],
          ],
          normal,
        );
    }
  if (detail === 0) return;
  for (const stair of data.stairs) {
    const n = stair.inward,
      u = [n[1], -n[0]],
      point = (x, y, z) => [
        stair.center[0] + u[0] * x + n[0] * z,
        floor + y,
        stair.center[1] + u[1] * x + n[1] * z,
      ];
    const count = detail === 1 ? 1 : 6,
      y1 = data.waterY + 0.1,
      levels = Array.from({ length: count + 1 }, (_, i) => ({
        t: stair.start + ((stair.end - stair.start) * i) / count,
        h: (y1 * i) / count,
      }));
    if (detail === 1)
      f(
        'stone',
        [
          point(-stair.width / 2, 0, stair.start),
          point(stair.width / 2, 0, stair.start),
          point(stair.width / 2, y1, stair.end),
          point(-stair.width / 2, y1, stair.end),
        ],
        [0, 1, 0],
      );
    else
      for (let i = 1; i < levels.length; i++) {
        const a = levels[i - 1],
          b = levels[i];
        f(
          'stone',
          [
            point(-stair.width / 2, a.h, a.t),
            point(stair.width / 2, a.h, a.t),
            point(stair.width / 2, a.h, b.t),
            point(-stair.width / 2, a.h, b.t),
          ],
          [0, 1, 0],
        );
        f(
          'stone',
          [
            point(-stair.width / 2, a.h, b.t),
            point(stair.width / 2, a.h, b.t),
            point(stair.width / 2, b.h, b.t),
            point(-stair.width / 2, b.h, b.t),
          ],
          [n[0], 0, n[1]],
        );
      }
    for (const sign of [-1, 1])
      for (let i = 1; i < levels.length; i++) {
        const a = levels[i - 1],
          b = levels[i],
          x = (sign * stair.width) / 2;
        f(
          'wall',
          [
            point(x, data.baseY, a.t),
            point(x, data.baseY, b.t),
            point(x, detail === 1 ? b.h : a.h, b.t),
            point(x, a.h, a.t),
          ],
          [u[0] * sign, 0, u[1] * sign],
        );
      }
    f(
      'wall',
      [
        point(-stair.width / 2, data.baseY, stair.end),
        point(stair.width / 2, data.baseY, stair.end),
        point(stair.width / 2, y1, stair.end),
        point(-stair.width / 2, y1, stair.end),
      ],
      [n[0], 0, n[1]],
    );
  }
}

function courtWall(f, a, b, height, width, detail, floor) {
  const d = [b[0] - a[0], b[1] - a[1]],
    length = Math.hypot(...d),
    n = [-d[1] / length, d[0] / length],
    count = detail === 0 ? 1 : detail === 1 ? 2 : detail === 2 ? 3 : 5;
  const v = (p, h, sign) => [
    p[0] + (n[0] * width * sign) / 2,
    floor + h,
    p[1] + (n[1] * width * sign) / 2,
  ];
  for (let i = 0; i < count; i++) {
    const p = [a[0] + (d[0] * i) / count, a[1] + (d[1] * i) / count],
      q = [a[0] + (d[0] * (i + 1)) / count, a[1] + (d[1] * (i + 1)) / count],
      h0 = height * (detail < 2 ? 1 : 0.65 + (i % 4) * 0.11),
      h1 = height * (detail < 2 ? 1 : 0.65 + ((i + 1) % 4) * 0.11);
    for (const sign of [-1, 1])
      f(
        'wall',
        [v(p, -0.6, sign), v(q, -0.6, sign), v(q, h1, sign), v(p, h0, sign)],
        [n[0] * sign, 0, n[1] * sign],
      );
    if (detail > 0) f('stone', [v(p, h0, -1), v(q, h1, -1), v(q, h1, 1), v(p, h0, 1)], [0, 1, 0]);
    f('wall', [v(p, -0.6, -1), v(q, -0.6, -1), v(q, -0.6, 1), v(p, -0.6, 1)], [0, -1, 0]);
    if (detail > 0 && i === 0)
      f(
        'wall',
        [v(p, -0.6, -1), v(p, -0.6, 1), v(p, h0, 1), v(p, h0, -1)],
        [-d[0] / length, 0, -d[1] / length],
      );
    if (detail > 0 && i === count - 1)
      f(
        'wall',
        [v(q, -0.6, -1), v(q, -0.6, 1), v(q, h1, 1), v(q, h1, -1)],
        [d[0] / length, 0, d[1] / length],
      );
  }
}

function wing(f, pylon, data, detail) {
  const p = data.outline,
    width =
      (Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) +
        Math.hypot(p[2][0] - p[3][0], p[2][1] - p[3][1])) /
      2;
  const axis = [p[1][0] - p[0][0], p[1][1] - p[0][1]],
    length = Math.hypot(...axis);
  axis[0] /= length;
  axis[1] /= length;
  const normal = [-axis[1], axis[0]],
    center = [0, 1].map((k) => p.reduce((s, v) => s + v[k], 0) / 4),
    depth =
      (Math.hypot(p[3][0] - p[0][0], p[3][1] - p[0][1]) +
        Math.hypot(p[2][0] - p[1][0], p[2][1] - p[1][1])) /
      2;
  const rotated = (role, points, n, tint) =>
    f(
      role,
      points.map(([x, y, z]) => [
        center[0] - normal[0] * x + axis[0] * z,
        y,
        center[1] - normal[1] * x + axis[1] * z,
      ]),
      [-normal[0] * n[0] + axis[0] * n[2], n[1], -normal[1] * n[0] + axis[1] * n[2]],
      tint,
    );
  pylon(rotated, 0, -width / 2, width / 2, depth, data.heights, detail);
}

function scarab(f, box, center, detail, floor) {
  if (detail === 0) return;
  box(f, 'granite', center[0], floor - 0.4, center[1], 2.4, 1.75, 2.25);
  if (detail < 2) return;
  const n = detail === 2 ? 6 : 12,
    rings = 4,
    point = (a, t) => [
      center[0] + Math.cos(a) * Math.cos(t) * 0.87,
      floor + 1.35 + Math.sin(t) * 0.67,
      center[1] + Math.sin(a) * Math.cos(t) * 1.12,
    ];
  for (let j = 0; j < rings; j++)
    for (let i = 0; i < n; i++) {
      const a = (i * Math.PI * 2) / n,
        b = ((i + 1) * Math.PI * 2) / n,
        t0 = (j * Math.PI) / (rings * 2),
        t1 = ((j + 1) * Math.PI) / (rings * 2);
      f(
        'granite',
        [point(a, t0), point(b, t0), point(b, t1), point(a, t1)],
        [Math.cos((a + b) / 2), 0.5, Math.sin((a + b) / 2)],
      );
    }
  box(f, 'granite', center[0], floor + 1.4, center[1] - 1, 1.05, 0.38, 0.6);
}

export function buildKarnakSouth(f, detail, primitives, rec) {
  const { box, pylon } = primitives,
    data = rec.south,
    floor = rec.floorY;
  if (!data) throw new Error('Karnak southern source parameters missing');
  lake(f.withGrade('lake-amun'), detail, data.lake, floor);
  f = f.withGrade('south');
  surface(f, 'flat', data.courtPolygons, floor);
  for (const gate of data.pylons) for (const w of gate.wings) wing(f, pylon, w, detail);
  box(f, 'stone', 58, floor + 10.7, 333.8, 7, 1.7, 7.3);
  for (const wall of data.walls)
    courtWall(f, wall.a, wall.b, wall.height, wall.width, detail, floor);
  if (detail > 0)
    for (const [i, p] of data.statues.entries()) {
      if (detail === 1 && i % 2) continue;
      box(f, 'granite', p[0], floor, p[1], 2.05, 0.55, 2);
      if (detail >= 2) {
        box(f, 'stone', p[0], floor + 0.55, p[1], 1.4, 3.8, 1.2);
        box(f, 'stone', p[0], floor + 4.35, p[1], 1.05, 1.05, 1.05);
      }
    }
  scarab(f, box, data.scarab, detail, floor);
  // The irregular Amenhotep II container is an open shell, not an invented solid roof.
  surface(f, 'stone', [[data.amenhotep]], floor);
  const shell =
    detail === 0
      ? [
          [85.4, 301.06],
          [109, 301.06],
          [109, 260.25],
          [85.4, 260.25],
        ]
      : data.amenhotep;
  for (let i = 0; i < shell.length; i++) {
    if (i === 0) {
      const a = shell[0],
        b = shell[1],
        p = [a[0] + (b[0] - a[0]) * 0.4, a[1] + (b[1] - a[1]) * 0.4],
        q = [a[0] + (b[0] - a[0]) * 0.6, a[1] + (b[1] - a[1]) * 0.6];
      courtWall(f, a, p, 4.7, 1.35, detail, floor);
      courtWall(f, q, b, 4.7, 1.35, detail, floor);
      courtWall(f, p, q, 1.3, 1.35, detail, floor + 3.2);
      continue;
    }
    courtWall(f, shell[i], shell[(i + 1) % shell.length], 3.8 + (i % 3), 1.35, detail, floor);
  }
  if (detail >= 2)
    for (const x of [90, 98])
      for (const z of [268, 280, 291])
        box(f, 'stone', x, floor, z, 1.45, z === 268 ? 5.6 : 2.7, 1.45);
}

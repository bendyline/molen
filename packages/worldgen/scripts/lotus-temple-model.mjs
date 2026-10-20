/** N0492: the three specific ninefold shell families of Delhi's Lotus Temple. */
export const lotusCandidateId = 'N0492';

const polar = (radius, theta, y) => [Math.cos(theta) * radius, y, Math.sin(theta) * radius];
function box(f, role, center, width, height, depth, angle = 0) {
  const [x, y, z] = center,
    c = Math.cos(angle),
    s = Math.sin(angle);
  const p = (u, h, v) => [x + u * c - v * s, y + h, z + u * s + v * c];
  for (const [points, n] of [
    [
      [
        p(-width / 2, 0, -depth / 2),
        p(-width / 2, height, -depth / 2),
        p(-width / 2, height, depth / 2),
        p(-width / 2, 0, depth / 2),
      ],
      [-c, 0, -s],
    ],
    [
      [
        p(width / 2, 0, -depth / 2),
        p(width / 2, height, -depth / 2),
        p(width / 2, height, depth / 2),
        p(width / 2, 0, depth / 2),
      ],
      [c, 0, s],
    ],
    [
      [
        p(-width / 2, 0, -depth / 2),
        p(width / 2, 0, -depth / 2),
        p(width / 2, height, -depth / 2),
        p(-width / 2, height, -depth / 2),
      ],
      [s, 0, -c],
    ],
    [
      [
        p(-width / 2, 0, depth / 2),
        p(width / 2, 0, depth / 2),
        p(width / 2, height, depth / 2),
        p(-width / 2, height, depth / 2),
      ],
      [-s, 0, c],
    ],
    [
      [
        p(-width / 2, height, -depth / 2),
        p(width / 2, height, -depth / 2),
        p(width / 2, height, depth / 2),
        p(-width / 2, height, depth / 2),
      ],
      [0, 1, 0],
    ],
    [
      [
        p(-width / 2, 0, -depth / 2),
        p(width / 2, 0, -depth / 2),
        p(width / 2, 0, depth / 2),
        p(-width / 2, 0, depth / 2),
      ],
      [0, -1, 0],
    ],
  ])
    f(role, points, n);
}
function band(f, role, radius, bottom, top, n, phase) {
  for (let i = 0; i < n; i++) {
    const a = phase + (i * Math.PI * 2) / n,
      b = phase + ((i + 1) * Math.PI * 2) / n,
      mid = (a + b) / 2;
    f(
      role,
      [
        polar(radius, a, bottom),
        polar(radius, b, bottom),
        polar(radius, b, top),
        polar(radius, a, top),
      ],
      [Math.cos(mid), 0, Math.sin(mid)],
    );
  }
}
function disk(f, role, radius, y, n, phase) {
  for (let i = 0; i < n; i++)
    f(
      role,
      [
        [0, y, 0],
        polar(radius, phase + (i * Math.PI * 2) / n, y),
        polar(radius, phase + ((i + 1) * Math.PI * 2) / n, y),
      ],
      [0, 1, 0],
    );
}
function shell(f, family, theta, d, floor, kind) {
  const [along, across] = [
      [3, 2],
      [4, 4],
      [8, 6],
      [12, 10],
      [18, 16],
    ][d],
    thickness = 0.24;
  const at = (t, v, lower = false) => {
    const bezier = (p) =>
      p[0] * Math.pow(1 - t, 3) +
      3 * p[1] * Math.pow(1 - t, 2) * t +
      3 * p[2] * (1 - t) * t * t +
      p[3] * Math.pow(t, 3);
    const r =
      (family.radialProfile
        ? bezier(family.radialProfile)
        : family.frontRadius + (family.tipRadius - family.frontRadius) * t) -
      family.sweep * v * v * (1 - t);
    const half = family.halfAngle * (kind === 'inner' ? 1 : Math.pow(1 - t, 0.3));
    const high = family.heightProfile
      ? bezier(family.heightProfile)
      : family.archHeight + (family.height - family.archHeight) * Math.sin((t * Math.PI) / 2);
    const low = family.edgeHeightProfile
      ? bezier(family.edgeHeightProfile)
      : floor + (family.height - floor) * Math.pow(t, 0.9);
    return polar(
      r,
      theta + half * v,
      low + (high - low) * (1 - Math.abs(v)) - (lower ? thickness : 0),
    );
  };
  for (let i = 0; i < along; i++)
    for (let j = 0; j < across; j++) {
      const t0 = i / along,
        t1 = (i + 1) / along,
        v0 = -1 + (j * 2) / across,
        v1 = -1 + ((j + 1) * 2) / across;
      for (const lower of d === 0 ? [false] : [false, true]) {
        const [a, b, c, e] = [
            at(t0, v0, lower),
            at(t1, v0, lower),
            at(t1, v1, lower),
            at(t0, v1, lower),
          ],
          n = [0, lower ? -1 : 1, 0];
        f('white', [a, b, e], n);
        f('white', [b, c, e], n);
      }
    }
  if (d > 0) {
    for (let i = 0; i < along; i++)
      for (const v of [-1, 1]) {
        const a = at(i / along, v),
          b = at((i + 1) / along, v),
          c = at((i + 1) / along, v, true),
          e = at(i / along, v, true),
          edge = theta + family.halfAngle * v;
        f('white', [a, b, c, e], [-v * Math.sin(edge), 0, v * Math.cos(edge)]);
      }
    for (let j = 0; j < across; j++)
      for (const t of [0, 1]) {
        const v0 = -1 + (j * 2) / across,
          v1 = -1 + ((j + 1) * 2) / across,
          sign = (family.frontRadius > family.tipRadius ? 1 : -1) * (t === 0 ? 1 : -1);
        f(
          'white',
          [at(t, v0), at(t, v1), at(t, v1, true), at(t, v0, true)],
          [sign * Math.cos(theta), 0, sign * Math.sin(theta)],
        );
      }
  }
}
function pool(f, p, d) {
  const rimTop = Math.max(p.waterY + 0.22, ...p.edgeGround.map((h) => h + 0.03));
  for (const tri of p.triangles) {
    f(
      'water',
      tri.map(([x, z]) => [x, p.waterY, z]),
      [0, 1, 0],
    );
    if (d > 0)
      f(
        'stone',
        tri.map(([x, z]) => [x, p.waterY - 0.35, z]),
        [0, 1, 0],
      );
  }
  for (const ring of p.polygon)
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1],
        b = ring[i],
        len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.001) continue;
      const dx = (b[0] - a[0]) / len,
        dz = (b[1] - a[1]) / len,
        sign =
          ring.reduce((n, q, j) => {
            const r = ring[(j + 1) % ring.length];
            return n + q[0] * r[1] - q[1] * r[0];
          }, 0) > 0
            ? 1
            : -1;
      const normal = [sign * dz, 0, -sign * dx],
        outside = [normal[0] * 0.6, normal[2] * 0.6],
        bottom = Math.min(p.waterY - 0.7, ...p.edgeGround) - 0.1;
      const point = (p, y, outer = false) => [
        p[0] + (outer ? outside[0] : 0),
        y,
        p[1] + (outer ? outside[1] : 0),
      ];
      if (d === 0) {
        const points = [point(a, bottom), point(b, bottom), point(b, rimTop), point(a, rimTop)];
        f('stone', points, normal);
        f(
          'stone',
          points,
          normal.map((n) => -n),
        );
        continue;
      }
      f(
        'stone',
        [point(a, rimTop), point(b, rimTop), point(b, rimTop, true), point(a, rimTop, true)],
        [0, 1, 0],
      );
      f(
        'stone',
        [
          point(a, bottom, true),
          point(b, bottom, true),
          point(b, rimTop, true),
          point(a, rimTop, true),
        ],
        normal,
      );
      if (d > 0)
        f(
          'stone',
          [point(a, bottom), point(b, bottom), point(b, rimTop), point(a, rimTop)],
          normal.map((n) => -n),
        );
    }
}
function approach(f, a, r, d) {
  const u = [Math.cos(a.angle), Math.sin(a.angle)],
    v = [-u[1], u[0]],
    point = (radius, y, width) => [u[0] * radius + v[0] * width, y, u[1] * radius + v[1] * width];
  box(
    d === 0
      ? (role, points, normal) => {
          if (Math.abs(normal[0] * u[0] + normal[2] * u[1]) > 0.5) return;
          f(normal[1] > 0.5 ? 'white' : role, points, normal);
        }
      : f,
    'red',
    polar(37.5, a.angle, a.bottom),
    5,
    r.platformTop - (d === 0 ? 0 : 0.22) - a.bottom,
    a.width,
    a.angle,
  );
  if (d > 0) box(f, 'white', polar(37.5, a.angle, r.platformTop - 0.22), 5, 0.22, a.width, a.angle);
  const count = d === 0 || d === 1 ? 1 : d === 2 ? (a.primary ? 12 : 6) : a.primary ? 24 : 12;
  for (let i = 0; i < count; i++) {
    const lo = 40 + (i * 22) / count,
      hi = 40 + ((i + 1) * 22) / count,
      h = r.platformTop + (a.endY - r.platformTop) * (count === 1 ? 0 : i / count),
      next = count === 1 ? a.endY : h;
    f(
      'stone',
      [
        point(lo, h, -a.width / 2),
        point(lo, h, a.width / 2),
        point(hi, next, a.width / 2),
        point(hi, next, -a.width / 2),
      ],
      [0, 1, 0],
    );
    if (count > 1) {
      const below = r.platformTop + ((a.endY - r.platformTop) * (i + 1)) / count;
      f(
        'stone',
        [
          point(hi, h, -a.width / 2),
          point(hi, h, a.width / 2),
          point(hi, below, a.width / 2),
          point(hi, below, -a.width / 2),
        ],
        [u[0], 0, u[1]],
      );
    }
    for (const sign of [-1, 1])
      f(
        'red',
        [
          point(lo, a.bottom, (sign * a.width) / 2),
          point(hi, a.bottom, (sign * a.width) / 2),
          point(hi, next, (sign * a.width) / 2),
          point(lo, h, (sign * a.width) / 2),
        ],
        [v[0] * sign, 0, v[1] * sign],
      );
  }
}
export function buildLotusTemple(f, d, r) {
  const n = [9, 18, 36, 36, 54][d],
    phase = r.petalPhase;
  band(f, 'red', r.platformRadius, r.foundationBottom, r.platformTop, n, phase);
  if (d > 0) {
    band(f, 'white', r.platformRadius + 0.08, 3.4, 3.8, n, phase);
    band(f, 'glass', r.platformRadius + 0.1, 2.75, 3.4, n, phase);
  }
  if (d >= 2) {
    band(f, 'white', r.platformRadius + 0.08, 1.2, 1.6, n, phase);
    band(f, 'glass', r.platformRadius + 0.1, 0.55, 1.2, n, phase);
  }
  disk(f, 'white', r.platformRadius + 0.08, r.platformTop, n, phase);
  if (d > 0) {
    band(f, 'glass', 15.9, r.platformTop, 10.2, n, phase);
    disk(f, 'glass', 1.1, 34.45, 9, phase);
  }
  for (let i = 0; i < 9; i++) {
    const theta = phase + Math.PI / 9 + (i * Math.PI * 2) / 9;
    shell(f, r.shellFamilies.inner, theta, d, r.platformTop, 'inner');
    shell(f, r.shellFamilies.middle, theta, d, r.platformTop, 'middle');
    shell(f, r.shellFamilies.outer, theta, d, r.platformTop, 'outer');
  }
  for (const p of r.pools) pool(f, p, d);
  for (const a of r.approaches) approach(f, a, r, d);
}

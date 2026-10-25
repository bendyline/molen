/** The exposed Venus cella and surviving precinct, without an intact antique reconstruction. */
import earcut from 'earcut';

function box(f, role, x, y, z, w, h, d) {
  const a = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([u, v]) => [x + (u * w) / 2, y, z + (v * d) / 2]),
    b = a.map(([x, y, z]) => [x, y + h, z]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  f(role, a, [0, -1, 0]);
  f(role, b, [0, 1, 0]);
}
function rotate(f, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return (role, ps, n) =>
    f(
      role,
      ps.map(([x, y, z]) => [c * x - s * z, y, s * x + c * z]),
      [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
    );
}
function platform(f, p, base, top) {
  const rings = [p.outline, ...p.holes],
    flat = rings.flat(),
    holes = [];
  let off = p.outline.length;
  for (const h of p.holes) {
    holes.push(off);
    off += h.length;
  }
  const ix = earcut(flat.flat(), holes),
    at = (p, y) => [p[0], y, p[1]];
  for (let i = 0; i < ix.length; i += 3) {
    const t = ix.slice(i, i + 3).map((j) => flat[j]);
    f(
      'grass',
      t.map((p) => at(p, top)),
      [0, 1, 0],
    );
    f(
      'stone',
      t.map((p) => at(p, base)),
      [0, -1, 0],
    );
  }
  for (const [k, r] of rings.entries()) {
    const area = r.reduce((s, a, i) => {
        const b = r[(i + 1) % r.length];
        return s + a[0] * b[1] - b[0] * a[1];
      }, 0),
      sign = Math.sign(area) * (k ? -1 : 1);
    for (let i = 0; i < r.length; i++) {
      const a = r[i],
        b = r[(i + 1) % r.length];
      f(
        'brick',
        [at(a, base), at(b, base), at(b, top), at(a, top)],
        [sign * (b[1] - a[1]), 0, sign * (a[0] - b[0])],
      );
    }
  }
}
function cylinder(f, x, y, z, r, h, detail) {
  const n = [4, 8, 16, 24][detail],
    profile = detail
      ? [
          [0, r * 1.22],
          [0.25, r * 1.22],
          [0.42, r],
          [h * 0.83, r * 0.88],
          [h - 0.5, r * 1.16],
          [h - 0.14, r * 1.18],
          [h, r * 1.36],
        ]
      : [
          [0, r],
          [h, r * 0.9],
        ];
  const rings = profile.map(([v, rr]) =>
    Array.from({ length: n }, (_, i) => [
      x + rr * Math.cos((i * 2 * Math.PI) / n),
      y + v,
      z + rr * Math.sin((i * 2 * Math.PI) / n),
    ]),
  );
  for (let j = 0; j < rings.length - 1; j++)
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n;
      f(
        'column',
        [rings[j][i], rings[j][k], rings[j + 1][k], rings[j + 1][i]],
        [Math.cos(((i + 0.5) * 2 * Math.PI) / n), 0, Math.sin(((i + 0.5) * 2 * Math.PI) / n)],
      );
    }
  f('column', rings[0], [0, -1, 0]);
  f('column', rings.at(-1), [0, 1, 0]);
  if (detail >= 2) box(f, 'stone', x, y - 0.12, z, r * 2.6, 0.25, r * 2.6);
  if (detail >= 3)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      box(
        f,
        'column',
        x + Math.cos(a) * r * 0.85,
        y + h - 0.75,
        z + Math.sin(a) * r * 0.85,
        0.32,
        0.53,
        0.32,
      );
    }
}
function brokenWall(f, a, b, width, y, hA, hB, detail, seed) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    length = Math.hypot(dx, dz),
    nx = ((-dz / length) * width) / 2,
    nz = ((dx / length) * width) / 2,
    n = detail ? Math.ceil(length / [20, 8, 3.5, 2][detail]) : 1;
  for (let i = 0; i < n; i++) {
    const u = i / n,
      v = (i + 1) / n,
      base = [
        [a[0] + dx * u + nx, y, a[1] + dz * u + nz],
        [a[0] + dx * v + nx, y, a[1] + dz * v + nz],
        [a[0] + dx * v - nx, y, a[1] + dz * v - nz],
        [a[0] + dx * u - nx, y, a[1] + dz * u - nz],
      ];
    const height = (t) =>
        hA +
        (hB - hA) * t +
        (detail
          ? 0.28 * Math.sin(t * length * 0.81 + seed) + 0.17 * Math.sin(t * length * 1.37 + seed)
          : 0),
      top = base.map((p, j) => [p[0], y + height(j === 0 || j === 3 ? u : v), p[2]]);
    for (let j = 0; j < 4; j++) {
      const k = (j + 1) % 4;
      f(
        'brick',
        [base[j], base[k], top[k], top[j]],
        [base[j][2] - base[k][2], 0, base[k][0] - base[j][0]],
      );
    }
    f('brick', base, [0, -1, 0]);
    f('brick', top, [0, 1, 0]);
  }
}
function apse(f, r, detail) {
  const a = r.apse,
    y = r.floorY,
    spring = y + a.spring,
    R = a.innerRadius,
    O = a.outerRadius,
    n = [8, 14, 24, 36][detail],
    m = [3, 5, 9, 14][detail];
  const point = (radius, t, p = 0) => [
    a.mouthU - radius * Math.cos(p) * Math.cos(t),
    spring + radius * Math.sin(p),
    a.centerV + radius * Math.cos(p) * Math.sin(t),
  ];
  // Continuous semicylindrical wall, with its apse mouth open to the southeast.
  for (let i = 0; i < n; i++) {
    const t = -Math.PI / 2 + (i * Math.PI) / n,
      u = -Math.PI / 2 + ((i + 1) * Math.PI) / n;
    for (const [radius, sign] of [
      [R, -1],
      [O, 1],
    ]) {
      const p = point(radius, t),
        q = point(radius, u);
      f(
        'brick',
        [[p[0], y, p[2]], [q[0], y, q[2]], q, p],
        [-Math.cos((t + u) / 2) * sign, 0, Math.sin((t + u) / 2) * sign],
      );
    }
    const ps = [point(R, t), point(R, u), point(O, u), point(O, t)];
    f(
      'brick',
      ps.map((p) => [p[0], y, p[2]]),
      [0, -1, 0],
    );
    if (detail >= 2)
      f('brick', [point(R, t), point(R + 0.16, t), point(R + 0.16, u), point(R, u)], [0, 1, 0]);
  }
  // Closed shell: the hemisphere is genuine geometry, not a dark painted arch.
  for (let j = 0; j < m; j++)
    for (let i = 0; i < n; i++) {
      const t = -Math.PI / 2 + (i * Math.PI) / n,
        u = -Math.PI / 2 + ((i + 1) * Math.PI) / n,
        p = (j * Math.PI) / 2 / m,
        q = ((j + 1) * Math.PI) / 2 / m;
      for (const [radius, sign] of [
        [R + (detail >= 2 ? 0.16 : 0), -1],
        [O, 1],
      ]) {
        const ps = [point(radius, t, p), point(radius, u, p), point(radius, u, q)];
        if (j < m - 1) ps.push(point(radius, t, q));
        f('brick', ps, [
          -Math.cos((p + q) / 2) * Math.cos((t + u) / 2) * sign,
          Math.sin((p + q) / 2) * sign,
          Math.cos((p + q) / 2) * Math.sin((t + u) / 2) * sign,
        ]);
      }
    }
  for (const t of [-Math.PI / 2, Math.PI / 2]) {
    const p = point(R, t),
      q = point(O, t);
    f('brick', [[p[0], y, p[2]], [q[0], y, q[2]], q, p], [1, 0, 0]);
    for (let j = 0; j < m; j++) {
      const p = (j * Math.PI) / 2 / m,
        q = ((j + 1) * Math.PI) / 2 / m;
      f('brick', [point(R, t, p), point(O, t, p), point(O, t, q), point(R, t, q)], [1, 0, 0]);
    }
  }
  // Diamond coffers: raised rims and recessed centers share the brick graph.
  if (detail >= 2) {
    const rows = detail === 2 ? 5 : 7;
    for (let j = 0; j < rows; j++) {
      const p = ((j + 0.5) * (Math.PI / 2 - 0.12)) / rows,
        cols = Math.max(3, Math.round((detail === 2 ? 15 : 21) * Math.cos(p))),
        dt = Math.PI / cols,
        dp = ((Math.PI / 2 - 0.12) / rows) * 0.48;
      for (let i = 0; i < cols; i++) {
        const t = -Math.PI / 2 + (i + 0.5) * dt,
          uv = [
            [t - dt * 0.48, p],
            [t, p - dp],
            [t + dt * 0.48, p],
            [t, p + dp],
          ],
          outer = uv.map(([u, v]) => point(R - 0.1, u, v)),
          inner = uv.map(([u, v]) => point(R + 0.1, t + (u - t) * 0.72, p + (v - p) * 0.72)),
          normal = [Math.cos(p) * Math.cos(t), -Math.sin(p), -Math.cos(p) * Math.sin(t)];
        for (let k = 0; k < 4; k++) {
          const z = (k + 1) % 4;
          f('brick', [outer[k], outer[z], inner[z], inner[k]], normal);
        }
        f('brick', inner, normal);
      }
    }
  }
  for (const sign of [-1, 1])
    brokenWall(
      f,
      [3.6, a.centerV + sign * 12.9],
      [-7.5, a.centerV + sign * 12.9],
      2.6,
      y,
      23.8,
      21.1,
      detail,
      sign,
    );
}

export function buildVenusTemple(face, detail, r) {
  const f = rotate(face, r.architecturalAngleRadians),
    y = r.floorY;
  for (const p of r.platform) platform(face, p, -12, y);
  apse(f, r, detail);
  // Broken cella returns remain roofless; the later museum is not replaced.
  brokenWall(f, [4, 14.1], [22, 14.1], 2.6, y, 14.5, 7.2, detail, 1);
  brokenWall(f, [4, -11.6], [15, -11.6], 2.2, y, 7.5, 3.2, detail, 2);
  brokenWall(f, [-27, 13.4], [-8, 13.4], 2.8, y, 10.5, 16.2, detail, 3);
  brokenWall(f, [-17, -10], [-8, -10], 2.3, y, 6, 12, detail, 4);
  box(f, 'stone', 25, y + 0.02, 1, 38, 0.1, 25);
  box(f, 'stone', 33, y + 0.12, 1, 4, 0.34, 20);
  for (let i = 0; i < (detail ? 6 : 1); i++)
    box(f, 'stone', 47 + i * 0.55, y - 0.8 + i * 0.14, 1, 0.57, 0.98 - i * 0.14, 10.5);
  for (const c of r.controls.filter((c) => c.kind === 'column'))
    cylinder(f, ...[c.center[0], y + 0.16, c.center[1]], 0.63, c.height, detail);
  const cluster = r.controls.find((c) => c.kind === 'column-fragments').polygons[0].outline;
  const co = Math.cos(r.architecturalAngleRadians),
    si = Math.sin(r.architecturalAngleRadians),
    local = ([x, z]) => [co * x + si * z, -si * x + co * z],
    center = cluster
      .map(local)
      .reduce((a, p) => a.map((v, i) => v + p[i] / cluster.length), [0, 0]);
  box(f, 'stone', center[0], y, center[1], 6.3, 0.6, 3.2);
  if (detail) {
    for (let i = 0; i < 7; i++)
      box(
        f,
        i % 2 ? 'stone' : 'column',
        center[0] - 2.5 + i * 0.8,
        y + 0.6,
        center[1] + Math.sin(i * 2) * 0.7,
        0.7,
        0.5 + (i % 3) * 0.35,
        1.0,
      );
  }
  if (detail >= 2)
    for (let i = 0; i < 18; i++) {
      const x = 18 + (i % 6) * 4.8,
        z = -17 + Math.floor(i / 6) * 17;
      box(
        f,
        'stone',
        x,
        y + 0.12,
        z,
        1.1 + (i % 3) * 0.3,
        0.3 + (i % 4) * 0.17,
        0.75 + (i % 2) * 0.5,
      );
    }
}

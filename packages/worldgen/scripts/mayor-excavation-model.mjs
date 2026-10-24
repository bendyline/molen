/** templo_mayor: the exposed, low archaeological layers and modern protective structures. */
import earcut from 'earcut';
export const mayorCandidateId = 'templo_mayor';
function box(f, role, x, y, z, w, h, d) {
  const a = [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [w / 2, d / 2],
      [-w / 2, d / 2],
    ].map(([u, v]) => [x + u, y, z + v]),
    b = a.map(([u, v, t]) => [u, v + h, t]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [a[i], a[j], b[j], b[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  f(role, a, [0, -1, 0]);
  f(role, b, [0, 1, 0]);
}
function pose(f, a) {
  const c = Math.cos(a),
    s = Math.sin(a);
  return (role, ps, n) =>
    f(
      role,
      ps.map(([x, y, z]) => [x * c - z * s, y, x * s + z * c]),
      [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c],
    );
}
function beam(f, role, a, b, width) {
  const axis = b.map((v, i) => v - a[i]),
    len = Math.hypot(...axis),
    n = axis.map((v) => v / len),
    ref = Math.abs(n[1]) < 0.95 ? [0, 1, 0] : [1, 0, 0],
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    raw = cross(n, ref),
    u = raw.map((v) => v / Math.hypot(...raw)),
    v = cross(n, u),
    ring = (p) =>
      [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ].map(([x, z]) => p.map((q, i) => q + ((u[i] * x + v[i] * z) * width) / 2)),
    p = ring(a),
    q = ring(b);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(
      role,
      [p[i], p[j], q[j], q[i]],
      p[i].map((v, k) => (v + p[j][k]) / 2 - a[k]),
    );
  }
  f(
    role,
    p,
    n.map((v) => -v),
  );
  f(role, q, n);
}
function floor(f, outline, y) {
  const ix = earcut(outline.flat());
  for (let i = 0; i < ix.length; i += 3) {
    const ps = ix.slice(i, i + 3).map((k) => [outline[k][0], y, outline[k][1]]);
    f('soil', ps, [0, 1, 0]);
    f(
      'soil',
      ps.map((p) => [p[0], y - 0.4, p[2]]),
      [0, -1, 0],
    );
  }
}
function retaining(f, outline, y, detail, sample) {
  let signed = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length];
    signed += a[0] * b[1] - b[0] * a[1];
  }
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i],
      b = outline[(i + 1) % outline.length],
      dx = b[0] - a[0],
      dz = b[1] - a[1],
      length = Math.hypot(dx, dz),
      sign = Math.sign(signed),
      off = [(-dz / length) * 0.28 * sign, (dx / length) * 0.28 * sign],
      count = Math.ceil(length / (detail ? 6 : 18));
    for (let k = 0; k < count; k++) {
      const p = [a[0] + (dx * k) / count, a[1] + (dz * k) / count],
        q = [a[0] + (dx * (k + 1)) / count, a[1] + (dz * (k + 1)) / count],
        plan = [p, q, [q[0] + off[0], q[1] + off[1]], [p[0] + off[0], p[1] + off[1]]],
        bottom = plan.map(([x, z]) => [x, y - 0.4, z]),
        top = plan.map(([x, z]) => [x, Math.max(y + 0.3, sample(x, z) + 0.25), z]);
      for (let j = 0; j < 4; j++) {
        const m = (j + 1) % 4;
        f(
          'soil',
          [bottom[j], bottom[m], top[m], top[j]],
          [plan[m][1] - plan[j][1], 0, plan[j][0] - plan[m][0]],
        );
      }
      f('soil', top, [0, 1, 0]);
      f('soil', bottom, [0, -1, 0]);
    }
  }
}
function stairs(f, x0, x1, z, width, y0, y1, detail, foundationY) {
  const n = detail === 0 ? 1 : detail === 1 ? 5 : 14;
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n,
      b = x0 + ((x1 - x0) * (i + 1)) / n,
      h = y0 + ((y1 - y0) * (i + 1)) / n;
    box(f, 'plaster', (a + b) / 2, foundationY, z, b - a, h - foundationY, width);
  }
  for (const side of [-1, 1]) {
    const a = [x0, y0 + 0.4, z + side * (width / 2 + 0.4)],
      b = [x1, y1 + 0.4, z + side * (width / 2 + 0.4)];
    beam(f, 'stone', a, b, 0.75);
  }
}
function canopy(f, p, detail, floorY) {
  const o = p.localOutline,
    a = o.map(([x, z]) => [x, p.eaveY, z]),
    low = a.map(([x, y, z]) => [x, y - 0.12, z]),
    r0 = [(a[0][0] + a[1][0]) / 2, p.ridgeY, (a[0][2] + a[1][2]) / 2],
    r1 = [(a[2][0] + a[3][0]) / 2, p.ridgeY, (a[2][2] + a[3][2]) / 2];
  for (const ps of [
    [a[0], a[3], r1, r0],
    [r0, r1, a[2], a[1]],
    [a[0], r0, a[1]],
    [a[3], a[2], r1],
  ]) {
    f('metal', ps, [0, 1, 0]);
    f(
      'metal',
      ps.map(([x, y, z]) => [x, y - 0.12, z]),
      [0, -1, 0],
    );
  }
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f('metal', [a[i], a[j], low[j], low[i]], [a[j][2] - a[i][2], 0, a[i][0] - a[j][0]]);
  }
  // These slender posts are subpixel at the skyline distance.
  if (detail === 0) return;
  const n = detail === 1 ? 2 : 4;
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      left = a[0].map((v, k) => v * (1 - t) + a[3][k] * t),
      right = a[1].map((v, k) => v * (1 - t) + a[2][k] * t),
      ridge = r0.map((v, k) => v * (1 - t) + r1[k] * t);
    for (const p of [left, right])
      beam(f, 'metal', [p[0], floorY + 0.1, p[2]], [p[0], p[1], p[2]], 0.12);
    if (detail) {
      beam(f, 'metal', left, ridge, 0.13);
      beam(f, 'metal', right, ridge, 0.13);
      beam(f, 'metal', left, right, 0.12);
    }
  }
}
export function buildMayorExcavation(face, detail, r, sample) {
  floor(face, r.excavationOutline, r.floorY);
  retaining(face, r.excavationOutline, r.floorY, detail, sample);
  const f = pose(face, r.architecturalAngleRadians),
    y = r.floorY;
  for (const [i, p] of r.stages.entries()) {
    const [a, b, c, d] = p.bounds,
      w = p.thickness,
      h = p.height;
    // Surviving low bands, deliberately interrupted on the west, rather than a restored pyramid.
    for (const z of [b, d]) box(f, 'stone', (a + c) / 2, y, z, c - a, h, w);
    box(f, 'stone', c, y, (b + d) / 2, w, h, d - b);
    for (const z of [b + 3, d - 3]) box(f, 'stone', a, y, z, w, h, 5.5);
    if (detail >= 1) {
      for (const z of [b, d])
        box(f, 'plaster', (a + c) / 2, y + h - 0.07, z, (c - a) * 0.68, 0.12, w * 0.65);
    }
    if (detail >= 2)
      for (let k = 0; k < 5; k++)
        box(f, 'stone', a + 1.3 + k * 2.1, y + h, zAt(i, k, b, d), 1.1, 0.22 + (k % 2) * 0.12, 0.7);
  }
  box(f, 'plaster', 11, y + 0.05, 0, 23, 2.9, 29);
  box(f, 'stone', -7, y, 0, 14, 1.6, 26);
  box(f, 'plaster', -7, y + 1.6, 0, 13.6, 0.08, 25.6);
  for (const p of r.shrines) {
    const [x, z] = p.center;
    box(f, 'stone', x, p.floorY - 0.95, z, p.depth, 0.95, p.width);
    box(f, 'plaster', x, p.floorY, z, p.depth, 0.13, p.width);
    box(f, 'stone', x + p.depth / 2 - 0.4, p.floorY, z, 0.8, 1.65, p.width);
    for (const side of [-1, 1])
      box(f, 'stone', x + 1, p.floorY, z + side * (p.width / 2 - 0.35), p.depth - 2, 1.15, 0.7);
    if (detail) box(f, 'stone', x - 0.6, p.floorY + 0.13, z, 1.25, 0.65, 1.3);
    stairs(f, -6, x - p.depth / 2, z, 5.3, y + 1.6, p.floorY + 0.13, detail, y - 0.2);
  }
  if (detail)
    for (const z of [-24, 24]) stairs(f, -25, -17, z, 4.4, y + 0.65, y + 1.6, detail, y - 0.2);
  for (const p of r.canopies) canopy(f, p, detail, y);
  if (detail >= 1) {
    // Damaged low wall/floor fragments and modest plaster remnants inside the exposed layers.
    for (const [x, z, w, d] of [
      [-22, -11, 6, 3],
      [-24, 24, 5, 4],
      [29, 22, 4, 7],
      [30, -19, 5, 3],
      [-7, 26, 8, 2],
    ]) {
      box(f, 'stone', x, y, z, w, 0.45, d);
      box(f, 'plaster', x, y + 0.45, z, w * 0.72, 0.06, d * 0.7);
    }
    const n = detail === 1 ? 5 : 12;
    for (let i = 0; i < n; i++) {
      const x = -18 + (i % 4) * 5,
        z = -17 + Math.floor(i / 4) * 15;
      box(f, 'stone', x, y + 0.02, z, 1.2 + (i % 3) * 0.3, 0.2 + (i % 2) * 0.15, 0.7);
    }
  }
  // The native pedestrian alignment remains; an authored deck/supports explain its crossing.
  const [a, b] = r.crossing.line,
    len = Math.hypot(b[0] - a[0], b[1] - a[1]),
    n = detail === 0 ? 4 : 14,
    dx = (b[0] - a[0]) / len,
    dz = (b[1] - a[1]) / len,
    across = [-dz, dx],
    half = r.crossing.width / 2;
  for (let i = 0; i < n; i++) {
    const p = [a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n],
      q = [a[0] + ((b[0] - a[0]) * (i + 1)) / n, a[1] + ((b[1] - a[1]) * (i + 1)) / n],
      corners = [
        [p, 1],
        [q, 1],
        [q, -1],
        [p, -1],
      ].map(([v, s]) => [
        v[0] + across[0] * half * s,
        sample(...v) + 0.12,
        v[1] + across[1] * half * s,
      ]);
    face('timber', corners, [0, 1, 0]);
    face(
      'timber',
      corners.map(([x, y, z]) => [x, y - 0.2, z]),
      [0, -1, 0],
    );
    for (let k = 0; k < 4; k++) {
      const j = (k + 1) % 4;
      face(
        'timber',
        [
          corners[k],
          corners[j],
          [corners[j][0], corners[j][1] - 0.2, corners[j][2]],
          [corners[k][0], corners[k][1] - 0.2, corners[k][2]],
        ],
        [corners[j][2] - corners[k][2], 0, corners[k][0] - corners[j][0]],
      );
    }
    if (detail >= 1) {
      for (const side of [-1, 1]) {
        const offset = across.map((v) => v * half * side),
          u = [p[0] + offset[0], sample(...p) + 1.05, p[1] + offset[1]],
          v = [q[0] + offset[0], sample(...q) + 1.05, q[1] + offset[1]];
        beam(face, 'metal', u, v, 0.04);
        beam(face, 'metal', [u[0], u[1] - 0.9, u[2]], u, 0.05);
      }
    }
    if (i % 2 === 0)
      for (const side of [-1, 1])
        box(
          face,
          'metal',
          p[0] + across[0] * 0.7 * side,
          y - 0.15,
          p[1] + across[1] * 0.7 * side,
          0.18,
          sample(...p) - y + 0.2,
          0.18,
        );
  }
}
function zAt(i, k, b, d) {
  return (i + k) % 2 === 0 ? b : d;
}

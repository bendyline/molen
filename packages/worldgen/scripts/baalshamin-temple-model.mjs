/** temple_of_baalshamin: dated surviving six-column porch and roofless cella. */
import earcut from 'earcut';
export const baalshaminCandidateId = 'temple_of_baalshamin';
function prism(f, role, p, lo, hi) {
  const rings = [p.outline, ...(p.holes ?? [])],
    flat = rings.flat(),
    holes = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(k);
    k += h.length;
  }
  const ix = earcut(flat.flat(), holes),
    low = flat.map(([x, z]) => [x, lo, z]),
    high = flat.map(([x, z]) => [x, hi, z]);
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((k) => low[k]),
      [0, -1, 0],
    );
    f(
      role,
      ix.slice(i, i + 3).map((k) => high[k]),
      [0, 1, 0],
    );
  }
  let o = 0;
  for (let r = 0; r < rings.length; r++) {
    const p = rings[r],
      a = p.reduce((n, a, i) => {
        const b = p[(i + 1) % p.length];
        return n + a[0] * b[1] - a[1] * b[0];
      }, 0),
      sgn = Math.sign(a) * (r ? -1 : 1);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      f(
        role,
        [low[o + i], low[o + j], high[o + j], high[o + i]],
        [(p[j][1] - p[i][1]) * sgn, 0, (p[i][0] - p[j][0]) * sgn],
      );
    }
    o += p.length;
  }
}
const rect = (x, z, w, d) => ({
  outline: [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ],
  holes: [],
});
function lathe(f, role, x, z, profile, n, flutes = 0) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        rr = r * (1 - (flutes ? (0.028 * (1 + Math.cos(a * flutes))) / 2 : 0));
      return [x + rr * Math.cos(a), y, z + rr * Math.sin(a)];
    }),
  );
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n,
        a = ((i + 0.5) * Math.PI * 2) / n;
      f(
        role,
        [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
        [Math.cos(a), 0, Math.sin(a)],
      );
    }
  f(role, rings[0], [0, -1, 0]);
  f(role, rings.at(-1), [0, 1, 0]);
}
function beam(f, role, a, b, w, h = w) {
  const dx = b[0] - a[0],
    dz = b[2] - a[2],
    len = Math.hypot(dx, dz),
    u = [((-dz / len) * w) / 2, 0, ((dx / len) * w) / 2],
    p = [
      a.map((v, i) => v + u[i]),
      a.map((v, i) => v - u[i]),
      b.map((v, i) => v - u[i]),
      b.map((v, i) => v + u[i]),
    ],
    q = p.map((p) => [p[0], p[1] + h, p[2]]);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    f(role, [p[i], p[j], q[j], q[i]], [p[j][2] - p[i][2], 0, p[i][0] - p[j][0]]);
  }
  f(role, p, [0, -1, 0]);
  f(role, q, [0, 1, 0]);
}
function leaf(f, x, z, y, a, tier) {
  const c = Math.cos(a),
    s = Math.sin(a),
    shape = [
      [-0.13, 0, 0.42],
      [0.13, 0, 0.42],
      [-0.17, 0.28, 0.63],
      [0.17, 0.28, 0.63],
      [0, 0.5, 0.76],
      [0, 0.3, 0.72],
    ],
    p = shape.map(([u, v, r]) => [x + c * r - s * u, y + v, z + s * r + c * u]);
  for (const ids of [
    [0, 1, 5],
    [1, 3, 5],
    [3, 4, 5],
    [4, 2, 5],
    [2, 0, 5],
    [0, 2, 4, 3, 1],
  ])
    f(
      'stone',
      ids.map((i) => p[i]),
      [c, 0.25 + 2 * tier, s],
    );
}
export function buildBaalshaminTemple(face, detail, r) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([u, y, v]) => [c * u - s * v, r.floorY + y, s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    box = (role, x, lo, z, w, h, d) => prism(f, role, rect(x, z, w, d), lo, lo + h),
    n = [4, 12, 24, 32][detail],
    bottom = r.foundationBase - r.floorY;
  // Small, closed stepped podium. The surrounding archaeological precinct stays native ground.
  box('rough', 0, bottom, 0, 16, bottom * -1, 9.5);
  box('stone', 0, 0, 0, 15.6, 0.22, 9.1);
  for (let i = 0; i < 3; i++)
    box('rough', 8.15 + i * 0.28, bottom, 0, 0.56, -bottom + 0.16 - i * 0.13, 6.8);
  const wall = (x0, x1, z, opening) => {
    const wallPart = (a, b, lo, hi) => {
      if (b > a && hi > lo) box('stone', (a + b) / 2, lo, z, b - a, hi - lo, 0.65);
    };
    if (opening) {
      const [a, b, lo, hi] = opening;
      wallPart(x0, a, 0.22, 7.4);
      wallPart(b, x1, 0.22, 7.4);
      wallPart(a, b, 0.22, lo);
      wallPart(a, b, hi, 7.4);
    } else wallPart(x0, x1, 0.22, 7.4);
    if (detail >= 2)
      for (let row = 0; row < 8; row++) {
        const lo = 0.3 + row * 0.88,
          hi = Math.min(7.35, lo + 0.86),
          step = 1.4;
        for (let a = x0; a < x1; a += step) {
          const b = Math.min(x1, a + step - 0.012),
            mid = (a + b) / 2;
          if (opening && b > opening[0] && a < opening[1] && hi > opening[2] && lo < opening[3])
            continue;
          for (const side of [-1, 1])
            box(row < 2 ? 'rough' : 'stone', mid, lo, z + side * 0.329, b - a, hi - lo, 0.025);
        }
      }
  };
  // Both long walls have real, open window apertures; the cella has no roof.
  for (const z of [-3.8, 3.8]) {
    wall(-7.2, 1.3, z, [-4.0, -2.8, 4.35, 6.05]);
    for (const x of [-7.05, -1, 1.1]) {
      box('stone', x, 0.22, z, 0.42, 6.4, 0.92);
      box('rough', x, 0.22, z, 0.68, 0.28, 1.12);
      box('stone', x, 6.62, z, 0.72, 0.55, 1.13);
      if (detail >= 2) for (let k = 0; k < 6; k++) leaf(f, x, z, 6.65, (k * Math.PI) / 3, 0);
    }
    for (const x of [-4.12, -2.68]) box('rough', x, 4.15, z, 0.25, 2.15, 1);
    box('rough', -3.4, 4.13, z, 1.7, 0.22, 1.1);
    box('stone', -3.4, 6.22, z, 1.9, 0.25, 1.15);
    for (const side of [-1, 1]) {
      const zf = z + side * 0.58;
      f(
        'stone',
        [
          [-4.4, 6.48, zf],
          [-3.4, 7.02, zf],
          [-2.4, 6.48, zf],
        ],
        [0, 0, side],
      );
      beam(f, 'rough', [-4.4, 6.43, zf], [-3.4, 6.98, zf], 0.17, 0.12);
      beam(f, 'rough', [-3.4, 6.98, zf], [-2.4, 6.43, zf], 0.17, 0.12);
    }
  }
  box('stone', -7.2, 0.22, 0, 0.65, 7.18, 7.6);
  // Front doorway has a sealed threshold, deep stone reveal and explicit iron gate.
  for (const z of [-2.425, 2.425]) box('stone', 1.3, 0.22, z, 0.7, 7.18, 2.75);
  box('stone', 1.3, 5.2, 0, 0.7, 2.2, 2.1);
  for (const z of [-1.17, 1.17]) box('rough', 1.72, 0.22, z, 0.32, 5.1, 0.27);
  box('rough', 1.72, 5.2, 0, 0.35, 0.35, 2.9);
  box('stone', 1.3, 0.22, 0, 1.4, 0.12, 2.2);
  for (let z = -0.92; z <= 0.93; z += detail === 0 ? 0.46 : 0.23)
    box('metal', 1.34, 0.35, z, 0.04, 4.8, 0.035);
  for (const y of [0.35, 2.05, 4.2, 5.1]) box('metal', 1.34, y, 0, 0.045, 0.04, 1.95);
  const capitals = (x, z) => {
    lathe(
      f,
      'stone',
      x,
      z,
      detail === 0
        ? [
            [0.22, 0.47],
            [6.1, 0.33],
            [7.12, 0.6],
          ]
        : [
            [0.22, 0.47],
            [0.32, 0.55],
            [0.44, 0.52],
            [0.56, 0.4],
            [5.95, 0.33],
            [6.1, 0.42],
            [6.4, 0.5],
            [6.85, 0.62],
            [7.12, 0.6],
          ],
      n,
    );
    if (detail > 0) box('stone', x, 7.12, z, 1.23, 0.2, 1.23);
    if (detail >= 1) {
      box('rough', x + 0.46, 2.9, z, 0.75, 0.28, 0.65);
      box('stone', x + 0.62, 3.18, z, 0.96, 0.22, 0.84);
    }
    if (detail >= 2)
      for (let tier = 0; tier < 2; tier++)
        for (let k = 0; k < 8; k++)
          leaf(f, x, z, 6.15 + tier * 0.32, (k * Math.PI) / 4 + (tier * Math.PI) / 8, tier);
  };
  for (const [x, z] of r.columns) capitals(x, z);
  // Surviving horizontal entablature outlines a hollow porch rather than a solid lid.
  for (const [lo, h, th] of detail === 0
    ? [[7.32, 1.01, 1.3]]
    : [
        [7.32, 0.45, 0.9],
        [7.77, 0.34, 1.08],
        [8.11, 0.22, 1.3],
      ]) {
    beam(f, 'stone', [6.6, lo, -3.3], [6.6, lo, 3.3], th, h);
    for (const z of [-3.3, 3.3]) beam(f, 'stone', [1.3, lo, z], [6.6, lo, z], th, h);
    box('stone', -7.2, lo, 0, th, h, 8.1);
    for (const z of [-3.8, 3.8]) beam(f, 'stone', [-7.2, lo, z], [1.3, lo, z], th, h);
    box('stone', 1.3, lo, 0, th, h, 8.1);
  }
  if (detail >= 1) {
    for (const z of [-3.8, 3.8])
      for (let x = -6.7; x <= 0.9; x += 0.8) box('rough', x, 7.6, z, 0.12, 0.18, 1.15);
    // A limited visible fragment selection; not a survey of the historical courtyard.
    for (let i = 0; i < 8; i++) {
      const x = -7.2 + (i % 4) * 3.7,
        z = i < 4 ? -5.8 : 5.9;
      const w = 0.85 + (i % 3) * 0.18,
        d = 0.7 + (i % 2) * 0.27,
        xx = x + (i % 2) * 0.3,
        zz = z + (i % 3) * 0.17;
      prism(
        f,
        'rough',
        {
          outline: [
            [xx - w / 2, zz - d / 2],
            [xx + w * 0.4, zz - d * 0.55],
            [xx + w / 2, zz + d * 0.2],
            [xx + w * 0.3, zz + d / 2],
            [xx - w * 0.4, zz + d * 0.4],
          ],
          holes: [],
        },
        bottom,
        0.36 + (i % 3) * 0.12,
      );
      if (i % 3 === 0)
        lathe(
          f,
          'rough',
          xx,
          zz,
          [
            [0.36, 0.4],
            [1.55 + (i % 2) * 0.6, 0.36],
          ],
          detail === 1 ? 6 : 12,
        );
    }
  }
}

/** N0517: present-day shafts, stepped base and roofless Forum of Peace ruins. */
import earcut from 'earcut';
export const peaceCandidateId = 'N0517';
const area = (p) =>
  p.reduce((n, a, i) => {
    const b = p[(i + 1) % p.length];
    return n + a[0] * b[1] - a[1] * b[0];
  }, 0) / 2;
function prism(f, role, poly, bottom, top) {
  const rings = [poly.outline, ...(poly.holes ?? [])],
    flat = rings.flat(),
    holes = [];
  let k = rings[0].length;
  for (const h of rings.slice(1)) {
    holes.push(k);
    k += h.length;
  }
  const ix = earcut(flat.flat(), holes),
    low = flat.map(([x, z]) => [x, typeof bottom === 'function' ? bottom(x, z) : bottom, z]),
    high = flat.map(([x, z], i) => [x, typeof top === 'function' ? top(x, z, i) : top, z]);
  for (let i = 0; i < ix.length; i += 3) {
    f(
      role,
      ix.slice(i, i + 3).map((i) => low[i]),
      [0, -1, 0],
    );
    f(
      role,
      ix.slice(i, i + 3).map((i) => high[i]),
      [0, 1, 0],
    );
  }
  let offset = 0;
  for (let r = 0; r < rings.length; r++) {
    const p = rings[r],
      sign = Math.sign(area(p)) * (r === 0 ? 1 : -1);
    for (let i = 0; i < p.length; i++) {
      const j = (i + 1) % p.length;
      f(
        role,
        [low[offset + i], low[offset + j], high[offset + j], high[offset + i]],
        [(p[j][1] - p[i][1]) * sign, 0, (p[i][0] - p[j][0]) * sign],
      );
    }
    offset += p.length;
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
function shaft(f, role, x, z, y, profiles, n, broken = false) {
  const rings = profiles.map(([dy, r], k) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n;
      return [
        x + r * Math.cos(a),
        y + dy + (broken && k === profiles.length - 1 ? 0.055 * Math.sin(i * 2.7 + x) : 0),
        z + r * Math.sin(a),
      ];
    }),
  );
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      f(
        role,
        [rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]],
        [Math.cos(((i + 0.5) * Math.PI * 2) / n), 0, Math.sin(((i + 0.5) * Math.PI * 2) / n)],
      );
    }
  f(role, rings[0], [0, -1, 0]);
  f(role, rings.at(-1), [0, 1, 0]);
}
export function buildPeaceRuins(face, detail, r, sample) {
  const c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    o = r.architecturalOrigin,
    P = ([x, z]) => [o[0] + c * x - s * z, o[1] + s * x + c * z],
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([x, y, z]) => {
          const p = P([x, z]);
          return [p[0], y, p[1]];
        }),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    box = (role, x, y, z, w, h, d) => prism(f, role, rect(x, z, w, d), y, y + h),
    y = r.floorY,
    segments = [6, 10, 16, 24][detail];
  for (const p of r.platform) prism(face, 'earth', p, (x, z) => sample(x, z) - 0.65, p.floorY);
  const st = r.stylobate,
    w = st.maxU - st.minU,
    u = (st.maxU + st.minU) / 2,
    steps = detail === 0 ? 2 : 6;
  for (let i = 0; i < steps; i++) {
    const h = st.height / steps;
    box(
      'stone',
      u,
      y + i * h,
      -0.95 + i * 0.25,
      w + (steps - i) * 0.22,
      h,
      3.2 + (steps - i) * 0.5,
    );
  }
  for (const col of r.columns) {
    const [x, z] = col.center,
      base = y + st.height;
    box('stone', x, base, z, 1.6, detail === 0 ? 0.59 : 0.24, 1.6);
    if (detail > 0)
      shaft(
        f,
        'stone',
        x,
        z,
        base + 0.24,
        detail === 0
          ? [
              [0, 0.7],
              [0.35, 0.56],
            ]
          : [
              [0, 0.7],
              [0.08, 0.74],
              [0.18, 0.59],
              [0.24, 0.65],
              [0.35, 0.56],
            ],
        Math.max(6, segments - 2),
      );
    shaft(
      f,
      'column',
      x,
      z,
      base + 0.59,
      detail === 0
        ? [
            [0, 0.54],
            [6.8, 0.46],
          ]
        : [
            [0, 0.54],
            [3.5, 0.51],
            [6.8, 0.46],
          ],
      segments,
      detail > 0,
    );
  }
  // Broad low roofless traces; small stone inventories are picture-led estimates.
  const wall = (x, z, w, h, d, seed) =>
    prism(
      f,
      'brick',
      rect(x, z, w, d),
      y - 0.35,
      (x, z) => y + h + (detail > 1 ? 0.055 * Math.sin(x * 2.3 + z * 1.7 + seed) : 0),
    );
  for (const x of [-7, 4]) {
    wall(x - 3.3, -15, 0.65, 0.43, 20, 1);
    wall(x + 3.3, -15, 0.65, 0.43, 20, 2);
    wall(x, -25, 7.2, 0.43, 0.65, 3);
    wall(x, -5, 7.2, 0.43, 0.65, 4);
  }
  for (const [x, z, w, d, h] of [
    [-22, -12, 2.4, 6, 2.1],
    [19, -10, 2.4, 7, 2.2],
    [-18, 8, 5, 1.2, 1.3],
  ])
    prism(
      f,
      'core',
      rect(x, z, w, d),
      y - 0.45,
      (x, z) => y + h + (detail ? 0.12 * Math.sin(x * 1.8 + z * 2.2) : 0),
    );
  for (const p of r.controls.filter((p) => p.kind === 'fragment'))
    for (const poly of p.polygons) {
      const hs = poly.outline.map((p) => sample(...p));
      prism(face, 'core', poly, Math.min(...hs) - 0.4, Math.max(...hs) + p.height);
    }
  if (detail > 0) {
    const fallen = (x, z, len, rad, angle) => {
      const cc = Math.cos(angle),
        ss = Math.sin(angle),
        g = (role, ps, n) =>
          f(
            role,
            ps.map(([u, v, t]) => [x + cc * u - ss * t, y + 0.15 + rad + v, z + ss * u + cc * t]),
            [cc * n[0] - ss * n[2], n[1], ss * n[0] + cc * n[2]],
          );
      const g2 = (role, ps, n) =>
        g(
          role,
          ps.map(([u, v, t]) => [v, u, t]),
          [n[1], n[0], n[2]],
        );
      shaft(
        g2,
        'column',
        0,
        0,
        -len / 2,
        [
          [0, rad],
          [len, rad * 0.95],
        ],
        segments,
        true,
      );
    };
    fallen(-15, -18, 5.2, 0.65, 0.18);
    for (let i = 0; i < [0, 8, 14, 20][detail]; i++)
      fallen(
        -20 + (i % 4) * 1.65,
        -3 - Math.floor(i / 4) * 1.8,
        0.75 + (i % 3) * 0.4,
        0.42 + (i % 2) * 0.09,
        i * 0.67,
      );
    for (let i = 0; i < [0, 10, 24, 38][detail]; i++) {
      const x = -20 + (i % 7) * 5.6,
        z = -24 + Math.floor(i / 7) * 4.5;
      if (x > -12 && x < 9 && z < -4) continue;
      box('stone', x, y + 0.005, z, 1.2 + (i % 2) * 0.7, 0.045, 1.6);
    }
  }
}

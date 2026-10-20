/** N0518: mapped nineteen-column peristyle, circular cella and present roof. */
import earcut from 'earcut';
export const herculesVictorCandidateId = 'N0518';
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
export function buildHerculesVictorTemple(face, detail, r) {
  const y = r.floorY,
    c = r.center,
    f = (role, ps, n) =>
      face(
        role,
        ps.map(([x, h, z]) => [x + c[0], y + h, z + c[1]]),
        n,
      ),
    native = (p) => ({
      outline: p.outline.map(([x, z]) => [x - c[0], z - c[1]]),
      holes: p.holes.map((h) => h.map(([x, z]) => [x - c[0], z - c[1]])),
    }),
    box = (role, x, lo, z, w, h, d) => prism(f, role, rect(x, z, w, d), lo, lo + h),
    n = [4, 8, 32, 48][detail],
    round = [12, 24, 48, 72][detail];
  for (const p of r.podium) prism(f, 'stone', native(p), r.foundationBase - y, 0.8);
  for (const step of r.steps)
    for (const p of step.polygons) prism(f, 'stone', native(p), r.foundationBase - y, step.height);
  for (let i = 0; i < r.columns.length; i++) {
    const x = r.columns[i].center[0] - c[0],
      z = r.columns[i].center[1] - c[1];
    if (detail === 0) {
      lathe(
        f,
        'stone',
        x,
        z,
        [
          [0.8, 0.48],
          [7, 0.4],
          [8.1, 0.68],
        ],
        4,
      );
      continue;
    }
    lathe(
      f,
      'stone',
      x,
      z,
      detail === 1
        ? [
            [0.8, 0.6],
            [1.05, 0.46],
          ]
        : [
            [0.8, 0.61],
            [0.9, 0.63],
            [0.96, 0.48],
            [1.02, 0.55],
            [1.12, 0.46],
          ],
      detail === 1 ? 8 : 12,
    );
    lathe(
      f,
      'stone',
      x,
      z,
      detail === 3
        ? [
            [1.12, 0.46],
            [2.3, 0.455],
            [3.8, 0.445],
            [5.3, 0.43],
            [7, 0.4],
          ]
        : [
            [1.12, 0.46],
            [4, 0.445],
            [7, 0.4],
          ],
      n,
      detail >= 2 ? n / 2 : 0,
    );
    lathe(
      f,
      'stone',
      x,
      z,
      [
        [7, 0.4],
        [7.25, 0.47],
        [7.8, 0.66],
        [8, 0.7],
      ],
      detail === 1 ? 8 : 16,
    );
    box('stone', x, 8, z, 1.45, 0.12, 1.45);
    if (detail >= 2)
      for (let tier = 0; tier < 2; tier++)
        for (let j = 0; j < 8; j++)
          leaf(f, x, z, 7.05 + tier * 0.36, (j * Math.PI) / 4 + (tier * Math.PI) / 8, tier);
    if (detail >= 2 && [2, 5, 7, 12, 17].includes(i))
      for (const h of [3.05, 5.9])
        lathe(
          f,
          'metal',
          x,
          z,
          [
            [h, 0.476 - (h - 1.12) * 0.009],
            [h + 0.055, 0.476 - (h - 1.12) * 0.009],
          ],
          n,
        );
  }
  const m = r.missingBase.map((v, i) => v - c[i]);
  lathe(
    f,
    'stone',
    ...m,
    [
      [0.8, 0.56],
      [1.15, 0.49],
      [1.2, 0.29],
    ],
    detail ? 12 : 4,
  );
  for (const p of r.body) {
    prism(f, 'stone', native(p), 0.8, 4.0);
    prism(f, 'brick', native(p), 4.0, 8.5);
  }
  // A sealed recessed arched door; no invented open navigable interior.
  const d = r.door,
    x = d.x,
    z = d.z,
    seg = detail ? 12 : 6,
    arch = Array.from({ length: seg + 1 }, (_, i) => {
      const a = (i * Math.PI) / seg;
      return [z + d.halfWidth * Math.cos(a), d.spring + d.halfWidth * Math.sin(a)];
    }),
    portal = [[z - d.halfWidth, 0.8], [z + d.halfWidth, 0.8], ...arch],
    head = [[z - d.halfWidth, 8.5], [z + d.halfWidth, 8.5], ...arch],
    panel = (role, ring, front, back) => {
      const ix = earcut(ring.flat()),
        sign = Math.sign(
          ring.reduce((sum, p, i) => {
            const q = ring[(i + 1) % ring.length];
            return sum + p[0] * q[1] - p[1] * q[0];
          }, 0),
        ),
        a = ring.map(([z, y]) => [front, y, z]),
        b = ring.map(([z, y]) => [back, y, z]);
      for (let i = 0; i < ix.length; i += 3) {
        f(
          role,
          ix.slice(i, i + 3).map((i) => a[i]),
          [1, 0, 0],
        );
        f(
          role,
          ix.slice(i, i + 3).map((i) => b[i]),
          [-1, 0, 0],
        );
      }
      for (let i = 0; i < ring.length; i++) {
        const j = (i + 1) % ring.length;
        f(
          role,
          [a[i], a[j], b[j], b[i]],
          [0, (ring[i][0] - ring[j][0]) * sign, (ring[j][1] - ring[i][1]) * sign],
        );
      }
    };
  panel('metal', portal, x - 0.18, x - 0.26);
  panel('brick', head, x + 0.05, x - 0.65);
  if (detail > 0) {
    for (const h of [1.05, 2.25, 3.5, 4.75, 5.8]) box('metal', x - 0.165, h, z, 0.055, 0.055, 2.85);
    box('metal', x - 0.15, 0.9, z, 0.06, 5.0, 0.07);
    for (const t of [-0.73, 0.73]) {
      beam(f, 'metal', [x - 0.11, 1.1, z + t - 0.65], [x - 0.11, 2.25, z + t + 0.65], 0.04);
      beam(f, 'metal', [x - 0.11, 2.25, z + t - 0.65], [x - 0.11, 3.5, z + t + 0.65], 0.04);
    }
  }
  // Present tiled cone and its timber underside, with no ancient architrave.
  lathe(
    f,
    'roof',
    0,
    0,
    [
      [8.2, r.roofRadius],
      [8.36, r.roofRadius],
      [10.15, 0.25],
    ],
    round,
  );
  lathe(
    f,
    'stone',
    0,
    0,
    [
      [10.13, 0.29],
      [10.46, 0.29],
      [10.5, 0.35],
    ],
    detail ? 12 : 4,
  );
  if (detail) {
    for (let i = 0; i < round; i++) {
      const a = (i * 2 * Math.PI) / round,
        b = ((i + 1) * 2 * Math.PI) / round,
        p = (rad, a) => [rad * Math.cos(a), 8.18, rad * Math.sin(a)];
      f('wood', [p(4.2, a), p(4.2, b), p(r.roofRadius, b), p(r.roofRadius, a)], [0, -1, 0]);
    }
    for (let i = 0; i < (detail === 1 ? 10 : 20); i++) {
      const a = (i * Math.PI * 2) / (detail === 1 ? 10 : 20);
      beam(
        f,
        'wood',
        [4.2 * Math.cos(a), 8.0, 4.2 * Math.sin(a)],
        [9.1 * Math.cos(a), 8.0, 9.1 * Math.sin(a)],
        0.18,
        0.18,
      );
    }
    for (let i = 0; i < r.columns.length; i++) {
      const a = r.columns[i].center.map((v, i) => v - c[i]),
        b = r.columns[(i + 1) % r.columns.length].center.map((v, i) => v - c[i]);
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 3)
        beam(f, 'wood', [a[0], 8.09, a[1]], [b[0], 8.09, b[1]], 0.28, 0.16);
    }
  }
}

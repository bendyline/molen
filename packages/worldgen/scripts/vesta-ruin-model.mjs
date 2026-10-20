/** Existing Temple of Vesta: the roofless ruin and surviving northwest sector. */
export const vestaCandidateId = 'N0501';
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
function arc(f, role, center, a, b, ri, ro, bottom, top, n) {
  const pt = (r, y, t) => [center[0] + r * Math.cos(t), y, center[1] + r * Math.sin(t)];
  for (let i = 0; i < n; i++) {
    const x = a + ((b - a) * i) / n,
      z = a + ((b - a) * (i + 1)) / n,
      t = (x + z) / 2;
    f(
      role,
      [pt(ro, bottom, x), pt(ro, bottom, z), pt(ro, top, z), pt(ro, top, x)],
      [Math.cos(t), 0, Math.sin(t)],
    );
    f(
      role,
      [pt(ri, bottom, x), pt(ri, bottom, z), pt(ri, top, z), pt(ri, top, x)],
      [-Math.cos(t), 0, -Math.sin(t)],
    );
    f(role, [pt(ri, top, x), pt(ro, top, x), pt(ro, top, z), pt(ri, top, z)], [0, 1, 0]);
    f(
      role,
      [pt(ri, bottom, x), pt(ro, bottom, x), pt(ro, bottom, z), pt(ri, bottom, z)],
      [0, -1, 0],
    );
  }
  for (const [t, sign] of [
    [a, -1],
    [b, 1],
  ])
    f(
      role,
      [pt(ri, bottom, t), pt(ro, bottom, t), pt(ro, top, t), pt(ri, top, t)],
      [-Math.sin(t) * sign, 0, Math.cos(t) * sign],
    );
}
function prism(f, p, bottom, top) {
  for (const t of p.triangles)
    f(
      'brick',
      t.map((v) => [v[0], top, v[1]]),
      [0, 1, 0],
    );
  for (const ring of [p.outline, ...p.holes])
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      f(
        'brick',
        [
          [a[0], bottom, a[1]],
          [b[0], bottom, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
}
export function buildVesta(f, d, r) {
  const Y = (y) => r.floorY + y,
    n = d === 0 ? 16 : d === 1 ? 24 : d === 2 ? 40 : 64,
    an = d === 0 ? 4 : d === 1 ? 8 : d === 2 ? 16 : 24;
  for (const floor of r.floors) {
    for (const t of floor.triangles)
      f(
        'rubble',
        t.map((p) => [p[0], floor.height, p[1]]),
        [0, 1, 0],
      );
    for (let i = 0; i < floor.outline.length; i++) {
      const a = floor.outline[i],
        b = floor.outline[(i + 1) % floor.outline.length];
      f(
        'rubble',
        [
          [a[0], floor.height, a[1]],
          [b[0], floor.height, b[1]],
          [b[0], r.foundationBase, b[1]],
          [a[0], r.foundationBase, a[1]],
        ],
        [b[1] - a[1], 0, a[0] - b[0]],
      );
    }
  }
  lathe(
    f,
    'brick',
    r.center,
    d === 0
      ? [
          [Y(0.02), 7.2],
          [Y(2.05), 6.9],
        ]
      : [
          [Y(0.02), 7.2],
          [Y(0.18), 7.2],
          [Y(0.18), 7.03],
          [Y(0.42), 7.03],
          [Y(1.84), 6.9],
          [Y(2.05), 6.9],
        ],
    n,
  );
  lathe(f, 'ground', r.center, [[Y(2.07), 4.18]], n);
  for (const w of r.walls) for (const p of w.polygons) prism(f, p, Y(2.05), Y(2.05 + w.height));
  arc(f, 'marble', r.center, r.wallArcStart, r.wallArcEnd, 4.15, 4.8, Y(2.05), Y(9.2), an);
  arc(f, 'marble', r.center, r.arcStart - 0.035, r.arcEnd + 0.035, 3.95, 6.05, Y(9.2), Y(9.62), an);
  if (d > 0) {
    arc(
      f,
      'marble',
      r.center,
      r.arcStart - 0.035,
      r.arcEnd + 0.035,
      3.98,
      6.1,
      Y(9.62),
      Y(9.85),
      an,
    );
    arc(
      f,
      'marble',
      r.center,
      r.arcStart - 0.045,
      r.arcEnd + 0.04,
      3.85,
      6.22,
      Y(9.85),
      Y(10.12),
      an,
    );
    arc(f, 'marble', r.center, r.arcStart + 0.1, r.arcEnd - 0.12, 4, 6.18, Y(10.12), Y(10.35), an);
  } else
    arc(
      f,
      'marble',
      r.center,
      r.arcStart - 0.035,
      r.arcEnd + 0.035,
      3.95,
      6.18,
      Y(9.62),
      Y(10.35),
      an,
    );
  if (d >= 2)
    for (let i = 0; i < (d >= 3 ? 22 : 12); i++) {
      const a = r.arcStart + ((r.arcEnd - r.arcStart) * (i + 0.5)) / (d >= 3 ? 22 : 12);
      box(
        f,
        'marble',
        r.center[0] + 6.12 * Math.cos(a),
        Y(9.68),
        r.center[1] + 6.12 * Math.sin(a),
        0.2,
        0.17,
        0.23,
        a,
      );
    }
  for (const col of r.columns) {
    const p = col.point,
      top = col.full ? r.shaftTop : 3.35,
      cn = d === 0 ? 6 : d === 1 ? 12 : d === 2 ? 24 : 60;
    lathe(
      f,
      'marble',
      p,
      d === 0
        ? [
            [Y(2.05), 0.42],
            [Y(2.35), 0.31],
          ]
        : [
            [Y(2.05), 0.45],
            [Y(2.16), 0.45],
            [Y(2.2), 0.34],
            [Y(2.3), 0.38],
            [Y(2.35), 0.3],
          ],
      d === 0 ? 6 : 12,
    );
    lathe(
      f,
      'marble',
      p,
      [
        [Y(2.35), 0.29],
        [Y(top), 0.235],
      ],
      cn,
      { flutes: d >= 2 },
    );
    if (!col.full) continue;
    lathe(
      f,
      'marble',
      p,
      [
        [Y(8.55), 0.25],
        [Y(8.7), 0.34],
        [Y(9.05), 0.46],
        [Y(9.2), 0.49],
      ],
      d === 0 ? 4 : d === 1 ? 8 : 12,
    );
    if (d >= 2)
      for (let j = 0; j < (d >= 3 ? 2 : 1); j++)
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4 + (j * Math.PI) / 8,
            rx = p[0] + Math.cos(a) * (0.29 + j * 0.04),
            rz = p[1] + Math.sin(a) * (0.29 + j * 0.04);
          lathe(
            f,
            'marble',
            [rx, rz],
            [
              [Y(8.62 + j * 0.2), 0.05],
              [Y(8.81 + j * 0.2), 0.14],
              [Y(8.96 + j * 0.2), 0.05],
            ],
            4,
          );
        }
    if (d > 0) box(f, 'marble', p[0], Y(9.13), p[1], 0.98, 0.12, 0.98);
  }
  if (d > 0) {
    arc(f, 'marble', r.center, r.arcStart - 0.1, r.arcEnd + 0.05, 6.91, 7.04, Y(0.3), Y(1.84), an);
    for (const col of r.columns) {
      const a = Math.atan2(col.point[1] - r.center[1], col.point[0] - r.center[0]),
        x = r.center[0] + 7.03 * Math.cos(a),
        z = r.center[1] + 7.03 * Math.sin(a);
      box(f, 'marble', x, Y(0.25), z, 0.58, 1.65, 0.2, a);
    }
  }
  if (d >= 2)
    for (const a of [r.wallArcStart + 0.02, r.wallArcEnd - 0.02]) {
      const p = [r.center[0] + 4.12 * Math.cos(a), r.center[1] + 4.12 * Math.sin(a)];
      lathe(
        f,
        'marble',
        p,
        [
          [Y(2.1), 0.32],
          [Y(8.7), 0.25],
        ],
        d >= 3 ? 24 : 12,
        { flutes: true },
      );
      lathe(
        f,
        'marble',
        p,
        [
          [Y(8.7), 0.27],
          [Y(9.17), 0.42],
        ],
        8,
      );
    }
}

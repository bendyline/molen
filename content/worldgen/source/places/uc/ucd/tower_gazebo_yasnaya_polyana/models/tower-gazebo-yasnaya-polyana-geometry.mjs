/** Open timber lookout with a separate stair and thin green pyramid roof. */
import { box } from '../../../../../../../../packages/worldgen/scripts/khmer-structure-geometry.mjs';

export function buildTowerGazebo(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    cross = (a, b) => [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ],
    unit = (a) => a.map((v) => v / Math.hypot(...a)),
    beam = (a, b, w, d = w, role = 'wood') => {
      const t = unit(b.map((v, i) => v - a[i])),
        u = unit(cross(t, Math.abs(t[1]) < 0.9 ? [0, 1, 0] : [0, 0, 1])),
        v = cross(t, u),
        corners = (p) =>
          [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ].map(([s, q]) => p.map((x, i) => x + (s * u[i] * w) / 2 + (q * v[i] * d) / 2)),
        aa = corners(a),
        bb = corners(b);
      f(
        role,
        aa,
        t.map((x) => -x),
      );
      f(role, bb, t);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4,
          n = unit(aa[i].map((x, k) => (x + aa[j][k]) / 2 - a[k]));
        f(role, [aa[i], aa[j], bb[j], bb[i]], n);
      }
    },
    post = (p) => {
      const sides = detail === 3 ? 12 : detail >= 1 ? 8 : 6,
        radius = 0.09,
        S = (i, y) => [
          p.center[0] + radius * Math.cos((i * 2 * Math.PI) / sides),
          y,
          p.center[1] + radius * Math.sin((i * 2 * Math.PI) / sides),
        ];
      for (let i = 0; i < sides; i++) {
        const angle = ((i + 0.5) * 2 * Math.PI) / sides;
        f(
          'wood',
          [S(i, p.bottom), S(i + 1, p.bottom), S(i + 1, p.top), S(i, p.top)],
          [Math.cos(angle), 0, Math.sin(angle)],
        );
      }
      for (const [y, sign] of [
        [p.bottom, -1],
        [p.top, 1],
      ])
        f(
          'wood',
          Array.from({ length: sides }, (_, i) => S(i, y)),
          [0, sign, 0],
        );
      if (detail >= 2)
        for (const [y, side] of [
          [0.8, 1],
          [1.6, -1],
          [3.8, 1],
        ]) {
          const x = p.center[0] + side * 0.091,
            z = p.center[1];
          f(
            'bark',
            [
              [x, y, z - 0.025],
              [x, y, z + 0.025],
              [x, y + 0.14, z + 0.02],
              [x, y + 0.11, z - 0.02],
            ],
            [side, 0, 0],
          );
        }
    },
    Y = r.floorY;
  for (const p of r.posts) post(p);
  // The roof overhang is lower than its inner bearing ring; seat the ring on the posts.
  const bearingY = r.posts[0].top - 0.055;
  for (let i = 0; i < 4; i++) {
    const a = r.posts[i].center,
      b = r.posts[(i + 1) % 4].center;
    beam([a[0], bearingY, a[1]], [b[0], bearingY, b[1]], 0.11, 0.11);
  }
  box(f, 'wood', 0, Y - 0.14, 0, r.platformSize, 0.14, r.platformSize);
  for (const z of [-1, 1]) {
    beam([-1, Y - 0.19, z], [1, Y - 0.19, z], 0.14, 0.17);
    for (const sign of [-1, 1]) beam([sign, Y - 0.85, z], [sign * 0.3, Y - 0.14, z], 0.085);
  }
  // Five rail panels leave the stair entry genuinely open at the front.
  const panels = [
    [
      [-1, -1],
      [1, -1],
    ],
    [
      [-1, -1],
      [-1, 1],
    ],
    [
      [1, -1],
      [1, 1],
    ],
    [
      [-1, 1],
      [-0.5, 1],
    ],
    [
      [0.5, 1],
      [1, 1],
    ],
  ];
  for (const [a, b] of panels) {
    for (const y of [0.12, 1.02])
      beam([a[0], Y + y, a[1]], [b[0], Y + y, b[1]], y > 0.5 ? 0.08 : 0.06);
    if (detail) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        count = Math.max(1, Math.round(L * (detail === 3 ? 3.5 : detail === 2 ? 3 : 2)));
      for (let i = 0; i < count; i++) {
        const q = (i + 0.5) / count,
          x = a[0] + q * (b[0] - a[0]),
          z = a[1] + q * (b[1] - a[1]);
        box(f, 'wood', x, Y + 0.13, z, 0.04, 0.87, 0.04);
      }
    }
  }
  for (const x of [-0.5, 0.5]) {
    box(f, 'wood', x, Y - 0.1, 1.02, 0.075, 1.18, 0.075);
    beam([x, r.stairBase - 0.12, r.stairFoot[1]], [x, Y - 0.12, 1.0], 0.1, 0.16);
    beam([x, r.stairBase + 0.97, r.stairFoot[1]], [x, Y + 1.02, 1.02], 0.07);
    if (detail) beam([x, r.stairBase + 0.48, r.stairFoot[1]], [x, Y + 0.5, 1.02], 0.045);
    for (const q of detail ? [0, 0.5] : [0]) {
      const z = r.stairFoot[1] - q * r.run,
        y = r.stairBase + q * (Y - r.stairBase);
      box(f, 'wood', x, y - 0.16, z, 0.07, 1.16, 0.07);
    }
  }
  const step = r.run / r.treads,
    rise = (Y - r.stairBase) / r.treads;
  for (let i = 0; i < r.treads; i++) {
    const z = r.stairFoot[1] - (i + 0.5) * step,
      top = r.stairBase + (i + 1) * rise;
    box(f, 'wood', 0, top - 0.085, z, r.stairWidth, 0.085, step * 0.95);
  }
  const h = r.roofRadius,
    e = r.eaveY,
    peak = [0, r.roofY, 0],
    corners = [
      [-h, e, -h],
      [h, e, -h],
      [h, e, h],
      [-h, e, h],
    ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i],
      b = corners[(i + 1) % 4],
      n = unit(
        cross(
          b.map((v, k) => v - a[k]),
          peak.map((v, k) => v - a[k]),
        ),
      ),
      normal = n[1] < 0 ? n.map((v) => -v) : n,
      ps = [a, b, peak],
      under = ps.map(([x, y, z]) => [x, y - 0.07, z]);
    f('roof', ps, normal);
    f(
      'roof',
      under,
      normal.map((v) => -v),
    );
    f('roof', [a, b, under[1], under[0]], [b[2] - a[2], 0, a[0] - b[0]]);
    if (detail) beam([a[0], e - 0.065, a[2]], [b[0], e - 0.065, b[2]], 0.09, 0.11);
    if (detail >= 2) {
      beam([a[0], e - 0.11, a[2]], [0, r.roofY - 0.11, 0], 0.07);
      // Restrained raised roof seams share the same green metal graph.
      const mid = a.map((v, k) => (v + b[k]) / 2);
      beam([mid[0], mid[1] + 0.009, mid[2]], [0, r.roofY + 0.009, 0], 0.018, 0.018, 'roof');
    }
  }
  if (detail >= 2)
    for (let x = -0.9; x < 1; x += 0.24)
      beam([x, Y + 0.005, -0.98], [x, Y + 0.005, 0.98], 0.012, 0.01);
}

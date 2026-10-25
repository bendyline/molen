/** 'holocaust_history_museum_yad_vashem': buried triangular museum, splayed west wings and integrated roof light. */
import { box, prism } from './khmer-structure-geometry.mjs';

export function buildYadHistory(face, detail, r) {
  const Y = r.floorY,
    P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n)),
    mean = (ps) => [0, 1, 2].map((k) => ps.reduce((s, p) => s + p[k] / ps.length, 0)),
    loft = (role, rings) => {
      f(role, rings[0], [-1, 0, 0]);
      f(role, rings.at(-1), [1, 0, 0]);
      for (let i = 1; i < rings.length; i++) {
        const a = rings[i - 1],
          b = rings[i],
          center = mean([...a, ...b]);
        for (let j = 0; j < a.length; j++) {
          const k = (j + 1) % a.length,
            ps = [a[j], b[j], b[k], a[k]],
            c = mean(ps);
          f(role, ps, [0, c[1] - center[1], c[2] - center[2]]);
        }
      }
    },
    width = (x, side) =>
      (side > 0 ? 5.4336 : 5.6) + ((x + 78.2563) / 176.3) * (side > 0 ? 0.84 : 0.83),
    section = (x, side, low = -0.35) => {
      const w = width(x, side),
        z = (y) => side * (w + (0.65 - w) * (y / 12.7));
      return [
        [x, Y + low, z(low)],
        [x, Y + 12.7, side * 0.65],
        [x, Y + 12.55, side * 0.25],
        [x, Y + low, z(low) - side * 0.38],
      ];
    },
    bar = (a, b, size = 0.12, role = 'frame') => {
      const delta = b.map((v, k) => v - a[k]),
        length = Math.hypot(...delta),
        u = delta.map((v) => v / length),
        reference = Math.abs(u[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0],
        cross = (p, q) => [
          p[1] * q[2] - p[2] * q[1],
          p[2] * q[0] - p[0] * q[2],
          p[0] * q[1] - p[1] * q[0],
        ],
        vv = cross(u, reference),
        norm = Math.hypot(...vv),
        v = vv.map((x) => ((x / norm) * size) / 2),
        w = cross(u, v),
        ring = (p) =>
          [
            [1, 1],
            [-1, 1],
            [-1, -1],
            [1, -1],
          ].map(([sv, sw]) => p.map((x, k) => x + sv * v[k] + sw * w[k]));
      const A = ring(a),
        B = ring(b);
      f(
        role,
        A,
        u.map((x) => -x),
      );
      f(role, B, u);
      for (let j = 0; j < 4; j++) {
        const k = (j + 1) % 4,
          ps = [A[j], B[j], B[k], A[k]],
          c = mean(ps),
          m = mean([a, b]);
        f(
          role,
          ps,
          c.map((x, k) => x - m[k]),
        );
      }
    };

  // Ground remains over the buried building. This foundation is restricted to the prism;
  // the western concrete wings intentionally cantilever over the falling hillside.
  for (const p of r.core) prism(f, 'floor', p, r.foundationY, Y, true);
  loft('wall', [section(-78.2563, -1), section(98.1, -1)]);
  for (const [x0, x1, low] of [
    [-78.2563, 70, -0.35],
    [70, 78, 3.2],
    [78, 98.1, -0.35],
  ])
    loft('wall', [section(x0, 1, low), section(x1, 1, low)]);
  const ridge = (x) => [
    [x, Y + 12.65, -0.65],
    [x, Y + 14.4, 0],
    [x, Y + 12.65, 0.65],
  ];
  loft('glass', [ridge(-78.2563), ridge(98.1)]);
  // Closed end glazing and side entrance are recessed behind the structural shells.
  const terminal = (x) => [
    [x, Y + 0.02, -6.1],
    [x, Y + 0.02, 6.1],
    [x, Y + 14.25, 0],
  ];
  loft('glass', [terminal(97.6), terminal(97.75)]);
  box(f, 'glass', 74, Y + 0.04, 2.55, 7.6, 3.02, 0.12);
  box(f, 'floor', 74, Y - 0.14, 4.45, 8, 0.18, 4.2);
  box(f, 'wall', 74, Y + 3.2, 3.6, 8, 0.25, 2.5);
  if (detail) {
    for (const x of [70.2, 74, 77.8]) box(f, 'frame', x, Y + 0.05, 2.7, 0.12, 3, 0.18);
    box(f, 'frame', 74, Y + 2.35, 2.71, 7.8, 0.12, 0.18);
  }

  // Curved wings are sampled from a few broad, deliberate planes at distance.
  const steps = [3, 5, 10, 16][detail],
    flare = (side) =>
      Array.from({ length: steps + 1 }, (_, i) => {
        const u = i / steps,
          x = -78.2563 - 25.05 * u,
          ease = u * u,
          outer = (side > 0 ? 5.4336 : 5.6) + (side > 0 ? 7.56 : 4.9) * ease,
          top = 0.65 + (side > 0 ? 5.35 : 4.65) * ease,
          h = 12.7 - 14 * u + 10.4 * u * u,
          bottom = -2.2 * ease;
        return [
          [x, Y + bottom, side * outer],
          [x, Y + h, side * top],
          [x, Y + h - 0.13, side * (top - 0.42)],
          [x, Y + bottom, side * (outer - 0.42)],
        ];
      }).toReversed();
  loft('wall', flare(1));
  loft('wall', flare(-1));
  prism(
    f,
    'floor',
    {
      outline: [
        [-99, -4.7],
        [-99, 4.7],
        [-85.5, 4.7],
        [-85.5, -4.7],
      ],
    },
    Y - 0.35,
    Y,
    true,
  );
  box(f, 'glass', -86.6, Y + 0.05, 0, 0.14, 3.8, 7.2);
  loft(
    'glass',
    [
      [-86.7, -86.55].map((x) => [
        [x, Y + 3.85, -3.6],
        [x, Y + 8.6, 0],
        [x, Y + 3.85, 3.6],
      ]),
    ].flat(),
  );
  if (detail) {
    for (const z of [-3.55, -1.2, 1.2, 3.55])
      box(f, 'frame', -86.46, Y + 0.05, z, 0.15, 3.85, 0.12);
    box(f, 'frame', -86.46, Y + 2.8, 0, 0.15, 0.13, 7.2);
    box(f, 'frame', -86.46, Y + 3.8, 0, 0.15, 0.13, 7.2);
    bar([-86.46, Y + 3.8, -3.6], [-86.46, Y + 8.6, 0]);
    bar([-86.46, Y + 8.6, 0], [-86.46, Y + 3.8, 3.6]);
    // Balcony rails stay broad panels at district distance; thin bars appear only nearby.
    box(f, 'glass', -98.8, Y + 0.08, 0, 0.08, 1.05, 9.2);
    box(f, 'frame', -98.8, Y + 1.14, 0, 0.14, 0.13, 9.4);
    for (const z of [-4.65, 4.65]) {
      box(f, 'glass', -92.1, Y + 0.08, z, 13.2, 1.05, 0.08);
      box(f, 'frame', -92.1, Y + 1.14, z, 13.4, 0.13, 0.14);
    }
  }
  // Repeated ridge frames explain the triangular light without private textures.
  const spacing = [0, 8, 3.2, 2.4][detail];
  if (spacing) {
    const n = Math.ceil(176.35 / spacing),
      thickness = detail === 1 ? 0.18 : 0.1;
    for (let i = 0; i <= n; i++) {
      const x = -78.2563 + (176.35 * i) / n;
      bar([x, Y + 12.66, -0.65], [x, Y + 14.42, 0], thickness);
      bar([x, Y + 14.42, 0], [x, Y + 12.66, 0.65], thickness);
      if (detail > 1 && i < n) {
        const xn = -78.2563 + (176.35 * (i + 1)) / n;
        bar([x, Y + 12.66, -0.65], [xn, Y + 14.42, 0], 0.075);
      }
    }
  }
  if (detail > 1) {
    // A short local approach, not an invented site road or a replacement for native terrain.
    box(f, 'floor', 74, Y - 0.2, 7.2, 8, 0.2, 2.2);
    for (const x of [70.1, 77.9]) {
      box(f, 'frame', x, Y + 1.02, 7.2, 0.12, 0.12, 2.3);
      for (const z of [6.2, 7.2, 8.2]) box(f, 'frame', x, Y, z, 0.1, 1.1, 0.1);
    }
  }
  // The Hall of Names is part of the same underground museum. Only its visible roof light
  // is modeled; its picture-led location is retained explicitly as an approximation.
  const h = r.hallNames,
    n = [8, 12, 20, 24][detail],
    at = (i, radius, y) => [
      h.center[0] + Math.cos((i * 2 * Math.PI) / n) * radius,
      y,
      h.center[1] + Math.sin((i * 2 * Math.PI) / n) * radius,
    ],
    lower = Array.from({ length: n }, (_, i) => at(i, h.radius, h.baseY)),
    upper = Array.from({ length: n }, (_, i) => at(i, h.radius * 0.68, h.baseY + h.height));
  prism(f, 'floor', { outline: lower.map((p) => [p[0], p[2]]) }, h.foundationY, h.baseY, true);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n,
      c = mean([lower[i], lower[j], upper[i], upper[j]]);
    f(
      'glass',
      [lower[i], lower[j], upper[j], upper[i]],
      [c[0] - h.center[0], 0.4, c[2] - h.center[1]],
    );
    if (detail > 1) bar(lower[i], upper[i], 0.1);
  }
  f('roof', upper, [0, 1, 0]);
}

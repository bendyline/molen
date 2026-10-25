/** 'omar_khayyam_mausoleum': ten paired stone ribbons, tiled diamonds and an open petal crown. */
import earcut from 'earcut';
import { normalFor } from './authored-structure-mesh.mjs';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildKhayyamRibbons(face, detail, r, sample) {
  const F = r.floorY,
    c = Math.cos(r.architecturalAngleRadians),
    s = Math.sin(r.architecturalAngleRadians),
    [cx, cz] = r.center,
    P = ([x, y, z]) => [cx + x * c - z * s, F + y, cz + x * s + z * c],
    f = (role, ps, n) => face(role, ps.map(P), [n[0] * c - n[2] * s, n[1], n[0] * s + n[2] * c]),
    grade = (x, z) => sample(cx + x * c - z * s, cz + x * s + z * c) - F;
  const radius = (y) => {
      const p = r.ribbonRadiusProfile;
      for (let i = 1; i < p.length; i++)
        if (y <= p[i][0]) {
          const t = (y - p[i - 1][0]) / (p[i][0] - p[i - 1][0]);
          return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
        }
      return p.at(-1)[1];
    },
    twist = (y) => (((y - 0.15) / 21.85) * Math.PI * 3) / 10,
    split = 0.15 + (21.85 * 2) / 3,
    bandWidth = 0.29,
    polar = (a, y, R) => [Math.cos(a) * R, y, Math.sin(a) * R],
    circle = (n) => (w) =>
      Array.from({ length: n }, (_, i) => [
        (Math.cos((i * Math.PI * 2) / n) * w) / 2,
        (Math.sin((i * Math.PI * 2) / n) * w) / 2,
      ]);
  const nFloor = [12, 24, 40, 48][detail],
    outline = circle(nFloor)(r.plazaRadius * 2),
    low =
      Math.min(
        ...Array.from({ length: 64 }, (_, i) =>
          grade(
            Math.cos((i * Math.PI) / 32) * r.plazaRadius,
            Math.sin((i * Math.PI) / 32) * r.plazaRadius,
          ),
        ),
      ) - 0.45;
  prism(f, 'base', { outline }, low, -0.025, false);
  prism(f, 'paving', { outline }, -0.025, 0, false);
  const regular = Array.from(
      { length: [5, 13, 25, 41][detail] },
      (_, i) => 0.15 + (i * 21.85) / [4, 12, 24, 40][detail],
    ),
    heights =
      detail === 0
        ? [0.15, 7.433333333333, split, 19.5, 22]
        : [...new Set([...regular, split, 19.5])].sort((a, b) => a - b);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5,
      co = Math.cos(a),
      si = Math.sin(a),
      foot = (role, ps, n) =>
        f(
          role,
          ps.map(([x, y, z]) => [
            (r.radius - 0.3) * co + x * co - z * si,
            y,
            (r.radius - 0.3) * si + x * si + z * co,
          ]),
          [n[0] * co - n[2] * si, n[1], n[0] * si + n[2] * co],
        );
    prism(
      foot,
      'base',
      detail === 0
        ? {
            outline: [
              [0.75, 0],
              [-0.65, 0.7],
              [-0.65, -0.7],
            ],
          }
        : rect(0, 0, 1.25, 1.1),
      0,
      0.15,
      false,
    );
    for (const hand of [-1, 1]) {
      const ring = (y) => {
        const R = radius(y),
          a0 = a + hand * twist(y),
          w = bandWidth / (2 * R),
          offset = hand * 0.008;
        return detail === 0
          ? [
              polar(a0 - w, y, R + 0.35 + offset),
              polar(a0 + w, y, R + 0.35 + offset),
              polar(a0, y, R - 0.35 + offset),
            ]
          : [
              polar(a0 - w, y, R + 0.35 + offset),
              polar(a0 + w, y, R + 0.35 + offset),
              polar(a0 + w, y, R - 0.35 + offset),
              polar(a0 - w, y, R - 0.35 + offset),
            ];
      };
      for (let j = 0; j < heights.length - 1; j++) {
        const p = ring(heights[j]),
          q = ring(heights[j + 1]),
          a0 = a + hand * twist((heights[j] + heights[j + 1]) / 2),
          R = [Math.cos(a0), 0, Math.sin(a0)],
          T = [-Math.sin(a0), 0, Math.cos(a0)];
        for (let k = 0; k < p.length; k++) {
          const next = (k + 1) % p.length,
            n =
              detail === 0
                ? k === 0
                  ? R
                  : k === 1
                    ? T
                    : T.map((v) => -v)
                : k === 0
                  ? R
                  : k === 1
                    ? T
                    : k === 2
                      ? R.map((v) => -v)
                      : T.map((v) => -v);
          f('stone', [p[k], p[next], q[next], q[k]], n);
        }
      }
      f('stone', ring(0.15), [0, -1, 0]);
      f('stone', ring(22), [0, 1, 0]);
    }
  }
  const half = (y) => {
    const t = twist(y),
      delta = y <= split ? Math.min(t, Math.PI / 5 - t) : t - Math.PI / 5;
    return Math.max(0, delta - (bandWidth / (2 * radius(y))) * 0.72);
  };
  // Lower filled diamonds and upper petals leave the observed elongated sky openings.
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5;
    for (const [start, end] of [
      [0.15, split],
      [split, 22],
    ]) {
      const ys =
          detail === 0
            ? start === 0.15
              ? [0.15, 7.433333333333, split]
              : [split, 19.5, 22]
            : [...new Set([start, ...heights.filter((y) => y > start && y < end), end])],
        across = [1, 2, 3, 4][detail];
      for (let j = 0; j < ys.length - 1; j++)
        for (let k = 0; k < across; k++) {
          const y0 = ys[j],
            y1 = ys[j + 1],
            t0 = -1 + (2 * k) / across,
            t1 = -1 + (2 * (k + 1)) / across,
            point = (y, t, d) => polar(a + half(y) * t, y, radius(y) + d),
            n = [Math.cos(a), 0, Math.sin(a)];
          f(
            'tile',
            [point(y0, t0, 0.18), point(y0, t1, 0.18), point(y1, t1, 0.18), point(y1, t0, 0.18)],
            n,
          );
          f(
            'tile',
            [
              point(y0, t0, -0.18),
              point(y0, t1, -0.18),
              point(y1, t1, -0.18),
              point(y1, t0, -0.18),
            ],
            n.map((v) => -v),
          );
          for (const t of across === 1 ? [-1, 1] : k === 0 ? [-1] : k === across - 1 ? [1] : [])
            f(
              'stone',
              [point(y0, t, -0.18), point(y0, t, 0.18), point(y1, t, 0.18), point(y1, t, -0.18)],
              [-Math.sin(a) * t, 0, Math.cos(a) * t],
            );
        }
    }
    // Original low-frequency floral/lozenge vocabulary; these are not copied letters.
    if (detail >= 2)
      for (const y of [2.8, 5.0, 7.2, 9.4, 11.6, 16.6, 18.4, 20.1]) {
        if (half(y) < 0.06) continue;
        for (const hand of [-1, 1])
          for (const side of [-1, 1]) {
            const A = a + half(y) * hand * 0.42,
              dy = y < 14 ? 0.55 : 0.35,
              da = Math.min(0.085, half(y) * 0.23),
              D = side * 0.225,
              at = (u, v) => polar(A + u, y + v, radius(y + v) + D),
              n = [Math.cos(A) * side, 0, Math.sin(A) * side];
            const leaf = [
              at(0, -dy),
              at(da * 0.65, -dy * 0.25),
              at(da, dy * 0.3),
              at(0, dy),
              at(-da, dy * 0.3),
              at(-da * 0.65, -dy * 0.25),
            ];
            f('ivory', leaf, n);
            // Seat the inset on one actual leaf facet, clear of the curved fan's seams.
            const normal = normalFor(leaf[0], leaf[1], leaf[2]);
            const sign = Math.sign(normal.reduce((v, q, k) => v + q * n[k], 0)) || 1;
            const inset = [
              [0.15, 0.7, 0.15],
              [0.15, 0.35, 0.5],
              [0.3, 0.2, 0.5],
              [0.3, 0.55, 0.15],
            ].map((weights) =>
              [0, 1, 2].map(
                (k) =>
                  weights.reduce((v, w, j) => v + w * leaf[j][k], 0) + normal[k] * sign * 0.004,
              ),
            );
            f('navy', inset, n);
            if (detail >= 3) {
              const cy = y + 0.8;
              if (cy < split - 0.4 || cy > split + 0.6) {
                const phi = a + hand * half(cy) * 0.25,
                  at2 = (u, v) => polar(phi + u, cy + v, radius(cy + v) + D);
                f('ochre', [at2(-0.025, 0), at2(0, 0.16), at2(0.025, 0), at2(0, -0.16)], n);
              }
            }
          }
      }
  }
  // Small closed central rosette surrounded by the genuinely open petal gaps.
  const star = Array.from({ length: 20 }, (_, i) => {
    const a = (i * Math.PI) / 10,
      R = i % 2 ? 0.31 : 0.55;
    return [Math.cos(a) * R, Math.sin(a) * R];
  });
  const cap = detail === 0 ? circle(5)(1.1) : star;
  prism(f, 'stone', { outline: cap }, 21.75, 22, false);
  const capIndices = earcut(cap.flat());
  for (let i = 0; i < capIndices.length; i += 3) {
    const points = capIndices.slice(i, i + 3).map((k) => [cap[k][0], 21.75, cap[k][1]]);
    f('tile', points, [0, -1, 0]);
    if (detail >= 2)
      f(
        'ivory',
        points.map(([x, _y, z]) => [x * 0.52, 21.747, z * 0.52]),
        [0, -1, 0],
      );
  }
  if (detail >= 2) {
    prism(f, 'ivory', { outline: circle(10)(0.65) }, 21.99, 22.008, false);
    for (let i = 0; i < (detail >= 2 ? 10 : 0); i++) {
      const a = (i * Math.PI) / 5,
        f2 = (role, ps, n) =>
          f(
            role,
            ps.map(([x, y, z]) => [
              x * Math.cos(a) - z * Math.sin(a),
              y,
              x * Math.sin(a) + z * Math.cos(a),
            ]),
            n,
          );
      f2(
        'tile',
        [
          [0.05, 22.011, 0],
          [0.18, 22.011, 0.07],
          [0.3, 22.011, 0],
          [0.18, 22.011, -0.07],
        ],
        [0, 1, 0],
      );
    }
  }
  // Pictured surrounding folded panels: repeated inventory/spacing is an explicit estimate.
  for (let i = 0; i < 10; i++) {
    const a = ((i + 0.5) * Math.PI) / 5,
      A = polar(a - 0.22, 0, r.plazaRadius - 0.45),
      B = polar(a, 3.0, r.plazaRadius - 0.35),
      C = polar(a + 0.22, 0, r.plazaRadius - 0.45),
      D = polar(a, 0, r.plazaRadius - 1.8),
      n = [-Math.cos(a), 0.3, -Math.sin(a)];
    f('stone', [A, B, D], n);
    f('stone', [D, B, C], n);
    f(
      'base',
      [A, C, B],
      n.map((v) => -v),
    );
    if (detail >= 1) f('base', [A, D, C], [0, -1, 0]);
  }
  box(f, 'grave', 0, 0, 0, 2.2, 0.3, 2.8);
  loft(
    f,
    'grave',
    0,
    0,
    [
      [0.3, 1],
      [1.3, 0.65],
      [1.6, 0.65],
    ],
    false,
    (k) => rect(0, 0, 1.8 * k, 2.4 * k).outline,
  );
}

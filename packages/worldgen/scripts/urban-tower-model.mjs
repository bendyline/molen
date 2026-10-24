/** st_urban_tower: restored square belfry, flared pyramid and open rounded-corner arcade. */
import earcut from 'earcut';
import { box, loft, prism, rect } from './khmer-structure-geometry.mjs';

export function buildUrbanTower(face, detail, r, sample) {
  const P = ([x, y, z]) => [
      r.center[0] + x * r.xAxis[0] + z * r.zAxis[0],
      y,
      r.center[1] + x * r.xAxis[1] + z * r.zAxis[1],
    ],
    D = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), D(n)),
    F = r.floorY,
    ground = (x, z) => {
      const p = P([x, 0, z]);
      return sample(p[0], p[2]);
    },
    polygon = (role, rings, map, n) => {
      const ps = rings.flat(),
        holes = [];
      let k = rings[0].length;
      for (const h of rings.slice(1)) {
        holes.push(k);
        k += h.length;
      }
      const ix = earcut(ps.flat(), holes);
      for (let i = 0; i < ix.length; i += 3)
        f(
          role,
          ix.slice(i, i + 3).map((j) => map(ps[j])),
          n,
        );
    },
    solid = (role, rings, back, front, map, n, u) => {
      polygon(role, rings, (p) => map(p, front), n);
      polygon(
        role,
        rings,
        (p) => map(p, back),
        n.map((v) => -v),
      );
      for (let k = 0; k < rings.length; k++) {
        const ps = rings[k],
          sign =
            Math.sign(
              ps.reduce(
                (s, p, i) =>
                  s + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
                0,
              ),
            ) * (k ? -1 : 1);
        for (let i = 0; i < ps.length; i++) {
          const a = ps[i],
            b = ps[(i + 1) % ps.length],
            s = (b[1] - a[1]) * sign,
            y = (a[0] - b[0]) * sign;
          f(
            role,
            [map(a, back), map(b, back), map(b, front), map(a, front)],
            [u[0] * s, y, u[2] * s],
          );
        }
      }
    },
    arch = (center, width, bottom, spring, n) => {
      const R = width / 2,
        ps = [
          [center - R, bottom],
          [center + R, bottom],
          [center + R, spring],
        ];
      for (let i = 1; i <= n; i++) {
        const a = (i * Math.PI) / n;
        ps.push([center + R * Math.cos(a), spring + R * Math.sin(a)]);
      }
      return ps;
    },
    edges = (ps) => {
      const sign = Math.sign(
        ps.reduce(
          (s, p, i) => s + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
          0,
        ),
      );
      return ps.map((a, i) => {
        const b = ps[(i + 1) % ps.length],
          len = Math.hypot(b[0] - a[0], b[1] - a[1]),
          u = [(b[0] - a[0]) / len, 0, (b[1] - a[1]) / len],
          n = [u[2] * sign, 0, -u[0] * sign];
        return {
          a,
          b,
          len,
          u,
          n,
          map: ([s, y], d) => [a[0] + u[0] * s + n[0] * d, F + y, a[1] + u[2] * s + n[2] * d],
        };
      });
    },
    roofY = ([x, z]) =>
      F +
      Math.max(
        3.35,
        5 -
          0.62 *
            Math.hypot(
              Math.max(0, Math.abs(x) - r.width / 2),
              Math.max(0, Math.abs(z) - r.depth / 2),
            ),
      );
  prism(
    f,
    'stone',
    { outline: r.body, holes: [] },
    Math.min(...r.body.map((p) => ground(...p))) - 0.4,
    F + 0.1,
  );
  prism(f, 'wall', { outline: r.body, holes: [] }, F + 0.1, F + 24.5);
  for (const edge of edges(r.body)) {
    const { len, map, n, u } = edge,
      opening = arch(len / 2, 2.0, 26.2, 28.4, detail === 0 ? 3 : detail === 1 ? 5 : 10),
      outer = [
        [0, 24.5],
        [len, 24.5],
        [len, 31.8],
        [0, 31.8],
      ];
    solid('wall', [outer, opening], -0.78, 0, map, n, u);
    if (detail > 0) {
      const frame = arch(len / 2, 2.45, 26.1, 28.4, detail === 1 ? 5 : 10);
      solid('stone', [frame, opening], 0.005, 0.13, map, n, u);
      for (const y of [8.0, 15.5, 21.5]) {
        const hole = arch(len / 2, 0.72, y, y + 0.85, detail === 1 ? 3 : 6),
          frame = arch(len / 2, 1.04, y - 0.12, y + 0.85, detail === 1 ? 3 : 6);
        solid('stone', [frame, hole], 0.005, 0.12, map, n, u);
        solid('panel', [hole], 0.025, 0.04, map, n, u);
        solid(
          'stone',
          [
            [
              [len / 2 - 0.65, y + 1.3],
              [len / 2 + 0.65, y + 1.3],
              [len / 2 + 0.65, y + 1.47],
              [len / 2 - 0.65, y + 1.47],
            ],
          ],
          0.01,
          0.16,
          map,
          n,
          u,
        );
      }
      if (detail > 1)
        for (const y of [11.3, 19.2, 24.55])
          solid(
            'stone',
            [
              [
                [0, y],
                [len, y],
                [len, y + 0.17],
                [0, y + 0.17],
              ],
            ],
            0.005,
            0.15,
            map,
            n,
            u,
          );
      const count = detail === 1 ? 2 : 3,
        N = detail === 1 ? 6 : 10;
      for (let j = 0; j < count; j++) {
        const s = (len * (j + 1)) / (count + 1),
          cy = 30.75,
          ellipse = (a, b) =>
            Array.from({ length: N }, (_, i) => [
              s + a * Math.cos((i * Math.PI * 2) / N),
              cy + b * Math.sin((i * Math.PI * 2) / N),
            ]);
        solid('stone', [ellipse(0.65, 0.38), ellipse(0.48, 0.25)], 0.01, 0.1, map, n, u);
        if (detail > 1) solid('panel', [ellipse(0.43, 0.2)], 0.015, 0.025, map, n, u);
      }
    }
  }
  for (const [y, h, margin] of [
    [30.0, 0.16, 0.12],
    [31.6, 0.24, 0.25],
    [31.84, 0.26, 0.45],
  ])
    box(f, 'stone', 0, F + y, 0, r.width + margin, h, r.depth + margin);
  const profiles =
      detail === 0
        ? [
            [32.1, r.width + 0.65],
            [34.1, r.width - 0.75],
            [42.2, 0.18],
          ]
        : [
            [32.1, r.width + 0.65],
            [32.65, r.width + 0.15],
            [34.1, r.width - 1.0],
            [38.1, r.width * 0.46],
            [42.2, 0.18],
          ],
    shape = (w) => rect(0, 0, w, (w * r.depth) / r.width).outline;
  loft(
    f,
    'roof',
    0,
    0,
    profiles.map(([y, w]) => [F + y, w]),
    false,
    shape,
  );
  const roofWidthAt = (y) => {
    for (let i = 0; i < profiles.length - 1; i++) {
      const a = profiles[i],
        b = profiles[i + 1];
      if (y <= b[0]) return a[1] + ((b[1] - a[1]) * (y - a[0])) / (b[0] - a[0]);
    }
    return 0.18;
  };
  if (detail > 1)
    f(
      'panel',
      [
        [-roofWidthAt(35.3) / 2 - 0.025, F + 35.3, -0.65],
        [-roofWidthAt(35.3) / 2 - 0.025, F + 35.3, 0.65],
        [-roofWidthAt(35.6) / 2 - 0.025, F + 35.6, 0.65],
        [-roofWidthAt(35.6) / 2 - 0.025, F + 35.6, -0.65],
      ],
      [-1, 0.2, 0],
    );
  const n = detail === 0 ? 6 : 8;
  loft(
    f,
    'metal',
    0,
    0,
    [
      [F + 42.2, 0.1],
      [F + 42.45, 0.48],
      [F + 42.7, 0.62],
      [F + 42.95, 0.43],
      [F + 43.05, 0.1],
    ],
    false,
    (w) =>
      Array.from({ length: n }, (_, i) => [
        (w / 2) * Math.cos((i * Math.PI * 2) / n),
        (w / 2) * Math.sin((i * Math.PI * 2) / n),
      ]),
  );
  box(f, 'panel', 0, F + 43.05, 0, 0.07, 0.95, 0.07);
  box(f, 'panel', 0, F + 43.55, 0, 0.6, 0.07, 0.07);

  // The five mapped arcade pieces supply narrow occupied floors and closed sloping roofs.
  for (const part of r.arcades) {
    prism(
      f,
      'stone',
      { outline: part.outline, holes: [] },
      Math.min(...part.outline.map((p) => ground(...p))) - 0.28,
      F + 0.06,
    );
    polygon('tile', [part.outline], ([x, z]) => [x, roofY([x, z]), z], [0, 1, 0]);
    polygon('stone', [part.outline], ([x, z]) => [x, F + 3.24, z], [0, -1, 0]);
    const ps = part.outline,
      sign = Math.sign(
        ps.reduce(
          (s, p, i) => s + p[0] * ps[(i + 1) % ps.length][1] - p[1] * ps[(i + 1) % ps.length][0],
          0,
        ),
      );
    for (let i = 0; i < ps.length; i++) {
      const a = ps[i],
        b = ps[(i + 1) % ps.length];
      f(
        'stone',
        [
          [a[0], F + 3.24, a[1]],
          [b[0], F + 3.24, b[1]],
          [b[0], roofY(b), b[1]],
          [a[0], roofY(a), a[1]],
        ],
        [(b[1] - a[1]) * sign, 0, (a[0] - b[0]) * sign],
      );
    }
  }
  for (const edge of edges(r.outer)) {
    const { a, b, len, map, n, u } = edge;
    // This central western edge is the core's portal wall, not an arcade facade.
    if (
      n[0] < -0.8 &&
      Math.abs((a[0] + b[0]) / 2 + r.width / 2) < 0.2 &&
      Math.abs((a[1] + b[1]) / 2) < r.depth / 2 - 0.5
    )
      continue;
    const count = len > 6 ? (detail === 0 ? 2 : 4) : len > 1.3 ? 1 : 0,
      holes = [];
    for (let j = 0; j < count; j++) {
      const width = Math.min((len / count) * 0.72, len > 6 ? 2.4 : 0.85),
        spring = len > 6 ? 1.75 : 2.0;
      holes.push(
        arch(
          (len * (j + 0.5)) / count,
          width,
          0.04,
          spring,
          detail === 0 ? 2 : detail === 1 ? 4 : 8,
        ),
      );
    }
    const topA = roofY(a) - F - 0.12,
      topB = roofY(b) - F - 0.12;
    solid(
      'wall',
      [
        [
          [0, -0.5],
          [len, -0.5],
          [len, topB],
          [0, topA],
        ],
        ...holes,
      ],
      -0.32,
      0,
      map,
      n,
      u,
    );
    if (detail > 1)
      for (const h of holes) {
        const width = Math.max(...h.map((p) => p[0])) - Math.min(...h.map((p) => p[0])),
          s = (h[0][0] + h[1][0]) / 2,
          outer = arch(s, width + 0.18, 0.04, h[2][1], 8);
        solid('stone', [outer, h], 0.005, 0.085, map, n, u);
      }
  }
  if (detail > 0) {
    const edge = edges(r.body).find((e) => e.n[0] < -0.8),
      { len, map, n, u } = edge,
      s = len / 2,
      outer = arch(s, 2.25, 0.06, 2.1, detail === 1 ? 4 : 8),
      inner = arch(s, 1.7, 0.06, 2.1, detail === 1 ? 4 : 8);
    solid('stone', [outer, inner], 0.02, 0.32, map, n, u);
    solid('panel', [inner], 0.04, 0.06, map, n, u);
    const pediment = [
      [s - 1.4, 2.7],
      [s + 1.4, 2.7],
      [s + 1.4, 3.05],
      [s + 0.8, 3.65],
      [s + 0.55, 5.7],
      [s + 1.0, 5.9],
      [s, 6.4],
      [s - 1.0, 5.9],
      [s - 0.55, 5.7],
      [s - 0.8, 3.65],
      [s - 1.4, 3.05],
    ];
    solid('stone', [pediment], 0.01, 0.25, map, n, u);
  }
}

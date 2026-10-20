/** 'N0532', 'N0536': Reusable original metric Corinthian bases, flutes, leafy capitals and volutes. */
import { prism, rect } from './khmer-structure-geometry.mjs';

function lathe(f, role, x, z, profile, n, flutes = 0) {
  const rings = profile.map(([y, r]) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i * Math.PI * 2) / n,
        rr = r * (1 - (flutes ? (0.065 * (1 + Math.cos(a * flutes))) / 2 : 0));
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
const B = (f, role, x, y, z, w, h, d) => prism(f, role, rect(x, z, w, d), y, y + h);
function acanthus(f, angle, y, detail) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    shape = [
      [-0.22, 0, 1.03],
      [0.22, 0, 1.03],
      [-0.37, 0.55, 1.45],
      [0.37, 0.55, 1.45],
      [0, 1.15, 1.7],
      [0, 0.7, 1.57],
    ],
    p = shape.map(([u, v, r]) => [c * r - s * u, y + v, s * r + c * u]);
  for (const ix of detail === 0
    ? [
        [0, 1, 4],
        [0, 4, 2],
        [1, 3, 4],
      ]
    : [
        [0, 1, 5],
        [1, 3, 5],
        [3, 4, 5],
        [4, 2, 5],
        [2, 0, 5],
        [0, 2, 4, 3, 1],
      ])
    f(
      'column',
      ix.map((i) => p[i]),
      [c, 0.25, s],
    );
}
export function buildCorinthianColumn(f, x, z, detail, Y) {
  const G = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [x + u, Y + y, z + v]),
        n,
      ),
    n = [8, 16, 24, 32][detail];
  B(G, 'column', 0, 0, 0, 2.3, 0.22, 2.3);
  lathe(
    G,
    'column',
    0,
    0,
    detail === 0
      ? [
          [0.22, 0.97],
          [0.7, 0.8],
        ]
      : [
          [0.22, 0.93],
          [0.3, 1.04],
          [0.4, 1.04],
          [0.48, 0.88],
          [0.58, 0.86],
          [0.65, 0.96],
          [0.74, 0.8],
        ],
    n,
  );
  const shaft =
    detail === 0
      ? [
          [0.7, 0.785],
          [13.2, 0.66],
        ]
      : detail === 1
        ? [
            [0.74, 0.785],
            [5, 0.79],
            [10, 0.73],
            [13.2, 0.66],
          ]
        : [
            [0.74, 0.785],
            [0.86, 0.79],
            [3.5, 0.8],
            [7, 0.77],
            [10.8, 0.71],
            [13.2, 0.66],
          ];
  lathe(
    G,
    'shaft',
    0,
    0,
    shaft,
    [8, 24, 72, 96][detail],
    detail === 0 ? 0 : detail === 1 ? 12 : 24,
  );
  lathe(
    G,
    'column',
    0,
    0,
    detail === 0
      ? [
          [13.2, 0.67],
          [15.03, 1.08],
        ]
      : [
          [13.2, 0.67],
          [13.35, 0.76],
          [13.5, 0.7],
          [14.25, 0.79],
          [14.88, 1.08],
          [15.03, 1.08],
        ],
    n,
  );
  if (detail >= 1)
    for (const upper of [false, true])
      for (let k = 0; k < 8; k++)
        acanthus(
          (role, ps, target) =>
            G(
              role,
              ps.map(([u, y, v]) => [u * 0.66, 13.32 + (upper ? 0.58 : 0) + y * 0.7, v * 0.66]),
              [target[0] / 0.66, target[1] / 0.7, target[2] / 0.66],
            ),
          (k * Math.PI) / 4 + (upper ? Math.PI / 8 : 0),
          0,
          detail,
        );
  const cap =
    detail <= 1
      ? rect(0, 0, 2.6, 2.6)
      : {
          outline: [
            [-1.3, -1.3],
            [0, -1.0],
            [1.3, -1.3],
            [1.0, 0],
            [1.3, 1.3],
            [0, 1.0],
            [-1.3, 1.3],
            [-1.0, 0],
          ],
          holes: [],
        };
  prism(G, 'column', cap, 15.02, 15.2);
  if (detail >= 2)
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4,
        c = Math.cos(a),
        s = Math.sin(a),
        count = detail === 3 ? 10 : 6,
        ps = Array.from({ length: count }, (_, j) => {
          const t = j / (count - 1),
            theta = t * Math.PI * 2.1,
            r = 0.24 * (1 - t) + 0.025;
          return [
            1.01 * c - r * Math.cos(theta) * s,
            14.86 + r * Math.sin(theta),
            1.01 * s + r * Math.cos(theta) * c,
          ];
        });
      for (let j = 0; j < ps.length - 1; j++) {
        const a = ps[j],
          b = ps[j + 1];
        G(
          'column',
          [
            [a[0], a[1] - 0.025, a[2]],
            [b[0], b[1] - 0.025, b[2]],
            [b[0], b[1] + 0.025, b[2]],
            [a[0], a[1] + 0.025, a[2]],
          ],
          [c, 0, s],
        );
      }
    }
}

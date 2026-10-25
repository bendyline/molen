/** Shared metric hipped tile roof with restrained swept eaves and original ridge tips. */
import { box, loft } from './khmer-structure-geometry.mjs';

export function buildChineseHipRoof(
  f,
  { x, z, width, depth, low, rise, angle = 0 },
  detail,
  role = 'roof',
) {
  const c = Math.cos(angle),
    s = Math.sin(angle),
    at = (role, ps, n) =>
      f(
        role,
        ps.map(([u, y, v]) => [x + c * u - s * v, y, z + s * u + c * v]),
        [c * n[0] - s * n[2], n[1], s * n[0] + c * n[2]],
      ),
    ridge = Math.max(0.35, width - depth * 0.66);
  const profile =
    detail === 0
      ? [
          [low, width + 0.8, depth + 0.8],
          [low + rise, ridge, 0.12],
        ]
      : detail === 1
        ? [
            [low, width + 1.2, depth + 1.2],
            [low + rise * 0.44, width - 0.1, depth * 0.68],
            [low + rise, ridge, 0.12],
          ]
        : [
            [low, width + 1.3, depth + 1.3],
            [low + rise * 0.22, width + 0.7, depth * 0.91],
            [low + rise * 0.76, width - depth * 0.35, depth * 0.28],
            [low + rise, ridge, 0.12],
          ];
  const rings = profile.map(([y, w, d], k) => {
    const points =
      detail === 0
        ? [
            [-w / 2, -d / 2],
            [w / 2, -d / 2],
            [w / 2, d / 2],
            [-w / 2, d / 2],
          ]
        : [
            [-w / 2, -d / 2],
            [0, -d / 2],
            [w / 2, -d / 2],
            [w / 2, 0],
            [w / 2, d / 2],
            [0, d / 2],
            [-w / 2, d / 2],
            [-w / 2, 0],
          ];
    return points.map(([u, v], i) => [u, y + (detail > 0 && k === 0 && i % 2 === 0 ? 0.34 : 0), v]);
  });
  for (let k = 0; k < rings.length - 1; k++)
    for (let i = 0; i < rings[k].length; i++) {
      const j = (i + 1) % rings[k].length,
        a = rings[k][i],
        b = rings[k][j];
      at(role, [a, b, rings[k + 1][j], rings[k + 1][i]], [b[2] - a[2], 1, a[0] - b[0]]);
    }
  // Fan caps avoid triangulation assumptions when the eave corners turn upward.
  for (const [ring, n] of [
    [rings[0], [0, -1, 0]],
    [rings.at(-1), [0, 1, 0]],
  ]) {
    if (n[1] > 0) {
      at(role, detail === 0 ? ring : ring.filter((_, i) => i % 2 === 0), n);
      continue;
    }
    const center = [0, ring.reduce((sum, p) => sum + p[1], 0) / ring.length, 0];
    for (let i = 0; i < ring.length; i++)
      at(role, [center, ring[i], ring[(i + 1) % ring.length]], n);
  }
  if (detail > 0) {
    box(at, role, 0, low + rise, 0, ridge + 0.18, 0.14, 0.24);
    if (detail >= 2)
      for (const side of [-1, 1])
        loft(
          at,
          role,
          (side * ridge) / 2,
          0,
          [
            [low + rise, 0.3],
            [low + rise + 0.18, 0.22],
            [low + rise + 0.4, 0.08],
          ],
          true,
        );
  }
}

/** 'N0765_EASTLATRINE': exact octagonal latrine masonry, open center and west entrance gap. */
import './install-deterministic-math.mjs';
import earcut from 'earcut';
import { prism } from './khmer-structure-geometry.mjs';

export function buildCasaleEastLatrine(face, detail, r) {
  const P = ([x, y, z]) => [x * r.xAxis[0] + z * r.zAxis[0], y, x * r.xAxis[1] + z * r.zAxis[1]],
    f = (role, ps, n) => face(role, ps.map(P), P(n));
  function brokenMass(outline, center, baseY, topY, seed) {
    const perimeter = [];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i],
        b = outline[(i + 1) % outline.length],
        count =
          detail === 0
            ? 1
            : Math.max(
                1,
                Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / [1, 1.2, 0.7, 0.42][detail]),
              );
      for (let j = 0; j < count; j++) perimeter.push(a.map((v, k) => v + ((b[k] - v) * j) / count));
    }
    const height = topY - baseY,
      profile =
        detail === 0
          ? [
              [0, 1],
              [1, 0.9888],
            ]
          : detail === 1
            ? [
                [0, 1],
                [0.25, 0.9936],
                [0.65, 0.9904],
                [1, 0.9776],
              ]
            : detail === 2
              ? [
                  [0, 1],
                  [0.18, 0.9952],
                  [0.4, 0.9936],
                  [0.6, 0.9904],
                  [0.8, 0.984],
                  [1, 0.9712],
                ]
              : [
                  [0, 1],
                  [0.14, 0.9984],
                  [0.28, 0.9952],
                  [0.42, 0.992],
                  [0.57, 0.9904],
                  [0.72, 0.9856],
                  [0.87, 0.9776],
                  [1, 0.9664],
                ],
      rings = profile.map(([t, scale], j) =>
        perimeter.map((p, i) => {
          const rough =
              j === 0 ? 0 : detail === 0 ? 0 : 0.004 * Math.sin(i * 2.17 + j * 1.13 + seed),
            y =
              baseY +
              height * t +
              (j === 0 ? 0 : (detail === 0 ? 0.02 : 0.07) * Math.sin(i * 1.37 + seed) * t);
          return [
            center[0] + (p[0] - center[0]) * (scale + rough),
            y,
            center[1] + (p[1] - center[1]) * (scale + rough),
          ];
        }),
      );
    const sign = Math.sign(
      perimeter.reduce(
        (s, p, i) =>
          s +
          p[0] * perimeter[(i + 1) % perimeter.length][1] -
          p[1] * perimeter[(i + 1) % perimeter.length][0],
        0,
      ),
    );
    for (let j = 1; j < rings.length; j++)
      for (let i = 0; i < perimeter.length; i++) {
        const k = (i + 1) % perimeter.length,
          n = [
            (perimeter[k][1] - perimeter[i][1]) * sign,
            0,
            (perimeter[i][0] - perimeter[k][0]) * sign,
          ];
        f('rubble', [rings[j - 1][i], rings[j - 1][k], rings[j][k], rings[j][i]], n);
      }
    for (const [ring, role, normal] of [
      [rings[0], 'rubble', [0, -1, 0]],
      [rings.at(-1), 'broken', [0, 1, 0]],
    ]) {
      const indices = earcut(ring.flatMap((p) => [p[0], p[2]]));
      for (let i = 0; i < indices.length; i += 3)
        f(
          role,
          indices.slice(i, i + 3).map((k) => ring[k]),
          normal,
        );
    }
  }
  for (const p of r.wallStrips) {
    const bodyBase = p.foundationY + 0.08;
    prism(f, 'foundation', { outline: p.outline, holes: [] }, p.foundationY, bodyBase);
    brokenMass(p.outline, p.center, bodyBase, p.topY, p.seed);
  }
}

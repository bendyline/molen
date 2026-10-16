/** N0638 complete whole-ensemble far silhouette. */
import { loft, radialRing } from './authored-structure-mesh.mjs';
import { triangle } from './heritage-tower-detail-mesh.mjs';
import { hipRoof } from './lighthouse-expansion-models.mjs';
import { box } from './structure-mesh.mjs';

export {
  buildMaidenCloseup,
  buildMaidenDistrict,
  buildMaidenStreet,
} from './maiden-tower-detail-model.mjs';

const means = {
  ashlar: [0.687437, 0.660738, 0.602857],
  plaster: [0.856015, 0.827728, 0.727643],
  tiles: [0.559267, 0.552465, 0.529503],
  metal: [0.908889, 0.908889, 0.908889],
  wood: [0.825128, 0.825128, 0.825128],
  granite: [0.701109, 0.701109, 0.701109],
};
export function buildMaidenSkyline(destination) {
  const out = Object.fromEntries(
    ['addQuad', 'addTriangle', 'addConvexPolygon'].map((k) => [
      k,
      (s, r, p, n, u, c) =>
        destination[k](
          s,
          r,
          p,
          n,
          u,
          c.map((v, i) => v * (means[s]?.[i] ?? 1)),
        ),
    ]),
  );
  box(out, 'ashlar', [-4, 0, -11.5], [16, 0.95, 11.5], [0.76, 0.74, 0.66]);
  box(out, 'ashlar', [-3.2, 0.95, -3.2], [3.2, 15.6, 3.2], [0.67, 0.65, 0.55]);
  loft(
    out,
    'plaster',
    [
      [14.4, 3.2],
      [15.7, 4.23],
      [16.04, 4.32],
    ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8)),
    [0.83, 0.81, 0.72],
  );
  loft(
    out,
    'plaster',
    [
      [16.04, 3.24],
      [19.55, 3.24],
    ].map(([y, r]) => radialRing(y, r, r, 8, [0, 0], Math.PI / 8)),
    [0.91, 0.87, 0.78],
  );
  loft(
    out,
    'metal',
    [
      [19.55, 3.45],
      [19.75, 3.57],
      [20.7, 3.14],
      [21.6, 2.65],
      [22.5, 2.05],
      [23.35, 1.82],
      [23.9, 1.98],
    ].map(([y, r]) => radialRing(y, r, r, 8)),
    [0.24, 0.245, 0.22],
  );
  loft(
    out,
    'metal',
    [
      [23.9, 0.32],
      [25, 0.17],
      [31.2, 0.11],
      [31.5, 0.21],
      [32.5, 0.038],
    ].map(([y, r]) => radialRing(y, r, r, 6)),
    [0.81, 0.79, 0.68],
  );
  for (const [x, z, rx, rz] of [
    [6, -10.9, 9.25, 0.4],
    [6, 10.35, 9.25, 0.4],
    [15.3, -0.25, 0.4, 10.75],
    [-3.2, -0.25, 0.4, 10.75],
  ]) {
    box(out, 'ashlar', [x - rx, 0.95, z - rz], [x + rx, 5.35, z + rz], [0.7, 0.68, 0.58]);
    const along = rx > rz,
      len = along ? rx : rz;
    for (let v = -len + 0.7; v < len; v += 2.25) {
      const a = along ? x + v : x,
        b = along ? z : z + v;
      box(
        out,
        'ashlar',
        [a - 0.63, 5.35, b - 0.63],
        [a + 0.63, 6.13, b + 0.63],
        [0.76, 0.74, 0.66],
      );
      const ring = [
        [a - 0.71, 6.13, b - 0.71],
        [a - 0.71, 6.13, b + 0.71],
        [a + 0.71, 6.13, b + 0.71],
        [a + 0.71, 6.13, b - 0.71],
      ];
      for (let side = 0; side < 4; side++)
        triangle(out, 'tiles', [ring[side], ring[(side + 1) % 4], [a, 6.43, b]], [0.43, 0.15, 0.1]);
    }
  }
  box(out, 'plaster', [-3.26, 0.95, -10.94], [15.06, 4.95, -6.04], [0.88, 0.87, 0.79]);
  hipRoof(out, 5.9, -8.49, 9.4, 2.7, 4.95, 1.22, [0.43, 0.15, 0.1]);
}

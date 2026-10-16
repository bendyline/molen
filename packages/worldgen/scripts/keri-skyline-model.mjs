/** Restored2024 bottle-tower silhouette with the mapped east-southeast wing. */
import { loft, radialRing } from './authored-structure-mesh.mjs';
import { box } from './structure-mesh.mjs';
export const keriRuntimeAssetId = 'molen.worldgen.structure.n0640_keri_lighthouse';
export function buildKeriSkyline(out) {
  const pale = [0.69, 0.69, 0.62],
    iron = [0.36, 0.13, 0.08],
    roof = [0.4, 0.44, 0.45];
  const form = (profile, color, sides = 16) =>
    loft(
      out,
      'wall',
      profile.map(([y, r]) => radialRing(y, r, r, sides)),
      color,
    );
  form(
    [
      [0, 7.1],
      [1, 7.05],
      [13.6, 6.32],
    ],
    pale,
  );
  form(
    [
      [13.6, 6.44],
      [14.02, 6.65],
    ],
    [0.44, 0.45, 0.38],
  );
  form(
    [
      [14.02, 2.45],
      [17, 1.75],
      [23.3, 1.75],
      [24.1, 2.18],
      [25.3, 2.18],
    ],
    iron,
  );
  form(
    [
      [24, 3.18],
      [24.2, 3.18],
    ],
    iron,
  );
  form(
    [
      [25.3, 1.92],
      [28.42, 1.92],
    ],
    [0.12, 0.23, 0.25],
  );
  form(
    [
      [28.42, 2.06],
      [28.62, 2.06],
      [29.5, 1.12],
      [30.07, 0.05],
    ],
    [0.27, 0.17, 0.13],
  );
  form(
    [
      [30.2, 0.04],
      [30.6, 0.04],
    ],
    [0.12, 0.13, 0.12],
    4,
  );
  box(out, 'wall', [5.64, 0, -4.59], [22.22, 3.5, 5.51], [0.65, 0.65, 0.58]);
  const rectangle = (y, rx, rz) =>
    [
      [-rx, y, -rz],
      [-rx, y, rz],
      [rx, y, rz],
      [rx, y, -rz],
    ].map(([x, h, z]) => [13.93 + x, h, 0.46 + z]);
  loft(out, 'wall', [rectangle(3.5, 8.5, 5.28), rectangle(5.1, 3.22, 0.06)], roof);
  box(out, 'wall', [11.78, 4.1, -0.2], [12.42, 6.34, 0.48], [0.47, 0.48, 0.41]);
}

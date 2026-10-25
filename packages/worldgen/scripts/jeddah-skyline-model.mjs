/** Deliberate distant silhouette; original detailed lighthouse master remains separate. */
import { loft, radialRing } from './authored-structure-mesh.mjs';

export const jeddahRuntimeAssetId = 'molen.worldgen.structure.jeddah_light';
export function buildJeddahSkyline(out) {
  const pale = [0.81, 0.78, 0.66],
    bronze = [0.22, 0.19, 0.12];
  const form = (profile, color, sides = 16) =>
    loft(
      out,
      'wall',
      profile.map(([y, rx, rz = rx]) => radialRing(y, rx, rz, sides)),
      color,
    );
  form(
    [
      [0, 28.2, 41.2],
      [1.6, 28.2, 41.2],
      [8, 19.3, 27.8],
      [14, 11.2, 15.7],
      [20, 7.55],
      [77.6, 7.2],
    ],
    pale,
  );
  form(
    [
      [77.6, 7.2],
      [81, 12.9],
      [88, 17.7],
      [97, 19.6],
      [101, 19.12],
      [103, 18.58],
    ],
    bronze,
  );
  // The cap changes color at the arcade belt; no fake point/dome or bronze shaft.
  form(
    [
      [103, 18.58],
      [107, 16.5],
      [110, 13.8],
      [114, 7.5],
      [119.7, 7.1],
    ],
    pale,
  );
  form(
    [
      [119.7, 7],
      [120.6, 7],
    ],
    [0.07, 0.12, 0.12],
  );
  form(
    [
      [120.6, 7.2],
      [121, 7.2],
      [126, 6.8],
    ],
    bronze,
  );
  form(
    [
      [126, 5.65],
      [130.15, 5.65],
    ],
    bronze,
  );
  form(
    [
      [130.15, 0.05],
      [131.4, 0.05],
    ],
    [0.11, 0.13, 0.13],
    4,
  );
}

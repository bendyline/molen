/**
 * Web Mercator projection for the kernel half, routed through `dmath`.
 *
 * `@bendyline/molen-terrain` ships the same projection in `geospatial.ts`, but it reaches
 * `Math.tan` / `Math.log` directly — correct there (that code is navigation and render math, and
 * terrain depends only on schema, so it cannot import the kernel's `dmath`). Region resolution
 * is different: it decides which style and scatter set a building gets, and this package
 * advertises hash-stable worldgen output (`molen worldgen stats` hashes, cache keys via
 * `hashJson`). A transcendental whose last bits differ between engines can flip a building on a
 * region-boundary pixel into a different style in one browser than in another.
 *
 * `check-dmath.mjs` is lexical, so importing terrain's projection passed the guard while still
 * reaching `Math.tan`. This module exists so that path cannot be taken: the arithmetic is the
 * same, operation for operation, so today's values are bit-identical to terrain's, and a future
 * swap of `dmath` to polynomial approximations reaches region resolution with it.
 */

import { dmath } from '@bendyline/molen-kernel/determinism';
import type { Vec2 } from '@bendyline/molen-worldgen/kernel';

/** Web Mercator sphere radius in meters (matches `@bendyline/molen-terrain`). */
export const MERCATOR_EARTH_RADIUS_METERS: number = 6_378_137;

/** Latitude (degrees) past which Web Mercator is undefined; input is clamped to it. */
export const MERCATOR_MAX_LATITUDE: number = 85.0511287798066;

/**
 * WGS84 longitude/latitude degrees to Web Mercator X/Z meters (+X east, +Z south).
 *
 * Multiply by the package's `metersPerUnit` to land in world meters. Latitude is clamped to
 * {@link MERCATOR_MAX_LATITUDE}; non-finite input throws rather than poisoning region bounds
 * with NaN.
 */
export function projectWgs84(longitude: number, latitude: number): Vec2 {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new Error('WGS84 coordinates must be finite');
  }
  const clampedLatitude = dmath.clamp(latitude, -MERCATOR_MAX_LATITUDE, MERCATOR_MAX_LATITUDE);
  const lonRadians = (longitude * dmath.PI) / 180;
  const latRadians = (clampedLatitude * dmath.PI) / 180;
  const x = MERCATOR_EARTH_RADIUS_METERS * lonRadians;
  const northing =
    clampedLatitude === 0
      ? 0
      : MERCATOR_EARTH_RADIUS_METERS * dmath.log(dmath.tan(dmath.PI / 4 + latRadians / 2));
  return [x, northing === 0 ? 0 : -northing];
}

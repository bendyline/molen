/**
 * The metric frame a projected-Earth terrain package renders in.
 *
 * Package adapters pre-multiply Web Mercator X/Z by one `metersPerUnit = cos(frame latitude)` so
 * tiles, meshes, semantic densities and entity speeds are in ground meters. These helpers are the
 * single definition of that scale, shared by the descriptor adapters and by hosts that must place
 * cameras and entities in the same frame (via `wgs84ToWorld`).
 */

import { WEB_MERCATOR_MAX_LATITUDE, webMercatorScaleAtLatitude } from './geospatial';
import type { TerrainPackageDescriptor, TerrainPackageFrame } from './package-types';

/**
 * Latitude the package's metric frame is exact at: `frame.latitude` when given, else the center
 * of the package bounds. Undefined for a local (already metric) package.
 */
export function terrainPackageFrameLatitude(
  pkg: TerrainPackageDescriptor,
  frame?: TerrainPackageFrame,
): number | undefined {
  if (pkg.coordinateSpace.kind === 'local') return undefined;
  if (frame !== undefined) {
    const { latitude } = frame;
    if (!Number.isFinite(latitude) || Math.abs(latitude) > WEB_MERCATOR_MAX_LATITUDE) {
      throw new Error(
        `terrain frame latitude must be finite and within ±${WEB_MERCATOR_MAX_LATITUDE}, got ${latitude}`,
      );
    }
    return latitude;
  }
  const [, south, , north] = pkg.coordinateSpace.bounds;
  return (south + north) / 2;
}

/**
 * Ground meters per projected unit for a package in a frame: `cos(frame latitude)` for a
 * projected-Earth package, 1 for a local package.
 */
export function terrainPackageMetersPerUnit(
  pkg: TerrainPackageDescriptor,
  frame?: TerrainPackageFrame,
): number {
  const latitude = terrainPackageFrameLatitude(pkg, frame);
  return latitude === undefined ? 1 : webMercatorScaleAtLatitude(latitude);
}

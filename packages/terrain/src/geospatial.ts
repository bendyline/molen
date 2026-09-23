/**
 * Navigation/data-projection helpers for the projected-Earth terrain adapter.
 *
 * These functions map WGS84 longitude/latitude to the engine's planar convention: +X east,
 * +Z south, meters. They are intended for package compilation, navigation, and rendering—not as
 * deterministic simulation math. The renderer rebases this large projected frame near the camera.
 */

export const WEB_MERCATOR_EARTH_RADIUS_METERS: number = 6_378_137;
export const WEB_MERCATOR_HALF_WORLD_METERS: number = WEB_MERCATOR_EARTH_RADIUS_METERS * Math.PI;
export const WEB_MERCATOR_MAX_LATITUDE: number = 85.0511287798066;

function requireFinitePair(a: number, b: number, label: string): void {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new Error(`${label} coordinates must be finite`);
  }
}

/**
 * Ground meters per projected Web Mercator meter at a latitude: cos(lat). Mercator inflates
 * horizontal distances by 1/cos(lat) (≈1.48× at 47.6°N), while heights stay in true meters;
 * multiplying projected X/Z by this factor makes a scene metrically consistent. Latitude is
 * clamped to the Mercator limit.
 */
export function webMercatorScaleAtLatitude(latitudeDegrees: number): number {
  if (!Number.isFinite(latitudeDegrees)) throw new Error('latitude must be finite');
  const clamped = Math.max(
    -WEB_MERCATOR_MAX_LATITUDE,
    Math.min(WEB_MERCATOR_MAX_LATITUDE, latitudeDegrees),
  );
  return Math.cos((clamped * Math.PI) / 180);
}

/** Projected (Mercator) X/Z → world meters, given the package's metersPerUnit. */
export function projectedToWorld(metersPerUnit: number, x: number, z: number): [number, number] {
  return [x * metersPerUnit, z * metersPerUnit];
}

/** World meters → projected (Mercator) X/Z, given the package's metersPerUnit. */
export function worldToProjected(metersPerUnit: number, x: number, z: number): [number, number] {
  return [x / metersPerUnit, z / metersPerUnit];
}

/** Convert WGS84 longitude/latitude degrees to Web Mercator X/Z meters (+Z south). */
export function wgs84ToWebMercator(longitude: number, latitude: number): [number, number] {
  requireFinitePair(longitude, latitude, 'WGS84');
  const clampedLatitude = Math.max(
    -WEB_MERCATOR_MAX_LATITUDE,
    Math.min(WEB_MERCATOR_MAX_LATITUDE, latitude),
  );
  const lonRadians = (longitude * Math.PI) / 180;
  const latRadians = (clampedLatitude * Math.PI) / 180;
  const x = WEB_MERCATOR_EARTH_RADIUS_METERS * lonRadians;
  const northing =
    clampedLatitude === 0
      ? 0
      : WEB_MERCATOR_EARTH_RADIUS_METERS * Math.log(Math.tan(Math.PI / 4 + latRadians / 2));
  return [x, northing === 0 ? 0 : -northing];
}

/** Convert Web Mercator X/Z meters (+Z south) to WGS84 longitude/latitude degrees. */
export function webMercatorToWgs84(x: number, z: number): [number, number] {
  requireFinitePair(x, z, 'Web Mercator');
  const longitude = (x / WEB_MERCATOR_EARTH_RADIUS_METERS) * (180 / Math.PI);
  const northing = -z;
  const latitude =
    (2 * Math.atan(Math.exp(northing / WEB_MERCATOR_EARTH_RADIUS_METERS)) - Math.PI / 2) *
    (180 / Math.PI);
  return [longitude, latitude];
}

export interface WebMercatorTileAddress {
  level: number;
  x: number;
  y: number;
}

/** XYZ address containing a WGS84 point at a Web Mercator level. */
export function wgs84ToWebMercatorTile(
  longitude: number,
  latitude: number,
  level: number,
): WebMercatorTileAddress {
  if (!Number.isSafeInteger(level) || level < 0 || level > 30) {
    throw new Error('Web Mercator tile level must be a safe integer from 0 through 30');
  }
  const [x, z] = wgs84ToWebMercator(longitude, latitude);
  const count = 2 ** level;
  const tileSize = (WEB_MERCATOR_HALF_WORLD_METERS * 2) / count;
  const tileX = Math.max(
    0,
    Math.min(count - 1, Math.floor((x + WEB_MERCATOR_HALF_WORLD_METERS) / tileSize)),
  );
  const tileY = Math.max(
    0,
    Math.min(count - 1, Math.floor((z + WEB_MERCATOR_HALF_WORLD_METERS) / tileSize)),
  );
  return { level, x: tileX, y: tileY };
}

/** Projected X/Z bounds for one XYZ Web Mercator tile. */
export function webMercatorTileBounds(
  address: WebMercatorTileAddress,
): [number, number, number, number] {
  const { level, x, y } = address;
  if (!Number.isSafeInteger(level) || level < 0 || level > 30) {
    throw new Error('Web Mercator tile level must be a safe integer from 0 through 30');
  }
  const count = 2 ** level;
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    x < 0 ||
    y < 0 ||
    x >= count ||
    y >= count
  ) {
    throw new Error(`Web Mercator tile ${level}/${x}/${y} is outside its ${count}x${count} grid`);
  }
  const size = (WEB_MERCATOR_HALF_WORLD_METERS * 2) / count;
  const minX = -WEB_MERCATOR_HALF_WORLD_METERS + x * size;
  const minZ = -WEB_MERCATOR_HALF_WORLD_METERS + y * size;
  return [minX, minZ, minX + size, minZ + size];
}

// Standard geohashes, and the rule that assigns Web Mercator tiles to geohash cells.
//
// A geohash names a longitude/latitude rectangle by interleaving bisections of longitude and
// latitude, five bits per base-32 character: one character is 45° × 45°, three are 1.40625° ×
// 1.40625° (about 156 × 156 km at the equator). Cells are equal-angle, so they do not nest with
// Mercator tiles: a tile at a cell's edge overlaps two cells. Archive sets partitioned by geohash
// (see `archive-set.ts`) therefore give every tile to exactly one cell, the cell holding the
// tile's center, and producers must place tiles by the same rule (`terrainTileGeohash`).
//
// A cell's index is its characters read as one base-32 number: `0`..`32^precision - 1`. Indices
// follow the geohash Z-order, so neighbouring cells mostly have nearby indices and run-length
// lists of indices stay short.

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const DECODE = new Map([...BASE32].map((char, index) => [char, index] as const));

/** Longest geohash these helpers accept (32^6 cells, about 1.2 × 0.6 km). */
export const GEOHASH_MAX_PRECISION = 6;

function checkPrecision(precision: number): void {
  if (!Number.isSafeInteger(precision) || precision < 1 || precision > GEOHASH_MAX_PRECISION) {
    throw new RangeError(`geohash precision must be an integer 1-${GEOHASH_MAX_PRECISION}`);
  }
}

/** The geohash of `precision` characters holding a point (west and south edges are inside). */
export function encodeGeohash(longitude: number, latitude: number, precision: number): string {
  checkPrecision(precision);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new RangeError('geohash coordinates must be finite');
  }
  const lon = Math.min(180, Math.max(-180, longitude));
  const lat = Math.min(90, Math.max(-90, latitude));
  let west = -180;
  let east = 180;
  let south = -90;
  let north = 90;
  let hash = '';
  let value = 0;
  let bit = 0;
  let even = true;
  while (hash.length < precision) {
    if (even) {
      const middle = (west + east) / 2;
      // The east edge of the world belongs to the last cell rather than wrapping.
      const high = lon >= middle && !(lon === 180 && east === middle);
      value = value * 2 + (high ? 1 : 0);
      if (high) west = middle;
      else east = middle;
    } else {
      const middle = (south + north) / 2;
      const high = lat >= middle;
      value = value * 2 + (high ? 1 : 0);
      if (high) south = middle;
      else north = middle;
    }
    even = !even;
    if (++bit === 5) {
      hash += BASE32[value] as string;
      value = 0;
      bit = 0;
    }
  }
  return hash;
}

/** A geohash's characters read as one base-32 number. */
export function geohashIndex(hash: string): number {
  if (hash.length === 0) throw new RangeError('empty geohash');
  checkPrecision(hash.length);
  let index = 0;
  for (const char of hash.toLowerCase()) {
    const digit = DECODE.get(char);
    if (digit === undefined) throw new RangeError(`"${hash}" is not a geohash`);
    index = index * 32 + digit;
  }
  return index;
}

/** The geohash of `precision` characters with this index. */
export function geohashFromIndex(index: number, precision: number): string {
  checkPrecision(precision);
  if (!Number.isSafeInteger(index) || index < 0 || index >= 32 ** precision) {
    throw new RangeError(`geohash index ${index} is outside ${32 ** precision} cells`);
  }
  let hash = '';
  let rest = index;
  for (let char = 0; char < precision; char++) {
    hash = (BASE32[rest % 32] as string) + hash;
    rest = Math.floor(rest / 32);
  }
  return hash;
}

/** A geohash's `[west, south, east, north]` in degrees. */
export function geohashBounds(hash: string): [number, number, number, number] {
  geohashIndex(hash);
  let west = -180;
  let east = 180;
  let south = -90;
  let north = 90;
  let even = true;
  for (const char of hash.toLowerCase()) {
    const digit = DECODE.get(char) as number;
    for (let bit = 4; bit >= 0; bit--) {
      const high = ((digit >> bit) & 1) === 1;
      if (even) {
        const middle = (west + east) / 2;
        if (high) west = middle;
        else east = middle;
      } else {
        const middle = (south + north) / 2;
        if (high) south = middle;
        else north = middle;
      }
      even = !even;
    }
  }
  return [west, south, east, north];
}

/**
 * The geohash cell a Web Mercator XYZ tile (+y south) belongs to in a geohash-partitioned
 * archive set: the cell holding the tile's center.
 */
export function terrainTileGeohash(level: number, x: number, y: number, precision: number): string {
  const count = 2 ** level;
  const longitude = ((x + 0.5) / count) * 360 - 180;
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / count))) * 180) / Math.PI;
  return encodeGeohash(longitude, latitude, precision);
}

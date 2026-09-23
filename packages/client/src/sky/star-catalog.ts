import { type SkyStar, starColor } from './visual';

// molen/stars@1: a compact binary star catalog, so a sky loads its stars from a content pack
// instead of a table compiled into the client. Six bytes a star, stored as columns:
//
//   header  "MSTR" · u16 version (1) · u16 reserved · u32 count · u32 reserved   (16 bytes)
//   ra      u16[count]  right ascension, J2000, 360/65536 degrees a step
//   dec     i16[count]  declination, J2000, 90/32767 degrees a step
//   mag     u8[count]   visual magnitude as (m + 2) * 25, so -2 to 8.2 in 0.04 steps
//   bv      u8[count]   B-V colour index as (bv + 1) * 50, so -1 to 4.1 in 0.02 steps
//
// All values little-endian. Positions keep better than 0.01 degrees, far below the size of a
// rendered star.

const MAGIC = 0x5254534d; // "MSTR" read as a little-endian u32
const VERSION = 1;
const HEADER_BYTES = 16;
const RAD = Math.PI / 180;

/** One catalog row: J2000 right ascension and declination in degrees, magnitude, B-V. */
export type StarCatalogRow = readonly [ra: number, dec: number, magnitude: number, bv: number];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Encode catalog rows as molen/stars@1 bytes. */
export function encodeStarCatalog(rows: readonly StarCatalogRow[]): Uint8Array {
  const count = rows.length;
  const bytes = new Uint8Array(HEADER_BYTES + count * 6);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, MAGIC, true);
  view.setUint16(4, VERSION, true);
  view.setUint32(8, count, true);
  const ra = HEADER_BYTES;
  const dec = ra + count * 2;
  const mag = dec + count * 2;
  const bv = mag + count;
  rows.forEach(([r, d, m, b], i) => {
    const wrapped = ((r % 360) + 360) % 360;
    view.setUint16(ra + i * 2, Math.round((wrapped / 360) * 65536) % 65536, true);
    view.setInt16(dec + i * 2, Math.round((clamp(d, -90, 90) / 90) * 32767), true);
    view.setUint8(mag + i, Math.round(clamp((m + 2) * 25, 0, 255)));
    view.setUint8(bv + i, Math.round(clamp((b + 1) * 50, 0, 255)));
  });
  return bytes;
}

/** Decode molen/stars@1 bytes to catalog rows. */
export function decodeStarCatalogRows(input: ArrayBuffer | Uint8Array): StarCatalogRow[] {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < HEADER_BYTES || view.getUint32(0, true) !== MAGIC) {
    throw new Error('not a molen/stars@1 catalog');
  }
  const version = view.getUint16(4, true);
  if (version !== VERSION) throw new Error(`unsupported star catalog version ${version}`);
  const count = view.getUint32(8, true);
  if (bytes.byteLength !== HEADER_BYTES + count * 6) {
    throw new Error(
      `star catalog is ${bytes.byteLength} bytes; ${count} stars need ${HEADER_BYTES + count * 6}`,
    );
  }
  const ra = HEADER_BYTES;
  const dec = ra + count * 2;
  const mag = dec + count * 2;
  const bv = mag + count;
  const rows: StarCatalogRow[] = [];
  for (let i = 0; i < count; i++) {
    rows.push([
      (view.getUint16(ra + i * 2, true) / 65536) * 360,
      (view.getInt16(dec + i * 2, true) / 32767) * 90,
      view.getUint8(mag + i) / 25 - 2,
      view.getUint8(bv + i) / 50 - 1,
    ]);
  }
  return rows;
}

/**
 * Decode a molen/stars@1 catalog into sky stars (J2000 equatorial directions, the same frame the
 * bundled catalog uses) for `SkyVisual.setStars` or `Renderer.setStarCatalog`.
 */
export function decodeStarCatalog(input: ArrayBuffer | Uint8Array): SkyStar[] {
  return decodeStarCatalogRows(input).map(([ra, dec, magnitude, bv]) => ({
    direction: [
      Math.cos(ra * RAD) * Math.cos(dec * RAD),
      Math.sin(ra * RAD) * Math.cos(dec * RAD),
      Math.sin(dec * RAD),
    ],
    magnitude,
    color: `#${starColor(bv).getHexString()}`,
  }));
}

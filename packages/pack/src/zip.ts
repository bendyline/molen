/**
 * The small subset of the zip format packs use: stored (0) and deflated (8) members, UTF-8
 * names, no zip64, no encryption, no extra fields on write. Output is deterministic: members are
 * written in the order given with a fixed timestamp, so the same input always gives the same
 * bytes. Deflate is fflate's, pinned to an exact version for the same reason.
 */

import { deflateSync, inflateSync } from 'fflate';

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
/** Fixed length of the end-of-central-directory record without its comment. */
export const EOCD_LENGTH = 22;
/** Fixed length of a local file header before its name and extra field. */
export const LOCAL_HEADER_LENGTH = 30;
const CENTRAL_HEADER_LENGTH = 46;
const UTF8_NAMES = 0x0800;
/** 1980-01-01 00:00, the earliest DOS date; every member carries it. */
const DOS_DATE = (0 << 9) | (1 << 5) | 1;
const MAX_U16 = 0xffff;
const MAX_U32 = 0xffffffff;

let crcTable: Uint32Array | undefined;

export function crc32(bytes: Uint8Array): number {
  if (crcTable === undefined) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crcTable[(crc ^ (bytes[i] as number)) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipMemberInput {
  name: string;
  data: Uint8Array;
  /** 'deflate' always compresses; 'auto' stores when compression saves under 10%. */
  compression: 'store' | 'deflate' | 'auto';
}

interface EncodedMember {
  name: Uint8Array;
  method: 0 | 8;
  crc: number;
  size: number;
  body: Uint8Array;
  offset: number;
}

/** Write members, in order, into one zip archive. */
export function writeZip(members: readonly ZipMemberInput[]): Uint8Array {
  if (members.length >= MAX_U16) throw new Error(`too many zip members (${members.length})`);
  const encoder = new TextEncoder();
  const encoded: EncodedMember[] = [];
  let offset = 0;
  for (const member of members) {
    const name = encoder.encode(member.name);
    if (name.length > MAX_U16) throw new Error(`zip member name too long: ${member.name}`);
    let method: 0 | 8 = 0;
    let body = member.data;
    if (member.compression !== 'store' && member.data.length > 0) {
      const deflated = deflateSync(member.data, { level: 9 });
      if (member.compression === 'deflate' || deflated.length < member.data.length * 0.9) {
        method = 8;
        body = deflated;
      }
    }
    encoded.push({ name, method, crc: crc32(member.data), size: member.data.length, body, offset });
    offset += LOCAL_HEADER_LENGTH + name.length + body.length;
    if (offset > MAX_U32) throw new Error('pack is larger than 4 GiB; zip64 is not supported');
  }
  const centralOffset = offset;
  const centralSize = encoded.reduce(
    (total, member) => total + CENTRAL_HEADER_LENGTH + member.name.length,
    0,
  );
  const out = new Uint8Array(centralOffset + centralSize + EOCD_LENGTH);
  const view = new DataView(out.buffer);
  for (const member of encoded) {
    let at = member.offset;
    view.setUint32(at, LOCAL_HEADER, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, UTF8_NAMES, true);
    view.setUint16(at + 8, member.method, true);
    view.setUint16(at + 10, 0, true);
    view.setUint16(at + 12, DOS_DATE, true);
    view.setUint32(at + 14, member.crc, true);
    view.setUint32(at + 18, member.body.length, true);
    view.setUint32(at + 22, member.size, true);
    view.setUint16(at + 26, member.name.length, true);
    view.setUint16(at + 28, 0, true);
    at += LOCAL_HEADER_LENGTH;
    out.set(member.name, at);
    out.set(member.body, at + member.name.length);
  }
  let at = centralOffset;
  for (const member of encoded) {
    view.setUint32(at, CENTRAL_HEADER, true);
    view.setUint16(at + 4, 20, true);
    view.setUint16(at + 6, 20, true);
    view.setUint16(at + 8, UTF8_NAMES, true);
    view.setUint16(at + 10, member.method, true);
    view.setUint16(at + 12, 0, true);
    view.setUint16(at + 14, DOS_DATE, true);
    view.setUint32(at + 16, member.crc, true);
    view.setUint32(at + 20, member.body.length, true);
    view.setUint32(at + 24, member.size, true);
    view.setUint16(at + 28, member.name.length, true);
    // Extra, comment, disk, internal and external attributes are all zero.
    view.setUint32(at + 42, member.offset, true);
    out.set(member.name, at + CENTRAL_HEADER_LENGTH);
    at += CENTRAL_HEADER_LENGTH + member.name.length;
  }
  view.setUint32(at, END_OF_CENTRAL_DIRECTORY, true);
  view.setUint16(at + 8, encoded.length, true);
  view.setUint16(at + 10, encoded.length, true);
  view.setUint32(at + 12, centralSize, true);
  view.setUint32(at + 16, centralOffset, true);
  return out;
}

export interface ZipEnd {
  /** Absolute offset of the end record. */
  offset: number;
  /** Total archive size implied by the end record. */
  archiveSize: number;
  centralOffset: number;
  centralSize: number;
  entries: number;
}

/**
 * Find the end record in the last bytes of an archive. `tailStart` is the absolute offset of
 * `tail[0]`; when it is unknown (a cross-origin range response hides Content-Range) it is
 * recovered from the record, since packs have nothing between the central directory and it.
 */
export function findZipEnd(tail: Uint8Array, tailStart?: number): ZipEnd {
  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  for (let at = tail.length - EOCD_LENGTH; at >= 0; at--) {
    if (view.getUint32(at, true) !== END_OF_CENTRAL_DIRECTORY) continue;
    const commentLength = view.getUint16(at + 20, true);
    if (at + EOCD_LENGTH + commentLength > tail.length) continue;
    const entries = view.getUint16(at + 10, true);
    const centralSize = view.getUint32(at + 12, true);
    const centralOffset = view.getUint32(at + 16, true);
    if (entries === MAX_U16 || centralSize === MAX_U32 || centralOffset === MAX_U32) {
      throw new Error('zip64 archives are not supported');
    }
    const start = tailStart ?? centralOffset + centralSize - at;
    return {
      offset: start + at,
      archiveSize: start + at + EOCD_LENGTH + commentLength,
      centralOffset,
      centralSize,
      entries,
    };
  }
  throw new Error('not a zip archive: no end-of-central-directory record');
}

export interface ZipMember {
  name: string;
  method: number;
  crc: number;
  compressedSize: number;
  size: number;
  localOffset: number;
}

export function parseCentralDirectory(bytes: Uint8Array, entries: number): Map<string, ZipMember> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const members = new Map<string, ZipMember>();
  let at = 0;
  for (let i = 0; i < entries; i++) {
    if (at + CENTRAL_HEADER_LENGTH > bytes.length || view.getUint32(at, true) !== CENTRAL_HEADER) {
      throw new Error('corrupt zip central directory');
    }
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const name = decoder.decode(
      bytes.subarray(at + CENTRAL_HEADER_LENGTH, at + CENTRAL_HEADER_LENGTH + nameLength),
    );
    const member: ZipMember = {
      name,
      method: view.getUint16(at + 10, true),
      crc: view.getUint32(at + 16, true),
      compressedSize: view.getUint32(at + 20, true),
      size: view.getUint32(at + 24, true),
      localOffset: view.getUint32(at + 42, true),
    };
    if (member.compressedSize === MAX_U32 || member.localOffset === MAX_U32) {
      throw new Error('zip64 archives are not supported');
    }
    members.set(name, member);
    at += CENTRAL_HEADER_LENGTH + nameLength + extraLength + commentLength;
  }
  return members;
}

/** Offset of a member's data from its local header, read from the header itself. */
export function localDataOffset(header: Uint8Array): number {
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  if (view.getUint32(0, true) !== LOCAL_HEADER) throw new Error('corrupt zip local header');
  return LOCAL_HEADER_LENGTH + view.getUint16(26, true) + view.getUint16(28, true);
}

/** Decompress a member's data and check it against the central directory's CRC. */
export function decodeMember(member: ZipMember, body: Uint8Array): Uint8Array {
  let data: Uint8Array;
  if (member.method === 0) data = body;
  else if (member.method === 8) data = inflateSync(body, { out: new Uint8Array(member.size) });
  else throw new Error(`zip member "${member.name}" uses unsupported method ${member.method}`);
  if (data.length !== member.size || crc32(data) !== member.crc) {
    throw new Error(`zip member "${member.name}" is corrupt (size or CRC mismatch)`);
  }
  return data;
}

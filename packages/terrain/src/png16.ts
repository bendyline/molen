import { unzlibSync, zlibSync } from 'fflate';

// Minimal 16-bit grayscale PNG codec, pure-JS (fflate for zlib) so it runs in Node, Workers,
// and the browser. Supports exactly the format the terrain generator writes: bit depth 16,
// color type 0 (grayscale), no interlace.

const SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const MAX_DIMENSION = 8192;
const MAX_PIXELS = 16_777_216;
const MAX_COMPRESSED_BYTES = 64 * 1024 * 1024;

function checkedImageSize(width: number, height: number): number {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new Error(`PNG dimensions must be positive safe integers, got ${width}x${height}`);
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    throw new Error(`PNG dimensions exceed the ${MAX_DIMENSION}px/${MAX_PIXELS}-pixel limit`);
  }
  return width * height;
}

function crc32(bytes: Uint8Array, start: number, end: number): number {
  let c = 0xffffffff;
  for (let i = start; i < end; i++) {
    c ^= bytes[i] as number;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function writeChunk(parts: number[], type: string, data: Uint8Array): void {
  const len = data.length;
  parts.push((len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255);
  const chunk: number[] = [];
  for (let i = 0; i < 4; i++) chunk.push(type.charCodeAt(i));
  for (const b of data) chunk.push(b);
  const buf = Uint8Array.from(chunk);
  const crc = crc32(buf, 0, buf.length);
  for (const b of chunk) parts.push(b);
  parts.push((crc >>> 24) & 255, (crc >>> 16) & 255, (crc >>> 8) & 255, crc & 255);
}

export interface Gray16 {
  width: number;
  height: number;
  /** Normalized [0,1] values, row-major, length = width*height. */
  data: Float32Array;
}

/** Encode a normalized grayscale grid as a 16-bit grayscale PNG. */
export function encodePng16(img: Gray16): Uint8Array {
  const { width, height, data } = img;
  const pixels = checkedImageSize(width, height);
  if (data.length !== pixels) {
    throw new Error(`PNG data length ${data.length} does not match ${width}x${height}`);
  }
  // Raw scanlines: each row prefixed with filter byte 0, then 2 bytes/sample big-endian.
  const raw = new Uint8Array(height * (1 + width * 2));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const v = Math.max(0, Math.min(1, data[y * width + x] as number));
      const u16 = Math.round(v * 65535);
      raw[p++] = (u16 >>> 8) & 255;
      raw[p++] = u16 & 255;
    }
  }
  const idat = zlibSync(raw, { level: 6 });

  const parts: number[] = [...SIG];
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width);
  dv.setUint32(4, height);
  ihdr[8] = 16; // bit depth
  ihdr[9] = 0; // color type grayscale
  writeChunk(parts, 'IHDR', ihdr);
  writeChunk(parts, 'IDAT', idat);
  writeChunk(parts, 'IEND', new Uint8Array(0));
  return Uint8Array.from(parts);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Decode a 16-bit grayscale PNG to a normalized [0,1] grid. */
export function decodePng16(png: Uint8Array): Gray16 {
  if (png.length < SIG.length) throw new Error('not a PNG');
  for (let i = 0; i < 8; i++) {
    if (png[i] !== SIG[i]) throw new Error('not a PNG');
  }
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let sawHeader = false;
  let sawEnd = false;
  const idatChunks: Uint8Array[] = [];
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  while (off < png.length) {
    if (off + 12 > png.length) throw new Error('truncated PNG chunk header');
    const len = dv.getUint32(off);
    if (len > MAX_COMPRESSED_BYTES) throw new Error(`PNG chunk is too large: ${len} bytes`);
    const type = String.fromCharCode(
      png[off + 4] as number,
      png[off + 5] as number,
      png[off + 6] as number,
      png[off + 7] as number,
    );
    const dataStart = off + 8;
    const dataEnd = dataStart + len;
    if (!Number.isSafeInteger(dataEnd) || dataEnd + 4 > png.length) {
      throw new Error(`truncated PNG ${type} chunk`);
    }
    const expectedCrc = dv.getUint32(dataEnd);
    const actualCrc = crc32(png, off + 4, dataEnd);
    if (expectedCrc !== actualCrc) throw new Error(`PNG ${type} chunk CRC mismatch`);
    if (type === 'IHDR') {
      if (sawHeader || off !== 8 || len !== 13) throw new Error('invalid PNG IHDR chunk');
      width = dv.getUint32(dataStart);
      height = dv.getUint32(dataStart + 4);
      checkedImageSize(width, height);
      bitDepth = png[dataStart + 8] as number;
      colorType = png[dataStart + 9] as number;
      const compression = png[dataStart + 10] as number;
      const filterMethod = png[dataStart + 11] as number;
      const interlace = png[dataStart + 12] as number;
      if (compression !== 0 || filterMethod !== 0 || interlace !== 0) {
        throw new Error(
          `unsupported PNG methods (compression=${compression}, filter=${filterMethod}, interlace=${interlace})`,
        );
      }
      sawHeader = true;
    } else if (type === 'IDAT') {
      if (!sawHeader) throw new Error('PNG IDAT appeared before IHDR');
      idatChunks.push(png.subarray(dataStart, dataStart + len));
    } else if (type === 'IEND') {
      if (len !== 0) throw new Error('invalid PNG IEND chunk');
      sawEnd = true;
      break;
    } else if (/^[A-Z]/.test(type)) {
      throw new Error(`unsupported critical PNG chunk ${type}`);
    }
    off = dataEnd + 4; // skip data + CRC
  }
  if (!sawHeader || !sawEnd || idatChunks.length === 0) {
    throw new Error('PNG must contain IHDR, IDAT, and IEND chunks');
  }
  if (bitDepth !== 16 || colorType !== 0) {
    throw new Error(
      `unsupported PNG (bitDepth=${bitDepth}, colorType=${colorType}); expected 16-bit grayscale`,
    );
  }

  // Concatenate IDAT and inflate.
  let total = 0;
  for (const c of idatChunks) {
    total += c.length;
    if (!Number.isSafeInteger(total) || total > MAX_COMPRESSED_BYTES) {
      throw new Error(`PNG compressed data exceeds ${MAX_COMPRESSED_BYTES} bytes`);
    }
  }
  const comp = new Uint8Array(total);
  let q = 0;
  for (const c of idatChunks) {
    comp.set(c, q);
    q += c.length;
  }
  const stride = width * 2;
  const expectedRawSize = height * (stride + 1);
  const raw = unzlibSync(comp, { out: new Uint8Array(expectedRawSize + 1) });
  if (raw.length !== expectedRawSize) {
    throw new Error(`PNG decompressed to ${raw.length} bytes, expected ${expectedRawSize}`);
  }

  // De-filter scanlines (2 bytes/sample, 1 channel).
  const bpp = 2;
  const out = new Float32Array(width * height);
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++] as number;
    for (let i = 0; i < stride; i++) {
      const x = raw[rp++] as number;
      const a = i >= bpp ? (cur[i - bpp] as number) : 0;
      const b = prev[i] as number;
      const c = i >= bpp ? (prev[i - bpp] as number) : 0;
      let val: number;
      switch (filter) {
        case 0:
          val = x;
          break;
        case 1:
          val = x + a;
          break;
        case 2:
          val = x + b;
          break;
        case 3:
          val = x + ((a + b) >> 1);
          break;
        case 4:
          val = x + paeth(a, b, c);
          break;
        default:
          throw new Error(`unsupported PNG scanline filter ${filter}`);
      }
      cur[i] = val & 255;
    }
    for (let x = 0; x < width; x++) {
      const u16 = ((cur[x * 2] as number) << 8) | (cur[x * 2 + 1] as number);
      out[y * width + x] = u16 / 65535;
    }
    prev.set(cur);
  }
  return { width, height, data: out };
}

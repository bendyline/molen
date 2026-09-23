import type { JsonValue } from '@bendyline/molen-schema';

// Canonical serialization + hashing for stable state hashing (docs/07-tooling-and-testing.md
// §5.2): object keys sorted lexicographically, numbers encoded as their raw IEEE-754 64-bit
// bits (not decimal strings — avoids formatting ambiguity), strings UTF-8 length-prefixed.
// JS float +,-,*,/ is bit-deterministic, so identical runs produce identical bytes.
//
// Pure JS (no node:crypto, no Buffer) so the kernel hashes identically in Node and in a Web
// Worker — the kernel must stay environment-agnostic (docs/01-architecture.md §1).

const TAG_NULL = 0x00;
const TAG_FALSE = 0x01;
const TAG_TRUE = 0x02;
const TAG_NUMBER = 0x03;
const TAG_STRING = 0x04;
const TAG_ARRAY = 0x05;
const TAG_OBJECT = 0x06;

class ByteSink {
  private buf = new Uint8Array(256);
  private len = 0;
  private readonly scratch = new DataView(new ArrayBuffer(8));
  private readonly encoder = new TextEncoder();

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  byte(b: number): void {
    this.ensure(1);
    this.buf[this.len++] = b & 0xff;
  }

  u32(n: number): void {
    this.ensure(4);
    this.scratch.setUint32(0, n >>> 0, true);
    for (let i = 0; i < 4; i++) this.buf[this.len++] = this.scratch.getUint8(i);
  }

  f64(n: number): void {
    this.ensure(8);
    this.scratch.setFloat64(0, n, true);
    for (let i = 0; i < 8; i++) this.buf[this.len++] = this.scratch.getUint8(i);
  }

  utf8(s: string): void {
    const bytes = this.encoder.encode(s);
    this.u32(bytes.length);
    this.ensure(bytes.length);
    this.buf.set(bytes, this.len);
    this.len += bytes.length;
  }

  bytes(): Uint8Array {
    return this.buf.subarray(0, this.len);
  }
}

function encode(sink: ByteSink, value: JsonValue): void {
  if (value === null) {
    sink.byte(TAG_NULL);
    return;
  }
  switch (typeof value) {
    case 'boolean':
      sink.byte(value ? TAG_TRUE : TAG_FALSE);
      return;
    case 'number':
      sink.byte(TAG_NUMBER);
      // Normalize -0 to 0 so they hash identically (they are == and JSON-equal).
      sink.f64(value === 0 ? 0 : value);
      return;
    case 'string':
      sink.byte(TAG_STRING);
      sink.utf8(value);
      return;
    default:
      break;
  }
  if (Array.isArray(value)) {
    sink.byte(TAG_ARRAY);
    sink.u32(value.length);
    for (const item of value) encode(sink, item);
    return;
  }
  sink.byte(TAG_OBJECT);
  const obj = value as { [k: string]: JsonValue | undefined };
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  sink.u32(keys.length);
  for (const key of keys) {
    sink.utf8(key);
    encode(sink, obj[key] as JsonValue);
  }
}

/** Canonical byte serialization of a JSON value (sorted keys, IEEE-754 number bits). */
export function canonicalBytes(value: JsonValue): Uint8Array {
  const sink = new ByteSink();
  encode(sink, value);
  return sink.bytes();
}

// --- SHA-256 (pure JS, operates on Uint8Array) ---

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256(data: Uint8Array): string {
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const bitLen = data.length * 8;
  const withPad = ((data.length + 8) >> 6) + 1;
  const padded = new Uint8Array(withPad * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 4, bitLen >>> 0, false);
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000), false);

  const w = new Uint32Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15] as number;
      const b = w[i - 2] as number;
      const s0 = rotr(a, 7) ^ rotr(a, 18) ^ (a >>> 3);
      const s1 = rotr(b, 17) ^ rotr(b, 19) ^ (b >>> 10);
      w[i] = (((w[i - 16] as number) + s0 + (w[i - 7] as number) + s1) | 0) >>> 0;
    }
    let a = h[0] as number;
    let b = h[1] as number;
    let c = h[2] as number;
    let d = h[3] as number;
    let e = h[4] as number;
    let f = h[5] as number;
    let g = h[6] as number;
    let hh = h[7] as number;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + (K[i] as number) + (w[i] as number)) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] = ((h[0] as number) + a) | 0;
    h[1] = ((h[1] as number) + b) | 0;
    h[2] = ((h[2] as number) + c) | 0;
    h[3] = ((h[3] as number) + d) | 0;
    h[4] = ((h[4] as number) + e) | 0;
    h[5] = ((h[5] as number) + f) | 0;
    h[6] = ((h[6] as number) + g) | 0;
    h[7] = ((h[7] as number) + hh) | 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) hex += ((h[i] as number) >>> 0).toString(16).padStart(8, '0');
  return hex;
}

/** Stable SHA-256 of a JSON value, prefixed "sha256:". */
export function hashJson(value: JsonValue): string {
  return `sha256:${sha256(canonicalBytes(value))}`;
}

/** SHA-256 of raw bytes, prefixed "sha256:". */
export function hashBytes(data: Uint8Array): string {
  return `sha256:${sha256(data)}`;
}

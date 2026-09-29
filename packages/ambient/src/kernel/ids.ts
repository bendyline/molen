/** Small deterministic hashes and seeded draws shared by the graph and the agents. */

/** FNV-1a 32-bit hash of a string. */
export function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Short base-36 hash of a string (up to 7 characters). */
export function shortHash(text: string): string {
  return fnv1a(text).toString(36);
}

/** murmur3 finalizer: a full-avalanche 32-bit mix. */
export function fmix32(x: number): number {
  let h = x | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Independent stateless draw in [0, 1) for a (seed, stream) pair. */
export function unit01(seed: number, stream: number): number {
  return fmix32((seed | 0) ^ Math.imul((stream | 0) + 1, 0x9e3779b1)) / 4294967296;
}

/** Quantize to 1e-4 so stored state equals the state the next tick reads. */
export function q4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Stateless seeded draws (the worldgen scheme, kept local so the client half never pulls the
 * worldgen package): a seed string hashes with the kernel FNV-1a and every (seed, stream) pair
 * yields an independent uniform in [0, 1).
 */

import { seedToInt } from '@bendyline/molen-kernel/determinism';

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

/** The integer seed of a figure: its descriptor seed, else the entity id. */
export function figureSeed(seed: string | undefined, entityId: string): number {
  return seedToInt(seed !== undefined && seed.length > 0 ? seed : entityId);
}

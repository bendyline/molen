/**
 * Seed and identity contract.
 *
 * Seeds are canonical strings hashed with the kernel FNV-1a (`seedToInt`), so a debug dump is
 * greppable and reproducible from any language. Draws are stateless (`unit01(seed, stream)`),
 * which makes generated output independent of evaluation order. The identity part of a building
 * seed is caller-owned and opaque: a geographic adapter passes a feature id, a dungeon passes a room
 * id. Bump `WORLDGEN_SEED_SCHEME` when the sampling algorithms change on purpose.
 */

import { seedToInt } from '@bendyline/molen-kernel/determinism';

export const WORLDGEN_SEED_SCHEME: 'wg1' = 'wg1';

export interface PackIdentity {
  name: string;
  version: string;
}

export interface VersionedId {
  id: string;
  version: number;
}

/** murmur3 finalizer: a full-avalanche 32-bit mix. */
export function fmix32(x: number): number {
  let h = x | 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash two integer coordinates and a salt into a uint32 using integer multiplies only. */
export function hashCoord(a: number, b: number, salt: number): number {
  const first = fmix32((a | 0) ^ Math.imul(salt | 0, 0x9e3779b1));
  return fmix32(first ^ Math.imul(b | 0, 0x85ebca77) ^ Math.imul(salt | 0, 0x27d4eb2f));
}

/** FNV-1a of a string (bit-compatible with the kernel `seedToInt`). */
export function hashString(value: string): number {
  return seedToInt(value);
}

/** Independent stateless draw in [0, 1) for a (seed, stream) pair. */
export function unit01(seed: number, stream: number): number {
  return fmix32((seed | 0) ^ Math.imul((stream | 0) + 1, 0x9e3779b1)) / 4294967296;
}

/** Index of the weighted choice selected by a uniform draw `u` in [0, 1). */
export function pickWeighted(u: number, weights: readonly number[]): number {
  let total = 0;
  for (const weight of weights) total += weight > 0 ? weight : 0;
  if (total <= 0) return 0;
  let target = u * total;
  let last = 0;
  for (let index = 0; index < weights.length; index++) {
    const weight = weights[index] ?? 0;
    if (weight <= 0) continue;
    last = index;
    if (target < weight) return index;
    target -= weight;
  }
  return last;
}

/** Linear interpolation inside a `{min, max}` range by a unit draw. */
export function sampleRange(range: { min: number; max: number }, u: number): number {
  return range.min + (range.max - range.min) * u;
}

export function buildingSeedString(
  pack: PackIdentity,
  style: VersionedId,
  identity: string,
): string {
  return `${WORLDGEN_SEED_SCHEME}|b|${pack.name}@${pack.version}|${style.id}@${style.version}|${identity}`;
}

/** Seed of one named aspect (massing, roof, palette:<name>, ...) of a building. */
export function aspectSeed(buildingSeed: string, aspect: string): number {
  return seedToInt(`${buildingSeed}|${aspect}`);
}

/** Salt shared by every placement cell of one scatter rule. */
export function propSalt(pack: PackIdentity, scatter: VersionedId, ruleId: string): number {
  return seedToInt(
    `${WORLDGEN_SEED_SCHEME}|p|${pack.name}@${pack.version}|${scatter.id}@${scatter.version}|${ruleId}`,
  );
}

/** Fallback identity from a quantized centroid (`c:<qx>,<qz>`); prefer a real id when one exists. */
export function quantizedIdentity(x: number, z: number, quantum = 0.5): string {
  return `c:${Math.round(x / quantum)},${Math.round(z / quantum)}`;
}

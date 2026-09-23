/**
 * Deterministic 2D value noise on an integer lattice hashed with `Math.imul` only. It is the same
 * value in Node, a Worker, and the browser, and it stays well mixed at world-scale coordinates
 * (1e7 meters) because the lattice indices are hashed as 32-bit integers.
 */

import { fmix32 } from './seed';

function lattice(ix: number, iz: number, seed: number): number {
  const first = fmix32((ix | 0) ^ Math.imul(seed | 0, 0x9e3779b1));
  return fmix32(first ^ Math.imul(iz | 0, 0x85ebca77)) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1]. */
export function valueNoise2(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const v00 = lattice(ix, iz, seed);
  const v10 = lattice(ix + 1, iz, seed);
  const v01 = lattice(ix, iz + 1, seed);
  const v11 = lattice(ix + 1, iz + 1, seed);
  const top = v00 + (v10 - v00) * fx;
  const bottom = v01 + (v11 - v01) * fx;
  return top + (bottom - top) * fz;
}

/** Fractal Brownian motion over `valueNoise2`, normalized to [0, 1]. */
export function fbm2(
  x: number,
  z: number,
  seed: number,
  octaves: number,
  lacunarity: number,
  gain: number,
): number {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave++) {
    sum += amplitude * valueNoise2(x * frequency, z * frequency, seed + octave * 1013);
    norm += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return norm > 0 ? sum / norm : 0;
}

import type { RngState } from '@bendyline/molen-schema';

// sfc32: ~6 lines of pure 32-bit integer ops, no BigInt, state is four uint32s so it is
// trivially snapshot-able (docs/04-kernel-design.md §5.1). Seeded via splitmix32.

export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, n) for integer n > 0. */
  int(n: number): number;
  /** Float in [lo, hi). */
  range(lo: number, hi: number): number;
  /** Capture state for snapshots. */
  save(): RngState;
}

function splitmix32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    t = t ^ (t >>> 15);
    return t >>> 0;
  };
}

/** Hash an arbitrary string/number seed into a 32-bit integer (FNV-1a for strings). */
export function seedToInt(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

class Sfc32 implements Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(state: [number, number, number, number]) {
    this.a = state[0] >>> 0;
    this.b = state[1] >>> 0;
    this.c = state[2] >>> 0;
    this.d = state[3] >>> 0;
  }

  next(): number {
    // sfc32 core
    const t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    const r = (t + this.d) | 0;
    this.c = (this.c + r) | 0;
    return (r >>> 0) / 4294967296;
  }

  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  save(): RngState {
    return { algo: 'sfc32', state: [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0] };
  }
}

/** Build an RNG from a world seed (string or number). */
export function createRng(seed: string | number): Rng {
  const sm = splitmix32(seedToInt(seed));
  return new Sfc32([sm(), sm(), sm(), sm()]);
}

/** Restore an RNG from a snapshotted state. */
export function rngFromState(state: RngState): Rng {
  return new Sfc32([...state.state] as [number, number, number, number]);
}

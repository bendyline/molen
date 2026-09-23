import { describe, expect, it } from 'vitest';
import { createRng, rngFromState, seedToInt } from '../src/rng';

describe('sfc32 rng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng('hello');
    const b = createRng('hello');
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('produces different streams for different seeds', () => {
    const a = createRng('a');
    const b = createRng('b');
    expect(a.next()).not.toBe(b.next());
  });

  it('emits floats in [0, 1)', () => {
    const r = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('round-trips through save/restore exactly', () => {
    const r = createRng('replay');
    for (let i = 0; i < 17; i++) r.next();
    const state = r.save();
    const restored = rngFromState(state);
    const continued = Array.from({ length: 10 }, () => r.next());
    const replayed = Array.from({ length: 10 }, () => restored.next());
    expect(replayed).toEqual(continued);
  });

  it('save() returns four uint32 state words', () => {
    const r = createRng('x');
    r.next();
    const { algo, state } = r.save();
    expect(algo).toBe('sfc32');
    expect(state).toHaveLength(4);
    for (const w of state) {
      expect(Number.isInteger(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it('int(n) stays in range', () => {
    const r = createRng('ints');
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('seedToInt is stable and 32-bit', () => {
    expect(seedToInt('abc')).toBe(seedToInt('abc'));
    expect(seedToInt('abc')).not.toBe(seedToInt('abd'));
    expect(seedToInt(123)).toBe(123);
    expect(seedToInt('anything') >>> 0).toBe(seedToInt('anything'));
  });
});

import { seedToInt } from '@bendyline/molen-kernel/determinism';
import { describe, expect, it } from 'vitest';
import { fbm2, valueNoise2 } from '../../src/kernel/noise';
import {
  aspectSeed,
  buildingSeedString,
  hashCoord,
  hashString,
  pickWeighted,
  propSalt,
  quantizedIdentity,
  unit01,
} from '../../src/kernel/seed';

describe('seed contract', () => {
  it('pins the canonical seed strings', () => {
    const seed = buildingSeedString(
      { name: 'p', version: '2026.09.0' },
      { id: 'a.b.house', version: 3 },
      'f:42',
    );
    expect(seed).toBe('wg1|b|p@2026.09.0|a.b.house@3|f:42');
    expect(aspectSeed(seed, 'roof')).toBe(seedToInt(`${seed}|roof`));
    expect(propSalt({ name: 'p', version: '1' }, { id: 's', version: 1 }, 'r')).toBe(
      seedToInt('wg1|p|p@1|s@1|r'),
    );
    expect(quantizedIdentity(10.26, -3.74)).toBe('c:21,-7');
    expect(hashString('abc')).toBe(seedToInt('abc'));
  });

  it('draws are stateless, bounded, and roughly uniform', () => {
    const buckets = new Array<number>(8).fill(0);
    for (let stream = 0; stream < 4000; stream++) {
      const u = unit01(12345, stream);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      buckets[Math.floor(u * 8)] = (buckets[Math.floor(u * 8)] ?? 0) + 1;
    }
    for (const count of buckets) expect(count).toBeGreaterThan(350);
    expect(unit01(7, 3)).toBe(unit01(7, 3));
    expect(unit01(7, 3)).not.toBe(unit01(7, 4));
  });

  it('hashes world-scale integer coordinates without collapsing', () => {
    const a = hashCoord(2_500_000, -1_800_000, 99);
    const b = hashCoord(2_500_001, -1_800_000, 99);
    const c = hashCoord(2_500_000, -1_800_000, 100);
    expect(Number.isFinite(a)).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
  });

  it('picks weighted entries by cumulative weight', () => {
    expect(pickWeighted(0.1, [1, 1, 2])).toBe(0);
    expect(pickWeighted(0.3, [1, 1, 2])).toBe(1);
    expect(pickWeighted(0.9, [1, 1, 2])).toBe(2);
    expect(pickWeighted(0.5, [0, 0, 5])).toBe(2);
    expect(pickWeighted(0.5, [0, 0])).toBe(0);
  });

  it('noise is continuous, bounded, and stable at large coordinates', () => {
    const x = 9_160_000.25;
    const a = valueNoise2(x, 5_000_000.5, 3);
    const b = valueNoise2(x + 0.001, 5_000_000.5, 3);
    expect(Math.abs(a - b)).toBeLessThan(0.02);
    expect(a).toBe(valueNoise2(x, 5_000_000.5, 3));
    for (let index = 0; index < 200; index++) {
      const value = fbm2(index * 0.37, index * 0.11, 9, 3, 2, 0.5);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });
});

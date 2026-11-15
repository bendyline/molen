import { describe, expect, it } from 'vitest';
import { GrowableFloats } from '../src/linear-features';

describe('GrowableFloats', () => {
  it('grows past its capacity and returns exactly what was written', () => {
    const floats = new GrowableFloats(2);
    floats.push(1);
    floats.push3(2, 3, 4);
    floats.push4(5, 6, 7, 8);
    expect(floats.length).toBe(8);
    expect([...floats.toArray()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('pads with zeros, reads and writes in range, and ignores out-of-range writes', () => {
    const floats = new GrowableFloats(1);
    floats.push(1.5);
    floats.padTo(4);
    floats.set(2, 9);
    floats.set(10, 7);
    expect(floats.get(2)).toBe(9);
    expect(floats.get(10)).toBe(0);
    const array = floats.toArray();
    expect(array).toBeInstanceOf(Float32Array);
    expect([...array]).toEqual([1.5, 0, 9, 0]);
  });
});

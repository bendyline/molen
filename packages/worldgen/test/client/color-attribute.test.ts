import { BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { packedColorAttribute } from '../../src/client/color-attribute';

describe('packed vertex colors', () => {
  it('preserves normalized RGB values and the source buffer with a four-byte vertex stride', () => {
    const backing = new Uint8Array([99, 10, 128, 255, 0, 85, 190, 99]);
    const source = backing.subarray(1, 7);
    const before = backing.slice();
    const legacy = new BufferAttribute(source, 3, true);
    const attribute = packedColorAttribute(source);
    expect(attribute.itemSize).toBe(3);
    expect(attribute.normalized).toBe(true);
    expect(attribute.count).toBe(legacy.count);
    expect(attribute.data.stride * attribute.array.BYTES_PER_ELEMENT).toBe(4);
    for (let vertex = 0; vertex < legacy.count; vertex++) {
      expect([attribute.getX(vertex), attribute.getY(vertex), attribute.getZ(vertex)]).toEqual([
        legacy.getX(vertex),
        legacy.getY(vertex),
        legacy.getZ(vertex),
      ]);
    }
    expect(backing).toEqual(before);
  });
});

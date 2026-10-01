import { BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { packedColorAttribute, packedNormalAttribute } from '../../src/client/color-attribute';

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

describe('packed vertex normals', () => {
  it('preserves normalized signed-byte normals with a four-byte vertex stride', () => {
    const source = new Int8Array([127, 0, 0, 0, -127, 0, 90, 0, -90]);
    const before = source.slice();
    const legacy = new BufferAttribute(source, 3, true);
    const attribute = packedNormalAttribute(source);
    expect(attribute.itemSize).toBe(3);
    expect(attribute.normalized).toBe(true);
    expect(attribute.array).toBeInstanceOf(Int8Array);
    expect(attribute.count).toBe(legacy.count);
    expect(attribute.data.stride * attribute.array.BYTES_PER_ELEMENT).toBe(4);
    for (let vertex = 0; vertex < legacy.count; vertex++) {
      expect([attribute.getX(vertex), attribute.getY(vertex), attribute.getZ(vertex)]).toEqual([
        legacy.getX(vertex),
        legacy.getY(vertex),
        legacy.getZ(vertex),
      ]);
    }
    expect(source).toEqual(before);
  });
});

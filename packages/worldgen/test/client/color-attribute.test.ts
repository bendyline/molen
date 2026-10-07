import { BufferAttribute } from 'three';
import { describe, expect, it } from 'vitest';
import { packedColorAttribute, paddedVec3Attribute } from '../../src/client/color-attribute';
import { SRGB_TO_LINEAR_BYTE } from '../../src/kernel/schema-common';

describe('packed vertex colors', () => {
  it('decodes sRGB bytes to linear and keeps the source buffer, with a four-byte vertex stride', () => {
    const backing = new Uint8Array([99, 10, 128, 255, 0, 85, 190, 99]);
    const source = backing.subarray(1, 7);
    const before = backing.slice();
    const legacy = new BufferAttribute(
      Uint8Array.from(source, (value) => SRGB_TO_LINEAR_BYTE[value] as number),
      3,
      true,
    );
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

  it('decodes the sRGB transfer curve at its anchors', () => {
    expect(SRGB_TO_LINEAR_BYTE[0]).toBe(0);
    expect(SRGB_TO_LINEAR_BYTE[255]).toBe(255);
    // sRGB 50% grey is about 21.4% linear.
    expect(SRGB_TO_LINEAR_BYTE[128]).toBe(55);
  });
});

describe('padded vec3 attributes', () => {
  it('wraps GPU-ready vertices without copying, on four-byte boundaries', () => {
    for (const padded of [
      new Int16Array([32767, 0, -32767, 0, -32768, 16384, 1, 0]),
      new Int8Array([127, 0, -127, 0, 0, -127, 0, 0]),
      new Uint8Array([255, 0, 128, 0, 10, 20, 30, 0]),
    ]) {
      const attribute = paddedVec3Attribute(padded);
      // Shared, not copied: a cache of prepared cells and the live geometry hold one buffer.
      expect(attribute.array).toBe(padded);
      expect(attribute.itemSize).toBe(3);
      expect(attribute.normalized).toBe(true);
      expect(attribute.count).toBe(2);
      expect((attribute.data.stride * padded.BYTES_PER_ELEMENT) % 4).toBe(0);
    }
    // snorm16 decodes symmetrically and clamps the one extra negative value.
    const positions = paddedVec3Attribute(
      new Int16Array([32767, 0, -32767, 0, -32768, 16384, 1, 0]),
    );
    expect([positions.getX(0), positions.getY(0), positions.getZ(0)]).toEqual([1, 0, -1]);
    expect(positions.getX(1)).toBe(-1);
    expect(positions.getY(1)).toBeCloseTo(16384 / 32767, 12);
  });
});

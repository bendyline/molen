import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  compactAttribute,
  isCompactAttribute,
  packSnorm8x4,
  packUnorm8x4,
} from '../src/compact-attributes';

describe('compact vertex attributes', () => {
  it('packs unit normals into four signed bytes a vertex that read back within a step', () => {
    const normals = [0, 1, 0, 0.6, 0.8, 0, -0.267, 0.534, 0.802];
    const packed = packSnorm8x4(normals, 3);
    expect(packed).toBeInstanceOf(Int8Array);
    expect(packed.length).toBe(12);
    expect([...packed.slice(0, 4)]).toEqual([0, 127, 0, 0]);
    const attribute = compactAttribute(packed);
    expect(attribute.itemSize).toBe(4);
    expect(attribute.normalized).toBe(true);
    expect(isCompactAttribute(attribute)).toBe(true);
    for (let v = 0; v < 3; v++)
      for (let c = 0; c < 3; c++)
        expect(
          Math.abs(attribute.getComponent(v, c) - (normals[v * 3 + c] as number)),
        ).toBeLessThan(0.5 / 127 + 1e-6);
  });

  it('packs colors into four unsigned bytes with an opaque alpha, clamping out-of-range values', () => {
    const packed = packUnorm8x4([0, 0.5, 1, 1.2, -0.1, 0.25], 3);
    expect(packed).toBeInstanceOf(Uint8Array);
    expect([...packed]).toEqual([0, 128, 255, 255, 255, 0, 64, 255]);
    // Four components pass through, the fourth included.
    expect([...packUnorm8x4([0.2, 0.4, 0.6, 0.8], 4)]).toEqual([51, 102, 153, 204]);
  });

  it('leaves float attributes unmarked', () => {
    expect(isCompactAttribute(new THREE.Float32BufferAttribute([0, 1, 0], 3))).toBe(false);
    expect(isCompactAttribute(new THREE.BufferAttribute(new Uint8Array(4), 4, false))).toBe(false);
  });
});

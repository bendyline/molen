/**
 * Compare a worker-built mesh's attribute with the same mesh built on the calling thread.
 *
 * Workers pack unit normals, linear colors and blend weights into normalized bytes
 * (src/compact-attributes.ts); everything else crosses unchanged. A packed attribute matches when
 * each component is within half a quantization step of the in-thread value (clamped to the packed
 * range); any other attribute must match byte for byte.
 */
import { Buffer } from 'node:buffer';
import type * as THREE from 'three';
import { expect } from 'vitest';
import { isCompactAttribute } from '../../src/compact-attributes';

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;

export function expectSameAttribute(
  actual: Attribute | undefined,
  wanted: Attribute | undefined,
  name = 'attribute',
): void {
  expect(actual === undefined, `${name} present`).toBe(wanted === undefined);
  if (actual === undefined || wanted === undefined) return;
  if (!isCompactAttribute(actual)) {
    const a = actual.array as ArrayLike<number> & ArrayBufferView;
    const b = wanted.array as ArrayLike<number> & ArrayBufferView;
    expect(a.constructor, `${name} type`).toBe(b.constructor);
    expect(
      Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(
        Buffer.from(b.buffer, b.byteOffset, b.byteLength),
      ),
      `${name} bytes`,
    ).toBe(true);
    return;
  }
  expect(actual.count, `${name} count`).toBe(wanted.count);
  const signed = actual.array instanceof Int8Array;
  const tolerance = (signed ? 0.5 / 127 : 0.5 / 255) + 1e-6;
  let worst = 0;
  for (let v = 0; v < wanted.count; v++)
    for (let c = 0; c < Math.min(wanted.itemSize, 4); c++) {
      const want = Math.max(signed ? -1 : 0, Math.min(1, wanted.getComponent(v, c)));
      worst = Math.max(worst, Math.abs(actual.getComponent(v, c) - want));
    }
  expect(worst, `${name} largest difference`).toBeLessThanOrEqual(tolerance);
}

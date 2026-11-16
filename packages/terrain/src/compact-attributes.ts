/**
 * Compact vertex attributes for the meshes terrain workers build.
 *
 * A draped road band or land cover patch stored every attribute as 32-bit floats: position,
 * normal and color alone took 36 bytes a vertex, land cover 88 with its blend and soil colors. A
 * unit normal and a [0, 1] color need no such range, so workers pack them into normalized bytes
 * before transferring (`packSnorm8x4`, `packUnorm8x4`) and the rendering thread wraps them as
 * normalized attributes (`compactAttribute`); the GPU expands them back to floats as it reads
 * them, so shaders are unchanged: a road vertex drops from 52 bytes to 36, a land cover vertex
 * from 88 to 52. Positions, and attributes measured in meters (`surfaceDetail`), stay floats.
 *
 * Four components per vertex, always: WebGPU has no three-component 8-bit vertex format (three.js
 * pads the format but not the stride, which WebGPU rejects). A packed normal's fourth component
 * is 0 and a packed color's is 255 (opaque), so `vertexColors` materials see alpha 1. WebGL
 * shaders that declare a vec3 ignore the extra component.
 *
 * Related: surface-worker.ts and landcover-worker.ts (the producers), ground-cutout.ts (keeps the
 * packed types when it cuts openings).
 */

import * as THREE from 'three';

/** Values in [-1, 1] (unit normals) as signed normalized bytes, four to a vertex (w = 0). */
export function packSnorm8x4(values: ArrayLike<number>, itemSize: number): Int8Array {
  const count = Math.floor(values.length / itemSize);
  const out = new Int8Array(count * 4);
  const used = Math.min(itemSize, 4);
  for (let v = 0; v < count; v++)
    for (let c = 0; c < used; c++) {
      const value = values[v * itemSize + c] as number;
      out[v * 4 + c] = Math.round(Math.max(-1, Math.min(1, value)) * 127);
    }
  return out;
}

/**
 * Values in [0, 1] (linear colors, blend weights) as unsigned normalized bytes, four to a vertex.
 * A missing fourth component is 1 (255).
 */
export function packUnorm8x4(values: ArrayLike<number>, itemSize: number): Uint8Array {
  const count = Math.floor(values.length / itemSize);
  const out = new Uint8Array(count * 4);
  const used = Math.min(itemSize, 4);
  for (let v = 0; v < count; v++) {
    for (let c = 0; c < used; c++) {
      const value = values[v * itemSize + c] as number;
      out[v * 4 + c] = Math.round(Math.max(0, Math.min(1, value)) * 255);
    }
    if (used < 4) out[v * 4 + 3] = 255;
  }
  return out;
}

/** A packed attribute (from `packSnorm8x4` or `packUnorm8x4`) as a normalized vec4 attribute. */
export function compactAttribute(packed: Int8Array | Uint8Array): THREE.BufferAttribute {
  return new THREE.BufferAttribute(packed, 4, true);
}

/** Whether an attribute holds packed normalized bytes (see this module). */
export function isCompactAttribute(
  attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
): boolean {
  return (
    attribute.normalized &&
    (attribute.array instanceof Int8Array || attribute.array instanceof Uint8Array)
  );
}

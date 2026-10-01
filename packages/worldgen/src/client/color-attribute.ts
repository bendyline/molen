import * as THREE from 'three';

/** Copies three-byte vertices into four-byte slots; the fourth byte is padding. */
function padToFour<T extends Uint8Array | Int8Array>(source: T, target: T): T {
  for (let from = 0, to = 0; from < source.length; from += 3, to += 4) {
    target[to] = source[from] as number;
    target[to + 1] = source[from + 1] as number;
    target[to + 2] = source[from + 2] as number;
  }
  return target;
}

/** Keep RGB semantics while aligning each packed vertex to WebGPU's four-byte stride. */
export function packedColorAttribute(colors: Uint8Array): THREE.InterleavedBufferAttribute {
  const padded = padToFour(colors, new Uint8Array((colors.length / 3) * 4));
  // The fourth byte is padding, not alpha. WebGL retains its existing vec3 color shader;
  // WebGPU can fetch the same RGB values from a supported, aligned unorm8x4 vertex format.
  return new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(padded, 4), 3, 0, true);
}

/**
 * Signed-byte unit normals, padded like colors. WebGPU has no three-byte vertex format: three.js
 * fetches a bare normalized Int8 vec3 as snorm8x4 but keeps its three-byte stride, which fails
 * pipeline validation and drops every draw in the frame.
 */
export function packedNormalAttribute(normals: Int8Array): THREE.InterleavedBufferAttribute {
  const padded = padToFour(normals, new Int8Array((normals.length / 3) * 4));
  return new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(padded, 4), 3, 0, true);
}

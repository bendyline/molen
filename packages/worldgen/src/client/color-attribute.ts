import * as THREE from 'three';

/**
 * Wraps normalized (x, y, z, pad) vertices without copying. Each vertex starts on a four-byte
 * boundary, as WebGPU requires, and normalized data reaches the GPU at its own width: three.js
 * widens only unnormalized 8- and 16-bit attributes to 32 bits on WebGPU.
 */
export function paddedVec3Attribute(
  padded: Int16Array | Int8Array | Uint8Array,
): THREE.InterleavedBufferAttribute {
  return new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(padded, 4), 3, 0, true);
}

/** Keep RGB semantics while aligning each packed vertex to WebGPU's four-byte stride. */
export function packedColorAttribute(colors: Uint8Array): THREE.InterleavedBufferAttribute {
  const padded = new Uint8Array((colors.length / 3) * 4);
  for (let source = 0, target = 0; source < colors.length; source += 3, target += 4) {
    padded[target] = colors[source] as number;
    padded[target + 1] = colors[source + 1] as number;
    padded[target + 2] = colors[source + 2] as number;
  }
  // The fourth byte is padding, not alpha. WebGL retains its existing vec3 color shader;
  // WebGPU can fetch the same RGB values from a supported, aligned unorm8x4 vertex format.
  return paddedVec3Attribute(padded);
}

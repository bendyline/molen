import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * three's `mergeVertices`, with the same result: vertices whose every attribute component
 * truncates to the same multiple of `tolerance` become one, in first-use order, with the same
 * attribute classes and index type. Its key per vertex was a string of every component, printed
 * and concatenated, in a dictionary; welding a land cover tile that way took over half of the
 * land cover worker's time, which a jet's tiles queued behind for seconds. This keys a numeric
 * hash table instead. Morph targets and interleaved or normalized attributes use three's.
 */
export function weldVertices(
  geometry: THREE.BufferGeometry,
  tolerance = 1e-4,
): THREE.BufferGeometry {
  const names = Object.keys(geometry.attributes);
  const attributes = names.map((name) => geometry.attributes[name]);
  const index = geometry.index;
  if (
    Object.keys(geometry.morphAttributes).length > 0 ||
    attributes.some(
      (attribute) =>
        !(attribute instanceof THREE.BufferAttribute) ||
        attribute.normalized ||
        attribute.itemSize > 4,
    ) ||
    index?.normalized === true
  )
    return mergeVertices(geometry, tolerance);
  const plain = attributes as THREE.BufferAttribute[];
  const arrays = plain.map((attribute) => attribute.array);
  const sizes = plain.map((attribute) => attribute.itemSize);
  const components = sizes.reduce((sum, size) => sum + size, 0);
  // three's quantization, step for step.
  const step = Math.max(tolerance, Number.EPSILON);
  const multiplier = 10 ** Math.log10(1 / step);
  const additive = step * 0.5 * multiplier;
  const vertexCount =
    index !== null ? index.count : (geometry.getAttribute('position')?.count ?? 0);
  const key = new Int32Array(components);
  const other = new Int32Array(components);
  const quantize = (vertex: number, out: Int32Array): number => {
    let hash = 0x811c9dc5;
    let c = 0;
    for (let a = 0; a < arrays.length; a++) {
      const array = arrays[a] as THREE.TypedArray;
      const size = sizes[a] as number;
      const base = vertex * size;
      for (let k = 0; k < size; k++) {
        // ToInt32, like three's double tilde.
        const value = ((array[base + k] as number) * multiplier + additive) | 0;
        out[c++] = value;
        hash = Math.imul(hash ^ value, 0x01000193);
      }
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    return hash;
  };
  let tableSize = 16;
  while (tableSize < vertexCount * 2) tableSize *= 2;
  const mask = tableSize - 1;
  const table = new Int32Array(tableSize).fill(-1);
  // Per welded vertex: the source vertex it was first seen as, and its hash.
  const sources = new Int32Array(vertexCount);
  const hashes = new Int32Array(vertexCount);
  const outputs = plain.map((attribute) => {
    const ArrayType = attribute.array.constructor as new (length: number) => THREE.TypedArray;
    return new ArrayType(attribute.count * attribute.itemSize);
  });
  const welded = new Uint32Array(vertexCount);
  let next = 0;
  for (let i = 0; i < vertexCount; i++) {
    const source = index !== null ? (index.array[i] as number) : i;
    const hash = quantize(source, key);
    let slot = hash & mask;
    let found = -1;
    for (let entry = table[slot] as number; entry !== -1; entry = table[slot] as number) {
      if (hashes[entry] === hash) {
        quantize(sources[entry] as number, other);
        let same = true;
        for (let c = 0; c < components && same; c++) same = key[c] === other[c];
        if (same) {
          found = entry;
          break;
        }
      }
      slot = (slot + 1) & mask;
    }
    if (found < 0) {
      found = next++;
      table[slot] = found;
      sources[found] = source;
      hashes[found] = hash;
      for (let a = 0; a < arrays.length; a++) {
        const size = sizes[a] as number;
        const from = arrays[a] as THREE.TypedArray;
        const to = outputs[a] as THREE.TypedArray;
        for (let k = 0; k < size; k++) to[found * size + k] = from[source * size + k] as number;
      }
    }
    welded[i] = found;
  }
  // What `geometry.clone()` carries besides attributes and index, without copying those.
  const result = new THREE.BufferGeometry();
  result.name = geometry.name;
  for (const group of geometry.groups)
    result.addGroup(group.start, group.count, group.materialIndex);
  if (geometry.boundingBox !== null) result.boundingBox = geometry.boundingBox.clone();
  if (geometry.boundingSphere !== null) result.boundingSphere = geometry.boundingSphere.clone();
  result.drawRange.start = geometry.drawRange.start;
  result.drawRange.count = geometry.drawRange.count;
  result.morphTargetsRelative = geometry.morphTargetsRelative;
  result.userData = geometry.userData;
  for (let a = 0; a < names.length; a++) {
    const attribute = plain[a] as THREE.BufferAttribute;
    const AttributeType = attribute.constructor as new (
      array: THREE.TypedArray,
      itemSize: number,
      normalized?: boolean,
    ) => THREE.BufferAttribute;
    result.setAttribute(
      names[a] as string,
      new AttributeType(
        (outputs[a] as THREE.TypedArray).slice(0, next * attribute.itemSize),
        attribute.itemSize,
        attribute.normalized,
      ),
    );
  }
  // `setIndex` with a plain array picks 32-bit indices from 65535 up (primitive restart).
  result.setIndex(
    next - 1 >= 65535
      ? new THREE.Uint32BufferAttribute(welded, 1)
      : new THREE.Uint16BufferAttribute(welded, 1),
  );
  return result;
}

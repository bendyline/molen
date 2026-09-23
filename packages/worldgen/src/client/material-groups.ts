import * as THREE from 'three';
import type { MeshGroup } from '../kernel/types';
import type { WorldgenMaterialSet } from './upload';

/** Consolidate opaque compatible groups by the actual resolved material, preserving source data. */
export function bindMaterialGroups(
  geometry: THREE.BufferGeometry,
  groups: readonly MeshGroup[],
  materials: WorldgenMaterialSet,
): THREE.Material[] {
  const source = geometry.index;
  if (source === null) return [];
  const list: THREE.Material[] = [];
  const batches: Array<{
    material: THREE.Material;
    ranges: Array<{ start: number; count: number }>;
  }> = [];
  const opaque = new Map<THREE.Material, number>();
  for (const group of groups) {
    if (group.count === 0) continue;
    const material = materials.materialFor(group.slot, group.materialRef);
    // Transparent ordering is observable. Preserve its original groups and submission order.
    let index =
      !material.transparent && material.depthWrite && material.depthTest
        ? opaque.get(material)
        : undefined;
    if (index === undefined) {
      index = batches.length;
      batches.push({ material, ranges: [] });
      if (!material.transparent && material.depthWrite && material.depthTest)
        opaque.set(material, index);
    }
    batches[index]?.ranges.push(group);
  }
  geometry.clearGroups();
  const ordered = batches.flatMap((batch) => batch.ranges);
  const original = groups.filter((g) => g.count > 0);
  const reordered =
    ordered.some((range, i) => range !== original[i]) ||
    batches.some((batch) =>
      batch.ranges.some(
        (range, i) =>
          i > 0 &&
          range.start !== (batch.ranges[i - 1]?.start ?? 0) + (batch.ranges[i - 1]?.count ?? 0),
      ),
    );
  let indices: Uint16Array | Uint32Array | undefined;
  if (reordered)
    indices =
      source.array instanceof Uint16Array
        ? new Uint16Array(source.count)
        : new Uint32Array(source.count);
  let offset = 0;
  for (const batch of batches) {
    const start = offset;
    for (const range of batch.ranges) {
      if (indices !== undefined)
        indices.set(source.array.subarray(range.start, range.start + range.count), offset);
      offset += range.count;
    }
    geometry.addGroup(
      indices === undefined ? (batch.ranges[0]?.start ?? start) : start,
      offset - start,
      list.length,
    );
    list.push(batch.material);
  }
  if (indices !== undefined)
    geometry.setIndex(new THREE.BufferAttribute(indices.subarray(0, offset), 1));
  return list;
}

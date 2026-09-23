import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { bindMaterialGroups } from '../../src/client/material-groups';
import type { MeshGroup } from '../../src/kernel/types';

describe('resolved material grouping', () => {
  it('merges two wall references resolving to one material and preserves triangles', () => {
    const material = new THREE.MeshStandardMaterial();
    const geometry = new THREE.BufferGeometry().setIndex([0, 1, 2, 3, 4, 5]);
    const groups: MeshGroup[] = [
      { start: 0, count: 3, slot: 'wall', materialRef: 'a' },
      { start: 3, count: 3, slot: 'wall', materialRef: 'b' },
    ];
    const source = geometry.index;
    expect(bindMaterialGroups(geometry, groups, { materialFor: () => material })).toEqual([
      material,
    ]);
    expect(geometry.groups).toEqual([{ start: 0, count: 6, materialIndex: 0 }]);
    expect(geometry.index).toBe(source);
    material.dispose();
    geometry.dispose();
  });
  it('reorders nonadjacent opaque ranges into one draw per identity without mutating source indices', () => {
    const a = new THREE.MeshStandardMaterial(),
      b = new THREE.MeshStandardMaterial();
    const geometry = new THREE.BufferGeometry().setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    const original = geometry.index?.array.slice();
    const groups: MeshGroup[] = ['a', 'b', 'a'].map((materialRef, i) => ({
      start: i * 3,
      count: 3,
      slot: 'wall',
      materialRef,
    }));
    expect(
      bindMaterialGroups(geometry, groups, { materialFor: (_, ref) => (ref === 'a' ? a : b) }),
    ).toHaveLength(2);
    expect(Array.from(geometry.index?.array ?? [])).toEqual([0, 1, 2, 6, 7, 8, 3, 4, 5]);
    expect(Array.from(original ?? [])).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    a.transparent = true;
    const transparent = new THREE.BufferGeometry().setIndex([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(
      bindMaterialGroups(transparent, groups, { materialFor: (_, ref) => (ref === 'a' ? a : b) }),
    ).toHaveLength(3);
    a.dispose();
    b.dispose();
    geometry.dispose();
    transparent.dispose();
  });
});

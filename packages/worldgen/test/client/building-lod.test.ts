import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBuildingDetailLod } from '../../src/client/building-lod';
import { ScreenSpaceLod } from '../../src/client/screen-space-lod';
import { disposeWorldgenObject } from '../../src/client/upload';
import { generateBuilding } from '../../src/kernel/building';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';
import { FLAT_GROUND, type MeshBuffers, type Vec2 } from '../../src/kernel/types';
import { createTestPack } from '../helpers/pack';
import { SHAPES } from '../helpers/shapes';

const pack = await createTestPack();
const style = pack.archstyles['test.pack.house'];
if (style === undefined) throw new Error('test pack missing house style');

function fixture(): MeshBuffers {
  const builder = new MeshBufferBuilder();
  for (const offset of [20, 1_044]) {
    generateBuilding(
      {
        request: {
          identity: `detail-house:${offset}`,
          labels: ['house'],
          outline: (SHAPES.L as Vec2[]).map(([x, z]): Vec2 => [x + offset, z + 20]),
          levels: 2,
        },
        style,
        pack: { name: pack.root.name, version: pack.root.version },
        ground: FLAT_GROUND,
        tier: 0,
      },
      builder,
    );
  }
  return builder.finalize();
}

function meshesAt(root: THREE.Group, detail: number): THREE.Mesh[] {
  return root.children.map((cell) => (cell as ScreenSpaceLod).levels[detail]?.object as THREE.Mesh);
}

function verticesAt(root: THREE.Group, detail: number): number[] {
  return meshesAt(root, detail).flatMap((mesh) =>
    Array.from(mesh.geometry.index?.array ?? []).flatMap((index) =>
      Array.from(mesh.geometry.getAttribute('position').array.slice(index * 3, index * 3 + 3)),
    ),
  );
}
function sourceVertices(buffers: MeshBuffers, indices: readonly number[]): number[] {
  return indices.flatMap((index) => Array.from(buffers.positions.slice(index * 3, index * 3 + 3)));
}

// Compare whole oriented triangles, allowing only cell/group reordering.
const sorted = (values: number[]): string[] => {
  const triangles: string[] = [];
  for (let i = 0; i < values.length; i += 9) triangles.push(values.slice(i, i + 9).join(','));
  return triangles.sort();
};

describe('building detail cells', () => {
  it('retains every structural face and material in compact cells with shared LOD attributes', () => {
    const buffers = fixture();
    const positions = buffers.positions.slice();
    const inputIndices = buffers.indices.slice();
    const flat = new THREE.MeshStandardMaterial({ vertexColors: true });
    const authored = new Map<string, THREE.Material>();
    const root = createBuildingDetailLod(
      buffers,
      {
        materialFor(slot, ref) {
          const key = `${slot}:${ref}`;
          let material = authored.get(key);
          if (!material) {
            material = new THREE.MeshStandardMaterial();
            authored.set(key, material);
          }
          return material;
        },
      },
      flat,
      { viewportHeight: 1_000, maxPixelError: 1 },
    );
    expect(root.children).toHaveLength(2);
    expect(root.children.every((cell) => cell instanceof ScreenSpaceLod)).toBe(true);
    expect(sorted(verticesAt(root, 0))).toEqual(
      sorted(sourceVertices(buffers, Array.from(inputIndices))),
    );
    expect(sorted(verticesAt(root, 1))).toEqual(
      sorted(sourceVertices(buffers, Array.from(inputIndices))),
    );
    const structure = buffers.groups
      .filter((group) => ['wall', 'roof', 'foundation'].includes(group.slot))
      .flatMap((group) =>
        Array.from(buffers.indices.subarray(group.start, group.start + group.count)),
      );
    expect(structure.length).toBeGreaterThan(0);
    expect(structure.length).toBeLessThan(buffers.indices.length);
    expect(sorted(verticesAt(root, 2))).toEqual(sorted(sourceVertices(buffers, structure)));

    const allMeshes = [0, 1, 2].flatMap((detail) => meshesAt(root, detail));
    for (let cell = 0; cell < root.children.length; cell++) {
      const first = meshesAt(root, 0)[cell] as THREE.Mesh;
      for (const mesh of [0, 1, 2].map((detail) => meshesAt(root, detail)[cell] as THREE.Mesh)) {
        expect(mesh.geometry.getAttribute('position')).toBe(
          first.geometry.getAttribute('position'),
        );
        expect(mesh.geometry.getAttribute('normal')).toBe(first.geometry.getAttribute('normal'));
        expect(mesh.geometry.getAttribute('uv')).toBe(first.geometry.getAttribute('uv'));
        expect(mesh.geometry.getAttribute('color')).toBe(first.geometry.getAttribute('color'));
        expect(mesh.geometry.index?.array).toBeInstanceOf(Uint16Array);
        expect(mesh.geometry.getAttribute('position').array.length).toBeLessThan(
          buffers.positions.length,
        );
        expect(mesh.geometry.getAttribute('color').normalized).toBe(true);
        expect(
          (mesh.geometry.getAttribute('color') as THREE.InterleavedBufferAttribute).data.stride,
        ).toBe(4);
      }
    }
    expect(new Set(allMeshes.map((mesh) => mesh.geometry.index?.array.buffer)).size).toBe(
      root.children.length * 2,
    );
    for (const mesh of meshesAt(root, 0)) {
      expect(Array.isArray(mesh.material)).toBe(true);
      expect(mesh.geometry.groups.length).toBeGreaterThan(1);
      for (const group of mesh.geometry.groups) {
        expect((mesh.material as THREE.Material[])[group.materialIndex as number]).toBeDefined();
      }
    }
    for (const detail of [1, 2]) {
      for (const mesh of meshesAt(root, detail)) {
        expect(mesh.material).toBe(flat);
        expect(mesh.geometry.groups).toHaveLength(0);
      }
    }
    expect(buffers.positions).toEqual(positions);
    expect(buffers.indices).toEqual(inputIndices);
    disposeWorldgenObject(root);
    for (const material of authored.values()) material.dispose();
    flat.dispose();
  });

  it('keeps conservative cell bounds and world geometry through culling and floating-origin changes', () => {
    const buffers = fixture();
    const material = new THREE.MeshBasicMaterial();
    const root = createBuildingDetailLod(buffers, { materialFor: () => material }, material, {
      viewportHeight: 720,
      maxPixelError: 1,
    });
    root.position.set(9_000_000, 100, -4_000_000);
    root.updateMatrixWorld(true);
    const near = meshesAt(root, 0)[0] as THREE.Mesh;
    const far = meshesAt(root, 0)[1] as THREE.Mesh;
    const position = new THREE.Vector3();
    for (const detail of [0, 1, 2]) {
      for (const mesh of meshesAt(root, detail)) {
        const sphere = mesh.geometry.boundingSphere as THREE.Sphere;
        const box = mesh.geometry.boundingBox as THREE.Box3;
        expect(sphere.radius).toBeLessThan(100);
        for (const index of mesh.geometry.index?.array ?? []) {
          position.fromBufferAttribute(mesh.geometry.getAttribute('position'), index);
          expect(box.containsPoint(position)).toBe(true);
          expect(position.distanceTo(sphere.center)).toBeLessThanOrEqual(sphere.radius + 1e-6);
          const expected = position.clone().add(root.position);
          position.applyMatrix4(mesh.matrixWorld);
          expect(position.distanceTo(expected)).toBeLessThan(1e-6);
        }
      }
    }
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 150);
    camera.position.copy(root.position).add(new THREE.Vector3(30, 20, 70));
    camera.lookAt(root.position.clone().add(new THREE.Vector3(26, 5, 26)));
    const visible = (): [boolean, boolean] => {
      camera.updateMatrixWorld(true);
      root.updateMatrixWorld(true);
      const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      );
      return [frustum.intersectsObject(near), frustum.intersectsObject(far)];
    };
    expect(visible()).toEqual([true, false]);
    root.position.x -= 9_000_000;
    root.position.z += 4_000_000;
    camera.position.x -= 9_000_000;
    camera.position.z += 4_000_000;
    expect(visible()).toEqual([true, false]);
    let disposals = 0;
    for (const mesh of [0, 1, 2].flatMap((detail) => meshesAt(root, detail))) {
      mesh.geometry.addEventListener('dispose', () => {
        disposals++;
      });
    }
    let materialDisposals = 0;
    material.addEventListener('dispose', () => {
      materialDisposals++;
    });
    disposeWorldgenObject(root);
    expect(disposals).toBe(6);
    expect(materialDisposals).toBe(0);
    material.dispose();
  });

  it('rejects invalid cell sizes instead of silently creating unusable spatial bounds', () => {
    const buffers = fixture();
    const material = new THREE.MeshBasicMaterial();
    for (const size of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        createBuildingDetailLod(
          buffers,
          { materialFor: () => material },
          material,
          { viewportHeight: 720, maxPixelError: 1 },
          'invalid',
          size,
        ),
      ).toThrow();
    }
    material.dispose();
  });
});

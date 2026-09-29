import type { MaterialResolver } from '@bendyline/molen-client';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { createResolvedMaterialSet } from '../../src/client/materials';
import { StructureModelLibrary } from '../../src/client/structure-models';
import { encodeGlb, type GlbSharedSurface } from '../../src/kernel/glb';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';

const surface: GlbSharedSurface = { ref: 'matgraph:shared.planks', slot: 'wall', uv: 'repeats' };

function surfaceGlb(): Uint8Array {
  const builder = new MeshBufferBuilder();
  builder.addTriangle(
    'wall',
    'palette:#ffffff',
    [
      [0, 0, 0],
      [4, 0, 0],
      [0, 2, 0],
    ],
    [0, 0, 1],
    [
      [0, 0],
      [4, 0],
      [0, 2],
    ],
    [0.8, 0.6, 0.4],
  );
  return encodeGlb(builder.finalize(), [{ name: 'shared-planks', sharedSurface: surface }]);
}

function firstMesh(
  scene: THREE.Object3D,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  let found: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | undefined;
  scene.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) found ??= object as typeof found;
  });
  if (!found) throw new Error('fixture did not contain a mesh');
  return found;
}

function texture(): THREE.DataTexture {
  return new THREE.DataTexture(new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]), 2, 1);
}

describe('landmark shared-surface integration', () => {
  it('round-trips material extras through GLB and shares one progressively prepared texture across models', async () => {
    const bytes = surfaceGlb();
    const loaded: THREE.MeshStandardMaterial[] = [];
    const image = texture();
    const source = new THREE.MeshStandardMaterial({ map: image });
    const sourceDispose = vi.spyOn(source, 'dispose');
    const imageDispose = vi.spyOn(image, 'dispose');
    const resolver = {
      acquire: vi.fn(async () => source),
      release: vi.fn((material: THREE.MeshStandardMaterial) => {
        material.map?.dispose();
        material.dispose();
      }),
    };
    const materials = createResolvedMaterialSet(resolver as unknown as MaterialResolver, {
      progressive: true,
    });
    const library = new StructureModelLibrary(
      async () => {
        const gltf = await new GLTFLoader().parseAsync(new Uint8Array(bytes).buffer, '');
        const mesh = firstMesh(gltf.scene);
        expect(mesh.material.userData.molenSurface).toEqual(surface);
        expect(mesh.geometry.getAttribute('uv').getX(1)).toBe(4);
        expect(mesh.geometry.getAttribute('uv').getY(2)).toBe(2);
        expect(mesh.material.vertexColors).toBe(true);
        loaded.push(mesh.material);
        return gltf.scene;
      },
      { resolveSurface: ({ ref, slot }) => materials.materialFor(slot, ref) },
    );

    const [a, b] = await Promise.all([
      library.acquire('building-a'),
      library.acquire('building-b'),
    ]);
    const meshA = firstMesh(a.scene),
      meshB = firstMesh(b.scene);
    expect(loaded).toHaveLength(2);
    expect(loaded[0]).not.toBe(loaded[1]);
    expect(meshA.material).toBe(meshB.material);
    expect(meshA.material.map).toBeNull();
    const instance = firstMesh(library.instantiate(a));
    const borrowedDispose = vi.spyOn(meshA.material, 'dispose');
    await Promise.all([materials.prepare([surface.ref]), materials.prepare([surface.ref])]);
    expect(resolver.acquire).toHaveBeenCalledExactlyOnceWith(surface.ref);
    expect(meshA.material.map).toBe(image);
    expect(meshB.material.map).toBe(image);
    expect(instance.material.map).toBe(image);
    expect(image.wrapS).toBe(THREE.RepeatWrapping);

    library.release('building-a');
    library.release('building-b');
    library.dispose();
    expect(borrowedDispose).not.toHaveBeenCalled();
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(imageDispose).not.toHaveBeenCalled();
    materials.dispose();
    expect(borrowedDispose).toHaveBeenCalledTimes(1);
    expect(sourceDispose).toHaveBeenCalledTimes(1);
    expect(imageDispose).toHaveBeenCalledTimes(1);
  });

  it('keeps unique fallback images alive when replaced and retained materials share an image', async () => {
    const image = texture();
    const original = new THREE.MeshStandardMaterial({ map: image });
    original.userData.molenSurface = surface;
    const unique = new THREE.MeshPhysicalMaterial({ map: image, clearcoat: 0.75 });
    const uniqueMesh = new THREE.Mesh(new THREE.BoxGeometry(), unique);
    const scene = new THREE.Group();
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), original), uniqueMesh);
    const borrowed = new THREE.MeshStandardMaterial({ map: texture() });
    const originalDispose = vi.spyOn(original, 'dispose');
    const uniqueDispose = vi.spyOn(unique, 'dispose');
    const imageDispose = vi.spyOn(image, 'dispose');
    const resolveSurface = vi.fn(() => borrowed);
    const library = new StructureModelLibrary(async () => scene, { resolveSurface });
    await library.acquire('mixed');
    expect(resolveSurface).toHaveBeenCalledExactlyOnceWith(surface);
    expect(originalDispose).toHaveBeenCalledTimes(1);
    expect(uniqueMesh.material).toBe(unique);
    expect(uniqueMesh.material.map).toBe(image);
    expect(uniqueMesh.material.clearcoat).toBe(0.75);
    expect(uniqueDispose).not.toHaveBeenCalled();
    expect(imageDispose).not.toHaveBeenCalled();
    library.release('mixed');
    expect(uniqueDispose).toHaveBeenCalledTimes(1);
    expect(imageDispose).toHaveBeenCalledTimes(1);
    library.dispose();
    borrowed.map?.dispose();
    borrowed.dispose();
  });

  it('retains an original material on UV-less meshes even when another mesh can bind it', async () => {
    const image = texture();
    const original = new THREE.MeshStandardMaterial({ map: image });
    original.userData.molenSurface = surface;
    const withUv = new THREE.Mesh(new THREE.BoxGeometry(), original);
    const withoutUv = new THREE.Mesh(new THREE.BoxGeometry(), original);
    withoutUv.geometry.deleteAttribute('uv');
    const scene = new THREE.Group();
    scene.add(withUv, withoutUv);
    const borrowed = new THREE.MeshStandardMaterial();
    const borrowedDispose = vi.spyOn(borrowed, 'dispose');
    const originalDispose = vi.spyOn(original, 'dispose');
    const imageDispose = vi.spyOn(image, 'dispose');
    const resolveSurface = vi.fn(() => borrowed);
    const library = new StructureModelLibrary(async () => scene, { resolveSurface });
    await library.acquire('mixed-uvs');
    expect(withUv.material).toBe(borrowed);
    expect(withoutUv.material).toBe(original);
    expect(resolveSurface).toHaveBeenCalledTimes(1);
    expect(originalDispose).not.toHaveBeenCalled();
    expect(imageDispose).not.toHaveBeenCalled();
    library.dispose();
    expect(originalDispose).toHaveBeenCalledTimes(1);
    expect(imageDispose).toHaveBeenCalledTimes(1);
    expect(borrowedDispose).not.toHaveBeenCalled();
    borrowed.dispose();
  });

  it('disposes owned resources after a resolver error without applying partial bindings or disposing borrowed resources', async () => {
    const a = new THREE.MeshStandardMaterial({ map: texture() });
    const b = new THREE.MeshStandardMaterial({ map: texture() });
    a.userData.molenSurface = surface;
    b.userData.molenSurface = { ...surface, ref: 'matgraph:throws' };
    const meshA = new THREE.Mesh(new THREE.BoxGeometry(), a);
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(), b);
    const scene = new THREE.Group();
    scene.add(meshA, meshB);
    const borrowed = new THREE.MeshStandardMaterial({ map: texture() });
    const borrowedDispose = vi.spyOn(borrowed, 'dispose');
    const borrowedTextureDispose = vi.spyOn(borrowed.map as THREE.Texture, 'dispose');
    const owned = [
      a,
      b,
      a.map as THREE.Texture,
      b.map as THREE.Texture,
      meshA.geometry,
      meshB.geometry,
    ].map((resource) => vi.spyOn(resource, 'dispose'));
    const library = new StructureModelLibrary(async () => scene, {
      resolveSurface: ({ ref }) => {
        if (ref === 'matgraph:throws') throw new Error('surface resolver failed');
        return borrowed;
      },
    });
    await expect(library.acquire('failed')).rejects.toThrow('surface resolver failed');
    expect(meshA.material).toBe(a);
    expect(meshB.material).toBe(b);
    for (const dispose of owned) expect(dispose).toHaveBeenCalledTimes(1);
    library.release('failed');
    library.dispose();
    expect(borrowedDispose).not.toHaveBeenCalled();
    expect(borrowedTextureDispose).not.toHaveBeenCalled();
    borrowed.map?.dispose();
    borrowed.dispose();
  });
});

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { StructureModelLibrary } from '../../src/client/structure-models';

function texturedModel() {
  const texture = new THREE.Texture();
  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    roughness: 0.2,
    metalness: 0.7,
    clearcoat: 0.8,
  });
  const geometry = new THREE.BoxGeometry(10, 20, 30);
  const mesh = new THREE.Mesh(geometry, [material, material]);
  mesh.position.y = 10;
  const scene = new THREE.Group();
  scene.add(mesh);
  return { scene, mesh, geometry, material, texture };
}

describe('full-fidelity structure streaming', () => {
  it('shares an opt-in surface across distinct models and keeps it alive after model eviction', async () => {
    const a = texturedModel(),
      b = texturedModel();
    for (const original of [a, b])
      original.material.userData.molenSurface = {
        ref: 'matgraph:painted-wood',
        slot: 'wall',
        uv: 'repeats',
      };
    const sharedTexture = new THREE.Texture();
    const shared = new THREE.MeshStandardMaterial({ map: sharedTexture, vertexColors: true });
    const sharedDispose = vi.spyOn(shared, 'dispose');
    const sharedTextureDispose = vi.spyOn(sharedTexture, 'dispose');
    const originalDispose = vi.spyOn(a.texture, 'dispose');
    const library = new StructureModelLibrary(async (ref) => (ref === 'a' ? a.scene : b.scene), {
      resolveSurface: (surface) => (surface.ref === 'matgraph:painted-wood' ? shared : undefined),
    });
    const [first, second] = await Promise.all([library.acquire('a'), library.acquire('b')]);
    const firstMesh = first.scene.children[0] as THREE.Mesh;
    const secondMesh = second.scene.children[0] as THREE.Mesh;
    expect(firstMesh.material).toEqual([shared, shared]);
    const tint = firstMesh.geometry.getAttribute('color');
    expect([tint.getX(0), tint.getY(0), tint.getZ(0)]).toEqual([1, 1, 1]);
    expect(secondMesh.material).toEqual(firstMesh.material);
    expect(originalDispose).toHaveBeenCalledTimes(1);
    library.release('a');
    expect(sharedTextureDispose).not.toHaveBeenCalled();
    expect(sharedDispose).not.toHaveBeenCalled();
    library.dispose();
    expect(sharedTextureDispose).not.toHaveBeenCalled();
    expect(sharedDispose).not.toHaveBeenCalled();
    shared.map?.dispose();
    shared.dispose();
  });

  it('retains unique GLB materials and fallbacks for missing surfaces or missing UVs', async () => {
    const original = texturedModel();
    original.material.userData.molenSurface = {
      ref: 'matgraph:unknown',
      slot: 'wall',
      uv: 'repeats',
    };
    const resolveSurface = vi.fn(() => undefined);
    const library = new StructureModelLibrary(async () => original.scene, { resolveSurface });
    const model = await library.acquire('fallback');
    expect((model.scene.children[0] as THREE.Mesh).material).toEqual(original.mesh.material);
    library.dispose();
    const withoutUv = texturedModel();
    withoutUv.geometry.deleteAttribute('uv');
    withoutUv.material.userData.molenSurface = {
      ref: 'matgraph:known',
      slot: 'wall',
      uv: 'repeats',
    };
    resolveSurface.mockClear();
    const other = new StructureModelLibrary(async () => withoutUv.scene, { resolveSurface });
    await other.acquire('no-uv');
    expect(resolveSurface).not.toHaveBeenCalled();
    other.dispose();
  });

  it('loads only acquired models and shares textures/materials while retaining independent transforms', async () => {
    const original = texturedModel();
    const load = vi.fn(async () => original.scene);
    const library = new StructureModelLibrary(load);
    expect(load).not.toHaveBeenCalled();
    const [a, b] = await Promise.all([library.acquire('seattle'), library.acquire('seattle')]);
    expect(load).toHaveBeenCalledExactlyOnceWith('seattle');
    expect(a).toBe(b);
    const one = library.instantiate(a),
      two = library.instantiate(b);
    const mesh = one.children[0] as THREE.Mesh;
    expect(mesh.geometry).toBe(original.geometry);
    expect(mesh.geometry.getAttribute('uv').count).toBeGreaterThan(0);
    expect(mesh.material).toEqual(original.mesh.material);
    expect((mesh.material as THREE.MeshPhysicalMaterial[])[0]?.map).toBe(original.texture);
    expect((mesh.material as THREE.MeshPhysicalMaterial[])[0]?.clearcoat).toBe(0.8);
    one.position.x = 100;
    expect(two.position.x).toBe(0);
    expect(a.bounds.min.y).toBe(0);
    expect(a.bounds.max.y).toBe(20);
    const disposeGeometry = vi.spyOn(original.geometry, 'dispose');
    const disposeTexture = vi.spyOn(original.texture, 'dispose');
    const disposeMaterial = vi.spyOn(original.material, 'dispose');
    library.release('seattle');
    expect(disposeGeometry).not.toHaveBeenCalled();
    library.release('seattle');
    expect(disposeGeometry).toHaveBeenCalledTimes(1);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
    expect(disposeMaterial).toHaveBeenCalledTimes(1);
    expect(() => library.instantiate(a)).toThrow('no longer acquired');
    library.dispose();
    expect(disposeTexture).toHaveBeenCalledTimes(1);
  });

  it('releases an asset that finishes loading after the viewer is disposed', async () => {
    const original = texturedModel();
    const dispose = vi.spyOn(original.geometry, 'dispose');
    let finish!: (scene: THREE.Object3D) => void;
    const library = new StructureModelLibrary(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const pending = library.acquire('late');
    library.dispose();
    finish(original.scene);
    await expect(pending).rejects.toThrow('disposed');
    expect(dispose).toHaveBeenCalledTimes(1);
    await expect(library.acquire('other')).rejects.toThrow('disposed');
  });

  it('allows a failed fetch to retry without leaving a phantom reference', async () => {
    const original = texturedModel();
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(original.scene);
    const library = new StructureModelLibrary(load);
    await expect(library.acquire('model')).rejects.toThrow('offline');
    await library.acquire('model');
    const dispose = vi.spyOn(original.geometry, 'dispose');
    library.release('model');
    expect(dispose).toHaveBeenCalledTimes(1);
    library.dispose();
  });
});

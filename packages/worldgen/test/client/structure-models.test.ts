import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { routeStructureModels, StructureModelLibrary } from '../../src/client/structure-models';

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
  it('preserves canonical cutout settings and texture ownership when replacing a GLB fallback', async () => {
    const original = texturedModel();
    original.material.userData.molenSurface = {
      ref: 'matgraph:perforated-metal',
      slot: 'wall',
      uv: 'repeats',
    };
    const mask = new THREE.Texture();
    const shared = new THREE.MeshStandardMaterial({
      map: mask,
      alphaTest: 0.5,
      transparent: false,
      depthWrite: true,
      side: THREE.DoubleSide,
      vertexColors: true,
    });
    const disposed = vi.spyOn(mask, 'dispose');
    const library = new StructureModelLibrary(async () => original.scene, {
      resolveSurface: () => shared,
    });
    const model = await library.acquire('perforated');
    const material = (
      (model.scene.children[0] as THREE.Mesh).material as THREE.Material[]
    )[0] as THREE.MeshStandardMaterial;
    expect(material).toBe(shared);
    expect(material.alphaTest).toBe(0.5);
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(material.side).toBe(THREE.DoubleSide);
    expect(material.map).toBe(mask);
    library.release('perforated');
    expect(disposed).not.toHaveBeenCalled();
    library.dispose();
    shared.dispose();
    mask.dispose();
  });

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

describe('routing structure models between two sources', () => {
  function source(name: string) {
    const scene = new THREE.Group();
    const model = (ref: string) => ({ ref, scene, bounds: new THREE.Box3() });
    return {
      acquire: vi.fn(async (ref: string) => model(ref)),
      instantiate: vi.fn(() => {
        const instance = new THREE.Group();
        instance.name = name;
        return instance;
      }),
      release: vi.fn(),
    };
  }

  it('keeps each ref with the source that owns it, for acquire, instantiate and release', async () => {
    const catalog = source('catalog');
    const host = source('host');
    const routed = routeStructureModels({
      primary: catalog,
      isPrimary: (ref) => ref.startsWith('pack.'),
      secondary: host,
      keepAliveMs: 0,
    });
    const options = { position: [1, 2, 3] as const };
    const tower = await routed.acquire('pack.tower', options);
    const kiosk = await routed.acquire('my.kiosk', options);
    expect(catalog.acquire).toHaveBeenCalledWith('pack.tower', options);
    expect(host.acquire).toHaveBeenCalledWith('my.kiosk', options);
    expect(routed.instantiate(tower).name).toBe('catalog');
    expect(routed.instantiate(kiosk).name).toBe('host');
    routed.release('pack.tower');
    routed.release('my.kiosk');
    expect(catalog.release).toHaveBeenCalledWith('pack.tower');
    expect(host.release).toHaveBeenCalledWith('my.kiosk');
    expect(catalog.release).toHaveBeenCalledTimes(1);
    expect(host.release).toHaveBeenCalledTimes(1);
  });

  it('holds a released host model long enough for the next tile to take it over', async () => {
    vi.useFakeTimers();
    try {
      const loads = vi.fn(async () => texturedModel().scene);
      const library = new StructureModelLibrary(loads);
      const routed = routeStructureModels({
        primary: source('catalog'),
        isPrimary: () => false,
        secondary: library,
        keepAliveMs: 5000,
      });
      // A parent tile lets go; its child asks a moment later.
      await routed.acquire('my.kiosk');
      routed.release('my.kiosk');
      await vi.advanceTimersByTimeAsync(1000);
      const again = await routed.acquire('my.kiosk');
      expect(loads).toHaveBeenCalledTimes(1);
      // The held reference comes back without taking the child's away.
      await vi.advanceTimersByTimeAsync(5000);
      expect(() => routed.instantiate(again)).not.toThrow();
      // Let go for good: the model is freed once the hold runs out, and loads afresh after.
      routed.release('my.kiosk');
      await vi.advanceTimersByTimeAsync(5000);
      expect(() => routed.instantiate(again)).toThrow('no longer acquired');
      await routed.acquire('my.kiosk');
      expect(loads).toHaveBeenCalledTimes(2);
      // Disposal drops what is still held instead of releasing into a disposed library.
      routed.release('my.kiosk');
      routed.dispose();
      library.dispose();
      await vi.advanceTimersByTimeAsync(10_000);
    } finally {
      vi.useRealTimers();
    }
  });
});

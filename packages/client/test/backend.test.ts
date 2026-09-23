import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { AssetCache, type AssetProvider } from '../src/assets';
import type { InterpTransform } from '../src/interpolation';
import type { Renderable } from '../src/sync';
import { ThreeSceneBackend } from '../src/three/backend';

const transform = (scale?: [number, number, number]): InterpTransform => ({
  pos: [0, 0, 0],
  rot: [0, 0, 0, 1],
  ...(scale !== undefined ? { scale } : {}),
});

describe('ThreeSceneBackend ownership and in-place updates', () => {
  it('updates shadows, resets omitted scale, and disposes primitive resources on last release', () => {
    const scene = new THREE.Scene();
    const backend = new ThreeSceneBackend(scene);
    const initial: Renderable = {
      kind: 'primitive',
      ref: 'box',
      shadows: { cast: true, receive: true },
    };
    backend.create('box', initial);
    const mesh = backend.getObject('box') as THREE.Mesh;
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose');
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);

    backend.updateRenderable('box', {
      ...initial,
      shadows: { cast: false, receive: false },
    });
    expect(backend.getObject('box')).toBe(mesh);
    expect(mesh.castShadow).toBe(false);
    expect(mesh.receiveShadow).toBe(false);

    backend.setTransform('box', transform([2, 3, 4]));
    backend.setTransform('box', transform());
    expect(mesh.scale.toArray()).toEqual([1, 1, 1]);

    backend.destroy('box');
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('does not dispose shared glTF resources until the asset cache is disposed', async () => {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshStandardMaterial();
    const geometryDispose = vi.spyOn(geometry, 'dispose');
    const materialDispose = vi.spyOn(material, 'dispose');
    const base = new THREE.Group();
    base.add(new THREE.Mesh(geometry, material));
    const provider: AssetProvider = {
      load: async () => new ArrayBuffer(1),
      loadText: async () => '',
    };
    const loader = {
      parse: (
        _bytes: ArrayBuffer,
        _path: string,
        onLoad: (gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }) => void,
      ) => onLoad({ scene: base, animations: [] }),
    };
    const cache = new AssetCache(provider, loader as never);
    const backend = new ThreeSceneBackend(new THREE.Scene(), cache);
    backend.create('a', { kind: 'gltf', ref: 'crate' });
    backend.create('b', { kind: 'gltf', ref: 'crate' });
    await cache.whenIdle();
    expect(backend.getObject('a')?.children).toHaveLength(1);
    expect(backend.getObject('b')?.children).toHaveLength(1);

    backend.destroy('a');
    backend.destroy('b');
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();

    cache.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });
});

describe('ThreeSceneBackend shared primitive resources', () => {
  const red: Renderable = { kind: 'primitive', ref: 'box', materialRef: 'palette:#ff0000' };
  const ids = Array.from({ length: 100 }, (_, i) => `box${i}`);

  function spawnBoxes(): {
    backend: ThreeSceneBackend;
    meshes: THREE.Mesh[];
    geometryDispose: ReturnType<typeof vi.spyOn>;
    materialDispose: ReturnType<typeof vi.spyOn>;
  } {
    const backend = new ThreeSceneBackend(new THREE.Scene());
    for (const id of ids) backend.create(id, red);
    const meshes = ids.map((id) => backend.getObject(id) as THREE.Mesh);
    const geometryDispose = vi.spyOn(meshes[0].geometry, 'dispose');
    const materialDispose = vi.spyOn(meshes[0].material as THREE.Material, 'dispose');
    return { backend, meshes, geometryDispose, materialDispose };
  }

  it('shares one geometry and one material across identical boxes', () => {
    const { meshes } = spawnBoxes();
    expect(new Set(meshes.map((m) => m.geometry)).size).toBe(1);
    expect(new Set(meshes.map((m) => m.material)).size).toBe(1);
  });

  it('disposes shared resources only when the last user is destroyed', () => {
    const { backend, geometryDispose, materialDispose } = spawnBoxes();
    for (const id of ids.slice(0, 99)) backend.destroy(id);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();

    backend.destroy(ids[99]);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
  });

  it('swaps the material in place when only the palette changes', () => {
    const backend = new ThreeSceneBackend(new THREE.Scene());
    backend.create('a', red);
    backend.create('b', red);
    const mesh = backend.getObject('a') as THREE.Mesh;
    const original = mesh.material as THREE.Material;
    const geometryDispose = vi.spyOn(mesh.geometry, 'dispose');
    const materialDispose = vi.spyOn(original, 'dispose');

    backend.updateRenderable('a', { ...red, materialRef: 'palette:#00ff00' });
    expect(backend.getObject('a')).toBe(mesh);
    expect(mesh.material).not.toBe(original);
    expect((mesh.material as THREE.MeshStandardMaterial).color.getHexString()).toBe('00ff00');
    expect(geometryDispose).not.toHaveBeenCalled();
    // "b" still holds the red material, so the swap released it without disposing.
    expect(materialDispose).not.toHaveBeenCalled();

    backend.updateRenderable('b', { ...red, materialRef: 'palette:#00ff00' });
    expect(materialDispose).toHaveBeenCalledOnce();
    expect((backend.getObject('b') as THREE.Mesh).material).toBe(mesh.material);
  });

  it('dispose() frees every shared geometry and material', () => {
    const { backend, meshes, geometryDispose, materialDispose } = spawnBoxes();
    backend.create('sphere', { kind: 'primitive', ref: 'sphere' });
    const sphere = backend.getObject('sphere') as THREE.Mesh;
    expect(sphere.geometry).not.toBe(meshes[0].geometry);
    const sphereGeometryDispose = vi.spyOn(sphere.geometry, 'dispose');
    const greyDispose = vi.spyOn(sphere.material as THREE.Material, 'dispose');

    backend.dispose();
    expect(backend.count()).toBe(0);
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(sphereGeometryDispose).toHaveBeenCalledOnce();
    expect(greyDispose).toHaveBeenCalledOnce();
  });
});

describe('review F12: live and capture animation clocks', () => {
  it('applies speed once, supports loops and pause, and retains pose through unrelated updates', async () => {
    const base = new THREE.Group();
    const node = new THREE.Object3D();
    node.name = 'moving';
    base.add(node);
    const clip = new THREE.AnimationClip('move', 10, [
      new THREE.NumberKeyframeTrack('moving.position[x]', [0, 10], [0, 10]),
    ]);
    const provider: AssetProvider = {
      load: async () => new ArrayBuffer(1),
      loadText: async () => '',
    };
    const loader = {
      parse: (_bytes: ArrayBuffer, _path: string, onLoad: (gltf: unknown) => void) =>
        onLoad({ scene: base, animations: [clip] }),
    };
    const cache = new AssetCache(provider, loader as never);
    const backend = new ThreeSceneBackend(new THREE.Scene(), cache);
    const renderable: Renderable = {
      kind: 'gltf',
      ref: 'moving',
      animation: { clip: 'move', speed: 2, startTick: 30 },
    };
    backend.setAnimationTick(60, 30); // Set before the asset finishes loading.
    backend.create('a', renderable);
    await cache.whenIdle();
    const x = (): number =>
      backend.getObject('a')?.getObjectByName('moving')?.position.x ?? Number.NaN;
    expect(x()).toBeCloseTo(2);
    backend.updateRenderable('a', { ...renderable, visible: false });
    expect(x()).toBeCloseTo(2);
    backend.tickAnimations(0.5);
    expect(x()).toBeCloseTo(3);
    backend.setAnimationTick(60, 30);
    expect(x()).toBeCloseTo(2); // Seeking backwards.
    backend.updateRenderable('a', {
      ...renderable,
      animation: { ...renderable.animation, loop: 'pingpong' },
    });
    backend.setAnimationTick(210, 30);
    expect(x()).toBeCloseTo(8);
    backend.updateRenderable('a', {
      ...renderable,
      animation: { ...renderable.animation, loop: 'once' },
    });
    backend.setAnimationTick(600, 30);
    expect(x()).toBeCloseTo(10);
    backend.updateRenderable('a', {
      ...renderable,
      animation: { ...renderable.animation, paused: true, pausedAtTick: 60 },
    });
    backend.setAnimationTick(900, 30);
    expect(x()).toBeCloseTo(2);
    backend.dispose();
    cache.dispose();
  });
});

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createBuildingDetailLod } from '../../src/client/building-lod';
import { createVertexColorMaterialSet } from '../../src/client/materials';
import { NightWindowLighting } from '../../src/client/night-windows';
import { StructureModelLibrary } from '../../src/client/structure-models';
import { buffersToObject3D, disposeWorldgenObject } from '../../src/client/upload';
import { MeshBufferBuilder } from '../../src/kernel/mesh-buffers';

function windows() {
  const builder = new MeshBufferBuilder();
  for (let i = 0; i < 40; i++) {
    const x = (i % 10) * 3,
      y = Math.floor(i / 10) * 3;
    builder.addQuad(
      'window',
      'palette:#53657a',
      [
        [x, y, 0],
        [x + 1, y, 0],
        [x + 1, y + 1, 0],
        [x, y + 1, 0],
      ],
      [0, 0, 1],
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ],
      [0.2, 0.3, 0.4],
    );
  }
  builder.addQuad(
    'wall',
    'palette:#cccccc',
    [
      [0, 0, -0.1],
      [30, 0, -0.1],
      [30, 12, -0.1],
      [0, 12, -0.1],
    ],
    [0, 0, 1],
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    [0.5, 0.5, 0.5],
  );
  return builder.finalize();
}

describe('night window layers', () => {
  it('recognizes existing shared glass metadata before replacing its daytime material', async () => {
    const night = new NightWindowLighting();
    const materials = createVertexColorMaterialSet();
    const source = buffersToObject3D(windows(), materials);
    for (const material of source.material as THREE.Material[])
      if (material.name === 'worldgen:window')
        material.userData.molenSurface = { slot: 'window', uv: 'repeats', ref: 'matgraph:glass' };
    const scene = new THREE.Group();
    scene.add(source);
    const glass = new THREE.MeshStandardMaterial();
    const library = new StructureModelLibrary(async () => scene, {
      nightWindows: night,
      resolveSurface: () => glass,
    });
    const disposed = vi.spyOn(night.material, 'dispose');
    await library.acquire('shared-glass');
    expect(source.children[0]?.name).toBe('worldgen:night-windows');
    expect(source.material).toContain(glass);
    library.release('shared-glass');
    expect(disposed).not.toHaveBeenCalled();
    library.dispose();
    glass.dispose();
    night.dispose();
  });

  it('lights whole panes reproducibly, leaves some dark, and never emits from walls', () => {
    const night = new NightWindowLighting();
    const materials = createVertexColorMaterialSet();
    materials.nightWindows = night;
    const buffers = windows();
    const before = buffers.indices.slice();
    const a = buffersToObject3D(buffers, materials),
      b = buffersToObject3D(buffers, materials);
    const layer = a.children[0] as THREE.Mesh;
    const repeat = b.children[0] as THREE.Mesh;
    const count = layer.geometry.index?.count ?? 0;
    expect(count).toBeGreaterThan(40);
    expect(count).toBeLessThan(40 * 6);
    expect(count % 6).toBe(0);
    expect(
      Array.from(layer.geometry.getAttribute('position').array)
        .filter((_, i) => i % 3 === 2)
        .every((z) => z === 0),
    ).toBe(true);
    expect(layer.geometry.getAttribute('position').array).toEqual(
      repeat.geometry.getAttribute('position').array,
    );
    expect(layer.geometry.getAttribute('color').array).toEqual(
      repeat.geometry.getAttribute('color').array,
    );
    expect(buffers.indices).toEqual(before);
    night.setNightFactor(1);
    expect(night.material.visible).toBe(true);
    night.setNightFactor(0);
    expect(night.material.visible).toBe(false);
    expect(() => night.setNightFactor(NaN)).toThrow();
    disposeWorldgenObject(a);
    disposeWorldgenObject(b);
    materials.dispose?.();
    night.dispose();
  });

  it('retains exactly the same illuminated panes at all three building LODs', () => {
    const materials = createVertexColorMaterialSet();
    const night = new NightWindowLighting();
    materials.nightWindows = night;
    const lod = createBuildingDetailLod(windows(), materials, materials.materialFor('wall', ''), {
      maxPixelError: 2,
      viewportHeight: 700,
    });
    const levels = lod.children.find((cell) => cell.children[0]?.children.length)?.children;
    if (!levels) throw new Error('Missing window cell');
    const layers = levels.map((level) => level.children[0] as THREE.Mesh);
    expect(layers).toHaveLength(3);
    const first = layers[0];
    if (!first) throw new Error('Missing light layer');
    expect(layers[1]?.geometry).toBe(first.geometry);
    expect(layers[2]?.geometry).toBe(first.geometry);
    const disposed = vi.spyOn(first.geometry, 'dispose');
    disposeWorldgenObject(lod);
    expect(disposed).toHaveBeenCalledTimes(1);
    materials.dispose?.();
    night.dispose();
  });

  it('loads explicit glTF lamp extras without disposing the view material on eviction', async () => {
    const night = new NightWindowLighting();
    const material = new THREE.MeshStandardMaterial();
    material.userData.molenNightLight = { kind: 'lamp', color: '#ffcc77' };
    const scene = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(mesh);
    const library = new StructureModelLibrary(async () => scene, { nightWindows: night });
    const disposed = vi.spyOn(night.material, 'dispose');
    const model = await library.acquire('lamp');
    expect(mesh.children).toHaveLength(1);
    const instance = library.instantiate(model);
    const layer = instance.children[0]?.children[0] as THREE.Mesh;
    expect(layer).toBeInstanceOf(THREE.Mesh);
    const geometryDisposed = vi.spyOn(layer.geometry, 'dispose');
    disposeWorldgenObject(instance);
    expect(geometryDisposed).not.toHaveBeenCalled();
    library.release('lamp');
    expect(geometryDisposed).toHaveBeenCalledTimes(1);
    expect(disposed).not.toHaveBeenCalled();
    library.dispose();
    night.dispose();
  });
});

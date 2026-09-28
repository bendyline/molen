import {
  BoxGeometry,
  type BufferGeometry,
  InstancedMesh,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
import { installWebGpuRenderObjectRelease } from '../src/three/webgpu-render-object-release';

/** The r184 RenderObject listener wiring, reduced to what the adapter touches. */
class FakeRenderObject {
  onDispose: (() => void) | null = null;
  attributes: unknown = 'cached';
  readonly onMaterialDispose = (): void => this.dispose();
  readonly onGeometryDispose = (): void => {
    this.attributes = null;
  };
  constructor(
    readonly object: Object3D,
    readonly material: Material,
    readonly geometry: BufferGeometry,
  ) {
    material.addEventListener('dispose', this.onMaterialDispose);
    geometry.addEventListener('dispose', this.onGeometryDispose);
  }
  dispose(): void {
    this.material.removeEventListener('dispose', this.onMaterialDispose);
    this.geometry.removeEventListener('dispose', this.onGeometryDispose);
    this.onDispose?.();
  }
}

function fakeRenderer() {
  const released: FakeRenderObject[] = [];
  const objects = {
    createRenderObject(object: Mesh): FakeRenderObject {
      const renderObject = new FakeRenderObject(
        object,
        object.material as Material,
        object.geometry,
      );
      renderObject.onDispose = () => released.push(renderObject);
      return renderObject;
    },
  };
  return { renderer: { _objects: objects } as unknown as WebGPURenderer, objects, released };
}

function listenerCount(target: Material | BufferGeometry | Object3D): number {
  const listeners = (target as unknown as { _listeners?: Record<string, unknown[]> })._listeners;
  return listeners?.dispose?.length ?? 0;
}

describe('r184 WebGPU render-object release', () => {
  it('keeps material and geometry disposal working without strong listener references', () => {
    const { renderer, objects, released } = fakeRenderer();
    installWebGpuRenderObjectRelease(renderer);
    installWebGpuRenderObjectRelease(renderer);
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial();
    const mesh = new Mesh(geometry, material);
    const renderObject = objects.createRenderObject(mesh);
    // Three's own closures, which reference the render object, are no longer subscribed.
    expect(listenerCount(material)).toBe(1);
    expect(listenerCount(geometry)).toBe(1);
    geometry.dispose();
    expect(renderObject.attributes).toBeNull();
    expect(released).toEqual([]);
    material.dispose();
    expect(released).toEqual([renderObject]);
    expect(listenerCount(material)).toBe(0);
    expect(listenerCount(geometry)).toBe(0);
  });

  it('releases every render object of an instanced mesh when the mesh is disposed', () => {
    const { renderer, objects, released } = fakeRenderer();
    installWebGpuRenderObjectRelease(renderer);
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial();
    const mesh = new InstancedMesh(geometry, material, 4);
    const main = objects.createRenderObject(mesh);
    const shadow = objects.createRenderObject(mesh);
    mesh.dispose();
    expect(released).toEqual([main, shadow]);
    expect(listenerCount(mesh)).toBe(0);
    expect(listenerCount(material)).toBe(0);
    mesh.dispose();
    expect(released).toHaveLength(2);
    geometry.dispose();
    material.dispose();
  });

  it('forgets render objects three already disposed and ignores ordinary mesh events', () => {
    const { renderer, objects, released } = fakeRenderer();
    installWebGpuRenderObjectRelease(renderer);
    const geometry = new BoxGeometry();
    const material = new MeshBasicMaterial();
    const instanced = new InstancedMesh(geometry, material, 2);
    const first = objects.createRenderObject(instanced);
    first.dispose();
    const second = objects.createRenderObject(instanced);
    const dispose = vi.spyOn(second, 'dispose');
    instanced.dispose();
    expect(dispose).toHaveBeenCalledOnce();
    expect(released).toEqual([first, second]);

    const plain = new Mesh(geometry, material);
    objects.createRenderObject(plain);
    expect(listenerCount(plain)).toBe(0);
    expect(released).toHaveLength(2);
    geometry.dispose();
    material.dispose();
  });

  it('hands the geometry cache a stand-in instead of the render object', () => {
    const initGeometry = vi.fn();
    const geometries = { initGeometry };
    const { objects } = fakeRenderer();
    installWebGpuRenderObjectRelease({
      _objects: objects,
      _geometries: geometries,
    } as unknown as WebGPURenderer);
    const geometry = new BoxGeometry();
    const attributes = [geometry.getAttribute('position')];
    const renderObject = { geometry, getAttributes: () => attributes };
    geometries.initGeometry(renderObject);
    const owner = initGeometry.mock.calls[0]?.[0];
    expect(owner).not.toBe(renderObject);
    expect(owner.geometry).toBe(geometry);
    expect(owner.getAttributes()).toBe(attributes);
    geometry.dispose();
  });

  it('is a no-op before three initializes its render objects', () => {
    expect(() => installWebGpuRenderObjectRelease({} as unknown as WebGPURenderer)).not.toThrow();
  });
});

import { MeshBasicMaterial } from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
import { installWebGpuDepthBiasGuard } from '../src/three/webgpu-depth-bias';

describe('WebGPU reversed depth polygon offsets', () => {
  it.each([false, true])('preserves shared material values with reversed depth %s', (reversed) => {
    const material = new MeshBasicMaterial({
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -2,
    });
    const version = material.version;
    const create = vi.fn(
      (_object: { material: MeshBasicMaterial }, _promises: Promise<unknown>[] | null) => {
        expect(material.polygonOffsetFactor).toBe(reversed ? 3 : -3);
        expect(material.polygonOffsetUnits).toBe(reversed ? 2 : -2);
      },
    );
    const backend = { createRenderPipeline: create };
    const renderer = { backend, reversedDepthBuffer: reversed } as unknown as WebGPURenderer;
    installWebGpuDepthBiasGuard(renderer);
    installWebGpuDepthBiasGuard(renderer);
    const object = { material };
    const promises: Promise<unknown>[] = [];
    backend.createRenderPipeline(object, promises);
    expect(create).toHaveBeenCalledExactlyOnceWith(object, promises);
    expect(material.polygonOffsetFactor).toBe(-3);
    expect(material.polygonOffsetUnits).toBe(-2);
    expect(material.version).toBe(version);
    material.dispose();
  });

  it('restores authored offsets even when pipeline creation throws', () => {
    const material = new MeshBasicMaterial({ polygonOffset: true, polygonOffsetFactor: -3 });
    const backend = {
      createRenderPipeline(_object: { material: MeshBasicMaterial }, _promises: null) {
        throw new Error('pipeline failed');
      },
    };
    installWebGpuDepthBiasGuard({
      backend,
      reversedDepthBuffer: true,
    } as unknown as WebGPURenderer);
    expect(() => backend.createRenderPipeline({ material }, null)).toThrow('pipeline failed');
    expect(material.polygonOffsetFactor).toBe(-3);
    expect(material.polygonOffsetUnits).toBe(0);
    material.dispose();
  });
});

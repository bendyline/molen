import { InstancedBufferAttribute } from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { describe, expect, it, vi } from 'vitest';
import { WebGpuInstanceBuffers } from '../src/three/webgpu-instance-buffers';

describe('r184 instance UBO upload adapter', () => {
  it('uploads first use and changed versions, preserving all other uniform updates and disposal', () => {
    const update = vi.fn();
    const backend = { updateBinding: update };
    const adapter = new WebGpuInstanceBuffers({ backend } as unknown as WebGPURenderer);
    const matrix = new InstancedBufferAttribute(new Float32Array(32), 16);
    const binding = { isNodeUniformBuffer: true, buffer: matrix.array };
    adapter.track(matrix);
    backend.updateBinding(binding);
    backend.updateBinding(binding);
    expect(update).toHaveBeenCalledTimes(1);
    matrix.needsUpdate = true;
    backend.updateBinding(binding);
    expect(update).toHaveBeenCalledTimes(2);
    const unrelated = { isNodeUniformBuffer: true, buffer: new Float32Array(16) };
    backend.updateBinding(unrelated);
    backend.updateBinding(unrelated);
    backend.updateBinding({ buffer: matrix.array });
    expect(update).toHaveBeenCalledTimes(5);
    adapter.dispose();
    expect(backend.updateBinding).toBe(update);
  });

  it('does not suppress aliased arrays with independent version counters or failed uploads', () => {
    const update = vi.fn();
    const backend = { updateBinding: update };
    const adapter = new WebGpuInstanceBuffers({ backend } as unknown as WebGPURenderer);
    const a = new InstancedBufferAttribute(new Float32Array(16), 16);
    const binding = { isNodeUniformBuffer: true, buffer: a.array };
    adapter.track(a);
    update.mockImplementationOnce(() => {
      throw new Error('device lost');
    });
    expect(() => backend.updateBinding(binding)).toThrow('device lost');
    backend.updateBinding(binding);
    expect(update).toHaveBeenCalledTimes(2);
    adapter.track(new InstancedBufferAttribute(a.array, 16));
    backend.updateBinding(binding);
    backend.updateBinding(binding);
    expect(update).toHaveBeenCalledTimes(4);
  });
});

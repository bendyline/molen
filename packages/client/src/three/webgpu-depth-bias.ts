import type { Material } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

// Three r184 omits this implemented method from its published Backend type.
interface PipelineBackend {
  createRenderPipeline(object: { material: Material }, promises: Promise<unknown>[] | null): void;
}

const guardedBackends = new WeakSet<object>();

/**
 * Three r184 reverses WebGPU depth comparisons but copies polygon offsets unchanged into the
 * pipeline descriptor. Negative offsets then push water/decals behind the surface they cover.
 * The descriptor is built synchronously, even for compileAsync; restore the authored material
 * immediately so cache keys, shared materials and later draws retain their original values.
 */
export function installWebGpuDepthBiasGuard(renderer: WebGPURenderer): void {
  if (!renderer.reversedDepthBuffer) return;
  const backend = renderer.backend as unknown as PipelineBackend;
  if (guardedBackends.has(backend)) return;
  guardedBackends.add(backend);
  const createPipeline = backend.createRenderPipeline;
  backend.createRenderPipeline = (object, promises): void => {
    const material = object.material;
    if (!material.polygonOffset) {
      createPipeline.call(backend, object, promises);
      return;
    }
    const factor = material.polygonOffsetFactor;
    const units = material.polygonOffsetUnits;
    material.polygonOffsetFactor = -factor;
    material.polygonOffsetUnits = -units;
    try {
      createPipeline.call(backend, object, promises);
    } finally {
      material.polygonOffsetFactor = factor;
      material.polygonOffsetUnits = units;
    }
  };
}

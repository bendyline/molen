import type { InstancedBufferAttribute } from 'three';
import type { WebGPURenderer } from 'three/webgpu';

interface InstanceBinding {
  isNodeUniformBuffer?: boolean;
  buffer: ArrayBufferView;
}

/**
 * Pinned Three r184 adapter. Instance matrices that fit a UBO are uploaded unconditionally by
 * NodeUniformBuffer, even though InstancedBufferAttribute already supplies change versions.
 * Keep the existing shader/binding layout, and skip only a known, unchanged matrix UBO upload.
 * Other uniforms (camera, materials, time), initial uploads and normal needsUpdate writes pass through.
 */
export class WebGpuInstanceBuffers {
  private readonly attributes = new WeakMap<ArrayBufferView, InstancedBufferAttribute | false>();
  private readonly uploaded = new WeakMap<
    object,
    { attribute: InstancedBufferAttribute; version: number }
  >();
  private readonly restore: () => void;

  constructor(renderer: WebGPURenderer) {
    // Three's published Backend type does not include the concrete WebGPU binding methods.
    const backend = renderer.backend as unknown as {
      updateBinding(binding: InstanceBinding): void;
    };
    const update = backend.updateBinding;
    backend.updateBinding = (binding): void => {
      const attribute = binding.isNodeUniformBuffer
        ? this.attributes.get(binding.buffer)
        : undefined;
      if (!attribute) {
        update.call(backend, binding);
        return;
      }
      const previous = this.uploaded.get(binding);
      if (previous?.attribute === attribute && previous.version === attribute.version) return;
      update.call(backend, binding);
      this.uploaded.set(binding, { attribute, version: attribute.version });
    };
    this.restore = () => {
      backend.updateBinding = update;
    };
  }

  track(attribute: InstancedBufferAttribute): void {
    const previous = this.attributes.get(attribute.array);
    // Distinct attributes aliasing one array can have independent versions. Leave those uploads
    // to Three; ordinary LODs sharing the same attribute are safe to cache.
    this.attributes.set(
      attribute.array,
      previous === undefined || previous === attribute ? attribute : false,
    );
  }

  dispose(): void {
    this.restore();
  }
}

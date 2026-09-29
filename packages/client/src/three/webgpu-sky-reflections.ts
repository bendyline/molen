import type { RenderTarget } from 'three';
import { PMREMGenerator, type WebGPURenderer } from 'three/webgpu';
import type { SkyReflectionFilter } from './sky-reflections';

/** Kept behind the WebGPU driver import boundary; WebGL never loads the node runtime. */
export function createWebGpuSkyReflectionFilter(renderer: WebGPURenderer): SkyReflectionFilter {
  let generator: PMREMGenerator | undefined;
  let target: RenderTarget | undefined;
  return {
    update(texture) {
      generator ??= new PMREMGenerator(renderer);
      target = generator.fromEquirectangular(texture, target);
      return target.texture;
    },
    dispose() {
      target?.dispose();
      generator?.dispose();
      target = undefined;
      generator = undefined;
    },
  };
}

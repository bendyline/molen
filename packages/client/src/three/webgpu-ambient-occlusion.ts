// Screen-space ambient occlusion (GTAO) for the WebGPU backend. With it on, the frame draws
// into an offscreen target exactly as it would to the canvas (the sky scene, then the world over
// it) while the world also writes view normals; occlusion is computed from that target's depth
// and normals at half resolution, denoised, and multiplied into the image. Tone mapping and the
// output color space then apply once, at the end, as they do for a direct draw.
import * as THREE from 'three';
import type { Node, WebGPURenderer } from 'three/webgpu';

export interface AmbientOcclusionOptions {
  /** World-space sampling radius, meters: about a wall-to-ground crease. */
  radius?: number;
  /** Share of the occlusion applied, 0–1. Sunlit faces keep most of their direct light. */
  strength?: number;
}

export interface WebGpuAmbientOcclusion {
  /** Draw the frame: the optional sky scene first, then the occluded world over it. */
  render(sky: { scene: THREE.Scene; camera: THREE.Camera } | undefined): void;
  dispose(): void;
}

export async function createWebGpuAmbientOcclusion(
  renderer: WebGPURenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  options: AmbientOcclusionOptions = {},
): Promise<WebGpuAmbientOcclusion> {
  const [webgpu, tsl, gtao, denoiser] = await Promise.all([
    import('three/webgpu'),
    import('three/tsl'),
    import('three/addons/tsl/display/GTAONode.js'),
    import('three/addons/tsl/display/DenoiseNode.js'),
  ]);
  const { float, mix, mrt, normalView, output, texture, vec4 } = tsl;
  // One multisampled target with a second attachment for view normals. Drawing the sky into it
  // first and the world over it (not compositing two images by alpha) keeps alpha-to-coverage
  // edges and antialiased silhouettes exactly as a direct draw renders them.
  const depthTexture = new THREE.DepthTexture(1, 1);
  if (renderer.reversedDepthBuffer) depthTexture.type = THREE.FloatType;
  const target = new webgpu.RenderTarget(1, 1, {
    count: 2,
    samples: renderer.samples,
    type: THREE.HalfFloatType,
    depthTexture,
  });
  // MRT outputs bind to the target's attachments by texture name.
  (target.textures[0] as THREE.Texture).name = 'output';
  (target.textures[1] as THREE.Texture).name = 'normal';
  const normals = mrt({ output, normal: normalView });
  const image = texture(target.textures[0] as THREE.Texture);
  const depth = texture(depthTexture);
  const normal = texture(target.textures[1] as THREE.Texture);
  const occlusion = gtao.ao(depth, normal, camera);
  occlusion.resolutionScale = 0.5;
  occlusion.radius.value = options.radius ?? 3;
  // A steeper response and a slower distance falloff than GTAO's defaults, so contact shading
  // reads at street and rooftop distances rather than only in tight creases.
  occlusion.scale.value = 2.5;
  occlusion.distanceFallOff.value = 0.6;
  const cleaned = denoiser.denoise(occlusion.getTextureNode(), depth, normal, camera);
  const shade = mix(float(1), (cleaned as unknown as Node<'vec4'>).r, options.strength ?? 0.85);
  const pipeline = new webgpu.RenderPipeline(renderer);
  pipeline.outputNode = vec4(image.rgb.mul(shade), image.a);
  const size = new THREE.Vector2();
  return {
    render(sky) {
      renderer.getDrawingBufferSize(size);
      if (target.width !== size.x || target.height !== size.y) target.setSize(size.x, size.y);
      const previousTarget = renderer.getRenderTarget();
      const previousMrt = renderer.getMRT();
      const autoClear = renderer.autoClear;
      try {
        renderer.setRenderTarget(target);
        // Every draw into the target writes both attachments; the sky's normals sit at the far
        // plane, where the occlusion pass leaves the image untouched.
        renderer.setMRT(normals);
        renderer.autoClear = true;
        if (sky) {
          renderer.render(sky.scene, sky.camera);
          renderer.autoClear = false;
          renderer.clearDepth();
        }
        renderer.render(scene, camera);
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.setMRT(previousMrt);
        renderer.autoClear = autoClear;
      }
      pipeline.render();
    },
    dispose() {
      pipeline.dispose();
      occlusion.dispose();
      (cleaned as unknown as { dispose(): void }).dispose();
      target.dispose();
    },
  };
}

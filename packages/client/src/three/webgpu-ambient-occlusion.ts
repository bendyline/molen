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
  /**
   * View distance, meters, past which no occlusion is computed; it fades out over the last
   * third. Farther creases are under a pixel, and skipping them is most of an aerial view.
   */
  reach?: number;
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
  const [webgpu, tsl, gtao] = await Promise.all([
    import('three/webgpu'),
    import('three/tsl'),
    import('three/addons/tsl/display/GTAONode.js'),
  ]);
  const {
    abs,
    clamp,
    colorToDirection,
    directionToColor,
    float,
    Fn,
    max,
    mix,
    mrt,
    normalView,
    output,
    perspectiveDepthToViewZ,
    rtt,
    sample,
    screenUV,
    select,
    texture,
    uniform,
    uv,
    vec2,
    vec4,
  } = tsl;
  // One multisampled target with a second attachment for view normals. Drawing the sky into it
  // first and the world over it (not compositing two images by alpha) keeps alpha-to-coverage
  // edges and antialiased silhouettes exactly as a direct draw renders them. Normals stay an
  // attachment: reconstructed from depth they went wrong on walls seen at a grazing angle, and
  // the occlusion darkened whole shaded facades.
  const depthTexture = new THREE.DepthTexture(1, 1);
  if (renderer.reversedDepthBuffer) depthTexture.type = THREE.FloatType;
  const target = new webgpu.RenderTarget(1, 1, {
    count: 2,
    samples: renderer.samples,
    type: THREE.HalfFloatType,
    depthTexture,
  });
  // MRT outputs bind to the target's attachments by texture name. Normals pack into 8 bits a
  // channel: every sample of the multisampled frame writes them, and half floats there doubled
  // the attachment's bandwidth for precision the occlusion cannot use.
  (target.textures[0] as THREE.Texture).name = 'output';
  const normalTexture = target.textures[1] as THREE.Texture;
  normalTexture.name = 'normal';
  normalTexture.type = THREE.UnsignedByteType;
  const normals = mrt({ output, normal: directionToColor(normalView) });
  const image = texture(target.textures[0] as THREE.Texture);
  const depth = texture(depthTexture);
  const packed = texture(normalTexture);
  const normal = sample((uv) => colorToDirection(packed.sample(uv)));
  // Depths in meters use the scene camera's planes: inside the half-resolution pass the camera
  // nodes would be its own quad camera.
  const lens = camera as THREE.PerspectiveCamera;
  const nearPlane = uniform(lens.near);
  const farPlane = uniform(lens.far);
  const reach = uniform(options.reach ?? 250);
  const meters = (stored: Node<'float'>): Node<'float'> =>
    perspectiveDepthToViewZ(stored, nearPlane, farPlane).negate() as unknown as Node<'float'>;
  const viewDepth = (at: Node<'vec2'>): Node<'float'> =>
    meters((depth.sample(at) as unknown as Node<'vec4'>).r);
  // GTAO skips exactly depth 1, the far plane of a standard buffer. With a reversed buffer the sky
  // sits at 0 instead, and GTAO ran in full across it; reading the sky, and anything past `reach`,
  // as 1 lets it skip them. Nothing real lies at the near plane, and such a sample is still far
  // outside GTAO's thickness, as the sky was at 0.
  const sceneDepth = sample((uv) => {
    const d = (depth.sample(uv) as unknown as Node<'vec4'>).r;
    return vec4(select(meters(d).greaterThan(reach), float(1), d));
  });
  const occlusion = gtao.ao(sceneDepth, normal, camera);
  occlusion.resolutionScale = 0.5;
  occlusion.radius.value = options.radius ?? 3;
  // A steeper response and a slower distance falloff than GTAO's defaults, so contact shading
  // reads at street and rooftop distances rather than only in tight creases.
  occlusion.scale.value = 2.5;
  occlusion.distanceFallOff.value = 0.6;
  // Eight samples rather than sixteen (three directions of three steps instead of six): the
  // denoiser smooths the difference, and the half-resolution pass costs about half as much.
  occlusion.samples.value = 8;
  const raw = occlusion.getTextureNode() as unknown as Node<'vec4'> & {
    sample(uv: Node): Node<'vec4'>;
  };
  // Denoised at half resolution too, into its own texture the composite upsamples, with a
  // depth-aware 5×5 box: GTAO turns its sample directions through a 5×5 pattern, so a box that
  // size cancels it. Nine bilinear taps weighted 2, 1, 2 along each axis average all 25 texels,
  // and each tap counts by how near its depth is to the center's, so occlusion does not bleed
  // across silhouettes. Three's denoiser spent sixteen taps of occlusion, depth and normals, each
  // rebuilding a view position, and cost as much as GTAO itself. Taps past `reach`, which GTAO
  // skipped, count for nothing.
  // One texel of GTAO's half-resolution target, which rounds half the frame size.
  const texel = uniform(new THREE.Vector2(1, 1));
  const boxed = Fn(() => {
    const at = uv();
    const middle = viewDepth(at).toVar();
    const sum = float(0).toVar();
    const total = float(0).toVar();
    for (const y of [-1.5, 0, 1.5])
      for (const x of [-1.5, 0, 1.5]) {
        const tap = at.add(texel.mul(vec2(x, y)));
        const there = viewDepth(tap).toVar();
        const weight = float((x === 0 ? 1 : 2) * (y === 0 ? 1 : 2))
          .mul(clamp(float(1).sub(abs(there.sub(middle)).div(middle.mul(0.08))), 0, 1))
          .mul(there.lessThanEqual(reach).select(float(1), float(0)));
        sum.addAssign(raw.sample(tap).r.mul(weight));
        total.addAssign(weight);
      }
    return vec4(select(total.greaterThan(0), sum.div(max(total, 0.0001)), float(1)), 0, 0, 1);
  })();
  const cleaned = rtt(boxed as unknown as Node, 1, 1);
  // The composite fades the occlusion out over the last third of `reach`, and leaves the sky as
  // drawn: the occlusion texture holds nothing there, and once shading the sky as geometry made
  // it darker and grainy.
  const fade = float(1).sub(
    meters(depth.r as unknown as Node<'float'>).smoothstep(reach.mul(0.67), reach),
  );
  const shade = mix(
    float(1),
    (cleaned.sample(screenUV) as unknown as Node<'vec4'>).r,
    fade.mul(options.strength ?? 0.85),
  );
  const pipeline = new webgpu.RenderPipeline(renderer);
  pipeline.outputNode = vec4(image.rgb.mul(shade), image.a);
  const size = new THREE.Vector2();
  return {
    render(sky) {
      renderer.getDrawingBufferSize(size);
      nearPlane.value = lens.near;
      farPlane.value = lens.far;
      if (target.width !== size.x || target.height !== size.y) {
        target.setSize(size.x, size.y);
        cleaned.setSize(Math.ceil(size.x / 2), Math.ceil(size.y / 2));
        texel.value.set(
          1 / Math.max(1, Math.round(size.x / 2)),
          1 / Math.max(1, Math.round(size.y / 2)),
        );
      }
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
      cleaned.dispose();
      target.dispose();
    },
  };
}

import { Fog, type IUniform, MathUtils, Vector3 } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import type { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import type { NodeBuilder } from 'three/webgpu';

/** Pale daylight haze, matched to the clear sky at the horizon on both shader paths. */
export function createExplorerFog(backend: 'webgl' | 'webgpu'): Fog {
  const fog = new Fog('#d6e0e3', 2_000, 20_000);
  // WebGL mixes fog after tone mapping; WebGPU mixes it before. These scene-linear
  // values map to the same #d6e0e3 swatch under the explorer's AgX / 0.9 exposure rig.
  if (backend === 'webgpu') fog.color.setRGB(1.4881064, 2.2205412, 2.5010572);
  return fog;
}

/** Metric visibility, independent of terrain quality, with room for high-altitude flight. */
export function updateExplorerFog(fog: Fog, viewDistance: number, altitude: number): void {
  // Keep neighborhoods and the foreground clear, with haze building toward the horizon.
  // At flight altitude, push the start out too so the ground below retains its contrast.
  // Short fixed-grid ranges must still disappear before the edge of streamed coverage.
  fog.far = Math.min(viewDistance * 0.9, Math.max(20_000, altitude * 6));
  fog.near = Math.min(fog.far * 0.25, Math.max(2_000, altitude * 1.5));
}

/** Keep atmosphere parameters and depth behavior aligned across Three's two shader systems. */
export async function createExplorerSky(backend: 'webgl' | 'webgpu'): Promise<Sky | SkyMesh> {
  const sun = new Vector3().setFromSphericalCoords(
    1,
    MathUtils.degToRad(64),
    MathUtils.degToRad(138),
  );
  let sky: Sky | SkyMesh;
  if (backend === 'webgpu') {
    const { SkyMesh } = await import('three/addons/objects/SkyMesh.js');
    const { Fn, float } = await import('three/tsl');
    const nodeSky = new SkyMesh();
    nodeSky.turbidity.value = 4.2;
    nodeSky.rayleigh.value = 2.15;
    nodeSky.mieCoefficient.value = 0.0035;
    nodeSky.mieDirectionalG.value = 0.78;
    nodeSky.sunPosition.value.copy(sun);
    // SkyMesh adds animated clouds by default; retain the existing clear-sky appearance.
    nodeSky.cloudCoverage.value = 0;
    // Keep SkyMesh's vertex stack intact: wrapping it loses its atmosphere varyings in r184.
    // Its clip position is valid for both depth conventions; override only the tested depth.
    nodeSky.material.depthNode = Fn((_inputs: unknown[], builder: NodeBuilder) =>
      float(builder.renderer.reversedDepthBuffer ? 0 : 1),
    )();
    sky = nodeSky;
  } else {
    const legacySky = new Sky();
    const uniforms = legacySky.material.uniforms;
    (uniforms.turbidity as IUniform<number>).value = 4.2;
    (uniforms.rayleigh as IUniform<number>).value = 2.15;
    (uniforms.mieCoefficient as IUniform<number>).value = 0.0035;
    (uniforms.mieDirectionalG as IUniform<number>).value = 0.78;
    (uniforms.sunPosition as IUniform<Vector3>).value.copy(sun);
    legacySky.material.vertexShader = legacySky.material.vertexShader.replace(
      'gl_Position.z = gl_Position.w;',
      '#ifdef USE_REVERSED_DEPTH_BUFFER\n gl_Position.z = 0.0;\n#else\n gl_Position.z = gl_Position.w;\n#endif',
    );
    sky = legacySky;
  }
  sky.name = 'earth-atmosphere';
  sky.scale.setScalar(450_000);
  // Pin to the correct far plane and depth-test, so sky cannot cover earlier tile bundles.
  // Attach to scene, outside the rebased worldRoot.
  sky.material.depthTest = true;
  sky.material.depthWrite = false;
  sky.renderOrder = -1_000;
  return sky;
}

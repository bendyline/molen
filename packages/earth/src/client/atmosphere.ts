// Sky dome and distance haze for real-world views, matched across Three's two shader systems.
// The sky attaches to the scene (outside the rebased world root) and is pinned to the far plane
// under both depth conventions, so it can never cover terrain drawn before it.

import { Fog, type IUniform, MathUtils, Vector3 } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import type { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import type { NodeBuilder } from 'three/webgpu';

/** Scattering and sun placement for the physical sky model. */
export interface EarthSkyStyle {
  turbidity?: number;
  rayleigh?: number;
  mieCoefficient?: number;
  mieDirectionalG?: number;
  /** Sun angle above the horizon in degrees (default 26). */
  sunElevation?: number;
  /** Sun compass bearing in degrees, 0 north, clockwise (default 138). */
  sunAzimuth?: number;
}

const DEFAULT_FOG = '#d6e0e3';

/**
 * Distance haze. The default color is corrected for the WebGPU path, which fogs before tone
 * mapping; a custom color is used as given on both backends.
 */
export function createEarthFog(backend: 'webgl' | 'webgpu', color: string = DEFAULT_FOG): Fog {
  const fog = new Fog(color, 2_000, 20_000);
  // Scene-linear values that map to the same #d6e0e3 swatch under AgX at 0.9 exposure.
  if (backend === 'webgpu' && color === DEFAULT_FOG)
    fog.color.setRGB(1.4881064, 2.2205412, 2.5010572);
  return fog;
}

/** Keep neighborhoods clear and let haze build toward the horizon; recede at flight altitude. */
export function updateEarthFog(fog: Fog, viewDistance: number, altitude: number): void {
  fog.far = Math.min(viewDistance * 0.9, Math.max(20_000, altitude * 6));
  fog.near = Math.min(fog.far * 0.25, Math.max(2_000, altitude * 1.5));
}

/** A clear physical sky dome for either backend. Add it to `renderer.scene`, not the world root. */
export async function createEarthSky(
  backend: 'webgl' | 'webgpu',
  style: EarthSkyStyle = {},
): Promise<Sky | SkyMesh> {
  const sun = new Vector3().setFromSphericalCoords(
    1,
    MathUtils.degToRad(90 - (style.sunElevation ?? 26)),
    MathUtils.degToRad(style.sunAzimuth ?? 138),
  );
  const turbidity = style.turbidity ?? 4.2;
  const rayleigh = style.rayleigh ?? 2.15;
  const mieCoefficient = style.mieCoefficient ?? 0.0035;
  const mieDirectionalG = style.mieDirectionalG ?? 0.78;
  let sky: Sky | SkyMesh;
  if (backend === 'webgpu') {
    const { SkyMesh } = await import('three/addons/objects/SkyMesh.js');
    const { Fn, float } = await import('three/tsl');
    const nodeSky = new SkyMesh();
    nodeSky.turbidity.value = turbidity;
    nodeSky.rayleigh.value = rayleigh;
    nodeSky.mieCoefficient.value = mieCoefficient;
    nodeSky.mieDirectionalG.value = mieDirectionalG;
    nodeSky.sunPosition.value.copy(sun);
    // SkyMesh adds animated clouds by default; keep a clear sky.
    nodeSky.cloudCoverage.value = 0;
    // Keep SkyMesh's vertex stack intact (wrapping it loses its varyings in r184); override only
    // the tested depth so it sits on the far plane under either depth convention.
    nodeSky.material.depthNode = Fn((_inputs: unknown[], builder: NodeBuilder) =>
      float(builder.renderer.reversedDepthBuffer ? 0 : 1),
    )();
    sky = nodeSky;
  } else {
    const legacySky = new Sky();
    const uniforms = legacySky.material.uniforms;
    (uniforms.turbidity as IUniform<number>).value = turbidity;
    (uniforms.rayleigh as IUniform<number>).value = rayleigh;
    (uniforms.mieCoefficient as IUniform<number>).value = mieCoefficient;
    (uniforms.mieDirectionalG as IUniform<number>).value = mieDirectionalG;
    (uniforms.sunPosition as IUniform<Vector3>).value.copy(sun);
    legacySky.material.vertexShader = legacySky.material.vertexShader.replace(
      'gl_Position.z = gl_Position.w;',
      '#ifdef USE_REVERSED_DEPTH_BUFFER\n gl_Position.z = 0.0;\n#else\n gl_Position.z = gl_Position.w;\n#endif',
    );
    sky = legacySky;
  }
  sky.name = 'earth-atmosphere';
  sky.scale.setScalar(450_000);
  sky.material.depthTest = true;
  sky.material.depthWrite = false;
  sky.renderOrder = -1_000;
  return sky;
}

// Sky dome and distance haze for real-world views, matched across Three's two shader systems.
// The sky attaches to the scene (outside the rebased world root) and is pinned to the far plane
// under both depth conventions, so it can never cover terrain drawn before it.

import { Fog, type IUniform, MathUtils, Vector3 } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import type { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import type { NodeBuilder } from 'three/webgpu';
import { EARTH_SKY_PALETTE, earthHazeColor } from './look';

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

/**
 * Distance haze in the sky's horizon color (or `color`, read as a sky palette color), converted
 * for the backend so fully hazed ground matches the sky behind it; see `earthHazeColor`.
 */
export function createEarthFog(
  backend: 'webgl' | 'webgpu',
  color: string = EARTH_SKY_PALETTE.dayHorizon,
): Fog {
  const fog = new Fog(0xffffff, 2_000, 20_000);
  earthHazeColor(backend, color, fog.color);
  return fog;
}

/** Keep neighborhoods clear and let haze build toward the horizon; recede at flight altitude. */
export function updateEarthFog(fog: Fog, viewDistance: number, altitude: number): void {
  fog.far = Math.min(viewDistance * 0.9, Math.max(20_000, altitude * 6));
  fog.near = Math.min(fog.far * 0.25, Math.max(2_000, altitude * 1.5));
}

/** Default sun height above the horizon, degrees. */
export const EARTH_SUN_ELEVATION = 26;
/** Default sun compass bearing, degrees (0 north, clockwise): the south-east. */
export const EARTH_SUN_AZIMUTH = 138;

/**
 * Unit vector toward the sun in the Earth frame (+X east, +Y up, +Z south) for a compass
 * bearing and an elevation, both in degrees.
 */
export function earthSunDirection(elevation: number, azimuth: number): [number, number, number] {
  // three's spherical azimuth runs from +Z toward +X; +Z is south here, so bearing b is 180° - b.
  const sun = new Vector3().setFromSphericalCoords(
    1,
    MathUtils.degToRad(90 - elevation),
    MathUtils.degToRad(180 - azimuth),
  );
  return [sun.x, sun.y, sun.z];
}

/** A clear physical sky dome for either backend. Add it to `renderer.scene`, not the world root. */
export async function createEarthSky(
  backend: 'webgl' | 'webgpu',
  style: EarthSkyStyle = {},
): Promise<Sky | SkyMesh> {
  const sun = new Vector3(
    ...earthSunDirection(
      style.sunElevation ?? EARTH_SUN_ELEVATION,
      style.sunAzimuth ?? EARTH_SUN_AZIMUTH,
    ),
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

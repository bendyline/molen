// Cloud shadows: sunlight on every lit surface dims where the cloud deck covers the sun. The
// deck's weather map is projected along each directional light onto the shaded point, the
// same field the volumetric clouds are cut from, so shadows fall where clouds are.
//
// Each renderer keeps one set of uniforms for its lifetime, and every lit shader it builds
// reads them, with or without weather: a strength of 0 skips the lookup, so turning shadows on
// or off (an adaptive quality change) never rebuilds a shader. On WebGL three builds standard
// materials from its shader chunks; a hook on Material.prototype.onBeforeCompile, which only
// acts for a registered renderer, multiplies each directional light by the shadow. Materials
// that install their own hook keep the shadow by calling the prototype's first. On WebGPU a
// directional light node does the same (three/webgpu-clouds.ts).

import * as THREE from 'three';

export interface CloudShadowUniforms {
  /** The deck's weather map, blurred for soft shadow edges (CloudTextures.shadow). */
  molenCloudMap: { value: THREE.Texture };
  /** Strength (0 off), and the base and top of the layer (rendered Y). */
  molenCloudShadow: { value: THREE.Vector4 };
  /** The deck's field: texels per meter, wrapped UV offset, coverage. */
  molenCloudField: { value: THREE.Vector4 };
  molenCloudMix: { value: THREE.Vector4 };
  /**
   * Coverage softness, opacity of a fully cloudy column, height fraction it is cast from, and
   * how much thinner (so lighter) a column is where the field is weak.
   */
  molenCloudFit: { value: THREE.Vector4 };
}

export function createCloudShadowUniforms(map: THREE.Texture): CloudShadowUniforms {
  return {
    molenCloudMap: { value: map },
    molenCloudShadow: { value: new THREE.Vector4(0, 0, 1, 0) },
    molenCloudField: { value: new THREE.Vector4() },
    molenCloudMix: { value: new THREE.Vector4() },
    molenCloudFit: { value: new THREE.Vector4(0.15, 0, 0.35, 0) },
  };
}

const GLSL = /* glsl */ `
uniform sampler2D molenCloudMap;
uniform vec4 molenCloudShadow;
uniform vec4 molenCloudField;
uniform vec4 molenCloudMix;
uniform vec4 molenCloudFit;
// Sunlight let through the cloud deck to a view-space point, toward a view-space light.
float molenCloudShadowAt(vec3 viewPosition, vec3 viewLight) {
  if (molenCloudShadow.x <= 0.0) return 1.0;
  vec3 world = cameraPosition + (vec4(viewPosition, 0.0) * viewMatrix).xyz;
  vec3 light = (vec4(viewLight, 0.0) * viewMatrix).xyz;
  if (light.y <= 0.0) return 1.0;
  float base = molenCloudShadow.y;
  float top = molenCloudShadow.z;
  float castFrom = mix(base, top, molenCloudFit.z);
  vec2 xz = world.xz + light.xz * (max(castFrom - world.y, 0.0) / max(light.y, 0.05));
  vec4 w = textureLod(molenCloudMap, xz * molenCloudField.x + molenCloudField.yz, 0.0);
  float soft = molenCloudFit.x;
  float field = dot(w, molenCloudMix);
  float cover = clamp((field + molenCloudField.w * (1.0 + soft) - 1.0) / soft, 0.0, 1.0);
  cover *= 1.0 - molenCloudFit.w * (1.0 - field);
  // Above the layer there is nothing left to cast it.
  float below = 1.0 - smoothstep(base, top, world.y);
  return mix(1.0, exp(-cover * molenCloudFit.y), molenCloudShadow.x * below);
}
`;

const TARGET = 'getDirectionalLightInfo( directionalLight, directLight );';

/** Add cloud shadows to a WebGL shader built from three's lighting chunks; false if none. */
export function injectCloudShadows(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: CloudShadowUniforms,
): boolean {
  const include = '#include <lights_fragment_begin>';
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  if (!shader.fragmentShader.includes(include) || !chunk.includes(TARGET)) return false;
  shader.fragmentShader = `${GLSL}\n${shader.fragmentShader.replace(
    include,
    chunk.replace(
      TARGET,
      `${TARGET}\n\t\tdirectLight.color *= molenCloudShadowAt( geometryPosition, directionalLight.direction );`,
    ),
  )}`;
  Object.assign(shader.uniforms, uniforms);
  return true;
}

const registered = new WeakMap<object, CloudShadowUniforms>();
let original: THREE.Material['onBeforeCompile'] | undefined;

/**
 * Give every lit shader `renderer` builds from now on the cloud shadow. Call before its first
 * frame. Returns a function that unregisters it.
 */
export function installWebGlCloudShadows(
  renderer: THREE.WebGLRenderer,
  uniforms: CloudShadowUniforms,
): () => void {
  if (original === undefined) {
    const previous = THREE.Material.prototype.onBeforeCompile;
    original = previous;
    const hook = function (
      this: THREE.Material,
      shader: THREE.WebGLProgramParametersWithUniforms,
      target: THREE.WebGLRenderer,
    ): void {
      previous.call(this, shader, target);
      const own = registered.get(target);
      if (own !== undefined) injectCloudShadows(shader, own);
    };
    // A material without its own program key is keyed by this function's source. Report the
    // original's, so installing the hook changes no material's key.
    hook.toString = (): string => previous.toString();
    THREE.Material.prototype.onBeforeCompile = hook;
  }
  registered.set(renderer, uniforms);
  return () => {
    registered.delete(renderer);
  };
}

/**
 * Whether a material builds its own shader variations, beyond the renderer-wide cloud-shadow
 * hook every lit material shares.
 */
export function hasShaderHook(material: THREE.Material): boolean {
  const hook = material.onBeforeCompile;
  return hook !== THREE.Material.prototype.onBeforeCompile && hook !== original;
}

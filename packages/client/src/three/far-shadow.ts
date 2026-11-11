// The sun's far shadow map (WebGL): a second, wider map around the camera for scenery that does
// not move. The focused map (shadow-focus.ts) keeps its texels for what is close, so over a
// city it ended a few hundred meters out and buildings gained their shadows as it reached them:
// a ring of shadow travelling with an aircraft. Past the focused map's edge every lit surface
// reads this one instead, and it fades out toward its own edge.
//
// It is drawn by three's own shadow pass, for a light that is not in the scene, from the
// host's static root only: a moving caster would leave its shadow behind between redraws. It is
// redrawn when the camera has left its middle, when the sun has moved, and about once a second
// for scenery that streamed in, not every frame.

import * as THREE from 'three';
import { focusDirectionalShadow } from './shadow-focus';

export interface FarShadowUniforms {
  /** The far map, or a one-texel stand-in while there is none: never null (see below). */
  molenFarShadowMap: { value: THREE.Texture };
  /** Scene position to the far map's coordinates, as of its last drawing. */
  molenFarShadowMatrix: { value: THREE.Matrix4 };
  /**
   * Strength (0 off), depth bias, normal bias in meters, and where the focused map starts
   * handing over, as a share of its half-width.
   */
  molenFarShadow: { value: THREE.Vector4 };
}

/** Where the focused map starts handing over to the far one, as a share of its half-width. */
const HANDOVER = 0.8;
/** Redraw once the wanted center is this share of the radius from the drawn one. */
const DRIFT = 0.125;
/** Redraw for scenery that arrived since, ms. */
const REFRESH_MS = 1_000;
/** Redraw once the sun has moved this far, radians (0.2 degrees). */
const SUN_TURN = 0.0035;

const PARS_VERTEX = /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	uniform mat4 molenFarShadowMatrix;
	uniform vec4 molenFarShadow;
	varying vec4 vMolenFarShadowCoord;
#endif
`;

const VERTEX = /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	vMolenFarShadowCoord = molenFarShadowMatrix * ( worldPosition + vec4( shadowWorldNormal * molenFarShadow.z, 0.0 ) );
#endif
`;

const PARS_FRAGMENT = /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	uniform vec4 molenFarShadow;
	varying vec4 vMolenFarShadowCoord;
	#if defined( SHADOWMAP_TYPE_PCF )
	uniform sampler2DShadow molenFarShadowMap;
	// Sunlight reaching this fragment by the far map: 1 outside it, fading in from its edge.
	float molenFarShadowAt() {
		vec3 coord = vMolenFarShadowCoord.xyz / vMolenFarShadowCoord.w;
		coord.z += molenFarShadow.y;
		vec2 fromCenter = abs( coord.xy - 0.5 ) * 2.0;
		float edge = max( fromCenter.x, fromCenter.y );
		if ( edge >= 1.0 || coord.z > 1.0 ) return 1.0;
		vec2 texel = vec2( 0.5 ) / vec2( textureSize( molenFarShadowMap, 0 ) );
		float lit = 0.25 * (
			texture( molenFarShadowMap, vec3( coord.xy + vec2( - texel.x, - texel.y ), coord.z ) ) +
			texture( molenFarShadowMap, vec3( coord.xy + vec2( texel.x, - texel.y ), coord.z ) ) +
			texture( molenFarShadowMap, vec3( coord.xy + vec2( - texel.x, texel.y ), coord.z ) ) +
			texture( molenFarShadowMap, vec3( coord.xy + vec2( texel.x, texel.y ), coord.z ) )
		);
		return mix( 1.0, lit, molenFarShadow.x * ( 1.0 - smoothstep( 0.8, 1.0, edge ) ) );
	}
	#endif
	// The first directional light's shadow: the focused map's, handing over to the far map
	// toward the focused map's edge and beyond it.
	float molenSunShadow( int index, float near, vec4 nearCoord ) {
		#if defined( SHADOWMAP_TYPE_PCF )
		if ( index != 0 || molenFarShadow.x <= 0.0 ) return near;
		vec2 fromCenter = abs( nearCoord.xy / nearCoord.w - 0.5 ) * 2.0;
		float handover = smoothstep( molenFarShadow.w, 1.0, max( fromCenter.x, fromCenter.y ) );
		if ( handover <= 0.0 ) return near;
		return mix( near, molenFarShadowAt(), handover );
		#else
		return near;
		#endif
	}
#endif
`;

const CALL =
  'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )';

export function createFarShadowUniforms(): FarShadowUniforms {
  // A shadow sampler must always have a depth texture with a comparison to read, drawn from or
  // not: three's own stand-in for a null value is never uploaded, the unit then holds a color
  // texture, and the driver rejects every draw of every lit shader.
  const none = new THREE.DepthTexture(1, 1);
  none.name = 'molen:far-shadow-none';
  none.compareFunction = THREE.LessEqualCompare;
  none.needsUpdate = true;
  return {
    molenFarShadowMap: { value: none },
    molenFarShadowMatrix: { value: new THREE.Matrix4() },
    molenFarShadow: { value: new THREE.Vector4(0, 0, 0, HANDOVER) },
  };
}

/**
 * Give a WebGL shader built from three's lighting chunks the far shadow map; false if it has
 * none of them (an unlit or hand-written shader), which is then left as it was.
 */
export function injectFarShadow(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: FarShadowUniforms,
): boolean {
  const parsVertex = '#include <shadowmap_pars_vertex>';
  const vertex = '#include <shadowmap_vertex>';
  const parsFragment = '#include <shadowmap_pars_fragment>';
  const lights = '#include <lights_fragment_begin>';
  let fragment = shader.fragmentShader;
  // The cloud shadow has already written the lighting chunk out in full; do so otherwise.
  if (fragment.includes(lights))
    fragment = fragment.replace(lights, THREE.ShaderChunk.lights_fragment_begin);
  if (
    !shader.vertexShader.includes(parsVertex) ||
    !shader.vertexShader.includes(vertex) ||
    !fragment.includes(parsFragment) ||
    !fragment.includes(CALL)
  )
    return false;
  shader.vertexShader = shader.vertexShader
    .replace(parsVertex, `${parsVertex}\n${PARS_VERTEX}`)
    .replace(vertex, `${vertex}\n${VERTEX}`);
  shader.fragmentShader = fragment
    .replace(parsFragment, `${parsFragment}\n${PARS_FRAGMENT}`)
    .replace(CALL, `molenSunShadow( UNROLLED_LOOP_INDEX, ${CALL}, vDirectionalShadowCoord[ i ] )`);
  Object.assign(shader.uniforms, uniforms);
  return true;
}

export interface FarShadowView {
  /** Toward the sun. */
  direction: THREE.Vector3;
  /** Middle of the far map, scene coordinates. */
  center: THREE.Vector3;
  /** Half-width of the far map, meters. */
  radius: number;
  mapSize: number;
  /** See focusDirectionalShadow. */
  biasAddsTowardLight: boolean;
  worldOrigin: readonly [number, number, number];
  now: number;
}

export interface FarShadowInfo {
  /** Half-width of the map as drawn, meters. */
  radius: number;
  /** Times the map has been drawn. */
  draws: number;
  /** Main-thread time of its last drawing, ms. */
  lastDrawMs: number;
}

/** The far map of one WebGL renderer: when to draw it, and the uniforms every lit shader reads. */
export class FarShadow {
  readonly uniforms: FarShadowUniforms = createFarShadowUniforms();
  private readonly none: THREE.Texture = this.uniforms.molenFarShadowMap.value;
  /** Never in the scene: three's shadow pass draws for it when asked to. */
  private readonly light = new THREE.DirectionalLight();
  private casters: THREE.Object3D | undefined;
  private scene: THREE.Object3D | undefined;
  private pending = false;
  private drawn = false;
  private drawnAt = Number.NEGATIVE_INFINITY;
  private drawnRadius = 0;
  /** Absolute world coordinates. */
  private readonly drawnCenter = new THREE.Vector3();
  private readonly drawnDirection = new THREE.Vector3();
  private readonly drawnOrigin: [number, number, number] = [0, 0, 0];
  private readonly drawnMatrix = new THREE.Matrix4();
  private origin: readonly [number, number, number] = [0, 0, 0];
  private readonly wanted = new THREE.Vector3();
  private readonly shift = new THREE.Matrix4();
  private readonly release: () => void;
  private draws = 0;
  private lastDrawMs = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.light.name = 'molen:far-shadow';
    this.light.shadow.autoUpdate = false;
    // three draws shadow maps inside render(), once the scene's own are done: the far map joins
    // them there, from the static root alone.
    const shadowMap = renderer.shadowMap as unknown as {
      render(lights: THREE.Light[], scene: THREE.Object3D, camera: THREE.Camera): void;
    };
    const render = shadowMap.render;
    // A renderer without a shadow pass of its own (a test double) has no far map either.
    if (typeof render !== 'function') {
      this.release = (): void => {};
      return;
    }
    shadowMap.render = (lights, scene, camera): void => {
      render.call(shadowMap, lights, scene, camera);
      if (!this.pending || scene !== this.scene || this.casters === undefined) return;
      this.pending = false;
      const started = performance.now();
      this.light.shadow.needsUpdate = true;
      render.call(shadowMap, [this.light], this.casters, camera);
      this.lastDrawMs = performance.now() - started;
      const map = this.light.shadow.map;
      const depth = map?.depthTexture;
      if (map === null || depth === null || depth === undefined) return;
      this.draws++;
      this.drawn = true;
      this.drawnMatrix.copy(this.light.shadow.matrix);
      this.drawnOrigin[0] = this.origin[0];
      this.drawnOrigin[1] = this.origin[1];
      this.drawnOrigin[2] = this.origin[2];
      this.uniforms.molenFarShadowMap.value = depth;
      this.uniforms.molenFarShadowMatrix.value.copy(this.drawnMatrix);
      this.uniforms.molenFarShadow.value.set(
        1,
        this.light.shadow.bias,
        this.light.shadow.normalBias,
        HANDOVER,
      );
    };
    this.release = (): void => {
      shadowMap.render = render;
    };
  }

  /** The scene whose render draws the map, and the static root it is drawn from. */
  setCasters(scene: THREE.Object3D, casters: THREE.Object3D | undefined): void {
    this.scene = scene;
    if (this.casters === casters) return;
    this.casters = casters;
    this.drawn = false;
  }

  get info(): FarShadowInfo | undefined {
    return this.drawn
      ? { radius: this.drawnRadius, draws: this.draws, lastDrawMs: this.lastDrawMs }
      : undefined;
  }

  /** Before each frame: `view` while the sun casts shadows and a far radius is wanted. */
  update(view: FarShadowView | undefined): void {
    const state = this.uniforms.molenFarShadow.value;
    if (view === undefined || this.casters === undefined) {
      state.x = 0;
      this.pending = false;
      // Whatever it holds is stale by the time shadows return.
      this.drawn = false;
      return;
    }
    const shadow = this.light.shadow;
    if (shadow.mapSize.x !== view.mapSize) {
      shadow.mapSize.set(view.mapSize, view.mapSize);
      this.disposeMap();
    }
    this.origin = view.worldOrigin;
    const wanted = this.wanted.set(
      view.center.x + view.worldOrigin[0],
      view.center.y + view.worldOrigin[1],
      view.center.z + view.worldOrigin[2],
    );
    const due =
      !this.drawn ||
      view.now - this.drawnAt >= REFRESH_MS ||
      view.radius > this.drawnRadius ||
      view.radius < this.drawnRadius * 0.7 ||
      wanted.distanceTo(this.drawnCenter) > this.drawnRadius * DRIFT ||
      view.direction.angleTo(this.drawnDirection) > SUN_TURN;
    if (due) {
      focusDirectionalShadow(
        this.light,
        view.direction,
        view.center,
        view.radius,
        view.biasAddsTowardLight,
        view.worldOrigin,
      );
      this.drawnAt = view.now;
      this.drawnRadius = shadow.camera.right;
      this.drawnCenter.copy(wanted);
      this.drawnDirection.copy(view.direction);
      this.pending = true;
    }
    if (!this.drawn) {
      state.x = 0;
      return;
    }
    // The map was drawn in the scene coordinates of its frame: follow a rebased origin.
    state.x = 1;
    this.uniforms.molenFarShadowMatrix.value.multiplyMatrices(
      this.drawnMatrix,
      this.shift.makeTranslation(
        view.worldOrigin[0] - this.drawnOrigin[0],
        view.worldOrigin[1] - this.drawnOrigin[1],
        view.worldOrigin[2] - this.drawnOrigin[2],
      ),
    );
  }

  private disposeMap(): void {
    const map = this.light.shadow.map;
    this.uniforms.molenFarShadowMap.value = this.none;
    this.uniforms.molenFarShadow.value.x = 0;
    this.drawn = false;
    if (map === null) return;
    map.depthTexture?.dispose();
    map.dispose();
    this.light.shadow.map = null;
  }

  dispose(): void {
    this.release();
    this.disposeMap();
    this.none.dispose();
    this.light.dispose();
  }
}

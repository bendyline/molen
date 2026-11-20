// The sun's subject shadow map (WebGL): a small map of its own for one moving subject, the car
// being driven or the aircraft being flown. The focused map (shadow-focus.ts) is snapped to a
// grid fixed to the ground, so what stands still is drawn into the same texels every frame and its
// shadow holds its shape. A car crossing that grid lands on different texels each frame, and a
// driving view's texels are 0.14 to 0.56 m: its shadow on the road, a dozen texels wide, changed
// outline every frame, and from the driver's seat the roof's shade jumped about the dashboard. A
// helicopter 30 m up is in 7 cm texels, and its canopy frame's shade crawled over the panel.
//
// This map is centered on the subject instead and holds nothing else, so the subject is drawn
// into the same texels wherever it is, at about half a centimeter each for a car. The subject
// stays out of the focused map, and every lit surface takes the darker of the two: the road
// under the car, and the car itself.
//
// It is drawn by three's own shadow pass, like the far map (far-shadow.ts): for a light that is
// not in the scene, from the subject's root alone.
//
// See-through glass is drawn into it GLASS_REACH deeper than it is. Sunlight then comes through a
// windscreen onto the dashboard and seats, and past that reach the pane shades like bodywork:
// the shadow on the road stays whole. Left out of the map, glass let the sun through a car whose
// model is open underneath (in at the windscreen, between the seats, out below the trunk), a
// bright patch in the shadow behind it that the coarser map had blurred away.

import * as THREE from 'three';
import { isGlass } from '../vehicle-glass';

/** One moving object with a sun shadow map of its own; see `Renderer.setShadowSubject`. */
export interface ShadowSubject {
  /** Its root: every mesh under it that casts shadows casts into the subject map. */
  object: THREE.Object3D;
  /** Middle of a sphere that holds it, in `object`'s own frame. */
  center: readonly [number, number, number];
  /** Radius of that sphere, meters. */
  radius: number;
}

export interface SubjectShadowInfo {
  /** Half-width of the map as drawn, meters. */
  radius: number;
  /** Meters one texel of it covers. */
  texel: number;
  /** Times the map has been drawn. */
  draws: number;
}

export interface SubjectShadowUniforms {
  /** The subject map, or a one-texel stand-in while there is none: never null (see far-shadow.ts). */
  molenSubjectShadowMap: { value: THREE.Texture };
  /**
   * Scene position to the subject map's coordinates. `w` is how far past the subject the light
   * has travelled, as a share of the distance over which its shadow fades out.
   */
  molenSubjectShadowMatrix: { value: THREE.Matrix4 };
  /** Strength (0 off), depth bias, normal bias in meters, and the filter's reach in the map. */
  molenSubjectShadow: { value: THREE.Vector4 };
}

/** Texels across the map at least: 5 mm each around a car, 13 mm around a bus or a helicopter. */
const MAP_SIZE = 1024;
/**
 * Meters a texel of a larger subject's map is held to, as far as the view allows (see
 * SubjectShadowView.mapSize): at 1024 texels the map around an airliner, a sphere 30 m across
 * the middle, would draw its cockpit in 6 cm texels.
 */
const SUBJECT_TEXEL = 0.015;
/** From the light to the near side of the subject's sphere, meters. */
const GAP = 1;
/**
 * Where a subject's shadow starts to fade, meters past it along the light, and over how far: at
 * least these, and FADE_RADII times the subject's radius. A car's shadow reaches 30 m with the sun
 * three degrees up; on a wall farther off the real one has blurred away, and this map's would be
 * as sharp as under the car. A larger subject's stays dark farther (the sun's disc blurs an edge by
 * a hundredth of the distance): a helicopter 30 m up casts its shadow 40 m or more down the light.
 */
const FADE_START = 30;
const FADE_LENGTH = 30;
const FADE_RADII = 10;
/**
 * How far past a pane of the subject's own glass sunlight still falls, meters: a cabin's depth.
 * Farther along the light the pane casts a shadow.
 */
const GLASS_REACH = 1.8;
/** Depth and normal offsets of a lookup, in texels, and the reach of its four taps. */
const DEPTH_BIAS = 1;
const NORMAL_BIAS = 1.5;
const FILTER = 0.75;

const PARS_VERTEX = /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	uniform mat4 molenSubjectShadowMatrix;
	uniform vec4 molenSubjectShadow;
	varying vec4 vMolenSubjectShadowCoord;
#endif
`;

const VERTEX = /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	vMolenSubjectShadowCoord = molenSubjectShadowMatrix * ( worldPosition + vec4( shadowWorldNormal * molenSubjectShadow.z, 0.0 ) );
#endif
`;

const PARS_FRAGMENT = /* glsl */ `
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	uniform vec4 molenSubjectShadow;
	varying vec4 vMolenSubjectShadowCoord;
	#if defined( SHADOWMAP_TYPE_PCF )
	uniform sampler2DShadow molenSubjectShadowMap;
	#endif
	// The first directional light past the subject: 'lit' from its other maps, or the subject's
	// own shadow where that is darker.
	float molenSubjectShadowed( int index, float lit ) {
		#if defined( SHADOWMAP_TYPE_PCF )
		if ( index != 0 || molenSubjectShadow.x <= 0.0 ) return lit;
		vec4 coord = vMolenSubjectShadowCoord;
		if ( coord.x <= 0.0 || coord.x >= 1.0 || coord.y <= 0.0 || coord.y >= 1.0 || coord.w >= 1.0 ) return lit;
		// The map holds the subject alone. Clamped, a point nearer the light than its box compares
		// as lit, and one beyond it as shaded wherever the subject was drawn.
		float depth = clamp( coord.z + molenSubjectShadow.y, 0.0, 1.0 );
		float reach = molenSubjectShadow.w;
		float own = 0.25 * (
			texture( molenSubjectShadowMap, vec3( coord.xy + vec2( - reach, - reach ), depth ) ) +
			texture( molenSubjectShadowMap, vec3( coord.xy + vec2( reach, - reach ), depth ) ) +
			texture( molenSubjectShadowMap, vec3( coord.xy + vec2( - reach, reach ), depth ) ) +
			texture( molenSubjectShadowMap, vec3( coord.xy + vec2( reach, reach ), depth ) )
		);
		own = mix( 1.0, own, molenSubjectShadow.x * ( 1.0 - clamp( coord.w, 0.0, 1.0 ) ) );
		return min( lit, own );
		#else
		return lit;
		#endif
	}
#endif
`;

const CALL =
  'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )';

export function createSubjectShadowUniforms(): SubjectShadowUniforms {
  // As for the far map: a shadow sampler must always have a depth texture with a comparison.
  const none = new THREE.DepthTexture(1, 1);
  none.name = 'molen:subject-shadow-none';
  none.compareFunction = THREE.LessEqualCompare;
  none.needsUpdate = true;
  return {
    molenSubjectShadowMap: { value: none },
    molenSubjectShadowMatrix: { value: new THREE.Matrix4() },
    molenSubjectShadow: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
}

/**
 * Give a WebGL shader built from three's lighting chunks the subject shadow map; false if it has
 * none of them (an unlit or hand-written shader), which is then left as it was. Call before
 * `injectFarShadow`: the subject's shadow goes around the handover between the sun's other maps.
 */
export function injectSubjectShadow(
  shader: THREE.WebGLProgramParametersWithUniforms,
  uniforms: SubjectShadowUniforms,
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
    .replace(CALL, `molenSubjectShadowed( UNROLLED_LOOP_INDEX, ${CALL} )`);
  Object.assign(shader.uniforms, uniforms);
  return true;
}

const measuredBox = new THREE.Box3();
const partBox = new THREE.Box3();
const toSubject = new THREE.Matrix4();
const partMatrix = new THREE.Matrix4();
const measuredSphere = new THREE.Sphere();

/**
 * A shadow subject from an object's own meshes: the sphere around their bounding boxes, a tenth
 * wider for parts that swing out (doors, a hood). Measure once per object: the subject is drawn
 * into the same texels only while its sphere stays the same.
 */
export function measureShadowSubject(object: THREE.Object3D): ShadowSubject {
  object.updateWorldMatrix(true, true);
  toSubject.copy(object.matrixWorld).invert();
  measuredBox.makeEmpty();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (mesh.geometry.boundingBox === null) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox;
    if (bounds === null || bounds.isEmpty()) return;
    partMatrix.multiplyMatrices(toSubject, mesh.matrixWorld);
    measuredBox.union(partBox.copy(bounds).applyMatrix4(partMatrix));
  });
  if (measuredBox.isEmpty()) return { object, center: [0, 0, 0], radius: 1 };
  measuredBox.getBoundingSphere(measuredSphere);
  return {
    object,
    center: measuredSphere.center.toArray(),
    radius: Math.max(0.25, measuredSphere.radius * 1.1),
  };
}

export interface SubjectShadowView {
  /** Toward the sun. */
  direction: THREE.Vector3;
  /** See focusDirectionalShadow. */
  biasAddsTowardLight: boolean;
  /**
   * Texels across the largest map a large subject may have; it never has fewer than 1024. The
   * renderer passes its main map's size, at most 2048, as for the far map.
   */
  mapSize: number;
}

const UP = new THREE.Vector3(0, 1, 0);
const VERTICAL_UP = new THREE.Vector3(1, 0, 0);

/** Three's depth material, drawing GLASS_REACH farther from the light than the surface is. */
function glassDepthMaterial(): THREE.MeshDepthMaterial {
  const material = new THREE.MeshDepthMaterial();
  material.name = 'molen:subject-shadow-glass';
  material.onBeforeCompile = (shader): void => {
    // The map's projection is parallel: clip depth is view depth times its z scale, whichever
    // way the depth buffer runs.
    const project = '#include <project_vertex>';
    const deeper = `gl_Position.z -= projectionMatrix[ 2 ][ 2 ] * ${GLASS_REACH.toFixed(2)} * gl_Position.w;`;
    shader.vertexShader = shader.vertexShader.replace(project, `${project}\n\t${deeper}`);
  };
  return material;
}

/** A pane out of its usual drawing for the subject map, and what to put back. */
interface DrawnGlass {
  mesh: THREE.Mesh;
  depth: THREE.Material | undefined;
  sides: (THREE.Side | null)[];
}

/** The subject map of one WebGL renderer: its drawing, and the uniforms every lit shader reads. */
export class SubjectShadow {
  readonly uniforms: SubjectShadowUniforms = createSubjectShadowUniforms();
  private readonly none: THREE.Texture = this.uniforms.molenSubjectShadowMap.value;
  /** Never in the scene: three's shadow pass draws for it when asked to. */
  private readonly light = new THREE.DirectionalLight();
  private subject: ShadowSubject | undefined;
  private scene: THREE.Object3D | undefined;
  private view: SubjectShadowView | undefined;
  /** The map is due this frame: a scene drawn twice in a frame draws it once. */
  private pending = false;
  private readonly casters: THREE.Mesh[] = [];
  private readonly glass: DrawnGlass[] = [];
  private readonly glassDepth = glassDepthMaterial();
  private readonly middle = new THREE.Vector3();
  private readonly release: () => void;
  private draws = 0;
  private drawnRadius = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.light.name = 'molen:subject-shadow';
    this.light.shadow.autoUpdate = false;
    this.light.shadow.mapSize.set(MAP_SIZE, MAP_SIZE);
    const shadowMap = renderer.shadowMap as unknown as {
      type?: THREE.ShadowMapType;
      render(lights: THREE.Light[], scene: THREE.Object3D, camera: THREE.Camera): void;
    };
    const render = shadowMap.render;
    // A renderer without a shadow pass of its own (a test double) has no subject map either.
    if (typeof render !== 'function') {
      this.release = (): void => {};
      return;
    }
    shadowMap.render = (lights, scene, camera): void => {
      const subject = this.subject;
      const view = this.view;
      const state = this.uniforms.molenSubjectShadow.value;
      if (scene !== this.scene) {
        render.call(shadowMap, lights, scene, camera);
        return;
      }
      if (
        subject === undefined ||
        view === undefined ||
        // The lookup is written for three's comparison sampler.
        (shadowMap.type !== undefined &&
          shadowMap.type !== THREE.PCFShadowMap &&
          shadowMap.type !== THREE.PCFSoftShadowMap) ||
        !this.shown(subject.object, scene)
      ) {
        state.x = 0;
        render.call(shadowMap, lights, scene, camera);
        return;
      }
      // Out of the sun's other maps: there it would cast the shadow this one replaces.
      const casters = this.casters;
      casters.length = 0;
      subject.object.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh || !mesh.castShadow) return;
        mesh.castShadow = false;
        casters.push(mesh);
      });
      try {
        render.call(shadowMap, lights, scene, camera);
      } finally {
        for (const mesh of casters) mesh.castShadow = true;
      }
      if (!this.pending) return;
      this.pending = false;
      this.aim(subject, view);
      // Three's shadow pass draws a pane as solid, from the side turned away from the light.
      // Here both sides are drawn, GLASS_REACH deeper: see the top of this file.
      const glass = this.glass;
      glass.length = 0;
      for (const mesh of casters) {
        if (!isGlass(mesh)) continue;
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        glass.push({
          mesh,
          depth: mesh.customDepthMaterial,
          sides: materials.map((material) => material.shadowSide),
        });
        mesh.customDepthMaterial = this.glassDepth;
        for (const material of materials) material.shadowSide = THREE.DoubleSide;
      }
      try {
        this.light.shadow.needsUpdate = true;
        render.call(shadowMap, [this.light], subject.object, camera);
      } finally {
        for (const { mesh, depth, sides } of glass) {
          mesh.customDepthMaterial = depth;
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          for (const [index, material] of materials.entries())
            material.shadowSide = sides[index] ?? null;
        }
        casters.length = 0;
        glass.length = 0;
      }
      const depth = this.light.shadow.map?.depthTexture;
      if (depth === null || depth === undefined) {
        state.x = 0;
        return;
      }
      this.draws++;
      this.uniforms.molenSubjectShadowMap.value = depth;
      this.publish(view);
    };
    this.release = (): void => {
      shadowMap.render = render;
    };
  }

  /** The scene whose render draws the map, and the subject it is drawn from. */
  setSubject(scene: THREE.Object3D, subject: ShadowSubject | undefined): void {
    this.scene = scene;
    const previous = this.subject;
    if (
      previous?.object === subject?.object &&
      previous?.radius === subject?.radius &&
      previous?.center[0] === subject?.center[0] &&
      previous?.center[1] === subject?.center[1] &&
      previous?.center[2] === subject?.center[2]
    )
      return;
    this.subject =
      subject === undefined
        ? undefined
        : { object: subject.object, center: [...subject.center], radius: subject.radius };
    // Until the new subject is drawn, the map shows the last one.
    this.uniforms.molenSubjectShadow.value.x = 0;
  }

  /** The subject map as last drawn, or `undefined` while no subject casts from it. */
  get info(): SubjectShadowInfo | undefined {
    return this.uniforms.molenSubjectShadow.value.x > 0
      ? {
          radius: this.drawnRadius,
          texel: (2 * this.drawnRadius) / this.light.shadow.mapSize.x,
          draws: this.draws,
        }
      : undefined;
  }

  /** Before each frame: `view` while the sun casts shadows. */
  update(view: SubjectShadowView | undefined): void {
    this.view = view;
    this.pending = view !== undefined && this.subject !== undefined;
    if (!this.pending) this.uniforms.molenSubjectShadow.value.x = 0;
  }

  /** In `scene` and drawn: an object taken out of it, or hidden, casts nothing. */
  private shown(object: THREE.Object3D, scene: THREE.Object3D): boolean {
    for (let node: THREE.Object3D | null = object; node !== null; node = node.parent) {
      if (!node.visible) return false;
      if (node === scene) return true;
    }
    return false;
  }

  /** Center the light's box on the subject as it stands this frame. */
  private aim(subject: ShadowSubject, view: SubjectShadowView): void {
    const { object } = subject;
    const radius = subject.radius * object.matrixWorld.getMaxScaleOnAxis();
    const middle = this.middle.fromArray(subject.center).applyMatrix4(object.matrixWorld);
    const light = this.light;
    const camera = light.shadow.camera;
    const size = Math.min(
      Math.max(MAP_SIZE, view.mapSize),
      Math.max(MAP_SIZE, 2 ** Math.ceil(Math.log2((2 * radius) / SUBJECT_TEXEL))),
    );
    // three allocates a light's map once; a new size needs a new one.
    if (light.shadow.mapSize.x !== size) {
      light.shadow.mapSize.set(size, size);
      this.disposeMap();
    }
    // The same basis whatever the subject does, including under a sun directly overhead.
    camera.up.copy(Math.abs(view.direction.y) > 0.999 ? VERTICAL_UP : UP);
    light.target.position.copy(middle);
    light.position.copy(middle).addScaledVector(view.direction, radius + GAP);
    light.target.updateMatrixWorld();
    light.updateMatrixWorld();
    if (camera.right !== radius) {
      camera.left = -radius;
      camera.right = radius;
      camera.top = radius;
      camera.bottom = -radius;
      camera.near = GAP / 2;
      // Room behind the subject for its glass, drawn deeper than it is.
      camera.far = radius * 2 + GAP * 1.5 + GLASS_REACH;
      camera.updateProjectionMatrix();
    }
    this.drawnRadius = radius;
  }

  /** The map just drawn, to every lit shader. */
  private publish(view: SubjectShadowView): void {
    const camera = this.light.shadow.camera;
    const radius = this.drawnRadius;
    const size = this.light.shadow.mapSize.x;
    const texel = (2 * radius) / size;
    const bias = (texel * DEPTH_BIAS) / (camera.far - camera.near);
    this.uniforms.molenSubjectShadow.value.set(
      1,
      view.biasAddsTowardLight ? bias : -bias,
      texel * NORMAL_BIAS,
      FILTER / size,
    );
    // Rows x, y and depth are three's. The light is parallel, so w is free to carry the fade:
    // meters past the subject's sphere along the light, from its start, over its length.
    const start = Math.max(FADE_START, radius * FADE_RADII);
    const length = Math.max(FADE_LENGTH, radius * FADE_RADII);
    const matrix = this.uniforms.molenSubjectShadowMatrix.value.copy(this.light.shadow.matrix);
    const toSun = view.direction;
    const elements = matrix.elements;
    elements[3] = -toSun.x / length;
    elements[7] = -toSun.y / length;
    elements[11] = -toSun.z / length;
    elements[15] = (toSun.dot(this.middle) - radius - start) / length;
  }

  /** Let the map go; three draws a new one, at the light's map size, the next time it is due. */
  private disposeMap(): void {
    const map = this.light.shadow.map;
    this.uniforms.molenSubjectShadowMap.value = this.none;
    this.uniforms.molenSubjectShadow.value.x = 0;
    if (map === null) return;
    map.depthTexture?.dispose();
    map.dispose();
    this.light.shadow.map = null;
  }

  dispose(): void {
    this.release();
    this.disposeMap();
    this.none.dispose();
    this.glassDepth.dispose();
    this.light.dispose();
  }
}

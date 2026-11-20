import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FarShadow, injectFarShadow } from '../src/three/far-shadow';
import {
  injectSubjectShadow,
  measureShadowSubject,
  SubjectShadow,
  type SubjectShadowView,
} from '../src/three/subject-shadow';

const litShader = (): THREE.WebGLProgramParametersWithUniforms =>
  ({
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  }) as unknown as THREE.WebGLProgramParametersWithUniforms;

interface Drawn {
  lights: THREE.Light[];
  root: THREE.Object3D;
  /** What three's pass would have found on the car's parts as it walked them. */
  casting: Record<string, boolean>;
  glassDepth: THREE.Material | undefined;
  glassSide: THREE.Side | null;
}

/** A car: a body, a pane of glass and a part that never casts. */
function car(): {
  model: THREE.Group;
  body: THREE.Mesh;
  glass: THREE.Mesh;
  glassMaterial: THREE.MeshStandardMaterial;
} {
  const model = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 1.4, 4.6),
    new THREE.MeshStandardMaterial(),
  );
  body.name = 'body';
  body.position.y = 0.7;
  body.castShadow = true;
  const glassMaterial = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.9 });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.6), glassMaterial);
  glass.name = 'glass';
  glass.position.set(0, 1.1, 1);
  glass.castShadow = true;
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.1),
    new THREE.MeshStandardMaterial(),
  );
  lamp.name = 'lamp';
  lamp.position.set(0.7, 0.6, 2.3);
  model.add(body, glass, lamp);
  return { model, body, glass, glassMaterial };
}

/** three's shadow pass, as far as the subject map uses it: a map for each light it is given. */
function fakeRenderer(model: THREE.Object3D): {
  renderer: THREE.WebGLRenderer;
  drawn: Drawn[];
  frame(scene: THREE.Object3D, lights?: THREE.Light[]): void;
} {
  const drawn: Drawn[] = [];
  const render = vi.fn((lights: THREE.DirectionalLight[], root: THREE.Object3D) => {
    const casting: Record<string, boolean> = {};
    let glass: THREE.Mesh | undefined;
    model.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      casting[mesh.name] = mesh.castShadow;
      if (mesh.name === 'glass') glass = mesh;
    });
    drawn.push({
      lights,
      root,
      casting,
      glassDepth: glass?.customDepthMaterial,
      glassSide: (glass?.material as THREE.Material | undefined)?.shadowSide ?? null,
    });
    for (const light of lights) {
      light.shadow.map ??= {
        depthTexture: new THREE.DepthTexture(4, 4),
        dispose: () => {},
      } as unknown as THREE.WebGLRenderTarget;
      light.shadow.updateMatrices(light);
    }
  });
  const shadowMap = { render, type: THREE.PCFShadowMap };
  const renderer = { shadowMap } as unknown as THREE.WebGLRenderer;
  return {
    renderer,
    drawn,
    frame: (scene, lights = []) =>
      (shadowMap.render as unknown as (...a: unknown[]) => void)(lights, scene, null),
  };
}

const view = (overrides: Partial<SubjectShadowView> = {}): SubjectShadowView => ({
  direction: new THREE.Vector3(-0.34, 0.36, 0.87).normalize(),
  biasAddsTowardLight: false,
  mapSize: 2048,
  ...overrides,
});

/** How far the subject map's shadow has faded at `past` meters beyond its sphere down the light. */
const fadeAt = (
  shadow: SubjectShadow,
  subject: { center: readonly [number, number, number]; radius: number },
  past: number,
): number =>
  new THREE.Vector4(
    ...new THREE.Vector3()
      .fromArray(subject.center)
      .addScaledVector(view().direction, -(subject.radius + past))
      .toArray(),
    1,
  ).applyMatrix4(shadow.uniforms.molenSubjectShadowMatrix.value).w;

describe('the subject shadow map', () => {
  it('adds itself to lit shaders only, around the far map', () => {
    const { model } = car();
    const { renderer } = fakeRenderer(model);
    const subject = new SubjectShadow(renderer);
    const far = new FarShadow(renderer);
    const lit = litShader();
    // Guards three upgrades: the chunks and the shadow lookup it wraps must still exist.
    expect(injectSubjectShadow(lit, subject.uniforms)).toBe(true);
    expect(injectFarShadow(lit, far.uniforms)).toBe(true);
    expect(lit.vertexShader).toContain('vMolenSubjectShadowCoord = molenSubjectShadowMatrix');
    // The subject's shadow is taken after the sun's other maps have handed over between them.
    expect(lit.fragmentShader).toContain(
      'molenSubjectShadowed( UNROLLED_LOOP_INDEX, molenSunShadow( UNROLLED_LOOP_INDEX, getShadow( directionalShadowMap[ i ]',
    );
    expect(lit.uniforms.molenSubjectShadowMap).toBe(subject.uniforms.molenSubjectShadowMap);

    const unlit = {
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    expect(injectSubjectShadow(unlit, subject.uniforms)).toBe(false);
    expect(unlit.fragmentShader).toBe(THREE.ShaderLib.basic.fragmentShader);
    expect(unlit.uniforms).toEqual({});
    far.dispose();
    subject.dispose();
  });

  it('always gives its sampler a depth texture with a comparison', () => {
    const subject = new SubjectShadow(fakeRenderer(new THREE.Group()).renderer);
    const none = subject.uniforms.molenSubjectShadowMap.value as THREE.DepthTexture;
    expect(none.isDepthTexture).toBe(true);
    expect(none.compareFunction).toBe(THREE.LessEqualCompare);
    expect(none.version).toBeGreaterThan(0);
    expect(subject.uniforms.molenSubjectShadow.value.x).toBe(0);
    expect(subject.info).toBeUndefined();
    subject.dispose();
  });

  it('measures a subject from its meshes, in its own frame', () => {
    const { model } = car();
    // Where it stands and which way it faces make no difference to its own sphere.
    model.position.set(500, 20, -300);
    model.rotation.y = 1.1;
    const measured = measureShadowSubject(model);
    expect(measured.object).toBe(model);
    expect(measured.center[0]).toBeCloseTo(0, 6);
    expect(measured.center[1]).toBeCloseTo(0.7, 6);
    // The lamp reaches 5 cm past the body's tail.
    expect(measured.center[2]).toBeCloseTo(0.025, 6);
    const half = Math.hypot(0.9, 0.7, 2.325);
    expect(measured.radius).toBeCloseTo(half * 1.1, 6);
    expect(measureShadowSubject(new THREE.Group()).radius).toBe(1);
  });

  it('draws the subject into its own map and keeps it out of the sun’s', () => {
    const { model, glass, glassMaterial } = car();
    const { renderer, drawn, frame } = fakeRenderer(model);
    const shadow = new SubjectShadow(renderer);
    const scene = new THREE.Scene();
    scene.add(model);
    scene.updateMatrixWorld(true);
    const sun = new THREE.DirectionalLight();
    shadow.setSubject(scene, measureShadowSubject(model));
    shadow.update(view());
    const state = shadow.uniforms.molenSubjectShadow.value;
    expect(state.x).toBe(0);

    // Another scene's render (a sky, the far map's static root) leaves it alone.
    frame(new THREE.Scene(), [sun]);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.casting).toEqual({ body: true, glass: true, lamp: false });

    frame(scene, [sun]);
    expect(drawn).toHaveLength(3);
    // The sun's own maps: nothing of the car casts into them.
    expect(drawn[1]?.lights).toEqual([sun]);
    expect(drawn[1]?.root).toBe(scene);
    expect(drawn[1]?.casting).toEqual({ body: false, glass: false, lamp: false });
    // Then its own, from its root alone, for a light that is not in the scene. Glass is drawn
    // from both sides by a depth material of its own, which sets it deeper.
    expect(drawn[2]?.lights).toHaveLength(1);
    expect(drawn[2]?.lights[0]?.parent).toBeNull();
    expect(drawn[2]?.root).toBe(model);
    expect(drawn[2]?.casting).toEqual({ body: true, glass: true, lamp: false });
    expect(drawn[2]?.glassDepth).toBeInstanceOf(THREE.MeshDepthMaterial);
    expect(drawn[2]?.glassSide).toBe(THREE.DoubleSide);
    // Everything is as it was once the pass is over.
    expect(glass.castShadow).toBe(true);
    expect(glass.customDepthMaterial).toBeUndefined();
    expect(glassMaterial.shadowSide).toBeNull();
    expect(state.x).toBe(1);
    expect(shadow.info).toMatchObject({ draws: 1 });
    expect(shadow.info?.texel).toBeCloseTo((2 * (shadow.info?.radius ?? 0)) / 1024, 9);
    expect((shadow.uniforms.molenSubjectShadowMap.value as THREE.DepthTexture).image.width).toBe(4);

    // A scene drawn twice in a frame draws the map once, and still keeps the car out of the sun's.
    frame(scene, [sun]);
    expect(drawn).toHaveLength(4);
    expect(drawn[3]?.casting).toEqual({ body: false, glass: false, lamp: false });
    expect(shadow.info?.draws).toBe(1);
    shadow.dispose();
  });

  it('travels with the subject: its parts land on the same texels wherever it is', () => {
    const { model } = car();
    const { renderer, frame } = fakeRenderer(model);
    const shadow = new SubjectShadow(renderer);
    const scene = new THREE.Scene();
    scene.add(model);
    const measured = measureShadowSubject(model);
    shadow.setSubject(scene, measured);
    const matrix = shadow.uniforms.molenSubjectShadowMatrix.value;
    const mirror = new THREE.Vector3(0.95, 1.05, 0.8);
    const inMap = (): { middle: THREE.Vector4; part: THREE.Vector4 } => {
      scene.updateMatrixWorld(true);
      shadow.update(view());
      frame(scene);
      const at = (local: THREE.Vector3): THREE.Vector4 =>
        new THREE.Vector4(
          ...local.clone().applyMatrix4(model.matrixWorld).toArray(),
          1,
        ).applyMatrix4(matrix);
      return { middle: at(new THREE.Vector3().fromArray(measured.center)), part: at(mirror) };
    };
    const first = inMap();
    expect(first.middle.x).toBeCloseTo(0.5, 9);
    expect(first.middle.y).toBeCloseTo(0.5, 9);
    // 27.8 m/s for a sixtieth of a second: a third of a meter, and not a whole number of texels.
    model.position.set(0.137, 0, 0.4421);
    const second = inMap();
    expect(second.part.x).toBeCloseTo(first.part.x, 9);
    expect(second.part.y).toBeCloseTo(first.part.y, 9);
    expect(second.part.z).toBeCloseTo(first.part.z, 9);
    shadow.dispose();
  });

  it('fades out along the light, well past the subject', () => {
    const { model } = car();
    const { renderer, frame } = fakeRenderer(model);
    const shadow = new SubjectShadow(renderer);
    const scene = new THREE.Scene();
    scene.add(model);
    scene.updateMatrixWorld(true);
    const measured = measureShadowSubject(model);
    shadow.setSubject(scene, measured);
    shadow.update(view());
    frame(scene);
    const fade = (past: number): number => fadeAt(shadow, measured, past);
    // Full strength under and behind the car, none 60 m down the light.
    expect(fade(0)).toBeLessThan(0);
    expect(fade(30)).toBeCloseTo(0, 6);
    expect(fade(45)).toBeCloseTo(0.5, 6);
    expect(fade(60)).toBeCloseTo(1, 6);
    shadow.dispose();
  });

  it('grows its map for a larger subject as far as the view allows, and its shadow reaches farther', () => {
    // An aircraft: a sphere 23.5 m across the middle, too wide for 1.5 cm texels in 1024.
    const model = new THREE.Group();
    const airframe = new THREE.Mesh(
      new THREE.BoxGeometry(30, 6, 30),
      new THREE.MeshStandardMaterial(),
    );
    airframe.name = 'body';
    airframe.castShadow = true;
    model.add(airframe);
    const { renderer, drawn, frame } = fakeRenderer(model);
    const shadow = new SubjectShadow(renderer);
    const scene = new THREE.Scene();
    scene.add(model);
    scene.updateMatrixWorld(true);
    const measured = measureShadowSubject(model);
    shadow.setSubject(scene, measured);
    shadow.update(view());
    frame(scene);
    const light = drawn.at(-1)?.lights[0] as THREE.DirectionalLight;
    expect(light.shadow.mapSize.x).toBe(2048);
    expect(shadow.info?.texel).toBeCloseTo((2 * measured.radius) / 2048, 9);
    const first = light.shadow.map;
    // A map no larger than the sun's own (a low quality tier): a new one at that size.
    shadow.update(view({ mapSize: 1024 }));
    frame(scene);
    expect(light.shadow.mapSize.x).toBe(1024);
    expect(light.shadow.map).not.toBe(first);
    expect(shadow.info?.texel).toBeCloseTo((2 * measured.radius) / 1024, 9);
    // Dark for ten radii down the light, gone at twenty.
    const reach = measured.radius * 10;
    expect(fadeAt(shadow, measured, reach)).toBeCloseTo(0, 6);
    expect(fadeAt(shadow, measured, reach * 1.5)).toBeCloseTo(0.5, 6);
    expect(fadeAt(shadow, measured, reach * 2)).toBeCloseTo(1, 6);
    shadow.dispose();
  });

  it('leaves the subject in the sun’s map while it has none of its own', () => {
    const { model } = car();
    const { renderer, drawn, frame } = fakeRenderer(model);
    const shadow = new SubjectShadow(renderer);
    const scene = new THREE.Scene();
    scene.add(model);
    scene.updateMatrixWorld(true);
    const sun = new THREE.DirectionalLight();
    const state = shadow.uniforms.molenSubjectShadow.value;
    shadow.setSubject(scene, measureShadowSubject(model));
    shadow.update(view());
    frame(scene, [sun]);
    expect(state.x).toBe(1);

    // Shadows off or parked, or the sun down.
    shadow.update(undefined);
    expect(state.x).toBe(0);
    frame(scene, [sun]);
    expect(drawn.at(-1)?.root).toBe(scene);
    expect(drawn.at(-1)?.casting).toEqual({ body: true, glass: true, lamp: false });

    // Hidden, or taken out of the scene.
    shadow.update(view());
    model.visible = false;
    frame(scene, [sun]);
    expect(state.x).toBe(0);
    expect(drawn.at(-1)?.root).toBe(scene);
    model.visible = true;
    scene.remove(model);
    shadow.update(view());
    frame(scene, [sun]);
    expect(state.x).toBe(0);
    expect(drawn.at(-1)?.casting).toEqual({ body: true, glass: true, lamp: false });

    // Back in the scene: its own map again, and no subject at all: none.
    scene.add(model);
    shadow.update(view());
    frame(scene, [sun]);
    expect(state.x).toBe(1);
    shadow.setSubject(scene, undefined);
    expect(state.x).toBe(0);
    shadow.update(view());
    frame(scene, [sun]);
    expect(state.x).toBe(0);
    expect(drawn.at(-1)?.casting).toEqual({ body: true, glass: true, lamp: false });
    shadow.dispose();
  });
});

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { FarShadow, type FarShadowView, injectFarShadow } from '../src/three/far-shadow';
import { createCloudShadowUniforms, injectCloudShadows } from '../src/weather/cloud-shadows';

const litShader = (): THREE.WebGLProgramParametersWithUniforms =>
  ({
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  }) as unknown as THREE.WebGLProgramParametersWithUniforms;

/** three's shadow pass, as far as the far map uses it: a map for each light it is given. */
function fakeRenderer(): {
  renderer: THREE.WebGLRenderer;
  render: ReturnType<typeof vi.fn>;
  frame(scene: THREE.Object3D): void;
} {
  const render = vi.fn((lights: THREE.DirectionalLight[]) => {
    for (const light of lights) {
      light.shadow.map ??= {
        depthTexture: new THREE.DepthTexture(4, 4),
        dispose: () => {},
      } as unknown as THREE.WebGLRenderTarget;
      light.shadow.updateMatrices(light);
    }
  });
  const shadowMap = { render };
  const renderer = { shadowMap } as unknown as THREE.WebGLRenderer;
  return {
    renderer,
    render,
    // The scene's own lights first, as three's render() does.
    frame: (scene) => (shadowMap.render as unknown as (...a: unknown[]) => void)([], scene, null),
  };
}

const view = (overrides: Partial<FarShadowView> = {}): FarShadowView => ({
  direction: new THREE.Vector3(0.3, 0.8, 0.5).normalize(),
  center: new THREE.Vector3(0, 0, 0),
  radius: 2_000,
  mapSize: 2048,
  biasAddsTowardLight: false,
  worldOrigin: [0, 0, 0],
  now: 0,
  ...overrides,
});

describe('the far shadow map', () => {
  it('adds itself to lit shaders only, with or without the cloud shadow before it', () => {
    const far = new FarShadow(fakeRenderer().renderer);
    const lit = litShader();
    // Guards three upgrades: the chunks and the shadow lookup it wraps must still exist.
    expect(injectFarShadow(lit, far.uniforms)).toBe(true);
    expect(lit.vertexShader).toContain('vMolenFarShadowCoord = molenFarShadowMatrix');
    expect(lit.fragmentShader).toContain(
      'molenSunShadow( UNROLLED_LOOP_INDEX, getShadow( directionalShadowMap[ i ]',
    );
    expect(lit.uniforms.molenFarShadowMap).toBe(far.uniforms.molenFarShadowMap);

    const clouded = litShader();
    injectCloudShadows(clouded, createCloudShadowUniforms(new THREE.Texture()));
    expect(injectFarShadow(clouded, far.uniforms)).toBe(true);
    expect(clouded.fragmentShader).toContain('molenCloudShadowAt( geometryPosition');
    expect(clouded.fragmentShader).toContain('molenSunShadow( UNROLLED_LOOP_INDEX');

    const unlit = {
      vertexShader: THREE.ShaderLib.basic.vertexShader,
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    expect(injectFarShadow(unlit, far.uniforms)).toBe(false);
    expect(unlit.fragmentShader).toBe(THREE.ShaderLib.basic.fragmentShader);
    expect(unlit.uniforms).toEqual({});
    far.dispose();
  });

  it('always gives its sampler a depth texture with a comparison', () => {
    const far = new FarShadow(fakeRenderer().renderer);
    // Without one every lit draw is rejected: a shadow sampler cannot read a color texture.
    const none = far.uniforms.molenFarShadowMap.value as THREE.DepthTexture;
    expect(none.isDepthTexture).toBe(true);
    expect(none.compareFunction).toBe(THREE.LessEqualCompare);
    expect(none.version).toBeGreaterThan(0);
    expect(far.uniforms.molenFarShadow.value.x).toBe(0);
    far.dispose();
  });

  it('draws from the static root alone, and again only when it has to', () => {
    const { renderer, render, frame } = fakeRenderer();
    const far = new FarShadow(renderer);
    const scene = new THREE.Scene();
    const casters = new THREE.Group();
    far.setCasters(scene, casters);
    const state = far.uniforms.molenFarShadow.value;

    far.update(view());
    expect(state.x).toBe(0);
    // Another scene's render (a sky, a reflection) leaves it alone.
    frame(new THREE.Scene());
    expect(render).toHaveBeenCalledTimes(1);
    frame(scene);
    expect(render).toHaveBeenCalledTimes(3);
    const [lights, root] = render.mock.calls[2] as unknown as [THREE.Light[], THREE.Object3D];
    expect(lights).toHaveLength(1);
    expect(lights[0]?.parent).toBeNull();
    expect(root).toBe(casters);
    expect(state.x).toBe(1);
    expect(far.info).toMatchObject({ radius: 2_048, draws: 1 });
    expect((far.uniforms.molenFarShadowMap.value as THREE.DepthTexture).image.width).toBe(4);

    // The same view a moment later: the map stands.
    far.update(view({ now: 400 }));
    frame(scene);
    expect(far.info?.draws).toBe(1);
    // A short move stays inside it; an eighth of its radius does not.
    far.update(view({ now: 500, center: new THREE.Vector3(200, 0, 0) }));
    frame(scene);
    expect(far.info?.draws).toBe(1);
    far.update(view({ now: 600, center: new THREE.Vector3(300, 0, 0) }));
    frame(scene);
    expect(far.info?.draws).toBe(2);
    // Scenery that streamed in is picked up within a second, and a moved sun at once.
    far.update(view({ now: 1_700, center: new THREE.Vector3(300, 0, 0) }));
    frame(scene);
    expect(far.info?.draws).toBe(3);
    far.update(
      view({
        now: 1_800,
        center: new THREE.Vector3(300, 0, 0),
        direction: new THREE.Vector3(0.32, 0.8, 0.5).normalize(),
      }),
    );
    frame(scene);
    expect(far.info?.draws).toBe(4);

    // Shadows off or parked: no lookups, and nothing kept that would be stale on return.
    far.update(undefined);
    expect(state.x).toBe(0);
    expect(far.info).toBeUndefined();
    far.dispose();
  });

  it('keeps an absolute point at the same place in the map through an origin rebase', () => {
    const { renderer, frame } = fakeRenderer();
    const far = new FarShadow(renderer);
    const scene = new THREE.Scene();
    far.setCasters(scene, new THREE.Group());
    far.update(view({ worldOrigin: [10_000, 0, 0], center: new THREE.Vector3(100, 0, 0) }));
    frame(scene);
    const matrix = far.uniforms.molenFarShadowMatrix.value;
    // Absolute (10 150, 5, 40), seen from the origin the map was drawn at.
    const before = new THREE.Vector3(150, 5, 40).applyMatrix4(matrix);
    far.update(
      view({
        now: 100,
        worldOrigin: [10_123.5, 10, -20],
        center: new THREE.Vector3(100 - 123.5, -10, 20),
      }),
    );
    // Not redrawn (the camera has not moved): the stored matrix follows the new origin.
    expect(far.info?.draws).toBe(1);
    const after = new THREE.Vector3(150 - 123.5, 5 - 10, 40 + 20).applyMatrix4(matrix);
    expect(after.distanceTo(before)).toBeLessThan(1e-9);
    far.dispose();
  });
});

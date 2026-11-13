import * as THREE from 'three';
import * as tsl from 'three/tsl';
import type { Node } from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { installWebGlCloudShadows } from '../src/weather/cloud-shadows';
import {
  createSnowCoverUniforms,
  enableSnowCover,
  injectSnowCover,
  SNOW_COVER_FACING,
  SNOW_COVER_GLSL,
  SNOW_COVER_PERIOD,
  snowCoverAmount,
  snowCoverFacing,
  snowLineNode,
  snowSurfaceNode,
  writeSnowCover,
} from '../src/weather/snow-cover';

const litShader = (): THREE.WebGLProgramParametersWithUniforms =>
  ({
    vertexShader: THREE.ShaderLib.standard.vertexShader,
    fragmentShader: THREE.ShaderLib.standard.fragmentShader,
    uniforms: {},
  }) as unknown as THREE.WebGLProgramParametersWithUniforms;

describe('lying snow on marked materials', () => {
  it('writes the snow line in rendered height and the origin within the wander period', () => {
    const uniforms = createSnowCoverUniforms();
    // No cover: an amount of 0, which every shader tests before doing any work.
    expect(uniforms.molenSnowCover.value.z).toBe(0);
    writeSnowCover(uniforms, { level: 1800, transition: 120 }, [9_156_226.5, 300, -4_073_143.25]);
    expect(uniforms.molenSnowCover.value.toArray()).toEqual([1500, 120, 1, 0]);
    const origin = uniforms.molenSnowOrigin.value.clone();
    for (const value of [origin.x, origin.y]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(SNOW_COVER_PERIOD);
    }
    // Whole periods apart is the same snow line.
    writeSnowCover(uniforms, { level: 1800 }, [
      9_156_226.5 + SNOW_COVER_PERIOD * 2,
      0,
      -4_073_143.25 - SNOW_COVER_PERIOD,
    ]);
    expect(uniforms.molenSnowOrigin.value.x).toBeCloseTo(origin.x, 6);
    expect(uniforms.molenSnowOrigin.value.y).toBeCloseTo(origin.y, 6);
    expect(uniforms.molenSnowCover.value.toArray()).toEqual([1800, 150, 1, 0]);
    writeSnowCover(uniforms, undefined, [0, 0, 0]);
    expect(uniforms.molenSnowCover.value.z).toBe(0);
  });

  it('adds the dusting after the normal is final, with one switch per material', () => {
    const uniforms = createSnowCoverUniforms();
    const marked = litShader();
    const foliage = enableSnowCover(new THREE.MeshStandardMaterial(), 0.8, [-0.05, 0.55]);
    expect(injectSnowCover(marked, uniforms, foliage)).toBe(true);
    const lit = marked.fragmentShader;
    expect(lit.indexOf('molenSnowLine(')).toBeGreaterThan(-1);
    // Lighting reads the surface after the snow has changed it.
    expect(lit.indexOf('if ( molenSnowSurface.x > 0.0')).toBeGreaterThan(
      lit.indexOf('#include <normal_fragment_maps>'),
    );
    expect(lit.indexOf('if ( molenSnowSurface.x > 0.0')).toBeLessThan(
      lit.indexOf('#include <lights_physical_fragment>'),
    );
    expect(lit).toContain('roughnessFactor = mix( roughnessFactor, 0.9, molenSnow );');
    expect(marked.uniforms.molenSnowCover).toBe(uniforms.molenSnowCover);
    // Its own amount, and the facing range it dusts over.
    expect((marked.uniforms.molenSnowSurface?.value as THREE.Vector3).toArray()).toEqual([
      0.8, -0.05, 0.55,
    ]);
    // An unmarked material gets the same source (so programs are shared) and an amount of 0.
    const plain = litShader();
    injectSnowCover(plain, uniforms, new THREE.MeshStandardMaterial());
    expect(plain.fragmentShader).toBe(lit);
    expect((plain.uniforms.molenSnowSurface?.value as THREE.Vector3).x).toBe(0);
    // Unlit shaders have no view position to find the world height from: left alone.
    const unlit = {
      fragmentShader: THREE.ShaderLib.basic.fragmentShader,
      uniforms: {},
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    expect(injectSnowCover(unlit, uniforms, foliage)).toBe(false);
    expect(unlit.fragmentShader).toBe(THREE.ShaderLib.basic.fragmentShader);
    // A ground material includes the snow line itself and also takes the renderer's hook.
    expect(SNOW_COVER_GLSL).toContain('#ifndef MOLEN_SNOW_LINE');
    for (const word of ['patch', 'sample', 'filter', 'common', 'partition', 'active'])
      expect(lit.slice(0, lit.indexOf('void main')), word).not.toMatch(
        new RegExp(`\\bmolen\\w*${word}\\b`),
      );
  });

  it('marks a material once, keeps the mark through clone and names it in the program key', () => {
    const material = new THREE.MeshStandardMaterial();
    const key = material.customProgramCacheKey();
    expect(snowCoverAmount(material)).toBe(0);
    expect(enableSnowCover(material)).toBe(material);
    expect(snowCoverAmount(material)).toBe(1);
    expect(material.customProgramCacheKey()).toBe(`${key}|molen-snow-cover:1:0.3,0.75`);
    expect(snowCoverFacing(material)).toBe(SNOW_COVER_FACING);
    // Marking again changes the amount and the facing range, not the key's shape.
    enableSnowCover(material, 0.5, [0, 0.5]);
    expect(material.customProgramCacheKey()).toBe(`${key}|molen-snow-cover:0.5:0,0.5`);
    const clone = material.clone();
    expect(snowCoverAmount(clone)).toBe(0.5);
    expect(snowCoverFacing(clone)).toEqual([0, 0.5]);
    expect(() => enableSnowCover(material, 0)).toThrow(RangeError);
    expect(() => enableSnowCover(material, 1.5)).toThrow(RangeError);
    expect(() => enableSnowCover(material, 1, [0.5, 0.5])).toThrow(RangeError);
  });

  it('reaches a marked material through the renderer-wide hook, and no other', () => {
    const renderer = {} as THREE.WebGLRenderer;
    const uniforms = createSnowCoverUniforms();
    const seen: number[] = [];
    const release = installWebGlCloudShadows(
      renderer,
      {
        molenCloudMap: { value: new THREE.Texture() },
        molenCloudShadow: { value: new THREE.Vector4() },
        molenCloudField: { value: new THREE.Vector4() },
        molenCloudMix: { value: new THREE.Vector4() },
        molenCloudFit: { value: new THREE.Vector4() },
      },
      (shader, material) => {
        seen.push(snowCoverAmount(material));
        injectSnowCover(shader, uniforms, material);
      },
    );
    const roof = enableSnowCover(new THREE.MeshStandardMaterial());
    const glass = new THREE.MeshStandardMaterial();
    const roofShader = litShader();
    const glassShader = litShader();
    roof.onBeforeCompile(roofShader, renderer);
    glass.onBeforeCompile(glassShader, renderer);
    expect(seen).toEqual([1, 0]);
    expect((roofShader.uniforms.molenSnowSurface?.value as THREE.Vector3).x).toBe(1);
    expect((glassShader.uniforms.molenSnowSurface?.value as THREE.Vector3).x).toBe(0);
    expect(glassShader.fragmentShader).toBe(roofShader.fragmentShader);
    release();
  });

  it('builds the same line and dusting as nodes', () => {
    const snow = tsl.uniform(new THREE.Vector4(1500, 150, 1, 0)) as unknown as Node<'vec4'>;
    const p = tsl.positionWorld.xz as unknown as Node<'vec2'>;
    const height = tsl.positionWorld.y as unknown as Node<'float'>;
    expect(snowLineNode(tsl, p, height, snow)).toBeTruthy();
    const { cover, color } = snowSurfaceNode(
      tsl,
      p,
      height,
      tsl.normalWorldGeometry.y as unknown as Node<'float'>,
      snow,
      0.8,
    );
    expect(cover).toBeTruthy();
    expect(color).toBeTruthy();
  });
});

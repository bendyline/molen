import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createBuildingWeathering,
  createBuildingWeatheringAsync,
} from '../../src/client/building-weathering';
import { createVertexColorMaterialSet } from '../../src/client/materials';

describe('building weathering', () => {
  it('adds facade and roof weathering to the WebGL standard material once', () => {
    const decorate = createBuildingWeathering();
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    decorate(material, 'wall');
    const hook = material.onBeforeCompile;
    decorate(material, 'roof');
    expect(material.onBeforeCompile).toBe(hook);
    const shader = {
      uniforms: {},
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <color_fragment>',
    } as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain('vWeatherNormal = objectNormal;');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb *= buildingWeather();');
    // GLSL ES 3.0 reserves these; a variable with one of their names fails to compile.
    for (const word of ['patch', 'sample', 'filter', 'common', 'partition', 'active'])
      expect(shader.fragmentShader, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    expect(material.customProgramCacheKey()).toContain('worldgen-weathering@3');
    material.dispose();
  });

  it('leaves glass alone and gives WebGPU a color node on the standard material', async () => {
    const decorate = await createBuildingWeatheringAsync('webgpu');
    const glass = new THREE.MeshStandardMaterial();
    decorate(glass, 'window');
    expect((glass as { colorNode?: unknown }).colorNode).toBeUndefined();
    const wall = new THREE.MeshStandardMaterial();
    decorate(wall, 'wall');
    expect((wall as { colorNode?: unknown }).colorNode).toBeTruthy();
    glass.dispose();
    wall.dispose();
  });

  it('decorates every slot material a set creates', () => {
    const seen: string[] = [];
    const set = createVertexColorMaterialSet({ decorate: (_material, slot) => seen.push(slot) });
    set.materialFor('wall', 'palette:#ffffff');
    set.materialFor('wall', 'palette:#000000');
    set.materialFor('roof', 'palette:#ffffff');
    expect(seen).toEqual(['wall', 'roof']);
    set.dispose?.();
  });
});

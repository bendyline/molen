import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createTerrainWaterMaterial,
  createTerrainWaterMaterialAsync,
  setTerrainWaterTime,
  type TerrainWaterMaterial,
  type TerrainWaterMaterialOptions,
} from '../src/semantic-client';

function shaderUniforms(material: TerrainWaterMaterial): Map<string, THREE.IUniform<unknown>> {
  const uniforms = new Map<string, THREE.IUniform<unknown>>();
  if ('isMeshPhysicalNodeMaterial' in material) {
    material.colorNode?.traverse((node) => {
      if (
        'isUniformNode' in node &&
        'name' in node &&
        typeof node.name === 'string' &&
        'value' in node
      )
        uniforms.set(node.name, node);
    });
  } else {
    const shader = {
      uniforms: {},
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <color_fragment>\n#include <roughnessmap_fragment>',
    } as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    for (const [name, value] of Object.entries(shader.uniforms)) uniforms.set(name, value);
  }
  return uniforms;
}

describe('terrain water rendering backends', () => {
  it('keeps the asynchronous default on the original WebGL material', async () => {
    const material = await createTerrainWaterMaterialAsync();
    expect(material).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    expect(material.customProgramCacheKey()).toBe('terrain-water@1');
    material.dispose();
  });

  it('preserves physical settings and transparent water opacity in the node material', async () => {
    const options: TerrainWaterMaterialOptions = {
      color: '#146080',
      roughness: 0.47,
      clearcoat: 0.63,
      clearcoatRoughness: 0.34,
      opacity: 0.72,
    };
    const legacy = createTerrainWaterMaterial(options);
    const material = await createTerrainWaterMaterialAsync(options, 'webgpu');
    expect('isMeshPhysicalNodeMaterial' in material).toBe(true);
    for (const key of [
      'roughness',
      'metalness',
      'clearcoat',
      'clearcoatRoughness',
      'opacity',
      'transparent',
      'depthWrite',
      'polygonOffset',
      'polygonOffsetFactor',
      'polygonOffsetUnits',
    ] as const) {
      expect(material[key], key).toEqual(legacy[key]);
    }
    expect(material.color.equals(legacy.color)).toBe(true);
    if (!('isMeshPhysicalNodeMaterial' in material)) throw new Error('Expected node water');
    expect(material.colorNode).not.toBeNull();
    expect(material.roughnessNode).not.toBeNull();
    material.dispose();
    legacy.dispose();
  });

  it.each([
    'webgl',
    'webgpu',
  ] as const)('%s advances the uniforms consumed by its shader and keeps separate water instances independent', async (backend) => {
    const material = await createTerrainWaterMaterialAsync(
      { waveScale: 0.12, waveStrength: 0.07, waveSpeed: 0.9 },
      backend,
    );
    const other = await createTerrainWaterMaterialAsync({}, backend);
    const uniforms = shaderUniforms(material);
    const otherUniforms = shaderUniforms(other);
    const origin = uniforms.get('terrainWaterWorldOrigin')?.value;
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(uniforms.get('terrainWaterWaveScale')?.value).toBe(0.12);
    expect(uniforms.get('terrainWaterWaveStrength')?.value).toBe(0.07);
    expect(uniforms.get('terrainWaterWaveSpeed')?.value).toBe(0.9);
    setTerrainWaterTime(material, 42, [10_000, -20_000]);
    expect(uniforms.get('terrainWaterTime')?.value).toBe(42);
    expect(origin).toEqual(new THREE.Vector2(10_000, -20_000));
    expect(otherUniforms.get('terrainWaterTime')?.value).toBe(0);
    expect(otherUniforms.get('terrainWaterWorldOrigin')?.value).toEqual(new THREE.Vector2());
    setTerrainWaterTime(material, 43);
    expect(uniforms.get('terrainWaterTime')?.value).toBe(43);
    expect(uniforms.get('terrainWaterWorldOrigin')?.value).toBe(origin);
    expect(origin).toEqual(new THREE.Vector2());
    material.dispose();
    other.dispose();
  });

  it('rejects unrelated materials instead of silently leaving water animation frozen', () => {
    const material = new THREE.MeshPhysicalMaterial();
    expect(() => setTerrainWaterTime(material, 1)).toThrow('terrain water material factory');
    material.dispose();
  });
});

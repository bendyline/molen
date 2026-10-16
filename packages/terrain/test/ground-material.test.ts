import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createTerrainGroundMaterial,
  createTerrainGroundMaterialAsync,
  isTerrainGroundMaterial,
  setTerrainGroundOrigin,
} from '../src/ground-material';

function compile(material: THREE.MeshStandardMaterial): THREE.WebGLProgramParametersWithUniforms {
  const shader = {
    uniforms: {},
    vertexShader: '#include <begin_vertex>',
    fragmentShader: '#include <color_fragment>',
  } as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader;
}

describe('terrain ground variation', () => {
  it('adds world-space variation to the WebGL vertex-color ground', () => {
    const material = createTerrainGroundMaterial();
    expect(material.vertexColors).toBe(true);
    expect(material.customProgramCacheKey()).not.toBe(
      createTerrainGroundMaterial({ agriculture: true }).customProgramCacheKey(),
    );
    const shader = compile(material);
    expect(shader.vertexShader).toContain('vTerrainGround =');
    expect(shader.fragmentShader).toContain(
      'diffuseColor.rgb *= terrainGroundFactor(diffuseColor.rgb, length(vViewPosition));',
    );
    // GLSL ES 3.0 reserves these words; one as an identifier fails the whole ground program.
    for (const word of ['patch', 'sample', 'filter', 'common', 'partition', 'active'])
      expect(shader.fragmentShader, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    material.dispose();
  });

  it('keeps the pattern fixed to the ground across rebases, with small shader numbers', async () => {
    for (const backend of ['webgl', 'webgpu'] as const) {
      const material = await createTerrainGroundMaterialAsync({}, backend);
      expect(isTerrainGroundMaterial(material)).toBe(true);
      const origin = (): THREE.Vector2 => {
        if (backend === 'webgl')
          return (compile(material as THREE.MeshStandardMaterial).uniforms.terrainGroundOrigin
            ?.value ?? new THREE.Vector2()) as THREE.Vector2;
        let found: THREE.Vector2 | undefined;
        (
          material as { colorNode?: { traverse(fn: (node: object) => void): void } }
        ).colorNode?.traverse((node) => {
          if ('name' in node && node.name === 'terrainGroundOrigin' && 'value' in node)
            found = node.value as THREE.Vector2;
        });
        return found ?? new THREE.Vector2();
      };
      setTerrainGroundOrigin(material, [-9_156_226.5, -4_073_143.25]);
      const first = origin().clone();
      expect(first.x).toBeGreaterThanOrEqual(0);
      expect(first.x).toBeLessThan(4096);
      expect(first.y).toBeGreaterThanOrEqual(0);
      expect(first.y).toBeLessThan(4096);
      // Whole periods apart is the same ground pattern.
      setTerrainGroundOrigin(material, [-9_156_226.5 + 4096 * 3, -4_073_143.25 - 4096]);
      expect(origin().x).toBeCloseTo(first.x, 6);
      expect(origin().y).toBeCloseTo(first.y, 6);
      material.dispose();
    }
  });

  it('builds the WebGPU variation as nodes over the renderer’s own vertex colors', async () => {
    const material = await createTerrainGroundMaterialAsync({ roughness: 0.9 }, 'webgpu');
    expect('isMeshStandardNodeMaterial' in material).toBe(true);
    expect(material.vertexColors).toBe(true);
    expect(material.roughness).toBe(0.9);
    expect((material as { colorNode?: unknown }).colorNode).toBeTruthy();
    material.dispose();
  });

  it('rejects out-of-range strength and foreign materials', () => {
    expect(() => createTerrainGroundMaterial({ strength: 3 })).toThrow(RangeError);
    expect(() => setTerrainGroundOrigin(new THREE.MeshStandardMaterial(), [0, 0])).toThrow(
      /terrain ground material/,
    );
  });
});

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createTerrainGroundMaterial,
  createTerrainGroundMaterialAsync,
  createTerrainPavementMaterial,
  createTerrainPavementMaterialAsync,
  isTerrainGroundMaterial,
  setTerrainGroundOrigin,
} from '../src/ground-material';

function compile(material: THREE.MeshStandardMaterial): THREE.WebGLProgramParametersWithUniforms {
  const shader = {
    uniforms: {},
    vertexShader: '#include <begin_vertex>',
    fragmentShader: '#include <color_fragment>\n#include <normal_fragment_maps>',
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
      'diffuseColor.rgb *= terrainGroundFactor(diffuseColor.rgb, terrainGroundDistance, terrainGroundRelief);',
    );
    // The relief perturbs the shading normal after three's own normal maps.
    expect(shader.fragmentShader).toContain(
      'normal = terrainGroundBump(-vViewPosition, normal, terrainGroundRelief, faceDirection);',
    );
    expect(shader.fragmentShader).not.toContain('vLandcoverBlend');
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
        // The graph shares subtrees heavily (warped noise feeds noise), so walk it once per node.
        type GraphNode = { name?: string; value?: unknown; getChildren(): Iterable<GraphNode> };
        const seen = new Set<GraphNode>();
        const stack = [(material as { colorNode?: GraphNode }).colorNode].filter(
          (node): node is GraphNode => node !== undefined,
        );
        while (stack.length > 0) {
          const node = stack.pop() as GraphNode;
          if (seen.has(node)) continue;
          seen.add(node);
          if (node.name === 'terrainGroundOrigin' && node.value instanceof THREE.Vector2)
            return node.value;
          for (const child of node.getChildren()) stack.push(child);
        }
        return new THREE.Vector2();
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

  it('blends landcover toward the neighboring class with organic edges', () => {
    const material = createTerrainGroundMaterial({ agriculture: true });
    const shader = compile(material);
    expect(shader.vertexShader).toContain('attribute vec4 landcoverBlend;');
    expect(shader.vertexShader).toContain('vLandcoverBlend = landcoverBlend;');
    expect(shader.fragmentShader).toContain(
      'diffuseColor.rgb = mix(diffuseColor.rgb, vLandcoverBlend.yzw,',
    );
    expect(shader.fragmentShader).toContain('terrainGroundEdge(vLandcoverBlend.x');
    material.dispose();
  });

  it('builds the WebGPU relief as a node normal', async () => {
    const material = await createTerrainGroundMaterialAsync({ agriculture: true }, 'webgpu');
    expect((material as { normalNode?: unknown }).normalNode).toBeTruthy();
    material.dispose();
  });

  it('draws pavement detail from band coordinates on both backends', async () => {
    const webgl = createTerrainPavementMaterial();
    expect(webgl.side).toBe(THREE.DoubleSide);
    expect(isTerrainGroundMaterial(webgl)).toBe(true);
    const shader = compile(webgl);
    expect(shader.vertexShader).toContain('attribute vec4 surfaceDetail;');
    expect(shader.fragmentShader).toContain(
      'vec4 terrainPavement = terrainPavementFactor(diffuseColor.rgb);',
    );
    // Frayed band edges let the ground show through, antialiased by alpha to coverage.
    expect(shader.fragmentShader).toContain('if (terrainFray < -0.5) discard;');
    expect(webgl.alphaToCoverage).toBe(true);
    for (const word of ['patch', 'sample', 'filter', 'common', 'partition', 'active'])
      expect(shader.fragmentShader, word).not.toMatch(new RegExp(`\\b${word}\\b`));
    expect(webgl.customProgramCacheKey()).not.toBe(
      createTerrainGroundMaterial().customProgramCacheKey(),
    );
    const webgpu = await createTerrainPavementMaterialAsync({}, 'webgpu');
    expect('isMeshStandardNodeMaterial' in webgpu).toBe(true);
    expect((webgpu as { colorNode?: unknown }).colorNode).toBeTruthy();
    expect((webgpu as { maskNode?: unknown }).maskNode).toBeTruthy();
    expect((webgpu as { opacityNode?: unknown }).opacityNode).toBeTruthy();
    expect(webgpu.alphaToCoverage).toBe(true);
    setTerrainGroundOrigin(webgpu, [12_345, -6_789]);
    webgl.dispose();
    webgpu.dispose();
  });

  it('rejects out-of-range strength and foreign materials', () => {
    expect(() => createTerrainGroundMaterial({ strength: 3 })).toThrow(RangeError);
    expect(() => setTerrainGroundOrigin(new THREE.MeshStandardMaterial(), [0, 0])).toThrow(
      /terrain ground material/,
    );
  });
});

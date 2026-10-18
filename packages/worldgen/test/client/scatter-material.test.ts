import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ModelLibrary } from '../../src/client/instanced-models';
import {
  createScatterMaterial,
  createScatterMaterialAsync,
  SCATTER_CANOPY_ATTRIBUTE,
  setScatterCanopy,
} from '../../src/client/scatter-material';

describe('scatter material', () => {
  it('adds leaf speckle and crown occlusion to the WebGL vertex-color material', () => {
    const material = createScatterMaterial();
    expect(material.vertexColors).toBe(true);
    const shader = {
      uniforms: {},
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <color_fragment>',
    } as THREE.WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
    expect(shader.vertexShader).toContain(`attribute float ${SCATTER_CANOPY_ATTRIBUTE};`);
    expect(shader.vertexShader).toContain('vScatterLocal = transformed;');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb *= scatterFactor();');
    expect(material.customProgramCacheKey()).toBe('worldgen-scatter@1');
    material.dispose();
  });

  it('builds the same detail as nodes for WebGPU', async () => {
    const material = await createScatterMaterialAsync('webgpu');
    expect('isMeshStandardNodeMaterial' in material).toBe(true);
    expect((material as { colorNode?: unknown }).colorNode).toBeTruthy();
    material.dispose();
  });

  it('writes relative plant height, and zero for props, once per geometry', () => {
    const plant = new THREE.BoxGeometry(1, 4, 1).translate(0, 2, 0);
    setScatterCanopy(plant, true);
    const canopy = plant.getAttribute(SCATTER_CANOPY_ATTRIBUTE);
    const position = plant.getAttribute('position');
    for (let i = 0; i < canopy.count; i++)
      expect(canopy.getX(i)).toBeCloseTo(1 + position.getY(i) / 4, 6);
    setScatterCanopy(plant, false);
    expect(plant.getAttribute(SCATTER_CANOPY_ATTRIBUTE)).toBe(canopy);
    const prop = new THREE.BoxGeometry(1, 1, 1);
    setScatterCanopy(prop, false);
    expect([...prop.getAttribute(SCATTER_CANOPY_ATTRIBUTE).array].every((v) => v === 0)).toBe(true);
  });

  it('gives every prepared model the attribute and keeps a host material', async () => {
    const host = new THREE.MeshStandardMaterial();
    const dispose = vi.spyOn(host, 'dispose');
    const library = new ModelLibrary(undefined, {}, false, {}, host);
    const tree = await library.prepare('builtin:tree.deciduous.oak');
    expect(tree.material).toBe(host);
    expect(tree.geometry.getAttribute(SCATTER_CANOPY_ATTRIBUTE)).toBeDefined();
    library.dispose();
    // Caller-owned: the library does not dispose a material it was given.
    expect(dispose).not.toHaveBeenCalled();
    host.dispose();
  });
});

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ModelLibrary } from '../../src/client/instanced-models';
import {
  createScatterMaterial,
  createScatterMaterialAsync,
  SCATTER_CANOPY_ATTRIBUTE,
  SCATTER_SOLID_UV,
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
    expect(material.customProgramCacheKey()).toBe('worldgen-scatter@3');
    material.dispose();
  });

  it('cuts leaf cards from one shared atlas whose solid block leaves other surfaces untouched', () => {
    const material = createScatterMaterial();
    const atlas = material.map as THREE.DataTexture;
    expect(atlas).toBe(createScatterMaterial().map);
    expect(material.alphaTest).toBe(0.5);
    expect(material.alphaToCoverage).toBe(true);
    const levels = atlas.mipmaps as unknown as {
      data: Uint8Array;
      width: number;
      height: number;
    }[];
    const { data, width, height } = levels[0] as (typeof levels)[number];
    const solid =
      (Math.floor(SCATTER_SOLID_UV[1] * height) * width + Math.floor(SCATTER_SOLID_UV[0] * width)) *
      4;
    expect([...data.subarray(solid - 4, solid + 8)].every((v) => v === 255)).toBe(true);
    // Every level keeps the leaf and spray regions' share of texels passing the alpha test.
    const coverage = ({ data, width, height }: (typeof levels)[number]): number => {
      const span = Math.max(1, (width * 15) / 16);
      let passed = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < span; x++)
          if ((data[(y * width + x) * 4 + 3] as number) > 127) passed++;
      return passed / (span * height);
    };
    const full = coverage(levels[0] as (typeof levels)[number]);
    expect(full).toBeGreaterThan(0.3);
    for (const level of levels.slice(1, 6)) expect(coverage(level)).toBeCloseTo(full, 1);
    expect(levels.at(-1)).toMatchObject({ width: 1, height: 1 });
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
    const authored = plant.getAttribute('uv');
    setScatterCanopy(plant, true);
    const canopy = plant.getAttribute(SCATTER_CANOPY_ATTRIBUTE);
    const position = plant.getAttribute('position');
    for (let i = 0; i < canopy.count; i++)
      expect(canopy.getX(i)).toBeCloseTo(1 + position.getY(i) / 4, 6);
    setScatterCanopy(plant, false);
    expect(plant.getAttribute(SCATTER_CANOPY_ATTRIBUTE)).toBe(canopy);
    const prop = new THREE.BoxGeometry(1, 1, 1);
    prop.deleteAttribute('uv');
    setScatterCanopy(prop, false);
    expect([...prop.getAttribute(SCATTER_CANOPY_ATTRIBUTE).array].every((v) => v === 0)).toBe(true);
    // Geometry without atlas coordinates samples the solid block; authored ones are kept.
    const uv = prop.getAttribute('uv');
    for (let i = 0; i < uv.count; i++)
      expect([uv.getX(i), uv.getY(i)]).toEqual(SCATTER_SOLID_UV.map(Math.fround));
    expect(plant.getAttribute('uv')).toBe(authored);
  });

  it('gives every prepared model the attribute and keeps a host material', async () => {
    const host = new THREE.MeshStandardMaterial();
    const dispose = vi.spyOn(host, 'dispose');
    const library = new ModelLibrary(undefined, {}, false, {}, host);
    const tree = await library.prepare('builtin:tree.deciduous.oak');
    expect(tree.material).toBe(host);
    expect(tree.geometry.getAttribute(SCATTER_CANOPY_ATTRIBUTE)).toBeDefined();
    // Builtin primitives drop their own texture coordinates for the atlas's solid block.
    const box = await library.prepare('builtin:box');
    expect(box.geometry.getAttribute('uv').getX(0)).toBeCloseTo(SCATTER_SOLID_UV[0], 6);
    // The garden shrub is a generated plant: leaf cards sample the atlas off the solid block.
    const shrub = await library.prepare('builtin:shrub');
    const uv = shrub.geometry.getAttribute('uv');
    let cards = 0;
    for (let i = 0; i < uv.count; i++) if (uv.getX(i) < SCATTER_SOLID_UV[0] - 0.05) cards++;
    expect(cards).toBeGreaterThan(0);
    expect(shrub.geometry.getAttribute(SCATTER_CANOPY_ATTRIBUTE)).toBeDefined();
    library.dispose();
    // Caller-owned: the library does not dispose a material it was given.
    expect(dispose).not.toHaveBeenCalled();
    host.dispose();
  });
});

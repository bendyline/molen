import { MathUtils, Vector3 } from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { describe, expect, it } from 'vitest';
import { createEarthFog, createEarthSky, updateEarthFog } from '../src/client/atmosphere';
import { earthPerformanceTier } from '../src/client/performance';

describe('earth horizon visibility', () => {
  it('keeps neighborhoods clear and reserves stronger haze for the distance across device tiers', () => {
    const fog = createEarthFog('webgl');
    const visibility: number[] = [];
    for (let level = 0; level <= 5; level++) {
      updateEarthFog(fog, earthPerformanceTier(level).terrain.viewDistance, 150);
      expect(MathUtils.smoothstep(2_000, fog.near, fog.far)).toBe(0);
      const distantHaze = MathUtils.smoothstep(5_000, fog.near, fog.far);
      expect(distantHaze).toBeGreaterThan(0);
      expect(distantHaze).toBeLessThan(0.3);
      expect(MathUtils.smoothstep(20_000, fog.near, fog.far)).toBe(1);
      // Only the minimum tier's 12 km coverage needs to shorten the atmosphere.
      if (level > 0) visibility.push(distantHaze);
    }
    expect(new Set(visibility).size).toBe(1);
  });

  it('preserves the foreground at the default aerial viewpoint on both backends', () => {
    for (const backend of ['webgl', 'webgpu'] as const) {
      const fog = createEarthFog(backend);
      updateEarthFog(fog, 60_000, 1_400);
      expect(MathUtils.smoothstep(2_000, fog.near, fog.far)).toBe(0);
      expect(MathUtils.smoothstep(5_000, fog.near, fog.far)).toBeLessThan(0.1);
      expect(MathUtils.smoothstep(15_000, fog.near, fog.far)).toBeGreaterThan(0.75);
    }
  });

  it('keeps the ground visible from high altitude and fades before short fixed-grid edges', () => {
    const fog = createEarthFog('webgpu');
    updateEarthFog(fog, 110_000, 17_000);
    expect(MathUtils.smoothstep(17_000, fog.near, fog.far)).toBeLessThan(0.15);
    updateEarthFog(fog, 500, 150);
    expect(fog.near).toBeGreaterThan(0);
    expect(fog.near).toBeLessThan(fog.far);
    expect(MathUtils.smoothstep(500, fog.near, fog.far)).toBe(1);
  });
});

describe('explorer atmosphere backends', () => {
  it('uses native node shaders on WebGPU and preserves the legacy clear-sky parameters', async () => {
    const legacy = await createEarthSky('webgl');
    const nodes = await createEarthSky('webgpu');
    try {
      expect(legacy).toBeInstanceOf(Sky);
      if (!('isSkyMesh' in nodes) || !('uniforms' in legacy.material)) {
        throw new Error('backend selected an incompatible atmosphere shader');
      }
      expect(nodes.material.isNodeMaterial).toBe(true);
      expect(nodes.cloudCoverage.value).toBe(0);
      for (const name of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'] as const) {
        expect(nodes[name].value).toBe(legacy.material.uniforms[name]?.value);
      }
      const legacySun = legacy.material.uniforms.sunPosition?.value as Vector3;
      expect(nodes.sunPosition.value.distanceTo(legacySun)).toBe(0);
      for (const sky of [legacy, nodes]) {
        expect(sky.scale).toEqual(new Vector3(450_000, 450_000, 450_000));
        expect(sky.material.depthTest).toBe(true);
        expect(sky.material.depthWrite).toBe(false);
        expect(sky.renderOrder).toBe(-1_000);
      }
    } finally {
      for (const sky of [legacy, nodes]) {
        sky.geometry.dispose();
        sky.material.dispose();
      }
    }
  });
});

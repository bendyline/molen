import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  createTerrainWaterMaterial,
  createTerrainWaterMaterialAsync,
  setTerrainWaterTime,
  type TerrainWaterMaterial,
  type TerrainWaterMaterialOptions,
} from '../src/semantic-client';
import {
  WATER_RIPPLE_AREA,
  WATER_RIPPLE_LAYERS,
  WATER_RIPPLE_SLOPE_VARIANCE,
  waterRippleTexture,
} from '../src/water-ripples';

/** The explorer's floating origin over Seattle, in its metric frame. */
const SEATTLE: [number, number] = [-9_178_687.42054881, -4_074_173.341827275];

function shaderUniforms(material: TerrainWaterMaterial): Map<string, THREE.IUniform<unknown>> {
  const uniforms = new Map<string, THREE.IUniform<unknown>>();
  if ('isMeshPhysicalNodeMaterial' in material) {
    for (const root of [material.colorNode, material.normalNode, material.roughnessNode])
      root?.traverse((node) => {
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
    expect(material.customProgramCacheKey()).toBe('terrain-water@4:[]');
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
    expect(material.normalNode).not.toBeNull();
    expect(material.clearcoatNormalNode).toBe(material.normalNode);
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
    const offset = (from: Map<string, THREE.IUniform<unknown>>, name: string): THREE.Vector2 => {
      const value = from.get(name)?.value;
      if (!(value instanceof THREE.Vector2)) throw new Error(`${name} is not a vec2 uniform`);
      return value;
    };
    const layer = offset(uniforms, 'terrainWaterLayerOffset1');
    expect(material.transparent).toBe(false);
    expect(material.depthWrite).toBe(true);
    expect(uniforms.get('terrainWaterWaveScale')?.value).toBe(0.12);
    expect(uniforms.get('terrainWaterWaveStrength')?.value).toBe(0.07);
    // Time and origin never reach the shader as such: only their wrapped contributions do.
    expect(uniforms.has('terrainWaterTime')).toBe(false);
    expect(uniforms.has('terrainWaterWorldOrigin')).toBe(false);
    expect(layer).toEqual(new THREE.Vector2());
    setTerrainWaterTime(material, 42, [10_000, -20_000]);
    expect(layer.equals(new THREE.Vector2())).toBe(false);
    expect(offset(otherUniforms, 'terrainWaterLayerOffset1')).toEqual(new THREE.Vector2());
    setTerrainWaterTime(material, 43);
    // At the origin, only the drift remains: 43 s at speed 0.9.
    const drift = WATER_RIPPLE_LAYERS[1]?.drift ?? [0, 0];
    const turn = (value: number): number => value - Math.floor(value);
    expect(offset(uniforms, 'terrainWaterLayerOffset1')).toBe(layer);
    expect(layer.x).toBeCloseTo(turn(drift[0] * 43 * 0.9), 12);
    expect(layer.y).toBeCloseTo(turn(drift[1] * 43 * 0.9), 12);
    material.dispose();
    other.dispose();
  });

  it.each([
    'webgl',
    'webgpu',
  ] as const)('%s samples the same ripples and swells at a point whatever the floating origin', async (backend) => {
    const options = {
      waveScale: 0.028,
      waveSpeed: 0.5,
      swells: [{ amplitude: 0.18, wavelength: 24, direction: 0.7, speed: 4.5 }],
    };
    const material = await createTerrainWaterMaterialAsync(options, backend);
    const uniforms = shaderUniforms(material);
    const turn = (value: number, period = 1): number => value - Math.floor(value / period) * period;
    // What the shader computes from a camera-relative position plus the uploaded offsets.
    const sample = (local: readonly [number, number]): number[] => {
      const p = [local[0] * options.waveScale, local[1] * options.waveScale] as const;
      const area = uniforms.get('terrainWaterAreaOffset')?.value as THREE.Vector2;
      const values = [
        turn(p[0] * WATER_RIPPLE_AREA.scale + area.x),
        turn(p[1] * WATER_RIPPLE_AREA.scale + area.y),
      ];
      WATER_RIPPLE_LAYERS.forEach(({ scale, direction: [x, y] }, index) => {
        const offset = uniforms.get(`terrainWaterLayerOffset${index}`)?.value as THREE.Vector2;
        values.push(turn((p[0] * x + p[1] * y) * scale + offset.x));
        values.push(turn((p[1] * x - p[0] * y) * 0.65 * scale + offset.y));
      });
      const wave = options.swells[0];
      const start = uniforms.get('terrainWaterSwellPhase0')?.value as number;
      if (wave === undefined) throw new Error('missing swell');
      const k = (2 * Math.PI) / wave.wavelength;
      const along = local[0] * Math.sin(wave.direction) + local[1] * Math.cos(wave.direction);
      values.push(turn(k * along + start, 2 * Math.PI) / (2 * Math.PI));
      return values;
    };
    const point: [number, number] = [SEATTLE[0] + 12.5, SEATTLE[1] - 7.25];
    // Rebased onto Seattle, the point is 12.5 m from the origin...
    setTerrainWaterTime(material, 3_600, SEATTLE);
    const near = sample([12.5, -7.25]);
    for (const value of near) expect(value).toBeGreaterThanOrEqual(0);
    for (const value of near) expect(value).toBeLessThan(1);
    // ...and with no floating origin, it is nine thousand kilometres away.
    setTerrainWaterTime(material, 3_600, [0, 0]);
    const far = sample(point);
    near.forEach((value, index) => {
      const gap = Math.abs(value - (far[index] ?? Number.NaN));
      expect(Math.min(gap, 1 - gap), `coordinate ${index}`).toBeLessThan(1e-6);
    });
    material.dispose();
  });

  it('feeds lost ripple slope back as roughness using the texture measured slope spread', () => {
    const data = waterRippleTexture().image.data as Uint8Array;
    let sum = 0;
    for (let index = 0; index < data.length; index += 4)
      for (const channel of [0, 1]) sum += ((data[index + channel] ?? 0) / 127.5 - 1) ** 2;
    const rms = Math.sqrt(sum / (data.length / 2));
    // An approximate roughness term: catch a regenerated texture, not rounding.
    const measured = rms * rms * (1 + 0.65 * 0.65);
    expect(Math.abs(WATER_RIPPLE_SLOPE_VARIANCE / measured - 1)).toBeLessThan(0.05);
  });

  it('rejects unrelated materials instead of silently leaving water animation frozen', () => {
    const material = new THREE.MeshPhysicalMaterial();
    expect(() => setTerrainWaterTime(material, 1)).toThrow('terrain water material factory');
    material.dispose();
  });
});

import type { BakedMaterial, RGBAImage } from '@bendyline/molen-materials';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { MaterialResolver, materialFromBaked } from '../src/three/materials';

function image(...rgba: number[]): RGBAImage {
  return { width: rgba.length / 4, height: 1, data: new Uint8ClampedArray(rgba) };
}

const baseColor = image(255, 255, 255, 255, 180, 100, 60, 0);
const meta = { filter: 'linear' as const, alphaTest: 0.3 };

describe('constant PBR channel folding', () => {
  it('uses the exact G/B bytes, leaving varying unused channels and alpha irrelevant', () => {
    const material = materialFromBaked({
      meta,
      slots: {
        baseColor,
        roughness: image(1, 224, 70, 255, 200, 224, 50, 0),
        metalness: image(1, 9, 128, 255, 200, 1, 128, 0),
      },
    });
    expect(material.roughnessMap).toBeNull();
    expect(material.metalnessMap).toBeNull();
    expect(material.roughness).toBe(224 / 255);
    expect(material.roughness).not.toBe(0.88);
    expect(material.metalness).toBe(128 / 255);
    expect(material.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(material.alphaTest).toBe(0.3);
    expect(material.transparent).toBe(false);
    material.map?.dispose();
    material.dispose();
  });

  it('retains varying maps and their linear filter/colour-space semantics', () => {
    const material = materialFromBaked({
      meta: { filter: 'nearest' },
      slots: {
        baseColor,
        roughness: image(0, 50, 0, 255, 0, 51, 0, 255),
        metalness: image(0, 0, 100, 255, 0, 0, 101, 255),
      },
    });
    expect(material.roughness).toBe(1);
    expect(material.metalness).toBe(1);
    for (const texture of [material.roughnessMap, material.metalnessMap]) {
      expect(texture).toBeInstanceOf(THREE.DataTexture);
      expect(texture?.colorSpace).toBe(THREE.NoColorSpace);
      expect(texture?.magFilter).toBe(THREE.NearestFilter);
      texture?.dispose();
    }
    material.map?.dispose();
    material.dispose();
  });

  it('preserves initial scalar factors when the baked material has no base color', () => {
    const material = materialFromBaked({
      meta,
      slots: { roughness: image(0, 128, 0, 255), metalness: image(0, 0, 255, 255) },
    });
    expect(material.roughness).toBe(0.6 * (128 / 255));
    expect(material.metalness).toBe(0);
    expect(material.roughnessMap).toBeNull();
    expect(material.metalnessMap).toBeNull();
    material.dispose();
  });

  it.each([
    { width: 0, height: 1, data: new Uint8ClampedArray() },
    { width: -1, height: 1, data: new Uint8ClampedArray(4) },
    { width: 1, height: 0.5, data: new Uint8ClampedArray(2) },
    { width: 2, height: 1, data: new Uint8ClampedArray(4) },
  ])('rejects invalid image dimensions/data before folding a scalar', (bad) => {
    expect(() => materialFromBaked({ meta, slots: { baseColor, roughness: bad } })).toThrow(
      /RGBA8/,
    );
  });

  it('shares the surviving textures and disposes them only after the last resolver user', async () => {
    const baked: BakedMaterial = {
      meta,
      slots: { baseColor, roughness: image(0, 224, 0, 255), metalness: image(0, 0, 0, 255) },
    };
    const baker = { bake: vi.fn(async () => baked) };
    const resolver = new MaterialResolver(
      {
        load: async () => new ArrayBuffer(0),
        loadText: async () =>
          JSON.stringify({
            format: 'molen/matgraph@1',
            size: [1, 1],
            nodes: [{ id: 'color', type: 'const', params: { value: [1, 1, 1, 1] } }],
            outputs: { baseColor: 'color' },
          }),
      },
      baker,
    );
    const a = (await resolver.acquire('matgraph:test.surface')) as THREE.MeshStandardMaterial;
    const b = (await resolver.acquire('matgraph:test.surface')) as THREE.MeshStandardMaterial;
    expect(a).toBe(b);
    expect(baker.bake).toHaveBeenCalledTimes(1);
    expect(a.roughnessMap).toBeNull();
    expect(a.metalnessMap).toBeNull();
    const textureDispose = vi.spyOn(a.map as THREE.Texture, 'dispose');
    resolver.release(a);
    expect(textureDispose).not.toHaveBeenCalled();
    resolver.release(b);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    resolver.dispose();
    expect(textureDispose).toHaveBeenCalledTimes(1);
  });
});

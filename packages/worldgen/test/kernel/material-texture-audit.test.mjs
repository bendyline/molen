import { describe, expect, it } from 'vitest';
import {
  auditBakedMaterialTextures,
  constantResponseByte,
} from '../../scripts/material-texture-audit.mjs';

const image = (pixels, width = pixels.length, height = 1) => ({
  width,
  height,
  data: new Uint8Array(pixels.flat()),
});
const entry = (id, slots, filter = 'linear') => ({ id, baked: { meta: { filter }, slots } });

describe('material texture reuse audit', () => {
  it('folds only the sampled G/B channel and preserves the exact quantized scalar', () => {
    const roughness = image([
      [0, 224, 40, 0],
      [255, 224, 80, 255],
    ]);
    const metalness = image([
      [0, 40, 148, 0],
      [255, 80, 148, 255],
    ]);
    const report = auditBakedMaterialTextures([entry('paint', { roughness, metalness })]);
    expect(report.summary.constantResponseChannels).toBe(2);
    expect(report.summary.afterConstantResponseFolding.textures).toBe(0);
    expect(report.materials[0].channels[0].constantResponse.scalar).toBe(224 / 255);
    expect(report.materials[0].channels[1].constantResponse.scalar).toBe(148 / 255);
    expect(constantResponseByte(roughness, 'metalness')).toBeUndefined();
    expect(constantResponseByte(metalness, 'roughness')).toBeUndefined();
    expect(constantResponseByte(roughness, 'baseColor')).toBeUndefined();
  });

  it('keeps byte-identical images separate when sampler, dimensions or color space differ', () => {
    const pixels = [
      [128, 128, 255, 255],
      [128, 128, 255, 255],
    ];
    const horizontal = image(pixels);
    const vertical = image(pixels, 1, 2);
    const report = auditBakedMaterialTextures([
      entry('first', { baseColor: horizontal, normal: horizontal }),
      entry('same-sampler', { baseColor: horizontal }),
      entry('nearest', { baseColor: horizontal }, 'nearest'),
      entry('vertical', { baseColor: vertical }),
    ]);
    expect(report.summary.baked.textures).toBe(5);
    expect(report.summary.allChannelsAfterTheoreticalExactDeduplication.textures).toBe(4);
    expect(report.duplicateChannels[0].copies).toEqual([
      'first#baseColor',
      'same-sampler#baseColor',
    ]);
  });

  it('retains alpha cutouts and computes rectangular mip estimates without implying runtime policy', () => {
    const cutout = entry('screen', {
      baseColor: image([
        [255, 255, 255, 0],
        [255, 255, 255, 255],
      ]),
      roughness: image([
        [255, 128, 255, 255],
        [255, 128, 255, 255],
      ]),
    });
    cutout.baked.meta.alphaTest = 0.3;
    const report = auditBakedMaterialTextures([cutout]);
    expect(report.materials[0].alphaTest).toBe(0.3);
    expect(report.summary.afterConstantResponseFolding).toEqual({
      textures: 1,
      baseLevelRgba8Bytes: 8,
      fullMipChainRgba8Bytes: 12,
    });
  });

  it('rejects duplicate identities and invalid RGBA8 storage', () => {
    const material = entry('same', { baseColor: image([[255, 255, 255, 255]]) });
    expect(() => auditBakedMaterialTextures([material, material])).toThrow('Duplicate');
    expect(() =>
      constantResponseByte({ width: 2, height: 2, data: new Uint8Array(4) }, 'roughness'),
    ).toThrow('RGBA8');
  });
});

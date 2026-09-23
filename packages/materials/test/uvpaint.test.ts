import { validate } from '@bendyline/molen-schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { registerMaterialSchemas } from '../src/schema';
import { createImage } from '../src/types';
import { applyUvPaint, dilate, maskToIslands, rectIslandMap } from '../src/uvpaint';

beforeAll(() => registerMaterialSchemas());

function fill(w: number, h: number, rgba: [number, number, number, number]) {
  const img = createImage(w, h);
  for (let i = 0; i < w * h; i++) {
    img.data[i * 4] = rgba[0];
    img.data[i * 4 + 1] = rgba[1];
    img.data[i * 4 + 2] = rgba[2];
    img.data[i * 4 + 3] = rgba[3];
  }
  return img;
}

describe('uvpaint schema', () => {
  it('validates the example and applies defaults', () => {
    const r = validate('uvpaint' as never, {
      format: 'molen/uvpaint@1',
      model: 'm.glb',
      islands: [{ id: 1, color: '#ff0000', uvBBox: [0, 0, 1, 1] }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v = r.value as { atlasSize: number[]; importRules: { dilationPx: number } };
      expect(v.atlasSize).toEqual([1024, 1024]);
      expect(v.importRules.dilationPx).toBe(8);
    }
  });
});

describe('maskToIslands', () => {
  it('clips painted pixels outside the island to transparent', () => {
    const painted = fill(4, 4, [255, 0, 0, 255]); // all red
    const map = rectIslandMap(4, 4, 1, 1, 3, 3); // 2x2 island in the middle
    const masked = maskToIslands(painted, map);
    // inside (1,1) stays red
    const inside = (1 * 4 + 1) * 4;
    expect([masked.data[inside], masked.data[inside + 3]]).toEqual([255, 255]);
    // corner (0,0) becomes transparent
    expect(masked.data[3]).toBe(0);
  });

  it('throws on a size mismatch', () => {
    expect(() => maskToIslands(fill(2, 2, [0, 0, 0, 255]), fill(3, 3, [0, 0, 0, 255]))).toThrow(
      /must match/,
    );
  });
});

describe('dilate', () => {
  it('pushes an opaque color into transparent neighbours', () => {
    const img = createImage(3, 3);
    // single opaque green pixel in the center
    const c = (1 * 3 + 1) * 4;
    img.data[c] = 0;
    img.data[c + 1] = 255;
    img.data[c + 2] = 0;
    img.data[c + 3] = 255;
    const out = dilate(img, 1);
    // a 4-neighbour (0,1) is now green + opaque
    const n = (1 * 3 + 0) * 4;
    expect([out.data[n + 1], out.data[n + 3]]).toEqual([255, 255]);
    // a diagonal (0,0) is still transparent after one ring
    expect(out.data[3]).toBe(0);
  });
});

describe('applyUvPaint', () => {
  it('masks then dilates so the gutter around an island gets filled', () => {
    const painted = fill(6, 6, [10, 200, 30, 255]);
    const map = rectIslandMap(6, 6, 2, 2, 4, 4); // 2x2 island
    const out = applyUvPaint(painted, map, { dilationPx: 1 });
    // a gutter pixel just outside the island (1,2) is filled by dilation
    const g = (2 * 6 + 1) * 4;
    expect(out.data[g + 3]).toBe(255);
    expect(out.data[g + 1]).toBe(200); // the island green bled outward one ring
    // far corner (0,0) still transparent (only 1 dilation ring)
    expect(out.data[3]).toBe(0);
  });
});

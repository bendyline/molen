import { validate } from '@bendyline/molen-schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { bakePixelGrid } from '../src/pixelgrid';
import type { PixelGridDoc } from '../src/pixelgrid-types';
import { registerMaterialSchemas } from '../src/schema';

beforeAll(() => registerMaterialSchemas());

function valid(doc: unknown): PixelGridDoc {
  const r = validate('pixelgrid' as never, doc);
  if (!r.ok) throw new Error(r.formatted);
  return r.value as PixelGridDoc;
}

describe('pixelgrid schema', () => {
  it('validates the example and applies defaults', () => {
    const r = validate('pixelgrid' as never, {
      format: 'molen/pixelgrid@1',
      size: [2, 2],
      palette: { '.': 'transparent', X: '#ffffff' },
      rows: ['X.', '.X'],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value as PixelGridDoc).filter).toBe('nearest');
  });
});

describe('bakePixelGrid', () => {
  it('rasterizes chars to texels via the palette', () => {
    const baked = bakePixelGrid(
      valid({
        format: 'molen/pixelgrid@1',
        size: [2, 1],
        palette: { r: '#ff0000', g: '#00ff00' },
        rows: ['rg'],
      }),
    );
    const d = baked.slots.baseColor?.data as Uint8ClampedArray;
    expect([d[0], d[1], d[2], d[3]]).toEqual([255, 0, 0, 255]);
    expect([d[4], d[5], d[6], d[7]]).toEqual([0, 255, 0, 255]);
  });

  it('transparent entries set alpha 0 and enable alphaTest', () => {
    const baked = bakePixelGrid(
      valid({
        format: 'molen/pixelgrid@1',
        size: [2, 1],
        palette: { '.': 'transparent', X: '#ffffff' },
        rows: ['.X'],
      }),
    );
    const d = baked.slots.baseColor?.data as Uint8ClampedArray;
    expect(d[3]).toBe(0); // first texel transparent
    expect(baked.meta.alphaTest).toBe(0.5);
  });

  it('errors with row/column on a bad char', () => {
    expect(() =>
      bakePixelGrid(
        valid({
          format: 'molen/pixelgrid@1',
          size: [2, 1],
          palette: { X: '#fff000' },
          rows: ['XQ'],
        }),
      ),
    ).toThrow(/char "Q" at row 0 col 1/);
  });

  it('errors when a row is the wrong width', () => {
    expect(() =>
      bakePixelGrid(
        valid({
          format: 'molen/pixelgrid@1',
          size: [3, 1],
          palette: { X: '#ffffff' },
          rows: ['XX'],
        }),
      ),
    ).toThrow(/row 0 has 2 chars, expected 3/);
  });

  it('errors when the row count is wrong', () => {
    expect(() =>
      bakePixelGrid(
        valid({
          format: 'molen/pixelgrid@1',
          size: [1, 3],
          palette: { X: '#ffffff' },
          rows: ['X', 'X'],
        }),
      ),
    ).toThrow(/2 rows, expected 3/);
  });

  // M3 regression: the slots block used to be ignored — every bake returned exactly
  // { baseColor }, so an emissive grid lost its glow and a baseColor:false grid still got one.
  it('emits the grid into every enabled slot', () => {
    const baked = bakePixelGrid(
      valid({
        format: 'molen/pixelgrid@1',
        size: [2, 1],
        palette: { r: '#ff0000', g: '#00ff00' },
        rows: ['rg'],
        slots: { baseColor: true, emissive: true },
      }),
    );
    expect(Object.keys(baked.slots).sort()).toEqual(['baseColor', 'emissive']);
    expect(Array.from(baked.slots.emissive?.data ?? [])).toEqual(
      Array.from(baked.slots.baseColor?.data ?? []),
    );
  });

  it('omits baseColor when only emissive is enabled', () => {
    const baked = bakePixelGrid(
      valid({
        format: 'molen/pixelgrid@1',
        size: [2, 1],
        palette: { r: '#ff0000', g: '#00ff00' },
        rows: ['rg'],
        slots: { baseColor: false, emissive: true },
      }),
    );
    expect(Object.keys(baked.slots)).toEqual(['emissive']);
    expect(baked.slots.baseColor).toBeUndefined();
  });

  it('defaults to baseColor only', () => {
    const baked = bakePixelGrid(
      valid({
        format: 'molen/pixelgrid@1',
        size: [2, 1],
        palette: { r: '#ff0000', g: '#00ff00' },
        rows: ['rg'],
      }),
    );
    expect(Object.keys(baked.slots)).toEqual(['baseColor']);
  });

  it('refuses a document with every slot disabled', () => {
    expect(() =>
      bakePixelGrid({
        format: 'molen/pixelgrid@1',
        size: [2, 1],
        palette: { r: '#ff0000', g: '#00ff00' },
        rows: ['rg'],
        slots: { baseColor: false, emissive: false },
        filter: 'nearest',
      }),
    ).toThrow(/every slot disabled/);
  });

  it('refuses a document that never went through validation', () => {
    expect(() =>
      bakePixelGrid({
        format: 'molen/pixelgrid@1',
        size: [2, 1],
        palette: { r: '#ff0000', g: '#00ff00' },
        rows: ['rg'],
      } as unknown as PixelGridDoc),
    ).toThrow(/no slots block/);
  });
});

describe('pixelgrid slot validation', () => {
  it('rejects a document with no slot enabled', () => {
    const r = validate('pixelgrid' as never, {
      format: 'molen/pixelgrid@1',
      size: [2, 1],
      palette: { r: '#ff0000', g: '#00ff00' },
      rows: ['rg'],
      slots: { baseColor: false, emissive: false },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.some((i) => i.code === 'no_slot_enabled' && i.path === '/slots')).toBe(true);
  });

  it('accepts a document with only emissive enabled', () => {
    const r = validate('pixelgrid' as never, {
      format: 'molen/pixelgrid@1',
      size: [2, 1],
      palette: { r: '#ff0000', g: '#00ff00' },
      rows: ['rg'],
      slots: { baseColor: false, emissive: true },
    });
    expect(r.ok).toBe(true);
  });
});

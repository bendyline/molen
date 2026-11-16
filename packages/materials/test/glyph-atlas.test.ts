import { describe, expect, it } from 'vitest';
import {
  assembleGlyphAtlasPixels,
  createGlyphAtlasSet,
  type GlyphAtlasDoc,
  parseGlyphAtlas,
} from '../src/text';

/** A glyph 0.5 em wide whose plane box is the 8 x 8 texel cell at (x, y) on a 16 em-texel atlas. */
const cell = (x: number, y: number, page = 0): number[] => [
  0.6,
  0,
  0,
  0.5,
  0.5,
  page,
  x,
  y,
  x + 8,
  y + 8,
];

const latin: GlyphAtlasDoc = {
  format: 'molen/glyph-atlas@1',
  id: 'test.latin',
  emSize: 16,
  distanceRange: 2,
  padding: 1,
  pages: [{ path: 'latin.r8', width: 32, height: 16 }],
  defaultFace: 'sans',
  faces: {
    sans: {
      family: 'Test Sans',
      weight: 400,
      style: 'normal',
      ascent: 0.8,
      descent: -0.2,
      lineHeight: 1.2,
      capHeight: 0.5,
      glyphs: { ' ': [0.3], A: cell(0, 0), B: cell(8, 0), C: cell(16, 0) },
      kerning: { AB: -0.1 },
    },
  },
  roles: { sans: 'sans' },
};
const kana: GlyphAtlasDoc = {
  ...latin,
  id: 'test.kana',
  pages: [{ path: 'kana.r8', width: 16, height: 8 }],
  defaultFace: 'jp',
  faces: {
    jp: {
      ...(latin.faces.sans as GlyphAtlasDoc['faces'][string]),
      family: 'Test JP',
      glyphs: { ' ': [0.3], A: cell(0, 0), あ: cell(0, 0), い: cell(8, 0) },
      kerning: {},
    },
  },
  roles: {},
};

describe('glyph atlas sets', () => {
  it('validates documents and refuses glyphs off their page', () => {
    expect(parseGlyphAtlas(latin).id).toBe('test.latin');
    const broken = structuredClone(latin);
    (broken.faces.sans as GlyphAtlasDoc['faces'][string]).glyphs.A = cell(28, 0);
    expect(() => parseGlyphAtlas(broken)).toThrow(/off its page/);
    expect(() => createGlyphAtlasSet([latin, { ...kana, distanceRange: 3 }])).toThrow(
      /distance range/,
    );
  });

  it('stacks pages and picks the first face that holds every character', () => {
    const set = createGlyphAtlasSet([latin, kana]);
    expect([set.width, set.height]).toEqual([32, 24]);
    expect(set.pages.map((p) => [p.doc, p.top])).toEqual([
      [0, 0],
      [1, 16],
    ]);
    expect(set.faceFor('AB')).toBe('sans');
    // A mixed name is set in the one face holding all of it, Latin included.
    expect(set.faceFor('Aあ')).toBe('jp');
    expect(set.faceFor('Z')).toBeUndefined();
    expect(set.layout('Zed', { maxWidth: 4, maxHeight: 1 })).toBeUndefined();
  });

  it('lays out quads with kerning and texture coordinates in the combined texture', () => {
    const set = createGlyphAtlasSet([latin, kana]);
    const ab = set.layout('AB', { maxWidth: 100, maxHeight: 1 });
    if (!ab) throw new Error('expected a layout');
    expect(ab.face).toBe('sans');
    expect(ab.quads.length).toBe(16);
    // Ink is the plane box less one padding texel (1/16 em) a side: A spans 0.0625..0.4375, B
    // starts at 0.6 - 0.1 kerning; height 0.375 em fits the box exactly.
    expect(ab.height).toBeCloseTo(1, 5);
    expect(ab.scale).toBeCloseTo(1 / 0.375, 5);
    const [ax0, , ax1, , au0, av0, au1, av1] = ab.quads;
    expect((ax1 as number) - (ax0 as number)).toBeCloseTo(0.5 * ab.scale, 5);
    expect([au0, au1]).toEqual([0, 8 / 32]);
    // The quad's bottom edge samples the glyph's last row (texel 8), its top the first (texel 0).
    expect(av0).toBeCloseTo(8 / 24, 6);
    expect(av1).toBe(0);
    // Centered on the block.
    expect(((ab.quads[0] as number) + (ab.quads[10] as number)) / 2).toBeCloseTo(0, 5);
    // Kana sit on the second page, below the first.
    const kanaLayout = set.layout('い', { maxWidth: 10, maxHeight: 1 });
    const uv = Array.from(kanaLayout?.quads.slice(4) ?? []);
    for (const [i, value] of [8 / 32, 24 / 24, 16 / 32, 16 / 24].entries())
      expect(uv[i]).toBeCloseTo(value, 6);
  });

  it('breaks into two lines only where that sets the letters larger', () => {
    const set = createGlyphAtlasSet([latin, kana]);
    const wide = { maxWidth: 2, maxHeight: 1, maxLines: 2 };
    expect(set.layout('AB CA BC', wide)?.lines).toEqual(['AB CA', 'BC']);
    expect(set.layout('AB', wide)?.lines).toEqual(['AB']);
    // Unspaced scripts break between letters.
    expect(set.layout('ああいい', { ...wide, maxWidth: 1 })?.lines).toEqual(['ああ', 'いい']);
    expect(set.layout('AB CA BC', { ...wide, maxLines: 1 })?.lines).toEqual(['AB CA BC']);
  });

  it('assembles page bytes into one texture', async () => {
    const set = createGlyphAtlasSet([latin, kana]);
    const pixels = await assembleGlyphAtlasPixels(set, async (doc, path) => {
      expect(path).toBe(doc === 0 ? 'latin.r8' : 'kana.r8');
      return new Uint8Array(doc === 0 ? 32 * 16 : 16 * 8).fill(doc === 0 ? 10 : 20);
    });
    expect(pixels.data[0]).toBe(10);
    expect(pixels.data[16 * 32]).toBe(20);
    // The narrower page leaves the rest of its rows empty.
    expect(pixels.data[16 * 32 + 20]).toBe(0);
    await expect(assembleGlyphAtlasPixels(set, async () => new Uint8Array(3))).rejects.toThrow(
      /holds 3 bytes/,
    );
  });
});

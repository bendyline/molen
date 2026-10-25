import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { buildTextMesh, loadFontLibrary, vectorFontSchema } from '../src/text';

const read = async (path: string) =>
  JSON.parse(
    await readFile(new URL(`../../../content/earth/fonts/${path}`, import.meta.url), 'utf8'),
  );
const fonts = await loadFontLibrary(await read('catalog.json'), read);

describe('shared vector lettering', () => {
  it('keeps proportional spacing, real kerning, case and accents', () => {
    expect(buildTextMesh('WWW', fonts).width).toBeGreaterThan(
      buildTextMesh('III', fonts).width * 2,
    );
    const font = fonts.fonts[fonts.defaultFont];
    if (!font) throw new Error('Missing face');
    const plain = { ...fonts, fonts: { ...fonts.fonts, [font.id]: { ...font, kerning: {} } } };
    expect(buildTextMesh('AV', fonts).width).toBeLessThan(buildTextMesh('AV', plain).width);
    const text = buildTextMesh('Café – São José 17B', fonts);
    expect(text.missingGlyphs).toEqual([]);
    expect(text.text).toBe('Café – São José 17B');
    expect(buildTextMesh('Cafe\u0301', fonts).positions).toEqual(
      buildTextMesh('Café', fonts).positions,
    );
    expect(buildTextMesh('A', fonts).positions).not.toEqual(buildTextMesh('a', fonts).positions);
  });
  it('fits ink including accents and descenders without distorting the face', () => {
    const text = 'École\nSpringfield';
    const natural = buildTextMesh(text, fonts);
    const fitted = buildTextMesh(text, fonts, {
      size: 3,
      maxWidth: 2,
      maxHeight: 0.8,
      align: 'center',
      verticalAlign: 'center',
    });
    expect(fitted.width).toBeLessThanOrEqual(2);
    expect(fitted.height).toBeLessThanOrEqual(0.8);
    expect(fitted.width / fitted.height).toBeCloseTo(natural.width / natural.height);
    for (let i = 0; i < fitted.positions.length; i += 3) {
      expect(Math.abs(fitted.positions[i] ?? 0)).toBeLessThanOrEqual(1.000001);
      expect(Math.abs(fitted.positions[i + 1] ?? 0)).toBeLessThanOrEqual(0.400001);
    }
  });
  it('preserves holes and front-facing winding in real glyphs', () => {
    for (const font of Object.values(fonts.fonts)) {
      const o = font.glyphs.O;
      if (!o) throw new Error('Missing O');
      const xs = o.positions.filter((_, i) => i % 2 === 0),
        ys = o.positions.filter((_, i) => i % 2 === 1);
      const center = [
        (Math.min(...xs) + Math.max(...xs)) / 2,
        (Math.min(...ys) + Math.max(...ys)) / 2,
      ];
      for (let i = 0; i < o.indices.length; i += 3) {
        const p = o.indices
          .slice(i, i + 3)
          .map((index) => [o.positions[index * 2] ?? 0, o.positions[index * 2 + 1] ?? 0]);
        const [a, b, c] = p as [number[], number[], number[]];
        const cross = (a: number[], b: number[], c: number[]) =>
          ((b[0] ?? 0) - (a[0] ?? 0)) * ((c[1] ?? 0) - (a[1] ?? 0)) -
          ((b[1] ?? 0) - (a[1] ?? 0)) * ((c[0] ?? 0) - (a[0] ?? 0));
        expect(cross(a, b, c)).toBeGreaterThanOrEqual(-1e-8);
        expect(
          [cross(a, b, center), cross(b, c, center), cross(c, a, center)].every((n) => n >= 0),
        ).toBe(false);
      }
    }
  });
  it('supports different faces, replacement glyphs and explicit fallback', () => {
    expect(buildTextMesh('Cafe', fonts, { font: 'serif' }).positions).not.toEqual(
      buildTextMesh('Cafe', fonts, { font: 'sans' }).positions,
    );
    expect(buildTextMesh('111', fonts, { font: 'mono' }).width).toBeCloseTo(
      buildTextMesh('WWW', fonts, { font: 'mono' }).width,
    );
    const missing = buildTextMesh('A😀B', fonts);
    expect(missing.missingGlyphs).toEqual(['😀']);
    expect(missing.positions).toEqual(buildTextMesh('A?B', fonts).positions);
    const primary = fonts.fonts[fonts.defaultFont];
    if (!primary) throw new Error('Missing face');
    const custom = {
      ...fonts,
      fonts: {
        ...fonts.fonts,
        extra: {
          ...primary,
          id: 'extra',
          glyphs: { '?': primary.glyphs['?'], '😀': primary.glyphs.O },
        },
      },
    };
    expect(
      buildTextMesh('😀', custom as typeof fonts, { fallbackFonts: ['extra'] }).missingGlyphs,
    ).toEqual([]);
  });
  it('bounds work, reports truncation, handles whitespace and rejects invalid layout', () => {
    const long = buildTextMesh('Springfield Downtown', fonts, {
      size: 0.4,
      maxWidth: 2,
      overflow: 'ellipsis',
    });
    expect(long.text.endsWith('…')).toBe(true);
    expect(long.truncated).toBe(true);
    expect(long.width).toBeLessThanOrEqual(2);
    expect(Array.from(buildTextMesh('abcdef', fonts, { maxCharacters: 3 }).text)).toHaveLength(3);
    expect(buildTextMesh(' \n ', fonts).positions).toHaveLength(0);
    expect(() => buildTextMesh('a', fonts, { maxWidth: Number.NaN })).toThrow();
    expect(() => buildTextMesh('a', fonts, { font: 'missing' })).toThrow('Unknown font');
  });
  it('validates source buffers and catalog references before rendering', async () => {
    const primary = fonts.fonts[fonts.defaultFont];
    expect(
      vectorFontSchema.safeParse({
        ...primary,
        glyphs: { '?': { advance: 1, positions: [0, 0], indices: [0, 1, 2] } },
      }).success,
    ).toBe(false);
    await expect(
      loadFontLibrary({ format: 'molen/font-catalog@1', defaultFont: 'bad', fonts: {} }, read),
    ).rejects.toThrow('missing font');
    await expect(
      loadFontLibrary(
        { format: 'molen/font-catalog@1', defaultFont: 'bad', fonts: { bad: '../outside.json' } },
        read,
      ),
    ).rejects.toThrow();
  });
});

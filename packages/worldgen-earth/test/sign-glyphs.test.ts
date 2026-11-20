import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createGlyphAtlasSet, type GlyphAtlasDoc } from '@bendyline/molen-worldgen/kernel';
import { describe, expect, it } from 'vitest';

// The glyph atlases signs set names with are generated content (scripts/build-fonts.mjs and
// scripts/build-glyph-charset.mjs); these checks catch a stale or hand-edited copy without
// rasterizing anything. `node scripts/build-fonts.mjs --check` proves the bytes themselves.
const repo = new URL('../../../', import.meta.url);
const read = (path: string): Promise<Buffer> => readFile(new URL(path, repo));
const json = async <T>(path: string): Promise<T> => JSON.parse((await read(path)).toString('utf8'));
const sha256 = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

const latinPath = 'content/earth/fonts/signs.glyphs.json';
const kyotoPath = 'content/glyphs-kyoto/glyphs/kyoto.glyphs.json';

describe('sign glyph atlases', () => {
  it('ships the Latin sign faces with pages that match their metrics', async () => {
    const doc = await json<GlyphAtlasDoc>(latinPath);
    const build = await json<{
      glyphAtlases: {
        id: string;
        outputSha256: string;
        pages: { path: string; sha256: string }[];
      }[];
    }>('content/earth/fonts/build.json');
    const record = build.glyphAtlases.find((atlas) => atlas.id === doc.id);
    expect(record?.outputSha256).toBe(sha256(await read(latinPath)));
    for (const [index, page] of doc.pages.entries()) {
      const bytes = await read(`content/earth/fonts/${page.path}`);
      expect(bytes.byteLength).toBe(page.width * page.height);
      expect(record?.pages[index]?.sha256).toBe(sha256(bytes));
    }
    expect(Object.keys(doc.roles ?? {}).sort()).toEqual(['bold', 'sans', 'serif']);
  });

  it("holds every letter of Kyoto's sign names that its font has, for the archive it was read from", async () => {
    const charset = await json<{ archive: { path: string; sha256: string }; characters: string }>(
      'content/glyphs-kyoto/source/charset.json',
    );
    // Rebuild the character set and the atlas when the map extract changes.
    expect(sha256(await read(charset.archive.path))).toBe(charset.archive.sha256);
    const doc = await json<GlyphAtlasDoc>(kyotoPath);
    const build = await json<{ missing: string; outputSha256: string }>(
      'content/glyphs-kyoto/glyphs/build.json',
    );
    expect(build.outputSha256).toBe(sha256(await read(kyotoPath)));
    const face = doc.faces[doc.defaultFace];
    const absent = Array.from(charset.characters).filter(
      (char) => face === undefined || !Object.hasOwn(face.glyphs, char),
    );
    expect(absent.join('')).toBe(build.missing);
    // What the font lacks is other scripts (Thai, Hangul, Arabic, simplified Chinese), not
    // Japanese. Central Osaka's names brought most of the 77 absent of 2,375; a font without
    // Japanese would lack well over a thousand.
    expect(absent.filter((char) => /[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char))).toEqual(
      [],
    );
    expect(absent.length).toBeLessThan(100);
  });

  it('sets Japanese names in the region face and Latin names in the Latin faces', async () => {
    const set = createGlyphAtlasSet([await json(latinPath), await json(kyotoPath)]);
    expect(set.faceFor('マクドナルド')).toBe('sign.gothic.jp');
    expect(set.faceFor('cafe RanZan 嵐山', 'serif')).toBe('sign.gothic.jp');
    expect(set.faceFor('Starbucks', 'serif')).toBe('sign.serif');
    // Neither font has Thai. (Not "Phở": an Osaka name brought ở into the Japanese atlas.)
    expect(set.faceFor('ผัดไทย')).toBeUndefined();
    const layout = set.layout('ドトールコーヒーショップ', {
      maxWidth: 4,
      maxHeight: 0.8,
      maxLines: 2,
    });
    expect(layout?.lines).toHaveLength(2);
  });
});

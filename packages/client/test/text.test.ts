import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { describe, expect, it } from 'vitest';
import { compileVectorFont, createTextGeometry } from '../src/text';

describe('font outline compiler and geometry adapter', () => {
  it('rebuilds every shipped face byte for byte from the pinned source inputs', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [fileURLToPath(new URL('../../../scripts/build-fonts.mjs', import.meta.url)), '--check'],
        { stdio: 'pipe' },
      ),
    ).not.toThrow();
  });
  it('compiles actual TTF curves deterministically with correct metrics and counters', () => {
    const bytes = readFileSync(
      new URL('../../../content/earth/source/fonts/Overpass-SemiBold.ttf', import.meta.url),
    );
    const data = new TTFLoader().parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    data.resolution = 100000 / 72;
    const options = { id: 'test', characters: ' ?ABOgjé', weight: 600 };
    const font = compileVectorFont(data, options);
    expect(compileVectorFont(data, options)).toEqual(font);
    expect(font.ascent).toBeGreaterThan(0);
    expect(font.descent).toBeLessThan(0);
    expect(font.lineHeight).toBeCloseTo(font.ascent - font.descent);
    const library = { defaultFont: 'test', fonts: { test: font } };
    const geometry = createTextGeometry('ABO gjé', library, {
      maxWidth: 3,
      maxHeight: 0.5,
      align: 'center',
      verticalAlign: 'center',
    });
    expect(geometry.userData.textLayout.missingGlyphs).toEqual([]);
    expect(geometry.boundingBox?.min.y).toBeGreaterThanOrEqual(-0.250001);
    expect(geometry.boundingBox?.max.y).toBeLessThanOrEqual(0.250001);
    const normal = geometry.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) expect(normal.getZ(i)).toBeCloseTo(1);
    geometry.dispose();
  });
});

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_IMPORTS = ['@bendyline/molen-terrain', '@bendyline/molen-worldgen-earth'];
const FORBIDDEN_WORDS = /\b(pmtiles|protomaps|mercator|wgs84|landuse|tiles?|osm|earth)\b/i;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|mts)$/.test(name)) out.push(path);
  }
  return out;
}

describe('world-agnostic boundary', () => {
  const files = walk(new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

  it('never imports the terrain package or the Earth binding', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const forbidden of FORBIDDEN_IMPORTS) {
        expect(text.includes(forbidden), `${file} imports ${forbidden}`).toBe(false);
      }
    }
  });

  it('keeps map vocabulary out of the core', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const match = FORBIDDEN_WORDS.exec(text);
      expect(match, `${file} mentions "${match?.[0]}"`).toBeNull();
    }
  });

  it('kernel sources use no transcendental Math or Math.random', () => {
    const banned =
      /\bMath\s*\.\s*(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|pow|log|log2|log10|log1p|random)\b/;
    for (const file of files.filter((path) => path.includes('kernel'))) {
      const match = banned.exec(readFileSync(file, 'utf8'));
      expect(match, `${file} uses ${match?.[0]}`).toBeNull();
    }
  });
});

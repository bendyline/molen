import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const FORBIDDEN_IMPORTS = ['three', '@bendyline/molen-client'];
const FORBIDDEN_GLOBALS = /\b(window|document|navigator|globalThis)\s*\./;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|mts)$/.test(name)) out.push(path);
  }
  return out;
}

describe('kernel-half boundary', () => {
  const srcDir = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const files = walk(join(srcDir, 'kernel')).concat(join(srcDir, 'kernel.ts'));

  it('never imports three or the client package', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const forbidden of FORBIDDEN_IMPORTS) {
        const pattern = new RegExp(`from '${forbidden.replace('/', '\\/')}(\\/|')`);
        expect(pattern.test(text), `${file} imports ${forbidden}`).toBe(false);
      }
    }
  });

  it('never touches DOM globals', () => {
    for (const file of files) {
      const match = FORBIDDEN_GLOBALS.exec(readFileSync(file, 'utf8'));
      expect(match, `${file} mentions "${match?.[0]}"`).toBeNull();
    }
  });

  it('uses no transcendental Math or Math.random', () => {
    const banned =
      /\bMath\s*\.\s*(sin|cos|tan|asin|acos|atan|atan2|sinh|cosh|tanh|exp|expm1|pow|log|log2|log10|log1p|random)\b/;
    for (const file of files) {
      const match = banned.exec(readFileSync(file, 'utf8'));
      expect(match, `${file} uses ${match?.[0]}`).toBeNull();
    }
  });
});

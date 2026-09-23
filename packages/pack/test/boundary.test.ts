import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The main entry runs in browsers and Workers; only src/node.ts may use Node built-ins.
describe('browser-safe entry', () => {
  it('imports no node: modules outside src/node.ts', async () => {
    const src = join(dirname(fileURLToPath(import.meta.url)), '../src');
    const offenders: string[] = [];
    for (const name of await readdir(src)) {
      if (name === 'node.ts') continue;
      const text = await readFile(join(src, name), 'utf8');
      if (/from\s+['"]node:|import\(\s*['"]node:/.test(text)) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });
});

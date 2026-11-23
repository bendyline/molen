import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// The /look subpath runs on a host's main page before any 3D loads: it may import only pure
// modules. The kernel root loads SES (which locks down the page); zod (through molen-schema)
// and three are heavy. Type-only imports are erased, so they may name anything.
const ALLOWED_PACKAGES = new Set(['@bendyline/molen-kernel/determinism']);
const FORBIDDEN_GLOBALS = /\b(window|document|navigator)\s*\./;

function graph(entry: string): Map<string, string[]> {
  const files = new Map<string, string[]>();
  const visit = (file: string): void => {
    if (files.has(file)) return;
    const text = readFileSync(file, 'utf8');
    const specifiers: string[] = [];
    files.set(file, specifiers);
    for (const match of text.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+'([^']+)'/gms)) {
      const statement = match[0];
      const specifier = match[1] as string;
      if (/^\s*(?:import|export)\s+type\s/.test(statement)) continue;
      specifiers.push(specifier);
      if (specifier.startsWith('.')) visit(`${resolve(dirname(file), specifier)}.ts`);
    }
  };
  visit(entry);
  return files;
}

describe('the /look boundary', () => {
  const srcDir = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const files = graph(join(srcDir, 'look.ts'));

  it('reaches only pure modules', () => {
    expect(files.size).toBeGreaterThan(5);
    for (const [file, specifiers] of files) {
      for (const specifier of specifiers) {
        if (specifier.startsWith('.')) continue;
        expect(ALLOWED_PACKAGES.has(specifier), `${file} imports ${specifier}`).toBe(true);
      }
      expect(FORBIDDEN_GLOBALS.test(readFileSync(file, 'utf8')), `${file} touches the DOM`).toBe(
        false,
      );
    }
  });

  it('never reaches the descriptor schema or the body generator', () => {
    for (const file of files.keys()) expect(file).not.toMatch(/descriptor|schema|body|presets/);
  });
});

describe('the /designer boundary', () => {
  const srcDir = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const files = graph(join(srcDir, 'designer.ts'));
  // three draws the preview and zod validates descriptors; the kernel root (SES) and the
  // client package stay out, as for the /client half.
  const allowed = new Set([
    'three',
    'zod',
    '@bendyline/molen-schema',
    '@bendyline/molen-kernel/determinism',
  ]);

  it('reaches no kernel runtime, so a host page never loads SES', () => {
    for (const [file, specifiers] of files)
      for (const specifier of specifiers) {
        if (specifier.startsWith('.')) continue;
        expect(allowed.has(specifier), `${file} imports ${specifier}`).toBe(true);
      }
  });
});

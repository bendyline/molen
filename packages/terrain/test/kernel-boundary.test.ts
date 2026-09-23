import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The README promises the kernel half "needs neither [three nor the client] and never touches
// three.js". Type-only imports count: they end up in the published declarations.
const FORBIDDEN = /^(three|@bendyline\/molen-client)(\/|$)/;
const SPECIFIERS = /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\s+['"]([^'"]+)['"]/g;

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function specifiers(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(SPECIFIERS)].map((m) => m[1] ?? m[2] ?? '');
}

/** Every module reachable from `entry` through relative imports, with the chain that reached it. */
function reachable(entry: string, resolveRelative: (from: string, spec: string) => string) {
  const via = new Map<string, string | undefined>([[entry, undefined]]);
  const queue = [entry];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    for (const spec of specifiers(file)) {
      if (!spec.startsWith('.')) continue;
      const next = resolveRelative(file, spec);
      if (!via.has(next)) {
        via.set(next, file);
        queue.push(next);
      }
    }
  }
  const chain = (file: string): string => {
    const parts = [relative(root, file)];
    for (let at = via.get(file); at !== undefined; at = via.get(at))
      parts.unshift(relative(root, at));
    return parts.join(' -> ');
  };
  return { files: [...via.keys()], chain };
}

function leaks(entry: string, resolveRelative: (from: string, spec: string) => string): string[] {
  const { files, chain } = reachable(entry, resolveRelative);
  return files.flatMap((file) =>
    specifiers(file)
      .filter((spec) => FORBIDDEN.test(spec))
      .map((spec) => `${chain(file)} imports ${spec}`),
  );
}

describe('kernel-half boundary', () => {
  it('source reachable from src/kernel.ts never imports three or the client', () => {
    const toSource = (from: string, spec: string): string =>
      join(dirname(from), `${spec.replace(/\.js$/, '')}.ts`);
    expect(leaks(join(root, 'src/kernel.ts'), toSource)).toEqual([]);
  });

  it('published kernel declarations never import three or the client', () => {
    const entry = join(root, 'dist/kernel.d.mts');
    expect(existsSync(entry), 'build before testing: dist/kernel.d.mts is missing').toBe(true);
    const toDeclaration = (from: string, spec: string): string =>
      join(dirname(from), spec.replace(/\.mjs$/, '.d.mts'));
    expect(leaks(entry, toDeclaration)).toEqual([]);
  });
});

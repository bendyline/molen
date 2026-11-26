import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// `@bendyline/molen-figures/schema` promises the figures vocabulary to a host that only validates
// scenes: walk the published chunk graph and allow nothing beyond the schema package, zod and the
// kernel's determinism helpers (no kernel runtime, so no SES; no three.js).
const dist = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist');
const SPECIFIERS = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;
const ALLOWED = new Set(['@bendyline/molen-schema', '@bendyline/molen-kernel/determinism', 'zod']);

function reachableSpecifiers(entry: string): Set<string> {
  const seen = new Set<string>([entry]);
  const external = new Set<string>();
  const queue = [entry];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    for (const match of readFileSync(file, 'utf8').matchAll(SPECIFIERS)) {
      const spec = match[1] ?? match[2] ?? '';
      if (!spec.startsWith('.')) {
        external.add(spec);
        continue;
      }
      const next = join(dirname(file), spec);
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return external;
}

describe('the schema entry', () => {
  it('reaches only the schema package, zod and the determinism helpers', () => {
    const file = join(dist, 'schema.mjs');
    expect(existsSync(file), 'build before testing: dist/schema.mjs is missing').toBe(true);
    expect([...reachableSpecifiers(file)].filter((spec) => !ALLOWED.has(spec))).toEqual([]);
  });

  it('registers the figure renderable kind on import', async () => {
    await import('../dist/schema.mjs');
    const { validateByKind } = await import('@bendyline/molen-schema');
    const scene = {
      format: 'molen/scene@3',
      name: 'one-figure',
      seed: 'one-figure',
      tickRate: 30,
      entities: [
        {
          id: 'ana',
          components: {
            transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] },
            renderable: { kind: 'figure' },
            figure: { preset: 'human.adult' },
          },
        },
      ],
    };
    const result = validateByKind('scene', scene);
    expect(result.ok, result.ok ? '' : result.formatted).toBe(true);
  });
});

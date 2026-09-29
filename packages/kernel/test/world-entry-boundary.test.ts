import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// `@bendyline/molen-kernel/world` promises an ECS World that hosts can run on a page without SES
// hardening that page. Walk the published chunk graph: nothing reachable may import 'ses'.
const dist = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist');
const SPECIFIERS = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]/g;

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

describe('SES-free kernel entries', () => {
  for (const entry of ['world-entry.mjs', 'vehicles.mjs']) {
    it(`${entry} never reaches the SES scripting runtime`, () => {
      const file = join(dist, entry);
      expect(existsSync(file), `build before testing: dist/${entry} is missing`).toBe(true);
      expect([...reachableSpecifiers(file)].filter((spec) => spec === 'ses')).toEqual([]);
    });
  }

  it('sees SES through the root entry, so the walk above is not vacuous', () => {
    expect(reachableSpecifiers(join(dist, 'index.mjs')).has('ses')).toBe(true);
  });

  it('runs a World without installing lockdown on the host realm', async () => {
    const { Transform, World } = await import('../dist/world-entry.mjs');
    const world = new World({ tickRate: 60, seed: 'boundary' });
    world.spawnRaw({ transform: { pos: [0, 0, 0], rot: [0, 0, 0, 1] } }, 'thing');
    world.step();
    expect(world.get('thing', Transform)?.pos).toEqual([0, 0, 0]);
    expect((globalThis as { lockdown?: unknown }).lockdown).toBeUndefined();
    expect((globalThis as { harden?: unknown }).harden).toBeUndefined();
  });
});

import { resolve } from 'node:path';
import { expect, it } from 'vitest';
import { readPackSource } from '../src/node';

it('ships runtime Earth catalogs without the structure research snapshots and ledgers', async () => {
  const source = await readPackSource(resolve(import.meta.dirname, '../../../content/earth'));
  const paths = source.files.map((file) => file.path);
  expect(paths).toContain('structures/placements.json');
  expect(paths).toContain('structures/map-rules.json');
  expect(paths).toContain('world.atlas.json');
  expect(paths).toContain('businesses/catalog.json');
  expect(paths).toContain('businesses/README.md');
  expect(paths.some((path) => path.startsWith('structures/evidence/'))).toBe(false);
  expect(paths.some((path) => path.startsWith('structures/alignments/'))).toBe(false);
  for (const name of [
    'readiness.json',
    'georeferencing.json',
    'identity-review.json',
    'EVIDENCE.md',
  ]) {
    expect(paths).not.toContain(`structures/${name}`);
  }
});

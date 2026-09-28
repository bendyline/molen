import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { biomeJson } from '../scripts/format-json.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const value = { dimensions: [1, 2, 3], material: { name: 'brick' } };

it('preserves generator bytes for source documents excluded from formatting', () => {
  const path = resolve(root, 'content/worldgen/source/places/c2/c23/test/spec.json');
  expect(biomeJson(value, path)).toBe(`${JSON.stringify(value, null, 2)}\n`);
});

it('continues to apply repository formatting to ordinary JSON', () => {
  const formatted = biomeJson(value, resolve(root, 'format-test.json'));
  expect(JSON.parse(formatted)).toEqual(value);
  expect(formatted).toContain('"dimensions": [1, 2, 3]');
  expect(formatted.endsWith('\n')).toBe(true);
});

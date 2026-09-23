import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createLandmarkLibrary, type LandmarkDocs } from '../../src/kernel/landmark-library';

const dir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../content/worldgen/landmarks',
);

async function docsFromDisk(): Promise<LandmarkDocs> {
  const catalog = JSON.parse(await readFile(resolve(dir, 'catalog.json'), 'utf8'));
  const models: Record<string, unknown> = {};
  for (const [key, path] of Object.entries(catalog.models as Record<string, string>)) {
    models[key] = JSON.parse(await readFile(resolve(dir, path), 'utf8'));
  }
  return { catalog, models };
}

describe('createLandmarkLibrary', () => {
  it('builds the default library from its documents', async () => {
    const lib = createLandmarkLibrary(await docsFromDisk());
    expect(lib.version).toBe(3);
    expect(Object.keys(lib.signDesigns)).toHaveLength(53);
    expect(lib.signDesigns.grocery).toEqual(lib.get('sign.grocery')?.sign);
    expect(lib.get('sign.grocery')?.generator).toBe('sign');
    expect(lib.get('nope')).toBeUndefined();
  });

  it('rejects documents that do not match the catalog', async () => {
    const docs = await docsFromDisk();
    const { 'sign.grocery': _dropped, ...missing } = docs.models;
    expect(() => createLandmarkLibrary({ ...docs, models: missing })).toThrow(
      /lists "sign.grocery" but no document/,
    );
    expect(() =>
      createLandmarkLibrary({ ...docs, models: { ...docs.models, 'sign.extra': {} } }),
    ).toThrow(/"sign.extra" is not listed/);
    const renamed = { ...(docs.models['sign.grocery'] as object), id: 'sign.other' };
    expect(() =>
      createLandmarkLibrary({ ...docs, models: { ...docs.models, 'sign.grocery': renamed } }),
    ).toThrow(/does not match sign.other/);
  });
});

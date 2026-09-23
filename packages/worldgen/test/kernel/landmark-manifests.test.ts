import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateByKind } from '@bendyline/molen-schema';
import { describe, expect, it } from 'vitest';
import { ModelLibrary } from '../../src/client/instanced-models';
import { resolveLandmarkCatalogDocuments } from '../../src/kernel/landmark-docs';
import { generateLandmarkModel } from '../../src/kernel/landmark-models';
import { registerLandmarkSchemas } from '../../src/kernel/landmark-schema';
import { LANDMARK_DEFINITIONS, LANDMARK_DOCS } from '../helpers/content';

registerLandmarkSchemas();

describe('external landmark manifests', () => {
  it('preserves the prior geometry byte-for-byte at every detail level', async () => {
    const hashes = JSON.parse(
      await readFile(new URL('../fixtures/landmark-geometry-hashes.json', import.meta.url), 'utf8'),
    ) as Record<string, string>;
    for (const [key, expected] of Object.entries(hashes)) {
      const [id, tier] = key.split('@');
      const mesh = generateLandmarkModel(id ?? '', LANDMARK_DEFINITIONS, Number(tier) as 0 | 1 | 2);
      if (!mesh) throw new Error(`Missing model ${id}`);
      const hash = createHash('sha256');
      for (const a of [mesh.positions, mesh.normals, mesh.uvs, mesh.colors, mesh.indices])
        hash.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength));
      hash.update(JSON.stringify(mesh.groups));
      expect(hash.digest('hex'), key).toBe(expected);
    }
  });
  it('loads all referenced files through the catalog', async () => {
    const defs = await resolveLandmarkCatalogDocuments(LANDMARK_DOCS.catalog, async (path) =>
      JSON.parse(
        await readFile(
          new URL(`../../../../content/worldgen/landmarks/${path}`, import.meta.url),
          'utf8',
        ),
      ),
    );
    expect(defs).toEqual(LANDMARK_DEFINITIONS);
  });
  it('accepts a new data-only sign in the kernel and model loader without a switch case', async () => {
    const definition = { ...LANDMARK_DEFINITIONS['sign.grocery'], id: 'sign.testshop' };
    const defs = await resolveLandmarkCatalogDocuments(
      {
        format: 'molen/landmark-catalog@1',
        version: 1,
        models: { 'sign.testshop': 'testshop.json' },
      },
      async () => definition,
    );
    expect(generateLandmarkModel('sign.testshop', defs)?.triangleCount).toBeGreaterThan(0);
    expect(generateLandmarkModel('sign.testshop', LANDMARK_DEFINITIONS)).toBeUndefined();
    const library = new ModelLibrary(undefined, defs);
    try {
      expect((await library.prepare('builtin:sign.testshop')).bounds.isEmpty()).toBe(false);
    } finally {
      library.dispose();
    }
  });
  it('rejects invalid parameters, escaping paths, and mismatched identities', async () => {
    expect(
      validateByKind('landmark', {
        ...LANDMARK_DEFINITIONS.bench,
        parts: [{ center: [0, 0, 0], size: [0, 1, 1], color: '#fff' }],
      }).ok,
    ).toBe(false);
    await expect(
      resolveLandmarkCatalogDocuments(
        { ...(LANDMARK_DOCS.catalog as object), models: { bench: '../outside.json' } },
        async () => LANDMARK_DEFINITIONS.bench,
      ),
    ).rejects.toThrow();
    await expect(
      resolveLandmarkCatalogDocuments(
        { ...(LANDMARK_DOCS.catalog as object), models: { bench: 'bench.json' } },
        async () => LANDMARK_DEFINITIONS.charger,
      ),
    ).rejects.toThrow('does not match');
  });
});

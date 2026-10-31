import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createStructureStream } from '../dist/client.mjs';
import { createStructureIndex } from '../dist/kernel.mjs';
import { compilePlacementCatalog, runtimePlacement } from '../scripts/build-placement-catalogs.mjs';
import {
  readPlacementSourcesSync,
  readStructurePlacements,
} from '../scripts/placement-sources.mjs';

describe('placement compiler', () => {
  it('retains all source evidence and projects the full catalog without altering geometry', async () => {
    const source = await readStructurePlacements();
    expect(readPlacementSourcesSync().catalog).toEqual(source);
    const before = JSON.stringify(source);
    const built = compilePlacementCatalog(source);
    expect(JSON.stringify(source)).toBe(before);
    expect(built.document.entries).toHaveLength(source.entries.length);
    expect(JSON.stringify(built.document)).not.toMatch(/"(?:basis|note)":/);
    for (let i = 0; i < source.entries.length; i++) {
      const original = source.entries[i],
        entry = built.document.entries[i];
      expect(entry).toEqual(runtimePlacement(original));
      expect(entry.anchor).toEqual(original.anchor);
      expect(entry.appearance).toEqual(original.appearance);
      expect(entry.source).toBe(original.source);
    }
    const full = createStructureIndex(built.document);
    const stream = createStructureStream(built.directory, async (path) =>
      JSON.parse(built.files.get(path)),
    );
    for (const bounds of [
      [-180, -90, 180, 90],
      [-122.4, 47.5, -122.2, 47.7],
      [-0.3, 51.4, 0.1, 51.6],
      [170, -80, -170, 80],
    ]) {
      for (const options of [{}, { includeDraft: true }, { viewingDate: '1920-01-01' }]) {
        const ids = (entries) => entries.map((e) => e.id).sort();
        expect(ids(await stream.queryAsync(bounds, options))).toEqual(
          ids(full.query(bounds, options)),
        );
      }
    }
    stream.dispose();
  }, 30_000); // Reads every source record twice and queries the full compiled catalog under suite load.

  it('emits deterministic files, subdivides dense regions, and matches built outputs', async () => {
    const source = await readStructurePlacements();
    const built = compilePlacementCatalog(source);
    expect([
      ...compilePlacementCatalog({ ...source, entries: [...source.entries].reverse() }).files,
    ]).toEqual([...built.files]);
    for (const [path, text] of built.files)
      expect(
        await readFile(new URL(`../../../content/earth/${path}`, import.meta.url), 'utf8'),
      ).toBe(text);
    const divided = compilePlacementCatalog(source, { maxShardBytes: 32 * 1024 });
    expect(Object.keys(divided.directory.shards).length).toBeGreaterThan(
      Object.keys(built.directory.shards).length,
    );
    expect(
      Object.values(divided.directory.shards).reduce((sum, shard) => sum + shard.count, 0),
    ).toBe(source.entries.length);
  });

  it('indexes extended bounds and identity neighborhoods across boundaries and at the poles', async () => {
    const entry = (id, anchor) => ({
      id,
      anchor,
      title: id,
      asset: `test.${id}`,
      status: 'preview',
      source: 'https://example.com',
    });
    const entries = [
      { ...entry('bridge', [-0.01, 51]), bounds: [-0.02, 50.99, 0.02, 51.01], datum: 'sea-level' },
      {
        ...entry('dateline', [179.9995, 0]),
        orientation: 'mapped',
        mapIdentity: { wikidata: 'Q42', maxDistance: 200 },
      },
      {
        ...entry('polar', [0, 89.9999]),
        orientation: 'mapped',
        mapIdentity: { wikidata: 'Q43', maxDistance: 200 },
      },
    ];
    const built = compilePlacementCatalog({
      format: 'molen/structure-placements@1',
      title: 'Boundaries',
      entries,
    });
    const stream = createStructureStream(built.directory, async (path) =>
      JSON.parse(built.files.get(path)),
    );
    expect((await stream.queryAsync([0.005, 50.99, 0.015, 51.01])).map((e) => e.id)).toEqual([
      'bridge',
    ]);
    expect((await stream.queryAsync([-180, -0.001, -179.9995, 0.001])).map((e) => e.id)).toEqual([
      'dateline',
    ]);
    expect((await stream.queryAsync([170, 89.9998, 171, 90])).map((e) => e.id)).toEqual(['polar']);
    stream.dispose();
  });
});
